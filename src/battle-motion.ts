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
/**
 * Matemágico's figures (src/math-figures.ts), drawn in his circle from CAST_LAUNCH: when each lands
 * (`contact`: the blow, the cure) and when its action is over (`end`), from the action's start.
 */
export const FIGURES = {
  cardioide: { contact: 1.5, end: 2 },
  'factor-comun': { contact: 1.64, end: 2.35 },
  vasos: { contact: 1.96, end: 2.6 },
  integral: { contact: 1.55, end: 2.05 },
  descarga: { contact: 1, end: 1.7 },
  cortocircuito: { contact: 1, end: 1.6 },
  condensador: { contact: 1.3, end: 1.8 },
  // Serie de Fourier: its circles turn out the foe's outline, which goes onto it; then a strike a circle (FOURIER_GAP apart).
  fourier: { contact: 1.6, end: 2.3 },
  // Atractor extraño: the butterfly drawn round the foe, the others' statuses streaming into it, and its collapse into the chest.
  atractor: { contact: 2.4, end: 3.4 },
} as const satisfies Record<string, { contact: number; end: number }>;
/**
 * Atractor extraño's beats, in the figure's own seconds (from CAST_LAUNCH): the pen draws the butterfly (`draw`); each other foe's
 * statuses rise off it at `leave` (a breath later for each foe after the first, and for each status after a foe's first) and reach
 * it by `arrive`; the butterfly falls into the chest over the last `fall` seconds before contact.
 */
export const ATRACTOR = { draw: .85, leave: .3, perFoe: .08, perStatus: .06, arrive: .82, fall: 1.05 } as const;
/** When the `j`th status of the `i`th foe gathered leaves it (figure seconds). */
export const atractorLeave = (i: number, j = 0) => ATRACTOR.leave + i * ATRACTOR.perFoe + j * ATRACTOR.perStatus;
/** When the `i`th foe gathered has given all it had (action seconds): its looks and its plate let go of what it carried. */
export const atractorGiven = (i: number) => CAST_LAUNCH + atractorLeave(i) + .06;
export type FigureSkill = keyof typeof FIGURES;
export const isFigure = (skill?: string): skill is FigureSkill => !!skill && skill in FIGURES;
/** Serie de Fourier's strikes, one a circle closing into a beam, this far apart. */
export const FOURIER_GAP = .09;
/** When a figure's action is over: Serie de Fourier's runs on a gap for each strike past the first. */
export const figureEnd = (skill: FigureSkill, strikes = 1) => FIGURES[skill].end + (skill === 'fourier' ? Math.max(0, strikes - 1) * FOURIER_GAP : 0);
/** Cardioide: its motes reach whoever it cures here. */
export const CURE_CONTACT = FIGURES.cardioide.contact;
export const clamp01 = (t: number) => Math.max(0, Math.min(1, t));
export const smooth = (t: number) => { t = clamp01(t); return t * t * (3 - 2 * t); };
/** Off slowly, quicker and quicker, then a short brake: how things rush into a fight (cubic in-out). */
export const surge = (t: number) => { t = clamp01(t); return t < .5 ? 4 * t * t * t : 1 - (2 - 2 * t) ** 3 / 2; };

/**
 * The fight's tempo: after each action, how long it waits before the next one starts (ms). Quick
 * always, a short breath between actors, but whatever changed gets its moment to be read before
 * anyone moves again: a status put on or spent (a fire lit or raised, bleeding, a wound opened), stats going up or down
 * (their number comes a moment after the blow's), a layer off an onion, someone going down.
 * `announce`: a foe's move has its name up top this long before the foe moves (the party's own
 * goes at once: they chose it). It is a moment to read, so the fight's clock stands still through it.
 */
export const BEAT = { breath: 250, status: 640, stats: 720, peel: 420, down: 460, dual: 900, dualSeen: 450, queue: 350, ability: 520, announce: 340 } as const;
/**
 * A dual attack's cinematic (docs/combat.md § Ataques duales), in seconds: a hit-stop freeze, then
 * the banner while the scene and the fight's clock run at DUAL_SLOW (DUAL_BANNER real seconds, or
 * DUAL_BANNER_SEEN once that dual has been seen), easing back to full speed over DUAL_EASE; its own
 * choreography lasts about DUAL_SECONDS. DUAL_CLOCK is the fight-clock time it takes all told (the
 * simulator runs that much clock after a dual).
 */
export const DUAL_FREEZE = .12, DUAL_SLOW = .35, DUAL_BANNER = 1.0, DUAL_BANNER_SEEN = .35, DUAL_EASE = .25, DUAL_SECONDS = 1.9, DUAL_CLOCK = 2.4;
/*
 * The first time a dual ever goes off (it was not found yet), time stops before it: the scene and
 * the fight's clock stand still under «DÚO DESBLOQUEADO», its name and what it does, until a player
 * confirms (battle-ui `holdUntilConfirm`); then the cinematic above plays as always. The fight's
 * clock does not run meanwhile, so the simulator's count does not change.
 */
/**
 * After a dual, the time to take it in (BEAT.dual, or BEAT.dualSeen once that dual has been seen); after a foe's ability that is not a plain blow
 * (`card`, its own picture in the scene) or a move announced a turn ahead, the time to see it (BEAT.ability).
 */
export function holdAfter(effect: { status?: unknown; burn?: unknown; bled?: number; stats?: readonly unknown[]; boosted?: readonly unknown[]; peeled?: number; melted?: boolean; hits?: readonly { status?: unknown; bled?: number }[]; dual?: unknown; ability?: { card?: boolean }; telegraph?: unknown; reaction?: unknown; gathered?: readonly unknown[] }, down = false, seen = false) {
  let hold: number = BEAT.breath;
  if (effect.dual) hold = Math.max(hold, seen ? BEAT.dualSeen : BEAT.dual);
  if (effect.ability?.card || effect.telegraph) hold = Math.max(hold, BEAT.ability);
  if (effect.status || effect.burn || effect.bled || effect.melted || effect.reaction || effect.gathered?.length || effect.hits?.some(h => h.status || h.bled)) hold = Math.max(hold, BEAT.status);
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
