# Deploy Eldritch Fable on the existing Linux server

The maintained release includes accounts, mail, Tavern, RPG/Stash and the Hollow King expansion. Product import, checkout and PostgreSQL remain separate work. Use schema version 4 as required by server/database.mjs; read [ADVENTURE.md](ADVENTURE.md) and [EXPANSION.md](EXPANSION.md) with these instructions. Repository reconciliation does not deploy this release.

## Historically verified production layout

The server inspection and migration rehearsal on October 23, 2026 confirmed:

- Node 24.22.0 at /usr/bin/node; Caddy 2.6.2; local Cloudflare Tunnel.
- /srv/eldritch-production is a symlink to /mnt/eldritch-data/production-seed. Its app and data entries are directories.
- API: eldritch-production-api.service, port 3102, /srv/eldritch-production/app/server/index.mjs. Read its service account from systemd.
- Live database: /srv/eldritch-production/data/staging.db, resolving to /mnt/eldritch-data/production-seed/data/staging.db. Despite its filename, this is the live customer database.
- Frontend: eldritch-production-web.service, /etc/caddy/Caddyfile.production, static root /srv/eldritch-production/frontend, API proxy 127.0.0.1:3102. Preserve its configured service account.
- Mail: eldritch-production-mail.service and its existing timer. Credentials are in /etc/eldritch-fable/mail.env.
- Separate production backup and healthcheck timers. The healthcheck performs recovery and must be paused during migration.
- The migrated rehearsal copy retained 3 accounts (1 customer role, 2 admins), 6 sessions and 3 sent email records. These counts can change as people use the site; migration preserves the actual current records.

The inactive eldritch-api.service and the separate legacy /etc/caddy/Caddyfile use a different layout. Leave them alone. Do not install the generic service templates alongside the production units or migrate a newly created database at the generic template path.

## Build and rehearse without changing production

First inventory the existing checkout and preserve unpublished work. After selecting an explicitly reviewed release revision, build in its clean checkout:

```sh
cd ~/eldritch-accounts-release
git status --short --branch
bash standalone/deploy/stage.sh
sudo /usr/bin/node standalone/deploy/production-check.mjs
```

For a fresh checkout, use https://github.com/zyxoned/eldritchfable.com.git and the reviewed main/release commit. A fresh clone cannot establish the state of an unavailable existing checkout. The staging script installs locked dependencies, runs tests and builds dist. It uses a new temporary database and cannot send email.

The production check confirms that the running API actually has the configured database open, reports symlink and Caddy routing paths, and migrates a consistent private snapshot. It compares every account, session, account token, newsletter record, product and collection before and after migration. It prints aggregate counts and removes the temporary copy. It does not load SMTP credentials or change the live database, configuration or services.

## Roll out the prepared release

Deployment requires explicit rollout authorization. After a successful build and rehearsal, select the exact reviewed release revision. Changes limited to deployment scripts and the mail worker do not require another frontend build. For phone terminals, run each short command separately:

```sh
cd ~/eldritch-accounts-release
```

```sh
git pull --ff-only
```

```sh
bash standalone/deploy/upgrade.sh
```

The launcher updates the checkout as the regular SSH user, runs the upgrade in a transient systemd service so it can continue after a phone disconnects, and displays logs tagged for that attempt only. If Git fails, it stops before starting the upgrade and does not display an older run's log. Do not run the launcher itself with sudo; it requests sudo for systemd.

If an older privileged source inspection left Git metadata inaccessible, repair ownership of this checkout's Git metadata while logged in as its normal owner, then repeat the update:

```sh
sudo chown -R "$(id -u):$(id -g)" ~/eldritch-accounts-release/.git
```

The corrected rollout inspects Git as the checkout owner with optional index updates disabled, so privileged deployment checks cannot replace the user's index with a root-owned file. It does not change ownership of the production app or database to the SSH user.

The script targets only the verified layout above. It resolves API and frontend users and groups from systemd through the operating system's account database, then checks their effective and filesystem IDs against the running processes. It uses these discovered identities for file permissions, database work, Caddy validation and the mail service; it does not infer usernames from screenshots. It also checks current local and public API health, the active database file, available disk space and loopback-only Caddy routing before stopping anything. It refuses a maintenance service launched from the app directory or directly referring to files inside it, so that service can be adapted first. If a preflight check stops the upgrade, share the fixed error code rather than credentials or full service configuration.

The rollout performs these steps:

1. Copy the built release and dependencies to a versioned directory under /srv/eldritch-production/releases, omitting .env files. Validate the updated routing with the installed Caddy as the frontend service user.
2. Pause the mail, recovery and backup timers. Wait for already-running jobs to finish, then stop the API and frontend for a short maintenance window.
3. Run database work with the API service's existing user and group. Resolve symlinked launch paths before deciding whether to execute the database CLI. Create a consistent mode-600 backup in a new private directory beside the live database, migrate that same database to schema version 4, compare preserved data and check integrity and foreign keys. Require a valid completion report and check that the expected backup is a private SQLite file owned by that user before printing a success message or proceeding.
4. Preserve the old app and frontend entries in a private deployment directory, then point those entries at the new release. Keep the existing production service names, API port and database path.
5. Apply service overrides and a protected shared runtime file at /etc/eldritch-fable/accounts-runtime.env. Retain the existing SMTP credential file. Run the mail worker with the API service's user and group so its SQLite files remain writable by the API user.
6. Start the API and frontend. Check API health, unauthenticated session lookup and the account route locally and through https://eldritchfable.com. A release header confirms that public requests reach the new production routing.
7. Verify SMTP connection and authentication with sending disabled. If it succeeds, enable sending and resume the existing transactional mail timer. If it fails, keep accounts live and leave mail paused with a safe error code. Resume the backup timer and, after successful account deployment, the recovery timer, including when a previous failed attempt left recovery paused.

The generated /etc/caddy/eldritch-accounts-production.json preserves the production routes, static root, listener and admin configuration. It adds Referrer-Policy: no-referrer and overwrites X-Eldritch-Client-IP from Cloudflare's CF-Connecting-IP. This trust is valid only for the verified local Cloudflare Tunnel and loopback-only origin. The API ignores arbitrary X-Forwarded-For. The separate legacy Caddy service/configuration is not reloaded or replaced.

The original /etc/caddy/Caddyfile.production remains saved in place. The production web service override explicitly uses the generated JSON and clears its previous reload command; use a production-web restart for subsequent configuration changes. A reload through the legacy Caddy admin endpoint could target the wrong process.

## Verify actual inbox delivery

A successful SMTP check confirms connection and authentication, not inbox delivery. On the HTTPS site, use your own designated address to:

1. Register and receive one verification message; verify and sign in.
2. Change the password; confirm old sessions and the old password stop working.
3. Request a reset, receive one message, complete it and sign in again.
4. Check resend behavior and the forms on a phone.

Previously sent email is not replayed. Interrupted or ambiguous SMTP deliveries are quarantined rather than blindly retried. Customers can request a fresh link through the site. Generic account responses do not disclose whether another address is registered.

SMTP can be verified without sending mail by running server/mail-worker.mjs --verify with the protected service environment. Do not source or paste the credential file into chat. Normal mail processing remains in the existing production systemd timer.

## Recovery and backups

Each rollout prints a private recovery record at /srv/eldritch-production/deployments/<release-id>/deployment.json. It records the previous app/frontend entries, original configuration snapshots and database backup path. Keep it with the backup.

If startup or public routing checks fail, the script stops the new services, selects a prepared schema-compatible recovery app, restores the prior frontend and saved service configuration, and restarts services. For schema 4 recovery, adventure endpoints pause while account, storefront and compatible stash operations remain available; see EXPANSION.md. It retains the migrated database, including any subsequent account changes. It leaves mail and recovery timers paused after a migration failure or code rollback so older recovery/queue code cannot resume automatically. It never replaces the database with an older snapshot automatically. If restoration itself fails, the script reports ROLLBACK_NEEDS_ATTENTION and the recovery record location.

For routine database tools, inside the active app directory with ELDRITCH_DB set to the verified live database:

```sh
npm run db:backup -- /absolute/path/new-backup.sqlite
npm run db:restore -- /absolute/path/backup.sqlite /absolute/path/restored-copy.sqlite
```

Restore verifies integrity, creates a separate file and refuses to overwrite an existing destination. A database rollback requires a backup of the current database first so later account changes remain recoverable. Retain copies off the server as well.
