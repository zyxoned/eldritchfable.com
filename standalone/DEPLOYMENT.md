# Independent deployment checklist

This directory is an **unreleased staging candidate**, not the live store.

## Requirements
- Node.js 24 and npm
- A reviewed copy of the catalog data
- A database backup and a separate staging database
- HTTPS and trusted reverse proxy configuration

## Safe staging sequence
1. Clone the migration branch on a development machine.
2. Run `cd standalone && npm install && npm run build`.
3. Create a **new staging database** with `sqlite3 staging.db < server/schema.sql`. Never point this command at the live customer database.
4. Seed approved collection and product records only. Catalog data is not yet migrated from Base44.
5. Start the API with `ELDRITCH_DB=/absolute/path/staging.db node server/index.mjs`.
6. Verify `/api/health` and `/api/catalog`; empty catalog is expected before seeding.
7. Confirm the frontend can load and that checkout cannot charge or create an order.
8. Only then plan a versioned release and rollback on the Dell.

## Production blockers
- Product/collection data export and media asset transfer
- Independent customer authentication and admin authorization
- Payment-provider integration with server-side webhook verification
- Fulfillment and shipping integrations
- Backup/restore testing, TLS/domain verification and accessibility/security testing
- Successful CI and hands-on browser checks

Do not disable Base44, repoint DNS, or open public checkout until these gates pass.
