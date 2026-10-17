import { randomBytes, randomUUID, createHash, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
const scrypt = promisify(scryptCallback);
const hash = value => createHash('sha256').update(value).digest('hex');
const cookieName = 'ef_session';
const MAX_BODY = 16_384;
const TTL_MS = 7 * 86400_000;
const LIMIT_WINDOW = 15 * 60_000;
const attempts = new Map();

function json(res, status, payload, headers = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...headers });
  res.end(JSON.stringify(payload));
}
function limited(key) {
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || entry.until <= now) { attempts.set(key, { count: 1, until: now + LIMIT_WINDOW }); return false; }
  entry.count += 1;
  return entry.count > 8;
}
function parseCookie(req) {
  const raw = req.headers.cookie || '';
  const match = raw.match(/(?:^|;\s*)ef_session=([a-f0-9]{64})(?:;|$)/);
  return match?.[1] || null;
}
async function body(req) {
  let raw = '';
  for await (const chunk of req) {
    raw += chunk.toString('utf8');
    if (Buffer.byteLength(raw) > MAX_BODY) throw new Error('Body too large');
  }
  return JSON.parse(raw || '{}');
}
async function passwordHash(password) {
  const salt = randomBytes(16).toString('hex');
  const digest = await scrypt(password, Buffer.from(salt, 'hex'), 64);
  return 'scrypt$' + salt + '$' + digest.toString('hex');
}
async function verify(password, stored) {
  const parts = String(stored).split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  const expected = Buffer.from(parts[2], 'hex');
  if (expected.length !== 64) return false;
  const actual = await scrypt(password, Buffer.from(parts[1], 'hex'), 64);
  return timingSafeEqual(expected, actual);
}
function userFromSession(db, req) {
  const token = parseCookie(req);
  if (!token) return null;
  return db.prepare("SELECT u.id,u.email,u.role,u.email_verified_at FROM account_sessions s JOIN account_users u ON u.id=s.user_id WHERE s.token_hash=? AND s.revoked_at IS NULL AND s.expires_at > ? AND u.disabled_at IS NULL").get(hash(token), new Date().toISOString()) || null;
}
function sameOrigin(req) {
  const origin = req.headers.origin;
  const allowed = process.env.ELDRITCH_ORIGIN;
  return Boolean(allowed && origin === allowed);
}
function session(db, res, userId) {
  const token = randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + TTL_MS).toISOString();
  db.prepare('INSERT INTO account_sessions(token_hash,user_id,expires_at) VALUES(?,?,?)').run(hash(token), userId, expires);
  return { 'Set-Cookie': cookieName + '=' + token + '; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=604800' };
}
export async function authRoute(db, req, res, pathname) {
  if (!pathname.startsWith('/api/auth/') && pathname !== '/api/admin/status') return false;
  if (pathname === '/api/auth/me' && req.method === 'GET') {
    const user = userFromSession(db, req);
    json(res, 200, { user: user || null });
    return true;
  }
  if (pathname === '/api/admin/status' && req.method === 'GET') {
    const user = userFromSession(db, req);
    json(res, user?.role === 'admin' ? 200 : 403, user?.role === 'admin' ? { ok: true } : { error: 'Forbidden' });
    return true;
  }
  if (req.method !== 'POST') { json(res, 405, { error: 'Method not allowed' }); return true; }
  if (!sameOrigin(req) || req.headers['content-type']?.split(';')[0] !== 'application/json') {
    json(res, 403, { error: 'Forbidden' }); return true;
  }
  const ip = req.socket.remoteAddress || 'unknown';
  if (limited(ip + ':' + pathname)) { json(res, 429, { error: 'Too many requests' }); return true; }
  let input;
  try { input = await body(req); } catch { json(res, 400, { error: 'Invalid request' }); return true; }
  if (pathname === '/api/auth/register') {
    const email = String(input.email || '').trim().toLowerCase();
    const password = input.password;
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || typeof password !== 'string' || password.length < 12 || password.length > 256) {
      json(res, 400, { error: 'Invalid email or password (minimum 12 characters)' }); return true;
    }
    const id = randomUUID();
    const stored = await passwordHash(password);
    try {
      db.prepare("INSERT INTO account_users(id,email,password_hash,role) VALUES(?,?,?,'customer')").run(id, email, stored);
    } catch {
      json(res, 409, { error: 'Account cannot be created with those details' }); return true;
    }
    json(res, 201, { ok: true, verificationRequired: true });
    return true;
  }
  if (pathname === '/api/auth/login') {
    const email = String(input.email || '').trim().toLowerCase();
    const password = input.password;
    const row = db.prepare('SELECT id,email,password_hash,role,disabled_at FROM account_users WHERE email=?').get(email);
    const valid = typeof password === 'string' && row && !row.disabled_at && await verify(password, row.password_hash);
    if (!valid) { json(res, 401, { error: 'Invalid credentials' }); return true; }
    json(res, 200, { user: { id: row.id, email: row.email, role: row.role } }, session(db, res, row.id));
    return true;
  }
  if (pathname === '/api/auth/logout') {
    const token = parseCookie(req);
    if (token) db.prepare('UPDATE account_sessions SET revoked_at=CURRENT_TIMESTAMP WHERE token_hash=?').run(hash(token));
    json(res, 200, { ok: true }, { 'Set-Cookie': cookieName + '=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0' });
    return true;
  }
  json(res, 404, { error: 'Not found' });
  return true;
}
