/** Shared choreography in seconds; combat rules remain independent. */
export const ENTRY_SECONDS = 1.45;
export const CONTACT_SECONDS = .46;
export const ACTION_SECONDS = 1.16;
export const clamp01 = (t: number) => Math.max(0, Math.min(1, t));
export const smooth = (t: number) => { t = clamp01(t); return t * t * (3 - 2 * t); };
export interface GroundPoint { x: number; z: number }

/** Stop within reach of the target, hold contact, then return along the same path. */
export function contactMotion(from: GroundPoint, target: GroundPoint, seconds: number, reach = 1.65) {
  const dx = target.x - from.x, dz = target.z - from.z;
  const distance = Math.hypot(dx, dz);
  const ux = distance > .001 ? dx / distance : 0, uz = distance > .001 ? dz / distance : 0;
  const approach = smooth((seconds - .12) / (CONTACT_SECONDS - .12));
  const retreat = smooth((seconds - .62) / .44);
  const travel = Math.max(0, distance - reach) * approach * (1 - retreat);
  const windup = seconds < .12 ? Math.sin(clamp01(seconds / .12) * Math.PI) * .12 : 0;
  const recoil = seconds < CONTACT_SECONDS ? 0 : Math.sin(clamp01((seconds - CONTACT_SECONDS) / .36) * Math.PI);
  return { x: from.x + ux * (travel - windup), z: from.z + uz * (travel - windup), ux, uz, approach, retreat, recoil };
}
