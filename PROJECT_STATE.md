# Eldritch Fable project state

Remote reconciliation prepared on October 28, 2026. This source combines all nine remote branch tips observed through the connected GitHub API. The reconciliation commit is identified by git history and the associated pull request; it cannot contain its own SHA.

## Project identity

- Eldritch Fable repository: https://github.com/zyxoned/eldritchfable.com
- Eldritch Fable public site: https://eldritchfable.com
- zyxoned.github.io is for **Pine Kind**, per the owner's October 28 clarification. It is a separate project.
- Maintained application: standalone/. recovery/ is historical source.

## Source reconciliation

Inputs observed immediately before preparing the consolidation:

| Input | Full commit |
| --- | --- |
| main | a7edfd1ed11e1d3cdbe4c216fb135dc81a37e55d |
| RPG/Stash and Hollow King expansion | 6b898d2d682cc974f7c580e9e19d13f52c4ea2ff |
| Phone-header correction, PR #6 | 9f8e083ff0c16aaa1afcc04dcb9b04f093792a53 |
| Audit notes | d4f9ada7c735ca0b6f5629b3bbeea189003373e6 |

The consolidation retains main's CI workflow (including pushes to main), migration documentation and recovery README; all feature application changes; both phone-header correction blobs; and the audit's AGENTS.md. Storefront.jsx differs from main only by adding the Adventure navigation link. The storefront CSS and Tavern browser test were identical between main and feature before applying the phone correction.

The commit preserves main, audit and phone histories as parents; the audit is a direct descendant of feature. The migration/account/Tavern/craft branches are already ancestors of those inputs. Original branches are retained. The old draft PR #2 targeted the account-repair branch; the consolidated PR targets main and supersedes that integration route.

The dated audit from October 27 is retained in git history. Its prohibitions on merging during that baseline audit do not describe the owner's subsequent October 28 request to reconcile the GitHub project. This request does not itself establish authorization for a production rollout.

## Validation

The exact feature input passed [CI run 40502289191](https://github.com/zyxoned/eldritchfable.com/actions/runs/40502289191). The phone input passed [CI run 40331347221](https://github.com/zyxoned/eldritchfable.com/actions/runs/40331347221). Those runs are input evidence, not validation of the combined tree.

The consolidation must pass fresh GitHub CI before integration. The workflow installs locked dependencies, builds on Node 24, checks server syntax, runs Node tests and Chromium desktop/mobile browser tests with isolated temporary data. No local tests are claimed: the managed execution environment failed to start. Exact consolidated CI results belong in the PR and Actions history.

## Local and production evidence limits

The existing local checkout, worktrees, staged/unstaged/untracked files and unpublished commits remain inaccessible and UNKNOWN. A remote consolidation cannot certify them synchronized. Preserve and inventory them when access returns, following AGENTS.md.

No server access or new runtime inspection occurred in this reconciliation. The October 27 audit reported frontend 2011d09558baa37d90820aeae4aab3eab473e6b6, release welcome-2011d09558ba-20261027T064119Z, backend release f05b81a0ff9d-20261027013515284. These are historical observations, not current verification. The latest expansion input must not be described as deployed based on this evidence.

For a future authorized rollout, inspect the current /frontend-release.json, actual services and database, then follow DEPLOYMENT.md and EXPANSION.md. The historically documented database /srv/eldritch-production/data/staging.db is live customer data despite its name. Schema 4 migrations and compatible recovery must retain subsequent writes.

## Implemented source and remaining work

The consolidated source includes Tavern search/categories, product browsing, preview bag/wishlist, verified accounts and password recovery, persistent mail queue, welcome/invitations, six-player persistent realm, eight callings with starter skills/equipment/lore, prologue, administrator seventh avatar and private replay-protected XP exchange.

The economy remains 1,250 XP = 1 gold = 100 silver = 1,000 copper; 1 gold = 1 penny. Server authorization, atomic updates and lifetime XP remain authoritative.

Checkout, physical gear redemption, payment/shipping/fulfillment integration, real catalog/inventory import and additional XP-priced ability purchases remain incomplete. PostgreSQL, profiles and saved addresses remain separate work. Catalog tests use mocks and do not establish live commerce readiness. The older plan targeted around November 2; it is a plan, not evidence of completion.
