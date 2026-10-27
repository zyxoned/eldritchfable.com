# Eldritch Fable project state

Audit date: 2026-10-27 UTC. Status: remote source audit completed; local reconciliation BLOCKED. This is a provisional development reference, not a declaration that local files, GitHub and production are synchronized.

## Identity and evidence boundary

- Repository: https://github.com/zyxoned/eldritchfable.com
- Clone URL: https://github.com/zyxoned/eldritchfable.com.git
- Default branch: main, observed HEAD a7edfd1ed11e1d3cdbe4c216fb135dc81a37e55d.
- Newest integrated development source inspected: feature/account-rpg-secret-stash, application HEAD 6b898d2d682cc974f7c580e9e19d13f52c4ea2ff (2026-10-27T12:14:02Z).
- Application directory relative to repository root: standalone/.
- Documentation branch: docs/baseline-audit-20261027, based on that exact feature application commit. Only root AGENTS.md and PROJECT_STATE.md are intended additions. Determine the documentation commit with git rev-parse HEAD or the remote branch endpoint.
- Exact existing local checkout directory, active branch, HEAD and upstream: UNKNOWN. /workspace was supplied as an environment working directory, but no repository there could be inspected.
- Staged changes, unstaged changes, untracked/ignored work and unpushed local commits: UNKNOWN, not zero.
- Managed environment was pending/offline during this audit. No local checkout was created or substituted for the inaccessible original.

GitHub API files/trees/commits and actual code were inspected at immutable SHAs. No local test execution is claimed. Public endpoints were fetched through the Exa web-fetch connector; this is endpoint evidence, not authenticated server filesystem inspection. Freshness/caching of the fetch service and independent asset hashes were not verified.

## Which codebase to use

For continuing development, standalone/ at 6b898d2d682cc974f7c580e9e19d13f52c4ea2ff is the newest integrated source among the inspected remote branches. It contains the account/RPG additions and preserves current main's Tavern storefront: storefront.css and tests/browser/tavern.spec.mjs are byte-identical to main; Storefront.jsx adds an Adventure link.

It is NOT an ancestry superset of main: feature is 36 commits ahead and 9 behind main, with merge base 45fb85d21236557c0abb65d6049976fd9a7d4392. Differences include documentation and CI as well as application work. No branch reconciliation or merge was performed. The independent phone-header correction in PR #6 is absent from feature.

recovery/ is historical source, not the running application's development root. Production's reported frontend commit is older than the feature HEAD. The unavailable local checkout may contain newer work; no single globally authoritative baseline can be certified until it is examined.

## Architecture

The independent application uses React 18/Vite 6, React Router 6, TanStack Query 5 and Lucide icons, with JSX and TSX game components. Node >=24 runs a native HTTP API in standalone/server/index.mjs. SQLite uses node:sqlite, WAL, foreign keys and explicit transactions; current source requires schema version 4 and separate explicit migration.

src/main.jsx routes account/recovery/newsletter pages, /admin, /play and /stash; remaining routes use pages/Storefront.jsx. server/auth.mjs implements account/session authorization. Newsletter and persistent transactional mail are separate server modules. server/game.mjs owns authoritative game state and the private XP/coin ledger; shared/class-catalog.mjs supplies common class content. Catalog reads published SQLite product/collection rows; it is not hardcoded empty.

The runtime source has no Base44 dependency. Deployment tooling packages the app for Linux/systemd/Caddy/Cloudflare Tunnel; current runtime layout requires server inspection before operational changes.

## Implemented in the inspected source

These are source/CI findings, not a claim that every feature is currently deployed:

- Tavern storefront, search/categories/sorting, product details, local preview bag and device wishlist.
- Verified-email accounts, cookie sessions, password reset/change, server-enforced admin role.
- Newsletter confirmation/unsubscribe, persistent transactional mail queue.
- Welcome modal and invitation copying; six-player persistent account-bound realm.
- Private Secret Stash and atomic, replay-protected XP-to-copper exchange preserving lifetime XP.
- Eight player callings with two included starter skills each, class equipment/lore, skippable/replayable prologue and expanded realm rendering.
- A separate, server-authorized seventh avatar for verified enabled administrators, without consuming a customer seat or generating customer XP through privileged executions.

## Outstanding work and discrepancies

1. Inspect the original local checkout and reconcile every tracked/untracked change and unpushed commit before certifying synchronization.
2. Review branch divergence without merging or discarding work. PR #6 fixes phone wordmark/search-focus clearance and strengthens browser coverage; its change is absent from feature HEAD.
3. Latest feature commit adds class skills, cinematic lore and the Seventh. The fetched production manifest reports the preceding frontend commit; do not label latest feature HEAD deployed.
4. Checkout is disabled. Payments, shipping/fulfillment, inventory/product import, physical gear redemption and additional XP-priced ability purchases remain incomplete. PostgreSQL, profiles and saved addresses remain separate work.
5. Fresh databases have unseeded catalog tables; the public catalog response observed during this audit was empty.
6. DEPLOYMENT.md still describes schema version 2; ADVENTURE.md includes version 3/older ability wording. Actual database code is version 4; EXPANSION.md reflects newer features. Existing files were preserved.
7. PR #2's API base SHA was 45fb85d21236557c0abb65d6049976fd9a7d4392, while the branch named fix/customer-accounts-mail was observed at 422e0243409e47a000fcd077db86661ec3d78141. Preserve this discrepancy for follow-up.
8. No open standalone GitHub issues were returned; the open issues endpoint contained the two PRs below. This does not mean the product has no outstanding work.

## Remote branches and PRs observed

| Branch | Full HEAD SHA |
| --- | --- |
| main | a7edfd1ed11e1d3cdbe4c216fb135dc81a37e55d |
| feature/account-rpg-secret-stash | 6b898d2d682cc974f7c580e9e19d13f52c4ea2ff |
| fix/tavern-phone-header | 9f8e083ff0c16aaa1afcc04dcb9b04f093792a53 |
| fix/customer-accounts-mail | 422e0243409e47a000fcd077db86661ec3d78141 |
| feat/tavern-vite-integration | be2af87b78e8d07d1a2aad9b676efb769d74ee89 |
| fix/tavern-candidate-readiness | 7a717e643be3e297c8c3310b77814a26e91ffa4a |
| style/tavern-craft-polish | 0f058552e8f535ea9e63ea5d46b0df246810ba74 |
| migration/independent-storefront | 35e5cac35227872eba7d4f24130791753b1685b1 |

- [PR #2](https://github.com/zyxoned/eldritchfable.com/pull/2): open draft; feature/account-rpg-secret-stash into fix/customer-accounts-mail.
- [PR #6](https://github.com/zyxoned/eldritchfable.com/pull/6): open; fix/tavern-phone-header into main.
- PRs #1 (accounts/deployment), #3 (Tavern integration), #4 (layout/search/artwork) and #5 (craft polish) were merged; #5 produced current main.
- This audit's new documentation branch is additional to the snapshot table; no PR, merge or deployment is part of the audit.

## Validation evidence

GitHub's build checks were successful at the exact inspected application heads:

- [Feature run/job](https://github.com/zyxoned/eldritchfable.com/actions/runs/40502289191/job/122182694720), completed 2026-10-27T12:16:49Z, application 6b898d2d682cc974f7c580e9e19d13f52c4ea2ff.
- [Main run/job](https://github.com/zyxoned/eldritchfable.com/actions/runs/40330032928/job/121596692866), completed 2026-10-26T13:23:39Z, application a7edfd1ed11e1d3cdbe4c216fb135dc81a37e55d.

The workflow installs locked dependencies, builds, checks server syntax, runs Node tests, installs Chromium and runs browser tests on Node 24. No application test or build was run locally in this audit.

Reproduction commands from standalone/: npm ci; npm test; npm run build; npx playwright install chromium; npm run test:browser. Browser tests require the built dist and use isolated temporary data, desktop/mobile projects and one worker. No lint/typecheck script exists.

The only tracked workflow at feature HEAD is .github/workflows/standalone-ci.yml. Its push branches are migration/independent-storefront and fix/customer-accounts-mail; PR paths are standalone/** and the workflow itself. It has no deployment steps. The new docs branch/root Markdown changes do not match those triggers. External webhook/provider configurations were not independently inspected.

## Deployment observations and source

Public site: https://eldritchfable.com

Fetched [frontend-release.json](https://eldritchfable.com/frontend-release.json) reported:

- releaseId: welcome-2011d09558ba-20261027T064119Z
- frontendCommit: 2011d09558baa37d90820aeae4aab3eab473e6b6
- backendRelease: f05b81a0ff9d-20261027013515284
- builtAssets: /assets/index-2UOoNik7.js and /assets/index-BwJdG0lZ.css

The backend release prefix matches repository commit f05b81a0ff9d60fa39aff635d7164623f2256eb9; a manifest field alone does not prove the running backend bytes match that commit. /api/health returned status online and application "Eldritch Fable independent API". /api/catalog returned empty products and collections.

Source code in deploy/production-rollout.mjs writes frontend-release.json and adds release headers. The frontend manifest agrees with PR #2's deployment description. No authenticated process/service/database inspection or independent built-asset hash comparison was available.

Historical DEPLOYMENT.md records /srv/eldritch-production -> /mnt/eldritch-data/production-seed, production API/web/mail systemd units, Caddy/Cloudflare Tunnel, API port 3102, frontend /srv/eldritch-production/frontend and live database /srv/eldritch-production/data/staging.db. These server paths are documentation evidence, not locally verified paths in this audit. Do not run deployment or migration commands to resolve this uncertainty without authorization.

## Completing reconciliation

Restore access to the existing checkout, then follow the inventory in AGENTS.md. Capture original state before fetching. Compare local HEAD and all worktree changes against live remote SHAs, including ignored local artifacts relevant to the storefront. Do not print credentials. Do not use a new clone as proof of the old checkout's state.

Record the actual checkout root, active branch, full local SHA, upstream, ahead/behind counts, untracked paths, intended documentation changes and verified deployment identifiers. Resolve conflicting source evidence through inspection while preserving all work; no reset/merge/deploy is authorized by this audit. Only then update this document's blocked status.

Verification sources: [remote branches](https://api.github.com/repos/zyxoned/eldritchfable.com/branches?per_page=100), [main/feature ancestry comparison](https://github.com/zyxoned/eldritchfable.com/compare/a7edfd1ed11e1d3cdbe4c216fb135dc81a37e55d...6b898d2d682cc974f7c580e9e19d13f52c4ea2ff), [immutable application tree](https://github.com/zyxoned/eldritchfable.com/tree/6b898d2d682cc974f7c580e9e19d13f52c4ea2ff/standalone), PRs and CI links above.
