import { randomUUID } from 'node:crypto';
import { fail } from './provider.mjs';

export function sales(db, otto, stripe, config) {
  const byId = id => db.prepare('SELECT * FROM orders WHERE id=?').get(id);
  const setState = (id, state) => db.prepare('UPDATE orders SET state=? WHERE id=? AND hold=0').run(state,id);
  const hold = id => db.prepare("UPDATE orders SET state='review',hold=1 WHERE id=?").run(id);

  async function checkout(user, quoteId, shippingId) {
    if (!stripe || !config.stripeHook || !config.account || !config.method) fail(503,'Retail checkout is awaiting merchant setup.');
    const q = db.prepare('SELECT * FROM quotes WHERE id=? AND owner=?').get(quoteId, user.id);
    if (!q) fail(404,'Quote not found.');
    const option = JSON.parse(q.options).find(o => o.id === shippingId);
    if (!option) fail(400,'Choose a shipping option.');
    let order=db.prepare('SELECT * FROM orders WHERE quote=?').get(q.id);
    if (order && order.option !== option.id) fail(409,'This quote already has a shipping selection. Request a new quote to change it.');
    if (order?.checkout_url && order.state==='pending' && !order.hold) {
      if(Date.now()<order.created+3600_000) return {url:order.checkout_url};
      fail(409,'Your checkout expired. Get a new quote.');
    }
    if (order && (order.state!=='pending' || order.hold)) fail(409,'This order already exists. Review it in My orders.');
    if (Date.now() >= q.expires) fail(409,'Your quote expired. Get a new quote.');
    const account=await stripe.accounts.retrieve();
    if (account.id!==config.account || !account.charges_enabled) fail(503,'The merchant payment account is unavailable.');
    const id=randomUUID();
    db.prepare(`INSERT OR IGNORE INTO orders(id,owner,quote,option,name,retail,shipping,supplier,created)
      VALUES(?,?,?,?,?,?,?,?,?)`).run(id,user.id,q.id,option.id,q.name,q.retail,option.shipping,option.cost,Date.now());
    order=db.prepare('SELECT * FROM orders WHERE quote=?').get(q.id);
    if (order.option!==option.id) fail(409,'Shipping selection changed.');
    const supplier=await otto('/orders',{quote_id:q.id,shipping_option_id:option.id,external_id:order.id,apply_credit:false},order.id+'-order');
    if (supplier.external_id!==order.id || supplier.quote_id!==q.id || supplier.currency!=='usd' ||
        supplier.shipping_option?.id!==option.id || supplier.payment?.amount!==order.supplier ||
        supplier.status!=='awaiting_payment' || supplier.payment?.status!=='unpaid') {
      hold(order.id); fail(409,'The supplier order requires review. You have not been charged.');
    }
    db.prepare('UPDATE orders SET otto_id=? WHERE id=?').run(supplier.id,order.id);
    const a=supplier.shipping_address;
    const address={line1:a.line1,...(a.line2?{line2:a.line2}:{}),city:a.city,state:a.state,postal_code:a.postal_code,country:'US'};
    const buyer=await stripe.customers.create({email:user.email,name:a.name,address,shipping:{name:a.name,address}}, {idempotencyKey:order.id+'-buyer'});
    const custom=db.prepare('SELECT owner FROM models WHERE id=?').get(q.model)?.owner;
    const product=custom && db.prepare("SELECT value FROM settings WHERE name='stripe_product'").get()?.value;
    const stripeItem=product?{product}:{product_data:{name:q.name,tax_code:'txcd_99999999'}};
    const session=await stripe.checkout.sessions.create({
      mode:'payment',customer:buyer.id,payment_method_types:['card'],currency:'usd',
      automatic_tax:{enabled:true},adaptive_pricing:{enabled:false},
      client_reference_id:order.id,metadata:{print_order:order.id},payment_intent_data:{metadata:{print_order:order.id}},
      line_items:[{quantity:1,price_data:{currency:'usd',unit_amount:order.retail,tax_behavior:'exclusive',
        ...stripeItem}}],
      shipping_options:[{shipping_rate_data:{type:'fixed_amount',fixed_amount:{amount:order.shipping,currency:'usd'},
        display_name:option.name,tax_behavior:'exclusive',tax_code:'txcd_92010001'}}],
      expires_at:Math.floor(order.created/1000)+3600,
      success_url:config.origin+'/print-studio/?order='+order.id,
      cancel_url:config.origin+'/print-studio/?order='+order.id
    },{idempotencyKey:order.id+'-checkout'});
    if (!session.livemode || !session.url || new URL(session.url).origin!=='https://checkout.stripe.com') fail(503,'Payment page unavailable.');
    db.prepare('UPDATE orders SET checkout=?,checkout_url=? WHERE id=?').run(session.id,session.url,order.id);
    return {url:session.url};
  }

  async function stripeEvent(event) {
    if (!event.livemode || (event.account && event.account!==config.account)) return;
    const body=event.data.object;
    if (['charge.refunded','charge.dispute.created','charge.dispute.funds_withdrawn'].includes(event.type)) {
      const intent=typeof body.payment_intent==='string'?body.payment_intent:null;
      const payment=intent?await stripe.paymentIntents.retrieve(intent):null;
      const id=payment?.metadata?.print_order; if(id && byId(id)) hold(id);
      return;
    }
    if (!event.type.startsWith('checkout.session.') || !body.metadata?.print_order) return;
    let o=byId(body.metadata.print_order);
    if (!o || !o.otto_id) return;
    // A webhook can beat persistence of the Checkout creation response.
    if (o.checkout && body.id!==o.checkout) return;
    const session=await stripe.checkout.sessions.retrieve(body.id,{expand:['payment_intent.latest_charge']});
    if (session.client_reference_id!==o.id || session.metadata?.print_order!==o.id || !session.livemode) return;
    if (session.status==='expired') {if(o.state==='pending') setState(o.id,'expired');return;}
    if (session.status!=='complete' || session.payment_status!=='paid') return;
    const payment=session.payment_intent, charge=payment?.latest_charge;
    if (session.currency!=='usd'||session.amount_subtotal!==o.retail||session.shipping_cost?.amount_subtotal!==o.shipping ||
        session.automatic_tax?.status!=='complete'||session.amount_total!==o.retail+o.shipping+session.total_details?.amount_tax ||
        payment?.amount_received!==session.amount_total || payment?.status!=='succeeded' || !charge?.paid ||
        charge.amount_refunded!==0 || charge.disputed || payment.metadata?.print_order!==o.id) {hold(o.id); return;}
    db.prepare('UPDATE orders SET intent=?,checkout=? WHERE id=?').run(payment.id,body.id,o.id);
    o=byId(o.id);
    if (o.hold || ['submitted','review'].includes(o.state)) return;
    setState(o.id,'paid');
    const factory=await otto('/orders/'+encodeURIComponent(o.otto_id));
    if (factory.external_id!==o.id || factory.currency!=='usd'||factory.payment?.amount!==o.supplier) {hold(o.id);return;}
    if (['paid','on_account'].includes(factory.payment.status) && !['expired','cancelled'].includes(factory.status)) {
      setState(o.id,'submitted'); return;
    }
    if (factory.payment.status==='processing') {setState(o.id,'supplier_processing'); return;}
    if (factory.status!=='awaiting_payment'||factory.payment.status!=='unpaid'||!config.method) {hold(o.id);return;}
    if (Date.now()-o.created >= 24*3600_000 || (factory.expires_at && Date.parse(factory.expires_at)<=Date.now())) {hold(o.id);return;}
    if (byId(o.id).hold) return;
    const result=await otto('/orders/'+encodeURIComponent(o.otto_id)+'/payments',
      {type:'saved_method',payment_method_id:config.method},o.id+'-supplier-payment');
    if (result.order_id!==o.otto_id) {hold(o.id);return;}
    if (result.payment?.status==='paid') setState(o.id,'submitted');
    else if (result.payment?.status==='processing') setState(o.id,'supplier_processing');
    else hold(o.id);
  }
  return {checkout,stripeEvent};
}
