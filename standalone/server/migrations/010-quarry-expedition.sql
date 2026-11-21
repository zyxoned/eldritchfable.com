-- Optional quarry expedition. Existing parties, characters, equipment and wallets
-- remain authoritative. Rows are created when an ordinary hero takes the road.
CREATE TABLE game_quarry_parties (
  party_id TEXT PRIMARY KEY REFERENCES game_parties(id) ON DELETE CASCADE,
  tune_json TEXT NOT NULL CHECK(json_valid(tune_json)),
  crawler_hp INTEGER NOT NULL DEFAULT 72 CHECK(crawler_hp BETWEEN 0 AND 72),
  windup_until INTEGER NOT NULL DEFAULT 0,
  next_windup INTEGER NOT NULL DEFAULT 0,
  progress INTEGER NOT NULL DEFAULT 0 CHECK(progress BETWEEN 0 AND 3),
  opened INTEGER NOT NULL DEFAULT 0 CHECK(opened IN (0,1)),
  primed INTEGER NOT NULL DEFAULT 0 CHECK(primed IN (0,1))
) STRICT;

CREATE TABLE game_quarry_heroes (
  user_id TEXT PRIMARY KEY REFERENCES game_characters(user_id) ON DELETE CASCADE,
  party_id TEXT NOT NULL REFERENCES game_quarry_parties(party_id) ON DELETE CASCADE,
  scene TEXT CHECK(scene IN ('market','gate','deep')),
  x INTEGER NOT NULL DEFAULT 1 CHECK(x BETWEEN 0 AND 12),
  y INTEGER NOT NULL DEFAULT 2 CHECK(y BETWEEN 0 AND 4),
  visit INTEGER NOT NULL DEFAULT 1,
  last_move INTEGER NOT NULL DEFAULT 0,
  last_strike INTEGER NOT NULL DEFAULT 0,
  scored INTEGER NOT NULL DEFAULT 0,
  listened INTEGER NOT NULL DEFAULT 0,
  contributed INTEGER NOT NULL DEFAULT 0,
  skill INTEGER NOT NULL DEFAULT 0,
  reward INTEGER NOT NULL DEFAULT 0,
  witnessed INTEGER NOT NULL DEFAULT 0,
  discovered INTEGER NOT NULL DEFAULT 0,
  completed INTEGER NOT NULL DEFAULT 0
) STRICT;
CREATE INDEX idx_game_quarry_scene ON game_quarry_heroes(party_id,scene);
