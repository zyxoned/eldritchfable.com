import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDatabase, migrateDatabase, transaction } from '../server/database.mjs';
import { createAuthoredEngine } from '../server/authored-engine.mjs';
import { createExpeditionRoutes, validateExpeditionRoutes, ExpeditionError } from '../server/expedition-routes.mjs';

// These deliberately artificial examples contain no deployment authoring.
function content(stages = 3) {
  return { version: 'synthetic-test-v1', routes: [{
    id: 'sample-route', name: 'Sample Expedition', entrance: { regionId: 'glade', x: 10, y: 13, label: 'Weathered doorway' },
    stageCount: stages, restEvery: 2,
    archetypes: [
      { name: 'Training Court', description: 'A sheltered court of pale stone.', theme: 'stone', enemy: { name: 'Practice sentinel', hp: 30, damage: 12 } },
      { name: 'Garden Walk', description: 'A quiet, overgrown garden.', theme: 'forest', enemy: { name: 'Practice warden', hp: 35, damage: 10 } },
    ],
    finale: { name: 'Last Court', description: 'A final trial awaits.', theme: 'ruins', enemy: { name: 'Example Champion', hp: 100, damage: 16 }, sourceId: 'example-source' },
  }] };
}
function harness(t, { bundle = content(), path = ':memory:', combat, victory } = {}) {
  let db = openDatabase(path); migrateDatabase(db);
  let time = 1000000;
  const victories = [];
  const hook = victory || (value => { victories.push(value); return value.participants; });
  let routes = createExpeditionRoutes(db, { content: bundle, combat, recordVictory: hook });
  t.after(() => db.close());
  function party(id = 'party-a') {
    db.prepare("INSERT INTO game_parties(id,mode,enemies_json,created_at) VALUES(?,'open','[]',?)").run(id, time);
    return id;
  }
  party();
  function hero(id = 'hero-one', heroClass = 'knight', partyId = 'party-a', role = 'customer') {
    db.prepare('INSERT INTO account_users(id,email,password_hash,role,email_verified_at) VALUES(?,?,?,?,?)').run(id, id + '@example.test', 'synthetic', role, '2026-01-01');
    db.prepare('INSERT INTO game_characters(user_id,id,name,hero_class,party_id,active_until) VALUES(?,?,?,?,?,?)').run(id, id, id, heroClass, partyId, time + 100000000);
    db.prepare('INSERT INTO game_party_memberships(party_id,user_id,joined_at) VALUES(?,?,?)').run(partyId, id, time);
    db.prepare('INSERT INTO game_wallets(user_id,balance_xp,lifetime_xp,balance_copper) VALUES(?,?,?,?)').run(id, 17, 17, 25);
    return id;
  }
  function act(userId, kind, extra = {}, advance = 1000) {
    time += advance;
    const location = routes.location(userId);
    const regionId = db.prepare('SELECT region_id FROM game_characters WHERE user_id=?').get(userId)?.region_id;
    const scopeId = location ? location.scopeId : 'region:' + regionId;
    return routes.act(userId, { kind, regionId, scopeId, ...extra }, time);
  }
  function enter(userId) {
    act(userId, 'expeditionDiscover', { routeId: 'sample-route' });
    act(userId, 'expeditionEnter', { routeId: 'sample-route' });
  }
  function projection(userId) { return routes.projection(userId, time); }
  function clear(userId) {
    while (projection(userId).active.enemy.hp > 0) act(userId, 'expeditionAttack');
  }
  function restart(nextBundle = bundle) {
    db.close(); db = openDatabase(path);
    routes = createExpeditionRoutes(db, { content: nextBundle, combat, recordVictory: hook });
  }
  return { get db() { return db; }, get routes() { return routes; }, get time() { return time; }, act, hero, party, enter, clear, projection, victories, restart };
}

test('route discovery is physical, optional and reveals only the nearby entrance', t => {
  const h = harness(t); const hero = h.hero();
  h.db.prepare('UPDATE game_characters SET x=20 WHERE user_id=?').run(hero);
  assert.deepEqual(h.projection(hero), { nearby: [], known: [], active: null });
  assert.throws(() => h.act(hero, 'expeditionEnter', { routeId: 'sample-route' }), ExpeditionError);
  assert.throws(() => h.act(hero, 'expeditionDiscover', { routeId: 'sample-route' }), ExpeditionError);
  h.db.prepare('UPDATE game_characters SET x=10 WHERE user_id=?').run(hero);
  const nearby = JSON.stringify(h.projection(hero));
  assert.match(nearby, /Weathered doorway/);
  assert.doesNotMatch(nearby, /Sample Expedition|Example Champion|example-source|Last Court|stageCount/);
  assert.throws(() => h.act(hero, 'expeditionEnter', { routeId: 'sample-route' }), ExpeditionError);
  h.enter(hero);
  assert.equal(h.projection(hero).active.stage, 1);
  assert.equal(h.projection(hero).active.routeName, 'Sample Expedition');
  assert.doesNotMatch(JSON.stringify(h.projection(hero)), /Example Champion|example-source|Last Court/);
});

test('stages advance independently and combat, healing and victory are floor-local', t => {
  const h = harness(t, { bundle: content(2) });
  const fighter = h.hero(); const healer = h.hero('hero-two', 'cleric'); const absent = h.hero('hero-three');
  h.enter(fighter); h.enter(healer); h.enter(absent);
  h.clear(fighter);
  h.act(fighter, 'expeditionAdvance');
  assert.equal(h.projection(healer).active.stage, 1);
  assert.equal(h.projection(absent).active.stage, 1);
  assert.equal(h.projection(fighter).active.stage, 2);
  assert.equal(h.projection(fighter).active.members.length, 1);
  assert.equal(h.victories.length, 0);
  assert.throws(() => h.act(healer, 'expeditionSkill', { skillId: 'sanctuary' }), ExpeditionError);
  h.act(healer, 'expeditionAdvance');
  h.act(fighter, 'expeditionAttack');
  const before = h.db.prepare('SELECT hp FROM game_characters WHERE user_id=?').get(fighter).hp;
  h.act(healer, 'expeditionSkill', { skillId: 'sanctuary' });
  assert.ok(h.db.prepare('SELECT hp FROM game_characters WHERE user_id=?').get(fighter).hp > before);
  h.clear(fighter);
  assert.equal(h.victories.length, 1);
  assert.deepEqual(h.victories[0].participants.sort(), [fighter, healer].sort());
  assert.match(h.victories[0].eventId, /^route:[a-f0-9-]+:2$/);
  assert.equal(h.victories[0].sourceId, 'example-source');
  assert.equal(h.projection(absent).active.stage, 1);
  assert.doesNotMatch(JSON.stringify(h.projection(absent)), /Example Champion|Last Court/);
  assert.equal(h.db.prepare('SELECT COUNT(*) AS n FROM game_route_completions WHERE user_id=? AND stage=2').get(absent).n, 0);
  assert.throws(() => h.act(fighter, 'expeditionAttack'), ExpeditionError);
  assert.equal(h.victories.length, 1);
});

test('a companion can catch up explicitly without receiving earlier victory credit', t => {
  const h = harness(t); const lead = h.hero(); const late = h.hero('hero-two');
  h.enter(lead); h.clear(lead); h.act(lead, 'expeditionAdvance'); h.clear(lead);
  h.enter(late);
  assert.equal(h.projection(late).active.stage, 1);
  h.act(late, 'expeditionAdvance');
  assert.equal(h.projection(late).active.stage, 2);
  assert.equal(h.db.prepare('SELECT COUNT(*) AS n FROM game_route_completions WHERE user_id=?').get(late).n, 0);
  assert.equal(h.routes.location(lead).stage, 2);
  assert.equal(h.routes.location(late).stage, 2);
});

test('route length is entirely configured and every stage requires an explicit advance', t => {
  const bundle = content(37);
  for (const value of [...bundle.routes[0].archetypes, bundle.routes[0].finale]) { value.enemy.hp = 1; value.enemy.damage = 0; }
  const h = harness(t, { bundle }); const hero = h.hero(); h.enter(hero);
  for (let stage = 1; stage <= 37; stage++) {
    assert.equal(h.projection(hero).active.stage, stage);
    assert.throws(() => h.act(hero, 'expeditionAdvance'), ExpeditionError);
    assert.throws(() => h.act(hero, 'expeditionAttack', { stage: 37 }), ExpeditionError);
    h.clear(hero);
    if (stage < 37) {
      assert.equal(h.victories.length, 0);
      h.act(hero, 'expeditionAdvance');
    }
  }
  assert.equal(h.victories.length, 1);
  assert.equal(h.db.prepare('SELECT COUNT(*) AS n FROM game_route_stages').get().n, 37);
  assert.equal(h.db.prepare('SELECT COUNT(*) AS n FROM game_route_completions').get().n, 37);
  assert.equal(h.projection(hero).active.status, 'complete');
  assert.throws(() => h.act(hero, 'expeditionAdvance'), ExpeditionError);
  assert.deepEqual({ ...h.db.prepare('SELECT balance_xp,lifetime_xp,balance_copper FROM game_wallets WHERE user_id=?').get(hero) }, { balance_xp: 17, lifetime_xp: 17, balance_copper: 25 });
  assert.equal(h.db.prepare('SELECT COUNT(*) AS n FROM game_ledger').get().n, 0);
});

test('saved health, encounter HP, own floor and frozen content survive restart and return', t => {
  const dir = mkdtempSync(join(tmpdir(), 'route-test-')); t.after(() => rmSync(dir, { recursive: true, force: true }));
  const h = harness(t, { path: join(dir, 'test.db') }); const hero = h.hero(); h.enter(hero);
  h.clear(hero); h.act(hero, 'expeditionAdvance'); h.act(hero, 'expeditionAttack');
  const saved = h.projection(hero).active;
  h.restart(content(9));
  assert.deepEqual(h.projection(hero).active, saved);
  h.act(hero, 'expeditionReturn');
  assert.equal(h.routes.locking(hero), false);
  assert.equal(h.projection(hero).active, null);
  h.act(hero, 'expeditionEnter', { routeId: 'sample-route' });
  assert.equal(h.projection(hero).active.stage, 2);
  assert.equal(h.projection(hero).active.stageCount, 3);
  assert.equal(h.projection(hero).active.enemy.hp, saved.enemy.hp);
  assert.equal(h.projection(hero).active.members[0].hp, saved.members[0].hp);
});

test('downed players recover only by choosing a safe return and rest is once per checkpoint', t => {
  const h = harness(t); const hero = h.hero(); h.enter(hero);
  h.db.prepare('UPDATE game_characters SET hp=1 WHERE user_id=?').run(hero);
  h.act(hero, 'expeditionAttack');
  assert.equal(h.projection(hero).active.ownState, 'downed');
  assert.equal(h.db.prepare('SELECT hp FROM game_characters WHERE user_id=?').get(hero).hp, 0);
  assert.throws(() => h.act(hero, 'expeditionAttack'), ExpeditionError);
  h.act(hero, 'expeditionReturn');
  assert.equal(h.db.prepare('SELECT hp FROM game_characters WHERE user_id=?').get(hero).hp, 100);
  h.act(hero, 'expeditionEnter', { routeId: 'sample-route' }); h.clear(hero);
  assert.throws(() => h.act(hero, 'expeditionRest'), ExpeditionError);
  h.act(hero, 'expeditionAdvance'); h.clear(hero); h.act(hero, 'expeditionRest');
  assert.equal(h.db.prepare('SELECT hp FROM game_characters WHERE user_id=?').get(hero).hp, 100);
  assert.throws(() => h.act(hero, 'expeditionRest'), ExpeditionError);
});

test('visitor state, leases, accepted membership and parties are revalidated and isolated', t => {
  const h = harness(t); const first = h.hero(); const admin = h.hero('hero-admin', 'knight', 'party-a', 'admin');
  h.db.prepare('INSERT INTO game_admin_characters(user_id,id,session_hash,party_id,active_until) VALUES(?,?,?,?,?)').run(admin, 'visitor-admin', 'a'.repeat(64), 'party-a', h.time + 99999);
  h.party('party-b'); const other = h.hero('hero-other', 'knight', 'party-b');
  assert.throws(() => h.enter(admin), ExpeditionError);
  assert.deepEqual(h.projection(admin), { nearby: [], known: [], active: null });
  h.enter(first); h.enter(other);
  assert.notEqual(h.projection(first).active.runId, h.projection(other).active.runId);
  h.act(first, 'expeditionAttack');
  assert.equal(h.projection(other).active.enemy.hp, 30);
  assert.throws(() => h.act(first, 'expeditionAttack', { partyId: 'party-b' }), ExpeditionError);
  h.db.prepare('UPDATE game_party_memberships SET left_at=? WHERE user_id=?').run(h.time, first);
  assert.throws(() => h.act(first, 'expeditionAttack'), ExpeditionError);
  h.db.prepare('UPDATE game_party_memberships SET left_at=NULL WHERE user_id=?').run(first);
  h.db.prepare('UPDATE game_characters SET active_until=0 WHERE user_id=?').run(first);
  assert.throws(() => h.act(first, 'expeditionAttack'), ExpeditionError);
  h.db.prepare('UPDATE game_characters SET active_until=? WHERE user_id=?').run(h.time + 99999, first);
  h.db.prepare("UPDATE account_users SET disabled_at='2026-01-01' WHERE id=?").run(first);
  assert.throws(() => h.act(first, 'expeditionReturn'), ExpeditionError);
});

test('derived combat affects damage, healing, durability, defense and recovery without economy changes', t => {
  const h = harness(t, { combat: (_id, base) => Object.fromEntries(Object.entries(base).map(([key, value]) => [key, key === 'cooldownMs' ? value : value * 2])) });
  const hero = h.hero('hero-one', 'cleric'); h.enter(hero);
  assert.equal(h.projection(hero).active.members[0].maxHp, 200);
  h.clear(hero); h.act(hero, 'expeditionAdvance'); h.clear(hero); h.act(hero, 'expeditionRest');
  assert.equal(h.db.prepare('SELECT hp FROM game_characters WHERE user_id=?').get(hero).hp, 200);
  h.act(hero, 'expeditionAdvance'); h.act(hero, 'expeditionAttack');
  assert.equal(h.projection(hero).active.enemy.hp, 68);
  assert.equal(h.db.prepare('SELECT hp FROM game_characters WHERE user_id=?').get(hero).hp, 188);
  h.act(hero, 'expeditionSkill', { skillId: 'sanctuary' });
  assert.equal(h.db.prepare('SELECT hp FROM game_characters WHERE user_id=?').get(hero).hp, 200);
  assert.equal(h.db.prepare('SELECT balance_xp FROM game_wallets WHERE user_id=?').get(hero).balance_xp, 17);
});

test('victory failure rolls back the whole hit, even inside a game transaction', t => {
  const bundle = content(1); bundle.routes[0].finale.enemy.hp = 1;
  const h = harness(t, { bundle, victory: () => { throw Error('Synthetic unavailable hook'); } });
  const hero = h.hero(); h.enter(hero);
  assert.throws(() => transaction(h.db, () => h.act(hero, 'expeditionAttack')), /Synthetic unavailable hook/);
  assert.equal(h.projection(hero).active.enemy.hp, 1);
  assert.equal(h.db.prepare('SELECT COUNT(*) AS n FROM game_route_completions').get().n, 0);
  assert.equal(h.db.prepare('SELECT COUNT(*) AS n FROM game_route_contributions').get().n, 0);
});

test('invalid content and client-authored outcomes fail closed with neutral errors', t => {
  const bundle = content(); bundle.routes[0].stageCount = 1001;
  assert.throws(() => validateExpeditionRoutes(bundle), /^Error: Invalid expedition content\.$/);
  assert.deepEqual(validateExpeditionRoutes({}), []);
  const h = harness(t); const hero = h.hero(); h.enter(hero);
  for (const kind of ['expeditionComplete', 'expeditionVictory', 'expeditionTeleport']) assert.throws(() => h.act(hero, kind), ExpeditionError);
  assert.throws(() => h.act(hero, 'expeditionSkill', { skillId: 'sanctuary' }), ExpeditionError);
  assert.throws(() => h.act(hero, 'expeditionAttack', { damage: 999999 }), ExpeditionError);
  assert.equal(h.projection(hero).active.enemy.hp, 30);
});

test('idle, returned and offline members receive no terminal participation receipts', t => {
  const h = harness(t, { bundle: content(1) });
  const lead = h.hero(); const idle = h.hero('hero-idle', 'cleric'); const offline = h.hero('hero-offline'); const returned = h.hero('hero-returned');
  for (const userId of [lead, idle, offline, returned]) h.enter(userId);
  h.act(idle, 'expeditionSkill', { skillId: 'sanctuary' }); // No healing happened.
  h.act(offline, 'expeditionAttack');
  h.act(returned, 'expeditionAttack'); h.act(returned, 'expeditionReturn');
  h.db.prepare('UPDATE game_characters SET active_until=0 WHERE user_id=?').run(offline);
  h.clear(lead);
  assert.deepEqual(h.victories[0].participants, [lead]);
  assert.equal(h.db.prepare('SELECT COUNT(*) AS n FROM game_route_completions').get().n, 1);
});

test('new runs have new stable encounters while completed run receipts stay immutable', t => {
  const bundle = content(1); bundle.routes[0].finale.enemy.hp = 1;
  const h = harness(t, { bundle }); const hero = h.hero(); h.enter(hero); h.clear(hero);
  const first = h.victories[0].eventId;
  h.act(hero, 'expeditionReturn'); h.act(hero, 'expeditionEnter', { routeId: 'sample-route' }); h.clear(hero);
  assert.equal(h.victories.length, 2);
  assert.notEqual(h.victories[1].eventId, first);
  assert.equal(h.db.prepare('SELECT COUNT(*) AS n FROM game_route_completions').get().n, 2);
  assert.equal(h.db.prepare('SELECT COUNT(*) AS n FROM game_ledger').get().n, 0);
});

test('a terminal stage already cleared does not teleport or credit distant followers', t => {
  const bundle = content(2); bundle.routes[0].finale.enemy.hp = 1;
  const h = harness(t, { bundle }); const lead = h.hero(); const follower = h.hero('hero-follow');
  h.enter(lead); h.enter(follower); h.clear(lead); h.act(lead, 'expeditionAdvance'); h.clear(lead);
  assert.equal(h.projection(follower).active.stage, 1);
  assert.equal(h.projection(follower).active.actions.advance, true);
  assert.equal(h.victories.length, 1);
  h.act(follower, 'expeditionAdvance');
  assert.equal(h.projection(follower).active.status, 'complete');
  assert.equal(h.victories.length, 1);
  assert.equal(h.db.prepare('SELECT COUNT(*) AS n FROM game_route_completions WHERE user_id=?').get(follower).n, 0);
});

test('server-only release preserves HP and disabled content leaves exploration optional', t => {
  const h = harness(t); const hero = h.hero(); h.enter(hero); h.act(hero, 'expeditionAttack');
  const hp = h.db.prepare('SELECT hp FROM game_characters WHERE user_id=?').get(hero).hp;
  h.routes.release(hero);
  assert.equal(h.routes.location(hero), null);
  assert.equal(h.db.prepare('SELECT hp FROM game_characters WHERE user_id=?').get(hero).hp, hp);
  assert.deepEqual(createExpeditionRoutes(h.db, { content: null }).projection(hero, h.time), { nearby: [], known: [], active: null });
  const invalid = content(); invalid.sources = [{ id: 'different-source' }];
  assert.throws(() => validateExpeditionRoutes(invalid), /Invalid expedition content/);
});


test('actual authored source integration grants once per account and only after a terminal defeat', t => {
  const bundle = content(2);
  bundle.sources = [{ id: 'example-source', effects: [{ id: 'synthetic-fatigue', name: 'Fatigue', flat: { armor: -1 } }] }];
  bundle.encounters = [];
  for (const value of [...bundle.routes[0].archetypes, bundle.routes[0].finale]) value.enemy.damage = 0;
  let engine; let draws = 0;
  const h = harness(t, { bundle, victory: event => engine.recordVictory(event) });
  engine = createAuthoredEngine(h.db, { content: bundle, randomInt: () => { draws++; return 0; } });
  const hero = h.hero(); h.enter(hero); h.clear(hero);
  assert.equal(h.db.prepare('SELECT COUNT(*) AS n FROM game_source_acquisitions').get().n, 0);
  h.act(hero, 'expeditionAdvance'); h.clear(hero);
  assert.equal(h.db.prepare('SELECT COUNT(*) AS n FROM game_source_acquisitions').get().n, 1);
  assert.equal(h.db.prepare('SELECT COUNT(*) AS n FROM game_authored_victories').get().n, 1);
  assert.equal(draws, 1);
  h.act(hero, 'expeditionReturn'); h.enter(hero); h.clear(hero); h.act(hero, 'expeditionAdvance'); h.clear(hero);
  assert.equal(h.db.prepare('SELECT COUNT(*) AS n FROM game_source_acquisitions').get().n, 1);
  assert.equal(h.db.prepare('SELECT COUNT(*) AS n FROM game_authored_victories').get().n, 2);
  assert.equal(draws, 1);
});


test('active route actions require the expected floor so stale packets cannot affect a new scene', t => {
  const h = harness(t); const hero = h.hero(); h.enter(hero);
  const old = h.routes.location(hero); const oldScope = old.scopeId;
  h.clear(hero); h.act(hero, 'expeditionAdvance');
  assert.throws(() => h.act(hero, 'expeditionAttack', { scopeId: oldScope }), error => error.code === 'EXPEDITION_CHANGED');
  assert.throws(() => h.act(hero, 'expeditionReturn', { scopeId: oldScope }), error => error.code === 'EXPEDITION_CHANGED');
  assert.throws(() => h.routes.act(hero, { kind: 'expeditionAttack' }, h.time + 1000), error => error.code === 'EXPEDITION_CHANGED');
  assert.equal(h.projection(hero).active.enemy.hp, 35);
  assert.equal(h.projection(hero).active.stage, 2);
  h.act(hero, 'expeditionAttack', { regionId: 'glade' });
  assert.equal(h.projection(hero).active.enemy.hp, 13);
});


test('leveled class skills include lifetime progression before stance and persistent effects', t => {
  const h = harness(t, { bundle: content(1), combat: (_id, base) => ({ ...base, damage: base.damage * 2 }) });
  const hero = h.hero();
  h.db.prepare('UPDATE game_wallets SET lifetime_xp=350 WHERE user_id=?').run(hero);
  h.db.prepare("UPDATE game_characters SET battle_stance='focused' WHERE user_id=?").run(hero);
  h.enter(hero);
  h.act(hero, 'expeditionSkill', { skillId: 'oathbound-strike' });
  assert.equal(h.projection(hero).active.enemy.hp, 100 - (34 + 6 + 2) * 2);
  assert.equal(h.db.prepare('SELECT lifetime_xp FROM game_wallets WHERE user_id=?').get(hero).lifetime_xp, 350);
});


test('projected cooldowns use derived attack timing and survive explicit floor advancement', t => {
  const bundle = content(2); bundle.routes[0].archetypes[0].enemy.hp = 1;
  const h = harness(t, { bundle, combat: (_id, base) => ({ ...base, cooldownMs: base.cooldownMs * 2 }) });
  const hero = h.hero(); h.enter(hero); h.act(hero, 'expeditionAttack');
  const readyAt = h.time + 1600;
  assert.equal(h.projection(hero).active.actions.attackReadyAt, readyAt);
  h.act(hero, 'expeditionAdvance', {}, 0);
  assert.equal(h.projection(hero).active.actions.attackReadyAt, readyAt);
  assert.ok(h.projection(hero).active.actions.skills.every(skill => skill.readyAt >= h.time + 200));
  assert.throws(() => h.act(hero, 'expeditionAttack', {}, 0), error => error.code === 'EXPEDITION_COOLDOWN');
  h.act(hero, 'expeditionAttack', {}, 1600);
  assert.equal(h.projection(hero).active.enemy.hp, 78);
});


test('return and re-entry increments the visit epoch and rejects delayed previous-visit actions', t => {
  const h = harness(t); const hero = h.hero(); h.enter(hero);
  const first = h.routes.location(hero);
  assert.equal(first.visitEpoch, 1);
  assert.equal(h.projection(hero).active.scopeId, first.scopeId);
  h.act(hero, 'expeditionReturn');
  h.act(hero, 'expeditionEnter', { routeId: 'sample-route' });
  const next = h.routes.location(hero);
  assert.equal(next.runId, first.runId);
  assert.equal(next.stage, first.stage);
  assert.equal(next.visitEpoch, 2);
  assert.notEqual(next.scopeId, first.scopeId);
  for (const kind of ['expeditionAttack', 'expeditionReturn', 'expeditionAdvance']) {
    assert.throws(() => h.act(hero, kind, { scopeId: first.scopeId }), error => error.code === 'EXPEDITION_CHANGED');
  }
  assert.equal(h.projection(hero).active.enemy.hp, 30);
  assert.equal(h.routes.location(hero).visitEpoch, 2);
  h.act(hero, 'expeditionAttack');
  assert.equal(h.projection(hero).active.enemy.hp, 8);
});


test('an administrator ordinary hero remains eligible while visitor tools and test XP cannot boost or consume route credit', t => {
  const h = harness(t, { bundle: content(1) });
  const admin = h.hero('hero-admin', 'knight', 'party-a', 'admin');
  h.db.prepare('INSERT INTO admin_account_settings(user_id,testing_enabled,test_xp,test_copper) VALUES(?,1,999999,123)').run(admin);
  h.enter(admin); h.act(admin, 'expeditionAttack');
  assert.equal(h.projection(admin).active.enemy.hp, 78);
  assert.equal(h.projection(admin).active.members[0].hp, 87);
  assert.equal(h.projection(admin).active.members[0].maxHp, 100);
  h.clear(admin);
  assert.deepEqual(h.victories[0].participants, [admin]);
  const ordinary = h.hero('hero-ordinary');
  h.act(admin, 'expeditionReturn'); h.enter(admin); h.enter(ordinary);
  h.act(admin, 'expeditionAttack');
  const runId = h.routes.location(admin).runId;
  h.db.prepare('INSERT INTO game_admin_characters(user_id,id,session_hash,party_id,active_until) VALUES(?,?,?,?,?)').run(admin, 'visitor-avatar', 'a'.repeat(64), 'party-a', h.time + 99999);
  assert.throws(() => h.act(admin, 'expeditionAttack'), ExpeditionError);
  assert.deepEqual(h.projection(admin), { nearby: [], known: [], active: null });
  h.clear(ordinary);
  assert.deepEqual(h.victories[1].participants, [ordinary]);
  assert.equal(h.db.prepare('SELECT COUNT(*) AS n FROM game_route_completions WHERE run_id=? AND user_id=?').get(runId, admin).n, 0);
  assert.deepEqual({ ...h.db.prepare('SELECT test_xp,test_copper FROM admin_account_settings WHERE user_id=?').get(admin) }, { test_xp: 999999, test_copper: 123 });
  assert.equal(h.db.prepare('SELECT COUNT(*) AS n FROM game_ledger').get().n, 0);
});
