# Eldritch Fable: Stripe Payments and Tax

This candidate is a **sandbox backend foundation**, disabled by default and
restricted to existing verified administrators. It cannot accept a live API key.
The public storefront retains its preview bag; its Review checkout link opens
`/checkout`. That page stays closed until sandbox checkout is configured and the
current account is an administrator. `/checkout/return` displays confirmed server
order state; no public customer payments are enabled.
No real API key, Stripe Product, Price, shipping rate, tax setting or registration
was created or changed during preparation.

## Plan and current account

The connected Stripe implementation planner selected hosted, one-time web
Checkout. See the [design](../docs/superpowers/specs/2026-11-06-stripe-design.md)
and [implementation plan](../docs/superpowers/plans/2026-11-06-stripe-payments-tax.md).

| Requirement | Selected integration |
| --- | --- |
| Physical trinkets and leather dice bags | One-time USD Checkout Sessions |
| Payments UI | Redirect to Stripe-hosted Checkout; no raw card data on our server |
| Methods | Dashboard-managed dynamic payment methods; Link when eligible |
| Catalog and amounts | Published server catalog plus explicit stock/Stripe Price mapping |
| Shipping | One reviewed USD fixed shipping rate; US addresses only |
| Tax | Stripe Tax, confirmed product codes, exclusive Price/shipping tax behavior |
| Orders | Atomic SQLite reservations, immutable request snapshots and idempotency |
| Paid fulfillment | Signature-verified webhook into a unique durable queue |
| Eight-player MMORPG | Separate; no paid game access, subscriptions, payouts or currency purchases |

Verified November 6, 2026 through the Stripe app: the only connected account is
**Eldritch Fable LLC sandbox** (`acct_1UYYVs3C66EEHuy8`). Tax settings are `pending`,
missing `head_office`; default tax code and tax behavior are unset. There are
**no tax registrations** recorded. The app connection is not an application API
key and does not install credentials in this server.

Threshold monitoring returned no locations and `computed_at: null`; no freshness
information or legal registration obligation can be inferred. Results only use
information available to Stripe. Always review with a qualified tax professional
before taking action.

## Required private configuration

Use the self-hosted server's protected configuration mechanism or a secrets vault
when available. Its existing production documentation names
`/etc/eldritch-fable.env`; verify the actual service before any future change.
Do not paste keys into chat, terminal commands, browser code or committed files.
Local development may use an ignored `.env` with owner-only access. Never overwrite
an existing environment file. Use a disposable local database and keep email off.

| Variable | Value/purpose |
| --- | --- |
| `ELDRITCH_COMMERCE_MODE` | `disabled` by default; `sandbox` permits admin test checkouts |
| `ELDRITCH_STRIPE_ACCOUNT` | The exact sandbox account ID verified for that server's key |
| `STRIPE_RESTRICTED_KEY` | Sandbox restricted key, held only on the backend |
| `STRIPE_WEBHOOK_SECRET` | Signing secret for that environment's webhook endpoint |
| `STRIPE_SHIPPING_RATE_ID` | Reviewed, active fixed USD rate with exclusive tax behavior |
| `ELDRITCH_ORIGIN` | The exact existing site origin; return URLs are derived from it |

Prefer a restricted API key over a full secret key. It needs permission to read
the current Account, Products, Prices, Shipping Rates, Tax Settings and active Tax
Registrations, and to create/retrieve Checkout Sessions. Test the permissions in
the intended sandbox and grant only any additionally required dependencies.
Webhook verification uses its separate signing secret. It does not need refund,
payout, bank-account or tax-registration write permissions. This code also accepts
an existing sandbox secret key, but does not require one. Live keys are rejected.

The SDK is pinned to `stripe@23.1.0`; its generated current API version,
`2026-10-28.endive`, is pinned in `server/stripe-client.mjs`. Review the API/SDK and
webhook endpoint version together on upgrades. Hosted Checkout does not require
a publishable key or Stripe.js in the current frontend. Audit intended changes
for key literals before commits and enable available repository secret protection.

## Data and setup boundary

Schema 9 is an additive migration. Apply it only with the existing explicit,
backed-up migration workflow to a disposable development database first. Startup
does not migrate automatically. The migration creates empty commerce tables and
does not activate or sell the illustrative frontend catalog.

A reviewed import must first publish actual merchandise in `storefront_products`
with real variant IDs and integer `price_cents` values in `variants_json` (the
frontend maps these to `priceCents`). Then provision each approved
`commerce_stock` mapping using its `product_id`, `variant_id`, sandbox
`stripe_price_id`, physically verified `available` count and `active` flag.
No generic public import endpoint is provided. Do not reset available stock from
a spreadsheet while reservations exist; available means unreserved units.

Stripe must return an active one-time USD Price matching the server variant's
amount, per-unit billing without quantity transforms, exclusive tax behavior and
an active expanded Product with an explicit tax code. Sessions explicitly select
USD and disable Adaptive Pricing so multi-currency prices cannot change the
amount/currency contract. The shipping rate must also be active, fixed USD and exclusive. Unknown,
unpublished, inactive, unpriced or unmapped listings fail before a reservation.
Do not map preview listings merely to make a test appear successful; use clearly
isolated synthetic fixtures in a disposable database for development.

The [canonical tax-code catalog](https://docs.stripe.com/tax/tax-codes) includes
`txcd_99999999`, **General - Tangible Goods**, which describes movable physical
goods. This is a candidate to review for these products, not an assigned legal
classification. Leather dice bags may need a more specific category; confirm
each real SKU before assigning a code. Digital game access needs its own specific
classification if it is ever sold.

Tax setup requires the actual business address and confirmed jurisdictions where
the business is already registered. Record only confirmed registrations in
Stripe. Adding a Stripe registration does not register the business with a tax
authority. The handler refuses to create an automatically taxed session while
Tax settings are pending or no active registration exists. It does not establish
that every relevant jurisdiction has been configured.

After configuration, test actual SKU tax calculations for addresses in the
registered jurisdictions. Inspect `taxability_reason`, not just the tax amount:
`not_collecting` is incomplete setup; valid exemptions can correctly yield zero.
This verification is currently blocked by the missing address/registrations.
Calculation/collection and filing are separate; do not assume returns are filed.

## API contract and sandbox exercise

All browser checkout mutations require the exact Origin, JSON, an existing
verified administrator session and an `Idempotency-Key` of 16–128 letters, digits,
underscores or hyphens. Use a new random UUID for a different purchase; preserve
the key for retries of the same purchase. Current role/session authority is
rechecked after Stripe lookups and before stock allocation.

`POST /api/commerce/checkout` accepts only this shape, using real approved IDs:

```json
{"items":[{"productId":"YOUR_PRODUCT_ID","variantId":"YOUR_VARIANT_ID","quantity":1}]}
```

The response contains `orderId` and a validated Stripe-hosted `url`. The checkout
page redirects to this URL and stores its retry identity before sending a
request. Client-supplied prices,
tax, shipping, account IDs or return URLs are rejected. Quantity is a whole
number from 1 to 99 per variant, with at most 20 input lines.

`GET /api/commerce/orders/ORDER_ID` exposes minimal payment state only to the
authenticated order owner. Success/cancellation redirect to `/checkout/return`
with the local order ID. That page retrieves the owned server order, distinguishes
pending/paid/failed/expired/review/cancelled states, and polls pending orders for
up to one minute. Forged success query parameters never confirm a payment.
Signing in can return to a strictly validated local checkout/order URL. Closing
the browser after payment does not lose fulfillment. The bag remains on the
device; an unchanged bag reuses its attempt instead of silently starting a new
payment after an uncertain response.

Configure this endpoint in the intended sandbox:
`https://YOUR_REVIEWED_HOST/api/stripe/webhook`, with the same endpoint's signing
secret and these events:

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `checkout.session.async_payment_failed`
- `checkout.session.expired`
- `charge.refunded`
- `charge.dispute.created`

For local forwarding, use the signed-in Stripe CLI's `stripe listen` configured
for the same sandbox and forward to the local API. Its displayed signing secret
is specific to that listener. Do not provision a different anonymous account as
a workaround for this already connected business sandbox. A tunnel/proxy must
allow Stripe's signed webhook POSTs without an interactive login challenge and
must preserve the request's raw bytes and signature header.

Complete a sandbox Checkout using Stripe's documented test payment methods,
inspect the owned order endpoint, replay webhook delivery and confirm one queue
entry. Exercise delayed success/failure, expiry, stock competition, refund and
dispute delivery. A calculation and end-to-end Stripe payment have **not** been
verified with real environment credentials by this preparation.

## Reservation, review and fulfillment operations

Stock reservation and order creation are one SQLite transaction. On a Stripe
timeout, retain the stock and retry the same request key: the server reuses
exactly the stored parameters and Stripe idempotency key. A conflicting payload
with the same key receives 409. Checkout expires after one hour; a stale local
request requires reconciliation, not blind stock release or a new purchase.
Stripe can forget old idempotency keys, so the server does not recreate an old
order after its permitted window.

Reconcile stuck orders against the original sandbox's Sessions/Workbench and
webhook delivery logs. If Stripe accepted the request, replay its signed event.
If no Session can be conclusively found, an operator must establish whether the
request was accepted before releasing reserved stock. No automated sweeper or
unsafe timeout-based restocking is provided. API permission errors after a local
reservation also need this retry/reconciliation flow.

The webhook fetches the current Session before acting, verifies expected order,
account, USD subtotal, shipping and totals, and records event receipt in the same
transaction as state changes. Unpaid completed sessions do not fulfill. Confirmed
failure/expiry releases stock once; a late paid event after release goes to review.
Paid events write totals and private shipping/customer details, then insert one
`commerce_fulfillment` row. Keep processing webhooks with existing credentials
when new checkouts are disabled.

Refunds/disputes put fulfillment on `review` without automatically restocking or
shipping. A dispute arriving before paid checkout is retained against the payment
intent, so later payment delivery also enters review. No mail is sent and no
external shipment happens automatically. Fulfillment is a queue to inspect, not
a claim that an order was shipped. A future worker/admin tool must check current
review status, claim work atomically and make shipment/email operations idempotent.

## Before public sales

The outstanding work is real catalog/import and inventory operations; approved
shipping/returns policies; real-environment verification of checkout and payment-status UX; fulfillment,
reconciliation, refund and dispute tools; account activation and live credentials;
live webhook/Tax configuration; and a separately authorized migration/rollback
rehearsal and deployment. Review live payment methods and Link in the Dashboard.
Adaptive Pricing is a future option only after international shipping is approved.
Sandbox registrations/settings never certify live tax readiness.

Current tests use real SQLite transactions, HTTP route logic and Stripe's real
signature verifier, with only external Stripe API responses simulated. Run
`npm test` and `npm run build` from `standalone/` with Node >=24. Browser tests
use the existing disposable database harness. Production/customer data is not
used. See the shared workspace handoff for the exact checks and results.
