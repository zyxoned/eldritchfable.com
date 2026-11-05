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
    headers: { Origin: ORIGIN }, data: { token, password: PASSWORD },
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

test('verified administrators visit a party with scaled offense and a healing boon while ordinary rewards continue', async ({ page, browser }, testInfo) => {
  const account = await createVerifiedAccount(page, testInfo, 'visitor');
  await signIn(page, account);
  await skipIntro(page);
  await expect(page.getByRole('button', { name: 'Visit a random party', exact: true })).toHaveCount(0);
  const denied = await page.request.post('/api/game/admin/join', {
    headers: { Origin: ORIGIN }, data: { requestId: randomUUID() },
  });
  expect(denied.status()).toBe(403);

  // A second isolated account provides an eligible solo context. No live users,
  // mail delivery, role-changing API or production database participates.
  const customerContext = await browser.newContext({ baseURL: ORIGIN });
  try {
    const customerPage = await customerContext.newPage();
    const customer = await createVerifiedAccount(customerPage, testInfo, 'visitor-customer');
    await signIn(customerPage, customer);
    const joined = await customerPage.request.post('/api/game/join', {
      headers: { Origin: ORIGIN }, data: { requestId: randomUUID(), name: 'SupportedHero' + (testInfo.project.name === 'mobile' ? 'M' : 'D'), heroClass: 'knight', mode: 'solo' },
    });
    expect(joined.status()).toBe(200);
    const customerParty = (await joined.json()).realm.partyId;
    const db = openDatabase(process.env.ELDRITCH_BROWSER_DB);
    try {
      db.prepare("UPDATE account_users SET role='admin' WHERE id=?").run(account.userId);
      // Make the random choice deterministic in this shared browser-test realm:
      // only this customer's solo context remains active.
      db.prepare('UPDATE game_characters SET active_until=0 WHERE user_id<>?').run(customer.userId);
      db.prepare('UPDATE game_admin_characters SET active_until=0').run();
      db.prepare('UPDATE game_characters SET x=17,y=8,hp=40 WHERE user_id=?').run(customer.userId);
    } finally { db.close(); }
    const before = await currentWorld(page);
    await page.goto('/account');
    await page.getByRole('link', { name: 'Visit a random party', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'The Unnamed', exact: true })).toBeVisible();
    await expect(page.locator('.character-card')).toContainText('Invulnerable');
    await expect(page.getByRole('button', { name: 'Customize character', exact: true })).toHaveCount(0);
    const arrived = await currentWorld(page);
    expect(arrived.realm.partyId).toBe(customerParty);
    expect(arrived.realm.players).toHaveLength(1);
    expect(arrived.realm.visitors).toHaveLength(1);
    expect(arrived.realm.maxPlayers).toBe(8);
    expect(arrived.realm.maxVisitors).toBe(2);
    expect(arrived.realm.visitors[0].heroClass).toBe('death-knight');

    await page.getByRole('button', { name: /Clear thornlings/ }).click();
    await expect(page.locator('.map-caption')).toContainText(/17, 8|21, 13|13, 5|26, 10/, { timeout: 15000 });
    const nearby = await currentWorld(page);
    const me = nearby.realm.visitors[0];
    const nearest = nearby.realm.enemies.filter(enemy => enemy.hp > 0 && Math.hypot(enemy.x - me.x, enemy.y - me.y) <= 6)
      .sort((a, b) => Math.hypot(a.x - me.x, a.y - me.y) - Math.hypot(b.x - me.x, b.y - me.y))[0];
    expect(nearest).toBeTruthy();
    const strike = skillResponse(page, 'soul-reap');
    await page.getByRole('region', { name: 'Class skills' }).getByRole('button', { name: 'Veiled Strike', exact: true }).click();
    const struck = await strike;
    expect(struck.status()).toBe(200);
    const result = await struck.json();
    expect(result.realm.enemies.find(enemy => enemy.id === nearest.id).hp).toBe(42 - CLASS_CATALOG.knight.damage);
    expect(result.profile.character.hp).toBe(100);
    expect(result.profile.balanceXp).toBe(before.profile.balanceXp);
    expect(result.profile.lifetimeXp).toBe(before.profile.lifetimeXp);

    const heal = skillResponse(page, 'guardian-boon');
    await page.getByRole('region', { name: 'Class skills' }).getByRole('button', { name: 'Guardian Boon', exact: true }).click();
    expect((await heal).status()).toBe(200);
    const healed = await currentWorld(customerPage);
    expect(healed.profile.character.hp).toBe(55);
    await page.getByRole('button', { name: 'Leave visiting guardian mode', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'The Unnamed', exact: true })).toHaveCount(0);
    expect((await currentWorld(page)).profile.adminActive).toBeFalsy();
  } finally { await customerContext.close(); }
});


test('an adventurer can choose an isolated solo party and return to open matchmaking', async ({ page }, testInfo) => {
  const account = await createVerifiedAccount(page, testInfo, 'party-mode');
  await signIn(page, account);
  await skipIntro(page);
  await expect(page.getByRole('radio', { name: 'Solo adventure', exact: true })).toBeVisible();
  await page.getByRole('radio', { name: 'Solo adventure', exact: true }).check();
  const name = testInfo.project.name === 'mobile' ? 'SoloTouch' : 'SoloMouse';
  await page.getByLabel('Adventurer name', { exact: true }).fill(name);
  await page.getByRole('button', { name: 'Enter the glade', exact: true }).click();
  await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
  await expect(page.locator('.party-slots > .party-slot')).toHaveCount(8);
  await expect(page.getByLabel('Visiting administrators')).toContainText('0 / 2');
  const solo = await currentWorld(page);
  expect(solo.realm.partyMode).toBe('solo');
  expect(solo.realm.players).toHaveLength(1);
  await page.getByRole('button', { name: 'Leave realm', exact: true }).click();
  await page.getByRole('button', { name: 'Leave adventure', exact: true }).click();
  await expect(page.getByRole('radio', { name: 'Open party', exact: true })).toBeVisible();
  await page.getByRole('radio', { name: 'Open party', exact: true }).check();
  await page.getByRole('button', { name: 'Enter the glade', exact: true }).click();
  await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
  const open = await currentWorld(page);
  expect(open.realm.partyMode).toBe('open');
  expect(open.realm.partyId).not.toBe(solo.realm.partyId);
  const movement = page.waitForResponse(response => response.url().endsWith('/api/game/action') && response.request().postDataJSON()?.kind === 'move');
  if (testInfo.project.name === 'mobile') await page.getByRole('button', { name: 'Move east', exact: true }).click();
  else { await page.bringToFront(); await page.keyboard.press('ArrowRight'); }
  const moved = await movement;
  expect(moved.status()).toBe(200);
  expect(moved.request().postDataJSON().partyId).toBe(open.realm.partyId);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
});

test('character cosmetics preview, cancel, save and reload without changing the calling', async ({ page }, testInfo) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const account = await createVerifiedAccount(page, testInfo, 'appearance');
  await signIn(page, account);
  await skipIntro(page);
  await page.getByRole('button', { name: 'Mage', exact: true }).click();
  await page.getByRole('radio', { name: 'Solo adventure', exact: true }).check();
  await page.getByLabel('Adventurer name', { exact: true }).fill('TailoredMage' + (testInfo.project.name === 'mobile' ? 'M' : 'D'));
  await page.getByRole('button', { name: 'Enter the glade', exact: true }).click();
  const customize = page.getByRole('button', { name: 'Customize character', exact: true });
  await expect(customize).toBeVisible();
  const original = await currentWorld(page);
  await customize.click();
  const dialog = page.getByRole('dialog', { name: 'Make this hero yours', exact: true });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('Skin tone', { exact: true }).selectOption('ebony');
  await dialog.getByLabel('Hair style', { exact: true }).selectOption('braid');
  await dialog.getByRole('button', { name: 'Walk', exact: true }).click();
  await dialog.getByRole('button', { name: 'Turn preview right', exact: true }).click();
  await expect(page.locator('.attack-button')).toBeDisabled();
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  expect((await currentWorld(page)).profile.character.appearance).toEqual(original.profile.character.appearance);
  await customize.click();
  await dialog.getByLabel('Skin tone', { exact: true }).selectOption('ebony');
  await dialog.getByLabel('Hair style', { exact: true }).selectOption('braid');
  await dialog.getByLabel('Hair color', { exact: true }).selectOption('silver');
  await dialog.getByLabel('Clothing palette', { exact: true }).selectOption('plum');
  await dialog.getByLabel('Trim', { exact: true }).selectOption('copper');
  await dialog.getByLabel('Build', { exact: true }).selectOption('broad');
  const saveResponse = page.waitForResponse(response => response.url().endsWith('/api/game/appearance') && response.request().method() === 'POST');
  await dialog.getByRole('button', { name: 'Save look', exact: true }).click();
  const response = await saveResponse;
  expect(response.status()).toBe(200);
  expect(response.request().postDataJSON().partyId).toBe(original.realm.partyId);
  await expect(dialog).not.toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'TailoredMage' + (testInfo.project.name === 'mobile' ? 'M' : 'D'), exact: true })).toBeVisible();
  const saved = await currentWorld(page);
  expect(saved.profile.character.heroClass).toBe('mage');
  expect(saved.profile.character.appearance).toEqual({ skinTone: 'ebony', hairColor: 'silver', hairStyle: 'braid', outfit: 'plum', accent: 'copper', build: 'broad' });
  expect(saved.profile.balanceXp).toBe(original.profile.balanceXp);
  expect(saved.profile.lifetimeXp).toBe(original.profile.lifetimeXp);
  expect(saved.profile.character.id).toBe(original.profile.character.id);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  expect(errors).toEqual([]);
});

test('another tab can switch away and return to the earlier party without stale controls', async ({ page }, testInfo) => {
  const account = await createVerifiedAccount(page, testInfo, 'party-tabs');
  await signIn(page, account);
  await skipIntro(page);
  await page.getByLabel('Adventurer name', { exact: true }).fill('ReturningHero' + (testInfo.project.name === 'mobile' ? 'M' : 'D'));
  await page.getByRole('button', { name: 'Enter the glade', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'ReturningHero' + (testInfo.project.name === 'mobile' ? 'M' : 'D'), exact: true })).toBeVisible();
  const first = await currentWorld(page);
  const firstParty = first.realm.partyId;
  await page.getByRole('button', { name: 'Customize character', exact: true }).click();
  const draft = page.getByRole('dialog', { name: 'Make this hero yours', exact: true });
  await expect(draft).toBeVisible();
  const otherTab = await page.context().newPage();
  try {
    const leave = partyId => otherTab.request.post('/api/game/leave', { headers: { Origin: ORIGIN }, data: { requestId: randomUUID(), partyId } });
    const join = extra => otherTab.request.post('/api/game/join', { headers: { Origin: ORIGIN }, data: { requestId: randomUUID(), name: 'ReturningHero' + (testInfo.project.name === 'mobile' ? 'M' : 'D'), heroClass: 'ranger', ...extra } });
    expect((await leave(firstParty)).status()).toBe(200);
    const soloResponse = await join({ mode: 'solo' });
    expect(soloResponse.status()).toBe(200);
    const solo = await soloResponse.json();
    await expect(page.locator('.party-card > p')).toHaveText('Your own glade, with room for visiting help.');
    await expect(draft).not.toBeVisible();
    expect((await leave(solo.realm.partyId)).status()).toBe(200);
    expect((await join({ mode: 'open', partyId: firstParty })).status()).toBe(200);
    await expect(page.locator('.party-card > p')).toHaveText('Your company shares this glade.');
    const moveResponse = page.waitForResponse(response => response.url().endsWith('/api/game/action') && response.request().postDataJSON()?.kind === 'move');
    if (testInfo.project.name === 'mobile') await page.getByRole('button', { name: 'Move east', exact: true }).click();
  else { await page.bringToFront(); await page.keyboard.press('ArrowRight'); }
    const moved = await moveResponse;
    expect(moved.status()).toBe(200);
    expect(moved.request().postDataJSON().partyId).toBe(firstParty);
  } finally { await otherTab.close(); }
});

test('a delayed join cannot restore an ordinary actor after a remote same-party guardian visit', async ({ page, browser }, testInfo) => {
  test.setTimeout(60000);
  const account = await createVerifiedAccount(page, testInfo, 'mode-tabs');
  const customerContext = await browser.newContext({ baseURL: ORIGIN });
  const remote = await page.context().newPage();
  let releaseJoin;
  let joinedOnServer;
  const held = new Promise(resolve => { releaseJoin = resolve; });
  const joined = new Promise(resolve => { joinedOnServer = resolve; });
  try {
    const customerPage = await customerContext.newPage();
    const customer = await createVerifiedAccount(customerPage, testInfo, 'mode-tabs-customer');
    await signIn(customerPage, customer);
    const customerJoin = await customerPage.request.post('/api/game/join', {
      headers: { Origin: ORIGIN }, data: { requestId: randomUUID(), name: 'SteadyKnight' + (testInfo.project.name === 'mobile' ? 'M' : 'D'), heroClass: 'knight', mode: 'open' },
    });
    expect(customerJoin.status()).toBe(200);
    const partyId = (await customerJoin.json()).realm.partyId;
    const db = openDatabase(process.env.ELDRITCH_BROWSER_DB);
    try {
      db.prepare("UPDATE account_users SET role='admin' WHERE id=?").run(account.userId);
      db.prepare('UPDATE game_characters SET active_until=0 WHERE user_id<>?').run(customer.userId);
      db.prepare('UPDATE game_admin_characters SET active_until=0').run();
    } finally { db.close(); }
    await signIn(page, account);
    await skipIntro(page);
    await page.getByRole('button', { name: 'Wizard', exact: true }).click();
    await page.getByLabel('Adventurer name', { exact: true }).fill('VisitingOwner' + (testInfo.project.name === 'mobile' ? 'M' : 'D'));
    await page.route('**/api/game/join', async route => {
      const response = await route.fetch();
      joinedOnServer();
      await held;
      await route.fulfill({ response });
    });
    const delayed = page.waitForResponse(response => response.url().endsWith('/api/game/join') && response.request().method() === 'POST');
    await page.getByRole('button', { name: 'Enter the glade', exact: true }).click();
    await joined;
    await expect(page.getByRole('heading', { name: 'VisitingOwner' + (testInfo.project.name === 'mobile' ? 'M' : 'D'), exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Customize character', exact: true }).click();
    const editor = page.getByRole('dialog', { name: 'Make this hero yours', exact: true });
    await expect(editor).toBeVisible();
    await editor.getByLabel('Skin tone', { exact: true }).selectOption('ebony');

    const visited = await remote.request.post('/api/game/admin/join', { headers: { Origin: ORIGIN }, data: { requestId: randomUUID() } });
    expect(visited.status()).toBe(200);
    expect((await visited.json()).realm.partyId).toBe(partyId);
    await expect(editor).not.toBeVisible();
    await expect(page.getByRole('heading', { name: 'The Unnamed', exact: true })).toBeVisible();
    await expect(page.locator('.attack-button')).toBeEnabled();
    releaseJoin();
    expect((await delayed).status()).toBe(200);
    await expect(page.getByRole('heading', { name: 'The Unnamed', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Customize character', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Attack', exact: true })).toBeEnabled();
    const current = await currentWorld(page);
    expect(current.profile.adminActive).toBeTruthy();
    expect(current.profile.regularCharacter.heroClass).toBe('wizard');
    expect(current.profile.regularCharacter.appearance.skinTone).toBe('warm');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  } finally {
    releaseJoin();
    await page.unroute('**/api/game/join');
    await remote.close();
    await customerContext.close();
  }
});
