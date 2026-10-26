import { Link } from 'react-router-dom';
import { Package, ShoppingBag, Trash2, X } from 'lucide-react';
import { money } from '../../lib/storefront-preview-core.js';

export default function BagDrawer({ open, onOpenChange, items, subtotal, onQuantity, onRemove, notice = '', shopHref = '/shop', cartHref = '/bag' }) {
  if (!open) return null;
  return <div className="ef-drawer-layer">
    <button type="button" className="ef-drawer-backdrop" aria-label="Close bag" onClick={() => onOpenChange(false)} />
    <aside className="ef-storefront cart-sheet ef-drawer-panel" role="dialog" aria-modal="true" aria-label="Shopping bag">
      <div className="bag-heading"><h2>Your bag</h2><button type="button" className="icon-button" onClick={() => onOpenChange(false)} aria-label="Close bag"><X /></button><p>Sample wares · Checkout disabled</p></div>
      <div className="cart-list">
        {notice && <p role="status" className="ef-notice">{notice}</p>}
        {!items.length ? <div className="empty-cart"><ShoppingBag /><p>Your bag is empty.</p><Link className="ef-button" to={shopHref} onClick={() => onOpenChange(false)}>Explore the collection</Link></div> :
          items.map(item => <div className="cart-item" key={item.key}><div className="bag-thumb"><Package aria-hidden="true" /></div><div className="cart-line-details">
            <Link className="cart-product-link" to={item.url} onClick={() => onOpenChange(false)}>{item.name}</Link><span>{item.option} · {money(item.priceCents)} each</span>
            <div className="cart-line-controls"><input type="number" min="1" max="99" value={item.quantity} aria-label={'Quantity for ' + item.name} onChange={event => onQuantity(item, Number(event.target.value))} /><button type="button" className="icon-button" onClick={() => onRemove(item)} aria-label={'Remove ' + item.name}><Trash2 /></button></div>
          </div><strong className="line-total">{money(item.priceCents * item.quantity)}</strong></div>)}
      </div>
      <div className="bag-footer"><div className="cart-total"><span>Subtotal</span><strong>{money(subtotal)}</strong></div><p className="bag-note">Sample prices. No payment or order is created.</p><Link className="ef-button checkout-button" to={cartHref} onClick={() => onOpenChange(false)}>View bag</Link></div>
    </aside>
  </div>;
}
