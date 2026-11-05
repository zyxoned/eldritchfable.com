// Public environmental sketches only. These grant no XP, items or account progress.
export const LANDMARKS = Object.freeze([
  { id: 'camp-lantern', x: 11, y: 13, title: 'A light for the road', motif: 'lantern', text: 'A lantern hangs beside the camp, low enough for a traveller to tend. The road beyond it is open. You may follow the company, look around alone, or stay by the fire a little longer.' },
  { id: 'bridge-marks', x: 6, y: 12, title: 'Footsteps over water', motif: 'post', text: 'The bridge rails are smooth where many hands have rested. Below, the brook carries leaves past the same stones. You note the crossing in your journal: a useful way home, not a promise to go farther.' },
  { id: 'ivy-stones', x: 18, y: 4, title: 'What the ivy keeps', motif: 'stone', text: 'Ivy has found the gaps in a low stone wall. Nothing here tells the whole story. You sketch the surviving pattern without guessing at the missing pieces.' },
  { id: 'shrine-ribbon', x: 23, y: 6, title: 'A kindness left behind', motif: 'ribbon', text: 'A faded ribbon rests near the shrine. Someone tied it carefully, then went on their way. You leave it where it is and remember the small gesture.' },
  { id: 'brook-reeds', x: 8, y: 18, title: 'The quiet bank', motif: 'reeds', text: 'Reeds bend toward the water, then rise again. For a moment the glade is only wind and running water. The camp road is still there when you are ready to return.' },
]);

export function knownLandmarkIds(value) {
  return Array.isArray(value) ? [...new Set(value.filter(id => LANDMARKS.some(item => item.id === id)))] : [];
}

export function nearestLandmark(player, radius = 1.8) {
  if (!player || !Number.isFinite(player.x) || !Number.isFinite(player.y)) return null;
  return LANDMARKS.filter(item => Math.hypot(item.x - player.x, item.y - player.y) <= radius)
    .sort((a, b) => Math.hypot(a.x - player.x, a.y - player.y) - Math.hypot(b.x - player.x, b.y - player.y))[0] || null;
}
