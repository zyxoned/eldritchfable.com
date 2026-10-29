# MMO expansion and visual skill readiness

Observed October 29, 2026, about 17:20 EDT (America/New_York).
Source baseline: `4c54082e55279d1f0efa301a5fd40e198405b8d9`.
This is a readiness audit and skill shortlist, not an approved feature design.

## Requested next work

The owner will supply the desired aesthetic in the next prompt. The requested
expansion is a cave system with 100 dungeon floors, an alternative sky temple
that the party can choose, and improved graphics. Treat 100 as dungeon depth,
not as a confirmed character-level cap. The sky temple's size, route-selection
rules and the meaning of "bump" are not yet specified.

Do not select an art style before reading the forthcoming reference. If "bump"
means bump/normal mapping, choose a rendering approach explicitly: the current
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
| [`omer-metin/skills-for-antigravity:pixel-art-sprites`](https://github.com/omer-metin/skills-for-antigravity/blob/e8dcf4e8737921a10088bd5c9eb65e81f74c051f/skills/pixel-art-sprites/SKILL.md) | Sprite/tileset palettes, silhouettes, animation and sheet organization | Use only if the forthcoming reference chooses pixel art |

If the reference calls for 3D, separately evaluate these verified options:

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

## Verification and remaining limits

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

Read the user's forthcoming aesthetic reference, then use Superpowers
brainstorming to define the visual target and gameplay rules. Resolve party route
selection, cave checkpoint/progression/reward rules, sky-temple scope and
persistent run ownership before writing implementation code. Select the smallest
engine-compatible skill set. A first playable cave floor and sky-temple encounter
can validate the design before expanding content to all 100 cave floors.
