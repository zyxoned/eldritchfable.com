// Read the running server layout and rehearse migration on a private copy.
// This script never restarts services, edits configuration, or sends mail.
import { backup } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readlinkSync, realpathSync, lstatSync, readdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { openDatabase, migrateDatabase } from '../server/database.mjs';

const preservedTables = [
  'account_users', 'account_sessions', 'account_tokens',
  'newsletter_subscribers', 'newsletter_campaigns', 'newsletter_deliveries',
  'storefront_collections', 'storefront_products',
  'game_characters', 'game_wallets', 'game_ledger', 'game_requests', 'game_damage', 'game_world'
];
let checkPhase = 'initializing';

function fingerprints(db, selected = preservedTables.filter(table => db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(table))) {
  return Object.fromEntries(selected.map(table => {
    const present = db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(table);
    const rows = present ? db.prepare(`SELECT * FROM ${table}`).all() : [];
    const serialized = rows.map(row => JSON.stringify(row)).sort();
    return [table, createHash('sha256').update(JSON.stringify(serialized)).digest('hex')];
  }));
}

export async function rehearseMigration(filename) {
  // DatabaseSync would otherwise create a missing file. Refuse it explicitly.
  if (!existsSync(filename)) throw Error('Live database does not exist; no file was created');
  const folder = mkdtempSync(join(tmpdir(), 'eldritch-account-check-'));
  let live, copy;
  try {
    live = openDatabase(filename, { readOnly: true });
    const snapshot = join(folder, 'rehearsal.sqlite');
    await backup(live, snapshot);
    live.close(); live = undefined;
    copy = openDatabase(snapshot);
    if (copy.prepare('PRAGMA integrity_check').get().integrity_check !== 'ok') throw Error('Snapshot integrity check failed');
    const before = fingerprints(copy);
    const schemaVersion = migrateDatabase(copy);
    const after = fingerprints(copy, Object.keys(before));
    if (JSON.stringify(before) !== JSON.stringify(after)) throw Error('Migration changed preserved account or store data');
    if (copy.prepare('PRAGMA foreign_key_check').all().length) throw Error('Snapshot has invalid foreign-key references');
    const counts = copy.prepare("SELECT COUNT(*) AS accounts, COUNT(CASE WHEN role='customer' THEN 1 END) AS customers, COUNT(CASE WHEN role='admin' THEN 1 END) AS admins FROM account_users").get();
    const sessions = copy.prepare('SELECT COUNT(*) AS n FROM account_sessions').get().n;
    const queue = Object.fromEntries(copy.prepare('SELECT status, COUNT(*) AS n FROM email_outbox GROUP BY status ORDER BY status').all().map(row => [row.status, row.n]));
    return { ...counts, sessions, schemaVersion, queue, preserved: true };
  } finally {
    live?.close(); copy?.close();
    rmSync(folder, { recursive: true, force: true });
  }
}

// Select only operational paths and booleans from adapted Caddy JSON. Request
// headers and other configuration may contain secrets and must not be printed.
export function caddySummary(config) {
  const roots = new Set(), upstreams = new Set();
  let cloudflareClientHeader = false, noReferrer = false;
  function walk(value) {
    if (!value || typeof value !== 'object') return;
    if (value.handler === 'vars' && typeof value.root === 'string') roots.add(value.root);
    if (value.handler === 'reverse_proxy') {
      for (const upstream of value.upstreams || []) {
        if (/^(127\.0\.0\.1|localhost|\[::1\]):[0-9]+$/.test(upstream.dial)) upstreams.add(upstream.dial);
        else upstreams.add('(other upstream; value withheld)');
      }
      for (const [name, values] of Object.entries(value.headers?.request?.set || {})) {
        if (name.toLowerCase() === 'x-eldritch-client-ip' && Array.isArray(values)) {
          cloudflareClientHeader ||= values.includes('{http.request.header.CF-Connecting-IP}');
        }
      }
    }
    for (const [name, values] of Object.entries(value.response?.set || {})) {
      if (name.toLowerCase() === 'referrer-policy' && Array.isArray(values)) noReferrer ||= values.includes('no-referrer');
    }
    for (const child of Object.values(value)) walk(child);
  }
  walk(config);
  return { roots: [...roots].sort(), upstreams: [...upstreams].sort(), cloudflareClientHeader, noReferrer };
}

function processFor(unit) {
  const result = spawnSync('systemctl', ['show', unit, '-p', 'MainPID', '--value'], { encoding: 'utf8', timeout: 5000 });
  const pid = result.stdout?.trim();
  if (result.status !== 0 || !/^[1-9][0-9]*$/.test(pid || '')) throw Error('Expected running service: ' + unit);
  const base = '/proc/' + pid;
  return { base, args: readFileSync(base + '/cmdline', 'utf8').split('\0'), cwd: readlinkSync(base + '/cwd') };
}

function configArgument(args, fallback) {
  const index = args.indexOf('--config');
  return index >= 0 ? args[index + 1] : args.find(arg => arg.startsWith('--config='))?.slice(9) || fallback;
}

async function main() {
  process.umask(0o077);
  checkPhase = 'reading the active API';
  const api = processFor('eldritch-production-api.service');
  const env = Object.fromEntries(readFileSync(api.base + '/environ', 'utf8').split('\0').filter(Boolean).map(item => {
    const split = item.indexOf('='); return [item.slice(0, split), item.slice(split + 1)];
  }));
  checkPhase = 'matching the live database';
  if (!env.ELDRITCH_DB || !env.ELDRITCH_DB.startsWith('/')) throw Error('Expected an absolute ELDRITCH_DB on the running API');
  const database = realpathSync(env.ELDRITCH_DB);
  const openFiles = readdirSync(api.base + '/fd').flatMap(fd => {
    try { return [readlinkSync(api.base + '/fd/' + fd)]; } catch { return []; }
  });
  if (!openFiles.includes(database)) throw Error('Configured database does not match a file open by the active API');
  console.log('API: port=' + (/^\d+$/.test(env.PORT || '') ? env.PORT : '(not in process environment)') + ' directory=' + api.cwd);
  console.log('Database: ' + env.ELDRITCH_DB + ' -> ' + database);
  checkPhase = 'checking installation paths';
  for (const path of ['/srv/eldritch-production', '/srv/eldritch-production/app', '/srv/eldritch-production/data']) {
    const kind = lstatSync(path).isSymbolicLink() ? 'symlink' : 'directory';
    console.log(path + ': ' + kind + ' -> ' + realpathSync(path));
  }
  console.log('Account origin configured: ' + (env.ELDRITCH_ORIGIN === 'https://eldritchfable.com'));
  console.log('API trusts loopback proxy: ' + (env.ELDRITCH_TRUST_PROXY === 'loopback'));
  checkPhase = 'inspecting Caddy routing';
  const web = processFor('eldritch-production-web.service');
  const gateway = processFor('caddy.service');
  const configs = new Set([configArgument(web.args, '/etc/caddy/Caddyfile.production'), configArgument(gateway.args, '/etc/caddy/Caddyfile')]);
  for (const config of configs) {
    const result = config.endsWith('.json')
      ? { status: 0, stdout: readFileSync(config, 'utf8') }
      : spawnSync('caddy', ['adapt', '--config', config, '--adapter', 'caddyfile'], { encoding: 'utf8', timeout: 10000, maxBuffer: 4 * 1024 * 1024 });
    if (result.status !== 0) throw Error('Caddy configuration could not be inspected: ' + config);
    console.log(config + ': ' + JSON.stringify(caddySummary(JSON.parse(result.stdout))));
  }
  checkPhase = 'rehearsing migration on the private snapshot';
  const rehearsal = await rehearseMigration(database);
  console.log('Migration rehearsal PASS: ' + JSON.stringify(rehearsal));
  console.log('Live services, configuration and database were not changed. No emails sent.');
}

if (process.argv[1] && existsSync(process.argv[1]) && realpathSync(fileURLToPath(import.meta.url)) === realpathSync(process.argv[1])) {
  main().catch(() => {
    // Do not print underlying process/configuration errors; they can include secrets.
    console.error('Production check stopped while ' + checkPhase + '. Share the report above; do not change services.');
    process.exitCode = 1;
  });
}
