import { sessionUser } from './auth.mjs';
import { sameOriginJson, readJson, reply, throttled } from './request-security.mjs';

async function rawBody(req,maximum=262144) {
  const chunks=[]; let size=0;
  for await(const chunk of req) {
    const bytes=Buffer.isBuffer(chunk)?chunk:Buffer.from(chunk);
    size+=bytes.length;
    if (size>maximum) throw Object.assign(Error('Too large'),{status:413});
    chunks.push(bytes);
  }
  return Buffer.concat(chunks);
}
export async function commerceRoute(db,service,req,res,path,options={}) {
  if (path!=='/api/stripe/webhook' && !path.startsWith('/api/commerce/')) return false;
  const send=(status,data)=>{reply(res,status,data);return true;};
  if (path==='/api/stripe/webhook') {
    if (req.method!=='POST') return send(405,{error:'Method not allowed'});
    if (!service.stripe || !service.config.webhookSecret) return send(503,{error:'Webhook is not configured'});
    let event;
    try { event=service.stripe.webhooks.constructEvent(await rawBody(req),req.headers['stripe-signature'],service.config.webhookSecret); }
    catch(error) { return send(error.status===413?413:400,{error:'Invalid webhook'}); }
    try { await service.handleEvent(event); return send(200,{received:true}); }
    catch(error) { return send(error.status===400?400:500,{error:'Webhook processing failed'}); }
  }
  const user=sessionUser(db,req);
  if (path==='/api/commerce/status' && req.method==='GET') return send(200,{
    canCheckout:Boolean(service.config.mode==='sandbox' && service.stripe && user?.role==='admin'),
    userId:user?.id||null,sandbox:true
  });
  if (!user) return send(401,{error:'Sign in required'});
  if (path.startsWith('/api/commerce/orders/') && req.method==='GET') {
    const order=service.orderFor(user,path.slice('/api/commerce/orders/'.length));
    return order?send(200,{order}):send(404,{error:'Order not found'});
  }
  if (path!=='/api/commerce/checkout') return send(404,{error:'Not found'});
  if (req.method!=='POST') return send(405,{error:'Method not allowed'});
  if (!sameOriginJson(req,options.origin)) return send(403,{error:'Forbidden'});
  if (user.role!=='admin') return send(403,{error:'Sandbox checkout requires an administrator'});
  if (throttled(db,req,'checkout','',options)) return send(429,{error:'Too many requests'});
  let input;
  try { input=await readJson(req); }
  catch(error) { return send(error.status===413?413:400,{error:'Invalid checkout request'}); }
  try {
    const result=await service.checkout(user,input,req.headers['idempotency-key'],()=>sessionUser(db,req));
    return send(200,result);
  } catch(error) {
    return send([400,403,409,503].includes(error.status)?error.status:503,{error:'Checkout could not be started',code:error.code||'CHECKOUT_UNAVAILABLE'});
  }
}
