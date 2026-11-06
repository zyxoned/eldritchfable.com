export const CHECKOUT_ATTEMPT_KEY = 'eldritch-fable:checkout-attempt:v1';
export const validOrderId = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
export function checkoutAttempt(storage,owner,items,makeKey=()=>crypto.randomUUID()) {
  const signature=JSON.stringify(items.map(({productId,variantId,quantity})=>({productId,variantId,quantity})).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b))));
  let saved;
  try { saved=JSON.parse(storage.getItem(CHECKOUT_ATTEMPT_KEY)); } catch { /* Replace malformed local state. */ }
  if (saved?.owner===owner && saved.signature===signature && validOrderId(saved.key)) return saved;
  const attempt={owner,signature,key:makeKey()};
  storage.setItem(CHECKOUT_ATTEMPT_KEY,JSON.stringify(attempt));
  return attempt;
}
export function retireCheckoutAttempt(storage,order) {
  if (!['paid','expired','payment_failed'].includes(order.status) || order.review_reason) return false;
  let saved;
  const raw=storage.getItem(CHECKOUT_ATTEMPT_KEY);
  try { saved=JSON.parse(raw); } catch { return false; }
  if (!saved) return true;
  if (saved.orderId!==order.id) return false;
  storage.removeItem(CHECKOUT_ATTEMPT_KEY);
  return true;
}
export function stripeHostedUrl(value) {
  try { const url=new URL(value); return url.protocol==='https:' && url.hostname==='checkout.stripe.com' && !url.username && !url.password; }
  catch { return false; }
}
export function safeCheckoutNext(value) {
  if (value==='/checkout') return value;
  if (typeof value!=='string') return null;
  const match=value.match(/^\/checkout\/return\?order=([^&]+)(?:&cancelled=1)?$/);
  return match && validOrderId(match[1]) ? value : null;
}
export function orderPresentation(order,cancelled=false) {
  if (order.status==='review' || order.review_reason) return {title:'Your order needs attention',message:'Your order is being held for review. Please check again before starting another payment.'};
  if (order.status==='paid') return {title:'Payment confirmed',message:'Your payment has been confirmed and your order has been recorded.'};
  if (order.status==='expired') return {title:'Checkout expired',message:'This checkout has expired. Your bag is saved so you can review it again.'};
  if (order.status==='payment_failed') return {title:'Payment was not completed',message:'The payment method did not complete this payment. Review your bag before trying again.'};
  if (cancelled) return {title:'Checkout paused',message:'Your bag is saved. You can return to checkout when you are ready.'};
  return {title:'Confirming your payment',message:'We are waiting for payment confirmation. Some payment methods take longer; this page will check for updates.'};
}
