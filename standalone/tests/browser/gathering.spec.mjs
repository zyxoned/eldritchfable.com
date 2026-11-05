import { test, expect } from '@playwright/test';
import { randomUUID, randomBytes, createHash, scryptSync } from 'node:crypto';
import { openDatabase } from '../../server/database.mjs';

async function syntheticSession(context, prefix) {
  const id = randomUUID(), token = randomBytes(32).toString('hex'), salt = randomBytes(16);
  const db = openDatabase(process.env.ELDRITCH_BROWSER_DB);
  try {
    const hash = 'scrypt$' + salt.toString('hex') + '$' + scryptSync('synthetic-gathering-passphrase', salt, 64).toString('hex');
    db.prepare('INSERT INTO account_users(id,email,password_hash,role,email_verified_at) VALUES(?,?,?,?,?)').run(id, prefix + '-' + id + '@example.test', hash, 'customer', new Date().toISOString());
    db.prepare('INSERT INTO account_sessions(token_hash,user_id,expires_at) VALUES(?,?,?)').run(createHash('sha256').update(token).digest('hex'), id, new Date(Date.now()+3600000).toISOString());
  } finally { db.close(); }
  await context.addCookies([{ name:'ef_session', value:token, url:'http://127.0.0.1:4317', httpOnly:true, sameSite:'Lax' }]);
  return id;
}

test('gathering walks to physical grounds, saves skill progress and never auto-farms', async ({ page, browser }, info) => {
  test.setTimeout(60000);
  const id = await syntheticSession(page.context(), 'gathering');
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  let gathers = 0;
  page.on('request', request => {
    if (request.url().endsWith('/api/game/action') && request.method() === 'POST' && request.postDataJSON()?.kind === 'gatherResource') gathers++;
  });
  await page.goto('/play');
  await page.getByRole('button', { name:'Skip intro', exact:true }).click();
  await page.getByLabel('Adventurer name', { exact:true }).fill('Herb' + id.slice(0, 8));
  await page.getByLabel('Solo adventure', { exact:true }).check();
  await page.getByRole('button', { name:'Enter the glade', exact:true }).click();
  const panel = page.getByRole('region', { name:'Wilderness skills', exact:true });
  await expect(panel).toBeVisible();
  await expect(panel.getByRole('progressbar')).toHaveCount(3);
  await expect(panel.getByRole('progressbar', { name:'Foraging progress to next level' })).toHaveAttribute('value', '0');
  const before = await (await page.request.get('/api/game/world')).json();
  await panel.getByRole('button', { name:'Walk to Dewleaf patch', exact:true }).click();
  const gather = panel.getByRole('button', { name:'Gather Dewleaf patch', exact:true });
  await expect(gather).toBeEnabled({ timeout:10000 });
  // Actual server gather: the UI only presents XP after its reply arrives.
  const reply = page.waitForResponse(response => response.url().endsWith('/api/game/action') && response.request().postDataJSON()?.kind === 'gatherResource');
  await gather.click();
  const gathered = await (await reply).json();
  expect(gathered.profile.gathering.skills.find(skill => skill.id === 'foraging').xp).toBe(12);
  expect(gathered.profile.balanceXp).toBe(before.profile.balanceXp);
  expect(gathered.profile.balanceCopper).toBe(before.profile.balanceCopper);
  expect(gathered.profile.lifetimeXp).toBe(before.profile.lifetimeXp);
  await expect(panel.getByRole('progressbar', { name:'Foraging progress to next level' })).toHaveAttribute('value', '12');
  await expect(gather).toBeDisabled();
  await expect(panel.getByText(/Regrows in/)).toBeVisible();
  await panel.getByText('Materials pouch', { exact:false }).click();
  await expect(panel.locator('.gathering-pack li').filter({ hasText:'Dewleaf' })).toContainText('1');
  await expect(panel.getByRole('button', { name:'Use Dewleaf to restore up to 8 health', exact:true })).toBeDisabled();
  expect(gathers).toBe(1);
  await page.reload();
  await expect(panel).toBeVisible();
  await expect(panel.getByRole('progressbar', { name:'Foraging progress to next level' })).toHaveAttribute('value', '12');
  await expect(panel.getByRole('button', { name:'Gather Dewleaf patch', exact:true })).toBeDisabled();
  // A new solo company has its own untouched resource despite the same public node ID.
  const isolated = await browser.newContext();
  try {
    const secondId = await syntheticSession(isolated, 'gathering-isolation');
    const join = await isolated.request.post('http://127.0.0.1:4317/api/game/join', {
      headers: { Origin:'http://127.0.0.1:4317' },
      data: { requestId:randomUUID(), name:'Ore' + secondId.slice(0, 8), heroClass:'ranger', mode:'solo' },
    });
    expect(join.ok()).toBe(true);
    const other = await join.json();
    expect(other.realm.partyId).not.toBe(gathered.realm.partyId);
    expect(other.realm.resourceNodes.find(node => node.id === 'glade:dewleaf').availableAt).toBe(0);
    expect(other.profile.gathering.skills.every(skill => skill.xp === 0)).toBe(true);
  } finally { await isolated.close(); }
  await page.emulateMedia({ reducedMotion:'reduce' });
  await page.setViewportSize({ width:320, height:720 });
  await panel.screenshot({ path:info.outputPath('gathering-320px.png') });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await expect(panel.getByRole('button', { name:'Walk to Brookstone seam', exact:true })).toBeEnabled();
  // Timers only update readiness. They never initiate a second gather.
  await page.waitForTimeout(3300);
  expect(gathers).toBe(1);
  // Damage only this disposable test hero, then exercise actual supply use through the UI.
  const db = openDatabase(process.env.ELDRITCH_BROWSER_DB);
  try { db.prepare('UPDATE game_characters SET hp=92 WHERE user_id=?').run(id); }
  finally { db.close(); }
  await page.reload();
  await expect(panel).toBeVisible();
  await panel.getByText('Materials pouch', { exact:false }).click();
  const useSupply = panel.getByRole('button', { name:'Use Dewleaf to restore up to 8 health', exact:true });
  await expect(useSupply).toBeEnabled({ timeout:5000 });
  const usedReply = page.waitForResponse(response => response.url().endsWith('/api/game/action') && response.request().postDataJSON()?.kind === 'consumeSupply');
  await useSupply.click();
  const used = await (await usedReply).json();
  expect(used.profile.character.hp).toBe(100);
  expect(used.profile.gathering.inventory.find(item => item.id === 'dewleaf')?.quantity || 0).toBe(0);
  expect(used.profile.gathering.skills.find(skill => skill.id === 'foraging').xp).toBe(12);
  expect(used.profile.balanceXp).toBe(before.profile.balanceXp);
  await expect(panel.getByRole('status')).toContainText('Supply used');
  await expect(panel.locator('.gathering-pack li').filter({ hasText:'Dewleaf' })).toHaveCount(0);
  expect(gathers).toBe(1);
  expect(errors).toEqual([]);
});

test('a rejected gathering request stays rejected without optimistic XP or retry', async ({ page }) => {
  const id = await syntheticSession(page.context(), 'gathering-rejection');
  await page.goto('/play');
  await page.getByRole('button', { name:'Skip intro', exact:true }).click();
  await page.getByLabel('Adventurer name', { exact:true }).fill('Bank' + id.slice(0, 8));
  await page.getByLabel('Solo adventure', { exact:true }).check();
  await page.getByRole('button', { name:'Enter the glade', exact:true }).click();
  const panel = page.getByRole('region', { name:'Wilderness skills', exact:true });
  await panel.getByRole('button', { name:'Walk to Dewleaf patch', exact:true }).click();
  const gather = panel.getByRole('button', { name:'Gather Dewleaf patch', exact:true });
  await expect(gather).toBeEnabled({ timeout:10000 });
  let requests = 0;
  await page.route('**/api/game/action', async route => {
    if (route.request().postDataJSON()?.kind !== 'gatherResource') return route.continue();
    requests++;
    return route.fulfill({ status:409, contentType:'application/json', body:JSON.stringify({ code:'RESOURCE_REGROWING', error:'This resource is regrowing. Try another gathering ground.' }) });
  });
  await gather.click();
  await expect(page.getByRole('alert')).toContainText('This resource is regrowing');
  await expect(panel.getByRole('progressbar', { name:'Foraging progress to next level' })).toHaveAttribute('value', '0');
  await page.waitForTimeout(600);
  expect(requests).toBe(1);
});
