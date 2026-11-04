# Ruined Mossvale Playable Demo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Deliver an immediately playable, spoiler-free single-player browser prototype of ruined Mossvale with two discoverable short encounters.
**Architecture:** Isolated static Canvas 2D world plus accessible DOM HUD, with browser-only saves. This prototype is a demo spike, not the MMO server implementation; it makes no account, wallet, production or private-story requests.
**Tech Stack:** Native JavaScript ES modules, HTML/CSS, Canvas 2D; existing Node 24 and Playwright for verification; separate frontend-only AppDeploy preview.
**Spec:** ../specs/2026-10-30-eldritch-expeditions-design.md. The user's request to actually demo the approved direction authorizes this bounded prototype.

## Global Constraints
- Ruined Mossvale is freely playable before accepting any hook; no opening destination picker or compulsory exposition.
- Illustrated top-down 2D, dark/antique-gold/ivory UI, amber lighting and restrained violet.
- Never include concealed final identities, conditions, probabilities or dialogue in prototype source/assets/tests.
- No real XP, coins, accounts, multiplayer claims, 100-floor-completion claims, production changes or external paid dependency.
- Existing source histories are preserved; demo code lives only under demos/ruined-mossvale.
- The plan's prototype execution is immediate under the requested demo/spike scope; full MMO implementation remains a separate plan.

## Review Focus
- Keyboard blur, modal and hidden-tab transitions must clear held inputs rather than leave movement stuck.
- Small touch screens must preserve movement, interactions, readable HUD and the center of the scene.
- Corrupt or unavailable browser storage must recover safely without preventing play.
- Leaving/reentering a scene must preserve local discoveries and completed encounters without duplicate completion.
- A player can decline optional dialogue, explore either path first and return without a forced route.

### Task 1: World rules and local persistence
**Files:** Create demos/ruined-mossvale/src/world.js and tests/world.test.mjs.
**Interfaces:** Export MAPS, CLASSES, createGame(classId), canWalk(mapId,x,y), findPath(mapId,start,goal), reveal(state), enterLocation(state,mapId), moveHero(state,dx,dy,dt), saveGame(storage,state), loadGame(storage), advanceCombat(state,dt), attack(state,power), useAbility(state).
- [x] Define three authored maps, collision, optional interaction objects, discovery facts and short non-final encounters.
- [x] Verify free movement, collision/pathfinding, scene/recovery state, combat completion and storage fallback with native Node assertions.
- [x] Keep all demo progression local and separate from the production economy.

### Task 2: Renderer and playable UI
**Files:** Create src/render.js, src/game.js, src/styles.css and index.html under the demo.
**Interfaces:** renderWorld(canvas,state,{time,reducedMotion}) returns {cameraX,cameraY,scale}; game.js owns DOM/input/saving and consumes Task 1 exports.
- [x] Render layered cached terrain, ruined buildings, trees, fog, water, hero/enemies, particles, amber lights, clear danger telegraphs and distinct cave/temple material.
- [x] Implement WASD/arrows, click-to-walk, touch direction buttons, E interaction, Space attack and Q class ability.
- [x] Implement optional conversations/journal/help, class selector, pause, reduced effects, reset confirmation and safe local recovery.
- [x] Validate desktop/mobile real browser journeys, canvas clicks, modal focus and storage-reload behavior.

### Task 3: Review, shareable preview and handoff
**Files:** Create tests/tests.json and README.md; update repository project state and handoff.
- [x] Include five independent AppDeploy workflow tests covering free movement/discovery, both short routes, mobile combat/recovery, save/reset guardrails and keyboard/modal behavior.
- [x] Review source for privacy, unsafe DOM handling, state consistency and truthful prototype copy.
- [x] Deploy a new isolated frontend-only preview, leaving the older Mossvale app and production intact.
- [x] Wait for terminal ready status, inspect QA/runtime errors and fix concrete failures.
- [x] Publish reviewed source through a task PR, verify exact remote SHA and clean checkout, release the owned Relay lease.
