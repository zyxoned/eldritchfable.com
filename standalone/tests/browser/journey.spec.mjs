import { test, expect } from '@playwright/test';
import { randomUUID, randomBytes, createHash } from 'node:crypto';
import { openDatabase } from '../../server/database.mjs';

test('earned journeys keep controls, progression and recovery coherent on screen', async ({ page }, info) => {
  test.setTimeout(90000);
  const id = randomUUID(), token = randomBytes(32).toString('hex');
  const db = openDatabase(process.env.ELDRITCH_BROWSER_DB);
  try {
    db.prepare('INSERT INTO account_users(id,email,password_hash,email_verified_at) VALUES(?,?,?,?)').run(id, 'journey-' + id + '@example.test', 'synthetic-only', new Date().toISOString());
    db.prepare('INSERT INTO account_sessions(token_hash,user_id,expires_at) VALUES(?,?,?)').run(createHash('sha256').update(token).digest('hex'), id, new Date(Date.now() + 3600000).toISOString());
  } finally { db.close(); }
  await page.context().addCookies([{ name: 'ef_session', value: token, url: 'http://127.0.0.1:4317', httpOnly: true, sameSite: 'Lax' }]);
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/play');
  await page.getByRole('button', { name: 'Skip intro', exact: true }).click();
  await page.getByLabel('Adventurer name', { exact: true }).fill('Path' + id.slice(0,8));
  await page.getByLabel('Solo adventure', { exact: true }).check();
  await page.getByRole('button', { name: 'Enter the glade', exact: true }).click();
  const journey = page.getByRole('region', { name: 'Your journey', exact: true });
  await expect(journey.getByText('Unassuming doorway 0', { exact: true })).toBeVisible();
  await expect(page.getByText('Private terminal 0', { exact: true })).toHaveCount(0);
  const entrance = () => journey.locator('.journey-discovery').filter({ hasText: 'Unassuming doorway 0' });
  await entrance().getByRole('button', { name: 'Investigate', exact: true }).click();
  await entrance().getByRole('button', { name: 'Enter passage', exact: true }).click();
  await expect(journey.getByRole('heading', { name: 'Practice chamber', exact: true })).toBeVisible();
  await expect(page.locator('.world-card')).toBeHidden();
  if (info.project.name === 'mobile') await expect(page.getByRole('button', { name: 'Move east', exact: true })).toBeDisabled();
  else {
    const position = (await (await page.request.get('/api/game/world')).json()).profile.character;
    await page.keyboard.press('ArrowRight');
    const after = (await (await page.request.get('/api/game/world')).json()).profile.character;
    expect({ x:after.x, y:after.y }).toEqual({ x:position.x, y:position.y });
  }
  await page.screenshot({ path: info.outputPath('journey-chamber.png'), fullPage: true });
  await journey.getByRole('button', { name: 'Attack', exact: true }).click();
  await journey.getByRole('button', { name: 'Continue onward', exact: true }).click();
  await expect(journey.getByRole('heading', { name: 'Private terminal 0', exact: true })).toBeVisible();
  await page.reload();
  await expect(journey.getByRole('heading', { name: 'Private terminal 0', exact: true })).toBeVisible();
  await journey.getByRole('button', { name: 'Attack', exact: true }).click();
  await journey.getByRole('button', { name: 'Return to entrance', exact: true }).click();
  await expect(page.locator('.world-card')).toBeVisible();
  if (info.project.name === 'mobile') await page.getByRole('button', { name: 'Move east', exact: true }).click();
  else await page.keyboard.press('ArrowRight');
  const second = journey.locator('.journey-discovery').filter({ hasText: 'Unassuming doorway 1' });
  await second.getByRole('button', { name: 'Investigate', exact: true }).click();
  await second.getByRole('button', { name: 'Enter passage', exact: true }).click();
  await journey.getByRole('button', { name: 'Attack', exact: true }).click();
  await journey.getByRole('button', { name: 'Continue onward', exact: true }).click();
  await journey.getByRole('button', { name: 'Attack', exact: true }).click();
  await expect(journey.getByRole('heading', { name: 'Earned meeting', exact: true })).toBeVisible();
  const currentDb = openDatabase(process.env.ELDRITCH_BROWSER_DB);
  let first;
  try { first = !currentDb.prepare('SELECT 1 FROM game_authored_claims WHERE claim_key=?').get('first-meeting'); }
  finally { currentDb.close(); }
  await journey.getByRole('button', { name: 'Attack', exact: true }).click();
  if (first) await journey.getByRole('button', { name: 'Attack', exact: true }).click();
  await expect(journey.getByRole('heading', { name: first ? 'Afterward' : 'Finished', exact: true })).toBeVisible();
  await expect(journey.getByRole('button', { name: 'Attack', exact: true })).toHaveCount(0);
  await journey.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.locator('.world-card')).toBeVisible();
  if (first) {
    await journey.getByText('Your equipment', { exact: true }).click();
    await expect(journey.getByText('Earned ranger relic', { exact: false })).toBeVisible();
    await journey.getByRole('button', { name: 'Equip', exact: true }).click();
    await expect(journey.getByRole('button', { name: 'Equipped', exact: true })).toBeDisabled();
  }
  await page.setViewportSize({ width: 320, height: 568 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});
