import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync, lstatSync, statSync, existsSync, symlinkSync, chmodSync, utimesSync, cpSync, readlinkSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { openDatabase, digest, migrateDatabase, SCHEMA_VERSION } from '../server/database.mjs';
import { rehearseMigration } from '../deploy/production-check.mjs';
import { productionConfig, migrateWithBackup, activateRelease, serviceIdentity, databaseReport, checkoutGit, prepareRollbackApp, useRollbackAppAfterMigration } from '../deploy/production-rollout.mjs';

test('privileged source inspection runs as the checkout owner and leaves the Git index untouched', t => {
  const folder = mkdtempSync(join(tmpdir(), 'ef-git-inspection-')); t.after(() => rmSync(folder, { recursive: true, force: true }));
  const standalone = join(folder, 'standalone'); mkdirSync(standalone);
  const run = (executable, args) => {
    const result = spawnSync(executable, args, { cwd: folder, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr); return result.stdout.trim();
  };
  run('git', ['init', '-q']);
  run('git', ['config', 'user.name', 'Test']); run('git', ['config', 'user.email', 'test@example.test']);
  const tracked = join(standalone, 'file.txt'); writeFileSync(tracked, 'keep');
  run('git', ['add', '.']); run('git', ['commit', '-qm', 'fixture']);
  const index = join(folder, '.git/index'), before = statSync(index), bytes = readFileSync(index);
  // A changed worktree timestamp makes ordinary git status refresh its cache.
  utimesSync(tracked, new Date(Date.now() + 5000), new Date(Date.now() + 5000));
  const calls = [];
  const inspect = checkoutGit(standalone, (executable, args) => {
    if (executable === 'getent') return run(executable, args);
    assert.equal(executable, 'runuser');
    assert.deepEqual(args.slice(0, 4), ['-u', run('getent', ['passwd', String(before.uid)]).split(':')[0], '--', 'git']);
    assert.equal(args[4], '--no-optional-locks'); calls.push(args);
    // The test already runs as the checkout owner; run the actual Git command.
    return run('git', args.slice(4));
  });
  assert.equal(inspect(['status', '--porcelain', '--untracked-files=no']), '');
  assert.match(inspect(['rev-parse', 'HEAD']), /^[a-f0-9]{40}$/);
  assert.equal(calls.length, 2);
  const after = statSync(index);
  assert.deepEqual(readFileSync(index), bytes);
  assert.equal(after.ino, before.ino); assert.equal(after.mtimeMs, before.mtimeMs);
  assert.equal(after.uid, before.uid); assert.equal(after.mode, before.mode);
});

function resolveIdentity({ user = 'sentinelx', group = '', uid = 1001, primaryGid = 1001, actualUid = uid, actualGid = group ? 2001 : primaryGid, resolvedGroup = 'store-web' } = {}) {
  const calls = [];
  const result = serviceIdentity('test.service', { base: '/unused' }, {
    getProperty: (_unit, name) => name === 'User' ? user : group,
    run: (executable, args) => {
      calls.push([executable, ...args]);
      return args[0] === 'passwd' ? `sentinelx:x:${uid}:${primaryGid}:Service:/srv:/usr/sbin/nologin` : `${resolvedGroup}:x:${group ? 2001 : primaryGid}:`;
    },
    readStatus: () => `Uid:\t${actualUid}\t${actualUid}\t${actualUid}\t${actualUid}\nGid:\t${actualGid}\t${actualGid}\t${actualGid}\t${actualGid}\n`
  });
  return { result, calls };
}

test('rollout resolves the configured service user exactly, including numeric users and custom groups', () => {
  const named = resolveIdentity({ group: 'store-web' });
  assert.deepEqual(named.result, { user: 'sentinelx', uid: 1001, group: 'store-web', gid: 2001 });
  assert.deepEqual(named.calls, [['getent', 'passwd', 'sentinelx'], ['getent', 'group', 'store-web']]);
  const numeric = resolveIdentity({ user: '1001' });
  assert.equal(numeric.result.user, 'sentinelx');
  assert.equal(numeric.result.gid, 1001);
  assert.deepEqual(numeric.calls, [['getent', 'passwd', '1001'], ['getent', 'group', '1001']]);
});

test('service identity resolves real Linux accounts and checks the current process IDs', { skip: process.platform !== 'linux' }, () => {
  const identity = serviceIdentity('test.service', { base: '/proc/self' }, {
    getProperty: (_unit, name) => String(name === 'User' ? process.getuid() : process.getgid())
  });
  assert.equal(identity.uid, process.getuid());
  assert.equal(identity.gid, process.getgid());
});

test('rollout stops if configured service credentials no longer match the running process', () => {
  assert.throws(() => resolveIdentity({ actualUid: 2002 }), /SERVICE_USER_CHANGED_SINCE_START/);
  assert.throws(() => resolveIdentity({ actualGid: 2002 }), /SERVICE_GROUP_CHANGED_SINCE_START/);
  assert.throws(() => resolveIdentity({ user: '%i' }), /INVALID_SERVICE_ACCOUNT/);
});

const caddy = () => ({ admin: { disabled: true }, apps: { http: { servers: { production: {
  listen: ['127.0.0.1:8081'], routes: [{ handle: [
    { handler: 'vars', root: '/srv/eldritch-production/frontend' },
    { handler: 'reverse_proxy', upstreams: [{ dial: '127.0.0.1:3102' }], headers: { request: { set: { 'x-eldritch-client-ip': ['untrusted'], Authorization: ['keep-existing-value'] } } } }
  ] }]
} } } } });

test('production Caddy changes preserve routing and replace spoofable client headers', () => {
  const original = caddy();
  original.apps.http.servers.production.routes[0].handle[1].headers.request.add = { 'X-Eldritch-Client-IP': ['also-untrusted'] };
  original.apps.http.servers.production.routes[0].handle[1].headers.request.delete = ['X-Eldritch-Client-Ip', 'Other-Header'];
  const before = structuredClone(original);
  const result = productionConfig(original, 'release-123');
  assert.deepEqual(original, before);
  assert.equal(result.config.admin.disabled, true);
  assert.deepEqual(result.listeners, ['127.0.0.1:8081']);
  const server = result.config.apps.http.servers.production;
  assert.equal(server.routes[0].handle[0].response.set['Referrer-Policy'][0], 'no-referrer');
  const proxy = server.routes[1].handle[1];
  assert.equal(proxy.headers.request.set['x-eldritch-client-ip'], undefined);
  assert.deepEqual(proxy.headers.request.set['X-Eldritch-Client-Ip'], ['{http.request.header.CF-Connecting-IP}']);
  assert.deepEqual(proxy.headers.request.add, {});
  assert.deepEqual(proxy.headers.request.delete, ['Other-Header']);
  assert.deepEqual(proxy.headers.request.set.Authorization, ['keep-existing-value']);
  assert.equal(proxy.upstreams[0].dial, '127.0.0.1:3102');
});

test('a subsequent release updates its public marker without accumulating header routes', () => {
  const first = productionConfig(caddy(), 'first').config;
  const second = productionConfig(first, 'second').config;
  const routes = second.apps.http.servers.production.routes;
  assert.equal(routes.length, first.apps.http.servers.production.routes.length);
  assert.deepEqual(routes[0].handle[0].response.set['X-Eldritch-Release'], ['second']);
  assert.deepEqual(routes[0].handle[0].response.set['X-Eldritch-Frontend-Release'], ['second']);
});

test('rollout refuses public listeners and an unexpected database proxy before changing configuration', () => {
  const publicConfig = caddy(); publicConfig.apps.http.servers.production.listen = [':8081'];
  assert.throws(() => productionConfig(publicConfig, 'release'), /LOOPBACK/);
  const legacy = caddy(); legacy.apps.http.servers.production.routes[0].handle[1].upstreams[0].dial = '127.0.0.1:3000';
  assert.throws(() => productionConfig(legacy, 'release'), /UNEXPECTED_API_UPSTREAM/);
});

test('live migration makes a private restorable backup while retaining accounts, sessions and catalog data', async t => {
  const folder = mkdtempSync(join(tmpdir(), 'ef-live-upgrade-')); t.after(() => rmSync(folder, { recursive: true, force: true }));
  const filename = join(folder, 'live.db'), snapshot = join(folder, 'before.sqlite');
  const legacy = openDatabase(filename);
  legacy.exec(readFileSync(new URL('../server/accounts-schema.sql', import.meta.url), 'utf8'));
  legacy.prepare("INSERT INTO account_users(id,email,password_hash,role) VALUES('admin','private@example.test','unchanged','admin')").run();
  legacy.prepare("INSERT INTO account_sessions(token_hash,user_id,expires_at) VALUES('session','admin','2099-01-01')").run();
  const token = 'b'.repeat(64);
  legacy.prepare("INSERT INTO account_tokens(token_hash,user_id,purpose,expires_at) VALUES(?,'admin','verify_email','2099-01-01')").run(digest(token));
  for (const id of ['first', 'duplicate']) legacy.prepare("INSERT INTO email_outbox(id,recipient,template,payload_json) VALUES(?,'private@example.test','verify_email',?)").run(id, JSON.stringify({ verification: token }));
  legacy.close();
  const summary = await migrateWithBackup(filename, snapshot);
  assert.deepEqual(summary, { schemaVersion: SCHEMA_VERSION, accounts: 1, sessions: 1, preserved: true });
  assert.equal(statSync(snapshot).mode & 0o777, 0o600);
  const live = openDatabase(filename), old = openDatabase(snapshot, { readOnly: true });
  try {
    assert.equal(live.prepare('SELECT password_hash FROM account_users').get().password_hash, 'unchanged');
    assert.equal(live.prepare("SELECT COUNT(*) AS n FROM email_outbox WHERE status='pending'").get().n, 1);
    assert.equal(old.prepare("SELECT COUNT(*) AS n FROM email_outbox WHERE status='pending'").get().n, 2);
    assert.equal(old.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE name='schema_migrations'").get().n, 0);
  } finally { live.close(); old.close(); }
  await assert.rejects(migrateWithBackup(filename, snapshot), /BACKUP_ALREADY_EXISTS/);
});

test('the database CLI runs through a symlink and actually creates the backup and migrates the database', t => {
  const folder = mkdtempSync(join(tmpdir(), 'ef-linked-release-')); t.after(() => rmSync(folder, { recursive: true, force: true }));
  const linkedApp = join(folder, 'linked-app');
  symlinkSync(fileURLToPath(new URL('..', import.meta.url)), linkedApp);
  for (const [index, flags] of [[], ['--preserve-symlinks-main']].entries()) {
    const filename = join(folder, 'live-' + index + '.db'), snapshot = join(folder, 'before-' + index + '.sqlite');
    const legacy = openDatabase(filename);
    legacy.exec(readFileSync(new URL('../server/accounts-schema.sql', import.meta.url), 'utf8'));
    legacy.prepare("INSERT INTO account_users(id,email,password_hash) VALUES('customer','private@example.test','keep-password')").run();
    legacy.prepare("INSERT INTO account_sessions(token_hash,user_id,expires_at) VALUES('session','customer','2099-01-01')").run();
    legacy.close();
    const result = spawnSync(process.execPath, [...flags, join(linkedApp, 'deploy/production-rollout.mjs'), '--database-phase', filename, snapshot], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    const report = databaseReport(result.stdout, snapshot, process.getuid());
    assert.deepEqual(report, { schemaVersion: SCHEMA_VERSION, accounts: 1, sessions: 1, preserved: true });
    const live = openDatabase(filename), copy = openDatabase(snapshot, { readOnly: true });
    try {
      assert.equal(live.prepare('SELECT MAX(version) AS version FROM schema_migrations').get().version, SCHEMA_VERSION);
      assert.equal(live.prepare('SELECT password_hash FROM account_users').get().password_hash, 'keep-password');
      assert.equal(copy.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE name='schema_migrations'").get().n, 0);
      assert.equal(copy.prepare('SELECT COUNT(*) AS n FROM account_sessions').get().n, 1);
    } finally { live.close(); copy.close(); }
  }
});

test('a silent database helper or a missing or public backup cannot be reported as a successful migration', async t => {
  const folder = mkdtempSync(join(tmpdir(), 'ef-backup-report-')); t.after(() => rmSync(folder, { recursive: true, force: true }));
  const filename = join(folder, 'live.db'), snapshot = join(folder, 'before.sqlite');
  const summary = JSON.stringify({ schemaVersion: SCHEMA_VERSION, accounts: 0, sessions: 0, preserved: true });
  assert.throws(() => databaseReport('', snapshot, process.getuid()), /INVALID_DATABASE_STEP_REPORT/);
  assert.throws(() => databaseReport(summary, snapshot, process.getuid()), /DATABASE_BACKUP_MISSING/);
  const db = openDatabase(filename); migrateDatabase(db); db.close();
  const result = await migrateWithBackup(filename, snapshot);
  assert.deepEqual(databaseReport(JSON.stringify(result), snapshot, process.getuid()), result);
  chmodSync(snapshot, 0o644);
  assert.throws(() => databaseReport(summary, snapshot, process.getuid()), /DATABASE_BACKUP_PERMISSIONS_INVALID/);
});

test('the production check CLI also executes when its installation path is a symlink', t => {
  const folder = mkdtempSync(join(tmpdir(), 'ef-linked-check-')); t.after(() => rmSync(folder, { recursive: true, force: true }));
  symlinkSync(fileURLToPath(new URL('..', import.meta.url)), join(folder, 'linked-app'));
  const systemctl = join(folder, 'systemctl');
  writeFileSync(systemctl, '#!/bin/sh\nprintf "0\\n"\n'); chmodSync(systemctl, 0o700);
  const result = spawnSync(process.execPath, [join(folder, 'linked-app/deploy/production-check.mjs')], { encoding: 'utf8', env: { ...process.env, PATH: folder + ':' + process.env.PATH } });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /stopped while reading the active API/);
});

test('a failed public startup check restores both code directories without discarding a later account', async t => {
  const folder = mkdtempSync(join(tmpdir(), 'ef-activation-')); t.after(() => rmSync(folder, { recursive: true, force: true }));
  const entries = ['app', 'frontend'].map(name => {
    const path = join(folder, name), target = join(folder, 'release-' + name);
    mkdirSync(path); mkdirSync(target); writeFileSync(join(path, 'version'), 'old'); writeFileSync(join(target, 'version'), 'new');
    return { path, target, previous: join(folder, 'previous-' + name) };
  });
  const db = openDatabase(join(folder, 'live.db')); migrateDatabase(db); t.after(() => db.close());
  let config = 'old', starts = 0;
  await assert.rejects(activateRelease({ entries,
    configure: async () => { config = 'new'; }, restoreConfig: async () => { config = 'old'; },
    stop: async () => {}, start: async () => { starts++; },
    check: async () => {
      assert.equal(readFileSync(join(entries[0].path, 'version'), 'utf8'), 'new');
      db.prepare("INSERT INTO account_users(id,email,password_hash) VALUES('later','later@example.test','keep')").run();
      throw Error('public route failed');
    }
  }), /PREVIOUS_CODE_RESTORED/);
  assert.equal(starts, 2); assert.equal(config, 'old');
  for (const entry of entries) {
    assert.equal(lstatSync(entry.path).isDirectory(), true);
    assert.equal(readFileSync(join(entry.path, 'version'), 'utf8'), 'old');
    assert.equal(existsSync(entry.previous), false);
  }
  assert.equal(db.prepare('SELECT id FROM account_users').get().id, 'later');
});

test('SMTP verify mode validates configuration even when sending is disabled and leaves the queue unchanged', t => {
  const folder = mkdtempSync(join(tmpdir(), 'ef-smtp-check-')); t.after(() => rmSync(folder, { recursive: true, force: true }));
  const filename = join(folder, 'live.db'), db = openDatabase(filename); migrateDatabase(db); t.after(() => db.close());
  const env = { ...process.env, ELDRITCH_DB: filename, ELDRITCH_SEND_EMAIL: 'NO' };
  for (const name of Object.keys(env)) if (name.startsWith('SMTP_')) delete env[name];
  const result = spawnSync(process.execPath, ['server/mail-worker.mjs', '--verify'], { cwd: new URL('..', import.meta.url), env, encoding: 'utf8' });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /MISSING_SMTP_HOST/);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM email_outbox').get().n, 0);
});


function rollbackFixture(t) {
  const folder = mkdtempSync(join(tmpdir(), 'ef-schema-rollback-'));
  t.after(() => rmSync(folder, { recursive: true, force: true }));
  const old = join(folder, 'old-app'), next = join(folder, 'new-app');
  for (const target of [old, next]) {
    mkdirSync(target);
    cpSync(fileURLToPath(new URL('../server', import.meta.url)), join(target, 'server'), { recursive: true });
  }
  writeFileSync(join(old, 'version'), 'old');
  writeFileSync(join(next, 'version'), 'new');
  writeFileSync(join(old, '.env'), 'PRIVATE_FIXTURE=must-not-copy');
  for (const target of [old, next]) {
    cpSync(fileURLToPath(new URL('../shared', import.meta.url)), join(target, 'shared'), { recursive: true });
  }
  const modulePath = join(old, 'server/database.mjs');
  let module = readFileSync(modulePath, 'utf8').replace(
    'export const SCHEMA_VERSION = ' + SCHEMA_VERSION + ';', 'export const SCHEMA_VERSION = 3;',
  );
  const latestMigration = /  if \(current < 4\) transaction\(db, \(\) => \{\n[\s\S]*?\n  \}\);\n/;
  assert.match(module, latestMigration);
  writeFileSync(modulePath, module.replace(latestMigration, ''));
  const app = join(folder, 'app'), previous = join(folder, 'previous-app');
  symlinkSync(old, app);
  const fallback = prepareRollbackApp(app, next, join(folder, 'rollback-app'));
  assert.equal(existsSync(join(fallback, '.env')), false);
  assert.equal(readFileSync(join(old, 'server/database.mjs'), 'utf8').includes('SCHEMA_VERSION = 3'), true);
  assert.equal(readFileSync(join(fallback, 'version'), 'utf8'), 'old');
  assert.equal(readFileSync(join(fallback, 'server/auth.mjs'), 'utf8'), readFileSync(join(old, 'server/auth.mjs'), 'utf8'));
  assert.ok(existsSync(join(fallback, 'server/migrations/004-class-chronicle.sql')));
  assert.ok(existsSync(join(fallback, 'shared/class-catalog.mjs')));
  assert.equal(readFileSync(join(fallback, 'server/rollback-legacy-game.mjs'), 'utf8'), readFileSync(join(old, 'server/game.mjs'), 'utf8'));
  assert.match(readFileSync(join(fallback, 'server/game.mjs'), 'utf8'), /REALM_MAINTENANCE/);

  return { folder, old, next, app, previous, fallback, database: join(folder, 'live.db') };
}

function probeAccount(app, filename, id, token) {
  const script = [
    "import assert from 'node:assert/strict';",
    "import { join } from 'node:path';",
    "import { pathToFileURL } from 'node:url';",
    "const [app, filename, id, token] = process.argv.slice(1);",
    "const database = await import(pathToFileURL(join(app, 'server/database.mjs')).href);",
    "const auth = await import(pathToFileURL(join(app, 'server/auth.mjs')).href);",
    "const db = database.openDatabase(filename);",
    "try {",
    "  database.requireSchema(db);",
    "  const result = {};",
    "  await auth.authRoute(db, { method: 'GET', headers: { cookie: 'ef_session=' + token } }, {",
    "    writeHead(status) { result.status = status; },",
    "    end(body) { result.body = JSON.parse(body); }",
    "  }, '/api/auth/me');",
    "  assert.equal(result.status, 200);",
    "  assert.equal(result.body.user.id, id);",
    "} finally { db.close(); }",
  ].join('\n');
  return spawnSync(process.execPath, ['--input-type=module', '-e', script, app, filename, id, token], { encoding: 'utf8' });
}

function probeFallbackGame(app, filename, token) {
  const script = [
    "import assert from 'node:assert/strict';",
    "import { Readable } from 'node:stream';",
    "import { randomUUID } from 'node:crypto';",
    "import { join } from 'node:path';",
    "import { pathToFileURL } from 'node:url';",
    "const [app, filename, token] = process.argv.slice(1);",
    "const database = await import(pathToFileURL(join(app, 'server/database.mjs')).href);",
    "const { createGameService } = await import(pathToFileURL(join(app, 'server/game.mjs')).href);",
    "const db = database.openDatabase(filename); database.requireSchema(db);",
    "const game = createGameService(db, { origin: 'https://shop.example.test' });",
    "async function request(path, method='GET', body, signedIn=true) {",
    "  const req = Readable.from(body === undefined ? [] : [Buffer.from(JSON.stringify(body))]);",
    "  req.method=method; req.headers={origin:'https://shop.example.test','content-type':'application/json', ...(signedIn ? {cookie:'ef_session='+token} : {})};",
    "  const result={};",
    "  await game.route(req, {writeHead(status,headers){result.status=status;result.headers=headers;},end(body){result.body=JSON.parse(body);}}, path);",
    "  return result;",
    "}",
    "try {",
    "  for (const path of ['/api/game/world','/api/game/events','/api/game/stash','/api/game/admin/join']) {",
    "    const denied=await request(path,'GET',undefined,false); assert.equal(denied.status,401); assert.equal(denied.body.code,'SIGN_IN_REQUIRED');",
    "  }",
    "  for (const path of ['/api/game/world','/api/game/events','/api/game/admin/join','/api/game/action']) {",
    "    const paused=await request(path); assert.equal(paused.status,503); assert.equal(paused.body.code,'REALM_MAINTENANCE');",
    "    assert.ok(!JSON.stringify(paused.body).includes('NewWizard'));",
    "  }",
    "  const stash=await request('/api/game/stash'); assert.equal(stash.status,200); assert.equal(stash.body.stash.balanceXp,1250); assert.equal(stash.body.stash.balanceCopper,1000);",
    "  const exchanged=await request('/api/game/exchange','POST',{requestId:randomUUID(),lots:1}); assert.equal(exchanged.status,200);",
    "  assert.equal(exchanged.body.stash.balanceXp,0); assert.equal(exchanged.body.stash.balanceCopper,2000); assert.equal(exchanged.body.stash.lifetimeXp,2500);",
    "} finally {game.close(); db.close();}",
  ].join('\n');
  return spawnSync(process.execPath, ['--input-type=module', '-e', script, app, filename, token], { encoding: 'utf8' });
}

async function legacyAccountDatabase(fixture) {
  const legacy = await import(pathToFileURL(join(fixture.old, 'server/database.mjs')).href);
  const db = legacy.openDatabase(fixture.database);
  legacy.migrateDatabase(db);
  const token = 'a'.repeat(64);
  db.prepare("INSERT INTO account_users(id,email,password_hash,email_verified_at) VALUES('existing','existing@example.test','keep','2026-01-01')").run();
  db.prepare("INSERT INTO account_sessions(token_hash,user_id,expires_at) VALUES(?,'existing','2099-01-01')").run(digest(token));
  legacy.requireSchema(db);
  db.prepare("INSERT INTO game_characters(user_id,id,name,hero_class,x,y,hp,kills,gathered_json,shrine,claimed,active_until,last_move_at,last_attack_at,last_chat_at,created_at) VALUES('existing','existing-hero','OldGuardian','ranger',11,13,73,2,'[\"moon\"]',1,0,12345,11000,12000,12001,'2026-01-02')").run();
  db.prepare("INSERT INTO game_wallets(user_id,balance_xp,lifetime_xp,balance_copper) VALUES('existing',1400,2400,1500)").run();
  db.prepare("INSERT INTO game_ledger(id,user_id,event_key,currency,delta,balance_after,reason,created_at) VALUES('existing-entry','existing','old-reward','XP',1400,1400,'Preserved reward','2026-01-02')").run();
  db.prepare("INSERT INTO game_requests(user_id,request_id,payload_hash,notice,created_at) VALUES('existing','old-request','unchanged-hash','unchanged-notice',12000)").run();
  db.prepare("UPDATE game_world SET revision=7,messages_json='[{\"id\":\"old-message\",\"name\":\"The glade\",\"text\":\"A preserved story\",\"time\":12000,\"system\":true}]' WHERE id=1").run();
  db.close();
  return token;
}

test('schema 3 rehearsal and migration preserve populated characters, wallets, receipts and world columns', async t => {
  const f = rollbackFixture(t);
  await legacyAccountDatabase(f);
  const before = openDatabase(f.database, { readOnly: true });
  const tables = ['game_characters','game_wallets','game_ledger','game_requests','game_world'];
  const originals = Object.fromEntries(tables.map(table => [table, before.prepare('SELECT * FROM ' + table).all().map(row => ({...row}))]));
  before.close();
  const rehearsal = await rehearseMigration(f.database);
  assert.equal(rehearsal.schemaVersion, SCHEMA_VERSION);
  assert.equal(rehearsal.preserved, true);
  const untouched = openDatabase(f.database, { readOnly: true });
  assert.equal(untouched.prepare('SELECT MAX(version) AS version FROM schema_migrations').get().version, 3, 'rehearsal leaves the original database unchanged');
  untouched.close();
  await migrateWithBackup(f.database, join(f.folder, 'before.sqlite'));
  const live = openDatabase(f.database), snapshot = openDatabase(join(f.folder, 'before.sqlite'), { readOnly: true });
  try {
    for (const table of tables) {
      const columns = Object.keys(originals[table][0]);
      assert.deepEqual(live.prepare('SELECT ' + columns.join(',') + ' FROM ' + table).all().map(row => ({...row})), originals[table]);
    }
    assert.equal(snapshot.prepare('SELECT MAX(version) AS version FROM schema_migrations').get().version, 3);
    const added = live.prepare("SELECT skill_cooldowns_json,ward_until,ward_amount FROM game_characters WHERE user_id='existing'").get();
    assert.deepEqual({...added}, {skill_cooldowns_json:'{}',ward_until:0,ward_amount:0});
    assert.equal(live.prepare('SELECT effects_json FROM game_world').get().effects_json, '[]');
    assert.equal(live.prepare('PRAGMA foreign_key_check').all().length, 0);
  } finally { live.close(); snapshot.close(); }
});

test('startup failure rolls back to a compatible prior API and retains new accounts and game funds', async t => {
  const f = rollbackFixture(t);
  const existingToken = await legacyAccountDatabase(f);
  let probe = probeAccount(f.app, f.database, 'existing', existingToken);
  assert.equal(probe.status, 0, probe.stderr);
  await migrateWithBackup(f.database, join(f.folder, 'before.sqlite'));
  probe = probeAccount(f.old, f.database, 'existing', existingToken);
  assert.notEqual(probe.status, 0, 'the unchanged old API must reproduce the schema mismatch');

  const oldFrontend = join(f.folder, 'old-front'), newFrontend = join(f.folder, 'new-front');
  mkdirSync(oldFrontend); mkdirSync(newFrontend);
  writeFileSync(join(oldFrontend, 'version'), 'old-front');
  writeFileSync(join(newFrontend, 'version'), 'new-front');
  const frontend = join(f.folder, 'frontend');
  symlinkSync(oldFrontend, frontend);
  let accountId = 'existing', token = existingToken, starts = 0;
  await assert.rejects(activateRelease({
    entries: [
      { path: f.app, previous: f.previous, target: f.next, rollbackTarget: f.fallback },
      { path: frontend, previous: join(f.folder, 'previous-front'), target: newFrontend },
    ],
    configure: async () => {},
    restoreConfig: async () => {},
    stop: async () => {},
    start: async () => {
      starts++;
      const result = probeAccount(f.app, f.database, accountId, token);
      assert.equal(result.status, 0, result.stderr);
    },
    check: async () => {
      const db = openDatabase(f.database);
      token = 'b'.repeat(64);
      db.prepare("INSERT INTO account_users(id,email,password_hash,email_verified_at) VALUES('later','later@example.test','keep-later','2026-01-01')").run();
      db.prepare("INSERT INTO account_sessions(token_hash,user_id,expires_at) VALUES(?,'later','2099-01-01')").run(digest(token));
      db.prepare("INSERT INTO game_wallets(user_id,balance_xp,lifetime_xp,balance_copper) VALUES('later',1250,2500,1000)").run();
      db.prepare("INSERT INTO game_characters(user_id,id,name,hero_class,skill_cooldowns_json) VALUES('later','new-wizard','NewWizard','wizard','{\"frost-nova\":99999}')").run();
      db.prepare("INSERT INTO account_users(id,email,password_hash,email_verified_at,role) VALUES('owner','owner@example.test','keep-owner','2026-01-01','admin')").run();
      db.prepare("INSERT INTO game_admin_characters(user_id,id,session_hash) VALUES('owner','secret-seventh',?)").run(digest('owner-fixture-session'));


      db.close();
      accountId = 'later';
      throw Error('public startup check failed');
    },
  }), /PREVIOUS_CODE_RESTORED/);
  assert.equal(starts, 2);
  assert.equal(readlinkSync(f.app), f.fallback);
  assert.equal(readlinkSync(f.previous), f.old, 'retain the original app link as a recovery record');
  assert.equal(readlinkSync(frontend), oldFrontend);
  const gameProbe = probeFallbackGame(f.app, f.database, token);
  assert.equal(gameProbe.status, 0, gameProbe.stderr);
  const db = openDatabase(f.database, { readOnly: true });
  try {
    assert.equal(db.prepare('SELECT MAX(version) AS v FROM schema_migrations').get().v, SCHEMA_VERSION);
    assert.equal(db.prepare("SELECT password_hash FROM account_users WHERE id='later'").get().password_hash, 'keep-later');
    assert.equal(db.prepare("SELECT balance_copper FROM game_wallets WHERE user_id='later'").get().balance_copper, 2000);
    const created = db.prepare("SELECT name,hero_class,skill_cooldowns_json FROM game_characters WHERE user_id='later'").get();
    assert.deepEqual({...created}, {name:'NewWizard',hero_class:'wizard',skill_cooldowns_json:'{"frost-nova":99999}'});
    assert.equal(db.prepare("SELECT hero_class FROM game_admin_characters WHERE user_id='owner'").get().hero_class, 'death-knight');
    assert.equal(db.prepare("SELECT role FROM account_users WHERE id='owner'").get().role, 'admin');

  } finally { db.close(); }
});

test('a failure after migration commits but before activation selects the compatible fallback only for the new schema', async t => {
  const f = rollbackFixture(t);
  const token = await legacyAccountDatabase(f);
  assert.equal(useRollbackAppAfterMigration({
    database: f.database, app: f.app, previous: f.previous, rollbackTarget: f.fallback,
  }), false);
  assert.equal(readlinkSync(f.app), f.old);
  assert.equal(existsSync(f.previous), false);
  await migrateWithBackup(f.database, join(f.folder, 'before.sqlite'));
  assert.equal(useRollbackAppAfterMigration({
    database: f.database, app: f.app, previous: f.previous, rollbackTarget: f.fallback,
  }), true);
  assert.equal(readlinkSync(f.app), f.fallback);
  assert.equal(readlinkSync(f.previous), f.old);
  const result = probeAccount(f.app, f.database, 'existing', token);
  assert.equal(result.status, 0, result.stderr);
});


test('preparing another recovery release keeps the original legacy game handler', t => {
  const f = rollbackFixture(t);
  const again = prepareRollbackApp(f.fallback, f.next, join(f.folder, 'second-rollback-app'));
  assert.equal(
    readFileSync(join(again, 'server/rollback-legacy-game.mjs'), 'utf8'),
    readFileSync(join(f.fallback, 'server/rollback-legacy-game.mjs'), 'utf8'),
  );
  assert.match(readFileSync(join(again, 'server/game.mjs'), 'utf8'), /REALM_MAINTENANCE/);
  assert.ok(existsSync(join(again, 'server/migrations/004-class-chronicle.sql')));
});
