// Public gathering content only. Skill XP and supplies have no shop or coin value.
export const MAX_SKILL_LEVEL = 20;
export const MAX_SKILL_XP = 7600;
export const MAX_MATERIAL_QUANTITY = 999;
export const MAX_GATHERED_COUNT = 1000000;
export const GATHER_COOLDOWN_MS = 3000;
export const GATHER_RANGE = 1.6;

export const SKILLS = Object.freeze([
  Object.freeze({ id: 'foraging', name: 'Foraging', description: 'Learn the woodland, upland and coastal plants.' }),
  Object.freeze({ id: 'mining', name: 'Mining', description: 'Work stone seams and uncover sturdier supplies.' }),
  Object.freeze({ id: 'fishing', name: 'Fishing', description: 'Follow the water from quiet brooks to tidal shores.' }),
]);

export const MATERIALS = Object.freeze([
  Object.freeze({ id: 'dewleaf', name: 'Dewleaf', skillId: 'foraging', healHp: 8 }),
  Object.freeze({ id: 'brookstone', name: 'Brookstone', skillId: 'mining' }),
  Object.freeze({ id: 'brook-trout', name: 'Brook trout', skillId: 'fishing', healHp: 12 }),
  Object.freeze({ id: 'amber-heather', name: 'Amber heather', skillId: 'foraging', healHp: 12 }),
  Object.freeze({ id: 'ironstone', name: 'Ironstone', skillId: 'mining' }),
  Object.freeze({ id: 'upland-perch', name: 'Upland perch', skillId: 'fishing', healHp: 18 }),
  Object.freeze({ id: 'saltbloom', name: 'Saltbloom', skillId: 'foraging', healHp: 16 }),
  Object.freeze({ id: 'tidal-slate', name: 'Tidal slate', skillId: 'mining' }),
  Object.freeze({ id: 'silver-mackerel', name: 'Silver mackerel', skillId: 'fishing', healHp: 24 }),
]);

export const RESOURCE_NODES = Object.freeze([
  Object.freeze({ id: 'glade:dewleaf', name: 'Dewleaf patch', regionId: 'glade', zoneName: 'Brookside Commons', skillId: 'foraging', materialId: 'dewleaf', x: 10, y: 9, requiredLevel: 1, xp: 12, regrowMs: 15000 }),
  Object.freeze({ id: 'glade:brookstone', name: 'Brookstone seam', regionId: 'glade', zoneName: 'Brookside Commons', skillId: 'mining', materialId: 'brookstone', x: 12, y: 16, requiredLevel: 1, xp: 12, regrowMs: 15000 }),
  Object.freeze({ id: 'glade:trout', name: 'Brook trout pool', regionId: 'glade', zoneName: 'Brookside Commons', skillId: 'fishing', materialId: 'brook-trout', x: 7, y: 9, requiredLevel: 1, xp: 12, regrowMs: 15000 }),
  Object.freeze({ id: 'amberReach:heather', name: 'Amber heather bed', regionId: 'amberReach', zoneName: 'Upland Workings', skillId: 'foraging', materialId: 'amber-heather', x: 7, y: 7, requiredLevel: 3, xp: 22, regrowMs: 22000 }),
  Object.freeze({ id: 'amberReach:ironstone', name: 'Ironstone vein', regionId: 'amberReach', zoneName: 'Upland Workings', skillId: 'mining', materialId: 'ironstone', x: 14, y: 16, requiredLevel: 3, xp: 22, regrowMs: 22000 }),
  Object.freeze({ id: 'amberReach:perch', name: 'Upland perch pool', regionId: 'amberReach', zoneName: 'Upland Workings', skillId: 'fishing', materialId: 'upland-perch', x: 9, y: 8, requiredLevel: 3, xp: 22, regrowMs: 22000 }),
  Object.freeze({ id: 'mistHarbor:saltbloom', name: 'Saltbloom bed', regionId: 'mistHarbor', zoneName: 'Tidal Gardens', skillId: 'foraging', materialId: 'saltbloom', x: 10, y: 16, requiredLevel: 5, xp: 34, regrowMs: 30000 }),
  Object.freeze({ id: 'mistHarbor:slate', name: 'Tidal slate seam', regionId: 'mistHarbor', zoneName: 'Tidal Gardens', skillId: 'mining', materialId: 'tidal-slate', x: 21, y: 15, requiredLevel: 5, xp: 34, regrowMs: 30000 }),
  Object.freeze({ id: 'mistHarbor:mackerel', name: 'Silver mackerel shoal', regionId: 'mistHarbor', zoneName: 'Tidal Gardens', skillId: 'fishing', materialId: 'silver-mackerel', x: 18, y: 16, requiredLevel: 5, xp: 34, regrowMs: 30000 }),
]);

export function skillLevelThreshold(level) {
  const bounded = Math.min(MAX_SKILL_LEVEL, Math.max(1, Number.isSafeInteger(level) ? level : 1));
  return 20 * (bounded - 1) * bounded;
}

export function skillLevel(xp) {
  const bounded = Math.min(MAX_SKILL_XP, Math.max(0, Number.isSafeInteger(xp) ? xp : 0));
  let level = 1;
  while (level < MAX_SKILL_LEVEL && bounded >= skillLevelThreshold(level + 1)) level += 1;
  return level;
}

export function skillProgress(skillId, xp = 0, totalGathered = 0) {
  const skill = SKILLS.find(item => item.id === skillId);
  if (!skill) return null;
  const bounded = Math.min(MAX_SKILL_XP, Math.max(0, Number.isSafeInteger(xp) ? xp : 0));
  const level = skillLevel(bounded);
  const floor = skillLevelThreshold(level);
  return {
    id: skill.id, name: skill.name, level, xp: bounded,
    levelXp: bounded - floor,
    nextLevelXp: level < MAX_SKILL_LEVEL ? skillLevelThreshold(level + 1) - floor : 0,
    maxLevel: MAX_SKILL_LEVEL,
    totalGathered: Math.min(MAX_GATHERED_COUNT, Math.max(0, Number.isSafeInteger(totalGathered) ? totalGathered : 0)),
  };
}
