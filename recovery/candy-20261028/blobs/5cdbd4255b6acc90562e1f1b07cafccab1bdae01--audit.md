# Eldritch Fable sync and runtime audit — 2026-10-26

Runtime passes. GitHub sync is incomplete.

Production serves Tavern commit 918e5d2, with backend45fb85d. All29 frontend files and24 backend files match their release sources. A fresh isolated build from918e5d2 produced26 files identical to production;42 backend tests and10 browser tests passed.

Read-only public desktop/mobile checks passed home, shop, account/login, verification recovery and bag. Widths320,390,680,701,768,1024,1280 passed with no clipping, JavaScript exceptions or HTTP failures.

API, web and Cloudflare Tunnel are running. Mail, backup and healthcheck timers are active and their last jobs succeeded. Last24h logs contain no warnings/errors. The latest private backup and live database pass SQLite quick_check; no foreign-key violations were found.

The deployed Tavern commit and feat/tavern-vite-integration branch are absent from GitHub. Both server checkouts have stale cached remote refs. Main is5108e071; repair is422e024. Their changes beyond45fb85d affect documentation/CI only. Tavern is1local/2remote commits from main, or1local/1remote from repair. The separate RPG/Stash draft is not deployed.

The cloud workspace still reports pending/offline; the production SentinelX connection is online. The catalog is empty and checkout remains disabled. Inbox delivery was not retested because no email was sent.

Next safe step: publish Tavern source to GitHub, reconcile main's documentation/CI updates, and run remote CI for that branch.

No production changes were made during this audit. Verification output and detailed JSON are retained beside this report.
