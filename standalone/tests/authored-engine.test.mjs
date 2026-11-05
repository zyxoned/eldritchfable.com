import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, chmodSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Worker } from 'node:worker_threads';
import { openDatabase, migrateDatabase, transaction } from '../server/database.mjs';
import { createAuthoredEngine, validateAuthoredContent, loadAuthoredContent } from '../server/authored-engine.mjs';
import { aggregateCombatStats } from '../server/combat-effects.mjs';
import { PLAYER_CLASS_IDS } from '../shared/class-catalog.mjs';

// Entirely synthetic authoring. Actual content never belongs in source or fixtures.
const effect = { id: 'synthetic-steady', name: 'Steady', flat: { maxHp: -1 } };
function bundle(overrides = {}) {
  return {
    version: 'synthetic-v1',
    sources: ['alpha', 'beta', 'gamma'].map(id => ({ id, effects: [effect], draw: { denominator: 7, winners: 1, benefitKey: 'synthetic-once', effect: { id: 'synthetic-vigor', name: 'Vigor', scale: { maxHp: 1.5, damage: 1.5, healing: 1.5, ward: 1.5, resourceMax: 1.5, resourceRegen: 1.5 } } } })),
    encounters: [{
      id: 'synthetic-chamber', requiresSources: ['alpha', 'beta', 'gamma'], claimKey: 'synthetic-opening',
      combat: { hp: 40, damage: 5, attackCooldownMs: 500 },
      initialCombat: { hp: 40, damage: 5, attackCooldownMs: 500, resolveAfterActions: 2, outcome: 'victory' },
      scenes: { arrival: { title: 'Chamber', text: 'You entered a chamber.' }, victory: { title: 'Cleared', text: 'The chamber is quiet.' }, defeat: { title: 'Return', text: 'The chamber rests.' } },
      grant: { when: 'initial-victory', key: 'synthetic-kit', itemsByClass: Object.fromEntries(PLAYER_CLASS_IDS.map(heroClass => [heroClass, { id: 'synthetic-' + heroClass, name: heroClass + ' Kit', slot: 'weapon', effect: { id: 'synthetic-item-' + heroClass, name: 'Kit', flat: { damage: 3, maxHp: 4 } } }])) },
      recovery: { regionId: 'glade', x: 10, y: 13 },
    }], ...overrides,
  };
}
function setup(t, { content = bundle(), randomInt = max => max - 1, path = ':memory:' } = {}) {
  const db = openDatabase(path); migrateDatabase(db); t.after(() => db.close());
  let time = 10000;
  const engine = createAuthoredEngine(db, { content, randomInt, now: () => time });
  function party(id = 'party-one') { db.prepare("INSERT INTO game_parties(id,mode,enemies_json,created_at) VALUES(?,'open','[]',0)").run(id); return id; }
  function hero(userId, partyId = 'party-one', { role = 'customer', heroClass = 'mage', active = true } = {}) {
    db.prepare("INSERT INTO account_users(id,email,password_hash,email_verified_at,role) VALUES(?,?,'hash','2026-01-01',?)").run(userId, userId + '@example.test', role);
    db.prepare('INSERT INTO game_characters(user_id,id,name,hero_class,party_id,active_until) VALUES(?,?,?,?,?,?)').run(userId, 'hero-' + userId, 'Hero' + userId, heroClass, partyId, active ? time + 100000 : 0);
    db.prepare('INSERT INTO game_wallets(user_id,balance_xp,lifetime_xp,balance_copper) VALUES(?,90,150,70)').run(userId);
    engine.joined(userId, partyId, time);
    return userId;
  }
  function visitor(userId, partyId = 'party-one') {
    db.prepare('INSERT INTO game_admin_characters(user_id,id,session_hash,active_until,party_id) VALUES(?,?,?,?,?)').run(userId, 'visitor-' + userId, 'a'.repeat(64), time + 100000, partyId);
  }
  function acquire(userId, sourceId, partyId = 'party-one', eventId = sourceId + ':' + userId) {
    return engine.recordVictory({ sourceId, partyId, eventId, participants: [userId], time });
  }
  function qualify(userId, partyId = 'party-one') {
    for (const source of ['alpha', 'beta', 'gamma']) acquire(userId, source, partyId);
    return db.prepare('SELECT id FROM game_authored_events WHERE party_id=?').get(partyId).id;
  }
  function attack(userId, eventId) { time += 1000; return engine.act(userId, { kind: 'encounterAttack', eventId }, time); }
  return { db, engine, party, hero, visitor, acquire, qualify, attack, time: () => time, tick: (amount = 1000) => { time += amount; return time; } };
}

test('collective proof freezes unmarked and offline accepted friends, not visitors or departed members', t => {
  const f = setup(t); f.party();
  for (const name of ['one', 'two', 'friend', 'departed']) f.hero(name);
  f.hero('admin', 'party-one', { role: 'admin' }); f.visitor('admin');
  f.engine.left('departed', 'party-one');
  f.db.prepare("UPDATE game_characters SET active_until=0 WHERE user_id='friend'").run();
  f.acquire('one', 'alpha'); f.acquire('two', 'beta'); f.acquire('two', 'gamma');
  const roster = f.db.prepare('SELECT user_id,state FROM game_authored_members ORDER BY user_id').all().map(row => ({ ...row }));
  assert.deepEqual(roster, [{ user_id: 'friend', state: 'pending' }, { user_id: 'one', state: 'pending' }, { user_id: 'two', state: 'pending' }]);
  assert.equal(f.engine.resume('friend'), false);
  assert.equal(f.engine.projection('friend'), null);
  assert.equal(f.db.prepare("SELECT COUNT(*) AS n FROM game_source_acquisitions WHERE user_id='friend'").get().n, 0);
  assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM game_authored_claims').get().n, 0);
  assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM game_authored_witnesses').get().n, 0);
  assert.throws(() => f.engine.left('one', 'party-one'), /not available/);
});

test('same source cannot satisfy distinct requirements and membership changes recheck saved proof', t => {
  const f = setup(t); f.party(); f.party('party-two'); f.hero('one'); f.hero('two', 'party-two');
  f.acquire('one', 'alpha'); f.acquire('two', 'beta', 'party-two'); f.acquire('two', 'gamma', 'party-two');
  assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM game_authored_events').get().n, 0);
  f.engine.left('two', 'party-two');
  f.db.prepare("UPDATE game_characters SET party_id='party-one' WHERE user_id='two'").run();
  f.engine.joined('two', 'party-one');
  assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM game_authored_events').get().n, 1);
  f.engine.evaluateParty('party-one'); assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM game_authored_events').get().n, 1);
});

test('accepted offline membership reserves at most eight regular seats and explicit departures free seats', t => {
  const f = setup(t); f.party();
  for (let i = 0; i < 8; i++) f.hero('p' + i, 'party-one', { active: false });
  assert.equal(f.engine.memberCount('party-one'), 8);
  assert.throws(() => f.hero('ninth'), /not available/);
  f.engine.left('p0', 'party-one'); f.engine.joined('ninth', 'party-one');
  assert.equal(f.engine.memberCount('party-one'), 8);
  assert.equal(f.engine.membership('p0'), null);
});

test('source random decisions persist once and successful account entitlement stops later benefit draws', t => {
  let calls = 0;
  const f = setup(t, { randomInt: max => { calls++; return 0; } }); f.party(); f.hero('one');
  f.acquire('one', 'alpha'); assert.equal(calls, 1);
  f.acquire('one', 'alpha'); f.acquire('one', 'alpha', 'party-one', 'different-victory'); assert.equal(calls, 1);
  f.acquire('one', 'beta'); assert.equal(calls, 2, 'only the ordinary effect pool is sampled after entitlement');
  assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM game_benefit_entitlements').get().n, 1);
  assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM game_source_acquisitions').get().n, 2);
  assert.equal(f.db.prepare("SELECT draw_value FROM game_source_acquisitions WHERE source_id='beta'").get().draw_value, null);
  const restarted = createAuthoredEngine(f.db, { content: bundle(), randomInt: () => { throw Error('must not reroll'); } });
  restarted.recordVictory({ sourceId: 'alpha', eventId: 'after-restart', partyId: 'party-one', participants: ['one'], time: f.time() });
});

test('random or proof failures roll back acquisition, entitlement and encounter together', t => {
  const f = setup(t, { randomInt: () => 999 }); f.party(); f.hero('one');
  assert.throws(() => f.acquire('one', 'alpha'), /random sample/);
  for (const table of ['game_source_acquisitions', 'game_benefit_entitlements', 'game_authored_victories', 'game_authored_events']) assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM ' + table).get().n, 0);
});

test('victory acquisition requires present verified ordinary contributors and does not infer party kill credit', t => {
  const f = setup(t); f.party(); f.party('party-two'); f.hero('one'); f.hero('away', 'party-two'); f.hero('offline', 'party-one', { active: false }); f.hero('admin', 'party-one', { role: 'admin' }); f.visitor('admin');
  assert.deepEqual(f.engine.recordVictory({ sourceId: 'alpha', eventId: 'victory-one', partyId: 'party-one', participants: ['one', 'away', 'offline', 'admin'], time: f.time() }), ['one']);
  assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM game_source_acquisitions').get().n, 1);
  assert.deepEqual(f.engine.recordVictory({ sourceId: 'alpha', eventId: 'victory-one', partyId: 'party-one', participants: ['offline'], time: f.time() }), ['one']);
});

test('combat claims are acquired only at actual combat start and survive reconnect and restarts', t => {
  const f = setup(t); f.party(); f.hero('one'); const eventId = f.qualify('one');
  f.engine.resume('one'); f.engine.projection('one');
  assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM game_authored_claims').get().n, 0);
  assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM game_authored_witnesses WHERE witnessed_at IS NOT NULL').get().n, 0);
  f.attack('one', eventId);
  assert.equal(f.db.prepare('SELECT event_id FROM game_authored_claims').get().event_id, eventId);
  const restarted = createAuthoredEngine(f.db, { content: bundle(), now: f.time }); restarted.resume('one');
  assert.equal(restarted.projection('one').encounter.phase, 'combat');
  assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM game_authored_claims').get().n, 1);
});

test('resolution needs actual acknowledgement, persists class-bound ownership and recovers without resetting progress', t => {
  const f = setup(t); f.party(); f.hero('one'); const eventId = f.qualify('one');
  const wallets = f.db.prepare('SELECT * FROM game_wallets').all();
  f.attack('one', eventId); f.attack('one', eventId);
  assert.equal(f.engine.projection('one').encounter.phase, 'resolution');
  assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM game_owned_equipment').get().n, 0);
  assert.throws(() => f.engine.act('one', { kind: 'encounterContinue', eventId, sceneKey: 'arrival' }), /not available/);
  f.engine.act('one', { kind: 'encounterContinue', eventId, sceneKey: 'victory' });
  assert.equal(f.engine.isLocked('one'), false);
  const item = f.db.prepare('SELECT * FROM game_owned_equipment').get(); assert.equal(item.hero_class, 'mage');
  f.engine.act('one', { kind: 'equip', itemId: item.id });
  assert.equal(f.engine.combat('one', { damage: 10 }).damage, 13);
  f.engine.act('one', { kind: 'equip', itemId: item.id }); assert.equal(f.engine.combat('one', { damage: 10 }).damage, 13);
  assert.throws(() => f.engine.act('one', { kind: 'equip', itemId: 'forged' }), /not available/);
  f.db.prepare("UPDATE game_characters SET hero_class='ranger' WHERE user_id='one'").run();
  assert.throws(() => f.engine.act('one', { kind: 'equip', itemId: item.id }), /not available/);
  assert.equal(f.engine.combat('one', { damage: 10 }).damage, 10);
  assert.deepEqual(f.db.prepare('SELECT * FROM game_wallets').all(), wallets);
  assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM game_source_acquisitions').get().n, 3);
  assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM game_owned_equipment').get().n, 1);
  assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM game_authored_witnesses WHERE witnessed_at IS NOT NULL').get().n, 1);
});

test('pending friend receives neither automatic combat nor witness; return resumes the current scene', t => {
  const f = setup(t); f.party(); f.hero('one'); f.hero('friend');
  f.db.prepare("UPDATE game_characters SET active_until=0 WHERE user_id='friend'").run();
  const eventId = f.qualify('one'); f.attack('one', eventId); f.attack('one', eventId);
  f.engine.act('one', { kind: 'encounterContinue', eventId, sceneKey: 'victory' });
  assert.equal(f.db.prepare("SELECT state FROM game_authored_members WHERE user_id='friend'").get().state, 'pending');
  assert.equal(f.db.prepare("SELECT COUNT(*) AS n FROM game_authored_witnesses WHERE user_id='friend'").get().n, 0);
  assert.equal(f.db.prepare("SELECT COUNT(*) AS n FROM game_owned_equipment WHERE user_id='friend'").get().n, 0);
  f.db.prepare("UPDATE game_characters SET active_until=? WHERE user_id='friend'").run(f.time() + 10000);
  f.engine.resume('friend'); assert.equal(f.engine.projection('friend').encounter.sceneKey, 'victory');
  f.engine.act('friend', { kind: 'encounterContinue', eventId, sceneKey: 'victory' });
  assert.equal(f.db.prepare("SELECT COUNT(*) AS n FROM game_owned_equipment WHERE user_id='friend'").get().n, 1);
  assert.equal(f.db.prepare("SELECT COUNT(*) AS n FROM game_source_acquisitions WHERE user_id='friend'").get().n, 0);
  assert.equal(f.db.prepare('SELECT phase FROM game_authored_events').get().phase, 'complete');
});

test('disconnect is never a defeat and source proof stays immutable through reconfiguration', t => {
  const content = bundle(); delete content.encounters[0].initialCombat; content.encounters[0].combat.damage = 100;
  const f = setup(t, { content }); f.party(); f.hero('one'); f.hero('friend'); const eventId = f.qualify('one');
  f.attack('one', eventId);
  assert.equal(f.engine.projection('one').encounter.state, 'downed');
  assert.equal(f.db.prepare('SELECT phase FROM game_authored_events').get().phase, 'combat');
  const changed = bundle(); changed.encounters[0].scenes.arrival.text = 'Not the same version';
  const restarted = createAuthoredEngine(f.db, { content: changed, now: f.time }); restarted.resume('friend');
  assert.equal(restarted.projection('friend').encounter.text, 'You entered a chamber.');
});

test('stable aggregation covers durability, support and resources without multiplying rate or money', () => {
  const base = { maxHp: 100, damage: 20, healing: 10, ward: 8, armor: 3, resourceMax: 10, resourceRegen: 2, cooldownMs: 700, balanceXp: 500, balanceCopper: 700 };
  const effects = [{ id: 'vigor', name: 'Vigor', scale: { maxHp: 1.5, damage: 1.5, healing: 1.5, ward: 1.5, resourceMax: 1.5, resourceRegen: 1.5 } }, { id: 'kit', name: 'Kit', flat: { damage: 4 } }];
  const stats = aggregateCombatStats(base, effects);
  assert.deepEqual(stats, { maxHp: 150, damage: 36, healing: 15, ward: 12, armor: 3, resourceMax: 15, resourceRegen: 3, cooldownMs: 700 });
  assert.deepEqual(aggregateCombatStats(base, [...effects].reverse()), stats);
  assert.throws(() => aggregateCombatStats(base, [{ id: 'bad', name: 'Bad', flat: { balanceXp: 100 } }]), /combat effect/);
  assert.equal(aggregateCombatStats({ cooldownMs: 1000 }, [{ id: 'slow', name: 'Slow', cooldownScale: 1.1 }]).cooldownMs, 1100);
});

test('all engine mutations compose inside an existing transaction and rollback together', t => {
  const f = setup(t); f.party(); f.hero('one');
  assert.throws(() => transaction(f.db, () => { f.acquire('one', 'alpha'); throw Error('outer rollback'); }), /outer rollback/);
  assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM game_source_acquisitions').get().n, 0);
});

test('empty configuration exposes no future catalog and private loader refuses public/insecure files', t => {
  const f = setup(t, { content: undefined }); // explicit disabled engine separately
  const engine = createAuthoredEngine(f.db); f.party(); f.hero('one');
  assert.equal(engine.projection('one'), null); assert.equal(engine.evaluateParty('party-one'), null);
  const folder = mkdtempSync(join(tmpdir(), 'ef-authoring-')); t.after(() => rmSync(folder, { recursive: true, force: true }));
  const file = join(folder, 'bundle.json'); writeFileSync(file, JSON.stringify(bundle()), { mode: 0o600 });
  assert.equal(loadAuthoredContent(file).version, 'synthetic-v1');
  chmodSync(file, 0o644); assert.throws(() => loadAuthoredContent(file), /private regular file/);
  assert.throws(() => loadAuthoredContent(new URL('../package.json', import.meta.url)), /outside the source/);
  const invalid = bundle(); invalid.encounters[0].recovery.regionId = 'unconfigured'; assert.throws(() => validateAuthoredContent(invalid), /recovery/);
});

test('competing database writers select one durable initial combat owner', async t => {
  const folder = mkdtempSync(join(tmpdir(), 'ef-authored-race-')); t.after(() => rmSync(folder, { recursive: true, force: true }));
  const path = join(folder, 'race.db'); const f = setup(t, { path });
  f.party(); f.party('party-two'); f.hero('one'); f.hero('two', 'party-two');
  const events = [f.qualify('one'), f.qualify('two', 'party-two')];
  const workerPath = join(folder, 'race.mjs');
  writeFileSync(workerPath, `import {parentPort,workerData} from 'node:worker_threads';\nimport {openDatabase} from ${JSON.stringify(new URL('../server/database.mjs', import.meta.url).href)};\nimport {createAuthoredEngine} from ${JSON.stringify(new URL('../server/authored-engine.mjs', import.meta.url).href)};\nconst db=openDatabase(workerData.path);const e=createAuthoredEngine(db,{content:workerData.content});parentPort.postMessage('ready');parentPort.once('message',()=>{try{e.act(workerData.userId,{kind:'encounterAttack',eventId:workerData.eventId},12000);parentPort.postMessage('done');}catch(error){parentPort.postMessage({error:error.message});}finally{db.close();}});`);
  const workers = ['one', 'two'].map((userId, index) => new Worker(workerPath, { workerData: { userId, eventId: events[index], path, content: bundle() } }));
  t.after(async () => { await Promise.all(workers.map(worker => worker.terminate())); });
  await Promise.all(workers.map(worker => new Promise((resolve, reject) => { worker.once('message', resolve); worker.once('error', reject); })));
  const outcomes = workers.map(worker => new Promise((resolve, reject) => { worker.once('message', resolve); worker.once('error', reject); }));
  workers.forEach(worker => worker.postMessage('go'));
  assert.deepEqual(await Promise.all(outcomes), ['done', 'done']);
  assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM game_authored_claims').get().n, 1);
  assert.deepEqual(f.db.prepare('SELECT claim_kind FROM game_authored_events ORDER BY claim_kind').all().map(row => row.claim_kind), ['initial', 'repeat']);
});

test('a configured staged defeat finishes for low-health participants without fabricating offline combat', t => {
  const content = bundle(); content.encounters[0].initialCombat.outcome = 'defeat'; content.encounters[0].initialCombat.resolveAfterActions = 9; content.encounters[0].initialCombat.damage = 30; content.encounters[0].grant.when = 'initial-defeat';
  const f = setup(t, { content }); f.party(); f.hero('one'); f.hero('friend');
  f.db.prepare("UPDATE game_characters SET active_until=0 WHERE user_id='friend'").run();
  const eventId = f.qualify('one'); f.db.prepare("UPDATE game_characters SET hp=1 WHERE user_id='one'").run();
  f.attack('one', eventId);
  assert.equal(f.db.prepare('SELECT outcome FROM game_authored_events').get().outcome, 'defeat');
  assert.equal(f.db.prepare("SELECT state FROM game_authored_members WHERE user_id='friend'").get().state, 'pending');
  assert.equal(f.db.prepare("SELECT hp FROM game_characters WHERE user_id='friend'").get().hp, 100);
  assert.equal(f.db.prepare("SELECT COUNT(*) AS n FROM game_authored_witnesses WHERE user_id='friend'").get().n, 0);
  f.engine.act('one', { kind: 'encounterContinue', eventId, sceneKey: 'defeat' });
  assert.equal(f.db.prepare("SELECT COUNT(*) AS n FROM game_owned_equipment WHERE user_id='one'").get().n, 1);
});

test('oversized attacks cannot resolve an authored action sequence early or expose a dead enemy', t => {
  const content = bundle(); content.encounters[0].initialCombat.outcome = 'defeat';
  const f = setup(t, { content }); f.party(); f.hero('one'); const eventId = f.qualify('one');
  f.db.prepare("UPDATE game_wallets SET lifetime_xp=1000000 WHERE user_id='one'").run();
  f.attack('one', eventId);
  assert.equal(f.engine.projection('one').encounter.phase, 'combat'); assert.equal(f.engine.projection('one').encounter.enemyHp, 1);
  f.attack('one', eventId); assert.equal(f.db.prepare('SELECT outcome FROM game_authored_events').get().outcome, 'defeat');
});

test('projections have no writes and disclose only the current scene to admitted owner', t => {
  const f = setup(t); f.party(); f.hero('one'); f.hero('newcomer'); const eventId = f.qualify('one');
  const before = f.db.prepare('SELECT total_changes() AS n').get().n;
  f.engine.projection('newcomer'); f.engine.projection('one');
  assert.equal(f.db.prepare('SELECT total_changes() AS n').get().n, before);
  f.engine.resume('one');
  const own = JSON.stringify(f.engine.projection('one'));
  assert.ok(own.includes('You entered a chamber.')); assert.ok(!own.includes('The chamber is quiet.'));
  assert.ok(!own.includes('requiresSources')); assert.ok(!own.includes('denominator')); assert.ok(!own.includes('synthetic-opening'));
  assert.equal(f.engine.projection('newcomer'), null);
  assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM game_authored_witnesses WHERE witnessed_at IS NOT NULL').get().n, 0);
  assert.equal(f.engine.isLocked('newcomer'), true);
  assert.equal(f.db.prepare('SELECT id FROM game_authored_events').get().id, eventId);
});

test('downed ordinary participants may explicitly recover without abandoning companions or resetting claims', t => {
  const content = bundle(); delete content.encounters[0].initialCombat; content.encounters[0].combat.hp = 1000; content.encounters[0].combat.damage = 100;
  const f = setup(t, { content }); f.party(); f.hero('one'); f.hero('friend'); const eventId = f.qualify('one');
  f.attack('one', eventId); assert.equal(f.engine.projection('one').encounter.canRecover, true);
  const claim = f.db.prepare('SELECT * FROM game_authored_claims').get();
  f.engine.act('one', { kind: 'encounterReturn', eventId });
  assert.equal(f.engine.isLocked('one'), false); assert.equal(f.engine.isLocked('friend'), true);
  assert.deepEqual(f.db.prepare('SELECT * FROM game_authored_claims').get(), claim);
  assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM game_owned_equipment').get().n, 0);
  assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM game_authored_witnesses WHERE witnessed_at IS NOT NULL').get().n, 0);
  assert.equal(f.db.prepare("SELECT hp FROM game_characters WHERE user_id='one'").get().hp, 97);
});

test('encounter party healing uses derived output and only active admitted same-event allies', t => {
  const f = setup(t); f.party(); f.hero('healer', 'party-one', { heroClass: 'cleric' }); f.hero('ally'); f.hero('pending'); f.hero('offline');
  const eventId = f.qualify('healer'); f.engine.resume('healer'); f.engine.resume('ally'); f.engine.resume('offline');
  f.db.prepare("UPDATE game_characters SET hp=10 WHERE user_id IN ('ally','pending','offline')").run();
  f.db.prepare("UPDATE game_characters SET active_until=0 WHERE user_id='offline'").run();
  f.db.prepare('INSERT INTO game_combat_effects(user_id,effect_key,definition_json,acquired_at) VALUES(?,?,?,0)').run('healer', 'synthetic-support', JSON.stringify({ id: 'support', name: 'Support', scale: { healing: 1.5 } }));
  f.engine.act('healer', { kind: 'encounterSkill', eventId, skillId: 'sanctuary' });
  assert.equal(f.db.prepare("SELECT hp FROM game_characters WHERE user_id='ally'").get().hp, 55);
  for (const userId of ['pending', 'offline']) assert.equal(f.db.prepare('SELECT hp FROM game_characters WHERE user_id=?').get(userId).hp, 10);
  assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM game_authored_claims').get().n, 0, 'healing is not combat start');
  assert.throws(() => f.engine.act('healer', { kind: 'encounterSkill', eventId, skillId: 'sanctuary' }), /not available/);
  const projected = f.engine.projection('healer').encounter.skills.find(skill => skill.id === 'sanctuary');
  assert.equal(projected.readyAt, f.time() + 16000);
});

test('encounter class wards absorb retaliation and persist their skill cooldown without financial effects', t => {
  const content = bundle(); delete content.encounters[0].initialCombat; content.encounters[0].combat.hp = 1000; content.encounters[0].combat.damage = 20;
  const f = setup(t, { content }); f.party(); f.hero('one', 'party-one', { heroClass: 'knight' }); const eventId = f.qualify('one');
  f.db.prepare('INSERT INTO game_combat_effects(user_id,effect_key,definition_json,acquired_at) VALUES(?,?,?,0)').run('one', 'synthetic-ward', JSON.stringify({ id: 'guard', name: 'Guard', scale: { ward: 1.5 } }));
  f.engine.act('one', { kind: 'encounterSkill', eventId, skillId: 'lantern-ward' });
  assert.equal(f.db.prepare("SELECT ward_amount FROM game_characters WHERE user_id='one'").get().ward_amount, 36);
  f.attack('one', eventId);
  const row = f.db.prepare("SELECT * FROM game_characters WHERE user_id='one'").get();
  assert.equal(row.hp, 97); assert.equal(row.ward_amount, 19);
  assert.equal(JSON.parse(row.skill_cooldowns_json)['lantern-ward'], 26000);
  assert.throws(() => f.engine.act('one', { kind: 'encounterSkill', eventId, skillId: 'sanctuary' }), /not available/);
  f.tick(1000); f.engine.act('one', { kind: 'encounterSkill', eventId, skillId: 'oathbound-strike' });
  assert.equal(f.db.prepare('SELECT enemy_hp FROM game_authored_events').get().enemy_hp, 940);
  assert.equal(f.db.prepare("SELECT balance_xp FROM game_wallets WHERE user_id='one'").get().balance_xp, 90);
});

test('guarded and focused stances preserve their incoming tradeoff in authored combat', t => {
  const content = bundle(); delete content.encounters[0].initialCombat; content.encounters[0].combat.hp = 1000; content.encounters[0].combat.damage = 20;
  const f = setup(t, { content }); f.party(); f.party('party-two'); f.hero('guard'); f.hero('focus', 'party-two');
  const guardEvent = f.qualify('guard'); const focusEvent = f.qualify('focus', 'party-two');
  f.db.prepare("UPDATE game_characters SET battle_stance='guarded' WHERE user_id='guard'").run();
  f.db.prepare("UPDATE game_characters SET battle_stance='focused' WHERE user_id='focus'").run();
  f.attack('guard', guardEvent); f.attack('focus', focusEvent);
  assert.equal(f.db.prepare("SELECT hp FROM game_characters WHERE user_id='guard'").get().hp, 80);
  assert.equal(f.db.prepare("SELECT hp FROM game_characters WHERE user_id='focus'").get().hp, 76);
});

test('early recovery from a staged opening retains frozen membership and subsequent canonical entitlement', t => {
  const content = bundle(); content.encounters[0].initialCombat.outcome = 'defeat'; content.encounters[0].initialCombat.damage = 30; content.encounters[0].initialCombat.resolveAfterActions = 9; content.encounters[0].grant.when = 'initial-defeat';
  const f = setup(t, { content }); f.party(); f.hero('one'); f.hero('friend'); f.hero('offline');
  f.db.prepare("UPDATE game_characters SET active_until=0 WHERE user_id='offline'").run();
  const eventId = f.qualify('one'); f.engine.resume('friend'); f.db.prepare("UPDATE game_characters SET hp=1 WHERE user_id='one'").run();
  f.attack('one', eventId); assert.equal(f.engine.projection('one').encounter.phase, 'combat');
  f.engine.act('one', { kind: 'encounterReturn', eventId });
  assert.equal(f.engine.projection('one').encounter.phase, 'resolution'); assert.equal(f.engine.isLocked('one'), true);
  assert.equal(f.db.prepare("SELECT state FROM game_authored_members WHERE user_id='one'").get().state, 'resolved');
  assert.equal(f.db.prepare("SELECT state FROM game_authored_members WHERE user_id='offline'").get().state, 'pending');
  assert.equal(f.db.prepare("SELECT hp FROM game_characters WHERE user_id='offline'").get().hp, 100);
  assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM game_owned_equipment').get().n, 0);
  assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM game_authored_witnesses WHERE witnessed_at IS NOT NULL').get().n, 0);
  f.engine.act('one', { kind: 'encounterContinue', eventId, sceneKey: 'defeat' });
  assert.equal(f.db.prepare("SELECT COUNT(*) AS n FROM game_owned_equipment WHERE user_id='one'").get().n, 1);
  f.engine.act('friend', { kind: 'encounterContinue', eventId, sceneKey: 'defeat' });
  assert.equal(f.db.prepare("SELECT COUNT(*) AS n FROM game_owned_equipment WHERE user_id='friend'").get().n, 1);
});

test('admission preserves the previous location attack budget before claiming combat', t => {
  const f = setup(t); f.party(); f.hero('one'); const eventId = f.qualify('one');
  f.db.prepare("UPDATE game_characters SET last_attack_at=? WHERE user_id='one'").run(f.time());
  assert.throws(() => f.engine.act('one', { kind: 'encounterAttack', eventId }), /not available/);
  assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM game_authored_claims').get().n, 0);
  f.tick(500); f.engine.act('one', { kind: 'encounterAttack', eventId });
  assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM game_authored_claims').get().n, 1);
  assert.equal(f.db.prepare("SELECT last_attack_at FROM game_characters WHERE user_id='one'").get().last_attack_at, f.time());
});

test('large valid lifetime-derived combat output is unchanged without effects', () => {
  const lifetimeXp = 100000000000;
  const damage = 18 + Math.floor(lifetimeXp / 100) * 2;
  const base = { damage, healing: 3000001, armor: 4000001, maxHp: 100, ward: 24 };
  assert.deepEqual(aggregateCombatStats(base), base);
  assert.equal(aggregateCombatStats({ damage: Number.MAX_SAFE_INTEGER }).damage, Number.MAX_SAFE_INTEGER);
});

test('effect overflow saturates to safe integers while health and wards retain storage bounds', () => {
  const boost = { id: 'synthetic-large', name: 'Large', scale: { damage: 10, healing: 10, armor: 10, maxHp: 10, ward: 10 } };
  const result = aggregateCombatStats({ damage: Number.MAX_SAFE_INTEGER, healing: Number.MAX_SAFE_INTEGER, armor: Number.MAX_SAFE_INTEGER, maxHp: 1000000, ward: 1000000 }, [boost]);
  assert.deepEqual(result, { damage: Number.MAX_SAFE_INTEGER, healing: Number.MAX_SAFE_INTEGER, armor: Number.MAX_SAFE_INTEGER, maxHp: 1000000, ward: 1000000 });
  assert.ok(Object.values(result).every(Number.isSafeInteger));
  assert.throws(() => aggregateCombatStats({ damage: Number.MAX_SAFE_INTEGER + 1 }), /base combat stat/);
  const many = Array.from({ length: 400 }, (_, index) => ({ id: 'synthetic-' + index, name: 'Large', scale: { damage: 10 } }));
  assert.equal(aggregateCombatStats({ damage: 0 }, many).damage, 0);
  assert.equal(aggregateCombatStats({ damage: 1 }, many).damage, Number.MAX_SAFE_INTEGER);
});

test('an administrator ordinary hero follows normal evidence, combat and one-time equipment rules', t => {
  const f = setup(t); f.party(); f.hero('adminhero', 'party-one', { role: 'admin' });
  f.db.prepare('INSERT INTO admin_account_settings(user_id,testing_enabled,test_xp,test_copper) VALUES(?,1,?,?)').run('adminhero', Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER);
  const settings = f.db.prepare('SELECT * FROM admin_account_settings').all();
  const wallet = f.db.prepare('SELECT * FROM game_wallets').all();
  assert.equal(f.engine.evaluateParty('party-one'), null, 'administrator status cannot substitute for earned proof');
  const eventId = f.qualify('adminhero'); f.tick(1000);
  f.engine.act('adminhero', { kind: 'encounterAttack', eventId, damage: 999999, heroClass: 'death-knight', is_admin: true });
  assert.equal(f.db.prepare('SELECT enemy_hp FROM game_authored_events').get().enemy_hp, 20, 'ordinary mage attack uses real lifetime XP, never test balances');
  assert.equal(f.db.prepare('SELECT user_id,hero_class FROM game_authored_members').get().hero_class, 'mage');
  f.visitor('adminhero');
  assert.equal(f.engine.resume('adminhero'), false); assert.equal(f.engine.projection('adminhero'), null);
  assert.throws(() => f.engine.act('adminhero', { kind: 'encounterAttack', eventId }), /not available/);
  assert.throws(() => f.engine.act('adminhero', { kind: 'encounterContinue', eventId, sceneKey: 'victory' }), /not available/);
  assert.deepEqual(f.acquire('adminhero', 'alpha', 'party-one', 'visitor-attempt'), []);
  assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM game_owned_equipment').get().n, 0);
  assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM game_authored_claims').get().n, 1);
  f.db.prepare("UPDATE game_admin_characters SET active_until=0 WHERE user_id='adminhero'").run();
  f.attack('adminhero', eventId);
  f.engine.act('adminhero', { kind: 'encounterContinue', eventId, sceneKey: 'victory' });
  assert.throws(() => f.engine.act('adminhero', { kind: 'encounterContinue', eventId, sceneKey: 'victory' }), /not available/);
  const item = f.db.prepare('SELECT * FROM game_owned_equipment').get();
  assert.equal(item.hero_class, 'mage'); assert.equal(item.user_id, 'adminhero');
  assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM game_owned_equipment').get().n, 1);
  assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM game_source_acquisitions').get().n, 3);
  assert.deepEqual(f.db.prepare('SELECT * FROM admin_account_settings').all(), settings);
  assert.deepEqual(f.db.prepare('SELECT * FROM game_wallets').all(), wallet);
});

test('privileged avatars cannot provide collective proof or consume global combat ownership', t => {
  const f = setup(t); f.party(); f.hero('adminhero', 'party-one', { role: 'admin' }); f.hero('friend');
  f.acquire('adminhero', 'alpha'); f.acquire('adminhero', 'beta');
  f.visitor('adminhero'); f.acquire('friend', 'gamma');
  assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM game_authored_events').get().n, 0);
  assert.deepEqual(f.acquire('adminhero', 'gamma'), []);
  assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM game_authored_claims').get().n, 0);
  f.db.prepare("UPDATE game_admin_characters SET active_until=0 WHERE user_id='adminhero'").run();
  const eventId = f.engine.evaluateParty('party-one'); assert.ok(eventId);
  const roster = f.db.prepare('SELECT user_id,hero_class FROM game_authored_members ORDER BY user_id').all();
  assert.deepEqual(roster.map(row => row.user_id), ['adminhero', 'friend']);
  assert.ok(roster.every(row => row.hero_class === 'mage'));
  f.visitor('friend');
  assert.throws(() => f.engine.act('friend', { kind: 'encounterAttack', eventId }), /not available/);
  assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM game_authored_claims').get().n, 0);
  f.attack('adminhero', eventId); assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM game_authored_claims').get().n, 1);
});
