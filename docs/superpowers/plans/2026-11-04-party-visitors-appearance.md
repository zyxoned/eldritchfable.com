# Eight-player parties, support visitors and appearance implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Support eight regular heroes and two administrator visitors per isolated party, preserve normal rewards during visits, and give each class a customizable, articulated appearance.

**Architecture:** Retain React/Vite, the Canvas 2D renderer, the single authoritative Node worker and SQLite. Add persistent party worlds and party bindings through schema 5; reauthorize current account sessions and project only the viewer's current party. Share a pure cosmetic catalog and character renderer across account UI and play.

**Tech Stack:** React 18, Vite 6, Node >=24, SQLite, native Node tests and Playwright.

**Spec:** [Expedition design](../specs/2026-10-30-eldritch-expeditions-design.md), with this feature's bounded current behavior in [EXPANSION.md](../../../standalone/EXPANSION.md).

## Global constraints

- Eight regular seats plus two separate visitor seats per persistent party; no global eight-seat limit.
- Uniform random visitor selection includes active solo and full regular parties.
- Visitor basic damage uses the lower median of active regular members' effective basic damage; strike and basic attack share a 700 ms budget.
- Visitors are invulnerable and restore 15 HP within four tiles with a 6,000 ms boon cooldown.
- Normal eligible positive-damage contributors keep rewards and progression during visits; visitors receive no customer rewards and consume no ordinary capacity.
- Preserve the 75-second presence lease, 20-second heartbeat and exact 1,250 XP → 1,000 copper exchange.
- Preserve authentication, account/session/mail data, normal hero class/progress, wallets, ledger history and global request replay protection.
- Class, cosmetic fields and combat values remain server authoritative; concealed authoring content stays outside public source.
- Verification uses disposable databases and disabled email. Source publication does not authorize a production rollout.

## Review focus

- Confirmed leave or old-party receipts replay safely after context changes.
- A stale tab cannot mutate a newly joined party.
- Concurrent visitor entry cannot create a third support seat.
- Revocation or demotion removes powers and live projections.
- Cosmetic save/cancel and cross-tab party changes remain coherent on narrow screens.

---

### Task 1: Persistent party worlds and capacity

**Files:** `server/database.mjs`, `server/migrations/005-party-visitors.sql`, `server/game-rules.mjs`, `server/game.mjs`; tests in `tests/party-visitors.test.mjs` (all paths under `standalone/`).

**Interfaces:** Existing `createGameService(db, options)` gains injectable randomness for tests. Realm replies expose `partyId`, `partyMode`, `maxPlayers:8`, `maxVisitors:2`, `players` and `visitors`. Join accepts open/solo mode or an explicitly accepted party ID.

- [x] Pin eight-seat overflow, private solo matching, per-party persistence, unique enemy spawn identities, isolated chat/effects/SSE and stale action/heartbeat behavior in focused tests.
- [x] Add additive schema-5 party tables/bindings while retaining original columns and the legacy world record.
- [x] Scope snapshots, mutations, enemy state and contributor queries to the current party.
- [x] Check authenticated receipts before new-state party validation; return only the caller's current authorized projection.
- [x] Verify original-column preservation, foreign keys, idempotent migration, leave replay and concurrent admission.

### Task 2: Bounded support visitors

**Files:** `server/game.mjs`, `shared/class-catalog.mjs`; existing game tests and `tests/party-visitors.test.mjs`.

**Interfaces:** `POST /api/game/admin/join` randomly selects an eligible party; `/admin/leave` ends the visit. Existing action envelopes carry the current party ID. The separate administrator avatar retains its authenticated entry-session lease.

- [x] Pin two separate support slots, solo/full-party visitation, normal hero preservation, role/session removal, no-customer rejection and concurrent third-visitor rejection.
- [x] Replace execution with median-scaled offense sharing an ordinary attack cooldown.
- [x] Add the bounded nearby healing boon and keep visitors invulnerable.
- [x] Preserve ordinary contributor rewards on visitor finishers, with no visitor or idle-member credit.
- [x] Independently review isolation, reauthorization, replay order, healing scope and migration safety; fix the replay-order and double-attack findings.

### Task 3: Appearance, class identity and client integration

**Files:** `shared/appearance-catalog.mjs`, `shared/hero-renderer.mjs`, `src/game/AppearanceEditor.tsx`, `GameCanvas.tsx`, `Mossvale.tsx`, `shared/game.ts`, `expansion.css`, account/welcome copy and browser coverage.

**Interfaces:** `POST /api/game/appearance` accepts `{requestId,partyId,appearance}` with exactly six catalog fields: skinTone, hairColor, hairStyle, outfit, accent and build. Public heroes carry sanitized appearance. `drawHero(ctx,hero,opts)` and `renderCharacterPreview(canvas,hero,opts)` are pure Canvas helpers.

- [x] Validate and persist exact cosmetic IDs independently of class, stats, progress and wallet; reject visitor-mode edits.
- [x] Add a draft preview with turn/pose controls, explicit save/cancel, immutable normal class and reduced-motion support.
- [x] Draw distinct class rigs with distance-based gait, turns, planted stance, body motion and attack recovery.
- [x] Update capacity, solo/matching, admin visitor controls and account/welcome wording.
- [x] Add browser coverage for saved cosmetics, canceled drafts, random admin visits and cross-tab context changes.
- [x] Final production build and all 38 desktop/mobile browser checks passed after the UI fixes.

### Task 4: Compatibility evidence and independent publication

**Files:** `tests/production-rollout.test.mjs`, `AGENTS.md`, `ADVENTURE.md`, `EXPANSION.md`, `DEPLOYMENT.md`, this plan, the public spec, root state and shared handoff.

- [x] Update legacy regression fixtures for party-bound requests and schema 5 without weakening account/economy checks.
- [x] Rehearse schema-3-to-5 preservation and compatible fallback using private disposable copies only.
- [x] Run locked installation, server/shared syntax and the full backend suite: 86 passed, no failures/skips.
- [x] Record final browser results and the reviewed 28-file inventory.
- [x] Publish a feature tree from fresh main `f50f072e6dd91f94a69882f8cad23b5dec5358d0`, excluding demo source/history; verify its remote identity and release only owned leases.

The separately deployed solo demo remains an experiment in [PR #10](https://github.com/zyxoned/eldritchfable.com/pull/10), source `d79d4c07739e190edac449fa939b32925f6a3508`. Neither prototype readiness nor this feature implements the full expedition campaign.

Production release: PR #11 merged and source 9d17c7c2929e76d88287f66db4026e14f8014bf3 activated as 9d17c7c2929e-20261104230355615. Live verification completed at 23:14 UTC on November 4. See PROJECT_STATE.md for evidence.
