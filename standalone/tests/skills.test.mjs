import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDatabase, migrateDatabase, transaction } from '../server/database.mjs';
import { createSkillsService, SkillsError } from '../server/skills.mjs';
import {
  SKILLS, MATERIALS, RESOURCE_NODES, skillLevel, skillProgress, skillLevelThreshold,
  MAX_SKILL_LEVEL, MAX_SKILL_XP, MAX_MATERIAL_QUANTITY, MAX_GATHERED_COUNT, GATHER_COOLDOWN_MS,
} from '../shared/skill-catalog.mjs';
import { REGIONS, regionTile, regionWalkable } from '../shared/world-catalog.mjs';

function harness(t, path = ':memory:', options = {}) {
  let db = openDatabase(path); migrateDatabase(db);
  let time = 1000000;
  let service = createSkillsService(db, { ...options, now: () => time });
  t.after(() => db.close());
  function actor(id, partyId = 'legacy-mossvale') {
    db.prepare('INSERT INTO account_users(id,email,password_hash,email_verified_at) VALUES(?,?,?,?)').run(id, id + '@example.test', 'test-only-hash', '2026-01-01');
    db.prepare('INSERT INTO game_characters(user_id,id,name,hero_class,party_id,active_until) VALUES(?,?,?,?,?,?)').run(id, 'character-' + id, id, 'ranger', partyId, time + 100000000);
    db.prepare('INSERT INTO game_wallets(user_id,balance_xp,lifetime_xp,balance_copper) VALUES(?,?,?,?)').run(id, 37, 1300, 1000);
    return db.prepare('SELECT * FROM game_characters WHERE user_id=?').get(id);
  }
  return {
    get db() { return db; }, get service() { return service; }, get time() { return time; }, actor,
    advance(ms) { time += ms; },
    at(actor, node) { db.prepare('UPDATE game_characters SET region_id=?,x=?,y=? WHERE user_id=?').run(node.regionId, node.x, node.y, actor.user_id); },
    gather(actor, node, extra = {}) { return transaction(db, () => service.gather({ row: actor, nodeId: node.id, ...extra })); },
    use(actor, materialId, extra = {}) { return transaction(db, () => service.useSupply({ row: actor, materialId, ...extra })); },
    restart() { db.close(); db = openDatabase(path); service = createSkillsService(db, { ...options, now: () => time }); },
  };
}
const glade = RESOURCE_NODES.filter(node => node.regionId === 'glade');
const amber = RESOURCE_NODES.filter(node => node.regionId === 'amberReach');
function rejects(action, code, status) {
  assert.throws(action, error => error instanceof SkillsError && error.code === code && (status === undefined || error.status === status));
}
function saved(db) {
  return ['game_skills', 'game_materials', 'game_gathering_state', 'game_resource_nodes'].map(table => db.prepare('SELECT * FROM ' + table + ' ORDER BY rowid').all());
}

test('gathering catalogue provides reachable distinct skill areas in all three regions', () => {
  assert.equal(RESOURCE_NODES.length, 9);
  assert.equal(new Set(RESOURCE_NODES.map(node => node.id)).size, RESOURCE_NODES.length);
  assert.equal(new Set(MATERIALS.map(material => material.id)).size, MATERIALS.length);
  assert.equal(MATERIALS.filter(material => material.healHp).length, 6);
  assert.ok(MATERIALS.filter(material => material.skillId === 'mining').every(material => material.healHp === undefined));
  assert.ok(MATERIALS.filter(material => material.healHp).every(material => material.healHp >= 1 && material.healHp <= 24));
  for (const region of Object.values(REGIONS)) {
    const local = RESOURCE_NODES.filter(node => node.regionId === region.id);
    assert.deepEqual(local.map(node => node.skillId).sort(), SKILLS.map(skill => skill.id).sort());
    const seen = new Set(); const queue = [region.spawn];
    for (let index = 0; index < queue.length; index += 1) {
      const point = queue[index]; const key = point.x + ',' + point.y;
      if (seen.has(key) || !regionWalkable(region.id, point.x, point.y)) continue;
      seen.add(key);
      for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) queue.push({ x: point.x + dx, y: point.y + dy });
    }
    for (const node of local) {
      assert.ok(seen.has(node.x + ',' + node.y), node.id + ' is reachable');
      assert.ok(MATERIALS.some(material => material.id === node.materialId && material.skillId === node.skillId));
      assert.ok(node.requiredLevel >= 1 && node.requiredLevel <= MAX_SKILL_LEVEL);
      assert.ok(node.xp > 0 && node.regrowMs >= GATHER_COOLDOWN_MS);
      assert.ok(![region.spawn, region.shrine, ...region.crystals, ...region.enemies, ...region.exits].some(point => point.x === node.x && point.y === node.y));
      if (node.skillId === 'fishing') assert.ok([[0, 1], [0, -1], [1, 0], [-1, 0]].some(([dx, dy]) => regionTile(region.id, node.x + dx, node.y + dy) === 'water'));
    }
  }
});

test('bounded skill progress has clear early gates and exact level boundaries', () => {
  assert.equal(skillLevelThreshold(3), 120); assert.equal(skillLevelThreshold(5), 400);
  assert.equal(skillLevelThreshold(MAX_SKILL_LEVEL), MAX_SKILL_XP);
  for (let level = 2; level <= MAX_SKILL_LEVEL; level += 1) {
    assert.equal(skillLevel(skillLevelThreshold(level)), level);
    assert.equal(skillLevel(skillLevelThreshold(level) - 1), level - 1);
  }
  for (const bad of [-1, NaN, Infinity, '120', 12.5]) assert.equal(skillLevel(bad), 1);
  assert.equal(skillLevel(Number.MAX_SAFE_INTEGER), MAX_SKILL_LEVEL);
  assert.equal(skillProgress('unknown'), null);
  const progress = skillProgress('foraging', 55, 4);
  assert.equal(progress.xp, 55); assert.equal(progress.level, 2);
  assert.equal(progress.levelXp, 15); assert.equal(progress.nextLevelXp, 80);
  assert.equal(skillProgress('mining', MAX_SKILL_XP, Number.MAX_SAFE_INTEGER).totalGathered, MAX_GATHERED_COUNT);
  assert.equal(skillProgress('fishing', MAX_SKILL_XP).nextLevelXp, 0);
});

test('reading skill profiles and node availability never creates progress', t => {
  const h = harness(t); const actor = h.actor('Reader'); const before = saved(h.db);
  const profile = h.service.profile(actor.user_id);
  assert.equal(profile.nonredeemable, true); assert.equal(profile.maxInventory, MAX_MATERIAL_QUANTITY);
  assert.equal(profile.cooldownUntil, 0); assert.equal(profile.skills.length, 3);
  assert.ok(profile.skills.every(skill => skill.xp === 0 && skill.level === 1 && skill.totalGathered === 0));
  assert.ok(profile.inventory.every(material => material.quantity === 0));
  assert.equal(h.service.nodes(actor.party_id, 'glade').length, 3);
  assert.ok(h.service.nodes(actor.party_id, 'glade').every(node => node.availableAt === 0));
  assert.deepEqual(h.service.nodes(null, 'glade'), []);
  assert.deepEqual(h.service.nodes(actor.party_id, 'not-a-region'), []);
  assert.deepEqual(saved(h.db), before);
});

test('manual gathering persists separate skill and supplies without changing the economy', t => {
  const h = harness(t); const actor = h.actor('Gatherer'); const node = glade[0]; h.at(actor, node);
  const wallet = h.db.prepare('SELECT * FROM game_wallets').all();
  const ledger = h.db.prepare('SELECT * FROM game_ledger').all();
  const result = h.gather(actor, node);
  assert.equal(result.quantity, 1); assert.equal(result.skillXp, 12); assert.equal(result.leveledUp, false);
  assert.equal(result.availableAt, h.time + node.regrowMs);
  const own = h.service.profile(actor.user_id);
  assert.equal(own.skills.find(skill => skill.id === 'foraging').xp, 12);
  assert.equal(own.inventory.find(material => material.id === node.materialId).quantity, 1);
  assert.equal(own.cooldownUntil, h.time + GATHER_COOLDOWN_MS);
  assert.deepEqual(h.db.prepare('SELECT * FROM game_wallets').all(), wallet);
  assert.deepEqual(h.db.prepare('SELECT * FROM game_ledger').all(), ledger);
  assert.equal(h.db.prepare('SELECT gathered_json FROM game_characters WHERE user_id=?').get(actor.user_id).gathered_json, '[]');
  assert.ok(!JSON.stringify(h.service.nodes(actor.party_id, node.regionId)).includes('user_id'));
});

test('server position, region, node identity and skill level remain authoritative', t => {
  const h = harness(t); const actor = h.actor('Authority');
  rejects(() => h.gather({ ...actor, x: glade[0].x, y: glade[0].y }, glade[0]), 'RESOURCE_TOO_FAR');
  rejects(() => h.gather(actor, { id: 'invented' }), 'UNKNOWN_RESOURCE');
  rejects(() => h.gather(actor, amber[0]), 'RESOURCE_WRONG_REGION');
  h.at(actor, amber[0]);
  rejects(() => h.gather(actor, amber[0]), 'SKILL_LEVEL_REQUIRED');
  assert.ok(saved(h.db).every(rows => rows.length === 0));
  h.db.prepare('INSERT INTO game_skills(user_id,skill_id,xp) VALUES(?,?,?)').run(actor.user_id, 'foraging', 120);
  assert.equal(h.gather(actor, amber[0]).skillXp, 22);
});

test('one actor cooldown applies across skills while node regrowth is shared only within its party', t => {
  const h = harness(t); const first = h.actor('First'); const second = h.actor('Second');
  h.db.prepare('INSERT INTO game_parties(id,mode,owner_user_id,enemies_json,created_at) VALUES(?,?,?,?,?)').run('other-party', 'open', first.user_id, '[]', h.time);
  const other = h.actor('Other', 'other-party');
  h.at(first, glade[0]); h.at(second, glade[0]); h.at(other, glade[0]);
  h.gather(first, glade[0]);
  rejects(() => h.gather(second, glade[0]), 'RESOURCE_REGROWING');
  assert.equal(h.gather(other, glade[0]).quantity, 1);
  h.at(first, glade[1]); rejects(() => h.gather(first, glade[1]), 'GATHER_COOLDOWN', 429);
  h.advance(GATHER_COOLDOWN_MS - 1); rejects(() => h.gather(first, glade[1]), 'GATHER_COOLDOWN');
  h.advance(1); assert.equal(h.gather(first, glade[1]).quantity, 1);
  h.advance(glade[0].regrowMs - GATHER_COOLDOWN_MS - 1); rejects(() => h.gather(second, glade[0]), 'RESOURCE_REGROWING');
  h.advance(1); assert.equal(h.gather(second, glade[0]).quantity, 1);
  assert.equal(h.service.profile(second.user_id).inventory.find(material => material.id === glade[1].materialId).quantity, 0);
});

test('inactive, disabled, unverified and visitor actors cannot progress', t => {
  const h = harness(t); const actor = h.actor('Guarded'); const node = glade[0]; h.at(actor, node);
  rejects(() => h.gather({ ...actor, is_admin: true }, node), 'ADMIN_GATHERING_DISABLED', 403);
  rejects(() => h.gather({ ...actor, id: 'forged' }, node), 'SEAT_EXPIRED');
  rejects(() => h.gather({ ...actor, party_id: 'stale' }, node), 'PARTY_CHANGED');
  h.db.prepare('UPDATE game_characters SET hp=0 WHERE user_id=?').run(actor.user_id);
  rejects(() => h.gather(actor, node), 'GATHERING_RECOVERY_REQUIRED');
  h.db.prepare('UPDATE game_characters SET hp=100 WHERE user_id=?').run(actor.user_id);
  h.db.prepare('UPDATE account_users SET disabled_at=? WHERE id=?').run('2026-01-01', actor.user_id);
  rejects(() => h.gather(actor, node), 'SEAT_EXPIRED');
  h.db.prepare('UPDATE account_users SET disabled_at=NULL,email_verified_at=NULL WHERE id=?').run(actor.user_id);
  rejects(() => h.gather(actor, node), 'SEAT_EXPIRED');
  h.db.prepare('UPDATE account_users SET email_verified_at=? WHERE id=?').run('2026-01-01', actor.user_id);
  h.db.prepare('UPDATE game_characters SET active_until=? WHERE user_id=?').run(h.time, actor.user_id);
  rejects(() => h.gather(actor, node), 'SEAT_EXPIRED');
  assert.ok(saved(h.db).every(rows => rows.length === 0));
});

test('XP, inventory and gathered count saturate safely and full stacks still permit skill practice', t => {
  const h = harness(t); const actor = h.actor('Bounded'); const node = glade[0]; h.at(actor, node);
  h.db.prepare('INSERT INTO game_skills(user_id,skill_id,xp,total_gathered) VALUES(?,?,?,?)').run(actor.user_id, node.skillId, MAX_SKILL_XP - 5, MAX_GATHERED_COUNT);
  h.db.prepare('INSERT INTO game_materials(user_id,material_id,quantity) VALUES(?,?,?)').run(actor.user_id, node.materialId, MAX_MATERIAL_QUANTITY - 1);
  const capped = h.gather(actor, node);
  assert.equal(capped.skillXp, 5); assert.equal(capped.quantity, 1); assert.equal(capped.level, MAX_SKILL_LEVEL);
  assert.equal(h.service.profile(actor.user_id).skills[0].totalGathered, MAX_GATHERED_COUNT);
  h.advance(node.regrowMs); const before = saved(h.db);
  rejects(() => h.gather(actor, node), 'RESOURCE_STORAGE_FULL');
  assert.deepEqual(saved(h.db), before);
  h.db.prepare('UPDATE game_skills SET xp=0 WHERE user_id=? AND skill_id=?').run(actor.user_id, node.skillId);
  const practice = h.gather(actor, node);
  assert.equal(practice.quantity, 0); assert.equal(practice.skillXp, node.xp); assert.match(practice.notice, /stack full/);
  assert.equal(h.service.profile(actor.user_id).inventory[0].quantity, MAX_MATERIAL_QUANTITY);
});

test('early skill levels unlock faster regional supplies and more than 120 manual actions are allowed', t => {
  const h = harness(t); const actor = h.actor('Practice'); const node = glade[0]; h.at(actor, node);
  for (let attempt = 0; attempt < 125; attempt += 1) { h.gather(actor, node); h.advance(node.regrowMs); }
  const progress = h.service.profile(actor.user_id).skills[0];
  assert.equal(progress.xp, 1500); assert.equal(progress.totalGathered, 125); assert.ok(progress.level >= 5);
  h.at(actor, amber[0]); assert.equal(h.gather(actor, amber[0]).skillXp, 22);
});

test('skill progression, inventory and availability survive database reopen with no offline harvesting', t => {
  const dir = mkdtempSync(join(tmpdir(), 'eldritch-skills-')); t.after(() => rmSync(dir, { recursive: true, force: true }));
  const h = harness(t, join(dir, 'skills.db')); const actor = h.actor('Persistent'); const node = glade[0]; h.at(actor, node);
  h.gather(actor, node); const progress = h.service.profile(actor.user_id); const nodes = h.service.nodes(actor.party_id, node.regionId);
  h.restart(); assert.deepEqual(h.service.profile(actor.user_id), progress); assert.deepEqual(h.service.nodes(actor.party_id, node.regionId), nodes);
  rejects(() => h.gather(actor, node), 'GATHER_COOLDOWN');
  h.advance(24 * 60 * 60 * 1000);
  assert.deepEqual(h.service.profile(actor.user_id), progress);
  assert.deepEqual(h.service.nodes(actor.party_id, node.regionId), nodes);
});

test('a failed enclosing action rolls back all gathering writes', t => {
  const h = harness(t); const actor = h.actor('Rollback'); const node = glade[0]; h.at(actor, node);
  const before = saved(h.db);
  assert.throws(() => transaction(h.db, () => { h.service.gather({ row: actor, nodeId: node.id }); throw Error('receipt write failed'); }), /receipt write failed/);
  assert.deepEqual(saved(h.db), before);
  assert.equal(h.gather(actor, node).quantity, 1);
});

test('edible supplies provide fixed modest healing capped at current server-derived maximum', t => {
  let maximum = 150;
  const h = harness(t, ':memory:', { maxHp: row => { assert.equal(row.user_id, 'Healer'); return maximum; } });
  const actor = h.actor('Healer');
  h.db.prepare('UPDATE game_characters SET hp=140 WHERE user_id=?').run(actor.user_id);
  h.db.prepare('INSERT INTO game_materials(user_id,material_id,quantity) VALUES(?,?,?)').run(actor.user_id, 'dewleaf', 3);
  const wallet = h.db.prepare('SELECT * FROM game_wallets').all();
  const skills = h.db.prepare('SELECT * FROM game_skills').all();
  const healed = h.use({ ...actor, hp: 1 }, 'dewleaf', { healHp: 1000000, maxHp: 1000000 });
  assert.equal(healed.healed, 8); assert.equal(healed.hp, 148); assert.equal(healed.quantity, 1); assert.equal(healed.maxHp, 150);
  h.advance(GATHER_COOLDOWN_MS);
  const capped = h.use(actor, 'dewleaf'); assert.equal(capped.healed, 2); assert.equal(capped.hp, 150);
  assert.equal(h.service.profile(actor.user_id).inventory[0].quantity, 1);
  assert.deepEqual(h.db.prepare('SELECT * FROM game_wallets').all(), wallet);
  assert.deepEqual(h.db.prepare('SELECT * FROM game_skills').all(), skills);
  assert.equal(h.db.prepare('SELECT COUNT(*) AS n FROM game_ledger').get().n, 0);
  h.advance(GATHER_COOLDOWN_MS); maximum = 200;
  assert.equal(h.use(actor, 'dewleaf').hp, 158, 'maximum health is recalculated for each action, while healing stays fixed');
});

test('supply use and gathering share the same persistent manual-action cooldown', t => {
  const h = harness(t); const actor = h.actor('SupplyTiming'); h.at(actor, glade[0]);
  h.db.prepare('UPDATE game_characters SET hp=50 WHERE user_id=?').run(actor.user_id);
  h.gather(actor, glade[0]);
  rejects(() => h.use(actor, glade[0].materialId), 'GATHER_COOLDOWN');
  h.advance(GATHER_COOLDOWN_MS); assert.equal(h.use(actor, glade[0].materialId).healed, 8);
  h.at(actor, glade[1]); rejects(() => h.gather(actor, glade[1]), 'GATHER_COOLDOWN');
  h.advance(GATHER_COOLDOWN_MS); assert.equal(h.gather(actor, glade[1]).quantity, 1);
  assert.equal(h.service.profile(actor.user_id).inventory[0].quantity, 0);
});

test('supply errors never waste items at full health or bypass ownership, material or actor checks', t => {
  const h = harness(t); const actor = h.actor('SupplyGuard');
  h.db.prepare('INSERT INTO game_materials(user_id,material_id,quantity) VALUES(?,?,?)').run(actor.user_id, 'dewleaf', 2);
  const before = saved(h.db);
  rejects(() => h.use(actor, 'dewleaf'), 'HEALTH_FULL');
  rejects(() => h.use(actor, 'invented'), 'SUPPLY_UNUSABLE');
  rejects(() => h.use(actor, 'brookstone'), 'SUPPLY_UNUSABLE');
  rejects(() => h.use(actor, 'brook-trout'), 'SUPPLY_MISSING');
  rejects(() => h.use({ ...actor, is_admin: true }, 'dewleaf'), 'ADMIN_GATHERING_DISABLED');
  h.db.prepare('UPDATE game_characters SET hp=0 WHERE user_id=?').run(actor.user_id);
  rejects(() => h.use(actor, 'dewleaf'), 'GATHERING_RECOVERY_REQUIRED');
  h.db.prepare('UPDATE game_characters SET hp=50,active_until=? WHERE user_id=?').run(h.time, actor.user_id);
  rejects(() => h.use(actor, 'dewleaf'), 'SEAT_EXPIRED');
  assert.deepEqual(saved(h.db), before);
});

test('one supply never grants a full recovery, and failed receipts roll back healing and consumption', t => {
  const h = harness(t); const actor = h.actor('SupplyRollback');
  h.db.prepare('UPDATE game_characters SET hp=1 WHERE user_id=?').run(actor.user_id);
  h.db.prepare('INSERT INTO game_materials(user_id,material_id,quantity) VALUES(?,?,?)').run(actor.user_id, 'silver-mackerel', 2);
  const before = saved(h.db);
  assert.throws(() => transaction(h.db, () => { h.service.useSupply({ row: actor, materialId: 'silver-mackerel' }); throw Error('receipt write failed'); }), /receipt write failed/);
  assert.deepEqual(saved(h.db), before);
  assert.equal(h.db.prepare('SELECT hp FROM game_characters WHERE user_id=?').get(actor.user_id).hp, 1);
  assert.equal(h.use(actor, 'silver-mackerel').hp, 25);
});
