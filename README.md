# Eldritch Fable

The independent storefront, customer account API, SQLite migrations and transactional email worker are in [standalone](standalone/README.md).

See [Linux deployment](standalone/DEPLOYMENT.md) for upgrading the existing server while preserving accounts and preparing rollback. The [account and email notes](standalone/ACCOUNTS-AND-EMAIL.md) describe session, verification, reset and queue behavior.

The recovery directory contains historical source snapshots. The running standalone application does not depend on Base44. Product imports, payment integration and PostgreSQL remain separate work.
