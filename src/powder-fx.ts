import * as pc from 'playcanvas';
import { bodyOf, type Effects } from './effects.ts';
import type { GpuEmitter, GpuKind } from './fight-particles.ts';

/**
 * The coloured powder of Luca's ánima, as a look (docs/animas/prismatico/README.md § Look and
 * interface), built in the effects lab ahead of the ánima (src/powder-lab.ts). It is the powder
 * thrown at a Holi: dry pigment, **matte** (it takes the scene's light and has none of its own),
 * that bursts, stops in the air and hangs there, and gets on everything.
 *
 * - **The puff** (`puff`): a dense core of lumps (`pigment`) thrown out hard and stopped by the air
 *   within half a metre (that sudden stop is the puff), a handful of jets that stretch into plumes,
 *   a thin cloud that stays and sinks (`pigmenthaze`), and many hundreds of grains (`grain`) that
 *   fly further, hang, drift down, cling to whoever is in the way and stay on the floor as dust
 *   (`pigmentdust`, and the soft stains of `dusting`).
 * - **Covered in powder** (`dust`): powder clinging to someone's parts (`coat-N`), shedding grains,
 *   a little of the cloud still round them. What the two elements find later.
 * - **Fire on it** (`ignite`): powder hanging in the air burns all at once. A flash, a ball of
 *   flame off their whole body (`fireball`), the powder blown out charred (`char`), a ring along
 *   the floor (`blastring`), embers thrown at whoever stands near, a scorch and smoke.
 * - **Water on it** (`soak`): the powder runs wet, which shines (`wetpatch`, `paintblob`,
 *   `paintpool`: the `pool` shape), turning a sick green as it goes: poison.
 * - **The cortina** (`cortina`, `romper`): the protective spell. A handful thrown upwards hangs in
 *   front of an ally as a standing screen (`pigmentscreen`), grains falling from it; the blow that
 *   breaks it throws the whole of it forward over whoever dealt it, who is left covered.
 *
 * Every powder kind is white and takes its colour from the burst: grey in the ánima's first round,
 * a mix of two or three of `POWDER_COLOURS` in the second (the colours do nothing; they are muted
 * and never one flat colour). Only the look: nothing here touches a fight's numbers.
 */
const WHITE = ['#ffffff', '#f6f6f6', '#e2e2e2'] as const;
const BRIGHT = [1.3, 1.22, 1.1] as const;
const COAT: GpuKind = {
  shape: 'powder', drag: 4, gravity: 0, curl: 0, response: 0, collide: true, bounce: 0, friction: 1, stick: 1, stickTime: 26, size: [.02, .046], sizeJitter: .6,
  colours: WHITE, intensity: BRIGHT, fadeIn: .05, fadeOut: .06, additive: 0, opacity: .92, core: 0,
};
/** The coat is a few kinds in turn: fire or water hides the one in use (all the powder goes at once) and the next powder uses the next. */
const COATS = 3;
export const POWDER_KINDS: Record<string, GpuKind> = {
  pigment: {
    shape: 'powder', drag: 6.5, gravity: -.1, curl: .7, response: .6, size: [.1, .36], sizeJitter: .55,
    colours: WHITE, intensity: BRIGHT, middle: .25, fadeIn: .02, fadeOut: .75, additive: 0, opacity: .86, core: 0,
  },
  pigmenthaze: {
    shape: 'powder', drag: 2.2, gravity: .14, curl: 1, response: .9, size: [.2, .5], sizeJitter: .5, blur: .5,
    colours: WHITE, intensity: BRIGHT, middle: .3, fadeIn: .25, fadeOut: .6, additive: 0, opacity: .3, core: 0,
  },
  // A handful in flight: it keeps its speed, and is gone where it lands (the puff takes over).
  pigmentthrow: {
    shape: 'powder', drag: .7, gravity: 2.5, curl: .2, response: .2, size: [.07, .12], sizeJitter: .5,
    colours: WHITE, intensity: BRIGHT, fadeIn: .03, fadeOut: .15, additive: 0, opacity: .85, core: 0,
  },
  grain: {
    shape: 'powder', drag: 2.6, gravity: 1.6, curl: 1.3, response: .9, collide: true, bounce: 0, friction: 1, stick: .2, stickTime: 6, size: [.013, .009], sizeJitter: .7,
    colours: WHITE, intensity: BRIGHT, fadeIn: .02, fadeOut: .3, additive: 0, opacity: 1, core: 0, onLand: 'pigmentdust',
  },
  pigmentdust: {
    shape: 'powder', flat: true, settle: true, drag: 8, gravity: 30, collide: true, bounce: 0, friction: 1, size: [.016, .03], sizeJitter: .7,
    colours: WHITE, intensity: [1.4, 1.3, 1.15], fadeOut: .3, additive: 0, opacity: .85, core: 0, life: [16, 22],
  },
  // Powder lying on the floor in a soft stain, where the cloud came down.
  dusting: {
    shape: 'powder', flat: true, settle: true, drag: 8, gravity: 30, collide: true, bounce: 0, friction: 1, size: [.14, .42], sizeJitter: .6,
    colours: WHITE, intensity: [1.35, 1.25, 1.1], fadeIn: .08, fadeOut: .25, additive: 0, opacity: .42, core: 0,
  },
  // The cortina: powder that stays where it was thrown, churning, renewed while it stands.
  pigmentscreen: {
    shape: 'powder', drag: 3.2, gravity: .04, curl: .8, response: .7, size: [.2, .38], sizeJitter: .5,
    colours: WHITE, intensity: BRIGHT, middle: .4, fadeIn: .22, fadeOut: .5, additive: 0, opacity: .72, core: 0,
  },
  // Fire on the powder: what was hanging in the air, blown out and charred as it goes.
  char: {
    shape: 'powder', drag: 2.4, gravity: 2.2, curl: 1.4, response: 1, collide: true, bounce: .1, friction: .9, size: [.015, .01], sizeJitter: .7,
    colours: ['#ffffff', '#4a4a4a', '#141414'], intensity: [2.2, 1, .8], middle: .22, fadeIn: 0, fadeOut: .35, additive: 0, opacity: 1, core: 0,
  },
  fireball: {
    shape: 'flame', drag: 4.2, gravity: -2.4, curl: 1.6, response: 1, size: [.12, .4], sizeJitter: .6, blur: [0, .5],
    colours: ['#fff6d8', '#ff9a2e', '#7a1c08'], intensity: [7, 3.6, 1], middle: .3, fadeIn: 0, fadeOut: .6, additive: .85, opacity: 1, flicker: .25,
  },
  blastflash: {
    shape: 'glow', drag: 0, gravity: 0, curl: 0, response: 0, size: [.5, 1.7], colours: ['#ffffff', '#ffe0a0', '#ff8a30'], intensity: [9, 5, 1], middle: .3, fadeIn: 0, fadeOut: .8, additive: 1, opacity: 1,
  },
  blastring: {
    shape: 'ring', flat: true, drag: 0, gravity: 0, curl: 0, response: 0, size: [.2, 2.6], colours: ['#fff4d0', '#ffb347', '#ff6a1a'], intensity: [6, 3, 1], middle: .3, fadeIn: 0, fadeOut: .7, additive: 1, opacity: 1,
  },
  // Water on the powder: it is paint now, wet, and it shines.
  paintblob: {
    shape: 'dot', drag: .6, gravity: 8, curl: 0, response: .1, collide: true, bounce: 0, friction: .96, stick: .4, stickTime: 1.4, size: [.03, .024], sizeJitter: .6,
    colours: WHITE, fadeIn: .08, fadeOut: .08, additive: 0, opacity: 1, core: .75, onLand: 'paintpool',
  },
  paintpool: {
    shape: 'pool', flat: true, settle: true, drag: 8, gravity: 30, collide: true, bounce: 0, friction: 1, size: [.04, .26], sizeJitter: .65,
    colours: ['#ffffff', '#f0f0f0', '#c9c9c9'], intensity: [1.25, 1.2, 1.05], middle: .6, fadeOut: .1, additive: 0, opacity: 1, core: 0, life: [14, 18],
  },
  wetpatch: {
    shape: 'pool', drag: 4, gravity: 0, curl: 0, response: 0, collide: true, bounce: 0, friction: 1, stick: 1, stickTime: 12, size: [.02, .06], sizeJitter: .6,
    colours: WHITE, intensity: [1.25, 1.2, 1.05], fadeIn: .02, fadeOut: .1, additive: 0, opacity: 1, core: 0,
  },
  ...Object.fromEntries(Array.from({ length: COATS }, (_, i) => [`coat-${i}`, COAT])),
};
/**
 * The powder's colours: grey while the ánima is in its first round; in the second, dry pigments as
 * they look in daylight (terracotta, mustard, sage, dusty teal, slate blue, brick), muted, and
 * always mixed: a puff takes two or three (never saturated pink or violet).
 */
export const POWDER_GREY = '#aaa59c';
export const POWDER_COLOURS = ['#c4907b', '#cdb276', '#9db191', '#7fa6a1', '#8a97b6', '#b98078'] as const;
/** A puff's colours: one, or the few it mixes (each lump and each grain is one of them). */
export type PowderMix = string | readonly string[];
/** What water makes of it. */
const POISON = '#6fae2c';

type V3 = { x: number; y: number; z: number };
export interface PowderScene {
  model(id: string): pc.Entity | undefined;
  /** The fire reached `id`: they burn a little (the lab shows Quemado I). */
  onBurn?(id: string): void;
  /** The powder on `id` ran as poison (the lab shows Envenenado I). */
  onPoison?(id: string): void;
}
interface Powdered { shed?: GpuEmitter; haze?: GpuEmitter; left: number; colour: string }
/** A cortina standing: its middle at the floor, the way it faces, the way across it, and what keeps it up. */
interface Screen { columns: V3[]; facing: V3; height: number; mix: PowderMix; clock: number; next: number }
/** A standing cortina is renewed a column at a time, this often. */
const SCREEN_STEP = .04;

const hex = (c: pc.Color) => '#' + [c.r, c.g, c.b].map(v => Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, '0')).join('');
const blend = (a: string, b: string, k: number) => hex(new pc.Color().lerp(new pc.Color().fromString(a), new pc.Color().fromString(b), k));
/** A mix seen from afar: its colours in equal parts. */
const middleOf = (mix: PowderMix) => typeof mix === 'string' ? mix : mix.reduce((all, c, i) => blend(all, c, 1 / (i + 1)));
/** A mix's shades as they are thrown: each pulled part of the way to the mix's middle, so a puff is one powder with veins in it and not three colours side by side. */
const shadesOf = (mix: PowderMix): readonly string[] => typeof mix === 'string' ? [mix] : mix.map(c => blend(c, middleOf(mix), .25));

export function createPowderFx(app: pc.AppBase, effects: Effects, scene: PowderScene) {
  const gpu = () => effects.gpu && effects.gpu.active ? effects.gpu : undefined;
  const g0 = effects.gpu;
  if (g0) for (const [name, kind] of Object.entries(POWDER_KINDS)) if (!g0.get(name)) g0.define(name, kind);
  const powdered = new Map<string, Powdered>();
  const screens = new Map<string, Screen>();
  const timers: { left: number; run(): void }[] = [];
  const after = (seconds: number, run: () => void) => timers.push({ left: seconds, run });
  let coat = 0;

  /** Someone in the fight: where they stand, how big they are and where the fight particles have them. */
  function who(id: string) {
    const model = scene.model(id), p = model?.getPosition();
    if (!model || !p) return undefined;
    const feet = { x: p.x, y: p.y, z: p.z }, body = bodyOf(model, feet);
    return { model, feet, body, index: effects.fighterIndex(model), chest: { x: feet.x, y: feet.y + body.height * .58, z: feet.z } };
  }
  /** The way from one point to another, along the floor. */
  function towards(from: V3, to: V3): V3 {
    const x = to.x - from.x, z = to.z - from.z, d = Math.hypot(x, z) || 1;
    return { x: x / d, y: 0, z: z / d };
  }
  /** All the powder on everyone goes: the coat in use is hidden, and what shed from it stops. */
  function strip() {
    const g = gpu();
    powdered.forEach(p => { p.shed?.remove(); p.haze?.remove(); });
    if (!g) return;
    g.define(`coat-${coat}`, { ...COAT, opacity: 0 });
    coat = (coat + 1) % COATS;
    g.define(`coat-${coat}`, COAT);
  }

  const api = {
    /**
     * The puff: a handful of dry powder bursting at `at`, thrown on along `dir`, over a floor at
     * `floor`. About two and a half thousand particles at full `strength`.
     */
    puff(at: V3, colour: PowderMix, dir: V3 = { x: 0, y: 0, z: 0 }, strength = 1, floor = at.y - .9) {
      const g = gpu();
      if (!g) return false;
      const shades = shadesOf(colour), parts = shades.length;
      const n = (count: number) => Math.max(1, Math.round(count * strength / parts)), k = Math.sqrt(strength);
      // Jets: each a narrow cone whose particles leave at every speed, so it stretches into a plume. Each of one colour of the mix.
      for (let j = 0; j < 9; j++) {
        const a = Math.random() * Math.PI * 2, up = .15 + Math.random() * .85, flat = Math.sqrt(1 - up * up * .7);
        const d = { x: Math.cos(a) * flat + dir.x * .8, y: up, z: Math.sin(a) * flat + dir.z * .8 }, len = Math.hypot(d.x, d.y, d.z);
        const jet = { x: d.x / len, y: d.y / len, z: d.z / len }, v = (5 + Math.random() * 2.5) * k, shade = shades[j % parts];
        g.burst('pigment', { at, count: Math.max(1, Math.round(18 * strength)), spread: .06, velocity: { x: jet.x * v, y: jet.y * v, z: jet.z * v }, cone: .2, speed: v * .65, life: [.6, 1.15], size: .72 * k, colour: shade });
        g.burst('grain', { at, count: Math.max(1, Math.round(150 * strength)), spread: .05, velocity: { x: jet.x * v * 1.2, y: jet.y * v * 1.2, z: jet.z * v * 1.2 }, cone: .3, speed: v * .8, life: [1.6, 3.4], colour: shade });
      }
      for (const shade of shades) {
        // The core: out hard in every direction, and stopped.
        g.burst('pigment', { at, count: n(80), spread: .12 * k, velocity: { x: dir.x * 1.5, y: .6, z: dir.z * 1.5 }, speed: 7.5 * k, life: [.55, 1.05], size: k, colour: shade });
        // What stays: a thin cloud that sinks, and grains everywhere.
        g.burst('pigmenthaze', { at, count: n(40), spread: .35 * k, velocity: { x: dir.x * .4, y: .2, z: dir.z * .4 }, speed: 1.2, life: [2.2, 4], size: k, colour: shade });
        g.burst('grain', { at, count: n(900), spread: .15, velocity: { x: dir.x, y: .8, z: dir.z }, speed: 5 * k, life: [1.6, 3.4], colour: shade });
        // Along the floor: a low roll of it going out, and the stain it leaves.
        g.burst('pigment', { at: { x: at.x, y: floor + .08, z: at.z }, count: n(22), shape: 'ring', spread: .25, outward: 3 * k, up: .1, speed: .6, life: [.5, .9], size: .85 * k, colour: shade });
        g.burst('dusting', { at: { x: at.x + dir.x * .3, y: floor + .25, z: at.z + dir.z * .3 }, count: n(9), spread: .75 * k, life: [16, 21], colour: shade });
      }
      return true;
    },
    /**
     * Covered in powder for `seconds`: it clings to their parts, sheds grains, and a little of the
     * cloud stays round them. This is what fire and water find.
     */
    dust(id: string, colour: PowderMix, seconds = 20) {
      const g = gpu(), f = who(id);
      if (!g || !f || f.index < 0) return false;
      const old = powdered.get(id);
      old?.shed?.remove(); old?.haze?.remove();
      const on = { at: f.feet, shape: 'surface' as const, fighter: f.index };
      const shades = shadesOf(colour), middle = middleOf(colour);
      for (const shade of shades) g.burst(`coat-${coat}`, { ...on, above: .08, count: Math.round(300 / shades.length), outward: -.4, speed: .05, life: [seconds - 2, seconds], colour: shade });
      const shed = g.emitter('grain', { ...on, above: .2, rate: 16, outward: .2, speed: .12, life: [1.2, 2.2], colour: shades[0] });
      const haze = g.emitter('pigmenthaze', { at: f.chest, rate: 2.2, spread: f.body.radius + .25, speed: .25, life: [2, 3.4], size: .7, colour: middle });
      powdered.set(id, { shed, haze, left: seconds, colour: middle });
      return true;
    },
    /** A handful thrown from `from` at `target`: it crosses in a third of a second leaving a streak in the air, bursts on them and leaves them covered. */
    lanzar(from: string, target: string, colour: PowderMix, delay = 0) {
      const g = gpu(), a = who(from), b = who(target);
      if (!g || !a || !b) return false;
      after(delay, () => {
        const dir = towards(a.feet, b.feet), t = .32, gravity = POWDER_KINDS.pigmentthrow.gravity!;
        const origin = { x: a.chest.x + dir.x * .35, y: a.chest.y + .25, z: a.chest.z + dir.z * .35 };
        const v = { x: (b.chest.x - origin.x) / t, y: (b.chest.y - origin.y) / t + gravity * t / 2, z: (b.chest.z - origin.z) / t }, speed = Math.hypot(v.x, v.y, v.z);
        const shades = shadesOf(colour);
        for (const shade of shades) {
          g.burst('pigmentthrow', { at: origin, count: Math.round(30 / shades.length), spread: .1, velocity: v, speed: .9, life: [t * .9, t], colour: shade });
          g.burst('grain', { at: origin, count: Math.round(320 / shades.length), spread: .08, velocity: { x: v.x * .6, y: v.y * .6 + .5, z: v.z * .6 }, cone: .14, speed: speed * .45, life: [1, 2.2], colour: shade });
        }
        after(t, () => { api.puff(b.chest, colour, dir, 1, b.feet.y); api.dust(target, colour); });
      });
      return true;
    },
    /** One handful for each of `targets`, a breath apart, each in its mix of `mixes` in turn. */
    nube(from: string, targets: readonly string[], mixes: readonly PowderMix[]) {
      return targets.map((id, i) => api.lanzar(from, id, mixes[i % mixes.length], i * .14)).some(Boolean);
    },
    /**
     * The cortina: a handful thrown upwards in front of `id`, on the side the blows come from
     * (`from`, a point), that hangs there as a standing screen a body wide and a little taller. It
     * stays until `romper` or `clear`.
     */
    cortina(id: string, from: V3, colour: PowderMix) {
      const g = gpu(), f = who(id);
      if (!g || !f) return false;
      const facing = towards(f.feet, from), shades = shadesOf(colour), height = f.body.height + .3, out = f.body.radius + .6;
      // An arc round their front: six columns of it, the outer ones thinner.
      const turn = Math.atan2(facing.z, facing.x);
      const columns = [-1, -.6, -.2, .2, .6, 1].map(k => ({ x: f.feet.x + Math.cos(turn + k * .8) * out, y: f.feet.y, z: f.feet.z + Math.sin(turn + k * .8) * out }));
      const column = (c: V3, from = .08, to = 1) => ({ at: { x: c.x, y: c.y + height * from, z: c.z }, to: { x: c.x, y: c.y + height * to, z: c.z }, shape: 'line' as const });
      // Thrown up from the floor: lumps and grains leaving at every speed, so they stop at every height.
      columns.forEach((c, i) => {
        const shade = shades[i % shades.length], foot = column(c, .04, .1);
        g.burst('pigment', { ...foot, count: 12, spread: .12, velocity: { x: 0, y: height * 5.2, z: 0 }, speed: height * 3.4, life: [.6, 1.1], size: .8, colour: shade });
        g.burst('grain', { ...foot, count: 130, spread: .14, velocity: { x: 0, y: height * 2.6, z: 0 }, speed: height * 2.4, life: [1.4, 3], colour: shade });
        g.burst('dusting', { at: { x: c.x, y: c.y + .25, z: c.z }, count: 1, spread: .2, life: [16, 21], colour: shade });
      });
      // And kept up (`update`): each column renewed in turn while it stands, grains falling out of it.
      screens.set(id, { columns, facing, height, mix: colour, clock: 0, next: 0 });
      return true;
    },
    /**
     * The blow that breaks `id`'s cortina: the whole screen is thrown forward, and over `by` (who
     * dealt it) if given: a puff on them, and they are left covered in its powder.
     */
    romper(id: string, by?: string) {
      const g = gpu(), s = screens.get(id);
      if (!g || !s) return false;
      screens.delete(id);
      const shades = shadesOf(s.mix), b = by ? who(by) : undefined, mid = s.columns[Math.floor(s.columns.length / 2)];
      const dir = b ? towards(mid, b.chest) : s.facing, far = b ? Math.hypot(b.chest.x - mid.x, b.chest.z - mid.z) : 3, v = 9;
      s.columns.forEach((c, i) => {
        const line = { at: { x: c.x, y: c.y + s.height * .08, z: c.z }, to: { x: c.x, y: c.y + s.height, z: c.z }, shape: 'line' as const }, shade = shades[i % shades.length];
        g.burst('pigment', { ...line, count: 16, spread: .2, velocity: { x: dir.x * v * .8, y: .9, z: dir.z * v * .8 }, cone: .35, speed: v * .5, life: [.5, 1], size: .8, colour: shade });
        g.burst('grain', { ...line, count: 180, spread: .2, velocity: { x: dir.x * v, y: 1.2, z: dir.z * v }, cone: .3, speed: v * .6, life: [1.4, 3], colour: shade });
      });
      if (b && by) after(Math.min(.3, far / v), () => { api.puff(b.chest, s.mix, dir, .7, b.feet.y); api.dust(by, s.mix); });
      return true;
    },
    /** Who has a cortina standing in front of them. */
    get screens() { return [...screens.keys()]; },
    /**
     * Fire on the powder: everyone covered goes up, a breath after the one before, and the blast
     * reaches `near` (whoever stands by): embers thrown at them, and all of them left burning a little.
     */
    ignite(near: readonly string[] = []) {
      const g = gpu();
      if (!g || !powdered.size) return false;
      const lit = [...powdered.entries()];
      strip(); powdered.clear();
      lit.forEach(([id, p], i) => after(i * .12, () => {
        const f = who(id);
        if (!f || f.index < 0) return;
        const on = { at: f.feet, shape: 'surface' as const, fighter: f.index, above: .08 };
        g.burst('blastflash', { at: f.chest, count: 3, spread: .1, life: [.16, .22] });
        g.burst('blastring', { at: { x: f.feet.x, y: f.feet.y + .03, z: f.feet.z }, count: 1, spread: 0, life: [.4, .46] });
        g.burst('fireball', { ...on, count: 110, outward: 5.5, up: 1.6, speed: 2.2, life: [.3, .75], light: { intensity: 5, range: 6, colour: '#ffb060' } });
        g.burst('fireball', { at: f.chest, count: 40, spread: .3, speed: 7, life: [.25, .5], size: 1.3 });
        g.burst('char', { ...on, count: 800, outward: 9, up: 2.6, speed: 4.5, life: [1, 2.4], colour: p.colour });
        if (g.get('ember')) g.burst('ember', { ...on, count: 180, outward: 6.5, up: 3, speed: 2.5, life: [.6, 1.5] });
        if (g.get('crackle')) g.burst('crackle', { ...on, count: 60, outward: 4, up: 3, speed: 2, life: [.3, .8] });
        effects.mark('scorch', f.feet, 1.1);
        after(.14, () => { if (g.get('burnsmoke')) g.burst('burnsmoke', { ...on, count: 70, outward: 1.2, up: 1.6, speed: .8, life: [1.2, 2.6], size: 1.6 }); });
        scene.onBurn?.(id);
        for (const other of near) {
          if (other === id) continue;
          const o = who(other);
          if (!o) continue;
          const to = { x: o.chest.x - f.chest.x, y: o.chest.y - f.chest.y, z: o.chest.z - f.chest.z }, d = Math.hypot(to.x, to.y, to.z) || 1, v = 11;
          if (g.get('ember')) g.burst('ember', { at: f.chest, count: 46, spread: .2, velocity: { x: to.x / d * v, y: to.y / d * v + 1, z: to.z / d * v }, cone: .3, speed: 3, life: [.4, .9] });
          after(d / v, () => { g.burst('fireball', { at: o.chest, count: 22, spread: .2, speed: 3, life: [.25, .5], size: .8 }); scene.onBurn?.(other); });
        }
      }));
      return true;
    },
    /** Water on the powder: on everyone covered it runs as wet paint, turning green as it goes, drips, pools at their feet, and poisons them. */
    soak() {
      const g = gpu();
      if (!g || !powdered.size) return false;
      const wet = [...powdered.entries()];
      strip(); powdered.clear();
      wet.forEach(([id, p], i) => after(i * .1, () => {
        const f = who(id);
        if (!f || f.index < 0) return;
        const on = { at: f.feet, shape: 'surface' as const, fighter: f.index }, running = blend(p.colour, POISON, .45), sick = blend(p.colour, POISON, .8);
        g.burst('wetpatch', { ...on, above: .08, count: 90, outward: -.4, speed: .05, life: [7, 10], colour: running });
        g.burst('paintblob', { ...on, above: .15, count: 150, outward: .25, speed: .2, life: [1.4, 2.4], size: .7, colour: running });
        g.burst('paintblob', { at: { x: f.feet.x, y: f.feet.y + .4, z: f.feet.z }, count: 9, shape: 'ring', spread: f.body.radius + .2, speed: .5, life: [1, 1.5], size: 1.5, colour: sick });
        const drips = g.emitter('paintblob', { ...on, above: .2, rate: 9, outward: .03, speed: .05, life: [1.6, 2.6], size: .6, colour: sick });
        after(6, () => drips.remove());
        after(.5, () => scene.onPoison?.(id));
      }));
      return true;
    },
    /** Who is covered in powder now. */
    get powdered() { return [...powdered.keys()]; },
    /** Takes the powder off everyone (what is in the air and on the floor goes on its own). */
    clear() { strip(); powdered.clear(); timers.length = 0; screens.clear(); },
    destroy() { api.clear(); app.off('update', update); },
  };
  function update(dt: number) {
    for (let i = timers.length - 1; i >= 0; i--) if ((timers[i].left -= dt) <= 0) timers.splice(i, 1)[0].run();
    for (const [id, p] of powdered) if ((p.left -= dt) <= 0) { p.shed?.remove(); p.haze?.remove(); powdered.delete(id); }
    const g = gpu();
    if (g) for (const s of screens.values()) {
      s.clock += Math.min(dt, .1);
      const shades = shadesOf(s.mix);
      for (; s.clock >= SCREEN_STEP; s.clock -= SCREEN_STEP) {
        // One column a step: a few lumps along its height (the outer columns shorter and thinner), and grains that fall out of it.
        const i = s.next++ % s.columns.length, c = s.columns[i], edge = i === 0 || i === s.columns.length - 1, shade = shades[(i + Math.floor(s.next / s.columns.length)) % shades.length];
        const at = { x: c.x, y: c.y + s.height * Math.random() * .12, z: c.z }, to = { x: c.x, y: c.y + s.height * (edge ? .8 : .95 + Math.random() * .1), z: c.z };
        g.burst('pigmentscreen', { at, to, shape: 'line', count: edge ? 4 : 8, spread: .17, speed: .2, life: [1, 1.7], size: edge ? .8 : 1, colour: shade });
        g.burst('grain', { at, to, shape: 'line', count: 5, spread: .3, speed: .4, life: [1.2, 2.2], colour: shade });
      }
    }
  }
  app.on('update', update);
  return api;
}
export type PowderFx = ReturnType<typeof createPowderFx>;
