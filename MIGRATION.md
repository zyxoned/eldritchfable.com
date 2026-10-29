# Eldritch Fable independent hosting migration

Status: independent application source and deployment procedures are available in `standalone/`. Historical source recovery remains partial. Repository availability and passing CI do not establish a completed production rollout.

## Purpose
Maintain the Eldritch Fable storefront independently of Base44, using a React/Vite frontend, Node.js 24 API, SQLite database, and Caddy on the Dell CANDY Ubuntu server.

## Source locations

- `standalone/` is the maintained application. It contains the storefront, customer accounts, catalog read API, newsletter endpoints, transactional mail queue, SQLite migrations, database tools, and tests. Its runtime has no Base44 dependency.
- `recovery/` contains partial historical snapshots from the original application. It is not a runnable or deployable project. See [the archive notes](recovery/README.md) for known omissions.
- The Tavern storefront includes runtime artwork in standalone/public/approved and standalone/public/visuals. See [Tavern integration and release status](standalone/TAVERN.md) for the verified production baseline. A complete historical Base44 export remains unavailable.

## Existing production server

[standalone/DEPLOYMENT.md](standalone/DEPLOYMENT.md) records the October 23, 2026 production inspection and migration rehearsal. Use that guide for the existing production service names, database, symlinks, API port, Caddy configuration, and mail scheduler. Earlier port-3000 and `/srv/eldritch-fable` examples describe a different layout; do not substitute them for the production layout. Generic Caddy and systemd templates are examples, not instructions to install duplicate services on that server.

The production check verifies the active database and running services before rehearsing migration on a private snapshot. The rollout procedure preserves accounts, service identities, SMTP credentials, and the existing production scheduler, and prepares code rollback. Recheck the actual server state before applying it.

## Validation and rollout

1. Use Node.js 24 or newer and install the locked dependencies with `npm ci` inside `standalone/`.
2. Run the production build, server tests, and Chromium browser tests. GitHub Actions runs these checks for `main` and the development branches configured in `.github/workflows/standalone-ci.yml`.
3. Follow the deployment guide to stage a temporary database and rehearse migration against a consistent snapshot of the active production database.
4. Back up the existing server configuration and database, deploy a versioned release, and verify the documented rollback procedure.
5. Verify public HTTPS routing, account registration, verification, sign-in, password changes and resets, and actual transactional inbox delivery. Confirm that only the intended mail scheduler is active.

These steps describe required verification; this document does not claim they have been completed for the currently running release.

## Remaining commerce work

Checkout stays disabled until real products, inventory, payment confirmation, shipping, and fulfillment are connected and tested. Product imports, customer profiles and saved addresses, PostgreSQL, and restoration of the original artwork remain separate work. Historical commerce source is not evidence of completed merchant integration.

## Data and recovery

Never commit database files, customer records, payment keys, API tokens, SSH keys, or live `.env` files. Keep private backups and the rollout recovery record outside the public repository. Follow the deployment guide for code rollback; replacing a live database requires preserving subsequent account changes first.

## October 29 verified reconciliation

GitHub main `2d708248a9e812195d4e4e9177da85aaa33d7589` includes the combined React/Vite, accounts/mail and schema-4 expansion source. Actual production remains the welcome frontend and f05 backend on schema 3. The accessible CANDY source inventory and recovery archive supplement the earlier remote-only reconciliation; a complete original Base44 export remains unavailable. Read [PROJECT_STATE](PROJECT_STATE.md), [exact source differences](SOURCE_RECONCILIATION.md) and [deployment/recovery](DEPLOYMENT_RECOVERY.md) before future operations.
