# MMO expansion and visual skill readiness

## Direction accepted — October 30, 2026

The owner accepted illustrated top-down 2D with layered depth and the supplied
black/antique-gold candlelit aesthetic. The earlier renderer question is resolved.

[The full design](../superpowers/specs/2026-10-30-eldritch-expeditions-design.md)
turns that direction into a concrete proposal for the 100-floor cave, a
20-chamber sky temple, party route choice, checkpoints and graphics upgrade.
The temple size and detailed gameplay policies remain proposed defaults for
review. No skill has been installed and no product implementation has started.

Use Game UI Frontend, Game Engine, Game Art, Level Design and Encounter Design
as the selected guidance. Full 3D/R3F options below are historical alternatives,
not work selected for this design. After the owner approves the written
design, use Superpowers writing-plans before implementation.

Initial readiness audit: October 29, 2026, about 17:20 EDT (America/New_York).
Source baseline: `4c54082e55279d1f0efa301a5fd40e198405b8d9`.
This is a readiness audit and skill shortlist, not an approved feature design.

## Reference received — October 29, 2026, 21:57 EDT

The owner supplied a portrait-format Eldritch Fable storefront reference headed
"Adventures Become Real." This supersedes the earlier note that the aesthetic
reference was still forthcoming. This intake records the reference and selects
skills; it is not an approved implementation design.

### What the image establishes

- Near-black surfaces with antique-gold outlines, ornate corner filigree and
  cream Roman/serif display headings.
- Candlelit amber artwork: a dragon miniature and dice on the hero table,
  leather/metal objects, scrolls, books, painted miniatures and a violet cloak.
- A compact dark navigation bar, large hero, castle-and-violet-gem divider,
  six illustrated categories in a three-column grid, parchment search strip,
  mountain/castle promise section and dark multi-column footer.
- Violet is a restrained jewel/magic accent. Detailed illustration and
  generous dark areas create contrast; decoration frames the content.

The uploaded image is visually different from the two historical reference
images in the recovery archive, which show a landscape "Greater Stories"
composition. Those older files were viewed during this intake and must not
silently replace the current attachment as the design target.

### Fit to the current project

The maintained storefront already contains the dragon hero, six categories,
violet crest/orb and parchment search. Reuse its runtime artwork and working
navigation, search, account and bag behavior; inspect the final CSS cascade
before a fidelity pass. The current promise area uses a dragon-image crop,
so the supplied distant landscape treatment is a specific difference to assess.

For the game, the strongest matching skill set is:
`game-ui-frontend` for themed DOM menus/HUD,
`game-engine` for the existing Canvas 2D renderer,
`level-design` for cave/temple spaces, and
[`CongDon1207/AGENTS.md:.agent/skills/game-development/game-art`](https://github.com/CongDon1207/AGENTS.md/blob/9f1aa55395ca949e4484040899fe3333dd10fa6b/.agent/skills/game-development/game-art/SKILL.md)
for a consistent fantasy sprite/tile/atlas pipeline. The art skill is pinned
and its full content was hash-verified through omgskills. Encounter design remains
useful for the 100 floors, with its Three.js examples adapted to current code.
No skill was installed or invoked to implement product code.

### Proposed translation, still open to feedback

Retain illustrated top-down 2D, adding authored sprites/textures, cached scenery,
contact shadows, baked highlights and bounded light overlays. This preserves
the current browser stack. Full 3D is an alternative requiring a substantial
renderer/model/camera rebuild; the supplied storefront image does not by itself
choose a game camera or renderer. At that intake the owner was asked which approach to design around. They have
since accepted illustrated 2D; the attachment alone did not approve gameplay details.

| Surface | Proposed treatment |
| --- | --- |
| Route-choice screen | Equally prominent illustrated cave and sky-temple cards, aged-gold frames and cream titles |
| Cave | Layered carved rock, readable floor, amber torch pools and occasional violet relics/crystals |
| Sky temple | Pale weathered stone, gold inlay, twilight clouds, distant mountain silhouettes and amber braziers |
| Combat HUD | Compact charcoal panels, quiet gold edges, clear health/abilities/objectives; restrained ornament |
| Inventory and journal | Parchment surfaces with readable dark text inside the shared dark/gold shell |

Keep readable small text, keyboard focus, touch targets, reduced motion,
class/enemy silhouettes and attack telegraphs. Maintain distinct danger/ally/
resource signals, including shapes or labels as well as color. Do not let
foreground ornament or darkness hide walkable space and hazards.

The requested 100 cave floors, party destination choice, dungeon runs and
checkpoints remain new server-authoritative systems. This image establishes
their visual direction, not their progression/party rules or completion.

## Requested next work

The supplied reference above now establishes the aesthetic target. The requested
expansion is a cave system with 100 dungeon floors, an alternative sky temple
that the party can choose, and improved graphics. Treat 100 as dungeon depth,
not as a confirmed character-level cap. The sky temple's size, route-selection
rules and the meaning of "bump" are not yet specified.

Use the supplied image when selecting art treatments. If "bump" means
bump/normal mapping, choose a rendering approach explicitly: the current
Canvas 2D renderer has no native normal-map material system.

## Verified current implementation

- React 18/Vite 6 with a custom Canvas 2D world in
  [GameCanvas.tsx](../../standalone/src/game/GameCanvas.tsx); no Three.js,
  React Three Fiber, PixiJS or Phaser dependency is present.
- One 30×22 Mossvale map, four thornlings, three crystals, one shrine and one
  completion quest. Map and progression rules are in
  [game-rules.mjs](../../standalone/server/game-rules.mjs).
- The Node/SQLite server supports six ordinary simultaneous realm occupants,
  the separate administrator seventh avatar, authenticated SSE updates,
  persistent characters/quests/cooldowns, and a private XP/coin ledger.
- The inspected [game server](../../standalone/server/game.mjs), UI and game
  migrations do not implement explicit parties, leaders, invite acceptance,
  route voting/selection, dungeon instances, 100 floors, checkpoints or saved
  dungeon runs. The current "Your party" UI lists realm occupants.
- Preserve server-authoritative admission, combat/rewards, authorization,
  cooldowns, replay protection and private wallet data when expanding gameplay.

The proposed dungeon and sky-temple behavior therefore requires project-specific
implementation. A skill is guidance, not evidence that those features exist.

## Skills found through omgskills

Full SKILL.md contents were read through omgskills and matched the catalog hash.
These records were commit-pinned and installable when inspected. No skills were
installed, no external asset service was configured, and no renderer migration
was selected.

| Skill and immutable source | Use | Fit boundary |
| --- | --- | --- |
| [`github/awesome-copilot:game-engine`](https://github.com/github/awesome-copilot/blob/98b45a78d3ed316e78f005b60594d5c4a50588e3/skills/game-engine/SKILL.md) | Canvas 2D loops, sprites, tilemaps, animation, controls and performance | Strong match for the current renderer; broad guidance, not a finished MMO backend |
| [`openai/plugins:game-ui-frontend`](https://github.com/openai/plugins/blob/0722921d5542fc593105c27bd52630babd8b8c2a/plugins/game-studio/skills/game-ui-frontend/SKILL.md) | Reference-led material language, palette, type, motion, CSS tokens, responsive HUD and menus | Explicit canvas-world/DOM-UI support; best initial aesthetic fit |
| [`omer-metin/skills-for-antigravity:skills/level-design`](https://github.com/omer-metin/skills-for-antigravity/blob/e8dcf4e8737921a10088bd5c9eb65e81f74c051f/skills/level-design/SKILL.md) | Spatial flow, landmarks, gating, pacing and environmental storytelling | Engine-agnostic; does not provide a 100-floor generator |
| [`MengTo/Skills:agent-skills/game-development/design-game-encounters`](https://github.com/MengTo/Skills/blob/a45892d2fdadab75b31fb16abecc02f101b31c43/agent-skills/game-development/design-game-encounters/SKILL.md) | Objectives, enemy roles, waves, bosses, rewards, exits and recovery | Three.js action-game examples need adaptation to current code; no party synchronization |
| [`omer-metin/skills-for-antigravity:pixel-art-sprites`](https://github.com/omer-metin/skills-for-antigravity/blob/e8dcf4e8737921a10088bd5c9eb65e81f74c051f/skills/pixel-art-sprites/SKILL.md) | Sprite/tileset palettes, silhouettes, animation and sheet organization | Not selected for this cinematic reference; use only if the owner later requests pixel art |

If the owner selects a 3D game world, separately evaluate these verified options:

- [threejs-aaa-graphics-builder](https://github.com/majidmanzarpour/threejs-game-skills/blob/8286774b22a2566bf894dbc825825c16921866af/skills/threejs-aaa-graphics-builder/SKILL.md):
  art direction, shaders, lighting, skies, materials, props and rendering budgets.
- [build-hybrid-game-assets](https://github.com/MengTo/Skills/blob/a45892d2fdadab75b31fb16abecc02f101b31c43/agent-skills/game-development/build-hybrid-game-assets/SKILL.md):
  meshes, procedural props, 2D media, scale, collision and provenance.
- [r3f-materials](https://github.com/Bbeierle12/Skill-MCP-Claude/blob/9f228393b17de9671959227d5fdaa43f147f0cb2/skills/r3f-materials/SKILL.md):
  normal, roughness, AO and displacement maps; requires React Three Fiber.
- [optimize-threejs-games](https://github.com/MengTo/Skills/blob/a45892d2fdadab75b31fb16abecc02f101b31c43/agent-skills/game-development/optimize-threejs-games/SKILL.md):
  measured frame-time, draw-call, triangle and texture budgets, pooling and culling.

These 3D skills require an explicit renderer decision and do not directly extend
Canvas 2D. No dedicated cave/sky-temple generator or ready-made MMO party system
was found in the targeted catalog searches.

## Verification and remaining limits — earlier 17:20 EDT audit

The following test, host and production observations belong to the earlier
17:20 EDT readiness audit. The reference intake rechecked source/task-branch
state and skill metadata; it did not rerun application tests or live checks.
The managed environment was pending/offline at the later intake check.

[Main CI 40954037828](https://github.com/zyxoned/eldritchfable.com/actions/runs/40954037828/job/123729348898)
checked out the exact source baseline above and passed dependency installation,
build, server syntax, 69 backend tests (zero failures/skips), and all 30 desktop/
mobile browser tests. Logs were read during this audit; tests were not rerun
locally for these documentation-only changes.

Fresh host checks found the enrolled development checkout clean and matching
main, with no unpublished commits. Relay's existing watcher was active/enabled
and its recent result reported `remote_fresh: true`, `state: up_to_date`.
The managed cloud environment failed to start; its files remain UNKNOWN.

Public HTTPS health reported online. The public release manifest still identified
frontend `2011d09558baa37d90820aeae4aab3eab473e6b6` and backend release
`f05b81a0ff9d-20261027013515284`, rather than current main. API/web/tunnel
services were running and mail/backup/healthcheck timers waiting. This establishes
availability, not full game/commerce completeness or current inbox delivery.
Live database schema was not re-queried; the earlier schema-3 audit remains dated.

## Next executable action

The illustrated 2D approach is now accepted. Review the full written design
linked above; after approval, use Superpowers writing-plans. Resolve party route
selection, cave checkpoint/progression/reward rules, sky-temple scope and
persistent run ownership before writing implementation code. Select the smallest
engine-compatible skill set. A first playable cave floor and sky-temple encounter
can validate the design before expanding content to all 100 cave floors.
