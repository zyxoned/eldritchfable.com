import * as THREE from 'three';
import { CLASS_CATALOG } from '../../../shared/class-catalog.mjs';
import { resolveAppearance } from '../../../shared/appearance-catalog.mjs';
import { regionTile } from '../../../shared/world-catalog.mjs';
import { disposeScene } from './materials';
import { floorHeight, UNIT } from './world';

const lit = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: .83, ...extra });
const flat = color => new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide });

function piece(parent, geometry, material, x, y, z) {
  const item = new THREE.Mesh(geometry, material);
  item.position.set(x, y, z);
  item.receiveShadow = true;
  parent.add(item);
  return item;
}
function block(parent, material, x, y, z, w, h, d) {
  return piece(parent, new THREE.BoxGeometry(w, h, d), material, x, y, z);
}
function oval(parent, material, x, y, z, w, h, d, segments = 12) {
  const item = piece(parent, new THREE.SphereGeometry(1, segments, 8), material, x, y, z);
  item.scale.set(w, h, d);
  return item;
}
function group(parent, x, y, z) {
  const item = new THREE.Group();
  item.position.set(x, y, z);
  parent.add(item);
  return item;
}
function plate(parent, material, outline, thickness, x, y, z) {
  const shape = new THREE.Shape();
  outline.forEach(([px, py], i) => i ? shape.lineTo(px, py) : shape.moveTo(px, py));
  shape.closePath();
  return piece(parent, new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: true, bevelSize: .014,
    bevelThickness: .01, bevelSegments: 1, steps: 1 }), material, x, y, z);
}
function tube(parent, material, upper, lower, length, x, y, z, sides = 8) {
  return piece(parent, new THREE.CylinderGeometry(upper, lower, length, sides), material, x, y, z);
}

function addWeapon(hand, style, metal, gold, dark, light) {
  if (style === 'arcane' || style === 'radiance' || style === 'runes' || style === 'embers' || style === 'notes') {
    tube(hand, dark, .027, .033, 1.13, 0, .21, .04);
    const gem = piece(hand, new THREE.OctahedronGeometry(.105), light, 0, .86, .04);
    gem.scale.y = 1.48;
    const crown = piece(hand, new THREE.TorusGeometry(.122, .023, 5, 14), gold, 0, .79, .04);
    crown.rotation.x = .36;
  } else if (style === 'arrow') {
    const points = [new THREE.Vector3(0, -.48, .04), new THREE.Vector3(.18, -.25, .04),
      new THREE.Vector3(.23, 0, .04), new THREE.Vector3(.18, .25, .04), new THREE.Vector3(0, .48, .04)];
    piece(hand, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 13, .028, 6, false), dark, 0, 0, 0);
    tube(hand, gold, .007, .007, .96, 0, 0, .04, 4);
    block(hand, gold, .19, 0, .04, .082, .13, .055);
  } else if (style !== 'palm') {
    const sword = group(hand, 0, -.06, .05);
    sword.rotation.x = -1.08;
    plate(sword, metal, [[-.071, .12], [.064, .12], [.053, .84], [0, 1.03], [-.048, .84]], .026, 0, 0, 0);
    block(sword, gold, 0, .126, .02, .25, .047, .084);
    tube(sword, dark, .035, .035, .19, 0, .017, .02);
    oval(sword, gold, 0, -.085, .02, .045, .04, .04, 8);
  }
}

function hero(parent, player) {
  const def = CLASS_CATALOG[player.heroClass] || CLASS_CATALOG.ranger;
  const appearance = resolveAppearance(player.appearance, def.color);
  const heavy = player.heroClass === 'knight' || player.heroClass === 'death-knight' || player.heroClass === 'cleric';
  const armored = player.heroClass === 'death-knight';
  const skin = lit(appearance.skin), hair = lit(appearance.hair);
  const fabric = new THREE.Color(appearance.outfit).lerp(new THREE.Color(0x504d46), .43);
  const cloth = lit(fabric, { side: THREE.DoubleSide });
  const dark = lit(0x302c31), accent = lit(appearance.accent, { metalness: .33, roughness: .48 });
  const metal = lit(armored ? 0x394553 : heavy ? 0x929fa5 : 0x6a6256, { metalness: .42, roughness: .48 });
  const light = lit(def.color, { emissive: def.color, emissiveIntensity: .9 });
  const root = group(parent, 0, 0, 0), body = group(root, 0, 0, 0);
  body.scale.set(appearance.widthScale, appearance.heightScale, appearance.widthScale);
  oval(body, dark, 0, .91, 0, .204, .176, .131);
  oval(body, cloth, 0, 1.22, -.01, .244, .33, .145);
  plate(body, metal, [[-.215, .17], [-.13, .24], [0, .17], [.13, .24], [.215, .17], [.188, -.1], [0, -.22], [-.188, -.1]], .039, 0, 1.25, .107);
  for (const side of [-1, 1]) {
    const strap = block(body, dark, side * .08, 1.22, .163, .041, .39, .031);
    strap.rotation.z = side * .31;
  }
  oval(body, dark, 0, .994, 0, .226, .062, .153);
  block(body, accent, 0, 1.0, .153, .103, .072, .036);
  oval(body, skin, 0, 1.55, .006, .066, .098, .065, 10);
  oval(body, skin, 0, 1.689, .015, .111, .148, .101);
  oval(body, skin, 0, 1.684, .104, .031, .053, .036, 8);
  for (const side of [-1, 1]) {
    oval(body, skin, side * .107, 1.666, .015, .029, .051, .025, 8);
    oval(body, armored ? light : dark, side * .039, 1.718, .102, .026, .012, .012, 8);
  }
  if (heavy) {
    oval(body, metal, 0, 1.766, -.006, .128, .124, .114);
    block(body, metal, 0, 1.71, .107, .234, .052, .035);
    block(body, accent, 0, 1.76, .109, .026, .109, .026);
    for (const side of [-1, 1]) {
      block(body, metal, side * .098, 1.65, .075, .035, .151, .109);
      if (armored) piece(body, new THREE.ConeGeometry(.046, .29, 6), metal, side * .111, 1.915, -.023).rotation.z = -side * .34;
    }
  } else if (appearance.hairStyle !== 'shaved') {
    oval(body, hair, 0, 1.765, -.021, .123, .094, .11);
    if (appearance.hairStyle === 'braid' || appearance.hairStyle === 'long') {
      oval(body, hair, 0, 1.556, -.086, appearance.hairStyle === 'braid' ? .036 : .091, .22, .044);
    }
  }

  const cape = group(body, 0, 1.483, -.102);
  const capeGeometry = new THREE.PlaneGeometry(.47, .83, 8, 8);
  const capePoints = capeGeometry.attributes.position;
  for (let i = 0; i < capePoints.count; i++) {
    const x = capePoints.getX(i), y = capePoints.getY(i) - .42;
    capePoints.setXYZ(i, x * (1 - y * .24), y, -.08 + y * .19 + .031 * Math.cos(x * 42));
  }
  capeGeometry.computeVertexNormals();
  piece(cape, capeGeometry, cloth, 0, 0, 0);
  for (const side of [-1, 1]) oval(body, accent, side * .148, 1.481, .127, .034, .035, .025, 8);
  const arms = [], legs = [];
  for (const side of [-1, 1]) {
    const arm = group(body, side * .253, 1.436, .007);
    arm.rotation.z = side * .1;
    oval(arm, metal, 0, -.041, 0, .113, heavy ? .121 : .086, .108);
    oval(arm, accent, 0, -.065, .067, .067, .064, .038);
    tube(arm, cloth, .063, .055, .238, 0, -.163, 0);
    const forearm = group(arm, 0, -.275, 0);
    oval(forearm, metal, 0, -.076, .008, .072, .112, .073);
    const hand = group(forearm, 0, -.177, .018);
    oval(hand, heavy ? dark : skin, 0, 0, 0, .056, .074, .047, 8);
    if (side === 1) addWeapon(hand, def.attackStyle, metal, accent, dark, light);
    if (side === -1 && heavy) {
      plate(forearm, metal, [[-.154, .14], [0, .185], [.154, .14], [.129, -.087], [0, -.212], [-.129, -.087]], .044, -.035, -.042, .104);
      oval(forearm, accent, -.035, -.041, .18, .051, .05, .032, 10);
    }
    arms.push({ arm, forearm });
    const leg = group(body, side * .107, .909, 0);
    tube(leg, cloth, .098, .079, .428, 0, -.196, 0);
    oval(leg, metal, 0, -.338, .052, .083, .102, .057);
    const knee = group(leg, 0, -.414, 0);
    tube(knee, dark, .082, .06, .385, 0, -.172, 0);
    oval(knee, metal, 0, -.153, .052, .065, .162, .044);
    oval(knee, dark, 0, -.379, .066, .088, .075, .16);
    legs.push({ leg, knee });
  }

  return {
    root, body, height: 1.95, pose(time, walking, attack) {
      const cycle = time * 13.8;
      const gait = walking ? .48 : .012;
      const hit = Math.sin(Math.min(1, attack) * Math.PI);
      body.position.y = walking ? .044 * Math.abs(Math.sin(cycle)) : .012 * Math.sin(time * 3.4);
      body.rotation.z = walking ? .055 * Math.sin(cycle) : 0;
      body.rotation.y = -.38 * hit;
      cape.rotation.x = (walking ? .2 : .075) + .044 * Math.sin(time * 5);
      legs.forEach(({ leg, knee }, i) => {
        const swing = Math.sin(cycle + Math.PI * i) * gait;
        leg.rotation.x = swing;
        knee.rotation.x = Math.max(0, -swing) * .79;
      });
      arms.forEach(({ arm, forearm }, i) => {
        arm.rotation.x = -.09 - Math.sin(cycle + Math.PI * i) * gait * .68 - (i === 1 ? 1.36 * hit : .22 * hit);
        arm.rotation.z = (i ? 1 : -1) * .13 + (i === 1 ? .71 * hit : 0);
        forearm.rotation.x = -.32 - (i === 1 ? .8 * hit : .19);
      });
    },
  };
}

function thornling(parent) {
  const roots = lit(0x534942), bone = lit(0xa8a091), thorn = lit(0x323142);
  const ember = lit(0xd191bd, { emissive: 0xba5591, emissiveIntensity: 2.5 });
  const root = group(parent, 0, 0, 0), body = group(root, 0, 0, 0);
  const arms = [];
  oval(body, roots, 0, .81, -.04, .39, .36, .24, 8).rotation.x = -.25;
  oval(body, thorn, 0, 1.103, -.087, .231, .48, .217, 8).rotation.x = -.28;
  for (const side of [-1, 1]) {
    const leg = tube(body, roots, .106, .064, .63, side * .213, .319, -.026, 6);
    leg.rotation.z = side * .28;
    oval(body, roots, side * .303, .098, .06, .17, .08, .182, 8);
    const arm = group(body, side * .321, 1.046, .009);
    tube(arm, roots, .139, .072, .52, 0, -.213, 0, 7).rotation.z = side * .36;
    const claw = group(arm, side * .119, -.453, .035);
    for (let i = 0; i < 3; i++) {
      const talon = piece(claw, new THREE.ConeGeometry(.05, .31, 5), bone, (i - 1) * .087, -.09, .02);
      talon.rotation.x = 2.8;
    }
    arms.push(arm);
    const antler = piece(body, new THREE.ConeGeometry(.084, .47, 5), bone, side * .167, 1.676, .013);
    antler.rotation.z = -side * .51;
    oval(body, ember, side * .077, 1.37, .196, .042, .025, .023, 8);
    for (let i = 0; i < 4; i++) {
      const rib = tube(body, bone, .034, .019, .176, side * .14, .961 - i * .105, .174);
      rib.rotation.z = side * (1.26 - i * .12);
    }
  }
  oval(body, bone, 0, 1.406, .11, .176, .223, .094, 10);
  oval(body, thorn, 0, 1.28, .192, .1, .069, .03, 8);
  return {
    root, body, height: 1.78, pose(time, moving, attack) {
      body.position.y = .035 * Math.sin(time * 4.5);
      body.rotation.x = .14 + .085 * Math.sin(time * 2.6) + .24 * Math.sin(attack * Math.PI);
      arms.forEach((arm, i) => { arm.rotation.x = .22 + .12 * Math.sin(time * (moving ? 9 : 3) + i) - .74 * Math.sin(attack * Math.PI); });
    },
  };
}

function makeHealth(root, height) {
  const marker = group(root, 0, height + .25, 0);
  const back = piece(marker, new THREE.PlaneGeometry(.72, .09), flat(0x1c1621), 0, 0, 0);
  const value = piece(marker, new THREE.PlaneGeometry(.68, .052), flat(0xb85e76), 0, 0, .004);
  back.renderOrder = value.renderOrder = 2;
  return { marker, value };
}

export function worldPosition(x, y, out = new THREE.Vector3()) {
  const wx = x * UNIT, wz = y * UNIT;
  return out.set(wx, regionTile('glade', Math.round(x), Math.round(y)) === 'bridge' ? .105 : floorHeight(wx, wz), wz);
}

function appearanceKey(player) {
  return JSON.stringify([player.heroClass, player.appearance]);
}

export function createActors(scene) {
  const actors = new Map();
  const updateSet = new Set();
  const yAxis = new THREE.Vector3(0, 1, 0), yaw = new THREE.Quaternion(), manual = new THREE.Vector3();
  let previous;
  function remove(id, actor) {
    actor.root.removeFromParent();
    disposeScene(actor.root);
    actors.delete(id);
  }
  function sync(realm, playerId) {
    if (realm === previous) return;
    previous = realm;
    updateSet.clear();
    function update(data, foe) {
      const key = foe ? 'thornling' : appearanceKey(data);
      let actor = actors.get(data.id);
      if (actor && actor.key !== key) { remove(data.id, actor); actor = null; }
      if (!actor) {
        const created = foe ? thornling(scene) : hero(scene, data);
        const ground = piece(created.root, new THREE.CircleGeometry(foe ? .48 : .31, 22),
          new THREE.MeshBasicMaterial({ color: 0x0f1420, transparent: true, opacity: .43, depthWrite: false }),
          0, .018, 0);
        ground.rotation.x = -Math.PI / 2;
        if (data.id === playerId) {
          const ring = piece(created.root, new THREE.RingGeometry(.355, .376, 28), flat(0xb9ac86), 0, .023, 0);
          ring.rotation.x = -Math.PI / 2;
        }
        actor = { ...created, foe, key, target: new THREE.Vector3(), heading: -2.2, moving: false,
          startedAttack: -1000, effectId: null, health: foe ? makeHealth(created.root, created.height) : null };
        worldPosition(data.x, data.y, actor.root.position);
        actors.set(data.id, actor);
      }
      actor.data = data;
      const dx = data.x * UNIT - actor.target.x, dz = data.y * UNIT - actor.target.z;
      if (actor.target.lengthSq() && Math.hypot(dx, dz) > .01) actor.heading = Math.atan2(dx, dz);
      worldPosition(data.x, data.y, actor.target);
      if (actor.health) {
        const progress = THREE.MathUtils.clamp(data.hp / 42, .018, 1);
        actor.health.value.scale.x = progress;
        actor.health.value.position.x = -.34 * (1 - progress);
      }
      updateSet.add(data.id);
    }
    for (const player of [...(realm?.players || []), ...(realm?.visitors || [])]) {
      if ((!player.hidden || player.id === playerId) && (!player.regionId || player.regionId === 'glade')) update(player, false);
    }
    for (const enemy of realm?.enemies || []) if (enemy.hp > 0) update(enemy, true);
    for (const [id, actor] of actors) if (!updateSet.has(id)) remove(id, actor);
  }
  function update(realm, playerId, time, dt, reducedMotion, serverNow, position, viewYaw) {
    sync(realm, playerId);
    for (const effect of realm?.effects || []) {
      const actor = actors.get(effect.actorId);
      const age = serverNow - effect.at;
      if (!actor || age < -90 || age > 450 || actor.effectId === effect.id) continue;
      actor.effectId = effect.id;
      actor.startedAttack = time - Math.max(0, age) / 1000;
      const dx = effect.x * UNIT - actor.root.position.x, dz = effect.y * UNIT - actor.root.position.z;
      if (Math.hypot(dx, dz) > .2) actor.heading = Math.atan2(dx, dz);
    }
    for (const actor of actors.values()) {
      const local = actor.data.id === playerId;
      const free = local && position;
      const target = free ? worldPosition(position.x, position.y, manual) : actor.target;
      const remaining = actor.root.position.distanceTo(target);
      actor.moving = remaining > .009 && remaining < UNIT * 4;
      if (free || reducedMotion || remaining > UNIT * 4 || remaining < .013) actor.root.position.copy(target);
      else actor.root.position.lerp(target, 1 - Math.exp(-dt * 15));
      const phase = reducedMotion ? 1 : THREE.MathUtils.clamp((time - actor.startedAttack) / .44, 0, 1);
      if (actor.data.hp <= 0) {
        actor.body.rotation.z = -Math.PI / 2;
        actor.body.position.y = .28;
      } else {
        actor.pose(reducedMotion ? 0 : time, actor.moving && !reducedMotion, phase);
      }
      yaw.setFromAxisAngle(yAxis, local && phase >= 1 ? viewYaw : actor.heading);
      if (reducedMotion) actor.root.quaternion.copy(yaw);
      else actor.root.quaternion.slerp(yaw, 1 - Math.exp(-dt * 19));
    }
  }
  return {
    update,
    faceHealthBars(orientation) {
      for (const actor of actors.values()) actor.health?.marker.quaternion.copy(actor.root.quaternion).invert().multiply(orientation);
    },
    player: id => actors.get(id),
    enemyAt(ray) {
      const center = new THREE.Vector3(), sphere = new THREE.Sphere(center, .49), hit = new THREE.Vector3();
      let closest = Infinity, target;
      for (const actor of actors.values()) {
        if (!actor.foe) continue;
        sphere.center.copy(actor.root.position).y += .81;
        if (!ray.intersectSphere(sphere, hit)) continue;
        const distance = ray.origin.distanceTo(hit);
        if (distance < closest) { closest = distance; target = actor.data; }
      }
      return target;
    },
  };
}

export function createCombatFx(scene, glow) {
  const sparks = [];
  for (let i = 0; i < 8; i++) {
    const flash = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    const arc = piece(scene, new THREE.TorusGeometry(.7, .032, 6, 26, Math.PI * 1.38), new THREE.MeshBasicMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    }), 0, 0, 0);
    scene.add(flash);
    sparks.push({ flash, arc });
  }
  const start = new THREE.Vector3(), end = new THREE.Vector3();
  return (effects, now, reducedMotion) => {
    sparks.forEach(({ flash, arc }) => { flash.visible = arc.visible = false; });
    if (reducedMotion) return;
    let index = 0;
    for (const effect of effects || []) {
      const age = (now - effect.at) / 1000;
      if (index >= sparks.length || age < -.09 || age > .68) continue;
      const { flash, arc } = sparks[index++];
      const alpha = Math.max(0, 1 - Math.max(0, age) / .68);
      worldPosition(effect.x, effect.y, end);
      worldPosition(effect.originX ?? effect.x, effect.originY ?? effect.y, start);
      const ranged = start.distanceToSquared(end) > 1 && effect.attackStyle !== 'blade' && effect.attackStyle !== 'palm';
      flash.visible = arc.visible = true;
      flash.position.copy(start).lerp(end, THREE.MathUtils.clamp(ranged ? age * 5 : 1, 0, 1));
      flash.position.y += ranged ? 1.1 : .74;
      flash.scale.setScalar(ranged ? 1 + .9 * alpha : 1.15 + .7 * alpha);
      flash.material.color.set(effect.color || 0xdba472);
      flash.material.opacity = .78 * alpha;
      arc.position.copy(end).y += effect.type === 'area' || effect.type === 'ward' ? .06 : .71;
      arc.rotation.set(effect.type === 'strike' ? -Math.PI / 4 : -Math.PI / 2, 0, age * 6);
      arc.scale.setScalar((effect.radius || 1) * (.64 + age * 1.85));
      arc.material.color.copy(flash.material.color);
      arc.material.opacity = .92 * alpha;
    }
  };
}
