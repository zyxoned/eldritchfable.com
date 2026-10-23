import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

export const SCHEMA_VERSION = 2;
export const digest = value => createHash('sha256').update(value).digest('hex');
export function transaction(db, action) {
  db.exec('BEGIN IMMEDIATE');
  try { const result = action(); db.exec('COMMIT'); return result; }
  catch (error) { db.exec('ROLLBACK'); throw error; }
}
export function openDatabase(path, { readOnly = false } = {}) {
  const db = new DatabaseSync(path, { readOnly, timeout: 5000 });
  db.exec('PRAGMA foreign_keys=ON');
  if (!readOnly) db.exec('PRAGMA journal_mode=WAL');
  return db;
}
function upgradeLegacyQueue(db) {
  const items = db.prepare('SELECT * FROM email_outbox ORDER BY created_at,id').all();
  const seen = new Set();
  for (const item of items) {
    if (['sent','failed','cancelled','uncertain'].includes(item.status)) {
      db.prepare("UPDATE email_outbox SET payload_json='{}' WHERE id=?").run(item.id);
      continue;
    }
    try {
      const payload = JSON.parse(item.payload_json);
      const token = payload[{ verify_email: 'verification', reset_password: 'reset', newsletter_confirm: 'confirmation' }[item.template]];
      if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) throw Error('invalid_payload');
      const tokenHash = digest(token);
      const key = item.template + ':' + tokenHash;
      const current = item.template === 'newsletter_confirm'
        ? db.prepare('SELECT email FROM newsletter_subscribers WHERE email=? AND confirmation_token_hash=? AND confirmed_at IS NULL AND unsubscribed_at IS NULL').get(item.recipient, tokenHash)
        : db.prepare('SELECT u.id FROM account_tokens t JOIN account_users u ON u.id=t.user_id WHERE t.token_hash=? AND t.purpose=? AND t.used_at IS NULL AND t.expires_at>? AND u.email=? AND u.disabled_at IS NULL').get(tokenHash, item.template, new Date().toISOString(), item.recipient);
      if (!current || seen.has(key)) throw Error('obsolete_or_duplicate');
      seen.add(key);
      db.prepare('UPDATE email_outbox SET token_hash=?,dedupe_key=? WHERE id=?').run(tokenHash, key, item.id);
    } catch {
      db.prepare("UPDATE email_outbox SET status='cancelled',payload_json='{}',last_error='legacy_obsolete_or_duplicate' WHERE id=?").run(item.id);
    }
  }
}
export function migrateDatabase(db) {
  db.exec('CREATE TABLE IF NOT EXISTS schema_migrations(version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)');
  const current = db.prepare('SELECT COALESCE(MAX(version),0) AS version FROM schema_migrations').get().version;
  if (current > SCHEMA_VERSION) throw Error('Database is newer than this release');
  if (current < 1) transaction(db, () => {
    db.exec(readFileSync(new URL('./schema.sql', import.meta.url), 'utf8'));
    db.exec(readFileSync(new URL('./accounts-schema.sql', import.meta.url), 'utf8'));
    db.prepare('INSERT INTO schema_migrations(version) VALUES(1)').run();
  });
  if (current < 2) transaction(db, () => {
    db.exec(readFileSync(new URL('./migrations/002-account-mail.sql', import.meta.url), 'utf8'));
    upgradeLegacyQueue(db);
    db.prepare('INSERT INTO schema_migrations(version) VALUES(2)').run();
  });
  return SCHEMA_VERSION;
}
export function requireSchema(db) {
  let version;
  try { version = db.prepare('SELECT MAX(version) AS version FROM schema_migrations').get().version; }
  catch { /* Legacy databases need an explicit, backed-up migration. */ }
  if (version !== SCHEMA_VERSION) throw Error('Run npm run db:migrate against a backed-up database before starting this release');
}
