import type * as pc from 'playcanvas';
import type { Effects } from './effects';
import type { GpuKind } from './fight-particles';
import { writeSurface } from './surface-samples.ts';

/**
 * Horas extra's own look, «la cronofotografía de neón» (docs/animas/matemagico/README.md § Definitiva, approved by Aitor
 * 2026-11-25), on the GPU fight engine; the CPU only samples Gerard once a copy and says when it goes to ash.
 *
 * - **Cast** (`OVERTIME_LOOK.melt`). The ring of ones and zeros spins up until it melts into one band of gold
 *   (src/anima-looks.ts `ringMode`), with a hum that rises.
 * - **Each action.** As it starts, a copy of Gerard stays where he stands, frozen in that pose: a dense cloud of gold points
 *   on his own surface (src/surface-samples.ts, as he is that frame), not an outline. By the third there are three Gerards
 *   of light fanned out. Meanwhile the band overheats, gold to white to a dirty orange.
 * - **After the last.** The copies go one by one from gold to ash grey and come apart into ones and zeros that fall to the
 *   floor. The ring stops and stays at his feet as cold zeros; during the round Agotado it comes back digit by digit.
 *
 * Never violet nor pink (docs/visual-style.md): gold, white, a dirty orange and ash.
 */
type V3 = { x: number; y: number; z: number };

/** The cast in seconds from its start: the ring melts into the band by `melt`, the action is through by `end`. */
export const OVERTIME_LOOK = { melt: .5, contact: .55, end: 1.1 } as const;
/** Points a copy has; how often its cloud is drawn again while it stands (s) and how long each cloud lives past that. */
export const COPY = { points: 520, breath: .5, linger: .35 };
/** The copies going to ash: one after another, `gap` s apart, each in `fall` s. */
export const ASH = { gap: .28, fall: 1.4 };

export const OVERTIME_KINDS: Record<string, GpuKind> = {
  // A frozen copy: dense specks of gold on Gerard's own surface, standing still, bright at the core.
  'horas-copia': {
    drag: 10, gravity: 0, curl: 0, response: 0, size: [.012, .01], sizeJitter: .35, shape: 'dot', core: .7,
    colours: ['#fff6d8', '#f3cf78', '#c99a3a'], intensity: [2.2, 1.7, 1.2], middle: .5, fadeIn: .12, fadeOut: .3, additive: .85,
  },
  // Ash: the copy gone grey, some specks still warm, settling down.
  'horas-ceniza': {
    drag: 2.4, gravity: 2.2, curl: .35, response: .3, size: [.011, .006], sizeJitter: .5, shape: 'dot', core: .2,
    colours: ['#d8d2c6', '#9a958c', '#5e5a55'], intensity: [1, .8, .6], middle: .5, fadeOut: .5, additive: .2,
  },
  // The ones that fall out of it: short upright strokes.
  'horas-uno': {
    drag: 1.6, gravity: 3.4, curl: .2, response: .2, size: [.05, .05], stretch: 0, aspect: .22, shape: 'line',
    colours: ['#e9e3d6', '#a7a196', '#6d6962'], intensity: [1.4, 1, .7], middle: .5, fadeOut: .35, additive: .35, life: [1.1, 1.6],
  },
  // …and the zeros: little rings.
  'horas-cero': {
    drag: 1.6, gravity: 3.4, curl: .2, response: .2, size: [.05, .045], shape: 'ring',
    colours: ['#e9e3d6', '#a7a196', '#6d6962'], intensity: [1.4, 1, .7], middle: .5, fadeOut: .35, additive: .35, life: [1.1, 1.6],
  },
};

interface Copy { points: V3[]; next: number; ash?: number }

export function createOvertimeFx(effects: Effects) {
  const gpu = () => effects.gpu && effects.gpu.active ? effects.gpu : undefined;
  function ensureKinds() {
    const g = effects.gpu;
    if (!g) return;
    for (const [name, kind] of Object.entries(OVERTIME_KINDS)) if (!g.get(name)) g.define(name, kind);
  }
  const copies: Copy[] = [];
  const buffer = new Float32Array(COPY.points * 4 * 3);
  let clock = 0;
  const centre = (points: readonly V3[]) => points.reduce((m, p) => ({ x: m.x + p.x / points.length, y: m.y + p.y / points.length, z: m.z + p.z / points.length }), { x: 0, y: 0, z: 0 });
  /** A copy comes apart: grey specks settling, and ones and zeros falling from where it stood. */
  function crumble(copy: Copy) {
    const g = gpu();
    if (!g) return;
    ensureKinds();
    const at = centre(copy.points);
    g.burst('horas-ceniza', { at, count: copy.points.length, shape: 'points', points: copy.points, spread: .01, velocity: { x: 0, y: -.2, z: 0 }, speed: .35, life: [ASH.fall * .7, ASH.fall] });
    const digits = copy.points.filter((_, i) => i % 26 === 0);
    g.burst('horas-uno', { at, count: Math.ceil(digits.length / 2), shape: 'points', points: digits.filter((_, i) => i % 2 === 0), spread: .02, velocity: { x: 0, y: .3, z: 0 }, speed: .5, life: [1.1, 1.6] });
    g.burst('horas-cero', { at, count: Math.floor(digits.length / 2), shape: 'points', points: digits.filter((_, i) => i % 2 === 1), spread: .02, velocity: { x: 0, y: .3, z: 0 }, speed: .5, life: [1.1, 1.6] });
  }
  return {
    /** Copies standing (development and tests). */
    get shown() { return copies.filter(c => c.ash === undefined).length; },
    /** An action of Horas extra starts: a copy of `model`, as it is this frame, stays where it stands. */
    freeze(model: pc.Entity) {
      const got = writeSurface(model, buffer, 0, COPY.points, COPY.points);
      if (!got) return;
      const points: V3[] = [];
      for (let i = 0; i < got; i++) points.push({ x: buffer[i * 4], y: buffer[i * 4 + 1], z: buffer[i * 4 + 2] });
      copies.push({ points, next: clock });
    },
    /** Horas extra is through: the copies go to ash one by one. */
    ash() { copies.forEach((c, i) => { if (c.ash === undefined) c.ash = clock + i * ASH.gap; }); },
    /** Each frame: a copy's cloud drawn again when its time comes; one whose ash time has come crumbles and goes. */
    update(dt: number) {
      clock += dt;
      if (!copies.length) return;
      const g = gpu();
      if (g) ensureKinds();
      for (let i = copies.length - 1; i >= 0; i--) {
        const c = copies[i];
        if (c.ash !== undefined && clock >= c.ash) { crumble(c); copies.splice(i, 1); continue; }
        if (!g || clock < c.next) continue;
        c.next = clock + COPY.breath;
        const life = COPY.breath + COPY.linger;
        g.burst('horas-copia', { at: centre(c.points), count: c.points.length, shape: 'points', points: c.points, spread: .003, velocity: { x: 0, y: 0, z: 0 }, speed: 0, life: [life - .05, life + .05] });
      }
    },
    /** The fight is over: nothing stays. */
    clear() { copies.length = 0; },
  };
}
export type OvertimeFx = ReturnType<typeof createOvertimeFx>;
