import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { openDatabase } from '../../server/database.mjs';
import { CLASS_CATALOG } from '../../shared/class-catalog.mjs';

const ORIGIN = 'http://127.0.0.1:4317';
const PASSWORD = 'the-expansion-test-passphrase-2026';

async function createVerifiedAccount(page, testInfo, suffix) {
  const email = 'expansion-' + suffix + '-' + testInfo.project.name + '@example.test';
  const registered = await page.request.post('/api/auth/register', {
    headers: { Origin: ORIGIN }, data: { email, password: PASSWORD },
  });
  expect(registered.status()).toBe(202);
  const db = openDatabase(process.env.ELDRITCH_BROWSER_DB);
  let token, userId;
  try {
    const mail = db.prepare("SELECT payload_json FROM email_outbox WHERE recipient=? AND template='verify_email' ORDER BY rowid DESC LIMIT 1").get(email);
    token = JSON.parse(mail.payload_json).verification;
    userId = db.prepare('SELECT id FROM account_users WHERE email=?').get(email).id;
  } finally { db.close(); }
  const verified = await page.request.post('/api/auth/verify-email', {
    headers: { Origin: ORIGIN }, data: { token },
  });
  expect(verified.status()).toBe(200);
  return { email, userId };
}

async function signIn(page, account, next = '/play') {
  await page.goto('/login?next=' + encodeURIComponent(next));
  await page.getByLabel('Email', { exact: true }).fill(account.email);
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(next.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$'));
}

async function skipIntro(page) {
  const intro = page.getByRole('dialog', { name: 'The Six at the Last Gate' });
  await expect(intro).toBeVisible();
  await intro.getByRole('button', { name: 'Skip intro', exact: true }).click();
  await expect(intro).not.toBeVisible();
}

async function currentWorld(page) {
  const response = await page.request.get('/api/game/world');
  expect(response.status()).toBe(200);
  return response.json();
}

function skillResponse(page, skillId) {
  return page.waitForResponse(response => {
    if (!response.url().endsWith('/api/game/action') || response.request().method() !== 'POST') return false;
    const body = response.request().postDataJSON();
    return body?.kind === 'skill' && body.skillId === skillId;
  });
}

test('every account sees the six mysterious heroes once and can replay or skip the same prologue', async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const account = await createVerifiedAccount(page, testInfo, 'prologue');
  await signIn(page, account);
  const intro = page.getByRole('dialog', { name: 'The Six at the Last Gate' });
  await expect(intro).toBeVisible();
  await expect(intro.getByTestId('intro-hero')).toHaveCount(6);
  await expect(intro.getByRole('button', { name: 'Skip intro', exact: true })).toBeVisible();
  await intro.getByRole('button', { name: 'Next scene', exact: true }).click();
  await page.screenshot({ path: testInfo.outputPath('intro-battle.png'), fullPage: true });
  await intro.getByRole('button', { name: 'Next scene', exact: true }).click();
  await expect(intro).toContainText('Hollow King');
  await intro.getByRole('button', { name: 'Enter the story', exact: true }).click();
  await expect(intro).not.toBeVisible();
  await expect(page.getByLabel('Adventurer name', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Watch the prologue', exact: true })).toBeVisible();
  await expect(intro).not.toBeVisible();
  await page.getByRole('button', { name: 'Watch the prologue', exact: true }).click();
  await expect(intro).toBeVisible();
  await expect(intro.getByTestId('intro-hero')).toHaveCount(6);
  await expect(intro.getByRole('button', { name: 'Next scene', exact: true })).toBeVisible();
  await intro.getByRole('button', { name: 'Skip intro', exact: true }).click();
  await expect(intro).not.toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
});

test('new class callings show their lore and loadout, and a Wizard skill keeps its cooldown after reload', async ({ page }, testInfo) => {
  const account = await createVerifiedAccount(page, testInfo, 'wizard');
  await signIn(page, account);
  await skipIntro(page);
  for (const calling of ['Bard', 'Cleric', 'Wizard', 'Sorcerer', 'Monk']) {
    await expect(page.getByRole('button', { name: calling, exact: true })).toBeVisible();
  }
  await expect(page.getByRole('button', { name: 'Death Knight', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Enter as the Seventh', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Wizard', exact: true }).click();
  const calling = page.getByRole('region', { name: 'Wizard calling' });
  await expect(calling).toBeVisible();
  await expect(calling.locator('.calling-lore')).toBeVisible();
  await expect(calling.locator('.calling-lore')).not.toHaveText('');
  await calling.getByText('Starting equipment · 3 items', { exact: true }).click();
  await expect(calling.getByRole('list', { name: 'Equipped items' }).getByRole('listitem')).toHaveCount(3);
  const name = testInfo.project.name === 'mobile' ? 'TouchWizard' : 'RuneWizard';
  await page.getByLabel('Adventurer name', { exact: true }).fill(name);
  await page.getByRole('button', { name: 'Enter the glade', exact: true }).click();
  await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
  const details = page.getByRole('region', { name: 'Character lore and equipment' });
  await expect(details.getByRole('list', { name: 'Equipped items' }).getByRole('listitem')).toHaveCount(3);
  const skills = page.getByRole('region', { name: 'Class skills' });
  const ward = CLASS_CATALOG.wizard.skills.find(skill => skill.type === 'ward');
  expect(ward).toBeTruthy();
  const wardButton = skills.getByRole('button', { name: ward.name, exact: true });
  const cast = skillResponse(page, ward.id);
  await wardButton.click();
  const response = await cast;
  expect(response.status()).toBe(200);
  const result = await response.json();
  expect(result.profile.cooldowns[ward.id]).toBeGreaterThan(result.realm.serverTime);
  await expect(wardButton).toBeDisabled();
  await page.screenshot({ path: testInfo.outputPath('wizard.png'), fullPage: true });
  const readyAt = result.profile.cooldowns[ward.id];
  await page.reload();
  await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Class skills' }).getByRole('button', { name: ward.name, exact: true })).toBeDisabled();
  const restored = await currentWorld(page);
  expect(restored.profile.cooldowns[ward.id]).toBe(readyAt);
  await page.getByRole('button', { name: 'Leave realm', exact: true }).click();
  await page.getByRole('button', { name: 'Leave adventure', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Enter the glade', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
});

test('only a verified administrator can enter as the seventh Draconian Death Knight and reap without earning shop XP', async ({ page }, testInfo) => {
  const account = await createVerifiedAccount(page, testInfo, 'seventh');
  await signIn(page, account);
  await skipIntro(page);
  await expect(page.getByRole('button', { name: 'Enter as the Seventh', exact: true })).toHaveCount(0);
  const denied = await page.request.post('/api/game/admin/join', {
    headers: { Origin: ORIGIN }, data: { requestId: randomUUID() },
  });
  expect(denied.status()).toBe(403);

  // Grant the role only inside this isolated browser-test database. No public
  // endpoint lets a customer change role, class, equipment, or combat damage.
  const db = openDatabase(process.env.ELDRITCH_BROWSER_DB);
  try { db.prepare("UPDATE account_users SET role='admin' WHERE id=?").run(account.userId); }
  finally { db.close(); }
  const before = await currentWorld(page);
  await page.goto('/account');
  await page.getByRole('link', { name: 'Enter as the Seventh', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'The Unnamed', exact: true })).toBeVisible();
  await expect(page.locator('.character-card')).toContainText('Draconian Death Knight');
  await expect(page.locator('.character-card')).toContainText('???');
  await expect(page.locator('.character-card')).toContainText('Invulnerable');
  const equipment = page.getByRole('region', { name: 'Character lore and equipment' }).getByRole('list', { name: 'Equipped items' });
  await expect(equipment.getByRole('listitem')).toHaveCount(3);
  await expect(equipment).toContainText('SSS');
  const arrived = await currentWorld(page);
  expect(arrived.realm.players.length).toBe(before.realm.players.length);
  expect(arrived.realm.seventh.heroClass).toBe('death-knight');
  expect(arrived.realm.seventh.race).toBe('Draconian');
  expect(arrived.realm.seventh.levelLabel).toBe('???');
  await page.screenshot({ path: testInfo.outputPath('seventh.png'), fullPage: true });

  await page.getByRole('button', { name: /Clear thornlings/ }).click();
  await expect(page.locator('.map-caption')).toContainText(/17, 8|21, 13|13, 5|26, 10/, { timeout: 15000 });
  const nearby = await currentWorld(page);
  const me = nearby.realm.seventh;
  const nearest = nearby.realm.enemies.filter(enemy => enemy.hp > 0 && Math.hypot(enemy.x - me.x, enemy.y - me.y) <= 6)
    .sort((a, b) => Math.hypot(a.x - me.x, a.y - me.y) - Math.hypot(b.x - me.x, b.y - me.y))[0];
  expect(nearest).toBeTruthy();
  const reap = skillResponse(page, 'soul-reap');
  await page.getByRole('region', { name: 'Class skills' }).getByRole('button', { name: 'Soul Reap', exact: true }).click();
  const reaped = await reap;
  expect(reaped.status()).toBe(200);
  const result = await reaped.json();
  expect(result.realm.enemies.find(enemy => enemy.id === nearest.id).hp).toBe(0);
  expect(result.profile.character.hp).toBe(100);
  expect(result.profile.balanceXp).toBe(before.profile.balanceXp);
  expect(result.profile.lifetimeXp).toBe(before.profile.lifetimeXp);
  await page.getByRole('button', { name: 'Leave as the Seventh', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'The Unnamed', exact: true })).toHaveCount(0);
  const departed = await currentWorld(page);
  expect(departed.realm.seventh).toBeNull();
});
