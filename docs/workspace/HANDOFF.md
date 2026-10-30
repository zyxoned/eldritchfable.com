# Eldritch Fable shared workspace handoff

Current task: private-authoring scope revision, October 30, 2026, 06:57 EDT
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
Earlier equipment-ownership exclusions are superseded.

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
`a863ebb7d729e0a281537f550f49ae39f5188053`.

Before editing/publication the isolated task worktree was clean, with no active
Git operation, staged/unstaged/untracked changes or unpublished task work.
Fresh helper inspection/sync found upstream 0/0 and main ahead/behind 4/0.
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

An independent narrative/persistence review checked this scope revision; earlier
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

Resolve the one pending participant-eligibility question already presented to
the owner; its exact wording and private context are in the authoring record.
The narrative continuation/ending itself is now owner-specified. Preserve its
privacy. Temple length, anchor spacing, ordinary rewards/recovery, precise scene
reset flags and equipment balance/availability remain proposed or unspecified.
Then present the revised design for approval; do not treat the story clarification
alone as approval of every mechanical default.

After the revised written design is approved, invoke Superpowers writing-plans.
Do not ask the owner to select 2D versus 3D or accept an upfront route menu again.
Deployment remains a separate operation under the existing repository rules;
production was not rechecked or changed in this phase.
