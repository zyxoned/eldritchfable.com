import * as THREE from 'three';

export function randomFrom(seed) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

function noiseField(size, random) {
  const grid = Float32Array.from({ length: size * size }, random);
  const at = (x, y) => grid[(y % size) * size + x % size];
  return (u, v) => {
    const x = u * size, y = v * size;
    const i = Math.floor(x), j = Math.floor(y);
    const fx = x - i, fy = y - j;
    const s = fx * fx * (3 - 2 * fx), t = fy * fy * (3 - 2 * fy);
    return THREE.MathUtils.lerp(
      THREE.MathUtils.lerp(at(i, j), at(i + 1, j), s),
      THREE.MathUtils.lerp(at(i, j + 1), at(i + 1, j + 1), s), t,
    );
  };
}

function texture(bytes, size, color = false) {
  const result = new THREE.DataTexture(bytes, size, size, THREE.RGBAFormat);
  result.wrapS = result.wrapT = THREE.RepeatWrapping;
  result.magFilter = THREE.LinearFilter;
  result.minFilter = THREE.LinearMipmapLinearFilter;
  result.generateMipmaps = true;
  if (color) result.colorSpace = THREE.SRGBColorSpace;
  result.needsUpdate = true;
  return result;
}

function surface(seed, kind, rgb) {
  const size = 256, random = randomFrom(seed);
  const broad = noiseField(5, random), grain = noiseField(25, random), grit = noiseField(100, random);
  const diffuse = new Uint8Array(size * size * 4), relief = new Uint8Array(diffuse.length);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = x / size, v = y / size;
    const n = broad(u, v), g = grain(u, v), fine = grit(u, v);
    let height = .32 * n + .25 * g + .14 * fine;
    let tone = .67 + height * .71;
    let green = Math.max(0, n + .22 * g - .69) * .78;
    if (kind === 'stone' || kind === 'pavers' || kind === 'slate') {
      const rows = kind === 'pavers' ? 10 : kind === 'slate' ? 12 : 6;
      const cols = kind === 'pavers' ? 8 : kind === 'slate' ? 8 : 4;
      const row = v * rows + (g - .5) * .16 + .021 * Math.sin(u * 87);
      const offset = Math.sin(Math.floor(row) * 13.9) * .29;
      const column = u * cols + (Math.floor(row) % 2) * .5 + offset + (n - .5) * .19;
      const edge = Math.min(Math.abs(row - Math.round(row)), Math.abs(column - Math.round(column)));
      const block = THREE.MathUtils.smoothstep(edge, .027, .105);
      const variation = .9 + .13 * Math.sin((Math.floor(column) * 129 + Math.floor(row) * 97 + seed));
      height = .29 * height + .56 * block;
      tone *= (.37 + .63 * block) * variation;
      green += (1 - block) * Math.max(0, n - .26) * .52;
    } else if (kind === 'wood') {
      const stripe = .5 + .5 * Math.sin((u + .017 * (g - .5)) * 168 + v * 3);
      height = .21 * stripe + .37 * height;
      tone *= .69 + .39 * stripe;
    } else if (kind === 'water') {
      height = .5 + .24 * Math.sin(u * 90 + n * 3) + .13 * Math.sin(v * 76 + g * 2);
      tone = .8 + .2 * n;
      green = 0;
    }
    const offset = (y * size + x) * 4;
    const moss = [65, 75, 43];
    for (let channel = 0; channel < 3; channel++) {
      diffuse[offset + channel] = Math.min(255, Math.round(THREE.MathUtils.lerp(rgb[channel] * tone, moss[channel], green)));
      relief[offset + channel] = Math.round(height * 255);
    }
    diffuse[offset + 3] = relief[offset + 3] = 255;
  }
  return { map: texture(diffuse, size, true), bumpMap: texture(relief, size) };
}

export function makeMaterials() {
  const standard = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: .85, ...extra });
  return {
    soil: standard(0xffffff, { ...surface(31, 'earth', [91, 102, 76]), bumpScale: .14, roughness: .95 }),
    path: standard(0xffffff, { ...surface(76, 'pavers', [129, 129, 119]), bumpScale: .075, roughness: .68 }),
    masonry: standard(0xffffff, { ...surface(51, 'stone', [135, 137, 128]), bumpScale: .11, roughness: .87 }),
    stone: standard(0x879091, { ...surface(27, 'earth', [160, 167, 163]), bumpScale: .19 }),
    slate: standard(0xffffff, { ...surface(60, 'slate', [92, 111, 136]), bumpScale: .09, roughness: .71 }),
    timber: standard(0xffffff, { ...surface(90, 'wood', [113, 89, 63]), bumpScale: .07 }),
    water: standard(0x57788a, { ...surface(21, 'water', [109, 163, 188]), bumpScale: .16, roughness: .27, metalness: .59 }),
    foliage: standard(0x4b603f, { side: THREE.DoubleSide }),
    bark: standard(0x48382d),
    brass: standard(0xb79258, { roughness: .36, metalness: .39, emissive: 0x3e3024, emissiveIntensity: .24 }),
    iron: standard(0x292e38, { metalness: .41, roughness: .49 }),
    hollow: standard(0x151821),
    flame: standard(0xffc77b, { emissive: 0xff974b, emissiveIntensity: 2.9 }),
    crystal: standard(0x8bcbdc, { emissive: 0x41bbd7, emissiveIntensity: 1.1, roughness: .3 }),
  };
}

export function makeGlow() {
  const size = 64, bytes = new Uint8Array(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    const radius = Math.hypot(i % size + .5 - size / 2, Math.floor(i / size) + .5 - size / 2) / (size / 2);
    const alpha = Math.max(0, 1 - radius);
    bytes.set([255, 255, 255, Math.round(255 * alpha ** 2.8)], i * 4);
  }
  return texture(bytes, size);
}

export function disposeScene(root, disposeTextures = false) {
  const geometries = new Set(), materials = new Set(), textures = new Set();
  root.traverse(item => {
    if (item.geometry) geometries.add(item.geometry);
    for (const material of Array.isArray(item.material) ? item.material : [item.material]) {
      if (material) materials.add(material);
    }
  });
  geometries.forEach(geometry => geometry.dispose());
  materials.forEach(material => {
    if (disposeTextures) for (const value of Object.values(material)) if (value?.isTexture) textures.add(value);
    material.dispose();
  });
  textures.forEach(map => map.dispose());
}
