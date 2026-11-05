import test from 'node:test';
import assert from 'node:assert/strict';
import { REGIONS, regionWalkable, regionTile } from '../shared/world-catalog.mjs';
import { LANDMARKS } from '../shared/exploration-catalog.mjs';
import { tile } from '../server/game-rules.mjs';

test('Glade terrain is unchanged for existing character positions', () => {
  for (let y = 0; y < 22; y++) for (let x = 0; x < 30; x++) assert.equal(regionTile('glade', x, y), tile(x, y));
});
test('every region has reachable camp, shrine, enemies, exits and discoveries', () => {
  for (const region of Object.values(REGIONS)) {
    const seen = new Set(); const queue = [region.spawn];
    for (let i = 0; i < queue.length; i++) {
      const p = queue[i]; const key = p.x + ',' + p.y;
      if (seen.has(key) || !regionWalkable(region.id, p.x, p.y)) continue;
      seen.add(key);
      for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) queue.push({ x: p.x + dx, y: p.y + dy });
    }
    for (const point of [region.spawn, region.shrine, ...region.enemies, ...region.exits, ...LANDMARKS.filter(l => l.regionId === region.id)]) {
      assert.ok(seen.has(point.x + ',' + point.y), region.id + ': unreachable ' + JSON.stringify(point));
    }
    for (const exit of region.exits) {
      assert.ok(REGIONS[exit.to], 'known destination');
      assert.ok(regionWalkable(exit.to, exit.arrival.x, exit.arrival.y), 'safe arrival');
      assert.ok(REGIONS[exit.to].exits.some(back => back.to === region.id), 'return journey exists');
    }
  }
});
test('regions reject bounds and nonintegral movement', () => {
  for (const region of Object.values(REGIONS)) {
    for (const [x, y] of [[-1, 1], [0, 13], [30, 13], [2.5, 13], [NaN, 13], [2, Infinity]]) assert.equal(regionWalkable(region.id, x, y), false);
  }
});
