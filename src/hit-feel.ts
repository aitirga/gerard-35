/**
 * How a blow lands, as numbers (docs/graphics.md, "Hit feel"): how long the fight holds still on
 * contact (hit-stop), how far the picture is shoved along the blow, how much the frame punches in,
 * and how much the post pass fringes the colours apart and swells the bloom. Pure, so
 * tests/hit-feel.test.mjs checks it; battle-scene.ts plays it and post.ts shows it.
 */
export const HIT = {
  /**
   * Seconds the fight holds on contact. A plain blow holds `plain`, plus up to `share` more as it
   * takes a bigger bite of the target's PV; a skill holds `skill` instead. A knockout adds `ko`,
   * the palace minion's blow that drops Bernat (the beat) holds at least `beat`, a guarded blow
   * holds `guarded` of it and gum that swallows a blow only `swallowed`. Never more than `max`.
   */
  stop: { plain: .055, share: .035, skill: .1, ko: .05, beat: .16, guarded: .5, swallowed: .035, max: .18 },
  /** Particles keep flying through a hold at this pace, so the burst blooms while the bodies freeze. */
  pace: .3,
  /** Metres the picture lurches along the blow: `base` for any blow, up to `weight` more for the heaviest. */
  kick: { base: .035, weight: .1 },
  /** The lurch springs back (angular frequency, damping ratio): one quick overshoot, then still. */
  spring: { omega: 34, zeta: .42 },
  /** How much of the ortho height the frame punches in on heavy blows, and how it springs back (critically damped). */
  punch: { from: .55, size: .045, omega: 22 },
  /** Fringing starts at this weight and is full at `full`. */
  fringe: { from: .38, full: .92 },
} as const;

export interface Blow {
  /** The share of the target's maximum PV the blow took (0–1). */
  share: number;
  skill?: boolean; guarded?: boolean; ko?: boolean;
  /** The gum swallowed the blow whole: a dull thud. */
  swallowed?: boolean;
  /** The palace minion's blow that leaves Bernat on his knees. */
  beat?: boolean;
}
export interface Landing {
  /** Seconds of hit-stop. */
  stop: number;
  /** 0–1: how heavy the blow reads; the rest follows from it. */
  weight: number;
  /** 0–1 pulses for the post pass. */
  fringe: number; bloom: number;
  /** Metres of camera lurch along the blow. */
  kick: number;
  /** Fraction of the ortho height to punch in. */
  punch: number;
}
const clamp01 = (t: number) => Math.max(0, Math.min(1, t));
const smooth = (t: number) => { t = clamp01(t); return t * t * (3 - 2 * t); };

/** What a blow that just landed does to the fight's clock, the camera and the post pass. */
export function landing(blow: Blow): Landing {
  const share = clamp01(blow.share);
  if (blow.swallowed) return { stop: HIT.stop.swallowed, weight: .12, fringe: 0, bloom: 0, kick: HIT.kick.base * .6, punch: 0 };
  let weight = (blow.skill ? .62 : .3) + share * .6;
  let stop = blow.skill ? HIT.stop.skill + share * HIT.stop.share : HIT.stop.plain + share * HIT.stop.share;
  if (blow.ko) { weight = Math.max(weight + .25, .75); stop += HIT.stop.ko; }
  if (blow.beat) { weight = Math.max(weight, .95); stop = Math.max(stop, HIT.stop.beat); }
  if (blow.guarded) { weight *= .45; stop *= HIT.stop.guarded; }
  weight = clamp01(weight);
  return {
    stop: Math.min(HIT.stop.max, stop), weight,
    fringe: smooth((weight - HIT.fringe.from) / (HIT.fringe.full - HIT.fringe.from)),
    // Bloom swells only on the big moments: skills, knockouts and the beat.
    bloom: blow.skill || blow.ko || blow.beat ? weight : 0,
    kick: HIT.kick.base + HIT.kick.weight * weight,
    punch: weight > HIT.punch.from ? HIT.punch.size * (weight - HIT.punch.from) / (1 - HIT.punch.from) : 0,
  };
}

/**
 * The fight's own clock: real time minus whatever a hit-stop holds back. Everything the fight
 * animates runs on it; the camera, the post pass and (slowed) the particles keep real time.
 */
export class FightClock {
  /** Seconds of hit-stop still to hold. */
  hold = 0;
  /**
   * Slow motion (a dual's banner, docs/combat.md § Ataques duales), by who asked for it: the fight
   * screen (`ui`, through the scene's `slowmo`) and the scene's own choreography (`scene`). Each runs
   * at `scale` for `left` real seconds, then eases back to full speed over `ease`; together they
   * multiply.
   */
  private slows = new Map<string, { scale: number; left: number; ease: number; easing: number }>();
  /**
   * Runs the fight at `scale` (0–1) for `seconds` of real time, then back to full speed over `ease`
   * seconds. A new call from the same `by` replaces the last one; `scale` 1 or `seconds` 0 ends it.
   */
  slow(scale: number, seconds: number, ease = 0, by = 'ui') {
    if (scale >= 1 || seconds <= 0 && ease <= 0) { this.slows.delete(by); return; }
    this.slows.set(by, { scale: Math.max(0, scale), left: Math.max(0, seconds), ease: Math.max(0, ease), easing: 0 });
  }
  /** How fast the fight runs now, from its slow motions (1: full speed; a hit-stop is `hold`). */
  get scale() {
    let k = 1;
    for (const s of this.slows.values()) k *= s.left > 0 || !s.ease ? s.scale : s.scale + (1 - s.scale) * Math.min(1, s.easing / s.ease);
    return k;
  }
  /**
   * Real seconds in, fight seconds out: nothing moves while a stop holds, and slow motion stretches
   * the rest. The slow motions run on real time (a hit-stop does not lengthen them).
   */
  advance(dt: number) {
    const held = Math.min(dt, this.hold); this.hold -= held;
    const moving = (dt - held) * this.scale;
    for (const [by, s] of this.slows) {
      if (s.left > 0) s.left = Math.max(0, s.left - dt);
      else if ((s.easing += dt) >= s.ease - 1e-6) this.slows.delete(by);
    }
    return moving;
  }
  /**
   * Holds for `seconds` from a contact that happened `late` fight seconds ago (frames rarely land
   * on it exactly). Returns how far to rewind the fight so the held pose is the contact itself;
   * the rest is held, so the action grows by exactly `seconds` whatever the frame rate.
   */
  stop(seconds: number, late: number) {
    const back = Math.min(Math.max(0, late), seconds);
    this.hold = seconds - back;
    return back;
  }
  /** No hit-stop left; with `slows`, no slow motion either (the fight ended). */
  clear(slows = false) { this.hold = 0; if (slows) this.slows.clear(); }
}

/** A damped spring pulling `s.x` back to 0, stepped in small slices so slow frames stay stable. */
export function spring(s: { x: number; v: number }, dt: number, omega: number, zeta: number) {
  for (let left = dt; left > 1e-6; left -= 1 / 240) {
    const h = Math.min(1 / 240, left);
    s.v += (-omega * omega * s.x - 2 * zeta * omega * s.v) * h;
    s.x += s.v * h;
  }
  if (Math.abs(s.x) < 1e-5 && Math.abs(s.v) < 1e-4) { s.x = 0; s.v = 0; }
}

/** Smooth, non-repeating wobble in −1…1 for camera shake (summed sines at unrelated rates). */
export function wobble(t: number, seed: number) {
  return Math.sin(t * 47 + seed) * .5 + Math.sin(t * 73 + seed * 2.3) * .3 + Math.sin(t * 119 + seed * 4.1) * .2;
}
