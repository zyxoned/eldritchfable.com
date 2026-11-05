import test from 'node:test';
import assert from 'node:assert/strict';
import { PLAYER_CLASS_IDS } from '../shared/class-catalog.mjs';
import { STANCES, characterLevel, developmentFor, validDevelopmentChoice, outgoingDamage, incomingDamage, tacticalAdvice } from '../shared/character-development.mjs';

test('every calling has an original three-step path without changing level thresholds', () => {
  const titles = new Set();
  for (const id of PLAYER_CLASS_IDS) {
    const beginning = developmentFor(id, 0);
    assert.equal(beginning.level, 1);
    assert.deepEqual(beginning.availableStances, ['balanced']);
    assert.deepEqual(beginning.lessons.map(item => item.unlocked), [true, false, false]);
    beginning.lessons.forEach(item => titles.add(item.name));
    const trained = developmentFor(id, 200, 'focused', 'skill-opening');
    assert.equal(trained.level, 3);
    assert.equal(trained.stanceId, 'focused');
    assert.ok(trained.lessons.every(item => item.unlocked));
  }
  assert.equal(titles.size, PLAYER_CLASS_IDS.length * 3);
  assert.equal(characterLevel(99), 1); assert.equal(characterLevel(100), 2);
  assert.equal(characterLevel(199), 2); assert.equal(characterLevel(200), 3);
  assert.equal(characterLevel(-1), 1); assert.equal(characterLevel(NaN), 1);
  assert.equal(developmentFor('death-knight', 999), null);
  assert.equal(developmentFor('invented', 999), null);
});
test('invalid and locked selections cannot gain an unlocked stance', () => {
  assert.equal(validDevelopmentChoice('ranger', 0, 'focused', 'manual'), false);
  assert.equal(validDevelopmentChoice('ranger', 100, 'guarded', 'recovery-first'), true);
  assert.equal(validDevelopmentChoice('ranger', 200, 'focused', 'skill-opening'), true);
  assert.equal(validDevelopmentChoice('ranger', 200, 'invincible', 'manual'), false);
  assert.equal(validDevelopmentChoice('ranger', 200, 'balanced', 'auto-kill'), false);
  assert.equal(developmentFor('ranger', 0, 'focused', 'auto-kill').stanceId, 'balanced');
});
test('stance tradeoffs preserve default damage, armour blocks and minimum hits', () => {
  for (let damage = 1; damage < 40; damage++) {
    assert.equal(outgoingDamage(damage), damage);
    assert.equal(incomingDamage(damage), damage);
    assert.equal(outgoingDamage(damage, 'guarded'), Math.max(1, damage - 2));
    assert.equal(incomingDamage(damage, 'guarded'), Math.max(1, damage - 2));
    assert.equal(outgoingDamage(damage, 'focused'), damage + 2);
    assert.equal(incomingDamage(damage, 'focused'), damage + 2);
  }
  for (const stance of STANCES) assert.equal(incomingDamage(0, stance.id), 0);
  assert.equal(outgoingDamage(14, 'forged'), 14);
});
test('tactics remain explicit advice with no automatic action', () => {
  assert.match(tacticalAdvice(), /never acts automatically/);
  assert.match(tacticalAdvice({ tacticId: 'recovery-first', hp: 30 }), /recovery/);
  assert.match(tacticalAdvice({ tacticId: 'skill-opening', nearEnemy: true, readySkillName: 'Thorn shot' }), /Thorn shot/);
  assert.match(tacticalAdvice({ tacticId: 'skill-opening', nearEnemy: false, readySkillName: 'Thorn shot' }), /never acts/);
});
