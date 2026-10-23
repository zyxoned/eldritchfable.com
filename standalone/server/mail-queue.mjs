import { randomUUID } from 'node:crypto';
import { digest, transaction } from './database.mjs';
import { validToken } from './request-security.mjs';

const LEASE_MS = 10 * 60_000;
const BACKOFF = [60_000, 5 * 60_000, 15 * 60_000, 3600_000];
const tokenField = { verify_email: 'verification', reset_password: 'reset', newsletter_confirm: 'confirmation' };
function payloadFor(item) {
  const payload = JSON.parse(item.payload_json);
  if (!payload || !validToken(payload[tokenField[item.template]]) || (item.template === 'newsletter_confirm' && !validToken(payload.unsubscribe))) throw Error('invalid_template_payload');
  return payload;
}
export function deliverable(db, item, now = Date.now()) {
  let payload;
  try { payload = payloadFor(item); } catch { return false; }
  const tokenHash = digest(payload[tokenField[item.template]]);
  if (tokenHash !== item.token_hash) return false;
  if (item.template === 'newsletter_confirm') return Boolean(db.prepare('SELECT email FROM newsletter_subscribers WHERE email=? AND confirmation_token_hash=? AND confirmed_at IS NULL AND unsubscribed_at IS NULL').get(item.recipient, tokenHash));
  const user = db.prepare('SELECT u.email_verified_at FROM account_tokens t JOIN account_users u ON u.id=t.user_id WHERE t.token_hash=? AND t.purpose=? AND t.used_at IS NULL AND t.expires_at>? AND u.email=? AND u.disabled_at IS NULL').get(tokenHash, item.template, new Date(now).toISOString(), item.recipient);
  return Boolean(user && (item.template === 'verify_email' ? !user.email_verified_at : user.email_verified_at));
}
export function recoverClaims(db, now = Date.now()) {
  // A dead process may already have handed the message to SMTP. Do not resend it
  // automatically. Customers can explicitly request a replacement link.
  return db.prepare("UPDATE email_outbox SET status='uncertain',payload_json='{}',last_error='worker_interrupted',claim_id=NULL,lease_expires_at=NULL WHERE status='sending' AND lease_expires_at<=?").run(now).changes;
}
export function claimNext(db, now = Date.now()) {
  return transaction(db, () => {
    const item = db.prepare("SELECT * FROM email_outbox WHERE status='pending' AND next_attempt_at<=? ORDER BY created_at,id LIMIT 1").get(now);
    if (!item) return null;
    if (!deliverable(db, item, now)) {
      db.prepare("UPDATE email_outbox SET status='cancelled',payload_json='{}',last_error='obsolete_or_invalid' WHERE id=?").run(item.id);
      return { skipped: true, id: item.id };
    }
    const claimId = randomUUID();
    db.prepare("UPDATE email_outbox SET status='sending',attempts=attempts+1,claim_id=?,lease_expires_at=?,smtp_started_at=NULL WHERE id=? AND status='pending'").run(claimId, now + LEASE_MS, item.id);
    return { ...item, status: 'sending', attempts: item.attempts + 1, claim_id: claimId };
  });
}
export function renderMail(item, { publicUrl, from }) {
  const base = new URL(publicUrl);
  if (base.protocol !== 'https:' || base.username || base.password) throw Error('Public email URL must use HTTPS');
  const payload = payloadFor(item);
  const link = (path, token) => new URL(path + '?token=' + encodeURIComponent(token), base).href;
  const messages = {
    verify_email: () => ({ subject: 'Verify your Eldritch Fable account', text: 'Verify your email: ' + link('/verify-email', payload.verification) + '\nThis link expires in 24 hours. If you did not request this account, you can ignore this message.' }),
    reset_password: () => ({ subject: 'Reset your Eldritch Fable password', text: 'Reset your password: ' + link('/reset-password', payload.reset) + '\nThis link expires in 30 minutes. If you did not request this change, you can ignore this message.' }),
    newsletter_confirm: () => ({ subject: 'Confirm your Eldritch Fable newsletter subscription', text: 'Confirm your subscription: ' + link('/newsletter/confirm', payload.confirmation) + '\nUnsubscribe: ' + link('/newsletter/unsubscribe', payload.unsubscribe) })
  };
  return { from, to: item.recipient, messageId: '<ef-' + item.id + '@' + base.hostname + '>', ...messages[item.template]() };
}
function failureKind(error) {
  // Explicit SMTP rejection means it was not accepted. Network errors during or
  // after DATA are ambiguous; SMTP offers no exactly-once delivery guarantee.
  if (error.responseCode >= 500 || ['EAUTH','EENVELOPE'].includes(error.code)) return 'failed';
  if (error.responseCode >= 400) return 'retry';
  if (['CONN','EHLO','HELO','STARTTLS','AUTH','MAIL FROM','RCPT TO'].includes(error.command) || error.code === 'EDNS') return 'retry';
  return 'uncertain';
}
export function queueStatus(db) {
  return db.prepare('SELECT status,COUNT(*) AS count FROM email_outbox GROUP BY status ORDER BY status').all();
}
export async function runMailBatch(db, transport, options) {
  const clock = options.now || Date.now;
  recoverClaims(db, clock());
  const result = { sent: 0, skipped: 0, retried: 0, failed: 0, uncertain: 0 };
  for (let i = 0; i < (options.limit || 20); i++) {
    const item = claimNext(db, clock());
    if (!item) break;
    if (item.skipped) { result.skipped++; continue; }
    let smtpAccepted = false;
    try {
      const mail = renderMail(item, options);
      // A token may have been used or replaced between claiming and sending.
      if (!deliverable(db, item, clock())) {
        db.prepare("UPDATE email_outbox SET status='cancelled',payload_json='{}',claim_id=NULL,lease_expires_at=NULL WHERE id=? AND claim_id=?").run(item.id, item.claim_id);
        result.skipped++; continue;
      }
      const started = db.prepare("UPDATE email_outbox SET smtp_started_at=? WHERE id=? AND claim_id=? AND status='sending'").run(clock(), item.id, item.claim_id);
      if (!started.changes) { result.skipped++; continue; }
      const response = await transport.sendMail(mail);
      if (!response.accepted?.length) throw Object.assign(Error('Recipient not accepted'), { code: 'EENVELOPE' });
      smtpAccepted = true;
      db.prepare("UPDATE email_outbox SET status='sent',sent_at=?,payload_json='{}',provider_message_id=?,last_error=NULL,claim_id=NULL,lease_expires_at=NULL WHERE id=? AND claim_id=? AND status='sending'").run(new Date(clock()).toISOString(), response.messageId || mail.messageId, item.id, item.claim_id);
      result.sent++;
    } catch (error) {
      const kind = smtpAccepted ? 'uncertain' : failureKind(error);
      const status = kind === 'retry' ? (item.attempts >= 5 ? 'failed' : 'pending') : kind;
      const delay = BACKOFF[Math.min(item.attempts - 1, BACKOFF.length - 1)];
      const code = smtpAccepted ? 'accepted_before_database_failure' : (status === 'uncertain' ? 'delivery_unconfirmed' : 'smtp_' + status);
      db.prepare("UPDATE email_outbox SET status=?,next_attempt_at=?,payload_json=CASE WHEN ?='pending' THEN payload_json ELSE '{}' END,last_error=?,claim_id=NULL,lease_expires_at=NULL WHERE id=? AND claim_id=? AND status='sending'").run(status, clock() + delay, status, code, item.id, item.claim_id);
      result[status === 'pending' ? 'retried' : status]++;
    }
  }
  return result;
}
