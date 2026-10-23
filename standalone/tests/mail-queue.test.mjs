import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fixture, credentials } from './helpers.mjs';
import { openDatabase, transaction } from '../server/database.mjs';
import { issueAccountMail } from '../server/account-mail.mjs';
import { runMailBatch, claimNext, recoverClaims } from '../server/mail-queue.mjs';

const options = { publicUrl: 'https://store.example.test', from: 'accounts@example.test' };
const success = async mail => ({ accepted: [mail.to], messageId: mail.messageId });
async function pending(f) { await f.request('register', credentials); return f.queued('verify_email', credentials.email); }

test('two workers share an atomic claim and send one copy, then clear the token payload', async t => {
  const folder = mkdtempSync(join(tmpdir(), 'ef-workers-'));
  t.after(() => rmSync(folder, { recursive: true, force: true }));
  const f = fixture(t, join(folder, 'test.db'));
  await pending(f);
  const other = openDatabase(join(folder, 'test.db')); t.after(() => other.close());
  let sends = 0; let observed;
  const transport = { async sendMail(mail) { sends++; observed = mail; await new Promise(resolve => setTimeout(resolve, 30)); return success(mail); } };
  await Promise.all([runMailBatch(f.db, transport, options), runMailBatch(other, transport, options)]);
  assert.equal(sends, 1);
  const row = f.queued('verify_email', credentials.email);
  assert.equal(row.status, 'sent'); assert.equal(row.payload_json, '{}'); assert.equal(row.claim_id, null);
  assert.equal(observed.messageId, '<ef-' + row.id + '@store.example.test>');
});

test('known temporary failures back off and retain the same message identifier on retry', async t => {
  const f = fixture(t); await pending(f); let now = Date.now(); let sends = 0; const ids = [];
  const transport = { async sendMail(mail) { ids.push(mail.messageId); if (++sends === 1) throw Object.assign(Error('offline'), { code: 'ECONNECTION', command: 'CONN' }); return success(mail); } };
  const config = { ...options, now: () => now };
  assert.equal((await runMailBatch(f.db, transport, config)).retried, 1);
  assert.equal(f.queued('verify_email', credentials.email).status, 'pending');
  await runMailBatch(f.db, transport, config); assert.equal(sends, 1);
  now += 61000;
  assert.equal((await runMailBatch(f.db, transport, config)).sent, 1);
  assert.equal(ids[0], ids[1]);
});

test('ambiguous SMTP outcomes are quarantined and explicit resend issues a fresh link', async t => {
  const f = fixture(t); const original = await pending(f); const now = Date.now(); let sends = 0;
  const transport = { async sendMail() { sends++; throw Object.assign(Error('timeout after DATA'), { code: 'ETIMEDOUT', command: 'DATA' }); } };
  assert.equal((await runMailBatch(f.db, transport, { ...options, now: () => now })).uncertain, 1);
  await runMailBatch(f.db, transport, { ...options, now: () => now + 3600000 });
  assert.equal(sends, 1);
  const user = f.db.prepare('SELECT id,email FROM account_users').get();
  transaction(f.db, () => issueAccountMail(f.db, user, 'verify_email', now + 61000));
  const replacement = f.queued('verify_email', credentials.email);
  assert.notEqual(replacement.id, original.id); assert.equal(replacement.status, 'pending');
  assert.notEqual(replacement.token_hash, original.token_hash);
});

test('permanent rejection and repeated temporary failures become terminal', async t => {
  const f = fixture(t); await pending(f);
  const permanent = { async sendMail() { throw Object.assign(Error('recipient rejected'), { responseCode: 550 }); } };
  assert.equal((await runMailBatch(f.db, permanent, options)).failed, 1);
  assert.equal(f.queued('verify_email', credentials.email).payload_json, '{}');
  let now = Date.now() + 61000;
  transaction(f.db, () => issueAccountMail(f.db, f.db.prepare('SELECT id,email FROM account_users').get(), 'verify_email', now));
  const transient = { async sendMail() { throw Object.assign(Error('temporarily rejected'), { responseCode: 451 }); } };
  for (let attempt = 0; attempt < 5; attempt++) {
    await runMailBatch(f.db, transient, { ...options, now: () => now });
    now = f.queued('verify_email', credentials.email).next_attempt_at + 1;
  }
  assert.equal(f.queued('verify_email', credentials.email).status, 'failed');
  assert.equal(f.queued('verify_email', credentials.email).attempts, 5);
});

test('expired tokens, consumed tokens and invalid payloads are never sent', async t => {
  const f = fixture(t); await pending(f);
  let sends = 0; const transport = { async sendMail(mail) { sends++; return success(mail); } };
  f.db.prepare("UPDATE account_tokens SET expires_at='2000-01-01T00:00:00.000Z'").run();
  assert.equal((await runMailBatch(f.db, transport, options)).skipped, 1);
  assert.equal(sends, 0);
  f.db.prepare("UPDATE email_outbox SET status='pending',payload_json='{}'").run();
  assert.equal((await runMailBatch(f.db, transport, options)).skipped, 1);
  assert.equal(sends, 0);
});

test('abandoned claims are quarantined instead of automatically resent', async t => {
  const f = fixture(t); await pending(f); const now = Date.now();
  const claim = claimNext(f.db, now);
  assert.ok(claim.claim_id);
  assert.equal(recoverClaims(f.db, now + 11 * 60000), 1);
  const row = f.queued('verify_email', credentials.email);
  assert.equal(row.status, 'uncertain'); assert.equal(row.payload_json, '{}');
});

test('SMTP acceptance followed by a database failure is not automatically retried', async t => {
  const f = fixture(t); await pending(f); let sends = 0;
  f.db.exec("CREATE TRIGGER test_record_failure BEFORE UPDATE OF status ON email_outbox WHEN NEW.status='sent' BEGIN SELECT RAISE(ABORT,'simulated commit failure'); END");
  const transport = { async sendMail(mail) { sends++; return success(mail); } };
  assert.equal((await runMailBatch(f.db, transport, options)).uncertain, 1);
  await runMailBatch(f.db, transport, options);
  assert.equal(sends, 1);
  assert.equal(f.queued('verify_email', credentials.email).status, 'uncertain');
});

test('dry-run CLI requires no SMTP credentials and never claims or sends mail', async t => {
  const folder = mkdtempSync(join(tmpdir(), 'ef-dry-run-'));
  t.after(() => rmSync(folder, { recursive: true, force: true }));
  const path = join(folder, 'test.db'); const f = fixture(t, path); await pending(f);
  const output = spawnSync(process.execPath, ['server/mail-worker.mjs'], { cwd: new URL('..', import.meta.url), env: { ...process.env, ELDRITCH_DB: path, ELDRITCH_SEND_EMAIL: 'NO' }, encoding: 'utf8' });
  assert.equal(output.status, 0, output.stderr);
  assert.match(output.stdout, /Dry run/);
  assert.equal(f.queued('verify_email', credentials.email).status, 'pending');
  assert.equal(f.queued('verify_email', credentials.email).attempts, 0);
});
