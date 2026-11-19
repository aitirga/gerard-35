/**
 * The artilugio in Gerard's hands (docs/story-outline.md § The device): the Bomba-G board as a
 * thing he holds, not a panel. Once the story has it, a note or someone moving in front of the real
 * board has him take it out of his pocket and hold it in both hands like a pad: his left thumb
 * presses red and yellow, his right thumb green and blue, both at once for a pair. Its LEDs light
 * with the buttons, its little screen draws a bar for each note that has sounded, and awake (the
 * Queen's last fight) its four lights go round on their own. Untouched for a while, he puts it away.
 *
 * `fitArtilugio` builds it (hidden) on a figure's body, so a fight's copy of Gerard carries one too;
 * `HeldArtilugio` poses it and the arms after whatever posed them this frame (the walk, the fight):
 * each hand is brought to its side of the board by turning the shoulder and the elbow towards it
 * (a few rounds of cyclic coordinate descent), so it holds whatever the figure's bones look like.
 */
import * as pc from 'playcanvas';
import { ARTILUGIO_BUTTONS, ARTILUGIO_NOTES, artilugioButtons } from './castle.ts';

export const PROP = 'Artilugio';
const THUMB = 'Pulgar del artilugio';
/** How long it stays out untouched (s). */
export const PUT_AWAY_AFTER = 6;
/** Taking it out of the pocket and bringing it up, and putting it back (s). */
const TAKE_OUT = .8, PUT_AWAY = .55;
/** How long a press keeps its button down and lit (s). */
const PRESSED = .2;
const COLOURS = ['#d9483b', '#f2c230', '#45b35a', '#3a7bd5'];
const SHOWN = 8;

// The board's size (model units, the figure is about 1.2 tall): bigger than the real one, so it reads from the camera.
const W = .24, T = .026, D = .15, BUTTON = .034;
/** Each button's place across the board: red on his left (+x, the board faces +z with him). */
const KEY_X = [0, 1, 2, 3].map(b => (1.5 - b) * W * .2);
const KEY_Z = D * .2;
/** Where it sits in his hands, in the body's frame, and its tilt towards his face. */
const HELD_AT = new pc.Vec3(0, .6, .25), HELD_TILT = -28;
/** Where it comes from: his right trouser pocket (his right is −x). */
const POCKET = new pc.Vec3(-.2, .48, .03);

/** Shared by every copy: the board, its screen, and a lit and an unlit material per colour. */
let shared: { board: pc.StandardMaterial; trim: pc.StandardMaterial; screen: pc.StandardMaterial; ink: pc.StandardMaterial; keys: pc.StandardMaterial[]; leds: pc.StandardMaterial[]; lit: pc.StandardMaterial[] } | undefined;
function materials() {
  if (shared) return shared;
  const flat = (hex: string, gloss = .3, glow?: string, intensity = 1) => {
    const m = new pc.StandardMaterial(); m.diffuse.fromString(hex); m.gloss = gloss;
    if (glow) { m.emissive.fromString(glow); m.emissiveIntensity = intensity; }
    m.update(); return m;
  };
  shared = {
    board: flat('#22383b', .35), trim: flat('#c7b98a', .5),
    screen: flat('#8fa83a', .55, '#9fbf3b', .45), ink: flat('#263510', .2),
    keys: COLOURS.map(c => flat(c, .65)),
    leds: COLOURS.map(c => flat(c, .7, c, .05)),
    lit: COLOURS.map(c => flat(c, .7, c, 2.6)),
  };
  return shared;
}

function part(name: string, shape: 'box' | 'cylinder' | 'sphere' | 'capsule', material: pc.Material, parent: pc.Entity, [x, y, z]: number[], [sx, sy, sz]: number[], rotation?: number[]) {
  const node = new pc.Entity(name);
  node.addComponent('render', { type: shape, material, castShadows: true, receiveShadows: true });
  node.setLocalPosition(x, y, z); node.setLocalScale(sx, sy, sz);
  if (rotation) node.setLocalEulerAngles(rotation[0], rotation[1], rotation[2]);
  parent.addChild(node);
  return node;
}

/** The arms of a figure, right first (the −x side). */
const armsOf = (body: pc.Entity) => (body.children.filter(c => c.name === 'Brazo') as pc.Entity[]).sort((a, b) => a.getLocalPosition().x - b.getLocalPosition().x);

/**
 * Builds the artilugio, hidden, on `body`, with a thumb on each side lying over its edge (his
 * mittens have none of their own): once per figure; a copy of the figure carries it.
 */
export function fitArtilugio(body: pc.Entity, skin: string) {
  if (body.findByName(PROP)) return;
  const m = materials();
  const root = new pc.Entity(PROP); root.enabled = false; body.addChild(root);
  part('Placa del artilugio', 'box', m.board, root, [0, 0, 0], [W, T, D]);
  // Four brass screws at the corners, as on the real board.
  for (const [x, z] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) part('Tornillo del artilugio', 'cylinder', m.trim, root, [x * (W / 2 - .013), T / 2 + .002, z * (D / 2 - .013)], [.011, .004, .011]);
  const screen = part('Pantalla del artilugio', 'box', m.screen, root, [0, T / 2 + .003, -D * .24], [W * .7, .006, D * .32]);
  for (let i = 0; i < SHOWN; i++) {
    const bar = new pc.Entity(`Barra del artilugio ${i}`);
    bar.addComponent('render', { type: 'box', material: m.ink, castShadows: false, receiveShadows: false });
    bar.enabled = false; screen.addChild(bar);
  }
  for (let b = 0; b < ARTILUGIO_BUTTONS; b++) {
    part(`LED del artilugio ${b}`, 'sphere', m.leds[b], root, [KEY_X[b], T / 2 + .004, D * .02], [.013, .013, .013]);
    part(`Botón del artilugio ${b}`, 'cylinder', m.keys[b], root, [KEY_X[b], T / 2 + .008, KEY_Z], [BUTTON, .016, BUTTON]);
  }
  const thumb = new pc.StandardMaterial(); thumb.diffuse.fromString(skin); thumb.gloss = .25; thumb.update();
  // Right thumb first, as the arms: it comes over the board's −x edge.
  for (const side of [-1, 1]) part(THUMB, 'capsule', thumb, root, [side * (W / 2 - .01), T / 2 + .02, KEY_Z + .01], [.026, .075, .026], [0, 0, side * 70]);
}

const smooth = (t: number) => { const c = Math.max(0, Math.min(1, t)); return c * c * (3 - 2 * c); };
const mix = (a: number, b: number, t: number) => a + (b - a) * t;

/** Arms lifted forward and elbows bent before the hands are brought to the board, so they bend the natural way. */
const START = { shoulder: -30, elbow: -60 };
const ROUNDS = 6;
const a = new pc.Vec3(), b = new pc.Vec3(), axis = new pc.Vec3(), turn = new pc.Quat(), joint = new pc.Vec3(), tip = new pc.Vec3();

/** Turns `elbow` then `shoulder`, a few rounds, so that `hand` comes to `target` (world). */
function reach(shoulder: pc.Entity, elbow: pc.Entity, hand: pc.Entity, target: pc.Vec3) {
  for (let round = 0; round < ROUNDS; round++) {
    for (const bone of [elbow, shoulder]) {
      joint.copy(bone.getPosition()); tip.copy(hand.getPosition());
      a.sub2(tip, joint); b.sub2(target, joint);
      if (a.lengthSq() < 1e-8 || b.lengthSq() < 1e-8) continue;
      a.normalize(); b.normalize();
      const cos = Math.max(-1, Math.min(1, a.dot(b)));
      if (cos > .99999) continue;
      axis.cross(a, b).normalize();
      turn.setFromAxisAngle(axis, Math.acos(cos) * pc.math.RAD_TO_DEG);
      bone.setRotation(turn.mul(bone.getRotation()));
    }
  }
}

/** Gerard holding it: takes it out, presses it, puts it away. Call `update` after the arms are posed each frame. */
export class HeldArtilugio {
  private readonly body: pc.Entity;
  private readonly root: pc.Entity;
  private readonly arms: pc.Entity[];
  private readonly elbows: pc.Entity[];
  private readonly hands: pc.Entity[];
  private readonly thumbs: pc.Entity[];
  private readonly buttons: pc.Entity[];
  private readonly leds: pc.Entity[];
  private readonly bars: pc.Entity[];
  /** 0 put away, 1 held; it moves towards `wanted`. */
  private phase = 0;
  private wanted = 0;
  private idle = 0;
  private held = false;
  private awake = false;
  private clock = 0;
  private readonly pressed = new Map<number, number>();
  private readonly notes: number[] = [];
  private readonly target = new pc.Vec3();
  private readonly local = new pc.Vec3();
  private readonly world = new pc.Mat4();

  constructor(body: pc.Entity) {
    this.body = body;
    this.root = body.findByName(PROP) as pc.Entity;
    this.arms = armsOf(body);
    this.elbows = this.arms.map(arm => arm.findByName('Antebrazo') as pc.Entity);
    this.hands = this.arms.map(arm => (arm.findByName('Mano') as pc.Entity | null) ?? (arm.findByName('Antebrazo') as pc.Entity));
    this.thumbs = this.root.children.filter(c => c.name === THUMB) as pc.Entity[];
    this.buttons = [0, 1, 2, 3].map(n => this.root.findByName(`Botón del artilugio ${n}`) as pc.Entity);
    this.leds = [0, 1, 2, 3].map(n => this.root.findByName(`LED del artilugio ${n}`) as pc.Entity);
    this.bars = [...Array(SHOWN).keys()].map(i => this.root.findByName(`Barra del artilugio ${i}`) as pc.Entity);
  }
  get out() { return this.wanted === 1; }
  takeOut() { this.wanted = 1; this.idle = 0; }
  putAway() { if (!this.held) this.wanted = 0; }
  hold(held: boolean) { this.held = held; if (held) this.takeOut(); else this.idle = 0; }
  setAwake(awake: boolean) { this.awake = awake; }
  /** A note: out it comes, his thumb (both, for a pair) goes down on it, and the screen draws it. */
  play(note: number) {
    this.takeOut();
    for (const n of artilugioButtons(note)) this.pressed.set(n, PRESSED);
    this.notes.push(note);
    if (this.notes.length > SHOWN) this.notes.shift();
    this.drawBars();
  }
  private drawBars() {
    const low = Math.min(...ARTILUGIO_NOTES), high = Math.max(...ARTILUGIO_NOTES);
    this.bars.forEach((bar, i) => {
      const note = this.notes[i];
      bar.enabled = note !== undefined;
      if (note === undefined) return;
      // In the screen's frame (a unit box): a column from its bottom edge, as high as the note.
      const h = .2 + .7 * (ARTILUGIO_NOTES[note] - low) / (high - low);
      bar.setLocalPosition(-.42 + i * .12, .6, .45 - h / 2);
      bar.setLocalScale(.07, .4, h);
    });
  }
  /** A point in the body's frame, in the world. */
  private toWorld(p: pc.Vec3, out: pc.Vec3) { this.world.copy(this.body.getWorldTransform()); return this.world.transformPoint(p, out); }

  update(dt: number, animate: boolean) {
    this.clock += dt;
    if (this.wanted === 1 && !this.held && this.phase >= 1 && (this.idle += dt) > PUT_AWAY_AFTER) this.wanted = 0;
    const step = !animate ? 1 : dt / (this.wanted ? TAKE_OUT : PUT_AWAY);
    this.phase = this.wanted ? Math.min(1, this.phase + step) : Math.max(0, this.phase - step);
    for (const [n, left] of this.pressed) { if (left - dt <= 0) this.pressed.delete(n); else this.pressed.set(n, left - dt); }
    const p = this.phase;
    this.root.enabled = p > .4;
    if (p <= 0) return;

    // First his right hand goes to the pocket, then it comes up with the board and the left meets it.
    const pocket = smooth(p / .4), up = smooth((p - .4) / .6);
    this.local.lerp(POCKET, HELD_AT, up);
    this.root.setLocalPosition(this.local);
    this.root.setLocalEulerAngles(mix(-80, HELD_TILT, up), mix(50, 0, up), 0);
    const s = mix(.5, 1, up); this.root.setLocalScale(s, s, s);

    this.arms.forEach((arm, i) => {
      const elbow = this.elbows[i], hand = this.hands[i];
      if (!elbow || !hand) return;
      // How far this arm goes: the right all the way from the start, the left only as the board comes up.
      const weight = i === 0 ? Math.max(pocket, up) : up;
      if (weight <= 0) return;
      const rest = hand.getPosition().clone();
      const shoulder = arm.getLocalEulerAngles(), bend = elbow.getLocalEulerAngles();
      arm.setLocalEulerAngles(mix(shoulder.x, START.shoulder, weight), shoulder.y, shoulder.z);
      elbow.setLocalEulerAngles(mix(bend.x, START.elbow, weight), bend.y, bend.z);
      // Where the hand goes: the pocket, then its side of the board, a little under its edge.
      const side = i === 0 ? -1 : 1;
      if (i === 0 && up <= 0) this.toWorld(POCKET, this.target);
      else this.root.getWorldTransform().transformPoint(this.local.set(side * (W / 2 + .015), -.03, KEY_Z * .5), this.target);
      this.target.lerp(rest, this.target, weight);
      reach(arm, elbow, hand, this.target);
    });

    // The thumbs lie over the edges and slide to the button they press, going down on it.
    this.thumbs.forEach((thumb, i) => {
      thumb.enabled = up > .6;
      const mine = i === 0 ? [2, 3] : [0, 1], down = mine.find(n => this.pressed.has(n));
      const side = i === 0 ? -1 : 1, rest = side * (W / 2 - .02);
      const x = down === undefined ? rest : mix(rest, KEY_X[down], .72);
      thumb.setLocalPosition(x, T / 2 + (down === undefined ? .026 : .014), KEY_Z + .008);
      thumb.setLocalEulerAngles(down === undefined ? 0 : 12, 0, side * (down === undefined ? 70 : 82));
    });

    const m = materials(), chase = Math.floor(this.clock / .3) % ARTILUGIO_BUTTONS;
    for (let n = 0; n < ARTILUGIO_BUTTONS; n++) {
      const down = this.pressed.has(n);
      this.buttons[n].setLocalPosition(KEY_X[n], T / 2 + (down ? .002 : .008), KEY_Z);
      const lit = down || (this.awake && n === chase && animate);
      const render = this.leds[n].render;
      if (render) render.meshInstances[0].material = lit ? m.lit[n] : m.leds[n];
    }
  }
}
