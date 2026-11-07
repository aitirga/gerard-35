/** Shared choreography in seconds; combat rules remain independent. */
/** A fight coming in: everyone to their places and the camera onto them, gathering speed. */
export const ENTRY_SECONDS = 1.05;
export const CONTACT_SECONDS = .46;
export const ACTION_SECONDS = 1.16;
/** A cast (Foc Binari): the hand goes up, the fire leaves it, and it lands this long after. */
export const CAST_LAUNCH = .38, CAST_FLIGHT = .42, CAST_CONTACT = CAST_LAUNCH + CAST_FLIGHT;
/** Foc Binari's two braided streams, the zero and then the one, land a hair apart: a quick tac-tac. */
export const CAST_GAP = .085;
/**
 * Matemágico's Atacar and Ángulo exacto (src/math-cast.ts): the hand up and the circle open, the ball
 * leaves at SPELL_LAUNCH and lands SPELL_FLIGHT later.
 */
export const SPELL_LAUNCH = .44, SPELL_FLIGHT = .4, SPELL_CONTACT = SPELL_LAUNCH + SPELL_FLIGHT;
/** Cardioide: its comet leaves the circle at CAST_LAUNCH and reaches whoever it cures here. */
export const CURE_CONTACT = CAST_LAUNCH + .24;
export const clamp01 = (t: number) => Math.max(0, Math.min(1, t));
export const smooth = (t: number) => { t = clamp01(t); return t * t * (3 - 2 * t); };
/** Off slowly, quicker and quicker, then a short brake: how things rush into a fight (cubic in-out). */
export const surge = (t: number) => { t = clamp01(t); return t < .5 ? 4 * t * t * t : 1 - (2 - 2 * t) ** 3 / 2; };

/**
 * The fight's tempo: after each action, how long it waits before the next one starts (ms). Quick
 * always, a short breath between actors, but whatever changed gets its moment to be read before
 * anyone moves again: a status put on or spent (a fire lit or raised, bleeding, a wound opened), stats going up or down
 * (their number comes a moment after the blow's), a layer off an onion, someone going down.
 */
export const BEAT = { breath: 170, status: 640, stats: 720, peel: 420, down: 460, dual: 900, dualSeen: 450, queue: 350, ability: 520 } as const;
/**
 * A dual attack's cinematic (docs/combat.md § Ataques duales), in seconds: a hit-stop freeze, then
 * the banner while the scene and the fight's clock run at DUAL_SLOW (DUAL_BANNER real seconds, or
 * DUAL_BANNER_SEEN once that dual has been seen), easing back to full speed over DUAL_EASE; its own
 * choreography lasts about DUAL_SECONDS. DUAL_CLOCK is the fight-clock time it takes all told (the
 * simulator runs that much clock after a dual).
 */
export const DUAL_FREEZE = .12, DUAL_SLOW = .35, DUAL_BANNER = 1.0, DUAL_BANNER_SEEN = .35, DUAL_EASE = .25, DUAL_SECONDS = 1.9, DUAL_CLOCK = 2.4;
/**
 * After a dual, the time to take it in (BEAT.dual, or BEAT.dualSeen once that dual has been seen); after a foe's ability that is not a plain blow
 * (`card`, its own picture in the scene) or a move announced a turn ahead, the time to see it (BEAT.ability).
 */
export function holdAfter(effect: { status?: unknown; burn?: unknown; bled?: number; stats?: readonly unknown[]; boosted?: readonly unknown[]; peeled?: number; melted?: boolean; hits?: readonly { status?: unknown; bled?: number }[]; dual?: unknown; ability?: { card?: boolean }; telegraph?: unknown; reaction?: unknown }, down = false, seen = false) {
  let hold: number = BEAT.breath;
  if (effect.dual) hold = Math.max(hold, seen ? BEAT.dualSeen : BEAT.dual);
  if (effect.ability?.card || effect.telegraph) hold = Math.max(hold, BEAT.ability);
  if (effect.status || effect.burn || effect.bled || effect.melted || effect.reaction || effect.hits?.some(h => h.status || h.bled)) hold = Math.max(hold, BEAT.status);
  if (effect.stats?.length || effect.boosted?.length) hold = Math.max(hold, BEAT.stats);
  if (effect.peeled) hold = Math.max(hold, BEAT.peel);
  if (down) hold = Math.max(hold, BEAT.down);
  return hold;
}
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
