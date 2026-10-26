#!/usr/bin/env bash
set -eu
node --version
command -v node
command -v caddy >/dev/null && caddy version || true

# Print safe metadata for all Eldritch units, including separately named
# production services. Do not dump ExecStart, Environment, or secret files.
active_api_pids=()
while IFS= read -r eldritch_unit; do
  [ -n "$eldritch_unit" ] || continue
  printf '\n%s\n' "$eldritch_unit"
  unit_properties=$(systemctl show "$eldritch_unit" --no-pager \
    --property=FragmentPath --property=WorkingDirectory --property=User \
    --property=ActiveState --property=MainPID --property=EnvironmentFiles 2>/dev/null || true)
  printf '%s\n' "$unit_properties"
  if [[ "$eldritch_unit" == *api*.service ]] && printf '%s\n' "$unit_properties" | awk -F= '$1=="ActiveState" && $2=="active" {found=1} END {exit !found}'; then
    api_pid=$(printf '%s\n' "$unit_properties" | awk -F= '$1=="MainPID" {print $2}')
    if [[ "$api_pid" =~ ^[1-9][0-9]*$ ]]; then active_api_pids+=("$api_pid"); fi
  fi
done < <(
  {
    systemctl list-units --type=service --all --no-legend --plain 'eldritch*' 2>/dev/null || true
    systemctl list-unit-files --type=service --no-legend 'eldritch*' 2>/dev/null || true
  } | awk '$1 ~ /^eldritch.*\.service$/ {print $1}' | sort -u
)

systemctl list-timers --all --no-pager | awk 'NR==1 || /eldritch|mail/'
systemctl list-units --type=service --all --no-pager | awk 'NR==1 || /eldritch|caddy|cloudflared/'
# Report matching locations only; cron command lines can contain secrets.
if [ "$(id -u)" -eq 0 ]; then
  getent passwd | cut -d: -f1 | while IFS= read -r cron_user; do
    crontab -u "$cron_user" -l 2>/dev/null | awk -v owner="$cron_user" '/mail-worker|mail:run|eldritch.*mail/ {print owner ": possible cron mail-worker entry at line " NR}' || true
  done
  find /etc/cron.d /etc/cron.daily /etc/cron.hourly -maxdepth 1 -type f -exec awk '/mail-worker|mail:run|eldritch.*mail/ {print FILENAME ": possible mail-worker entry at line " NR}' {} +
else
  crontab -l 2>/dev/null | awk '/mail-worker|mail:run|eldritch.*mail/ {print "User cron mail-worker entry at line " NR}' || true
fi

# ss shows socket addresses and process identities, not command arguments.
listeners=$(ss -H -ltnp 2>/dev/null || true)
printf '\nNode and proxy TCP listeners\n'
printf '%s\n' "$listeners" | awk '/node|caddy|cloudflared/'
checked_api=0
for api_pid in "${active_api_pids[@]}"; do
  while IFS= read -r listen_address; do
    [ -n "$listen_address" ] || continue
    api_port=${listen_address##*:}
    [[ "$api_port" =~ ^[0-9]+$ ]] || continue
    case "$listen_address" in
      '[::1]:'*) api_host='[::1]' ;;
      127.0.0.1:*|0.0.0.0:*|'[::]:'*|'*:'*) api_host=127.0.0.1 ;;
      *) continue ;;
    esac
    checked_api=1
    api_url="http://$api_host:$api_port/api/health"
    printf '\nHealth check for active API PID %s: %s\n' "$api_pid" "$api_url"
    curl --connect-timeout 3 --max-time 5 --fail --silent --show-error "$api_url" || true
    printf '\n'
  done < <(printf '%s\n' "$listeners" | awk -v identity="pid=$api_pid," 'index($0,identity) {print $4}' | sort -u)
done
if [ "$checked_api" -eq 0 ]; then
  printf '\nNo loopback listener mapped to an active API main PID. Use the listener list to identify its child process or port; no default port was assumed.\n'
fi
