import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Readable } from 'node:stream';
import { EventEmitter } from 'node:events';
import { mkdtempSync, readFileSync, rmSync, statSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createAdminService } from '../server/admin.mjs';
import { createGameService } from '../server/game.mjs';
import { digest, migrateDatabase, openDatabase, requireSchema } from '../server/database.mjs';
import { CLASS_CATALOG } from '../shared/class-catalog.mjs';
import { fixture, verifiedAccount, loginCookie } from './helpers.mjs';

function harness(t, filename) {
  const f = fixture(t, filename);
  let clock = Date.now();
  const service = createAdminService(f.db, { origin: f.origin, now: () => clock });
  const gameService = createGameService(f.db, { origin: f.origin, now: () => clock, random: () => 0 });
  t.after(() => { service.close?.(); gameService.close(); });
  async function account(name, { admin = true, testing = false, verified = true } = {}) {
    const details = { email: name.toLowerCase() + '@example.test', password: 'a-good-testing-passphrase-123' };
    await verifiedAccount(f, details);
    const cookie = await loginCookie(f, details);
    const userId = f.db.prepare('SELECT id FROM account_users WHERE email=?').get(details.email).id;
    if (admin) f.db.prepare("UPDATE account_users SET role='admin' WHERE id=?").run(userId);
    if (testing) f.db.prepare('INSERT INTO admin_account_settings(user_id,testing_enabled) VALUES(?,1)').run(userId);
    if (!verified) f.db.prepare('UPDATE account_users SET email_verified_at=NULL WHERE id=?').run(userId);
    return { userId, cookie, details, name };
  }
  async function request(actor, path, input, headers = {}, method) {
    const req = Readable.from(input === undefined ? [] : [JSON.stringify(input)]);
    req.method = method || (input === undefined ? 'GET' : 'POST');
    req.url = path;
    req.headers = { origin: f.origin, 'content-type': 'application/json', ...(actor?.cookie ? { cookie: actor.cookie } : {}), ...headers };
    req.socket = { remoteAddress: '127.0.0.1' };
    const result = {};
    const res = new EventEmitter();
    res.writeHead = (status, responseHeaders) => Object.assign(result, { status, headers: responseHeaders });
    res.end = body => { result.body = body ? JSON.parse(body) : null; res.emit('close'); };
    const selected = path.startsWith('/api/game/') ? gameService : service;
    assert.equal(await selected.route(req, res, path), true);
    return result;
  }
  return { ...f, account, request, advance(ms = 800) { clock += ms; } };
}
function ok(result) {
  assert.equal(result.status, 200, JSON.stringify(result.body));
  return result.body;
}
function regularState(db) {
  return Object.fromEntries(['account_users', 'account_sessions', 'game_characters', 'game_wallets', 'game_ledger'].map(table => [
    table, db.prepare('SELECT * FROM ' + table + ' ORDER BY rowid').all().map(row => ({ ...row })),
  ]));
}
function grant(h, actor, currency, amount, requestId = randomUUID(), extra = {}) {
  return h.request(actor, '/api/admin/testing/grant', { requestId, currency, amount, ...extra });
}

test('admin overview requires current verified role/session and contains aggregates plus only the caller audit', async t => {
  const h = harness(t);
  const owner = await h.account('OverviewOwner');
  const other = await h.account('OverviewOther');
  const customer = await h.account('OverviewCustomer', { admin: false });
  const unverified = await h.account('OverviewUnverified', { verified: false });
  assert.equal((await h.request(null, '/api/admin/overview')).status, 401);
  assert.equal((await h.request(customer, '/api/admin/overview')).status, 403);
  assert.equal((await h.request(unverified, '/api/admin/overview')).status, 401);
  h.db.prepare('INSERT INTO admin_audit(id,user_id,action,detail_json,created_at) VALUES(?,?,?,?,?)')
    .run(randomUUID(), other.userId, 'profile', JSON.stringify({ marker: 'other-admin-secret' }), new Date().toISOString());
  const overview = ok(await h.request(owner, '/api/admin/overview'));
  assert.equal(overview.profile.heroClass, 'death-knight');
  assert.equal(overview.profile.visitorName, 'The Unnamed');
  assert.equal(overview.profile.testingEnabled, false);
  assert.equal(overview.profile.testXp, 0);
  assert.equal(overview.profile.testCopper, 0);
  assert.equal(overview.overview.counts.accounts, 4);
  assert.equal(overview.overview.counts.verifiedAccounts, 3);
  assert.equal(overview.overview.daily.length, 7);
  assert.ok(Array.isArray(overview.overview.classes));
  const serialized = JSON.stringify(overview);
  assert.equal(serialized.includes(customer.details.email), false);
  assert.equal(serialized.includes(other.details.email), false);
  assert.equal(serialized.includes('other-admin-secret'), false);
  assert.equal(serialized.includes(owner.cookie.slice('ef_session='.length)), false);
  h.db.prepare("UPDATE account_users SET role='customer' WHERE id=?").run(owner.userId);
  assert.equal((await h.request(owner, '/api/admin/overview')).status, 403);
  h.db.prepare("UPDATE account_users SET role='admin' WHERE id=?").run(owner.userId);
  h.db.prepare('UPDATE account_sessions SET revoked_at=CURRENT_TIMESTAMP WHERE token_hash=?').run(digest(owner.cookie.slice('ef_session='.length)));
  assert.equal((await h.request(owner, '/api/admin/overview')).status, 401);
});

test('test XP and gold renew, exchange, reset and persist without changing customer money or progression', async t => {
  const h = harness(t);
  const owner = await h.account('ResourceOwner', { testing: true });
  const before = regularState(h.db);
  let response = ok(await grant(h, owner, 'XP', 2500));
  assert.equal(response.profile.testXp, 2500);
  response = ok(await grant(h, owner, 'GOLD', 3));
  assert.equal(response.profile.testCopper, 3000);
  const exchange = { requestId: randomUUID(), lots: 1 };
  response = ok(await h.request(owner, '/api/admin/testing/exchange', exchange));
  assert.equal(response.profile.testXp, 1250);
  assert.equal(response.profile.testCopper, 4000);
  assert.deepEqual(ok(await h.request(owner, '/api/admin/testing/exchange', exchange)).profile, response.profile);
  response = ok(await h.request(owner, '/api/admin/testing/reset', { requestId: randomUUID() }));
  assert.equal(response.profile.testXp, 0);
  assert.equal(response.profile.testCopper, 0);
  response = ok(await grant(h, owner, 'XP', 1000000000));
  assert.equal(response.profile.testXp, 1000000000, 'Testing resources can be renewed after reset');
  assert.deepEqual(regularState(h.db), before, 'Account/session/ordinary hero, wallet and currency ledger are untouched');
  const persisted = ok(await h.request(owner, '/api/admin/overview')).profile;
  assert.equal(persisted.testXp, 1000000000);
  assert.equal(h.db.prepare('SELECT COUNT(*) AS n FROM game_ledger').get().n, 0);
});

test('admin mutations enforce origin, methods, exact fields, own target and testing capability', async t => {
  const h = harness(t);
  const owner = await h.account('GuardedOwner', { testing: true });
  const other = await h.account('GuardedOther');
  assert.equal((await h.request(owner, '/api/admin/testing/grant', { requestId: randomUUID(), currency: 'XP', amount: 1 }, { origin: 'https://evil.example.test' })).status, 403);
  assert.equal((await h.request(owner, '/api/admin/profile', undefined, {}, 'GET')).status, 405);
  for (const input of [
    { visitorName: '<script>' },
    { visitorName: '' },
    { visitorName: 'ValidName', userId: other.userId },
    { visitorName: 'ValidName', testingEnabled: true },
  ]) {
    assert.equal((await h.request(owner, '/api/admin/profile', { requestId: randomUUID(), ...input })).status, 400);
  }
  assert.equal((await grant(h, owner, 'XP', 5, randomUUID(), { userId: other.userId })).status, 400);
  assert.equal((await grant(h, owner, 'XP', 5, randomUUID(), { testingEnabled: true })).status, 400);
  assert.equal((await h.request(owner, '/api/admin/testing/reset', { requestId: randomUUID(), userId: other.userId })).status, 400);
  assert.equal((await grant(h, other, 'XP', 1)).status, 403);
  assert.equal((await h.request(other, '/api/admin/testing/exchange', { requestId: randomUUID(), lots: 1 })).status, 403);
  assert.equal((await h.request(other, '/api/admin/testing/reset', { requestId: randomUUID() })).status, 403);
  assert.equal(h.db.prepare('SELECT test_xp FROM admin_account_settings WHERE user_id=?').get(owner.userId).test_xp, 0);
  assert.equal(h.db.prepare('SELECT COUNT(*) AS n FROM admin_audit').get().n, 0);
});

test('privileged receipts are immutable globally and recheck current role, session and capability before replay', async t => {
  const h = harness(t);
  const owner = await h.account('ReplayOwner', { testing: true });
  const requestId = randomUUID();
  const first = ok(await grant(h, owner, 'XP', 100, requestId));
  const count = h.db.prepare('SELECT COUNT(*) AS n FROM admin_audit WHERE user_id=?').get(owner.userId).n;
  assert.deepEqual(ok(await grant(h, owner, 'XP', 100, requestId)).profile, first.profile);
  assert.equal(h.db.prepare('SELECT COUNT(*) AS n FROM admin_audit WHERE user_id=?').get(owner.userId).n, count);
  assert.equal((await grant(h, owner, 'XP', 101, requestId)).status, 409);
  assert.equal((await h.request(owner, '/api/admin/profile', { requestId, visitorName: 'ReplayOwner' })).status, 409);
  assert.equal((await h.request(owner, '/api/game/exchange', { requestId, lots: 1 })).status, 409);
  const joinId = randomUUID();
  ok(await h.request(owner, '/api/game/join', { requestId: joinId, name: 'ReplayOwner', heroClass: 'ranger' }));
  assert.equal((await grant(h, owner, 'XP', 100, joinId)).status, 409);
  h.db.prepare('UPDATE admin_account_settings SET testing_enabled=0 WHERE user_id=?').run(owner.userId);
  assert.equal((await grant(h, owner, 'XP', 100, requestId)).status, 403);
  h.db.prepare('UPDATE admin_account_settings SET testing_enabled=1 WHERE user_id=?').run(owner.userId);
  h.db.prepare("UPDATE account_users SET role='customer' WHERE id=?").run(owner.userId);
  assert.equal((await grant(h, owner, 'XP', 100, requestId)).status, 403);
  h.db.prepare("UPDATE account_users SET role='admin' WHERE id=?").run(owner.userId);
  h.db.prepare('UPDATE account_sessions SET revoked_at=CURRENT_TIMESTAMP WHERE token_hash=?').run(digest(owner.cookie.slice('ef_session='.length)));
  assert.equal((await grant(h, owner, 'XP', 100, requestId)).status, 401);
  assert.equal(h.db.prepare('SELECT test_xp FROM admin_account_settings WHERE user_id=?').get(owner.userId).test_xp, 100);
});

test('invalid numeric values and aggregate overflow leave test balances and audit unchanged', async t => {
  const h = harness(t);
  const owner = await h.account('BoundedOwner', { testing: true });
  for (const amount of [0, -1, 1.5, '100', null, 1000000001, Number.MAX_SAFE_INTEGER]) {
    assert.equal((await grant(h, owner, 'XP', amount)).status, 400);
  }
  for (const lots of [0, -1, 0.5, '1', 1000001]) {
    assert.equal((await h.request(owner, '/api/admin/testing/exchange', { requestId: randomUUID(), lots })).status, 400);
  }
  assert.equal((await h.request(owner, '/api/admin/testing/exchange', { requestId: randomUUID(), lots: 1 })).status, 409);
  h.db.prepare('UPDATE admin_account_settings SET test_xp=?,test_copper=? WHERE user_id=?')
    .run(Number.MAX_SAFE_INTEGER - 5, Number.MAX_SAFE_INTEGER - 500, owner.userId);
  const before = h.db.prepare('SELECT * FROM admin_account_settings WHERE user_id=?').get(owner.userId);
  assert.equal((await grant(h, owner, 'XP', 10)).status, 409);
  assert.equal((await grant(h, owner, 'GOLD', 1)).status, 409);
  assert.equal((await h.request(owner, '/api/admin/testing/exchange', { requestId: randomUUID(), lots: 1 })).status, 409);
  assert.deepEqual(h.db.prepare('SELECT * FROM admin_account_settings WHERE user_id=?').get(owner.userId), before);
  assert.equal(h.db.prepare('SELECT COUNT(*) AS n FROM admin_audit').get().n, 0);
});

test('configured death-knight name reaches profile, roster and chat while test XP cannot alter visitor scaling', async t => {
  const h = harness(t);
  const owner = await h.account('NamedOwner', { testing: true });
  const customer = await h.account('NamedCustomer', { admin: false });
  ok(await h.request(owner, '/api/admin/profile', { requestId: randomUUID(), visitorName: 'NightWarden' }));
  ok(await grant(h, owner, 'XP', 1000000000));
  const entered = ok(await h.request(customer, '/api/game/join', { requestId: randomUUID(), name: 'NamedCustomer', heroClass: 'knight', mode: 'solo' }));
  const visit = ok(await h.request(owner, '/api/game/admin/join', { requestId: randomUUID() }));
  assert.equal(visit.profile.character.name, 'NightWarden');
  assert.equal(visit.profile.character.heroClass, 'death-knight');
  assert.equal(visit.realm.visitors.find(row => row.id === visit.playerId).name, 'NightWarden');
  assert.equal(ok(await h.request(customer, '/api/game/world')).realm.visitors[0].name, 'NightWarden');
  h.advance();
  const chatted = ok(await h.request(owner, '/api/game/action', { requestId: randomUUID(), partyId: visit.realm.partyId, kind: 'chat', text: 'A testing guardian greets the party.' }));
  assert.ok(chatted.realm.messages.some(row => row.name === 'NightWarden' && row.text === 'A testing guardian greets the party.'));
  h.db.prepare('UPDATE game_admin_characters SET x=17,y=8 WHERE user_id=?').run(owner.userId);
  h.db.prepare('UPDATE game_characters SET x=17,y=8 WHERE user_id=?').run(customer.userId);
  h.advance();
  const attack = ok(await h.request(owner, '/api/game/action', { requestId: randomUUID(), partyId: entered.realm.partyId, kind: 'attack' }));
  assert.equal(attack.realm.enemies.find(row => row.id === 'bramble').hp, 42 - CLASS_CATALOG.knight.damage);
  assert.equal(ok(await h.request(owner, '/api/game/stash')).stash.balanceXp, 0);
  assert.equal(ok(await h.request(owner, '/api/game/stash')).stash.balanceCopper, 0);
  assert.equal(h.db.prepare('SELECT COUNT(*) AS n FROM game_ledger').get().n, 0);
});

test('schema five upgrades add admin settings without changing existing account, visitor, session or economy rows', () => {
  const db = openDatabase(':memory:');
  try {
    db.exec(readFileSync(new URL('../server/schema.sql', import.meta.url), 'utf8'));
    db.exec(readFileSync(new URL('../server/accounts-schema.sql', import.meta.url), 'utf8'));
    for (const file of ['002-account-mail.sql', '003-game-stash.sql', '004-class-chronicle.sql', '005-party-visitors.sql']) {
      db.exec(readFileSync(new URL('../server/migrations/' + file, import.meta.url), 'utf8'));
    }
    db.exec('CREATE TABLE schema_migrations(version INTEGER PRIMARY KEY,applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)');
    for (let version = 1; version <= 5; version++) db.prepare('INSERT INTO schema_migrations(version) VALUES(?)').run(version);
    db.prepare("INSERT INTO account_users(id,email,password_hash,role,email_verified_at) VALUES('legacy','legacy@example.test','keep','admin','2026-01-01')").run();
    db.prepare("INSERT INTO account_sessions(token_hash,user_id,expires_at) VALUES(?,'legacy','2099-01-01')").run('a'.repeat(64));
    db.prepare("INSERT INTO game_characters(user_id,id,name,hero_class,party_id) VALUES('legacy','legacy-hero','LegacyHero','wizard','legacy-mossvale')").run();
    db.prepare("INSERT INTO game_admin_characters(user_id,id,session_hash,party_id) VALUES('legacy','legacy-visitor',?,'legacy-mossvale')").run('a'.repeat(64));
    db.prepare("INSERT INTO game_wallets(user_id,balance_xp,lifetime_xp,balance_copper) VALUES('legacy',500,1000,2000)").run();
    db.prepare("INSERT INTO game_ledger(id,user_id,event_key,delta,balance_after,reason,created_at) VALUES('legacy-ledger','legacy','preserved',500,500,'Kept','2026-01-01')").run();
    db.prepare("INSERT INTO game_requests(user_id,request_id,payload_hash,notice,created_at,actor_scope,party_id) VALUES('legacy','legacy-request','kept','Kept',1,'admin','legacy-mossvale')").run();
    const tables = ['account_users', 'account_sessions', 'game_characters', 'game_admin_characters', 'game_wallets', 'game_ledger', 'game_requests', 'game_world', 'game_parties'];
    const before = Object.fromEntries(tables.map(table => [table, db.prepare('SELECT * FROM ' + table).all()]));
    assert.equal(migrateDatabase(db), 6);
    requireSchema(db);
    for (const table of tables) assert.deepEqual(db.prepare('SELECT * FROM ' + table).all(), before[table], table);
    assert.equal(db.prepare('PRAGMA foreign_key_check').all().length, 0);
    assert.equal(migrateDatabase(db), 6);
  } finally { db.close(); }
});

test('operator configuration is dry-run by default, requires backup and preserves existing authentication and ordinary balances', async t => {
  const folder = mkdtempSync(join(tmpdir(), 'eldritch-admin-config-'));
  t.after(() => rmSync(folder, { recursive: true, force: true }));
  const filename = join(folder, 'accounts.sqlite');
  const h = harness(t, filename);
  const owner = await h.account('OperatorOwner');
  await h.account('OperatorSecond');
  const customer = await h.account('OperatorCustomer', { admin: false });
  const before = regularState(h.db);
  const cli = fileURLToPath(new URL('../server/configure-admin.mjs', import.meta.url));
  function run(extra = [], expectedCount = 2) {
    return spawnSync(process.execPath, [cli, '--email', owner.details.email, '--name', 'NightWarden', '--testing-enabled', '--expected-admin-count', String(expectedCount), ...extra], {
      encoding: 'utf8', timeout: 20000, env: { ...process.env, ELDRITCH_DB: filename, ELDRITCH_SEND_EMAIL: 'NO' },
    });
  }
  const dry = run();
  assert.equal(dry.status, 0, dry.stderr);
  assert.equal(h.db.prepare('SELECT COUNT(*) AS n FROM admin_account_settings WHERE user_id=?').get(owner.userId).n, 0);
  assert.equal(run(['--apply']).status !== 0, true);
  const wrongCountBackup = join(folder, 'wrong-count.sqlite');
  assert.notEqual(run(['--apply', '--backup', wrongCountBackup], 1).status, 0);
  assert.equal(existsSync(wrongCountBackup), false);
  const backup = join(folder, 'before-configure.sqlite');
  const applied = run(['--apply', '--backup', backup]);
  assert.equal(applied.status, 0, applied.stderr);
  assert.equal(existsSync(backup), true);
  assert.equal(statSync(backup).mode & 0o777, 0o600);
  const snapshot = openDatabase(backup, { readOnly: true });
  try {
    assert.equal(snapshot.prepare('PRAGMA integrity_check').get().integrity_check, 'ok');
    assert.equal(snapshot.prepare('SELECT COUNT(*) AS n FROM admin_account_settings WHERE user_id=?').get(owner.userId).n, 0);
  } finally { snapshot.close(); }
  const settings = h.db.prepare('SELECT * FROM admin_account_settings WHERE user_id=?').get(owner.userId);
  assert.equal(settings.visitor_name, 'NightWarden');
  assert.equal(settings.testing_enabled, 1);
  h.db.prepare('UPDATE admin_account_settings SET test_xp=123,test_copper=456 WHERE user_id=?').run(owner.userId);
  assert.equal(run(['--apply', '--backup', join(folder, 'repeat.sqlite')]).status, 0);
  const repeated = h.db.prepare('SELECT * FROM admin_account_settings WHERE user_id=?').get(owner.userId);
  assert.equal(repeated.test_xp, 123);
  assert.equal(repeated.test_copper, 456);
  assert.deepEqual(regularState(h.db), before);
  const badTarget = spawnSync(process.execPath, [cli, '--email', customer.details.email, '--name', 'NightWarden', '--apply', '--backup', join(folder, 'bad-target.sqlite')], {
    encoding: 'utf8', timeout: 20000, env: { ...process.env, ELDRITCH_DB: filename, ELDRITCH_SEND_EMAIL: 'NO' },
  });
  assert.notEqual(badTarget.status, 0);
  assert.equal(existsSync(join(folder, 'bad-target.sqlite')), false);
  assert.equal(h.db.prepare('SELECT role FROM account_users WHERE id=?').get(customer.userId).role, 'customer');
});

test('populated schema six admin, party and mailbox rows survive private backup/rehearsal and audit stays immutable', async t => {
  const folder = mkdtempSync(join(tmpdir(), 'eldritch-admin-six-'));
  t.after(() => rmSync(folder, { recursive: true, force: true }));
  const filename = join(folder, 'current.sqlite');
  const h = harness(t, filename);
  const owner = await h.account('SixSchemaOwner', { testing: true });
  ok(await h.request(owner, '/api/admin/profile', { requestId: randomUUID(), visitorName: 'NightWarden' }));
  ok(await grant(h, owner, 'XP', 2500));
  h.db.prepare('UPDATE admin_account_settings SET test_copper=7654 WHERE user_id=?').run(owner.userId);
  h.db.prepare("UPDATE game_parties SET revision=9 WHERE id='legacy-mossvale'").run();
  h.db.prepare("INSERT INTO email_outbox(id,recipient,template,payload_json,status) VALUES(?,?,'verify_email','{}','failed')")
    .run(randomUUID(), owner.details.email);
  const tables = ['account_users', 'account_sessions', 'email_outbox', 'game_parties', 'admin_account_settings', 'admin_audit'];
  const before = Object.fromEntries(tables.map(table => [table, h.db.prepare('SELECT * FROM ' + table + ' ORDER BY rowid').all()]));
  assert.throws(() => h.db.prepare("UPDATE admin_audit SET action='tampered' WHERE user_id=?").run(owner.userId));
  assert.throws(() => h.db.prepare('DELETE FROM admin_audit WHERE user_id=?').run(owner.userId));
  const { rehearseMigration } = await import('../deploy/production-check.mjs');
  const rehearsal = await rehearseMigration(filename);
  assert.equal(rehearsal.schemaVersion, 6);
  assert.equal(rehearsal.preserved, true);
  const { migrateWithBackup } = await import('../deploy/production-rollout.mjs');
  const snapshotFile = join(folder, 'before.sqlite');
  const report = await migrateWithBackup(filename, snapshotFile);
  assert.equal(report.schemaVersion, 6);
  assert.equal(report.preserved, true);
  const snapshot = openDatabase(snapshotFile, { readOnly: true });
  try {
    for (const table of tables) {
      assert.deepEqual(h.db.prepare('SELECT * FROM ' + table + ' ORDER BY rowid').all(), before[table], table);
      assert.deepEqual(snapshot.prepare('SELECT * FROM ' + table + ' ORDER BY rowid').all(), before[table], 'backup: ' + table);
    }
    assert.equal(snapshot.prepare('PRAGMA integrity_check').get().integrity_check, 'ok');
  } finally { snapshot.close(); }
});
