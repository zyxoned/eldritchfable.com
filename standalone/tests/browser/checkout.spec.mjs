import {test,expect} from '@playwright/test';

const id='12345678-1234-1234-1234-123456789abc';
const products=[{id:'bag',slug:'leather-dice-bag',name:'Leather dice bag',category:'bags',description:'Isolated checkout fixture',details:[],specifications:[],art:'default',variants:[{id:'natural',label:'Natural leather',price_cents:2000}]}];
async function setup(page,{canCheckout=false,empty=false}={}) {
  await page.route('**/api/catalog',route=>route.fulfill({json:{products,collections:[{slug:'bags',name:'Dice bags'}]}}));
  await page.route('**/api/commerce/status',route=>route.fulfill({json:{canCheckout,userId:canCheckout?'fixture-admin':null,sandbox:true}}));
  if (!empty) await page.addInitScript(()=>localStorage.setItem('eldritch-fable:standalone-preview-cart:v1',JSON.stringify({version:1,lines:[{productId:'bag',variantId:'natural',quantity:1}]})));
}

test('checkout opens from the bag, stays closed before launch, and fits narrow screens',async({page},testInfo)=>{
  await setup(page);
  await page.goto('/bag');
  await page.getByRole('link',{name:'Review checkout',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Checkout',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Payments opening soon'})).toBeDisabled();
  await expect(page.getByText('Leather dice bag',{exact:true})).toBeVisible();
  await expect(page.getByText('Your preview bag is saved.',{exact:false})).toBeVisible();
  for(const width of [320,390,760,1280]) {
    await page.setViewportSize({width,height:900});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    if(width===320||width===1280) await page.screenshot({path:testInfo.outputPath('checkout-review-'+width+'.png'),fullPage:true});
  }
});

test('an empty checkout cannot create a payment',async({page})=>{
  await setup(page,{canCheckout:true,empty:true});
  let attempted=false;
  await page.route('**/api/commerce/checkout',route=>{attempted=true;return route.abort();});
  await page.goto('/checkout');
  await expect(page.getByRole('heading',{name:'Your bag is empty'})).toBeVisible();
  await expect(page.getByRole('button',{name:'Continue to secure payment'})).toHaveCount(0);
  expect(attempted).toBe(false);
});

test('a sandbox administrator is redirected to the prebuilt Stripe page with a server-created session',async({page})=>{
  await setup(page,{canCheckout:true});
  await page.route('**/api/commerce/checkout',route=>{
    expect(route.request().postDataJSON()).toEqual({items:[{productId:'bag',variantId:'natural',quantity:1}]});
    expect(route.request().headers()['idempotency-key']).toMatch(/^[a-f0-9-]{36}$/);
    return route.fulfill({json:{orderId:id,url:'https://checkout.stripe.com/c/pay/synthetic-session'}});
  });
  await page.route('https://checkout.stripe.com/**',route=>route.fulfill({contentType:'text/html',body:'<h1>Isolated Stripe redirect fixture</h1>'}));
  await page.goto('/checkout');
  await expect(page.getByText('Test checkout · No real payment',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Continue to secure payment'}).click();
  await expect(page).toHaveURL('https://checkout.stripe.com/c/pay/synthetic-session');
});

test('an uncertain connection retains the bag and retries the same checkout identity',async({page})=>{
  await setup(page,{canCheckout:true});
  const keys=[];
  await page.route('**/api/commerce/checkout',route=>{
    keys.push(route.request().headers()['idempotency-key']);
    return route.fulfill({status:503,json:{code:'CHECKOUT_RETRY'}});
  });
  await page.goto('/checkout');
  await page.getByRole('button',{name:'Continue to secure payment'}).click();
  await expect(page.getByRole('alert')).toContainText('resume the same checkout');
  await page.reload();
  await page.getByRole('button',{name:'Continue to secure payment'}).click();
  await expect.poll(()=>keys.length).toBe(2);
  expect(keys[0]).toBe(keys[1]);
  const bag=await page.evaluate(()=>JSON.parse(localStorage.getItem('eldritch-fable:standalone-preview-cart:v1')));
  expect(bag.lines).toHaveLength(1);
});

for(const [code,initialStatus] of [['ORDER_ALREADY_FINAL','expired'],['ORDER_REQUIRES_RECONCILIATION','pending']]) {
  test(`a lost response can be recovered through ${code} before starting a new checkout`,async({page})=>{
    await setup(page,{canCheckout:true});
    const keys=[];
    let orderStatus=initialStatus;
    await page.route('**/api/commerce/checkout',route=>{
      const key=route.request().headers()['idempotency-key'];
      keys.push(key);
      if (keys.length===1) return route.abort('connectionreset');
      if (key===keys[0]) return route.fulfill({status:409,json:{code,orderId:id}});
      return route.fulfill({status:503,json:{code:'CHECKOUT_RETRY'}});
    });
    await page.route('**/api/commerce/orders/'+id,route=>route.fulfill({json:{order:{id,status:orderStatus,amount_total:null,amount_tax:null,review_reason:null}}}));

    const pay=page.getByRole('button',{name:'Continue to secure payment'});
    const statusLink=page.getByRole('link',{name:'Check this order’s status'});
    const restart=page.getByRole('button',{name:'Try checkout again'});
    await page.goto('/checkout');
    await pay.click();
    await expect(page.getByRole('alert')).toContainText('payment service could not be reached');
    await expect(statusLink).toHaveCount(0);
    await page.reload();
    await pay.click();
    await expect(statusLink).toHaveAttribute('href','/checkout/return?order='+id);
    expect(keys[0]).toMatch(/^[a-f0-9-]{36}$/);
    expect(keys).toEqual([keys[0],keys[0]]);

    await page.reload();
    await expect(pay).toBeDisabled();
    await statusLink.click();
    if (initialStatus==='pending') {
      await expect(page.getByRole('heading',{name:'Confirming your payment'})).toBeVisible();
      await expect(restart).toHaveCount(0);
      await page.getByRole('link',{name:'Return to checkout'}).click();
      await expect(pay).toBeDisabled();
      orderStatus='expired';
      await statusLink.click();
    }
    await expect(page.getByRole('heading',{name:'Checkout expired'})).toBeVisible();
    expect(keys).toHaveLength(2);
    await restart.click();
    await expect(page).toHaveURL(/\/checkout$/);
    expect(keys).toHaveLength(2);
    await pay.click();
    await expect.poll(()=>keys.length).toBe(3);
    expect(keys[2]).not.toBe(keys[0]);
  });
}

test('a return URL cannot confirm payment; the owned server order must become paid',async({page},testInfo)=>{
  let paid=false;
  await page.route('**/api/commerce/orders/*',route=>route.fulfill({json:{order:{id,status:paid?'paid':'pending',amount_total:paid?2650:null,amount_tax:paid?150:null,review_reason:null}}}));
  await page.goto('/checkout/return?order='+id+'&success=true&paid=true');
  await expect(page.getByRole('heading',{name:'Confirming your payment'})).toBeVisible();
  await expect(page.getByRole('heading',{name:'Payment confirmed',exact:true})).toHaveCount(0);
  paid=true;
  await expect(page.getByRole('heading',{name:'Payment confirmed',exact:true})).toBeVisible({timeout:8000});
  await expect(page.getByText('$26.50',{exact:true})).toBeVisible();
  await page.screenshot({path:testInfo.outputPath('checkout-confirmed.png'),fullPage:true});
});

test('a cancelled checkout stays unconfirmed and a private order requires sign in',async({page})=>{
  let authenticated=true;
  await page.route('**/api/commerce/orders/*',route=>authenticated?route.fulfill({json:{order:{id,status:'pending',amount_total:null,amount_tax:null}}}):route.fulfill({status:401,json:{error:'Sign in required'}}));
  await page.goto('/checkout/return?order='+id+'&cancelled=1');
  await expect(page.getByRole('heading',{name:'Checkout paused'})).toBeVisible();
  authenticated=false;
  await page.getByRole('button',{name:'Check payment status'}).click();
  await expect(page.getByRole('heading',{name:'Sign in to view your order'})).toBeVisible();
  await expect(page.getByRole('link',{name:'Sign in',exact:true})).toHaveAttribute('href','/login?next='+encodeURIComponent('/checkout/return?order='+id));
});

test('an explicitly retried expired order starts a new checkout identity',async({page})=>{
  await setup(page,{canCheckout:true});
  await page.addInitScript(({id})=>sessionStorage.setItem('eldritch-fable:checkout-attempt:v1',JSON.stringify({owner:'fixture-admin',signature:JSON.stringify([{productId:'bag',variantId:'natural',quantity:1}]),key:'00000000-0000-4000-8000-000000000001',orderId:id})),{id});
  await page.route('**/api/commerce/orders/*',route=>route.fulfill({json:{order:{id,status:'expired',amount_total:null,amount_tax:null}}}));
  let key;
  await page.route('**/api/commerce/checkout',route=>{
    key=route.request().headers()['idempotency-key'];
    return route.fulfill({status:503,json:{code:'CHECKOUT_RETRY'}});
  });
  await page.goto('/checkout/return?order='+id);
  await page.getByRole('button',{name:'Try checkout again'}).click();
  await expect(page).toHaveURL(/\/checkout$/);
  await page.getByRole('button',{name:'Continue to secure payment'}).click();
  await expect.poll(()=>key).toMatch(/^[a-f0-9-]{36}$/);
  expect(key).not.toBe('00000000-0000-4000-8000-000000000001');
});
