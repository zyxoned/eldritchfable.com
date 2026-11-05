# Basic world and character expansion

## Candidate scope

Prepared from main `5e290ff96fe489b7af64ad61ad88ae08a7338192`, freshly checked on November 5, 2026. The merged storefront artwork and first Adventure polish remain intact. This is an isolated implementation candidate, not a published release.

The design draws only on broad party-RPG ideas: connected places, clear class roles, a small development path and readable tactical choices. All names, prose, code and Canvas scenery are original; no third-party game assets, characters, music or private campaign material are included.

- Three connected regions retain the original Glade and add Amber Reach and Mist Harbor. Crossings must be reached physically; travel moves only the requesting hero, never the whole party.
- Party membership persists across regions. Encounters, targeting, healing, effects and contributor eligibility are region-local. The roster still shows where companions are.
- Locations and regional enemy state persist on the server. Glade terrain, existing coordinates and original quest progress remain intact.
- Each ordinary class has a compact three-step path unlocked by existing lifetime-XP levels. No new currency or skill-point economy is introduced.
- Balanced preserves existing combat. Guarded unlocks at level 2 and trades two outgoing damage for two damage reduction; Focused unlocks at level 3 and trades two additional incoming damage for two outgoing damage. Armour blocks and minimum-hit rules remain explicit.
- Optional tactical guidance suggests recovery or a ready skill. It does not play, target, move or spend resources automatically. Existing class skills, costs, cooldowns and reward amounts remain in use.
- Optional environmental notes include the new regions. Notebook entries still stay in the browser and grant no rewards. Unseen private story content is not used.

## Deliberate limits

This is a small foundation, not a full commercial RPG: no automated party companions, complex skill grid, inventory economy, equipment shopping, paid unlocks, cinematic story, new quest reward economy or real-time path simulation. Every multiplayer hero remains controlled by their own player. Character path lessons describe unlocked stance choices rather than granting stacking passive bonuses.

## Schema 7 and preservation

The candidate requires an explicit schema-6-to-7 migration before API startup. Never run it against a live database merely to preview this work.

The additive migration introduces regular/visitor region identifiers and regular-hero stance/tactic preferences with defaults that preserve old behavior. New regional encounter rows use a separate table; existing party enemy JSON, original enemy IDs/HP/spawn IDs, damage contributions, account/session/mail data, XP, wallet balances and ledger history must remain unchanged during migration. Migration is transactional and repeat-safe.

The original Glade quest remains tied to Glade enemies and its original one-time landmarks. New-region enemies use the existing contribution/reward rate; visiting regions and reading notes do not mint currency or complete the original quest. Support visitors still cannot earn customer rewards or configure ordinary-character development while visiting.

## Release gate

The owner subsequently authorized verification and rollout. Publication and merge may proceed after exact-source review and CI; production activation remains separately coordinated with the pending visual release and its privileged operational steps. Before an eventual rollout:

1. Review and test the exact final source and a consistent private production-copy schema-6 migration rehearsal using existing preservation checks.
2. Preserve existing accounts, sessions, pending mail, wallets and all subsequent writes. Do not overwrite the live database with a pre-migration snapshot as an ordinary rollback.
3. Prepare and rehearse a schema-7-compatible fallback application. The old schema-6 binary deliberately rejects a schema-7 database, so it is not a safe direct fallback. The existing compatible-fallback adapter takes the candidate schema/migration modules, preserves new state, and pauses realm actions while retaining authenticated stash/exchange access; rehearse this path against the exact candidate rather than routing old game logic over new regions.
4. Verify startup schema, API/account behavior, multiplayer isolation and the exact frontend/backend release identifiers after separately authorized deployment.

## Validation status

Local full backend/unit tests: 136 passed, zero failures/skips. Production build and whitespace check passed. Independent backend review found no remaining blockers after correcting migration storage and region error handling. Populated synthetic schema-6 rehearsal and backed-up migration passed with exact legacy fields/JSON preserved; schema-7 backup/fallback regressions passed. Owner-approved private staging passed 53 browser tests with one intentional desktop skip; the new three-region journey also passed twice on both desktop and mobile (four runs). Supplemental visual checks passed at 320, 390, 844 and 1280 pixels with no overflow or console errors. Screenshots show all three regional scenes and expanded character paths. Two old party-caption assertions were updated to the revised journey wording; no application change was needed during browser QA. Chromium launch in this execution environment is blocked by its Unix-socket restrictions, including an approved escalation attempt; browser tests require the established separately authorized private staging workflow.

## Crossing cadence follow-up

GitHub's faster desktop browser run exposed an intermittent crossing failure after the final walking step. Explicit travel now retries once only after a confirmed 429/MOVE_COOLDOWN rejection, retaining the existing busy lock and cancelling on interrupted intent, identity, party, region, epoch, dialog or visibility changes. Unknown network outcomes and other actions never retry. A forced-rejection browser regression covers success and dialog cancellation; five helper tests and the complete 141-test Node suite pass. Final updated browser and CI results remain pending; do not infer rollout readiness from the earlier candidate's staging results.
