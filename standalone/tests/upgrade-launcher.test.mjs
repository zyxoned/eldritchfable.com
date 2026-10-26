import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, chmodSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

function launch(t, gitExit, upgradeExit) {
  const folder = mkdtempSync(join(tmpdir(), 'ef-phone-launcher-')); t.after(() => rmSync(folder, { recursive: true, force: true }));
  const deploy = join(folder, 'standalone/deploy'); mkdirSync(deploy, { recursive: true });
  const script = join(deploy, 'upgrade.sh'); writeFileSync(script, readFileSync(new URL('../deploy/upgrade.sh', import.meta.url)));
  const bin = join(folder, 'bin'); mkdirSync(bin);
  const calls = join(folder, 'calls'); writeFileSync(calls, '');
  const stub = (name, content) => { const path = join(bin, name); writeFileSync(path, '#!/bin/sh\n' + content); chmodSync(path, 0o700); };
  stub('id', 'printf "1000\\n"');
  stub('git', 'exit "$EF_LAUNCHER_GIT_EXIT"');
  stub('sudo', `printf '%s\\n' "$*" >> "$EF_LAUNCHER_CALLS"
case "$1" in
  -v) exit 0;;
  systemd-run) exit "$EF_LAUNCHER_UPGRADE_EXIT";;
  journalctl) printf 'Only this attempt\\n'; exit 0;;
  *) exit 99;;
esac`);
  const result = spawnSync('bash', [script], { encoding: 'utf8', env: {
    ...process.env, PATH: bin + ':' + process.env.PATH,
    EF_LAUNCHER_GIT_EXIT: String(gitExit), EF_LAUNCHER_UPGRADE_EXIT: String(upgradeExit), EF_LAUNCHER_CALLS: calls
  } });
  return { ...result, calls: readFileSync(calls, 'utf8') };
}

test('phone launcher displays the same attempt log after a failed upgrade and preserves the failure status', t => {
  const result = launch(t, 0, 7);
  assert.equal(result.status, 7, result.stderr);
  assert.match(result.stdout, /Only this attempt/);
  const tag = result.calls.match(/SyslogIdentifier=([^\s]+)/)?.[1];
  assert.ok(tag);
  assert.ok(result.calls.includes('-t ' + tag));
  assert.match(result.calls, /--wait --collect/);
});

test('phone launcher stops on a Git failure without starting an upgrade or displaying stale logs', t => {
  const result = launch(t, 1, 0);
  assert.equal(result.status, 1);
  assert.equal(result.calls, '');
  assert.doesNotMatch(result.stdout, /Report from this upgrade attempt/);
});
