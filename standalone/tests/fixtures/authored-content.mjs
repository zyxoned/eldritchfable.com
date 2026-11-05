import { PLAYER_CLASS_IDS } from '../../shared/class-catalog.mjs';
// Entirely synthetic authoring. Production narrative is never a public fixture.
const scene = { name: 'Practice chamber', description: 'A synthetic encounter for integration testing.', theme: 'stone', enemy: { name: 'Training construct', hp: 1, damage: 0 } };
export const syntheticAuthoredContent = {
  version: 'integration-v1', sources: ['alpha','beta'].map(id => ({ id, effects: [] })),
  routes: ['alpha','beta'].map((sourceId, index) => ({ id: 'path-' + index, name: 'Earned passage ' + index,
    entrance: { regionId: 'glade', x: 11 + index, y: 13, label: 'Unassuming doorway ' + index }, stageCount: 2, restEvery: 1,
    archetypes: [scene], finale: { ...scene, name: 'Private terminal ' + index, sourceId } })),
  encounters: [{ id: 'meeting', claimKey: 'first-meeting', requiresSources: ['alpha','beta'],
    combat: { hp: 10, damage: 1, attackCooldownMs: 700 },
    initialCombat: { hp: 10, damage: 1, attackCooldownMs: 700, resolveAfterActions: 2, outcome: 'defeat' },
    scenes: { arrival: { title: 'Earned meeting', text: 'Only admitted participants receive this sentence.' }, victory: { title: 'Finished', text: 'A synthetic victory.' }, defeat: { title: 'Afterward', text: 'A synthetic outcome.' } },
    grant: { when: 'initial-defeat', key: 'test-reward', itemsByClass: Object.fromEntries(PLAYER_CLASS_IDS.map(id => [id, { id: 'test-' + id, name: 'Earned ' + id + ' relic', slot: 'relic', effect: { id: 'relic-' + id, name: 'Practice focus', flat: { maxHp: 10, damage: 1 } } }])) },
    recovery: { regionId: 'glade', x: 10, y: 13 } }],
};
