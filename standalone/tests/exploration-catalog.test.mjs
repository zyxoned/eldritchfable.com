import test from 'node:test';
import assert from 'node:assert/strict';
import { LANDMARKS, knownLandmarkIds, nearestLandmark } from '../shared/exploration-catalog.mjs';

test('public landmarks have distinct identities and stay on existing walkable terrain', () => {
  assert.equal(new Set(LANDMARKS.map(item => item.id)).size, LANDMARKS.length);
  for (const item of LANDMARKS) {
    const river = item.x >= 3 + Math.floor(item.y / 7) && item.x <= 5 + Math.floor(item.y / 7);
    assert.ok(!river || (item.y >= 11 && item.y <= 13));
    assert.ok(item.x >= 1 && item.x < 29 && item.y >= 1 && item.y < 21);
    assert.equal(nearestLandmark(item)?.id, item.id);
    assert.ok(item.text.length > 40);
  }
});
test('journal accepts only known unique IDs and nearby observations', () => {
  assert.deepEqual(knownLandmarkIds(['camp-lantern','forged','camp-lantern',null]), ['camp-lantern']);
  assert.deepEqual(knownLandmarkIds({ id:'camp-lantern' }), []);
  assert.equal(nearestLandmark(null), null);
  assert.equal(nearestLandmark({x:NaN,y:0}), null);
  assert.equal(nearestLandmark({x:28,y:20}), null);
});
