import { chromium, expect } from '/srv/eldritch-staging/rpg-release-7c5068bdb17b/standalone/node_modules/@playwright/test/index.mjs';
import { mkdir, writeFile } from 'node:fs/promises';

const expectedCommit = process.argv[2];
if (!/^[a-f0-9]{40}$/.test(expectedCommit || '')) throw Error('Expected release commit required');
const origin = 'https://eldritchfable.com';
const output = '/srv/eldritch-staging/audits/adventure-welcome-' + expectedCommit.slice(0,12);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const results = [];
try {
  for (const mobile of [false, true]) {
    const name = mobile ? 'mobile' : 'desktop';
    const context = await browser.newContext({ viewport: mobile ? {width:390,height:844} : {width:1280,height:900}, isMobile:mobile, hasTouch:mobile, serviceWorkers:'block' });
    let interceptedSignups = 0;
    const blockedWrites = [];
    await context.route('**/api/**', async route => {
      const request = route.request();
      if (['GET','HEAD','OPTIONS'].includes(request.method())) return route.continue();
      if (new URL(request.url()).pathname === '/api/auth/register') {
        interceptedSignups++;
        return route.fulfill({status:200, contentType:'application/json', body:JSON.stringify({message:'Check your inbox for your verification link.'})});
      }
      blockedWrites.push(new URL(request.url()).pathname);
      return route.abort();
    });
    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'clipboard', {configurable:true,value:{writeText:async value => {window.copiedInvite=value;}}});
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const response = await page.goto(origin + '/register', {waitUntil:'domcontentloaded'});
    expect(response.status()).toBe(200);
    const manifest = await (await context.request.get(origin + '/frontend-release.json?welcome=' + expectedCommit)).json();
    expect(manifest.frontendCommit).toBe(expectedCommit);
    expect(response.headers()['x-eldritch-frontend-release']).toBe(manifest.releaseId);
    await page.getByRole('button', {name:'Discover your adventure'}).click();
    const dialog = page.getByRole('dialog', {name:'Your adventure keeps going.'});
    await expect(dialog).toBeVisible();
    for (const text of ['persistent character linked to your account','up to six adventurers','Be sure to invite your friends!','1,250 XP = 1 gold = 100 silver = 1,000 copper.','1 gold is worth 1 penny.','Buying shop gear with coins and unlocking abilities are coming soon.']) await expect(dialog).toContainText(text);
    const close = dialog.getByRole('button', {name:'Close adventure welcome'});
    const done = dialog.getByRole('button', {name:'Got it',exact:true});
    await expect(close).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(done).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(close).toBeFocused();
    await dialog.getByRole('button',{name:'Copy invite link'}).click();
    await expect(dialog.getByRole('status')).toContainText('Invite link copied.');
    expect(await page.evaluate(()=>window.copiedInvite)).toBe(origin+'/play');
    await page.screenshot({path:output+'/'+name+'.png'});
    if(mobile) await page.setViewportSize({width:320,height:568});
    await done.scrollIntoViewIfNeeded();
    await expect(done).toBeInViewport();
    expect(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
    await expect(page.getByRole('button',{name:'Discover your adventure'})).toBeFocused();
    await page.getByLabel('Email',{exact:true}).fill('ui-only-preview@example.test');
    await page.getByLabel('Password',{exact:true}).fill('ui-preview-passphrase-never-sent');
    await page.getByLabel('Confirm password',{exact:true}).fill('ui-preview-passphrase-never-sent');
    await page.getByRole('button',{name:'Create account',exact:true}).click();
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button',{name:'Got it — check my inbox'}).click();
    await expect(page.getByRole('heading',{name:'Check your inbox'})).toBeVisible();
    expect(interceptedSignups).toBe(1);
    expect(blockedWrites).toEqual([]);
    expect(errors).toEqual([]);
    results.push({viewport:name,popupPreview:'passed',postSignupPopup:'passed (registration response mocked; no account created)',keyboardAndMobile:'passed',invite:'passed',commit:manifest.frontendCommit});
    await context.close();
  }
  const report = {publicVerification:'passed',productionAccountsCreated:0,results};
  await writeFile(output+'/result.json',JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report));
} finally {await browser.close();}
