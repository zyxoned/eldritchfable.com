import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';

test('register, login, admin denied, logout', async () => {
  const folder = mkdtempSync(join(tmpdir(), 'ef-auth-'));
  const dbPath = join(folder, 'test.db');
  const schema = spawnSync('sqlite3', [dbPath, '.read server/accounts-schema.sql'], { cwd: new URL('..', import.meta.url), encoding: 'utf8' });
  assert.equal(schema.status, 0, schema.stderr);
  const port = 30000 + Math.floor(Math.random() * 10000);
  const origin = 'http://127.0.0.1:' + port;
  const child = spawn(process.execPath, ['server/index.mjs'], {
    cwd: new URL('..', import.meta.url),
    env: { ...process.env, PORT: String(port), ELDRITCH_DB: dbPath, ELDRITCH_ORIGIN: origin },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  try {
    await Promise.race([once(child.stdout, 'data'), delay(4000).then(() => { throw Error('Server startup timed out'); })]);
    const request = (path, body, cookie, overrideOrigin = origin) => fetch(origin + path, {
      method: body ? 'POST' : 'GET',
      headers: { ...(body ? { 'content-type': 'application/json', origin: overrideOrigin } : {}), ...(cookie ? { cookie } : {}) },
      body: body ? JSON.stringify(body) : undefined
    });
    const credentials = { email: 'test@example.org', password: 'correct-horse-staple-123' };
    assert.equal((await request('/api/auth/register', credentials)).status, 201);
    assert.equal((await request('/api/auth/register', credentials)).status, 409);
    assert.equal((await request('/api/auth/login', { ...credentials, password: 'incorrect-password' })).status, 401);
    assert.equal((await request('/api/auth/login', credentials, null, 'https://evil.example')).status, 403);
    const login = await request('/api/auth/login', credentials);
    assert.equal(login.status, 200);
    const cookie = login.headers.get('set-cookie')?.split(';')[0];
    assert.ok(cookie?.startsWith('ef_session='));
    assert.equal((await request('/api/admin/status', null, cookie)).status, 403);
    assert.equal((await request('/api/auth/me', null, cookie)).status, 200);
    assert.equal((await request('/api/auth/logout', {}, cookie)).status, 200);
    const after = await (await request('/api/auth/me', null, cookie)).json();
    assert.equal(after.user, null);
  } finally {
    child.kill();
    rmSync(folder, { recursive: true, force: true });
  }
});
