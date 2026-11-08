import * as pc from 'playcanvas';
import { idlePose } from './walk-animation.ts';

/**
 * Faces that feel: a table of expressions (`EXPRESSIONS`) and a `Face` that eases any model into
 * them. It works on every character, with whatever the model has: eyes squash and open wide, a mouth
 * stretches and the head nods and tilts. On a model from a file the eyes are painted, so a lid of its
 * skin comes down over them, and its mouth is a bone that stretches the paint (tools/character_rig.py).
 *
 *   faceOf(model).show('sorprendido')        until told otherwise
 *   faceOf(model).show('dolor', .5)          for half a second, then back
 *   faceOf(model).show()                     back now
 *   faceOf(model).talk(true)                 the mouth moves while they speak
 *   faceOf(model).update(dt, { animate })    every frame, by whoever animates the model
 *
 * The names are those of the portraits (`expression` in a dialogue line, tools/README.md), so a
 * line that changes a portrait changes the face in the world too. To add one, add a row.
 */
export interface Expression {
  /** How open the eyes are: 0 shut, 1 relaxed, above 1 wide. */
  open: number;
  /** How tall the mouth is: 1 at rest. */
  mouth: number;
  /** Degrees the head nods (+ down) and tilts. */
  nod: number;
  tilt: number;
  /** Shuts one eye. */
  wink?: boolean;
}

export const EXPRESSIONS = {
  neutro: { open: 1, mouth: 1, nod: 0, tilt: 0 },
  contento: { open: 1, mouth: 1.3, nod: -2, tilt: 3 },
  riendo: { open: 1.2, mouth: 1.7, nod: -6, tilt: 5 },
  sorprendido: { open: 1.25, mouth: 1.5, nod: -5, tilt: 0 },
  triste: { open: .82, mouth: .6, nod: 8, tilt: -2 },
  enfadado: { open: .88, mouth: .8, nod: 4, tilt: 0 },
  preocupado: { open: 1.08, mouth: .7, nod: 2, tilt: -3 },
  pensativo: { open: .78, mouth: .7, nod: 3, tilt: 7 },
  decidido: { open: .92, mouth: .7, nod: 2, tilt: 0 },
  dolor: { open: .22, mouth: .8, nod: 7, tilt: -5 },
  dormido: { open: 0, mouth: .7, nod: 0, tilt: 0 },
  guino: { open: 1, mouth: 1, nod: 0, tilt: 6, wink: true },
} satisfies Record<string, Expression>;
export type ExpressionId = keyof typeof EXPRESSIONS;

/** How long a change of expression takes, about. */
const EASE = .09;
/** The node a model from a file carries its head's fittings on (RIG.mount in character-model.ts). */
const HEAD_MOUNT = 'Soporte de cabeza';
/** How closed a painted eye has to be for its lid to show, and for the line of its lashes. */
const LID_SHOWS = .05;
const LASH_SHOWS = .8;
/** A model from a file lifts its chin a little: the camera is always above it. */
const CHIN = -9;

export class Face {
  private readonly eyes: { node: pc.Entity; side: number; height: number; lid?: { node: pc.Entity; lash: pc.Entity | null; size: pc.Vec3 } }[];
  private readonly mouth: pc.Entity | null;
  private readonly mouthHeight: number;
  private readonly head: pc.Entity | null;
  private readonly chin: number;
  private readonly seed = Math.random() * 40;
  private time = this.seed;
  private shown: Expression = EXPRESSIONS.neutro;
  private until = Infinity;
  private talking = false;
  private nextBeam = 5 + Math.random() * 8;
  private readonly now = { open: 1, mouth: 1, nod: 0, tilt: 0, wink: 0 };

  constructor(model: pc.Entity) {
    this.eyes = (model.find(node => node.name === 'Ojo') as pc.Entity[]).map(node => {
      const lid = node.findByName('Párpado') as pc.Entity | null;
      return {
        node, side: node.getLocalPosition().x < 0 ? -1 : 1, height: node.getLocalScale().y,
        lid: lid ? { node: lid, lash: node.findByName('Pestañas') as pc.Entity | null, size: lid.getLocalScale().clone() } : undefined,
      };
    });
    this.mouth = model.findByName('Boca') as pc.Entity | null;
    this.mouthHeight = this.mouth?.getLocalScale().y ?? 1;
    this.head = model.findByName('Pivote de cabeza') as pc.Entity | null;
    this.chin = model.findByName(HEAD_MOUNT) ? CHIN : 0;
  }

  /** Shows an expression, for `seconds` or until the next one; none (or an unknown name) goes back to neutral. */
  show(id?: string, seconds = Infinity) {
    this.shown = EXPRESSIONS[id as ExpressionId] ?? EXPRESSIONS.neutro;
    this.until = this.time + seconds;
  }

  /** Whether the mouth moves as they speak. */
  talk(on: boolean) { this.talking = on; }

  /**
   * Every frame. `resting` (0–1) is how free they are to breathe and look about; `awake` (0–1) closes
   * the eyes for whoever is asleep; `turn`, `level` and `steady` (degrees) turn the head to something,
   * lift it and keep it upright against what the body is doing.
   */
  update(dt: number, { animate = true, resting = 1, awake = 1, turn = 0, level = 0, steady = 0 }: { animate?: boolean; resting?: number; awake?: number; turn?: number; level?: number; steady?: number } = {}) {
    if (animate) this.time += dt;
    if (this.time >= this.until) this.show();
    // Now and then a moment of good humour, when nothing else is going on.
    if (animate && this.shown === EXPRESSIONS.neutro && !this.talking && (this.time - this.seed) > this.nextBeam) {
      this.nextBeam = this.time - this.seed + 8 + Math.random() * 9;
      if (resting > .5 && awake > .5) this.show('contento', 1.5);
    }
    const goal: Expression = awake < .5 ? EXPRESSIONS.dormido : this.shown;
    const k = animate ? 1 - Math.exp(-dt / EASE) : 1, n = this.now;
    n.open += (goal.open - n.open) * k; n.mouth += (goal.mouth - n.mouth) * k;
    n.nod += (goal.nod - n.nod) * k; n.tilt += (goal.tilt - n.tilt) * k; n.wink += ((goal.wink ? 1 : 0) - n.wink) * k;

    const idle = idlePose(this.time);
    const blink = animate && idle.blink < 1;
    for (const eye of this.eyes) {
      const shut = blink || (n.wink > .5 && eye.side < 0);
      const open = shut ? 0 : Math.min(n.open, 1.3) * awake;
      if (eye.lid) {
        // It comes down from the top of the eye, and only draws while it covers something.
        const closed = Math.max(0, 1 - open), { node, lash, size } = eye.lid;
        const shown = closed > LID_SHOWS;
        node.enabled = shown;
        if (shown) { node.setLocalScale(size.x, size.y * closed, size.z); node.setLocalPosition(0, size.y * (1 - closed) / 2, 0); }
        if (lash) lash.enabled = closed > LASH_SHOWS;
        continue;
      }
      const s = eye.node.getLocalScale();
      eye.node.setLocalScale(s.x, eye.height * Math.max(.08, Math.min(open, 1.2)), s.z);
    }
    if (this.mouth) {
      // Speaking opens and closes the mouth, a little unevenly.
      const talk = this.talking && animate ? Math.sin(this.time * 19) * .5 + Math.sin(this.time * 11.3) * .5 : 0;
      const m = this.mouth.getLocalScale();
      this.mouth.setLocalScale(m.x, this.mouthHeight * n.mouth * (1 + Math.max(0, talk) * .6), m.z);
    }
    const look = animate ? idle.look : 0;
    this.head?.setLocalEulerAngles(this.chin + n.nod - level - idle.breathe * 2 * resting, turn + look * 16 * resting, n.tilt - steady + (animate ? Math.sin(this.time * .8) * 1.5 * resting : 0));
  }
}

const faces = new WeakMap<pc.Entity, Face>();
/** The face of a model (or of its body), made once and kept. */
export function faceOf(model: pc.Entity) {
  let face = faces.get(model);
  if (!face) { face = new Face(model); faces.set(model, face); }
  return face;
}
