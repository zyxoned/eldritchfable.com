import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { openDatabase } from '../../server/database.mjs';

test('adventure and stash require the existing site account', async ({ page }) => {
  await page.goto('/play');
  await expect(page.getByRole('heading', { name: 'Every legend needs a name.' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Sign in to Eldritch Fable' })).toHaveAttribute('href', '/login?next=%2Fplay');
  const denied = await page.request.get('/api/game/stash');
  expect(denied.status()).toBe(401);
  await page.goto('/stash');
  await expect(page.getByRole('heading', { name: 'Your treasures are yours alone.' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Exchange XP', exact: true })).toHaveCount(0);
});

test('a verified adventurer earns private XP, exchanges it, and keeps progress after leaving', async ({ page }, testInfo) => {
  const email = 'adventure-' + testInfo.project.name + '@example.test';
  const password = 'a-browser-adventure-passphrase-2026';
  const name = testInfo.project.name === 'mobile' ? 'TouchRanger' : 'GoldRanger';
  await page.goto('/register?next=%2Fplay');
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByLabel('Confirm password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await page.getByRole('button', { name: 'Got it — check my inbox' }).click();
  await expect(page.getByRole('heading', { name: 'Check your inbox' })).toBeVisible();

  const db = openDatabase(process.env.ELDRITCH_BROWSER_DB);
  let token;
  try {
    const mail = db.prepare("SELECT payload_json FROM email_outbox WHERE recipient=? AND template='verify_email' ORDER BY rowid DESC LIMIT 1").get(email);
    token = JSON.parse(mail.payload_json).verification;
  } finally { db.close(); }
  await page.goto('/verify-email?token=' + token);
  await page.getByRole('button', { name: 'Verify email', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Email verified' })).toBeVisible();
  await page.goto('/login?next=%2Fplay');
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/play$/);

  await page.getByLabel('Adventurer name', { exact: true }).fill(name);
  await page.getByRole('button', { name: 'Ranger', exact: true }).click();
  await page.getByRole('button', { name: 'Enter the glade', exact: true }).click();
  await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
  if (testInfo.project.name === 'mobile') {
    await page.getByRole('button', { name: 'Move east', exact: true }).click();
    await expect(page.locator('.map-caption')).toContainText('11, 13');
  }
  // Exercise transient server pacing deterministically: the selected route
  // must continue after a rejected step, rather than stopping after one tile.
  let pacedSteps = 0;
  await page.route('**/api/game/action', route => {
    if (route.request().postDataJSON()?.kind === 'move' && pacedSteps === 0) {
      pacedSteps++;
      return route.fulfill({ status: 429, contentType: 'application/json', body: JSON.stringify({ code: 'MOVE_COOLDOWN', error: 'Wait a moment before moving again.' }) });
    }
    return route.continue();
  });
  await page.getByRole('button', { name: /Clear thornlings/ }).click();
  await expect(page.locator('.map-caption')).toContainText(/17, 8|21, 13|13, 5|26, 10/, { timeout: 15000 });
  expect(pacedSteps).toBe(1);
  await expect(async () => {
    await page.getByRole('button', { name: 'Attack', exact: true }).click();
    await expect(page.getByRole('status')).toContainText('15 XP', { timeout: 400 });
  }).toPass({ intervals: [800], timeout: 8000 });
  await page.getByRole('link', { name: 'Secret Stash', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Your private XP balance' })).toContainText('15 XP');
  await expect(page.getByRole('button', { name: 'Exchange XP', exact: true })).toBeDisabled();

  // Seed a full conversion lot only in the isolated browser-test database.
  // Production exposes no wallet funding endpoint or client-controlled XP value.
  const fixture = openDatabase(process.env.ELDRITCH_BROWSER_DB);
  try {
    fixture.exec('BEGIN IMMEDIATE');
    const user = fixture.prepare('SELECT id FROM account_users WHERE email=?').get(email);
    fixture.prepare('UPDATE game_wallets SET balance_xp=1250,lifetime_xp=1250 WHERE user_id=?').run(user.id);
    fixture.prepare('INSERT INTO game_ledger(id,user_id,event_key,currency,delta,balance_after,reason,created_at) VALUES(?,?,?,?,?,?,?,?)')
      .run(randomUUID(), user.id, 'browser-fixture', 'XP', 1235, 1250, 'Isolated browser reward fixture', new Date().toISOString());
    fixture.exec('COMMIT');
  } finally { fixture.close(); }
  await page.reload();
  const balance = page.getByRole('region', { name: 'Your private XP balance' });
  await expect(balance).toContainText('1,250 XP');
  await page.getByRole('button', { name: 'Exchange XP', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Keep my XP', exact: true })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(balance).toContainText('1,250 XP');
  await page.getByRole('button', { name: 'Exchange XP', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm exchange', exact: true }).click();
  await expect(balance.locator('strong')).toHaveText('0 XP');
  await expect(balance).toContainText('1,250 lifetime XP');
  await expect(page.getByRole('region', { name: 'Your saved coins' })).toContainText('1GOLD');
  await expect(page.getByText('Gear redemption is not open yet', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('region', { name: 'Your saved coins' })).toContainText('1GOLD');
  await page.getByRole('link', { name: 'Return to the realm' }).click();
  await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Leave realm', exact: true }).click();
  await page.getByRole('button', { name: 'Leave adventure', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Enter the glade', exact: true })).toBeVisible();
  await page.goto('/stash');
  await expect(page.getByRole('region', { name: 'Your saved coins' })).toContainText('1GOLD');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
});