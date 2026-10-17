import { createContext, useContext } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { mapProduct } from '@/lib/storefront-core';
export const DEFAULT_COLLECTIONS = [
  ['miniatures', 'Miniatures', 'sword'], ['dice', 'Dice', 'dice'], ['battle-maps', 'Battle Maps', 'map'], ['terrain', 'Terrain', 'castle'],
  ['paints', 'Paints', 'brush'], ['accessories', 'Accessories', 'compass'], ['diy', 'DIY', 'hammer'], ['cosplay', 'Cosplay', 'wand'], ['rulebooks', 'Rulebooks', 'book'],
].map(([slug, name, icon], display_order) => ({ slug, name, icon, display_order }));
export async function readAll(entity, sort) {
  const rows = [];
  for (let skip = 0; skip < 10000; skip += 100) {
    const batch = await entity.list(sort, 100, skip);
    if (!Array.isArray(batch)) throw new Error('Catalog response unavailable');
    rows.push(...batch);
    if (batch.length < 100) return rows;
  }
  throw new Error('Catalog needs pagination');
}
async function loadCatalog() {
  const [rows, categories] = await Promise.all([readAll(base44.entities.Product, '-created_date'), readAll(base44.entities.Category, 'display_order')]);
  const collections = categories.length ? categories : DEFAULT_COLLECTIONS;
  const products = rows.filter(row => row.active !== false).map(row => mapProduct(row, collections));
  if (new Set(products.map(p => p.slug)).size !== products.length) throw new Error('Product links need attention');
  return { products, collections };
}
const CatalogContext = createContext(null);
export function CatalogProvider({ children }) {
  const query = useQuery({ queryKey: ['storefront-catalog'], queryFn: loadCatalog, staleTime: 30000, retry: 1 });
  return <CatalogContext.Provider value={{ products: query.data?.products || [], collections: query.data?.collections || DEFAULT_COLLECTIONS, loading: query.isPending, error: query.isError, refetch: query.refetch }}>{children}</CatalogContext.Provider>;
}
export const useCatalog = () => useContext(CatalogContext);