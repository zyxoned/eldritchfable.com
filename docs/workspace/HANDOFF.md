# Eldritch Fable shared workspace handoff

## Bellhouse mobile landscape and journal — November 9, 2026

The feature/ef3d-bellhouse-preview application commit e377dcd35bd1a2e93607a5a26fbe89cc964c23cf and local build commit 4cb6ff703e6e21e11ddb80fc2f9d5e861707b9f6 share tree 3f0e4e4c613a0a55e88f7f9c85965a438319f644. The previous handoff parent is 2c3174b413b6e3113fe7561451a041d48683b71b. The accepted main baseline is 1023c62c23d89645fbfe7e06ee813ee59fba5b3f.

LandscapeGate.jsx blocks portrait play after joining. AdventureJournal.jsx holds Character, Inventory, Quests, World, and Party. Mossvale.tsx retains existing account and game actions and cancels active movement on opening the journal. The game can still use its classic renderer when WebGL 2 is unavailable.

The root and /bellhouse/ builds passed. The backend and unit suite passed 219 tests. The targeted desktop and mobile Chromium suite passed seven tests with one intentional desktop skip. The final mobile rerun covered both portrait transitions, all five journal tabs, movement and look together, the bell and combat, and fully visible 2D fallback controls at 844 × 390.

Verified at 2026-11-09 19:40 UTC. The private Tailscale release ef-bellhouse-e377dcd35bd1 serves /bellhouse/play/?scene=bellhouse. Play, login, and the anonymous auth endpoint returned HTTP 200, and all four served asset hashes matched the prefixed build. The private /bellhouse handler points to the new release and its prior release remains available for rollback. The root preview proxy and production routes were outside the rollout.

Open /bellhouse/play/?scene=bellhouse on the private preview, enter the Glade, and turn the phone sideways. Tap Journal, then Inventory to see equipped gear and the materials pouch. Physical Android Firefox is the next device check.

## Bellhouse dual-stick controls — November 9, 2026

Observed 2026-11-09 14:01 EST from the isolated Linux checkout and the private Ubuntu preview. The task branch feature/ef3d-bellhouse-preview in zyxoned/eldritchfable.com used previous handoff commit 2b17758c1056a365787f9d12b1e04a65bd51e414 over accepted main 1023c62c23d89645fbfe7e06ee813ee59fba5b3f. Local application commit 6afee57eba928d908f281ccf1a8d5ed5ec0c894a and published application commit ae707b7f45ed43e525e244eca66a079a0ee6151a match tree e35a06cda1cd47b23149e5a7a574566db25e3ca6.

AnalogStick.jsx and free-controls.mjs handle independent pointers, camera-relative movement, and validated cell crossings. BellhouseStage.jsx draws the third-person follow camera and shares the analog position with actors.js. World geometry limits the camera near the bellhouse and cottage. Mossvale.tsx uses the existing Adventure move action and handles controls after WebGL initializes.

The root and prefixed builds passed. npm test passed 219 tests. The targeted adventure, Bellhouse, and mobile controls suites passed seven Chromium tests with one intentional desktop skip. The mobile test verified look without movement, simultaneous pointers, release, the bell route, and combat. The private release ef-bellhouse-ae707b7f45ed returned HTTP 200 on play, login, and the preview auth endpoint. All four served assets match the prefixed build.

Open /bellhouse/play/?scene=bellhouse on the private Tailscale preview and enter Whispering Glade. Hold MOVE to walk and LOOK to turn and tilt the camera. A physical Android playtest is the next review.

## Bellhouse Ravine private 3D preview — November 9, 2026

Observed 2026-11-09 13:37 EST from the isolated Linux worktree and the existing private Ubuntu preview host. The maintained repository is zyxoned/eldritchfable.com. The clean application candidate before this handoff was local commit 34a74705bc11fa18918419f7dbba7259d3a8492e and published application commit bfed4a8ea843bbf0e3d5da41e5ab4a48e83460d7. Both trees were verified as a53a8c3c56f0d75cdf54c125473e524e9536535f. The accepted base was main 1023c62c23d89645fbfe7e06ee813ee59fba5b3f. The task branch is feature/ef3d-bellhouse-preview.

The 3D implementation is under standalone/src/game/bellhouse and is lazy-loaded by Mossvale.tsx for the opt-in Bellhouse Ravine view. Geometry, materials, and character models are generated from original source. The view uses existing movement, combat, classes, and party snapshots. Sign-in preserves the selected view and the WebGL 2 fallback uses the classic renderer.

Verification covered npm test with 216 passing, the root and /bellhouse/ builds, and seven targeted Chromium tests with one intentional desktop skip in adventure.spec.mjs, bellhouse.spec.mjs, and mobile-controls.spec.mjs. The Bellhouse tests exercised sign-in, WebGL startup, phone-sized touch movement, ringing the bell, combat feedback, and classic fallback with disposable accounts. The private release ef-bellhouse-bfed4a8ea843 returned HTTP 200 for its play and login pages and the existing auth endpoint. Four hosted asset hashes matched the local prefixed build.

The private route is /bellhouse/play/?scene=bellhouse on the established Tailscale preview origin. Use the preview account and enter Whispering Glade. Walk to the bellhouse, ring the bell, then find and attack a thornling. Expect the bell response and visible changes to combat health. A physical Android playtest and further character and environment detail are the next review steps.

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

## Current feature continuation — November 4, 2026

This section supersedes historical task/next-action notes below. The owner
authorized implementation of eight regular seats and two additional administrator
visitors per party, explicitly retaining normal rewards and story progression
during visits. Cosmetic customization and more substantial class motion are part
of the same feature. Full campaign content is not claimed implemented.

**Source:** accepted main `f50f072e6dd91f94a69882f8cad23b5dec5358d0`, tree
`854c720c8d455b3f95cbd777cda4e8ced83f9785`. The original resumed worktree remains
on `feature/eight-party-visitors-20261030` at
`f198ca51729b4131cfde37dce709830df91f81b5`, with reviewed WIP preserved.
Publication target is an independent `feature/eight-party-visitors-20261104`
tree parented from fresh main, retaining `docs/PROJECT_OS.md` and excluding
`demos/**` and the demo-only plan. The new commit is identified by Git history
and its remote ref rather than a self-reference here.

**Implemented:** schema-5 persistent party worlds and bindings; eight regular and
two visitor seats per party; open overflow and private solo sessions; uniform
random eligible admin visits; viewer-scoped SSE; role/session reauthorization;
party-bound actions/heartbeats and global immutable receipts. Support visitors
are invulnerable, have lower-median party-scaled basic offense sharing a 700 ms
strike budget, and heal nearby regular members 15 HP within four tiles every six
seconds. Positive ordinary contributors keep rewards on visitor finishing hits.
Visitors receive no customer XP, currency or progression and preserve their own
normal hero and wallet.

Normal appearance uses a strict six-field cosmetic catalog, receipt-backed save
API and preview/save/cancel editor. Class stays immutable. A pure shared renderer
draws class equipment/silhouettes, planted gait, turns, breathing and attack
recovery with reduced-motion support. Party controls and account/welcome copy
describe the new capacity and visitor role.

**Verification:** fresh locked dependency install, syntax checks and **86/86
backend tests** passed. Migration tests preserve existing account/session/mail,
hero, wallet/ledger, receipt and world columns; compatible fallback exercises
retain later writes. Independent backend review found replay-order and shared
attack-budget bugs; both are fixed with regression checks. The final production build and all **38 desktop/mobile browser tests passed**
after fixes for delayed HTTP responses, cross-tab actor changes and modal cleanup.
The final tested source is byte-identical to the independent review checkout.

**Next executable action:** publish the reviewed 28-file independent feature PR,
verify CI, and merge/deploy the exact reviewed source as now explicitly requested
by the owner. Preserve a consistent private backup and rehearse the schema-5
migration and compatible code fallback first. Record the actual release identity,
health, retained assets and timer states after activation. Never restore an older
database automatically. The implementation commit is identified by Git history.

The [solo visual demo](https://eldritch-fable-mossvale-demo-yizzwe.v2.appdeploy.ai/)
is separately published in [PR #10](https://github.com/zyxoned/eldritchfable.com/pull/10),
source `d79d4c07739e190edac449fa939b32925f6a3508`, ready snapshot
`1793807926358`. It has no multiplayer/accounts/economy connection. Feature PR
source does not include that experiment.

Private authoring records and inaccessible managed-environment files remain
unpublished. Existing production services, customer database and Relay watcher
were not modified or freshly audited by this feature work.

---

Historical handoff retained from current main:

Current task: persistent-effect design revision, October 30, 2026, 07:52 EDT
(America/New_York).
Executor: connected GitHub and SentinelX staging tools. This is a design handoff,
not a claim of implemented or deployed expedition behavior.

## Owner direction and public/private boundary

The owner accepted illustrated top-down 2D and the supplied candlelit
black/antique-gold "Adventures Become Real" visual target. They now require
**ruined Mossvale as a freely playable starting area**, optional hooks, decisions
that affect direction, and a first-time experience without plot spoilers.

The earlier arrival route ballot, full destination cards and automatic group
teleportation are superseded. The [revised design](../superpowers/specs/2026-10-30-eldritch-expeditions-design.md)
uses physical discovery and affirmative individual travel. Social parties may
split between runs; members of one run may occupy different accessible floors.
Each hero has one authoritative active assignment and location. The owner has
since resolved the concealed narrative continuation and ending. The private
record is updated; its exact conditions, sequence and dialogue stay unpublished.
The public design adds durable class-specific equipment and authored-event state.
Earlier equipment-ownership exclusions are superseded. The owner has now also
resolved the private participant policy and persistent-effect rules. The public
design adds acquisition/effect records, player-wide entitlements, saved random
outcomes and derived health; the exact source/conditions remain private.

Concealed narrative canon is intentionally outside the public repository.
Its authorized staging-host record is indexed by the per-worktree metadata path
returned by `git rev-parse --git-path eldritch-private-canon.json`.
Read that local index through existing authorized host access when writing final
story content. Do not copy its contents into public docs, bundles, asset names,
fixtures, screenshots or PR descriptions. Exact private paths stay in metadata.

## Source and workspace observations

Application main: `4c54082e55279d1f0efa301a5fd40e198405b8d9`.
Task branch: `docs/mmo-readiness-20261029`, upstream of the same name.
Application/documentation commit before this update:
`f4bc674400168c08a4028d2b7b0f18f9709192b1`.

Before editing/publication the isolated task worktree was clean, with no active
Git operation, staged/unstaged/untracked changes or unpublished task work.
Fresh helper inspection/sync found upstream 0/0 and main ahead/behind 5/0.
Original development and recovery branches are preserved. This session acquired
its own lease; release only the owning session's token after publication.

The managed cloud environment was inaccessible in earlier checks and was not
reinspected in this revision. Connected staging/source tools suffice; inaccessible
files are not certified.
The public draft remains PR #9. Publish only reviewed player-safe documentation
against the expected branch head, then fetch/fast-forward the clean task checkout
and verify exact file contents and the remote SHA.

## Scope and validation

Intended public files: PROJECT_STATE.md, this handoff, MMO_SKILL_READINESS.md and
docs/superpowers/specs/2026-10-30-eldritch-expeditions-design.md.
The private canon record/index is deliberately not a Git source change.
No runtime, installed skill/dependency, service, database or production change is
part of this revision.

An independent party/status-mechanics review checked this scope revision; earlier
agency/source/builder reviews remain dated evidence for the broader proposal.
Verify relative links, whitespace, intended-file scope and exclusion of concealed
canon before publication. Application tests were not rerun for
documentation-only changes. Earlier exact-main CI passed build/server syntax,
69 backend and 30 browser tests; see the [earlier handoff](https://github.com/zyxoned/eldritchfable.com/blob/8e967b2ac26f43f33c47947e8f57ec93c0be7832/docs/workspace/HANDOFF.md)
for dated evidence. No new CI or live-flow result is implied.

## Watcher operation retained

The existing development Relay watcher was previously verified as a system-managed,
enabled service checking the enrolled development checkout about every 300 seconds.
It was not restarted or freshly service-audited during this story revision.
It does not deploy, push, merge main, run tests or resolve semantic conflicts.
An editing lease pauses its synchronization; inspect current metadata/journal
and result timestamps rather than treating a running PID as a fresh fetch.

Resolve the designated development unit from private host metadata. These are
operator controls with a placeholder, not commands executed during this task:

```sh
sudo systemctl status --no-pager <development-relay-unit>
sudo journalctl --unit <development-relay-unit> --lines 10 --no-pager
sudo systemctl stop <development-relay-unit>
sudo systemctl disable --now <development-relay-unit>
sudo systemctl enable --now <development-relay-unit>
```

The immutable earlier handoff preserves activation/recovery details. No production
checkout is enrolled for automatic development repair.

## Next action and remaining decisions

The participant policy and persistent-effect rules are resolved in the private
authoring source; do not ask those questions again or publish their conditions.
Present the revised design for approval, stating remaining proposed defaults.
Temple length, anchor spacing, ordinary rewards/recovery, precise scene reset
flags and equipment/effect balance remain proposed or delegated authoring work.
Do not treat clarification of individual rules as approval of every default.

After the revised written design is approved, invoke Superpowers writing-plans.
Do not ask the owner to select 2D versus 3D or accept an upfront route menu again.
Deployment remains a separate operation under the existing repository rules;
production was not rechecked or changed in this phase.
