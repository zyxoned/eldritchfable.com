import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { openDatabase, migrateDatabase, requireSchema, digest } from '../server/database.mjs';

test('legacy migration preserves accounts, sessions and newsletter data while cleaning the queue', t => {
  const db = openDatabase(':memory:'); t.after(() => db.close());
  db.exec(readFileSync(new URL('../server/accounts-schema.sql', import.meta.url), 'utf8'));
  db.prepare("INSERT INTO account_users(id,email,password_hash,role,email_verified_at) VALUES('admin','owner@example.test','existing-hash','admin','2026-01-01')").run();
  db.prepare("INSERT INTO account_users(id,email,password_hash) VALUES('customer','customer@example.test','existing-hash')").run();
  db.prepare("INSERT INTO account_sessions(token_hash,user_id,expires_at) VALUES('session','admin','2099-01-01')").run();
  db.prepare("INSERT INTO newsletter_subscribers(email,unsubscribed_at) VALUES('suppressed@example.test','2026-01-01')").run();
  const token = 'a'.repeat(64);
  db.prepare("INSERT INTO account_tokens(token_hash,user_id,purpose,expires_at) VALUES(?,'customer','verify_email','2099-01-01')").run(digest(token));
  for (const id of ['first','second']) db.prepare("INSERT INTO email_outbox(id,recipient,template,payload_json) VALUES(?,'customer@example.test','verify_email',?)").run(id, JSON.stringify({ verification: token }));
  db.prepare("INSERT INTO email_outbox(id,recipient,template,payload_json,status) VALUES('interrupted','customer@example.test','verify_email',?,'sending')").run(JSON.stringify({ verification: token }));
  assert.throws(() => requireSchema(db), /db:migrate/);
  assert.equal(migrateDatabase(db), 3); assert.equal(migrateDatabase(db), 3);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM account_users').get().n, 2);
  assert.equal(db.prepare("SELECT role,password_hash FROM account_users WHERE id='admin'").get().role, 'admin');
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM account_sessions').get().n, 1);
  assert.equal(db.prepare('SELECT unsubscribed_at FROM newsletter_subscribers').get().unsubscribed_at, '2026-01-01');
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM email_outbox WHERE status='pending'").get().n, 1);
  assert.equal(db.prepare("SELECT status FROM email_outbox WHERE id='second'").get().status, 'cancelled');
  assert.equal(db.prepare("SELECT status,payload_json FROM email_outbox WHERE id='interrupted'").get().status, 'uncertain');
  assert.equal(db.prepare("SELECT payload_json FROM email_outbox WHERE id='interrupted'").get().payload_json, '{}');
  assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
});

test('backup and restore produce a verified copy and refuse to overwrite destinations', t => {
  const folder = mkdtempSync(join(tmpdir(), 'ef-backup-')); t.after(() => rmSync(folder, { recursive: true, force: true }));
  const path = join(folder, 'source.db'); const db = openDatabase(path); migrateDatabase(db);
  db.prepare("INSERT INTO account_users(id,email,password_hash) VALUES('preserve','customer@example.test','hash')").run(); db.close();
  const command = (...args) => spawnSync(process.execPath, ['server/database-tools.mjs', ...args], { cwd: new URL('..', import.meta.url), env: { ...process.env, ELDRITCH_DB: path }, encoding: 'utf8' });
  const backup = join(folder, 'backup.sqlite'); const restored = join(folder, 'restored.sqlite');
  const first = command('backup', backup); assert.equal(first.status, 0, first.stderr);
  const second = command('restore', backup, restored); assert.equal(second.status, 0, second.stderr);
  assert.notEqual(command('restore', backup, restored).status, 0);
  const copy = openDatabase(restored); try { assert.equal(copy.prepare('SELECT id FROM account_users').get().id, 'preserve'); } finally { copy.close(); }
});

test('game migration is additive and preserves account sessions, catalog and newsletter state', t => {
  const db = openDatabase(':memory:');
  t.after(() => db.close());
  db.exec('CREATE TABLE schema_migrations(version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)');
  db.exec(readFileSync(new URL('../server/schema.sql', import.meta.url), 'utf8'));
  db.exec(readFileSync(new URL('../server/accounts-schema.sql', import.meta.url), 'utf8'));
  db.exec(readFileSync(new URL('../server/migrations/002-account-mail.sql', import.meta.url), 'utf8'));
  db.exec('INSERT INTO schema_migrations(version) VALUES(1),(2)');
  db.prepare("INSERT INTO account_users(id,email,password_hash,role,email_verified_at) VALUES('retained','retained@example.test','unchanged-hash','admin','2026-01-01')").run();
  db.prepare("INSERT INTO account_sessions(token_hash,user_id,expires_at) VALUES('retained-session','retained','2099-01-01')").run();
  db.prepare("INSERT INTO storefront_collections(slug,name,icon) VALUES('dice','Dice','dice')").run();
  db.prepare("INSERT INTO newsletter_subscribers(email,unsubscribed_at) VALUES('never-mail@example.test','2026-01-02')").run();
  const tables = ['account_users', 'account_sessions', 'storefront_collections', 'newsletter_subscribers'];
  const before = Object.fromEntries(tables.map(table => [table, db.prepare('SELECT * FROM ' + table).all()]));
  assert.equal(migrateDatabase(db), 3);
  assert.equal(migrateDatabase(db), 3);
  requireSchema(db);
  for (const table of tables) assert.deepEqual(db.prepare('SELECT * FROM ' + table).all(), before[table]);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM game_characters').get().n, 0);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM game_wallets').get().n, 0);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM game_ledger').get().n, 0);
  assert.equal(JSON.parse(db.prepare('SELECT enemies_json FROM game_world WHERE id=1').get().enemies_json).length, 4);
  assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
});

test('game schema preserves a funded XP and coin wallet on repeated migration', t => {
  const db = openDatabase(':memory:');
  t.after(() => db.close());
  migrateDatabase(db);
  db.prepare("INSERT INTO account_users(id,email,password_hash,email_verified_at) VALUES('funded','funded@example.test','hash','2026-01-01')").run();
  db.prepare("INSERT INTO game_characters(user_id,id,name,hero_class) VALUES('funded','public-character','FundedMage','mage')").run();
  db.prepare("INSERT INTO game_wallets(user_id,balance_xp,lifetime_xp,balance_copper) VALUES('funded',1250,2500,1000)").run();
  db.prepare("INSERT INTO game_ledger(id,user_id,event_key,currency,delta,balance_after,reason,created_at) VALUES('retained-ledger','funded','retained','COPPER',1000,1000,'Retained conversion','2026-01-01T00:00:00.000Z')").run();
  const tables = ['game_characters', 'game_wallets', 'game_ledger', 'game_requests', 'game_damage', 'game_world'];
  const before = Object.fromEntries(tables.map(table => [table, db.prepare('SELECT * FROM ' + table).all()]));
  assert.equal(migrateDatabase(db), 3);
  for (const table of tables) assert.deepEqual(db.prepare('SELECT * FROM ' + table).all(), before[table]);
  assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
});
