import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Link, Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Brush, Castle, ChevronRight, Compass, Dices, Hammer, Map as MapIcon, Menu, Package, Search, ShieldCheck, ShoppingBag, Sparkles, Sword, Trash2, WandSparkles, X } from 'lucide-react';
import { loadCatalog } from '../api/catalog.js';
import { PREVIEW_CART_KEY, lineKey, money, normalizeCart, readCart, serializeCart } from '../lib/storefront-preview-core.js';
import '../styles/storefront.css';
import BagDrawer from '../components/storefront/BagDrawer.jsx';

const ROOT = '';
const icons = { sword: Sword, dice: Dices, map: MapIcon, castle: Castle, brush: Brush, compass: Compass, hammer: Hammer, wand: WandSparkles };
const PreviewContext = createContext(null);
const usePreview = () => useContext(PreviewContext);

function PreviewProvider({ children, products, collections }) {
  const [lines, setLines] = useState([]);
  const [ready, setReady] = useState(false);
  const [notice, setNotice] = useState('');
  const [bagOpen, setBagOpen] = useState(false);
  useEffect(() => {
    try { setLines(readCart(localStorage.getItem(PREVIEW_CART_KEY), products)); }
    catch { setNotice('Your browser blocked saved bags. This bag will last for this visit.'); }
    setReady(true);
    const sync = event => {
      try {
        if (event.storageArea === localStorage && (event.key === PREVIEW_CART_KEY || event.key === null)) setLines(readCart(event.newValue, products));
      } catch { /* Storage unavailable; retain current visit. */ }
    };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, [products]);
  useEffect(() => {
    if (!ready) return;
    try { localStorage.setItem(PREVIEW_CART_KEY, serializeCart(lines)); }
    catch { setNotice('Your browser blocked saved bags. This bag will last for this visit.'); }
  }, [lines, ready]);
  const subtotal = lines.reduce((sum, l) => sum + (products.find(p => p.id === l.productId)?.variants.find(v => v.id === l.variantId)?.priceCents || 0) * l.quantity, 0);
  return <PreviewContext.Provider value={{ products, collections, lines, ready, notice, subtotal,
    bagOpen, setBagOpen,
    count: lines.reduce((sum, l) => sum + l.quantity, 0),
    add(productId, variantId, quantity) { if (ready) { setLines(current => normalizeCart([...current, { productId, variantId, quantity }], products)); setBagOpen(true); } },
    remove(key) { setLines(current => current.filter(l => lineKey(l) !== key)); },
    setQuantity(key, quantity) { if (Number.isSafeInteger(quantity) && quantity >= 1 && quantity <= 99) setLines(current => current.map(l => lineKey(l) === key ? { ...l, quantity } : l)); },
  }}>{children}</PreviewContext.Provider>;
}

function Brand() {
  return <Link to="/" className="brand" aria-label="Eldritch Fable preview home"><span className="brand-mark" aria-hidden="true"><Sparkles /></span><span><strong>ELDRITCH</strong><em>FABLE</em></span></Link>;
}
function Header() {
  const cart = usePreview();
  const { count } = cart;
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  useEffect(() => { setMenuOpen(false); cart.setBagOpen(false); }, [location.pathname, cart.setBagOpen]);
  const links = <><Link to="/shop">Dice & Accessories</Link><Link to="/shop">Miniatures</Link><Link to="/shop">Maps & Encounters</Link><Link to="/shop">Painting & Terrain</Link><Link to="/shop">Game Master Tools</Link><Link to="/shop">Bundles</Link><Link to="/#story">Guides</Link></>;
  return <><a className="skip-link" href="#ef-main">Skip to content</a><div className="announcement">Store preview · Products coming soon · Checkout unavailable</div>
    <header className="site-header"><Brand /><nav className="desktop-nav" aria-label="Main navigation">{links}</nav><div className="header-actions">
      <button className="icon-button mobile-only" onClick={() => setMenuOpen(!menuOpen)} aria-label={menuOpen ? 'Close menu' : 'Open menu'} aria-expanded={menuOpen} aria-controls="ef-mobile-menu">{menuOpen ? <X /> : <Menu />}</button>
      <button onClick={() => cart.setBagOpen(true)} className="cart-trigger ef-button outline" aria-label={`Shopping bag with ${count} items`}><ShoppingBag aria-hidden="true" /><span className="desktop-only">Bag</span><b>{count}</b></button>
    </div></header><BagDrawer open={cart.bagOpen} onOpenChange={cart.setBagOpen} items={cart.lines.map(line => { const product = cart.products.find(p => p.id === line.productId); const variant = product?.variants.find(v => v.id === line.variantId); return { ...line, key: lineKey(line), name: product?.name, option: variant?.label, priceCents: variant?.priceCents || 0, url: `${ROOT}/products/${product?.slug}` }; })} subtotal={cart.subtotal} onQuantity={(line, quantity) => cart.setQuantity(line.key, quantity)} onRemove={line => cart.remove(line.key)} notice={cart.notice} shopHref={`${ROOT}/shop`} cartHref={`${ROOT}/bag`} preview />{menuOpen && <nav id="ef-mobile-menu" className="mobile-nav" aria-label="Mobile navigation">{links}</nav>}</>;
}
function ProductArt({ product, detail = false }) {
  return <div className={`product-art art-${product.art}${detail ? ' detail-art' : ''}`}><span>Sample product</span><Package aria-hidden="true" />{detail && <p className="art-caption">Product photography will be added after supplier selection.</p>}</div>;
}
function ProductCard({ product }) {
  const { collections } = usePreview();
  const category = collections.find(c => c.slug === product.category);
  return <article className="product-card"><Link to={`${ROOT}/products/${product.slug}`} className="product-art-link" aria-label={`View ${product.name}`}><ProductArt product={product} /></Link><div className="product-info"><p className="product-category">{category?.name}</p><h3><Link to={`${ROOT}/products/${product.slug}`}>{product.name}</Link></h3><div className="product-bottom"><span className="price">{money(product.variants[0].priceCents)}</span><Link className="ef-button outline" to={`${ROOT}/products/${product.slug}`}>View options <ChevronRight aria-hidden="true" /></Link></div></div></article>;
}
function Catalog({ category = '', featured = false }) {
  const { products, collections } = usePreview();
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState(category || 'all');
  const [sort, setSort] = useState('featured');
  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    const found = products.filter(p => (activeCategory === 'all' || p.category === activeCategory) && (!term || `${p.name} ${p.description} ${p.variants.map(v => v.label).join(' ')}`.toLowerCase().includes(term)));
    if (sort === 'price-low') found.sort((a, b) => a.variants[0].priceCents - b.variants[0].priceCents);
    if (sort === 'price-high') found.sort((a, b) => b.variants[0].priceCents - a.variants[0].priceCents);
    if (sort === 'name') found.sort((a, b) => a.name.localeCompare(b.name));
    return found;
  }, [products, activeCategory, query, sort]);
  return <section className={`shop-section${featured ? '' : ' listing-section'}`} id="shop" aria-label="Browse products"><div className="section-heading">{featured && <div><p className="eyebrow">The merchant&apos;s selection</p><h2>Featured wares</h2></div>}
    <div className="catalog-tools"><div className="search-wrap"><Search aria-hidden="true" /><input className="ef-input" value={query} onChange={e => setQuery(e.target.value)} aria-label="Search products" placeholder="Search products" /></div><select className="ef-sort" value={sort} onChange={e => setSort(e.target.value)} aria-label="Sort products"><option value="featured">Featured</option><option value="price-low">Price: low to high</option><option value="price-high">Price: high to low</option><option value="name">Name: A to Z</option></select></div></div>
    {!category && <div className="filter-row" aria-label="Product categories">{[{ slug: 'all', name: 'All' }, ...collections].map(c => <button key={c.slug} aria-pressed={activeCategory === c.slug} className={activeCategory === c.slug ? 'active' : ''} onClick={() => setActiveCategory(c.slug)}>{c.name}</button>)}</div>}
    <p className="result-count" role="status" aria-live="polite">{filtered.length} {filtered.length === 1 ? 'product' : 'products'}</p>
    {filtered.length ? <div className="product-grid">{filtered.map(p => <ProductCard product={p} key={p.id} />)}</div> : <div className="no-results"><Package /><h3>No artifacts found</h3><p>Try another search or collection.</p><button className="ef-button outline" onClick={() => { setQuery(''); if (!category) setActiveCategory('all'); }}>Clear filters</button></div>}
  </section>;
}
function Home() {
  const { collections } = usePreview();
  return <><section className="hero"><div className="hero-illustration" role="img" aria-label="Dark fantasy vault atmosphere" /><div className="hero-scrim" /><div className="hero-content"><p className="eyebrow">Curated gear for legendary tables</p><h1>Every campaign deserves <span>a little magic.</span></h1><p>Distinctive tools, terrain and treasures for game masters, makers and adventurers.</p><div className="hero-actions"><Link className="ef-button" data-slot="button" to={`${ROOT}/shop`}>Explore the collection <ChevronRight /></Link><a href="#categories">Browse by category</a></div></div></section>
    <section className="category-strip" id="categories" aria-labelledby="ef-category-title"><div className="section-heading compact"><div><p className="eyebrow">Find your next artifact</p><h2 id="ef-category-title">Shop by category</h2></div></div><div className="category-grid">{collections.map(c => { const Icon = icons[c.icon] || Package; return <Link key={c.slug} to={`${ROOT}/collections/${c.slug}`}><span><Icon aria-hidden="true" /></span>{c.name}</Link>; })}</div></section>
    <Catalog featured /><section className="values" id="story"><div><ShieldCheck /><h3>Table-ready quality</h3><p>Our aim: durability, detail, and repeat adventures.</p></div><div><Compass /><h3>Made to discover</h3><p>Find the right piece for your next encounter.</p></div><div><Sparkles /><h3>Independent spirit</h3><p>A U.S.-focused shop built for the wider tabletop community.</p></div></section></>;
}
function Shop() { return <><div className="ef-page"><p className="eyebrow">The full collection</p><h1>Explore the archive.</h1></div><Catalog /></>; }
function Collection() {
  const { slug } = useParams();
  const { collections } = usePreview();
  const category = collections.find(c => c.slug === slug);
  if (!category) return <Missing />;
  return <><div className="ef-page"><p className="eyebrow">The collection</p><h1>{category.name}</h1><p className="ef-notice">{category.description}</p></div><Catalog key={slug} category={slug} /></>;
}
function Quantity({ value, onChange, label }) {
  return <div className="quantity-control"><button type="button" aria-label={`Decrease ${label}`} disabled={value <= 1} onClick={() => onChange(value - 1)}>−</button><input type="number" aria-label={label} min="1" max="99" value={value} onChange={e => { const q = Number(e.target.value); if (Number.isSafeInteger(q) && q >= 1 && q <= 99) onChange(q); }} /><button type="button" aria-label={`Increase ${label}`} disabled={value >= 99} onClick={() => onChange(value + 1)}>+</button></div>;
}
function Purchase({ product }) {
  const cart = usePreview();
  const [variantId, setVariantId] = useState(product.variants[0].id);
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const variant = product.variants.find(v => v.id === variantId);
  return <div className="purchase-form"><p className="product-price">{money(variant.priceCents)}</p><fieldset className="variant-options"><legend>Finish / option</legend>{product.variants.map(v => <label key={v.id} className={v.id === variantId ? 'selected' : ''}><input type="radio" name={`variant-${product.id}`} value={v.id} checked={v.id === variantId} onChange={() => { setVariantId(v.id); setAdded(false); }} />{v.label}</label>)}</fieldset><label className="quantity-label">Quantity</label><Quantity value={quantity} onChange={setQuantity} label={`quantity for ${product.name}`} />
    <button className="ef-button" disabled={!cart.ready} onClick={() => { cart.add(product.id, variantId, quantity); setAdded(true); }}>Add to preview bag <ShoppingBag aria-hidden="true" /></button><p className="ef-notice" role="status">{added ? 'Added to your preview bag.' : 'Sample listing. No inventory is reserved or order placed.'}</p><Link to={`${ROOT}/bag`} className="back-to-shop">View your bag</Link></div>;
}
function Product() {
  const { slug } = useParams();
  const { products, collections } = usePreview();
  const product = products.find(p => p.slug === slug);
  if (!product) return <Missing />;
  const category = collections.find(c => c.slug === product.category);
  return <div className="product-page"><nav className="crumbs" aria-label="Breadcrumb"><Link to="/">Home</Link><span>/</span><Link to={`${ROOT}/collections/${category.slug}`}>{category.name}</Link><span>/</span><span aria-current="page">{product.name}</span></nav><div className="product-detail-grid"><div className="product-visual"><ProductArt product={product} detail /></div><div className="product-detail-copy"><p className="eyebrow">{category.name}</p><h1>{product.name}</h1><p className="product-description">{product.description}</p><Purchase key={product.id} product={product} /><section className="product-detail-section"><h2>The concept</h2><ul>{product.details.map(d => <li key={d}>{d}</li>)}</ul></section><section className="product-detail-section"><h2>Sample specifications</h2><dl className="spec-list">{product.specifications.map(s => <div key={s.label}><dt>{s.label}</dt><dd>{s.value}</dd></div>)}</dl></section></div></div></div>;
}
function Bag() {
  const cart = usePreview();
  return <div className="ef-page"><p className="eyebrow">Your next adventure</p><h1>Your bag</h1><p className="ef-notice">Preview bag · Sample prices · Checkout disabled</p>{cart.notice && <p role="status">{cart.notice}</p>}
    {!cart.ready ? <p role="status">Loading your bag…</p> : !cart.lines.length ? <div className="ef-state"><ShoppingBag /><p>Your bag is empty.</p><Link className="ef-button" to={`${ROOT}/shop`}>Explore the collection</Link></div> : <><div className="ef-cart-list">{cart.lines.map(line => {
      const product = cart.products.find(p => p.id === line.productId);
      const variant = product?.variants.find(v => v.id === line.variantId);
      if (!product || !variant) return null;
      const key = lineKey(line);
      return <div className="ef-cart-line" key={key}><Package aria-hidden="true" /><div><Link to={`${ROOT}/products/${product.slug}`}>{product.name}</Link><span>{variant.label} · {money(variant.priceCents)} each</span></div><Quantity value={line.quantity} onChange={q => cart.setQuantity(key, q)} label={`quantity for ${product.name}, ${variant.label}`} /><strong>{money(variant.priceCents * line.quantity)}</strong><button className="icon-button" onClick={() => cart.remove(key)} aria-label={`Remove ${product.name}, ${variant.label}`}><Trash2 /></button></div>;
    })}</div><div className="ef-cart-total"><span>Subtotal</span><strong>{money(cart.subtotal)}</strong></div><button className="ef-button" disabled>Checkout unavailable in preview</button><p className="ef-notice">Verified products, fulfillment, payment and shipping will be connected before sales open.</p></>}
  </div>;
}
function Missing() { return <div className="ef-state"><h1>This artifact could not be found.</h1><p>Explore the collection to find your next piece.</p><Link className="ef-button" to={`${ROOT}/shop`}>Browse all products</Link></div>; }

export default function StorefrontPreview() {
  const catalog = useQuery({ queryKey: ['storefront-preview-catalog'], queryFn: ({ signal }) => loadCatalog(signal), staleTime: 30000, retry: 1 });
  const location = useLocation();
  useEffect(() => {
    const previous = document.title;
    document.title = 'Eldritch Fable | Independent Storefront';
    return () => { document.title = previous; };
  }, []);
  useEffect(() => { if (location.hash) requestAnimationFrame(() => document.getElementById(location.hash.slice(1))?.scrollIntoView()); }, [location.hash, catalog.isSuccess]);
  if (catalog.isPending) return <div className="ef-storefront"><div className="ef-state" role="status">Loading the collection…</div></div>;
  if (catalog.isError) return <div className="ef-storefront"><div className="ef-state"><h1>The collection is temporarily unavailable.</h1><p>Please try loading it again.</p><button className="ef-button" onClick={() => catalog.refetch()}>Retry</button></div></div>;
  return <div className="ef-storefront"><PreviewProvider products={catalog.data.products} collections={catalog.data.collections}><Header /><main id="ef-main" tabIndex={-1}><Routes><Route index element={<Home />} /><Route path="shop" element={<Shop />} /><Route path="collections/:slug" element={<Collection />} /><Route path="products/:slug" element={<Product />} /><Route path="bag" element={<Bag />} /><Route path="*" element={<Missing />} /></Routes></main><footer><Brand /><p>Tools for the stories still waiting to be told.</p><span>© 2026 Eldritch Fable</span></footer></PreviewProvider></div>;
}