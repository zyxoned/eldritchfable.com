# Eldritch Fable Print Studio

The studio runs independently of the storefront checkout sandbox. It uses its own private SQLite database on the Eldritch server and delegates login to the existing accounts API. The HTTPS paths are in caddy-route.json. Install the systemd unit with the store's Stripe account ID in an Environment=EF_PRINT_STRIPE_ACCOUNT drop-in. Use the same Stripe library version pinned by standalone/package-lock.json.

## Merchant setup

1. Under OTTO business account → Developers, create a business key with files:write, models:read, models:write, quotes:write, orders:read, orders:write, payments:read and payments:write. A paid supplier submission uses the selected saved OTTO method after Stripe verifies a paid retail order. The configurable retail price is separate from the manufacturing estimate.
2. In OTTO Developers → Webhooks, register https://eldritchfable.com/api/otto/webhook for the model, order and payment event types.
3. In Stripe Workbench, register https://eldritchfable.com/api/otto/stripe-webhook for checkout.session.completed, checkout.session.expired, checkout.session.async_payment_succeeded, checkout.session.async_payment_failed, charge.refunded, charge.dispute.created and charge.dispute.funds_withdrawn. Set up a live restricted key for account reads, Tax settings reads, Checkout Sessions read/write, customers write, payment intents read and any associated Stripe permissions for inline prices and shipping rates. Verify the account's tax registrations for your sales before opening.
4. In an interactive terminal on the Eldritch Ubuntu server, run sudo /usr/local/sbin/eldritch-print-config. Fill the hidden prompts, including the ID of the payment method approved for paying OTTO. The command restarts the isolated service. Keep secrets out of Git, screenshots and chat.
5. Send an example from the OTTO endpoint Testing tab. For Stripe, confirm a signed delivery in Workbench. The receiver acknowledges verified events with HTTP 204. The merchant workspace shows delivery status. Orders stay paused until the administrator opens checkout.
6. Sign in at /account, then visit /print-studio/. Under Merchant workspace choose OTTO models, set a retail price and publish each approved print. Set a handling markup for customer designs. New listings are checked against current manufacturing prices. Model files sent through the customer area are private to their owner.
7. Use the merchant workspace to open or pause new orders. An existing paid order can continue through fulfillment while new orders are paused. If a payment or fulfillment is flagged for review, reconcile the Stripe payment, the customer order and OTTO's order before retrying or refunding. A signed provider event can be replayed through the provider dashboard.

Customers can design a Warden or Seer pawn or a shaped token, or bring a 3MF, GLB, OBJ or ZIP. Each checkout is for one inspected print shipped within the US. Supplier manufacturing and shipping are quoted for that specific address before Checkout calculates retail tax. There are no automated repairs. Use the existing sandbox or local fixtures for simulated purchases. A real checkout charges the buyer and may pay OTTO for manufacturing.

## Recovery

The SQLite database and its WAL reside in /var/lib/eldritch-print-studio. Use SQLite's online backup API to take a consistent private backup. The database contains private model and order identifiers. Keep the systemd environment file in the host's private credential backup. If routing fails, restore the prior active Caddy JSON from the installation backup and restart eldritch-production-web; the original API and game are separate processes.
