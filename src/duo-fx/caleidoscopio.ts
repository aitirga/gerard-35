import type { BattleEffect } from '../battle';
import { CONTACT_SECONDS } from '../battle-motion';
import type { V3 } from '../dual-fx';
import type { GpuKind } from '../fight-particles';
import type { DuoFighter, DuoStage, DuoStaging } from './types';

/**
 * Caleidoscopio (dúo mayor: Tecnópata's Escudo de bits + Colorista's Telón), a dome of mirrors.
 * Bip throws its cyan bits up in twelve threads round the party, evenly, as the spokes of a
 * kaleidoscope; Colorista throws a handful of blue pigment up into them, and it hangs as matte powder
 * along the shell. A rosette of mirrors is laid on the floor inside the rim (twelve spokes and a
 * twelve-pointed star), and the dome is drawn as panes, band by band from the rim to the top, a
 * triangle each, with glass glinting in them. When it closes the panes flash and the bit dome takes
 * them. While it stands, three panes at a time catch the light in turn, a third of the way round from
 * each other, so the reflections turn slowly round it. A foe's blow it stops comes back: where it met
 * the shell a little rosette opens facing the striker, and a fan of mirror shards, mirrored above and
 * below, flies back at it and goes to blue powder on it.
 */
const C = { cyan: '#4fe0ff', blue: '#617ce2', deep: '#3d5fe0', mirror: '#a9bfff', white: '#ffffff' } as const;
const CONTACT = 1.0, END = 2.1;
/** Panes round the dome, and the heights (radians) of its bands from the rim up. */
const N = 12, BANDS = [0, .42, .85, 1.22] as const;

/** A pane of mirror: a flat diamond of glass that turns slowly and glints. */
const PANE: GpuKind = {
  shape: 'shard', stretch: 0, spin: 140, glass: .55, drag: 2.5, gravity: 0, curl: .02, response: 0, size: [.09, .065], sizeJitter: .3,
  colours: ['#ffffff', '#ffffff', '#ffffff'], intensity: [1.7, 1.25, .7], middle: .4, fadeIn: .08, fadeOut: .45, additive: .6, opacity: .85, flicker: .3,
};
/** The panes' edges: dots of light that stay put, dimmer than a dual's glyphs so their cyan and blue still read. */
const EDGE: GpuKind = {
  shape: 'dot', drag: 14, gravity: 0, curl: 0, response: 0, size: [.022, .015], sizeJitter: .2,
  colours: ['#ffffff', '#ffffff', '#ffffff'], intensity: [2.4, 1.8, 1.1], middle: .45, fadeIn: .05, fadeOut: .35, additive: 1, flicker: .12, core: .25,
};
/** A mirror shard flung back at a striker: glass, spinning, and powder where it ends. */
const SHARD: GpuKind = {
  shape: 'shard', drag: .3, gravity: 1.5, curl: .05, response: .2, collide: true, bounce: .25, friction: .5, size: [.06, .035], sizeJitter: .5, stretch: .02, spin: 540,
  colours: ['#ffffff', '#ffffff', '#ffffff'], intensity: [3.4, 2.2, 1.2], middle: .3, fadeOut: .25, additive: .6, glass: .35,
};

const UP: V3 = { x: 0, y: 1, z: 0 };
const add = (a: V3, b: V3, k = 1): V3 => ({ x: a.x + b.x * k, y: a.y + b.y * k, z: a.z + b.z * k });
const sub = (a: V3, b: V3): V3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const mix = (a: V3, b: V3, k: number): V3 => ({ x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, z: a.z + (b.z - a.z) * k });
const norm = (v: V3): V3 => { const d = Math.hypot(v.x, v.y, v.z) || 1; return { x: v.x / d, y: v.y / d, z: v.z / d }; };
const avg = (...p: V3[]): V3 => p.reduce((s, q) => add(s, q, 1 / p.length), { x: 0, y: 0, z: 0 });

function kind(stage: DuoStage, name: string, def: GpuKind, fallback: string) {
  const g = stage.effects.gpu;
  if (!g) return fallback;
  try { if (!g.get(name)) g.define(name, def); return name; } catch { return fallback; }
}
const has = (stage: DuoStage, name: string) => !!stage.effects.gpu?.get(name);

/** The dome as the scene raises it over the party (battle-scene `domeOverParty`): its floor's middle, how wide and how high. */
function domeOf(stage: DuoStage, party: readonly DuoFighter[]) {
  if (!party.length) return undefined;
  const mid = avg(...party.map(f => f.feet));
  const radius = Math.max(1.5, Math.max(...party.map(f => Math.hypot(f.feet.x - mid.x, f.feet.z - mid.z) + f.radius)) + .75);
  const height = Math.max(radius * .7, Math.max(...party.map(f => f.height)) + .45);
  const base = { x: mid.x, y: stage.ground(mid.x, mid.z), z: mid.z };
  /** A point on its shell, `a` round and `e` up (radians), a little outside it. */
  const at = (a: number, e: number, out = 1.02): V3 => ({ x: base.x + Math.cos(e) * Math.cos(a) * radius * out, y: base.y + Math.sin(e) * height * out, z: base.z + Math.cos(e) * Math.sin(a) * radius * out });
  /** Band `j`'s `k`-th corner: each band sits half a pane round from the one under it, so they make triangles. */
  const corner = (j: number, k: number) => j >= BANDS.length ? { x: base.x, y: base.y + height * 1.02, z: base.z } : at((k + j * .5) / N * Math.PI * 2, BANDS[j]);
  /** The middle of the pane pointing up in column `k` of band `j`, and of the one pointing down beside it. */
  const pane = (j: number, k: number, down = false) => down ? avg(corner(j + 1, k), corner(j + 1, k + 1), corner(j, k + 1)) : avg(corner(j, k), corner(j, k + 1), corner(j + 1, k));
  /** Where the way from `from` to `to` first meets its shell (effects.bitDome's `entry`), its top if it never does. */
  const entry = (from: V3, to: V3): V3 => {
    const sy = radius / Math.max(height, .01), f = { x: (from.x - base.x) / radius, y: (from.y - base.y) * sy / radius, z: (from.z - base.z) / radius };
    const d = { x: (to.x - from.x) / radius, y: (to.y - from.y) * sy / radius, z: (to.z - from.z) / radius };
    const a = d.x * d.x + d.y * d.y + d.z * d.z, b = 2 * (f.x * d.x + f.y * d.y + f.z * d.z), c = f.x * f.x + f.y * f.y + f.z * f.z - 1, disc = b * b - 4 * a * c;
    const t = disc >= 0 && a > 1e-9 ? (-b - Math.sqrt(disc)) / (2 * a) : -1;
    if (t < 0 || t > 1) return { x: base.x, y: base.y + height, z: base.z };
    const p = mix(from, to, t);
    return { ...p, y: Math.max(base.y + .15, p.y) };
  };
  return { base, radius, height, at, corner, pane, entry, top: { x: base.x, y: base.y + height, z: base.z } };
}
type Dome = NonNullable<ReturnType<typeof domeOf>>;
/** A pane's colour: mirrored round the dome (each column the mirror of the next) and between up and down. */
const paneColour = (k: number, down: boolean) => ((k % 2 === 0) !== down ? C.cyan : C.blue);

/** Draws the panes' edges of band `j` (the triangles between it and the band over it), spread over a few frames. */
function drawBand(stage: DuoStage, d: Dome, j: number, start: number, life: number, colour: string = C.mirror) {
  const fx = stage.fx, top = j + 1 >= BANDS.length, kindOf = kind(stage, 'caleidoscopio-edge', EDGE, 'glyph');
  for (let k = 0; k < N; k++) fx.after(start + k * .006, () => {
    const a = d.corner(j, k), b = d.corner(j, k + 1), c = d.corner(j + 1, k);
    const n = (p: V3, q: V3) => Math.max(4, Math.round(Math.hypot(p.x - q.x, p.y - q.y, p.z - q.z) * 20));
    // The rims in the mirrors' pale blue; the slants cyan one way and blue the other, so each column is the mirror of the next.
    const lit = colour !== C.mirror, size = lit ? 1.1 : 1;
    if (j > 0 || lit) fx.line(a, b, colour, { count: n(a, b), life, size, kind: kindOf });
    fx.line(a, c, lit ? colour : k % 2 ? C.blue : C.cyan, { count: n(a, c), life, size, kind: kindOf });
    if (!top) fx.line(b, c, lit ? colour : k % 2 ? C.cyan : C.blue, { count: n(b, c), life, size, kind: kindOf });
  });
}

let clock = 0, startedAt = -99, due = 0, step = 0;

export const staging: DuoStaging = {
  timing: { contact: CONTACT, end: END },
  start(stage, _e, reached) {
    const fx = stage.fx;
    startedAt = clock;
    if (!fx.on) return;
    const party = reached.length ? reached : stage.party(), d = domeOf(stage, party);
    if (!d) return;
    const pane = kind(stage, 'caleidoscopio-pane', PANE, 'facet');
    const floor = { ...d.base, y: d.base.y + .05 };

    // ── Bip: twelve threads of bits up round the party, evenly, the kaleidoscope's spokes. ──
    const tech = stage.wearer('tecnopata'), bip = stage.bip() ?? (tech ? add(tech.chest, UP, .6) : add(d.top, UP, .5));
    for (let k = 0; k < N; k++) {
      const to = d.corner(1, k);
      stage.effects.trails.comet(bip, to, ['#ffffff', C.cyan], .28, { arc: .6, width: .035, life: .35, intensity: 2.6, core: .5, delay: .02 + (k % 6) * .02 });
      fx.after(.3 + (k % 6) * .02, () => fx.burst('nanite', { at: to, count: 8, spread: .05, speed: .6, life: [.3, .5], colour: C.cyan }));
    }
    fx.burst('bipzap', { at: bip, count: 30, spread: .1, speed: 2.2, life: [.2, .4] });

    // ── Colorista: a handful of blue thrown up into them, hanging as matte powder on the shell. ──
    const painter = stage.wearer('prismatico');
    if (painter) {
      const to = d.at(0, 1.1, .8), v = sub(to, painter.chest), t = .26;
      fx.after(.08, () => fx.burst('paintthrow', { at: painter.chest, count: 70, spread: .08, velocity: { x: v.x / t, y: v.y / t + 1.2, z: v.z / t }, speed: .8, cone: .08, life: [t, t * 1.1], colour: C.deep }));
    }
    const pigment = has(stage, 'pigment') ? 'pigment' : 'brush', grain = has(stage, 'grain') ? 'grain' : 'fleck';
    fx.after(.36, () => {
      for (const [e, colour] of [[.55, C.deep], [.95, C.blue]] as const) {
        const ring = { ...d.base, y: d.base.y + Math.sin(e) * d.height };
        fx.burst(pigment, { at: ring, shape: 'ring', spread: Math.cos(e) * d.radius, count: 70, around: .5, speed: .25, life: [1, 1.5], colour, size: .7 });
      }
      fx.burst(grain, { at: { ...d.base, y: d.base.y + d.height * .7 }, shape: 'ring', spread: d.radius * .75, count: 90, speed: .3, life: [1.2, 2], colour: C.blue });
    });

    // ── The rosette on the floor: twelve spokes, and a twelve-pointed star through the rim. ──
    const rim = (k: number, r = 1) => ({ x: floor.x + Math.cos(k / N * Math.PI * 2) * d.radius * r, y: floor.y, z: floor.z + Math.sin(k / N * Math.PI * 2) * d.radius * r });
    for (let k = 0; k < N; k++) {
      fx.after(.22 + k * .012, () => fx.line(floor, rim(k, .98), k % 2 ? C.blue : C.cyan, { count: Math.round(d.radius * 22), life: CONTACT + .55 - .22, size: 1.3 }));
      fx.after(.42 + k * .012, () => fx.line(rim(k, .98), rim(k + 5, .98), C.mirror, { count: Math.round(d.radius * 30), life: CONTACT + .45 - .42, size: 1.1 }));
    }
    fx.after(.3, () => fx.ring(floor, UP, d.radius, C.cyan, { count: Math.round(d.radius * 90), life: CONTACT + .4, size: 1.5, light: 1.6 }));

    // ── The panes, band by band from the rim up, glass glinting in them. ──
    for (let j = 0; j < BANDS.length; j++) {
      const t0 = .44 + j * .11;
      drawBand(stage, d, j, t0, CONTACT + .35 - t0);
      fx.after(t0 + .1, () => {
        for (let k = 0; k < N; k += 2) {
          const down = j % 2 === 1;
          fx.burst(pane, { at: d.pane(j, k, down), count: 1, spread: 0, life: [.6, .8], colour: paneColour(k, down), size: 1.3 });
        }
      });
    }
    stage.cue('zap'); stage.cue('splash', { delay: .1 }); stage.cue('guard', { delay: .45 });
    [.5, .62, .74, .86].forEach(t => stage.cue('glass-tick', { delay: t }));
  },
  land(stage, _e, reached) {
    const fx = stage.fx;
    const party = reached.length ? reached : stage.party(), d = domeOf(stage, party);
    stage.pulse(.3, .65, .12); stage.shake(.14); stage.punch(.2);
    stage.cue('clink');
    for (const f of party) stage.hit(f.id, [.45, .8, 1], .45);
    if (!fx.on || !d) return;
    const pane = kind(stage, 'caleidoscopio-pane', PANE, 'facet');
    // It closes: the panes flash white, and every pane glints at once, round and round.
    for (let j = 0; j < BANDS.length; j++) drawBand(stage, d, j, j * .012, .2, '#dfe8ff');
    for (let j = 0; j < BANDS.length - 1; j++) {
      const e = (BANDS[j] + BANDS[j + 1]) / 2, ring = { ...d.base, y: d.base.y + Math.sin(e) * d.height };
      fx.burst(pane, { at: ring, shape: 'ring', spread: Math.cos(e) * d.radius * 1.02, count: 36, around: j % 2 ? -.5 : .5, life: [.8, 1.2], colour: j % 2 ? C.blue : C.cyan, size: 1.2 });
    }
    fx.burst('floorring', { at: { ...d.base, y: d.base.y + .05 }, count: 1, spread: .01, life: [.4, .55], colour: C.cyan, size: d.radius * .7 });
    fx.burst('flare', { at: d.top, count: 1, spread: .02, life: [.16, .24], colour: C.mirror, light: { intensity: 3, range: d.radius * 2.4, colour: C.cyan } });
    // What is left turns slowly while the bit dome rises under it.
    fx.after(.35, () => turn(stage, d, 0, 1.4, pane));
    fx.after(.7, () => turn(stage, d, 1, 1.3, pane));
  },
  // A blow that reaches someone under the mirrors comes back at its exact contact.
  struck(stage, e) {
    if (e.mirrored && e !== sent) { sent = e; reflect(stage, e); }
  },
  hold(stage, dt, state, playing) {
    clock += dt;
    // The scene skips `struck` for a blow the dome took whole (the commonest mirrored blow): it comes
    // back here instead, a moment after an ordinary blow's contact, if `struck` has not sent it yet.
    if (playing?.mirrored && playing !== seen) { seen = playing; landsAt = clock + CONTACT_SECONDS + .03; }
    if (landsAt >= 0 && clock >= landsAt) { landsAt = -1; if (seen && seen !== sent) { sent = seen; reflect(stage, seen); } }
    if (clock - startedAt < CONTACT + 1.05 || !stage.fx.on) return;
    const shield = state.allies.find(a => a.hp > 0 && a.bits && a.bits.mirror && !a.bits.broken && a.bits.hp > 0)?.bits;
    if (!shield) return;
    if ((due -= dt) > 0) return;
    due = .15;
    const d = domeOf(stage, stage.party());
    if (!d) return;
    turn(stage, d, step++, .5, kind(stage, 'caleidoscopio-pane', PANE, 'facet'));
    // Now and then a few grains of the blue come off the shell.
    if (step % 4 === 0 && has(stage, 'grain')) stage.fx.burst('grain', { at: d.at(step * .7, .7), count: 3, spread: .15, speed: .2, life: [1, 1.6], colour: C.blue });
  },
};

/**
 * One beat of the reflections turning: in three columns a third of the way round from each other,
 * one edge of a pane lights up and its glass glints. Each beat a column on, a band up and round.
 */
function turn(stage: DuoStage, d: Dome, beat: number, life: number, pane: string) {
  const fx = stage.fx, j = beat % (BANDS.length - 1), down = Math.floor(beat / 3) % 2 === 1;
  for (let s = 0; s < 3; s++) {
    const k = (Math.floor(beat / 2) + s * (N / 3)) % N;
    const a = d.corner(j, k), b = d.corner(j, k + 1), c = d.corner(j + 1, k);
    fx.line(down ? b : a, c, C.mirror, { count: 10, life, size: 1.3 });
    fx.burst(pane, { at: d.pane(j, k, down), count: 1, spread: 0, life: [life * .9, life * 1.1], colour: paneColour(k, down), size: 1.1 });
  }
}

/** The last mirrored blow seen playing and when it lands, and the last one sent back (each goes back once). */
let seen: BattleEffect | undefined, sent: BattleEffect | undefined, landsAt = -1;
/** What the mirrors stopped goes back at whoever struck them (`e.mirrored`). */
function reflect(stage: DuoStage, e: BattleEffect) {
  const striker = stage.fighter(e.mirrored!.target), aimed = e.target ? stage.fighter(e.target) : undefined;
  const d = domeOf(stage, stage.party());
  if (!striker || !d || !stage.fx.on) return;
  const fx = stage.fx, at = d.entry(striker.chest, aimed?.chest ?? { ...d.base, y: d.base.y + d.height * .5 });
  const back = norm(sub(striker.chest, at)), side = norm({ x: -back.z, y: 0, z: back.x });
  const distance = Math.hypot(striker.chest.x - at.x, striker.chest.y - at.y, striker.chest.z - at.z), flight = .16;
  // A little rosette of mirrors opens where it met the shell, facing whoever struck: six panes round a point.
  const lift = norm({ x: side.y * back.z - side.z * back.y, y: side.z * back.x - side.x * back.z, z: side.x * back.y - side.y * back.x });
  const petal = (k: number, r: number) => { const a = k / 6 * Math.PI * 2; return add(add(at, side, Math.cos(a) * r), lift, Math.sin(a) * r); };
  for (let k = 0; k < 6; k++) {
    fx.line(at, petal(k, .42), k % 2 ? C.blue : C.cyan, { count: 10, life: .35, size: 1.4 });
    fx.line(petal(k, .42), petal(k + 1, .42), C.mirror, { count: 10, life: .35, size: 1.3 });
  }
  fx.ring(at, back, .2, C.white, { count: 60, outward: 3, life: .3, size: 1.3, kind: 'twinkle' });
  fx.burst('flare', { at, count: 1, spread: .02, life: [.12, .2], colour: C.mirror, light: { intensity: 3, range: 3, colour: C.cyan } });
  // The fan: seven ways out from the way back, and each mirrored above and below it.
  const shard = kind(stage, 'caleidoscopio-shard', has(stage, 'grain') ? { ...SHARD, onDeath: 'grain' } : SHARD, 'splinter');
  for (let i = -3; i <= 3; i++) for (const tier of [-1, 1]) {
    const way = norm(add(add(back, side, i * .13), lift, tier * (.07 + Math.abs(i) * .025)));
    const speed = distance / flight;
    fx.burst(shard, { at: add(at, back, .1), count: 5, spread: .04, velocity: { x: way.x * speed, y: way.y * speed, z: way.z * speed }, speed: .6, cone: .04, life: [flight * .9, flight * 1.15], colour: Math.abs(i) % 2 ? C.blue : C.cyan });
  }
  fx.after(flight, () => {
    // Wherever they are now (a blow's recoil carries them back).
    const now = stage.fighter(striker.id) ?? striker, chest = now.chest;
    stage.hit(striker.id, [.38, .49, .89], 1.3);
    stage.shake(.3); stage.pulse(.35, .5);
    if (has(stage, 'pigment')) fx.burst('pigment', { at: chest, count: 30, spread: .15, speed: 1.2, life: [.5, .8], colour: C.deep, size: .7 });
    // The powder lands on their body (born on its surface) as well as round them.
    if (now.index >= 0 && has(stage, 'grain')) fx.burst('grain', { at: chest, shape: 'surface', fighter: now.index, count: 90, outward: .3, speed: .2, life: [1.4, 2.2], colour: C.blue });
    fx.burst(has(stage, 'grain') ? 'grain' : 'fleck', { at: chest, count: 40, spread: .25, speed: 1.6, up: .6, life: [1, 1.6], colour: C.blue });
    fx.ring(chest, back, Math.max(.4, now.radius * .9), C.cyan, { count: 70, outward: 2.2, life: .35, size: 1.3, light: 1.6 });
  });
  stage.cue('glass-tick'); stage.cue('poof', { delay: flight });
}
