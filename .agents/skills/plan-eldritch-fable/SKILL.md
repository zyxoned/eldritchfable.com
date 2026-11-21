---
name: plan-eldritch-fable
description: Audit the Eldritch Fable MMORPG in zyxoned/eldritchfable.com, plan its public 1.0 in playable slices, prepare designer reviews, and verify implementation handoffs with evidence.
---

# Plan Eldritch Fable

Work as the planner and acceptance reviewer for the existing game. The normal player entry is `/play` in `standalone/`. Deliver the requested planning record, implementation handoff, or evidence verdict. Leave changes to game behavior to the implementation agent. Follow project-relative paths below from the repository root.

## Establish the baseline and release contract

Start with `AGENTS.md`, the newest applicable entries in `PROJECT_STATE.md`, and the actual checkout. Record the repository, revision, branch, upstream, worktrees and unpublished changes. In a remote-only session, record the remote SHA and explicitly mark local work uninspected. Keep four independent observations: checkout, accepted upstream, staging build and production release. For a live claim use the release identity and evidence from that environment. A green test establishes only the behavior it exercised.

Trace each intended player outcome from the route in `standalone/src/main.jsx` through client, shared content, authoritative Node services, SQLite persistence, shipped art and tests. Inventory account entry, exploration, combat, character growth, equipment, social play, world content and recovery as applicable to the release contract. Follow shop or account dependencies only where they affect the game. Compare promising branches and PRs by changed paths, ancestry and behavior; inspect how they differ from the accepted implementation before allocating a slice. Treat the recovery archive as historical evidence.

Read the owner-confirmed decisions and proposal labels in `docs/superpowers/specs/2026-10-30-eldritch-expeditions-design.md`. Preserve free exploration, per-hero discovery and the approved illustrated, layered top-down direction unless a newer designer decision supersedes them. Cross-check applicable designer records, staged atlases and later briefs. For a disagreement over the opening, realm names or entity counts, show the competing sources, affected slices and smallest decision the designer needs to make. Keep private canon, unreleased previews and restricted source locators in their authorized location. Public planning uses opaque decision IDs. Continue work with independent dependencies.

Use the [planning templates](references/planning.md) to produce a finite designer-approved 1.0 contract, coverage map, decisions needing an owner and roadmap through playable beta, release candidate and public 1.0. Identify real performance, load, accessibility and recovery targets or the designer decision needed to set them. Link every required outcome to evidence or an open slice. Keep deferred items explicit. Launch completion requires proof from the released game and its operator.

## Choose the next slice

On repeat runs, compare the saved baseline, affected imports and content IDs, referenced design decisions, asset versions and deployment identities. Reuse unaffected records. Replan when the design changes, a dependency changes, or a playtest invalidates an assumption. State what moved and why. A second run over identical inputs should produce the same next handoff.

Order prerequisites first, then choose a small end-to-end slice that cheaply resolves a high-cost uncertainty or unlocks multiple required outcomes. Break ties by reusing fixtures, art and verification work, then by lower effort. Group independent slices for parallel work only when their shared interfaces and evidence boundaries are settled. Detail the next slice; leave future slices at outcome, dependency and acceptance-signal level.

For each prerequisite record the exact repo location or authoritative upstream source, version, purpose, and when to refresh it. Start with `docs/workspace/MMO_SKILL_READINESS.md`, existing scripts, lockfile and test harnesses. Consult upstream maintainers for a current release, compatibility change, or knowledge gap. Reuse verified compatible inputs. Retrieve the relevant source or skill instructions when a claim depends on them; a tool name or search snippet is insufficient. Surface unavailable prerequisites and advance unaffected work. A planning record never grants authority to install software, purchase assets, or release the game.

## Hand off, review art and count playtests

Give the implementer a bounded outcome, design authority, baseline revision, reuse candidates, dependencies, evidence methods and explicit stopping point. Freeze the handoff's criterion IDs, expected observations, methods and expected asset IDs **before** implementation. Keep this approved input under the planner or designer's control. When scope genuinely changes, record the design decision and revise the handoff before acceptance.

Create a scene-level graphics plan with the templates. Every shipping visual asset, including inherited assets, needs traceable provenance, an in-game preview and a designer's explicit approval of its exact content version. Record missing approvals in the release backlog. Review characters in motion at gameplay zoom, environments with actors and UI, supported screen sizes and readability. Reuse an approval for identical bytes when its approved use still applies; re-review changed art. Compare the returned asset inventory with the build's changed/shipping visuals before accepting a slice and reconcile the full shipping inventory at release candidate.

Run the [acceptance gate](references/acceptance.md) on implementation evidence. Read the evidence itself: distinguish normal-entry behavior from mocks, check that build identities match actual artifacts, and verify human decisions against the authorized review source. Retain externally reviewed records and versioned evidence together. Allow exactly one accepted record per stable slice ID. Documentation adds zero to the game counter. Every fifth counted gameplay, art or game-infrastructure slice needs a real designer playtest of the exact build. Keep slice five and its checkpoint pending together while blockers are repaired and retested. Advance to six after the designer clears the checkpoint. Apply the same rule at ten and each later multiple of five.

Conclude with the current milestone, accepted game-slice count, next checkpoint, highest-priority ready handoff, blocked designer decisions, and the proof still required to call the milestone complete. For a narrower request return the relevant subset.
