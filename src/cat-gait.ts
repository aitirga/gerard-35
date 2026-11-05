/**
 * How Haru and Yuki move (src/cats.ts draws them): a pure gait, no engine. Every frame it reads
 * where the cat is and what it is doing, and gives back a pose: the body's height and tilt, both
 * joints of each leg, the head, the ears, the eyelids and the tail.
 *
 * The legs are the rigorous part. Each paw has a target on the ground and a two-bone inverse
 * kinematics finds the hip (or shoulder) and knee (or wrist) that put it there, whatever the body
 * does: standing, sitting, crouching, breathing, bobbing. While a paw bears weight (stance) it
 * stays still on the ground; the cat's own speed sets how far it travels backwards under the body
 * and the cycle's period, so stride length always equals speed × stance time and no paw slides.
 * Three gaits, as real cats use them: a walk (lateral sequence: left hind, left fore, right hind,
 * right fore), a trot (diagonal pairs) and a gallop (hinds together, then fores; the faster, the
 * shorter each paw's stance). Speeds blend from one to the next with hysteresis, so a cat at the
 * edge between two gaits does not flicker.
 *
 * Units are the cat's own (before the 1.35 the game scales it by): the ground is y = 0, the cat
 * faces +z. Angles out are in degrees; legs and the tail are "forward positive" (a leg swung
 * forward, a tail bent towards the head), the body and head "nose up positive".
 */
const TAU = Math.PI * 2, DEG = 180 / Math.PI;
export const CAT_LEGS = ['lf', 'rf', 'lh', 'rh'] as const;
export type CatLeg = typeof CAT_LEGS[number];
export type CatGaitId = 'walk' | 'trot' | 'gallop';

/** The skeleton src/cats.ts builds: body pivot height, where each leg hangs from it, bone lengths. */
export const CAT_RIG = {
  /** The body pivot's height when standing. */
  bodyY: .2,
  /** Shoulder and hip, from the body pivot. */
  joints: {
    lf: { x: .065, y: -.05, z: .12 }, rf: { x: -.065, y: -.05, z: .12 },
    lh: { x: .065, y: -.05, z: -.13 }, rh: { x: -.065, y: -.05, z: -.13 },
  },
  /**
   * Upper and lower bone of each leg; the paw's sole is at the end of the lower one. As in a cat,
   * the hind legs are longer and stand folded in a Z (81% of their length), the forelegs nearly
   * straight (91%); neither is ever straight, where the solver's joint would snap.
   */
  bones: { lf: [.085, .08], rf: [.085, .08], lh: [.095, .09], rh: [.095, .09] },
  /**
   * Which way each leg's middle joint points: the foreleg's wrist bends with the paw curling back
   * (joint forward, +1); the hind leg's hock points back (−1).
   */
  bend: { lf: 1, rf: 1, lh: -1, rh: -1 },
  tailSegments: 4,
  tailSegment: .07,
} as const;

interface GaitSpec { duty: (v: number) => number; offsets: Record<CatLeg, number>; stride: number; maxStride: number; minPeriod: number; lift: number; bob: number; drop: number }
/**
 * `duty` is the share of the cycle a paw bears weight; `stride` the length the cat prefers and
 * `maxStride` the most a leg reaches; `minPeriod` how fast the legs can cycle (s).
 */
export const GAITS: Record<CatGaitId, GaitSpec> = {
  walk: { duty: () => .6, offsets: { lh: 0, lf: .25, rh: .5, rf: .75 }, stride: .1, maxStride: .135, minPeriod: .32, lift: .03, bob: .005, drop: 0 },
  trot: { duty: () => .5, offsets: { lf: 0, rh: 0, rf: .5, lh: .5 }, stride: .14, maxStride: .19, minPeriod: .2, lift: .028, bob: .009, drop: .016 },
  // A gallop shortens each paw's stance as it speeds up: longer flights, the same reach.
  gallop: { duty: v => Math.min(.4, Math.max(.2, .42 - .04 * v)), offsets: { lh: 0, rh: .08, lf: .45, rf: .55 }, stride: .2, maxStride: .24, minPeriod: .2, lift: .034, bob: .012, drop: .03 },
};
/** The slowest the legs cycle: below it, strides shorten instead. */
export const MAX_PERIOD = .9;
/** Gait changes (cat units per second), each with its way back a little lower. */
const UP = { walk: .72, trot: 1.9 }, DOWN = { trot: .58, gallop: 1.65 };
/** Below this the cat is standing. */
const STILL = .03;

export interface CatInput {
  /** Where the cat stands in the world and which way it faces (degrees, as the game sets its yaw). */
  x: number; z: number; facing: number;
  /** World units per cat unit (1.35 in the game). */
  scale: number;
  /** False (reduced motion, a frozen frame): a still, standing cat. */
  animate?: boolean;
  /** 0–1: sitting down (a cat that has stopped for a while, or waits). */
  sit?: number;
  /** 0–1: low to the ground, about to pounce. */
  crouch?: number;
  /** 0–1: afraid (low, ears flat, tail tucked): Yuki hiding. */
  fear?: number;
  /** 0–1: watching something (head forward, ears up, the tail's tip flicking). */
  alert?: number;
  /** 0–1 along a jump (0 take-off, 1 landing); the caller lifts the cat off the ground. */
  leap?: number;
}
export interface LegPose { hip: number; knee: number }
export interface CatPose {
  body: { y: number; z: number; pitch: number; roll: number; yaw: number };
  legs: Record<CatLeg, LegPose>;
  head: { pitch: number; yaw: number; roll: number };
  /** Each ear's turn back (degrees): a flick, or flat with fear. */
  ears: [number, number];
  /** Each tail segment from the root: bend towards the head (pitch) and to a side (side). */
  tail: { pitch: number; side: number }[];
  /** Eyelids: 1 open, near 0 shut. */
  blink: number;
  /** What the cat is doing, for tests and debugging. */
  gait: CatGaitId; speed: number; period: number; moving: number;
  /** Where each paw is meant to be (cat frame), and whether it is bearing weight. */
  targets: Record<CatLeg, { z: number; y: number; stance: boolean }>;
}

/** Nose-up rotation of a point (y, z) by `pitch` (radians) about the body pivot. */
function pitched(y: number, z: number, pitch: number) {
  const c = Math.cos(pitch), s = Math.sin(pitch);
  return { y: y * c + z * s, z: -y * s + z * c };
}
/** Past this share of its length a leg straightens softly instead of hitting the stop. */
const SOFT = .95;
/**
 * Two-bone inverse kinematics in the leg's plane: the joint at the origin, the paw wanted at
 * (z, y). Returns the upper bone's angle (forward positive, from straight down) and the lower
 * bone's bend relative to it, both in radians. Within 95% of the leg's length the paw lands
 * exactly; past it the reach eases towards straight (a straight leg is where the joint's angle
 * would whip round for the smallest move), so a paw near the limit falls a hair short.
 */
export function solveLeg(z: number, y: number, bend: 1 | -1, a: number, b: number) {
  const length = a + b, wanted = Math.hypot(z, y), soft = SOFT * length, room = length - soft - 1e-4;
  const reach = wanted <= soft ? wanted : soft + room * Math.tanh((wanted - soft) / room);
  const d = Math.max(Math.abs(a - b) + 1e-4, reach);
  const toward = Math.atan2(z, -y);
  const atHip = Math.acos(Math.min(1, Math.max(-1, (a * a + d * d - b * b) / (2 * a * d))));
  const atKnee = Math.acos(Math.min(1, Math.max(-1, (a * a + b * b - d * d) / (2 * a * b))));
  const hip = toward + bend * atHip;
  return { hip, knee: -bend * (Math.PI - atKnee) };
}
/** Where a leg's paw ends up in the cat's frame for a pose: forward kinematics, for tests. */
export function pawOf(pose: CatPose, leg: CatLeg) {
  const j = CAT_RIG.joints[leg], pitch = pose.body.pitch / DEG;
  const joint = pitched(j.y, j.z, pitch);
  const hip = pose.legs[leg].hip / DEG, knee = hip + pose.legs[leg].knee / DEG;
  // Bone directions in the body's frame (down is −y, forward +z), then turned with the body.
  const [a, b] = CAT_RIG.bones[leg];
  const local = { z: Math.sin(hip) * a + Math.sin(knee) * b, y: -Math.cos(hip) * a - Math.cos(knee) * b };
  const turned = pitched(local.y, local.z, pitch);
  return { z: pose.body.z + joint.z + turned.z, y: pose.body.y + joint.y + turned.y };
}
/** A smooth 0–1 that eases in and out. */
const ease = (s: number) => (1 - Math.cos(Math.PI * Math.min(1, Math.max(0, s)))) / 2;
const approach = (from: number, to: number, dt: number, tau: number) => from + (to - from) * (1 - Math.exp(-dt / tau));
/** A repeatable 0–1 noise for a whole number and a seed (ear flicks, glances). */
const hash = (n: number, seed: number) => { const v = Math.sin(n * 127.1 + seed * 311.7) * 43758.5453; return v - Math.floor(v); };

/** One cat's gait over time. `seed` keeps two cats out of step. */
export class CatGait {
  private phase: number;
  private time: number;
  private speed = 0;
  private turn = 0;
  private gait: CatGaitId = 'walk';
  private weights: Record<CatGaitId, number> = { walk: 1, trot: 0, gallop: 0 };
  private moving = 0;
  private last?: { x: number; z: number; facing: number };
  private held = { sit: 0, crouch: 0, fear: 0, alert: 0 };
  private seed: number;
  constructor(seed = 0) { this.seed = seed; this.phase = hash(1, seed); this.time = seed * 3.1; }

  update(dt: number, input: CatInput): CatPose {
    const delta = Math.min(Math.max(dt, 0), .1);
    const animate = input.animate !== false;
    this.measure(delta, input);
    if (!animate) return this.rest();
    this.time += delta;
    // What the caller asks for, eased so a change of mind never snaps the pose.
    for (const key of ['sit', 'crouch', 'fear', 'alert'] as const) this.held[key] = approach(this.held[key], Math.min(1, Math.max(0, input[key] ?? 0)), delta, .22);
    const { sit, crouch, fear, alert } = this.held;
    const leap = input.leap !== undefined && input.leap > 0 && input.leap < 1 ? input.leap : undefined;
    // Turning on the spot shuffles the paws a little; sitting or flying, they stay put.
    const v = leap !== undefined || sit > .5 ? 0 : Math.max(this.speed, Math.min(.35, this.turn * .1));
    const goes = v > STILL ? 1 : 0;
    this.moving = approach(this.moving, goes, delta, .12);
    this.chooseGait(v);
    for (const id of Object.keys(this.weights) as CatGaitId[]) this.weights[id] = approach(this.weights[id], id === this.gait ? 1 : 0, delta, .16);
    const total = this.weights.walk + this.weights.trot + this.weights.gallop;
    const w = { walk: this.weights.walk / total, trot: this.weights.trot / total, gallop: this.weights.gallop / total };
    // The cycle's period: each gait's preferred stride at this speed, never faster than the legs can go.
    const speed = Math.max(v, 1e-3);
    let period = 0;
    for (const id of Object.keys(w) as CatGaitId[]) {
      const spec = GAITS[id];
      period += w[id] * Math.min(MAX_PERIOD, Math.max(spec.minPeriod, spec.stride / (speed * spec.duty(speed))));
    }
    this.phase = (this.phase + delta / period) % 1;
    const m = this.moving, phase = this.phase;

    // The body: standing, sitting (rear on the floor), crouching low; then the gait's bob and sway, and breath.
    const crouched = Math.max(crouch, fear);
    let y = CAT_RIG.bodyY + (.13 - CAT_RIG.bodyY) * sit + (.125 - CAT_RIG.bodyY) * crouched * (1 - sit) - .012 * alert * (1 - sit);
    const posture = 32 * sit - 4 * crouched * (1 - sit) - 3 * alert;
    let pitch = posture;
    const z = -.02 * sit;
    let roll = 0;
    // Running, the body drops a little: bent legs reach further.
    for (const id of Object.keys(w) as CatGaitId[]) y -= w[id] * m * (GAITS[id].bob * ease((Math.cos(TAU * 2 * phase) + 1) / 2) + GAITS[id].drop);
    // Galloping the body rocks, never so much that a hind leg loses the ground.
    pitch += w.gallop * m * 3.5 * Math.sin(TAU * phase);
    roll += w.walk * m * 1.6 * Math.sin(TAU * phase);
    const breath = Math.sin(this.time * TAU / (2.6 + sit * .8) + this.seed) * .5 + .5;
    y += .003 * breath * (1 - m * .8);
    // Waiting to pounce, the rear wiggles.
    const wiggle = crouch * (1 - fear) * Math.sin(this.time * 17) * 3;
    // A jump: nose up rising, down landing.
    const air = leap !== undefined ? Math.sin(Math.PI * leap) : 0;
    if (leap !== undefined) pitch += 16 * Math.cos(Math.PI * leap);
    const bodyPitch = pitch / DEG;

    const legs = {} as Record<CatLeg, LegPose>, targets = {} as CatPose['targets'];
    for (const leg of CAT_LEGS) {
      const j = CAT_RIG.joints[leg], hind = leg[1] === 'h';
      const joint = pitched(j.y, j.z, bodyPitch);
      const jointZ = z + joint.z, jointY = y + joint.y;
      // The paw's resting place: under its joint as the posture holds it (not as the gait rocks it,
      // or a planted paw would rock too); sitting, the hind paws tuck forward under the haunch.
      const rest = z + pitched(j.y, j.z, posture / DEG).z + (hind ? .05 * sit : 0) + (hind ? .015 : -.01) * crouched;
      let dz = 0, dy = 0, stance = true;
      for (const id of Object.keys(w) as CatGaitId[]) {
        if (w[id] < 1e-3) continue;
        const spec = GAITS[id], duty = spec.duty(speed);
        const stride = Math.min(spec.maxStride, v * duty * period);
        const p = (phase + spec.offsets[leg]) % 1;
        if (p < duty) {
          // Bearing weight: the paw stays where it landed while the body passes over it.
          dz += w[id] * (stride / 2 - stride * p / duty);
        } else {
          // In the air: over the ground the paw leaves and lands at rest (eased from one footprint to
          // the next, a cycle's travel ahead), so seen from the body it goes on moving back at the
          // cat's speed at both ends and never jerks at lift-off or touchdown. It rises and sets down softly.
          // Galloping, a paw's stance is so short that landing at rest would fling it far past what the
          // leg reaches; the shorter the stance, the more the swing is eased from the body instead.
          const s = (p - duty) / (1 - duty), flight = v * (1 - duty) * period * Math.min(1, 2 * duty);
          dz += w[id] * (-stride / 2 + (stride + flight) * ease(s) - flight * s);
          dy += w[id] * Math.min(spec.lift, .015 + stride * .3) * 16 * s * s * (1 - s) * (1 - s);
          if (w[id] > .5) stance = false;
        }
      }
      const target = { z: rest + dz * m, y: dy * m };
      targets[leg] = { z: target.z, y: target.y, stance };
      // Into the body's frame, and solved.
      const local = pitched(target.y - jointY, target.z - jointZ, -bodyPitch);
      const solved = solveLeg(local.z, local.y, CAT_RIG.bend[leg], CAT_RIG.bones[leg][0], CAT_RIG.bones[leg][1]);
      let hip = solved.hip * DEG, knee = solved.knee * DEG;
      if (air) {
        // In the air the forelegs reach for the landing and the hind legs push back.
        const flying = hind ? { hip: -62, knee: 28 } : { hip: 58, knee: -18 };
        hip += (flying.hip - hip) * air; knee += (flying.knee - knee) * air;
      }
      legs[leg] = { hip, knee };
    }

    // Head: level against the body's bob and tilt, glancing round when still, lower and forward when watching or afraid.
    // Every few seconds the head turns to a new spot, and stays there.
    const beat = this.time / 2.8 + this.seed, at = Math.floor(beat), turning = ease((beat - at) * 4);
    const glance = (hash(at - 1, this.seed) * 2 - 1) * (1 - turning) + (hash(at, this.seed) * 2 - 1) * turning;
    const head = {
      pitch: -pitch * .75 + 6 * sit - 10 * fear - 6 * crouch + 2 * m * Math.sin(TAU * 2 * phase) - 4 * w.gallop * m,
      yaw: glance * 28 * (1 - m * .8) * (1 - alert) * (1 - fear * .7),
      roll: glance * 6 * (1 - m) * (1 - alert),
    };
    // Ears: now and then one flicks; flat back with fear, pricked forward when watching.
    const flickAt = Math.floor(this.time / 1.9 + this.seed * .37);
    const flickT = (this.time / 1.9 + this.seed * .37) % 1;
    const flicking = hash(flickAt, this.seed + 9) > .6 && flickT < .14 ? Math.sin(flickT / .14 * Math.PI) : 0;
    const side = hash(flickAt, this.seed + 4) > .5 ? 0 : 1;
    const ears: [number, number] = [0, 1].map(i => 55 * fear - 10 * alert * (1 - fear) + (i === side ? 30 * flicking : 0)) as [number, number];
    // Eyelids: a blink every few seconds, slower and heavier when sitting.
    const blinkAt = (this.time + this.seed * 1.7) % (3.4 + sit * 1.5);
    const blink = blinkAt < .14 ? .12 + .88 * Math.abs(blinkAt / .07 - 1) : 1;

    // The tail: low and loose standing, up with a hooked tip walking, out behind galloping,
    // down and round the paws sitting, tucked with fear; a wave runs down it to the tip.
    const base = -110 * (1 - m) + m * (w.walk * -30 + w.trot * -50 + w.gallop * -82);
    const tailBase = base * (1 - sit) * (1 - fear) * (1 - crouch * .5) - 150 * sit * (1 - fear) - 165 * fear - 100 * crouch * .5 * (1 - fear) * (1 - sit);
    const curl = (i: number) => (1 - sit) * (1 - fear) * ((1 - m) * [0, 10, 12, 14][i] + m * (w.walk * [0, 15, 25, 30][i] + w.trot * [0, 10, 18, 22][i] + w.gallop * [0, 4, 6, 8][i])) + sit * [0, -25, 0, 0][i];
    const sway = (1 - fear) * (1 - sit * .8) * ((1 - m) * 10 + m * 8);
    const rate = m ? TAU / period : TAU * .55;
    const tail = Array.from({ length: CAT_RIG.tailSegments }, (_, i) => ({
      pitch: i === 0 ? tailBase : curl(i),
      side: sway * (.4 + i * .3) * Math.sin((m ? phase * TAU : this.time * rate) - i * .7)
        + sit * (1 - fear) * [0, 30, 38, 40][i]
        // Watching, only the tip twitches, fast.
        + (i === CAT_RIG.tailSegments - 1 ? alert * 22 * Math.sin(this.time * 9 + this.seed) : 0),
    }));
    return {
      body: { y, z, pitch, roll, yaw: wiggle },
      legs, head, ears, tail, blink,
      gait: this.gait, speed: v, period, moving: m, targets,
    };
  }

  /** The cat's own speed (cat units per second) and how fast it turns, from where it is each frame. */
  private measure(dt: number, input: CatInput) {
    const last = this.last;
    this.last = { x: input.x, z: input.z, facing: input.facing };
    if (!last || dt <= 0) return;
    const moved = Math.hypot(input.x - last.x, input.z - last.z);
    // A jump across the room (a door, a teleport) is not a sprint.
    const raw = moved > 1.5 ? 0 : moved / dt / Math.max(input.scale, 1e-3);
    this.speed = approach(this.speed, raw, dt, .1);
    const turned = Math.abs(((input.facing - last.facing) % 360 + 540) % 360 - 180);
    this.turn = approach(this.turn, turned > 90 ? 0 : turned / DEG / dt, dt, .12);
  }
  /** Hysteresis between gaits: a cat at the edge of two keeps the one it has. */
  private chooseGait(v: number) {
    if (this.gait === 'walk' && v > UP.walk) this.gait = 'trot';
    else if (this.gait === 'trot' && v > UP.trot) this.gait = 'gallop';
    else if (this.gait === 'trot' && v < DOWN.trot) this.gait = 'walk';
    else if (this.gait === 'gallop' && v < DOWN.gallop) this.gait = 'trot';
  }
  /** Standing still on all four, no breath: reduced motion and frozen frames. */
  private rest(): CatPose {
    const legs = {} as Record<CatLeg, LegPose>, targets = {} as CatPose['targets'];
    for (const leg of CAT_LEGS) {
      const j = CAT_RIG.joints[leg];
      const solved = solveLeg(0, -(CAT_RIG.bodyY + j.y), CAT_RIG.bend[leg], CAT_RIG.bones[leg][0], CAT_RIG.bones[leg][1]);
      legs[leg] = { hip: solved.hip * DEG, knee: solved.knee * DEG };
      targets[leg] = { z: j.z, y: 0, stance: true };
    }
    return {
      body: { y: CAT_RIG.bodyY, z: 0, pitch: 0, roll: 0, yaw: 0 }, legs,
      head: { pitch: 0, yaw: 0, roll: 0 }, ears: [0, 0],
      tail: Array.from({ length: CAT_RIG.tailSegments }, (_, i) => ({ pitch: i === 0 ? -110 : [0, 10, 12, 14][i], side: 0 })),
      blink: 1, gait: 'walk', speed: 0, period: MAX_PERIOD, moving: 0, targets,
    };
  }
}
