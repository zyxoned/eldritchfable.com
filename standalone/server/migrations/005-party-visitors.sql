-- Isolated persistent party worlds. The legacy world remains an unchanged recovery record.
CREATE TABLE game_parties (
  id TEXT PRIMARY KEY,
  mode TEXT NOT NULL CHECK(mode IN ('open','solo')),
  owner_user_id TEXT REFERENCES account_users(id) ON DELETE SET NULL,
  revision INTEGER NOT NULL DEFAULT 0,
  enemies_json TEXT NOT NULL CHECK(json_valid(enemies_json)),
  messages_json TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(messages_json)),
  effects_json TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(effects_json)),
  created_at INTEGER NOT NULL
) STRICT;
INSERT INTO game_parties(id,mode,revision,enemies_json,messages_json,effects_json,created_at)
SELECT 'legacy-mossvale','open',revision,enemies_json,messages_json,effects_json,0 FROM game_world WHERE id=1;
ALTER TABLE game_characters ADD COLUMN party_id TEXT REFERENCES game_parties(id);
ALTER TABLE game_admin_characters ADD COLUMN party_id TEXT REFERENCES game_parties(id);
ALTER TABLE game_damage ADD COLUMN party_id TEXT REFERENCES game_parties(id);
ALTER TABLE game_requests ADD COLUMN party_id TEXT REFERENCES game_parties(id);
UPDATE game_characters SET party_id='legacy-mossvale';
UPDATE game_admin_characters SET party_id='legacy-mossvale';
UPDATE game_damage SET party_id='legacy-mossvale';
UPDATE game_requests SET party_id='legacy-mossvale';
CREATE INDEX idx_game_party_active ON game_characters(party_id,active_until);
CREATE INDEX idx_game_party_visitors ON game_admin_characters(party_id,active_until);
CREATE INDEX idx_game_party_damage ON game_damage(party_id,enemy_id,spawn_id);

-- Cosmetic selections are independent from class, combat stats and wallets.
ALTER TABLE game_characters ADD COLUMN appearance_json TEXT NOT NULL DEFAULT '{"skinTone":"warm","hairColor":"chestnut","hairStyle":"cropped","outfit":"class","accent":"gold","build":"balanced"}' CHECK(json_valid(appearance_json));
