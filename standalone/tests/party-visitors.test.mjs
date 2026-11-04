import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Readable } from 'node:stream';
import { EventEmitter } from 'node:events';
import { createGameService } from '../server/game.mjs';
import { digest, migrateDatabase, openDatabase } from '../server/database.mjs';
import { readFileSync } from 'node:fs';
import { CLASS_CATALOG } from '../shared/class-catalog.mjs';
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

test('each party admits eight regular heroes and two visitors without sharing overflow worlds', async t => {
  const h = harness(t);
  const customers = [];
  for (let i = 0; i < 8; i++) {
    const actor = await h.account('PartyEight' + i);
    ok(actor.last);
    customers.push(actor);
  }
  const party = ok(await h.world(customers[0])).realm;
  assert.equal(party.maxPlayers, 8);
  assert.equal(party.maxVisitors, 2);
  assert.equal(party.players.length, 8);
  assert.ok(party.partyId);
  const admin1 = await h.account('FirstVisitor', 'ranger', { join: false, admin: true });
  const admin2 = await h.account('SecondVisitor', 'ranger', { join: false, admin: true });
  const admin3 = await h.account('ThirdVisitor', 'ranger', { join: false, admin: true });
  ok(await h.visit(admin1));
  const full = ok(await h.visit(admin2));
  assert.equal(full.realm.partyId, party.partyId);
  assert.equal(full.realm.players.length, 8);
  assert.equal(full.realm.visitors.length, 2);
  assert.equal(full.realm.visitors[0].hp, 100);
  assert.equal((await h.visit(admin3)).body.code, 'VISITORS_FULL');
  const overflow = await h.account('OverflowHero');
  ok(overflow.last);
  assert.notEqual(overflow.partyId, party.partyId);
  assert.equal(overflow.last.body.realm.players.length, 1);
  assert.equal(overflow.last.body.realm.visitors.length, 0);
  const invited = await h.account('FullInvite', 'ranger', { join: false });
  assert.equal((await h.enter(invited, { partyId: party.partyId })).body.code, 'PARTY_FULL');
  assert.equal(ok(await h.world(customers[0])).realm.players.length, 8);
});

test('solo contexts are eligible for random visitors and remain private from ordinary matching', async t => {
  const h = harness(t, { random: () => 0.6 });
  const open = await h.account('OpenContext');
  const solo = await h.account('SoloContext', 'monk', { mode: 'solo' });
  ok(solo.last);
  assert.equal(solo.last.body.realm.partyMode, 'solo');
  assert.notEqual(solo.partyId, open.partyId);
  const newcomer = await h.account('OpenNewcomer');
  assert.equal(newcomer.partyId, open.partyId);
  const admin = await h.account('RandomVisitor', 'ranger', { join: false, admin: true });
  const visit = ok(await h.visit(admin));
  assert.equal(visit.realm.partyId, solo.partyId, 'Uniform random index reaches a one-player context');
  assert.equal(visit.realm.players.length, 1);
  assert.equal(visit.realm.players[0].id, solo.playerId);
  assert.equal((await h.enter(newcomer, { partyId: solo.partyId })).body.code, 'PARTY_PRIVATE');
});

test('party snapshots and live events isolate roster, chat, enemies and effects', async t => {
  const h = harness(t);
  const first = await h.account('IsolatedFirst', 'knight', { mode: 'solo' });
  const second = await h.account('IsolatedSecond', 'mage', { mode: 'solo' });
  assert.notEqual(first.partyId, second.partyId);
  const live = h.events(second);
  await live.start;
  h.position(first, 17, 8);
  ok(await h.action(first, 'chat', { text: 'Only the first party hears this' }));
  const hit = ok(await h.action(first, 'attack'));
  assert.equal(enemy(hit).hp, 20);
  const other = ok(await h.world(second));
  assert.equal(enemy(other).hp, 42);
  assert.equal(other.realm.effects.length, 0);
  assert.equal(other.realm.messages.some(row => row.text.includes('Only the first')), false);
  const frames = live.chunks.join('');
  assert.equal(frames.includes('Only the first party hears this'), false);
  assert.equal(frames.includes(first.playerId), false);
  assert.equal(frames.includes('"type":"strike"'), false);
  h.restart();
  assert.equal(enemy(ok(await h.world(first))).hp, 20);
  assert.equal(enemy(ok(await h.world(second))).hp, 42);
  live.close();
});

test('visitor boon heals only nearby regular party members with authoritative cooldown and replay', async t => {
  const h = harness(t);
  const nearby = await h.account('BoonNearby', 'knight');
  const far = await h.account('BoonFar', 'ranger');
  const outsider = await h.account('BoonOutsider', 'monk', { mode: 'solo' });
  const admin = await h.account('BoonVisitor', 'ranger', { join: false, admin: true });
  const secondAdmin = await h.account('BoonOtherAdmin', 'ranger', { join: false, admin: true });
  ok(await h.visit(admin));
  ok(await h.visit(secondAdmin));
  h.position(admin, 17, 8);
  h.position(nearby, 17, 8, 40);
  h.position(far, 26, 17, 40);
  h.position(outsider, 17, 8, 40);
  const requestId = randomUUID();
  const input = { skillId: 'guardian-boon', heal: 99999, radius: 99999 };
  const cast = ok(await h.action(admin, 'skill', input, requestId));
  assert.equal(cast.realm.players.find(row => row.id === nearby.playerId).hp, 55);
  assert.equal(cast.realm.players.find(row => row.id === far.playerId).hp, 40);
  assert.equal(cast.realm.visitors.every(row => row.hp === 100), true);
  assert.equal(ok(await h.world(outsider)).profile.character.hp, 40);
  const replay = ok(await h.action(admin, 'skill', input, requestId));
  assert.equal(replay.realm.players.find(row => row.id === nearby.playerId).hp, 55);
  assert.equal((await h.action(admin, 'skill', input)).body.code, 'SKILL_COOLDOWN');
  h.restart();
  assert.equal((await h.action(admin, 'skill', input)).body.code, 'SKILL_COOLDOWN');
  h.advance(6000);
  const next = ok(await h.action(admin, 'skill', input));
  assert.equal(next.realm.players.find(row => row.id === nearby.playerId).hp, 70);
});

test('visitor offense follows live customer strength and customer contributors keep finisher rewards', async t => {
  const h = harness(t);
  const fighter = await h.account('ScaledFighter', 'knight', { mode: 'solo' });
  const idle = await h.account('IdleElsewhere', 'ranger', { mode: 'solo' });
  const admin = await h.account('ScaledVisitor', 'ranger', { join: false, admin: true });
  // A visitor needs no ordinary hero/wallet; a wallet exists only after ordinary play.
  // Seed one through the same durable table to prove privileged actions cannot credit it.
  h.db.prepare('INSERT OR IGNORE INTO game_wallets(user_id,balance_xp,lifetime_xp,balance_copper) VALUES(?,500,500,1000)').run(admin.userId);
  ok(await h.visit(admin));
  h.position(fighter, 17, 8);
  h.position(admin, 17, 8);
  const first = ok(await h.action(admin, 'attack', { damage: 999999 }));
  assert.equal(enemy(first).hp, 42 - CLASS_CATALOG.knight.damage, 'Solo visitor damage exactly matches the customer basic attack');
  assert.equal(first.profile.character.hp, 100, 'Retaliation cannot hurt visitors');
  ok(await h.action(fighter, 'attack'));
  const customerWallet = ok(await h.game(fighter, '/api/game/stash')).stash;
  assert.equal(customerWallet.balanceXp, 15);
  assert.equal(ok(await h.game(idle, '/api/game/stash')).stash.balanceXp, 0);
  h.advance(21000);
  ok(await h.world(fighter));
  ok(await h.action(fighter, 'attack'));
  const finishing = ok(await h.action(admin, 'skill', { skillId: 'soul-reap', damage: 999999 }));
  assert.equal(enemy(finishing).hp, 0);
  assert.equal(ok(await h.game(fighter, '/api/game/stash')).stash.balanceXp, 30, 'Visitor finisher retains real customer contribution rewards');
  assert.equal(ok(await h.game(admin, '/api/game/stash')).stash.balanceXp, 500);
  assert.equal(h.db.prepare('SELECT lifetime_xp FROM game_wallets WHERE user_id=?').get(admin.userId).lifetime_xp, 500);
  assert.equal(h.db.prepare('SELECT balance_copper FROM game_wallets WHERE user_id=?').get(admin.userId).balance_copper, 1000);
  assert.equal((await h.action(admin, 'claim')).body.code, 'ADMIN_REWARD_DISABLED');
});

test('stale party actions and receipts cannot affect a newly joined context', async t => {
  const h = harness(t);
  const actor = await h.account('SwitchingHero', 'knight', { mode: 'solo' });
  const oldParty = actor.partyId;
  const requestId = randomUUID();
  ok(await h.action(actor, 'chat', { text: 'Old context message' }, requestId));
  ok(await h.leave(actor));
  ok(await h.enter(actor, { mode: 'solo' }));
  assert.notEqual(actor.partyId, oldParty);
  const missing = await h.game(actor, '/api/game/action', { requestId: randomUUID(), kind: 'chat', text: 'Missing context' });
  assert.equal(missing.body.code, 'PARTY_CHANGED');
  const stale = await h.action(actor, 'chat', { text: 'Stale injected message', partyId: oldParty });
  assert.equal(stale.body.code, 'PARTY_CHANGED');
  const staleHeartbeat = await h.game(actor, '/api/game/heartbeat', { requestId: randomUUID(), partyId: oldParty });
  assert.equal(staleHeartbeat.body.code, 'PARTY_CHANGED');
  const replay = await h.action(actor, 'chat', { text: 'Old context message', partyId: oldParty }, requestId);
  assert.equal(replay.status, 200, JSON.stringify(replay.body));
  assert.equal(replay.body.realm.partyId, actor.partyId);
  assert.equal(replay.body.realm.messages.some(row => row.text.includes('Old context')), false);
  const current = ok(await h.world(actor));
  assert.equal(current.realm.messages.some(row => row.text.includes('Old context') || row.text.includes('Stale injected')), false);
});

test('visitor mode preserves normal state and revoked entry sessions remove the live visitor', async t => {
  const h = harness(t, { sseIntervalMs: 20 });
  const customer = await h.account('SessionCustomer');
  const owner = await h.account('PreservedOwner', 'wizard', { admin: true });
  h.db.prepare('UPDATE game_characters SET hp=51,kills=2,x=17,y=8 WHERE user_id=?').run(owner.userId);
  h.db.prepare('UPDATE game_wallets SET balance_xp=500,lifetime_xp=1500,balance_copper=1000 WHERE user_id=?').run(owner.userId);
  const before = h.db.prepare('SELECT id,hero_class,hp,kills,x,y,gathered_json,shrine,claimed,skill_cooldowns_json FROM game_characters WHERE user_id=?').get(owner.userId);
  ok(await h.visit(owner));
  assert.equal(owner.last.body.profile.regularCharacter.id, before.id);
  const live = h.events(customer);
  await live.start;
  const visitId = owner.playerId;
  const attackId = randomUUID();
  h.position(owner, 17, 8);
  ok(await h.action(owner, 'attack', {}, attackId));
  const after = h.db.prepare('SELECT id,hero_class,hp,kills,x,y,gathered_json,shrine,claimed,skill_cooldowns_json FROM game_characters WHERE user_id=?').get(owner.userId);
  assert.deepEqual(after, before);
  h.db.prepare("UPDATE account_users SET role='customer' WHERE id=?").run(owner.userId);
  assert.equal((await h.action(owner, 'attack', {}, attackId)).body.code, 'ADMIN_REQUIRED');
  const cleaned = ok(await h.world(customer)).realm;
  assert.ok(Array.isArray(cleaned.visitors), 'Realm exposes a visitor array');
  assert.equal(cleaned.visitors.some(row => row.id === visitId), false);
  assert.equal(live.chunks.join('').includes('"visitors":[]'), true);
  h.db.prepare("UPDATE account_users SET role='admin' WHERE id=?").run(owner.userId);
  ok(await h.visit(owner));
  const saved = h.db.prepare('SELECT session_hash FROM game_admin_characters WHERE user_id=?').get(owner.userId).session_hash;
  assert.equal(saved, digest(owner.cookie.slice('ef_session='.length)));
  h.db.prepare('UPDATE account_sessions SET revoked_at=CURRENT_TIMESTAMP WHERE token_hash=?').run(saved);
  await new Promise(resolve => setTimeout(resolve, 80));
  assert.equal(ok(await h.world(customer)).realm.visitors.length, 0);
  assert.equal((await h.world(owner)).status, 401);
  live.close();
});


test('visitor damage uses the lower live party median and ignores other contexts', async t => {
  const h = harness(t);
  const bard = await h.account('MedianBard', 'bard');
  const mage = await h.account('MedianMage', 'mage');
  const knight = await h.account('MedianKnight', 'knight');
  const other = await h.account('MedianOther', 'knight', { mode: 'solo' });
  h.db.prepare('UPDATE game_wallets SET balance_xp=10000,lifetime_xp=10000 WHERE user_id=?').run(other.userId);
  const admin = await h.account('MedianVisitor', 'ranger', { join: false, admin: true });
  ok(await h.visit(admin));
  h.position(admin, 17, 8);
  const first = ok(await h.action(admin, 'attack', { damage: 99999, lifetimeXp: 99999 }));
  assert.equal(enemy(first).hp, 24, 'Median of 12,18,22 is18; an outside party cannot alter it');
  h.db.prepare('UPDATE game_wallets SET balance_xp=1000,lifetime_xp=1000 WHERE user_id=?').run(mage.userId);
  const second = ok(await h.action(admin, 'attack'));
  assert.equal(enemy(second).hp, 2, 'Live median changes to22 when customer XP changes');
  ok(await h.leave(knight));
  const third = ok(await h.action(admin, 'attack'));
  assert.equal(enemy(third).hp, 0, 'Lower median of12,38 remains finite and bounded');
  assert.equal(ok(await h.game(bard, '/api/game/stash')).stash.balanceXp, 0, 'Idle party members cannot farm visitor kills');
  assert.equal(ok(await h.game(mage, '/api/game/stash')).stash.balanceXp, 1000);
});

test('fresh party enemy spawns can each reward a real contributor exactly once', async t => {
  const h = harness(t);
  const actor = await h.account('FreshSpawnHero', 'knight', { mode: 'solo' });
  const oldParty = actor.partyId;
  h.position(actor, 17, 8);
  ok(await h.action(actor, 'attack'));
  ok(await h.action(actor, 'attack'));
  assert.equal(ok(await h.game(actor, '/api/game/stash')).stash.balanceXp, 15);
  ok(await h.leave(actor));
  ok(await h.enter(actor, { mode: 'solo' }));
  assert.notEqual(actor.partyId, oldParty);
  h.position(actor, 17, 8);
  assert.equal(enemy(ok(await h.world(actor))).hp, 42);
  ok(await h.action(actor, 'attack'));
  ok(await h.action(actor, 'attack'));
  const stash = ok(await h.game(actor, '/api/game/stash')).stash;
  assert.equal(stash.balanceXp, 30);
  assert.equal(stash.history.filter(row => row.reason === 'Thornling defeated').length, 2);
});


test('ordinary area healing is scoped to its own party even at identical coordinates', async t => {
  const h = harness(t);
  const healer = await h.account('ScopedCleric', 'cleric', { mode: 'solo' });
  const other = await h.account('ScopedOutsider', 'monk', { mode: 'solo' });
  h.position(healer, 17, 8, 40);
  h.position(other, 17, 8, 40);
  const cast = ok(await h.action(healer, 'skill', { skillId: 'sanctuary' }));
  assert.equal(cast.profile.character.hp, 70);
  assert.equal(ok(await h.world(other)).profile.character.hp, 40);
});


const defaultAppearance = Object.freeze({ skinTone: 'warm', hairColor: 'chestnut', hairStyle: 'cropped', outfit: 'class', accent: 'gold', build: 'balanced' });

test('appearance updates are durable, replay-safe and cannot alter class, progress or wallet', async t => {
  const h = harness(t);
  const hero = await h.account('AppearanceHero', 'cleric');
  const before = h.db.prepare('SELECT id,hero_class,kills,gathered_json,shrine,claimed FROM game_characters WHERE user_id=?').get(hero.userId);
  const walletBefore = h.db.prepare('SELECT * FROM game_wallets WHERE user_id=?').get(hero.userId);
  const requestId = randomUUID();
  const appearance = { ...defaultAppearance, skinTone: 'deep', hairStyle: 'braid', outfit: 'plum', accent: 'silver', build: 'broad' };
  const input = { requestId, partyId: hero.partyId, appearance };
  const first = ok(await h.game(hero, '/api/game/appearance', input));
  assert.deepEqual(first.profile.character.appearance, appearance);
  const revision = first.realm.revision;
  const replay = ok(await h.game(hero, '/api/game/appearance', input));
  assert.equal(replay.realm.revision, revision, 'A repeated update does not mutate the party again');
  assert.deepEqual(replay.profile.character.appearance, appearance);
  h.restart();
  assert.deepEqual(ok(await h.world(hero)).profile.character.appearance, appearance);
  assert.deepEqual(h.db.prepare('SELECT id,hero_class,kills,gathered_json,shrine,claimed FROM game_characters WHERE user_id=?').get(hero.userId), before);
  assert.deepEqual(h.db.prepare('SELECT * FROM game_wallets WHERE user_id=?').get(hero.userId), walletBefore);
  for (const forged of [{ ...appearance, heroClass: 'death-knight' }, { ...appearance, skinTone: 'invisible' }, { ...appearance, build: 1000000 }]) {
    const invalid = await h.game(hero, '/api/game/appearance', { requestId: randomUUID(), partyId: hero.partyId, appearance: forged });
    assert.equal(invalid.status, 400, JSON.stringify(invalid.body));
  }
  assert.deepEqual(ok(await h.world(hero)).profile.character.appearance, appearance);
  const conflict = await h.game(hero, '/api/game/appearance', { ...input, appearance: { ...appearance, skinTone: 'invisible' } });
  assert.equal(conflict.body.code, 'REQUEST_CONFLICT');
  const stale = await h.game(hero, '/api/game/appearance', { requestId: randomUUID(), partyId: 'stale-party-id', appearance });
  assert.equal(stale.body.code, 'PARTY_CHANGED');
});

test('support visitors cannot customize the preserved ordinary character', async t => {
  const h = harness(t);
  await h.account('AppCustomer');
  const owner = await h.account('AppOwner', 'wizard', { admin: true });
  const before = h.db.prepare('SELECT * FROM game_characters WHERE user_id=?').get(owner.userId);
  ok(await h.visit(owner));
  const blocked = await h.game(owner, '/api/game/appearance', { requestId: randomUUID(), partyId: owner.partyId, appearance: { ...defaultAppearance } });
  assert.equal(blocked.status, 403, JSON.stringify(blocked.body));
  const after = h.db.prepare('SELECT * FROM game_characters WHERE user_id=?').get(owner.userId);
  assert.equal(after.appearance_json, before.appearance_json);
  assert.equal(after.hero_class, before.hero_class);
});

test('schema five preserves version-four character, admin, session and ledger state', t => {
  const db = openDatabase(':memory:');
  t.after(() => db.close());
  db.exec('CREATE TABLE schema_migrations(version INTEGER PRIMARY KEY)');
  for (const source of ['schema.sql', 'accounts-schema.sql', 'migrations/002-account-mail.sql', 'migrations/003-game-stash.sql', 'migrations/004-class-chronicle.sql']) {
    db.exec(readFileSync(new URL('../server/' + source, import.meta.url), 'utf8'));
  }
  db.exec('INSERT INTO schema_migrations(version) VALUES(1),(2),(3),(4)');
  db.prepare("INSERT INTO account_users(id,email,password_hash,email_verified_at,role) VALUES(?,?,?,?,?)")
    .run('preserved-account', 'preserved@example.test', 'preserved-password-hash', '2026-01-01T00:00:00Z', 'admin');
  db.prepare('INSERT INTO account_sessions(token_hash,user_id,expires_at) VALUES(?,?,?)')
    .run('a'.repeat(64), 'preserved-account', '2099-01-01T00:00:00Z');
  db.prepare('INSERT INTO game_characters(user_id,id,name,hero_class,x,y,hp,kills,gathered_json,shrine,claimed,active_until,last_move_at,last_attack_at,last_chat_at,skill_cooldowns_json,ward_until,ward_amount) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
    .run('preserved-account', 'preserved-hero', 'PreservedHero', 'wizard', 17, 8, 61, 3, '["moon","fern"]', 1, 1, 123456, 123, 124, 125, '{"frost-circle":999}', 5000, 12);
  db.prepare('INSERT INTO game_admin_characters(user_id,id,session_hash,x,y,active_until,skill_cooldowns_json) VALUES(?,?,?,?,?,?,?)')
    .run('preserved-account', 'preserved-admin', 'a'.repeat(64), 18, 8, 123456, '{"soul-reap":999}');
  db.prepare('INSERT INTO game_wallets(user_id,balance_xp,lifetime_xp,balance_copper) VALUES(?,?,?,?)')
    .run('preserved-account', 250, 1500, 1000);
  db.prepare('INSERT INTO game_ledger(id,user_id,event_key,delta,balance_after,reason,created_at) VALUES(?,?,?,?,?,?,?)')
    .run('preserved-credit', 'preserved-account', 'old-event', 250, 250, 'Old reward', '2026-01-01T00:00:00Z');
  db.prepare('INSERT INTO game_requests(user_id,request_id,payload_hash,notice,created_at,actor_scope) VALUES(?,?,?,?,?,?)')
    .run('preserved-account', 'preserved-request', 'preserved-hash', 'Old receipt', 123, 'admin');
  db.prepare('INSERT INTO game_damage(enemy_id,spawn_id,user_id,damage,damaged_at) VALUES(?,?,?,?,?)')
    .run('bramble', 'initial-bramble', 'preserved-account', 22, 123);
  const tables = ['account_users', 'account_sessions', 'game_characters', 'game_admin_characters', 'game_wallets', 'game_ledger', 'game_requests', 'game_damage', 'game_world'];
  const before = Object.fromEntries(tables.map(table => [table, db.prepare('SELECT * FROM ' + table).all()]));
  assert.equal(migrateDatabase(db), 5);
  for (const table of tables) {
    const columns = Object.keys(before[table][0]);
    assert.deepEqual(db.prepare('SELECT ' + columns.join(',') + ' FROM ' + table).all(), before[table], table + ' existing columns changed');
  }
  assert.ok(db.prepare('PRAGMA table_info(game_characters)').all().some(row => row.name === 'appearance_json'), 'Migration adds persistent character appearance');
  const hero = db.prepare('SELECT party_id,appearance_json FROM game_characters').get();
  assert.ok(hero.party_id);
  assert.deepEqual(JSON.parse(hero.appearance_json), defaultAppearance);
  assert.equal(db.prepare('SELECT party_id FROM game_admin_characters').get().party_id, hero.party_id);
  assert.equal(db.prepare('SELECT party_id FROM game_requests').get().party_id, hero.party_id);
  assert.equal(db.prepare('SELECT party_id FROM game_damage').get().party_id, hero.party_id);
  assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
  assert.equal(migrateDatabase(db), 5, 'Migration remains idempotent');
});

test('confirmed regular and visitor leave requests replay after their seat is freed', async t => {
  const h = harness(t);
  const hero = await h.account('ReplayLeaveHero');
  const requestId = randomUUID();
  const input = { requestId, partyId: hero.partyId };
  const first = ok(await h.game(hero, '/api/game/leave', input));
  assert.equal(first.profile.active, false);
  assert.equal(ok(await h.game(hero, '/api/game/leave', input)).profile.active, false);
  await h.account('ReplayCustomer');
  const admin = await h.account('ReplayLeaveAdmin', 'ranger', { join: false, admin: true });
  ok(await h.visit(admin));
  const adminInput = { requestId: randomUUID(), partyId: admin.partyId };
  assert.equal(ok(await h.game(admin, '/api/game/admin/leave', adminInput)).profile.adminActive, false);
  assert.equal(ok(await h.game(admin, '/api/game/admin/leave', adminInput)).profile.adminActive, false);
});

test('visitor strike and basic attack share one authoritative cooldown budget', async t => {
  const h = harness(t);
  await h.account('AttackBudgetHero', 'bard', { mode: 'solo' });
  const admin = await h.account('AttackBudgetAdmin', 'ranger', { join: false, admin: true });
  ok(await h.visit(admin));
  h.position(admin, 17, 8);
  const first = ok(await h.action(admin, 'attack'));
  assert.equal(enemy(first).hp, 30);
  const tooSoonSkill = await h.action(admin, 'skill', { skillId: 'soul-reap' }, randomUUID(), 0);
  assert.equal(tooSoonSkill.body.code, 'ATTACK_COOLDOWN');
  const second = ok(await h.action(admin, 'skill', { skillId: 'soul-reap' }));
  assert.equal(enemy(second).hp, 18);
  const tooSoonBasic = await h.action(admin, 'attack', {}, randomUUID(), 0);
  assert.equal(tooSoonBasic.body.code, 'ATTACK_COOLDOWN');
  assert.equal(enemy(ok(await h.world(admin))).hp, 18);
});

test('concurrent visitor entry atomically caps one solo context at two support seats', async t => {
  const h = harness(t);
  const hero = await h.account('ConcurrentHero', 'ranger', { mode: 'solo' });
  const admins = [];
  for (let i = 0; i < 3; i++) admins.push(await h.account('ConcurrentAdmin' + i, 'ranger', { join: false, admin: true }));
  const results = await Promise.all(admins.map(actor => h.visit(actor)));
  assert.equal(results.filter(result => result.status === 200).length, 2);
  assert.equal(results.filter(result => result.body.code === 'VISITORS_FULL').length, 1);
  const current = ok(await h.world(hero));
  assert.equal(current.realm.players.length, 1);
  assert.equal(current.realm.visitors.length, 2);
  assert.equal(h.db.prepare('SELECT COUNT(*) AS n FROM game_admin_characters WHERE active_until>0').get().n, 2);
});

test('visitors cannot keep an empty customer context alive or attack after everyone leaves', async t => {
  const h = harness(t);
  const hero = await h.account('EmptyVisitHero', 'ranger', { mode: 'solo' });
  const admin = await h.account('EmptyVisitAdmin', 'ranger', { join: false, admin: true });
  ok(await h.visit(admin));
  h.position(admin, 17, 8);
  const before = h.db.prepare('SELECT enemies_json FROM game_parties WHERE id=?').get(hero.partyId).enemies_json;
  ok(await h.leave(hero));
  const rejected = await h.action(admin, 'attack', { damage: 999999 });
  assert.equal(rejected.status, 409);
  assert.equal(h.db.prepare('SELECT enemies_json FROM game_parties WHERE id=?').get(admin.partyId).enemies_json, before);
  assert.equal(ok(await h.world(admin)).profile.adminActive, false);
  assert.equal(h.db.prepare('SELECT active_until FROM game_admin_characters WHERE user_id=?').get(admin.userId).active_until, 0);
});
