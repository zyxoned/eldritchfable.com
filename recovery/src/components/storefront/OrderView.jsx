import { useState } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { money } from '@/lib/storefront-core';
export default function OrderView({ order }) {
  const [error, setError] = useState(''); const [busy, setBusy] = useState('');
  const paid = order.payment_status === 'paid' && ['paid', 'fulfilled'].includes(order.status);
  const download = async productId => {
    setBusy(productId); setError('');
    try {
      const res = await base44.functions.invoke('order-download', { order_id: order.id, product_id: productId });
      const url = new URL(res.data.url);
      if (url.protocol !== 'https:') throw new Error('Invalid download');
      window.location.assign(url.href);
    } catch (err) { setError(err.response?.data?.error || 'The download is temporarily unavailable. Please try again.'); }
    finally { setBusy(''); }
  };
  return <article className="checkout-summary"><div><Link to={`/order/${order.id}`}>Order #{order.id?.slice(-8).toUpperCase()}</Link><strong>{money(Math.round(Number(order.total || 0) * 100))}</strong></div><p>Status: {order.status} · Payment: {order.payment_status || 'Awaiting verification'}</p>{(order.items || []).map((item, index) => <div key={index}><span>{item.name}{item.option && ` · ${item.option}`} × {item.quantity}</span><span>{money(Math.round(Number(item.price || 0) * 100) * item.quantity)}</span>{item.product_type === 'digital' && paid && <button className="ef-button outline" disabled={!!busy} onClick={() => download(item.id)}>{busy === item.id ? 'Preparing…' : 'Download'}</button>}</div>)}{order.has_physical && <><p>Fulfillment: {String(order.fulfillment_status || 'not_required').replaceAll('_', ' ')}</p>{order.tracking_number && <p>Tracking: {order.tracking_number}</p>}</>}{!paid && order.has_digital && <p className="ef-notice">Downloads become available after confirmed payment.</p>}{error && <p role="alert">{error}</p>}</article>;
}