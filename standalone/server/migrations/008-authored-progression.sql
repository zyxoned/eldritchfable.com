-- Generic durable progression. Authored content is loaded outside the checkout.
-- Widen only health/ward storage. Existing values and all other columns survive.
CREATE TABLE game_characters_v8 (
  user_id TEXT PRIMARY KEY REFERENCES account_users(id) ON DELETE CASCADE,
  id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL COLLATE NOCASE UNIQUE CHECK(length(name) BETWEEN 2 AND 16),
  hero_class TEXT NOT NULL CHECK(hero_class IN ('ranger','knight','mage','bard','cleric','wizard','sorcerer','monk')),
  x INTEGER NOT NULL DEFAULT 10, y INTEGER NOT NULL DEFAULT 13,
  hp INTEGER NOT NULL DEFAULT 100 CHECK(hp BETWEEN 0 AND 1000000),
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
  ward_amount INTEGER NOT NULL DEFAULT 0 CHECK(ward_amount BETWEEN 0 AND 1000000),
  party_id TEXT REFERENCES game_parties(id),
  appearance_json TEXT NOT NULL DEFAULT '{"skinTone":"warm","hairColor":"chestnut","hairStyle":"cropped","outfit":"class","accent":"gold","build":"balanced"}' CHECK(json_valid(appearance_json)),
  region_id TEXT NOT NULL DEFAULT 'glade' CHECK(region_id IN ('glade','amberReach','mistHarbor')),
  battle_stance TEXT NOT NULL DEFAULT 'balanced' CHECK(battle_stance IN ('balanced','guarded','focused')),
  tactic TEXT NOT NULL DEFAULT 'manual' CHECK(tactic IN ('manual','recovery-first','skill-opening'))
) STRICT;
INSERT INTO game_characters_v8 SELECT * FROM game_characters;
DROP TABLE game_characters;
ALTER TABLE game_characters_v8 RENAME TO game_characters;
CREATE INDEX idx_game_active ON game_characters(active_until);
CREATE INDEX idx_game_party_active ON game_characters(party_id,active_until);
CREATE INDEX idx_game_party_region ON game_characters(party_id,region_id,active_until);

CREATE TABLE game_party_memberships (
  party_id TEXT NOT NULL REFERENCES game_parties(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES account_users(id) ON DELETE CASCADE,
  joined_at INTEGER NOT NULL,
  left_at INTEGER,
  PRIMARY KEY(party_id,user_id)
) STRICT;
CREATE UNIQUE INDEX idx_game_one_party_membership ON game_party_memberships(user_id) WHERE left_at IS NULL;
-- Only unambiguously live legacy seats can establish an accepted membership.
INSERT INTO game_party_memberships(party_id,user_id,joined_at)
SELECT c.party_id,c.user_id,0 FROM game_characters c JOIN account_users u ON u.id=c.user_id
WHERE c.party_id IS NOT NULL AND c.active_until>unixepoch('now')*1000
AND u.disabled_at IS NULL AND u.email_verified_at IS NOT NULL;

CREATE TABLE game_source_acquisitions (
  user_id TEXT NOT NULL REFERENCES account_users(id) ON DELETE CASCADE,
  source_id TEXT NOT NULL, event_id TEXT NOT NULL, content_version TEXT NOT NULL,
  outcome TEXT NOT NULL CHECK(outcome IN ('effect','benefit','retained')),
  draw_value INTEGER, acquired_at INTEGER NOT NULL,
  PRIMARY KEY(user_id,source_id)
) STRICT;
CREATE TABLE game_combat_effects (
  user_id TEXT NOT NULL REFERENCES account_users(id) ON DELETE CASCADE,
  effect_key TEXT NOT NULL, definition_json TEXT NOT NULL CHECK(json_valid(definition_json)),
  acquired_at INTEGER NOT NULL, PRIMARY KEY(user_id,effect_key)
) STRICT;
CREATE TABLE game_benefit_entitlements (
  user_id TEXT NOT NULL REFERENCES account_users(id) ON DELETE CASCADE,
  benefit_key TEXT NOT NULL, source_id TEXT NOT NULL,
  acquired_at INTEGER NOT NULL, PRIMARY KEY(user_id,benefit_key)
) STRICT;
CREATE TABLE game_authored_victories (
  event_id TEXT NOT NULL, source_id TEXT NOT NULL,
  party_id TEXT NOT NULL REFERENCES game_parties(id),
  participants_json TEXT NOT NULL CHECK(json_valid(participants_json)),
  content_version TEXT NOT NULL, created_at INTEGER NOT NULL,
  PRIMARY KEY(event_id,source_id)
) STRICT;
CREATE TABLE game_authored_events (
  id TEXT PRIMARY KEY,
  encounter_key TEXT NOT NULL,
  party_id TEXT NOT NULL REFERENCES game_parties(id),
  party_revision INTEGER NOT NULL,
  content_version TEXT NOT NULL,
  definition_json TEXT NOT NULL CHECK(json_valid(definition_json)),
  source_proof_json TEXT NOT NULL CHECK(json_valid(source_proof_json)),
  phase TEXT NOT NULL CHECK(phase IN ('admission','combat','resolution','recovery','complete')),
  claim_kind TEXT CHECK(claim_kind IN ('initial','repeat')),
  enemy_hp INTEGER NOT NULL DEFAULT 0 CHECK(enemy_hp>=0),
  rounds INTEGER NOT NULL DEFAULT 0 CHECK(rounds>=0),
  outcome TEXT CHECK(outcome IN ('victory','defeat')),
  created_at INTEGER NOT NULL, combat_at INTEGER, resolved_at INTEGER,
  UNIQUE(party_id,encounter_key)
) STRICT;
CREATE TABLE game_authored_members (
  event_id TEXT NOT NULL REFERENCES game_authored_events(id),
  user_id TEXT NOT NULL REFERENCES account_users(id),
  hero_class TEXT NOT NULL,
  state TEXT NOT NULL CHECK(state IN ('pending','admitted','downed','resolved','recovered')),
  admitted_at INTEGER, last_action_at INTEGER NOT NULL DEFAULT 0,
  contributed INTEGER NOT NULL DEFAULT 0 CHECK(contributed IN (0,1)),
  recovered_at INTEGER,
  PRIMARY KEY(event_id,user_id)
) STRICT;
CREATE INDEX idx_game_authored_pending ON game_authored_members(user_id,state);
CREATE TABLE game_authored_claims (
  claim_key TEXT PRIMARY KEY,
  event_id TEXT NOT NULL UNIQUE REFERENCES game_authored_events(id),
  content_version TEXT NOT NULL, claimed_at INTEGER NOT NULL
) STRICT;
CREATE TABLE game_authored_witnesses (
  event_id TEXT NOT NULL REFERENCES game_authored_events(id),
  user_id TEXT NOT NULL REFERENCES account_users(id),
  scene_key TEXT NOT NULL, offered_at INTEGER NOT NULL, witnessed_at INTEGER,
  PRIMARY KEY(event_id,user_id,scene_key)
) STRICT;
CREATE TABLE game_owned_equipment (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES account_users(id),
  grant_key TEXT NOT NULL,
  hero_class TEXT NOT NULL,
  slot TEXT NOT NULL,
  definition_json TEXT NOT NULL CHECK(json_valid(definition_json)),
  equipped INTEGER NOT NULL DEFAULT 0 CHECK(equipped IN (0,1)),
  acquired_at INTEGER NOT NULL,
  UNIQUE(user_id,grant_key)
) STRICT;
CREATE UNIQUE INDEX idx_game_equipment_slot ON game_owned_equipment(user_id,slot) WHERE equipped=1;

CREATE TABLE game_skills (
  user_id TEXT NOT NULL REFERENCES account_users(id) ON DELETE CASCADE,
  skill_id TEXT NOT NULL CHECK(skill_id IN ('foraging','mining','fishing')),
  xp INTEGER NOT NULL DEFAULT 0 CHECK(xp BETWEEN 0 AND 7600),
  total_gathered INTEGER NOT NULL DEFAULT 0 CHECK(total_gathered BETWEEN 0 AND 1000000),
  PRIMARY KEY(user_id,skill_id)
) STRICT;
CREATE TABLE game_materials (
  user_id TEXT NOT NULL REFERENCES account_users(id) ON DELETE CASCADE,
  material_id TEXT NOT NULL, quantity INTEGER NOT NULL DEFAULT 0 CHECK(quantity BETWEEN 0 AND 999),
  PRIMARY KEY(user_id,material_id)
) STRICT;
CREATE TABLE game_gathering_state (
  user_id TEXT PRIMARY KEY REFERENCES account_users(id) ON DELETE CASCADE,
  last_gather_at INTEGER NOT NULL DEFAULT 0
) STRICT;
CREATE TABLE game_resource_nodes (
  party_id TEXT NOT NULL REFERENCES game_parties(id) ON DELETE CASCADE,
  node_id TEXT NOT NULL, available_at INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(party_id,node_id)
) STRICT;
CREATE TABLE game_route_discoveries (
  user_id TEXT NOT NULL REFERENCES account_users(id) ON DELETE CASCADE,
  route_id TEXT NOT NULL, discovered_at INTEGER NOT NULL,
  PRIMARY KEY(user_id,route_id)
) STRICT;
CREATE TABLE game_route_runs (
  id TEXT PRIMARY KEY,
  party_id TEXT NOT NULL REFERENCES game_parties(id) ON DELETE CASCADE,
  route_id TEXT NOT NULL, content_version TEXT NOT NULL,
  definition_json TEXT NOT NULL CHECK(json_valid(definition_json)),
  stage INTEGER NOT NULL DEFAULT 1 CHECK(stage BETWEEN 1 AND 1000),
  status TEXT NOT NULL DEFAULT 'running' CHECK(status IN ('running','complete')),
  created_at INTEGER NOT NULL, completed_at INTEGER
) STRICT;
CREATE UNIQUE INDEX idx_game_route_running ON game_route_runs(party_id,route_id) WHERE status='running';
CREATE TABLE game_route_stages (
  run_id TEXT NOT NULL REFERENCES game_route_runs(id) ON DELETE CASCADE,
  stage INTEGER NOT NULL CHECK(stage BETWEEN 1 AND 1000),
  enemy_hp INTEGER NOT NULL CHECK(enemy_hp BETWEEN 0 AND 1000000),
  status TEXT NOT NULL DEFAULT 'combat' CHECK(status IN ('combat','cleared')),
  cleared_at INTEGER,
  PRIMARY KEY(run_id,stage)
) STRICT;
CREATE TABLE game_route_members (
  run_id TEXT NOT NULL REFERENCES game_route_runs(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES account_users(id) ON DELETE CASCADE,
  visit_epoch INTEGER NOT NULL DEFAULT 0 CHECK(visit_epoch>=0),
  state TEXT NOT NULL CHECK(state IN ('active','downed','returned')),
  stage INTEGER NOT NULL DEFAULT 1 CHECK(stage BETWEEN 1 AND 1000),
  entered_at INTEGER NOT NULL,
  last_action_at INTEGER NOT NULL DEFAULT 0,
  rest_stage INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(run_id,user_id)
) STRICT;
CREATE UNIQUE INDEX idx_game_route_member_active ON game_route_members(user_id) WHERE state!='returned';
CREATE TABLE game_route_contributions (
  run_id TEXT NOT NULL, stage INTEGER NOT NULL,
  user_id TEXT NOT NULL REFERENCES account_users(id) ON DELETE CASCADE,
  damage INTEGER NOT NULL DEFAULT 0 CHECK(damage>=0),
  support INTEGER NOT NULL DEFAULT 0 CHECK(support>=0),
  contributed_at INTEGER NOT NULL,
  PRIMARY KEY(run_id,stage,user_id),
  FOREIGN KEY(run_id,stage) REFERENCES game_route_stages(run_id,stage) ON DELETE CASCADE
) STRICT;
-- These are immutable participation receipts, never wallet/XP awards.
CREATE TABLE game_route_completions (
  run_id TEXT NOT NULL, stage INTEGER NOT NULL,
  user_id TEXT NOT NULL REFERENCES account_users(id) ON DELETE CASCADE,
  completed_at INTEGER NOT NULL,
  PRIMARY KEY(run_id,stage,user_id),
  FOREIGN KEY(run_id,stage) REFERENCES game_route_stages(run_id,stage) ON DELETE CASCADE
) STRICT;
