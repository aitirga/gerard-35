import { waterOf } from '../battle';
import { screenAxes, type V3 } from '../dual-fx';
import { markHeights } from '../freatica-fx';
import type { GpuKind } from '../fight-particles';
import type { DuoStage, DuoStaging } from './types';

/**
 * A escala (Rayo encogedor + Recarga): a measurement. Bip frames the foe in its cyan HUD at full size,
 * a dimension line with its ticks beside it and a scan running down it, while Freática runs its tape
 * to the foe and stands its staff gauge on the other side, marks I, II and III. Bip's ray goes in
 * through a train of square sights that tighten along it; the frame, the dimension line and the
 * scale bar on the floor collapse together to the smaller size, and the water, the same water, now
 * stands a mark higher up the smaller body. While it stays shrunk a faint frame keeps ticking round
 * it. Precise and quiet: lines, ticks, one click; nothing explodes.
 */

const CYAN = '#4fe0ff', PALE = '#e8fbff', TEAL = '#27c2a0', FOAM = '#dffcf6';
/** How small the scene draws a shrunk fighter (src/battle-scene.ts `SHRUNK`). */
const SHRUNK = .62;
const CONTACT = .95, END = 2.1;
const UP: V3 = { x: 0, y: 1, z: 0 };
const add = (a: V3, b: V3, k = 1): V3 => ({ x: a.x + b.x * k, y: a.y + b.y * k, z: a.z + b.z * k });
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const smooth = (k: number) => k * k * (3 - 2 * k);

const KINDS = {
  // Water caught as it climbs: small beads of glass, thrown off the surface and falling back.
  'a-escala-drop': {
    shape: 'dot', glass: .45, drag: .8, gravity: 7, collide: true, bounce: 0, friction: 1, size: [.018, .012], sizeJitter: .5,
    colours: ['#ffffff', '#cff5ee', '#5fcdb6'], intensity: [1.7, 1.3, 1], middle: .3, fadeOut: .3, additive: .45, opacity: .9, core: .5,
  },
  // Freática's tape run out along the floor: beads of light that stay where they are born.
  'a-escala-tape': {
    shape: 'glow', drag: 6, gravity: 0, size: [.045, .018], sizeJitter: .4,
    colours: ['#ffffff', '#d8fff2', '#7fe6c6'], intensity: [2.2, 1.6, 1], middle: .35, fadeIn: .03, fadeOut: .5, additive: .9, opacity: .8,
  },
  // Air going up out of a foe the water has closed over.
  'a-escala-bead': {
    shape: 'dot', glass: .85, drag: 2, gravity: -2.4, curl: .4, response: .3, size: [.011, .022], sizeJitter: .5,
    colours: ['#ffffff', '#dcfaf4', '#9fe6d6'], intensity: [1.7, 1.3, .9], middle: .5, fadeIn: .06, fadeOut: .15, additive: .55, opacity: .95, core: .3,
  },
} satisfies Record<string, GpuKind>;

function kinds(stage: DuoStage) {
  const g = stage.effects.gpu;
  if (g) for (const [name, kind] of Object.entries(KINDS)) if (!g.get(name)) g.define(name, kind);
}

/** The water's surface at `marks` over the floor of a foe `tall` m high, as its cell draws it (src/freatica-fx.ts `markHeights`), or a film on the floor when dry. */
const levelAt = (tall: number, marks: number) => { if (marks <= 0) return .04; const { ticks, bands } = markHeights(tall), m = Math.min(marks, 3) - 1; return ticks[m] + bands[m] * .7; };

/** The fight's seconds as the hold sees them, when the last A escala started, and the foes it shrank with when each next ticks. */
let clock = 0, startedAt = -99;
const shrunk = new Map<string, number>();

/** A frame of four cut corners facing the camera: `c` its middle, `w`/`h` half its width and height. */
function corners(stage: DuoStage, c: V3, w: number, h: number, colour: string, life: number, size = 1.6, arm = .26) {
  const { right, up } = screenAxes(stage.view), a = Math.min(arm, w * .6, h * .6);
  for (const [sx, sy] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
    const corner = add(add(c, right, sx * w), up, sy * h);
    stage.fx.line(corner, add(corner, right, -sx * a), colour, { count: 12, life, size });
    stage.fx.line(corner, add(corner, up, -sy * a), colour, { count: 12, life, size });
  }
}

export const staging: DuoStaging = {
  timing: { contact: CONTACT, end: END },

  start(stage, e, reached) {
    kinds(stage);
    startedAt = clock;
    const foe = reached.find(f => !f.party) ?? (e.target ? stage.fighter(e.target) : undefined);
    if (!foe || !stage.fx.on) return;
    const fx = stage.fx, { right, up, facing } = screenAxes(stage.view);
    const H0 = Math.max(.5, foe.height), W0 = Math.max(.35, foe.radius * .85), H1 = H0 * SHRUNK, W1 = W0 * SHRUNK;
    const floor = { ...foe.feet, y: foe.feet.y + .03 }, front = add(floor, facing, Math.max(.3, foe.radius * .6));
    /** The frame's middle when the foe is `h` tall: it stands on the floor. */
    const mid = (h: number) => add(front, up, h / 2 + .02);
    const water = e.water?.find(w => w.target === foe.id), from = water?.from ?? 0, to = water?.to ?? from;
    const sunk = to >= 2;

    // Bip's sight opens: a square that tightens on its eye.
    const bip = stage.bip() ?? (() => { const t = stage.wearer('tecnopata'); return t && add(add(t.chest, UP, 1), facing, .2); })();
    if (bip) for (let i = 0; i < 3; i++) fx.after(i * .07, () => corners(stage, bip, .3 - i * .07, .3 - i * .07, i === 2 ? PALE : CYAN, .25, 1.3, .12));
    stage.cue('charge');

    // Bip measures it at full size: four cut corners, a dimension line with its ticks, a scan running down.
    fx.after(.08, () => {
      corners(stage, mid(H0), W0 + .1, H0 / 2 + .06, CYAN, .7 - .08, 1.2);
      stage.cue('glass-tick');
    });
    const dim = (h: number, life: number, colour = CYAN) => {
      const x = add(front, right, W0 + .32), top = add(x, up, h + .02), foot = add(x, up, .02);
      fx.line(foot, top, colour, { count: Math.round(20 + h * 30), life, size: .9 });
      for (const end of [foot, top]) fx.line(add(end, right, -.08), add(end, right, .08), colour, { count: 8, life, size: 1.1 });
      for (let k = 1; k < 10; k++) { const p = add(foot, up, h * k / 10), long = k === 5 ? .1 : .05; fx.line(p, add(p, right, -long), colour, { count: 4, life, size: .8 }); }
    };
    fx.after(.14, () => dim(H0, .7 - .14));
    for (let i = 0; i <= 8; i++) fx.after(.18 + i * .03, () => {
      const y = H0 + .04 - (H0 + .02) * i / 8, a = add(add(front, right, -W0 - .1), up, y), b = add(add(front, right, W0 + .1), up, y);
      fx.line(a, b, i === 8 ? PALE : CYAN, { count: Math.round(24 * W0 + 10), life: .16, size: 1.1 });
    });

    // Freática's half: the tape along the floor to it, and its staff gauge, I, II, III, on the other side.
    const keeper = stage.wearer('freatica');
    if (keeper) fx.after(.1, () => {
      const a = { ...keeper.feet, y: keeper.feet.y + .04 }, b = { ...floor, y: floor.y + .02 };
      fx.burst('a-escala-tape', { at: a, to: b, shape: 'line', count: Math.round(Math.hypot(b.x - a.x, b.z - a.z) * 30), life: [.8, 1] });
      fx.line(a, b, TEAL, { count: Math.round(Math.hypot(b.x - a.x, b.z - a.z) * 40), life: .7, size: 1.2 });
    });
    const levelOf = (marks: number) => levelAt(foe.height, marks), ticks = markHeights(foe.height).ticks;
    const gauge = add(front, right, -W0 - .3), gaugeTop = Math.max(H0 + .2, levelOf(3) + .1);
    fx.after(.2, () => {
      fx.line(add(gauge, up, .02), add(gauge, up, gaugeTop), TEAL, { count: Math.round(gaugeTop * 30), life: END - .2, size: .8 });
      for (let k = 1; k <= 3; k++) {
        const at = add(gauge, up, ticks[k - 1]);
        fx.line(at, add(at, right, -.14), FOAM, { count: 8, life: END - .2, size: 1.1 });
        // Its numeral as strokes: one, two, three short uprights.
        for (let j = 0; j < k; j++) { const s = add(add(at, right, -.2 - j * .045), up, .03); fx.line(s, add(s, up, .09), TEAL, { count: 5, life: END - .2, size: .9 }); }
      }
    });

    // The water as it stands now: a line round the body at its level, and a pointer on the gauge.
    const ringAt = (h: number, w: number, colour: string, life: number, count = 70) => fx.ring(add(floor, UP, h), UP, w + .12, colour, { count, life, size: 1.5 });
    const pointer = (h: number, life: number, colour = TEAL) => { const p = add(gauge, up, h); fx.line(add(p, right, .02), add(add(p, right, .16), up, .05), colour, { count: 7, life, size: 1.7 }); fx.line(add(p, right, .02), add(add(p, right, .16), up, -.05), colour, { count: 7, life, size: 1.7 }); };
    /** A dashed teal line across the frame at the water's level, `w` half its width. */
    const waterline = (h: number, w: number, life: number, strong = false) => {
      const c = add(front, up, h), dashes = 7;
      for (let j = 0; j < dashes; j++) {
        const a = add(c, right, -w + 2 * w * j / dashes), b = add(c, right, -w + 2 * w * (j + .6) / dashes);
        fx.line(a, b, strong ? FOAM : TEAL, { count: 6, life, size: strong ? 1.7 : 1.4 });
      }
    };
    fx.after(.3, () => { ringAt(levelOf(from), foe.radius, TEAL, .45); pointer(levelOf(from), .45); waterline(levelOf(from), W0 + .1, .45); });

    // Bip's ray goes in through a train of square sights, each smaller as it nears the foe.
    const ray = .2, rayAt = .48;
    if (bip) {
      const target = mid(H0 * .8);
      stage.effects.trails.comet(bip, target, ['#ffffff', '#bff6ff'], ray, { arc: 0, width: .05, life: .45, intensity: 3, core: .8, additive: .95, taper: .3, delay: rayAt });
      for (let k = 1; k <= 6; k++) fx.after(rayAt + ray * k / 6, () => {
        const p = { x: bip.x + (target.x - bip.x) * k / 6, y: bip.y + (target.y - bip.y) * k / 6, z: bip.z + (target.z - bip.z) * k / 6 }, s = .3 * (1 - .12 * k);
        corners(stage, p, s, s, k % 2 ? PALE : CYAN, .3, 1.2, s * .7);
      });
      stage.cue('zap', { delay: rayAt });
    }

    // It is drawn down to scale: the frame, the dimension line and a scale bar on the floor all collapse together,
    // and the water, the same water, climbs the smaller body to the mark above.
    const shrinkAt = rayAt + ray - .05, steps = 7, span = CONTACT - shrinkAt;
    const bar = (k: number, life: number) => {
      const len = lerp(W0 * 2 + .2, (W0 * 2 + .2) * SHRUNK, k), a = add(add(front, facing, .25), right, -len / 2), segs = 4;
      for (let s = 0; s < segs; s++) {
        const p = add(a, right, len * s / segs), q = add(a, right, len * (s + 1) / segs);
        fx.line(p, q, s % 2 ? PALE : CYAN, { count: s % 2 ? 6 : 14, life, size: s % 2 ? 1 : 1.9 });
      }
      for (const end of [a, add(a, right, len)]) fx.line(end, add(end, up, .08), PALE, { count: 4, life, size: 1.2 });
    };
    for (let i = 0; i <= steps; i++) fx.after(shrinkAt + span * i / steps, () => {
      const k = smooth(i / steps), last = i === steps, life = last ? END - CONTACT : span / steps * 1.6;
      const h = lerp(H0, H1, k), w = lerp(W0, W1, k);
      corners(stage, mid(h), w + .1, h / 2 + .06, CYAN, life, last ? 1.3 : 1);
      dim(h, life);
      bar(k, life);
      const lv = lerp(levelOf(from), levelOf(to), smooth(Math.min(1, i / (steps - 1))));
      ringAt(lv, lerp(foe.radius, foe.radius * SHRUNK, k), TEAL, last ? END - CONTACT : span / steps * 1.4, last ? 90 : 60);
      pointer(lv, life, last ? FOAM : TEAL);
      // The waterline across the figure: the same water, read against the body as it gets smaller.
      waterline(lv, w + .1, life, last);
      if (i % 2 === 0) stage.cue('glass-tick');
    });
    // The level crossing the gauge's next mark: it flashes there.
    if (to > from) fx.after(CONTACT - .06, () => {
      const at = add(gauge, up, ticks[to - 1]);
      fx.line(add(at, right, .02), add(at, right, -.22), '#ffffff', { count: 12, life: .5, size: 2.4 });
      fx.burst('bloom', { at, count: 1, spread: .02, life: [.18, .26], colour: TEAL, size: .3, light: { intensity: 1.6, range: 1.6, colour: TEAL } });
    });

    // Contact: it clicks to scale. A white outline of the small frame, the water jumping at its new level.
    fx.after(CONTACT, () => {
      const c = mid(H1), { right: r, up: u } = screenAxes(stage.view), w = W1 + .1, h = H1 / 2 + .06;
      const p = [add(add(c, r, -w), u, -h), add(add(c, r, w), u, -h), add(add(c, r, w), u, h), add(add(c, r, -w), u, h)];
      for (let j = 0; j < 4; j++) fx.line(p[j], p[(j + 1) % 4], PALE, { count: 24, life: .22, size: 1.2 });
      const lv = add(floor, UP, levelOf(to));
      fx.burst('a-escala-drop', { at: lv, shape: 'ring', spread: foe.radius * SHRUNK + .1, count: 46, outward: .9, up: 1.4, speed: .4, life: [.5, .9] });
      fx.ring(lv, UP, foe.radius * SHRUNK + .14, FOAM, { count: 60, outward: 1.6, life: .35, size: 1.3, light: 1 });
      if (sunk) fx.burst('a-escala-bead', { at: add(floor, UP, .15), count: 40, spread: Math.max(.15, foe.radius * SHRUNK * .6), speed: .3, life: [.6, 1.1] });
      stage.hit(foe.id, [.6, 1, .95], 1);
    });
    stage.cue('mark-set', { delay: CONTACT });
    stage.cue(sunk ? 'sink' : 'splash', { delay: CONTACT + .05 });
    shrunk.set(foe.id, END - CONTACT + .2);
  },

  land(stage) {
    stage.pulse(.2, .35, .05);
    stage.punch(.3);
    stage.shake(.16);
  },

  hold(stage, dt, state) {
    clock += dt;
    if (!shrunk.size || !stage.fx.on || clock - startedAt < END) return;
    // While it stays shrunk: a faint frame ticks round it, and the water's level on a short stretch of gauge beside it.
    for (const [id, next] of shrunk) {
      const unit = state.foes.find(u => u.id === id), timed = unit?.timed?.encogido;
      if (!unit || unit.hp <= 0 || !timed) { shrunk.delete(id); continue; }
      const left = next - dt;
      if (left > 0) { shrunk.set(id, left); continue; }
      // Faster in its last seconds, as it is about to come back to size.
      shrunk.set(id, timed.left < 3 ? .4 : .9);
      const f = stage.fighter(id);
      if (!f) continue;
      const { right, up, facing } = screenAxes(stage.view), front = add({ ...f.feet, y: f.feet.y + .03 }, facing, Math.max(.25, f.radius * .6));
      const h = Math.max(.3, f.height), w = Math.max(.25, f.radius * .85);
      corners(stage, add(front, up, h / 2 + .02), w + .08, h / 2 + .05, CYAN, .7, .9, .14);
      const marks = waterOf(unit);
      if (marks) {
        const g = add(front, right, -w - .2), lv = levelAt(f.height, marks);
        stage.fx.line(add(g, up, Math.max(.02, lv - .15)), add(g, up, lv + .15), TEAL, { count: 8, life: .7, size: .9 });
        stage.fx.line(add(g, up, lv), add(add(g, up, lv), right, .1), FOAM, { count: 5, life: .7, size: 1.3 });
      }
    }
  },
};
