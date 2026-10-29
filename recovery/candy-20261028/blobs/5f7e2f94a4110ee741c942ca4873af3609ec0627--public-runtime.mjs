import { chromium, expect } from '/srv/eldritch-staging/tavern-integration/standalone/node_modules/@playwright/test/index.mjs';
import fs from 'node:fs';
const output='/srv/eldritch-staging/audits/runtime-20261026T0635';
const releaseId='tavern-918e5d24237b-20261024T224605Z';
const origin='https://eldritchfable.com';
const results=[]; const responseFailures=[]; const requestFailures=[]; const jsErrors=[]; const consoleErrors=[]; const blockedWrites=[];
const browser=await chromium.launch();
try {
 for (const mobile of [false,true]) {
  const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1280,height:900},isMobile:mobile,hasTouch:mobile});
  const page=await context.newPage();
  page.on('pageerror',error=>jsErrors.push(error.message));
  page.on('console',message=>{if(message.type()==='error')consoleErrors.push(message.text());});
  page.on('response',response=>{if(response.status()>=400)responseFailures.push({status:response.status(),path:new URL(response.url()).pathname});});
  page.on('requestfailed',request=>requestFailures.push({method:request.method(),path:new URL(request.url()).pathname,error:request.failure()?.errorText}));
  await page.route('**/*',route=>{if(!['GET','HEAD','OPTIONS'].includes(route.request().method())){blockedWrites.push({method:route.request().method(),path:new URL(route.request().url()).pathname});return route.abort();}return route.continue();});
  const response=await page.goto(origin+'/?frontend_release='+releaseId,{waitUntil:'networkidle',timeout:30000});
  const headers=response.headers();
  expect(response.status()).toBe(200);expect(headers['x-eldritch-frontend-release']).toBe(releaseId);
  await expect(page.getByRole('heading',{level:1})).toHaveText('Adventures Become Real');
  await expect(page.locator('#categories .category-grid > a')).toHaveCount(6);
  const home=await page.evaluate(()=>({bodyWidth:document.body.scrollWidth,documentWidth:document.documentElement.scrollWidth,viewport:innerWidth,title:document.title,heroHeadlineWidth:document.querySelector('.hero h1').clientWidth,heroHeadlineScrollWidth:document.querySelector('.hero h1').scrollWidth}));
  expect(home.documentWidth<=home.viewport).toBe(true);
  await page.screenshot({path:output+'/'+(mobile?'mobile':'desktop')+'.png'});
  await page.getByRole('link',{name:'Enter the Loot Cache'}).click();await expect(page).toHaveURL(/\/shop$/);await expect(page.getByRole('heading',{name:'No artifacts found'})).toBeVisible();
  await page.goto(origin+'/');await expect(page.getByRole('heading',{name:'Adventures Become Real'})).toBeVisible();
  if(mobile)await page.getByRole('button',{name:'Open menu'}).click();
  await page.getByRole('link',{name:'Account',exact:true}).filter({visible:true}).click();await expect(page.getByRole('heading',{name:'Sign in to your account'})).toBeVisible();
  await page.getByRole('link',{name:'Sign in',exact:true}).click();await expect(page.getByRole('heading',{name:'Welcome back'})).toBeVisible();
  await page.goto(origin+'/resend-verification');await expect(page.getByRole('heading',{name:'Verify your account'})).toBeVisible();
  await page.goto(origin+'/bag');await expect(page.getByRole('heading',{name:'Your bag'})).toBeVisible();await expect(page.getByText('Your bag is empty.',{exact:true})).toBeVisible();
  const widths=[];
  if(!mobile)for(const width of [320,390,680,701,768,1024,1280]){
   await page.setViewportSize({width,height:900});await page.goto(origin+'/');await expect(page.getByRole('heading',{name:'Adventures Become Real'})).toBeVisible();
   const dimensions=await page.evaluate(()=>{const h=document.querySelector('.hero h1');return{viewport:innerWidth,documentWidth:document.documentElement.scrollWidth,headlineClientWidth:h.clientWidth,headlineScrollWidth:h.scrollWidth,headlineFont:getComputedStyle(h).fontSize,categoryColumns:getComputedStyle(document.querySelector('.category-grid')).gridTemplateColumns};});
   const widthResult={...dimensions,menu:false,account:false};
   if(width<=700){await page.getByRole('button',{name:'Open menu'}).click();const nav=page.getByRole('navigation',{name:'Mobile navigation'});await expect(nav).toBeVisible();const account=nav.getByRole('link',{name:'Account',exact:true});await expect(account).toBeInViewport();widthResult.menu=true;widthResult.account=true;}
   else{await expect(page.getByRole('link',{name:'Account',exact:true}).filter({visible:true})).toBeVisible();widthResult.account=true;}
   expect(dimensions.documentWidth<=width).toBe(true);expect(dimensions.headlineScrollWidth<=dimensions.headlineClientWidth+1).toBe(true);widths.push(widthResult);
  }
  results.push({viewport:mobile?'mobile':'desktop',status:response.status(),backendRelease:headers['x-eldritch-release'],frontendRelease:headers['x-eldritch-frontend-release'],home,shop:true,account:true,login:true,resendVerification:true,bag:true,widths});
  await context.close();
 }
 const appWrites=blockedWrites.filter(x=>!x.path.startsWith('/cdn-cgi/')); const unexpectedRequestFailures=requestFailures.filter(x=>!x.path.startsWith('/cdn-cgi/')); const edgeWrites=blockedWrites.filter(x=>x.path.startsWith('/cdn-cgi/')).map(x=>({method:x.method,path:x.path.startsWith('/cdn-cgi/rum')?'/cdn-cgi/rum':'/cdn-cgi/challenge-platform/...'})); const report={releaseId,observedAt:new Date().toISOString(),results,jsErrors,responseFailures,unexpectedRequestFailures,appWrites,edgeWritesBlocked:edgeWrites,consoleResourceErrorsFromBlockedEdgeRequests:consoleErrors.length};
 fs.writeFileSync(output+'/results.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
 expect(jsErrors).toEqual([]);expect(responseFailures).toEqual([]);expect(unexpectedRequestFailures).toEqual([]);expect(appWrites).toEqual([]);
}finally{await browser.close();}
