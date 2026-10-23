import { isIP } from 'node:net';
import { digest } from './database.mjs';

export function reply(res, status, body, headers = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...headers });
  res.end(JSON.stringify(body));
}
export function validateOrigin(value) {
  const url = new URL(value);
  const local = ['localhost','127.0.0.1','[::1]'].includes(url.hostname);
  if (url.origin !== value || url.username || url.password || (url.protocol !== 'https:' && !(local && url.protocol === 'http:'))) throw Error('ELDRITCH_ORIGIN must be an exact HTTPS origin (HTTP allowed on localhost only)');
  return value;
}
export function sameOriginJson(req, origin = process.env.ELDRITCH_ORIGIN) {
  return Boolean(origin && req.headers.origin === origin && req.headers['content-type']?.split(';')[0].trim().toLowerCase() === 'application/json');
}
export function clientAddress(req, trustProxy = process.env.ELDRITCH_TRUST_PROXY === 'loopback') {
  const peer = req.socket.remoteAddress || 'unknown';
  const loopback = ['127.0.0.1','::1','::ffff:127.0.0.1'].includes(peer);
  // Caddy must overwrite this single header. Never trust arbitrary X-Forwarded-For.
  const forwarded = req.headers['x-eldritch-client-ip'];
  const address = trustProxy && loopback && typeof forwarded === 'string' && isIP(forwarded) ? forwarded : peer;
  return address.startsWith('::ffff:') && isIP(address.slice(7)) === 4 ? address.slice(7) : address;
}
export class RateLimiter {
  constructor() { this.entries = new Map(); }
  blocked(key, maximum, now = Date.now()) {
    if (this.entries.size >= 10000) {
      for (const [id, entry] of this.entries) if (entry.until <= now) this.entries.delete(id);
      if (this.entries.size >= 10000) this.entries.delete(this.entries.keys().next().value);
    }
    const entry = this.entries.get(key);
    if (!entry || entry.until <= now) { this.entries.set(key, { count: 1, until: now + 15 * 60_000 }); return false; }
    return ++entry.count > maximum;
  }
}
const limiters = new WeakMap();
export function throttled(db, req, action, email, options = {}) {
  if (!limiters.has(db)) limiters.set(db, new RateLimiter());
  const limiter = limiters.get(db);
  const now = options.now ?? Date.now();
  const ipBlocked = limiter.blocked('ip:' + action + ':' + clientAddress(req, options.trustProxy), 30, now);
  const accountBlocked = action === 'login' && email ? limiter.blocked('account:login:' + digest(email), 8, now) : false;
  return ipBlocked || accountBlocked;
}
export async function readJson(req, maximum = 16384) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size <= maximum) chunks.push(buffer);
  }
  if (size > maximum) throw Object.assign(Error('Request too large'), { status: 413 });
  const value = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('Expected an object');
  return value;
}
export const normalizeEmail = value => typeof value === 'string' ? value.trim().toLowerCase() : '';
export const validEmail = value => value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
export const validToken = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
