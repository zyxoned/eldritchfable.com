# Eldritch Fable project state

Verified 2026-10-29 UTC against GitHub, the actual CANDY checkouts and production.
Maintained repository: [zyxoned/eldritchfable.com](https://github.com/zyxoned/eldritchfable.com).
Public site: https://eldritchfable.com. `zyxoned.github.io` belongs to the separate
Pine Kind project.

## Authoritative source

| Evidence | Full identity |
| --- | --- |
| Current GitHub main | `2d708248a9e812195d4e4e9177da85aaa33d7589` |
| Main source tree | `40647f991fbbcbfcc75cd104106d1a8a26b133ad` |
| Merged reconciliation PR | [#7](https://github.com/zyxoned/eldritchfable.com/pull/7), merged 2026-10-28 11:06:29 UTC |
| Reconciliation head retained in main history | `8bb99d2e9023f3cbe4f9c60108a3dd37d19b6ab8` |
| Preferred verified CANDY implementation | `6b898d2d682cc974f7c580e9e19d13f52c4ea2ff` |
| Preferred original checkout | `/srv/eldritch-staging/rpg-release-7c5068bdb17b`, clean detached HEAD |
| Phone-header correction included in main | `9f8e083ff0c16aaa1afcc04dcb9b04f093792a53` |
| Prior agent/state documentation included in main | `d4f9ada7c735ca0b6f5629b3bbeea189003373e6` |
| Original main before reconciliation | `a7edfd1ed11e1d3cdbe4c216fb135dc81a37e55d` |
| Remaining recovery/documentation branch | `reconcile/candy-recovery-20261029` |
| Review checkout | `/srv/eldritch-staging/reconcile-20261028T031715Z/repo-final` |

Main already integrates the preferred implementation, approved Tavern React/Vite
design, whole-wordmark phone fix, account/mail repairs and schema-4 expansion.
All original remote branch histories remain. The reconciliation retained main's
CI workflow, package lock and artwork. The only runtime/test differences from
`6b898d2` are the exact two phone-fix blobs. See [the file comparison](SOURCE_RECONCILIATION.md).

The remaining PR adds previously unpublished recoverable CANDY source and verified
operational evidence; it changes no application runtime code. Its identity is in
git history and the PR head, rather than a self-referential SHA in this file.
This task did not merge main, force-push, deploy, restart services, migrate or
restore production, change protected configuration, or send email. PR #7 was
already merged when work resumed on October 29.

The managed `/workspace` environment was again observed pending/offline on
October 29. No accessible checkout or unpublished files could be inspected there.
CANDY was accessible through SentinelX. A fresh clone was not used to infer the
state of the original checkouts: they were independently inventoried and preserved.

## Verified production

| Component | Verified identity |
| --- | --- |
| Frontend source | `2011d09558baa37d90820aeae4aab3eab473e6b6` |
| Frontend release | `welcome-2011d09558ba-20261027T064119Z` |
| Frontend source tree | `cb0e9678169d73691ae81d792de19353d1e4cc8e` |
| Backend source | `f05b81a0ff9d60fa39aff635d7164623f2256eb9` |
| Backend release | `f05b81a0ff9d-20261027013515284` |
| Live SQLite migration version | **3** |
| Main migration version | **4**, including `004-class-chronicle.sql` |

The October 28 file audit matched all 29 frontend files to the deployment record
and all 27 backend server/deploy/package files to the recorded backend commit.
The October 29 recheck confirms the same source/releases, public manifest,
current JS/CSS assets, local/public API health, verified HTTPS, and account/play/stash
HTML routes. HTTP route checks establish availability; complete account/game flows
were exercised against isolated test data, not live customer records.

Production resolves from `/srv/eldritch-production` to
`/mnt/eldritch-data/production-seed`. API PID 171468 and web PID 176320 are unchanged,
active/running, with zero systemd restarts. Cloudflared PID 208694 has been active
since 2026-10-29 00:00:08 UTC; its earlier PID was 83102. Mail, backup and healthcheck
timers are active/waiting with latest jobs successful. PIDs are dated observations.
The API binds loopback 3102; Caddy binds loopback 8081 and has its admin endpoint
disabled. Caddy configuration SHA256 remains
`af1a3ca140fdfc7c696b65b21b03eb881e8b5df6da4809183b08170d2c5c02d0`.

The complete private production source bundle remains SHA256
`25498e99d53502681d6e66e2923615ae08a197cc801cd70799b4ea526d7bc7c2`.
`/srv/eldritch-production/data/staging.db` is the live customer database despite its
filename. Only schema metadata was queried read-only. No customer rows, secret
values or production databases are included in this repository.

## Preserved workspaces

All rows refer to the pre-reconciliation inventory. Original checkouts, branches,
indexes and worktree files were left in place. The October 29 refresh verified
all nine HEADs, 1,066 original source files and four operational helpers unchanged.
Four local CSS/spec backups and five historical audit source/report files were
subsequently discovered and privately preserved before archival.

| Checkout | HEAD / branch | Original source changes |
| --- | --- | --- |
| `/home/eldritchadmin/eldritch-accounts-release` | `45fb85d21236557c0abb65d6049976fd9a7d4392`, `fix/customer-accounts-mail` | clean |
| `/srv/eldritch-staging/rpg-release-7c5068bdb17b` | `6b898d2d682cc974f7c580e9e19d13f52c4ea2ff`, detached | clean |
| `/srv/eldritch-staging/rpg-rollout-safety-20261027` | `0536246d3490bea9c4fd827bfcd336a3dcd81500`, `fix/rpg-schema-rollback` | untracked dependency link only |
| `/srv/eldritch-staging/tavern-integration` | `9f8e083ff0c16aaa1afcc04dcb9b04f093792a53`, `fix/tavern-phone-header` | clean |
| `/srv/eldritch-staging/tavern-readiness-20261026T125211Z` | `7a717e643be3e297c8c3310b77814a26e91ffa4a`, `fix/tavern-candidate-readiness` | clean |
| `/srv/eldritch-staging/tavern-reference-fidelity` | `aed14f71e0478ee1bcb14009bc4535a4213846e8`, `feat/tavern-reference-fidelity` | clean |
| `/srv/eldritch-staging/publications/tavern-20261026T120956Z` | `be2af87b78e8d07d1a2aad9b676efb769d74ee89`, detached | three untracked generated publication metadata files |
| `/srv/eldritch-staging/tavern-working-copy` | unborn `tavern-integration`; no HEAD | 107 untracked source/backup/artwork paths |
| `/tmp/eldritch-stage.SiISMh/repo` | `1cb3ec045453062324628c9abd7e873d92ea49bd`, `migration/independent-storefront` | staged Storefront.jsx; untracked package lock; generated dependencies/dist |

The non-Git historical `/srv/eldritch-staging/app` and four root-level operational
helpers were preserved too. SentinelX infrastructure at
`/opt/sentinelx-cloud-core` was identified and excluded from application
reconciliation. Credentials, live databases, dependencies and build output are
not application source.

Private preservation root:
`/srv/eldritch-staging/reconcile-20261028T031715Z/preserved`.
It contains eight verified history bundles, working-source archives, index/worktree
patches, and five Git object-store snapshots including otherwise unreferenced
objects/reflogs. The unborn prototype has its complete source archive.
Manifests retain hashes and exclusion reasons. Those private Git object stores
and runtime configuration were not published.

The repository's [CANDY recovery archive](recovery/candy-20261028/README.md) retains
unique non-generated historical source bytes once, maps duplicate contents to
immutable repository blobs, and provides a safe restore procedure: 14 snapshots, 1,069 source aliases, 274
unique contents (200 main-reachable blobs and 74 historical payloads). All 14
snapshots were reconstructed with exact bytes and file modes. Seven duplicate
`.env.example` aliases are omitted by the conservative restore filter; the exact
maintained template remains in main. Generated publication JSON is excluded. These older
snapshots are recovery evidence, not the maintained or deployable app.

## Functionality and validation

The application remains React 18/Vite 6, React Router 6, TanStack Query 5, Node >=24
and SQLite under `standalone/`. No separate Next.js application was introduced.
Approved Tavern artwork/layout, accounts/password recovery, admin authorization,
newsletter, durable email processing, migrations, deployment scripts and tests
remain intact. Account realm/stash, welcome, atomic XP/coin exchange, eight
callings, lore and the administrator seventh avatar are in main.

Fresh CANDY checks completed 2026-10-28 03:31:27 UTC: locked dependency installation,
Vite production build and server syntax passed; **69 backend tests passed, 0 failed**;
**30 desktop/mobile browser tests passed**. The tested candidate's runtime and tests
are byte-identical to current main. Its older Markdown drafts were not copied over
main's subsequently improved documentation.
[Main CI run 40677370441](https://github.com/zyxoned/eldritchfable.com/actions/runs/40677370441)
also passed build/syntax, 69 backend and 30 browser tests. Earlier combined PR CI:
[40677087278](https://github.com/zyxoned/eldritchfable.com/actions/runs/40677087278).

Reproduce from `standalone/` using Node 24:

```sh
npm ci --no-audit --no-fund
npm run build
node --check server/index.mjs
npm test
npx playwright install chromium
npm run test:browser
```

Browser tests use built `dist`, disposable SQLite and loopback ports 4318/4317,
with email disabled. On CANDY only existing private browser cache/libraries were
selected for the test process; no system packages or production services changed.
There is no configured lint or standalone typecheck script.
The recovery archive has an independent hash/reconstruction verification report.
The CI workflow contains no deployment steps. CI success does not establish
production deployment or actual inbox delivery.

## Exact outstanding differences and next safe step

1. Main is reconciled; the additional CANDY recovery/documentation PR remains to
   be reviewed and merged. Original checkouts stay untouched and may retain older
   branch tips by design. PR #2 is closed unmerged; PR #6 is closed/merged through
   reconciliation ancestry. No duplicate feature PR needs merging.
2. Production is still frontend `2011d095` / backend `f05b81a0`, schema 3. Main's
   class/lore/admin expansion, schema 4 and phone-header fix are not live. Exact
   per-file deltas are in [SOURCE_RECONCILIATION.md](SOURCE_RECONCILIATION.md).
3. Historical source is preserved as recovery evidence, not promoted into the
   maintained application. A complete original Base44 export remains unavailable;
   inaccessible managed-environment unpublished work cannot be certified recovered.
4. A future rollout requires a consistent private schema-3 snapshot rehearsal,
   a reviewed exact commit and schema-4-compatible fallback. A schema-3 API cannot
   simply replace the new API after migration. Retain later account/session/mail/
   ledger writes; do not overwrite live SQLite with an older snapshot.
5. Catalog import/inventory, checkout/payments, shipping/fulfillment, physical
   redemption and additional XP-priced ability purchases remain incomplete.
   PostgreSQL, customer profiles and saved addresses are separate work. Catalog/
   checkout work was planned around 2026-11-02, not completed. Mocked catalog tests
   do not prove production commerce readiness.
6. Runtime HTTP health and successful mail timers do not prove fresh inbox delivery.
   A real signup/reset email exercise would create records/send mail and was not
   performed during this read-only production audit.

The next safe implementation step is review/merge of the recovery/documentation
PR, followed by preparation of a separately reviewed schema-3-to-4 rehearsal and
compatible recovery release. No rollout is authorized by this task. See
[DEPLOYMENT_RECOVERY.md](DEPLOYMENT_RECOVERY.md) for reproducible source recovery,
build, migration rehearsal and rollback procedures.
