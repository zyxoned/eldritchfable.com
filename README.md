# Eldritch Fable

The maintained application is in [standalone](standalone/README.md): an independent React/Vite Tavern storefront, Node.js account/catalog API, account RPG, private Secret Stash, SQLite migrations and transactional email worker. It does not depend on Base44.

Repository: https://github.com/zyxoned/eldritchfable.com. Public site: https://eldritchfable.com. **zyxoned.github.io is for Pine Kind**, a separate project.

Use Node.js 24 or newer:

```sh
cd standalone
npm ci
npm test
npm run build
npx playwright install chromium
npm run test:browser
```

GitHub Actions runs the build, server tests and desktop/mobile browser tests. Read [project state](PROJECT_STATE.md) for source reconciliation and the limits of local/runtime evidence; successful CI does not prove deployment or inbox delivery.

The [adventure notes](standalone/ADVENTURE.md) and [expansion notes](standalone/EXPANSION.md) cover the six-player realm, eight callings, administrator seventh avatar and private XP exchange. Checkout, physical gear redemption and additional XP-priced ability purchases remain unavailable.

Follow [Linux deployment](standalone/DEPLOYMENT.md) for an explicitly authorized rollout. Current source requires schema 4. Preserve customer accounts, sessions, mail and game/economy data. See [account/email notes](standalone/ACCOUNTS-AND-EMAIL.md), [migration history](MIGRATION.md) and the [historical archive](recovery/README.md).
