#!/usr/bin/env bash
set -eu
node --version
command -v node
command -v caddy >/dev/null && caddy version || true
systemctl show eldritch-api.service --property=FragmentPath --property=WorkingDirectory --property=User --property=ActiveState
systemctl list-timers --all --no-pager | awk 'NR==1 || /eldritch|mail/'
systemctl list-units --type=service --all --no-pager | awk 'NR==1 || /eldritch|caddy|cloudflared/'
# Report matching line numbers only; cron command lines can contain secrets.
crontab -l 2>/dev/null | awk '/mail-worker|eldritch.*mail/ {print "User cron mail-worker entry at line " NR}' || true
if [ "$(id -u)" -eq 0 ]; then
  find /etc/cron.d /etc/cron.daily /etc/cron.hourly -maxdepth 1 -type f -exec awk '/mail-worker|eldritch.*mail/ {print FILENAME ": possible mail-worker entry at line " NR}' {} +
fi
curl --fail --silent --show-error http://127.0.0.1:3000/api/health
