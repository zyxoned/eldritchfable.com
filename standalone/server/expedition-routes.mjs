import { randomUUID } from 'node:crypto';
import { CLASS_CATALOG } from '../shared/class-catalog.mjs';
import { outgoingDamage, incomingDamage } from '../shared/character-development.mjs';
import { REGIONS, regionWalkable } from '../shared/world-catalog.mjs';

const THEMES = new Set(['forest', 'stone', 'ruins', 'coast', 'highlands']);
const ACTIONS = new Set(['expeditionDiscover', 'expeditionEnter', 'expeditionAttack', 'expeditionSkill', 'expeditionAdvance', 'expeditionRest', 'expeditionReturn']);
const key = value => typeof value === 'string' && /^[a-zA-Z0-9:_-]{1,100}$/.test(value);
const integer = (value, low, high) => Number.isSafeInteger(value) && value >= low && value <= high;
const text = (value, max) => typeof value === 'string' && value.length > 0 && value.length <= max && !/[\u0000-\u001f<>]/.test(value);
const clone = value => JSON.parse(JSON.stringify(value));

export class ExpeditionError extends Error {
  constructor(message, status = 409, code = 'EXPEDITION_UNAVAILABLE') {
    super(message); this.status = status; this.code = code;
  }
}

// Only the operator's external bundle supplies locations, length and authored text.
// The client never receives a definition, future stage, source key or content path.
export function validateExpeditionRoutes(content = {}) {
  const routes = content?.routes ?? [];
  const invalid = () => { throw Error('Invalid expedition content.'); };
  if (!Array.isArray(routes) || routes.length > 16) invalid();
  const ids = new Set();
  const scene = value => {
    if (!value || !text(value.name, 100) || !text(value.description, 1200)
      || !THEMES.has(value.theme) || !text(value.enemy?.name, 100)
      || !integer(value.enemy.hp, 1, 1000000) || !integer(value.enemy.damage, 0, 100000)) invalid();
    return { name: value.name, description: value.description, theme: value.theme,
      enemy: { name: value.enemy.name, hp: value.enemy.hp, damage: value.enemy.damage } };
  };
  return routes.map(value => {
    if (!value || !key(value.id) || ids.has(value.id) || !text(value.name, 100)
      || !integer(value.stageCount, 1, 1000) || !integer(value.restEvery, 1, 1000)
      || !REGIONS[value.entrance?.regionId] || !regionWalkable(value.entrance.regionId, value.entrance.x, value.entrance.y)
      || !text(value.entrance.label, 100) || !Array.isArray(value.archetypes)
      || value.archetypes.length < 1 || value.archetypes.length > 8 || !key(value.finale?.sourceId)) invalid();
    if (content.sources && (!Array.isArray(content.sources) || !content.sources.some(source => source.id === value.finale.sourceId))) invalid();
    ids.add(value.id);
    return { id: value.id, name: value.name, stageCount: value.stageCount, restEvery: value.restEvery,
      entrance: { regionId: value.entrance.regionId, x: value.entrance.x, y: value.entrance.y, label: value.entrance.label },
      archetypes: value.archetypes.map(scene), finale: { ...scene(value.finale), sourceId: value.finale.sourceId } };
  });
}

export function createExpeditionRoutes(db, options = {}) {
  const definitions = validateExpeditionRoutes(options.content);
  const version = String(options.content?.version || 'unconfigured').slice(0, 100);
  const byId = new Map(definitions.map(route => [route.id, route]));
  const combat = options.combat || ((_userId, stats) => stats);
  let savepoint = 0;

  function atomic(fn) {
    const name = 'expedition_' + (++savepoint);
    db.exec('SAVEPOINT ' + name);
    try { const value = fn(); db.exec('RELEASE ' + name); return value; }
    catch (error) { db.exec('ROLLBACK TO ' + name); db.exec('RELEASE ' + name); throw error; }
  }

  function actor(userId, time, required = true) {
    const row = db.prepare('SELECT c.*,COALESCE(w.lifetime_xp,0) AS lifetime_xp FROM game_characters c '
      + 'JOIN account_users u ON u.id=c.user_id LEFT JOIN game_wallets w ON w.user_id=c.user_id '
      + "WHERE c.user_id=? AND u.disabled_at IS NULL AND u.email_verified_at IS NOT NULL "
      + 'AND c.active_until>? AND EXISTS(SELECT 1 FROM game_party_memberships m WHERE m.user_id=c.user_id AND m.party_id=c.party_id AND m.left_at IS NULL) '
      + 'AND NOT EXISTS(SELECT 1 FROM game_admin_characters a WHERE a.user_id=c.user_id AND a.active_until>?)').get(userId, time, time);
    if (!row && required) throw new ExpeditionError('Join an active party with your regular hero before exploring.', 403);
    return row;
  }

  function state(userId) {
    const row = db.prepare("SELECT r.*,m.stage AS member_stage,m.visit_epoch,m.state AS member_state,m.last_action_at,m.rest_stage FROM game_route_members m JOIN game_route_runs r ON r.id=m.run_id "
      + "WHERE m.user_id=? AND m.state!='returned'").get(userId);
    if (!row) return null;
    return { ...row, stage: row.member_stage, definition: JSON.parse(row.definition_json), current: db.prepare('SELECT * FROM game_route_stages WHERE run_id=? AND stage=?').get(row.id, row.member_stage) };
  }

  function scene(run) {
    return run.stage === run.definition.stageCount ? run.definition.finale
      : run.definition.archetypes[(run.stage - 1) % run.definition.archetypes.length];
  }

  function nearby(p, route) {
    return p.region_id === route.entrance.regionId && Math.hypot(p.x - route.entrance.x, p.y - route.entrance.y) <= 1.5;
  }

  function stats(p, skill) {
    const definition = CLASS_CATALOG[p.hero_class];
    const result = combat(p.user_id, {
      damage: outgoingDamage((skill?.damage ?? definition.damage) + Math.floor(p.lifetime_xp / 100) * 2, p.battle_stance),
      healing: skill?.heal || 0, ward: skill?.ward || 0, maxHp: 100, armor: definition.armor || 0,
      resourceMax: 100, resourceRegen: 1, cooldownMs: skill?.cooldownMs || 800,
    });
    for (const field of ['damage', 'healing', 'ward', 'maxHp', 'armor', 'cooldownMs']) {
      if (!Number.isFinite(result[field]) || result[field] < 0) throw Error('Invalid derived expedition stats.');
    }
    return { ...result, maxHp: Math.min(1000000, Math.max(1, Math.round(result.maxHp))),
      cooldownMs: Math.max(200, Math.round(result.cooldownMs)) };
  }

  function members(run, time, includeDowned = true) {
    return db.prepare("SELECT c.*,m.state AS member_state,COALESCE(w.lifetime_xp,0) AS lifetime_xp FROM game_route_members m "
      + 'JOIN game_characters c ON c.user_id=m.user_id JOIN account_users u ON u.id=c.user_id '
      + 'LEFT JOIN game_wallets w ON w.user_id=c.user_id '
      + "WHERE m.run_id=? AND m.stage=? AND m.state!='returned' AND c.party_id=? AND c.active_until>? "
      + 'AND u.disabled_at IS NULL AND u.email_verified_at IS NOT NULL '
      + 'AND EXISTS(SELECT 1 FROM game_party_memberships pm WHERE pm.user_id=c.user_id AND pm.party_id=c.party_id AND pm.left_at IS NULL) '
      + 'AND NOT EXISTS(SELECT 1 FROM game_admin_characters a WHERE a.user_id=c.user_id AND a.active_until>?) '
      + 'ORDER BY c.id').all(run.id, run.stage, run.party_id, time, time).filter(p => includeDowned || p.member_state === 'active' && p.hp > 0);
  }

  function contribution(run, userId, damage, support, time) {
    if (!(damage > 0 || support > 0)) return;
    db.prepare('INSERT INTO game_route_contributions(run_id,stage,user_id,damage,support,contributed_at) VALUES(?,?,?,?,?,?) '
      + 'ON CONFLICT(run_id,stage,user_id) DO UPDATE SET damage=damage+excluded.damage,support=support+excluded.support,contributed_at=excluded.contributed_at')
      .run(run.id, run.stage, userId, damage, support, time);
  }

  function clearStage(run, time) {
    const participants = members(run, time).filter(p => db.prepare('SELECT 1 FROM game_route_contributions WHERE run_id=? AND stage=? AND user_id=? AND damage+support>0')
      .get(run.id, run.stage, p.user_id)).map(p => p.user_id);
    db.prepare("UPDATE game_route_stages SET status='cleared',cleared_at=? WHERE run_id=? AND stage=? AND status='combat'").run(time, run.id, run.stage);
    for (const userId of participants) db.prepare('INSERT OR IGNORE INTO game_route_completions(run_id,stage,user_id,completed_at) VALUES(?,?,?,?)').run(run.id, run.stage, userId, time);
    if (run.stage === run.definition.stageCount) {
      if (typeof options.recordVictory !== 'function') throw new ExpeditionError('This encounter is temporarily unavailable. Your progress is safe.');
      db.prepare("UPDATE game_route_runs SET status='complete',completed_at=? WHERE id=?").run(time, run.id);
      options.recordVictory({ sourceId: run.definition.finale.sourceId, eventId: 'route:' + run.id + ':' + run.stage,
        partyId: run.party_id, participants, time });
    }
  }

  function hurt(p, run, damage, time) {
    const derived = stats(p);
    let remaining = incomingDamage(Math.max(0, Math.round(damage - derived.armor)), p.battle_stance);
    if (p.ward_until > time && p.ward_amount > 0) {
      const absorbed = Math.min(remaining, p.ward_amount);
      remaining -= absorbed;
      db.prepare('UPDATE game_characters SET ward_amount=? WHERE user_id=?').run(p.ward_amount - absorbed, p.user_id);
      // A self ward contributes only when it actually mitigates this encounter.
      contribution(run, p.user_id, 0, absorbed, time);
    }
    const hp = Math.max(0, p.hp - remaining);
    db.prepare('UPDATE game_characters SET hp=? WHERE user_id=?').run(hp, p.user_id);
    if (hp === 0) db.prepare("UPDATE game_route_members SET state='downed' WHERE run_id=? AND user_id=?").run(run.id, p.user_id);
  }

  function damage(p, run, amount, time) {
    const dealt = Math.min(run.current.enemy_hp, Math.max(1, Math.round(amount)));
    const hp = run.current.enemy_hp - dealt;
    db.prepare('UPDATE game_route_stages SET enemy_hp=? WHERE run_id=? AND stage=?').run(hp, run.id, run.stage);
    contribution(run, p.user_id, dealt, 0, time);
    if (hp === 0) clearStage(run, time);
    else hurt(p, run, scene(run).enemy.damage, time);
  }

  function release(userId) {
    // Server-only escape for an authored transition or accepted party departure.
    db.prepare("UPDATE game_route_members SET state='returned' WHERE user_id=? AND state!='returned'").run(userId);
  }

  function act(userId, input, time) {
    if (!ACTIONS.has(input?.kind)) throw new ExpeditionError('Choose an available expedition action.', 400);
    const allowed = new Set(['kind', 'requestId', 'partyId', 'regionId', 'scopeId']);
    if (['expeditionDiscover', 'expeditionEnter'].includes(input.kind)) allowed.add('routeId');
    if (input.kind === 'expeditionSkill') allowed.add('skillId');
    if (Object.keys(input).some(field => !allowed.has(field))) throw new ExpeditionError('Choose an available expedition action.', 400);
    return atomic(() => {
      const p = actor(userId, time);
      if (input.partyId !== undefined && input.partyId !== p.party_id) throw new ExpeditionError('Your party changed. Refresh before continuing.');
      const run = state(userId);
      if (run && run.party_id !== p.party_id) throw new ExpeditionError('Return from your saved expedition before changing parties.');
      if (input.regionId !== undefined && input.regionId !== p.region_id) throw new ExpeditionError('Your location changed. Refresh before continuing.');
      const scopeId = run ? 'route:' + run.id + ':' + run.stage + ':' + run.visit_epoch : 'region:' + p.region_id;
      if ((run || input.scopeId !== undefined) && input.scopeId !== scopeId) throw new ExpeditionError('Your location changed. Refresh before continuing.', 409, 'EXPEDITION_CHANGED');
      if (input.kind === 'expeditionReturn') {
        if (!run) throw new ExpeditionError('You are already on the open road.');
        release(userId);
        if (p.hp === 0) db.prepare('UPDATE game_characters SET hp=?,ward_until=0,ward_amount=0 WHERE user_id=?').run(stats(p).maxHp, userId);
        return 'You returned safely to the entrance. Your expedition progress is saved.';
      }
      if (['expeditionDiscover', 'expeditionEnter'].includes(input.kind)) {
        if (run) throw new ExpeditionError('Return to the open road before entering another passage.');
        const definition = byId.get(input.routeId);
        if (!definition || !nearby(p, definition)) throw new ExpeditionError('Approach a passage on foot before exploring it.');
        if (input.kind === 'expeditionDiscover') {
          db.prepare('INSERT OR IGNORE INTO game_route_discoveries(user_id,route_id,discovered_at) VALUES(?,?,?)').run(userId, definition.id, time);
          return 'You found a passage. Enter whenever you are ready.';
        }
        if (!db.prepare('SELECT 1 FROM game_route_discoveries WHERE user_id=? AND route_id=?').get(userId, definition.id)) throw new ExpeditionError('Inspect this passage before entering.');
        if (p.hp <= 0) throw new ExpeditionError('Recover before entering the passage.');
        let existing = db.prepare("SELECT * FROM game_route_runs WHERE party_id=? AND route_id=? AND status='running'").get(p.party_id, definition.id);
        if (!existing) {
          const id = randomUUID();
          db.prepare('INSERT INTO game_route_runs(id,party_id,route_id,content_version,definition_json,created_at) VALUES(?,?,?,?,?,?)')
            .run(id, p.party_id, definition.id, version, JSON.stringify(definition), time);
          const first = definition.stageCount === 1 ? definition.finale : definition.archetypes[0];
          db.prepare('INSERT INTO game_route_stages(run_id,stage,enemy_hp) VALUES(?,?,?)').run(id, 1, first.enemy.hp);
          existing = db.prepare('SELECT * FROM game_route_runs WHERE id=?').get(id);
        }
        const occupied = db.prepare("SELECT COUNT(*) AS n FROM game_route_members WHERE run_id=? AND state!='returned'").get(existing.id).n;
        if (occupied >= 8) throw new ExpeditionError('This expedition is full.');
        db.prepare("INSERT INTO game_route_members(run_id,user_id,state,entered_at,visit_epoch) VALUES(?,?,'active',?,1) "
          + "ON CONFLICT(run_id,user_id) DO UPDATE SET state='active',entered_at=excluded.entered_at,visit_epoch=game_route_members.visit_epoch+1").run(existing.id, userId, time);
        return 'You entered the passage. Your party progress is saved.';
      }
      if (!run) throw new ExpeditionError('Enter a discovered passage first.');
      if (run.member_state === 'downed' || p.hp <= 0) throw new ExpeditionError('Return to the entrance to recover.');
      if (input.kind === 'expeditionAdvance') {
        if (run.current.status !== 'cleared') throw new ExpeditionError('Clear this chamber before continuing.');
        const next = run.stage + 1;
        if (next > run.definition.stageCount) throw new ExpeditionError('This expedition is complete.');
        const nextRun = { ...run, stage: next };
        db.prepare('INSERT OR IGNORE INTO game_route_stages(run_id,stage,enemy_hp) VALUES(?,?,?)').run(run.id, next, scene(nextRun).enemy.hp);
        db.prepare('UPDATE game_route_runs SET stage=MAX(stage,?) WHERE id=?').run(next, run.id);
        db.prepare('UPDATE game_route_members SET stage=? WHERE run_id=? AND user_id=?').run(next, run.id, userId);
        return 'You continued to the next chamber.';
      }
      if (input.kind === 'expeditionRest') {
        if (run.current.status !== 'cleared' || run.stage % run.definition.restEvery !== 0 || run.rest_stage === run.stage) throw new ExpeditionError('There is no unused safe rest here.');
        db.prepare('UPDATE game_characters SET hp=?,ward_until=0,ward_amount=0 WHERE user_id=?').run(stats(p).maxHp, userId);
        db.prepare('UPDATE game_route_members SET rest_stage=? WHERE run_id=? AND user_id=?').run(run.stage, run.id, userId);
        return 'You rested at a safe camp.';
      }
      if (run.current.status !== 'combat' || run.current.enemy_hp <= 0) throw new ExpeditionError('This chamber is clear. Choose your next step.');
      const skill = input.kind === 'expeditionSkill' ? CLASS_CATALOG[p.hero_class].skills.find(value => value.id === input.skillId) : null;
      if (input.kind === 'expeditionSkill' && !skill) throw new ExpeditionError('Choose one of your own class skills.', 400);
      const derived = stats(p, skill);
      const cooldowns = JSON.parse(p.skill_cooldowns_json);
      if (time - Math.max(run.last_action_at, p.last_attack_at) < 200
        || (!skill && time - p.last_attack_at < derived.cooldownMs)
        || (skill && (cooldowns[skill.id] || 0) > time)) throw new ExpeditionError('Let this action recover first.', 429, 'EXPEDITION_COOLDOWN');
      if (skill) {
        cooldowns[skill.id] = time + derived.cooldownMs;
        db.prepare('UPDATE game_characters SET skill_cooldowns_json=? WHERE user_id=?').run(JSON.stringify(cooldowns), userId);
      }
      db.prepare('UPDATE game_route_members SET last_action_at=? WHERE run_id=? AND user_id=?').run(time, run.id, userId);
      db.prepare('UPDATE game_characters SET last_attack_at=? WHERE user_id=?').run(time, userId);
      if (!skill || ['strike', 'area'].includes(skill.type)) {
        damage(p, run, derived.damage, time);
        return 'Your strike landed.';
      }
      if (skill.type === 'heal') {
        const targets = skill.target === 'party' ? members(run, time, false) : [p];
        let effective = 0;
        for (const target of targets) {
          const restored = Math.min(Math.max(0, stats(target).maxHp - target.hp), Math.round(derived.healing));
          if (restored <= 0) continue;
          db.prepare('UPDATE game_characters SET hp=hp+? WHERE user_id=?').run(restored, target.user_id);
          // Healing actual participants counts; healing idle bystanders does not.
          if (db.prepare('SELECT 1 FROM game_route_contributions WHERE run_id=? AND stage=? AND user_id=? AND damage+support>0').get(run.id, run.stage, target.user_id)) effective += restored;
        }
        contribution(run, userId, 0, effective, time);
        return 'Your healing reached nearby companions.';
      }
      if (skill.type === 'ward') {
        db.prepare('UPDATE game_characters SET ward_until=?,ward_amount=? WHERE user_id=?')
          .run(time + skill.durationMs, Math.min(1000000, Math.round(derived.ward)), userId);
        return 'Your ward is ready.';
      }
      throw new ExpeditionError('This skill cannot be used here.', 400);
    });
  }

  function projection(userId, time) {
    const p = actor(userId, time, false);
    if (!p) return { nearby: [], known: [], active: null };
    const discovered = new Set(db.prepare('SELECT route_id FROM game_route_discoveries WHERE user_id=?').all(userId).map(row => row.route_id));
    const run = state(userId);
    const available = definitions.filter(route => nearby(p, route));
    const base = {
      nearby: run ? [] : available.map(route => ({ id: route.id, ...route.entrance, discovered: discovered.has(route.id) })),
      known: definitions.filter(route => discovered.has(route.id)).map(route => ({ id: route.id, label: route.entrance.label })), active: null,
    };
    if (!run || run.party_id !== p.party_id) return base;
    const current = scene(run);
    const usable = run.member_state === 'active' && p.hp > 0;
    const fighting = usable && run.current.status === 'combat';
    const cooldowns = JSON.parse(p.skill_cooldowns_json);
    base.active = {
      runId: run.id, routeName: run.definition.name, stage: run.stage, stageCount: run.definition.stageCount,
      visitEpoch: run.visit_epoch, scopeId: 'route:' + run.id + ':' + run.stage + ':' + run.visit_epoch,
      status: run.stage === run.definition.stageCount && run.current.status === 'cleared' ? 'complete' : run.current.status, ownState: run.member_state,
      scene: { name: current.name, description: current.description, theme: current.theme },
      enemy: { name: current.enemy.name, hp: run.current.enemy_hp, maxHp: current.enemy.hp },
      members: members(run, time).map(member => ({ playerId: member.id, name: member.name, heroClass: member.hero_class,
        hp: member.hp, maxHp: stats(member).maxHp, state: member.member_state })),
      actions: { attack: fighting, attackReadyAt: Math.max(run.last_action_at, p.last_attack_at) + stats(p).cooldownMs,
        skills: fighting ? CLASS_CATALOG[p.hero_class].skills.filter(skill => skill.type !== 'passive').map(skill => ({ id: skill.id, name: skill.name,
          readyAt: Math.max(cooldowns[skill.id] || 0, run.last_action_at + 200, p.last_attack_at + 200) })) : [],
        advance: usable && run.stage < run.definition.stageCount && run.current.status === 'cleared',
        rest: usable && run.current.status === 'cleared' && run.stage % run.definition.restEvery === 0 && run.rest_stage !== run.stage,
        return: true },
    };
    return clone(base);
  }

  function location(userId) {
    const run = state(userId);
    return run ? { kind: 'expedition', runId: run.id, stage: run.stage, visitEpoch: run.visit_epoch,
      scopeId: 'route:' + run.id + ':' + run.stage + ':' + run.visit_epoch } : null;
  }

  return { act, projection, location, release, locking: userId => Boolean(state(userId)), handles: kind => ACTIONS.has(kind) };
}
