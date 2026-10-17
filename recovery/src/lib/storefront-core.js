import { productVariants, saleBlockReason } from '../../base44/shared/commerce-core.js';
export { productVariants, centsFromDollars } from '../../base44/shared/commerce-core.js';
export const CART_KEY = 'eldritch-fable:cart:v2';
export const MAX_QUANTITY = 99;
const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
export const money = cents => usd.format(cents / 100);
export const slugify = value => String(value || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
export const lineKey = line => `${line.productId}:${line.variantId}`;
export const productHref = product => `/products/${encodeURIComponent(product.slug)}`;
export function safeUrl(value) {
  if (typeof value !== 'string' || !value) return '';
  try { const url = new URL(value); return url.protocol === 'https:' ? url.href : ''; } catch { return ''; }
}
export function mapProduct(record, collections = []) {
  if (typeof record?.id !== 'string' || typeof record.name !== 'string') throw new Error('Invalid product');
  const collection = collections.find(c => c.slug === record.category_slug || c.slug === record.category || c.name.toLowerCase() === String(record.category).toLowerCase());
  const variants = productVariants(record);
  return { ...record, slug: /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(record.slug || '') ? record.slug : `product-${record.id}`,
    categorySlug: collection?.slug || slugify(record.category), categoryName: collection?.name || record.category,
    available: !saleBlockReason(record), priceConfirmed: record.price_confirmed === true,
    image_url: safeUrl(record.image_url), variants, priceCents: Math.min(...variants.map(v => v.priceCents)),
    product_type: record.product_type === 'digital' ? 'digital' : 'physical',
    stock: Number.isSafeInteger(record.stock) && record.stock > 0 ? record.stock : 0,
    details: Array.isArray(record.details) ? record.details.filter(v => typeof v === 'string') : [],
    specifications: Array.isArray(record.specifications) ? record.specifications.filter(v => typeof v?.label === 'string' && typeof v?.value === 'string') : [] };
}
export function normalizeLines(value) {
  if (!Array.isArray(value)) return [];
  const result = new Map();
  for (const line of value.slice(0, 100)) {
    if (!line || typeof line.productId !== 'string' || !line.productId || line.productId.length > 100 || typeof line.variantId !== 'string' || !line.variantId || line.variantId.length > 100 || !Number.isSafeInteger(line.quantity) || line.quantity < 1) continue;
    const key = lineKey(line);
    result.set(key, { productId: line.productId, variantId: line.variantId, quantity: Math.min(MAX_QUANTITY, (result.get(key)?.quantity || 0) + line.quantity) });
  }
  return [...result.values()];
}
export function readLines(raw) {
  if (typeof raw !== 'string' || raw.length > 100000) return [];
  try { const data = JSON.parse(raw); return data?.version === 2 ? normalizeLines(data.lines) : []; } catch { return []; }
}
export function migrateLegacyCart(raw, products) {
  try {
    const items = JSON.parse(raw);
    if (!Array.isArray(items)) return [];
    return normalizeLines(items.map(item => {
      const product = products.find(p => p.id === item.id);
      const variant = product?.variants.find(v => item.option ? v.label === item.option : v.id === 'standard' || product.variants.length === 1);
      return variant ? { productId: product.id, variantId: variant.id, quantity: item.quantity } : null;
    }));
  } catch { return []; }
}