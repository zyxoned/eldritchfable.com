import { backup } from 'node:sqlite';
import { existsSync, statSync, mkdirSync, chmodSync, openSync, closeSync, realpathSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDatabase, requireSchema, transaction } from './database.mjs';
import { adminSettings, appendAdminAudit, validVisitorName } from './admin.mjs';
import { normalizeEmail, validEmail } from './request-security.mjs';

function requireCondition(value, code) {
  if (!value) throw Object.assign(new Error(code), { safeCode: code });
}
export async function configureAdminAccount({
  databasePath, email, name, testingEnabled, expectedAdminCount, apply = false, backupPath,
}) {
  requireCondition(typeof databasePath === 'string' && existsSync(databasePath), 'DATABASE_MISSING');
  const normalized = normalizeEmail(email);
  requireCondition(validEmail(normalized), 'INVALID_EMAIL');
  requireCondition(name === undefined || validVisitorName(name), 'INVALID_VISITOR_NAME');
  requireCondition(testingEnabled === undefined || typeof testingEnabled === 'boolean', 'INVALID_TESTING_FLAG');
  requireCondition(expectedAdminCount === undefined || Number.isSafeInteger(expectedAdminCount) && expectedAdminCount > 0, 'INVALID_ADMIN_COUNT');
  const db = openDatabase(databasePath, { readOnly: !apply });
  try {
    requireSchema(db);
    function target() {
      const row = db.prepare('SELECT id,role,email_verified_at,disabled_at FROM account_users WHERE email=?').get(normalized);
      requireCondition(row, 'ACCOUNT_NOT_FOUND');
      requireCondition(row.role === 'admin' && row.email_verified_at && !row.disabled_at, 'VERIFIED_ENABLED_ADMIN_REQUIRED');
      const adminCount = db.prepare("SELECT COUNT(*) AS n FROM account_users WHERE role='admin' AND disabled_at IS NULL").get().n;
      requireCondition(expectedAdminCount === undefined || adminCount === expectedAdminCount, 'ADMIN_COUNT_CHANGED');
      return { row, adminCount };
    }
    const initial = target(), before = adminSettings(db, initial.row.id);
    const visitorName = name === undefined ? before.visitorName : name;
    const enable = testingEnabled === undefined ? before.testingEnabled : testingEnabled;
    const changed = before.visitorName !== visitorName || before.testingEnabled !== enable;
    if (!apply) {
      return { applied: false, changed, adminCount: initial.adminCount, profile: { ...before, visitorName, testingEnabled: enable } };
    }
    requireCondition(typeof backupPath === 'string' && backupPath.length > 0, 'PRIVATE_BACKUP_REQUIRED');
    const snapshot = resolve(backupPath);
    requireCondition(snapshot !== realpathSync(databasePath) && !existsSync(snapshot), 'BACKUP_MUST_BE_NEW');
    const parent = dirname(snapshot);
    mkdirSync(parent, { recursive: true, mode: 0o700 });
    requireCondition((statSync(parent).mode & 0o077) === 0, 'BACKUP_DIRECTORY_MUST_BE_PRIVATE');
    // Reserve the destination exclusively under a private parent, then let the
    // SQLite backup API copy all committed WAL data into that private file.
    const fd = openSync(snapshot, 'wx', 0o600); closeSync(fd);
    try { await backup(db, snapshot); chmodSync(snapshot, 0o600); }
    catch { throw Object.assign(new Error('BACKUP_FAILED'), { safeCode: 'BACKUP_FAILED' }); }
    const check = openDatabase(snapshot, { readOnly: true });
    try {
      requireCondition(check.prepare('PRAGMA integrity_check').get().integrity_check === 'ok', 'BACKUP_INTEGRITY_FAILED');
      requireCondition(check.prepare('PRAGMA foreign_key_check').all().length === 0, 'BACKUP_FOREIGN_KEYS_FAILED');
    } finally { check.close(); }
    return transaction(db, () => {
      const current = target();
      requireCondition(current.row.id === initial.row.id, 'ACCOUNT_CHANGED');
      const settings = adminSettings(db, current.row.id);
      const currentName = name === undefined ? settings.visitorName : name;
      const currentEnable = testingEnabled === undefined ? settings.testingEnabled : testingEnabled;
      const update = settings.visitorName !== currentName || settings.testingEnabled !== currentEnable;
      if (update) {
        const time = Date.now(), stamp = new Date(time).toISOString();
        db.prepare('INSERT INTO admin_account_settings(user_id,visitor_name,testing_enabled,updated_at) VALUES(?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET visitor_name=excluded.visitor_name,testing_enabled=excluded.testing_enabled,updated_at=excluded.updated_at')
          .run(current.row.id, currentName, currentEnable ? 1 : 0, stamp);
        appendAdminAudit(db, current.row.id, 'operator_configure', { visitorName: currentName, testingEnabled: currentEnable }, time);
      }
      return { applied: true, changed: update, backupCreated: true, adminCount: current.adminCount, profile: adminSettings(db, current.row.id) };
    });
  } finally { db.close(); }
}

function argumentsFor(args) {
  const valueFlags = new Set(['--email', '--name', '--backup', '--expected-admin-count']);
  const booleanFlags = new Set(['--apply', '--testing-enabled', '--testing-disabled']);
  const found = {};
  for (let index = 0; index < args.length; index++) {
    const flag = args[index];
    requireCondition(!Object.hasOwn(found, flag), 'DUPLICATE_ARGUMENT');
    if (valueFlags.has(flag)) {
      const value = args[++index];
      requireCondition(typeof value === 'string' && !value.startsWith('--'), 'MISSING_ARGUMENT_VALUE');
      found[flag] = value;
    } else if (booleanFlags.has(flag)) found[flag] = true;
    else throw Object.assign(new Error('UNKNOWN_ARGUMENT'), { safeCode: 'UNKNOWN_ARGUMENT' });
  }
  requireCondition(!(found['--testing-enabled'] && found['--testing-disabled']), 'CONFLICTING_TESTING_FLAGS');
  const expectedAdminCount = found['--expected-admin-count'] === undefined ? undefined : Number(found['--expected-admin-count']);
  return {
    databasePath: process.env.ELDRITCH_DB, email: found['--email'], name: found['--name'],
    testingEnabled: found['--testing-enabled'] ? true : found['--testing-disabled'] ? false : undefined,
    apply: Boolean(found['--apply']), backupPath: found['--backup'], expectedAdminCount,
  };
}
if (process.argv[1] && existsSync(process.argv[1]) && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
  process.umask(0o077);
  if (process.argv.length === 3 && process.argv[2] === '--help') {
    console.log('Usage: ELDRITCH_DB=/path/db node server/configure-admin.mjs --email account@example.test [--name VisitorName] [--testing-enabled|--testing-disabled] [--expected-admin-count 2] [--apply --backup /private/new.sqlite]');
    console.log('Dry run by default. Apply only changes preferences on an existing verified enabled administrator; account credentials and customer progress stay untouched.');
  } else {
    Promise.resolve().then(() => configureAdminAccount(argumentsFor(process.argv.slice(2))))
      .then(result => console.log(JSON.stringify(result)))
      .catch(error => { console.error('Administrator configuration stopped: ' + (error.safeCode || 'CHECK_FAILED')); process.exitCode = 1; });
  }
}
