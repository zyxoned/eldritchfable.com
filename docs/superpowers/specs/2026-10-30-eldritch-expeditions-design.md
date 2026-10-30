# Eldritch Fable: illustrated discovery and expeditions design

Date: October 30, 2026 (America/New_York).
Status: **Owner-confirmed direction; revised mechanics remain a proposal.**
Application baseline: `4c54082e55279d1f0efa301a5fd40e198405b8d9`.
Documentation parent: `a863ebb7d729e0a281537f550f49ae39f5188053`.

## 1. Intent and decisions

Players begin in **ruined Mossvale**, free to look around, speak to people,
investigate, follow a path, return, ignore a hook or stop playing. Their actions
and decisions shape what they discover and where they go. There is no compulsory
route election, main-quest acceptance or opening plot explanation.

The owner approved illustrated top-down 2D with layered depth, matching the
"Adventures Become Real" reference: black/antique-gold framing, candlelight,
ivory headings, parchment and restrained violet. The requested cave has 100
floors, and a sky-temple route is also discoverable. These are authoring facts,
not a newcomer-facing menu or complete map.

The owner supplied concealed narrative canon separately. Its identities, final
encounter details and explanation of recovery/replay stay out of this public
document and public assets. Authorized builders must consult the private
authoring source before final story content. A local task Git-metadata index
locates that private source; it is deliberately excluded from public Git.

### What changed after owner feedback

The earlier route ballot, named cave-versus-temple cards at arrival, automatic
group advancement and one-floor-for-everyone assumption are superseded.
Physical travel expresses consent; a party member is not a movement command
for everyone else. Any private authored transition is an explicit, narrowly scoped
exception defined in the private contract; it cannot justify forced onboarding or
remote movement of unrelated heroes. No endgame identity, future encounter list
or explanation is delivered to a first-time hero.

### Approaches

| Approach | Tradeoff | Decision |
| --- | --- | --- |
| Illustrated Canvas 2D with layered art and DOM UI | Reuses the stack and tile combat; depth is authored/composited | Owner accepted |
| Full 3D renderer/models/camera | Substantial engine and asset rebuild | Not selected |
| Discovery through playable ruins and physical entrances | Requires per-hero knowledge, consequences and location-aware projections | Owner-directed experience |
| Upfront route selection with plot summaries | Easier coordination, but directs and spoils the first experience | Replaced |

### Proposed defaults, not additional owner canon

Keep ten ten-floor cave chapters, five-floor safe anchors and guardians every
ten floors. The temple is currently proposed as twenty chambers in four sanctums.
Retain the existing XP units/exchange and durable financial history. Recovery
offers affected heroes a return to ruined Mossvale and later journeys to earned,
personally known anchors, plus safe in-place recovery when companions clear
the encounter; it never automatically restarts an expedition.
The owner has now specified the concealed continuation and ending in the private
authoring record. One participant-eligibility policy remains an owner question.
The new direction also requires real, durable class-specific equipment ownership;
that expands the earlier catalog-only scope. Exact item balance remains proposed.

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

Add bounded, durable class-specific game equipment required by private authoring,
including ownership, equip validation and authored effects. Existing class-catalog
metadata alone does not prove ownership. Do not turn this into a general trading,
crafting or loot-market project. No new payment, PvP, jumping/falling or real-time
physics system is required.


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

The ruined settlement, discovered-entrance interactions, class details, stash
and journal share the same
dark/gold/ivory materials. Inventory/journal surfaces may use restrained parchment.
Ruins should include broken streets, moss-covered masonry, damaged landmarks,
warm refuges and visible outward paths. The opening is playable rather than a
mandatory explanatory cutscene. The combat HUD is quieter: compact health, party state, abilities and current
objective only when the hero has engaged with or chosen to track it; journal,
lore and settings live in drawers. A fresh arrival has no compulsory main-quest tracker. Keep the playfield clear.

Cave art uses layered rock/ruins, readable ground and localized amber light with
occasional violet relics. Sky art uses pale weathered stone, gold astronomical
devices, twilight clouds, distant silhouettes and warm braziers. Bright clouds
must not wash out players or attack boundaries.

Use authored sprite atlases, material textures, baked directional highlights,
contact shadows, cached scenery and bounded light overlays. This is the graphics
upgrade; native bump/normal-map shaders are not a prerequisite.


## 4. Ruined Mossvale, exploration and decisions

### First arrival

Proposed implementation: enter a playable safe refuge among the ruins. Offer brief optional controls,
not a mandatory plot cinematic, route carousel or quest checklist. Do not name
undiscovered destinations, their length, their finales or the hidden cause of
events. The hero can move before accepting a quest.

Proposed opening content: local exploration, optional survivor interactions and
at least two walkable outward approaches. These are authored playable spaces leading to
discoveries and optional activities, not a promise of an unlimited continent.
Walking away from one hook must not make that hook intercept the hero everywhere.
Declining a conversation is a valid choice. Do not punish it with a dead UI.

The existing Guardian progress and saved hero remain intact. Adapt old quest
presentation to the ruined setting without announcing new completion goals or
erasing earned progress. Audit the fixed story banner, class lore and intro
cutscene for future claims; browser "intro seen" flags cannot grant story facts.

### Consequences

Use authored consequences, not just different text followed by an identical
forced route. Proposed examples include helping a survivor who shares a landmark,
investigating a damaged ward that exposes an entrance, preserving evidence, or
choosing which local commitment to pursue first. Offer alternate ways to find
important paths so ignoring one NPC does not secretly lock the whole game.

Every choice defines its scope and reset policy:

- **Personal:** knowledge, trust/history, remembered evidence and route access facts.
- **Expedition/scene:** a chosen passage, ward state or local objective outcome.
- **Shared settlement:** only explicitly designed non-destructive common state.

Default to personal/expedition effects. Do not let one hero permanently ruin
another's starter area, kill a necessary shared NPC or overwrite everyone else's
history. Keep shared outdoor walkability coherent; personalized access is an
explicit entrance/interaction condition, not a misleading invisible wall.
Record choice history durably. Replayable scene state may reset as authored;
remembered choices and knowledge are not erased by a loss.

### Parties and physical entry

A social party has one to six ordinary heroes, subject to the existing global
six-seat limit. Heroes roam independently. Members may stay in Mossvale, follow
different approaches, leave a group or choose separate expeditions. A social
party may therefore have multiple expedition runs. One hero has at most one
active run assignment/location at a time; both routes' earned progress remains.

Invitations require authenticated acceptance. Opening a link does not enroll,
move or reveal a destination to its recipient. Creators initially coordinate;
leadership is not power to teleport members, reveal their private journal or
commit their story choices. Run leadership passes to a present retained participant,
not to a party member who stayed elsewhere.

At an observed entrance, the server presents only what that hero can know.
Entering enrolls that hero and explicitly consenting nearby companions in the
same run, or creates a solo run. Require physical range, discovery/access
conditions and current consent for each traveler. Silence, a leader click or
a countdown is never consent. No global cave-versus-temple ballot is required.

A member who stays behind keeps playing where they are. Leaving an active
expedition frees that hero to explore or enter another route; it does not erase
saved checkpoints or abandon everyone else's run. Rejoining uses a physically
known entrance/anchor and current membership/capacity rules. New heroes cannot
select undiscovered high checkpoints; discovered, earned anchors may be offered
locally when relevant. Completed-route markers cannot create an empty run that
auto-grants completion. Under the current content proposal, entrance camp 0
starts floor 1, the latest cave resume camp is 95 and the latest temple resume
camp is 15; the 100/20 completion markers are not empty launch destinations.

## 5. Authored route content and individual travel


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
with replay limited to the failed encounter while cleared floors remain cleared.
These are balancing targets, not timers or reasons to add filler.

### Sky temple: 20 chambers

Four five-chamber sanctums provide a shorter complete expedition: approach/
outer terraces, wind galleries, observatory and celestial sanctum. Each sanctum
ends with a guardian/checkpoint; chamber 20 has its own finale.

Use open sightlines, ward activation, ranged positioning and visible tile-state
puzzles. Floating architecture remains ordinary walkable tiles. There are no
fall deaths, jumping controls or hidden twitch timing requirements. Target
40–60 minutes overall, with five-chamber checkpoint segments.

Both routes are discoverable through the world. No initial screen lists both routes or their endings. Completing the cave is not a prerequisite
for entering the temple, and the temple is not a replacement ending for the cave.



### Discovery versus an authoring roadmap

The chapter counts and names above guide content production. The player's map,
journal and HUD show only observed places and current objectives. Show current
depth when useful, not a checklist of all hundred floors or hidden encounters.
Routes acquire names through observation/dialogue rather than an arrival menu.

### Floor state and crossing

A run stores a cleared frontier and durable floor states keyed by ordinal,
rather than one current floor that forces every hero to share a location.
Heroes in the same run may occupy different already accessible floors.
An exit unlocks through actual objective completion; crossing it moves only
heroes who physically cross and affirm entry. Others can investigate, return,
wait or leave. Do not destroy their occupied floor when a companion advances.

Cleared connections remain traversable in both directions as authored. Reaching
a sealed door can honestly require an objective; it must not demand acceptance
of a prescribed story interpretation. A newly joined hero can catch up through
accessible cleared spaces; no teleport into a remote unseen encounter or
retroactive reward is granted. A hero physically joining an ongoing encounter
uses its existing difficulty snapshot and earns only currently eligible rewards.

Only player-occupied/active floor instances need live processing. With six live
regular seats, at most six occupied expedition floors need live simulation;
persist inactive floors. Each floor has its own revision, entities, effects and
combat membership. Party social membership is not combat range or floor presence.

When a floor clears, commit eligible XP, choice/objective results and progression
before opening the exit. Present downed heroes may choose recovery once the floor
is safe; living heroes can continue or leave. No automatic five-second group
transfer or vote on every floor is part of this revision.

## 6. Loss, recovery, absence and progress

### Diegetic recovery with free choice afterward

Treat the first return as an observed mystery, not an explanation. The concealed
cause and its later confirmation are private authoring content. Do not display
an explanatory death tip, villain-named reset, full loop counter or future finale.

A defeated hero may choose to wake in ruined Mossvale. They are free to explore,
pursue something else, leave or deliberately resume an expedition via an earned,
personally known anchor. Never auto-queue them back into the same run. If companions
clear the floor while that hero remains downed, offer safe in-place recovery too.
These recovery choices restore 100 HP; credited XP is not removed.

Within combat, HP=0 is downed. The new migration must widen the existing 1–100
hero HP constraint to 0–100 while preserving rows/references, and permit zero
only for expedition downed state. Keep Mossvale's existing immediate recovery.
Downed heroes cannot move, activate objectives/exits or cast any combat/skill,
including healing/buffs/wards. Ordinary heals exclude downed targets; there is
no accidental mid-fight resurrection.

A floor encounter is defeated only when its nonempty present combat cohort is
entirely downed, not when heroes elsewhere are downed. An empty floor pauses.
Persist a defeated/pending-recovery phase so repeated heartbeats or downed
observers cannot trigger another reset. Rearm a new attempt only after valid
recovery and physical re-entry, or when an eligible living companion physically
enters from another floor; preserve canonical reward identities. Downed observers
do not have to all leave before that legitimate new attempt.
Reset only the failed encounter's replayable state under stable run/floor/reward
identities. Previously cleared
floors, occupied neighboring floors and other runs are unaffected. The heroes'
choice of when/where to recover is not a command to relocate unrelated members.

Financial receipts, credited XP/copper, lifetime XP, discoveries, remembered
choices and earned progression survive. Reset only authored encounter/scene
state. Retrying the same failed encounter cannot pay its rewards again.

### Network absence and leaving

Keep the 75-second presence lease and 20-second heartbeat. Losing SSE alone does
not mean death, abandonment, discovery, a new heal or voluntary departure.
After lease expiry, the hero is absent from targeting but retains run history.
Re-admission rechecks all six regular seats; if full, wait/return the existing
full-realm state without deleting progress or making a seventh seat.

When no one is present on a floor, pause/save it rather than treating absence
as defeat. Reconnect restores the hero's authoritative location and health,
subject to legitimate intervening outcomes, without pulling them to the party
leader. Offline heroes receive no new story facts or progression merely because
companions advanced somewhere else.

**Return to Mossvale** clears active run assignment but retains membership/history.
The old encounter is paused when empty, not rewound merely to manufacture a safe
re-entry or a new reward. New travel may use another run. **Leave party** removes
social membership without deleting saved hero progress. Explicitly abandoning a
run is separate; no leader may erase another participant's retained progress.
An empty run remains resumable unless its participants explicitly abandon it.

Re-enter only through the hero's discovered entrance or earned anchor, with an
active living hero. No client-supplied remote floor jump. A new run has a new ID;
re-entering an existing run, including after recovery, retains its reward IDs.

### Who earns progress and knowledge

At a five-floor safe anchor, earn a personal checkpoint only while physically
present under the active lease and after a real combat, effective-support or
required-objective contribution in that segment. Present downed heroes can
qualify after the safe boundary is resolved. Heroes elsewhere or absent do not.
A monotonic highest earned checkpoint makes earlier earned-path starts available;
it does not populate unknown journal entries or remotely activate unseen objects.

Route completion requires presence and a qualifying contribution in the final
encounter. A companion completing it elsewhere cannot grant a seal or reveal it.

Discovery is different from financial/progression eligibility. A hero may learn
what they directly witness or inspect without dealing damage; a healer/newcomer
does not have to earn XP to see the visible world. Store separate server-owned
facts for observed landmark, inspected clue, discovered entrance, entered place,
witnessed event and confirmed explanation. Every fact has an explicit spatial/
interaction trigger; missed scenes are not auto-filled by party membership.

## 7. Rewards, difficulty and fairness


Existing Mossvale award units remain unchanged: 15 XP per eligible thornling spawn,
10 XP per unique crystal/account and 100 XP once for the Guardian quest.
Mossvale Guardian objectives remain scoped to Mossvale. Dungeon actions must not
silently satisfy its crystals/shrine/kill prerequisites.

Proposed expedition reward profile `v1`:

- At most five reward-bearing enemy slots per run/floor or run/chamber, each worth 15 XP
  per eligible hero. Guardians occupy one slot rather than adding a bonus.
- One primary-completion reward of 10 XP per eligible hero on an encounter floor.
  Pure rest/camp scenes have no completion reward.
- No depth multiplier, clear XP bonus, new currency or tradable ordinary-floor drop.
  Chapter/route milestones unlock journal seals/completion records. Separately
  authored equipment uses the durable ownership contract below; it is not an
  additional ordinary-floor XP award.
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
customers. It cannot collect customer rewards or occupy a regular seat.
Any future spectator access is read-only and must retain instance isolation.
Current privileged Mossvale behavior remains separate.

Preserve permanent character levels and their existing damage bonus. Floor
difficulty is content depth, not a new character level. Use authored depth
profiles and bounded party-size scaling frozen at the encounter's first hostile
action. Count its floor-local participants, retaining temporarily disconnected
members associated with that encounter. Exclude heroes on other floors, in the
hub, assigned to another run or present only in historical membership records.
Splitting elsewhere cannot inflate a companion's fight. Late physical arrivals
use the frozen profile; no HP/reward change happens during combat.
Do not rescale
HP/rewards mid-fight when someone disconnects. Do not silently cap/replace
lifetime XP, reset heroes or rubber-band rewards to their wallet.
Exact enemy HP/damage tuning is delegated to playtesting within these reward caps.



### Durable class equipment and authored transitions

The private authoring contract now requires persistent class-specific equipment.
The public design deliberately omits its source, discovery conditions and names.
Model item definitions separately from hero-owned instances/entitlements and
equipped slots. Validate the saved hero class and ownership on the server; an
item ID sent by the client or an entry in the shared catalog is not an entitlement.
Capture the relevant class at grant admission and enforce a unique canonical
grant identity per hero. Request retries, recovery, reconnect, class metadata
edits and process restarts cannot mint another copy.

Proposed defaults: class-bound and nontradable, retained through narrative
recovery, with at most one instance per canonical entitlement. "Unique" does not
silently mean a globally exclusive copy. Availability beyond the authored grant,
specific slots, stat budgets and effects remain private authoring/balance work.
Equipment is game state, not money: no sale, XP/copper conversion, checkout or
shop-credit value is introduced. Preserve the existing lifetime-XP level/damage
formula; item effects must be explicit additions, not a replacement progression
or an undisclosed cap.

Use a durable authored-event state machine for admission, placement, encounter
resolution, witnessed content, grant and recovery. Private content defines exact
conditions and outcomes. Resolve competing event claims atomically, fix the
participant roster at the appropriate boundary and persist it across retries/
restarts. Social membership, global world flags and spectatorship alone cannot
pull distant heroes or grant them rewards and knowledge. Do not consume special
customer progression with the privileged avatar. A crash resumes durable pending
state rather than rerunning a grant or selecting a different claimant.

The owner has specified the concealed narrative outcome. The exact cohort-
eligibility rule remains pending and must be resolved before implementing its
transition. Distinguish immutable route-completion history from resettable scene/
cycle state; define the latter explicitly without clearing durable hero knowledge,
equipment, finances or another group's run. A completed scene may deliver only
what that hero witnessed, with reconnect behavior that neither skips a pending
stage nor repeats its side effects.

## 8. Server authority, knowledge and persistence

Add social-party membership, invitations, runs, per-floor states/participants,
per-hero location, discovered facts, choice history, safe anchors and completion
records, equipment ownership/equipped slots and durable authored-event stages.
Runs retain route, seed, content/reward versions and frontier. Each floor
retains encounter/objective/scene state and its own revision. Each hero has one
authoritative current location/HP and active run assignment; do not create a
second wallet or independently editable health store.

Scope enemies, contribution, heals, effects, objective mutation and local messages
to the hero's actual floor/instance. Historical membership alone grants no remote discovery, mutation or travel.
Every new action requires the hero's current active assignment, actual floor,
valid state/range, and current access/consent. Social party chat can be a deliberately
separate channel; server-generated messages must not reveal unknown places or
events elsewhere. Roster labels may say a companion is elsewhere without naming
undiscovered destinations. Wallets, emails, invitation secrets and private account
or narrative facts never enter a shared projection.

### Per-viewer discovery

Every initial snapshot, action response, replay response and SSE publication is
projected for the authenticated viewer's current location and knowledge.
The present global realm()/publish() approach sending one identical object to
every stream is insufficient. A veteran cannot silently upgrade a newcomer's
journal, intro, names, achievements or explanatory dialogue.

Use revelation stages such as observed phenomenon, tentative interpretation,
supporting evidence and confirmed explanation. Stage labels need not be exposed
as a checklist. Keep immediate attack telegraphs, visible entity roles and controls
fair/readable even while plot meaning remains unknown. Knowledge persists across
devices through the saved hero, not localStorage-only flags.

Hide undiscovered content before delivery, not with CSS. Inspect JSON fields,
errors, receipt notices, NPC/system dialogue, maps, party/achievement previews,
alt/ARIA text, localization catalogs, bundles/source maps and asset URLs/preloads.
Use neutral public test fixtures and opaque non-revealing asset identifiers.
Do not send a secret encounter or its named asset until its viewing condition
is met; keep its authoring data outside the public frontend and public repository.

Public technical docs must not contain private author canon. The existing
private authoring bundle is indexed in local Git metadata; it is not a frontend
dependency, public PR attachment or test fixture. At implementation time, load
concealed content server-side with appropriate access, so an ordinary first visit
does not fetch the entire future story. This protects game-delivered revelations;
it does not claim to control what other people say in free-form chat.

### Transactions, replays and ordering

Keep 16–80 character request IDs, input/path hashes, current authentication/
authorization and semantic ledger uniqueness. Resolve authorized existing receipts
before new-action stale-state checks; return a currently authorized projection,
not an old private snapshot from a departed run. Retain request IDs across retries.

Commit encounter resets, rewards, progression, placements and revisions atomically
using existing SQLite transaction patterns. A replayed reset or exit cannot execute
twice. Enforce expected hero location/instance and action preconditions server-side.

Use a monotonic per-hero location epoch plus instance ID/revision and a private
knowledge revision. Travel/recovery/rewind advances relevant epochs/revisions.
Order world responses by location epoch first, then current instance/revision.
Ignore delayed old-context world payloads. Merge the authenticated hero's
knowledge independently and monotonically; an equal/older floor reply must not
erase a newer journal fact or confirmation stage. Clear queued movement, targets,
pathfinding, interpolation and scenery caches on transfer/rewind; reset identity/
knowledge caches on account change. Rotation/resize changes coordinate transforms,
not discovery or world state. Locale cannot bypass reveal gates.

Narrative recovery never rewinds wall-clock sessions, leases, authoritative cooldowns,
ledger timestamps or request receipts. Do not reset the shared server world or
other parties to explain one group's replay. Keep one authoritative Node process;
multiple-worker instance ownership remains a separate scaling problem.

## 9. Rendering, assets and accessibility

Parameterize location descriptions/dimensions, terrain caches, collisions,
scenery and objectives rather than using fixed Mossvale imports. Preserve
server-owned movement. Rehome a legacy hero only if a revised ruin map makes
their saved position invalid; do not reset identity, wallet, earned history or
story facts.

Keep the initial floor budget <=48×36 logical tiles with a clamped top-down camera.
Cache scenery by location/content version. Use painted sprites/materials, baked
highlights, contact shadows and bounded light overlays. Player silhouettes,
walkable ground, hazards and exits outrank filigree or decorative darkness.

Budget five cave material kits, a temple kit and a distinct ruined-Mossvale kit,
about 24 reusable room layouts and a limited enemy/guardian roster with authored
behaviors. Later chapters must change decisions, layout and combinations, not
only recolor a room. Load current-region and authorized nearby assets; final
encounter assets are reveal-gated rather than globally prefetched.

Target 60 FPS on an ordinary desktop, with a 30 FPS reduced-effects mode and
declared measured device/browser profiles. Use compressed backgrounds, <=2048px
atlas pages, pooled effects and bounded caches. Build success is not performance
evidence.

Menus/journal/interactions use real DOM text/controls. Preserve keyboard focus,
movement/interaction, readable text and touch targets. Danger/ally/selection cues
also use shapes or labels. Respect reduced motion for flicker/particles/shake.
Optional onboarding explains controls and immediate safety without story spoilers.

## 10. Delivery and acceptance

Delivery order, not an implementation task plan:

1. Ruined-Mossvale exploration, optional controls and the shared art language.
2. Discovery/choice persistence and physical, consent-based travel; representative
   cave and temple segments with multi-location party support.
3. Correct recovery/replay, per-viewer revelations, rewards and measured rendering.
4. Author/validate all 100 cave floors and proposed 20 temple chambers, with
   private canon integrated at earned reveal points, its required equipment and
   durable staged transitions, and complete authored continuation.

Acceptance must show:

- A fresh hero can immediately explore or leave Mossvale, decline hooks and return,
  with no route picker, mandatory quest/cinematic or future-plot exposition.
- Meaningful authored choices change access, clues, relationships or local outcomes;
  alternatives avoid a single compulsory NPC/quest path.
- Solo, group, split-party/different-run and different-floor occupancy work within
  six global live seats. No leader or timer moves a non-consenting hero;
  narrow privately authored transitions affect only their eligible participants.
- All authored route ordinals have connected entry/objective/exit paths, reproducible
  content and reachable finales; unknown maps/encounters are not sent upfront.
- A newcomer with a veteran sees only earned knowledge; account/device switching,
  journal access, hidden achievements, asset preloads, UI/ARIA and receipt replays
  do not reveal future identities.
- Current-location attacks/heals/effects stay isolated; downed skills/healing,
  privileged expedition mutations and remote travel attempts are rejected.
- Defeat, retries, reconnect, restart, abandoned transport and stale pre-rewind
  responses preserve receipts/credits/discoveries and cannot duplicate rewards.
- Checkpoint/completion recipients are distinct from witnesses; offline or elsewhere
  members do not gain rewards, unseen story facts or unearned completion.
- Equipment grants/equips reject forged ownership, wrong classes and duplicate
  replayed claims; durable event stages survive concurrent admission and crashes
  without resetting unrelated state or publishing concealed content.
- Existing account, Guardian, stash, search/catalog/bag and admin behavior survives.
- Desktop/mobile reference review, real asset loading, controls, reduced motion
  and actual declared performance measurements pass.

Use disposable SQLite and disabled email for meaningful state/ledger integration
and end-to-end journeys. Preserve the package lock. Existing required package
commands in standalone/ remain npm ci, npm test, npm run build and the browser suite.
There is no configured lint or standalone typecheck script.

## 11. Migration and operational boundary

Source main requires schema 4. The forward migration adds expedition/discovery/
choice state, equipment ownership and authored-event records, and carefully widens
hero HP while preserving existing rows,
references, account/session/mail state, Guardian progress, ledger and receipts.
Rehearse upgrades from schema 4 and schema 3→4→new schema on private disposable
copies. Do not populate story knowledge just from character level or an old
browser intro preference.

Earlier production release/schema observations remain dated. This design does
not deploy or re-verify production. Rollout needs current identities, compatible
fallback, retained hashed assets and preservation of subsequent customer writes.

Only advertise working travel when the server exposes matching capabilities.
Against an old backend, preserve existing play with truthful availability feedback,
not an apparently functional new entrance. No new paid provider/service or
unattended scheduler is required for design.

## 12. Builder discretion and remaining owner decisions

The owner has specified ruined Mossvale, free exploration, action-driven direction,
spoiler protection and concealed story canon. The approved art direction remains.

Temple length, safe-anchor spacing, ordinary recovery details and bounded XP
rewards remain proposals. The owner has resolved the concealed narrative outcome
in the private authoring record. Do not publish it or invent a permanent global
ending. One participant-eligibility question remains with the owner. Resettable
scene flags/checkpoint reuse and equipment availability/balance must be explicit
in the private implementation design; durable hero records remain preserved by
the proposed contract. Final story writing follows the owner.

The builder may settle module/table/endpoint names, asset packing, typography
fallback, animation, exact objective patterns, enemy tuning and caches within
these contracts. A sample area is not completion of the whole project.

After the revised written design is approved, use Superpowers writing-plans.
No product code, skill/dependency installation or deployment occurs during this
document revision.

## Source and skill references

- [Agent instructions](https://github.com/zyxoned/eldritchfable.com/blob/4c54082e55279d1f0efa301a5fd40e198405b8d9/AGENTS.md)
- [Current game server](https://github.com/zyxoned/eldritchfable.com/blob/4c54082e55279d1f0efa301a5fd40e198405b8d9/standalone/server/game.mjs)
- [Game persistence](https://github.com/zyxoned/eldritchfable.com/blob/4c54082e55279d1f0efa301a5fd40e198405b8d9/standalone/server/migrations/003-game-stash.sql)
- [Current renderer](https://github.com/zyxoned/eldritchfable.com/blob/4c54082e55279d1f0efa301a5fd40e198405b8d9/standalone/src/game/GameCanvas.tsx)
- [Selected skill guidance](../../workspace/MMO_SKILL_READINESS.md)

Use Game UI Frontend, Game Engine, Game Art, Level Design and Encounter Design
after the process gates. The private authoring source is deliberately not linked
from this public document.
