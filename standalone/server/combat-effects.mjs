// Stable combat-only arithmetic. Never pass financial/reward inputs into this module.
const STATS = Object.freeze(['maxHp', 'damage', 'healing', 'ward', 'armor', 'resourceMax', 'resourceRegen']);
// These two persisted fields share the SQLite storage bound. Other combat
// capabilities retain the existing lifetime progression up to safe integer range.
const STORAGE_STAT_LIMIT = 1000000;
const SAFE_STAT_LIMIT = Number.MAX_SAFE_INTEGER;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
export function validateCombatEffect(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('Invalid combat effect');
  for (const key of Object.keys(value)) if (!['id', 'name', 'flat', 'scale', 'cooldownScale'].includes(key)) throw Error('Unsupported combat effect field');
  if (typeof value.id !== 'string' || value.id.length > 100 || !value.id.length) throw Error('Invalid combat effect identity');
  if (typeof value.name !== 'string' || !value.name.length || value.name.length > 120) throw Error('Invalid combat effect name');
  for (const group of ['flat', 'scale']) {
    if (value[group] === undefined) continue;
    if (!value[group] || Array.isArray(value[group]) || typeof value[group] !== 'object') throw Error('Invalid combat effect values');
    for (const [key, number] of Object.entries(value[group])) {
      if (!STATS.includes(key) || !Number.isFinite(number)
        || (group === 'scale' ? number < 0.01 || number > 10 : Math.abs(number) > 10000)) throw Error('Invalid combat effect value');
    }
  }
  if (value.cooldownScale !== undefined && (!Number.isFinite(value.cooldownScale) || value.cooldownScale < 0.1 || value.cooldownScale > 10)) throw Error('Invalid cooldown effect');
  return value;
}
export function aggregateCombatStats(base, effects = []) {
  const result = {};
  // Sorting yields the same arithmetic after reload/re-equip regardless of query order.
  const stable = [...effects].map(validateCombatEffect).sort((a, b) => a.id.localeCompare(b.id));
  for (const key of STATS) {
    if (base[key] === undefined) continue;
    if (!Number.isFinite(base[key]) || base[key] < 0 || base[key] > SAFE_STAT_LIMIT) throw Error('Invalid base combat stat');
    const flat = stable.reduce((sum, effect) => sum + (effect.flat?.[key] || 0), 0);
    const scale = stable.reduce((product, effect) => product * (effect.scale?.[key] ?? 1), 1);
    const minimum = key === 'maxHp' ? 1 : 0;
    const maximum = ['maxHp', 'ward'].includes(key) ? STORAGE_STAT_LIMIT : SAFE_STAT_LIMIT;
    const unscaled = Math.max(0, base[key] + flat);
    // Avoid zero multiplied by an overflowing scale, and never return NaN,
    // Infinity or an unsafe integer to combat or SQLite.
    const value = unscaled === 0 ? 0 : unscaled * scale;
    if (Number.isNaN(value)) throw Error('Invalid derived combat stat');
    result[key] = Math.round(clamp(value, minimum, maximum));
  }
  if (base.cooldownMs !== undefined) {
    if (!Number.isFinite(base.cooldownMs) || base.cooldownMs < 0) throw Error('Invalid base cooldown');
    result.cooldownMs = Math.round(clamp(base.cooldownMs * stable.reduce((product, effect) => product * (effect.cooldownScale ?? 1), 1), 0, 86400000));
  }
  return result;
}
