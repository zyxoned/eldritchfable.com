import { newsletterRoute } from './newsletter.mjs';
import { authRoute } from './auth.mjs';
import { createServer } from 'node:http';
import { DatabaseSync } from 'node:sqlite';

const port = Number(process.env.PORT || 3000);
const databasePath = process.env.ELDRITCH_DB;
if (!databasePath) throw new Error('ELDRITCH_DB is required');
const db = new DatabaseSync(databasePath, { readOnly: false });

function reply(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  res.end(payload);
}
function catalog() {
  // Independent read model. Tables must be provisioned by reviewed migrations.
  const collections = db.prepare('SELECT slug, name, icon, sort_order FROM storefront_collections ORDER BY sort_order, slug').all();
  const records = db.prepare('SELECT id, slug, name, category, description, details_json, specifications_json, variants_json, art FROM storefront_products WHERE published = 1 ORDER BY sort_order, slug').all();
  const products = records.map(({ details_json, specifications_json, variants_json, ...record }) => ({
    ...record,
    details: JSON.parse(details_json),
    specifications: JSON.parse(specifications_json),
    variants: JSON.parse(variants_json)
  }));
  return { products, collections };
}
const server = createServer(async (req, res) => {
  const path = new URL(req.url, 'http://localhost').pathname;
  try { if (await authRoute(db, req, res, path)) return;
    if (await newsletterRoute(db, req, res, path)) return; }
  catch (error) { console.error('Auth failure:', error.message); return reply(res, 500, { error: 'Request failed' }); }
  if (req.method !== 'GET') return reply(res, 405, { error: 'Method not allowed' });
  if (path === '/api/health') return reply(res, 200, { status: 'online', application: 'Eldritch Fable independent API' });
  if (path !== '/api/catalog') return reply(res, 404, { error: 'Not found' });
  try { return reply(res, 200, catalog()); }
  catch (error) {
    console.error('Catalog query failed:', error.message);
    return reply(res, 503, { error: 'Catalog unavailable' });
  }
});
server.listen(port, '127.0.0.1', () => console.log('Eldritch API listening on localhost:' + port));
