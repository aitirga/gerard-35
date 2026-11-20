import * as pc from 'playcanvas';
import type { Effects } from './effects';
import type { GpuEmitter, GpuKind, GpuVolume } from './fight-particles';
import type { createPost } from './post';
import { createEcoSheets } from './eco-shaders';

/**
 * Sincopante's ecos as the fight will show them (docs/animas/sincopante/README.md § Look and
 * interface). This is a visual piece only, played from the effects lab (`?fxlab`): it never touches
 * a fight's numbers. An eco is light, not glass, and it is drawn by `src/eco-shaders.ts`:
 *
 * - **Interferencia is the eco itself**, the ánima's mark: a voice and its echo. A bead inside rings
 *   of nácar, each ring doubled by a copy a little apart, fine ripples running out from both and a
 *   pale gold where the two agree. One ring at *p*, two at *mf*, three at *f* with two wings, fans of
 *   fine doubled arcs curling up (never feathers). Ostinato's stands like a bell's mouth turned to the
 *   foes, Bordón's lies like a halo, its light warmer.
 * - **Cimática is what a note does to what it touches**: struck (the beat, Crescendo, the chord),
 *   an eco shows inside it the figure sand draws on a sounding plate, a new one for each grade. The
 *   same figure flashes on a foe where a blow lands, is the great plate Tutti lowers on the foes
 *   (changing figure as it comes), and runs backwards under the party in Da capo.
 * - **Cáustica is the light an eco gives**: a veil of light through water hangs from each eco to a
 *   pool on the floor, wraps the ally Bordón cures, and is Tutti's column.
 * - On top, the GPU particles (motes rising from *mf*, specks in orbit at *f*, sparks on an accent),
 *   one real light that falls on whoever is under the ecos, and the picture dimming round them in
 *   Crescendo, Da capo and Tutti.
 * - **The compás**: every 5 s each eco draws in and lets a doubled ring go, to its foe (closing round
 *   it, with two fainter copies behind) or down over its ally, and two-point ripples cross the floor.
 * - **Muffled** (the wearer in another ánima): under half their light, no gold, no figure, no motes.
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
  /** Metres to one eco unit: its one ring at *p* is .62 units out, the outer of three at *f* 1.9. */
  unit: .32,
  /** How each kind's circle is squashed (across, up) and turned. */
  shape: { ostinato: { squash: [.72, 1], turn: -.12 }, bordon: { squash: [1.2, .5], turn: 0 } },
  /** Line width (px), and how bright each sheet of light is. */
  line: 1.5, gain: { body: 1.5, figure: 1.8, light: 2, wave: 1.5 },
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


type F = Float32Array;
type Turn = 'face' | 'upright' | 'flat';
interface Tween { t0: number; dur: number; step(k: number): void; end?(): void }
interface Eco {
  kind: EcoKind; grade: Grade; slot: number; target?: string; left: number; born: number;
  /** Where it is, its own sheet of light, the veil it hangs to the floor and the pool under it. */
  root: pc.Entity; sheet: pc.Entity; veil: pc.Entity; pool: pc.Entity;
  /** What its sheets are drawn with (src/eco-shaders.ts). */
  u: { eco: F; form: F; half: F; look: F; veil: F; veil2: F; veil3: F; pool: F; pool2: F; pool3: F };
  seed: number;
  /** How much it lights round it now (the ecos share one real light: the fight's light budget is small). */
  glow: number;
  /** The grade as drawn (eased), when it last pulsed and swelled, and how bright a flash on it still is. */
  shown: number; pulseAt: number; swellAt: number; flash: number;
  /** Its own clock (it runs backwards in Da capo), and the figure it shows when struck: how much is left of it, for how long, how strong, which. */
  clock: number; figure: number; figureFor: number; figureAmount: number; mode: number;
  /** Where it floats. Going: how much of it is left, how fast it goes, and where to (Tutti gathers them). */
  home: pc.Vec3; going: boolean; fade: number; fadeFor: number; to?: pc.Vec3;
  motes?: GpuEmitter; orbit?: GpuVolume; specks?: GpuEmitter;
}

const v = (p: V3) => new pc.Vec3(p.x, p.y, p.z);
const f4 = (a = 0, b = 0, c = 0, d = 0) => new Float32Array([a, b, c, d]);
const ease = (k: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, k)), 3);
const back = (k: number) => { const c = 1.7, x = Math.min(1, Math.max(0, k)) - 1; return 1 + (c + 1) * x * x * x + c * x * x; };
/** How far out an eco's outer ring is at a grade, in eco units. */
const reachOf = (g: number) => (1 + .28 * g) * (.62 + .3 * g);

export function createEcoFx(app: pc.AppBase, effects: Effects, post: Post | undefined, scene: EcoScene) {
  const gpu = () => effects.gpu && effects.gpu.active ? effects.gpu : undefined;
  const g = effects.gpu;
  if (g) for (const [name, kind] of Object.entries(ECO_KINDS)) if (!g.get(name)) g.define(name, kind);
  const sheets = createEcoSheets(app.graphicsDevice);

  const root = new pc.Entity('Ecos de Sincopante'); app.root.addChild(root);
  // One real light for all the ecos, between them, as bright as they are together: it falls on the
  // party under them and swells with each beat and Crescendo. One, because the fight's lights are few
  // (the GPU particles share four) and every light more makes every lit shader heavier.
  const lamp = new pc.Entity('Luz de los ecos'); lamp.addComponent('light', { type: 'omni', color: new pc.Color().fromString('#e3fbf1'), intensity: 0, range: 4.2, castShadows: false }); app.root.addChild(lamp);
  const ecos: Eco[] = [], leaving: Eco[] = [];
  const tweens: Tween[] = [];
  let time = 0, beatAt = -1, muffled = false, chordAt = -9, rewind = 0;
  const tween = (dur: number, step: (k: number) => void, end?: () => void, delay = 0) => tweens.push({ t0: time + delay, dur, step, end });
  const after = (delay: number, run: () => void) => tween(.001, () => {}, run, delay);

  // ——— Sheets of light: a square each, turned to the camera, stood upright or laid on the floor ———
  const basis = new pc.Mat4(), faceQ = new pc.Quat(), uprightQ = new pc.Quat(), flatQ = new pc.Quat();
  const camera = () => (app.root.findComponents('camera') as pc.CameraComponent[]).find(c => c.enabled && c.entity.enabled)?.entity;
  function quatOf(q: pc.Quat, x: pc.Vec3, y: pc.Vec3) {
    const z = new pc.Vec3().cross(x, y);
    basis.data.set([x.x, x.y, x.z, 0, y.x, y.y, y.z, 0, z.x, z.y, z.z, 0, 0, 0, 0, 1]);
    q.setFromMat4(basis);
  }
  /** Where the camera is looking from, once a frame: the three ways a sheet can be turned. */
  function aim() {
    const cam = camera(); if (!cam) return;
    faceQ.copy(cam.getRotation());
    const x = cam.right.clone(); x.y = 0; if (x.length() < 1e-4) x.set(1, 0, 0); x.normalize();
    quatOf(uprightQ, x, pc.Vec3.UP);
    quatOf(flatQ, x, new pc.Vec3().cross(pc.Vec3.UP, x));
  }
  const turned = (e: pc.Entity, turn: Turn) => e.setRotation(turn === 'face' ? faceQ : turn === 'upright' ? uprightQ : flatQ);
  function sheet(parent: pc.Entity, name: string, material: pc.Material, uniforms: Record<string, F>) {
    const e = new pc.Entity(name), instance = new pc.MeshInstance(sheets.quad, material);
    // Held by reference: writing into these arrays is all it takes to change how the sheet is drawn.
    for (const [key, values] of Object.entries(uniforms)) instance.setParameter(key, values);
    e.addComponent('render', { meshInstances: [instance], castShadows: false, receiveShadows: false });
    parent.addChild(e); return e;
  }
  interface Passing { delay?: number; warm?: number; gold?: number }
  /** A doubled ring or two-point ripples, for `seconds`: `step` moves its front (`w`) and says how much is ring and how much ripples (`w2`). */
  function wave(at: V3, size: number, turn: Turn, seconds: number, step: (k: number, w: F, w2: F, e: pc.Entity) => void, o: Passing & { lam?: number } = {}) {
    const w = f4(.9, .1, .1, 0), w2 = f4(1, 0, o.gold ?? (muffled ? 0 : 1), ECO.line), w3 = f4(ECO.gain.wave, o.lam ?? .1, o.warm ?? 0, 0);
    const e = sheet(root, 'Onda', sheets.wave, { uWave: w, uWave2: w2, uWave3: w3 });
    e.setPosition(at.x, at.y, at.z); e.setLocalScale(size, size, 1); turned(e, turn);
    tween(seconds, k => step(k, w, w2, e), () => e.destroy(), o.delay);
    return e;
  }
  /** A sounding plate, for `seconds`: `step` sets its figures and alpha (`m`), and when it was struck and its turn (`m2`). */
  function plate(at: V3, size: number, turn: Turn, seconds: number, step: (k: number, m: F, m2: F, e: pc.Entity) => void, o: Passing & { cells?: number } = {}) {
    const m = f4(0, 0, 0, 0), m2 = f4(9, ECO.line, o.gold ?? (muffled ? 0 : 1), 0), m3 = f4(ECO.gain.figure, o.cells ?? 14, .05, 0);
    const e = sheet(root, 'Figura', sheets.membrane, { uMem: m, uMem2: m2, uMem3: m3 });
    e.setPosition(at.x, at.y, at.z); e.setLocalScale(size, size, 1); turned(e, turn);
    tween(seconds, k => step(k, m, m2, e), () => e.destroy(), o.delay);
    return e;
  }
  /** Light through water, for `seconds`: a veil `wide` by `tall` (half sizes, m) stood at `at`, or a pool lying there. `step` sets its alpha (`c[1]`) and when it was struck and its grade (`c2[2]`, `c2[3]`). */
  function water(at: V3, wide: number, tall: number, kind: 'veil' | 'pool', seconds: number, step: (k: number, c: F, c2: F, e: pc.Entity) => void, o: Passing = {}) {
    const c = f4(kind === 'pool' ? 1 : 0, 0, o.warm ?? 0, Math.random() * 40), c2 = f4(wide, tall, 9, 0), c3 = f4(ECO.gain.light, time, 0, 0);
    const e = sheet(root, kind === 'pool' ? 'Charco de luz' : 'Velo de luz', sheets.caustic, { uCau: c, uCau2: c2, uCau3: c3 });
    e.setPosition(at.x, at.y, at.z); e.setLocalScale(wide, tall, 1); turned(e, kind === 'pool' ? 'flat' : 'upright');
    tween(seconds, k => { c3[1] = time; step(k, c, c2, e); }, () => e.destroy(), o.delay);
    return e;
  }

  // ——— Where things are ———
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
    const home = slotAt(slot), seed = Math.random() * 40, warm = kind === 'bordon' ? 1 : 0;
    const e = new pc.Entity(kind === 'ostinato' ? 'Eco de Ostinato' : 'Eco de Bordón'); root.addChild(e); e.setPosition(home);
    const shape = ECO.shape[kind], { fwd } = sides(), cam = camera();
    // Ostinato's mouth leans towards the foes, whichever side of the screen they are on.
    const lean = shape.turn * (cam && fwd.dot(cam.right) < 0 ? -1 : 1);
    const u = {
      eco: f4(0, 9, seed, 0), form: f4(shape.squash[0], shape.squash[1], lean, warm), half: f4(2.1, 2.1, 0, 0), look: f4(ECO.gain.body, ECO.line, 1, 0),
      veil: f4(0, 0, warm, seed), veil2: f4(.4, 1, 9, 0), veil3: f4(ECO.gain.light, 0, 0, 0),
      pool: f4(1, 0, warm, seed + 7), pool2: f4(.8, .8, 9, 0), pool3: f4(ECO.gain.light, 0, 0, 0),
    };
    const body = sheet(e, 'Voz y eco', sheets.body, { uEco: u.eco, uForm: u.form, uHalf: u.half, uLook: u.look });
    const veil = sheet(root, 'Velo del eco', sheets.caustic, { uCau: u.veil, uCau2: u.veil2, uCau3: u.veil3 });
    const pool = sheet(root, 'Charco del eco', sheets.caustic, { uCau: u.pool, uCau2: u.pool2, uCau3: u.pool3 });
    return { kind, grade: 0, slot, left: ECO.life, born: time, root: e, sheet: body, veil, pool, u, seed, glow: 0, shown: 0, pulseAt: -9, swellAt: -9, flash: 1, clock: seed, figure: 0, figureFor: 1, figureAmount: 0, mode: 0, home, going: false, fade: 1, fadeFor: .6 };
  }
  const shown = (e: Eco, on: boolean) => { e.root.enabled = on; e.veil.enabled = on; e.pool.enabled = on; };
  const emitters = (e: Eco) => { e.motes?.remove(); e.orbit?.remove(); e.specks?.remove(); e.motes = undefined; e.orbit = undefined; e.specks = undefined; };
  const destroyEco = (e: Eco) => { emitters(e); e.root.destroy(); e.veil.destroy(); e.pool.destroy(); };
  /** An eco goes: it opens and fades over `seconds` (flying to `to` meanwhile, if given). */
  function leave(e: Eco, seconds = .6, to?: pc.Vec3) {
    const i = ecos.indexOf(e); if (i >= 0) ecos.splice(i, 1);
    emitters(e);
    e.going = true; e.fadeFor = seconds; e.to = to; e.home = e.root.getPosition().clone();
    leaving.push(e);
  }
  function drop(e: Eco) {
    const at = e.root.getPosition().clone();
    gpu()?.burst('eco-mote', { at, count: 28, spread: .25, speed: .35, up: .3, life: [.9, 1.6] });
    gpu()?.burst('eco-ring', { at, count: 2, life: [.5, .7], size: 1.3 });
    leave(e);
  }
  /** Struck: its inside shows its note's figure for `seconds`. */
  function strike(e: Eco, seconds: number, amount: number) {
    if (muffled) return;
    e.figure = 1; e.figureFor = seconds; e.figureAmount = amount; e.mode = e.grade;
  }

  // ——— What happens on the beat ———
  /**
   * A ring and its echo close round `at`, two fainter copies behind them (the echo of the echo), and
   * where they close the note's figure flashes for a moment, as on a struck plate.
   */
  function closeHalo(at: pc.Vec3, accent: boolean, big = 1, mode = 0) {
    const k0 = muffled ? .45 : 1;
    for (let i = 0; i < 3; i++) wave(at, .66 * big, 'face', .22, (k, w) => { w[0] = .92 - .62 * ease(k); w[2] = .1; w[3] = [1, .5, .25][i] * k0; }, { delay: i * .07, warm: accent ? 1 : 0 });
    after(.22, () => {
      plate(at, .52 * big, 'face', .55, (k, m, m2) => { m[0] = mode; m[1] = mode; m[3] = Math.pow(1 - k, 1.5) * k0; m2[0] = k * .55; }, { cells: 9 + mode * 2 });
      gpu()?.burst('eco-glow', { at, count: 2, spread: .05, life: [.35, .5], size: big, light: { intensity: 2.4 * big, range: 2.2, colour: ECO.nacar } });
      gpu()?.burst('eco-spark', { at, count: Math.round(26 * big), spread: .12, speed: 1.6, up: .3, life: [.3, .6] });
      gpu()?.burst('eco-mote', { at, count: Math.round(22 * big), spread: .25, speed: .25, up: .5, life: [.8, 1.5] });
      post?.pulse(.02, .3 * big);
    });
  }
  /** The cure: a veil of warm light through water wraps the ally, a ring and its echo go down through them and up again, a pool of light at their feet. */
  function fallHalo(id: string, accent: boolean) {
    const feet = scene.at(id); if (!feet) return;
    const tall = 1.25 * heightOf(id) + .3, top = feet.y + tall, k0 = muffled ? .45 : 1;
    wave(feet, .66, 'flat', .6, (k, w, _w2, e) => {
      const y = k < .5 ? top - (tall - .05) * ease(k * 2) : feet.y + .05 + (tall - .05) * ease((k - .5) * 2);
      e.setPosition(feet.x, y, feet.z); w[0] = .9; w[2] = .09; w[3] = (k < .5 ? 1 : 1 - (k - .5) * 2) * k0;
    }, { warm: 1, gold: accent ? 1.6 : undefined });
    water({ x: feet.x, y: feet.y + tall / 2, z: feet.z }, .6, tall / 2, 'veil', 1, (k, c, c2) => { c[1] = Math.sin(Math.PI * k) * 1.5 * k0; c2[2] = k; c2[3] = 1; }, { warm: 1 });
    water({ x: feet.x, y: feet.y + .04, z: feet.z }, 1, 1, 'pool', 1.3, (k, c, c2) => { c[1] = Math.sin(Math.PI * k) * k0; c2[2] = k * 1.3; c2[3] = 1; }, { warm: 1 });
    gpu()?.burst('eco-mote', { at: { x: feet.x, y: feet.y + .1, z: feet.z }, shape: 'ring', spread: .45, count: 26, up: .9, speed: .1, life: [.9, 1.6], colour: ECO.warm, light: { intensity: 1.6, range: 2, colour: ECO.warm } });
  }
  /** A sung beam from `a` to `b`: a fine core and two strands twisting round it, like a wave of sound. */
  function beam(a: pc.Vec3, b: pc.Vec3, k = 1, gold = false, seconds = .3) {
    const tip = gold ? ECO.gold : ECO.foam;
    effects.trails.comet(a, b, ['#ffffff', tip], seconds, { arc: .1, width: .022 * k, life: .26, intensity: 3.2 * k, core: .9, additive: 1, taper: .85 });
    for (const phase of [0, Math.PI]) effects.trails.comet(a, b, [ECO.nacar, tip], seconds, { arc: .1, width: .012 * k, life: .32, intensity: 2.4 * k, core: .5, additive: 1, taper: .6, twist: { turns: 2.5, radius: .07 * k, phase } });
  }
  /** The floor answers: ripples from two points, the voice and its echo, crossing in gold as they run out. */
  function ripple(e: Eco) {
    const p = e.root.getPosition(), floor = sides().us.y + .04, reach = e.grade === 2 ? 2.8 : 1.4;
    wave({ x: p.x, y: floor, z: p.z }, reach, 'flat', 1.6, (k, w, w2) => {
      w[0] = .08 + .84 * ease(k); w[1] = .22; w[2] = .2; w[3] = (1 - k) * (muffled ? .3 : .75); w2[0] = .35; w2[1] = 1;
    }, { lam: .17 / reach, warm: e.kind === 'bordon' ? .6 : 0 });
    gpu()?.burst('eco-floor', { at: { x: p.x, y: floor + .02, z: p.z }, shape: 'ring', spread: .2, count: muffled ? 8 : 20, outward: .9 + e.grade * .5, life: [.8, 1.3] });
  }
  function pulse(e: Eco, accent = false) {
    e.pulseAt = time; e.flash = accent ? 1.4 : 1;
    strike(e, accent ? 1.1 : .9, accent ? .9 : .65);
    const at = e.root.getPosition().clone(), { party, foes } = sides(), k = muffled ? .45 : 1;
    if (!accent) ripple(e);
    if (e.kind === 'ostinato') {
      const targets = e.grade === 2 ? foes.map(f => f.id) : [e.target && foes.some(f => f.id === e.target) ? e.target : foes[0]?.id].filter((id): id is string => !!id);
      for (const id of targets) {
        const to = chest(id); if (!to) continue;
        beam(at, to, k, accent, .28);
        after(.28, () => closeHalo(to, accent, e.grade === 2 ? .8 : .7, e.grade));
      }
    } else {
      const hurt = e.grade === 2 ? party.map(f => f.id) : [party[0]?.id].filter((id): id is string => !!id);
      for (const id of hurt) fallHalo(id, accent);
    }
    if (accent) gpu()?.burst('eco-spark', { at, count: 24, spread: .08, speed: 1.2, life: [.25, .5] });
  }

  // ——— The calls ———
  /** Ostinato or Bordón from `wearer` on `target`: the blow or the cure, then its eco rises into place. */
  function call(kind: EcoKind, wearer: string, target?: string) {
    if (ecos.length >= 3) drop(ecos[0]);
    const slot = freeSlot(), from = chest(wearer), { foes, party } = sides();
    const aimed = kind === 'ostinato' ? target && foes.some(f => f.id === target) ? target : foes[0]?.id : target && party.some(f => f.id === target) ? target : party[0]?.id;
    const to = aimed ? chest(aimed) : undefined;
    const e = build(kind, slot); e.target = aimed; ecos.push(e);
    shown(e, false);
    if (beatAt < 0) beatAt = time;
    if (from && to && kind === 'ostinato') {
      beam(from, to, 1.4, false, .3);
      after(.3, () => closeHalo(to, false, 1, 0));
    } else if (aimed) fallHalo(aimed, false);
    // A paler copy of the ring rises from where it landed to where the eco will float.
    const start = to ?? from ?? e.home;
    after(.52, () => effects.trails.comet(start, e.home, [ECO.nacar, ECO.foam], .55, { arc: .6, width: .04, life: .6, intensity: 2, core: .5, additive: 1, taper: .8 }));
    after(1.05, () => {
      if (!ecos.includes(e)) return;
      shown(e, true); e.born = time;
      wave(e.home, .9, 'face', .6, (k, w, w2) => { w[0] = .15 + .75 * ease(k); w[1] = .14; w[2] = .12; w[3] = 1 - k; w2[1] = .5; }, { lam: .09, warm: kind === 'bordon' ? .6 : 0 });
      gpu()?.burst('eco-mote', { at: e.home, count: 30, spread: .2, speed: .5, life: [.8, 1.4] });
      post?.pulse(.02, .35);
    });
    return e;
  }
  /** Every eco up a grade: louder, then wider; their clocks start over. Each shows its new note's figure, and the fight dims round them for a moment. */
  function crescendo() {
    if (!ecos.length || muffled) return false;
    for (const e of ecos) {
      e.grade = Math.min(2, e.grade + 1) as Grade; e.left = ECO.life; e.swellAt = time; e.flash = 1.2;
      strike(e, 1.6, 1);
      const at = e.root.getPosition();
      wave(at, 1.1 + .25 * e.grade, 'face', .75, (k, w, w2) => { w[0] = .15 + .78 * ease(k); w[1] = .14; w[2] = .14; w[3] = (1 - k) * .8; w2[1] = .7; }, { lam: .08 });
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
  /**
   * The ecos fly together over the foes and become one great sounding plate, its figure changing
   * note by note as it grows; the fight darkens round it, a column of warm light through water
   * stands over the foes, and the plate comes down on them all and is struck.
   */
  function tutti() {
    const list = ecos.slice(); if (muffled) return false;
    const { foes, them } = sides(), over = them.clone().add(new pc.Vec3(0, 2.4, 0)), floor = them.y + .06, t0 = time;
    beatAt = -1;
    const spot = () => foes.map(f => { const c = chest(f.id)!; return { x: c.x, y: c.y, z: c.z, radius: 1.2 }; });
    tween(2.2, k => post?.spotlight(.72 * Math.min(1, k * 4) * (k > .8 ? (1 - k) / .2 : 1), spot()), () => post?.spotlight(0, []));
    for (const e of list) leave(e, .5, over);
    const GROW = .4, FALL = .95, LAND = 1.27, size = 1.9;
    plate(over, size, 'flat', 2.7, (_k, m, m2, e) => {
      const s = time - t0, grow = back((s - GROW) / .5), note = Math.min(2.999, Math.max(0, (s - GROW) / (FALL - GROW)) * 3), out = Math.max(0, (s - LAND) / 1.4);
      m[0] = Math.floor(note); m[1] = m[0] + 1; m[2] = note - m[0];
      m[3] = Math.min(1, Math.max(0, (s - GROW) / .25)) * Math.pow(Math.max(0, 1 - out), 1.3) * 1.6;
      m2[0] = s > LAND ? s - LAND : 9; m2[3] = s * .45;
      e.setPosition(over.x, over.y - (over.y - floor) * ease((s - FALL) / (LAND - FALL)), over.z);
      const big = size * Math.max(.001, grow) * (1 + out * .22); e.setLocalScale(big, big, 1);
    }, { cells: 30 });
    water({ x: them.x, y: them.y + 3.3, z: them.z }, 1.7, 3.3, 'veil', 2.9, (_k, c, c2) => {
      const s = time - t0;
      c[1] = Math.min(1, Math.max(0, (s - .2) / .8)) * (s > LAND + .3 ? Math.max(0, 1 - (s - LAND - .3) / 1.2) : 1) * 1.7;
      c2[2] = s > LAND ? s - LAND : 9; c2[3] = 2;
    }, { warm: 1 });
    after(LAND, () => {
      for (const f of foes) { const c = chest(f.id); if (c) closeHalo(c, false, 1.15, 3); }
      const at = { x: them.x, y: floor, z: them.z };
      wave(at, 3.6, 'flat', 1.5, (k, w, w2) => { w[0] = .1 + .82 * ease(k); w[1] = .2; w[2] = .12; w[3] = 1 - k; w2[0] = .8; w2[1] = 1; }, { lam: .06 });
      water(at, 2.6, 2.6, 'pool', 1.7, (k, c, c2) => { c[1] = Math.sin(Math.PI * Math.min(1, k * 1.6) * .5) * (1 - k) * 2.2; c2[2] = k * 1.7; c2[3] = 2; }, { warm: 1 });
      gpu()?.burst('eco-ring', { at, count: 4, life: [.7, 1], size: 3 });
      gpu()?.burst('eco-mote', { at: { x: them.x, y: them.y + .4, z: them.z }, count: 160, spread: 1.6, speed: .4, up: .8, life: [1.2, 2.4], light: { intensity: 4, range: 4.5, colour: ECO.warm } });
      post?.pulse(.06, 1, .22);
    });
    return true;
  }
  /**
   * Back to the beginning: every eco's clock runs backwards, a great plate under the party plays its
   * figures from the last to the first while rings close in on it, and the ecos start over.
   */
  function dacapo() {
    if (ecos.length < 3 || muffled) return false;
    const { us, party } = sides(), at = { x: us.x, y: us.y + .05, z: us.z };
    for (const e of ecos) { e.left = ECO.life; e.swellAt = time; e.flash = 1.3; strike(e, 1.4, 1); }
    rewind = 1.2;
    plate(at, 2.7, 'flat', 1.6, (k, m, m2) => {
      const note = 3 * (1 - k);
      m[0] = Math.min(2, Math.floor(note)); m[1] = m[0] + 1; m[2] = note - m[0];
      m[3] = Math.pow(Math.sin(Math.PI * k), .6); m2[3] = -k * 1.4;
    }, { cells: 32 });
    for (let i = 0; i < 3; i++) wave(at, 2.9, 'flat', .9, (k, w, w2) => { w[0] = .95 - .85 * ease(k); w[1] = .1; w[2] = .07; w[3] = Math.sin(Math.PI * k); w2[1] = .5; }, { delay: i * .18, lam: .05 });
    gpu()?.burst('eco-floor', { at, shape: 'ring', spread: 2.2, count: 70, outward: -1.1, around: -1.2, life: [.9, 1.2] });
    for (const f of party) { const c = chest(f.id); if (c) gpu()?.burst('eco-mote', { at: c, count: 40, spread: .5, up: .6, life: [1, 1.8], light: { intensity: 1.5, range: 2, colour: ECO.nacar } }); }
    post?.pulse(.02, .6, .12);
    swellLight(1.6, .5);
    return true;
  }

  function setMuffled(on: boolean) { muffled = on; }

  // ——— Every frame ———
  /** One eco as it is now: where, how big, how bright, and what its three sheets are drawn with. */
  function draw(e: Eco, dt: number, floor: number) {
    e.clock += dt * (rewind > 0 ? -6 : 1);
    e.shown += (e.grade - e.shown) * Math.min(1, dt * 5);
    e.flash = Math.max(0, e.flash - dt * 2.2);
    e.figure = Math.max(0, e.figure - dt / e.figureFor);
    const appear = back((time - e.born) / .55), seen = Math.min(1, Math.max(0, (time - e.born) / .35)), since = time - e.pulseAt;
    const breath = since < .15 ? 1 - .1 * Math.sin(since / .15 * Math.PI / 2) : since < .4 ? .9 + .1 * (since - .15) / .25 : 1;
    const pop = 1 + .22 * Math.sin(Math.PI * Math.min(1, Math.max(0, (time - e.swellAt) / .5)));
    const gone = 1 - e.fade, size = breath * pop * appear * (1 + gone * (e.to ? -.35 : .6));
    const bob = e.going ? 0 : Math.sin((time - Math.max(0, beatAt)) / ECO.beat * Math.PI * 2) * .04;
    const at = e.to ? new pc.Vec3().lerp(e.home, e.to, ease(gone)) : new pc.Vec3(e.home.x, e.home.y + bob, e.home.z);
    e.root.setPosition(at);
    const dim = muffled ? .4 : 1, lit = dim * seen * e.fade;
    // Its own sheet, wide enough for its wings once it has them.
    const wings = e.shown > 1.02, hx = wings ? 4.8 : 2.1, hy = wings ? 2.7 : 2.1, shape = ECO.shape[e.kind];
    e.sheet.setRotation(faceQ); e.sheet.setLocalScale(hx * ECO.unit * size, hy * ECO.unit * size, 1);
    const figure = e.figure > .85 ? (1 - e.figure) / .15 : e.figure / .85;
    e.u.eco[0] = e.shown; e.u.eco[1] = since; e.u.eco[3] = lit;
    // Bordón's halo sways a little as it lies.
    if (e.kind === 'bordon') e.u.form[2] = shape.turn + Math.sin(time * .6 + e.seed) * .07;
    e.u.half[0] = hx; e.u.half[1] = hy; e.u.half[2] = muffled ? 0 : figure * e.figureAmount; e.u.half[3] = e.mode;
    e.u.look[0] = ECO.gain.body * (1 + e.flash * .6); e.u.look[2] = muffled ? 0 : 1; e.u.look[3] = e.clock;
    // Its veil hangs from it to the floor, and its pool lies there; both fade faster than it when it goes.
    const tall = Math.max(.2, at.y - floor), wide = .42 + .1 * e.shown, reach = .8 + .25 * e.shown, under = lit * .6 * Math.max(0, 1 - gone * 2.5);
    e.veil.setPosition(at.x, floor + tall / 2, at.z); e.veil.setLocalScale(wide, tall / 2, 1); e.veil.setRotation(uprightQ);
    e.u.veil[1] = under; e.u.veil2[0] = wide; e.u.veil2[1] = tall / 2; e.u.veil2[2] = since; e.u.veil2[3] = e.shown; e.u.veil3[1] = time;
    e.pool.setPosition(at.x, floor + .03, at.z); e.pool.setLocalScale(reach, reach, 1); e.pool.setRotation(flatQ);
    e.u.pool[1] = under; e.u.pool2[0] = reach; e.u.pool2[1] = reach; e.u.pool2[2] = since; e.u.pool2[3] = e.shown; e.u.pool3[1] = time;
    // The light it throws on whoever is under it (summed into the one shared light below).
    e.glow = (.5 + .45 * e.shown) * dim * (1 + e.flash * 1.6);
    if (e.going) return;
    // Motes rise off it from *mf*; at *f*, specks orbit it.
    if (e.shown > .6 && !muffled && gpu()) {
      e.motes ??= gpu()!.emitter('eco-mote', { at: { x: at.x, y: at.y, z: at.z }, rate: 10, spread: .18, life: [.9, 1.6], speed: .08, up: .25 });
      e.motes.at = { x: at.x, y: at.y, z: at.z }; e.motes.rate = 8 + 10 * e.shown;
    } else if (e.motes) { e.motes.remove(); e.motes = undefined; }
    if (e.shown > 1.5 && !muffled && gpu()) {
      const r = reachOf(e.shown) * ECO.unit * .55;
      e.orbit ??= gpu()!.volume({ shape: 'sphere', mode: 'orbit', at, size: { x: r, y: r, z: r }, strength: 6, swirl: 5, distance: .12, range: .7, kinds: ['eco-orbit'] });
      e.specks ??= gpu()!.emitter('eco-orbit', { at: { x: at.x, y: at.y, z: at.z }, rate: 26, spread: .4, life: [1.2, 2] });
      e.orbit.at.set(at.x, at.y, at.z); e.specks.at = { x: at.x, y: at.y, z: at.z };
    } else { e.orbit?.remove(); e.specks?.remove(); e.orbit = undefined; e.specks = undefined; }
  }
  function update(dt: number) {
    time += dt;
    aim();
    for (let i = tweens.length - 1; i >= 0; i--) {
      const tw = tweens[i], k = (time - tw.t0) / tw.dur;
      if (k < 0) continue;
      tw.step(Math.min(1, k));
      if (k >= 1) { tweens.splice(tweens.indexOf(tw), 1); tw.end?.(); }
    }
    // The compás: every eco sounds together on the beat.
    if (beatAt >= 0 && ecos.length) {
      if (time - beatAt >= ECO.beat) { beatAt += ECO.beat; for (const e of ecos) if (e.root.enabled) pulse(e); if (ecos.length === 3) chord(); }
    } else if (!ecos.length) beatAt = -1;
    const floor = sides().us.y;
    rewind = Math.max(0, rewind - dt);
    for (const e of [...ecos]) {
      e.left -= dt;
      if (e.left <= 0) { drop(e); continue; }
      if (e.root.enabled) draw(e, dt, floor);
    }
    for (const e of [...leaving]) {
      e.fade -= dt / e.fadeFor;
      if (e.fade <= 0) { leaving.splice(leaving.indexOf(e), 1); destroyEco(e); } else draw(e, dt, floor);
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
  /** Three ecos at once: lines of light join them for a beat, each shows its figure, and the fight brightens on them. */
  function chord() {
    if (chordAt > time - 1) return;
    chordAt = time;
    const ps = ecos.map(e => e.root.getPosition().clone());
    for (let i = 0; i < ps.length; i++) {
      const a = ps[i], b = ps[(i + 1) % ps.length], d = a.distance(b);
      gpu()?.burst('eco-floor', { at: a, to: b, shape: 'line', count: Math.round(d * 60), life: [.8, 1], size: .8 });
    }
    for (const e of ecos) strike(e, 1.2, 1);
    post?.pulse(.02, .45);
  }

  const onUpdate = (dt: number) => { update(dt); placeLamp(dt); };
  app.on('update', onUpdate);
  return {
    call, crescendo, contratiempo, tutti, dacapo, setMuffled,
    get muffled() { return muffled; },
    /** Development: where each eco is and how it is drawn now. */
    debug() { return ecos.map(e => ({ kind: e.kind, grade: e.grade, shown: e.shown, at: e.root.getPosition().toString(), figure: e.figure, mode: e.mode, light: e.glow })); },
    get count() { return ecos.length; },
    /** How far the compás is between beats (0–1), for an icon. */
    get phase() { return beatAt < 0 ? 0 : ((time - beatAt) % ECO.beat) / ECO.beat; },
    /** Whether now is the off-beat (half a second either side of halfway). */
    get offbeat() { return beatAt >= 0 && Math.abs(((time - beatAt) % ECO.beat) - ECO.beat / 2) <= .5; },
    /** Every eco gone at once, nothing left in the air. */
    clear() { for (const e of [...ecos, ...leaving]) emitters(e); ecos.length = 0; leaving.length = 0; beatAt = -1; tweens.length = 0; post?.spotlight(0, []); for (const c of [...root.children]) c.destroy(); },
    destroy() {
      app.off('update', onUpdate);
      for (const e of [...ecos, ...leaving]) emitters(e);
      root.destroy(); lamp.destroy(); sheets.destroy();
    },
  };
}
export type EcoFx = ReturnType<typeof createEcoFx>;
