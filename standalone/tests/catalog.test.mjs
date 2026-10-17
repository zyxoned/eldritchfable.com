import test from 'node:test';
import assert from 'node:assert/strict';
import { mapPreviewProduct } from '../src/lib/storefront-preview-core.js';

test('rejects invalid catalog records', () => {
  assert.throws(() => mapPreviewProduct({ slug: 'missing-fields' }), /Invalid preview product data/);
});
test('accepts a valid variant', () => {
  const record = { id: 'p1', slug: 'sample', name: 'Sample', category: 'dice', description: 'Test', variants: [{ id: 'v1', label: 'Default', price_cents: 100 }] };
  const product = mapPreviewProduct(record);
  assert.equal(product.variants[0].priceCents, 100);
});
