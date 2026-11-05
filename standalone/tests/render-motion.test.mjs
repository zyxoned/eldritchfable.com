import test from 'node:test';
import assert from 'node:assert/strict';
import { createPose, advancePose, visibleEffects, LOCAL_MOVE_MS, MAX_RENDER_EFFECTS } from '../src/game/render-motion.js';

test('acknowledged movement reaches the exact tile within a fixed short duration', () => {
  const pose = createPose(0, 0);
  advancePose(pose, 32, 0, 1000, .016, { local: true });
  assert.equal(pose.x, 0);
  advancePose(pose, 32, 0, 1060, .016, { local: true });
  assert.equal(pose.x, 16);
  advancePose(pose, 32, 0, 1000 + LOCAL_MOVE_MS, .016, { local: true });
  assert.equal(pose.x, 32);
  assert.equal(pose.y, 0);
  assert.equal(advancePose(pose, 32, 0, 3000, .016, { local: true }), false);
});

test('new acknowledged targets replace interpolation without a movement queue or extrapolation', () => {
  const pose = createPose(0, 0);
  advancePose(pose, 32, 0, 0, .016, { local: true });
  advancePose(pose, 32, 0, 60, .016, { local: true });
  advancePose(pose, 0, 0, 60, .016, { local: true });
  advancePose(pose, 0, 0, 180, .016, { local: true });
  assert.equal(pose.x, 0);
  advancePose(pose, 0, 0, 5000, .016, { local: true });
  assert.equal(pose.x, 0);
});

test('recovery jumps and reduced motion snap rather than concealing corrections', () => {
  const pose = createPose(0, 0);
  advancePose(pose, 160, 96, 10, .016);
  assert.equal(pose.x, 160);
  assert.equal(pose.y, 96);
  advancePose(pose, 192, 96, 20, .016, { reducedMotion: true });
  assert.equal(pose.x, 192);
  assert.equal(pose.speed, 0);
});

test('rendered effects expire and have a fixed maximum', () => {
  const items = Array.from({ length: 10000 }, (_, i) => ({ id: String(i), at: 1000 }));
  assert.equal(visibleEffects(items, 1100).length, MAX_RENDER_EFFECTS);
  assert.equal(visibleEffects(items, 2700).length, 0);
  assert.equal(visibleEffects(items, 900).length, 0);
  assert.deepEqual(visibleEffects(null, 1100), []);
});
