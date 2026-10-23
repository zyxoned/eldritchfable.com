#!/usr/bin/env bash
# Build and validate a release without changing the running API or customer DB.
set -euo pipefail
source_root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
cd "$source_root"
test "$(node -p 'Number(process.versions.node.split(".")[0])')" -ge 24
npm ci --no-audit --no-fund
npm test
npm run build
staging_dir=$(mktemp -d)
ELDRITCH_DB="$staging_dir/staging.db" npm run db:migrate
ELDRITCH_DB="$staging_dir/staging.db" ELDRITCH_SEND_EMAIL=NO npm run mail:run
printf 'Staging database retained at %s\n' "$staging_dir/staging.db"
