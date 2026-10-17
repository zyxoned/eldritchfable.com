import { randomUUID, randomBytes, scryptSync } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
const database = process.env.ELDRITCH_DB;
if (!database) throw new Error('ELDRITCH_DB is required');
const email = process.argv[2]?.trim().toLowerCase();
if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Usage: ELDRITCH_DB=/path/to/db node server/provision-admin.mjs admin@example.com');
const rl = createInterface({ input: stdin, output: stdout });
try {
  const password = await rl.question('Initial admin password (12+ characters; terminal input visible): ');
  if (password.length < 12 || password.length > 256) throw new Error('Password must contain 12–256 characters');
  const salt = randomBytes(16);
  const hashed = 'scrypt$' + salt.toString('hex') + '$' + scryptSync(password, salt, 64).toString('hex');
  const db = new DatabaseSync(database);
  try {
    const existing = db.prepare('SELECT id,role FROM account_users WHERE email=?').get(email);
    if (existing) throw new Error('Account already exists. Refusing to elevate an existing account.');
    db.prepare("INSERT INTO account_users(id,email,password_hash,role,email_verified_at) VALUES(?,?,?,'admin',?)").run(randomUUID(), email, hashed, new Date().toISOString());
    console.log('Admin provisioned for', email);
  } finally { db.close(); }
} finally { rl.close(); }
