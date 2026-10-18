import { DatabaseSync } from 'node:sqlite';
import { createTransport } from 'nodemailer';

const required = ['ELDRITCH_DB', 'SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASSWORD', 'SMTP_FROM', 'ELDRITCH_PUBLIC_URL'];
for (const key of required) if (!process.env[key]) throw Error(key + ' is required');

const base = new URL(process.env.ELDRITCH_PUBLIC_URL);
if (base.protocol !== 'https:') throw Error('ELDRITCH_PUBLIC_URL must use HTTPS');

const db = new DatabaseSync(process.env.ELDRITCH_DB);
const transport = createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: process.env.SMTP_TLS === 'true',
  requireTLS: process.env.SMTP_TLS !== 'true',
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
});
const link = (path, token) => new URL(path + '?token=' + encodeURIComponent(token), base).toString();
const templates = {
  verify_email: p => ({
    subject: 'Verify your Eldritch Fable account',
    text: 'Verify your email: ' + link('/verify-email', p.verification)
  }),
  reset_password: p => ({
    subject: 'Reset your Eldritch Fable password',
    text: 'Reset your password: ' + link('/reset-password', p.reset) + '\nThis link expires in 30 minutes.'
  }),
  newsletter_confirm: p => ({
    subject: 'Confirm your Eldritch Fable newsletter subscription',
    text: 'Confirm your subscription: ' + link('/newsletter/confirm', p.confirmation) +
      '\nUnsubscribe: ' + link('/newsletter/unsubscribe', p.unsubscribe)
  })
};
try {
  const pending = db.prepare("SELECT id,recipient,template,payload_json FROM email_outbox WHERE status='pending' ORDER BY created_at LIMIT 20").all();
  console.log('Pending transactional emails:', pending.length);
  if (process.env.ELDRITCH_SEND_EMAIL !== 'YES') {
    console.log('Dry run only. Set ELDRITCH_SEND_EMAIL=YES after SMTP verification and delivery testing.');
    process.exit(0);
  }
  await transport.verify();
  for (const item of pending) {
    try {
      const template = templates[item.template];
      if (!template) throw new Error('Unsupported email template');
      const payload = JSON.parse(item.payload_json);
      const mail = template(payload);
      const result = await transport.sendMail({ from: process.env.SMTP_FROM, to: item.recipient, ...mail });
      db.prepare("UPDATE email_outbox SET status='sent',sent_at=CURRENT_TIMESTAMP,attempts=attempts+1,payload_json='{}' WHERE id=?").run(item.id);
      console.log('Sent:', item.id, result.messageId);
    } catch (error) {
      const nextAttempt = Number(db.prepare('SELECT attempts FROM email_outbox WHERE id=?').get(item.id)?.attempts || 0) + 1;
      db.prepare("UPDATE email_outbox SET status=?,attempts=? WHERE id=?").run(nextAttempt >= 5 ? 'failed' : 'pending', nextAttempt, item.id);
      console.error('Delivery attempt failed for queue item:', item.id, error.message);
    }
  }
} finally {
  await transport.close();
  db.close();
}
