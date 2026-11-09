import { MOVE_INTERVAL_MS } from '../mobile-input.js';

export const START_YAW = -2.2;
export const START_PITCH = .33;
const CELL_EDGE = .499;
const WALK_SPEED = 1000 / (MOVE_INTERVAL_MS * Math.SQRT2) * .94;
const STICK_DEAD_ZONE = .14;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function analogAxes(x, y) {
  const length = Math.hypot(x, y);
  if (length <= STICK_DEAD_ZONE) return { x: 0, y: 0 };
  const scale = (Math.min(length, 1) - STICK_DEAD_ZONE) / ((1 - STICK_DEAD_ZONE) * length);
  return { x: x * scale, y: y * scale };
}

export function movementAxes(input) {
  if (!input.keys.size) return input.move;
  let x = 0, y = 0;
  for (const [dx, dy] of input.keys.values()) { x += dx; y += dy; }
  return analogAxes(Math.sign(x), Math.sign(y));
}

export function steerView(view, look, seconds, dragX = 0, dragY = 0) {
  const yaw = view.yaw - look.x * seconds * 2.35 - dragX * .006;
  return {
    yaw: Math.atan2(Math.sin(yaw), Math.cos(yaw)),
    pitch: clamp(view.pitch + look.y * seconds * 1.4 + dragY * .0048, .11, .74),
  };
}

export function cameraRelative(axes, yaw) {
  const sine = Math.sin(yaw), cosine = Math.cos(yaw), forward = -axes.y;
  return { x: sine * forward - cosine * axes.x, y: cosine * forward + sine * axes.x };
}

function withinCell(position, cell) {
  return {
    x: clamp(position.x, cell.x - CELL_EDGE, cell.x + CELL_EDGE),
    y: clamp(position.y, cell.y - CELL_EDGE, cell.y + CELL_EDGE),
  };
}

// The visible hero can move freely inside the last accepted cell. At its edge
// Adventure authorizes a cardinal crossing through its existing move action.
export function createFreeWalk(walkable, sendStep) {
  let cell = null, position = null, pending = null, nextStepAt = -Infinity;
  return function update(accepted, direction, seconds, now, enabled, visiblePosition) {
    if (!accepted || !cell || accepted.scope !== cell.scope) {
      cell = accepted;
      position = pending = null;
      nextStepAt = -Infinity;
    } else if (cell.x !== accepted.x || cell.y !== accepted.y) {
      const crossed = pending?.x === accepted.x && pending?.y === accepted.y;
      position = crossed && position ? withinCell(position, accepted) : null;
      cell = accepted;
      pending = null;
    }
    if (pending?.done) pending = null;
    if (!enabled || !cell || (!direction.x && !direction.y)) return position;

    const from = position || withinCell(visiblePosition || cell, cell);
    const distance = Math.min(seconds, .065) * WALK_SPEED;
    const desired = { x: from.x + direction.x * distance, y: from.y + direction.y * distance };
    position = withinCell(desired, cell);
    if (pending || now < nextStepAt) return position;

    // When both edges are reached, ask for the earlier crossing first. A
    // blocked edge still lets the other axis slide along it.
    const crossings = [];
    if (desired.x !== position.x) {
      const x = cell.x + Math.sign(direction.x);
      if (walkable(x, cell.y)) crossings.push({ x, y: cell.y, at: Math.abs((position.x - from.x) / direction.x) });
    }
    if (desired.y !== position.y) {
      const y = cell.y + Math.sign(direction.y);
      if (walkable(cell.x, y)) crossings.push({ x: cell.x, y, at: Math.abs((position.y - from.y) / direction.y) });
    }
    const crossing = crossings.sort((a, b) => a.at - b.at)[0];
    if (crossing) {
      const request = { x: crossing.x, y: crossing.y, done: false };
      pending = request;
      nextStepAt = now + MOVE_INTERVAL_MS;
      const done = () => { request.done = true; };
      void Promise.resolve(sendStep(cell, { x: request.x, y: request.y })).then(done, done);
    }
    return position;
  };
}
