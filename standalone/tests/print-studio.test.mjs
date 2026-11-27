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
  const factory=()=>({id:'OR-test',quote_id:'quote_mock',currency:'usd',external_id:external,status:paid?'confirmed':'awaiting_payment',shipping_option:{id:'ground'},payment:{amount:2400,status:paid?'paid':'unpaid'},shipping_address:customer});
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
  assert.equal((await stripeDelivery({id:'evt_test',type:'ping',livemode:true,data:{object:{}}})).status,204);
  assert.equal((await req('admin/sales','admin',{open:true})).status,200);
  assert.equal((await req('checkout','bob',{quote:quote.id,option:'ground'})).status,404);
  assert.equal((await req('checkout','alice',{quote:quote.id,option:'ground'})).status,200);
  assert.equal(paid,0);assert.equal(orderInput.apply_credit,false);
  ss={id:'cs_fixture',metadata:{print_order:orderId},client_reference_id:orderId,status:'complete',payment_status:'paid',livemode:true,currency:'usd',amount_subtotal:3000,shipping_cost:{amount_subtotal:500},automatic_tax:{status:'complete'},amount_total:3710,total_details:{amount_tax:210},payment_intent:{id:'pi_fixture',metadata:{print_order:orderId},status:'succeeded',amount_received:3710,latest_charge:{paid:true,amount_refunded:0,disputed:false}}};
  const e={id:'evt_pay',type:'checkout.session.completed',livemode:true,data:{object:{id:ss.id,metadata:ss.metadata}}};
  for(let i=0;i<2;i++)assert.equal((await stripeDelivery(e)).status,204);
  assert.equal(paid,1);assert.equal((await (await req('me','alice')).json()).orders[0].state,'submitted');
});
