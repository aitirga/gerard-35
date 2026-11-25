import * as pc from 'playcanvas';
import type { BattleEffect } from '../battle';
import { screenAxes, type V3 } from '../dual-fx';
import { galtonPath, galtonTimes, type GpuKind, type GpuLaw, type GpuVolume } from '../fight-particles';
import { ensureFluidKinds } from '../fluid-fx';
import { neonCircle, neonCurve, type NeonFigure, type NeonStroke } from '../math-figures';
import type { DuoFighter, DuoStage, DuoStaging } from './types';

/**
 * Campana de Gauss (Matemágico's Pirámide ígnea + Dadista's Dados astrales). Gerard's circle draws
 * Pirámide's triangle in gold, standing in the camera's plane over the foes (the fight's camera turns so
 * their row runs across the picture), and fills it with eight rows of pegs, a tick of the pen each; under
 * it hang glass bins, each straight over its foe: the one picked and the ones beside it. Dadista's dice of
 * cold light fall into its top and melt into balls of fire, and each falls through the pegs on the path
 * the rule chose for it (the GPU `galton` law: one bit a row, the peg it meets flashing) into the bin over
 * the foe it lands on; small gold ghost balls on paths of their own fall too and settle in the bins as a
 * sediment, so the bell builds even with few dice. The bins fill with liquid fire, fullest over the foe
 * picked, and the pen draws a bell over them from where the dice fell. Before contact the bins' floors
 * open and the fire pours onto each foe as a sheet; then the pegs go out from the bottom up. Gold for his
 * figure, cold white for her dice, pale glass for the bins, fire for what they become. If a light eats the
 * fire, the balls still fall but the bins only smoke: nothing pours.
 */
const C = { gold: '#f3cf78', core: '#f8c45a', bell: '#ffe9b4', fire: '#ff8a2e' } as const;
const LOOK = { core: C.core, halo: C.gold };
const GLASS = { core: '#eef1ee', halo: '#9aa8ae' };
/** Rows of pegs; when the bins open; when the numbers land; when it is over. */
const ROWS = 8, OPEN = 1.35, CONTACT = 1.8, END = 2.7;
/** When the first die of light melts at the top of the board, and over how long the rest follow. */
const MELT = .35, MELT_SPAN = .2;
/** How long a ball takes from the top to the bins (the law's fall is worked out to it). */
const THROUGH = .45;
/** The liquid fire the fullest bin holds, in particles: each bin's share of it by its dice. */
const FILL = 1500;
/** The ghost balls that fall with the dice and settle as the bell's sediment. */
const GHOSTS = 150;
const add = (a: V3, b: V3, k = 1): V3 => ({ x: a.x + b.x * k, y: a.y + b.y * k, z: a.z + b.z * k });
const sub = (a: V3, b: V3): V3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const dot = (a: V3, b: V3) => a.x * b.x + a.y * b.y + a.z * b.z;
const xy = (x: number, y: number): V3 => ({ x, y, z: 0 });
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

const KINDS = {
  // A die of Dadista's cold light falling into the top of the board: a small spinning facet, and its glow.
  'campana-dado': {
    shape: 'shard', drag: 0, gravity: 0, curl: 0, response: 0, size: [.1, .085], sizeJitter: .1, stretch: 0, spin: 520,
    colours: ['#ffffff', '#e4f2ff', '#a9cdff'], intensity: [3.4, 2.8, 2.2], middle: .5, fadeIn: .03, fadeOut: .05, additive: .8, core: .7,
  },
  'campana-dado-luz': {
    shape: 'glow', drag: 0, gravity: 0, curl: 0, response: 0, size: [.075, .06], sizeJitter: 0,
    colours: ['#e8f4ff', '#bcd9ff', '#8fb8ee'], intensity: [.8, .7, .6], middle: .5, fadeIn: .03, fadeOut: .05, additive: 1, core: .1,
  },
  // Its trail of cold light.
  'campana-estela': {
    shape: 'dot', drag: 3, gravity: 0, curl: .2, response: 0, size: [.016, .006], sizeJitter: .5,
    colours: ['#ffffff', '#dcefff', '#8fb8ee'], intensity: [2.4, 1.6, .9], middle: .3, fadeIn: .02, fadeOut: .5, additive: 1, core: .4,
  },
  // A ball of fire on its way through the pegs (the `galton` law carries it): one, big and clear.
  'campana-bola': {
    shape: 'glow', drag: 0, gravity: 0, curl: 0, response: 0, stick: 0, size: [.07, .065], sizeJitter: 0,
    colours: ['#fff3d0', '#ffb347', '#ff7a1e'], intensity: [3, 2.6, 2.2], middle: .45, fadeIn: .02, fadeOut: .04, additive: .9, core: .9,
  },
  // What it leaves behind on the same path, a beat later: a short trail of embers.
  'campana-rastro': {
    shape: 'dot', drag: 0, gravity: 0, curl: 0, response: 0, stick: 0, size: [.03, .02], sizeJitter: 0,
    colours: ['#ffd27a', '#ff9a3a', '#e0520f'], intensity: [2.8, 2.2, 1.6], middle: .5, fadeIn: .02, fadeOut: .06, additive: 1, core: .5,
  },
  // A ghost ball: a path of its own, small and gold, so the many draw the bell.
  'campana-fantasma': {
    shape: 'glow', drag: 0, gravity: 0, curl: 0, response: 0, stick: 0, size: [.035, .032], sizeJitter: .1,
    colours: ['#fff1c8', '#f3cf78', '#d9b05a'], intensity: [3, 2.6, 2.2], middle: .5, fadeIn: .03, fadeOut: .05, additive: 1, core: .6,
  },
  // Where a ghost settles: a bead of faint gold, stacked in its slot of the bin.
  'campana-poso': {
    shape: 'dot', drag: 20, gravity: 0, curl: 0, response: 0, size: [.022, .022], sizeJitter: .1,
    colours: ['#ffe7a8', '#f3cf78', '#c9a14e'], intensity: [1.8, 1.5, 1.2], middle: .5, fadeIn: .06, fadeOut: .2, additive: 1, core: .4,
  },
  // Liquid fire in a bin: heavy and deep, opaque and soft so it reads as one body, not as beads.
  'campana-brasa': {
    shape: 'glow', blur: [.6, .9], drag: .3, gravity: 9, curl: .05, response: .1, collide: true, bounce: .02, friction: .6,
    size: [.075, .065], sizeJitter: .3, colours: ['#ffa040', '#ff5a10', '#a82c06'], intensity: [1.9, 1.6, 1.2], middle: .55,
    fadeIn: .04, fadeOut: .08, additive: .12, opacity: .9, core: 0, fluid: { pressure: 7, viscosity: 12, rest: 14 },
  },
  // The same fire pouring out of a bin onto its foe: no fluid, so the sheet keeps together and lands where it is sent.
  'campana-chorro': {
    shape: 'glow', blur: [.5, .8], drag: 0, gravity: 9, curl: .05, response: 0, size: [.075, .06], sizeJitter: .3,
    colours: ['#ffb347', '#ff6a14', '#b8360a'], intensity: [1.6, 1.3, 1], middle: .5, fadeIn: .02, fadeOut: .08, additive: .2, opacity: .9, core: .1,
  },
  // A peg's flash as a ball strikes it: small and crisp.
  'campana-destello': {
    shape: 'glow', drag: 0, gravity: 0, curl: 0, response: 0, size: [.075, .03], sizeJitter: 0,
    colours: ['#fff1c8', '#ffd27a', '#f3cf78'], intensity: [3.4, 2.6, 1.6], middle: .3, fadeIn: 0, fadeOut: .5, additive: 1, core: .8,
  },
  // A spark off a peg as a ball strikes it.
  'campana-chispa': {
    shape: 'spark', drag: 2.5, gravity: 4, curl: 0, response: 0, size: [.01, .005], stretch: .04,
    colours: ['#ffffff', '#ffe0a0', '#ff9a3a'], intensity: [3.2, 2.4, 1.2], middle: .3, fadeOut: .3, additive: 1, core: .5,
  },
} satisfies Record<string, GpuKind>;

function kinds(stage: DuoStage) {
  const g = stage.effects.gpu;
  if (!g) return;
  for (const [name, kind] of Object.entries(KINDS)) if (!g.get(name)) g.define(name, kind);
  ensureFluidKinds(g);
}

/** A seeded random for the paths, so a replay of the same effect draws the same board. */
function seeded(seed: number) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
/** How many of the 2^ROWS paths end in bin `k` (0 … ROWS). */
const weight = (k: number) => { let c = 1; for (let i = 0; i < k; i++) c = c * (ROWS - i) / (i + 1); return c; };
/** One of `bins`, as the binomial would weight them. */
function pickBin(bins: readonly number[], random: () => number) {
  const w = bins.map(weight), total = w.reduce((s, x) => s + x, 0);
  let r = random() * total;
  for (let i = 0; i < bins.length; i++) { r -= w[i]; if (r <= 0) return bins[i]; }
  return bins[bins.length - 1];
}
/** The fall (m/s²) that takes a ball from `drop` over the top peg to the bins in `seconds`. */
function fallFor(rowGap: number, drop: number, bounce: number, seconds: number) {
  let lo = 2, hi = 200;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2, t = galtonTimes({ rows: ROWS, rowGap, fall: mid, bounce, drop })[ROWS];
    if (t > seconds) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

/** A glass bin: the side of the row it is for, its foe, the board's bins (0 … ROWS) it takes, its walls. */
interface Bin { side: -1 | 0 | 1; foe: DuoFighter; slots: number[]; left: number; right: number }
interface Plan { figure: NeonFigure; volumes: GpuVolume[]; law?: GpuLaw; pegRows: NeonStroke[][]; pegAt: V3[][] }
const plans = new WeakMap<BattleEffect, Plan>();

/**
 * Where the bins go: each over its own foe as the picture sees it (`x`, metres across from the foe picked),
 * snapped to the board's bins, every bin of the board going to the nearest of them and no bin wider than three.
 */
function layBins(foes: { side: -1 | 0 | 1; foe: DuoFighter; x: number }[], peg: number): Bin[] {
  const half = ROWS / 2, taken = new Set<number>();
  const centres = foes.map(f => {
    let c = f.side === 0 ? 0 : clamp(Math.round(f.x / peg), -half + 1, half - 1);
    if (f.side && Math.abs(c) < 2) c = 2 * (Math.sign(f.x) || f.side);
    while (taken.has(c)) c += Math.sign(c) || 1;
    taken.add(c);
    return c;
  });
  return foes.map((f, i) => {
    const slots: number[] = [];
    for (let s = -half; s <= half; s++) {
      const near = centres.reduce((best, c, j) => Math.abs(s - c) < Math.abs(s - centres[best]) || (Math.abs(s - c) === Math.abs(s - centres[best]) && foes[j].side === 0) ? j : best, 0);
      if (near === i && Math.abs(s - centres[i]) <= 1) slots.push(s + half);
    }
    return { side: f.side, foe: f.foe, slots, left: (Math.min(...slots) - half - .5) * peg + .025, right: (Math.max(...slots) - half + .5) * peg - .025 };
  });
}

export const staging: DuoStaging = {
  timing: { contact: CONTACT, end: END },

  start(stage, e, reached) {
    const fx = stage.fx;
    const target = (e.target ? stage.fighter(e.target) : undefined) ?? reached.find(f => !f.party);
    if (!target || !fx.on) return;
    kinds(stage);
    const g = stage.effects.gpu!;
    const axes = screenAxes(stage.view), { right, up, facing } = axes;
    const dice = e.bell ?? [], eaten = !!e.annulled;
    // Who stands beside it: the foes the dice found there, or the ones next to it on the stage.
    const standing = stage.foes(), at = standing.findIndex(f => f.id === target.id);
    const besideOf = (side: -1 | 1) => { const id = dice.find(d => d.side === side)?.target; return (id && stage.fighter(id)) || (at >= 0 ? standing[at + side] : undefined); };
    const across = (f: DuoFighter) => dot(sub(f.feet, target.feet), right);
    const row = ([-1, 0, 1] as const).map(side => ({ side, foe: side ? besideOf(side) : target })).filter((b): b is { side: -1 | 0 | 1; foe: DuoFighter } => !!b.foe).map(b => ({ ...b, x: b.side ? across(b.foe) : 0 }));
    // The board is as wide as the row: its outer bins over the foes beside the one picked.
    const reach = Math.max(.6, ...row.map(b => Math.abs(b.x)));
    const peg = clamp(reach / 3, .2, .6), gap = clamp(peg * .78, .16, .42), depth = clamp(peg * 1.5, .4, .8);
    const bins = layBins(row, peg);
    // The board stands over them all in the camera's plane, well towards it (the picture's up leans back, and a board
    // this tall would go into a wall behind them), the bins' floor clear over the tallest head as the picture sees it.
    const origin = add(target.feet, facing, 2.5);
    const heads = row.map(b => dot(sub(add(b.foe.feet, { x: 0, y: b.foe.height, z: 0 }), origin), up));
    const binTop = -ROWS * gap - .03, binBottom = binTop - depth;
    const apex = add(origin, up, Math.max(...heads) + .3 - binBottom);
    const figure = stage.figure('Campana de Gauss', { look: LOOK, frame: { at: apex, ...axes } });
    // A little under a figure's usual brightness, so its tubes read gold and not white.
    figure.glow(.6);
    // The triangle of Pirámide: its apex over the top peg, its sides just outside the last row.
    const top = 1.7 * gap, base = -(ROWS - .35) * gap, w = 4.2 * peg * (top - base) / (top + (ROWS - 1) * gap);
    const sides = [figure.stroke(neonCurve(14, u => xy(-w * u, top + (base - top) * u)), { radius: .03 }), figure.stroke(neonCurve(14, u => xy(w * u, top + (base - top) * u)), { radius: .03 })];
    const floor = figure.stroke(neonCurve(18, u => xy(-w + 2 * w * u, base)), { radius: .022 });
    // The pegs, row by row: small rings.
    const pegAt: V3[][] = [], pegRows: NeonStroke[][] = [];
    for (let r = 0; r < ROWS; r++) {
      pegAt.push([]); pegRows.push([]);
      for (let j = 0; j <= r; j++) { const p = xy((j - r / 2) * peg, -r * gap); pegAt[r].push(p); pegRows[r].push(figure.stroke(neonCircle(.04, 12, p), { radius: .016 })); }
    }
    // The glass bins, each a cup over its foe.
    const binStrokes = bins.map(b => figure.stroke([xy(b.left, binTop), xy(b.left, binBottom), xy(b.right, binBottom), xy(b.right, binTop)], { radius: .016, look: GLASS }));
    // The board's own frame in the world, for the law and the bins' volumes.
    const m = new pc.Mat4();
    m.data.set([right.x, right.y, right.z, 0, up.x, up.y, up.z, 0, facing.x, facing.y, facing.z, 0, 0, 0, 0, 1]);
    const rotation = new pc.Quat().setFromMat4(m);
    const volumes = eaten ? [] : bins.map(b => g.volume({ shape: 'box', mode: 'contain', at: figure.world(xy((b.left + b.right) / 2, (binTop + binBottom) / 2)), rotation, size: { x: (b.right - b.left) / 2 - .01, y: depth / 2, z: .16 }, bounce: .05, kinds: ['campana-brasa'] }));
    const plan: Plan = { figure, volumes, pegRows, pegAt };
    plans.set(e, plan);

    // ── Gerard draws: the triangle, then the pegs a row at a time, then the bins. ──
    stage.draw(figure, [...sides, floor], .2);
    const flat = pegRows.flat(), pegsAt = pegAt.flat();
    stage.draw(figure, flat, .3, { delay: .18, each: i => { if (i % 3 === 0) stage.cue('peg', { pan: stage.pan(figure.world(pegsAt[i])), volume: .55 }); } });
    stage.draw(figure, binStrokes, .12, { delay: .46, pen: false });

    // ── The law the balls fall by, timed so they reach the bins by `THROUGH`. ──
    const drop = gap * .9, bounce = .25, fall = fallFor(gap, drop, bounce, THROUGH);
    const times = galtonTimes({ rows: ROWS, rowGap: gap, fall, bounce, drop });
    const law = g.law('galton', { at: figure.world(xy(0, 0)), rotation, params: [ROWS, gap, peg, fall], bounce, spark: 2.2, spread: 0 });
    plan.law = law;
    const dropAt = figure.world(xy(0, drop));
    const binX = (bin: number) => (bin - ROWS / 2) * peg;
    const random = seeded(dice.reduce((s, d, i) => s + d.amount * 31 + i * 7 + (d.side + 2) * 131, 17));
    // Each die: its bin (among those over the foe it lands on), its path to it, when it melts in.
    const binFor = new Map(bins.map(b => [b.side, b]));
    const counts = new Map<-1 | 0 | 1, number>();
    for (const d of dice) counts.set(d.side, (counts.get(d.side) ?? 0) + 1);
    const most = Math.max(1, ...counts.values()), perDie = Math.round(FILL / most);
    const balls = dice.flatMap((d, i) => {
      const own = binFor.get(d.side) ?? binFor.get(0);
      if (!own) return [];
      const bin = pickBin(own.slots, random);
      return [{ side: d.side, bin, path: galtonPath(bin, ROWS, random), melt: MELT + (dice.length > 1 ? i / (dice.length - 1) : 0) * MELT_SPAN }];
    });
    /** A peg flashing as a ball strikes it, and its sparks. */
    const strike = (p: V3) => {
      const w = figure.world(p);
      g.burst('campana-destello', { at: w, count: 1, spread: 0, life: [.11, .14] });
      g.burst('campana-chispa', { at: w, count: 6, spread: .01, speed: 1.1, life: [.12, .26] });
    };
    // Her dice of cold light come down onto the top of the board, and melt into fire there.
    const sky = add(dropAt, up, 1.5);
    balls.forEach((b, i) => {
      const dropFor = .3, from = add(add(sky, right, (random() - .5) * .6), up, (i % 3) * .14);
      const velocity = { x: (dropAt.x - from.x) / dropFor, y: (dropAt.y - from.y) / dropFor, z: (dropAt.z - from.z) / dropFor };
      fx.after(b.melt - dropFor, () => {
        g.burst('campana-dado', { at: from, count: 1, spread: 0, velocity, life: [dropFor, dropFor] });
        g.burst('campana-dado-luz', { at: from, count: 1, spread: 0, velocity, life: [dropFor, dropFor] });
        fx.burst('campana-estela', { at: from, to: dropAt, shape: 'line', count: 24, spread: .01, speed: .1, life: [.25, .45] });
      });
      fx.after(b.melt, () => {
        // In: it becomes a ball of fire on its path, a trail of embers a beat behind it on the same path.
        g.burst('campana-bola', { at: dropAt, count: 1, spread: 0, life: [times[ROWS] + .02, times[ROWS] + .03], path: b.path, law });
        for (let k = 1; k <= 3; k++) fx.after(k * .025, () => g.burst('campana-rastro', { at: dropAt, count: 1, spread: 0, life: [times[ROWS] - .01, times[ROWS]], size: 1 - k * .2, path: b.path, law }));
        if (i === 0) fx.burst('flare', { at: dropAt, count: 1, spread: .02, life: [.08, .14], colour: '#ffd08a', light: { intensity: 2.4, range: 2.4, colour: C.fire } });
        fx.burst('campana-chispa', { at: dropAt, count: 8, spread: .02, speed: 1.4, life: [.15, .3] });
        // Each peg it meets flashes.
        let k = 0;
        for (let r = 0; r < ROWS; r++) {
          const p = pegAt[r][k];
          fx.after(times[r], () => strike(p));
          k += (b.path >> r) & 1;
        }
        // Into its bin: liquid fire, a share of the bin's; or, if the light ate it, only smoke.
        fx.after(times[ROWS], () => {
          const x = binX(b.bin);
          if (eaten) g.burst('fluido-humo', { at: figure.world(xy(x, binTop - .1)), count: 10, spread: .05, speed: .2, life: [.6, 1] });
          // It lives until the bin opens (the pour takes over from there), or it would fall out of it.
          else { const left = OPEN + .06 - b.melt - times[ROWS]; g.burst('campana-brasa', { at: figure.world(xy(x, binTop - depth * .45)), count: perDie, spread: Math.min(.12, peg * .3), velocity: { x: -up.x * .6, y: -up.y * .6, z: -up.z * .6 }, speed: .3, life: [left, left + .02] }); }
          g.burst('campana-chispa', { at: figure.world(xy(x, binTop)), count: 5, spread: .02, speed: 1.2, life: [.12, .25] });
        });
      });
    });
    // Ghosts: balls of no die, each on a path of its own, falling through the whole fall and settling in the bins as
    // gold sediment, a bead at a time in its slot, so the histogram builds as they land.
    const inBin = new Set(bins.flatMap(b => b.slots)), stacked = new Map<number, number>();
    const bead = .034, perLayer = 4;
    for (let n = 0; n < GHOSTS; n++) {
      const path = Math.floor(random() * (1 << ROWS)), bin = [...Array(ROWS).keys()].reduce((s, r) => s + ((path >> r) & 1), 0);
      const born = MELT - .1 + (n / GHOSTS) * (MELT_SPAN + .2);
      fx.after(born, () => g.burst('campana-fantasma', { at: dropAt, count: 1, spread: 0, life: [times[ROWS] + .01, times[ROWS] + .02], path, law }));
      if (!inBin.has(bin)) continue;
      const i = stacked.get(bin) ?? 0;
      stacked.set(bin, i + 1);
      const x = binX(bin) + ((i % perLayer) - (perLayer - 1) / 2) * bead, y = binBottom + .025 + Math.floor(i / perLayer) * bead * .9;
      if (y > binTop - .05) continue;
      fx.after(born + times[ROWS], () => g.burst('campana-poso', { at: figure.world(xy(x, y)), count: 1, spread: 0, life: [END - born - times[ROWS], END - born - times[ROWS] + .05] }));
    }
    // The bell, drawn over the bins from where the dice fell: their own middle and spread.
    if (balls.length) {
      const mu = balls.reduce((s, b) => s + b.bin, 0) / balls.length;
      const sigma = Math.max(.9, Math.sqrt(balls.reduce((s, b) => s + (b.bin - mu) ** 2, 0) / balls.length));
      const peak = depth * .92;
      const bell = figure.stroke(neonCurve(56, u => { const k = -.4 + (ROWS + .8) * u; return xy(binX(k), binBottom + .02 + peak * Math.exp(-((k - mu) ** 2) / (2 * sigma * sigma))); }), { radius: .026, look: { core: C.bell, halo: C.gold } });
      stage.draw(figure, [bell], .18, { delay: 1.17, colour: C.gold });
      fx.after(1.3, () => figure.glow(.95, .35));
    }
    stage.cue('clink', { delay: MELT - .05 });
    stage.cue('pachinko', { delay: MELT + .06, pan: stage.pan(dropAt) });
    stage.cue('chord-swell', { delay: 1.15 });
    if (eaten) {
      // The light eats it: the bins go out in smoke, and nothing pours.
      fx.after(OPEN, () => { for (const b of bins) g.burst('fluido-humo', { at: figure.world(xy((b.left + b.right) / 2, binTop - depth * .4)), count: 40, spread: (b.right - b.left) * .3, speed: .3, life: [.8, 1.3] }); });
      return;
    }
    // The bins open well before the contact, and the fire pours out of each as a sheet onto its foe.
    fx.after(OPEN, () => { for (const v of volumes) v.remove(); });
    // Each bin empties as a sheet: a line along its floor every frame or two, the fullest bins longest.
    for (let k = 0; k < 6; k++) fx.after(OPEN + k * .02, () => {
      for (const b of bins) {
        const n = counts.get(b.side) ?? 0;
        if (!n || k >= 2 + Math.ceil(4 * n / most)) continue;
        const l = figure.world(xy(b.left + .03, binBottom + .03)), r = figure.world(xy(b.right - .03, binBottom + .03)), to = b.foe.chest, mid = add(l, sub(r, l), .5), T = CONTACT - OPEN - k * .02;
        const v = { x: (to.x - mid.x) / T, y: (to.y - mid.y) / T + 4.5 * T, z: (to.z - mid.z) / T };
        g.burst('campana-chorro', { at: l, to: r, shape: 'line', count: Math.round(perDie * n * .12), spread: .01, velocity: v, speed: .03, life: [T, T + .04] });
      }
    });
    stage.cue('fire-cast', { delay: OPEN });
  },

  land(stage, e, reached) {
    const fx = stage.fx, plan = plans.get(e);
    if (!e.annulled) {
      const lit = new Map((e.hits ?? []).map(h => [h.target, h]));
      for (const f of reached) {
        const h = lit.get(f.id);
        if (!h || !h.amount) continue;
        const big = f.id === e.target;
        stage.hit(f.id, [1, .62, .25], big ? 1.4 : 1);
        if (!fx.on) continue;
        stage.fluid.fireball(f.chest, big ? .75 : .5, big ? 1 : .7, { smoke: false });
        stage.effects.element('fire', f.chest, { strength: big ? 1.4 : 1, feet: f.feet });
        fx.burst('floorring', { at: { ...f.feet, y: f.feet.y + .05 }, count: 1, spread: .01, life: [.35, .5], colour: C.fire, size: big ? 1.3 : 1 });
      }
      stage.shake(.55); stage.pulse(.6, .9, .2); stage.punch(.3);
      stage.cue('fire-hit'); stage.cue('burn', { delay: .12 });
    }
    if (!plan) return;
    // The pegs go out from the bottom up, then the rest of the figure.
    const { figure, pegRows, pegAt } = plan, gap = (END - CONTACT - .35) / ROWS;
    for (let r = ROWS - 1; r >= 0; r--) fx.after(.08 + (ROWS - 1 - r) * gap, () => {
      if (figure.gone) return;
      pegRows[r].forEach(s => s.show(0, 0));
      for (const p of pegAt[r]) fx.burst('campana-chispa', { at: figure.world(p), count: 2, spread: .01, speed: .5, life: [.12, .25] });
    });
    figure.fade(.3, END - CONTACT - .3);
    fx.after(END - CONTACT, () => { plan.law?.remove(); for (const v of plan.volumes) v.remove(); });
  },
};
