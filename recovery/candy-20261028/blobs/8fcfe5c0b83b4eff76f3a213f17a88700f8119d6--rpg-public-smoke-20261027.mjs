import assert from 'node:assert/strict';
import { chromium } from '/srv/eldritch-staging/rpg-release-7c5068bdb17b/standalone/node_modules/playwright/index.mjs';
import { expect } from '/srv/eldritch-staging/rpg-release-7c5068bdb17b/standalone/node_modules/@playwright/test/index.mjs';

const origin = 'https://eldritchfable.com';
const expectedCommit = process.argv[2];
assert.match(expectedCommit, /^[a-f0-9]{40}$/);
const browser = await chromium.launch({ headless: true });
const results = [];
try {
  for (const [name, viewport] of [
    ['desktop', { width: 1280, height: 900 }],
    ['mobile', { width: 390, height: 844 }],
  ]) {
    const context = await browser.newContext({ viewport, locale: 'en-US' });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(origin + '/', { waitUntil: 'networkidle' });
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Adventures Become Real');
    if (name === 'mobile') await page.getByRole('button', { name: 'Open menu', exact: true }).click();
    await page.getByRole('link', { name: 'Adventure', exact: true }).filter({ visible: true }).click();
    await expect(page).toHaveURL(origin + '/play');
    await expect(page.getByRole('heading', { name: 'Every legend needs a name.' })).toBeVisible();
    await page.getByRole('link', { name: 'Sign in to Eldritch Fable', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Welcome back', exact: true })).toBeVisible();
    assert.equal(new URL(page.url()).searchParams.get('next'), '/play');

    await page.goto(origin + '/stash', { waitUntil: 'networkidle' });
    await expect(page.getByRole('heading', { name: 'Your treasures are yours alone.' })).toBeVisible();
    for (const path of ['/api/game/world', '/api/game/stash']) {
      const denied = await context.request.get(origin + path);
      assert.equal(denied.status(), 401, path + ' must require the site account');
      assert.equal((await denied.json()).code, 'SIGN_IN_REQUIRED');
    }
    const manifestResponse = await context.request.get(origin + '/frontend-release.json?verify=' + expectedCommit);
    assert.equal(manifestResponse.status(), 200);
    const manifest = await manifestResponse.json();
    assert.equal(manifest.frontendCommit, expectedCommit);
    assert.ok(manifest.builtAssets.length >= 2);
    for (const asset of [...manifest.builtAssets, '/approved/hero-dragon.webp']) {
      const response = await context.request.get(origin + asset);
      assert.equal(response.status(), 200, asset + ' must load');
    }
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    assert.deepEqual(errors, []);
    results.push({ viewport: name, navigation: 'passed', accountGate: 'passed', privateStash: 'passed', assets: 'passed', commit: manifest.frontendCommit });
    await context.close();
  }
  console.log(JSON.stringify({ publicVerification: 'passed', results }));
} finally {
  await browser.close();
}
