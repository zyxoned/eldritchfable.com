import { backup } from 'node:sqlite';
import { mkdirSync, chmodSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { openDatabase, migrateDatabase } from './database.mjs';

const command = process.argv[2];
const filename = process.env.ELDRITCH_DB;
if (!filename) throw Error('ELDRITCH_DB is required');
process.umask(0o077);
async function snapshot(source, target) {
  if (existsSync(target)) throw Error('Destination exists; refusing to overwrite it');
  mkdirSync(dirname(target), { recursive: true, mode: 0o700 });
  const db = openDatabase(source, { readOnly: true });
  try {
    if (db.prepare('PRAGMA integrity_check').get().integrity_check !== 'ok') throw Error('Database integrity check failed');
    await backup(db, target);
    chmodSync(target, 0o600);
  } finally { db.close(); }
  console.log('Database snapshot:', target);
}
const defaultBackup = () => resolve(dirname(filename), 'backups', 'eldritch-' + new Date().toISOString().replaceAll(':','-') + '.sqlite');
if (command === 'backup') {
  await snapshot(filename, resolve(process.argv[3] || defaultBackup()));
} else if (command === 'restore') {
  const [source, target] = process.argv.slice(3);
  if (!source || !target) throw Error('Usage: npm run db:restore -- /path/backup.sqlite /path/new-database.sqlite');
  await snapshot(resolve(source), resolve(target));
} else if (command === 'migrate') {
  if (existsSync(filename)) await snapshot(filename, defaultBackup());
  mkdirSync(dirname(resolve(filename)), { recursive: true, mode: 0o700 });
  const db = openDatabase(filename);
  try { console.log('Database schema version:', migrateDatabase(db)); }
  finally { db.close(); }
} else throw Error('Use backup, restore or migrate');
