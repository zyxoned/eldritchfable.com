# Instructions for Eldritch Fable coding agents

## Start with evidence

Read PROJECT_STATE.md, then inspect the actual checkout and code. That document is a dated audit, not proof that a future checkout or deployment is synchronized. Historical chat summaries and older README claims do not override current code or runtime observations.

The application is in standalone/. recovery/ contains historical source snapshots. Do not move historical code into the running application merely because it has a familiar name. The repository is https://github.com/zyxoned/eldritchfable.com.git.

Before editing, record the repository root, remotes, active branch, HEAD, upstream, worktrees, staged/unstaged changes and untracked files. Do not assume /workspace is a checkout. Useful commands, run from the actual repository:

```sh
pwd -P
git rev-parse --show-toplevel
git remote -v
git branch --show-current
git rev-parse HEAD
git status --porcelain=v2 --branch --untracked-files=all
git diff --stat
git diff --cached --stat
git ls-files --others --exclude-standard
git worktree list --porcelain
git branch -vv
git log --oneline --branches --not --remotes
git ls-remote --heads origin
```

Inspect diffs before changing files; sanitize credential-bearing URLs before sharing. After preserving the initial inventory, an ordinary fetch without pruning can refresh remote-tracking evidence. Compare exact SHAs and file contents as well as ancestry; independent branches may contain equivalent changes. Never describe cached remote refs as a current remote check. Report blockers when the existing checkout is inaccessible; a fresh clone cannot reveal its unpublished work.

Preserve existing work. Do not reset, clean, force-push, overwrite files, delete worktrees/branches, stash someone else's changes, merge, rebase or deploy during a baseline audit. Use a new documentation branch from an explicitly recorded parent when appropriate. Stage only intended files, review the diff, and verify the remote ref after pushing. Check hooks/workflows/deployment triggers before a push. Keep unrelated changes out of documentation commits.

## Architecture

- standalone/src/main.jsx: React Router entry point; storefront, accounts, newsletter, /play, /stash and /admin.
- standalone/src/pages/Storefront.jsx and src/styles/storefront.css: Tavern storefront, catalog browsing, product details, preview bag and wishlist.
- standalone/src/api/: browser account/catalog access. TanStack Query handles account data.
- standalone/src/game/ and src/components/AdventureWelcome.jsx: realm UI, shared canvas/game presentation, dialogs, prologue and invitations.
- standalone/shared/class-catalog.mjs: shared class/ability/equipment/lore definitions.
- standalone/server/index.mjs: native Node HTTP API; delegates account, newsletter and game routes.
- standalone/server/database.mjs and migrations/: SQLite persistence using node:sqlite. At the audited application commit the schema is version 4; API startup requires migration to have been performed separately.
- standalone/server/auth.mjs, account-mail.mjs, mail-queue.mjs and mail-worker.mjs: accounts, verification/reset, sessions and durable email processing.
- standalone/server/game.mjs and game-rules.mjs: server-authoritative realm, permissions, cooldowns, XP and private coin ledger.
- standalone/deploy/: Linux production inspection, staging and rollout tools. Reading these files does not authorize running a rollout.

The stack is React 18, Vite 6, React Router 6, TanStack Query 5, Node >=24 and SQLite. Server files use ESM .mjs; frontend uses JSX plus TSX game components. Preserve the package lock. Do not introduce a replacement framework, auth service or database as incidental cleanup.

## Development conventions

Keep server-side authorization and validation authoritative. Revalidate current account roles for privileged actions and replays. Preserve same-origin mutation checks, session protections, loopback binding and proxy trust boundaries.

Use integer cents for commerce values and integer copper for game wallets. Preserve atomic transactions, replay protection and lifetime XP. The defined exchange is 1,250 XP = 1 gold = 1,000 copper; 1 silver = 10 copper; 1 gold = 1 penny. Public realm events must not expose private wallet balances or account data. Privileged seventh-avatar actions must not award customer XP.

Keep storefront styles scoped; preserve keyboard operation, dialog focus/restoration, reduced-motion behavior and narrow-screen layouts. Use existing patterns rather than broad formatting changes.

Never commit credentials, .env files, customer data, database files/backups, node_modules or build output. Never print secret environment values or source production credential files. Keep transactional email disabled in local tests.

## Development and verification

Run package commands inside standalone/ with Node >=24:

```sh
npm ci
npm test
npm run build
npx playwright install chromium
npm run test:browser
```

Build before browser tests: their harness serves dist through Vite preview. An installed Chromium can be selected with PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH. Playwright uses a temporary SQLite database and isolated test API/preview ports 4318/4317, with desktop/mobile projects and one worker. Tests do not send email. There is no configured lint or standalone typecheck script; do not claim either ran.

For local development, inspect .env.example and create configuration only if the destination does not exist. Use an explicitly disposable local ELDRITCH_DB, origin http://localhost:5173 and disabled email. Run npm run db:migrate only against that intended local database, then npm start and npm run dev in separate terminals. The default development API port is 3000.

Run checks relevant to the changes and report exact results. A documentation-only change needs content/link/diff review; do not claim fresh application tests from an earlier CI run. Distinguish inspected source features, tested behavior and verified production behavior.

## Deployment rules

Deployment requires explicit authorization for that operation. This baseline task does not authorize rollout, migration of existing databases, restarts, mail delivery, merge, DNS or configuration changes. Do not run upgrade.sh or production-rollout.mjs as a verification step.

Production documentation describes Linux/systemd, Caddy and Cloudflare Tunnel under /srv/eldritch-production, with API port 3102 and a live customer database named data/staging.db. The name staging.db does not make it disposable. Verify actual service paths, symlinks, database and identities before any future authorized deployment; do not rely solely on historical prose or .env.example comments.

Read standalone/DEPLOYMENT.md, ADVENTURE.md, EXPANSION.md and the current deployment code together. Some older prose names schema 2 or 3; the audited code uses schema 4. Never migrate or restore a live database based on stale instructions. Preserve accounts, sessions, mail records and game/economy state; backups and rollback must preserve subsequent writes.

The public /frontend-release.json identifies frontendCommit, releaseId, backendRelease and builtAssets. /api/health establishes service health, not a Git commit. Frontend and backend can be from different releases. Match manifest, headers/assets and server release records when access permits, and label missing evidence. A GitHub push or successful CI is not proof of deployment.

Update PROJECT_STATE.md when source, branches, validation or deployment evidence changes. Record full application SHAs, observation time, unresolved differences and verification sources; identify a documentation commit externally or via git history rather than attempting a self-referential commit hash.
