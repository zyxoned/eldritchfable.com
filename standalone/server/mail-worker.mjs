import { createTransport } from 'nodemailer';
import { openDatabase, requireSchema } from './database.mjs';
import { queueStatus, runMailBatch } from './mail-queue.mjs';

if (!process.env.ELDRITCH_DB) throw Error('ELDRITCH_DB is required');
const db = openDatabase(process.env.ELDRITCH_DB);
let transport;
try {
  requireSchema(db);
  console.log('Email queue:', JSON.stringify(queueStatus(db)));
  if (process.env.ELDRITCH_SEND_EMAIL !== 'YES') {
    console.log('Dry run. No emails sent or queue entries changed.');
  } else {
    for (const key of ['SMTP_HOST','SMTP_PORT','SMTP_USER','SMTP_PASSWORD','SMTP_FROM','ELDRITCH_PUBLIC_URL']) if (!process.env[key]) throw Object.assign(Error('Missing configuration'), { code: 'MISSING_' + key });
    const publicUrl = new URL(process.env.ELDRITCH_PUBLIC_URL);
    if (publicUrl.protocol !== 'https:' || publicUrl.username || publicUrl.password) throw Object.assign(Error('Invalid public URL'), { code: 'INVALID_PUBLIC_URL' });
    if (process.env.ELDRITCH_ORIGIN && publicUrl.origin !== process.env.ELDRITCH_ORIGIN) throw Object.assign(Error('Public URL and account origin differ'), { code: 'PUBLIC_ORIGIN_MISMATCH' });
    const port = Number(process.env.SMTP_PORT);
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw Object.assign(Error('Invalid SMTP port'), { code: 'INVALID_SMTP_PORT' });
    transport = createTransport({
      host: process.env.SMTP_HOST, port,
      secure: process.env.SMTP_TLS === 'true',
      requireTLS: process.env.SMTP_TLS !== 'true',
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
      connectionTimeout: 15000, greetingTimeout: 15000, socketTimeout: 60000
    });
    await transport.verify();
    console.log('Email batch:', JSON.stringify(await runMailBatch(db, transport, { publicUrl: publicUrl.href, from: process.env.SMTP_FROM })));
  }
} catch (error) {
  // SMTP error text can contain addresses, server responses or credentials.
  console.error('Mail worker failed:', error.code || error.name || 'configuration_error');
  process.exitCode = 1;
} finally {
  if (transport) transport.close();
  db.close();
}
