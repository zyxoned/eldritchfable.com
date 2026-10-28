# Tavern frontend integration

The Tavern design is integrated into the existing React/Vite storefront, based on
commit 45fb85d21236557c0abb65d6049976fd9a7d4392. It ports the storefront UI and
runtime artwork from the preserved staging Tavern prototype. Account, admin,
newsletter, API, database, mail, and deployment code remain on the repaired release.

The frontend includes the table hero, six fallback collection links for an empty
catalog, the table-ready promise, header search, and a device-local preview
wishlist. Search resets category filters when navigating. The mobile menu includes
Account and uses the same 700px breakpoint as the category navigation. Tavern CSS
is scoped to the storefront; the miniature illustration resolves to item-mini.webp.
Only runtime artwork is included, without prototype backups or reference screenshots.

## Verify in an isolated development checkout

Use Node 24 or newer from the standalone directory:

    npm ci --no-audit --no-fund
    npm run build
    npm test
    npx playwright install chromium --only-shell
    npm run test:browser

Browser tests use the existing temporary SQLite database and loopback-only preview
server. Tavern catalog scenarios intercept catalog responses; they do not use the
production database or send email. Screenshots are written to ignored test-results
directories. Browser tests cover desktop/mobile account flows, empty catalog
navigation, search after filtering, asset loading, wishlist persistence, selected
variants in the bag, disabled checkout, and 320/390/680/701/800/1024/1280px navigation.

## Existing-server validation environment

On the inspected server, browser binaries and extracted runtime libraries are
kept outside the checkout in private staging directories. No system packages or
production services are changed. Run the browser suite there with:

    PLAYWRIGHT_BROWSERS_PATH=/srv/eldritch-staging/.tavern-browser-cache \
    LD_LIBRARY_PATH=/srv/eldritch-staging/.tavern-browser-libs/usr/lib/x86_64-linux-gnu \
    npm run test:browser

## Verified baseline and outstanding work

The pre-candidate production frontend was deployed on 2026-10-24 from local source
commit 918e5d24237bac56846c6e3e869b82017bd458e5, branch
feat/tavern-vite-integration. Its release ID is
tavern-918e5d24237b-20261024T224605Z. The account/API backend remains release
45fb85d21236-20261023221639658. The public frontend-release.json is authoritative
for the currently active frontend and backend. The October 26 baseline
publication carried that frontend implementation onto main with its documentation
and CI updates, under a new publication commit identity. The deployment manifest
retains the source identity of each actual runtime release.

A fresh isolated audit on 2026-10-26 passed all 42 backend tests and 10 Chromium
browser tests. Its 26 build output files matched production byte for byte.
Live desktop/mobile navigation passed without JavaScript or HTTP errors.
Backend, web, tunnel, mail, healthcheck and backup services were healthy.
Production database integrity checks passed; the latest backup was valid.
No production customer records or email submissions were used for these checks.

Catalog data is currently empty and checkout is disabled. Catalog and checkout
implementation and end-to-end testing are planned for about 2026-11-02, per the
owner's 2026-10-26 direction. Existing catalog browser tests use mocked products;
they do not establish live catalog, payment, order or email delivery readiness.

The later local feat/tavern-reference-fidelity branch is separate design work.
The draft account RPG/secret-stash pull request is separate feature work.
Neither is included in this publication or the verified production baseline.

Keep the original Tavern prototype intact: it predates the account repair.
Build from standalone in the existing React/Vite application. Production frontend
releases are versioned separately from the account/API release; use the existing
release workflow and verify the public release manifest after an authorized
runtime deployment. Repository publication alone does not deploy production.

## Tavern completion and craft polish

The saved design from local commit aed14f71e0478ee1bcb14009bc4535a4213846e8
was integrated through pull request 4, retaining the existing React/Vite app.
It includes illustrated category cards, an expanded footer, a lower search form,
consistent keyboard search behavior and the intended category artwork.

The deployed frontend from commit 7a717e643be3e297c8c3310b77814a26e91ffa4a
passed 42 backend tests, 18 Chromium browser tests and 32 public runtime checks
on October 26. The public checks covered desktop/mobile routes, loaded artwork,
valid HTTPS, search/Account behavior, and seven widths from 320 to 1280 pixels.
The search panel fits the viewport at all seven widths. API and tunnel processes
were preserved during the frontend rollout.

The subsequent craft pass refines the existing typography, spacing, gold borders,
card alignment and mobile footer. Runtime deployment identity remains recorded in
the public frontend-release.json, which is authoritative for the active version.
Routine changes use the normal build/CI checks and final verification on the live
public site, with an available frontend rollback. Separate test deployments are
reserved for large changes, per the owner's direction.

Catalog and checkout implementation/testing remains planned for about 2026-11-02.

## Repository reconciliation, October 28, 2026

The consolidated source combines main's Tavern design and CI/docs, the account
RPG/Stash and Hollow King expansion, the phone-header fix from PR #6, and the
October 27 audit notes. The earlier baseline sections above describe historical
releases; they do not identify the currently deployed version. See
[PROJECT_STATE.md](../PROJECT_STATE.md) for the reconciliation inputs and limits.
Eldritch Fable uses zyxoned/eldritchfable.com. zyxoned.github.io belongs to Pine Kind.
