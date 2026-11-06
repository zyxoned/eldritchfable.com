# Eldritch Fable Stripe integration design

Observed November 6, 2026, America/New_York. Source baseline:
`1023c62c23d89645fbfe7e06ee813ee59fba5b3f`. Maintained app: `standalone/`.

The owner requested Payments and Tax for physical tabletop trinkets and leather
dice bags, alongside an eight-player MMORPG. Stripe's connected implementation
planner accepted hosted, one-time web Checkout under guide
`iguide_61ViCzY6QokLHNEf2413C66EEHuy8`.

## Approaches and selected scope

Payment Links are quick for individual products but do not connect this site's
cart and stock. Embedded Elements require more UI and maintenance. The builder's
selected default is Stripe-hosted Checkout Sessions using the existing Node API,
React/Vite frontend, SQLite and account authorization. No replacement framework,
processor orchestration or subscription service is needed.

The initial implementation is an administrator-only **sandbox integration**,
disabled by default. `/checkout` provides a styled order review and redirects to
Stripe's prebuilt full-page UI. `/checkout/return` displays the owned server order
and polls pending payments for up to one minute. It introduces no active public
sale button and accepts no live key.
Real merchandise, shipping prices and legal tax registrations are unknown; the
builder must not turn illustrative listings into sellable stock or invent these
inputs. Existing preview UI, accounts, game state, XP and wallets are retained.
Game monetization, rewards redemption, payouts and paid access are separate work.

## Payment contract

- The client sends only product/variant identities and integer quantities.
- Preserve one retry identity per account/bag in session storage before submitting
  checkout. Never confirm payment from return URL parameters; the owned server
  order is authoritative. Preserve the bag on failure, cancellation and return.
- A published server catalog entry and explicit Stripe Price/stock mapping must
  both exist. Stripe must confirm an active one-time USD Price, matching catalog
  amount, per-unit billing without transforms, exclusive tax behavior and Product
  tax code before a session is created. Sessions explicitly select USD and disable
  Adaptive Pricing to preserve that amount/currency contract.
- A configured active USD shipping rate and US shipping-address collection are
  required. No default free shipping is invented.
- Checkout Sessions use dynamic payment methods, a stable per-order integration
  identifier, server-selected return URLs and stable Stripe idempotency keys.
- Stock is reserved atomically before the external call. An uncertain external
  failure keeps the reservation; retry the same local order and Stripe key.
  Never automatically release stock merely because the client lost its response.
- A signed, raw-body webhook drives payment state and a unique durable fulfillment
  queue entry. Handle completed, delayed success/failure and expired sessions.
  A returned/success page never fulfills an order. Replays and out-of-order events
  must not duplicate fulfillment or stock changes.
- Persist payment totals, shipping and customer details privately for fulfillment.
  Orders are visible only to their authenticated owner. No emails or shipments
  are sent by this foundation. Refunded/disputed orders require operator review;
  production needs an explicit refund/dispute workflow before launch.

## Tax contract and observed blockers

The only connected account is **Eldritch Fable LLC sandbox**,
`acct_1UYYVs3C66EEHuy8`, not live mode. Stripe Tax settings are `pending`, missing
`head_office`; default tax code/behavior are null; registrations list is empty.
Monitoring returned no locations and no computation timestamp, so it establishes
no jurisdictional obligation or live sales activity.

Read Tax Settings and active registrations before enabling automatic tax. Refuse
checkout while settings are pending or no active registration exists. Match each
SKU's confirmed physical-product tax code and explicit price behavior. Do not
guess a tax code or create a tax registration. The owner must supply the business
address and jurisdictions where registration is already complete. Adding a
registration to Stripe records an existing registration; it does not register the
business with a tax authority.

Before live sales, run sandbox calculations with actual confirmed product codes
and an address in each registered jurisdiction. Inspect `taxability_reason`;
`not_collecting` is not a successful setup. Sandbox settings/registrations do not
carry into live mode. Tax calculation/collection does not itself enroll filing.

## Keys, persistence and release boundary

Use Stripe's current Node SDK with an instance client and explicit API version.
Use a restricted sandbox key in protected server environment configuration and a
separate webhook signing secret. Neither belongs in browser code, source, logs,
chat or committed `.env` files. Prefer a host secret vault when available.

Additive SQLite migration 9 creates stock, order, event-deduplication and
fulfillment tables, preserving existing schema-8 data. Migration runs only through
the existing explicit backed-up migration command, never at API startup. Do not
migrate a live database or deploy this candidate during integration preparation.

Public launch additionally requires verified inventory/import and shipping policy,
verified real-environment checkout/return behavior, fulfillment/refund operations, account onboarding,
live restricted-key and endpoint configuration, live Tax verification and an
authorized migration/release rehearsal. This foundation is not production-ready.

## Primary references

- [Hosted Checkout](https://docs.stripe.com/payments/accept-a-payment?payment-ui=checkout&ui=stripe-hosted)
- [Fulfillment and delayed payments](https://docs.stripe.com/checkout/fulfillment)
- [Stripe Tax setup](https://docs.stripe.com/tax/set-up)
- [Product tax codes](https://docs.stripe.com/tax/tax-codes)
- [Tax registrations](https://docs.stripe.com/tax/registering)
- [Restricted API keys](https://docs.stripe.com/keys#manage-your-api-keys)
