export const PREVIEW_CART_KEY = 'eldritch-fable:standalone-preview-cart:v1';
const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
export const money = (cents) => usd.format(cents / 100);
export const lineKey = (line) => `${line.productId}:${line.variantId}`;
export function mapPreviewProduct(record) {
  if (!record || typeof record.id !== 'string' || typeof record.slug !== 'string' ||
      typeof record.name !== 'string' || typeof record.category !== 'string' || typeof record.description !== 'string' ||
      !Array.isArray(record.variants) || !record.variants.length ||
      !record.variants.every(v => typeof v.id === 'string' && typeof v.label === 'string' && Number.isSafeInteger(v.price_cents) && v.price_cents >= 0) ||
      new Set(record.variants.map(v => v.id)).size !== record.variants.length) {
    throw new Error('Invalid preview product data');
  }
  return { ...record, details: Array.isArray(record.details) ? record.details.filter(d => typeof d === 'string') : [],
    specifications: Array.isArray(record.specifications) ? record.specifications.filter(s => typeof s?.label === 'string' && typeof s?.value === 'string') : [],
    variants: record.variants.map(v => ({ id: v.id, label: v.label, priceCents: v.price_cents })) };
}
export function normalizeCart(value, products) {
  if (!Array.isArray(value)) return [];
  const result = new Map();
  for (const line of value.slice(0, 200)) {
    if (!line || typeof line.productId !== 'string' || typeof line.variantId !== 'string' ||
      !Number.isSafeInteger(line.quantity) || line.quantity < 1 ||
      !products.some(p => p.id === line.productId && p.variants.some(v => v.id === line.variantId))) continue;
    const key = lineKey(line);
    result.set(key, { productId: line.productId, variantId: line.variantId,
      quantity: Math.min(99, (result.get(key)?.quantity || 0) + line.quantity) });
  }
  return [...result.values()];
}
export function readCart(raw, products) {
  if (typeof raw !== 'string' || raw.length > 100000) return [];
  try { const data = JSON.parse(raw); return data?.version === 1 ? normalizeCart(data.lines, products) : []; }
  catch { return []; }
}
export const serializeCart = (lines) => JSON.stringify({ version: 1, lines });