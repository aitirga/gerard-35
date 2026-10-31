/**
 * The street camera looks for Gerard when a building hides him (docs/graphics.md, "Seeing Gerard
 * behind things"). It is automatic: the camera tilts up or swings round him to the nearest angle
 * from which nobody is hidden, waits there while that still works, and settles back to its own
 * angle once he is in the open. Interiors keep folding their walls instead; only places with
 * buildings ask (src/geo-scenery.ts `sight`).
 *
 * Small moves come first: tilting up keeps every direction on screen where it was, so it is
 * preferred to swinging round, and a swing prefers the side the camera is already on. It waits
 * `HIDDEN_DWELL` before moving (passing a corner never swings it) and `RETURN_DWELL` before coming
 * back (no ping-pong at the edge of a block). While it moves, the building's see-through window
 * still shows him.
 */

export interface CameraPose {
  /** Degrees round the vertical: the camera stands at (sin yaw, cos yaw) from what it looks at. */
  yaw: number;
  /** Degrees above the horizon it looks down from. */
  pitch: number;
}
export interface Point3 { x: number; y: number; z: number }

/** The game's own angle: from the south-east, (40, 52, 40) away from Gerard. */
export const HOME_POSE: CameraPose = { yaw: 45, pitch: Math.atan2(52, Math.hypot(40, 40)) * 180 / Math.PI };
export const CAMERA_DISTANCE = Math.hypot(40, 52, 40);
/** Every angle tried, home first: tilted up to 55° and 68°, swung up to a quarter turn either way. */
const PITCHES = [HOME_POSE.pitch, 55, 68];
const SWINGS = [0, 30, -30, 60, -60, 90, -90];
export const POSES: CameraPose[] = SWINGS.flatMap(swing => PITCHES.map(pitch => swing === 0 && pitch === HOME_POSE.pitch ? HOME_POSE : { yaw: HOME_POSE.yaw + swing, pitch }));
/** What a pose costs, in degrees: swinging round counts in full, tilting up less, and leaving the side the camera is on a third more. */
const COST = { pitch: 1, stay: 0.35 };
/**
 * Seconds hidden before the camera moves, seconds a cheaper angle must work before it comes back,
 * and seconds it keeps a new angle before changing its mind again.
 */
export const HIDDEN_DWELL = 0.35;
export const RETURN_DWELL = 1.2;
export const HOLD = 1;
/** Seconds between searches, how quickly it turns (1/s) and its fastest turn and tilt (degrees/s). */
const SEARCH_EVERY = 0.1;
const TURN_RATE = 3;
const MAX_SWING = 80;
const MAX_TILT = 50;

/**
 * How a camera searches: `swing` lets it swing round (otherwise it only tilts up, so directions on
 * screen never change), `hiddenDwell` seconds hidden before it moves, `maxTilt` degrees a second.
 */
export interface OrbitOptions { swing?: boolean; hiddenDwell?: number; maxTilt?: number }

const radians = Math.PI / 180;
/** The camera's offset from what it looks at. */
export function cameraOffset(pose: CameraPose, distance = CAMERA_DISTANCE): Point3 {
  const flat = Math.cos(pose.pitch * radians) * distance;
  return { x: Math.sin(pose.yaw * radians) * flat, y: Math.sin(pose.pitch * radians) * distance, z: Math.cos(pose.yaw * radians) * flat };
}
/** The unit direction from what it looks at towards the camera. */
export function towardCamera(pose: CameraPose): Point3 { return cameraOffset(pose, 1); }

function cost(pose: CameraPose, from: CameraPose) {
  return Math.abs(pose.yaw - HOME_POSE.yaw) + COST.pitch * (pose.pitch - HOME_POSE.pitch) + COST.stay * Math.abs(pose.yaw - from.yaw);
}
function approach(value: number, target: number, dt: number, max: number) {
  const step = (target - value) * (1 - Math.exp(-dt * TURN_RATE));
  const next = value + Math.sign(step) * Math.min(Math.abs(step), max * dt);
  return Math.abs(target - next) < 0.05 ? target : next;
}

/**
 * `sight(pose)` says how many of the people followed a building hides from a camera at that pose;
 * without it (a fight, a cut-scene, the overview, a place without buildings) the camera goes home.
 */
export function createCameraOrbit({ swing = true, hiddenDwell = HIDDEN_DWELL, maxTilt = MAX_TILT }: OrbitOptions = {}) {
  const poses = swing ? POSES : POSES.filter(p => p.yaw === HOME_POSE.yaw);
  const pose: CameraPose = { ...HOME_POSE };
  let target: CameraPose = HOME_POSE;
  let wait = 0, worse = 0, better = 0, hold = 0;
  /** The cheapest pose that hides the fewest people, and how many it hides. */
  function search(sight: (pose: CameraPose) => number) {
    let best = target, hidden = sight(target), price = cost(target, target);
    if (hidden === 0 && target === HOME_POSE) return { best, hidden };
    for (const candidate of poses) {
      if (candidate === target) continue;
      const price2 = cost(candidate, target);
      if (hidden === 0 && price2 >= price) continue;
      const hidden2 = sight(candidate);
      if (hidden2 < hidden || (hidden2 === hidden && price2 < price)) { best = candidate; hidden = hidden2; price = price2; }
    }
    return { best, hidden };
  }
  return {
    /** Where the camera is now (eased towards `target`). */
    pose: pose as Readonly<CameraPose>,
    get target(): Readonly<CameraPose> { return target; },
    /** Whether it has arrived where it is heading. */
    get settled() { return pose.yaw === target.yaw && pose.pitch === target.pitch; },
    /** Back home at once (a new scene). */
    reset() { target = HOME_POSE; Object.assign(pose, HOME_POSE); wait = worse = better = hold = 0; },
    /**
     * `snap` (reduced motion) cuts to the new angle instead of turning. `'keep'` (someone is talking)
     * finishes the turn under way without looking for another angle.
     */
    update(dt: number, sight?: ((pose: CameraPose) => number) | 'keep', snap = false) {
      hold -= dt;
      if (sight === 'keep') { /* finish the turn */ }
      else if (!sight) { target = HOME_POSE; worse = better = 0; }
      else if ((wait -= dt) <= 0 && hold <= 0) {
        wait = SEARCH_EVERY;
        const now = sight(target);
        const { best, hidden } = search(sight);
        // Someone is hidden and another angle shows more: go there once it has lasted a moment.
        worse = best !== target && hidden < now ? worse + SEARCH_EVERY : 0;
        // As many are seen from a cheaper angle (nearer home): come back once it has lasted a while.
        better = best !== target && hidden === now ? better + SEARCH_EVERY : 0;
        if (worse >= hiddenDwell - 1e-9 || better >= RETURN_DWELL - 1e-9) { target = best; worse = better = 0; hold = HOLD; }
      }
      if (snap) { pose.yaw = target.yaw; pose.pitch = target.pitch; return; }
      pose.yaw = approach(pose.yaw, target.yaw, dt, MAX_SWING);
      pose.pitch = approach(pose.pitch, target.pitch, dt, maxTilt);
    },
  };
}
