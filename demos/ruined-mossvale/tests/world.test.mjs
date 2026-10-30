import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAPS, createGame, canWalk, findPath, enterLocation, moveHero,
  saveGame, loadGame, reveal, attack, useAbility, advanceCombat, recover
} from '../src/world.js';

test('a fresh hero can walk without accepting a quest; walls stay solid', () => {
  const game = createGame('ranger');
  const before = game.hero.x;
  moveHero(game, 1, 0, 0.25);
  assert.ok(game.hero.x > before);
  assert.equal(game.choices.helpedKeeper, false);
  assert.equal(canWalk('mossvale', 13, 19), false);
  const route = findPath('mossvale', game.hero, MAPS.mossvale.objects.find(o => o.target === 'cave'));
  assert.ok(route.length > 0);
  assert.ok(route.every(p => canWalk('mossvale', p.x, p.y)));
});

test('both short routes are independently reachable and local discoveries persist', () => {
  const game = createGame();
  enterLocation(game, 'temple');
  reveal(game);
  enterLocation(game, 'mossvale');
  enterLocation(game, 'cave');
  assert.equal(game.location, 'cave');
  assert.ok(game.visited.includes('temple'));
  assert.ok(game.visited.includes('mossvale'));
  assert.equal(game.cleared.temple, false);
});

test('save reload validates input and tolerates disabled or corrupted storage', () => {
  let value = '';
  const storage = { setItem: (_, data) => { value = data; }, getItem: () => value };
  const game = createGame('mage');
  game.choices.helpedKeeper = true;
  saveGame(storage, game);
  const restored = loadGame(storage);
  assert.equal(restored.hero.classId, 'mage');
  assert.equal(restored.choices.helpedKeeper, true);
  value = '{"version":1,"hero":{"x":"bad"}}';
  assert.equal(loadGame(storage).location, 'mossvale');
  assert.doesNotThrow(() => saveGame({ setItem() { throw new Error('blocked'); } }, game));
  assert.equal(loadGame({ getItem() { throw new Error('blocked'); } }).hero.hp, 100);
});

test('cleared encounters stay cleared across revisits and saved recovery', () => {
  const game = createGame('knight');
  enterLocation(game, 'cave');
  for (const enemy of game.enemies.cave) enemy.hp = 0;
  advanceCombat(game, 0.01);
  assert.equal(game.cleared.cave, true);
  enterLocation(game, 'mossvale');
  enterLocation(game, 'cave');
  assert.ok(game.enemies.cave.every(e => e.hp === 0));
  game.hero.hp = 0;
  game.dead = true;
  recover(game);
  assert.equal(game.hero.hp, 100);
  assert.equal(game.location, 'mossvale');
  assert.equal(game.cleared.cave, true);
});

test('combat has range/cooldowns and cleric healing does not exceed max health', () => {
  const game = createGame('cleric');
  enterLocation(game, 'cave');
  const enemy = game.enemies.cave[0];
  const original = enemy.hp;
  attack(game);
  assert.equal(enemy.hp, original);
  game.hero.x = enemy.x + 0.7;
  game.hero.y = enemy.y;
  attack(game);
  assert.ok(enemy.hp < original);
  const hp = enemy.hp;
  attack(game);
  assert.equal(enemy.hp, hp);
  game.hero.hp = 90;
  useAbility(game);
  assert.equal(game.hero.hp, 100);
});

test('telegraphed melee strikes use the shared circular attack radius', async () => {
  const { ENEMY_ATTACK_RADIUS } = await import('../src/world.js');
  assert.equal(ENEMY_ATTACK_RADIUS, 1.7);
  for (const [offset, expectedHp] of [[1.6, 90], [1.8, 100]]) {
    const game = createGame();
    enterLocation(game, 'cave');
    const enemy = game.enemies.cave[0];
    game.hero.x = enemy.x + offset;
    game.hero.y = enemy.y;
    enemy.windup = 0.01;
    advanceCombat(game, 0.02);
    assert.equal(game.hero.hp, expectedHp);
  }
});
