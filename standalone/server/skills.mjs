import {
  SKILLS, MATERIALS, RESOURCE_NODES, skillProgress, skillLevel,
  MAX_SKILL_XP, MAX_MATERIAL_QUANTITY, MAX_GATHERED_COUNT, GATHER_COOLDOWN_MS, GATHER_RANGE,
} from '../shared/skill-catalog.mjs';

export class SkillsError extends Error {
  constructor(message, status = 400, code = 'INVALID_GATHERING_ACTION') {
    super(message);
    this.status = status;
    this.code = code;
  }
}

// The game owns authentication and the enclosing action/receipt transaction.
// Only server-loaded actors and server time may be passed to these mutations.
// The caller must reject actions during locked authored scenes before invocation.
export function createSkillsService(db, options = {}) {
  const now = options.now || Date.now;
  const maxHp = options.maxHp || (() => 100);
  const ErrorType = options.GameError || SkillsError;
  const fail = (message, status, code) => { throw new ErrorType(message, status, code); };
  const nodeById = new Map(RESOURCE_NODES.map(node => [node.id, node]));
  const materialById = new Map(MATERIALS.map(material => [material.id, material]));

  function profile(userId) {
    const skillRows = new Map(db.prepare('SELECT skill_id,xp,total_gathered FROM game_skills WHERE user_id=?').all(userId).map(row => [row.skill_id, row]));
    const materialRows = new Map(db.prepare('SELECT material_id,quantity FROM game_materials WHERE user_id=?').all(userId).map(row => [row.material_id, row.quantity]));
    const state = db.prepare('SELECT last_gather_at FROM game_gathering_state WHERE user_id=?').get(userId);
    return {
      skills: SKILLS.map(skill => skillProgress(skill.id, skillRows.get(skill.id)?.xp, skillRows.get(skill.id)?.total_gathered)),
      inventory: MATERIALS.map(material => ({ ...material, quantity: materialRows.get(material.id) || 0 })),
      cooldownUntil: state ? state.last_gather_at + GATHER_COOLDOWN_MS : 0,
      maxInventory: MAX_MATERIAL_QUANTITY,
      nonredeemable: true,
    };
  }

  function nodes(partyId, regionId) {
    if (!partyId) return [];
    const state = new Map(db.prepare('SELECT node_id,available_at FROM game_resource_nodes WHERE party_id=?').all(partyId).map(row => [row.node_id, row.available_at]));
    return RESOURCE_NODES.filter(node => node.regionId === regionId).map(node => ({ ...node, availableAt: state.get(node.id) || 0 }));
  }

  function activeActor(row, time) {
    if (row?.is_admin) fail('Support visitors cannot gain gathering skills or use supplies.', 403, 'ADMIN_GATHERING_DISABLED');
    if (!row || typeof row.user_id !== 'string') fail('Enter the realm before using wilderness skills.', 409, 'SEAT_EXPIRED');
    if (!Number.isSafeInteger(time) || time < 0) throw new Error('Wilderness skills require valid server time');
    const actor = db.prepare('SELECT c.* FROM game_characters c JOIN account_users u ON u.id=c.user_id '
      + 'WHERE c.user_id=? AND u.disabled_at IS NULL AND u.email_verified_at IS NOT NULL').get(row.user_id);
    if (!actor || actor.id !== row.id || actor.active_until <= time) fail('Enter the realm again before using wilderness skills.', 409, 'SEAT_EXPIRED');
    if (!actor.party_id || actor.party_id !== row.party_id) fail('Your party changed. Refresh before using wilderness skills.', 409, 'PARTY_CHANGED');
    if (actor.hp <= 0) fail('Recover before gathering or using supplies.', 409, 'GATHERING_RECOVERY_REQUIRED');
    return actor;
  }

  function requireCooldown(actor, time) {
    const state = db.prepare('SELECT last_gather_at FROM game_gathering_state WHERE user_id=?').get(actor.user_id);
    if (state && time < state.last_gather_at + GATHER_COOLDOWN_MS) fail('Take a moment before gathering or using another supply.', 429, 'GATHER_COOLDOWN');
  }

  function saveCooldown(actor, time) {
    db.prepare('INSERT INTO game_gathering_state(user_id,last_gather_at) VALUES(?,?) '
      + 'ON CONFLICT(user_id) DO UPDATE SET last_gather_at=excluded.last_gather_at').run(actor.user_id, time);
  }

  function gather({ row, nodeId, time = now() }) {
    const actor = activeActor(row, time);
    const node = nodeById.get(nodeId);
    if (!node) fail('Choose a marked gathering spot.', 400, 'UNKNOWN_RESOURCE');
    if (node.regionId !== actor.region_id) fail('Travel to that resource’s region before gathering.', 409, 'RESOURCE_WRONG_REGION');
    if (Math.hypot(actor.x - node.x, actor.y - node.y) > GATHER_RANGE) fail('Walk beside the gathering spot first.', 409, 'RESOURCE_TOO_FAR');
    const previous = db.prepare('SELECT xp,total_gathered FROM game_skills WHERE user_id=? AND skill_id=?').get(actor.user_id, node.skillId);
    const oldXp = previous?.xp || 0;
    const oldLevel = skillLevel(oldXp);
    if (oldLevel < node.requiredLevel) fail('Reach ' + SKILLS.find(skill => skill.id === node.skillId).name + ' level ' + node.requiredLevel + ' to work this spot.', 409, 'SKILL_LEVEL_REQUIRED');
    requireCooldown(actor, time);
    const resource = db.prepare('SELECT available_at FROM game_resource_nodes WHERE party_id=? AND node_id=?').get(actor.party_id, node.id);
    if (resource && time < resource.available_at) fail('This spot is regrowing. Try another nearby resource.', 409, 'RESOURCE_REGROWING');
    const oldQuantity = db.prepare('SELECT quantity FROM game_materials WHERE user_id=? AND material_id=?').get(actor.user_id, node.materialId)?.quantity || 0;
    const skillXp = Math.min(node.xp, MAX_SKILL_XP - oldXp);
    const quantity = oldQuantity < MAX_MATERIAL_QUANTITY ? 1 : 0;
    if (skillXp <= 0 && quantity === 0) fail('You have mastered this skill and filled this supply stack. Try another skill or resource.', 409, 'RESOURCE_STORAGE_FULL');
    const xp = oldXp + skillXp;
    const totalGathered = Math.min(MAX_GATHERED_COUNT, (previous?.total_gathered || 0) + 1);
    const availableAt = time + node.regrowMs;
    db.prepare('INSERT INTO game_skills(user_id,skill_id,xp,total_gathered) VALUES(?,?,?,?) '
      + 'ON CONFLICT(user_id,skill_id) DO UPDATE SET xp=excluded.xp,total_gathered=excluded.total_gathered')
      .run(actor.user_id, node.skillId, xp, totalGathered);
    if (quantity) db.prepare('INSERT INTO game_materials(user_id,material_id,quantity) VALUES(?,?,?) '
      + 'ON CONFLICT(user_id,material_id) DO UPDATE SET quantity=excluded.quantity')
      .run(actor.user_id, node.materialId, oldQuantity + quantity);
    saveCooldown(actor, time);
    db.prepare('INSERT INTO game_resource_nodes(party_id,node_id,available_at) VALUES(?,?,?) '
      + 'ON CONFLICT(party_id,node_id) DO UPDATE SET available_at=excluded.available_at').run(actor.party_id, node.id, availableAt);
    const progress = skillProgress(node.skillId, xp, totalGathered);
    const material = materialById.get(node.materialId);
    const reward = quantity ? 'Gathered ' + quantity + ' ' + material.name + '.' : material.name + ' stack full; you practiced your skill.';
    const notice = reward + (skillXp ? ' +' + skillXp + ' ' + progress.name + ' XP.' : '')
      + (progress.level > oldLevel ? ' ' + progress.name + ' reached level ' + progress.level + '!' : '');
    return { notice, nodeId: node.id, skillId: node.skillId, materialId: node.materialId, quantity, skillXp, level: progress.level, leveledUp: progress.level > oldLevel, availableAt };
  }

  function useSupply({ row, materialId, time = now() }) {
    const actor = activeActor(row, time);
    const material = materialById.get(materialId);
    if (!material?.healHp) fail('Choose an edible plant or fish from your supplies.', 400, 'SUPPLY_UNUSABLE');
    const owned = db.prepare('SELECT quantity FROM game_materials WHERE user_id=? AND material_id=?').get(actor.user_id, material.id);
    if (!owned || owned.quantity < 1) fail('Gather this supply before using it.', 409, 'SUPPLY_MISSING');
    const maximum = maxHp(actor);
    if (!Number.isSafeInteger(maximum) || maximum < 1 || maximum > 1000000) throw new Error('Invalid server-derived maximum health');
    if (actor.hp >= maximum) fail('Your health is already full. Save this supply for later.', 409, 'HEALTH_FULL');
    requireCooldown(actor, time);
    const healed = Math.min(material.healHp, maximum - actor.hp);
    const hp = actor.hp + healed;
    const spent = db.prepare('UPDATE game_materials SET quantity=quantity-1 WHERE user_id=? AND material_id=? AND quantity>0').run(actor.user_id, material.id);
    if (spent.changes !== 1) fail('Your supplies changed. Refresh before trying again.', 409, 'SUPPLY_MISSING');
    db.prepare('UPDATE game_characters SET hp=? WHERE user_id=?').run(hp, actor.user_id);
    saveCooldown(actor, time);
    return { notice: 'Used 1 ' + material.name + '. Restored ' + healed + ' HP.', materialId: material.id, quantity: 1, healed, hp, maxHp: maximum };
  }

  return { profile, nodes, gather, useSupply };
}
