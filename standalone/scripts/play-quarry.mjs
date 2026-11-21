import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { createQuarryTesters } from './quarry-testers.mjs';
import { migrateDatabase, openDatabase } from '../server/database.mjs';

// Local designer session using the same application and isolated server pair as Playwright.
const directory = await mkdtemp(join(tmpdir(), 'eldritch-quarry-playtest-'));
const database = join(directory, 'playtest.db');
try {
  const db = openDatabase(database);
  let players;
  try {
    migrateDatabase(db);
    players = await createQuarryTesters(db);
  } finally {
    db.close();
  }

  const env = { ELDRITCH_BROWSER_DB: database };
  for (const key of ['PATH', 'Path', 'SystemRoot', 'TEMP', 'TMP', 'TMPDIR', 'HOME', 'USERPROFILE']) {
    if (process.env[key]) env[key] = process.env[key];
  }
  const server = spawn(process.execPath, ['tests/browser-server.mjs'], { stdio: 'inherit', env });
  const closed = new Promise((resolve, reject) => {
    server.once('error', reject);
    server.once('exit', (code, signal) => resolve(signal ? 1 : (code ?? 1)));
  });
  const stop = () => server.kill('SIGTERM');
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
  try {
    console.log('Open http://127.0.0.1:4317/login in two independent browser profiles.');
    for (const player of players) console.log('Disposable playtester:', player.email, 'Password:', player.password);
    console.log('After signing in, open /play in each window. Create two heroes and choose an open party. Join the first hero using their party invite, then enter the Hollowbell expedition.');
    console.log('These accounts exist only for this local session. Press Ctrl+C to close the session.');
    process.exitCode = await closed;
  } finally {
    process.off('SIGINT', stop);
    process.off('SIGTERM', stop);
  }
} finally {
  await rm(directory, { recursive: true, force: true });
}
