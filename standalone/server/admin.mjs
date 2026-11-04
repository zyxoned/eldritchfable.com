import { randomUUID } from 'node:crypto';
import { sessionUser } from './auth.mjs';
import { digest, transaction } from './database.mjs';
import { reply, readJson, sameOriginJson } from './request-security.mjs';
import { PLAYER_CLASS_IDS } from '../shared/class-catalog.mjs';

export const MAX_TEST_BALANCE = Number.MAX_SAFE_INTEGER;
export const MAX_TEST_GRANT = 1_000_000_000;
export const MAX_TEST_EXCHANGE = 1_000_000;
const XP_PER_GOLD = 1250;
const COPPER_PER_GOLD = 1000;
const PROFILE_PATH = '/api/admin/profile';
const TEST_PATHS = new Set([
  '/api/admin/testing/grant', '/api/admin/testing/exchange', '/api/admin/testing/reset',
]);
const POST_FIELDS = {
  [PROFILE_PATH]: ['requestId', 'visitorName'],
  '/api/admin/testing/grant': ['requestId', 'currency', 'amount'],
  '/api/admin/testing/exchange': ['requestId', 'lots'],
  '/api/admin/testing/reset': ['requestId'],
};

class AdminError extends Error {
  constructor(message, status = 400, code = 'INVALID_REQUEST') {
    super(message); this.status = status; this.code = code;
  }
}
export function validVisitorName(value) {
  return typeof value === 'string' && /^[a-zA-Z0-9 _-]{2,16}$/.test(value)
    && value === value.trim();
}
export function adminSettings(db, userId) {
  const row = db.prepare('SELECT visitor_name,testing_enabled,test_xp,test_copper FROM admin_account_settings WHERE user_id=?').get(userId);
  return {
    visitorName: row?.visitor_name || 'The Unnamed',
    heroClass: 'death-knight',
    testingEnabled: row?.testing_enabled === 1,
    testXp: row?.test_xp || 0,
    testCopper: row?.test_copper || 0,
  };
}
export function appendAdminAudit(db, userId, action, detail, time = Date.now()) {
  db.prepare('INSERT INTO admin_audit(id,user_id,action,detail_json,created_at) VALUES(?,?,?,?,?)')
    .run(randomUUID(), userId, action, JSON.stringify(detail), new Date(time).toISOString());
}

export function createAdminService(db, options = {}) {
  const now = options.now || Date.now;
  function requireAdmin(req, time) {
    const user = sessionUser(db, req, time);
    if (!user) throw new AdminError('Sign in to your account.', 401, 'SIGN_IN_REQUIRED');
    if (user.role !== 'admin') throw new AdminError('Administrator access required.', 403, 'ADMIN_REQUIRED');
    return user;
  }
  function requireTesting(userId) {
    if (!adminSettings(db, userId).testingEnabled) {
      throw new AdminError('Test resources are not enabled for this administrator.', 403, 'TESTING_DISABLED');
    }
  }
  function audit(userId) {
    return db.prepare('SELECT id,action,detail_json,created_at FROM admin_audit WHERE user_id=? ORDER BY created_at DESC,rowid DESC LIMIT 40')
      .all(userId).map(row => ({
        id: row.id, action: row.action, createdAt: row.created_at, detail: JSON.parse(row.detail_json),
      }));
  }
  function overview(time) {
    const stamp = new Date(time).toISOString();
    const first = new Date(time); first.setUTCHours(0, 0, 0, 0); first.setUTCDate(first.getUTCDate() - 6);
    const firstDay = first.toISOString().slice(0, 10);
    const accounts = db.prepare('SELECT COUNT(*) AS n FROM account_users').get().n;
    const verifiedAccounts = db.prepare('SELECT COUNT(*) AS n FROM account_users WHERE disabled_at IS NULL AND email_verified_at IS NOT NULL').get().n;
    const activeSessions = db.prepare('SELECT COUNT(*) AS n FROM account_sessions s JOIN account_users u ON u.id=s.user_id WHERE s.revoked_at IS NULL AND s.expires_at>? AND u.disabled_at IS NULL AND u.email_verified_at IS NOT NULL').get(stamp).n;
    const activePlayers = db.prepare('SELECT COUNT(*) AS n FROM game_characters c JOIN account_users u ON u.id=c.user_id WHERE c.active_until>? AND u.disabled_at IS NULL AND u.email_verified_at IS NOT NULL').get(time).n;
    const activeParties = db.prepare('SELECT COUNT(DISTINCT c.party_id) AS n FROM game_characters c JOIN account_users u ON u.id=c.user_id WHERE c.active_until>? AND u.disabled_at IS NULL AND u.email_verified_at IS NOT NULL').get(time).n;
    const activeVisitors = db.prepare("SELECT COUNT(*) AS n FROM game_admin_characters c JOIN account_users u ON u.id=c.user_id JOIN account_sessions s ON s.token_hash=c.session_hash AND s.user_id=c.user_id WHERE c.active_until>? AND u.role='admin' AND u.disabled_at IS NULL AND u.email_verified_at IS NOT NULL AND s.revoked_at IS NULL AND s.expires_at>? AND EXISTS(SELECT 1 FROM game_characters p JOIN account_users pu ON pu.id=p.user_id WHERE p.party_id=c.party_id AND p.active_until>? AND pu.disabled_at IS NULL AND pu.email_verified_at IS NOT NULL)").get(time, stamp, time).n;
    const publishedProducts = db.prepare('SELECT COUNT(*) AS n FROM storefront_products WHERE published=1').get().n;
    const mail = { pending: 0, sent: 0, failed: 0, sending: 0, uncertain: 0 };
    for (const row of db.prepare('SELECT status,COUNT(*) AS n FROM email_outbox GROUP BY status').all()) {
      if (Object.hasOwn(mail, row.status)) mail[row.status] = row.n;
    }
    const signupRows = db.prepare('SELECT substr(created_at,1,10) AS date,COUNT(*) AS n FROM account_users WHERE substr(created_at,1,10)>=? GROUP BY date').all(firstDay);
    const xpRows = db.prepare("SELECT substr(created_at,1,10) AS date,COALESCE(SUM(delta),0) AS n FROM game_ledger WHERE currency='XP' AND delta>0 AND substr(created_at,1,10)>=? GROUP BY date").all(firstDay);
    const signup = new Map(signupRows.map(row => [row.date, row.n]));
    const xp = new Map(xpRows.map(row => [row.date, row.n]));
    const daily = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(first); date.setUTCDate(date.getUTCDate() + index);
      const key = date.toISOString().slice(0, 10);
      return { date: key, accounts: signup.get(key) || 0, xp: xp.get(key) || 0 };
    });
    const classRows = db.prepare('SELECT hero_class,COUNT(*) AS n FROM game_characters GROUP BY hero_class').all();
    const classes = PLAYER_CLASS_IDS.map(classId => ({ classId, count: classRows.find(row => row.hero_class === classId)?.n || 0 }));
    return {
      counts: { accounts, verifiedAccounts, activeSessions, activePlayers, activeVisitors, activeParties, publishedProducts },
      mail,
      economy: {
        xpAwarded7d: daily.reduce((sum, day) => sum + day.xp, 0),
        copperInWallets: db.prepare('SELECT COALESCE(SUM(balance_copper),0) AS n FROM game_wallets').get().n,
      },
      daily, classes,
    };
  }
  function validateInput(path, input) {
    const fields = POST_FIELDS[path];
    if (!input || Array.isArray(input) || typeof input !== 'object'
      || Object.keys(input).length !== fields.length
      || Object.keys(input).some(field => !fields.includes(field))) {
      throw new AdminError('Use the fields required by this administrator action.');
    }
    if (typeof input.requestId !== 'string' || !/^[a-zA-Z0-9-]{16,80}$/.test(input.requestId)) {
      throw new AdminError('Invalid request ID.');
    }
    if (path === PROFILE_PATH && !validVisitorName(input.visitorName)) {
      throw new AdminError('Use 2–16 letters, numbers, spaces, dashes or underscores for your visitor name.');
    }
    if (path === '/api/admin/testing/grant'
      && (!['XP', 'GOLD'].includes(input.currency) || !Number.isSafeInteger(input.amount)
        || input.amount < 1 || input.amount > MAX_TEST_GRANT)) {
      throw new AdminError('Choose XP or GOLD and a whole grant amount from 1 to 1,000,000,000.');
    }
    if (path === '/api/admin/testing/exchange'
      && (!Number.isSafeInteger(input.lots) || input.lots < 1 || input.lots > MAX_TEST_EXCHANGE)) {
      throw new AdminError('Choose a whole number from 1 to 1,000,000 gold.');
    }
  }
  function mutate(req, path, input) {
    return transaction(db, () => {
      const time = now(), user = requireAdmin(req, time);
      if (TEST_PATHS.has(path)) requireTesting(user.id);
      validateInput(path, input);
      const hash = digest(JSON.stringify({ path, input }));
      const old = db.prepare('SELECT payload_hash,notice,actor_scope FROM game_requests WHERE user_id=? AND request_id=?').get(user.id, input.requestId);
      if (old) {
        if (old.payload_hash !== hash || old.actor_scope !== 'admin') {
          throw new AdminError('This request ID was used for a different action.', 409, 'REQUEST_CONFLICT');
        }
        return { profile: adminSettings(db, user.id), notice: old.notice };
      }
      const profile = adminSettings(db, user.id);
      let action, detail, notice;
      const stamp = new Date(time).toISOString();
      if (path === PROFILE_PATH) {
        db.prepare('INSERT INTO admin_account_settings(user_id,visitor_name,updated_at) VALUES(?,?,?) ON CONFLICT(user_id) DO UPDATE SET visitor_name=excluded.visitor_name,updated_at=excluded.updated_at').run(user.id, input.visitorName, stamp);
        action = 'visitor_name'; detail = { visitorName: input.visitorName }; notice = 'Your visitor name was saved.';
      } else {
        let xp = profile.testXp, copper = profile.testCopper;
        if (path === '/api/admin/testing/grant') {
          const delta = input.amount * (input.currency === 'GOLD' ? COPPER_PER_GOLD : 1);
          const balance = input.currency === 'XP' ? xp : copper;
          if (!Number.isSafeInteger(delta) || balance > MAX_TEST_BALANCE - delta) {
            throw new AdminError('This grant would exceed the supported test balance.', 409, 'BALANCE_LIMIT');
          }
          if (input.currency === 'XP') xp += delta;
          else copper += delta;
          action = 'test_grant'; detail = { currency: input.currency, amount: input.amount };
          notice = 'Test resources added. Customer balances are unchanged.';
        } else if (path === '/api/admin/testing/exchange') {
          const cost = input.lots * XP_PER_GOLD, added = input.lots * COPPER_PER_GOLD;
          if (xp < cost) throw new AdminError('Add enough test XP before exchanging.', 409, 'INSUFFICIENT_TEST_XP');
          if (copper > MAX_TEST_BALANCE - added) throw new AdminError('This exchange would exceed the supported test balance.', 409, 'BALANCE_LIMIT');
          xp -= cost; copper += added;
          action = 'test_exchange'; detail = { lots: input.lots, xpSpent: cost, copperAdded: added };
          notice = 'Test XP exchanged at 1,250 XP per gold.';
        } else {
          xp = 0; copper = 0; action = 'test_reset'; detail = {};
          notice = 'Your test resources were reset. Customer balances are unchanged.';
        }
        db.prepare('UPDATE admin_account_settings SET test_xp=?,test_copper=?,updated_at=? WHERE user_id=?').run(xp, copper, stamp, user.id);
      }
      appendAdminAudit(db, user.id, action, detail, time);
      db.prepare('INSERT INTO game_requests(user_id,request_id,payload_hash,notice,created_at,actor_scope) VALUES(?,?,?,?,?,?)')
        .run(user.id, input.requestId, hash, notice, time, 'admin');
      return { profile: adminSettings(db, user.id), notice };
    });
  }
  async function route(req, res, path) {
    if (!path.startsWith('/api/admin/') || path === '/api/admin/status') return false;
    try {
      const time = now(), user = requireAdmin(req, time);
      if (path === '/api/admin/overview') {
        if (req.method !== 'GET') throw new AdminError('Method not allowed.', 405, 'METHOD_NOT_ALLOWED');
        const result = transaction(db, () => {
          requireAdmin(req, time);
          return { overview: overview(time), profile: adminSettings(db, user.id), audit: audit(user.id) };
        });
        reply(res, 200, result); return true;
      }
      if (!Object.hasOwn(POST_FIELDS, path)) throw new AdminError('Not found.', 404, 'NOT_FOUND');
      if (req.method !== 'POST') throw new AdminError('Method not allowed.', 405, 'METHOD_NOT_ALLOWED');
      if (!sameOriginJson(req, options.origin)) throw new AdminError('Forbidden.', 403, 'ORIGIN_REJECTED');
      let input;
      try { input = await readJson(req, 4096); }
      catch (error) { throw new AdminError('Invalid administrator request.', error.status || 400); }
      reply(res, 200, mutate(req, path, input));
    } catch (error) {
      if (error instanceof AdminError) reply(res, error.status, { error: error.message, code: error.code });
      else reply(res, 503, { error: 'Administrator tools are unavailable. Try again.', code: 'ADMIN_UNAVAILABLE' });
    }
    return true;
  }
  return { route };
}
