import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { Readable } from 'node:stream';
import { fixture, verifiedAccount, loginCookie } from './helpers.mjs';
import { createGameService } from '../server/game.mjs';

function harness(t) {
  const f = fixture(t);
  let clock = Date.now();
  const makeService = () => createGameService(f.db, { origin: f.origin, now: () => clock });
  let service = makeService();
  t.after(() => service.close());

  async function request(actor, path, data) {
    const req = Readable.from(data === undefined ? [] : [JSON.stringify(data)]);
    req.method = data === undefined ? 'GET' : 'POST';
    req.url = path;
    req.socket = { remoteAddress: '127.0.0.1' };
    req.headers = { origin: f.origin, 'content-type': 'application/json', cookie: actor.cookie };
    const res = new EventEmitter();
    let status, body;
    res.writeHead = code => { status = code; };
    res.end = text => { body = JSON.parse(text); res.emit('close'); };
    assert.equal(await service.route(req, res, path), true, path);
    if (status === 200 && body.realm) actor.view = body;
    return { status, body };
  }

  async function account(name, { solo = false, visitor = false } = {}) {
    const details = { email: name.toLowerCase() + '@example.test', password: 'synthetic-quarry-password' };
    await verifiedAccount(f, details);
    const actor = { cookie: await loginCookie(f, details), name, details };
    if (visitor) {
      f.db.prepare("UPDATE account_users SET role='admin' WHERE email=?").run(details.email);
      success(await request(actor, '/api/game/admin/join', { requestId: randomUUID() }));
    } else {
      success(await request(actor, '/api/game/join', {
        requestId: randomUUID(), name, heroClass: 'ranger', mode: solo ? 'solo' : 'open',
      }));
    }
    return actor;
  }

  function action(actor, verb, extra = {}, requestId = randomUUID()) {
    clock += verb === 'strike' ? 850 : 230;
    const { realm, profile } = actor.view;
    return request(actor, '/api/game/action', {
      requestId, partyId: profile.partyId, regionId: realm.regionId, scopeId: realm.scopeId,
      kind: 'quarry', verb, ...extra,
    });
  }

  async function walk(actor, targetX, targetY = 2) {
    let current = actor.view.realm.quarry;
    assert.ok(current, 'actor must be inside the quarry');
    for (let i = 0; i < 20 && (current.x !== targetX || current.y !== targetY); i++) {
      const dx = Math.sign(targetX - current.x);
      const dy = dx === 0 ? Math.sign(targetY - current.y) : 0;
      current = success(await action(actor, 'move', { dx, dy })).realm.quarry;
    }
    assert.deepEqual([current.x, current.y], [targetX, targetY]);
  }

  async function refresh(actor) { return success(await request(actor, '/api/game/world')); }
  function restart() { service.close(); service = makeService(); }
  return { account, request, action, walk, refresh, restart };
}

function success(result) {
  assert.equal(result.status, 200, JSON.stringify(result.body));
  return result.body;
}

function denied(result) {
  assert.ok(result.status >= 400 && result.status < 500, JSON.stringify(result));
}

test('two contributors discover, descend and return individually with durable progression', async t => {
  const h = harness(t);
  const first = await h.account('FirstBell');
  const second = await h.account('SecondBell');
  assert.equal(first.view.profile.partyId, second.view.profile.partyId);
  const startingXp = [first.view.profile.lifetimeXp, second.view.profile.lifetimeXp];
  const outside = first.view.realm.scopeId;
  assert.equal(first.view.realm.quarry, null);
  for (const actor of [first, second]) {
    const market = success(await h.action(actor, 'enter')).realm.quarry;
    assert.equal(market.scene, 'market');
    assert.ok(market.npc);
    assert.equal(market.tune, null);
  }
  denied(await h.action(first, 'travel'));
  await h.walk(first, 3);
  const smith = success(await h.action(first, 'talk')).realm.quarry;
  assert.deepEqual([...smith.tune].sort(), ['high', 'low', 'mid']);
  assert.equal((await h.refresh(second)).realm.quarry.tune, null);
  denied(await h.action(first, 'move', { dx: 1, dy: 0, scopeId: outside }));
  for (const actor of [first, second]) {
    await h.walk(actor, 11);
    const gate = success(await h.action(actor, 'travel')).realm.quarry;
    assert.equal(gate.scene, 'gate');
    assert.ok(gate.foe.hp > 0);
    await h.walk(actor, 3);
  }

  const strikeId = randomUUID();
  const hit = success(await h.action(first, 'strike', {}, strikeId)).realm.quarry.foe.hp;
  const replayHit = success(await h.action(first, 'strike', {}, strikeId));
  assert.equal(replayHit.realm.quarry.foe.hp, hit, 'replayed attack applies once');
  success(await h.action(second, 'strike'));
  let rounds = 0;
  while ((await h.refresh(first)).realm.quarry.foe?.hp > 0 && rounds++ < 20) {
    success(await h.action(rounds % 2 ? first : second, 'strike'));
  }
  assert.ok(rounds < 20, 'the encounter must resolve');
  for (const [index, actor] of [first, second].entries()) {
    const won = await h.refresh(actor);
    assert.equal(won.profile.lifetimeXp, startingXp[index] + 100);
    assert.equal(won.realm.quarry.level, 1 + Math.floor(won.profile.lifetimeXp / 100));
    assert.equal(won.realm.quarry.skill, true);
    assert.equal(won.realm.quarry.owned, false);
  }

  const claimId = randomUUID();
  const drop = success(await h.action(first, 'claim', {}, claimId));
  assert.equal(drop.realm.quarry.owned, true);
  success(await h.action(first, 'claim', {}, claimId));
  const anotherClaim = await h.action(first, 'claim');
  if (anotherClaim.status !== 200) denied(anotherClaim);
  const stash = success(await h.request(first, '/api/game/stash'));
  assert.equal(stash.stash.lifetimeXp, startingXp[0] + 100);
  assert.equal(stash.stash.history.filter(row => row.currency === 'XP' && row.delta === 100).length, 1);
  assert.equal(success(await h.action(first, 'equip')).realm.quarry.equipped, true);

  await h.walk(second, 6);
  const heard = success(await h.action(second, 'listen')).realm.quarry;
  assert.deepEqual(heard.tune, smith.tune);
  await h.walk(first, 9);
  const otherNote = smith.tune.find(note => note !== smith.tune[0]);
  assert.equal(success(await h.action(first, 'ring', { note: otherNote })).realm.quarry.progress, 0);
  for (const note of smith.tune) success(await h.action(first, 'ring', { note }));
  assert.equal(first.view.realm.quarry.opened, true);
  await h.walk(first, 11);
  const entered = success(await h.action(first, 'descend')).realm.quarry;
  assert.equal(entered.scene, 'deep');
  const stillAtGate = (await h.refresh(second)).realm.quarry;
  assert.equal(stillAtGate.scene, 'gate');
  assert.equal(stillAtGate.actors.some(row => row.id === first.view.playerId), false);
  await h.walk(second, 11);
  success(await h.action(second, 'descend'));
  await h.walk(second, 6);
  denied(await h.action(second, 'pulse'));
  await h.walk(first, 6);
  assert.equal(success(await h.action(first, 'pulse')).realm.quarry.primed, true,
    'the equipped bracer reaches the counterweight from three spaces away');

  h.restart();
  const resumed = (await h.refresh(first)).realm.quarry;
  assert.equal(resumed.scene, 'deep');
  assert.equal(resumed.equipped, true);
  assert.deepEqual(resumed.tune, smith.tune);
  for (const actor of [first, second]) {
    await h.walk(actor, 9);
    const home = success(await h.action(actor, 'return')).realm.quarry;
    assert.equal(home.scene, 'market');
    assert.equal(home.completed, true);
    assert.ok(home.journal.length > 0);
    assert.equal(success(await h.action(actor, 'leave')).realm.quarry, null);
  }
});

test('separate party and support visitor see no quarry party state or ordinary rewards', async t => {
  const h = harness(t);
  const local = await h.account('GuildBell');
  const traveler = await h.account('SoloBell', { solo: true });
  const visitor = await h.account('VisitBell', { visitor: true });
  assert.notEqual(local.view.profile.partyId, traveler.view.profile.partyId);
  denied(await h.action(visitor, 'enter'));
  assert.equal((await h.refresh(visitor)).realm.quarry, null);

  for (const actor of [local, traveler]) success(await h.action(actor, 'enter'));
  await h.walk(local, 3);
  const observed = success(await h.action(local, 'talk')).realm.quarry;
  assert.equal(observed.tune.length, 3);
  const separate = (await h.refresh(traveler)).realm.quarry;
  assert.equal(separate.tune, null);
  assert.equal(separate.actors.some(row => row.id === local.view.playerId), false);
  await h.walk(local, 11);
  success(await h.action(local, 'travel'));
  await h.walk(local, 3);
  success(await h.action(local, 'strike'));

  await h.walk(traveler, 11);
  const independentGate = success(await h.action(traveler, 'travel')).realm.quarry;
  assert.equal(independentGate.foe.hp, independentGate.foe.maxHp);
  assert.equal(independentGate.owned, false);
  denied(await h.action(traveler, 'claim'));
  assert.equal((await h.refresh(visitor)).profile.lifetimeXp, 0);
});
