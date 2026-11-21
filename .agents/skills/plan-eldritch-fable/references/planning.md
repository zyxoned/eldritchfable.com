# Planning records for Eldritch Fable

Use these small records in the project's existing planning location. Keep their IDs stable across handoffs. Publish only player-safe material to a public repository. Authorized designers keep restricted sources, previews and decisions in their designated private location. A public handoff may cite an opaque decision ID and its dependency status.

## Coverage and design decisions

On the first audit, start at the route registration for `/play` in `standalone/src/main.jsx`. Follow the actual client, shared catalogs, authoritative server, persistence, assets, browser tests and deployment identities for each capability. Index by player outcome so a single visit can cover code, art and tests together. Include prerequisites outside the game when they affect a player's journey, such as verified account entry or saved characters. Preserve checkout-only work as a separate observation.

Copy these headings for each capability or use them as columns:

| Capability and player entry | Design authority and status | Implementation paths at revision | Observed behavior and environment | Proof or gap | Dependencies and next slice |
| --- | --- | --- | --- | --- | --- |
| <outcome through /play> | <decision ID, confirmed or proposed> | <repo, SHA and paths> | <source inspection, test, staging or production, with date> | <artifact or precisely unverified claim> | <IDs> |

For a conflict, record **decision ID / contested choices / source and status of each / designer who can resolve it / affected slices / work free to proceed / decision and date**. Distinguish an owner-approved rule, a proposal, a candidate branch, observed staged behavior and identified production behavior. Evidence of one can inform another. A newer timestamp alone cannot settle a design choice. Reconcile conflicts about the opening location, realm names and world counts across the confirmed design, staged atlases and later briefs. Keep private settings and unreleased names in the original authorized location. Verify the meaning of each counted entity before comparing totals.

Maintain a short source index for each decision: **claim / primary source and locator / version or revision / observation date / applicable runtime / what would invalidate this check**. For a tool or skill, add its concrete purpose, installed or compatible version and upstream reference. Start with the repository's MMO skill shortlist. Consult first-party documentation for the applicable version when a decision depends on it. Consult release notes when changed upstream behavior matters. Stop research when each required claim has an appropriate source and each open question has an owner or dependency.

On a repeat audit, compare the prior and current refs, local changes, changed design decisions, asset hashes and relevant release identities. Revisit affected records and the features that consume them. Reuse a prior observation at its recorded revision when its inputs hold. A changed runtime build or unresolved branch comparison warrants a targeted check. A second unchanged audit should yield the same outstanding decisions and next slice, with new observations recorded only where they add evidence.

## Release contract and roadmap

Record **contract version / designer and decision reference / intended player and device targets / target group size and concurrent load / approved world, systems and content / deferred work / save and compatibility guarantees / accessibility and performance thresholds / release and recovery owners**. Use observable units, target hardware, normal entry points and an evidence source for each threshold. Carry unknown values into the decision queue. Have the designer resolve any that govern the milestone under review.

| Milestone | What must be demonstrated | Proof to retain |
| --- | --- | --- |
| Playable beta | A representative group enters through the approved account flow, plays the approved loop through `/play`, disconnects and resumes on the named target devices. | Identified beta build, player journeys, observed failures and disposition. |
| Release candidate | Every required contract outcome meets its agreed threshold. All shipping visual assets have approvals for their exact versions. Required playtest checkpoints are closed. | Contract-to-evidence map, compatibility/load/accessibility results, art inventory, save-upgrade and recovery rehearsal for the release candidate. |
| Public 1.0 | The authorized release serves the approved build and its required dependencies. The named operator verifies the initial player journey, monitoring and recovery readiness. | Release manifest and backend identity, live observations, outstanding issue decisions and operational handoff. |

For each milestone list **slice ID / player or enabling outcome / prerequisites / what uncertainty it resolves / reuse opportunity / rough relative effort / acceptance signal**. Order dependencies first. Among ready choices prefer the slice that cheaply resolves a high-cost unknown or unlocks several accepted outcomes. Group changes tested with the same fixtures when each still has a clear acceptance signal. Expand only the next handoff in detail. Replan when evidence invalidates a dependency, the designer changes a decision, or a playtest exposes a blocker.

## Implementation handoff

Copy the following fields into the implementation brief:

- **Identity and purpose** — stable slice ID, kind, milestone, design decision, player outcome and a sentence specifying where work stops.
- **Starting conditions** — repository and full starting SHA, actual player entry, fixture/account role, prerequisites, candidate branches already compared and known blockers.
- **Inputs to reuse** — exact catalogs, server/client paths, migrations, art versions, interaction conventions and test fixtures relevant to this change. Name any essential external tool, skill or upstream reference and the decision it supports.
- **Acceptance table** — one stable criterion ID per row with starting state, player action, observable result, method, and required artifact. Choose a runtime check for behavior and visual review for art. Include the concrete failure or retry case relevant to this slice.
- **Evidence returned** — implemented revision and build identity, records for each criterion, changed shipping asset versions and approvals, remaining gaps, and anything learned that changes a later slice.

**Example investigation before scheduling equipment work.** Inspect the Ranger's Briarwake Longbow in `standalone/shared/class-catalog.mjs`. Follow the current server equip and combat paths, saved character state, player controls and existing tests. The catalog already describes the starter effect as included in base combat values. Establish the current behavior before defining work that could double-apply it. If the designer requires a separate owned item and a gap is verified, bound one slice to a single eligible item, its effect and persistence. Supply a disposable Ranger with the item. Record combat before and after equipping, repeat the request, reconnect and verify the item, slot and single authored effect. Use a second account to exercise ownership isolation. Attach the observed behavior and target revision. This investigation leaves trading, economy changes and additional items to their own design decisions.

## Graphics inventory and sign-off

Create one plan per playable scene. Record its design reference, frame at normal camera zoom, gameplay silhouettes and interaction cues, foreground occlusion, animation states, light and color, supported viewports, frame-time budget and reusable asset set. For the confirmed illustrated 2D direction, review layering, foot contact and cast readability in motion. Include reduced-motion behavior and HUD legibility when affected.

Maintain one row per **shipping visual asset and version**, including existing assets, changed variants and generated art. Group rows for review convenience. Each row needs its own decision. Track **asset ID / shipped path and exact content hash / scenes and states / provenance and rights / in-game preview of this version / designer identity / decision with evidence / replacement or rework**. Review characters and effects in motion, and environments with actual actors and UI. A reused unchanged asset can reference its existing decision and preview. A changed hash needs fresh approval. Unreviewed inherited art stays visible in the release backlog.

## Every fifth accepted game slice

Count distinct accepted gameplay, art and game-infrastructure slice IDs in acceptance order. A documentation update, retry, follow-up commit or handoff revision adds zero. Assemble the review packet while verifying slices 5, 10, 15 and each subsequent multiple of five. Save the completed checkpoint alongside its corresponding fifth slice when both pass. Leave the next numbered slice pending if a blocking finding remains.

The packet contains **checkpoint number / fifth slice ID and revision / exact playable build / scoped automated results / normal entry and setup / player-facing scenario / observation prompts / designer identity / observed behavior / severity, owner and disposition per finding / designer review evidence**. Include a multiplayer, save or device condition when the reviewed changes touch it. For visual changes, supply per-asset approvals and a view of the full scene at play zoom.

Give the designer a goal that preserves the experience, such as finding a route from what the character can see or hear. Put the expected route and acceptance thresholds in the observer's notes. Record what the designer actually saw, any point of confusion and what triggered it. Correct blocking findings within the checkpoint, identify the revised build, rerun affected checks and obtain the designer's review on that build. Link nonblocking findings to a later slice or a documented designer disposition.
