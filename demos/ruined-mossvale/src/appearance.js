// Cosmetic choices are IDs only; rendering receives colors from this fixed palette.
export const APPEARANCE_OPTIONS = {
  skinTone: [
    { id: 'porcelain', label: 'Porcelain', color: '#f0d6c3' },
    { id: 'warm', label: 'Warm', color: '#dca77d' },
    { id: 'olive', label: 'Olive', color: '#bd946b' },
    { id: 'umber', label: 'Umber', color: '#a16d4e' },
    { id: 'deep', label: 'Deep', color: '#744b38' },
    { id: 'ebony', label: 'Ebony', color: '#4d342e' },
  ],
  hairColor: [
    { id: 'chestnut', label: 'Chestnut', color: '#694330' },
    { id: 'black', label: 'Black', color: '#29272b' },
    { id: 'flaxen', label: 'Flaxen', color: '#d5b978' },
    { id: 'auburn', label: 'Auburn', color: '#a3593b' },
    { id: 'silver', label: 'Silver', color: '#d1d6d2' },
    { id: 'midnight', label: 'Midnight', color: '#41465f' },
  ],
  hairStyle: [
    { id: 'cropped', label: 'Cropped' },
    { id: 'long', label: 'Long' },
    { id: 'braid', label: 'Braided' },
    { id: 'shaved', label: 'Shaved' },
  ],
  outfit: [
    { id: 'class', label: 'Class colors', color: null },
    { id: 'moss', label: 'Moss', color: '#86a768' },
    { id: 'ocean', label: 'Ocean', color: '#6b9fb8' },
    { id: 'plum', label: 'Plum', color: '#a57ca9' },
    { id: 'rust', label: 'Rust', color: '#bd7b57' },
    { id: 'ivory', label: 'Ivory', color: '#d7cbb0' },
  ],
  accent: [
    { id: 'gold', label: 'Gold', color: '#dfc178' },
    { id: 'silver', label: 'Silver', color: '#c5d2d6' },
    { id: 'copper', label: 'Copper', color: '#cf9271' },
  ],
  build: [
    { id: 'balanced', label: 'Balanced' },
    { id: 'slender', label: 'Slender' },
    { id: 'broad', label: 'Broad' },
  ],
};

export function defaultAppearance() {
  return {
    skinTone: 'warm',
    hairColor: 'chestnut',
    hairStyle: 'cropped',
    outfit: 'class',
    accent: 'gold',
    build: 'balanced',
  };
}

export function sanitizeAppearance(input) {
  const source = input && typeof input === 'object' ? input : {};
  const result = defaultAppearance();
  for (const [field, choices] of Object.entries(APPEARANCE_OPTIONS)) {
    if (choices.some(choice => choice.id === source[field])) result[field] = source[field];
  }
  return result;
}

export function resolveAppearance(input, classColor = '#9bbd70') {
  const appearance = sanitizeAppearance(input);
  const color = field =>
    APPEARANCE_OPTIONS[field].find(choice => choice.id === appearance[field]).color;
  const safeClassColor = typeof classColor === 'string' && /^#[0-9a-f]{6}$/i.test(classColor)
    ? classColor : '#9bbd70';
  const builds = {
    balanced: { widthScale: 1, heightScale: 1 },
    slender: { widthScale: 0.89, heightScale: 1.05 },
    broad: { widthScale: 1.13, heightScale: 0.98 },
  };
  return {
    skin: color('skinTone'),
    hair: color('hairColor'),
    outfit: color('outfit') || safeClassColor,
    accent: color('accent'),
    hairStyle: appearance.hairStyle,
    ...builds[appearance.build],
  };
}
