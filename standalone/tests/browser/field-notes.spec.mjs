import { test, expect } from '@playwright/test';
import { randomUUID, randomBytes, createHash, scryptSync } from 'node:crypto';
import { openDatabase } from '../../server/database.mjs';

const ORIGIN = 'http://127.0.0.1:4317';
test('optional field notes persist locally without changing XP or account rewards', async ({ page }, info) => {
  const id = randomUUID(), token = randomBytes(32).toString('hex'), salt = randomBytes(16);
  const db = openDatabase(process.env.ELDRITCH_BROWSER_DB);
  try {
    const hash = 'scrypt$' + salt.toString('hex') + '$' + scryptSync('synthetic-field-notes-passphrase', salt, 64).toString('hex');
    db.prepare('INSERT INTO account_users(id,email,password_hash,role,email_verified_at) VALUES(?,?,?,?,?)')
      .run(id, 'notes-' + id + '@example.test', hash, 'customer', new Date().toISOString());
    db.prepare('INSERT INTO account_sessions(token_hash,user_id,expires_at) VALUES(?,?,?)')
      .run(createHash('sha256').update(token).digest('hex'), id, new Date(Date.now()+3600000).toISOString());
  } finally { db.close(); }
  await page.context().addCookies([{ name:'ef_session', value:token, url:ORIGIN, httpOnly:true, sameSite:'Lax' }]);
  await page.goto('/play');
  const skip = page.getByRole('button', { name:'Skip intro', exact:true });
  await expect(skip).toBeVisible();
  await skip.click();
  await page.getByLabel('Adventurer name', { exact:true }).fill(info.project.name === 'mobile' ? 'NoteWalkerM' : 'NoteWalkerD');
  await page.getByRole('button', { name:'Ranger', exact:true }).click();
  await page.getByRole('button', { name:'Enter the glade', exact:true }).click();
  const notes = page.getByRole('region', { name:'Field notes', exact:true });
  await expect(notes).toBeVisible();
  const wallet = async () => {
    const conn = openDatabase(process.env.ELDRITCH_BROWSER_DB);
    try { return conn.prepare('SELECT balance_xp,lifetime_xp,balance_copper FROM game_wallets WHERE user_id=?').get(id); }
    finally { conn.close(); }
  };
  const before = await wallet();
  await notes.getByRole('button', { name:'Examine · A light for the road', exact:true }).click();
  await expect(notes.getByRole('heading', { name:'A light for the road', exact:true })).toBeVisible();
  await notes.getByRole('button', { name:'Read again · A light for the road', exact:true }).click();
  await expect(notes.getByRole('button', { name:'Close notebook · 1 note', exact:true })).toBeVisible();
  await page.reload();
  await expect(notes).toBeVisible();
  await notes.getByRole('button', { name:'Open notebook · 1 note', exact:true }).click();
  await expect(notes).toContainText('Notes stay in this browser');
  expect(await wallet()).toEqual(before);
  // Forged client-only IDs are ignored, never rendered as lore or credited.
  await page.evaluate(({id}) => localStorage.setItem('eldritch-field-notes-v1-' + id, JSON.stringify(['camp-lantern','forged','camp-lantern'])), {id});
  await page.reload();
  await expect(notes.getByRole('button', { name:'Open notebook · 1 note', exact:true })).toBeVisible();
  await expect(notes).not.toContainText('forged');
  await page.screenshot({ path:info.outputPath('field-notes.png'), fullPage:true });
});
