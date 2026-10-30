# Eldritch Fable shared workspace handoff

Current task: playable ruined-Mossvale demo, October 30, 2026, 08:35 EDT.
Executor: connected GitHub, SentinelX staging and AppDeploy tools.

## Playable result

[Play the isolated demo](https://eldritch-fable-mossvale-demo-yizzwe.v2.appdeploy.ai/).

The owner accepted the design and asked to actually demo it. This session built
a bounded single-player prototype: freely explorable ruined Mossvale, optional
conversations/landmarks, physical discovery of two short sample encounters,
eight prototype class profiles, readable combat, recovery, journal, touch/keyboard/
click controls and browser-only saves. It is not the finished MMO or campaign.

The preview is a **separate frontend-only AppDeploy app**,
`eldritch-fable-mossvale-demo-yizzwe`, snapshot `1793363480954`.
AppDeploy reported **ready**, with no frontend/network/runtime errors in its
returned QA snapshot. Its validator normalized formatting/template files; the
deployment snapshot is the authority for subsequent preview edits. Read the
latest stored source before editing that app. The older `mossvale-95cyro` app,
live Eldritch Fable service and customer data were not changed.

## Source and workspace evidence

Repository: https://github.com/zyxoned/eldritchfable.com.git.
Fresh accepted main and application/documentation commit before this work:
`68f91c4531e01ab669953041c5257b3678b8c208`.
Tree: `b5a635787f598833bf1b3ce8c1f9a382a53d2e63`.
The previous design branch head `298672a14036998202a035b9d01c8755a03431a4`
has the exact same tree despite different commit history. Both histories remain
preserved; do not merge equivalent documentation merely to align their SHAs.

New isolated task branch: `demo/ruined-mossvale-20261030`, based on fresh main.
It was clean before editing, enrolled through Workspace Relay, and protected by
this session's owned lease. Publish through the connected GitHub app because
host Git push credentials are unavailable. Fetch/fast-forward only this clean
task checkout after preserving the reviewed candidate; verify exact source
contents and the remote SHA, then release only this session's token.

Authoritative code: [demo source](../../demos/ruined-mossvale/README.md).
Plan: [playable-demo plan](../superpowers/plans/2026-10-30-ruined-mossvale-demo.md).
This is an explicitly bounded demo spike, not execution of the entire MMO plan.
The managed cloud environment remained unavailable; connected staging tools
provided the actual execution path. Its inaccessible files remain UNKNOWN.

## Validation performed this session

- Native rules suite: **6 passed**, zero failures/skips.
- Node syntax checks: world.js, game.js and render.js passed.
- Desktop browser journeys physically followed each road, entered its sample
  scene and returned, retaining discoveries; zero page errors.
- Mobile pointer movement, canceled reset and confirmed reset passed with no
  horizontal overflow.
- Live deployed-browser checks used isolated local-save fixtures to verify real
  Attack/ability UI, encounter completion surviving reload, defeat/wake recovery,
  retained discoveries and actual touch movement; zero page errors/overflow.
- Independent code review found a mismatch between attack warning and damage
  radius. Both now use one shared 1.7-tile footprint; the focused rules check and
  renderer smoke passed.
- Renderer cache checks covered stationary/moving fog, scene changes and bounded
  masks. Software-browser findings led to a fixed-step loop and wall-clock save
  timing; this is not a claim of measured 60 FPS on target consumer devices.
- Five preview workflow definitions are in tests/tests.json. Do not describe
  them as five separately reported AppDeploy E2E passes; the returned status
  provided readiness and error-free QA snapshots, not that detailed report.
- Concealed-content scan, intended-file scope, relative links and whitespace
  were reviewed. No production application suite was rerun for this isolated demo.

The local browser binary and missing libraries were downloaded/extracted into
private task runtime storage; no host package installation, service restart or
production configuration change was needed. A loopback-only static test server
served only the demo directory and may be stopped after verification. Generated
renderer backup siblings were preserved privately rather than published.

## Private authoring and remaining scope

The approved hidden story and effect rules remain outside public Git/frontend
content. The private authoring index is available through the task Git metadata
path returned by `git rev-parse --git-path eldritch-private-canon.json`.
Use authorized host access to read it; never publish its path or concealed
contents in docs, screenshots, fixtures, asset names or PR text.

The demo includes no concealed finale, mark mechanism, real XP/coins, accounts,
multiplayer, full cave depth or full temple campaign. Its saves cannot affect
the live game. Newcomers can move before accepting any hook, decline interactions,
choose either road first and return. Discovered entries alone enter the journal.

Next action: collect the owner's hands-on demo feedback and apply targeted demo
changes, or write the production implementation plan from the accepted design.
The user has already approved the direction; do not ask the same design/renderer
questions again. Full server-authoritative MMO work still needs its own staged
plan and checks; this prototype is not evidence that it exists.

No merge, production deployment, customer database migration, email or live
account/economy action occurred. The existing Relay watcher was not restarted or
freshly service-audited; preserve its established operation.
