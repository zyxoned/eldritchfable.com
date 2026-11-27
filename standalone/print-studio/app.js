import {tokenGeometry,tokenOBJ} from './token.js';

const $=id=>document.getElementById(id);
const usd=cents=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(cents/100);
const fields=form=>Object.fromEntries(new FormData(form));
const message=(id,value)=>{$(id).textContent=value;};
const add=(parent,tag,value)=>{
  const el=document.createElement(tag);if(value!==undefined)el.textContent=value;parent.append(el);return el;
};
function button(parent,label,run,feedback='notice'){
  const el=add(parent,'button',label);
  el.type='button';
  el.addEventListener('click',()=>action(el,run,feedback));return el;
}
async function action(el,run,feedback='notice'){
  if(el.disabled)return;
  el.disabled=true;
  try{message(feedback,'');await run();}catch(e){message(feedback,e.message);}finally{el.disabled=false;}
}
async function api(path,body){
  const r=await fetch('/api/otto/'+path,{method:body?'POST':'GET',headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined});
  const data=await r.json();
  if(!r.ok)throw Object.assign(Error(data.error||'Request failed.'),{status:r.status});return data;
}
let catalog,me,generated,selected,cursor;
function form(id,fn,feedback='notice'){
  const f=$(id);
  f.addEventListener('submit',event=>{event.preventDefault();action(f.querySelector('button[type=submit],button:not([type])'),()=>fn(fields(f)),feedback);});
}
function showModel(parent,m,publicModel){
  const card=add(parent,'div');card.className='card';
  add(card,'strong',m.name);add(card,'p',m.mm+' mm'+(publicModel?' · '+usd(m.retail):''));
  const details=add(card,'p');
  button(card,'Check print and shipping',async()=>{
    if(!me){details.textContent='Sign in under Account to get a shipping quote.';return;}
    const data=await api('model?id='+encodeURIComponent(m.id));
    details.textContent=data.printable?'Passed print inspection.':'Inspection status: '+data.status+'.';
    if(data.image && !card.querySelector('img')){const img=add(card,'img');img.alt=m.name;img.src=data.image;}
    if(!data.printable)return;
    selected=m.id;message('selected',m.name+' · '+m.mm+' mm');$('delivery').hidden=false;$('rates').replaceChildren();$('delivery').scrollIntoView();
  });
}
async function refresh(){
  catalog=await api('catalog');
  try{me=await api('me');}catch(e){if(e.status!==401)throw e;me=null;}
  message('status',catalog.sales?'Custom prints and collection orders ship to U.S. addresses.':catalog.uploads?'Model submissions are open. Customer checkout is awaiting activation.':'You can design and download a figure or token today. Print orders and model submissions are awaiting merchant setup.');
  $('list').replaceChildren();
  catalog.models.forEach(m=>showModel($('list'),m,true));
  if(!catalog.models.length)add($('list'),'p','The first collection is being prepared.');
  $('libraryLogin').hidden=Boolean(me);$('privatePrints').hidden=!me;$('merchant').hidden=!me?.admin;
  if(!me)return;
  $('myModels').replaceChildren();$('orders').replaceChildren();
  me.models.forEach(m=>showModel($('myModels'),m,false));
  if(!me.models.length)add($('myModels'),'p','Your submitted models will appear here.');
  me.orders.forEach(o=>{
    const row=add($('orders'),'div');add(row,'p',o.name+' · '+(o.state==='awaiting_bank_deposit'?'Payment received. Awaiting release to manufacturing.':o.state)+(o.fulfillment && o.state!=='awaiting_bank_deposit'?' · OTTO '+o.fulfillment:''));
    if(!['submitted','supplier_processing'].includes(o.state)) return;
    button(row,'View fulfillment',async()=>{
      const r=await api('tracking?id='+encodeURIComponent(o.id));
      const details=row.querySelector('aside')||add(row,'aside');details.replaceChildren();
      add(details,'p',[r.status,r.carrier,r.tracking].filter(Boolean).join(' · '));
      if(r.url){const a=add(details,'a','Track shipment');a.href=r.url;a.rel='noreferrer';}
    });
  });
  if(!me.orders.length)add($('orders'),'p','No print orders yet.');
  if(me.admin)await refreshAdmin();
}
async function refreshAdmin(){
  const v=await api('admin/config');
  message('connections',[
    'OTTO API key '+(v.api?'entered':'missing'),
    'OTTO signed delivery '+(v.ottoDelivery?'received':'pending'),
    'Stripe key '+(v.stripe?'entered':'missing'),
    'Stripe signed delivery '+(v.stripeDelivery?'received':'pending'),
    'supplier payment method '+(v.fulfillment?'entered':'missing'),
    'checkout '+(v.sales?'open':'paused')
  ].join(' · '));
  const deposits=$('deposits');
  deposits.replaceChildren();
  if(v.deposits?.length) add(deposits,'h3','Orders awaiting bank deposit');
  for(const order of v.deposits || []){
    const row=add(deposits,'div'); row.className='card';
    add(row,'strong',order.name);
    add(row,'p','Order '+order.id+' · Customer subtotal with shipping '+usd(order.retail+order.shipping)+' · Maximum OTTO charge '+usd(order.supplier));
    const link=add(row,'a','Match this customer payment in Stripe');
    link.href='https://dashboard.stripe.com/payments/'+encodeURIComponent(order.intent);link.target='_blank';link.rel='noreferrer';
    const label=add(row,'label','Stripe payout ID containing this payment');
    const reference=add(label,'input');reference.placeholder='po_…';reference.value=order.payout || '';
    const consent=add(row,'label');consent.className='check';
    const check=add(consent,'input');check.type='checkbox';
    consent.append(' I matched this payment to the deposit posted at my bank. The funds cover the OTTO charge.');
    button(row,'Release to OTTO · up to '+usd(order.supplier),async()=>{
      if(!check.checked || !/^po_[A-Za-z0-9]{2,120}$/.test(reference.value.trim())) throw Error('Confirm the posted deposit and enter its Stripe payout ID.');
      const result=await api('admin/release',{id:order.id,payout:reference.value.trim(),confirmed:true});
      await refreshAdmin();message('adminFeedback','Order '+order.id+' · '+result.state);
    },'adminFeedback');
  }
  $('review').replaceChildren();
  for(const o of v.review||[])add($('review'),'p','Review order '+o.id+' · '+(o.otto_id||'No OTTO order')+' · '+o.state);
  if(v.markup!=null)$('markup').elements.amount.value=(v.markup/100).toFixed(2);
}
const design=$('designer');
function generatedFile(){
  if(!design.reportValidity())return;
  const f=fields(design);
  return new File([tokenOBJ(f.shape,Number(f.width),Number(f.height))],[f.shape,f.width+'mm',f.height+'mm'].join('-')+'.obj',{type:'model/obj'});
}
function draw(){
  if(!design.checkValidity())return;
  const f=fields(design),g=tokenGeometry(f.shape,Number(f.width),Number(f.height));
  $('silhouette').setAttribute('points',g.contour.map(([x,y])=>[50*x,-50*y].join(',')).join(' '));
}
design.addEventListener('input',draw);draw();
form('designer',()=>{
  const file=generatedFile();if(!file)return;
  const link=document.createElement('a');link.download=file.name;link.href=URL.createObjectURL(file);link.click();setTimeout(()=>URL.revokeObjectURL(link.href),3000);
});
$('use').onclick=()=>{
  generated=generatedFile();if(!generated)return;
  const f=$('uploadForm').elements;f.file.value='';f.name.value=design.elements.shape.selectedOptions[0].textContent+' tabletop print';f.mm.value=design.elements.width.value;
  message('uploadFeedback','');message('chosen','Selected '+generated.name);$('upload').scrollIntoView();
};
// Some Android browsers append .txt when downloading a text-based Wavefront OBJ.
const printFilename = name => name.replace(/\.obj\.txt$/i,'.obj');
$('uploadForm').elements.file.onchange=()=>{
  generated=null;
  const file=$('uploadForm').elements.file.files[0];
  message('chosen',file && printFilename(file.name)!==file.name ? 'Using '+printFilename(file.name)+' as a 3D model.' : '');
  message('uploadFeedback','');
};
let pendingUpload;
form('uploadForm',async f=>{
  if(!me)throw Error('Open Account and sign in, then return here.');
  if(!catalog.uploads)throw Error('OTTO uploads are awaiting merchant setup.');
  const file=generated||$('uploadForm').elements.file.files[0];
  if(!file || file.size>50_000_000)throw Error('Choose a supported file under 50 MB.');
  const filename=printFilename(file.name);
  if(!/\.(obj|3mf|glb|zip)$/i.test(filename))throw Error('Choose an OBJ, GLB, 3MF or ZIP model. Plain text files cannot be printed.');
  const args={filename,bytes:file.size,name:f.name,mm:Number(f.mm),rights:f.rights==='on'};
  const fingerprint=JSON.stringify(args);
  if(!pendingUpload || pendingUpload.file!==file || pendingUpload.key!==fingerprint)pendingUpload={key:fingerprint,file,id:crypto.randomUUID(),sent:false};
  const job=pendingUpload;
  if(!job.sent){
    let id;
    try { ({id}=await api('uploads',{...args,requestId:job.id,transfer:'studio'})); }
    catch(error){if(error.status===409)pendingUpload=null;throw error;}
    message('uploadFeedback','Uploading '+filename+'…');
    let response;
    try {
      response=await fetch('/api/otto/uploads/'+encodeURIComponent(id)+'/content',{
        method:'POST',headers:{'Content-Type':'application/octet-stream'},body:file
      });
    } catch { throw Error('The connection to Eldritch Fable was interrupted. Tap Submit for inspection again to retry.'); }
    if(!response.ok){
      const problem=await response.json().catch(()=>({}));
      if(response.status===410)pendingUpload=null;
      throw Error(problem.error||'File transfer interrupted. Submit the same file again.');
    }
    job.sent=true;
  }
  const m=await api('uploads/finish',{id:job.id});
  message('uploadFeedback','Submitted '+m.id+'. Check inspection under My prints.');await refresh();
},'uploadFeedback');
form('address',async a=>{
  const model=selected;
  a.state=a.state.toUpperCase();
  $('rates').replaceChildren();
  const q=await api('quotes',{model,address:a});
  if(selected!==model)return;
  const dest=q.address||a;
  add($('rates'),'p','Ship to '+[dest.name,dest.line1,dest.line2,dest.city,dest.state,dest.postal_code].filter(Boolean).join(', '));
  add($('rates'),'p','Your card is charged at checkout. Manufacturing starts after the payment reaches our bank and we release the order. Shipping transit follows manufacturing.');
  for(const o of q.options){
    const line=add($('rates'),'div');line.className='card';
    add(line,'p',o.name+' · Print '+usd(q.retail)+' + shipping '+usd(o.shipping)+' = '+usd(q.retail+o.shipping)+' before tax.');
    if(q.sales)button(line,'Continue to Stripe',async()=>{const result=await api('checkout',{quote:q.id,option:o.id});location.assign(result.url);});
  }
  if(!q.sales)add($('rates'),'p','Customer checkout is awaiting activation.');
});
async function listModels(next){
  const data=await api('admin/models'+(next&&cursor?'?cursor='+encodeURIComponent(cursor):''));
  if(!next)$('supplier').replaceChildren();
  for(const m of data.models){
    const c=add($('supplier'),'div');c.className='card';add(c,'strong',m.name);
    add(c,'p',[m.id,m.mm+' mm',m.printable?'Passed inspection':m.status,m.published?'Published':'Unlisted'].join(' · '));
    if(m.image){const img=add(c,'img');img.alt=m.name;img.src=m.image;}
    if(m.printable){const label=add(c,'label','Retail price (USD)');const price=add(label,'input');Object.assign(price,{type:'number',min:'.01',step:'.01',max:'10000',value:m.retail?(m.retail/100).toFixed(2):''});
      button(c,'Publish at this price',async()=>{if(!price.value||!price.reportValidity())throw Error('Enter a retail price.');await api('admin/listing',{id:m.id,published:true,retail:Math.round(Number(price.value)*100)});await refresh();await listModels(false);message('adminFeedback','Published '+m.name+'.');},'adminFeedback');}
    if(m.published)button(c,'Unpublish',async()=>{await api('admin/listing',{id:m.id,published:false});await refresh();await listModels(false);},'adminFeedback');
  }
  if(!data.models.length)add($('supplier'),'p','No merchant models on this page.');
  cursor=data.cursor;$('more').hidden=!cursor;
}
$('load').onclick=()=>action($('load'),()=>listModels(false),'adminFeedback');
$('more').onclick=()=>action($('more'),()=>listModels(true),'adminFeedback');
form('markup',async f=>{await api('admin/markup',{cents:Math.round(Number(f.amount)*100)});await refreshAdmin();message('adminFeedback','Custom print markup saved.');},'adminFeedback');
$('verifyStripe').onclick=()=>action($('verifyStripe'),async()=>{
  await api('admin/stripe-product',{});
  message('adminFeedback','Requested a Stripe event for the custom print product. Refresh this page to see the signed delivery.');
},'adminFeedback');
for(const [id,open] of [['open',true],['pause',false]])$(id).onclick=()=>action($(id),async()=>{await api('admin/sales',{open});await refresh();message('adminFeedback',open?'Customer checkout opened.':'Customer checkout paused.');},'adminFeedback');
refresh().catch(e=>message('status',e.message));
