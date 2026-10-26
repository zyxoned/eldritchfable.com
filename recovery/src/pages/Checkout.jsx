import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useCart } from '@/lib/cartContext';
import { useAuth } from '@/lib/AuthContext';
import { money } from '@/lib/storefront-core';
export default function Checkout() {
  const cart = useCart(); const auth = useAuth(); const [params] = useSearchParams();
  const [quote, setQuote] = useState(null); const [error, setError] = useState('');
  const [loading, setLoading] = useState(false); const [submitting, setSubmitting] = useState(false);
  const fingerprint = JSON.stringify(cart.lines);
  const checkoutKey = useMemo(() => crypto.randomUUID(), [fingerprint]);
  useEffect(() => {
    if (!auth.isAuthenticated || !cart.ready || !cart.lines.length || cart.hasUnavailable) return;
    let active = true; setLoading(true); setError(''); setQuote(null);
    base44.functions.invoke('checkout-quote', { lines: cart.lines }).then(res => { if (active) setQuote(res.data); }).catch(err => { if (active) setError(err.response?.data?.error || 'Checkout is temporarily unavailable. Your bag remains saved.'); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [auth.isAuthenticated, cart.ready, fingerprint, cart.hasUnavailable]);
  const pay = async () => {
    if (submitting || !quote?.checkout_enabled) return;
    setSubmitting(true); setError('');
    try {
      const res = await base44.functions.invoke('create-checkout-session', { lines: cart.lines, checkout_key: checkoutKey });
      const url = new URL(res.data.url);
      if (url.protocol !== 'https:' || url.hostname !== 'checkout.stripe.com') throw new Error('Invalid payment redirect');
      try { sessionStorage.setItem('ef-checkout-bag', JSON.stringify({ orderId: res.data.order_id, fingerprint })); } catch { /* Retain the bag if storage is unavailable. */ }
      window.location.assign(url.href);
    } catch (err) { setError(err.response?.data?.error || 'Payment could not start. Your bag remains saved.'); setSubmitting(false); }
  };
  return <div className="ef-page"><p className="eyebrow">One step closer to adventure</p><h1>Checkout</h1>{params.has('cancelled') && <p className="status-banner" role="status">Payment was cancelled. Your bag remains saved.</p>}{!auth.isAuthenticated ? <div className="ef-state"><p>Sign in to keep your orders and downloads together.</p><Link className="ef-button" to="/login?returnTo=%2Fcheckout">Sign in to continue</Link></div> : !cart.ready ? <p role="status">Loading your bag…</p> : !cart.lines.length ? <div className="ef-state"><p>Your bag is empty.</p><Link className="ef-button" to="/shop">Explore the collection</Link></div> : cart.hasUnavailable ? <div className="status-banner"><p>A product or quantity is unavailable.</p><Link className="ef-button outline" to="/cart">Update your bag</Link></div> : <>{loading && <p role="status">Checking prices and availability…</p>}{error && <p className="status-banner" role="alert">{error}</p>}{quote && <><div className="checkout-summary">{quote.items.map(item => <div key={`${item.id}:${item.variant_id}`}><span>{item.name} · {item.option} × {item.quantity}</span><strong>{money(item.price_cents * item.quantity)}</strong></div>)}<div><strong>Subtotal</strong><strong>{money(quote.subtotal_cents)}</strong></div><p className="ef-notice">Tax is calculated on the secure payment page.</p></div>{!quote.checkout_enabled && <p className="status-banner" role="status">{quote.message}</p>}<button className="ef-button" disabled={!quote.checkout_enabled || submitting} onClick={pay}>{submitting ? 'Opening secure payment…' : quote.checkout_enabled ? 'Continue to secure payment' : 'Checkout opens soon'}</button></>}<p className="ef-notice"><Link to="/cart">Return to your bag</Link> · No order is paid until payment is confirmed.</p></>}</div>;
}