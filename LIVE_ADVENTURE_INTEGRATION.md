# Adventure integration review

## Source and scope

This local source snapshot uses current public main 5e89afd393a7fd56cc6df92ec1f2a926b570b2f7, verified November 5, 2026. Local baseline ee95ac1 is a text-source snapshot, not upstream ancestry. Binary storefront assets were not copied and must come from the matching full checkout for complete visual testing. No production state is present.

The first integration candidate improves the real standalone/ Adventure while preserving its architecture. It does not replace /play with the separate static demo.

## Implemented

- Eight named class attack presentations with server-selected styles, validated skill identity and origin. Legacy effects and administrator visitors keep safe generic fallback. Existing skill mechanics and damage remain unchanged.
- Thumb-friendly held direction buttons and an optional joystick use the existing serialized server movement action, with a shared 230 ms request cadence. No local position authority or stale request queue is introduced. Release, cancel, blur, hidden state, dialogs, actor/party changes and recovery clear movement intent.
- Existing lifetime-XP levels remain 100 XP per level, with the existing +2 damage per level. Level guidance explains that exchanging spendable XP does not lower the character's level.
- Five optional nearby lantern landmarks and a per-account browser-local notebook introduce public environmental sketches. These notes grant no XP, coins, items or account progression. Notes are explicitly local to the browser and are not server-authoritative discoveries.

## Preserved boundaries

Schema 6, saved coordinates, terrain collision, existing enemy identities, party isolation and eight-plus-two capacity, accounts/security/admin tools, current skills/cooldowns, public/private projections, contributor rewards, replay protections and all currency/exchange rules are unchanged. The server derives cosmetic metadata rather than trusting client-supplied visual or skill metadata.

Private campaign canon is unavailable to this review and has not been fetched, inferred or published. New texts are optional environmental drafts, not final secret story content.

## Full ruined-Mossvale world is a subsequent integration

The current live map is a 30×22 server-authoritative glade. The prototype is a distinct continuous-position single-player world with three maps, browser saves and different combat timing. Copying the prototype into /play would lose account-backed multiplayer and progression. A complete port needs:

1. A shared, versioned map catalog and server-side validation of positions, physical entrances and party/location projections. Preserve the old map/coordinates until explicit migration is designed.
2. A durable player location/discovery model; an additive discovery table and map/location fields require schema migration tests, downgrade/fallback strategy and production-copy rehearsal. Do not reuse crystal reward flags or browser notes as authoritative discoveries.
3. Deliberate initialization/versioning of persisted party enemy JSON, with current enemies/progress preserved. New spawn definitions alone do not update existing parties.
4. Convert desired continuous movement/abilities into the existing server rules, or explicitly design authoritative real-time simulation. Keep contributor rewards, visitor limits and account economy unchanged unless separately approved.
5. Port public exploration art and encounter material; consult authorized private authoring before final campaign content. Do not reveal unseen routes or force unrelated players to travel.
6. Full account/game/admin/browser tests, old-save and concurrent-party regressions, migration rehearsal and source/release verification before separately authorized rollout.

The owner subsequently authorized publishing this candidate and merging when applicable. Deployment and live migration remain outside this approval. Current publication and CI status are tracked by the pull request.

## Validation

- Locked dependency install from existing local cache passed; no dependency/lock changes.
- Full backend/unit suite: 117/117 passed.
- Production build passed; expected unresolved binary-art warnings reflect the text-only snapshot.
- Module syntax and Git diff whitespace checks passed.
- Added attack metadata/rules/renderer regressions, landmark allowlist/proximity tests and mobile intent tests.
- New browser specs cover mobile request serialization/cancellation and browser notes without reward changes. Real-browser validation passed in owner-approved private staging using full source/assets and a synthetic database.

## Final private-staging verification — November 5, 2026

- Backend/unit suite: 117/117 passed, zero failures or skips.
- Build and Git whitespace checks passed against the full main checkout plus this overlay.
- Full Chromium browser suite: 51 passed, 1 intentional desktop skip for the touch-only movement scenario; zero failures. Completed at 04:20:32 UTC.
- The touch movement scenario also passed 3 consecutive runs, covering serialization while a response is pending, release/blur cancellation, both control modes, dialog blocking and narrow/landscape layouts.
- Notes tests passed on desktop/mobile, covering proximity inspection, local reload persistence, duplicate/forged IDs and unchanged private XP/copper balances.
- Initial test-only races were corrected: blur is now issued while a deliberately held request is pending, and repeated synthetic accounts receive distinct character names. Already-sent movement is allowed to finish; no subsequent movement is queued after blur.
- Visual review led to padding and mobile-order corrections for the notes card. No progression, economy, schema or gameplay rule was changed by those fixes.
- All testing remained in a separate private staging checkout with synthetic accounts and mail disabled. No live database, production service, public preview or repository publication was changed.
