import { test, expect } from '@playwright/test';

const collections = [
  { slug: 'dice', name: 'Dice & Accessories', description: 'Dice for your next adventure.', icon: 'dice' },
  { slug: 'miniatures', name: 'Miniatures & Encounters', description: 'Figures for the table.', icon: 'sword' }
];
const products = [
  { id: 'mini-1', slug: 'dragon-miniature', name: 'Dragon miniature', category: 'miniatures', art: 'mini',
    description: 'A miniature for a tabletop encounter.', details: ['Illustrative sample'], specifications: [],
    variants: [{ id: 'plain', label: 'Unpainted', price_cents: 1299 }, { id: 'painted', label: 'Painted', price_cents: 2299 }] },
  { id: 'dice-1', slug: 'moonstone-dice', name: 'Moonstone dice', category: 'dice', art: 'dice',
    description: 'Dice for the game table.', details: [], specifications: [],
    variants: [{ id: 'default', label: 'Default', price_cents: 1599 }] }
];

test('Tavern home works with the empty production catalog and keeps navigation accessible', async ({ page }, testInfo) => {
  await page.route('**/api/catalog', route => route.fulfill({ json: { products: [], collections: [] } }));
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Adventures Become Real');
  await expect(page.getByRole('heading', { name: 'Legendary gear for stories yet to be told' })).toBeVisible();
  await expect(page.locator('#categories .tavern-category')).toHaveCount(6);
  await expect(page.getByRole('heading', { name: 'Find What You Seek' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Our Table-Ready Quality Promise' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('tavern-home.png'), fullPage: true });

  if (testInfo.project.name === 'mobile') {
    await page.getByRole('button', { name: 'Open menu' }).click();
    await expect(page.getByRole('navigation', { name: 'Mobile navigation' }).getByRole('link', { name: 'Account', exact: true })).toBeVisible();
  }
  await page.getByRole('link', { name: 'Account', exact: true }).filter({ visible: true }).click();
  await expect(page).toHaveURL(/\/account$/);
  await expect(page.getByRole('heading', { name: 'Sign in to your account' })).toBeVisible();
  await page.getByRole('link', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
  await page.goto('/');
  await page.getByRole('link', { name: 'Enter the Loot Cache' }).click();
  await expect(page).toHaveURL(/\/shop$/);
  await page.getByLabel('Search the store', { exact: true }).fill('missing');
  await page.getByRole('button', { name: 'Search store', exact: true }).click();
  await page.getByRole('button', { name: 'Clear filters', exact: true }).click();
  await expect(page).toHaveURL(/\/shop$/);
  await expect(page.getByLabel('Search the store', { exact: true })).toHaveValue('');
});

test('Tavern search, product art, wishlist and chosen-variant bag work together', async ({ page }) => {
  await page.route('**/api/catalog', route => route.fulfill({ json: { products, collections } }));
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('tavern-test-started')) {
      localStorage.setItem('ef-preview-wishlist', '{"unexpected":true}');
      sessionStorage.setItem('tavern-test-started', 'yes');
    }
  });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Adventures Become Real' })).toBeVisible();
  await page.getByRole('link', { name: 'Enter the Loot Cache' }).click();
  await expect(page.locator('.product-card')).toHaveCount(2);
  const image = await page.request.get('/approved/item-mini.webp');
  expect(image.status()).toBe(200);
  expect(image.headers()['content-type']).toContain('image/webp');
  await page.getByRole('button', { name: 'Dice & Accessories', exact: true }).click();
  await expect(page.locator('.product-card')).toHaveCount(1);
  await expect(page.locator('.product-card')).toContainText('Moonstone dice');
  await page.getByLabel('Search the store', { exact: true }).fill('miniature');
  await page.getByRole('button', { name: 'Search store', exact: true }).click();
  await expect(page).toHaveURL(/\/shop\?q=miniature$/);
  await expect(page.locator('.product-card')).toHaveCount(1);
  await page.getByRole('button', { name: 'Save Dragon miniature to wishlist', exact: true }).click();
  await page.reload();
  if (page.viewportSize().width <= 700) {
    await page.getByRole('button', { name: 'Open menu' }).click();
    await page.getByRole('navigation', { name: 'Mobile navigation' }).getByRole('link', { name: 'Wishlist (1)' }).click();
  } else {
    await page.getByRole('link', { name: 'Wishlist with 1 products' }).click();
  }
  await expect(page.getByRole('heading', { name: 'Your Wishlist' })).toBeVisible();
  await expect(page.locator('.product-card')).toHaveCount(1);
  await page.getByRole('link', { name: 'View Dragon miniature', exact: true }).click();
  await page.getByLabel('Painted', { exact: true }).check();
  await page.getByRole('button', { name: 'Add to preview bag', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.goto('/bag');
  await expect(page.locator('.ef-cart-line')).toContainText('Painted');
  await expect(page.locator('.ef-cart-line')).toContainText('$22.99');
  await page.reload();
  await expect(page.locator('.ef-cart-line')).toContainText('Painted');
  await expect(page.getByRole('button', { name: 'Checkout unavailable in preview' })).toBeDisabled();
});

test('Tavern navigation remains usable at narrow and intermediate mobile widths', async ({ page }, testInfo) => {
  await page.route('**/api/catalog', route => route.fulfill({ json: { products: [], collections: [] } }));
  for (const width of [320, 390, 680, 701, 800, 1024, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Adventures Become Real' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(await page.locator('.hero h1').evaluate(element => {
      const bounds = element.getBoundingClientRect();
      return element.scrollWidth <= element.clientWidth + 1 && bounds.left >= 0 && bounds.right <= innerWidth;
    }), 'Headline fits at ' + width + 'px').toBe(true);
    const headerFits = await page.locator('.site-header').evaluate(header => {
      const logo = header.querySelector('.brand strong').getBoundingClientRect();
      const actions = header.querySelector('.header-actions').getBoundingClientRect();
      const search = header.querySelector('.header-search').getBoundingClientRect();
      return logo.right <= actions.left && actions.right <= innerWidth && (innerWidth <= 1100 || search.right <= actions.left);
    });
    expect(headerFits).toBe(true);
    if (width === 320 || width === 680) await page.screenshot({ path: testInfo.outputPath('tavern-' + width + '.png') });
    if (width <= 700) {
      await page.getByRole('button', { name: 'Open menu' }).click();
      const account = page.getByRole('navigation', { name: 'Mobile navigation' }).getByRole('link', { name: 'Account', exact: true });
      await expect(account).toBeInViewport();
      if (width === 680) await page.screenshot({ path: testInfo.outputPath('tavern-680-menu.png') });
      await account.click();
      await expect(page).toHaveURL(/\/account$/);
      await expect(page.getByRole('heading', { name: 'Sign in to your account' })).toBeVisible();
    } else {
      await expect(page.getByRole('link', { name: 'Account', exact: true }).filter({ visible: true })).toBeVisible();
    }
  }
});


test('Tavern category cards use the intended artwork after legacy styles', async ({ page }) => {
  await page.route('**/api/catalog', route => route.fulfill({ json: { products: [], collections: [] } }));
  await page.goto('/');
  const cards = page.locator('#categories .tavern-category-image');
  await expect(cards).toHaveCount(6);
  const backgrounds = await cards.evaluateAll(elements => elements.map(element => getComputedStyle(element).backgroundImage));
  const artwork = ['/approved/cat-dice.webp', '/approved/cat-mini.webp', '/approved/cat-map.webp', '/approved/cat-paint.webp', '/visuals/gm-tools.webp', '/approved/cat-tools.webp'];
  for (let index = 0; index < artwork.length; index++) expect(backgrounds[index]).toContain(artwork[index]);
});

test('Header search opens without navigating and Escape restores its trigger', async ({ page }) => {
  await page.route('**/api/catalog', route => route.fulfill({ json: { products, collections } }));
  const trigger = page.getByRole('button', { name: 'Search store', exact: true });
  const input = page.locator('#ef-header-search');
  await page.goto('/');
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  await expect(trigger).toHaveAttribute('type', 'button');
  await expect(input).toBeHidden();
  await trigger.focus();
  await trigger.press('Enter');
  await expect(input).toBeFocused();
  await expect(trigger).toHaveAttribute('aria-expanded', 'true');
  await expect(page).toHaveURL(/\/$/);
  await input.press('Escape');
  await expect(input).toBeHidden();
  await expect(trigger).toBeFocused();
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  await expect(trigger).toHaveAttribute('type', 'button');
  await expect(page).toHaveURL(/\/$/);

  await page.goto('/shop');
  await expect(input).toBeVisible();
  await expect(input).not.toBeFocused();
  await expect(trigger).toHaveAttribute('aria-expanded', 'true');
  await expect(trigger).toHaveAttribute('type', 'submit');
  await input.focus();
  await input.press('Escape');
  await expect(input).toBeHidden();
  await expect(trigger).toBeFocused();
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  await trigger.press('Space');
  await expect(input).toBeFocused();
  await expect(trigger).toHaveAttribute('aria-expanded', 'true');
  await expect(page).toHaveURL(/\/shop$/);
  await page.getByRole('button', { name: 'Dice & Accessories', exact: true }).click();
  await expect(page.locator('.product-card')).toContainText(['Moonstone dice']);
  await input.fill(' miniature ');
  await input.press('Enter');
  await expect(page).toHaveURL(/\/shop\?q=miniature$/);
  await expect(page.getByRole('button', { name: 'All', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.product-card')).toHaveCount(1);
  await expect(page.locator('.product-card')).toContainText('Dragon miniature');
});

test('Find wares submits trimmed queries and starts with all catalog categories', async ({ page }) => {
  await page.route('**/api/catalog', route => route.fulfill({ json: { products, collections } }));
  await page.goto('/');
  const query = page.getByLabel('Search for wares', { exact: true });
  await query.fill('  moonstone dice  ');
  await page.getByRole('button', { name: 'Find wares', exact: true }).click();
  await expect(page).toHaveURL(/\/shop\?q=moonstone%20dice$/);
  await expect(page.getByLabel('Search the store', { exact: true })).toHaveValue('moonstone dice');
  await expect(page.locator('.product-card')).toHaveCount(1);
  await expect(page.locator('.product-card')).toContainText('Moonstone dice');
  await page.getByRole('button', { name: 'Dice & Accessories', exact: true }).click();
  await page.locator('.site-header .brand').click();
  await expect(page.getByRole('button', { name: 'Search store', exact: true })).toHaveAttribute('aria-expanded', 'false');
  await query.fill('miniature');
  await query.press('Enter');
  await expect(page).toHaveURL(/\/shop\?q=miniature$/);
  await expect(page.getByRole('button', { name: 'All', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.product-card')).toHaveCount(1);
  await expect(page.locator('.product-card')).toContainText('Dragon miniature');
});


test('Header search stays within the viewport at mobile and desktop widths', async ({ page }) => {
  await page.route('**/api/catalog', route => route.fulfill({ json: { products: [], collections: [] } }));
  const trigger = page.getByRole('button', { name: 'Search store', exact: true });
  const input = page.locator('#ef-header-search');
  for (const width of [320, 390, 680, 701, 800, 1024, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    for (const path of ['/', '/shop']) {
      await page.goto(path);
      await expect(trigger).toHaveAttribute('aria-expanded', path === '/' ? 'false' : 'true');
      if (path !== '/') {
        await input.focus();
        await input.press('Escape');
        await expect(input).toBeHidden();
        await expect(trigger).toBeFocused();
      }
      await trigger.focus();
      await trigger.press('Enter');
      await expect(input).toBeFocused();
      await expect(trigger).toHaveAttribute('aria-expanded', 'true');
      const bounds = await input.evaluate(element => {
        const rect = element.getBoundingClientRect();
        return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: innerWidth, height: innerHeight };
      });
      expect(bounds.left, 'Search left edge at ' + width + 'px on ' + path).toBeGreaterThanOrEqual(0);
      expect(bounds.right, 'Search right edge at ' + width + 'px on ' + path).toBeLessThanOrEqual(bounds.width);
      expect(bounds.top).toBeGreaterThanOrEqual(0);
      expect(bounds.bottom).toBeLessThanOrEqual(bounds.height);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await input.press('Escape');
      await expect(input).toBeHidden();
      await expect(trigger).toBeFocused();
      await expect(trigger).toHaveAttribute('aria-expanded', 'false');
      expect(new URL(page.url()).pathname).toBe(path);
      expect(new URL(page.url()).search).toBe('');
    }
  }
});
