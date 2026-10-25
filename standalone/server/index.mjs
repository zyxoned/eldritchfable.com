import { newsletterRoute } from './newsletter.mjs';
import { authRoute } from './auth.mjs';
import { createGameService } from './game.mjs';
import { createServer } from 'node:http';
import { openDatabase, requireSchema } from './database.mjs';
import { validateOrigin } from './request-security.mjs';

const port = Number(process.env.PORT || 3000);
const databasePath = process.env.ELDRITCH_DB;
if (!databasePath) throw new Error('ELDRITCH_DB is required');
const db = openDatabase(databasePath);
requireSchema(db);
validateOrigin(process.env.ELDRITCH_ORIGIN);
const game = createGameService(db);

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
    if (await newsletterRoute(db, req, res, path)) return;
    if (await game.route(req, res, path)) return; }
  catch { console.error('Account request failed'); return reply(res, 500, { error: 'Request failed. Please try again.' }); }
  if (req.method !== 'GET') return reply(res, 405, { error: 'Method not allowed' });
  if (path === '/api/health') return reply(res, 200, { status: 'online', application: 'Eldritch Fable independent API' });
  if (path !== '/api/catalog') return reply(res, 404, { error: 'Not found' });
  try { return reply(res, 200, catalog()); }
  catch (error) {
    console.error('Catalog query failed:', error.message);
    return reply(res, 503, { error: 'Catalog unavailable' });
  }
});
server.requestTimeout = 30000;
server.headersTimeout = 10000;
server.listen(port, '127.0.0.1', () => console.log('Eldritch API listening on localhost:' + server.address().port));
for (const signal of ['SIGTERM','SIGINT']) process.on(signal, () => {
  game.close();
  server.close(() => { db.close(); process.exit(0); });
});
