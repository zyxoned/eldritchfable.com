-- Expand regular callings without changing their identity, progress, or wallets.
CREATE TABLE game_characters_v4 (
  user_id TEXT PRIMARY KEY REFERENCES account_users(id) ON DELETE CASCADE,
  id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL COLLATE NOCASE UNIQUE CHECK(length(name) BETWEEN 2 AND 16),
  hero_class TEXT NOT NULL CHECK(hero_class IN ('ranger','knight','mage','bard','cleric','wizard','sorcerer','monk')),
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
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  skill_cooldowns_json TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(skill_cooldowns_json)),
  ward_until INTEGER NOT NULL DEFAULT 0,
  ward_amount INTEGER NOT NULL DEFAULT 0 CHECK(ward_amount BETWEEN 0 AND 100)
) STRICT;
INSERT INTO game_characters_v4(user_id,id,name,hero_class,x,y,hp,kills,gathered_json,shrine,claimed,active_until,last_move_at,last_attack_at,last_chat_at,created_at)
SELECT user_id,id,name,hero_class,x,y,hp,kills,gathered_json,shrine,claimed,active_until,last_move_at,last_attack_at,last_chat_at,created_at FROM game_characters;
DROP TABLE game_characters;
ALTER TABLE game_characters_v4 RENAME TO game_characters;
CREATE INDEX idx_game_active ON game_characters(active_until);

-- A separate persistent privileged avatar preserves each administrator's normal character.
CREATE TABLE game_admin_characters (
  user_id TEXT PRIMARY KEY REFERENCES account_users(id) ON DELETE CASCADE,
  id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL DEFAULT 'The Unnamed' CHECK(name='The Unnamed'),
  hero_class TEXT NOT NULL DEFAULT 'death-knight' CHECK(hero_class='death-knight'),
  session_hash TEXT NOT NULL CHECK(length(session_hash)=64),
  x INTEGER NOT NULL DEFAULT 10,
  y INTEGER NOT NULL DEFAULT 13,
  hp INTEGER NOT NULL DEFAULT 100 CHECK(hp=100),
  kills INTEGER NOT NULL DEFAULT 0 CHECK(kills=0),
  gathered_json TEXT NOT NULL DEFAULT '[]' CHECK(gathered_json='[]'),
  shrine INTEGER NOT NULL DEFAULT 0 CHECK(shrine=0),
  claimed INTEGER NOT NULL DEFAULT 0 CHECK(claimed=0),
  active_until INTEGER NOT NULL DEFAULT 0,
  last_move_at INTEGER NOT NULL DEFAULT 0,
  last_attack_at INTEGER NOT NULL DEFAULT 0,
  last_chat_at INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  skill_cooldowns_json TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(skill_cooldowns_json)),
  ward_until INTEGER NOT NULL DEFAULT 0 CHECK(ward_until=0),
  ward_amount INTEGER NOT NULL DEFAULT 0 CHECK(ward_amount=0)
) STRICT;
CREATE INDEX idx_game_admin_active ON game_admin_characters(active_until);
ALTER TABLE game_world ADD COLUMN effects_json TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(effects_json));

-- Privileged receipts always re-check current role before returning a replay.
ALTER TABLE game_requests ADD COLUMN actor_scope TEXT NOT NULL DEFAULT 'regular' CHECK(actor_scope IN ('regular','admin'));
