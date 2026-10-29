import { chromium, expect } from '/srv/eldritch-staging/audits/tavern-candidate-20261026T124834Z/standalone/node_modules/@playwright/test/index.mjs';
import fs from 'node:fs';
import path from 'node:path';

process.umask(0o077);
const origin='https://eldritchfable.com';
const output=path.join('/srv/eldritch-staging/audits/public-readiness-20261026','run-'+new Date().toISOString().replaceAll(':','-'));
fs.mkdirSync(output,{mode:0o700});
const report={startedAt:new Date().toISOString(),origin,output,verifiedTLS:true,manifest:null,checks:[],issues:[],jsErrors:[],httpErrors:[],requestFailures:[],consoleErrors:[],blockedAppWrites:[],blockedEdgeWrites:0,blockedEdgeConsoleErrors:0,imageChecks:[],viewports:[]};
const checkedImages=new Set();
const safePath=url=>{try{const u=new URL(url);return u.pathname.startsWith('/cdn-cgi/')?'/cdn-cgi/[edge]':u.pathname;}catch{return '[invalid-url]';}};
const isEdge=url=>{try{return new URL(url).pathname.startsWith('/cdn-cgi/');}catch{return false;}};
async function check(name,fn){try{const value=await fn();report.checks.push({name,passed:true,...value});}catch(error){report.issues.push({name,message:error.message.split('\n').slice(0,6).join('\n')});report.checks.push({name,passed:false});}finally{fs.writeFileSync(path.join(output,'progress.json'),JSON.stringify({updatedAt:new Date().toISOString(),checks:report.checks,issues:report.issues},null,2)+'\n',{mode:0o600});console.log(JSON.stringify({check:name,passed:report.checks.at(-1)?.passed}));}}
async function validateImages(page,label){
 const assets=await page.evaluate(()=>{
  const urls=new Set();const badImages=[];
  for(const img of document.images){const style=getComputedStyle(img);if(img.getBoundingClientRect().width>0&&style.visibility!=='hidden'){if(!img.complete||img.naturalWidth===0)badImages.push(img.getAttribute('src'));if(img.currentSrc)urls.add(img.currentSrc);}}
  for(const element of document.querySelectorAll('*')){const bounds=element.getBoundingClientRect();if(!bounds.width||!bounds.height)continue;
   for(const pseudo of [null,'::before','::after']){const style=getComputedStyle(element,pseudo);if(style.display==='none'||style.visibility==='hidden'||pseudo&&style.content==='none')continue;for(const match of style.backgroundImage.matchAll(/url\(["']?([^"')]+)["']?\)/g))urls.add(new URL(match[1],location.href).href);}
  }
  return{urls:[...urls],badImages};
 });
 expect(assets.badImages).toEqual([]);
 for(const url of assets.urls){if(checkedImages.has(url))continue;checkedImages.add(url);const response=await page.request.get(url,{timeout:10000});const type=response.headers()['content-type']||'';const item={page:label,path:safePath(url),status:response.status(),contentType:type};report.imageChecks.push(item);expect(response.ok()).toBe(true);expect(type.startsWith('image/')).toBe(true);}
}
const browser=await chromium.launch();
try{
 for(const mobile of [false,true]){
  const label=mobile?'mobile':'desktop';
  const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1280,height:900},isMobile:mobile,hasTouch:mobile});
  await context.route('**/*',route=>{const request=route.request();if(!['GET','HEAD','OPTIONS'].includes(request.method())){if(isEdge(request.url()))report.blockedEdgeWrites++;else report.blockedAppWrites.push({method:request.method(),path:safePath(request.url())});return route.abort();}return route.continue();});
  const page=await context.newPage();
  page.on('pageerror',error=>report.jsErrors.push({viewport:label,message:error.message}));
  page.on('response',response=>{if(response.status()>=400&&!isEdge(response.url()))report.httpErrors.push({viewport:label,path:safePath(response.url()),status:response.status()});});
  page.on('requestfailed',request=>{if(!isEdge(request.url()))report.requestFailures.push({viewport:label,path:safePath(request.url()),method:request.method(),error:request.failure()?.errorText});});
  page.on('console',message=>{if(message.type()!=='error')return;const url=message.location().url;if(isEdge(url)){report.blockedEdgeConsoleErrors++;return;}report.consoleErrors.push({viewport:label,path:safePath(url||origin),message:message.text().replace(/https?:\/\/\S+/g,'[url]')});});
  if(!mobile)await check('public release manifest and empty catalog',async()=>{
   const m=await context.request.get(origin+'/frontend-release.json');expect(m.status()).toBe(200);report.manifest=await m.json();
   const catalog=await context.request.get(origin+'/api/catalog');expect(catalog.status()).toBe(200);const data=await catalog.json();expect(data.products).toEqual([]);expect(data.collections).toEqual([]);return{products:0,collections:0};
  });
  const routes=[['/','Adventures Become Real'],['/shop','Explore the archive.'],['/bag','Your bag'],['/wishlist','Your Wishlist'],['/account','Sign in to your account'],['/login','Welcome back'],['/register','Create your account'],['/forgot-password','Reset your password'],['/resend-verification','Verify your account']];
  for(const [route,heading]of routes)await check(label+' '+route,async()=>{
   const response=await page.goto(origin+route,{waitUntil:'load',timeout:20000});expect(response.status()).toBe(200);await expect(page.getByRole('heading',{name:heading,exact:true})).toBeVisible();
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
   if(route==='/'){
    const headers=response.headers();expect(headers['x-eldritch-frontend-release']).toBe(report.manifest.releaseId);expect(headers['x-eldritch-release']).toBe(report.manifest.backendRelease);
    const tls=await response.securityDetails();if(tls)report.tls={protocol:tls.protocol,subjectName:tls.subjectName,validTo:tls.validTo};
    await validateImages(page,label+' home');await page.screenshot({path:path.join(output,label+'-home.png'),fullPage:true});
    const categories=await page.locator('#categories .tavern-category, #categories .category-grid > a').count();expect(categories).toBe(6);
   }
   if(route==='/shop')await expect(page.getByRole('heading',{name:'No artifacts found',exact:true})).toBeVisible();
   if(route==='/bag')await expect(page.getByText('Your bag is empty.',{exact:true})).toBeVisible();
   if(route==='/wishlist')await expect(page.getByText('Your wishlist is empty.',{exact:true})).toBeVisible();
   return{status:response.status(),heading};
  });
  if(!mobile)for(const width of [320,390,680,701,800,1024,1280])await check('responsive '+width,async()=>{
   await page.setViewportSize({width,height:900});await page.goto(origin+'/',{waitUntil:'load',timeout:20000});await expect(page.getByRole('heading',{name:'Adventures Become Real',exact:true})).toBeVisible();
   const dimensions=await page.evaluate(()=>{const h=document.querySelector('.hero h1');return{width:innerWidth,documentWidth:document.documentElement.scrollWidth,headlineWidth:h.clientWidth,headlineScrollWidth:h.scrollWidth};});expect(dimensions.documentWidth<=width).toBe(true);expect(dimensions.headlineScrollWidth<=dimensions.headlineWidth+1).toBe(true);
   if(width<=700){await page.getByRole('button',{name:'Open menu',exact:true}).click();const nav=page.getByRole('navigation',{name:'Mobile navigation'});await expect(nav.getByRole('link',{name:'Account',exact:true})).toBeInViewport();await nav.getByRole('link',{name:'Account',exact:true}).click();await expect(page.getByRole('heading',{name:'Sign in to your account',exact:true})).toBeVisible();}
   else await expect(page.getByRole('link',{name:'Account',exact:true}).filter({visible:true})).toBeVisible();
   report.viewports.push(dimensions);return dimensions;
  });
  await context.close();
 }
}finally{
 await browser.close();report.finishedAt=new Date().toISOString();report.success=report.issues.length===0&&report.jsErrors.length===0&&report.httpErrors.length===0&&report.requestFailures.length===0&&report.consoleErrors.length===0&&report.blockedAppWrites.length===0;
 fs.writeFileSync(path.join(output,'results.json'),JSON.stringify(report,null,2)+'\n',{mode:0o600});console.log(JSON.stringify(report));if(!report.success)process.exitCode=1;
}
