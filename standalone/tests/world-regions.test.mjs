import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Readable } from 'node:stream';
import { EventEmitter } from 'node:events';
import { createGameService } from '../server/game.mjs';
import { digest, migrateDatabase, openDatabase, SCHEMA_VERSION } from '../server/database.mjs';
import { readFileSync } from 'node:fs';
import { REGIONS, regionWalkable } from '../shared/world-catalog.mjs';
import { fixture, verifiedAccount, loginCookie } from './helpers.mjs';

function harness(t, { random = () => 0, sseIntervalMs = 15000 } = {}) {
  const f = fixture(t);
  let clock = Date.now();
  const makeService = () => createGameService(f.db, { origin: f.origin, now: () => clock, random, sseIntervalMs });
  let service = makeService();
  t.after(() => service.close());
  function request(path, data, cookie) {
    const req = Readable.from(data === undefined ? [] : [JSON.stringify(data)]);
    req.method = data === undefined ? 'GET' : 'POST';
    req.url = path;
    req.headers = { origin: f.origin, 'content-type': 'application/json', cookie };
    req.socket = { remoteAddress: '127.0.0.1' };
    return req;
  }
  async function game(actor, path, data) {
    const result = {};
    const res = new EventEmitter();
    res.writeHead = (status, headers) => Object.assign(result, { status, headers });
    res.end = body => { result.body = body ? JSON.parse(body) : null; res.emit('close'); };
    assert.equal(await service.route(request(path, data, actor.cookie), res, path), true);
    actor.last = result;
    if (result.status === 200 && result.body.profile) {
      actor.partyId = result.body.profile.partyId;
      actor.playerId = result.body.profile.playerId;
    }
    return result;
  }
  async function account(name, heroClass = 'ranger', { join = true, mode = 'open', admin = false } = {}) {
    const details = { email: name.toLowerCase() + '@example.test', password: 'a-good-test-passphrase-123' };
    await verifiedAccount(f, details);
    const actor = { name, heroClass, details, cookie: await loginCookie(f, details), partyId: null, playerId: null };
    actor.userId = f.db.prepare('SELECT id FROM account_users WHERE email=?').get(details.email).id;
    if (admin) f.db.prepare("UPDATE account_users SET role='admin' WHERE id=?").run(actor.userId);
    if (join) await enter(actor, { mode });
    return actor;
  }
  function enter(actor, extra = {}, requestId = randomUUID()) {
    return game(actor, '/api/game/join', { requestId, name: actor.name, heroClass: actor.heroClass, ...extra });
  }
  function visit(actor, extra = {}, requestId = randomUUID()) {
    return game(actor, '/api/game/admin/join', { requestId, ...extra });
  }
  function action(actor, kind, extra = {}, requestId = randomUUID(), advance = 800) {
    clock += advance;
    return game(actor, '/api/game/action', { requestId, partyId: actor.partyId, kind, ...extra });
  }
  function leave(actor) {
    return game(actor, '/api/game/leave', { requestId: randomUUID(), partyId: actor.partyId });
  }
  function world(actor) { return game(actor, '/api/game/world'); }
  function position(actor, x, y, hp) {
    const table = actor.last?.body?.profile?.adminActive ? 'game_admin_characters' : 'game_characters';
    f.db.prepare('UPDATE ' + table + ' SET x=?,y=?' + (hp === undefined ? '' : ',hp=?') + ' WHERE user_id=?')
      .run(...(hp === undefined ? [x, y, actor.userId] : [x, y, hp, actor.userId]));
  }
  function events(actor) {
    const res = new EventEmitter();
    const stream = { chunks: [], ended: false };
    res.writeHead = () => {};
    res.write = value => { stream.chunks.push(String(value)); return true; };
    res.end = value => { if (value) stream.chunks.push(String(value)); stream.ended = true; res.emit('close'); };
    stream.close = () => res.emit('close');
    stream.start = service.route(request('/api/game/events', undefined, actor.cookie), res, '/api/game/events');
    return stream;
  }
  return { ...f, game, account, enter, visit, action, leave, world, position, events,
    advance(ms) { clock += ms; },
    restart() { service.close(); service = makeService(); },
  };
}
function ok(result) { assert.equal(result.status, 200, JSON.stringify(result.body)); return result.body; }
function enemy(result, id = 'bramble') { return result.realm.enemies.find(row => row.id === id); }

function region(h, actor, id, x = 17, y = 8, hp = 100) {
  h.db.prepare('UPDATE game_characters SET region_id=?,x=?,y=?,hp=? WHERE user_id=?').run(id, x, y, hp, actor.userId);
}

test('region exits and arrivals are passable and connect all three regions', () => {
  const reached = new Set(['glade']);
  for (const id of reached) for (const exit of REGIONS[id].exits) {
    assert.ok(regionWalkable(id, exit.x, exit.y));
    assert.ok(regionWalkable(exit.to, exit.arrival.x, exit.arrival.y));
    reached.add(exit.to);
  }
  assert.equal(reached.size, 3);
});

test('physical travel is per-character, guarded, replay-safe and persistent', async t => {
  const h = harness(t); const first = await h.account('Traveler'); const second = await h.account('StaysHome');
  assert.equal((await h.action(first, 'travel', { exitId: 'east-trail' })).body.code, 'EXIT_TOO_FAR');
  h.position(first, 27, 13);
  const requestId = randomUUID();
  const travel = ok(await h.action(first, 'travel', { exitId: 'east-trail', regionId: 'glade' }, requestId));
  assert.equal(travel.profile.character.regionId, 'amberReach');
  assert.equal(travel.realm.region.id, 'amberReach');
  assert.equal(travel.profile.partyId, second.partyId);
  assert.equal(travel.realm.players.find(p => p.id === second.playerId).regionId, 'glade');
  assert.ok(travel.realm.enemies.every(e => e.regionId === 'amberReach'));
  assert.equal(ok(await h.action(first, 'travel', { exitId: 'east-trail', regionId: 'glade' }, requestId)).profile.character.regionId, 'amberReach');
  assert.equal((await h.action(first, 'move', { x: 3, y: 13, regionId: 'glade' })).body.code, 'REGION_CHANGED');
  assert.equal((await h.action(first, 'travel', { exitId: 'east-trail' })).body.code, 'EXIT_TOO_FAR');
  h.restart();
  assert.equal(ok(await h.world(first)).profile.character.regionId, 'amberReach');
  h.position(first, 27, 13);
  assert.equal(ok(await h.action(first, 'travel', { exitId: 'coastal-steps' })).profile.character.regionId, 'mistHarbor');
  h.position(first, 2, 13);
  ok(await h.action(first, 'travel', { exitId: 'ridge-steps' }));
  h.position(first, 2, 13);
  assert.equal(ok(await h.action(first, 'travel', { exitId: 'west-trail' })).profile.character.regionId, 'glade');
});

test('region-local attack, effects, healing and contributions do not cross identical coordinates', async t => {
  const h = harness(t); const bard = await h.account('RegionalBard', 'bard'); const other = await h.account('FarHero', 'knight');
  region(h, bard, 'glade', 17, 8, 50); region(h, other, 'amberReach', 17, 8, 50);
  ok(await h.action(bard, 'skill', { skillId: 'song-of-mending' }));
  assert.equal(ok(await h.world(other)).profile.character.hp, 50);
  ok(await h.action(bard, 'attack'));
  const far = ok(await h.world(other));
  assert.equal(far.realm.enemies.find(e => e.id === 'amberReach:ridge').hp, 42);
  assert.equal(far.realm.effects.length, 0);
  // Genuine damage from a contributor who left this region must not reward remotely.
  region(h, bard, 'amberReach', 17, 8);
  region(h, other, 'glade', 17, 8);
  ok(await h.action(other, 'attack')); ok(await h.action(other, 'attack'));
  assert.equal(ok(await h.world(bard)).profile.lifetimeXp, 0);
  assert.equal(ok(await h.world(other)).profile.lifetimeXp, 15);
});

test('new-region combat earns normal contributions but never advances the original quest', async t => {
  const h = harness(t); const hero = await h.account('ReachKnight', 'knight');
  region(h, hero, 'amberReach');
  ok(await h.action(hero, 'attack')); const kill = ok(await h.action(hero, 'attack'));
  assert.equal(kill.profile.lifetimeXp, 15); assert.equal(kill.profile.character.kills, 0);
  h.position(hero, 23, 5, 50);
  const shrine = ok(await h.action(hero, 'interact'));
  assert.equal(shrine.profile.character.hp, 100); assert.equal(shrine.profile.character.shrine, false);
  assert.deepEqual(shrine.profile.character.gathered, []);
  assert.equal(shrine.profile.lifetimeXp, 15);
  assert.notEqual((await h.action(hero, 'claim')).status, 200);
});

test('knockout returns to the current region camp with progress intact', async t => {
  const h = harness(t); const hero = await h.account('CoastRanger');
  region(h, hero, 'mistHarbor', 17, 8, 1);
  const hit = ok(await h.action(hero, 'attack'));
  assert.equal(hit.profile.character.regionId, 'mistHarbor');
  assert.equal(hit.profile.character.hp, 100);
  assert.equal(hit.profile.character.x, REGIONS.mistHarbor.spawn.x);
  assert.equal(hit.profile.character.y, REGIONS.mistHarbor.spawn.y);
});

test('visitors join the host region and cannot attack an empty region for scaled rewards', async t => {
  const h = harness(t); const hero = await h.account('CoastHost'); region(h, hero, 'mistHarbor');
  const admin = await h.account('CoastVisitor', 'ranger', { join: false, admin: true });
  const visit = ok(await h.visit(admin));
  assert.equal(visit.profile.character.regionId, 'mistHarbor');
  assert.equal(visit.profile.character.x, 17);
  h.db.prepare("UPDATE game_admin_characters SET region_id='amberReach' WHERE user_id=?").run(admin.userId);
  assert.equal((await h.action(admin, 'attack')).body.code, 'REGION_NO_HERO');
  assert.equal(h.db.prepare('SELECT COUNT(*) AS n FROM game_wallets WHERE user_id=?').get(admin.userId).n, 0);
});

test('schema 6 upgrade retains old coordinates, rewards, enemies and account state exactly', t => {
  const db = openDatabase(':memory:'); t.after(() => db.close());
  db.exec('CREATE TABLE schema_migrations(version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)');
  db.exec(readFileSync(new URL('../server/schema.sql', import.meta.url), 'utf8'));
  db.exec(readFileSync(new URL('../server/accounts-schema.sql', import.meta.url), 'utf8'));
  for (const file of ['002-account-mail','003-game-stash','004-class-chronicle','005-party-visitors','006-admin-testing']) {
    db.exec(readFileSync(new URL('../server/migrations/' + file + '.sql', import.meta.url), 'utf8'));
  }
  db.exec('INSERT INTO schema_migrations(version) VALUES(1),(2),(3),(4),(5),(6)');
  db.exec("INSERT INTO account_users(id,email,password_hash,email_verified_at) VALUES('keeper','keeper@example.test','hash','2026-01-01')");
  db.exec("INSERT INTO game_characters(user_id,id,name,hero_class,x,y,kills,gathered_json,shrine,claimed,party_id) VALUES('keeper','keeper','Keeper','ranger',24,5,9,'[\"moon\",\"fern\"]',1,1,'legacy-mossvale')");
  db.exec("INSERT INTO game_wallets(user_id,balance_xp,lifetime_xp,balance_copper) VALUES('keeper',50,1300,1000)");
  const old = db.prepare('SELECT * FROM game_characters').get();
  const wallet = db.prepare('SELECT * FROM game_wallets').get();
  const enemies = JSON.parse(db.prepare('SELECT enemies_json FROM game_parties').get().enemies_json);
  enemies[0].hp = 17;
  db.prepare('UPDATE game_parties SET enemies_json=?').run(JSON.stringify(enemies));
  migrateDatabase(db);
  const row = db.prepare('SELECT * FROM game_characters').get();
  for (const [key, value] of Object.entries(old)) assert.deepEqual(row[key], value, key);
  assert.equal(row.region_id, 'glade');
  assert.deepEqual(db.prepare('SELECT * FROM game_wallets').get(), wallet);
  const expanded = JSON.parse(db.prepare('SELECT enemies_json FROM game_parties').get().enemies_json);
  assert.equal(expanded.length, 4);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM game_region_worlds').get().n, 2);
  for (const enemy of enemies) assert.deepEqual(expanded.find(e => e.id === enemy.id), enemy);
  migrateDatabase(db);
  assert.deepEqual(JSON.parse(db.prepare('SELECT enemies_json FROM game_parties').get().enemies_json), expanded);
  assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
});

test('development enforces lifetime unlocks, persists choices and replays without resetting cooldowns', async t => {
  const h = harness(t); const hero = await h.account('DevelopKnight', 'knight');
  assert.equal((await h.action(hero, 'configure', { stanceId: 'focused', tacticId: 'manual', lifetimeXp: 9999 })).body.code, 'INVALID_DEVELOPMENT');
  h.db.prepare('UPDATE game_wallets SET balance_xp=1250,lifetime_xp=1250 WHERE user_id=?').run(hero.userId);
  const requestId = randomUUID();
  const configured = ok(await h.action(hero, 'configure', { stanceId: 'focused', tacticId: 'skill-opening' }, requestId));
  assert.equal(configured.profile.development.stanceId, 'focused');
  assert.equal(configured.profile.balanceXp, 1250);
  assert.equal(configured.profile.character.battleStance, 'focused');
  assert.equal(JSON.stringify(configured.realm).includes('skill-opening'), false, 'Tactic stays private');
  ok(await h.action(hero, 'configure', { stanceId: 'guarded', tacticId: 'recovery-first' }));
  assert.equal(ok(await h.action(hero, 'configure', { stanceId: 'focused', tacticId: 'skill-opening' }, requestId)).profile.development.stanceId, 'guarded', 'Old receipt never reapplies old choice');
  assert.equal((await h.action(hero, 'configure', { stanceId: 'guarded', tacticId: 'automatic' })).body.code, 'INVALID_DEVELOPMENT');
  h.position(hero, 17, 8);
  ok(await h.action(hero, 'attack'));
  ok(await h.action(hero, 'configure', { stanceId: 'focused', tacticId: 'manual' }, randomUUID(), 0));
  assert.equal((await h.action(hero, 'attack', {}, randomUUID(), 0)).body.code, 'ATTACK_COOLDOWN');
  ok(await h.game(hero, '/api/game/exchange', { requestId: randomUUID(), lots: 1 }));
  h.restart();
  const returned = ok(await h.world(hero));
  assert.equal(returned.profile.balanceXp, 15); // The real, high-level attack earned one kill.
  assert.equal(returned.profile.development.stanceId, 'focused');
  assert.ok(returned.profile.development.availableStances.includes('focused'));
});

test('stance tradeoffs affect ordinary attack and retaliation without modifying base class or visitor access', async t => {
  const h = harness(t); const hero = await h.account('GuardedRanger');
  h.db.prepare('UPDATE game_wallets SET lifetime_xp=100 WHERE user_id=?').run(hero.userId);
  ok(await h.action(hero, 'configure', { stanceId: 'guarded', tacticId: 'manual' }));
  h.position(hero, 17, 8);
  const attack = ok(await h.action(hero, 'attack'));
  assert.equal(enemy(attack).hp, 28, '14 base +2 level -2 guarded');
  assert.equal(attack.profile.character.hp, 94, '9 retaliation -1 armor -2 guarded');
  const admin = await h.account('DevelopmentAdmin', 'ranger', { join: false, admin: true });
  const visit = ok(await h.visit(admin));
  assert.equal(visit.profile.development, null);
  assert.equal((await h.action(admin, 'configure', { stanceId: 'focused', tacticId: 'manual' })).body.code, 'ADMIN_DEVELOPMENT_DISABLED');
});

test('regional wounded and defeated spawns persist exactly across restarts without duplication', async t => {
  const h = harness(t); const hero = await h.account('PersistentReach', 'knight');
  region(h, hero, 'amberReach', 17, 8);
  const state = () => JSON.parse(h.db.prepare('SELECT enemies_json FROM game_region_worlds WHERE party_id=? AND region_id=?').get(hero.partyId, 'amberReach').enemies_json);
  const initial = state();
  const original = initial.find(e => e.id === 'amberReach:ridge');
  ok(await h.action(hero, 'attack'));
  const wounded = state();
  assert.equal(wounded.find(e => e.id === original.id).hp, 20);
  assert.equal(wounded.find(e => e.id === original.id).spawnId, original.spawnId);
  assert.equal(wounded.find(e => e.id === original.id).respawnAt, 0);
  h.restart();
  assert.equal(ok(await h.world(hero)).realm.enemies.find(e => e.id === original.id).hp, 20);
  assert.deepEqual(state(), wounded);
  ok(await h.action(hero, 'attack'));
  const defeated = state(); const dead = defeated.find(e => e.id === original.id);
  assert.equal(dead.hp, 0); assert.ok(dead.respawnAt > 0); assert.equal(dead.spawnId, original.spawnId);
  assert.equal(ok(await h.world(hero)).profile.lifetimeXp, 15);
  h.restart();
  assert.equal(ok(await h.world(hero)).realm.enemies.find(e => e.id === original.id).hp, 0);
  assert.deepEqual(state(), defeated);
  assert.equal(h.db.prepare('SELECT COUNT(*) AS n FROM game_region_worlds WHERE party_id=?').get(hero.partyId).n, 2);
  assert.equal(new Set(state().map(e => e.id)).size, 4);
  h.advance(21000);
  const revived = ok(await h.world(hero)); const respawned = state().find(e => e.id === original.id);
  assert.equal(respawned.hp, 42); assert.equal(respawned.respawnAt, 0);
  assert.notEqual(respawned.spawnId, original.spawnId);
  assert.equal(revived.profile.lifetimeXp, 15, 'Respawning never creates another reward');
  h.restart();
  ok(await h.world(hero));
  assert.deepEqual(state().find(e => e.id === original.id), respawned, 'Restart does not respawn a second time');
});
