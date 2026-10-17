import { randomBytes, randomUUID, createHash } from 'node:crypto';
const digest = token => createHash('sha256').update(token).digest('hex');
const token = () => randomBytes(32).toString('hex');
const validEmail = email => typeof email === 'string' && email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
function reply(res, status, payload) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(payload));
}
async function readBody(req) {
  let raw = '';
  for await (const chunk of req) {
    raw += chunk.toString('utf8');
    if (raw.length > 8192) throw new Error('Too large');
  }
  return JSON.parse(raw || '{}');
}
export async function newsletterRoute(db, req, res, path) {
  if (!path.startsWith('/api/newsletter/')) return false;
  if (req.method !== 'POST' || req.headers.origin !== process.env.ELDRITCH_ORIGIN || req.headers['content-type']?.split(';')[0] !== 'application/json') {
    reply(res, 403, { error: 'Forbidden' }); return true;
  }
  let data;
  try { data = await readBody(req); } catch { reply(res, 400, { error: 'Invalid request' }); return true; }
  if (path === '/api/newsletter/subscribe') {
    const email = typeof data.email === 'string' ? data.email.trim().toLowerCase() : '';
    if (!validEmail(email) || data.consent !== true) { reply(res, 400, { error: 'Email and explicit consent required' }); return true; }
    const confirmation = token();
    const unsubscribe = token();
    // Suppressed addresses must not be silently re-enrolled.
    const existing = db.prepare('SELECT unsubscribed_at, confirmed_at FROM newsletter_subscribers WHERE email=?').get(email);
    if (!existing?.unsubscribed_at && !existing?.confirmed_at) {
      db.prepare('INSERT INTO newsletter_subscribers(email,subscribed_at,confirmation_token_hash,unsubscribe_token_hash) VALUES(?,CURRENT_TIMESTAMP,?,?) ON CONFLICT(email) DO UPDATE SET subscribed_at=CURRENT_TIMESTAMP,confirmation_token_hash=excluded.confirmation_token_hash,unsubscribe_token_hash=excluded.unsubscribe_token_hash').run(email, digest(confirmation), digest(unsubscribe));
      db.prepare('INSERT INTO email_outbox(id,recipient,template,payload_json) VALUES(?,?,?,?)').run(randomUUID(), email, 'newsletter_confirm', JSON.stringify({ confirmation, unsubscribe }));
    }
    reply(res, 202, { message: 'If eligible, a confirmation email will be sent when email delivery is enabled.' }); return true;
  }
  if (path === '/api/newsletter/confirm') {
    const supplied = data.token;
    if (typeof supplied !== 'string' || !/^[a-f0-9]{64}$/.test(supplied)) { reply(res, 400, { error: 'Invalid token' }); return true; }
    const result = db.prepare('UPDATE newsletter_subscribers SET confirmed_at=CURRENT_TIMESTAMP,confirmation_token_hash=NULL WHERE confirmation_token_hash=? AND unsubscribed_at IS NULL AND confirmed_at IS NULL').run(digest(supplied));
    reply(res, result.changes ? 200 : 400, { ok: Boolean(result.changes) }); return true;
  }
  if (path === '/api/newsletter/unsubscribe') {
    const supplied = data.token;
    if (typeof supplied !== 'string' || !/^[a-f0-9]{64}$/.test(supplied)) { reply(res, 400, { error: 'Invalid token' }); return true; }
    const result = db.prepare('UPDATE newsletter_subscribers SET unsubscribed_at=CURRENT_TIMESTAMP,confirmed_at=NULL,confirmation_token_hash=NULL WHERE unsubscribe_token_hash=?').run(digest(supplied));
    reply(res, 200, { ok: Boolean(result.changes) }); return true;
  }
  reply(res, 404, { error: 'Not found' }); return true;
}
