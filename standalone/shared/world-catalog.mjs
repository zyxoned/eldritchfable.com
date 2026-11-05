// Original public setting. Region travel never changes party membership or wallets.
export const DEFAULT_REGION_ID = 'glade';
export const REGIONS = Object.freeze({
  glade: {
    id: 'glade', name: 'Whispering Glade', subtitle: 'A sheltered woodland crossing', theme: 'forest', width: 30, height: 22,
    description: 'Follow the brook past the old shrine, then take the eastern trail into the wider world.',
    spawn: { x: 10, y: 13 }, shrine: { x: 24, y: 5 },
    crystals: [{ id: 'moon', x: 7, y: 5 }, { id: 'fern', x: 24, y: 15 }, { id: 'brook', x: 18, y: 17 }],
    enemies: [{ id: 'bramble', x: 17, y: 8 }, { id: 'thistle', x: 21, y: 13 }, { id: 'briar', x: 13, y: 5 }, { id: 'sprig', x: 26, y: 10 }],
    exits: [{ id: 'east-trail', name: 'Trail to Amber Reach', x: 28, y: 13, to: 'amberReach', arrival: { x: 2, y: 13 } }],
  },
  amberReach: {
    id: 'amberReach', name: 'Amber Reach', subtitle: 'Sunlit ridges and forgotten watchstones', theme: 'highlands', width: 30, height: 22,
    description: 'A long trade road crosses the gold-grass uplands. The coastal steps descend toward Mist Harbor.',
    spawn: { x: 10, y: 13 }, shrine: { x: 23, y: 5 }, crystals: [],
    enemies: [{ id: 'amberReach:ridge', x: 17, y: 8 }, { id: 'amberReach:stone', x: 21, y: 13 }, { id: 'amberReach:heather', x: 13, y: 5 }, { id: 'amberReach:watch', x: 26, y: 10 }],
    exits: [{ id: 'west-trail', name: 'Trail to Whispering Glade', x: 1, y: 13, to: 'glade', arrival: { x: 27, y: 13 } }, { id: 'coastal-steps', name: 'Steps to Mist Harbor', x: 28, y: 13, to: 'mistHarbor', arrival: { x: 2, y: 13 } }],
  },
  mistHarbor: {
    id: 'mistHarbor', name: 'Mist Harbor', subtitle: 'Tidal gardens under lantern light', theme: 'coast', width: 30, height: 22,
    description: 'Lanterns guide travelers through salt gardens and quiet docks at the edge of the explored coast.',
    spawn: { x: 10, y: 13 }, shrine: { x: 24, y: 5 }, crystals: [],
    enemies: [{ id: 'mistHarbor:reed', x: 17, y: 8 }, { id: 'mistHarbor:salt', x: 21, y: 13 }, { id: 'mistHarbor:tide', x: 13, y: 5 }, { id: 'mistHarbor:kelp', x: 26, y: 10 }],
    exits: [{ id: 'ridge-steps', name: 'Steps to Amber Reach', x: 1, y: 13, to: 'amberReach', arrival: { x: 27, y: 13 } }],
  },
});
export const regionById = id => REGIONS[id] || REGIONS[DEFAULT_REGION_ID];
export function regionTile(regionId, x, y) {
  if (regionId === 'amberReach') {
    if (y === 9 && x >= 4 && x <= 10) return 'water';
    if (y >= 12 && y <= 13 || x >= 22 && x <= 23 && y > 4 && y < 14) return 'path';
    return 'grass';
  }
  if (regionId === 'mistHarbor') {
    if (y >= 17 && x >= 7 && x <= 25) return x >= 14 && x <= 16 ? 'bridge' : 'water';
    if (y >= 12 && y <= 13 || x >= 22 && x <= 23 && y > 4 && y < 14) return 'path';
    return 'grass';
  }
  const river = x >= 3 + Math.floor(y / 7) && x <= 5 + Math.floor(y / 7);
  if (river && y >= 11 && y <= 13) return 'bridge';
  if (river) return 'water';
  if ((y >= 12 && y <= 13 && x < 23) || (x >= 22 && x <= 23 && y > 4 && y < 14)) return 'path';
  return 'grass';
}
export function regionWalkable(regionId, x, y) {
  const region = regionById(regionId);
  return Number.isInteger(x) && Number.isInteger(y) && x >= 1 && y >= 1
    && x < region.width - 1 && y < region.height - 1 && regionTile(region.id, x, y) !== 'water';
}
