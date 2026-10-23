import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync, lstatSync, statSync, existsSync, symlinkSync, chmodSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { openDatabase, digest, migrateDatabase } from '../server/database.mjs';
import { productionConfig, migrateWithBackup, activateRelease, serviceIdentity, databaseReport } from '../deploy/production-rollout.mjs';

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
  assert.deepEqual(summary, { schemaVersion: 2, accounts: 1, sessions: 1, preserved: true });
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
    assert.deepEqual(report, { schemaVersion: 2, accounts: 1, sessions: 1, preserved: true });
    const live = openDatabase(filename), copy = openDatabase(snapshot, { readOnly: true });
    try {
      assert.equal(live.prepare('SELECT MAX(version) AS version FROM schema_migrations').get().version, 2);
      assert.equal(live.prepare('SELECT password_hash FROM account_users').get().password_hash, 'keep-password');
      assert.equal(copy.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE name='schema_migrations'").get().n, 0);
      assert.equal(copy.prepare('SELECT COUNT(*) AS n FROM account_sessions').get().n, 1);
    } finally { live.close(); copy.close(); }
  }
});

test('a silent database helper or a missing or public backup cannot be reported as a successful migration', async t => {
  const folder = mkdtempSync(join(tmpdir(), 'ef-backup-report-')); t.after(() => rmSync(folder, { recursive: true, force: true }));
  const filename = join(folder, 'live.db'), snapshot = join(folder, 'before.sqlite');
  const summary = JSON.stringify({ schemaVersion: 2, accounts: 0, sessions: 0, preserved: true });
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
