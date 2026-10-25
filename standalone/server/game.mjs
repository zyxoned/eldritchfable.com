import { randomUUID } from 'node:crypto';
import { digest, transaction } from './database.mjs';
import { sessionUser } from './auth.mjs';
import { reply, readJson, sameOriginJson } from './request-security.mjs';
import {
  CLASSES, CRYSTALS, LEASE_MS, SHRINE, SPAWN, distance, walkable,
} from './game-rules.mjs';

class GameError extends Error {
  constructor(message, status = 400, code = 'INVALID_ACTION') {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function publicCharacter(row) {
  return {
    id: row.id,
    name: row.name,
    heroClass: row.hero_class,
    x: row.x,
    y: row.y,
    hp: row.hp,
    xp: row.lifetime_xp || 0,
    gold: 0,
    kills: row.kills,
    gathered: JSON.parse(row.gathered_json),
    shrine: Boolean(row.shrine),
    claimed: Boolean(row.claimed),
  };
}

export function createGameService(db, options = {}) {
  const now = options.now || Date.now;
  const streams = new Set();
  const streamInterval = options.sseIntervalMs || 15000;
  let closed = false;

  function requireUser(req, time) {
    const user = sessionUser(db, req, time);
    if (!user) throw new GameError('Sign in to your Eldritch Fable account to play.', 401, 'SIGN_IN_REQUIRED');
    return user;
  }

  function loadWorld() {
    const row = db.prepare('SELECT * FROM game_world WHERE id=1').get();
    if (!row) throw new GameError('The realm needs a database migration before it can open.', 503, 'REALM_UNAVAILABLE');
    return {
      revision: row.revision,
      enemies: JSON.parse(row.enemies_json),
      messages: JSON.parse(row.messages_json),
    };
  }

  function saveWorld(world) {
    db.prepare('UPDATE game_world SET revision=?,enemies_json=?,messages_json=? WHERE id=1')
      .run(world.revision, JSON.stringify(world.enemies), JSON.stringify(world.messages.slice(-30)));
  }

  function systemMessage(world, text, time) {
    world.messages.push({
      id: randomUUID(),
      name: 'The glade',
      text,
      time,
      system: true,
    });
    world.messages = world.messages.slice(-30);
  }

  function expireAndRespawn(world, time) {
    let changed = false;
    const expiredCondition = 'active_until>0 AND (active_until<=? OR user_id IN '
      + '(SELECT id FROM account_users WHERE disabled_at IS NOT NULL OR email_verified_at IS NULL))';
    const expired = db.prepare('SELECT name FROM game_characters WHERE ' + expiredCondition).all(time);
    if (expired.length) {
      db.prepare('UPDATE game_characters SET active_until=0 WHERE ' + expiredCondition).run(time);
      for (const row of expired) systemMessage(world, row.name + ' returned to the everyday.', time);
      changed = true;
    }
    for (const enemy of world.enemies) {
      if (enemy.hp <= 0 && enemy.respawnAt <= time) {
        enemy.hp = 42;
        enemy.respawnAt = 0;
        enemy.spawnId = randomUUID();
        db.prepare('DELETE FROM game_damage WHERE enemy_id=?').run(enemy.id);
        changed = true;
      }
    }
    return changed;
  }

  function character(userId) {
    return db.prepare(
      'SELECT c.*,COALESCE(w.balance_xp,0) AS balance_xp,COALESCE(w.lifetime_xp,0) AS lifetime_xp '
      + 'FROM game_characters c LEFT JOIN game_wallets w ON w.user_id=c.user_id WHERE c.user_id=?',
    ).get(userId);
  }

  function realm(world, time) {
    const rows = db.prepare(
      'SELECT c.*,COALESCE(w.lifetime_xp,0) AS lifetime_xp '
      + 'FROM game_characters c JOIN account_users u ON u.id=c.user_id '
      + 'LEFT JOIN game_wallets w ON w.user_id=c.user_id '
      + 'WHERE c.active_until>? AND u.disabled_at IS NULL AND u.email_verified_at IS NOT NULL '
      + 'ORDER BY c.created_at,c.id LIMIT 6',
    ).all(time);
    return {
      revision: world.revision,
      players: rows.map(publicCharacter),
      enemies: world.enemies.map(({ id, x, y, hp, respawnAt }) => ({ id, x, y, hp, respawnAt })),
      messages: world.messages,
      serverTime: time,
    };
  }

  function profile(userId, time) {
    const row = character(userId);
    if (!row) return {
      playerId: null,
      character: null,
      active: false,
      balanceXp: 0,
      lifetimeXp: 0,
    };
    return {
      playerId: row.id,
      character: publicCharacter(row),
      active: row.active_until > time,
      balanceXp: row.balance_xp,
      lifetimeXp: row.lifetime_xp,
    };
  }

  function currentResult(world, userId, time, notice = '') {
    const own = profile(userId, time);
    return {
      realm: realm(world, time),
      profile: own,
      playerId: own.playerId,
      notice,
    };
  }

  function snapshot(req) {
    return transaction(db, () => {
      const time = now();
      const user = requireUser(req, time);
      const world = loadWorld();
      const changed = expireAndRespawn(world, time);
      if (changed) {
        world.revision += 1;
        saveWorld(world);
      }
      return { result: currentResult(world, user.id, time), changed };
    });
  }

  function credit(userId, amount, eventKey, reason, time) {
    const wallet = db.prepare('SELECT balance_xp FROM game_wallets WHERE user_id=?').get(userId);
    if (!wallet) throw Error('Character wallet is missing');
    const balanceAfter = wallet.balance_xp + amount;
    const inserted = db.prepare(
      'INSERT OR IGNORE INTO game_ledger(id,user_id,event_key,delta,balance_after,reason,created_at) VALUES(?,?,?,?,?,?,?)',
    ).run(randomUUID(), userId, eventKey, amount, balanceAfter, reason, new Date(time).toISOString());
    if (inserted.changes !== 1) return false;
    db.prepare('UPDATE game_wallets SET balance_xp=balance_xp+?,lifetime_xp=lifetime_xp+? WHERE user_id=?')
      .run(amount, amount, userId);
    return true;
  }

  function activeCharacter(userId, time) {
    const row = character(userId);
    if (!row || row.active_until <= time) {
      throw new GameError('Your seat expired. Enter the glade again; your character and stash are safe.', 409, 'SEAT_EXPIRED');
    }
    return row;
  }

  function renew(userId, time) {
    db.prepare('UPDATE game_characters SET active_until=? WHERE user_id=?').run(time + LEASE_MS, userId);
  }

  function join(userId, input, world, time) {
    const name = typeof input.name === 'string' ? input.name.trim() : '';
    if (!/^[a-zA-Z0-9 _-]{2,16}$/.test(name)) {
      throw new GameError('Use 2–16 letters, numbers, spaces, dashes or underscores for your name.');
    }
    if (!Object.hasOwn(CLASSES, input.heroClass)) throw new GameError('Choose a character class.');
    let row = character(userId);
    if (row?.active_until > time) {
      renew(userId, time);
      return 'Welcome back. Your seat and secret stash are safe.';
    }
    const occupied = db.prepare('SELECT COUNT(*) AS n FROM game_characters WHERE active_until>?').get(time).n;
    if (occupied >= 6) throw new GameError('The realm is full (6/6). Wait for an adventurer to leave.', 409, 'REALM_FULL');
    if (!row) {
      if (db.prepare('SELECT id FROM game_characters WHERE name=? COLLATE NOCASE').get(name)) {
        throw new GameError('That adventurer name is already in use. Choose another.');
      }
      db.prepare(
        'INSERT INTO game_characters(user_id,id,name,hero_class,x,y,active_until) VALUES(?,?,?,?,?,?,?)',
      ).run(userId, randomUUID(), name, input.heroClass, SPAWN.x, SPAWN.y, time + LEASE_MS);
      db.prepare('INSERT INTO game_wallets(user_id) VALUES(?)').run(userId);
      row = character(userId);
    } else {
      renew(userId, time);
    }
    systemMessage(world, row.name + ' arrived in the glade.', time);
    return 'Welcome, ' + row.name + '. Your adventure is saved to your account.';
  }

  function doAction(userId, input, world, time) {
    const p = activeCharacter(userId, time);
    if (input.kind === 'move') {
      const { x, y } = input;
      if (!walkable(x, y) || Math.abs(x - p.x) + Math.abs(y - p.y) !== 1) {
        throw new GameError('Move one tile at a time. Cross the brook using its wooden bridge.');
      }
      if (time - p.last_move_at < 160) throw new GameError('Move a little more slowly.', 429, 'MOVE_COOLDOWN');
      db.prepare('UPDATE game_characters SET x=?,y=?,last_move_at=? WHERE user_id=?').run(x, y, time, userId);
      return '';
    }
    if (input.kind === 'attack') {
      if (time - p.last_attack_at < 700) throw new GameError('Your weapon is recharging.', 429, 'ATTACK_COOLDOWN');
      const stats = CLASSES[p.hero_class];
      const targets = world.enemies
        .filter(e => e.hp > 0 && distance(p, e) <= stats.range)
        .sort((a, b) => distance(p, a) - distance(p, b));
      const enemy = targets[0];
      if (!enemy) throw new GameError('Move closer to a thornling to attack.');
      const damage = stats.damage + Math.floor(p.lifetime_xp / 100) * 2;
      enemy.hp = Math.max(0, enemy.hp - damage);
      db.prepare(
        'INSERT INTO game_damage(enemy_id,spawn_id,user_id,damage,damaged_at) VALUES(?,?,?,?,?) '
        + 'ON CONFLICT(enemy_id,spawn_id,user_id) DO UPDATE SET damage=damage+excluded.damage,damaged_at=excluded.damaged_at',
      ).run(enemy.id, enemy.spawnId, userId, damage, time);
      db.prepare('UPDATE game_characters SET last_attack_at=? WHERE user_id=?').run(time, userId);
      if (enemy.hp === 0) {
        enemy.respawnAt = time + 20000;
        const contributors = db.prepare(
          'SELECT d.user_id FROM game_damage d JOIN game_characters c ON c.user_id=d.user_id '
          + 'JOIN account_users u ON u.id=d.user_id '
          + 'WHERE d.enemy_id=? AND d.spawn_id=? AND d.damage>0 AND d.damaged_at>=? '
          + 'AND c.active_until>? AND u.disabled_at IS NULL AND u.email_verified_at IS NOT NULL',
        ).all(enemy.id, enemy.spawnId, time - 30000, time);
        for (const contributor of contributors) {
          const credited = credit(
            contributor.user_id, 15, 'kill:' + enemy.spawnId, 'Thornling defeated', time,
          );
          if (credited) db.prepare('UPDATE game_characters SET kills=kills+1 WHERE user_id=?').run(contributor.user_id);
        }
        db.prepare('DELETE FROM game_damage WHERE enemy_id=? AND spawn_id=?').run(enemy.id, enemy.spawnId);
        systemMessage(world, p.name + ' defeated a thornling. Its fellow guardians earned 15 XP.', time);
        return 'Thornling cleared! Contributors earned 15 XP for their secret stash.';
      }
      const hp = p.hp - 9;
      if (hp <= 0) {
        db.prepare('UPDATE game_characters SET hp=100,x=?,y=? WHERE user_id=?').run(SPAWN.x, SPAWN.y, userId);
        return 'The campfire restored you. Your XP and stash are safe.';
      }
      db.prepare('UPDATE game_characters SET hp=? WHERE user_id=?').run(hp, userId);
      return 'Hit! Thornling has ' + enemy.hp + ' health.';
    }
    if (input.kind === 'interact') {
      const gathered = JSON.parse(p.gathered_json);
      const crystal = CRYSTALS.find(c => distance(p, c) <= 1.6 && !gathered.includes(c.id));
      if (crystal) {
        gathered.push(crystal.id);
        credit(userId, 10, 'crystal:' + crystal.id, 'Moon crystal gathered', time);
        db.prepare('UPDATE game_characters SET gathered_json=? WHERE user_id=?').run(JSON.stringify(gathered), userId);
        return 'Moon crystal gathered! 10 XP added to your secret stash.';
      }
      if (distance(p, SHRINE) <= 2) {
        db.prepare('UPDATE game_characters SET shrine=1,hp=100 WHERE user_id=?').run(userId);
        return 'The old shrine blesses your journey. Health restored.';
      }
      if (distance(p, SPAWN) <= 2.5) {
        db.prepare('UPDATE game_characters SET hp=100 WHERE user_id=?').run(userId);
        return 'Rested at the campfire. Health restored.';
      }
      throw new GameError('Stand beside a new crystal, the shrine, or the campfire.');
    }
    if (input.kind === 'claim') {
      if (p.claimed) throw new GameError('You already claimed this adventure reward.');
      if (p.kills < 3 || JSON.parse(p.gathered_json).length < 2 || !p.shrine) {
        throw new GameError('Complete all three adventure objectives first.');
      }
      credit(userId, 100, 'quest:guardian-of-the-glade', 'Guardian of the Glade completed', time);
      db.prepare('UPDATE game_characters SET claimed=1 WHERE user_id=?').run(userId);
      systemMessage(world, p.name + ' completed Guardian of the Glade!', time);
      return 'Adventure complete! 100 XP added to your secret stash.';
    }
    if (input.kind === 'chat') {
      const text = typeof input.text === 'string' ? input.text.trim() : '';
      if (!text || text.length > 160 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(text)) {
        throw new GameError('Write a message of 1–160 printable characters.');
      }
      if (time - p.last_chat_at < 1000) throw new GameError('Give your party a moment between messages.', 429, 'CHAT_COOLDOWN');
      db.prepare('UPDATE game_characters SET last_chat_at=? WHERE user_id=?').run(time, userId);
      world.messages.push({ id: randomUUID(), name: p.name, text, time });
      world.messages = world.messages.slice(-30);
      return '';
    }
    throw new GameError('That ability or shop exchange is not available. No XP was spent.');
  }

  function mutate(req, path, input) {
    const requestId = input.requestId;
    if (typeof requestId !== 'string' || !/^[a-zA-Z0-9-]{16,80}$/.test(requestId)) {
      throw new GameError('Invalid request ID. Please try again.');
    }
    const payloadHash = digest(JSON.stringify({ path, input }));
    return transaction(db, () => {
      const time = now();
      const user = requireUser(req, time);
      const world = loadWorld();
      const changed = expireAndRespawn(world, time);
      const receipt = db.prepare(
        'SELECT payload_hash,notice FROM game_requests WHERE user_id=? AND request_id=?',
      ).get(user.id, requestId);
      if (receipt) {
        if (receipt.payload_hash !== payloadHash) {
          throw new GameError('This request ID was used for a different action.', 409, 'REQUEST_CONFLICT');
        }
        if (changed) { world.revision += 1; saveWorld(world); }
        return currentResult(world, user.id, time, receipt.notice);
      }
      let notice;
      if (path === '/api/game/join') {
        notice = join(user.id, input, world, time);
      } else if (path === '/api/game/leave') {
        const p = character(user.id);
        if (p?.active_until > time) {
          db.prepare('UPDATE game_characters SET active_until=0 WHERE user_id=?').run(user.id);
          systemMessage(world, p.name + ' left the glade.', time);
        }
        notice = 'Your seat is free. Your character and secret stash remain saved.';
      } else if (path === '/api/game/heartbeat') {
        activeCharacter(user.id, time);
        notice = '';
      } else {
        notice = doAction(user.id, input, world, time);
      }
      if (path !== '/api/game/leave') renew(user.id, time);
      world.revision += 1;
      saveWorld(world);
      db.prepare(
        'INSERT INTO game_requests(user_id,request_id,payload_hash,notice,created_at) VALUES(?,?,?,?,?)',
      ).run(user.id, requestId, payloadHash, notice, time);
      return currentResult(world, user.id, time, notice);
    });
  }

  function stash(userId) {
    const wallet = db.prepare('SELECT balance_xp,lifetime_xp FROM game_wallets WHERE user_id=?').get(userId);
    const history = db.prepare(
      'SELECT id,delta,balance_after AS balanceAfter,reason,created_at AS createdAt '
      + 'FROM game_ledger WHERE user_id=? ORDER BY created_at DESC,rowid DESC LIMIT 40',
    ).all(userId);
    return {
      balanceXp: wallet?.balance_xp || 0,
      lifetimeXp: wallet?.lifetime_xp || 0,
      history,
      exchange: { enabled: false, xpPerUnit: null, currency: null },
      abilities: [],
    };
  }

  function closeStream(stream, reason) {
    streams.delete(stream);
    try {
      if (reason) stream.res.write('event: session\ndata: ' + JSON.stringify({ reason }) + '\n\n');
      stream.res.end();
    } catch { /* A disconnected response needs no further work. */ }
  }

  function sendRealm(stream, current) {
    try {
      requireUser(stream.req, now());
      if (stream.res.destroyed || stream.res.writableEnded) return closeStream(stream);
      stream.res.write('event: realm\ndata: ' + JSON.stringify(current) + '\n\n');
    } catch (error) {
      closeStream(stream, error instanceof GameError ? 'SIGN_IN_REQUIRED' : 'REALM_UNAVAILABLE');
    }
  }

  function publish() {
    if (!streams.size || closed) return;
    try {
      const current = realm(loadWorld(), now());
      for (const stream of streams) sendRealm(stream, current);
    } catch {
      for (const stream of streams) closeStream(stream, 'REALM_UNAVAILABLE');
    }
  }

  const timer = setInterval(() => {
    if (!streams.size || closed) return;
    try {
      const time = now();
      let changed = false;
      transaction(db, () => {
        const world = loadWorld();
        changed = expireAndRespawn(world, time);
        if (changed) { world.revision += 1; saveWorld(world); }
      });
      if (changed) publish();
      for (const stream of streams) {
        try {
          requireUser(stream.req, time);
          stream.res.write('event: ping\ndata: ' + JSON.stringify({ serverTime: time }) + '\n\n');
        } catch { closeStream(stream, 'SIGN_IN_REQUIRED'); }
      }
    } catch {
      for (const stream of streams) closeStream(stream, 'REALM_UNAVAILABLE');
    }
  }, streamInterval);
  timer.unref?.();

  async function route(req, res, path) {
    if (!path.startsWith('/api/game/')) return false;
    if (closed) { reply(res, 503, { error: 'The realm is restarting.' }); return true; }
    try {
      const user = requireUser(req, now());
      if (req.method === 'GET' && path === '/api/game/events') {
        if (req.headers.origin && req.headers.origin !== (options.origin || process.env.ELDRITCH_ORIGIN)) {
          throw new GameError('Forbidden', 403, 'ORIGIN_REJECTED');
        }
        const ownStreams = [...streams].filter(stream => stream.userId === user.id);
        if (ownStreams.length >= 3) throw new GameError('Close another game tab before opening a live connection.', 429, 'TOO_MANY_CONNECTIONS');
        const current = snapshot(req);
        if (current.changed) publish();
        res.writeHead(200, {
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-store',
          Connection: 'keep-alive',
          'X-Accel-Buffering': 'no',
          'X-Content-Type-Options': 'nosniff',
        });
        const stream = { req, res, userId: user.id };
        streams.add(stream);
        res.on?.('close', () => streams.delete(stream));
        sendRealm(stream, current.result.realm);
        return true;
      }
      if (req.method === 'GET' && path === '/api/game/world') {
        const current = snapshot(req);
        if (current.changed) publish();
        reply(res, 200, current.result);
        return true;
      }
      if (req.method === 'GET' && path === '/api/game/stash') {
        reply(res, 200, { stash: stash(user.id) });
        return true;
      }
      const posts = ['/api/game/join', '/api/game/action', '/api/game/heartbeat', '/api/game/leave'];
      if (!posts.includes(path)) throw new GameError('Not found', 404, 'NOT_FOUND');
      if (req.method !== 'POST') throw new GameError('Method not allowed', 405, 'METHOD_NOT_ALLOWED');
      if (!sameOriginJson(req, options.origin)) throw new GameError('Forbidden', 403, 'ORIGIN_REJECTED');
      let input;
      try { input = await readJson(req, 4096); }
      catch (error) { throw new GameError('Invalid JSON object or request body.', error.status || 400, 'INVALID_REQUEST'); }
      const result = mutate(req, path, input);
      publish();
      reply(res, 200, result);
    } catch (error) {
      if (error instanceof GameError || error.status === 413) {
        reply(res, error.status, { error: error.message, code: error.code || 'INVALID_REQUEST' });
      } else if (error instanceof SyntaxError) {
        reply(res, 400, { error: 'Invalid JSON request.', code: 'INVALID_REQUEST' });
      } else {
        reply(res, 503, { error: 'The realm could not confirm that action. Reconnect before retrying; confirmed XP remains saved.', code: 'REALM_UNAVAILABLE' });
      }
    }
    return true;
  }

  return {
    route,
    close() {
      closed = true;
      clearInterval(timer);
      for (const stream of streams) closeStream(stream, 'REALM_RESTARTING');
    },
  };
}
