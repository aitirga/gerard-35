import * as pc from 'playcanvas';
import { HeldArtilugio, PROP } from './artilugio-held';
import { BOMBA, bombPower, ecoMuffled, type EcoNews, COMBUSTION, cortinaRounds, bitsOf, type BitShield, DICED, diceOf, meteorOf, SKILLS, type SkillId, SOBREMESA_NAMES, STATUSES, TIMED, isCamping, isCuerdas, isModelo, isOnion, isSobremesa, markLeft, markSpent, onionSize, songNow, statShifts, vozNote, weakSpotRounds, type BattleEffect, type BattleState, type TimedPulse, type CampingKind, type ClassId, type CuerdasKind, type ModeloKind, type Combatant, type DishId, type FoeKind, type OnionKind, type StatusId, isLuca, SECOND_VOICE as SECOND_VOICE_ID, shirtLit, type DieFace, filmed, warded } from './battle';
import { CAMPING_HEIGHTS, CAMPING_SIZES } from './camping-foes';
import { CASTLE_SIZES, isCastle } from './castle';
import { MINION_HEIGHT, castleModel, encarnadoHalo, figureClips, fillGum, foeFigure, redden, type FigureClips } from './castle-models';
import { DIE, createDie, dressDie, faceUp } from './dice';
import { createDiceFx, type FaceSpot, DICE_COLOURS } from './dice-fx';
import { createStamps } from './dice-stamp';
import { CUERDAS_SIZES } from './cuerdas-foes';
import { MODELO_SIZES, PHOSPHOR } from './modelo-foes';
import { LUCA_SIZES, styleChaplain, lightShirt } from './luca-foes';
import { CLASSES, grownUp, inheritColour, wearClass } from './classes';
import { ATRACTOR, atractorGiven, atractorLeave, ACTION_SECONDS, CAST_CONTACT, CAST_FLIGHT, CAST_GAP, CAST_LAUNCH, FOURIER_GAP, figureEnd, CONTACT_SECONDS, SPELL_CONTACT, SPELL_LAUNCH, DUAL_EASE, DUAL_FREEZE, ENTRY_SECONDS, clamp01, contactMotion, smooth, surge } from './battle-motion';
import { WalkAnimation, idlePose, poseLegs, type LimbRig } from './walk-animation';
import { MATERIAL_ROLES, RIG } from './character-model';
import { faceOf } from './face';
import { createGroundContact, type GroundHeight } from './ground-contact';
import { DOG_PROFILES } from './encounters';
import { CLAW_COLOURS, tint, type Effects, type FireLevel } from './effects';
import type { ParticleBody } from './particles';
import { CRIT, FightClock, HIT, landing, spring, wobble, type Blow } from './hit-feel';
import { createCat, type Cat, type CatAction } from './cats';
import { BIP, createBip, type Bip } from './bip';
import { BOMB, createBomb, type Bomb } from './bomb';
import { createOnionPeels, skinOf, tintSkin } from './onion-peels';
import type { StatWay } from './stat-fx';
import { createStatArrows } from './stat-arrows';
import { createStatMotes } from './stat-motes';
import { partialSound, type SoundId } from './sfx';
import { GOLD, harmonicColour } from './fourier';
import type { Fears, RobotPose } from './fears';
import { axes, catSpots, fightCamera, foeSize, formation, standing, type Layout } from './arena';
import { bindSobremesa, type Acts, type Friend, type Move } from './sobremesa';

/** How a fight is laid out round its centre (src/arena.ts), whether it was moved to a pocket (src/pocket.ts), and how far apart its sides stand (1 as always). */
export interface FightStage { layout: Layout; pocket?: boolean; spread?: number }
import { createStatusFx, type ReactionId, type StatusLookId } from './status-fx';
import { createPowderFx, powderMix, FIESTA, TRACA_GAP, type PowderMix } from './powder-fx';
import { createSwarmFx, SWARM } from './swarm-fx';
import { createEcoFx, type EcoFx } from './eco-fx';
import { createFreaticaFight, FREATICA_SKILLS, HAMMER_GAP } from './freatica-fight';
import { DISINTEGRATE, dissolvable, type Disintegration } from './disintegrate';
import { CUERDAS_COLOURS, DUAL_COLOURS, FEAR_COLOURS, createDualFx, screenAxes, type V3 } from './dual-fx';
import { TONES, type ToneId } from './song';
import { takeZero } from './anima-looks';
import { DUO_STAGINGS, type DuoFighter, type DuoStage } from './duo-fx';
import { ARC_POUNCE, arcFor, arcGeometry, arcRun, type ArcPose } from './duo-fx/arco-voltaico';
import { createFluidFx } from './fluid-fx';
import { CURE_COLOUR, createMathCast, spellColour } from './math-cast';
import { FIGURES, createMathFigures, isFigure, type FigureFoe, type FigureSkill } from './math-figures';
import { createFilmFx } from './film-fx';
import { createLivesFx } from './lives-fx';
import { spellLaunch } from './battle-sounds';
import { cometPath } from './trails';

/** How fast a cat already with the party runs to its place in a fight, and from how far it lands there instead (a jump). */
const CAT_RUN = 7, CAT_LANDS = 14;
/** How long after the first the next of a flurry's little claws lands (Zarpazos). */
const CLAW_SECONDS = .12;
/** Papagato's claws one after another (Cacería, Siete vidas): seconds between two, quicker with many, never over 2.6 s in all. */
const huntGap = (claws: number) => Math.min(.2, 2.6 / Math.max(1, claws));
/** Siete vidas: how long Yuki takes from one of the party to the next as she walks among them. */
const WARD_STEP = .42;
/**
 * Acecho, in fight seconds (docs/animas/papagato/README.md § Acecho). Charging: Haru crouches, the dark
 * pools under her at `pool` and she sinks into it from `sink` till `gone`; she stays gone until the round
 * starts. Her pounce: the dark wells up behind the prey at 0, two red eyes light in it at `eyes`, she rises
 * out of it from `rise` to `risen`, turns her face to the camera, red eyes burning, by `stare`, holds that
 * look, turns back and springs at `spring`, lands on its back at `contact`, melts into
 * the dark at `melt` (gone by `away`), comes back out of it at her place by `home`, and it is over at `end`.
 */
const ACECHO = { pool: .2, sink: .3, gone: .66, eyes: .22, rise: .32, risen: .62, stare: .74, spring: 1.08, contact: 1.22, melt: 1.52, away: 1.74, home: 2.1, end: 2.35 } as const;
/**
 * Dadista's throw, in fight seconds (docs/animas/dadaista/): the die leaves the hand at `launch`,
 * lands on whom its face reaches at `contact`, and bounces off to the floor over `tail`.
 */
const DICE = { launch: .22, contact: .46, tail: .85 } as const;
/**
 * Dadista's skills that come from the sky (docs/animas/dadaista/ § Look and interface): the die that
 * pays for them goes up out of the frame instead of at anyone. `contact`: when what comes down lands
 * (the rain's first die); `fall`: how long before that it starts to fall; `tail`: what is left after.
 */
const SKY: Partial<Record<SkillId, { contact: number; tail: number; fall: number }>> = {
  'dados-astrales': { contact: 1.15, tail: .9, fall: .72 }, 'ases-en-duo': { contact: .9, tail: 1, fall: .6 },
  meteorito: { contact: 1, tail: .9, fall: .62 }, meteoro: { contact: 1.1, tail: 1, fall: .7 }, asteroide: { contact: 1.4, tail: 1.4, fall: .85 },
};
/** Seconds between two dice of the rain: quicker with many, never over two seconds in all. */
const rainGap = (drops: number) => Math.min(.22, 2 / Math.max(1, drops));
/** How long after a blow its fighter's stats show going up or down. */
const STAT_AFTER_BLOW = .2;
/** Skills that stay where the wearer stands and reach their own side: no run-up, the hand goes up. */
const SUPPORT = new Set(['analisis', 'cardioide', 'ronroneo', 'integral', 'condensador', 'superficie-minima', 'cortina', 'telon', 'rociada', 'polvareda', 'traca', 'fin-de-fiesta', 'ostinato', 'bordon', 'crescendo', 'acompanamiento', 'tutti', 'da-capo', ...Object.keys(FREATICA_SKILLS)]);
/**
 * Colorista's skills thrown from where the wearer stands (src/powder-fx.ts): when each lands, and how
 * long the action is given to play. Fin de fiesta's handfuls are in the air before its contact (`powderStart`).
 */
const POWDER_SKILLS: Record<string, { contact: number; end: number }> = {
  cortina: { contact: .2, end: 1 }, telon: { contact: .2, end: 1.2 }, rociada: { contact: .5, end: 1.3 }, polvareda: { contact: .2, end: 1.4 },
  traca: { contact: .25, end: 1.4 }, 'fin-de-fiesta': { contact: FIESTA.contact, end: FIESTA.contact + FIESTA.end },
};
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
/**
 * The duals of other ánimas (docs/graphics.md § Ataques duales), in fight seconds from their start:
 * when their blow lands (`contact`: the number, the cure, the fuse lit) and when they are over.
 * Relevo de sangre lands with Haru's pounce.
 */
const DUO = {
  'sutura-de-luz': { contact: .95, end: 1.85 },
  'relevo-de-sangre': { contact: CONTACT_SECONDS, end: 1.35, relayed: 1.85 },
  'bombardeo-orbital': { contact: .7, end: 1.65 },
  'reserva-de-color': { contact: 1.15, end: 1.85 },
  vulcano: { contact: 1.05, end: 2.1 },
  // Sobrecalentamiento: it overheats from `heat`, bursts at `burst`; its first bits land with the
  // number and the rest of the dome `stream` seconds behind them.
  sobrecalentamiento: { heat: .5, burst: .95, contact: 1.3, stream: .5, end: 2.3 },
  // The newer duals keep their timing in their own looks (src/duo-fx).
} as const;
/** The blasts they leave: Bombardeo orbital's three salvos (the number with the last), the paint going up. */
const BLAST = {
  'bombardeo-orbital': { salvos: [.18, .42, .68], contact: .78, end: 1.6 },
  'reserva-de-color': { contact: .32, end: 1.5 },
} as const;
const duoOf = (e?: BattleEffect) => !e?.dual ? undefined : DUO_STAGINGS[e.dual.id]?.timing ?? (e.dual.id in DUO ? DUO[e.dual.id as keyof typeof DUO] : undefined);
const duoEnd = (e: BattleEffect) => e.dual?.id === 'relevo-de-sangre' && e.relay ? DUO['relevo-de-sangre'].relayed : duoOf(e)?.end ?? (e.detonation ? BLAST[e.detonation].end : 0);
/** Duals already seen this session (as the fight screen's banner counts them). */
const seenDuals = new Set<string>();
/** How much denser the newer duals' bursts are drawn than written (`denseFx`). */
const DUO_DENSITY = 1.8;
/** How the dish under a platito or El Plato's cloche looks (`Plato`), by what it is. */
const DISH_TINT: Record<DishId, string> = { alcachofa: '#a9cf72', coliflor: '#f4ecd6', sorpresa: '#9c9a92' };

/**
 * The street dogs of chapter 1, each in its coat and collar (DOG_PROFILES), hidden: the fight clones
 * them, and the bestiary (src/bestiary.ts) shows them. Boxes on `root`; `mat` makes a material (the
 * caller keeps it), and `eyeDark` is the eyes' own, so the minion can turn them pink.
 */
export function buildStreetDogs(root: pc.Entity, mat: (hex: string) => pc.StandardMaterial, eyeDark: pc.StandardMaterial) {
  const fur = mat('#c49464'), cream = mat('#f1dfb8'), dark = mat('#3c302a'), collar = mat('#a64d43');
  function part(parent: pc.Entity, name: string, type: pc.RenderComponent['type'], material: pc.StandardMaterial, p: number[], s: number[]) {
    const e = new pc.Entity(name); e.addComponent('render', { type, material, castShadows: true });
    e.setLocalPosition(p[0], p[1], p[2]); e.setLocalScale(s[0], s[1], s[2]); parent.addChild(e); return e;
  }
  const dog = new pc.Entity('Perro callejero'); root.addChild(dog);
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
  return [dog, dog.clone(), dog.clone(), dog.clone()].map((model, i) => {
    const profile = DOG_PROFILES[i];
    if (i > 0) root.addChild(model);
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
}

/**
 * How big a foe drawn from the palace minion or a fear's template stands: its model's scale in a
 * fight (`fear`: it has a template of its own, src/fears.ts). The bestiary (src/bestiary.ts) shows
 * each foe at this size too.
 */
export function foeScale(kind: FoeKind | undefined, layers: number, fear: boolean) {
  // Uri's fears fight in the tower's narrow corridors, so they stay nearer the party's size.
  const young = kind === 'cebollita' || kind === 'platito' || kind === 'fantasmita';
  return isCastle(kind) ? CASTLE_SIZES[kind] : isOnion(kind) ? onionSize(kind, layers) : isCamping(kind) ? CAMPING_SIZES[kind] : isCuerdas(kind) ? CUERDAS_SIZES[kind]
    : isModelo(kind) ? MODELO_SIZES[kind] : isLuca(kind) ? LUCA_SIZES[kind] : kind === 'guardian' ? 2.3 : young ? .62 : kind === 'vertigo' ? 1 : fear ? 1.05 : 1.5;
}
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
  // Eyes have their own materials so La Reina Bubbaloo's minion can turn them dark pink and glowing.
  const eyeDark = mat('#3c302a'), eyePink = mat('#7a1240');
  // Someone the Queen holds looks out of violet eyes (docs/lore.md), as in the street.
  const possessedEyes = mat('#5a2a8a'); possessedEyes.emissive.fromString('#b07aff'); possessedEyes.emissiveIntensity = 1.4; possessedEyes.update();
  eyePink.emissive.fromString('#ff2d86'); eyePink.emissiveIntensity = 1.6; eyePink.gloss = .8; eyePink.update();
  function part(parent: pc.Entity, name: string, type: pc.RenderComponent['type'], material: pc.StandardMaterial, p: number[], s: number[]) {
    const e = new pc.Entity(name); e.addComponent('render', { type, material, castShadows: true });
    e.setLocalPosition(p[0], p[1], p[2]); e.setLocalScale(s[0], s[1], s[2]); parent.addChild(e); return e;
  }
  const dogs = buildStreetDogs(app.root, mat, eyeDark);
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
    downAt?: number; upAt?: number; landed?: boolean; dissolve?: Disintegration;
    /** Called in mid-fight and not there yet (La Voz's second voice), and its coming together out of specks, or back (an Eco tied again). */
    /** An Encarnado's halo on the floor (src/castle-models.ts `encarnar`): it breathes, and goes out as they fall. */
    halo?: { floor: pc.Entity; material: pc.StandardMaterial };
    unborn?: boolean; arriving?: Disintegration; freed?: { node: pc.Entity; from: pc.Vec3; to: pc.Vec3; at: number }; hitAt?: number; flashColor: pc.Color; flash: number; materials: pc.StandardMaterial[]; glow: pc.Color[];
    body: pc.Entity | null; head: pc.Entity | null; tail: pc.Entity | null; ears: pc.Entity[]; eyes: pc.Entity[]; eyeScale: number; seed: number;
    /** A winged figure's wings (`just character-3d` with `wings`: `Ala izquierda`, `Ala derecha`), hinged at the body: they beat. */
    wings?: pc.Entity[];
    /** Knees, elbows and ankles, on a sculpted fighter. */
    limbRig?: LimbRig;
    /** Foes that are not dogs (the palace minion) wobble instead of sniffing. */
    minion: boolean;
    /** A castle pupil drawn from its own file (src/castle-models.ts): its clips, running when it moves. */
    figure?: FigureClips;
    /** How high over its feet its plate hangs, when that is not the usual 1.45 m: a figure of its own, over its head. */
    plateAt?: number;
    /**
     * A giant of tiles and ladders (Vertitrón): it does not wobble, stretch or squash like the gum
     * creatures. It leans in heavy and slow from where it stands, and a blow only makes it shudder.
     */
    rigid: boolean;
    /** Gerard at 35 or Aitor: a grown-up's Matemágico thinks out loud (thoughts.ts). */
    grown: boolean;
    /** Gerard's copy carries the artilugio (src/artilugio-held.ts): held out in the Queen's last fight. */
    held?: HeldArtilugio;
    /** The Queen holds them (Aitor at her tenth): a violet bead glows over each eye while she does. */
    possessed?: pc.Entity[];
    /**
     * Held by the Queen, they cross to her side (`crossOver`): their place in the party (`home`), the
     * one in front of her (`away`), how far across they are (0 home, 1 there) and which way they go.
     */
    cross?: { home: pc.Vec3; away: pc.Vec3; t: number; hers: boolean };
    /** The Queen beaten: how far she has sagged, bowed and spent (0–1, `LAST`). */
    low?: number;
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
    /** A friend in La Sobremesa: a part of its body whose place is their bone (`model`); the body flashes for them. */
    bone?: boolean;
    /**
     * A Càmping Eurocamping foe (src/camping-foes.ts): its model shows its rule each frame. They are canvas,
     * bone, card and plaster: no gum splashes off them, no pink trails, and only the mago breathes.
     */
    camp?: CampingKind;
    /** One of Las cuerdas' (src/cuerdas-foes.ts): string, glass and light, showing its rule each frame. No gum on it either. */
    strings?: CuerdasKind;
    /** A foe of Emilie's model (src/modelo-foes.ts): lines of light, showing its rule each frame. No gum, no breath, and it never leaves its place. */
    mesh?: ModeloKind;
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
  /**
   * La Sobremesa (docs/quests/universidad.md § Final boss): the model to clone (`setSobremesa`), and
   * while it fights its one body, which belongs to no fighter: its seven friends are parts on its
   * bones. It moves by its rig (src/sobremesa.ts): each friend's blow and each one freed.
   */
  let sobremesaTemplate: pc.Entity | undefined;
  let mass: (Fighter & { rig: ReturnType<typeof bindSobremesa>; freedAt: Map<string, number> }) | undefined;
  /** How big La Sobremesa stands (its model is about two units wide). */
  const SOBREMESA_SCALE = 2.6;
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
  /**
   * Bombas remotas on the foes (src/bomb.ts): each foe's bomb, the seconds to its next flash, how far it has grown in (below 0:
   * still on its way, Bip's throw from an Escolta or Enjambre's swarm), and `fuse`: set off by Explosión, it waits for the blast.
   */
  const bombs = new Map<string, { bomb: Bomb; next: number; shown: number; fuse?: boolean; implode?: { t: number; dur: number; at: pc.Vec3; big: number } }>();
  /** The bombs' black holes after they burst: each fades as its shock runs out (`updateBombs` sends them to `setLens`). */
  const holes: { at: pc.Vec3; t: number; radius: number }[] = [];
  /** Escolta: the ring Bip keeps under whoever it stands by, its tether's beat, and how far it has faded in. */
  const escorts = new Map<string, { ring: pc.Entity; inner: pc.Entity; mat: pc.StandardMaterial; beat: number; shown: number }>();
  /** Where Bip set off from when it went to stand by someone (Escolta), to fly there in an arc. */
  const escortFrom = new WeakMap<BattleEffect, pc.Vec3>();
  const peels = createOnionPeels(battleRoot, groundHeight);
  let cue: (id: SoundId, options?: { delay?: number; volume?: number; pan?: number }) => void = () => {};
  /** How many of this action's little claws have landed. */
  let clawed = 0;
  /** Dadista's sky skills: what of the action in play has started to fall and has landed. */
  let sky: { effect: BattleEffect; fell: number; landed: number } | undefined;
  /** The rock of light that stays over whoever has a meteor grown, by fighter. */
  const rocks = new Map<string, { kept: ReturnType<typeof stamps.keepCrystal>; size: number; turn: number }>();
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
  /** Dadista's dice beside whoever wears it: the hand in view, and the one in the air. */
  interface HandDie { entity: pc.Entity; face: DieFace; at: pc.Vec3; turn: pc.Quat; size: number; age: number; tumble: pc.Vec3; /** Its own idle sway: where in it this die starts, and how fast it goes (× the common pace). */ sway: number; pace: number }
  const dice = new Map<string, { hand: HandDie[]; shown: number; thrown?: { die: HandDie; action: BattleEffect; from: pc.Vec3; shed?: number; last?: pc.Vec3 }; seen?: BattleEffect }>();
  /** The die the fight screen's cursor is on while one is being picked: it comes forward. */
  let aimedDie: { unit: string; index: number } | undefined;
  let state: BattleState | undefined;
  let effect: BattleEffect | undefined;
  let effectTime = 0;
  let entryTime = ENTRY_SECONDS;
  let time = 0;
  let impact: ((blow: number) => void) | undefined;
  let complete: (() => void) | undefined;
  let impacted = false;
  /** The action the fight screen is about to play, until it does (`upcoming`). */
  let upcoming: BattleEffect | undefined;
  // Hit feel (hit-feel.ts): the fight's clock holds on contact; the camera lurch, the punch-in and the post pulse run on real time.
  const clock = new FightClock();
  const sway = [0, 1, 2].map(() => ({ x: 0, v: 0 })), zoom = { x: 0, v: 0 };
  let real = 0, animating = true;
  let pulse: ((fringe: number, bloom: number, flash?: number) => void) | undefined;
  let setNight: ((amount: number, lift?: number) => void) | undefined, night = 0, nightLift = 0, shownNight = 0;
  /** Bajo cero's cold grade (post.setDark: blue and grey), 0–1. */
  let setCold: ((amount: number) => void) | undefined, cold = 0;
  /** When Bajo cero's ice next ticks while a foe stands frozen (s). */
  let iceTickIn = 0;
  /** What duals and the tower's fears draw (src/dual-fx.ts), on the fight's clock. */
  const dualFx = createDualFx(effects);
  /** Fire, lava, smoke and water as fluids (src/fluid-fx.ts), on the fight's clock. */
  const fluidFx = createFluidFx(effects, dualFx.after);
  /** What Dadista's faces draw where their die lands (src/dice-fx.ts). */
  /** The faces slapped on whoever a die hits, and the astral's stars of light (src/dice-stamp.ts). */
  const stamps = createStamps(app, battleRoot);
  const diceFx = createDiceFx(effects, dualFx, stamps);
  const mathCast = createMathCast(app, battleRoot, effects);
  // What his skills past Foc Binari draw in the middle of that circle (src/math-figures.ts).
  const figures = createMathFigures(app, battleRoot, effects);
  /** Serie de Fourier's figure for each cast of it, for its strikes to land on (`fourierStrike`). */
  const fourierFigures = new WeakMap<BattleEffect, ReturnType<typeof figures.fourier>>();
  // Superficie mínima's soap film: drawn there, then held round an ally until the round ends (src/film-fx.ts).
  const filmFx = createFilmFx({ effects, figures, cue: (id, options) => cue(id, options) });
  /** Siete vidas' own look: Yuki's silhouettes at the party's feet, and the killing blow played back (src/lives-fx.ts). */
  const livesFx = createLivesFx(effects);
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
  /** Where the bombs' black holes go (post.ts `lens`): world points, metres of reach, strength 0–1. */
  let setLens: ((points: readonly { x: number; y: number; z: number; radius: number; strength: number }[]) => void) | undefined;
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
  /** Rayo solar's beam: Bip's sun, a white-hot core in a gold glow and an orange haze round it. */
  const sunCore = mat('#000000'), sunGlow = mat('#000000'), sunHaze = mat('#000000');
  for (const [m, colour, k] of [[sunCore, '#fffbe8', 3.6], [sunGlow, '#ffc23a', 2], [sunHaze, '#ff7a1a', .9]] as const) {
    m.emissive.fromString(colour); m.emissiveIntensity = k; m.useLighting = false; m.blendType = pc.BLEND_ADDITIVE; m.depthWrite = false; m.update();
  }
  const sunBeam = new pc.Entity('Rayo solar'); battleRoot.addChild(sunBeam); sunBeam.enabled = false;
  for (const [m, w] of [[sunCore, .14], [sunGlow, .34], [sunHaze, .7]] as const) {
    const e = new pc.Entity('Haz'); e.addComponent('render', { type: 'cylinder', material: m, castShadows: false, receiveShadows: false });
    e.setLocalEulerAngles(-90, 0, 0); e.setLocalScale(w, 1, w); sunBeam.addChild(e);
  }
  /** Where Rayo solar's beam is aimed as it sweeps, and the floor under it (a trail of fire follows it). */
  const sunAim = new pc.Vec3(), sunFloor = new pc.Vec3();
  /** Where the beam burns the roof as it sweeps (a trail follows it). */
  const beamFloor = new pc.Vec3();
  let beamOf: BattleEffect | undefined;
  /** A blow lands: the picture lurches along (x, y, z), heavy ones punch in and fringe; returns the landing for the hit-stop. */
  function land(blow: Blow, x: number, y: number, z: number) {
    const l = landing(blow);
    [x, y, z].forEach((d, i) => { sway[i].x = -d * l.kick; sway[i].v = 0; });
    zoom.x = Math.max(zoom.x, l.punch);
    pulse?.(l.fringe, l.bloom, blow.crit ? blow.crit === 'full' ? CRIT.flash : CRIT.flashLater : 0);
    return l;
  }
  /**
   * The golpe crítico (docs/animas/README.md § Golpe crítico). `critOf`: the action whose full one has
   * played, so a flurry's later ones are short. `critGrey`: how much of the picture's colour it has
   * drained (1 on the blow, held `critHeld` real seconds, the full hold, then back over CRIT.greyFade), all but
   * round `critKeep`: whoever it struck and whoever struck.
   */
  let critOf: BattleEffect | undefined, critGrey = 0, critHeld = 0, critKeep: Fighter[] = [];
  /**
   * A golpe crítico lands on `struck`: time stops on it. The first of an action holds the fight
   * CRIT.stop, punches the frame in, flashes it white and drains its colour round the two of them,
   * with a cut of white light across the one struck; a later one of the same flurry only its cut and
   * a short hold. Returns which it was, for the blow's own landing (hit-feel.ts `landing`).
   */
  function critBeat(action: BattleEffect, struck: Fighter[], actor: Fighter | undefined, dir: { x: number; z: number }): 'full' | 'later' {
    const kind = critOf === action ? 'later' : 'full', full = kind === 'full';
    critOf = action;
    for (const f of struck) {
      const body = extent(f), at = f.part ? chestOf(f) : new pc.Vec3(f.base.x, groundHeight(f.base.x, f.base.z) + body.height * .55, f.base.z);
      hit(f, white, (full ? 2.6 : 1.5) * (f.rigid ? .4 : 1));
      dualFx.critical(v3(at), viewDir(), { x: dir.x, y: 0, z: dir.z }, Math.min(2.6, Math.max(1.1, body.height * .8)), full);
    }
    pulse?.(full ? 1 : .5, full ? 1 : .5, full ? CRIT.flash : CRIT.flashLater);
    clock.hold = Math.max(clock.hold, full ? CRIT.stop : CRIT.later);
    zoom.x = Math.max(zoom.x, full ? CRIT.punch : CRIT.punch * .4);
    if (full) { critGrey = 1; critHeld = CRIT.stop; critKeep = [...struck, ...actor ? [actor] : []]; }
    return kind;
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
  /** How far the camera leans in on whoever's turn it is (0–1), and where they stand. */
  let turnPush = 0;
  const turnAt = new pc.Vec3();
  /**
   * The ring under whoever each player is aiming at: Gerard's gold, Aitor's cyan (their map colours).
   * Aitor's is wider and sits lower, so on the same foe it shows as a cyan rim round the gold.
   */
  const markers = ([[1, '#f3cf78', 1.1, .025], [2, '#4fd6ea', 1.42, .012]] as const).map(([player, colour, size, lift]) => {
    const material = mat(colour);
    material.emissive.fromString(colour); material.emissiveIntensity = .3; material.update();
    const entity = part(battleRoot, `Objetivo ${player}`, 'cylinder', material, [0, .03, 0], [size, .025, size]);
    entity.enabled = false;
    return { player, entity, lift };
  });
  const aimedBy: Partial<Record<1 | 2, string>> = {};
  /** Who is aiming for each player: that fighter turns towards their own player's aim, never the partner's. */
  const aimer: Partial<Record<1 | 2, string>> = {};
  /** Confetti falls once per won fight. */
  let celebrated = false;
  const face = (from: pc.Vec3, to: pc.Vec3) => Math.atan2(to.x - from.x, to.z - from.z) * 180 / Math.PI;
  const ELEMENT_FLASH = { agua: new pc.Color(.45, .8, 1), fuego: new pc.Color(1, .55, .18), electrico: new pc.Color(1, .92, .4) };
  const astral = new pc.Color(.75, .88, 1);
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
    if (f.halo) {
      f.halo.floor.enabled = f.downAt === undefined && !f.unborn;
      f.halo.material.emissiveIntensity = .55 + .12 * Math.sin(time * 2.1 + f.seed * 1.7); f.halo.material.update();
    }
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
  // Colorista's powder (src/powder-fx.ts): the handful, the powder that stays on whoever is Empolvado, and what an element makes of it.
  const powderFx = createPowderFx(app, effects, { model: id => fighters.get(id)?.model });
  // Enjambre's network on the floor (src/swarm-fx.ts), and the foes whose bombs it beats with until they have gone off.
  const swarmFx = createSwarmFx(app, effects);
  let swarmHeld = new Set<string>();
  /** The moments of Enjambre's look already played for an action (`SWARM`). */
  const swarmPlayed = new WeakMap<BattleEffect, Set<string>>();
  let powderTurn = 0;
  const nextMix = () => powderMix(powderTurn++);
  /**
   * Sincopante's ecos (src/eco-fx.ts), driven by the fight's rules (src/battle.ts `runEcos`): made the
   * first time an eco is called (the GPU engine must be on), and told what each eco does, when.
   */
  let ecoFx: EcoFx | undefined, ecoPost: Parameters<typeof createEcoFx>[2];
  const ecos = () => ecoFx ??= effects.gpu ? createEcoFx(app, effects, ecoPost, {
    fighters: () => [...fighters].map(([id, f]) => ({ id, party: f.party })),
    at: id => { const p = fighters.get(id)?.model.getPosition(); return p && { x: p.x, y: p.y, z: p.z }; },
    model: id => fighters.get(id)?.model,
    driven: true,
  }) : undefined;
  /** Muffled while whoever called them is in another ánima (all of them: one voice sounding whole is enough to light them). */
  const ecosMuffled = () => !!state?.ecos?.length && state.ecos.every(e => ecoMuffled(state!, e));
  /**
   * Sincopante's skills land: the eco called rises from what it did (a fourth puts the oldest out),
   * Crescendo swells them, Tutti brings them together over the foes and down on them, Da capo runs
   * everything back to the start.
   */
  function sincopanteBurst(action: BattleEffect, target?: Fighter) {
    const fx = ecos();
    fx?.setMuffled(false);
    if (action.ecoReplaced !== undefined) fx?.out(action.ecoReplaced);
    if (action.ecoCalled) {
      const e = action.ecoCalled;
      fx?.call(e.kind, e.owner, e.target, e.id);
      if (target) hit(target, e.kind === 'ostinato' ? white : green, e.kind === 'ostinato' ? .8 : .6);
      pulse?.(.05, .3);
    }
    for (const r of action.ecosRaised ?? []) fx?.raise(r.eco, r.grade as 0 | 1 | 2);
    if (action.tutti) {
      fx?.tutti();
      // The plate comes down on the foes 1.27 s in (eco-fx `tutti`): that is the blow.
      dualFx.after(1.27, () => {
        for (const h of action.hits ?? []) { const f = fighters.get(h.target); if (f) hit(f, white, 1.4); }
        zoom.x = Math.max(zoom.x, HIT.punch.size * 1.3); shake = Math.max(shake, .45);
      });
    }
    if (action.dacapo) { fx?.dacapo(); pulse?.(.2, .6, .15); }
    fx?.setMuffled(ecosMuffled());
  }
  // Freática's water (src/freatica-fight.ts): a cell under each foe, the look of the effects lab driven by the fight's state.
  const freatica = createFreaticaFight(app, effects, {
    fighters: () => [...fighters].filter(([, f]) => !f.part && f.model.enabled && (f.party || f.hp > 0)).map(([id, f]) => ({ id, party: f.party })),
    at: id => { const p = fighters.get(id)?.model.getPosition(); return p && { x: p.x, y: p.y, z: p.z }; },
    model: id => fighters.get(id)?.model,
    settled: () => entryTime >= ENTRY_SECONDS,
    ground: groundHeight,
  });
  /** The middle of the foes standing: the side a cortina faces. */
  const foesCentre = () => {
    const at = { x: 0, y: 0, z: 0 }, list = (state?.foes ?? []).flatMap(f => { const fighter = f.hp > 0 ? fighters.get(f.id) : undefined; return fighter ? [fighter] : []; });
    for (const f of list) { at.x += f.base.x / list.length; at.z += f.base.z / list.length; }
    return at;
  };
  /** Actions of Colorista's whose powder is in the air before they land, already started; and Traca's puffs gone off so far. */
  const powderPlayed = new WeakSet<BattleEffect>();
  let volleyed: { effect: BattleEffect; landed: number } | undefined;
  /** Cacería's and Siete vidas' claws landed so far, and the party Siete vidas' ward has reached so far. */
  let hunted: { effect: BattleEffect; landed: number } | undefined, wardSeen: { effect: BattleEffect; shown: number } | undefined;
  /** Golpe de ariete's blows landed so far. */
  let hammered: { effect: BattleEffect; landed: number } | undefined;
  /** The campaign's statuses as last shown, by fighter and status, so a change of stacks updates them. */
  const shownStacks = new Map<string, number>();
  /**
   * The campaign's statuses (src/battle.ts `STATUSES`) are counted in rounds: shown while they have
   * stacks, at a level by how many (a third of their most each), their ring holding what is left.
   * Timed ones (`TIMED`: Quemado) show at their own level, their time kept in step with the fight's clock.
   */
  function syncStatuses(id: string, statuses: Partial<Record<StatusId, number>> | undefined, timed: Combatant['timed'], capacitor = false) {
    // ∂Q/∂t Condensador: the charge carried shows on them until it goes.
    if ((shownStacks.get(`${id}:cargado`) ?? 0) !== (capacitor ? 1 : 0)) {
      shownStacks.set(`${id}:cargado`, capacitor ? 1 : 0);
      if (capacitor) statusFx.apply(id, 'cargado', { level: 1, seconds: 30, left: 30, held: true });
      else statusFx.remove(id, 'cargado');
    } else if (capacitor) statusFx.hold(id, 'cargado', 30);
    powderFx.track(id, timed?.empolvado?.left, nextMix);
    powderFx.trackShards(id, timed?.cristalizado);
    for (const look of ['sangrado', 'mareo', 'llorera'] as const) {
      const n = statuses?.[look] ?? 0, key = `${id}:${look}`;
      if ((shownStacks.get(key) ?? 0) === n) continue;
      shownStacks.set(key, n);
      const most = STATUSES[look].max;
      if (n <= 0) statusFx.remove(id, look);
      else statusFx.apply(id, look, { level: Math.ceil(n / most * 3), seconds: most, left: n, held: true });
    }
    for (const look of ['quemado', 'cegado', 'sanacion', 'confusion', 'encogido', 'mojado', 'envenenado', 'virus'] as const) {
      // Water held under a foe (Freática) is its Mojado: the cell shows it, not drips on the body.
      const on = look === 'mojado' && timed?.agua ? undefined : timed?.[look], level = on?.level ?? 0, key = `${id}:${look}`;
      if ((shownStacks.get(key) ?? 0) !== level) {
        shownStacks.set(key, level);
        if (!on) statusFx.remove(id, look);
        else statusFx.apply(id, look, { level, seconds: TIMED[look].seconds, left: on.left, held: true });
      } else if (on) statusFx.hold(id, look, on.left);
    }
    // Fire at IV is Combustión: over the white fire, its own look (status-fx `combustion`).
    const hot = (timed?.quemado?.level ?? 0) >= COMBUSTION.level, hotKey = `${id}:combustion`;
    if ((shownStacks.get(hotKey) ?? 0) !== (hot ? 1 : 0)) {
      shownStacks.set(hotKey, hot ? 1 : 0);
      if (hot) statusFx.apply(id, 'combustion', { level: 3, seconds: TIMED.quemado.seconds, left: timed!.quemado!.left, held: true });
      else statusFx.remove(id, 'combustion');
    } else if (hot) statusFx.hold(id, 'combustion', timed!.quemado!.left);
  }
  // Each fighter owns its material copies, so a flash never lights up the whole pack.
  function ownMaterials(model: pc.Entity, party = false) {
    const copies = new Map<pc.Material, pc.StandardMaterial>();
    model.findComponents('render').forEach(component => (component as pc.RenderComponent).meshInstances.forEach(mesh => {
      const source = mesh.material as pc.StandardMaterial;
      let copy = copies.get(source);
      if (!copy) {
        copy = source.clone(); copies.set(source, copy); inheritColour(source, copy);
        // Fights happen in moody light: a textured face keeps a little light of its own, so it reads.
        if (party && copy.diffuseMap && MATERIAL_ROLES.get(source.name) === 'skin') {
          copy.emissiveMap = copy.diffuseMap; copy.emissive.set(.2, .2, .2); copy.update();
        }
        // And the lids over its eyes, the same.
        if (party && MATERIAL_ROLES.get(source.name) === 'lid') { copy.emissive.copy(copy.diffuse).mulScalar(.2); copy.update(); }
      }
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
  const BIP_SKILLS: ReadonlySet<string> = new Set(['rayo-energia', 'rayo-sanacion', 'explosion', 'confusion', 'rayo-encogedor', 'control-remoto', 'reinicio', 'virus', 'escudo-de-bits', 'bomba-remota', 'escolta', 'enjambre']);
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
  /**
   * Bip's rays, each its own shape: when it lands (fight seconds into the action) and how long it
   * flies before, so it leaves Bip after a charge and travels, shedding light, into the blow.
   * Rayo de energía is a fast crackling bolt; Rayo encogedor a train of rings that shrink as they
   * go; Rayo de sanación a slow green arc that sheds motes rising like pollen.
   */
  const BIP_RAYS: Record<string, { contact: number; flight: number; hold: number }> = {
    'rayo-energia': { contact: .66, flight: .2, hold: .8 },
    'rayo-encogedor': { contact: .7, flight: .32, hold: .8 },
    'rayo-sanacion': { contact: .74, flight: .4, hold: .75 },
  };
  /**
   * Bip's moves that are not rays (docs/animas/tecnopata/README.md § Look): Bomba remota, it flies to the foe, sticks the bomb on
   * at `contact` and comes home; Escolta, it flies in an arc to the ally and stands by them; Enjambre, it rises over the foes,
   * comes apart into a swarm that grows a network on the floor to every foe (src/swarm-fx.ts `SWARM`), the bombs close on
   * them at `contact`, and Bip forms again at home by its end. Fight seconds from the action's start.
   */
  const BIP_MOVES: Record<string, { contact: number; end: number }> = {
    'bomba-remota': { contact: .66, end: 1.45 },
    escolta: { contact: .72, end: 1.25 },
    enjambre: { contact: 1.6, end: 3.2 },
  };
  /** Enjambre's Bip, in fight seconds from the action's start: it comes apart over the foes, and starts forming again at home. */
  const SWARM_BIP = { apart: .5, reform: 2.4 } as const;
  /**
   * Rayo solar letting go, in fight seconds from its start: Bip rises gathering the sun until
   * `ignite`, then one beam sweeps along the foes for `span` (it burns each as it crosses them), and
   * `tail` more to cool down.
   */
  const SOLAR = { ignite: .78, span: 1, tail: .55 } as const;
  /** Rayo solar's sweep, worked out once: from beyond the first foe to beyond the last, and when it crosses each. */
  const solarPlans = new WeakMap<BattleEffect, { start: pc.Vec3; end: pc.Vec3; crossings: { f: Fighter; id: string; blow: number; at: number }[]; contact: number }>();
  function solarPlan(e: BattleEffect) {
    let plan = solarPlans.get(e);
    if (plan) return plan;
    const hitIds = e.hits?.length ? e.hits.map(h => h.target) : e.target ? [e.target] : [];
    const reached = hitIds.flatMap((id, i) => { const f = fighters.get(id); return f ? [{ f, id, blow: i + 1 }] : []; }), foes = reached.map(r => r.f);
    const bip = bips.get(e.actor)?.bip.entity.getPosition() ?? fighters.get(e.actor)?.base ?? new pc.Vec3();
    const centre = foes.length ? foes.reduce((sum, f) => sum.add(floorUnder(f)), new pc.Vec3()).mulScalar(1 / foes.length) : new pc.Vec3(bip.x + 3, 0, bip.z);
    // Across the line from Bip to them, on the floor: it sweeps from one side of them to the other.
    const toward = new pc.Vec3(centre.x - bip.x, 0, centre.z - bip.z).normalize(), way = new pc.Vec3(-toward.z, 0, toward.x);
    const along = foes.map(f => new pc.Vec3().sub2(floorUnder(f), centre).dot(way));
    const lo = Math.min(-1.2, ...along.map(a => a - 1.1)), hi = Math.max(1.2, ...along.map(a => a + 1.1));
    const start = centre.clone().add(way.clone().mulScalar(lo)), end = centre.clone().add(way.clone().mulScalar(hi));
    const crossings = reached.map((r, i) => ({ ...r, at: SOLAR.ignite + (along[i] - lo) / (hi - lo) * SOLAR.span })).sort((a, b) => a.at - b.at);
    plan = { start, end, crossings, contact: crossings[0]?.at ?? SOLAR.ignite + .2 };
    solarPlans.set(e, plan);
    return plan;
  }
  /** When Dadista's die lands, and when its throw is over. */
  const skyOf = (e: BattleEffect) => e.skill ? SKY[e.skill] : undefined;
  /** Which of the three meteors an action is (0 Meteorito, 1 Meteoro, 2 Asteroide), if it is one. */
  const stageOf = (e: BattleEffect): number | undefined => { const spec = SKILLS.find(x => x.id === e.skill); return spec && 'meteor' in spec ? spec.meteor : undefined; };
  const diceContact = (e: BattleEffect) => skyOf(e)?.contact ?? DICE.contact;
  const diceEnd = (e: BattleEffect) => { const sky = skyOf(e); return sky ? sky.contact + sky.tail + (e.rain ? (e.rain.length - 1) * rainGap(e.rain.length) : 0) : DICE.contact + DICE.tail; };
  /** When Bip's skill lands, in fight seconds from its start (CONTACT_SECONDS for the rest of its moves). */
  function bipContact(e: BattleEffect) {
    if (e.release) return solarPlan(e).contact;
    return (e.skill && (BIP_RAYS[e.skill]?.contact ?? BIP_MOVES[e.skill]?.contact)) || CONTACT_SECONDS;
  }
  /** When Bip's skill is over, in fight seconds from its start. */
  function bipEnd(e: BattleEffect) {
    if (e.release) return SOLAR.ignite + SOLAR.span + SOLAR.tail;
    const ray = e.skill ? BIP_RAYS[e.skill] : undefined, move = e.skill ? BIP_MOVES[e.skill] : undefined;
    return ray ? ray.contact + ray.hold : move ? move.end : ACTION_SECONDS;
  }
  /** Which of Bip's actions have started their charge, fired their ray, and how far Rayo solar's sweep has burned. */
  const bipCharged = new WeakSet<BattleEffect>(), bipFired = new WeakSet<BattleEffect>();
  const solarBurned = new WeakMap<BattleEffect, number>();
  /**
   * Rayo solar's beam reaches the next foe: the fight screen lands that one's blow (its number, its
   * fire: `impact` with 1 + its place in `hits`). `quiet` only tells the screen (no motion, or the action ended first).
   */
  function solarCross(e: BattleEffect, quiet = false) {
    const plan = solarPlan(e), burned = solarBurned.get(e) ?? 0, next = plan.crossings[burned];
    if (!next) return;
    solarBurned.set(e, burned + 1);
    impact?.(next.blow);
    if (quiet) return;
    const { f } = next, chest = chestOf(f), at = bips.get(e.actor)?.bip.entity.getPosition() ?? f.base;
    effects.element('fire', v3(chest), { from: v3(at), strength: 1.5, feet: v3(floorUnder(f)) });
    dualFx.ring(v3(chest), viewDir(), .55, BIP.solar, { count: 70, outward: 3.5, life: .4, size: 1.3, light: 3 });
    dualFx.burst('sunspark', { at: v3(chest), count: 40, speed: 4, up: 1, life: [.3, .7] });
    hit(f, flame, 1.5); shake = Math.max(shake, .4);
  }
  /** The foes Rayo solar's beam has yet to reach: their fire waits for it. */
  function solarAhead(e: BattleEffect) {
    const plan = solarPlan(e);
    return new Set(plan.crossings.slice(solarBurned.get(e) ?? 0).map(c => c.id));
  }
  let sunOf: BattleEffect | undefined;
  /** Where Bip's ray leaves it: a little ahead of it, towards `to`. */
  function bipMuzzle(at: pc.Vec3, to: pc.Vec3) { return at.clone().add(new pc.Vec3().sub2(to, at).normalize().mulScalar(.18)); }
  /** Bip charges a ray: its colour gathering into its front out of the air round it. */
  function bipCharge(e: BattleEffect, at: pc.Vec3, to: pc.Vec3) {
    const ray = e.skill ? BIP_RAYS[e.skill] : undefined;
    if (!ray) return;
    const dir = v3(new pc.Vec3().sub2(to, at).normalize()), muzzle = v3(bipMuzzle(at, to)), lead = ray.contact - ray.flight;
    if (e.skill === 'rayo-sanacion') {
      // Soft: motes drifting in from all round it, and a green ring that breathes in.
      dualFx.burst('mote', { at: muzzle, count: 70, spread: .7, speed: .3, outward: -1.4, life: [lead * .7, lead], colour: '#7dffb0', size: 1.1 });
      dualFx.after(lead * .45, () => dualFx.ring(muzzle, dir, .32, '#9dffc4', { count: 40, outward: -.8, life: lead * .5, size: 1, light: 1.2 }));
      return;
    }
    const colour = e.skill === 'rayo-encogedor' ? '#e8fbff' : BIP.cyan;
    // Two rings of nanites closing in on its eye, the second tighter, and sparks crackling into it.
    dualFx.ring(muzzle, dir, .6, colour, { kind: 'nanite', count: 70, outward: -2.6, around: 2, life: lead * .55 });
    dualFx.after(lead * .4, () => dualFx.ring(muzzle, dir, .38, colour, { kind: 'nanite', count: 50, outward: -2.2, around: -3, life: lead * .45, light: 1.5 }));
    dualFx.after(lead * .3, () => dualFx.burst('bipzap', { at: muzzle, count: 26, spread: .45, speed: .6, outward: -2, life: [.15, lead * .6], colour }));
  }
  /** Bip fires its ray at `to`: it flies `flight` seconds, shedding light, and lands as the action's contact. */
  function bipFire(e: BattleEffect, at: pc.Vec3, to: pc.Vec3, ray: { flight: number }) {
    const from = v3(bipMuzzle(at, to)), dest = v3(to), dir = v3(new pc.Vec3().sub2(to, at).normalize()), steps = 9;
    /** Bursts at the head of the ray, `steps` times as it flies. */
    const shed = (path: (f: number, out: pc.Vec3) => pc.Vec3, each: (p: V3, f: number) => void) => {
      for (let k = 1; k <= steps; k++) dualFx.after(ray.flight * k / steps, () => each(v3(path(k / steps, new pc.Vec3())), k / steps));
    };
    if (e.skill === 'rayo-energia') {
      // A fast bolt: a fat white-cyan head, two crackling strands braided round it, sparks thrown off all the way.
      effects.trails.comet(from, dest, ['#ffffff', BIP.cyan], ray.flight, { arc: 0, width: .2, life: .42, intensity: 3.6, core: .75, additive: .95, taper: .7 });
      for (const phase of [0, Math.PI]) effects.trails.comet(from, dest, ['#e8fdff', '#2a9cff'], ray.flight, { arc: 0, width: .045, life: .3, intensity: 3, core: .5, additive: 1, twist: { turns: 3.5, radius: .14, phase } });
      dualFx.ring(from, dir, .22, BIP.cyan, { count: 40, outward: 3, life: .3, size: 1.2, light: 2.5 });
      dualFx.burst('bipzap', { at: from, count: 30, velocity: { x: dir.x * 3, y: dir.y * 3, z: dir.z * 3 }, cone: .9, speed: 2, life: [.2, .4] });
      shed(cometPath(from, dest, { arc: 0 }), p => {
        dualFx.burst('bipzap', { at: p, count: 16, speed: 3.2, up: .6, life: [.25, .55] });
        dualFx.burst('glyph', { at: p, count: 6, spread: .08, speed: .3, life: [.3, .5], colour: BIP.cyan, size: 1.4 });
      });
      return;
    }
    if (e.skill === 'rayo-encogedor') {
      // A thin white line and a train of rings riding it that spin and shrink as they reach the foe.
      effects.trails.comet(from, dest, ['#ffffff', '#bff6ff'], ray.flight, { arc: 0, width: .06, life: .5, intensity: 3, core: .8, additive: .95, taper: .3 });
      const path = cometPath(from, dest, { arc: 0 });
      shed(path, (p, f) => {
        dualFx.ring(p, dir, .36 * (1 - .65 * f), '#e8fbff', { count: 42, around: f < .5 ? 4 : -4, life: .4, size: 1.2 });
        dualFx.burst('bipzap', { at: p, count: 6, speed: 1.2, life: [.2, .4], colour: '#ffffff' });
      });
      dualFx.ring(from, dir, .3, '#e8fbff', { count: 36, outward: 1.6, life: .3, light: 1.5 });
      return;
    }
    if (e.skill === 'rayo-sanacion') {
      // Slow and gentle: an arc of green with two strands winding round it; motes come loose and float up.
      const arc = .35;
      effects.trails.comet(from, dest, ['#b8ffd2', '#2fcf72'], ray.flight, { arc, width: .12, life: .55, intensity: 1.9, core: .25, additive: .9, taper: .9 });
      for (const phase of [0, Math.PI]) effects.trails.comet(from, dest, ['#9dffbe', '#22b860'], ray.flight, { arc, width: .04, life: .45, intensity: 1.8, core: .2, additive: 1, twist: { turns: 2, radius: .17, phase } });
      shed(cometPath(from, dest, { arc }), p => dualFx.burst('mote', { at: p, count: 9, spread: .1, speed: .35, up: .5, life: [.6, 1.1], colour: '#8dffb8', size: 1.2 }));
    }
  }
  /**
   * Rayo solar letting go, each frame of it (`t` fight seconds in): the sun gathering into Bip, then
   * the beam sweeping along the foes, molten light dripping off it and fire where it crosses each.
   * Returns where Bip looks.
   */
  function solarFrame(e: BattleEffect, at: pc.Vec3, t: number, dt: number): pc.Vec3 {
    const plan = solarPlan(e), k = Math.min(1.5, dt * 60);
    const u = clamp01((t - SOLAR.ignite) / SOLAR.span), sweep = smooth(u) * .85 + u * .15;
    sunFloor.lerp(plan.start, plan.end, sweep); sunFloor.y = groundHeight(sunFloor.x, sunFloor.z);
    sunAim.set(sunFloor.x, sunFloor.y + .75, sunFloor.z);
    if (!bipCharged.has(e)) {
      bipCharged.add(e);
      // The sun gathers: streams of gold winding into Bip from all round it, a halo turning.
      const to = v3(at);
      for (let i = 0; i < 7; i++) {
        const a = i / 7 * Math.PI * 2, from = { x: at.x + Math.cos(a) * 1.6, y: at.y + .4 + Math.sin(a * 2) * .5, z: at.z + Math.sin(a) * 1.6 };
        effects.trails.comet(from, to, ['#fff6c8', '#ff9a2e'], .45, { arc: .3, width: .07, life: .3, intensity: 2.8, core: .5, delay: i * .05, twist: { turns: 1.2, radius: .12, phase: a } });
      }
      dualFx.burst('mote', { at: to, count: 120, spread: 1.4, speed: .2, outward: -2.2, life: [.45, .7], colour: BIP.solar, size: 1.2 });
      dualFx.after(.3, () => dualFx.ring(to, { x: 0, y: 1, z: 0 }, .55, BIP.solar, { count: 80, around: 4, outward: -.6, life: .5, size: 1.2, light: 2.5 }));
      pulse?.(.25, .4);
    }
    // Hotter and hotter as it gathers.
    if (t < SOLAR.ignite) dualFx.burst('sunglow', { at: v3(at), count: Math.round((2 + 6 * smooth(t / SOLAR.ignite)) * k), spread: .25, speed: .4, life: [.15, .3], size: .8 });
    const on = t >= SOLAR.ignite && t < SOLAR.ignite + SOLAR.span + .12;
    sunBeam.enabled = on;
    if (on) {
      const from = bipMuzzle(at, sunAim), length = from.distance(sunAim);
      if (sunOf !== e) {
        sunOf = e;
        // It lets go: a flash and a ring off Bip, and a trail of fire left along the floor under the beam.
        dualFx.ring(v3(from), v3(new pc.Vec3().sub2(sunAim, from).normalize()), .4, BIP.solar, { count: 90, outward: 4, life: .4, size: 1.4, light: 4 });
        dualFx.burst('sunspark', { at: v3(from), count: 50, speed: 4, life: [.3, .6] });
        effects.trails.follow(sunFloor, { colour: ['#fff2b8', '#ff6a1f'], width: .5, intensity: 2.8, core: .55, seconds: SOLAR.span + .1, life: .7 });
        shake = Math.max(shake, .5); pulse?.(.7, .6);
      }
      sunBeam.setPosition(from); sunBeam.lookAt(sunAim);
      // It flares as it lets go, its core flickers, and it thins out as it ends.
      const swell = 1 + .7 * (1 - smooth((t - SOLAR.ignite) / .12)), fade = 1 - smooth((t - SOLAR.ignite - SOLAR.span + .1) / .2);
      const flicker = swell * fade * (.85 + Math.random() * .3);
      for (const [i, child] of (sunBeam.children as pc.Entity[]).entries()) { const w = [.14, .34, .7][i] * flicker; child.setLocalPosition(0, 0, -length / 2); child.setLocalScale(w, length, w); }
      // Hot glow along it, molten drops off it, and where it burns: sparks up off the floor and embers.
      dualFx.burst('sunglow', { at: v3(from), to: v3(sunAim), shape: 'line', count: Math.round(26 * k), spread: .08, speed: .5, life: [.15, .35] });
      dualFx.burst('sunspark', { at: v3(from), to: v3(sunAim), shape: 'line', count: Math.round(5 * k), spread: .06, speed: 1.5, life: [.5, .9] });
      dualFx.burst('sunspark', { at: v3(sunFloor), count: Math.round(7 * k), velocity: { x: 0, y: 3, z: 0 }, cone: .9, speed: 1.5, life: [.3, .6] });
      dualFx.burst('ember', { at: v3(sunAim), count: Math.round(3 * k), spread: .2, speed: 1, life: [.5, 1] });
    }
    // Whoever it crosses catches fire, and only then (their number and fire land with it).
    while (impacted && (solarBurned.get(e) ?? 0) < plan.crossings.length && t >= plan.crossings[solarBurned.get(e) ?? 0].at) solarCross(e);
    // Spent, Bip lets off what is left: a last ring, and gold drizzling down.
    if (t >= SOLAR.ignite + SOLAR.span && !bipFired.has(e)) {
      bipFired.add(e);
      dualFx.ring(v3(at), { x: 0, y: 1, z: 0 }, .3, BIP.solar, { count: 60, outward: 2.5, life: .5, size: 1.1 });
      dualFx.burst('ember', { at: v3(at), count: 40, spread: .3, speed: 1.2, life: [.6, 1.2] });
    }
    return t < SOLAR.ignite ? (plan.crossings[0] ? chestOf(plan.crossings[0].f) : sunAim.clone()) : sunAim.clone();
  }
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
  /** The duals of other ánimas whose choreography has started (`startDuo`). */
  const duoPlayed = new WeakSet<BattleEffect>();
  /** Where Bip hangs over the foes while Bombardeo orbital is held, and their floors and chests. */
  function orbitPlan() {
    const foes = [...fighters.values()].filter(f => !f.party && f.hp > 0 && !f.part);
    const centre = foes.length ? foes.reduce((sum, f) => sum.add(f.base), new pc.Vec3()).mulScalar(1 / foes.length) : anchor.clone();
    return { bip: { x: centre.x, y: groundHeight(centre.x, centre.z) + 3.5, z: centre.z }, foes: foes.map(f => ({ at: v3(chestOf(f)), feet: v3(floorUnder(f)), radius: extent(f).radius })) };
  }
  /**
   * A dual of two ánimas other than Matemágico and Papagato's (`DUO`), or the blast one of them leaves
   * (`BLAST`), starts: its stinger and freeze, and everything it draws, set going on the fight's clock
   * (src/dual-fx.ts). How it lands is `contactBurst`.
   */
  /** Who a newer dual lands on: every foe it hits, the party it covers, or whoever it is for. */
  function duoReached(e: BattleEffect, target: Fighter | undefined): string[] {
    if (e.hits?.length) return e.hits.map(h => h.target);
    if (e.boosted?.length || e.bits?.raised) return [...fighters.entries()].filter(([, f]) => f.party && f.hp > 0).map(([id]) => id);
    const id = target && [...fighters.entries()].find(([, f]) => f === target)?.[0];
    return id ? [id] : e.target ? [e.target] : [];
  }
  /** A fighter as the newer duals' own looks see it (src/duo-fx). */
  function duoFighter(id: string, f: Fighter): DuoFighter {
    const body = extent(f), hand = f.party ? (f.arms[0]?.findByName('Mano') as pc.Entity | null ?? f.model).getPosition() : undefined;
    return { id, party: f.party, chest: v3(chestOf(f)), feet: v3(floorUnder(f)), hand: hand && v3(hand), radius: Math.max(.25, body.radius), height: body.height, rigid: f.rigid, anima: f.party ? classOf(id) : undefined, hp: f.hp, index: effects.fighterIndex(f.model) };
  }
  /**
   * The newer duals draw dense (Aitor, 2026-11-21: the GPU is not the limit, *dale duro*): every burst of
   * theirs with a handful of particles or more carries `DUO_DENSITY` times as many. A single ring, glow or
   * star (a count of one or two) stays as it is, so nothing is brighter, only fuller.
   */
  const denseFx: typeof dualFx = Object.assign(Object.create(dualFx) as typeof dualFx, {
    burst: (kind: string, o: Parameters<typeof dualFx.burst>[1]) => dualFx.burst(kind, o.count >= 8 ? { ...o, count: Math.round(o.count * DUO_DENSITY) } : o),
  });
  /** Who a dual's `hits` reach, worked out once an effect (read every frame while it is coming or in flight). */
  const hitSets = new WeakMap<BattleEffect, Set<string>>();
  const hitSet = (e: BattleEffect) => { let set = hitSets.get(e); if (!set) hitSets.set(e, set = new Set((e.hits ?? []).map(h => h.target))); return set; };
  /**
   * Campana de Gauss: how far (degrees, as `lens.yaw`) the camera turns round the fight so the row of foes it
   * reaches runs across the picture, its bins each over its own foe (never more than 50°). Once an effect.
   */
  const bellTurns = new WeakMap<BattleEffect, number>();
  function bellTurn(e: BattleEffect) {
    let turn = bellTurns.get(e);
    if (turn !== undefined) return turn;
    const at = (e.hits ?? []).map(h => fighters.get(h.target)).filter((f): f is Fighter => !!f).map(f => chestOf(f));
    let d = { x: 0, z: 0 }, far = 0;
    for (const a of at) for (const b of at) { const n = Math.hypot(b.x - a.x, b.z - a.z); if (n > far) { far = n; d = { x: b.x - a.x, z: b.z - a.z }; } }
    const v = viewDir(), across = d.x * v.z - d.z * v.x, along = d.x * v.x + d.z * v.z;
    // The smaller of the two turns that put the row square to the view: tan(turn) = −along / across.
    turn = far < .3 ? 0 : Math.atan2(-along, across) * pc.math.RAD_TO_DEG;
    if (turn > 90) turn -= 180; else if (turn < -90) turn += 180;
    bellTurns.set(e, turn = Math.max(-50, Math.min(50, turn)));
    return turn;
  }
  /** The fight's camera direction, turned `degrees` round the fight as the game turns it for `lens.yaw`. */
  function turned(view: V3, degrees: number): V3 {
    const a = degrees * pc.math.DEG_TO_RAD, c = Math.cos(a), s = Math.sin(a);
    return { x: view.x * c + view.z * s, y: view.y, z: view.z * c - view.x * s };
  }
  /** What the newer duals' own looks (src/duo-fx) are handed: the fight as points, and the scene's few levers. */
  function duoStage(e?: BattleEffect): DuoStage {
    const standing = (party: boolean) => [...fighters.entries()].filter(([, f]) => f.party === party && f.hp > 0 && !f.part && !f.unborn).map(([id, f]) => duoFighter(id, f));
    return {
      fx: denseFx, fluid: fluidFx, effects, view: e?.dual?.id === 'campana-de-gauss' ? turned(viewDir(), bellTurn(e)) : viewDir(),
      fighter: id => { const f = fighters.get(id); return f ? duoFighter(id, f) : undefined; },
      foes: () => standing(false), party: () => standing(true),
      wearer: anima => {
        const id = e?.dual?.actors.find(a => classOf(a) === anima) ?? state?.allies.find(a => a.classId === anima && a.hp > 0)?.id, f = id ? fighters.get(id) : undefined;
        return id && f ? duoFighter(id, f) : undefined;
      },
      bip: () => { for (const b of bips.values()) if (b.shown && !b.gone) return v3(b.bip.entity.getPosition()); return undefined; },
      cat: wearer => { const haru = catsOf(wearer)?.haru.entity; if (!haru?.enabled) return undefined; const p = haru.getPosition(); catAt.x = p.x; catAt.y = p.y; catAt.z = p.z; return catAt; },
      catRest: wearer => { const f = fighters.get(wearer); if (!f || !catsOf(wearer)) return undefined; const s = catSpots(layout, f.base).haru; return { x: s.x, y: groundHeight(s.x, s.z), z: s.z }; },
      hit: (id, rgb, strength = 1) => { const f = fighters.get(id); if (f) hit(f, new pc.Color(rgb[0], rgb[1], rgb[2]), strength * (f.rigid ? .4 : 1)); },
      shake: amount => { shake = Math.max(shake, amount); },
      pulse: (fringe, bloom, flash) => pulse?.(fringe, bloom, flash),
      punch: amount => { zoom.x = Math.max(zoom.x, HIT.punch.size * (1 + amount)); },
      cue: (id, options) => cue(id, options),
      pan: at => {
        const cam = app.systems.camera?.cameras[0], width = app.graphicsDevice.clientRect.width;
        if (!cam || !width) return 0;
        const s = cam.worldToScreen(new pc.Vec3(at.x, at.y, at.z));
        return Math.max(-1, Math.min(1, s.x / width * 2 - 1));
      },
      clear: at => {
        const cam = app.systems.camera?.cameras[0], canvas = app.graphicsDevice.canvas as HTMLCanvasElement, box = canvas.getBoundingClientRect();
        if (!cam || !box.width) return true;
        const s = cam.worldToScreen(new pc.Vec3(at.x, at.y, at.z)), x = box.left + s.x * box.width / app.graphicsDevice.clientRect.width, y = box.top + s.y * box.height / app.graphicsDevice.clientRect.height;
        if (s.z < 0 || x < box.left || x > box.right || y < box.top || y > box.bottom) return false;
        const pad = 12;
        return ![...document.querySelectorAll<HTMLElement>('#battle .battle-dock:not([hidden]), #battle .party-roster')].some(el => {
          const r = el.getBoundingClientRect();
          return r.width && x > r.left - pad && x < r.right + pad && y > r.top - pad && y < r.bottom + pad;
        });
      },
      figure: (name, o) => figures.neon(name, o?.look, o?.frame),
      draw: (figure, strokes, seconds, o) => figures.drawNeon(figure, strokes, seconds, o),
      ground: (x, z) => groundHeight(x, z),
    };
  }
  function startDuo(e: BattleEffect, target: Fighter | undefined, animate: boolean) {
    duoPlayed.add(e);
    const id = e.dual?.id ?? e.detonation;
    if (e.dual) { cue('dual'); if (animate) clock.hold = Math.max(clock.hold, DUAL_FREEZE); }
    if (!animate || !dualFx.on) return;
    const view = viewDir(), wearerId = (anima: ClassId) => e.dual?.actors.find(a => classOf(a) === anima), wearer = (anima: ClassId) => { const id = wearerId(anima); return id ? fighters.get(id) : undefined; };
    const handOf = (f?: Fighter) => f && v3((f.arms[0]?.findByName('Mano') as pc.Entity | null ?? f.model).getPosition());
    if (id === 'sutura-de-luz' && target) {
      const techId = wearerId('tecnopata'), tech = wearer('tecnopata'), math = wearer('matemagico'), body = extent(target), b = techId ? bips.get(techId) : undefined;
      const bip = b?.shown ? v3(b.bip.entity.getPosition()) : tech && v3(chestOf(tech));
      dualFx.suture({ chest: v3(chestOf(target)), feet: v3(floorUnder(target)), height: body.height, radius: body.radius, hand: handOf(math), bip, view, close: DUO['sutura-de-luz'].contact });
      cue('zap', { delay: .3 }); cue('mark-set', { delay: .5 });
    }
    if (id === 'relevo-de-sangre' && target) {
      const dice = wearer('dadaista'), next = e.relay ? fighters.get(e.relay.target) : undefined, spot = spotOf(target);
      dualFx.relay({ at: v3(chestOf(target)), feet: spot.feet, size: spot.size, star: handOf(dice), next: next && { at: v3(chestOf(next)), feet: v3(floorUnder(next)), size: spotOf(next).size }, stacks: e.relay?.stacks ?? 0, view, strike: DUO['relevo-de-sangre'].contact });
      if (next) {
        const lands = DUO['relevo-de-sangre'].contact + .64;
        dualFx.after(lands, () => { hit(next, clawFlash, 1.4 * (next.rigid ? .4 : 1)); shake = Math.max(shake, .25); pulse?.(.6, .7); cue('bleed'); });
        cue('rise', { delay: .3 });
      }
    }
    if (id === 'bombardeo-orbital' && e.dual) {
      const plan = orbitPlan();
      dualFx.orbitCharge(plan.bip, plan.foes, view);
      cue('charge'); [.1, .3, .5].forEach(at => cue('clink', { delay: at }));
    }
    if (id === 'bombardeo-orbital' && e.detonation) {
      const plan = orbitPlan(), salvos = BLAST['bombardeo-orbital'].salvos;
      salvos.forEach((at, k) => dualFx.after(at, () => {
        dualFx.orbitSalvo(k, plan.bip, plan.foes);
        cue('zap');
        if (k < salvos.length - 1) { shake = Math.max(shake, .25); pulse?.(.4, .6); for (const f of fighters.values()) if (!f.party && f.hp > 0) hit(f, cyanFlash, .9); }
      }));
    }
    if (id === 'reserva-de-color' && e.detonation && target) {
      const v = viewDir();
      dualFx.fuseFlare(v3(chestOf(target).add(new pc.Vec3(v.x, v.y, v.z).mulScalar(.4))), view, BLAST['reserva-de-color'].contact);
      cue('burn'); hit(target, flame, .8);
    }
    if (id === 'vulcano' && e.dual) {
      // Gerard's binary fire goes into the ground where the volcano will stand; Marta's eco beats on it
      // three times, the floor cracking wider each time; then it rises and erupts over every foe.
      const math = wearer('matemagico'), site = volcanoSite(), hand = handOf(math), up = { x: 0, y: 1, z: 0 }, base = { x: site.x, y: site.y + .06, z: site.z };
      if (hand) for (const phase of [0, Math.PI]) effects.trails.comet(hand, base, ['#fff2c4', MAGMA], .5, { arc: .9, width: .07, life: .55, intensity: 3, core: .5, additive: 1, twist: { turns: 2, radius: .12, phase } });
      [.42, .62, .82].forEach((at, k) => dualFx.after(at, () => {
        dualFx.ring(base, up, .45 + k * .3, '#8fe3c4', { count: 90, outward: 2.4, life: .45, size: 1.2, light: 1.6 });
        dualFx.ring(base, up, .3 + k * .25, MAGMA, { count: 60 + k * 30, around: 2, life: .6, size: 1.3, light: 2 + k });
        dualFx.burst('crackle', { at: base, count: 40 + k * 40, spread: .2 + k * .15, velocity: { x: 0, y: 3 + k * 2, z: 0 }, cone: .5, speed: 1, life: [.3, .6], colour: '#ffb84a' });
        shake = Math.max(shake, .12 + k * .08);
      }));
      dualFx.after(DUO.vulcano.contact - .08, () => eruption((e.hits ?? []).flatMap(h => { const f = fighters.get(h.target); return f ? [f] : []; }), 1.6));
      cue('fire-cast', { delay: .1 }); [.42, .62, .82].forEach(at => cue('clink', { delay: at }));
    }
    if (id === 'sobrecalentamiento' && e.dual) {
      // Bip raises the dome over the party, of fire this time, and Gerard's binary fire runs into it; it
      // swells white-hot and bursts, and its own bits fly at the foes, each at the one on its side, and
      // go off on them: the first wave as the number lands, the rest of the dome streaming in after it.
      const plan = DUO.sobrecalentamiento, math = wearer('matemagico'), hand = handOf(math), dome = raiseFireDome(), up = { x: 0, y: 1, z: 0 };
      const struck = (e.hits ?? []).flatMap(h => { const f = fighters.get(h.target); return f ? [f] : []; });
      if (dome && hand) dualFx.after(.15, () => effects.binaryFire(hand, dome.centre, { seconds: .3, gap: 0, burn: true }));
      dualFx.after(plan.heat, () => {
        dome?.heat(plan.burst - plan.heat);
        if (dome) dualFx.ring(dome.base, up, dome.radius, '#ff9a3c', { kind: 'crackle', count: 90, around: 1.2, life: .5, size: 1.2, light: 3 });
      });
      dualFx.after(plan.burst, () => {
        // The dome bursts as a fireball over the party, rolling up as its bits fly.
        if (dome) fluidFx.fireball(dome.centre, Math.min(1.4, dome.radius * .55), 1.1);
        dome?.throwAt(struck.map(f => ({ at: v3(chestOf(f)), radius: Math.max(.3, extent(f).radius * .6) })), plan.contact + plan.stream - plan.burst);
        shake = Math.max(shake, .3);
      });
      for (const f of struck) {
        dualFx.after(plan.contact, () => { effects.element('fire', v3(chestOf(f)), { strength: 1.3, feet: v3(floorUnder(f)) }); hit(f, flame, 1.4 * (f.rigid ? .4 : 1)); });
        dualFx.after(plan.contact + plan.stream, () => hit(f, flame, .8 * (f.rigid ? .4 : 1)));
      }
      cue('charge'); cue('fire-cast', { delay: .15 }); cue('burn', { delay: plan.heat }); cue('crack', { delay: plan.burst }); cue('fire-hit', { delay: plan.contact });
    }
    const own = e.dual && DUO_STAGINGS[e.dual.id];
    if (own && e.dual) {
      const stage = duoStage(e), reached = duoReached(e, target).map(f => stage.fighter(f)).filter((f): f is DuoFighter => !!f);
      own.start(stage, e, reached);
    }
    if (id === 'reserva-de-color' && e.dual && target) {
      const painter = wearer('prismatico'), math = wearer('matemagico');
      dualFx.paintFuse({ at: v3(chestOf(target)), size: spotOf(target).size, hand: handOf(math), painter: painter && v3(chestOf(painter)), view, lit: DUO['reserva-de-color'].contact });
      cue('splash', { delay: .1 }); cue('fire-cast', { delay: .55 }); cue('burn', { delay: .85 });
    }
  }
  /**
   * The camera and spotlight of a dual of two ánimas (`DUO`) or its blast: first the two who make it
   * and whoever it is for, the rest of the picture gone grey, then in on where it lands; Relevo de
   * sangre follows the wound to the next foe, Bombardeo orbital looks up at Bip and then over the foes.
   */
  function duoLens(e: BattleEffect, target: Fighter | undefined, t: number) {
    const look = (p: pc.Vec3, k = .75) => ({ x: (p.x - frame.x) * k, z: (p.z - frame.z) * k });
    const pair = (e.dual?.actors ?? [e.actor]).map(id => fighters.get(id)).filter((f): f is Fighter => !!f);
    const mid = (list: Fighter[]) => list.reduce((sum, f) => sum.add(f.base), new pc.Vec3()).mulScalar(1 / Math.max(1, list.length));
    const foes = [...fighters.values()].filter(f => !f.party && f.hp > 0 && !f.part);
    const points: { x: number; y: number; z: number; radius: number }[] = [];
    const keep = (f: Fighter | undefined, k = 1.15) => { if (f && points.length < 4) points.push({ ...v3(chestOf(f)), radius: k * f.scale.y }); };
    const id = e.dual?.id ?? e.detonation, contact = duoOf(e)?.contact ?? 0;
    if (id === 'bombardeo-orbital') {
      const centre = foes.length ? mid(foes) : anchor;
      if (e.dual) {
        Object.assign(lensWant, { yaw: 0, pitch: -2, zoom: .12, ...look(centre, .55), y: 1.1 });
        const plan = orbitPlan(); points.push({ ...plan.bip, radius: 1.6 }); foes.slice(0, 3).forEach(f => keep(f));
        spotWant = .8;
      } else {
        Object.assign(lensWant, { yaw: 0, pitch: -6, zoom: .14 + .05 * Math.min(1, t / .7), ...look(centre, .7), y: .3 });
        spotWant = 0;
      }
    } else if (id === 'sobrecalentamiento') {
      // The dome over the party while it rises and overheats; then wide, over the way its bits fly to the foes.
      const plan = DUO.sobrecalentamiento, party = [...fighters.values()].filter(f => f.party && f.hp > 0);
      const home = party.length ? mid(party) : anchor;
      if (t < plan.burst) Object.assign(lensWant, { yaw: 0, pitch: -4, zoom: .08, ...look(home, .55), y: .3 });
      else Object.assign(lensWant, { yaw: 0, pitch: -6, zoom: 0, ...look(mid([...party, ...foes]), .5), y: 0 });
      party.slice(0, 2).forEach(f => keep(f, 1.8)); foes.slice(0, 2).forEach(f => keep(f));
      spotWant = t < plan.burst ? .7 : 0;
    } else if (id === 'campana-de-gauss') {
      // Campana de Gauss: its board stands in the air over the foes. Wide and lifted to take it in whole while the dice fall
      // through it, then down onto the foes as the fire pours out of its bins.
      // It turns round the fight so their row runs across the picture, its bins each over its own foe.
      const centre = foes.length ? mid(foes) : target?.base ?? anchor, yaw = bellTurn(e);
      if (t < contact - .3) Object.assign(lensWant, { yaw, pitch: 6, zoom: .3, ...look(target?.base ?? centre, .85), y: 2.4 });
      else Object.assign(lensWant, { yaw, pitch: -4, zoom: .16, ...look(target?.base ?? centre, .7), y: .9 });
      foes.slice(0, 3).forEach(f => keep(f)); pair.forEach(f => keep(f));
      spotWant = t < contact + .3 ? .7 : 0;
    } else if (e.dual && e.dual.id in DUO_STAGINGS && new Set((e.hits ?? []).map(h => h.target)).size > 1) {
      // A newer dual over every foe (Marea, Fulgurita, Metralla, Seiche): wide, over all of them, a little lower as it lands.
      if (t < contact * .6) Object.assign(lensWant, { yaw: 0, pitch: -4, zoom: 0, ...look(mid([...pair, ...foes]), .5), y: .2 });
      else Object.assign(lensWant, { yaw: 0, pitch: -6, zoom: .1, ...look(foes.length ? mid(foes) : anchor, .65), y: 0 });
      foes.slice(0, 3).forEach(f => keep(f)); pair.forEach(f => keep(f));
      spotWant = t < contact + .3 ? .7 : 0;
    } else if (id === 'geiser' && target) {
      // Géiser: in on the water building under the foe, then back and up to take in the whole column and the steam.
      if (t < contact * .8) Object.assign(lensWant, { yaw: 0, pitch: -8, zoom: .18, ...look(mid([...pair, target]), .75), y: 0 });
      else Object.assign(lensWant, { yaw: 0, pitch: 4, zoom: 0, ...look(foes.length ? mid(foes) : target.base, .6), y: 1.2 });
      keep(target, 1.6); pair.forEach(f => keep(f));
      spotWant = t < contact + .2 ? 1 : 0;
    } else if (id === 'reserva-de-color' && e.detonation) {
      const host = target ?? foes[0];
      if (host) Object.assign(lensWant, { yaw: 0, pitch: -5, zoom: .1, ...look(mid(foes.length ? foes : [host]), .6), y: 0 });
      spotWant = 0;
    } else if (id === 'corriente-alterna' && target) {
      // Corriente alterna: both poles of its circuit in the picture, the string drawn tight between them; the pair first. The
      // camera turns (up to 35° from where it rests) so the string runs across the picture, clear of the scenery and of the
      // commands on the left (`alternaShot`), worked out once as it starts.
      const ends = [...new Set(e.circuit ?? [])].map(p => fighters.get(p)).filter((f): f is Fighter => !!f), poles = ends.length ? ends : [target];
      if (alternaFrame.effect !== e) alternaFrame = { effect: e, ...alternaShot(poles) };
      const { yaw, shift } = alternaFrame;
      if (t < contact * .45) Object.assign(lensWant, { yaw: yaw * .5, pitch: -5, zoom: .02, ...look(mid([...pair, ...poles]), .55), y: .15 });
      else { const at = look(mid(poles), .7); Object.assign(lensWant, { yaw, pitch: -6, zoom: poles.length > 1 ? .1 : .2, x: at.x + shift.x, z: at.z + shift.z, y: 0 }); }
      poles.forEach(f => keep(f, 1.4)); pair.forEach(f => keep(f));
      spotWant = t < contact + .35 ? 1 : 0;
    } else if (target) {
      const next = e.relay ? fighters.get(e.relay.target) : undefined;
      if (t < contact * .55) {
        Object.assign(lensWant, { yaw: 0, pitch: -9, zoom: .2, ...look(mid([...pair, target]), .75), y: 0 });
      } else if (next && t > contact + .2) {
        Object.assign(lensWant, { yaw: 0, pitch: -5, zoom: .14, ...look(mid([target, next]), .7), y: 0 });
      } else {
        Object.assign(lensWant, { yaw: id === 'sutura-de-luz' ? 0 : -10 * smooth(t / contact), pitch: -6, zoom: id === 'sutura-de-luz' ? .3 : target.rigid ? .06 : .26, ...look(target.base, .7), y: 0 });
      }
      keep(target, 1.4); if (next) keep(next, 1.3); pair.forEach(f => keep(f));
      spotWant = t < contact + .35 || next ? 1 : 0;
    }
    if (spot && spotAmount > .002) spot(spotAmount, points);
  }
  /** Corriente alterna's shot, worked out once for the effect that plays it (`duoLens`, `alternaShot`). */
  let alternaFrame: { effect?: BattleEffect; yaw: number; shift: { x: number; z: number } } = { yaw: 0, shift: { x: 0, z: 0 } };
  /** Scenery boxes near the fight that could stand between its camera and a fighter, gathered once for where the fight is. */
  let blockers: { key: string; boxes: pc.BoundingBox[] } | undefined;
  function sceneryBoxes(): pc.BoundingBox[] {
    const key = `${frame.x.toFixed(1)},${frame.z.toFixed(1)}`;
    if (blockers?.key === key) return blockers.boxes;
    const ours = new Set<pc.GraphNode>([...fighters.values()].map(f => f.model));
    const boxes: pc.BoundingBox[] = [];
    for (const r of app.root.findComponents('render') as pc.RenderComponent[]) {
      if (!r.enabled || !r.entity.enabled) continue;
      let n: pc.GraphNode | null = r.entity, fighter = false;
      while (n && !fighter) { fighter = ours.has(n); n = n.parent; }
      if (fighter) continue;
      for (const m of r.meshInstances) {
        const box = m.aabb, h = box.halfExtents;
        // Not the ground, a whole block or a particle pool (too big to be a thing in the way), nor a kerb (too low to hide a chest).
        if (!m.visible || h.x > 12 || h.z > 12 || box.getMax().y < frame.y + .5) continue;
        if (Math.hypot(box.center.x - frame.x, box.center.z - frame.z) > 30) continue;
        // A little wider than it is: a lamp's glow, a crown's leaves and the string's own glow reach past the box.
        boxes.push(new pc.BoundingBox(box.center.clone(), new pc.Vec3(h.x + .4, h.y + .3, h.z + .4)));
      }
    }
    blockers = { key, boxes };
    return boxes;
  }
  /**
   * Corriente alterna's shot: the turn of the camera (−35° to 35° from where it rests, every 5°) that lays the string
   * between `poles` across the picture with neither chest nor the string's middle behind scenery (a streetlamp, a tree)
   * and both poles clear of the commands on the left, little turned if it can; and how far the camera looks to the left
   * of them, so they stand right of the commands. Worked out once, as the dual starts.
   */
  function alternaShot(poles: Fighter[]) {
    const a = chestOf(poles[0]), b = chestOf(poles[poles.length - 1]), middle = new pc.Vec3();
    const base = camera(), boxes = sceneryBoxes(), rect = app.graphicsDevice.clientRect, cam = app.systems.camera?.cameras[0];
    const halfWide = (cam?.orthoHeight ?? 11) * .9 * rect.width / Math.max(1, rect.height);
    // The commands' column, as a share of the picture's width (src/style.css `.commands`), and a breath beside it.
    const column = Math.min(.4, 420 / Math.max(1, rect.width)) + .05;
    const centre = poles.reduce((sum, f) => sum.add(f.base), new pc.Vec3()).mulScalar(1 / poles.length);
    const aim = new pc.Vec3(frame.x + (centre.x - frame.x) * .7, 0, frame.z + (centre.z - frame.z) * .7);
    const ray = new pc.Ray(), toward = new pc.Vec3();
    let best = { score: Infinity, yaw: 0, shift: { x: 0, z: 0 } };
    for (let turn = -35; turn <= 35; turn += 5) {
      const r = turn * pc.math.DEG_TO_RAD, x = base.x * Math.cos(r) + base.z * Math.sin(r), z = base.z * Math.cos(r) - base.x * Math.sin(r);
      // As the fight's camera stands for this shot (game.ts): turned, and lowered by its own pitch and the shot's.
      const flat = Math.hypot(x, z), pitch = Math.atan2(base.y, flat) + (-7 - 6) * pc.math.DEG_TO_RAD;
      const view = { x: x / flat * Math.cos(pitch), y: Math.sin(pitch), z: z / flat * Math.cos(pitch) }, { right } = screenAxes(view);
      toward.set(view.x, view.y, view.z);
      const along = Math.hypot(b.x - a.x, b.z - a.z), across = along > .1 ? Math.abs((b.x - a.x) * right.x + (b.z - a.z) * right.z) / along : 1;
      let score = (1 - across) * 4 + Math.abs(turn) / 70;
      // Both chests, and the string between them every fifth of its length (a lamp's head on it counts too).
      for (const [k, weight] of [[0, 2.5], [.2, 1], [.4, 1], [.6, 1], [.8, 1], [1, 2.5]] as const) {
        ray.set(middle.clone().lerp(a, b, k), toward);
        if (boxes.some(box => box.intersectsRay(ray))) score += weight;
      }
      // Where each pole falls across the picture (0 left, 1 right), and how far the camera must look left to clear the commands.
      const at = (p: pc.Vec3) => .5 + ((p.x - aim.x) * right.x + (p.z - aim.z) * right.z) / (2 * halfWide);
      const left = Math.min(at(a), at(b)), rightmost = Math.max(at(a), at(b));
      const need = Math.max(0, column - left), room = Math.max(0, .95 - rightmost), moved = Math.min(need, room);
      score += (need - moved) * 10;
      if (score < best.score) best = { score, yaw: turn, shift: { x: -right.x * moved * 2 * halfWide, z: -right.z * moved * 2 * halfWide } };
    }
    return { yaw: best.yaw, shift: best.shift };
  }
  /** Fight seconds the next glint of a lasting dual is due in: Sutura's stitches, a lit fuse, Bombardeo's beat. */
  const holds = { suture: 0, fuse: 0, orbit: 0, fleck: 0, volcano: 0 };
  /** Each foe's Volcán clock as last seen: when it jumps back up, a beat went off. */
  const volcanoNext = new Map<string, number>();
  /** The duals that last show while they do (`sutureHold`, `fuseHold`, `orbitHold`), unless their own dual is still drawing them. */
  function holdTells(dt: number, t: number) {
    wallFrame();
    if (!state || !dualFx.on) return;
    // The newer duals' own lasting looks (src/duo-fx): what each timed status they leave keeps drawing.
    {
      let stage: DuoStage | undefined;
      for (const own of Object.values(DUO_STAGINGS)) if (own?.hold) own.hold(stage ??= duoStage(effect), dt, state, effect);
    }
    // Vulcano's volcano stands while any foe has it; each beat of its clock it erupts on whoever it is under.
    const under = state.foes.filter(f => f.timed?.volcan);
    if (under.length && !(effect?.dual?.id === 'vulcano' && t < DUO.vulcano.contact)) {
      if ((holds.volcano -= dt) <= 0) { holds.volcano = .09; volcanoIdle(); }
      const beat = under.filter(f => (f.timed!.volcan!.next) > (volcanoNext.get(f.id) ?? 99) + 1);
      if (beat.length) eruption(beat.flatMap(f => { const x = fighters.get(f.id); return x && f.hp > 0 ? [x] : []; }), .8);
    }
    // The last beat takes the volcano with it.
    const gone = [...volcanoNext.keys()].filter(id => !state!.foes.find(f => f.id === id)?.timed?.volcan && (volcanoNext.get(id) ?? 9) < 1.5);
    if (gone.length) eruption(gone.flatMap(id => { const x = fighters.get(id); const u = state!.foes.find(f => f.id === id); return x && u && u.hp > 0 ? [x] : []; }), 1);
    volcanoNext.clear();
    for (const f of under) volcanoNext.set(f.id, f.timed!.volcan!.next);
    const own = (id: string, until: number) => effect?.dual?.id === id && t < until;
    if ((holds.suture -= dt) <= 0) {
      holds.suture = .75;
      if (!own('sutura-de-luz', DUO['sutura-de-luz'].end)) for (const a of state.allies) if (a.suture && a.hp > 0) { const f = fighters.get(a.id); if (f) dualFx.sutureHold(v3(chestOf(f).add(new pc.Vec3(...Object.values(viewDir())).mulScalar(.35))), viewDir()); }
    }
    if ((holds.fuse -= dt) <= 0) {
      holds.fuse = .09; const flecks = (holds.fleck = (holds.fleck + 1) % 5) === 0;
      if (!own('reserva-de-color', DUO['reserva-de-color'].contact)) for (const foe of state.foes) if (foe.fuse && foe.hp > 0) { const f = fighters.get(foe.id); if (f) { const v = viewDir(); dualFx.fuseHold(v3(chestOf(f).add(new pc.Vec3(v.x, v.y, v.z).mulScalar(.4))), flecks); } }
    }
    if ((holds.orbit -= dt) <= 0) {
      holds.orbit = 1;
      if (!own('bombardeo-orbital', 1.3) && state.allies.some(a => a.charge?.dual === 'bombardeo-orbital' && a.hp > 0)) { const plan = orbitPlan(); dualFx.orbitHold(plan.bip, plan.foes, viewDir()); cue('clink'); }
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
    if (e.crits ? e.crits[k] : e.crit && !k) cue('crit');
    if (!animate) return;
    const share = unit ? (e.strikes?.[k] ?? e.amount ?? 0) / unit.maxHp : 0;
    // A flash on a giant lights a lot of it: it flares less.
    const glare = target.rigid ? .4 : 1;
    const from = zf ? new pc.Vec3(plan.feet.x + Math.cos(plan.angles[k % 8]) * plan.radius, plan.feet.y, plan.feet.z + Math.sin(plan.angles[k % 8]) * plan.radius) : plan.rest;
    const dx = target.base.x - from.x, dz = target.base.z - from.z, d = Math.hypot(dx, dz) || 1;
    // A claw of it that is a golpe crítico stops the fight too; a wound it spent bursts with its first blow.
    const crit = (e.crits ? e.crits[k] : e.crit && !k) ? critBeat(e, [target], fighters.get(dualRoles(e).claws), { x: dx / d, z: dz / d }) : undefined;
    if (!k && e.bled && e.target) statusFx.spill(e.target, v3(plan.chest), { x: dx / d, z: dz / d }, e.bled);
    const landed = land({ share: last ? Math.max(share, .5) : share, skill: true, ko: last && target.hp <= 0, crit }, dx / d, 0, dz / d);
    if (zf) {
      dualFx.clawCoin({ x: from.x, y: plan.chest.y - .2, z: from.z }, v3(plan.chest), coin as 0 | 1, plan.facing, last ? 1.6 : 1);
      hit(target, coin ? flame : gold, (last ? 1 : .5) * glare);
    } else {
      dualFx.strike(v3(plan.point), plan.facing, { x: dx, y: 0, z: dz });
      hit(target, white, 1.5 * glare);
    }
    if (markSpent(e)) { dualFx.markBurst(v3(weakPoint(target)), plan.facing); if (last) cue('mark-spent'); }
    const stop = last ? Math.max(DUAL.finalStop, landed.stop) : crit ? landed.stop : Math.min(landed.stop, .05);
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
  /** The note of La Voz's song whose ring was last drawn. */
  let sungNote: string | undefined;
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
      dualFx.shock(v3(feet), 3.4, skinOf(actor.onion.shown), { chips: 140, light: true, heavy: true });
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
    if (actor?.bone) sobremesaFx(e, actor, target, view);
    if (actor?.strings) cuerdasFx(e, actor, target, view);
    // El Campeón (docs/quests/universidad.md): his Rayo from a gauntlet at whom he aimed, his Rayo total out of the grate in his chest at everyone.
    if (actor?.camp === 'campeon') {
      const grate = v3(partOf(actor, 'Rejilla'));
      if (ability === 'rayo-guantelete' && target) { dualFx.gauntlet(grate, v3(chestOf(target))); shake = Math.max(shake, .35); cue('zap'); }
      if (ability === 'rayo-total') { dualFx.furnace(grate, [...fighters.values()].filter(f => f.party && f.hp > 0).map(f => v3(chestOf(f)))); shake = Math.max(shake, .8); pulse?.(.8, .6); zoom.x = Math.max(zoom.x, HIT.punch.size); cue('roar'); }
    }
    // An Acorde on La Voz (two blows inside one note): two rings cross on her; and her Calderón, if she held one, breaks.
    if (e.chord && target?.strings) {
      const tone = state ? songNow(state)?.tone : undefined;
      dualFx.chord(v3(chestOf(target)), tone ? TONES[tone].colour : CUERDAS_COLOURS.mi, view); cue('clink');
      if (e.cancelled === 'calderon') { dualFx.after(.12, () => dualFx.fermataBreak(v3(partOf(target, 'Garganta')), view)); cue('crack', { delay: .12 }); shake = Math.max(shake, .4); pulse?.(.5, .5); }
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
  /** Where a named piece of a hand-built foe is now (its chest if it has none). */
  const partOf = (f: Fighter, name: string) => (f.model.findByName(name) as pc.Entity | null)?.getPosition().clone() ?? chestOf(f);
  /** What each of Las cuerdas leaves in when beaten, and comes together out of: its note's colour, never violet. */
  const CUERDAS_SPECKS: Record<CuerdasKind, string> = { lealtad: CUERDAS_COLOURS.la, eco: CUERDAS_COLOURS.mi, cristalino: CUERDAS_COLOURS.do, directo: CUERDAS_COLOURS.sol, voz: CUERDAS_COLOURS.string };
  /**
   * Las cuerdas' moves as they land (src/dual-fx.ts § Las cuerdas, docs/quests/marta.md): each from
   * the piece of the body that makes it (the shield's knot, the Eco's ring, the string inside the
   * glass, the lance, her throat), in the notes' colours.
   */
  /** Where a foe called in mid-fight stands from its caller: metres to its side, and towards the party. */
  const SUMMON = { side: 2, ahead: .7 } as const;
  /**
   * Aitor held crosses to the Queen's side (docs/castle-bosses.md § Aitor, held): he stands `ahead`
   * cells in front of her, towards Gerard, and `side` cells to his own side of the line, so the camera
   * sees him whole between them; the walk over (or back, freed) takes `seconds`.
   */
  const CROSS = { ahead: 1.4, side: 1.4, seconds: 1.7 } as const;
  /** Which side someone fights on now: the party's, or hers (Aitor once he is more than half way across). */
  const partySide = (f: Fighter) => f.party && !(f.cross && f.cross.t > .5);
  /**
   * Whoever the Queen holds (`held: 'reina'`) walks over to stand in front of her, turns on Gerard,
   * and from then on his blows start from there, as hers would; freed, he walks back to his place.
   * It moves their `base`, so everything that measures from it (a blow's run-up, the cats round
   * Papagato's wearer, the plate over his head) goes with him.
   */
  function crossOver(dt: number, animate: boolean) {
    const queen = [...fighters].find(([id]) => state?.foes.some(u => u.id === id && u.kind === 'reina'))?.[1];
    for (const [id, f] of fighters) {
      if (!f.party) continue;
      const hers = !!queen && state?.allies.find(a => a.id === id)?.castle?.held === 'reina';
      if (!hers && !f.cross) continue;
      if (!f.cross) {
        const { ahead, side } = axes(layout), home = f.base.clone(), q = queen!.base;
        const across = Math.sign((home.x - q.x) * side.x + (home.z - q.z) * side.z) || 1;
        f.cross = { home, away: new pc.Vec3(q.x - ahead.x * CROSS.ahead + side.x * across * CROSS.side, home.y, q.z - ahead.z * CROSS.ahead + side.z * across * CROSS.side), t: 0, hers };
      }
      const c = f.cross, step = dt / CROSS.seconds;
      c.hers = hers;
      c.t = !animate ? (hers ? 1 : 0) : hers ? Math.min(1, c.t + step) : Math.max(0, c.t - step);
      f.base.lerp(c.home, c.away, smooth(c.t));
      if (!hers && c.t === 0) { f.base.copy(c.home); f.cross = undefined; }
    }
  }
  /**
   * The last scene (docs/castle-bosses.md § The last scene), on her stage once she is down. She does
   * not come apart and keeps her size: she sags (`sink` s), bowed forward and a little to one side
   * (`bow`, `slump` degrees), imposing still but with no strength left. Gerard walks up to her
   * (`walk`), stops `near` metres from her and reaches up to take her by the neck (`reach`, his arm
   * raised as high as her neck is, between `arm` degrees), and holds it
   * (`settle`) while the two commands come up. Acabar: the Foc Binari forms in that hand (`charge`),
   * goes into her (`flight`) and she comes apart from pink to grey (`gone`). Bajar la mano: the hand
   * comes down (`lower`). The camera closes on the two of them (`lens`).
   */
  const LAST = { sink: 1.4, bow: 24, slump: 5, arm: [-96, -150] as const, walk: 1.8, near: 1.35, reach: .8, settle: .7, charge: 2.6, flight: .32, gone: 2.4, after: 1.2, lower: 1.5,
    lens: { yaw: -88, pitch: -3, zoom: .46, y: .7 }, fade: ['#ff4fa8', '#8e8a90'] as const } as const;
  let last: { stage: 'hold' | 'acabar' | 'bajar'; t: number; done: () => void; from?: pc.Vec3; to?: pc.Vec3; reach: number; angle?: number; cast?: boolean; fired?: boolean } | undefined;
  const queenOf = () => [...fighters].find(([id]) => state?.foes.some(u => u.id === id && u.kind === 'reina'))?.[1];
  /** Where Gerard's hand holds her: her neck, as low as she has sunk. */
  function neckOf(q: Fighter, toward: pc.Vec3) {
    let top = -Infinity;
    for (const r of q.model.findComponents('render') as pc.RenderComponent[]) if (r.enabled) for (const m of r.meshInstances) if (m.visible) top = Math.max(top, m.aabb.getMax().y);
    const floor = groundHeight(q.base.x, q.base.z), d = toward.clone().sub(q.base); d.y = 0;
    const along = d.length() ? d.normalize().mulScalar(.18) : d;
    return new pc.Vec3(q.base.x + along.x, Number.isFinite(top) ? floor + (top - floor) * .8 : floor + 1.5, q.base.z + along.z);
  }
  /** The last scene, frame by frame (`LAST`): Gerard's walk and hand, the Foc Binari, her going. */
  function lastFrame(dt: number, animate: boolean) {
    const l = last;
    if (!l) return;
    l.t += animate ? dt : 60;
    const g = fighters.get('gerard'), q = queenOf();
    // Played: it holds where it ended (the camera and his hand) until the next part or the fight's end.
    const end = () => { const done = l.done; l.done = () => {}; done(); };
    if (!g || !q) { last = undefined; l.done(); return; }
    // Nothing floats over them now: Matemágico's thoughts are put away (src/thoughts.ts).
    for (const f of fighters.values()) if (f.party) f.body?.children.forEach(c => { if (c.name === 'Pensamientos') c.enabled = false; });
    if (!l.from) {
      const d = q.base.clone().sub(g.base); d.y = 0;
      l.from = g.base.clone(); l.to = q.base.clone().sub(d.mulScalar(LAST.near / (d.length() || 1))); l.to.y = g.base.y;
    }
    if (l.stage === 'hold') {
      g.base.lerp(l.from, l.to!, smooth(l.t / LAST.walk));
      l.reach = smooth((l.t - LAST.walk + .2) / LAST.reach);
      // Up to her neck: as high as it is over his shoulder, from where he stands.
      if (l.angle === undefined && l.t >= LAST.walk - .2) {
        const shoulder = (g.arms[0] ?? g.model).getPosition(), neck = neckOf(q, g.base);
        const up = Math.atan2(neck.y - shoulder.y, Math.hypot(neck.x - shoulder.x, neck.z - shoulder.z)) * 180 / Math.PI;
        l.angle = Math.min(LAST.arm[0], Math.max(LAST.arm[1], -90 - up));
      }
      if (l.t >= LAST.walk + LAST.reach + LAST.settle && l.reach >= 1) end();
      return;
    }
    if (l.stage === 'bajar') {
      l.reach = 1 - smooth(l.t / LAST.lower);
      if (l.t >= LAST.lower + .5) end();
      return;
    }
    // Acabar: the circle opens at his hand and the fire gathers there, then it goes into her.
    l.reach = 1;
    const hand = g.arms[0]?.findByName('Mano') ?? g.model;
    if (!l.cast) {
      l.cast = true;
      if (animate) mathCast.start(hand, neckOf(q, g.base), { element: 'fuego', launch: LAST.charge, zero: takeZero(g.model, hand.getPosition()) });
      cue('charge');
    }
    if (!l.fired && l.t >= LAST.charge) {
      l.fired = true;
      if (animate) effects.binaryFire((mathCast.centre ?? hand.getPosition()).clone(), neckOf(q, g.base), { seconds: LAST.flight, gap: 0, burn: false, feet: floorUnder(q) });
    }
    if (l.fired && !q.dissolve && l.t >= LAST.charge + LAST.flight) {
      q.dissolve = effects.disintegrate(q.model, { own: true, fade: LAST.fade, seconds: LAST.gone });
      cue('dissolve'); shake = Math.max(shake, .5); pulse?.(.5, .5);
    }
    if (l.t >= LAST.charge + LAST.flight + LAST.gone + LAST.after) end();
  }
  /** The camera of the last scene: low and close, a little round, on Gerard and her. */
  function lastLens() {
    const g = fighters.get('gerard'), q = queenOf();
    if (!g || !q) return;
    const between = g.base.clone().lerp(g.base, q.base, .45), { yaw, pitch, zoom, y } = LAST.lens;
    Object.assign(lensWant, { yaw, pitch, zoom, x: (between.x - frame.x) * .95, y, z: (between.z - frame.z) * .95 });
  }
  /** One of La Voz's notes as it starts (VOZ_NOTES): its beam at whom it reaches, as the fight's rules have just sung it (`runSong`). */
  function voiceBeam(voz: Fighter, unit: Combatant, tone: ToneId) {
    if (!state) return;
    const note = vozNote(tone), alive = state.allies.filter(a => a.hp > 0);
    const reached = note.all ? alive : alive.filter(a => a.id === unit.facing).slice(0, 1);
    const on = (reached.length ? reached : alive.slice(0, 1)).map(a => ({ f: fighters.get(a.id), guarded: a.guarding })).filter((x): x is { f: Fighter; guarded: boolean } => !!x.f).map(x => ({ at: v3(chestOf(x.f)), guarded: x.guarded }));
    if (!on.length) return;
    const kind = note.element ?? (note.physical ? 'fisico' : 'plain');
    dualFx.voiceBeam(v3(partOf(voz, 'Garganta')), on, TONES[tone].colour, kind, viewDir(), unit.crescendo ?? 0);
    if (note.physical && on.some(x => !x.guarded)) { shake = Math.max(shake, .25); pulse?.(.25, .2); }
  }
  function cuerdasFx(e: BattleEffect, actor: Fighter, target: Fighter | undefined, view: V3) {
    const ability = e.ability?.id, kind = actor.strings!;
    const chest = target ? v3(chestOf(target)) : undefined, feet = target ? v3(floorUnder(target)) : undefined;
    const everyone = [target, ...(e.splash ?? []).map(h => fighters.get(h.target))].filter((f): f is Fighter => !!f).map(f => v3(chestOf(f)));
    const mouth = v3(partOf(actor, 'Garganta'));
    if (ability === 'juramento' && chest) dualFx.oath(v3(partOf(actor, 'Nudo')), chest, view);
    if (ability === 'lazo' && e.lazo) { const eco = fighters.get(e.lazo.target); if (eco) { dualFx.tie(v3(partOf(actor, 'Nudo')), v3(eco.base.clone().add(new pc.Vec3(0, 1.1 * eco.scale.y, 0))), e.lazo.back); cue('heal'); } }
    if (ability === 'resonancia' && chest) dualFx.resonance(v3(partOf(actor, 'Corazón del eco')), chest, 1 + Math.min(3, (state?.foes.find(u => u.id === e.actor)?.turns ?? 1) - 1));
    if (ability === 'destello' && chest) dualFx.glint(v3(partOf(actor, 'Cuerda de dentro')), chest);
    if (ability === 'estallido') { dualFx.shatter(v3(partOf(actor, 'Fuste')), everyone, view); shake = Math.max(shake, .6); pulse?.(.6, .5); cue('crack'); cue('clink', { delay: .12 }); }
    if (ability === 'prisma') { dualFx.prism(v3(partOf(actor, 'Fuste')), everyone, view); shake = Math.max(shake, .3); cue('zap'); }
    if (ability === 'golpe-directo' && chest) dualFx.straight(kind === 'voz' ? mouth : v3(chestOf(actor)), chest, kind === 'voz' ? CUERDAS_COLOURS.mi : CUERDAS_COLOURS.sol);
    if (ability === 'en-linea') { dualFx.through(v3(partOf(actor, 'Lanza')), everyone); shake = Math.max(shake, .4); pulse?.(.4, .3); }
    if (ability === 'estocada' && chest && feet) { dualFx.lunge(v3(chestOf(actor)), chest, feet); shake = Math.max(shake, .7); pulse?.(.7, .5); zoom.x = Math.max(zoom.x, HIT.punch.size); }
    if (ability === 'coro' && e.summoned) { const second = fighters.get(e.summoned); if (second) { dualFx.choir(mouth, v3(second.base.clone().add(new pc.Vec3(0, 1.1 * second.scale.y, 0))), view); cue('charge'); } }
    if (ability === 'aliento') { dualFx.inhale(mouth, view); pulse?.(.3, .5); cue('charge'); }
    if (ability === 'calderon') {
      if (e.cancelled) cue('fizzle');
      else { dualFx.fermata(mouth, everyone, view); shake = Math.max(shake, .8); pulse?.(.8, .6); zoom.x = Math.max(zoom.x, HIT.punch.size); cue('roar'); }
    }
  }
  /**
   * La Sobremesa's moves as they land (src/dual-fx.ts § La Sobremesa): Álvaro's dice, Anna's lunge,
   * Sarah's chalk rule, Miquel's black card (hung over whom it marks, then falling), Joan's note on
   * everyone, Soraya's correction, Nico's lattice. Each friend acts from their own place on the body.
   */
  function sobremesaFx(e: BattleEffect, actor: Fighter, target: Fighter | undefined, view: V3) {
    const at = (f: Fighter) => f.bone ? f.model.getPosition().clone() : chestOf(f);
    const friend = (id: string) => { const f = fighters.get(id); return f?.bone ? f : undefined; };
    const ability = e.ability?.id, from = v3(at(actor));
    const feet = target ? v3(floorUnder(target)) : undefined, chest = target ? v3(chestOf(target)) : undefined;
    if (e.telegraph && (e.telegraph.id === 'carta-negra' || e.telegraph.id === 'duo-regla')) {
      const marked = e.telegraph.target ? fighters.get(e.telegraph.target) : undefined;
      if (marked) { dualFx.cardMark(v3(chestOf(marked).add(new pc.Vec3(0, .9, 0))), v3(floorUnder(marked)), view); cue('creak'); }
    }
    if (e.cancelled && e.amount === undefined) return;
    if ((ability === 'tirada' || ability === 'duo-tirada') && chest && feet && e.dice) {
      const anna = ability === 'duo-tirada' ? friend('anna') : undefined;
      dualFx.dice(from, chest, feet, anna ? 2 : e.dice.length);
      if (anna) dualFx.dice(v3(at(anna)), chest, feet, 2);
      dualFx.after(.34, () => cue('clink'));
      if (ability === 'duo-tirada') { shake = Math.max(shake, .4); pulse?.(.4, .3); }
    }
    if (ability === 'sopeta' && chest && feet) {
      const fed = (e.soothed ?? []).map(h => friend(h.target)).filter((f): f is Fighter => !!f).map(f => v3(at(f)));
      dualFx.soup(from, chest, feet, fed); cue('splash', { delay: .7 }); dualFx.after(.75, () => cue('heal'));
    }
    if (ability === 'regla-nueva' || (ability === 'duo-regla' && !e.target)) {
      const raised = ability === 'duo-regla' ? [...fighters.values()].filter(f => f.bone && f.hp > 0) : (e.stats ?? []).filter(s => s.way === 'up').map(s => fighters.get(s.target)).filter((f): f is Fighter => !!f);
      if (raised.length) { dualFx.rule(raised.map(f => v3(at(f))), view); cue('stat-up'); }
    }
    if ((ability === 'carta-negra' || (ability === 'duo-regla' && e.target)) && chest && feet) {
      const heavy = ability === 'duo-regla' && !state?.allies.find(a => a.id === e.target)?.guarding;
      dualFx.cardFall(chest, feet, heavy); cue('slam', { delay: .15 });
      if (heavy) { dualFx.after(.18, () => { shake = Math.max(shake, .6); pulse?.(.6, .4); }); }
    }
    if (ability === 'escala') {
      const sung = [target, ...(e.splash ?? []).map(h => fighters.get(h.target))].filter((f): f is Fighter => !!f);
      const note = Math.max(0, (state?.foes.find(f => f.id === 'joan')?.note ?? 1) - 1);
      dualFx.note(from, sung.map(f => v3(chestOf(f))), note, view); cue('charge');
      shake = Math.max(shake, .15 + note * .05);
    }
    if (ability === 'correccion') { const joan = friend('joan'); if (joan) { dualFx.correct(from, v3(at(joan)), view); cue('zap'); } }
    if (ability === 'cortafuegos' && e.shielded) { const shielded = fighters.get(e.shielded); if (shielded) { dualFx.firewall(v3(at(shielded)), view); cue('mana'); } }
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
  /** Where one of the party stands now, for what stays at their feet (Yuki's silhouettes); nothing once they are down. */
  const livesFeet = (id: string) => { const f = fighters.get(id); return f && f.hp > 0 ? v3(floorUnder(f)) : undefined; };
  /** Cegado: a blinded foe's blow that missed whoever it was aimed at (`BattleEffect.missed`). */
  const whiffed = (action?: BattleEffect) => !!action && action.kind === 'enemy' && !!action.target && !!action.missed?.includes(action.target);
  /** Which side a blinded foe swings wide on: fixed for each foe, not the same for all of them. */
  const whiffSide = (id: string) => ([...id].reduce((sum, c) => sum + c.charCodeAt(0), 0) % 2 ? 1 : -1);
  /**
   * The swing that found nothing: the smoke round its head is torn off along the blow and goes on past
   * them, on the side it went wide (`whiffSide`), with a swish and no impact.
   */
  function whiffBurst(action: BattleEffect, actor: Fighter, target: Fighter) {
    const dx = target.base.x - actor.base.x, dz = target.base.z - actor.base.z, d = Math.hypot(dx, dz) || 1, ux = dx / d, uz = dz / d, side = whiffSide(action.actor);
    const chest = chestOf(target), wide = extent(target).radius + .45;
    statusFx.miss(action.actor, v3(new pc.Vec3(chest.x - uz * side * wide, chest.y, chest.z + ux * side * wide)), { x: ux, z: uz });
    cue('gust');
  }
  /**
   * One-shot contact feedback: a flash and sparks where the blow lands, a ring and dust at the feet,
   * a flash on whoever is affected. Returns how a blow lands (hit-feel.ts); support skills only glow.
   */
  /** The newer duals' lasting looks answer any blow as it lands, a blow the dome stopped whole too (src/duo-fx `struck`). */
  function duoStruck(action: BattleEffect, target?: Fighter) {
    if (!dualFx.on || !Object.values(DUO_STAGINGS).some(own => own?.struck)) return;
    const stage = duoStage(action), reached = duoReached(action, target).map(id => stage.fighter(id)).filter((f): f is DuoFighter => !!f);
    for (const own of Object.values(DUO_STAGINGS)) own?.struck?.(stage, action, reached);
  }
  function contactBurst(action: BattleEffect, actor?: Fighter, target?: Fighter) {
    if (!actor || action.kind === 'escape') return;
    // Cegado: the blow goes past whoever it was meant for (`whiffed`): no impact, only the swing and the smoke it drags.
    if (target && whiffed(action)) return whiffBurst(action, actor, target);
    duoStruck(action, target);
    // Acompañamiento: the eco at this fighter's side repeats the blow a moment after it lands.
    const repeat = action.accompanied;
    if (repeat) dualFx.after(.45, () => { ecos()?.sound(repeat.eco, repeat.hits.map(h => h.target), true); for (const h of repeat.hits) { const f = fighters.get(h.target); if (f && h.amount) hit(f, white, .4); } });
    // Siete vidas going off on this blow: the fight stops on it, and whoever it saved flares with the cure.
    if (action.lives) livesBeat(action);
    // Vertitrón's shout, its charge, and news of its eye breaking draw their own picture (`worldFx`).
    if (actor.robot && !target) return;
    // Rayo solar charging up: Gerard's fire streams into Bip.
    const dual = action.dual;
    // The duals of other ánimas and their blasts: what they draw was set going as they started
    // (`startDuo`); here, how they land.
    if (action.detonation) {
      const orbital = action.detonation === 'bombardeo-orbital';
      for (const h of action.hits ?? []) {
        const f = fighters.get(h.target);
        if (!f) continue;
        hit(f, orbital ? white : flame, (orbital ? 1.8 : 1.5) * (f.rigid ? .4 : 1));
        if (!orbital) {
          dualFx.paintBlast(v3(chestOf(f)), v3(floorUnder(f)), viewDir(), h.target === action.target);
          // The powder's fire as a fireball on whoever the fuse was on (a fluid).
          if (h.target === action.target) fluidFx.fireball(v3(chestOf(f)), .8, .8);
          effects.element('fire', v3(chestOf(f)), { strength: h.target === action.target ? 1.4 : 1 });
        }
      }
      pulse?.(1, 1, orbital ? .6 : .25); zoom.x = Math.max(zoom.x, HIT.punch.size * 1.8); shake = Math.max(shake, orbital ? .55 : .45);
      cue(orbital ? 'crack' : 'fire-hit');
      return;
    }
    if (dual?.id === 'bombardeo-orbital') { pulse?.(.2, .5); return; }
    // The newer duals: their own looks (src/duo-fx) answer their blow as it lands.
    const own = dual && DUO_STAGINGS[dual.id];
    if (own && dual) {
      const stage = duoStage(action), reached = duoReached(action, target).map(id => stage.fighter(id)).filter((f): f is DuoFighter => !!f);
      if (own.land) own.land(stage, action, reached);
      else { pulse?.(.4, .8, .25); zoom.x = Math.max(zoom.x, HIT.punch.size * 1.4); shake = Math.max(shake, .4); }
      return;
    }
    if (dual?.id === 'vulcano' || dual?.id === 'sobrecalentamiento') { pulse?.(.9, 1, .3); zoom.x = Math.max(zoom.x, HIT.punch.size * 1.4); shake = Math.max(shake, .6); return; }
    if (target && dual?.id === 'sutura-de-luz') {
      hit(target, gold, .9); pulse?.(.3, .6); zoom.x = Math.max(zoom.x, HIT.punch.size * .8);
      effects.heal(floorUnder(target)); cue('heal'); return;
    }
    if (target && dual?.id === 'relevo-de-sangre') {
      const from = catsOf(dualRoles(action).claws)?.haru.entity.getPosition() ?? actor.base;
      const dx = target.base.x - from.x, dz = target.base.z - from.z, d = Math.hypot(dx, dz) || 1;
      const crit = action.crit ? critBeat(action, [target], actor, { x: dx / d, z: dz / d }) : undefined;
      if (action.bled && action.target) statusFx.spill(action.target, v3(chestOf(target)), { x: dx / d, z: dz / d }, action.bled);
      hit(target, clawFlash, 1.1 * (target.rigid ? .4 : 1));
      const unit = state && [...state.allies, ...state.foes].find(u => u.id === action.target);
      const landed = land({ share: Math.max(.5, unit ? (action.amount ?? 0) / unit.maxHp : 0), skill: true, ko: target.hp <= 0, crit }, dx / d, 0, dz / d);
      pulse?.(1, 1); shake = Math.max(shake, .35);
      cue('claw-deep'); if (crit) cue('crit');
      return landed;
    }
    if (target && dual?.id === 'reserva-de-color') { hit(target, flame, 1.2); pulse?.(.4, .8); shake = Math.max(shake, .2); cue('fire-hit'); return; }
    // Colorista's skills thrown from afar: each its own powder (src/powder-fx.ts).
    if (action.skill === 'polvareda' && action.hits) { powderFx.nube(action.actor, action.hits.map(h => h.target), action.hits.map(() => nextMix())); pulse?.(.05, .3); return; }
    if (action.skill === 'rociada' && action.hits) { cue('splash'); return; }
    if (action.skill === 'traca' && action.volley?.[0]) { powderFx.pop(action.volley[0].target, nextMix()); const f = fighters.get(action.volley[0].target); if (f) hit(f, white, .5); shake = Math.max(shake, .1); return; }
    if (action.skill === 'fin-de-fiesta') { for (const h of action.hits ?? []) { const f = fighters.get(h.target); if (f) hit(f, flame, 1.2); } pulse?.(.5, .9, .3); zoom.x = Math.max(zoom.x, HIT.punch.size * 1.2); shake = Math.max(shake, .55); return; }
    if (action.skill === 'cortina' || action.skill === 'telon') { hit(actor, white, .4); pulse?.(0, .25); return; }
    if (target && action.skill === 'punado') {
      // Puñado: a handful thrown, which bursts on them and leaves them covered.
      if (action.actor && action.target) powderFx.lanzar(action.actor, action.target, nextMix(), 0, .14);
      cue('hit'); return;
    }
    if (action.skill === 'ostinato' || action.skill === 'bordon' || action.skill === 'acompanamiento' || action.skill === 'crescendo' || action.skill === 'tutti' || action.skill === 'da-capo') { sincopanteBurst(action, target); return; }
    if (action.charging) { chargeUp(action); return; }
    // Acecho: nothing lands yet. Haru is sinking into the dark (`updateCats`).
    if (action.stalking) return;
    // Cacería and Siete vidas: the first claw here, the others as they come (`huntClaw`).
    if (action.hunt?.length) return huntClaw(action, 0);
    // A golpe crítico, on whoever it struck (a flurry's first claw here; the others as they land).
    const struck = action.hits ? action.hits.flatMap(h => { const f = h.crit ? fighters.get(h.target) : undefined; return f ? [f] : []; }) : target ? [target] : [];
    const towards = struck[0] ?? target, cx = towards ? towards.base.x - actor.base.x : 0, cz = towards ? towards.base.z - actor.base.z : 0, cd = Math.hypot(cx, cz) || 1;
    const crit = action.crit && action.crits?.[0] !== false && struck.length ? critBeat(action, struck, actor, { x: cx / cd, z: cz / cd }) : undefined;
    // Dadista's skills from the sky land their own way (`skyStep` brings them down).
    if (skyOf(action)) return skyBurst(action, actor, target);
    if (!target) { hit(actor, gold, .55); effects.emit('star', new pc.Vec3(actor.base.x, 1.3, actor.base.z), 8, .35); return; }
    // Análisis Parálisis: Gerard works it out in a flash of gold; the stats rising are the rest (effect.stats).
    // ∂Q/∂t Condensador: the charge went into him with the figure (src/math-figures.ts); its look stays on him (Cargado).
    if (action.skill === 'condensador') { pulse?.(.25, .3); return; }
    // Superficie mínima: the film settles round them (src/film-fx.ts); a soft flash of water light.
    if (action.skill === 'superficie-minima') { pulse?.(0, .25); hit(target, ELEMENT_FLASH.agua, .55); return; }
    if (action.skill === 'analisis') { pulse?.(.1, .3); hit(actor, gold, 1.1); effects.insight(new pc.Vec3(actor.base.x, groundHeight(actor.base.x, actor.base.z) + 2.1 * actor.scale.y, actor.base.z)); return; }
    // Cardioide: a heart-shaped curve of green light under whoever it cures, and the cure rising up them.
    if (action.skill === 'cardioide') { pulse?.(0, .3); hit(target, green, 1); effects.cardioid(target.model); return; }
    if (action.skill === 'integral') {
      // Integral impropia: its jets reach each one it cures (src/math-figures.ts); the cure rises up them.
      const party = (action.cures ?? []).flatMap(c => { const f = fighters.get(c.target); return f ? [f] : []; });
      party.forEach((f, i) => dualFx.after(i * .06, () => { hit(f, green, 1); effects.fightFx('heal', { model: f.model }); }));
      pulse?.(0, .35);
      return;
    }
    // Dadista: the face of the die draws itself where it lands (src/dice-fx.ts).
    if (action.die?.as) {
      // Tijeras cut: the blood goes the way the die came.
      if (action.status?.id === 'sangrado' && action.target) statusFx.cut(action.target, v3(chestOf(target)), { x: cx / cd, z: cz / cd }, 2);
      return dieBurst(action, actor, target);
    }
    const guarded = state?.allies.find(a => a.id === action.target)?.guarding ?? false;
    const unit = state && [...state.allies, ...state.foes].find(u => u.id === action.target);
    const felt: Blow = { share: unit ? (action.amount ?? 0) / unit.maxHp : 0, skill: !!action.skill, guarded, ko: target.hp <= 0, swallowed: action.swallowed, beat: state?.phase === 'beat', crit };
    // Bip's ram comes from where Bip is, not from its wearer; Acecho's pounce from behind the prey.
    // Arco voltaico's comes down the arch's axis, from the side the cat ran up.
    const arc = action.pounceDual ? arcs.get(action) : undefined;
    const from = botAt(action) ?? (arc ? new pc.Vec3(target.base.x - arc.dir.x * arc.reach, 0, target.base.z - arc.dir.z * arc.reach) : action.pounce ? pounceFrom(action, target) : actor.base);
    // Acecho lands hard: a heavier blow, the picture shakes and leans in.
    if (action.pounce) { shake = Math.max(shake, .75); zoom.x = Math.max(zoom.x, CRIT.punch * 1.6); cue('claw-deep'); cue('slam', { delay: .02 }); }
    const dx = target.base.x - from.x, dz = target.base.z - from.z, d = Math.hypot(dx, dz) || 1;
    // Tecnópata's skills: Bip's rays, its blast, Rayo solar's sweep.
    if (botStrikes(action) && action.kind === 'skill') return bipBurst(action, target, from, felt, dx / d, dz / d);
    // Estrella fugaz: the die it was paid with goes out on them as a star (src/dice-fx.ts), and the dice
    // it deals leave the foe as stars for the hand. The astral: bluish white, no element's colour.
    if (action.skill === 'estrella-fugaz') {
      const { right, up, facing } = screenAxes(viewDir()), body = extent(target), mid = chestOf(target), front = body.radius * .6 + .2;
      const hand = new pc.Vec3(actor.base.x, groundHeight(actor.base.x, actor.base.z) + 1.5 * actor.scale.y, actor.base.z);
      diceFx.star({ centre: { x: mid.x + facing.x * front, y: mid.y + facing.y * front, z: mid.z + facing.z * front }, feet: floorUnder(target), right, up, size: Math.min(1.6, Math.max(1, body.height * .7)), side: 1, radius: body.radius }, action.dealt?.length ?? 0, hand);
      pulse?.(.12, .5);
      hit(target, astral, 1.3);
      return land(felt, dx / d, 0, dz / d);
    }
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
    // Serie de Fourier: its first circle closes into a beam (the figure's); the others land as they come (`fourierStrike`).
    if (action.skill === 'fourier') {
      const colour = fourierFigures.get(action)?.strike(0, v3(chestOf(target)));
      if ((action.strikes?.length ?? 1) <= 1) fourierFigures.get(action)?.finish();
      hit(target, colour ? new pc.Color().fromString(colour) : gold, 1.1);
      const many = (action.strikes?.length ?? 1) > 1, landed = land(many && unit ? { ...felt, share: action.strikes![0] / unit.maxHp, ko: false } : felt, dx / d, 0, dz / d);
      return many ? { ...landed, stop: Math.min(landed.stop, .03) } : landed;
    }
    // Matemágico's elements: their own pictures (the streams and comets left his circle in `castElement`).
    if (action.skill && ELEMENTAL.has(action.skill)) { elementBurst(action, target); return land(felt, dx / d, 0, dz / d); }
    // Atractor extraño: the butterfly has fallen into the chest (its flash is the figure's); the foe takes it whole.
    if (action.skill === 'atractor') { hit(target, gold, 1.5); shake = Math.max(shake, .5); pulse?.(.32, .35); gatherFx(action); return land(felt, dx / d, 0, dz / d); }
    const reach = target.party ? .15 : .6;
    // On Vertitrón's eye, the blow lands on the eye, just in front of it; on Gerard or Aitor, on the
    // middle of the body (their heads are big: higher, it reads as a blow over them).
    const blow = target.part ? chestOf(target).add(new pc.Vec3(-dx / d * .35, 0, -dz / d * .35))
      : new pc.Vec3(target.base.x - dx / d * reach, groundHeight(target.base.x, target.base.z) + (target.party ? .6 : target.minion ? .9 : .85) * target.scale.y, target.base.z - dz / d * reach);
    // Zarpazo sangriento: Haru's claws leave three white-coral lines across their body, in front of it,
    // as big as they stand; the blow under them stays small and takes their colour, so the claws are what reads.
    const claw = action.skill === 'zarpazo' || (action.skill === 'acecho' && !!action.pounce);
    // Gum is the Queen's: a fear's own stuff does not splash pink, and an onion only sheds its skin.
    effects.impact(blow, from, claw ? .3 : action.skill ? 1.4 : 1, { guarded, gum: target.minion && !target.onion && !target.camp && !target.strings && !target.mesh, feet: floorUnder(target), ...action.spell ? { colour: spellColour(action.element) } : claw ? { colour: CLAW_COLOURS[0] } : {} });
    if (claw) {
      const { right, up, facing } = screenAxes(viewDir()), body = extent(target), front = body.radius * .6 + .15;
      const at = target.part ? chestOf(target) : new pc.Vec3(target.base.x, groundHeight(target.base.x, target.base.z) + body.height * .5, target.base.z);
      effects.claw({ x: at.x + facing.x * front, y: at.y + facing.y * front, z: at.z + facing.z * front }, { right, up }, Math.min(2.2, Math.max(1.25, body.height * .9)));
    }
    // Atacar with an element: a little burst of it where it lands, and the flash takes its colour.
    if (action.element) statusFx.touch(action.element, action.target!);
    // Blood (src/status-fx.ts): a cut flings it along the blow; a blow that spends the wound bursts it,
    // as much as there was. It falls behind them, on the floor and on whoever stands there.
    if (action.target && action.bled) statusFx.spill(action.target, v3(blow), { x: dx / d, z: dz / d }, action.bled);
    else if (action.target && action.status?.id === 'sangrado') statusFx.cut(action.target, v3(blow), { x: dx / d, z: dz / d }, 2);
    hit(target, action.element ? ELEMENT_FLASH[action.element] : action.spell ? gold : claw ? clawFlash : white, action.bled ? 1.4 : guarded ? .4 : claw ? .7 : 1);
    return land(felt, dx / d, 0, dz / d);
  }
  /**
   * Where Haru comes out of the dark for Acecho's pounce: on the floor beyond the prey from whoever wears
   * her, turned towards the camera's side so her face (and her red eyes) is seen past the prey. Worked out
   * once for each pounce.
   */
  const pounceSpots = new WeakMap<BattleEffect, pc.Vec3>();
  /** Arco voltaico's arch for each pounce of it, from where the cat waited (src/duo-fx/arco-voltaico.ts `arcGeometry`): worked out once. */
  const arcs = new WeakMap<BattleEffect, ReturnType<typeof arcGeometry>>();
  /** Where Haru is, handed to the duals' looks (`DuoStage.cat`): the same object each time, read at once. */
  const catAt = { x: 0, y: 0, z: 0 };
  /** Arco voltaico's pounce pose, written each frame (`arcRun`), and its rest spot on the floor. */
  const arcPose: ArcPose = { at: { x: 0, y: 0, z: 0 }, lift: 0, crouch: 0 }, arcRest = { x: 0, y: 0, z: 0 };
  /** The arch the figure drew over this prey (one source, `arcFor`), or, if she goes for another, the same one it will draw. */
  function arcOf(action: BattleEffect, rest: pc.Vec3, prey: Fighter) {
    let g = arcs.get(action);
    if (g) return g;
    g = arcFor(action.actor, action.target ?? '', () => {
      const body = extent(prey);
      return arcGeometry({ x: rest.x, y: groundHeight(rest.x, rest.z), z: rest.z }, { chest: v3(chestOf(prey)), feet: v3(floorUnder(prey)), radius: Math.max(.25, body.radius), height: body.height }, screenAxes(viewDir()).facing);
    });
    arcs.set(action, g);
    return g;
  }
  function pounceFrom(action: BattleEffect, prey: Fighter) {
    let spot = pounceSpots.get(action);
    if (spot) return spot;
    const wearer = fighters.get(action.actor)?.base ?? prey.base, view = viewDir();
    let ax = prey.base.x - wearer.x, az = prey.base.z - wearer.z;
    const d = Math.hypot(ax, az) || 1; ax /= d; az /= d;
    // The camera's side, across the line from the wearer to the prey.
    const vl = Math.hypot(view.x, view.z) || 1, vx = view.x / vl, vz = view.z / vl, along = vx * ax + vz * az;
    let dx = ax + (vx - ax * along) * 1.1, dz = az + (vz - az * along) * 1.1;
    const dl = Math.hypot(dx, dz) || 1; dx /= dl; dz /= dl;
    const r = Math.max(.6, extent(prey).radius + .5);
    spot = new pc.Vec3(prey.base.x + dx * r, 0, prey.base.z + dz * r);
    pounceSpots.set(action, spot);
    return spot;
  }
  /** Things a choreography sets off once at a moment of its own (the dark welling up, the eyes lighting): `key` once per action. */
  const fired = new WeakMap<BattleEffect, Set<string>>();
  function once(action: BattleEffect, key: string, then: () => void) {
    let done = fired.get(action);
    if (!done) fired.set(action, done = new Set());
    if (done.has(key)) return;
    done.add(key); then();
  }
  /** The dark Haru sinks into or comes out of, pooled on the floor at `at`. */
  function umbra(at: pc.Vec3, count: number, spread = .4) {
    const floor = groundHeight(at.x, at.z);
    effects.emit('umbra', new pc.Vec3(at.x, floor + .12, at.z), count, spread);
    effects.emit('umbra', new pc.Vec3(at.x, floor + .3, at.z), Math.round(count / 2), spread * .7);
  }
  /**
   * One of Papagato's claws one after another (Cacería, Siete vidas), `k` in `hunt`: three lines across
   * the foe it found, from the cat that took it (Cacería's odd claws are Yuki's). The first on each foe
   * bursts what its wound held (Cacería) or opens a new one (Siete vidas); a golpe crítico stops the
   * fight, the first for longest. The first claw lands as the action does: it returns how it felt.
   */
  function huntClaw(action: BattleEffect, k: number) {
    const claw = action.hunt?.[k], f = claw ? fighters.get(claw.target) : undefined;
    if (!claw || !f) return;
    const pair = catsOf(action.actor), cat = action.skill === 'caceria' && k % 2 ? pair?.yuki : pair?.haru;
    const from = cat?.entity.enabled ? cat.entity.getPosition() : fighters.get(action.actor)?.base ?? f.base;
    const dx = f.base.x - from.x, dz = f.base.z - from.z, d = Math.hypot(dx, dz) || 1;
    const { right, up, facing } = screenAxes(viewDir()), body = extent(f), front = body.radius * .6 + .15;
    const at = f.part ? chestOf(f) : new pc.Vec3(f.base.x, groundHeight(f.base.x, f.base.z) + body.height * .5, f.base.z);
    effects.claw({ x: at.x + facing.x * front, y: at.y + facing.y * front, z: at.z + facing.z * front }, { right, up }, Math.min(2, Math.max(1.1, body.height * .8)));
    const first = action.hunt!.findIndex(c => c.target === claw.target) === k, h = action.hits?.find(x => x.target === claw.target);
    if (first && h?.drained) statusFx.spill(claw.target, v3(at), { x: dx / d, z: dz / d }, h.drained);
    else if (h?.status?.id === 'sangrado') statusFx.cut(claw.target, v3(at), { x: dx / d, z: dz / d }, first ? 2 : 1);
    hit(f, claw.crit ? white : clawFlash, (first ? 1 : .7) * (f.rigid ? .4 : 1));
    if (k) cue('claw');
    const crit = claw.crit ? critBeat(action, [f], fighters.get(action.actor), { x: dx / d, z: dz / d }) : undefined;
    if (crit && k) cue('crit');
    if (k) { shake = Math.max(shake, crit ? .3 : .12); return; }
    const unit = state?.foes.find(u => u.id === claw.target);
    return land({ share: unit ? claw.amount / unit.maxHp : 0, skill: true, ko: f.hp <= 0, crit }, dx / d, 0, dz / d);
  }
  /**
   * Siete vidas going off (docs/animas/papagato/README.md § Definitiva): the golpe crítico's freeze the
   * other way round. The fight stops on the blow that would have killed, the picture drains but round
   * whoever it saved, and they flare green with the cure rising up them, a ring of Yuki's white in front.
   */
  function livesBeat(action: BattleEffect) {
    const f = fighters.get(action.lives!.target);
    if (!f) return;
    const chest = chestOf(f), feet = floorUnder(f);
    // The blow lands and is played back into them, Yuki's thread rising off the wound; her silhouette leaps in front.
    const from = fighters.get(action.actor)?.base, dx = from ? f.base.x - from.x : 0, dz = from ? f.base.z - from.z : 1, d = Math.hypot(dx, dz) || 1;
    livesFx.save(action.lives!.target, v3(chest), { x: dx / d, z: dz / d }, livesFeet);
    hit(f, green, 2.2);
    effects.heal(feet);
    dualFx.ring(v3(chest), viewDir(), .45, '#f6f0e2', { count: 110, outward: 3.4, life: .5, size: 1.7, light: 2.5 });
    dualFx.ring(v3(feet), { x: 0, y: 1, z: 0 }, .7, '#a6f2bd', { count: 70, around: 1.4, life: .9, size: 1.5 });
    pulse?.(.4, 1, CRIT.flash);
    clock.hold = Math.max(clock.hold, CRIT.stop * 1.6);
    critOf = action; critGrey = 1; critHeld = CRIT.stop * 1.6; critKeep = [f];
    zoom.x = Math.max(zoom.x, CRIT.punch);
    cue('siete-vidas-salva');
  }
  /**
   * Bajo cero's cells locking (docs/animas/freatica/README.md § Definitiva): a hit-stop of 0.2 s, a punch in, a white
   * bloom and the picture gone cold, coming back in steps (a few looks, not one a frame: each costs the grade a new table).
   */
  function coldBeat() {
    clock.hold = Math.max(clock.hold, .2);
    zoom.x = Math.max(zoom.x, CRIT.punch * 1.2); shake = Math.max(shake, .3);
    pulse?.(.25, 1, .35);
    cold = .5; setCold?.(cold);
    [.45, .9, 1.4, 1.9].forEach((t, i) => dualFx.after(t, () => { if (cold > 0) { cold = [.35, .2, .08, 0][i]; setCold?.(cold); } }));
  }
  /** Where something of Dadista's lands on `f`: just in front of them, facing the camera, as big as they stand. */
  function spotOf(f: Fighter, side = 1): FaceSpot {
    const { right, up, facing } = screenAxes(viewDir()), body = extent(f);
    const mid = f.part ? chestOf(f) : new pc.Vec3(f.base.x, groundHeight(f.base.x, f.base.z) + body.height * .55, f.base.z), front = body.radius * .6 + .2;
    return { centre: { x: mid.x + facing.x * front, y: mid.y + facing.y * front, z: mid.z + facing.z * front }, feet: floorUnder(f), right, up, size: Math.min(1.6, Math.max(1, body.height * .7)), side, radius: body.radius };
  }
  /** Whom a sky skill comes down on, in order: each die of the rain, every foe of the Asteroide, the party for Ases en dúo, or its one target. */
  function skyTargets(action: BattleEffect, target?: Fighter): Fighter[] {
    const ids = action.rain?.map(drop => drop.target) ?? action.boosted ?? action.hits?.map(h => h.target);
    return ids ? ids.flatMap(id => { const f = fighters.get(id); return f ? [f] : []; }) : target ? [target] : [];
  }
  /** Over the heads of the party's fighters named: where Ases en dúo's two dice circle. */
  function over(list: Fighter[]) {
    const at = new pc.Vec3();
    for (const f of list) at.add(new pc.Vec3(f.base.x, groundHeight(f.base.x, f.base.z) + 2.5 * f.scale.y, f.base.z));
    return at.mulScalar(1 / Math.max(1, list.length));
  }
  /**
   * A sky skill before and after it lands: what falls starts `fall` before its contact, and the rain's
   * other dice land one after another, each telling the fight screen (its own number and PV).
   */
  function skyStep(action: BattleEffect, actor: Fighter, target: Fighter | undefined, t: number, animate: boolean) {
    const spec = skyOf(action);
    if (!spec) return;
    if (sky?.effect !== action) sky = { effect: action, fell: 0, landed: 0 };
    const list = skyTargets(action, target), stage = stageOf(action);
    if (action.rain) {
      const gap = rainGap(action.rain.length);
      for (; sky.fell < list.length && t >= spec.contact + sky.fell * gap - spec.fall; sky.fell++) if (animate) diceFx.skyFall(spotOf(list[sky.fell]), spec.fall, .8);
      // The first lands with the action's contact (`skyBurst`); the rest here.
      for (sky.landed = Math.max(1, sky.landed); sky.landed < list.length && (!animate || t >= spec.contact + sky.landed * gap) && impacted; sky.landed++) {
        impact?.(sky.landed);
        if (!animate) continue;
        const f = list[sky.landed];
        diceFx.skyLand(spotOf(f)); hit(f, astral, .9); cue('mana');
        shake = Math.max(shake, .08); nightLift = Math.max(nightLift, .5);
      }
      return;
    }
    if (sky.fell || !animate || t < spec.contact - spec.fall) return;
    sky.fell = 1;
    if (action.skill === 'ases-en-duo') { const { right, up } = screenAxes(viewDir()); diceFx.aces(v3(over(list.length ? list : [actor])), right, up, spec.fall); return; }
    // The Asteroide is one rock for all of them: it comes down in their middle, and its shadow is there before it.
    if (stage === 2) {
      const mid = new pc.Vec3(); list.forEach(f => mid.add(f.base)); mid.mulScalar(1 / Math.max(1, list.length));
      const first = spotOf(list[0] ?? actor), feet = { x: mid.x, y: groundHeight(mid.x, mid.z), z: mid.z };
      diceFx.skyFall({ ...first, centre: { ...feet, y: feet.y + .9 }, feet, size: 1.6 }, spec.fall, 2.2);
      return;
    }
    if (target) diceFx.skyFall(spotOf(target), spec.fall, stage ? 1.5 : .9);
  }
  /** A sky skill landing: the rain's first die, the shower of Ases en dúo on each of the party, a rock of light on whom it reaches. */
  function skyBurst(action: BattleEffect, actor: Fighter, target?: Fighter) {
    const list = skyTargets(action, target), stage = stageOf(action);
    if (action.rain) {
      const f = list[0];
      if (f) { diceFx.skyLand(spotOf(f)); hit(f, astral, 1); }
      nightLift = Math.max(nightLift, .5); pulse?.(.06, .35); shake = Math.max(shake, .1);
      return;
    }
    if (action.skill === 'ases-en-duo') {
      const top = v3(over(list.length ? list : [actor]));
      for (const f of list) { diceFx.shower(spotOf(f), top); dualFx.after(.3, () => hit(f, astral, .9)); }
      pulse?.(0, .4);
      return;
    }
    if (stage === undefined || !list.length) return;
    list.forEach(f => { diceFx.meteorLand(spotOf(f), stage); hit(f, astral, 1.2 + stage * .3); });
    nightLift = Math.max(nightLift, .7 + stage * .15);
    pulse?.(.1 + stage * .12, .5 + stage * .25, stage === 2 ? .3 : 0);
    shake = Math.max(shake, .18 + stage * .2); zoom.x = Math.max(zoom.x, HIT.punch.size * (1 + stage * .5));
    const first = list[0], firstId = action.hits?.[0]?.target ?? action.target, unit = state && [...state.allies, ...state.foes].find(u => u.id === firstId);
    const total = action.hits ? Math.max(...action.hits.map(h => h.amount)) : action.amount ?? 0;
    const felt: Blow = { share: unit ? total / unit.maxHp : 0, skill: true, guarded: false, ko: first.hp <= 0, beat: state?.phase === 'beat' };
    const dx = first.base.x - actor.base.x, dz = first.base.z - actor.base.z, d = Math.hypot(dx, dz) || 1;
    const landed = land(felt, dx / d, -.4, dz / d);
    // The fight stops a quarter of a second under the Asteroide.
    return stage === 2 ? { ...landed, stop: Math.max(landed.stop, .25) } : landed;
  }
  /**
   * The meteor that has grown stays up there: a rock of light turning slowly over its wearer's head,
   * twice a die for Meteoro and larger for Asteroide. It is the one that comes down when the skill
   * is used again, and it comes apart into stars when the turn goes on anything else.
   */
  function updateRocks(dt: number, animate: boolean) {
    if (!state) return;
    for (const [id, f] of fighters) {
      if (!f.party) continue;
      const unit = state.allies.find(a => a.id === id);
      let rock = rocks.get(id), stage = unit && f.hp > 0 ? meteorOf(unit) : 0;
      // While its own throw is in the air the state is already ahead: the rock overhead is the one falling, and the next comes after it lands.
      const spec = effect?.actor === id ? skyOf(effect) : undefined, mine = spec && stageOf(effect!);
      if (spec && mine !== undefined) stage = effectTime >= spec.contact + .25 ? stage : effectTime < spec.contact - spec.fall ? mine : 0;
      if (!rock && !stage) continue;
      if (!rock) { rock = { kept: stamps.keepCrystal(), size: 0, turn: Math.random() * 360 }; rocks.set(id, rock); }
      const want = stage ? DIE.size * f.scale.y * (stage === 1 ? 1.5 : 2.3) : 0, at = new pc.Vec3(f.base.x, groundHeight(f.base.x, f.base.z) + (2.2 + stage * .22) * f.scale.y + Math.sin(time * 1.3) * .05, f.base.z);
      // Gone without being thrown: it comes apart into stars and drifts off.
      if (!want && rock.size > .05 && animate && !(spec && mine !== undefined)) effects.emit('astral', at, 14, rock.size * .6);
      rock.size = !animate || (!want && !(spec && mine !== undefined)) ? want : rock.size + (want - rock.size) * (1 - Math.exp(-dt * 7));
      rock.turn += dt * 40;
      rock.kept.set(at, rock.size, rock.turn, .55);
      if (animate && rock.size > .1 && Math.random() < dt * 5) effects.emit('astral', at, 1, rock.size * .5);
      if (!want && rock.size < .01) { rock.kept.drop(); rocks.delete(id); }
    }
  }
  /**
   * Dadista's die landing: its face drawn in the air in front of whom it lands on (src/dice-fx.ts),
   * as big as they stand, the hand pointing away from the side it came from. Corchete only shelters
   * (a soft ivory glow, no blow); the rest land as blows, a hand the hardest.
   */
  function dieBurst(action: BattleEffect, actor: Fighter, target: Fighter) {
    const { right, up, facing } = screenAxes(viewDir()), body = extent(target), die = action.die!;
    const mid = target.part ? chestOf(target) : new pc.Vec3(target.base.x, groundHeight(target.base.x, target.base.z) + body.height * .55, target.base.z);
    const front = body.radius * .6 + .2, centre = { x: mid.x + facing.x * front, y: mid.y + facing.y * front, z: mid.z + facing.z * front };
    const side = Math.sign((actor.base.x - target.base.x) * right.x + (actor.base.z - target.base.z) * right.z) || -1;
    const delay = diceFx.land({ centre, feet: floorUnder(target), right, up, size: Math.min(1.6, Math.max(1, body.height * .7)), side, radius: body.radius }, die.face, die.as!);
    if (die.as === 'corchete') { pulse?.(0, .25); hit(target, white, .7); return; }
    // The Comodín: its star and a hand on every other foe it reached too, one after another so each reads.
    if (die.as === 'comodin') reachedBy(action).filter(({ f }) => f !== target).forEach(({ f }, i) => dualFx.after(.07 * (i + 1), () => {
      const b = extent(f), at = f.part ? chestOf(f) : new pc.Vec3(f.base.x, groundHeight(f.base.x, f.base.z) + b.height * .55, f.base.z), ahead = b.radius * .6 + .2;
      const lag = diceFx.land({ centre: { x: at.x + facing.x * ahead, y: at.y + facing.y * ahead, z: at.z + facing.z * ahead }, feet: floorUnder(f), right, up, size: Math.min(1.6, Math.max(1, b.height * .7)), side, radius: b.radius }, die.face, die.as!);
      dualFx.after(lag, () => hit(f, white, .9));
    }));
    const guarded = state?.allies.find(a => a.id === action.target)?.guarding ?? false;
    const unit = state && [...state.allies, ...state.foes].find(u => u.id === action.target);
    const felt: Blow = { share: unit ? (action.amount ?? 0) / unit.maxHp : 0, skill: true, guarded, ko: target.hp <= 0, swallowed: action.swallowed, beat: state?.phase === 'beat' };
    const dx = target.base.x - actor.base.x, dz = target.base.z - actor.base.z, d = Math.hypot(dx, dz) || 1;
    // A blank's red frame comes first: the blow's flash waits for the face it repeats.
    dualFx.after(delay, () => hit(target, white, die.as === 'mano' || die.as === 'comodin' ? .9 : die.as === 'tijeras' ? .8 : .55));
    return land(felt, dx / d, 0, dz / d);
  }
  /** Matemágico's skills of the elements (docs/animas/README.md § The jar): drawn in his circle as figures (src/math-figures.ts). */
  const ELEMENTAL: ReadonlySet<string> = new Set(['factor-comun', 'vasos', 'descarga', 'cortocircuito']);
  const MAGMA = '#ff5a1f', MAGMA_HOT = '#ffd27a', BOLT = '#ffe45c';
  /** Who a skill on everyone reached, with what it did to each. */
  const reachedBy = (e: BattleEffect) => (e.hits ?? []).flatMap(h => { const f = fighters.get(h.target); return f ? [{ f, h }] : []; });
  /** The middle of the party standing, at chest height: where Integral impropia lies. */
  function partyMiddle() {
    const party = [...fighters.values()].filter(f => f.party && f.hp > 0);
    if (!party.length) return undefined;
    return party.reduce((sum, f) => { const c = chestOf(f); return { x: sum.x + c.x / party.length, y: sum.y + c.y / party.length, z: sum.z + c.z / party.length }; }, { x: 0, y: 0, z: 0 });
  }
  const figureFoe = (f: Fighter): FigureFoe => ({ chest: v3(chestOf(f)), feet: v3(floorUnder(f)), radius: extent(f).radius });
  /**
   * The figure his skill draws in the middle of his circle (`from`), once it has opened: it does what
   * it is on whoever the skill reaches (src/math-figures.ts). The fight's flashes, statuses and
   * numbers come at its contact (`contactBurst`, `elementBurst`).
   */
  function drawFigure(e: BattleEffect, from: pc.Vec3, actor: Fighter, target: Fighter) {
    const centre = v3(from), view = viewDir(), size = state?.allies.some(a => a.id === e.actor && !grownUp(a.profile)) ? CHILD_CIRCLE : 1;
    if (e.skill === 'cardioide') figures.cardioide({ centre, view, to: v3(chestOf(target)), size });
    else if (e.skill === 'integral') {
      const cured = (e.cures ?? []).flatMap(c => { const f = fighters.get(c.target); return f ? [v3(chestOf(f))] : []; });
      figures.integral({ centre, view, allies: cured.length ? cured : [v3(chestOf(actor))], size });
    } else if (e.skill === 'cortocircuito') {
      const shorts = !!e.shorted && e.shorted.why !== 'again';
      figures.cortocircuito({ centre, view, to: v3(chestOf(target)), radius: extent(target).radius, shorts, size });
    } else if (e.skill === 'condensador') figures.condensador({ centre, view, to: v3(chestOf(actor)), size });
    else if (e.skill === 'fourier') {
      // A circle a strike: the dial gold, then the colour of each thing on its plate it counted.
      const colours = [GOLD, ...(e.harmonics ?? []).map(harmonicColour)];
      fourierFigures.set(e, figures.fourier({ centre, view, model: target.model, chest: v3(chestOf(target)), floor: floorUnder(target).y, radius: extent(target).radius, colours, size }));
    } else if (e.skill === 'descarga') figures.punto({ centre, view, to: v3(chestOf(target)), feet: v3(floorUnder(target)), radius: extent(target).radius });
    else if (e.skill === 'atractor') {
      // What each other foe gave it, as it gave it; fire and water that met in it steam.
      const sources = (e.gathered ?? []).flatMap(g => { const f = fighters.get(g.from); return f ? [{ chest: v3(chestOf(f)), statuses: g.ids }] : []; });
      const steam = !!e.gathered?.some(g => g.reactions.some(r => r.id === 'humo' || r.id === 'vapor'));
      figures.atractor({ centre, view, chest: v3(chestOf(target)), feet: v3(floorUnder(target)), sources, steam, size });
      // Each one's powder and shards go as its statuses rise off it (the rest of its looks follow the plate, `gathering`).
      e.gathered?.forEach((g, i) => dualFx.after(atractorLeave(i), () => liftGiven(e, g.from)));
      // The fall into the chest is the skill's payoff: the fight slows a breath as it begins.
      dualFx.after(FIGURES.atractor.contact - CAST_LAUNCH - ATRACTOR.fall, () => clock.slow(.6, ATRACTOR.fall * .55, .25, 'scene'));
    }
    else if (e.skill === 'superficie-minima') {
      // Taken once: how big they are; where they stand, every frame (they may be thrown back by a blow).
      const { height, radius } = extent(target), id = e.target!, held = { feet: { x: 0, y: 0, z: 0 }, height, radius };
      filmFx.cast(id, { centre, facing: screenAxes(view).facing, size, body: () => {
        if (fighters.get(id) !== target) return undefined;
        const p = target.model.getPosition();
        held.feet.x = p.x; held.feet.y = groundHeight(p.x, p.z); held.feet.z = p.z;
        return held;
      } });
    }
    else {
      const foes = reachedBy(e).map(({ f }) => figureFoe(f));
      if (e.skill === 'factor-comun') figures.piramide({ centre, view, foes, size });
      else if (e.skill === 'vasos') figures.cubo({ centre, view, foes, size });
    }
  }
  /**
   * They land, as the figure does. Cubo acuático: the water on each foe, Mojado. Pirámide ígnea:
   * every foe flares, the fire on each rises to one height, and a gold line over their heads ties
   * them with the digit of the fire they now share (its rule: the highest fire is everyone's).
   * Punto eléctrico: the lightning is the figure's; here its flash on the foe and the arcs on it.
   */
  function elementBurst(e: BattleEffect, target: Fighter) {
    const up = { x: 0, y: 1, z: 0 }, reached = reachedBy(e), facing = screenAxes(viewDir()).facing;
    if (e.skill === 'cortocircuito') {
      // The current stays in it: where it shorts, the foe jolts and the arcs hold on it (the figure's).
      const shorts = !!e.shorted && e.shorted.why !== 'again';
      statusFx.touch('electrico', e.target!);
      hit(target, ELEMENT_FLASH.electrico, shorts ? 1.5 : 1); shake = Math.max(shake, shorts ? .5 : .3); pulse?.(shorts ? .55 : .3, .3);
      return;
    }
    if (e.skill === 'descarga') {
      const chest = v3(chestOf(target)), feet = floorUnder(target);
      effects.element('energy', chest, { strength: 1.2, feet: v3(feet) });
      statusFx.touch('electrico', e.target!);
      hit(target, ELEMENT_FLASH.electrico, 1.4); shake = Math.max(shake, .55); pulse?.(.6, .35);
      return;
    }
    if (!reached.length) return;
    if (e.skill === 'vasos') {
      const mid = reached.reduce((sum, { f }) => sum.add(floorUnder(f)), new pc.Vec3()).mulScalar(1 / reached.length);
      reached.forEach(({ f, h }, i) => dualFx.after(i * .04, () => {
        effects.element('water', v3(chestOf(f)), { from: v3(mid), strength: .9, feet: v3(floorUnder(f)) });
        statusFx.touch('agua', h.target); hit(f, ELEMENT_FLASH.agua, 1.1);
        if (h.smoked) dualFx.after(.2, () => statusFx.react('humo', h.target));
      }));
      shake = Math.max(shake, .4); pulse?.(.35, .35);
      return;
    }
    const top = Math.max(...reached.map(({ f }) => floorUnder(f).y + Math.min(1.5, extent(f).height * .8)));
    const marks = reached.map(({ f }) => { const feet = floorUnder(f); return { x: feet.x, y: top, z: feet.z }; });
    // Pirámide ígnea.
    const level = Math.max(0, ...reached.map(({ h }) => h.burn?.id === 'quemado' ? h.burn.level : 0));
    reached.forEach(({ f, h }, i) => dualFx.after(i * .05, () => {
      const feet = floorUnder(f), r = Math.max(.45, extent(f).radius * .9), mark = marks[i];
      hit(f, flame, h.burn?.id === 'quemado' ? 1.4 : 1);
      if (h.smoked) { dualFx.after(.15, () => statusFx.react('vapor', h.target)); return; }
      if (h.burn?.id !== 'quemado') return;
      // Its fire climbs to the height they all share, and the digit of that fire stands over it.
      [0, 1, 2].forEach(k => dualFx.after(.1 + k * .06, () => dualFx.ring({ x: feet.x, y: feet.y + .15 + (top - feet.y - .15) * k / 2, z: feet.z }, up, r * (1 - k * .15), k === 2 ? '#fff0b0' : '#ff9a2e', { count: 56, around: -3, outward: .3, life: .6, size: 1.25, ...k === 2 ? { light: 2 } : {} })));
      dualFx.after(.3, () => dualFx.digit({ x: mark.x, y: mark.y + .42, z: mark.z }, level > 1 ? 1 : 0, .34, '#f3cf78', facing, 1));
    }));
    const burning = marks.filter((_, i) => reached[i].h.burn?.id === 'quemado');
    // The common factor: one gold line over all of them, then brackets closing it at each end.
    for (let i = 1; i < burning.length; i++) dualFx.after(.26 + i * .06, () => dualFx.line(burning[i - 1], burning[i], '#f3cf78', { count: Math.round(Math.hypot(burning[i].x - burning[i - 1].x, burning[i].z - burning[i - 1].z) * 44), life: 1, size: 1.4 }));
    if (burning.length > 1) dualFx.after(.3 + burning.length * .06, () => { for (const end of [burning[0], burning[burning.length - 1]]) dualFx.line({ ...end, y: end.y - .22 }, { ...end, y: end.y + .22 }, '#fff0b0', { count: 22, life: .9, size: 1.5 }); });
    shake = Math.max(shake, .9); pulse?.(.8, .45);
  }
  /**
   * An element's reaction as it lands (docs/combat.md § Reacciones entre elementos). A skill on
   * everyone shows each foe's own (`elementBurst`); Conducción runs from one wet foe to the next.
   */
  function reactFx(e: BattleEffect) {
    const reaction = e.reaction!;
    if (e.hits?.some(h => h.smoked)) return;
    if (reaction.id === 'conduccion') {
      const wet = (reaction.hits ?? []).flatMap(h => { const f = fighters.get(h.target); return f ? [{ f, id: h.target }] : []; });
      wet.forEach(({ f, id }, i) => dualFx.after(i * .09, () => {
        statusFx.react('conduccion', id); hit(f, ELEMENT_FLASH.electrico, 1.2);
        if (i) dualFx.line(v3(chestOf(wet[i - 1].f)), v3(chestOf(f)), BOLT, { count: Math.round(chestOf(wet[i - 1].f).distance(chestOf(f)) * 50), life: .35, size: 1.5 });
      }));
      return;
    }
    // Powder's own (docs/animas/README.md § Empolvado): it blows up on everyone covered, runs green, or sets as shards.
    if (reaction.id === 'estallido') { powderFx.ignite((reaction.hits ?? []).map(h => h.target)); shake = Math.max(shake, .45); return; }
    if (reaction.id === 'veneno') { powderFx.soak(reaction.targets); return; }
    if (reaction.id === 'cristal') { powderFx.crystallise(reaction.targets ?? []); return; }
    if (e.target) statusFx.react(reaction.id, e.target);
  }
  /** Where Vulcano's volcano stands: behind the foes, on the far side from the party. */
  function volcanoSite() {
    const foes = [...fighters.values()].filter(f => !f.party && f.hp > 0 && !f.part), party = [...fighters.values()].filter(f => f.party && f.hp > 0);
    const mid = (list: Fighter[]) => list.reduce((sum, f) => sum.add(f.base), new pc.Vec3()).mulScalar(1 / Math.max(1, list.length));
    const c = foes.length ? mid(foes) : anchor.clone(), from = party.length ? mid(party) : c.clone().add(new pc.Vec3(-3, 0, 0));
    const way = new pc.Vec3().sub2(c, from); way.y = 0; way.normalize();
    const at = c.clone().add(way.mulScalar(1.15));
    return { x: at.x, y: groundHeight(at.x, at.z), z: at.z };
  }
  /** Vulcano's volcano erupts: a column of fire out of its mouth, smoke, and a bomb of lava to each of `to`. */
  function eruption(to: Fighter[], k = 1) {
    const site = volcanoSite(), mouth = { x: site.x, y: site.y + .9, z: site.z }, up = { x: 0, y: 1, z: 0 };
    dualFx.burst('crackle', { at: mouth, count: Math.round(260 * k), spread: .25, velocity: { x: 0, y: 9, z: 0 }, cone: .28, speed: 2, life: [.4, .9], colour: '#ffb84a' });
    dualFx.burst('ember', { at: mouth, count: Math.round(140 * k), spread: .3, velocity: { x: 0, y: 6, z: 0 }, cone: .5, speed: 1.6, life: [.9, 1.8], colour: MAGMA_HOT });
    dualFx.burst('smog', { at: { ...mouth, y: mouth.y + .6 }, count: Math.round(90 * k), spread: .4, up: 1.6, speed: .7, life: [1.4, 2.4] });
    dualFx.ring({ x: site.x, y: site.y + .06, z: site.z }, up, .9, MAGMA, { count: 110, outward: 2.2, around: 1.2, life: .6, size: 1.4, light: 4 });
    // A ball of burning gas swells out of its mouth and rolls up; lava wells over the rim and runs down
    // its sides to pool round its foot (fluids, src/fluid-fx.ts).
    fluidFx.fireball({ ...mouth, y: mouth.y + .35 }, .55 + .25 * k, .7 * k);
    fluidFx.lava({ ...mouth, y: mouth.y + .05 }, 260 * k, { shape: 'ring', spread: .22, outward: 1.7, up: 1.6, speed: .45, life: [2, 3] });
    shake = Math.max(shake, .35 * k); pulse?.(.3 * k, .4); cue('fire-hit');
    to.forEach((f, i) => {
      const chest = v3(chestOf(f)), feet = floorUnder(f), flight = .42 + i * .05;
      effects.trails.comet(mouth, chest, [MAGMA_HOT, MAGMA], flight, { arc: 1.3, width: .16, life: .55, intensity: 3.4, core: .7, additive: 1, taper: .6 });
      dualFx.after(flight, () => {
        dualFx.ring({ x: feet.x, y: feet.y + .06, z: feet.z }, up, Math.max(.45, extent(f).radius), MAGMA, { count: 80, outward: 1.4, around: 2, life: .5, size: 1.3, light: 2.5 });
        dualFx.burst('crackle', { at: chest, count: 90, spread: .2, speed: 3, up: 1.2, life: [.3, .6], colour: '#ffb84a' });
        // The bomb is lava: it splashes and spreads into a pool round their feet.
        fluidFx.lavaPool({ x: feet.x, y: feet.y, z: feet.z }, Math.max(.45, extent(f).radius), .7 * k);
        hit(f, flame, 1.2);
      });
    });
  }
  /** Vulcano's volcano while it stands: lava glowing at its foot, embers and smoke rising from its mouth. */
  function volcanoIdle() {
    const site = volcanoSite(), mouth = { x: site.x, y: site.y + .9, z: site.z }, up = { x: 0, y: 1, z: 0 };
    // Its body: rings of embers stacked narrower as they climb, a cone of particles that keeps being redrawn.
    [[.05, 1.05], [.3, .8], [.55, .55], [.8, .32]].forEach(([h, r], k) => dualFx.ring({ x: site.x, y: site.y + h, z: site.z }, up, r, k % 2 ? '#c2410c' : '#ff7a2a', { kind: 'crackle', count: 22 - k * 3, around: .6, life: .5, size: 1.15 }));
    dualFx.burst('ember', { at: mouth, count: 10, spread: .22, velocity: { x: 0, y: 2.6, z: 0 }, cone: .4, speed: .8, life: [.8, 1.6], colour: MAGMA_HOT });
    dualFx.burst('crackle', { at: { x: site.x, y: site.y + .45, z: site.z }, count: 14, shape: 'ring', spread: .55, outward: .2, up: 1.2, speed: .5, around: .4, life: [.3, .6], colour: MAGMA });
    dualFx.burst('smog', { at: { ...mouth, y: mouth.y + .4 }, count: 4, spread: .25, up: 1, speed: .4, life: [1.6, 2.6] });
    dualFx.burst('crackle', { at: { x: site.x, y: site.y + .08, z: site.z }, count: 8, shape: 'ring', spread: .95, speed: .2, around: .5, life: [.35, .6], colour: '#ff7a2a' });
    // Now and then lava brims over its rim and runs down to the pool at its foot.
    if (++volcanoDrip % 5 === 0) fluidFx.lava({ ...mouth, y: mouth.y + .05 }, 26, { shape: 'ring', spread: .16, outward: .9, up: .6, speed: .2, life: [1.6, 2.4] });
  }
  /** Counts Vulcano's idle beats, for the lava that brims over every few. */
  let volcanoDrip = 0;
  /** Escudo de bits closed over the party (effects.bitDome), the shield it shows, and its PV last seen. */
  let wallFx: ReturnType<typeof effects.bitDome>, wallFor: BitShield | undefined, wallSeen = 0;
  /** Where a dome over the party stands: the middle of its floor, wide enough for everyone standing under it with room round them, and high enough over the tallest. */
  function domeOverParty() {
    const party = [...fighters.values()].filter(f => f.party && f.hp > 0);
    if (!party.length) return undefined;
    const mid = party.reduce((sum, f) => sum.add(f.base), new pc.Vec3()).mulScalar(1 / party.length);
    const radius = Math.max(1.5, party.reduce((most, f) => Math.max(most, Math.hypot(f.base.x - mid.x, f.base.z - mid.z) + extent(f).radius), 0) + .75);
    const height = Math.max(radius * .7, party.reduce((most, f) => Math.max(most, extent(f).height), 0) + .45);
    return { base: { x: mid.x, y: groundHeight(mid.x, mid.z), z: mid.z }, radius, height };
  }
  function raiseWall() {
    const at = domeOverParty();
    return at && effects.bitDome(at.base, { radius: at.radius, height: at.height });
  }
  /** Sobrecalentamiento's dome of fire (effects.fireDome), round a bit dome that may be standing. */
  function raiseFireDome() {
    const at = domeOverParty();
    return at && effects.fireDome(at.base, { radius: at.radius + .12, height: at.height + .1 });
  }
  /** A foe's blow the bit dome took whole: nothing of it reached anyone under it. */
  const domeStopped = (e?: BattleEffect) => !!e && e.kind === 'enemy' && !!e.bits?.took && !e.bits.broke && !e.amount && !e.hits?.some(h => h.amount > 0);
  /** Where a foe's blow on `target` meets the dome, from `from`. */
  const domeEntry = (from: Fighter, target: Fighter) => wallFx?.alive ? wallFx.entry(v3(chestOf(from)), v3(chestOf(target))) : undefined;
  /** Each frame: the dome follows the shield in the rules, raised once its action lands, gone when it is; a cure that patched it shows. */
  function wallFrame() {
    const shield = state ? bitsOf(state) : undefined;
    const raising = !!effect?.bits?.raised && !impacted || !!upcoming?.bits?.raised;
    if (shield && shield !== wallFor && !raising) { wallFx?.fade(); wallFx = raiseWall(); wallFor = shield; wallSeen = shield.hp; }
    // A cure patched it (a cure's own action shows it as it lands, a pulse at once); a blow's dent too, as it lands.
    const settled = !((effect?.bits?.mended || effect?.bits?.took) && !impacted);
    if (shield && shield === wallFor && shield.hp > wallSeen && settled) wallFx?.mend();
    if (shield && shield === wallFor && settled) wallSeen = shield.hp;
    // Its cracks: what it has lost of its PV, as last seen (a dome filled past them by Redundancia is whole).
    if (wallFor && shield === wallFor) wallFx?.wear(1 - wallSeen / Math.max(1, wallFor.max));
    // Broken by a blow still on its way: it gives way when that blow lands.
    if (!shield && wallFor && !(effect?.bits?.broke && !impacted)) { if (wallFor.broken) wallFx?.shatter(); else wallFx?.fade(); wallFx = undefined; wallFor = undefined; }
  }
  /**
   * Atractor extraño: what met in its target and reacted, one after another as it lands: smoke or steam out of it, its powder
   * going up on everyone it reaches, or running green.
   */
  function gatherFx(e: BattleEffect) {
    const id = e.target;
    if (!id || !e.gathered) return;
    // Whatever was not lifted on its way (no motion) goes now.
    for (const g of e.gathered) liftGiven(e, g.from);
    const carried = gatherCarried.get(e), reactions = e.gathered.flatMap(g => g.reactions), ids = e.gathered.flatMap(g => g.ids);
    // The powder that came is on it for an instant, so the fire or the water that meets it there finds it.
    const powder = ids.includes('empolvado') ? carried?.mix ?? nextMix() : undefined;
    if (powder && !powderFx.has(id)) powderFx.dust(id, powder, reactions.some(r => r.id === 'estallido' || r.id === 'veneno') ? 1 : TIMED.empolvado.seconds);
    // Shards that came stand out of it now, for the longest of those that came.
    const shards = state?.foes.find(f => f.id === id)?.timed?.cristalizado;
    if (ids.includes('cristalizado') && shards) powderFx.crystallise([id], shards.left, true);
    reactions.forEach((r, i) => dualFx.after(.12 + i * .14, () => {
      if (r.id === 'estallido') { powderFx.ignite((r.hits ?? []).map(h => h.target)); shake = Math.max(shake, .45); }
      else if (r.id === 'veneno') powderFx.soak([id]);
      else if (r.id === 'humo' || r.id === 'vapor') statusFx.react(r.id, id);
    }));
  }
  /**
   * Atractor extraño, until it lands: who keeps showing what they had (its target, until the butterfly falls into it; whoever its
   * Estallido reaches; each source until its statuses have risen off it, `atractorGiven`). A source that has given and that the
   * Estallido is still to reach shows what it has now but the fire that Estallido lights (`bare`). Built again only when a source lets go.
   */
  let gatherHeld: { effect: BattleEffect; given: number; held: Set<string>; bare: Set<string> } | undefined;
  function gatheringNow(e: BattleEffect) {
    const sources = e.gathered ?? [], given = sources.filter((_, i) => effectTime >= atractorGiven(i)).length;
    if (gatherHeld?.effect !== e || gatherHeld.given !== given) {
      const blasted = new Set(sources.flatMap(g => g.reactions.flatMap(r => (r.hits ?? []).map(h => h.target)))), gone = new Set(sources.slice(0, given).map(g => g.from));
      gatherHeld = { effect: e, given, held: new Set([e.target!, ...sources.slice(given).map(g => g.from), ...[...blasted].filter(id => !gone.has(id))]), bare: new Set([...gone].filter(id => blasted.has(id))) };
    }
    return gatherHeld;
  }
  /** Atractor extraño: what each action took off its sources (their powder's mix), and who has been lifted already. */
  const gatherCarried = new WeakMap<BattleEffect, { mix?: PowderMix; lifted: Set<string> }>();
  /** `from` gave its statuses to Atractor extraño's target: its powder and shards come off it quietly (they reappear on the target as it lands). */
  function liftGiven(e: BattleEffect, from: string) {
    let carried = gatherCarried.get(e);
    if (!carried) gatherCarried.set(e, carried = { lifted: new Set() });
    if (carried.lifted.has(from)) return;
    carried.lifted.add(from);
    const mix = powderFx.lift(from);
    if (mix && !carried.mix) carried.mix = mix;
  }
  /** Virus atómico: what spread leaves its host as a stream of tiny Bips and settles on each of the others. */
  function spreadFx(e: BattleEffect) {
    const up = { x: 0, y: 1, z: 0 };
    for (const s of e.spread ?? []) {
      const host = fighters.get(s.from);
      if (!host) continue;
      const from = v3(chestOf(host));
      s.to.forEach((id, i) => {
        const f = fighters.get(id);
        if (!f) return;
        const to = v3(chestOf(f));
        dualFx.after(.12 + i * .06, () => {
          for (const phase of [0, 2.1, 4.2]) effects.trails.comet(from, to, ['#ffffff', BIP.cyan], .35, { arc: .5, width: .03, life: .4, intensity: 2.4, core: .4, additive: 1, twist: { turns: 3, radius: .16, phase } });
          dualFx.after(.35, () => { dualFx.ring(to, up, .42, BIP.cyan, { kind: 'nanite', count: 70, outward: -1.2, around: 5, life: .5, size: 1.1, light: 1.5 }); hit(f, cyanFlash, .6); });
        });
      });
    }
  }
  /**
   * Combustión goes off on the foe a physical blow found at IV (docs/animas/README.md § Combustión):
   * a breath in, then the ball of fire and its ring along the floor, embers out to every other foe,
   * and each of them flaring as the blast reaches it.
   */
  function combustFx(e: BattleEffect) {
    const c = e.combustion!, origin = fighters.get(c.target);
    if (!origin) return;
    const raised = new Set([...c.burns.map(b => b.target), ...c.steamed ?? []]);
    statusFx.combust(c.target, c.hits.map(h => h.target).filter(id => id !== c.target && raised.has(id)));
    dualFx.after(.1, () => {
      const feet = floorUnder(origin);
      dualFx.shock({ x: feet.x, y: feet.y, z: feet.z }, 3, '#ff9a2e', { chips: 140, light: true, heavy: true });
      // It goes off as a fireball, and the fire runs over the floor to each it reaches as a river of burning gas (fluids).
      fluidFx.fireball({ x: feet.x, y: feet.y + .7, z: feet.z }, 1, 1.2);
      for (const h of c.hits) {
        const f = fighters.get(h.target);
        if (!f || f === origin) continue;
        const to = floorUnder(f), T = .4;
        fluidFx.burst('fluido-fuego', { at: { x: feet.x, y: feet.y + .25, z: feet.z }, count: 260, spread: .2, velocity: { x: (to.x - feet.x) / T, y: .5, z: (to.z - feet.z) / T }, speed: .5, life: [.55, .85] });
      }
      hit(origin, white, 1.6); shake = Math.max(shake, .75); pulse?.(.9, .5); zoom.x = Math.max(zoom.x, HIT.punch.size);
      cue('hit');
    });
    c.hits.filter(h => h.target !== c.target).forEach((h, i) => dualFx.after(.32 + i * .08, () => { const f = fighters.get(h.target); if (f) hit(f, flame, 1.3); }));
    c.steamed?.forEach((id, i) => dualFx.after(.4 + i * .08, () => statusFx.react('vapor', id)));
  }
  /**
   * Bip's skill lands (`botStrikes`): a ray from where it floats (energy cyan, a cure's green, the
   * shrinking ray's white), waves of the mind twisting their way to a head, its blast among the foes,
   * or Rayo solar sweeping them one after another in sun yellow, each one catching fire.
   */
  /**
   * Enjambre's look as it goes (src/swarm-fx.ts, docs/animas/tecnopata/README.md § Look), each moment once, from Bip's frame:
   * it comes apart over the foes into a swarm of nanites that pours down onto the floor among them (`SWARM_BIP.apart`); the
   * network grows there to every foe (`SWARM.land`); nanites climb each foe to its chest (`SWARM.hold`), where the bombs close
   * on at `contact` (`bipBurst`); a white pulse runs along the network and the clocks wind back (`SWARM.pulse`); and the
   * nanites come back from it to form Bip at home (`SWARM_BIP.reform`). The network stays until the bombs have gone off.
   */
  function swarmFrame(e: BattleEffect, b: NonNullable<ReturnType<typeof bips.get>>, over: pc.Vec3, rest: pc.Vec3, t: number) {
    let played = swarmPlayed.get(e);
    if (!played) swarmPlayed.set(e, played = new Set());
    const once = (moment: string, at: number) => t >= at && !played!.has(moment) && !!played!.add(moment);
    const land = new pc.Vec3(over.x, groundHeight(over.x, over.z), over.z), up = { x: 0, y: 1, z: 0 };
    const held = (e.planted ?? []).flatMap(id => { const f = fighters.get(id); return f && f.hp > 0 ? [{ id, f }] : []; });
    if (once('apart', SWARM_BIP.apart)) {
      // It cracks open: a shell of nanites bursts off it, and the swarm pours down onto the floor.
      dualFx.ring(v3(over), viewDir(), .35, BIP.cyan, { kind: 'nanite', count: 260, outward: 2.6, around: 4, life: .4, size: 1.1, light: 3 });
      dualFx.burst('bipzap', { at: v3(over), count: 70, speed: 3, life: [.2, .45] });
      const fall = (over.y - land.y) / (SWARM.land - SWARM_BIP.apart);
      dualFx.burst('nanite', { at: v3(over), count: 4800, spread: .35, velocity: { x: 0, y: -fall, z: 0 }, speed: 1.1, cone: .5, life: [.26, .34], light: { intensity: 2.5, range: 3, colour: BIP.cyan } });
      cue('glitch', { volume: .45 });
    }
    if (once('land', SWARM.land)) {
      // On the floor: a splash of nanites, and the network starts to grow from there to every foe.
      dualFx.ring(v3(land.clone().add(new pc.Vec3(0, .05, 0))), up, .5, BIP.cyan, { kind: 'nanite', count: 220, outward: 3.2, life: .45, size: 1.1, light: 2.5 });
      swarmHeld = new Set(held.map(h => h.id));
      swarmFx.start({ land: v3(land), foes: held.map(({ f }) => ({ at: v3(floorUnder(f)), radius: extent(f).radius })) });
      cue('data-chirp', { volume: .7 });
    }
    if (once('climb', SWARM.hold)) {
      // The network has them: nanites run up each body to its chest, rings closing as they climb.
      held.forEach(({ f }, i) => {
        const feet = floorUnder(f), spot = bombSpot(f), { radius } = extent(f), rise = Math.max(.3, spot.y - feet.y);
        for (let k = 0; k < 6; k++) dualFx.after(i * .05 + k * .035, () => dualFx.ring({ x: feet.x, y: feet.y + .05 + rise * k / 5, z: feet.z }, up, Math.max(.3, radius * (1 - .1 * k)), k === 5 ? '#ffffff' : BIP.cyan, { kind: 'nanite', count: 90, outward: -1, around: k % 2 ? -3 : 3, life: .3, size: 1.1, ...k === 0 ? { light: 1.6 } : {} }));
      });
      cue('data-chirp', { volume: .5, delay: .05 });
    }
    if (once('pulse', SWARM.pulse)) {
      // The clocks start over: a white pulse runs out along the network (its sheet), a rewind under it.
      dualFx.ring(v3(land.clone().add(new pc.Vec3(0, .06, 0))), up, .6, '#ffffff', { count: 140, outward: 5, life: .5, size: 1.3, light: 2 });
      cue('rewind', { volume: .8 });
    }
    if (once('reform', SWARM_BIP.reform)) {
      // Home: the nanites come back from the network and Bip forms out of them.
      b.bip.entity.setPosition(rest);
      effects.nanites({ from: v3(land.clone().add(new pc.Vec3(0, .1, 0))), to: b.bip.entity, count: 420, seconds: .7 });
    }
  }
  function bipBurst(action: BattleEffect, target: Fighter, from: pc.Vec3, felt: Blow, ax: number, az: number) {
    const chest = chestOf(target), up = { x: 0, y: 1, z: 0 };
    // Bip's rays have flown already (`bipFire`): here they land.
    if (action.skill === 'rayo-sanacion') {
      pulse?.(0, .25); hit(target, green, 1); effects.fightFx('heal', { model: target.model });
      const feet = floorUnder(target);
      dualFx.ring({ x: feet.x, y: feet.y + .1, z: feet.z }, up, Math.max(.5, extent(target).radius * .8), '#8dffb8', { count: 60, life: .8, size: 1.1, light: 1.5 });
      dualFx.burst('mote', { at: v3(chest), count: 40, spread: .35, speed: .6, up: .8, life: [.6, 1.2], colour: '#8dffb8', size: 1.2 });
      return;
    }
    if (action.skill === 'bomba-remota') {
      // Bomba remota: Bip presses it on; the clamps bite with a clank, nanites close round it and its lamp wakes.
      const spot = bombSpot(target), v = viewDir();
      if (action.target) ensureBomb(action.target);
      dualFx.ring(v3(spot), v, .26 * target.scale.y, BIP.cyan, { kind: 'nanite', count: 60, outward: -1.6, around: 3, life: .32, size: 1.1, light: 1.6 });
      dualFx.burst('bipzap', { at: v3(spot), count: 26, speed: 2.2, life: [.15, .35] });
      dualFx.after(.1, () => dualFx.ring(v3(spot), v, .14 * target.scale.y, BOMB.red, { count: 30, outward: 2, life: .25, size: 1.1, light: 1.2 }));
      hit(target, cyanFlash, .5); cue('clink');
      return;
    }
    if (action.skill === 'escolta') {
      // Escolta: Bip arrives in front of them; a shield of cyan flares round them from the floor up, and the ring stays (`updateEscorts`).
      const feet = floorUnder(target), { height, radius } = extent(target), r = Math.max(.55, radius * 1.25);
      [.05, .35, .7, 1].forEach((k, i) => dualFx.after(i * .05, () => dualFx.ring({ x: feet.x, y: feet.y + .05 + height * k, z: feet.z }, up, r * (1 - .15 * k), i === 3 ? '#ffffff' : BIP.cyan, { count: 70, around: i % 2 ? -3 : 3, life: .45, size: 1.2, ...i === 0 ? { light: 2.5 } : {} })));
      dualFx.burst('glyph', { at: v3(chest), count: 16, spread: radius * .7, speed: .4, up: .6, life: [.4, .8], colour: BIP.cyan, size: 1.3 });
      hit(target, cyanFlash, .8); pulse?.(0, .25);
      return;
    }
    if (action.skill === 'enjambre') {
      // Enjambre: the nanites that climbed each foe close into a bomb on its chest, one after another, each with its clank;
      // they are already at their top. Without motion, the bombs are simply there.
      (action.planted ?? []).forEach((id, i) => {
        const f = fighters.get(id);
        if (!f) return;
        const spot = bombSpot(f);
        dualFx.after(i * .06, () => { dualFx.ring(v3(spot), viewDir(), .3 * f.scale.y, BIP.cyan, { kind: 'nanite', count: 90, outward: -1.6, around: 3, life: .35, size: 1.1, light: 2 }); dualFx.burst('bipzap', { at: v3(spot), count: 24, speed: 2.2, life: [.15, .35] }); hit(f, cyanFlash, .6); cue('clink', { volume: .6 }); });
        ensureBomb(id, .04 + i * .06);
      });
      shake = Math.max(shake, .3); pulse?.(.2, .35);
      return;
    }
    if (action.skill === 'confusion') {
      const head = v3(chest.clone().add(new pc.Vec3(0, .45 * target.scale.y, 0)));
      for (const phase of [0, 2.1, 4.2]) effects.trails.comet(v3(from), head, ['#dffbff', BIP.cyan], .22, { arc: .1, width: .045, life: .35, intensity: 2, core: .4, twist: { turns: 2.5, radius: .14, phase } });
      dualFx.after(.22, () => dualFx.ring(head, up, .32, BIP.cyan, { count: 50, life: .7, size: 1.1, light: 1.5 }));
      hit(target, cyanFlash, .7); return;
    }
    if (action.skill === 'rayo-encogedor') {
      hit(target, cyanFlash, .9);
      const feet = floorUnder(target), { height, radius } = extent(target);
      // Rings round them from head to feet, closing in one after another: it squeezes them down.
      [.9, .6, .3, .1].forEach((h, i) => dualFx.after(i * .06, () => dualFx.ring({ x: feet.x, y: feet.y + Math.max(.1, height * h), z: feet.z }, up, Math.max(.5, radius * 1.1), '#e8fbff', { count: 70, outward: -1.6, around: 2, life: .55, size: 1.2, ...i === 0 ? { light: 2 } : {} })));
      dualFx.burst('bipzap', { at: v3(chest), count: 30, speed: 2.5, life: [.2, .5], colour: '#ffffff' });
      return;
    }
    if (action.controlled) {
      // Control remoto: Bip's signal threads to its head and holds it, rings of nanites closing round
      // it; then its own blow goes, in Bip's cyan, to one of its own (or back into itself).
      const head = v3(chest.clone().add(new pc.Vec3(0, .45 * target.scale.y, 0))), victim = fighters.get(action.controlled.victim);
      for (const phase of [0, Math.PI]) effects.trails.comet(v3(from), head, ['#ffffff', BIP.cyan], .16, { arc: .05, width: .05, life: .55, intensity: 2.6, core: .6, twist: { turns: 4, radius: .1, phase } });
      dualFx.line(v3(from), head, BIP.cyan, { count: Math.round(from.distance(chest) * 40), life: .75, size: 1.2 });
      [0, 1, 2].forEach(i => dualFx.after(.16 + i * .08, () => dualFx.ring(head, up, .44 - i * .1, BIP.cyan, { kind: 'nanite', count: 60, outward: -1.4, around: i % 2 ? -4 : 4, life: .5, size: 1.1, ...i === 0 ? { light: 2 } : {} })));
      hit(target, cyanFlash, 1);
      if (victim) dualFx.after(.42, () => {
        const at = v3(chestOf(target)), to = v3(chestOf(victim)), own = victim === target;
        if (!own) {
          effects.trails.comet(at, to, ['#ffffff', BIP.cyan], .12, { arc: .15, width: .17, life: .35, intensity: 3.2, core: .7, additive: .95, taper: .7 });
          dualFx.burst('bipzap', { at, count: 24, speed: 2.4, life: [.2, .4] });
        }
        dualFx.after(own ? 0 : .12, () => {
          effects.impact(to, own ? v3(from) : at, 1.4, { colour: BIP.cyan, feet: floorUnder(victim) });
          dualFx.ring(to, up, .35, '#ffffff', { count: 70, outward: 4, life: .35, size: 1.3, light: 2.5 });
          dualFx.burst('bipzap', { at: to, count: 36, speed: 3, up: .6, life: [.25, .55] });
          hit(victim, white, 1.2); shake = Math.max(shake, .45); cue('hit');
        });
      });
      return;
    }
    if (action.skill === 'virus') {
      // Virus atómico: a swarm of tiny Bips off Bip, weaving its way in, closing round them and getting in.
      const to = v3(chest);
      for (let k = 0; k < 7; k++) effects.trails.comet(v3(from), to, ['#ffffff', BIP.cyan], .32 + k * .025, { arc: .2 + (k % 3) * .25, width: .025, life: .35, intensity: 2.2, core: .4, additive: 1, twist: { turns: 2 + k % 3, radius: .1 + (k % 2) * .08, phase: k * .9 } });
      dualFx.after(.3, () => { dualFx.ring(to, up, .5, BIP.cyan, { kind: 'nanite', count: 110, outward: -1.6, around: 7, life: .6, size: 1.1, light: 2 }); dualFx.burst('glyph', { at: to, count: 18, spread: .3, speed: .5, life: [.4, .8], colour: BIP.cyan, size: 1.3 }); });
      hit(target, cyanFlash, .8);
      return land(felt, ax, 0, az);
    }
    if (action.skill === 'escudo-de-bits') {
      // Escudo de bits: Bip throws its bits up over the party; the dome closes where they fall (`wallFrame`).
      const wall = raiseWall();
      if (wall) {
        wallFx?.fade(); wallFx = wall; wallFor = state ? bitsOf(state) : undefined; wallSeen = wallFor?.hp ?? 0;
        for (let k = 0; k < 6; k++) {
          const a = k / 6 * Math.PI * 2, r = Math.hypot(wall.top.y - wall.base.y, 1) * .6;
          effects.trails.comet(v3(from), { x: wall.base.x + Math.cos(a) * r, y: wall.base.y + (wall.top.y - wall.base.y) * .75, z: wall.base.z + Math.sin(a) * r }, ['#ffffff', BIP.cyan], .22, { arc: .5, width: .04, life: .35, intensity: 2.4, core: .5, additive: 1 });
        }
      }
      pulse?.(0, .3);
      return;
    }
    if (action.skill === 'reinicio') {
      // Reinicio: Bip's eye goes white and a wave of cyan leaves it along the floor. Over each foe a
      // dial of nanites turns backwards and closes, and a scan rises from their feet to their head:
      // whatever runs on their clock is full again.
      const floor = groundHeight(from.x, from.z);
      dualFx.ring({ x: from.x, y: floor + .08, z: from.z }, up, .4, BIP.cyan, { kind: 'nanite', count: 160, outward: 6.5, life: .55, size: 1.2, light: 3 });
      dualFx.burst('bipzap', { at: v3(from), count: 40, speed: 2.6, life: [.2, .45] });
      reachedBy(action).forEach(({ f }, i) => dualFx.after(.18 + i * .07, () => {
        const feet = floorUnder(f), { height, radius } = extent(f), r = Math.max(.5, radius * 1.1), head = { x: feet.x, y: feet.y + height + .25, z: feet.z };
        dualFx.ring(head, up, .42, BIP.cyan, { kind: 'nanite', count: 90, around: -6, outward: -.4, life: .7, size: 1.2, light: 2 });
        dualFx.ring(head, up, .26, '#ffffff', { count: 40, around: -9, life: .55, size: 1.1 });
        [.05, .3, .55, .8, 1].forEach((k, j) => dualFx.after(j * .05, () => dualFx.ring({ x: feet.x, y: feet.y + .05 + height * k, z: feet.z }, up, r, j === 4 ? '#ffffff' : '#9ff4ff', { count: 56, around: 2, life: .4, size: 1.05 })));
        dualFx.burst('glyph', { at: v3(chestOf(f)), count: 14, spread: radius * .6, speed: .5, up: .6, life: [.4, .8], colour: BIP.cyan, size: 1.3 });
        hit(f, cyanFlash, .8);
      }));
      shake = Math.max(shake, .3); pulse?.(.2, .35);
      return land(felt, ax, 0, az);
    }
    if (action.exploded) {
      // Bip blows itself up among them: a ball of fire, a shockwave along the floor, every foe flaring.
      const floor = groundHeight(from.x, from.z);
      effects.element('fire', v3(from), { strength: 2.2 });
      // The fireball itself, a fluid: born packed, it swells under its own pressure, rolls up and leaves smoke.
      fluidFx.fireball({ x: from.x, y: Math.max(floor + .8, from.y), z: from.z }, 1.25, 1.5);
      dualFx.shock({ x: from.x, y: floor, z: from.z }, 3.2, '#ff9a2e', { chips: 120, light: true, heavy: true });
      for (const h of action.hits ?? []) { const f = fighters.get(h.target); if (f) { hit(f, flame, 1.3); effects.element('fire', v3(chestOf(f)), { from: v3(from), strength: .8, feet: v3(floorUnder(f)) }); } }
      shake = Math.max(shake, .7); pulse?.(.5, .4);
      return land({ ...felt, share: Math.max(felt.share, .2) }, ax, 0, az);
    }
    if (action.release) {
      // Rayo solar: its beam reaches the first of them; the sweep burns the rest (`solarFrame`).
      shake = Math.max(shake, .6); pulse?.(.8, .6); zoom.x = Math.max(zoom.x, HIT.punch.size * 1.2);
      return land(felt, ax, 0, az);
    }
    // Rayo de energía: the bolt bursts on them, sparks everywhere; the clocks it started over flare in a ring round them.
    effects.impact(v3(chest), v3(from), 1.3, { colour: BIP.cyan, feet: floorUnder(target) });
    const way = { x: ax, y: 0, z: az };
    dualFx.ring(v3(chest), way, .3, BIP.cyan, { count: 60, outward: 4, life: .35, size: 1.3, light: 3 });
    dualFx.burst('bipzap', { at: v3(chest), count: 60, velocity: { x: ax * 2, y: 1, z: az * 2 }, speed: 4, life: [.3, .7] });
    // The path it burned stays a moment, crackling.
    dualFx.line(v3(bipMuzzle(from, chest)), v3(chest), BIP.cyan, { count: Math.round(from.distance(chest) * 45), life: .4, size: 1.4 });
    dualFx.after(.08, () => dualFx.burst('bipzap', { at: v3(bipMuzzle(from, chest)), to: v3(chest), shape: 'line', count: 40, speed: 1.5, life: [.2, .45] }));
    hit(target, cyanFlash, 1.2);
    if (action.extended || action.restarted) {
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
      [0, 2.1, 4.2].forEach((phase, k) => dualFx.after(k * .06, () => {
        const twist = { turns: 1.5, radius: .14, phase };
        effects.trails.comet(from, to, ['#ffe9a0', '#ff8a1e'], .3, { arc: .5, width: .08, life: .3, intensity: 2.6, core: .5, twist });
        // Drops of sun come loose off each stream as it flies.
        const path = cometPath(from, to, { arc: .5, twist });
        for (let i = 1; i <= 6; i++) dualFx.after(.3 * i / 6, () => dualFx.burst('sunspark', { at: v3(path(i / 6, new pc.Vec3())), count: 6, speed: 1.6, life: [.3, .6] }));
      }));
    }
    dualFx.after(.34, () => { effects.element('fire', to, { strength: .7 }); dualFx.ring(to, { x: 0, y: 1, z: 0 }, .35, BIP.solar, { count: 60, outward: 1.5, life: .5, light: 2 }); });
    pulse?.(.2, .3);
  }
  /**
   * Foc Binari's second stream, the one, landing `at` seconds into the action: it sounds, flares on
   * the target (fire when it catches), lurches the picture and holds it, as hard as its own share.
   */
  /**
   * Serie de Fourier's strike `k` (past the first) lands: one more partial on the tone (additive synthesis), the next
   * circle closing into its beam (src/math-figures.ts), the foe flaring and barely holding the picture, so they run tac-tac-tac.
   */
  function fourierStrike(action: BattleEffect, actor: Fighter | undefined, target: Fighter, k: number, animate: boolean, at: number) {
    cue(partialSound(k + 1)); cue('hit', { volume: .25 });
    if (action.crits?.[k]) cue('crit');
    if (!animate || !actor) return;
    const figure = fourierFigures.get(action);
    // The foe flashes in the colour of the circle that struck it.
    const colour = figure?.strike(k, v3(chestOf(target)));
    const last = k >= (action.strikes?.length ?? 1) - 1;
    if (last) figure?.finish();
    hit(target, colour ? new pc.Color().fromString(colour) : gold, .8 + .08 * k);
    shake = Math.max(shake, .08 + .03 * k);
    const unit = state && [...state.allies, ...state.foes].find(u => u.id === action.target);
    const dx = target.base.x - actor.base.x, dz = target.base.z - actor.base.z, d = Math.hypot(dx, dz) || 1;
    const landed = land({ share: unit ? (action.strikes?.[k] ?? 0) / unit.maxHp : 0, skill: true, guarded: false, ko: last && target.hp <= 0 }, dx / d, 0, dz / d);
    effectTime -= clock.stop(Math.min(landed.stop, last ? .08 : .025), effectTime - at);
  }
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
    // His figures (src/math-figures.ts) are their own light: no comet, no arc of the fist.
    if (isFigure(action.skill)) return;
    if (trailStage === 0) {
      trailStage = 1;
      if (support && light) {
        // It flies to whoever it reaches; on oneself it winds round.
        const reached = target ? [target] : [];
        const from = (arm?.findByName('Mano') as pc.Entity | null ?? actor.model).getPosition();
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
      const look = { colour: light ?? (actor.strings ? ['#eef3ff', '#49d3c2'] as const : actor.mesh ? ['#eafff0', PHOSPHOR] as const : actor.minion && !actor.camp ? ['#ffd0e6', '#ff5fa2'] as const : ['#fff1cc', '#ffb347'] as const), width: light ? .2 : .15, intensity: light ? 3 : 1.8, core: light ? .7 : .45 };
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
      tintSkin(onion.skin, shown);
    }
    const want = onionSize(onion.kind, onion.shown);
    onion.size = animate ? onion.size + (want - onion.size) * (1 - Math.exp(-dt * 14)) : want;
    f.scale.set(onion.size, onion.size, onion.size);
  }
  /**
   * Haru stands a step ahead of Papagato's wearer, towards the foes, watching them (src/cat-gait.ts
   * does her legs, ears and tail); Yuki sits a step behind. Zarpazo sangriento: she leaps on the
   * target, lands low to swat, and hops back. Ronroneo: Yuki trots to the feet of whoever she
   * cures, settles against them, and goes back to sit. Off Papagato they go: in a puff
   * of smoke when it is the ánima that brings them, or, lent by Nuria (Uri's tower), stepping aside
   * behind the party to sit it out until someone wears it again.
   */
  function updateCats(dt: number, t: number, animate: boolean, target?: Fighter) {
    const wears = (id: string) => (fighters.get(id)?.hp ?? 0) > 0 && state?.allies.find(a => a.id === id)?.classId === 'papagato';
    // Borrowed, there are only these two: with the first who wears Papagato (whoever of them asks,
    // they answer) or, if nobody does right now, sitting it out by whoever is still up.
    const party = [...fighters].filter(([, f]) => f.party);
    const keeper = borrowed && (party.find(([id]) => wears(id)) ?? party.find(([, f]) => f.hp > 0))?.[0];
    // Siete vidas going off on a blow: one Yuki is in front of whoever it saves (the first pair shown).
    const saved = effect?.lives ? fighters.get(effect.lives.target) : undefined;
    const guard = saved ? borrowed ? keeper : party.find(([id]) => wears(id) || (cats.get(id)?.yuki.entity.enabled ?? false))?.[0] : undefined;
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
      // (Yuki says whether they are shown: Haru can be gone into the dark, Acecho.)
      if (!borrowed && animate && entryTime >= ENTRY_SECONDS && visible !== pair.yuki.entity.enabled) {
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
      const relay = effect?.dual?.id === 'relevo-de-sangre' && (borrowed ? effect.dual.actors.some(wears) : effect.dual.actors.includes(id) && wearing);
      const mine = relay || dualHere || (borrowed ? !!effect && wears(effect.actor) : effect?.actor === id);
      // Borrowed and not busy, they get to their places on their own legs.
      const walks = !!borrowed && !mine;
      // Haru: on guard, or the pounce out, the swat and the hop back.
      const rest = aside ? behind(-1.2, 1.1) : new pc.Vec3(spots.haru.x, 0, spots.haru.z);
      let at = rest.clone(), lift = 0, look = center, leap: number | undefined, crouch = 0;
      // Acecho: how much of her shows (0 sunk in the dark, 1 whole), how red her eyes burn, and whether she is gone.
      let size = 1, glare = 0, gone = false;
      const stalked = state?.allies.find(a => a.id === id)?.stalk, prey = stalked ? fighters.get(stalked.target) : undefined;
      // Cacería and Siete vidas: from claw to claw, each on the foe it found (Cacería's odd claws are Yuki's).
      const hunt = mine && !!effect?.hunt?.length && animate ? effect.hunt : undefined;
      const huntContact = CONTACT_SECONDS, gap = hunt ? huntGap(hunt.length) : 0;
      const clawsOf = (yuki: boolean) => (hunt ?? []).flatMap((claw, k) => {
        const foe = fighters.get(claw.target);
        if (!foe || (effect!.skill === 'caceria' && (k % 2 === 1) !== yuki) || (effect!.skill !== 'caceria' && yuki)) return [];
        const s = spots.strike(foe.base), wide = Math.max(0, foe.scale.x - 1) * .6, off = yuki ? .55 : 0;
        return [{ at: huntContact + k * gap, mark: new pc.Vec3(s.x - ahead.x * wide + side.x * off, 0, s.z - ahead.z * wide + side.z * off), foe: foe.base }];
      });
      /** A cat's run along its claws: crouched, a leap to the first, a dash to each next, a hop on one it stays on, then home. */
      const along = (list: ReturnType<typeof clawsOf>, from: pc.Vec3) => {
        const pose = { at: from.clone(), lift: 0, look: list[0]?.foe ?? center, leap: undefined as number | undefined, crouch: 0 };
        if (!list.length) return pose;
        const first = list[0].at, last = list[list.length - 1].at, home = spots.back(from);
        if (t < first - .22) pose.crouch = 1;
        else if (t < first) { const u = smooth((t - first + .22) / .22); pose.at = new pc.Vec3().lerp(from, list[0].mark, u); pose.lift = Math.sin(u * Math.PI) * .55; pose.leap = u; }
        else if (t <= last + .12) {
          let k = 0;
          while (k + 1 < list.length && t >= list[k + 1].at) k++;
          const next = list[k + 1];
          pose.look = list[k].foe;
          if (next && t > list[k].at + .03) { const u = smooth((t - list[k].at - .03) / (next.at - list[k].at - .03)); pose.at = new pc.Vec3().lerp(list[k].mark, next.mark, u); pose.lift = Math.sin(u * Math.PI) * .3; pose.leap = u; pose.look = next.foe; }
          else { pose.at = list[k].mark.clone(); pose.crouch = 1; }
        } else {
          const u = smooth((t - last - .12) / .45);
          pose.at = new pc.Vec3().lerp(list[list.length - 1].mark, from, u); pose.lift = Math.sin(u * Math.PI) * .4; pose.leap = u < 1 ? u : undefined;
          if (u > .05) pose.look = new pc.Vec3(home.x, 0, home.z);
        }
        pose.at.y = 0;
        return pose;
      };
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
      } else if (effect?.stalker === id && effect.dual && effect.stalking && target) {
        // Arco voltaico: she does not go into the dark. She crouches where she is, eyes on the prey, while the arch is drawn.
        crouch = 1; look = target.base;
      } else if (mine && effect?.pounceDual && target) {
        // Arco voltaico's pounce: she runs the arch Gerard drew, a thrown body's flight, and drops down its axis onto the prey.
        const g = arcOf(effect, rest, target);
        arcRest.x = rest.x; arcRest.y = groundHeight(rest.x, rest.z); arcRest.z = rest.z;
        const run = arcRun(g, arcRest, animate ? t : 0, arcPose);
        at.set(run.at.x, 0, run.at.z); lift = run.lift; leap = run.leap; crouch = animate ? run.crouch : 0;
        look = !animate || t >= ARC_POUNCE.stay ? center : t < ARC_POUNCE.apex ? new pc.Vec3(target.base.x + g.dir.x * 3, 0, target.base.z + g.dir.z * 3) : target.base;
        glare = t >= ARC_POUNCE.foot && t < ARC_POUNCE.stay ? 1 : 0;
      } else if (mine && effect?.stalking && target) {
        // Acecho: she crouches, eyes on the prey; the dark pools under her and she sinks into it, her eyes flaring red as she goes.
        crouch = 1; look = target.base;
        if (!animate) gone = true;
        else {
          if (t >= ACECHO.pool) once(effect, `pool:${id}`, () => { umbra(rest, 18, .35); cue('sink'); });
          const u = smooth((t - ACECHO.sink) / (ACECHO.gone - ACECHO.sink));
          size = 1 - u; lift = -.28 * u; glare = Math.sin(u * Math.PI);
          gone = t >= ACECHO.gone;
        }
      } else if (mine && effect?.pounce && target) {
        // Acecho's pounce: out of the dark behind the prey, red eyes first, a still beat, the spring onto its back,
        // and back into the dark, to come out again at her place.
        const from = pounceFrom(effect, target), d = Math.hypot(target.base.x - from.x, target.base.z - from.z) || 1;
        const reach = Math.max(.25, d - Math.max(.35, extent(target).radius * .6));
        const onBack = new pc.Vec3(from.x + (target.base.x - from.x) / d * reach, 0, from.z + (target.base.z - from.z) / d * reach);
        look = target.base; crouch = 1; glare = 1;
        if (!animate || t >= ACECHO.home) { at = rest; glare = 0; crouch = 0; look = center; }
        else if (t < ACECHO.rise) {
          gone = true;
          once(effect, `well:${id}`, () => { umbra(from, 24, .5); cue('sink'); });
          if (t >= ACECHO.eyes) once(effect, `eyes:${id}`, () => {
            // Two red points in the dark, a cat's eyes apart, facing the prey.
            const fx = (target.base.x - from.x) / d, fz = (target.base.z - from.z) / d, y = groundHeight(from.x, from.z) + .3;
            for (const s of [-1, 1]) effects.emit('glare', new pc.Vec3(from.x + fx * .2 - fz * .055 * s, y, from.z + fz * .2 + fx * .055 * s), 1, 0);
            cue('creak');
          });
        } else if (t < ACECHO.risen) { const u = smooth((t - ACECHO.rise) / (ACECHO.risen - ACECHO.rise)); at = from; size = u; lift = -.3 * (1 - u); }
        else if (t < ACECHO.spring) {
          // She looks at us: her face turned to the camera, the eyes burning, and back to the prey to spring.
          at = from;
          const view = viewDir(), vl = Math.hypot(view.x, view.z) || 1, stare = Math.min(smooth((t - ACECHO.risen) / (ACECHO.stare - ACECHO.risen)), 1 - smooth((t - ACECHO.spring + .1) / .1));
          const camera = new pc.Vec3(from.x + view.x / vl * 3, 0, from.z + view.z / vl * 3);
          look = new pc.Vec3().lerp(target.base, camera, stare);
          if (t >= ACECHO.stare) once(effect, `stare:${id}`, () => { for (const eye of pair.haru.eyesAt()) effects.emit('glare', eye, 1, 0); cue('creak'); });
        }
        else if (t < ACECHO.contact) { const u = smooth((t - ACECHO.spring) / (ACECHO.contact - ACECHO.spring)); at = new pc.Vec3().lerp(from, onBack, u); lift = Math.sin(u * Math.PI) * .75; leap = u; crouch = 0; }
        else if (t < ACECHO.melt) at = onBack;
        else if (t < ACECHO.away) {
          once(effect, `melt:${id}`, () => umbra(onBack, 16, .35));
          const u = smooth((t - ACECHO.melt) / (ACECHO.away - ACECHO.melt));
          at = onBack; size = 1 - u; lift = -.28 * u; glare = 1 - u;
        } else {
          once(effect, `home:${id}`, () => umbra(rest, 12, .3));
          const u = smooth((t - ACECHO.away) / (ACECHO.home - ACECHO.away));
          at = rest; size = u; lift = -.28 * (1 - u); glare = 0; crouch = 1 - u; look = center;
        }
      } else if (hunt) {
        ({ at, lift, look, leap, crouch } = along(clawsOf(false), rest));
      } else if (mine && (relay || effect?.skill === 'zarpazo' || effect?.skill === 'zarpazos') && target) {
        // Zarpazos: she stays on the target until the last little claw has landed, and hops back quicker.
        const flurry = effect?.skill === 'zarpazos' ? (effect.strikes?.length ?? 1) - 1 : 0, stay = flurry * CLAW_SECONDS;
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
      } else if (wearing && ((stalked?.dual && prey && prey.hp > 0) || state?.news?.some(news => news.pounceDual && news.actor === id))) {
        // Arco voltaico: charged, she waits where everyone can see her, crouched, eyes on the prey (her fur stands, src/duo-fx).
        crouch = 1; if (prey) look = prey.base;
      } else if (wearing && ((prey && prey.hp > 0) || state?.news?.some(news => news.pounce && news.actor === id))) {
        // Gone into the dark until the round starts and her pounce plays (Acecho): nothing of her shows.
        gone = true;
      }
      pair.haru.entity.enabled = visible && !gone;
      pair.haru.glare(glare);
      placeCat(pair.haru, dt, at, lift, look, animate, wearing ? { alert: 1, crouch, leap } : { sit: 1 }, walks, size);
      // Yuki: sitting behind, or over to whoever she purrs on (Ronroneo): she trots to their feet, settles against them and comes back.
      const shelter = aside ? behind(-1.6, .5) : new pc.Vec3(spots.yuki.x, 0, spots.yuki.z);
      const purr = mine && effect?.skill === 'ronroneo' && target ? (animate ? clamp01(Math.sin(clamp01(t / 1.1) * Math.PI) * 1.7) : 0) : 0;
      const feet = target ? new pc.Vec3(target.base.x + side.x * .4 - ahead.x * .12, 0, target.base.z + side.z * .4 - ahead.z * .12) : shelter;
      const spot = new pc.Vec3().lerp(shelter, feet, purr);
      const wardWalk = mine && animate && effect?.ward?.length ? effect.ward.flatMap(other => { const o = fighters.get(other); return o ? [new pc.Vec3(o.base.x + side.x * .45 - ahead.x * .1, 0, o.base.z + side.z * .45 - ahead.z * .1)] : []; }) : undefined;
      if (hunt && effect!.skill === 'caceria' && clawsOf(true).length) {
        // Cacería: Yuki hunts too, the claws in between Haru's.
        const pose = along(clawsOf(true), shelter);
        placeCat(pair.yuki, dt, pose.at, pose.lift, pose.look, animate, { alert: 1, crouch: pose.crouch, leap: pose.leap }, walks);
      } else if (wardWalk?.length) {
        // Siete vidas: Yuki walks among the party, a stop at each one's feet, and back to sit.
        const stops = [shelter, ...wardWalk, shelter], walked = Math.max(0, t - .1);
        const leg = Math.min(stops.length - 2, Math.floor(walked / WARD_STEP)), k = smooth(clamp01((walked - leg * WARD_STEP) / (WARD_STEP * .7)));
        const p = new pc.Vec3().lerp(stops[leg], stops[leg + 1], k);
        placeCat(pair.yuki, dt, p, 0, k < 1 ? stops[leg + 1] : center, animate, { sit: k >= 1 && leg < stops.length - 2 ? .6 : 0, alert: .4 }, walks);
      } else if (saved && id === guard && animate) {
        // Siete vidas going off: Yuki dashes in front of whoever it saves, facing the blow, holds, and goes back.
        const from = fighters.get(effect!.actor)?.base ?? center, dx = from.x - saved.base.x, dz = from.z - saved.base.z, d = Math.hypot(dx, dz) || 1;
        const front = new pc.Vec3(saved.base.x + dx / d * .7, 0, saved.base.z + dz / d * .7);
        const go = smooth(t / (CONTACT_SECONDS * .8)), back = smooth((t - CONTACT_SECONDS - .75) / .4);
        const p = back > 0 ? new pc.Vec3().lerp(front, shelter, back) : new pc.Vec3().lerp(shelter, front, go);
        const flying = go < 1 ? go : back > 0 && back < 1 ? back : undefined;
        placeCat(pair.yuki, dt, p, flying !== undefined ? Math.sin(flying * Math.PI) * .45 : 0, back > .05 ? shelter : new pc.Vec3(from.x, 0, from.z), animate, { alert: 1, leap: flying });
      } else
      placeCat(pair.yuki, dt, spot, 0, purr > .5 && target ? new pc.Vec3(target.base.x, 0, target.base.z) : center, animate, { sit: purr > .02 && purr < .98 ? 0 : 1 }, walks);
    }
  }
  /**
   * Dadista's dice (src/dice.ts): its maná, floating in a column beside whoever wears it, on the side
   * away from the others, each with its face turned to the camera, never quite still: each drifts,
   * bobs and turns a little on a pace of its own. New ones (Defender, a round's rest, the fight
   * starting) drop in tumbling. The one Tirar dado spends leaves the hand, flies at whom its face
   * reaches tumbling (a foe; an ally, Corchete), lands on them and bounces off. The Comodín is the
   * black one with the star.
   */
  function updateDice(dt: number, t: number, animate: boolean, target?: Fighter) {
    if (!state || (!dice.size && !state.allies.some(a => a.classId === DICED))) return;
    const c = camera(), flat = Math.hypot(c.x, c.z) || 1, toCamera = { x: c.x / flat, z: c.z / flat }, across = { x: toCamera.z, z: -toCamera.x };
    // The turn that brings a die's top face round to the camera, most of the way: its number reads, and it is still a cube.
    const view = viewDir(), facing = new pc.Vec3(view.x * .82, view.y * .82 + .18, view.z * .82).normalize();
    const tiltAxis = new pc.Vec3().cross(pc.Vec3.UP, facing).normalize(), tilt = new pc.Quat().setFromAxisAngle(tiltAxis, Math.acos(clamp01(facing.y)) * 180 / Math.PI);
    const party = [...fighters].filter(([, f]) => f.party);
    const spin = new pc.Quat(), want = new pc.Quat(), rock = new pc.Quat(), place = new pc.Vec3(), now = performance.now() / 1000;
    /** A die at rest: its face to the camera, turned `yaw` degrees about it and leaning `lean` to one side. */
    const settle = (face: DieFace, yaw: number, lean = 0) => {
      want.mul2(tilt, spin.setFromAxisAngle(pc.Vec3.UP, yaw).mul(faceUp(face)));
      return lean ? want.mul2(rock.setFromAxisAngle(facing, lean), want) : want;
    };
    for (const [id, f] of party) {
      const unit = state.allies.find(a => a.id === id);
      const wearing = !!unit && f.hp > 0 && unit.classId === DICED && entryTime >= ENTRY_SECONDS * .6;
      let d = dice.get(id);
      if (!d && !wearing) continue;
      if (!d) { d = { hand: [], shown: 0 }; dice.set(id, d); }
      const others = party.filter(([other, o]) => other !== id && o.hp > 0).reduce((sum, [, o]) => sum + (f.base.x - o.base.x) * across.x + (f.base.z - o.base.z) * across.z, 0);
      const out = Math.sign(others) || 1, floor = groundHeight(f.base.x, f.base.z), size = DIE.size * f.scale.y;
      const make = (face: DieFace): HandDie => {
        const entity = createDie(app); battleRoot.addChild(entity);
        return { entity, face, at: new pc.Vec3(f.base.x, floor + 2.6 * f.scale.y, f.base.z), turn: new pc.Quat(), size: 0, age: 0, tumble: new pc.Vec3(Math.random() - .5, Math.random() - .5, Math.random() - .5).normalize(), sway: Math.random() * 60, pace: .75 + Math.random() * .5 };
      };
      // The die this action spends leaves the hand as the action starts.
      const acting = effect?.actor === id && effect.die ? effect : undefined;
      if (acting && d.seen !== acting) {
        d.seen = acting;
        const die = d.hand.splice(acting.die!.at, 1)[0];
        d.thrown?.die.entity.destroy();
        d.thrown = die && animate ? { die, action: acting, from: die.at.clone() } : undefined;
        if (die && !animate) die.entity.destroy();
      }
      if (d.thrown && d.thrown.action !== effect) { d.thrown.die.entity.destroy(); d.thrown = undefined; }
      // The hand, in step with the fight's: as many as there is maná, each with its face.
      const hand = wearing ? diceOf(state, unit!) : unit && d.hand.length ? unit.dice ?? [] : [];
      while (d.hand.length > hand.length) d.hand.pop()!.entity.destroy();
      for (const had = d.hand.length; d.hand.length < hand.length;) { const die = make(hand[d.hand.length]); die.age = animate ? -.09 * (d.hand.length - had) : 1; d.hand.push(die); }
      d.shown = animate ? Math.max(0, Math.min(1, d.shown + (wearing ? dt : -dt) / .25)) : wearing ? 1 : 0;
      d.hand.forEach((die, i) => {
        die.face = hand[i]; dressDie(app, die.entity, die.face);
        die.age += dt;
        // A column by the shoulder, the first die lowest, each a little off the line. Idle, each one
        // wanders on its own: two slow waves that never line up, so it is a sway and not a loop.
        const aimed = aimedDie?.unit === id && aimedDie.index === i && !effect ? 1 : 0;
        const s = animate ? die.sway + now * die.pace : 0, calm = animate ? 1 - aimed * .7 : 0;
        const bob = (Math.sin(s * 1.9) * .03 + Math.sin(s * 3.1 + 1.3) * .012) * calm, drift = (Math.sin(s * 1.3 + 2.1) * .024 + Math.sin(s * 2.3) * .01) * calm, near = Math.sin(s * 1.1 + .7) * .018 * calm;
        const reach = (.56 + (i % 2) * .09 + aimed * .16) * f.scale.x + drift * out;
        place.set(f.base.x + across.x * reach * out + toCamera.x * (.16 + aimed * .2 + near), floor + (.62 + i * .3 + aimed * .05) * f.scale.y + bob, f.base.z + across.z * reach * out + toCamera.z * (.16 + aimed * .2 + near));
        // Dealt: it drops in from above tumbling and settles; then it only sways.
        const land = animate ? smooth(die.age / .42) : 1;
        if (land < 1) {
          die.at.set(place.x, place.y + (1 - land) * (1 - land) * 1.5, place.z);
          die.turn.slerp(spin.setFromAxisAngle(die.tumble, die.age * 900), settle(die.face, 0), land * land);
        } else {
          die.at.lerp(die.at, place, animate ? 1 - Math.exp(-dt * 12) : 1);
          die.turn.slerp(die.turn, settle(die.face, (Math.sin(s * 1.5 + .4) * 12 + Math.sin(s * .7) * 6) * calm, (Math.sin(s * 1.7 + 2.6) * 7 + Math.sin(s * 2.9) * 3) * calm), animate ? 1 - Math.exp(-dt * 10) : 1);
        }
        die.size = size * (die.age < 0 ? 0 : 1) * d!.shown * (1 + aimed * .22 + (land < 1 ? Math.sin(land * Math.PI) * .2 : 0));
        die.entity.enabled = die.size > .001;
        die.entity.setPosition(die.at); die.entity.setRotation(die.turn); die.entity.setLocalScale(die.size, die.size, die.size);
      });
      const thrown = d.thrown;
      if (!thrown) continue;
      const { die, action } = thrown;
      // A die that pays for Estrella fugaz turns to glass and light as it leaves the hand.
      dressDie(app, die.entity, die.face, !action.die?.as);
      // Where it is held before it goes: over the wearer's raised hand.
      const held = new pc.Vec3(f.base.x + across.x * .3 * out + toCamera.x * .2, floor + 1.72 * f.scale.y, f.base.z + across.z * .3 * out + toCamera.z * .2);
      const chest = target ? chestOf(target) : held;
      const launch = DICE.launch, contact = diceContact(action), astralDie = !action.die?.as;
      let grow = 1;
      if (t < launch) {
        // Drawn back over the hand, face to the camera, swelling: the wind-up.
        const lift = smooth(t / launch);
        die.at.lerp(thrown.from, held, lift); die.turn.slerp(die.turn, settle(die.face, 0), 1 - Math.exp(-dt * 14));
        // A step back along the throw just before it goes.
        if (target) die.at.add(place.set(held.x - chest.x, 0, held.z - chest.z).normalize().mulScalar(.22 * lift * lift));
        grow = 1 + lift * .5;
        if (astralDie && animate) { thrown.shed = (thrown.shed ?? 0) + dt * 60 * lift; for (; thrown.shed >= 1; thrown.shed--) effects.emit('astral', die.at, 1, .16); }
      } else if (skyOf(action)) {
        // A skill from the sky: the die turns to light and goes up out of the frame, its stars after it.
        const u = clamp01((t - launch) / .38);
        die.at.copy(held); die.at.y += u * u * 7;
        grow = u >= 1 ? 0 : 1.5 - u * .7;
        die.turn.copy(spin.setFromAxisAngle(die.tumble, (t - launch) * 1500)).mul(faceUp(die.face));
        if (animate && u < 1) { thrown.shed = (thrown.shed ?? 0) + dt * 150; for (; thrown.shed >= 1; thrown.shed--) effects.emit('astral', die.at, 1, .12); }
      } else if (t < contact) {
        // Thrown hard: nearly straight at the chest of whom it reaches, faster all the way, growing as it comes,
        // and what it leaves behind is a streak (paper for a face, stars for the astral).
        const u = clamp01((t - launch) / (contact - launch)), before = thrown.last ?? held.clone();
        die.at.lerp(held, chest, u * u * .7 + u * .3); die.at.y += Math.sin(u * Math.PI) * (astralDie ? .06 : .16);
        grow = 1.5 + u * .7;
        die.turn.copy(spin.setFromAxisAngle(die.tumble, (t - launch) * 2200)).mul(faceUp(die.face));
        if (animate) {
          dualFx.line(v3(before), v3(die.at), astralDie ? '#bfe0ff' : DICE_COLOURS.paper, { count: 14, life: astralDie ? .3 : .13, size: astralDie ? 2.6 : 2.1 });
          if (astralDie) { thrown.shed = (thrown.shed ?? 0) + dt * 190; for (; thrown.shed >= 1; thrown.shed--) effects.emit('astral', die.at, 1, .1); }
        }
        thrown.last = die.at.clone();
      } else if (astralDie) {
        // It went out on them as the star: nothing is left of the die.
        grow = 0;
      } else {
        // It hits and stays a beat, big against them, while the stamp comes down; then it is knocked
        // back off them, high and spinning, lands, hops once and is gone.
        const since = t - contact, stuck = .07, u = clamp01((since - stuck) / (DICE.tail - stuck - .08)), ground = groundHeight(chest.x, chest.z) + size * .5;
        const away = place.set(held.x - chest.x, 0, held.z - chest.z).normalize();
        if (since < stuck) { die.at.copy(chest); grow = 2.3 - since / stuck * .5; }
        else {
          const first = Math.min(1, u / .68), hop = Math.max(0, (u - .68) / .32);
          die.at.copy(chest).add(away.mulScalar(first * 1.25 + hop * .3));
          die.at.y = hop > 0 ? ground + Math.sin(hop * Math.PI) * .22 : chest.y + (ground - chest.y) * first * first + Math.sin(Math.min(1, first * 1.25) * Math.PI) * .85;
          grow = 1.5 * (1 - smooth((u - .8) / .2));
          die.turn.copy(spin.setFromAxisAngle(die.tumble, since * 1700)).mul(faceUp(die.face));
        }
      }
      die.size = size * grow;
      die.entity.enabled = die.size > .001;
      die.entity.setPosition(die.at); die.entity.setRotation(die.turn); die.entity.setLocalScale(die.size, die.size, die.size);
      if (t >= diceEnd(action)) { die.entity.destroy(); d.thrown = undefined; }
    }
  }
  /** Where a Bomba remota sits on `f`: on its chest, on the side the camera sees, a little up. */
  function bombSpot(f: Fighter) {
    const chest = chestOf(f), v = viewDir(), { radius } = extent(f);
    return new pc.Vec3(chest.x + v.x * radius * .8, chest.y + .08 * f.scale.y, chest.z + v.z * radius * .8);
  }
  /** A bomb on `id`, made now if it has none: `wait` seconds before it shows (Bip's throw on its way). */
  function ensureBomb(id: string, wait = 0) {
    let b = bombs.get(id);
    if (!b) { b = { bomb: createBomb(app), next: 0, shown: -wait / .25 }; battleRoot.addChild(b.bomb.entity); bombs.set(id, b); }
    return b;
  }
  /**
   * Each foe's Bomba remota, every frame: stuck on its chest facing the camera, bigger the more it has grown, its lamp flashing
   * red on a beat that quickens as its time runs out (a beep with each flash once it is close, and a red flare round it).
   * A bomb gone from the foe without a blast (the foe fell) just goes; one Explosión set off waits for its blast.
   */
  function updateBombs(dt: number, animate: boolean) {
    const lensed: { x: number; y: number; z: number; radius: number; strength: number }[] = [];
    for (const [id, b] of [...bombs]) if (b.implode) {
      // The hole opens slowly and then all at once, as it swallows the space round it.
      const u = clamp01(b.implode.t / b.implode.dur);
      lensed.push({ x: b.implode.at.x, y: b.implode.at.y, z: b.implode.at.z, radius: BOMB.hole * b.implode.big, strength: .15 + .85 * u ** 1.6 });
      implodeFrame(id, b, dt);
    }
    // Burst, it snaps shut and its shock runs out in a breath.
    for (let i = holes.length - 1; i >= 0; i--) {
      const h = holes[i]; h.t += dt;
      const k = 1 - smooth(h.t / .22);
      if (k <= 0) { holes.splice(i, 1); continue; }
      lensed.push({ x: h.at.x, y: h.at.y, z: h.at.z, radius: h.radius * (1 + 1.5 * (1 - k)), strength: k * .7 });
    }
    setLens?.(lensed);
    for (const [id, f] of fighters) {
      if (f.party) continue;
      const unit = state?.foes.find(u => u.id === id), on = unit?.timed?.bomba;
      let b = bombs.get(id);
      if (b?.implode) continue;
      // Atractor extraño: a bomb stays on its foe until it rises off it, and comes to the target as the butterfly falls in.
      const gathered = animate && effect?.gathered && !impacted ? gatheringNow(effect) : undefined;
      if (b && gathered?.held.has(id) && id !== effect?.target) continue;
      if (!on) {
        if (b && !b.fuse && !(animate && effect && !impacted && effect.detonated?.some(d => d.target === id))) { b.bomb.destroy(); bombs.delete(id); }
        if (!bombs.has(id)) continue;
        b = bombs.get(id)!;
      } else if (!b) {
        // Stuck on as the action that planted it lands (`ensureBomb` from its burst); without motion, at once.
        if (animate && effect && !impacted && effect.planted?.includes(id)) continue;
        if (gathered && id === effect?.target) continue;
        b = ensureBomb(id);
      }
      const left = on?.left ?? 0, heat = on ? 1 - clamp01(left / BOMBA.seconds) : 1;
      const charge = on ? clamp01((bombPower(on.age ?? 0) - BOMBA.base) / (BOMBA.top - BOMBA.base)) : 1;
      b.shown = animate ? Math.min(1, b.shown + dt / .25) : 1;
      const entity = b.bomb.entity;
      entity.enabled = b.shown > 0 && f.model.enabled;
      const spot = bombSpot(f), size = BOMB.size * f.scale.y * (1 + BOMB.grows * charge);
      entity.setPosition(spot); entity.lookAt(chestOf(f)); entity.setLocalScale(size, size, size);
      if (b.shown > 0 && on && animate) {
        b.next -= dt;
        if (b.next <= 0) {
          const beat = BOMB.fast + (BOMB.longest - BOMB.fast) * clamp01(left / BOMB.slow) ** 1.3;
          b.next = beat; b.bomb.flash(heat);
          const close = clamp01((heat - .3) / .7);
          dualFx.ring(v3(spot), viewDir(), (.1 + .12 * close) * f.scale.y, BOMB.red, { count: Math.round(14 + 40 * close), outward: 1 + 2 * close, life: .2 + .1 * close, size: 1 + .4 * close, ...close > .4 ? { light: 1 + 2.5 * close } : {} });
          if (heat > .35) cue('bomb-beep');
          // Enjambre's network beats red with its bombs.
          if (swarmHeld.has(id)) swarmFx.beat(.55 + .45 * heat);
        }
      }
      b.bomb.animate(dt, { heat, charge, shown: Math.max(0, b.shown), animate });
    }
    for (const [id, b] of bombs) if (!fighters.has(id)) { b.bomb.destroy(); bombs.delete(id); }
  }
  /**
   * A Bomba remota goes off on `id` (its clock, or Explosión). First it implodes (`BOMB.implode` seconds, shorter when Explosión
   * sets it off): a small black hole opens where it is, bending the picture round it (post.ts `lens`) while light and sparks
   * spiral into it and the bomb crushes down to nothing; then it bursts: a white flash, the hole snapping shut, a fireball, red
   * shock along the floor and Bip's sparks (`bombBang`).
   */
  function bombBlast(id: string, quick = false) {
    const b = bombs.get(id);
    if (!b || b.implode) return;
    const at = b.bomb.entity.getPosition().clone(), big = b.bomb.entity.getLocalScale().x / BOMB.size;
    if (!animating) { b.bomb.destroy(); bombs.delete(id); return; }
    b.fuse = true; b.implode = { t: 0, dur: quick ? BOMB.implode * .55 : BOMB.implode, at, big };
    cue('charge'); cue('sink', { delay: .1 });
    const f = fighters.get(id);
    if (f) hit(f, cyanFlash, .4);
  }
  /** One frame of a bomb imploding (`bombBlast`): the light and sparks it swallows, the bomb crushing; at its end, the burst. */
  function implodeFrame(id: string, b: NonNullable<ReturnType<typeof bombs.get>>, dt: number) {
    const im = b.implode!, u = clamp01(im.t / im.dur), at = im.at, up = { x: 0, y: 1, z: 0 };
    im.t += dt;
    // Drawn in: rings of sparks and Bip's nanites closing on it, faster as it goes, and streaks of light pulled off the space round it.
    if (Math.floor((im.t - dt) / .07) !== Math.floor(im.t / .07)) {
      const r = (.9 - .4 * u) * im.big;
      dualFx.ring(v3(at), viewDir(), r, u < .5 ? BIP.cyan : '#ffd2c4', { kind: 'nanite', count: Math.round(22 + 34 * u), outward: -(2.5 + 6 * u), around: 5 + 6 * u, life: .22, size: 1.05 });
      dualFx.ring(v3(at), up, r * 1.2, BOMB.red, { count: 20, outward: -(3 + 5 * u), around: -4, life: .2, size: 1 });
      for (let k = 0; k < 2; k++) {
        const a = Math.random() * Math.PI * 2, e = Math.random() * .8 - .4, R = (1 + Math.random() * .5) * im.big;
        effects.trails.comet({ x: at.x + Math.cos(a) * R, y: at.y + e * R, z: at.z + Math.sin(a) * R }, v3(at), ['#ffffff', u < .5 ? BIP.cyan : '#ff8a6a'], .16, { arc: .5, width: .03, life: .2, intensity: 2.6, core: .5, additive: 1, twist: { turns: 1, radius: .1, phase: a } });
      }
    }
    // The bomb crushes down and spins, its lamp burning steady.
    b.bomb.flash(1);
    const entity = b.bomb.entity, size = BOMB.size * im.big * Math.max(.001, 1 - u * u);
    entity.setPosition(at); entity.setLocalScale(size, size, size); entity.rotateLocal(0, 0, dt * 900 * u);
    b.bomb.animate(dt, { heat: 1, charge: 1, shown: 1, animate: true });
    if (im.t >= im.dur) { bombBang(id, at, im.big); b.bomb.destroy(); bombs.delete(id); }
  }
  /** The bomb's burst, once its black hole has drawn everything in: the hole snaps shut in a flash and it all comes back out. */
  function bombBang(id: string, at: pc.Vec3, big: number) {
    const f = fighters.get(id), floor = groundHeight(at.x, at.z);
    holes.push({ at: at.clone(), t: 0, radius: BOMB.hole * big });
    dualFx.ring(v3(at), viewDir(), .15, '#ffffff', { count: 120, outward: 9, life: .25, size: 1.7, light: 6 });
    fluidFx.fireball({ x: at.x, y: Math.max(floor + .45, at.y), z: at.z }, .6 + .4 * big, 1.15);
    effects.element('fire', v3(at), { strength: 1.2 + .6 * big });
    dualFx.shock({ x: at.x, y: floor, z: at.z }, 1.8 + .9 * big, BOMB.red, { chips: 90, light: true, heavy: big > 1.3 });
    dualFx.burst('bipzap', { at: v3(at), count: 90, speed: 5, up: .8, life: [.25, .65] });
    dualFx.after(.04, () => dualFx.ring(v3(at), { x: 0, y: 1, z: 0 }, .35, BOMB.red, { count: 80, outward: 6, life: .3, size: 1.4 }));
    dualFx.after(.02, () => dualFx.ring(v3(at), viewDir(), .3, BIP.cyan, { kind: 'nanite', count: 120, outward: 7, around: -3, life: .35, size: 1.2 }));
    if (f) hit(f, flame, 1.7);
    shake = Math.max(shake, .5 + .25 * big); pulse?.(.6, .55, .25);
    cue('slam'); cue('fire-hit', { delay: .02 });
  }
  /** Whom the Bip of `wearer` stands by now (Escolta), if anyone. */
  function escortOf(wearer: string) {
    if (!state) return undefined;
    const by = state.allies.find(a => a.id === wearer);
    if (!by || by.hp <= 0 || by.classId !== 'tecnopata') return undefined;
    return state.allies.find(a => a.escort?.by === wearer && a.hp > 0 && a.escort.until >= state!.round);
  }
  /**
   * Escolta's lasting look, every frame: under whoever Bip stands by, a double ring of cyan light on the floor turning slowly,
   * its glow breathing; Bip's tether crackles from it to them now and then, and bits of light rise round them.
   */
  function updateEscorts(dt: number, animate: boolean) {
    const kept = new Set<string>();
    for (const [wearer, b] of bips) {
      const ally = b.shown ? escortOf(wearer) : undefined, f = ally ? fighters.get(ally.id) : undefined;
      if (!ally || !f) continue;
      // It shows once Bip has arrived (Escolta's own action at its contact).
      if (animate && effect?.skill === 'escolta' && effect.target === ally.id && !impacted) continue;
      kept.add(ally.id);
      let e = escorts.get(ally.id);
      if (!e) {
        const mat = new pc.StandardMaterial(); mat.diffuse.set(0, 0, 0); mat.emissive.fromString(BIP.cyan); mat.emissiveIntensity = 1.6; mat.useLighting = false;
        mat.blendType = pc.BLEND_ADDITIVEALPHA; mat.opacity = 0; mat.depthWrite = false; mat.cull = pc.CULLFACE_NONE; mat.update();
        // Two thin rings of light (a unit ring, scaled to them), the outer one dashed by its own segments turning.
        const thin = (name: string, tube: number, sector = 360) => {
          const mesh = pc.Mesh.fromGeometry(app.graphicsDevice, new pc.TorusGeometry({ ringRadius: .5, tubeRadius: tube, sectorAngle: sector, segments: 72, sides: 6 }));
          const e = new pc.Entity(name); e.addComponent('render', { meshInstances: [new pc.MeshInstance(mesh, mat)], castShadows: false, receiveShadows: false });
          return e;
        };
        const ring = thin('Escolta', .012), inner = thin('Escolta, aro de dentro', .008, 300);
        battleRoot.addChild(ring); battleRoot.addChild(inner);
        e = { ring, inner, mat, beat: 0, shown: 0 };
        escorts.set(ally.id, e);
        if (animate) { const feet = floorUnder(f); dualFx.ring({ x: feet.x, y: feet.y + .06, z: feet.z }, { x: 0, y: 1, z: 0 }, Math.max(.55, extent(f).radius * 1.3), BIP.cyan, { kind: 'nanite', count: 120, outward: -1.2, life: .5, size: 1.2, light: 2 }); }
      }
      e.shown = animate ? Math.min(1, e.shown + dt / .35) : 1;
      const feet = floorUnder(f), r = Math.max(.55, extent(f).radius * 1.25), time = real;
      e.ring.setPosition(feet.x, feet.y + .04, feet.z); e.ring.setLocalScale(r * 2, r * 2, r * 2); e.ring.setEulerAngles(0, time * 40, 0);
      e.inner.setPosition(feet.x, feet.y + .05, feet.z); e.inner.setLocalScale(r * 1.6, r * 1.6, r * 1.6); e.inner.setEulerAngles(0, -time * 70, 0);
      e.mat.opacity = e.shown * (.75 + .25 * Math.sin(time * 4)); e.mat.update();
      if (!animate) continue;
      e.beat -= dt;
      if (e.beat <= 0) {
        e.beat = .45;
        const chest = chestOf(f), from = b.bip.entity.getPosition();
        dualFx.line(v3(from), v3(chest), BIP.cyan, { count: Math.round(from.distance(chest) * 18), life: .3, size: .9 });
        dualFx.burst('glyph', { at: { x: feet.x, y: feet.y + .2, z: feet.z }, count: 3, spread: r * .8, speed: .25, up: .9, life: [.5, .9], colour: BIP.cyan, size: 1 });
      }
    }
    for (const [id, e] of escorts) if (!kept.has(id)) {
      e.shown = animate ? e.shown - dt / .3 : 0;
      e.mat.opacity = Math.max(0, e.shown) * .75; e.mat.update();
      if (e.shown <= 0) { e.ring.destroy(); e.inner.destroy(); e.mat.destroy(); escorts.delete(id); }
    }
  }
  /**
   * What Tecnópata's bombs and Bip's guard do as an action lands: the bombs Explosión set off go up one after another; a foe that
   * struck someone Bip stands by meets a cyan shield where the blow lands, and Bip throws a bomb on it.
   */
  function tecnoLanded(e: BattleEffect) {
    e.detonated?.forEach((d, i) => { const b = bombs.get(d.target); if (b) b.fuse = true; dualFx.after(.05 + i * .12, () => bombBlast(d.target, true)); });
    const striker = e.planted && state?.foes.some(f => f.id === e.actor) ? fighters.get(e.actor) : undefined;
    const ally = striker && e.target ? fighters.get(e.target) : undefined, guard = e.target ? state?.allies.find(a => a.id === e.target)?.escort : undefined;
    if (!striker || !ally) return;
    const chest = chestOf(ally), to = chestOf(striker), dir = new pc.Vec3().sub2(to, chest).normalize(), shield = chest.clone().add(dir.clone().mulScalar(.45 * ally.scale.x));
    dualFx.ring(v3(shield), v3(dir), .5 * ally.scale.y, BIP.cyan, { count: 90, life: .35, size: 1.4, light: 3 });
    dualFx.ring(v3(shield), v3(dir), .32 * ally.scale.y, '#ffffff', { count: 50, outward: 1.5, life: .25, size: 1.2 });
    dualFx.burst('bipzap', { at: v3(shield), count: 40, speed: 3, life: [.2, .45] });
    const bip = guard ? bips.get(guard.by) : undefined;
    if (!bip) return;
    dualFx.after(.12, () => {
      const from = bip.bip.entity.getPosition(), spot = bombSpot(striker);
      effects.trails.comet(v3(from), v3(spot), ['#ffffff', BIP.cyan], .2, { arc: .25, width: .07, life: .35, intensity: 3, core: .6, additive: 1 });
      dualFx.after(.2, () => { dualFx.ring(v3(spot), viewDir(), .22, BIP.cyan, { kind: 'nanite', count: 50, outward: -1.4, life: .3, size: 1.1, light: 1.5 }); cue('clink'); });
    });
    ensureBomb(e.actor, .32);
  }
  /**
   * Bip floats by the shoulder of whoever wears Tecnópata, a step ahead and on the side away from the
   * others, watching the foes (src/bip.ts). Atacar is Bip's: it pulls back, darts at the target, rams
   * it, bounces off and comes back, while the wearer stays put pointing. Putting Tecnópata on, Bip
   * comes out of the wearer as a stream of cyan nanites that gathers at its place and powers up;
   * taking it off, or falling, it comes apart into nanites that go back into the wearer's chest.
   */
  function updateBips(dt: number, t: number, animate: boolean, target?: Fighter) {
    // Rayo solar's beam only shines while it is being let go (`solarFrame`).
    if (!(animate && effect?.release)) sunBeam.enabled = false;
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
      let rest = new pc.Vec3(f.base.x + across.x * reach * out + toCamera.x * .2, floor + BIP.height * f.scale.y, f.base.z + across.z * reach * out + toCamera.z * .2);
      // Escolta: Bip stands in front of whoever it guards, between them and the foes, a little to the camera's side.
      const guarded = wearing ? escortOf(id) : undefined, guard = guarded ? fighters.get(guarded.id) : undefined;
      if (guard) {
        const mid = foes.length ? foes.reduce((sum, o) => sum.add(o.base), new pc.Vec3()).mulScalar(1 / foes.length) : guard.base.clone().add(new pc.Vec3(ahead.x, 0, ahead.z));
        const toFoes = new pc.Vec3(mid.x - guard.base.x, 0, mid.z - guard.base.z).normalize(), ground = groundHeight(guard.base.x, guard.base.z);
        rest = new pc.Vec3(guard.base.x + toFoes.x * .62 * guard.scale.x + toCamera.x * .25, ground + BIP.height * .82 * guard.scale.y, guard.base.z + toFoes.z * .62 * guard.scale.x + toCamera.z * .25);
      }
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
      // Enjambre takes Bip apart for its launch, and it forms again at home (`swarmFrame`): how much of it is there.
      let whole = 1;
      const acting = b.shown && animate && !!target && effect?.actor === id && botStrikes(effect);
      // Sutura de luz: Bip goes to whoever is cured, beside their head, scans them and sews; then home.
      const sewing = animate && !!target && effect?.dual?.id === 'sutura-de-luz' && effect.dual.actors.includes(id) && t < DUO['sutura-de-luz'].end - .35;
      // Bombardeo orbital: up over the foes as it is charged, held, and while its salvos go.
      const orbiting = unit?.charge?.dual === 'bombardeo-orbital' || (animate && effect?.detonation === 'bombardeo-orbital' && t < BLAST['bombardeo-orbital'].end - .5);
      if (sewing) {
        const chest = chestOf(target!), v = viewDir(), side = screenAxes(v).right;
        const beside = new pc.Vec3(chest.x - side.x * .75 + v.x * .5, chest.y + .55 * target!.scale.y, chest.z - side.z * .75 + v.z * .5);
        b.at.lerp(b.at, beside, 1 - Math.exp(-dt * 8)); look = chest; lean = .3;
      } else if (orbiting) {
        b.at.lerp(b.at, new pc.Vec3(center.x, floor + 3.5, center.z), 1 - Math.exp(-dt * 4)); lean = .7;
      } else if (acting && effect!.skill === 'bomba-remota') {
        // Bomba remota: back a touch, an arc to the foe, a push in to stick the bomb on its chest (`contact`), a beat there, home.
        const { contact, end } = BIP_MOVES['bomba-remota'], spot = bombSpot(target!), away = new pc.Vec3().sub2(rest, spot);
        away.y = 0; away.normalize();
        const near = spot.clone().add(away.clone().mulScalar(.34 * target!.scale.x + .12)), press = spot.clone().add(away.clone().mulScalar(.16 * target!.scale.x));
        const back = rest.clone().add(away.clone().mulScalar(.18)), at = new pc.Vec3(), reach = contact - .1;
        if (t < .14) { at.lerp(rest, back, smooth(t / .14)); lean = -.35; }
        else if (t < reach) { const u = smooth((t - .14) / (reach - .14)); at.lerp(back, near, u); at.y += Math.sin(u * Math.PI) * .38; lean = .85; }
        else if (t < contact + .08) { at.lerp(near, press, Math.sin(clamp01((t - reach) / .18) * Math.PI)); lean = 1; }
        else if (t < contact + .32) { at.copy(near); at.y += Math.sin((t - contact) * 30) * .006; lean = -.15; }
        else { const u = smooth((t - contact - .32) / Math.max(.1, end - contact - .45)); at.lerp(near, rest, u); at.y += Math.sin(u * Math.PI) * .25; lean = -.3 * (1 - u); }
        b.at.copy(at); look = spot;
      } else if (acting && effect!.skill === 'escolta') {
        // Escolta: an arc from wherever it was to its place in front of the ally; there it turns to face the foes.
        if (!escortFrom.has(effect!)) escortFrom.set(effect!, b.at.clone());
        const from = escortFrom.get(effect!)!, { contact } = BIP_MOVES.escolta, u = smooth(t / contact);
        b.at.lerp(from, rest, u); b.at.y += Math.sin(u * Math.PI) * .6;
        lean = t < contact ? .8 * Math.sin(u * Math.PI) : 0; look = t < contact * .8 ? rest.clone().add(new pc.Vec3().sub2(rest, from)) : look;
      } else if (acting && effect!.skill === 'enjambre') {
        // Enjambre: up over the foes, trembling as it cracks; it comes apart into the swarm (`swarmFrame`) and is gone until it
        // forms again at home, out of the nanites that come back from the network.
        const over = new pc.Vec3(center.x, floor + 2.4, center.z), u = smooth(t / SWARM_BIP.apart), shiver = u * .05;
        if (t < SWARM_BIP.reform) { b.at.lerp(rest, over, u); b.at.x += (Math.random() - .5) * shiver; b.at.y += (Math.random() - .5) * shiver; lean = .5; }
        else b.at.copy(rest);
        whole = t < SWARM_BIP.apart ? 1 : t < SWARM_BIP.reform ? 1 - smooth((t - SWARM_BIP.apart) / .12) : smooth((t - SWARM_BIP.reform) / (BIP_MOVES.enjambre.end - SWARM_BIP.reform - .1));
        look = new pc.Vec3(center.x, floor, center.z);
        swarmFrame(effect!, b, over, rest, t);
      } else if (acting && effect!.exploded) {
        // Explosión: up and into the middle of the foes, faster and faster; it blows up there (`bipBurst`).
        const over = new pc.Vec3(center.x, floor + 1.1, center.z), u = clamp01(t / CONTACT_SECONDS);
        b.at.lerp(rest, over, u * u); lean = 1; look = over;
      } else if (acting && effect!.kind === 'skill') {
        // A ray, or Rayo solar's sweep: it turns to whoever it is for, charges drawing back a little,
        // and kicks back as the ray leaves it (`bipFire`); letting Rayo solar go it rises and follows its beam.
        const solar = !!effect!.release, ray = effect!.skill ? BIP_RAYS[effect!.skill] : undefined;
        const fires = solar ? SOLAR.ignite : ray ? ray.contact - ray.flight : CONTACT_SECONDS;
        const rise = solar ? .55 * smooth(t / SOLAR.ignite) * (1 - smooth((t - SOLAR.ignite - SOLAR.span) / .45)) : ray ? .12 * smooth(t / fires) * (1 - smooth((t - fires) / .3)) : 0;
        const kick = smooth((t - fires) / .06) * (1 - smooth((t - fires - .06) / (solar ? .5 : .3)));
        // Charging, it trembles with what it holds.
        const tremble = t < fires && (solar || ray) ? smooth(t / fires) * .02 : 0;
        b.at.lerp(b.at, new pc.Vec3(rest.x + (Math.random() - .5) * tremble, rest.y + rise + (Math.random() - .5) * tremble, rest.z + (Math.random() - .5) * tremble), 1 - Math.exp(-dt * 10));
        look = solar ? solarFrame(effect!, b.at, t, dt) : chestOf(target!);
        lean = t < fires ? -.25 * smooth(t / .2) : -(solar ? .5 : .7) * kick;
        if (ray) {
          if (!bipCharged.has(effect!)) { bipCharged.add(effect!); bipCharge(effect!, b.at, chestOf(target!)); }
          if (t >= fires && !bipFired.has(effect!)) { bipFired.add(effect!); bipFire(effect!, b.at, chestOf(target!), ray); }
        }
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
      } else {
        // Home, or to whoever it guards: from afar it flies there in an arc, slower; close by it settles.
        const gap = b.at.distance(rest), aim = rest.clone();
        if (animate && gap > .6) aim.y += Math.min(.5, gap * .2);
        b.at.lerp(b.at, aim, animate ? 1 - Math.exp(-dt * (gap > .6 ? 3.5 : 6)) : 1);
        if (gap > .6) lean = .5;
      }
      const entity = b.bip.entity;
      entity.setPosition(b.at);
      // Going, it spins down; coming, it grows out of its nanites with a little overshoot.
      const spin = b.shown ? 0 : (1 - b.power) * 540;
      // Waiting, it watches the foes half turned to the camera, so its face reads; striking, it faces the blow.
      const watching = face(b.at, look), toView = Math.atan2(toCamera.x, toCamera.z) * 180 / Math.PI;
      const yaw = lean ? watching : watching + (((toView - watching + 540) % 360) - 180) * .45;
      entity.setEulerAngles(0, yaw + spin, 0);
      const grow = b.shown ? 1 + 1.6 * (b.power - 1) ** 3 + .6 * (b.power - 1) ** 2 : b.power;
      const size = BIP.scale * Math.max(.001, grow * whole) * f.scale.y;
      entity.setLocalScale(size, size, size);
      // Charged with Gerard's fire (Rayo solar) it glows sun yellow from when the fire reaches it until it lets go.
      const releasing = !!effect?.release && effect.actor === id && t < SOLAR.ignite + SOLAR.span + .3;
      const solar = releasing || (unit?.charge?.dual === 'rayo-solar' && !(effect?.charging === id && t < .5)) ? 1 : 0;
      b.solar = animate ? b.solar + (solar - b.solar) * (1 - Math.exp(-dt * 6)) : solar;
      b.bip.animate(dt, { look, lean, power: b.power, animate, solar: b.solar });
    }
  }
  /** `walks`: the cat comes from wherever it is, running, unless that is too far (a jump): then it lands there. */
  function placeCat(cat: Cat, dt: number, at: pc.Vec3, lift: number, look: pc.Vec3, animate: boolean, action: CatAction, walks = false, size = 1) {
    if (walks && animate) {
      const from = cat.entity.getPosition(), gap = Math.hypot(at.x - from.x, at.z - from.z), step = CAT_RUN * dt;
      if (gap > step && gap < CAT_LANDS) { look = at; at = new pc.Vec3().lerp(from, at, step / gap); action = {}; }
    }
    cat.entity.setPosition(at.x, groundHeight(at.x, at.z) + lift, at.z);
    cat.entity.setEulerAngles(0, face(at, look), 0);
    // A touch bigger than life, so they read from the fight's camera.
    // `size` below 1: sinking into the dark or coming out of it (Acecho).
    const scale = 1.35 * Math.max(.001, size);
    cat.entity.setLocalScale(scale, scale, scale);
    cat.animate(dt, { ...action, animate });
  }
  /**
   * The model a fighter is cloned from: their street model, a fear, the minion or a dog. Only a dog
   * is ever drawn as a dog: a foe with no model of its own (Vertitrón's eye) is drawn by its owner.
   */
  /** A foe with a body of its own: not a part of another (Vertitrón's eye), though Fran's canopy lamps, parts of his fight, hang on their own. */
  const standsAlone = (unit: Combatant) => !unit.part || unit.kind === 'lampara';
  function sourceOf(unit: Combatant, i: number, party: boolean) {
    const fear = !party && unit.kind ? fears?.templates.get(unit.kind) : undefined;
    // The castle's foes are gum, hers: each its own figure once it has one, the minion's model at their own size until then.
    const own = ownFigure(unit, party);
    const minion = !party && (!!fear || ((unit.kind === 'minion' || unit.kind === 'guardian' || isCastle(unit.kind)) && !!minionTemplate));
    return party ? partyModel(unit.id) : own?.template ?? fear ?? (minion ? minionTemplate! : dogs[i % dogs.length]);
  }
  /** A foe's own figure with Meshy's skeleton, if it has one loaded (src/castle-models.ts): a castle foe's, El Repetidor's by his year, or Fran's. */
  const ownFigure = (unit: Combatant, party: boolean) => {
    const id = party ? undefined : foeFigure(unit.kind, unit.castle?.year, unit.id);
    return id ? castleModel(id) : undefined;
  };
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
  /** La Sobremesa's body, standing at `base` and facing `towards` (the party), its feet on the ground. */
  function buildMass(base: pc.Vec3, towards: pc.Vec3) {
    const holder = new pc.Entity('La Sobremesa'), model = sobremesaTemplate!.clone();
    model.enabled = true; holder.addChild(model);
    model.setLocalScale(SOBREMESA_SCALE, SOBREMESA_SCALE, SOBREMESA_SCALE);
    // Its mesh reaches .82 below its middle: lifted that much, it stands on the floor.
    model.setLocalPosition(0, .82 * SOBREMESA_SCALE, 0);
    battleRoot.addChild(holder); holder.setPosition(base);
    const yaw = Math.atan2(towards.x - base.x, towards.z - base.z) * 180 / Math.PI;
    holder.setEulerAngles(0, yaw, 0);
    mass = {
      model: holder, base, start: base.clone(), hp: 1, party: false, shrink: 1, body: null, head: null, arms: [], legs: [], yaw, turn: yaw, eyes: [], tail: null, minion: false, rigid: true, grown: false,
      ears: [], eyeScale: 1, seed: 0, flash: 0, flashColor: white, ...ownMaterials(holder),
      scale: new pc.Vec3(1, 1, 1), walk: new WalkAnimation(), plantFeet: () => {}, rig: bindSobremesa(model), freedAt: new Map(),
    };
    return mass;
  }
  /** A friend of La Sobremesa as a fighter: their place is their bone; whoever runs at them stops a step before the body. */
  function buildBone(unit: Combatant, body: NonNullable<typeof mass>, i: number) {
    const name = SOBREMESA_NAMES[unit.id as keyof typeof SOBREMESA_NAMES];
    let node = body.model.findByName(name) as pc.Entity | null;
    if (!node) {
      // A friend the model does not carry yet: a point on the body, spread along it.
      node = new pc.Entity(name); body.model.addChild(node);
      node.setLocalPosition((i / 6 - .5) * 3.4, 2.3, .9);
    }
    const p = node.getPosition(), toward = new pc.Vec3(Math.sin(body.yaw * Math.PI / 180), 0, Math.cos(body.yaw * Math.PI / 180));
    const base = new pc.Vec3(p.x + toward.x * 1.1, body.base.y, p.z + toward.z * 1.1);
    const f: Fighter = {
      model: node, base, start: base.clone(), hp: unit.hp, party: false, shrink: 1, body: null, head: null, arms: [], legs: [], yaw: body.yaw, turn: body.yaw, eyes: [], tail: null, minion: false, rigid: true, grown: false,
      ears: [], eyeScale: 1, seed: i, flash: 0, flashColor: white, materials: [], glow: [],
      scale: new pc.Vec3(1, 1, 1), walk: new WalkAnimation(), plantFeet: () => {}, part: body, bone: true,
    };
    fighters.set(unit.id, f);
    return f;
  }
  /**
   * La Sobremesa moves: whoever acts lunges (Álvaro and Anna together in their duo), whoever is freed
   * goes limp and stays so; a blow on any friend flashes the whole body.
   */
  function sobremesaFrame(dt: number) {
    const body = mass!, acts: Acts = {};
    for (const [id, f] of fighters) {
      if (!f.bone) continue;
      const name = SOBREMESA_NAMES[id as keyof typeof SOBREMESA_NAMES] as Friend;
      if (f.hp <= 0) {
        if (!body.freedAt.has(id)) body.freedAt.set(id, time);
        acts[name] = { kind: 'free', since: body.freedAt.get(id)! };
        continue;
      }
      body.freedAt.delete(id);
      if (f.flash > body.flash) { body.flash = f.flash; body.flashColor = f.flashColor; }
    }
    if (effect?.kind === 'enemy' && effect.ability) {
      // A duo moves both: Álvaro and Anna throw together; Sarah writes while Miquel's card comes down.
      for (const id of effect.ability.id === 'duo-tirada' ? ['alvaro', 'anna'] : effect.ability.id === 'duo-regla' && !effect.telegraph ? (effect.target ? ['miquel', 'sarah'] : ['sarah', 'miquel']) : [effect.actor]) {
        const name = SOBREMESA_NAMES[id as keyof typeof SOBREMESA_NAMES] as Friend | undefined;
        if (name && acts[name]?.kind !== 'free') acts[name] = { kind: 'attack', since: time - effectTime, move: effect.ability.id as Move, warn: !!effect.telegraph && effect.telegraph.id !== 'duo-tirada' };
      }
    }
    body.rig.apply(time, acts);
    shine('sobremesa', body, dt);
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
    const minion = !party && (!!fear || ((unit.kind === 'minion' || unit.kind === 'guardian' || isCastle(unit.kind)) && !!minionTemplate));
    const source = sourceOf(unit, i, party);
    const model = source.clone(); model.enabled = true;
    // Fran's chaplains (docs/quests/luca.md): each one's hair done his own way.
    if (unit.kind === 'capellan') styleChaplain(model, i);
    battleRoot.addChild(model); model.setPosition(start);
    const body = party ? model.findByName('Cuerpo') as pc.Entity : null;
    const arms = (body?.children.filter(c => c.name === 'Brazo') ?? []) as pc.Entity[];
    if (minion) { const size = foeScale(unit.kind, unit.layers ?? 0, !!fear); model.setLocalScale(size, size, size); }
    // A pupil with a figure of its own stands its own height: so many minions tall.
    const own = ownFigure(unit, party);
    if (own) model.setLocalScale(own.size, own.size, own.size);
    const legs = (body?.children.filter(c => c.name === 'Pierna') ?? (minion ? [] : model.children.filter(c => c.name === 'Pata'))) as pc.Entity[];
    const yaw = party ? (source.findByName('Cuerpo') as pc.Entity).getLocalEulerAngles().y : source.getEulerAngles().y;
    if (body) body.setLocalEulerAngles(0, 0, 0);
    model.setLocalEulerAngles(0, yaw, 0);
    // A model with nothing to stand on (no shoe, no pool under it) is not planted rather than breaking every frame.
    const feet = (party ? legs.map(leg => leg.findByName('Zapatilla') as pc.Entity) : minion ? [model.findByName('Charco pringoso') as pc.Entity] : legs).filter(Boolean);
    const head = model.findByName(party ? 'Pivote de cabeza' : minion ? 'Cabeza de chicle' : 'Cabeza de perro') as pc.Entity | null;
    const eyes = model.find(node => node.name === 'Ojo') as pc.Entity[];
    fighters.set(unit.id, {
      model, base, start, hp: unit.hp, party, shrink: 1, body, head, arms, legs, yaw, turn: yaw, eyes, tail: model.findByName('Cola') as pc.Entity | null, minion, rigid: unit.kind === 'vertigo', grown: party && grownUp(unit.profile),
      ears: model.find(node => node.name === 'Oreja') as pc.Entity[], eyeScale: eyes[0]?.getLocalScale().y ?? 1, seed: party ? i * 3.1 + .4 : i,
      wings: model.find(node => node.name === 'Ala izquierda' || node.name === 'Ala derecha') as pc.Entity[],
      flash: 0, flashColor: white, ...ownMaterials(model, party),
      scale: model.getLocalScale().clone(), walk: new WalkAnimation(), plantFeet: createGroundContact(model, feet),
      limbRig: party && legs[0]?.findByName('Espinilla') ? {
        limbs: [legs[0], arms[0], legs[1], arms[1]], feet,
        ankles: legs.map(leg => leg.findByName(RIG.ankle) as pc.Entity | null).filter(ankle => !!ankle),
        joints: [legs[0], arms[0], legs[1], arms[1]].map((limb, k) => limb.findByName(k % 2 ? 'Antebrazo' : 'Espinilla') as pc.Entity | null),
      } : undefined,
    });
    // A foe can come apart when beaten: its shader is ready from the start, so nothing stalls then (Vertitrón kneels instead).
    if (!party && unit.kind !== 'vertigo') fighters.get(unit.id)!.materials.forEach(dissolvable);
    if (isOnion(unit.kind)) {
      const skin = (model.find(node => node.name === 'Capa')[0] as pc.Entity).render!.meshInstances[0].material as pc.StandardMaterial;
      tintSkin(skin, unit.layers ?? 0);
      fighters.get(unit.id)!.onion = { kind: unit.kind, shown: unit.layers ?? 0, size: model.getLocalScale().x, skin };
    }
    const built = fighters.get(unit.id)!;
    // An Encarnado (src/castle.ts `STRONG`): red from inside at rest, so every flash fades back to it, and its halo.
    if (unit.castle?.strong) {
      redden(built.materials);
      built.glow = built.materials.map(m => m.emissive.clone().mulScalar(m.emissiveIntensity));
      built.halo = encarnadoHalo(model, app.graphicsDevice);
    } else if (unit.castle?.filling) {
      // A second-year's filling shows through its gum (docs/castle.md § Weaknesses): every flash fades back to it.
      fillGum(built.materials, unit.castle.filling);
      built.glow = built.materials.map(m => m.emissive.clone().mulScalar(m.emissiveIntensity));
    }
    if (own) { built.figure = figureClips(model, own); built.figure?.play('rest'); built.plateAt = own.size * MINION_HEIGHT + .1; }
    if (party && unit.id === 'gerard' && body?.findByName(PROP)) built.held = new HeldArtilugio(body);
    // A dish shows what it is on its plate; a fantasmita can go see-through, row by row.
    if (isCamping(unit.kind)) {
      built.camp = unit.kind;
      // A figure taller than the usual plate's 1.45 m wears it over its head, not across its chest.
      const tall = CAMPING_HEIGHTS[unit.kind];
      if (tall) built.plateAt = tall * model.getLocalScale().y + .12;
    }
    if (isCuerdas(unit.kind)) built.strings = unit.kind;
    if (isModelo(unit.kind)) built.mesh = unit.kind;
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
    get punch() { return Math.max(-.2, zoom.x + lens.zoom + turnPush * .14); },
    /**
     * How the big moments turn the fight's camera (game.ts adds it): degrees round the fight and
     * up or down (negative lower), on top of the players' own lean.
     */
    get lens() { return { yaw: lens.yaw, pitch: lens.pitch }; },
    /**
     * The last scene (`LAST`), once she is down: `hold` walks Gerard up to her and puts his hand to
     * her neck; then `acabar` (the Foc Binari, and she comes apart) or `bajar` (the hand comes down).
     * Resolves when that part has played.
     */
    lastScene(stage: 'hold' | 'acabar' | 'bajar') {
      if (!state || !queenOf()) return Promise.resolve();
      return new Promise<void>(done => { last = { ...last, reach: last?.reach ?? 0, stage, t: 0, done }; });
    },
    /** How fast particles should run: slowed while a hit-stop holds the fight. */
    get pace() { return (clock.hold > 0 ? HIT.pace : 1) * clock.scale; },
    /**
     * Slow motion (a dual's banner, battle-ui.ts): the fight, its particles and its choreography run
     * at `scale` for `seconds` of real time, then ease back to full speed (DUAL_EASE).
     */
    slowmo(scale: number, seconds: number) { if (animating) clock.slow(scale, seconds, DUAL_EASE, 'ui'); },
    /**
     * The action about to play, while a pause holds it (a dual's unlock, a foe's move named): the rules
     * have already raised its dome or shrunk its foe, which must wait for it to land.
     */
    // Freática's cells hold what they show until it lands too (a dual's unlock stops time before it reaches the scene).
    upcoming(next: BattleEffect) { upcoming = next; freatica.pending(next); },
    /**
     * How fast the fight runs now, every slow motion together (the banner's and the choreography's
     * own, Punto débil's aim): the fight screen's clock (statuses, Quemado's pulses) follows it.
     */
    get speed() { return clock.scale; },
    /** Where a dual's spotlight goes (post.ts `spotlight`). */
    setSpot(next: typeof spot) { spot = next; },
    /** Where a Bomba remota's black hole bends the picture (post.ts `lens`). */
    setLens(next: typeof setLens) { setLens = next; },
    /** The picture's post effects, for Sincopante's ecos (their pulses of bloom, the dimming round them). */
    setEcoPost(next: typeof ecoPost) { ecoPost = next; },
    /**
     * Sincopante's ecos did something on their own (src/battle.ts `takeEcoNews`, through the fight
     * screen): each one sounds on whoever it reached, goes out, and the beat falls.
     */
    ecoNews(news: readonly EcoNews[]) {
      const fx = ecos(); if (!fx) return;
      fx.setMuffled(ecosMuffled());
      let beat = false;
      for (const n of news) {
        if (n.kind === 'pulse') {
          fx.sound(n.eco, n.hits.map(h => h.target), !!n.accent);
          if (!n.accent) beat = true;
          n.hits.forEach((h, i) => dualFx.after(.28 + i * .04, () => { const f = fighters.get(h.target); if (f && h.amount) hit(f, h.heal ? green : white, h.heal ? .4 : .35); }));
        } else if (n.kind === 'out') fx.out(n.eco);
      }
      if (beat) fx.beat();
    },
    /**
     * Development (the effects lab): plays `next` as the fight would show it, without changing the
     * fight: a dual's choreography, a foe's ability. Nothing waits for it.
     */
    /** Development (the effects lab's neon figures, src/neon-lab.ts): what a dual's own look is handed (src/duo-fx/types.ts `DuoStage`). */
    duoStage: () => duoStage(),
    preview(next: BattleEffect) {
      if (!state) return false;
      settle(); effect = next; effectTime = 0; impact = undefined; impacted = false; clawed = 0; dualStarted = undefined; worldDone = undefined;
      complete = () => {};
      return true;
    },
    /** Where big moments send their chromatic fringe and bloom swell (post.pulse). */
    setPulse(next: (fringe: number, bloom: number, flash?: number) => void) { pulse = next; },
    /** Where the astral's night goes (post.night): how dark and blue the picture is, and how lit up for a moment. */
    setNight(next: (amount: number, lift?: number) => void) { setNight = next; },
    /** Where Bajo cero's cold grade goes (post.setDark): 0 the scene's own look, 1 blue and grey. */
    setCold(next: (amount: number) => void) { setCold = next; },
    /** Where the moments only the picture knows go to sound (a claw landing, a layer off, a fall). */
    setCue(next: typeof cue) { cue = next; },
    /** Haru and Yuki already with the party, if any: this fight uses them instead of bringing its own. It gives them back when it ends. */
    borrowCats(pair: { haru: Cat; yuki: Cat } | undefined) { borrowed = pair; },
    /** The model cloned for minion foes. */
    setMinionTemplate(model: pc.Entity) { minionTemplate = model; },
    /** Uri's fears' models (src/fears.ts). */
    setFears(models: Fears) { fears = models; },
    /** La Sobremesa's model (src/glb.ts), once it has been fetched. */
    setSobremesa(model: pc.Entity) { sobremesaTemplate = model; },
    get hasSobremesa() { return !!sobremesaTemplate; },
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
    /** Whom `player` aims at (none: nobody); each has their ring. */
    /** Whom `player` aims at (none: nobody), with `by` (the fighter choosing) turning towards it; each has their ring. */
    selectTarget(id?: string, player: 1 | 2 = 1, by?: string) { aimedBy[player] = id; aimer[player] = id ? by : undefined; },
    /** Dadista: the die of `unit`'s hand the cursor is on while one is being picked (none: back in line). */
    aimDie(unit?: string, index?: number) { aimedDie = unit !== undefined && index !== undefined ? { unit, index } : undefined; },
    /** Agitar: `unit`'s dice are thrown again, so each drops in tumbling once more, one after another, with a few stars off the hand. */
    shakeDice(unit: string) {
      const d = dice.get(unit), f = fighters.get(unit);
      d?.hand.forEach((die, i) => { die.age = -.07 * i; die.tumble.set(Math.random() - .5, Math.random() - .5, Math.random() - .5).normalize(); });
      if (d?.hand.length) effects.emit('astral', d.hand[0].at, 10, .35);
      else if (f) effects.emit('astral', new pc.Vec3(f.base.x, 1.3, f.base.z), 6, .3);
    },
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
    pulse(id: string, status?: string, by?: string, beat?: TimedPulse) {
      const f = fighters.get(id), unit = state && [...state.allies, ...state.foes].find(u => u.id === id);
      if (!f || !unit) return;
      // A Bomba remota went off: its own blast, not a pulse's flare.
      if (status === 'bomba') { bombBlast(id); f.hp = unit.hp; return; }
      // The newer duals' own lasting looks draw their beat (src/duo-fx `pulsed`).
      if (status && animating && dualFx.on) {
        const stage = duoStage(effect), target = stage.fighter(id);
        if (target) for (const own of Object.values(DUO_STAGINGS)) own?.pulsed?.(stage, status, target, by ? stage.fighter(by) : undefined);
      }
      // A dual's own lasting look draws its beat itself (src/duo-fx): a pale flash under it, not fire's. Corriente alterna's
      // beat is a bolt: its flash is the bolt's, and what it turned shows as any reaction does (`reactFx`).
      const bolt = status === 'alterna';
      hit(f, bolt ? ELEMENT_FLASH.electrico : status && status in DUO_STAGINGS ? white : flame, bolt ? .9 : .7);
      // Its first beat on a bleeding pole spent the wound (`multiHit`): the blood flung off along the bolt, and the golpe
      // crítico's freeze when it was the sure one of Olor a sangre.
      if (bolt && (beat?.bled || beat?.crit)) {
        const from = by ? fighters.get(by)?.base : undefined, dx = from ? f.base.x - from.x : 0, dz = from ? f.base.z - from.z : 1, d = Math.hypot(dx, dz) || 1;
        if (beat.crit) { critBeat(beat as unknown as BattleEffect, [f], by ? fighters.get(by) : undefined, { x: dx / d, z: dz / d }); cue('crit'); }
        if (beat.bled) { statusFx.spill(id, v3(chestOf(f)), { x: dx / d, z: dz / d }, beat.bled); cue('bleed'); }
      }
      if (beat?.reaction) reactFx({ actor: id, kind: 'skill', target: id, reaction: beat.reaction });
      // A cortina the reaction raised (Remolino) stands up as any other.
      if (beat?.cortina) powderFx.telon(beat.cortina, foesCentre(), beat.cortina.map(() => nextMix()));
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
    /** Gerard's artilugio in the fight, if he is fighting. */
    get artilugio() { return fighters.get('gerard')?.held; },
    /** Adds whoever is standing in the fight to `out`, so particles flow around them. */
    bodies(out: ParticleBody[]) {
      for (const f of fighters.values()) {
        if (!f.model.enabled || f.part) continue;
        const p = f.model.getPosition(), lying = f.party && f.downAt !== undefined;
        out.push({ x: p.x, y: p.y, z: p.z, radius: (lying ? .6 : f.party ? .3 : .38) * f.scale.x, height: (lying ? .4 : f.party ? 1.5 : 1) * f.scale.y, key: f.model });
      }
    },
    /**
     * What the camera's sharp band (the tilt-shift, src/post.ts `focus`) must take in: everyone's
     * body, and La Sobremesa whole, from its claws on the floor to its top and round its width,
     * standing still: not its seven friends swaying on their bones, which made the focus breathe
     * and the body go in and out of the blur.
     */
    framing(out: { x: number; y: number; z: number; height: number }[]) {
      for (const f of fighters.values()) {
        if (!f.model.enabled || f.part || (mass && f.bone)) continue;
        const p = f.model.getPosition();
        out.push({ x: p.x, y: p.y, z: p.z, height: (f.party ? 1.5 : 1) * f.scale.y });
      }
      if (!mass) return;
      const p = mass.base, r = foeSize('sobremesa') * 1.2, height = Math.max(3, foeTop);
      for (const [dx, dz] of [[0, 0], [r, 0], [-r, 0], [0, r], [0, -r]]) out.push({ x: p.x + dx, y: p.y, z: p.z + dz, height });
    },
    /**
     * Where each fighter's plate and speech go on screen: over their head; Vertitrón's eye's beside the
     * eye; and `uri`, over Uri up on Vertitrón, for the moves he shouts (battle-ui `shout`).
     */
    targets() {
      const { right } = screenAxes(viewDir());
      const list = [...fighters].map(([id, f]) => ({
        id, visible: f.hp > 0 && entryTime >= ENTRY_SECONDS,
        position: f.bone ? f.model.getPosition().clone().add(new pc.Vec3(0, .85, 0))
          : f.part ? f.model.getPosition().clone().add(new pc.Vec3(right.x * 1.35, right.y * 1.35 - .25, right.z * 1.35))
          : f.model.getPosition().clone().add(new pc.Vec3(0, f.plateAt ?? (f.party ? 1.65 : f.onion ? 1.6 * f.scale.y : 1.45), 0)),
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
        // La Sobremesa's seven stand as one body, built apart once the others have their places.
        const fused = sobremesaTemplate ? next.foes.filter(unit => isSobremesa(unit.kind)) : [];
        const whole = next.foes.filter(unit => standsAlone(unit) && !fused.includes(unit));
        const kinds = standing([...whole, ...fused].map(unit => unit.kind));
        const slots = formation(layout, next.allies.length, kinds, stage.spread), { ahead, side } = axes(layout);
        {
          foeKinds = kinds;
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
        for (const unit of next.foes) if (!standsAlone(unit) && owner) buildPart(unit, owner);
        if (fused.length) {
          const slot = slots.foes[whole.length], party = slots.allies.reduce((sum, p) => ({ x: sum.x + p.x / slots.allies.length, z: sum.z + p.z / slots.allies.length }), { x: 0, z: 0 });
          const body = buildMass(new pc.Vec3(anchor.x + slot.x, anchor.y + .15, anchor.z + slot.z), new pc.Vec3(anchor.x + party.x, 0, anchor.z + party.z));
          fused.forEach((unit, i) => buildBone(unit, body, i));
        }
      }
      // The picker's moments can put a broken eye back (`stageMoment`): what the effects lab broke comes back too.
      for (const f of fighters.values()) if (f.robot) f.robot.labBroken = false;
      if (next && !foeTop) {
        // Measured once per fight, in the pose it was built in. What a foe hangs from (La Voz's strings, going up out of sight) is not its height.
        for (const f of [...fighters.values(), ...mass ? [mass] : []]) if (!f.party && !f.bone) for (const r of f.model.findComponents('render') as pc.RenderComponent[]) if (!r.entity.tags.has('overhead')) for (const m of r.meshInstances) foeTop = Math.max(foeTop, m.aabb.getMax().y - f.model.getPosition().y);
      }
      if (!next) foeTop = 0;
      state = next; effect = nextEffect; upcoming = undefined; effectTime = 0; impact = onImpact; impacted = false; clawed = 0; fireWaits = undefined; clock.clear(!next);
      freatica.pending(nextEffect);
      if (!next && last) { const l = last; last = undefined; l.done(); }
      if (!next) {
        dualFx.clear(); powderFx.clear(); ecoFx?.clear(); freatica.clear(); swarmFx.clear(); swarmHeld.clear(); marks.forEach(m => m.destroy()); marks.clear(); beam.enabled = false; beamOf = undefined; sunBeam.enabled = false; sunOf = undefined;
        for (const f of fighters.values()) if (f.robot?.swirl) { f.robot.swirl.stream.remove(); f.robot.swirl.field.remove(); f.robot.swirl.glass.remove(); f.robot.swirl = undefined; }
        dualStarted = dualPlan = worldDone = undefined; sungNote = undefined; lensHold = 0; spotWant = spotAmount = 0; critGrey = 0; critOf = undefined; spot?.(0, []); if (cold) { cold = 0; setCold?.(0); }
        Object.assign(lens, { yaw: 0, pitch: 0, zoom: 0, x: 0, y: 0, z: 0 }); Object.assign(lensWant, lens);
      }
      if (!next) { night = nightLift = shownNight = 0; setNight?.(0, 0); stamps.clear(); rocks.clear(); sky = undefined; mathCast.clear(); figures.clear(); filmFx.clear(); livesFx.clear(); borrowed = undefined; peels.clear(); arrows.clear(); motes.clear(); cats.forEach(pair => { pair.haru.destroy(); pair.yuki.destroy(); }); cats.clear(); bips.forEach(b => { b.bip.destroy(); b.chest.destroy(); }); bips.clear(); bombs.forEach(b => b.bomb.destroy()); bombs.clear(); holes.length = 0; setLens?.([]); escorts.forEach(e => { e.ring.destroy(); e.inner.destroy(); e.mat.destroy(); }); escorts.clear(); dice.forEach(d => { d.hand.forEach(die => die.entity.destroy()); d.thrown?.die.entity.destroy(); }); dice.clear(); aimedDie = undefined; statusFx.clear(); shownStacks.clear(); fighters.forEach(f => { if (!f.part) f.model.destroy(); f.freed?.node.destroy(); f.materials.forEach(m => m.destroy()); }); fighters.clear(); if (mass) { mass.model.destroy(); mass.materials.forEach(m => m.destroy()); mass = undefined; } aimedBy[1] = aimedBy[2] = aimer[1] = aimer[2] = undefined; effects.clear(); }
      else {
        // A foe called in mid-fight (La Voz's second voice) takes a place beside whoever called it, a step towards
        // the party, and waits there unseen until the call lands (`unborn`).
        for (const unit of next.foes) if (!fighters.has(unit.id) && standsAlone(unit)) {
          const caller = (nextEffect?.summoned === unit.id ? fighters.get(nextEffect.actor) : undefined) ?? [...fighters.values()].find(f => !f.party && !f.part);
          const { ahead, side } = axes(layout), from = caller?.base ?? anchor;
          // The Queen's hands come up one on each side of her (the one that holds, the one that crushes), La Pompa swells
          // right in front of her, and all are there at once.
          const hers = isCastle(unit.kind), across = unit.kind === 'pompa' ? 0 : hers && unit.castle?.hand === 'aplasta' ? -1.6 : hers ? 1.6 : 1;
          const base = new pc.Vec3(from.x + side.x * SUMMON.side * across - ahead.x * SUMMON.ahead, from.y, from.z + side.z * SUMMON.side * across - ahead.z * SUMMON.ahead);
          build(unit, next.foes.indexOf(unit), false, base, base.clone());
          // Only one called in waits unseen for its call; one the fight puts there (Fran's lamps coming down, the Queen's hands) is there at once.
          const f = fighters.get(unit.id)!;
          if (!hers && (nextEffect?.summoned === unit.id || unit.id === SECOND_VOICE_ID)) { f.model.enabled = false; f.unborn = true; }
          if (caller) f.turn = f.yaw = caller.yaw;
        }
        // And one that is no longer in the fight (the picker took the second voice away) is gone, until it is called again.
        for (const [id, f] of fighters) if (f.strings && !next.foes.some(u => u.id === id)) { f.model.enabled = false; f.unborn = true; f.downAt = f.upAt = undefined; f.dissolve = undefined; }
        [...next.allies, ...next.foes].forEach(u => { const f = fighters.get(u.id); if (f) f.hp = u.hp; });
      }
      player.enabled = !next;
      if (!entering && !nextEffect) return Promise.resolve();
      return new Promise(resolve => { complete = resolve; });
    },
    update(dt: number, animate = true) {
      // Real time drives the camera; the fight itself stands still while a hit-stop holds.
      const elapsed = dt; real += dt; animating = animate; dt = clock.advance(dt);
      arrows.update(elapsed);
      time += dt; effectTime += dt;
      // Sincopante's ecos: muffled while their wearer is in another ánima, and none the fight no longer has.
      if (ecoFx) { ecoFx.setMuffled(ecosMuffled()); ecoFx.keep(state?.ecos?.map(e => e.id) ?? []); }
      // La carta de colores (docs/quests/luca.md): a shirt of Luca's keeps its colour only in the light of that colour.
      if (state?.light) for (const foe of state.foes) if (foe.kind?.startsWith('estampado')) { const f = fighters.get(foe.id); if (f) lightShirt(f.model, shirtLit(state, foe)); }
      dualFx.update(dt);
      figures.update(dt);
      // Superficie mínima: a film whose round is over (or whose ally fell) thins out and goes; one the blow playing now
      // will burst waits for it, even if that blow is what brings its ally down (the state is already past it).
      if (state && filmFx.active) filmFx.keep(state.allies.filter(a => filmed(state!, a)).map(a => a.id), state.allies.filter(a => a.hp <= 0).map(a => a.id), animate && !impacted ? effect?.film?.map(f => f.from) : undefined);
      filmFx.update(dt);
      // Siete vidas: Yuki's silhouettes breathe while her ward holds (a save playing now handles them as it lands).
      livesFx.update(dt, !!state?.allies.some(warded) || !!(effect?.lives && animate && !impacted), livesFeet);
      { const axes = screenAxes(viewDir()); stamps.update(dt, axes.right, axes.up, axes.facing); }
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
      // El Campeón getting its PV back is aimed at itself: it stays where it is, like a cure.
      const support = !!effect?.dual || !!effect?.detonation || (!!effect?.skill && SUPPORT.has(effect.skill)) || (effect?.kind === 'enemy' && !!effect.healed);
      const catStrike = effect?.skill === 'zarpazo' || effect?.skill === 'zarpazos' || effect?.skill === 'acecho' || effect?.skill === 'caceria' || effect?.skill === 'siete-vidas';
      // Tecnópata's wearer stays put too: Bip goes.
      const botStrike = botStrikes(effect);
      // Foc Binari is thrown from where the caster stands: no run-up, the hand goes up instead.
      const focBinari = effect?.skill === 'foc-binari' && !!target;
      // So is Matemágico's Atacar: the hand up, his circle and a ball (src/math-cast.ts). Cardioide's comet leaves the circle too.
      const spelling = !!effect?.spell && !!target, curing = effect?.skill === 'cardioide' && !!target;
      // His skills of the elements too: Factor común, Vasos comunicantes, Descarga.
      // And every skill of his that draws a figure (src/math-figures.ts): Cardioide, Pirámide ígnea, Cubo acuático, Punto eléctrico, Integral impropia.
      const figured = isFigure(effect?.skill) && !!target;
      const casting = focBinari || spelling || figured;
      // Dadista throws its die from where it stands.
      const dicing = !!effect?.die && !!target;
      const castLaunch = spelling ? SPELL_LAUNCH : CAST_LAUNCH, castContact = spelling ? SPELL_CONTACT : figured ? FIGURES[effect!.skill as FigureSkill].contact : CAST_CONTACT;
      // A dual attack: both its fighters stay where they are; Gerard draws and Haru strikes (`DUAL`).
      const dual = target && (effect?.dual?.id === 'punto-debil' || effect?.dual?.id === 'zarpazos-de-fuego') ? effect.dual : undefined;
      const roles = dual ? dualRoles(effect!) : undefined;
      const times = dual ? dualTimes(effect!) : undefined;
      if (dual && dualStarted !== effect) startDual(effect!, target!, animate);
      const duo = duoOf(effect), blastOf = effect?.detonation ? BLAST[effect.detonation] : undefined;
      if (effect && (duo || blastOf) && !duoPlayed.has(effect)) startDuo(effect, target, animate);
      // Bip's skills land when its ray does (`bipContact`).
      const bipSkill = botStrike && effect!.kind === 'skill';
      const contact = times ? times[0] : duo ? duo.contact : blastOf ? blastOf.contact : casting ? castContact : dicing ? diceContact(effect!) : bipSkill ? bipContact(effect!) : effect?.skill && POWDER_SKILLS[effect.skill] ? POWDER_SKILLS[effect.skill].contact : effect?.skill && FREATICA_SKILLS[effect.skill] && effect.kind === 'skill' ? FREATICA_SKILLS[effect.skill].contact : effect?.pounceDual ? ARC_POUNCE.contact : effect?.pounce ? ACECHO.contact : effect?.target && !support ? CONTACT_SECONDS : .2;
      // Freática's skills start their look on the cells at once (Recarga's tape, Riada's wave): the numbers come at their contact.
      if (effect?.skill && FREATICA_SKILLS[effect.skill] && effect.kind === 'skill' && state) freatica.play(effect, state);
      // What Colorista throws ahead of its contact: Rociada's fan of water, Fin de fiesta's handfuls and all that follows them.
      if (effect?.skill && POWDER_SKILLS[effect.skill] && animate && !powderPlayed.has(effect)) {
        powderPlayed.add(effect);
        const ids = (effect.hits ?? []).map(h => h.target);
        if (effect.skill === 'rociada') powderFx.rociada(effect.actor, ids);
        if (effect.skill === 'fin-de-fiesta') powderFx.fiesta(effect.actor, ids, ids.map(() => nextMix()));
      }
      if (effect && !dual && !impacted && (!animate || effectTime >= contact)) {
        impacted = true; impact?.(0);
        // Tecnópata's bombs going up, and Bip's guard answering a blow (`tecnoLanded`).
        if (animate) tecnoLanded(effect);
        // What the blow did to Freática's water and ice (a bolt, steam, a crack, the break), as it lands.
        if (state) freatica.play(effect, state);
        // Bajo cero's cells lock (src/frost-fx.ts): the fight stops on it and the picture goes cold.
        if (animate && effect.skill === 'bajo-cero') coldBeat();
        // Without motion Rayo solar reaches everyone at once.
        if (effect.release && !animate) while ((solarBurned.get(effect) ?? 0) < solarPlan(effect).crossings.length) solarCross(effect, true);
        worldFx(effect, actor, target, animate);
        if (effect.spell) mathCast.land();
        // ∂Q/∂t Condensador: the charge let go on this blow (×2), or jumping from whoever carried it to the foe that struck them.
        if (animate && effect.capacitor === 'spent' && target) figures.release(v3(chestOf(target)), viewDir());
        if (animate && effect.capacitor === 'stored' && actor) hit(actor, ELEMENT_FLASH.electrico, .8);
        if (animate && effect.discharge) {
          const d = effect.discharge, from = fighters.get(d.from), to = fighters.get(d.target);
          if (from && to) dualFx.after(.22, () => { figures.discharge(v3(chestOf(from)), v3(chestOf(to)), viewDir()); hit(to, ELEMENT_FLASH.electrico, 1.3); statusFx.touch('electrico', d.target); shake = Math.max(shake, .4); });
        }
        // Superficie mínima: a blow went through someone's film: it bursts and its drops fly at whoever struck.
        if (animate) for (const f of effect.film ?? []) { const striker = fighters.get(f.target); if (striker) filmFx.burst(f.from, v3(chestOf(striker))); }
        // A blow the bit dome took whole lands on the dome (below), not on whoever it was aimed at.
        const landed = animate && effect && !domeStopped(effect) ? contactBurst(effect, actor, target) : undefined;
        // What the blow's element turned: its moment, as it lands (docs/combat.md § Reacciones entre elementos).
        if (animate && effect.reaction) reactFx(effect);
        // Combustión: the physical blow found a fire at IV, and it goes off.
        if (animate && effect.combustion) combustFx(effect);
        // Virus atómico: what spread goes from its host to the others.
        if (animate && effect.spread) spreadFx(effect);
        // Escudo de bits: a blow that went into the dome dents it where it meets it, and the one that breaks it shatters it.
        if (animate && effect.bits?.took && wallFx) {
          const from = fighters.get(effect.actor), at = from && target ? domeEntry(from, target) : undefined;
          wallFx.hit(from ? v3(chestOf(from)) : wallFx.top, at ?? wallFx.top, Math.min(2, effect.bits.took / 10));
          if (effect.bits.broke) wallFx.shatter();
          if (domeStopped(effect)) { cue('clink'); shake = Math.max(shake, .18); pulse?.(.25, .35); if (animate) duoStruck(effect!, target); }
        }
        // A cortina of powder: the one that stands up now, and the one this blow went through, which bursts over whoever dealt it (Rebufo).
        if (animate && effect.cortina?.raised) powderFx.telon(effect.cortina.raised, foesCentre(), effect.cortina.raised.map(() => nextMix()));
        if (animate) for (const id of effect.cortina?.broke ?? []) powderFx.romper(id, effect.cortina!.rebufo);
        // A blow on someone full of shards drives them in deeper.
        if (animate) effect.amplified?.forEach(a => { if (a.shards) powderFx.splinter(a.target); });
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
      const spacing = casting ? (effect?.skill === 'fourier' ? FOURIER_GAP : CAST_GAP) : CLAW_SECONDS;
      const claws = effect?.strikes?.length ?? 1;
      const blows = times ? (!animate ? claws : times.filter(at => t >= at).length) : !impacted ? 0 : !animate ? claws : Math.min(claws, 1 + Math.floor(Math.max(0, t - contact) / spacing));
      if (dual && target && blows > clawed) {
        // A dual's strikes, each as it lands; the first also shows what went up or down, and the world's changes.
        for (let k = clawed; k < blows; k++) {
          if (k === 0) {
            impacted = true;
            worldFx(effect!, actor, target, animate);
            // The newer duals' lasting looks answer it too (Zarpazos de fuego setting off Electrólisis's gas).
            if (animate) duoStruck(effect!, target);
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
        if (clawed && effect.skill === 'fourier') for (let blow = clawed; blow < blows; blow++) fourierStrike(effect, actor, target, blow, animate, contact + blow * spacing);
        else if (clawed && casting) secondStream(effect, actor, target, animate, contact + spacing);
        else {
          if (clawed) cue('claw');
          if (clawed) for (let blow = clawed; blow < blows; blow++) if (effect.crits?.[blow]) cue('crit');
          if (animate && clawed) {
            const at = target.part ? chestOf(target) : new pc.Vec3(target.base.x, groundHeight(target.base.x, target.base.z) + .7 * target.scale.y, target.base.z);
            const ax = target.base.x - (actor?.base.x ?? target.base.x), az = target.base.z - (actor?.base.z ?? target.base.z), ad = Math.hypot(ax, az) || 1;
            hit(target, white, .75); effects.emit('spark', at, 7, .35 * target.scale.x);
            // Each claw that cuts flings a little more; each one that is a golpe crítico stops the fight (the first for longest).
            if (effect.status?.id === 'sangrado' && effect.target) statusFx.cut(effect.target, v3(at), { x: ax / ad, z: az / ad }, 1);
            for (let blow = clawed; blow < blows; blow++) if (effect.crits?.[blow]) critBeat(effect, [target], actor, { x: ax / ad, z: az / ad });
          }
        }
        clawed = blows;
      }
      // Traca: each puff after the first goes off in turn and tells the fight screen (its own number and PV); the last leaves them covered.
      if (effect?.volley && impacted) {
        if (volleyed?.effect !== effect) volleyed = { effect, landed: 1 };
        for (; volleyed.landed < effect.volley.length && (!animate || t >= contact + volleyed.landed * TRACA_GAP); volleyed.landed++) {
          impact?.(volleyed.landed);
          if (!animate) continue;
          const puff = effect.volley[volleyed.landed], f = fighters.get(puff.target);
          powderFx.pop(puff.target, nextMix()); cue('hit');
          if (f) hit(f, white, .5);
          shake = Math.max(shake, .1);
          if (volleyed.landed === effect.volley.length - 1) for (const h of effect.hits ?? []) if (h.burn?.id === 'empolvado') powderFx.soon(h.target, nextMix(), .15);
        }
      }
      // The water hammer's blows (Golpe de ariete): each after the first tells the fight screen as it lands, one after another.
      if (effect?.hammer && impacted) {
        if (hammered?.effect !== effect) hammered = { effect, landed: 1 };
        for (; hammered.landed < effect.hammer.length && (!animate || t >= contact + hammered.landed * HAMMER_GAP); hammered.landed++) {
          impact?.(hammered.landed);
          if (animate) { const f = fighters.get(effect.hammer[hammered.landed].target); if (f) hit(f, white, .55); cue('thump'); shake = Math.max(shake, .12); }
        }
      }
      // Papagato's claws one after another (Cacería, Siete vidas): each after the first lands in turn on the foe it found.
      if (effect?.hunt && impacted) {
        if (hunted?.effect !== effect) hunted = { effect, landed: 1 };
        const gap = huntGap(effect.hunt.length);
        for (; hunted.landed < effect.hunt.length && (!animate || t >= contact + hunted.landed * gap); hunted.landed++) {
          impact?.(hunted.landed);
          if (animate) huntClaw(effect, hunted.landed);
        }
      }
      // Siete vidas: as Yuki reaches each of the party, a ring of her white settles at their feet.
      if (effect?.ward?.length && animate) {
        if (wardSeen?.effect !== effect) wardSeen = { effect, shown: 0 };
        for (; wardSeen.shown < effect.ward.length && t >= .1 + (wardSeen.shown + .7) * WARD_STEP; wardSeen.shown++) {
          const f = fighters.get(effect.ward[wardSeen.shown]);
          if (!f) continue;
          dualFx.ring(v3(floorUnder(f)), { x: 0, y: 1, z: 0 }, .55, '#f6f0e2', { count: 60, around: 1.2, life: .95, size: 1.4 });
          // Where she sat she leaves her silhouette, which stays with them while the ward holds.
          const yuki = catsOf(effect.actor)?.yuki;
          if (yuki?.entity.enabled) livesFx.leave(effect.ward[wardSeen.shown], yuki.entity, v3(floorUnder(f)));
          hit(f, white, .45); cue('clink');
        }
      }
      peels.update(dt);
      // Vertitrón only steps in to stomp: it sweeps and fires from where it stands.
      // Nor does a mago step in to let its Bombona go: the flare reaches everyone from where it stands.
      // Nor do Las cuerdas leave their place: what they do reaches from where they stand. Only Lo Directo goes, with its Golpe directo and its Estocada.
      // El Campeón fires his rays from where he stands.
      const planted = (!!actor?.robot && effect?.ability?.id !== 'pisoton') || (actor?.camp === 'mago' && effect?.ability?.id === 'bombona') || actor?.camp === 'campeon'
        || !!actor?.mesh
        || (!!actor?.strings && !(actor.strings === 'directo' && (effect?.ability?.id === 'golpe-directo' || effect?.ability?.id === 'estocada')));
      // A blow the bit dome takes whole: the foe comes up to the dome, not through it.
      const shell = domeStopped(effect) && actor && target ? domeEntry(actor, target) : undefined;
      const stopAt = shell && actor && target ? Math.max(1.65, Math.hypot(target.base.x - actor.base.x, target.base.z - actor.base.z) - Math.hypot(shell.x - actor.base.x, shell.z - actor.base.z) + extent(actor).radius + .2) : undefined;
      const motion = actor && target && !support && !catStrike && !botStrike && !casting && !dicing && !dual && !planted ? contactMotion(actor.base, target.base, t, stopAt) : undefined;
      // Cegado: this blow goes by whoever it was meant for (`whiffed`).
      const whiff = whiffed(effect);
      // How far the caster's hand is up: raised before the streams leave, lowered once they land.
      // Sending Bip, the wearer points it at the target until it is back.
      const raise = casting && animate ? smooth(t / (castLaunch * .85)) * (1 - smooth((t - castContact - .12) / .35))
        : botStrike && animate ? smooth(t / .2) * (1 - smooth((t - (effect!.kind === 'skill' ? bipContact(effect!) : CONTACT_SECONDS) - .25) / .35))
        // The hand goes up with the die and comes down as it leaves.
        : dicing && animate ? smooth(t / .14) * (1 - smooth((t - DICE.launch - .06) / .3)) : 0;
      // A dual: Gerard's hand goes up while he draws, and comes down as the last strike lands.
      const drawing = dual && animate ? smooth(t / .18) * (1 - smooth((t - times!.at(-1)! - .1) / .35)) : 0;
      const dualEnd = times ? times.at(-1)! + dualPace(effect!).tail : 0;
      // Into place gathering speed: off slowly, then a rush, then a short brake (`surge`).
      const entryMove = surge((entryTime - .1) / .75);
      for (const { player, entity, lift } of markers) {
        const on = aimedBy[player] ? fighters.get(aimedBy[player]!) : undefined;
        entity.enabled = !!on && on.hp > 0 && !effect && entryTime >= ENTRY_SECONDS;
        if (on) entity.setPosition(on.base.x, groundHeight(on.base.x, on.base.z) + lift, on.base.z);
      }
      if (mass) sobremesaFrame(dt);
      crossOver(dt, animate);
      lastFrame(dt, animate);
      // The Queen's fight is not celebrated: she is on the floor, and Gerard has to decide.
      const solemn = !!state?.foes.some(u => u.kind === 'reina');
      for (const [id, f] of fighters) {
        if (f.part) { eyeFrame(id, f, dt); continue; }
        updateOnion(id, f, dt, blows, animate, actor);
        const opponents = [...fighters.values()].filter(other => partySide(other) !== partySide(f) && other.hp > 0);
        const opponent = opponents[0];
        // At rest everyone squares up to the middle of the other side; an ally choosing turns toward whatever their player is picking.
        const center = opponents.length ? opponents.reduce((sum, o) => sum.add(o.base), new pc.Vec3()).mulScalar(1 / opponents.length) : undefined;
        const own = f.party ? ([1, 2] as const).find(p => aimer[p] === id && aimedBy[p]) : undefined;
        const selected = own ? fighters.get(aimedBy[own]!) : undefined;
        const aiming = !effect && !!selected && selected !== f && selected.hp > 0 && state?.phase === 'player';
        // The giant does not turn round to whoever hits it: it keeps facing the party.
        const dualing = !!dual && (id === roles!.caster || id === roles!.claws);
        // Vertitrón sweeping or firing faces the middle of everyone it reaches.
        const reached = f.robot && id === effect?.actor && (effect.ability?.id === 'barrido' || effect.ability?.id === 'rayo') ? [target, ...(effect.splash ?? []).map(h => fighters.get(h.target))].filter((o): o is Fighter => !!o) : [];
        const reachFor = reached.length ? reached.reduce((sum, o) => sum.add(o.base), new pc.Vec3()).mulScalar(1 / reached.length) : undefined;
        // Crossing to her side (or back), they look where they are going until they are nearly there.
        const goingTo = f.cross && f.cross.t > 0 && f.cross.t < 1 ? (f.cross.hers ? f.cross.away : f.cross.home) : undefined;
        const crossing = !!goingTo && Math.hypot(goingTo.x - f.base.x, goingTo.z - f.base.z) > .25;
        const queenNow = last && id === 'gerard' ? queenOf() : undefined;
        const lookAt = queenNow?.base ?? reachFor ?? ((id === effect?.actor || dualing) && target ? target.base : id === effect?.target && actor && !f.rigid && !dual ? actor.base : crossing ? goingTo : aiming ? selected!.base : center);
        // With nobody left to face, each side looks the way its line faces.
        const { ahead } = axes(layout), facingAhead = Math.atan2(ahead.x, ahead.z) * 180 / Math.PI;
        // Everyone faces what they face, the party too, even with their backs to the camera (decided:
        // facing the foes reads better than a face turned to the viewer).
        const squaring = lookAt ? face(f.base, lookAt) : f.party ? facingAhead : facingAhead + 185;
        const yaw = squaring, facingView = Math.atan2(viewDir().x, viewDir().z) * 180 / Math.PI;
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
        const walkingUp = animate && id === 'gerard' && last?.stage === 'hold' && last.t < LAST.walk;
        const stepping = attacking ? (t > .12 && t < CONTACT_SECONDS) || (t > .62 && t < 1.06) : movingIn || pivoting || (animate && crossing) || walkingUp;
        const gait = f.walk.update(dt, stepping, animate, attacking ? .3 : .38);
        // A pupil's own figure runs while it runs up and back, and holds its pose standing.
        f.figure?.play(stepping && animate ? 'running' : 'rest', animate ? 1 : 0);
        const stride = gait.stride;
        let hop = 0;
        if (motion && id === effect?.actor) {
          // The giant takes one heavy step and leans its whole height in; the rest run up and hop.
          if (f.rigid) position.set(f.base.x + (motion.x - f.base.x) * .3, f.base.y, f.base.z + (motion.z - f.base.z) * .3);
          else position.set(motion.x, f.base.y, motion.z);
          strike = smooth((t - .28) / .18) * (1 - smooth((t - .57) / .2));
          lean = strike * (f.rigid ? 8 : 13);
          // Cegado: it lunges at where it thinks they are and goes by, wide on its side, half turned and off balance.
          if (whiff && animate) {
            const past = Math.sin(clamp01((t - .18) / .75) * Math.PI), side = whiffSide(id) * (f.rigid ? .4 : 1);
            position.x += (-motion.uz * side * .85 + motion.ux * .45) * past; position.z += (motion.ux * side * .85 + motion.uz * .45) * past;
            roll = side * past * (f.rigid ? 3 : 14); lean += past * 6;
          }
          hop = f.party || f.rigid || !animate ? 0 : Math.sin(clamp01((t - .16) / .46) * Math.PI) * .3;
        }
        if (support && id === effect?.actor) strike = animate ? Math.sin(clamp01(t / .8) * Math.PI) * .65 : 0;
        const lifted = id === effect?.actor && !dual ? raise : dual && id === roles!.caster ? drawing : 0;
        if (lifted) lean = -lifted * 5;
        const guarding = state?.allies.find(a => a.id === id)?.guarding ?? false;
        if (motion && id === effect?.target && animate && !whiff) {
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
        // In Bajo cero's ice (Freática) a foe holds its pose too, its ice drawn by the cell (src/freatica-fight.ts).
        const iced = !!state?.foes.find(u => u.id === id)?.timed?.congelado;
        const stance = statusFx.motion(id), lively = animate && stance !== 'freeze' && !iced && (f.party || f.downAt === undefined);
        const celebrating = animate && f.party && f.hp > 0 && state?.phase === 'won' && !effect && !solemn;
        if (celebrating) hop = Math.abs(Math.sin(time * 5.5 + f.seed)) * .3;
        // Gerard and Aitor knocked out stay down where they fell, lying on their side, until the fight
        // ends or something brings them round: then they get back up. A beaten foe does not fall: it
        // shudders, then crumbles at once into violet specks that hang and drift up, rising a touch
        // itself as it goes (src/disintegrate.ts). Under a flurry, it goes on the last blow.
        // One of Las cuerdas called in mid-fight (the second voice) or tied back (an Eco, by a Lazo) comes together out of
        // specks of its own colour as the move that brings it lands; with no such move (the picker), at once.
        if (f.strings && unit && (f.unborn || (f.downAt !== undefined && f.hp > 0)) && (!f.dissolve || f.dissolve.finished) && !((effect?.summoned === id || effect?.lazo?.target === id) && !impacted)) {
          f.unborn = false; f.downAt = f.upAt = undefined; f.dissolve = undefined; f.model.enabled = true;
          f.arriving = effects.disintegrate(f.model, { own: true, appear: true, colour: CUERDAS_SPECKS[f.strings] });
        }
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
        // The Queen does not come apart: she sags where she stands, bowed, with no strength left, and the last scene decides (`LAST`).
        if (unit?.kind === 'reina' && down >= 0) {
          f.low = animate ? smooth(down / LAST.sink) : 1;
          lean += LAST.bow * f.low; roll += LAST.slump * f.low;
        }
        if (!f.party && !f.robot && down >= 0 && unit?.kind !== 'reina') {
          if (!f.dissolve && (!f.arriving || f.arriving.finished) && (down >= DISINTEGRATE.shudder || !animate)) { f.dissolve = effects.disintegrate(f.model, { own: true, ...f.strings ? { colour: CUERDAS_SPECKS[f.strings] } : f.mesh ? { colour: PHOSPHOR } : {} }); cue('dissolve'); }
          if (animate) {
            const shudder = 1 - clamp01(down / DISINTEGRATE.shudder), up = smooth(f.dissolve?.progress ?? 0);
            roll += Math.sin(down * 60) * 6 * shudder;
            hop += DISINTEGRATE.lift * up; lean -= 8 * up;
          }
        }
        // Lying down, their arms rest along the floor.
        if (fall && f.party) f.arms.forEach((arm, i) => arm.setLocalEulerAngles(-20 * fall, 0, (i ? 1 : -1) * 25 * fall));
        else f.arms.forEach((arm, i) => arm.setLocalEulerAngles(celebrating ? -165 + Math.sin(time * 11 + i * Math.PI) * 12 : guarding ? -60 : -notice * 25 - strike * (i === 0 ? 85 : 35) - lifted * (i === 0 ? 150 : 12) - stride * (i === 0 ? 1 : -1), 0, guarding ? (i === 0 ? -20 : 20) : 0));
        // The last scene: his hand out to her neck, and down again if he lets her be (`LAST`).
        const reach = id === 'gerard' && last ? last.reach : 0;
        if (reach && f.arms[0]) { const was = f.arms[0].getLocalEulerAngles(); f.arms[0].setLocalEulerAngles(pc.math.lerp(was.x, last?.angle ?? LAST.arm[0], reach), 0, pc.math.lerp(was.z, 6, reach)); }
        if (f.limbRig) {
          // Ready: knees a little bent, weight forward; elbows bent, straightening to reach or strike.
          poseLegs(f.limbRig, gait, lively && down < 0 && !celebrating ? 12 + idle.breathe * 4 : 0);
          const bend = guarding ? -100 : -36 - idle.breathe * 4 + 30 * clamp01(Math.max(strike, lifted, celebrating ? 1 : 0, fall, reach));
          f.limbRig.joints[1]?.setLocalEulerAngles(bend, 0, 0); f.limbRig.joints[3]?.setLocalEulerAngles(bend, 0, 0);
          // Holding the artilugio, his arms are its, over whatever the fight gave them.
          if (down < 0) f.held?.update(dt, animate);
          if (lively && down < 0) { roll += Math.sin(time * 1.15 + f.seed) * 1.3; lean += 2.5; }
        } else f.legs.forEach((leg, i) => leg.setLocalEulerAngles(stride * (i % 2 ? -1 : 1), 0, 0));
        f.tail?.setLocalEulerAngles(38 + strike * 20, lively ? Math.sin(time * (attacking ? 16 : 7) + f.seed) * 22 : 0, 0);
        // Wings beat about the body's long axis, faster on the way in to strike; folded when it falls.
        f.wings?.forEach(wing => wing.setLocalEulerAngles(0, (wing.name === 'Ala izquierda' ? -1 : 1) * (lively ? 18 + Math.sin(time * (attacking ? 30 : 15) + f.seed) * 34 : 55), 0));
        // Vertitrón is posed joint by joint (`robotFrame`).
        if (f.robot) { /* posed */ }
        else if (f.minion && f.head && !f.strings) f.head.setLocalEulerAngles(lively ? Math.sin(time * 2.2 + f.seed) * 6 - strike * 20 : 0, lively ? idle.look * 10 : 0, lively ? Math.sin(time * 1.7) * 5 : 0);
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
          if (f.party && f.body) {
            // Held by the Queen, their eyes go violet (docs/castle-bosses.md § Aitor, held); freed, they are theirs again.
            const held = !!unit?.castle?.held && unit.hp > 0;
            if (held && !f.possessed) f.possessed = f.eyes.map(eye => { const glow = new pc.Entity('Ojo poseído'); glow.addComponent('render', { type: 'sphere', material: possessedEyes, castShadows: false, receiveShadows: false }); glow.setLocalPosition(0, 0, .004); glow.setLocalScale(.027, .036, .009); eye.addChild(glow); return glow; });
            f.possessed?.forEach(glow => { glow.enabled = held; });
            // A fighter's face follows the fight: laughing when it is won, pain when hit or down.
            const face = faceOf(f.body);
            if (celebrating) face.show('riendo', .3);
            else if (fall > .5 || (f.flash > .25 && f.hp > 0 && time - (f.hitAt ?? -9) < .4)) face.show('dolor', .5);
            else if (notice > .1) face.show('sorprendido', .3);
            else if (id === effect?.actor || (state?.phase === 'player' && state.allies[state.active]?.id === id)) face.show('decidido', .3);
            else if (unit && unit.hp < unit.maxHp * .3) face.show('preocupado', .3);
            // The head comes round a little to the camera, chin up, without staring at it.
            const toView = ((facingView - f.turn + 540) % 360) - 180;
            face.update(dt, { animate, resting: lively && id !== effect?.actor ? 1 : 0, awake: 1, turn: lively && id !== effect?.actor ? Math.max(-24, Math.min(24, toView * .4)) : 0, level: lively ? 3 : 0 });
          } else {
            f.head?.setLocalEulerAngles(lively ? -idle.breathe * 2 : 0, lively && id !== effect?.actor ? idle.look * 12 : 0, 0);
            f.eyes.forEach(eye => { const s = eye.getLocalScale(); eye.setLocalScale(s.x, f.eyeScale * (lively ? idle.blink : 1), s.z); });
          }
        }
        // A campsite foe shows its rule: what it is about to do shows when its action lands, not before.
        if (f.camp && unit) {
          const seen = camera(), toCamera = ((Math.atan2(seen.x, seen.z) * 180 / Math.PI - f.turn + 540) % 360) - 180;
          fears?.camping.show(f.model, unit, time, dt, animate, effect?.actor === id && !impacted ? effect : undefined, toCamera);
        }
        if (f.mesh && unit) {
          const seen = camera(), toCamera = ((Math.atan2(seen.x, seen.z) * 180 / Math.PI - f.turn + 540) % 360) - 180;
          fears?.modelo.show(f.model, unit, time, dt, animate, (effect?.actor === id || effect?.target === id) && !impacted ? effect : undefined, toCamera);
        }
        if (f.strings && unit) {
          const seen = camera(), toCamera = ((Math.atan2(seen.x, seen.z) * 180 / Math.PI - f.turn + 540) % 360) - 180;
          const song = state ? songNow(state) : undefined;
          fears?.cuerdas.show(f.model, unit, time, dt, animate, effect?.actor === id && !impacted ? effect : undefined, toCamera, song, effect?.actor === id && !effect.cancelled ? effect.ability?.id : undefined);
          // Each note of La Voz's song, as it starts: its beam from her throat, in its colour, at whoever she sings at (La: at everyone).
          if (f.strings === 'voz' && song?.sounding && unit.hp > 0 && animate && state) {
            const key = `${song.loop}:${song.index}`;
            if (sungNote !== key) { if (sungNote !== undefined) voiceBeam(f, unit, song.tone); sungNote = key; }
          }
        }
        f.body?.setLocalPosition(0, 0, 0);
        // The camera supplies the battle zoom; keep fighters proportional to the street.
        const since = f.hitAt === undefined ? Infinity : time - f.hitAt;
        // Wood does not squash: the giant shudders instead, a short stiff tremor.
        const squash = animate && since < 1 && !f.rigid && !f.camp && !f.strings && !f.mesh ? Math.exp(-since * 7) * Math.cos(since * 30) : 0;
        if (f.rigid && animate && since < .4) roll += Math.exp(-since * 12) * Math.sin(since * 70) * .8;
        const breathe = lively && down < 0 && !f.rigid && !f.strings && !f.mesh && (!f.camp || f.camp === 'mago') ? idle.breathe * .018 + (f.minion ? Math.sin(time * 3.1 + f.seed) * .04 : 0) : 0;
        // Encogido (Rayo encogedor): smaller from when the ray lands, and back to size when it wears off.
        const shrunk = state && [...state.foes, ...state.allies].find(u => u.id === id)?.timed?.encogido && !([effect, upcoming].some(e => (e?.skill === 'rayo-encogedor' || e?.dual?.id === 'a-escala') && e.target === id && (e !== effect || !impacted)));
        f.shrink = animate ? f.shrink + ((shrunk ? SHRUNK : 1) - f.shrink) * (1 - Math.exp(-dt * 8)) : shrunk ? SHRUNK : 1;
        f.model.setLocalScale(f.scale.x * f.shrink * (1 + squash * .09), f.scale.y * f.shrink * (1 - squash * .16 + breathe), f.scale.z * f.shrink * (1 + squash * .09));
        if (stance === 'sway' && animate && down < 0) roll += Math.sin(time * 2.3 + f.seed) * (f.rigid ? 1.2 : 6);
        // Cegado: it searches for them, turning one way and the other and leaning in to peer, never settling.
        const groping = stance === 'grope' && animate && down < 0 && id !== effect?.actor ? (Math.sin(time * 1.35 + f.seed * 2.1) * 20 + Math.sin(time * 3.2 + f.seed) * 5) * (f.rigid ? .3 : 1) : 0;
        if (groping) lean += (f.rigid ? 1 : 4) + Math.sin(time * 2.6 + f.seed) * (f.rigid ? .5 : 2);
        f.model.setLocalEulerAngles(lean, f.turn + groping, roll);
        if (fall) f.model.setPosition(position.x, groundHeight(position.x, position.z) + hop + fall * .22, position.z);
        else { f.model.setPosition(position); f.plantFeet(groundHeight, hop); }
        if (stance === 'twitch' && animate && down < 0 && Math.random() < .4) f.model.translate((Math.random() - .5) * .05, Math.random() * .02, (Math.random() - .5) * .05);
        f.model.enabled = !f.unborn && !f.dissolve?.finished;
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
      // Rayo solar's fire waits on each foe for its beam to cross them.
      const sweepAhead = effect?.release && animate ? solarAhead(effect) : undefined;
      // A dual's fire on every foe it reaches waits for its contact (Campana de Gauss's dice are still falling through the pegs),
      // and while its banner is up before it plays (`upcoming`): the rules have already lit it.
      const coming = upcoming?.dual ? upcoming : effect?.dual && !impacted ? effect : undefined;
      const dualAhead = coming?.hits && animate ? hitSet(coming) : undefined;
      // A dual that sets fire claw by claw (Zarpazos de fuego): the fire rises with each one that lands.
      const dualBurn = dual && dualPlan && effect?.burns && blows < claws ? Math.max(dualPlan.burnBefore, ...effect.burns.slice(0, blows)) : undefined;
      // An element's reaction settled but not landed: whoever it turns still shows what they carried.
      // So does the fire Electrólisis's gas leaves going up (`ignited`): nobody burns from it before the blow that lights it lands.
      const turning = (effect?.reaction || effect?.ignited) && !impacted ? new Set([effect.target, ...(effect.reaction?.hits ?? []).map(h => h.target), ...(effect.ignited?.hits ?? []).map(h => h.target)]) : undefined;
      // Atractor extraño: the others keep what they carry until it rises off them, its target until the butterfly falls into it.
      const gathering = effect?.gathered && !impacted ? gatheringNow(effect) : undefined;
      if (state) for (const unit of [...state.allies, ...state.foes]) {
        if (turning?.has(unit.id) || gathering?.held.has(unit.id)) continue;
        if (gathering?.bare.has(unit.id)) { syncStatuses(unit.id, unit.statuses, { ...unit.timed, quemado: undefined }, !!unit.capacitor); continue; }
        const shown = shownStacks.get(`${unit.id}:quemado`) ?? 0;
        if (dualBurn !== undefined && unit.id === effect?.target && unit.timed?.quemado) { syncStatuses(unit.id, unit.statuses, { ...unit.timed, quemado: dualBurn ? { ...unit.timed.quemado, level: dualBurn } : undefined }, !!unit.capacitor); continue; }
        // The charge stays on show until the blow that lets it go lands.
        // Arco voltaico waiting charged shows the same charge on whoever waits, from the moment the arch settles.
        const arcCharged = !!unit.stalk?.charged && !(!impacted && effect?.dual?.id === 'arco-voltaico' && effect.stalker === unit.id);
        const charged = arcCharged || (!!unit.capacitor && !(!impacted && effect?.actor === unit.id && effect.capacitor === 'stored')) || (!impacted && effect?.actor === unit.id && effect.capacitor === 'spent') || (!impacted && (effect?.discharge?.from === unit.id || effect?.arcDischarge?.from === unit.id));
        syncStatuses(unit.id, unit.statuses, (unit.id === inFlight || !!sweepAhead?.has(unit.id) || !!dualAhead?.has(unit.id)) && unit.timed?.quemado?.level !== shown
          // The fire it showed can be gone already (Plasma put it out, a Gemelo felled lost everything it carried): it stays as it was until the blow lands.
          ? { ...unit.timed, quemado: shown ? { left: TIMED.quemado.seconds, next: TIMED.quemado.every, ...unit.timed?.quemado, level: shown } : undefined } : unit.timed, charged);
      }
      // A cortina follows the fight's word as the powder does: one a passive raised stands up, one whose rounds are over comes down.
      if (state) for (const ally of state.allies) powderFx.trackScreen(ally.id, cortinaRounds(state, ally) > 0, foesCentre, nextMix);
      statusFx.update(dt, time);
      freatica.sync(state, dt);
      // Enjambre's network stays until every bomb it put on has gone off (or its foe has fallen), then fades.
      if (swarmFx.on && state && !(effect?.skill === 'enjambre' && !impacted) && ![...swarmHeld].some(id => state!.foes.find(f => f.id === id && f.hp > 0)?.timed?.bomba || bombs.has(id))) swarmFx.release();
      swarmFx.update(dt);
      // Bajo cero: while a foe stands in its ice, the ice ticks now and then.
      if (state?.foes.some(f => f.hp > 0 && f.timed?.congelado) && (iceTickIn -= dt) <= 0) { cue('ice-tick', { volume: .55 }); iceTickIn = 1.2 + Math.random() * .8; }
      // Stats that stay up or down give off motes from the head (src/stat-motes.ts). What this
      // action changes waits for its blow to land, and the motes start as its chevrons pass.
      if (state) {
        const pending = effect && !impacted ? new Set([effect.target, ...(effect.stats ?? []).map(c => c.target), ...(effect.hits ?? []).map(h => h.target), ...(effect.splash ?? []).map(h => h.target)]) : undefined;
        for (const unit of [...state.allies, ...state.foes]) if (!pending?.has(unit.id)) motes.want(unit.id, [...new Set(statShifts(state, unit).map(shift => shift.way))]);
      }
      motes.update(dt, moteAnchor, animate);
      updateCats(dt, t, animate, target);
      updateBips(dt, t, animate, target);
      updateBombs(dt, animate); updateEscorts(dt, animate);
      updateDice(dt, t, animate, target);
      if (animate) holdTells(dt, t);
      if (effect && actor && skyOf(effect)) skyStep(effect, actor, target, t, animate);
      // The astral's night: the place goes dark and blue while a skill from the sky runs (less for
      // Estrella fugaz, which is one star), and each landing lights it up for a moment.
      {
        const fromSky = effect && animate ? skyOf(effect) : undefined, oneStar = !!effect && animate && effect.skill === 'estrella-fugaz';
        // Relevo de sangre's star comes down in the astral's night too, and Bombardeo orbital's ecos and salvos glow in a dimmer one.
        const relayNight = !!effect && animate && effect.dual?.id === 'relevo-de-sangre' && t > .05 && t < duoEnd(effect) - .3 ? .5 : 0;
        const orbitNight = !!effect && animate && (effect.dual?.id === 'bombardeo-orbital' || effect.detonation === 'bombardeo-orbital') && t > .05 && t < duoEnd(effect) - .35 ? .45 : 0;
        const want = fromSky ? (t > .1 && t < diceEnd(effect!) - .35 ? .9 : 0) : oneStar ? (t > .1 && t < diceContact(effect!) + .3 ? .55 : 0) : Math.max(relayNight, orbitNight);
        night += (want - night) * (1 - Math.exp(-dt * (want > night ? 8 : 4.5)));
        nightLift *= Math.exp(-dt / .2);
        if (night < .004 && !want) night = 0;
        if (night || shownNight) { setNight?.(night, nightLift); shownNight = night; }
      }
      updateRocks(dt, animate);
      // Foc Binari: once the hand is up, the two streams leave it for the target's chest.
      if (casting && animate && actor && target && spelled !== effect) {
        spelled = effect;
        const floor = groundHeight(target.base.x, target.base.z);
        const chest = target.part ? v3(chestOf(target)) : { x: target.base.x, y: floor + (target.minion ? .9 : target.party ? 1.05 : .7) * target.scale.y, z: target.base.z };
        const hand = actor.arms[0]?.findByName('Mano') ?? actor.model;
        // Integral impropia opens his circle towards the middle of the party, where it will lie.
        // ∂Q/∂t Condensador, aimed at himself, opens it before him.
        const ahead = () => { const v = viewDir(), d = Math.hypot(v.x, v.z) || 1; return { x: chest.x + v.x / d, y: chest.y + .3, z: chest.z + v.z / d }; };
        const aim = effect!.skill === 'integral' ? partyMiddle() ?? chest : effect!.skill === 'condensador' || (effect!.skill === 'superficie-minima' && target === actor) ? ahead() : chest;
        mathCast.start(hand, aim, { element: focBinari ? 'fuego' : effect!.skill === 'condensador' ? 'electrico' : effect!.skill === 'superficie-minima' ? 'agua' : effect!.element, cure: curing || effect!.skill === 'integral', ball: spelling, launch: castLaunch, zero: takeZero(actor.model, hand.getPosition()), size: state?.allies.some(a => a.id === effect!.actor && !grownUp(a.profile)) ? CHILD_CIRCLE : 1 });
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
      if (figured && animate && actor && target && cast !== effect && t >= CAST_LAUNCH) {
        cast = effect;
        drawFigure(effect!, (mathCast.centre ?? (actor.arms[0]?.findByName('Mano') as pc.Entity | null ?? actor.model).getPosition()).clone(), actor, target);
      }
      // Zarpazo sangriento: the cat pounces, the wearer's fist leaves no arc.
      if (animate && effect && actor && !catStrike && !botStrike && !dicing && !dual && !spelling) trailsFor(effect, actor, target, t, support);
      // The lurch springs back and shakes keep going through a hit-stop: they run on real time.
      shake = Math.max(0, shake - elapsed);
      sway.forEach(s => spring(s, elapsed, HIT.spring.omega, HIT.spring.zeta));
      spring(zoom, elapsed, HIT.punch.omega, 1);
      const quake = animate ? shake * shake * .3 : 0;
      if (animate) cameraKick.set(sway[0].x + wobble(real, 0) * quake, sway[1].x + wobble(real, 5) * quake * .6, sway[2].x);
      // The fight is won: confetti in the party's ánima colours rains over the field.
      if (state?.phase === 'won' && !effect && !celebrated && animate && !state.foes.some(u => u.kind === 'reina')) {
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
      } else if (last) lastLens();
      else if (effect && animate && (duoOf(effect) || effect.detonation) && t < duoEnd(effect) - .25) duoLens(effect, target, t);
      else if (!lensHold) rest();
      const ease = animate ? 1 - Math.exp(-elapsed * 5) : 1;
      for (const key of ['yaw', 'pitch', 'zoom', 'x', 'y', 'z'] as const) lens[key] += (lensWant[key] - lens[key]) * ease;
      const was = spotAmount;
      spotAmount += (spotWant - spotAmount) * (animate ? 1 - Math.exp(-elapsed * (spotWant ? 10 : 4)) : 1);
      if (spotAmount < .002) spotAmount = 0;
      if (spot && was && !spotAmount) spot(0, []);
      // A golpe crítico drains the picture for as long as it holds the fight, then gives the colour back
      // (real time). A dual's own spotlight, when it is on, already has the picture.
      if (critGrey > 0) {
        if (!animate) critGrey = 0;
        else if ((critHeld -= elapsed) <= 0) critGrey = Math.max(0, critGrey - elapsed / CRIT.greyFade);
        if (spot && !spotAmount) spot(critGrey * CRIT.grey, critGrey ? critKeep.filter(f => f.model.enabled).slice(0, 4).map(f => ({ ...v3(chestOf(f)), radius: 1.15 * f.scale.y })) : []);
      }
      focus.add(new pc.Vec3(lens.x, lens.y, lens.z));
      // On someone's turn the camera leans in on them, so their face reads.
      const onTurn = !effect && state?.phase === 'player' && entryTime >= ENTRY_SECONDS ? fighters.get(state.allies[state.active]?.id ?? '') : undefined;
      turnPush += ((onTurn ? 1 : 0) - turnPush) * (animate ? 1 - Math.exp(-elapsed * 2.6) : 1);
      if (onTurn) turnAt.copy(onTurn.base);
      focus.add(new pc.Vec3((turnAt.x - anchor.x) * .32 * turnPush, 0, (turnAt.z - anchor.z) * .32 * turnPush));
      // Without motion (reduced motion, a hidden tab) every blow has landed by now: done at once, a dual or a cast too.
      const over = complete && (effect ? !animate || t >= (dual ? dualEnd : duo || blastOf ? duoEnd(effect) : casting ? figured ? figureEnd(effect.skill as FigureSkill, effect.strikes?.length ?? 1) : castContact + CAST_GAP + .42 : dicing ? diceEnd(effect) : bipSkill ? bipEnd(effect) : effect.skill && POWDER_SKILLS[effect.skill] ? POWDER_SKILLS[effect.skill].end : effect.hammer?.length ? contact + (effect.hammer.length - 1) * HAMMER_GAP + .8 : effect.skill && FREATICA_SKILLS[effect.skill] && effect.kind === 'skill' ? FREATICA_SKILLS[effect.skill].end : effect.pounceDual ? ARC_POUNCE.end : effect.pounce ? ACECHO.end : effect.hunt?.length ? contact + (effect.hunt.length - 1) * huntGap(effect.hunt.length) + .75 + (effect.ward ? Math.max(0, effect.ward.length * WARD_STEP - .4) : 0) : support ? .85 : target ? ACTION_SECONDS : .65) : entryTime >= ENTRY_SECONDS);
      if (over) {
        // Any foe Rayo solar's beam never reached still takes its blow.
        if (effect?.release && impacted) while ((solarBurned.get(effect) ?? 0) < solarPlan(effect).crossings.length) solarCross(effect, true);
        settle(); effect = undefined; impact = undefined;
      }
    },
    destroy() { settle(); arrows.destroy(); motes.clear(); battleRoot.destroy(); dogs.forEach(model => model.destroy()); materials.forEach(m => m.destroy()); },
  };
}
