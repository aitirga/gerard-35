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
