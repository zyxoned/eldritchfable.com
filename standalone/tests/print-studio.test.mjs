import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHmac,randomUUID} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import Stripe from 'stripe';
import {studio} from '../print-studio/service.mjs';
import {tokenGeometry,tokenOBJ} from '../print-studio/token.js';

test('all design presets export closed outward-wound meshes at the selected dimensions',()=>{
  for(const shape of ['warden','seer','circle','octagon','star','hexagon']){
    const {vertices,faces}=tokenGeometry(shape,40,6),edges=new Map();
    let volume=0;
    for(const [i,j,k] of faces){
      for(const [a,b] of [[i,j],[j,k],[k,i]]) {
        const key=[Math.min(a,b),Math.max(a,b)].join('/');
        const record=edges.get(key)||[0,0];record[0]++;record[1]+=a<b?1:-1;edges.set(key,record);
      }
      const [a,b,c]=[vertices[i],vertices[j],vertices[k]];
      volume+=a[0]*(b[1]*c[2]-b[2]*c[1])+a[1]*(b[2]*c[0]-b[0]*c[2])+a[2]*(b[0]*c[1]-b[1]*c[0]);
    }
    for(const e of edges.values())assert.deepEqual(e,[2,0]);
    assert.ok(volume>0);assert.match(tokenOBJ(shape,40,6),/^f \d+ \d+ \d+$/m);
    assert.ok(Math.abs(40-Math.max(...[0,1,2].map(a=>Math.max(...vertices.map(v=>v[a]))-Math.min(...vertices.map(v=>v[a])))))<1e-7);
  }
});
test('merchant publication, private upload, both signed deliveries, checkout and idempotent supplier payment',async t=>{
  const origin='https://shop.example',db=new DatabaseSync(':memory:'), id='MD-QB1X6D8M',privateId='MD-739YQ549';
  const model={id,status:'ready',name:'Figurine',longest_dimension_mm:80,print_check:{result:{decision:'printable'}}};
  const key=Buffer.from('test-only-otto-secret'),config={origin,ottoKey:'test',ottoHook:'whsec_'+key.toString('base64'),stripeHook:'whsec_fixture',method:'pm_test',account:'acct_fixture'};
  const customer={name:'Test',city:'Test City',postal_code:'40601',state:'KY',line1:'1 Test Ave',country:'US'};
  let external,paid=0,ss,orderInput, quoteInput, orderId;
  const stripe={webhooks:new Stripe('sk_test_fake').webhooks,accounts:{retrieve:async()=>({id:config.account,charges_enabled:true})},tax:{settings:{retrieve:async()=>({status:'active'})}},
    customers:{create:async()=>({id:'cus_mock'})},checkout:{sessions:{create:async params=>{orderId=params.client_reference_id;return {livemode:true,id:'cs_fixture',url:'https://checkout.stripe.com/c/pay/fake'};},retrieve:async()=>ss}}};
  let product;
  stripe.products={retrieve:async()=>{if(!product)throw Object.assign(Error('missing'),{code:'resource_missing'});return product;},
    create:async params=>{product=params;return product;},update:async(id,params)=>Object.assign(product,params)};
  const factory=()=>({id:'OR-test',quote_id:'quote_mock',currency:'usd',external_id:external,status:paid?'confirmed':'awaiting_payment',shipping_option:{id:'ground'},expires_at:new Date(Date.now()+86400000).toISOString(),payment:{amount:2400,currency:'usd',status:paid?'paid':'unpaid'},shipping_address:customer});
  const otto=async(path,body,requestId)=>{
    if(path.startsWith('/payment-methods'))return {data:[{id:'pm_test'}]};
    if(path.startsWith('/models?'))return {data:[model,{...model,id:privateId,external_id:'ef-custom-any'}]};
    if(path==='/models/'+id)return model;
    if(path==='/models/'+privateId)return {...model,id:privateId,external_id:'ef-custom-any'};
    if(path==='/prices')return {currency:'usd',subtotal:1900};
    if(path==='/quotes'){quoteInput=body;return {id:'quote_mock',currency:'usd',status:'open',expires_at:new Date(Date.now()+600000).toISOString(),items:[{model_id:id,quantity:1,subtotal:1900}],shipping_address:customer,shipping_options:[{id:'ground',name:'Ground',totals:{shipping:500,total:2400}}]};}
    if(path==='/orders'){orderInput=body;external=body.external_id;return factory();}
    if(path==='/orders/OR-test')return factory();
    if(path==='/orders/OR-test/payments'){assert.ok(requestId.endsWith('-supplier-payment'));paid++;return {order_id:'OR-test',payment:{status:'paid'}};}
    if(path==='/files')return {id:'file_'+'a'.repeat(32),upload:{method:'POST',url:'https://upload.example',fields:{}}};
    if(path==='/models')return {id:privateId};
    assert.fail(path);
  };
  const server=studio({db,otto,stripe,config,identity:async(req)=>req.headers.actor?{id:req.headers.actor,email:'test@example.test',role:req.headers.actor==='admin'?'admin':'customer'}:null});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(async()=>{await new Promise(r=>server.close(r));db.close();});
  const root='http://127.0.0.1:'+server.address().port+'/api/otto/';
  async function req(path,actor,body,headers={}){return fetch(root+path,{method:body?'POST':'GET',headers:{origin,'content-type':'application/json',...(actor?{actor}:{}),...headers},body:body?JSON.stringify(body):undefined});}
  assert.equal((await (await req('catalog')).json()).sales,false);
  assert.equal((await req('admin/models','customer')).status,403);
  assert.equal((await req('admin/models')).status,401);
  assert.equal((await req('admin/markup','admin',{cents:500},{origin:'https://another.example'})).status,403);
  assert.equal((await req('admin/listing','admin',{id:privateId,published:true,retail:3000})).status,409);
  assert.equal((await req('admin/listing','admin',{id,published:true,retail:1000})).status,409);
  assert.equal((await req('admin/listing','admin',{id,published:true,retail:3000})).status,200);
  const requestId=randomUUID();
  assert.equal((await req('uploads','alice',{requestId,name:'Mine',filename:'mine.obj',mm:80,bytes:50,rights:true})).status,200);
  assert.equal((await req('uploads/finish','bob',{id:requestId})).status,404);
  assert.equal((await req('uploads/finish','alice',{id:requestId})).status,200);
  assert.equal((await req('model?id='+privateId,'bob')).status,404);
  assert.equal((await (await req('admin/models','admin')).json()).models.length,1);
  const quote=await (await req('quotes','alice',{model:id,address:customer,retail:1})).json();assert.equal(quote.retail,3000);assert.equal(quoteInput.items[0].quantity,1);
  assert.equal((await req('checkout','alice',{quote:quote.id,option:'ground'})).status,503);
  assert.equal((await req('admin/sales','admin',{open:true})).status,409);
  const time=String(Math.floor(Date.now()/1000));
  async function ottoDelivery(sequence){
    const e={id:'evt_'+sequence,type:'order.in_production',data:{object:'order',id:'OR-test',status:'phase'+sequence,sequence}};
    const body=JSON.stringify(e),sig=createHmac('sha256',key).update('msg.'+time+'.'+body).digest('base64');
    return req('webhook',null,e,{'svix-id':'msg','svix-timestamp':time,'svix-signature':'v1,'+sig});
  }
  assert.equal((await req('webhook',null,{test:1})).status,400);
  for(const seq of [2,2,1])assert.equal((await ottoDelivery(seq)).status,204);
  assert.equal(db.prepare('SELECT seq FROM snapshots').get().seq,2);
  async function stripeDelivery(evt){const sig=stripe.webhooks.generateTestHeaderString({payload:JSON.stringify(evt),secret:config.stripeHook});return req('stripe-webhook',null,evt,{'stripe-signature':sig});}
  assert.equal((await req('admin/stripe-product','alice',{})).status,403);
  assert.equal((await req('admin/stripe-product','admin',{})).status,200);
  assert.equal(product.id,'ef_custom_tabletop_print');
  assert.equal((await (await req('admin/config','admin')).json()).stripeDelivery,false);
  assert.equal((await stripeDelivery({id:'evt_product',type:'product.created',livemode:true,data:{object:product}})).status,204);
  assert.equal((await req('admin/sales','admin',{open:true})).status,200);
  assert.equal((await req('checkout','bob',{quote:quote.id,option:'ground'})).status,404);
  assert.equal((await req('checkout','alice',{quote:quote.id,option:'ground'})).status,200);
  assert.equal(paid,0);assert.equal(orderInput.apply_credit,false);
  ss={id:'cs_fixture',metadata:{print_order:orderId},client_reference_id:orderId,status:'complete',payment_status:'paid',livemode:true,currency:'usd',amount_subtotal:3000,shipping_cost:{amount_subtotal:500},automatic_tax:{status:'complete'},amount_total:3710,total_details:{amount_tax:210},payment_intent:{id:'pi_fixture',metadata:{print_order:orderId},status:'succeeded',amount_received:3710,latest_charge:{paid:true,amount_refunded:0,disputed:false}}};
  const e={id:'evt_pay',type:'checkout.session.completed',livemode:true,data:{object:{id:ss.id,metadata:ss.metadata}}};
  for(let i=0;i<2;i++)assert.equal((await stripeDelivery(e)).status,204);
  assert.equal((await stripeDelivery({id:'evt_payout',type:'payout.paid',livemode:true,data:{object:{id:'po_test'}}})).status,204);
  assert.equal(paid,0);
  assert.equal((await (await req('me','alice')).json()).orders[0].state,'awaiting_bank_deposit');
  const deposits=(await (await req('admin/config','admin')).json()).deposits;
  assert.equal(deposits[0].id,orderId);
  const release={id:orderId,payout:'po_test',confirmed:true};
  assert.equal((await req('admin/release','alice',release)).status,403);
  assert.equal((await req('admin/release','admin',{...release,confirmed:false})).status,400);
  assert.equal((await req('admin/release','admin',{...release,payout:'pi_fixture'})).status,400);
  assert.equal(paid,0);
  for(let i=0;i<2;i++) assert.equal((await req('admin/release','admin',release)).status,200);
  assert.equal((await stripeDelivery(e)).status,204);
  assert.equal(paid,1);
  assert.equal((await (await req('me','alice')).json()).orders[0].state,'submitted');
  const entry=db.prepare('SELECT payout,actor,payment_order FROM bank_releases').get();
  assert.deepEqual({...entry},{payout:'po_test',actor:'admin',payment_order:'OR-test'});
});

test('release after an expired reservation checks the original terms and reconciles uncertain payments',async t=>{
  const {initialize,receiveOtto}=await import('../print-studio/provider.mjs');
  const {releaseAfterDeposit}=await import('../print-studio/release.mjs');
  for(const scenario of ['match','price increase','revision change','address change','refund','lost response','uncertain expired attempt']){
    await t.test(scenario,async()=>{
      const db=new DatabaseSync(':memory:');
      try {
        initialize(db);
        db.prepare(`INSERT INTO orders(id,owner,quote,option,name,retail,shipping,supplier,created,otto_id,checkout,intent,state)
          VALUES('o','buyer','q','old-service','Figure',3000,500,2400,?,'original','cs_1','pi_1','awaiting_bank_deposit')`).run(Date.now()-7*86400000);
        const byId=id=>db.prepare('SELECT * FROM orders WHERE id=?').get(id);
        const hold=id=>db.prepare("UPDATE orders SET hold=1,state='review' WHERE id=?").run(id);
        const address={country:'US',line1:'10 Example St',name:'Test',city:'Frankfort',state:'KY',postal_code:'40601'};
        const line={model_id:'MD-QB1X6D8M',quantity:1,longest_dimension_mm:80,file_revision:1,repair:{required:false,applied:false}};
        const cost=scenario==='price increase'?2401:2350;
        const newOption={id:'new-service',name:'Ground',carrier:'UPS',totals:{total:cost}};
        let status='unpaid',sent=0,quotes=0,replacements=0,originalExpired=scenario!=='uncertain expired attempt';
        const original=()=>({id:'original',external_id:'o',currency:'usd',shipping_address:address,
          items:[line],shipping_option:{...newOption,id:'old-service'},status:originalExpired?'expired':'awaiting_payment',
          expires_at:originalExpired?null:new Date(Date.now()+3600000).toISOString(),payment:{status:'unpaid',currency:'usd',amount:2400}});
        const replacement=()=>({...original(),id:'replacement',quote_id:'fresh',shipping_option:newOption,
          expires_at:new Date(Date.now()+86400000).toISOString(),status:status==='paid'?'confirmed':'awaiting_payment',
          payment:{status,currency:'usd',amount:cost}});
        const otto=async(path,body,key)=>{
          if(path==='/orders/original')return original();
          if(path==='/orders/replacement')return replacement();
          if(path==='/quotes'){
            quotes++; assert.deepEqual(body.shipping_address,address);
            return {id:'fresh',status:'open',currency:'usd',shipping_address:scenario==='address change'?{...address,line1:'different'}:address,
              items:[{...line,file_revision:scenario==='revision change'?2:1}],shipping_options:[newOption]};
          }
          if(path==='/orders'){
            assert.deepEqual(body,{quote_id:'fresh',shipping_option_id:'new-service',external_id:'o',apply_credit:false});
            replacements++;return replacement();
          }
          if(path==='/orders/replacement/payments' || path==='/orders/original/payments'){
            sent++;assert.equal(key,'o-supplier-payment');
            if(scenario==='uncertain expired attempt'){originalExpired=true;throw Error('timeout');}
            status='paid';if(scenario==='lost response')throw Error('timeout');
            return {order_id:'replacement',payment:{status}};
          }
          assert.fail(path);
        };
        const release=releaseAfterDeposit({db,otto,config:{method:'pm_test',account:'acct_test'},byId,hold,
          stripe:{accounts:{retrieve:async()=>({id:'acct_test',charges_enabled:true})}},
          verifyRetail:async()=>scenario==='refund'?null:{id:'pi_1'}});
        const approve=()=>release({id:'admin'},{id:'o',payout:'po_bank',confirmed:true});
        if(originalExpired)receiveOtto(db,{id:'expired',type:'order.expired',data:{object:'order',sequence:2,id:'original',status:'expired',payment:{status:'unpaid'}}});
        assert.equal(byId('o').hold,0);assert.equal(sent,0);
        if(scenario==='match' || scenario==='lost response'){
          if(scenario==='lost response')await assert.rejects(approve(),/timeout/);
          await approve();await approve();
          assert.equal(quotes,1);assert.equal(replacements,1);assert.equal(sent,1);assert.equal(byId('o').state,'submitted');
        }else if(scenario==='uncertain expired attempt'){
          await assert.rejects(approve(),/timeout/);await assert.rejects(approve(),/reconciliation/);
          assert.equal(quotes,0);assert.equal(replacements,0);assert.equal(sent,1);assert.equal(byId('o').hold,1);
        }else{
          await assert.rejects(approve(),{status:409});assert.equal(sent,0);assert.equal(byId('o').hold,1);
        }
      }finally{db.close();}
    });
  }
});
