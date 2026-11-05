import { randomInt, randomUUID } from 'node:crypto';
import { readFileSync, realpathSync, statSync } from 'node:fs';
import { dirname, relative, resolve, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { transaction } from './database.mjs';
import { aggregateCombatStats, validateCombatEffect } from './combat-effects.mjs';
import { CLASS_CATALOG, PLAYER_CLASS_IDS } from '../shared/class-catalog.mjs';
import { incomingDamage, outgoingDamage } from '../shared/character-development.mjs';
import { REGIONS, regionWalkable } from '../shared/world-catalog.mjs';

const MAX_MEMBERS = 8;
const id = value => typeof value === 'string' && /^[a-zA-Z0-9:_-]{1,160}$/.test(value);
const integer = (value, min, max) => Number.isSafeInteger(value) && value >= min && value <= max;
const copy = value => JSON.parse(JSON.stringify(value));
const atomic = (db, action) => db.isTransaction ? action() : transaction(db, action);
export class AuthoredError extends Error {
  constructor(code = 'AUTHORED_UNAVAILABLE', status = 409) {
    super('This action is not available right now. Refresh your adventure and try again.');
    this.code = code; this.status = status;
  }
}
function need(condition, code) { if (!condition) throw new AuthoredError(code); }
function validScene(scene) {
  return scene && typeof scene.title === 'string' && scene.title.length <= 160
    && typeof scene.text === 'string' && scene.text.length <= 12000;
}
function validateCombat(combat) {
  if (!combat || !integer(combat.hp, 1, 100000000) || !integer(combat.damage, 0, 1000000)
    || !integer(combat.attackCooldownMs, 100, 60000)) throw Error('Invalid authored combat');
  if (combat.resolveAfterActions !== undefined && !integer(combat.resolveAfterActions, 1, 100)) throw Error('Invalid authored resolution');
  if (combat.outcome !== undefined && !['victory', 'defeat'].includes(combat.outcome)) throw Error('Invalid authored outcome');
}
export function validateAuthoredContent(input) {
  const content = copy(input);
  if (!content || !id(content.version) || !Array.isArray(content.sources) || !Array.isArray(content.encounters)
    || content.sources.length > 200 || content.encounters.length > 100) throw Error('Invalid authored content');
  const sourceIds = new Set(); const encounterIds = new Set();
  for (const source of content.sources) {
    if (!id(source.id) || sourceIds.has(source.id) || !Array.isArray(source.effects) || source.effects.length > 100) throw Error('Invalid authored source');
    sourceIds.add(source.id); source.effects.forEach(validateCombatEffect);
    if (source.trigger && (!id(source.trigger.regionId) || !id(source.trigger.enemyId))) throw Error('Invalid source trigger');
    if (source.draw) {
      const draw = source.draw;
      if (!id(draw.benefitKey) || !integer(draw.denominator, 1, 281474976710655)
        || !integer(draw.winners, 1, draw.denominator)) throw Error('Invalid authored draw');
      validateCombatEffect(draw.effect);
    }
  }
  for (const encounter of content.encounters) {
    if (!id(encounter.id) || encounterIds.has(encounter.id) || !id(encounter.claimKey)
      || !Array.isArray(encounter.requiresSources) || !encounter.requiresSources.length
      || new Set(encounter.requiresSources).size !== encounter.requiresSources.length
      || encounter.requiresSources.some(source => !sourceIds.has(source))) throw Error('Invalid authored encounter');
    encounterIds.add(encounter.id); validateCombat(encounter.combat);
    if (encounter.initialCombat) validateCombat(encounter.initialCombat);
    if (!['arrival', 'victory', 'defeat'].every(key => validScene(encounter.scenes?.[key]))) throw Error('Invalid authored scenes');
    const recovery = encounter.recovery;
    if (!recovery || !id(recovery.regionId) || !REGIONS[recovery.regionId]
      || !regionWalkable(recovery.regionId, recovery.x, recovery.y)) throw Error('Invalid authored recovery');
    if (encounter.grant) {
      const grant = encounter.grant;
      if (!id(grant.key) || !['initial-defeat', 'initial-victory', 'victory', 'defeat'].includes(grant.when)
        || !grant.itemsByClass || typeof grant.itemsByClass !== 'object') throw Error('Invalid authored grant');
      for (const heroClass of PLAYER_CLASS_IDS) {
        const item = grant.itemsByClass[heroClass];
        if (!item || !id(item.id) || !id(item.slot) || typeof item.name !== 'string' || item.name.length > 120) throw Error('Invalid class equipment');
        validateCombatEffect(item.effect);
      }
    }
  }
  return content;
}
export function loadAuthoredContent(path) {
  if (!path) return null;
  const actual = realpathSync(path);
  const checkout = realpathSync(resolve(dirname(fileURLToPath(import.meta.url)), '../..'));
  const rel = relative(checkout, actual);
  if (!rel || (!rel.startsWith('..' + '/') && !isAbsolute(rel))) throw Error('Authored content must be outside the source checkout');
  const stats = statSync(actual);
  if (!stats.isFile() || stats.size > 2 * 1024 * 1024 || (stats.mode & 0o077)) throw Error('Authored content requires a private regular file');
  try { return validateAuthoredContent(JSON.parse(readFileSync(actual, 'utf8'))); }
  catch { throw Error('Authored content failed validation'); }
}

export function createAuthoredEngine(db, options = {}) {
  const now = options.now || Date.now;
  const content = options.content ? validateAuthoredContent(options.content) : loadAuthoredContent(options.contentPath);
  const draw = options.randomInt || randomInt;
  function sample(max) {
    const result = draw(max);
    if (!integer(result, 0, max - 1)) throw Error('Invalid random sample');
    return result;
  }
  function hero(userId, time, active = true) {
    const row = db.prepare("SELECT c.*,COALESCE(w.lifetime_xp,0) AS lifetime_xp FROM game_characters c JOIN account_users u ON u.id=c.user_id LEFT JOIN game_wallets w ON w.user_id=c.user_id WHERE c.user_id=? AND u.disabled_at IS NULL AND u.email_verified_at IS NOT NULL")
      .get(userId);
    if (!row || (active && row.active_until <= time)) return null;
    if (db.prepare('SELECT 1 FROM game_admin_characters WHERE user_id=? AND active_until>?').get(userId, time)) return null;
    return row;
  }
  function memberRows(partyId, time) {
    return db.prepare("SELECT c.* FROM game_party_memberships m JOIN game_characters c ON c.user_id=m.user_id JOIN account_users u ON u.id=m.user_id WHERE m.party_id=? AND m.left_at IS NULL AND c.party_id=m.party_id AND u.disabled_at IS NULL AND u.email_verified_at IS NOT NULL ORDER BY m.joined_at,c.id")
      .all(partyId).filter(row => !db.prepare('SELECT 1 FROM game_admin_characters WHERE user_id=? AND active_until>?').get(row.user_id, time));
  }
  function memberCount(partyId) {
    return db.prepare('SELECT COUNT(*) AS n FROM game_party_memberships m JOIN game_characters c ON c.user_id=m.user_id JOIN account_users u ON u.id=m.user_id WHERE m.party_id=? AND m.left_at IS NULL AND c.party_id=m.party_id AND u.disabled_at IS NULL AND u.email_verified_at IS NOT NULL').get(partyId).n;
  }
  function membership(userId) {
    return db.prepare('SELECT party_id AS partyId FROM game_party_memberships WHERE user_id=? AND left_at IS NULL').get(userId)?.partyId || null;
  }
  function activeEvent(userId) {
    return db.prepare("SELECT e.*,m.state AS member_state,m.hero_class AS admitted_class,m.admitted_at,m.last_action_at,m.contributed FROM game_authored_events e JOIN game_authored_members m ON m.event_id=e.id WHERE m.user_id=? AND m.state!='recovered' ORDER BY e.created_at,e.id LIMIT 1").get(userId);
  }
  function isLocked(userId) { return Boolean(activeEvent(userId)); }
  function joined(userId, partyId, time = now()) {
    return atomic(db, () => {
      const row = db.prepare('SELECT c.* FROM game_characters c JOIN account_users u ON u.id=c.user_id WHERE c.user_id=? AND u.disabled_at IS NULL AND u.email_verified_at IS NOT NULL').get(userId);
      if (!row) return false;
      const event = activeEvent(userId);
      need(!event || event.party_id === partyId, 'AUTHORED_PENDING');
      const existing = db.prepare('SELECT 1 FROM game_party_memberships WHERE user_id=? AND party_id=? AND left_at IS NULL').get(userId, partyId);
      need(memberCount(partyId) - (existing ? 1 : 0) < MAX_MEMBERS, 'PARTY_FULL');
      db.prepare('UPDATE game_party_memberships SET left_at=? WHERE user_id=? AND left_at IS NULL AND party_id!=?').run(time, userId, partyId);
      db.prepare('INSERT INTO game_party_memberships(party_id,user_id,joined_at) VALUES(?,?,?) ON CONFLICT(party_id,user_id) DO UPDATE SET joined_at=CASE WHEN left_at IS NULL THEN joined_at ELSE excluded.joined_at END,left_at=NULL').run(partyId, userId, time);
      evaluateParty(partyId, time);
      return true;
    });
  }
  function left(userId, partyId, time = now()) {
    return atomic(db, () => {
      need(!isLocked(userId), 'AUTHORED_PENDING');
      db.prepare('UPDATE game_party_memberships SET left_at=? WHERE user_id=? AND party_id=? AND left_at IS NULL').run(time, userId, partyId);
    });
  }
  function combat(userId, baseStats) {
    const effects = db.prepare('SELECT definition_json FROM game_combat_effects WHERE user_id=? ORDER BY effect_key').all(userId).map(row => JSON.parse(row.definition_json));
    const row = db.prepare('SELECT hero_class FROM game_characters WHERE user_id=?').get(userId);
    for (const item of db.prepare('SELECT definition_json FROM game_owned_equipment WHERE user_id=? AND hero_class=? AND equipped=1 ORDER BY slot,id').all(userId, row?.hero_class || '')) effects.push(JSON.parse(item.definition_json).effect);
    return aggregateCombatStats(baseStats, effects);
  }
  function normalizeHealth(userId) {
    const maximum = combat(userId, { maxHp: 100 });
    db.prepare('UPDATE game_characters SET hp=MIN(hp,?),ward_amount=MIN(ward_amount,?) WHERE user_id=?').run(maximum.maxHp, 1000000, userId);
    return maximum.maxHp;
  }
  function acquire(source, row, eventId, time) {
    if (db.prepare('SELECT 1 FROM game_source_acquisitions WHERE user_id=? AND source_id=?').get(row.user_id, source.id)) return false;
    let result = null; let outcome = 'retained'; let value = null;
    const eligible = source.draw && !db.prepare('SELECT 1 FROM game_benefit_entitlements WHERE user_id=? AND benefit_key=?').get(row.user_id, source.draw.benefitKey);
    if (eligible) {
      value = sample(source.draw.denominator);
      if (value < source.draw.winners) {
        result = source.draw.effect; outcome = 'benefit';
        db.prepare('INSERT INTO game_benefit_entitlements(user_id,benefit_key,source_id,acquired_at) VALUES(?,?,?,?)').run(row.user_id, source.draw.benefitKey, source.id, time);
      }
    }
    if (!result && source.effects.length) { result = source.effects[sample(source.effects.length)]; outcome = 'effect'; }
    db.prepare('INSERT INTO game_source_acquisitions(user_id,source_id,event_id,content_version,outcome,draw_value,acquired_at) VALUES(?,?,?,?,?,?,?)').run(row.user_id, source.id, eventId, content.version, outcome, value, time);
    if (result) db.prepare('INSERT INTO game_combat_effects(user_id,effect_key,definition_json,acquired_at) VALUES(?,?,?,?)').run(row.user_id, outcome === 'benefit' ? 'benefit:' + source.draw.benefitKey : 'source:' + source.id, JSON.stringify(result), time);
    normalizeHealth(row.user_id);
    return true;
  }
  function recordVictory({ sourceId, eventId, partyId, participants, regionId, time = now() }) {
    return atomic(db, () => {
      const source = content?.sources.find(value => value.id === sourceId);
      if (!source) return [];
      need(id(eventId) && typeof partyId === 'string' && Array.isArray(participants), 'AUTHORED_UNAVAILABLE');
      const previous = db.prepare('SELECT * FROM game_authored_victories WHERE event_id=? AND source_id=?').get(eventId, sourceId);
      if (previous) { need(previous.party_id === partyId); return JSON.parse(previous.participants_json); }
      const rows = [...new Set(participants)].map(userId => hero(userId, time)).filter(row => row && row.party_id === partyId && (!regionId || row.region_id === regionId));
      if (!rows.length) return [];
      need(rows.length <= MAX_MEMBERS);
      const accepted = rows.map(row => row.user_id).sort();
      db.prepare('INSERT INTO game_authored_victories(event_id,source_id,party_id,participants_json,content_version,created_at) VALUES(?,?,?,?,?,?)').run(eventId, sourceId, partyId, JSON.stringify(accepted), content.version, time);
      for (const row of rows) acquire(source, row, eventId, time);
      evaluateParty(partyId, time);
      return accepted;
    });
  }
  function onVictory({ partyId, regionId, enemyId, spawnId, participants, time = now() }) {
    return atomic(db, () => {
      for (const source of content?.sources || []) if (source.trigger?.regionId === regionId && source.trigger.enemyId === enemyId) {
        recordVictory({ sourceId: source.id, eventId: spawnId, partyId, regionId, participants, time });
      }
    });
  }
  function evaluateParty(partyId, time = now()) {
    return atomic(db, () => {
      if (!content) return null;
      const party = db.prepare('SELECT revision FROM game_parties WHERE id=?').get(partyId);
      if (!party) return null;
      const rows = memberRows(partyId, time);
      if (!rows.length || rows.length > MAX_MEMBERS || rows.some(row => isLocked(row.user_id))) return null;
      for (const encounter of content.encounters) {
        if (db.prepare('SELECT 1 FROM game_authored_events WHERE party_id=? AND encounter_key=?').get(partyId, encounter.id)) continue;
        const proof = [];
        for (const sourceId of encounter.requiresSources) {
          const owner = rows.find(row => db.prepare('SELECT 1 FROM game_source_acquisitions WHERE user_id=? AND source_id=?').get(row.user_id, sourceId));
          if (owner) proof.push({ sourceId, userId: owner.user_id });
        }
        if (proof.length !== encounter.requiresSources.length) continue;
        const eventId = randomUUID();
        db.prepare("INSERT INTO game_authored_events(id,encounter_key,party_id,party_revision,content_version,definition_json,source_proof_json,phase,created_at) VALUES(?,?,?,?,?,?,?,'admission',?)")
          .run(eventId, encounter.id, partyId, party.revision, content.version, JSON.stringify(encounter), JSON.stringify(proof), time);
        for (const row of rows) db.prepare("INSERT INTO game_authored_members(event_id,user_id,hero_class,state) VALUES(?,?,?,'pending')").run(eventId, row.user_id, row.hero_class);
        return eventId;
      }
      return null;
    });
  }
  function resume(userId, time = now()) {
    return atomic(db, () => {
      const row = hero(userId, time); const event = activeEvent(userId);
      if (!row || !event) return false;
      need(row.party_id === event.party_id, 'AUTHORED_PENDING');
      if (event.member_state === 'pending') {
        db.prepare("UPDATE game_authored_members SET state=?,admitted_at=? WHERE event_id=? AND user_id=? AND state='pending'")
          .run(['resolution', 'recovery', 'complete'].includes(event.phase) ? 'resolved' : 'admitted', time, event.id, userId);
      }
      normalizeHealth(userId);
      db.prepare('INSERT OR IGNORE INTO game_authored_witnesses(event_id,user_id,scene_key,offered_at) VALUES(?,?,?,?)').run(event.id, userId, sceneKey(event), time);
      return true;
    });
  }
  function sceneKey(event) { return ['resolution', 'recovery', 'complete'].includes(event.phase) ? event.outcome : 'arrival'; }
  function projection(userId, time = now()) {
    const row = hero(userId, time, false);
    if (!row) return null;
    const equipment = db.prepare('SELECT * FROM game_owned_equipment WHERE user_id=? ORDER BY acquired_at,id').all(userId).map(item => ({
      id: item.id, name: JSON.parse(item.definition_json).name, heroClass: item.hero_class, slot: item.slot, equipped: Boolean(item.equipped), tradable: false,
    }));
    const effects = db.prepare('SELECT definition_json FROM game_combat_effects WHERE user_id=? ORDER BY acquired_at,effect_key').all(userId).map(effect => ({ name: JSON.parse(effect.definition_json).name }));
    const event = activeEvent(userId);
    let encounter = null;
    if (event && event.member_state !== 'pending' && row.active_until > time && row.party_id === event.party_id) {
      const definition = JSON.parse(event.definition_json); const key = sceneKey(event); const scene = definition.scenes[key];
      // Projection is read-only; only explicit acknowledgement records a witness.
      const witnessed = Boolean(db.prepare('SELECT witnessed_at FROM game_authored_witnesses WHERE event_id=? AND user_id=? AND scene_key=?').get(event.id, userId, key)?.witnessed_at);
      encounter = {
        id: event.id, phase: event.phase, state: event.member_state, sceneKey: key,
        title: scene.title, text: scene.text, witnessed,
        hp: row.hp, maxHp: combat(userId, { maxHp: 100 }).maxHp,
        ...(event.phase === 'combat' ? { enemyHp: event.enemy_hp, enemyMaxHp: (event.claim_kind === 'initial' && definition.initialCombat ? definition.initialCombat : definition.combat).hp } : {}),
        canAttack: ['admission', 'combat'].includes(event.phase) && event.member_state === 'admitted' && row.hp > 0,
        attackReadyAt: Math.max(event.last_action_at, row.last_attack_at) + Math.max(100, combat(userId, { cooldownMs: (event.claim_kind === 'initial' && definition.initialCombat ? definition.initialCombat : definition.combat).attackCooldownMs }).cooldownMs),
        canContinue: ['resolution', 'recovery'].includes(event.phase),
        canRecover: event.phase === 'combat' && event.member_state === 'downed',
        skills: CLASS_CATALOG[row.hero_class].skills.filter(skill => skill.type !== 'passive').map(skill => ({ id: skill.id, name: skill.name, readyAt: JSON.parse(row.skill_cooldowns_json)[skill.id] || 0 })),
      };
    }
    if (!encounter && !equipment.length && !effects.length) return null;
    return { equipment, effects, encounter };
  }
  function finish(event, outcome, time) {
    db.prepare("UPDATE game_authored_events SET phase='resolution',outcome=?,resolved_at=? WHERE id=? AND phase='combat'").run(outcome, time, event.id);
    db.prepare("UPDATE game_authored_members SET state='resolved' WHERE event_id=? AND state IN ('admitted','downed')").run(event.id);
  }
  function startCombat(event, time) {
    if (event.phase !== 'admission') return event;
    const definition = JSON.parse(event.definition_json);
    const inserted = db.prepare('INSERT OR IGNORE INTO game_authored_claims(claim_key,event_id,content_version,claimed_at) VALUES(?,?,?,?)').run(definition.claimKey, event.id, event.content_version, time);
    const kind = inserted.changes ? 'initial' : 'repeat';
    const combatDefinition = kind === 'initial' && definition.initialCombat ? definition.initialCombat : definition.combat;
    db.prepare("UPDATE game_authored_events SET phase='combat',claim_kind=?,enemy_hp=?,combat_at=? WHERE id=? AND phase='admission'").run(kind, combatDefinition.hp, time, event.id);
    return { ...event, phase: 'combat', claim_kind: kind, enemy_hp: combatDefinition.hp };
  }
  function acknowledge(event, userId, key, time) {
    need(key === sceneKey(event));
    const offered = db.prepare('SELECT offered_at FROM game_authored_witnesses WHERE event_id=? AND user_id=? AND scene_key=?').get(event.id, userId, key);
    need(offered && offered.offered_at <= time);
    db.prepare('UPDATE game_authored_witnesses SET witnessed_at=COALESCE(witnessed_at,?) WHERE event_id=? AND user_id=? AND scene_key=?').run(time, event.id, userId, key);
  }
  function grant(event, userId, time) {
    const definition = JSON.parse(event.definition_json); const reward = definition.grant;
    if (!reward || !(reward.when === event.outcome || reward.when === event.claim_kind + '-' + event.outcome)) return;
    const item = reward.itemsByClass[event.admitted_class];
    need(item);
    db.prepare('INSERT OR IGNORE INTO game_owned_equipment(id,user_id,grant_key,hero_class,slot,definition_json,acquired_at) VALUES(?,?,?,?,?,?,?)')
      .run(randomUUID(), userId, reward.key, event.admitted_class, item.slot, JSON.stringify(item), time);
  }
  function act(userId, input, time = now()) {
    return atomic(db, () => {
      let row = hero(userId, time); need(row, 'AUTHORED_UNAVAILABLE');
      if (input.kind === 'equip') {
        need(!isLocked(userId), 'AUTHORED_PENDING');
        const item = db.prepare('SELECT * FROM game_owned_equipment WHERE id=? AND user_id=?').get(input.itemId, userId);
        need(item && item.hero_class === row.hero_class, 'EQUIPMENT_UNAVAILABLE');
        db.prepare('UPDATE game_owned_equipment SET equipped=0 WHERE user_id=? AND slot=?').run(userId, item.slot);
        db.prepare('UPDATE game_owned_equipment SET equipped=1 WHERE id=?').run(item.id); normalizeHealth(userId);
        return 'Equipment saved.';
      }
      resume(userId, time);
      row = hero(userId, time);
      let event = activeEvent(userId);
      need(event && input.eventId === event.id && row.party_id === event.party_id && event.member_state !== 'pending');
      if (input.kind === 'encounterWitness') {
        acknowledge(event, userId, input.sceneKey, time);
        return 'Your experience was remembered.';
      }
      if (input.kind === 'encounterReturn') {
        need(event.phase === 'combat' && event.member_state === 'downed');
        const definition = JSON.parse(event.definition_json);
        if (event.claim_kind === 'initial' && definition.initialCombat?.resolveAfterActions && definition.initialCombat.outcome === 'defeat') {
          // Recovery cannot silently forfeit a frozen authored entitlement.
          finish(event, 'defeat', time);
          return 'The encounter has ended. Continue when you are ready.';
        }
        const recovery = definition.recovery;
        db.prepare('UPDATE game_characters SET region_id=?,x=?,y=?,hp=? WHERE user_id=?').run(recovery.regionId, recovery.x, recovery.y, combat(userId, { maxHp: 100 }).maxHp, userId);
        db.prepare("UPDATE game_authored_members SET state='recovered',recovered_at=? WHERE event_id=? AND user_id=?").run(time, event.id, userId);
        if (!db.prepare("SELECT 1 FROM game_authored_members WHERE event_id=? AND state!='recovered'").get(event.id)) {
          db.prepare("UPDATE game_authored_events SET phase='complete',outcome='defeat',resolved_at=? WHERE id=?").run(time, event.id);
        }
        return 'You returned safely. Your companions can continue their encounter.';
      }
      if (['encounterAttack', 'encounterSkill'].includes(input.kind)) {
        need(['admission', 'combat'].includes(event.phase) && event.member_state === 'admitted' && row.hp > 0);
        const definition = JSON.parse(event.definition_json);
        const skill = input.kind === 'encounterSkill' ? CLASS_CATALOG[row.hero_class].skills.find(value => value.id === input.skillId && value.type !== 'passive') : null;
        if (input.kind === 'encounterSkill') need(skill, 'SKILL_UNAVAILABLE');
        const cooldowns = JSON.parse(row.skill_cooldowns_json);
        if (skill) need((cooldowns[skill.id] || 0) <= time, 'SKILL_COOLDOWN');
        if (skill && ['heal', 'ward'].includes(skill.type)) {
          if (skill.type === 'heal') {
            const targets = skill.target === 'party'
              ? db.prepare("SELECT c.* FROM game_characters c JOIN game_authored_members m ON m.user_id=c.user_id JOIN account_users u ON u.id=c.user_id WHERE m.event_id=? AND m.state='admitted' AND c.active_until>? AND c.party_id=? AND c.hp>0 AND u.disabled_at IS NULL AND u.email_verified_at IS NOT NULL AND NOT EXISTS(SELECT 1 FROM game_admin_characters a WHERE a.user_id=c.user_id AND a.active_until>?)").all(event.id, time, event.party_id, time)
              : [row];
            const amount = combat(userId, { healing: skill.heal }).healing;
            const eligible = targets.filter(target => target.hp < combat(target.user_id, { maxHp: 100 }).maxHp);
            need(eligible.length && amount > 0, 'HEALTH_FULL');
            for (const target of eligible) db.prepare('UPDATE game_characters SET hp=MIN(?,hp+?) WHERE user_id=?').run(combat(target.user_id, { maxHp: 100 }).maxHp, amount, target.user_id);
          } else {
            db.prepare('UPDATE game_characters SET ward_amount=?,ward_until=? WHERE user_id=?').run(combat(userId, { ward: skill.ward }).ward, time + skill.durationMs, userId);
          }
          cooldowns[skill.id] = time + combat(userId, { cooldownMs: skill.cooldownMs }).cooldownMs;
          db.prepare('UPDATE game_characters SET skill_cooldowns_json=? WHERE user_id=?').run(JSON.stringify(cooldowns), userId);
          return 'Your skill was saved.';
        }
        if (skill) need(['strike', 'area'].includes(skill.type), 'SKILL_UNAVAILABLE');
        const cooldown = event.phase === 'admission' ? definition.combat.attackCooldownMs
          : (event.claim_kind === 'initial' && definition.initialCombat ? definition.initialCombat : definition.combat).attackCooldownMs;
        need(time - Math.max(event.last_action_at, row.last_attack_at) >= Math.max(100, combat(userId, { cooldownMs: cooldown }).cooldownMs), 'ATTACK_COOLDOWN');
        event = startCombat(event, time);
        const fight = event.claim_kind === 'initial' && definition.initialCombat ? definition.initialCombat : definition.combat;
        // Base attack comes from the service, never the client action payload.
        const xp = db.prepare('SELECT lifetime_xp FROM game_wallets WHERE user_id=?').get(userId)?.lifetime_xp || 0;
        const base = { ...(options.baseCombat?.(row) || { damage: outgoingDamage(CLASS_CATALOG[row.hero_class].damage + Math.floor(xp / 100) * 2, row.battle_stance), armor: CLASS_CATALOG[row.hero_class].armor || 0, maxHp: 100 }) };
        if (skill) base.damage = outgoingDamage(skill.damage + Math.floor(xp / 100) * 2, row.battle_stance);
        const stats = combat(userId, base);
        const enemyHp = Math.max(fight.resolveAfterActions ? 1 : 0, event.enemy_hp - Math.max(1, stats.damage));
        const rounds = event.rounds + 1;
        db.prepare('UPDATE game_authored_events SET enemy_hp=?,rounds=? WHERE id=?').run(enemyHp, rounds, event.id);
        db.prepare('UPDATE game_authored_members SET last_action_at=?,contributed=1 WHERE event_id=? AND user_id=?').run(time, event.id, userId);
        db.prepare('UPDATE game_characters SET last_attack_at=? WHERE user_id=?').run(time, userId);
        if (skill) {
          cooldowns[skill.id] = time + combat(userId, { cooldownMs: skill.cooldownMs }).cooldownMs;
          db.prepare('UPDATE game_characters SET skill_cooldowns_json=? WHERE user_id=?').run(JSON.stringify(cooldowns), userId);
        }
        if (fight.resolveAfterActions && rounds >= fight.resolveAfterActions) {
          if (fight.outcome === 'defeat') db.prepare("UPDATE game_characters SET hp=0 WHERE user_id IN (SELECT user_id FROM game_authored_members WHERE event_id=? AND state='admitted') AND active_until>?").run(event.id, time);
          finish(event, fight.outcome || 'victory', time);
        } else if (!enemyHp && !fight.resolveAfterActions) finish(event, 'victory', time);
        else {
          let damage = incomingDamage(Math.max(0, fight.damage - (stats.armor || 0)), row.battle_stance);
          if (row.ward_until > time && row.ward_amount > 0) {
            const absorbed = Math.min(damage, row.ward_amount); damage -= absorbed;
            db.prepare('UPDATE game_characters SET ward_amount=ward_amount-? WHERE user_id=?').run(absorbed, userId);
          }
          const hp = Math.max(0, row.hp - damage);
          db.prepare('UPDATE game_characters SET hp=? WHERE user_id=?').run(hp, userId);
          if (!hp) db.prepare("UPDATE game_authored_members SET state='downed' WHERE event_id=? AND user_id=?").run(event.id, userId);
          // Offline or pending members prevent a false party defeat. Their return resumes the saved fight.
          const unresolved = db.prepare("SELECT COUNT(*) AS n FROM game_authored_members WHERE event_id=? AND state IN ('pending','admitted')").get(event.id).n;
          const present = db.prepare("SELECT COUNT(*) AS n FROM game_authored_members m JOIN game_characters c ON c.user_id=m.user_id WHERE m.event_id=? AND m.state='admitted' AND c.active_until>? AND c.hp>0").get(event.id, time).n;
          if (!unresolved || (fight.resolveAfterActions && fight.outcome === 'defeat' && !present)) finish(event, 'defeat', time);
        }
        return 'Your action was saved.';
      }
      if (input.kind === 'encounterContinue') {
        need(['resolution', 'recovery'].includes(event.phase));
        acknowledge(event, userId, input.sceneKey, time);
        grant(event, userId, time);
        const recovery = JSON.parse(event.definition_json).recovery;
        const maxHp = combat(userId, { maxHp: 100 }).maxHp;
        db.prepare('UPDATE game_characters SET region_id=?,x=?,y=?,hp=? WHERE user_id=?').run(recovery.regionId, recovery.x, recovery.y, maxHp, userId);
        db.prepare("UPDATE game_authored_members SET state='recovered',recovered_at=? WHERE event_id=? AND user_id=?").run(time, event.id, userId);
        const remaining = db.prepare("SELECT COUNT(*) AS n FROM game_authored_members WHERE event_id=? AND state!='recovered'").get(event.id).n;
        db.prepare('UPDATE game_authored_events SET phase=? WHERE id=?').run(remaining ? 'recovery' : 'complete', event.id);
        return 'You returned safely. Your progress and possessions remain saved.';
      }
      throw new AuthoredError();
    });
  }
  return { content, joined, left, memberCount, membership, combat, normalizeHealth, recordVictory, onVictory, evaluateParty, resume, projection, isLocked, act };
}
