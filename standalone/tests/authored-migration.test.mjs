import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { openDatabase, migrateDatabase, SCHEMA_VERSION } from '../server/database.mjs';

test('populated schema seven migration preserves all legacy rows and expands combat health storage', t => {
  const db = openDatabase(':memory:'); t.after(() => db.close());
  db.exec('CREATE TABLE schema_migrations(version INTEGER PRIMARY KEY,applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)');
  for (const filename of ['schema.sql', 'accounts-schema.sql', 'migrations/002-account-mail.sql', 'migrations/003-game-stash.sql', 'migrations/004-class-chronicle.sql', 'migrations/005-party-visitors.sql', 'migrations/006-admin-testing.sql', 'migrations/007-world-regions.sql']) {
    db.exec(readFileSync(new URL('../server/' + filename, import.meta.url), 'utf8'));
  }
  db.exec('INSERT INTO schema_migrations(version) VALUES(1),(2),(3),(4),(5),(6),(7)');
  const activeUntil = Date.now() + 100000;
  for (const [userId, role, lease] of [['active', 'customer', activeUntil], ['offline', 'customer', 0], ['administrator', 'admin', activeUntil]]) {
    db.prepare("INSERT INTO account_users(id,email,password_hash,email_verified_at,role) VALUES(?,?,'unchanged','2026-01-01',?)").run(userId, userId + '@example.test', role);
    db.prepare("INSERT INTO game_characters(user_id,id,name,hero_class,x,y,hp,kills,gathered_json,shrine,claimed,active_until,last_move_at,last_attack_at,last_chat_at,created_at,skill_cooldowns_json,ward_until,ward_amount,party_id,appearance_json,region_id,battle_stance,tactic) VALUES(?,?,?,'mage',14,13,73,19,'[\"moon\"]',1,1,?,987,988,989,'2025-01-01','{\"arcane-pulse\":999999}',789,12,'legacy-mossvale','{\"skinTone\":\"warm\"}','amberReach','guarded','recovery-first')")
      .run(userId, userId + '-hero', userId, lease);
    db.prepare('INSERT INTO game_wallets(user_id,balance_xp,lifetime_xp,balance_copper) VALUES(?,5000,9000,10000)').run(userId);
  }
  db.prepare("INSERT INTO account_sessions(token_hash,user_id,expires_at) VALUES('session','active','2099-01-01')").run();
  db.prepare("INSERT INTO game_requests(user_id,request_id,payload_hash,notice,created_at,party_id) VALUES('active','request','hash','Existing notice',99,'legacy-mossvale')").run();
  db.prepare("INSERT INTO game_damage(enemy_id,spawn_id,user_id,damage,damaged_at,party_id) VALUES('enemy','spawn','active',16,100,'legacy-mossvale')").run();
  db.prepare("INSERT INTO game_ledger(id,user_id,event_key,delta,balance_after,reason,created_at) VALUES('ledger','active','event',50,5000,'Old reward','2025-01-01')").run();
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT IN ('schema_migrations','sqlite_sequence') ORDER BY name").all().map(row => row.name);
  const before = Object.fromEntries(tables.map(name => [name, db.prepare('SELECT * FROM ' + name).all()]));
  assert.equal(migrateDatabase(db), SCHEMA_VERSION); assert.equal(migrateDatabase(db), SCHEMA_VERSION);
  for (const table of tables) assert.deepEqual(db.prepare('SELECT * FROM ' + table).all(), before[table], table);
  assert.deepEqual(db.prepare('SELECT user_id FROM game_party_memberships ORDER BY user_id').all().map(row => row.user_id), ['active', 'administrator']);
  db.prepare("UPDATE game_characters SET hp=350,ward_amount=250 WHERE user_id='active'").run();
  db.prepare("UPDATE game_characters SET hp=0 WHERE user_id='offline'").run();
  assert.equal(db.prepare("SELECT hp FROM game_characters WHERE user_id='active'").get().hp, 350);
  assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
  assert.equal(db.prepare('PRAGMA integrity_check').get().integrity_check, 'ok');
});
