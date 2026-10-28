# Account RPG and Secret Stash

This change adds same-origin `/play` and `/stash` routes to the standalone
Eldritch Fable storefront. It builds on the account and email work in PR #1;
the standalone AppDeploy prototype is not the production integration.

## Player behavior

- A verified, enabled Eldritch Fable customer account is required for the
  realm, its live event stream, and every stash operation.
- One character and private stash belong to each account. Refreshing,
  leaving, or a seat expiring does not erase saved progress.
- The realm admits at most six active accounts atomically. Sessions expire
  after 75 seconds without a heartbeat; clients renew every 20 seconds.
- Account cookies remain HttpOnly. The client does not supply an account ID,
  wallet balance, reward amount, or guest credential.
- The map uses the existing site's near-black, deep purple, gold, and serif
  design. Its layout styles are scoped so other storefront pages retain
  their existing styles.
- Attacking contributors receive server-calculated XP. Crystal and quest
  rewards can be earned once per character. XP credits and request receipts
  commit atomically. The private balance and ledger never enter realm events.

## Account welcome popup

Registration offers an optional adventure preview and automatically opens the
welcome popup after a successful registration request. It explains email
verification, persistent characters and progress, the six-player realm, inviting
friends, private XP and the approved exchange, and the planned gear/ability uses.
The account page can reopen the same introduction. The invite button copies the
public `/play` link; it does not send messages or expose account details.

The native modal keeps keyboard focus inside it, supports Escape and explicit
close controls, restores focus to its replay button, and scrolls on small screens.
Gear purchases and ability unlocks are clearly described as coming soon.

## Approved exchange

The owner specified:

**1,250 XP = 1 gold = 100 silver = 1,000 copper. 1 gold = 1 penny.**

The stash exchanges whole lots of 1,250 spendable XP for 1,000 base copper.
All wallet arithmetic uses integers. Gold is 1,000 copper; silver is 10 copper.
The UI presents residual denominations and whole pennies of shop value.
Character level uses lifetime XP, which exchanging XP never reduces.

Every exchange checks the authenticated balance, uses an immutable request ID,
and records both the XP debit and copper credit in the same database transaction.
Retrying the same request cannot exchange the same XP twice. Available XP and
coin totals are private to the signed-in account.

## Commerce and abilities still need configuration

The catalog is currently empty and checkout is disabled in the existing source.
This change does not fabricate merchandise, issue paid orders, or let the
browser assign credits. Physical gear redemption remains explicitly unavailable
until real product prices, inventory, checkout, and fulfillment are connected.
Price each product in gold/silver/copper using the approved value above, with
checkout handling whole pennies and retaining smaller coin balances.

Eight player callings now include two free starter skills each; see [EXPANSION.md](EXPANSION.md). Additional XP-priced ability purchases remain unavailable.

## Validation and rollout

The existing standalone CI runs `npm run build`, `npm test`, and Playwright.
New coverage includes account gates, six-seat allocation, persistent rewards,
cross-account isolation, live-stream authorization, exchange replay protection,
and the browser earn/exchange/persist workflow on desktop and mobile.

Run `npm run build` and the desktop/mobile Playwright suite in an isolated
browser-test database. The account lifecycle tests exercise signup welcome,
keyboard focus, account replay, invitation copy/fallback, and small-screen
scrolling, alongside the existing adventure and exchange workflow.

Use the existing `standalone/DEPLOYMENT.md` process and production layout.
Back up the current database before explicitly migrating to schema version 4 (including migrations 003 and 004),
then deploy the server and built frontend together. Preserve the existing
customer DB, Caddy and Cloudflare Tunnel setup, ports, and systemd units.
This source branch does not change DNS or replace the storefront apex domain.