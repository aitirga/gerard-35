/**
 * Serie de Fourier's mathematics (docs/animas/matemagico/README.md § Serie de Fourier): the foe's own
 * outline, as the camera sees it, taken apart into circles that turn (a discrete Fourier transform) and
 * put back together by as many of them as the blow has strikes. Worked out once, as it is cast; the
 * figure that draws it (src/math-figures.ts) only moves what this gives it. Pure: no scene.
 */
import type { PlateMark } from './battle.ts';

export interface P2 { x: number; y: number }
/** One circle of the chain: how fast it turns (turns a period, `k`), how big it is and where it starts (radians). */
export interface Epicycle { k: number; radius: number; phase: number }

/** How many points the outline is taken at, and so how many circles the transform has. */
export const OUTLINE_POINTS = 64;

/** The middle of a cloud of points. */
export const middle = (points: readonly P2[]): P2 => points.length ? points.reduce((s, p) => ({ x: s.x + p.x / points.length, y: s.y + p.y / points.length }), { x: 0, y: 0 }) : { x: 0, y: 0 };
/**
 * The outline of a cloud of points (a body's surface laid flat on the screen): round their middle, in
 * `bins` equal angles, the furthest point in each, in order round it. An angle nothing fell in takes
 * the mean of its neighbours. Centred on their middle, so the transform's mean term is about nought.
 */
export function outline(points: readonly P2[], bins = OUTLINE_POINTS): P2[] {
  if (!points.length) return Array.from({ length: bins }, (_, i) => ({ x: Math.cos(i / bins * Math.PI * 2) * .5, y: Math.sin(i / bins * Math.PI * 2) * .5 }));
  const mid = middle(points), far = new Float64Array(bins).fill(-1);
  for (const p of points) {
    const dx = p.x - mid.x, dy = p.y - mid.y, r = Math.hypot(dx, dy);
    const bin = Math.min(bins - 1, Math.floor(((Math.atan2(dy, dx) + Math.PI * 2) % (Math.PI * 2)) / (Math.PI * 2) * bins));
    if (r > far[bin]) far[bin] = r;
  }
  // Empty angles: the nearest filled on each side, weighed by how near.
  const filled = [...far.keys()].filter(i => far[i] >= 0);
  const radius = Array.from(far, (r, i) => {
    if (r >= 0) return r;
    let before = i, after = i, a = 0, b = 0;
    while (far[before] < 0 && a < bins) { before = (before - 1 + bins) % bins; a++; }
    while (far[after] < 0 && b < bins) { after = (after + 1) % bins; b++; }
    return filled.length ? (far[before] * b + far[after] * a) / (a + b || 1) : .5;
  });
  // A light smoothing round it (1-2-1), so one stray point does not make a spike.
  const smooth = radius.map((r, i) => (radius[(i - 1 + bins) % bins] + 2 * r + radius[(i + 1) % bins]) / 4);
  return smooth.map((r, i) => { const a = (i + .5) / bins * Math.PI * 2; return { x: Math.cos(a) * r, y: Math.sin(a) * r }; });
}

/** The discrete Fourier transform of a closed curve (x + iy at each point): one circle a frequency, −n/2 … n/2 − 1. */
export function dft(curve: readonly P2[]): Epicycle[] {
  const n = curve.length, out: Epicycle[] = [];
  for (let k = -Math.floor(n / 2); k < Math.ceil(n / 2); k++) {
    let re = 0, im = 0;
    for (let j = 0; j < n; j++) {
      const a = -2 * Math.PI * k * j / n, c = Math.cos(a), s = Math.sin(a);
      re += curve[j].x * c - curve[j].y * s; im += curve[j].x * s + curve[j].y * c;
    }
    out.push({ k, radius: Math.hypot(re, im) / n, phase: Math.atan2(im, re) });
  }
  return out;
}

/** Where the chain starts: the transform's mean term (k = 0), the curve's own middle. */
export const meanOf = (circles: readonly Epicycle[]): P2 => { const c = circles.find(e => e.k === 0); return c ? { x: Math.cos(c.phase) * c.radius, y: Math.sin(c.phase) * c.radius } : { x: 0, y: 0 }; };
/** The `count` biggest circles that turn (the mean, k = 0, is where the chain starts), biggest first: the dial and the ones off its rim. */
export const epicycles = (circles: readonly Epicycle[], count: number) =>
  circles.filter(c => c.k !== 0).sort((a, b) => b.radius - a.radius).slice(0, Math.max(1, count));

/** Where each circle of the chain is centred at `t` (0–1 is once round), and its tip last: `chain.length + 1` points. */
export function chainAt(chain: readonly Epicycle[], t: number, origin: P2 = { x: 0, y: 0 }): P2[] {
  const out: P2[] = [origin];
  let x = origin.x, y = origin.y;
  for (const c of chain) {
    const a = c.phase + 2 * Math.PI * c.k * t;
    x += Math.cos(a) * c.radius; y += Math.sin(a) * c.radius;
    out.push({ x, y });
  }
  return out;
}
/** The curve the chain's tip draws once round, in `count` strokes (closed). */
export const traced = (chain: readonly Epicycle[], count = 160) => Array.from({ length: count + 1 }, (_, i) => { const p = chainAt(chain, i / count); return p[p.length - 1]; });

/** Whether a closed curve goes round its middle once, always the same way: no loop over itself (each step turns its angle round the middle one way). */
export function aroundOnce(curve: readonly P2[]) {
  const mid = middle(curve.slice(0, -1));
  let sign = 0, total = 0;
  for (let i = 1; i < curve.length; i++) {
    const a = Math.atan2(curve[i - 1].y - mid.y, curve[i - 1].x - mid.x), b = Math.atan2(curve[i].y - mid.y, curve[i].x - mid.x);
    const d = Math.atan2(Math.sin(b - a), Math.cos(b - a));
    if (Math.abs(d) < 1e-9) continue;
    if (sign && Math.sign(d) !== sign) return false;
    sign = Math.sign(d); total += d;
  }
  return Math.abs(Math.abs(total) - Math.PI * 2) < .1;
}
/**
 * The colour of each thing Fourier counts, for the circle that counted it: fire orange, water blue, ice and
 * crystal cyan-white, blood red, poison green, the charge's yellow, a mark's gold. Never pink or violet
 * (those are the Queen's and fear's): whatever has no colour of its own here is his gold.
 */
export const GOLD = '#f3cf78';
const HARMONIC_COLOURS: Partial<Record<PlateMark | 'marca', string>> = {
  quemado: '#ff8a2e', combustion: '#ff5a1a', mecha: '#ff8a2e', volcan: '#ff6a1a', bomba: '#ff7a2a',
  mojado: '#5cc2f4', agua: '#5cc2f4', hundido: '#2f8fd8', corriente: '#ffe24a', marea: '#5cc2f4', seiche: '#5cc2f4',
  congelado: '#bfe8ff', cristalizado: '#d8fbff', fulgurita: '#d8fbff',
  sangrado: '#e5361c', metralla: '#e5361c',
  envenenado: '#6fdc4a', sanacion: '#3fcf58',
  shock: '#ffe24a', cargado: '#ffe24a',
  empolvado: '#e8c98a', cegado: '#c9c4ba',
};
export const harmonicColour = (mark?: PlateMark | 'marca') => (mark && HARMONIC_COLOURS[mark]) || GOLD;
