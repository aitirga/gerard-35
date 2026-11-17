/**
 * Story progress as a set of flags, and the rules that turn game events into story beats.
 * Pure: no DOM, no engine. `main.ts` runs the returned effects; `game.ts` reads the derived
 * state (NPCs, companion, extra interactions). Flags are what the server saves.
 */
import type { Dialogue } from './dialogue';
import type { EnvironmentId, Interaction } from './environments';
import { PATROLS, createModelo, type ModeloState, type ZoneId } from './modelo.ts';
import { EMILIE_SCALE, LINES_EMILIE, MODELO_PLACE, PISO, PLACES_EMILIE, PLACES_MODELO, PLACES_PISO, POBLE_SEC } from './friends/emilie.ts';
import { facingToward, type Cell } from './movement.ts';
import type { ItemId } from './items';
import type { CampingEncounter, CuerdasEncounter, ModeloEncounter, LucaEncounter } from './battle.ts';
import { ANIMA_NAMES, ANIMA_OWNERS, DUALS, SKILLS, canWear, manaMax, palaceGuards, type ClassId, type DualId, type DualSpec, type Improved, type PartySlot, type SkillId } from './battle.ts';
import { costOf, improvedBy, improvementOf, withinEcos, without } from './ecos.ts';
import { award, levelFlag, levelOf } from './levels.ts';
import type { ProfileId } from './stats';
import { BUBBLES, CARDS, HINTS, LEASH, LINES, PLACES, type CardId, type HintId } from './chapter-1.ts';
import { LINES_2, PLACES_2 } from './chapter-2.ts';
import { ANIMA_IDS, animaBonus, castleThreat, type AnimaId } from './animas.ts';
import { stationOf } from './transit.ts';
import { ALEGIA, CUERDAS_PLACE, LINES_MARTA, MARTA_SCALE, PLACES_CUERDAS, PLACES_MARTA, QUALITIES } from './friends/marta.ts';
import { BEAM, DOOR as LUCA_DOOR, INTERIOR, LINES_LUCA, LOOKS, LUCA_SCALE, MIRRORS, MIRRORS_SEEN, MIRRORS_START, PLACES_LUCA, QUEUES, SAGRADA, SALON_SOLID, SALON_VIEW, ZONES, queueCells, type LookId } from './friends/luca.ts';
import { trace, turned, type Facing } from './espejos.ts';
import { BEACH, CAMP, CAMP_FREED, CAMP_HUNTERS, LINES_UNI, PLACES_CAMP, PLACES_UNI, TAG, UNI_FRIENDS, UNI_SCALE, lockOpens, type UniFriend } from './friends/universidad.ts';
import type { Board } from './parcelas.ts';
import { castleEntry, extraSlots, isCastlePlace, type CastleEncounter } from './castle.ts';
import { castleEnvironmentFor } from './castle-floor.ts';
import { castleBattle, castleEnding, castleFears, castleGate, castleInteract, castleInteractions, castleNear, castleRedirect, castleTriggers, freshCastle, type CastleHost, type CastleRun, type EndingChoice } from './castle-story.ts';
import { CALLE, FEARS, LINES_NURIA, MAZE, PLACES_NURIA, STREET, migrateBeaten, type FearEncounter } from './friends/nuria.ts';
import type { CatId } from './cats';
import { COSTS, DAY_END, DAY_START, EVENING, LATE, NIGHT, WOKE_LATE, dusk, freshDays, isNight, readDays, spread, stage, type Activity, type Days } from './days.ts';
import { CAMPING_DOOR, CAMPING_GATE, ENVIRONMENTS, type Environment } from './environments.ts';

/** Keep in sync with STORY_FLAGS in server.py (a test checks it). */
export const STORY_FLAGS = [
  'intro', 'met-jan', 'got-shoes', 'got-potion', 'got-backpack', 'bernat-joined', 'bernat-stalled', 'dejavu',
  'minion', 'first-fight', 'palace', 'in-palace', 'got-chicle', 'matemagico', 'wrapper-room',
  'caught', 'got-wrapper',
  // The snow globe on the flat's TV unit (docs/chapter-2.md § The snow globe).
  'got-bola',
  // Chapter 2 (docs/chapter-2.md): open progression, so these are never cleared.
  'tv-news', 'metro', 'rec-comtal', 'castle', 'palace-tried', 'clue-r4', 'anima-nuria',
  // Nuria's mission (docs/quests/nuria.md): Papagato is the party's for good.
  'papagato',
  // Ánima levels reached (src/levels.ts).
  'papagato-2', 'papagato-3', 'matemagico-2', 'matemagico-3',
  // Nuria's mission: out of the R4 at Cardedeu, Uri found and himself again, and the two lights
  // that went with Gerard and Aitor (docs/quests/nuria.md).
  'cardedeu', 'nuria-uri', 'luz-nuria', 'luz-uri',
  // The university friends' mission (docs/quests/universidad.md): Aitor's word about the beach, the
  // talk on the sand, into the campsite through the spiral, the pool's padlock opened with the letters
  // of the maze's three words, Las parcelas solved by the pool (the merendero's door), La Sobremesa beaten,
  // their ánima, and the five lights that went with Gerard and Aitor (one a couple, one each alone).
  'clue-uni', 'barceloneta-uni', 'camping', 'candado', 'parcelas', 'sobremesa', 'anima-universidad',
  'luz-anna-alvaro', 'luz-miquel-sarah', 'luz-soraya', 'luz-nico', 'luz-joan',
  // Marta's mission (docs/quests/marta.md): spoken to in Alegia, into Las cuerdas through the note
  // the piano left in the air, La Voz beaten, her ánima and the light that went with them.
  'alegia-marta', 'cuerdas', 'voz', 'anima-marta', 'luz-marta',
  // Emilie's mission (docs/quests/emilie.md): spoken to in her flooded flat in Poble Sec, into her model
  // through her laptop, El que no converge beaten, her ánima and the light that went with them.
  'poble-sec-emilie', 'modelo', 'converge', 'anima-emilie', 'luz-emilie',
  // Luca's mission (docs/quests/luca.md): the photo gone grey at home, the Sagrada Família on the TV's
  // ticker and on a poster, Luca met by the pond, into Fran's salon, Fran beaten, his ánima and light.
  'clue-luca-foto', 'clue-sagrada', 'clue-sagrada-cartel', 'sagrada-luca', 'peluqueria', 'fran', 'anima-luca', 'luz-luca',
  // The castle (docs/castle.md, docs/castle-bosses.md): Aurelià beaten and his light, the management team and
  // theirs, Gerard fallen to Aitor's hand, the artilugio, the Queen beaten, and which of the two endings.
  'aurelia', 'luz-aurelia', 'direccion', 'luz-mar', 'luz-montse', 'luz-pilar', 'aitor-poseido', 'artilugio', 'reina', 'final-acabar', 'final-bajar',
] as const;
export type StoryFlag = typeof STORY_FLAGS[number];
/**
 * Flags that changed name; old saves keep working (server.py has the same map). Nil's light is
 * gone (Nuria's household gives two), so a save that had it keeps Uri's.
 */
const RENAMED_FLAGS: Record<string, StoryFlag> = { noista: 'matemagico', 'luz-nil': 'luz-uri' };
/** Only flags this version knows, renamed ones under their new name. */
const knownFlags = (flags: Iterable<string>) => new Set([...flags].map(f => RENAMED_FLAGS[f] ?? f).filter((f): f is StoryFlag => (STORY_FLAGS as readonly string[]).includes(f)));
/** Whose lights can be won. */
export const LIGHTS = ['nuria', 'uri', 'anna-alvaro', 'miquel-sarah', 'soraya', 'nico', 'joan', 'marta', 'emilie', 'luca', 'aurelia', 'mar', 'montse', 'pilar'] as const;
export type LightId = typeof LIGHTS[number];

export type StoryEvent =
  | { type: 'start' }
  | { type: 'interact'; id: string }
  /** Gerard walked past PLACES.southRow on the street. */
  | { type: 'south' }
  /** Gerard pulled against the leash while Bernat stalls. */
  | { type: 'leash' }
  /** La Reina Bubbaloo's minion has stepped out and popped its bubble: the dogs obey it now. */
  | { type: 'minion' }
  /**
   * A fight ended; `encounter` says which one (the street dogs if missing), `worn` the ánimas that
   * took part (src/levels.ts `participants`) and `xp` what the fight was worth to each of them.
   */
  | { type: 'battle'; won: boolean; encounter?: EncounterId; worn?: ClassId[]; xp?: number; /** The Queen had Aitor when it ended (src/castle-fight.ts `aitorTaken`). */ taken?: boolean }
  /** The palace has finished rising over the north end of the street. */
  | { type: 'palace' }
  /** Gerard is (or is no longer) heading back south, away from the palace. */
  | { type: 'away'; away: boolean }
  /** Gerard stepped into a named room of the scene. */
  | { type: 'room'; id: string }
  /** An ánima woke up in Gerard, mid-fight (Matemágico, in the palace). */
  | { type: 'class'; id: Exclude<GerardClass, 'dadaista'> }
  /** The Queen's hands have caught Gerard and Bernat: the screen is black. */
  | { type: 'caught' }
  /** Gerard walked up to one of the story's triggers (`story.triggers`). */
  | { type: 'near'; id: string }
  /** The party came up out of a station after a trip. */
  | { type: 'arrive'; station: string }
  /** A pitch chosen on Las parcelas' board (src/parcelas-ui.ts): a lantern lit, a tent woken, the black one; `solved` when every pitch is lit. */
  | { type: 'parcelas'; outcome: 'lit' | 'tent' | 'black'; board: Board; solved: boolean }
  /** Words tried on the pool gate's padlock (src/candado-ui.ts). */
  | { type: 'candado'; numbers: number[] }
  /** The party walked in through home's portal from the street (src/night.ts: at night, the day is over). */
  | { type: 'home' }
  /** Something used from the Objetos panel (src/items.ts `use`). */
  | { type: 'use'; item: ItemId }
  /** The last scene: Gerard chose what to do with her (src/endings.ts). */
  | { type: 'ending'; choice: EndingChoice };

export type StoryEffect =
  | { kind: 'dialogue'; dialogue: Dialogue }
  | { kind: 'item'; item: ItemId }
  | { kind: 'hint'; id: HintId }
  | { kind: 'card'; id: CardId }
  /** The minion's head rises out of the manhole and pops a gum bubble over the dogs. */
  | { kind: 'minion' }
  /** A fight starts right away. */
  | { kind: 'battle'; encounter: EncounterId }
  /** The north end of the street turns into La Reina Bubbaloo's palace. */
  | { kind: 'palace' }
  /** La Pompa, the palace gate's bubble, bursts as they walk through. */
  | { kind: 'gate' }
  /** The story moves Gerard (and Bernat) to another scene. */
  | { kind: 'travel'; environment: EnvironmentId; cell: Cell }
  /** The snow globe's white comes over the picture (`on`) or clears. */
  | { kind: 'snow'; on: boolean }
  /** The second minion rises from the drain in the wrapper room. */
  | { kind: 'drain' }
  /** Minions everywhere, the Queen's gelatine hands catch them both, and all goes black. */
  | { kind: 'ambush' }
  /** Chapter 2: out of the black, Gerard (35) wakes in bed beside Aitor with a start; `rise` gets them both up. */
  | { kind: 'wake' }
  | { kind: 'rise' }
  /** The TV news broadcast (chapter 2). */
  | { kind: 'news' }
  /** Down into a station: the network map, to travel from `station`. */
  | { kind: 'metro'; station: string }
  /** The party fell: pink, then black (chapter 2 wakes Gerard at home with everything kept). */
  | { kind: 'fall' }
  /** Out of the black again where they now stand (caught in the friends' game of tag: back up the sand). */
  | { kind: 'recover' }
  /** The reception's blackboard opens as Las parcelas' board, where it was left (src/parcelas-ui.ts). */
  | { kind: 'parcelas'; board?: Board }
  /** The pool gate's padlock opens on screen: three wheels of numbers (src/candado-ui.ts). */
  | { kind: 'candado' }
  /** The photo with the melon: a flash and the scene held as a photo with its caption (docs/quests/universidad.md). */
  | { kind: 'photo'; caption: string }
  /** The camera turns to a named anchor of the scene (the palace) or frames `cell`, `height` metres of view; back to Gerard with neither. */
  | { kind: 'look'; anchor?: string; cell?: Cell; height?: number }
  /**
   * Into the portal standing in the scene (Uri's bubble, the spiral in the sea), or one that opens at
   * `open` first: `who` comes apart into specks the whirlpool swallows (src/disintegrate.ts `into`),
   * `everyone` the party and all the people there. The party then travels on; a person stays gone (`sank`).
   */
  | { kind: 'portal'; who: 'party' | 'everyone' | UniFriend; open?: Cell; queen?: true }
  /** La Sobremesa beaten: back at the long table it comes apart, and the seven are left standing round it. */
  | { kind: 'unmask' }
  /** Out of a spiral at `cell` on the other side: everyone there comes together out of specks, and it closes. */
  | { kind: 'emerge'; cell: Cell }
  /** The Queen has covered everything: the end, with the way back to the morning before. */
  | { kind: 'doom' }
  /**
   * An ánima reached a new level and learned `skills` (src/levels.ts). `quiet` when the fight's
   * victory screen has already shown it.
   */
  | { kind: 'learn'; classId: ClassId; level: number; skills: SkillId[]; quiet?: boolean }
  /**
   * An ánima woke up outside a fight (Nuria lends the cats: Papagato), as a note; `kept` when it is
   * the party's for good (the mission won), as the big ÁNIMA DESBLOQUEADA banner.
   */
  | { kind: 'anima'; classId: ClassId; kept?: boolean }
  /**
   * The lights of the people Gerard helped leave them and go into Gerard and Aitor, one each in turn
   * (docs/quests/nuria.md § The lights). They are the party's Ecos de luz to spend at home.
   */
  | { kind: 'lights'; people: string[] }
  /** The jar at home opens: its Ecos de luz are put into the ánimas (src/jar-ui.ts). */
  | { kind: 'jar' }
  /**
   * Someone far off shouts, in a shout bubble over their head, and the game goes on, never stopped
   * (Uri from the top of his tower: going in, up each ring, onto the platform). `beat`: seconds the
   * next story beat waits so the shout is seen first (Vertitrón's fight after Uri calls for it).
   */
  | { kind: 'shout'; speaker: 'uri'; text: string; beat?: number }
  /** A recording plays once over what follows, without stopping the game (src/music.ts `TRACKS`): Marta's «Izana dena geroa» at the piano. */
  | { kind: 'song'; track: 'izana' }
  /** The last scene (docs/castle-bosses.md): she is on the floor, and Gerard's dock has two commands (src/endings.ts). Answered with an `ending` event. */
  | { kind: 'ending' }
  /** What the choice does, told over black before the Monday after. */
  | { kind: 'epilogue'; choice: EndingChoice; text: string };

/** Scripted fights: the possessed street dogs, the palace minion that wakes Matemágico, and chapter 2's palace guards. */
export type EncounterId = 'dogs' | 'palace-minion' | 'palace-guards' | 'night-guard' | 'sobremesa' | FearEncounter
  // Càmping Eurosport (docs/quests/universidad.md): its small fights, the black pitch and El Campeón.
  | 'camping-magos' | 'camping-dados' | 'camping-agentes' | 'camping-tienda' | 'camping-negra' | 'campeon'
  // Las cuerdas (docs/quests/marta.md): a quality after each maze, and La Voz.
  | CuerdasEncounter
  // The castle (docs/castle.md): its rooms' pupils, Aurelià, Dirección and the Queen.
  | CastleEncounter
  // Emilie's model (docs/quests/emilie.md): a fight in each zone of the section, and El que no converge.
  | ModeloEncounter
  // Fran's salon (docs/quests/luca.md): a fight in each zone.
  | LucaEncounter;
/** Classes (docs/party.md): unlocked by the story, shared by the whole party. */
/** The ánimas Gerard can wake (Tecnópata is Aitor's). */
export type GerardClass = Exclude<ClassId, 'tecnopata'>;

/** Someone standing in a scene: a character model, or one of the cats (`cat`). */
export interface StoryNpc {
  id: 'mama' | 'jan' | 'nuria' | 'uri' | 'haru' | 'yuki' | 'marta' | 'emilie' | 'luca' | 'fran' | 'capellan' | UniFriend; character: string; environment: EnvironmentId; cell: Cell; scale: number; cat?: CatId;
  /** The Queen holds them: violet eyes, and they keep looking where they face. */
  possessed?: boolean;
  /** Standing in the sea this deep (m): Anna in the shallows. */
  wade?: number;
  /** Which way they face, in degrees (0 faces +z, the sea in the Barceloneta). */
  facing?: number;
  /** How much of their colour is gone, 0 to 1 (Luca, docs/quests/luca.md): the game greys their figure that much. */
  faded?: number;
  /** Where their reflection stands in water, in full colour whatever they look like (Luca in the pond). */
  reflection?: Cell;
  /** How far above the floor they stand (Fran, up the presbytery's steps). */
  lift?: number;
}
/**
 * The university friends' mission while it runs (docs/quests/universidad.md); not saved, as Nuria's.
 * `chase`: the game of tag is on; `caught`: how many times they were caught today; `spiral`: Anna is
 * going into the spiral beside her, `sunk` once she has come apart into it; `entered`: in the campsite.
 */
export interface UniRun {
  chase: boolean; caught: number; spiral: boolean; sunk: boolean; entered: boolean;
  /** In the campsite: the fights won this visit (`CAMP_HUNTERS` ids, `campeon`), the hunter whose fight is on, what was already said once, and Las parcelas' board. */
  beaten: string[]; fighting?: string; told: string[]; board?: Board;
}
/**
 * Marta's mission while it runs (docs/quests/marta.md); not saved, as the others. `beaten`: the
 * qualities beaten this visit (QUALITIES ids); `told`: what was already said once.
 */
export interface MartaRun { beaten: string[]; told: string[] }
export const freshMarta = (): MartaRun => ({ beaten: [], told: [] });
/**
 * Emilie's mission while it runs (docs/quests/emilie.md); not saved, as the others. `section`: the run
 * through her model (src/modelo.ts: the zone, what was measured, the patrols), kept while they come and
 * go by her laptop; `told`: what was already said once.
 */
export interface EmilieRun { told: string[]; section?: ModeloState }
export const freshEmilie = (): EmilieRun => ({ told: [] });
/**
 * Luca's mission while it runs (docs/quests/luca.md); not saved, as the others. `entered`: in Fran's
 * salon once (that hour is spent); `beaten`: the zones won this visit (ZONES ids), in the order the
 * way goes; `told`: what was already said once; `mirrors`: how the nave's mirrors stand (MIRRORS).
 */
export interface LucaRun { entered: boolean; beaten: string[]; told: string[]; mirrors: number[] }
export const freshLuca = (): LucaRun => ({ entered: false, beaten: [], told: [], mirrors: [...MIRRORS_START] });
/**
 * What the snow globe keeps (docs/chapter-2.md § The snow globe): each mission's run as it was the
 * last time the globe was shaken. A day's end, a fall or a reload puts the missions back to this.
 */
export interface Kept { nuria?: NuriaRun; uni?: UniRun; marta?: MartaRun; emilie?: EmilieRun; luca?: LucaRun }
export const freshUni = (): UniRun => ({ chase: false, caught: 0, spiral: false, sunk: false, entered: false, beaten: [], told: [] });
/** One of the friends running after the party (src/chasers.ts); `frozen` once the spiral has opened. */
export interface UniChaser { id: string; friend: UniFriend; patrol: Cell[]; sight: number; walk: number; run: number; relentless: true; frozen: boolean }
/**
 * Nuria's mission while it runs (docs/quests/nuria.md). Nothing here is saved: leaving with the
 * train, falling or the day ending hands the cats back, and only winning sets flags.
 */
/**
 * `haru`: Haru met at the station, leading the way; `led`: she has brought them to Nuria's door;
 * `street`: up La calle que no acaba once; `portal`: the bubble at its end seen; `entered`: in the tower once.
 */
export interface NuriaRun { lent: boolean; warned: boolean; haru: boolean; led: boolean; street: boolean; portal: boolean; entered: boolean; stage: number; beaten: string[] }
export const freshRun = (): NuriaRun => ({ lent: false, warned: false, haru: false, led: false, street: false, portal: false, entered: false, stage: 0, beaten: [] });
/** Where Haru sits by Nuria's door once she has led them there. */
const HARU_HOME: Cell = { x: PLACES_NURIA.nuria.cell.x - 1, z: PLACES_NURIA.nuria.cell.z + 1 };
export type Companion = 'none' | 'follow' | 'stalled';
/** La Reina Bubbaloo's minion in the manhole: lurking (a faint bubble now and then) until its entrance, then gone below. */
export type MinionState = 'lurking' | 'gone';
/** The light over Sant Quirze: an ordinary autumn morning, or La Reina Bubbaloo's pink gloom. */
export type Tone = 'day' | 'bubbaloo';
export type MemberId = 'gerard' | 'bernat' | 'aitor';
export interface PartyMember {
  id: MemberId; name: string; equipment: ItemId[]; note: string;
  /** Whose stats they fight with (stats.ts): Gerard is a boy in chapter 1 and 35 in chapter 2. */
  profile: ProfileId;
  /** The class they wear, from the party's unlocked ones. */
  classId?: ClassId;
}
/** Who wears which class. Not a story flag: it changes back and forth, so `main.ts` keeps it in the browser. */
export interface Loadout {
  /** The ánima each wears now, among their own (`kitOf`). */
  worn?: Partial<Record<MemberId, ClassId>>;
  /** The extra ánimas each has equipped, besides their own fixed one (`EXTRA_SLOTS` at most). */
  extras?: Partial<Record<MemberId, ClassId[]>>;
}
/** How many extra ánimas each can equip besides their own (one for now: more slots may come). */
export const EXTRA_SLOTS = 1;
/** Who walks beside Gerard: Bernat in chapter 1, Aitor from chapter 2 on. */
export type Partner = 'bernat' | 'aitor';

/** Interactions only the story adds; the game merges them with the scene's own. */
const STORY_INTERACTIONS = {
  'talk-mama': { place: PLACES.mama, label: 'Hablar con mamá' },
  'talk-jan': { place: PLACES.jan, label: 'Hablar con Jan' },
  'take-pocion': { place: PLACES.pocion, label: 'Mirar la mesa de Jan' },
  'take-mochila': { place: PLACES.mochila, label: 'Coger la mochila' },
  'take-chicle': { place: PLACES.chicle, label: 'Mirar el bol de chicles' },
  'take-envoltorio': { place: PLACES.envoltorio, label: 'Mirar la mesilla' },
  'take-bola': { place: PLACES_2.bola, label: 'Mirar la bola de nieve' },
  'meridiana-bed': { place: { environment: 'meridiana', cell: { x: 10, z: 13 } }, label: 'Dormir', hint: 'Dormir', anchor: { x: 10.5, z: 14.5, y: .95 } },
} as const;
/** Looking at things inside the palace that answer with Bernat's voice too. */
const PALACE_LOOKS: { id: string; cell: Cell; label: string; dialogue: Dialogue }[] = [
  { id: 'portrait-1', cell: { x: 1, z: 7 }, label: 'Mirar el retrato', dialogue: LINES.portrait1 },
  { id: 'portrait-2', cell: { x: 3, z: 7 }, label: 'Mirar el retrato', dialogue: LINES.portrait2 },
  { id: 'portrait-3', cell: { x: 5, z: 7 }, label: 'Mirar el retrato', dialogue: LINES.portrait3 },
  { id: 'portrait-4', cell: { x: 7, z: 7 }, label: 'Mirar el retrato', dialogue: LINES.portrait4 },
  { id: 'portrait-5', cell: { x: 9, z: 7 }, label: 'Mirar el cuadro pequeño', dialogue: LINES.portrait5 },
  { id: 'look-curtain', cell: { x: 16, z: 7 }, label: 'Tocar la cortina de chicle', dialogue: LINES.curtain },
];
/** The wrapper room's back door into the hall: stuck with gum until the minion falls. */
const BACK_DOOR: Cell = { x: 10, z: 16 };
/** The beach's walkable cells across its width that the friends' tentacles close during the game of tag. */
const TENTACLES: readonly Cell[] = ENVIRONMENTS[BEACH].grid.flatMap((row, z) => z >= PLACES_UNI.tentacles.z && z < PLACES_UNI.tentacles.z + PLACES_UNI.tentacles.depth
  ? [...row].flatMap((c, x) => c === '#' ? [] : [{ x, z }]) : []);
/** The room where the second minion waits. */
export const WRAPPER_ROOM = 'Sala de los Envoltorios';
/** A place the story watches: walking within `radius` of `cell` sends a `near` event. */
/** A place the story watches: within `radius` cells of `cell`, or anywhere on the cells of `area` (a crossing, a street's width). */
/** `passing`: walked through without stopping, since what it sets off holds nobody (a shout). */
export interface Trigger { id: string; cell: Cell; radius: number; area?: { x: number; z: number; w: number; d: number }; passing?: boolean }
/** Whether a position (in cells) is on a trigger. */
export function onTrigger({ cell, radius, area }: Trigger, at: Cell): boolean {
  if (area) return at.x >= area.x - .5 && at.x <= area.x + area.w - .5 && at.z >= area.z - .5 && at.z <= area.z + area.d - .5;
  return Math.hypot(at.x - cell.x, at.z - cell.z) <= radius;
}
/** Where the school door is in Trinitat Vella: the palace lets them out there. */
const SCHOOL_DOOR = ENVIRONMENTS[PLACES_2.school.environment].interactions.find(i => i.id === PLACES_2.school.door)!.cell;
/** Doors out of the house: closed by the story until Gerard is ready for school. */
const HOUSE_EXITS = new Set(['leave-hall', 'leave-living']);
const JAR = PLACES_2.jar;
/** Every ánima, in the order the story unlocks them. */
const CLASS_ORDER = Object.keys(ANIMA_NAMES) as ClassId[];
/** La Pompa from the inside: it will not let them out until the wrapper room is cleared. */
const PALACE_EXIT = 'leave-palace';
/** The hall's east door, which in chapter 2 opens onto the school's yard. */
const SCHOOL_WAY = 'palace-east-door';

export const STORY_CARDS = CARDS;
export const STORY_HINTS = HINTS;

export class Story {
  readonly flags: Set<StoryFlag>;
  /** How many times Gerard tugged at the leash: Bernat's bubble escalates. Not saved. */
  private tugs = 0;
  /** Whether Gerard is heading back south once the palace stands. Not saved. */
  private away = false;
  /** Which of their ánimas each wears now; members missing here wear their default (see `classOf`). */
  private worn: Partial<Record<MemberId, ClassId>> = {};
  /** The extra ánimas each has equipped (`equip`). */
  private extras: Partial<Record<MemberId, ClassId[]>> = {};
  /** Nuria's mission while it runs; not saved. */
  nuria: NuriaRun = freshRun();
  /** The university friends' mission while it runs; not saved. */
  uni: UniRun = freshUni();
  marta: MartaRun = freshMarta();
  /** The castle's rooms cleared today (src/castle-story.ts); not saved, and another day is another floor. */
  castle: CastleRun = freshCastle();
  emilie: EmilieRun = freshEmilie();
  luca: LucaRun = freshLuca();
  /** What the snow globe keeps of the missions (`Kept`). Kept in the browser by `main.ts`, like the loadout. */
  private globe: Kept = {};
  /** Where the party is now, when the game has said (`enter`): Marta answers differently inside Las cuerdas. */
  inside?: EnvironmentId;
  /** Whether Nuria has lent the cats before (she says it differently the second time). Not saved. */
  private lentBefore = false;
  /**
   * Development (the picker's Ánimas column, docs/dev-tools.md): the ánimas unlocked and each one's
   * level, instead of what the story gives. Not saved, and no ánima grows while it is set.
   */
  debugAnimas?: Partial<Record<ClassId, number>>;
  /** EXP each ánima has earned (src/levels.ts). Kept in the browser by `main.ts`, like the loadout. */
  xp: Partial<Record<ClassId, number>> = {};
  /** What the Ecos de luz are in, in the order they went in (src/ecos.ts). Kept in the browser by `main.ts`, like the loadout. */
  private bought: string[] = [];
  /** Development (the picker): ecos on top of the ones won. Not saved. */
  debugEcos = 0;
  /** The dual attacks seen go off (src/battle.ts DUALS), in the order they were found. Kept in the browser by `main.ts`, like the EXP. */
  private found: DualId[] = [];
  /**
   * The days in Barcelona (src/days.ts): what day and hour it is, and the last mornings to come
   * back to. Saved next to the flags.
   */
  days: Days = freshDays();
  constructor(flags: Iterable<string> = []) {
    this.flags = knownFlags(flags);
  }
  has(flag: StoryFlag) { return this.flags.has(flag); }
  /** Adds saved flags, e.g. from the server; returns whether anything new arrived. */
  merge(flags: Iterable<string>) {
    const before = this.flags.size;
    for (const flag of new Story(flags).flags) this.flags.add(flag);
    return this.flags.size !== before;
  }
  /** Saved flags in a stable order. */
  get saved(): StoryFlag[] { return STORY_FLAGS.filter(f => this.flags.has(f)); }
  get started() { return this.has('intro'); }
  get canRun() { return this.has('got-shoes') || this.adult; }
  get battles() { return this.has('dejavu'); }
  /** The street dogs have the minion's dark pink eyes. */
  get possessed() { return this.has('minion'); }
  get minion(): MinionState { return this.has('minion') ? 'gone' : 'lurking'; }
  get tone(): Tone { return this.has('first-fight') ? 'bubbaloo' : 'day'; }
  /** La Reina Bubbaloo's palace stands at the north end of the street. */
  get palace() { return this.has('palace'); }
  /** Chapter 2: Gerard is 35 and wakes up in Barcelona; chapter 1 was his dream. */
  get adult() { return this.has('caught'); }
  /** Ánimas the party has gathered from friends (chapter 2). */
  get animas(): AnimaId[] { return ANIMA_IDS.filter(id => this.flags.has(`anima-${id}` as StoryFlag)); }
  get clock() { return { ...this.days.clock }; }
  /** How far La Reina Bubbaloo's power has spread this morning: 0 at first, 1 is the end. */
  get spread() { return this.adult && !this.has('reina') ? spread(this.days.clock.day, this.animas.length) : 0; }
  /** The lights in the jar at home, in the order they were won. No names on screen. */
  get jar(): LightId[] { return LIGHTS.filter(id => this.has(`luz-${id}`)); }
  /** The party's Ecos de luz: every light won (docs/animas/README.md § Ecos de luz). */
  get ecos() { return this.jar.length + this.debugEcos; }
  /** What stands of what the ecos are in: a rewound day can take a light back. */
  get improvements() { return withinEcos(this.bought, this.ecos); }
  /** A saved list; `improvements` drops whatever does not stand. */
  set improvements(list: readonly string[]) { this.bought = Array.isArray(list) ? list.filter(id => typeof id === 'string') : []; }
  /** The dual attacks found so far, in the order they were found. */
  get duals(): DualId[] { return [...this.found]; }
  /** A saved list: whatever is not a dual (any more) is dropped. */
  set duals(list: readonly string[]) { this.found = Array.isArray(list) ? list.filter((id, i): id is DualId => DUALS.some(d => d.id === id) && list.indexOf(id) === i) : []; }
  /** A dual went off: it is found from now on. Returns whether it is new. */
  discover(id: DualId) {
    if (this.found.includes(id) || !DUALS.some(d => d.id === id)) return false;
    this.found.push(id);
    return true;
  }
  /** The dual attacks found that `id` brings a half of (the ánimas screen lists them), in the order they were found. */
  dualsWith(id: ClassId): DualSpec[] {
    return this.found.map(found => DUALS.find(d => d.id === found)!).filter(d => d.parts.some(part => SKILLS.find(s => s.id === part)?.class === id));
  }
  /** Ecos still to put anywhere. */
  get ecosFree() { return this.ecos - costOf(this.improvements); }
  /** What the ecos add up to in a fight. */
  get improved(): Improved { return improvedBy(this.improvements); }
  /** How much maná an ánima holds with what the ecos added. */
  manaOf(id?: ClassId) { return manaMax(this.improved, id); }
  /** Puts ecos into `id`: only one awake, with what it needs first, and ecos enough. Returns whether it took. */
  improve(id: string) {
    const item = improvementOf(id), now = this.improvements;
    if (!item || now.includes(id) || withinEcos([...now, id], this.ecos).length !== now.length + 1) return false;
    this.bought = [...now, id];
    return true;
  }
  /** Takes the ecos back from `id` and whatever needs it. Returns whether any came back. */
  unimprove(id: string) {
    const now = this.improvements;
    if (!now.includes(id)) return false;
    this.bought = without(now, id);
    return true;
  }
  /** Every eco back in the jar. */
  clearImprovements() { this.bought = []; }
  /** The flat has become part of her castle: the game is over until they go back a day. */
  get doomed() { return this.spread >= 1; }
  /** How far into the evening it is (0 by day, 1 at night): the light turns pinker. */
  get dusk() { return this.adult ? dusk(this.days.clock.hour) : 0; }
  /** Night outside (docs/chapter-2.md § Night and the way home): the palace's monsters are out on the Meridiana. */
  get night() { return this.adult && isNight(this.days.clock.hour); }
  /** Days loaded from the server: a newer epoch (a rewind elsewhere) replaces the flags too. */
  loadDays(value: unknown, story?: Iterable<string>) {
    const days = readDays(value);
    if (!days || days.epoch < this.days.epoch) return;
    // A morning saved by an older version may hold flags since renamed; the server only takes known ones.
    days.mornings = days.mornings.map(m => ({ ...m, story: STORY_FLAGS.filter(f => knownFlags(m.story).has(f)) }));
    if (days.epoch > this.days.epoch && story) { this.flags.clear(); this.merge(story); }
    const later = days.clock.day * 24 + days.clock.hour >= this.days.clock.day * 24 + this.days.clock.hour;
    if (days.epoch > this.days.epoch || later) this.days = days;
  }
  /** How threatening the castle on the school is (1 at first; ánimas bring it down). */
  get castleThreat() { return castleThreat(this.animas.length); }
  /**
   * Ánimas (classes in the code) the party has unlocked; anyone in the party but Bernat can wear
   * any of them. Matemágico wakes up in Gerard in the palace; Papagato comes from Nuria.
   */
  /** Each unlocked ánima's level (1 until it grows). */
  get levels(): Partial<Record<ClassId, number>> {
    const debug = this.debugAnimas;
    return debug ? Object.fromEntries(this.classes.map(id => [id, debug[id]])) : this.storyLevels;
  }
  /** The levels the story has reached, whatever the picker says. */
  get storyLevels(): Partial<Record<ClassId, number>> {
    return Object.fromEntries(this.storyClasses.map(id => [id, levelOf(id, flag => this.flags.has(flag as StoryFlag))]));
  }
  /**
   * A fight was won: each ánima in `worn` earns `xp` EXP (src/levels.ts `award`), and one that
   * reaches a new level sets its flag and says what it learned. `quiet`: the fight already showed it.
   */
  private grow(worn: ClassId[] = [], xp = 0, quiet = false): StoryEffect[] {
    // Levels the picker chose stay as they are.
    if (this.debugAnimas) return [];
    const effects: StoryEffect[] = [];
    for (const growth of award(worn.filter(id => this.storyClasses.includes(id)), xp, this.xp, this.storyLevels)) {
      this.xp[growth.id] = growth.xpAfter;
      for (let level = growth.levelBefore + 1; level <= growth.levelAfter; level++) {
        this.set(levelFlag(growth.id, level as 2 | 3) as StoryFlag);
        effects.push({ kind: 'learn', classId: growth.id, level, skills: SKILLS.filter(skill => skill.class === growth.id && 'level' in skill && skill.level === level).map(skill => skill.id), ...quiet ? { quiet } : {} });
      }
    }
    return effects;
  }
  /**
   * Development (the picker's Ánimas column): `id` earns `xp` EXP as if from a fight, levels and
   * notes included. Leaves the picker's own levels, so what it shows is the story's.
   */
  giveXp(id: ClassId, xp: number): StoryEffect[] {
    this.debugAnimas = undefined;
    return this.grow([id], xp);
  }
  /** Walking up to one of Nuria's mission's places: Haru at the station, Uri ahead, the summit, or a fear reaching Gerard. */
  private nearNuria(id: string): StoryEffect[] {
    const say = (dialogue: Dialogue): StoryEffect => ({ kind: 'dialogue', dialogue });
    if (!this.adult || this.has('nuria-uri')) return [];
    if (id === 'haru' && !this.nuria.haru) { this.nuria.haru = true; return [say(LINES_NURIA.haru)]; }
    // Haru has walked them to Nuria's door (src/guide.ts) and sits down beside her.
    if (id === 'haru-home' && this.nuria.haru && !this.nuria.led) { this.nuria.led = true; return []; }
    // Up the street, the corner where Uri ran has unrolled into more street (src/street-shift.ts).
    if (id === 'calle' && this.nuria.lent) return this.enterCalle();
    // The bubble at the end of the street comes into sight.
    if (id === 'portal' && this.nuria.lent && !this.nuria.portal) { this.nuria.portal = true; return [say(LINES_NURIA.portal)]; }
    if (id === 'portal-through' && this.nuria.lent) return [{ kind: 'portal', who: 'party' }, ...this.enterMaze()];
    const reached = /^uri-(\d)$/.exec(id);
    // Up out of a ring: Uri shouts it from the top, and the climb goes on.
    if (reached && Number(reached[1]) === this.nuria.stage) { this.nuria.stage++; return [{ kind: 'shout', speaker: 'uri', text: LINES_NURIA.shouts[Number(reached[1])] }]; }
    // Onto the platform: Uri shouts for his boss, and the fight comes in as soon as it has been seen.
    if (id === 'summit' && this.nuria.lent && this.nuria.stage >= PLACES_NURIA.uri.length) return [{ kind: 'shout', speaker: 'uri', text: LINES_NURIA.roof, beat: 1.5 }, { kind: 'battle', encounter: 'uri-vertigo' }];
    const fear = FEARS.find(f => f.id === id);
    if (fear && this.nuria.lent && !this.nuria.beaten.includes(fear.id)) return [...fear.tell ? [say(fear.tell)] : [], { kind: 'battle', encounter: fear.encounter }];
    return [];
  }
  /**
   * The university friends on the beach (docs/quests/universidad.md § Beats): walking up behind them
   * starts the talk and the game of tag; one of them reaching Gerard (or Aitor) is caught, back up
   * the sand; near Anna the spiral takes her, and through it is the campsite.
   */
  private nearUni(id: string): StoryEffect[] {
    const say = (dialogue: Dialogue): StoryEffect => ({ kind: 'dialogue', dialogue });
    if (!this.adult || this.has('sobremesa')) return [];
    const run = this.uni;
    if (id === 'uni-talk' && !run.chase && !run.spiral) {
      const first = this.set('barceloneta-uni');
      run.chase = true;
      // The first time the camera takes in the huddle, Anna and the spiral while they talk.
      const { intro } = PLACES_UNI;
      return first ? [{ kind: 'look', cell: { x: intro.x, z: intro.z }, height: intro.height }, say(LINES_UNI.beach), { kind: 'look' }] : [say(LINES_UNI.again)];
    }
    if (id === 'uni-spiral' && run.chase) { run.chase = false; run.spiral = true; return [say(LINES_UNI.spiral), { kind: 'portal', who: 'anna' }, say(LINES_UNI.gone)]; }
    if (id === 'uni-through' && run.spiral && run.sunk) return [{ kind: 'portal', who: 'party' }, ...this.enterCamping()];
    const friend = UNI_FRIENDS.find(f => id === `uni-${f}`);
    if (friend && run.chase) {
      run.chase = false; run.caught++;
      const back: StoryEffect = { kind: 'travel', environment: BEACH, cell: { ...PLACES_UNI.retry } };
      return [say(LINES_UNI.caught), { kind: 'fall' }, back, { kind: 'recover' }];
    }
    return [];
  }
  /** Through the spiral, into the campsite: the first time they say what they see, and looking for them takes its hour. */
  private enterCamping(): StoryEffect[] {
    const inside: StoryEffect = { kind: 'travel', environment: CAMP, cell: { ...PLACES_CAMP.entrada } };
    const first = !this.uni.entered;
    this.uni.entered = true; this.uni.spiral = false;
    this.set('camping');
    return first ? [inside, { kind: 'dialogue', dialogue: LINES_UNI.camp }, ...this.spend('cafe')] : [inside];
  }
  /**
   * In the campsite (docs/quests/universidad.md § Càmping Eurosport): its foes stand up as the party
   * comes near, the pool's gate says why it is shut, El Campeón comes down off its plinth, and at the
   * long table La Sobremesa is waiting.
   */
  private nearCamp(id: string): StoryEffect[] {
    const say = (dialogue: Dialogue): StoryEffect => ({ kind: 'dialogue', dialogue });
    if (!this.adult || this.has('sobremesa')) return [];
    const run = this.uni;
    // One on its round has reached them: its fight, remembered as theirs so winning it keeps it beaten.
    const hunter = CAMP_HUNTERS.find(h => id === `camp-${h.id}`);
    if (hunter && !run.beaten.includes(hunter.id)) { run.fighting = hunter.id; return [{ kind: 'battle', encounter: hunter.encounter }]; }
    if (id === 'camp-gate' && !this.has('candado') && !run.told.includes('gate')) { run.told.push('gate'); return [say(LINES_UNI.gate), { kind: 'candado' }]; }
    if (id === 'camp-campeon' && this.has('candado') && !run.beaten.includes('campeon')) return [say(LINES_UNI.campeon), { kind: 'battle', encounter: 'campeon' }];
    if (id === 'camp-door' && !this.has('parcelas') && !run.told.includes('door')) { run.told.push('door'); return [say(LINES_UNI.door)]; }
    if (id === 'camp-mesa' && this.has('parcelas')) return [say(LINES_UNI.sobremesa), { kind: 'battle', encounter: 'sobremesa' }];
    return [];
  }
  /** The pool gate's padlock: its wheels, until the right numbers open it. */
  private padlock(): StoryEffect[] {
    if (!this.adult || this.has('sobremesa') || this.has('candado')) return [];
    const first = !this.uni.told.includes('gate');
    if (first) this.uni.told.push('gate');
    return [...first ? [{ kind: 'dialogue', dialogue: LINES_UNI.gate } as StoryEffect] : [], { kind: 'candado' }];
  }
  /** Numbers tried on the padlock: the letters of the maze's three words open the pool gate; anything else and it holds. */
  private tryLock(numbers: number[]): StoryEffect[] {
    if (!this.adult || this.has('candado') || !lockOpens(numbers)) return [];
    this.set('candado');
    return [{ kind: 'dialogue', dialogue: LINES_UNI.unlocked }];
  }
  /** The blackboard by the pool: Las parcelas' board, once El Campeón, standing before it, is beaten. */
  private blackboard(): StoryEffect[] {
    const say = (dialogue: Dialogue): StoryEffect => ({ kind: 'dialogue', dialogue });
    if (!this.adult || this.has('sobremesa')) return [say(LINES_UNI.boardIdle)];
    if (this.has('parcelas')) return [say(LINES_UNI.boardDone)];
    if (!this.uni.beaten.includes('campeon')) return [say(LINES_UNI.campeon), { kind: 'battle', encounter: 'campeon' }];
    const first = !this.uni.told.includes('board');
    if (first) this.uni.told.push('board');
    return [...first ? [say(LINES_UNI.board)] : [], { kind: 'parcelas', ...this.uni.board ? { board: this.uni.board } : {} }];
  }
  /** A pitch chosen: a wrong one wakes its tent (a fight), the black one puts out every bulb (a hard fight); all lit opens the merendero's steel door. */
  private choosePitch(event: Extract<StoryEvent, { type: 'parcelas' }>): StoryEffect[] {
    if (!this.adult || this.has('parcelas')) return [];
    this.uni.board = event.board;
    if (event.solved) { this.set('parcelas'); return [{ kind: 'dialogue', dialogue: LINES_UNI.doorOpen }]; }
    if (event.outcome === 'tent') return [{ kind: 'battle', encounter: 'camping-tienda' }];
    if (event.outcome === 'black') return [{ kind: 'battle', encounter: 'camping-negra' }];
    return [];
  }
  /**
   * La Sobremesa beaten: it comes apart at the long table and the seven are left round it, free; the
   * photo with the melon; their five lights go with Gerard and Aitor (one a couple, one each alone),
   * a beat apart; a spiral opens behind the table and takes them all; and out of it on the November
   * beach, the seven round the two of them.
   */
  private winUni(): StoryEffect[] {
    const say = (dialogue: Dialogue): StoryEffect => ({ kind: 'dialogue', dialogue });
    if (!this.set('sobremesa')) return [];
    for (const flag of ['anima-universidad', 'luz-anna-alvaro', 'luz-miquel-sarah', 'luz-soraya', 'luz-nico', 'luz-joan'] as const) this.set(flag);
    const beach: StoryEffect = { kind: 'travel', environment: BEACH, cell: { ...PLACES_UNI.home } };
    return [
      { kind: 'unmask' }, say(LINES_UNI.won), { kind: 'look', anchor: 'merendero-mesa', height: 8.5 }, { kind: 'photo', caption: LINES_UNI.photo },
      { kind: 'lights', people: ['anna', 'sarah', 'soraya', 'nico', 'joan'] },
      { kind: 'portal', who: 'everyone', open: { ...PLACES_CAMP.vuelta } },
      beach, { kind: 'emerge', cell: { ...PLACES_UNI.out } }, say(LINES_UNI.home), ...this.spend('fight'),
    ];
  }
  /**
   * In Las cuerdas (docs/quests/marta.md): before each maze Aitor says what its floor does, once; on
   * each platform the quality standing there is the fight; at the centre, with the three beaten, La Voz.
   */
  private nearMarta(id: string): StoryEffect[] {
    const say = (dialogue: Dialogue): StoryEffect => ({ kind: 'dialogue', dialogue });
    if (!this.adult || this.has('voz')) return [];
    const run = this.marta;
    const maze = PLACES_CUERDAS.mazes.findIndex((_, i) => id === `cuerdas-laberinto-${i}`);
    if (maze >= 0 && !run.told.includes(id)) { run.told.push(id); return [say(LINES_MARTA.mazes[maze])]; }
    const quality = QUALITIES.find(q => id === `cuerdas-${q.id}`);
    if (quality && !run.beaten.includes(quality.id)) return [say(LINES_MARTA[quality.id]), { kind: 'battle', encounter: quality.encounter }];
    if (id === 'cuerdas-voz' && QUALITIES.every(q => run.beaten.includes(q.id))) return [say(LINES_MARTA.voz), { kind: 'battle', encounter: 'voz' }];
    return [];
  }
  /** The piano in Alegia: once she has been spoken to, Aitor plays, her note stays in the air and takes the three of them in. */
  private playPiano(): StoryEffect[] {
    const say = (dialogue: Dialogue): StoryEffect => ({ kind: 'dialogue', dialogue });
    if (!this.adult) return [];
    if (this.has('voz')) return [say(LINES_MARTA.after)];
    if (!this.has('alegia-marta')) return [say(LINES_MARTA.pianoBefore)];
    const first = this.set('cuerdas');
    const inside: StoryEffect = { kind: 'travel', environment: CUERDAS_PLACE, cell: { ...PLACES_CUERDAS.spawn } };
    return [
      // The first time, her recording of the song comes out as Aitor plays, and goes on under what they say.
      ...first ? [{ kind: 'song', track: 'izana' } as const, say(LINES_MARTA.piano)] : [],
      { kind: 'portal', who: 'everyone', open: { ...PLACES_MARTA.bubble } }, inside,
      say(first ? LINES_MARTA.inside : LINES_MARTA.insideAgain), ...first ? this.spend('cafe') : [],
    ];
  }
  /**
   * La Voz beaten: all Marta lost comes back to her at once, and she is herself; back in Alegia at
   * the piano the song sounds as it should, her light goes with them, and the day is spent.
   */
  private winMarta(): StoryEffect[] {
    const say = (dialogue: Dialogue): StoryEffect => ({ kind: 'dialogue', dialogue });
    if (!this.set('voz')) return [];
    for (const flag of ['anima-marta', 'luz-marta'] as const) this.set(flag);
    this.marta = freshMarta(); delete this.globe.marta;
    const home: StoryEffect = { kind: 'travel', environment: ALEGIA, cell: { ...PLACES_MARTA.back } };
    return [say(LINES_MARTA.won), home, say(LINES_MARTA.home), { kind: 'lights', people: ['marta'] }, ...this.spend('fight'), ...this.nightfall()];
  }
  /**
   * El que no converge beaten: the why comes back to Emilie all at once; they come back out through her
   * laptop to the flat, she says why it flooded, her light goes with them, and the day is spent.
   */
  private winEmilie(): StoryEffect[] {
    const say = (dialogue: Dialogue): StoryEffect => ({ kind: 'dialogue', dialogue });
    if (!this.set('converge')) return [];
    for (const flag of ['anima-emilie', 'luz-emilie'] as const) this.set(flag);
    this.emilie = freshEmilie(); delete this.globe.emilie;
    const home: StoryEffect = { kind: 'travel', environment: PISO, cell: { ...PLACES_PISO.laptop } };
    return [say(LINES_EMILIE.won), home, say(LINES_EMILIE.home), { kind: 'lights', people: ['emilie'] }, ...this.spend('fight'), ...this.nightfall()];
  }
  /**
   * The laptop on her desk: once she has been spoken to, the Queen's whirlpool swells out of the screen
   * and takes Gerard and Aitor into her model (Emilie stays, and watches them on it). It stays in the
   * screen: going back in is through it.
   */
  private useLaptop(): StoryEffect[] {
    const say = (dialogue: Dialogue): StoryEffect => ({ kind: 'dialogue', dialogue });
    if (!this.adult) return [];
    if (this.has('converge')) return [say(LINES_EMILIE.laptopAfter)];
    if (!this.has('poble-sec-emilie')) return [say(LINES_EMILIE.laptopBefore)];
    const first = this.set('modelo');
    const inside: StoryEffect = { kind: 'travel', environment: MODELO_PLACE, cell: { ...PLACES_MODELO.spawn } };
    return [say(first ? LINES_EMILIE.laptop : LINES_EMILIE.laptopAgain), { kind: 'portal', who: 'party', open: { ...PLACES_PISO.portal }, queen: true }, inside, say(first ? LINES_EMILIE.inside : LINES_EMILIE.insideAgain), ...first ? this.spend('cafe') : []];
  }
  /**
   * In her model (src/modelo.ts): a patrol that reaches them is its fight; the first time they reach a zone
   * below, Emilie says a little more of the why from outside; at the bottom, once, she sees El que no converge.
   */
  private nearModelo(id: string): StoryEffect[] {
    const say = (dialogue: Dialogue): StoryEffect => ({ kind: 'dialogue', dialogue });
    if (!this.adult) return [];
    const run = this.emilie, tellOnce = (key: string, dialogue: Dialogue): StoryEffect[] => {
      if (this.has('converge') || run.told.includes(key)) return [];
      run.told.push(key); return [say(dialogue)];
    };
    const zone = id.startsWith('modelo-zona-') ? id.slice('modelo-zona-'.length) as Exclude<ZoneId, 'suelo'> : undefined;
    if (zone) return LINES_EMILIE.zones[zone] ? tellOnce(id, LINES_EMILIE.zones[zone]) : [];
    const patrol = PATROLS.find(p => `modelo-${p.id}` === id);
    if (patrol) return [{ kind: 'battle', encounter: patrol.encounter }];
    return [...tellOnce('modelo-jefe', LINES_EMILIE.jefe), { kind: 'battle', encounter: 'no-converge' }];
  }
  /** Emilie: in her flat, standing in the water. */
  private emilieNpcs(): StoryNpc[] {
    return [{ id: 'emilie', character: 'emilie', environment: PISO, cell: { ...PLACES_PISO.emilie }, scale: EMILIE_SCALE, facing: 250 }];
  }
  /** Marta: by the piano in Alegia, and inside Las cuerdas a step behind the party, further in as each quality is beaten. */
  private martaNpcs(): StoryNpc[] {
    const at = PLACES_CUERDAS.marta[Math.min(this.marta.beaten.length, PLACES_CUERDAS.marta.length - 1)];
    return [
      { id: 'marta', character: 'marta', environment: ALEGIA, cell: { ...PLACES_MARTA.marta }, scale: MARTA_SCALE, facing: 200 },
      ...this.has('voz') ? [] : [{ id: 'marta' as const, character: 'marta', environment: CUERDAS_PLACE, cell: { ...at }, scale: MARTA_SCALE, facing: 180 }],
    ];
  }
  /** What stands waiting in Las cuerdas, for the game to put there (src/cuerdas-foes.ts models): each quality not yet beaten on its platform, and La Voz at the centre. */
  cuerdasFoes(environment: EnvironmentId): { id: string; encounter: CuerdasEncounter; cell: Cell; beaten: boolean }[] {
    if (environment !== CUERDAS_PLACE) return [];
    const done = this.has('voz');
    return [
      ...QUALITIES.map(q => ({ id: q.id, encounter: q.encounter, cell: { ...q.cell }, beaten: done || this.marta.beaten.includes(q.id) })),
      { id: 'voz', encounter: 'voz' as const, cell: { x: PLACES_CUERDAS.voz.x, z: PLACES_CUERDAS.voz.z }, beaten: done },
    ];
  }
  /** Gerard's morning (and the first way down into the metro), with Aitor's word about the friends on the beach until they have been there. */
  private withClue(morning: Dialogue): Dialogue {
    if (!this.has('metro') || this.has('barceloneta-uni')) return morning;
    this.set('clue-uni');
    return { ...morning, lines: [...morning.lines, ...LINES_UNI.clue] };
  }
  /**
   * Her street has turned into La calle que no acaba before them (src/street-shift.ts walks them on
   * into it, with no cut): the first time, they say so.
   */
  private enterCalle(): StoryEffect[] {
    if (this.nuria.street) return [];
    this.nuria.street = true;
    return [{ kind: 'dialogue', dialogue: LINES_NURIA.calle }];
  }
  /** Through the bubble, into the tower. */
  private enterMaze(): StoryEffect[] {
    const inside: StoryEffect = { kind: 'travel', environment: MAZE, cell: { ...PLACES_NURIA.mazeIn.cell } };
    if (this.nuria.entered) return [inside];
    // Looking for Uri takes its hour; the rest of the mission is paid when it is won.
    this.nuria.entered = true;
    return [inside, { kind: 'shout', speaker: 'uri', text: LINES_NURIA.mazeIn }, ...this.spend('cafe')];
  }
  /**
   * Uri is himself again: the cats and Papagato stay, two lights go with Gerard and Aitor (Nuria's
   * and Uri's, Nil in his arms), and Papagato's banner says it is theirs for good.
   */
  private winNuria(): StoryEffect[] {
    const say = (dialogue: Dialogue): StoryEffect => ({ kind: 'dialogue', dialogue });
    if (!this.set('nuria-uri')) return [];
    for (const flag of ['papagato', 'anima-nuria', 'luz-nuria', 'luz-uri'] as const) this.set(flag);
    this.nuria = freshRun(); delete this.globe.nuria;
    const door: StoryEffect = { kind: 'travel', environment: STREET, cell: { x: PLACES_NURIA.nuria.cell.x - 1, z: PLACES_NURIA.nuria.cell.z + 2 } };
    return [say(LINES_NURIA.won), door, say(LINES_NURIA.home), { kind: 'lights', people: ['nuria', 'uri'] }, { kind: 'anima', classId: 'papagato', kept: true }, ...this.spend('fight'), ...this.nightfall()];
  }
  /** What src/castle-story.ts reads and does of the story: its flags, its days, and how it spends them. */
  private get castleHost(): CastleHost {
    const story = this;
    return {
      has: flag => story.flags.has(flag as StoryFlag), raise: flag => story.set(flag as StoryFlag),
      adult: story.adult, seed: story.days.epoch, day: story.days.clock.day,
      get castle() { return story.castle; }, set castle(run: CastleRun) { story.castle = run; },
      hour: () => story.spend('castle'), nightfall: () => story.nightfall(), fall: () => story.endDay('fall'), morning: () => story.newMorning(),
    };
  }
  /** How many extra ánimas each can equip besides their own: one, and one more once Aurelià has fallen (docs/castle.md § What each boss opens). */
  get extraSlots() { return extraSlots(this.flags); }
  /**
   * A place as it is today: a castle floor is generated from the save and the day (src/castle-floor.ts),
   * any other place is its own. The game builds what this says, and a simulator walks its grid and its doors.
   */
  place(environment: EnvironmentId): Environment {
    return isCastlePlace(environment) ? castleEnvironmentFor(environment, this.days.epoch, this.days.clock.day) : ENVIRONMENTS[environment];
  }
  /** The next morning at home with nothing said yet (the Monday after the end). */
  private newMorning(): StoryEffect[] {
    this.recall();
    this.days.clock = { day: this.days.clock.day + 1, hour: DAY_START };
    this.remember();
    return [{ kind: 'fall' }, { kind: 'travel', environment: PLACES.wakeUp.environment, cell: { ...PLACES.wakeUp.cell } }, { kind: 'wake' }, { kind: 'rise' }];
  }
  /**
   * Luca's mission (docs/quests/luca.md) runs while he has been met and Fran is not beaten; the salon
   * is dressed inside the basilica only then.
   */
  get salon() { return this.adult && this.has('sagrada-luca') && !this.has('fran'); }
  /** By the pond, Luca; inside, while the salon stands, the chaplain who keeps the presbytery and Fran under the canopy. */
  private lucaNpcs(): StoryNpc[] {
    const won = this.has('fran'), lost = won ? 0 : 1 - this.luca.beaten.length / (ZONES.length + 1);
    const list: StoryNpc[] = [{ id: 'luca', character: 'luca', environment: SAGRADA, cell: { ...PLACES_LUCA.luca }, scale: LUCA_SCALE, facing: 180, faded: lost, reflection: { ...PLACES_LUCA.water } }];
    if (this.salon) list.push(
      { id: 'capellan', character: 'capellan', environment: INTERIOR, cell: { ...PLACES_LUCA.capellan }, scale: LUCA_SCALE, facing: 270, possessed: true },
      { id: 'fran', character: 'fran', environment: INTERIOR, cell: { ...PLACES_LUCA.fran }, scale: LUCA_SCALE * 1.08, facing: 90, possessed: true, lift: .4 },
    );
    return list;
  }
  /** What stands waiting in each zone of the salon, for the game to put there (src/luca-foes.ts models). */
  lucaFoes(environment: EnvironmentId): { id: string; encounter: string; kind: string; cell: Cell }[] {
    if (environment !== INTERIOR || !this.salon) return [];
    const first = { 'luca-recepcion': 'polilla', 'luca-sillones': 'capellan', 'luca-carta': 'estampado-rojo', 'luca-abside': 'telescopio' } as const;
    return ZONES.filter(z => !this.luca.beaten.includes(z.id)).map(z => ({ id: z.id, encounter: z.encounter, kind: first[z.encounter], cell: { ...z.cell } }));
  }
  /** The next zone of the salon on the way round the crossing, if any is left. */
  get lucaNext() { return ZONES.find(z => !this.luca.beaten.includes(z.id)); }
  /** Where the window's light goes in the nave, with its mirrors as they stand now (src/espejos.ts). */
  get beam() { return trace(ENVIRONMENTS[INTERIOR].grid, MIRRORS, this.luca.mirrors as Facing[], BEAM); }
  /** Whether a fight starts with its foes dazzled: the chaplains, once the light reaches their chairs. */
  dazzled(encounter?: string) { return encounter === 'luca-sillones' && this.salon && this.beam.hit; }
  /** Aitor puts the two clues together, once: the photo gone grey, and the Sagrada Família on the TV or on the poster. */
  private lucaLink(by: 'tv' | 'poster'): Dialogue[] {
    if (!this.has('clue-luca-foto') || this.has('sagrada-luca')) return [];
    const other = by === 'tv' ? this.has('clue-sagrada-cartel') : this.has('clue-sagrada');
    return other ? [] : [by === 'tv' ? LINES_LUCA.linkTv : LINES_LUCA.linkPoster];
  }
  /** In the salon: in through the door, then each zone's foes as they are walked up to. */
  private nearLuca(id: string): StoryEffect[] {
    const say = (dialogue: Dialogue): StoryEffect => ({ kind: 'dialogue', dialogue });
    if (!this.salon) return [];
    const run = this.luca;
    if (id === 'luca-dentro') {
      if (run.told.includes('dentro')) return [];
      run.told.push('dentro');
      // Going in takes its hour; the rest is paid when Fran is beaten.
      const first = !run.entered;
      run.entered = true; this.set('peluqueria');
      // The first time the camera turns down the transept to the crossing: the church here, the salon beyond.
      if (!first) return [say(LINES_LUCA.insideAgain)];
      return [{ kind: 'look', cell: { ...SALON_VIEW.cell }, height: SALON_VIEW.height }, say(LINES_LUCA.inside), { kind: 'look' }, ...this.spend('cafe')];
    }
    if (id === 'luca-espejos') {
      if (run.told.includes('espejos')) return [];
      run.told.push('espejos');
      // The camera follows the window's light from mirror to mirror, to where it ends.
      const beam = this.beam, turn = beam.turns.at(-1) ?? beam.end;
      return [{ kind: 'look', cell: { x: Math.round((turn.x + beam.end.x) / 2), z: Math.round((turn.z + beam.end.z) / 2) + 2 }, height: 9 }, say(LINES_LUCA.mirrors), { kind: 'look' }];
    }
    const zone = ZONES.find(z => id === `luca-${z.id}`);
    // Only the next one on the way: the queues keep the rest.
    if (!zone || run.beaten.includes(zone.id) || zone !== this.lucaNext) return [];
    const told = run.told.includes(zone.id);
    if (!told) run.told.push(zone.id);
    return [...told ? [] : [say(LINES_LUCA.zones[zone.id])], { kind: 'battle', encounter: zone.encounter }];
  }
  /** Fran beaten: his eyes clear, he walks out; outside, Luca in full colour, and his light goes with them. */
  private winLuca(): StoryEffect[] {
    const say = (dialogue: Dialogue): StoryEffect => ({ kind: 'dialogue', dialogue });
    if (!this.set('fran')) return [];
    for (const flag of ['anima-luca', 'luz-luca', 'peluqueria'] as const) this.set(flag);
    this.luca = freshLuca(); delete this.globe.luca;
    const out: StoryEffect = { kind: 'travel', environment: SAGRADA, cell: { ...PLACES_LUCA.won } };
    return [say(LINES_LUCA.won), out, say(LINES_LUCA.home), { kind: 'lights', people: ['luca'] }, ...this.spend('fight'), ...this.nightfall()];
  }
  /** What a fight's end means for the story, before any ánima grows. */
  private afterBattle(event: Extract<StoryEvent, { type: 'battle' }>): StoryEffect[] {
    const say = (dialogue: Dialogue): StoryEffect => ({ kind: 'dialogue', dialogue });
    // The castle's fights: a room cleared, a boss beaten, the Queen (src/castle-story.ts). A fall there is a fall like any other.
    const castle = castleBattle(this.castleHost, event);
    if (castle) return castle;
    if (event.won && event.encounter === 'uri-vertigo') return this.winNuria();
    if (event.won && event.encounter === 'sobremesa') return this.winUni();
    if (event.won && event.encounter === 'voz') return this.winMarta();
    if (event.won && event.encounter === 'no-converge' && this.inside === MODELO_PLACE) return this.winEmilie();
    if (event.won && event.encounter === 'fran') return this.winLuca();
    // A zone of Fran's salon won: it stays won this visit, and a colour goes out of the door to Luca.
    const zone = ZONES.find(z => z.encounter === event.encounter);
    if (event.won && zone) {
      if (!this.salon || this.luca.beaten.includes(zone.id)) return [];
      this.luca.beaten.push(zone.id);
      const line = say(LINES_LUCA.zoneWon[Math.min(this.luca.beaten.length, LINES_LUCA.zoneWon.length) - 1]);
      // The camera turns to the queue that has moved on, so the way it opens is seen; after the last zone, to the chaplain.
      const freed = QUEUES.find(q => q.after === zone.id);
      return [{ kind: 'look', cell: { ...freed?.look ?? PLACES_LUCA.capellan }, height: freed ? 11 : 9 }, line, { kind: 'look' }];
    }
    // One of what Marta lost, beaten: it stays beaten this visit, and she says she feels nothing yet.
    const quality = QUALITIES.find(q => q.encounter === event.encounter);
    if (event.won && quality) {
      if (this.has('voz') || this.marta.beaten.includes(quality.id)) return [];
      this.marta.beaten.push(quality.id);
      return [say(LINES_MARTA.beside[this.marta.beaten.length])];
    }
    // The campsite's fights: one waiting at a table stays beaten this visit; a woken tent or the black pitch is only a fight.
    const waiting = event.encounter === 'campeon' ? 'campeon' : CAMP_HUNTERS.some(h => h.encounter === event.encounter) ? this.uni.fighting : undefined;
    this.uni.fighting = undefined;
    if (event.won && waiting) {
      if (!this.uni.beaten.includes(waiting)) this.uni.beaten.push(waiting);
      // Its word was shouted in the fight, as each of them fell (battle-ui `lastWords`).
      return [];
    }
    if (event.won && (event.encounter === 'camping-tienda' || event.encounter === 'camping-negra')) return [];
    const fear = FEARS.find(f => f.encounter === event.encounter);
    // A fear beaten stays beaten; its young only go for a while (the game brings them back).
    if (event.won && fear) { if (!fear.respawn && !this.nuria.beaten.includes(fear.id)) this.nuria.beaten.push(fear.id); return []; }
    if (!event.won) {
      if (!this.adult) return [];
      // Chapter 2: falling is waking up at home the next morning, with everything done kept;
      // caught on the way home at night, late in the morning.
      return this.endDay(event.encounter === 'night-guard' ? 'night-fall' : 'fall');
    }
    // One of them beaten in the street: it melts where it stood (the game), the hunt goes on.
    if (event.encounter === 'night-guard') return [];
    // Through the guards is a milestone in her palace: night falls outside.
    if (event.encounter === 'palace-guards') return [say(LINES_2.guardsBeaten), ...this.spend('fight'), ...this.nightfall()];
    if (event.encounter === 'palace-minion') {
      if (!this.set('wrapper-room')) return [];
      return [say(LINES.afterMatemagico), { kind: 'ambush' }];
    }
    if (!this.has('minion') || !this.set('first-fight')) return [];
    return [say(LINES.afterFight), { kind: 'palace' }];
  }
  get classes(): ClassId[] {
    const debug = this.debugAnimas;
    return debug ? CLASS_ORDER.filter(id => debug[id]) : this.storyClasses;
  }
  /** The ánimas the story has unlocked, whatever the picker says. */
  get storyClasses(): ClassId[] {
    return [
      ...this.has('matemagico') ? ['matemagico' as const] : [],
      // Lent by Nuria for her mission, or the party's for good once it is won.
      ...this.has('papagato') || this.nuria.lent ? ['papagato' as const] : [],
      // Aitor's own, from the morning he is in the party (a placeholder, still to design).
      ...this.adult ? ['tecnopata' as const] : [],
      // The university friends', once the photo with the melon is taken (docs/animas/dadaista/).
      ...this.has('anima-universidad') ? ['dadaista' as const] : [],
    ];
  }
  /**
   * Development: starts Nuria's mission partway (the picker's Misiones tab): the cats lent, the
   * tower's ring reached, the fears beaten. Gerard wears Papagato if he wears nothing, as when she lends it.
   */
  startNuria(run: Partial<NuriaRun>) {
    this.nuria = { ...freshRun(), ...run, beaten: migrateBeaten(run.beaten ?? []) };
    if (!this.nuria.lent) return;
    this.lentBefore = true;
    if (!this.extrasOf('gerard').length) this.equip('gerard', 'papagato');
  }
  /** What the snow globe keeps; setting it (a reload) puts the missions back to it, anything invalid dropped. */
  get kept(): Kept { return structuredClone(this.globe); }
  set kept(value: Kept | Record<string, unknown>) {
    const run = <T extends object>(fresh: T, saved: unknown): T | undefined => {
      if (!saved || typeof saved !== 'object') return undefined;
      const known = Object.entries(saved).filter(([k, v]) => k in fresh && typeof v === typeof (fresh as Record<string, unknown>)[k] && Array.isArray(v) === Array.isArray((fresh as Record<string, unknown>)[k]));
      return { ...fresh, ...structuredClone(Object.fromEntries(known)) };
    };
    const v = value as Kept, board = v?.uni?.board;
    const uni = run(freshUni(), v?.uni);
    if (uni && board && typeof board === 'object') uni.board = structuredClone(board);
    const emilie = run(freshEmilie(), v?.emilie), section = (v?.emilie as { section?: unknown } | undefined)?.section;
    if (emilie && section && typeof section === 'object') emilie.section = { ...createModelo(), ...structuredClone(section) as ModeloState };
    this.globe = Object.fromEntries(Object.entries({ nuria: run(freshRun(), v?.nuria), uni, marta: run(freshMarta(), v?.marta), emilie, luca: run(freshLuca(), v?.luca) }).filter(([, r]) => r));
    this.recall();
  }
  /** The missions as the snow globe keeps them, or not begun. */
  private recall() {
    const { nuria, uni, marta, emilie, luca } = this.kept;
    this.nuria = nuria ?? freshRun(); this.uni = uni ?? freshUni(); this.marta = marta ?? freshMarta(); this.emilie = emilie ?? freshEmilie(); this.luca = luca ?? freshLuca();
  }
  /**
   * The snow globe shaken: the missions are kept as they are and the party is home. The cats do
   * not come along (Nuria lends them again, and the tower stays as far as they got); a game of tag
   * on the sand is not kept running. At night it does nothing: the way home is the street's.
   */
  private shake(): StoryEffect[] {
    const say = (dialogue: Dialogue): StoryEffect => ({ kind: 'dialogue', dialogue });
    if (!this.adult || !this.has('got-bola')) return [];
    if (this.night) return [say(LINES_2.bolaNight)];
    this.nuria = { ...this.nuria, lent: false, warned: false };
    this.uni = { ...this.uni, chase: false };
    this.globe = structuredClone({ nuria: this.nuria, uni: this.uni, marta: this.marta, emilie: this.emilie, luca: this.luca });
    if (this.inside === PLACES_2.bola.environment) return [say(LINES_2.bolaHome)];
    return [{ kind: 'snow', on: true }, { kind: 'travel', environment: PLACES_2.bola.environment, cell: { ...PLACES_2.bola.land } }, { kind: 'snow', on: false }];
  }
  /** Someone went into a portal (`portal` effect) and is gone: Anna, into the spiral in the sea. */
  sank(who: 'party' | UniFriend) { if (who === 'anna' && this.uni.spiral) this.uni.sunk = true; }
  /** Development: starts the university friends' mission partway (the picker's Misiones tab): the game of tag on, the spiral open. */
  /** Development: starts Emilie's mission partway (the picker's Misiones tab): the section's zone and what was measured on the way down. */
  startEmilie(run: Partial<EmilieRun>) { this.emilie = { ...freshEmilie(), ...structuredClone(run), told: [...run.told ?? []] }; }
  /** The run through Emilie's model: the one under way, or a new one from where they land. */
  modeloRun(): ModeloState { return this.emilie.section ??= createModelo(); }
  startMarta(run: Partial<MartaRun>) { this.marta = { ...freshMarta(), ...run, beaten: [...run.beaten ?? []], told: [...run.told ?? []] }; }
  /** Development: starts Luca's mission partway (the picker's Misiones tab): in the salon, some zones won. */
  startLuca(run: Partial<LucaRun>) { this.luca = { ...freshLuca(), ...run, beaten: [...run.beaten ?? []], told: [...run.told ?? []], mirrors: [...run.mirrors ?? MIRRORS_START] }; }
  startUni(run: Partial<UniRun>) { this.uni = { ...freshUni(), ...run, beaten: [...run.beaten ?? []], told: [...run.told ?? []] }; }
  /** Gerard's active ánima, which also dresses the interface. */
  get gerardClass(): GerardClass | undefined { return this.classOf('gerard') as GerardClass | undefined; }
  /**
   * Each one's own ánima, always theirs and never taken off (docs/party.md): Matemágico is Gerard's
   * (once it wakes), Tecnópata Aitor's. Bernat has none.
   */
  fixedOf(member: MemberId): ClassId | undefined {
    const own = (Object.entries(ANIMA_OWNERS) as [ClassId, string][]).find(([, who]) => who === member)?.[0];
    return own && this.classes.includes(own) ? own : undefined;
  }
  /** The extra ánimas `member` has equipped, still unlocked. */
  extrasOf(member: MemberId): ClassId[] {
    return (this.extras[member] ?? []).filter(id => this.classes.includes(id) && canWear(member, id) && this.fixedOf(member) !== id).slice(0, this.extraSlots);
  }
  /** What `member` can switch between in a fight (L / R): their own ánima, then the extras equipped. */
  kitOf(member: MemberId): ClassId[] {
    const fixed = this.fixedOf(member);
    return [...fixed ? [fixed] : [], ...this.extrasOf(member)];
  }
  /** The ánima `member` wears now: the one they last chose among theirs, otherwise an extra if they equipped one, otherwise their own. */
  classOf(member: MemberId): ClassId | undefined {
    const kit = this.kitOf(member), choice = this.worn[member];
    return choice && kit.includes(choice) ? choice : this.extrasOf(member)[0] ?? kit[0];
  }
  /** Who has `classId` among their ánimas (their own, or equipped as an extra), if anyone. */
  wearerOf(classId: ClassId): MemberId | undefined {
    return (['gerard', 'aitor'] as const).find(member => (member === 'gerard' || this.partner === 'aitor') && this.kitOf(member).includes(classId));
  }
  /**
   * Equips an extra ánima on `member`, in their slot (it takes the place of the one there, which
   * goes back to the party): unlocked, not someone else's own, not equipped by another. They wear
   * it at once. Bernat equips none.
   */
  equip(member: MemberId, classId: ClassId) {
    if (member === 'bernat' || !this.classes.includes(classId) || !canWear(member, classId) || this.fixedOf(member) === classId) return false;
    const other = this.wearerOf(classId);
    if (other && other !== member) return false;
    const kept = this.extrasOf(member).filter(id => id !== classId);
    this.extras[member] = [...kept.slice(0, this.extraSlots - 1), classId];
    this.worn[member] = classId;
    return true;
  }
  /** Takes an extra ánima off `member`'s slot; they wear their own again. Their own cannot be taken off. */
  unequip(member: MemberId, classId: ClassId) {
    if (!this.extrasOf(member).includes(classId)) return false;
    this.extras[member] = this.extrasOf(member).filter(id => id !== classId);
    if (this.worn[member] === classId) delete this.worn[member];
    return true;
  }
  /** Changes which of their ánimas `member` wears (L / R in a fight, or a pill): only one of theirs (`kitOf`). */
  wear(member: MemberId, classId: ClassId) {
    if (member === 'bernat' || !this.kitOf(member).includes(classId)) return false;
    this.worn[member] = classId;
    return true;
  }
  get loadout(): Loadout { return { worn: { ...this.worn }, extras: Object.fromEntries(Object.entries(this.extras).map(([m, ids]) => [m, [...ids ?? []]])) }; }
  /** A saved loadout; anything invalid is dropped (and an old save's ánima worn becomes the extra it was). */
  set loadout(value: Loadout | Record<string, unknown>) {
    this.worn = {}; this.extras = {};
    const members = ['gerard', 'aitor'] as const;
    const isClass = (id: unknown): id is ClassId => typeof id === 'string' && (CLASS_ORDER as string[]).includes(id);
    const v = (value ?? {}) as Record<string, unknown>;
    // Before extras existed, the save was who wore what: whatever was not their own was an extra.
    const old = !('worn' in v) && !('extras' in v);
    const extras = (old ? Object.fromEntries(members.map(m => [m, isClass(v[m]) ? [v[m]] : []])) : v.extras ?? {}) as Record<string, unknown>;
    const worn = (old ? Object.fromEntries(members.map(m => [m, v[m]])) : v.worn ?? {}) as Record<string, unknown>;
    for (const member of members) for (const id of Array.isArray(extras[member]) ? extras[member] : []) if (isClass(id)) this.equip(member, id);
    for (const member of members) if (isClass(worn[member])) this.wear(member, worn[member]);
  }
  /** Who walks beside Gerard here and now, if anyone. */
  get partner(): Partner | undefined { return this.adult ? 'aitor' : this.companion !== 'none' ? 'bernat' : undefined; }
  /** Cells the story keeps shut in a scene (the stuck back door of the wrapper room). */
  blocked(environment: EnvironmentId): Cell[] {
    if (environment === BEACH && (this.uni.chase || this.uni.spiral)) return TENTACLES.map(c => ({ ...c }));
    // The pool's gate stays padlocked until the numbers of the maze's three words are put on it, the merendero's steel door until every pitch is found.
    if (environment === ALEGIA) return PLACES_MARTA.piano.cells.map(c => ({ ...c }));
    // Fran's salon: the queues keep the way (only their ends once they have moved on), and the nave's mirrors and the furniture stand where they are.
    if (environment === INTERIOR && this.salon) return [
      ...QUEUES.flatMap(q => queueCells(q, this.luca.beaten.includes(q.after))),
      ...MIRRORS, ...SALON_SOLID,
    ].map(c => ({ ...c }));
    if (environment === CAMP && !this.has('sobremesa')) return [
      ...this.has('candado') || this.has('parcelas') ? [] : CAMPING_GATE,
      ...this.has('parcelas') ? [] : CAMPING_DOOR,
    ].map(c => ({ ...c }));
    return environment === 'palacio' && !this.has('wrapper-room') ? [{ ...BACK_DOOR }] : [];
  }
  get items(): ItemId[] {
    // Waking up at 35, the dream's things stay in the dream; only the wrapper came back.
    if (this.adult) return [...this.has('got-wrapper') ? ['envoltorio' as const] : [], ...this.has('got-bola') ? ['bola' as const] : []];
    const items: ItemId[] = [];
    if (this.has('got-shoes')) items.push('zapatillas');
    if (this.has('got-backpack')) items.push('mochila');
    if (this.has('got-potion')) items.push('pocion');
    if (this.has('got-chicle')) items.push('chicle');
    return items;
  }
  get companion(): Companion {
    if (!this.has('bernat-joined') || this.adult) return 'none';
    return this.has('bernat-stalled') && !this.has('dejavu') ? 'stalled' : 'follow';
  }
  get party(): PartyMember[] {
    const classId = this.classOf('gerard');
    const note = classId === 'matemagico' ? 'Ánima: Matemágico. Hace magia con la mente.' : this.has('got-shoes') ? 'Listo para el cole.' : 'Aún en pijama.';
    // Chapter 2: Gerard at 35, and Aitor beside him from the moment he wakes up.
    if (this.adult) return [
      { id: 'gerard', name: 'Gerard', profile: 'gerard35', classId, equipment: [], note: classId ? `Treinta y cinco años. Ánima: ${ANIMA_NAMES[classId]}.` : 'Treinta y cinco años.' },
      { id: 'aitor', name: 'Aitor', profile: 'aitor', classId: this.classOf('aitor'), equipment: [], note: this.classOf('aitor') === 'tecnopata' ? 'Ánima: Tecnópata. La suya.' : this.classOf('aitor') ? 'Lleva un ánima de Gerard. Y le queda bien.' : 'Pies en el suelo. Y un abrazo para todos.' },
    ];
    const gerard: PartyMember = { id: 'gerard', name: 'Gerard', profile: 'gerard', classId, equipment: this.items.filter(i => i !== 'pocion' && i !== 'chicle'), note };
    return this.has('bernat-joined') ? [gerard, { id: 'bernat', name: 'Bernat', profile: 'bernat', equipment: [], note: 'Modo escuela: nada equipado.' }] : [gerard];
  }
  /** Who fights: Gerard, plus his partner when the partner is there with him (`withPartner`). Ánimas strengthen everyone. */
  battleParty(withPartner: boolean): PartySlot[] {
    const bonus = this.animas.length ? animaBonus(this.animas) : undefined;
    return this.party.filter(m => m.id === 'gerard' || withPartner)
      .map(({ id, name, profile, classId }) => ({ id, name, profile, classId, kit: id === 'bernat' ? [] : this.kitOf(id), ...(bonus ? { bonus } : {}) }));
  }
  /** The morning of the current day, kept to come back to (taken the first time anything happens that day). */
  private remember() {
    if (!this.adult || this.days.mornings.some(m => m.day === this.days.clock.day)) return;
    this.days.mornings = [...this.days.mornings, { day: this.days.clock.day, story: this.saved }].slice(-2);
  }
  /**
   * Hours go by: Aitor notices the evening, then the night. The clock stops at DAY_END: at night the
   * day only ends at home (through the portal, or in bed) or with a fall.
   */
  private spend(activity: Activity): StoryEffect[] {
    const before = this.days.clock.hour, after = Math.min(DAY_END, before + COSTS[activity]);
    this.days.clock = { ...this.days.clock, hour: after };
    if (!isNight(before) && isNight(after)) return [{ kind: 'dialogue', dialogue: LINES_2.night }];
    if (before < LATE && after >= LATE) return [{ kind: 'dialogue', dialogue: LINES_2.late }];
    if (before < EVENING && after >= EVENING) return [{ kind: 'dialogue', dialogue: LINES_2.evening }];
    return [];
  }
  /**
   * The day is over (night came, they went to bed, or they fell): black, home, and the next
   * morning, when her power has spread a little more. If it has spread all the way, the flat
   * they wake up in is hers and the game is over.
   */
  /**
   * Night falls at once, wherever they are: a friend's mission won, a milestone in her palace
   * reached (docs/chapter-2.md § Night and the way home). Aitor says so, unless it already was.
   */
  private nightfall(): StoryEffect[] {
    if (!this.adult || isNight(this.days.clock.hour)) return [];
    this.days.clock = { ...this.days.clock, hour: NIGHT };
    return [{ kind: 'dialogue', dialogue: LINES_2.night }];
  }
  private endDay(why: 'home' | 'sleep' | 'fall' | 'night-fall'): StoryEffect[] {
    const say = (dialogue: Dialogue): StoryEffect => ({ kind: 'dialogue', dialogue });
    // Whatever the missions had reached is undone (the cats went back to Nuria; the friends are on the sand again), back to what the snow globe keeps.
    this.recall();
    const firstFall = why === 'fall' && this.set('palace-tried');
    // Beaten in the street at night, they sleep the morning away.
    this.days.clock = { day: this.days.clock.day + 1, hour: why === 'night-fall' ? WOKE_LATE : DAY_START };
    this.remember();
    const home: StoryEffect = { kind: 'travel', environment: PLACES.wakeUp.environment, cell: { ...PLACES.wakeUp.cell } };
    const before: StoryEffect[] = why === 'home' ? [say(LINES_2.homeSafe)] : why === 'sleep' ? [say(LINES_2.sleep)] : [];
    if (this.doomed) return [...before, { kind: 'fall' }, home, { kind: 'wake' }, say(LINES_2.doom), { kind: 'rise' }, { kind: 'doom' }];
    const morning = firstFall ? LINES_2.wakeFirst : why === 'night-fall' ? LINES_2.wokeLate : LINES_2.morning[stage(this.spread)];
    return [...before, { kind: 'fall' }, home, { kind: 'wake' }, say(this.withClue(morning)), { kind: 'rise' }];
  }
  /** Back to the morning before the end: that day's progress is lost, everything before it kept. */
  rewind(): StoryEffect[] {
    const target = this.days.mornings.find(m => m.day === this.days.clock.day - 1);
    if (!target) return [];
    // The artilugio, once Bernat has put it in Gerard's hands, is not taken back by going back a day
    // (decided 2026-11-19), nor is the night that brought it: the Queen is met again with it.
    const kept = (['aitor-poseido', 'artilugio'] as const).filter(flag => this.has(flag));
    this.flags.clear(); this.merge(target.story); this.merge(kept);
    this.globe = {}; this.recall();
    this.days = { epoch: this.days.epoch + 1, clock: { day: target.day, hour: DAY_START }, mornings: this.days.mornings.filter(m => m.day <= target.day) };
    const home: StoryEffect = { kind: 'travel', environment: PLACES.wakeUp.environment, cell: { ...PLACES.wakeUp.cell } };
    return [home, { kind: 'wake' }, { kind: 'dialogue', dialogue: LINES_2.rewound }, { kind: 'rise' }];
  }
  /** Places the story watches in this scene (the TV that turned itself on). */
  triggers(environment: EnvironmentId): Trigger[] {
    const castle = castleTriggers(this.castleHost, environment);
    if (castle.length) return castle;
    const { tv } = PLACES_2;
    if (this.adult && !this.has('tv-news') && environment === tv.environment) return [{ id: 'tv', cell: { ...tv.cell }, radius: tv.radius }];
    if (environment === BEACH) return this.uniTriggers();
    if (environment === INTERIOR) {
      if (!this.salon) return [];
      const run = this.luca;
      const next = this.lucaNext;
      return [
        ...run.told.includes('dentro') ? [] : [{ id: 'luca-dentro', cell: { x: PLACES_LUCA.inside.x, z: PLACES_LUCA.inside.z - 1 }, radius: 1.2 }],
        ...next ? [{ id: `luca-${next.id}`, cell: { ...next.cell }, radius: next.radius, ...next.trip ? { area: { ...next.trip } } : {} }] : [],
        // The nave's mirrors, as the nave is come into while the chaplains still wait: its whole mouth, from wall to wall.
        ...next?.id === 'sillones' && !run.told.includes('espejos') ? [{ id: 'luca-espejos', cell: { ...MIRRORS_SEEN }, radius: 2, area: { x: 20, z: 6, w: 3, d: 29 } }] : [],
      ];
    }
    if (environment === CAMP) return this.campTriggers();
    if (environment === CUERDAS_PLACE) {
      if (!this.adult || this.has('voz')) return [];
      const run = this.marta, { voz } = PLACES_CUERDAS;
      return [
        ...PLACES_CUERDAS.mazes.flatMap((m, i) => run.told.includes(`cuerdas-laberinto-${i}`) ? [] : [{ id: `cuerdas-laberinto-${i}`, cell: { ...m.cell }, radius: m.radius }]),
        ...QUALITIES.filter(q => !run.beaten.includes(q.id)).map(q => ({ id: `cuerdas-${q.id}`, cell: { ...q.cell }, radius: q.radius })),
        ...QUALITIES.every(q => run.beaten.includes(q.id)) ? [{ id: 'cuerdas-voz', cell: { x: voz.x, z: voz.z }, radius: voz.radius }] : [],
      ];
    }
    if (!this.adult || this.has('nuria-uri')) return [];
    const { haru, uri } = PLACES_NURIA, run = this.nuria;
    if (environment === STREET && !run.lent && !run.haru) return [{ id: 'haru', cell: { ...haru.cell }, radius: haru.radius }];
    const { portal } = PLACES_NURIA;
    if (environment === CALLE) return !run.lent ? [] : [
      ...run.portal ? [] : [{ id: 'portal', cell: { ...portal.cell }, radius: portal.radius }],
      { id: 'portal-through', cell: { ...portal.cell }, radius: 0, area: { x: 0, z: 0, w: ENVIRONMENTS[CALLE].grid[0].length, d: Math.ceil(portal.cell.z + portal.through) } },
    ];
    if (environment !== MAZE || !run.lent) return [];
    const next = uri[run.stage];
    if (next) return [{ id: `uri-${run.stage}`, cell: { ...next.cell }, radius: next.radius, passing: true }];
    const { summit } = PLACES_NURIA;
    return [{ id: 'summit', cell: { ...summit.cell }, radius: summit.radius, passing: true }];
  }
  /**
   * Someone leading the party in this scene (src/guide.ts walks them): Haru, from the station to
   * Nuria's door, once met and until she gets there; then, lent, from the door up the street to the
   * corner where Uri ran, until they first follow him. Getting there is a `near` with `arrive`.
   */
  guide(environment: EnvironmentId): { id: 'haru'; from: Cell; to: Cell; arrive: string } | undefined {
    const run = this.nuria;
    if (environment !== STREET || !this.adult || this.has('nuria-uri') || !run.haru) return undefined;
    if (run.lent) return run.street ? undefined : { id: 'haru', from: { ...HARU_HOME }, to: { ...PLACES_NURIA.corner.cell }, arrive: 'haru-corner' };
    if (run.led) return undefined;
    return { id: 'haru', from: { ...PLACES_NURIA.haru.cell }, to: { ...HARU_HOME }, arrive: 'haru-home' };
  }
  /** On the beach: behind the friends, then near Anna, then the spiral where she went. */
  private uniTriggers(): Trigger[] {
    if (!this.adult || this.has('sobremesa')) return [];
    const { talk, anna, spiral } = PLACES_UNI, run = this.uni;
    if (run.spiral) return run.sunk ? [{ id: 'uni-through', cell: { ...PLACES_UNI.portal }, radius: spiral.through }] : [];
    if (run.chase) return [{ id: 'uni-spiral', cell: { ...anna }, radius: spiral.radius }];
    return [{ id: 'uni-talk', cell: { x: talk.x, z: talk.z }, radius: talk.radius }];
  }
  /** In the campsite: the padlocked gate, then El Campeón by the pool and the steel door, then the long table once the door is open. */
  private campTriggers(): Trigger[] {
    if (!this.adult || this.has('sobremesa')) return [];
    const run = this.uni, list: Trigger[] = [];
    const { gate, campeon, mesa, door } = PLACES_CAMP;
    if (!this.has('candado')) { if (!run.told.includes('gate')) list.push({ id: 'camp-gate', cell: { x: gate.x, z: gate.z }, radius: gate.radius }); return list; }
    if (!run.beaten.includes('campeon')) list.push({ id: 'camp-campeon', cell: { x: campeon.x, z: campeon.z }, radius: campeon.radius });
    if (!this.has('parcelas')) { if (!run.told.includes('door')) list.push({ id: 'camp-door', cell: { x: door.x, z: door.z }, radius: door.radius }); }
    else list.push({ id: 'camp-mesa', cell: { x: mesa.x, z: mesa.z }, radius: mesa.radius });
    return list;
  }
  /** The campsite's foes still waiting this visit, for the game to stand at their places (src/camping-foes.ts models). */
  campFoes(environment: EnvironmentId): { id: string; encounter: string; cell: Cell }[] {
    if (environment !== CAMP || !this.adult || this.has('sobremesa')) return [];
    const run = this.uni;
    return [
      // Behind the tall wall: nobody sees El Campeón until the padlock opens its gate.
      ...run.beaten.includes('campeon') || !this.has('candado') ? [] : [{ id: 'campeon', encounter: 'campeon', cell: { x: PLACES_CAMP.campeon.x, z: PLACES_CAMP.campeon.z } }],
    ];
  }
  /** The friends playing tag on the beach (src/chasers.ts moves them; reaching Gerard is a `near` with their id). */
  uniChasers(environment: EnvironmentId): UniChaser[] {
    const run = this.uni;
    if (environment !== BEACH || !this.adult || this.has('sobremesa') || !(run.chase || run.spiral)) return [];
    return (Object.entries(PLACES_UNI.friends) as [UniFriend, Cell][]).map(([friend, cell]) => ({
      id: `uni-${friend}`, friend, patrol: [{ ...cell }], sight: 99, walk: 0, run: TAG.run, relentless: true, frozen: run.spiral,
    }));
  }
  /** Uri's fears still hunting the ramp (src/chasers.ts moves them; reaching Gerard is a `near` with their id). */
  fears(environment: EnvironmentId): { id: string; encounter: FearEncounter | CampingEncounter | CastleEncounter; patrol: readonly Cell[]; sight: number; walk: number; run: number; respawn?: boolean }[] {
    // The castle: the Queen's pupils round their rooms, and each boss standing where it waits (src/castle-story.ts).
    const pupils = castleFears(this.castleHost, environment);
    if (pupils.length) return pupils;
    // Càmping Eurosport's magos and agentes on their rounds (docs/quests/universidad.md), until beaten this visit.
    if (environment === CAMP) return !this.adult || this.has('sobremesa') ? [] : CAMP_HUNTERS.filter(h => !this.uni.beaten.includes(h.id)).map(h => ({ ...h, id: `camp-${h.id}` }));
    if (environment !== MAZE || !this.adult || !this.nuria.lent || this.has('nuria-uri')) return [];
    return FEARS.filter(f => !this.nuria.beaten.includes(f.id));
  }
  /** Where a door leads instead of its own destination, by story: the palace opens onto the school in chapter 2. */
  redirect(interactionId: string): { environment: EnvironmentId; cell: Cell } | undefined {
    if (interactionId === PALACE_EXIT && this.adult) return { environment: PLACES_2.school.environment, cell: { x: SCHOOL_DOOR.x, z: SCHOOL_DOOR.z + 1 } };
    if (interactionId === SCHOOL_WAY && this.adult) return { environment: 'palacio-patio', cell: { x: 17, z: 2 } };
    // The school's doors open onto the castle's floors while their boss stands (docs/castle.md § Structure).
    return castleRedirect(this.castleHost, interactionId);
  }
  /** Cells the guards stand on in the palace hall (chapter 2): fewer as the party gathers ánimas. */
  get guarded(): Cell[] {
    if (!this.adult) return [];
    const { count } = palaceGuards(this.animas.length);
    const cells = PLACES_2.guards.cells;
    // The middle one stays; the sides go first.
    return (count >= cells.length ? cells : count === 2 ? [cells[0], cells[2]] : [cells[1]]).map(c => ({ ...c }));
  }
  /** Where a new or reloaded game puts Gerard, if the story decides it. */
  get resume(): { environment: EnvironmentId; cell: Cell } {
    if (this.adult) return { environment: PLACES.wakeUp.environment, cell: { ...PLACES.wakeUp.cell } };
    if (this.has('in-palace')) return { environment: PLACES.palaceEntry.environment, cell: { ...PLACES.palaceEntry.cell } };
    if (this.has('palace')) return { environment: 'maresme', cell: { x: 16, z: 8 } };
    if (this.has('got-backpack')) return { environment: 'maresme', cell: this.has('bernat-joined') ? { x: 10, z: 25 } : { x: 20, z: 23 } };
    return { environment: PLACES.wake.environment, cell: { ...PLACES.wake.cell } };
  }
  /** Home at this point of the story: the flat on the Meridiana at 35, the house in Sant Quirze before (the picker's «En casa»). */
  get home(): { environment: EnvironmentId; cell: Cell } {
    const at = this.adult ? PLACES.wakeUp : PLACES.wake;
    return { environment: at.environment, cell: { ...at.cell } };
  }
  /** What Bernat says over his head right now, if anything. */
  get bubble(): string | undefined {
    if (this.away && this.has('palace') && !this.has('in-palace') && this.companion === 'follow') return BUBBLES.away[0];
    if (this.companion !== 'stalled') return undefined;
    return BUBBLES.stalled[Math.min(this.tugs, BUBBLES.stalled.length - 1)];
  }
  npcs(environment: EnvironmentId): StoryNpc[] {
    const all: StoryNpc[] = [
      { id: 'mama', character: 'mama', environment: PLACES.mama.environment, cell: PLACES.mama.cell, scale: 1.3 },
      { id: 'jan', character: 'jan-child', environment: PLACES.jan.environment, cell: PLACES.jan.cell, scale: 1.12 },
    ];
    // Chapter 1 is a dream: once Gerard wakes, home in Sant Quirze is empty, and Aitor walks with him (the partner, not an NPC).
    if (this.adult) return [...this.nuriaNpcs(), ...this.uniNpcs(), ...this.martaNpcs(), ...this.emilieNpcs(), ...this.lucaNpcs()].filter(npc => npc.environment === environment);
    return all.filter(npc => npc.environment === environment);
  }
  /** Nuria at her door, the cats with her until she lends them, and Uri ahead in his maze. */
  private nuriaNpcs(): StoryNpc[] {
    const { nuria, haru } = PLACES_NURIA, run = this.nuria, won = this.has('nuria-uri');
    const at = (c: Cell, dx: number, dz: number) => ({ x: c.x + dx, z: c.z + dz });
    const list: StoryNpc[] = [{ id: 'nuria', character: 'nuria', environment: STREET, cell: { ...nuria.cell }, scale: 1.12 }];
    if (won) list.push({ id: 'uri', character: 'uri', environment: STREET, cell: at(nuria.cell, -2, 0), scale: 1.12 });
    if (!won && !run.lent) {
      list.push({ id: 'yuki', character: '', cat: 'yuki', environment: STREET, cell: at(nuria.cell, 1, 1), scale: 1.35 });
      // Haru waits at the station, then leads the way (`guide`, drawn by the game), then sits by the door.
      if (!run.haru || run.led) list.push({ id: 'haru', character: '', cat: 'haru', environment: STREET, cell: run.led ? { ...HARU_HOME } : { ...haru.cell }, scale: 1.35 });
    }
    // In the tower Uri is up at the top all along, on Vertitrón (src/fears.ts), not on the ramp.
    return list;
  }
  /**
   * The friends on the sand with their backs to the town, facing the sea, and Anna out in the water
   * facing them; during the game of tag they are chasers instead (`uniChasers`), and Anna goes with
   * the spiral.
   */
  private uniNpcs(): StoryNpc[] {
    const run = this.uni, list: StoryNpc[] = [];
    // Free: round the melon table in the campsite for the photo, then back on the beach round Gerard
    // and Aitor, themselves again; each facing the two of them.
    const toward = (from: Cell, to: Cell) => facingToward(to.x - from.x, to.z - from.z);
    if (this.has('sobremesa')) return UNI_FRIENDS.flatMap(id => [
      { id, character: id, facing: toward(PLACES_UNI.freed[id], PLACES_UNI.home), environment: BEACH, cell: { ...PLACES_UNI.freed[id] }, scale: UNI_SCALE },
      ...run.entered ? [{ id, character: id, facing: toward(CAMP_FREED[id], PLACES_CAMP.foto), environment: CAMP, cell: { ...CAMP_FREED[id] }, scale: UNI_SCALE }] : [],
    ]);
    const friend = (id: UniFriend, cell: Cell, facing: number): StoryNpc => ({ id, character: id, possessed: true, facing, environment: BEACH, cell: { ...cell }, scale: UNI_SCALE });
    if (!run.chase && !run.spiral) for (const [id, cell] of Object.entries(PLACES_UNI.friends) as [UniFriend, Cell][]) list.push(friend(id, cell, 0));
    if (!run.sunk) list.push({ ...friend('anna', PLACES_UNI.anna, 0), wade: PLACES_UNI.wade });
    return list;
  }
  /** Haru and Yuki, home in the Meridiana flat once Uri is himself again (src/cat-wander.ts walks them). */
  catsAtHome(environment: EnvironmentId): { id: CatId; cell: Cell }[] {
    const { cats } = PLACES_2;
    if (!this.adult || !this.has('nuria-uri') || environment !== cats.environment) return [];
    return [{ id: 'haru', cell: { ...cats.haru } }, { id: 'yuki', cell: { ...cats.yuki } }];
  }
  /** Loose things still lying around, drawn as pickups. */
  pickups(environment: EnvironmentId): { id: ItemId; cell: Cell; spot?: { x: number; z: number; y: number } }[] {
    const all = [
      { id: 'pocion' as const, place: PLACES.pocion, taken: this.has('got-potion') },
      { id: 'mochila' as const, place: PLACES.mochila, taken: this.has('got-backpack') },
      { id: 'chicle' as const, place: PLACES.chicle, taken: this.has('got-chicle') },
      { id: 'envoltorio' as const, place: PLACES.envoltorio, taken: this.has('got-wrapper') || !this.adult },
      { id: 'bola' as const, place: PLACES_2.bola, taken: this.has('got-bola') || !this.adult },
    ];
    return all.filter(p => !p.taken && p.place.environment === environment)
      .map(p => ({ id: p.id, cell: p.place.cell, spot: 'spot' in p.place ? p.place.spot : undefined }));
  }
  /** Story interactions in this scene; `partner` is the cell of whoever walks with Gerard. */
  interactions(environment: EnvironmentId, partner?: Cell): Interaction[] {
    const list: Interaction[] = [];
    for (const [id, { place, label, ...prompt }] of Object.entries(STORY_INTERACTIONS)) {
      if (place.environment !== environment) continue;
      if (id === 'take-pocion' && this.has('got-potion')) continue;
      if (id === 'take-mochila' && this.has('got-backpack')) continue;
      if (id === 'take-chicle' && this.has('got-chicle')) continue;
      if (id === 'take-envoltorio' && (this.has('got-wrapper') || !this.adult)) continue;
      if (id === 'take-bola' && (this.has('got-bola') || !this.adult)) continue;
      if (id === 'meridiana-bed' && !this.adult) continue;
      list.push({ id, label, ...prompt, cell: { ...place.cell } });
    }
    if (this.adult && environment === STREET) {
      list.push({ id: 'talk-nuria', label: 'Hablar con Nuria', cell: { ...PLACES_NURIA.nuria.cell } });
    }
    if (this.adult && environment === ALEGIA) {
      list.push({ id: 'talk-marta', label: 'Hablar con Marta', cell: { ...PLACES_MARTA.marta } });
      list.push({ id: 'piano-marta', label: 'Tocar el piano', hint: 'Tocar el piano', cell: { ...PLACES_MARTA.piano.seat } });
    }
    // Emilie's door rings in chapter 2 instead of being looked at; in her flat, her and her laptop; in her model, the way back out.
    if (this.adult && this.has('metro') && environment === POBLE_SEC) list.push({ id: 'poble-sec-emilie', label: 'Llamar al portal', hint: 'Llamar', cell: { ...PLACES_EMILIE.door } });
    if (this.adult && environment === PISO) {
      list.push({ id: 'talk-emilie', label: 'Hablar con Emilie', cell: { ...PLACES_PISO.emilie } });
      list.push({ id: 'portatil-emilie', label: 'Su portátil', hint: this.has('modelo') && !this.has('converge') ? 'Entrar' : 'Mirar', cell: { ...PLACES_PISO.laptop }, anchor: { ...PLACES_PISO.screen } });
    }
    if (this.adult && environment === MODELO_PLACE) list.push({ id: 'salir-modelo', label: 'Volver al piso', hint: 'Volver', cell: { ...PLACES_MODELO.exit } });
    if (this.adult && environment === CUERDAS_PLACE) {
      if (!this.has('voz')) list.push({ id: 'talk-marta', label: 'Hablar con Marta', cell: { ...PLACES_CUERDAS.marta[Math.min(this.marta.beaten.length, PLACES_CUERDAS.marta.length - 1)] } });
      list.push({ id: 'salir-cuerdas', label: 'Volver por la pompa', hint: 'Volver', cell: { ...PLACES_CUERDAS.exit } });
    }
    if (this.adult && environment === SAGRADA) {
      list.push({ id: 'talk-luca', label: 'Hablar con Luca', cell: { ...PLACES_LUCA.luca } });
      list.push({ id: 'luca-reflejo', label: 'Mirar el reflejo', cell: { ...PLACES_LUCA.reflejo } });
    }
    if (environment === INTERIOR && this.salon) {
      list.push({ id: 'talk-capellan', label: 'Hablar con el capellán', cell: { ...PLACES_LUCA.capellan } });
      for (const q of QUEUES) if (!this.luca.beaten.includes(q.after)) list.push({ id: `luca-cola-${q.id}`, label: 'Mirar la cola', cell: { ...q.look } });
      if (!this.luca.beaten.includes('sillones')) MIRRORS.forEach((m, i) => list.push({ id: `luca-espejo-${i}`, label: 'Girar el espejo', hint: 'Girar', cell: { ...m } }));
      for (const look of LOOKS) list.push({ id: look.id, label: look.label, cell: { ...look.cell } });
    }
    if (this.adult && environment === JAR.environment && this.jar.length) {
      list.push({ id: 'meridiana-luces', label: 'Abrir el bote', hint: 'Abrir el bote', cell: { ...JAR.cell }, anchor: { ...JAR.anchor } });
    }
    if (environment === 'maresme' && this.has('palace') && !this.adult) list.push({ id: 'enter-palace', label: 'Atravesar la pompa', cell: { x: PLACES.palace.door.x, z: PLACES.palace.door.z - 1 } });
    if (environment === 'palacio') {
      // Chapter 1's looks answer with Bernat's voice; at 35 only the curtain is worth a word.
      for (const look of PALACE_LOOKS) if (!this.adult || look.id === 'look-curtain') list.push({ id: look.id, label: look.label, cell: { ...look.cell } });
      if (!this.has('wrapper-room')) list.push({ id: 'push-back-door', label: 'Empujar la puerta', hint: 'Empujar', cell: { ...BACK_DOOR } });
      if (this.adult) list.push({ id: 'challenge-guards', label: 'Cruzar la cortina', hint: 'Cruzar la cortina', cell: { ...PLACES_2.guards.challenge } });
      // At 35 the east door opens: the school is behind it (src/palace-zone-plans.ts).
      if (this.adult) list.push({ id: SCHOOL_WAY, label: 'Abrir la puerta', cell: { x: 21, z: 13 } });
    }
    list.push(...castleInteractions(this.castleHost, environment));
    if (partner && this.partner === 'bernat') list.push({ id: 'talk-bernat', label: this.companion === 'stalled' ? 'Preguntarle a Bernat qué pasa' : 'Hablar con Bernat', hint: this.companion === 'stalled' ? 'Preguntar qué pasa' : undefined, cell: { x: Math.round(partner.x), z: Math.round(partner.z) } });
    return list;
  }
  /** A dialogue that stops a door from working, if the story is not ready for it. */
  gate(interactionId: string): Dialogue | undefined {
    if (interactionId === PALACE_EXIT) return this.has('wrapper-room') ? undefined : LINES.leaveLocked;
    // Inside the palace the school's doors open boss by boss: the secretaría and Direcció once the management team has fallen.
    const shut = castleGate(this.castleHost, interactionId, { office: LINES_2.officeShut, direction: LINES_2.directionShut });
    if (shut) return shut;
    // The TV switched itself on when Gerard woke: Aitor will not go out before seeing it.
    if (interactionId === 'meridiana-door' && this.adult && !this.has('tv-news')) return LINES_2.doorBeforeNews;
    // Luca by the pond: Aitor sees him before they go in (docs/quests/luca.md § Beats).
    if (interactionId === LUCA_DOOR && this.adult && !this.has('sagrada-luca') && !this.has('fran')) return LINES_LUCA.doorBefore;
    if (!HOUSE_EXITS.has(interactionId)) return undefined;
    if (!this.has('got-shoes')) return LINES.leaveBeforeBreakfast;
    if (!this.has('got-backpack')) return LINES.leaveWithoutBackpack;
    return undefined;
  }
  /** Whether Gerard may stand at `cell` while Bernat stalls at `bernat`. */
  withinLeash(cell: Cell, bernat: Cell) {
    return this.companion !== 'stalled' || Math.hypot(cell.x - bernat.x, cell.z - bernat.z) <= LEASH;
  }
  private set(flag: StoryFlag) { const fresh = !this.flags.has(flag); this.flags.add(flag); return fresh; }

  /** Applies one event; returns what the player should see, in order. Unknown events do nothing. */
  handle(event: StoryEvent): StoryEffect[] {
    this.remember();
    const say = (dialogue: Dialogue): StoryEffect => ({ kind: 'dialogue', dialogue });
    switch (event.type) {
      case 'start':
        // A reload between a beat's trigger and its cut-scene plays the cut-scene again.
        if (this.has('dejavu') && !this.has('minion')) return [{ kind: 'minion' }];
        if (this.has('first-fight') && !this.has('palace')) return [{ kind: 'palace' }];
        if (this.has('wrapper-room') && !this.has('caught')) return [{ kind: 'ambush' }];
        if (!this.set('intro')) return [];
        return [{ kind: 'card', id: 'intro' }, say(LINES.wake)];
      case 'minion':
        if (!this.has('dejavu') || !this.set('minion')) return [];
        return [say(LINES.minion), { kind: 'battle', encounter: 'dogs' }];
      case 'battle': {
        const learned = event.won ? this.grow(event.worn, event.xp, true) : [];
        return [...this.afterBattle(event), ...learned];
      }
      case 'palace':
        if (!this.has('first-fight') || !this.set('palace')) return [];
        return [say(LINES.palaceRises)];
      case 'away':
        this.away = event.away;
        return [];
      case 'room':
        if (event.id !== WRAPPER_ROOM || !this.has('in-palace') || this.has('wrapper-room')) return [];
        return [say(LINES.drainGurgle), { kind: 'drain' }, say(LINES.drainRises), { kind: 'battle', encounter: 'palace-minion' }];
      case 'class':
        // The ánima that just woke up is the one he wears.
        this.set(event.id); this.worn.gerard = event.id;
        return [];
      case 'caught': {
        if (!this.has('wrapper-room') || !this.set('caught')) return [];
        const home: StoryEffect = { kind: 'travel', environment: PLACES.wakeUp.environment, cell: { ...PLACES.wakeUp.cell } };
        // Aitor is in the party from here on: a second player can take him (the hint shows only when that is new).
        return [home, { kind: 'wake' }, say(LINES.waking), { kind: 'rise' }, { kind: 'hint', id: 'duo' }];
      }
      case 'use':
        return event.item === 'bola' ? this.shake() : [];
      case 'ending':
        return castleEnding(this.castleHost, event.choice);
      case 'home':
        // In from the street at night: they made it, and the day is over.
        return this.night ? this.endDay('home') : [];
      case 'near':
        if (event.id.startsWith('uni-')) return this.nearUni(event.id);
        if (event.id.startsWith('camp-')) return this.nearCamp(event.id);
        if (event.id.startsWith('cuerdas-')) return this.nearMarta(event.id);
        if (event.id.startsWith('castillo-')) return castleNear(this.castleHost, event.id);
        // Emilie's section (src/modelo.ts): a patrol reached them, or they came up to El que no converge.
        if (event.id.startsWith('modelo-')) return this.nearModelo(event.id);
        if (event.id.startsWith('luca-')) return this.nearLuca(event.id);
        // The palace's monsters on the Meridiana at night (src/night.ts): one has caught them.
        if (event.id.startsWith('night-')) return this.night ? [say(LINES_2.nightCaught), { kind: 'battle', encounter: 'night-guard' }] : [];
        if (event.id !== 'tv') return this.nearNuria(event.id);
        if (!this.adult || !this.set('tv-news')) return [];
        // The ticker carries the R4 clue, and the Sagrada Família's: seen on the TV, they are known.
        this.set('clue-r4');
        { const link = this.lucaLink('tv'); this.set('clue-sagrada'); return [{ kind: 'news' }, say(LINES_2.news), ...link.map(say)]; }
      case 'arrive':
        // Every trip takes its hour.
        if (event.station === 'trinitat-vella' && this.set('rec-comtal')) return [{ kind: 'look', anchor: 'palace' }, say(LINES_2.recComtalFirst), { kind: 'look' }, ...this.spend('metro')];
        if (event.station === 'cardedeu' && this.set('cardedeu')) return [say(LINES_NURIA.arrive), ...this.spend('metro')];
        return this.spend('metro');
      case 'parcelas':
        return this.choosePitch(event);
      case 'candado':
        return this.tryLock(event.numbers);
      case 'south':
        if (this.companion !== 'follow' || this.has('dejavu') || !this.set('bernat-stalled')) return [];
        this.tugs = 0;
        return [];
      case 'leash':
        if (this.companion !== 'stalled') return [];
        this.tugs++;
        return [];
    }
    switch (event.id) {
      case 'talk-nuria': {
        if (!this.adult) return [];
        if (this.has('nuria-uri')) return [say(LINES_NURIA.home)];
        if (this.nuria.lent) return [say(LINES_NURIA.nuriaWaiting)];
        // She lends them the cats: Papagato wakes up, on trial until Uri is back.
        const again = this.nuria.haru && this.has('papagato-2' as StoryFlag) ? false : this.lentBefore;
        // What the snow globe kept of the tower stays: only the cats went back to her.
        this.nuria = { ...this.nuria, lent: true, haru: true, warned: false };
        this.lentBefore = true;
        if (!this.extrasOf('gerard').length) this.equip('gerard', 'papagato');
        return [say(again ? LINES_NURIA.nuriaAgain : LINES_NURIA.nuriaFirst), { kind: 'anima', classId: 'papagato' }];
      }
      case 'talk-marta': {
        if (!this.adult) return [];
        if (this.has('voz')) return [say(LINES_MARTA.after)];
        if (this.inside === CUERDAS_PLACE) return [say(LINES_MARTA.beside[Math.min(this.marta.beaten.length, LINES_MARTA.beside.length - 1)])];
        return [say(this.set('alegia-marta') ? LINES_MARTA.arrive : LINES_MARTA.waiting)];
      }
      case 'piano-marta':
        return this.playPiano();
      case 'poble-sec-emilie': {
        if (!this.adult || !this.has('metro')) return [];
        const inside: StoryEffect = { kind: 'travel', environment: PISO, cell: { ...PLACES_PISO.spawn } };
        if (this.has('converge')) return [say(LINES_EMILIE.doorAfter), inside];
        return [say(this.emilie.told.includes('door') ? LINES_EMILIE.doorAgain : (this.emilie.told.push('door'), LINES_EMILIE.door)), inside];
      }
      case 'talk-emilie': {
        if (!this.adult) return [];
        if (this.has('converge')) return [say(LINES_EMILIE.after)];
        return [say(this.set('poble-sec-emilie') ? LINES_EMILIE.arrive : LINES_EMILIE.waiting)];
      }
      case 'portatil-emilie':
        return this.useLaptop();
      case 'modelo-pozo-apagado': {
        if (!this.adult) return [];
        const first = !this.emilie.told.includes('pozo');
        if (first) this.emilie.told.push('pozo');
        return [say(first ? LINES_EMILIE.wellDead : LINES_EMILIE.wellDeadAgain)];
      }
      case 'salir-modelo':
        return [{ kind: 'travel', environment: PISO, cell: { ...PLACES_PISO.laptop } }];
      case 'talk-luca': {
        if (!this.adult) return [];
        if (this.has('fran')) return [say(LINES_LUCA.after)];
        if (this.set('sagrada-luca')) return [say(LINES_LUCA.arrive)];
        return [say(LINES_LUCA.waiting[Math.min(this.luca.beaten.length, LINES_LUCA.waiting.length - 1)])];
      }
      case 'luca-cola-nave': case 'luca-cola-pasion': case 'luca-cola-abside':
        return this.salon ? [say(LINES_LUCA.queue)] : [];
      case 'luca-agenda': case 'luca-tintes': case 'luca-lente':
        return this.salon ? [say(LINES_LUCA.looks[event.id as LookId])] : [];
      case 'luca-espejo-0': case 'luca-espejo-1': case 'luca-espejo-2': {
        if (!this.salon) return [];
        const before = this.beam.hit;
        this.luca.mirrors = turned(this.luca.mirrors as Facing[], Number(event.id.slice(-1)));
        if (this.beam.hit && !before && !this.luca.told.includes('deslumbrados')) { this.luca.told.push('deslumbrados'); return [say(LINES_LUCA.dazzled)]; }
        return [];
      }
      case 'luca-reflejo':
        if (!this.adult) return [];
        return [say(this.has('fran') ? LINES_LUCA.reflejoAfter : LINES_LUCA.reflejo)];
      case 'talk-capellan': {
        if (!this.salon) return [];
        const won = this.luca.beaten.length;
        if (won < ZONES.length) return [say(LINES_LUCA.capellan[Math.min(won, LINES_LUCA.capellan.length - 1)])];
        return [say(LINES_LUCA.ready), say(LINES_LUCA.fran), { kind: 'battle', encounter: 'fran' }];
      }
      case 'meridiana-foto-luca': {
        if (!this.adult) return [];
        if (this.has('fran')) return [say(LINES_LUCA.photoAfter)];
        if (!this.set('clue-luca-foto')) return [say(LINES_LUCA.photoAgain)];
        const seen = this.has('clue-sagrada') ? LINES_LUCA.linkTv : this.has('clue-sagrada-cartel') ? LINES_LUCA.linkPoster : undefined;
        return [say(LINES_LUCA.photo), ...seen && !this.has('sagrada-luca') ? [say(seen)] : []];
      }
      case 'clue-sagrada-cartel': {
        const link = this.lucaLink('poster');
        this.set('clue-sagrada-cartel');
        return [say(LINES_LUCA.poster), ...link.map(say)];
      }
      case 'salir-cuerdas':
        return [{ kind: 'travel', environment: ALEGIA, cell: { ...PLACES_MARTA.back } }];
      case 'recepcio-pizarra':
        return [{ kind: 'dialogue', dialogue: LINES_UNI.boardIdle }];
      case 'pissarra-piscina':
        return this.blackboard();
      case 'candado-porton':
        return this.padlock();
      case 'calle-tornar':
        return [{ kind: 'travel', environment: STREET, cell: { ...PLACES_NURIA.streetBack.cell } }];
      case 'salir-laberinto':
        return [{ kind: 'travel', environment: CALLE, cell: { ...PLACES_NURIA.calleBack.cell } }];
      case 'talk-jan':
        if (this.set('met-jan')) return [say(LINES.jan)];
        return [say(this.has('got-potion') ? LINES.janAfterPotion : LINES.janAgain)];
      case 'take-pocion':
        if (!this.set('got-potion')) return [];
        return [say(LINES.pocion), { kind: 'item', item: 'pocion' }];
      case 'talk-mama':
        if (this.set('got-shoes')) return [say(LINES.mama), { kind: 'item', item: 'zapatillas' }, { kind: 'hint', id: 'run' }];
        return [say(this.has('got-backpack') ? LINES.mamaBye : LINES.mamaWaiting)];
      case 'take-mochila':
        if (!this.set('got-backpack')) return [];
        return [say(LINES.mochila), { kind: 'item', item: 'mochila' }, { kind: 'hint', id: 'items' }];
      case 'call-bernat':
        if (!this.has('got-backpack')) return [say(LINES.bernatNotYet)];
        if (!this.set('bernat-joined')) return [say(LINES.bernatHere)];
        return [say(LINES.bernatJoins), { kind: 'hint', id: 'party' }];
      case 'take-chicle':
        if (!this.set('got-chicle')) return [];
        return [say(LINES.chicle), { kind: 'item', item: 'chicle' }];
      case 'enter-palace': {
        if (!this.has('palace')) return [];
        const first = this.set('in-palace');
        const travel: StoryEffect = { kind: 'travel', environment: PLACES.palaceEntry.environment, cell: { ...PLACES.palaceEntry.cell } };
        return [{ kind: 'gate' }, travel, ...(first ? [say(LINES.inPalace)] : [])];
      }
      case 'take-envoltorio':
        if (!this.adult || !this.set('got-wrapper')) return [];
        return [say(LINES.envoltorio), { kind: 'item', item: 'envoltorio' }];
      case 'take-bola':
        if (!this.adult || !this.set('got-bola')) return [];
        return [say(LINES_2.bola), { kind: 'item', item: 'bola' }, { kind: 'hint', id: 'items' }];
      case 'meridiana-tv':
        if (!this.adult) return [];
        if (this.set('tv-news')) { this.set('clue-r4'); const link = this.lucaLink('tv'); this.set('clue-sagrada'); return [{ kind: 'news' }, say(LINES_2.news), ...link.map(say)]; }
        return [{ kind: 'news' }, say(LINES_2.newsAgain)];
      case 'enter-school': {
        if (!this.adult) return [];
        const after = castleInteract(this.castleHost, event.id);
        if (after) return after;
        // A boss beaten is a checkpoint: from then on the way in starts in its room (docs/castle.md § Structure).
        const at = castleEntry(this.flags) ?? PLACES.palaceEntry;
        const inside: StoryEffect = { kind: 'travel', environment: at.environment, cell: { ...at.cell } };
        return [{ kind: 'gate' }, inside, ...(this.set('castle') ? [say(LINES_2.castleFirst)] : [])];
      }
      case 'challenge-guards':
        if (!this.adult) return [];
        return [say(LINES_2.guards), { kind: 'battle', encounter: 'palace-guards' }];
      case 'meridiana-bed':
        if (!this.adult) return [];
        if (!this.has('tv-news')) return [say(LINES_2.sleepNotYet)];
        return this.endDay('sleep');
      case 'meridiana-piano':
        if (!this.adult) return [];
        return [say(LINES_2.piano), ...this.spend('piano')];
      case 'meridiana-luces':
        return this.adult && this.jar.length ? [{ kind: 'jar' }] : [];
      case 'meridiana-balcony':
        if (!this.adult) return [];
        return [say(LINES_2.cafe), ...this.spend('cafe')];
      case 'bunkers-norte':
        if (!this.adult) return [];
        return [{ kind: 'look', anchor: 'castillo' }, say(LINES_2.bunkersNorte), { kind: 'look' }];
      case 'clue-r4-marquesina':
        this.set('clue-r4');
        return [say(LINES_2.clueR4Marquesina)];
      case 'push-back-door':
        return this.has('wrapper-room') ? [] : [say(LINES.backDoorStuck)];
      case 'talk-bernat':
        if (this.companion === 'stalled') { this.set('dejavu'); return [say(LINES.dejavu), { kind: 'minion' }]; }
        if (this.has('wrapper-room')) return [say(LINES.bernatAfterMatemagico)];
        if (this.has('in-palace')) return [say(LINES.bernatInPalace)];
        if (this.has('palace')) return [say(LINES.bernatPalace)];
        if (this.has('first-fight')) return [say(LINES.bernatAfterFight)];
        if (this.has('minion')) return [say(LINES.bernatFight)];
        if (this.has('dejavu')) return [say(LINES.bernatAfter)];
        return this.companion === 'follow' ? [say(LINES.bernatHere)] : [];
    }
    const castle = castleInteract(this.castleHost, event.id);
    if (castle) return castle;
    // Down into a station: the first time, the city opens (the `metro` flag).
    const station = stationOf(event.id);
    // Leaving Cardedeu with Nuria's cats: Aitor asks first, and going hands them back.
    if (station === 'cardedeu' && this.nuria.lent) {
      if (!this.nuria.warned) { this.nuria.warned = true; return [say(LINES_NURIA.leaveWarn)]; }
      this.nuria = freshRun();
    }
    if (station && this.adult) return [...(this.set('metro') ? [say(this.withClue(LINES_2.metroFirst))] : []), { kind: 'metro', station }];
    if (event.id === 'look-curtain' && this.adult) return [say(LINES_2.curtain)];
    const look = PALACE_LOOKS.find(l => l.id === event.id);
    return look ? [say(look.dialogue)] : [];
  }
}
