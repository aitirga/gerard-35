const TAU = Math.PI * 2;

/** A continuous gait: grid-cell boundaries must never restart the pose. */
export class WalkAnimation {
  private phase = 0;
  private weight = 0;
  private stride = 0;
  private lift = 0;
  private sway = 0;
  private swing = 0;
  private side = 0;
  private effort = 0;

  /** `fast`: running, longer strides on higher knees. */
  update(dt: number, moving: boolean, animate = true, cycleSeconds = .38, fast = false) {
    const delta = Math.min(Math.max(dt, 0), .05);
    if (!animate) {
      this.phase = this.weight = this.stride = this.lift = this.sway = this.swing = this.side = this.effort = 0;
      return { stride: 0, lift: 0, sway: 0, weight: 0, swing: 0, side: 0, effort: 0 };
    }
    // Keep time through starts, stops and turns; ease the pose into and out of idle.
    this.phase = (this.phase + delta * TAU / cycleSeconds) % TAU;
    const blend = 1 - Math.exp(-delta / .055);
    this.weight += ((moving ? 1 : 0) - this.weight) * blend;
    this.stride += ((moving ? Math.sin(this.phase) * (fast ? 36 : 27) : 0) - this.stride) * blend;
    // Two rounded bounces per cycle, with matching velocity at the loop seam.
    this.lift += ((moving ? (1 - Math.cos(this.phase * 2)) * .0325 : 0) - this.lift) * blend;
    this.sway += ((moving ? Math.sin(this.phase) * 1.8 : 0) - this.sway) * blend;
    // Which leg is coming forward (the one whose knee bends), which foot bears the weight, how hard they run.
    this.swing += ((moving ? Math.cos(this.phase) : 0) - this.swing) * blend;
    this.side += ((moving ? Math.sin(this.phase) : 0) - this.side) * blend;
    this.effort += ((moving && fast ? 1 : 0) - this.effort) * blend;
    return { stride: this.stride, lift: this.lift, sway: this.sway, weight: this.weight, swing: this.swing, side: this.side, effort: this.effort };
  }
}

/** How bent an elbow hangs, relaxed. */
export const ELBOW_REST = -14;
/** How far a foot turns out, relaxed, on a rig with knees. */
export const FOOT_TURN = 10;
interface Limb { setLocalEulerAngles(x: number, y: number, z: number): void }
/** What `poseLimbs` moves: leg then arm per side, with elbows, knees and feet where the rig has them; `ankles` where a foot is a joint rather than its box. */
export interface LimbRig { limbs: Limb[]; joints: (Limb | null)[]; feet: (Limb | null)[]; ankles?: Limb[] }
export interface Gait { stride: number; swing: number; weight: number; side: number; effort: number; sway: number }

/** A leg in a gait, with its knee and its ankle: the foot stays flat on the ground until it pushes off. */
function poseLeg(rig: LimbRig, i: number, gait: Gait, crouch: number) {
  const way = i === 0 ? 1 : -1, forward = Math.max(0, -way * gait.swing);
  const hip = gait.stride * way - crouch * .5, knee = crouch + gait.weight * 5 + forward ** 1.2 * (48 + gait.effort * 26);
  rig.limbs[i].setLocalEulerAngles(hip, 0, 0);
  const joint = rig.joints[i];
  if (!joint) return;
  joint.setLocalEulerAngles(knee, 0, 0);
  const back = Math.max(0, hip) / 30, front = Math.max(0, -hip) / 30;
  // Level with the floor, then heel up behind and toes up ahead.
  const flat = -(hip + knee) + 24 * back * back - 16 * front * front, side = i === 0 ? 0 : 1;
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
    const way = i === 3 ? 1 : -1, forward = Math.max(0, -way * gait.swing);
    limb.setLocalEulerAngles(gait.stride * way * .8, 0, (i < 2 ? -1 : 1) * (breathe * 2.2 * resting + gait.weight * 2.5));
    rig.joints[i]?.setLocalEulerAngles(ELBOW_REST - gait.weight * 14 - gait.effort * 48 - forward * 18, 0, 0);
  });
}

/** The legs alone, for whoever poses their own arms (a fighter); `crouch` bends both knees, as in a ready stance. */
export function poseLegs(rig: LimbRig, gait: Gait, crouch = 0) {
  poseLeg(rig, 0, gait, crouch); poseLeg(rig, 2, gait, crouch);
}

/**
 * How a walking body carries itself: leaning into the walk, more when running, hips over the foot
 * that bears the weight, turning a little with each step; and into the turn it is making (`turn`,
 * degrees still to go). Degrees, and `shift` in model units to the side.
 */
export function carriage(gait: Gait, turn = 0) {
  return {
    pitch: gait.weight * 3.5 + gait.effort * 6,
    twist: gait.side * 3.5 * gait.weight,
    roll: gait.sway + Math.max(-6, Math.min(6, turn * .05)) * gait.weight,
    shift: gait.side * .014 * gait.weight,
  };
}

/** Breathing (0–1), eyelid scale and a slow glance (−1–1); seeds keep groups out of unison. */
export function idlePose(time: number, seed = 0) {
  const t = time + seed * 2.39;
  const blink = (t % 3.7) / 3.7 > .96 ? .12 : 1;
  return { breathe: Math.sin(t * 2.1) * .5 + .5, blink, look: Math.sin(t * .47) * Math.sin(t * .21 + 1) };
}
