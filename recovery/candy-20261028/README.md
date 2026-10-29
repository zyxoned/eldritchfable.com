# Candy source history — 2026-10-28

This directory preserves unique historical Eldritch Fable source without duplicating content already reachable from the repository branches recorded in `manifest.json`. It is archival material; the maintained React/Vite application remains in `standalone/`. These historical snapshots must not be deployed as releases.

## Manifest format

`comparisonRefs` records the immutable GitHub branch heads used for deduplication. `sources` identifies each preserved snapshot and maps every retained original relative filename (including backup filenames) to a content identity and its original regular-file permission mode. `contents` records each unique Git blob, SHA-256 and byte count. Its storage is either an immutable existing commit/path or one exact copy under `blobs/`. Multiple filenames can refer to the same bytes.

The Git SHA-1 identifies the exact Git blob, including its header; SHA-256 independently verifies the file bytes. Historical copy filenames are content-addressed and descriptive. The original directory layout is recovered through the manifest, not through those filenames. Environment files, credentials, databases, dependencies, generated builds, publication payloads and Git object stores are excluded. The conservative filename filter also excludes `.env.example`; the maintained template remains in the normal repository. No live customer data or production settings belong here.

## Optional source reconstruction

The helper performs no work unless explicitly run. From the repository root, list snapshot IDs:

```sh
python3 recovery/candy-20261028/restore-snapshot.py --list
```

Restore, for example, the original prototype to a destination that does not already exist:

```sh
python3 recovery/candy-20261028/restore-snapshot.py 07-tavern-working-copy /tmp/eldritch-prototype-history
```

Use `--repository /absolute/path/to/repo` if the helper is stored outside its repository. It reads exact immutable existing objects with `git cat-file blob`; it does not fetch or change Git state. Every source path, file mode, SHA-256 and Git blob identity is checked before creating the destination. The helper refuses existing destinations, path traversal, production/runtime directories and locations inside existing Git worktrees. It then writes only the new private directory and verifies every restored file and permission mode. A filesystem failure can leave that new directory partial; it does not modify original sources or production. It never executes restored code.

`historical-audit-report` preserves a dated 2026-10-26 audit as historical evidence. Its status claims are superseded by the current root PROJECT_STATE.md and must not be used as current runtime evidence. `historical-audit-helpers` contains source only; none of these scripts were executed during preservation.

Private source archives, verified history bundles, Git object-store snapshots and generated publication records are retained separately by the operator. They are not part of this GitHub preservation directory.
