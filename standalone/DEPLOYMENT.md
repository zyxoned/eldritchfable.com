# Deploy the account and email repair on Linux

This release upgrades the independent store. It does not require Base44, import products, or activate checkout. Run the commands on your Linux server through the terminal you already use on your laptop or phone.

## 1. Identify the running layout

From the downloaded repository run:

```sh
sudo bash standalone/deploy/inspect.sh
```

This reports service paths, the service user, timers, and possible cron entry locations without printing environment secrets. Record the current code directory and database location. The previously documented database is /srv/eldritch-fable/data/eldritch.db; confirm this locally before using it. Preserve the working SMTP credentials.

The templates use /srv/eldritch-fable/current/standalone, /etc/eldritch-fable.env, user/group eldritch, and /usr/bin/node. Adapt these to the paths and service user shown by inspection. If Node is installed under a personal home directory, install Node 24 at a system-accessible path before using the hardened service template.

## 2. Build a separate release

Clone the repair branch into a new directory, leaving the running installation in place:

```sh
git clone --single-branch --branch fix/customer-accounts-mail https://github.com/zyxoned/eldritchfable.com.git eldritch-accounts-release
cd eldritch-accounts-release
bash standalone/deploy/stage.sh
```

The staging script installs locked dependencies, runs backend tests, builds the frontend, and migrates a new temporary database. It cannot send mail. Browser tests also run in CI; locally run npm run test:browser inside standalone after installing Chromium.

Install this checkout under a versioned directory, for example /srv/eldritch-fable/releases/<commit-sha>, using git rev-parse --short=12 HEAD as the release identifier. Keep the built standalone/dist and standalone/node_modules in that release. Give the API's existing service user read access to the release and write access to the existing data directory. Keep SMTP secrets in the existing environment file outside the checkout.

Before changing a current symlink, record its previous destination using readlink -f /srv/eldritch-fable/current. If this server does not use that symlink, point the service and Caddy at the versioned directory explicitly and record their old paths for rollback.

## 3. Environment and trusted proxy

Production configuration needs these values (edit locally; do not paste SMTP secrets into chat):

```ini
ELDRITCH_DB=/srv/eldritch-fable/data/eldritch.db
ELDRITCH_ORIGIN=https://eldritchfable.com
ELDRITCH_PUBLIC_URL=https://eldritchfable.com
PORT=3000
ELDRITCH_TRUST_PROXY=loopback
ELDRITCH_SEND_EMAIL=NO
# Retain the working SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD,
# SMTP_FROM and SMTP_TLS values.
```

The environment file should be root-owned with mode 600 and loaded using systemd's EnvironmentFile setting. The API binds only to 127.0.0.1.

In Caddy's existing reverse_proxy for /api/*, overwrite the address header:

```caddy
header_up X-Eldritch-Client-IP {client_ip}
```

Never pass through a browser-supplied address header. Caddy must derive client_ip from the actual client or a specifically trusted upstream. deploy/Caddyfile.tunnel.example is for a Cloudflare Tunnel connecting locally to Caddy on port 8080: it trusts only loopback upstreams, uses Cloudflare's client-IP header, and binds Caddy to loopback. For another topology, retain the existing trusted-proxy configuration and verify client-IP derivation before enabling ELDRITCH_TRUST_PROXY=loopback. Without the flag the API ignores forwarded addresses.

Retain SPA fallback routing for account links (try_files {path} /index.html). Set Referrer-Policy: no-referrer on frontend responses so link tokens are not forwarded in referrers. Validate changes using sudo caddy validate --config /etc/caddy/Caddyfile before reloading.

## 4. Stop old workers, back up, and migrate

Identify the old mail-worker schedules from step 1. Stop their timers/services and remove only the matching mail-worker cron entries. Wait for an active old worker to finish before migrating; do not run old and new code against this database together.

Stop the API during migration:

```sh
sudo systemctl stop eldritch-api.service
cd /srv/eldritch-fable/releases/<commit-sha>/standalone
sudo -u <existing-service-user> env ELDRITCH_DB=/srv/eldritch-fable/data/eldritch.db npm run db:migrate
```

Replace both angle-bracket placeholders with the recorded release ID and service user. Migration automatically creates a consistent, mode-600 backup in the database directory's backups folder and prints its path. Record it. Migration preserves accounts and roles, deduplicates legacy pending mail, cancels obsolete messages, and quarantines interrupted deliveries. A second migration run is safe and creates another backup.

Point the API and Caddy at the new release (or update the existing current symlink). Install/adapt deploy/eldritch-api.service, deploy/eldritch-mail.service, and deploy/eldritch-mail.timer in /etc/systemd/system. Preserve the actual service user and absolute Node path.

```sh
sudo systemctl daemon-reload
sudo systemctl start eldritch-api.service
curl --fail http://127.0.0.1:3000/api/health
sudo systemctl reload caddy
curl --fail https://eldritchfable.com/api/health
curl --fail https://eldritchfable.com/api/auth/me
sudo systemctl start eldritch-mail.service
sudo journalctl -u eldritch-mail.service -n 20 --no-pager
```

With ELDRITCH_SEND_EMAIL=NO, the mail worker reports counts and does not claim or send messages. The unauthenticated account lookup should return a null user.

## 5. Enable and verify delivery

Set ELDRITCH_SEND_EMAIL=YES in the protected environment file, then:

```sh
sudo systemctl enable --now eldritch-mail.timer
sudo systemctl start eldritch-mail.service
sudo systemctl list-timers eldritch-mail.timer --no-pager
sudo journalctl -u eldritch-mail.service -n 20 --no-pager
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
