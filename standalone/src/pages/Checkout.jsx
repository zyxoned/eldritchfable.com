import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, CheckCircle2, Clock3, LockKeyhole, Package, ShieldCheck, ShoppingBag } from 'lucide-react';
import { loadCatalog } from '../api/catalog.js';
import { commerceRequest } from '../api/commerce.js';
import { CHECKOUT_ATTEMPT_KEY, checkoutAttempt, retireCheckoutAttempt, orderPresentation, stripeHostedUrl, validOrderId } from '../lib/checkout-core.js';
import { PREVIEW_CART_KEY, readCart, money } from '../lib/storefront-preview-core.js';
import '../styles/checkout.css';

function PaymentShell({children}) {
  return <div className="ef-payments"><header className="ef-payment-header"><Link className="ef-payment-brand" to="/" aria-label="Eldritch Fable home">ELDRITCH <span>FABLE</span></Link><Link to="/bag"><ShoppingBag aria-hidden="true" /> Your bag</Link></header><main id="payment-main">{children}</main><footer>ELDRITCH FABLE <span>Adventures become real.</span></footer></div>;
}

export default function Checkout() {
  const catalog=useQuery({queryKey:['storefront-preview-catalog'],queryFn:({signal})=>loadCatalog(signal),staleTime:0,retry:false});
  const status=useQuery({queryKey:['commerce-checkout-status'],queryFn:({signal})=>commerceRequest('status',{signal}),staleTime:0,retry:false});
  const [lines,setLines]=useState([]), [cartReady,setCartReady]=useState(false);
  const [busy,setBusy]=useState(false), [error,setError]=useState(''), [orderId,setOrderId]=useState(null);
  const inFlight=useRef(false), controller=useRef(null);
  useEffect(()=>{document.title='Checkout | Eldritch Fable';return()=>controller.current?.abort();},[]);
  useEffect(()=>{
    if (!catalog.data) return;
    const read=()=>{
      try { setLines(readCart(localStorage.getItem(PREVIEW_CART_KEY),catalog.data.products)); }
      catch { setError('Your saved bag could not be read. Return to your bag and try again.'); }
      setCartReady(true);
    };
    read(); window.addEventListener('storage',read);
    return()=>window.removeEventListener('storage',read);
  },[catalog.data]);
  const products=catalog.data?.products||[];
  const summary=useMemo(()=>lines.map(line=>{
    const product=products.find(p=>p.id===line.productId), variant=product?.variants.find(v=>v.id===line.variantId);
    return {...line,name:product?.name,variant:variant?.label,unitAmount:variant?.priceCents||0};
  }),[lines,products]);
  const subtotal=summary.reduce((sum,line)=>sum+line.unitAmount*line.quantity,0);
  async function begin() {
    if (inFlight.current || !lines.length || !status.data?.canCheckout) return;
    inFlight.current=true;setBusy(true);setError('');
    controller.current=new AbortController();
    try {
      let attempt;
      try { attempt=checkoutAttempt(sessionStorage,status.data.userId,lines); }
      catch { throw Error('Your browser could not save this checkout. Allow site storage before trying again.'); }
      if (validOrderId(attempt.orderId)) setOrderId(attempt.orderId);
      const result=await commerceRequest('checkout',{body:{items:lines},key:attempt.key,signal:controller.current.signal});
      if (!validOrderId(result.orderId) || !stripeHostedUrl(result.url)) throw Error('The payment page could not be verified. Your bag is saved.');
      setOrderId(result.orderId);
      try { sessionStorage.setItem(CHECKOUT_ATTEMPT_KEY,JSON.stringify({...attempt,orderId:result.orderId})); } catch { /* The original retry key is already persisted. */ }
      window.location.assign(result.url);
    } catch(failure) { if (!controller.current.signal.aborted) setError(failure.message); }
    finally { inFlight.current=false;if (!controller.current.signal.aborted) setBusy(false); }
  }
  const loading=catalog.isPending || status.isPending || !cartReady;
  const unavailable=catalog.isError || status.isError;
  return <PaymentShell><Link className="ef-payment-back" to="/bag"><ArrowLeft aria-hidden="true" /> Back to your bag</Link><div className="ef-payment-heading"><p>THE NEXT CHAPTER</p><h1>Checkout</h1><span>Review your wares before the journey begins.</span></div>
    {unavailable?<section className="ef-payment-panel" role="alert"><h2>Checkout is temporarily unavailable</h2><p>Your bag is saved. Please try loading checkout again.</p><button className="ef-payment-button" onClick={()=>{catalog.refetch();status.refetch();}}>Try again</button></section>:loading?<p role="status">Preparing your bag…</p>:!summary.length?<section className="ef-payment-panel ef-payment-empty"><ShoppingBag aria-hidden="true" /><h2>Your bag is empty</h2><p>Find something for your next adventure.</p><Link className="ef-payment-button" to="/shop">Explore the wares <ArrowRight aria-hidden="true" /></Link></section>:<div className="ef-payment-layout"><section className="ef-payment-panel" aria-labelledby="checkout-items"><div className="ef-payment-section-title"><Package aria-hidden="true" /><h2 id="checkout-items">Your wares</h2><span>{summary.reduce((sum,line)=>sum+line.quantity,0)} items</span></div><ul className="ef-payment-items">{summary.map(line=><li key={JSON.stringify([line.productId,line.variantId])}><div><strong>{line.name}</strong><span>{line.variant} · Quantity {line.quantity}</span></div><strong>{money(line.unitAmount*line.quantity)}</strong></li>)}</ul><Link className="ef-payment-back" to="/bag">Edit your bag</Link><div className="ef-payment-assurance"><ShieldCheck aria-hidden="true" /><p>Payment and delivery details are entered on Stripe’s secure checkout page. Your final total is shown before you pay.</p></div></section>
      <aside className="ef-payment-panel ef-payment-summary" aria-labelledby="checkout-payment"><h2 id="checkout-payment">Payment summary</h2><dl><div><dt>Items subtotal</dt><dd>{money(subtotal)}</dd></div><div><dt>Shipping</dt><dd>At checkout</dd></div><div><dt>Tax</dt><dd>At checkout</dd></div></dl>
        {status.data.canCheckout?<><p className="ef-payment-badge">Test checkout · No real payment</p><button className="ef-payment-button" disabled={busy} onClick={begin}><LockKeyhole aria-hidden="true" />{busy?'Opening secure checkout…':'Continue to secure payment'}<ArrowRight aria-hidden="true" /></button><p className="ef-payment-fine">Available payment methods appear on Stripe. This sandbox checkout does not place a real merchandise order.</p></>:<><p className="ef-payment-notice">Checkout is not open yet. Your preview bag is saved.</p><button className="ef-payment-button" disabled>Payments opening soon</button><p className="ef-payment-fine">These are preview prices. Products and delivery are being prepared for launch.</p></>}
        {!status.data.userId&&<Link className="ef-payment-back" to="/login?next=%2Fcheckout">Sign in to your account</Link>}{error&&<p role="alert" className="ef-payment-error">{error}</p>}{orderId&&<Link className="ef-payment-back" to={'/checkout/return?order='+orderId}>Check this order’s status</Link>}
      </aside></div>}
  </PaymentShell>;
}

export function CheckoutReturn() {
  const location=useLocation(), navigate=useNavigate(), params=new URLSearchParams(location.search);
  const id=params.get('order'), cancelled=params.get('cancelled')==='1';
  const [state,setState]=useState({loading:true,order:null,error:'',status:0});
  const [reload,setReload]=useState(0);
  const [restartError,setRestartError]=useState('');
  useEffect(()=>{document.title='Your order | Eldritch Fable';},[]);
  useEffect(()=>{
    if (!validOrderId(id)) {setState({loading:false,order:null,error:'This order link is incomplete. Return to your bag or open your original order link.',status:404});return;}
    const controller=new AbortController(), started=Date.now(); let timer,revision=0;
    async function load(reset=false) {
      clearTimeout(timer);const current=++revision;
      if (reset) setState({loading:true,order:null,error:'',status:0});
      try {
        const result=await commerceRequest('orders/'+id,{signal:controller.signal});
        if (controller.signal.aborted || current!==revision) return;
        setState({loading:false,order:result.order,error:'',status:200});
        if (result.order.status==='pending' && Date.now()-started<60000) timer=setTimeout(()=>load(),3000);
      } catch(error) {
        if (!controller.signal.aborted && current===revision) setState({loading:false,order:null,error:error.status===404?'We could not find this order for your account. Check your original order link.':error.message,status:error.status});
      }
    }
    const refresh=()=>load(true);load(true);window.addEventListener('focus',refresh);
    return()=>{controller.abort();clearTimeout(timer);window.removeEventListener('focus',refresh);};
  },[id,reload]);
  const view=state.order?orderPresentation(state.order,cancelled):null;
  const pending=state.order?.status==='pending';
  const next=validOrderId(id)?'/checkout/return?order='+id:'/checkout';
  const terminal=state.order && ['paid','expired','payment_failed'].includes(state.order.status) && !state.order.review_reason;
  function startAnother() {
    try {
      if (!retireCheckoutAttempt(sessionStorage,state.order)) {setRestartError('Another checkout is still saved in this tab. Return to checkout to review it first.');return;}
      navigate('/checkout');
    } catch {setRestartError('Your browser could not save a new checkout. Allow site storage before trying again.');}
  }
  return <PaymentShell><section className="ef-payment-panel ef-payment-result" aria-live="polite">{state.loading?<><Clock3 aria-hidden="true" /><h1>Checking your order</h1><p>Waiting for a confirmed order status…</p></>:state.error?<><h1>{state.status===401?'Sign in to view your order':'We could not check your order'}</h1><p role="alert">{state.error}</p>{state.status===401?<Link className="ef-payment-button" to={'/login?next='+encodeURIComponent(next)}>Sign in</Link>:<button className="ef-payment-button" onClick={()=>setReload(n=>n+1)}>Check again</button>}</>:<>{state.order.status==='paid'&&!state.order.review_reason?<CheckCircle2 aria-hidden="true" />:<Clock3 aria-hidden="true" />}<p className="ef-payment-badge">Test order · No real payment or shipment</p><h1>{view.title}</h1><p>{view.message}</p><p className="ef-payment-reference">Order reference <span>{state.order.id}</span></p>{Number.isSafeInteger(state.order.amount_total)&&<dl><div><dt>Total</dt><dd>{money(state.order.amount_total)}</dd></div><div><dt>Included tax</dt><dd>{money(state.order.amount_tax||0)}</dd></div></dl>}{pending&&<button className="ef-payment-button" onClick={()=>setReload(n=>n+1)}>Check payment status</button>}</>}
    {terminal&&<><button className="ef-payment-button" onClick={startAnother}>{state.order.status==='paid'?'Start a new test order':'Try checkout again'}</button><p className="ef-payment-fine">This starts a separate checkout using your saved bag.</p></>}{restartError&&<p role="alert" className="ef-payment-error">{restartError}</p>}<div className="ef-payment-result-links"><Link to="/checkout">Return to checkout</Link><Link to="/shop">Explore the shop</Link></div><p className="ef-payment-fine">Your bag is kept on this device. Review your order status before starting another payment.</p></section></PaymentShell>;
}
