// Original, deliberately small character paths. No currency is spent and old XP is unchanged.
import { CLASS_CATALOG, PLAYER_CLASS_IDS } from './class-catalog.mjs';

export const STANCES = Object.freeze([
  Object.freeze({ id: 'balanced', name: 'Balanced', level: 1, outgoing: 0, incoming: 0, description: 'Keep your familiar attack and defence.' }),
  Object.freeze({ id: 'guarded', name: 'Guarded', level: 2, outgoing: -2, incoming: -2, description: 'Deal 2 less damage; take 2 less damage. Hits still deal at least 1.' }),
  Object.freeze({ id: 'focused', name: 'Focused', level: 3, outgoing: 2, incoming: 2, description: 'Deal 2 more damage; take 2 more damage. A deliberate risk.' }),
]);
export const TACTICS = Object.freeze([
  Object.freeze({ id: 'manual', name: 'My own judgement', description: 'Choose every action yourself.' }),
  Object.freeze({ id: 'recovery-first', name: 'Recovery first', description: 'Suggest recovery when health is low. Advice only; never acts for you.' }),
  Object.freeze({ id: 'skill-opening', name: 'Skill opening', description: 'Suggest a ready class skill near a foe. Advice only; never acts for you.' }),
]);
const PATHS = Object.freeze({
  ranger: ['Read the trail', 'Hold your ground', 'Find the opening'],
  knight: ['Keep the oath', 'Stand the watch', 'Choose your charge'],
  mage: ['Kindle a thought', 'Shape a shelter', 'Release the spark'],
  bard: ['Find your measure', 'Steady the company', 'Lift the refrain'],
  cleric: ['Tend the lantern', 'Guard the light', 'Carry it forward'],
  wizard: ['Trace the first rune', 'Set the boundary', 'Complete the pattern'],
  sorcerer: ['Hear the ember', 'Bank the fire', 'Let it rise'],
  monk: ['Feel your footing', 'Root your stance', 'Follow through'],
});
export function characterLevel(lifetimeXp) {
  return 1 + Math.floor(Math.max(0, Number.isSafeInteger(lifetimeXp) ? lifetimeXp : 0) / 100);
}
export function stanceById(id) { return STANCES.find(item => item.id === id) || STANCES[0]; }
export function outgoingDamage(base, stanceId = 'balanced') {
  return Math.max(1, base + stanceById(stanceId).outgoing);
}
export function incomingDamage(base, stanceId = 'balanced') {
  // Armour may already have blocked a hit completely; stance does not undo that block.
  return base <= 0 ? 0 : Math.max(1, base + stanceById(stanceId).incoming);
}
export function developmentFor(heroClass, lifetimeXp, stanceId = 'balanced', tacticId = 'manual') {
  if (!PLAYER_CLASS_IDS.includes(heroClass)) return null;
  const level = characterLevel(lifetimeXp);
  const availableStances = STANCES.filter(item => item.level <= level).map(item => item.id);
  const selected = availableStances.includes(stanceId) ? stanceId : 'balanced';
  return {
    level, role: CLASS_CATALOG[heroClass].role, stanceId: selected,
    tacticId: TACTICS.some(item => item.id === tacticId) ? tacticId : 'manual',
    availableStances,
    lessons: PATHS[heroClass].map((name, index) => ({
      id: heroClass + '-lesson-' + (index + 1), name, level: index + 1, unlocked: level >= index + 1,
      description: index === 0 ? 'Your calling and its two familiar skills. Keep exploring at your own pace.'
        : index === 1 ? 'Unlock the Guarded stance: protection with a small attack tradeoff.'
          : 'Unlock the Focused stance: stronger attacks with a defensive tradeoff.',
    })),
  };
}
export function validDevelopmentChoice(heroClass, lifetimeXp, stanceId, tacticId) {
  const development = developmentFor(heroClass, lifetimeXp);
  return !!development && development.availableStances.includes(stanceId) && TACTICS.some(item => item.id === tacticId);
}
export function tacticalAdvice({ tacticId = 'manual', hp = 100, nearEnemy = false, readySkillName = '' } = {}) {
  if (tacticId === 'recovery-first' && hp <= 40) return 'Health is low. Consider a recovery skill or a safe return to camp.';
  if (tacticId === 'skill-opening' && nearEnemy && readySkillName) return readySkillName + ' is ready. Consider it for your next action.';
  return 'You decide the next move. Tactical advice never acts automatically.';
}
