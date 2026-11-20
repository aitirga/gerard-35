import type { DieFace } from './battle';
import type { createDualFx, V3 } from './dual-fx';
import type { GpuKind } from './fight-particles';
import type { Effects } from './effects';
import type { Stamps } from './dice-stamp';
import { FACE_STROKES, type Stroke } from './die-faces.ts';

/**
 * What each of Dadista's dice does where it lands (docs/animas/dadaista/ § Look and interface). The
 * landing is the blow: the die's face is slapped onto whoever it hit as a scrap of printed paper
 * (src/dice-stamp.ts), big, solid and a little crooked, with the weight of a stamp coming down, and
 * what flies off it is paper and ivory sparks (the GPU fight engine). So the player sees which face
 * it was and feels it land:
 *
 * - **Mano**: the hand comes in from the thrower's side as a punch, speed lines behind it, and the
 *   floor takes the blow.
 * - **Tijeras**: two cuts cross whole over the foe, then the scissors are stamped where they meet and
 *   strips of cut paper fall.
 * - **Ojo**: the eye is stamped, a ring closes on it, and a red cross stays where the next blow goes.
 * - **Corchete**: two brackets close in round the ally from either side and hold.
 * - **En blanco**: the empty red frame is slapped on first, and the face it repeats over it, askew.
 * - **Comodín**: its black card with the red star, bigger than anything, a wave along the floor, and
 *   a hand on every foe.
 *
 * The astral (Estrella fugaz, Dados astrales, the meteors) is no paper: light, bluish white, stars.
 * Never pink, never violet (docs/visual-style.md); the red is only ever print and lines of light.
 */
export const DICE_COLOURS = { ivory: '#fff4e0', paper: '#efe6cf', red: '#ff5a3c', ink: '#d9422b' } as const;
/** The astral's bluish white (docs/animas/dadaista/ § The astral look). */
export const ASTRAL_COLOURS = { core: '#f4f9ff', ice: '#bfe0ff', halo: '#7fb4ff' } as const;

export const DICE_KINDS = {
  // Strips of cut paper: matt (they cover, they do not glow), tumbling and swaying as they fall, lying
  // on the floor a moment.
  scrap: {
    drag: 2.6, gravity: 2.2, curl: .9, response: .8, collide: true, bounce: .05, friction: .9, settle: true, size: [.05, .045], sizeJitter: .5, stretch: 0, aspect: .32, spin: 420, shape: 'line',
    colours: ['#fbf6ea', '#efe6cf', '#d9ccb0'], intensity: [1.25, 1.1, .95], middle: .4, fadeIn: .02, fadeOut: .3, additive: .04, core: 0,
  },
  // What a stamp throws off as it lands and as it is torn away: bigger flakes of the same paper,
  // flung hard, tumbling, then lying where they fall.
  shred: {
    drag: 1.9, gravity: 7, curl: .5, response: .5, collide: true, bounce: .12, friction: .85, settle: true, size: [.1, .07], sizeJitter: .6, stretch: 0, aspect: .7, spin: 620, shape: 'line',
    colours: ['#fffaf0', '#efe6cf', '#cfc2a6'], intensity: [1.35, 1.15, .95], middle: .45, fadeIn: .01, fadeOut: .25, additive: .05, core: 0,
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

export function createDiceFx(effects: Effects, dualFx: DualFx, stamps?: Stamps) {
  const g = effects.gpu;
  if (g) for (const [name, kind] of Object.entries(DICE_KINDS)) if (!g.get(name)) g.define(name, kind);
  const { after, line, burst } = dualFx;

  /** A point of the 100 × 100 face at `spot`, `scale` of its size, moved `shift` along the screen's right and `lift` up it; `flip` mirrors it. */
  function place(spot: FaceSpot, p: readonly [number, number], scale = 1, shift = 0, flip = false, lift = 0): V3 {
    const s = spot.size * scale, u = ((flip ? 100 - p[0] : p[0]) - 50) / 100 * s + shift, v = (50 - p[1]) / 100 * s + lift;
    return add(add(spot.centre, spot.right, u), spot.up, v);
  }
  /**
   * Draws `strokes` at `spot` in lines of light, segment by segment over `seconds` (all of them at
   * once for 0), each lasting `life`. A frame takes 64 bursts at most (src/fight-particles.ts), so a
   * long drawing is spread over a few frames, never one.
   */
  function draw(strokes: readonly Stroke[], spot: FaceSpot, colour: string, o: { seconds?: number; life?: number; scale?: number; shift?: number; lift?: number; flip?: boolean; size?: number } = {}) {
    const segments = strokes.flatMap(s => s.slice(1).map((p, i) => [s[i], p] as const));
    const seconds = o.seconds ?? 0, life = o.life ?? .6, scale = o.scale ?? 1, dots = 110 * spot.size * scale;
    segments.forEach(([a, b], i) => after(seconds * i / segments.length, () => {
      const from = place(spot, a, scale, o.shift, o.flip, o.lift), to = place(spot, b, scale, o.shift, o.flip, o.lift);
      line(from, to, colour, { count: Math.max(3, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) / 100 * dots)), life, size: o.size ?? 1.3 });
    }));
  }
  const flareAt = (at: V3, colour: string, intensity = 2.4, range = 2.6) => burst('flare', { at, count: 1, spread: .03, life: [.14, .22], colour, light: { intensity, range, colour } });
  /** The way the camera looks back at a spot: what a stamp there faces. */
  const facingOf = (spot: FaceSpot): V3 => ({ x: spot.right.y * spot.up.z - spot.right.z * spot.up.y, y: spot.right.z * spot.up.x - spot.right.x * spot.up.z, z: spot.right.x * spot.up.y - spot.right.y * spot.up.x });
  /** A little crooked, never the same way twice. */
  const askew = (most = 11) => (Math.random() * 2 - 1) * most;
  /**
   * What every stamp throws off as it comes down: a flash, ivory sparks and flakes of paper flung
   * the way the blow goes (`toward` along the screen's right), and what is left of it torn away
   * `tear` seconds later, falling.
   */
  function slap(spot: FaceSpot, toward: number, weight: number, tear: number, colour: string = DICE_COLOURS.ivory) {
    const way = add({ x: 0, y: 0, z: 0 }, spot.right, toward);
    flareAt(spot.centre, colour, 1.6 + weight * 1.2, 2 + weight);
    burst('needle', { at: spot.centre, count: Math.round(26 + 44 * weight), spread: .07, velocity: add(way, spot.up, .25), speed: 2.4 + 2.4 * weight, life: [.22, .5], colour: DICE_COLOURS.ivory });
    burst('shred', { at: spot.centre, count: Math.round(8 + 14 * weight), spread: spot.size * .22, velocity: add(way, spot.up, .9), speed: 1.6 + weight, up: 1.4, life: [.8, 1.4] });
    after(tear, () => burst('shred', { at: add(spot.centre, spot.up, spot.size * .1), count: 16, spread: spot.size * .34, speed: .7, up: .5, life: [.9, 1.5] }));
  }

  const faces: Record<Exclude<DieFace, 'blanco' | 'comodin'>, (spot: FaceSpot, roll?: number) => void> = {
    mano(spot, roll = askew(7)) {
      const c = DICE_COLOURS, toward = -spot.side, size = spot.size * 1.45;
      // A punch: the hand comes in fast from the thrower's side, pointing where it goes…
      stamps?.stamp('mano', add(spot.centre, spot.up, spot.size * .12), size, { roll, flip: toward < 0, from: add({ x: 0, y: 0, z: 0 }, spot.right, -toward * size * .85), start: 1.25, slam: .06, hold: .36, out: .24, fall: .5, spin: toward * 40 });
      // …with the air it cut behind it…
      [-.24, 0, .24].forEach((v, i) => {
        const tail = add(add(spot.centre, spot.up, spot.size * (.12 + v)), spot.right, -toward * size * (1.5 - i % 2 * .25));
        line(tail, add(tail, spot.right, toward * size * .75), c.paper, { count: 40, life: .16, size: 1.7 });
      });
      // …and it lands: the floor takes it.
      after(.05, () => {
        slap(spot, toward * 3.2, 1, .36);
        dualFx.shock(spot.feet, 1.25, c.paper, { chips: 90, light: true });
        dualFx.ring(spot.centre, facingOf(spot), spot.size * .35, c.ivory, { count: 60, outward: 4.5, life: .28, size: 1.6 });
      });
    },
    tijeras(spot, roll = askew()) {
      const c = DICE_COLOURS;
      // Two cuts right across them, whole and at once, one after the other; a red line stays in each.
      const cut = (a: readonly [number, number], b: readonly [number, number]) => {
        draw([[a, b]], spot, c.ivory, { life: .2, scale: 1.7, size: 3.4 });
        draw([[a, b]], spot, c.red, { life: .55, scale: 1.7, size: 1.3 });
        burst('needle', { at: place(spot, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], 1.7), count: 16, spread: .05, velocity: add({ x: 0, y: 0, z: 0 }, spot.right, (b[0] - a[0]) / 30), speed: 3, life: [.18, .4], colour: c.ivory });
      };
      cut([8, 10], [92, 90]);
      after(.07, () => cut([92, 10], [8, 90]));
      // Where they cross, the scissors, and what they cut falls in strips.
      after(.13, () => {
        stamps?.stamp('tijeras', spot.centre, spot.size * 1.2, { roll, start: 1.9, slam: .06, hold: .3, out: .22 });
        slap(spot, 0, .55, .3, c.red);
        burst('scrap', { at: add(spot.centre, spot.up, spot.size * .15), count: 46, spread: spot.size * .34, speed: 1.6, up: 1.3, life: [1.1, 1.8] });
      });
    },
    ojo(spot, roll = askew(6)) {
      const c = DICE_COLOURS, facing = facingOf(spot);
      // The eye, stamped from far above its size, so it reads as something that opens on them…
      stamps?.stamp('ojo', spot.centre, spot.size * 1.4, { roll, start: 2.6, slam: .09, hold: .5, out: .26, fall: .15 });
      after(.07, () => slap(spot, 0, .3, .55));
      // …a ring closing on where it looks…
      [1.5, 1.05].forEach((r, i) => after(.05 + i * .09, () => dualFx.ring(spot.centre, facing, spot.size * r, i ? c.red : c.ivory, { count: 90, outward: -5.5, life: .22, size: 1.7 })));
      // …and the mark it leaves: a red cross where the next blow will go.
      after(.26, () => {
        draw([[[50, 26], [50, 74]], [[26, 50], [74, 50]]], spot, c.red, { life: .85, scale: .5, size: 2.6 });
        burst('twinkle', { at: spot.centre, count: 10, spread: spot.size * .12, speed: .5, life: [.3, .6], colour: c.ivory });
        flareAt(spot.centre, c.red, 1.6, 2);
      });
    },
    corchete(spot) {
      const c = DICE_COLOURS, [left, right] = FACE_STROKES.corchete;
      // From well out on either side, the brackets clap shut round them, and hold just clear of them.
      const scale = 1.15, bar = .28 * spot.size * scale, reach = [1.15, .6, .28].map(k => spot.radius + k);
      reach.forEach((d, i) => after(i * .045, () => {
        const last = i === reach.length - 1, o = { life: last ? 1 : .09, scale, size: last ? 3 : 1.6 };
        draw([left], spot, last ? c.ivory : c.paper, { ...o, shift: -(d - bar) });
        draw([right], spot, last ? c.ivory : c.paper, { ...o, shift: d - bar });
      }));
      after(.1, () => {
        flareAt(spot.centre, c.ivory, 2.2, 2.6);
        // Shut: sparks where each bracket stops, and a ring of paper light on the floor that draws in.
        for (const side of [-1, 1]) burst('needle', { at: add(spot.centre, spot.right, side * (spot.radius + .28)), count: 16, spread: .05, velocity: add({ x: 0, y: 0, z: 0 }, spot.right, -side * 1.5), speed: 1.6, life: [.2, .45], colour: c.ivory });
        dualFx.ring({ ...spot.feet, y: spot.feet.y + .05 }, { x: 0, y: 1, z: 0 }, spot.radius + .45, c.paper, { count: 110, outward: -.5, life: .8, size: 1.5, kind: 'mote' });
        burst('twinkle', { at: spot.centre, count: 12, spread: spot.size * .4, speed: .3, life: [.3, .7], colour: c.ivory });
      });
    },
  };

  return {
    /**
     * A die landing at `spot`, showing `face`, doing `as` (a blank: the face it repeats, slapped
     * over its red frame `delay` later). Returns when the face's own blow lands.
     */
    land(spot: FaceSpot, face: DieFace, as: Exclude<DieFace, 'blanco'>) {
      if (!dualFx.on) return 0;
      if (as === 'comodin') {
        // The black card and its star first, bigger than any face, and a wave along the floor; then the hand it plays as.
        stamps?.stamp('comodin', add(spot.centre, spot.up, spot.size * .35), spot.size * 1.9, { roll: askew(9), start: 2.8, slam: .08, hold: .42, out: .3, fall: .2, spin: 60 });
        after(.06, () => {
          slap(spot, 0, .8, .45, DICE_COLOURS.red);
          dualFx.ring({ ...spot.feet, y: spot.feet.y + .06 }, { x: 0, y: 1, z: 0 }, .5, DICE_COLOURS.red, { count: 140, outward: 7, life: .5, size: 1.8 });
        });
        after(.14, () => faces.mano(spot));
        return .14;
      }
      if (face !== 'blanco') { faces[as](spot); return 0; }
      // A collage: the empty frame one way, what it repeats over it the other.
      const tilt = askew(6) + 9;
      stamps?.stamp('blanco', spot.centre, spot.size * 1.5, { roll: tilt, start: 1.9, slam: .06, hold: .46, out: .24 });
      slap(spot, 0, .35, .5, DICE_COLOURS.red);
      after(.1, () => faces[as](spot, -tilt * .8));
      return .1;
    },
    /**
     * Estrella fugaz landing: the die that paid for it goes out as a star. A four-point flare opens
     * out of nothing, a second one across it, a ring of cold light, and stars thrown off that hang
     * and fall. `given`: dice it deals, each a star that leaves the foe for `hand`.
     */
    star(spot: FaceSpot, given = 0, hand?: V3) {
      if (!dualFx.on) return;
      const c = ASTRAL_COLOURS, facing = facingOf(spot);
      stamps?.stamp('astral', spot.centre, spot.size * 3.1, { start: .15, slam: .07, hold: .05, out: .34, grow: .25, fall: 0, spin: 50 });
      stamps?.stamp('astral', spot.centre, spot.size * 1.7, { roll: 45, start: .15, slam: .09, hold: .08, out: .3, grow: .4, fall: 0, spin: -80 });
      stamps?.stamp('halo', spot.centre, spot.size * 2.4, { start: .2, slam: .22, hold: 0, out: .2, grow: .5, fall: 0, opacity: .8 });
      burst('flare', { at: spot.centre, count: 1, spread: .03, life: [.16, .26], colour: c.ice, light: { intensity: 3.4, range: 3.6, colour: c.ice } });
      dualFx.ring(spot.centre, facing, spot.size * .25, c.core, { count: 90, outward: 6, life: .4, size: 1.7, kind: 'twinkle' });
      effects.emit('astral', spot.centre, 34, spot.size * .45);
      after(.08, () => { effects.emit('astral', add(spot.centre, spot.up, spot.size * .3), 18, spot.size * .7); dualFx.ring({ ...spot.feet, y: spot.feet.y + .06 }, { x: 0, y: 1, z: 0 }, spot.radius + .2, c.ice, { count: 100, outward: 2.4, life: .6, size: 1.4, kind: 'mote' }); });
      // The dice it deals: stars that leave the foe in an arc and reach the hand as the dice drop in.
      if (hand) for (let k = 0; k < given; k++) {
        const lift = 1.1 + k * .5, steps = 12;
        for (let i = 0; i < steps; i++) after(.22 + k * .1 + i * .028, () => {
          const u = i / (steps - 1), at = add(add(spot.centre, { x: hand.x - spot.centre.x, y: hand.y - spot.centre.y, z: hand.z - spot.centre.z }, u), spot.up, Math.sin(u * Math.PI) * lift);
          effects.emit('astral', at, i === steps - 1 ? 10 : 3, i === steps - 1 ? .2 : .05);
        });
      }
    },
    /**
     * A die that is a star on its way down to `spot` (Dados astrales, the meteors): a cube of glass
     * tumbling inside its own light, down a long curve from one side of the sky, landing `fall`
     * seconds from now. Behind it a wide blue wake that stays a while, a white thread inside it, and
     * stars shed all the way. `size`: how big it is (× a die).
     */
    skyFall(spot: FaceSpot, fall = .7, size = .5) {
      if (!dualFx.on) return;
      const c = ASTRAL_COLOURS, side = Math.random() < .5 ? -1 : 1, lean = side * (1.4 + Math.random() * 1.8), high = 8.5, bow = -side * (1.3 + Math.random() * 1.3);
      // Faster all the way down, bowed to one side: it comes round, not straight.
      const path = (u: number): V3 => { const k = 1 - u ** 1.6, bend = Math.sin(Math.min(1, u) * Math.PI) * bow; return add(add(spot.centre, spot.right, lean * k + bend), spot.up, high * k); };
      stamps?.crystal(spot.size * size * .5, fall, path);
      const steps = Math.max(14, Math.round(fall * 40));
      for (let i = 1; i <= steps; i++) after(fall * i / steps, () => {
        const at = path(i / steps), before = path((i - 1) / steps);
        dualFx.line(before, at, c.halo, { count: Math.round(9 + size * 12), life: .55 + size * .2, size: 2.2 + size * 2 });
        dualFx.line(before, at, c.core, { count: Math.round(5 + size * 6), life: .22 + size * .08, size: 1.3 + size });
        effects.emit('astral', at, Math.round(1 + size * 4), .07 + size * .14);
      });
    },
    /** That die landing: it bursts into its star, a halo, spokes of light and a ring of stars along the floor, cold light on whoever is near, and stars that float up. */
    skyLand(spot: FaceSpot, weight = 1) {
      if (!dualFx.on) return;
      const c = ASTRAL_COLOURS, floor = { ...spot.feet, y: spot.feet.y + .06 };
      stamps?.stamp('astral', spot.centre, spot.size * 1.9 * weight, { start: .2, slam: .05, hold: .04, out: .26, grow: .35, fall: 0, roll: Math.random() * 90, spin: 70 });
      stamps?.stamp('halo', spot.centre, spot.size * 1.5 * weight, { start: .25, slam: .16, hold: 0, out: .2, grow: .6, fall: 0, opacity: .75 });
      burst('flare', { at: spot.centre, count: 1, spread: .03, life: [.12, .2], colour: c.core, light: { intensity: 3.2 * weight, range: 3.4 * weight, colour: c.halo } });
      dualFx.ring(floor, { x: 0, y: 1, z: 0 }, spot.radius * .5, c.core, { count: Math.round(36 * weight), outward: 3.6 * weight, life: .4, size: 1.6, kind: 'twinkle' });
      dualFx.ring(floor, { x: 0, y: 1, z: 0 }, spot.radius * .8, c.halo, { count: Math.round(40 * weight), outward: 1.5 * weight, life: .7, size: 1.3, kind: 'mote' });
      // Spokes along the floor, as a star laid flat.
      const turn = Math.random() * Math.PI;
      for (let i = 0; i < 6; i++) { const a = turn + i * Math.PI / 3, reach = (.7 + (i % 2) * .5) * weight; dualFx.line(floor, { x: floor.x + Math.cos(a) * reach, y: floor.y, z: floor.z + Math.sin(a) * reach }, c.ice, { count: 10, life: .3, size: 1.5 }); }
      effects.emit('astral', spot.centre, Math.round(18 * weight), spot.size * .32 * weight);
    },
    /**
     * A rock of light landing (Meteorito, Meteoro, Asteroide: `stage` 0 to 2): the white of it, a halo
     * that opens wide, a ring thrown along the floor, and the stars it throws up, which hang and fall back.
     */
    meteorLand(spot: FaceSpot, stage: number) {
      if (!dualFx.on) return;
      const c = ASTRAL_COLOURS, w = [1, 1.5, 2.4][stage] ?? 1;
      stamps?.stamp('astral', spot.centre, spot.size * 2.4 * w, { start: .12, slam: .06, hold: .06, out: .36, grow: .3, fall: 0, spin: 40 });
      stamps?.stamp('astral', spot.centre, spot.size * 1.4 * w, { roll: 45, start: .12, slam: .08, hold: .08, out: .3, grow: .45, fall: 0, spin: -70 });
      stamps?.stamp('halo', spot.centre, spot.size * 2 * w, { start: .2, slam: .2, hold: 0, out: .26, grow: .7, fall: 0, opacity: .85 });
      burst('flare', { at: spot.centre, count: 1, spread: .03, life: [.18, .3], colour: c.core, light: { intensity: 3 + stage * 1.6, range: 3.4 + stage * 2, colour: c.ice } });
      dualFx.ring({ ...spot.feet, y: spot.feet.y + .06 }, { x: 0, y: 1, z: 0 }, spot.radius + .1, c.core, { count: Math.round(90 * w), outward: 4.5 * w, life: .5, size: 1.8, kind: 'twinkle' });
      if (stage) dualFx.ring({ ...spot.feet, y: spot.feet.y + .08 }, { x: 0, y: 1, z: 0 }, spot.radius + .3, c.halo, { count: Math.round(80 * w), outward: 2.2 * w, life: .8, size: 1.4, kind: 'mote' });
      effects.emit('astral', spot.centre, Math.round(30 * w), spot.size * .5 * w);
      // What it threw up comes back down for a moment.
      for (let i = 1; i <= 2 + stage * 2; i++) after(.12 * i, () => effects.emit('astral', add(spot.centre, spot.up, spot.size * (.5 + i * .22)), Math.round(8 * w), spot.size * (.5 + i * .15) * w));
    },
    /**
     * Ases en dúo: two dice that are stars circle each other once over `top`, joined by a
     * thin line of stars, for `seconds`.
     */
    aces(top: V3, right: V3, up: V3, seconds = .5) {
      if (!dualFx.on) return;
      const c = ASTRAL_COLOURS, steps = 16, wide = .55;
      const at = (k: number, side: number): V3 => { const a = k * Math.PI * 2; return add(add(top, right, Math.cos(a) * wide * side), up, Math.sin(a) * wide * .45 * side); };
      for (const side of [-1, 1]) stamps?.crystal(.3, seconds, u => at(u, side));
      for (let i = 0; i <= steps; i++) after(seconds * i / steps, () => {
        const a = at(i / steps, 1), b = at(i / steps, -1);
        effects.emit('astral', a, 3, .05); effects.emit('astral', b, 3, .05);
        dualFx.line(a, b, c.ice, { count: 12, life: .16, size: 1.5 });
      });
    },
    /** …and they come apart into a shower that falls on `spot`: stars from over their head down to their feet, and a ring where they stand. */
    shower(spot: FaceSpot, from: V3) {
      if (!dualFx.on) return;
      const c = ASTRAL_COLOURS, steps = 10;
      for (let i = 0; i <= steps; i++) after(.04 * i, () => {
        const u = i / steps, at: V3 = { x: from.x + (spot.centre.x - from.x) * u, y: from.y + (spot.feet.y - from.y) * u * u, z: from.z + (spot.centre.z - from.z) * u };
        effects.emit('astral', at, 5, .12 + u * .25);
      });
      after(.3, () => {
        stamps?.stamp('halo', spot.centre, spot.size * 1.5, { start: .3, slam: .2, hold: .05, out: .3, grow: .4, fall: 0, opacity: .7 });
        dualFx.ring({ ...spot.feet, y: spot.feet.y + .06 }, { x: 0, y: 1, z: 0 }, spot.radius + .1, c.ice, { count: 70, outward: 1.6, life: .7, size: 1.4, kind: 'twinkle' });
        effects.emit('astral', add(spot.centre, spot.up, spot.size * .2), 16, spot.size * .4);
      });
    },
  };
}
