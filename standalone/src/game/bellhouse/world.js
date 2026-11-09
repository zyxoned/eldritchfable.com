import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { REGIONS, regionTile } from '../../../shared/world-catalog.mjs';
import { makeGlow, makeMaterials, randomFrom } from './materials';

export const UNIT = 1.8;
export const BELL_LANDING = { x: 7, y: 11 };
const glade = REGIONS.glade;

export function floorHeight(x, z) {
  return .09 * Math.sin(x * .31) * Math.cos(z * .32);
}

function mesh(parent, geometry, material, x, y, z) {
  const result = new THREE.Mesh(geometry, material);
  result.position.set(x, y, z);
  result.castShadow = result.receiveShadow = true;
  parent.add(result);
  return result;
}

function box(parent, mat, x, y, z, w, h, d) {
  return mesh(parent, new THREE.BoxGeometry(w, h, d), mat, x, y, z);
}

function pillar(parent, mat, x, z, bottom, height, width) {
  box(parent, mat, x, bottom + height / 2, z, width, height, width);
  box(parent, mat, x, bottom + .13, z, width * 1.32, .26, width * 1.32);
  box(parent, mat, x, bottom + height - .1, z, width * 1.2, .2, width * 1.2);
}

function instance(parent, geometry, material, items) {
  const instances = new THREE.InstancedMesh(geometry, material, items.length);
  const dummy = new THREE.Object3D();
  items.forEach(({ at, size, yaw = 0, pitch = 0, color }, i) => {
    dummy.position.fromArray(at);
    dummy.scale.fromArray(size);
    dummy.rotation.set(pitch, yaw, 0);
    dummy.updateMatrix();
    instances.setMatrixAt(i, dummy.matrix);
    if (color) instances.setColorAt(i, new THREE.Color(color));
  });
  instances.castShadow = instances.receiveShadow = true;
  parent.add(instances);
  return instances;
}

function terrain(scene, mats) {
  const layers = { grass: [], path: [], bridge: [], water: [] };
  const banks = [];
  for (let y = -12; y < glade.height + 5; y++) for (let x = -5; x < glade.width + 5; x++) {
    const riverX = Math.max(3, Math.min(5, 3 + Math.floor(y / 7)));
    const tile = y >= 0 && y < glade.height && x >= 0 && x < glade.width
      ? regionTile('glade', x, y)
      : x >= riverX && x <= riverX + 2 ? 'water' : 'grass';
    layers[tile].push([x, y]);
    if (tile !== 'water') continue;
    for (const side of [-1, 1]) {
      if (x + side >= riverX && x + side <= riverX + 2) continue;
      banks.push({ at: [(x + side * .51) * UNIT, -.66, y * UNIT], size: [.46, .92, 1.12], yaw: x + y });
    }
  }
  for (const [tile, cells] of Object.entries(layers)) {
    const pos = [], uv = [], colors = [];
    for (const [x, y] of cells) {
      for (const [dx, dz] of [[-.5, -.5], [-.5, .5], [.5, -.5], [.5, -.5], [-.5, .5], [.5, .5]]) {
        const wx = (x + dx) * UNIT, wz = (y + dz) * UNIT;
        const elevation = tile === 'water' ? -1.14 : tile === 'bridge' ? .1 : floorHeight(wx, wz);
        pos.push(wx, elevation, wz);
        const repeat = tile === 'water' ? 5.4 : tile === 'grass' ? 3.3 : 2.7;
        uv.push(wx / repeat, wz / repeat);
        const tint = tile === 'grass' ? .86 + .08 * Math.sin(wx * .31 + Math.cos(wz * .24)) + .055 * Math.sin(wz * .81) : 1;
        colors.push(tint, tint, tint);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.computeVertexNormals();
    const material = tile === 'water' ? mats.water : tile === 'grass' ? mats.soil : mats.path;
    material.vertexColors = true;
    const ground = mesh(scene, geometry, material, 0, 0, 0);
    ground.castShadow = false;
  }
  instance(scene, new THREE.DodecahedronGeometry(1, 0), mats.stone, banks);
}

function archRing(parent, material, x, y, z, radius, thickness, depth) {
  const gap = .018, blocks = 10;
  for (let i = 0; i < blocks; i++) {
    const low = i * Math.PI / blocks + gap, high = (i + 1) * Math.PI / blocks - gap;
    const outline = new THREE.Shape();
    outline.moveTo(Math.cos(low) * radius, Math.sin(low) * radius);
    outline.absarc(0, 0, radius, low, high, false);
    outline.lineTo(Math.cos(high) * (radius + thickness), Math.sin(high) * (radius + thickness));
    outline.absarc(0, 0, radius + thickness, high, low, true);
    outline.closePath();
    mesh(parent, new THREE.ExtrudeGeometry(outline, { depth, bevelEnabled: false, curveSegments: 2 }), material, x, y, z);
  }
}

function gabledRoof(parent, mats, center, w, d, eave, rise) {
  const [x, z] = center;
  for (const side of [-1, 1]) {
    const length = Math.hypot(w / 2, rise);
    const roof = box(parent, mats.slate, x + side * w / 4, eave + rise / 2, z, length, .19, d);
    roof.rotation.z = -side * Math.atan2(rise, w / 2);
    const gable = new THREE.Shape();
    gable.moveTo(-w / 2 + .12, 0);
    gable.lineTo(0, rise - .11);
    gable.lineTo(w / 2 - .12, 0);
    gable.closePath();
    mesh(parent, new THREE.ExtrudeGeometry(gable, { depth: .22, bevelEnabled: false }), mats.masonry,
      x, eave, z + side * (d / 2 - .17) - .11);
  }
  box(parent, mats.stone, x, eave + rise + .07, z, .28, .22, d + .19);
}

function bellhouse(scene, mats) {
  const x = 5 * UNIT, z = 8.9 * UNIT;
  const front = z + 2.02;
  box(scene, mats.stone, x, -.43, z, 4.95, 1.42, 5.38);
  box(scene, mats.masonry, x, 1.62, z, 4.1, 3.18, 4.02);
  box(scene, mats.stone, x, 3.15, z, 4.45, .25, 4.36);
  box(scene, mats.stone, x, 5.89, z, 4.48, .25, 4.4);
  for (const cornerX of [-1.82, 1.82]) for (const cornerZ of [-1.78, 1.78]) {
    pillar(scene, mats.masonry, x + cornerX, z + cornerZ, -.02, 6.05, .64);
    for (let height = .62; height < 5.7; height += .71) {
      box(scene, mats.stone, x + cornerX, height, z + cornerZ, .71, .11, .71);
    }
  }
  for (const side of [-1, 1]) {
    box(scene, mats.masonry, x + side * 1.95, 4.51, z, .34, 2.57, 4);
    box(scene, mats.masonry, x, 5.43, z + side * 1.91, 3.9, 1.03, .37);
    box(scene, mats.masonry, x, 3.47, z + side * 1.91, 3.9, .45, .37);
    archRing(scene, mats.stone, x, 4.67, z + side * 1.9, 1.18, .27, .26);
    for (const pier of [-1, 1]) box(scene, mats.masonry, x + pier * 1.52, 4.12, z + side * 1.91, .67, 1.38, .36);
  }
  box(scene, mats.hollow, x, 1.12, front + .01, 1.78, 2.04, .14);
  for (const side of [-1, 1]) {
    box(scene, mats.timber, x + side * .39, 1.07, front + .105, .76, 1.9, .14);
    box(scene, mats.iron, x + side * .39, 1.34, front + .2, .73, .085, .06);
    box(scene, mats.iron, x + side * .39, .65, front + .2, .73, .085, .06);
    pillar(scene, mats.stone, x + side * 1.02, front + .13, .19, 1.62, .32);
    const handle = mesh(scene, new THREE.TorusGeometry(.087, .022, 6, 12), mats.brass, x + side * .17, 1.11, front + .249);
    handle.castShadow = false;
  }
  archRing(scene, mats.stone, x, 1.73, front + .19, .82, .31, .22);
  for (let n = 0; n < 3; n++) box(scene, mats.path, x, -.02 + n * .105, front + .53 - n * .13, 2.63, .16 + n * .1, .86 - n * .2);
  gabledRoof(scene, mats, [x, z], 4.79, 4.83, 6.06, 1.77);
  const bell = new THREE.Group();
  bell.position.set(x, 5.36, z + 1.59);
  scene.add(bell);
  const outline = [[0, .02], [.2, .02], [.4, -.2], [.47, -.51], [.61, -.78], [.73, -.86], [.73, -.94], [.61, -.95]]
    .reverse().map(([r, y]) => new THREE.Vector2(r, y));
  mesh(bell, new THREE.LatheGeometry(outline, 32), mats.brass, 0, 0, 0);
  mesh(bell, new THREE.SphereGeometry(.115, 10, 8), mats.iron, 0, -.95, 0);
  mesh(bell, new THREE.TorusGeometry(.62, .042, 8, 28), mats.iron, 0, -.8, 0).rotation.x = Math.PI / 2;
  box(scene, mats.timber, x, 5.53, z + 1.59, 3.48, .17, .24);
  const bellLight = new THREE.PointLight(0xb9cee8, 9, 5, 2);
  bellLight.position.set(x - .5, 4.81, front + 1.2);
  scene.add(bellLight);
  return bell;
}

function bridge(scene, mats) {
  const x = 5 * UNIT, z = 12 * UNIT;
  for (const side of [-1, 1]) {
    const edge = z + side * 2.74;
    box(scene, mats.masonry, x, -.16, edge, 6.41, .5, .33);
    box(scene, mats.stone, x, .35, edge, 6.6, .46, .26);
    box(scene, mats.stone, x, .62, edge, 6.7, .12, .39);
    for (let i = -3; i <= 3; i++) pillar(scene, mats.stone, x + .99 * i, edge, .02, .87, .3);
  }
}

function cottage(scene, mats, x, z) {
  box(scene, mats.stone, x, -.45, z, 3.8, 1.34, 3.43);
  box(scene, mats.masonry, x, 1.34, z, 3.5, 2.43, 3.08);
  box(scene, mats.timber, x - .52, 1.02, z + 1.56, .81, 1.82, .13);
  box(scene, mats.hollow, x + .77, 1.61, z + 1.57, .66, .67, .08);
  box(scene, mats.timber, x + .77, 1.61, z + 1.64, .1, .67, .07);
  box(scene, mats.masonry, x + 1.03, 3.32, z - .6, .57, 2, .63);
  gabledRoof(scene, mats, [x, z], 3.89, 3.65, 2.62, 1.19);
}

function lantern(scene, mats, glow, x, z, height = 1.13) {
  pillar(scene, mats.stone, x, z, -.07, height, .24);
  const y = height + .12;
  box(scene, mats.iron, x, y, z, .43, .13, .43);
  box(scene, mats.flame, x, y + .23, z, .23, .36, .23);
  for (const dx of [-.17, .17]) for (const dz of [-.17, .17]) box(scene, mats.iron, x + dx, y + .22, z + dz, .043, .42, .043);
  mesh(scene, new THREE.ConeGeometry(.35, .26, 4), mats.iron, x, y + .52, z).rotation.y = Math.PI / 4;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glow, color: 0xffa457, opacity: .48, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  sprite.position.set(x, y + .25, z);
  sprite.scale.set(2.15, 2.15, 1);
  scene.add(sprite);
  return sprite.position;
}

function roughStone() {
  const geometry = new THREE.IcosahedronGeometry(1, 2);
  const position = geometry.attributes.position;
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i), y = position.getY(i), z = position.getZ(i);
    const strata = 1 + .12 * Math.sin(8 * y + 4 * x) * Math.sin(3 * z + 6 * x)
      + .087 * Math.cos(9 * z - 5 * y);
    position.setXYZ(i, x * strata, y * strata, z * strata);
  }
  geometry.computeVertexNormals();
  return geometry;
}

function grassClump() {
  const random = randomFrom(384), vertices = [];
  for (let blade = 0; blade < 7; blade++) {
    const angle = random() * Math.PI * 2;
    const x = .34 * Math.cos(angle), z = .34 * Math.sin(angle), y = .54 + random() * .45;
    vertices.push(-z * .24, -.5, x * .24, z * .24, -.5, -x * .24, x, y - .5, z);
    vertices.push(-z * .24, -.5, x * .24, x, y - .5, z, z * .24, -.5, -x * .24);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.computeVertexNormals();
  return geometry;
}

function firShape() {
  const vertices = [], random = randomFrom(108);
  for (let tier = 0; tier < 9; tier++) {
    const y = .83 + tier * .36;
    const radius = 1.22 - .109 * tier;
    for (let i = 0; i < 9; i++) {
      const theta = i * 2 * Math.PI / 9 + tier * 1.02 + random() * .2;
      const reach = radius * (.78 + random() * .35);
      const fx = Math.cos(theta), fz = Math.sin(theta), side = reach * .32;
      const tip = [fx * reach, y - .22 - random() * .1, fz * reach];
      const stem = [0, y + .26, 0];
      const left = [fx * reach * .43 - fz * side, y - .07, fz * reach * .43 + fx * side];
      const right = [fx * reach * .43 + fz * side, y - .04, fz * reach * .43 - fx * side];
      vertices.push(...stem, ...left, ...tip, ...stem, ...tip, ...right);
      for (let k = 0; k < 4; k++) {
        const t = .25 + k * .135, branch = reach * (.36 - k * .044);
        const bx = fx * reach * t, bz = fz * reach * t, by = y + .1 - t * .29;
        for (const sign of [-1, 1]) {
          vertices.push(bx, by, bz,
            bx - sign * fz * branch + fx * branch * .49, by - .14, bz + sign * fx * branch + fz * branch * .49,
            bx + fx * branch * .64, by - .073, bz + fz * branch * .64);
        }
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.computeVertexNormals();
  return geometry;
}

function landscape(scene, mats) {
  const random = randomFrom(6132);
  const firs = [], trunks = [], stones = [], pebbles = [], weeds = [];
  for (let i = 0; i < 184; i++) {
    const x = -7 + random() * 70;
    const z = -18 + random() * 50;
    const cellX = Math.round(x / UNIT), cellY = Math.round(z / UNIT);
    const boundary = cellX <= 0 || cellX >= 29 || cellY < 1;
    const ravine = cellX >= 4 && cellX <= 6 && cellY >= 2 && cellY <= 7;
    if (!boundary && !ravine) continue;
    if (x > 5 && x < 12 && z > 7 && z < 15) continue;
    const height = .85 + random() * 1.27;
    const tint = new THREE.Color().setHSL(.26 + random() * .1, .24 + random() * .2, .31 + random() * .23);
    firs.push({ at: [x, 0, z], size: [height, height, height], yaw: random() * 6.28, color: tint });
    trunks.push({ at: [x, height * 1.85, z], size: [height, height, height], yaw: 0 });
  }
  for (let i = 0; i < 115; i++) {
    const x = -6 + random() * 70;
    const z = -18 + random() * 43;
    if (x > 2 && x < 55 && z > -1) continue;
    const height = 1 + random() * (z < 0 ? 6.7 : 3.1);
    stones.push({ at: [x, height * .29 - .4, z], size: [1.3 + random() * 4, height, 1.1 + random() * 3],
      yaw: random() * 6.28, pitch: (random() - .5) * .45,
      color: new THREE.Color().setScalar(.63 + random() * .37) });
  }
  for (let i = 0; i < 560; i++) {
    const x = -2 + random() * 60, z = -4 + random() * 44;
    const type = regionTile('glade', Math.round(x / UNIT), Math.round(z / UNIT));
    if (type !== 'grass') continue;
    const height = .09 + random() * .26;
    const tint = new THREE.Color().setHSL(.18 + random() * .13, .27, .28 + random() * .25);
    weeds.push({ at: [x, floorHeight(x, z) + height / 2, z], size: [.18 + random() * .37, height, .28],
      yaw: random() * 6.28, pitch: .15, color: tint });
    if (i % 4 === 0) {
      pebbles.push({ at: [x + .14, floorHeight(x, z) + .04, z + .09],
        size: [.1 + random() * .32, .07 + random() * .14, .12 + random() * .32],
        yaw: random() * 6.28, color: new THREE.Color().setScalar(.72 + random() * .28) });
    }
  }
  instance(scene, roughStone(), mats.stone, stones);
  instance(scene, new THREE.DodecahedronGeometry(1, 0), mats.stone, pebbles);
  instance(scene, new THREE.CylinderGeometry(.038, .13, 3.7, 6), mats.bark, trunks);
  instance(scene, firShape(), mats.foliage, firs);
  instance(scene, grassClump(), mats.foliage, weeds).castShadow = false;
}

function shrineAndCamp(scene, mats, glow) {
  const x = glade.shrine.x * UNIT, z = glade.shrine.y * UNIT;
  mesh(scene, new THREE.CylinderGeometry(1.73, 1.96, .31, 12), mats.path, x, .1, z);
  const marker = mesh(scene, new THREE.OctahedronGeometry(.63), mats.crystal, x, 1.31, z);
  marker.scale.set(.55, 1.1, .55);
  for (const side of [-1, 1]) pillar(scene, mats.masonry, x + side * 1.45, z, 0, 1.92, .28);
  for (const stone of glade.crystals) {
    const m = mesh(scene, new THREE.OctahedronGeometry(.36), mats.crystal, stone.x * UNIT, .41, stone.y * UNIT);
    m.scale.set(.7, 1.3, .7);
  }
  const sx = glade.spawn.x * UNIT + 1.1, sz = glade.spawn.y * UNIT + 1.23;
  for (let i = 0; i < 8; i++) {
    const theta = i * Math.PI / 4;
    mesh(scene, new THREE.DodecahedronGeometry(.17, 0), mats.stone, sx + .46 * Math.cos(theta), .11, sz + .46 * Math.sin(theta));
  }
  mesh(scene, new THREE.ConeGeometry(.27, .64, 7), mats.flame, sx, .38, sz);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: 0xffa05e, opacity: .58,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  halo.position.set(sx, .43, sz);
  halo.scale.setScalar(2.9);
  scene.add(halo);
  return halo.position;
}

function sky(scene) {
  const skyMaterial = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    vertexShader: 'varying vec3 ray; void main(){ ray=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: [
      'varying vec3 ray;',
      'void main(){',
      'vec3 d = normalize(ray);',
      'float h=clamp(d.y,0.,1.);',
      'vec3 c=mix(vec3(.095,.137,.188),vec3(.023,.042,.081),pow(h,.52));',
      'float moon=max(dot(d, normalize(vec3(-.36,.34,-1.))),0.);',
      'c+=vec3(.12,.17,.23)*pow(moon,45.)+vec3(.57,.64,.72)*smoothstep(.9994,.9997,moon);',
      'gl_FragColor=vec4(c,1.);',
      '#include <colorspace_fragment>',
      '}',
    ].join('\n'),
  });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(155, 28, 14), skyMaterial);
  dome.position.set(14, 0, 11);
  scene.add(dome);
}

function makeRavineMist(scene) {
  const material = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    uniforms: { flow: { value: 0 } },
    vertexShader: 'varying vec2 v; void main(){ v=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }',
    fragmentShader: [
      'varying vec2 v; uniform float flow;',
      'float fog(vec2 p){',
      'return .48 + .21*sin(p.x*8.+cos(p.y*13.))+ .17*sin(p.y*26.-cos(p.x*17.)) + .09*cos(p.y*55.+p.x*19.);',
      '}',
      'void main(){',
      'float edge=smoothstep(0.,.2,v.x)*(1.-smoothstep(.8,1.,v.x))*smoothstep(0.,.13,v.y)*(1.-smoothstep(.85,1.,v.y));',
      'float w=fog(vec2(v.x+flow*.018,v.y-flow*.032));',
      'gl_FragColor=vec4(.34,.45,.56,edge*smoothstep(.32,.94,w)*.31);',
      '#include <colorspace_fragment>',
      '}',
    ].join('\n'),
  });
  for (const [x, y, z, width, length] of [[7.3, -.42, 3.8, 10.6, 31], [10.3, -.18, 29.3, 8.7, 22]]) {
    const layer = new THREE.Mesh(new THREE.PlaneGeometry(width, length), material);
    layer.rotation.x = -Math.PI / 2;
    layer.position.set(x, y, z);
    scene.add(layer);
  }
  return material.uniforms.flow;
}

function batchArchitecture(group) {
  group.updateMatrixWorld(true);
  const byMaterial = new Map();
  for (const object of [...group.children]) {
    if (!object.isMesh) continue;
    const batch = byMaterial.get(object.material) || [];
    batch.push(object);
    byMaterial.set(object.material, batch);
  }
  for (const [material, objects] of byMaterial) {
    if (objects.length < 2) continue;
    const parts = objects.map(object => {
      const geometry = object.geometry.index ? object.geometry.toNonIndexed() : object.geometry.clone();
      return geometry.applyMatrix4(object.matrix);
    });
    const merged = mergeGeometries(parts);
    parts.forEach(part => part.dispose());
    if (!merged) continue;
    mesh(group, merged, material, 0, 0, 0);
    for (const object of objects) {
      object.geometry.dispose();
      object.removeFromParent();
    }
  }
}

export function createWorld(scene, smallScreen) {
  const mats = makeMaterials(), glow = makeGlow();
  scene.background = new THREE.Color(0x1c2938);
  scene.fog = new THREE.FogExp2(0x1b2837, .032);
  sky(scene);
  const ambient = new THREE.HemisphereLight(0xa2b9dd, 0x665c50, 1.58);
  scene.add(ambient);
  const moon = new THREE.DirectionalLight(0xbecff3, 2.45);
  moon.position.set(-8, 26, -14);
  moon.target.position.set(21, 0, 17);
  moon.castShadow = true;
  const extent = 37;
  Object.assign(moon.shadow.camera, { left: -extent, right: extent, top: extent, bottom: -extent, near: 1, far: 85 });
  moon.shadow.mapSize.setScalar(smallScreen ? 1024 : 2048);
  moon.shadow.radius = 2.6;
  moon.shadow.normalBias = .075;
  moon.shadow.bias = -.00015;
  scene.add(moon, moon.target);
  terrain(scene, mats);
  const mist = makeRavineMist(scene);
  landscape(scene, mats);
  const architecture = new THREE.Group();
  scene.add(architecture);
  bridge(architecture, mats);
  const bell = bellhouse(architecture, mats);
  cottage(architecture, mats, 5.5 * UNIT, 15.5 * UNIT);
  batchArchitecture(architecture);
  const lights = [
    lantern(scene, mats, glow, 7.1 * UNIT, 10.25 * UNIT),
    lantern(scene, mats, glow, 7.12 * UNIT, 13.72 * UNIT),
    lantern(scene, mats, glow, 4.15 * UNIT, 8.9 * UNIT, 1.56),
    lantern(scene, mats, glow, 7.05 * UNIT, 15.12 * UNIT),
    shrineAndCamp(scene, mats, glow),
  ].map(position => {
    const light = new THREE.PointLight(0xffa861, 12, 7, 2);
    light.position.copy(position);
    scene.add(light);
    return light;
  });
  const pulse = mesh(scene, new THREE.RingGeometry(.88, 1, 64), new THREE.MeshBasicMaterial({
    color: 0xa0b9df, opacity: 0, transparent: true, depthWrite: false, side: THREE.DoubleSide,
  }), bell.position.x, .16, bell.position.z);
  pulse.rotation.x = -Math.PI / 2;
  pulse.castShadow = false;
  pulse.visible = false;
  const ringOrigin = new THREE.Vector3(bell.position.x, .16, bell.position.z);
  return {
    glow,
    update(time, sinceRing, reducedMotion) {
      mist.value = time;
      mats.water.bumpMap.offset.set(.016 * time, .009 * time);
      lights.forEach((light, i) => { light.intensity = 12 + .8 * Math.sin(time * 3.9 + i * 1.73); });
      const ringing = sinceRing >= 0 && sinceRing < 3;
      bell.rotation.z = ringing && !reducedMotion ? Math.sin(sinceRing * 11) * .2 * Math.exp(-sinceRing * 1.2) : 0;
      pulse.visible = ringing && !reducedMotion;
      if (pulse.visible) {
        pulse.position.copy(ringOrigin);
        pulse.scale.setScalar(.8 + 5 * sinceRing);
        pulse.material.opacity = .37 * Math.exp(-sinceRing * 1.1);
      }
    },
  };
}
