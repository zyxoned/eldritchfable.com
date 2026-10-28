import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Readable } from 'node:stream';
import { EventEmitter } from 'node:events';
import { createGameService } from '../server/game.mjs';
import { digest, openDatabase, migrateDatabase } from '../server/database.mjs';
import { readFileSync } from 'node:fs';
import { CLASS_CATALOG, PLAYER_CLASS_IDS } from '../shared/class-catalog.mjs';
import { fixture, verifiedAccount, loginCookie } from './helpers.mjs';

function harness(t, { sseIntervalMs = 15000 } = {}) {
  const f = fixture(t);
  let clock = Date.now();
  let service = createGameService(f.db, { origin: f.origin, now: () => clock, sseIntervalMs });
  t.after(() => service.close());

  function requestParts(path, data, options = {}) {
    const req = Readable.from(data === undefined ? [] : [
      options.raw === undefined ? JSON.stringify(data) : options.raw,
    ]);
    req.method = options.method || (data === undefined ? 'GET' : 'POST');
    req.url = path;
    req.headers = {
      origin: f.origin,
      'content-type': 'application/json',
      ...(options.cookie ? { cookie: options.cookie } : {}),
      ...options.headers,
    };
    req.socket = { remoteAddress: '127.0.0.1' };
    return req;
  }

  async function game(path, data, options = {}) {
    const req = requestParts(path, data, options);
    const result = {};
    const res = new EventEmitter();
    res.writeHead = (status, headers) => {
      result.status = status;
      result.headers = headers;
    };
    res.end = body => {
      result.body = body ? JSON.parse(body) : null;
      res.emit('close');
    };
    const handled = await service.route(req, res, path.split('?')[0]);
    assert.equal(handled, true, 'Game service must handle ' + path);
    return result;
  }

  async function account(name, heroClass = 'ranger', { join = true } = {}) {
    const details = {
      email: name.toLowerCase() + '@example.test',
      password: 'a-good-test-passphrase-123',
    };
    await verifiedAccount(f, details);
    const cookie = await loginCookie(f, details);
    const actor = { name, heroClass, cookie, details, playerId: null, last: null };
    if (join) await enter(actor);
    return actor;
  }

  async function enter(actor, requestId = randomUUID()) {
    const result = await game('/api/game/join', {
      requestId, name: actor.name, heroClass: actor.heroClass,
    }, { cookie: actor.cookie });
    actor.last = result;
    if (result.status === 200) actor.playerId = result.body.playerId;
    return result;
  }

  async function action(actor, kind, extra = {}, requestId = randomUUID(), advance = 250) {
    clock += advance;
    const result = await game('/api/game/action', {
      requestId, kind, ...extra,
    }, { cookie: actor.cookie });
    actor.last = result;
    return result;
  }

  async function world(actor) {
    const result = await game('/api/game/world', undefined, { cookie: actor.cookie });
    actor.last = result;
    return result;
  }

  async function stash(actor) {
    return game('/api/game/stash', undefined, { cookie: actor.cookie });
  }

  function player(actor, result = actor.last) {
    return result?.body?.realm?.players.find(p => p.id === actor.playerId);
  }

  function passable(x, y) {
    if (!Number.isInteger(x) || !Number.isInteger(y)
      || x < 1 || y < 1 || x >= 29 || y >= 21) return false;
    const left = 3 + Math.floor(y / 7);
    const inRiver = x >= left && x <= left + 2;
    return !inRiver || (y >= 11 && y <= 13);
  }

  async function walk(actor, x, y) {
    await world(actor);
    const start = player(actor);
    assert.ok(start, actor.name + ' must be active before walking');
    const queue = [{ x: start.x, y: start.y, path: [] }];
    const seen = new Set([start.x + ',' + start.y]);
    let route;
    for (let i = 0; i < queue.length; i++) {
      const current = queue[i];
      if (current.x === x && current.y === y) {
        route = current.path;
        break;
      }
      for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
        const nextX = current.x + dx;
        const nextY = current.y + dy;
        const key = nextX + ',' + nextY;
        if (!passable(nextX, nextY) || seen.has(key)) continue;
        seen.add(key);
        queue.push({
          x: nextX,
          y: nextY,
          path: [...current.path, { x: nextX, y: nextY }],
        });
      }
    }
    assert.ok(route, 'Expected a walkable route to ' + x + ',' + y);
    for (const step of route) {
      const result = await action(actor, 'move', step, randomUUID(), 250);
      assert.equal(result.status, 200, JSON.stringify(result.body));
      assert.equal(player(actor).x, step.x);
      assert.equal(player(actor).y, step.y);
    }
  }

  async function defeat(actor, id) {
    await world(actor);
    const target = actor.last.body.realm.enemies.find(enemy => enemy.id === id);
    assert.ok(target && target.hp > 0);
    await walk(actor, target.x, target.y);
    for (let i = 0; i < 5; i++) {
      const result = await action(actor, 'attack', {}, randomUUID(), 800);
      assert.equal(result.status, 200, JSON.stringify(result.body));
      if (result.body.realm.enemies.find(enemy => enemy.id === id).hp === 0) return;
    }
    assert.fail('Thornling was not defeated within five valid attacks');
  }

  function events(actor) {
    const req = requestParts('/api/game/events', undefined, { cookie: actor.cookie });
    const res = new EventEmitter();
    const stream = { status: null, headers: null, chunks: [], ended: false };
    let finish;
    stream.finished = new Promise(resolve => { finish = resolve; });
    res.writeHead = (status, headers) => {
      stream.status = status;
      stream.headers = headers;
    };
    res.flushHeaders = () => undefined;
    res.write = value => {
      stream.chunks.push(String(value));
      return true;
    };
    res.end = value => {
      if (value) stream.chunks.push(String(value));
      stream.ended = true;
      finish();
      res.emit('close');
    };
    stream.close = () => res.emit('close');
    stream.start = service.route(req, res, '/api/game/events');
    return stream;
  }

  return {
    ...f, game, account, enter, action, world, stash, player, walk, defeat, events,
    advance(milliseconds) { clock += milliseconds; },
    restart() {
      service.close();
      service = createGameService(f.db, { origin: f.origin, now: () => clock, sseIntervalMs });
    },
  };
}

function expectRejected(result, statuses = [400, 401, 403, 409, 429]) {
  assert.ok(statuses.includes(result.status), JSON.stringify(result));
  assert.equal(typeof result.body.error, 'string');
}

test('schema four preserves version-three characters, accounts, wallets, ledgers and receipts', t => {
  const db = openDatabase(':memory:');
  t.after(() => db.close());
  db.exec('CREATE TABLE schema_migrations(version INTEGER PRIMARY KEY)');
  for (const source of ['schema.sql', 'accounts-schema.sql', 'migrations/002-account-mail.sql', 'migrations/003-game-stash.sql']) {
    db.exec(readFileSync(new URL('../server/' + source, import.meta.url), 'utf8'));
  }
  db.exec('INSERT INTO schema_migrations(version) VALUES(1),(2),(3)');
  db.prepare('INSERT INTO account_users(id,email,password_hash,email_verified_at) VALUES(?,?,?,?)')
    .run('old-account', 'old@example.test', 'preserved-password-hash', '2026-01-01T00:00:00Z');
  db.prepare('INSERT INTO account_sessions(token_hash,user_id,expires_at) VALUES(?,?,?)')
    .run('preserved-session', 'old-account', '2099-01-01T00:00:00Z');
  db.prepare('INSERT INTO game_characters(user_id,id,name,hero_class,x,y,hp,kills,gathered_json,shrine,claimed,active_until,last_move_at,last_attack_at,last_chat_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
    .run('old-account', 'old-hero', 'OldGuardian', 'knight', 17, 8, 61, 3, '["moon","fern"]', 1, 1, 123456, 123, 124, 125);
  db.prepare('INSERT INTO game_wallets(user_id,balance_xp,lifetime_xp,balance_copper) VALUES(?,?,?,?)')
    .run('old-account', 250, 1500, 1000);
  db.prepare('INSERT INTO game_ledger(id,user_id,event_key,delta,balance_after,reason,created_at) VALUES(?,?,?,?,?,?,?)')
    .run('old-credit', 'old-account', 'old-event', 250, 250, 'Old reward', '2026-01-01T00:00:00Z');
  db.prepare('INSERT INTO game_requests(user_id,request_id,payload_hash,notice,created_at) VALUES(?,?,?,?,?)')
    .run('old-account', 'old-request', 'old-hash', 'Old receipt', 123);
  const tables = ['account_users','account_sessions','game_characters','game_wallets','game_ledger','game_requests'];
  const before = Object.fromEntries(tables.map(table => [table, db.prepare('SELECT * FROM ' + table).all()]));
  assert.equal(migrateDatabase(db), 4);
  for (const table of tables) {
    const columns = Object.keys(before[table][0]);
    assert.deepEqual(db.prepare('SELECT ' + columns.join(',') + ' FROM ' + table).all(), before[table], table + ' changed in migration');
  }
  assert.deepEqual(db.prepare('SELECT * FROM game_admin_characters').all(), []);
  assert.equal(db.prepare('SELECT skill_cooldowns_json FROM game_characters').get().skill_cooldowns_json, '{}');
  assert.equal(migrateDatabase(db), 4, 'Migration is idempotent');
  assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
});

test('all eight normal classes have persistent gear and only their own starter skills', async t => {
  const h = harness(t);
  for (const [index, heroClass] of PLAYER_CLASS_IDS.entries()) {
    const actor = await h.account('Calling' + index, heroClass);
    assert.equal(actor.last.status, 200, JSON.stringify(actor.last.body));
    const own = actor.last.body.profile.character;
    assert.equal(own.heroClass, heroClass);
    assert.equal(own.equipment.length, 3);
    assert.deepEqual(own.equipment, CLASS_CATALOG[heroClass].equipment);
    assert.equal(actor.last.body.profile.adminAccess, false);
    const denied = await h.action(actor, 'skill', { skillId: 'soul-reap', damage: 999999, admin: true });
    assert.equal(denied.status, 400);
    assert.equal(denied.body.code, 'SKILL_UNAVAILABLE');
    await h.game('/api/game/leave', { requestId: randomUUID() }, { cookie: actor.cookie });
    const resumed = await h.enter(actor);
    assert.equal(resumed.body.profile.character.id, own.id);
    assert.deepEqual(resumed.body.profile.character.equipment, own.equipment);
    await h.game('/api/game/leave', { requestId: randomUUID() }, { cookie: actor.cookie });
  }
  const actor = await h.account('NoSecretClass', 'ranger', { join: false });
  actor.heroClass = 'death-knight';
  assert.equal((await h.enter(actor)).status, 400);
});

test('party healing and skill cooldowns are authoritative, replay-safe, and durable', async t => {
  const h = harness(t);
  const bard = await h.account('MendingBard', 'bard');
  const nearby = await h.account('NearCleric', 'cleric');
  const far = await h.account('FarMonk', 'monk');
  const bardId = h.db.prepare('SELECT id FROM account_users WHERE email=?').get(bard.details.email).id;
  const nearId = h.db.prepare('SELECT id FROM account_users WHERE email=?').get(nearby.details.email).id;
  const farId = h.db.prepare('SELECT id FROM account_users WHERE email=?').get(far.details.email).id;
  h.db.prepare('UPDATE game_characters SET hp=30 WHERE user_id IN (?,?)').run(bardId, nearId);
  h.db.prepare('UPDATE game_characters SET hp=30,x=26,y=17 WHERE user_id=?').run(farId);
  const skill = CLASS_CATALOG.bard.skills.find(value => value.type === 'heal');
  const requestId = randomUUID();
  const cast = await h.action(bard, 'skill', { skillId: skill.id, heal: 999999, radius: 999, targetId: far.playerId }, requestId);
  assert.equal(cast.status, 200, JSON.stringify(cast.body));
  assert.equal(cast.body.profile.character.hp, 30 + skill.heal);
  assert.equal(cast.body.realm.players.find(player => player.id === nearby.playerId).hp, 30 + skill.heal);
  assert.equal(cast.body.realm.players.find(player => player.id === far.playerId).hp, 30);
  assert.ok(cast.body.profile.cooldowns[skill.id] > cast.body.realm.serverTime);
  const replay = await h.action(bard, 'skill', { skillId: skill.id, heal: 999999, radius: 999, targetId: far.playerId }, requestId);
  assert.equal(replay.status, 200);
  assert.equal(replay.body.profile.character.hp, 30 + skill.heal);
  assert.equal((await h.action(bard, 'skill', { skillId: skill.id })).body.code, 'SKILL_COOLDOWN');
  h.restart();
  assert.equal((await h.action(bard, 'skill', { skillId: skill.id })).body.code, 'SKILL_COOLDOWN');
  h.advance(skill.cooldownMs);
  const again = await h.action(bard, 'skill', { skillId: skill.id });
  assert.equal(again.status, 200);
  assert.equal(again.body.profile.character.hp, 30 + skill.heal * 2);
  assert.equal(again.body.profile.balanceXp, 0, 'Starter skills never charge or grant currency');
  const invalid = await h.action(bard, 'skill', { skillId: CLASS_CATALOG.cleric.skills[0].id });
  assert.equal(invalid.status, 400);
  assert.equal(invalid.body.code, 'SKILL_UNAVAILABLE');
});

test('class attacks and wards use server stats and bounded transient effects', async t => {
  const h = harness(t);
  const knight = await h.account('WardKnight', 'knight');
  const userId = h.db.prepare('SELECT id FROM account_users WHERE email=?').get(knight.details.email).id;
  h.db.prepare('UPDATE game_characters SET x=17,y=8 WHERE user_id=?').run(userId);
  const ward = CLASS_CATALOG.knight.skills.find(value => value.type === 'ward');
  const cast = await h.action(knight, 'skill', { skillId: ward.id, ward: 9999, durationMs: 999999999 });
  assert.equal(cast.status, 200);
  assert.equal(cast.body.profile.character.wardAmount, ward.ward);
  assert.equal(cast.body.profile.character.wardUntil, cast.body.realm.serverTime + ward.durationMs);
  const attacked = await h.action(knight, 'attack', { damage: 999999, range: 999 }, randomUUID(), 800);
  assert.equal(attacked.status, 200);
  assert.equal(attacked.body.realm.enemies.find(enemy => enemy.id === 'bramble').hp, 42 - CLASS_CATALOG.knight.damage);
  assert.equal(attacked.body.profile.character.hp, 100, 'Ward absorbs the counterattack');
  assert.equal(attacked.body.profile.character.wardAmount, ward.ward - (9 - CLASS_CATALOG.knight.armor));
  assert.ok(attacked.body.realm.effects.some(value => value.type === 'strike'));
  assert.ok(attacked.body.realm.effects.length <= 24);
  h.advance(2000);
  assert.deepEqual((await h.world(knight)).body.realm.effects, []);
});

test('a verified administrator has exactly one separate seventh slot, hidden level and SSS gear', async t => {
  const h = harness(t);
  const customers = [];
  for (let i = 0; i < 6; i++) customers.push(await h.account('SixSeat' + i));
  const outsider = await h.account('NoAdmin', 'ranger', { join: false });
  const owner = await h.account('OwnerKnight', 'knight', { join: false });
  const secondAdmin = await h.account('OtherAdmin', 'ranger', { join: false });
  h.db.prepare("UPDATE account_users SET role='admin' WHERE email IN (?,?)").run(owner.details.email, secondAdmin.details.email);
  const denied = await h.game('/api/game/admin/join', { requestId: randomUUID(), role: 'admin', userId: 'forged' }, { cookie: outsider.cookie });
  assert.equal(denied.status, 403);
  assert.equal(denied.body.code, 'ADMIN_REQUIRED');
  const joined = await h.game('/api/game/admin/join', { requestId: randomUUID(), name: 'Forged', heroClass: 'mage', level: 999, hp: 9999 }, { cookie: owner.cookie });
  assert.equal(joined.status, 200, JSON.stringify(joined.body));
  assert.equal(joined.body.realm.players.length, 6);
  assert.equal(joined.body.profile.adminAccess, true);
  assert.equal(joined.body.profile.adminActive, true);
  assert.equal(joined.body.realm.seventh.name, 'The Unnamed');
  assert.equal(joined.body.realm.seventh.heroClass, 'death-knight');
  assert.equal(joined.body.realm.seventh.race, 'Draconian');
  assert.equal(joined.body.realm.seventh.levelLabel, '???');
  assert.equal(joined.body.realm.seventh.equipment.length, 3);
  assert.ok(joined.body.realm.seventh.equipment.every(item => item.rarity === 'SSS'));
  const occupied = await h.game('/api/game/admin/join', { requestId: randomUUID() }, { cookie: secondAdmin.cookie });
  assert.equal(occupied.status, 409);
  assert.equal(occupied.body.code, 'SEVENTH_OCCUPIED');
  assert.equal((await h.enter(outsider)).status, 409, 'Regular customers still cannot become the seventh');
  h.db.prepare("UPDATE account_users SET role='customer' WHERE email=?").run(owner.details.email);
  const revoked = await h.world(owner);
  assert.equal(revoked.body.realm.seventh, null);
  assert.equal(revoked.body.profile.adminAccess, false);
  assert.equal(revoked.body.profile.adminActive, false);
  assert.equal((await h.action(owner, 'attack')).body.code, 'SEAT_EXPIRED');
  assert.equal((await h.game('/api/game/admin/join', { requestId: randomUUID() }, { cookie: owner.cookie })).status, 403);
  assert.equal((await h.game('/api/game/admin/join', { requestId: randomUUID() }, { cookie: secondAdmin.cookie })).status, 200);
});

test('admin avatar preserves the regular hero, is invulnerable, and executions mint no redeemable XP', async t => {
  const h = harness(t);
  const owner = await h.account('RegularOwner', 'wizard');
  const fighter = await h.account('AssistantKnight', 'knight');
  const ownerId = h.db.prepare('SELECT id FROM account_users WHERE email=?').get(owner.details.email).id;
  const normalId = owner.playerId;
  h.db.prepare("UPDATE account_users SET role='admin' WHERE id=?").run(ownerId);
  h.db.prepare('UPDATE game_wallets SET balance_xp=500,lifetime_xp=500,balance_copper=1000 WHERE user_id=?').run(ownerId);
  h.db.prepare('UPDATE game_characters SET hp=51,kills=2,x=17,y=8 WHERE user_id=?').run(ownerId);
  await h.walk(fighter, 17, 8);
  assert.equal((await h.action(fighter, 'attack', {}, randomUUID(), 800)).status, 200);
  const joined = await h.game('/api/game/admin/join', { requestId: randomUUID() }, { cookie: owner.cookie });
  assert.equal(joined.status, 200);
  assert.equal(joined.body.realm.players.length, 1, 'Own regular seat is released');
  assert.equal(joined.body.profile.regularCharacter.id, normalId);
  assert.equal(joined.body.profile.regularCharacter.hp, 51);
  const adminId = joined.body.profile.playerId;
  h.db.prepare('UPDATE game_admin_characters SET x=17,y=8 WHERE user_id=?').run(ownerId);
  const executed = await h.action(owner, 'skill', { skillId: 'soul-reap', damage: 1 });
  assert.equal(executed.status, 200);
  assert.equal(executed.body.realm.enemies.find(enemy => enemy.id === 'bramble').hp, 0);
  assert.equal(executed.body.realm.seventh.hp, 100);
  assert.equal(executed.body.profile.balanceXp, 500);
  assert.equal((await h.stash(fighter)).body.stash.balanceXp, 0, 'An administrative execution cannot reward assistants');
  assert.equal((await h.action(owner, 'claim')).body.code, 'ADMIN_REWARD_DISABLED');
  assert.equal((await h.action(owner, 'interact')).body.profile.balanceXp, 500);
  assert.equal(h.db.prepare('SELECT COUNT(*) AS n FROM game_damage WHERE enemy_id=?').get('bramble').n, 0);
  h.advance(21000);
  const attack = await h.action(owner, 'attack', {}, randomUUID(), 800);
  assert.equal(attack.status, 200);
  assert.equal(attack.body.realm.enemies.find(enemy => enemy.id === 'bramble').hp, 0);
  assert.equal(attack.body.profile.character.hp, 100);
  h.restart();
  assert.equal((await h.world(owner)).body.profile.playerId, adminId);
  const left = await h.game('/api/game/admin/leave', { requestId: randomUUID() }, { cookie: owner.cookie });
  assert.equal(left.status, 200);
  assert.equal(left.body.realm.seventh, null);
  assert.equal(left.body.profile.character.id, normalId);
  assert.equal(left.body.profile.character.hp, 51);
  assert.equal(left.body.profile.balanceXp, 500);
  assert.equal(left.body.profile.balanceCopper, 1000);
  assert.equal((await h.enter(owner)).body.profile.character.id, normalId);
});

test('disabled admins and cross-origin requests cannot use the secret passage or its powers', async t => {
  const h = harness(t);
  const owner = await h.account('DisabledOwner', 'monk', { join: false });
  h.db.prepare("UPDATE account_users SET role='admin' WHERE email=?").run(owner.details.email);
  const body = { requestId: randomUUID() };
  const cross = await h.game('/api/game/admin/join', body, { cookie: owner.cookie, headers: { origin: 'https://other.example.test' } });
  assert.equal(cross.status, 403);
  const entry = await h.game('/api/game/admin/join', body, { cookie: owner.cookie });
  assert.equal(entry.status, 200);
  h.db.prepare('UPDATE account_users SET disabled_at=CURRENT_TIMESTAMP WHERE email=?').run(owner.details.email);
  assert.equal((await h.game('/api/game/admin/join', { requestId: randomUUID() }, { cookie: owner.cookie })).status, 401);
  assert.equal((await h.action(owner, 'skill', { skillId: 'soul-reap' })).status, 401);
});

test('privileged generic action receipts re-check role after demotion', async t => {
  const h = harness(t);
  const owner = await h.account('ReceiptOwner', 'ranger', { join: false });
  h.db.prepare("UPDATE account_users SET role='admin' WHERE email=?").run(owner.details.email);
  const entryId = randomUUID();
  assert.equal((await h.game('/api/game/admin/join', { requestId: entryId }, { cookie: owner.cookie })).status, 200);
  const userId = h.db.prepare('SELECT id FROM account_users WHERE email=?').get(owner.details.email).id;
  h.db.prepare('UPDATE game_admin_characters SET x=17,y=8 WHERE user_id=?').run(userId);
  const attackId = randomUUID();
  const attack = await h.action(owner, 'attack', {}, attackId, 800);
  assert.equal(attack.status, 200);
  assert.equal(h.db.prepare('SELECT actor_scope FROM game_requests WHERE user_id=? AND request_id=?').get(userId, attackId).actor_scope, 'admin');
  h.db.prepare("UPDATE account_users SET role='customer' WHERE id=?").run(userId);
  const replay = await h.action(owner, 'attack', {}, attackId, 800);
  assert.equal(replay.status, 403);
  assert.equal(replay.body.code, 'ADMIN_REQUIRED');
  const replayEntry = await h.game('/api/game/admin/join', { requestId: entryId }, { cookie: owner.cookie });
  assert.equal(replayEntry.status, 403);
  assert.equal((await h.world(owner)).body.realm.seventh, null);
});

test('revoking or logging out the entry session releases the seventh slot and another session can rebind', async t => {
  const h = harness(t, { sseIntervalMs: 20 });
  const owner = await h.account('SessionOwner', 'ranger', { join: false });
  const observer = await h.account('WatchingBard', 'bard');
  h.db.prepare("UPDATE account_users SET role='admin' WHERE email=?").run(owner.details.email);
  const firstCookie = owner.cookie;
  const secondCookie = await loginCookie(h, owner.details);
  const entry = await h.game('/api/game/admin/join', { requestId: randomUUID() }, { cookie: owner.cookie });
  assert.equal(entry.status, 200);
  const id = entry.body.profile.playerId;
  const saved = h.db.prepare('SELECT session_hash FROM game_admin_characters').get().session_hash;
  assert.equal(saved, digest(firstCookie.slice('ef_session='.length)));
  assert.ok(!JSON.stringify(entry.body).includes(saved), 'The session hash is private');
  const events = h.events(observer);
  await events.start;
  h.db.prepare('UPDATE account_sessions SET revoked_at=CURRENT_TIMESTAMP WHERE token_hash=?').run(saved);
  await new Promise(resolve => setTimeout(resolve, 80));
  const live = events.chunks.join('');
  assert.match(live, /"seventh":null/, 'The live stream removes the revoked presence');
  assert.equal(h.db.prepare('SELECT active_until FROM game_admin_characters').get().active_until, 0);
  assert.equal((await h.world(owner)).status, 401);
  owner.cookie = secondCookie;
  const rebound = await h.game('/api/game/admin/join', { requestId: randomUUID() }, { cookie: owner.cookie });
  assert.equal(rebound.status, 200);
  assert.equal(rebound.body.profile.playerId, id, 'Rebinding preserves the privileged character');
  assert.equal(h.db.prepare('SELECT session_hash FROM game_admin_characters').get().session_hash, digest(secondCookie.slice('ef_session='.length)));
  assert.equal((await h.request('logout', {}, { cookie: secondCookie })).status, 200);
  assert.equal((await h.world(observer)).body.realm.seventh, null);
  events.close();
  owner.cookie = await loginCookie(h, owner.details);
  assert.equal((await h.game('/api/game/admin/join', { requestId: randomUUID() }, { cookie: owner.cookie })).status, 200);
  const changed = await h.request('change-password', { currentPassword: owner.details.password, password: 'a-new-safe-admin-passphrase-456' }, { cookie: owner.cookie });
  assert.equal(changed.status, 200);
  assert.equal((await h.world(observer)).body.realm.seventh, null, 'Password changes release the privileged slot');
  assert.equal((await h.action(owner, 'attack')).status, 401);
});
