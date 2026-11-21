import type { BattleEffect, Element } from '../battle';
import { screenAxes, type V3 } from '../dual-fx';
import type { GpuKind } from '../fight-particles';
import type { DuoFighter, DuoStage, DuoStaging } from './types';

/**
 * Cadáver exquisito (Puñado + Estrella fugaz): the surrealists' game, a figure drawn in three folded
 * parts by three hands, none seeing the others'. Three falling stars come down on one foe, a breath
 * apart, each from its own side of the sky and each with a handful of Colorista's powder thrown to
 * meet it; each lands as a band of powder round the foe, feet, then body, then head, in the tint of
 * the element it carried (fire, water, electricity; the astral's white if it carried none), and a
 * fold of ivory paper is drawn across the foe between one part and the next. When the numbers come
 * each band goes off in turn with its own element, bottom to top, and the figure is done.
 */
const T = { lands: [.5, .8, 1.1], rise: .2, fall: .3, contact: 1.2, strike: .12, end: 2.3 };
type Hand = Element | 'astral';
/** Each element's light, the matte pigment it tints the powder, its flash and its sound. */
const HAND: Record<Hand, { glow: string; pigment: string; flash: readonly [number, number, number]; sound: 'fire-hit' | 'splash' | 'zap' | 'clink' }> = {
  // Fire's band is char, not orange: soot with a glowing seam, so it reads on a foe already burning.
  fuego: { glow: '#ffd08a', pigment: '#3b2a23', flash: [1, .78, .45], sound: 'fire-hit' },
  agua: { glow: '#6cc8f2', pigment: '#6f9fae', flash: [.45, .8, 1], sound: 'splash' },
  electrico: { glow: '#ffe45c', pigment: '#cdb276', flash: [1, .92, .4], sound: 'zap' },
  astral: { glow: '#bfe0ff', pigment: '#aaa59c', flash: [.75, .88, 1], sound: 'clink' },
};
/** Dadista's paper and ink. */
const PAPER = '#efe6cf';

const KINDS: Record<string, GpuKind> = {
  // Colorista's handful in flight, and the matte band it leaves round the foe.
  'cadaver-exquisito-throw': {
    shape: 'powder', drag: .25, gravity: 2.5, curl: .2, response: .2, size: [.055, .09], sizeJitter: .5,
    colours: ['#ffffff', '#f2f2f2', '#e0e0e0'], intensity: [1.15, 1.05, 1], fadeIn: .03, fadeOut: .12, additive: 0, opacity: .9, core: 0,
  },
  'cadaver-exquisito-band': {
    shape: 'powder', drag: 7.5, gravity: .05, curl: .55, response: .6, size: [.07, .2], sizeJitter: .55,
    colours: ['#ffffff', '#f2f2f2', '#d8d8d8'], intensity: [1.15, 1.05, .95], middle: .3, fadeIn: .03, fadeOut: .4, additive: 0, opacity: .86, core: 0,
  },
  'cadaver-exquisito-grain': {
    shape: 'powder', drag: 2.4, gravity: 2, curl: 1, response: .8, collide: true, bounce: 0, friction: 1, size: [.013, .009], sizeJitter: .6,
    colours: ['#ffffff', '#f2f2f2', '#d8d8d8'], intensity: [1.2, 1.1, 1], fadeIn: .02, fadeOut: .3, additive: 0, opacity: 1, core: 0,
  },
  // The fold: dots of ivory drawn across the foe, as a crease in paper.
  'cadaver-exquisito-fold': {
    shape: 'dot', drag: 14, gravity: 0, curl: 0, response: 0, size: [.018, .014], sizeJitter: .2,
    colours: ['#ffffff', '#ffffff', '#ffffff'], intensity: [2.6, 2, 1.3], middle: .4, fadeIn: .04, fadeOut: .3, additive: .7, flicker: .05, core: .4,
  },
  // Each element's own, small and quick: tongues of fire, drops of water, crackling sparks.
  'cadaver-exquisito-flame': {
    shape: 'flame', blur: [0, .5], drag: 3.5, gravity: -2.6, curl: 1.4, response: 1, size: [.05, .14], sizeJitter: .6,
    colours: ['#fff6d8', '#ff9a2e', '#7a1c08'], intensity: [6, 3.2, 1], middle: .3, fadeIn: 0, fadeOut: .6, additive: .85, flicker: .25,
  },
  'cadaver-exquisito-drop': {
    shape: 'dot', drag: .8, gravity: 8, curl: .1, response: .2, collide: true, bounce: .1, friction: .9, size: [.02, .016], sizeJitter: .5,
    colours: ['#ffffff', '#bfe6ff', '#4fa8d8'], intensity: [2.4, 1.6, 1.1], middle: .3, fadeIn: 0, fadeOut: .3, additive: .35, glass: .6, core: .4,
  },
  'cadaver-exquisito-spark': {
    shape: 'spark', drag: 1.4, gravity: 2, curl: 2.4, response: .6, collide: true, bounce: .5, friction: .3, size: [.012, .005], sizeJitter: .6, stretch: .06, aspect: .25,
    colours: ['#ffffff', '#fff3a0', '#ffc830'], intensity: [8, 5, 2], middle: .25, fadeOut: .35, additive: 1, flicker: .55,
  },
  // A falling star's head: a four-point star, and the glow where it lands.
  'cadaver-exquisito-star': {
    shape: 'star', drag: 1.2, gravity: 2, curl: .3, response: .3, spin: 220, size: [.06, .02], sizeJitter: .5,
    colours: ['#ffffff', '#ffffff', '#ffffff'], intensity: [5.5, 3.6, 1.6], middle: .3, fadeIn: .02, fadeOut: .45, additive: 1, flicker: .45, core: .6,
  },
  'cadaver-exquisito-glow': {
    shape: 'glow', blur: [.4, 1.1], drag: 0, gravity: 0, size: [.25, .7], colours: ['#ffffff', '#ffffff', '#ffffff'],
    intensity: [6, 3, 1], middle: .25, fadeIn: 0, fadeOut: .8, additive: 1, core: .5,
  },
  // Cut paper pasted on the foe, a part's colour: matte scraps born inside its body, put out on its surface, where they cling.
  'cadaver-exquisito-scrap': {
    shape: 'shard', drag: 3, gravity: 3, curl: 0, response: 0, collide: true, bounce: 0, friction: 1, stick: 1, stickTime: 3, size: [.04, .045], sizeJitter: .5, stretch: 0,
    colours: ['#ffffff', '#f4f4f4', '#e4e4e4'], intensity: [1.25, 1.15, 1.05], middle: .2, fadeIn: .05, fadeOut: .2, additive: 0, opacity: 1, core: 0,
  },
  // A part's hoop: dots of its element's light ringing it at its height while the figure is drawn.
  'cadaver-exquisito-hoop': {
    shape: 'dot', drag: 14, gravity: 0, curl: 0, response: 0, size: [.02, .016], sizeJitter: .3,
    colours: ['#ffffff', '#ffffff', '#ffffff'], intensity: [4, 3, 1.6], middle: .3, fadeIn: .04, fadeOut: .35, additive: 1, flicker: .3, core: .6,
  },
};
/** A shared kind to fall back on if one of ours could not be defined (the engine's kinds are full). */
const FALLBACK: Record<string, string> = { 'cadaver-exquisito-throw': 'pigmentthrow', 'cadaver-exquisito-band': 'pigment', 'cadaver-exquisito-grain': 'grain', 'cadaver-exquisito-fold': 'glyph', 'cadaver-exquisito-flame': 'flamelet', 'cadaver-exquisito-drop': 'spray', 'cadaver-exquisito-spark': 'crackle', 'cadaver-exquisito-star': 'starfall', 'cadaver-exquisito-glow': 'bloom', 'cadaver-exquisito-scrap': 'shardling', 'cadaver-exquisito-hoop': 'glyph' };
function ensure(stage: DuoStage) {
  const g = stage.effects.gpu;
  if (!g) return;
  for (const [name, kind] of Object.entries(KINDS)) if (!g.get(name)) try { g.define(name, kind); } catch { /* falls back (`kindOf`) */ }
}
/** Our kind if the engine has it, else its shared stand-in. */
const kindOf = (stage: DuoStage, name: string) => stage.effects.gpu?.get(name) ? name : FALLBACK[name] ?? name;
/** A burst of one of our kinds (or its stand-in). */
const burst = (stage: DuoStage, name: string, o: Parameters<DuoStage['fx']['burst']>[1]) => stage.fx.burst(kindOf(stage, name), o);

const add = (a: V3, b: V3, k = 1): V3 => ({ x: a.x + b.x * k, y: a.y + b.y * k, z: a.z + b.z * k });
const dist = (a: V3, b: V3) => Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
const UP: V3 = { x: 0, y: 1, z: 0 };

/** The elements its handfuls carried, one per blow that landed (none if the blow did nothing: the astral's). */
function handsOf(e: BattleEffect): Hand[] {
  const blows = e.strikes?.length ?? (e.amount ? 1 : 3);
  return Array.from({ length: Math.min(3, Math.max(1, blows)) }, (_, k) => e.drawn?.[k] ?? 'astral');
}
/** Band `k` of a foe (0 its feet, 1 its body, 2 its head): its bottom and top heights, and where on its front it lands. */
function band(f: DuoFighter, view: V3, k: number) {
  const { facing } = screenAxes(view), low = f.height * k / 3, high = f.height * (k + 1) / 3;
  return { low, high, mid: add(add(f.feet, UP, (low + high) / 2), facing, f.radius * .5) };
}

/** A star comes down on band `k` with its handful: the powder rings the foe there, in its element's tint, and the element shows. */
function strike(stage: DuoStage, f: DuoFighter, k: number, hand: Hand) {
  const h = HAND[hand], { low, high, mid } = band(f, stage.view, k), r = Math.max(.3, f.radius);
  // The powder: three rings stacked through the band, thrown out a little and stopped by the air.
  for (let i = 0; i < 3; i++) {
    const y = low + (high - low) * (i + .5) / 3;
    burst(stage, 'cadaver-exquisito-band', { at: add(f.feet, UP, y), shape: 'ring', spread: r * .95, outward: 1.3, speed: .25, count: 42, life: [1.1, 1.5] as const, colour: h.pigment });
  }
  burst(stage, 'cadaver-exquisito-grain', { at: mid, count: 70, spread: r * .6, speed: 1.2, up: .3, life: [.8, 1.4], colour: h.pigment });
  // The part pasted on: scraps of its colour on the foe through the band, and its hoop of light round it until the blows.
  const scraps = [T.end - T.lands[k] + .3, T.end - T.lands[k] + .6] as const;
  if (f.index >= 0) for (let i = 0; i < 2; i++) burst(stage, 'cadaver-exquisito-scrap', { at: f.feet, shape: 'surface', fighter: f.index, band: [k / 3, (k + 1) / 3], outward: -.2, speed: .03, count: 24, life: scraps, colour: i ? h.pigment : mixHex(h.pigment, h.glow, .35) });
  else for (let i = 0; i < 3; i++) burst(stage, 'cadaver-exquisito-scrap', { at: add(f.feet, UP, low + (high - low) * (i + .5) / 3), spread: r * .6, count: 16, life: scraps, colour: i % 2 ? h.pigment : mixHex(h.pigment, h.glow, .35) });
  stage.fx.ring(add(f.feet, UP, (low + high) / 2), UP, r * 1.12, h.glow, { kind: kindOf(stage, 'cadaver-exquisito-hoop'), count: Math.round(r * 120), around: .6, life: T.contact - T.lands[k] + .1, size: 1.2 });
  burst(stage, 'cadaver-exquisito-glow', { at: mid, count: 1, spread: .01, life: [.16, .22], colour: h.glow, size: .7, light: { intensity: 2.4, range: 2.6, colour: h.glow } });
  element(stage, f, k, hand, 1);
  stage.hit(f.id, h.flash, .7);
  stage.shake(.1 + k * .05);
  stage.cue(h.sound);
}
/** Its element on band `k`, `k`… times as much: fire licks up, water runs off, electricity crackles round; the astral, stars. */
function element(stage: DuoStage, f: DuoFighter, k: number, hand: Hand, much: number) {
  const { low, high, mid } = band(f, stage.view, k), r = Math.max(.3, f.radius), ring = add(f.feet, UP, (low + high) / 2), n = (c: number) => Math.round(c * much);
  if (hand === 'fuego') {
    burst(stage, 'cadaver-exquisito-flame', { at: ring, shape: 'ring', spread: r * .9, outward: .6, up: 1.2, speed: .4, count: n(34), life: [.3, .6], colour: '#ffe9c0' });
    stage.fx.burst('ember', { at: mid, count: n(24), spread: r * .5, speed: 1.6, up: 1.4, life: [.4, .9] });
    // A seam of white-gold heat running round the char, jagged, like a crack in a burnt page.
    const start = Math.random() * Math.PI * 2, pts: V3[] = [];
    for (let i = 0; i <= 12; i++) {
      const t = start + i / 12 * Math.PI * 2, rr = r * (1.02 + (Math.random() - .5) * .12);
      pts.push(add(f.feet, { x: Math.cos(t) * rr, y: low + (high - low) * (.42 + (Math.random() - .5) * .3), z: Math.sin(t) * rr }));
    }
    for (let i = 1; i < pts.length; i++) burst(stage, 'cadaver-exquisito-fold', { at: pts[i - 1], to: pts[i], shape: 'line', count: Math.max(3, Math.round(dist(pts[i - 1], pts[i]) * 55)), life: [.35, .5], colour: '#ffe2a0', size: 1.4 });
  } else if (hand === 'agua') {
    burst(stage, 'cadaver-exquisito-drop', { at: ring, shape: 'ring', spread: r * .95, outward: 1.8, up: .9, speed: .5, count: n(60), life: [.5, 1], colour: h2(hand) });
    burst(stage, 'cadaver-exquisito-drop', { at: mid, count: n(24), spread: r * .4, speed: .4, life: [.6, 1.1], colour: h2(hand) });
  } else if (hand === 'electrico') {
    burst(stage, 'cadaver-exquisito-spark', { at: ring, shape: 'ring', spread: r * .95, outward: 1.6, speed: 1.2, count: n(55), life: [.2, .45] });
    // Two arcs round the band, jagged.
    for (let a = 0; a < 2; a++) {
      const start = Math.random() * Math.PI * 2, pts: V3[] = [];
      for (let i = 0; i <= 7; i++) {
        const t = start + i / 7 * Math.PI * 1.1, rr = r * (1 + (Math.random() - .5) * .3);
        pts.push(add(f.feet, { x: Math.cos(t) * rr, y: low + (high - low) * (.3 + Math.random() * .4), z: Math.sin(t) * rr }));
      }
      for (let i = 1; i < pts.length; i++) burst(stage, 'cadaver-exquisito-fold', { at: pts[i - 1], to: pts[i], shape: 'line', count: Math.max(3, Math.round(dist(pts[i - 1], pts[i]) * 60)), life: [.14, .2], colour: HAND.electrico.glow, size: 1.3 });
    }
  } else {
    burst(stage, 'cadaver-exquisito-star', { at: ring, shape: 'ring', spread: r * .9, outward: 1, up: .6, speed: .4, count: n(26), life: [.4, .8], colour: HAND.astral.glow });
  }
}
const h2 = (hand: Hand) => HAND[hand].glow;
/** `a` taken `k` of the way to `b` (sRGB hex). */
function mixHex(a: string, b: string, k: number) {
  const c = (h: string, i: number) => parseInt(h.slice(1 + i * 2, 3 + i * 2), 16);
  return '#' + [0, 1, 2].map(i => Math.round(c(a, i) + (c(b, i) - c(a, i)) * k).toString(16).padStart(2, '0')).join('');
}
/** The fold between part `k` and the next: a crease of ivory drawn across the foe's front, left to right, with the two lines that cross it. */
function fold(stage: DuoStage, f: DuoFighter, k: number, life: number) {
  const { right, facing } = screenAxes(stage.view), { high } = band(f, stage.view, k), w = Math.max(.45, f.radius * 1.35);
  const centre = add(add(f.feet, UP, high), facing, Math.max(.3, f.radius) * 1.05), steps = 8;
  for (let i = 0; i < steps; i++) stage.fx.after(i * .015, () => {
    const a = add(centre, right, -w + 2 * w * i / steps), b = add(centre, right, -w + 2 * w * (i + 1) / steps);
    burst(stage, 'cadaver-exquisito-fold', { at: a, to: b, shape: 'line', count: 9, life: [life * .9, life], colour: PAPER, size: 1.2 });
  });
  // What the next hand gets to see: the ends of two lines crossing the fold.
  for (const s of [-.35, .3]) stage.fx.after(.13, () => {
    const at = add(centre, right, w * s);
    burst(stage, 'cadaver-exquisito-fold', { at: add(at, UP, -.09), to: add(add(at, UP, .07), right, s * .08), shape: 'line', count: 6, life: [life * .8, life * .9], colour: PAPER, size: .9 });
  });
}

export const staging: DuoStaging = {
  timing: { contact: T.contact, end: T.end },
  start(stage, e, reached) {
    if (!stage.fx.on) return;
    ensure(stage);
    const f = reached.find(x => !x.party) ?? reached[0];
    if (!f) return;
    const hands = handsOf(e), { right, facing } = screenAxes(stage.view);
    const dice = stage.wearer('dadaista'), painter = stage.wearer('prismatico');
    const sky = dice?.hand ?? dice?.chest ?? add(f.chest, right, -2);
    // Three hands: one from the right of the sky, one from the left, one from straight above.
    const sides = [1.3, -1.3, .15];
    hands.forEach((hand, k) => {
      const h = HAND[hand], land = T.lands[k], { mid } = band(f, stage.view, k);
      const top = add(add(add(f.feet, UP, f.height + 2.2 + k * .25), right, sides[k]), facing, .4);
      // The star goes up from Dadista's wearer, hangs a breath at the top and comes down on its band.
      stage.effects.trails.comet(sky, top, ['#f4f9ff', h.glow], T.rise, { arc: .4, width: .035, life: .25, intensity: 2.6, core: .6, additive: 1, delay: land - T.fall - T.rise });
      stage.fx.after(land - T.fall, () => {
        burst(stage, 'cadaver-exquisito-star', { at: top, count: 6, spread: .05, speed: .3, life: [.2, .35], colour: h.glow });
        stage.effects.trails.comet(top, mid, ['#ffffff', h.glow], T.fall, { arc: .05, width: .07, life: .32, intensity: 3.6, core: .7, additive: 1 });
        burst(stage, 'cadaver-exquisito-star', { at: top, to: mid, shape: 'line', count: 26, speed: .4, life: [.3, .6], colour: h.glow });
      });
      // Colorista's handful, thrown to meet it.
      const from = painter?.hand ?? painter?.chest;
      if (from) {
        const fly = .26, g = 2.5, v = { x: (mid.x - from.x) / fly, y: (mid.y - from.y) / fly + g * fly / 2, z: (mid.z - from.z) / fly };
        stage.fx.after(land - fly, () => burst(stage, 'cadaver-exquisito-throw', { at: from, count: 50, spread: .06, velocity: v, speed: .3, life: [fly * .95, fly * 1.02], colour: h.pigment }));
      }
      stage.fx.after(land, () => strike(stage, f, k, hand));
      // The fold above it, for the next hand (none above the head).
      if (k < 2 && k < hands.length - 1) stage.fx.after(land + .08, () => fold(stage, f, k, T.end - land + .1));
      stage.cue('rise', { delay: land - T.fall - T.rise });
    });
  },
  land(stage, e, reached) {
    ensure(stage);
    const f = reached.find(x => !x.party) ?? reached[0];
    if (!f) return;
    const hands = handsOf(e);
    // Each part goes off with its blow, feet to head, its element bigger now.
    hands.forEach((hand, k) => stage.fx.after(k * T.strike, () => {
      const h = HAND[hand], { low, high, mid } = band(f, stage.view, k);
      element(stage, f, k, hand, 1.6);
      stage.fx.ring(add(f.feet, UP, (low + high) / 2), UP, Math.max(.35, f.radius) * 1.1, h.glow, { count: 60, outward: 2.4, life: .35, size: 1.4, light: 1.8 });
      burst(stage, 'cadaver-exquisito-band', { at: mid, count: 40, spread: f.radius * .5, speed: 2.4, life: [.6, 1], colour: h.pigment });
      stage.hit(f.id, h.flash, 1.1 + k * .15);
      stage.shake(.22 + k * .07);
      stage.cue(h.sound);
    }));
    // The figure is whole: the folds flash once, and a thin line runs down through all its parts, joining them.
    stage.fx.after(hands.length * T.strike, () => {
      const { right, facing } = screenAxes(stage.view), front = add(f.feet, facing, Math.max(.3, f.radius) * 1.1);
      for (let k = 0; k < hands.length - 1; k++) {
        const y = band(f, stage.view, k).high, w = Math.max(.45, f.radius * 1.35), c = add(front, UP, y);
        burst(stage, 'cadaver-exquisito-fold', { at: add(c, right, -w), to: add(c, right, w), shape: 'line', count: 60, life: [.25, .35], colour: '#ffffff', size: 1.6 });
      }
      burst(stage, 'cadaver-exquisito-fold', { at: add(front, UP, f.height * 1.05), to: add(front, UP, .05), shape: 'line', count: Math.round(f.height * 50), life: [.4, .55], colour: PAPER, size: 1.1 });
      stage.pulse(.4, .8, .1); stage.punch(.4);
      stage.cue('thump');
    });
  },
};
