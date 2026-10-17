# Eldritch Fable standalone storefront

Independent React/Vite prototype migrated from the approved Base44 storefront. This branch is **not production-ready**.

Run `npm install` and `npm run build` inside `standalone/`.

Expected backend: `GET /api/catalog` returns `{ "products": [], "collections": [] }` with validated product and collection records. See the existing `src/lib/storefront-preview-core.js` for product requirements. No orders or payments are accepted by this prototype.

Missing work: migrate real catalog, independent auth and authorization, checkout and webhook verification, product imagery, HTTPS and deployment tests. Keep the production website untouched until these gates pass.
