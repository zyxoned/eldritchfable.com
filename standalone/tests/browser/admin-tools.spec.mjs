import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { openDatabase } from '../../server/database.mjs';

const ORIGIN = 'http://127.0.0.1:4317';
const PASSWORD = 'private-tools-browser-passphrase-2026';

async function account(page, testInfo, suffix, admin = false) {
  const email = 'admin-tools-' + suffix + '-' + testInfo.project.name + '@example.test';
  const registered = await page.request.post('/api/auth/register', {
    headers: { Origin: ORIGIN }, data: { email, password: PASSWORD },
  });
  expect(registered.status()).toBe(202);
  const db = openDatabase(process.env.ELDRITCH_BROWSER_DB);
  let token, id;
  try {
    const mail = db.prepare("SELECT payload_json FROM email_outbox WHERE recipient=? AND template='verify_email' ORDER BY rowid DESC LIMIT 1").get(email);
    token = JSON.parse(mail.payload_json).verification;
    id = db.prepare('SELECT id FROM account_users WHERE email=?').get(email).id;
  } finally { db.close(); }
  const verified = await page.request.post('/api/auth/verify-email', {
    headers: { Origin: ORIGIN }, data: { token },
  });
  expect(verified.status()).toBe(200);
  if (admin) {
    const configured = openDatabase(process.env.ELDRITCH_BROWSER_DB);
    try {
      configured.prepare("UPDATE account_users SET role='admin' WHERE id=?").run(id);
      configured.prepare('INSERT INTO admin_account_settings(user_id,visitor_name,testing_enabled,test_xp,test_copper,updated_at) VALUES(?,?,1,0,0,?)')
        .run(id, 'TestKeeper' + (testInfo.project.name === 'mobile' ? 'M' : 'D'), new Date().toISOString());
    } finally { configured.close(); }
  }
  return { email, id };
}

async function signIn(page, user, next = '/account') {
  await page.goto('/login?next=' + encodeURIComponent(next));
  await page.getByLabel('Email', { exact: true }).fill(user.email);
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(next + '$'));
}

async function world(page) {
  const response = await page.request.get('/api/game/world');
  expect(response.status()).toBe(200);
  return response.json();
}

async function join(page, user, testInfo, suffix = 'Hero') {
  const name = suffix + (testInfo.project.name === 'mobile' ? 'M' : 'D');
  const response = await page.request.post('/api/game/join', {
    headers: { Origin: ORIGIN },
    data: { requestId: randomUUID(), name, heroClass: 'ranger', mode: 'solo' },
  });
  expect(response.status()).toBe(200);
  return response.json();
}

async function openTools(page) {
  const trigger = page.getByRole('button', { name: 'Open admin tools', exact: true });
  await expect(trigger).toBeVisible();
  await trigger.click();
  const dialog = page.getByRole('dialog', { name: 'Admin tools', exact: true });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel('Visitor name', { exact: true })).not.toHaveValue('');
  return { trigger, dialog };
}

function ordinaryWallet(id) {
  const db = openDatabase(process.env.ELDRITCH_BROWSER_DB);
  try {
    const wallet = db.prepare('SELECT balance_xp,lifetime_xp,balance_copper FROM game_wallets WHERE user_id=?').get(id);
    const ledger = db.prepare('SELECT COUNT(*) AS n FROM game_ledger WHERE user_id=?').get(id).n;
    return { ...wallet, ledger };
  } finally { db.close(); }
}

test('private admin tools are absent for anonymous visitors and ordinary accounts', async ({ page }, testInfo) => {
  expect((await page.request.get('/api/admin/overview')).status()).toBe(401);
  await page.goto('/register');
  await expect(page.getByRole('button', { name: 'Open admin tools', exact: true })).toHaveCount(0);
  const user = await account(page, testInfo, 'customer');
  await signIn(page, user);
  await expect(page.getByRole('button', { name: 'Open admin tools', exact: true })).toHaveCount(0);
  expect((await page.request.get('/api/admin/overview')).status()).toBe(403);
  await page.goto('/admin');
  await expect(page.getByRole('heading', { name: 'Access denied', exact: true })).toBeVisible();
  await expect(page.getByRole('dialog', { name: 'Admin tools', exact: true })).toHaveCount(0);
});

test('an admin can name a visitor and repeatedly test resources without changing ordinary funds', async ({ page }, testInfo) => {
  test.setTimeout(60000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const user = await account(page, testInfo, 'wallet', true);
  await signIn(page, user);
  await join(page, user, testInfo, 'WalletHero');
  const db = openDatabase(process.env.ELDRITCH_BROWSER_DB);
  try {
    db.prepare('UPDATE game_wallets SET balance_xp=1250,lifetime_xp=2500,balance_copper=750 WHERE user_id=?').run(user.id);
  } finally { db.close(); }
  const before = ordinaryWallet(user.id);
  let { trigger, dialog } = await openTools(page);
  const renamed = 'NightKeeper' + (testInfo.project.name === 'mobile' ? 'M' : 'D');
  await expect(dialog.getByRole('button', { name: 'Close admin tools', exact: true })).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  expect(await dialog.evaluate(element => element.contains(document.activeElement))).toBeTruthy();
  await page.keyboard.press('Tab');
  expect(await dialog.evaluate(element => element.contains(document.activeElement))).toBeTruthy();
  await dialog.getByLabel('Visitor name', { exact: true }).fill(renamed);
  await dialog.getByRole('button', { name: 'Save visitor name', exact: true }).click();
  await expect(dialog.getByRole('button', { name: 'Save visitor name', exact: true })).toBeDisabled();

  // Lose the first response after the server commits. Retrying must reuse its
  // receipt instead of granting a second amount.
  const requestIds = [];
  let loseFirst = true;
  await page.route('**/api/admin/testing/grant', async route => {
    requestIds.push(route.request().postDataJSON().requestId);
    if (loseFirst) {
      loseFirst = false;
      const response = await route.fetch();
      expect(response.status()).toBe(200);
      await route.abort('failed');
    } else await route.continue();
  });
  await dialog.getByLabel('Grant amount', { exact: true }).fill('10000');
  await dialog.getByRole('button', { name: 'Grant test resources', exact: true }).click();
  await expect(dialog.getByRole('button', { name: 'Retry pending change', exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: 'Retry pending change', exact: true }).click();
  await expect(dialog.getByTestId('admin-test-xp')).toHaveText('10,000');
  expect(requestIds).toHaveLength(2);
  expect(requestIds[1]).toBe(requestIds[0]);
  await page.unroute('**/api/admin/testing/grant');
  const audited = openDatabase(process.env.ELDRITCH_BROWSER_DB);
  try {
    expect(audited.prepare("SELECT COUNT(*) AS n FROM admin_audit WHERE user_id=? AND action='test_grant'").get(user.id).n).toBe(1);
  } finally { audited.close(); }

  await dialog.getByLabel('Grant amount', { exact: true }).fill('0');
  await dialog.getByRole('button', { name: 'Grant test resources', exact: true }).click();
  await expect(dialog.getByRole('alert')).toBeVisible();
  await expect(dialog.getByTestId('admin-test-xp')).toHaveText('10,000');
  await dialog.getByRole('combobox', { name: 'Test resource', exact: true }).selectOption('GOLD');
  await dialog.getByLabel('Grant amount', { exact: true }).fill('500');
  await dialog.getByRole('button', { name: 'Grant test resources', exact: true }).click();
  await expect(dialog.getByTestId('admin-test-gold')).toHaveText('500');
  await dialog.getByLabel('Exchange lots', { exact: true }).fill('2');
  await dialog.getByRole('button', { name: 'Exchange test XP', exact: true }).click();
  await expect(dialog.getByTestId('admin-test-xp')).toHaveText('7,500');
  await expect(dialog.getByTestId('admin-test-gold')).toHaveText('502');
  expect(ordinaryWallet(user.id)).toEqual(before);
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
  await page.reload();
  ({ trigger, dialog } = await openTools(page));
  await expect(dialog.getByLabel('Visitor name', { exact: true })).toHaveValue(renamed);
  await expect(dialog.getByTestId('admin-test-xp')).toHaveText('7,500');
  await expect(dialog.getByTestId('admin-test-gold')).toHaveText('502');
  await dialog.getByRole('button', { name: 'Reset test balances…', exact: true }).click();
  await dialog.getByRole('button', { name: 'Keep test balances', exact: true }).click();
  await expect(dialog.getByTestId('admin-test-xp')).toHaveText('7,500');
  await dialog.getByRole('button', { name: 'Reset test balances…', exact: true }).click();
  await dialog.getByRole('button', { name: 'Clear test balances', exact: true }).click();
  await expect(dialog.getByTestId('admin-test-xp')).toHaveText('0');
  await expect(dialog.getByTestId('admin-test-gold')).toHaveText('0');
  expect(ordinaryWallet(user.id)).toEqual(before);
  expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth)).toBeTruthy();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  expect(errors).toEqual([]);
});

test('the admin drawer isolates game controls and restores movement on close', async ({ page }, testInfo) => {
  const user = await account(page, testInfo, 'controls', true);
  await signIn(page, user, '/play');
  const intro = page.getByRole('dialog', { name: 'The Six at the Last Gate', exact: true });
  await expect(intro).toBeVisible();
  await intro.getByRole('button', { name: 'Skip intro', exact: true }).click();
  await join(page, user, testInfo, 'PanelHero');
  await page.reload();
  const original = await world(page);
  await expect(page.locator('.attack-button')).toBeEnabled();
  const { dialog } = await openTools(page);
  await expect(page.locator('.attack-button')).toBeDisabled();
  await expect(page.getByLabel('Party message', { exact: true })).toBeDisabled();
  const actions = [];
  const record = request => {
    if (request.url().endsWith('/api/game/action') && request.method() === 'POST') actions.push(request);
  };
  page.on('request', record);
  await dialog.getByRole('button', { name: 'Close admin tools', exact: true }).focus();
  await page.keyboard.press('ArrowRight');
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(resolve)));
  await expect(dialog).toBeVisible();
  expect(actions).toHaveLength(0);
  const paused = await world(page);
  expect(paused.profile.character.x).toBe(original.profile.character.x);
  expect(paused.profile.character.y).toBe(original.profile.character.y);
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(page.locator('.attack-button')).toBeEnabled();
  const movement = page.waitForResponse(response => response.url().endsWith('/api/game/action') && response.request().postDataJSON()?.kind === 'move');
  if (testInfo.project.name === 'mobile') await page.getByRole('button', { name: 'Move east', exact: true }).click();
  else await page.keyboard.press('ArrowRight');
  const moved = await movement;
  expect(moved.status()).toBe(200);
  expect((await moved.json()).profile.character.x).not.toBe(original.profile.character.x);
  page.off('request', record);
});

test('cross-tab logout and current-role revocation close the private drawer', async ({ page }, testInfo) => {
  const user = await account(page, testInfo, 'authority', true);
  await signIn(page, user, '/play');
  const intro = page.getByRole('dialog', { name: 'The Six at the Last Gate', exact: true });
  await expect(intro).toBeVisible();
  await intro.getByRole('button', { name: 'Skip intro', exact: true }).click();
  await join(page, user, testInfo, 'AuthHero');
  await page.reload();
  await expect(page.locator('.attack-button')).toBeEnabled();
  let { dialog } = await openTools(page);
  const remote = await page.context().newPage();
  try {
    const loggedOut = await remote.request.post('/api/auth/logout', { headers: { Origin: ORIGIN }, data: {} });
    expect(loggedOut.status()).toBe(200);
    await page.bringToFront();
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await expect(dialog).not.toBeVisible();
    await expect(page.getByRole('button', { name: 'Open admin tools', exact: true })).toHaveCount(0);
    expect((await page.request.get('/api/admin/overview')).status()).toBe(401);
    await signIn(page, user, '/play');
    await expect(page.locator('.attack-button')).toBeEnabled();
    ({ dialog } = await openTools(page));
    const db = openDatabase(process.env.ELDRITCH_BROWSER_DB);
    try { db.prepare("UPDATE account_users SET role='customer' WHERE id=?").run(user.id); }
    finally { db.close(); }
    await dialog.getByRole('button', { name: 'Refresh admin analytics', exact: true }).click();
    await expect(dialog).not.toBeVisible();
    await expect(page.getByRole('button', { name: 'Open admin tools', exact: true })).toHaveCount(0);
    expect((await page.request.get('/api/admin/overview')).status()).toBe(403);
    await expect(page.locator('.attack-button')).toBeEnabled();
  } finally { await remote.close(); }
});


test('an older analytics reply cannot replace a newer test balance or audit', async ({ page }, testInfo) => {
  const user = await account(page, testInfo, 'stale-overview', true);
  await signIn(page, user);
  const { dialog } = await openTools(page);
  await expect(dialog.getByTestId('admin-test-xp')).toHaveText('0');
  let releaseOld, sawOld;
  const held = new Promise(resolve => { releaseOld = resolve; });
  const captured = new Promise(resolve => { sawOld = resolve; });
  let holdNext = true;
  await page.route('**/api/admin/overview', async route => {
    if (holdNext) {
      holdNext = false;
      const response = await route.fetch();
      expect((await response.json()).profile.testXp).toBe(0);
      sawOld();
      await held;
      await route.fulfill({ response });
    } else await route.continue();
  });
  const oldReply = page.waitForResponse(async response => {
    if (!response.url().endsWith('/api/admin/overview') || response.status() !== 200) return false;
    return (await response.json()).profile.testXp === 0;
  });
  try {
    await dialog.getByRole('button', { name: 'Refresh admin analytics', exact: true }).click();
    await captured;
    const currentReply = page.waitForResponse(async response => {
      if (!response.url().endsWith('/api/admin/overview') || response.status() !== 200) return false;
      return (await response.json()).profile.testXp === 1250;
    });
    await dialog.getByLabel('Grant amount', { exact: true }).fill('1250');
    await dialog.getByRole('button', { name: 'Grant test resources', exact: true }).click();
    await currentReply;
    await expect(dialog.getByTestId('admin-test-xp')).toHaveText('1,250');
    await expect(dialog.locator('.admin-tools-audit li')).toHaveCount(1);
    releaseOld();
    await oldReply;
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(resolve)));
    await expect(dialog.getByTestId('admin-test-xp')).toHaveText('1,250');
    await expect(dialog.locator('.admin-tools-audit li')).toHaveCount(1);
  } finally {
    releaseOld();
    await page.unroute('**/api/admin/overview');
  }
});
