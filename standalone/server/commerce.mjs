import { randomBytes, randomUUID } from 'node:crypto';
import { digest, transaction } from './database.mjs';

const sessionEvents = new Set(['checkout.session.completed','checkout.session.async_payment_succeeded','checkout.session.async_payment_failed','checkout.session.expired']);
const riskEvents = new Set(['charge.refunded','charge.dispute.created']);
const fail = (status,code,orderId) => {
  const error=Object.assign(Error(code),{status,code});
  if (orderId) error.orderId=orderId;
  throw error;
};
const integer = value => Number.isSafeInteger(value) && value >= 0;
const identifier = value => typeof value === 'string' && value.length > 0 && value.length <= 120;
function canonicalItems(input) {
  if (!input || Object.keys(input).some(k=>k!=='items') || !Array.isArray(input.items) || !input.items.length || input.items.length>20) fail(400,'INVALID_CART');
  const merged = new Map();
  for (const item of input.items) {
    if (!item || Object.keys(item).some(k=>!['productId','variantId','quantity'].includes(k)) || !identifier(item.productId) || !identifier(item.variantId) || !Number.isSafeInteger(item.quantity) || item.quantity<1 || item.quantity>99) fail(400,'INVALID_CART');
    const key = JSON.stringify([item.productId,item.variantId]);
    const quantity = (merged.get(key)?.quantity || 0) + item.quantity;
    if (quantity>99) fail(400,'INVALID_CART');
    merged.set(key,{productId:item.productId,variantId:item.variantId,quantity});
  }
  return [...merged.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([,value])=>value);
}
function checkoutUrl(value) {
  try { const url=new URL(value); return url.protocol==='https:' && url.hostname==='checkout.stripe.com' && !url.username && !url.password; }
  catch { return false; }
}

export function createCommerceService(db,{stripe,config,now=Date.now}) {
  const get = id => typeof id==='string' ? db.prepare('SELECT * FROM commerce_orders WHERE id=?').get(id) : null;
  const prior = (user,key) => db.prepare('SELECT * FROM commerce_orders WHERE user_id=? AND request_key=?').get(user.id,key);
  const requireAdmin = user => {
    if (!user || user.role!=='admin' || !db.prepare("SELECT id FROM account_users WHERE id=? AND role='admin' AND disabled_at IS NULL AND email_verified_at IS NOT NULL").get(user.id)) fail(403,'ADMIN_REQUIRED');
  };
  const sameRequest = (row,hash) => { if (row.request_hash!==hash) fail(409,'IDEMPOTENCY_CONFLICT'); return row; };
  async function checkout(user,input,key,authorize=()=>user) {
    requireAdmin(user);
    if (config.mode!=='sandbox' || !stripe) fail(503,'CHECKOUT_DISABLED');
    if (typeof key!=='string' || !/^[A-Za-z0-9_-]{16,128}$/.test(key)) fail(400,'IDEMPOTENCY_KEY_REQUIRED');
    const items=canonicalItems(input), hash=digest(JSON.stringify(items));
    const account=await stripe.accounts.retrieve(null);
    if (account.id!==config.expectedAccount) fail(503,'ACCOUNT_MISMATCH');
    const stillAuthorized=()=>{
      const current=authorize();
      if (current?.id!==user.id) fail(403,'ADMIN_REQUIRED');
      requireAdmin(current);
    };
    stillAuthorized();
    let order=prior(user,key);
    if (order) sameRequest(order,hash);
    if (!order) {
      const settings=await stripe.tax.settings.retrieve();
      const registrations=await stripe.tax.registrations.list({status:'active',limit:1});
      if (settings.status!=='active' || !registrations.data.some(reg=>reg.status==='active')) fail(503,'TAX_NOT_READY');
      const shipping=await stripe.shippingRates.retrieve(config.shippingRate);
      if (!shipping.active || shipping.type!=='fixed_amount' || shipping.fixed_amount?.currency!=='usd' || !integer(shipping.fixed_amount.amount) || shipping.tax_behavior!=='exclusive') fail(503,'SHIPPING_NOT_READY');
      const lines=[];
      for(const item of items) {
        const product=db.prepare('SELECT name,variants_json FROM storefront_products WHERE id=? AND published=1').get(item.productId);
        const stock=db.prepare('SELECT stripe_price_id FROM commerce_stock WHERE product_id=? AND variant_id=? AND active=1').get(item.productId,item.variantId);
        const variant=product && JSON.parse(product.variants_json).find(v=>v.id===item.variantId);
        if (!variant || !stock) fail(409,'PRODUCT_UNAVAILABLE');
        const price=await stripe.prices.retrieve(stock.stripe_price_id,{expand:['product']});
        if (!price.active || price.type!=='one_time' || price.billing_scheme!=='per_unit' || price.transform_quantity || price.currency!=='usd' || !integer(price.unit_amount) || price.unit_amount<1 || price.unit_amount!==variant.price_cents || price.tax_behavior!=='exclusive' || !price.product?.active || !price.product.tax_code || price.product.tax_code==='txcd_00000000') fail(503,'PRICE_NOT_READY');
        lines.push({...item,name:product.name,variant:variant.label,priceId:stock.stripe_price_id,unitAmount:price.unit_amount});
      }
      const subtotal=lines.reduce((sum,line)=>sum+line.unitAmount*line.quantity,0);
      if (!Number.isSafeInteger(subtotal) || subtotal>99999999) fail(400,'CART_TOO_LARGE');
      order=transaction(db,()=>{
        stillAuthorized();
        const existing=prior(user,key);
        if (existing) return sameRequest(existing,hash);
        // Recheck the published mapping and price after every external await.
        for(const line of lines) {
          const current=db.prepare('SELECT variants_json FROM storefront_products WHERE id=? AND published=1').get(line.productId);
          const variant=current && JSON.parse(current.variants_json).find(v=>v.id===line.variantId);
          if (variant?.price_cents!==line.unitAmount) fail(409,'PRODUCT_CHANGED');
          const changed=db.prepare('UPDATE commerce_stock SET available=available-? WHERE product_id=? AND variant_id=? AND stripe_price_id=? AND active=1 AND available>=?').run(line.quantity,line.productId,line.variantId,line.priceId,line.quantity);
          if (changed.changes!==1) fail(409,'OUT_OF_STOCK');
        }
        const id=randomUUID(), time=now();
        const suffix=[...randomBytes(8)].map(byte=>String.fromCharCode(97+byte%26)).join('');
        const params={
          mode:'payment',currency:'usd',adaptive_pricing:{enabled:false},
          client_reference_id:id,metadata:{order_id:id},customer_email:user.email,
          line_items:lines.map(line=>({price:line.priceId,quantity:line.quantity})),
          automatic_tax:{enabled:true},shipping_address_collection:{allowed_countries:['US']},
          shipping_options:[{shipping_rate:shipping.id}],
          success_url:config.origin+'/checkout/return?order='+id,
          cancel_url:config.origin+'/checkout/return?order='+id+'&cancelled=1',
          expires_at:Math.floor(time/1000)+3600,integration_identifier:'eldritch-fable-'+suffix
        };
        db.prepare('INSERT INTO commerce_orders(id,user_id,request_key,request_hash,stripe_account,lines_json,params_json,expected_subtotal,expected_shipping,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)').run(id,user.id,key,hash,config.expectedAccount,JSON.stringify(lines),JSON.stringify(params),subtotal,shipping.fixed_amount.amount,time,time);
        return get(id);
      });
    }
    stillAuthorized();
    if (order.stripe_account!==config.expectedAccount) fail(503,'ACCOUNT_MISMATCH');
    const params=JSON.parse(order.params_json);
    const checkOpen = current => {
      if (current.status!=='pending') fail(409,'ORDER_ALREADY_FINAL',current.id);
      const time=now();
      if (params.expires_at*1000<=time || time-current.created_at>=23*3600000) {
        fail(409,'ORDER_REQUIRES_RECONCILIATION',current.id);
      }
    };
    checkOpen(order);
    if (order.stripe_session_url) return {orderId:order.id,url:order.stripe_session_url};
    let session;
    try { session=await stripe.checkout.sessions.create(params,{idempotencyKey:'eldritch-order-'+order.id}); }
    catch { fail(503,'CHECKOUT_RETRY'); }
    if (session.livemode!==false || !session.id?.startsWith('cs_test_') || !checkoutUrl(session.url)) fail(503,'CHECKOUT_RETRY');
    const currentOrder=transaction(db,()=>{
      const current=get(order.id);
      if (current.stripe_session_id && current.stripe_session_id!==session.id) fail(409,'SESSION_MISMATCH');
      db.prepare('UPDATE commerce_orders SET stripe_session_id=?,stripe_session_url=?,updated_at=? WHERE id=?').run(session.id,session.url,now(),order.id);
      return current;
    });
    // The Session reference is saved for reconciliation even if redirect is now blocked.
    stillAuthorized();
    checkOpen(currentOrder);
    return {orderId:order.id,url:session.url};
  }
  function review(order,reason) {
    db.prepare("UPDATE commerce_orders SET status='review',review_reason=?,updated_at=? WHERE id=?").run(reason,now(),order.id);
    db.prepare("UPDATE commerce_fulfillment SET status='review' WHERE order_id=?").run(order.id);
  }
  function settle(order,session,type) {
    if (order.status==='review') return;
    if (order.status==='paid') return;
    if (session.livemode!==false || session.mode!=='payment' || session.currency!=='usd') {
      review(order,'SESSION_TOTAL_MISMATCH'); return;
    }
    if (session.payment_status==='paid' && session.status==='complete') {
      if (session.amount_subtotal!==order.expected_subtotal || session.total_details?.amount_shipping!==order.expected_shipping || session.total_details?.amount_discount!==0 || !integer(session.total_details?.amount_tax) || session.amount_total!==order.expected_subtotal+order.expected_shipping+session.total_details.amount_tax) {
        review(order,'SESSION_TOTAL_MISMATCH'); return;
      }
      if (order.status!=='pending') { review(order,'PAYMENT_AFTER_STOCK_RELEASE'); return; }
      const shipping=session.collected_information?.shipping_details || session.shipping_details;
      if (!shipping?.address || shipping.address.country!=='US' || !session.customer_details?.email) { review(order,'SHIPPING_DETAILS_MISSING'); return; }
      const intent=typeof session.payment_intent==='string'?session.payment_intent:session.payment_intent?.id;
      db.prepare("UPDATE commerce_orders SET status='paid',amount_total=?,amount_tax=?,shipping_json=?,customer_email=?,payment_intent=?,updated_at=? WHERE id=?").run(session.amount_total,session.total_details.amount_tax,JSON.stringify(shipping),session.customer_details.email,intent||null,now(),order.id);
      const risk=intent && db.prepare('SELECT reason FROM commerce_payment_reviews WHERE payment_intent=?').get(intent);
      db.prepare('INSERT OR IGNORE INTO commerce_fulfillment(order_id,status,created_at) VALUES(?,?,?)').run(order.id,risk?'review':'pending',now());
      if (risk) db.prepare('UPDATE commerce_orders SET review_reason=? WHERE id=?').run(risk.reason,order.id);
    } else if (order.status==='pending' && session.payment_status==='unpaid' && (session.status==='expired' || (type==='checkout.session.async_payment_failed' && session.status==='complete'))) {
      for(const line of JSON.parse(order.lines_json)) db.prepare('UPDATE commerce_stock SET available=available+? WHERE product_id=? AND variant_id=?').run(line.quantity,line.productId,line.variantId);
      db.prepare('UPDATE commerce_orders SET status=?,updated_at=? WHERE id=?').run(session.status==='expired'?'expired':'payment_failed',now(),order.id);
    }
  }
  async function handleEvent(event) {
    if (!event?.id || event.livemode!==false || (event.account && event.account!==config.expectedAccount)) fail(400,'WEBHOOK_ACCOUNT_MISMATCH');
    if (!sessionEvents.has(event.type) && !riskEvents.has(event.type)) return;
    if (db.prepare('SELECT 1 FROM commerce_webhook_events WHERE id=?').get(event.id)) return;
    const account=await stripe.accounts.retrieve(null);
    if (account.id!==config.expectedAccount) fail(400,'WEBHOOK_ACCOUNT_MISMATCH');
    if (riskEvents.has(event.type)) {
      const intent=event.data?.object?.payment_intent;
      transaction(db,()=>{
        const inserted=db.prepare('INSERT OR IGNORE INTO commerce_webhook_events(id,type,received_at) VALUES(?,?,?)').run(event.id,event.type,now());
        if (!inserted.changes) return;
        if (typeof intent==='string') db.prepare('INSERT OR IGNORE INTO commerce_payment_reviews(payment_intent,reason,created_at) VALUES(?,?,?)').run(intent,event.type,now());
        const order=typeof intent==='string' && db.prepare('SELECT * FROM commerce_orders WHERE payment_intent=?').get(intent);
        if (order) {
          db.prepare('UPDATE commerce_orders SET review_reason=?,updated_at=? WHERE id=?').run(event.type,now(),order.id);
          db.prepare("UPDATE commerce_fulfillment SET status='review' WHERE order_id=?").run(order.id);
        }
      });
      return;
    }
    const id=event.data?.object?.id;
    if (typeof id!=='string' || !id.startsWith('cs_test_')) fail(400,'INVALID_SESSION');
    // Retrieve current state instead of trusting an old failure/expiry snapshot.
    const session=await stripe.checkout.sessions.retrieve(id);
    if (!session || session.id!==id || session.livemode!==false) fail(400,'INVALID_SESSION');
    transaction(db,()=>{
      const inserted=db.prepare('INSERT OR IGNORE INTO commerce_webhook_events(id,type,received_at) VALUES(?,?,?)').run(event.id,event.type,now());
      if (!inserted.changes) return;
      const order=get(session.metadata?.order_id);
      if (!order) return; // Another integration in the same sandbox.
      if (order.stripe_account!==config.expectedAccount) fail(400,'WEBHOOK_ACCOUNT_MISMATCH');
      if (session.client_reference_id!==order.id || (order.stripe_session_id && order.stripe_session_id!==id)) { review(order,'SESSION_ID_MISMATCH'); return; }
      db.prepare('UPDATE commerce_orders SET stripe_session_id=? WHERE id=?').run(id,order.id);
      settle(order,session,event.type);
    });
  }
  function orderFor(user,id) {
    if (!user) return null;
    return db.prepare('SELECT id,status,amount_total,amount_tax,review_reason FROM commerce_orders WHERE id=? AND user_id=?').get(id,user.id) || null;
  }
  return {checkout,handleEvent,orderFor,config,stripe};
}
