import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Package, Search } from 'lucide-react';
import { useCatalog } from '@/lib/storefront-catalog';
import ProductCard from '@/components/ProductCard';
export default function CatalogBrowser({ category = '', featured = false, digitalOnly = false }) {
  const catalog = useCatalog(); const [params, setParams] = useSearchParams();
  const query = params.get('q') || params.get('search') || '';
  const requestedCategory = category || params.get('category') || 'all';
  const activeCategory = catalog.collections.find(c => c.slug === requestedCategory || c.name.toLowerCase() === requestedCategory.toLowerCase())?.slug || requestedCategory;
  const sort = params.get('sort') || 'featured';
  const update = (key, value) => { const next = new URLSearchParams(params); next.delete('search'); if (value) next.set(key, value); else next.delete(key); setParams(next, { replace: true }); };
  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    const found = catalog.products.filter(p => (!featured || p.featured) && (!digitalOnly || p.product_type === 'digital') && (activeCategory === 'all' || p.categorySlug === activeCategory) && (!term || `${p.name} ${p.description || ''} ${p.variants.map(v => v.label).join(' ')}`.toLowerCase().includes(term)));
    if (sort === 'price-low') found.sort((a, b) => a.priceCents - b.priceCents);
    else if (sort === 'price-high') found.sort((a, b) => b.priceCents - a.priceCents);
    else if (sort === 'name') found.sort((a, b) => a.name.localeCompare(b.name));
    else found.sort((a, b) => Number(!!b.featured) - Number(!!a.featured));
    return found;
  }, [catalog.products, query, activeCategory, sort, featured, digitalOnly]);
  if (catalog.loading) return <div className="ef-state" role="status">Loading the collection…</div>;
  if (catalog.error) return <div className="ef-state" role="alert"><h2>The collection is temporarily unavailable.</h2><button className="ef-button" onClick={() => catalog.refetch()}>Try again</button></div>;
  return <section className="shop-section listing-section" aria-label="Browse products"><div className="section-heading">{featured && <div><p className="eyebrow">The merchant&apos;s selection</p><h2>Featured wares</h2></div>}<div className="catalog-tools"><div className="search-wrap"><Search aria-hidden="true" /><input className="ef-input" value={query} onChange={e => update('q', e.target.value)} aria-label="Search products" placeholder="Search products" /></div><select className="ef-sort" value={sort} onChange={e => update('sort', e.target.value)} aria-label="Sort products"><option value="featured">Featured</option>{catalog.products.some(p=>p.priceConfirmed) && <><option value="price-low">Price: low to high</option><option value="price-high">Price: high to low</option></>}<option value="name">Name: A to Z</option></select></div></div>{!category && <div className="filter-row" aria-label="Product categories">{[{ slug: 'all', name: 'All' }, ...catalog.collections].map(c => <button key={c.slug} aria-pressed={activeCategory === c.slug} className={activeCategory === c.slug ? 'active' : ''} onClick={() => update('category', c.slug === 'all' ? '' : c.slug)}>{c.name}</button>)}</div>}<p className="result-count" role="status" aria-live="polite">{filtered.length} {filtered.length === 1 ? 'product' : 'products'}</p>{filtered.length ? <div className="product-grid">{filtered.map(p => <ProductCard product={p} key={p.id} />)}</div> : <div className="no-results"><Package aria-hidden="true" /><h3>{catalog.products.length ? 'No artifacts found' : 'We’re sorry, these items are temporarily unavailable.'}</h3><p>{catalog.products.length ? 'Try another search or collection.' : 'We’re preparing stock and reliable shipping. Thank you for your patience.'}</p>{catalog.products.length ? <button className="ef-button outline" onClick={() => setParams({})}>Clear filters</button> : <Link className="ef-button outline" to="/contact">Contact Eldritch Fable</Link>}</div>}</section>;
}