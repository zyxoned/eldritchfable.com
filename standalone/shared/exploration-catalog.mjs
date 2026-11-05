// Public environmental sketches only. These grant no XP, items or account progress.
export const LANDMARKS = Object.freeze([
  { regionId: 'glade', id: 'camp-lantern', x: 11, y: 13, title: 'A light for the road', motif: 'lantern', text: 'A lantern hangs beside the camp, low enough for a traveller to tend. The road beyond it is open. You may follow the company, look around alone, or stay by the fire a little longer.' },
  { regionId: 'glade', id: 'bridge-marks', x: 6, y: 12, title: 'Footsteps over water', motif: 'post', text: 'The bridge rails are smooth where many hands have rested. Below, the brook carries leaves past the same stones. You note the crossing in your journal: a useful way home, not a promise to go farther.' },
  { regionId: 'glade', id: 'ivy-stones', x: 18, y: 4, title: 'What the ivy keeps', motif: 'stone', text: 'Ivy has found the gaps in a low stone wall. Nothing here tells the whole story. You sketch the surviving pattern without guessing at the missing pieces.' },
  { regionId: 'glade', id: 'shrine-ribbon', x: 23, y: 6, title: 'A kindness left behind', motif: 'ribbon', text: 'A faded ribbon rests near the shrine. Someone tied it carefully, then went on their way. You leave it where it is and remember the small gesture.' },
  { regionId: 'glade', id: 'brook-reeds', x: 8, y: 18, title: 'The quiet bank', motif: 'reeds', text: 'Reeds bend toward the water, then rise again. For a moment the glade is only wind and running water. The camp road is still there when you are ready to return.' },
  { regionId: 'amberReach', id: 'amber-waystones', x: 4, y: 13, title: 'The road remembers', motif: 'stone', text: 'Three low stones mark the road through the long grass. Their worn sides face the same direction, toward a gap in the hills. You sketch the shape of that gap: a landmark for a return journey, not an order to keep walking.' },
  { regionId: 'amberReach', id: 'amber-pool', x: 10, y: 8, title: 'Sky held still', motif: 'reeds', text: 'A shallow pool keeps a small piece of sky between the ridges. A narrow track curves around its bank rather than through the grass. You follow it slowly, watching the wind move across the reflection.' },
  { regionId: 'amberReach', id: 'amber-shelter', x: 22, y: 5, title: 'Room for one more', motif: 'ribbon', text: 'An old shelter holds a dry bench and a peg for a travelling cloak. Someone has swept the doorway. Beyond it, the road bends toward the coast. You leave the place as ready for the next traveller as you found it.' },
  { regionId: 'mistHarbor', id: 'harbor-tide', x: 14, y: 16, title: 'Marks above the tide', motif: 'post', text: 'Pale lines on the dock posts show where the tide has been. Above them, a row of small notches counts something else: journeys, perhaps, or seasons. You record what you can see and leave the rest unanswered.' },
  { regionId: 'mistHarbor', id: 'harbor-lanterns', x: 11, y: 13, title: 'A shoreward light', motif: 'lantern', text: 'The lantern glass is cloudy with salt, but its warm light still reaches the path. These lights are for arriving as well as leaving. For now, the sheltered coast is the edge of your map.' },
  { regionId: 'mistHarbor', id: 'harbor-garden', x: 23, y: 6, title: 'Roots in salt air', motif: 'reeds', text: 'Tough little plants grow behind a wall of stacked stones. Shells catch the rain between their roots. Someone has made a garden here with what the shore offered, and tended it long enough for it to take hold.' },
]);

export function knownLandmarkIds(value) {
  return Array.isArray(value) ? [...new Set(value.filter(id => LANDMARKS.some(item => item.id === id)))] : [];
}

export function nearestLandmark(player, radius = 1.8) {
  if (!player || !Number.isFinite(player.x) || !Number.isFinite(player.y)) return null;
  return LANDMARKS.filter(item => item.regionId === (player.regionId || 'glade') && Math.hypot(item.x - player.x, item.y - player.y) <= radius)
    .sort((a, b) => Math.hypot(a.x - player.x, a.y - player.y) - Math.hypot(b.x - player.x, b.y - player.y))[0] || null;
}
