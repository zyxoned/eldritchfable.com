-- Account-bound game state and XP ledger. Additive; existing accounts and mail remain intact.
CREATE TABLE IF NOT EXISTS game_characters (
  user_id TEXT PRIMARY KEY REFERENCES account_users(id) ON DELETE CASCADE,
  id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL COLLATE NOCASE UNIQUE CHECK(length(name) BETWEEN 2 AND 16),
  hero_class TEXT NOT NULL CHECK(hero_class IN ('ranger','knight','mage')),
  x INTEGER NOT NULL DEFAULT 10,
  y INTEGER NOT NULL DEFAULT 13,
  hp INTEGER NOT NULL DEFAULT 100 CHECK(hp BETWEEN 1 AND 100),
  kills INTEGER NOT NULL DEFAULT 0 CHECK(kills >= 0),
  gathered_json TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(gathered_json)),
  shrine INTEGER NOT NULL DEFAULT 0 CHECK(shrine IN (0,1)),
  claimed INTEGER NOT NULL DEFAULT 0 CHECK(claimed IN (0,1)),
  active_until INTEGER NOT NULL DEFAULT 0,
  last_move_at INTEGER NOT NULL DEFAULT 0,
  last_attack_at INTEGER NOT NULL DEFAULT 0,
  last_chat_at INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
) STRICT;
CREATE INDEX IF NOT EXISTS idx_game_active ON game_characters(active_until);

CREATE TABLE IF NOT EXISTS game_wallets (
  user_id TEXT PRIMARY KEY REFERENCES account_users(id) ON DELETE CASCADE,
  balance_xp INTEGER NOT NULL DEFAULT 0 CHECK(balance_xp >= 0),
  lifetime_xp INTEGER NOT NULL DEFAULT 0 CHECK(lifetime_xp >= balance_xp)
) STRICT;

CREATE TABLE IF NOT EXISTS game_ledger (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES account_users(id) ON DELETE CASCADE,
  event_key TEXT NOT NULL,
  delta INTEGER NOT NULL CHECK(delta != 0),
  balance_after INTEGER NOT NULL CHECK(balance_after >= 0),
  reason TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(user_id,event_key)
) STRICT;
CREATE INDEX IF NOT EXISTS idx_game_ledger_user ON game_ledger(user_id,created_at DESC,id);

CREATE TABLE IF NOT EXISTS game_requests (
  user_id TEXT NOT NULL REFERENCES account_users(id) ON DELETE CASCADE,
  request_id TEXT NOT NULL,
  payload_hash TEXT NOT NULL,
  notice TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY(user_id,request_id)
) STRICT;

CREATE TABLE IF NOT EXISTS game_damage (
  enemy_id TEXT NOT NULL,
  spawn_id TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES account_users(id) ON DELETE CASCADE,
  damage INTEGER NOT NULL CHECK(damage > 0),
  damaged_at INTEGER NOT NULL,
  PRIMARY KEY(enemy_id,spawn_id,user_id)
) STRICT;

CREATE TABLE IF NOT EXISTS game_world (
  id INTEGER PRIMARY KEY CHECK(id = 1),
  revision INTEGER NOT NULL DEFAULT 0,
  enemies_json TEXT NOT NULL CHECK(json_valid(enemies_json)),
  messages_json TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(messages_json))
) STRICT;

INSERT OR IGNORE INTO game_world(id,revision,enemies_json,messages_json)
VALUES(1,0,'[{"id":"bramble","x":17,"y":8,"hp":42,"respawnAt":0,"spawnId":"initial-bramble"},{"id":"thistle","x":21,"y":13,"hp":42,"respawnAt":0,"spawnId":"initial-thistle"},{"id":"briar","x":13,"y":5,"hp":42,"respawnAt":0,"spawnId":"initial-briar"},{"id":"sprig","x":26,"y":10,"hp":42,"respawnAt":0,"spawnId":"initial-sprig"}]','[]');
