import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Link, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Brush, Castle, ChevronRight, Compass, Dices, Hammer, Map as MapIcon, Menu, Package, Search, ShieldCheck, ShoppingBag, Heart, Sparkles, Sword, Trash2, WandSparkles, X } from 'lucide-react';
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
  const [wishlist, setWishlist] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('ef-preview-wishlist') || '[]');
      return Array.isArray(saved) ? [...new Set(saved.filter(id => typeof id === 'string'))].slice(0, 200) : [];
    } catch { return []; }
  });
  useEffect(() => { try { localStorage.setItem('ef-preview-wishlist', JSON.stringify(wishlist)); } catch { /* private browsing */ } }, [wishlist]);
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
    bagOpen, setBagOpen, wishlist, toggleWish(id) { setWishlist(old => old.includes(id) ? old.filter(x => x !== id) : [...old, id].slice(-200)); },
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
  const navigate = useNavigate();
  const [searchOpen, setSearchOpen] = useState(() => location.pathname !== '/');
  const searchInput = useRef(null);
  const searchButton = useRef(null);
  const [search, setSearch] = useState(() => new URLSearchParams(location.search).get('q') || '');
  useEffect(() => { setSearch(new URLSearchParams(location.search).get('q') || ''); }, [location.search]);
  useEffect(() => { setMenuOpen(false); cart.setBagOpen(false); setSearchOpen(location.pathname !== '/'); }, [location.pathname, location.search, location.hash, cart.setBagOpen]);
  function openSearch(event) {
    if (searchOpen) return;
    event.preventDefault();
    setSearchOpen(true);
    requestAnimationFrame(() => searchInput.current?.focus());
  }
  function closeSearch(event) {
    if (event.key !== 'Escape' || !searchOpen) return;
    event.preventDefault();
    setSearchOpen(false);
    searchButton.current?.focus();
  }
  const links = <><Link to="/">The Tavern</Link><Link to="/shop?q=dice">Wares</Link><Link to="/shop?q=miniature">Miniatures</Link><Link to="/shop?q=map">Maps & Aids</Link><Link to="/shop?q=paint">Painting & Terrain</Link><Link to="/shop?q=tools">GM Tools</Link><Link to="/shop?q=cosplay">Cosplay & Digital</Link></>;
  return <><a className="skip-link" href="#ef-main">Skip to content</a><div className="announcement">The next adventure is taking shape · Catalog preview · Checkout opening soon</div>
    <header className="site-header"><Brand /><nav className="reference-nav" aria-label="Shop categories">{links}</nav><form className="header-search" role="search" onKeyDown={closeSearch} onSubmit={event => { event.preventDefault(); navigate('/shop?q=' + encodeURIComponent(search.trim())); }}><button ref={searchButton} type={searchOpen ? "submit" : "button"} onClick={openSearch} aria-label="Search store" aria-expanded={searchOpen} aria-controls="ef-header-search"><Search aria-hidden="true" /></button><input ref={searchInput} id="ef-header-search" hidden={!searchOpen} aria-label="Search the store" placeholder="Search dice, miniatures, maps, and more..." value={search} onChange={event => setSearch(event.target.value)} /></form><div className="header-actions"><Link to="/account" className="header-account">Account</Link><Link to="/wishlist" className="header-wishlist" aria-label={`Wishlist with ${cart.wishlist.length} products`}><Heart aria-hidden="true" /> <span>Wishlist ({cart.wishlist.length})</span></Link>
      <button className="icon-button mobile-only" onClick={() => setMenuOpen(!menuOpen)} aria-label={menuOpen ? 'Close menu' : 'Open menu'} aria-expanded={menuOpen} aria-controls="ef-mobile-menu">{menuOpen ? <X /> : <Menu />}</button>
      <button onClick={() => cart.setBagOpen(true)} className="cart-trigger ef-button outline" aria-label={`Shopping bag with ${count} items`}><ShoppingBag aria-hidden="true" /><span className="desktop-only">Bag</span><b>{count}</b></button>
    </div>{menuOpen && <nav id="ef-mobile-menu" className="mobile-nav" aria-label="Mobile navigation">{links}<Link to="/account">Account</Link><Link to="/wishlist">Wishlist ({cart.wishlist.length})</Link></nav>}</header><BagDrawer open={cart.bagOpen} onOpenChange={cart.setBagOpen} items={cart.lines.map(line => { const product = cart.products.find(p => p.id === line.productId); const variant = product?.variants.find(v => v.id === line.variantId); return { ...line, key: lineKey(line), name: product?.name, option: variant?.label, priceCents: variant?.priceCents || 0, url: `${ROOT}/products/${product?.slug}` }; })} subtotal={cart.subtotal} onQuantity={(line, quantity) => cart.setQuantity(line.key, quantity)} onRemove={line => cart.remove(line.key)} notice={cart.notice} shopHref={`${ROOT}/shop`} cartHref={`${ROOT}/bag`} preview /></>;
}
function ProductArt({ product, detail = false }) {
  const art = /dice/i.test(product.name) ? 'product-dice' : /miniature|figure|fighter|dragon/i.test(product.name) ? 'product-mini' : /map|board|battle/i.test(product.name) ? 'product-map' : /paint|brush/i.test(product.name) ? 'product-paint' : null;
  return <div className={`product-art art-${product.art}${detail ? ' detail-art' : ''}`} style={art ? {backgroundImage:`linear-gradient(0deg,#08070a33,transparent 65%),url(/approved/${art.replace('product-','item-')}.webp)`,backgroundSize:'cover',backgroundPosition:'center'} : undefined}><span>Concept image · Preview</span>{!art && <Package aria-hidden="true" />}{detail && <p className="art-caption">Illustrative imagery, not verified supplier photography. Actual products may differ.</p>}</div>;
}
function ProductCard({ product }) {
  const cart = usePreview();
  const { collections } = cart;
  const category = collections.find(c => c.slug === product.category);
  const saved = cart.wishlist.includes(product.id);
  return <article className="product-card"><Link to={`${ROOT}/products/${product.slug}`} className="product-art-link" aria-label={`View ${product.name}`}><ProductArt product={product} /></Link><div className="product-info"><button type="button" className="wish-toggle" aria-label={saved ? `Remove ${product.name} from wishlist` : `Save ${product.name} to wishlist`} aria-pressed={saved} onClick={() => cart.toggleWish(product.id)}><Heart fill={saved ? 'currentColor' : 'none'} /></button><p className="product-category">{category?.name}</p><h3><Link to={`${ROOT}/products/${product.slug}`}>{product.name}</Link></h3><div className="product-bottom"><span className="price">{money(product.variants[0].priceCents)}</span><button className="ef-button outline" type="button" disabled={!cart.ready} onClick={() => cart.add(product.id,product.variants[0].id,1)}><ShoppingBag aria-hidden="true"/> Add to bag</button></div></div></article>;
}
function Catalog({ category = '', featured = false }) {
  const { products, collections } = usePreview();
  const location = useLocation();
  const navigate = useNavigate();
  const [query, setQuery] = useState(() => new URLSearchParams(location.search).get('q') || '');
  const [activeCategory, setActiveCategory] = useState(category || 'all');
  const [sort, setSort] = useState('featured');
  useEffect(() => {
    setQuery(new URLSearchParams(location.search).get('q') || '');
    setActiveCategory(category || 'all');
  }, [category, location.key, location.search]);
  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    const found = products.filter(p => (activeCategory === 'all' || p.category === activeCategory) && (!term || `${p.name} ${p.description} ${p.category} ${collections.find(c => c.slug === p.category)?.name || ''} ${p.variants.map(v => v.label).join(' ')}`.toLowerCase().includes(term)));
    if (sort === 'price-low') found.sort((a, b) => a.variants[0].priceCents - b.variants[0].priceCents);
    if (sort === 'price-high') found.sort((a, b) => b.variants[0].priceCents - a.variants[0].priceCents);
    if (sort === 'name') found.sort((a, b) => a.name.localeCompare(b.name));
    return found;
  }, [products, collections, activeCategory, query, sort]);
  return <section className={`shop-section${featured ? '' : ' listing-section'}`} id="shop" aria-label="Browse products"><div className="section-heading">{featured && <div><p className="eyebrow">Curated for the tabletop</p><h2>Featured Products</h2></div>}
    <div className="catalog-tools"><div className="search-wrap"><Search aria-hidden="true" /><input className="ef-input" value={query} onChange={e => setQuery(e.target.value)} aria-label="Search products" placeholder="Search products" /></div><select className="ef-sort" value={sort} onChange={e => setSort(e.target.value)} aria-label="Sort products"><option value="featured">Featured</option><option value="price-low">Price: low to high</option><option value="price-high">Price: high to low</option><option value="name">Name: A to Z</option></select></div></div>
    {!category && <div className="filter-row" aria-label="Product categories">{[{ slug: 'all', name: 'All' }, ...collections].map(c => <button key={c.slug} aria-pressed={activeCategory === c.slug} className={activeCategory === c.slug ? 'active' : ''} onClick={() => setActiveCategory(c.slug)}>{c.name}</button>)}</div>}
    <p className="result-count" role="status" aria-live="polite">{filtered.length} {filtered.length === 1 ? 'product' : 'products'}</p>
    {filtered.length ? <div className="product-grid">{(featured ? filtered.slice(0,4) : filtered).map(p => <ProductCard product={p} key={p.id} />)}</div> : <div className="no-results"><Package /><h3>No artifacts found</h3><p>Try another search or collection.</p><button className="ef-button outline" onClick={() => { setQuery(''); if (!category) setActiveCategory('all'); navigate(location.pathname); }}>Clear filters</button></div>}
  </section>;
}
const tavernCategories = [
  { slug: 'dice', query: 'dice', title: 'The Wares', description: 'Curated gear, accessories, and essentials for your next adventure.', cta: 'Browse wares' },
  { slug: 'miniatures', query: 'miniature', title: 'Miniatures & Encounters', description: 'Bring your world to life with stunning miniatures and encounters.', cta: 'Explore miniatures' },
  { slug: 'maps', query: 'map', title: 'Maps & Encounter Aids', description: 'Set the scene with maps, tiles, and encounter aids.', cta: 'Explore maps' },
  { slug: 'painting', query: 'paint', title: 'Painting & Terrain Supplies', description: 'Everything you need to paint, build, and customize.', cta: 'Shop supplies' },
  { slug: 'tools', query: 'tools', title: 'Game Master Tools', description: 'Resources to plan, run, and elevate your campaigns.', cta: 'Explore GM tools' },
  { slug: 'cosplay', query: 'cosplay', title: 'DIY, Cosplay & Digital Wares', description: 'Create, customize, and gear up for your next persona.', cta: 'Explore cosplay & digital' },
];
function Home() {
  const { collections } = usePreview();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const categoryHref = category => {
    const matched = collections.find(item => item.slug === category.slug || item.name?.toLowerCase().includes(category.title.toLowerCase()));
    return matched ? '/collections/' + encodeURIComponent(matched.slug) : '/shop?q=' + encodeURIComponent(category.query);
  };
  return <>
    <section className="hero" aria-label="Welcome to the Tavern">
      <img className="mobile-dragon-image" src="/approved/hero-dragon.webp" alt="Dragon and a fantastical castle in warm torchlight" />
      <div className="hero-illustration" aria-hidden="true" />
      <div className="hero-scrim" />
      <div className="hero-content">
        <h1>Adventures <span>Become Real</span></h1>
        <div className="hero-divider" aria-hidden="true"><span>✧</span></div>
        <p>Extraordinary wares for epic tables</p>
        <div className="hero-actions">
          <Link className="ef-button" data-slot="button" to="/shop">Enter the Loot Cache <ChevronRight aria-hidden="true" /></Link>
        </div>
      </div>
    </section>
    <section className="category-strip" id="categories" aria-labelledby="ef-category-title">
      <div className="fable-emblem">
        <Castle aria-hidden="true" className="fable-emblem-icon" />
        <h2 id="ef-category-title">Legendary gear for stories yet to be told</h2>
        <span className="fable-orb" aria-hidden="true" />
      </div>
      <div className="category-grid">
        {tavernCategories.map((category, index) =>
          <article className={'tavern-category tavern-category-' + (index + 1)} key={category.slug}>
            <Link to={categoryHref(category)} className="tavern-category-image" aria-label={'Explore ' + category.title} />
            <div className="tavern-category-copy">
              <h3>{category.title}</h3><span className="tavern-rule" aria-hidden="true" />
              <p>{category.description}</p>
              <Link to={categoryHref(category)} className="tavern-category-button">{category.cta} <ChevronRight aria-hidden="true" /></Link>
            </div>
          </article>
        )}
      </div>
    </section>
    <section className="tavern-seek" id="seek" aria-label="Search the store">
      <h2>Find What <span>You Seek</span></h2>
      <form role="search" onSubmit={event => { event.preventDefault(); navigate('/shop?q=' + encodeURIComponent(search.trim())); }}>
        <input value={search} onChange={event => setSearch(event.target.value)} aria-label="Search for wares" placeholder="Search for wares, miniatures, maps, tools, and more…" />
        <button aria-label="Find wares" type="submit"><Search aria-hidden="true" /></button>
      </form>
    </section>
    <section className="values tavern-promise" id="story" aria-labelledby="tavern-promise-title">
      <h2 id="tavern-promise-title">Our Table-Ready Quality Promise</h2>
      <span className="tavern-promise-divider" aria-hidden="true">✧</span>
      <p>We promise to clearly describe materials, dimensions, and intended tabletop use. We will never claim unverified inventory is available, and we will address damaged or incorrectly described orders according to our published policy.</p>
    </section>
  </>;
}
function Wishlist() { const cart=usePreview(); const saved=cart.products.filter(p=>cart.wishlist.includes(p.id)); return <><div className="ef-page"><p className="eyebrow">Saved for your adventure</p><h1>Your Wishlist</h1><p className="ef-notice">Saved on this device. Items shown are illustrative previews, not verified inventory.</p></div>{saved.length ? <div className="shop-section"><div className="product-grid">{saved.map(p=><ProductCard key={p.id} product={p}/>)}</div></div> : <div className="ef-state"><Heart/><p>Your wishlist is empty.</p><Link className="ef-button" to="/shop">Browse the shop</Link></div>}</>; }
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
  return <div className="ef-storefront"><PreviewProvider products={catalog.data.products} collections={catalog.data.collections}><Header /><main id="ef-main" tabIndex={-1}><Routes><Route index element={<Home />} /><Route path="shop" element={<Shop />} /><Route path="collections/:slug" element={<Collection />} /><Route path="products/:slug" element={<Product />} /><Route path="bag" element={<Bag />} /><Route path="wishlist" element={<Wishlist />} /><Route path="*" element={<Missing />} /></Routes></main><footer className="tavern-footer">
  <div className="footer-brand"><Brand /><p>Legendary gear for stories yet to be told.</p></div>
  <nav aria-label="Shop footer"><h2>Shop</h2><Link to="/">The Tavern</Link><Link to="/shop">All wares</Link><Link to="/shop?q=miniature">Miniatures &amp; Encounters</Link><Link to="/shop?q=map">Maps &amp; Encounter Aids</Link><Link to="/shop?q=paint">Painting &amp; Terrain</Link><Link to="/shop?q=tools">GM Tools</Link></nav>
  <nav aria-label="Help footer"><h2>Help</h2><Link to="/account">Your account</Link><Link to="/bag">Your bag</Link><Link to="/wishlist">Wishlist</Link><Link to="/#story">Our promise</Link></nav>
  <div className="footer-update"><h2>Stay in the Know</h2><p>Our catalog is in preparation. Checkout remains unavailable until products and fulfillment are verified.</p><span>© 2026 Eldritch Fable</span></div>
</footer></PreviewProvider></div>;
}
