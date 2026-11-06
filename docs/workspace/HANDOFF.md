# Eldritch Fable shared workspace handoff

## Business records handoff - November 06, 2026, 11:43 EST

The owner supplied two PDFs for Codex, Copilot and source work. This entry records
the business-records task; older deployment observations and separate unpublished
feature work retain their own scope.

| Field | Observed evidence |
| --- | --- |
| Repository | `https://github.com/zyxoned/eldritchfable.com.git` |
| Observed checkout | Isolated cloud clone at `/workspace/scratch/9fd3939069d1/projects/eldritchfable.com` |
| Accepted main | `1023c62c23d89645fbfe7e06ee813ee59fba5b3f`, freshly fetched before edits |
| Task branch | `docs/business-identity-20261106` |
| Source-context commit before this handoff | `b6399659c1cbd968c2ccc44970943e473a278ef4` |
| State before handoff edits | Clean, one local task commit; task branch had no upstream yet |
| Other workspaces | Existing Codex/Copilot checkouts and unpublished work remain UNKNOWN |
| Production | No production application, database or provider-account changes; release not inspected |

**Shared source:** [Business evidence](../BUSINESS_IDENTITY.md) and the
[source-safe profile](../../standalone/src/config/business-profile.json). Root
`AGENTS.md` and `.github/copilot-instructions.md` direct both agents to those files.
Ignore patterns cover private packet/profile/original names. This is reference
data only, with no runtime import or checkout activation.

**Private delivery:** unchanged original PDFs, `business-profile.private.json`,
README and SHA-256 manifest are in an owner-held packet and a separate protected
directory on the connected project host. The packet's private README records the
exact host location. All manifest hashes match the delivered bytes; directory
modes are 0700 and file modes 0600. No EIN, full address, personal names or
original PDFs are committed here. Private access must be authorized in the target
session; source publication does not grant it.

**Evidence limits:** the LLC-named PDF is Articles of Organization with a large
DRAFT watermark, not an accepted-filing certificate. The IRS CP575G notice supplies
a documented business identity/EIN; it does not prove an S/C corporate election,
sales-tax registration, current ownership or provider approval. Matching address
text is documented input, not confirmation of its current head-office role.
No issuing agency or current provider account was independently queried.

**Checks performed:** text extraction and visual inspection of both originals;
byte-for-byte source-copy and host SHA-256 verification; ZIP integrity; JSON parse
and identity consistency; relative-link checks; private-literal scan;
`git check-ignore --quiet` for original/profile/packet examples; no runtime import
confirmed with `rg`; `git diff --check`. Git hooks and the current CI workflow were
inspected: no active local hooks and no deployment step in that workflow. No fresh
application/build/browser test pass is claimed for this documentation/metadata work.

The local Git push could not authenticate. Publication therefore uses the
connected GitHub account with the identical reviewed source tree; local work
and its original commit history are preserved. The source-context SHA above
identifies that GitHub history.

**Publication and next action:** publish/verify this task branch through the normal
GitHub review workflow, then fetch the accepted source update in the intended
Codex/Copilot workspace. Read the shared evidence/profile and, for an authorized
onboarding task that actually needs private values, use the owner-held packet or
existing private host connection. Do not enable live checkout, create tax
registrations or treat draft formation as accepted as part of this handoff.
Identify the later documentation commit through Git history and the remote ref.

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
