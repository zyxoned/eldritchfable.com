// Roll out to the specific Linux production layout verified in production-check.
// Run as root, preferably in a transient systemd service to survive SSH loss.
import { backup } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync, realpathSync, readlinkSync, readdirSync, lstatSync, statSync, statfsSync, mkdirSync, chmodSync, chownSync, cpSync, renameSync, symlinkSync, unlinkSync } from 'node:fs';
import { dirname, join, resolve, basename } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { openDatabase, migrateDatabase } from '../server/database.mjs';

const root = '/srv/eldritch-production';
const app = root + '/app', frontend = root + '/frontend';
const database = root + '/data/staging.db';
const runtimeFile = '/etc/eldritch-fable/accounts-runtime.env';
const webFile = '/etc/caddy/eldritch-accounts-production.json';
const apiUnit = 'eldritch-production-api.service';
const webUnit = 'eldritch-production-web.service';
const mailUnit = 'eldritch-production-mail.service';
const mailTimer = 'eldritch-production-mail.timer';
const recoveryTimer = 'eldritch-production-healthcheck.timer';
const backupTimer = 'eldritch-production-backup.timer';
const origin = 'https://eldritchfable.com';
const source = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const tables = ['account_users', 'account_sessions', 'account_tokens', 'newsletter_subscribers', 'newsletter_campaigns', 'newsletter_deliveries', 'storefront_collections', 'storefront_products'];
const delay = ms => new Promise(done => setTimeout(done, ms));
let phase = 'preflight';

function requireCondition(condition, code) {
  if (!condition) throw Object.assign(Error(code), { safeCode: code });
}
function command(executable, args, timeout = 30000) {
  const result = spawnSync(executable, args, { encoding: 'utf8', timeout, maxBuffer: 8 * 1024 * 1024 });
  // Command output can contain credentials, headers or tokens. Never echo it.
  requireCondition(result.status === 0, 'COMMAND_FAILED');
  return result.stdout.trim();
}
const property = (unit, name) => command('systemctl', ['show', unit, '-p', name, '--value']);
const active = unit => property(unit, 'ActiveState') === 'active';
function processInfo(unit) {
  const pid = property(unit, 'MainPID');
  requireCondition(/^[1-9][0-9]*$/.test(pid), 'EXPECTED_RUNNING_SERVICE');
  const base = '/proc/' + pid;
  return { base, binary: readlinkSync(base + '/exe'), args: readFileSync(base + '/cmdline', 'utf8').split('\0') };
}
function environment(info) {
  return Object.fromEntries(readFileSync(info.base + '/environ', 'utf8').split('\0').filter(Boolean).map(item => {
    const separator = item.indexOf('='); return [item.slice(0, separator), item.slice(separator + 1)];
  }));
}
function configArgument(args) {
  const index = args.indexOf('--config');
  return index < 0 ? args.find(arg => arg.startsWith('--config='))?.slice(9) : args[index + 1];
}

// Systemd is the authority for service accounts; screenshots are not. Resolve
// names/numeric IDs through NSS and check the running effective/filesystem IDs
// before using those credentials for Caddy validation or SQLite work.
export function serviceIdentity(unit, info, { getProperty = property, run = command, readStatus = () => readFileSync(info.base + '/status', 'utf8') } = {}) {
  const validName = value => /^(?:[A-Za-z_][A-Za-z0-9_.-]*\$?|[0-9]+)$/.test(value);
  const configuredUser = getProperty(unit, 'User') || 'root';
  requireCondition(validName(configuredUser), 'INVALID_SERVICE_ACCOUNT');
  const account = run('getent', ['passwd', configuredUser]).split(':');
  const user = account[0], uid = Number(account[2]), primaryGid = Number(account[3]);
  requireCondition(account.length >= 7 && validName(user) && /^\d+$/.test(account[2]) && /^\d+$/.test(account[3]), 'SERVICE_ACCOUNT_NOT_FOUND');
  const configuredGroup = getProperty(unit, 'Group') || String(primaryGid);
  requireCondition(validName(configuredGroup), 'INVALID_SERVICE_GROUP');
  const record = run('getent', ['group', configuredGroup]).split(':');
  const group = record[0], gid = Number(record[2]);
  requireCondition(record.length >= 4 && validName(group) && /^\d+$/.test(record[2]), 'SERVICE_GROUP_NOT_FOUND');
  const status = readStatus();
  const userIds = status.match(/^Uid:\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)$/m);
  const groupIds = status.match(/^Gid:\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)$/m);
  requireCondition(userIds && Number(userIds[2]) === uid && Number(userIds[4]) === uid, 'SERVICE_USER_CHANGED_SINCE_START');
  requireCondition(groupIds && Number(groupIds[2]) === gid && Number(groupIds[4]) === gid, 'SERVICE_GROUP_CHANGED_SINCE_START');
  return { user, uid, group, gid };
}

export function productionConfig(original, releaseId) {
  const config = structuredClone(original);
  const servers = Object.values(config.apps?.http?.servers || {});
  requireCondition(servers.length > 0, 'EXPECTED_HTTP_SERVER');
  let proxies = 0, roots = 0;
  const listeners = [];
  function walk(value) {
    if (!value || typeof value !== 'object') return;
    if (value.handler === 'vars' && value.root) {
      requireCondition(value.root === frontend, 'UNEXPECTED_FRONTEND_ROOT'); roots++;
    }
    if (value.handler === 'reverse_proxy') {
      requireCondition(value.upstreams?.length && value.upstreams.every(item => item.dial === '127.0.0.1:3102'), 'UNEXPECTED_API_UPSTREAM');
      value.headers ??= {}; value.headers.request ??= {}; value.headers.request.set ??= {};
      const request = value.headers.request;
      for (const operation of ['set', 'add']) for (const name of Object.keys(request[operation] || {})) {
        if (name.toLowerCase() === 'x-eldritch-client-ip') delete request[operation][name];
      }
      if (request.delete) request.delete = request.delete.filter(name => name.toLowerCase() !== 'x-eldritch-client-ip');
      request.set['X-Eldritch-Client-Ip'] = ['{http.request.header.CF-Connecting-IP}'];
      proxies++;
    }
    if (value.handler === 'headers') for (const name of Object.keys(value.response?.set || {})) {
      if (name.toLowerCase() === 'x-eldritch-release') value.response.set[name] = [releaseId];
      if (name.toLowerCase() === 'referrer-policy') value.response.set[name] = ['no-referrer'];
    }
    for (const child of Object.values(value)) walk(child);
  }
  for (const server of servers) {
    requireCondition(server.listen?.length && server.listen.every(value => /^127\.0\.0\.1:[0-9]+$/.test(value)), 'WEB_MUST_LISTEN_ONLY_ON_LOOPBACK');
    listeners.push(...server.listen);
    walk(server.routes);
    server.routes ??= [];
    const first = server.routes[0];
    const generated = first?.handle?.length === 1 && first.handle[0].handler === 'headers' &&
      first.handle[0].response?.set?.['X-Eldritch-Release'] && !first.match && !first.terminal;
    if (!generated) server.routes.unshift({ handle: [{ handler: 'headers', response: { set: {
      'Referrer-Policy': ['no-referrer'], 'X-Eldritch-Release': [releaseId]
    } } }] });
  }
  requireCondition(proxies > 0 && roots > 0, 'EXPECTED_PRODUCTION_ROUTES');
  return { config, listeners: [...new Set(listeners)] };
}

function fingerprints(db) {
  return Object.fromEntries(tables.map(table => {
    const present = db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(table);
    const rows = present ? db.prepare(`SELECT * FROM ${table}`).all() : [];
    return [table, createHash('sha256').update(JSON.stringify(rows.map(row => JSON.stringify(row)).sort())).digest('hex')];
  }));
}
export async function migrateWithBackup(filename, snapshot) {
  requireCondition(existsSync(filename), 'LIVE_DATABASE_MISSING');
  requireCondition(!existsSync(snapshot), 'BACKUP_ALREADY_EXISTS');
  process.umask(0o077);
  const db = openDatabase(filename);
  try {
    requireCondition(db.prepare('PRAGMA integrity_check').get().integrity_check === 'ok', 'DATABASE_INTEGRITY_FAILED');
    const before = fingerprints(db);
    await backup(db, snapshot); chmodSync(snapshot, 0o600);
    const version = migrateDatabase(db);
    requireCondition(JSON.stringify(before) === JSON.stringify(fingerprints(db)), 'PRESERVED_DATA_CHANGED');
    requireCondition(db.prepare('PRAGMA foreign_key_check').all().length === 0, 'FOREIGN_KEY_CHECK_FAILED');
    return { schemaVersion: version, accounts: db.prepare('SELECT COUNT(*) AS n FROM account_users').get().n, sessions: db.prepare('SELECT COUNT(*) AS n FROM account_sessions').get().n, preserved: true };
  } finally { db.close(); }
}

// Start/check failures restore both entries and the saved configuration. Never
// restore a database snapshot automatically: later customer changes must survive.
export async function activateRelease({ entries, configure, restoreConfig, stop, start, check }) {
  const changed = [];
  try {
    for (const entry of entries) {
      renameSync(entry.path, entry.previous); changed.push(entry);
      symlinkSync(entry.target, entry.path);
    }
    await configure(); await start(); await check();
  } catch (error) {
    try {
      await stop();
      for (const entry of changed.reverse()) {
        if (existsSync(entry.path) || (() => { try { return lstatSync(entry.path).isSymbolicLink(); } catch { return false; } })()) unlinkSync(entry.path);
        renameSync(entry.previous, entry.path);
      }
      await restoreConfig(); await start();
    } catch { throw Object.assign(Error('ROLLBACK_NEEDS_ATTENTION'), { safeCode: 'ROLLBACK_NEEDS_ATTENTION' }); }
    throw Object.assign(Error('ACTIVATION_FAILED_PREVIOUS_CODE_RESTORED'), { safeCode: 'ACTIVATION_FAILED_PREVIOUS_CODE_RESTORED', cause: error });
  }
}

function saveFile(path, folder, index) {
  try {
    const stat = lstatSync(path);
    if (stat.isSymbolicLink()) return { path, symlink: readlinkSync(path) };
    requireCondition(stat.isFile(), 'EXPECTED_CONFIGURATION_FILE');
    const saved = join(folder, 'config-' + index);
    writeFileSync(saved, readFileSync(path), { flag: 'wx', mode: 0o600 });
    return { path, saved, mode: stat.mode & 0o777, uid: stat.uid, gid: stat.gid };
  } catch (error) { if (error.code === 'ENOENT') return { path, absent: true }; throw error; }
}
function writeAtomic(path, content, mode = 0o600, gid = 0) {
  mkdirSync(dirname(path), { recursive: true, mode: 0o755 });
  const temporary = path + '.accounts-' + process.pid + '.tmp';
  writeFileSync(temporary, content, { flag: 'wx', mode });
  chmodSync(temporary, mode); chownSync(temporary, 0, gid);
  renameSync(temporary, path);
}
function restoreFiles(files) {
  for (const file of files) {
    if (file.absent || file.symlink) {
      try { unlinkSync(file.path); } catch (error) { if (error.code !== 'ENOENT') throw error; }
      if (file.symlink) symlinkSync(file.symlink, file.path);
    } else {
      writeAtomic(file.path, readFileSync(file.saved), file.mode, file.gid);
      chownSync(file.path, file.uid, file.gid);
    }
  }
}
function allowCodeReads(path) {
  const stat = lstatSync(path);
  if (stat.isSymbolicLink()) return;
  chmodSync(path, (stat.mode & 0o777) | (stat.isDirectory() ? 0o055 : 0o044));
  if (stat.isDirectory()) for (const name of readdirSync(path)) allowCodeReads(join(path, name));
}
function copySize(path) {
  const stat = lstatSync(path);
  return stat.isDirectory() ? readdirSync(path).reduce((sum, name) => sum + copySize(join(path, name)), 4096) : Math.ceil(stat.size / 4096) * 4096;
}
async function waitIdle(unit, timeout = 120000) {
  const deadline = Date.now() + timeout;
  while (['active', 'activating', 'deactivating', 'reloading'].includes(property(unit, 'ActiveState'))) {
    requireCondition(Date.now() < deadline, 'EXISTING_WORKER_DID_NOT_FINISH'); await delay(1000);
  }
}
async function request(url, { releaseId, json, text } = {}) {
  const response = await fetch(url, { signal: AbortSignal.timeout(10000), redirect: 'error', headers: { 'Cache-Control': 'no-cache' } });
  requireCondition(response.ok, 'HTTP_CHECK_FAILED');
  if (releaseId) requireCondition(response.headers.get('x-eldritch-release') === releaseId, 'PUBLIC_ROUTE_DID_NOT_REACH_NEW_RELEASE');
  if (json) requireCondition(json(await response.json()), 'API_RESPONSE_CHECK_FAILED');
  if (text) requireCondition((await response.text()).includes(text), 'FRONTEND_CHECK_FAILED');
}

async function rollout() {
  requireCondition(process.getuid() === 0, 'RUN_AS_ROOT'); process.umask(0o077);
  requireCondition(Number(process.versions.node.split('.')[0]) >= 24, 'NODE_24_REQUIRED');
  const api = processInfo(apiUnit), web = processInfo(webUnit);
  const env = environment(api);
  const apiIdentity = serviceIdentity(apiUnit, api), webIdentity = serviceIdentity(webUnit, web);
  console.log('Production accounts: API=' + apiIdentity.user + ':' + apiIdentity.group + ' frontend=' + webIdentity.user + ':' + webIdentity.group);
  requireCondition(property(mailUnit, 'Type') === 'oneshot', 'EXPECTED_ONESHOT_MAIL_WORKER');
  requireCondition(env.ELDRITCH_DB === database && env.PORT === '3102' && env.ELDRITCH_ORIGIN === origin, 'LIVE_CONFIGURATION_CHANGED');
  requireCondition(realpathSync(database) === '/mnt/eldritch-data/production-seed/data/staging.db', 'LIVE_DATABASE_PATH_CHANGED');
  requireCondition(realpathSync(root) === '/mnt/eldritch-data/production-seed', 'PRODUCTION_ROOT_CHANGED');
  requireCondition(active('cloudflared.service'), 'CLOUDFLARE_TUNNEL_NOT_RUNNING');
  requireCondition(existsSync('/etc/eldritch-fable/mail.env'), 'EXISTING_MAIL_ENV_MISSING');
  for (const unit of ['eldritch-production-backup.service', 'eldritch-production-healthcheck.service']) {
    // Existing maintenance commands must survive moving the old app. Check
    // dependencies before pausing anything, without printing command contents.
    const launch = property(unit, 'ExecStart');
    const working = property(unit, 'WorkingDirectory');
    requireCondition(!launch.includes(app + '/') && !launch.includes(realpathSync(app) + '/') && working !== app && working !== realpathSync(app), 'MAINTENANCE_SERVICE_DEPENDS_ON_APP_' + (unit.includes('backup') ? 'BACKUP' : 'HEALTHCHECK'));
  }
  const openFiles = readdirSync(api.base + '/fd').flatMap(fd => { try { return [readlinkSync(api.base + '/fd/' + fd)]; } catch { return []; } });
  requireCondition(openFiles.includes(realpathSync(database)), 'API_HAS_DIFFERENT_DATABASE_OPEN');
  for (const path of [app, frontend]) requireCondition(lstatSync(path).dev === statSync(dirname(path)).dev, 'ENTRY_IS_ON_ANOTHER_FILESYSTEM');
  const gitArgs = ['-c', 'safe.directory=' + dirname(source), '-C', source];
  requireCondition(command('git', [...gitArgs, 'status', '--porcelain', '--untracked-files=no']) === '', 'TRACKED_SOURCE_HAS_LOCAL_EDITS');
  const commit = command('git', [...gitArgs, 'rev-parse', 'HEAD']);
  requireCondition(/^[a-f0-9]{40}$/.test(commit), 'INVALID_SOURCE_REVISION');
  const releaseId = commit.slice(0, 12) + '-' + new Date().toISOString().replace(/[^0-9]/g, '');
  const release = root + '/releases/' + releaseId;
  const state = root + '/deployments/' + releaseId;
  requireCondition(existsSync(join(source, 'dist/index.html')) && existsSync(join(source, 'node_modules/nodemailer/package.json')), 'RUN_STAGE_SCRIPT_FIRST');
  const releaseFiles = ['server', 'dist', 'node_modules', 'deploy', 'package.json', 'package-lock.json'];
  const needed = releaseFiles.reduce((sum, name) => sum + copySize(join(source, name)), 0) + statSync(database).size * 3 + 64 * 1024 * 1024;
  const disk = statfsSync(root);
  requireCondition(disk.bavail * disk.bsize > needed * 1.1, 'NOT_ENOUGH_DISK_SPACE_FOR_RELEASE_AND_BACKUP');
  requireCondition(configArgument(web.args) === '/etc/caddy/Caddyfile.production' || configArgument(web.args) === webFile, 'UNEXPECTED_WEB_CONFIGURATION');
  const currentConfig = configArgument(web.args);
  const originalConfig = currentConfig.endsWith('.json') ? JSON.parse(readFileSync(currentConfig, 'utf8')) : JSON.parse(command(web.binary, ['adapt', '--config', currentConfig, '--adapter', 'caddyfile']));
  const candidate = productionConfig(originalConfig, releaseId);
  const webGid = webIdentity.gid;
  await request('http://127.0.0.1:3102/api/health', { json: value => value.status === 'online' });

  phase = 'preparing the release';
  mkdirSync(root + '/releases', { recursive: true, mode: 0o755 }); chmodSync(root + '/releases', 0o755);
  mkdirSync(release, { recursive: true, mode: 0o755 });
  for (const name of releaseFiles) {
    cpSync(join(source, name), join(release, name), { recursive: true, verbatimSymlinks: true, filter: path => !basename(path).startsWith('.env') });
  }
  allowCodeReads(release);
  mkdirSync(state, { recursive: true, mode: 0o700 }); chmodSync(state, 0o700);
  const candidateFile = '/etc/caddy/eldritch-accounts-candidate-' + releaseId + '.json';
  writeAtomic(candidateFile, JSON.stringify(candidate.config, null, 2) + '\n', 0o640, webGid);
  try { command('runuser', ['-u', webIdentity.user, '-g', webIdentity.group, '--', web.binary, 'validate', '--config', candidateFile]); }
  finally { unlinkSync(candidateFile); }
  const dropin = unit => '/etc/systemd/system/' + unit + '.d/zz-eldritch-accounts.conf';
  const files = [runtimeFile, webFile, dropin(apiUnit), dropin(webUnit), dropin(mailUnit)].map((path, index) => saveFile(path, state, index));
  const snapshotFolder = root + '/data/accounts-backup-' + releaseId;
  mkdirSync(snapshotFolder, { mode: 0o700 });
  chownSync(snapshotFolder, apiIdentity.uid, apiIdentity.gid);
  const snapshot = snapshotFolder + '/before-upgrade.sqlite';
  const timerStates = Object.fromEntries([mailTimer, recoveryTimer, backupTimer].map(unit => [unit, active(unit)]));
  const metadata = { releaseId, release, snapshot, files, apiIdentity, webIdentity, phase: 'prepared', previousApp: state + '/previous-app', previousFrontend: state + '/previous-frontend' };
  const record = value => { metadata.phase = value; writeAtomic(state + '/deployment.json', JSON.stringify(metadata, null, 2) + '\n'); };
  record('prepared');
  console.log('Prepared release: ' + releaseId);
  let paused = false, servicesStopped = false, migrationStarted = false, activationAttempted = false, deployed = false;
  const runtime = send => `ELDRITCH_DB=${database}\nPORT=3102\nELDRITCH_ORIGIN=${origin}\nELDRITCH_PUBLIC_URL=${origin}\nELDRITCH_TRUST_PROXY=loopback\nELDRITCH_SEND_EMAIL=${send}\n`;
  const common = `[Service]\nWorkingDirectory=${app}\nEnvironmentFile=${runtimeFile}\n`;
  const mailConfig = verify => common + `User=${apiIdentity.user}\nGroup=${apiIdentity.group}\nExecStart=\nExecStart=${api.binary} ${app}/server/mail-worker.mjs${verify ? ' --verify' : ''}\n`;
  const start = async () => { command('systemctl', ['daemon-reload']); command('systemctl', ['start', apiUnit, webUnit]); };
  const stop = async () => { command('systemctl', ['stop', apiUnit, webUnit]); };
  try {
    phase = 'pausing scheduled workers';
    paused = true; command('systemctl', ['stop', mailTimer, recoveryTimer, backupTimer]);
    for (const unit of [mailUnit, 'eldritch-production-healthcheck.service', 'eldritch-production-backup.service']) await waitIdle(unit);
    console.log('Scheduled workers paused; stopping API and frontend for migration.');
    phase = 'backing up and migrating the live database';
    servicesStopped = true; await stop(); migrationStarted = true;
    const summary = command('runuser', ['-u', apiIdentity.user, '-g', apiIdentity.group, '--', api.binary, release + '/deploy/production-rollout.mjs', '--database-phase', database, snapshot]);
    console.log('Database backup: ' + snapshot);
    console.log('Migration PASS: ' + JSON.stringify(JSON.parse(summary)));
    record('database-migrated');
    phase = 'activating the account release';
    activationAttempted = true;
    await activateRelease({
      entries: [{ path: app, previous: metadata.previousApp, target: release }, { path: frontend, previous: metadata.previousFrontend, target: release + '/dist' }],
      configure: async () => {
        writeAtomic(runtimeFile, runtime('NO'));
        writeAtomic(webFile, JSON.stringify(candidate.config, null, 2) + '\n', 0o640, webGid);
        writeAtomic(dropin(apiUnit), common + `ExecStart=\nExecStart=${api.binary} ${app}/server/index.mjs\n`);
        writeAtomic(dropin(webUnit), `[Service]\nExecStart=\nExecStart=${web.binary} run --config ${webFile}\nExecReload=\n`);
        writeAtomic(dropin(mailUnit), mailConfig(true));
      },
      restoreConfig: async () => restoreFiles(files), stop, start,
      check: async () => {
        const local = 'http://' + candidate.listeners[0];
        for (let attempt = 0; ; attempt++) {
          try {
            await request('http://127.0.0.1:3102/api/health', { json: value => value.status === 'online' });
            for (const base of [local, origin]) {
              const suffix = '?deployment=' + releaseId;
              await request(base + '/api/health' + suffix, { releaseId, json: value => value.status === 'online' });
              await request(base + '/api/auth/me' + suffix, { releaseId, json: value => value.user === null });
              await request(base + '/resend-verification' + suffix, { releaseId, text: readFileSync(release + '/dist/index.html', 'utf8').match(/\/assets\/[^" ]+\.js/)?.[0] || 'root' });
            }
            break;
          }
          catch (error) { if (attempt >= 9) throw error; await delay(1000); }
        }
      }
    });
    deployed = true; record('accounts-live');
    console.log('Accounts live: local and public API, session lookup and account page checks passed.');
    phase = 'verifying SMTP without sending mail';
    let smtpReady = false;
    try {
      command('systemctl', ['reset-failed', mailUnit]);
      const previousStart = property(mailUnit, 'ExecMainStartTimestampMonotonic');
      command('systemctl', ['start', '--no-block', mailUnit]);
      const deadline = Date.now() + 90000;
      while (true) {
        const started = property(mailUnit, 'ExecMainStartTimestampMonotonic') !== previousStart;
        const busy = ['active', 'activating', 'deactivating', 'reloading'].includes(property(mailUnit, 'ActiveState'));
        if (started && !busy) break;
        requireCondition(Date.now() < deadline, 'SMTP_CHECK_DID_NOT_FINISH'); await delay(500);
      }
      smtpReady = property(mailUnit, 'Result') === 'success' && property(mailUnit, 'ExecMainStatus') === '0';
    } finally {
      writeAtomic(dropin(mailUnit), mailConfig(false));
      command('systemctl', ['daemon-reload']);
    }
    if (smtpReady) {
      writeAtomic(runtimeFile, runtime('YES'));
      command('systemctl', ['enable', '--now', mailTimer]);
      command('systemctl', ['start', '--no-block', mailUnit]);
      console.log('SMTP authentication verified; transactional mail timer enabled.');
      record('accounts-live-mail-enabled');
    } else {
      console.log('Accounts live; mail timer remains paused because SMTP verification failed.');
      const logs = command('journalctl', ['-u', mailUnit, '-n', '12', '--no-pager', '-o', 'cat']);
      const code = logs.match(/Mail worker failed: ([A-Z0-9_]+)/g)?.at(-1);
      if (code) console.log(code);
      record('accounts-live-mail-paused');
    }
    console.log('Recovery record: ' + state + '/deployment.json');
    console.log('Next: verify one signup and password-reset email in your own inbox.');
  } catch (error) {
    if (!deployed && servicesStopped && !activationAttempted) {
      try { await start(); } catch { console.log('Previous services could not be restarted; use the recovery record.'); }
    }
    if (!deployed && migrationStarted) {
      console.log('Mail and recovery timers remain paused. The database was not replaced or restored.');
    }
    if (deployed) console.log('The account upgrade remains live; mail needs attention.');
    record(deployed ? 'accounts-live-mail-needs-attention' : 'upgrade-stopped');
    console.log('Recovery record: ' + state + '/deployment.json');
    throw error;
  } finally {
    if (paused) {
      if (timerStates[backupTimer]) command('systemctl', ['start', backupTimer]);
      if (deployed && timerStates[recoveryTimer]) command('systemctl', ['start', recoveryTimer]);
      if (!migrationStarted) for (const unit of [mailTimer, recoveryTimer]) if (timerStates[unit]) command('systemctl', ['start', unit]);
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const action = process.argv[2] === '--database-phase'
    ? migrateWithBackup(process.argv[3], process.argv[4]).then(result => console.log(JSON.stringify(result)))
    : rollout();
  action.catch(error => {
    console.error('Upgrade stopped during ' + phase + ': ' + (error.safeCode || 'CHECK_FAILED') + '.');
    process.exitCode = 1;
  });
}
