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
/** How many cells the longer side of a silhouette's grid has (`silhouette`). */
export const SILHOUETTE_GRID = 48;
/**
 * The silhouette of a cloud of points (a body's surface laid flat on the screen), as its true outline, hollows and
 * all: the points are put in a grid of `grid` cells on its longer side, each cell's neighbours filled once (so the
 * gaps between points close), everything the outside cannot reach filled in, and the boundary of its biggest piece
 * followed cell edge by cell edge, the body on its left (anticlockwise). Then it is softened and taken at `count`
 * points evenly along its length, in the points' own frame (its middle is the transform's mean term, `meanOf`). A leg,
 * a tail, an ear and the gaps between them stay in it. Worked out once, as it is cast.
 */
export function silhouette(points: readonly P2[], count = OUTLINE_POINTS, grid = SILHOUETTE_GRID): P2[] {
  const round = () => Array.from({ length: count }, (_, i) => ({ x: Math.cos(i / count * Math.PI * 2) * .5, y: Math.sin(i / count * Math.PI * 2) * .5 }));
  if (points.length < 3) return round();
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of points) { x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y); }
  const cell = Math.max(x1 - x0, y1 - y0, 1e-6) / (grid - 4);
  // Two empty cells round it, so the outside is all one.
  const w = Math.ceil((x1 - x0) / cell) + 5, h = Math.ceil((y1 - y0) / cell) + 5, at = (i: number, j: number) => j * w + i;
  const hit = new Uint8Array(w * h);
  for (const p of points) hit[at(Math.floor((p.x - x0) / cell) + 2, Math.floor((p.y - y0) / cell) + 2)] = 1;
  const solid = new Uint8Array(w * h);
  for (let j = 1; j < h - 1; j++) for (let i = 1; i < w - 1; i++) {
    if (hit[at(i, j)] || hit[at(i - 1, j)] || hit[at(i + 1, j)] || hit[at(i, j - 1)] || hit[at(i, j + 1)]) solid[at(i, j)] = 1;
  }
  // The outside, flooded from a corner: whatever it does not reach is the body (its holes filled).
  const outside = new Uint8Array(w * h), queue = [0];
  outside[0] = 1;
  while (queue.length) {
    const c = queue.pop()!, i = c % w, j = (c - i) / w;
    for (const [a, b] of [[i - 1, j], [i + 1, j], [i, j - 1], [i, j + 1]]) {
      if (a < 0 || b < 0 || a >= w || b >= h) continue;
      const n = at(a, b);
      if (!outside[n] && !solid[n]) { outside[n] = 1; queue.push(n); }
    }
  }
  // Its biggest piece (a stray point makes a piece of its own).
  const piece = new Int32Array(w * h).fill(-1), sizes: number[] = [];
  for (let c = 0; c < w * h; c++) {
    if (outside[c] || piece[c] >= 0) continue;
    const id = sizes.length, stack = [c];
    let size = 0;
    piece[c] = id;
    while (stack.length) {
      const d = stack.pop()!, i = d % w, j = (d - i) / w;
      size++;
      for (const [a, b] of [[i - 1, j], [i + 1, j], [i, j - 1], [i, j + 1]]) {
        const n = at(a, b);
        if (!outside[n] && piece[n] < 0) { piece[n] = id; stack.push(n); }
      }
    }
    sizes.push(size);
  }
  if (!sizes.length) return round();
  const biggest = sizes.indexOf(Math.max(...sizes)), inside = (i: number, j: number) => i >= 0 && j >= 0 && i < w && j < h && piece[at(i, j)] === biggest;
  // Its boundary: each edge between a cell of it and one outside, the body on its left, from corner to corner.
  const next = new Map<number, number[]>(), key = (i: number, j: number) => j * (w + 1) + i;
  const edge = (a: [number, number], b: [number, number]) => { const k = key(...a); (next.get(k) ?? next.set(k, []).get(k)!).push(key(...b)); };
  let first = -1;
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    if (!inside(i, j)) continue;
    if (!inside(i, j - 1)) { edge([i, j], [i + 1, j]); if (first < 0) first = key(i, j); }
    if (!inside(i + 1, j)) edge([i + 1, j], [i + 1, j + 1]);
    if (!inside(i, j + 1)) edge([i + 1, j + 1], [i, j + 1]);
    if (!inside(i - 1, j)) edge([i, j + 1], [i, j]);
  }
  // Followed round; where two edges leave one corner (two cells touching by a corner), the sharper left turn.
  const corner = (k: number): P2 => { const i = k % (w + 1); return { x: i, y: (k - i) / (w + 1) }; };
  const loop: P2[] = [];
  let here = first, came: P2 = { x: 1, y: 0 };
  for (let guard = 0; guard < 4 * w * h; guard++) {
    loop.push(corner(here));
    const outs = next.get(here);
    if (!outs?.length) break;
    const from = corner(here);
    let best = 0, bestTurn = -Infinity;
    outs.forEach((to, n) => {
      const p = corner(to), d = { x: p.x - from.x, y: p.y - from.y }, turn = Math.atan2(came.x * d.y - came.y * d.x, came.x * d.x + came.y * d.y);
      if (turn > bestTurn) { bestTurn = turn; best = n; }
    });
    const to = outs.splice(best, 1)[0], p = corner(to);
    came = { x: p.x - from.x, y: p.y - from.y };
    here = to;
    if (here === first) break;
  }
  if (loop.length < 4) return round();
  // Back to the points' own units, softened (its stair-steps are the grid's, not the body's).
  let curve = loop.map(p => ({ x: x0 + (p.x - 2) * cell, y: y0 + (p.y - 2) * cell }));
  for (let pass = 0; pass < 3; pass++) curve = curve.map((p, i) => { const a = curve[(i - 1 + curve.length) % curve.length], b = curve[(i + 1) % curve.length]; return { x: (a.x + 2 * p.x + b.x) / 4, y: (a.y + 2 * p.y + b.y) / 4 }; });
  return alongLength(curve, count);
}
/** `count` points evenly along a closed curve's length, from its first point. */
export function alongLength(curve: readonly P2[], count: number): P2[] {
  const n = curve.length, along = [0];
  for (let i = 1; i <= n; i++) along.push(along[i - 1] + Math.hypot(curve[i % n].x - curve[i - 1].x, curve[i % n].y - curve[i - 1].y));
  const total = along[n] || 1, out: P2[] = [];
  let i = 1;
  for (let k = 0; k < count; k++) {
    const s = k / count * total;
    while (i < n && along[i] < s) i++;
    const a = curve[i - 1], b = curve[i % n], f = (s - along[i - 1]) / ((along[i] - along[i - 1]) || 1);
    out.push({ x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f });
  }
  return out;
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
/**
 * The first `count` circles that turn, slowest first (the mean, k = 0, is where the chain starts): |k| = 1, 2, 3…, at
 * each speed the bigger of its two ways round first. A series cut short this way is the shape seen from far off, its
 * broad lines first, and never rings; the biggest circles alone would be a bean for any body. The first is the dial.
 */
export const epicycles = (circles: readonly Epicycle[], count: number) =>
  circles.filter(c => c.k !== 0).sort((a, b) => Math.abs(a.k) - Math.abs(b.k) || b.radius - a.radius).slice(0, Math.max(1, count));

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

/**
 * The colour of each thing Fourier counts, for the circle that counted it: fire orange, water blue, ice and
 * crystal cyan-white, blood red, poison green, the charge's yellow, a mark's gold. Never pink or violet
 * (those are the Queen's and fear's): whatever has no colour of its own here is his gold.
 */
export const GOLD = '#f3cf78';
const HARMONIC_COLOURS: Partial<Record<PlateMark | 'marca', string>> = {
  quemado: '#ff8a2e', combustion: '#ff5a1a', mecha: '#ff8a2e', volcan: '#ff6a1a', bomba: '#ff7a2a',
  mojado: '#5cc2f4', agua: '#5cc2f4', pelicula: '#5cc2f4', hundido: '#2f8fd8', corriente: '#ffe24a', marea: '#5cc2f4', seiche: '#5cc2f4',
  congelado: '#bfe8ff', cristalizado: '#d8fbff', fulgurita: '#d8fbff',
  sangrado: '#f04a12', metralla: '#f04a12',
  envenenado: '#6fdc4a', sanacion: '#3fcf58',
  shock: '#ffe24a', cargado: '#ffe24a',
  empolvado: '#e8c98a', cegado: '#c9c4ba', gas: '#9fe0ee',
};
export const harmonicColour = (mark?: PlateMark | 'marca') => (mark && HARMONIC_COLOURS[mark]) || GOLD;
