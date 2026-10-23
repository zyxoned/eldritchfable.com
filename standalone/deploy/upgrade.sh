#!/usr/bin/env bash
# A short command for phone terminals; the privileged job survives SSH loss.
set -euo pipefail

main() {
  if [ "$(id -u)" -eq 0 ]; then
    printf 'Run this launcher as your regular SSH user: bash standalone/deploy/upgrade.sh\n' >&2
    return 1
  fi
  local checkout_root upgrade_log_tag upgrade_exit
  checkout_root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd -P)
  cd "$checkout_root"
  printf 'Updating the repair checkout...\n'
  git pull --ff-only
  sudo -v
  upgrade_log_tag="eldritch-accounts-upgrade-$(date -u +%Y%m%d%H%M%S)-$$"
  printf 'Starting the upgrade. Preparing files can take several minutes.\n'
  if sudo systemd-run --unit=eldritch-accounts-upgrade --wait --collect \
    --property="SyslogIdentifier=$upgrade_log_tag" \
    /usr/bin/node "$checkout_root/standalone/deploy/production-rollout.mjs"; then
    upgrade_exit=0
  else
    upgrade_exit=$?
  fi
  printf '\nReport from this upgrade attempt:\n'
  sudo journalctl -u eldritch-accounts-upgrade.service -t "$upgrade_log_tag" \
    -n 25 --no-pager -o cat
  return "$upgrade_exit"
}

main "$@"
