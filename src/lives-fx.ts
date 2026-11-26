import type * as pc from 'playcanvas';
import type { Effects } from './effects';
import type { GpuKind } from './fight-particles';
import { writeSurface } from './surface-samples.ts';

/**
 * Siete vidas' own look (docs/animas/papagato/README.md § Definitiva, approved by Aitor 2026-11-25: «rebobinado y
 * siluetas»), on the GPU fight engine; the CPU only samples Yuki once where she sits and says when to burst.
 *
 * - **Laid.** As Yuki walks among the party, where she sits at each one's feet she leaves her silhouette: some 300
 *   specks of bone white on her own surface (src/surface-samples.ts, as she sits), with an edge of green.
 * - **Held.** The silhouettes breathe: each breath a new cloud on the same points comes up and goes, the ward's
 *   pulse, for as long as it holds (to the end of the fight if need be). They stay at their ally's feet.
 * - **Saving.** The blow that would have killed lands, its blood flung out of them along it; then the fight plays it
 *   back (`rewind`): the blood runs back into the wound it came from and, as it gets there, turns into Yuki's white
 *   thread rising off them. Their silhouette leaps in front of them and bursts into green motes that rise.
 * - **Closed.** The other silhouettes come apart at once, the ward gone; and so do they all if it went another way
 *   (a pulse or a round's tick it took, the fight over).
 */
type V3 = { x: number; y: number; z: number };

/** Specks a silhouette has, how long a breath is (s) and how long each breath's cloud lives past it. */
export const SILHOUETTE = { points: 300, breath: 1.6, linger: .7 };
/** The killing blow played back: when it starts after the blow lands and how long it takes (s). */
export const REWOUND = { after: .3, seconds: .45 };

export const LIVES_KINDS: Record<string, GpuKind> = {
  // The killing blow's blood, flung out along it and then played back into them (`rewind`): it never lands or stains.
  'siete-sangre': {
    drag: .6, gravity: 6, curl: 0, response: .05, size: [.034, .02], sizeJitter: .6, stretch: .05, shape: 'streak', core: 0,
    colours: ['#ff3545', '#c01522', '#7a0c14'], intensity: [1.9, 1.3, 1], middle: .4, fadeOut: .1, additive: .1,
  },
  // Yuki's thread: what the blood becomes as it gets back into them, a white strand that rises off them and goes.
  'yuki-hilo': {
    drag: 1.2, gravity: -3.2, curl: .5, response: .6, size: [.018, .006], stretch: .09, aspect: .12, shape: 'line',
    colours: ['#ffffff', '#f6f0e2', '#8fe3a8'], intensity: [3, 2.2, 1.4], middle: .45, fadeIn: .05, fadeOut: .5, additive: 1, life: [.8, 1.3],
  },
  // Her silhouette at their feet: bone white specks on her own surface, each breath a cloud that comes up and goes green at its edge.
  'yuki-silueta': {
    drag: 8, gravity: 0, curl: .04, response: 0, size: [.011, .009], sizeJitter: .4, shape: 'dot', core: .6,
    colours: ['#fffaf0', '#f6f0e2', '#7fe0a0'], intensity: [1.5, 1.25, 1.1], middle: .55, fadeIn: .35, fadeOut: .55, additive: .75,
  },
  // Saved: her silhouette bursts into green motes that rise.
  'yuki-motas': {
    drag: 1.2, gravity: -2.2, curl: .6, response: .5, size: [.02, .008], sizeJitter: .5, shape: 'glow', flicker: .3,
    colours: ['#ffffff', '#a6f2bd', '#3fbf6a'], intensity: [3, 2, 1.2], middle: .3, fadeOut: .5, additive: 1,
  },
  // The others, the ward gone: they come apart and settle, with no light of their own.
  'yuki-polvo': {
    drag: 2, gravity: .8, curl: .25, response: .4, size: [.01, .004], shape: 'dot', core: .3,
    colours: ['#f6f0e2', '#d9d2c2', '#9a9488'], intensity: [1.2, 1, .8], middle: .5, fadeOut: .6, additive: .4,
  },
};

interface Silhouette {
  /** Her points as she sat, and where their ally's feet were then: the cloud moves with them. */
  points: V3[]; feet: V3;
  /** When its next breath comes (the fx's own clock). */
  next: number;
}

export function createLivesFx(effects: Effects) {
  const gpu = () => effects.gpu && effects.gpu.active ? effects.gpu : undefined;
  function ensureKinds() {
    const g = effects.gpu;
    if (!g) return;
    for (const [name, kind] of Object.entries(LIVES_KINDS)) if (!g.get(name)) g.define(name, kind);
  }
  const shown = new Map<string, Silhouette>();
  const buffer = new Float32Array(SILHOUETTE.points * 4 * 3);
  let clock = 0;
  /** A silhouette's points where its ally's feet are now (`feet`), pushed `ahead` of them. */
  const placed = (s: Silhouette, feet: V3 | undefined, ahead: V3 = { x: 0, y: 0, z: 0 }) => {
    const dx = (feet?.x ?? s.feet.x) - s.feet.x + ahead.x, dy = (feet?.y ?? s.feet.y) - s.feet.y + ahead.y, dz = (feet?.z ?? s.feet.z) - s.feet.z + ahead.z;
    return s.points.map(p => ({ x: p.x + dx, y: p.y + dy, z: p.z + dz }));
  };
  const centre = (points: readonly V3[]) => points.reduce((m, p) => ({ x: m.x + p.x / points.length, y: m.y + p.y / points.length, z: m.z + p.z / points.length }), { x: 0, y: 0, z: 0 });
  /** The silhouettes still there come apart (the ward is gone): `but` is left to whoever handles it. */
  function scatter(feetOf: (id: string) => V3 | undefined, but?: string) {
    const g = gpu();
    if (g) ensureKinds();
    for (const [id, s] of shown) {
      if (id === but) continue;
      const points = placed(s, feetOf(id));
      g?.burst('yuki-polvo', { at: centre(points), count: points.length, shape: 'points', points, spread: .01, velocity: { x: 0, y: .25, z: 0 }, speed: .35, life: [.7, 1.2] });
    }
    for (const id of [...shown.keys()]) if (id !== but) shown.delete(id);
  }
  return {
    /** Silhouettes standing (development and tests). */
    get shown() { return shown.size; },
    /** Yuki has sat at `id`'s feet (`feet`, where they stand now): her silhouette, as she sits, stays there. */
    leave(id: string, yuki: pc.Entity, feet: V3) {
      const got = writeSurface(yuki, buffer, 0, SILHOUETTE.points, SILHOUETTE.points);
      if (!got) return;
      const points: V3[] = [];
      for (let i = 0; i < got; i++) points.push({ x: buffer[i * 4], y: buffer[i * 4 + 1], z: buffer[i * 4 + 2] });
      shown.set(id, { points, feet: { ...feet }, next: clock });
    },
    /**
     * Each frame: a breath on every silhouette whose time has come, where its ally's feet are now (`feetOf`); with the
     * ward no longer held (`held` false), whatever is left comes apart.
     */
    update(dt: number, held: boolean, feetOf: (id: string) => V3 | undefined) {
      clock += dt;
      if (!shown.size) return;
      if (!held) { scatter(feetOf); return; }
      const g = gpu();
      if (!g) return;
      ensureKinds();
      for (const [id, s] of shown) {
        if (clock < s.next) continue;
        s.next = clock + SILHOUETTE.breath;
        const points = placed(s, feetOf(id)), life = SILHOUETTE.breath + SILHOUETTE.linger;
        g.burst('yuki-silueta', { at: centre(points), count: points.length, shape: 'points', points, spread: .004, velocity: { x: 0, y: .03, z: 0 }, speed: .015, life: [life - .1, life + .1] });
      }
    },
    /**
     * The ward took the blow that would have killed `id`: the blow lands (its blood flung from `chest` along `dir`) and is
     * played back into them, turning into Yuki's thread; their silhouette leaps in front of them (towards the blow, `-dir`)
     * and bursts into green motes; the others come apart.
     */
    save(id: string, chest: V3, dir: { x: number; z: number }, feetOf: (id: string) => V3 | undefined) {
      const g = gpu();
      if (g) {
        ensureKinds();
        const blood = g.burst('siete-sangre', { at: chest, count: 70, spread: .08, velocity: { x: dir.x * 3.6, y: 1.8, z: dir.z * 3.6 }, cone: .75, speed: 1.6, life: [1.6, 2] });
        g.rewind(blood, { after: REWOUND.after, seconds: REWOUND.seconds, into: 'yuki-hilo' });
        const own = shown.get(id);
        if (own) {
          const points = placed(own, feetOf(id), { x: -dir.x * .55, y: .25, z: -dir.z * .55 });
          g.burst('yuki-motas', { at: centre(points), count: points.length, shape: 'points', points, spread: .01, velocity: { x: 0, y: 1.1, z: 0 }, speed: .7, life: [.9, 1.5], light: { intensity: 2, range: 2.5, colour: '#a6f2bd' } });
        }
      }
      shown.delete(id);
      scatter(feetOf);
    },
    /** The fight is over: nothing stays. */
    clear() { shown.clear(); },
  };
}
export type LivesFx = ReturnType<typeof createLivesFx>;
