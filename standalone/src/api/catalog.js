import { mapPreviewProduct } from '../lib/storefront-preview-core.js';

export async function loadCatalog(signal) {
  const response = await fetch('/api/catalog', {
    method: 'GET',
    headers: { Accept: 'application/json' },
    credentials: 'same-origin',
    signal
  });
  if (!response.ok) throw new Error('Catalog request failed (' + response.status + ')');
  const payload = await response.json();
  if (!Array.isArray(payload.products) || !Array.isArray(payload.collections)) {
    throw new Error('Invalid catalog response');
  }
  const products = payload.products.map(mapPreviewProduct);
  const collections = payload.collections;
  if (new Set(products.map(p => p.slug)).size !== products.length ||
      !collections.every(c => typeof c.slug === 'string' && typeof c.name === 'string') ||
      new Set(collections.map(c => c.slug)).size !== collections.length ||
      products.some(p => !collections.some(c => c.slug === p.category))) {
    throw new Error('Invalid catalog data');
  }
  return { products, collections };
}
