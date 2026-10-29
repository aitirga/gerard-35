import * as pc from 'playcanvas';
import type { Effects } from './effects';
import type { GeoScene } from './geo';

/**
 * El Palacio de la Reina Bubbaloo seen from outside (docs/bubbaloo-palace.md). Local space: the
 * origin is the middle of the gate at ground level and +z faces whoever approaches it, so the same
 * palace can stand at the end of Passatge Maresme now and on top of Gerard's school later.
 * `grow(t)` inflates it piece by piece (0 = nothing, 1 = standing).
 */
const FLAVOURS = ['#ff4d7a', '#7fe0c0', '#9a5cd6', '#ffe066', '#2a1a24'];
/** Bubble-gum overshoot: grows past its size and settles back. */
function stretch(k: number) {
  if (k <= 0) return 0;
  if (k >= 1) return 1;
  const c1 = 1.9, c3 = c1 + 1;
  return 1 + c3 * (k - 1) ** 3 + c1 * (k - 1) ** 2;
}
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/**
 * A building the palace grows out of (chapter 2's Rec Comtal school): its middle, width and depth
 * in world space with its front wall facing +z, its height and the street's height at its door.
 */
export interface Footing { x: number; z: number; width: number; depth: number; height: number; ground: number }
/** The building under a scene's `palace` anchor, as the palace's footing (an unturned box). */
export function footingOf(scene: GeoScene, toWorld: (x: number, z: number) => pc.Vec3, groundHeight: (x: number, z: number) => number): Footing | undefined {
  const anchor = scene.anchors?.palace;
  const building = anchor && scene.buildings.find(({ box }) => Math.abs(anchor.x - box.cx) <= box.w / 2 && Math.abs(anchor.z - box.cz) <= box.d / 2);
  if (!building) return undefined;
  const { cx, cz, w, d } = building.box, at = toWorld(cx, cz);
  return { x: at.x, z: at.z, width: w, depth: d, height: building.height, ground: groundHeight(at.x, at.z + d / 2 + .5) };
}
/**
 * How the palace sits on a footing: the gate and its ramparts stand in the street at `street`
 * scale, set `inset` into the front wall; everything else stands on a layer of gum `gum` thick on
 * the roof, no deeper than the roof (`BODY_DEPTH` is the keep and wings' depth at scale 1).
 */
const SEAT = { street: 1.3, inset: .3, gum: .3, margin: .5 };
const BODY_DEPTH = 6;
/**
 * Where the fortress' spiked towers stand round a footing, in world units from the middle of its
 * roof (+z towards the street), in the order of the ring below: small ones on the roof's corners
 * and beside its ends, tall ones behind it. Their feet reach the street.
 */
const RING_ON_FOOTING = [
  [-17, -4.3], [17, -4.3], [-13, -8.5], [13, -8.5], [-7.5, -10.5], [7.5, -10.5], [-2.5, -12], [2.5, -12],
  [-23.5, -1], [23.5, -1], [-19, 4.2], [19, 4.2],
];

export interface PalaceKit {
  materials: pc.StandardMaterial[];
  meshes: pc.Mesh[];
  mat(hex: string, gloss?: number, glow?: number, opacity?: number): pc.StandardMaterial;
  part(parent: pc.Entity, name: string, type: pc.RenderComponent['type'], m: pc.Material, p: number[], s: number[], r?: number[], shadows?: boolean): pc.Entity;
  ring(parent: pc.Entity, name: string, m: pc.Material, ringRadius: number, tubeRadius: number, p: number[], r?: number[], sector?: number): pc.Entity;
}
/** Shared builders so the palace, its street dressing and its interior look like one building. */
export function palaceKit(app: pc.Application): PalaceKit {
  const materials: pc.StandardMaterial[] = [];
  const meshes: pc.Mesh[] = [];
  return {
    materials, meshes,
    mat(hex, gloss = .8, glow = 0, opacity = 1) {
      const m = new pc.StandardMaterial(); m.diffuse.fromString(hex); m.gloss = gloss; m.useMetalness = false;
      m.specular.set(.5, .42, .48);
      if (glow) { m.emissive.fromString(hex); m.emissiveIntensity = glow; }
      if (opacity < 1) { m.opacity = opacity; m.blendType = pc.BLEND_NORMAL; m.depthWrite = false; }
      m.update(); materials.push(m); return m;
    },
    part(parent, name, type, m, p, s, r = [0, 0, 0], shadows = true) {
      const e = new pc.Entity(name); e.addComponent('render', { type, material: m, castShadows: shadows, receiveShadows: true });
      e.setLocalPosition(p[0], p[1], p[2]); e.setLocalScale(s[0], s[1], s[2]); e.setLocalEulerAngles(r[0], r[1], r[2]);
      parent.addChild(e); return e;
    },
    ring(parent, name, m, ringRadius, tubeRadius, p, r = [0, 0, 0], sector = 360) {
      const mesh = pc.Mesh.fromGeometry(app.graphicsDevice, new pc.TorusGeometry({ ringRadius, tubeRadius, sectorAngle: sector, segments: 40, sides: 16 }));
      meshes.push(mesh);
      const e = new pc.Entity(name); e.addComponent('render', { meshInstances: [new pc.MeshInstance(mesh, m)], castShadows: true, receiveShadows: true });
      e.setLocalPosition(p[0], p[1], p[2]); e.setLocalEulerAngles(r[0], r[1], r[2]);
      parent.addChild(e); return e;
    },
  };
}

export function createPalace(app: pc.Application, effects: Effects) {
  const kit = palaceKit(app);
  const { mat, part, ring } = kit;
  const gum = mat('#ff6fae', .85, .06), gumDeep = mat('#d94a8c', .8, .04), plum = mat('#6e2453', .6);
  const wrapper = mat('#fbeef3', .7, .05), dark = mat('#2c0d22', .5, .15), glass = mat('#3a0f2c', .9, .35);
  const core = mat('#ff3d8b', .6, 1.8), skin = mat('#ffb3d6', .95, .2, .38), membraneSkin = mat('#ff9cc8', .95, .3, .55);
  const flavours = FLAVOURS.map(hex => mat(hex, .9, .15));

  const root = new pc.Entity('Palacio de la Reina Bubbaloo'); app.root.addChild(root);
  // The gate's side of the palace and the rest of it, apart so the rest can sit on a roof (`seat`).
  const street = new pc.Entity('Frente del palacio'), body = new pc.Entity('Cuerpo del palacio');
  root.addChild(street); root.addChild(body);
  /** Each piece grows from its own base, starting at `delay` of the whole growth. */
  const pieces: { pivot: pc.Entity; delay: number }[] = [];
  function piece(name: string, x: number, z: number, delay: number, parent = body) {
    const pivot = new pc.Entity(name); pivot.setLocalPosition(x, 0, z); parent.addChild(pivot);
    pieces.push({ pivot, delay }); return pivot;
  }
  const drips: { entity: pc.Entity; length: number; phase: number }[] = [];
  function drip(parent: pc.Entity, m: pc.Material, x: number, y: number, z: number, length: number, width = .22) {
    const e = part(parent, 'Goterón', 'sphere', m, [x, y - length / 2, z], [width, length, width], [0, 0, 0], false);
    drips.push({ entity: e, length, phase: x * 1.7 + y * .9 + z });
  }
  const cores: pc.Entity[] = [];
  /** A translucent gum bubble with a glowing liquid centre: the palace's lights. */
  function dome(parent: pc.Entity, x: number, y: number, z: number, size: number) {
    part(parent, 'Cúpula de pompa', 'sphere', skin, [x, y, z], [size, size * .92, size], [0, 0, 0], false);
    cores.push(part(parent, 'Centro líquido', 'sphere', core, [x, y - size * .08, z], [size * .42, size * .42, size * .42], [0, 0, 0], false));
  }
  /** Stacked square segments, each turned a little more: the twisted end of a Bubbaloo wrapper. */
  function twist(parent: pc.Entity, size: number, segments: number, height: number, y0 = 0) {
    const step = height / segments;
    for (let k = 0; k < segments; k++) {
      const flare = 1 + Math.max(0, k - segments + 3) * .12;
      part(parent, 'Envoltorio retorcido', 'box', k % 2 ? wrapper : gum, [0, y0 + step * (k + .5), 0], [size * flare, step * 1.02, size * flare], [0, k * 23, 0]);
    }
    return y0 + height;
  }

  // ——— The plinth: a slab of plum gum the palace stands on ———
  const base = piece('Base de chicle', 0, -6.6, .28);
  const slab = part(base, 'Losa de chicle', 'box', plum, [0, -.45, 0], [26, .9, 13.6]);
  const edge = part(base, 'Borde redondeado', 'cylinder', plum, [0, -.05, 6.75], [.9, 26, .9], [0, 0, 90]);

  // ——— Muralla de chicle: two stretches of rampart either side of the gate ———
  for (const side of [-1, 1]) {
    const wall = piece('Muralla de chicle', side * 6.5, 0, .36 + (side > 0 ? .03 : 0), street);
    part(wall, 'Muralla', 'box', gumDeep, [0, 1.2, 0], [9.1, 2.4, .9]);
    part(wall, 'Remate redondo', 'cylinder', gum, [0, 2.4, 0], [1.05, 9.1, 1.05], [0, 0, 90]);
    for (let x = -4.1; x <= 4.15; x += .82) drip(wall, gum, x + Math.sin(x * 3) * .12, 2.25, .48, .35 + (Math.sin(x * 7.3) * .5 + .5) * .8);
    // Two lanterns of liquid centre set into the rampart, facing the street.
    for (const x of [-2.2, 2.2]) {
      part(wall, 'Hornacina', 'sphere', dark, [x, 1.3, .44], [.7, .9, .12], [0, 0, 0], false);
      cores.push(part(wall, 'Farol líquido', 'sphere', core, [x, 1.3, .5], [.32, .32, .32], [0, 0, 0], false));
    }
  }

  // ——— La Pompa: a round gum-ball mouth with a bubble stretched across it ———
  const gate = piece('La Pompa', 0, 0, .44, street);
  for (const side of [-1, 1]) {
    part(gate, 'Pilar de la puerta', 'cylinder', gumDeep, [side * 2.25, 1.6, 0], [1.3, 3.2, 1.3]);
    part(gate, 'Bola del pilar', 'sphere', gum, [side * 2.25, 3.45, 0], [1.5, 1.4, 1.5]);
    part(gate, 'Bola de sabor', 'sphere', flavours[side > 0 ? 1 : 2], [side * 2.25, 4.3, 0], [.6, .6, .6]);
  }
  ring(gate, 'Labio de chicle', gum, 1.85, .48, [0, 1.55, .15], [90, 0, 0]);
  part(gate, 'Interior oscuro', 'cylinder', dark, [0, 1.55, .5], [3.7, .08, 3.7], [90, 0, 0], false);
  const membrane = part(gate, 'Pompa de la puerta', 'sphere', membraneSkin, [0, 1.55, .62], [3.5, 3.5, .7], [0, 0, 0], false);
  const shine = mat('#fff0f7', .9, .8);
  const glint = part(gate, 'Brillo de la pompa', 'sphere', shine, [-.75, 2.35, .92], [.5, .26, .08], [0, 0, 30], false);

  // ——— Torres de envoltorio: twisted wrapper towers with a bubble dome on top ———
  const towers: pc.Entity[] = [];
  for (const side of [-1, 1]) {
    const tower = piece('Torre de envoltorio', side * 4.7, -1.7, .5 + (side > 0 ? .05 : 0), street);
    towers.push(tower);
    const top = twist(tower, 1.55, 9, 7.2);
    part(tower, 'Remate del envoltorio', 'cone', gum, [0, top + .5, 0], [2.6, 1.1, 2.6], [180, 0, 0]);
    dome(tower, 0, top + 1.55, 0, 2.3);
    drip(tower, gum, .75, top + .05, .75, .9, .2);
    drip(tower, gum, -.7, top + .05, .78, .6, .18);
  }

  // ——— Las alas: barrel-vaulted gum halls between the towers and the keep ———
  const wings: pc.Entity[] = [];
  for (const side of [-1, 1]) {
    const wing = piece('Ala del palacio', side * 8.4, -4.8, .6);
    wings.push(wing);
    part(wing, 'Nave', 'box', gumDeep, [0, 2, 0], [4.4, 4, 5.4]);
    part(wing, 'Bóveda', 'cylinder', gum, [0, 4, 0], [4.4, 5.4, 2.4], [90, 0, 0]);
    for (const x of [-1.1, 1.1]) {
      part(wing, 'Ventana ovalada', 'sphere', plum, [x, 2.2, 2.68], [.95, 1.7, .12], [0, 0, 0], false);
      part(wing, 'Cristal rosa', 'sphere', glass, [x, 2.2, 2.73], [.7, 1.4, .08], [0, 0, 0], false);
    }
    for (let x = -1.9; x <= 1.95; x += .6) drip(wing, gum, x, 4.15, 2.72, .3 + (Math.sin(x * 5 + side) * .5 + .5) * .7);
    dome(wing, side * .6, 5.65, 0, 1.6);
  }

  // ——— Torre de la Corona: the keep, with the Queen's balcony over the street ———
  const keep = piece('Torre de la Corona', 0, -7, .66);
  part(keep, 'Torre', 'cylinder', gumDeep, [0, 4.6, 0], [5.8, 9.2, 5.8]);
  part(keep, 'Anillo de chicle', 'cylinder', gum, [0, 9.25, 0], [6.3, .5, 6.3]);
  part(keep, 'Tambor', 'cylinder', gum, [0, 10.3, 0], [5, 1.6, 5]);
  for (let i = 0; i < 14; i++) {
    const a = i / 14 * Math.PI * 2, rx = Math.sin(a), rz = Math.cos(a);
    if (rz < -.3) continue;
    drip(keep, gum, rx * 3.12, 9.1, rz * 3.12, .5 + (Math.sin(i * 2.7) * .5 + .5) * 1.4, .28);
  }
  // Tall oval windows lit from inside, and two pink-and-white banners.
  for (const [y, h] of [[3, 1.9], [8, 1.1]]) {
    part(keep, 'Ventana de la torre', 'sphere', plum, [0, y, 2.88], [1.1, h, .14], [0, 0, 0], false);
    part(keep, 'Cristal encendido', 'sphere', glass, [0, y, 2.94], [.82, h * .82, .1], [0, 0, 0], false);
  }
  for (const side of [-1, 1]) {
    const x = side * 1.75, z = 2.38;
    for (let k = 0; k < 5; k++) part(keep, 'Estandarte', 'box', k % 2 ? wrapper : gum, [x, 7.7 - k * .5, z], [.75, .5, .06], [0, side * 32, 0], false);
    part(keep, 'Punta del estandarte', 'cone', gum, [x, 5.05, z], [.75, .5, .06], [180, side * 32, 0], false);
  }
  // The balcony: a half-round platform with a balustrade of gum balls and a dark doorway.
  const balcony = new pc.Entity('Balcón de la Reina'); balcony.setLocalPosition(0, 5.4, 2.7); keep.addChild(balcony);
  part(balcony, 'Suelo del balcón', 'cylinder', gum, [0, 0, 0], [2.8, .3, 2.2]);
  ring(balcony, 'Moldura del balcón', gumDeep, 1.25, .16, [0, -.2, .1], [0, 0, 0], 180).setLocalEulerAngles(0, 180, 0);
  for (let i = 0; i <= 6; i++) {
    const a = (i / 6 - .5) * Math.PI * .95;
    part(balcony, 'Barandilla de bolas', 'sphere', flavours[i % FLAVOURS.length], [Math.sin(a) * 1.25, .4, Math.cos(a) * 1.0], [.32, .32, .32], [0, 0, 0], false);
  }
  part(balcony, 'Pasamanos', 'cylinder', wrapper, [0, .62, .95], [.1, 2.3, .1], [0, 0, 90], false);
  part(balcony, 'Puerta del balcón', 'sphere', dark, [0, 1.15, .2], [1.1, 1.9, .1], [0, 0, 0], false);

  // The crown: soft gum points around a dome, a gum ball of each flavour on top, a bubble above all.
  const crown = piece('Corona', 0, -7, .78);
  ring(crown, 'Aro de la corona', gum, 2.35, .32, [0, 11.15, 0], [0, 0, 0]);
  part(crown, 'Cúpula de la corona', 'sphere', gumDeep, [0, 11.2, 0], [4, 2.8, 4]);
  for (let i = 0; i < 7; i++) {
    const a = i / 7 * Math.PI * 2 + .2, rx = Math.sin(a), rz = Math.cos(a);
    part(crown, 'Punta de la corona', 'cone', gum, [rx * 2.25, 12.15, rz * 2.25], [.85, 1.9, .85], [rz * -9, 0, rx * 9]);
    part(crown, 'Bola de sabor', 'sphere', flavours[i % FLAVOURS.length], [rx * 2.42, 13.25, rz * 2.42], [.62, .62, .62]);
  }
  dome(crown, 0, 13.4, 0, 1.9);

  // ——— La Fortaleza (chapter 2): what the palace grows into over Barcelona ———
  // Every piece has a threat `threshold`: it stands while the castle's threat is above it, so
  // as Gerard and Aitor help people the towers fall one by one (docs/chapter-2.md). At 0 (the
  // dream of chapter 1) none of it is there.
  const thorn = mat('#4a1033', .55), thornDark = mat('#22061a', .45), slit = mat('#ff2f7a', .6, 2.4);
  const cloud = mat('#2a0b20', .2, 0, .82), cloudLight = mat('#5c1a45', .2, 0, .7), bolt = mat('#ffb3d9', .4, 3.5, .9);
  const menace: { pivot: pc.Entity; threshold: number }[] = [];
  /** The spiked towers: where each stands in the palace and round a footing (`seat`), and its foot. */
  const spires: { pivot: pc.Entity; stem: pc.Entity; radius: number; threshold: number; at: readonly number[]; onFooting: readonly number[] }[] = [];
  function threatening(name: string, x: number, y: number, z: number, threshold: number, parent = body) {
    const pivot = new pc.Entity(name); pivot.setLocalPosition(x, y, z); parent.addChild(pivot);
    pivot.enabled = false; menace.push({ pivot, threshold }); return pivot;
  }
  /** A spiked tower: dark gum trunk, thorns, a lit slit up its face, a needle spire and a gum ball. */
  function spikeTower(x: number, z: number, height: number, radius: number, threshold: number, seed: number, onFooting: readonly number[]) {
    const t = threatening('Torre de espina', x, 0, z, threshold);
    // The stem reaches down to the ground when the palace sits on a roof (`setFoundation`).
    const stem = part(t, 'Pie de la torre', 'cylinder', thornDark, [0, -.5, 0], [radius * 2.1, 1, radius * 2.1]);
    spires.push({ pivot: t, stem, radius: radius * 1.05, threshold, at: [x, z], onFooting });
    const rings = Math.max(3, Math.round(height / 2.2));
    for (let k = 0; k < rings; k++) {
      const taper = 1 - k / rings * .45, y = (k + .5) * height / rings;
      part(t, 'Tronco de espina', 'cylinder', k % 2 ? thorn : gumDeep, [0, y, 0], [radius * 2 * taper, height / rings * 1.02, radius * 2 * taper], [0, k * 17 + seed * 40, 0]);
      // Thorns sticking out, turning round the trunk.
      const a = (k * 2.1 + seed) % (Math.PI * 2);
      part(t, 'Espina', 'cone', thornDark, [Math.sin(a) * radius * taper, y, Math.cos(a) * radius * taper], [radius * .55, radius * 1.3, radius * .55], [Math.cos(a) * 80, 0, -Math.sin(a) * 80]);
    }
    part(t, 'Rendija encendida', 'box', slit, [0, height * .55, radius * .86], [radius * .32, height * .55, .12], [0, 0, 0], false);
    part(t, 'Almenas de espina', 'cylinder', thorn, [0, height + .2, 0], [radius * 2.5, .5, radius * 2.5]);
    for (let i = 0; i < 6; i++) {
      const a = i / 6 * Math.PI * 2 + seed;
      part(t, 'Pincho', 'cone', thornDark, [Math.sin(a) * radius * 1.1, height + .9, Math.cos(a) * radius * 1.1], [radius * .5, 1.3, radius * .5], [0, 0, 0]);
    }
    part(t, 'Aguja', 'cone', thornDark, [0, height + 3.2, 0], [radius * 1.5, 5.6, radius * 1.5]);
    cores.push(part(t, 'Ojo de la torre', 'sphere', core, [0, height + 6.3, 0], [radius * .9, radius * .9, radius * .9], [0, 0, 0], false));
    for (const [dx, length] of [[radius * .7, 1.2], [-radius * .6, .8]]) drip(t, gum, dx, height + .1, radius * .6, length, .22);
  }
  // A ring of spiked towers round the back and sides, tallest behind the keep. Thresholds go from
  // the small outer ones (first to fall) to the tall ones guarding the keep (last to fall).
  const ring_ = [
    [-15, -3, 10, 1.1], [15, -3, 10, 1.1], [-13, -11, 14, 1.3], [13, -11, 14, 1.3],
    [-9, -15, 18, 1.4], [9, -15, 18, 1.4], [-4, -16.5, 22, 1.5], [4, -16.5, 22, 1.5],
    [-17.5, -8, 12, 1.2], [17.5, -8, 12, 1.2], [-11, 2.6, 8, 1], [11, 2.6, 8, 1],
  ];
  const order = [10, 11, 8, 9, 0, 1, 2, 3, 4, 5, 6, 7];
  order.forEach((i, rank) => { const [x, z, hgt, r] = ring_[i]; spikeTower(x, z, hgt, r, .94 - rank / order.length * .82, i * 1.7, RING_ON_FOOTING[i]); });
  // Thorns along both ramparts.
  for (const side of [-1, 1]) {
    const spikes = threatening('Espinas de la muralla', side * 6.5, 2.6, 0, .3, street);
    for (let x = -4; x <= 4; x += 1) part(spikes, 'Espina de muralla', 'cone', thornDark, [x, .55, .1], [.35, 1.2, .35], [0, 0, side * (x % 2 ? 12 : -8)]);
  }
  // The keep looks down at the street: two slanted, glowing eyes under the crown.
  const eyes = threatening('Ojos de la torre', 0, 0, -7, .7);
  for (const side of [-1, 1]) {
    part(eyes, 'Ceja', 'box', thornDark, [side * .95, 9.05, 2.86], [1.5, .28, .3], [0, 0, side * -18]);
    part(eyes, 'Ojo encendido', 'sphere', slit, [side * .95, 8.55, 2.9], [1.2, .45, .2], [0, 0, side * -12], false);
  }
  // A storm over the crown: lumps of dark cloud turning slowly, lit from inside now and then.
  const storm = threatening('Tormenta', 0, 21, -7, .55);
  for (let i = 0; i < 14; i++) {
    const a = i / 14 * Math.PI * 2, r = 6 + (i % 3) * 2.2, size = 3.4 + (i % 4) * .9;
    part(storm, 'Nube', 'sphere', i % 3 ? cloud : cloudLight, [Math.sin(a) * r, (i % 2) * .8, Math.cos(a) * r], [size * 1.4, size * .7, size], [0, 0, 0], false);
  }
  const flashes = [0, 1, 2].map(i => part(storm, 'Relámpago', 'box', bolt, [Math.sin(i * 2.1) * 5, -2.5, Math.cos(i * 2.1) * 5], [.25, 5, .25], [0, 0, 18 - i * 15], false));
  let threat = 0, foundation = 0;
  /** The castle's threat, 0 (the dream) to 1 (at its worst): pieces stand while it is above their threshold. */
  function setThreat(level: number) {
    threat = clamp01(level);
    for (const m of menace) m.pivot.enabled = threat > m.threshold;
    // The gum itself darkens as she grows stronger.
    gumDeep.diffuse.lerp(new pc.Color().fromString('#d94a8c'), new pc.Color().fromString('#8a1d5c'), threat); gumDeep.update();
  }
  /** How far below the palace's base the ground is (it sits on a roof): tower stems reach down to it. */
  function setFoundation(depth: number) {
    foundation = Math.max(0, depth);
    for (const { stem } of spires) { stem.setLocalScale(stem.getLocalScale().x, foundation + .02, stem.getLocalScale().z); stem.setLocalPosition(0, -foundation / 2, 0); }
  }
  setThreat(0);

  // ——— Grown out of a building (chapter 2): the school's door is the gate ———
  // Gum from the roof down the front wall and a runner from the gate to the kerb, made for the
  // first footing the palace sits on.
  let dressing: pc.Entity | undefined;
  function dress(footing: Footing) {
    dressing = new pc.Entity('Chicle sobre la escuela'); root.addChild(dressing);
    const front = SEAT.inset, top = footing.height - footing.ground + SEAT.gum;
    // Drips run down the front wall from the lip of gum on the roof, a few of them long tongues
    // that reach down to the ramparts.
    for (let x = -footing.width / 2 + .5; x <= footing.width / 2 - .4; x += .75) {
      const wave = Math.sin(x * 1.9) * .5 + .5, tongue = Math.sin(x * .73 + 1) > .86;
      drip(dressing, gum, x + Math.sin(x * 5.1) * .15, top - .1, front + .08, tongue ? 2.6 + wave * 1.2 : .35 + wave * 1.1, tongue ? .34 : .26);
    }
    // The runner from under the bubble to the kerb, with a wrapper-white edge.
    const from = .7, to = 4.2;
    const runner = new pc.Entity('Alfombra de chicle'); runner.setLocalPosition(0, .07, (from + to) / 2); dressing.addChild(runner);
    part(runner, 'Alfombra', 'box', gumDeep, [0, 0, 0], [1.6, .03, to - from], [0, 0, 0], false);
    for (const side of [-1, 1]) part(runner, 'Ribete', 'box', wrapper, [side * .83, .005, 0], [.1, .035, to - from], [0, 0, 0], false);
  }
  /** The palace's own layout, where it stands on its own (chapter 1). */
  const layout = {
    towers: towers.map(t => t.getLocalPosition().clone()), wings: wings.map(w => w.getLocalPosition().clone()),
    base: base.getLocalPosition().clone(), slab: slab.getLocalScale().clone(), edge: [edge.getLocalPosition().clone(), edge.getLocalScale().clone()] as const,
  };
  let seated: Footing | undefined, across = 1;
  /**
   * Grows the palace out of a building (`footing`), or puts it back on its own (`undefined`). The
   * gate fills the building's front door with its pillars half in the wall and its ramparts over
   * the ground floor, and the wrapper towers climb out of the wall; the keep, wings and crown
   * stand on a layer of gum on the roof at `scale`, which grows them taller but never wider than
   * the roof; the fortress' spiked towers stand round the building with their feet in the street.
   */
  function seat(footing: Footing | undefined, scale = 1) {
    seated = footing;
    root.setLocalScale(1, 1, 1);
    if (dressing) dressing.enabled = !!footing;
    if (!footing) {
      street.setLocalScale(1, 1, 1); body.setLocalScale(1, 1, 1); body.setLocalPosition(0, 0, 0);
      towers.forEach((t, i) => t.setLocalPosition(layout.towers[i])); wings.forEach((w, i) => w.setLocalPosition(layout.wings[i]));
      base.setLocalPosition(layout.base); slab.setLocalScale(layout.slab); edge.setLocalPosition(layout.edge[0]); edge.setLocalScale(layout.edge[1]);
      spires.forEach(({ pivot, at }) => pivot.setLocalPosition(at[0], 0, at[1]));
      setFoundation(0);
      return;
    }
    if (!dressing) dress(footing);
    root.setPosition(footing.x, footing.ground, footing.z + footing.depth / 2 - SEAT.inset); root.setEulerAngles(0, 0, 0);
    street.setLocalScale(SEAT.street, SEAT.street, SEAT.street);
    towers.forEach((t, i) => t.setLocalPosition(layout.towers[i].x, 0, -.3));
    // The keep's middle over the roof's middle, the wings beside it.
    across = Math.min(scale, (footing.depth - SEAT.margin) / BODY_DEPTH);
    const lift = footing.height - footing.ground + SEAT.gum, middle = SEAT.inset - footing.depth / 2;
    body.setLocalScale(across, scale, across);
    body.setLocalPosition(0, lift, middle + 7 * across);
    wings.forEach((w, i) => w.setLocalPosition(layout.wings[i].x, 0, -6.7));
    // The gum on the roof stops a little inside its edges, and rounds off over the front wall.
    const width = (footing.width - .4) / across, depth = (footing.depth - .4) / across;
    base.setLocalPosition(0, 0, -7); slab.setLocalScale(width, .9, depth);
    edge.setLocalPosition(0, -.05, depth / 2); edge.setLocalScale(.9, width, .9);
    spires.forEach(({ pivot, onFooting }) => pivot.setLocalPosition(onFooting[0] / across, 0, -7 + onFooting[1] / across));
    setFoundation(lift / scale);
  }
  /**
   * What the seated palace stands on in the street, as boxes in world space: the ramparts, the
   * gate and the spiked towers standing now. Nothing on its own (chapter 1 keeps its own walls).
   */
  function footprint() {
    if (!seated) return [];
    const at = root.getPosition(), k = SEAT.street;
    const boxes = [-1, 1].map(side => ({ x0: at.x + side * 6.5 * k - 4.6 * k, x1: at.x + side * 6.5 * k + 4.6 * k, z0: at.z - .55 * k, z1: at.z + .55 * k }));
    boxes.push({ x0: at.x - 2.95 * k, x1: at.x + 2.95 * k, z0: at.z - .7 * k, z1: at.z + 1 * k });
    // By the threat, not `enabled`, which is also false while the whole palace is hidden.
    for (const { pivot, radius, threshold } of spires) {
      if (threat <= threshold) continue;
      const p = pivot.getPosition(), r = radius * across;
      boxes.push({ x0: p.x - r, x1: p.x + r, z0: p.z - r, z1: p.z + r });
    }
    return boxes;
  }

  // ——— Animation ———
  let progress = 1, time = 0, popTime = Infinity;
  const pieceScale = (delay: number, t: number) => stretch(clamp01((t - delay) / .2));
  function grow(t: number) {
    progress = clamp01(t);
    root.enabled = progress > 0;
    for (const { pivot, delay } of pieces) {
      const s = Math.max(.0001, pieceScale(delay, progress));
      pivot.setLocalScale(s, s, s);
    }
  }
  grow(0);
  return {
    root, kit,
    /** 0 = not there, 1 = standing; anything between is the inflation. */
    grow,
    get progress() { return progress; },
    setThreat, setFoundation, seat, footprint,
    /** The foot of the keep, the middle of the palace (on the roof when seated). */
    get heart() { return keep.getPosition().clone(); },
    get threat() { return threat; },
    get foundation() { return foundation; },
    /** Where the gate stands and which way it faces (yaw in degrees, 0 = towards +z). */
    place(position: pc.Vec3, yaw = 0) { root.setPosition(position); root.setEulerAngles(0, yaw, 0); },
    /** The gate's bubble bursts as someone walks through; it reforms behind them. */
    popGate() {
      popTime = time;
      const at = membrane.getPosition();
      effects.emit('goo', at, 18, .9);
      effects.emit('spore', at, 16, 1.2);
    },
    update(dt: number, animate: boolean) {
      if (!root.enabled) return;
      time += dt;
      const t = animate ? time : 0;
      for (const d of drips) {
        const s = d.entity.getLocalScale();
        d.entity.setLocalScale(s.x, d.length * (1 + Math.sin(t * .7 + d.phase) * .12), s.z);
      }
      // The bubble breathes; after a pop it blows itself back up.
      const since = time - popTime;
      const reform = since < 0 ? 1 : stretch(clamp01((since - .35) / 1.2));
      const wobble = 1 + Math.sin(t * 1.9) * .03;
      membrane.setLocalScale(3.5 * wobble * reform, 3.5 / wobble * reform, .7 * reform);
      glint.enabled = reform > .9;
      const pulse = 1.5 + Math.sin(t * 1.3) * .45;
      if (animate) { core.emissiveIntensity = pulse; core.update(); }
      cores.forEach((c, i) => { const s = c.getLocalScale(); const k = 1 + Math.sin(t * 1.3 + i) * (animate ? .06 : 0); c.setLocalScale(s.x, s.x * k, s.z); });
      if (storm.enabled) {
        storm.setLocalEulerAngles(0, t * 6, 0);
        // Now and then a flash inside the cloud.
        flashes.forEach((f, i) => { f.enabled = animate && Math.sin(t * (1.7 + i * .6) + i * 2) > .93; });
      }
    },
    destroy() { root.destroy(); kit.materials.forEach(m => m.destroy()); kit.meshes.forEach(m => m.destroy()); },
  };
}
export type Palace = ReturnType<typeof createPalace>;

/** A house's main volume in world space, from the street builder. */
export interface HouseVolume { id: string; x0: number; x1: number; z0: number; z1: number; top: number; streetSide: 1 | -1 }

/**
 * Passatge Maresme turning into the palace's approach: gum creeping up the north houses, drips
 * from their parapets, a twist chimney and a bubble dome on each roof, a pink runner up the
 * forecourt and two liquid-centre lanterns. Street-only, so it lives outside the palace itself.
 */
export function createPalaceApproach(app: pc.Application, houses: readonly HouseVolume[], runner: { from: pc.Vec3; to: pc.Vec3 }, lanterns: readonly pc.Vec3[]) {
  const kit = palaceKit(app);
  const { mat, part } = kit;
  const gum = mat('#ff6fae', .85, .05), gumDeep = mat('#d94a8c', .8, .04), wrapper = mat('#fbeef3', .7, .05);
  const core = mat('#ff3d8b', .6, 1.8), skin = mat('#ffb3d6', .95, .2, .38), post = mat('#6e2453', .6);
  const root = new pc.Entity('Camino al palacio'); app.root.addChild(root);
  const coats: { pivot: pc.Entity; delay: number }[] = [];
  const extras: { pivot: pc.Entity; delay: number }[] = [];
  const lights: pc.Entity[] = [];
  houses.forEach((h, i) => {
    // The two nearest houses are swallowed to half their height, the next two only at the foot.
    const strong = i < 2, level = strong ? .52 : .26, pad = .07;
    const w = h.x1 - h.x0 + pad * 2, d = h.z1 - h.z0 + pad * 2, cx = (h.x0 + h.x1) / 2, cz = (h.z0 + h.z1) / 2;
    const coat = new pc.Entity('Chicle en la fachada'); coat.setPosition(cx, 0, cz); root.addChild(coat);
    const height = h.top * level;
    part(coat, 'Capa de chicle', 'box', gumDeep, [0, height / 2, 0], [w, height, d]);
    // A soft rounded edge where the gum stops, and drips running down from it on the faces we see.
    part(coat, 'Borde de chicle', 'cylinder', gum, [0, height, d / 2], [.36, w, .36], [0, 0, 90], false);
    const face = h.streetSide > 0 ? w / 2 : -w / 2;
    part(coat, 'Borde de chicle', 'cylinder', gum, [face, height, 0], [.36, d, .36], [90, 0, 0], false);
    for (let k = 0; k < Math.floor(w / .55); k++) {
      const x = -w / 2 + .3 + k * .55, length = .25 + (Math.sin(i * 3 + k * 2.1) * .5 + .5) * .7;
      part(coat, 'Goterón', 'sphere', gum, [x, height - length / 2 + .1, d / 2 + .02], [.2, length, .2], [0, 0, 0], false);
    }
    coats.push({ pivot: coat, delay: strong ? 0 : .08 });
    if (!strong) return;
    // On the roof: drips from the parapet, a twist chimney and a small bubble dome.
    const roof = new pc.Entity('Tejado de chicle'); roof.setPosition(cx, h.top, cz); root.addChild(roof);
    for (let k = 0; k < Math.floor(w / .7); k++) {
      const x = -w / 2 + .35 + k * .7, length = .3 + (Math.sin(i * 5 + k * 1.3) * .5 + .5) * .9;
      part(roof, 'Goterón del pretil', 'sphere', gum, [x, .1 - length / 2, d / 2], [.18, length, .18], [0, 0, 0], false);
    }
    const chimney = new pc.Entity('Chimenea retorcida'); chimney.setLocalPosition(-h.streetSide * w * .22, 0, -d * .2); roof.addChild(chimney);
    for (let k = 0; k < 5; k++) part(chimney, 'Envoltorio retorcido', 'box', k % 2 ? wrapper : gum, [0, .25 + k * .5, 0], [.62 + k * .05, .5, .62 + k * .05], [0, k * 25, 0]);
    part(roof, 'Cúpula de pompa', 'sphere', skin, [h.streetSide * w * .15, .5, d * .1], [1.4, 1.3, 1.4], [0, 0, 0], false);
    part(roof, 'Centro líquido', 'sphere', core, [h.streetSide * w * .15, .42, d * .1], [.55, .55, .55], [0, 0, 0], false);
    extras.push({ pivot: roof, delay: .14 });
  });
  // The runner covers the street sign, and the lanterns light the way to the gate.
  const carpet = new pc.Entity('Alfombra de chicle'); root.addChild(carpet);
  const length = runner.from.distance(runner.to);
  carpet.setPosition((runner.from.x + runner.to.x) / 2, .07, (runner.from.z + runner.to.z) / 2);
  part(carpet, 'Alfombra', 'box', gumDeep, [0, 0, 0], [1.5, .03, length], [0, 0, 0], false);
  for (const side of [-1, 1]) part(carpet, 'Ribete', 'box', wrapper, [side * .78, .005, 0], [.1, .035, length], [0, 0, 0], false);
  extras.push({ pivot: carpet, delay: .7 });
  for (const at of lanterns) {
    const lantern = new pc.Entity('Farol de centro líquido'); lantern.setPosition(at); root.addChild(lantern);
    part(lantern, 'Poste', 'cylinder', post, [0, 1, 0], [.14, 2, .14]);
    part(lantern, 'Pompa del farol', 'sphere', skin, [0, 2.25, 0], [.62, .62, .62], [0, 0, 0], false);
    part(lantern, 'Centro líquido', 'sphere', core, [0, 2.25, 0], [.26, .26, .26], [0, 0, 0], false);
    const light = new pc.Entity('Luz del farol');
    light.addComponent('light', { type: 'omni', color: new pc.Color(1, .35, .65), intensity: 1.6, range: 5, castShadows: false });
    light.setLocalPosition(0, 2.25, 0); lantern.addChild(light); lights.push(light);
    extras.push({ pivot: lantern, delay: .72 });
  }
  function grow(t: number) {
    root.enabled = t > 0;
    for (const { pivot, delay } of coats) pivot.setLocalScale(1, Math.max(.0001, clamp01((t - delay) / .3)), 1);
    for (const { pivot, delay } of extras) { const s = Math.max(.0001, stretch(clamp01((t - delay) / .18))); pivot.setLocalScale(s, s, s); }
  }
  grow(0);
  return {
    grow,
    destroy() { root.destroy(); kit.materials.forEach(m => m.destroy()); kit.meshes.forEach(m => m.destroy()); },
  };
}
export type PalaceApproach = ReturnType<typeof createPalaceApproach>;
