# Private administrator identity, analytics and testing tools

The owner requests their existing account be one of two admin players, with a
Death Knight visitor identity, renewable testing XP/gold and a private side panel.
The account was verified read-only: it is already an enabled, verified administrator
and the enabled administrator count is two. Preserve credentials, sessions,
ordinary characters and customer wallets. Personal account identifiers stay out of Git.

Implementation choice: reuse the existing role/session system and separate visitor
avatar. Add account-scoped display-name/testing settings and a nonredeemable test
wallet with repeatable grants and audited receipts. Literal infinity cannot be stored
as a safe integer; repeated grants provide unlimited testing access. Do not mutate
real lifetime XP or customer/shop balances, or remove party-scaled visitor offense.
Keep the existing React/Vite, Canvas, Node and SQLite stack.

A global admin-only side tab opens a native modal drawer, with keyboard access,
aggregate realm/account/mail activity, own visitor name, testing grants/exchange,
guarded test reset and own audit history. Server authorization protects every read,
write and retry; hiding the tab is presentation. Unknown fields and target IDs fail.
No analytics service, tracking system, private combat arena or new campaign is added.

- [x] Inspect real account status, current auth, visitor constraints and admin placeholder.
- [x] Add schema 6, admin service, validated name overlay and reviewed existing-admin CLI.
- [x] Build side drawer, game-input isolation and account entry point.
- [x] Verify authorization, revocation, replay, overflow, test/customer separation and migration preservation.
- [ ] Verify desktop/mobile drawer workflows, focus, reset guardrail, logout and game input.
- [ ] Publish reviewed source, run CI and production-copy migration/fallback checks.
- [ ] Deploy the authorized account feature, configure only the requested existing account with a private backup/audit, and verify live state.
- [ ] Update source/release evidence and release only owned leases.
