import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ShoppingBag } from 'lucide-react';
import { useCatalog } from '@/lib/storefront-catalog';
import { useCart } from '@/lib/cartContext';
import { money } from '@/lib/storefront-core';
import ProductArt from '@/components/storefront/ProductArt';
import QuantityControl from '@/components/storefront/QuantityControl';
function PurchaseForm({ product }) {
  const cart = useCart(); const [variantId, setVariantId] = useState(product.variants[0].id);
  const [quantity, setQuantity] = useState(1); const [added, setAdded] = useState(false);
  const variant = product.variants.find(v => v.id === variantId);
  const max = product.available ? (product.product_type === 'digital' ? 99 : Math.min(99, product.stock)) : 0;
  return <div className="purchase-form"><p className="product-price">{product.priceConfirmed ? money(variant.priceCents) : "Coming soon"}</p><fieldset className="variant-options"><legend>Finish / option</legend>{product.variants.map(v => <label key={v.id} className={v.id === variantId ? 'selected' : ''}><input type="radio" name={`variant-${product.id}`} checked={v.id === variantId} onChange={() => { setVariantId(v.id); setAdded(false); }} />{v.label}</label>)}</fieldset><QuantityControl value={quantity} onChange={setQuantity} max={Math.max(1, max)} label={`quantity for ${product.name}`} /><button className="ef-button" disabled={!cart.ready || max < 1} onClick={() => setAdded(cart.addItem(product, quantity, variantId))}>{max < 1 ? 'Temporarily unavailable' : 'Add to bag'} <ShoppingBag aria-hidden="true" /></button><p className="ef-notice" role="status">{!product.available ? 'We’re sorry, this item is temporarily unavailable. We’re arranging stock and shipping. Thank you for your patience.' : added ? 'Added to your bag.' : product.product_type === 'digital' ? 'Digital delivery is available after confirmed payment.' : product.est_shipping || 'Shipping is confirmed at checkout.'}</p>{cart.notice && <p role="status" className="ef-notice">{cart.notice}</p>}</div>;
}
export default function ProductDetail() {
  const { id, slug } = useParams(); const catalog = useCatalog();
  const product = catalog.products.find(p => id ? p.id === id : p.slug === slug);
  if (catalog.loading) return <div className="ef-state" role="status">Finding your artifact…</div>;
  if (catalog.error) return <div className="ef-state" role="alert"><h1>The collection is temporarily unavailable.</h1><button className="ef-button" onClick={() => catalog.refetch()}>Try again</button></div>;
  if (!product) return <div className="ef-state"><h1>This artifact could not be found.</h1><Link className="ef-button" to="/shop">Browse all products</Link></div>;
  return <div className="product-page"><nav className="crumbs" aria-label="Breadcrumb"><Link to="/">Home</Link><span>/</span><Link to={`/collections/${product.categorySlug}`}>{product.categoryName}</Link><span>/</span><span aria-current="page">{product.name}</span></nav><div className="product-detail-grid"><div className="product-visual"><ProductArt key={product.id} product={product} detail /></div><div className="product-detail-copy"><p className="eyebrow">{product.categoryName}</p><h1>{product.name}</h1><p className="product-description">{product.description}</p><PurchaseForm key={product.id} product={product} />{product.details.length > 0 && <section className="product-detail-section"><h2>The details</h2><ul>{product.details.map((detail, index) => <li key={index}>{detail}</li>)}</ul></section>}{product.specifications.length > 0 && <section className="product-detail-section"><h2>Specifications</h2><dl className="spec-list">{product.specifications.map((spec, index) => <div key={index}><dt>{spec.label}</dt><dd>{spec.value}</dd></div>)}</dl></section>}</div></div></div>;
}