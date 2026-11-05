import test from 'node:test';
import assert from 'node:assert/strict';
import { thumbDirection, createMovementGate, MOVE_INTERVAL_MS } from '../src/game/mobile-input.js';

test('thumb input has a dead zone and only requests server-valid cardinal steps', () => {
  assert.equal(thumbDirection(0, 0), null);
  assert.equal(thumbDirection(6, 8), null);
  assert.equal(thumbDirection(NaN, 40), null);
  assert.equal(thumbDirection(40, Infinity), null);
  assert.deepEqual(thumbDirection(30, 20), { x: 1, y: 0 });
  assert.deepEqual(thumbDirection(-30, 20), { x: -1, y: 0 });
  assert.deepEqual(thumbDirection(15, -30), { x: 0, y: -1 });
  assert.deepEqual(thumbDirection(-15, 30), { x: 0, y: 1 });
  for (let x = -100; x <= 100; x += 5) for (let y = -100; y <= 100; y += 5) {
    const step = thumbDirection(x, y);
    if (step) assert.equal(Math.abs(step.x) + Math.abs(step.y), 1);
  }
});

test('movement cadence throttles alternating sources without storing queued work', () => {
  const accept = createMovementGate();
  assert.ok(MOVE_INTERVAL_MS > 160, 'respects server move cooldown');
  assert.equal(accept(0), true);
  for (const now of [1, 100, 159, 160, 229]) assert.equal(accept(now), false);
  assert.equal(accept(230), true);
  assert.equal(accept(230), false);
  assert.equal(accept(NaN), false);
  assert.equal(accept(460), true);
  assert.equal(accept(2000), true);
  assert.equal(accept(2001), false, 'no burst after waiting');
});
