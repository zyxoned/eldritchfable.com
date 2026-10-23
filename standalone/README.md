# Eldritch Fable standalone storefront

Independent React/Vite storefront with a Node 24 API and SQLite customer accounts. The running application has no Base44 dependency. Checkout remains disabled; the catalog is empty until products are imported.

Run these commands inside `standalone/`:

```sh
npm ci
cp .env.example .env
npm run db:migrate
npm start
```

In another terminal run `npm run dev`, then open `http://localhost:5173`. The example configuration uses that exact origin. The API listens on loopback port 3000. Email delivery is disabled by default; the worker can inspect the queue without SMTP credentials using `npm run mail:run`.

For an existing server, follow [DEPLOYMENT.md](DEPLOYMENT.md). Migrations back up an existing database before changing its schema. They preserve customer accounts, passwords, roles, sessions, and newsletter suppression records.

Customer pages: `/register`, `/verify-email`, `/resend-verification`, `/login`, `/account`, `/forgot-password`, and `/reset-password`. Administrators use the same account system; `/admin` checks the server-issued role. Public signup always creates customers. Provision a new administrator locally with `npm run admin:create -- owner@example.com`.

`GET /api/catalog` returns `{ "products": [], "collections": [] }`. Catalog and commerce integration, profiles, saved addresses, and PostgreSQL are separate work. Monetary values remain integer cents. Database setup and queue persistence live in server modules so a later PostgreSQL adapter can replace SQLite access without changing the browser's account APIs; a PostgreSQL adapter is not included yet.

Checks: `npm test`, `npm run build`, and `npm run test:browser` (install Chromium using `npx playwright install chromium`, or set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` to an installed Chromium executable). Browser checks use a separate temporary database and do not send email.
