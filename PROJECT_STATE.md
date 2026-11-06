# Eldritch Fable project state

## Stripe checkout candidate — November 6, 2026

Published as [draft PR #20](https://github.com/zyxoned/eldritchfable.com/pull/20)
on November 6, 2026 after the owner confirmed publication. Accepted main remains
`1023c62c23d89645fbfe7e06ee813ee59fba5b3f`. Published code commit before this
handoff: `94cc0ac96250ebfa9475e72d69becc0da3d8277b`, on
`feature/stripe-payments-tax-sandbox-20261106`. Its tree
`c2c9927ead8c6fdc19412c4c7d921bb3e428caed` exactly matches the reviewed local
preparation at `91353c7592a20ce6294ff36a126c00ec866c8b1e`.
The connected GitHub app published the source because the checkout had no Git
push credentials. The separate local preparation history is retained for recovery.
The initial source-publication approval blocker is resolved; no merge or rollout
is part of this draft publication.

The Stripe app was already installed and connected to Eldritch Fable LLC's
sandbox. Its implementation planner selected hosted one-time web Checkout.
The candidate adds `/checkout`, `/checkout/return`, a Review checkout bag link,
server-authorized admin sandbox payments, authoritative catalog/Price validation,
stock reservations, idempotent retries, raw-signature webhook handling and a
durable fulfillment/review queue. Additive schema 9 preserves the existing data;
it starts with no sellable inventory. Stripe SDK 23.1.0/API 2026-10-28.endive are
pinned. Game behavior, eight-player parties, XP and wallets are outside this change.

Fresh verification: `npm ci --no-audit --no-fund`, `npm test` (**245 passed**),
`npm run build`, changed-module syntax checks and `git diff --check` passed.
Independent review findings concerning authorization after an external await,
currency selection, transformed quantities and completed-attempt retries were
corrected and regression-tested. The actual catalog uses `price_cents`, which
the browser maps to `priceCents`; checkout now matches that contract.

Browser discovery finds 74 desktop/mobile tests. Local Chromium execution is
blocked by the workspace: the earlier 60-test attempt failed at browser launch
with `socket() failed: Operation not permitted`, before application assertions.
The managed browser download also returned a truncated ZIP. No browser pass is
claimed. [CI 42251184710](https://github.com/zyxoned/eldritchfable.com/actions/runs/42251184710)
started on the published code; its result remains to be checked. Real Stripe payment and Tax
calculation remain unverified: no application key/signing secret is available in
this workspace, Tax settings are pending a head-office address, and the connected
sandbox has no registrations. Real merchandise/stock and shipping inputs are also
needed. Checkout defaults to disabled and accepts no live key. Production has not
been inspected or deployed by this task. See [STRIPE.md](standalone/STRIPE.md) and
the [current handoff](docs/workspace/HANDOFF.md) for the exact continuation.

## Expedition and gathering candidate — November 5, 2026

An isolated candidate based on verified main `3fe124541bf90a5fb83308b72cc57c8a6348a407` adds server-owned expeditions, private runtime content integration, persistent nonredeemable gathering skills and supplies, and bounded rendering polish. Schema 8 preserves legacy data; focused concurrency, migration, privacy, progression and HTTP tests pass. Final validation passed 216 backend/unit tests, production build, six repeated regional travel scenarios, and 59 desktop/mobile browser tests with one intentional skip. Final source hashes matched isolated staging. Production-copy rehearsal and separate private-content activation remain required before release. No publication, production migration or deployment occurred. Existing wallets and reward rates remain unchanged. See EXPEDITION_REVIEW.md for scope, deliberate content limits and validation gates.

## Multi-region candidate in preparation — November 5, 2026

An isolated candidate based on freshly verified main 5e290ff96fe489b7af64ad61ad88ae08a7338192 extends the existing multiplayer game with three linked regions and a small original character-development system. It preserves the merged storefront and first Adventure polish. Schema 7 uses additive state with old Glade progress and economy retained; 136 backend/unit tests, production build, populated schema-6 migration preservation, four repeated regional journeys and the full browser suite (53 passed, one intentional skip) passed. Independent backend review and responsive visual review found no remaining blockers. The owner subsequently authorized verification and rollout; source publication/CI and privileged production activation remain separately tracked. No production change was made by this candidate preparation. See WORLD_EXPANSION_REVIEW.md for exact boundaries and release gates.

## Adventure polish prepared for review — November 5, 2026

A separate local review candidate based on main 5e89afd393a7fd56cc6df92ec1f2a926b570b2f7 adds class attack presentation, held mobile controls, and optional browser-local field notes while preserving schema 6 and existing account/game/economy rules. Backend/unit validation passed 117/117 and the build passed. Owner-approved private-staging Chromium validation passed 51 tests with one intentional desktop skip; the dedicated mobile scenario also passed three repeated runs. The owner subsequently approved publication and merge when applicable; production rollout remains separately gated. Fresh main was unchanged at 5e89afd at 05:05 UTC, and the configured GitHub workflow only builds/tests. See LIVE_ADVENTURE_INTEGRATION.md for source limits and the separate full-world integration plan.

## Security hardening live — November 5, 2026

Application source 69bfb8d883cd8c65d506d2ab979a505b2246bbdb is deployed as 69bfb8d883cd-20261105013809184, preserving administrator tools and schema 6. Verified at 2026-11-05 01:48:57 UTC: public and local release manifests agree, changed backend source hashes match the tested revision, the public API is online, API/web services are active, and mail/backup/healthcheck timers are active. The operator reported a successful production-copy rehearsal with schema 6 and preserved data before rollout. Private staging passed 103/103 backend and 48/48 desktop/mobile browser tests plus the production build. No credentials or customer data were published.

The transient rollout process has exited. Its protected terminal journal was not independently readable by this reviewer; do not infer an exit code from a collected unit. Additional automated public asset/gate requests received HTTP 403 and were stopped, so those supplemental checks remain unverified. This entry supersedes the pending-rollout note below. Existing account remediation, if needed, is separate from this preventative fix.

## Private security hardening prepared — November 5, 2026

Based on main b4a26fcccd8d60e836f09e087e44e0cd54bf80fc, preserving the deployed administrator tools and schema 6. Private staging validation completed at 2026-11-05 01:14:06 UTC: 103/103 backend tests, production build, and 48/48 desktop/mobile browser tests passed using synthetic data with mail disabled. No production changes or public publication were performed by this preparation. Production-copy rehearsal and authorized rollout remain pending.

## Private administrator tools live — November 5, 2026

The owner-authorized feature merged in [PR #13](https://github.com/zyxoned/eldritchfable.com/pull/13)
as `4fdf06d6263d92c58999d2eae31a36b9b3e99200`.
Application source `043737030137f3cd7beb615f6826a6f2267a11e4`, tree
`ae9cf55412a58589985fc04fc45141974efd1cac`, is deployed as
`043737030137-20261105001552618`, schema **6**.

Verified at 2026-11-05 00:39:55 UTC: public manifest and release headers, eight current/
retained asset hashes and MIME types, protected administrator/game endpoints,
database integrity/foreign keys, source/runtime hashes and API/web/tunnel/timer
health passed. [CI 41939374992](https://github.com/zyxoned/eldritchfable.com/actions/runs/41939374992)
passed; fresh backend **95/95** and desktop/mobile **48/48** tests passed.
Independent authority/UI review and production-copy migration/configuration/
fallback rehearsals passed. Expanded browser fixtures use isolated synthetic
sessions so production signup/login limits remain unchanged.

The designated existing account was already a verified enabled administrator.
The reviewed operator command configured its Death Knight visitor name and
testing capability, preserving credentials, sessions and the count of two
administrators. Personal identifiers remain outside public source. Test XP/gold
are renewable nonredeemable balances with receipt/audit records; ordinary
wallets, lifetime XP and party-scaled offense are unchanged.

Signed-in administrators can open the side tab or [/admin](https://eldritchfable.com/admin).
Tools include aggregate account/realm/mail activity, own visitor-name settings,
enabled test grant/exchange/reset and own audit history. Current server-side
role/session checks protect the panel; testing operations additionally require
the account capability. The owner's existing login is retained.

The initial activation validation stopped and selected the compatible fallback.
A reviewed diagnostic retry then passed every original public/local gate, with
additional administrator checks; no validation was relaxed. The first failing
check was not captured by the original log, so its cause remains unproven.

Fresh private migration and configuration backups, the source bundle, retained-
asset ledger and verification reports are archived in the release's protected
deployment record. No old database was restored, and no new signup/reset email
was sent for verification. This supersedes the earlier pending-feature and
schema-5 observations below. The separate solo demo and future campaign scope
remain as previously documented.

## Private administrator tools — November 4, 2026

The owner requested a named Death Knight administrator, renewable testing XP/gold
and private side panel analytics/tools. Read-only verification confirmed the
designated account already exists, is verified/enabled, and is one of two admins.
Account identifiers and operator arguments remain private.

The feature adds schema 6 account settings, a validated visitor-name overlay,
nonredeemable test balances, immutable audit and protected aggregate analytics.
The side drawer provides own-profile, test grant/exchange/reset and visitor entry
controls with keyboard/focus/mobile support. Current sessions, roles and the
separate testing capability remain authoritative, including receipt retries.
Normal party scaling, customer XP/wallets and ordinary rewards remain intact.

Base main: 837007659ac19b86a001c1fa8da72ec77a4299d7.
Fresh locked installation, production build and 95 backend tests passed. Independent
backend/frontend reviews found no remaining blockers after read sequencing and
focus fixes. Final desktop/mobile browser verification is pending.

A private copy of actual schema 5 production data migrated to 6 with preservation.
The existing-admin operator command passed dry-run, configuration and idempotence
checks on that copy while preserving credentials, sessions, roles and customer
funds. No live configuration has been applied yet. Next: final browser checks,
reviewed publication/CI, deployment and private audited account configuration.
The current live release remains the dated production observation below.

## Production activation — November 4, 2026

The owner explicitly requested merging with production. [Feature PR #11](https://github.com/zyxoned/eldritchfable.com/pull/11)
merged as `abafdb4a95701d4a941a4710bd38fa3e8489d317`.
The deployed application source is `9d17c7c2929e76d88287f66db4026e14f8014bf3`;
its tree `387257c86ef1529b7f758d9eaa0fe44d6a3e362e` equals the merge tree.

At 23:14 UTC, frontend manifest and API release headers identify
`9d17c7c2929e-20261104230355615`. Eight regular players and two additional
support visitors, per-party worlds, saved character cosmetics and articulated
class rendering are deployed at [Play](https://eldritchfable.com/play).
Normal eligible customer rewards continue during visits. The separate solo
ruined-Mossvale prototype remains in PR #10; the full campaign is not implemented.

Evidence:
- Locked install, release staging/build, 86 backend tests and 38 desktop/mobile
  browser tests passed. [GitHub CI 41930130131](https://github.com/zyxoned/eldritchfable.com/actions/runs/41930130131)
  passed on the exact feature source.
- A consistent private production copy migrated from schema 3 to 5 with preserved
  data. The compatible fallback retained account access and stash/exchange while
  pausing realm routes. The live migration then created a fresh private backup,
  preserved original data and passed integrity/foreign-key checks.
- Public manifest, current/retained asset hashes and MIME types, release headers,
  unauthenticated account/game gates and desktop/mobile browser checks passed.
- API/web/tunnel services and the intended mail/backup/health timers are healthy.
  SMTP authentication passed without a new test message; real inbox delivery was
  not tested.
- The reviewed source bundle and recovery/retained-asset records are private.
  No older database was restored. No real customer account was used for browser
  testing, and concealed authoring remains outside public source.

This section supersedes older statements that the feature is only staged or that
production remains on schema 3. Future rollouts still require their own authority.

## Eight-player parties and support visitors — November 4, 2026

The current feature implements eight regular heroes plus two separate support
visitors per persistent isolated party. Open matching, private solo contexts,
random administrator visits, bounded healing and party-scaled offense preserve
normal eligible customer rewards and progression. Saved cosmetics and articulated
class rigs give each of the eight ordinary classes its own appearance and motion.
[The feature contract](standalone/EXPANSION.md) and
[implementation record](docs/superpowers/plans/2026-11-04-party-visitors-appearance.md)
describe the implemented boundary; the broader expedition campaign remains future work.

Fresh accepted main before publication is
`f50f072e6dd91f94a69882f8cad23b5dec5358d0`, tree
`854c720c8d455b3f95cbd777cda4e8ced83f9785`.
The resumed worktree preserves its original `f198ca51729b4131cfde37dce709830df91f81b5`
baseline and WIP. The reviewed feature will be published independently from fresh
main, without prototype files/history or the demo-only plan. Root documentation
starts from actual current-main contents, preserving its governance record.

Fresh verification: locked npm installation, six changed server/shared module
syntax checks and **86 backend tests passed**, zero failures/skips. This includes
schema-3/4-to-5 preservation, compatible fallback, isolation, replay, capacity,
admin revocation, rewards and cosmetic forgery checks. The final production build and all **38 desktop/mobile browser tests passed**,
including delayed-reply, cross-tab actor and cosmetic-dialog regressions.

The isolated [playable demo](https://eldritch-fable-mossvale-demo-yizzwe.v2.appdeploy.ai/)
is separate, source `d79d4c07739e190edac449fa939b32925f6a3508` in
[PR #10](https://github.com/zyxoned/eldritchfable.com/pull/10), ready snapshot
`1793807926358`. It remains frontend-only and cannot affect accounts or the live
game. The owner subsequently authorized merging and deploying this feature on November 4.
Production rehearsal and the release handoff are now in progress; publication alone is not deployment.

## Private authoring decisions resolved — October 30, 2026

The owner has resolved the private participant policy and new persistent-effect
rules. The private canon/index has been securely updated; exact sources,
conditions, probabilities and revelations remain outside public source and PRs.
Earlier participant-policy questions below are historical and resolved.

[The design](docs/superpowers/specs/2026-10-30-eldritch-expeditions-design.md)
now covers durable combat effects/acquisitions, account-wide grant/draw limits,
saved random decisions and derived effective health alongside equipment and
authored events. This supersedes the proposal to retain a fixed health ceiling
for every modified hero; ordinary unmodified heroes keep their existing baseline.
No player effect alters XP, wallet balances or the exchange rate.

Observed October 30 at 07:52 EDT through connected staging/GitHub tools:
main remains `4c54082e55279d1f0efa301a5fd40e198405b8d9`. The task worktree
was clean at `f4bc674400168c08a4028d2b7b0f18f9709192b1`, matching upstream
0/0 and five documentation commits ahead of main, zero behind. This revision
updates four Markdown files and private authoring metadata. Documentation/content
checks apply; application tests and production were not rerun or changed.

## Private authoring continuation — October 30, 2026

The owner has resolved the concealed narrative continuation and ending. The
private authoring record and integrity index have been updated outside Git.
Its identities, destinations, triggering conditions, dialogue and reveal sequence
remain absent from public source, PR text, fixtures and frontend assets.

[The public design](docs/superpowers/specs/2026-10-30-eldritch-expeditions-design.md)
now includes the resulting infrastructure scope: durable class-specific equipment
ownership/equipping and transactional authored-event stages. This supersedes its
earlier catalog-only equipment boundary. One participant-eligibility policy is
awaiting the owner's answer; detailed item balance and scene-reset flags remain
proposals. Ruined Mossvale, free exploration and per-hero spoiler protection stand.

Observed October 30 at 06:57 EDT through connected staging/GitHub tools:
main remains `4c54082e55279d1f0efa301a5fd40e198405b8d9`; the task worktree
was clean at `a863ebb7d729e0a281537f550f49ae39f5188053`, matching upstream
0/0 and four documentation commits ahead of main, zero behind. Document checks
and independent review apply to this revision; application tests and production
checks were not rerun. This is a design update, not implementation or deployment.
Older pending-ending and equipment-exclusion statements below are historical.

## Discovery-first ruined Mossvale — October 30, 2026

The owner now requires a ruined-Mossvale free-roam start, optional hooks,
directions shaped by in-world decisions and protection of first-time discovery.
This supersedes the earlier upfront route ballot and automatic party transfer.
The illustrated 2D art direction remains accepted.

[The revised public design](docs/superpowers/specs/2026-10-30-eldritch-expeditions-design.md)
defines independent physical travel, split parties/multiple occupied locations,
per-hero knowledge and consequences, and recovery preserving durable progress.
Concealed story canon is saved privately outside the checkout, indexed in local
Git metadata; its identities and encounter details are deliberately absent from
public source, fixtures, assets and PR text.

The route-size, anchor/reward and recovery defaults remain proposals. The final
narrative resolution is an author question still pending; this update does not
claim full design approval, product implementation or a deployed feature.

Fresh main remains `4c54082e55279d1f0efa301a5fd40e198405b8d9`.
The task branch was clean and matched upstream
`8e967b2ac26f43f33c47947e8f57ec93c0be7832` before this update, three
documentation commits ahead of main and zero behind. No application tests or
production checks were rerun for this document revision. Earlier audit sections
below are historical; their route-ballot proposals are superseded here.

## Illustrated expedition design — October 30, 2026

The owner accepted the illustrated top-down 2D recommendation and supplied
black/antique-gold candlelit aesthetic. The renderer direction is resolved.
[The full expedition design](docs/superpowers/specs/2026-10-30-eldritch-expeditions-design.md) now specifies the storefront/visual
pass, requested 100-floor cave, proposed 20-chamber sky temple, party choices,
checkpoints, reconnect/reward semantics and acceptance criteria.

Independent builder and source/authority reviews found no remaining must-fix
issues; relative links/whitespace/scope checks passed. Only the visual approach
is approved so far. The detailed gameplay defaults
are proposals for the owner's review; product implementation and skill/dependency
installation have not started. The next step after design approval is the
Superpowers writing-plans workflow.

Fresh source main remains `4c54082e55279d1f0efa301a5fd40e198405b8d9`.
Before this design handoff, the task branch matched upstream at
`9e0c7db38fc3b91bb62caa42f6cc17669c70041b`, clean and two documentation
commits ahead of main, zero behind. The cloud environment was pending/offline;
the existing connected staging task checkout was sufficient for document work.
Earlier application/production checks below remain dated; none were rerun
for this documentation-only design phase.

## Reference intake — October 29, 2026, 21:57 EDT

The owner supplied the new "Adventures Become Real" visual reference. The
[skill-readiness brief](docs/workspace/MMO_SKILL_READINESS.md) now records its
black/antique-gold/candlelit material language, current-storefront reuse, selected
skills and proposed cave/sky variations. The attachment differs from the older
archived "Greater Stories" references.

Fresh main remains `4c54082e55279d1f0efa301a5fd40e198405b8d9`; PR #9 is
open/draft and its task checkout matched upstream
`be5fb14140596c90338059cf80db1f2f4e24fac7` before this documentation update.
At that earlier intake the renderer preference was open; the owner has now
accepted the illustrated 2D recommendation, as recorded above. This is reference/skill
intake, not an approved implementation design. Application code, installations
and production are unchanged; no fresh application tests or live checks were
claimed for this follow-up.

## Latest readiness observation — October 29, 2026, 17:20 EDT

This observation supersedes the current-status and next-action claims in the
earlier audit below. Before this documentation handoff, GitHub main was
`4c54082e55279d1f0efa301a5fd40e198405b8d9`. [PR #8](https://github.com/zyxoned/eldritchfable.com/pull/8)
was merged at 13:18 EDT; its merge commit was
`08b8d757c7d1b49ebf72ebfeac597c3fe57f2a7f`. Reviewing/merging PR #8 is no
longer an outstanding task.

The enrolled staging development checkout was clean at the same main SHA, with
no staged/unstaged/untracked files, active Git operation or unpublished commits.
Its retained recovery branch was two commits ahead of its old upstream, zero
behind; both commits were already published on main. Fresh Relay inspection
reported main ahead/behind 0/0 and `up_to_date`. The existing watcher was
active/enabled with a recent fresh successful result. Historical recovery
checkouts were not fast-forwarded or modified. The managed cloud environment
reported `environment_startup_failed`; its unpublished contents remain UNKNOWN.

[CI 40954037828](https://github.com/zyxoned/eldritchfable.com/actions/runs/40954037828/job/123729348898)
passed on that exact main SHA: build/server syntax, 69 backend tests (zero
failures/skips), and 30 desktop/mobile browser tests. Logs were inspected now;
no local application tests were rerun for this documentation-only audit.

Public health was online. The manifest still identified frontend
`2011d09558baa37d90820aeae4aab3eab473e6b6` and backend release
`f05b81a0ff9d-20261027013515284`. API/web/tunnel services were active/running,
and mail/backup/healthcheck timers active/waiting. Production remains a separate,
older release. The live schema and real inbox delivery were not retested.

The game is custom Canvas 2D with one shared Mossvale map; formal parties,
100-floor caves, destination selection and sky temples are new implementation
work. The owner has since supplied the desired aesthetic; see the reference intake above.
[The skill-readiness brief](docs/workspace/MMO_SKILL_READINESS.md) records verified
omgskills candidates, renderer constraints and the next design questions. No
skills were installed and no gameplay, deployment or live data changed.
Continue with that reference and project-specific design rather than claiming
the proposed MMO expansion is complete.

## Earlier source and production audit

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

## Workspace Relay initialization, October 29

At 12:14 EDT (America/New_York), the actual CANDY review checkout was inspected
against freshly fetched GitHub refs and enrolled as the development worktree for
`reconcile/candy-recovery-20261029`, accepted base `main`. Its pre-handoff HEAD and
upstream were `10802d3481d6a687bbe02c6b677f2a06ef57f9c6`; main remained
`2d708248a9e812195d4e4e9177da85aaa33d7589`. The worktree was clean, upstream
matched exactly, and its one commit ahead of main required no repair.

[The shared workspace handoff](docs/workspace/HANDOFF.md) records the exact root,
source baseline, checks, local state, session coordination and next action. Relay
metadata remains private in Git metadata. A session lease protected documentation
edits; only its owning session releases it after publication. No continuous
watcher/scheduler was started and no production checkout was enrolled.

Fresh public manifest/health verification at 12:15 EDT agrees with the production
releases above. The earlier file/service/schema audit remains dated evidence.
PR #8's pre-handoff exact head passed CI run 40841655451: build/syntax, 69 backend
and 30 browser tests; this session did not rerun local application tests for these
documentation-only edits. The cloud workspace is still pending/offline.

## Workspace Relay continuous checks enabled

At 12:29 EDT on October 29, following explicit owner authorization,
`eldritch-workspace-relay.service` was installed and enabled as a dedicated
system service running as `sentinelx`. It checks only the enrolled CANDY
development checkout every 300 seconds and is configured to start at boot.
The effective unit is root-owned; its reviewed artifact remains in private staging.
No infrastructure-home files, production services, live database or release
symlinks were changed. The managed cloud workspace remains pending/offline.

The first daemon cycle freshly fetched upstream and main, found clean
`648bd81c04bd8e5c1c2e0e7c62b16b202be8e730` with upstream 0/0 and two commits ahead
of main, and required no repair. A controlled restart verified that an editing
lease pauses it with `session_active` in the journal. The [shared handoff](docs/workspace/HANDOFF.md)
records exact scope, persistence configuration, limits and stop/disable commands.
The owning editing session releases its lease after publishing these docs and
verifies a new fresh cycle. No reboot or deployment was used for verification.
