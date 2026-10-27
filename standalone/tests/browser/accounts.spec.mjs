import { test, expect } from '@playwright/test';
import { openDatabase } from '../../server/database.mjs';

function mailToken(email, template, field) {
  const db = openDatabase(process.env.ELDRITCH_BROWSER_DB);
  try { return JSON.parse(db.prepare('SELECT payload_json FROM email_outbox WHERE recipient=? AND template=? ORDER BY rowid DESC LIMIT 1').get(email, template).payload_json)[field]; }
  finally { db.close(); }
}
test('customer can register, verify, sign in, change and reset password, and sign out', async ({ page, context }, testInfo) => {
  const email = 'browser-' + testInfo.project.name + '@example.test';
  const password = 'my-first-good-passphrase-123';
  await page.goto('/');
  if (testInfo.project.name === 'mobile') await page.getByRole('button', { name: 'Open menu' }).click();
  await page.getByRole('link', { name: 'Account', exact: true }).filter({ visible: true }).click();
  await page.getByRole('link', { name: 'Create an account', exact: true }).click();
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByLabel('Confirm password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  const welcome = page.getByRole('dialog', { name: 'Your adventure keeps going.' });
  await expect(welcome).toBeVisible();
  await expect(welcome).toContainText('persistent character linked to your account');
  await expect(welcome).toContainText('up to six adventurers');
  await expect(welcome).toContainText('Be sure to invite your friends!');
  await expect(welcome).toContainText('1,250 XP = 1 gold = 100 silver = 1,000 copper.');
  await expect(welcome).toContainText('1 gold is worth 1 penny.');
  await expect(welcome).toContainText('Buying shop gear with coins and unlocking abilities are coming soon.');
  await expect(welcome).toContainText('Verify your email and sign in');
  await expect(welcome.getByRole('button', { name: 'Close adventure welcome' })).toBeFocused();
  await welcome.getByRole('button', { name: 'Got it — check my inbox' }).click();
  await expect(welcome).not.toBeVisible();
  await expect(page.getByRole('button', { name: 'Discover your adventure' })).toBeFocused();
  await expect(page.getByRole('heading', { name: 'Check your inbox' })).toBeVisible();
  const verification = mailToken(email, 'verify_email', 'verification');
  await page.goto('/verify-email?token=' + verification);
  await page.getByRole('button', { name: 'Verify email', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Email verified' })).toBeVisible();
  await expect(page).toHaveURL(/\/verify-email$/);
  await page.getByRole('link', { name: 'Sign in', exact: true }).click();
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByText('Verified', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'About your adventure' }).click();
  await expect(page.getByRole('dialog', { name: 'Your adventure keeps going.' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(page.getByRole('button', { name: 'About your adventure' })).toBeFocused();
  const session = (await context.cookies()).find(item => item.name === 'ef_session');
  expect(session.httpOnly).toBeTruthy(); expect(session.secure).toBeTruthy();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  await page.screenshot({ path: testInfo.outputPath('account.png'), fullPage: true });
  await page.getByLabel('Current password', { exact: true }).fill(password);
  await page.getByLabel('New password', { exact: true }).fill('my-changed-passphrase-456');
  await page.getByLabel('Confirm new password', { exact: true }).fill('my-changed-passphrase-456');
  await page.getByRole('button', { name: 'Change password', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Password updated' })).toBeVisible();
  await page.getByRole('link', { name: 'Sign in', exact: true }).click();
  await page.getByRole('link', { name: 'Forgot your password?' }).click();
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByRole('button', { name: 'Send reset link' }).click();
  await expect(page.getByRole('status')).toContainText('password reset instructions');
  const reset = mailToken(email, 'reset_password', 'reset');
  await page.goto('/reset-password?token=' + reset);
  await page.getByLabel('New password', { exact: true }).fill('my-reset-passphrase-789');
  await page.getByLabel('Confirm new password', { exact: true }).fill('my-reset-passphrase-789');
  await page.getByRole('button', { name: 'Change password', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Password updated');
  await page.getByRole('link', { name: 'Back to sign in' }).click();
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill('my-reset-passphrase-789');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByText('Verified', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
});

test('expired verification offers a working resend form; missing reset links remain recoverable', async ({ page }, testInfo) => {
  const email = 'expired-' + testInfo.project.name + '@example.test';
  await page.goto('/register');
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill('a-long-enough-passphrase');
  await page.getByLabel('Confirm password', { exact: true }).fill('a-long-enough-passphrase');
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await page.getByRole('button', { name: 'Got it — check my inbox' }).click();
  await expect(page.getByRole('heading', { name: 'Check your inbox' })).toBeVisible();
  const token = mailToken(email, 'verify_email', 'verification');
  const db = openDatabase(process.env.ELDRITCH_BROWSER_DB);
  db.prepare("UPDATE account_tokens SET expires_at='2000-01-01T00:00:00.000Z' WHERE user_id=(SELECT id FROM account_users WHERE email=?)").run(email);
  db.prepare('UPDATE account_mail_requests SET last_requested_at=0 WHERE user_id=(SELECT id FROM account_users WHERE email=?)').run(email); db.close();
  await page.goto('/verify-email?token=' + token);
  await page.getByRole('button', { name: 'Verify email', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('expired');
  await page.getByLabel('Email for verification').fill(email);
  await page.getByRole('button', { name: 'Send verification link' }).click();
  await expect(page.getByRole('status')).toContainText('a link will be sent');
  expect(mailToken(email, 'verify_email', 'verification')).not.toBe(token);
  await page.goto('/reset-password');
  await expect(page.getByRole('button', { name: 'Change password', exact: true })).toBeDisabled();
  await expect(page.getByRole('link', { name: 'Request a new reset link' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
});


test('adventure welcome can be previewed, shared, scrolled, and dismissed without submitting signup', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
      writeText: async value => { window.copiedInvite = value; }
    } });
  });
  await page.goto('/register');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.getByRole('button', { name: 'Discover your adventure' }).click();
  const welcome = page.getByRole('dialog', { name: 'Your adventure keeps going.' });
  await expect(welcome).toBeVisible();
  const close = welcome.getByRole('button', { name: 'Close adventure welcome' });
  const done = welcome.getByRole('button', { name: 'Got it', exact: true });
  await expect(close).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(done).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(close).toBeFocused();
  await welcome.getByRole('button', { name: 'Copy invite link' }).click();
  await expect(welcome.getByRole('status')).toHaveText('Invite link copied. Share it with your friends!');
  expect(await page.evaluate(() => window.copiedInvite)).toBe('https://eldritchfable.com/play');
  await expect(welcome.getByLabel('Adventure invite link')).toHaveValue('https://eldritchfable.com/play');
  await page.setViewportSize({ width: 320, height: 568 });
  await done.scrollIntoViewIfNeeded();
  await expect(done).toBeInViewport();
  expect(await welcome.evaluate(element => element.scrollWidth <= element.clientWidth)).toBeTruthy();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  await page.keyboard.press('Escape');
  await expect(welcome).not.toBeVisible();
  await expect(page.getByRole('button', { name: 'Discover your adventure' })).toBeFocused();
  await expect(page.getByRole('heading', { name: 'Create your account' })).toBeVisible();
  await expect(page.getByLabel('Email', { exact: true })).toHaveValue('');
  await page.getByRole('button', { name: 'Discover your adventure' }).click();
  await page.evaluate(() => { navigator.clipboard.writeText = async () => { throw Error('Clipboard blocked'); }; });
  await welcome.getByRole('button', { name: 'Copy invite link' }).click();
  await expect(welcome.getByRole('status')).toHaveText('Copy the selected link and share it with your friends.');
  await expect(welcome.getByLabel('Adventure invite link')).toBeFocused();
  await welcome.getByRole('button', { name: 'Got it', exact: true }).click();
  await expect(welcome).not.toBeVisible();
});
