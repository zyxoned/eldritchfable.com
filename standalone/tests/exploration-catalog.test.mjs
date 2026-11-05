import test from 'node:test';
import assert from 'node:assert/strict';
import { regionWalkable } from '../shared/world-catalog.mjs';
import { LANDMARKS, knownLandmarkIds, nearestLandmark } from '../shared/exploration-catalog.mjs';

test('public landmarks have distinct identities and stay on existing walkable terrain', () => {
  assert.equal(new Set(LANDMARKS.map(item => item.id)).size, LANDMARKS.length);
  for (const item of LANDMARKS) {
    assert.ok(regionWalkable(item.regionId, item.x, item.y));
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

test('landmarks stay in their own region and old glade IDs remain discoverable', () => {
  assert.equal(nearestLandmark({ x: 11, y: 13 }).id, 'camp-lantern');
  assert.equal(nearestLandmark({ regionId: 'mistHarbor', x: 11, y: 13 }).id, 'harbor-lanterns');
  assert.equal(nearestLandmark({ regionId: 'amberReach', x: 11, y: 13 }), null);
  assert.equal(new Set(LANDMARKS.map(item => item.id)).size, LANDMARKS.length);
  for (const regionId of ['glade', 'amberReach', 'mistHarbor']) assert.ok(LANDMARKS.filter(item => item.regionId === regionId).length >= 3);
});
