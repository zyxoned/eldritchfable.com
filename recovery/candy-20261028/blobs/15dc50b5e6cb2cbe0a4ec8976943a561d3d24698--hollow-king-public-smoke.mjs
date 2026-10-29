import { chromium, expect } from '/srv/eldritch-staging/rpg-release-7c5068bdb17b/standalone/node_modules/@playwright/test/index.mjs';
import { CLASS_CATALOG } from '/srv/eldritch-staging/rpg-release-7c5068bdb17b/standalone/shared/class-catalog.mjs';
import { mkdir, writeFile } from 'node:fs/promises';
const commit = process.argv[2];
if (!/^[a-f0-9]{40}$/.test(commit || '')) throw Error('Expected source commit required');
const origin = 'https://eldritchfable.com';
const output = '/srv/eldritch-staging/audits/hollow-king-' + commit.slice(0,12);
await mkdir(output,{recursive:true});
const browser = await chromium.launch({headless:true});
const results = [];
try {
 for (const mobile of [false,true]) {
  const viewport = mobile ? {width:390,height:844} : {width:1280,height:900};
  const name = mobile ? 'mobile' : 'desktop';
  const actual = await browser.newContext({viewport,isMobile:mobile,hasTouch:mobile,serviceWorkers:'block'});
  const gate = await actual.newPage();
  const pageResponse = await gate.goto(origin+'/play',{waitUntil:'domcontentloaded'});
  expect(pageResponse.status()).toBe(200);
  await expect(gate.getByRole('heading',{name:'Every legend needs a name.'})).toBeVisible();
  for(const path of ['/api/game/world','/api/game/stash']) expect((await actual.request.get(origin+path)).status()).toBe(401);
  const manifest = await (await actual.request.get(origin+'/frontend-release.json?hollow='+commit)).json();
  expect(manifest.frontendCommit).toBe(commit);
  expect(pageResponse.headers()['x-eldritch-release']).toBe(manifest.backendRelease);
  expect(pageResponse.headers()['x-eldritch-frontend-release']).toBe(manifest.releaseId);
  for(const path of manifest.builtAssets) expect((await actual.request.get(origin+path)).status()).toBe(200);
  await actual.close();

  for(const admin of [false,true]) {
   const context = await browser.newContext({viewport,isMobile:mobile,hasTouch:mobile,serviceWorkers:'block'});
   const errors=[],blocked=[];
   await context.addInitScript(() => {
    window.EventSource = class {
     constructor(){setTimeout(()=>this.onopen?.({}),10);}
     addEventListener(){} close(){}
    };
   });
   const character = (id,heroClass,hidden=false) => ({
    id,name:hidden?'The Unnamed':'RuneVisitor',heroClass,x:10,y:13,hp:100,xp:0,gold:0,kills:0,gathered:[],shrine:false,claimed:false,
    race:hidden?'Draconian':'Wayfarer',levelLabel:hidden?'???':'1',hidden,equipment:CLASS_CATALOG[heroClass].equipment,wardUntil:0,wardAmount:0
   });
   let world={revision:1,players:admin?Array.from({length:6},(_,i)=>({...character('fixture-'+i,['ranger','knight','mage','bard','cleric','monk'][i]),name:'Wayfarer '+(i+1)})):[],seventh:null,enemies:[{id:'bramble',x:17,y:8,hp:42,respawnAt:0},{id:'thistle',x:21,y:13,hp:42,respawnAt:0}],messages:[],effects:[],serverTime:Date.now()};
   let profile={playerId:null,character:null,regularCharacter:null,active:false,adminAccess:admin,adminActive:false,cooldowns:{},balanceXp:0,lifetimeXp:0,balanceCopper:0};
   const result=()=>({realm:world,profile,playerId:profile.playerId,notice:''});
   await context.route('**/api/**',async route=>{
    const path=new URL(route.request().url()).pathname;
    if(path==='/api/auth/me') return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({user:{id:'public-ui-fixture-'+admin,email:'preview@example.test',role:admin?'admin':'customer',email_verified_at:'2026-10-27'}})});
    if(path==='/api/game/world') return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(result())});
    if(route.request().method()==='POST' && ['/api/game/join','/api/game/admin/join'].includes(path)) {
     const input=route.request().postDataJSON();
     const hidden=path.endsWith('/admin/join');
     const hero=character('public-avatar',hidden?'death-knight':input.heroClass,hidden);
     hero.name=hidden?'The Unnamed':input.name;
     world={...world,revision:world.revision+1,serverTime:Date.now(),...(hidden?{seventh:hero}:{players:[hero]})};
     profile={...profile,playerId:hero.id,character:hero,regularCharacter:hidden?null:hero,active:true,adminActive:hidden};
     return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(result())});
    }
    if(['GET','HEAD','OPTIONS'].includes(route.request().method())) return route.continue();
    blocked.push(path);return route.abort();
   });
   const page=await context.newPage(); page.on('pageerror',e=>errors.push(e.message));
   await page.goto(origin+(admin?'/play?seventh=1':'/play'),{waitUntil:'domcontentloaded'});
   const intro=page.getByRole('dialog',{name:'The Six at the Last Gate'});
   await expect(intro).toBeVisible();
   await expect(intro.getByTestId('intro-hero')).toHaveCount(6);
   await intro.getByRole('button',{name:'Next scene',exact:true}).click();
   if(!admin) await page.screenshot({path:output+'/'+name+'-intro.png',fullPage:true});
   await intro.getByRole('button',{name:'Skip intro',exact:true}).click();
   if(admin) {
    await expect(page.getByRole('heading',{name:'The Unnamed',exact:true})).toBeVisible();
    await expect(page.locator('.character-card')).toContainText('Draconian Death Knight');
    await expect(page.locator('.character-card')).toContainText('???');
    await expect(page.locator('.character-card')).toContainText('Invulnerable');
    await expect(page.getByRole('region',{name:'Character lore and equipment'})).toContainText('SSS');
    await expect(page.locator('.party-slot.occupied')).toHaveCount(6);
    await expect(page.getByRole('region',{name:'Class skills'}).getByRole('button',{name:'Soul Reap',exact:true})).toBeVisible();
   } else {
    for(const calling of ['Bard','Cleric','Wizard','Sorcerer','Monk']) await expect(page.getByRole('button',{name:calling,exact:true})).toBeVisible();
    await expect(page.getByRole('button',{name:'Death Knight',exact:true})).toHaveCount(0);
    await expect(page.getByRole('button',{name:'Enter as the Seventh',exact:true})).toHaveCount(0);
    await page.getByRole('button',{name:'Wizard',exact:true}).click();
    await expect(page.getByRole('region',{name:'Wizard calling'})).toContainText('Starfall Collegium');
    await page.getByLabel('Adventurer name',{exact:true}).fill('RuneVisitor');
    await page.getByRole('button',{name:'Enter the glade',exact:true}).click();
    await expect(page.getByRole('heading',{name:'RuneVisitor',exact:true})).toBeVisible();
    await expect(page.getByRole('region',{name:'Class skills'}).getByRole('button',{name:'Runic Ward',exact:true})).toBeVisible();
   }
   const equipment=page.getByRole('region',{name:'Character lore and equipment'}).getByRole('list',{name:'Equipped items'});
   await expect(equipment.getByRole('listitem')).toHaveCount(3);
   const canvas=page.locator('canvas'); await expect(canvas).toBeVisible();
   await canvas.scrollIntoViewIfNeeded();
   await page.screenshot({path:output+'/'+name+(admin?'-seventh':'-wizard')+'.png',fullPage:true});
   const graphic=await canvas.evaluate(c=>({width:c.width,height:c.height,pixel:c.getContext('2d').getImageData(Math.floor(c.width/2),Math.floor(c.height/2),1,1).data[3]}));
   expect(graphic.width).toBeGreaterThanOrEqual(960);expect(graphic.pixel).toBe(255);
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
   expect(blocked).toEqual([]);expect(errors).toEqual([]);
   results.push({viewport:name,mode:admin?'seventh UI fixture':'customer UI fixture',publicAccountGates:'passed',introSixHeroes:'passed',classesSkillsEquipment:'passed',graphics:'passed',commit});
   await context.close();
  }
 }
 const report={publicVerification:'passed',productionAccountsCreated:0,productionGameWrites:0,privateUi:'verified using intercepted fixture responses; authorization and combat verified by isolated integration tests',results};
 await writeFile(output+'/result.json',JSON.stringify(report,null,2)+'\n'); console.log(JSON.stringify(report));
} finally {await browser.close();}
