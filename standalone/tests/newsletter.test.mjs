import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';

test('newsletter requires consent and confirmation, suppresses unsubscribed addresses', async () => {
  const folder = mkdtempSync(join(tmpdir(), 'ef-news-'));
  const dbPath = join(folder, 'test.db');
  const schema = spawnSync('sqlite3', [dbPath, '.read server/accounts-schema.sql'], { cwd: new URL('..', import.meta.url), encoding: 'utf8' });
  assert.equal(schema.status, 0, schema.stderr);
  const port = 30000 + Math.floor(Math.random() * 10000);
  const origin = 'http://127.0.0.1:' + port;
  const child = spawn(process.execPath, ['server/index.mjs'], { cwd: new URL('..', import.meta.url), env: { ...process.env, PORT: String(port), ELDRITCH_DB: dbPath, ELDRITCH_ORIGIN: origin }, stdio: ['ignore', 'pipe', 'pipe'] });
  try {
    await Promise.race([once(child.stdout, 'data'), delay(4000).then(() => { throw Error('Startup timeout'); })]);
    const post = async (path, data) => fetch(origin + '/api/newsletter/' + path, { method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: JSON.stringify(data) });
    const email = 'reader@example.org';
    assert.equal((await post('subscribe', { email })).status, 400);
    assert.equal((await post('subscribe', { email, consent: true })).status, 202);
    const queued = spawnSync('sqlite3', [dbPath, 'SELECT payload_json FROM email_outbox LIMIT 1;'], { encoding: 'utf8' });
    const { confirmation, unsubscribe } = JSON.parse(queued.stdout.trim());
    assert.equal((await post('confirm', { token: confirmation })).status, 200);
    assert.equal((await post('confirm', { token: confirmation })).status, 400);
    assert.equal((await post('unsubscribe', { token: unsubscribe })).status, 200);
    assert.equal((await post('subscribe', { email, consent: true })).status, 202);
    const status = spawnSync('sqlite3', [dbPath, "SELECT COUNT(*) FROM newsletter_subscribers WHERE confirmed_at IS NOT NULL AND unsubscribed_at IS NULL;"], { encoding: 'utf8' });
    assert.equal(status.stdout.trim(), '0');
    const count = spawnSync('sqlite3', [dbPath, 'SELECT COUNT(*) FROM email_outbox;'], { encoding: 'utf8' });
    assert.equal(count.stdout.trim(), '1');
  } finally { child.kill(); rmSync(folder, { recursive: true, force: true }); }
});
