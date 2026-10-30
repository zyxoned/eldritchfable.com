# Eldritch Fable: illustrated expeditions design

Date: October 30, 2026 (America/New_York).
Status: **Design for owner review; gameplay defaults below are proposals.**
Source baseline: `4c54082e55279d1f0efa301a5fd40e198405b8d9`.
Documentation parent: `9e0c7db38fc3b91bb62caa42f6cc17669c70041b`.

## 1. Intent and decisions

Make the supplied "Adventures Become Real" storefront reference feel like the
entrance to the same illustrated fantasy world players explore together.

The owner approved the recommendation of **illustrated top-down 2D with layered
depth**, antique-gold/black framing, candlelit cave stone and pale temple ruins
above twilight clouds. The requested cave has **100 dungeon floors** and the
party can choose it or a sky temple. One hundred floors does not set a character
level cap. The image and visual approach are decided; the owner has not yet
approved the detailed party, checkpoint, reward or temple-size policies below.

This is a substantial feature project within the existing React/Vite and
Node/SQLite application. It includes a targeted storefront fidelity pass, a shared
visual language for the game and a complete expedition system. It is not a claim
that any of those new systems have been implemented.

### Approaches considered

| Approach | Tradeoff | Decision |
| --- | --- | --- |
| Illustrated Canvas 2D, layered scenery and DOM interface | Reuses the running stack, keeps readable tile combat and supports rich authored art; lighting/material depth must be illustrated or composited | Owner accepted this recommendation |
| Full 3D characters, environments and movable camera | Adds a renderer, modeling/rigging/animation pipeline and camera/physics decisions; materially enlarges the rebuild | Not selected |

### Proposed defaults requiring review

- Cave: ten chapters of ten floors; checkpoints every five, guardian every ten.
- Sky temple: twenty chambers in four five-chamber sanctums, a shorter complete route.
- Route selection at the hub uses a timed party ballot, followed by individual departure confirmation.
- Progress belongs to saved heroes/accounts; parties own the current expedition.
- Existing redeemable XP units and exchange rules remain; no depth multipliers, new currency or tradable loot.
- Defeat returns the party to its current checkpoint, without removing credited XP.

Implementation may settle the details explicitly delegated in section 12.
Changes to these behavioral defaults require updating the design.

## 2. Existing foundations and boundaries

The maintained app is `standalone/`: React 18/Vite 6, a custom Canvas 2D
renderer, Node >=24, SQLite and authenticated server-sent events (SSE).
Keep this architecture. No Three.js/R3F, replacement framework, new database,
external auth provider or paid asset service is required.

Today there is one 30×22 Mossvale map and a singleton saved world. Six ordinary
accounts may be present globally; the separate administrator avatar is not a
seventh customer slot. Keep that global capacity while allowing separate parties
and expedition instances within it. This design does not promise larger-scale
MMO infrastructure or multiple authoritative server workers.

Preserve:

- One saved normal hero per account, including its established name/class.
- Accounts, sessions, verification, mail, Guardian progress and public/private data boundaries.
- Spendable `balance_xp`, nondecreasing `lifetime_xp`, copper and ledger history.
- Character level `1 + floor(lifetime_xp / 100)` and existing lifetime-XP combat bonuses.
- The exact exchange: 1,250 spendable XP → 1,000 copper → one gold → one penny shop credit.
- Existing authoritative movement, skills, range/cooldown checks and mutation receipts.
- Existing storefront navigation, search, collections, wishlist, bag and disabled-checkout behavior.

There is no new payment, inventory-ownership, equipment-stat, PvP, jumping/falling
or real-time physics system in this scope.

## 3. Visual design and storefront fidelity

The attachment is the visual target. The archived "Greater Stories" references
are different compositions and must not replace it.

Use near-black charcoal, aged gold, warm ivory, candle amber and limited violet.
Gold frames meaningful content; it does not replace danger, ally or resource
signals. Use Roman/serif display lettering for large headings and readable text
for descriptions, chat, numbers and controls. Reuse existing fonts first.

### Storefront

Retain the supplied hierarchy: compact dark header; dragon/dice hero; large
"Adventures Become Real" heading; ornate castle-and-violet-gem divider; six
illustrated category cards in three desktop columns; parchment search strip;
distant mountain/castle promise area; dark multi-column footer.

Reuse existing hero/category artwork and real DOM text. Assess the final CSS
cascade before changing geometry. Add a dedicated landscape treatment for the
promise area rather than stretching the current dragon crop.

Use the reference labels where they describe existing destinations. The hero's
"Explore the Tavern" action goes to the category section; category actions retain
their existing collection/search routing. Keep Adventure, Account and bag access
available. Preserve the whole wordmark on narrow phones.

Match the four-pillar promise layout with truthful existing policy/preview copy;
the reference does not establish verified stock, inspection or fulfillment facts.
Links must lead to existing destinations. At narrow widths the cards become two
then one column without shrinking readable text or overflowing the page.

### Game shell

The hub, route cards, welcome, class details, stash and journal share the same
dark/gold/ivory materials. Inventory/journal surfaces may use restrained parchment.
The combat HUD is quieter: compact health, party state, abilities and current
objective; journal/lore/settings live in drawers. Keep the playfield clear.

Cave art uses layered rock/ruins, readable ground and localized amber light with
occasional violet relics. Sky art uses pale weathered stone, gold astronomical
devices, twilight clouds, distant silhouettes and warm braziers. Bright clouds
must not wash out players or attack boundaries.

Use authored sprite atlases, material textures, baked directional highlights,
contact shadows, cached scenery and bounded light overlays. This is the graphics
upgrade; native bump/normal-map shaders are not a prerequisite.

## 4. Player journey and party decisions

Mossvale remains the hub and its Guardian quest remains available. Verified,
enabled accounts enter through existing account/game flows.

A hero can belong to one party and participate in one unfinished expedition.
Parties contain one to six ordinary heroes, subject to the six global live seats.
Solo expeditions are supported. Invitation links identify an invitation, require
authenticated acceptance and cannot enroll an account merely by being opened.

The creator leads initially. Invitations, removing a member and leadership
transfer are available in the hub or at a cleared checkpoint, not during combat.
A member can leave voluntarily at any time; leaving never deletes hero progress
or another member's expedition. If the leader leaves or loses presence, the
longest-tenured present member becomes acting leader. Expedition succession
considers only its retained run participants, not party members who stayed in
the hub. A fully offline party/run pauses and remains resumable.

### Route ballot

The leader proposes a route at the hub. Freeze the ordinary-party roster for
a 20-second ballot: each member can choose cave, sky or abstain and may change
the choice before closing. A route needs strictly more than half of the frozen
roster. A tie or no majority cancels the ballot. Roster changes cancel it.
One hero's vote counts once across tabs; the administrator avatar has no vote.

After a winner, show route, selected shared checkpoint, participant list and
departure confirmation. Each member chooses Join or Stay in hub. Wait until
all have responded or 60 seconds elapse; silence means Stay. At least one
confirmed, present member is required to launch. Never move a dissenting or
unconfirmed player into an expedition.

The launch leader is the current leader if confirmed, otherwise the longest-
tenured confirmed member. It is presentation/control ownership, not authority
to bypass server rules. Members who stay may leave the party to form another;
one party can own only one unfinished run.

A group may resume a checkpoint unlocked by every departing hero. New parties
use the intersection of the departing heroes' unlocked checkpoints. The default
is the latest shared checkpoint; beginning at floor/chamber one is always offered.
The cave's latest start is camp 95, the temple's is camp 15: completed route
markers 100/20 cannot produce an empty, automatically completed run.

Route changes occur after returning to the hub and explicitly abandoning or
completing the current run. Abandonment preserves already credited XP and
personal checkpoint unlocks; it cannot reset reward identities inside that run.

## 5. Content, progression and checkpoints

### Cave: 100 numbered floors

Use ten chapters of ten floors. Each chapter introduces or recombines a regional
kit, objective pattern and enemy composition. A guardian occupies each tenth
floor; floor 100 has an authored finale.

Proposed regional chapters:

| Floors | Regional identity |
| --- | --- |
| 1–10 | Torchlit stone warrens |
| 11–20 | Flooded galleries |
| 21–30 | Root-bound tombs |
| 31–40 | Cinder vaults |
| 41–50 | Violet crystal seams |
| 51–60 | Ruined archive galleries |
| 61–70 | Sunken citadel |
| 71–80 | Obsidian forge |
| 81–90 | Astral fracture |
| 91–100 | Sealed depths and final guardian |

Build these from five cave material kits, with later chapters changing silhouettes,
arrangements, objective combinations and lighting. They are not ten recolors of
the same floor. Use authored chapter beats plus deterministic, validated room
assembly. Each floor needs a reachable entry, meaningful objective and reachable
exit; safe routes, walls and visual occlusion must agree with collision data.

Support a small objective vocabulary: defeat marked wardens, activate wardstones,
open a sealed passage and defeat a guardian. Five-floor boundaries unlock safe
camps after the floor is cleared. Camp 0 is the entrance; camps 5 through 95
allow resumption; floor 100 completes the route.

Target roughly 25–35 minutes per ten-floor chapter and 4–6 hours across visits,
with ordinary wipe replay limited to the previous five-floor segment. These are
balancing targets, not timers or reasons to add filler.

### Sky temple: 20 chambers

Four five-chamber sanctums provide a shorter complete expedition: approach/
outer terraces, wind galleries, observatory and celestial sanctum. Each sanctum
ends with a guardian/checkpoint; chamber 20 has its own finale.

Use open sightlines, ward activation, ranged positioning and visible tile-state
puzzles. Floating architecture remains ordinary walkable tiles. There are no
fall deaths, jumping controls or hidden twitch timing requirements. Target
40–60 minutes overall, with five-chamber checkpoint segments.

Both routes are available from the hub. Completing the cave is not a prerequisite
for entering the temple, and the temple is not a replacement ending for the cave.

### Floor completion and transfer

The server decides when the primary objective and required encounters are complete.
Commit eligible rewards and journal progress before enabling the exit.

Any living present participant may activate a cleared exit. Show a five-second
departure countdown. During it a member may choose Return to hub instead of
advancing; no additional unanimous vote is required for every floor.
Transfer remaining participants together exactly once, including present downed
heroes. Reconcile disconnected members to the new floor on reconnect.

At normal floor boundaries living heroes retain HP; downed heroes return at
100 HP, preserving the existing full-health/no-XP-loss recovery principle.
These authoritative transitions apply to retained in-run participants, including
network-absent heroes; voluntary hub visitors are not transported back.
At safe camps all retained in-run participants recover to 100 HP. Tune difficulty around this explicit
behavior rather than adding unannounced death penalties or consumable charges.

The current combat cadence remains action-triggered and server-authoritative.
Guardian variation may use ward phases, marked targets, add waves and visible
objective states. Cosmetic windups must not invent damage or imply an autonomous
simulation that the server does not provide. Timed floor departures may use a
bounded persisted deadline; combat does not require a new high-frequency loop.

## 6. Defeat, leaving, disconnect and resumption

Inside an expedition, zero HP produces a saved downed state rather than instantly
warping a hero to Mossvale. Current schema 4 constrains normal HP to 1–100;
the new migration must preserve/rebuild that constraint as 0–100, retain every
existing row/reference, and allow HP=0 only for an expedition downed state.
The server keeps Mossvale's existing immediate 100-HP recovery transaction.
HP remains the one authoritative health value; do not add a divergent HP store. A downed hero can observe, chat and maintain presence
but cannot move, activate objectives/exits, or perform any combat/skill action,
including healing, buffs and wards. Ordinary healing must exclude HP=0/downed
targets; a heal cannot resurrect them. Recovery is allowed only at the defined
floor/camp/wipe transition, not through a combat query that currently heals all
nearby active characters.

If all present combat participants are downed, atomically reset the run to the
latest cleared camp, restore 100 HP and reload the next floor in that segment.
Keep credited XP and reward receipts. On replay, identical encounters use the
same reward identities; previously credited rewards are not paid again.

Retain the current 75-second seat lease and 20-second heartbeat. A lost SSE
connection alone does not abandon a hero or grant a heal. After the lease expires,
the hero is absent from targeting and active membership projections but remains
a run participant. Reconnection rechecks the six global regular seats. If they have been filled,
return the existing full-realm/waiting state while preserving run membership;
never reserve or create a seventh seat. When admitted, restore the same hero
and the run's canonical location and health state. Network loss alone does not
heal; subsequent floor/camp/wipe transitions may legitimately have changed
that saved HP/downed state while the hero was absent.

If nobody is present, pause instead of treating disconnection as a wipe. Resume
durable state after restart. Expired departure deadlines are reconciled once
when the run is recovered. A reconnect cannot replay an old countdown/advance.

Distinguish three operations in the UI and state machine:

- **Return to hub:** retreat but retain party/run membership. The hero receives
  normal hub recovery and cannot re-enter the active encounter; re-entry is at
  a cleared camp. If this removes the last present in-run hero, reset the current
  segment to its last cleared camp and mark the run paused-at-camp. Reset enemies/
  objectives with the same run/reward identities; keep credited XP. This gives
  the party an actual safe place to re-enter instead of stranding a run mid-floor.
- **Leave party:** remove membership and mark that participant left. If nobody
  remains a member, mark the run abandoned. A new invitation later is a new
  participant admission and follows shared-checkpoint rules.
- **Network absence:** preserve membership and encounter state. If all heroes
  simply lose presence, pause at the current encounter rather than rewinding.

Retained members returning from the hub may rejoin their existing run at its next
cleared camp even if their personal checkpoint is older; they do not receive
missed checkpoint awards merely by returning. They cannot rejoin during combat.
These distinctions prevent leave/rejoin healing of an ongoing encounter.

New participants may join a party only at hub/camp and enter the expedition only
at a cleared camp, after accepting the route and checkpoint. No mid-fight carry
or late reward claim is permitted. New lower-progress participants cannot enter a camp they have not unlocked.
To include them, complete or explicitly abandon the current run, then launch a
new run from an earlier shared camp. Do not rewind the same unfinished run to
admit a newcomer. Only wipe/last-member retreat resets its current segment,
using the same IDs; an explicitly new run has a new ID.

### Who receives progress

Personal checkpoint progression is separate from XP eligibility. At a five-floor
camp clear, award the checkpoint only to retained participants who are present
under the active lease and made at least one real combat, effective-support or
required-objective contribution during that five-floor segment. A present downed
hero may qualify; a network-absent or voluntary hub visitor does not. Merely
voting, moving, standing nearby or readying is not a contribution.

Store a monotonic highest checkpoint per hero/route; earning a later checkpoint
also makes earlier camps available. Reset the segment-participation marker only
at a committed camp boundary. Route completion additionally requires presence
and a qualifying contribution during the final guardian encounter. Downed heroes
can qualify; absent heroes do not receive a completion seal automatically.
Reconnecting to the same ongoing run remains possible without receiving missed
personal unlocks. A later eligible camp can advance their personal checkpoint.

If the party disbands, retain each hero's personal unlocked checkpoints and
completion records. Completed/abandoned runs stay auditable; no automatic
deletion of financial ledger or replay-protection records is introduced.

## 7. Rewards, difficulty and fairness

Current Mossvale rewards remain unchanged: 15 XP per eligible thornling spawn,
10 XP per unique crystal/account and 100 XP once for the Guardian quest.
Mossvale Guardian objectives remain scoped to Mossvale. Dungeon actions must not
silently satisfy its crystals/shrine/kill prerequisites.

Proposed expedition reward profile `v1`:

- At most five reward-bearing enemy slots per floor/chamber, each worth 15 XP
  per eligible hero. Guardians occupy one slot rather than adding a bonus.
- One primary-completion reward of 10 XP per eligible hero on an encounter floor.
  Pure rest/camp scenes have no completion reward.
- No depth multiplier, clear bonus, new currency, tradable drop or equipment-stat
  ownership. Chapter/route milestones unlock journal seals/completion records.
- Hard ceilings are 85 XP per hero per floor, 8,500 per full cave run and 1,700
  per full temple run. Actual authored budgets may be lower; resumed runs award
  only the remaining eligible content, never the ceiling automatically.

Keep both request-level receipts and semantic ledger deduplication. Keys include
the immutable run ID, content version, floor/chamber and canonical encounter/
objective slot, never a retry/attempt number. Wipes/restarts reuse those keys.
A new explicitly started run may earn rewards again; starting at a checkpoint
does not grant skipped-floor rewards.

For expeditions, eligible kills require present, verified/active regular heroes
who contributed positive damage in the last 30 seconds. Proposed support addition:
effective healing of an eligible contributor during that same encounter also
qualifies the healer for 30 seconds. The server must link real restored HP and
the recipient's contribution to the encounter; overhealing and idle/buff spam
do not qualify. Healing grants no XP directly. Do not change Mossvale's current
damage-only rule as incidental cleanup.

Completion XP requires presence plus a qualifying combat/support contribution or
a required objective interaction within the preceding 30 seconds. Departure
confirmation, standing nearby and being in the party are not contributions.

Privileged executions never generate redeemable XP, including for ordinary
contributors. For this scope, the seventh avatar cannot enter expedition combat
or perform expedition mutations at all. Reject privileged damage, execution,
healing, movement/teleport, objective, completion and checkpoint commands there;
this prevents an administrator clearing encounters on behalf of reward-eligible
customers. It cannot vote, occupy a regular seat or collect customer rewards.
Any future spectator access is read-only and must retain instance isolation.
Current privileged Mossvale behavior remains separate.

Preserve permanent character levels and their existing damage bonus. Floor
difficulty is content depth, not a new character level. Use authored depth
profiles and bounded party-size scaling fixed at floor entry. Count retained
in-run participants, including network-absent members, and exclude voluntary
hub visitors or members who left. Reconnecting cannot exploit solo scaling.
Do not rescale
HP/rewards mid-fight when someone disconnects. Do not silently cap/replace
lifetime XP, reset heroes or rubber-band rewards to their wallet.
Exact enemy HP/damage tuning is delegated to playtesting within these reward caps.

## 8. Server authority, persistence and privacy

Add parties, invitation/membership, runs, participants, per-hero route checkpoints
and journal completion records. An unfinished run stores its route, seed,
content/reward versions, current ordinal, checkpoint, status, current encounter
state, objective progress, departure deadline and instance revision.

There is one authoritative current location/HP/position for a normal hero.
Do not create competing balances or two independently editable hero health states.
The builder may choose table/column layout, but membership, downed state and
location changes must commit consistently with the existing saved hero.

Every enemy, effect, contribution, heal target, combat message and action is
scoped to the current hub or expedition floor. Existing "nearby party heal"
must use actual party/run membership inside expeditions. Private party/run
messages cannot appear in other parties' SSE snapshots. Wallets, account IDs,
email and invitation secrets never enter public projections.

Mutations express intent and include a 16–80 character request ID, expected
location/run/floor and instance revision where applicable. Revalidate current
session/account, membership, phase, permissions, range and cooldown server-side.
Bind receipts to the path/input hash; changed payloads under the same ID conflict.
After current authentication/authorization, resolve an existing receipt before
new-action floor/revision preconditions; otherwise a successful transition replay
would incorrectly fail as stale. Return only a currently authorized projection,
never an old private run snapshot to a member who has left. Retry an uncertain
mutation with its original ID rather than generating a new one.

Floor advancement is a conditional, transactional state change. Commit rewards,
completion/checkpoint records, placements, revision and new encounter state
together. Concurrent exits, repeated countdowns and stale requests cannot advance
twice. Use the existing SQLite `BEGIN IMMEDIATE`/receipt/ledger patterns.

Version snapshots with a server-owned, monotonic per-hero location epoch plus
`(instanceId, revision)`. Increment the epoch on committed location/floor transfer
or rewind. A new instance may have a lower local revision; reset its caches, but
reject delayed responses/streams from an older epoch so an old request cannot
switch the client back to the location it just left. Within the same epoch,
accept only the current instance and nondecreasing revision. Reset identity/epoch
tracking on account change. SSE reconnect obtains a fresh authoritative snapshot;
this scope does not require a replayable event-log transport.

Persist content versions/seeds so an existing run remains reproducible. Do not
regenerate its rooms against a newer template version after restart. Keep a
single authoritative Node process; multiple workers require a separate ownership/
publication design.

## 9. Rendering, assets and accessibility

Replace fixed Mossvale map imports/caches with a versioned location description:
route/floor identity, dimensions, walkability, scenery, objectives, entities and
visual kit. Keep collision and accepted movement server-owned; client art cannot
introduce walkable shortcuts. Mossvale remains a supported location.

For initial budgeting, cap generated floor maps at 48×36 tiles, preserve the
existing logical tile unit, and use a clamped top-down camera that keeps the
local hero visible. Rebuild cached layers when location/content changes.
Use a consistent art scale and readable silhouettes; decorative foreground may
fade near players/hazards and must not hide exits.

Proposed content budget: five cave material kits plus a temple kit, about 24
reusable room layouts, eight ordinary enemy families and a limited guardian
roster with ten cave/four temple encounter definitions. Distinct guardians may
reuse animation rigs/sprites where silhouettes/phase behavior remain clear.

Load the current region and the next needed kit, rather than all 100 floors'
art. Use compressed backgrounds, alpha sprites/atlases with <=2048px pages,
pooled effects and a bounded visible effect count. Exact asset dimensions and
cache eviction are builder decisions within measured device budgets.

Target 60 FPS on an ordinary desktop with a 30 FPS reduced-effects mode;
current rendering is roughly 30 FPS. Measure frame times on declared browser/
device profiles and distinguish emulation from actual phone evidence.
Do not claim a target was achieved from build success alone.

Use real DOM buttons/text for menus, vote/ready state, inventory and dialogs.
Provide keyboard movement/actions/focus restoration, visible selected/disabled
states, readable small text, comfortable touch targets and non-color cues.
Candle flicker, particles, parallax and shake respect reduced motion/settings.
A floor objective, exit direction and party status must remain understandable
without decorative animation.

## 10. Delivery order and acceptance

This is delivery sequencing for the design, not an implementation task plan:

1. Shared visual foundations and storefront fidelity; preserve existing flows.
2. One playable cave segment and one temple segment with explicit parties,
   route selection, isolation, persistence and final-quality representative art.
3. Validate checkpoint/reconnect/reward semantics and measured rendering.
4. Author/validate all 100 cave floors and all 20 temple chambers, their guardians
   and complete route endings. A sample segment is not completion of this project.

Acceptance must demonstrate:

- Screenshot/reference review at desktop and narrow phone widths across storefront,
  hub/route choice, cave, temple, HUD, class details and stash.
- All cave ordinals 1–100 and temple ordinals 1–20 have valid connected entry/
  objective/exit paths, reproducible seeds and reachable finales.
- Solo and up-to-six-person play, two separate parties, capacity limits,
  invitation acceptance, ballot ties/timeouts, opt-out and safe roster changes.
- No cross-instance healing, targeting, chat/effects, cache ordering or private-data leaks.
- Exactly-once advancement/rewards under retries, concurrent exits, party wipes,
  reconnect, process restart and privileged intervention.
- Correct checkpoint/completion recipients, retreat versus network-pause lifecycle,
  six-seat re-admission, no-XP-loss recovery, support eligibility, per-floor/run caps
  and unchanged XP/copper exchange/lifetime progression.
- Existing account, Guardian, stash, catalog/search/bag and admin tests remain valid.
- Real asset loading, keyboard/mobile flows, reduced motion and declared performance
  measurements, not a screenshot-only simulation.

Use meaningful unit/integration coverage for generation, state transitions and
ledger semantics, plus end-to-end browser coverage of real expedition journeys.
Use disposable SQLite and disabled email. Preserve the package lock; existing
required checks are `npm ci`, `npm test`, `npm run build` and the browser suite
inside `standalone/`. There is no configured lint/standalone typecheck script.

## 11. Migration and operational boundary

Main requires schema 4 and rejects an unmigrated database. The expansion needs
a forward migration after it: add expedition state and carefully widen the
normal-hero HP constraint while preserving all existing rows/references. Preserve account/session/mail rows, hero IDs,
Guardian progress, balances, ledger and receipts. Verify both schema-4 upgrade
and a rehearsed schema-3→4→new-schema path using private disposable copies.

Production's older schema/release observations remain dated; this design does
not re-verify or deploy production. A future rollout needs current identities,
schema-compatible fallback, retained hashed assets and preservation of subsequent
customer writes. Do not treat an old database restore as a safe code rollback.

The frontend can advertise expeditions only when the server exposes matching
capabilities. Against an older server, keep existing play available and explain
that expeditions are unavailable; do not render a working-looking route that
cannot be entered. No new service, scheduler, email or paid integration is required
for the design review.

## 12. Builder discretion and remaining owner decision

Within this approved shape, the builder can settle module/table names, endpoint
paths, exact asset packing, font fallback, animations, objective configurations,
enemy tuning and cache internals. Document material deviations and verify them.

The owner is now asked to review the full design, especially the proposed
20-chamber temple, five-floor checkpoints, party ballot/opt-in policy, downed
recovery and bounded reward/support rules. Approval of the visual recommendation
does not retrospectively approve those newly specified mechanics.

After design approval, use Superpowers writing-plans to produce the build plan.
No product implementation or dependency/skill installation has been authorized
by this document alone.

## Source and skill references

- [Current agent instructions](https://github.com/zyxoned/eldritchfable.com/blob/4c54082e55279d1f0efa301a5fd40e198405b8d9/AGENTS.md)
- [Game server and receipts/rewards](https://github.com/zyxoned/eldritchfable.com/blob/4c54082e55279d1f0efa301a5fd40e198405b8d9/standalone/server/game.mjs)
- [Game schema](https://github.com/zyxoned/eldritchfable.com/blob/4c54082e55279d1f0efa301a5fd40e198405b8d9/standalone/server/migrations/003-game-stash.sql)
- [Existing renderer](https://github.com/zyxoned/eldritchfable.com/blob/4c54082e55279d1f0efa301a5fd40e198405b8d9/standalone/src/game/GameCanvas.tsx)
- [Verified skill shortlist](../../workspace/MMO_SKILL_READINESS.md)

Selected skill guidance: Game UI Frontend, Game Engine, Game Art, Level Design
and Encounter Design. Read their pinned content before application; do not
install an entire catalog or invoke 3D material workflows for this 2D design.
