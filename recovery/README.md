# Historical source snapshots

This directory preserves partial snapshots of the original storefront for reference. The maintained application is in [standalone](../standalone/README.md); it does not import or build this directory.

The archive is not a complete runnable project. For example, `src/main.jsx` imports `@/App.jsx`, but `src/App.jsx` is absent. Original artwork and a complete Base44 application export are also absent. The archived `package.json` describes historical dependencies, not the supported standalone runtime.

Keep these snapshots as historical evidence. Use the standalone application and its locked dependencies for development, testing, and deployment. Restoring missing historical files or artwork requires verified original sources; do not treat a successful standalone build as validation of this archive.

## Verified CANDY source preservation, October 29

The [CANDY archive](candy-20261028/README.md) preserves unique accessible historical source, prototype backups, reference images and operational helper scripts with hashes and safe reconstruction. It supplements this partial older archive; it is not a runnable release or a complete original Base44 export. See [current project state](../PROJECT_STATE.md).
