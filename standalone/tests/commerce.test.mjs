import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Readable } from 'node:stream';
import Stripe from 'stripe';
import { fixture } from './helpers.mjs';
import { digest } from '../server/database.mjs';
import { createCommerceService } from '../server/commerce.mjs';
import { commerceRoute } from '../server/commerce-routes.mjs';
import { stripeConfiguration } from '../server/stripe-client.mjs';

const origin = 'https://store.example.test';
const input = { items: [{ productId: 'bag', variantId: 'natural', quantity: 1 }] };
function shop(t, stock = 2) {
  const f = fixture(t);
  const { db } = f;
  const user = { id: randomUUID(), email: 'operator@example.test', role: 'admin' };
  db.prepare("INSERT INTO account_users(id,email,password_hash,role,email_verified_at) VALUES(?,?,?,'admin',CURRENT_TIMESTAMP)").run(user.id,user.email,'synthetic');
  const token = 'b'.repeat(64);
  db.prepare("INSERT INTO account_sessions(token_hash,user_id,expires_at) VALUES(?,?,?)").run(digest(token),user.id,'2099-01-01T00:00:00Z');
  db.exec("INSERT INTO storefront_collections(slug,name) VALUES('bags','Bags')");
  db.prepare("INSERT INTO storefront_products(id,slug,name,category,description,variants_json,published) VALUES('bag','bag','Dice bag','bags','Synthetic test product',?,1)").run(JSON.stringify([{id:'natural',label:'Natural',price_cents:2000}]));
  db.prepare('INSERT INTO commerce_stock(product_id,variant_id,stripe_price_id,available) VALUES(?,?,?,?)').run('bag','natural','price_fixture',stock);
  const requests = [], sessions = new Map();
  let failCreate = false, beforeCreate;
  const stripe = {
    accounts: { retrieve: async () => ({id:'acct_fixture'}) },
    tax: { settings: { retrieve: async () => ({status:'active'}) }, registrations: { list: async () => ({data:[{status:'active'}]}) } },
    prices: { retrieve: async () => ({id:'price_fixture',active:true,type:'one_time',billing_scheme:'per_unit',transform_quantity:null,currency:'usd',unit_amount:2000,tax_behavior:'exclusive',product:{id:'prod_fixture',active:true,tax_code:'txcd_99999999'}}) },
    shippingRates: { retrieve: async () => ({id:'shr_fixture',active:true,type:'fixed_amount',fixed_amount:{amount:500,currency:'usd'},tax_behavior:'exclusive'}) },
    checkout: { sessions: {
      create: async (params, options) => {
        requests.push({params,options});
        if (beforeCreate) await beforeCreate();
        if (failCreate) throw Error('synthetic network timeout');
        const id = 'cs_test_' + params.client_reference_id;
        const session = {id,url:'https://checkout.stripe.com/c/pay/' + id,livemode:false,mode:'payment',status:'open',payment_status:'unpaid',client_reference_id:params.client_reference_id,metadata:params.metadata,currency:'usd',amount_subtotal:2000,amount_total:2650,total_details:{amount_tax:150,amount_shipping:500,amount_discount:0},payment_intent:'pi_fixture',customer_details:{email:user.email},collected_information:{shipping_details:{name:'Test Buyer',address:{country:'US',state:'KY',postal_code:'40202',line1:'Synthetic test address'}}}};
        sessions.set(id,session);
        return session;
      },
      retrieve: async id => sessions.get(id)
    } },
    webhooks: Stripe.webhooks
  };
  const config = {mode:'sandbox',origin,expectedAccount:'acct_fixture',shippingRate:'shr_fixture',webhookSecret:'whsec_synthetic_fixture'};
  const service = createCommerceService(db,{stripe,config});
  const stockLeft = () => db.prepare('SELECT available FROM commerce_stock').get().available;
  const order = id => db.prepare('SELECT * FROM commerce_orders WHERE id=?').get(id);
  const event = (session,type='checkout.session.completed',id='evt_'+randomUUID()) => ({id,type,livemode:false,data:{object:session}});
  async function pay(result) {
    const session = sessions.get(order(result.orderId).stripe_session_id);
    Object.assign(session,{status:'complete',payment_status:'paid'});
    await service.handleEvent(event(session));
    return session;
  }
  return {...f,user,token,stripe,config,service,requests,sessions,stockLeft,order,event,pay,setFailure:value=>{failCreate=value;},setBeforeCreate:value=>{beforeCreate=value;}};
}

test('only server prices and reviewed stock can create a taxed Checkout Session', async t => {
  const f=shop(t), key=randomUUID();
  await assert.rejects(f.service.checkout(f.user,{...input,amount:1},key),{status:400});
  const result=await f.service.checkout(f.user,input,key);
  assert.equal(f.stockLeft(),1);
  const {params,options}=f.requests[0];
  assert.deepEqual(params.line_items,[{price:'price_fixture',quantity:1}]);
  assert.deepEqual(params.automatic_tax,{enabled:true});
  assert.deepEqual(params.shipping_options,[{shipping_rate:'shr_fixture'}]);
  assert.deepEqual(params.shipping_address_collection,{allowed_countries:['US']});
  assert.equal(params.currency,'usd');
  assert.deepEqual(params.adaptive_pricing,{enabled:false});
  assert.equal(Object.hasOwn(params,'payment_method_types'),false);
  assert.match(params.integration_identifier,/^eldritch-fable-[a-z]{8}$/);
  assert.equal(options.idempotencyKey,'eldritch-order-'+result.orderId);
  assert.match(result.url,/^https:\/\/checkout\.stripe\.com\//);
  assert.equal((await f.service.checkout(f.user,input,key)).orderId,result.orderId);
  assert.equal(f.stockLeft(),1);
  await assert.rejects(f.service.checkout(f.user,{items:[{...input.items[0],quantity:2}]},key),{status:409});
});

test('unknown variants, unpublished catalog and fractional quantities cannot create sellable inventory', async t => {
  const f=shop(t);
  for(const item of [{...input.items[0],variantId:'forged'},{...input.items[0],quantity:0.5},{...input.items[0],quantity:-1}]) {
    await assert.rejects(f.service.checkout(f.user,{items:[item]},randomUUID()));
  }
  f.db.exec('UPDATE storefront_products SET published=0');
  await assert.rejects(f.service.checkout(f.user,input,randomUUID()));
  assert.equal(f.stockLeft(),2);
  assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM commerce_orders').get().n,0);
});

test('pending Tax settings, absent registrations, wrong account and mismatched Stripe prices fail before reservation', async t => {
  const f=shop(t), originalSettings=f.stripe.tax.settings.retrieve;
  f.stripe.tax.settings.retrieve=async()=>({status:'pending'});
  await assert.rejects(f.service.checkout(f.user,input,randomUUID()),{code:'TAX_NOT_READY'});
  f.stripe.tax.settings.retrieve=originalSettings;
  f.stripe.tax.registrations.list=async()=>({data:[]});
  await assert.rejects(f.service.checkout(f.user,input,randomUUID()),{code:'TAX_NOT_READY'});
  f.stripe.tax.registrations.list=async()=>({data:[{status:'active'}]});
  f.stripe.accounts.retrieve=async()=>({id:'acct_other'});
  await assert.rejects(f.service.checkout(f.user,input,randomUUID()),{code:'ACCOUNT_MISMATCH'});
  f.stripe.accounts.retrieve=async()=>({id:'acct_fixture'});
  const originalPrice=f.stripe.prices.retrieve;
  f.stripe.prices.retrieve=async()=>({...await originalPrice(),unit_amount:1});
  await assert.rejects(f.service.checkout(f.user,input,randomUUID()),{code:'PRICE_NOT_READY'});
  assert.equal(f.stockLeft(),2);
});

test('concurrent checkout of the last item succeeds once', async t => {
  const f=shop(t,1);
  const results=await Promise.allSettled([f.service.checkout(f.user,input,randomUUID()),f.service.checkout(f.user,input,randomUUID())]);
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
  assert.equal(results.find(r=>r.status==='rejected').reason.code,'OUT_OF_STOCK');
  assert.equal(f.stockLeft(),0);
});

test('package-transformed prices are rejected before stock reservation or customer charging', async t => {
  const f=shop(t), retrieve=f.stripe.prices.retrieve;
  f.stripe.prices.retrieve=async()=>({...await retrieve(),transform_quantity:{divide_by:5,round:'up'}});
  await assert.rejects(f.service.checkout(f.user,{items:[{...input.items[0],quantity:2}]},randomUUID()),{code:'PRICE_NOT_READY'});
  assert.equal(f.stockLeft(),2);
  assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM commerce_orders').get().n,0);
});

test('an uncertain Stripe timeout keeps one reservation and reuses exactly the same Stripe request on retry', async t => {
  const f=shop(t), key=randomUUID();
  f.setFailure(true);
  await assert.rejects(f.service.checkout(f.user,input,key),{code:'CHECKOUT_RETRY'});
  assert.equal(f.stockLeft(),1);
  f.setFailure(false);
  const result=await f.service.checkout(f.user,input,key);
  assert.deepEqual(f.requests[1],f.requests[0]);
  assert.equal(f.stockLeft(),1);
  assert.equal(f.order(result.orderId).status,'pending');
});

test('unpaid completion does not fulfill; delayed success and webhook replay queue exactly one fulfillment', async t => {
  const f=shop(t), result=await f.service.checkout(f.user,input,randomUUID());
  const session=f.sessions.get(f.order(result.orderId).stripe_session_id);
  await f.service.handleEvent(f.event(session));
  assert.equal(f.order(result.orderId).status,'pending');
  assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM commerce_fulfillment').get().n,0);
  Object.assign(session,{status:'complete',payment_status:'paid'});
  const event=f.event(session,'checkout.session.async_payment_succeeded');
  await f.service.handleEvent(event);
  await f.service.handleEvent(event);
  await f.service.handleEvent(f.event(session));
  assert.equal(f.order(result.orderId).status,'paid');
  assert.equal(f.order(result.orderId).amount_total,2650);
  assert.equal(f.order(result.orderId).amount_tax,150);
  assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM commerce_fulfillment').get().n,1);
  assert.equal(f.stockLeft(),1);
});

test('expired sessions release stock once; reordered expiry cannot undo a paid order', async t => {
  const f=shop(t), result=await f.service.checkout(f.user,input,randomUUID());
  const session=f.sessions.get(f.order(result.orderId).stripe_session_id);
  session.status='expired';
  await f.service.handleEvent(f.event(session,'checkout.session.expired'));
  await f.service.handleEvent(f.event(session,'checkout.session.expired'));
  assert.equal(f.stockLeft(),2);
  assert.equal(f.order(result.orderId).status,'expired');
  const next=await f.service.checkout(f.user,input,randomUUID());
  const paid=await f.pay(next);
  await f.service.handleEvent(f.event({...paid,status:'expired',payment_status:'unpaid'},'checkout.session.expired'));
  assert.equal(f.order(next.orderId).status,'paid');
  assert.equal(f.stockLeft(),1);
});

test('delayed failure releases once and a subsequent late payment is held for review', async t => {
  const f=shop(t), result=await f.service.checkout(f.user,input,randomUUID());
  const session=f.sessions.get(f.order(result.orderId).stripe_session_id);
  session.status='complete';
  await f.service.handleEvent(f.event(session,'checkout.session.async_payment_failed'));
  await f.service.handleEvent(f.event(session,'checkout.session.async_payment_failed'));
  assert.equal(f.order(result.orderId).status,'payment_failed');
  assert.equal(f.stockLeft(),2);
  await f.pay(result);
  assert.equal(f.order(result.orderId).status,'review');
  assert.equal(f.order(result.orderId).review_reason,'PAYMENT_AFTER_STOCK_RELEASE');
  assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM commerce_fulfillment').get().n,0);
  assert.equal(f.stockLeft(),2);
});

test('disabling new checkout continues to accept signed events for existing payments', async t => {
  const f=shop(t), result=await f.service.checkout(f.user,input,randomUUID());
  f.config.mode='disabled';
  await assert.rejects(f.service.checkout(f.user,input,randomUUID()),{code:'CHECKOUT_DISABLED'});
  await f.pay(result);
  assert.equal(f.order(result.orderId).status,'paid');
  assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM commerce_fulfillment').get().n,1);
  assert.equal(f.stockLeft(),1);
});

test('wrong amount, mode or account does not grant fulfillment', async t => {
  const f=shop(t), result=await f.service.checkout(f.user,input,randomUUID());
  const session=f.sessions.get(f.order(result.orderId).stripe_session_id);
  Object.assign(session,{status:'complete',payment_status:'paid',amount_subtotal:1});
  await f.service.handleEvent(f.event(session));
  assert.equal(f.order(result.orderId).status,'review');
  assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM commerce_fulfillment').get().n,0);
  await assert.rejects(f.service.handleEvent({...f.event(session),livemode:true}));
  await assert.rejects(f.service.handleEvent({...f.event(session),account:'acct_other'}));
});

test('refunds and disputes put queued fulfillment on review without restocking merchandise', async t => {
  const f=shop(t), result=await f.service.checkout(f.user,input,randomUUID());
  await f.pay(result);
  await f.service.handleEvent({id:'evt_refund',type:'charge.refunded',livemode:false,data:{object:{payment_intent:'pi_fixture'}}});
  assert.equal(f.db.prepare('SELECT status FROM commerce_fulfillment').get().status,'review');
  assert.equal(f.stockLeft(),1);
});

test('expiry before address entry releases stock even when tax and shipping totals are not calculated', async t => {
  const f=shop(t), result=await f.service.checkout(f.user,input,randomUUID());
  const session=f.sessions.get(f.order(result.orderId).stripe_session_id);
  Object.assign(session,{status:'expired',amount_total:null,total_details:{amount_tax:0,amount_shipping:0,amount_discount:0}});
  await f.service.handleEvent(f.event(session,'checkout.session.expired'));
  assert.equal(f.order(result.orderId).status,'expired');
  assert.equal(f.stockLeft(),2);
});

test('a dispute delivered before the paid checkout event still prevents automatic fulfillment', async t => {
  const f=shop(t), result=await f.service.checkout(f.user,input,randomUUID());
  await f.service.handleEvent({id:'evt_early_dispute',type:'charge.dispute.created',livemode:false,data:{object:{payment_intent:'pi_fixture'}}});
  await f.pay(result);
  assert.equal(f.db.prepare('SELECT status FROM commerce_fulfillment').get().status,'review');
});

test('unrelated Stripe sessions are acknowledged without acquiring orders or stock', async t => {
  const f=shop(t);
  const session={id:'cs_test_unrelated',livemode:false,metadata:{}};
  f.sessions.set(session.id,session);
  await f.service.handleEvent(f.event(session));
  assert.equal(f.stockLeft(),2);
});

test('administrator revocation during a Stripe request stops stock allocation', async t => {
  const f=shop(t), retrieve=f.stripe.prices.retrieve;
  f.stripe.prices.retrieve=async(...args)=>{
    f.db.prepare("UPDATE account_users SET role='customer' WHERE id=?").run(f.user.id);
    return retrieve(...args);
  };
  await assert.rejects(f.service.checkout(f.user,input,randomUUID()),{status:403});
  assert.equal(f.stockLeft(),2);
});

test('a saved checkout cannot be reused with credentials for a different sandbox', async t => {
  const f=shop(t), key=randomUUID();
  await f.service.checkout(f.user,input,key);
  f.stripe.accounts.retrieve=async()=>({id:'acct_other'});
  await assert.rejects(f.service.checkout(f.user,input,key),{code:'ACCOUNT_MISMATCH'});
});

test('sandbox checkout requires an administrator and returned order data belongs to its current owner', async t => {
  const f=shop(t);
  await assert.rejects(f.service.checkout({...f.user,role:'customer'},input,randomUUID()),{status:403});
  const result=await f.service.checkout(f.user,input,randomUUID());
  assert.equal(f.service.orderFor(f.user,result.orderId).status,'pending');
  assert.equal(f.service.orderFor({...f.user,id:randomUUID()},result.orderId),null);
});

async function http(f,path,{body,headers={},method='POST',cookie=f.token}={}) {
  const raw=typeof body==='string'?body:JSON.stringify(body??{});
  const req=Readable.from([Buffer.from(raw)]);
  req.method=method; req.socket={remoteAddress:'127.0.0.1'};
  req.headers={origin,'content-type':'application/json',...(cookie?{cookie:'ef_session='+cookie}:{}),...headers};
  const result={};
  const res={writeHead(status,head){result.status=status;result.headers=head;},end(data){result.body=JSON.parse(data);}};
  await commerceRoute(f.db,f.service,req,res,path,{origin});
  return result;
}

test('checkout status exposes only the current account capability and never server secrets', async t => {
  const f=shop(t);
  const status=await http(f,'/api/commerce/status',{method:'GET'});
  assert.equal(status.status,200);
  assert.deepEqual(status.body,{canCheckout:true,userId:f.user.id,sandbox:true});
  const anonymous=await http(f,'/api/commerce/status',{method:'GET',cookie:null});
  assert.deepEqual(anonymous.body,{canCheckout:false,userId:null,sandbox:true});
  f.config.mode='disabled';
  assert.equal((await http(f,'/api/commerce/status',{method:'GET'})).body.canCheckout,false);
});

test('HTTP checkout rejects cross-origin, unauthenticated, revoked-admin and oversized requests', async t => {
  const f=shop(t), headers={'idempotency-key':randomUUID()};
  assert.equal((await http(f,'/api/commerce/checkout',{body:input,headers:{...headers,origin:'https://evil.test'}})).status,403);
  assert.equal((await http(f,'/api/commerce/checkout',{body:input,headers,cookie:null})).status,401);
  assert.equal((await http(f,'/api/commerce/checkout',{body:'x'.repeat(20000),headers})).status,413);
  f.db.prepare("UPDATE account_users SET role='customer' WHERE id=?").run(f.user.id);
  assert.equal((await http(f,'/api/commerce/checkout',{body:input,headers})).status,403);
  assert.equal(f.stockLeft(),2);
});

test('logout during Session creation preserves the reservation but withholds its payment URL', async t => {
  const f=shop(t);
  f.setBeforeCreate(async()=>{f.db.prepare('DELETE FROM account_sessions WHERE user_id=?').run(f.user.id);});
  const result=await http(f,'/api/commerce/checkout',{body:input,headers:{'idempotency-key':randomUUID()}});
  assert.equal(result.status,403);
  assert.equal(Object.hasOwn(result.body,'url'),false);
  assert.equal(f.stockLeft(),1);
  assert.match(f.db.prepare('SELECT stripe_session_id FROM commerce_orders').get().stripe_session_id,/^cs_test_/);
});

test('webhook verifies the exact raw bytes before changing order state', async t => {
  const f=shop(t), result=await f.service.checkout(f.user,input,randomUUID());
  const session=f.sessions.get(f.order(result.orderId).stripe_session_id);
  Object.assign(session,{status:'complete',payment_status:'paid'});
  const raw=JSON.stringify(f.event(session));
  const signature=Stripe.webhooks.generateTestHeaderString({payload:raw,secret:f.config.webhookSecret});
  assert.equal((await http(f,'/api/stripe/webhook',{body:raw,headers:{'stripe-signature':'forged'}})).status,400);
  assert.equal(f.order(result.orderId).status,'pending');
  assert.equal((await http(f,'/api/stripe/webhook',{body:raw,headers:{origin:'', 'stripe-signature':signature},cookie:null})).status,200);
  assert.equal(f.order(result.orderId).status,'paid');
});

test('environment defaults to disabled and rejects live keys without leaking their value', () => {
  assert.equal(stripeConfiguration({ELDRITCH_ORIGIN:origin}).mode,'disabled');
  const live='rk_'+'live_synthetic_not_a_real_key';
  assert.throws(()=>stripeConfiguration({ELDRITCH_ORIGIN:origin,ELDRITCH_COMMERCE_MODE:'sandbox',STRIPE_RESTRICTED_KEY:live}),error=>!error.message.includes(live));
});
