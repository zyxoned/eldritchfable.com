import { createHmac, timingSafeEqual } from 'node:crypto';

export function fail(status, message) {
  throw Object.assign(new Error(message), { status });
}

export function ottoClient(key, request = fetch) {
  return async (path, body, idempotencyKey) => {
    if (!key) fail(503, 'OTTO is awaiting its business API key.');
    const headers = { Authorization: 'Bearer ' + key, Accept: 'application/json' };
    if (body) headers['Content-Type'] = 'application/json';
    if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
    const response = await request('https://api.ottomfg.com/api/v1' + path, {
      method: body ? 'POST' : 'GET', headers, redirect: 'error',
      body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(20000)
    });
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) fail(503, 'OTTO access or API permissions need attention.');
      if (response.status === 422 || response.status === 400) fail(422, 'OTTO could not accept these details. Check the file, print size or shipping address.');
      fail(502, 'OTTO could not complete this request. Try again with the same selection.');
    }
    return response.json();
  };
}

export function verifyOtto(headers, body, secret, now = Date.now()) {
  if (!secret?.startsWith('whsec_')) return false;
  const header = name => headers['webhook-' + name] ?? headers['svix-' + name];
  const id = header('id'), time = header('timestamp'), signatures = header('signature');
  if (!id || !/^\d{1,12}$/.test(time) || typeof signatures !== 'string' ||
      Math.abs(now / 1000 - Number(time)) > 300) return false;
  const key = Buffer.from(secret.slice(6), 'base64');
  if (!key.length) return false;
  const mac = createHmac('sha256', key).update(id + '.' + time + '.').update(body).digest();
  return signatures.split(/\s+/).some(value => {
    if (!value.startsWith('v1,')) return false;
    const provided = Buffer.from(value.slice(3), 'base64');
    return provided.length === mac.length && timingSafeEqual(mac, provided);
  });
}

export function initialize(db) {
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS models(id TEXT PRIMARY KEY, owner TEXT, name TEXT NOT NULL, mm REAL NOT NULL,
      retail INTEGER, published INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS uploads(id TEXT PRIMARY KEY, owner TEXT NOT NULL, created INTEGER NOT NULL,
      filename TEXT NOT NULL, bytes INTEGER NOT NULL, name TEXT NOT NULL, mm REAL NOT NULL, file_id TEXT, model_id TEXT);
    CREATE TABLE IF NOT EXISTS quotes(id TEXT PRIMARY KEY, owner TEXT NOT NULL, model TEXT NOT NULL, name TEXT NOT NULL,
      expires INTEGER NOT NULL, retail INTEGER NOT NULL, options TEXT NOT NULL, address TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS orders(id TEXT PRIMARY KEY, owner TEXT NOT NULL, quote TEXT NOT NULL UNIQUE,
      option TEXT NOT NULL, name TEXT NOT NULL, retail INTEGER NOT NULL, shipping INTEGER NOT NULL,
      supplier INTEGER NOT NULL, created INTEGER NOT NULL, otto_id TEXT UNIQUE, checkout TEXT UNIQUE,
      checkout_url TEXT, intent TEXT, state TEXT NOT NULL DEFAULT 'pending', hold INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS events(id TEXT PRIMARY KEY, type TEXT NOT NULL, object TEXT NOT NULL, received INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS snapshots(object TEXT PRIMARY KEY, seq INTEGER NOT NULL, status TEXT, payment TEXT);
    CREATE TABLE IF NOT EXISTS settings(name TEXT PRIMARY KEY, value INTEGER);
    CREATE INDEX IF NOT EXISTS uploads_by_owner ON uploads(owner,created);
    CREATE INDEX IF NOT EXISTS orders_by_intent ON orders(intent);`);
}

export function receiveOtto(db, event) {
  const {id,type,data} = event ?? {};
  if (typeof id !== 'string' || id.length > 200 || !id || typeof type !== 'string' || type.length > 100) fail(400,'Invalid event.');
  const object = typeof data?.id === 'string' ? data.id : '';
  const seq = data?.object === 'order' ? data.sequence : Date.parse(data?.updated_at);
  db.exec('BEGIN IMMEDIATE');
  try {
    const added = db.prepare('INSERT OR IGNORE INTO events VALUES(?,?,?,?)').run('otto:'+id,type,object,Date.now()).changes;
    if (added && object && ['order','model'].includes(data?.object) && Number.isSafeInteger(seq) && seq >= 0) {
      const changed=db.prepare(`INSERT INTO snapshots VALUES(?,?,?,?) ON CONFLICT(object) DO UPDATE SET
        seq=excluded.seq,status=excluded.status,payment=excluded.payment WHERE excluded.seq>snapshots.seq`)
        .run(object,seq,String(data.status || ''),String(data.payment?.status || '')).changes;
      if(changed && data.object==='order'){
        const payment=data.payment?.status;
        if(['failed','requires_action','refunded','refund_pending','cancelled'].includes(payment) || ['on_hold','cancelled','expired'].includes(data.status))
          db.prepare("UPDATE orders SET state='review',hold=1 WHERE otto_id=? AND intent IS NOT NULL").run(object);
        else if(['paid','on_account'].includes(payment))
          db.prepare("UPDATE orders SET state='submitted' WHERE otto_id=? AND intent IS NOT NULL AND hold=0").run(object);
      }
    }
    db.exec('COMMIT');
  } catch (error) { db.exec('ROLLBACK'); throw error; }
}

export function eligible(model) {
  return model?.status === 'ready' && model.print_check?.result?.decision === 'printable';
}
