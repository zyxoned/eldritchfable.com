import { test, expect } from '@playwright/test';
import { randomUUID, randomBytes, scryptSync } from 'node:crypto';
import { openDatabase } from '../../server/database.mjs';

test('Bellhouse Ravine renders in WebGL and plays through the existing Adventure API', async ({ page }, info) => {
  test.setTimeout(90000);
  const id = randomUUID(), salt = randomBytes(16);
  const email = 'bellhouse-' + id + '@example.test';
  const password = 'synthetic-bellhouse-passphrase';
  const db = openDatabase(process.env.ELDRITCH_BROWSER_DB);
  try {
    const hash = 'scrypt$' + salt.toString('hex') + '$' + scryptSync(password, salt, 64).toString('hex');
    db.prepare('INSERT INTO account_users(id,email,password_hash,role,email_verified_at) VALUES(?,?,?,?,?)')
      .run(id, email, hash, 'customer', new Date().toISOString());
  } finally { db.close(); }

  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error' && /WebGL|THREE|Shader/i.test(message.text())) errors.push(message.text());
  });
  await page.goto('/play?scene=bellhouse');
  const signIn = page.getByRole('link', { name: 'Sign in to Eldritch Fable' });
  await expect(signIn).toHaveAttribute('href', '/login?next=%2Fplay%3Fscene%3Dbellhouse');
  await signIn.click();
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/play\?scene=bellhouse$/);
  await page.getByRole('button', { name: 'Skip intro', exact: true }).click();
  await page.getByLabel('Adventurer name', { exact: true }).fill('Ravine' + id.slice(0, 8));
  await page.getByLabel('Solo adventure', { exact: true }).check();
  await page.getByRole('button', { name: 'Enter the glade', exact: true }).click();

  const stage = page.locator('.bellhouse-stage[data-ready="true"]');
  await expect(stage).toBeVisible({ timeout: 18000 });
  await expect(stage.locator('canvas[data-renderer="webgl2"]')).toBeVisible();
  await stage.screenshot({ path: info.outputPath('bellhouse-arrival.png'), timeout: 20000 });
  if (info.project.name === 'mobile') {
    const thumb = page.locator('.thumb-stick');
    await thumb.scrollIntoViewIfNeeded();
    const rect = await thumb.boundingBox();
    await page.touchscreen.tap(rect.x + rect.width - 8, rect.y + rect.height / 2);
    await expect(page.locator('.map-caption')).toContainText('11, 13');
  }
  await stage.getByRole('button', { name: 'Walk to bellhouse' }).click();
  const ring = stage.getByRole('button', { name: 'Ring the bell' });
  await expect(ring).toBeEnabled({ timeout: 15000 });
  await ring.click();
  await expect(stage).toContainText('Something answered below.');
  await stage.screenshot({ path: info.outputPath('bellhouse-rung.png'), timeout: 20000 });

  await stage.getByRole('button', { name: 'Find a thornling' }).click();
  await expect(page.locator('.map-caption')).toContainText(/17, 8|21, 13|13, 5|26, 10/, { timeout: 20000 });
  const health = await stage.getByLabel('Hero health').getAttribute('value');
  await page.getByRole('button', { name: 'Attack', exact: true }).click();
  await expect(page.locator('.game-notice')).toContainText('Thornling has');
  await expect(stage.getByLabel('Hero health')).not.toHaveAttribute('value', health);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (name, ...args) {
      return name === 'webgl2' ? null : original.call(this, name, ...args);
    };
  });
  await page.reload();
  await expect(page.getByText('This browser could not start WebGL 2.')).toBeVisible({ timeout: 12000 });
  await expect(page.locator('.map-caption')).toContainText(/17, 8|21, 13|13, 5|26, 10/);
  expect(errors).toEqual([]);
});
