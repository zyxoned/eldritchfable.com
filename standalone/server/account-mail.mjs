import { randomBytes, randomUUID } from 'node:crypto';
import { digest } from './database.mjs';

export function enqueueMail(db, recipient, template, payload) {
  const token = payload[{ verify_email: 'verification', reset_password: 'reset', newsletter_confirm: 'confirmation' }[template]];
  const tokenHash = digest(token);
  const id = randomUUID();
  db.prepare('INSERT INTO email_outbox(id,recipient,template,payload_json,token_hash,dedupe_key) VALUES(?,?,?,?,?,?)')
    .run(id, recipient, template, JSON.stringify(payload), tokenHash, template + ':' + tokenHash);
  return id;
}
export function cancelAccountMail(db, userId, purpose, reason = 'token_replaced') {
  const purposes = purpose ? [purpose] : ['verify_email','reset_password'];
  for (const item of purposes) {
    db.prepare("UPDATE email_outbox SET status='cancelled',payload_json='{}',claim_id=NULL,lease_expires_at=NULL,last_error=? WHERE template=? AND token_hash IN (SELECT token_hash FROM account_tokens WHERE user_id=? AND purpose=?) AND status IN ('pending','sending','uncertain','failed')")
      .run(reason, item, userId, item);
  }
}
// Called within the registration/resend/reset transaction.
export function issueAccountMail(db, user, purpose, now = Date.now()) {
  const recent = db.prepare('SELECT last_requested_at FROM account_mail_requests WHERE user_id=? AND purpose=?').get(user.id, purpose);
  if (recent && now - recent.last_requested_at < 60_000) return false;
  // Repeated requests cannot invalidate a message already awaiting delivery.
  const queued = db.prepare("SELECT m.id FROM email_outbox m JOIN account_tokens t ON t.token_hash=m.token_hash WHERE t.user_id=? AND t.purpose=? AND t.used_at IS NULL AND t.expires_at>? AND m.status IN ('pending','sending')").get(user.id, purpose, new Date(now).toISOString());
  if (queued) return false;
  cancelAccountMail(db, user.id, purpose);
  db.prepare('DELETE FROM account_tokens WHERE user_id=? AND purpose=?').run(user.id, purpose);
  const token = randomBytes(32).toString('hex');
  const lifetime = purpose === 'verify_email' ? 24 * 3600_000 : 30 * 60_000;
  db.prepare('INSERT INTO account_tokens(token_hash,user_id,purpose,expires_at) VALUES(?,?,?,?)').run(digest(token), user.id, purpose, new Date(now + lifetime).toISOString());
  enqueueMail(db, user.email, purpose, purpose === 'verify_email' ? { verification: token } : { reset: token });
  db.prepare('INSERT INTO account_mail_requests(user_id,purpose,last_requested_at) VALUES(?,?,?) ON CONFLICT(user_id,purpose) DO UPDATE SET last_requested_at=excluded.last_requested_at').run(user.id, purpose, now);
  return true;
}
