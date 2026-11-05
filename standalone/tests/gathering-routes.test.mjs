import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { Readable } from 'node:stream';
import { EventEmitter } from 'node:events';
import { fixture } from './helpers.mjs';
import { digest } from '../server/database.mjs';
import { createGameService } from '../server/game.mjs';
import { RESOURCE_NODES, GATHER_COOLDOWN_MS } from '../shared/skill-catalog.mjs';

function harness(t) {
  const f = fixture(t);
  let time = Date.now();
  let service = createGameService(f.db, { origin: f.origin, now: () => time });
  t.after(() => service.close());
  async function request(actor, path, data, headers = {}) {
    const req = Readable.from(data === undefined ? [] : [JSON.stringify(data)]);
    req.method = data === undefined ? 'GET' : 'POST'; req.url = path;
    req.headers = { origin: f.origin, 'content-type': 'application/json', cookie: actor.cookie, ...headers };
    req.socket = { remoteAddress: '127.0.0.1' };
    const result = {}; const res = new EventEmitter();
    res.writeHead = (status, responseHeaders) => Object.assign(result, { status, headers: responseHeaders });
    res.end = body => { result.body = body ? JSON.parse(body) : null; res.emit('close'); };
    assert.equal(await service.route(req, res, path), true);
    if (result.status === 200 && result.body.profile) actor.partyId = result.body.profile.partyId;
    return result;
  }
  async function actor(name, { admin = false, join = true } = {}) {
    const userId = randomUUID(); const token = randomBytes(32).toString('hex');
    f.db.prepare('INSERT INTO account_users(id,email,password_hash,email_verified_at,role) VALUES(?,?,?,?,?)').run(userId, name.toLowerCase() + '@example.test', 'test-session-only', new Date(time).toISOString(), admin ? 'admin' : 'customer');
    f.db.prepare('INSERT INTO account_sessions(token_hash,user_id,expires_at) VALUES(?,?,?)').run(digest(token), userId, new Date(time + 86400000).toISOString());
    const result = { userId, cookie: 'ef_session=' + token, sessionHash: digest(token) };
    if (join) ok(await request(result, '/api/game/join', { requestId: randomUUID(), name, heroClass: 'ranger' }));
    return result;
  }
  return {
    ...f, actor, request,
    action(actor, node, extras = {}, requestId = randomUUID()) { return request(actor, '/api/game/action', { requestId, partyId: actor.partyId, kind: 'gatherResource', nodeId: node.id, ...extras }); },
    consume(actor, materialId, extras = {}, requestId = randomUUID()) { return request(actor, '/api/game/action', { requestId, partyId: actor.partyId, kind: 'consumeSupply', materialId, ...extras }); },
    at(actor, node) { f.db.prepare('UPDATE game_characters SET region_id=?,x=?,y=? WHERE user_id=?').run(node.regionId, node.x, node.y, actor.userId); },
    advance(ms) { time += ms; },
    restart() { service.close(); service = createGameService(f.db, { origin: f.origin, now: () => time }); },
  };
}
function ok(result) { assert.equal(result.status, 200, JSON.stringify(result.body)); return result.body; }
const node = RESOURCE_NODES[0];

test('gathering action receipts replay once, reject conflicting payloads and preserve wallet rewards', async t => {
  const h = harness(t); const actor = await h.actor('RouteGatherer'); h.at(actor, node);
  const wallet = h.db.prepare('SELECT * FROM game_wallets WHERE user_id=?').get(actor.userId);
  const requestId = randomUUID();
  const first = ok(await h.action(actor, node, {}, requestId));
  assert.equal(first.profile.gathering.skills[0].xp, node.xp);
  assert.equal(first.profile.gathering.inventory[0].quantity, 1);
  assert.ok(first.realm.resourceNodes.find(row => row.id === node.id).availableAt > first.realm.serverTime);
  h.advance(node.regrowMs);
  const replay = ok(await h.action(actor, node, {}, requestId));
  assert.equal(replay.profile.gathering.skills[0].xp, node.xp); assert.equal(replay.profile.gathering.inventory[0].quantity, 1);
  assert.equal(replay.notice, first.notice);
  assert.equal((await h.action(actor, RESOURCE_NODES[1], {}, requestId)).body.code, 'REQUEST_CONFLICT');
  assert.equal(h.db.prepare('SELECT COUNT(*) AS count FROM game_requests WHERE user_id=? AND request_id=?').get(actor.userId, requestId).count, 1);
  assert.deepEqual(h.db.prepare('SELECT * FROM game_wallets WHERE user_id=?').get(actor.userId), wallet);
  assert.equal(h.db.prepare('SELECT COUNT(*) AS count FROM game_ledger WHERE user_id=?').get(actor.userId).count, 0);
  h.restart();
  assert.equal(ok(await h.request(actor, '/api/game/world')).profile.gathering.skills[0].xp, node.xp);
});

test('gathering rejects forged rewards, client clocks, remote positions and bad origin', async t => {
  const h = harness(t); const actor = await h.actor('RouteAuthority');
  const rejectedId = randomUUID();
  assert.equal((await h.action(actor, node, { x: node.x, y: node.y }, rejectedId)).body.code, 'RESOURCE_TOO_FAR');
  assert.equal(h.db.prepare('SELECT COUNT(*) AS count FROM game_requests WHERE request_id=?').get(rejectedId).count, 0);
  h.at(actor, node);
  const first = ok(await h.action(actor, node, { skillXp: 7600, quantity: 999, xp: 100000, balanceCopper: 100000, time: Number.MAX_SAFE_INTEGER }));
  assert.equal(first.profile.gathering.skills[0].xp, node.xp); assert.equal(first.profile.gathering.inventory[0].quantity, 1);
  assert.equal((await h.action(actor, node, { time: Number.MAX_SAFE_INTEGER, availableAt: 0 })).body.code, 'GATHER_COOLDOWN');
  h.advance(GATHER_COOLDOWN_MS);
  assert.equal((await h.action(actor, node, { time: Number.MAX_SAFE_INTEGER, availableAt: 0 })).body.code, 'RESOURCE_REGROWING');
  const denied = await h.request(actor, '/api/game/action', { requestId: randomUUID(), partyId: actor.partyId, kind: 'gatherResource', nodeId: node.id }, { origin: 'https://another.example.test' });
  assert.equal(denied.body.code, 'ORIGIN_REJECTED');
  assert.equal((await h.action(actor, node, { regionId: 'mistHarbor' })).body.code, 'REGION_CHANGED');
});

test('party sees resource regrowth but gathering XP and inventory remain private', async t => {
  const h = harness(t); const first = await h.actor('PrivateSkills'); const second = await h.actor('OtherSkills');
  assert.equal(first.partyId, second.partyId); h.at(first, node); h.at(second, node);
  const firstResult = ok(await h.action(first, node));
  const secondResult = ok(await h.request(second, '/api/game/world'));
  assert.equal(secondResult.profile.gathering.skills[0].xp, 0);
  assert.equal(secondResult.profile.gathering.inventory[0].quantity, 0);
  assert.equal(secondResult.realm.resourceNodes.find(row => row.id === node.id).availableAt, firstResult.realm.resourceNodes.find(row => row.id === node.id).availableAt);
  for (const key of ['inventory', 'totalGathered', 'cooldownUntil', 'balanceCopper', 'balanceXp']) assert.equal(JSON.stringify(secondResult.realm).includes('"' + key + '"'), false, key + ' is private');
  assert.equal((await h.action(second, node)).body.code, 'RESOURCE_REGROWING');
});

test('visitor gathering is blocked and receipt replay revalidates signed-in account access', async t => {
  const h = harness(t); const hero = await h.actor('RouteHost'); h.at(hero, node);
  const visitor = await h.actor('RouteVisitor', { admin: true, join: false });
  const visit = ok(await h.request(visitor, '/api/game/admin/join', { requestId: randomUUID() }));
  assert.equal(visit.profile.gathering, null);
  assert.equal((await h.action(visitor, node)).body.code, 'ADMIN_GATHERING_DISABLED');
  assert.equal(h.db.prepare('SELECT COUNT(*) AS count FROM game_skills WHERE user_id=?').get(visitor.userId).count, 0);
  const requestId = randomUUID(); ok(await h.action(hero, node, {}, requestId));
  h.db.prepare('UPDATE account_sessions SET revoked_at=? WHERE token_hash=?').run(new Date().toISOString(), hero.sessionHash);
  assert.equal((await h.action(hero, node, {}, requestId)).body.code, 'SIGN_IN_REQUIRED');
});

test('supply action consumes once on replay and derives healing and maximum health on the server', async t => {
  const h = harness(t); const actor = await h.actor('RouteSupplies');
  h.db.prepare('INSERT INTO game_combat_effects(user_id,effect_key,definition_json,acquired_at) VALUES(?,?,?,?)')
    .run(actor.userId, 'synthetic-health', JSON.stringify({ id: 'synthetic-health', name: 'Synthetic health', flat: { maxHp: 50 } }), 0);
  h.db.prepare('UPDATE game_characters SET hp=140 WHERE user_id=?').run(actor.userId);
  h.db.prepare('INSERT INTO game_materials(user_id,material_id,quantity) VALUES(?,?,?)').run(actor.userId, 'dewleaf', 3);
  const wallet = h.db.prepare('SELECT * FROM game_wallets WHERE user_id=?').get(actor.userId);
  const requestId = randomUUID(); const forged = { healHp: 1000000, hp: 1000000, maxHp: 1000000, quantity: 0 };
  const first = ok(await h.consume(actor, 'dewleaf', forged, requestId));
  assert.equal(first.profile.character.hp, 148); assert.equal(first.profile.character.maxHp, 150);
  assert.equal(first.profile.gathering.inventory[0].quantity, 2);
  assert.match(first.notice, /Restored 8 HP/);
  h.advance(GATHER_COOLDOWN_MS);
  const replay = ok(await h.consume(actor, 'dewleaf', forged, requestId));
  assert.equal(replay.profile.character.hp, 148); assert.equal(replay.profile.gathering.inventory[0].quantity, 2);
  assert.equal((await h.consume(actor, 'brook-trout', forged, requestId)).body.code, 'REQUEST_CONFLICT');
  const second = ok(await h.consume(actor, 'dewleaf'));
  assert.equal(second.profile.character.hp, 150); assert.equal(second.profile.gathering.inventory[0].quantity, 1);
  h.advance(GATHER_COOLDOWN_MS);
  assert.equal((await h.consume(actor, 'dewleaf')).body.code, 'HEALTH_FULL');
  assert.deepEqual(h.db.prepare('SELECT * FROM game_wallets WHERE user_id=?').get(actor.userId), wallet);
  assert.equal(h.db.prepare('SELECT COUNT(*) AS count FROM game_skills WHERE user_id=?').get(actor.userId).count, 0);
});

test('supplies cannot bypass authored admission, combat, forced loss or recovery scenes', async t => {
  const h = harness(t); const actor = await h.actor('SceneSupplies');
  h.db.prepare('UPDATE game_characters SET hp=40 WHERE user_id=?').run(actor.userId);
  h.db.prepare('INSERT INTO game_materials(user_id,material_id,quantity) VALUES(?,?,?)').run(actor.userId, 'dewleaf', 2);
  const eventId = randomUUID();
  const scene = { title: 'Synthetic scene', text: 'Synthetic test scene.' };
  const definition = { scenes: { arrival: scene, victory: scene, defeat: scene }, combat: { hp: 100 } };
  h.db.prepare('INSERT INTO game_authored_events(id,encounter_key,party_id,party_revision,content_version,definition_json,source_proof_json,phase,claim_kind,enemy_hp,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)')
    .run(eventId, 'synthetic-supply-lock', actor.partyId, 1, 'synthetic', JSON.stringify(definition), '[]', 'admission', 'repeat', 100, 0);
  h.db.prepare('INSERT INTO game_authored_members(event_id,user_id,hero_class,state) VALUES(?,?,?,?)').run(eventId, actor.userId, 'ranger', 'admitted');
  for (const phase of ['admission', 'combat', 'resolution', 'recovery']) {
    h.db.prepare("UPDATE game_authored_events SET phase=?,outcome='defeat' WHERE id=?").run(phase, eventId);
    const result = await h.consume(actor, 'dewleaf', { scopeId: 'event:' + eventId });
    assert.equal(result.body.code, 'ACTION_UNAVAILABLE', phase + ': ' + JSON.stringify(result.body));
    assert.equal(h.db.prepare('SELECT hp FROM game_characters WHERE user_id=?').get(actor.userId).hp, 40);
    assert.equal(h.db.prepare('SELECT quantity FROM game_materials WHERE user_id=? AND material_id=?').get(actor.userId, 'dewleaf').quantity, 2);
  }
});
