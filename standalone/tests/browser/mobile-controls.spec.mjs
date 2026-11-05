import { test, expect } from '@playwright/test';
import { randomUUID, randomBytes, createHash, scryptSync } from 'node:crypto';
import { openDatabase } from '../../server/database.mjs';

// Isolated test account only. No live account, mailbox or production database.
test('held movement is serialized, cancels stale intent and keeps both touch modes usable', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'Touch layout coverage');
  const origin = 'http://127.0.0.1:4317';
  const id = randomUUID(), token = randomBytes(32).toString('hex'), salt = randomBytes(16);
  const db = openDatabase(process.env.ELDRITCH_BROWSER_DB);
  try {
    const hash = 'scrypt$' + salt.toString('hex') + '$' + scryptSync('synthetic-held-controls-passphrase', salt, 64).toString('hex');
    db.prepare('INSERT INTO account_users(id,email,password_hash,role,email_verified_at) VALUES(?,?,?,?,?)')
      .run(id, 'held-controls-' + id + '@example.test', hash, 'customer', new Date().toISOString());
    db.prepare('INSERT INTO account_sessions(token_hash,user_id,expires_at) VALUES(?,?,?)')
      .run(createHash('sha256').update(token).digest('hex'), id, new Date(Date.now()+3600000).toISOString());
  } finally { db.close(); }
  await page.context().addCookies([{ name:'ef_session', value:token, url:origin, httpOnly:true, sameSite:'Lax' }]);
  await page.goto('/play');
  await page.getByRole('button', { name: 'Skip intro', exact: true }).click();
  const heroName = 'Thumb' + id.slice(0, 8);
  await page.getByLabel('Adventurer name', { exact: true }).fill(heroName);
  await page.getByRole('button', { name: 'Enter the glade', exact: true }).click();
  await expect(page.getByRole('heading', { name: heroName, exact: true })).toBeVisible();
  if (await page.getByRole('button', { name: 'Use joystick', exact: true }).isVisible()) await page.getByRole('button', { name: 'Use joystick', exact: true }).click();
  const stick = page.locator('.thumb-stick');
  await stick.scrollIntoViewIfNeeded();
  const bounds = await stick.boundingBox();
  const moves = [];
  let heldRequest;
  await page.route('**/api/game/action', route => {
    const data = route.request().postDataJSON();
    if (data.kind === 'move') {
      moves.push(data);
      if (!heldRequest) { heldRequest = route; return; }
    }
    return route.continue();
  });
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width - 8, bounds.y + bounds.height / 2);
  await expect.poll(() => moves.length).toBe(1);
  await page.waitForTimeout(600);
  expect(moves.length).toBe(1); // No concurrent requests while the response is pending.
  await page.mouse.up();
  await heldRequest.continue();
  await expect(page.locator('.map-caption')).toContainText('11, 13');
  await page.waitForTimeout(600);
  expect(moves.length).toBe(1); // Releasing does not leave queued movement behind.
  await page.unroute('**/api/game/action');

  await page.getByRole('button', { name: 'Use buttons', exact: true }).click();
  const west = page.getByRole('button', { name: 'Move west', exact: true });
  await west.scrollIntoViewIfNeeded();
  const button = await west.boundingBox();
  // Hold the first west response so blur happens deterministically while it is
  // in flight. A previously sent move may complete; blur must queue no next move.
  const westMoves = [];
  let heldWestRequest;
  await page.route('**/api/game/action', route => {
    const data = route.request().postDataJSON();
    if (data.kind === 'move') {
      westMoves.push(data);
      if (!heldWestRequest) { heldWestRequest = route; return; }
    }
    return route.continue();
  });
  await page.mouse.move(button.x + 22, button.y + 22);
  await page.mouse.down();
  await expect.poll(() => westMoves.length).toBe(1);
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await page.mouse.up();
  await heldWestRequest.continue();
  await expect(page.locator('.map-caption')).toContainText('10, 13');
  await page.waitForTimeout(700);
  expect(westMoves.length).toBe(1);
  await expect(page.locator('.map-caption')).toContainText('10, 13');
  await page.unroute('**/api/game/action');
  await page.getByRole('button', { name: 'Open field guide', exact: true }).click();
  await page.keyboard.press('ArrowRight');
  await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
  await page.waitForTimeout(400);
  await expect(page.locator('.map-caption')).toContainText('10, 13');
  for (const [width, height] of [[320, 568], [390, 844], [844, 390]]) {
    await page.setViewportSize({ width, height });
    await page.locator('.controls-card').scrollIntoViewIfNeeded();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
    for (const target of [west, page.getByRole('button', { name: 'Attack', exact: true }), page.getByRole('button', { name: 'Interact', exact: true })]) {
      const rect = await target.boundingBox();
      expect(rect.width).toBeGreaterThanOrEqual(44);
      expect(rect.height).toBeGreaterThanOrEqual(44);
    }
    await page.screenshot({ path: testInfo.outputPath(`held-controls-${width}.png`), fullPage: true });
  }
});
