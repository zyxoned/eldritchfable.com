# Stripe Payments and Tax Implementation Plan

> **For agentic workers:** Implement the following tasks sequentially, testing
> their behavior against the spec before calling the foundation complete.

**Goal:** Build a disabled-by-default, administrator-only sandbox checkout
integration and hosted-payment review/return pages for verified physical merchandise.

**Architecture:** Hosted Stripe Checkout uses the existing Node API and account
sessions. Additive SQLite tables hold reviewed stock mappings, reserved orders,
deduplicated webhook receipts and a durable fulfillment queue.

**Tech Stack:** Node >=24, React 18/Vite 6, SQLite, Stripe Node SDK 23.1.0.

**Spec:** [Integration design](../specs/2026-11-06-stripe-design.md).

## Global constraints

- No live charges, production migration, deployment or sample-product sales.
- Keep server-side pricing and authorization authoritative; store integer cents.
- Preserve existing game, account and mail behavior; keep local email disabled.
- Do not store keys or personal customer data in source, logs or handoffs.
- Tax settings and active registrations must be confirmed before automatic tax.

## Review focus

1. Concurrent checkouts must not oversell the last unit.
2. Retrying after an external timeout must reuse the order and reservation.
3. Delayed/unpaid, duplicate and reordered webhook deliveries must not ship twice.
4. Wrong-account/mode/amount events and forged signatures must not mark an order paid.
5. Missing tax configuration, unknown/sample SKUs and revoked admin access must
   fail closed without allocating an order or exposing private order data.

## Task 1: Persistent checkout and inventory boundary

Files: `standalone/server/migrations/009-commerce.sql`, `database.mjs`,
`commerce.mjs`, `standalone/tests/commerce.test.mjs`.

- [x] Write failing behavior tests for price authority, catalog mapping, atomic
  stock reservation, retry payload conflicts and preserved existing data.
- [x] Add schema 9 and implement checkout creation using a supplied Stripe client.
- [x] Validate Price/Product/shipping metadata, Tax settings/registrations and
  idempotent local order snapshots. Keep uncertain reservations for reconciliation.
- [x] Verify focused tests, including two requests for the last item.

## Task 2: Signed webhook and protected HTTP boundary

Files: `standalone/server/commerce.mjs`, `commerce-routes.mjs`, `index.mjs`,
`standalone/tests/commerce.test.mjs`.

- [x] Write failing tests for raw-body signature verification, required account
  role, origin checks, private reads, paid/delayed/failed/expired order transitions,
  duplicate delivery, amount mismatches and failure/expiry reordering.
- [x] Queue a unique fulfillment record transactionally with paid state; release
  reserved stock exactly once only after verified failure/expiry.
- [x] Add bounded request bodies, same-origin authenticated mutations and rate
  limits. The webhook uses signature verification instead of browser-origin checks.
- [x] Validate existing behavior with the full backend suite and production build.

## Task 3: Configuration, operational documentation and handoff

Files: `standalone/server/stripe-client.mjs`, `.env.example`, `package.json`,
`package-lock.json`, `standalone/STRIPE.md`, `PROJECT_STATE.md`,
`docs/workspace/HANDOFF.md`.

- [x] Install the verified current Stripe SDK and preserve the package lock.
- [x] Require a sandbox key, expected account, webhook secret and shipping rate;
  reject live keys. Never print key values. Leave checkout disabled by default.
- [x] Document secure key provisioning, reviewed catalog/stock setup, webhook
  event subscriptions, reconciliation and remaining live-launch requirements.
- [x] Review intended diff/secrets and run backend/build checks.
- [ ] Publish the isolated draft review branch, verify its SHA and release the
  session lease; publication is blocked by automatic approval review pending
  explicit owner confirmation of the destination. See the shared handoff.

## Task 4: Checkout and payment-status pages

Files: `standalone/src/pages/Checkout.jsx`, `src/styles/checkout.css`,
`src/api/commerce.js`, `src/lib/checkout-core.js`, `src/main.jsx`,
`src/pages/Account.jsx`, `src/pages/Storefront.jsx`,
`standalone/tests/checkout-ui.test.mjs`, `tests/browser/checkout.spec.mjs`.

- [x] Add the bag's Review checkout link, responsive review summary and server-
  authorized sandbox redirect to Stripe's prebuilt full page.
- [x] Preserve the retry key before POST, reuse it across reloads, validate the
  Stripe redirect origin and retain the bag on failure/cancellation/return.
- [x] Allow an explicit new checkout only after server-confirmed paid/expired/
  failed state, keeping pending/uncertain/review attempts intact.
- [x] Add owner-scoped pending/paid/failed/expired/review status and a strict local
  sign-in return path. Ignore success-like URL parameters as payment evidence.
- [x] Match actual server catalog `price_cents`, preserving its browser mapping.
- [x] Verify the complete backend/helper suite (245 passed), build and syntax.
- [ ] Execute browser coverage: 74 tests discovered; browser launch is blocked
  locally by a workspace socket restriction and CI requires publication first.
