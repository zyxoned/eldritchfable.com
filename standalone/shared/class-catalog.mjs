// Shared, immutable game content. In-game equipment is not shop merchandise.
// Base damage/range/armor below already include each class's starter loadout.
export const PLAYER_CLASS_IDS = Object.freeze([
  'ranger', 'knight', 'mage', 'bard', 'cleric', 'wizard', 'sorcerer', 'monk',
]);
export const ADMIN_CLASS_ID = 'death-knight';

function deepFreeze(value) {
  for (const child of Object.values(value)) {
    if (child && typeof child === 'object' && !Object.isFrozen(child)) deepFreeze(child);
  }
  return Object.freeze(value);
}

export const CLASS_CATALOG = deepFreeze({
  ranger: {
    id: 'ranger', name: 'Ranger', color: '#9bbd70', role: 'Wilds scout',
    description: 'Living longbow · 3-tile range',
    lore: 'The Briarwardens remember every path the Hollow King has tried to erase. They bind their arrows with living thorn and guide lost travelers home by the light of the moon.',
    damage: 14, range: 3, armor: 1,
    equipment: [
      { id: 'briarwake-longbow', name: 'Briarwake Longbow', slot: 'Weapon', rarity: 'Uncommon', description: 'A living yew bow strung with moon-silk. Its steady arrows shape your 14-damage, 3-tile basic attack.' },
      { id: 'trailkeeper-leathers', name: 'Trailkeeper Leathers', slot: 'Armor', rarity: 'Uncommon', description: 'Moss-soft hunting leathers woven for the old trails. Their protection is included in your 1 armor.' },
      { id: 'wayfarers-locket', name: 'Wayfarer’s Locket', slot: 'Relic', rarity: 'Uncommon', description: 'A pressed fern rests behind its glass: a reminder that a homeward path always exists.' },
    ],
    skills: [
      { id: 'briar-shot', name: 'Briar Shot', type: 'strike', target: 'enemy', damage: 28, range: 4, cooldownMs: 9000, description: 'Loose a thorn-bound arrow at the nearest foe within 4 tiles for 28 damage.' },
      { id: 'field-dressing', name: 'Field Dressing', type: 'heal', target: 'self', heal: 22, cooldownMs: 14000, description: 'Bind your wounds with bitterleaf and restore 22 health.' },
    ],
  },
  knight: {
    id: 'knight', name: 'Knight', color: '#d7a66b', role: 'Lantern vanguard',
    description: 'Oathbound blade · 2-tile range',
    lore: 'When the roads went dark, the Lantern Order carried a spark from the last hearth into the woods. Its knights swear to stand between the Hollow King and anyone who still has a story to tell.',
    damage: 22, range: 2, armor: 3,
    equipment: [
      { id: 'hearthsworn-blade', name: 'Hearthsworn Blade', slot: 'Weapon', rarity: 'Uncommon', description: 'A broad blade tempered beside the last hearth. Its weight gives your basic attack 22 damage at 2-tile range.' },
      { id: 'lantern-guard-plate', name: 'Lantern Guard Plate', slot: 'Armor', rarity: 'Uncommon', description: 'Burnished plates stamped with an unlit sun. Their protection is included in your 3 armor.' },
      { id: 'ember-standard', name: 'Ember Standard', slot: 'Relic', rarity: 'Uncommon', description: 'A scrap of the Order’s first banner, carried for every traveler its bearer promises to protect.' },
    ],
    skills: [
      { id: 'oathbound-strike', name: 'Oathbound Strike', type: 'strike', target: 'enemy', damage: 34, range: 2, cooldownMs: 10000, description: 'Drive your oath into the nearest foe within 2 tiles for 34 damage.' },
      { id: 'lantern-ward', name: 'Lantern Ward', type: 'ward', target: 'self', ward: 24, durationMs: 10000, cooldownMs: 16000, description: 'Raise a lantern-lit guard that absorbs up to 24 incoming damage for 10 seconds.' },
    ],
  },
  mage: {
    id: 'mage', name: 'Mage', color: '#a88cdb', role: 'Glade arcanist',
    description: 'Arcane bolt · 3-tile range',
    lore: 'Glade mages learn magic from stories rather than books: a river’s first journey, a fallen star’s last wish. They keep those small wonders alive where the Hollow King’s silence begins.',
    damage: 18, range: 3, armor: 1,
    equipment: [
      { id: 'gladeglass-wand', name: 'Gladeglass Wand', slot: 'Weapon', rarity: 'Uncommon', description: 'A branch of translucent gladeglass. It focuses the 18-damage arcane bolt of your 3-tile basic attack.' },
      { id: 'living-ink-robes', name: 'Robes of Living Ink', slot: 'Armor', rarity: 'Uncommon', description: 'Written charms drift across the cloth like slow constellations. Their protection is included in your 1 armor.' },
      { id: 'starwater-lens', name: 'Starwater Lens', slot: 'Relic', rarity: 'Uncommon', description: 'A single bead of reflected starlight, sealed in glass before the sky forgot its name.' },
    ],
    skills: [
      { id: 'arcane-pulse', name: 'Arcane Pulse', type: 'area', target: 'enemy', damage: 22, range: 3, radius: 2, cooldownMs: 12000, description: 'Burst around the nearest foe within 3 tiles, dealing 22 damage to enemies within 2 tiles of it.' },
      { id: 'star-mend', name: 'Star Mend', type: 'heal', target: 'self', heal: 24, cooldownMs: 14000, description: 'Draw a familiar constellation over your wounds and restore 24 health.' },
    ],
  },
  bard: {
    id: 'bard', name: 'Bard', color: '#dc9ab8', role: 'Resonant storyteller',
    description: 'Silverstring lute · Party support',
    lore: 'The Last Chorus travels from hearth to hearth, collecting the names the Hollow King would steal. A bard’s song can turn a lonely campfire into a company, or make a monster remember fear.',
    damage: 12, range: 3, armor: 1,
    equipment: [
      { id: 'silverstring-lute', name: 'Silverstring Lute', slot: 'Weapon', rarity: 'Uncommon', description: 'Seven silver strings resonate with remembered courage. Your basic notes deal 12 damage at 3-tile range.' },
      { id: 'roadsong-coat', name: 'Roadsong Coat', slot: 'Armor', rarity: 'Uncommon', description: 'Every embroidered patch marks a town that welcomed the Chorus. Its protection is included in your 1 armor.' },
      { id: 'last-verse-brooch', name: 'Last Verse Brooch', slot: 'Relic', rarity: 'Uncommon', description: 'A tiny songbird cast from a broken bell. The final verse is engraved beneath its wing.' },
    ],
    skills: [
      { id: 'dissonant-chord', name: 'Dissonant Chord', type: 'area', target: 'enemy', damage: 18, range: 3, radius: 2, cooldownMs: 10000, description: 'Strike a discord around the nearest foe within 3 tiles, dealing 18 damage to foes within 2 tiles of it.' },
      { id: 'song-of-mending', name: 'Song of Mending', type: 'heal', target: 'party', heal: 18, radius: 4, cooldownMs: 14000, description: 'Restore 18 health to yourself and active companions within 4 tiles.' },
    ],
  },
  cleric: {
    id: 'cleric', name: 'Cleric', color: '#e8d49a', role: 'Keeper of first light',
    description: 'Dawncandle mace · Party healing',
    lore: 'The Dawnkeepers do not worship an absent sun. They tend the first light that rises in a frightened heart, carrying small candles into places where the Hollow King has declared the night eternal.',
    damage: 16, range: 2, armor: 2,
    equipment: [
      { id: 'dawncandle-mace', name: 'Dawncandle Mace', slot: 'Weapon', rarity: 'Uncommon', description: 'A brass flanged mace cradling an undying candle. Its blessed strikes deal 16 damage at 2-tile range.' },
      { id: 'first-light-vestments', name: 'Vestments of First Light', slot: 'Armor', rarity: 'Uncommon', description: 'Ivory cloth over a quiet ringmail lining. Their protection is included in your 2 armor.' },
      { id: 'reliquary-bell', name: 'Reliquary Bell', slot: 'Relic', rarity: 'Uncommon', description: 'Its clear note honors those who carried the light before you, and those still searching for it.' },
    ],
    skills: [
      { id: 'dawnfire', name: 'Dawnfire', type: 'strike', target: 'enemy', damage: 30, range: 3, cooldownMs: 10000, description: 'Call a ray of first light onto the nearest foe within 3 tiles for 30 damage.' },
      { id: 'sanctuary', name: 'Sanctuary', type: 'heal', target: 'party', heal: 30, radius: 3, cooldownMs: 16000, description: 'Restore 30 health to yourself and active companions within 3 tiles.' },
    ],
  },
  wizard: {
    id: 'wizard', name: 'Wizard', color: '#87b9e8', role: 'Runebound scholar',
    description: 'Runic staff · Long-range control',
    lore: 'The Starfall Collegium survived by hiding its library inside a single unfinished spell. Its wizards study every rune with care: one correctly spoken word may someday unmake the Hollow King’s crown.',
    damage: 20, range: 4, armor: 0,
    equipment: [
      { id: 'ash-script-staff', name: 'Ash-Script Staff', slot: 'Weapon', rarity: 'Uncommon', description: 'A scholar’s staff inscribed with a patient spiral of runes. Your basic spell deals 20 damage at 4-tile range.' },
      { id: 'runebound-mantle', name: 'Runebound Mantle', slot: 'Armor', rarity: 'Uncommon', description: 'The Collegium’s midnight-blue traveling mantle favors study over armor; its base armor is 0.' },
      { id: 'unwritten-grimoire', name: 'Unwritten Grimoire', slot: 'Relic', rarity: 'Uncommon', description: 'Blank pages wait for spells you can prove, not merely repeat. The first page bears your own name.' },
    ],
    skills: [
      { id: 'frost-circle', name: 'Frost Circle', type: 'area', target: 'enemy', damage: 24, range: 4, radius: 2, cooldownMs: 12000, description: 'Trace a ring of frost around the nearest foe within 4 tiles, dealing 24 damage to foes within 2 tiles of it.' },
      { id: 'runic-ward', name: 'Runic Ward', type: 'ward', target: 'self', ward: 24, durationMs: 8000, cooldownMs: 16000, description: 'Inscribe a ward that absorbs up to 24 incoming damage for 8 seconds.' },
    ],
  },
  sorcerer: {
    id: 'sorcerer', name: 'Sorcerer', color: '#e08b66', role: 'Cinderblood channeler',
    description: 'Innate emberstorm · Burst magic',
    lore: 'No school teaches the storm that lives in a sorcerer’s blood. Those called Cinderborn hear the world’s broken heartbeat, and answer with a fire the Hollow King can neither command nor extinguish.',
    damage: 21, range: 3, armor: 0,
    equipment: [
      { id: 'emberglass-focus', name: 'Emberglass Focus', slot: 'Weapon', rarity: 'Uncommon', description: 'A shard of cooled lightning steadies your innate power. Your basic surge deals 21 damage at 3-tile range.' },
      { id: 'stormthread-wraps', name: 'Stormthread Wraps', slot: 'Armor', rarity: 'Uncommon', description: 'Loose storm-gray cloth lets your magic breathe. It offers no additional armor; base armor is 0.' },
      { id: 'cinderblood-charm', name: 'Cinderblood Charm', slot: 'Relic', rarity: 'Uncommon', description: 'A warm black stone from the night your power first answered. It flickers when you remember why.' },
    ],
    skills: [
      { id: 'cinder-burst', name: 'Cinder Burst', type: 'area', target: 'enemy', damage: 30, range: 3, radius: 2, cooldownMs: 14000, description: 'Unleash embers around the nearest foe within 3 tiles, dealing 30 damage to foes within 2 tiles of it.' },
      { id: 'storm-lance', name: 'Storm Lance', type: 'strike', target: 'enemy', damage: 38, range: 4, cooldownMs: 10000, description: 'Channel a narrow bolt of innate lightning into the nearest foe within 4 tiles for 38 damage.' },
    ],
  },
  monk: {
    id: 'monk', name: 'Monk', color: '#70bcb0', role: 'Disciple of the quiet river',
    description: 'Focused fists · Swift melee',
    lore: 'At Quiet River monastery, the first lesson is to listen and the last is to act without hatred. Its wandering monks meet the Hollow King’s hunger with a stillness no stolen crown can purchase.',
    damage: 17, range: 2, armor: 1,
    equipment: [
      { id: 'quiet-river-handwraps', name: 'Quiet River Handwraps', slot: 'Weapon', rarity: 'Uncommon', description: 'Simple linen wraps keep every strike deliberate. Your focused basic attack deals 17 damage at 2-tile range.' },
      { id: 'riverstone-robes', name: 'Riverstone Robes', slot: 'Armor', rarity: 'Uncommon', description: 'Travel-worn robes stitched for a free and balanced stance. Their protection is included in your 1 armor.' },
      { id: 'stillwater-beads', name: 'Stillwater Beads', slot: 'Relic', rarity: 'Uncommon', description: 'Each smooth bead marks a kindness offered on the road, never a victory taken from it.' },
    ],
    skills: [
      { id: 'flurry-of-petals', name: 'Flurry of Petals', type: 'strike', target: 'enemy', damage: 32, range: 2, cooldownMs: 8000, description: 'Land a precise sequence of blows on the nearest foe within 2 tiles for 32 damage.' },
      { id: 'still-water', name: 'Still Water', type: 'heal', target: 'self', heal: 24, cooldownMs: 14000, description: 'Gather your breath, settle your stance, and restore 24 health.' },
    ],
  },
  'death-knight': {
    id: 'death-knight', name: 'Death Knight', color: '#b9a7ef', role: 'The veiled seventh',
    description: 'Draconian sovereign · Level ???',
    lore: 'Six heroes are remembered in the waking woods. A seventh walks between their verses: a Draconian death knight in armor older than the Hollow King’s crown. No chronicle records their beginning, and no blade can write their end.',
    damage: 42, range: 4, armor: 0,
    equipment: [
      { id: 'sss-grave-of-stars', name: 'Grave of Stars', slot: 'Weapon', rarity: 'SSS', description: 'Top-tier SSS runeblade. Soul Reap executes the nearest hostile creature in range in a single strike.' },
      { id: 'sss-night-sovereign-plate', name: 'Night Sovereign Plate', slot: 'Armor', rarity: 'SSS', description: 'Top-tier SSS obsidian dragonscale plate. Its Undying Oath grants invulnerability while the authorized seventh character is present.' },
      { id: 'sss-black-sun-signet', name: 'Black Sun Signet', slot: 'Relic', rarity: 'SSS', description: 'Top-tier SSS regalia bearing a nameless crest. A mark of the seventh’s station; it adds no further power.' },
    ],
    skills: [
      { id: 'undying-oath', name: 'Undying Oath', type: 'passive', target: 'self', cooldownMs: 0, description: 'Invulnerability. The seventh character takes no incoming damage.' },
      { id: 'soul-reap', name: 'Soul Reap', type: 'execute', target: 'enemy', range: 6, cooldownMs: 700, description: 'Instantly defeat the nearest hostile creature within 6 tiles. This power does not target other players.' },
    ],
  },
});
