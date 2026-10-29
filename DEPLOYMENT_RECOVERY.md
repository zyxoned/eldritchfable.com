# Deployment and recovery

Verified 2026-10-29 from the actual Eldritch Fable host and preserved source. This is a runbook, not authorization to execute it. The current task permits repository reconciliation and publication of source/recovery documentation only: no deployment, merge to main, service/configuration changes, database backup/migration/restore, mail sending, or checkout replacement. No deployment, database recovery or migration commands in this document were executed. Build/test and read-only audit commands were executed as recorded in PROJECT_STATE.md. Verification used read-only service/file/HTTP checks and a schema-version-only SQLite query; no customer rows or credential values were read.

## Verified live baseline

The application is the existing React/Vite frontend in `standalone/`, with a Node API. Do not replace it with a separate Next.js application.

| Item | Verified value |
| --- | --- |
| Production root | `/srv/eldritch-production` -> `/mnt/eldritch-data/production-seed` |
| Backend app symlink | `/srv/eldritch-production/releases/f05b81a0ff9d-20261027013515284` |
| Backend source | `f05b81a0ff9d60fa39aff635d7164623f2256eb9` |
| Frontend symlink | `/srv/eldritch-production/frontend-releases/welcome-2011d09558ba-20261027T064119Z` |
| Frontend source | `2011d09558baa37d90820aeae4aab3eab473e6b6`, tree `cb0e9678169d73691ae81d792de19353d1e4cc8e` |
| Live database | `/srv/eldritch-production/data/staging.db` -> `/mnt/eldritch-data/production-seed/data/staging.db`; production data despite its filename |
| Live schema | `MAX(schema_migrations.version) = 3` |
| API | `eldritch-production-api.service`, user/group `sentinelx`, PID `171468`, `/usr/bin/node`, loopback `127.0.0.1:3102` |
| Web | `eldritch-production-web.service`, user/group `sentinelx`, PID `176320`, Caddy, loopback `127.0.0.1:8081` |
| Tunnel | `cloudflared.service`, PID `208694` (started 2026-10-29 00:00:08 UTC) |

All three services were active/running with zero systemd restarts. PIDs are observations, not permanent configuration. Healthcheck, backup and mail timers were active/waiting; their latest service runs succeeded.

All 29 live frontend files match the private deployment record. All 27 deployed backend `server/`, `deploy/`, package and lock files match both the f05 backend source and 2011 frontend source. Current and retained public assets match recorded SHA256 and JavaScript/CSS MIME types over verified HTTPS.

`https://eldritchfable.com/frontend-release.json` identifies the sources above. Current assets are `/assets/index-2UOoNik7.js` and `/assets/index-BwJdG0lZ.css`. Retained f05 assets are `/assets/index-DnKOBEEe.js` and `/assets/index-Cz86U8Qb.css`. Actual client routes include `/account`, `/play` and `/stash`; a 200 response for an arbitrary SPA fallback path does not prove that route exists in React.

Caddy uses `/etc/caddy/eldritch-accounts-production.json`, admin disabled, static root `/srv/eldritch-production/frontend`, API upstream `127.0.0.1:3102`. Its SHA256 is `af1a3ca140fdfc7c696b65b21b03eb881e8b5df6da4809183b08170d2c5c02d0`. Headers identify the backend release and welcome frontend separately. Only the frontend release header differs from the welcome rollout's saved prior Caddy config. Public HTML can contain Cloudflare challenge-platform injection, so compare app assets and markers rather than requiring the public HTML hash to equal the local file.

## Source provenance and preserved artifacts

GitHub main on October 29 is `2d708248a9e812195d4e4e9177da85aaa33d7589`, tree
`40647f991fbbcbfcc75cd104106d1a8a26b133ad`. PR #7 already merged the preferred
`6b898d2d682cc974f7c580e9e19d13f52c4ea2ff` implementation, the exact phone fix
`9f8e083ff0c16aaa1afcc04dcb9b04f093792a53`, and prior audit documentation while
retaining main's CI, lockfile and artwork. It requires schema 4 and is ahead of
production. Main's build, 69 backend tests and 30 browser tests passed in
[40677370441](https://github.com/zyxoned/eldritchfable.com/actions/runs/40677370441).

The initial October 28 audit observed main at `a7edfd1ed11e1d3cdbe4c216fb135dc81a37e55d`,
which was behind the deployed realm/welcome source. That is historical provenance,
not the current branch head. The remaining CANDY recovery/documentation PR changes
no application runtime source. Obtain its exact reviewed commit from the PR and
verify its ancestry before any future deployment; do not blindly deploy an older
worktree or a moving branch name. See [PROJECT_STATE](PROJECT_STATE.md) and
[exact differences](SOURCE_RECONCILIATION.md).

| Artifact | SHA256 / identity |
| --- | --- |
| `/srv/eldritch-production/frontend-deployments/welcome-2011d09558ba-20261027T064119Z/source.bundle` | `25498e99d53502681d6e66e2923615ae08a197cc801cd70799b4ea526d7bc7c2`; complete history, HEAD 2011, `git bundle verify` passed |
| Same bundle in `/srv/eldritch-staging/rollout-welcome-2011d09558ba-20261027T064119Z/source.bundle` | Identical hash |
| `/srv/eldritch-staging/reconcile-20261028T031715Z/preserved/02-rpg-release-7c5068bdb17b/history.bundle` | `ff87cf7b6c09cf52b677991c84b3c628c38dd384b830d152e0ecd7d96f038493`; preserved detached HEAD 6b898d2 |
| `/srv/eldritch-staging/reconcile-20261028T031715Z/preserved/03-rpg-rollout-safety-20261027/history.bundle` | `d1119a8594c1f5e27f48f9b4164497d8a7211ff36e89905865062d9e0f715edc` |
| Welcome deployment record | `/srv/eldritch-production/frontend-deployments/welcome-2011d09558ba-20261027T064119Z/deployment.json`, SHA256 `9665b9707352bb5e1518d96f5225d39c083cd54da0c27e887ce1b218f68aabd2` at audit; phase `live` |

The preservation root also contains `preservation.json`, `inventory-before.json`, `inventory-complete.json`, per-checkout manifests, patches, working-source archives, eight Git history bundles, five common object-store archives including reflogs/unreachable objects, the unborn prototype, and operational helper copies. Preserve these independently of a GitHub push. Do not garbage-collect, reset or replace original workspaces to reconcile source.

Production frontend deployment records are in mode-0700 directories, with mode-0600 source bundles, saved configuration and rollback scripts. Keep them private. Deployment metadata is mutable after a later rollback; the hash above describes the observed state, not an immutable future value.

## Recover and build source in new isolated directories

These commands are examples for a separately authorized recovery/build session. Run as the regular build account with authorized read access to the private archives; do not loosen archive permissions or run dependency installation as root. Do not copy protected environment files into a source checkout.

To build the reconciled repository later, clone `https://github.com/zyxoned/eldritchfable.com.git` into a new directory and detach at the exact reviewed reconciliation commit. Re-read its SHA and PR/CI result first; main already contains the 2011/6b ancestry, but repository inclusion does not establish deployment or authorize one.

To recover the exact deployed source without depending on GitHub refs:

```sh
umask 077
recovery_root=$(mktemp -d /srv/eldritch-staging/recovery-XXXXXXXX)
live_bundle=/srv/eldritch-staging/rollout-welcome-2011d09558ba-20261027T064119Z/source.bundle
printf '%s  %s\n' 25498e99d53502681d6e66e2923615ae08a197cc801cd70799b4ea526d7bc7c2 "$live_bundle" | sha256sum -c -
git clone --no-checkout "$live_bundle" "$recovery_root/frontend"
git -C "$recovery_root/frontend" checkout --detach 2011d09558baa37d90820aeae4aab3eab473e6b6
git -C "$recovery_root/frontend" bundle verify "$live_bundle"
git -C "$recovery_root/frontend" rev-parse HEAD HEAD^{tree}
git clone --no-checkout "$live_bundle" "$recovery_root/backend"
git -C "$recovery_root/backend" checkout --detach f05b81a0ff9d60fa39aff635d7164623f2256eb9
```

The bundle contains the f05 ancestor as well as 2011. The two recovered checkouts deliberately retain the two production identities even though their backend files are identical.

For either recovered checkout, or the reviewed reconciliation candidate, use Node 24 or newer as required by package.json. The audited host had Node `v24.22.0` and npm `11.19.1`; use those versions when investigating byte-level build differences.

```sh
# Set this to ONE newly recovered checkout, not an original workspace.
checkout_root="$recovery_root/frontend"
cd "$checkout_root/standalone"
node --version
npm --version
npm ci --no-audit --no-fund
npm run build
node --check server/index.mjs
npm test
npx playwright install chromium
mkdir -m 700 "$recovery_root/browser"
ELDRITCH_BROWSER_DB="$recovery_root/browser/accounts.db" ELDRITCH_SEND_EMAIL=NO npm run test:browser
git status --short
```

Use a new browser directory/database for each checkout. Browser tests start isolated loopback servers on 4317/4318 and create their own test database; ensure those ports are free. On a dedicated CI/build runner that lacks browser system dependencies, the checked-in workflow uses `npx playwright install --with-deps chromium`; do not install system packages on production as part of source reconciliation. Existing server-local private browser libraries/cache are operational conveniences, not source dependencies.

`npm ci` uses package-lock.json. A successful build alone does not establish production identity: compare the generated current JS/CSS and public assets with the welcome record, and investigate any difference before considering a release. Generated `frontend-release.json` and retained prior hashed assets are deployment additions, not outputs of a plain Vite build. For exact artifact recovery, the welcome staging bundle's `frontend/` payload and the live immutable frontend directory contain the 29 recorded files; verify every file against `deployment.json.files` before copying into a new private candidate.

Building f05 should be checked against its recorded assets DnKOBEEe/Cz86U8Qb; building 2011 against 2UOoNik7/BwJdG0lZ. Do not silently relabel a rebuilt artifact with an old commit/release if its bytes differ.

## Future migration rehearsal: explicit separate authorization required

Do not point candidate migration code at the live database during this task. Live schema is 3; current main and candidate6b require 4. Starting the schema-4 API against schema 3 is not a migration plan. Schema 4 rebuilds the character table, adds regular classes/skills, a separate administrator avatar, world effects and request actor scope. Earlier client/server code cannot safely handle all newly persisted classes.

First obtain authorization to create/use a consistent private SQLite backup and to read its data for the rehearsal. Use an existing verified consistent backup or the current backend's supported `database-tools.mjs backup <new-target>` command in that separately authorized operation. A raw copy of only the open `staging.db` file can omit committed WAL changes. Keep snapshots/private working copies mode 0600 inside mode-0700 directories; never commit or attach them to a PR. This runbook does not create a live backup.

Actual supported database-tool forms, confirmed in both current production and candidate source, are:

```text
ELDRITCH_DB=/absolute/database node server/database-tools.mjs backup [new-target.sqlite]
ELDRITCH_DB=/absolute/database node server/database-tools.mjs migrate
ELDRITCH_DB=/absolute/database node server/database-tools.mjs restore /absolute/source.sqlite /absolute/new-target.sqlite
```

`backup` reads the configured source read-only and uses Node's SQLite online-backup API. `restore` copies its explicit source to a NEW target; it refuses an existing destination. It still requires ELDRITCH_DB to be set, although that value is not the restore source. `migrate` mutates ELDRITCH_DB and first creates a private backup when the database exists. There is no `--dry-run`, `--check` or `--force` option.

Recover the historical expansion baseline separately, after verifying the archive hash above. This restores 6b, not the final reconciliation; use the reviewed final GitHub commit for a future deployment:

```sh
candidate_bundle=/srv/eldritch-staging/reconcile-20261028T031715Z/preserved/02-rpg-release-7c5068bdb17b/history.bundle
git clone --no-checkout "$candidate_bundle" "$recovery_root/candidate"
git -C "$recovery_root/candidate" checkout --detach 6b898d2d682cc974f7c580e9e19d13f52c4ea2ff
```

After installing/building/testing that isolated candidate, set `private_snapshot` to the authorized, consistent PRIVATE SQLite snapshot, not a production path. The exported rehearsal function migrates a second temporary copy and removes that copy on completion; it does not migrate the input snapshot. This command imports the helper instead of invoking the production-inspecting CLI:

```sh
cd "$recovery_root/candidate/standalone"
mkdir -m 700 "$recovery_root/rehearsal-tmp"
TMPDIR="$recovery_root/rehearsal-tmp" node --input-type=module - "$private_snapshot" <<'JS'
process.umask(0o077);
const { rehearseMigration } = await import('./deploy/production-check.mjs');
const result = await rehearseMigration(process.argv[2]);
if (result.schemaVersion !== 4 || result.preserved !== true) throw Error('REHEARSAL_FAILED');
console.log(JSON.stringify({ schemaVersion: result.schemaVersion, preserved: result.preserved }));
JS
```

The helper checks integrity, foreign keys and fingerprints of pre-existing columns/rows, so additive columns do not falsely look like data loss. Keep its results private; do not print customer rows, tokens, addresses, table dumps or underlying process/config errors. The command above intentionally reports only schema version and preservation status.

For a persistent migrated PRIVATE copy needed for recovery validation, first use the supported `restore` command to a new private working file, then call the exported `migrateWithBackup(workingFile, newPrivateBeforeSnapshot)` from candidate `production-rollout.mjs`. Do not invoke that module as the CLI to perform an offline check. The candidate's `tests/production-rollout.test.mjs` exercises populated schema-3 migration, schema-compatible fallback, startup failure after migration, and retention of accounts/game funds; run the complete tests and browser suite before any separately proposed live rollout.

## Future full deployment sequence (not executed)

This sequence is for a separately authorized operation, after review of the exact
commit and a migration/recovery plan. Do not run it during source reconciliation.
Stop on any mismatch; do not substitute a moving branch tip for the reviewed SHA.

1. Set `REVIEWED_COMMIT` to the full reviewed/accepted PR commit; verify it is in
   main and its successful CI. Recheck current production symlinks, manifest,
   schema, services, configuration fingerprints and rollback records.
2. In a Bash session, recover source into a new private build directory as the regular build account. Keep this session and its `release_build` path for the later reviewed steps:

```sh
set -euo pipefail
: "${REVIEWED_COMMIT:?Set the full reviewed 40-character commit SHA first}"
[[ "$REVIEWED_COMMIT" =~ ^[0-9a-f]{40}$ ]]
umask 077
release_build=$(mktemp -d /srv/eldritch-staging/release-build-XXXXXXXX)
git clone https://github.com/zyxoned/eldritchfable.com.git "$release_build/repo"
git -C "$release_build/repo" checkout --detach "$REVIEWED_COMMIT"
test "$(git -C "$release_build/repo" rev-parse HEAD)" = "$REVIEWED_COMMIT"
git -C "$release_build/repo" merge-base --is-ancestor "$REVIEWED_COMMIT" origin/main
bash "$release_build/repo/standalone/deploy/stage.sh"
cd "$release_build/repo/standalone"
node --check server/index.mjs
npx playwright install chromium
ELDRITCH_BROWSER_DB="$release_build/browser.db" ELDRITCH_SEND_EMAIL=NO npm run test:browser
git status --short
```

3. Rehearse schema 3 -> 4 and a schema-compatible fallback using the private
   snapshot/helper procedure above, importing helpers from the reviewed
   `$release_build/repo/standalone` checkout, not the historical 6b example. Check integrity and foreign keys, preserved
   account/session/mail/game data, fallback account/stash authorization and the
   intended realm-maintenance behavior. Do not use the live database for rehearsal.
4. Before activation, retain the currently served hashed JS/CSS assets in the NEW
   checkout's `standalone/dist/assets/` alongside the new ones. Read the current
   frontend assets only; verify source hashes against its private deployment record,
   refuse conflicting destination hashes, and record retained files/hashes with
   the new release. The full rollout copies dist but does not automatically carry
   older hashed assets. Without this step cached HTML can receive SPA HTML instead
   of its old JavaScript. Do not rebuild dist afterward without repeating retention.
5. Review the clean tracked-source status, built/retained artifact hashes, private
   backup location and generated fallback plan. The rollout below is the action
   requiring deployment authorization; it changes live data/services and can
   enable queued transactional email. It uses the existing protected bindings.

```sh
sudo /usr/bin/node "$release_build/repo/standalone/deploy/production-rollout.mjs"
```

6. Record its generated release ID, exact Git commit, private deployment.json,
   consistent backup and compatible rollback path before considering it complete.
   Verify public frontend-release.json and both release headers agree with that
   ID, current/retained assets have correct hashes/MIME, HTTPS works, API/schema
   match the reviewed source, timers have intended states, and a designated
   account exercise succeeds. Real signup/reset/inbox testing creates records and
   sends mail; include that explicitly in the future rollout scope.
7. If activation fails, use the recorded schema-compatible CODE fallback while
   retaining the migrated database and subsequent writes. Leave mail/recovery
   timers paused when required by the failure record. Never restore an old SQLite
   snapshot automatically. Follow the semantics below and investigate failures
   before retrying any operation.

The snippet is reproducible command syntax, not proof that migration of the live
customer data has been rehearsed. That private-data rehearsal is intentionally
outstanding. `production-rollout.mjs --help` is unsafe: unknown flags enter rollout.

## Rollback and activation semantics

Current welcome frontend-only recovery record:

```text
/srv/eldritch-production/frontend-deployments/welcome-2011d09558ba-20261027T064119Z/deployment.json
/srv/eldritch-production/frontend-deployments/welcome-2011d09558ba-20261027T064119Z/caddy-before.json
/srv/eldritch-production/frontend-deployments/welcome-2011d09558ba-20261027T064119Z/rollback-frontend.py
```

The inspected script accepts no flags. A future authorized operator would run that exact script with Python3 as root, after rechecking that welcome is still current. It locks `.frontend-rollout.lock`, refuses a later frontend or backend, checks the frontend release header, pauses the healthcheck timer if active, waits up to 30 seconds for an existing healthcheck job, atomically restores frontend/config, restarts web only, retries local health and asserts the API PID did not change, then restores the prior healthcheck-timer state.

Its prior frontend is `/srv/eldritch-production/releases/f05b81a0ff9d-20261027013515284/dist`, not the Oct26 0f Tavern directory. The app must still point to the f05 release. Compare API PID immediately before/after any frontend-only action; observed PID171468 is a baseline, not permission to act if it later changes. Inspect manifest, asset hashes/MIME, TLS/public headers, account/play/stash routes and browser behavior after recovery; the saved script's own final health check covers API health, not complete frontend behavior.

A new frontend-only rollout must retain every currently referenced old hashed asset because Caddy falls back to index.html for unknown paths. Coordinate only the healthcheck timer, leave API/cloudflared/mail/backup unchanged, preserve source bundle and rollback/config snapshots privately, and use readiness retries after restarting web. Caddy admin is disabled; do not assume a reload command works.

Current backend deployment state is `/srv/eldritch-production/deployments/f05b81a0ff9d-20261027013515284/deployment.json`, phase `accounts-live-mail-enabled`. Its pre-upgrade SQLite snapshot exists privately at `/srv/eldritch-production/data/accounts-backup-f05b81a0ff9d-20261027013515284/before-upgrade.sqlite`. Its prepared backend rollback release is `/srv/eldritch-production/releases/f05b81a0ff9d-20261027013515284-rollback`: it preserves the older45fb API except for schema-3 `server/database.mjs` and migration003. The untouched45fb release alone cannot open the migrated schema-3 database.

That EXISTING rollback release is not a schema-4 fallback. For a future schema-4 deployment, candidate `prepareRollbackApp(previousApp, nextApp, newTarget)` creates a fresh compatible fallback: it copies the previous app, installs candidate database code/all migrations/shared files, preserves its legacy game handler, and wraps game routing. Authenticated stash/exchange remain available; incompatible realm routes return `503 REALM_MAINTENANCE`. Unauthenticated game requests still require sign-in. Rehearse this behavior on private data before approving any live migration.

`activateRelease(...)` and `useRollbackAppAfterMigration(...)` select compatible code after activation failure or a migration that committed before its report failed. They preserve the migrated database and later customer writes. Never automatically restore/downgrade SQLite to roll back code. A deliberate data restore would require separate recovery authorization, a current consistent backup and a plan for writes created after the chosen snapshot.

## CLI boundaries and protected operational bindings

Both production and candidate `deploy/production-rollout.mjs` have only two entry modes: no recognized special argument enters the FULL LIVE rollout; `--database-phase <filename> <snapshot>` performs backup plus migration on that explicit database. Unrecognized arguments such as `--dry-run` or `--help` also enter the live rollout. Do not use guessed flags. `deploy/production-check.mjs` accepts no flags; directly executing it reads live process configuration and rehearses on a copied live database. Import only its helper for the authorized private-snapshot procedure above.

`bash standalone/deploy/stage.sh` builds/tests, creates and migrates a temporary database, and invokes mail-worker behavior with sending disabled. `bash standalone/deploy/upgrade.sh` is a live upgrade launcher: it pulls the current checkout, requests sudo and starts `production-rollout.mjs` in a transient systemd unit. Neither was executed for this task. In particular, the upgrade launcher is not a source-inspection command.

A full rollout also changes app/frontend entries, protected runtime/systemd/Caddy bindings, coordinates mail/health/backup timers, migrates production, verifies SMTP and can enable/send queued mail. It requires a separately reviewed concrete release and explicit operational authorization; source publication or a green PR does not authorize it.

Preserve the existing protected bindings through the operational configuration/backup mechanism, not source control: `/etc/eldritch-fable/accounts-runtime.env`, `/etc/eldritch-fable/mail.env`, the Caddy JSON, API/web/mail systemd drop-ins including SSD-mount bindings, and Cloudflare tunnel configuration. Restore credentials via their existing protected bindings; never print, commit, copy into a web artifact, or replace them with example values. Production state/config snapshots also contain protected material and stay private.

Current reconciliation leaves these bindings, service identities, app/frontend symlinks, timers, live schema/data and public runtime untouched. Recheck actual GitHub head and all runtime identities before a future implementation or recovery session.
