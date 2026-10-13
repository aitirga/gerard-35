import * as pc from 'playcanvas';
import type { Effects } from './effects';

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

export interface PalaceKit {
  materials: pc.StandardMaterial[];
  meshes: pc.Mesh[];
  mat(hex: string, gloss?: number, glow?: number, opacity?: number): pc.StandardMaterial;
  part(parent: pc.Entity, name: string, type: string, m: pc.Material, p: number[], s: number[], r?: number[], shadows?: boolean): pc.Entity;
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
  /** Each piece grows from its own base, starting at `delay` of the whole growth. */
  const pieces: { pivot: pc.Entity; delay: number }[] = [];
  function piece(name: string, x: number, z: number, delay: number) {
    const pivot = new pc.Entity(name); pivot.setLocalPosition(x, 0, z); root.addChild(pivot);
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
  part(base, 'Losa de chicle', 'box', plum, [0, -.45, 0], [26, .9, 13.6]);
  part(base, 'Borde redondeado', 'cylinder', plum, [0, -.05, 6.75], [.9, 26, .9], [0, 0, 90]);

  // ——— Muralla de chicle: two stretches of rampart either side of the gate ———
  for (const side of [-1, 1]) {
    const wall = piece('Muralla de chicle', side * 6.5, 0, .36 + (side > 0 ? .03 : 0));
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
  const gate = piece('La Pompa', 0, 0, .44);
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
  for (const side of [-1, 1]) {
    const tower = piece('Torre de envoltorio', side * 4.7, -1.7, .5 + (side > 0 ? .05 : 0));
    const top = twist(tower, 1.55, 9, 7.2);
    part(tower, 'Remate del envoltorio', 'cone', gum, [0, top + .5, 0], [2.6, 1.1, 2.6], [180, 0, 0]);
    dome(tower, 0, top + 1.55, 0, 2.3);
    drip(tower, gum, .75, top + .05, .75, .9, .2);
    drip(tower, gum, -.7, top + .05, .78, .6, .18);
  }

  // ——— Las alas: barrel-vaulted gum halls between the towers and the keep ———
  for (const side of [-1, 1]) {
    const wing = piece('Ala del palacio', side * 8.4, -4.8, .6);
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
