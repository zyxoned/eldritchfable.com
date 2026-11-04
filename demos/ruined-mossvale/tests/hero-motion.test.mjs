import test from 'node:test';
import assert from 'node:assert/strict';
import * as world from '../src/world.js';

const defaults = {
  skinTone: 'warm', hairColor: 'chestnut', hairStyle: 'cropped',
  outfit: 'class', accent: 'gold', build: 'balanced',
};
const start = () => {
  const game = world.createGame();
  game.hero.x = 20;
  game.hero.y = 27.8;
  return game;
};
const walk = (game, dx, dy, seconds = 1, hz = 60) => {
  for (let i = 0; i < seconds * hz; i++) world.moveHero(game, dx, dy, 1 / hz);
};
const storageFor = initial => {
  let value = initial;
  return {
    setItem(_key, data) { value = data; },
    getItem() { return value; },
    data() { return JSON.parse(value); },
  };
};

test('heroes accelerate with consistent travel at 30 Hz and 60 Hz; diagonals preserve speed', () => {
  const slow = start(), fast = start(), diagonal = start();
  world.moveHero(slow, 1, 0, 1 / 30);
  assert.ok(slow.hero.motion, 'motion state is initialized for every hero');
  assert.ok(slow.hero.motion.speed > 0 && slow.hero.motion.speed < 3.8);
  walk(slow, 1, 0, 29 / 30, 30);
  walk(fast, 1, 0);
  walk(diagonal, 1, -1, 0.5);
  const straight = start();
  walk(straight, 1, 0, 0.5);
  assert.ok(Math.abs(slow.hero.x - fast.hero.x) < 0.0001);
  assert.ok(Math.abs(Math.hypot(diagonal.hero.x - 20, diagonal.hero.y - 27.8) -
    (straight.hero.x - 20)) < 0.0001);
  assert.ok(Math.abs(fast.hero.motion.speed - 3.8) < 0.0001);
});

test('releasing input brakes in a short distance and plants the gait at rest', () => {
  const game = start();
  walk(game, 1, 0, 0.5);
  const releasedAt = game.hero.x;
  world.moveHero(game, 0, 0, 1 / 60);
  assert.ok(game.hero.x > releasedAt, 'a release carries a small amount of weight');
  assert.ok(game.hero.motion, 'motion state tracks braking');
  assert.ok(game.hero.motion.speed > 0 && game.hero.motion.speed < 3.8);
  walk(game, 0, 0, 0.3);
  assert.ok(game.hero.x - releasedAt < 0.3, 'braking must not become a long slide');
  assert.equal(game.hero.motion.speed, 0);
  assert.equal(game.moving, false);
  const planted = game.hero.motion.phase;
  walk(game, 0, 0);
  assert.equal(game.hero.motion.phase, planted);
});

test('a blocked hero has no velocity or gait progress; sliding along a wall stays possible', () => {
  const game = start();
  game.hero.x = 1.22;
  game.hero.y = 20;
  assert.ok(game.hero.motion, 'motion state exists');
  const phase = game.hero.motion.phase;
  walk(game, -1, 0);
  assert.equal(game.hero.x, 1.22);
  assert.equal(game.hero.motion.speed, 0);
  assert.equal(game.hero.motion.phase, phase);
  assert.equal(game.moving, false);
  walk(game, -1, -1, 0.5);
  assert.equal(game.hero.x, 1.22);
  assert.ok(game.hero.y < 20);
  assert.ok(game.hero.motion.phase > phase);
});

test('facing turns with bounded yaw and lean while attacks face the actual nearest target', () => {
  const game = start();
  world.moveHero(game, 1, 0, 1 / 60);
  assert.ok(game.hero.motion, 'motion heading exists');
  const turn = Math.atan2(Math.sin(game.hero.motion.heading + Math.PI / 2),
    Math.cos(game.hero.motion.heading + Math.PI / 2));
  assert.ok(turn > 0 && turn <= 14 / 60 + 0.00001);
  assert.ok(Math.hypot(game.hero.motion.leanX, game.hero.motion.leanY) <= 0.08001);
  world.enterLocation(game, 'cave');
  game.hero.x = 10.7;
  game.hero.y = 14;
  assert.equal(world.attack(game), true);
  assert.ok(Math.abs(game.hero.facingX + 1) < 0.00001);
  assert.ok(Math.abs(game.hero.facingY) < 0.00001);
  assert.ok(Math.abs(Math.cos(game.hero.motion.heading) + 1) < 0.00001);
});

test('explicit stop, travel and recovery clear momentum without changing appearance', () => {
  const game = start();
  walk(game, 1, 0, 0.5);
  assert.equal(typeof world.stopHero, 'function');
  const phase = game.hero.motion.phase;
  const facing = [game.hero.facingX, game.hero.facingY];
  world.stopHero(game);
  assert.equal(game.hero.motion.speed, 0);
  assert.equal(game.hero.motion.vx, 0);
  assert.equal(game.hero.motion.vy, 0);
  assert.equal(game.hero.motion.leanX, 0);
  assert.equal(game.hero.motion.leanY, 0);
  assert.equal(game.moving, false);
  assert.equal(game.hero.motion.phase, phase);
  assert.deepEqual([game.hero.facingX, game.hero.facingY], facing);
  const x = game.hero.x;
  world.moveHero(game, 0, 0, 0.1);
  assert.equal(game.hero.x, x);
  walk(game, 1, 0, 0.5);
  world.enterLocation(game, 'cave');
  assert.equal(game.hero.motion.speed, 0);
  walk(game, 0, -1, 0.5);
  world.recover(game);
  assert.equal(game.hero.motion.speed, 0);
  assert.deepEqual(game.hero.appearance, defaults);
});

test('old version 1 saves get cosmetic defaults and never restore velocity', () => {
  const game = start();
  delete game.hero.appearance;
  game.hero.motion = { vx: 999, vy: 999, speed: 999, phase: 999 };
  const restored = world.loadGame(storageFor(JSON.stringify(game)));
  assert.deepEqual(restored.hero.appearance, defaults);
  assert.equal(restored.hero.motion.speed, 0);
  assert.equal(restored.hero.motion.vx, 0);
  assert.equal(restored.hero.motion.vy, 0);
  assert.equal(restored.moving, false);
});

test('appearance persists as safe enum choices and remains cosmetic', async () => {
  const game = world.createGame('knight');
  assert.deepEqual(game.hero.appearance, defaults);
  const { defaultAppearance, sanitizeAppearance, resolveAppearance, APPEARANCE_OPTIONS } =
    await import('../src/appearance.js');
  const custom = { skinTone: 'deep', hairColor: 'silver', hairStyle: 'braid',
    outfit: 'ocean', accent: 'copper', build: 'broad' };
  game.hero.appearance = custom;
  walk(game, 1, 0, 0.1);
  const storage = storageFor('');
  assert.equal(world.saveGame(storage, game), true);
  assert.deepEqual(world.loadGame(storage).hero.appearance, custom);
  assert.equal(storage.data().hero.motion, undefined, 'transient momentum is not persisted');
  assert.equal(game.hero.hp, 100);
  assert.equal(world.CLASSES.knight.damage, 22);
  assert.deepEqual(defaultAppearance(), defaults);
  assert.deepEqual(sanitizeAppearance({ skinTone: '<script>', hairColor: '#fff',
    hairStyle: 'braid', outfit: 'url(evil)', accent: {}, build: '__proto__' }),
    { ...defaults, hairStyle: 'braid' });
  assert.deepEqual(sanitizeAppearance(null), defaults);
  const invalid = { skinTone: '<script>', hairColor: '#fff',
    hairStyle: 'braid', outfit: 'url(evil)', accent: {}, build: '__proto__' };
  const unsafeSave = { ...game, hero: { ...game.hero, appearance: invalid } };
  assert.deepEqual(world.loadGame(storageFor(JSON.stringify(unsafeSave))).hero.appearance,
    { ...defaults, hairStyle: 'braid' });

  assert.notEqual(defaultAppearance(), defaultAppearance());
  assert.equal(APPEARANCE_OPTIONS.skinTone.length, 6);
  assert.equal(APPEARANCE_OPTIONS.hairStyle.length, 4);
  const resolved = resolveAppearance(custom, '#d7a66b');
  for (const field of ['skin', 'hair', 'outfit', 'accent'])
    assert.match(resolved[field], /^#[0-9a-f]{6}$/i);
  assert.equal(resolved.hairStyle, 'braid');
  assert.ok(resolved.widthScale > 1);
  assert.equal(resolveAppearance(defaults, '#d7a66b').outfit, '#d7a66b');
  assert.match(resolveAppearance(defaults, 'url(evil)').outfit, /^#[0-9a-f]{6}$/i);
});
