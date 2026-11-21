import { randomBytes, randomUUID } from 'node:crypto';
import { passwordHash } from '../server/auth.mjs';

// Call with a disposable playtest database. Both identities use ordinary customer permissions.
export async function createQuarryTesters(db) {
  const players = [];
  for (const prefix of ['Aster', 'Sable']) {
    const id = randomUUID();
    const name = prefix + id.slice(0, 5);
    const email = name.toLowerCase() + '@example.test';
    const password = randomBytes(16).toString('base64url');
    db.prepare('INSERT INTO account_users(id,email,password_hash,email_verified_at) VALUES(?,?,?,?)')
      .run(id, email, await passwordHash(password), new Date().toISOString());
    players.push({ id, name, email, password });
  }
  return players;
}
