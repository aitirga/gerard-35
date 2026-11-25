import { clamp01, smooth } from './battle-motion';
import type { Effects } from './effects';
import type { GpuEmitter, GpuKind, GpuLattice } from './fight-particles';
import { AGUA_KINDS } from './freatica-fx';
import { ensureFluidKinds } from './fluid-fx';
import { catenoidHeight, catenoidRadius } from './lattice';
import { FIGURE_LOOKS, neonCircle, type MathFigures, type NeonFigure } from './math-figures';
import type { SoundId } from './sfx';

/**
 * Superficie mínima (docs/animas/matemagico/README.md § Superficie mínima): Matemágico's first guard.
 *
 * - **Cast.** In his circle he draws two coaxial gold rings with his pen of light and pulls them apart: a soap
 *   film forms between them, a catenoid (r(z) = a·cosh(z/a), its waist `a`), and while they part it stays the
 *   true minimal surface (`catenoidHeight`). Then the rings fly to the ally, one to the ankles and one over the
 *   head, and the film stretches between them into an hourglass sleeve. Never a sphere: a bubble is La Pompa's.
 * - **Held.** Its colours are thin-film interference (the lattice's `film` look): gold, white, cyan and teal
 *   water blue, never magenta or violet, draining down and swirling. Its members are mostly laid over, little
 *   added, so its front and back can never sum to lilac. It follows the ally until the round ends.
 * - **A blow through it** (`burst`): capillary ripples where it lands, then it bursts as a soap film does, its
 *   rim running back from the hole and shedding drops that fly at the striker as water. The rings stay (the
 *   guard does, to the round's end), a faint water light between them until a new film draws there.
 * - **The round over, no blow** (`keep`): it thins to black film from the top, its colours going out, and the
 *   last of it comes apart in a few motes; the rings dim with it.
 *
 * Everything that moves is particles on the GPU fight engine (one lattice each) and two neon tubes; the CPU
 * only places two rings and the film's axis each frame. Runs on the fight's clock (`update`).
 */
type V3 = { x: number; y: number; z: number };
/** Where the ally stands now (their feet, on the floor) and how big they are (taken once, at the cast). */
export interface FilmBody { feet: V3; height: number; radius: number }

/**
 * The film's colours (src/lattice.ts `film`): the rings his gold (neon tubes, gold to the core; only his pen's tip is
 * white), a water-blue light. Its lattice is untinted: the film's colour is its thickness, and what it sheds is plain
 * water ('fluido-agua'), never the film's own colour. Never pink or violet.
 */
const GOLD = FIGURE_LOOKS.gold, RING = { core: '#f3cf78', halo: '#e0a440' }, WATER = '#bfeee8', TINT = '#ffffff';
/**
 * Its members: soft, wide glows that merge with their neighbours into one sheet. Mostly laid over the fight (little
 * added light), so where its front and back cross they do not sum (gold over teal would add up to lilac).
 */
const MEMBER = 'pelicula-jabon';
const MEMBER_KIND: GpuKind = {
  blur: .9, drag: .3, gravity: 0, curl: .05, response: 1, size: [.06, .055], sizeJitter: .15, shape: 'glow',
  colours: ['#ffffff', '#ffffff', '#ffffff'], intensity: [1.25, 1.15, .8], middle: .5, fadeIn: .1, fadeOut: .25, additive: .3, opacity: .34, core: 0,
};
/** Drops of Freática's water, thrown with the burst at whoever struck; beads of its light between the rings while a new film forms. */
const DROP = 'agua-gota', BEAD = 'agua-traza';
/**
 * Its moments, from when the figure starts drawing (`CAST_LAUNCH` into the action): the rings drawn, pulled
 * apart (the film forms), flown to the ally; `SETTLE` is the skill's contact (FIGURES['superficie-minima']).
 */
const DRAW = .3, PART = .26, FLY = .44, SETTLE = DRAW + PART + FLY;
/**
 * In his circle: the rings' radius, and where the figure stands from the circle's middle: towards the camera and only a
 * little up, before his chest, clear of what hangs over his head (his plate, a thought).
 */
const SMALL = .4, AHEAD = .7, LIFT = .05;
/** The rings' tube (in a ring's own radius: its scale) and how many points round. */
const TUBE = .085, ROUND = 64;
/**
 * How far the rings sit past their feet and at their head (the top ring stays under their plate), and past their body
 * round them; the waist's share of a ring.
 */
const ANKLE = .06, OVER = .02, ROOM = .3, WAIST = .55;
/** The film's lattice (`gpu.lattice`): cells round × along, as many as a lattice holds (MAX_MEMBERS, 8192); its wide members merge into one sheet. */
const GRID: [number, number, number] = [128, 64, 1];
/** How long the film takes to thin out at the round's end, and when its ally falls. */
const FADE = .9, QUICK = .45;

const add = (a: V3, b: V3, k = 1): V3 => ({ x: a.x + b.x * k, y: a.y + b.y * k, z: a.z + b.z * k });
/** `add` into `out` (no new object: what runs every frame). */
const addTo = (out: V3, a: V3, b: V3, k = 1): V3 => { out.x = a.x + b.x * k; out.y = a.y + b.y * k; out.z = a.z + b.z * k; return out; };
const sub = (a: V3, b: V3): V3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const mix = (a: V3, b: V3, k: number): V3 => ({ x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, z: a.z + (b.z - a.z) * k });
const norm = (a: V3): V3 => { const d = Math.hypot(a.x, a.y, a.z) || 1; return { x: a.x / d, y: a.y / d, z: a.z / d }; };
const cross = (a: V3, b: V3): V3 => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });
const UP: V3 = { x: 0, y: 1, z: 0 };

interface Film {
  /** The rings (each a figure of its own, so each moves on its own) and the film between them. */
  rings: [NeonFigure, NeonFigure];
  lattice?: GpuLattice;
  /** Lattices that burst and are still shedding their drops, with the seconds until they go. */
  bursting: { lattice: GpuLattice; left: number }[];
  body: () => FilmBody | undefined;
  /** Where it was drawn (his circle), and the way to the camera then. */
  from: V3; facing: V3;
  phase: 'cast' | 'hold' | 'fade';
  /** Burst and waiting to form again: a faint water light between the rings, so the guard reads as held. */
  glint?: GpuEmitter;
  /** Seconds in this phase; the film's thickness now and where it is going. */
  t: number; thickness: number; grow: number;
  /** A flash on the rings (0–1), dying away: as it settles, as a blow bursts it, as a new film forms. */
  flash: number;
  /** The rings' centres, radius and the film's waist now (world). */
  low: V3; high: V3; ring: number; waist: number;
  size: number;
}

export function createFilmFx(o: { effects: Effects; figures: MathFigures; cue: (id: SoundId, options?: { delay?: number; volume?: number }) => void }) {
  const gpu = () => o.effects.gpu && o.effects.gpu.active ? o.effects.gpu : undefined;
  const films = new Map<string, Film>();
  /** What happens a moment from now, on the fight's clock. */
  const later: { left: number; run: () => void }[] = [];
  /** Scratch: where a held film's rings go this frame. */
  const want = { low: { x: 0, y: 0, z: 0 }, high: { x: 0, y: 0, z: 0 }, ring: 0, waist: 0 };

  /** A new film between the rings, as thin as nothing: its thickness comes up as it forms (`grow`). */
  function spread(f: Film) {
    const g = gpu();
    if (!g) return undefined;
    ensureFluidKinds(g);
    if (!g.get(MEMBER)) g.define(MEMBER, MEMBER_KIND);
    return g.lattice(MEMBER, {
      grid: GRID, size: { x: f.ring, y: .02, z: f.waist }, shape: 'catenoid', life: 7, hold: .4, colour: TINT,
      rigidity: 220, bonds: 150, damping: 8, viscosity: 2, glow: .45, rim: 1.4, hitRadius: .09, transfer: .35, bounce: .2,
      film: true, thickness: 0, drain: .55, swirl: .7, fresnel: .55, flow: 1.2, wave: { height: .008, length: .45, speed: .5 },
      between: [f.low, f.high], light: { intensity: 1.1, range: 2.4, colour: WATER },
    });
  }
  /** One gold ring of light, a unit circle the figure's `scale` sizes; hidden until drawn. */
  function ring(name: string) {
    const fig = o.figures.neon(name, RING, { at: { x: 0, y: -50, z: 0 } });
    const stroke = fig.stroke(neonCircle(1, ROUND), { radius: TUBE });
    return { fig, stroke };
  }
  /** Where its rings sit on the ally (into `out`): on the floor round their ankles and at their head, as wide as they are with room. */
  function onBody(b: FilmBody, size: number, out: typeof want) {
    out.ring = (b.radius + ROOM) * size; out.waist = out.ring * WAIST;
    addTo(out.low, b.feet, UP, ANKLE); addTo(out.high, b.feet, UP, b.height + OVER);
    return out;
  }
  /** Lays the film along its rings, as they are now. */
  function lay(f: Film) {
    if (!f.lattice?.alive) return;
    f.lattice.span(f.low, f.high);
    f.lattice.size.x = f.ring; f.lattice.size.z = f.waist;
    f.lattice.thickness = f.thickness;
    // Small in his circle its members crowd and add up to white: thinner the closer they are.
    f.lattice.opacity = Math.min(1, Math.max(.3, f.ring / .65));
  }
  /** Both rings laid round `axis`, at the film's two ends, its radius across. */
  function placeRings(f: Film, axis: V3) {
    const side = Math.abs(axis.y) > .95 ? { x: 1, y: 0, z: 0 } : norm(cross(UP, axis)), up = norm(cross(axis, side));
    f.rings[0].place({ at: f.low, facing: axis, up, scale: f.ring });
    f.rings[1].place({ at: f.high, facing: axis, up, scale: f.ring });
  }
  /** The water light between the rings while a burst film forms again, gone when it has. */
  function unglint(f: Film) { f.glint?.remove(); f.glint = undefined; }
  /** It goes: the film (if any is left) and the rings, at once. */
  function drop(id: string) {
    const f = films.get(id);
    if (!f) return;
    films.delete(id);
    unglint(f);
    f.lattice?.remove();
    f.bursting.forEach(b => b.lattice.remove());
    f.rings.forEach(r => r.destroy());
  }
  /** Thins to black film from the top at once and comes apart in motes; the rings dim with it. */
  function fade(f: Film, quick = false) {
    if (f.phase === 'fade') return;
    f.phase = 'fade'; f.t = 0;
    const seconds = quick ? QUICK : FADE;
    f.rings.forEach(r => r.fade(seconds * .7, seconds * .3));
    f.grow = seconds;
    unglint(f);
  }

  return {
    /**
     * Draws it (`centre`: the middle of his circle, `facing` the way to the camera) and flies it to whoever it
     * protects (`id`, where `body` says they are). It lands at SETTLE seconds, the skill's contact.
     */
    cast(id: string, c: { centre: V3; facing: V3; body: () => FilmBody | undefined; size?: number }) {
      drop(id);
      const size = c.size ?? 1, flat = norm({ x: c.facing.x, y: 0, z: c.facing.z });
      const from = { x: c.centre.x + flat.x * AHEAD * size, y: c.centre.y + LIFT, z: c.centre.z + flat.z * AHEAD * size };
      const a = ring('Superficie mínima · anillo'), b = ring('Superficie mínima · anillo');
      const f: Film = {
        rings: [a.fig, b.fig], bursting: [], body: c.body, from, facing: c.facing, phase: 'cast', t: 0, thickness: 0, grow: 0, flash: 0,
        low: from, high: from, ring: SMALL * size, waist: SMALL * size, size,
      };
      films.set(id, f);
      placeRings(f, tilted(f));
      // His pen draws the lower ring, then the upper one over it.
      o.figures.drawNeon(a.fig, [a.stroke], DRAW / 2, { colour: GOLD.core });
      o.figures.drawNeon(b.fig, [b.stroke], DRAW / 2, { delay: DRAW / 2, colour: GOLD.core });
    },
    /**
     * A blow from `striker` (its chest) reached whoever `id` protects: ripples where it lands, then it bursts there
     * and its drops fly at the striker. The rings stay, and a new film forms between them. A film already thinning
     * out (its ally fell to this very blow) bursts all the same, and goes on going.
     */
    burst(id: string, striker: V3) {
      const f = films.get(id), g = gpu();
      if (!f) return;
      const old = f.lattice;
      if (!old?.alive || !g) return;
      // Where the blow meets it: on the side facing the striker, a little over its middle.
      const mid = mix(f.low, f.high, .55), out = norm({ x: striker.x - mid.x, y: 0, z: striker.z - mid.z });
      const r = catenoidRadius(.1, f.ring, f.waist), at = add(mid, out, r);
      old.ripple(at, { height: .04, length: .13, speed: 1.4, decay: .7 });
      old.breakInto = 'fluido-agua'; old.dissolve = 0;
      const crossing = old.rupture(at, { speed: 2.6, rim: .06, shed: .14, fling: 2.4 });
      old.throwAt([{ at: striker, radius: .35 }], { speed: 9, steer: 8, arc: .35, blast: 1.5 });
      f.bursting.push({ lattice: old, left: crossing + .5 });
      f.lattice = undefined; f.thickness = 0;
      g.burst('bloom', { at, count: 1, spread: .03, life: [.12, .2], colour: '#eaf8ff', size: 1.1, light: { intensity: 3.5, range: 3, colour: WATER } });
      g.burst('spark', { at, count: 40, spread: .05, speed: 2.4, up: .6, life: [.15, .35], colour: '#dff8ff' });
      // Its water, flung at whoever struck in a jet that arcs over to them, and splashing on them as it gets there.
      if (!g.get(DROP)) g.define(DROP, AGUA_KINDS[DROP] as GpuKind);
      const to = sub(striker, at), far = Math.hypot(to.x, to.y, to.z), way = norm(to), speed = 6, flight = far / speed;
      // Up enough to come down on them: half of what gravity takes off over the flight.
      const rise = 9 * flight * .5;
      g.burst(DROP, { at, count: 320, spread: .12, velocity: { x: way.x * speed, y: way.y * speed + rise, z: way.z * speed }, speed: .9, cone: .18, life: [flight + .15, flight + .5], size: 1.5 });
      g.burst(DROP, { at, count: 140, spread: .08, velocity: { x: way.x * speed * .8, y: way.y * speed * .8 + rise * .8, z: way.z * speed * .8 }, speed: .6, cone: .12, life: [flight + .2, flight + .55], size: 1.1 });
      later.push({ left: flight, run: () => {
        g.burst(DROP, { at: striker, count: 220, shape: 'ring', spread: .3, outward: 2.6, up: 2.2, speed: 1.2, life: [.35, .75], size: 1.4 });
        g.burst('fluido-agua', { at: striker, count: 260, spread: .22, speed: 1.2, up: .5, life: [.8, 1.2] });
        g.burst('bloom', { at: striker, count: 1, spread: .05, life: [.12, .22], colour: WATER, size: 1.2, light: { intensity: 3, range: 2.6, colour: WATER } });
      } });
      f.flash = 1;
      o.cue('film-pop'); o.cue('splash', { delay: .18, volume: .7 });
      if (f.phase === 'fade') return;
      // A new film between the rings, once the old one's rim has crossed: the guard holds to the round's end, and a
      // faint water light stays between them till then.
      f.grow = -(crossing + .1);
      unglint(f);
      if (!g.get(BEAD)) g.define(BEAD, AGUA_KINDS[BEAD] as GpuKind);
      const middle = mix(f.low, f.high, .5);
      g.burst('bloom', { at: middle, count: 1, spread: .02, life: [crossing + .4, crossing + .5], colour: WATER, size: .6, light: { intensity: .9, range: 2.2, colour: WATER } });
      f.glint = g.emitter(BEAD, { at: middle, rate: 70, shape: 'ring', axis: UP, spread: f.waist, life: [.25, .45], speed: .05, up: .35, size: .8 });
    },
    /**
     * Every film whose ally is no longer under one (the round is over, or they fell) fades; `down` ones at once. A film
     * in `held` (the blow playing now will burst it) waits for its burst first, even if that blow brings its ally down.
     */
    keep(ids: readonly string[], down: readonly string[] = [], held: readonly string[] = []) {
      for (const [id, f] of films) if (!held.includes(id) && (!ids.includes(id) || down.includes(id))) fade(f, down.includes(id));
    },
    /** How many films there are (none: nothing to keep). */
    get active() { return films.size; },
    /** Runs them on: `dt` fight seconds. */
    update(dt: number) {
      for (let i = 0; i < later.length; i++) { later[i].left -= dt; if (later[i].left <= 0) { later.splice(i--, 1)[0].run(); } }
      for (const [id, f] of films) {
        f.t += dt;
        for (let i = f.bursting.length - 1; i >= 0; i--) {
          const b = f.bursting[i];
          b.left -= dt;
          if (b.left <= 0) { b.lattice.remove(); f.bursting.splice(i, 1); }
        }
        const b = f.body();
        if (f.phase === 'cast') castStep(f, b);
        else if (b) {
          onBody(b, f.size, want);
          if (f.low === f.from || f.high === f.from) { f.low = { ...want.low }; f.high = { ...want.high }; }
          addTo(f.low, want.low, UP, 0); addTo(f.high, want.high, UP, Math.sin(f.t * 2.1) * .015);
          f.ring = want.ring; f.waist = want.waist * (1 + .025 * Math.sin(f.t * 1.4));
          placeRings(f, UP);
        }
        if (f.phase === 'hold') {
          // A film burst: the new one forms once its time comes.
          if (f.grow < 0) { f.grow += dt; if (f.grow >= 0) { f.lattice = spread(f); f.thickness = 0; f.flash = Math.max(f.flash, .5); unglint(f); } }
          else f.thickness = Math.min(1, f.thickness + dt / .45);
          if (f.glint) addTo(f.glint.at, f.low, sub(f.high, f.low), .5);
          // Burst and not yet formed again, the rings stay a little lit: the guard is still up.
          f.flash = Math.max(f.grow < 0 ? .3 : 0, f.flash - dt * 2.5);
          f.rings.forEach(r => r.glow(1, f.flash));
        }
        if (f.phase === 'fade') {
          const k = clamp01(f.t / f.grow);
          if (f.lattice?.alive) {
            // Thinning from the first moment (eased out: fast at first), as it drains down.
            f.lattice.drain = .55 + .45 * clamp01(k / .5);
            f.thickness = Math.min(f.thickness, (1 - clamp01(k / .75)) ** 1.6);
            if (k > .7) { f.lattice.breakInto = 'mote'; f.lattice.shed = .03; f.lattice.dissolve = smooth((k - .7) / .3); }
          }
          if (k >= 1 && !f.bursting.length) { drop(id); continue; }
        }
        lay(f);
      }
    },
    /** Nothing left of any (a fight ending). */
    clear() { later.length = 0; [...films.keys()].forEach(drop); },
  };

  /** The rings' axis in his circle: tipped a little towards the camera, so they read as rings, not lines. */
  function tilted(f: Film) { return norm(add(UP, norm({ x: f.facing.x, y: 0, z: f.facing.z }), .55)); }
  /** Drawn, pulled apart, flown to the ally: where everything is `f.t` seconds into the figure. */
  function castStep(f: Film, body: FilmBody | undefined) {
    const t = f.t, small = SMALL * f.size, tilt = tilted(f);
    if (t < DRAW + PART) {
      // Pulled apart along their axis: the film between them stays a real minimal surface, its waist
      // narrowing as they part (a·cosh(z/a) reaching both rings).
      const k = smooth((t - DRAW) / PART), neck = small * (1 - .3 * k), h = t < DRAW ? .004 : Math.max(.004, catenoidHeight(small, neck) * k ** .5);
      f.low = add(f.from, tilt, -h); f.high = add(f.from, tilt, h); f.ring = small; f.waist = neck;
      if (t >= DRAW && !f.lattice && !f.bursting.length) { f.lattice = spread(f); f.thickness = 0; }
      f.thickness = smooth((t - DRAW) / (PART * .8));
      placeRings(f, tilt);
      return;
    }
    // They fly to the ally: the lower ring to the ankles, the upper over the head, the film stretching between.
    const k = smooth((t - DRAW - PART) / FLY), lift = Math.sin(k * Math.PI) * .45;
    const neck = small * .7, h = catenoidHeight(small, neck);
    const startLow = add(f.from, tilt, -h), startHigh = add(f.from, tilt, h);
    const to = body ? onBody(body, f.size, want) : { low: startLow, high: startHigh, ring: small, waist: neck };
    // The upper ring leads a hair, so the sleeve opens as it goes.
    const kl = smooth((t - DRAW - PART - .05) / (FLY - .05)), kh = k;
    f.low = add(mix(startLow, to.low, kl), UP, lift); f.high = add(mix(startHigh, to.high, kh), UP, lift);
    f.ring = small + (to.ring - small) * k; f.waist = neck + (to.waist - neck) * k;
    f.thickness = 1;
    placeRings(f, norm(mix(tilt, UP, k)));
    if (t >= SETTLE) {
      f.phase = 'hold'; f.t = 0; f.flash = 1;
      // It settles round them: a ripple runs round the sleeve from its waist, and a glint of water light.
      const g = gpu(), mid = mix(f.low, f.high, .5);
      f.lattice?.ripple(add(mid, norm(f.facing), f.waist), { height: .03, length: .16, speed: 1.2, decay: .9 });
      g?.burst('bloom', { at: mid, count: 1, spread: .05, life: [.18, .28], colour: WATER, size: 1.4, light: { intensity: 2.4, range: 3, colour: WATER } });
    }
  }
}
export type FilmFx = ReturnType<typeof createFilmFx>;
