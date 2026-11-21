import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { createQuarryTesters } from '../../scripts/quarry-testers.mjs';
import { openDatabase } from '../../server/database.mjs';

const scene = page => page.getByTestId('quarry-scene');
const action = (page, verb) => page.locator('[data-quarry-action="' + verb + '"]');

async function world(page) {
  const response = await page.request.get('/api/game/world');
  expect(response.ok()).toBeTruthy();
  return response.json();
}

async function quarry(page) {
  return (await world(page)).realm.quarry;
}

async function reach(page, area) {
  await expect(scene(page)).toHaveAttribute('data-scene', area, { timeout: 18000 });
}

async function use(page, verb) {
  await action(page, verb).click({ timeout: 12000 });
}

async function capture(page, info, filename, attach = false) {
  const canvas = scene(page).locator('canvas').first();
  await expect(canvas).toBeVisible();
  await expect(canvas).toHaveAttribute('data-painted', 'true', { timeout: 15000 });
  const path = info.outputPath(filename);
  await canvas.screenshot({ path });
  if (attach) await info.attach(filename, { path, contentType: 'image/png' });
}

async function fixtures() {
  const db = openDatabase(process.env.ELDRITCH_BROWSER_DB);
  const party = randomUUID();
  try {
    const heroes = await createQuarryTesters(db);
    // The shared browser-test DB also hosts other open parties. Give these
    // accounts a fresh invitation so each run begins with an untouched route.
    db.prepare('INSERT INTO game_parties(id,mode,owner_user_id,enemies_json,created_at) VALUES(?,?,?,?,?)')
      .run(party, 'open', heroes[0].id, '[]', Date.now());
    return { party, heroes };
  } finally {
    db.close();
  }
}

async function join(page, party, hero, calling) {
  await page.goto('/login');
  await page.getByLabel('Email', { exact: true }).fill(hero.email);
  await page.getByLabel('Password', { exact: true }).fill(hero.password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByText('Verified', { exact: true })).toBeVisible();
  await page.goto('/play?party=' + encodeURIComponent(party));
  await page.getByRole('button', { name: 'Skip intro', exact: true }).click();
  await page.getByLabel('Adventurer name', { exact: true }).fill(hero.name);
  await page.getByRole('button', { name: calling, exact: true }).click();
  await page.getByRole('button', { name: 'Enter the glade', exact: true }).click();
  await expect(action(page, 'enter')).toBeVisible();
  expect((await world(page)).realm.partyId).toBe(party);
}

async function strikeOnce(page) {
  const before = (await quarry(page)).foe.hp;
  if (before <= 0) return;
  await expect(async () => {
    await use(page, 'strike');
    await expect.poll(async () => (await quarry(page)).foe?.hp ?? 0, { timeout: 2800 }).toBeLessThan(before);
  }).toPass({ timeout: 12000, intervals: [650] });
}

test('two authenticated adventurers play the quarry, cross independently and return with saved equipment', async ({ page, browser, baseURL }, info) => {
  test.setTimeout(150000);
  const { party, heroes } = await fixtures();
  const guestContext = await browser.newContext({
    baseURL, viewport: page.viewportSize(), isMobile: !!info.project.use.isMobile, hasTouch: !!info.project.use.hasTouch,
  });
  try {
    const friend = await guestContext.newPage();
    const errors = [];
    for (const client of [page, friend]) client.on('pageerror', error => errors.push(error.message));
    await join(page, party, heroes[0], 'Knight');
    await join(friend, party, heroes[1], 'Mage');
    await use(page, 'enter');
    await reach(page, 'market');
    await expect(action(friend, 'enter')).toBeVisible();
    await use(friend, 'enter');
    await reach(friend, 'market');
    await expect.poll(async () => (await quarry(page)).actors.map(actor => actor.name)).toContain(heroes[1].name);
    await capture(page, info, 'quarry-market.png', true);
    const initial = await quarry(friend);

    await use(page, 'talk');
    const clue = page.getByRole('list', { name: 'Learned tones' });
    await expect(clue.getByRole('listitem')).toHaveCount(3);
    const notes = (await clue.getByRole('listitem').allTextContents()).map(value => {
      const label = value.trim().toLowerCase();
      return label === 'middle' ? 'mid' : label;
    });
    expect(new Set(notes)).toEqual(new Set(['low', 'mid', 'high']));
    const still = await quarry(friend);
    expect([still.x, still.y]).toEqual([initial.x, initial.y]);
    expect(still.tune).toBeNull();
    await use(page, 'travel');
    await reach(page, 'gate');
    await reach(friend, 'market');
    await use(friend, 'travel');
    await reach(friend, 'gate');
    await expect.poll(async () => (await quarry(page)).actors.length).toBeGreaterThanOrEqual(2);
    await capture(friend, info, 'quarry-gate.png', true);

    const xpBefore = await Promise.all([world(page), world(friend)]);
    await strikeOnce(page);
    await strikeOnce(friend);
    for (let i = 0; i < 8 && (await quarry(page)).foe?.hp > 0; i++) await strikeOnce(i % 2 === 0 ? page : friend);
    await expect.poll(async () => (await quarry(page)).foe?.hp ?? 0).toBe(0);
    for (const [i, client] of [page, friend].entries()) {
      await expect.poll(async () => (await world(client)).profile.lifetimeXp).toBeGreaterThan(xpBefore[i].profile.lifetimeXp);
      await expect.poll(async () => (await quarry(client)).level).toBeGreaterThan(1);
      await expect.poll(async () => (await quarry(client)).skill).toBe(true);
      await use(client, 'claim');
      await expect.poll(async () => (await quarry(client)).owned).toBe(true);
      await use(client, 'equip');
      await expect.poll(async () => (await quarry(client)).equipped).toBe(true);
    }

    for (const [i, note] of notes.entries()) {
      await page.locator('[data-quarry-note="' + note + '"]').click();
      if (i < notes.length - 1) await expect.poll(async () => (await quarry(page)).progress).toBe(i + 1);
    }
    await expect.poll(async () => (await quarry(friend)).opened).toBe(true);
    await use(page, 'descend');
    await reach(page, 'deep');
    await reach(friend, 'gate');
    expect((await quarry(friend)).tune).toBeNull();
    // A companion may cross an opened passage without acquiring the opener's notes.
    await use(friend, 'descend');
    await reach(friend, 'deep');
    await capture(page, info, 'private-quarry-deep.png');
    await use(page, 'pulse');
    await expect.poll(async () => (await quarry(friend)).primed).toBe(true);
    await use(friend, 'return');
    await reach(friend, 'market');
    await reach(page, 'deep');
    await use(page, 'return');
    await reach(page, 'market');
    for (const client of [page, friend]) {
      await client.reload();
      await reach(client, 'market');
      const hero = await quarry(client);
      expect(hero).toMatchObject({ completed: true, equipped: true, owned: true, skill: true });
      expect(await client.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }

    // Check the other clue from the player's view after a clue-free crossing.
    await use(friend, 'travel');
    await reach(friend, 'gate');
    await use(friend, 'listen');
    await expect(friend.getByRole('list', { name: 'Learned tones' }).getByRole('listitem')).toHaveText(
      notes.map(note => ({ low: 'Low', mid: 'Middle', high: 'High' })[note]),
    );
    expect(errors).toEqual([]);
  } finally {
    await guestContext.close();
  }
});
