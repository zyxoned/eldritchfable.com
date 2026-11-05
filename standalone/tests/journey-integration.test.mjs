import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, randomBytes } from 'node:crypto';
import { Readable } from 'node:stream';
import { EventEmitter } from 'node:events';
import { fixture } from './helpers.mjs';
import { digest } from '../server/database.mjs';
import { createGameService } from '../server/game.mjs';

import { syntheticAuthoredContent as content } from './fixtures/authored-content.mjs';

function harness(t) {
  const f = fixture(t); let time = Date.now();
  let service = createGameService(f.db, { origin: f.origin, now: () => time, authoredContent: content });
  t.after(() => service.close());
  async function request(a, path, input) {
    const req = Readable.from(input ? [JSON.stringify(input)] : []);
    req.method = input ? 'POST' : 'GET'; req.url = path;
    req.headers = { origin: f.origin, 'content-type': 'application/json', cookie: a.cookie }; req.socket = { remoteAddress: '127.0.0.1' };
    const res = new EventEmitter(); const result = {};
    res.writeHead = status => { result.status = status; }; res.end = text => { result.body = text ? JSON.parse(text) : null; res.emit('close'); };
    await service.route(req, res, path);
    if (result.status === 200 && result.body.realm) a.view = result.body;
    return result;
  }
  async function actor(name, mode = 'solo') {
    const userId = randomUUID(), token = randomBytes(32).toString('hex');
    f.db.prepare('INSERT INTO account_users(id,email,password_hash,email_verified_at) VALUES(?,?,?,?)').run(userId, name + '@example.test', 'fixture', new Date(time).toISOString());
    f.db.prepare('INSERT INTO account_sessions(token_hash,user_id,expires_at) VALUES(?,?,?)').run(digest(token), userId, new Date(time + 86400000).toISOString());
    const a = { userId, cookie: 'ef_session=' + token };
    ok(await request(a, '/api/game/join', { requestId: randomUUID(), name, heroClass: 'ranger', mode })); return a;
  }
  function action(a, kind, extra = {}, requestId = randomUUID()) {
    time += 1000;
    return request(a, '/api/game/action', { requestId, partyId: a.view.realm.partyId, regionId: a.view.realm.regionId, scopeId: a.view.realm.scopeId, kind, ...extra });
  }
  return { ...f, actor, action, request, restart() { service.close(); service = createGameService(f.db, { origin: f.origin, now: () => time, authoredContent: content }); }, at(a, x, y) { f.db.prepare('UPDATE game_characters SET x=?,y=? WHERE user_id=?').run(x, y, a.userId); } };
}
const ok = result => { assert.equal(result.status, 200, JSON.stringify(result.body)); return result.body; };
async function clear(h, a, routeId) {
  h.at(a, 11, 13);
  ok(await h.action(a, 'expeditionDiscover', { routeId }));
  ok(await h.action(a, 'expeditionEnter', { routeId }));
  ok(await h.action(a, 'expeditionAttack'));
  ok(await h.action(a, 'expeditionAdvance'));
  return ok(await h.action(a, 'expeditionAttack'));
}

test('actual action envelopes carry discovery through saved routes and earned scene without leaking to outsiders', async t => {
  const h = harness(t); const a = await h.actor('JourneyA'); const outsider = await h.actor('JourneyB');
  assert.ok(!JSON.stringify(a.view.realm).includes('Private terminal'));
  assert.ok(!JSON.stringify(outsider.view).includes('Earned meeting'));
  const before = h.db.prepare('SELECT * FROM game_wallets WHERE user_id=?').get(a.userId);
  await clear(h, a, 'path-0');
  assert.equal(a.view.realm.authored?.encounter, undefined);
  ok(await h.action(a, 'expeditionReturn'));
  await clear(h, a, 'path-1');
  assert.equal(a.view.realm.journey.active, null);
  const encounter = a.view.realm.authored.encounter;
  assert.equal(encounter.title, 'Earned meeting');
  assert.equal(h.db.prepare('SELECT COUNT(*) AS n FROM game_authored_witnesses WHERE witnessed_at IS NOT NULL').get().n, 0);
  assert.equal((await h.action(a, 'move', { x: 12, y: 13 })).status, 409);
  ok(await h.action(a, 'encounterAttack', { eventId: encounter.id }));
  ok(await h.action(a, 'encounterAttack', { eventId: encounter.id }));
  assert.equal(a.view.realm.authored.encounter.canContinue, true);
  const requestId = randomUUID(); const scopeId = a.view.realm.scopeId;
  const done = ok(await h.action(a, 'encounterContinue', { eventId: encounter.id, sceneKey: 'defeat' }, requestId));
  assert.equal(done.realm.authored.equipment.length, 1); assert.equal(done.realm.authored.encounter, null);
  const replay = ok(await h.action(a, 'encounterContinue', { eventId: encounter.id, sceneKey: 'defeat', scopeId }, requestId));
  assert.equal(replay.realm.authored.equipment.length, 1);
  assert.deepEqual(h.db.prepare('SELECT * FROM game_wallets WHERE user_id=?').get(a.userId), before);
  h.restart();
  const saved = ok(await h.request(a, '/api/game/world'));
  assert.equal(saved.realm.authored.equipment.length, 1);
  const other = ok(await h.request(outsider, '/api/game/world'));
  assert.ok(!JSON.stringify(other).includes('Earned meeting'));
  assert.ok(!JSON.stringify(other).includes('Earned ranger relic'));
});

test('stale scope packets cannot act on a later chamber but confirmed receipt replays stay safe', async t => {
  const h = harness(t); const a = await h.actor('ScopeA'); h.at(a, 11, 13);
  ok(await h.action(a, 'expeditionDiscover', { routeId: 'path-0' }));
  ok(await h.action(a, 'expeditionEnter', { routeId: 'path-0' }));
  const firstScope = a.view.realm.scopeId;
  const requestId = randomUUID(); ok(await h.action(a, 'expeditionAttack', {}, requestId));
  ok(await h.action(a, 'expeditionAdvance'));
  const current = a.view.realm.journey.active.enemy.hp;
  const stale = await h.action(a, 'expeditionAttack', { scopeId: firstScope });
  assert.equal(stale.body.code, 'SCOPE_CHANGED');
  assert.equal(a.view.realm.journey.active.enemy.hp, current);
  ok(await h.action(a, 'expeditionAttack', { scopeId: firstScope }, requestId));
  assert.equal(a.view.realm.journey.active.enemy.hp, current);
});
