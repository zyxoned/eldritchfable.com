import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, chmodSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { openDatabase } from '../server/database.mjs';
import { digest } from '../server/database.mjs';
import { rehearseMigration, caddySummary } from '../deploy/production-check.mjs';

function inspect(t, active) {
  const folder = mkdtempSync(join(tmpdir(), 'ef-inspection-'));
  t.after(() => rmSync(folder, { recursive: true, force: true }));
  const tool = (name, script) => { const path = join(folder, name); writeFileSync(path, '#!/bin/sh\n' + script); chmodSync(path, 0o700); };
  tool('node', 'echo v24.22.0'); tool('caddy', 'echo 2.6.2'); tool('id', 'echo 1000'); tool('crontab', 'exit 1');
  tool('systemctl', `case "$1" in
    list-units|list-unit-files) printf '%s\\n' 'eldritch-api.service disabled' 'eldritch-production-api.service enabled' 'eldritch-production-web.service enabled' 'eldritch-production-mail.service enabled';;
    show) case "$2" in
      eldritch-production-api.service) printf '%s\\n' 'ActiveState=${active ? 'active' : 'inactive'}' 'MainPID=1234' 'WorkingDirectory=/srv/production/current' 'User=eldritchadmin' 'EnvironmentFiles=/etc/production.env (ignore_errors=no)';;
      *) printf '%s\\n' 'ActiveState=inactive' 'MainPID=0';;
    esac;;
    *) exit 0;;
  esac`);
  tool('ss', `printf '%s\\n' 'LISTEN 0 511 127.0.0.1:4318 0.0.0.0:* users:(("node",pid=1234,fd=21))' 'LISTEN 0 511 127.0.0.1:4317 0.0.0.0:* users:(("node",pid=5678,fd=22))'`);
  tool('curl', 'printf "%s\\n" "$*" >> "$CURL_CALLS"\nprintf "{\\"status\\":\\"online\\"}\\n"');
  const calls = join(folder, 'calls.txt'); writeFileSync(calls, '');
  const result = spawnSync('bash', [new URL('../deploy/inspect.sh', import.meta.url).pathname], { env: { ...process.env, PATH: folder + ':' + process.env.PATH, CURL_CALLS: calls }, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  return { output: result.stdout, calls: readFileSync(calls, 'utf8') };
}
test('inspection finds the active production API and its actual port, leaving the legacy unit alone', t => {
  const result = inspect(t, true);
  assert.match(result.output, /eldritch-production-api\.service/);
  assert.match(result.output, /WorkingDirectory=\/srv\/production\/current/);
  assert.match(result.calls, /http:\/\/127\.0\.0\.1:4318\/api\/health/);
  assert.doesNotMatch(result.calls, /:3000|:4317/);
});
test('inspection never assumes a default port when no active API can be mapped', t => {
  const result = inspect(t, false);
  assert.equal(result.calls, '');
  assert.match(result.output, /no default port was assumed/);
});

test('production rehearsal migrates a WAL snapshot without changing live accounts, sessions or queue', async t => {
  const folder = mkdtempSync(join(tmpdir(), 'ef-rehearsal-'));
  t.after(() => rmSync(folder, { recursive: true, force: true }));
  const filename = join(folder, 'live.db');
  const db = openDatabase(filename); t.after(() => db.close());
  db.exec(readFileSync(new URL('../server/accounts-schema.sql', import.meta.url), 'utf8'));
  db.prepare("INSERT INTO account_users(id,email,password_hash) VALUES('keep','private@example.test','private-hash')").run();
  db.prepare("INSERT INTO account_sessions(token_hash,user_id,expires_at) VALUES('session','keep','2099-01-01')").run();
  const token = 'a'.repeat(64);
  db.prepare("INSERT INTO account_tokens(token_hash,user_id,purpose,expires_at) VALUES(?,'keep','verify_email','2099-01-01')").run(digest(token));
  for (const id of ['first', 'duplicate']) db.prepare("INSERT INTO email_outbox(id,recipient,template,payload_json) VALUES(?,'private@example.test','verify_email',?)").run(id, JSON.stringify({ verification: token }));
  const result = await rehearseMigration(filename);
  assert.deepEqual(result, { accounts: 1, customers: 1, admins: 0, sessions: 1, schemaVersion: 2, queue: { cancelled: 1, pending: 1 }, preserved: true });
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE name='schema_migrations'").get().n, 0);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM email_outbox WHERE status='pending'").get().n, 2);
  assert.equal(db.prepare('SELECT password_hash FROM account_users').get().password_hash, 'private-hash');
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM account_sessions').get().n, 1);
});

test('production rehearsal refuses a missing live database without creating it', async t => {
  const folder = mkdtempSync(join(tmpdir(), 'ef-missing-live-'));
  t.after(() => rmSync(folder, { recursive: true, force: true }));
  const filename = join(folder, 'missing.db');
  await assert.rejects(rehearseMigration(filename), /does not exist/);
  assert.throws(() => readFileSync(filename), { code: 'ENOENT' });
});

test('Caddy inspection selects paths and trusted-header flags without exposing other header values', () => {
  const summary = caddySummary({ apps: { http: { servers: { production: { routes: [{ handle: [
    { handler: 'vars', root: '/srv/eldritch-production/app/dist' },
    { handler: 'headers', response: { set: { 'Referrer-Policy': ['no-referrer'], Authorization: ['private-value'] } } },
    { handler: 'reverse_proxy', upstreams: [{ dial: '127.0.0.1:3102' }, { dial: 'user:private-value@upstream' }], headers: { request: { set: { 'X-Eldritch-Client-Ip': ['{http.request.header.CF-Connecting-IP}'], Authorization: ['private-value'] } } } }
  ] }] } } } } });
  assert.deepEqual(summary, {
    roots: ['/srv/eldritch-production/app/dist'], upstreams: ['(other upstream; value withheld)', '127.0.0.1:3102'],
    cloudflareClientHeader: true, noReferrer: true
  });
  assert.doesNotMatch(JSON.stringify(summary), /private-value/);
});
