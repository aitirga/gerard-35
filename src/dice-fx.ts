import type { DieFace } from './battle';
import type { createDualFx, V3 } from './dual-fx';
import type { GpuKind } from './fight-particles';
import type { Effects } from './effects';
import { FACE_STROKES, type Stroke } from './die-faces.ts';

/**
 * What each of Dadaísta's faces draws where its die lands (docs/animas/dadaista/ § Look and
 * interface), on the GPU fight engine only. Every face draws its own printer's ornament in the air,
 * dot by dot as a pen would (`FACE_STROKES`, the die's own drawing), in the die's ivory with its
 * vermilion, so the player sees which face it was and what it did:
 *
 * - **Mano**: the manicule jabs at the foe three times, nearer each time, and the blow shakes the floor.
 * - **Tijeras**: two cuts cross on the foe, the scissors snap shut in red where they meet, and strips
 *   of cut paper fall.
 * - **Ojo**: an eye opens on the foe from its corners, its pupil narrows in red to a mark that stays a moment.
 * - **Corchete**: two brackets close in round the ally from either side and hold.
 * - **En blanco**: a red empty frame is stamped first; the face it repeats is drawn inside it.
 * - **Comodín**: its red star is stamped big on each foe, and a hand lands there as Mano's does.
 *
 * Never pink, never violet (docs/visual-style.md); the red is only ever lines of light, never specks
 * left on someone.
 */
export const DICE_COLOURS = { ivory: '#fff4e0', paper: '#efe6cf', red: '#ff5a3c', ink: '#d9422b' } as const;

export const DICE_KINDS = {
  // Strips of cut paper: matt (they cover, they do not glow), tumbling and swaying as they fall, lying
  // on the floor a moment.
  scrap: {
    drag: 2.6, gravity: 2.2, curl: .9, response: .8, collide: true, bounce: .05, friction: .9, settle: true, size: [.05, .045], sizeJitter: .5, stretch: 0, aspect: .32, spin: 420, shape: 'line',
    colours: ['#fbf6ea', '#efe6cf', '#d9ccb0'], intensity: [1.25, 1.1, .95], middle: .4, fadeIn: .02, fadeOut: .3, additive: .04, core: 0,
  },
} satisfies Record<string, GpuKind>;

/** Where a face is drawn: in front of whom it lands on, facing the camera. */
export interface FaceSpot {
  /** The middle of the drawing, just in front of them. */
  centre: V3;
  /** The floor under them. */
  feet: V3;
  /** The screen's right and up there. */
  right: V3; up: V3;
  /** How big the drawing is (m across), from how tall they stand. */
  size: number;
  /** Which side of the screen the die came from (−1 left, 1 right): the hand points away from it. */
  side: number;
  /** How wide they are from their middle. */
  radius: number;
}

type DualFx = ReturnType<typeof createDualFx>;
const add = (a: V3, b: V3, k: number): V3 => ({ x: a.x + b.x * k, y: a.y + b.y * k, z: a.z + b.z * k });

export function createDiceFx(effects: Effects, dualFx: DualFx) {
  const g = effects.gpu;
  if (g) for (const [name, kind] of Object.entries(DICE_KINDS)) if (!g.get(name)) g.define(name, kind);
  const { after, line, burst } = dualFx;

  /** A point of the 100 × 100 face at `spot`, `scale` of its size, moved `shift` along the screen's right and `lift` up it; `flip` mirrors it. */
  function place(spot: FaceSpot, p: readonly [number, number], scale = 1, shift = 0, flip = false, lift = 0): V3 {
    const s = spot.size * scale, u = ((flip ? 100 - p[0] : p[0]) - 50) / 100 * s + shift, v = (50 - p[1]) / 100 * s + lift;
    return add(add(spot.centre, spot.right, u), spot.up, v);
  }
  /**
   * Draws `strokes` at `spot` as a pen would, segment by segment over `seconds` (all of them at once
   * for 0), each segment a line of dots that lasts `life`. A frame takes 64 bursts at most
   * (src/fight-particles.ts), so a whole ornament is spread over a few frames, never one.
   */
  function draw(strokes: readonly Stroke[], spot: FaceSpot, colour: string, o: { seconds?: number; life?: number; scale?: number; shift?: number; lift?: number; flip?: boolean; size?: number } = {}) {
    const segments = strokes.flatMap(s => s.slice(1).map((p, i) => [s[i], p] as const));
    const seconds = o.seconds ?? 0, life = o.life ?? .6, scale = o.scale ?? 1, dots = 70 * spot.size * scale;
    segments.forEach(([a, b], i) => after(seconds * i / segments.length, () => {
      const from = place(spot, a, scale, o.shift, o.flip, o.lift), to = place(spot, b, scale, o.shift, o.flip, o.lift);
      line(from, to, colour, { count: Math.max(3, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) / 100 * dots)), life, size: o.size ?? 1.3 });
    }));
  }
  const flareAt = (at: V3, colour: string, intensity = 2.4, range = 2.6) => burst('flare', { at, count: 1, spread: .03, life: [.14, .22], colour, light: { intensity, range, colour } });

  const faces: Record<Exclude<DieFace, 'blanco' | 'comodin'>, (spot: FaceSpot) => void> = {
    mano(spot) {
      const c = DICE_COLOURS, flip = spot.side > 0, toward = -spot.side;
      // Two quick jabs from the side it came from, nearer each time…
      [0, 1].forEach(k => after(k * .05, () => draw(FACE_STROKES.mano, spot, c.paper, { scale: 1, shift: toward * spot.size * (-.6 + k * .2), lift: spot.size * .2, flip, life: .12, size: 1.2 })));
      // …the blow…
      after(.1, () => {
        flareAt(spot.centre, c.ivory, 2, 2.6);
        burst('needle', { at: spot.centre, count: 44, spread: .08, velocity: add({ x: 0, y: 0, z: 0 }, spot.right, toward * 2.5), speed: 3, life: [.3, .6], colour: c.ivory });
        dualFx.shock(spot.feet, 1.1, c.paper, { chips: 70, light: true });
      });
      // …and the hand stays a moment where it landed, big and clear once the flash has gone.
      // (Over the blow, not on it: what bursts off a foe would bury it.)
      after(.16, () => draw(FACE_STROKES.mano, spot, c.ivory, { seconds: .04, scale: 1.5, shift: toward * spot.size * -.2, lift: spot.size * .45, flip, life: .8, size: 2 }));
    },
    tijeras(spot) {
      const c = DICE_COLOURS;
      // Two cuts across them, one after the other, crossing in the middle.
      draw([[[12, 12], [88, 88]]], spot, c.ivory, { seconds: .08, life: .45, scale: 1.15, size: 1.6 });
      after(.1, () => draw([[[88, 12], [12, 88]]], spot, c.ivory, { seconds: .08, life: .4, scale: 1.15, size: 1.6 }));
      // Where they cross, the scissors snap shut in the die's red.
      after(.2, () => {
        draw(FACE_STROKES.tijeras, spot, c.red, { seconds: .04, life: .45, scale: .45, size: 1.2 });
        flareAt(spot.centre, c.red, 1.6, 2);
        burst('scrap', { at: add(spot.centre, spot.up, spot.size * .15), count: 34, spread: spot.size * .3, speed: 1.4, up: 1.2, life: [1.1, 1.7] });
        burst('needle', { at: spot.centre, count: 18, spread: .05, speed: 2.6, life: [.25, .5], colour: c.ivory });
      });
    },
    ojo(spot) {
      const c = DICE_COLOURS, [upper, lower, pupil] = FACE_STROKES.ojo;
      // The lids open from both corners at once, meeting in the middle.
      const half = (s: Stroke) => [s.slice(0, Math.ceil(s.length / 2)), [...s.slice(Math.floor(s.length / 2))].reverse()];
      for (const lid of [upper, lower]) for (const part of half(lid)) draw([part], spot, c.ivory, { seconds: .16, life: .85, scale: .95, size: 1.4 });
      // The pupil narrows, in red, to a point.
      [1.6, 1.25, 1].forEach((k, i) => after(.18 + i * .07, () => draw([pupil.map(([x, y]) => [50 + (x - 50) * k, 50 + (y - 50) * k] as const)], spot, i < 2 ? c.ink : c.red, { life: i < 2 ? .12 : .6, scale: .95, size: 1.2 })));
      after(.36, () => {
        // The mark it leaves: a small cross where the next blow will go.
        draw([[[50, 30], [50, 70]], [[30, 50], [70, 50]]], spot, c.red, { life: .7, scale: .4, size: 1.5 });
        burst('twinkle', { at: spot.centre, count: 8, spread: spot.size * .12, speed: .5, life: [.3, .6], colour: c.ivory });
        flareAt(spot.centre, c.red, 1.4, 1.8);
      });
    },
    corchete(spot) {
      const c = DICE_COLOURS, [left, right] = FACE_STROKES.corchete;
      // From well out on either side, the brackets close in round them in steps, and hold just clear of them.
      const scale = 1.05, bar = .28 * spot.size * scale, reach = [1, .65, .42, .28].map(k => spot.radius + k);
      reach.forEach((d, i) => after(i * .05, () => {
        const last = i === reach.length - 1, o = { life: last ? .9 : .1, scale, size: last ? 1.6 : 1.1 };
        draw([left], spot, last ? c.ivory : c.paper, { ...o, shift: -(d - bar) });
        draw([right], spot, last ? c.ivory : c.paper, { ...o, shift: d - bar });
      }));
      after(.16, () => {
        flareAt(spot.centre, c.ivory, 2, 2.4);
        dualFx.ring({ ...spot.feet, y: spot.feet.y + .05 }, { x: 0, y: 1, z: 0 }, spot.radius + .35, c.paper, { count: 80, outward: -.4, life: .7, size: 1.2, kind: 'mote' });
        burst('twinkle', { at: spot.centre, count: 10, spread: spot.size * .4, speed: .3, life: [.3, .7], colour: c.ivory });
      });
    },
  };

  return {
    /**
     * A die landing at `spot`, showing `face`, doing `as` (a blank: the face it repeats, drawn inside
     * its red frame, `delay` later). Returns when the face's own drawing starts.
     */
    land(spot: FaceSpot, face: DieFace, as: Exclude<DieFace, 'blanco'>) {
      if (!dualFx.on) return 0;
      if (as === 'comodin') {
        // The star first, big and red, then the hand it plays as.
        draw(FACE_STROKES.comodin, spot, DICE_COLOURS.red, { seconds: .05, life: .5, scale: 1.25, size: 1.8 });
        flareAt(spot.centre, DICE_COLOURS.red, 2.2, 2.4);
        burst('twinkle', { at: spot.centre, count: 12, spread: spot.size * .3, speed: .6, life: [.3, .6], colour: DICE_COLOURS.ivory });
        after(.12, () => faces.mano(spot));
        return .12;
      }
      if (face !== 'blanco') { faces[as](spot); return 0; }
      draw(FACE_STROKES.blanco, spot, DICE_COLOURS.red, { life: .55, scale: 1.1, size: 1.6 });
      flareAt(spot.centre, DICE_COLOURS.red, 1.6, 2);
      after(.1, () => faces[as](spot));
      return .1;
    },
  };
}
