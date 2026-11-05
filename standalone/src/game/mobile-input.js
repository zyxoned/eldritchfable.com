// Client input intent only. Coordinates and movement authorization remain server-owned.
export const MOVE_INTERVAL_MS = 230;

export function thumbDirection(x, y, deadZone = 10) {
  if (!Number.isFinite(x) || !Number.isFinite(y) || Math.hypot(x, y) <= deadZone) return null;
  return Math.abs(x) > Math.abs(y) ? { x: Math.sign(x), y: 0 } : { x: 0, y: Math.sign(y) };
}

// One shared cadence for tap, held input, keyboard repeat and click-to-walk.
// Calls arriving while busy are dropped by the caller, never queued here.
export function createMovementGate(interval = MOVE_INTERVAL_MS) {
  let next = -Infinity;
  return now => {
    if (!Number.isFinite(now) || now < next) return false;
    next = now + interval;
    return true;
  };
}
