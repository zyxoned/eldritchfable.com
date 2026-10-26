import { createContext, useContext, useEffect, useState } from 'react';
import { useCatalog } from '@/lib/storefront-catalog';
import { CART_KEY, lineKey, migrateLegacyCart, normalizeLines, productHref, readLines } from '@/lib/storefront-core';
const CartContext = createContext(null);
export const useCart = () => useContext(CartContext);
export function CartProvider({ children }) {
  const catalog = useCatalog();
  const [lines, setLines] = useState([]);
  const [ready, setReady] = useState(false);
  const [notice, setNotice] = useState('');
  const [bagOpen, setBagOpen] = useState(false);
  useEffect(() => {
    if (catalog.loading || catalog.error || ready) return;
    try {
      const saved = localStorage.getItem(CART_KEY);
      setLines(saved ? readLines(saved) : migrateLegacyCart(localStorage.getItem('eldritch_cart'), catalog.products));
    } catch { setNotice('Your browser blocked saved bags. Your bag will last for this visit.'); }
    setReady(true);
  }, [catalog.loading, catalog.error, catalog.products, ready]);
  useEffect(() => {
    if (!ready) return;
    try { localStorage.setItem(CART_KEY, JSON.stringify({ version: 2, lines })); } catch { setNotice('Your browser blocked saved bags. Your bag will last for this visit.'); }
  }, [lines, ready]);
  useEffect(() => {
    const sync = event => { if (event.key === CART_KEY || event.key === null) setLines(readLines(event.newValue)); };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);
  const items = lines.map(line => {
    const product = catalog.products.find(p => p.id === line.productId);
    const variant = product?.variants.find(v => v.id === line.variantId);
    const requested = lines.filter(l => l.productId === line.productId).reduce((sum, l) => sum + l.quantity, 0);
    const available = !!product?.available && !!variant && (product.product_type === 'digital' || product.stock >= requested);
    return { ...line, key: lineKey(line), id: line.productId, name: product?.name || 'Unavailable product', option: variant?.label || 'Unavailable option',
      price: (variant?.priceCents || 0) / 100, priceCents: variant?.priceCents || 0, image_url: product?.image_url, url: product ? productHref(product) : '/shop',
      product_type: product?.product_type, fulfillment: product?.fulfillment, available };
  });
  const subtotalCents = items.reduce((sum, item) => sum + item.priceCents * item.quantity, 0);
  const removeItem = (id, variantId) => setLines(current => current.filter(line => !(line.productId === id && line.variantId === variantId)));
  const updateQuantity = (id, variantId, quantity) => {
    if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 99) return;
    setLines(current => current.map(line => line.productId === id && line.variantId === variantId ? { ...line, quantity } : line));
  };
  const addItem = (product, quantity = 1, variantId = product.variants?.[0]?.id) => {
    if (!ready || !product.available || !Number.isSafeInteger(quantity) || quantity < 1 || !catalog.products.some(p => p.id === product.id && p.variants.some(v => v.id === variantId))) return false;
    const requested = lines.filter(l => l.productId === product.id).reduce((sum, l) => sum + l.quantity, 0) + quantity;
    if (quantity > 99 || requested > 99 || (product.product_type === 'physical' && requested > product.stock)) { setNotice('The requested quantity is unavailable. Please adjust your bag.'); return false; }
    setLines(current => normalizeLines([...current, { productId: product.id, variantId, quantity }]));
    setBagOpen(true); setNotice(''); return true;
  };
  return <CartContext.Provider value={{ lines, items, ready, notice, bagOpen, setBagOpen, addItem, removeItem, updateQuantity, clearCart: () => setLines([]),
    count: lines.reduce((sum, l) => sum + l.quantity, 0), subtotalCents, subtotal: subtotalCents / 100,
    hasPhysical: items.some(i => i.product_type === 'physical'), hasUnavailable: items.some(i => !i.available) }}>{children}</CartContext.Provider>;
}