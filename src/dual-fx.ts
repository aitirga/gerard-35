import type { Effects } from './effects';
import type { GpuBurst, GpuKind } from './fight-particles';

/**
 * What dual attacks and the tower's fears draw in a fight (docs/graphics.md § Ataques duales y
 * miedos de la torre), on the GPU fight engine only (src/fight-particles.ts). Lines, rings and
 * digits are drawn with `glyph`s, dots of light that stay where they are born, so a figure reads as
 * drawn in the air; wind is `gale`, long thin streaks that ride straight on. Everything that comes
 * later runs on the fight's own clock (`update` with the fight's seconds), so slow motion and a
 * hit-stop stretch a drawing too. Duals keep to gold, orange and cream; fear's things to violet
 * (docs/visual-style.md).
 */
export const DUAL_KINDS = {
  glyph: {
    drag: 14, gravity: 0, curl: 0, response: 0, size: [.024, .016], sizeJitter: .2, shape: 'dot',
    colours: ['#ffffff', '#ffffff', '#ffffff'], intensity: [4.2, 3, 1.6], middle: .45, fadeIn: .05, fadeOut: .35, additive: 1, flicker: .06, core: .5,
  },
  gale: {
    blur: [0, .4],
    drag: .05, gravity: 0, curl: .25, response: .3, size: [.017, .009], sizeJitter: .4, stretch: .09, aspect: .16, shape: 'streak',
    colours: ['#ffffff', '#ffffff', '#ffffff'], intensity: [2.8, 2, .8], middle: .4, fadeIn: .15, fadeOut: .45, additive: .85,
  },
  // ¡Puaj!: thick grey-green blobs that cover what is behind them (never light), cling to whoever
  // they hit and lie on the floor as a puddle (`muckpool`), so they show on the tower's bright floor.
  muck: {
    drag: .5, gravity: 9, collide: true, bounce: .05, friction: .8, stick: .8, stickTime: 1.4, size: [.05, .04], sizeJitter: .6, shape: 'dot',
    colours: ['#9aa462', '#6f7a42', '#4b532c'], intensity: [1, .95, .9], middle: .3, fadeOut: .25, additive: .03, core: 0, onLand: 'muckpool',
  },
  muckpool: {
    drag: 8, gravity: 30, collide: true, bounce: 0, friction: 1, settle: true, size: [.09, .13], sizeJitter: .5, shape: 'dot',
    colours: ['#7f8a4e', '#5e6937', '#454d28'], intensity: [1, .95, .9], fadeOut: .3, additive: .03, core: 0, life: [1.4, 2.2],
  },
  // Aplastón: dark grit thrown out low along the floor, covering (not lighting) what it passes.
  grit: {
    blur: [.2, .9],
    drag: 2.4, gravity: 3, collide: true, bounce: .15, friction: .6, size: [.08, .2], sizeJitter: .6, shape: 'glow',
    colours: ['#7a6a52', '#56493a', '#3b322a'], intensity: [1, .9, .8], middle: .35, fadeOut: .55, additive: .03, opacity: .8, core: 0, life: [.6, 1.1],
  },
  // Vertitrón's eye: streaks of violet light that turn inside it (a force field holds them round it).
  eyeswirl: {
    blur: [0, .3],
    drag: .4, gravity: 0, curl: .08, response: 1, size: [.024, .012], sizeJitter: .4, stretch: .05, aspect: .3, shape: 'streak',
    colours: ['#ffffff', '#d9c8ff', '#9a6cd8'], intensity: [4.5, 3, 1.6], middle: .35, fadeIn: .12, fadeOut: .4, additive: 1, flicker: .15, core: .6,
  },
  // Rayo terrorífico: hot dots of light along the beam, and the violet sparks it throws off the floor.
  beam: {
    drag: 2, gravity: 0, curl: .3, response: .2, size: [.05, .02], sizeJitter: .5, shape: 'glow',
    colours: ['#ffffff', '#e8d8ff', '#9a6cd8'], intensity: [7, 4.5, 2], middle: .3, fadeOut: .5, additive: 1, flicker: .2, core: .8,
  },
  scorch: {
    drag: .6, gravity: 8, curl: .2, response: .3, collide: true, bounce: .4, friction: .3, size: [.018, .01], sizeJitter: .6, stretch: .06, shape: 'streak',
    colours: ['#ffffff', '#d9c8ff', '#7a3ad8'], intensity: [7, 4, 2], middle: .3, fadeOut: .35, additive: 1, flicker: .2,
  },
  // Bip's rays (Tecnópata): crackling cyan sparks that jitter off a ray as it flies and skitter on
  // the floor (white tinted, the shrinking ray's)…
  bipzap: {
    drag: 1.6, gravity: 3, curl: 1.4, response: .6, collide: true, bounce: .5, friction: .3, size: [.02, .008], sizeJitter: .6, stretch: .06, aspect: .2, shape: 'streak',
    colours: ['#ffffff', '#9ff0ff', '#1f8fe0'], intensity: [7, 4.5, 2], middle: .25, fadeOut: .35, additive: 1, flicker: .5,
  },
  // …and Rayo solar's beam: molten drops of sun that drip off it, fall and bounce on the floor,
  sunspark: {
    drag: .5, gravity: 8, curl: .25, response: .3, collide: true, bounce: .4, friction: .3, size: [.022, .01], sizeJitter: .6, stretch: .08, shape: 'streak',
    colours: ['#ffffff', '#ffd27a', '#ff6a1f'], intensity: [8, 5, 2.2], middle: .3, fadeOut: .35, additive: 1, flicker: .2,
  },
  // and the hot glow along it.
  sunglow: {
    drag: 2, gravity: -.4, curl: .4, response: .2, size: [.06, .02], sizeJitter: .5, shape: 'glow',
    colours: ['#ffffff', '#ffe08a', '#ff8a1e'], intensity: [7, 4.5, 2], middle: .3, fadeOut: .5, additive: 1, flicker: .25, core: .8,
  },
} satisfies Record<string, GpuKind>;

export interface V3 { x: number; y: number; z: number }
/** The colours duals are drawn in (never fear's violet, never the Queen's pink). */
export const DUAL_COLOURS = { gold: '#ffd27a', cream: '#fff1cc', orange: '#ff9a2e', white: '#fff8ea', ink: '#f3cf78' } as const;
/** Fear's colours for the tower's abilities. */
export const FEAR_COLOURS = { violet: '#9a6cd8', pale: '#d9c8ff', tile: '#b5583a', wood: '#6e5238', dust: '#d8c49a', cream: '#f2e2b8', mud: '#a7b47a' } as const;
/** La Sobremesa's: dice bone and table felt, chalk, the black card and old wine, Nico's pale lattice. */
export const SOBREMESA_COLOURS = { bone: '#f1ead8', felt: '#4f7a5a', chalk: '#e8e3d3', card: '#1d1a22', wine: '#8a2f3c', ward: '#cfe3dc' } as const;
/** Anna's Sopeta: leaf and pale green, a little steam. */
const SOUP_COLOURS = { leaf: '#7fd67a', pale: '#c9f2b8', steam: '#e6f4dc' } as const;
/** Joan's scale, Do to Si: warm and in tune at the bottom, sour and green at the top. */
const NOTE_COLOURS = ['#ffe3a8', '#ffd27a', '#f7b85a', '#e8a04a', '#cfa24a', '#b2a845', '#93a83f'] as const;

/** Las cuerdas (docs/quests/marta.md): the four notes, string and glass. Never pink, never violet. */
export const CUERDAS_COLOURS = { la: '#f2b45a', do: '#49d3c2', mi: '#eef3ff', sol: '#5b8cff', string: '#cfdde6', glass: '#8fe6da', white: '#ffffff' } as const;
const CUERDAS_TONES = [CUERDAS_COLOURS.la, CUERDAS_COLOURS.do, CUERDAS_COLOURS.mi, CUERDAS_COLOURS.sol] as const;
/** El Campeón's fire: the orange of the furnace in his chest and its white-hot core. */
export const CAMPEON_COLOURS = { fire: '#ff8a2a', core: '#fff1d0' } as const;
const UP: V3 = { x: 0, y: 1, z: 0 };
const sub = (a: V3, b: V3): V3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const mix = (a: V3, b: V3, k: number): V3 => ({ x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, z: a.z + (b.z - a.z) * k });
const add = (a: V3, b: V3, k = 1): V3 => ({ x: a.x + b.x * k, y: a.y + b.y * k, z: a.z + b.z * k });
const norm = (v: V3): V3 => { const d = Math.hypot(v.x, v.y, v.z) || 1; return { x: v.x / d, y: v.y / d, z: v.z / d }; };
const cross = (a: V3, b: V3): V3 => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });
/** The screen's right and up for a camera looking back along `facing` (from the target towards it). */
export function screenAxes(facing: V3) {
  const f = norm(facing), right = norm(cross({ x: 0, y: 1, z: 0 }, f)), up = norm(cross(f, right));
  return { facing: f, right, up };
}

export function createDualFx(effects: Effects) {
  const gpu = () => effects.gpu && effects.gpu.active ? effects.gpu : undefined;
  function ensureKinds() {
    const g = effects.gpu;
    if (!g) return;
    for (const [name, kind] of Object.entries(DUAL_KINDS)) if (!g.get(name)) g.define(name, kind);
  }
  ensureKinds();
  /** Things to draw later, in fight seconds from now. */
  const later: { left: number; run: () => void }[] = [];
  const after = (seconds: number, run: () => void) => { if (seconds <= 0) run(); else later.push({ left: seconds, run }); };

  /** A straight line of dots of light from `a` to `b`, `count` of them (dotted when few). */
  function line(a: V3, b: V3, colour: string, o: { count?: number; life?: number; size?: number; kind?: string } = {}) {
    const d = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z), life = o.life ?? 1;
    gpu()?.burst(o.kind ?? 'glyph', { at: a, to: b, shape: 'line', count: o.count ?? Math.max(4, Math.round(d * 70)), life: [life * .85, life], colour, size: o.size ?? 1 });
  }
  /** A ring of dots of `radius` round `axis`. */
  function ring(centre: V3, axis: V3, radius: number, colour: string, o: { count?: number; life?: number; size?: number; around?: number; outward?: number; kind?: string; light?: number } = {}) {
    const life = o.life ?? 1;
    gpu()?.burst(o.kind ?? 'glyph', { at: centre, axis, shape: 'ring', spread: radius, count: o.count ?? Math.max(12, Math.round(radius * 90)), around: o.around ?? 0, outward: o.outward ?? 0, life: [life * .85, life], colour, size: o.size ?? 1, ...o.light ? { light: { intensity: o.light, range: radius * 2 + 1.5, colour } } : {} });
  }
  /** A binary digit facing the camera, `height` tall: a 1 is a stroke with its flag, a 0 a ring. */
  function digit(at: V3, bit: 0 | 1, height: number, colour: string, facing: V3, life = .9) {
    const { right, up, facing: f } = screenAxes(facing);
    if (bit) {
      const top = add(at, up, height / 2), foot = add(at, up, -height / 2);
      line(foot, top, colour, { count: Math.round(14 + height * 30), life, size: 1.2 + height * 2 });
      line(top, add(add(top, right, -height * .3), up, -height * .22), colour, { count: Math.round(5 + height * 12), life, size: 1.2 + height * 2 });
    } else ring(at, f, height * .36, colour, { count: Math.round(18 + height * 40), life, size: 1.2 + height * 2 });
  }
  /** A circle drawn round `centre` on the floor bit by bit over `seconds`, in `segments` strokes. */
  function drawCircle(centre: V3, radius: number, colour: string, seconds: number, o: { segments?: number; start?: number; life?: number } = {}) {
    const n = o.segments ?? 24, start = o.start ?? 0, life = o.life ?? 2;
    for (let k = 0; k < n; k++) after(seconds * k / n, () => {
      const a0 = start + k / n * Math.PI * 2, a1 = start + (k + 1) / n * Math.PI * 2;
      line({ x: centre.x + Math.cos(a0) * radius, y: centre.y, z: centre.z + Math.sin(a0) * radius }, { x: centre.x + Math.cos(a1) * radius, y: centre.y, z: centre.z + Math.sin(a1) * radius }, colour, { life: life - seconds * k / n, size: 1.6 });
    });
  }

  return {
    /** Runs what was set to happen later, on the fight's seconds. */
    update(dt: number) {
      for (let i = later.length - 1; i >= 0; i--) if ((later[i].left -= dt) <= 0) { const { run } = later[i]; later.splice(i, 1); run(); }
    },
    /** Nothing more to draw (a fight ended or the lab cleaned up). */
    clear() { later.length = 0; },
    /** Runs `run` `seconds` of fight time from now. */
    after,
    line, ring, digit,
    /** Any burst of the fight's GPU particles (nothing without the GPU engine). */
    burst(kind: string, o: GpuBurst) { gpu()?.burst(kind, o); },
    /** Whether the GPU engine is running (nothing is drawn otherwise). */
    get on() { return !!gpu(); },
    /**
     * Gerard's stroke as a dual begins: a comet of light from his hand to `to` in `seconds`, a flash
     * and a few embers where it lands, all on the GPU engine.
     */
    stroke(from: V3, to: V3, colour: string, seconds: number, o: { width?: number; arc?: number } = {}) {
      if (!gpu()) return;
      effects.trails.comet(from, to, [DUAL_COLOURS.cream, colour], seconds, {
        ...o,
        onArrive() {
          gpu()?.burst('flare', { at: to, count: 1, spread: .03, life: [.14, .22], colour, light: { intensity: 2, range: 2 } });
          gpu()?.burst('ember', { at: to, count: 8, spread: .12, speed: 1.2, up: .6, life: [.3, .7] });
        },
      });
    },

    // ── Zarpazos de fuego ──
    /**
     * Gerard draws a gold circle on the floor round the foe, `radius` metres, with eight marks
     * (`angles`, radians) and their numbers in binary beside each, 000 to 111, over `seconds`.
     */
    zarpazosCircle(centre: V3, radius: number, angles: readonly number[], facing: V3, seconds: number) {
      const c = DUAL_COLOURS, floor = { ...centre, y: centre.y + .04 };
      drawCircle(floor, radius, c.gold, seconds * .7, { start: angles[0], life: 2.4 });
      ring(floor, { x: 0, y: 1, z: 0 }, radius + .12, c.orange, { count: 70, life: 2.2, size: .6 });
      angles.forEach((a, k) => after(seconds * (.25 + .7 * k / angles.length), () => {
        const out = { x: Math.cos(a), y: 0, z: Math.sin(a) };
        line(add(floor, out, radius - .2), add(floor, out, radius + .22), c.cream, { count: 16, life: 2.1, size: 1.3 });
        // Its number beside it, three little binary digits standing up.
        const { right } = screenAxes(facing), label = add(add(floor, out, radius + .45), { x: 0, y: 1, z: 0 }, .12);
        for (let b = 0; b < 3; b++) digit(add(label, right, (b - 1) * .11), ((k >> (2 - b)) & 1) as 0 | 1, .1, c.gold, facing, 1.9);
      }));
    },
    /**
     * One of its claws lands, from mark `from` into `chest`: over it, a gold digit shows its coin. A
     * one throws a trail of fire, an ember burst and the fire rising; a zero only a gold spark.
     */
    clawCoin(from: V3, chest: V3, coin: 0 | 1, facing: V3, strength = 1) {
      const g = gpu(), c = DUAL_COLOURS;
      if (!g) return;
      const over = { x: from.x * .55 + chest.x * .45, y: chest.y + .75, z: from.z * .55 + chest.z * .45 };
      digit(over, coin, .5, coin ? c.orange : c.gold, facing, .85);
      const dx = chest.x - from.x, dz = chest.z - from.z, d = Math.hypot(dx, dz) || 1;
      g.burst('spark', { at: chest, count: 26 * strength, spread: .05, velocity: { x: dx / d * 3, y: 1.6, z: dz / d * 3 }, speed: 2, cone: 1.1, life: [.25, .6], colour: c.gold });
      if (coin) {
        effects.trails.comet(from, chest, ['#ffc46b', '#ff5a14'], .1, { width: .1, life: .22, intensity: 2.4, core: .4, arc: .25 });
        g.burst('ember', { at: chest, count: 60 * strength, spread: .12, speed: 2.2, up: .9, life: [.5, 1.2] });
        g.burst('crackle', { at: chest, count: 36 * strength, spread: .1, speed: 2.4, life: [.2, .5] });
        g.burst('flare', { at: chest, count: 2, spread: .04, life: [.16, .26], colour: '#ffb347', light: { intensity: 2.6, range: 2.6 } });
      } else g.burst('flare', { at: chest, count: 1, spread: .03, life: [.12, .2], colour: c.cream });
    },
    /** The eighth claw: a spiral of flame climbs round the foe and bursts. */
    flameSpiral(feet: V3, radius: number, height: number) {
      const g = gpu();
      effects.trails.spiral(feet, ['#ffd27a', '#ff5a14'], { radius: radius + .25, narrow: .5, height, turns: 2.4, seconds: .42, width: .16, core: .45 });
      effects.trails.spiral(feet, ['#fff1cc', '#ff9a2e'], { radius: radius + .4, narrow: .3, height: height * .9, turns: 1.8, phase: Math.PI, seconds: .5, width: .1, core: .5 });
      if (!g) return;
      const top = { x: feet.x, y: feet.y + height * .6, z: feet.z };
      g.burst('ember', { at: { ...feet, y: feet.y + .15 }, count: 220, shape: 'ring', spread: radius + .3, around: 3, up: 3, speed: .6, life: [.8, 1.6], light: { intensity: 3.4, range: 3.4 } });
      g.burst('crackle', { at: top, count: 120, spread: .3, speed: 3.2, life: [.3, .8] });
      g.burst('flare', { at: top, count: 4, spread: .2, life: [.25, .4], colour: '#ffb347' });
    },

    // ── Punto débil ──
    /**
     * Gerard's blueprint thrown onto the foe: a gold grid facing the camera in front of it, a
     * protractor arc and a crosshair on `point`, and a dotted line from `from` (Haru) to it.
     */
    blueprint(point: V3, from: V3, facing: V3, size: number, seconds = 1.2) {
      const c = DUAL_COLOURS, { right, up, facing: f } = screenAxes(facing);
      const plane = add(point, f, .25), half = size / 2, n = 5;
      for (let i = 0; i <= n; i++) after(i * .025, () => {
        const k = -half + size * i / n;
        line(add(add(plane, right, k), up, -half), add(add(plane, right, k), up, half), c.gold, { count: 26, life: seconds, size: .55 });
        line(add(add(plane, up, k), right, -half), add(add(plane, up, k), right, half), c.gold, { count: 26, life: seconds, size: .55 });
      });
      // The protractor: a baseline and an arc of 37° from the crosshair, and the crosshair itself.
      const arcR = size * .42;
      after(.12, () => {
        line(plane, add(plane, right, arcR * 1.2), c.cream, { count: 30, life: seconds - .1, size: .9 });
        const steps = 5, tilt = 37 * Math.PI / 180;
        for (let s = 0; s < steps; s++) {
          const a0 = tilt * s / steps, a1 = tilt * (s + 1) / steps;
          const p0 = add(add(plane, right, Math.cos(a0) * arcR), up, Math.sin(a0) * arcR), p1 = add(add(plane, right, Math.cos(a1) * arcR), up, Math.sin(a1) * arcR);
          line(p0, p1, c.cream, { count: 8, life: seconds - .1, size: .9 });
        }
        line(plane, add(add(plane, right, Math.cos(tilt) * arcR * 1.25), up, Math.sin(tilt) * arcR * 1.25), c.cream, { count: 26, life: seconds - .1, size: .8 });
      });
      after(.2, () => {
        ring(plane, f, size * .14, c.orange, { count: 40, life: seconds - .15, size: 1.2, light: 1.6 });
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) line(add(add(plane, right, dx * size * .09), up, dy * size * .09), add(add(plane, right, dx * size * .22), up, dy * size * .22), c.orange, { count: 10, life: seconds - .15, size: 1.2 });
        // The dotted line Haru will run along: few dots, far apart.
        const d = Math.hypot(plane.x - from.x, plane.y - from.y, plane.z - from.z);
        line(from, plane, c.cream, { count: Math.round(d * 7), life: seconds - .2, size: 1.4 });
      });
    },
    /** Haru's one stroke lands: a white flash, a gold ✕ over the point and sparks through it. */
    strike(point: V3, facing: V3, along: V3) {
      const g = gpu(), c = DUAL_COLOURS, { right, up, facing: f } = screenAxes(facing), at = add(point, f, .3), s = .42;
      line(add(add(at, right, -s), up, -s), add(add(at, right, s), up, s), c.gold, { count: 60, life: .9, size: 1.8 });
      line(add(add(at, right, -s), up, s), add(add(at, right, s), up, -s), c.gold, { count: 60, life: .9, size: 1.8 });
      if (!g) return;
      g.burst('flare', { at, count: 3, spread: .05, life: [.18, .3], colour: c.white, light: { intensity: 5, range: 4, colour: c.cream } });
      const d = Math.hypot(along.x, along.z) || 1;
      g.burst('spark', { at, count: 120, spread: .05, velocity: { x: along.x / d * 6, y: 1.2, z: along.z / d * 6 }, speed: 2.6, cone: .7, life: [.3, .8], colour: c.gold });
      g.burst('needle', { at, count: 50, spread: .05, speed: 3.4, life: [.3, .6], colour: c.cream });
    },
    /**
     * A golpe crítico lands (docs/animas/README.md § Golpe crítico): one long cut of white light across
     * whoever it struck, slanted, `size` long, a ring of it thrown out flat to the camera and sparks
     * on through along the blow. They bloom while the fight holds still (particles keep a slow pace
     * through a hit-stop). A flurry's later ones (`full` false) are only the cut, shorter.
     */
    critical(point: V3, facing: V3, along: V3, size: number, full = true) {
      const g = gpu(), c = DUAL_COLOURS, { right, up, facing: f } = screenAxes(facing), at = add(point, f, .3), s = size * (full ? .62 : .4);
      const a = add(add(at, right, -s), up, s * .42), b = add(add(at, right, s), up, -s * .42);
      line(a, b, c.white, { count: Math.round(s * 150), life: full ? .5 : .3, size: full ? 2.4 : 1.6 });
      if (!g) return;
      g.burst('flare', { at, count: full ? 3 : 1, spread: .05, life: [.16, .26], colour: c.white, light: { intensity: full ? 6 : 3, range: 4, colour: c.white } });
      if (!full) return;
      line(add(a, up, .05), add(b, up, .05), c.cream, { count: Math.round(s * 60), life: .7, size: 1.2 });
      ring(at, f, size * .16, c.white, { count: 70, outward: 6, life: .4, size: 1.3, kind: 'spark' });
      const d = Math.hypot(along.x, along.z) || 1;
      g.burst('spark', { at, count: 90, spread: .05, velocity: { x: along.x / d * 7, y: 1, z: along.z / d * 7 }, speed: 2.4, cone: .5, life: [.25, .7], colour: c.white });
      g.burst('needle', { at, count: 36, spread: .05, speed: 4, life: [.25, .5], colour: c.cream });
    },
    /** The mark of Punto débil spent by the blow that lands three times as hard: it bursts. */
    markBurst(point: V3, facing: V3) {
      const g = gpu(), c = DUAL_COLOURS, { facing: f } = screenAxes(facing);
      ring(add(point, f, .2), f, .3, c.gold, { count: 80, outward: 3.5, life: .5, size: 1.4, light: 3 });
      if (!g) return;
      g.burst('spark', { at: point, count: 160, spread: .08, speed: 4.2, life: [.35, .9], colour: c.gold });
      g.burst('flare', { at: point, count: 4, spread: .1, life: [.2, .34], colour: c.orange, light: { intensity: 4, range: 4 } });
      g.burst('twinkle', { at: point, count: 24, spread: .4, speed: 1.2, life: [.3, .6], colour: c.cream });
    },

    // ── The tower's fears ──
    /** Capa nueva: a cream layer wraps a cebollita up from its feet, and a little sparkle on top. */
    wrap(feet: V3, radius: number, height: number) {
      const g = gpu();
      if (!g) return;
      g.burst('mote', { at: { ...feet, y: feet.y + .05 }, count: 140, shape: 'ring', spread: radius, around: 2.6, velocity: { x: 0, y: height * 1.8, z: 0 }, speed: .1, life: [.45, .7], colour: FEAR_COLOURS.cream });
      after(.35, () => gpu()?.burst('twinkle', { at: { ...feet, y: feet.y + height }, count: 10, spread: radius * .5, speed: .5, life: [.3, .6], colour: FEAR_COLOURS.cream }));
    },
    /** A shockwave along the floor (Aplastón, Pisotón): dust, and chips of `colour` thrown out. */
    shock(feet: V3, radius: number, colour: string, o: { chips?: number; light?: boolean; heavy?: boolean } = {}) {
      const g = gpu();
      if (!g) return;
      const floor = { ...feet, y: feet.y + .06 };
      ring(floor, { x: 0, y: 1, z: 0 }, radius * .5, FEAR_COLOURS.dust, { count: 120, outward: 5, life: .6, size: 1.3, kind: 'mote' });
      // A heavy one (Aplastón) throws dark grit out well past a blow's own ring.
      if (o.heavy) {
        g.burst('grit', { at: { ...floor, y: floor.y + .1 }, count: 160, shape: 'ring', spread: radius * .35, outward: 7, up: .8, speed: .6, life: [.6, 1.1] });
        after(.08, () => gpu()?.burst('grit', { at: { ...floor, y: floor.y + .1 }, count: 90, shape: 'ring', spread: radius * .7, outward: 4, up: 1.4, speed: .4, life: [.7, 1.2] }));
      }
      g.burst('chip', { at: floor, count: o.chips ?? 70, shape: 'ring', spread: radius * .4, outward: 3, up: 2.4, speed: 1, life: [.7, 1.3], colour });
      if (o.light) g.burst('flare', { at: { ...feet, y: feet.y + .3 }, count: 2, spread: .2, life: [.15, .25], colour: FEAR_COLOURS.dust });
    },
    /** Carrerilla: dust kicked up as it rolls back, and violet streaks pointing at whom it will fall on. */
    runUp(from: V3, to: V3) {
      const g = gpu();
      for (let i = 0; i < 3; i++) after(i * .08, () => effects.trails.comet(from, to, [FEAR_COLOURS.pale, FEAR_COLOURS.violet], .32, { width: .06, life: .35, intensity: 1.6, core: .3, arc: .3 + i * .15 }));
      g?.burst('mote', { at: { ...from, y: from.y - .5 }, count: 60, spread: .5, speed: 1.2, up: .6, life: [.5, .9], colour: FEAR_COLOURS.dust });
    },
    /** ¡Puaj!: a grey-green splash ring out of the cloche, and droplets on everyone it reaches. */
    splash(at: V3, on: readonly V3[]) {
      const g = gpu();
      if (!g) return;
      // Thick muck (it covers instead of glowing) bursting up out of the cloche, well clear of the floor.
      const up = { ...at, y: at.y + .5 };
      g.burst('muck', { at: up, count: 120, spread: .25, speed: 3.4, up: 2.6, life: [.8, 1.3] });
      ring(up, { x: 0, y: 1, z: 0 }, .35, FEAR_COLOURS.mud, { count: 70, outward: 4.5, life: .6, size: 1.4, kind: 'muck' });
      // On everyone it reaches: blobs falling on them, and a puddle at their feet for a moment.
      for (const p of on) {
        g.burst('muck', { at: { ...p, y: p.y + 1.7 }, count: 40, spread: .35, speed: .7, life: [.7, 1.1] });
        g.burst('muckpool', { at: { ...p, y: p.y + .05 }, count: 18, shape: 'ring', spread: .4, life: [1.4, 2.2] });
      }
    },

    // ── La Sobremesa ──
    /**
     * Tirada: the dice leave Álvaro's hand in an arc (`count` of them: two, four in the duo), bounce
     * at the feet of whom they land on and throw up chips of bone white.
     */
    dice(from: V3, to: V3, feet: V3, count: number) {
      for (let i = 0; i < count; i++) after(i * .06, () => {
        effects.trails.comet(from, to, [SOBREMESA_COLOURS.bone, SOBREMESA_COLOURS.felt], .34, { width: .05, life: .3, intensity: 1.4, core: .35, arc: .45 + i * .12 });
      });
      after(.34, () => {
        const g = gpu();
        if (!g) return;
        g.burst('chip', { at: { ...feet, y: feet.y + .1 }, count: 26 * count, spread: .3, up: 3.2, speed: 1.4, life: [.6, 1.1], colour: SOBREMESA_COLOURS.bone });
        ring({ ...feet, y: feet.y + .05 }, { x: 0, y: 1, z: 0 }, .45, SOBREMESA_COLOURS.felt, { count: 90, outward: 3.5, life: .5, size: 1.3, kind: 'mote' });
        g.burst('flare', { at: { ...feet, y: feet.y + .4 }, count: 1, spread: .05, life: [.12, .2], colour: SOBREMESA_COLOURS.bone, light: { intensity: 2, range: 2.5, colour: SOBREMESA_COLOURS.bone } });
      });
    },
    /**
     * Sopeta: a swirl of green steam rising off Anna as she stirs, a ladleful flung in an arc at whom
     * she hits (a green splash on them), then green drops raining softly on every friend she feeds,
     * each with a ring of light and motes rising off them.
     */
    soup(from: V3, chest: V3, feet: V3, fed: readonly V3[]) {
      const g = gpu();
      for (let i = 0; i < 3; i++) after(i * .1, () => ring({ ...from, y: from.y - .2 + i * .15 }, { x: 0, y: 1, z: 0 }, .35 - i * .06, SOUP_COLOURS[i % 2 ? 'pale' : 'leaf'], { count: 120, around: 4, outward: .5, life: .8, size: 1.7, kind: 'mote', light: i ? 0 : 1.8 }));
      g?.burst('rise', { at: from, count: 110, spread: .4, speed: .35, up: 1.6, life: [.8, 1.4], colour: SOUP_COLOURS.steam });
      after(.42, () => {
        effects.trails.comet(from, chest, [SOUP_COLOURS.pale, SOUP_COLOURS.leaf], .3, { width: .09, life: .35, intensity: 1.6, core: .35, arc: .6 });
        after(.3, () => {
          gpu()?.burst('goo', { at: chest, count: 90, spread: .25, speed: 2.4, up: 1.2, life: [.4, .8], colour: SOUP_COLOURS.leaf });
          ring({ ...feet, y: feet.y + .05 }, { x: 0, y: 1, z: 0 }, .45, SOUP_COLOURS.leaf, { count: 70, outward: 2.6, life: .5, size: 1.3, kind: 'mote' });
        });
      });
      fed.forEach((p, i) => after(.75 + i * .07, () => {
        const top = { ...p, y: p.y + .9 };
        gpu()?.burst('heal', { at: top, count: 70, spread: .45, speed: .25, life: [.8, 1.3], colour: SOUP_COLOURS.leaf });
        gpu()?.burst('rise', { at: p, count: 60, spread: .35, speed: .25, up: 1.3, life: [.8, 1.3], colour: SOUP_COLOURS.pale });
        ring(p, { x: 0, y: 1, z: 0 }, .42, SOUP_COLOURS.leaf, { count: 90, around: 2.5, outward: .8, life: .8, size: 1.7, light: 1.4 });
      }));
    },
    /**
     * Regla nueva: a line of chalk written on the table's skin under whom it raises, then their
     * strength going up as specks off them. `all`: the duo's rule, everyone at once.
     */
    rule(under: readonly V3[], facing: V3) {
      const { right } = screenAxes(facing);
      under.forEach((p, i) => after(i * .08, () => {
        const a = add({ ...p, y: p.y - .15 }, right, -.45), b = add({ ...p, y: p.y - .15 }, right, .45);
        line(a, b, SOBREMESA_COLOURS.chalk, { count: 60, life: .9, size: 1.5 });
        line(add(a, { x: 0, y: -.12, z: 0 }), add(b, { x: 0, y: -.12, z: 0 }, .6), SOBREMESA_COLOURS.chalk, { count: 40, life: .9, size: 1.2 });
        gpu()?.burst('rise', { at: p, count: 30, spread: .3, speed: .3, up: 1.6, life: [.6, 1], colour: SOBREMESA_COLOURS.chalk });
      }));
    },
    /** La carta negra turned and left facing whom it will fall on: a black card of dots hanging over them, with a dark ring at their feet. */
    cardMark(over: V3, feet: V3, facing: V3) {
      const { right, up } = screenAxes(facing);
      const c = add(over, up, .55), w = .22, h = .32;
      const corners = [add(add(c, right, -w), up, -h), add(add(c, right, w), up, -h), add(add(c, right, w), up, h), add(add(c, right, -w), up, h)];
      corners.forEach((a, i) => line(a, corners[(i + 1) % 4], SOBREMESA_COLOURS.card, { count: 34, life: 1.4, size: 1.6, kind: 'veil' }));
      ring({ ...feet, y: feet.y + .05 }, { x: 0, y: 1, z: 0 }, .55, SOBREMESA_COLOURS.card, { count: 70, around: .6, life: 1.4, size: 1.4, kind: 'veil' });
    },
    /** La carta negra falls: a dark streak from above onto them, a burst of black and a flash at the chest. The duo's leaves them at 1 PV: `heavy`. */
    cardFall(chest: V3, feet: V3, heavy: boolean) {
      const top = { ...chest, y: chest.y + 3.2 };
      effects.trails.comet(top, chest, [SOBREMESA_COLOURS.card, SOBREMESA_COLOURS.wine], .18, { width: heavy ? .12 : .08, life: .3, intensity: 1.8, core: .25 });
      after(.18, () => {
        const g = gpu();
        if (!g) return;
        g.burst('veil', { at: chest, count: heavy ? 120 : 60, spread: .35, speed: 2.4, life: [.5, .9], colour: SOBREMESA_COLOURS.card });
        ring({ ...feet, y: feet.y + .05 }, { x: 0, y: 1, z: 0 }, heavy ? .8 : .5, SOBREMESA_COLOURS.wine, { count: heavy ? 140 : 80, outward: heavy ? 5 : 3, life: .6, size: 1.4, kind: 'mote' });
        g.burst('flare', { at: chest, count: 1, spread: .05, life: [.15, .25], colour: SOBREMESA_COLOURS.wine, light: { intensity: heavy ? 4 : 2.5, range: 3, colour: SOBREMESA_COLOURS.wine } });
      });
    },
    /**
     * Escala: Joan's note leaves his mouth as rings, one per step of the scale he is on (`note`, 0–6),
     * warmer to sourer the higher it goes, and reaches everyone in the party as a ring round them.
     */
    note(mouth: V3, on: readonly V3[], note: number, facing: V3) {
      const { facing: f } = screenAxes(facing), colour = NOTE_COLOURS[Math.min(NOTE_COLOURS.length - 1, note)];
      for (let i = 0; i <= Math.min(3, 1 + Math.floor(note / 2)); i++) after(i * .09, () => ring(add(mouth, f, .2), f, .2 + i * .05, colour, { count: 70, outward: 3.5 + note * .4, life: .5, size: 1.3, light: i ? 0 : 1.5 }));
      for (const p of on) {
        after(.12, () => line(mouth, p, colour, { count: 40 + note * 8, life: .35, size: 1.1 }));
        after(.3, () => ring(p, { x: 0, y: 1, z: 0 }, .45, colour, { count: 60, outward: .8, around: 2, life: .5, size: 1.3 }));
      }
    },
    /** Corrección: Soraya snaps at Joan, a sharp streak from her to him and a tight ring round his mouth. */
    correct(from: V3, to: V3, facing: V3) {
      const { facing: f } = screenAxes(facing);
      line(from, to, SOBREMESA_COLOURS.chalk, { count: 50, life: .35, size: 1.4 });
      after(.15, () => ring(add(to, f, .2), f, .32, NOTE_COLOURS[4], { count: 80, outward: -1.2, life: .45, size: 1.4, light: 1.2 }));
    },
    /** Cortafuegos: Nico raises a pale lattice in front of the friend he shields, facing the party. */
    firewall(on: V3, facing: V3, colour: string = SOBREMESA_COLOURS.ward) {
      const { right, up } = screenAxes(facing), front = add(on, norm(facing), .35);
      for (let k = -2; k <= 2; k++) {
        after((k + 2) * .04, () => {
          line(add(add(front, right, k * .14), up, -.45), add(add(front, right, k * .14), up, .45), colour, { count: 30, life: 1.1, size: 1.2 });
          line(add(add(front, right, -.32), up, k * .18), add(add(front, right, .32), up, k * .18), colour, { count: 26, life: 1.1, size: 1.2 });
        });
      }
      gpu()?.burst('flare', { at: front, count: 1, spread: .05, life: [.2, .3], colour: colour, light: { intensity: 2, range: 2.5, colour: colour } });
    },

    // ── Las cuerdas (docs/quests/marta.md § The qualities, § Final boss) ──
    /** Juramento: her shield's strings sound one after another, and the blow goes straight at whoever touched her. */
    oath(shield: V3, to: V3, facing: V3) {
      const { right, up } = screenAxes(facing), c = CUERDAS_COLOURS, dir = norm(sub(to, shield));
      for (let k = -2; k <= 2; k++) after((k + 2) * .035, () => line(add(add(shield, right, k * .17), up, -.85), add(add(shield, right, k * .17), up, .85), k ? c.string : c.la, { count: 46, life: .5, size: 1.3 }));
      after(.16, () => line(shield, to, c.la, { count: 80, life: .35, size: 1.5 }));
      after(.22, () => ring(to, dir, .4, c.la, { count: 80, outward: 2.4, life: .45, size: 1.4, light: 1.6 }));
    },
    /** Lazo: an amber cord from her knot to her Eco, and rings closing on it: whole again, or back from nothing. */
    tie(knot: V3, eco: V3, back: boolean) {
      const c = CUERDAS_COLOURS;
      line(knot, eco, c.la, { count: 100, life: .9, size: 1.5 });
      ring(knot, UP, .3, c.la, { count: 60, around: 3, life: .6, size: 1.3, light: 1.4 });
      for (let i = 0; i < (back ? 4 : 2); i++) after(.12 + i * .1, () => ring(eco, UP, .95 - i * .14, i % 2 ? c.mi : c.la, { count: 90, outward: -2.4, around: 2.5, life: .5, size: 1.3, light: i ? 0 : 1.8 }));
      if (back) after(.32, () => gpu()?.burst('flare', { at: eco, count: 2, spread: .08, life: [.25, .4], colour: c.mi, light: { intensity: 3, range: 4, colour: c.la } }));
    },
    /** Resonancia: the same blow again, a ring wider for each turn it has had, rolling off the Eco onto whom it repeats it. */
    resonance(from: V3, to: V3, rings: number) {
      const dir = norm(sub(to, from)), c = CUERDAS_COLOURS;
      for (let i = 0; i < rings; i++) after(i * .07, () => ring(add(from, dir, .2), dir, .3 + i * .17, c.mi, { count: 70 + i * 20, outward: 4.5, life: .45, size: 1.2 + i * .15, light: i ? 0 : 1.2 }));
      after(.18 + rings * .05, () => ring(to, dir, .32 + rings * .09, c.mi, { count: 80, outward: 1.6, life: .45, size: 1.4 }));
    },
    /** Destello: the light it holds, sent back in one thin beam. */
    glint(from: V3, to: V3) {
      const c = CUERDAS_COLOURS;
      line(from, to, c.glass, { count: 120, life: .3, size: 1.3 }); line(from, to, c.white, { count: 60, life: .22, size: .8 });
      gpu()?.burst('flare', { at: from, count: 1, spread: .04, life: [.15, .25], colour: '#eafffb', light: { intensity: 3, range: 4, colour: c.do } });
      after(.06, () => gpu()?.burst('gale', { at: to, count: 50, spread: .15, speed: 4, life: [.25, .45], colour: c.glass }));
    },
    /** Estallido: it cracks from top to bottom, and what comes off it flies at everyone. */
    shatter(at: V3, on: readonly V3[], facing: V3) {
      const { facing: f, right, up } = screenAxes(facing), c = CUERDAS_COLOURS;
      ring(at, f, .3, c.white, { count: 130, outward: 8, life: .4, size: 1.5, light: 3.5 });
      ring(at, UP, .4, c.glass, { count: 150, outward: 6, life: .6, size: 1.4 });
      gpu()?.burst('gale', { at, count: 260, spread: .4, speed: 9, life: [.35, .8], colour: c.glass });
      // The crack itself: a jagged white line down its front, that stays a moment.
      for (let k = 0; k < 6; k++) line(add(add(at, right, (k % 2 ? .2 : -.2) * (1 - k * .08)), up, .95 - k * .34), add(add(at, right, (k % 2 ? -.18 : .2) * (1 - k * .08)), up, .95 - (k + 1) * .34), c.white, { count: 24, life: 1, size: 1.3 });
      for (const p of on) after(.1, () => { line(at, p, c.glass, { count: 36, life: .3, size: 1.1 }); gpu()?.burst('gale', { at: p, count: 30, spread: .12, speed: 3, life: [.2, .4], colour: '#eafffb' }); });
    },
    /** Prisma: cracked, its light comes out split into the four notes' colours, a fan onto everyone. */
    prism(from: V3, on: readonly V3[], facing: V3) {
      const { up } = screenAxes(facing);
      gpu()?.burst('flare', { at: from, count: 1, spread: .05, life: [.2, .3], colour: CUERDAS_COLOURS.white, light: { intensity: 3.5, range: 5, colour: CUERDAS_COLOURS.do } });
      for (const p of on) CUERDAS_TONES.forEach((colour, k) => after(k * .05, () => {
        const end = add(p, up, (k - 1.5) * .22);
        line(add(from, up, (k - 1.5) * .07), end, colour, { count: 64, life: .4, size: 1.2 });
        ring(end, norm(sub(end, from)), .16, colour, { count: 30, outward: 1.4, life: .35, size: 1.2 });
      }));
    },
    /** Golpe directo: the shortest way between two points, drawn once. */
    straight(from: V3, to: V3, colour: string = CUERDAS_COLOURS.sol) {
      const dir = norm(sub(to, from));
      line(from, to, CUERDAS_COLOURS.white, { count: 90, life: .22, size: 1.3 });
      line(add(from, dir, -.5), add(to, dir, .5), colour, { count: 120, life: .4, size: 1.5 });
      ring(to, dir, .28, colour, { count: 60, outward: 3, life: .35, size: 1.3, light: 1.5 });
    },
    /** El Campeón's Rayo: a thick beam of furnace fire from his gauntlet to whom he aimed at, a burst where it lands. */
    gauntlet(from: V3, to: V3) {
      const c = CAMPEON_COLOURS, dir = norm(sub(to, from));
      gpu()?.burst('flare', { at: from, count: 1, spread: .05, life: [.15, .25], colour: c.core, light: { intensity: 3, range: 4, colour: c.fire } });
      line(from, to, c.core, { count: 110, life: .25, size: 1.6 });
      line(add(from, dir, -.3), add(to, dir, .3), c.fire, { count: 160, life: .45, size: 2 });
      ring(to, dir, .34, c.fire, { count: 80, outward: 3.2, life: .4, size: 1.5, light: 2 });
    },
    /** His Rayo total: the grate in his chest opens and fire sweeps over everyone, one beam each. */
    furnace(from: V3, on: readonly V3[]) {
      const c = CAMPEON_COLOURS;
      gpu()?.burst('flare', { at: from, count: 1, spread: .08, life: [.3, .45], colour: c.core, light: { intensity: 5, range: 7, colour: c.fire } });
      ring(from, UP, .5, c.fire, { count: 120, outward: 4, life: .5, size: 1.6 });
      on.forEach((p, i) => after(.06 + i * .08, () => {
        const dir = norm(sub(p, from));
        line(from, p, c.core, { count: 90, life: .3, size: 1.7 });
        line(from, add(p, dir, .4), c.fire, { count: 150, life: .55, size: 2.2 });
        ring(p, dir, .4, c.fire, { count: 90, outward: 3.4, life: .45, size: 1.5, light: i ? 0 : 2.4 });
      }));
    },
    /** En línea recta: one stroke from beyond one end of the party to beyond the other, through everyone on it. */
    through(from: V3, on: readonly V3[]) {
      if (!on.length) return;
      const c = CUERDAS_COLOURS, a = on[0], b = on[on.length - 1], dir = on.length > 1 ? norm(sub(b, a)) : norm(cross(UP, sub(a, from)));
      const start = add(a, dir, -2.4), end = add(b, dir, 2.4);
      for (let k = 0; k < 12; k++) after(k * .014, () => line(mix(start, end, k / 12), mix(start, end, (k + 1) / 12), k % 2 ? c.white : c.sol, { count: 30, life: .5, size: 1.6 }));
      on.forEach((p, i) => after(.04 + i * .07, () => ring(p, dir, .3, c.sol, { count: 60, outward: 2.6, life: .4, size: 1.3, light: i ? 0 : 1.8 })));
    },
    /** Estocada: everything it has, in one thick stroke that goes on past whom it hits and into the floor. */
    lunge(from: V3, to: V3, feet: V3) {
      const dir = norm(sub(to, from)), c = CUERDAS_COLOURS;
      for (const k of [-.06, 0, .06]) line(add(from, UP, k), add(add(to, dir, .9), UP, k), k ? c.sol : c.white, { count: 150, life: .5, size: 1.7 });
      ring(to, dir, .35, c.white, { count: 110, outward: 6, life: .4, size: 1.6, light: 3 });
      after(.05, () => ring({ ...feet, y: feet.y + .06 }, UP, .5, c.sol, { count: 120, outward: 4.5, life: .6, size: 1.4 }));
      gpu()?.burst('gale', { at: to, count: 140, spread: .25, speed: 7, life: [.3, .6], colour: c.sol });
    },
    /** Coro: a ring of her own leaves her throat and closes where her second voice comes together. */
    choir(mouth: V3, at: V3, facing: V3) {
      const { facing: f } = screenAxes(facing), c = CUERDAS_COLOURS;
      ring(add(mouth, f, .2), f, .35, c.mi, { count: 90, outward: 2, life: .5, size: 1.3, light: 1.5 });
      after(.1, () => line(mouth, at, c.mi, { count: 80, life: .55, size: 1.2 }));
      for (let i = 0; i < 3; i++) after(.25 + i * .12, () => ring(at, UP, 1 - i * .25, i === 1 ? c.do : c.mi, { count: 90, outward: -2.2, around: 3, life: .55, size: 1.3 }));
    },
    /** «Toma aire»: the four notes' light drawn into her throat, ring after ring closing on it. */
    inhale(mouth: V3, facing: V3) {
      const { facing: f } = screenAxes(facing);
      CUERDAS_TONES.forEach((colour, k) => after(k * .11, () => ring(add(mouth, f, .2), f, 2.2 - k * .3, colour, { count: 130, outward: -3.4, around: 2 + k, life: .6, size: 1.4, light: k ? 0 : 2 })));
      gpu()?.burst('mote', { at: add(mouth, f, .3), count: 280, spread: 2.6, outward: -4, speed: .2, life: [.5, .7], colour: CUERDAS_COLOURS.string });
    },
    /** Calderón: the note she held, let go. Four great rings, one of each colour, over everyone. */
    fermata(mouth: V3, on: readonly V3[], facing: V3) {
      const { facing: f } = screenAxes(facing);
      CUERDAS_TONES.forEach((colour, k) => after(k * .09, () => ring(add(mouth, f, .3), f, .5 + k * .15, colour, { count: 200, outward: 9 - k, life: .8, size: 1.9, light: k ? 0 : 4 })));
      gpu()?.burst('gale', { at: mouth, count: 260, spread: .5, speed: 11, life: [.4, .9], colour: CUERDAS_COLOURS.mi });
      for (const p of on) after(.25, () => CUERDAS_TONES.forEach((colour, k) => ring(p, UP, .3 + k * .14, colour, { count: 50, outward: 1.5, around: 2, life: .5, size: 1.2 })));
    },
    /** Her Calderón broken (an Acorde on her while she held it): the ring closes on nothing, cracks, and falls in pieces. */
    fermataBreak(mouth: V3, facing: V3) {
      const { facing: f, right, up } = screenAxes(facing), c = CUERDAS_COLOURS;
      ring(add(mouth, f, .2), f, 1.3, c.white, { count: 130, outward: -5, life: .3, size: 1.4, light: 2.5 });
      after(.2, () => {
        CUERDAS_TONES.forEach((colour, k) => {
          const a = add(add(mouth, right, (k - 1.5) * .34), up, .25 - (k % 2) * .2);
          line(a, add(add(a, right, (k % 2 ? .16 : -.16)), up, -.9), colour, { count: 30, life: .8, size: 1.3, kind: 'mote' });
        });
        gpu()?.burst('gale', { at: mouth, count: 120, spread: .3, speed: 4, life: [.3, .7], colour: c.string });
      });
    },
    /**
     * One of La Voz's notes as she starts it (VOZ_NOTES): a beam of its colour from her throat to
     * each one it reaches, brighter with each Crescendo, carrying what the note carries. Water ends in
     * a splash, fire drips sparks, a bolt (Fa) goes in a jagged line like lightning, Re lands heavy.
     * On whoever holds on it breaks on a small white ring instead of going in.
     */
    voiceBeam(mouth: V3, on: readonly { at: V3; guarded: boolean }[], colour: string, kind: 'plain' | 'agua' | 'fuego' | 'electrico' | 'fisico', facing: V3, level = 0) {
      const { facing: f } = screenAxes(facing), c = CUERDAS_COLOURS, bright = 1 + Math.min(6, level) * .08;
      ring(add(mouth, f, .15), f, .2, colour, { count: 50 + level * 10, outward: 2.4, life: .4, size: 1.1 * bright, light: 1 });
      for (const { at, guarded } of on) {
        const dir = norm(sub(at, mouth)), side = norm(cross(UP, dir)), heavy = kind === 'fisico';
        if (kind === 'electrico') {
          // Lightning: a jagged line, each bend a little off the straight way, white with the note's silver round it.
          const bends = 7, points: V3[] = [mouth];
          for (let k = 1; k < bends; k++) points.push(add(add(mix(mouth, at, k / bends), side, (Math.random() - .5) * .5), UP, (Math.random() - .5) * .35));
          points.push(at);
          for (let k = 0; k < bends; k++) { line(points[k], points[k + 1], c.white, { count: 26, life: .28, size: 1.5 * bright }); line(points[k], points[k + 1], colour, { count: 18, life: .4, size: 1.1 }); }
          gpu()?.burst('flare', { at, count: 1, spread: .05, life: [.12, .2], colour: '#fff6c8', light: { intensity: 3, range: 3, colour: '#ffe45c' } });
        } else {
          line(mouth, at, c.white, { count: heavy ? 110 : 70, life: .22, size: (heavy ? 1.6 : 1.1) * bright });
          line(mouth, at, colour, { count: heavy ? 140 : 90, life: .38, size: (heavy ? 1.9 : 1.3) * bright });
          if (heavy) for (const k of [-.05, .05]) line(add(mouth, UP, k), add(at, UP, k), colour, { count: 70, life: .3, size: 1.3 });
        }
        if (guarded) { ring(at, dir, .32, c.white, { count: 70, outward: 1.2, life: .35, size: 1.3, light: 1.2 }); continue; }
        ring(at, dir, heavy ? .38 : .26, colour, { count: heavy ? 90 : 60, outward: heavy ? 4 : 2.6, life: .35, size: 1.3 * bright, light: heavy ? 2 : 1.2 });
        if (kind === 'agua') gpu()?.burst('gale', { at, count: 70, spread: .2, speed: 3.5, life: [.3, .55], colour: '#6cc8f2' });
        if (kind === 'fuego') gpu()?.burst('sunspark', { at, count: 40, spread: .15, speed: 2.2, life: [.4, .8], colour: '#ff8f3f' });
        if (heavy) gpu()?.burst('gale', { at, count: 90, spread: .2, speed: 6, life: [.25, .5], colour });
      }
    },
    /** Acorde: two blows inside one note. Two rings cross on her, the note's colour and white. */
    chord(at: V3, colour: string, facing: V3) {
      const { facing: f, right, up } = screenAxes(facing);
      ring(at, norm(add(f, right, .5)), .45, colour, { count: 110, outward: 4, life: .5, size: 1.5, light: 2.5 });
      after(.04, () => ring(at, norm(add(f, right, -.5)), .45, CUERDAS_COLOURS.white, { count: 110, outward: 4, life: .5, size: 1.5 }));
      for (const k of [-1, 1]) line(add(add(at, right, -.5), up, k * .12), add(add(at, right, .5), up, k * .12), colour, { count: 40, life: .5, size: 1.2 });
    },

    // ── Vertitrón ──
    /** Pisotón: its foot slams down (`foot`), and the blow runs along the roof to whoever it stomps (`to`). */
    stomp(foot: V3, to: V3) {
      const g = gpu();
      this.shock(foot, 2.2, FEAR_COLOURS.tile, { chips: 90, heavy: true });
      if (!g) return;
      line({ ...foot, y: foot.y + .08 }, { ...to, y: to.y + .08 }, FEAR_COLOURS.dust, { count: 80, life: .5, size: 1.6, kind: 'mote' });
      g.burst('chip', { at: { ...foot, y: foot.y + .05 }, to: { ...to, y: to.y + .05 }, shape: 'line', count: 70, up: 2.6, speed: .8, life: [.6, 1.1], colour: FEAR_COLOURS.tile });
      after(.08, () => this.shock(to, 1.6, FEAR_COLOURS.tile, { chips: 60, light: true }));
    },
    /** Barrido: dust kicked up along the roof under the hand as it sweeps across everyone. */
    sweep(on: readonly V3[], way: V3) {
      const g = gpu();
      if (!g) return;
      const w = norm(way);
      for (const p of on) {
        g.burst('mote', { at: { ...p, y: p.y + .3 }, count: 70, spread: .6, velocity: { x: w.x * 3.5, y: .8, z: w.z * 3.5 }, speed: 1.2, cone: .7, life: [.5, 1], colour: FEAR_COLOURS.dust });
        g.burst('chip', { at: { ...p, y: p.y + .15 }, count: 30, spread: .4, velocity: { x: w.x * 4, y: 2, z: w.z * 4 }, speed: 1.4, cone: .8, life: [.6, 1.1], colour: FEAR_COLOURS.tile });
      }
    },
    /**
     * Grito liberador: rings of violet light thrown out from its chest facing the camera, one after
     * another, a ring of dust along the roof and streaks flying out every way.
     */
    roar(chest: V3, feet: V3, facing: V3) {
      const g = gpu(), { facing: f } = screenAxes(facing);
      for (let i = 0; i < 3; i++) after(i * .12, () => ring(add(chest, f, .6), f, .5, i % 2 ? FEAR_COLOURS.pale : FEAR_COLOURS.violet, { count: 160, outward: 7 - i, life: .7, size: 1.8, light: i ? 0 : 3 }));
      ring({ ...feet, y: feet.y + .08 }, { x: 0, y: 1, z: 0 }, 1.2, FEAR_COLOURS.dust, { count: 140, outward: 6, life: .7, size: 1.4, kind: 'mote' });
      if (!g) return;
      g.burst('gale', { at: chest, count: 220, spread: .5, speed: 10, life: [.4, .8], colour: FEAR_COLOURS.pale });
      g.burst('flare', { at: add(chest, f, .4), count: 2, spread: .1, life: [.2, .35], colour: FEAR_COLOURS.violet, light: { intensity: 4, range: 6, colour: FEAR_COLOURS.violet } });
    },
    /** Its eye starts charging: light is drawn into it from all round, and a ring closes on it. */
    charge(eye: V3, facing: V3) {
      const g = gpu(), { facing: f } = screenAxes(facing);
      ring(add(eye, f, .2), f, 1.8, FEAR_COLOURS.violet, { count: 120, outward: -2.6, around: 3, life: .6, size: 1.4, light: 2.5 });
      if (!g) return;
      g.burst('mote', { at: add(eye, f, .3), count: 260, spread: 2.4, outward: -4.2, speed: .2, life: [.45, .6], colour: FEAR_COLOURS.pale });
      after(.25, () => gpu()?.burst('flare', { at: add(eye, f, .2), count: 2, spread: .05, life: [.25, .4], colour: '#e8d8ff', light: { intensity: 4, range: 5, colour: FEAR_COLOURS.violet } }));
    },
    /** A charged eye glows hotter: a pulse of its light now and then. */
    chargedPulse(eye: V3, facing: V3) {
      const { facing: f } = screenAxes(facing);
      gpu()?.burst('flare', { at: add(eye, f, .25), count: 1, spread: .04, life: [.2, .3], colour: FEAR_COLOURS.violet, light: { intensity: 2.6, range: 4.5, colour: FEAR_COLOURS.violet } });
    },
    /** Rayo terrorífico leaves the eye: a white flash and a burst of violet. */
    beamStart(eye: V3, facing: V3) {
      const g = gpu(), { facing: f } = screenAxes(facing);
      ring(add(eye, f, .4), f, .7, '#f4ecff', { count: 120, outward: 5, life: .45, size: 2, light: 5 });
      if (!g) return;
      g.burst('flare', { at: add(eye, f, .3), count: 4, spread: .1, life: [.3, .5], colour: '#ffffff', light: { intensity: 7, range: 8, colour: '#c9a2ff' } });
      g.burst('beam', { at: add(eye, f, .3), count: 90, spread: .2, speed: 4, life: [.3, .6], colour: FEAR_COLOURS.pale });
    },
    /** One frame of the beam: light along it from the eye to where it burns the roof, sparks there. */
    beamTick(eye: V3, floor: V3, k = 1) {
      const g = gpu();
      if (!g) return;
      g.burst('beam', { at: eye, to: floor, shape: 'line', count: Math.round(50 * k), spread: .06, speed: .5, life: [.12, .25], colour: '#e8d8ff' });
      g.burst('scorch', { at: { ...floor, y: floor.y + .05 }, count: Math.round(26 * k), spread: .12, speed: 3.6, up: 2.4, life: [.3, .7], colour: FEAR_COLOURS.pale });
      g.burst('fizzle', { at: { ...floor, y: floor.y + .1 }, count: Math.round(4 * k), spread: .2, speed: .3, life: [.6, 1.1] });
    },
    /** The beam burns across someone: a big flash of violet on them. */
    beamHit(at: V3) {
      const g = gpu();
      if (!g) return;
      g.burst('flare', { at, count: 3, spread: .1, life: [.25, .4], colour: '#e8d8ff', light: { intensity: 5, range: 4, colour: '#c9a2ff' } });
      g.burst('scorch', { at, count: 120, spread: .25, speed: 4.5, up: 1.5, life: [.4, .9], colour: FEAR_COLOURS.pale });
    },
    /** Its eye breaks: shards of its lens, sparks, a flash, and smoke. */
    eyeBreak(at: V3, facing: V3) {
      const g = gpu(), { facing: f } = screenAxes(facing), out = add(at, f, .25);
      ring(out, f, .55, FEAR_COLOURS.pale, { count: 90, outward: 4, life: .5, size: 1.6, light: 3 });
      if (!g) return;
      g.burst('shard', { at: out, count: 110, spread: .35, velocity: { x: f.x * 3, y: 1.5, z: f.z * 3 }, speed: 3, cone: 1.2, life: [.8, 1.4], colour: '#c9a2ff' });
      g.burst('scorch', { at: out, count: 140, spread: .3, velocity: { x: f.x * 2, y: 1, z: f.z * 2 }, speed: 4, cone: 1.4, life: [.4, .9], colour: FEAR_COLOURS.violet });
      g.burst('flare', { at: out, count: 3, spread: .05, life: [.2, .35], colour: '#ffffff', light: { intensity: 6, range: 5, colour: '#c9a2ff' } });
      after(.15, () => gpu()?.burst('fizzle', { at: out, count: 70, spread: .4, speed: .5, life: [1, 1.8] }));
    },
    /** It drops to its knees: dust out along the roof from where they land. */
    kneel(knees: readonly V3[]) {
      for (const k of knees) this.shock(k, 1.4, FEAR_COLOURS.dust, { chips: 40 });
    },
    /** Uri stands up to it: a glow of cream light round him that rises. */
    standUp(at: V3) {
      const g = gpu();
      if (!g) return;
      g.burst('mote', { at, count: 120, spread: .4, speed: .6, up: 1.2, life: [.8, 1.4], colour: FEAR_COLOURS.cream, light: { intensity: 2.6, range: 3, colour: FEAR_COLOURS.cream } });
      g.burst('twinkle', { at, count: 20, spread: .5, speed: .8, life: [.3, .7], colour: '#ffffff' });
    },
  };
}
export type DualFx = ReturnType<typeof createDualFx>;
