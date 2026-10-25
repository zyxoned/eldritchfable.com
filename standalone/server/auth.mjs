import { randomBytes, randomUUID, scrypt as scryptCallback, scryptSync, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { digest, transaction } from './database.mjs';
import { issueAccountMail, cancelAccountMail } from './account-mail.mjs';
import { reply, readJson, sameOriginJson, throttled, normalizeEmail, validEmail, validToken } from './request-security.mjs';

const scrypt = promisify(scryptCallback);
const TTL_MS = 7 * 86400_000;
const dummySalt = randomBytes(16);
const dummyHash = 'scrypt$' + dummySalt.toString('hex') + '$' + scryptSync(randomBytes(32), dummySalt, 64).toString('hex');
const POST_ROUTES = new Set(['register','resend-verification','verify-email','login','request-password-reset','reset-password','change-password','logout']);
const registrationMessage = 'If this address can be registered, check your inbox for a verification email. You can request a new link below.';
const verificationMessage = 'If this account needs verification, a link will be sent. Check your inbox and spam folder.';
const resetMessage = 'If this verified account exists, password reset instructions will be sent.';
export const validPassword = value => typeof value === 'string' && value.length >= 12 && value.length <= 256;
export async function passwordHash(password) {
  const salt = randomBytes(16);
  return 'scrypt$' + salt.toString('hex') + '$' + (await scrypt(password, salt, 64)).toString('hex');
}
async function verifyPassword(password, stored) {
  const parts = String(stored).split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt' || !/^[a-f0-9]{32}$/.test(parts[1]) || !/^[a-f0-9]{128}$/.test(parts[2])) return false;
  const actual = await scrypt(password, Buffer.from(parts[1], 'hex'), 64);
  return timingSafeEqual(Buffer.from(parts[2], 'hex'), actual);
}
const cookie = (token, lifetime = 604800) => 'ef_session=' + token + '; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=' + lifetime;
function parseCookie(req) { return (req.headers.cookie || '').match(/(?:^|;\s*)ef_session=([a-f0-9]{64})(?:;|$)/)?.[1] || null; }
function publicUser(user) { return { id: user.id, email: user.email, role: user.role, email_verified_at: user.email_verified_at }; }
export function sessionUser(db, req, now = Date.now()) {
  const token = parseCookie(req);
  return token ? db.prepare('SELECT u.id,u.email,u.role,u.email_verified_at FROM account_sessions s JOIN account_users u ON u.id=s.user_id WHERE s.token_hash=? AND s.revoked_at IS NULL AND s.expires_at>? AND u.disabled_at IS NULL AND u.email_verified_at IS NOT NULL').get(digest(token), new Date(now).toISOString()) || null : null;
}
function activeToken(db, supplied, purpose, now) {
  return db.prepare('SELECT t.user_id,u.password_hash FROM account_tokens t JOIN account_users u ON u.id=t.user_id WHERE t.token_hash=? AND t.purpose=? AND t.used_at IS NULL AND t.expires_at>? AND u.disabled_at IS NULL').get(digest(supplied), purpose, new Date(now).toISOString());
}
export async function authRoute(db, req, res, path, options = {}) {
  if (!path.startsWith('/api/auth/') && path !== '/api/admin/status') return false;
  const now = options.now ?? Date.now();
  if (path === '/api/auth/me' && req.method === 'GET') {
    reply(res, 200, { user: sessionUser(db, req, now) }); return true;
  }
  if (path === '/api/admin/status' && req.method === 'GET') {
    const user = sessionUser(db, req, now);
    reply(res, user?.role === 'admin' ? 200 : 403, user?.role === 'admin' ? { ok: true } : { error: 'Forbidden' }); return true;
  }
  const action = path.slice('/api/auth/'.length);
  if (!POST_ROUTES.has(action)) { reply(res, 404, { error: 'Not found' }); return true; }
  if (req.method !== 'POST') { reply(res, 405, { error: 'Method not allowed' }); return true; }
  if (!sameOriginJson(req, options.origin)) { reply(res, 403, { error: 'Forbidden' }); return true; }
  let input;
  try { input = await readJson(req); }
  catch (error) { reply(res, error.status || 400, { error: 'Invalid request' }); return true; }
  const email = normalizeEmail(input.email);
  if (throttled(db, req, action, email, { ...options, now })) {
    reply(res, 429, { error: 'Too many attempts. Please try again in 15 minutes.' }, { 'Retry-After': '900' }); return true;
  }
  const send = (status, payload, headers) => { reply(res, status, payload, headers); return true; };
  if (action === 'register') {
    if (!validEmail(email) || !validPassword(input.password)) return send(400, { error: 'Enter a valid email and a password between 12 and 256 characters.' });
    // Hash even for existing addresses; a public request never changes their password.
    const stored = await passwordHash(input.password);
    transaction(db, () => {
      let user = db.prepare('SELECT id,email,email_verified_at,disabled_at FROM account_users WHERE email=?').get(email);
      if (!user) {
        const id = randomUUID();
        db.prepare("INSERT INTO account_users(id,email,password_hash,role) VALUES(?,?,?,'customer')").run(id, email, stored);
        user = { id, email };
      }
      if (!user.email_verified_at && !user.disabled_at) issueAccountMail(db, user, 'verify_email', now);
    });
    return send(202, { ok: true, verificationRequired: true, message: registrationMessage });
  }
  if (action === 'resend-verification' || action === 'request-password-reset') {
    if (!validEmail(email)) return send(400, { error: 'Enter a valid email address.' });
    transaction(db, () => {
      const user = db.prepare('SELECT id,email,email_verified_at FROM account_users WHERE email=? AND disabled_at IS NULL').get(email);
      if (user && (action === 'resend-verification' ? !user.email_verified_at : user.email_verified_at)) {
        issueAccountMail(db, user, action === 'resend-verification' ? 'verify_email' : 'reset_password', now);
      }
    });
    return send(202, { message: action === 'resend-verification' ? verificationMessage : resetMessage });
  }
  if (action === 'verify-email') {
    if (!validToken(input.token)) return send(400, { error: 'This verification link is invalid or expired. Request a new link.', code: 'INVALID_VERIFICATION' });
    const verified = transaction(db, () => {
      const record = activeToken(db, input.token, 'verify_email', now);
      if (!record) return false;
      db.prepare('UPDATE account_users SET email_verified_at=? WHERE id=?').run(new Date(now).toISOString(), record.user_id);
      db.prepare('UPDATE account_tokens SET used_at=? WHERE token_hash=?').run(new Date(now).toISOString(), digest(input.token));
      cancelAccountMail(db, record.user_id, 'verify_email', 'already_verified');
      return true;
    });
    return send(verified ? 200 : 400, verified ? { ok: true } : { error: 'This verification link is invalid or expired. Request a new link.', code: 'INVALID_VERIFICATION' });
  }
  if (action === 'login') {
    if (!validEmail(email) || typeof input.password !== 'string' || !input.password.length || input.password.length > 256) return send(401, { error: 'Invalid email or password.' });
    const row = db.prepare('SELECT * FROM account_users WHERE email=?').get(email);
    const matches = await verifyPassword(input.password, row?.password_hash || dummyHash);
    if (!matches || !row || row.disabled_at) return send(401, { error: 'Invalid email or password.' });
    const result = transaction(db, () => {
      // Reset or disablement may have happened while scrypt was running.
      const current = db.prepare('SELECT * FROM account_users WHERE id=? AND password_hash=? AND disabled_at IS NULL').get(row.id, row.password_hash);
      if (!current) return { status: 401, body: { error: 'Invalid email or password.' } };
      if (!current.email_verified_at) return { status: 403, body: { error: 'Verify your email before signing in. You can request a new link below.', code: 'EMAIL_UNVERIFIED' } };
      const token = randomBytes(32).toString('hex');
      db.prepare('DELETE FROM account_sessions WHERE expires_at<=? OR revoked_at IS NOT NULL').run(new Date(now).toISOString());
      db.prepare('INSERT INTO account_sessions(token_hash,user_id,expires_at) VALUES(?,?,?)').run(digest(token), current.id, new Date(now + TTL_MS).toISOString());
      return { status: 200, body: { user: publicUser(current) }, headers: { 'Set-Cookie': cookie(token) } };
    });
    return send(result.status, result.body, result.headers);
  }
  if (action === 'reset-password') {
    if (!validToken(input.token) || !validPassword(input.password)) return send(400, { error: 'Use a valid reset link and a password between 12 and 256 characters.' });
    if (!activeToken(db, input.token, 'reset_password', now)) return send(400, { error: 'This reset link is invalid or expired. Request a new one.' });
    const stored = await passwordHash(input.password);
    const reset = transaction(db, () => {
      const record = activeToken(db, input.token, 'reset_password', options.now ?? Date.now());
      if (!record) return false;
      db.prepare('UPDATE account_users SET password_hash=? WHERE id=?').run(stored, record.user_id);
      db.prepare('DELETE FROM account_sessions WHERE user_id=?').run(record.user_id);
      cancelAccountMail(db, record.user_id, 'reset_password', 'password_reset');
      db.prepare("DELETE FROM account_tokens WHERE user_id=? AND purpose='reset_password'").run(record.user_id);
      return true;
    });
    return send(reset ? 200 : 400, reset ? { ok: true } : { error: 'This reset link is invalid or expired. Request a new one.' }, reset ? { 'Set-Cookie': cookie('', 0) } : {});
  }
  if (action === 'change-password') {
    const user = sessionUser(db, req, now);
    if (!user) return send(401, { error: 'Sign in to change your password.' });
    if (!validPassword(input.password) || typeof input.currentPassword !== 'string' || input.currentPassword.length > 256) return send(400, { error: 'Enter your current password and a new password between 12 and 256 characters.' });
    const row = db.prepare('SELECT password_hash FROM account_users WHERE id=?').get(user.id);
    if (!await verifyPassword(input.currentPassword, row.password_hash)) return send(401, { error: 'Your current password is incorrect.' });
    const stored = await passwordHash(input.password);
    const changed = transaction(db, () => {
      if (!sessionUser(db, req, options.now ?? Date.now())) return false;
      const result = db.prepare('UPDATE account_users SET password_hash=? WHERE id=? AND password_hash=? AND disabled_at IS NULL').run(stored, user.id, row.password_hash);
      if (result.changes !== 1) return false;
      db.prepare('DELETE FROM account_sessions WHERE user_id=?').run(user.id);
      cancelAccountMail(db, user.id, 'reset_password', 'password_changed');
      db.prepare("DELETE FROM account_tokens WHERE user_id=? AND purpose='reset_password'").run(user.id);
      return true;
    });
    return send(changed ? 200 : 401, changed ? { ok: true } : { error: 'Your session changed. Sign in again.' }, changed ? { 'Set-Cookie': cookie('', 0) } : {});
  }
  const token = parseCookie(req);
  if (token) db.prepare('DELETE FROM account_sessions WHERE token_hash=?').run(digest(token));
  return send(200, { ok: true }, { 'Set-Cookie': cookie('', 0) });
}
