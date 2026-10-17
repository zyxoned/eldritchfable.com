# Eldritch Fable independent hosting migration

Status: source recovery in progress. **Do not deploy this branch as-is.**

## Purpose
Move the Eldritch Fable storefront from Base44 to a self-hosted React/Vite frontend, Node.js API, SQLite database and Caddy on the Dell CANDY Ubuntu server.

## Verified source
The Base44 app `6ab696b643382213e47df732` contains React pages, storefront CSS, catalog components, schemas and commerce functions. The original source files recovered under `recovery/` are snapshots for reference, not a complete working project.

## Verified server (from operator terminal checks)
- Caddy `:8080` routes `/api/*` to `127.0.0.1:3000`.
- Node.js API health returned HTTP 200.
- SQLite file is `/srv/eldritch-fable/data/eldritch.db`.
- A systemd service named `eldritch-api` was reported active.
These checks do not prove the live domain points to this server.

## Migration gates
1. Recover all required source files and assets, with dependency inventory.
2. Remove Base44 SDK, Vite plugin, Base44 authentication and remote data calls.
3. Implement independent catalog endpoints and SQLite migrations.
4. Implement server-side authorization for admin and customer order routes.
5. Keep checkout disabled until real payment confirmation, inventory and fulfillment integrations are tested.
6. Verify npm build, automated tests and local staging.
7. Backup server files and database, deploy a versioned release, verify rollback.
8. Verify domain, HTTPS, DNS and payment webhooks before cutover.

## Security
Never commit database files, customer records, payment keys, API tokens, SSH keys or `.env` files. Existing Base44 commerce functions are not evidence of completed merchant integration. Do not migrate production customer records into a public repository.

## Rollback
Keep existing public site and Base44 app unchanged until the independent release passes staging tests and owner approves cutover.
