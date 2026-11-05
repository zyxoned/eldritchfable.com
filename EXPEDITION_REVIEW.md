# Expedition and gathering candidate

Baseline: main `3fe124541bf90a5fb83308b72cc57c8a6348a407`.
Status: isolated implementation. The latest aggregate backend/unit run passed 216/216 and production build passed. Independent source review found no remaining blocking issue. Private-staging Chromium validation passed 59 tests with one intentional skip, plus six repeated regional travel checks. All final source hashes matched staging. Production-copy and private-content operational validation remain pending. Not published or deployed.

## Implemented

- Three nonredeemable gathering skills, nine physical resource spots, level gates, saved material inventory, party-local regrowth and server cooldowns. Manual supplies restore bounded health. Mining materials are retained for future crafting, which is not implemented.
- Generic server-owned expedition runs, independently advancing member locations, floor-local combat/support, persistent encounter state, explicit recovery and current-location request validation.
- Generic external-content integration with durable eligibility, concurrent claims, saved acquisitions/effects, class-bound equipment, individual disclosure and acknowledged scene transitions. Content is loaded only from an operator-owned private file outside the source checkout. No runtime authoring data is committed or bundled.
- Current-class combat skills retain lifetime progression and stance effects. Combat-only modifiers include health, damage, healing and wards. No second wallet or reward multiplier.
- Responsive gathering and journey panels, original illustrated chamber rendering, finite server-confirmed movement interpolation, bounded effects, cached terrain, hidden-tab pause and reduced-motion support.

## Persistence and boundaries

Schema 8 preserves every legacy character field and widens health/ward storage, adding separate tables for memberships, gathering, equipment, effects and authored/route state. Migration is explicit and transactional, not performed on API startup. Existing populated schema-7 data and foreign keys are tested.

Accepted party membership is distinguished from a temporary connection lease. Explicit leave frees membership; disconnected members retain their accepted place. Support visitor entry frees an ordinary seat and retains the separate visitor allowance. New scene participation cannot fabricate offline actions or witnessed content.

New action scopes include route identity, current floor and a durable visit generation. Confirmed request receipts replay without repeating side effects, using a fresh authorized projection. Old unconfirmed packets from a departed visit are rejected.

Existing account/session/origin checks, wallets, lifetime XP, exchange rates and ordinary rewards remain unchanged. Gathering and route work introduce no redeemable currency, shop credit, monetary promise or fulfillment action. Commercial reward proposals are a separate unimplemented project.

## Deliberate limits

- Expedition scenes reuse a small set of authored archetypes. This is a functioning route system, not a claim of a large bespoke campaign's final content quality.
- Single-opponent chambers and preliminary encounter/item balance need hands-on tuning. There is no new mana system, crafting, trading or item marketplace.
- Private authoring decisions and their gameplay revelations are intentionally absent from public docs, source, test fixtures and frontend bundles. Review actual content only through authorized private access.
- Reconnection retains authoritative state. Recovery preserves durable progression; no unrelated world, wallet, equipment or history reset is introduced.
- This candidate does not authorize production migration, restart, upload, publication or deployment by itself.

## Validation

Run from `standalone/`: `npm test`, `npm run build`, then `npm run test:browser`. Browser configuration writes a neutral synthetic fixture to a private temporary file, and uses an isolated database. It never loads production authoring.

Focused tests cover source acquisition/replays, concurrent SQLite claims, offline-inclusive cohorts, explicit knowledge/grants, gear ownership, health aggregation, per-floor locality, independently chosen travel, visit-generation rejection, supplies, unchanged economy and actual HTTP envelopes. Desktop/mobile journeys, gathering and supplies, interruption, reduced motion, layout and ordinary account/party regression coverage passed. Staging found and corrected an extra-step crossing click race; destination arrival now matches the interaction range, with repeated travel coverage passing.

Set `ELDRITCH_AUTHORED_CONTENT` only for an authorized external runtime bundle. The loader rejects files within the checkout, oversized/nonregular files and group/world-readable permissions. Leaving it unset disables authored content while ordinary play and gathering remain available. No actual file location belongs in public documentation.

## Operational activation gates

Before deployment, rehearse schema 8 on an authorized production database copy, compare preserved rows and verify rollback. Runtime content is a separate private deliverable, never part of the Git branch or release archive. Validate that bundle against the exact candidate in private staging before activation, and review its preliminary balance separately.

An operator must provision the private file outside the checkout, releases and web root with mode 0600 and API-service ownership. Configure its absolute path through a separate API-only systemd environment file/drop-in. Do not add it to the generated accounts-runtime.env: the rollout helper recreates that file. Confirm file readability and loading as the API service user without printing its contents, then verify earned disclosure and persistence using isolated accounts. Do not expose the content environment to frontend services. Existing production access restrictions remain in force.
