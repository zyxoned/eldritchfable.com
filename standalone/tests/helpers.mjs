import { Readable } from 'node:stream';
import { openDatabase, migrateDatabase } from '../server/database.mjs';
import { authRoute } from '../server/auth.mjs';
import { newsletterRoute } from '../server/newsletter.mjs';

export function fixture(t, path = ':memory:') {
  const db = openDatabase(path); migrateDatabase(db);
  t.after(() => db.close());
  const origin = 'https://store.example.test';
  async function request(action, data, options = {}) {
    const req = Readable.from(data === undefined ? [] : [options.raw ?? JSON.stringify(data)]);
    req.method = options.method || (data === undefined ? 'GET' : 'POST');
    req.headers = { origin, 'content-type': 'application/json', ...(options.cookie ? { cookie: options.cookie } : {}), ...options.headers };
    req.socket = { remoteAddress: options.ip || '127.0.0.1' };
    const result = {};
    const res = { writeHead(status, headers) { result.status = status; result.headers = headers; }, end(body) { result.body = JSON.parse(body); } };
    const path = action.startsWith('/') ? action : '/api/auth/' + action;
    const config = { origin, trustProxy: true, ...options };
    if (!await authRoute(db, req, res, path, config)) await newsletterRoute(db, req, res, path, config);
    return result;
  }
  const queued = (template, email) => db.prepare('SELECT * FROM email_outbox WHERE template=? AND recipient=? ORDER BY rowid DESC LIMIT 1').get(template, email);
  return { db, request, queued, origin };
}
export const credentials = { email: 'customer@example.test', password: 'a-very-good-passphrase-123' };
export async function verifiedAccount(f, details = credentials) {
  await f.request('register', details);
  const token = JSON.parse(f.queued('verify_email', details.email).payload_json).verification;
  await f.request('verify-email', { token });
  return details;
}
export async function loginCookie(f, details = credentials) {
  const response = await f.request('login', details);
  if (response.status !== 200) throw Error(JSON.stringify(response.body));
  return response.headers['Set-Cookie'].split(';')[0];
}
