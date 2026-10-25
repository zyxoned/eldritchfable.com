import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Readable } from 'node:stream';
import { EventEmitter } from 'node:events';
import { createGameService } from '../server/game.mjs';
import { digest } from '../server/database.mjs';
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

test('game and stash require a valid verified account session', async t => {
  const h = harness(t);
  for (const path of ['/api/game/world', '/api/game/stash', '/api/game/events']) {
    expectRejected(await h.game(path), [401]);
  }
  for (const path of ['join', 'action', 'heartbeat', 'leave', 'exchange']) {
    expectRejected(await h.game('/api/game/' + path, {
      requestId: randomUUID(), name: 'Anonymous', heroClass: 'ranger', kind: 'attack',
    }), [401]);
  }

  const actor = await h.account('Gatekeeper');
  const world = await h.world(actor);
  assert.equal(world.status, 200);
  const token = actor.cookie.slice('ef_session='.length);
  h.db.prepare('UPDATE account_sessions SET revoked_at=CURRENT_TIMESTAMP WHERE token_hash=?')
    .run(digest(token));
  expectRejected(await h.world(actor), [401]);
  expectRejected(await h.action(actor, 'interact'), [401]);

  actor.cookie = await loginCookie(h, actor.details);
  h.db.prepare("UPDATE account_sessions SET expires_at='2000-01-01T00:00:00.000Z' WHERE token_hash=?")
    .run(digest(actor.cookie.slice('ef_session='.length)));
  expectRejected(await h.stash(actor), [401]);
  actor.cookie = await loginCookie(h, actor.details);
  h.db.prepare('UPDATE account_users SET disabled_at=CURRENT_TIMESTAMP WHERE email=?')
    .run(actor.details.email);
  expectRejected(await h.world(actor), [401]);
});

test('same-origin, JSON shape, names and action envelopes are enforced', async t => {
  const h = harness(t);
  const actor = await h.account('Validation', 'ranger', { join: false });
  const body = { requestId: randomUUID(), name: actor.name, heroClass: actor.heroClass };
  for (const origin of [undefined, 'https://other.example.test']) {
    expectRejected(await h.game('/api/game/join', body, {
      cookie: actor.cookie, headers: { origin },
    }), [403]);
  }
  expectRejected(await h.game('/api/game/join', body, {
    cookie: actor.cookie, headers: { 'content-type': 'text/plain' },
  }), [403]);
  for (const raw of ['null', '[]', '"bad"', '{invalid']) {
    expectRejected(await h.game('/api/game/join', {}, { cookie: actor.cookie, raw }), [400]);
  }
  expectRejected(await h.game('/api/game/join', {}, {
    cookie: actor.cookie, raw: JSON.stringify({ name: 'x'.repeat(20000) }),
  }), [413]);
  for (const name of ['', 'x', '<script>', 'x'.repeat(17)]) {
    expectRejected(await h.game('/api/game/join', {
      ...body, requestId: randomUUID(), name,
    }, { cookie: actor.cookie }), [400]);
  }
  expectRejected(await h.game('/api/game/join', {
    ...body, requestId: randomUUID(), heroClass: '__proto__',
  }, { cookie: actor.cookie }), [400]);
  expectRejected(await h.game('/api/game/join', {
    ...body, requestId: 'short',
  }, { cookie: actor.cookie }), [400]);
  assert.equal((await h.world(actor)).body.realm.players.length, 0);
});

test('one account has one persistent character and admission never exceeds six', async t => {
  const h = harness(t);
  const actors = [];
  for (let i = 0; i < 7; i++) {
    actors.push(await h.account('Capacity' + i, 'knight', { join: false }));
  }
  const admitted = await Promise.all(actors.slice(0, 6).map(actor => h.enter(actor)));
  assert.ok(admitted.every(result => result.status === 200));
  assert.equal((await h.world(actors[0])).body.realm.players.length, 6);
  expectRejected(await h.enter(actors[6]), [409]);
  assert.equal((await h.world(actors[6])).body.realm.players.length, 6);

  const originalId = actors[0].playerId;
  assert.equal((await h.enter(actors[0])).status, 200);
  assert.equal(actors[0].playerId, originalId);
  assert.equal(actors[0].last.body.realm.players.length, 6);

  const left = await h.game('/api/game/leave', { requestId: randomUUID() }, {
    cookie: actors[0].cookie,
  });
  assert.equal(left.status, 200);
  assert.equal(left.body.realm.players.length, 5);
  assert.equal((await h.enter(actors[6])).status, 200);
  assert.equal(actors[6].last.body.realm.players.length, 6);

  h.advance(60000);
  const heartbeat = await h.game('/api/game/heartbeat', { requestId: randomUUID() }, {
    cookie: actors[6].cookie,
  });
  assert.equal(heartbeat.status, 200);
  h.advance(15001);
  const expired = await h.world(actors[0]);
  assert.equal(expired.body.realm.players.length, 1);
  assert.equal(expired.body.realm.players[0].id, actors[6].playerId);
  expectRejected(await h.action(actors[1], 'move', { x: 11, y: 13 }), [409, 401]);
  assert.equal((await h.enter(actors[0])).status, 200);
  assert.equal(actors[0].playerId, originalId);
  assert.equal(actors[0].last.body.realm.players.length, 2);
});

test('movement, attack ranges, cooldowns and interaction distances are authoritative', async t => {
  const h = harness(t);
  const actor = await h.account('Pathfinder', 'knight');
  expectRejected(await h.action(actor, 'move', { x: 20, y: 5 }), [400]);
  assert.equal(h.player(actor, await h.world(actor)).x, 10);
  expectRejected(await h.action(actor, 'attack'), [400]);
  const remoteInteract = await h.action(actor, 'interact', { x: 24, y: 5 });
  assert.equal(remoteInteract.status, 200, 'Coordinates in input cannot move the camp interaction');
  assert.equal(h.player(actor).shrine, false);
  assert.deepEqual(h.player(actor).gathered, []);

  const moved = await h.action(actor, 'move', { x: 11, y: 13 }, randomUUID(), 250);
  assert.equal(moved.status, 200);
  const tooSoon = await h.action(actor, 'move', { x: 12, y: 13 }, randomUUID(), 0);
  assert.ok([200, 429, 409].includes(tooSoon.status));
  const after = await h.world(actor);
  assert.equal(h.player(actor, after).x, 11);
  assert.equal(h.player(actor, after).y, 13);

  await h.walk(actor, 14, 13);
  expectRejected(await h.action(actor, 'interact'), [400, 409]);
  await h.walk(actor, 17, 8);
  const first = await h.action(actor, 'attack', {}, randomUUID(), 800);
  assert.equal(first.status, 200);
  const health = first.body.realm.enemies.find(enemy => enemy.id === 'bramble').hp;
  const cooldown = await h.action(actor, 'attack', {}, randomUUID(), 0);
  expectRejected(cooldown, [400, 409, 429]);
  assert.equal((await h.world(actor)).body.realm.enemies.find(enemy => enemy.id === 'bramble').hp, health);
});

test('quest XP credits a durable private stash once and survives leaving and restart', async t => {
  const h = harness(t);
  const actor = await h.account('Questbearer', 'knight');
  const originalId = actor.playerId;
  expectRejected(await h.action(actor, 'claim'), [400, 409]);

  await h.walk(actor, 7, 5);
  const crystalRequest = randomUUID();
  const crystal = await h.action(actor, 'interact', {}, crystalRequest);
  assert.equal(crystal.status, 200);
  assert.equal(crystal.body.profile.balanceXp, 10);
  const replay = await h.action(actor, 'interact', {}, crystalRequest);
  assert.equal(replay.status, 200);
  assert.equal(replay.body.profile.balanceXp, 10);
  const collision = await h.action(actor, 'move', { x: 8, y: 5 }, crystalRequest);
  expectRejected(collision, [400, 409]);

  await h.walk(actor, 24, 15);
  assert.equal((await h.action(actor, 'interact')).status, 200);
  for (const id of ['bramble', 'thistle', 'briar']) await h.defeat(actor, id);
  await h.walk(actor, 24, 5);
  assert.equal((await h.action(actor, 'interact')).status, 200);
  assert.equal(h.player(actor).hp, 100);

  const claimRequest = randomUUID();
  const claim = await h.action(actor, 'claim', {}, claimRequest);
  assert.equal(claim.status, 200);
  assert.equal(claim.body.profile.balanceXp, 165);
  assert.equal(claim.body.profile.lifetimeXp, 165);
  assert.equal(h.player(actor).claimed, true);
  assert.equal((await h.action(actor, 'claim', {}, claimRequest)).status, 200);
  expectRejected(await h.action(actor, 'claim'), [400, 409]);
  const before = (await h.stash(actor)).body.stash;
  assert.equal(before.balanceXp, 165);
  assert.equal(before.lifetimeXp, 165);
  assert.equal(before.history.reduce((sum, row) => sum + row.delta, 0), 165);
  assert.equal(new Set(before.history.map(row => row.id)).size, before.history.length);

  assert.equal((await h.game('/api/game/leave', { requestId: randomUUID() }, {
    cookie: actor.cookie,
  })).status, 200);
  assert.equal((await h.stash(actor)).body.stash.balanceXp, 165);
  h.restart();
  const preserved = await h.stash(actor);
  assert.equal(preserved.body.stash.balanceXp, 165);
  assert.equal(preserved.body.stash.lifetimeXp, 165);
  const resumed = await h.enter(actor);
  assert.equal(resumed.body.playerId, originalId);
  assert.equal(h.player(actor).claimed, true);
  assert.equal(h.player(actor).xp, 165);
  expectRejected(await h.action(actor, 'claim'), [400, 409]);
});

test('only contributors earn kill rewards; idle accounts cannot farm party XP', async t => {
  const h = harness(t);
  const fighter = await h.account('ActiveKnight', 'knight');
  const idle = await h.account('IdleRanger', 'ranger');
  await h.defeat(fighter, 'bramble');
  assert.equal((await h.stash(fighter)).body.stash.balanceXp, 15);
  assert.equal((await h.stash(idle)).body.stash.balanceXp, 0);

  await h.walk(fighter, 21, 13);
  await h.walk(idle, 21, 13);
  assert.equal((await h.action(idle, 'attack', {}, randomUUID(), 800)).status, 200);
  assert.equal((await h.action(fighter, 'attack', {}, randomUUID(), 800)).status, 200);
  const kill = await h.action(idle, 'attack', {}, randomUUID(), 800);
  assert.equal(kill.status, 200);
  assert.equal(kill.body.realm.enemies.find(enemy => enemy.id === 'thistle').hp, 0);
  assert.equal((await h.stash(fighter)).body.stash.balanceXp, 30);
  assert.equal((await h.stash(idle)).body.stash.balanceXp, 15);
});

test('public realm and event updates never contain private account or wallet records', async t => {
  const h = harness(t);
  const first = await h.account('PrivateFern');
  const second = await h.account('PrivateOak');
  await h.walk(first, 7, 5);
  assert.equal((await h.action(first, 'interact')).status, 200);
  const privateId = h.db.prepare('SELECT id FROM account_users WHERE email=?')
    .get(first.details.email).id;

  const otherStash = await h.game('/api/game/stash?userId=' + privateId, undefined, {
    cookie: second.cookie,
  });
  assert.equal(otherStash.status, 200);
  assert.equal(otherStash.body.stash.balanceXp, 0);
  assert.equal(otherStash.body.stash.lifetimeXp, 0);
  assert.deepEqual(otherStash.body.stash.history, []);

  const stream = h.events(second);
  await stream.start;
  assert.equal(stream.status, 200);
  assert.match(stream.headers['Content-Type'] || stream.headers['content-type'], /text\/event-stream/);
  const change = await h.action(second, 'chat', { text: 'Public party message' });
  assert.equal(change.status, 200);
  const rawEvents = stream.chunks.join('');
  assert.match(rawEvents, /event:\s*realm/);
  assert.match(rawEvents, /Public party message/);
  for (const secret of [privateId, first.details.email, second.details.email, 'balanceXp', 'balanceCopper', 'shopCreditPennies', 'lifetimeXp', 'password_hash', 'token_hash', 'history']) {
    assert.ok(!rawEvents.includes(secret), 'Private data leaked in events: ' + secret);
  }
  const publicJson = JSON.stringify(change.body.realm);
  for (const secret of [privateId, first.details.email, second.details.email, 'balanceXp', 'balanceCopper', 'shopCreditPennies', 'lifetimeXp']) {
    assert.ok(!publicJson.includes(secret), 'Private data leaked in realm: ' + secret);
  }
  const countBeforeClose = stream.chunks.length;
  stream.close();
  assert.equal((await h.action(second, 'chat', { text: 'After stream close' }, randomUUID(), 1200)).status, 200);
  assert.equal(stream.chunks.length, countBeforeClose, 'Closed streams must be removed from subscribers');
});


test('an open event stream revalidates and closes after its account session is revoked', async t => {
  const h = harness(t, { sseIntervalMs: 20 });
  const actor = await h.account('StreamGuardian');
  const stream = h.events(actor);
  await stream.start;
  assert.equal(stream.status, 200);
  h.db.prepare('UPDATE account_sessions SET revoked_at=CURRENT_TIMESTAMP WHERE token_hash=?')
    .run(digest(actor.cookie.slice('ef_session='.length)));
  let timeout;
  try {
    await Promise.race([
      stream.finished,
      new Promise((_, reject) => {
        timeout = setTimeout(() => reject(Error('Revoked event stream stayed open')), 1000);
      }),
    ]);
  } finally {
    clearTimeout(timeout);
  }
  assert.equal(stream.ended, true);
  assert.match(stream.chunks.join(''), /SIGN_IN_REQUIRED/);
  expectRejected(await h.action(actor, 'attack'), [401]);
});

test('unconfigured gear purchases and abilities cannot debit XP or invent money credit', async t => {
  const h = harness(t);
  const actor = await h.account('StashSaver');
  await h.walk(actor, 7, 5);
  assert.equal((await h.action(actor, 'interact')).status, 200);
  const before = (await h.stash(actor)).body.stash;
  assert.equal(before.balanceXp, 10);
  assert.equal(before.exchange.enabled, true);
  assert.equal(before.exchange.xpPerGold, 1250);
  assert.equal(before.exchange.copperPerGold, 1000);
  assert.equal(before.exchange.silverPerGold, 100);
  assert.equal(before.exchange.penniesPerGold, 1);
  assert.equal(before.shopCreditPennies, 0);
  assert.equal(before.balanceCopper, 0);
  assert.deepEqual(before.abilities, []);
  for (const kind of ['spend', 'redeem', 'unlock-ability']) {
    expectRejected(await h.action(actor, kind, {
      amount: -1000, price: 0, currencyCredit: 1000000, abilityId: 'forged',
    }), [400, 404, 409, 503]);
  }
  const after = (await h.stash(actor)).body.stash;
  assert.equal(after.balanceXp, 10);
  assert.equal(after.lifetimeXp, 10);
  assert.equal(after.balanceCopper, 0);
  assert.deepEqual(after.history, before.history);
});

function seedWallet(h, actor, xp, copper = 0) {
  h.db.prepare(
    'UPDATE game_wallets SET balance_xp=?,lifetime_xp=?,balance_copper=? '
    + 'WHERE user_id=(SELECT id FROM account_users WHERE email=?)',
  ).run(xp, xp, copper, actor.details.email);
}

function exchange(h, actor, lots, requestId = randomUUID(), extra = {}) {
  return h.game('/api/game/exchange', { requestId, lots, ...extra }, {
    cookie: actor.cookie,
  });
}

test('account XP converts exactly to durable gold without reducing lifetime experience', async t => {
  const h = harness(t);
  const actor = await h.account('CoinKeeper');
  seedWallet(h, actor, 5000);
  assert.equal((await h.game('/api/game/leave', { requestId: randomUUID() }, {
    cookie: actor.cookie,
  })).status, 200, 'Exchange must also work without an active game seat');

  const requestId = randomUUID();
  const first = await exchange(h, actor, 1, requestId);
  assert.equal(first.status, 200);
  assert.equal(first.body.stash.balanceXp, 3750);
  assert.equal(first.body.stash.lifetimeXp, 5000);
  assert.equal(first.body.stash.balanceCopper, 1000);
  assert.equal(first.body.stash.shopCreditPennies, 1);
  assert.equal(first.body.stash.exchange.penniesPerGold, 1);
  assert.deepEqual(first.body.stash.coins, { gold: 1, silver: 0, copper: 0 });
  assert.equal(first.body.stash.history.length, 2);
  assert.ok(first.body.stash.history.some(row => row.currency === 'XP'
    && row.delta === -1250 && row.balanceAfter === 3750));
  assert.ok(first.body.stash.history.some(row => row.currency === 'COPPER'
    && row.delta === 1000 && row.balanceAfter === 1000));
  const firstHistory = first.body.stash.history;

  const replay = await exchange(h, actor, 1, requestId);
  assert.equal(replay.status, 200);
  assert.equal(replay.body.stash.balanceXp, 3750);
  assert.equal(replay.body.stash.balanceCopper, 1000);
  assert.deepEqual(replay.body.stash.history, firstHistory);
  expectRejected(await exchange(h, actor, 2, requestId), [400, 409]);

  const second = await exchange(h, actor, 2);
  assert.equal(second.status, 200);
  assert.equal(second.body.stash.balanceXp, 1250);
  assert.equal(second.body.stash.balanceCopper, 3000);
  assert.equal(second.body.stash.shopCreditPennies, 3);
  assert.equal(second.body.stash.lifetimeXp, 5000);
  assert.deepEqual(second.body.stash.coins, { gold: 3, silver: 0, copper: 0 });

  h.restart();
  const saved = (await h.stash(actor)).body.stash;
  assert.equal(saved.balanceXp, 1250);
  assert.equal(saved.balanceCopper, 3000);
  assert.equal(saved.lifetimeXp, 5000);
  assert.equal(saved.history.length, 4);
  assert.equal(saved.history.filter(row => row.currency === 'XP')
    .reduce((sum, row) => sum + row.delta, 0), -3750);
  assert.equal(saved.history.filter(row => row.currency === 'COPPER')
    .reduce((sum, row) => sum + row.delta, 0), 3000);
});

test('conversion rejects invalid quantities, insufficient XP and unsafe balances atomically', async t => {
  const h = harness(t);
  const actor = await h.account('CoinGuard');
  seedWallet(h, actor, 1250);
  const body = { requestId: randomUUID(), lots: 1 };
  expectRejected(await h.game('/api/game/exchange', body, {
    cookie: actor.cookie, headers: { origin: 'https://other.example.test' },
  }), [403]);
  expectRejected(await h.game('/api/game/exchange', { lots: 1 }, {
    cookie: actor.cookie,
  }), [400]);
  for (const lots of [0, -1, 1.2, '1', 101, Number.MAX_SAFE_INTEGER, null, true]) {
    expectRejected(await exchange(h, actor, lots), [400]);
  }
  expectRejected(await exchange(h, actor, 2), [409]);
  const unchanged = (await h.stash(actor)).body.stash;
  assert.equal(unchanged.balanceXp, 1250);
  assert.equal(unchanged.balanceCopper, 0);
  assert.deepEqual(unchanged.history, []);

  seedWallet(h, actor, 1250, Number.MAX_SAFE_INTEGER - 500);
  expectRejected(await exchange(h, actor, 1), [400, 409]);
  const overflow = (await h.stash(actor)).body.stash;
  assert.equal(overflow.balanceXp, 1250);
  assert.equal(overflow.balanceCopper, Number.MAX_SAFE_INTEGER - 500);
  assert.equal(overflow.lifetimeXp, 1250);
  assert.deepEqual(overflow.history, []);

  seedWallet(h, actor, 1250, 295);
  const valid = await exchange(h, actor, 1);
  assert.equal(valid.status, 200);
  assert.equal(valid.body.stash.balanceXp, 0);
  assert.equal(valid.body.stash.balanceCopper, 1295);
  assert.equal(valid.body.stash.shopCreditPennies, 1);
  assert.deepEqual(valid.body.stash.coins, { gold: 1, silver: 29, copper: 5 });
  expectRejected(await exchange(h, actor, 1), [409]);
  const after = (await h.stash(actor)).body.stash;
  assert.equal(after.balanceXp, 0);
  assert.equal(after.balanceCopper, 1295);
  assert.equal(after.history.length, 2);
});

test('competing conversions cannot spend the same XP and another account cannot access the coins', async t => {
  const h = harness(t);
  const owner = await h.account('CoinOwner');
  const other = await h.account('CoinVisitor');
  seedWallet(h, owner, 1250);
  const outcomes = await Promise.all([
    exchange(h, owner, 1),
    exchange(h, owner, 1),
  ]);
  assert.deepEqual(outcomes.map(result => result.status).sort(), [200, 409]);
  const own = (await h.stash(owner)).body.stash;
  assert.equal(own.balanceXp, 0);
  assert.equal(own.balanceCopper, 1000);
  assert.equal(own.lifetimeXp, 1250);
  assert.equal(own.history.length, 2);

  const privateId = h.db.prepare('SELECT id FROM account_users WHERE email=?')
    .get(owner.details.email).id;
  const outsider = await h.game('/api/game/stash?userId=' + privateId, undefined, {
    cookie: other.cookie,
  });
  assert.equal(outsider.status, 200);
  assert.equal(outsider.body.stash.balanceXp, 0);
  assert.equal(outsider.body.stash.balanceCopper, 0);
  assert.deepEqual(outsider.body.stash.history, []);
  expectRejected(await exchange(h, other, 1, randomUUID(), {
    userId: privateId, balanceXp: 999999, balanceCopper: 999999,
  }), [400, 409]);
  assert.equal((await h.stash(owner)).body.stash.balanceCopper, 1000);
});
