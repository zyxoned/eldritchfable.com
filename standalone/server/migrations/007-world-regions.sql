-- Additive: existing positions, objectives, parties, contributions and wallets stay intact.
ALTER TABLE game_characters ADD COLUMN region_id TEXT NOT NULL DEFAULT 'glade' CHECK(region_id IN ('glade','amberReach','mistHarbor'));
ALTER TABLE game_admin_characters ADD COLUMN region_id TEXT NOT NULL DEFAULT 'glade' CHECK(region_id IN ('glade','amberReach','mistHarbor'));
CREATE INDEX idx_game_party_region ON game_characters(party_id,region_id,active_until);
ALTER TABLE game_characters ADD COLUMN battle_stance TEXT NOT NULL DEFAULT 'balanced' CHECK(battle_stance IN ('balanced','guarded','focused'));
ALTER TABLE game_characters ADD COLUMN tactic TEXT NOT NULL DEFAULT 'manual' CHECK(tactic IN ('manual','recovery-first','skill-opening'));
CREATE TABLE game_region_worlds (
  party_id TEXT NOT NULL REFERENCES game_parties(id) ON DELETE CASCADE,
  region_id TEXT NOT NULL CHECK(region_id IN ('amberReach','mistHarbor')),
  enemies_json TEXT NOT NULL CHECK(json_valid(enemies_json)),
  PRIMARY KEY(party_id,region_id)
) STRICT;
