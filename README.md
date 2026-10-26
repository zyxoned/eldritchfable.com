# Eldritch Fable

The maintained application is in [standalone](standalone/README.md): an independent React/Vite storefront, Node.js customer account and catalog API, SQLite migrations, and transactional email worker. It does not depend on Base44.

Use Node.js 24 or newer. To verify the application from a checkout:

```sh
cd standalone
npm ci
npm test
npm run build
```

See the standalone README for local startup and Chromium browser tests. GitHub Actions runs the build, server tests, and browser tests on `main`, the migration and account-repair branches, and relevant pull requests.

Follow [Linux deployment](standalone/DEPLOYMENT.md) when upgrading the existing server. It describes the production layout, migration rehearsal, backups, versioned releases, and rollback. The [account and email notes](standalone/ACCOUNTS-AND-EMAIL.md) describe session, verification, reset, and queue behavior. A successful repository build does not establish which revision is running on the live server or confirm actual email delivery.

The [migration status](MIGRATION.md) distinguishes the maintained application from the [partial historical source archive](recovery/README.md). Checkout remains disabled. Product imports, payment and fulfillment integration, profiles, saved addresses, and PostgreSQL remain separate work.
