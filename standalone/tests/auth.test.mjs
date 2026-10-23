import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture, credentials, verifiedAccount, loginCookie } from './helpers.mjs';
import { clientAddress } from '../server/request-security.mjs';

test('registration verifies ownership, keeps customer role, and supports logout', async t => {
  const f = fixture(t);
  const first = await f.request('register', { ...credentials, role: 'admin' });
  const duplicate = await f.request('register', { ...credentials, password: 'different-password-123' });
  assert.equal(first.status, 202); assert.deepEqual(first.body, duplicate.body);
  assert.equal(f.db.prepare('SELECT role FROM account_users').get().role, 'customer');
  assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM email_outbox').get().n, 1);
  assert.equal((await f.request('login', credentials)).status, 403);
  const token = JSON.parse(f.queued('verify_email', credentials.email).payload_json).verification;
  assert.equal((await f.request('verify-email', { token })).status, 200);
  assert.equal((await f.request('verify-email', { token })).status, 400);
  const login = await f.request('login', credentials);
  assert.equal(login.status, 200);
  const cookie = login.headers['Set-Cookie'];
  for (const flag of ['HttpOnly','Secure','SameSite=Lax','Max-Age=604800']) assert.ok(cookie.includes(flag));
  const session = cookie.split(';')[0];
  const me = await f.request('me', undefined, { cookie: session });
  assert.equal(me.body.user.email, credentials.email);
  assert.ok(me.body.user.email_verified_at);
  assert.equal(me.body.user.password_hash, undefined);
  assert.notEqual(f.db.prepare('SELECT token_hash FROM account_sessions').get().token_hash, session.split('=')[1]);
  assert.equal((await f.request('/api/admin/status', undefined, { cookie: session })).status, 403);
  assert.equal((await f.request('logout', {}, { cookie: session })).status, 200);
  assert.equal((await f.request('me', undefined, { cookie: session })).body.user, null);
});

test('expired verification can be reissued without duplicate mail or a new account', async t => {
  const f = fixture(t); const now = Date.now();
  await f.request('register', credentials, { now });
  const original = JSON.parse(f.queued('verify_email', credentials.email).payload_json).verification;
  await f.request('resend-verification', { email: credentials.email }, { now: now + 1000 });
  await f.request('resend-verification', { email: credentials.email }, { now: now + 61000 });
  assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM email_outbox').get().n, 1);
  f.db.prepare("UPDATE account_tokens SET expires_at='2000-01-01T00:00:00.000Z'").run();
  assert.equal((await f.request('verify-email', { token: original })).status, 400);
  await f.request('resend-verification', { email: credentials.email }, { now: now + 62000 });
  const replacement = JSON.parse(f.queued('verify_email', credentials.email).payload_json).verification;
  assert.notEqual(replacement, original);
  assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM account_users').get().n, 1);
  assert.equal((await f.request('verify-email', { token: replacement })).status, 200);
  const known = await f.request('resend-verification', { email: credentials.email });
  const unknown = await f.request('resend-verification', { email: 'unknown@example.test' });
  assert.deepEqual(known.body, unknown.body);
});

test('registration rolls back if the outbox insert fails', async t => {
  const f = fixture(t);
  f.db.exec("CREATE TRIGGER test_outbox_failure BEFORE INSERT ON email_outbox BEGIN SELECT RAISE(ABORT,'simulated failure'); END");
  await assert.rejects(f.request('register', credentials), /simulated failure/);
  for (const table of ['account_users','account_tokens','account_mail_requests']) assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM ' + table).get().n, 0);
});

test('reset requests are deduplicated; password reset revokes sessions and is single use', async t => {
  const f = fixture(t); await verifiedAccount(f);
  const cookie = await loginCookie(f);
  const known = await f.request('request-password-reset', { email: credentials.email });
  const unknown = await f.request('request-password-reset', { email: 'unknown@example.test' });
  assert.deepEqual(known.body, unknown.body);
  await f.request('request-password-reset', { email: credentials.email });
  assert.equal(f.db.prepare("SELECT COUNT(*) AS n FROM email_outbox WHERE template='reset_password'").get().n, 1);
  const token = JSON.parse(f.queued('reset_password', credentials.email).payload_json).reset;
  const results = await Promise.all([1, 2].map(() => f.request('reset-password', { token, password: 'new-passphrase-number-456' })));
  assert.deepEqual(results.map(r => r.status).sort(), [200,400]);
  assert.equal((await f.request('me', undefined, { cookie })).body.user, null);
  assert.equal((await f.request('login', credentials)).status, 401);
  assert.equal((await f.request('login', { ...credentials, password: 'new-passphrase-number-456' })).status, 200);
  assert.equal(f.queued('reset_password', credentials.email).payload_json, '{}');
});

test('password change requires current credentials and invalidates all sessions and pending resets', async t => {
  const f = fixture(t); await verifiedAccount(f);
  const cookie = await loginCookie(f); const otherCookie = await loginCookie(f);
  await f.request('request-password-reset', { email: credentials.email });
  assert.equal((await f.request('change-password', { currentPassword: 'incorrect', password: 'new-good-passphrase-789' }, { cookie })).status, 401);
  assert.equal((await f.request('change-password', { currentPassword: credentials.password, password: 'new-good-passphrase-789' }, { cookie })).status, 200);
  for (const session of [cookie, otherCookie]) assert.equal((await f.request('me', undefined, { cookie: session })).body.user, null);
  assert.equal(f.db.prepare("SELECT COUNT(*) AS n FROM account_tokens WHERE purpose='reset_password'").get().n, 0);
  assert.equal(f.queued('reset_password', credentials.email).status, 'cancelled');
  assert.equal((await f.request('login', { ...credentials, password: 'new-good-passphrase-789' })).status, 200);
});

test('expired and disabled sessions are denied; admin access is enforced on the server', async t => {
  const f = fixture(t); await verifiedAccount(f);
  f.db.prepare("UPDATE account_users SET role='admin'").run();
  const cookie = await loginCookie(f);
  assert.equal((await f.request('/api/admin/status', undefined, { cookie })).status, 200);
  f.db.prepare("UPDATE account_sessions SET expires_at='2000-01-01T00:00:00.000Z'").run();
  assert.equal((await f.request('me', undefined, { cookie })).body.user, null);
  const second = await loginCookie(f);
  f.db.prepare('UPDATE account_users SET disabled_at=CURRENT_TIMESTAMP').run();
  assert.equal((await f.request('me', undefined, { cookie: second })).body.user, null);
  assert.equal((await f.request('login', credentials)).status, 401);
});

test('JSON shape, size and same-origin checks reject malformed requests', async t => {
  const f = fixture(t);
  for (const raw of ['null','[]','"string"','{invalid']) assert.equal((await f.request('register', {}, { raw })).status, 400);
  assert.equal((await f.request('register', {}, { raw: JSON.stringify({ email: 'x'.repeat(20000) }) })).status, 413);
  for (const origin of [undefined,'https://other.example']) assert.equal((await f.request('register', credentials, { headers: { origin } })).status, 403);
  assert.equal((await f.request('register', credentials, { headers: { 'content-type': 'text/plain' } })).status, 403);
  assert.equal((await f.request('unknown', {})).status, 404);
});

test('proxy-aware limits separate visitors and still limit one email across addresses', async t => {
  const f = fixture(t);
  for (let n = 0; n < 9; n++) {
    const result = await f.request('login', { email: 'visitor' + n + '@example.test', password: 'incorrect' }, { headers: { 'x-eldritch-client-ip': '203.0.113.' + (n + 1) } });
    assert.equal(result.status, 401);
  }
  for (let n = 0; n < 9; n++) {
    const result = await f.request('login', { email: 'same@example.test', password: 'incorrect' }, { headers: { 'x-eldritch-client-ip': '198.51.100.' + (n + 1) } });
    assert.equal(result.status, n === 8 ? 429 : 401);
  }
  assert.equal(clientAddress({ socket: { remoteAddress: '198.51.100.9' }, headers: { 'x-eldritch-client-ip': '203.0.113.1' } }, true), '198.51.100.9');
  assert.equal(clientAddress({ socket: { remoteAddress: '127.0.0.1' }, headers: { 'x-eldritch-client-ip': '203.0.113.1' } }, false), '127.0.0.1');
  assert.equal(clientAddress({ socket: { remoteAddress: '127.0.0.1' }, headers: { 'x-forwarded-for': '203.0.113.1' } }, true), '127.0.0.1');
});
