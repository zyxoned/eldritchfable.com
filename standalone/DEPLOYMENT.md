# Deploy the account and email repair on Linux

This release upgrades the independent store. It does not require Base44, import products, or activate checkout. Run the commands on your Linux server through the terminal you already use on your laptop or phone.

The reported server uses eldritch-production-api, eldritch-production-web, eldritch-production-mail, and production backup/healthcheck timers. The older eldritch-api unit is inactive. Preserve the existing production units, separate frontend service, and their actual ports; do not start the legacy API or install parallel generic services. The healthcheck timer can restart services, so pause it together with the mail timer during migration and resume it after validation.

Verified production layout (October 23, 2026):

- API: user sentinelX, port 3102, script /srv/eldritch-production/app/server/index.mjs.
- Configured database: /srv/eldritch-production/data/staging.db. The active process has /mnt/eldritch-data/production-seed/data/staging.db open. Its filename does not make it a disposable staging database.
- App working directory resolves to /mnt/eldritch-data/production-seed/app. Confirm which parent paths are symlinks before replacing an app directory or link.
- Frontend: user sentinelX, Caddy configuration /etc/caddy/Caddyfile.production.
- Mail: working directory /srv/eldritch-production/app, user root, environment file /etc/eldritch-fable/mail.env. Preserve this file and its existing credentials.

## 1. Identify the running layout

From the downloaded repository run:

```sh
sudo bash standalone/deploy/inspect.sh
```

This discovers all Eldritch services, reports safe metadata and environment-file paths, and maps active API main PIDs to their TCP listeners. It checks the discovered loopback API ports without assuming port 3000. It also reports timers and possible cron entry locations without printing environment secrets. Record the production code directory and database location. For this server, use the verified production database above; the generic template's /srv/eldritch-fable/data/eldritch.db is not the database reported by the running API. Preserve the working SMTP credentials.

The templates use /srv/eldritch-fable/current/standalone, /etc/eldritch-fable.env, user/group eldritch, and /usr/bin/node. Adapt these to the paths and service user shown by inspection. If Node is installed under a personal home directory, install Node 24 at a system-accessible path before using the hardened service template.

## 2. Build a separate release

Clone the repair branch into a new directory, leaving the running installation in place:

```sh
git clone --single-branch --branch fix/customer-accounts-mail https://github.com/zyxoned/eldritchfable.com.git eldritch-accounts-release
cd eldritch-accounts-release
bash standalone/deploy/stage.sh
```

The staging script installs locked dependencies, runs backend tests, builds the frontend, and migrates a new temporary database. It cannot send mail. Browser tests also run in CI; locally run npm run test:browser inside standalone after installing Chromium.

For an existing repair checkout, update it with git pull --ff-only before staging. Then run this read-only production check:

```sh
sudo /usr/bin/node standalone/deploy/production-check.mjs
```

It confirms that the configured database is actually open by the running API, reports symlink destinations and selected Caddy routing paths, and takes a consistent snapshot into a private temporary directory. Only that snapshot is migrated. It verifies that every account, session, account token, newsletter record, product, and collection is preserved, prints aggregate counts without customer details, and deletes the temporary copy. It does not load SMTP credentials, send email, or change services or configuration. A successful rehearsal is not a live deployment.

Install this checkout under a versioned directory, for example /srv/eldritch-fable/releases/<commit-sha>, using git rev-parse --short=12 HEAD as the release identifier. Keep the built standalone/dist and standalone/node_modules in that release. Give the API's existing service user read access to the release and write access to the existing data directory. Keep SMTP secrets in the existing environment file outside the checkout.

Before changing a current symlink, record its previous destination using readlink -f /srv/eldritch-fable/current. If this server does not use that symlink, point the service and Caddy at the versioned directory explicitly and record their old paths for rollback.

## 3. Environment and trusted proxy

Production configuration needs these values (edit locally; do not paste SMTP secrets into chat):

```ini
ELDRITCH_DB=/srv/eldritch-fable/data/eldritch.db
ELDRITCH_ORIGIN=https://eldritchfable.com
ELDRITCH_PUBLIC_URL=https://eldritchfable.com
# Preserve the existing production PORT; identify it using inspect.sh.
ELDRITCH_TRUST_PROXY=loopback
ELDRITCH_SEND_EMAIL=NO
# Retain the working SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD,
# SMTP_FROM and SMTP_TLS values.
```

The environment file should be root-owned with mode 600 and loaded using systemd's EnvironmentFile setting. The API binds only to 127.0.0.1.

For the reported Caddy 2.6.2 with a local Cloudflare Tunnel, keep Caddy reachable only from loopback and overwrite this header in the existing API reverse_proxy:

```caddy
header_up X-Eldritch-Client-IP {http.request.header.CF-Connecting-IP}
```

Cloudflare overwrites CF-Connecting-IP; the loopback-only origin must be reachable through that tunnel, not directly from the public network. Never pass through a browser-supplied X-Eldritch-Client-IP. deploy/Caddyfile.tunnel.example uses Caddy 2.6-compatible syntax and is a new static-file layout example only. Preserve an existing production-web reverse_proxy and its actual port. For another topology, derive the header from a verified trusted client source before enabling ELDRITCH_TRUST_PROXY=loopback. Without that flag the API ignores forwarded addresses. Do not add newer trusted_proxies directives to Caddy 2.6.2.

Retain SPA fallback routing for account links (try_files {path} /index.html). Set Referrer-Policy: no-referrer on frontend responses so link tokens are not forwarded in referrers. Validate changes using sudo caddy validate --config /etc/caddy/Caddyfile before reloading.

## 4. Stop old workers, back up, and migrate

Identify the old mail-worker schedules from step 1. Stop their timers/services and remove only the matching mail-worker cron entries. Wait for an active old worker to finish before migrating; do not run old and new code against this database together.

After the actual release, database, and port have been identified, stop the production writers during migration. Set API_PORT to the port reported by the inspector before running these commands:

```sh
: "${API_PORT:?Set API_PORT to the production API listener port from inspect.sh}"
API_UNIT=eldritch-production-api.service
WEB_UNIT=eldritch-production-web.service
MAIL_UNIT=eldritch-production-mail.service
MAIL_TIMER=eldritch-production-mail.timer
RECOVERY_TIMER=eldritch-production-healthcheck.timer
sudo systemctl stop "$MAIL_TIMER" "$RECOVERY_TIMER"
# Wait for already-running mail and recovery checks to finish.
while systemctl is-active --quiet "$MAIL_UNIT"; do sleep 2; done
while systemctl is-active --quiet eldritch-production-healthcheck.service; do sleep 2; done
sudo systemctl stop "$API_UNIT" "$WEB_UNIT"
cd /srv/eldritch-fable/releases/<commit-sha>/standalone
sudo -u <existing-service-user> env ELDRITCH_DB=/srv/eldritch-fable/data/eldritch.db npm run db:migrate
```

Replace both angle-bracket placeholders with the recorded release ID and service user. Migration automatically creates a consistent, mode-600 backup in the database directory's backups folder and prints its path. Record it. Migration preserves accounts and roles, deduplicates legacy pending mail, cancels obsolete messages, and quarantines interrupted deliveries. A second migration run is safe and creates another backup.

Point the existing production API and frontend services at the new release (or update their existing release symlink). Update the production mail service's working directory and command, retaining a single mail timer. The supplied generic service templates are references for a new installation, not additional services to install alongside production. Preserve the actual service users, environment files, Node paths, production ports, Caddy routing, and backup timer.

```sh
sudo systemctl daemon-reload
sudo systemctl start "$API_UNIT" "$WEB_UNIT"
curl --fail "http://127.0.0.1:$API_PORT/api/health"
sudo systemctl reload caddy
curl --fail https://eldritchfable.com/api/health
curl --fail https://eldritchfable.com/api/auth/me
sudo systemctl start "$MAIL_UNIT"
sudo journalctl -u "$MAIL_UNIT" -n 20 --no-pager
sudo systemctl start "$RECOVERY_TIMER"
```

With ELDRITCH_SEND_EMAIL=NO, the mail worker reports counts and does not claim or send messages. The unauthenticated account lookup should return a null user.

## 5. Enable and verify delivery

Set ELDRITCH_SEND_EMAIL=YES in the protected environment file, then:

```sh
sudo systemctl enable --now "$MAIL_TIMER"
sudo systemctl start "$MAIL_UNIT"
sudo systemctl list-timers "$MAIL_TIMER" --no-pager
sudo journalctl -u "$MAIL_UNIT" -n 20 --no-pager
```

Use a designated test address on the HTTPS site. Register, receive one verification message, verify, sign in, change password, then request and complete a reset. Confirm old passwords and sessions stop working. Repeat a verification resend and confirm one pending message. Check the forms on a phone. The timer waits one minute after a batch finishes; starting the same systemd service while it runs does not spawn another instance.

Summaries distinguish pending, sent, failed, cancelled, and uncertain deliveries. Uncertain messages are not blindly replayed: request a new link through the site. Confirm actual inbox delivery before calling the live rollout complete.

## Backups and rollback

Inside the release's standalone directory, set ELDRITCH_DB to the actual database and run:

```sh
npm run db:backup -- /absolute/path/new-backup.sqlite
npm run db:restore -- /absolute/path/backup.sqlite /absolute/path/restored-copy.sqlite
```

Restore verifies integrity, creates a separate file, and refuses to overwrite a destination. Test it before release. Retain backups off the server as well.

For a code rollback, stop the mail timer, wait for the worker to finish, stop the API, restore the previous code/service/Caddy paths, validate Caddy, then restart. This release adds schema metadata and queue fields. Old queue code has no claim logic and can send duplicates, so leave its scheduler stopped.

If a database rollback is necessary, first back up the current database so accounts created after release remain recoverable. Restore the pre-migration backup to a separate filename and update ELDRITCH_DB while services are stopped. An older snapshot omits later account changes; retain the newer snapshot for recovery.
