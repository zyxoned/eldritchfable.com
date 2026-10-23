import { randomBytes } from 'node:crypto';
import { digest, transaction } from './database.mjs';
import { enqueueMail } from './account-mail.mjs';
import { normalizeEmail, validEmail, validToken, readJson, sameOriginJson, reply, throttled } from './request-security.mjs';

export async function newsletterRoute(db, req, res, path, options = {}) {
  if (!path.startsWith('/api/newsletter/')) return false;
  if (!['/api/newsletter/subscribe','/api/newsletter/confirm','/api/newsletter/unsubscribe'].includes(path)) { reply(res, 404, { error: 'Not found' }); return true; }
  if (req.method !== 'POST' || !sameOriginJson(req, options.origin)) { reply(res, 403, { error: 'Forbidden' }); return true; }
  let data;
  try { data = await readJson(req, 8192); }
  catch (error) { reply(res, error.status || 400, { error: 'Invalid request' }); return true; }
  if (throttled(db, req, 'newsletter', null, options)) { reply(res, 429, { error: 'Too many requests' }, { 'Retry-After': '900' }); return true; }
  if (path === '/api/newsletter/subscribe') {
    const email = normalizeEmail(data.email);
    if (!validEmail(email) || data.consent !== true) { reply(res, 400, { error: 'Email and explicit consent required' }); return true; }
    transaction(db, () => {
      const existing = db.prepare('SELECT * FROM newsletter_subscribers WHERE email=?').get(email);
      if (existing?.unsubscribed_at || existing?.confirmed_at) return;
      const pending = db.prepare("SELECT id FROM email_outbox WHERE recipient=? AND template='newsletter_confirm' AND token_hash=? AND status IN ('pending','sending')").get(email, existing?.confirmation_token_hash || '');
      const recent = db.prepare("SELECT id FROM email_outbox WHERE recipient=? AND template='newsletter_confirm' AND julianday(created_at)>julianday('now','-1 minute')").get(email);
      if (pending || recent) return;
      db.prepare("UPDATE email_outbox SET status='cancelled',payload_json='{}',claim_id=NULL,lease_expires_at=NULL WHERE recipient=? AND template='newsletter_confirm' AND status IN ('pending','uncertain','failed')").run(email);
      const confirmation = randomBytes(32).toString('hex');
      const unsubscribe = randomBytes(32).toString('hex');
      db.prepare('INSERT INTO newsletter_subscribers(email,subscribed_at,confirmation_token_hash,unsubscribe_token_hash) VALUES(?,CURRENT_TIMESTAMP,?,?) ON CONFLICT(email) DO UPDATE SET subscribed_at=CURRENT_TIMESTAMP,confirmation_token_hash=excluded.confirmation_token_hash,unsubscribe_token_hash=excluded.unsubscribe_token_hash').run(email, digest(confirmation), digest(unsubscribe));
      enqueueMail(db, email, 'newsletter_confirm', { confirmation, unsubscribe });
    });
    reply(res, 202, { message: 'If eligible, a confirmation email will be sent. Check your inbox and spam folder.' }); return true;
  }
  if (!validToken(data.token)) { reply(res, 400, { error: 'Invalid token' }); return true; }
  if (path === '/api/newsletter/confirm') {
    const result = db.prepare('UPDATE newsletter_subscribers SET confirmed_at=CURRENT_TIMESTAMP,confirmation_token_hash=NULL WHERE confirmation_token_hash=? AND unsubscribed_at IS NULL AND confirmed_at IS NULL').run(digest(data.token));
    reply(res, result.changes ? 200 : 400, { ok: Boolean(result.changes) }); return true;
  }
  const result = db.prepare('UPDATE newsletter_subscribers SET unsubscribed_at=CURRENT_TIMESTAMP,confirmed_at=NULL,confirmation_token_hash=NULL WHERE unsubscribe_token_hash=?').run(digest(data.token));
  reply(res, 200, { ok: Boolean(result.changes) }); return true;
}
