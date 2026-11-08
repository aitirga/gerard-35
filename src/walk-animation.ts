const TAU = Math.PI * 2;

/**
 * How people walk and run, after the animator's key poses (contact, down, passing, up; a run's flight)
 * and gait measurements: each leg spends part of the cycle bearing weight (stance) and the rest in the
 * air (swing). In stance the foot is on the ground, so the leg turns back at an even speed; in swing it
 * comes forward fast, reaches a little past where it lands and draws back onto the heel. A walk's
 * stance is 58% of the cycle, so both feet are down for a moment; a run's is 38%, so the body flies
 * between steps. Knees give a little as the weight lands and fold in swing (heels high in a run), feet
 * land heel first and push off from the toes, arms swing against the legs a beat behind them, more
 * forwards than back. The rig's angles are "backward positive": a leg or arm turned back, a knee bent.
 */
export interface LegPose { hip: number; knee: number; foot: number }
export interface Gait {
  /** Leg 0's hip, degrees (backward positive): the legs' swing, for rigs that only turn their legs. */
  stride: number;
  /** Which leg is coming forward (−1–1), which foot bears the weight (−1–1), running (0–1), moving (0–1). */
  swing: number; side: number; effort: number; weight: number;
  /** Degrees of roll towards the foot that bears the weight. */
  sway: number;
  /** Each leg (0, then 1) and each arm's shoulder (same sides), degrees. */
  legs: [LegPose, LegPose];
  arms: [number, number];
  /** How much the elbows bend beyond their rest, degrees. */
  elbow: number;
  /** How high the body flies between a run's steps, in world units. */
  air: number;
  /** The leg whose foot touched down this frame, or −1. */
  landed: number;
  /** Kept for callers from before: always 0 (the ground contact bobs the body). */
  lift: number;
}

/** Where a value is at `u` (0–1) between periodic keys [u, value], smoothly (Catmull-Rom). */
function keyed(keys: readonly (readonly [number, number])[], u: number) {
  const n = keys.length;
  let i = keys.findIndex(([at], k) => u >= at && u < (k + 1 < n ? keys[k + 1][0] : 1 + keys[0][0]));
  if (i < 0) i = n - 1;
  const at = (k: number) => keys[(k + n) % n][0] + Math.floor(k / n);
  const value = (k: number) => keys[(k % n + n) % n][1];
  const u0 = at(i), u1 = at(i + 1), t = ((u < u0 ? u + 1 : u) - u0) / (u1 - u0);
  const p0 = value(i - 1), p1 = value(i), p2 = value(i + 1), p3 = value(i + 2);
  const t2 = t * t, t3 = t2 * t;
  return .5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
}

/** A walk and a run: stance share, how far the hip reaches forward and back, knee and foot through the cycle. */
const GAITS = {
  walk: {
    duty: .58, forward: 28, back: 24,
    // Knee bent (degrees) at each point of the cycle (0 = the heel lands): a give as the weight lands,
    // nearly straight over the foot, folding from the push-off to 60° early in the swing, straight to land.
    knee: [[0, 4], [.12, 16], [.32, 5], [.5, 12], [.6, 38], [.72, 60], [.86, 30], [.96, 3]] as const,
    // The foot against the ground (heel up positive): toes up as the heel lands, flat, heel up, push off.
    foot: [[0, -16], [.08, 0], [.42, 0], [.52, 12], [.6, 30], [.7, 14], [.84, 0], [.94, -12]] as const,
    arm: .7, elbow: 10, lean: 3, sway: 1.8, twist: 3.5, air: 0,
  },
  run: {
    duty: .38, forward: 40, back: 26,
    // Down: the landing leg bends most at mid-stance; in the swing the heel comes up high behind.
    knee: [[0, 18], [.15, 40], [.38, 22], [.52, 92], [.66, 105], [.82, 55], [.94, 20]] as const,
    foot: [[0, -4], [.1, 0], [.28, 10], [.38, 32], [.5, 20], [.74, 0], [.92, -6]] as const,
    arm: 1.05, elbow: 72, lean: 11, sway: .8, twist: 5, air: .045,
  },
};

const ease = (from: number, to: number, dt: number, seconds: number) => from + (to - from) * (1 - Math.exp(-dt / seconds));

/** The hip at `u` of a leg's cycle, forward positive: even backwards in stance, a curve forwards in swing. */
function hipAt(u: number, duty: number, forward: number, back: number) {
  const sweep = forward + back, speed = -sweep / duty;
  if (u < duty) return forward + speed * u;
  // Hermite from the back to the front, leaving and arriving at the stance's speed: it keeps going back
  // a moment after push-off, and reaches past the landing before it draws back onto the heel.
  const t = (u - duty) / (1 - duty), m = speed * (1 - duty), t2 = t * t, t3 = t2 * t;
  return (2 * t3 - 3 * t2 + 1) * -back + (t3 - 2 * t2 + t) * m + (-2 * t3 + 3 * t2) * forward + (t3 - t2) * m;
}

/** A continuous gait: grid-cell boundaries must never restart the pose. */
export class WalkAnimation {
  private phase = 0;
  private weight = 0;
  private effort = 0;

  /**
   * `cycleSeconds`: one full cycle (two steps) walking; `fast`: running, whose cycle is `runSeconds`.
   * Starting, stopping and changing pace ease in; the cycle itself is never smoothed, so it keeps its shape.
   */
  update(dt: number, moving: boolean, animate = true, cycleSeconds = .36, fast = false, runSeconds = .3): Gait {
    const delta = Math.min(Math.max(dt, 0), .05);
    const still: LegPose = { hip: 0, knee: 0, foot: 0 };
    if (!animate) {
      this.phase = this.weight = this.effort = 0;
      return { stride: 0, swing: 0, side: 0, effort: 0, weight: 0, sway: 0, legs: [still, { ...still }], arms: [0, 0], elbow: 0, air: 0, landed: -1, lift: 0 };
    }
    this.weight = ease(this.weight, moving ? 1 : 0, delta, .07);
    this.effort = ease(this.effort, moving && fast ? 1 : 0, delta, .12);
    const e = this.effort, w = this.weight, mix = (a: number, b: number) => a + (b - a) * e;
    const before = this.phase;
    this.phase = (this.phase + delta / mix(cycleSeconds, runSeconds)) % 1;
    const duty = mix(GAITS.walk.duty, GAITS.run.duty), forward = mix(GAITS.walk.forward, GAITS.run.forward), back = mix(GAITS.walk.back, GAITS.run.back);
    const leg = (u: number): LegPose => ({
      hip: -hipAt(u, duty, forward, back) * w,
      knee: mix(keyed(GAITS.walk.knee, u), keyed(GAITS.run.knee, u)) * w,
      foot: mix(keyed(GAITS.walk.foot, u), keyed(GAITS.run.foot, u)) * w,
    });
    const u0 = this.phase, u1 = (this.phase + .5) % 1;
    const legs: [LegPose, LegPose] = [leg(u0), leg(u1)];
    // An arm swings against the leg on its side, a little behind it, further forwards than back.
    const lag = .06, armOf = (u: number) => {
      const h = hipAt((u - lag + 1) % 1, duty, forward, back) * mix(GAITS.walk.arm, GAITS.run.arm);
      return (h > 0 ? h * .8 : h * .55) * w;
    };
    const arms: [number, number] = [armOf(u1), armOf(u0)];
    // The foot bearing weight: +1 at the middle of leg 0's stance, −1 at leg 1's.
    const side = Math.cos(TAU * (u0 - duty / 2)) * w;
    // In a run both feet are up between steps: the body follows a small arc.
    const flight = (u: number) => u >= duty && u < .5 ? Math.sin(Math.PI * (u - duty) / (.5 - duty)) : 0;
    const air = mix(0, GAITS.run.air) * Math.max(flight(u0), flight(u1)) * w;
    // Leg 0 lands as the cycle wraps, leg 1 half a cycle later.
    const landed = !moving ? -1 : this.phase < before ? 0 : before < .5 && this.phase >= .5 ? 1 : -1;
    return {
      stride: legs[0].hip, swing: Math.cos(TAU * u0) * w, side, effort: e, weight: w,
      sway: side * mix(GAITS.walk.sway, GAITS.run.sway), legs, arms,
      elbow: mix(GAITS.walk.elbow, GAITS.run.elbow) * w, air, landed, lift: 0,
    };
  }
}

/** How bent an elbow hangs, relaxed. */
export const ELBOW_REST = -14;
/** How far a foot turns out, relaxed, on a rig with knees. */
export const FOOT_TURN = 10;
interface Limb { setLocalEulerAngles(x: number, y: number, z: number): void }
/** What `poseLimbs` moves: leg then arm per side, with elbows, knees and feet where the rig has them; `ankles` where a foot is a joint rather than its box. */
export interface LimbRig { limbs: Limb[]; joints: (Limb | null)[]; feet: (Limb | null)[]; ankles?: Limb[] }

/** A leg in a gait, with its knee and its ankle: the foot keeps to the ground's angle the gait gives it. */
function poseLeg(rig: LimbRig, i: number, gait: Gait, crouch: number) {
  const side = i === 0 ? 0 : 1, pose = gait.legs[side];
  const hip = pose.hip - crouch * .5, knee = crouch + pose.knee;
  rig.limbs[i].setLocalEulerAngles(hip, 0, 0);
  const joint = rig.joints[i];
  if (!joint) return;
  joint.setLocalEulerAngles(knee, 0, 0);
  // Level with the floor, then as the gait turns it.
  const flat = -(hip + knee) + pose.foot;
  // A model's feet already turn out as they do at rest.
  if (rig.ankles?.[side]) rig.ankles[side].setLocalEulerAngles(flat, 0, 0);
  else rig.feet[side]?.setLocalEulerAngles(flat, (i === 0 ? -1 : 1) * FOOT_TURN, 0);
}

/**
 * Limbs for a gait: legs and arms swing in opposite pairs, the knee of the leg coming forward bends,
 * its foot rolls from heel to toe and, at rest, the arms lift a little with each breath.
 */
export function poseLimbs(rig: LimbRig, gait: Gait, breathe = 0, resting = 0) {
  rig.limbs.forEach((limb, i) => {
    if (i % 2 === 0) { poseLeg(rig, i, gait, 0); return; }
    const side = i === 1 ? 0 : 1, shoulder = gait.arms[side];
    // Arms out a touch from the body as they swing, more in a run.
    limb.setLocalEulerAngles(-shoulder, 0, (i < 2 ? -1 : 1) * (breathe * 2.2 * resting + gait.weight * (2.5 + gait.effort * 4)));
    const ahead = Math.max(0, shoulder) / 30;
    rig.joints[i]?.setLocalEulerAngles(ELBOW_REST - gait.elbow - ahead * 16, 0, 0);
  });
}

/** The legs alone, for whoever poses their own arms (a fighter); `crouch` bends both knees, as in a ready stance. */
export function poseLegs(rig: LimbRig, gait: Gait, crouch = 0) {
  poseLeg(rig, 0, gait, crouch); poseLeg(rig, 2, gait, crouch);
}

/**
 * How a walking body carries itself: leaning into the walk, more when running, hips over the foot
 * that bears the weight, the shoulders turning with the arms; and into the turn it is making (`turn`,
 * degrees still to go). Degrees, and `shift` in model units to the side.
 */
export function carriage(gait: Gait, turn = 0) {
  const e = gait.effort, mix = (a: number, b: number) => a + (b - a) * e;
  // The shoulders turn towards the arm that swings back: the same rhythm as the arms.
  const arms = (gait.arms[0] - gait.arms[1]) / Math.max(1, mix(GAITS.walk.forward, GAITS.run.forward));
  return {
    pitch: gait.weight * mix(GAITS.walk.lean, GAITS.run.lean),
    twist: arms * mix(GAITS.walk.twist, GAITS.run.twist),
    roll: gait.sway + Math.max(-6, Math.min(6, turn * .05)) * gait.weight,
    shift: gait.side * mix(.014, .008),
  };
}

/** Breathing (0–1), eyelid scale and a slow glance (−1–1); seeds keep groups out of unison. */
export function idlePose(time: number, seed = 0) {
  const t = time + seed * 2.39;
  const blink = (t % 3.7) / 3.7 > .96 ? .12 : 1;
  return { breathe: Math.sin(t * 2.1) * .5 + .5, blink, look: Math.sin(t * .47) * Math.sin(t * .21 + 1) };
}
