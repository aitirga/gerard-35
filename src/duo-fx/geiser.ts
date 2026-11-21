import { screenAxes, type V3 } from '../dual-fx';
import { AGUA } from '../freatica-fx';
import type { GpuKind } from '../fight-particles';
import type { DuoFighter, DuoStage, DuoStaging } from './types';

/**
 * Géiser (Foc Binari + Recarga): Gerard's binary fire goes into the water at the foe's feet, the
 * water boils under pressure (the floor trembles, bubbles come up faster and faster, each mark of its
 * water lights round it, one for each blow to come), then a scalding column bursts up from under it,
 * one jet per mark spent, and the steam rolls out as a white sheet over every foe and hangs there,
 * dripping. Water and steam, white and teal, with only the root orange: never Vulcano's lava.
 */

const TEAL = '#27c2a0', FOAM = '#dffcf6', STEAM = '#f4fbfa', HEAT = '#ff8a2a', GOLD = '#ffd27a';
/** When each jet goes up after the first: the fight shows a flurry's numbers this far apart (src/battle-scene.ts `CLAW_SECONDS`). */
const JET_GAP = .12;
const CONTACT = 1, END = 2.3;
const UP: V3 = { x: 0, y: 1, z: 0 };
const add = (a: V3, b: V3, k = 1): V3 => ({ x: a.x + b.x * k, y: a.y + b.y * k, z: a.z + b.z * k });

const KINDS = {
  // The column: scalding water thrown straight up, long white streaks that slow, turn and fall.
  'geiser-jet': {
    shape: 'streak', blur: [0, .3], drag: .45, gravity: 7.5, curl: .2, response: .3, size: [.026, .014], sizeJitter: .5, stretch: .085, aspect: .16,
    colours: ['#ffffff', '#dff8f3', '#62cdb6'], intensity: [2.2, 1.6, 1], middle: .35, fadeIn: .02, fadeOut: .4, additive: .45, opacity: .95, core: .4,
  },
  // Drops it throws off: beads of water that fall round it and lie on the floor a moment.
  'geiser-drop': {
    shape: 'dot', glass: .4, drag: .45, gravity: 9, collide: true, bounce: .05, friction: 1, settle: true, size: [.022, .014], sizeJitter: .6,
    colours: ['#ffffff', '#d4f6f0', '#6fcfc0'], intensity: [1.8, 1.4, 1], middle: .3, fadeOut: .3, additive: .4, opacity: .9, core: .5,
  },
  // Steam up the column and off the boiling surface: white haze rushing up and spreading.
  'geiser-steam': {
    shape: 'glow', blur: [.5, 1.3], drag: 1.6, gravity: -2.2, curl: 1.2, response: 1, size: [.1, .5], sizeJitter: .6,
    colours: ['#ffffff', '#f2f8f8', '#dde9e8'], intensity: [1.5, 1.15, .8], middle: .3, fadeIn: .06, fadeOut: .6, additive: .3, opacity: .3,
  },
  // The sheet of steam that rolls out over the foes: big, slow, low and soft.
  'geiser-sheet': {
    shape: 'glow', blur: [.8, 1.5], drag: 1.3, gravity: -.25, curl: .7, response: .8, size: [.22, .75], sizeJitter: .5,
    colours: ['#ffffff', '#eef6f5', '#d6e4e2'], intensity: [1.2, 1, .75], middle: .35, fadeIn: .12, fadeOut: .55, additive: .15, opacity: .13,
  },
  // Air let go in the heated water: beads of glass that rise faster as it boils.
  'geiser-bubble': {
    shape: 'dot', glass: .85, drag: 1.6, gravity: -3.2, curl: .7, response: .4, size: [.012, .026], sizeJitter: .6,
    colours: ['#ffffff', '#dcfaf4', '#9fe6d6'], intensity: [1.8, 1.4, 1], middle: .5, fadeIn: .05, fadeOut: .15, additive: .55, opacity: .95, core: .3,
  },
  // Condensation: fine drops that gather in the steam and come down slowly, catching the light.
  'geiser-condense': {
    shape: 'streak', drag: 2.6, gravity: 3.2, curl: .15, response: .2, size: [.009, .006], sizeJitter: .5, stretch: .05, aspect: .3,
    colours: ['#ffffff', '#e2f7f3', '#a6e0d4'], intensity: [2, 1.5, 1], middle: .4, fadeIn: .15, fadeOut: .3, additive: .6, opacity: .85, core: .4,
  },
} satisfies Record<string, GpuKind>;

function kinds(stage: DuoStage) {
  const g = stage.effects.gpu;
  if (g) for (const [name, kind] of Object.entries(KINDS)) if (!g.get(name)) g.define(name, kind);
}

/** Where a mark of water stands round a foe (src/freatica-fx.ts `AGUA`: its tick and the band over it), over its floor. */
const markHeight = (k: number) => AGUA.ticks[Math.min(k, 2)] + AGUA.bands[Math.min(k, 2)] * .6;

/** The fight's seconds as the hold sees them, and when the last Géiser started on them. */
let clock = 0, startedAt = -99;
/** The foes its steam blinded, and when each next drips. */
const steamed = new Map<string, number>();

export const staging: DuoStaging = {
  timing: { contact: CONTACT, end: END },

  start(stage, e, reached) {
    kinds(stage);
    startedAt = clock;
    const foe = reached.find(f => !f.party) ?? (e.target ? stage.fighter(e.target) : undefined);
    if (!foe || !stage.fx.on) return;
    const fx = stage.fx, { right, facing } = screenAxes(stage.view);
    const floor = { ...foe.feet, y: foe.feet.y + .04 }, R = Math.max(.45, foe.radius * .9 + .2);
    const marks = e.water?.find(w => w.target === foe.id)?.from ?? 0, shown = Math.max(1, Math.min(3, marks));
    const jets = Math.max(1, e.strikes?.length ?? 1);
    const surface = marks ? markHeight(marks - 1) : .08;
    // Steam and bubbles keep below the camera: over a tall cell they stop at its head.
    const top = Math.min(surface, Math.max(.4, foe.height * .85));

    // Foc Binari, braided, into the water at its feet.
    const hand = stage.wearer('matemagico')?.hand;
    const root = add(floor, facing, Math.min(.35, R * .4));
    if (hand) fx.after(.04, () => stage.effects.binaryFire(hand, { ...root, y: floor.y + Math.min(.4, surface) }, { seconds: .34, burn: true, feet: floor }));
    stage.cue('fire-cast', { delay: .05 });

    // The heat at the root: orange rings that close in on the floor under it, and his digits glowing in the water.
    for (let i = 0; i < 5; i++) fx.after(.4 + i * .11, () => {
      fx.ring(floor, UP, R * (1.25 - i * .12), HEAT, { count: 56, outward: -1.2, life: .4, size: 1.3, light: i === 0 ? 2.2 : undefined });
      const a = Math.random() * Math.PI * 2, h = Math.min(surface, .2 + Math.random() * Math.max(.2, surface - .2));
      fx.digit(add(add(floor, right, Math.cos(a) * R * .7), UP, h), (i % 2) as 0 | 1, .13, i < 2 ? GOLD : HEAT, stage.view, .38);
    });
    fx.after(.42, () => fx.burst('bloom', { at: floor, count: 1, spread: .02, life: [CONTACT - .42, CONTACT - .3], colour: HEAT, size: .45, light: { intensity: 2.6, range: 2.4, colour: HEAT } }));

    // Each mark of its water lights round it, one after another: one blow for each.
    for (let k = 0; k < shown; k++) fx.after(.46 + k * .14, () => {
      const level = add(floor, UP, marks ? markHeight(k) : .1);
      fx.ring(level, UP, R + .08, TEAL, { count: 90, life: CONTACT - .46 - k * .14 + .1, size: 1.7, light: 1.6 });
      fx.ring(level, UP, R + .16, FOAM, { count: 40, life: .3, size: 1.2 });
      stage.cue('glass-tick');
    });

    // The pressure: bubbles faster and faster, steam off the surface, the floor trembling harder.
    const steps = 9;
    for (let i = 0; i < steps; i++) fx.after(.4 + i * (CONTACT - .45) / steps, () => {
      const u = i / (steps - 1);
      fx.burst('geiser-bubble', { at: { ...floor, y: floor.y + .05 }, shape: 'ring', spread: R * .75, count: Math.round(8 + 26 * u), velocity: UP, speed: .3 + u * .6, life: [.25, Math.max(.3, top / (1.3 + u * 1.5))] });
      if (i % 2) fx.burst('geiser-steam', { at: add(floor, UP, top), shape: 'ring', spread: R * .6, count: Math.round(2 + 5 * u), up: .4 + u * .6, speed: .2, life: [.4, .7] });
      stage.shake(.04 + .14 * u);
    });
    stage.cue('charge', { delay: .45 }); stage.cue('rise', { delay: .55 });

    // A breath before it goes: the water draws in to its root.
    fx.after(CONTACT - .1, () => {
      fx.ring(floor, UP, R * 1.2, FOAM, { count: 80, outward: -3, life: .12, size: 1.5 });
      fx.burst('geiser-drop', { at: floor, shape: 'ring', spread: R * 1.1, count: 30, outward: -1.6, up: .8, speed: .3, life: [.2, .35] });
    });

    // The jets: one for each mark spent, each a little taller, from under it.
    for (let k = 0; k < jets; k++) fx.after(CONTACT + k * JET_GAP, () => {
      const s = 1 + k * .22, foot = { ...floor, y: floor.y + .03 };
      fx.burst('geiser-jet', { at: foot, shape: 'ring', spread: R * .3, count: Math.round(140 * s), velocity: { x: 0, y: 8.8 * Math.sqrt(s), z: 0 }, cone: .045, speed: .7, life: [.55, .9] });
      fx.burst('geiser-jet', { at: foot, count: Math.round(70 * s), spread: .06, velocity: { x: 0, y: 10.5 * Math.sqrt(s), z: 0 }, cone: .025, speed: .5, life: [.5, .8] });
      fx.burst('geiser-steam', { at: foot, count: Math.round(24 * s), spread: R * .25, velocity: { x: 0, y: 4.5, z: 0 }, cone: .2, speed: .6, life: [.6, 1.1] });
      fx.burst('geiser-drop', { at: add(foot, UP, .3), count: Math.round(55 * s), spread: R * .3, velocity: { x: 0, y: 6.5, z: 0 }, cone: .5, speed: 2, life: [1.1, 1.6] });
      // The column's water, a fluid (src/fluid-fx.ts): thrown up with it, it falls back as a body over the
      // foe and spreads out over the floor round it.
      stage.fluid.burst('fluido-agua', { at: add(foot, UP, .2), count: Math.round(260 * s), spread: R * .25, velocity: { x: 0, y: 6.2 * Math.sqrt(s), z: 0 }, cone: .22, speed: 1.2, life: [1.7, 2.3] });
      // Orange only at the root, where the fire is.
      fx.burst('bloom', { at: foot, count: 1, spread: .02, life: [.16, .24], colour: HEAT, size: .5, light: { intensity: 3.5, range: 3, colour: HEAT } });
      fx.burst('bloom', { at: add(foot, UP, .9), count: 1, spread: .02, life: [.14, .2], colour: TEAL, size: .4, light: { intensity: 1.6, range: 3, colour: '#dffcf6' } });
      fx.ring(foot, UP, R * .45, FOAM, { count: 90, outward: 3.4, life: .35, size: 1.5 });
      fx.burst('floorring', { at: foot, count: 1, spread: .01, life: [.4, .55], colour: TEAL, size: R * (1 + k * .2) });
      stage.hit(foe.id, [.85, 1, .95], 1.1 + k * .15);
      stage.shake(.28 + k * .08);
      stage.cue('splash');
    });

    // The steam goes over everyone: a white sheet rolling out low from the column to each foe, and a cloud over each.
    const out = CONTACT + (jets - 1) * JET_GAP + .12;
    const under = (e.vapour ?? []).map(id => stage.fighter(id)).filter((f): f is DuoFighter => !!f);
    fx.after(out, () => {
      fx.burst('geiser-sheet', { at: add(floor, UP, Math.min(1.6, foe.height)), count: 36, spread: .45, speed: 1.2, up: .2, life: [.9, 1.5] });
      fx.ring(add(floor, UP, .25), UP, R, STEAM, { kind: 'geiser-sheet', count: 44, outward: 3.4, around: .6, life: 1.2 });
      for (const f of under) {
        const d = { x: f.chest.x - foe.chest.x, y: 0, z: f.chest.z - foe.chest.z }, dist = Math.hypot(d.x, d.z);
        if (dist > .3) fx.burst('geiser-sheet', { at: add(foe.chest, UP, .3), count: 30, spread: .35, velocity: { x: d.x / .55, y: .1, z: d.z / .55 }, cone: .3, speed: .5, life: [.9, 1.4] });
        fx.after(dist > .3 ? .3 : .05, () => {
          fx.burst('geiser-sheet', { at: add(f.chest, UP, .3), count: 24, spread: Math.max(.35, f.radius * .7), speed: .3, life: [1, 1.6] });
          stage.hit(f.id, [.9, .97, .97], .5);
        });
      }
      stage.cue('gust'); stage.cue('fizzle', { delay: .1 });
    });
    // It condenses: fine drops coming down out of the cloud over each blinded foe.
    for (let i = 0; i < 6; i++) fx.after(out + .35 + i * .14, () => {
      for (const f of under) fx.burst('geiser-condense', { at: add(f.chest, UP, .9 + f.height * .3), count: 7, spread: Math.max(.3, f.radius * .8), speed: .1, life: [.7, 1.1] });
    });
    for (const f of under) steamed.set(f.id, 1.2);
  },

  land(stage) {
    stage.pulse(.35, .7, .08);
    stage.punch(.45);
    stage.shake(.45);
  },

  hold(stage, dt, state) {
    clock += dt;
    if (!steamed.size || !stage.fx.on || clock - startedAt < END) return;
    // While its steam blinds them: a wisp of white curling off the head now and then, and a drop of condensation falling.
    for (const [id, next] of steamed) {
      const unit = state.foes.find(u => u.id === id);
      if (!unit || unit.hp <= 0 || !unit.timed?.cegado) { steamed.delete(id); continue; }
      const left = next - dt;
      if (left > 0) { steamed.set(id, left); continue; }
      steamed.set(id, .45 + Math.random() * .2);
      const f = stage.fighter(id);
      if (!f) continue;
      const head = add(f.chest, UP, .35 + f.height * .2);
      stage.fx.burst('geiser-steam', { at: head, count: 3, spread: Math.max(.2, f.radius * .5), up: .4, speed: .15, life: [.9, 1.4] });
      stage.fx.burst('geiser-condense', { at: add(head, UP, .4), count: 2, spread: Math.max(.25, f.radius * .6), speed: .05, life: [.8, 1.1] });
    }
  },
};
