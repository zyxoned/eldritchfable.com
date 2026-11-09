import assert from 'node:assert/strict';
import test from 'node:test';
import { analogAxes, cameraRelative, createFreeWalk, steerView } from '../src/game/bellhouse/free-controls.mjs';

const idle = { x: 0, y: 0 }, east = { x: 1, y: 0 };
const origin = { x: 10, y: 13, scope: 'glade-a' };

test('movement keeps analog magnitude and follows the camera while look pitch is bounded', () => {
  const diagonal = analogAxes(1, -1);
  assert.ok(diagonal.x > .7 && diagonal.y < -.7);
  assert.ok(Math.abs(Math.hypot(diagonal.x, diagonal.y) - 1) < 1e-9);
  assert.deepEqual(analogAxes(.04, -.04), idle);
  const rotated = cameraRelative({ x: 0, y: -1 }, Math.PI / 2);
  assert.ok(Math.abs(rotated.x - 1) < 1e-9 && Math.abs(rotated.y) < 1e-9);
  assert.equal(steerView({ yaw: 0, pitch: .33 }, { x: 1, y: 1 }, 1).pitch, .74);
  assert.equal(steerView({ yaw: 0, pitch: .33 }, { x: 0, y: -1 }, 1).pitch, .11);
});

test('walking stays inside approved bounds and crosses with one request in flight', async () => {
  let finish;
  const requested = [];
  const update = createFreeWalk(() => true, (from, to) => {
    requested.push([from, to]);
    return new Promise(resolve => { finish = resolve; });
  });
  let point = update(origin, east, .06, 0, true);
  assert.ok(point.x > origin.x && point.x < origin.x + .5);
  for (let t = 60; t <= 720; t += 60) point = update(origin, east, .06, t, true);
  assert.equal(requested.length, 1);
  assert.deepEqual(requested[0][1], { x: 11, y: 13 });
  assert.ok(point.x < 10.5 && point.x > 10.49);
  finish(true);
  await Promise.resolve();
  const crossed = update({ ...origin, x: 11 }, idle, .06, 780, true);
  assert.ok(crossed.x > 10.5 && crossed.x - point.x < .01);
  assert.equal(update({ ...origin, x: 12 }, idle, .06, 840, true), null);
});

test('diagonal input slides along blocked edges without crossing through a corner', () => {
  const requested = [];
  const update = createFreeWalk((x, y) => x === 10 && y === 14, (_, to) => {
    requested.push(to);
    return Promise.resolve(false);
  });
  const diagonal = analogAxes(1, 1);
  let point;
  for (let t = 0; t < 700; t += 60) point = update(origin, diagonal, .06, t, true);
  assert.deepEqual(requested, [{ x: 10, y: 14 }]);
  assert.ok(point.x < 10.5 && point.y < 13.5);
  assert.equal(update({ ...origin, scope: 'different-party' }, idle, .06, 800, true), null);
});
