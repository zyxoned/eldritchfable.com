import { randomUUID } from 'node:crypto';
import { digest, transaction } from './database.mjs';
import { sessionUser } from './auth.mjs';
import { reply, readJson, sameOriginJson } from './request-security.mjs';
import { PLAYER_CLASS_IDS } from '../shared/class-catalog.mjs';
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
  const privileged = Boolean(row.is_admin);
  const definition = CLASSES[row.hero_class];
  return {
    id: row.id, name: row.name, heroClass: row.hero_class,
    race: privileged ? 'Draconian' : 'Wayfarer',
    levelLabel: privileged ? '???' : String(1 + Math.floor((row.lifetime_xp || 0) / 100)),
    hidden: privileged,
    equipment: definition.equipment,
    x: row.x, y: row.y, hp: row.hp,
    xp: privileged ? 0 : row.lifetime_xp || 0,
    gold: 0, kills: row.kills,
    gathered: JSON.parse(row.gathered_json),
    shrine: Boolean(row.shrine), claimed: Boolean(row.claimed),
    wardUntil: row.ward_until || 0, wardAmount: row.ward_amount || 0,
  };
}

export function createGameService(db, options = {}) {
  const now = options.now || Date.now;
  const streams = new Set();
  const streamInterval = options.sseIntervalMs || 15000;
  const XP_PER_GOLD = 1250;
  const COPPER_PER_GOLD = 1000;
  const MAX_BALANCE = Number.MAX_SAFE_INTEGER;
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
      effects: JSON.parse(row.effects_json),
    };
  }

  function saveWorld(world) {
    db.prepare('UPDATE game_world SET revision=?,enemies_json=?,messages_json=?,effects_json=? WHERE id=1')
      .run(world.revision, JSON.stringify(world.enemies), JSON.stringify(world.messages.slice(-30)), JSON.stringify(world.effects.slice(-24)));
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
    const removedAdmins = db.prepare(
      'UPDATE game_admin_characters SET active_until=0 WHERE active_until>0 AND (active_until<=? OR user_id IN '
      + "(SELECT id FROM account_users WHERE disabled_at IS NOT NULL OR email_verified_at IS NULL OR role!='admin') "
      + 'OR NOT EXISTS(SELECT 1 FROM account_sessions s WHERE s.token_hash=game_admin_characters.session_hash '
      + 'AND s.user_id=game_admin_characters.user_id AND s.revoked_at IS NULL AND s.expires_at>?))',
    ).run(time, new Date(time).toISOString());
    if (removedAdmins.changes) changed = true;
    world.effects = world.effects.filter(effect => effect.at + 1600 > time);
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
    const row = db.prepare(
      'SELECT c.*,COALESCE(w.balance_xp,0) AS balance_xp,COALESCE(w.lifetime_xp,0) AS lifetime_xp,COALESCE(w.balance_copper,0) AS balance_copper '
      + 'FROM game_characters c LEFT JOIN game_wallets w ON w.user_id=c.user_id WHERE c.user_id=?',
    ).get(userId);
    return row ? { ...row, is_admin: false } : null;
  }

  function adminCharacter(userId) {
    const row = db.prepare(
      "SELECT c.* FROM game_admin_characters c JOIN account_users u ON u.id=c.user_id "
      + 'JOIN account_sessions s ON s.token_hash=c.session_hash AND s.user_id=c.user_id '
      + "WHERE c.user_id=? AND u.role='admin' AND u.disabled_at IS NULL AND u.email_verified_at IS NOT NULL "
      + 'AND s.revoked_at IS NULL AND s.expires_at>?',
    ).get(userId, new Date(now()).toISOString());
    return row ? { ...row, is_admin: true } : null;
  }

  function tableFor(row) {
    return row.is_admin ? 'game_admin_characters' : 'game_characters';
  }

  function updateCharacter(row, fields, ...values) {
    db.prepare('UPDATE ' + tableFor(row) + ' SET ' + fields + ' WHERE user_id=?')
      .run(...values, row.user_id);
  }

  function realm(world, time) {
    const rows = db.prepare(
      'SELECT c.*,COALESCE(w.lifetime_xp,0) AS lifetime_xp '
      + 'FROM game_characters c JOIN account_users u ON u.id=c.user_id '
      + 'LEFT JOIN game_wallets w ON w.user_id=c.user_id '
      + 'WHERE c.active_until>? AND u.disabled_at IS NULL AND u.email_verified_at IS NOT NULL '
      + 'ORDER BY c.created_at,c.id LIMIT 6',
    ).all(time);
    const seventh = db.prepare(
      "SELECT c.* FROM game_admin_characters c JOIN account_users u ON u.id=c.user_id "
      + 'JOIN account_sessions s ON s.token_hash=c.session_hash AND s.user_id=c.user_id '
      + "WHERE c.active_until>? AND u.role='admin' AND u.disabled_at IS NULL AND u.email_verified_at IS NOT NULL "
      + 'AND s.revoked_at IS NULL AND s.expires_at>? ORDER BY c.created_at,c.id LIMIT 1',
    ).get(time, new Date(time).toISOString());
    return {
      revision: world.revision,
      players: rows.map(row => publicCharacter({ ...row, is_admin: false })),
      seventh: seventh ? publicCharacter({ ...seventh, is_admin: true }) : null,
      enemies: world.enemies.map(({ id, x, y, hp, respawnAt }) => ({ id, x, y, hp, respawnAt })),
      effects: world.effects.filter(effect => effect.at + 1600 > time).slice(-24),
      messages: world.messages, serverTime: time,
    };
  }

  function profile(userId, time) {
    const regular = character(userId);
    const admin = adminCharacter(userId);
    const adminActive = Boolean(admin && admin.active_until > time);
    const row = adminActive ? admin : regular;
    const wallet = db.prepare('SELECT * FROM game_wallets WHERE user_id=?').get(userId);
    const role = db.prepare('SELECT role FROM account_users WHERE id=?').get(userId)?.role;
    return {
      playerId: row?.id || null,
      character: row ? publicCharacter(row) : null,
      regularCharacter: regular ? publicCharacter(regular) : null,
      active: Boolean(row && row.active_until > time),
      adminAccess: role === 'admin',
      adminActive,
      cooldowns: row ? JSON.parse(row.skill_cooldowns_json) : {},
      balanceXp: wallet?.balance_xp || 0,
      lifetimeXp: wallet?.lifetime_xp || 0,
      balanceCopper: wallet?.balance_copper || 0,
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
    const wallet = db.prepare('SELECT balance_xp,lifetime_xp FROM game_wallets WHERE user_id=?').get(userId);
    if (!wallet) throw Error('Character wallet is missing');
    const balanceAfter = wallet.balance_xp + amount;
    if (!Number.isSafeInteger(balanceAfter) || !Number.isSafeInteger(wallet.lifetime_xp + amount)) {
      throw new GameError('Your XP balance reached its supported limit. Contact the shop before earning more.', 409, 'BALANCE_LIMIT');
    }
    const inserted = db.prepare(
      'INSERT OR IGNORE INTO game_ledger(id,user_id,event_key,delta,balance_after,reason,created_at) VALUES(?,?,?,?,?,?,?)',
    ).run(randomUUID(), userId, eventKey, amount, balanceAfter, reason, new Date(time).toISOString());
    if (inserted.changes !== 1) return false;
    db.prepare('UPDATE game_wallets SET balance_xp=balance_xp+?,lifetime_xp=lifetime_xp+? WHERE user_id=?')
      .run(amount, amount, userId);
    return true;
  }

  function activeCharacter(userId, time) {
    const admin = adminCharacter(userId);
    const row = admin?.active_until > time ? admin : character(userId);
    if (!row || row.active_until <= time) {
      throw new GameError('Your seat expired. Enter the glade again; your character and stash are safe.', 409, 'SEAT_EXPIRED');
    }
    return row;
  }

  function renew(userId, time) {
    const row = activeCharacter(userId, time);
    updateCharacter(row, 'active_until=?', time + LEASE_MS);
  }

  function requireAdmin(userId) {
    const user = db.prepare('SELECT role,email_verified_at,disabled_at FROM account_users WHERE id=?').get(userId);
    if (!user || user.role !== 'admin' || !user.email_verified_at || user.disabled_at) {
      throw new GameError('This passage is reserved for a verified site administrator.', 403, 'ADMIN_REQUIRED');
    }
  }

  function joinAdmin(userId, req, world, time) {
    requireAdmin(userId);
    const occupied = db.prepare(
      'SELECT COUNT(*) AS n FROM game_admin_characters WHERE active_until>? AND user_id<>?',
    ).get(time, userId).n;
    if (occupied) throw new GameError('The seventh presence is already in the realm.', 409, 'SEVENTH_OCCUPIED');
    const token = (req.headers.cookie || '').match(/(?:^|;\s*)ef_session=([a-f0-9]{64})(?:;|$)/)?.[1];
    // requireUser has already authenticated this cookie. Store only its digest.
    if (!token) throw new GameError('Sign in again before crossing the veil.', 401, 'SIGN_IN_REQUIRED');
    const sessionHash = digest(token);
    const row = db.prepare('SELECT * FROM game_admin_characters WHERE user_id=?').get(userId);
    if (!row) {
      db.prepare('INSERT INTO game_admin_characters(user_id,id,session_hash,active_until) VALUES(?,?,?,?)')
        .run(userId, randomUUID(), sessionHash, time + LEASE_MS);
    } else {
      updateCharacter({ ...row, is_admin: true }, 'session_hash=?,active_until=?', sessionHash, time + LEASE_MS);
    }
    // Entering the secret avatar never overwrites the account's normal hero or wallet.
    db.prepare('UPDATE game_characters SET active_until=0 WHERE user_id=?').run(userId);
    return 'The seventh shadow has crossed the veil.';
  }

  function leaveAdmin(userId) {
    requireAdmin(userId);
    db.prepare('UPDATE game_admin_characters SET active_until=0 WHERE user_id=?').run(userId);
    return 'Your secret presence has withdrawn. Your regular character is safe.';
  }

  function join(userId, input, world, time) {
    const name = typeof input.name === 'string' ? input.name.trim() : '';
    if (!/^[a-zA-Z0-9 _-]{2,16}$/.test(name)) {
      throw new GameError('Use 2–16 letters, numbers, spaces, dashes or underscores for your name.');
    }
    if (!PLAYER_CLASS_IDS.includes(input.heroClass)) throw new GameError('Choose a regular character class.');
    let row = character(userId);
    if (row?.active_until > time) {
      db.prepare('UPDATE game_admin_characters SET active_until=0 WHERE user_id=?').run(userId);
      updateCharacter(row, 'active_until=?', time + LEASE_MS);
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
      db.prepare('INSERT OR IGNORE INTO game_wallets(user_id) VALUES(?)').run(userId);
      row = character(userId);
    } else {
      updateCharacter(row, 'active_until=?', time + LEASE_MS);
    }
    db.prepare('UPDATE game_admin_characters SET active_until=0 WHERE user_id=?').run(userId);
    systemMessage(world, row.name + ' arrived in the glade.', time);
    return 'Welcome, ' + row.name + '. Your adventure is saved to your account.';
  }

  function effect(world, p, type, target, time, radius = 0) {
    world.effects.push({
      id: randomUUID(), type, x: target.x, y: target.y,
      color: CLASSES[p.hero_class].color, at: time, radius, actorId: p.id,
    });
    world.effects = world.effects.filter(value => value.at + 1600 > time).slice(-24);
  }

  function hurt(p, amount, time) {
    if (p.is_admin) return false;
    let damage = Math.max(0, amount - (CLASSES[p.hero_class].armor || 0));
    if (p.ward_until > time && p.ward_amount > 0) {
      const absorbed = Math.min(damage, p.ward_amount);
      damage -= absorbed;
      updateCharacter(p, 'ward_amount=?', p.ward_amount - absorbed);
    }
    if (!damage) return false;
    if (p.hp - damage <= 0) {
      updateCharacter(p, 'hp=100,x=?,y=?', SPAWN.x, SPAWN.y);
      return true;
    }
    updateCharacter(p, 'hp=?', p.hp - damage);
    return false;
  }

  function damageEnemy(p, enemy, damage, world, time) {
    enemy.hp = Math.max(0, enemy.hp - damage);
    if (!p.is_admin) db.prepare(
      'INSERT INTO game_damage(enemy_id,spawn_id,user_id,damage,damaged_at) VALUES(?,?,?,?,?) '
      + 'ON CONFLICT(enemy_id,spawn_id,user_id) DO UPDATE SET damage=damage+excluded.damage,damaged_at=excluded.damaged_at',
    ).run(enemy.id, enemy.spawnId, p.user_id, damage, time);
    if (enemy.hp > 0) return false;
    enemy.respawnAt = time + 20000;
    if (!p.is_admin) {
      const contributors = db.prepare(
        'SELECT d.user_id FROM game_damage d JOIN game_characters c ON c.user_id=d.user_id '
        + 'JOIN account_users u ON u.id=d.user_id '
        + 'WHERE d.enemy_id=? AND d.spawn_id=? AND d.damage>0 AND d.damaged_at>=? '
        + 'AND c.active_until>? AND u.disabled_at IS NULL AND u.email_verified_at IS NOT NULL',
      ).all(enemy.id, enemy.spawnId, time - 30000, time);
      for (const contributor of contributors) {
        if (credit(contributor.user_id, 15, 'kill:' + enemy.spawnId, 'Thornling defeated', time)) {
          db.prepare('UPDATE game_characters SET kills=kills+1 WHERE user_id=?').run(contributor.user_id);
        }
      }
      systemMessage(world, p.name + ' defeated a thornling. Its fellow guardians earned 15 XP.', time);
    }
    // Administrative executions never mint redeemable XP, including for assistants.
    db.prepare('DELETE FROM game_damage WHERE enemy_id=? AND spawn_id=?').run(enemy.id, enemy.spawnId);
    return true;
  }

  function useSkill(p, input, world, time) {
    const stats = CLASSES[p.hero_class];
    const skill = stats.skills.find(value => value.id === input.skillId);
    if (!skill || skill.type === 'passive') throw new GameError('Choose one of your active class skills.', 400, 'SKILL_UNAVAILABLE');
    const cooldowns = JSON.parse(p.skill_cooldowns_json);
    if ((cooldowns[skill.id] || 0) > time) throw new GameError('That skill is still recovering.', 429, 'SKILL_COOLDOWN');
    if (skill.type === 'execute') {
      if (!p.is_admin) throw new GameError('This power is unavailable.', 403, 'ADMIN_REQUIRED');
      requireAdmin(p.user_id);
      const target = world.enemies.filter(enemy => enemy.hp > 0 && distance(p, enemy) <= skill.range)
        .sort((a, b) => distance(p, a) - distance(p, b))[0];
      if (!target) throw new GameError('Move closer to a thornling to use Soul Reap.');
      damageEnemy(p, target, target.hp, world, time);
      effect(world, p, 'execute', target, time, 1.5);
    } else if (skill.type === 'heal') {
      const targets = skill.target === 'party'
        ? db.prepare('SELECT c.* FROM game_characters c JOIN account_users u ON u.id=c.user_id WHERE c.active_until>? AND u.disabled_at IS NULL AND u.email_verified_at IS NOT NULL').all(time)
          .filter(row => distance(p, row) <= (skill.radius || 0))
        : [p];
      if (!targets.some(row => row.hp < 100)) throw new GameError('Your healing circle is already at full health.', 409, 'HEALTH_FULL');
      for (const row of targets) {
        updateCharacter({ ...row, is_admin: false }, 'hp=?', Math.min(100, row.hp + skill.heal));
      }
      effect(world, p, 'heal', p, time, skill.radius || 1);
    } else if (skill.type === 'ward') {
      updateCharacter(p, 'ward_until=?,ward_amount=?', time + skill.durationMs, skill.ward);
      effect(world, p, 'ward', p, time, 1);
    } else if (skill.type === 'strike' || skill.type === 'area') {
      const primary = world.enemies.filter(enemy => enemy.hp > 0 && distance(p, enemy) <= skill.range)
        .sort((a, b) => distance(p, a) - distance(p, b))[0];
      if (!primary) throw new GameError('Move closer to a thornling to use ' + skill.name + '.');
      const targets = skill.type === 'area'
        ? world.enemies.filter(enemy => enemy.hp > 0 && distance(primary, enemy) <= (skill.radius || 0))
        : [primary];
      let retaliates = false;
      for (const enemy of targets) {
        if (!damageEnemy(p, enemy, skill.damage + Math.floor(p.lifetime_xp / 100) * 2, world, time)) retaliates = true;
      }
      if (retaliates) hurt(p, 9, time);
      effect(world, p, skill.type, primary, time, skill.radius || 0);
    } else {
      throw new GameError('That class skill is unavailable.', 400, 'SKILL_UNAVAILABLE');
    }
    cooldowns[skill.id] = time + skill.cooldownMs;
    updateCharacter(p, 'skill_cooldowns_json=?', JSON.stringify(cooldowns));
    return skill.name + (p.is_admin ? ' answered the silence.' : ' cast. Class skills do not spend XP.');
  }

  function doAction(userId, input, world, time) {
    const p = activeCharacter(userId, time);
    if (input.kind === 'move') {
      const { x, y } = input;
      if (!walkable(x, y) || Math.abs(x - p.x) + Math.abs(y - p.y) !== 1) {
        throw new GameError('Move one tile at a time. Cross the brook using its wooden bridge.');
      }
      if (time - p.last_move_at < 160) throw new GameError('Move a little more slowly.', 429, 'MOVE_COOLDOWN');
      updateCharacter(p, 'x=?,y=?,last_move_at=?', x, y, time);
      return '';
    }
    if (input.kind === 'skill') return useSkill(p, input, world, time);
    if (input.kind === 'attack') {
      if (time - p.last_attack_at < 700) throw new GameError('Your weapon is recharging.', 429, 'ATTACK_COOLDOWN');
      const stats = CLASSES[p.hero_class];
      const targets = world.enemies
        .filter(e => e.hp > 0 && distance(p, e) <= (p.is_admin ? 6 : stats.range))
        .sort((a, b) => distance(p, a) - distance(p, b));
      const enemy = targets[0];
      if (!enemy) throw new GameError('Move closer to a thornling to attack.');
      const damage = p.is_admin ? enemy.hp : stats.damage + Math.floor(p.lifetime_xp / 100) * 2;
      const killed = damageEnemy(p, enemy, damage, world, time);
      updateCharacter(p, 'last_attack_at=?', time);
      effect(world, p, p.is_admin ? 'execute' : 'strike', enemy, time);
      if (killed) return p.is_admin ? 'The thornling vanished. No reward was created.' : 'Thornling cleared! Contributors earned 15 XP for their secret stash.';
      if (hurt(p, 9, time)) return 'The campfire restored you. Your XP and stash are safe.';
      return 'Hit! Thornling has ' + enemy.hp + ' health.';
    }
    if (input.kind === 'interact') {
      if (p.is_admin) return 'The realm stirs around your undying presence. No reward was created.';
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
      if (p.is_admin) throw new GameError('The seventh presence cannot claim customer rewards.', 403, 'ADMIN_REWARD_DISABLED');
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
      updateCharacter(p, 'last_chat_at=?', time);
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
      if (path.startsWith('/api/game/admin/')) requireAdmin(user.id);
      const receipt = db.prepare(
        'SELECT payload_hash,notice,actor_scope FROM game_requests WHERE user_id=? AND request_id=?',
      ).get(user.id, requestId);
      if (receipt) {
        if (receipt.actor_scope === 'admin') requireAdmin(user.id);
        if (receipt.payload_hash !== payloadHash) {
          throw new GameError('This request ID was used for a different action.', 409, 'REQUEST_CONFLICT');
        }
        if (changed) { world.revision += 1; saveWorld(world); }
        return currentResult(world, user.id, time, receipt.notice);
      }
      const adminBefore = adminCharacter(user.id);
      const privileged = path.startsWith('/api/game/admin/') || (path !== '/api/game/join' && adminBefore?.active_until > time);
      let notice;
      if (path === '/api/game/admin/join') {
        notice = joinAdmin(user.id, req, world, time);
      } else if (path === '/api/game/admin/leave') {
        notice = leaveAdmin(user.id);
      } else if (path === '/api/game/join') {
        notice = join(user.id, input, world, time);
      } else if (path === '/api/game/leave') {
        const admin = adminCharacter(user.id);
        const p = admin?.active_until > time ? admin : character(user.id);
        if (p?.active_until > time) {
          updateCharacter(p, 'active_until=0');
          if (!p.is_admin) systemMessage(world, p.name + ' left the glade.', time);
        }
        notice = 'Your seat is free. Your character and secret stash remain saved.';
      } else if (path === '/api/game/heartbeat') {
        activeCharacter(user.id, time);
        notice = '';
      } else {
        notice = doAction(user.id, input, world, time);
      }
      if (!['/api/game/leave', '/api/game/admin/leave'].includes(path)) renew(user.id, time);
      world.revision += 1;
      saveWorld(world);
      db.prepare(
        'INSERT INTO game_requests(user_id,request_id,payload_hash,notice,created_at,actor_scope) VALUES(?,?,?,?,?,?)',
      ).run(user.id, requestId, payloadHash, notice, time, privileged ? 'admin' : 'regular');
      return currentResult(world, user.id, time, notice);
    });
  }

  function stash(userId) {
    const wallet = db.prepare('SELECT balance_xp,lifetime_xp,balance_copper FROM game_wallets WHERE user_id=?').get(userId);
    const history = db.prepare(
      'SELECT id,currency,delta,balance_after AS balanceAfter,reason,created_at AS createdAt '
      + 'FROM game_ledger WHERE user_id=? ORDER BY created_at DESC,rowid DESC LIMIT 40',
    ).all(userId);
    const balanceCopper = wallet?.balance_copper || 0;
    return {
      balanceXp: wallet?.balance_xp || 0,
      lifetimeXp: wallet?.lifetime_xp || 0,
      balanceCopper,
      shopCreditPennies: Math.floor(balanceCopper / COPPER_PER_GOLD),
      coins: {
        gold: Math.floor(balanceCopper / COPPER_PER_GOLD),
        silver: Math.floor((balanceCopper % COPPER_PER_GOLD) / 10),
        copper: balanceCopper % 10,
      },
      history,
      exchange: {
        enabled: true,
        xpPerGold: XP_PER_GOLD,
        copperPerGold: COPPER_PER_GOLD,
        silverPerGold: 100,
        penniesPerGold: 1,
      },
      abilities: [],
    };
  }


  function exchange(req, input) {
    const requestId = input.requestId;
    if (typeof requestId !== 'string' || !/^[a-zA-Z0-9-]{16,80}$/.test(requestId)) {
      throw new GameError('Invalid request ID. Please try again.');
    }
    if (!Number.isSafeInteger(input.lots) || input.lots < 1 || input.lots > 100) {
      throw new GameError('Exchange a whole number from 1 to 100 gold at a time.');
    }
    const payloadHash = digest(JSON.stringify({ path: '/api/game/exchange', input }));
    return transaction(db, () => {
      const time = now();
      const user = requireUser(req, time);
      const receipt = db.prepare(
        'SELECT payload_hash,notice FROM game_requests WHERE user_id=? AND request_id=?',
      ).get(user.id, requestId);
      if (receipt) {
        if (receipt.payload_hash !== payloadHash) {
          throw new GameError('This request ID was used for a different action.', 409, 'REQUEST_CONFLICT');
        }
        return { stash: stash(user.id), notice: receipt.notice };
      }
      const cost = input.lots * XP_PER_GOLD;
      const copper = input.lots * COPPER_PER_GOLD;
      const wallet = db.prepare(
        'SELECT balance_xp,lifetime_xp,balance_copper FROM game_wallets WHERE user_id=?',
      ).get(user.id);
      if (!wallet || wallet.balance_xp < cost) {
        throw new GameError('You need ' + cost.toLocaleString('en-US') + ' XP for this exchange.', 409, 'INSUFFICIENT_XP');
      }
      if (!Number.isSafeInteger(wallet.balance_copper + copper)
        || wallet.balance_copper > MAX_BALANCE - copper) {
        throw new GameError('This exchange would exceed the supported coin balance.', 409, 'BALANCE_LIMIT');
      }
      const xpAfter = wallet.balance_xp - cost;
      const copperAfter = wallet.balance_copper + copper;
      const changed = db.prepare(
        'UPDATE game_wallets SET balance_xp=balance_xp-?,balance_copper=balance_copper+? '
        + 'WHERE user_id=? AND balance_xp>=? AND balance_copper<=?',
      ).run(cost, copper, user.id, cost, MAX_BALANCE - copper);
      if (changed.changes !== 1) throw new GameError('Your balance changed. Review it and try again.', 409, 'BALANCE_CHANGED');
      const eventKey = 'exchange:' + requestId;
      const createdAt = new Date(time).toISOString();
      const write = db.prepare(
        'INSERT INTO game_ledger(id,user_id,event_key,currency,delta,balance_after,reason,created_at) '
        + 'VALUES(?,?,?,?,?,?,?,?)',
      );
      write.run(
        randomUUID(), user.id, eventKey, 'XP', -cost, xpAfter,
        'XP exchanged for gold', createdAt,
      );
      write.run(
        randomUUID(), user.id, eventKey, 'COPPER', copper, copperAfter,
        'Gold exchanged from XP', createdAt,
      );
      const notice = 'Exchanged ' + cost.toLocaleString('en-US') + ' XP for '
        + input.lots + ' gold. Your lifetime XP is unchanged.';
      db.prepare(
        'INSERT INTO game_requests(user_id,request_id,payload_hash,notice,created_at) VALUES(?,?,?,?,?)',
      ).run(user.id, requestId, payloadHash, notice, time);
      return { stash: stash(user.id), notice };
    });
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
      const posts = ['/api/game/join', '/api/game/action', '/api/game/heartbeat', '/api/game/leave', '/api/game/exchange', '/api/game/admin/join', '/api/game/admin/leave'];
      if (!posts.includes(path)) throw new GameError('Not found', 404, 'NOT_FOUND');
      if (req.method !== 'POST') throw new GameError('Method not allowed', 405, 'METHOD_NOT_ALLOWED');
      if (!sameOriginJson(req, options.origin)) throw new GameError('Forbidden', 403, 'ORIGIN_REJECTED');
      let input;
      try { input = await readJson(req, 4096); }
      catch (error) { throw new GameError('Invalid JSON object or request body.', error.status || 400, 'INVALID_REQUEST'); }
      if (path === '/api/game/exchange') {
        reply(res, 200, exchange(req, input));
      } else {
        const result = mutate(req, path, input);
        publish();
        reply(res, 200, result);
      }
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
