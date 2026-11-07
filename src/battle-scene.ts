import * as pc from 'playcanvas';
import { STATUSES, TIMED, isOnion, markLeft, markSpent, onionSize, statShifts, weakSpotRounds, type BattleEffect, type BattleState, type ClassId, type Combatant, type DishId, type OnionKind, type StatusId } from './battle';
import { CLASSES, grownUp, inheritColour, wearClass } from './classes';
import { ACTION_SECONDS, CAST_CONTACT, CAST_FLIGHT, CAST_GAP, CAST_LAUNCH, CONTACT_SECONDS, CURE_CONTACT, SPELL_CONTACT, SPELL_LAUNCH, DUAL_EASE, DUAL_FREEZE, ENTRY_SECONDS, clamp01, contactMotion, smooth, surge } from './battle-motion';
import { WalkAnimation, idlePose } from './walk-animation';
import { createGroundContact, type GroundHeight } from './ground-contact';
import { DOG_PROFILES } from './encounters';
import { CLAW_COLOURS, tint, type Effects, type FireLevel } from './effects';
import type { ParticleBody } from './particles';
import { FightClock, HIT, landing, spring, wobble, type Blow } from './hit-feel';
import { createCat, type Cat, type CatAction } from './cats';
import { BIP, createBip, type Bip } from './bip';
import { createOnionPeels, skinOf } from './onion-peels';
import type { StatWay } from './stat-fx';
import { createStatArrows } from './stat-arrows';
import { createStatMotes } from './stat-motes';
import type { SoundId } from './sfx';
import type { Fears, RobotPose } from './fears';
import { axes, catSpots, fightCamera, formation, type Layout } from './arena';

/** How a fight is laid out round its centre (src/arena.ts), whether it was moved to a pocket (src/pocket.ts), and how far apart its sides stand (1 as always). */
export interface FightStage { layout: Layout; pocket?: boolean; spread?: number }
import { createStatusFx, type ReactionId, type StatusLookId } from './status-fx';
import { DISINTEGRATE, dissolvable, type Disintegration } from './disintegrate';
import { DUAL_COLOURS, FEAR_COLOURS, createDualFx, screenAxes, type V3 } from './dual-fx';
import { takeZero } from './anima-looks';
import { CURE_COLOUR, createMathCast, spellColour } from './math-cast';
import { spellLaunch } from './battle-sounds';

/** How fast a cat already with the party runs to its place in a fight, and from how far it lands there instead (a jump). */
const CAT_RUN = 7, CAT_LANDS = 14;
/** How long after the first the next of a flurry's little claws lands (Zarpazos). */
const CLAW_SECONDS = .12;
/** How long after a blow its fighter's stats show going up or down. */
const STAT_AFTER_BLOW = .2;
/** Skills that stay where the wearer stands and reach their own side: no run-up, the hand goes up. */
const SUPPORT = new Set(['escondite', 'analisis', 'cardioide']);
/** Matemágico's circle on a boy (chapter 1): to his size. */
const CHILD_CIRCLE = .76;
/** Seconds a fallen fighter of the party takes to go down, and to get back up if something brings them round. */
const FALL_SECONDS = .42, RISE_SECONDS = .6;
/**
 * A dual attack's choreography (docs/combat.md § Ataques duales), in fight seconds from its start
 * (the scene's clock runs slow while its banner holds, `slowmo`): `setup` while Gerard draws (the
 * circle, the blueprint) and Haru crouches, then the strikes. Zarpazos de fuego's eight claws land
 * at `claws` after the setup, in two bursts of four; Punto débil's one stroke leaves at `dash` and
 * lands at `stroke`. `tail` is how long it stays on after its last blow.
 */
const DUAL = {
  setup: .55,
  claws: [0, .09, .18, .27, .52, .61, .7, .79],
  dash: .5, stroke: .6,
  tail: .62,
  /** The last blow holds at least this long (s), and Punto débil's aim runs the scene this slow on top of the banner's. */
  finalStop: .24, aimSlow: .28, aimSeconds: .9,
  /** A dual already seen this session: a shorter setup, Punto débil's aim and tail (the fight stays agile). */
  seen: { setup: .34, tail: .38, aimSeconds: .45 },
} as const;
/** Duals already seen this session (as the fight screen's banner counts them). */
const seenDuals = new Set<string>();
/** How the dish under a platito or El Plato's cloche looks (`Plato`), by what it is. */
const DISH_TINT: Record<DishId, string> = { alcachofa: '#a9cf72', coliflor: '#f4ecd6', sorpresa: '#9c9a92' };

/**
 * Replace these stand-ins with imported models without changing combat or UI. `partyModel` gives
 * the street model each party fighter is cloned from (Gerard's own for himself and Bernat, Aitor's
 * for Aitor); `player` is Gerard's, hidden while the fight is on.
 */
export function createBattleScene(app: pc.Application, player: pc.Entity, partyModel: (id: string) => pc.Entity, groundHeight: GroundHeight, effects: Effects) {
  const materials: pc.StandardMaterial[] = [];
  function mat(hex: string) {
    const m = new pc.StandardMaterial(); m.diffuse.fromString(hex); m.update(); materials.push(m); return m;
  }
  const allyJacket = mat('#6f8fa8');
  const fur = mat('#c49464'), cream = mat('#f1dfb8'), dark = mat('#3c302a'), collar = mat('#a64d43');
  // Eyes have their own materials so La Reina Bubbaloo's minion can turn them dark pink and glowing.
  const eyeDark = mat('#3c302a'), eyePink = mat('#7a1240');
  eyePink.emissive.fromString('#ff2d86'); eyePink.emissiveIntensity = 1.6; eyePink.gloss = .8; eyePink.update();
  function part(parent: pc.Entity, name: string, type: pc.RenderComponent['type'], material: pc.StandardMaterial, p: number[], s: number[]) {
    const e = new pc.Entity(name); e.addComponent('render', { type, material, castShadows: true });
    e.setLocalPosition(p[0], p[1], p[2]); e.setLocalScale(s[0], s[1], s[2]); parent.addChild(e); return e;
  }
  const dog = new pc.Entity('Perro callejero'); app.root.addChild(dog);
  part(dog, 'Lomo', 'box', fur, [0, .48, 0], [.42, .4, .8]);
  part(dog, 'Pecho', 'box', cream, [0, .49, .28], [.35, .39, .2]);
  // The head pivots at the neck so dogs can sniff, glance and lunge.
  const head = new pc.Entity('Cabeza de perro'); head.setLocalPosition(0, .7, .3); dog.addChild(head);
  part(head, 'Cabeza', 'box', fur, [0, .14, .05], [.43, .4, .4]);
  part(head, 'Hocico', 'box', cream, [0, .04, .3], [.28, .2, .23]);
  part(head, 'Nariz', 'box', dark, [0, .09, .42], [.15, .1, .05]);
  part(dog, 'Collar rojo', 'box', collar, [0, .65, .3], [.44, .08, .31]);
  for (const side of [-1, 1]) {
    part(head, 'Ojo', 'sphere', eyeDark, [side * .12, .18, .258], [.055, .055, .03]);
    const ear = part(head, 'Oreja', 'box', dark, [side * .23, .21, -.04], [.12, .36, .24]);
    ear.setLocalEulerAngles(0, 0, side * 16);
    for (const z of [-.27, .27]) part(dog, 'Pata', 'box', cream, [side * .15, .18, z], [.12, .36, .15]);
  }
  const tail = part(dog, 'Cola', 'box', fur, [0, .66, -.5], [.1, .12, .47]); tail.setLocalEulerAngles(38, 0, 0);
  const dogs = [dog, dog.clone(), dog.clone(), dog.clone()].map((model, i) => {
    const profile = DOG_PROFILES[i];
    if (i > 0) app.root.addChild(model);
    model.name = profile.name;
    const coat = mat(profile.fur), band = mat(profile.collar);
    model.findComponents('render').forEach(component => {
      (component as pc.RenderComponent).meshInstances.forEach(mesh => {
        if (mesh.material === fur) mesh.material = coat;
        if (mesh.material === collar) mesh.material = band;
      });
    });
    model.enabled = false;
    return model;
  });
  const dogLegs = dogs.map(model => model.children.filter(c => c.name === 'Pata') as pc.Entity[]);
  const dogHeads = dogs.map(model => model.findByName('Cabeza de perro') as pc.Entity);
  const dogEars = dogs.map(model => model.find(node => node.name === 'Oreja') as pc.Entity[]);
  const dogEyes = dogs.map(model => model.find(node => node.name === 'Ojo') as pc.Entity[]);
  const dogTails = dogs.map(model => model.findByName('Cola') as pc.Entity);
  /** Shared idle life: seeded glances, panting and blinks. */
  function animateDogHead(head: pc.Entity, ears: pc.Entity[], eyes: pc.Entity[], seed: number, moving: boolean, animate: boolean, lunge = 0) {
    const idle = idlePose(time, seed);
    const sniff = moving || !animate ? 0 : Math.max(0, Math.sin(time * .8 + seed * 2)) ** 10 * 28;
    const trot = moving && animate ? Math.sin(time * 16 + seed) * 5 : 0;
    head.setLocalEulerAngles(animate ? sniff + trot + idle.breathe * 3 - lunge * 24 : 0, animate && !moving ? idle.look * 18 : 0, 0);
    ears.forEach((ear, i) => ear.setLocalEulerAngles(animate ? -lunge * 25 : 0, 0, (i ? 1 : -1) * (16 + (animate ? (moving ? Math.sin(time * 16 + seed) * 8 : idle.breathe * 4) : 0))));
    // Possessed eyes are wider (see possess) and a little taller too.
    eyes.forEach(eye => { const s = eye.getLocalScale(); eye.setLocalScale(s.x, (s.x > .06 ? .075 : .055) * (animate ? idle.blink : 1), s.z); });
  }
  const plantDogs = dogs.map((model, i) => createGroundContact(model, dogLegs[i]));
  const dogWalks = dogs.map(() => new WalkAnimation());
  const battleRoot = new pc.Entity('Escenario de combate'); app.root.addChild(battleRoot);
  /** The chevrons of stats going up or down (src/stat-arrows.ts). */
  const arrows = createStatArrows(app, battleRoot);
  /** The motes off the head of stats that stay up or down (src/stat-motes.ts). */
  const motes = createStatMotes(effects);
  interface Fighter {
    model: pc.Entity; base: pc.Vec3; start: pc.Vec3; hp: number; party: boolean;
    /** How much of its size it has now (Encogido eases it down to SHRUNK and back). */
    shrink: number;
    /** When they fell, and (the party) when they started getting back up; `landed` once they hit the floor. */
    downAt?: number; upAt?: number; landed?: boolean; dissolve?: Disintegration; freed?: { node: pc.Entity; from: pc.Vec3; to: pc.Vec3; at: number }; hitAt?: number; flashColor: pc.Color; flash: number; materials: pc.StandardMaterial[]; glow: pc.Color[];
    body: pc.Entity | null; head: pc.Entity | null; tail: pc.Entity | null; ears: pc.Entity[]; eyes: pc.Entity[]; eyeScale: number; seed: number;
    /** Foes that are not dogs (the palace minion) wobble instead of sniffing. */
    minion: boolean;
    /**
     * A giant of tiles and ladders (Vertitrón): it does not wobble, stretch or squash like the gum
     * creatures. It leans in heavy and slow from where it stands, and a blow only makes it shudder.
     */
    rigid: boolean;
    /** Gerard at 35 or Aitor: a grown-up's Matemágico thinks out loud (thoughts.ts). */
    grown: boolean;
    arms: pc.Entity[]; legs: pc.Entity[]; yaw: number; turn: number; scale: pc.Vec3;
    walk: WalkAnimation;
    plantFeet: ReturnType<typeof createGroundContact>;
    /** Burning (`ignite`): the fire on them, where their feet are, and whether it heated them last frame. */
    fire?: { handle: ReturnType<Effects['fire']>; at: pc.Vec3 };
    heated?: boolean;
    /** An onion: the layers it shows (they come off as the blows land, not when they are decided), how big it stands and its outer skin. */
    onion?: { kind: OnionKind; shown: number; size: number; skin: pc.StandardMaterial };
    /** How tall and wide they stand over the floor, measured once at `scale` (where their motes start grows and shrinks with them). */
    measured?: { height: number; radius: number; scale: pc.Vec3 };
    /** A dish (platito, El Plato): its plate and cloche, the dish it shows and when it last turned over. */
    dish?: { plate: pc.Entity | null; cloche: pc.Entity | null; shown?: DishId; flipAt?: number };
    /** A fantasmita: its pixels by row (for the scanlines), and how see-through it is now (0–1, Transparente). */
    ghost?: { pixels: { node: pc.Entity; row: number }[]; clear: number };
    /** How far a big onion has rolled back for its run-up (0–1, Carrerilla). */
    back?: number;
    /** Vertitrón (`robot`), and its eye: a part of it (`part`, the fighter it belongs to), drawn by it. */
    robot?: Robot; part?: Fighter;
    /** Materials no flash or tint touches (Uri, up on Vertitrón: a blow on it is not a blow on him). */
    steady?: Set<pc.Material>;
  }
  /**
   * What Vertitrón keeps from frame to frame: its eye (the node, its fighter, the GPU swirl and smoke in
   * it, how fast its spiral turns and how hot it glows), how far it kneels, Uri up on it (freed once he
   * is down) and the beam of the Rayo.
   */
  interface Robot {
    eye: pc.Entity; ball: pc.Entity; uri: pc.Entity | null; hands: pc.Entity[];
    /**
     * Where its eyeball looks (pitch, yaw: degrees) and how fast it is getting there, where it darts next
     * and when: quick saccades with an overshoot, wilder when charged, stopped dead once it is broken.
     */
    gaze: { x: number; y: number; vx: number; vy: number; tx: number; ty: number; next: number };
    eyeFighter?: Fighter;
    swirl?: { stream: ReturnType<NonNullable<Effects['gpu']>['emitter']>; field: ReturnType<NonNullable<Effects['gpu']>['field']>; glass: ReturnType<NonNullable<Effects['gpu']>['volume']>; smoke?: boolean };
    spin: number; heat: number; charged: number; broken: boolean; labBroken?: boolean; brokeAt?: number; pulseAt: number;
    kneel: number; knelt?: boolean; uriFree?: boolean;
    /** The Barrido whose hand trail has started. */
    swept?: BattleEffect;
    /** Each eye material, its colour whole (`lit`) and its diffuse (`base`), so it can go dark and come back. */
    lens: { material: pc.StandardMaterial; lit: pc.Color; base: pc.Color }[];
  }
  const fighters = new Map<string, Fighter>();
  /** How high the tallest foe reaches above the ground, so the camera can take it in (Vertitrón, Uri on top). */
  let foeTop = 0;
  /** Haru and Yuki, beside whoever wears Papagato (docs/animas/papagato/): they act on its skills. */
  const cats = new Map<string, { haru: Cat; yuki: Cat }>();
  /** The two already walking with the party while Nuria lends them (game.ts): the fight uses them instead of bringing its own. */
  let borrowed: { haru: Cat; yuki: Cat } | undefined;
  /**
   * Bip, beside whoever wears Tecnópata (docs/animas/tecnopata/): `shown` while they wear it, `since`
   * seconds since it came out or went in, `power` how formed it is (0–1), `at` where it floats now,
   * and `chest` a node on its wearer's chest, where its nanites go back in.
   */
  /** Each Tecnópata wearer's Bip: shown or not, since when, its power, where it is, the chest it streams into, how sun yellow it is (Rayo solar), and whether it blew up (Explosión). */
  const bips = new Map<string, { bip: Bip; shown: boolean; since: number; power: number; at: pc.Vec3; chest: pc.Entity; solar: number; gone?: boolean }>();
  const peels = createOnionPeels(battleRoot, groundHeight);
  let cue: (id: SoundId, options?: { delay?: number }) => void = () => {};
  /** How many of this action's little claws have landed. */
  let clawed = 0;
  /** Models for foes that are not dogs, cloned when a fight starts (the game passes the minion). */
  let minionTemplate: pc.Entity | undefined;
  /** Uri's fears (src/fears.ts), by kind, and how Vertitrón is posed. */
  let fears: Fears | undefined;
  /** Seconds of the ánima's wake-up shake left (`awaken`). */
  let shake = 0;
  /**
   * Foc Binari (Matemágico): the caster stays where they are and raises a hand; at CAST_LAUNCH two
   * streams of fire leave it and braid their way to the target, landing CAST_FLIGHT later.
   */
  /** The effect whose streams have already left the hand. */
  let cast: BattleEffect | undefined;
  let state: BattleState | undefined;
  let effect: BattleEffect | undefined;
  let effectTime = 0;
  let entryTime = ENTRY_SECONDS;
  let time = 0;
  let impact: ((blow: number) => void) | undefined;
  let complete: (() => void) | undefined;
  let impacted = false;
  // Hit feel (hit-feel.ts): the fight's clock holds on contact; the camera lurch, the punch-in and the post pulse run on real time.
  const clock = new FightClock();
  const sway = [0, 1, 2].map(() => ({ x: 0, v: 0 })), zoom = { x: 0, v: 0 };
  let real = 0, animating = true;
  let pulse: ((fringe: number, bloom: number) => void) | undefined;
  /** What duals and the tower's fears draw (src/dual-fx.ts), on the fight's clock. */
  const dualFx = createDualFx(effects);
  const mathCast = createMathCast(app, battleRoot, effects);
  /** The thrown Atacar already started (src/math-cast.ts). */
  let spelled: BattleEffect | undefined;
  /**
   * The camera for the big moments (game.ts adds it to the fight's camera): degrees round the fight
   * (`yaw`) and down (`pitch`, negative lower), how much it zooms in (a share of the ortho height) and
   * where it looks, an offset from the frame (x, y, z). Eased on real time towards `lensWant`.
   */
  const lens = { yaw: 0, pitch: 0, zoom: 0, x: 0, y: 0, z: 0 }, lensWant = { ...lens };
  /** Real seconds a foe's ability keeps its own lens (Aplastón's drop). */
  let lensHold = 0;
  /** A dual's spotlight (post.ts `spotlight`): where it is sent, and how far it is on now (eased). */
  let spot: ((amount: number, points: readonly { x: number; y: number; z: number; radius: number }[]) => void) | undefined;
  let spotAmount = 0, spotWant = 0;
  /** The dual whose start (freeze, stinger, drawings) has played, and what it was planned round. */
  let dualStarted: BattleEffect | undefined;
  let dualPlan: { feet: pc.Vec3; chest: pc.Vec3; point: pc.Vec3; radius: number; angles: number[]; rest: pc.Vec3; beyond: pc.Vec3; facing: V3; burnBefore: number } | undefined;
  /** Whose fire stays as it shows until the next action starts (`holdFire`). */
  let fireWaits: string | undefined;
  /** The effect whose world changes (Vertitrón's eye, its moves) have played. */
  let worldDone: BattleEffect | undefined;
  /** Punto débil's lasting marks (a gold crosshair over the foe), by foe; and the gold they are made of. */
  const marks = new Map<string, pc.Entity>();
  const markGold = mat('#000000');
  markGold.emissive.fromString(DUAL_COLOURS.gold); markGold.emissiveIntensity = 2.4; markGold.useLighting = false; markGold.update();
  /** The beam of Vertitrón's Rayo terrorífico: a hot core in a violet glow, from its eye to the roof. */
  const beamCore = mat('#000000'), beamGlow = mat('#000000');
  for (const [m, colour, k] of [[beamCore, '#fbf6ff', 3.2], [beamGlow, '#b07aff', 1.6]] as const) {
    m.emissive.fromString(colour); m.emissiveIntensity = k; m.useLighting = false; m.blendType = pc.BLEND_ADDITIVE; m.depthWrite = false; m.update();
  }
  const beam = new pc.Entity('Rayo terrorífico'); battleRoot.addChild(beam); beam.enabled = false;
  for (const [m, w] of [[beamCore, .16], [beamGlow, .5]] as const) {
    const e = new pc.Entity('Haz'); e.addComponent('render', { type: 'cylinder', material: m, castShadows: false, receiveShadows: false });
    e.setLocalEulerAngles(-90, 0, 0); e.setLocalScale(w, 1, w); beam.addChild(e);
  }
  /** Where the beam burns the roof as it sweeps (a trail follows it). */
  const beamFloor = new pc.Vec3();
  let beamOf: BattleEffect | undefined;
  /** A blow lands: the picture lurches along (x, y, z), heavy ones punch in and fringe; returns the landing for the hit-stop. */
  function land(blow: Blow, x: number, y: number, z: number) {
    const l = landing(blow);
    [x, y, z].forEach((d, i) => { sway[i].x = -d * l.kick; sway[i].v = 0; });
    zoom.x = Math.max(zoom.x, l.punch);
    pulse?.(l.fringe, l.bloom);
    return l;
  }
  const anchor = new pc.Vec3();
  /** How the fight lines up round `anchor`, and whether it is in a pocket (`set`). */
  let layout: Layout = 'open', pocketed = false;
  /** The kinds of the foes that stand in the fight (`set`): a giant turns the camera (src/arena.ts `fightCamera`). */
  let foeKinds: (string | undefined)[] = [];
  /** Where the fight's camera stands from its centre. */
  const camera = () => fightCamera(layout, foeKinds);
  /**
   * What the camera looks at: the middle of everyone in the fight as the camera sees them across,
   * a little to its left, so they stand clear of the fighters' cards on the left of the screen.
   */
  const frame = new pc.Vec3();
  const HUD_SHIFT = .8;
  const cameraKick = new pc.Vec3();
  const focus = new pc.Vec3();
  const targetMaterial = mat('#f3cf78');
  targetMaterial.emissive.fromString('#f3cf78'); targetMaterial.emissiveIntensity = .3; targetMaterial.update();
  const marker = part(battleRoot, 'Objetivo', 'cylinder', targetMaterial, [0, .03, 0], [1.1, .025, 1.1]);
  marker.enabled = false;
  let selectedTarget: string | undefined;
  /** Confetti falls once per won fight. */
  let celebrated = false;
  const face = (from: pc.Vec3, to: pc.Vec3) => Math.atan2(to.x - from.x, to.z - from.z) * 180 / Math.PI;
  const ELEMENT_FLASH = { agua: new pc.Color(.45, .8, 1), fuego: new pc.Color(1, .55, .18), electrico: new pc.Color(1, .92, .4) };
  const white = new pc.Color(1, .96, .86), gold = new pc.Color(1, .82, .4), flame = new pc.Color(1, .55, .18), green = new pc.Color(.5, 1, .45);
  const statDown = new pc.Color(1, .16, .12), statUp = new pc.Color(.3, .72, 1);
  /** Bip's rays on whoever they reach: Tecnópata's cyan. */
  const cyanFlash = new pc.Color(.35, .9, 1);
  /** Zarpazo sangriento's flash on whoever it hits: the claws' coral (effects.claw), soft so the lines read over it. */
  const clawFlash = new pc.Color(1, .66, .56);
  /** The Rayo's light on whoever it burns across. */
  const violetHit = new pc.Color().fromString('#c9a2ff');
  function hit(f: Fighter, color: pc.Color, strength = 1) { f.hitAt = time; f.flash = strength; f.flashColor = color; }
  /** A fighter glows: a flash fading, the fire on them, a status's tint, on top of what they glow with at rest (not on `steady` materials). */
  function shine(id: string, f: Fighter, dt: number) {
    const heat = f.fire?.handle.glow ?? 0, tinted = statusFx.tint(id, time), statusLit = tinted[0] + tinted[1] + tinted[2] > 0;
    if (!(f.flash > 0 || heat > 0 || statusLit || f.heated)) return;
    f.flash = Math.max(0, f.flash - dt * 4.5);
    const k = f.flash * f.flash;
    f.materials.forEach((m, i) => {
      if (f.steady?.has(m)) return;
      const rest = f.glow[i];
      m.emissiveIntensity = 1;
      m.emissive.set(rest.r + f.flashColor.r * k + .3 * heat + tinted[0], rest.g + f.flashColor.g * k + .09 * heat + tinted[1], rest.b + f.flashColor.b * k + .015 * heat + tinted[2]);
      m.update();
    });
    f.heated = heat > 0 || statusLit;
  }
  /**
   * Sets a fighter alight at `level` (or changes how hard they burn), or lets the fire die down
   * with no level. Whatever they are, their own body burns (`effects.fire` with their model): it
   * spreads over their parts, tongues of flame and embers leave them, its light falls on them and they
   * glow with its heat; it follows them and goes out when they fall.
   */
  function igniteFighter(id: string, level?: FireLevel, seconds = Infinity) {
    const f = fighters.get(id);
    if (!f) return;
    if (!level) { f.fire?.handle.stop(); return; }
    if (f.fire?.handle.burning) { f.fire.handle.level = level; return; }
    const p = f.model.getPosition(), at = new pc.Vec3(p.x, f.part ? p.y - .55 : groundHeight(p.x, p.z), p.z);
    f.fire = { at, handle: effects.fire(at, level, { seconds, model: f.model }) };
  }
  // Statuses on the fighters (src/status-fx.ts); Quemado burns through `igniteFighter`.
  const statusFx = createStatusFx(effects, { ignite: (id, level) => igniteFighter(id, level) });
  /** The campaign's statuses as last shown, by fighter and status, so a change of stacks updates them. */
  const shownStacks = new Map<string, number>();
  /**
   * The campaign's statuses (src/battle.ts `STATUSES`) are counted in rounds: shown while they have
   * stacks, at a level by how many (a third of their most each), their ring holding what is left.
   * Timed ones (`TIMED`: Quemado) show at their own level, their time kept in step with the fight's clock.
   */
  function syncStatuses(id: string, statuses: Partial<Record<StatusId, number>> | undefined, timed: Combatant['timed']) {
    for (const look of ['sangrado', 'mareo', 'llorera'] as const) {
      const n = statuses?.[look] ?? 0, key = `${id}:${look}`;
      if ((shownStacks.get(key) ?? 0) === n) continue;
      shownStacks.set(key, n);
      const most = STATUSES[look].max;
      if (n <= 0) statusFx.remove(id, look);
      else statusFx.apply(id, look, { level: Math.ceil(n / most * 3), seconds: most, left: n, held: true });
    }
    for (const look of ['quemado', 'cegado', 'sanacion', 'confusion', 'encogido'] as const) {
      const on = timed?.[look], level = on?.level ?? 0, key = `${id}:${look}`;
      if ((shownStacks.get(key) ?? 0) !== level) {
        shownStacks.set(key, level);
        if (!on) statusFx.remove(id, look);
        else statusFx.apply(id, look, { level, seconds: TIMED[look].seconds, left: on.left, held: true });
      } else if (on) statusFx.hold(id, look, on.left);
    }
  }
  // Each fighter owns its material copies, so a flash never lights up the whole pack.
  function ownMaterials(model: pc.Entity) {
    const copies = new Map<pc.Material, pc.StandardMaterial>();
    model.findComponents('render').forEach(component => (component as pc.RenderComponent).meshInstances.forEach(mesh => {
      const source = mesh.material as pc.StandardMaterial;
      let copy = copies.get(source);
      if (!copy) { copy = source.clone(); copies.set(source, copy); inheritColour(source, copy); }
      mesh.material = copy;
    }));
    const materials = [...copies.values()];
    // What each copy glows with at rest (the possessed eyes), so a flash fades back to it.
    return { materials, glow: materials.map(m => m.emissive.clone().mulScalar(m.emissiveIntensity)) };
  }
  function settle() { const done = complete; complete = undefined; done?.(); }
  /** Which way the fight's camera looks back from its centre. */
  const viewDir = (): V3 => { const c = camera(), d = Math.hypot(c.x, c.y, c.z); return { x: c.x / d, y: c.y / d, z: c.z / d }; };
  const v3 = (p: pc.Vec3): V3 => ({ x: p.x, y: p.y, z: p.z });
  /** Where a blow on someone lands, about chest high (lower on a giant, where the cats reach; on Vertitrón's eye, the eye). */
  function chestOf(f: Fighter) {
    if (f.part) return f.model.getPosition().clone();
    const floor = groundHeight(f.base.x, f.base.z), p = f.model.getPosition();
    const high = f.party ? 1.05 : f.onion ? .75 * f.scale.y : f.rigid ? 1.4 : f.minion ? .9 * f.scale.y : .7;
    return new pc.Vec3(p.x, floor + high, p.z);
  }
  /**
   * Where someone's weak point is (Punto débil): the onion's core, Vertitrón's belly (its eye, the
   * eye), the dish's middle, the ghost's pixel heart, anyone else's chest.
   */
  function weakPoint(f: Fighter) {
    if (f.part) return f.model.getPosition().clone();
    if (f.robot) return f.model.getPosition().clone().add(new pc.Vec3(0, 2.35, 0));
    if (f.dish?.cloche) return f.dish.cloche.getPosition().clone().add(new pc.Vec3(0, .1 * f.scale.y, 0));
    if (f.ghost) return f.model.getPosition().clone().add(new pc.Vec3(0, .95 * f.scale.y, 0));
    return chestOf(f);
  }
  const catsOf = (id: string) => borrowed ?? cats.get(id);
  const classOf = (id: string) => state?.allies.find(a => a.id === id)?.classId;
  /** Atacar by whoever wears Tecnópata: Bip goes and rams the target, the wearer stays put with a hand up. */
  /** Tecnópata's skills are Bip's too: it fires them, or blows itself up among the foes (Explosión), while its wearer points. */
  const BIP_SKILLS: ReadonlySet<string> = new Set(['rayo-energia', 'rayo-sanacion', 'explosion', 'confusion', 'rayo-encogedor']);
  /** Seconds between Rayo solar's rays, one foe after another. */
  const SWEEP_GAP = .1;
  /** How much of its size someone Encogido keeps (Rayo encogedor). */
  const SHRUNK = .62;
  /** Whether an action is Bip's, decided once for it (Explosión's Bip is gone before the action ends). */
  const bipActs = new WeakMap<BattleEffect, boolean>();
  const botStrikes = (action?: BattleEffect) => {
    if (!action) return false;
    if (!bipActs.has(action)) bipActs.set(action, !action.dual && classOf(action.actor) === 'tecnopata' && !!bips.get(action.actor)?.shown
      && (action.kind === 'attack' || !!action.release || (action.kind === 'skill' && !!action.skill && BIP_SKILLS.has(action.skill))));
    return bipActs.get(action)!;
  };
  /** Where Bip is when its wearer's blow is Bip's (`botStrikes`). */
  const botAt = (action: BattleEffect) => botStrikes(action) ? bips.get(action.actor)!.bip.entity.getPosition().clone() : undefined;
  /** Who of a dual's two draws (wears Matemágico) and who brings the claws (Papagato), by id. */
  function dualRoles(e: BattleEffect) {
    const [a, b] = e.dual!.actors;
    const caster = [a, b].find(id => classOf(id) === 'matemagico') ?? a, claws = [a, b].find(id => classOf(id) === 'papagato') ?? b;
    return { caster, claws: claws === caster ? b : claws };
  }
  /** When each strike of a dual lands, in fight seconds from its start. */
  /** Whether this dual had been seen before it played (decided once per effect): its choreography runs shorter. */
  const quick = new WeakMap<BattleEffect, boolean>();
  function seenBefore(e: BattleEffect) {
    if (!quick.has(e)) { quick.set(e, seenDuals.has(e.dual!.id)); seenDuals.add(e.dual!.id); }
    return quick.get(e)!;
  }
  const dualPace = (e: BattleEffect) => seenBefore(e) ? DUAL.seen : DUAL;
  const dualTimes = (e: BattleEffect) => e.dual!.id === 'punto-debil' ? [DUAL.stroke] : Array.from({ length: e.strikes?.length ?? 1 }, (_, k) => dualPace(e).setup + DUAL.claws[Math.min(k, DUAL.claws.length - 1)]);
  /** How far round a fight's foe a dual's circle goes, and its marks: the first towards the party. */
  function planDual(e: BattleEffect, target: Fighter) {
    const { claws } = dualRoles(e), owner = fighters.get(claws), pair = catsOf(claws);
    const rest = pair?.haru.entity.getPosition().clone() ?? owner?.base.clone() ?? target.base.clone().add(new pc.Vec3(-2, 0, 0));
    const feet = floorUnder(target), radius = Math.min(2.6, Math.max(.95, extent(target).radius * .55 + .55));
    const start = Math.atan2(rest.z - target.base.z, rest.x - target.base.x);
    const point = weakPoint(target), chest = chestOf(target);
    const from = new pc.Vec3(rest.x, groundHeight(rest.x, rest.z) + .35, rest.z), way = new pc.Vec3().sub2(point, from).normalize();
    return { feet, chest, point, radius, rest, facing: viewDir(), burnBefore: shownStacks.get(`${e.target}:quemado`) ?? 0, angles: Array.from({ length: 8 }, (_, k) => start + k * Math.PI / 4), beyond: point.clone().add(way.mulScalar(.5)) };
  }
  /** A dual begins: a hit-stop freeze, its stinger, and Gerard starts drawing (the scene slows on its own for Punto débil's aim). */
  function startDual(e: BattleEffect, target: Fighter, animate: boolean) {
    dualStarted = e; dualPlan = planDual(e, target);
    cue('dual');
    if (!animate) return;
    clock.hold = Math.max(clock.hold, DUAL_FREEZE);
    const plan = dualPlan, { caster } = dualRoles(e), drawer = fighters.get(caster);
    const hand = (drawer?.arms[0]?.findByName('Mano') as pc.Entity | null ?? drawer?.model)?.getPosition();
    if (e.dual!.id === 'zarpazos-de-fuego') {
      if (hand) dualFx.stroke(v3(hand), { x: plan.feet.x + Math.cos(plan.angles[0]) * plan.radius, y: plan.feet.y + .05, z: plan.feet.z + Math.sin(plan.angles[0]) * plan.radius }, DUAL_COLOURS.gold, .22, { width: .09, arc: .5 });
      dualFx.after(.18, () => dualFx.zarpazosCircle(v3(plan.feet), plan.radius, plan.angles, plan.facing, dualPace(e).setup - .14));
    } else {
      clock.slow(DUAL.aimSlow, dualPace(e).aimSeconds, DUAL_EASE, 'scene');
      if (hand) dualFx.stroke(v3(hand), v3(plan.point), DUAL_COLOURS.gold, .2, { width: .08, arc: .4 });
      dualFx.after(.12, () => dualFx.blueprint(v3(plan.point), { x: plan.rest.x, y: groundHeight(plan.rest.x, plan.rest.z) + .35, z: plan.rest.z }, plan.facing, Math.max(1.1, Math.min(2, extent(target).height * .35)), 1.1));
      cue('mark-set', { delay: .25 });
    }
  }
  /**
   * Strike `k` of a dual lands (`late` fight seconds ago). Zarpazos de fuego: a claw at its mark, its
   * coin over it, fire or a gold spark; Punto débil: the stroke, a flash and a gold ✕. The last one
   * holds the fight longest, punches in and pulses the picture; a Punto débil spent bursts.
   */
  function dualStrike(e: BattleEffect, target: Fighter, k: number, late: number, animate: boolean) {
    const plan = dualPlan!, strikes = e.strikes?.length ?? 1, last = k === strikes - 1;
    const unit = state && [...state.allies, ...state.foes].find(u => u.id === e.target);
    const coin = e.coins?.[k] ?? 0, zf = e.dual!.id === 'zarpazos-de-fuego';
    cue(zf ? (coin ? 'fire-hit' : 'claw') : 'claw-deep');
    if (!animate) return;
    const share = unit ? (e.strikes?.[k] ?? e.amount ?? 0) / unit.maxHp : 0;
    // A flash on a giant lights a lot of it: it flares less.
    const glare = target.rigid ? .4 : 1;
    const from = zf ? new pc.Vec3(plan.feet.x + Math.cos(plan.angles[k % 8]) * plan.radius, plan.feet.y, plan.feet.z + Math.sin(plan.angles[k % 8]) * plan.radius) : plan.rest;
    const dx = target.base.x - from.x, dz = target.base.z - from.z, d = Math.hypot(dx, dz) || 1;
    const landed = land({ share: last ? Math.max(share, .5) : share, skill: true, ko: last && target.hp <= 0 }, dx / d, 0, dz / d);
    if (zf) {
      dualFx.clawCoin({ x: from.x, y: plan.chest.y - .2, z: from.z }, v3(plan.chest), coin as 0 | 1, plan.facing, last ? 1.6 : 1);
      hit(target, coin ? flame : gold, (last ? 1 : .5) * glare);
    } else {
      dualFx.strike(v3(plan.point), plan.facing, { x: dx, y: 0, z: dz });
      hit(target, white, 1.5 * glare);
    }
    if (markSpent(e)) { dualFx.markBurst(v3(weakPoint(target)), plan.facing); if (last) cue('mark-spent'); }
    const stop = last ? Math.max(DUAL.finalStop, landed.stop) : Math.min(landed.stop, .05);
    effectTime -= clock.stop(stop, late);
    if (last) {
      pulse?.(1, 1); zoom.x = Math.max(zoom.x, HIT.punch.size * 1.6); shake = Math.max(shake, .35);
      if (zf) dualFx.flameSpiral(v3(plan.feet), extent(target).radius * .5, Math.min(4, Math.max(1.6, extent(target).height * .5)));
    }
  }
  /** Uri comes down from Vertitrón, himself again: the violet goes out of his eyes. */
  function freeUri(f: Fighter) {
    if (!f.robot || f.robot.uriFree) return;
    f.robot.uriFree = true;
    fears?.uriEyes(f.robot.uri ?? f.model, true);
  }
  /** A gold crosshair that stays over a foe while Punto débil is on it: a ring of twelve ticks, four arms and a dot. */
  function makeMark() {
    const root = new pc.Entity('Punto débil'); battleRoot.addChild(root);
    const bit = (p: number[], s: number[], r = 0) => { const e = new pc.Entity('Marca'); e.addComponent('render', { type: 'box', material: markGold, castShadows: false }); e.setLocalPosition(p[0], p[1], 0); e.setLocalScale(s[0], s[1], .01); e.setLocalEulerAngles(0, 0, r); root.addChild(e); };
    for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2; bit([Math.cos(a) * .3, Math.sin(a) * .3], [.15, .025], a * 180 / Math.PI + 90); }
    for (const [x, y] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) bit([x * .42, y * .42], [x ? .2 : .03, y ? .2 : .03]);
    bit([0, 0], [.05, .05], 45);
    return root;
  }
  /**
   * Punto débil's marks: shown over each foe that carries one (not before the blow that leaves it
   * lands; still there until the blow that spends it does), facing the camera, turning slowly.
   */
  function updateMarks(animate: boolean) {
    const want = new Set<string>();
    if (state) for (const unit of state.foes) {
      const f = fighters.get(unit.id);
      if (!f || f.hp <= 0 || entryTime < ENTRY_SECONDS) continue;
      const leaving = !!effect && markLeft(effect) && effect.target === unit.id && !(effect.dual ? clawed >= (effect.strikes?.length ?? 1) : impacted);
      const spending = !impacted && ((!!effect && markSpent(effect) && effect.target === unit.id) || !!effect?.hits?.some(h => h.target === unit.id && h.weakSpot));
      if ((weakSpotRounds(state, unit) > 0 && !leaving) || spending) want.add(unit.id);
    }
    for (const [id, mark] of marks) if (!want.has(id)) { mark.destroy(); marks.delete(id); }
    const view = viewDir();
    for (const id of want) {
      const f = fighters.get(id)!;
      let mark = marks.get(id);
      if (!mark) { mark = makeMark(); marks.set(id, mark); }
      const at = weakPoint(f).add(new pc.Vec3(view.x, view.y, view.z).mulScalar(.45 * Math.max(1, f.scale.x)));
      mark.setPosition(at); mark.lookAt(at.x + view.x, at.y + view.y, at.z + view.z);
      mark.rotateLocal(0, 0, animate ? time * 40 % 360 : 0);
      const size = Math.max(.9, Math.min(2, f.scale.x)) * (1 + (animate ? Math.sin(time * 6) * .07 : 0));
      mark.setLocalScale(size, size, size);
    }
  }
  /**
   * What an action changes in the world of Uri's tower, as it lands (any action: a blow, a dual or a
   * fire that breaks Vertitrón's eye, a foe's ability): each foe ability's own picture.
   */
  function worldFx(e: BattleEffect, actor: Fighter | undefined, target: Fighter | undefined, animate: boolean) {
    if (worldDone === e) return;
    worldDone = e;
    const ability = e.ability?.id, telegraph = e.telegraph?.id, view = viewDir();
    const robot = [...fighters.values()].find(f => f.robot);
    // Its eye breaks (`eye: 'broken'`, its Rayo called off if it was charging): it goes dark and the robot shudders.
    if (e.eye === 'broken' && robot?.robot) {
      robot.robot.brokeAt = time; cue('crack'); cue('fizzle', { delay: .15 });
      if (!state?.foes.some(u => u.kind === 'vertigo-ojo' && u.hp <= 0)) robot.robot.labBroken = true;
      if (animate) { dualFx.eyeBreak(v3(robot.robot.eye.getPosition()), view); shake = Math.max(shake, .5); pulse?.(.5, .6); }
    }
    if (!animate) return;
    const feet = target ? floorUnder(target) : undefined;
    if (ability === 'capa-nueva' && actor) { const { height, radius } = extent(actor); dualFx.wrap(v3(floorUnder(actor)), Math.max(.3, radius * .8), Math.max(.5, height)); cue('peel'); }
    if (ability === 'aplaston' && feet && actor?.onion) {
      // Heavier than any blow: wider, dark grit along the floor, and the picture drops with it.
      dualFx.shock(v3(feet), 3.4, actor.onion.skin.diffuse.toString(false), { chips: 140, light: true, heavy: true });
      lensWant.y = -.5; lensHold = Math.max(lensHold, .3); shake = Math.max(shake, .7); pulse?.(.6, .4); cue('slam');
    }
    if (ability === 'vuelta' && actor?.dish) { actor.dish.flipAt = time; cue('clink'); }
    if (ability === 'puaj' && actor) {
      const at = actor.dish?.cloche?.getPosition() ?? chestOf(actor);
      dualFx.splash(v3(at), [...fighters.values()].filter(f => f.party && f.hp > 0).map(f => v3(f.base))); cue('splash');
    }
    if (e.transparent?.length) cue('glitch');
    if (telegraph === 'carrerilla' && actor) {
      const named = e.telegraph?.target ? fighters.get(e.telegraph.target) : undefined;
      if (named) dualFx.after(.3, () => dualFx.runUp(v3(chestOf(actor)), v3(chestOf(named))));
    }
    // Vertitrón's moves (its stomp, sweep and beam land as blows too: `contactBurst`).
    if (!actor?.robot) return;
    const hit = [target, ...(e.splash ?? []).map(h => fighters.get(h.target))].filter((f): f is Fighter => !!f);
    if (ability === 'pisoton' && feet) {
      const foot = footOf(actor, stompSide(actor, target!));
      dualFx.stomp(foot, v3(feet)); shake = Math.max(shake, .55); pulse?.(.4, .3); cue('thump');
    }
    if (ability === 'barrido' && hit.length) {
      const { side } = axes(layout), way = { x: side.x * sweepWay(actor), y: 0, z: side.z * sweepWay(actor) };
      dualFx.sweep(hit.map(f => v3(floorUnder(f))), way); shake = Math.max(shake, .35); cue('gust');
    }
    if (ability === 'grito') {
      dualFx.roar(v3(actor.robot.eye.getPosition().clone().add(new pc.Vec3(0, .5, 0))), v3(floorUnder(actor)), view);
      shake = Math.max(shake, .7); pulse?.(.8, .6); zoom.x = Math.max(zoom.x, HIT.punch.size); cue('roar');
    }
    if (ability === 'carga' || telegraph === 'rayo') { dualFx.charge(v3(actor.robot.eye.getPosition()), view); pulse?.(.3, .5); cue('charge'); }
    if (ability === 'rayo') { for (const f of hit) dualFx.after(beamCrossing(e, f), () => dualFx.beamHit(v3(chestOf(f)))); shake = Math.max(shake, 1); pulse?.(1, 1); zoom.x = Math.max(zoom.x, HIT.punch.size * 1.5); }
  }
  /** Rayo terrorífico's sweep, in fight seconds from the start of its action: when it leaves the eye and how long it takes across. */
  const BEAM = { from: .3, span: .5 } as const;
  /** Vertitrón's right, along the floor (its own +x). */
  function rightOf(f: Fighter) { const r = f.model.right; const d = Math.hypot(r.x, r.z) || 1; return { x: r.x / d, y: 0, z: r.z / d }; }
  /** Which of its sides (−1 left, 1 right) someone stands on. */
  function sideOf(f: Fighter, other: Fighter) { const r = rightOf(f); return (other.base.x - f.base.x) * r.x + (other.base.z - f.base.z) * r.z < 0 ? -1 : 1; }
  /** The leg it stomps with: the one nearer whom it stomps. */
  const stompSide = (f: Fighter, target: Fighter) => sideOf(f, target) as -1 | 1;
  /** Where that foot is, on the floor. */
  function footOf(f: Fighter, side: -1 | 1): V3 {
    const r = rightOf(f), p = f.model.getPosition(), x = p.x + r.x * side * .62, z = p.z + r.z * side * .62;
    return { x, y: groundHeight(x, z), z };
  }
  /** The arm that sweeps: the one on the side of whom it reaches first, swung across to the others. */
  const sweepSide = (f: Fighter, target?: Fighter) => (target ? sideOf(f, target) : 1) as -1 | 1;
  function sweepWay(f: Fighter): number { const e = effect, t = e?.target ? fighters.get(e.target) : undefined; return -sweepSide(f, t); }
  /**
   * The Rayo's path along the floor: from beyond whom it hits first, through them and the others, to
   * beyond the last (across in front of them if it only has one).
   */
  function beamPath(e: BattleEffect) {
    const first = e.target ? fighters.get(e.target) : undefined, last = e.splash?.length ? fighters.get(e.splash[e.splash.length - 1].target) : undefined;
    const robot = fighters.get(e.actor);
    if (!first) return undefined;
    const a = floorUnder(first);
    let b = last ? floorUnder(last) : undefined;
    if (!b || a.distance(b) < .3) { const r = robot ? rightOf(robot) : { x: 1, z: 0 }; b = a.clone().add(new pc.Vec3(r.x * 2.4, 0, r.z * 2.4)); }
    const way = new pc.Vec3().sub2(b, a).normalize();
    return { start: a.clone().sub(way.clone().mulScalar(1.3)), end: b.clone().add(way.mulScalar(1.3)) };
  }
  /** Fight seconds from the Rayo's contact until its beam crosses `f`. */
  function beamCrossing(e: BattleEffect, f: Fighter) {
    const path = beamPath(e);
    if (!path) return 0;
    const along = new pc.Vec3().sub2(path.end, path.start), u = clamp01(new pc.Vec3().sub2(floorUnder(f), path.start).dot(along) / along.lengthSq());
    return Math.max(0, BEAM.from + u * BEAM.span - CONTACT_SECONDS);
  }
  /**
   * Vertitrón this frame (`id`, `t` seconds into the action): its pose for the move it is making,
   * kneeling once beaten and letting Uri and Nil down, its eye (its spiral, how hot it glows, the GPU
   * light that turns in it, charged or broken), and the Rayo's beam. Returns how much it rolls and
   * leans on top of the fight's own motion (shudders).
   */
  function robotFrame(id: string, f: Fighter, unit: Combatant | undefined, t: number, dt: number, animate: boolean) {
    const r = f.robot!, acting = !!effect && effect.actor === id && f.hp > 0 && !effect.dual, ability = acting ? effect!.ability?.id : undefined;
    const target = effect?.target ? fighters.get(effect.target) : undefined;
    const pose: RobotPose = { time: animate ? time : 0 };
    let roll = 0, lean = 0;
    // Beaten, it drops to its knees (a thud as they land), and then Uri comes down with Nil.
    const down = f.downAt === undefined ? -1 : time - f.downAt;
    r.kneel = down < 0 ? 0 : !animate ? 1 : smooth(down / .9) + Math.sin(clamp01((down - .9) / .35) * Math.PI) * .04;
    pose.kneel = r.kneel;
    if (down >= 0 && !r.knelt && (down >= .9 || !animate)) {
      r.knelt = true; cue('thump');
      if (animate) { dualFx.kneel([footOf(f, -1), footOf(f, 1)]); shake = Math.max(shake, .6); pulse?.(.3, .2); }
    }
    if (down >= (animate ? 1.2 : 0) && r.uri && !f.freed) {
      const held = r.uri, from = held.getPosition().clone(), turn = held.getRotation().clone(), size = held.getScale().clone();
      held.reparent(battleRoot); held.setPosition(from); held.setRotation(turn); held.setLocalScale(size);
      const { ahead, side } = axes(layout), to = f.base.clone().add(new pc.Vec3(-ahead.x * 1.7 + side.x * 1.9, 0, -ahead.z * 1.7 + side.z * 1.9));
      to.y = groundHeight(to.x, to.z);
      f.freed = { node: held, from, to, at: time };
    }
    if (f.freed) {
      const { node, from, to, at } = f.freed, k = animate ? smooth(clamp01((time - at) / 1.1)) : 1;
      node.setPosition(from.x + (to.x - from.x) * k, from.y + (to.y - from.y) * k + Math.sin(k * Math.PI) * 1.2, from.z + (to.z - from.z) * k);
      const party = [...fighters.values()].filter(o => o.party), middle = party.length ? party.reduce((sum, o) => sum.add(o.base), new pc.Vec3()).mulScalar(1 / party.length) : anchor;
      node.setEulerAngles(0, face(to, middle), 0);
      if (k >= 1 && !r.uriFree) { freeUri(f); if (animate) dualFx.standUp(v3(to.clone().add(new pc.Vec3(0, 1.1, 0)))); }
    }
    // Its moves.
    if (ability === 'pisoton' && target) { pose.stomp = smooth((t - .04) / .28) * (1 - smooth((t - .36) / .1)); pose.stompSide = stompSide(f, target); }
    if (ability === 'barrido') {
      pose.sweepSide = sweepSide(f, target); pose.sweep = smooth(t / .22) * (1 - smooth((t - .8) / .3)); pose.sweepAt = smooth((t - .28) / .36);
      if (r.swept !== effect && t >= .28 && animate) {
        r.swept = effect;
        const hand = r.hands[pose.sweepSide < 0 ? 0 : 1];
        if (hand) effects.trails.follow(hand, { colour: [FEAR_COLOURS.cream, FEAR_COLOURS.tile], width: .5, intensity: 1.4, core: .3, offset: { x: 0, y: -.3, z: 0 }, seconds: .42, life: .3 });
      }
    }
    if (ability === 'grito') pose.roar = smooth(t / .16) * (1 - smooth((t - .62) / .35));
    // Its eye: broken (by a blow, a dual, a fire; or the whole robot beaten), charged (the Rayo is coming), or at rest.
    const eyeUnit = state?.foes.find(u => u.kind === 'vertigo-ojo');
    const breaking = effect?.eye === 'broken' && worldDone !== effect;
    const broken = r.labBroken || f.hp <= 0 || (!!eyeUnit && eyeUnit.hp <= 0 && !breaking);
    const firing = ability === 'rayo' && t < BEAM.from + BEAM.span;
    const charged = !broken && (firing || (unit?.intent?.ability === 'rayo' && !(ability === 'carga' && !impacted)));
    if (ability === 'carga') pose.charge = smooth((t - .1) / .3);
    if (charged) pose.charge = Math.max(pose.charge ?? 0, ability === 'rayo' ? 1 - smooth((t - BEAM.from) / .06) : .75);
    if (ability === 'rayo') pose.recoil = smooth((t - BEAM.from) / .06) * (1 - smooth((t - BEAM.from - BEAM.span) / .3));
    if (broken !== r.broken) { r.broken = broken; fears?.eye(f.model, broken); }
    r.spin += (broken ? 0 : charged ? 620 : 50) * dt * (animate ? 1 : 0);
    pose.spin = r.spin % 360;
    // Its eyeball never keeps still for long: it darts somewhere, overshoots and settles, then darts again.
    const gz = r.gaze;
    if (!animate) { gz.x = gz.y = gz.vx = gz.vy = 0; }
    else if (!broken) {
      // Firing, it stares down the beam.
      if (ability === 'rayo' && t >= BEAM.from - .08) { gz.tx = 22; gz.ty = 0; gz.next = time + .05; }
      else if (time >= gz.next) {
        const wild = charged ? 1.5 : 1, small = !charged && Math.random() < .3;
        gz.tx = small ? gz.tx + (Math.random() - .5) * 8 : (Math.random() * 2 - 1) * 22 * wild;
        gz.ty = small ? gz.ty + (Math.random() - .5) * 10 : (Math.random() * 2 - 1) * 30 * wild;
        gz.next = time + (charged ? .06 + Math.random() * .16 : .22 + Math.random() * .7);
      }
      const omega = charged ? 70 : 42, zeta = .42;
      for (let left = dt; left > 1e-6; left -= 1 / 240) {
        const h = Math.min(left, 1 / 240);
        gz.vx += (omega * omega * (gz.tx - gz.x) - 2 * zeta * omega * gz.vx) * h; gz.x += gz.vx * h;
        gz.vy += (omega * omega * (gz.ty - gz.y) - 2 * zeta * omega * gz.vy) * h; gz.y += gz.vy * h;
      }
    } else gz.vx = gz.vy = 0;
    const wobble = broken || !animate ? 0 : Math.sin(time * 7.3) * 5 + (charged ? Math.sin(time * 41) * 4 : 0);
    pose.gaze = [gz.x, gz.y, wobble];
    const heat = broken ? 0 : charged ? .85 + .25 * Math.sin(time * 18) : ability === 'carga' && impacted ? .9 : .45;
    r.heat = animate ? r.heat + (heat - r.heat) * (1 - Math.exp(-dt * (broken ? 20 : 6))) : heat;
    const eyeF = r.eyeFighter;
    r.lens.forEach(({ material, lit, base }) => {
      const i = eyeF ? eyeF.materials.indexOf(material) : -1, k = r.heat * 2.2;
      if (i >= 0) eyeF!.glow[i].set(lit.r * k, lit.g * k, lit.b * k);
      material.diffuse.set(base.r * (broken ? .18 : 1), base.g * (broken ? .14 : 1), base.b * (broken ? .2 : 1));
      if (!eyeF || eyeF.flash <= 0) { material.emissive.set(lit.r * k, lit.g * k, lit.b * k); material.emissiveIntensity = 1; }
      material.update();
    });
    // The light that turns inside it, on the GPU; smoke from it once it is broken.
    const g = effects.gpu, at = r.eye.getPosition(), forward = new pc.Vec3();
    r.ball.getWorldTransform().getZ(forward).normalize();
    if (g?.active && animate) {
      if (!r.swirl) r.swirl = { stream: g.emitter('eyeswirl', { at: v3(at), rate: 0, shape: 'ring', spread: .24, around: 1.6, outward: -.05, speed: .03, life: [.4, .7], colour: FEAR_COLOURS.pale }), field: g.field({ at: v3(at), axis: v3(forward), radius: .45 }), glass: g.volume({ shape: 'sphere', mode: 'contain', size: { x: .5, y: .5, z: .5 }, bounce: .7, follow: r.eye, kinds: ['eyeswirl'] }) };
      const s = r.swirl, front = at.clone().add(forward.clone().mulScalar(.4));
      s.stream.at = v3(front); s.stream.axis = v3(forward);
      s.field.at.copy(front); s.field.axis.copy(forward);
      if (broken && !s.smoke) { s.smoke = true; s.stream.remove(); s.stream = g.emitter('fizzle', { at: v3(front), rate: 0, spread: .25, speed: .3, up: .6, life: [1, 1.8] }); s.field.swirl = s.field.pull = 0; }
      if (!broken && s.smoke) { s.smoke = false; s.stream.remove(); s.stream = g.emitter('eyeswirl', { at: v3(front), rate: 0, shape: 'ring', spread: .24, around: 1.6, outward: -.05, speed: .03, life: [.4, .7], colour: FEAR_COLOURS.pale }); }
      if (s.smoke) s.stream.rate = f.hp > 0 ? 7 : 3;
      else {
        s.stream.rate = charged ? 300 : ability === 'carga' ? 200 : 90; s.stream.around = charged ? 3.6 : 1.4;
        s.stream.spread = charged ? .28 : .22; s.stream.colour = charged ? '#f4ecff' : FEAR_COLOURS.pale;
        s.field.swirl = charged ? 40 : 10; s.field.pull = charged ? 30 : 9;
      }
      if (charged && time - r.pulseAt > .32) { r.pulseAt = time; dualFx.chargedPulse(v3(at), v3(forward)); }
    } else if (r.swirl) { r.swirl.stream.rate = 0; }
    // The Rayo: a beam from its eye sweeping across the roof, through everyone.
    const path = ability === 'rayo' && animate && effect ? beamPath(effect) : undefined;
    const on = !!path && t >= BEAM.from && t <= BEAM.from + BEAM.span + .06;
    beam.enabled = on;
    if (on && path) {
      const u = smooth(clamp01((t - BEAM.from) / BEAM.span) * .9 + .05);
      beamFloor.lerp(path.start, path.end, u);
      const from = at.clone().add(forward.clone().mulScalar(.55)), length = from.distance(beamFloor);
      beam.setPosition(from); beam.lookAt(beamFloor);
      for (const child of beam.children as pc.Entity[]) { const w = child.getLocalScale().x; child.setLocalPosition(0, 0, -length / 2); child.setLocalScale(w, length, w); }
      if (beamOf !== effect) {
        beamOf = effect; cue('beam');
        dualFx.beamStart(v3(at), v3(forward));
        effects.trails.follow(beamFloor, { colour: ['#f4ecff', '#9a6cd8'], width: .45, intensity: 2.6, core: .5, seconds: BEAM.span + .05, life: .5 });
        lensWant.zoom = -.04; lensHold = Math.max(lensHold, .9);
      }
      dualFx.beamTick(v3(from), v3(beamFloor), Math.min(1.5, dt * 60));
      // The beam's core flickers.
      const flicker = 1 + Math.sin(time * 90) * .12;
      beam.setLocalScale(flicker, flicker, 1);
    }
    // A blow on its eye jolts it; its eye breaking shakes it hard.
    const jolt = eyeF?.hitAt === undefined ? Infinity : time - eyeF.hitAt;
    if (animate && jolt < .5) roll += Math.exp(-jolt * 9) * Math.sin(jolt * 60) * 1.4;
    const broke = r.brokeAt === undefined ? Infinity : time - r.brokeAt;
    if (animate && broke < 1.4) { const k = 1 - broke / 1.4; roll += Math.sin(broke * 64) * 2.6 * k; lean -= 5 * Math.sin(clamp01(broke / .5) * Math.PI); }
    if (ability === 'grito' && animate) roll += Math.sin(time * 70) * .8 * (pose.roar ?? 0);
    fears?.pose(f.model, pose);
    return { roll, lean };
  }
  /** Vertitrón's eye as a fighter: it is drawn by Vertitrón (`robotFrame`); here it only flashes, burns and keeps its PV. */
  function eyeFrame(id: string, f: Fighter, dt: number) {
    if (f.fire) {
      const p = f.model.getPosition(); f.fire.at.set(p.x, p.y - .55, p.z);
      if (!f.fire.handle.burning || f.hp <= 0) { f.fire.handle.stop(); if (!f.fire.handle.burning) f.fire = undefined; }
    }
    shine(id, f, dt);
  }
  const floorUnder = (f: Fighter) => new pc.Vec3(f.base.x, groundHeight(f.base.x, f.base.z), f.base.z);
  /**
   * One-shot contact feedback: a flash and sparks where the blow lands, a ring and dust at the feet,
   * a flash on whoever is affected. Returns how a blow lands (hit-feel.ts); support skills only glow.
   */
  function contactBurst(action: BattleEffect, actor?: Fighter, target?: Fighter) {
    if (!actor || action.kind === 'escape') return;
    // Vertitrón's shout, its charge, and news of its eye breaking draw their own picture (`worldFx`).
    if (actor.robot && !target) return;
    // Rayo solar charging up: Gerard's fire streams into Bip.
    if (action.charging) { chargeUp(action); return; }
    if (!target) { hit(actor, gold, .55); effects.emit('star', new pc.Vec3(actor.base.x, 1.3, actor.base.z), 8, .35); return; }
    // Análisis Parálisis: Gerard works it out in a flash of gold; the stats rising are the rest (effect.stats).
    if (action.skill === 'analisis') { pulse?.(.1, .3); hit(actor, gold, 1.1); effects.insight(new pc.Vec3(actor.base.x, groundHeight(actor.base.x, actor.base.z) + 2.1 * actor.scale.y, actor.base.z)); return; }
    // Cardioide: a heart-shaped curve of green light under whoever it cures, and the cure rising up them.
    if (action.skill === 'cardioide') { pulse?.(0, .3); hit(target, green, 1); effects.cardioid(target.model); return; }
    // Yuki se esconde: a soft white shimmer over everyone she shelters.
    if (action.skill === 'escondite') { pulse?.(0, .25); for (const f of fighters.values()) if (f.party && f.hp > 0) { hit(f, white, .5); effects.emit('poof', new pc.Vec3(f.base.x, groundHeight(f.base.x, f.base.z) + .3, f.base.z), 5, .3); } return; }
    const guarded = state?.allies.find(a => a.id === action.target)?.guarding ?? false;
    const unit = state && [...state.allies, ...state.foes].find(u => u.id === action.target);
    const felt: Blow = { share: unit ? (action.amount ?? 0) / unit.maxHp : 0, skill: !!action.skill, guarded, ko: target.hp <= 0, swallowed: action.swallowed, beat: state?.phase === 'beat' };
    // Bip's ram comes from where Bip is, not from its wearer.
    const from = botAt(action) ?? actor.base;
    const dx = target.base.x - from.x, dz = target.base.z - from.z, d = Math.hypot(dx, dz) || 1;
    // Tecnópata's skills: Bip's rays, its blast, Rayo solar's sweep.
    if (botStrikes(action) && action.kind === 'skill') return bipBurst(action, target, from, felt, dx / d, dz / d);
    // Foc Binari: the streams make their own burst where they land (effects.binaryFire); the target
    // flares with the heat, hotter when it catches, and the picture lurches away from the caster.
    // Split in two, this is the zero landing: gold, and only its own share of the blow (the one is `secondStream`).
    if (action.skill === 'foc-binari') {
      const split = (action.strikes?.length ?? 1) > 1;
      hit(target, action.burn && !split ? flame : gold, action.burn && !split ? 1.3 : 1);
      const landed = land(split && unit ? { ...felt, share: action.strikes![0] / unit.maxHp, ko: false } : felt, dx / d, 0, dz / d);
      // The zero barely holds the picture, so the one lands right on its heels: tac-tac.
      return split ? { ...landed, stop: Math.min(landed.stop, .025) } : landed;
    }
    const reach = target.party ? .15 : .6;
    // On Vertitrón's eye, the blow lands on the eye, just in front of it; on Gerard or Aitor, on the
    // middle of the body (their heads are big: higher, it reads as a blow over them).
    const blow = target.part ? chestOf(target).add(new pc.Vec3(-dx / d * .35, 0, -dz / d * .35))
      : new pc.Vec3(target.base.x - dx / d * reach, groundHeight(target.base.x, target.base.z) + (target.party ? .6 : target.minion ? .9 : .85) * target.scale.y, target.base.z - dz / d * reach);
    // Zarpazo sangriento: Haru's claws leave three white-coral lines across their body, in front of it,
    // as big as they stand; the blow under them stays small and takes their colour, so the claws are what reads.
    const claw = action.skill === 'zarpazo';
    // Gum is the Queen's: a fear's own stuff does not splash pink, and an onion only sheds its skin.
    effects.impact(blow, from, claw ? .3 : action.skill ? 1.4 : 1, { guarded, gum: target.minion && !target.onion, feet: floorUnder(target), ...action.spell ? { colour: spellColour(action.element) } : claw ? { colour: CLAW_COLOURS[0] } : {} });
    if (claw) {
      const { right, up, facing } = screenAxes(viewDir()), body = extent(target), front = body.radius * .6 + .15;
      const at = target.part ? chestOf(target) : new pc.Vec3(target.base.x, groundHeight(target.base.x, target.base.z) + body.height * .5, target.base.z);
      effects.claw({ x: at.x + facing.x * front, y: at.y + facing.y * front, z: at.z + facing.z * front }, { right, up }, Math.min(2.2, Math.max(1.25, body.height * .9)));
    }
    // Atacar with an element: a little burst of it where it lands, and the flash takes its colour.
    if (action.element) statusFx.touch(action.element, action.target!);
    // A blow that opened a wound (it spent Sangrado) flares brighter; never red, nothing here reads as blood.
    hit(target, action.element ? ELEMENT_FLASH[action.element] : action.spell ? gold : claw ? clawFlash : white, action.bled ? 1.4 : guarded ? .4 : claw ? .7 : 1);
    return land(felt, dx / d, 0, dz / d);
  }
  /**
   * Bip's skill lands (`botStrikes`): a ray from where it floats (energy cyan, a cure's green, the
   * shrinking ray's white), waves of the mind twisting their way to a head, its blast among the foes,
   * or Rayo solar sweeping them one after another in sun yellow, each one catching fire.
   */
  function bipBurst(action: BattleEffect, target: Fighter, from: pc.Vec3, felt: Blow, ax: number, az: number) {
    const chest = chestOf(target), up = { x: 0, y: 1, z: 0 };
    const ray = (to: pc.Vec3, colours: readonly [string, string], width: number, at = from) => effects.trails.comet(v3(at), v3(to), colours, .06, { arc: 0, width, life: .3, intensity: 2.6, core: .5, additive: .9 });
    if (action.skill === 'rayo-sanacion') { ray(chest, ['#e6fff0', '#5fe39a'], .07); pulse?.(0, .25); hit(target, green, .9); effects.fightFx('heal', { model: target.model }); return; }
    if (action.skill === 'confusion') {
      const head = v3(chest.clone().add(new pc.Vec3(0, .45 * target.scale.y, 0)));
      for (const phase of [0, 2.1, 4.2]) effects.trails.comet(v3(from), head, ['#dffbff', BIP.cyan], .22, { arc: .1, width: .045, life: .35, intensity: 2, core: .4, twist: { turns: 2.5, radius: .14, phase } });
      dualFx.after(.22, () => dualFx.ring(head, up, .32, BIP.cyan, { count: 50, life: .7, size: 1.1, light: 1.5 }));
      hit(target, cyanFlash, .7); return;
    }
    if (action.skill === 'rayo-encogedor') {
      ray(chest, ['#ffffff', '#9fe8ff'], .05); hit(target, cyanFlash, .8);
      const feet = floorUnder(target);
      dualFx.ring({ x: feet.x, y: feet.y + .1, z: feet.z }, up, Math.max(.5, extent(target).radius), '#bff6ff', { count: 70, outward: -1.2, life: .6, size: 1.1 });
      return;
    }
    if (action.exploded) {
      // Bip blows itself up among them: a ball of fire, a shockwave along the floor, every foe flaring.
      const floor = groundHeight(from.x, from.z);
      effects.element('fire', v3(from), { strength: 2.2 });
      dualFx.shock({ x: from.x, y: floor, z: from.z }, 3.2, '#ff9a2e', { chips: 120, light: true, heavy: true });
      for (const h of action.hits ?? []) { const f = fighters.get(h.target); if (f) { hit(f, flame, 1.3); effects.element('fire', v3(chestOf(f)), { from: v3(from), strength: .8, feet: v3(floorUnder(f)) }); } }
      shake = Math.max(shake, .7); pulse?.(.5, .4);
      return land({ ...felt, share: Math.max(felt.share, .2) }, ax, 0, az);
    }
    if (action.release) {
      // Rayo solar: sun-yellow rays from Bip, one foe after another, each catching fire.
      (action.hits ?? []).forEach((h, i) => dualFx.after(i * SWEEP_GAP, () => {
        const f = fighters.get(h.target), at = bips.get(action.actor)?.bip.entity.getPosition().clone() ?? from;
        if (!f) return;
        const to = chestOf(f);
        ray(to, ['#fff6c8', '#ff9a2e'], .13, at);
        effects.element('fire', v3(to), { from: v3(at), strength: 1.2, feet: v3(floorUnder(f)) });
        hit(f, flame, 1.3);
      }));
      shake = Math.max(shake, .45); pulse?.(.6, .5);
      return land(felt, ax, 0, az);
    }
    // Rayo de energía: a cyan ray and its hit; what it made last longer flares in a ring round them.
    ray(chest, ['#e8fdff', BIP.cyan], .07);
    effects.impact(v3(chest), v3(from), 1, { colour: BIP.cyan, feet: floorUnder(target) });
    hit(target, cyanFlash, 1);
    if (action.extended) {
      const { height, radius } = extent(target), feet = floorUnder(target);
      dualFx.ring({ x: feet.x, y: feet.y + height * .5, z: feet.z }, up, Math.max(.55, radius * .8), BIP.cyan, { count: 90, life: .9, size: 1.2, light: 2 });
    }
    return land(felt, ax, 0, az);
  }
  /** Rayo solar charging up: Gerard's fire streams into Bip, which turns sun yellow (`updateBips`). */
  function chargeUp(action: BattleEffect) {
    const holder = action.charging!, b = bips.get(holder);
    if (!b) return;
    const giver = fighters.get(action.dual?.actors.find(id => id !== holder) ?? '');
    const to = v3(b.bip.entity.getPosition());
    if (giver) {
      const from = v3(chestOf(giver).add(new pc.Vec3(0, .35, 0)));
      [0, 2.1, 4.2].forEach((phase, k) => dualFx.after(k * .06, () => effects.trails.comet(from, to, ['#ffe9a0', '#ff8a1e'], .3, { arc: .5, width: .08, life: .3, intensity: 2.6, core: .5, twist: { turns: 1.5, radius: .14, phase } })));
    }
    dualFx.after(.34, () => { effects.element('fire', to, { strength: .7 }); dualFx.ring(to, { x: 0, y: 1, z: 0 }, .35, BIP.solar, { count: 60, outward: 1.5, life: .5, light: 2 }); });
    pulse?.(.2, .3);
  }
  /**
   * Foc Binari's second stream, the one, landing `at` seconds into the action: it sounds, flares on
   * the target (fire when it catches), lurches the picture and holds it, as hard as its own share.
   */
  function secondStream(action: BattleEffect, actor: Fighter | undefined, target: Fighter, animate: boolean, at: number) {
    cue(action.burn || action.melted ? 'fire-hit' : 'fizzle');
    if (!animate || !actor) return;
    hit(target, action.burn ? flame : gold, action.burn ? 1.4 : 1);
    const unit = state && [...state.allies, ...state.foes].find(u => u.id === action.target);
    const dx = target.base.x - actor.base.x, dz = target.base.z - actor.base.z, d = Math.hypot(dx, dz) || 1;
    const landed = land({ share: unit ? (action.strikes?.[1] ?? 0) / unit.maxHp : 0, skill: true, guarded: false, ko: target.hp <= 0 }, dx / d, 0, dz / d);
    effectTime -= clock.stop(landed.stop, effectTime - at);
  }
  /** Which effect has started its trails, and how far: 1 once the spell leaves, 2 once the blow swings. */
  let trailed: BattleEffect | undefined, trailStage = 0;
  /**
   * Light left by the action in flight: the leading fist (a dog's nose, the gum's head) swings an
   * arc into the blow, skills in the wearer's ánima colour (Foc Binari's raised hand too); a boost
   * winds round whoever it reaches. Short and fast: each one fades in a few tenths.
   */
  function trailsFor(action: BattleEffect, actor: Fighter, target: Fighter | undefined, t: number, support: boolean) {
    if (trailed !== action) { trailed = action; trailStage = 0; }
    const classId = state?.allies.find(a => a.id === action.actor)?.classId;
    const colour = action.skill === 'cardioide' ? CURE_COLOUR : action.skill && classId ? CLASSES[classId].colour : undefined;
    const light: [string, string] | undefined = colour ? [tint(colour, .35), colour] : undefined;
    const arm = actor.arms[0] as pc.Entity | undefined;
    // Cardioide's comet waits for his circle to open, and leaves its middle.
    if (trailStage === 0 && (action.skill !== 'cardioide' || t >= CAST_LAUNCH)) {
      trailStage = 1;
      if (support && light) {
        // It flies to whoever it reaches; on oneself it winds round.
        const reached = target ? [target] : [];
        const from = (action.skill === 'cardioide' ? mathCast.centre : undefined) ?? (arm?.findByName('Mano') as pc.Entity | null ?? actor.model).getPosition();
        for (const f of reached) {
          const floor = groundHeight(f.base.x, f.base.z);
          if (f === actor) effects.trails.spiral({ x: f.base.x, y: floor + .3, z: f.base.z }, light, { radius: .5, narrow: .6, height: 1.5 * f.scale.y, turns: 1.2, seconds: .45, width: .09, core: .35 });
          else effects.comet(from, { x: f.base.x, y: floor + 1.1 * f.scale.y, z: f.base.z }, colour!, .24, { width: .13, arc: .6 });
        }
      }
    }
    // A fist swings an arc in the swinger's own space, from just past the hand; a dog or the gum leaves a streak along its lunge.
    if (trailStage === 1 && !support && target && t >= (arm ? .24 : .16)) {
      trailStage = 2;
      const look = { colour: light ?? (actor.minion ? ['#ffd0e6', '#ff5fa2'] as const : ['#fff1cc', '#ffb347'] as const), width: light ? .2 : .15, intensity: light ? 3 : 1.8, core: light ? .7 : .45 };
      if (arm) effects.trails.follow(arm, { ...look, offset: { x: 0, y: -.42, z: 0 }, space: actor.model, seconds: .26, life: .2 });
      else if (actor.head) effects.trails.follow(actor.head, { ...look, offset: actor.minion ? { x: 0, y: .35, z: .45 } : { x: 0, y: .09, z: .45 }, seconds: .32, life: .2, width: .15 });
    }
  }
  /** Someone's stats go up or down (src/stat-fx.ts): the circle and the bars, sized to them as they stand now, and a tint on them. */
  /** How high over the floor someone reaches as they stand now, and how far round them their parts go. */
  function extent(f: Fighter) {
    const at = f.model.getPosition(), floor = groundHeight(at.x, at.z);
    let radius = 0, top = floor;
    for (const r of f.model.findComponents('render') as pc.RenderComponent[]) for (const m of r.meshInstances) {
      const low = m.aabb.getMin(), high = m.aabb.getMax();
      top = Math.max(top, high.y);
      radius = Math.max(radius, Math.abs(high.x - at.x), Math.abs(low.x - at.x), Math.abs(high.z - at.z), Math.abs(low.z - at.z));
    }
    return { height: top - floor, radius };
  }
  /**
   * Fighters in the order the fight particles know them: parts first (Vertitrón's eye), so their few
   * pieces are never left out of the particles' budget by the big model they belong to.
   */
  function fighterOrder() { const ids = [...fighters.keys()]; return [...ids.filter(id => fighters.get(id)!.part), ...ids.filter(id => !fighters.get(id)!.part)]; }
  /** Where someone's stat motes come from this frame (src/stat-motes.ts): their head, as tall as they stand; none while they are down or gone. */
  function moteAnchor(id: string) {
    const f = fighters.get(id);
    if (!f) return undefined;
    const feet = f.model.getPosition(), scale = f.model.getLocalScale(), index = fighterOrder().indexOf(id);
    const visible = f.model.enabled && f.downAt === undefined && f.hp > 0 && entryTime >= ENTRY_SECONDS;
    if (!visible) return { index, feet, height: 0, visible };
    f.measured ??= { ...extent(f), scale: scale.clone() };
    return { index, feet, height: f.measured.height * scale.y / f.measured.scale.y, visible };
  }
  function showStatChange(id: string, way: StatWay, delay = 0) {
    const f = fighters.get(id);
    if (!f) return;
    const floor = groundHeight(f.base.x, f.base.z), { height, radius: reach } = extent(f), top = floor + Math.max(1, height), radius = Math.max(.4, reach);
    effects.statChange({ x: f.base.x, y: floor, z: f.base.z }, way, { radius: Math.min(1.5, radius), height: top - floor, delay, model: f.model });
    // Facing the fight's camera (src/arena.ts `fightCamera`), in front of them.
    const view = camera();
    arrows.play(new pc.Vec3(f.base.x, floor, f.base.z), way, { height: top - floor, radius: Math.min(1.5, radius), delay, yaw: Math.atan2(view.x, view.z) * 180 / Math.PI });
    f.flash = Math.max(f.flash, .6); f.flashColor = way === 'down' ? statDown : statUp;
  }
  /**
   * An onion loses what the blow took as it lands: a layer of skin flies off, the one under it shows
   * in another colour, and it stands a step smaller, down to small and pale with none left.
   */
  function updateOnion(id: string, f: Fighter, dt: number, blows: number, animate: boolean, actor?: Fighter) {
    const unit = state?.foes.find(u => u.id === id), onion = f.onion;
    if (!unit || !onion) return;
    const coming = !effect ? 0 : effect.hits?.find(h => h.target === id)?.peeled ?? (effect.target === id ? effect.peeled ?? 0 : 0);
    const shown = (unit.layers ?? 0) + coming - Math.min(coming, blows);
    if (shown !== onion.shown) {
      if (shown < onion.shown) cue('peel');
      const position = f.model.getPosition(), radius = .65 * onion.size;
      const away = actor ? new pc.Vec3().sub2(f.base, actor.base).normalize() : pc.Vec3.ZERO;
      if (animate) for (let layer = onion.shown; layer > shown; layer--) {
        peels.shed(new pc.Vec3(position.x, position.y + .75 * onion.size, position.z), radius, skinOf(layer), away);
        effects.emit('dust', new pc.Vec3(position.x, position.y + .75 * onion.size, position.z), 5, radius * .8);
      }
      onion.shown = shown;
      onion.skin.diffuse.fromString(skinOf(shown)); onion.skin.update();
    }
    const want = onionSize(onion.kind, onion.shown);
    onion.size = animate ? onion.size + (want - onion.size) * (1 - Math.exp(-dt * 14)) : want;
    f.scale.set(onion.size, onion.size, onion.size);
  }
  /**
   * Haru stands a step ahead of Papagato's wearer, towards the foes, watching them (src/cat-gait.ts
   * does her legs, ears and tail); Yuki sits a step behind. Zarpazo sangriento: she leaps on the
   * target, lands low to swat, and hops back. Yuki se esconde: she gets up, slinks behind the
   * wearer pressed to the floor, ears flat, and goes back to sit. Off Papagato they go: in a puff
   * of smoke when it is the ánima that brings them, or, lent by Nuria (Uri's tower), stepping aside
   * behind the party to sit it out until someone wears it again.
   */
  function updateCats(dt: number, t: number, animate: boolean, target?: Fighter) {
    const wears = (id: string) => (fighters.get(id)?.hp ?? 0) > 0 && state?.allies.find(a => a.id === id)?.classId === 'papagato';
    // Borrowed, there are only these two: with the first who wears Papagato (whoever of them asks,
    // they answer) or, if nobody does right now, sitting it out by whoever is still up.
    const party = [...fighters].filter(([, f]) => f.party);
    const keeper = borrowed && (party.find(([id]) => wears(id)) ?? party.find(([, f]) => f.hp > 0))?.[0];
    for (const [id, f] of fighters) {
      if (borrowed && id !== keeper) continue;
      const wearing = wears(id);
      let pair = borrowed ?? cats.get(id);
      if (wearing && !pair) {
        pair = { haru: createCat(app, 'haru'), yuki: createCat(app, 'yuki') };
        battleRoot.addChild(pair.haru.entity); battleRoot.addChild(pair.yuki.entity);
        cats.set(id, pair);
        effects.emit('poof', new pc.Vec3(f.base.x, .2, f.base.z), 8, .3);
      }
      if (!pair) continue;
      // Their spots turn with the fight's line (src/arena.ts `catSpots`): ahead is towards the foes.
      const spots = catSpots(layout, f.base), { ahead, side } = axes(layout);
      const visible = !!borrowed || (wearing && entryTime >= ENTRY_SECONDS * .6);
      // Changing ánima mid-fight, they leave in a puff of smoke where they are, and come back in one at their places.
      if (!borrowed && animate && entryTime >= ENTRY_SECONDS && visible !== pair.haru.entity.enabled) {
        for (const [cat, spot] of [[pair.haru, spots.haru], [pair.yuki, spots.yuki]] as const) {
          const p = visible ? spot : cat.entity.getPosition();
          effects.emit('poof', new pc.Vec3(p.x, groundHeight(p.x, p.z) + .2, p.z), 10, .3);
        }
      }
      pair.haru.entity.enabled = pair.yuki.entity.enabled = visible;
      if (!borrowed && !wearing) continue;
      const foes = [...fighters.values()].filter(o => !o.party && o.hp > 0);
      // Lent, with nobody wearing Papagato, they step aside behind the party, on the side away from the others, and sit it out.
      const aside = !!borrowed && !wearing;
      const others = party.filter(([other, o]) => other !== id && o.hp > 0).reduce((sum, [, o]) => sum + (f.base.x - o.base.x) * side.x + (f.base.z - o.base.z) * side.z, 0);
      const out = Math.sign(others) || -1;
      const behind = (along: number, across: number) => new pc.Vec3(f.base.x + ahead.x * along + side.x * across * out, 0, f.base.z + ahead.z * along + side.z * across * out);
      const center = foes.length ? foes.reduce((sum, o) => sum.add(o.base), new pc.Vec3()).mulScalar(1 / foes.length) : new pc.Vec3(f.base.x + ahead.x * 3, 0, f.base.z + ahead.z * 3);
      // A dual whose claws are Papagato's: these two are in it, whoever of the pair confirmed it.
      const dualHere = !!effect?.dual && !!dualPlan && dualStarted === effect && (borrowed ? effect.dual.actors.some(wears) : effect.dual.actors.includes(id) && wearing);
      const mine = dualHere || (borrowed ? !!effect && wears(effect.actor) : effect?.actor === id);
      // Borrowed and not busy, they get to their places on their own legs.
      const walks = !!borrowed && !mine;
      // Haru: on guard, or the pounce out, the swat and the hop back.
      const rest = aside ? behind(-1.2, 1.1) : new pc.Vec3(spots.haru.x, 0, spots.haru.z);
      let at = rest.clone(), lift = 0, look = center, leap: number | undefined, crouch = 0;
      if (dualHere && target && dualPlan && animate) {
        const plan = dualPlan, times = dualTimes(effect!), first = times[0], last = times[times.length - 1];
        const home = spots.back(rest), floor = (p: pc.Vec3) => groundHeight(p.x, p.z);
        look = target.base;
        if (effect!.dual!.id === 'zarpazos-de-fuego') {
          // Round the circle, mark by mark: a leap to the first, a dash to each next, then home.
          const mark = (k: number) => { const a = plan.angles[k % plan.angles.length]; return new pc.Vec3(plan.feet.x + Math.cos(a) * plan.radius, 0, plan.feet.z + Math.sin(a) * plan.radius); };
          if (t < first - .16) crouch = 1;
          else if (t < first) { const u = smooth((t - first + .16) / .16); at = new pc.Vec3().lerp(rest, mark(0), u); lift = Math.sin(u * Math.PI) * .5; leap = u; }
          else if (t <= last + .12) {
            let k = 0;
            while (k + 1 < times.length && t >= times[k + 1]) k++;
            const next = times[k + 1];
            if (next !== undefined && t > times[k] + .03) { const u = smooth((t - times[k] - .03) / (next - times[k] - .03)); at = new pc.Vec3().lerp(mark(k), mark(k + 1), u); lift = Math.sin(u * Math.PI) * .25; leap = u; }
            else { at = mark(k); crouch = 1; }
          } else {
            const u = smooth((t - last - .12) / .4);
            at = new pc.Vec3().lerp(mark(times.length - 1), rest, u); lift = Math.sin(u * Math.PI) * .4; leap = u < 1 ? u : undefined;
            if (u > .05) look = new pc.Vec3(home.x, 0, home.z);
          }
        } else {
          // Punto débil: low and still while Gerard works it out, then one straight stroke through the point, and back.
          const beyondFloor = floor(plan.beyond), high = Math.max(0, plan.beyond.y - beyondFloor - .3);
          if (t < DUAL.dash) crouch = 1;
          else if (t < DUAL.stroke + .02) { const u = clamp01((t - DUAL.dash) / (DUAL.stroke + .02 - DUAL.dash)) ** .7; at = new pc.Vec3().lerp(rest, plan.beyond, u); lift = high * u; leap = .5; }
          else if (t < DUAL.stroke + .28) { at = plan.beyond.clone(); lift = high; leap = .5; }
          else {
            const u = smooth((t - DUAL.stroke - .28) / .5);
            at = new pc.Vec3().lerp(plan.beyond, rest, u); lift = high * (1 - u) * (1 - u) + Math.sin(u * Math.PI) * .3; leap = u < 1 ? u : undefined;
            look = new pc.Vec3(home.x, 0, home.z);
          }
        }
        at.y = 0;
      } else if (mine && (effect?.skill === 'zarpazo' || effect?.skill === 'zarpazos') && target) {
        // Zarpazos: she stays on the target until the last little claw has landed, and hops back quicker.
        const flurry = effect.skill === 'zarpazos' ? (effect.strikes?.length ?? 1) - 1 : 0, stay = flurry * CLAW_SECONDS;
        const out = smooth((t - .05) / (CONTACT_SECONDS - .05)), back = smooth((t - CONTACT_SECONDS - .15 - stay) / (.45 - stay * .4));
        // A big onion stands wider: she lands at its skin, not inside it.
        const landing = spots.strike(target.base), wide = Math.max(0, target.scale.x - 1) * .6, strike = new pc.Vec3(landing.x - ahead.x * wide, 0, landing.z - ahead.z * wide);
        at = new pc.Vec3().lerp(rest, strike, out * (1 - back));
        lift = animate ? Math.sin(out * Math.PI) * .55 * (1 - back) + Math.sin(back * Math.PI) * .3 : 0;
        if (animate && flurry && t >= CONTACT_SECONDS && t < CONTACT_SECONDS + stay + .1) lift += Math.abs(Math.sin((t - CONTACT_SECONDS) / CLAW_SECONDS * Math.PI)) * .2;
        const home = spots.back(rest);
        look = back > .05 ? new pc.Vec3(home.x, 0, home.z) : target.base;
        // Low before the spring and low on landing, flying in between.
        leap = out > 0 && out < 1 ? out : back > 0 && back < 1 ? back : undefined;
        crouch = out <= 0 || (out >= 1 && back <= 0) ? 1 : 0;
      }
      placeCat(pair.haru, dt, at, lift, look, animate, wearing ? { alert: 1, crouch, leap } : { sit: 1 }, walks);
      // Yuki: sitting behind, or slinking off to hide behind the wearer.
      const shelter = aside ? behind(-1.6, .5) : new pc.Vec3(spots.yuki.x, 0, spots.yuki.z);
      const hide = mine && effect?.skill === 'escondite' ? (animate ? Math.sin(clamp01(t / .85) * Math.PI) : 0) : 0;
      const spot = new pc.Vec3().lerp(shelter, new pc.Vec3(spots.hidden.x, 0, spots.hidden.z), hide);
      placeCat(pair.yuki, dt, spot, 0, center, animate, { sit: hide > .02 ? 0 : 1, fear: Math.min(1, hide * 2) }, walks);
    }
  }
  /**
   * Bip floats by the shoulder of whoever wears Tecnópata, a step ahead and on the side away from the
   * others, watching the foes (src/bip.ts). Atacar is Bip's: it pulls back, darts at the target, rams
   * it, bounces off and comes back, while the wearer stays put pointing. Putting Tecnópata on, Bip
   * comes out of the wearer as a stream of cyan nanites that gathers at its place and powers up;
   * taking it off, or falling, it comes apart into nanites that go back into the wearer's chest.
   */
  function updateBips(dt: number, t: number, animate: boolean, target?: Fighter) {
    const { ahead } = axes(layout);
    // Beside the wearer as the camera sees them, never in front of them: across the view, a touch towards the camera.
    const c = camera(), flat = Math.hypot(c.x, c.z) || 1, toCamera = { x: c.x / flat, z: c.z / flat }, across = { x: toCamera.z, z: -toCamera.x };
    const party = [...fighters].filter(([, f]) => f.party);
    const foes = [...fighters.values()].filter(o => !o.party && o.hp > 0);
    for (const [id, f] of party) {
      const unit = state?.allies.find(a => a.id === id);
      // Blown up (Explosión): gone from the blast until the round it sits out is over; then it forms again on its own.
      const blowing = effect?.actor === id && !!effect.exploded && animate && t < CONTACT_SECONDS;
      const rebuilding = unit?.out !== undefined && !!state && state.round <= unit.out && !blowing;
      const wearing = f.hp > 0 && classOf(id) === 'tecnopata' && entryTime >= ENTRY_SECONDS * .6 && !rebuilding;
      let b = bips.get(id);
      if (!b && !wearing) continue;
      // On the side away from the others on screen.
      const others = party.filter(([other, o]) => other !== id && o.hp > 0).reduce((sum, [, o]) => sum + (f.base.x - o.base.x) * across.x + (f.base.z - o.base.z) * across.z, 0);
      const out = Math.sign(others) || 1, floor = groundHeight(f.base.x, f.base.z), reach = BIP.beside * f.scale.x;
      const rest = new pc.Vec3(f.base.x + across.x * reach * out + toCamera.x * .2, floor + BIP.height * f.scale.y, f.base.z + across.z * reach * out + toCamera.z * .2);
      if (!b) {
        const chest = new pc.Entity('Pecho de Bip'); f.model.addChild(chest); chest.setLocalPosition(0, .62, 0);
        const bip = createBip(app); battleRoot.addChild(bip.entity);
        b = { bip, shown: false, since: 0, power: 0, at: rest.clone(), chest, solar: 0 };
        bips.set(id, b);
      }
      if (wearing !== b.shown) {
        b.shown = wearing; b.since = 0;
        // Blown up, it is simply gone: the blast was its way out.
        b.gone = !wearing && rebuilding;
        if (wearing) { b.at.copy(rest); b.bip.entity.enabled = true; b.bip.entity.setPosition(rest); }
        if (animate) {
          if (wearing) effects.nanites({ from: chestOf(f), to: b.bip.entity, model: f.model });
          else if (!b.gone) effects.nanites({ from: b.bip.entity.getPosition(), to: b.chest, count: 200, seconds: .6 });
        }
      }
      b.since += dt;
      // Formed once its nanites have gathered; gone quickly, spinning down into them.
      b.power = !animate ? (b.shown ? 1 : 0) : b.shown ? smooth((b.since - .22) / .4) : b.gone ? 0 : 1 - smooth(b.since / .3);
      if (!b.shown && b.power <= 0) { b.bip.entity.enabled = false; continue; }
      const center = foes.length ? foes.reduce((sum, o) => sum.add(o.base), new pc.Vec3()).mulScalar(1 / foes.length) : new pc.Vec3(f.base.x + ahead.x * 3, 0, f.base.z + ahead.z * 3);
      let look = new pc.Vec3(center.x, floor + .7, center.z), lean = 0;
      const acting = b.shown && animate && !!target && effect?.actor === id && botStrikes(effect);
      if (acting && effect!.exploded) {
        // Explosión: up and into the middle of the foes, faster and faster; it blows up there (`bipBurst`).
        const over = new pc.Vec3(center.x, floor + 1.1, center.z), u = clamp01(t / CONTACT_SECONDS);
        b.at.lerp(rest, over, u * u); lean = 1; look = over;
      } else if (acting && effect!.kind === 'skill') {
        // A ray, or Rayo solar's sweep: it turns to whoever it is for, draws back a little and kicks back as it fires.
        const sweep = effect!.release ? effect!.hits ?? [] : [];
        const k = Math.min(Math.max(0, sweep.length - 1), Math.max(0, Math.floor((t - CONTACT_SECONDS) / SWEEP_GAP)));
        const aim = (sweep[k] && fighters.get(sweep[k].target)) || target!;
        const rise = effect!.release ? .35 * smooth(t / CONTACT_SECONDS) * (1 - smooth((t - CONTACT_SECONDS - sweep.length * SWEEP_GAP) / .4)) : 0;
        const kick = smooth((t - CONTACT_SECONDS) / .06) * (1 - smooth((t - CONTACT_SECONDS - .06) / .3));
        b.at.lerp(b.at, new pc.Vec3(rest.x, rest.y + rise, rest.z), 1 - Math.exp(-dt * 10));
        look = chestOf(aim); lean = t < CONTACT_SECONDS ? -.25 * smooth(t / .2) : -.7 * kick;
      } else if (acting) {
        // The ram: back a little, a dart at the target's chest, a bounce off it, and home.
        const chest = chestOf(target), away = new pc.Vec3(rest.x - chest.x, 0, rest.z - chest.z);
        away.normalize();
        const hitAt = chest.clone().add(away.clone().mulScalar(.28 * target.scale.x + .12));
        const back = rest.clone().add(away.clone().mulScalar(.2)), bounce = hitAt.clone().add(away.clone().mulScalar(.35)).add(new pc.Vec3(0, .12, 0));
        const at = new pc.Vec3();
        if (t < .16) { at.lerp(rest, back, smooth(t / .16)); lean = -.4; }
        else if (t < CONTACT_SECONDS) { const u = clamp01((t - .16) / (CONTACT_SECONDS - .16)); at.lerp(back, hitAt, u * u); lean = 1; }
        else if (t < CONTACT_SECONDS + .14) { at.lerp(hitAt, bounce, smooth((t - CONTACT_SECONDS) / .14)); lean = -.7; }
        else { const u = smooth((t - CONTACT_SECONDS - .14) / .5); at.lerp(bounce, rest, u); lean = -.3 * (1 - u); }
        b.at.copy(at); look = chest;
      } else b.at.lerp(b.at, rest, animate ? 1 - Math.exp(-dt * 6) : 1);
      const entity = b.bip.entity;
      entity.setPosition(b.at);
      // Going, it spins down; coming, it grows out of its nanites with a little overshoot.
      const spin = b.shown ? 0 : (1 - b.power) * 540;
      // Waiting, it watches the foes half turned to the camera, so its face reads; striking, it faces the blow.
      const watching = face(b.at, look), toView = Math.atan2(toCamera.x, toCamera.z) * 180 / Math.PI;
      const yaw = lean ? watching : watching + (((toView - watching + 540) % 360) - 180) * .45;
      entity.setEulerAngles(0, yaw + spin, 0);
      const grow = b.shown ? 1 + 1.6 * (b.power - 1) ** 3 + .6 * (b.power - 1) ** 2 : b.power;
      const size = BIP.scale * Math.max(.001, grow) * f.scale.y;
      entity.setLocalScale(size, size, size);
      // Charged with Gerard's fire (Rayo solar) it glows sun yellow from when the fire reaches it until it lets go.
      const releasing = !!effect?.release && effect.actor === id && t < CONTACT_SECONDS + (effect.hits?.length ?? 1) * SWEEP_GAP + .2;
      const solar = releasing || (!!unit?.charge && !(effect?.charging === id && t < .5)) ? 1 : 0;
      b.solar = animate ? b.solar + (solar - b.solar) * (1 - Math.exp(-dt * 6)) : solar;
      b.bip.animate(dt, { look, lean, power: b.power, animate, solar: b.solar });
    }
  }
  /** `walks`: the cat comes from wherever it is, running, unless that is too far (a jump): then it lands there. */
  function placeCat(cat: Cat, dt: number, at: pc.Vec3, lift: number, look: pc.Vec3, animate: boolean, action: CatAction, walks = false) {
    if (walks && animate) {
      const from = cat.entity.getPosition(), gap = Math.hypot(at.x - from.x, at.z - from.z), step = CAT_RUN * dt;
      if (gap > step && gap < CAT_LANDS) { look = at; at = new pc.Vec3().lerp(from, at, step / gap); action = {}; }
    }
    cat.entity.setPosition(at.x, groundHeight(at.x, at.z) + lift, at.z);
    cat.entity.setEulerAngles(0, face(at, look), 0);
    // A touch bigger than life, so they read from the fight's camera.
    cat.entity.setLocalScale(1.35, 1.35, 1.35);
    cat.animate(dt, { ...action, animate });
  }
  /**
   * The model a fighter is cloned from: their street model, a fear, the minion or a dog. Only a dog
   * is ever drawn as a dog: a foe with no model of its own (Vertitrón's eye) is drawn by its owner.
   */
  function sourceOf(unit: Combatant, i: number, party: boolean) {
    const fear = !party && unit.kind ? fears?.templates.get(unit.kind) : undefined;
    const minion = !party && (!!fear || ((unit.kind === 'minion' || unit.kind === 'guardian') && !!minionTemplate));
    return party ? partyModel(unit.id) : fear ?? (minion ? minionTemplate! : dogs[i % dogs.length]);
  }
  /**
   * Vertitrón's eye (a part, `vertigo-ojo`): a fighter with no model of its own. It is the eye in
   * Vertitrón's chest, so blows, plates, fire and particles go there; it stands, for whoever runs at
   * it, at Vertitrón's feet, a step towards the party.
   */
  function buildPart(unit: Combatant, owner: Fighter) {
    const model = owner.robot!.eye, { ahead } = axes(layout);
    const base = owner.base.clone().add(new pc.Vec3(-ahead.x * .9, 0, -ahead.z * .9));
    const f: Fighter = {
      model, base, start: base.clone(), hp: unit.hp, party: false, shrink: 1, body: null, head: null, arms: [], legs: [], yaw: 0, turn: 0, eyes: [], tail: null, minion: false, rigid: true, grown: false,
      ears: [], eyeScale: 1, seed: 0, flash: 0, flashColor: white, ...ownMaterials(model),
      scale: new pc.Vec3(1, 1, 1), walk: new WalkAnimation(), plantFeet: () => {}, part: owner,
    };
    const robot = owner.robot!;
    robot.eyeFighter = f;
    robot.lens = lensOf(model);
    fighters.set(unit.id, f);
    return f;
  }
  /** The eye's lens, spiral and pupil: their materials, lit and plain, so the fight can heat them up and put them out. */
  function lensOf(eye: pc.Entity) {
    return ['Globo del ojo', 'Iris del ojo', 'Brazo de la espiral', 'Pupila del ojo', 'Cristal del ojo'].map(name => {
      const material = (eye.findByName(name) as pc.Entity).render!.meshInstances[0].material as pc.StandardMaterial;
      return { material, lit: material.emissive.clone().mulScalar(material.emissiveIntensity), base: material.diffuse.clone() };
    });
  }
  /** Builds a fighter standing at `base`, coming in from `start`. */
  function build(unit: Combatant, i: number, party: boolean, base: pc.Vec3, start: pc.Vec3) {
    // The palace guards (chapter 2) are minions grown to the size of a wardrobe.
    const fear = !party && unit.kind ? fears?.templates.get(unit.kind) : undefined;
    const minion = !party && (!!fear || ((unit.kind === 'minion' || unit.kind === 'guardian') && !!minionTemplate));
    const source = sourceOf(unit, i, party);
    const model = source.clone(); model.enabled = true;
    if (unit.id === 'bernat') model.findComponents('render').forEach(component => {
      (component as pc.RenderComponent).meshInstances.forEach(mesh => {
        if (mesh.material?.name === 'Camiseta mostaza') mesh.material = allyJacket;
      });
    });
    battleRoot.addChild(model); model.setPosition(start);
    const body = party ? model.findByName('Cuerpo') as pc.Entity : null;
    const arms = (body?.children.filter(c => c.name === 'Brazo') ?? []) as pc.Entity[];
    // Uri's fears fight in the tower's narrow corridors, so they stay nearer the party's size.
    const young = unit.kind === 'cebollita' || unit.kind === 'platito' || unit.kind === 'fantasmita';
    if (minion) { const size = isOnion(unit.kind) ? onionSize(unit.kind, unit.layers ?? 0) : unit.kind === 'guardian' ? 2.3 : young ? .62 : unit.kind === 'vertigo' ? 1 : fear ? 1.05 : 1.5; model.setLocalScale(size, size, size); }
    const legs = (body?.children.filter(c => c.name === 'Pierna') ?? (minion ? [] : model.children.filter(c => c.name === 'Pata'))) as pc.Entity[];
    const yaw = party ? (source.findByName('Cuerpo') as pc.Entity).getLocalEulerAngles().y : source.getEulerAngles().y;
    if (body) body.setLocalEulerAngles(0, 0, 0);
    model.setLocalEulerAngles(0, yaw, 0);
    const feet = party ? legs.map(leg => leg.findByName('Zapatilla') as pc.Entity) : minion ? [model.findByName('Charco pringoso') as pc.Entity] : legs;
    const head = model.findByName(party ? 'Pivote de cabeza' : minion ? 'Cabeza de chicle' : 'Cabeza de perro') as pc.Entity | null;
    const eyes = model.find(node => node.name === 'Ojo') as pc.Entity[];
    fighters.set(unit.id, {
      model, base, start, hp: unit.hp, party, shrink: 1, body, head, arms, legs, yaw, turn: yaw, eyes, tail: model.findByName('Cola') as pc.Entity | null, minion, rigid: unit.kind === 'vertigo', grown: party && grownUp(unit.profile),
      ears: model.find(node => node.name === 'Oreja') as pc.Entity[], eyeScale: eyes[0]?.getLocalScale().y ?? 1, seed: party ? i * 3.1 + .4 : i,
      flash: 0, flashColor: white, ...ownMaterials(model),
      scale: model.getLocalScale().clone(), walk: new WalkAnimation(), plantFeet: createGroundContact(model, feet),
    });
    // A foe can come apart when beaten: its shader is ready from the start, so nothing stalls then (Vertitrón kneels instead).
    if (!party && unit.kind !== 'vertigo') fighters.get(unit.id)!.materials.forEach(dissolvable);
    if (isOnion(unit.kind)) {
      const skin = (model.find(node => node.name === 'Capa')[0] as pc.Entity).render!.meshInstances[0].material as pc.StandardMaterial;
      skin.diffuse.fromString(skinOf(unit.layers ?? 0)); skin.update();
      fighters.get(unit.id)!.onion = { kind: unit.kind, shown: unit.layers ?? 0, size: model.getLocalScale().x, skin };
    }
    const built = fighters.get(unit.id)!;
    // A dish shows what it is on its plate; a fantasmita can go see-through, row by row.
    if (unit.kind === 'plato' || unit.kind === 'platito') built.dish = { plate: model.findByName('Plato') as pc.Entity | null, cloche: head };
    if (unit.kind === 'fantasmita') {
      const pixels = model.find(node => node.name === 'Píxel') as pc.Entity[];
      built.ghost = { clear: 0, pixels: pixels.map(node => ({ node, row: Math.round(node.getLocalPosition().y / .14) })) };
    }
    // Vertitrón: its eye, its hands and Uri up on it, whom no blow on it flashes.
    if (unit.kind === 'vertigo') {
      const eye = model.findByName('Ojo de Vertitrón') as pc.Entity, uri = model.findByName('Uri arriba') as pc.Entity | null;
      built.robot = { eye, ball: model.findByName('Globo') as pc.Entity, gaze: { x: 0, y: 0, vx: 0, vy: 0, tx: 0, ty: 0, next: 0 }, uri, hands: ['Hombro izquierdo', 'Hombro derecho'].map(name => model.findByName(name)!.findByName('Mano del robot') as pc.Entity), spin: 0, heat: .45, charged: 0, broken: false, pulseAt: 0, kneel: 0, lens: lensOf(eye) };
      built.steady = new Set((uri?.findComponents('render') as pc.RenderComponent[] ?? []).flatMap(r => r.meshInstances.map(m => m.material).filter((m): m is pc.Material => !!m)));
      // Nor does a fire on it burn him.
      uri?.tags.add('fireproof');
      built.eyes = [];
    }
    // Whoever wears an ánima shows it in the fight, even when the street model does not (Gerard at 35, Aitor).
    // Dressed after ownMaterials, so the street model keeps its own look.
    if (party) wearClass(model, unit.classId, grownUp(unit.profile));
    return fighters.get(unit.id)!;
  }
  return {
    dogs, anchor, cameraKick, focus,
    /** Where the fight's camera looks (see `frame`). */
    get frame() { return frame; },
    /** How high the tallest foe of this fight reaches (0 outside a fight). */
    get foeTop() { return foeTop; },
    /** How much of the ortho height the frame is punched in by a heavy blow right now. */
    get punch() { return Math.max(-.2, zoom.x + lens.zoom); },
    /**
     * How the big moments turn the fight's camera (game.ts adds it): degrees round the fight and
     * up or down (negative lower), on top of the players' own lean.
     */
    get lens() { return { yaw: lens.yaw, pitch: lens.pitch }; },
    /** How fast particles should run: slowed while a hit-stop holds the fight. */
    get pace() { return (clock.hold > 0 ? HIT.pace : 1) * clock.scale; },
    /**
     * Slow motion (a dual's banner, battle-ui.ts): the fight, its particles and its choreography run
     * at `scale` for `seconds` of real time, then ease back to full speed (DUAL_EASE).
     */
    slowmo(scale: number, seconds: number) { if (animating) clock.slow(scale, seconds, DUAL_EASE, 'ui'); },
    /**
     * How fast the fight runs now, every slow motion together (the banner's and the choreography's
     * own, Punto débil's aim): the fight screen's clock (statuses, Quemado's pulses) follows it.
     */
    get speed() { return clock.scale; },
    /** Where a dual's spotlight goes (post.ts `spotlight`). */
    setSpot(next: typeof spot) { spot = next; },
    /**
     * Development (the effects lab): plays `next` as the fight would show it, without changing the
     * fight: a dual's choreography, a foe's ability. Nothing waits for it.
     */
    preview(next: BattleEffect) {
      if (!state) return false;
      settle(); effect = next; effectTime = 0; impact = undefined; impacted = false; clawed = 0; dualStarted = undefined; worldDone = undefined;
      complete = () => {};
      return true;
    },
    /** Where big moments send their chromatic fringe and bloom swell (post.pulse). */
    setPulse(next: (fringe: number, bloom: number) => void) { pulse = next; },
    /** Where the moments only the picture knows go to sound (a claw landing, a layer off, a fall). */
    setCue(next: typeof cue) { cue = next; },
    /** Haru and Yuki already with the party, if any: this fight uses them instead of bringing its own. It gives them back when it ends. */
    borrowCats(pair: { haru: Cat; yuki: Cat } | undefined) { borrowed = pair; },
    /** The model cloned for minion foes. */
    setMinionTemplate(model: pc.Entity) { minionTemplate = model; },
    /** Uri's fears' models (src/fears.ts). */
    setFears(models: Fears) { fears = models; },
    /**
     * An ánima wakes in Gerard (Matemágico, at the palace minion's beat): a flash and a shockwave
     * in its colour that rocks the foes, and when it fades he wears it. The story records the
     * ánima; this is only what the fight shows.
     */
    awaken(id: ClassId) {
      const gerard = fighters.get('gerard');
      if (!gerard) return;
      hit(gerard, white, 2.2); shake = .8;
      if (animating) { pulse?.(1, 1); zoom.x = HIT.punch.size; }
      effects.anima(gerard.base, CLASSES[id].colour, true);
      for (const f of fighters.values()) if (!f.party) hit(f, white, .9);
      setTimeout(() => wearClass(gerard.model, id, gerard.grown), 260);
    },
    /**
     * L / R in a fight: a burst of light in the ánima's colour, sparks rising round them, and the
     * fighter comes out of it wearing the other ánima.
     */
    /** Until the next action starts, the fire on `id` stays as it shows: its blow is waiting for something (the bulbs). */
    holdFire(id?: string) { fireWaits = id; },
    changeAnima(id: string, classId: ClassId) {
      const f = fighters.get(id);
      if (!f) return;
      hit(f, new pc.Color().fromString(CLASSES[classId].colour), 1.8);
      if (animating) pulse?.(.25, .45);
      effects.anima(f.base, CLASSES[classId].colour);
      setTimeout(() => wearClass(f.model, classId, f.grown), 180);
    },
    /** Dark pink, glowing eyes for the street dogs: they obey La Reina Bubbaloo's minion. */
    possess(on: boolean) {
      for (const eyes of dogEyes) for (const eye of eyes) {
        eye.render!.meshInstances[0].material = on ? eyePink : eyeDark;
        // Wider, glowing eyes read from the street camera; blinking only touches the height.
        const size = eye.getLocalScale();
        eye.setLocalScale(on ? .085 : .055, size.y, on ? .04 : .03);
      }
    },
    selectTarget(id?: string) { selectedTarget = id; },
    /**
     * Sets a fighter alight at `level` (or changes how hard they burn), or lets the fire die down
     * with no level. The fire is sized to their model and wraps it: their body burns, flames rise
     * behind and in front of them, its light falls on them and they glow with its heat; it follows
     * them and goes out when they fall.
     */
    ignite: igniteFighter,
    /**
     * Puts a status on a fighter (src/status-fx.ts: its look, a ring on the floor that empties as it
     * runs out, a tint and a way of moving), raising its level if it is on already; level 0 takes it off.
     */
    status(id: string, look: StatusLookId, level?: number, seconds?: number) {
      if (level === 0) statusFx.remove(id, look); else statusFx.apply(id, look, { level, seconds });
    },
    /**
     * A timed status pulsed on a fighter (src/battle.ts `runClock`): they flare with it, and a pulse
     * that leaves them at 0 PV knocks them down as a blow would.
     */
    pulse(id: string) {
      const f = fighters.get(id), unit = state && [...state.allies, ...state.foes].find(u => u.id === id);
      if (!f || !unit) return;
      hit(f, flame, .7);
      f.hp = unit.hp;
    },
    /** A reaction between elements on a fighter (docs/combat.md): what was on them turns into what it leaves. */
    react(reaction: ReactionId, id: string) { statusFx.react(reaction, id); },
    /** Plays a stat going up or down on someone: fights do it from `BattleEffect.stats`, this is for the effects lab. */
    statChange(id: string, way: StatWay) { showStatChange(id, way); },
    /** What statuses a fighter carries: look, level and how much is left (0–1). */
    statusesOf(id: string) { return statusFx.on(id); },
    /** Which stat motes a fighter gives off (stats up, down or both: src/stat-motes.ts). */
    statMotesOf(id: string) { return motes.shown(id); },
    /** Who is in the fight, for development tools and scenarios. */
    fighterIds() { return [...fighters].map(([id, f]) => ({ id, party: f.party, hp: f.hp })); },
    /** A fighter's model, for effects aimed at them. */
    modelOf(id: string) { return fighters.get(id)?.model; },
    /** Adds whoever is standing in the fight to `out`, so particles flow around them. */
    bodies(out: ParticleBody[]) {
      for (const f of fighters.values()) {
        if (!f.model.enabled || f.part) continue;
        const p = f.model.getPosition(), lying = f.party && f.downAt !== undefined;
        out.push({ x: p.x, y: p.y, z: p.z, radius: (lying ? .6 : f.party ? .3 : .38) * f.scale.x, height: (lying ? .4 : f.party ? 1.5 : 1) * f.scale.y, key: f.model });
      }
    },
    /**
     * Where each fighter's plate and speech go on screen: over their head; Vertitrón's eye's beside the
     * eye; and `uri`, over Uri up on Vertitrón, for the moves he shouts (battle-ui `shout`).
     */
    targets() {
      const { right } = screenAxes(viewDir());
      const list = [...fighters].map(([id, f]) => ({
        id, visible: f.hp > 0 && entryTime >= ENTRY_SECONDS,
        position: f.part ? f.model.getPosition().clone().add(new pc.Vec3(right.x * 1.35, right.y * 1.35 - .25, right.z * 1.35))
          : f.model.getPosition().clone().add(new pc.Vec3(0, f.party ? 1.65 : f.onion ? 1.6 * f.scale.y : 1.45, 0)),
      }));
      const robot = [...fighters.values()].find(f => f.robot);
      if (robot?.robot?.uri) list.push({ id: 'uri', visible: !!state && entryTime >= ENTRY_SECONDS, position: robot.robot.uri.getPosition().clone().add(new pc.Vec3(0, 1.75, 0)) });
      return list;
    },
    wander(i: number, dt: number, moving: boolean, animate: boolean) {
      const gait = dogWalks[i].update(dt, moving, animate, .32);
      dogLegs[i].forEach((leg, index) => leg.setLocalEulerAngles(gait.stride * (index === 0 || index === 3 ? 1 : -1), 0, 0));
      animateDogHead(dogHeads[i], dogEars[i], dogEyes[i], i, moving, animate);
    },
    get entering() { return !!state && entryTime < ENTRY_SECONDS; },
    get entryProgress() { return smooth(entryTime / ENTRY_SECONDS); },
    /**
     * `stage`: how the two sides line up round `center` (src/arena.ts `formation`): on open ground,
     * or along a street that runs x or z; `pocket` when the fight was moved to a pocket made of the
     * place (src/pocket.ts), where everyone steps in from just behind where they will stand.
     */
    set(next: BattleState | undefined, center: pc.Vec3, nextEffect?: BattleEffect, onImpact?: (blow: number) => void, stage: FightStage = { layout: 'open' }): Promise<void> {
      settle();
      const entering = !!next && !state;
      if (entering) {
        anchor.copy(center); entryTime = 0; celebrated = false;
        layout = stage.layout; pocketed = !!stage.pocket;
        // A part of a foe (Vertitrón's eye) stands nowhere of its own: only whole foes take a place.
        const whole = next.foes.filter(unit => !unit.part);
        const slots = formation(layout, next.allies.length, whole.map(unit => unit.kind), stage.spread), { ahead, side } = axes(layout);
        {
          foeKinds = whole.map(unit => unit.kind);
          const view = camera(), flat = Math.hypot(view.x, view.z), right = { x: view.z / flat, z: -view.x / flat };
          const across = [...slots.allies, ...slots.foes].map(p => p.x * right.x + p.z * right.z);
          const middle = (Math.min(...across) + Math.max(...across)) / 2 - HUD_SHIFT;
          frame.set(anchor.x + right.x * middle, anchor.y, anchor.z + right.z * middle);
        }
        for (const [party, units] of [[true, next.allies], [false, whole]] as const) units.forEach((unit, i) => {
          const slot = (party ? slots.allies : slots.foes)[i];
          const base = new pc.Vec3(anchor.x + slot.x, anchor.y + .15, anchor.z + slot.z);
          // In place they come from where they stood, the party side by side; in a pocket, from just
          // behind their spot (the party) or just beyond it (the foes).
          const step = party ? -2.4 : 1.6;
          const source = sourceOf(unit, i, party);
          const start = pocketed ? new pc.Vec3(base.x + ahead.x * step, base.y, base.z + ahead.z * step) : source.getPosition().clone();
          if (party && !pocketed) start.add(new pc.Vec3(side.x * i * 1.4, 0, side.z * i * 1.4));
          build(unit, i, party, base, start);
        });
        // Then the parts, on whom they belong to (Vertitrón's eye in its chest).
        const owner = [...fighters.values()].find(f => f.robot);
        for (const unit of next.foes) if (unit.part && owner) buildPart(unit, owner);
      }
      // The picker's moments can put a broken eye back (`stageMoment`): what the effects lab broke comes back too.
      for (const f of fighters.values()) if (f.robot) f.robot.labBroken = false;
      if (next && !foeTop) {
        // Measured once per fight, in the pose it was built in.
        for (const f of fighters.values()) if (!f.party) for (const r of f.model.findComponents('render') as pc.RenderComponent[]) for (const m of r.meshInstances) foeTop = Math.max(foeTop, m.aabb.getMax().y - f.model.getPosition().y);
      }
      if (!next) foeTop = 0;
      state = next; effect = nextEffect; effectTime = 0; impact = onImpact; impacted = false; clawed = 0; fireWaits = undefined; clock.clear(!next);
      if (!next) {
        dualFx.clear(); marks.forEach(m => m.destroy()); marks.clear(); beam.enabled = false; beamOf = undefined;
        for (const f of fighters.values()) if (f.robot?.swirl) { f.robot.swirl.stream.remove(); f.robot.swirl.field.remove(); f.robot.swirl.glass.remove(); f.robot.swirl = undefined; }
        dualStarted = dualPlan = worldDone = undefined; lensHold = 0; spotWant = spotAmount = 0; spot?.(0, []);
        Object.assign(lens, { yaw: 0, pitch: 0, zoom: 0, x: 0, y: 0, z: 0 }); Object.assign(lensWant, lens);
      }
      if (!next) { mathCast.clear(); borrowed = undefined; peels.clear(); arrows.clear(); motes.clear(); cats.forEach(pair => { pair.haru.destroy(); pair.yuki.destroy(); }); cats.clear(); bips.forEach(b => { b.bip.destroy(); b.chest.destroy(); }); bips.clear(); statusFx.clear(); shownStacks.clear(); fighters.forEach(f => { if (!f.part) f.model.destroy(); f.freed?.node.destroy(); f.materials.forEach(m => m.destroy()); }); fighters.clear(); selectedTarget = undefined; effects.clear(); }
      else [...next.allies, ...next.foes].forEach(u => { fighters.get(u.id)!.hp = u.hp; });
      player.enabled = !next;
      if (!entering && !nextEffect) return Promise.resolve();
      return new Promise(resolve => { complete = resolve; });
    },
    update(dt: number, animate = true) {
      // Real time drives the camera; the fight itself stands still while a hit-stop holds.
      const elapsed = dt; real += dt; animating = animate; dt = clock.advance(dt);
      arrows.update(elapsed);
      time += dt; effectTime += dt;
      dualFx.update(dt);
      if (mathCast.update(dt)) spellLaunch(effect?.element).forEach(sound => cue(sound.id, sound));
      entryTime = animate ? Math.min(ENTRY_SECONDS, entryTime + dt) : ENTRY_SECONDS;
      cameraKick.set(0, 0, 0); focus.set(0, 0, 0);
      dogs.forEach((model, i) => {
        dogTails[i].setLocalEulerAngles(38, animate ? Math.sin(time * 7 + i) * 20 : 0, 0);
        if (model.enabled) plantDogs[i](groundHeight);
      });
      const actor = effect ? fighters.get(effect.actor) : undefined;
      const target = effect?.target ? fighters.get(effect.target) : undefined;
      // Heals and boosts stay put: no run-up to anyone. Papagato's wearer stays put too: Haru goes.
      const support = !!effect?.skill && SUPPORT.has(effect.skill);
      const catStrike = effect?.skill === 'zarpazo' || effect?.skill === 'zarpazos';
      // Tecnópata's wearer stays put too: Bip goes.
      const botStrike = botStrikes(effect);
      // Foc Binari is thrown from where the caster stands: no run-up, the hand goes up instead.
      const focBinari = effect?.skill === 'foc-binari' && !!target;
      // So is Matemágico's Atacar: the hand up, his circle and a ball (src/math-cast.ts). Cardioide's comet leaves the circle too.
      const spelling = !!effect?.spell && !!target, curing = effect?.skill === 'cardioide' && !!target;
      const casting = focBinari || spelling || curing;
      const castLaunch = spelling ? SPELL_LAUNCH : CAST_LAUNCH, castContact = spelling ? SPELL_CONTACT : curing ? CURE_CONTACT : CAST_CONTACT;
      // A dual attack: both its fighters stay where they are; Gerard draws and Haru strikes (`DUAL`).
      const dual = effect?.dual && target ? effect.dual : undefined;
      const roles = dual ? dualRoles(effect!) : undefined;
      const times = dual ? dualTimes(effect!) : undefined;
      if (dual && dualStarted !== effect) startDual(effect!, target!, animate);
      const contact = times ? times[0] : casting ? castContact : effect?.target && !support ? CONTACT_SECONDS : .2;
      if (effect && !dual && !impacted && (!animate || effectTime >= contact)) {
        impacted = true; impact?.(0);
        worldFx(effect, actor, target, animate);
        if (effect.spell) mathCast.land();
        const landed = animate && effect ? contactBurst(effect, actor, target) : undefined;
        // What the blow's element turned: its moment, as it lands (docs/combat.md § Reacciones entre elementos).
        if (animate && effect.reaction && effect.target) statusFx.react(effect.reaction.id, effect.target);
        // Punto débil spent: its mark bursts and the blow lands bigger (three times as hard).
        const spent = markSpent(effect) ? [effect.target] : effect.hits?.filter(h => h.weakSpot).map(h => h.target) ?? [];
        if (spent.length) {
          cue('mark-spent');
          if (animate) {
            for (const id of spent) { const f = id ? fighters.get(id) : undefined; if (f) dualFx.markBurst(v3(weakPoint(f)), viewDir()); }
            pulse?.(1, .9); zoom.x = Math.max(zoom.x, HIT.punch.size * 1.4); shake = Math.max(shake, .3);
            if (landed) landed.stop = Math.max(landed.stop, .16);
          }
        }
        // Hit-stop: rewind to the contact pose and hold it (FightClock.stop).
        if (landed) effectTime -= clock.stop(landed.stop, effectTime - contact);
        // A big onion's weight reaches everyone else too.
        // Whatever went up or down shows now; a flurry's last layer, as that claw lands.
        // After a blow it waits for the blow's own ring to fade, so the two do not read as one.
        for (const change of effect?.stats ?? []) {
          const delay = effect!.boosted ? 0 : STAT_AFTER_BLOW + (change.target === effect!.target && effect!.peeled ? (effect!.peeled - 1) * CLAW_SECONDS : 0);
          cue(change.way === 'down' ? 'stat-down' : 'stat-up', { delay });
          if (animate) showStatChange(change.target, change.way, delay);
        }
        // The Rayo reaches each as its beam crosses them.
        if (animate) for (const other of effect?.splash ?? []) {
          const f = fighters.get(other.target), e = effect;
          if (!f) continue;
          const show = () => { hit(f, e.ability?.id === 'rayo' ? violetHit : white, e.ability?.id === 'rayo' ? 1.4 : .7); effects.emit('dust', new pc.Vec3(f.base.x, groundHeight(f.base.x, f.base.z) + .1, f.base.z), 6, .4); };
          if (e.ability?.id === 'rayo') dualFx.after(beamCrossing(e, f), show); else show();
        }
      }
      const t = animate ? effectTime : ACTION_SECONDS;
      // The blows landed so far: one at contact, and a flurry's others a moment after each other
      // (Foc Binari's one a little later than a claw: tac, tac).
      const spacing = casting ? CAST_GAP : CLAW_SECONDS;
      const claws = effect?.strikes?.length ?? 1;
      const blows = times ? (!animate ? claws : times.filter(at => t >= at).length) : !impacted ? 0 : !animate ? claws : Math.min(claws, 1 + Math.floor(Math.max(0, t - contact) / spacing));
      if (dual && target && blows > clawed) {
        // A dual's strikes, each as it lands; the first also shows what went up or down, and the world's changes.
        for (let k = clawed; k < blows; k++) {
          if (k === 0) {
            impacted = true;
            worldFx(effect!, actor, target, animate);
            for (const change of effect!.stats ?? []) {
              cue(change.way === 'down' ? 'stat-down' : 'stat-up', { delay: STAT_AFTER_BLOW });
              if (animate) showStatChange(change.target, change.way, STAT_AFTER_BLOW);
            }
          }
          impact?.(k);
          dualStrike(effect!, target, k, effectTime - times![k], animate);
        }
        clawed = blows;
      } else if (effect?.strikes && target && blows > clawed) {
        // Each blow after the first tells the fight screen as it lands: the bar drops one hit at a time.
        for (let blow = Math.max(1, clawed); blow < blows; blow++) impact?.(blow);
        if (clawed && casting) secondStream(effect, actor, target, animate, contact + spacing);
        else {
          if (clawed) cue('claw');
          if (animate && clawed) { hit(target, white, .75); effects.emit('spark', target.part ? chestOf(target) : new pc.Vec3(target.base.x, groundHeight(target.base.x, target.base.z) + .7 * target.scale.y, target.base.z), 7, .35 * target.scale.x); }
        }
        clawed = blows;
      }
      peels.update(dt);
      // Vertitrón only steps in to stomp: it sweeps and fires from where it stands.
      const planted = !!actor?.robot && effect?.ability?.id !== 'pisoton';
      const motion = actor && target && !support && !catStrike && !botStrike && !casting && !dual && !planted ? contactMotion(actor.base, target.base, t) : undefined;
      // How far the caster's hand is up: raised before the streams leave, lowered once they land.
      // Sending Bip, the wearer points it at the target until it is back.
      const raise = casting && animate ? smooth(t / (castLaunch * .85)) * (1 - smooth((t - castContact - .12) / .35))
        : botStrike && animate ? smooth(t / .2) * (1 - smooth((t - CONTACT_SECONDS - .25) / .35)) : 0;
      // A dual: Gerard's hand goes up while he draws, and comes down as the last strike lands.
      const drawing = dual && animate ? smooth(t / .18) * (1 - smooth((t - times!.at(-1)! - .1) / .35)) : 0;
      const dualEnd = times ? times.at(-1)! + dualPace(effect!).tail : 0;
      // Into place gathering speed: off slowly, then a rush, then a short brake (`surge`).
      const entryMove = surge((entryTime - .1) / .75);
      const selected = selectedTarget ? fighters.get(selectedTarget) : undefined;
      marker.enabled = !!selected && selected.hp > 0 && !effect && entryTime >= ENTRY_SECONDS;
      if (selected) marker.setPosition(selected.base.x, groundHeight(selected.base.x, selected.base.z) + .025, selected.base.z);
      for (const [id, f] of fighters) {
        if (f.part) { eyeFrame(id, f, dt); continue; }
        updateOnion(id, f, dt, blows, animate, actor);
        const opponents = [...fighters.values()].filter(other => other.party !== f.party && other.hp > 0);
        const opponent = opponents[0];
        // At rest everyone squares up to the middle of the other side; the active ally turns toward whatever is being picked.
        const center = opponents.length ? opponents.reduce((sum, o) => sum.add(o.base), new pc.Vec3()).mulScalar(1 / opponents.length) : undefined;
        const aiming = !effect && f.party && !!selected && selected !== f && selected.hp > 0 && state?.phase === 'player' && state.allies[state.active]?.id === id;
        // The giant does not turn round to whoever hits it: it keeps facing the party.
        const dualing = !!dual && (id === roles!.caster || id === roles!.claws);
        // Vertitrón sweeping or firing faces the middle of everyone it reaches.
        const reached = f.robot && id === effect?.actor && (effect.ability?.id === 'barrido' || effect.ability?.id === 'rayo') ? [target, ...(effect.splash ?? []).map(h => fighters.get(h.target))].filter((o): o is Fighter => !!o) : [];
        const reachFor = reached.length ? reached.reduce((sum, o) => sum.add(o.base), new pc.Vec3()).mulScalar(1 / reached.length) : undefined;
        const lookAt = reachFor ?? ((id === effect?.actor || dualing) && target ? target.base : id === effect?.target && actor && !f.rigid && !dual ? actor.base : aiming ? selected!.base : center);
        // With nobody left to face, each side looks the way its line faces.
        const { ahead } = axes(layout), facingAhead = Math.atan2(ahead.x, ahead.z) * 180 / Math.PI;
        const yaw = lookAt ? face(f.base, lookAt) : f.party ? facingAhead - 10 : facingAhead + 185;
        const noticedYaw = opponent ? face(f.start, opponent.start) : f.yaw;
        const noticeDelta = ((noticedYaw - f.yaw + 540) % 360) - 180;
        const firstLook = f.yaw + noticeDelta * smooth(entryTime / .16);
        const formationTurn = ((yaw - firstLook + 540) % 360) - 180;
        const facing = firstLook + formationTurn * smooth((entryTime - .18) / .5);
        const turnLeft = ((facing - f.turn + 540) % 360) - 180;
        const settled = animate && entryTime >= ENTRY_SECONDS;
        f.turn = settled ? f.turn + turnLeft * (1 - Math.exp(-dt * (f.rigid ? 3 : 9))) : facing;
        // Big pivots get a quick shuffle of the feet instead of spinning on the spot.
        const pivoting = settled && Math.abs(turnLeft) > 8;
        const notice = animate && entryTime < .3 ? Math.sin(entryTime / .3 * Math.PI) : 0;
        const position = new pc.Vec3().lerp(f.start, f.base, entryMove);
        // The party swings out to one side as it lines up: wide on open ground, less along a street or in a pocket.
        if (f.party) { const swing = Math.sin(entryMove * Math.PI) * (pocketed ? .6 : layout === 'open' ? 1.8 : .9), { side } = axes(layout); position.x += side.x * swing; position.z += side.z * swing; }
        let lean = -notice * (f.rigid ? 1.5 : 6), roll = 0, strike = 0;
        const movingIn = animate && entryMove > 0 && entryMove < 1;
        const attacking = !!motion && id === effect?.actor;
        const stepping = attacking ? (t > .12 && t < CONTACT_SECONDS) || (t > .62 && t < 1.06) : movingIn || pivoting;
        const gait = f.walk.update(dt, stepping, animate, attacking ? .3 : .38);
        const stride = gait.stride;
        let hop = 0;
        if (motion && id === effect?.actor) {
          // The giant takes one heavy step and leans its whole height in; the rest run up and hop.
          if (f.rigid) position.set(f.base.x + (motion.x - f.base.x) * .3, f.base.y, f.base.z + (motion.z - f.base.z) * .3);
          else position.set(motion.x, f.base.y, motion.z);
          strike = smooth((t - .28) / .18) * (1 - smooth((t - .57) / .2));
          lean = strike * (f.rigid ? 8 : 13);
          hop = f.party || f.rigid || !animate ? 0 : Math.sin(clamp01((t - .16) / .46) * Math.PI) * .3;
        }
        if (support && id === effect?.actor) strike = animate ? Math.sin(clamp01(t / .8) * Math.PI) * .65 : 0;
        const lifted = id === effect?.actor && !dual ? raise : dual && id === roles!.caster ? drawing : 0;
        if (lifted) lean = -lifted * 5;
        const guarding = state?.allies.find(a => a.id === id)?.guarding ?? false;
        if (motion && id === effect?.target && animate) {
          const recoil = motion.recoil * (guarding ? .12 : f.rigid ? .05 : .34);
          position.x += motion.ux * recoil; position.z += motion.uz * recoil;
          lean = -motion.recoil * (guarding ? 5 : f.rigid ? 1.5 : 18);
          roll = Math.sin(t * 52) * motion.recoil * (f.rigid ? .5 : 3);
        }
        const unit = f.party ? undefined : state?.foes.find(u => u.id === id);
        // Carrerilla: a big onion rolls back to the edge and wobbles there, until it falls on whom it looked at.
        if (f.onion && unit) {
          const telling = effect?.telegraph?.id === 'carrerilla' && effect.actor === id && !impacted;
          const want = unit.intent?.ability === 'aplaston' && (unit.layers ?? 0) > 0 && !telling ? 1 : 0;
          f.back = animate ? (f.back ?? 0) + (want - (f.back ?? 0)) * (1 - Math.exp(-dt * (want ? 3 : 9))) : want;
          if (f.back > .002) { const { ahead } = axes(layout); position.x += ahead.x * f.back * 1.3; position.z += ahead.z * f.back * 1.3; if (animate) roll += Math.sin(time * 9 + f.seed) * 7 * f.back; }
        }
        // Vertitrón: its pose, its eye, the Rayo, kneeling when beaten.
        if (f.robot) { const extra = robotFrame(id, f, unit, t, dt, animate); roll += extra.roll; lean += extra.lean; }
        const idle = idlePose(time, f.seed);
        // Statuses move them too: frozen stands still, poisoned or dizzy sways, paralysed twitches.
        const stance = statusFx.motion(id), lively = animate && stance !== 'freeze' && (f.party || f.downAt === undefined);
        const celebrating = animate && f.party && f.hp > 0 && state?.phase === 'won' && !effect;
        if (celebrating) hop = Math.abs(Math.sin(time * 5.5 + f.seed)) * .3;
        // Gerard and Aitor knocked out stay down where they fell, lying on their side, until the fight
        // ends or something brings them round: then they get back up. A beaten foe does not fall: it
        // shudders, then crumbles at once into violet specks that hang and drift up, rising a touch
        // itself as it goes (src/disintegrate.ts). Under a flurry, it goes on the last blow.
        const defeated = f.hp <= 0 && (id !== effect?.target || (impacted && blows >= claws));
        if (defeated) { if (f.downAt === undefined) cue('ko'); f.downAt ??= time; f.upAt = undefined; }
        else if (f.party && f.downAt !== undefined && f.hp > 0) f.upAt ??= time;
        const rising = f.upAt === undefined ? 0 : clamp01((time - f.upAt) / RISE_SECONDS);
        if (rising >= 1 || (f.upAt !== undefined && !animate)) { f.downAt = f.upAt = undefined; f.landed = false; }
        const down = f.downAt === undefined ? -1 : time - f.downAt;
        const fall = down < 0 || !f.party ? 0 : !animate ? 1 : smooth(down / FALL_SECONDS) * (1 - smooth(rising));
        if (fall) {
          roll += fall * 86;
          // A little bounce as they land; getting up, they push off the floor.
          hop += animate && !rising ? Math.sin(clamp01(down / FALL_SECONDS) * Math.PI) * .22 : 0;
          if (!f.landed && animate && down > FALL_SECONDS * .85) {
            f.landed = true; hit(f, white, .5);
            effects.emit('dust', new pc.Vec3(position.x, groundHeight(position.x, position.z) + .08, position.z), 8, .45);
          }
        }
        // Vertitrón does not come apart: it kneels (`robotFrame`).
        if (!f.party && !f.robot && down >= 0) {
          if (!f.dissolve && (down >= DISINTEGRATE.shudder || !animate)) { f.dissolve = effects.disintegrate(f.model, { own: true }); cue('dissolve'); }
          if (animate) {
            const shudder = 1 - clamp01(down / DISINTEGRATE.shudder), up = smooth(f.dissolve?.progress ?? 0);
            roll += Math.sin(down * 60) * 6 * shudder;
            hop += DISINTEGRATE.lift * up; lean -= 8 * up;
          }
        }
        // Lying down, their arms rest along the floor.
        if (fall && f.party) f.arms.forEach((arm, i) => arm.setLocalEulerAngles(-20 * fall, 0, (i ? 1 : -1) * 25 * fall));
        else f.arms.forEach((arm, i) => arm.setLocalEulerAngles(celebrating ? -165 + Math.sin(time * 11 + i * Math.PI) * 12 : guarding ? -60 : -notice * 25 - strike * (i === 0 ? 85 : 35) - lifted * (i === 0 ? 150 : 12) - stride * (i === 0 ? 1 : -1), 0, guarding ? (i === 0 ? -20 : 20) : 0));
        f.legs.forEach((leg, i) => leg.setLocalEulerAngles(stride * (i % 2 ? -1 : 1), 0, 0));
        f.tail?.setLocalEulerAngles(38 + strike * 20, lively ? Math.sin(time * (attacking ? 16 : 7) + f.seed) * 22 : 0, 0);
        // Vertitrón is posed joint by joint (`robotFrame`).
        if (f.robot) { /* posed */ }
        else if (f.minion && f.head) f.head.setLocalEulerAngles(lively ? Math.sin(time * 2.2 + f.seed) * 6 - strike * 20 : 0, lively ? idle.look * 10 : 0, lively ? Math.sin(time * 1.7) * 5 : 0);
        else if (!f.party && f.head) animateDogHead(f.head, f.ears, f.eyes, f.seed, stepping, lively, strike);
        // A dish shows what it is on its plate; turned over (Darle la vuelta) it spins on its rim and
        // shows the other once it is half way; El Plato's surprise rattles under its cloche.
        if (f.dish && unit?.dish) {
          const d = f.dish, pending = effect?.actor === id && !impacted && (!!effect.flipped || effect.ability?.id === 'cambio-plato' || effect.ability?.id === 'puaj');
          const flip = d.flipAt === undefined || !animate ? 1 : clamp01((time - d.flipAt) / .55);
          const showing = (pending || flip < .5) && d.shown ? d.shown : unit.dish;
          if (showing !== d.shown && d.plate?.render) {
            d.shown = showing;
            const plate = d.plate.render.meshInstances[0].material as pc.StandardMaterial;
            plate.diffuse.fromString(DISH_TINT[showing]); plate.update();
          }
          const spin = flip < 1 ? smooth(flip) * 360 : 0;
          d.plate?.setLocalEulerAngles(spin, 0, 0);
          if (spin) d.cloche?.setLocalEulerAngles(spin, 0, 0);
          else if (showing === 'sorpresa' && lively) d.cloche?.setLocalEulerAngles(0, 0, Math.sin(time * 38) * 4 * (Math.sin(time * 2.3) > .2 ? 1 : 0));
        }
        else if (!f.robot) {
          f.head?.setLocalEulerAngles(lively ? -idle.breathe * 2 : 0, lively && id !== effect?.actor ? idle.look * 12 : 0, 0);
          // Out cold, their eyes stay shut.
          f.eyes.forEach(eye => { const s = eye.getLocalScale(); eye.setLocalScale(s.x, f.eyeScale * (fall > .5 ? .12 : lively ? idle.blink : 1), s.z); });
        }
        f.body?.setLocalPosition(0, 0, 0);
        // The camera supplies the battle zoom; keep fighters proportional to the street.
        const since = f.hitAt === undefined ? Infinity : time - f.hitAt;
        // Wood does not squash: the giant shudders instead, a short stiff tremor.
        const squash = animate && since < 1 && !f.rigid ? Math.exp(-since * 7) * Math.cos(since * 30) : 0;
        if (f.rigid && animate && since < .4) roll += Math.exp(-since * 12) * Math.sin(since * 70) * .8;
        const breathe = lively && down < 0 && !f.rigid ? idle.breathe * .018 + (f.minion ? Math.sin(time * 3.1 + f.seed) * .04 : 0) : 0;
        // Encogido (Rayo encogedor): smaller from when the ray lands, and back to size when it wears off.
        const shrunk = state && [...state.foes, ...state.allies].find(u => u.id === id)?.timed?.encogido && !(effect?.skill === 'rayo-encogedor' && effect.target === id && !impacted);
        f.shrink = animate ? f.shrink + ((shrunk ? SHRUNK : 1) - f.shrink) * (1 - Math.exp(-dt * 8)) : shrunk ? SHRUNK : 1;
        f.model.setLocalScale(f.scale.x * f.shrink * (1 + squash * .09), f.scale.y * f.shrink * (1 - squash * .16 + breathe), f.scale.z * f.shrink * (1 + squash * .09));
        if (stance === 'sway' && animate && down < 0) roll += Math.sin(time * 2.3 + f.seed) * (f.rigid ? 1.2 : 6);
        f.model.setLocalEulerAngles(lean, f.turn, roll);
        if (fall) f.model.setPosition(position.x, groundHeight(position.x, position.z) + hop + fall * .22, position.z);
        else { f.model.setPosition(position); f.plantFeet(groundHeight, hop); }
        if (stance === 'twitch' && animate && down < 0 && Math.random() < .4) f.model.translate((Math.random() - .5) * .05, Math.random() * .02, (Math.random() - .5) * .05);
        f.model.enabled = !f.dissolve?.finished;
        // Burning, they glow from within, warm and flickering with the fire on them.
        if (f.fire) {
          f.fire.at.set(position.x, groundHeight(position.x, position.z), position.z);
          if (f.dissolve) f.fire.handle.stop();
          if (!f.fire.handle.burning) f.fire = undefined;
        }
        shine(id, f, dt);
        // Transparente: on its last count a fantasmita goes half see-through, in scanlines that run down it.
        if (f.ghost && unit) {
          const g = f.ghost, pending = !!effect?.transparent?.includes(id) && !impacted;
          const want = unit.transparent && !pending && unit.hp > 0 ? 1 : 0;
          const clear = animate ? g.clear + (want - g.clear) * (1 - Math.exp(-dt * 6)) : want;
          if (Math.abs(clear - g.clear) > .004 || (clear !== g.clear && clear === want)) {
            for (const m of f.materials) { m.opacity = 1 - .55 * clear; m.blendType = clear > .01 ? pc.BLEND_NORMAL : pc.BLEND_NONE; m.depthWrite = clear <= .01; m.update(); }
            g.clear = Math.abs(clear - want) < .01 ? want : clear;
          }
          const scan = g.clear > .3 && animate, beat = Math.floor(time * 14);
          for (const p of g.pixels) p.node.enabled = !scan || (p.row + beat) % 4 !== 0;
          if (scan && Math.random() < .3) f.model.translate((Math.random() - .5) * .04 * g.clear, 0, 0);
        }
      }
      // Fight particles meet everyone still standing in it (src/fight-particles.ts).
      effects.setFighters(fighterOrder().map(id => fighters.get(id)!.model));
      // Statuses read on whoever carries them (src/status-fx.ts), in the fight particles' order: the
      // campaign's kept in step with the fight's stacks, and any put on with `status`.
      statusFx.setFighters(fighterOrder().map(id => [id, fighters.get(id)!] as const).map(([id, f], index) => { const p = f.model.getPosition(); return { id, model: f.model, index, party: f.party, feet: new pc.Vec3(p.x, groundHeight(p.x, p.z), p.z) }; }));
      // A fire Foc Binari is still carrying waits for the streams to land (the one, when they land apart): until then, the fire shown stays.
      const inFlight = casting && (!impacted || blows < claws) ? effect?.target : fireWaits;
      // A dual that sets fire claw by claw (Zarpazos de fuego): the fire rises with each one that lands.
      const dualBurn = dual && dualPlan && effect?.burns && blows < claws ? Math.max(dualPlan.burnBefore, ...effect.burns.slice(0, blows)) : undefined;
      // An element's reaction settled but not landed: whoever it turns still shows what they carried.
      const turning = effect?.reaction && !impacted ? new Set([effect.target, ...(effect.reaction.hits ?? []).map(h => h.target)]) : undefined;
      if (state) for (const unit of [...state.allies, ...state.foes]) {
        if (turning?.has(unit.id)) continue;
        const shown = shownStacks.get(`${unit.id}:quemado`) ?? 0;
        if (dualBurn !== undefined && unit.id === effect?.target && unit.timed?.quemado) { syncStatuses(unit.id, unit.statuses, { ...unit.timed, quemado: dualBurn ? { ...unit.timed.quemado, level: dualBurn } : undefined }); continue; }
        syncStatuses(unit.id, unit.statuses, unit.id === inFlight && unit.timed?.quemado?.level !== shown
          ? { ...unit.timed, quemado: shown ? { ...unit.timed!.quemado!, level: shown } : undefined } : unit.timed);
      }
      statusFx.update(dt, time);
      // Stats that stay up or down give off motes from the head (src/stat-motes.ts). What this
      // action changes waits for its blow to land, and the motes start as its chevrons pass.
      if (state) {
        const pending = effect && !impacted ? new Set([effect.target, ...(effect.stats ?? []).map(c => c.target), ...(effect.hits ?? []).map(h => h.target), ...(effect.splash ?? []).map(h => h.target)]) : undefined;
        for (const unit of [...state.allies, ...state.foes]) if (!pending?.has(unit.id)) motes.want(unit.id, [...new Set(statShifts(state, unit).map(shift => shift.way))]);
      }
      motes.update(dt, moteAnchor, animate);
      updateCats(dt, t, animate, target);
      updateBips(dt, t, animate, target);
      // Foc Binari: once the hand is up, the two streams leave it for the target's chest.
      if (casting && animate && actor && target && spelled !== effect) {
        spelled = effect;
        const floor = groundHeight(target.base.x, target.base.z);
        const chest = target.part ? v3(chestOf(target)) : { x: target.base.x, y: floor + (target.minion ? .9 : target.party ? 1.05 : .7) * target.scale.y, z: target.base.z };
        const hand = actor.arms[0]?.findByName('Mano') ?? actor.model;
        mathCast.start(hand, chest, { element: focBinari ? 'fuego' : effect!.element, cure: curing, ball: spelling, launch: castLaunch, zero: takeZero(actor.model, hand.getPosition()), size: state?.allies.some(a => a.id === effect!.actor && !grownUp(a.profile)) ? CHILD_CIRCLE : 1 });
      }
      if (focBinari && animate && actor && target && cast !== effect && t >= CAST_LAUNCH) {
        cast = effect;
        // They leave the middle of his circle.
        const hand = (mathCast.centre ?? (actor.arms[0]?.findByName('Mano') as pc.Entity | null ?? actor.model).getPosition()).clone();
        const floor = groundHeight(target.base.x, target.base.z);
        const chest = target.part ? v3(chestOf(target)) : { x: target.base.x, y: floor + (target.minion ? .9 : target.party ? 1.05 : .7) * target.scale.y, z: target.base.z };
        // No `model`: the burn on them is the Quemadura status's (syncStatuses), lit once the streams land.
        effects.binaryFire(hand, chest, { seconds: CAST_FLIGHT, gap: (effect!.strikes?.length ?? 1) > 1 ? CAST_GAP : 0, burn: !!effect!.burn, feet: floorUnder(target) });
      }
      // Zarpazo sangriento: the cat pounces, the wearer's fist leaves no arc.
      if (animate && effect && actor && !catStrike && !botStrike && !dual && !spelling) trailsFor(effect, actor, target, t, support);
      // The lurch springs back and shakes keep going through a hit-stop: they run on real time.
      shake = Math.max(0, shake - elapsed);
      sway.forEach(s => spring(s, elapsed, HIT.spring.omega, HIT.spring.zeta));
      spring(zoom, elapsed, HIT.punch.omega, 1);
      const quake = animate ? shake * shake * .3 : 0;
      if (animate) cameraKick.set(sway[0].x + wobble(real, 0) * quake, sway[1].x + wobble(real, 5) * quake * .6, sway[2].x);
      // The fight is won: confetti in the party's ánima colours rains over the field.
      if (state?.phase === 'won' && !effect && !celebrated && animate) {
        celebrated = true;
        const colours = new Set(['#f3cf78', '#fff4ec', ...state.allies.map(a => a.classId ? CLASSES[a.classId].colour : '#6f8fa8')]);
        effects.confetti(new pc.Vec3(anchor.x - 1, groundHeight(anchor.x, anchor.z) + 3.2, anchor.z), [...colours]);
      }
      if (motion && target) {
        const emphasis = animate ? Math.sin(clamp01(t / ACTION_SECONDS) * Math.PI) * .12 : 0;
        focus.set((target.base.x - anchor.x) * emphasis, 0, (target.base.z - anchor.z) * emphasis);
      }
      updateMarks(animate);
      // The camera and the spotlight of the big moments, eased on real time: a dual's low two-shot of
      // the two who attack (and the cats) with the rest of the picture gone grey, then on the foe,
      // half a turn round it while the claws land; a foe's ability keeps its own for a moment.
      lensHold = Math.max(0, lensHold - elapsed);
      const rest = () => Object.assign(lensWant, { yaw: 0, pitch: 0, zoom: 0, x: 0, y: 0, z: 0 });
      spotWant = 0;
      if (dual && roles && times && target && dualPlan && animate) {
        const pair = [fighters.get(roles.caster), fighters.get(roles.claws)].filter((f): f is Fighter => !!f);
        const mid = pair.length ? pair.reduce((sum, f) => sum.add(f.base), new pc.Vec3()).mulScalar(1 / pair.length) : target.base.clone();
        const first = times[0], last = times[times.length - 1], zf = dual.id === 'zarpazos-de-fuego';
        // Under a giant the camera looks higher up (game.ts `tallLift`): the two-shot comes back down to them.
        const lifted = Math.max(0, foeTop - 4) * .42;
        if (t < (zf ? first : DUAL.dash)) {
          const look = zf ? mid : mid.clone().lerp(mid, target.base, .45);
          Object.assign(lensWant, { yaw: 0, pitch: -9, zoom: zf ? .26 : target.rigid ? .04 : .22, x: (look.x - frame.x) * .75, y: zf ? -lifted * .75 : 0, z: (look.z - frame.z) * .75 });
          spotWant = 1;
        } else if (t <= last + dualPace(effect!).tail * .5) {
          const u = zf ? smooth(clamp01((t - first) / Math.max(.01, last - first))) : 1;
          Object.assign(lensWant, { yaw: zf ? -45 + 90 * u : 0, pitch: -4, zoom: .1, x: (target.base.x - frame.x) * .5, y: 0, z: (target.base.z - frame.z) * .5 });
        } else rest();
        if (spot && spotAmount > .002) {
          const pairCats = catsOf(roles.claws), points = pair.map(f => ({ ...v3(chestOf(f)), radius: 1.15 * f.scale.y }));
          if (pairCats) for (const cat of [pairCats.haru, pairCats.yuki]) if (cat.entity.enabled) points.push({ ...v3(cat.entity.getPosition()), radius: .7 });
          spot(spotAmount, points);
        }
      } else if (!lensHold) rest();
      const ease = animate ? 1 - Math.exp(-elapsed * 5) : 1;
      for (const key of ['yaw', 'pitch', 'zoom', 'x', 'y', 'z'] as const) lens[key] += (lensWant[key] - lens[key]) * ease;
      const was = spotAmount;
      spotAmount += (spotWant - spotAmount) * (animate ? 1 - Math.exp(-elapsed * (spotWant ? 10 : 4)) : 1);
      if (spotAmount < .002) spotAmount = 0;
      if (spot && was && !spotAmount) spot(0, []);
      focus.add(new pc.Vec3(lens.x, lens.y, lens.z));
      // Without motion (reduced motion, a hidden tab) every blow has landed by now: done at once, a dual or a cast too.
      if (complete && (effect ? !animate || t >= (dual ? dualEnd : casting ? castContact + CAST_GAP + .42 : support ? .85 : target ? ACTION_SECONDS : .65) : entryTime >= ENTRY_SECONDS)) {
        settle(); effect = undefined; impact = undefined;
      }
    },
    destroy() { settle(); arrows.destroy(); motes.clear(); battleRoot.destroy(); dogs.forEach(model => model.destroy()); materials.forEach(m => m.destroy()); },
  };
}
