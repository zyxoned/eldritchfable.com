const messages={
  CHECKOUT_DISABLED:'Checkout is not open yet. Your bag is saved.',
  CHECKOUT_RETRY:'We could not connect to the payment page. Try again to resume the same checkout.',
  OUT_OF_STOCK:'An item is no longer available in that quantity. Please review your bag.',
  PRODUCT_UNAVAILABLE:'An item is not available for checkout yet. Please review your bag.',
  PRODUCT_CHANGED:'An item changed while we checked your bag. Please refresh and review it again.',
  ORDER_ALREADY_FINAL:'This checkout has already finished. Check its order status before starting another payment.',
  ORDER_REQUIRES_RECONCILIATION:'This checkout needs to be checked before another payment can start. Please review its order status.',
  ADMIN_REQUIRED:'Checkout is not available for this account. Your bag is saved.',
  TAX_NOT_READY:'Payment setup is still being completed. Your bag is saved.'
};
export async function commerceRequest(path,{body,key,signal}={}) {
  let response;
  try {
    response=await fetch('/api/commerce/'+path,{
      method:body===undefined?'GET':'POST',credentials:'same-origin',signal,
      headers:{Accept:'application/json',...(body===undefined?{}:{'Content-Type':'application/json','Idempotency-Key':key})},
      body:body===undefined?undefined:JSON.stringify(body)
    });
  } catch(error) {
    if (error.name==='AbortError') throw error;
    throw Error('The payment service could not be reached. Your bag is saved; please try again.');
  }
  let data;
  try { data=await response.json(); } catch { throw Error('The payment service is temporarily unavailable. Please try again.'); }
  if (!response.ok) throw Object.assign(Error(response.status===401?'Sign in to view your checkout.':messages[data.code]||'Checkout is temporarily unavailable. Your bag is saved.'),{status:response.status,code:data.code});
  return data;
}
