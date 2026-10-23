# Deploy the account and email repair on the existing Linux server

This release upgrades the independent store without Base44. Product import, checkout and PostgreSQL are separate work.

## Verified production layout

The server inspection and migration rehearsal on October 23, 2026 confirmed:

- Node 24.22.0 at /usr/bin/node; Caddy 2.6.2; local Cloudflare Tunnel.
- /srv/eldritch-production is a symlink to /mnt/eldritch-data/production-seed. Its app and data entries are directories.
- API: eldritch-production-api.service, user sentinelX, port 3102, /srv/eldritch-production/app/server/index.mjs.
- Live database: /srv/eldritch-production/data/staging.db, resolving to /mnt/eldritch-data/production-seed/data/staging.db. Despite its filename, this is the live customer database.
- Frontend: eldritch-production-web.service, user sentinelX, /etc/caddy/Caddyfile.production, static root /srv/eldritch-production/frontend, API proxy 127.0.0.1:3102.
- Mail: eldritch-production-mail.service and its existing timer. Credentials are in /etc/eldritch-fable/mail.env.
- Separate production backup and healthcheck timers. The healthcheck performs recovery and must be paused during migration.
- The migrated rehearsal copy retained 3 accounts (1 customer role, 2 admins), 6 sessions and 3 sent email records. These counts can change as people use the site; migration preserves the actual current records.

The inactive eldritch-api.service and the separate legacy /etc/caddy/Caddyfile use a different layout. Leave them alone. Do not install the generic service templates alongside the production units or migrate a newly created database at the generic template path.

## Build and rehearse without changing production

In the existing repair checkout:

```sh
cd ~/eldritch-accounts-release
git pull --ff-only
bash standalone/deploy/stage.sh
sudo /usr/bin/node standalone/deploy/production-check.mjs
```

For a fresh checkout, clone the fix/customer-accounts-mail branch of https://github.com/zyxoned/eldritchfable.com.git first. The staging script installs locked dependencies, runs tests and builds dist. It uses a new temporary database and cannot send email.

The production check confirms that the running API actually has the configured database open, reports symlink and Caddy routing paths, and migrates a consistent private snapshot. It compares every account, session, account token, newsletter record, product and collection before and after migration. It prints aggregate counts and removes the temporary copy. It does not load SMTP credentials or change the live database, configuration or services.

## Roll out the prepared release

After a successful build and rehearsal, update the checkout to the latest repair revision. Changes limited to deployment scripts and the mail worker do not require another frontend build. Run the upgrade in a transient systemd service so it can continue if the phone's SSH session disconnects:

```sh
cd ~/eldritch-accounts-release &&
git pull --ff-only &&
sudo systemd-run --unit=eldritch-accounts-upgrade --wait --collect \
  /usr/bin/node "$PWD/standalone/deploy/production-rollout.mjs"
sudo journalctl -u eldritch-accounts-upgrade -n 25 --no-pager -o cat
```

The script targets only the verified layout above. It checks service users, the active database file, available disk space and loopback-only Caddy routing before stopping anything. It refuses a maintenance service launched from the app directory or directly referring to files inside it, so that service can be adapted first. If a preflight check stops the upgrade, share the fixed error code rather than credentials or full service configuration.

The rollout performs these steps:

1. Copy the built release and dependencies to a versioned directory under /srv/eldritch-production/releases, omitting .env files. Validate the updated routing with the installed Caddy as the frontend service user.
2. Pause the mail, recovery and backup timers. Wait for already-running jobs to finish, then stop the API and frontend for a short maintenance window.
3. Run database work as sentinelX. Create a consistent mode-600 backup in a new private directory beside the live database, migrate that same database to schema version 2, compare preserved data and check integrity and foreign keys. Print the backup path.
4. Preserve the old app and frontend entries in a private deployment directory, then point those entries at the new release. Keep the existing production service names, API port and database path.
5. Apply service overrides and a protected shared runtime file at /etc/eldritch-fable/accounts-runtime.env. Retain the existing SMTP credential file. Run the mail worker as sentinelX so its SQLite files remain writable by the API user.
6. Start the API and frontend. Check API health, unauthenticated session lookup and the account route locally and through https://eldritchfable.com. A release header confirms that public requests reach the new production routing.
7. Verify SMTP connection and authentication with sending disabled. If it succeeds, enable sending and resume the existing transactional mail timer. If it fails, keep accounts live and leave mail paused with a safe error code. Resume the backup timer and, after successful account deployment, the recovery timer.

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

If startup or public routing checks fail, the script stops the new services, restores the previous app/frontend entries and saved service configuration, and restarts the previous services. It retains the migrated database, including any subsequent account changes. It leaves mail and recovery timers paused after a migration failure or code rollback so older recovery/queue code cannot resume automatically. It never replaces the database with an older snapshot automatically. If restoration itself fails, the script reports ROLLBACK_NEEDS_ATTENTION and the recovery record location.

For routine database tools, inside the active app directory with ELDRITCH_DB set to the verified live database:

```sh
npm run db:backup -- /absolute/path/new-backup.sqlite
npm run db:restore -- /absolute/path/backup.sqlite /absolute/path/restored-copy.sqlite
```

Restore verifies integrity, creates a separate file and refuses to overwrite an existing destination. A database rollback requires a backup of the current database first so later account changes remain recoverable. Retain copies off the server as well.
