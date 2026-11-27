import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { realpathSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { fail, eligible, initialize, ottoClient, receiveOtto, verifyOtto } from './provider.mjs';
import { finishUpload, transferUpload } from './transfer.mjs';
import { sculptPresets } from './sculpt.js';
import { sales } from './sales.mjs';

const prefix='/api/otto';
const validId = id => /^MD-[0-9A-HJKMNP-TV-Z]{8}$/.test(id);
const cents = value => Number.isSafeInteger(value) && value>=0 && value<=1_000_000;
const string = (value,max) => typeof value==='string' && value.trim() && value.length<=max && !/[\x00-\x1f]/.test(value);
const cleanModel = m => ({id:m.id,name:m.name || 'Untitled model',mm:m.longest_dimension_mm,status:m.status,printable:eligible(m),
  image:m.preview?.thumbnails?.angled || null});
const staticFiles = new Map([['/print-studio/',['index.html','text/html']],['/print-studio/app.js',['app.js','text/javascript']],
  ['/print-studio/style.css',['style.css','text/css']],['/print-studio/token.js',['token.js','text/javascript']],
  ['/print-studio/viewport.js',['viewport.js','text/javascript']]]);

staticFiles.set('/print-studio/sculpt.js',['sculpt.js','text/javascript']);
for(const name of sculptPresets){
  const file='models/'+name+'.mesh';
  staticFiles.set('/print-studio/'+file,[file,'application/octet-stream']);
}

async function bytes(req,max) {
  let size=0;const parts=[];
  for await(const part of req){size+=part.length;if(size>max) fail(413,'Request is too large.');parts.push(part);}
  return Buffer.concat(parts);
}
export function studio({db,otto,config,stripe,identity,sendStorage}) {
  initialize(db);
  const commerce=sales(db,otto,stripe,config);
  async function user(req,admin=false) {
    const found=await identity(req);
    if(!found) fail(401,'Sign in to your Eldritch Fable account.');
    if(admin && found.role!=='admin') fail(403,'Administrator access required.');
    return found;
  }
  const markups=()=>db.prepare("SELECT value FROM settings WHERE name='custom_markup'").get()?.value;
  const seen = provider => Boolean(db.prepare('SELECT 1 FROM events WHERE id LIKE ? LIMIT 1').get(provider+':%'));
  const wired = () => Boolean(config.ottoKey && config.ottoHook && config.stripeHook && stripe && config.account && config.method && seen('otto') && seen('stripe'));
  const sells = () => wired() && db.prepare("SELECT value FROM settings WHERE name='open'").get()?.value===1;
  const statement=(sql,...args)=>db.prepare(sql).get(...args);
  const limited = new Map();
  const transfers = new Set();
  function limit(owner) {
    const now=Date.now();
    if(limited.size>4096) for(const [k,v] of limited) if(v.until<now) limited.delete(k);
    let record=limited.get(owner);
    if(!record || record.until<now){record={n:0,until:now+60_000};limited.set(owner,record);}
    if(++record.n>40) fail(429,'Please wait a minute before trying again.');
  }
  return createServer(async(req,res)=>{
    const url=new URL(req.url,'http://localhost'), path=url.pathname;
    const json=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data));};
    try {
      if(req.method==='GET' && path==='/print-studio'){res.writeHead(308,{Location:'/print-studio/'});res.end();return;}
      if(req.method==='GET' && staticFiles.has(path)){
        const [name,mime]=staticFiles.get(path), file=await readFile(new URL(name,import.meta.url));
        res.writeHead(200,{'Content-Type':mime.startsWith('text/')?mime+'; charset=utf-8':mime,'X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin',
          'Cache-Control':'no-cache','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' https:; connect-src 'self' https:; frame-ancestors 'none'; base-uri 'none'; form-action 'self'"});res.end(file);return;
      }
      if(path===prefix+'/webhook' || path===prefix+'/stripe-webhook'){
        if(req.method!=='POST') fail(405,'Use POST.');
        const isOtto=path===prefix+'/webhook';
        if(isOtto?!config.ottoHook:!stripe||!config.stripeHook) fail(503,'Signing configuration pending.');
        const raw=await bytes(req,262144);
        if(isOtto){
          if(!verifyOtto(req.headers,raw,config.ottoHook)) fail(400,'Invalid signature.');
          let event;try{event=JSON.parse(raw);}catch{fail(400,'Invalid payload.');}
          receiveOtto(db,event);
        }else{
          let evt;try{evt=stripe.webhooks.constructEvent(raw,req.headers['stripe-signature'],config.stripeHook);}catch{fail(400,'Invalid signature.');}
          await commerce.stripeEvent(evt);
          if(typeof evt.id==='string' && typeof evt.type==='string' && (!evt.account || evt.account===config.account))
            db.prepare('INSERT OR IGNORE INTO events VALUES(?,?,?,?)').run('stripe:'+evt.id,evt.type,'',Date.now());
        }
        res.writeHead(204);res.end();return;
      }
      if(path===prefix+'/catalog' && req.method==='GET') return json(200,{models:db.prepare('SELECT id,name,mm,retail FROM models WHERE published=1 AND owner IS NULL ORDER BY name').all(),sales:sells(),uploads:Boolean(config.ottoKey)});
      if(!path.startsWith(prefix+'/')) fail(404,'Page not found.');
      const u=await user(req,path.startsWith(prefix+'/admin/'));limit(u.id);
      const post=req.method==='POST';
      const content = path.match(/^\/api\/otto\/uploads\/([a-f0-9-]{36})\/content$/);
      if (post && content) {
        if (req.headers.origin !== config.origin || req.headers['content-type'] !== 'application/octet-stream')
          fail(403, 'Origin or file type not accepted.');
        const row = statement('SELECT * FROM uploads WHERE id=? AND owner=?', content[1], u.id);
        if (!row) fail(404, 'Upload not found.');
        if (row.file_id) { req.resume(); return json(200, {stored:true}); }
        if (Date.now()-row.created > 3_600_000) fail(410, 'Upload expired. Submit the file again.');
        if (transfers.has(row.id) || transfers.size >= 4) fail(429, 'Another upload is in progress. Try again in a moment.');
        transfers.add(row.id);
        try {
          const file = await transferUpload(req, row, otto, sendStorage);
          db.prepare('UPDATE uploads SET file_id=? WHERE id=?').run(file, row.id);
          return json(200, {stored:true});
        } finally { transfers.delete(row.id); }
      }
      let b={};
      if(post){
        if(req.headers.origin!==config.origin || req.headers['content-type']?.split(';')[0]!=='application/json') fail(403,'Origin not accepted.');
        try{b=JSON.parse(await bytes(req,16384));}catch(e){if(e.status) throw e;fail(400,'Invalid JSON.');}
        if(!b||typeof b!=='object'||Array.isArray(b)) fail(400,'Invalid request.');
      }
      if(path===prefix+'/me' && req.method==='GET') return json(200,{admin:u.role==='admin',
        models:db.prepare('SELECT id,name,mm FROM models WHERE owner=? ORDER BY rowid DESC LIMIT 100').all(u.id),
        orders:db.prepare(`SELECT o.id,o.name,o.state,s.status AS fulfillment,s.payment AS supplier_payment
          FROM orders o LEFT JOIN snapshots s ON s.object=o.otto_id WHERE o.owner=? ORDER BY o.created DESC LIMIT 50`).all(u.id)});
      if(path===prefix+'/tracking' && req.method==='GET'){
        const o=statement('SELECT otto_id FROM orders WHERE id=? AND owner=?',url.searchParams.get('id'),u.id);
        if(!o?.otto_id) fail(404,'Order not found.');
        const factory=await otto('/orders/'+encodeURIComponent(o.otto_id));
        const shipment=factory.shipment;
        return json(200,{status:factory.status,carrier:shipment?.carrier,tracking:shipment?.tracking_number,
          url:typeof shipment?.tracking_url==='string' && /^https:\/\//.test(shipment.tracking_url)?shipment.tracking_url:null});
      }
      if(path===prefix+'/admin/release' && post) return json(200,await commerce.release(u,b));
      if(path===prefix+'/admin/config' && req.method==='GET') return json(200,{api:Boolean(config.ottoKey),ottoWebhook:Boolean(config.ottoHook),
        stripe:Boolean(stripe),stripeWebhook:Boolean(config.stripeHook),fulfillment:Boolean(config.method),markup:markups()??null,
        ottoDelivery:seen('otto'),stripeDelivery:seen('stripe'),sales:sells(),
        deposits:db.prepare(`SELECT o.id,o.name,o.intent,o.supplier,o.retail,o.shipping,r.payout
          FROM orders o LEFT JOIN bank_releases r ON r.order_id=o.id
          WHERE o.hold=0 AND o.state IN ('awaiting_bank_deposit','paid') ORDER BY o.created LIMIT 100`).all(),
        review:db.prepare("SELECT id,otto_id,state FROM orders WHERE hold=1 OR state='supplier_processing' ORDER BY created DESC LIMIT 50").all()});
      if(path===prefix+'/admin/stripe-product' && post){
        if(!stripe || !config.stripeHook) fail(503,'Enter the live Stripe key and endpoint signing secret on the server first.');
        const account=await stripe.accounts.retrieve();
        if(account.id!==config.account || !account.charges_enabled) fail(409,'Check the merchant Stripe account.');
        const id='ef_custom_tabletop_print';
        let product;
        try{product=await stripe.products.retrieve(id);}
        catch(e){if(e.code!=='resource_missing') throw e;}
        if(product && (product.deleted || product.metadata?.studio!=='eldritch_fable_print')) fail(409,'The Stripe product identifier is already in use.');
        const metadata={studio:'eldritch_fable_print',delivery_check:randomUUID()};
        if(product) await stripe.products.update(id,{metadata});
        else await stripe.products.create({id,name:'Custom tabletop print',tax_code:'txcd_99999999',metadata},{idempotencyKey:config.account+'-studio-product'});
        db.prepare("INSERT INTO settings VALUES('stripe_product',?) ON CONFLICT(name) DO UPDATE SET value=excluded.value").run(id);
        return json(200,{requested:true});
      }
      if(path===prefix+'/admin/sales' && post){
        if(typeof b.open!=='boolean') fail(400,'Choose open or paused.');
        if(b.open){
          if(!wired()) fail(409,'Enter the merchant credentials and verify a signed delivery from both providers first.');
          const [account,tax,cards]=await Promise.all([stripe.accounts.retrieve(),stripe.tax.settings.retrieve(),otto('/payment-methods?limit=100')]);
          if(account.id!==config.account || !account.charges_enabled || tax.status!=='active' || !cards.data.some(card=>card.id===config.method))
            fail(409,'Check the Stripe merchant account, tax settings and OTTO payment method.');
          if(markups()==null && !db.prepare('SELECT 1 FROM models WHERE published=1 LIMIT 1').get()) fail(409,'Publish a priced model or set the custom print markup first.');
        }
        db.prepare("INSERT INTO settings VALUES('open',?) ON CONFLICT(name) DO UPDATE SET value=excluded.value").run(Number(b.open));
        return json(200,{sales:sells()});
      }
      if(path===prefix+'/admin/models' && req.method==='GET'){
        const cursor=url.searchParams.get('cursor');if(cursor?.length>2048) fail(400,'Invalid cursor.');
        const page=await otto('/models?limit=40'+(cursor?'&cursor='+encodeURIComponent(cursor):''));
        // Customer uploads are private even when listed by the business API.
        const models=page.data.filter(m=>!String(m.external_id||'').startsWith('ef-custom-') &&
          !statement('SELECT 1 FROM models WHERE id=? AND owner IS NOT NULL',m.id)).map(m=>{
          const local=statement('SELECT retail,published FROM models WHERE id=?',m.id);
          return {...cleanModel(m),retail:local?.retail,published:Boolean(local?.published)};
        });return json(200,{models,cursor:page.next_cursor});
      }
      if(path===prefix+'/admin/listing' && post){
        if(!validId(b.id)||typeof b.published!=='boolean') fail(400,'Invalid model.');
        if(!b.published){db.prepare('UPDATE models SET published=0 WHERE id=? AND owner IS NULL').run(b.id);return json(200,{saved:true});}
        if(!cents(b.retail)||!b.retail) fail(400,'Enter the retail price in cents.');
        const m=await otto('/models/'+b.id);
        if(m.id!==b.id || !eligible(m) || String(m.external_id||'').startsWith('ef-custom-')) fail(409,'Choose your own model that passed inspection.');
        const cost=await otto('/prices',{items:[{model_id:m.id,longest_dimension_mm:m.longest_dimension_mm,quantity:1}]},randomUUID());
        if(cost.currency!=='usd'||!cents(cost.subtotal)||b.retail<cost.subtotal) fail(409,'The price must cover the current manufacturing cost.');
        const saved=db.prepare(`INSERT INTO models(id,name,mm,retail,published) VALUES(?,?,?,?,1)
          ON CONFLICT(id) DO UPDATE SET name=excluded.name,mm=excluded.mm,retail=excluded.retail,published=1 WHERE models.owner IS NULL`).run(b.id,m.name||'Figurine',m.longest_dimension_mm,b.retail);
        if(!saved.changes) fail(403,'Customer models are private.');
        return json(200,{saved:true});
      }
      if(path===prefix+'/admin/markup' && post){
        if(!cents(b.cents)) fail(400,'Enter a nonnegative handling amount.');
        db.prepare("INSERT INTO settings VALUES('custom_markup',?) ON CONFLICT(name) DO UPDATE SET value=excluded.value").run(b.cents);
        return json(200,{saved:true});
      }
      if(path===prefix+'/uploads' && post){
        if(b.transfer!=='studio') fail(409,'Refresh the Print Studio and submit your model again.');
        if(!config.ottoKey) fail(503,'OTTO uploads are awaiting setup.');
        if(!string(b.name,90)||!string(b.filename,160)||!/^[-\w .]+\.(3mf|glb|obj|zip)$/i.test(b.filename)||
          !Number.isSafeInteger(b.bytes)||b.bytes<=0||b.bytes>50_000_000||!Number.isInteger(b.mm)||b.mm<30||b.mm>200||b.rights!==true) fail(400,'Check the name, file, size and print permission.');
        const id=b.requestId;if(typeof id!=='string'||!/^[-0-9a-f]{36}$/.test(id)) fail(400,'Invalid upload request.');
        let row=statement('SELECT * FROM uploads WHERE id=?',id);
        if(!row){
          const count=statement('SELECT COUNT(*) AS n FROM uploads WHERE owner=? AND created>?',u.id,Date.now()-86400000).n;
          if(count>=10) fail(429,'Daily upload limit reached.');
          db.prepare('INSERT INTO uploads(id,owner,created,filename,bytes,name,mm) VALUES(?,?,?,?,?,?,?)').run(id,u.id,Date.now(),b.filename,b.bytes,b.name.trim(),b.mm);
          row=statement('SELECT * FROM uploads WHERE id=?',id);
        }
        if(row.owner!==u.id||row.bytes!==b.bytes||row.filename!==b.filename||row.name!==b.name.trim()||row.mm!==b.mm||Date.now()-row.created>3600000) fail(409,'Start a fresh upload.');
        return json(200,{id});
      }
      if(path===prefix+'/uploads/finish' && post) return json(200,await finishUpload(db,otto,u.id,b.id));
      if((path===prefix+'/model' && req.method==='GET')||(path===prefix+'/quotes' && post)){
        const id=post?b.model:url.searchParams.get('id');
        if(!validId(id)) fail(400,'Invalid model.');
        const local=statement('SELECT * FROM models WHERE id=? AND (owner=? OR published=1)',id,u.id);
        if(!local) fail(404,'Model not found.');
        const m=await otto('/models/'+id);
        if(!post) return json(200,cleanModel(m));
        if(!eligible(m) || m.longest_dimension_mm!==local.mm) fail(409,'Model inspection or size needs review.');
        const a=b.address??{};
        if(!['name','line1','city','state','postal_code'].every(k=>string(a[k],k==='name'?150:180))||
           !/^[A-Z]{2}$/.test(a.state)||!/^\d{5}(-\d{4})?$/.test(a.postal_code)||
           (a.line2 && !string(a.line2,180))) fail(400,'Enter a valid US delivery address.');
        const address=Object.fromEntries(['name','line1','line2','city','state','postal_code'].filter(k=>a[k]).map(k=>[k,a[k].trim()]));
        const markup=markups();if(local.owner && markup==null) fail(503,'Custom print pricing is awaiting merchant setup.');
        const q=await otto('/quotes',{items:[{model_id:id,longest_dimension_mm:local.mm,quantity:1}],shipping_address:{...address,country:'US'}},randomUUID());
        if(q.currency!=='usd'||q.status!=='open'||q.items?.length!==1||q.items[0].model_id!==id||q.items[0].quantity!==1||!cents(q.items[0].subtotal)) fail(502,'Invalid supplier quote.');
        const retail=local.owner?q.items[0].subtotal+markup:local.retail;
        const options=q.shipping_options.filter(o=>cents(o.totals?.total)&&cents(o.totals?.shipping)&&cents(retail)&&retail+o.totals.shipping>=o.totals.total)
          .map(o=>({id:o.id,name:o.name,shipping:o.totals.shipping,cost:o.totals.total}));
        if(!options.length) fail(409,'Pricing needs review before this print can be sold.');
        if(!Number.isFinite(Date.parse(q.expires_at))) fail(502,'Invalid quote expiry.');
        db.prepare('INSERT INTO quotes VALUES(?,?,?,?,?,?,?,?)').run(q.id,u.id,id,local.name,Date.parse(q.expires_at),retail,JSON.stringify(options),'{}');
        return json(200,{id:q.id,retail,expires:q.expires_at,address:q.shipping_address,options:options.map(({cost,...o})=>o),sales:sells()});
      }
      if(path===prefix+'/checkout' && post) {
        if(!sells()) fail(503,'Customer checkout is currently paused.');
        if(typeof b.quote!=='string'||typeof b.option!=='string') fail(400,'Choose a quote and shipping option.');
        return json(200,await commerce.checkout(u,b.quote,b.option));
      }
      fail(404,'Page not found.');
    } catch(error) {
      const status=Number.isInteger(error.status)&&error.status>=400&&error.status<=599?error.status:502;
      json(status,error.status && !(error.type?.startsWith('Stripe'))?{error:error.message}:{error:'Request could not be completed. Please try again.'});
    }
  });
}

if(process.argv[1] && import.meta.url===pathToFileURL(realpathSync(process.argv[1])).href) {
  process.umask(0o077);
  const e=process.env;
  const config={origin:e.ELDRITCH_ORIGIN,ottoKey:e.OTTOMFG_API_KEY,ottoHook:e.OTTOMFG_WEBHOOK_SECRET,
    stripeHook:e.EF_PRINT_STRIPE_WEBHOOK_SECRET,account:e.EF_PRINT_STRIPE_ACCOUNT,method:e.EF_PRINT_OTTO_PAYMENT_METHOD};
  const require=createRequire(import.meta.url);
  const stripe=e.EF_PRINT_STRIPE_KEY && /^rk_live_/.test(e.EF_PRINT_STRIPE_KEY)?new (require('stripe'))(e.EF_PRINT_STRIPE_KEY,{apiVersion:'2026-10-28.endive',timeout:15000}):null;
  const db=new DatabaseSync(e.EF_PRINT_DB);
  const server=studio({db,config,otto:ottoClient(config.ottoKey),stripe,identity:async req=>{
    const match=(req.headers.cookie||'').match(/(?:^|;\s*)(ef_session=[a-f0-9]{64})(?:;|$)/);
    if(!match) return null;
    const response=await fetch('http://127.0.0.1:3102/api/auth/me',{headers:{Cookie:match[1]},signal:AbortSignal.timeout(4000),redirect:'error'});
    return response.ok?(await response.json()).user:null;
  }});
  server.requestTimeout=300_000;
  server.listen(Number(e.EF_PRINT_PORT||3118),'127.0.0.1');
}
