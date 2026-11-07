/**
 * Story progress as a set of flags, and the rules that turn game events into story beats.
 * Pure: no DOM, no engine. `main.ts` runs the returned effects; `game.ts` reads the derived
 * state (NPCs, companion, extra interactions). Flags are what the server saves.
 */
import type { Dialogue } from './dialogue';
import type { EnvironmentId, Interaction } from './environments';
import type { Cell } from './movement';
import type { ItemId } from './items';
import { ANIMA_NAMES, ANIMA_OWNERS, DUALS, SKILLS, canWear, manaMax, palaceGuards, type ClassId, type DualId, type DualSpec, type Improved, type PartySlot, type SkillId } from './battle.ts';
import { costOf, improvedBy, improvementOf, withinEcos, without } from './ecos.ts';
import { award, levelFlag, levelOf } from './levels.ts';
import type { ProfileId } from './stats';
import { BUBBLES, CARDS, HINTS, LEASH, LINES, PLACES, type CardId, type HintId } from './chapter-1.ts';
import { LINES_2, PLACES_2 } from './chapter-2.ts';
import { ANIMA_IDS, animaBonus, castleThreat, type AnimaId } from './animas.ts';
import { stationOf } from './transit.ts';
import { CALLE, FEARS, LINES_NURIA, MAZE, PLACES_NURIA, STREET, migrateBeaten, type FearEncounter } from './friends/nuria.ts';
import type { CatId } from './cats';
import { COSTS, DAY_END, DAY_START, EVENING, LATE, dusk, freshDays, readDays, spread, stage, type Activity, type Days } from './days.ts';
import { ENVIRONMENTS } from './environments.ts';

/** Keep in sync with STORY_FLAGS in server.py (a test checks it). */
export const STORY_FLAGS = [
  'intro', 'met-jan', 'got-shoes', 'got-potion', 'got-backpack', 'bernat-joined', 'bernat-stalled', 'dejavu',
  'minion', 'first-fight', 'palace', 'in-palace', 'got-chicle', 'matemagico', 'wrapper-room',
  'caught', 'got-wrapper',
  // Chapter 2 (docs/chapter-2.md): open progression, so these are never cleared.
  'tv-news', 'metro', 'rec-comtal', 'castle', 'palace-tried', 'clue-r4', 'anima-nuria',
  // Nuria's mission (docs/quests/nuria.md): Papagato is the party's for good.
  'papagato',
  // Ánima levels reached (src/levels.ts).
  'papagato-2', 'papagato-3', 'matemagico-2', 'matemagico-3',
  // Nuria's mission: out of the R4 at Cardedeu, Uri found and himself again, and the two lights
  // that went with Gerard and Aitor (docs/quests/nuria.md).
  'cardedeu', 'nuria-uri', 'luz-nuria', 'luz-uri',
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
export const LIGHTS = ['nuria', 'uri'] as const;
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
  | { type: 'battle'; won: boolean; encounter?: EncounterId; worn?: ClassId[]; xp?: number }
  /** The palace has finished rising over the north end of the street. */
  | { type: 'palace' }
  /** Gerard is (or is no longer) heading back south, away from the palace. */
  | { type: 'away'; away: boolean }
  /** Gerard stepped into a named room of the scene. */
  | { type: 'room'; id: string }
  /** An ánima woke up in Gerard, mid-fight (Matemágico, in the palace). */
  | { type: 'class'; id: GerardClass }
  /** The Queen's hands have caught Gerard and Bernat: the screen is black. */
  | { type: 'caught' }
  /** Gerard walked up to one of the story's triggers (`story.triggers`). */
  | { type: 'near'; id: string }
  /** The party came up out of a station after a trip. */
  | { type: 'arrive'; station: string };

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
  /** The camera turns to a named anchor of the scene (the palace), or back to Gerard without one. */
  | { kind: 'look'; anchor?: string }
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
  | { kind: 'shout'; speaker: 'uri'; text: string; beat?: number };

/** Scripted fights: the possessed street dogs, the palace minion that wakes Matemágico, and chapter 2's palace guards. */
export type EncounterId = 'dogs' | 'palace-minion' | 'palace-guards' | FearEncounter;
/** Classes (docs/party.md): unlocked by the story, shared by the whole party. */
/** The ánimas Gerard can wake (Tecnópata is Aitor's). */
export type GerardClass = Exclude<ClassId, 'tecnopata'>;

/** Someone standing in a scene: a character model, or one of the cats (`cat`). */
export interface StoryNpc { id: 'mama' | 'jan' | 'nuria' | 'uri' | 'haru' | 'yuki'; character: string; environment: EnvironmentId; cell: Cell; scale: number; cat?: CatId }
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
  get spread() { return this.adult ? spread(this.days.clock.day, this.animas.length) : 0; }
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
    if (id === 'portal-through' && this.nuria.lent) return this.enterMaze();
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
    this.nuria = freshRun();
    const door: StoryEffect = { kind: 'travel', environment: STREET, cell: { x: PLACES_NURIA.nuria.cell.x - 1, z: PLACES_NURIA.nuria.cell.z + 2 } };
    return [say(LINES_NURIA.won), door, say(LINES_NURIA.home), { kind: 'lights', people: ['nuria', 'uri'] }, { kind: 'anima', classId: 'papagato', kept: true }, ...this.spend('fight')];
  }
  /** What a fight's end means for the story, before any ánima grows. */
  private afterBattle(event: Extract<StoryEvent, { type: 'battle' }>): StoryEffect[] {
    const say = (dialogue: Dialogue): StoryEffect => ({ kind: 'dialogue', dialogue });
    if (event.won && event.encounter === 'uri-vertigo') return this.winNuria();
    const fear = FEARS.find(f => f.encounter === event.encounter);
    // A fear beaten stays beaten; its young only go for a while (the game brings them back).
    if (event.won && fear) { if (!fear.respawn && !this.nuria.beaten.includes(fear.id)) this.nuria.beaten.push(fear.id); return []; }
    if (!event.won) {
      if (!this.adult) return [];
      // Chapter 2: falling is waking up at home the next morning, with everything done kept.
      return this.endDay('fall');
    }
    if (event.encounter === 'palace-guards') return [say(LINES_2.guardsBeaten), ...this.spend('fight')];
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
    return (this.extras[member] ?? []).filter(id => this.classes.includes(id) && canWear(member, id) && this.fixedOf(member) !== id).slice(0, EXTRA_SLOTS);
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
    this.extras[member] = [...kept.slice(0, EXTRA_SLOTS - 1), classId];
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
    return environment === 'palacio' && !this.has('wrapper-room') ? [{ ...BACK_DOOR }] : [];
  }
  get items(): ItemId[] {
    // Waking up at 35, the dream's things stay in the dream; only the wrapper came back.
    if (this.adult) return this.has('got-wrapper') ? ['envoltorio'] : [];
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
  /** Hours go by: Aitor notices the evening, and at DAY_END the day is over wherever they are. */
  private spend(activity: Activity): StoryEffect[] {
    const before = this.days.clock.hour, after = Math.min(DAY_END, before + COSTS[activity]);
    this.days.clock = { ...this.days.clock, hour: after };
    if (after >= DAY_END) return this.endDay('night');
    if (before < LATE && after >= LATE) return [{ kind: 'dialogue', dialogue: LINES_2.late }];
    if (before < EVENING && after >= EVENING) return [{ kind: 'dialogue', dialogue: LINES_2.evening }];
    return [];
  }
  /**
   * The day is over (night came, they went to bed, or they fell): black, home, and the next
   * morning, when her power has spread a little more. If it has spread all the way, the flat
   * they wake up in is hers and the game is over.
   */
  private endDay(why: 'night' | 'sleep' | 'fall'): StoryEffect[] {
    const say = (dialogue: Dialogue): StoryEffect => ({ kind: 'dialogue', dialogue });
    // Whatever Nuria's mission had reached is undone: the cats went back to her.
    this.nuria = freshRun();
    const firstFall = why === 'fall' && this.set('palace-tried');
    this.days.clock = { day: this.days.clock.day + 1, hour: DAY_START };
    this.remember();
    const home: StoryEffect = { kind: 'travel', environment: PLACES.wakeUp.environment, cell: { ...PLACES.wakeUp.cell } };
    const before: StoryEffect[] = why === 'night' ? [say(LINES_2.night)] : why === 'sleep' ? [say(LINES_2.sleep)] : [];
    if (this.doomed) return [...before, { kind: 'fall' }, home, { kind: 'wake' }, say(LINES_2.doom), { kind: 'rise' }, { kind: 'doom' }];
    const morning = firstFall ? LINES_2.wakeFirst : LINES_2.morning[stage(this.spread)];
    return [...before, { kind: 'fall' }, home, { kind: 'wake' }, say(morning), { kind: 'rise' }];
  }
  /** Back to the morning before the end: that day's progress is lost, everything before it kept. */
  rewind(): StoryEffect[] {
    const target = this.days.mornings.find(m => m.day === this.days.clock.day - 1);
    if (!target) return [];
    this.flags.clear(); this.merge(target.story);
    this.days = { epoch: this.days.epoch + 1, clock: { day: target.day, hour: DAY_START }, mornings: this.days.mornings.filter(m => m.day <= target.day) };
    const home: StoryEffect = { kind: 'travel', environment: PLACES.wakeUp.environment, cell: { ...PLACES.wakeUp.cell } };
    return [home, { kind: 'wake' }, { kind: 'dialogue', dialogue: LINES_2.rewound }, { kind: 'rise' }];
  }
  /** Places the story watches in this scene (the TV that turned itself on). */
  triggers(environment: EnvironmentId): Trigger[] {
    const { tv } = PLACES_2;
    if (this.adult && !this.has('tv-news') && environment === tv.environment) return [{ id: 'tv', cell: { ...tv.cell }, radius: tv.radius }];
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
  /** Uri's fears still hunting the ramp (src/chasers.ts moves them; reaching Gerard is a `near` with their id). */
  fears(environment: EnvironmentId) {
    if (environment !== MAZE || !this.adult || !this.nuria.lent || this.has('nuria-uri')) return [];
    return FEARS.filter(f => !this.nuria.beaten.includes(f.id));
  }
  /** Where a door leads instead of its own destination, by story: the palace opens onto the school in chapter 2. */
  redirect(interactionId: string): { environment: EnvironmentId; cell: Cell } | undefined {
    if (interactionId === PALACE_EXIT && this.adult) return { environment: PLACES_2.school.environment, cell: { x: SCHOOL_DOOR.x, z: SCHOOL_DOOR.z + 1 } };
    if (interactionId === SCHOOL_WAY && this.adult) return { environment: 'palacio-patio', cell: { x: 17, z: 2 } };
    return undefined;
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
    if (this.adult) return this.nuriaNpcs().filter(npc => npc.environment === environment);
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
      if (id === 'meridiana-bed' && !this.adult) continue;
      list.push({ id, label, ...prompt, cell: { ...place.cell } });
    }
    if (this.adult && environment === STREET) {
      list.push({ id: 'talk-nuria', label: 'Hablar con Nuria', cell: { ...PLACES_NURIA.nuria.cell } });
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
    if (partner && this.partner === 'bernat') list.push({ id: 'talk-bernat', label: this.companion === 'stalled' ? 'Preguntarle a Bernat qué pasa' : 'Hablar con Bernat', hint: this.companion === 'stalled' ? 'Preguntar qué pasa' : undefined, cell: { x: Math.round(partner.x), z: Math.round(partner.z) } });
    return list;
  }
  /** A dialogue that stops a door from working, if the story is not ready for it. */
  gate(interactionId: string): Dialogue | undefined {
    if (interactionId === PALACE_EXIT) return this.has('wrapper-room') ? undefined : LINES.leaveLocked;
    // Inside the palace the school's doors open zone by zone; none of the zones can be won yet.
    if (interactionId === 'patio-gimnasio') return LINES_2.gymShut;
    if (interactionId === 'patio-secretaria') return LINES_2.officeShut;
    if (interactionId === 'secretaria-direccio') return LINES_2.directionShut;
    // The TV switched itself on when Gerard woke: Aitor will not go out before seeing it.
    if (interactionId === 'meridiana-door' && this.adult && !this.has('tv-news')) return LINES_2.doorBeforeNews;
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
      case 'near':
        if (event.id !== 'tv') return this.nearNuria(event.id);
        if (!this.adult || !this.set('tv-news')) return [];
        // The ticker carries the R4 clue: seen on the TV, it is known.
        this.set('clue-r4');
        return [{ kind: 'news' }, say(LINES_2.news)];
      case 'arrive':
        // Every trip takes its hour.
        if (event.station === 'trinitat-vella' && this.set('rec-comtal')) return [{ kind: 'look', anchor: 'palace' }, say(LINES_2.recComtalFirst), { kind: 'look' }, ...this.spend('metro')];
        if (event.station === 'cardedeu' && this.set('cardedeu')) return [say(LINES_NURIA.arrive), ...this.spend('metro')];
        return this.spend('metro');
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
        this.nuria = { ...freshRun(), lent: true, haru: true };
        this.lentBefore = true;
        if (!this.extrasOf('gerard').length) this.equip('gerard', 'papagato');
        return [say(again ? LINES_NURIA.nuriaAgain : LINES_NURIA.nuriaFirst), { kind: 'anima', classId: 'papagato' }];
      }
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
      case 'meridiana-tv':
        if (!this.adult) return [];
        if (this.set('tv-news')) { this.set('clue-r4'); return [{ kind: 'news' }, say(LINES_2.news)]; }
        return [{ kind: 'news' }, say(LINES_2.newsAgain)];
      case 'enter-school': {
        if (!this.adult) return [];
        const inside: StoryEffect = { kind: 'travel', environment: PLACES.palaceEntry.environment, cell: { ...PLACES.palaceEntry.cell } };
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
    // Down into a station: the first time, the city opens (the `metro` flag).
    const station = stationOf(event.id);
    // Leaving Cardedeu with Nuria's cats: Aitor asks first, and going hands them back.
    if (station === 'cardedeu' && this.nuria.lent) {
      if (!this.nuria.warned) { this.nuria.warned = true; return [say(LINES_NURIA.leaveWarn)]; }
      this.nuria = freshRun();
    }
    if (station && this.adult) return [...(this.set('metro') ? [say(LINES_2.metroFirst)] : []), { kind: 'metro', station }];
    if (event.id === 'look-curtain' && this.adult) return [say(LINES_2.curtain)];
    const look = PALACE_LOOKS.find(l => l.id === event.id);
    return look ? [say(look.dialogue)] : [];
  }
}
