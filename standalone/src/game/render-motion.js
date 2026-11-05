// Render only acknowledged coordinates. This never predicts, authorizes or queues input.
export const LOCAL_MOVE_MS = 120;
export const REMOTE_MOVE_MS = 160;
export const MAX_RENDER_ACTORS = 10;
export const MAX_RENDER_EFFECTS = 96;

export function createPose(x, y, stamp = 0) {
  return { x, y, targetX: x, targetY: y, fromX: x, fromY: y, startedAt: stamp,
    duration: 0, heading: Math.PI / 2, phase: 0, speed: 0, leanX: 0, leanY: 0 };
}

export function advancePose(pose, x, y, stamp, delta, { local = false, reducedMotion = false, tileSize = 32 } = {}) {
  const targetChanged = x !== pose.targetX || y !== pose.targetY;
  if (targetChanged) {
    const jump = Math.hypot(x - pose.targetX, y - pose.targetY);
    pose.fromX = pose.x;
    pose.fromY = pose.y;
    pose.targetX = x;
    pose.targetY = y;
    pose.startedAt = stamp;
    // Recovery and authoritative corrections are visible immediately, never walked through.
    pose.duration = reducedMotion || jump > tileSize * 1.05 ? 0 : local ? LOCAL_MOVE_MS : REMOTE_MOVE_MS;
    if (jump > tileSize * 1.05) { pose.fromX = x; pose.fromY = y; }
  }
  const progress = reducedMotion || !pose.duration ? 1 : Math.min(1, Math.max(0, (stamp - pose.startedAt) / pose.duration));
  const oldX = pose.x, oldY = pose.y;
  // Finite interpolation reaches the exact server tile instead of trailing indefinitely.
  pose.x = pose.fromX + (pose.targetX - pose.fromX) * progress;
  pose.y = pose.fromY + (pose.targetY - pose.fromY) * progress;
  const dx = pose.x - oldX, dy = pose.y - oldY;
  const distance = Math.hypot(dx, dy);
  const walking = progress < 1 || distance > .1;
  pose.speed = walking && !reducedMotion ? Math.min(3.8, distance / tileSize / Math.max(.008, delta)) : 0;
  const travelX = pose.targetX - pose.fromX, travelY = pose.targetY - pose.fromY;
  if (walking && Math.hypot(travelX, travelY) > 0) {
    const desired = Math.atan2(travelY, travelX);
    const turn = Math.atan2(Math.sin(desired - pose.heading), Math.cos(desired - pose.heading));
    pose.heading += turn * Math.min(1, delta * 22);
    if (!reducedMotion) pose.phase += distance / tileSize * 8.5;
  }
  const blend = Math.min(1, delta * 18);
  pose.leanX += ((walking && !reducedMotion ? Math.sign(travelX) * .035 : 0) - pose.leanX) * blend;
  pose.leanY += ((walking && !reducedMotion ? Math.sign(travelY) * .025 : 0) - pose.leanY) * blend;
  return walking && !reducedMotion;
}

// Server effects are already bounded; this also bounds work during mixed-version replies.
export function visibleEffects(effects, now) {
  return (Array.isArray(effects) ? effects : []).slice(-MAX_RENDER_EFFECTS)
    .filter(effect => Number.isFinite(effect.at) && now - effect.at >= 0 && now - effect.at <= 1600);
}
