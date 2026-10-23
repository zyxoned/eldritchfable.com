import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture } from './helpers.mjs';

test('newsletter requires independent consent, deduplicates pending confirmations, and retains suppression', async t => {
  const f = fixture(t);
  const post = (action, body) => f.request('/api/newsletter/' + action, body);
  const email = 'reader@example.test';
  assert.equal((await post('subscribe', { email })).status, 400);
  for (let i = 0; i < 2; i++) assert.equal((await post('subscribe', { email, consent: true })).status, 202);
  assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM email_outbox').get().n, 1);
  const { confirmation, unsubscribe } = JSON.parse(f.queued('newsletter_confirm', email).payload_json);
  assert.equal((await post('confirm', { token: confirmation })).status, 200);
  assert.equal((await post('confirm', { token: confirmation })).status, 400);
  assert.equal((await post('unsubscribe', { token: unsubscribe })).status, 200);
  assert.equal((await post('subscribe', { email, consent: true })).status, 202);
  assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM newsletter_subscribers WHERE confirmed_at IS NOT NULL AND unsubscribed_at IS NULL').get().n, 0);
  assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM email_outbox').get().n, 1);
});

test('customer registration never enrolls a newsletter subscriber', async t => {
  const f = fixture(t);
  await f.request('register', { email: 'customer@example.test', password: 'long-enough-password-123' });
  assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM newsletter_subscribers').get().n, 0);
});
