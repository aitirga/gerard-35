import * as pc from 'playcanvas';
import type { Effects } from './effects';
import type { GpuEmitter, GpuKind, GpuVolume } from './fight-particles';
import type { createPost } from './post';

/**
 * Sincopante's ecos as the fight will show them (docs/animas/sincopante/README.md § Look and
 * interface). This is a visual piece only, played from the effects lab (`?fxlab`): it never touches
 * a fight's numbers. An eco is light, not glass: a bead inside thin rings of nácar (white turning
 * seafoam at the edge, a pale gold shimmer running round), a soft halo, a shaft of light to the
 * floor and a real light that falls on whoever is under it. Rising motes come at *mf* and an orbit
 * of specks at *f*, all on the GPU engine. Every ring is the Eco of Las cuerdas, here on the party's
 * side.
 *
 * - **The kinds are told by shape**: Ostinato's rings open towards the foes like a bell's mouth,
 *   Bordón's lie flat over the party like a halo.
 * - **The grades are told by size and rings**: one ring at *p*, two at *mf*, and three at *f* with two
 *   wings of arcs of light (never feathers).
 * - **The compás**: every 5 s each eco draws in and lets a ring go, to its foe (a halo closing round
 *   it) or down over its ally (a halo falling and rising through them), with a ripple on the floor.
 * - **Light changes**: Crescendo swells the ecos and dims the fight round them for a moment. The
 *   chord joins the three with lines of light. Tutti darkens everything but the foes and drops one
 *   great halo on them. Da capo turns every ring backwards.
 * - **Muffled** (the wearer in another ánima): under half their light, no gold, no motes.
 *
 * No pink and no violet (docs/visual-style.md). Sincopante's astral is rings and light that rises;
 * Dadista's is stars and light that falls.
 */
export const ECO = {
  nacar: '#eefbf6', foam: '#8fe3c4', gold: '#f2e2a8', warm: '#fff1d6', petrol: '#0f2a2c',
  /** The compás and how long an eco lasts (s). */
  beat: 5, life: 20,
  /** How high the three ecos float over the party's feet (m): low, middle, high, a chord on a stave. */
  heights: [2.05, 2.4, 2.75],
  /** How far behind the party, and how far apart across the screen (m). */
  back: .2, apart: .85,
  /** Ring radii at grade *p* (m), and how much bigger the eco is at each grade. */
  rings: [.17, .25, .33], scale: [1.25, 1.5, 1.75],
} as const;

export type EcoKind = 'ostinato' | 'bordon';
type Grade = 0 | 1 | 2;
type V3 = { x: number; y: number; z: number };

export const ECO_KINDS = {
  // Motes rising off an eco and off whoever it touches: dust in a shaft of light.
  'eco-mote': { shape: 'dot', colours: ['#ffffff', ECO.nacar, ECO.foam], intensity: [2.6, 1.7, .9], size: [.02, .008], sizeJitter: .6, drag: 1.4, gravity: -.45, curl: .35, fadeIn: .15, fadeOut: .55, additive: 1, flicker: .3, core: .5 },
  // A soft swell of light where a ring closes.
  'eco-glow': { shape: 'glow', colours: ['#ffffff', '#d6f7ea', ECO.foam], intensity: [1.5, .9, .3], size: [.18, .5], drag: 3, fadeIn: .05, fadeOut: .75, additive: 1, blur: [1, 1.8], core: .3 },
  // Rings of light that open out.
  'eco-ring': { shape: 'ring', colours: ['#ffffff', ECO.nacar, ECO.foam], intensity: [2.4, 1.5, .6], size: [.08, .55], drag: 1.5, fadeIn: .02, fadeOut: .75, additive: 1, core: .3 },
  // Fine sparks with a gold head: the accent, off the beat.
  'eco-spark': { shape: 'spark', colours: ['#ffffff', ECO.gold, ECO.foam], intensity: [3.2, 2, .7], size: [.024, .004], stretch: .06, drag: 2.2, gravity: -.3, curl: .2, fadeOut: .5, additive: 1 },
  // The specks that orbit an eco at *f*.
  'eco-orbit': { shape: 'dot', colours: [ECO.nacar, ECO.gold, ECO.foam], intensity: [2.4, 1.7, .8], size: [.015, .008], drag: .5, curl: .12, fadeIn: .25, fadeOut: .4, additive: 1, flicker: .4, core: .4 },
  // A ripple's dots running out over the floor.
  'eco-floor': { shape: 'dot', colours: [ECO.nacar, ECO.foam, ECO.foam], intensity: [1.8, 1.1, .4], size: [.02, .012], drag: 1.6, fadeIn: .02, fadeOut: .7, additive: 1, core: .2 },
} satisfies Record<string, GpuKind>;

type Post = ReturnType<typeof createPost>;
export interface EcoScene {
  /** Who is fighting, and on which side. */
  fighters(): readonly { id: string; party: boolean }[];
  /** A fighter's feet, and their model (for their height). */
  at(id: string): V3 | undefined;
  model(id: string): pc.Entity | undefined;
}

interface Tween { t0: number; dur: number; step(k: number): void; end?(): void }
interface Eco {
  kind: EcoKind; grade: Grade; slot: number; target?: string; left: number; born: number;
  root: pc.Entity; body: pc.Entity; rings: pc.Entity[]; golds: pc.Entity[]; wings: pc.Entity[];
  bead: pc.Entity; halo: pc.Entity; shaft: pc.Entity;
  /** How much it lights round it now (the ecos share one real light: the fight's light budget is small). */
  glow: number;
  mats: { ring: pc.StandardMaterial; gold: pc.StandardMaterial; bead: pc.StandardMaterial; halo: pc.StandardMaterial; shaft: pc.StandardMaterial; wing0: pc.StandardMaterial; wing1: pc.StandardMaterial; wing2: pc.StandardMaterial; wing3: pc.StandardMaterial };
  /** The grade as drawn (eased), when it last pulsed and swelled, and how bright a flash on it still is. */
  shown: number; pulseAt: number; swellAt: number; flash: number;
  /** Where it floats; flying somewhere else for Tutti. */
  home: pc.Vec3; flying?: pc.Vec3;
  motes?: GpuEmitter; orbit?: GpuVolume; specks?: GpuEmitter;
}

const v = (p: V3) => new pc.Vec3(p.x, p.y, p.z);
const ease = (k: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, k)), 3);
const back = (k: number) => { const c = 1.7, x = Math.min(1, Math.max(0, k)) - 1; return 1 + (c + 1) * x * x * x + c * x * x; };

export function createEcoFx(app: pc.AppBase, effects: Effects, post: Post | undefined, scene: EcoScene) {
  const device = app.graphicsDevice;
  const gpu = () => effects.gpu && effects.gpu.active ? effects.gpu : undefined;
  const g = effects.gpu;
  if (g) for (const [name, kind] of Object.entries(ECO_KINDS)) if (!g.get(name)) g.define(name, kind);
  const owned: { meshes: pc.Mesh[]; textures: pc.Texture[]; materials: pc.Material[] } = { meshes: [], textures: [], materials: [] };

  // ——— Textures: a soft round glow, and a fade from top to bottom for the shaft ———
  function canvasTexture(name: string, w: number, h: number, paint: (c: CanvasRenderingContext2D) => void) {
    const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h; paint(canvas.getContext('2d')!);
    const t = new pc.Texture(device, { name, width: w, height: h, mipmaps: true, addressU: pc.ADDRESS_CLAMP_TO_EDGE, addressV: pc.ADDRESS_CLAMP_TO_EDGE });
    t.setSource(canvas); owned.textures.push(t); return t;
  }
  const glowTex = canvasTexture('Halo de eco', 128, 128, c => {
    const r = c.createRadialGradient(64, 64, 0, 64, 64, 64);
    r.addColorStop(0, '#ffffff'); r.addColorStop(.18, '#9a9a9a'); r.addColorStop(.45, '#2a2a2a'); r.addColorStop(1, '#000000');
    c.fillStyle = r; c.fillRect(0, 0, 128, 128);
  });
  const shaftTex = canvasTexture('Haz de eco', 8, 128, c => {
    const l = c.createLinearGradient(0, 0, 0, 128); l.addColorStop(0, '#000000'); l.addColorStop(.06, '#7a7a7a'); l.addColorStop(.5, '#262626'); l.addColorStop(1, '#000000');
    c.fillStyle = l; c.fillRect(0, 0, 8, 128);
  });

  // ——— Materials: all light, added on top, never hiding what is behind ———
  function light(hex: string, k: number, map?: pc.Texture) {
    const m = new pc.StandardMaterial(); m.diffuse.set(0, 0, 0); m.emissive.fromString(hex); m.emissiveIntensity = k; m.useLighting = false;
    if (map) m.emissiveMap = map;
    m.blendType = pc.BLEND_ADDITIVE; m.depthWrite = false; m.cull = pc.CULLFACE_NONE; m.update(); owned.materials.push(m); return m;
  }
  /** A passing thing's material, let go with it. */
  function release(...ms: pc.Material[]) { for (const m of ms) { const i = owned.materials.indexOf(m); if (i >= 0) owned.materials.splice(i, 1); m.destroy(); } }
  function torus(radius: number, tube: number, sector = 360) {
    const mesh = pc.Mesh.fromGeometry(device, new pc.TorusGeometry({ ringRadius: radius, tubeRadius: tube, segments: Math.max(12, Math.round(64 * sector / 360)), sides: 8, sectorAngle: sector }));
    // Shared by every eco and halo: held here too, or the first one destroyed would take the mesh with it.
    mesh.incRefCount(); owned.meshes.push(mesh); return mesh;
  }
  function render(parent: pc.Entity, name: string, mesh: pc.Mesh, m: pc.Material) {
    const e = new pc.Entity(name); e.addComponent('render', { meshInstances: [new pc.MeshInstance(mesh, m)], castShadows: false, receiveShadows: false });
    parent.addChild(e); return e;
  }
  function prim(parent: pc.Entity, name: string, type: 'sphere' | 'plane' | 'cone' | 'cylinder', m: pc.Material) {
    const e = new pc.Entity(name); e.addComponent('render', { type, material: m, castShadows: false, receiveShadows: false }); parent.addChild(e); return e;
  }
  const RING_MESHES = ECO.rings.map(r => torus(r, .0065));
  const GOLD_MESHES = ECO.rings.map(r => torus(r, .009, 46));
  /** The wings' arcs: each a quarter circle from the eco out and up, tangent level where it leaves it (a raised wing). */
  const WING_R = [.28, .4, .53, .67];
  const WING_MESHES = WING_R.map((r, j) => torus(r, .005 - j * .0008, 74 - j * 7));
  /** Each arc of a wing dimmer than the one inside it, so a wing fades out towards its edge. */
  const WING_LIGHT = [2.1, 1.45, .95, .6];
  const basis = new pc.Mat4(), turn = new pc.Quat();
  const HALO_RING = torus(.5, .012), FLOOR_RING = torus(1, .01);

  const root = new pc.Entity('Ecos de Sincopante'); app.root.addChild(root);
  // One real light for all the ecos, between them, as bright as they are together: it falls on the
  // party under them and swells with each beat and Crescendo. One, because the fight's lights are few
  // (the GPU particles share four) and every light more makes every lit shader heavier.
  const lamp = new pc.Entity('Luz de los ecos'); lamp.addComponent('light', { type: 'omni', color: new pc.Color().fromString('#e3fbf1'), intensity: 0, range: 4.2, castShadows: false }); app.root.addChild(lamp);
  const ecos: Eco[] = [];
  const tweens: Tween[] = [];
  let time = 0, beatAt = -1, muffled = false, chordAt = -9;
  const tween = (dur: number, step: (k: number) => void, end?: () => void, delay = 0) => tweens.push({ t0: time + delay, dur, step, end });

  // ——— Where things are ———
  const camera = () => (app.root.findComponents('camera') as pc.CameraComponent[]).find(c => c.enabled && c.entity.enabled)?.entity;
  function sides() {
    const all = scene.fighters();
    const party = all.filter(f => f.party).map(f => ({ id: f.id, p: scene.at(f.id) })).filter((f): f is { id: string; p: V3 } => !!f.p);
    const foes = all.filter(f => !f.party).map(f => ({ id: f.id, p: scene.at(f.id) })).filter((f): f is { id: string; p: V3 } => !!f.p);
    const mid = (list: { p: V3 }[]) => list.length ? list.reduce((s, f) => s.add(v(f.p)), new pc.Vec3()).mulScalar(1 / list.length) : new pc.Vec3();
    const us = mid(party), them = foes.length ? mid(foes) : us.clone().add(new pc.Vec3(3, 0, 0));
    const fwd = them.clone().sub(us); fwd.y = 0; if (fwd.length() < 1e-3) fwd.set(1, 0, 0); fwd.normalize();
    return { party, foes, us, them, fwd };
  }
  const heightOf = (id: string) => (scene.model(id)?.getLocalScale().y ?? 1);
  const chest = (id: string) => { const p = scene.at(id); return p ? new pc.Vec3(p.x, p.y + .85 * heightOf(id), p.z) : undefined; };
  /** Where slot `i` floats: over and behind the party, the three spread sideways and up, low to high. */
  function slotAt(i: number) {
    const { us, fwd } = sides(), cam = camera(), right = cam ? cam.right.clone() : new pc.Vec3().cross(fwd, pc.Vec3.UP);
    right.y = 0; right.normalize();
    return us.clone().add(fwd.clone().mulScalar(-ECO.back)).add(right.clone().mulScalar((i - 1) * ECO.apart)).add(new pc.Vec3(0, ECO.heights[i], 0));
  }
  const freeSlot = () => [0, 1, 2].find(i => !ecos.some(e => e.slot === i)) ?? 0;

  // ——— One eco ———
  function build(kind: EcoKind, slot: number): Eco {
    const home = slotAt(slot);
    const e = new pc.Entity(kind === 'ostinato' ? 'Eco de Ostinato' : 'Eco de Bordón'); root.addChild(e); e.setPosition(home);
    const body = new pc.Entity('Cuerpo'); e.addChild(body);
    const warm = kind === 'bordon';
    const mats = {
      ring: light(ECO.nacar, 2.2), gold: light(ECO.gold, 3), bead: light('#ffffff', 5.5),
      halo: light(warm ? '#f6efd2' : '#c8f2e2', 1.1, glowTex), shaft: light(warm ? ECO.gold : ECO.foam, .55, shaftTex),
      wing0: light(ECO.nacar, WING_LIGHT[0]), wing1: light(ECO.nacar, WING_LIGHT[1]), wing2: light(ECO.foam, WING_LIGHT[2]), wing3: light(ECO.foam, WING_LIGHT[3]),
    };
    const wingMats = [mats.wing0, mats.wing1, mats.wing2, mats.wing3];
    // Ostinato's rings face the foes, nested like a bell's mouth opening towards them; Bordón's lie flat.
    const { fwd } = sides();
    if (kind === 'ostinato') {
      const cam = camera(), aim = fwd.clone().mulScalar(.8);
      if (cam) aim.add(cam.forward.clone().mulScalar(-.55));
      aim.normalize();
      const axis = new pc.Vec3().cross(pc.Vec3.UP, aim), angle = Math.acos(Math.max(-1, Math.min(1, aim.y))) * 180 / Math.PI;
      if (axis.length() > 1e-4) body.setRotation(new pc.Quat().setFromAxisAngle(axis.normalize(), angle));
    }
    const rings = RING_MESHES.map((mesh, i) => { const r = render(body, `Anillo ${i + 1}`, mesh, mats.ring); r.setLocalPosition(0, kind === 'ostinato' ? i * .045 : -i * .012, 0); return r; });
    const golds = GOLD_MESHES.map((mesh, i) => render(rings[i], 'Brillo dorado', mesh, mats.gold));
    const bead = prim(e, 'Perla', 'sphere', mats.bead); bead.setLocalScale(.07, .07, .07);
    if (kind === 'ostinato') bead.setLocalScale(.11, .05, .05);
    const halo = prim(e, 'Halo', 'plane', mats.halo); halo.setLocalScale(1.1, 1, 1.1);
    const shaft = prim(e, 'Haz', 'cone', mats.shaft);
    // The wings at *f*: two fans of arcs of light rising from its sides, in the plane the camera sees.
    const wings: pc.Entity[] = [];
    for (const side of [-1, 1]) for (let j = 0; j < WING_MESHES.length; j++) {
      const w = render(e, `Ala ${side < 0 ? 'izquierda' : 'derecha'} ${j + 1}`, WING_MESHES[j], wingMats[j]);
      w.enabled = false; wings.push(w);
    }
    for (const r of rings) r.setLocalScale(0, 0, 0);
    return { kind, grade: 0, slot, left: ECO.life, born: time, root: e, body, rings, golds, wings, bead, halo, shaft, glow: 0, mats, shown: 0, pulseAt: -9, swellAt: -9, flash: 1, home };
  }
  function drop(e: Eco, quiet = false) {
    const i = ecos.indexOf(e); if (i >= 0) ecos.splice(i, 1);
    e.motes?.remove(); e.orbit?.remove(); e.specks?.remove();
    const at = e.root.getPosition().clone();
    if (!quiet) {
      gpu()?.burst('eco-mote', { at, count: 28, spread: .25, speed: .35, up: .3, life: [.9, 1.6] });
      gpu()?.burst('eco-ring', { at, count: 2, life: [.5, .7], size: 1.3 });
    }
    // Its rings open and drift apart as it goes, and its light fades.
    const mats = Object.values(e.mats), base = mats.map(m => m.emissiveIntensity);
    tween(.6, k => {
      e.body.setLocalScale(1 + k * 1.2, 1 + k * 1.2, 1 + k * 1.2);
      mats.forEach((m, i) => { m.emissiveIntensity = base[i] * (1 - k); m.update(); });
    }, () => { e.root.destroy(); release(...mats); });
  }

  // ——— What happens on the beat ———
  function closeHalo(at: pc.Vec3, colour: string, big = 1) {
    const m = light(colour, 3.2);
    const h = render(root, 'Halo que se cierra', HALO_RING, m); h.setPosition(at);
    tween(.22, k => { const s = (1.15 - .85 * ease(k)) * big; h.setLocalScale(s, s, s); }, () => {
      gpu()?.burst('eco-glow', { at, count: 2, spread: .05, life: [.35, .5], size: big, light: { intensity: 2.4 * big, range: 2.2, colour: ECO.nacar } });
      gpu()?.burst('eco-spark', { at, count: Math.round(26 * big), spread: .12, speed: 1.6, up: .3, life: [.3, .6] });
      gpu()?.burst('eco-mote', { at, count: Math.round(22 * big), spread: .25, speed: .25, up: .5, life: [.8, 1.5] });
      post?.pulse(.02, .3 * big);
      tween(.25, k => { m.emissiveIntensity = 3.2 * (1 - k); m.update(); h.setLocalScale(.3 * big * (1 + k * .3), .3 * big, .3 * big * (1 + k * .3)); }, () => { h.destroy(); release(m); });
    });
  }
  function fallHalo(id: string, colour: string) {
    const feet = scene.at(id); if (!feet) return;
    const top = feet.y + 1.25 * heightOf(id) + .3, m = light(colour, 2.6);
    const h = render(root, 'Halo que cura', HALO_RING, m); h.setLocalScale(.62, .62, .62);
    tween(.6, k => {
      const y = k < .5 ? top - (top - feet.y - .05) * ease(k * 2) : feet.y + .05 + (top - feet.y - .05) * ease((k - .5) * 2);
      h.setPosition(feet.x, y, feet.z); m.emissiveIntensity = 2.6 * (k < .5 ? 1 : 1 - (k - .5) * 2); m.update();
    }, () => { h.destroy(); release(m); });
    gpu()?.burst('eco-mote', { at: { x: feet.x, y: feet.y + .1, z: feet.z }, shape: 'ring', spread: .45, count: 26, up: .9, speed: .1, life: [.9, 1.6], colour: ECO.warm, light: { intensity: 1.6, range: 2, colour: ECO.warm } });
  }
  /** A sung beam from `a` to `b`: a fine core and two strands twisting round it, like a wave of sound. */
  function beam(a: pc.Vec3, b: pc.Vec3, k = 1, gold = false, seconds = .3) {
    const tip = gold ? ECO.gold : ECO.foam;
    effects.trails.comet(a, b, ['#ffffff', tip], seconds, { arc: .1, width: .022 * k, life: .26, intensity: 3.2 * k, core: .9, additive: 1, taper: .85 });
    for (const phase of [0, Math.PI]) effects.trails.comet(a, b, [ECO.nacar, tip], seconds, { arc: .1, width: .012 * k, life: .32, intensity: 2.4 * k, core: .5, additive: 1, taper: .6, twist: { turns: 2.5, radius: .07 * k, phase } });
  }
  function ripple(e: Eco) {
    const p = e.root.getPosition(), floor = sides().us.y + .03, m = light(ECO.foam, 1.4), reach = e.grade === 2 ? 2.6 : 1.1;
    const r = render(root, 'Onda en el suelo', FLOOR_RING, m); r.setPosition(p.x, floor, p.z);
    tween(1.5, k => { const s = .15 + reach * ease(k); r.setLocalScale(s, 1, s); m.emissiveIntensity = 1.4 * (1 - k) * (muffled ? .35 : 1); m.update(); }, () => { r.destroy(); release(m); });
    gpu()?.burst('eco-floor', { at: { x: p.x, y: floor + .02, z: p.z }, shape: 'ring', spread: .2, count: muffled ? 10 : 30, outward: .9 + e.grade * .5, life: [.8, 1.3] });
  }
  function pulse(e: Eco, accent = false) {
    e.pulseAt = time; e.flash = accent ? 1.4 : 1;
    const at = e.root.getPosition().clone(), { party, foes } = sides(), k = muffled ? .45 : 1;
    if (!accent) ripple(e);
    if (e.kind === 'ostinato') {
      const targets = e.grade === 2 ? foes.map(f => f.id) : [e.target && foes.some(f => f.id === e.target) ? e.target : foes[0]?.id].filter((id): id is string => !!id);
      for (const id of targets) {
        const to = chest(id); if (!to) continue;
        beam(at, to, k, accent, .28);
        setTimeout(() => closeHalo(to, accent ? ECO.gold : ECO.nacar, (e.grade === 2 ? .8 : .7) * k), 280);
      }
    } else {
      const hurt = e.grade === 2 ? party.map(f => f.id) : [party[0]?.id].filter((id): id is string => !!id);
      for (const id of hurt) fallHalo(id, accent ? ECO.gold : ECO.warm);
    }
    if (accent) gpu()?.burst('eco-spark', { at, count: 24, spread: .08, speed: 1.2, life: [.25, .5] });
  }

  // ——— The calls ———
  /** Ostinato or Bordón from `wearer` on `target`: the blow or the cure, then its eco rises into place. */
  function call(kind: EcoKind, wearer: string, target?: string) {
    if (ecos.length >= 3) drop(ecos[0]);
    const slot = freeSlot(), from = chest(wearer), { foes, party } = sides();
    const aim = kind === 'ostinato' ? target && foes.some(f => f.id === target) ? target : foes[0]?.id : target && party.some(f => f.id === target) ? target : party[0]?.id;
    const to = aim ? chest(aim) : undefined;
    const e = build(kind, slot); e.target = aim; ecos.push(e);
    e.root.enabled = false;
    if (beatAt < 0) beatAt = time;
    if (from && to && kind === 'ostinato') {
      beam(from, to, 1.4, false, .3);
      setTimeout(() => closeHalo(to, ECO.nacar, 1), 300);
    } else if (aim) fallHalo(aim, ECO.warm);
    // A paler copy of the ring rises from where it landed to where the eco will float.
    const start = to ?? from ?? e.home;
    setTimeout(() => effects.trails.comet(start, e.home, [ECO.nacar, ECO.foam], .55, { arc: .6, width: .04, life: .6, intensity: 2, core: .5, additive: 1, taper: .8 }), 520);
    setTimeout(() => {
      e.root.enabled = true; e.born = time;
      gpu()?.burst('eco-ring', { at: e.home, count: 2, life: [.5, .7], size: 1 });
      gpu()?.burst('eco-mote', { at: e.home, count: 30, spread: .2, speed: .5, life: [.8, 1.4] });
      post?.pulse(.02, .35);
    }, 1050);
    return e;
  }
  /** Every eco up a grade: louder, then wider; their clocks start over. The fight dims round them for a moment. */
  function crescendo() {
    if (!ecos.length || muffled) return false;
    for (const e of ecos) {
      e.grade = Math.min(2, e.grade + 1) as Grade; e.left = ECO.life; e.swellAt = time; e.flash = 1.2;
      const at = e.root.getPosition();
      gpu()?.burst('eco-ring', { at, count: 3, life: [.6, .9], size: 1.4 });
      gpu()?.burst('eco-mote', { at, shape: 'ring', spread: .35, count: 40, around: 2.4, up: .7, life: [1, 1.8] });
    }
    post?.pulse(.02, .7);
    swellLight(.9);
    return true;
  }
  /** A whole fight's light gives way to the ecos for a moment: the picture dims and greys except round them. */
  function swellLight(seconds: number, amount = .42) {
    if (!post) return;
    const points = () => ecos.slice(0, 4).map(e => { const p = e.root.getPosition(); return { x: p.x, y: p.y, z: p.z, radius: 1.1 }; });
    tween(seconds, k => post.spotlight(amount * Math.sin(Math.PI * Math.min(1, k * 1.15)), points()), () => post.spotlight(0, []));
  }
  /** Pressed in the off-beat: every eco sounds once more, accented, at once. */
  function contratiempo() {
    if (!ecos.length || muffled) return false;
    for (const e of ecos) pulse(e, true);
    post?.pulse(.02, .25);
    return true;
  }
  /** The ecos fly together over the foes, the fight darkens round them, and one great halo comes down on all. */
  function tutti() {
    const list = ecos.slice(); if (muffled) return false;
    const { foes, them } = sides(), over = them.clone().add(new pc.Vec3(0, 2.4, 0));
    ecos.length = 0; beatAt = -1;
    const spot = () => foes.map(f => { const c = chest(f.id)!; return { x: c.x, y: c.y, z: c.z, radius: 1.2 }; });
    tween(2.2, k => post?.spotlight(.72 * Math.min(1, k * 4) * (k > .8 ? (1 - k) / .2 : 1), spot()), () => post?.spotlight(0, []));
    for (const e of list) {
      e.flying = e.root.getPosition().clone(); e.motes?.remove(); e.orbit?.remove(); e.specks?.remove();
      const from = e.flying.clone(), mats = Object.values(e.mats);
      tween(.45, k => { e.root.setPosition(from.clone().lerp(from, over, ease(k))); const s = e.root.getLocalScale().x * (1 + .02); e.root.setLocalScale(s, s, s); }, () => { e.root.destroy(); release(...mats); });
    }
    // One great halo of every ring, with a column of warm light from above.
    const m = light(ECO.nacar, 3.4), halo = new pc.Entity('Gran halo'); root.addChild(halo); halo.setPosition(over);
    const parts = [0, 1, 2, 3].map(i => { const r = render(halo, 'Anillo del halo', HALO_RING, m); const s = 1.4 + i * .35; r.setLocalScale(s, s, s); r.setLocalPosition(0, i * .06, 0); return r; });
    const colM = light(ECO.warm, 1.4, glowTex), column = prim(root, 'Columna de luz', 'plane', colM);
    const cam = camera();
    column.setPosition(them.x, them.y + 2.2, them.z);
    if (cam) { column.setRotation(cam.getRotation()); column.rotateLocal(90, 0, 0); }
    column.setLocalScale(3.2, 1, 7.5);
    halo.setLocalScale(0, 0, 0);
    tween(.5, k => { const s = back(k); halo.setLocalScale(s, s, s); colM.emissiveIntensity = 1.4 * k; colM.update(); }, undefined, .4);
    tween(.32, k => halo.setPosition(over.x, over.y - (over.y - them.y - 1) * ease(k), over.z), () => {
      for (const f of foes) { const c = chest(f.id); if (c) closeHalo(c, ECO.nacar, 1.6); }
      gpu()?.burst('eco-ring', { at: { x: them.x, y: them.y + .05, z: them.z }, count: 4, life: [.7, 1], size: 3 });
      gpu()?.burst('eco-mote', { at: { x: them.x, y: them.y + .4, z: them.z }, count: 160, spread: 1.6, speed: .4, up: .8, life: [1.2, 2.4], light: { intensity: 4, range: 4.5, colour: ECO.warm } });
      post?.pulse(.06, 1, .22);
      tween(.5, k => { m.emissiveIntensity = 3.4 * (1 - k); m.update(); parts.forEach((p, i) => { const s = (1.4 + i * .35) * (1 + k * .6); p.setLocalScale(s, s, s); }); }, () => { halo.destroy(); release(m); });
      tween(1.2, k => { colM.emissiveIntensity = 1.4 * (1 - k); colM.update(); }, () => { column.destroy(); release(colM); });
    }, .95);
    return true;
  }
  /** Back to the beginning: every ring turns backwards, a wave of nácar crosses the party, the ecos start over. */
  function dacapo() {
    if (ecos.length < 3 || muffled) return false;
    const { us, party } = sides();
    for (const e of ecos) { e.left = ECO.life; e.swellAt = time; e.flash = 1.3; }
    rewind = 1.2;
    for (let i = 0; i < 3; i++) {
      const m = light(ECO.nacar, 1.6), r = render(root, 'Onda que vuelve', FLOOR_RING, m); r.setPosition(us.x, us.y + .03, us.z); r.setLocalScale(0, 1, 0);
      tween(.9, k => { const s = 2.8 - 2.5 * ease(k); r.setLocalScale(s, 1, s); m.emissiveIntensity = 1.6 * Math.sin(Math.PI * k); m.update(); }, () => { r.destroy(); release(m); }, i * .18);
    }
    gpu()?.burst('eco-floor', { at: { x: us.x, y: us.y + .04, z: us.z }, shape: 'ring', spread: 2.2, count: 70, outward: -1.1, around: -1.2, life: [.9, 1.2] });
    for (const f of party) { const c = chest(f.id); if (c) gpu()?.burst('eco-mote', { at: c, count: 40, spread: .5, up: .6, life: [1, 1.8], light: { intensity: 1.5, range: 2, colour: ECO.nacar } }); }
    post?.pulse(.02, .6, .12);
    swellLight(1.6, .5);
    return true;
  }
  let rewind = 0;

  function setMuffled(on: boolean) { muffled = on; }

  // ——— Every frame ———
  function update(dt: number) {
    time += dt;
    for (let i = tweens.length - 1; i >= 0; i--) {
      const tw = tweens[i], k = (time - tw.t0) / tw.dur;
      if (k < 0) continue;
      tw.step(Math.min(1, k));
      if (k >= 1) { tweens.splice(i, 1); tw.end?.(); }
    }
    // The compás: every eco sounds together on the beat.
    if (beatAt >= 0 && ecos.length) {
      if (time - beatAt >= ECO.beat) { beatAt += ECO.beat; for (const e of ecos) if (e.root.enabled) pulse(e); if (ecos.length === 3) chord(); }
    } else if (!ecos.length) beatAt = -1;
    const cam = camera(), camRot = cam?.getRotation(), floor = sides().us.y;
    rewind = Math.max(0, rewind - dt);
    for (const e of [...ecos]) {
      e.left -= dt;
      if (e.left <= 0) { drop(e); continue; }
      if (!e.root.enabled) continue;
      e.shown += (e.grade - e.shown) * Math.min(1, dt * 5);
      e.flash = Math.max(0, e.flash - dt * 2.2);
      const appear = back((time - e.born) / .55), since = time - e.pulseAt;
      const breath = since < .15 ? 1 - .1 * Math.sin(since / .15 * Math.PI / 2) : since < .4 ? .9 + .1 * (since - .15) / .25 : 1;
      const pop = 1 + .22 * Math.sin(Math.PI * Math.min(1, Math.max(0, (time - e.swellAt) / .5)));
      const bob = Math.sin((time - Math.max(0, beatAt)) / ECO.beat * Math.PI * 2) * .04;
      const s = (ECO.scale[0] + (ECO.scale[2] - ECO.scale[0]) * e.shown / 2) * breath * pop;
      e.root.setPosition(e.home.x, e.home.y + bob, e.home.z);
      e.root.setLocalScale(s, s, s);
      const dim = muffled ? .4 : 1, glow = (1 + e.flash * .8) * dim;
      // Rings: as many as its grade, each opening in turn; they turn on their own axes, the gold running round.
      e.rings.forEach((r, i) => {
        const on = Math.min(1, Math.max(0, e.shown + 1 - i)) * appear;
        r.setLocalScale(on, on, on);
        r.rotateLocal(0, (e.kind === 'ostinato' ? 40 : 18) * (rewind > 0 ? -6 : 1) * (i % 2 ? -1 : 1) * dt, 0);
        e.golds[i].enabled = !muffled;
      });
      if (e.kind === 'bordon') e.body.setLocalEulerAngles(Math.sin(time * .6) * 6, 0, Math.cos(time * .5) * 6);
      e.mats.ring.emissiveIntensity = 2.2 * glow; e.mats.ring.update();
      e.mats.gold.emissiveIntensity = 3 * glow; e.mats.gold.update();
      e.mats.bead.emissiveIntensity = 5.5 * glow; e.mats.bead.update();
      e.mats.halo.emissiveIntensity = (.8 + .3 * e.shown) * glow; e.mats.halo.update();
      e.mats.shaft.emissiveIntensity = (.3 + .2 * e.shown) * dim * (1 + e.flash * .5); e.mats.shaft.update();
      [e.mats.wing0, e.mats.wing1, e.mats.wing2, e.mats.wing3].forEach((m, j) => { m.emissiveIntensity = WING_LIGHT[j] * glow; m.update(); });
      // The halo faces the camera; the shaft reaches the floor.
      if (camRot) { e.halo.setRotation(camRot); e.halo.rotateLocal(90, 0, 0); }
      const h = Math.max(.2, e.home.y + bob - floor) / s;
      e.shaft.setLocalPosition(0, -h / 2, 0); e.shaft.setLocalScale(.5 + .2 * e.shown, h, .5 + .2 * e.shown);
      // The light it throws on whoever is under it (summed into the one shared light below).
      e.glow = (.5 + .45 * e.shown) * dim * (1 + e.flash * 1.6);
      // The wings: arcs in the plane the camera sees, unfolding at *f*.
      const unfold = Math.max(0, e.shown - 1);
      e.wings.forEach((w, j) => {
        w.enabled = unfold > .02;
        if (!w.enabled || !cam) return;
        // A torus arc runs from its +x round towards +z. Turned so +x points down the screen and +z out
        // to this side, it leaves the eco level and curls up at its tip; set its centre above the eco by
        // its radius so it starts at the eco. They breathe a little, each on its own.
        const side = j < 4 ? -1 : 1, n = j % 4, u = unfold * (1 + Math.sin(time * 1.3 + n * .9) * .035), up = cam.up, right = cam.right;
        const X = up.clone().mulScalar(-1), Z = right.clone().mulScalar(side), Y = new pc.Vec3().cross(Z, X);
        basis.data.set([X.x, X.y, X.z, 0, Y.x, Y.y, Y.z, 0, Z.x, Z.y, Z.z, 0, 0, 0, 0, 1]);
        w.setRotation(turn.setFromMat4(basis));
        w.setLocalScale(u, u, u);
        const r = WING_R[n] * s * u, p = e.root.getPosition();
        w.setPosition(p.x + up.x * r + right.x * side * .05 * s, p.y + up.y * r + right.y * side * .05 * s, p.z + up.z * r + right.z * side * .05 * s);
      });
      // Motes rise off it from *mf*; at *f*, specks orbit it.
      const at = e.root.getPosition();
      if (e.shown > .6 && !muffled && gpu()) {
        e.motes ??= gpu()!.emitter('eco-mote', { at: { x: at.x, y: at.y, z: at.z }, rate: 10, spread: .18, life: [.9, 1.6], speed: .08, up: .25 });
        e.motes.at = { x: at.x, y: at.y, z: at.z }; e.motes.rate = 8 + 10 * e.shown;
      } else if (e.motes) { e.motes.remove(); e.motes = undefined; }
      if (e.shown > 1.5 && !muffled && gpu()) {
        e.orbit ??= gpu()!.volume({ shape: 'sphere', mode: 'orbit', at, size: { x: .26, y: .26, z: .26 }, strength: 6, swirl: 5, distance: .12, range: .6, kinds: ['eco-orbit'] });
        e.specks ??= gpu()!.emitter('eco-orbit', { at: { x: at.x, y: at.y, z: at.z }, rate: 26, spread: .4, life: [1.2, 2] });
        e.orbit.at.set(at.x, at.y, at.z); e.specks.at = { x: at.x, y: at.y, z: at.z };
      } else { e.orbit?.remove(); e.specks?.remove(); e.orbit = undefined; e.specks = undefined; }
    }
  }
  /** The shared light: at the ecos' middle, weighted by how bright each is, as bright as them all (eased). */
  let lit = 0;
  function placeLamp(dt: number) {
    let sum = 0; const at = new pc.Vec3();
    for (const e of ecos) if (e.root.enabled) { sum += e.glow; at.add(e.root.getPosition().clone().mulScalar(e.glow)); }
    lit += (sum * .7 - lit) * Math.min(1, dt * 8);
    lamp.enabled = lit > .02;
    if (sum > 0) lamp.setPosition(at.mulScalar(1 / sum).add(new pc.Vec3(0, -.4, 0)));
    (lamp.light as pc.LightComponent).intensity = lit;
  }
  /** Three ecos at once: lines of light join them for a beat, and the fight brightens on them. */
  function chord() {
    if (chordAt > time - 1) return;
    chordAt = time;
    const ps = ecos.map(e => e.root.getPosition().clone());
    for (let i = 0; i < ps.length; i++) {
      const a = ps[i], b = ps[(i + 1) % ps.length], d = a.distance(b);
      gpu()?.burst('eco-floor', { at: a, to: b, shape: 'line', count: Math.round(d * 60), life: [.8, 1], size: .8 });
    }
    post?.pulse(.02, .45);
  }

  const onUpdate = (dt: number) => { update(dt); placeLamp(dt); };
  app.on('update', onUpdate);
  return {
    call, crescendo, contratiempo, tutti, dacapo, setMuffled,
    get muffled() { return muffled; },
    /** Development: where each eco is and how it is drawn now. */
    debug() { return ecos.map(e => ({ kind: e.kind, grade: e.grade, shown: e.shown, at: e.root.getPosition().toString(), scale: e.root.getLocalScale().x, wings: e.wings.map(w => w.getPosition().toString()), light: e.glow })); },
    get count() { return ecos.length; },
    /** How far the compás is between beats (0–1), for an icon. */
    get phase() { return beatAt < 0 ? 0 : ((time - beatAt) % ECO.beat) / ECO.beat; },
    /** Whether now is the off-beat (half a second either side of halfway). */
    get offbeat() { return beatAt >= 0 && Math.abs(((time - beatAt) % ECO.beat) - ECO.beat / 2) <= .5; },
    /** Every eco gone at once, nothing left in the air. */
    clear() { for (const e of [...ecos]) { e.motes?.remove(); e.orbit?.remove(); e.specks?.remove(); e.root.destroy(); } ecos.length = 0; beatAt = -1; tweens.length = 0; post?.spotlight(0, []); for (const c of [...root.children]) c.destroy(); },
    destroy() {
      app.off('update', onUpdate);
      for (const e of ecos) { e.motes?.remove(); e.orbit?.remove(); e.specks?.remove(); }
      root.destroy(); lamp.destroy();
      owned.meshes.forEach(m => { m.decRefCount(); if (m.refCount === 0) m.destroy(); }); owned.textures.forEach(t => t.destroy()); owned.materials.forEach(m => m.destroy());
    },
  };
}
export type EcoFx = ReturnType<typeof createEcoFx>;
