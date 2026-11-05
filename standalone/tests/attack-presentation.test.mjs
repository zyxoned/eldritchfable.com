import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Readable } from 'node:stream';
import { EventEmitter } from 'node:events';
import { createGameService } from '../server/game.mjs';
import { CLASS_CATALOG, PLAYER_CLASS_IDS } from '../shared/class-catalog.mjs';
import { fixture, verifiedAccount, loginCookie } from './helpers.mjs';

const expected = {
  ranger: ['arrow', 14], knight: ['blade', 22], mage: ['arcane', 18], bard: ['notes', 12],
  cleric: ['radiance', 16], wizard: ['runes', 20], sorcerer: ['embers', 21], monk: ['palm', 17],
};

test('all regular callings have distinct named attack presentations; visitor stays generic', () => {
  assert.equal(new Set(PLAYER_CLASS_IDS.map(id => CLASS_CATALOG[id].attackStyle)).size, 8);
  for (const id of PLAYER_CLASS_IDS) {
    assert.equal(CLASS_CATALOG[id].attackStyle, expected[id][0]);
    assert.ok(CLASS_CATALOG[id].attackName.length > 3);
    assert.equal(CLASS_CATALOG[id].damage, expected[id][1]);
  }
  assert.equal(CLASS_CATALOG['death-knight'].attackStyle, 'generic');
});

for (const heroClass of PLAYER_CLASS_IDS) {
  test(heroClass + ' effects are server-selected without changing damage, rewards, or replay', async t => {
    const f = fixture(t);
    let clock = Date.now();
    const service = createGameService(f.db, { origin: f.origin, now: () => clock });
    t.after(() => service.close());
    await verifiedAccount(f);
    const cookie = await loginCookie(f);
    let partyId;
    async function request(path, extra = {}) {
      const input = { requestId: randomUUID(), ...(partyId ? { partyId } : {}), ...extra };
      const req = Readable.from([JSON.stringify(input)]);
      req.method = 'POST'; req.headers = { origin: f.origin, 'content-type': 'application/json', cookie };
      const result = {};
      const res = new EventEmitter();
      res.writeHead = status => { result.status = status; };
      res.end = body => { result.body = JSON.parse(body); };
      await service.route(req, res, path);
      assert.equal(result.status, 200, JSON.stringify(result.body));
      partyId = result.body.profile.partyId;
      return result.body;
    }
    const joined = await request('/api/game/join', { name: 'TestHero', heroClass });
    const enemy = joined.realm.enemies[0];
    f.db.prepare('UPDATE game_characters SET x=?,y=?').run(enemy.x, enemy.y);
    const forged = { attackStyle: 'execute', originX: -999, originY: -999, skillId: 'soul-reap', damage: 999999 };
    const requestId = randomUUID();
    const attacked = await request('/api/game/action', { kind: 'attack', requestId, ...forged });
    const effect = attacked.realm.effects.at(-1);
    assert.equal(effect.attackStyle, expected[heroClass][0]);
    assert.equal(effect.originX, enemy.x); assert.equal(effect.originY, enemy.y);
    assert.equal(effect.actorId, joined.playerId);
    assert.equal(effect.skillId, undefined);
    assert.equal(effect.regionId, 'glade');
    assert.deepEqual(Object.keys(effect).sort(), ['actorId', 'at', 'attackStyle', 'color', 'id', 'originX', 'originY', 'radius', 'regionId', 'type', 'x', 'y'].sort());
    assert.equal(attacked.realm.enemies[0].hp, 42 - expected[heroClass][1]);
    assert.equal(attacked.profile.lifetimeXp, 0);
    const replayed = await request('/api/game/action', { kind: 'attack', requestId, ...forged });
    assert.deepEqual(replayed.realm.effects, attacked.realm.effects);
    assert.equal(replayed.realm.enemies[0].hp, attacked.realm.enemies[0].hp);

    clock += 1000;
    const skill = CLASS_CATALOG[heroClass].skills[0];
    const cast = await request('/api/game/action', { kind: 'skill', ...forged, skillId: skill.id });
    const castEffect = cast.realm.effects.at(-1);
    assert.equal(castEffect.attackStyle, expected[heroClass][0]);
    assert.equal(castEffect.skillId, skill.id);
    assert.equal(castEffect.type, skill.type);
    assert.equal(cast.profile.cooldowns[skill.id], clock + skill.cooldownMs);
    const killed = expected[heroClass][1] + skill.damage >= 42;
    assert.equal(cast.realm.enemies[0].hp, Math.max(0, 42 - expected[heroClass][1] - skill.damage));
    assert.equal(cast.profile.lifetimeXp, killed ? 15 : 0);
  });
}

test('canvas variants and legacy fallback render finite geometry with optional metadata', async () => {
  const { readFileSync } = await import('node:fs');
  const { stripTypeScriptTypes } = await import('node:module');
  const { runInNewContext } = await import('node:vm');
  const source = readFileSync(new URL('../src/game/GameCanvas.tsx', import.meta.url), 'utf8');
  const helpers = source.slice(source.indexOf('function ellipse('), source.indexOf('function tree('));
  const effects = source.slice(source.indexOf('function paintClassAttack('), source.indexOf('export default function GameCanvas'));
  const context = {};
  runInNewContext(stripTypeScriptTypes('const S=32, TAU=Math.PI*2;\n' + helpers + effects + '\nthis.paintEffect=paintEffect;'), context);
  let calls = [];
  const canvas = new Proxy({}, {
    set(target, key, value) { target[key] = value; return true; },
    get(target, key) {
      if (key in target) return target[key];
      if (key === 'createRadialGradient') return () => ({ addColorStop() {} });
      return (...args) => { for (const arg of args) if (typeof arg === 'number') assert.ok(Number.isFinite(arg), key + ' has finite geometry'); calls.push([key, ...args]); };
    },
  });
  const base = { id: 'test', type: 'strike', x: 17, y: 8, color: '#abc', at: 0, actorId: 'hero', originX: 14, originY: 8 };
  for (const style of [...Object.values(expected).map(value => value[0]), 'generic', undefined, 'unknown-future-style']) {
    calls = [];
    context.paintEffect(canvas, { ...base, attackStyle: style }, 400);
    assert.ok(calls.some(call => call[0] === 'stroke' || call[0] === 'fill'), String(style) + ' draws');
  }
  calls = [];
  context.paintEffect(canvas, { ...base, originX: undefined, originY: undefined, attackStyle: 'arrow' }, 400);
  assert.ok(calls.length > 0);
  calls = [];
  context.paintEffect(canvas, { ...base, attackStyle: 'runes' }, 100, true);
  const first = JSON.stringify(calls);
  calls = [];
  context.paintEffect(canvas, { ...base, attackStyle: 'runes' }, 900, true);
  assert.equal(JSON.stringify(calls), first, 'reduced-motion geometry stays still');
});
