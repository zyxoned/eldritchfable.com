import { spawn } from 'node:child_process';
import { openDatabase, migrateDatabase } from '../server/database.mjs';

const db = openDatabase(process.env.ELDRITCH_BROWSER_DB); migrateDatabase(db); db.close();
const env = { ...process.env, ELDRITCH_DB: process.env.ELDRITCH_BROWSER_DB, ELDRITCH_ORIGIN: 'http://127.0.0.1:4317', PORT: '4318', ELDRITCH_DEV_API: 'http://127.0.0.1:4318' };
const children = [
  spawn(process.execPath, ['server/index.mjs'], { env, stdio: 'inherit' }),
  spawn(process.execPath, ['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','4317','--strictPort'], { env, stdio: 'inherit' })
];
let stopping = false;
function stop(code) { if (stopping) return; stopping = true; for (const child of children) child.kill('SIGTERM'); process.exitCode = code; }
for (const child of children) child.on('exit', code => { if (!stopping) stop(code || 1); });
process.on('SIGTERM', () => stop(0)); process.on('SIGINT', () => stop(0));
