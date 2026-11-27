import {fail} from './provider.mjs';

const day = 24 * 60 * 60 * 1000;
const addressFields = ['name','company','line1','line2','city','state','postal_code','country','phone','email'];

function sameAddress(first, second) {
  return first?.country === 'US' && second?.country === 'US' &&
    addressFields.every(key => (first[key] || '') === (second[key] || ''));
}

function samePrint(first, second) {
  return first && second && first.model_id === second.model_id &&
    first.quantity === 1 && second.quantity === 1 &&
    first.longest_dimension_mm === second.longest_dimension_mm &&
    Number.isInteger(first.file_revision) && first.file_revision === second.file_revision &&
    (first.file_repair ?? null) === (second.file_repair ?? null) &&
    second.repair?.required === false && second.repair?.applied === false;
}

export function releaseAfterDeposit({db, otto, stripe, config, byId, hold, verifyRetail}) {
  const receipt = id => db.prepare('SELECT * FROM bank_releases WHERE order_id=?').get(id);
  const state = (id, next) => db.prepare('UPDATE orders SET state=? WHERE id=? AND hold=0').run(next,id);
  function review(id, message) {
    hold(id);
    fail(409, message);
  }

  async function replaceExpired(order, original, record) {
    const line = original.items?.[0];
    if (original.items?.length !== 1 || !samePrint(line, line) || original.shipping_address?.country !== 'US')
      review(order.id, 'The expired reservation needs a manual review of the model and delivery address.');
    if (!record.fresh_quote) {
      const item = {model_id: line.model_id, quantity: 1, longest_dimension_mm: line.longest_dimension_mm};
      const address = Object.fromEntries(addressFields.filter(key => original.shipping_address[key])
        .map(key => [key, original.shipping_address[key]]));
      const quote = await otto('/quotes', {items:[item], shipping_address:address}, order.id+'-deposit-quote');
      const option = quote.shipping_options?.find(candidate =>
        candidate.name === original.shipping_option?.name &&
        (candidate.carrier || '') === (original.shipping_option?.carrier || '') &&
        Number.isSafeInteger(candidate.totals?.total) && candidate.totals.total >= 0 &&
        candidate.totals.total <= order.supplier);
      if (!option || !quote.id || quote.currency !== 'usd' || quote.status !== 'open' ||
          !sameAddress(original.shipping_address, quote.shipping_address) ||
          quote.items?.length !== 1 || !samePrint(line, quote.items[0]))
        review(order.id, 'The model, address, shipping service or supplier cost changed. Review this order before manufacturing.');
      db.prepare(`UPDATE bank_releases SET fresh_quote=?,fresh_option=?,fresh_cost=?
        WHERE order_id=? AND fresh_quote IS NULL`).run(quote.id, option.id, option.totals.total, order.id);
      record = receipt(order.id);
    }
    if (byId(order.id).hold) fail(409, 'This order is on hold.');
    const replacement = await otto('/orders', {quote_id:record.fresh_quote, shipping_option_id:record.fresh_option,
      external_id:order.id, apply_credit:false}, order.id+'-deposit-order');
    if (!replacement.id || replacement.id === original.id || replacement.external_id !== order.id ||
        replacement.quote_id !== record.fresh_quote || replacement.shipping_option?.id !== record.fresh_option ||
        replacement.items?.length !== 1 || !samePrint(line, replacement.items[0]) ||
        !sameAddress(original.shipping_address, replacement.shipping_address))
      review(order.id, 'The replacement manufacturing order needs review.');
    db.prepare('UPDATE orders SET otto_id=? WHERE id=? AND otto_id=? AND hold=0')
      .run(replacement.id, order.id, original.id);
    return replacement;
  }

  const active = new Set();
  return async function release(actor, {id, payout, confirmed}) {
    if (typeof id !== 'string' || typeof payout !== 'string' || !/^po_[a-zA-Z0-9]{2,120}$/.test(payout) || confirmed !== true)
      fail(400, 'Confirm the posted bank deposit and enter the matching Stripe payout ID.');
    const order = byId(id);
    if (!order) fail(404, 'Order not found.');
    const previous = receipt(id);
    if (previous && previous.payout !== payout) fail(409, 'This order already has a different payout reference.');
    if (order.hold) fail(409, 'This order is on hold.');
    if (['submitted','supplier_processing'].includes(order.state)) return {state:order.state};
    if (!['awaiting_bank_deposit','paid'].includes(order.state) || !order.checkout || !order.intent || !order.otto_id)
      fail(409, 'A verified customer payment is required first.');
    if (!stripe || !config.method) fail(503, 'Merchant payment configuration is incomplete.');
    if (active.has(id)) fail(409, 'This order release is already in progress.');
    active.add(id);
    try {
      const account = await stripe.accounts.retrieve();
      if (account.id !== config.account || !account.charges_enabled) fail(409, 'Verify the merchant Stripe account.');
      db.prepare('INSERT OR IGNORE INTO bank_releases(order_id,payout,actor,recorded,original_otto) VALUES(?,?,?,?,?)')
        .run(id, payout, actor.id, Date.now(), order.otto_id);
      const record = receipt(id);
      if (record.payout !== payout) fail(409, 'The recorded bank deposit differs.');
      let factory = await otto('/orders/'+encodeURIComponent(order.otto_id));
      if (factory.id !== order.otto_id || factory.external_id !== id || factory.currency !== 'usd')
        review(id, 'The supplier order identity needs review.');
      // Never start a new attempt beyond OTTO's idempotency window after an uncertain response.
      const stale = Date.now()-record.recorded >= day;
      if (factory.id === record.original_otto && factory.status === 'expired' &&
          ['unpaid','cancelled'].includes(factory.payment?.status)) {
        if (stale || record.payment_order) review(id, 'The release attempt needs reconciliation with OTTO before retrying.');
        factory = await replaceExpired(order, factory, record);
      }
      const cost = factory.id === record.original_otto ? order.supplier : receipt(id).fresh_cost;
      if (!Number.isSafeInteger(cost) || cost < 0 || cost > order.supplier ||
          factory.currency !== 'usd' || factory.payment?.amount !== cost || factory.payment?.currency !== 'usd')
        review(id, 'The supplier total changed. Review this order before manufacturing.');
      if (['paid','on_account'].includes(factory.payment.status) && !['expired','cancelled','on_hold'].includes(factory.status)) {
        state(id,'submitted'); return {state:byId(id).state};
      }
      if (factory.payment.status === 'processing') {
        state(id,'supplier_processing'); return {state:byId(id).state};
      }
      if (stale || factory.status !== 'awaiting_payment' || factory.payment.status !== 'unpaid' ||
          !(Date.parse(factory.expires_at) > Date.now()))
        review(id, 'The supplier payment or reservation needs review before another attempt.');
      const payment = await verifyRetail(order, order.checkout);
      if (payment?.id !== order.intent) review(id, 'The customer payment needs review before manufacturing.');
      const latest = byId(id);
      if (latest.hold || latest.otto_id !== factory.id ||
          !['awaiting_bank_deposit','paid'].includes(latest.state))
        fail(409, 'This order changed during review.');
      if (!(Date.parse(factory.expires_at) > Date.now()) || Date.now()-record.recorded >= day)
        review(id, 'The reservation expired during review. Check its status with OTTO.');
      const marked = db.prepare(`UPDATE bank_releases SET payment_order=?
        WHERE order_id=? AND (payment_order IS NULL OR payment_order=?)`).run(factory.id,id,factory.id);
      if (!marked.changes) review(id, 'An earlier supplier payment needs reconciliation.');
      const result = await otto('/orders/'+encodeURIComponent(factory.id)+'/payments',
        {type:'saved_method', payment_method_id:config.method}, id+'-supplier-payment');
      if (result.order_id !== factory.id || !['paid','processing'].includes(result.payment?.status))
        review(id, 'Check the supplier payment status before taking any further action.');
      state(id, result.payment.status === 'paid' ? 'submitted' : 'supplier_processing');
      return {state:byId(id).state};
    } finally {
      active.delete(id);
    }
  };
}
