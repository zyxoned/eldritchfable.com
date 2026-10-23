import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, chmodSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

function inspect(t, active) {
  const folder = mkdtempSync(join(tmpdir(), 'ef-inspection-'));
  t.after(() => rmSync(folder, { recursive: true, force: true }));
  const tool = (name, script) => { const path = join(folder, name); writeFileSync(path, '#!/bin/sh\n' + script); chmodSync(path, 0o700); };
  tool('node', 'echo v24.22.0'); tool('caddy', 'echo 2.6.2'); tool('id', 'echo 1000'); tool('crontab', 'exit 1');
  tool('systemctl', `case "$1" in
    list-units|list-unit-files) printf '%s\\n' 'eldritch-api.service disabled' 'eldritch-production-api.service enabled' 'eldritch-production-web.service enabled' 'eldritch-production-mail.service enabled';;
    show) case "$2" in
      eldritch-production-api.service) printf '%s\\n' 'ActiveState=${active ? 'active' : 'inactive'}' 'MainPID=1234' 'WorkingDirectory=/srv/production/current' 'User=eldritchadmin' 'EnvironmentFiles=/etc/production.env (ignore_errors=no)';;
      *) printf '%s\\n' 'ActiveState=inactive' 'MainPID=0';;
    esac;;
    *) exit 0;;
  esac`);
  tool('ss', `printf '%s\\n' 'LISTEN 0 511 127.0.0.1:4318 0.0.0.0:* users:(("node",pid=1234,fd=21))' 'LISTEN 0 511 127.0.0.1:4317 0.0.0.0:* users:(("node",pid=5678,fd=22))'`);
  tool('curl', 'printf "%s\\n" "$*" >> "$CURL_CALLS"\nprintf "{\\"status\\":\\"online\\"}\\n"');
  const calls = join(folder, 'calls.txt'); writeFileSync(calls, '');
  const result = spawnSync('bash', [new URL('../deploy/inspect.sh', import.meta.url).pathname], { env: { ...process.env, PATH: folder + ':' + process.env.PATH, CURL_CALLS: calls }, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  return { output: result.stdout, calls: readFileSync(calls, 'utf8') };
}
test('inspection finds the active production API and its actual port, leaving the legacy unit alone', t => {
  const result = inspect(t, true);
  assert.match(result.output, /eldritch-production-api\.service/);
  assert.match(result.output, /WorkingDirectory=\/srv\/production\/current/);
  assert.match(result.calls, /http:\/\/127\.0\.0\.1:4318\/api\/health/);
  assert.doesNotMatch(result.calls, /:3000|:4317/);
});
test('inspection never assumes a default port when no active API can be mapped', t => {
  const result = inspect(t, false);
  assert.equal(result.calls, '');
  assert.match(result.output, /no default port was assumed/);
});
