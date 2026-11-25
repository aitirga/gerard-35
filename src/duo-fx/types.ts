import type { BattleEffect, BattleState, ClassId, DualId } from '../battle';
import type { DualFx, V3 } from '../dual-fx';
import type { Effects } from '../effects';
import type { FluidFx } from '../fluid-fx';
import type { NeonDraw, NeonFigure, NeonFrame, NeonLook, NeonStroke } from '../math-figures';
import type { SoundId } from '../sfx';

/**
 * Each of the newer duals draws its own picture from its own file here (docs/graphics.md § Ataques
 * duales): how it starts (`start`), how it lands (`land`), and what it keeps drawing while the
 * timed status it leaves stands (`hold`). The fight scene (src/battle-scene.ts) knows nothing of
 * them but this: it hands each a `DuoStage`, a view of the fight as plain points, and its own few
 * levers (a flash on a fighter, the shake, the bloom, a sound), and runs them on the fight's clock.
 */

/** A fighter as a dual sees it: where it is and how big, in world metres. */
export interface DuoFighter {
  id: string;
  party: boolean;
  /** Chest-high, where a blow lands. */
  chest: V3;
  /** On the floor under it. */
  feet: V3;
  /** Its hand (a party fighter's), where a thread or a throw leaves from. */
  hand?: V3;
  /** Half its width and its height. */
  radius: number;
  height: number;
  /** A giant of tiles (Vertitrón): flash it less. */
  rigid: boolean;
  /** The ánima it wears (party only). */
  anima?: ClassId;
  hp: number;
  /** Its slot in the fight's GPU particles (`shape: 'surface'`, `fighter: index`: born on its body), or -1. */
  index: number;
}

export interface DuoStage {
  /** Lines, rings, digits, bursts of any GPU kind, and `after` on the fight's clock (src/dual-fx.ts). */
  fx: DualFx;
  /** Fire, lava, smoke and water as fluids that push and carry each other (src/fluid-fx.ts). */
  fluid: FluidFx;
  /** Trails, elements, the fight's GPU engine (`effects.gpu`), statuses' own looks (src/effects.ts). */
  effects: Effects;
  /** From whoever it lands on towards the camera (for figures that face it: `screenAxes(view)`). */
  view: V3;
  fighter(id: string): DuoFighter | undefined;
  /** Standing foes (not a boss's parts), and the standing party. */
  foes(): DuoFighter[];
  party(): DuoFighter[];
  /** Whoever brings this ánima's half of the dual now playing (or any party member wearing it). */
  wearer(anima: ClassId): DuoFighter | undefined;
  /** Where Bip hovers, if Tecnópata's drone is out. */
  bip(): V3 | undefined;
  /** Where Papagato's cat (Haru) is now, on the floor, for whoever wears it (`wearer`'s id), if she is out. */
  cat(wearer: string): V3 | undefined;
  /** A flash of `rgb` (0–1) on a fighter, `strength` about 1 (a big blow 1.5). */
  hit(id: string, rgb: readonly [number, number, number], strength?: number): void;
  /** The picture shakes at least this much (.1 a tap, .6 a big blow). */
  shake(amount: number): void;
  /** The screen's fringe, bloom and a white flash, 0–1 each. */
  pulse(fringe: number, bloom: number, flash?: number): void;
  /** A punch in of the camera: 0–1. */
  punch(amount: number): void;
  /** A sound of the fight's own (src/sfx.ts `SoundId`), `volume` times as loud, at `pan` from −1 (left) to 1 (right): `pan(at)` for a point. */
  cue(id: SoundId, options?: { delay?: number; volume?: number; pan?: number }): void;
  /** Where a point is on the screen from left (−1) to right (1), for a sound's `pan`. */
  pan(at: V3): number;
  /**
   * Matemágico's neon (src/math-figures.ts `NeonFigure`): a figure of tubes of light, his gold unless
   * `look` says, standing at `frame` (with none, its points are the world's; with `{ at, ...screenAxes(view) }`
   * it lies in the camera's plane, x right and y up). Its strokes (`figure.stroke(points)`) are hidden
   * until `draw` draws them or `show` shows them. It runs on the fight's clock and goes with the fight;
   * end it with `fade` or `destroy`.
   */
  figure(name: string, o?: { look?: NeonLook; frame?: NeonFrame }): NeonFigure;
  /** Draws `strokes` of `figure` one after another over `seconds`, his pen of light at the tip (`NeonDraw`: `delay`, `each(i)` as one starts, `done`). */
  draw(figure: NeonFigure, strokes: readonly NeonStroke[], seconds: number, o?: NeonDraw): void;
  /** The ground's height under a point. */
  ground(x: number, z: number): number;
}

export interface DuoStaging {
  /** Fight seconds from its start: when its blow lands (numbers, the cure) and when it is over. */
  timing: { contact: number; end: number };
  /**
   * The dual starts (the banner is up, time is frozen a moment then runs slow). `reached` is who it
   * lands on: every foe it hits, the party it covers, or whoever it is for. Set everything going
   * with `stage.fx.after(seconds, …)`; at `timing.contact` the numbers come.
   */
  start(stage: DuoStage, e: BattleEffect, reached: DuoFighter[]): void;
  /** Its blow lands (at `timing.contact`): the camera's answer, the shake, the bloom, a sound. */
  land?(stage: DuoStage, e: BattleEffect, reached: DuoFighter[]): void;
  /**
   * Every frame of the fight while it is on screen (fight seconds `dt`): what the timed status it
   * leaves keeps drawing on whoever has it, read from `state` (`unit.timed?.<id>`: `left` seconds,
   * `next` to its next beat). `playing` is the effect on screen now (skip while it is this dual's
   * own start). Keep it light: a few bursts a second at most, and nothing on a fallen fighter.
   */
  hold?(stage: DuoStage, dt: number, state: BattleState, playing: BattleEffect | undefined): void;
  /**
   * Any action's blow lands (its contact, whoever made it): what the lasting status answers at that
   * moment (Fulgurita's crack along the lattice, Metralla's splinters flaring). `struck` is who it reached.
   */
  struck?(stage: DuoStage, e: BattleEffect, struck: DuoFighter[]): void;
  /**
   * A timed status pulsed (src/battle.ts `runClock`), as the fight screen shows it: `status` on
   * `target`, and for Idea fija `by`, the foe whose eco made it strike.
   */
  pulsed?(stage: DuoStage, status: string, target: DuoFighter, by?: DuoFighter): void;
}

export type DuoStagings = Partial<Record<DualId, DuoStaging>>;
