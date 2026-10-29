# Exact source reconciliation

Verified 2026-10-29 UTC. Maintained application: `standalone/` (React/Vite and Node).
Current main is `2d708248a9e812195d4e4e9177da85aaa33d7589`, tree
`40647f991fbbcbfcc75cd104106d1a8a26b133ad`. PR #7 already incorporated the preferred
CANDY implementation `6b898d2`, phone fix `9f8e083` and prior audit `d4f9ada`.
The present PR adds source recovery and dated operational documentation only.

## Comparison and preserved behavior

- All non-Markdown tracked application files in the CANDY candidate that passed
  69 backend / 30 browser tests are byte-identical to current main.
- Relative to preferred `6b898d2`, main changes exactly two runtime/test files:
  `standalone/src/styles/storefront.css` (whole-wordmark phone sizing) and
  `standalone/tests/browser/tavern.spec.mjs` (whole-wordmark search clearance).
  Both blobs exactly match `9f8e083`; no alternative framework was introduced.
- Main retains the original main CI workflow, package files/lock and 23 artwork
  files. Account/mail/newsletter infrastructure, schema migrations 001 through
  004, deployment safeguards and all tests remain. Main's newer README, Tavern,
  adventure and deployment documentation were kept and annotated with current evidence.
- Every original checkout was privately preserved before reconciliation: eight
  verified history bundles, five common Git object-store snapshots, source archives
  and staged/unstaged patches. Originals and old branch tips were left intact.
  Unpublished/local-only Git metadata stays private; recoverable source bytes from
  accessible snapshots are in the CANDY archive. A GitHub clone is not a substitute
  for private Git/reflog or operational configuration backups.

## Main versus running releases

`A` means added in main, `M` means modified in main. These are exact non-Markdown
tracked application path differences, not a claim that every changed path executes
in production. The frontend commit also contains backend source; backend comparison
therefore includes frontend changes. Generated dist/dependencies and private runtime
configuration are deliberately outside these Git comparisons.

### Verified frontend source `2011d09558baa37d90820aeae4aab3eab473e6b6`

28 application/test paths differ from main:

| Status | Path |
| --- | --- |
| M | `standalone/deploy/production-check.mjs` |
| M | `standalone/deploy/production-rollout.mjs` |
| M | `standalone/server/database.mjs` |
| M | `standalone/server/game-rules.mjs` |
| M | `standalone/server/game.mjs` |
| A | `standalone/server/migrations/004-class-chronicle.sql` |
| A | `standalone/shared/class-catalog.mjs` |
| M | `standalone/src/components/AdventureWelcome.jsx` |
| A | `standalone/src/game/ClassDetails.tsx` |
| M | `standalone/src/game/GameCanvas.tsx` |
| A | `standalone/src/game/IntroCutscene.tsx` |
| M | `standalone/src/game/Mossvale.tsx` |
| A | `standalone/src/game/expansion.css` |
| M | `standalone/src/game/game.css` |
| A | `standalone/src/game/intro.css` |
| M | `standalone/src/game/shared/game.ts` |
| M | `standalone/src/pages/Account.jsx` |
| M | `standalone/src/pages/Adventure.jsx` |
| M | `standalone/src/pages/SecretStash.jsx` |
| M | `standalone/src/styles/storefront.css` |
| M | `standalone/tests/browser/accounts.spec.mjs` |
| M | `standalone/tests/browser/adventure.spec.mjs` |
| A | `standalone/tests/browser/expansion.spec.mjs` |
| M | `standalone/tests/browser/tavern.spec.mjs` |
| M | `standalone/tests/deployment.test.mjs` |
| A | `standalone/tests/game-expansion.test.mjs` |
| M | `standalone/tests/migrations.test.mjs` |
| M | `standalone/tests/production-rollout.test.mjs` |

### Verified backend source `f05b81a0ff9d60fa39aff635d7164623f2256eb9`

29 application/test paths differ from main:

| Status | Path |
| --- | --- |
| M | `standalone/deploy/production-check.mjs` |
| M | `standalone/deploy/production-rollout.mjs` |
| M | `standalone/server/database.mjs` |
| M | `standalone/server/game-rules.mjs` |
| M | `standalone/server/game.mjs` |
| A | `standalone/server/migrations/004-class-chronicle.sql` |
| A | `standalone/shared/class-catalog.mjs` |
| A | `standalone/src/components/AdventureWelcome.jsx` |
| A | `standalone/src/game/ClassDetails.tsx` |
| M | `standalone/src/game/GameCanvas.tsx` |
| A | `standalone/src/game/IntroCutscene.tsx` |
| M | `standalone/src/game/Mossvale.tsx` |
| A | `standalone/src/game/expansion.css` |
| M | `standalone/src/game/game.css` |
| A | `standalone/src/game/intro.css` |
| M | `standalone/src/game/shared/game.ts` |
| M | `standalone/src/pages/Account.jsx` |
| M | `standalone/src/pages/Adventure.jsx` |
| M | `standalone/src/pages/SecretStash.jsx` |
| M | `standalone/src/styles/accounts.css` |
| M | `standalone/src/styles/storefront.css` |
| M | `standalone/tests/browser/accounts.spec.mjs` |
| M | `standalone/tests/browser/adventure.spec.mjs` |
| A | `standalone/tests/browser/expansion.spec.mjs` |
| M | `standalone/tests/browser/tavern.spec.mjs` |
| M | `standalone/tests/deployment.test.mjs` |
| A | `standalone/tests/game-expansion.test.mjs` |
| M | `standalone/tests/migrations.test.mjs` |
| M | `standalone/tests/production-rollout.test.mjs` |

## Exact remaining differences and limits

1. Main contains schema-4 class skills/lore/admin-avatar source and the phone fix;
   production stays welcome frontend / f05 backend on schema 3. Neither this PR nor
   successful CI deploys them. The public manifest and actual server match the
   production identities in PROJECT_STATE.md.
2. Original CANDY worktrees intentionally retain their existing branch tips and
   historical changes. Their source is preserved, not reset to main. All nine
   HEADs and prior source hashes remained unchanged at the October 29 refresh.
3. Historical CSS/component backups, references, commerce draft and audit helpers
   are recoverable non-runtime payloads. They do not replace current accounts,
   mail or storefront implementations. The archive is not a complete Base44 export.
4. The inaccessible managed `/workspace` environment cannot be certified; its
   unpublished contents remain unknown. All identified accessible CANDY source
   was inventoried and preserved. Protected configuration, private Git stores,
   databases/customer data and generated output remain outside GitHub.
5. Schema-3-to-4 production-data rehearsal and a schema-compatible fallback remain
   future deployment gates. Preserve subsequent writes. Full rollout does not
   automatically carry old hashed assets; retain/verify them in the new dist
   before activation as documented in DEPLOYMENT_RECOVERY.md.
6. Real catalog/inventory, checkout/payments/shipping/fulfillment, physical gear
   redemption and XP-priced additional abilities remain incomplete. PostgreSQL,
   profiles and saved addresses remain separate work. Mocked tests and successful
   HTTP/mail-timer checks do not establish commerce or fresh inbox readiness.
7. PR #2 is closed unmerged and #6 closed/merged through the prior reconciliation;
   no duplicate feature merge is required. The new recovery/documentation PR
   remains for review. Production deployment is outside this task's authorization.

## Workspace Relay handoff

The October 29 follow-ups enroll the existing clean CANDY development checkout
and maintain [a shared handoff](docs/workspace/HANDOFF.md). Fresh activation-time
fetch confirmed upstream `648bd81c04bd8e5c1c2e0e7c62b16b202be8e730` and main
`2d708248`; no repair was required. Following explicit owner authorization,
`eldritch-workspace-relay.service` now runs the helper every 300 seconds as
`sentinelx`, independently of this chat and enabled at boot. Its effective unit
is a root-owned copy, not linked to writable staging. First-cycle fresh fetching
and editing-lease pause behavior were verified. Session metadata stays private;
no production/release worktree is enrolled. Stop/disable commands and limitations
are in the shared handoff. The helper comes from the explicitly invoked Workspace
Relay plugin; application code is unchanged.

## Exact files in this recovery/documentation PR

The list below is relative to main `2d708248`. Historical payload paths encode the
original basename and immutable content identity; manifest.json maps every original
snapshot path and mode. Runtime files, lockfiles, artwork and CI workflow have no
changes. `SOURCE_RECONCILIATION.md` is included in its own list without a self hash.

| Status | Path |
| --- | --- |
| A | `DEPLOYMENT_RECOVERY.md` |
| M | `MIGRATION.md` |
| M | `PROJECT_STATE.md` |
| M | `README.md` |
| A | `SOURCE_RECONCILIATION.md` |
| A | `docs/workspace/HANDOFF.md` |
| M | `recovery/README.md` |
| A | `recovery/candy-20261028/README.md` |
| A | `recovery/candy-20261028/blobs/03687e2c3730019318916140fe700b8c4a5d0e64--Storefront.jsx` |
| A | `recovery/candy-20261028/blobs/043d1cbeafa9e688e1c9afcb0bedb57f7a6a9bda--public-audit.generic-20261026.mjs` |
| A | `recovery/candy-20261028/blobs/0590d035d9b862d3d7716f5b8ef7bd1b83f3522e--Storefront.jsx` |
| A | `recovery/candy-20261028/blobs/05c0b651df62a9b43936200679fd29e06ca1583f--Storefront.jsx` |
| A | `recovery/candy-20261028/blobs/0606b2da7079131d5bc7de232a9416050c91efa1--Storefront.jsx` |
| A | `recovery/candy-20261028/blobs/0991041a31ace89735b36c6b50e820e3ae7e00c9--Storefront.jsx` |
| A | `recovery/candy-20261028/blobs/0a403c5a18587983a90789f075f9d092ce829e3e--Storefront.jsx` |
| A | `recovery/candy-20261028/blobs/0b12d4a37c843357fc3fa3bb6251f57ac4c7dd97--Storefront.jsx` |
| A | `recovery/candy-20261028/blobs/0babc7a9fc03a73aed1956247d01a1172682c7ca--storefront.css` |
| A | `recovery/candy-20261028/blobs/13251fc4d2d07bdaed9bf12ca0e0f1d25b0f1966--storefront.css` |
| A | `recovery/candy-20261028/blobs/15dc50b5e6cb2cbe0a4ec8976943a561d3d24698--hollow-king-public-smoke.mjs` |
| A | `recovery/candy-20261028/blobs/1a9578f45b454fa560d618f4ddb7e221e43f295f--Storefront.jsx` |
| A | `recovery/candy-20261028/blobs/1cc47689bcff9b3300d94eb8ffc43233d4b4d511--storefront.css` |
| A | `recovery/candy-20261028/blobs/1d4e20293d4de9c4b49ad2556f99446423d1dba1--Storefront.jsx` |
| A | `recovery/candy-20261028/blobs/224fcaedd1e7cbb1cd0482d6663d601955abac25--Storefront.jsx` |
| A | `recovery/candy-20261028/blobs/25fe25cc5a3cc0dd620d1318eac62f3dec8e8282--Storefront.jsx` |
| A | `recovery/candy-20261028/blobs/2659039201b967a590e1a1a2091c63fa63c05077--storefront.css` |
| A | `recovery/candy-20261028/blobs/26a262f803a36704cd88ad8a3b5532d7e2a81478--storefront.css` |
| A | `recovery/candy-20261028/blobs/287226be2f30d6bc36bbc75241344e489b717f28--tavern.spec.mjs` |
| A | `recovery/candy-20261028/blobs/356006d17ae2ccadef54c09d5a10da8f4c902e36--Storefront.jsx` |
| A | `recovery/candy-20261028/blobs/3cdcafdeb89c14aff4a54c9077c84045d359cf1b--storefront.css` |
| A | `recovery/candy-20261028/blobs/41b9580293e924a7e8e06790df88c890ff545a05--Storefront.jsx` |
| A | `recovery/candy-20261028/blobs/4470a34305812ee987572c237552e8f2a8e2f6dc--Storefront.jsx` |
| A | `recovery/candy-20261028/blobs/45870b57abb552f3e291d4c2af83c01c1c50ea48--gitignore` |
| A | `recovery/candy-20261028/blobs/46c3f3488b3e02d5c2e894e051cd0dc59d5b599b--Storefront.jsx` |
| A | `recovery/candy-20261028/blobs/4ab175929ba1474e2873014bffd6b6548f8f4dd7--Storefront.jsx` |
| A | `recovery/candy-20261028/blobs/519df39f2fd8a801118a757f4058926b13f489c6--Storefront.jsx` |
| A | `recovery/candy-20261028/blobs/57b59ae7fede9362c79b5ec5b7828b48ca92afaa--Storefront.jsx` |
| A | `recovery/candy-20261028/blobs/58651aa8d96b4ebffd7febced2a879404538c085--Storefront.jsx` |
| A | `recovery/candy-20261028/blobs/5cdbd4255b6acc90562e1f1b07cafccab1bdae01--audit.md` |
| A | `recovery/candy-20261028/blobs/5f1bf428dfd8f8448c072d3dc0c37351b92a3821--blueprint-reference.png` |
| A | `recovery/candy-20261028/blobs/5f7e2f94a4110ee741c942ca4873af3609ec0627--public-runtime.mjs` |
| A | `recovery/candy-20261028/blobs/6b5e56c3803d6f3590a16bc9d03585ead8ca5e1a--Storefront.jsx` |
| A | `recovery/candy-20261028/blobs/711c0fe4304f19601caaaa1946b0b7c420a764e5--storefront.css` |
| A | `recovery/candy-20261028/blobs/735e07ecea75b42ae008679924b0c03164e067b3--Storefront.jsx` |
| A | `recovery/candy-20261028/blobs/7b8a22c91ab13080af931136a40db0e6d421b979--prepare-adventure-welcome.py` |
| A | `recovery/candy-20261028/blobs/870df48bd2944676d6730afc105e9880a996b46b--Storefront.jsx` |
| A | `recovery/candy-20261028/blobs/8d2ee6f27c87dcc1cba837aa5f1bfda4ae24c4b4--Storefront.jsx` |
| A | `recovery/candy-20261028/blobs/8d61e6bacacccf111c2c23f2ebf553b02784ff22--storefront.css` |
| A | `recovery/candy-20261028/blobs/8e10fa2f4375be6323b599bc771895072519ec74--Storefront.jsx` |
| A | `recovery/candy-20261028/blobs/8e3cf53a1eba5b9daf62ea9458362f832ef02fba--Storefront.jsx` |
| A | `recovery/candy-20261028/blobs/8fcfe5c0b83b4eff76f3a213f17a88700f8119d6--rpg-public-smoke-20261027.mjs` |
| A | `recovery/candy-20261028/blobs/979795137130d59e0016d4b668d80d41e80ad7c0--storefront.css` |
| A | `recovery/candy-20261028/blobs/a3215dc4117d911cc5904199506550717b56fd3f--001-commerce-draft.sql` |
| A | `recovery/candy-20261028/blobs/a7421a5b4fbf97448406b2107e68b246a4efebf0--storefront.css` |
| A | `recovery/candy-20261028/blobs/a94105a695537530e8dd272e9635612ff458a7ad--Storefront.jsx` |
| A | `recovery/candy-20261028/blobs/ac1f61118868d4143a9f4f930672aa5f843f0259--Storefront.jsx` |
| A | `recovery/candy-20261028/blobs/ac30321970a21e0f3d75981aa699291284c19b7a--approved-reference-20261022.png` |
| A | `recovery/candy-20261028/blobs/b049345cfa9d743b3048560513a5c82a89f0818a--Storefront.jsx` |
| A | `recovery/candy-20261028/blobs/b08603177b8fbc13faaedc8d7dd0161b9702ab93--Storefront.jsx` |
| A | `recovery/candy-20261028/blobs/b4a34832f739995f4a9a2cb50de99938470ef0be--Storefront.jsx` |
| A | `recovery/candy-20261028/blobs/b65908fe41fa0787adc52e2b488f9b8aeef98d14--Storefront.jsx` |
| A | `recovery/candy-20261028/blobs/b7bbf51fff18fd566ccef9e59401168a5469d2d4--Storefront.jsx` |
| A | `recovery/candy-20261028/blobs/b7f6d230b12d126497c4a837177c48e1c5d14196--storefront.css` |
| A | `recovery/candy-20261028/blobs/c99b99a1e0163cbddb61d2431616d8d5a49417c3--Storefront.jsx` |
| A | `recovery/candy-20261028/blobs/c9cfdd7a5efa1dc450eb9b84f46cf53e60dab083--storefront.css` |
| A | `recovery/candy-20261028/blobs/ccd9204efc174228c9f54c2a2b6ad8a33e105baf--Storefront.jsx` |
| A | `recovery/candy-20261028/blobs/ce1b93023d3db054fbdda2a34cd05caecc2267d2--Storefront.jsx` |
| A | `recovery/candy-20261028/blobs/cfd8462ef0caa845f62e37489747d31a743b4458--storefront.css` |
| A | `recovery/candy-20261028/blobs/d1368b73623835ca6f8c2645aebffaf7b3ab5ca2--Storefront.jsx` |
| A | `recovery/candy-20261028/blobs/d7e30b14193bede2121f4b3daecd55d269184134--Storefront.jsx` |
| A | `recovery/candy-20261028/blobs/dd0225aaa2ef0fd1ab489d8962f8c01c6085be87--Storefront.jsx` |
| A | `recovery/candy-20261028/blobs/e1cf8a353b0a9b60fe5b14cb4078cde745b89c59--public-audit.mjs` |
| A | `recovery/candy-20261028/blobs/e4022148c44101a13f488e94d05684ad7c663dd3--Storefront.jsx` |
| A | `recovery/candy-20261028/blobs/e69de29bb2d1d6434b8b29ae775ad8c2e48c5391--gitignore` |
| A | `recovery/candy-20261028/blobs/e97ecd4ed1d152a443fb8d6112a91c1ec3609313--adventure-welcome-public-smoke.mjs` |
| A | `recovery/candy-20261028/blobs/ea12738b12170755a87ba6eff0de075f014d10e4--Storefront.jsx` |
| A | `recovery/candy-20261028/blobs/ec3ccd5fc70c7b089a831064d48e36275ef825d1--TAVERN.md` |
| A | `recovery/candy-20261028/blobs/f17034dd9bc8ced9541a31d1e274ce508d0a85f7--public-runtime.mjs` |
| A | `recovery/candy-20261028/blobs/f29388017dedab50da47678aca5da5c09a0e8242--Storefront.jsx` |
| A | `recovery/candy-20261028/blobs/f3cf565f7f38ba99c2e0a003dc3ae979ba972a39--Storefront.jsx` |
| A | `recovery/candy-20261028/blobs/f6a0cff70ed296cbb940b802028a5ebe9e593b40--package-lock.json` |
| A | `recovery/candy-20261028/blobs/f73c65c13af41d5b1b785241fc50f50749546ee7--Storefront.jsx` |
| A | `recovery/candy-20261028/blobs/fd784cd6a41f7400ce3a9ae9d3678e67e7be2ac2--storefront.css` |
| A | `recovery/candy-20261028/manifest.json` |
| A | `recovery/candy-20261028/restore-snapshot.py` |
| A | `recovery/candy-20261028/validation.json` |
| M | `standalone/ADVENTURE.md` |
| M | `standalone/DEPLOYMENT.md` |
| M | `standalone/TAVERN.md` |

88 files changed. See the PR Files view for exact line changes and
[recovery validation](recovery/candy-20261028/validation.json) for archive checks.
