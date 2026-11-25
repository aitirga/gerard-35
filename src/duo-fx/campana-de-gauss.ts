import * as pc from 'playcanvas';
import type { BattleEffect } from '../battle';
import { screenAxes, type V3 } from '../dual-fx';
import { galtonPath, galtonTimes, type GpuKind, type GpuLaw, type GpuVolume } from '../fight-particles';
import { ensureFluidKinds } from '../fluid-fx';
import { neonCircle, neonCurve, type NeonFigure, type NeonStroke } from '../math-figures';
import type { DuoFighter, DuoStage, DuoStaging } from './types';

/**
 * Campana de Gauss (Matemágico's Pirámide ígnea + Dadista's Dados astrales). Gerard's circle draws
 * Pirámide's triangle standing in the camera's plane over the foes, wide enough to take in the three,
 * and fills it with eight rows of pegs, a tick of the pen each; three glass bins hang under it, one over
 * the foe picked and one over each foe beside it. Dadista's dice of cold light fall into its top and
 * melt into balls of fire, and each falls through the pegs on the path the rule chose for it (the GPU
 * `galton` law: one bit a row, the peg it meets flashing) into the bin over the foe it lands on; pale
 * ghost balls on paths of their own fill the board so the bell reads even with few dice. The bins fill
 * as a histogram of liquid fire, tallest over the foe picked, and the pen draws a bell over them from
 * where the dice fell. At contact the bins' floors open and the fire pours onto each foe; then the pegs
 * go out from the bottom up. Gold for his figure, cold white for her dice, fire for what they become.
 */
const C = { gold: '#f3cf78', cream: '#fff4d6', ice: '#dcefff', fire: '#ff8a2e' } as const;
const GLASS = { core: '#fbf7ec', halo: '#c9b27a' };
/** Rows of pegs; when the bins open; when the numbers land; when it is over. */
const ROWS = 8, OPEN = 1.5, CONTACT = 1.72, END = 2.6;
/** When the first die of light melts at the top of the board, and over how long the rest follow. */
const MELT = .5, MELT_SPAN = .24;
/** How long a ball takes from the top to the bins (the law's fall is worked out to it). */
const THROUGH = .55;
/** The liquid fire the fullest bin holds, in particles: each bin's share of it by its dice. */
const FILL = 900;
const add = (a: V3, b: V3, k = 1): V3 => ({ x: a.x + b.x * k, y: a.y + b.y * k, z: a.z + b.z * k });
const sub = (a: V3, b: V3): V3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const dot = (a: V3, b: V3) => a.x * b.x + a.y * b.y + a.z * b.z;
const xy = (x: number, y: number): V3 => ({ x, y, z: 0 });
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

const KINDS = {
  // A die of Dadista's cold light falling into the top of the board.
  'campana-dado': {
    shape: 'glow', drag: 0, gravity: 0, curl: 0, response: 0, size: [.075, .05], sizeJitter: .3,
    colours: ['#ffffff', '#dcefff', '#9fc8ff'], intensity: [3.6, 2.8, 2], middle: .5, fadeIn: .03, fadeOut: .05, additive: 1, core: .8,
  },
  // Its trail of cold light.
  'campana-estela': {
    shape: 'dot', drag: 3, gravity: 0, curl: .2, response: 0, size: [.016, .006], sizeJitter: .5,
    colours: ['#ffffff', '#dcefff', '#8fb8ee'], intensity: [2.4, 1.6, .9], middle: .3, fadeIn: .02, fadeOut: .5, additive: 1, core: .4,
  },
  // A ball of fire on its way through the pegs (the `galton` law carries it).
  'campana-bola': {
    shape: 'glow', drag: 0, gravity: 0, curl: 0, response: 0, stick: 0, size: [.095, .08], sizeJitter: .35,
    colours: ['#fff3d0', '#ffb347', '#ff6a14'], intensity: [3.6, 3.2, 2.8], middle: .45, fadeIn: .02, fadeOut: .04, additive: .9, core: .7,
  },
  // A ghost ball: a path of its own, pale, so the many draw the bell.
  'campana-fantasma': {
    shape: 'glow', drag: 0, gravity: 0, curl: 0, response: 0, stick: 0, size: [.028, .024], sizeJitter: .3,
    colours: ['#fff8e6', '#f3dca0', '#d9b46a'], intensity: [2, 1.7, 1.3], middle: .5, fadeIn: .05, fadeOut: .08, additive: 1, core: .3,
  },
  // Liquid fire in a bin: heavy, it fills it as a body and pours when the floor opens.
  'campana-brasa': {
    shape: 'glow', blur: [.25, .5], drag: .3, gravity: 9, curl: .05, response: .1, collide: true, bounce: .02, friction: .6,
    size: [.06, .05], sizeJitter: .3, colours: ['#ffc861', '#ff8424', '#b23a0a'], intensity: [2.3, 1.9, 1.2], middle: .55,
    fadeIn: .04, fadeOut: .15, additive: .55, opacity: .95, core: .35, fluid: { pressure: 7, viscosity: 12, rest: 14 },
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
/** A bin among a side's three (−1 the left ones, 0 the middle, 1 the right), as the binomial would weight them. */
function binOf(side: -1 | 0 | 1, random: () => number) {
  const bins = [side * 3 + 3, side * 3 + 4, side * 3 + 5];
  const weight = (k: number) => { let c = 1; for (let i = 0; i < k; i++) c = c * (ROWS - i) / (i + 1); return c; };
  const w = bins.map(weight), total = w.reduce((s, x) => s + x, 0);
  let r = random() * total;
  for (let i = 0; i < 3; i++) { r -= w[i]; if (r <= 0) return bins[i]; }
  return bins[1];
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

interface Plan { figure: NeonFigure; volumes: GpuVolume[]; law?: GpuLaw; pegRows: NeonStroke[][]; pegAt: V3[][]; bins: { side: -1 | 0 | 1; foe?: DuoFighter; bottom: V3[] }[] }
const plans = new WeakMap<BattleEffect, Plan>();

export const staging: DuoStaging = {
  timing: { contact: CONTACT, end: END },

  start(stage, e, reached) {
    const fx = stage.fx;
    const target = (e.target ? stage.fighter(e.target) : undefined) ?? reached.find(f => !f.party);
    if (!target || !fx.on) return;
    kinds(stage);
    const g = stage.effects.gpu!;
    const axes = screenAxes(stage.view), { right, up, facing } = axes;
    const dice = e.bell ?? [];
    // Who stands beside it: the foes the dice found there, or the ones next to it on the stage.
    const standing = stage.foes(), at = standing.findIndex(f => f.id === target.id);
    const besideOf = (side: -1 | 1) => { const id = dice.find(d => d.side === side)?.target; return (id && stage.fighter(id)) || standing[at + side]; };
    const beside = { [-1]: at >= 0 ? besideOf(-1) : undefined, [1]: at >= 0 ? besideOf(1) : undefined } as Record<-1 | 1, DuoFighter | undefined>;
    const across = (f?: DuoFighter) => f ? dot(sub(f.feet, target.feet), right) : 0;
    // Each side's bin goes on the side of the picture its foe stands on (the row may run either way).
    const flip = (across(beside[-1]) > 0 && !(beside[1] && across(beside[1]) < 0)) || (!!beside[1] && across(beside[1]) < 0 && !beside[-1]);
    const screenSide = (side: -1 | 0 | 1) => (flip ? -side : side) as -1 | 0 | 1;
    const reach = [beside[-1], beside[1]].filter((f): f is DuoFighter => !!f).map(f => Math.abs(across(f)));
    const peg = clamp(reach.length ? reach.reduce((s, x) => s + x, 0) / reach.length / 3 : .24, .2, .5), row = clamp(peg * .78, .16, .32);
    const depth = clamp(peg * 1.7, .4, .7), binWide = 1.45 * peg;
    // The board stands over them all in the camera's plane, a little towards it, the bins' floor clear over the
    // tallest head as the picture sees it (along the picture's up, whatever the camera's pitch).
    const origin = add(target.feet, facing, .6);
    const heads = [target, beside[-1], beside[1]].filter((f): f is DuoFighter => !!f).map(f => dot(sub(add(f.feet, { x: 0, y: f.height, z: 0 }), origin), up));
    const binTop = -ROWS * row - .03, binBottom = binTop - depth;
    const apex = add(origin, up, Math.max(...heads) + .3 - binBottom);
    const figure = stage.figure('Campana de Gauss', { frame: { at: apex, ...axes } });
    // The triangle of Pirámide: its apex over the top peg, its sides just outside the last row.
    const top = 1.7 * row, base = -(ROWS - .35) * row, w = 4.2 * peg * (top - base) / (top + (ROWS - 1) * row);
    const sides = [figure.stroke(neonCurve(14, u => xy(-w * u, top + (base - top) * u)), { radius: .022 }), figure.stroke(neonCurve(14, u => xy(w * u, top + (base - top) * u)), { radius: .022 })];
    const floor = figure.stroke(neonCurve(18, u => xy(-w + 2 * w * u, base)), { radius: .016 });
    // The pegs, row by row: small rings.
    const pegAt: V3[][] = [], pegRows: NeonStroke[][] = [];
    for (let r = 0; r < ROWS; r++) {
      pegAt.push([]); pegRows.push([]);
      for (let j = 0; j <= r; j++) { const p = xy((j - r / 2) * peg, -r * row); pegAt[r].push(p); pegRows[r].push(figure.stroke(neonCircle(.034, 12, p), { radius: .011 })); }
    }
    // The three bins of glass, each a cup under its third of the board.
    const binStrokes: NeonStroke[] = [];
    const bins: Plan['bins'] = ([-1, 0, 1] as const).map(side => {
      const foe = side ? beside[side] : target, cx = screenSide(side) * 3 * peg;
      if (!foe) return { side, bottom: [] };
      const cup = [xy(cx - binWide, binTop), xy(cx - binWide, binBottom), xy(cx + binWide, binBottom), xy(cx + binWide, binTop)];
      binStrokes.push(figure.stroke(cup, { radius: .014, look: GLASS }));
      return { side, foe, bottom: [xy(cx - binWide * .9, binBottom + .02), xy(cx + binWide * .9, binBottom + .02)] };
    });
    // The board's own frame in the world, for the law and the bins' volumes.
    const m = new pc.Mat4();
    m.data.set([right.x, right.y, right.z, 0, up.x, up.y, up.z, 0, facing.x, facing.y, facing.z, 0, 0, 0, 0, 1]);
    const rotation = new pc.Quat().setFromMat4(m);
    const volumes = bins.filter(b => b.foe).map(b => {
      const cx = screenSide(b.side) * 3 * peg;
      return g.volume({ shape: 'box', mode: 'contain', at: figure.world(xy(cx, (binTop + binBottom) / 2)), rotation, size: { x: binWide - .01, y: depth / 2, z: .16 }, bounce: .05, kinds: ['campana-brasa'] });
    });
    const plan: Plan = { figure, volumes, pegRows, pegAt, bins };
    plans.set(e, plan);

    // ── Gerard draws: the triangle, then the pegs a row at a time, then the bins. ──
    stage.draw(figure, [...sides, floor], .2);
    const flat = pegRows.flat(), pegsAt = pegAt.flat();
    stage.draw(figure, flat, .32, { delay: .2, each: i => { if (i % 3 === 0) stage.cue('peg', { pan: stage.pan(figure.world(pegsAt[i])), volume: .55 }); } });
    stage.draw(figure, binStrokes, .14, { delay: .52, pen: false });

    // ── The law the balls fall by, timed so they reach the bins by `THROUGH`. ──
    const drop = row * .9, bounce = .25, fall = fallFor(row, drop, bounce, THROUGH);
    const times = galtonTimes({ rows: ROWS, rowGap: row, fall, bounce, drop });
    const law = g.law('galton', { at: figure.world(xy(0, 0)), rotation, params: [ROWS, row, peg, fall], bounce, spark: 2.2, spread: .012 });
    plan.law = law;
    const dropAt = figure.world(xy(0, drop));
    const random = seeded(dice.reduce((s, d, i) => s + d.amount * 31 + i * 7 + (d.side + 2) * 131, 17));
    // Each die: its bin (by the side it lands on), its path to it, when it melts in.
    const counts = new Map<-1 | 0 | 1, number>();
    for (const d of dice) counts.set(d.side, (counts.get(d.side) ?? 0) + 1);
    const most = Math.max(1, ...counts.values()), perDie = Math.round(FILL / most);
    const balls = dice.map((d, i) => {
      const bin = binOf(screenSide(d.side), random);
      return { side: d.side, bin, path: galtonPath(bin, ROWS, random), melt: MELT + (dice.length > 1 ? i / (dice.length - 1) : 0) * MELT_SPAN };
    });
    // Her dice of cold light come down onto the top of the board, and melt into fire there.
    const sky = add(dropAt, up, 1.5);
    balls.forEach((b, i) => {
      const dropFor = .3, from = add(add(sky, right, (random() - .5) * .5), up, (i % 3) * .12);
      fx.after(b.melt - dropFor, () => {
        g.burst('campana-dado', { at: from, count: 12, spread: .025, velocity: { x: (dropAt.x - from.x) / dropFor, y: (dropAt.y - from.y) / dropFor, z: (dropAt.z - from.z) / dropFor }, speed: .05, life: [dropFor, dropFor] });
        fx.burst('campana-estela', { at: from, to: dropAt, shape: 'line', count: 24, spread: .01, speed: .1, life: [.25, .45] });
      });
      fx.after(b.melt, () => {
        // In: it becomes a ball of fire on its path.
        g.burst('campana-bola', { at: dropAt, count: 30, spread: .02, life: [times[ROWS] + .02, times[ROWS] + .03], path: b.path, law });
        fx.burst('flare', { at: dropAt, count: 1, spread: .02, life: [.08, .14], colour: '#ffd08a', ...i === 0 ? { light: { intensity: 2.4, range: 2.4, colour: C.fire } } : {} });
        fx.burst('campana-chispa', { at: dropAt, count: 8, spread: .02, speed: 1.4, life: [.15, .3] });
        // Each peg it meets flashes.
        let k = 0;
        for (let r = 0; r < ROWS; r++) {
          const p = pegAt[r][k];
          fx.after(times[r], () => {
            const w = figure.world(p);
            g.burst('flare', { at: w, count: 1, spread: .005, life: [.08, .14], colour: '#ffd890', size: 1.3 });
            g.burst('campana-chispa', { at: w, count: 6, spread: .01, speed: 1.1, life: [.12, .26] });
          });
          k += (b.path >> r) & 1;
        }
        // Into its bin: liquid fire, a share of the bin's.
        fx.after(times[ROWS], () => {
          const x = (b.bin - ROWS / 2) * peg;
          g.burst('campana-brasa', { at: figure.world(xy(x, binTop - .12)), count: perDie, spread: .04, velocity: { x: -up.x * 1.2, y: -up.y * 1.2, z: -up.z * 1.2 }, speed: .3, life: [1.9, 2.3] });
          g.burst('campana-chispa', { at: figure.world(xy(x, binTop)), count: 5, spread: .02, speed: 1.2, life: [.12, .25] });
        });
      });
    });
    // Ghosts: balls of no die, on paths of their own, so the board fills and the bell shows.
    for (let k = 0; k < 22; k++) fx.after(MELT - .02 + k * .03, () => g.burst('campana-fantasma', { at: dropAt, count: 12, spread: .004, life: [times[ROWS] + .01, times[ROWS] + .02], law }));
    // The bell, drawn over the bins from where the dice fell: their own middle and spread.
    if (balls.length) {
      const mu = balls.reduce((s, b) => s + b.bin, 0) / balls.length;
      const sigma = Math.max(.9, Math.sqrt(balls.reduce((s, b) => s + (b.bin - mu) ** 2, 0) / balls.length));
      const peak = depth * .92;
      const bell = figure.stroke(neonCurve(56, u => { const k = -.4 + (ROWS + .8) * u; return xy((k - ROWS / 2) * peg, binBottom + .02 + peak * Math.exp(-((k - mu) ** 2) / (2 * sigma * sigma))); }), { radius: .022, look: { core: '#ffffff', halo: C.gold } });
      stage.draw(figure, [bell], .2, { delay: 1.3, colour: C.gold });
      fx.after(1.5, () => figure.glow(1.25, .5));
    }
    // The bins open just before the contact, so the fire is on them as the numbers come.
    fx.after(OPEN, () => { for (const v of volumes) v.remove(); });
    fx.after(OPEN + .03, () => {
      for (const b of bins) {
        if (!b.foe || !counts.get(b.side)) continue;
        const [l, r] = b.bottom.map(p => figure.world(p)), to = b.foe.chest, mid = add(l, sub(r, l), .5), T = CONTACT - OPEN - .05;
        const v = { x: (to.x - mid.x) / T, y: (to.y - mid.y) / T + 4.5 * T, z: (to.z - mid.z) / T };
        g.burst('campana-brasa', { at: l, to: r, shape: 'line', count: Math.round(perDie * (counts.get(b.side) ?? 0) * .5), spread: .02, velocity: v, speed: .15, life: [.6, 1] });
      }
    });
    stage.cue('clink', { delay: MELT - .05 });
    stage.cue('pachinko', { delay: MELT + .06, pan: stage.pan(dropAt) });
    stage.cue('chord-swell', { delay: 1.28 });
    stage.cue('fire-cast', { delay: OPEN });
  },

  land(stage, e, reached) {
    const fx = stage.fx, plan = plans.get(e);
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
