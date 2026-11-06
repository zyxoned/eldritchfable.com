import test from 'node:test';
import assert from 'node:assert/strict';
import { CHECKOUT_ATTEMPT_KEY, checkoutAttempt, retireCheckoutAttempt, orderPresentation, stripeHostedUrl, safeCheckoutNext } from '../src/lib/checkout-core.js';

const items=[{productId:'bag',variantId:'natural',quantity:1}];
function storage() { const values=new Map(); return {getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)}; }

test('checkout retry keys survive reload and cannot be reused for a different account or bag',()=>{
  const store=storage(); let count=0; const key=()=> '00000000-0000-4000-8000-'+String(++count).padStart(12,'0');
  assert.equal(checkoutAttempt(store,'owner',items,key).key,'00000000-0000-4000-8000-000000000001');
  assert.equal(checkoutAttempt(store,'owner',items,key).key,'00000000-0000-4000-8000-000000000001');
  assert.equal(checkoutAttempt(store,'owner',[{...items[0],quantity:2}],key).key,'00000000-0000-4000-8000-000000000002');
  assert.equal(checkoutAttempt(store,'other',items,key).key,'00000000-0000-4000-8000-000000000003');
});

test('blocked attempt storage stops checkout instead of silently losing retry identity',()=>{
  const blocked={getItem:()=>null,setItem:()=>{throw Error('blocked');}};
  assert.throws(()=>checkoutAttempt(blocked,'owner',items,()=> 'synthetic-key'));
});

test('an explicit new checkout retires only the matching server-confirmed terminal attempt',()=>{
  const store=storage(), id='12345678-1234-1234-1234-123456789abc';
  const attempt=checkoutAttempt(store,'owner',items,()=> '00000000-0000-4000-8000-000000000001');
  store.setItem(CHECKOUT_ATTEMPT_KEY,JSON.stringify({...attempt,orderId:id}));
  for(const order of [{id,status:'pending'},{id,status:'review'},{id,status:'paid',review_reason:'charge.refunded'},{id:'another-order',status:'expired'}]) assert.equal(retireCheckoutAttempt(store,order),false);
  assert.equal(checkoutAttempt(store,'owner',items).key,attempt.key);
  assert.equal(retireCheckoutAttempt(store,{id,status:'expired'}),true);
  const next=checkoutAttempt(store,'owner',items,()=> '00000000-0000-4000-8000-000000000002');
  assert.equal(next.key,'00000000-0000-4000-8000-000000000002');
});

test('payment return presentation only confirms a server-confirmed paid order',()=>{
  assert.equal(orderPresentation({status:'pending'},false).title,'Confirming your payment');
  assert.equal(orderPresentation({status:'pending'},true).title,'Checkout paused');
  assert.equal(orderPresentation({status:'paid'},true).title,'Payment confirmed');
  assert.equal(orderPresentation({status:'paid',review_reason:'charge.refunded'},false).title,'Your order needs attention');
  assert.equal(orderPresentation({status:'review'},false).title,'Your order needs attention');
  assert.equal(orderPresentation({status:'expired'},false).title,'Checkout expired');
  assert.equal(orderPresentation({status:'payment_failed'},false).title,'Payment was not completed');
});

test('only Stripe HTTPS redirects and explicitly allowed local checkout return paths are accepted',()=>{
  assert.equal(stripeHostedUrl('https://checkout.stripe.com/c/pay/test'),true);
  for(const url of ['javascript:alert(1)','https://checkout.stripe.com.evil.test/pay','https://evil.test','http://checkout.stripe.com/pay','https://attacker@checkout.stripe.com/pay']) assert.equal(stripeHostedUrl(url),false);
  assert.equal(safeCheckoutNext('/checkout'),'/checkout');
  const path='/checkout/return?order=12345678-1234-1234-1234-123456789abc';
  assert.equal(safeCheckoutNext(path),path);
  for(const next of ['//evil.test','https://evil.test','/checkout/return?order=bad','/checkout/return?order=12345678-1234-1234-1234-123456789abc&next=https://evil.test']) assert.equal(safeCheckoutNext(next),null);
});
