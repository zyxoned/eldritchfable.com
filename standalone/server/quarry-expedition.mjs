import { randomInt, randomUUID } from 'node:crypto';
import { sanitizeAppearance } from '../shared/appearance-catalog.mjs';
import { CLASS_CATALOG } from '../shared/class-catalog.mjs';

const notes = ['low', 'mid', 'high'];
const hpLimit = 72;
const bracerKey = 'hollowbell:resonant-bracer';
const titles = { market: 'Hollowbell Quarry Market', gate: 'Resonant Gate', deep: 'The Underdark' };
const near = (hero, x, y, radius = 1) => Math.max(Math.abs(hero.x - x), Math.abs(hero.y - y)) <= radius;

function tuneForNewParty() {
  const tune = [...notes];
  for (let last = tune.length - 1; last > 0; last--) {
    const pick = randomInt(last + 1);
    [tune[last], tune[pick]] = [tune[pick], tune[last]];
  }
  return JSON.stringify(tune);
}

function artisan(time) {
  const working = Math.floor(time / 8000) % 3 !== 2;
  return { x: working ? 3 : 4, y: 2, working };
}

export function createQuarry(db, { error, credit, combat, equipItem }) {
  // Called only within the game service's authorized SQLite transaction.
  const getHero = userId => db.prepare('SELECT * FROM game_quarry_heroes WHERE user_id=?').get(userId);
  const getParty = partyId => db.prepare('SELECT * FROM game_quarry_parties WHERE party_id=?').get(partyId);
  const itemFor = userId => db.prepare('SELECT id,equipped FROM game_owned_equipment WHERE user_id=? AND grant_key=?').get(userId, bracerKey);

  function need(valid, text, status = 409) {
    if (!valid) throw error(text, status, 'QUARRY_UNAVAILABLE');
  }

  function scope(userId) {
    const row = db.prepare('SELECT party_id,scene,visit FROM game_quarry_heroes WHERE user_id=? AND scene IS NOT NULL').get(userId);
    return row ? 'quarry:' + row.party_id + ':' + row.scene + ':' + row.visit : null;
  }

  function transition(userId, scene) {
    db.prepare('UPDATE game_quarry_heroes SET scene=?,x=1,y=2,visit=visit+1,last_move=0 WHERE user_id=?').run(scene, userId);
  }

  function enter(p) {
    if (!getParty(p.party_id)) {
      db.prepare('INSERT INTO game_quarry_parties(party_id,tune_json) VALUES(?,?)').run(p.party_id, tuneForNewParty());
    }
    const hero = getHero(p.user_id);
    if (!hero) {
      db.prepare("INSERT INTO game_quarry_heroes(user_id,party_id,scene) VALUES(?,?,'market')").run(p.user_id, p.party_id);
    } else {
      need(!hero.scene, 'You are already on the quarry road.');
      if (hero.party_id !== p.party_id) {
        // Tune and witnesses belong to the party's mechanism. Personal rewards survive.
        db.prepare('UPDATE game_quarry_heroes SET party_id=?,scored=0,listened=0,witnessed=0,contributed=0 WHERE user_id=?')
          .run(p.party_id, p.user_id);
      }
      transition(p.user_id, 'market');
    }
    return 'You reach the canvas awnings of Hollowbell Quarry Market.';
  }

  function depart(userId) {
    db.prepare('UPDATE game_quarry_heroes SET scene=NULL,visit=visit+1 WHERE user_id=? AND scene IS NOT NULL').run(userId);
  }

  function activeActors(partyId, scene, time) {
    return db.prepare('SELECT c.*,q.x AS quarry_x,q.y AS quarry_y,q.last_move,q.last_strike,q.contributed FROM game_quarry_heroes q '
      + 'JOIN game_characters c ON c.user_id=q.user_id AND c.party_id=q.party_id '
      + 'JOIN account_users u ON u.id=c.user_id WHERE q.party_id=? AND q.scene=? AND c.active_until>? '
      + 'AND u.email_verified_at IS NOT NULL AND u.disabled_at IS NULL ORDER BY c.created_at,c.id').all(partyId, scene, time);
  }

  function projection(userId, partyId, time) {
    const hero = getHero(userId);
    if (!hero?.scene || hero.party_id !== partyId) return null;
    const actors = activeActors(partyId, hero.scene, time);
    const me = actors.find(row => row.user_id === userId);
    if (!me) return null;
    const party = getParty(partyId);
    const item = itemFor(userId);
    const xp = db.prepare('SELECT lifetime_xp FROM game_wallets WHERE user_id=?').get(userId).lifetime_xp;
    const journal = [];
    if (hero.scored) journal.push("The bell repairer's score preserves the cadence of this quarry's braces.");
    if (hero.listened) journal.push('Two mineral seams meet at the pumps. Their bronze braces sound in order.');
    if (hero.witnessed) journal.push('I saw the freight lift take the weight of its cables.');
    if (hero.discovered) journal.push('I descended to the drowned landing in The Underdark.');
    if (hero.completed) journal.push('The landing counterweight returned me to Hollowbell.');
    return {
      scene: hero.scene, title: titles[hero.scene], x: hero.x, y: hero.y,
      actors: actors.map(actor => ({
        id: actor.id, name: actor.name, heroClass: actor.hero_class,
        appearance: sanitizeAppearance(JSON.parse(actor.appearance_json)), x: actor.quarry_x, y: actor.quarry_y,
        lastMove: actor.last_move, lastStrike: actor.last_strike,
      })),
      npc: hero.scene === 'market' ? artisan(time) : null,
      foe: hero.scene === 'gate' ? { x: 4, y: 2, hp: party.crawler_hp, maxHp: hpLimit, windupUntil: party.windup_until } : null,
      opened: Boolean(party.opened), primed: Boolean(party.primed), progress: party.progress,
      tune: hero.scored || hero.listened ? JSON.parse(party.tune_json) : null,
      reward: Boolean(hero.reward), owned: Boolean(item), equipped: Boolean(item?.equipped),
      skill: Boolean(hero.skill), completed: Boolean(hero.completed), hp: me.hp, maxHp: combat(me).maxHp,
      level: 1 + Math.floor(xp / 100), journal,
    };
  }

  function windUp(party, time) {
    if (party.crawler_hp && !party.windup_until && time >= party.next_windup) {
      db.prepare('UPDATE game_quarry_parties SET windup_until=? WHERE party_id=?').run(time + 1200, party.party_id);
    }
  }

  function tick(partyId, time) {
    const party = db.prepare('SELECT windup_until FROM game_quarry_parties WHERE party_id=? AND crawler_hp>0 AND windup_until>0 AND windup_until<=?').get(partyId, time);
    if (!party) return false;
    db.prepare('UPDATE game_quarry_parties SET windup_until=0,next_windup=? WHERE party_id=?').run(time + 850, partyId);
    for (const actor of activeActors(partyId, 'gate', time)) {
      if (!near({ x: actor.quarry_x, y: actor.quarry_y }, 4, 2, 2)) continue;
      const armor = combat(actor, { armor: CLASS_CATALOG[actor.hero_class].armor || 0 }).armor;
      const hit = Math.max(1, 14 - armor);
      if (actor.hp > hit) {
        db.prepare('UPDATE game_characters SET hp=hp-? WHERE user_id=?').run(hit, actor.user_id);
      } else {
        db.prepare('UPDATE game_characters SET hp=? WHERE user_id=?').run(combat(actor).maxHp, actor.user_id);
        transition(actor.user_id, 'gate');
      }
    }
    return true;
  }

  function defeat(partyId, time) {
    for (const actor of activeActors(partyId, 'gate', time)) {
      if (!actor.contributed) continue;
      if (credit(actor.user_id, 100, 'quarry:first-crawler', 'Resonant Gate cleared', time)) {
        db.prepare('UPDATE game_quarry_heroes SET skill=1,reward=1 WHERE user_id=?').run(actor.user_id);
      }
    }
  }

  function act(p, input, time) {
    need(!p.is_admin, 'Support visitors cannot undertake this expedition.', 403);
    const userId = p.user_id;
    if (input.verb === 'enter') return enter(p);
    const hero = getHero(userId);
    need(hero?.scene && hero.party_id === p.party_id, 'Take the quarry road before acting here.');
    const party = getParty(p.party_id);
    const scene = hero.scene;
    switch (input.verb) {
      case 'leave':
        depart(userId);
        return 'You return to the open road.';
      case 'move': {
        const { dx, dy } = input;
        need(Number.isInteger(dx) && Number.isInteger(dy) && Math.abs(dx) + Math.abs(dy) === 1, 'Choose a single neighboring tile.', 400);
        need(time - hero.last_move >= 140, 'Wait for your footing.', 429);
        const x = hero.x + dx, y = hero.y + dy;
        need(x >= 0 && x <= 12 && y >= 0 && y <= 4, 'The rock wall bars that way.');
        need(scene !== 'gate' || !party.crawler_hp || x <= 5, 'The living crawler blocks the gate.');
        db.prepare('UPDATE game_quarry_heroes SET x=?,y=?,last_move=? WHERE user_id=?').run(x, y, time, userId);
        if (scene === 'gate' && near({ x, y }, 4, 2, 2)) windUp(party, time);
        return '';
      }
      case 'talk': {
        const npc = artisan(time);
        need(scene === 'market' && near(hero, npc.x, npc.y), 'Approach the bell repairer at the workbench.');
        db.prepare('UPDATE game_characters SET hp=? WHERE user_id=?').run(combat(p).maxHp, userId);
        db.prepare('UPDATE game_quarry_heroes SET scored=1 WHERE user_id=?').run(userId);
        return 'The repairer tends your gear, restores your health and shows you the quarry score.';
      }
      case 'travel':
        need(scene === 'market' && near(hero, 11, 2), 'Follow the market road east to the gate.');
        transition(userId, 'gate');
        return 'You enter Resonant Gate. Two mineral seams cross the quarry floor.';
      case 'back':
        need(scene === 'gate' && near(hero, 1, 2), 'Return to the western gate stair.');
        transition(userId, 'market');
        return 'You reach Hollowbell again.';
      case 'strike': {
        need(scene === 'gate' && near(hero, 4, 2, 2) && party.crawler_hp > 0, 'Approach the living quarry crawler.');
        need(time - hero.last_strike >= 600, 'Let your weapon recover.', 429);
        const damage = Math.max(10, Math.min(22, combat(p, { damage: CLASS_CATALOG[p.hero_class].damage }).damage));
        const hp = Math.max(0, party.crawler_hp - damage);
        db.prepare('UPDATE game_quarry_heroes SET contributed=1,last_strike=? WHERE user_id=?').run(time, userId);
        db.prepare('UPDATE game_quarry_parties SET crawler_hp=? WHERE party_id=?').run(hp, p.party_id);
        if (hp) {
          windUp(party, time);
          return 'The blow splinters a plate. The crawler braces to lunge.';
        }
        db.prepare('UPDATE game_quarry_parties SET windup_until=0 WHERE party_id=?').run(p.party_id);
        defeat(p.party_id, time);
        return 'The crawler falls. Its contributors gain 100 XP and learn Resonant Pulse.';
      }
      case 'listen':
        need(scene === 'gate' && near(hero, 6, 2), 'Stand beside the cycling quarry pumps.');
        db.prepare('UPDATE game_quarry_heroes SET listened=1 WHERE user_id=?').run(userId);
        return 'You listen as three bronze braces ring through the joined mineral seams.';
      case 'claim': {
        need(scene === 'gate' && !party.crawler_hp && hero.reward && near(hero, 4, 2), 'Approach your earned drop beside the crawler.');
        const definition = { id: 'resonant-bracer', slot: 'wrist', name: 'Resonant Bracer', rarity: 'Rare',
          effect: { id: 'resonant-bracer', name: 'Tempered bronze', flat: { armor: 2 } } };
        db.prepare('INSERT INTO game_owned_equipment(id,user_id,grant_key,hero_class,slot,definition_json,acquired_at) VALUES(?,?,?,?,?,?,?)')
          .run(randomUUID(), userId, bracerKey, p.hero_class, definition.slot, JSON.stringify(definition), time);
        db.prepare('UPDATE game_quarry_heroes SET reward=0 WHERE user_id=?').run(userId);
        return 'Claimed the Rare Resonant Bracer. Equip it to extend Pulse reach and gain two armor.';
      }
      case 'equip': {
        const item = itemFor(userId);
        need(item, 'Claim your bracer first.');
        return equipItem(userId, item.id, time);
      }
      case 'ring': {
        need(scene === 'gate' && !party.crawler_hp && near(hero, 9, 2), 'Approach the three braces by the freight shaft.');
        need(notes.includes(input.note), 'Select a bronze brace.', 400);
        if (party.opened) return 'The shaft is already open.';
        const tune = JSON.parse(party.tune_json);
        const right = tune[party.progress] === input.note;
        const progress = right ? party.progress + 1 : (input.note === tune[0] ? 1 : 0);
        const opened = progress === tune.length;
        db.prepare('UPDATE game_quarry_parties SET progress=?,opened=? WHERE party_id=?').run(progress, Number(opened), p.party_id);
        if (opened) {
          // Witnesses learn that the shaft opened; no unseen score or destination is granted.
          for (const actor of activeActors(p.party_id, 'gate', time)) {
            if (near({ x: actor.quarry_x, y: actor.quarry_y }, 9, 2, 3)) {
              db.prepare('UPDATE game_quarry_heroes SET witnessed=1 WHERE user_id=?').run(actor.user_id);
            }
          }
          return 'The last brace sustains its note. The freight lift wakes.';
        }
        return right ? 'The brace hums in sympathy.' : 'The echo breaks. Listen, then begin again.';
      }
      case 'descend':
        need(scene === 'gate' && party.opened && near(hero, 11, 2), 'Stand on the awakened freight lift.');
        transition(userId, 'deep');
        db.prepare('UPDATE game_quarry_heroes SET discovered=1 WHERE user_id=?').run(userId);
        return 'The lift descends to the drowned landing in The Underdark.';
      case 'pulse': {
        const item = itemFor(userId);
        need(hero.skill && scene === 'deep' && near(hero, 9, 2, item?.equipped ? 3 : 1), 'Bring your unlocked Resonant Pulse within reach of the counterweight.');
        db.prepare('UPDATE game_quarry_parties SET primed=1 WHERE party_id=?').run(p.party_id);
        return 'Resonant Pulse rings the landing bell and lifts the counterweight into place.';
      }
      case 'return':
        need(scene === 'deep' && near(hero, 9, 2), 'Board the counterweight at the landing.');
        need(party.primed || !hero.skill, 'Use Resonant Pulse to engage the counterweight.');
        transition(userId, 'market');
        db.prepare('UPDATE game_quarry_heroes SET completed=1 WHERE user_id=?').run(userId);
        return party.primed ? 'The counterweight returns you to Hollowbell.' : 'You wind the hand crank and ride the counterweight back to Hollowbell.';
      default:
        throw error('Unknown quarry action.', 400, 'INVALID_ACTION');
    }
  }
  return { scope, depart, act, projection, tick };
}
