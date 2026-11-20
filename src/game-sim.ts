/**
 * The whole game played headless (docs/game-sim.md): a player that walks the story from the first
 * morning to the end on a fixed route, with no screen. It drives the real story (`Story` in
 * src/story.ts, the same events the game sends), walks the real places' grids from door to door,
 * runs from the real chasers (src/chasers.ts, src/night.ts) and plays every fight with the fight
 * simulator's bots on the real rules (src/battle-sim.ts `playOut`). What it measures is the game as
 * a whole: how long it takes, where it is hard and where it has gone easy, when the ánimas stop
 * growing. `scripts/game-sim.mjs` is its command line; the picker shows its last report.
 *
 * The route is a list of goals, not a script: each turn of the loop asks the story what is left and
 * does the next thing, so a fall, a lost day or a rewind is picked up where it left the story.
 * Pure and seeded: the same player and seed play the same game.
 */
import { HOLD_SECONDS, NUCLI, PLACES_BERNAT, PORTAL_LEVELS } from './friends/bernat.ts';
import { DUALS, calibrate, createEncounter, dazzle, improve, palaceGuards, type ClassId, type Encounter } from './battle.ts';
import { BUILDS, MISSIONS, playOut, seeded, type MissionId, type Policy } from './battle-sim.ts';
import { createChaser, rest, updateChaser, type Chaser, type ChaserSpec } from './chasers.ts';
import { PLACES } from './chapter-1.ts';
import { PLACES_2 } from './chapter-2.ts';
import { DAY_END, NIGHT, stage } from './days.ts';
import type { Dialogue } from './dialogue';
import { costOf } from './ecos.ts';
import { ENVIRONMENTS, type EnvironmentId, type Interaction } from './environments.ts';
import { CAMP, CAMP_HUNTERS, PLACES_CAMP, PLACES_UNI, BEACH, TAG } from './friends/universidad.ts';
import { ALEGIA, CUERDAS_PLACE, PLACES_CUERDAS, PLACES_MARTA, QUALITIES } from './friends/marta.ts';
import { CALLE, MAZE, PLACES_NURIA, STREET } from './friends/nuria.ts';
import { MODELO_PLACE, PISO, PLACES_MODELO, PLACES_PISO, POBLE_SEC } from './friends/emilie.ts';
import { BEAM, DOOR as LUCA_DOOR, INTERIOR, MIRRORS, MIRRORS_SEEN, PLACES_LUCA, SAGRADA } from './friends/luca.ts';
import { trace as beamThrough, turned, type Facing } from './espejos.ts';
import { GALLERY, SECTION, WELLS, beat, calibration, charged, descend, measure, roaming, shake, stakeAt, tick, type ModeloState, type PatrolSpec } from './modelo.ts';
import { isTicketStation, ticketFlag, type TicketStation } from './tickets.ts';
import { LEVELLED, fightXp, participants, topOf } from './levels.ts';
import { canWalk, WALK_SPEED, type Cell } from './movement.ts';
import { FIRST_CLEAR, HIDING_KINDS, huntersGrid, litLamps, nightTier, risingAt } from './night.ts';
import { carriageway, createStreet, removeGroup, riseGroup, stepStreet, type HidingKind, type Street } from './night-pupils.ts';
import { createBoard } from './parcelas.ts';
import { CASTLE_FIGHTS, CASTLE_PHASES, castlePhaseAt, type NightFight } from './castle.ts';
import { aitorTaken } from './castle-fight.ts';
import { Story, WRAPPER_ROOM, type StoryEffect, type StoryEvent, type StoryFlag } from './story.ts';
import { STATION_PLACES, entranceId } from './transit.ts';

export const GAME_SIM_VERSION = 1;

/** How a simulated person plays: the fights' bot, the route's choices and how fast they go. */
export interface Player {
  id: string;
  name: string;
  /** How fights are played (`POLICIES` in src/battle-sim.ts). */
  policy: Policy;
  /** The friends' missions, in the order they are done. */
  order: MissionId[];
  /** Tries the castle as soon as the city opens: the fall the story expects (`palace-tried`). */
  castleFirst: boolean;
  /** What the Ecos de luz buy at the jar, in order (`BUILDS` in src/battle-sim.ts). */
  build: string;
  /** Who carries each shared ánima as an extra: Aitor (the dual party, Matemágico beside Papagato) or Gerard. */
  carrier: 'aitor' | 'gerard';
  /** Foes on their rounds: `fight` goes for the ones in the way (EXP), `avoid` runs past them. */
  engage: 'fight' | 'avoid';
  /** Fights with the tower's young on each ring, on top, for EXP. */
  grind: number;
  /** In the tower, the level the shared ánima is brought to with the young before going up (1: no grinding). */
  seekLevel: number;
  /** A mission lost this many times running is left for later, for another one first (the city is open). */
  patience: number;
  /** Losses to the same fight before it is played as someone who has understood it (`smart`): how people find a fight's answer. 0: never. */
  learnAfter: number;
  /** Seconds a turn of a fight takes to choose (fire burns meanwhile). */
  think: number;
  /** How much longer than the straight way a walk takes: looking round, wrong turns, stops. */
  pace: number;
  /** Seconds a first visit to a place adds: looking round it. */
  explore: number;
  /** Reading speed, characters a second. */
  read: number;
  /** Chance of each mistake in a puzzle (a wrong pitch, a wrong number, a fall off the strings). */
  slip: number;
  /** What Gerard does in the last scene, with her on the floor (docs/castle-bosses.md § The last scene). */
  ending: 'acabar' | 'bajar';
}
export const PLAYERS: Record<string, Player> = {
  pensando: {
    id: 'pensando', name: 'Pensando', policy: 'smart', order: ['nuria', 'universidad', 'emilie', 'luca', 'marta'], castleFirst: true, build: 'mixto',
    carrier: 'aitor', engage: 'fight', grind: 1, seekLevel: 2, patience: 2, learnAfter: 0, think: 4, pace: 1.5, explore: 40, read: 18, slip: .15, ending: 'bajar',
  },
  casual: {
    id: 'casual', name: 'Sin pensar', policy: 'casual', order: ['nuria', 'universidad', 'emilie', 'luca', 'marta'], castleFirst: true, build: 'nada',
    carrier: 'gerard', engage: 'fight', grind: 0, seekLevel: 1, patience: 3, learnAfter: 3, think: 3, pace: 1.6, explore: 30, read: 22, slip: .3, ending: 'acabar',
  },
  // The short missions first, straight after Nuria's: Emilie's and Luca's are met with a party that has grown little.
  corredor: {
    id: 'corredor', name: 'Con prisa', policy: 'smart', order: ['nuria', 'emilie', 'luca', 'marta', 'universidad'], castleFirst: false, build: 'elementos',
    carrier: 'aitor', engage: 'avoid', grind: 0, seekLevel: 1, patience: 2, learnAfter: 0, think: 2.5, pace: 1.25, explore: 10, read: 30, slip: .1, ending: 'acabar',
  },
};

export type TimeKind = 'walk' | 'read' | 'fight' | 'scene' | 'travel' | 'puzzle' | 'menu' | 'explore';
export const TIME_KINDS: Record<TimeKind, string> = {
  walk: 'Andar', read: 'Leer', fight: 'Combatir', scene: 'Escenas', travel: 'Metro y viajes', puzzle: 'Puzles', menu: 'Menús (bote, ánimas)', explore: 'Mirar alrededor',
};
/** Seconds each story beat takes on screen (src/main.ts `play`), roughly: what is not walking, reading or fighting. */
const BEAT: Partial<Record<StoryEffect['kind'], number>> = {
  item: 1.5, card: 4, minion: 6, palace: 8, gate: 2.5, travel: 1.2, snow: 2.5, drain: 5, ambush: 6, wake: 7, rise: 3, fall: 2.5,
  recover: 1, photo: 5, news: 25, look: 1.4, portal: 2.5, unmask: 6, emerge: 3, doom: 10, learn: 3, anima: 3, lights: 2, shout: .5, epilogue: 20,
};
/** A fight's way in and its result screen, on top of its own clock. */
const FIGHT_FRAME = 11;
/** The metro: the network map, choosing, the blackout and coming up. */
const RIDE = 10;
/** Dogs in chapter 1's pack (src/game.ts `pack`). */
const DOGS = 3;
/** Seconds the tower's young stay away after a fight before they walk their round again (src/game.ts RESPAWN). */
const RESPAWN = 40;
/** How far from the straight walk a hunted walk may go before the player is put where they were going (a stuck bot, logged). */
const LOST_AFTER = 420;
/** Story interactions that take the party to another place (src/story.ts), walked through like doors. */
const STORY_WAYS: Record<string, EnvironmentId> = {
  'salir-laberinto': CALLE, 'calle-tornar': STREET, 'salir-cuerdas': ALEGIA, 'enter-school': 'palacio',
  // Emilie's door on Margarit rings and takes them up; *Volver* out of her model is back at her desk.
  'poble-sec-emilie': PISO, 'salir-modelo': PISO,
};
/** The station each mission is reached by, for the first trip down the metro. */
const MISSION_STATIONS: Record<MissionId, string> = { nuria: 'cardedeu', universidad: 'barceloneta', marta: 'alegia', emilie: 'poble-sec', luca: 'sagrada-familia' };
/** Seconds a memory takes to write on a station's tablet for its ticket (src/tickets.ts); a faraway one asks for a moment too, half as long again. */
const MEMORY = 30;
/** A step of Emilie's section, as src/game.ts steps its patrols (`stepModelo`, 50 ms at a time). */
const SECTION_STEP = .05;
/** Seconds stopped at one of Emilie's stakes to measure it («Medir»). */
const MEASURE = 2;
/** Seconds the lift takes down one zone of her model, the section rising past them. */
const LIFT = 3;
/** Places whose grid changes as they are played (the strings over the void): walked as the crow flies, a little longer. */
const APPROXIMATE: ReadonlySet<EnvironmentId> = new Set([CUERDAS_PLACE]);
/** Running speed in cells a second (src/movement.ts WALK_SPEED, ×1.5 with the shoes). */
const RUN_SPEED = WALK_SPEED * 1.5;

/** One fight of a playthrough, with the party as it stood. */
export interface FightLog {
  n: number; t: number; day: number; hour: number; place: EnvironmentId; stage: string; encounter: string;
  won: boolean; draw: boolean; rounds: number; seconds: number; hpLeft: number; kos: number; xp: number;
  /** EXP lost to an ánima already at its top level. */
  wasted: number;
  /** Played as someone who has understood it, after losing to it enough (`learnAfter`). */
  learnt: boolean;
  /** It ended with the Queen holding Aitor: the loss the story asks for once (docs/castle-bosses.md § Aitor, held). */
  taken: boolean;
  levels: Partial<Record<ClassId, number>>; worn: ClassId[]; ecos: number; spent: number; friends: number;
  duals: number; biggest: number;
}
export type MomentKind = 'flag' | 'level' | 'day' | 'fall' | 'doom' | 'jar' | 'gap' | 'stuck' | 'end';
export interface Moment { t: number; day: number; hour: number; kind: MomentKind; label: string; flag?: StoryFlag; anima?: ClassId; level?: number }
export interface Playthrough {
  version: number; player: string; seed: number;
  /** Whether the route reached its end, and what stopped it. */
  finished: boolean; reason: string;
  /** Seconds a person would take, all told, and by kind. */
  seconds: number; time: Record<TimeKind, number>;
  /** Days in Barcelona (chapter 2) and how many were taken back by a rewind. */
  days: number; rewinds: number;
  fights: FightLog[]; moments: Moment[];
  /** What the route had to bridge because the game does not have it yet (the trip to Alegia…). */
  gaps: string[];
  flags: StoryFlag[]; levels: Partial<Record<ClassId, number>>; xp: Partial<Record<ClassId, number>>;
  ecos: number; improvements: string[]; duals: string[];
}

interface Spot { environment: EnvironmentId; cell: Cell }
interface Hunter { id: string; chaser: Chaser; respawn?: boolean; away: number; stare: number }
/** The night's street (src/night-pupils.ts) with its grates and the seconds to the next train. */
interface NightHunt { street: Street; grates: Cell[]; train: number }
/** A group of the night's pupils that reached the party: its fight is `night-<group>`. */
interface Caught { id: string; group: number }
/** Whoever is to be kept away from on a walk: a chaser, or one of the night's pupils. */
interface Threat { id: string; position: Cell; chasing: boolean }
type Goal = { cell: Cell; radius: number };

const key = (c: Cell) => `${c.x},${c.z}`;
const dist = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.hypot(a.x - b.x, a.z - b.z);
const round = (c: { x: number; z: number }): Cell => ({ x: Math.round(c.x), z: Math.round(c.z) });
/** Reading a dialogue: a moment per line and the text at the player's speed. */
const reading = (dialogue: Dialogue, cps: number) => dialogue.lines.reduce((sum, line) => sum + .8 + line.text.length / cps, 0);

/**
 * The shortest walk on a grid from `from` to any walkable cell within `goal.radius` of its cell,
 * four ways, as cells; `avoid` cells are kept off when there is another way. Undefined if none.
 */
export function pathOn(grid: readonly string[], from: Cell, goal: Goal, blocked: ReadonlySet<string> = new Set(), avoid: ReadonlySet<string> = new Set(), fallback = true): Cell[] | undefined {
  const start = round(from), rows = grid.length, cols = Math.max(...grid.map(r => r.length));
  const open = (c: Cell) => canWalk(c, grid) && !blocked.has(key(c));
  const isGoal = (c: Cell) => dist(c, goal.cell) <= goal.radius + .01 && (open(c) || key(c) === key(start));
  if (isGoal(start)) return [start];
  const back = new Map<string, string>(), queue: Cell[] = [start];
  back.set(key(start), '');
  for (let i = 0; i < queue.length; i++) {
    const at = queue[i];
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const next = { x: at.x + dx, z: at.z + dz };
      if (next.x < 0 || next.z < 0 || next.z >= rows || next.x >= cols || back.has(key(next)) || !open(next) || avoid.has(key(next))) continue;
      back.set(key(next), key(at));
      if (isGoal(next)) {
        const path: Cell[] = [next];
        for (let k = key(at); k; k = back.get(k)!) { const [x, z] = k.split(',').map(Number); path.unshift({ x, z }); }
        return path;
      }
      queue.push(next);
    }
  }
  return avoid.size && fallback ? pathOn(grid, from, goal, blocked) : undefined;
}

/** One playthrough: the story from the first morning, played by `player` with `seed`. */
export class Playing {
  readonly story = new Story();
  readonly out: Playthrough;
  at: Spot;
  private readonly random: () => number;
  private stageName = 'Capítulo 1';
  private trip?: string;
  private readonly seen = new Set<EnvironmentId>();
  private hunters: Hunter[] = [];
  private gone = new Set<string>();
  private hunt?: NightHunt;
  private lastDay = 1;
  private shoppedOn = 0;
  private fightsNow = 0;
  private stuckOn = '';
  private stuckCount = 0;
  /** Development: every step of the route and every walk, as text (`GAME_SIM_TRACE=1`). */
  trace?: (line: string) => void;
  /** Encounters lost to: their hunters are given a wide berth until the party grows (a level). */
  private feared = new Set<string>();
  /** Missions lost running, to leave one for later (`patience`). */
  private failures: Partial<Record<MissionId, number>> = {};
  /** Losses to each fight: after `learnAfter` of them it is played understood. */
  private losses: Record<string, number> = {};
  /** Every fall in each mission: people learn, so after two they grind a level more before going on (`seekLevel`). */
  private tries: Partial<Record<MissionId, number>> = {};
  /** The guards before the curtain beaten once: the castle's hall is crossed from then on (not a flag: the story only brings night). */
  private guardsBeaten = false;
  /** Whether each of Emilie's stakes is measured, for each run through her model, by whoever does not always stop for them (decided once). */
  private stakeChoices = new WeakMap<ModeloState, Map<string, boolean>>();
  readonly player: Player;
  readonly seed: number;
  readonly limits: { days: number; seconds: number; fights: number };
  /**
   * Rules tried without touching the game: `doom: false` plays with no end to her countdown (the
   * story never reaches a doomed morning), to see what the countdown does to a game.
   */
  readonly rules: { doom: boolean };
  constructor(player: Player, seed = 35, limits = { days: 60, seconds: 60 * 60 * 30, fights: 450 }, rules = { doom: true }) {
    this.player = player; this.seed = seed; this.limits = limits; this.rules = rules;
    if (!rules.doom) Object.defineProperty(this.story, 'doomed', { get: () => false });
    this.random = seeded(seed);
    const time = Object.fromEntries(Object.keys(TIME_KINDS).map(k => [k, 0])) as Record<TimeKind, number>;
    this.out = { version: GAME_SIM_VERSION, player: player.id, seed, finished: false, reason: '', seconds: 0, time, days: 1, rewinds: 0, fights: [], moments: [], gaps: [], flags: [], levels: {}, xp: {}, ecos: 0, improvements: [], duals: [] };
    this.at = { environment: PLACES.wake.environment as EnvironmentId, cell: { ...PLACES.wake.cell } };
    this.seen.add(this.at.environment);
  }

  // ── Time and what is noted ──────────────────────────────────────────────
  private spend(kind: TimeKind, seconds: number) { this.out.time[kind] += seconds; this.out.seconds += seconds; }
  private note(kind: MomentKind, label: string, extra: Partial<Moment> = {}) {
    const clock = this.story.clock;
    this.out.moments.push({ t: Math.round(this.out.seconds), day: this.story.adult ? clock.day : 0, hour: this.story.adult ? clock.hour : 0, kind, label, ...extra });
  }
  private gap(text: string) { if (!this.out.gaps.includes(text)) this.out.gaps.push(text); this.note('gap', text); }

  // ── The story ───────────────────────────────────────────────────────────
  /** Sends the story an event and plays what it answers, as src/main.ts does. */
  send(event: StoryEvent) {
    const before = new Set(this.story.saved), levels = { ...this.story.storyLevels };
    const effects = this.story.handle(event);
    this.noteChanges(before, levels);
    this.play(effects);
  }
  private noteChanges(before: Set<StoryFlag>, levels: Partial<Record<ClassId, number>>) {
    for (const flag of this.story.saved) if (!before.has(flag)) this.note('flag', flag, { flag });
    for (const [id, level] of Object.entries(this.story.storyLevels) as [ClassId, number][]) if (level > (levels[id] ?? 1)) this.note('level', `${id} ${level}`, { anima: id, level });
    const day = this.story.clock.day;
    if (this.story.adult && day !== this.lastDay) {
      if (day < this.lastDay) this.out.rewinds++;
      this.lastDay = day; this.out.days = Math.max(this.out.days, day);
      this.note('day', `Día ${day}`);
    }
  }
  private play(effects: StoryEffect[]) {
    for (const effect of effects) {
      switch (effect.kind) {
        case 'dialogue': this.spend('read', reading(effect.dialogue, this.player.read)); break;
        case 'travel': this.moveTo({ environment: effect.environment, cell: effect.cell }); this.spend('scene', BEAT.travel!); break;
        case 'battle': this.fight(effect.encounter, effect.night); break;
        case 'minion': this.spend('scene', BEAT.minion!); this.send({ type: 'minion' }); break;
        // An afternoon spent in bed, on the sofa, cooking, at the gym or with the choir: under the dark, it goes by.
        case 'evening': this.spend('scene', 3); this.send({ type: 'evening', what: effect.what }); break;
        case 'palace': this.spend('scene', BEAT.palace!); this.send({ type: 'palace' }); break;
        case 'ambush': this.spend('scene', BEAT.ambush!); this.send({ type: 'caught' }); break;
        case 'metro': this.ride(effect.station); break;
        case 'portal':
          this.spend('scene', BEAT.portal!);
          if (effect.who !== 'party' && effect.who !== 'everyone') this.story.sank(effect.who);
          break;
        case 'doom': {
          // Her castle covers everything: the only way on is back to the morning before (src/main.ts `theEnd`).
          this.spend('scene', BEAT.doom!); this.note('doom', 'La Reina lo cubre todo: vuelta a la mañana anterior');
          const before = new Set(this.story.saved), levels = { ...this.story.storyLevels }, effects = this.story.rewind();
          this.noteChanges(before, levels); this.play(effects);
          break;
        }
        case 'jar': this.shop(); break;
        // The last scene: two commands, no clock, and Gerard chooses (docs/castle-bosses.md § The last scene).
        case 'ending': this.spend('scene', 15); this.note('end', `Final: ${this.player.ending === 'acabar' ? 'Acabar' : 'Bajar la mano'}`); this.send({ type: 'ending', choice: this.player.ending }); break;
        case 'candado': this.padlock(); break;
        // Bernat's box (docs/quests/bernat.md): four sums of lights worked out on the moon, each held
        // five seconds, a wrong colour now and then, then the house's lamps going off one by one.
        case 'nucli-box': {
          const sums = PORTAL_LEVELS.length, tries = Math.round(sums * (1 + this.player.slip * 2 + this.random() * .5));
          this.spend('puzzle', sums * this.player.think * 12 + tries * (HOLD_SECONDS + 4) + 8);
          this.send({ type: 'portal' });
          break;
        }
        case 'parcelas': this.board(); break;
        default: this.spend('scene', BEAT[effect.kind] ?? 0);
      }
    }
  }

  // ── Places and walking ──────────────────────────────────────────────────
  private moveTo(spot: Spot) {
    if (spot.environment !== this.at.environment) { this.hunters = []; this.gone.clear(); this.hunt = undefined; }
    this.at = { environment: spot.environment, cell: { ...spot.cell } };
    this.story.inside = spot.environment;
    if (!this.seen.has(spot.environment)) { this.seen.add(spot.environment); this.spend('explore', this.player.explore); }
  }
  /** A place as it is today (the castle's floors are generated each day: `story.place`). */
  private place(environment: EnvironmentId) { return this.story.place(environment); }
  private get grid() { return this.place(this.at.environment).grid; }
  private blocked() { return new Set(this.story.blocked(this.at.environment).map(key)); }
  /**
   * Everything that can be used in a place now: its doors and things, and the story's own. The story's
   * version of a thing replaces the place's, as in src/game.ts `interactions` (her portal on Margarit
   * is rung in chapter 2, not looked at).
   */
  private usable(environment: EnvironmentId): Interaction[] {
    const told = this.story.interactions(environment);
    return [...this.place(environment).interactions.filter(i => !told.some(t => t.id === i.id)), ...told];
  }
  /** Where a door leads now, if it opens: the story may hold it shut or send it elsewhere. */
  private doorTo(interaction: Interaction): Spot | undefined {
    if (this.story.gate(interaction.id)) return undefined;
    return this.story.redirect(interaction.id) ?? interaction.to;
  }
  /** The places reachable on foot through doors, and the door to take first to reach `environment`. */
  private doorPath(to: EnvironmentId): Interaction[] | undefined {
    const back = new Map<EnvironmentId, { from: EnvironmentId; door: Interaction }>(), queue = [this.at.environment];
    const seen = new Set(queue);
    for (let i = 0; i < queue.length; i++) {
      const here = queue[i];
      if (here === to) {
        const doors: Interaction[] = [];
        for (let at = to; at !== this.at.environment; at = back.get(at)!.from) doors.unshift(back.get(at)!.door);
        return doors;
      }
      for (const door of this.usable(here)) {
        const next = this.doorTo(door) ?? (STORY_WAYS[door.id] ? { environment: STORY_WAYS[door.id] } : undefined);
        if (!next || seen.has(next.environment)) continue;
        seen.add(next.environment); back.set(next.environment, { from: here, door }); queue.push(next.environment);
      }
    }
    return undefined;
  }
  /**
   * Walks to `goal` in `environment`, from door to door if it is another place reachable on foot.
   * False if something on the way took the party elsewhere (a fight lost, a catch).
   */
  goTo(environment: EnvironmentId, goal: Goal): boolean {
    if (environment !== this.at.environment) {
      const doors = this.doorPath(environment);
      if (!doors) { this.gap(`Sin camino a pie hasta ${ENVIRONMENTS[environment].name}: se le pone allí`); this.moveTo({ environment, cell: goal.cell }); return true; }
      for (const door of doors) {
        const from = this.at.environment;
        if (!this.walk({ cell: door.cell, radius: 1.5 })) return false;
        this.use(door);
        if (this.at.environment === from) return false;
      }
    }
    return this.walk(goal);
  }
  /** Uses an interaction of this place as src/game.ts does: a door shut says why, a door travels, a thing talks, the rest is the story's. */
  private use(interaction: Interaction) {
    const gate = this.story.gate(interaction.id);
    const to = this.story.redirect(interaction.id) ?? interaction.to;
    if (gate) { this.spend('read', reading(gate, this.player.read)); return; }
    if (to) { this.moveTo(to); this.spend('scene', BEAT.travel!); if (interaction.id === 'meridiana-portal' && to.environment === 'meridiana') this.send({ type: 'home' }); return; }
    if (interaction.lines) { this.spend('read', interaction.lines.reduce((s, t) => s + .8 + t.length / this.player.read, 0)); return; }
    this.send({ type: 'interact', id: interaction.id });
  }
  /** Walks to an interaction (in this place or any other on foot) and uses it. */
  interact(id: string) {
    const here = this.usable(this.at.environment).find(i => i.id === id);
    const where = here ? this.at.environment : (Object.keys(ENVIRONMENTS) as EnvironmentId[]).find(env => this.usable(env).some(i => i.id === id));
    if (!where) { this.gap(`No existe la interacción «${id}»`); return; }
    const interaction = this.usable(where).find(i => i.id === id)!;
    if (this.goTo(where, { cell: interaction.cell, radius: 1.5 })) this.use(interaction);
  }
  /** Walks up to a story trigger (or any cell) and tells the story. */
  near(id: string, cell: Cell, radius = 1.5) {
    if (this.walk({ cell, radius })) this.send({ type: 'near', id });
  }
  /**
   * Walks to `goal` in this place. With nobody hunting it is the grid's shortest way at running speed
   * (times `pace`); with chasers about, it is played in small steps, dodging, and one that reaches the
   * party is its fight (or the game of tag's catch). `avoid`: cells kept off when there is another way
   * (a story trigger not to set off yet). Returns whether it got there.
   */
  walk(goal: Goal, avoid?: ReadonlySet<string>): boolean {
    this.refreshHunters();
    const speed = this.story.canRun ? RUN_SPEED : WALK_SPEED;
    if (!this.hunters.length && !this.hunt) {
      const path = APPROXIMATE.has(this.at.environment) ? undefined : pathOn(this.grid, this.at.cell, goal, this.blocked(), avoid);
      const cells = path ? path.length - 1 : dist(this.at.cell, goal.cell) * 1.3;
      if (!path && !APPROXIMATE.has(this.at.environment)) this.gap(`Sin camino en ${ENVIRONMENTS[this.at.environment].name}: se estima en línea recta`);
      this.spend('walk', cells / speed * this.player.pace);
      this.at.cell = path?.at(-1) ?? round(goal.cell);
      return true;
    }
    return this.huntedWalk(goal, speed);
  }
  /** How wide a berth a hunter is given: wide once it has beaten the party, a little by whoever runs past everything. */
  private dodgeOf(id: string) {
    const encounter = this.encounterOf(id);
    return encounter && this.feared.has(encounter) ? 6 : this.player.engage === 'avoid' ? 3.5 : 2;
  }
  /** Everyone to keep away from right now: the chasers about, and at night the pupils standing in the street. */
  private threats(): Threat[] {
    const out: Threat[] = this.hunters.filter(h => h.away <= 0).map(h => ({ id: h.id, position: h.chaser.position, chasing: h.chaser.mode === 'chase' }));
    for (const p of this.hunt?.street.pupils ?? []) {
      if (p.mode === 'rising' || p.mode === 'flat' || p.mode === 'resting' || p.mode === 'stunned') continue;
      out.push({ id: `night-${p.group}`, position: p.position, chasing: p.mode === 'chase' || p.mode === 'charge' || p.mode === 'windup' });
    }
    return out;
  }
  private encounterOf(id: string) {
    return this.story.fears(this.at.environment).find(f => f.id === id)?.encounter ?? (id.startsWith('night-') ? 'night-guard' : undefined);
  }
  /**
   * A walk with chasers about, in small steps: each step goes where the way to `goal` shortens most
   * (a distance field over the grid) and away from whoever is close, the more so the closer, the one
   * that beat the party before most of all (`dodgeOf`). One that reaches the party is its fight, or
   * the game of tag's catch. `target`: a hunter walked at on purpose (EXP), which nobody dodges.
   */
  private huntedWalk(goal: Goal, speed: number, target?: Hunter): boolean {
    const blocked = this.blocked(), grid = this.grid, dt = 1 / speed;
    this.trace?.(`  walk ${this.at.environment} ${key(this.at.cell)} → ${key(round(goal.cell))} r${goal.radius}${target ? ` at ${target.id}` : ''} among ${this.hunters.filter(h => h.away <= 0).map(h => `${h.id}@${key(round(h.chaser.position))}`).join(' ')}`);
    let at = round(this.at.cell), walked = 0, field = this.field(goal, blocked), fieldAt = 0, best = Infinity, since = 0;
    const open = (c: Cell) => canWalk(c, grid) && !blocked.has(key(c));
    // A hunter walked at is given up on after a minute: it may keep out of reach.
    while (walked < (target ? 60 : LOST_AFTER)) {
      // A goal that moves (a hunter walked at) has its field again every second.
      if (target && walked - fieldAt >= 1) { goal = { cell: round(target.chaser.position), radius: goal.radius }; field = this.field(goal, blocked); fieldAt = walked; best = Infinity; }
      const here = field.get(key(at));
      // No way there from here (a hunter behind a wall, a goal off the grid).
      if (here === undefined) { if (target) break; this.trace?.(`  no way from ${key(at)}`); break; }
      if (here === 0 && !target) { this.at.cell = at; return true; }
      if (here < best) { best = here; since = 0; } else since += dt;
      // Stuck behind someone for a while: they matter less and less, so the walk goes on. One only walking its round is waited out longer.
      const threats = this.threats().filter(t => t.id !== target?.id);
      const chased = threats.some(t => t.chasing && dist(t.position, at) < 12);
      const nerve = Math.max(0, 1 - since / (chased ? 10 : 45));
      let pick = at, score = Infinity;
      for (const [dx, dz] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const next = { x: at.x + dx, z: at.z + dz };
        if ((dx || dz) && !open(next)) continue;
        const left = field.get(key(next));
        if (left === undefined) continue;
        let danger = 0;
        for (const t of threats) {
          const d = dist(t.position, next), reach = this.dodgeOf(t.id) * (t.chasing ? 1.5 : 1);
          if (d < reach * 2.5) danger += (reach / Math.max(d - .4, .25)) ** 2;
        }
        const value = left + (dx || dz ? 0 : .5) + danger * nerve * .8;
        if (value < score) { score = value; pick = next; }
      }
      const heading = { x: pick.x - at.x, z: pick.z - at.z };
      at = pick;
      walked += dt;
      this.spend('walk', dt * this.player.pace);
      // Walking into the one gone after is meeting it, whatever it was doing.
      const caught = this.stepHunters(at, dt, heading, speed > WALK_SPEED) ?? (target && target.away <= 0 && dist(target.chaser.position, at) <= 1 ? target : undefined);
      if (caught) {
        const environment = this.at.environment;
        this.at.cell = at;
        this.send({ type: 'near', id: caught.id });
        // A fight lost, a catch in the game of tag: the story has put them somewhere else.
        if (this.at.environment !== environment || key(this.at.cell) !== key(at)) return false;
        // A group of the night beaten is off the street; the others hunt on.
        if ('group' in caught) { if (this.hunt) removeGroup(this.hunt.street, caught.group); }
        else if (caught.respawn) { caught.away = RESPAWN; caught.chaser = createChaser(caught.chaser.spec); }
        else this.gone.add(caught.id);
        this.refreshHunters();
        if (caught === target) return true;
        best = Infinity;
      }
    }
    this.at.cell = at;
    if (target) return true;
    this.trace?.(`  stuck at ${key(at)} field ${field.get(key(at))} after ${walked.toFixed(0)}s`);
    this.gap(`Atascado andando por ${ENVIRONMENTS[this.at.environment].name}: se le pone donde iba`);
    this.at.cell = round(goal.cell);
    return true;
  }
  /** Steps left from every cell of this place to `goal`: what a walk follows down. */
  private field(goal: Goal, blocked: ReadonlySet<string>) {
    const grid = this.grid, out = new Map<string, number>(), queue: Cell[] = [];
    const g = round(goal.cell), r = Math.ceil(goal.radius);
    for (let x = g.x - r; x <= g.x + r; x++) for (let z = g.z - r; z <= g.z + r; z++) {
      const c = { x, z };
      if (dist(c, goal.cell) <= goal.radius + .01 && canWalk(c, grid) && !blocked.has(key(c))) { out.set(key(c), 0); queue.push(c); }
    }
    if (!queue.length && canWalk(g, grid)) { out.set(key(g), 0); queue.push(g); }
    for (let i = 0; i < queue.length; i++) {
      const at = queue[i], d = out.get(key(at))!;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const next = { x: at.x + dx, z: at.z + dz };
        if (out.has(key(next)) || !canWalk(next, grid) || blocked.has(key(next))) continue;
        out.set(key(next), d + 1); queue.push(next);
      }
    }
    return out;
  }
  /**
   * Moves every hunter a step; the one that reaches the party, if any. At night the street's pupils
   * hunt by their own rules (src/night-pupils.ts): `heading` and `running` are how the party moves,
   * which they hear and head off. The simulated player never stops to hide.
   */
  private stepHunters(pos: { x: number; z: number }, dt: number, heading: Cell = { x: 0, z: 0 }, running = false): Hunter | Caught | undefined {
    for (const h of this.hunters) {
      if (h.away > 0) { h.away -= dt; continue; }
      if (h.stare > 0) { h.stare -= dt; continue; }
      const event = updateChaser(h.chaser, dt, pos, this.grid);
      if (event === 'caught' || dist(h.chaser.position, pos) <= TAG.reach && h.chaser.spec.relentless) { rest(h.chaser); return h; }
    }
    const night = this.hunt;
    if (!night) return undefined;
    night.train -= dt;
    if (night.train <= 0) { night.train = night.street.tier.trainEvery; this.rise(night, night.street.tier.perTrain, pos); }
    const moving = heading.x !== 0 || heading.z !== 0;
    const events = stepStreet(night.street, dt, { position: pos, pace: !moving ? 'still' : running ? 'run' : 'walk', heading, still: 0 });
    const caught = events.find(e => e.type === 'caught');
    return caught && { id: `night-${caught.pupil.group}`, group: caught.pupil.group };
  }
  /** Who is hunting this place now, by the story: the tower's fears, the campsite's rounds, the friends playing tag, the castle's pupils at night. */
  private refreshHunters() {
    const env = this.at.environment, wanted = new Map<string, ChaserSpec & { respawn?: boolean; stare?: number }>();
    for (const fear of this.story.fears(env)) wanted.set(fear.id, { id: fear.id, patrol: fear.patrol, sight: fear.sight, walk: fear.walk, run: fear.run, respawn: fear.respawn });
    for (const friend of this.story.uniChasers(env)) if (!friend.frozen) wanted.set(friend.id, { id: friend.id, patrol: friend.patrol, sight: friend.sight, walk: friend.walk, run: friend.run, relentless: true, stare: TAG.stare });
    this.hunters = this.hunters.filter(h => wanted.has(h.id) && !this.gone.has(h.id));
    for (const [id, spec] of wanted) if (!this.gone.has(id) && !this.hunters.some(h => h.id === id)) this.hunters.push({ id, chaser: createChaser(spec), respawn: spec.respawn, away: 0, stare: spec.stare ?? 0 });
    // At night on the Meridiana the castle's pupils climb out of the grates (src/game.ts `huntAtNight`).
    if (env === 'meridiana-calle' && this.story.night && !this.hunt) {
      const environment = ENVIRONMENTS[env], tier = nightTier(stage(this.story.spread));
      const cellOf = (p: { x: number; z: number }) => ({ x: p.x, z: p.z });
      const portal = environment.interactions.find(i => i.id === 'meridiana-portal')?.cell ?? environment.spawn;
      this.hunt = {
        train: tier.trainEvery,
        grates: environment.props.filter(p => p.kind === 'grate').map(cellOf),
        street: createStreet({
          tier, phase: castlePhaseAt(this.story), portal, grid: huntersGrid(environment.grid, portal),
          lamps: litLamps(environment.props.filter(p => p.kind === 'lamp').map(cellOf), tier),
          covers: environment.props.filter(p => (HIDING_KINDS as readonly string[]).includes(p.kind)).map(p => ({ x: p.x, z: p.z, kind: p.kind as HidingKind })),
          road: carriageway(environment.geo?.roads ?? []),
        }),
      };
      this.rise(this.hunt, tier.hunters, this.at.cell, FIRST_CLEAR);
    }
    if (!this.story.night) this.hunt = undefined;
  }
  private rise(night: NightHunt, count: number, from: { x: number; z: number }, clear?: number) {
    for (const cell of risingAt(night.grates, round(from), count, clear)) if (!riseGroup(night.street, cell).length) return;
  }
  /** Goes after a hunter on purpose (EXP): walks at it until it is met. */
  private seek(hunter: Hunter) {
    const encounter = this.encounterOf(hunter.id);
    if (encounter && this.feared.has(encounter)) return;
    if (!this.hunters.includes(hunter) || hunter.away > 0) return;
    this.huntedWalk({ cell: round(hunter.chaser.position), radius: .9 }, this.story.canRun ? RUN_SPEED : WALK_SPEED, hunter);
  }

  // ── Fights ──────────────────────────────────────────────────────────────
  /** A story fight: the party exactly as the story has it, played to its end by the player's bot. */
  private fight(encounter: string, night?: NightFight) {
    const story = this.story, before = { ...story.storyLevels };
    const state = createEncounter(story.battleParty(true), encounter as Encounter, {
      foeCount: DOGS, possessed: story.possessed, animas: story.classes, guards: palaceGuards(story.animas.length), night, random: this.random,
    });
    state.levels = story.levels;
    improve(state, story.improved);
    // What was measured on the way down Emilie's model calibrates El que no converge (src/game.ts `setBattle`);
    // the light the nave's mirrors bring to the chairs dazzles the chaplains (src/main.ts `onEncounter`).
    if (encounter === 'no-converge' && this.at.environment === MODELO_PLACE) calibrate(state, calibration(story.modeloRun()));
    if (story.dazzled(encounter)) dazzle(state);
    state.seed = Math.floor(this.random() * 2 ** 32) >>> 0;
    const learnt = this.player.learnAfter > 0 && (this.losses[encounter] ?? 0) >= this.player.learnAfter;
    const run = playOut(state, { fight: encounter, party: '', policy: learnt ? 'smart' : this.player.policy, think: this.player.think, maxRounds: 80 }, this.random);
    const won = run.outcome === 'won', worn = participants(state).map(p => p.id), xp = fightXp(state);
    if (won && encounter === 'palace-guards') this.guardsBeaten = true;
    const wasted = won ? worn.filter(id => LEVELLED.includes(id) && (before[id] ?? 1) >= topOf(id)).length * xp : 0;
    const clock = story.clock;
    this.out.fights.push({
      n: this.out.fights.length + 1, t: Math.round(this.out.seconds), day: story.adult ? clock.day : 0, hour: story.adult ? clock.hour : 0,
      place: this.at.environment, stage: this.stageName, encounter, won, draw: run.outcome === 'draw', rounds: run.rounds, seconds: Math.round(run.seconds),
      hpLeft: Number(run.hpLeft.toFixed(3)), kos: run.kos, xp, wasted, learnt, taken: aitorTaken(state), levels: { ...story.levels }, worn,
      ecos: story.ecos, spent: costOf(story.improvements), friends: story.animas.length, duals: run.duals, biggest: run.biggest,
    });
    this.spend('fight', run.seconds + FIGHT_FRAME);
    // A dual that went off is found (src/story.ts `discover`): it shows in the ánimas' lists from then on.
    for (const id of Object.keys(run.used)) if (DUALS.some(d => d.id === id)) this.story.discover(id as (typeof DUALS)[number]['id']);
    this.fightsNow++;
    if (!won) { this.feared.add(encounter); this.losses[encounter] = (this.losses[encounter] ?? 0) + 1; if (story.adult) this.note('fall', `Caen ante ${encounter}`); }
    this.send({ type: 'battle', won, encounter: encounter as never, worn, xp, ...aitorTaken(state) ? { taken: true } : {} });
    // Grown, they dare again.
    if (Object.entries(story.storyLevels).some(([id, level]) => level > (before[id as ClassId] ?? 1))) this.feared.clear();
  }

  // ── Home: the jar and who carries what ──────────────────────────────────
  /** At the jar: the ecos go where the player's build says, in its order, while they pay. */
  private shop() {
    const list = BUILDS[this.player.build] ?? [];
    const bought: string[] = [];
    for (const id of list) if (this.story.improve(id)) bought.push(id);
    this.spend('menu', 10 + 4 * bought.length);
    this.shoppedOn = this.story.clock.day;
    if (bought.length) this.note('jar', `Bote: ${bought.join(', ')}`);
  }
  /** Puts each shared ánima on whoever the player has carry it, as the status screen would. */
  private dress() {
    if (!this.story.adult) return;
    const s = this.story, own = [s.fixedOf('gerard'), s.fixedOf('aitor')];
    // The newest shared ánimas the slots hold, taking turns: the first to the carrier, the next to the other, and so on.
    const shared = s.classes.filter(id => !own.includes(id)).slice(-2 * s.extraSlots);
    const first = this.player.carrier, second = first === 'aitor' ? 'gerard' : 'aitor';
    let changed = false;
    shared.forEach((id, i) => {
      const member = i % 2 ? second : first;
      if (s.extrasOf(member).includes(id)) return;
      const who = s.wearerOf(id);
      if (who && who !== member && s.extrasOf(who).includes(id)) s.unequip(who, id);
      changed = s.equip(member, id) || changed;
    });
    if (changed) this.spend('menu', 8);
  }

  // ── Travelling ──────────────────────────────────────────────────────────
  /** Down into the nearest station and up at `station`'s. Alegia has no way there yet: bridged, logged. */
  private travelTo(station: string) {
    const place = STATION_PLACES[station];
    if (!place || this.at.environment === place.environment) return;
    // The station of this place, or the nearest one on foot (out of the castle, the Rec Comtal's).
    const stations = Object.keys(STATION_PLACES);
    const from = stations.find(id => STATION_PLACES[id].environment === this.at.environment) ?? stations.find(id => this.doorPath(STATION_PLACES[id].environment)) ?? 'fabra-i-puig';
    this.trip = station;
    this.interact(entranceId(from));
    if (this.trip) { this.gap(`El metro no lleva de ${from} a ${station}`); this.moveTo({ environment: place.environment, cell: this.entrance(station) }); this.trip = undefined; }
  }
  private entrance(station: string): Cell {
    const place = STATION_PLACES[station];
    return { ...ENVIRONMENTS[place.environment].interactions.find(i => i.id === entranceId(station))!.cell };
  }
  /** The metro map: the trip chosen beforehand (`trip`), its ticket if it has none yet, its blackout and the hour it takes. */
  private ride(from: string) {
    const to = this.trip;
    this.trip = undefined;
    this.spend('travel', RIDE);
    if (!to || to === from) return;
    // A station no memory has opened is not a destination yet (src/travel-ui.ts): its memory is written under the map first.
    if (isTicketStation(to) && !this.has(ticketFlag(to))) this.remember(to);
    this.moveTo({ environment: STATION_PLACES[to].environment, cell: this.entrance(to) });
    this.send({ type: 'arrive', station: to, from });
  }
  /**
   * A memory written on the station's tablet (src/tickets.ts): its person in its place, and for a
   * faraway one a moment with them. A slip is a blank or half a ticket and another try. The server's
   * judgement is not played: the memory the route needs is taken as written.
   */
  private remember(station: TicketStation) {
    let tries = 1;
    while (this.random() < this.player.slip && tries < 4) tries++;
    this.spend('puzzle', MEMORY * tries * (station === 'alegia' ? 1.5 : 1));
    this.send({ type: 'ticket', station });
  }
  /** Home from wherever: the metro to Fabra i Puig and the walk to the portal (at night, hunted). */
  private goHome() {
    if (this.at.environment === 'meridiana') return;
    // Out of Las cuerdas the party is back in Alegia's street; the long-distance train brings it home.
    if (this.at.environment === CUERDAS_PLACE) this.moveTo({ environment: ALEGIA, cell: { x: PLACES_MARTA.back.x + 4, z: PLACES_MARTA.back.z + 2 } });
    // Out of Emilie's model by *Volver*, behind where they landed, past whatever roams El suelo.
    if (this.at.environment === MODELO_PLACE && !this.leaveModelo()) return;
    if (this.at.environment !== 'meridiana-calle') this.travelTo('fabra-i-puig');
    if (this.at.environment !== 'meridiana-calle') { this.gap('Sin camino a casa: se le pone en casa'); this.moveTo({ environment: 'meridiana', cell: { ...PLACES.wakeUp.cell } }); return; }
    const environment = this.at.environment, day = this.story.clock.day;
    this.interact('meridiana-portal');
    // Caught and beaten on the way home, they wake the next day; otherwise through the portal they are home.
    if (this.story.clock.day !== day || this.at.environment !== environment) return;
  }

  // ── The route ───────────────────────────────────────────────────────────
  /** Plays until the route's end or a limit. */
  playAll(): Playthrough {
    this.send({ type: 'start' });
    for (let turn = 0; turn < 4000; turn++) {
      if (this.out.days > this.limits.days) { this.stop(false, `Más de ${this.limits.days} días`); break; }
      if (this.out.seconds > this.limits.seconds) { this.stop(false, 'Más tiempo del razonable'); break; }
      if (this.out.fights.length > this.limits.fights) { this.stop(false, 'Demasiados combates'); break; }
      const step = this.next();
      if (!step) break;
      const mark = `${step.name}|${this.story.saved.length}|${this.story.clock.day}|${this.story.clock.hour}|${this.at.environment}|${this.fightsNow}`;
      if (mark === this.stuckOn) { if (++this.stuckCount > 6) { this.stop(false, `Atascado en «${step.name}»`); break; } } else { this.stuckOn = mark; this.stuckCount = 0; }
      this.trace?.(`[${Math.round(this.out.seconds)}s d${this.story.clock.day} ${this.story.clock.hour}h ${this.at.environment} ${key(this.at.cell)}] ${step.name}`);
      step.run();
    }
    if (!this.out.reason) this.stop(true, 'Fin de la ruta');
    return this.finish();
  }
  private stop(finished: boolean, reason: string) {
    this.out.finished = finished; this.out.reason = reason;
    this.note(finished ? 'end' : 'stuck', reason);
  }
  private finish(): Playthrough {
    const story = this.story;
    Object.assign(this.out, {
      seconds: Math.round(this.out.seconds), flags: story.saved, levels: { ...story.storyLevels }, xp: { ...story.xp },
      ecos: story.ecos, improvements: story.improvements, duals: story.duals,
    });
    for (const k of Object.keys(this.out.time) as TimeKind[]) this.out.time[k] = Math.round(this.out.time[k]);
    return this.out;
  }
  private has(flag: StoryFlag) { return this.story.has(flag); }
  /** The next thing to do, from where the story is. Undefined at the route's end. */
  private next(): { name: string; run: () => void } | undefined {
    const s = this.story, step = (name: string, run: () => void) => ({ name, run });
    if (!s.adult) return this.chapter1();
    this.stageName = 'Despertar';
    if (!this.has('got-wrapper')) return step('El envoltorio', () => this.interact('take-envoltorio'));
    if (!this.has('got-bola')) return step('La bola de nieve', () => this.interact('take-bola'));
    if (!this.has('tv-news')) return step('Las noticias', () => { if (this.goTo('meridiana', { cell: PLACES_2.tv.cell, radius: PLACES_2.tv.radius })) this.send({ type: 'near', id: 'tv' }); });
    // Below El suelo in Emilie's model there is no way out but down (src/game.ts offers *Volver* only up there): the night goes on to its bottom.
    if (s.night && this.at.environment === MODELO_PLACE && s.modeloRun().zone !== 'suelo') return step(MISSIONS.emilie.name, () => this.mission('emilie'));
    if (s.night) return step('Vuelta a casa de noche', () => { this.stageName = 'Vuelta a casa'; this.goHome(); });
    if (this.at.environment === 'meridiana' && s.ecosFree > 0 && this.shoppedOn !== s.clock.day) return step('El bote', () => this.interact('meridiana-luces'));
    // Looking round the flat on a morning, the photo in the dining corner with Luca gone grey: with the ticker, Aitor puts them together.
    if (this.at.environment === 'meridiana' && this.player.order.includes('luca') && !this.has('clue-luca-foto') && !this.has('sagrada-luca')) return step('La foto de Luca', () => this.interact('meridiana-foto-luca'));
    this.dress();
    if (!this.has('metro')) return step('Primer metro', () => {
      this.stageName = 'La ciudad';
      const first = this.player.order[0];
      this.trip = this.player.castleFirst ? 'trinitat-vella' : first ? MISSION_STATIONS[first] : undefined;
      this.interact(entranceId('fabra-i-puig'));
    });
    if (this.player.castleFirst && !this.has('palace-tried')) return step('El castillo, la primera vez', () => this.castleTry());
    const open = this.player.order.filter(id => !this.missionDone(id));
    const mission = open.find(id => (this.failures[id] ?? 0) < this.player.patience) ?? open.sort((a, b) => (this.failures[a] ?? 0) - (this.failures[b] ?? 0))[0];
    if (mission) return step(MISSIONS[mission].name, () => this.mission(mission));
    if (s.clock.hour >= NIGHT - 1 || s.clock.hour >= DAY_END) return step('A casa a dormir', () => this.sleep());
    return this.castle();
  }
  /** Whether a friend's mission is won: the flag its win sets (src/story.ts `winNuria`, `winUni`, `winMarta`, `winEmilie`, `winLuca`). */
  private missionDone(id: MissionId) {
    return this.has(({ nuria: 'nuria-uri', universidad: 'sobremesa', marta: 'voz', emilie: 'converge', luca: 'fran' } as const satisfies Record<MissionId, StoryFlag>)[id]);
  }
  /** Chapter 1, the childhood prologue: its beats in order (tests/story.test.mjs plays the same). */
  private chapter1() {
    const step = (name: string, run: () => void) => ({ name, run });
    this.stageName = 'Capítulo 1';
    if (!this.has('met-jan')) return step('Jan', () => this.interact('talk-jan'));
    if (!this.has('got-potion')) return step('La poción', () => this.interact('take-pocion'));
    if (!this.has('got-shoes')) return step('Mamá', () => this.interact('talk-mama'));
    if (!this.has('got-backpack')) return step('La mochila', () => this.interact('take-mochila'));
    if (!this.has('bernat-joined')) return step('Bernat', () => this.interact('call-bernat'));
    if (!this.has('bernat-stalled')) return step('Bernat se planta', () => { this.goTo('maresme', { cell: { x: 15, z: PLACES.southRow }, radius: 3 }); this.send({ type: 'south' }); });
    if (!this.has('dejavu')) return step('Déjà vu', () => { for (let i = 0; i < 3; i++) this.send({ type: 'leash' }); this.send({ type: 'interact', id: 'talk-bernat' }); });
    if (!this.has('first-fight')) return step('Los perros', () => { this.goTo('maresme', { cell: PLACES.minion.manhole, radius: 4 }); this.fight('dogs'); });
    if (!this.has('in-palace')) return step('El palacio', () => this.interact('enter-palace'));
    if (!this.has('got-chicle')) return step('El chicle', () => this.interact('take-chicle'));
    if (!this.has('wrapper-room')) return step('Sala de los Envoltorios', () => {
      const room = ENVIRONMENTS.palacio.palace?.rooms.find(r => r.name === WRAPPER_ROOM) ?? ENVIRONMENTS.palacio.rooms?.find(r => r.name === WRAPPER_ROOM);
      if (room) this.goTo('palacio', { cell: { x: Math.round(room.x + room.w / 2), z: Math.round(room.z + room.d / 2) }, radius: 3 });
      // Matemágico wakes in the middle of this fight (the beat Bernat begs for): the party has it from its first turn here.
      const effects = this.story.handle({ type: 'room', id: WRAPPER_ROOM });
      this.send({ type: 'class', id: 'matemagico' });
      this.play(effects);
    });
    return undefined;
  }
  /** The castle the first time: the guards before the curtain, far too strong without ánimas (the fall the story expects). */
  private castleTry() {
    this.stageName = 'El castillo';
    this.travelTo('trinitat-vella');
    if (this.at.environment !== 'rec-comtal') return;
    this.interact('enter-school');
    this.interact('challenge-guards');
  }
  private sleep() {
    const day = this.story.clock.day;
    this.goHome();
    // Home by day, they lie down a while (which brings the night) and then sleep; home at night the day is already over.
    if (this.story.clock.day !== day || this.at.environment !== 'meridiana') return;
    if (!this.story.night) this.interact('meridiana-bed');
    if (this.story.clock.day === day && this.story.night) this.interact('meridiana-bed');
  }
  /** One go at a friend's mission, from wherever the story has it. */
  private mission(id: MissionId) {
    this.stageName = MISSIONS[id].name;
    const lost = this.out.fights.filter(f => !f.won).length;
    ({ nuria: () => this.nuria(), universidad: () => this.uni(), marta: () => this.marta(), emilie: () => this.emilie(), luca: () => this.luca() } satisfies Record<MissionId, () => void>)[id]();
    // A fight lost is a go lost at this mission (the day ends, or her castle takes it back). Won, every mission's count starts again.
    if (this.missionDone(id)) this.failures = {};
    else if (this.out.fights.filter(f => !f.won).length > lost) { this.failures[id] = (this.failures[id] ?? 0) + 1; this.tries[id] = (this.tries[id] ?? 0) + 1; }
  }
  private nuria() {
    const run = this.story.nuria;
    if (![STREET, CALLE, MAZE].includes(this.at.environment)) this.travelTo('cardedeu');
    if (this.at.environment === STREET && !run.lent) {
      if (!run.haru) this.near('haru', PLACES_NURIA.haru.cell, PLACES_NURIA.haru.radius);
      const guide = this.story.guide(STREET);
      if (guide && guide.arrive === 'haru-home') this.near('haru-home', guide.to);
      this.interact('talk-nuria');
      return;
    }
    if (this.at.environment === STREET && run.lent && !run.street) {
      this.walk({ cell: PLACES_NURIA.corner.cell, radius: 2 });
      this.send({ type: 'near', id: 'calle' });
      this.moveTo({ environment: CALLE, cell: PLACES_NURIA.calleIn.cell });
      return;
    }
    if (this.at.environment === STREET) { this.walk({ cell: PLACES_NURIA.corner.cell, radius: 2 }); this.moveTo({ environment: CALLE, cell: PLACES_NURIA.calleIn.cell }); return; }
    if (this.at.environment === CALLE) {
      const { portal } = PLACES_NURIA;
      if (!run.portal) this.near('portal', portal.cell, portal.radius);
      this.near('portal-through', portal.cell, portal.through);
      return;
    }
    // The tower: Uri ahead on each ring; on the way, the fears (and the young, for EXP).
    const ring = run.stage;
    if (this.player.engage === 'fight') {
      this.refreshHunters();
      const reach = (h: Hunter) => pathOn(this.grid, this.at.cell, { cell: round(h.chaser.position), radius: 1 })?.length ?? 999;
      // The young first, up to the level the player wants before the fears (they come back, so there is always one).
      const young = () => this.hunters.filter(h => h.respawn && h.away <= 0 && this.encounterOf(h.id)?.startsWith('crias') && reach(h) < 250).sort((a, b) => reach(a) - reach(b))[0];
      const shared = () => Math.max(1, ...this.story.classes.filter(id => LEVELLED.includes(id)).map(id => this.story.storyLevels[id] ?? 1));
      const wanted = Math.min(topOf('papagato'), this.player.seekLevel + Math.floor((this.tries.nuria ?? 0) / 2));
      for (let i = 0; i < 16 && shared() < wanted; i++) { const h = young(); if (!h) break; this.seek(h); if (this.at.environment !== MAZE) return; }
      for (let i = 0; i < this.player.grind; i++) { const h = young(); if (!h) break; this.seek(h); if (this.at.environment !== MAZE) return; }
      const near = this.hunters.filter(h => !h.respawn && h.away <= 0 && reach(h) < 40);
      for (const h of near) { this.seek(h); if (this.at.environment !== MAZE) return; }
    }
    const uri = PLACES_NURIA.uri[ring];
    if (uri) { this.walk({ cell: uri.cell, radius: uri.radius }); if (this.at.environment === MAZE && this.story.nuria.stage === ring) this.send({ type: 'near', id: `uri-${ring}` }); return; }
    const { summit } = PLACES_NURIA;
    this.near('summit', summit.cell, summit.radius);
  }
  private uni() {
    const run = this.story.uni;
    if (!this.has('clue-uni') && !this.has('barceloneta-uni')) { this.gap('Nadie ha dicho aún lo de la playa: se va igualmente'); }
    if (![BEACH, CAMP].includes(this.at.environment)) this.travelTo('barceloneta');
    if (this.at.environment === BEACH) {
      if (!run.chase && !run.spiral) { this.near('uni-talk', { x: PLACES_UNI.talk.x, z: PLACES_UNI.talk.z }, PLACES_UNI.talk.radius); return; }
      if (run.chase) {
        // The game of tag: past the six to Anna in the water; caught is back up the sand.
        if (this.walk({ cell: PLACES_UNI.anna, radius: PLACES_UNI.spiral.radius }) && this.story.uni.chase) this.send({ type: 'near', id: 'uni-spiral' });
        return;
      }
      if (run.spiral && run.sunk) { this.near('uni-through', PLACES_UNI.portal, PLACES_UNI.spiral.through); return; }
      this.gap('La espiral no se ha llevado a Anna'); this.story.sank('anna');
      return;
    }
    if (this.at.environment !== CAMP) return;
    if (!this.has('candado')) {
      // The padlock's numbers are the letters of the words the patrols shout as they fall: one of each word.
      const words = new Set(CAMP_HUNTERS.filter(h => run.beaten.includes(h.id)).map(h => h.word));
      this.refreshHunters();
      const reach = (h: Hunter) => pathOn(this.grid, this.at.cell, { cell: round(h.chaser.position), radius: 1 }, this.blocked())?.length ?? Infinity;
      const wanted = this.hunters.filter(h => { const spec = CAMP_HUNTERS.find(c => `camp-${c.id}` === h.id); return spec && h.away <= 0 && (this.player.engage === 'fight' || !words.has(spec.word)) && reach(h) < Infinity; }).sort((a, b) => reach(a) - reach(b));
      if (wanted.length && CAMP_HUNTERS.some(h => !words.has(h.word))) { this.seek(wanted[0]); return; }
      if (CAMP_HUNTERS.some(h => !words.has(h.word))) this.gap('El candado sin todas las palabras: las patrullas que faltan no se alcanzan');
      this.walk({ cell: PLACES_CAMP.gate, radius: PLACES_CAMP.gate.radius });
      if (!run.told.includes('gate')) this.send({ type: 'near', id: 'camp-gate' }); else this.interact('candado-porton');
      return;
    }
    if (!run.beaten.includes('campeon')) { this.near('camp-campeon', PLACES_CAMP.campeon, PLACES_CAMP.campeon.radius); return; }
    if (!this.has('parcelas')) { this.interact('pissarra-piscina'); return; }
    this.near('camp-mesa', PLACES_CAMP.mesa, PLACES_CAMP.mesa.radius);
  }
  /** The padlock: the right numbers, after a wrong try or two when the player slips. */
  private padlock() {
    let tries = 1;
    while (this.random() < this.player.slip && tries < 4) tries++;
    this.spend('puzzle', 15 * tries);
    for (let i = 1; i < tries; i++) this.send({ type: 'candado', numbers: [1, 2, 3] });
    this.send({ type: 'candado', numbers: [7, 8, 5] });
  }
  /** Las parcelas: each slip lights a wrong pitch (a tent, or now and then the black one), then the board is solved. */
  private board() {
    let board = createBoard();
    for (let i = 0; i < 6 && this.random() < this.player.slip * 2; i++) {
      const black = this.random() < .25;
      this.spend('puzzle', 25);
      board = { ...board, shown: [...board.shown, i], darkness: board.darkness + (black ? 1 : 0) };
      const environment = this.at.environment;
      this.send({ type: 'parcelas', outcome: black ? 'black' : 'tent', board, solved: false });
      if (this.at.environment !== environment) return;
    }
    this.spend('puzzle', 120);
    this.send({ type: 'parcelas', outcome: 'lit', board, solved: true });
  }
  private marta() {
    const run = this.story.marta;
    // The long-distance train from Sants Estació (src/transit.ts), its station's way at the edge of the town.
    if (this.at.environment !== ALEGIA && this.at.environment !== CUERDAS_PLACE) { this.travelTo('alegia'); return; }
    if (this.at.environment === ALEGIA) {
      if (!this.has('alegia-marta')) { this.interact('talk-marta'); return; }
      this.interact('piano-marta');
      return;
    }
    // Las cuerdas: three mazes (puzzles over the void, a slip is a fall back to the maze's start), a quality after each, La Voz at the centre.
    const beaten = run.beaten.length;
    const quality = QUALITIES[beaten];
    if (quality) {
      const maze = PLACES_CUERDAS.mazes[beaten];
      if (!run.told.includes(`cuerdas-laberinto-${beaten}`)) this.near(`cuerdas-laberinto-${beaten}`, maze.cell, maze.radius);
      let falls = 0;
      while (this.random() < this.player.slip && falls < 5) falls++;
      this.spend('puzzle', 60 + 30 * beaten + falls * 20);
      this.at.cell = { ...quality.cell };
      this.send({ type: 'near', id: `cuerdas-${quality.id}` });
      return;
    }
    this.at.cell = { x: PLACES_CUERDAS.voz.x, z: PLACES_CUERDAS.voz.z };
    this.spend('walk', 15);
    this.send({ type: 'near', id: 'cuerdas-voz' });
  }
  /** Whether the player plays `encounter` (and what leads to it) as someone who reads it: `smart`, or after losing to it `learnAfter` times. */
  private understands(encounter: string) {
    return this.player.policy === 'smart' || (this.player.learnAfter > 0 && (this.losses[encounter] ?? 0) >= this.player.learnAfter);
  }
  /**
   * Emilie's mission (docs/quests/emilie.md § The mission, as built): her door on Margarit, her flooded
   * flat, her laptop once she has been spoken to, and through its whirlpool her model, zone by zone.
   */
  private emilie() {
    if (!this.has('clue-emilie') && !this.has('poble-sec-emilie')) this.gap('Nadie ha dicho aún lo de Emilie: se va igualmente');
    if (![POBLE_SEC, PISO, MODELO_PLACE].includes(this.at.environment)) this.travelTo('poble-sec');
    if (this.at.environment === POBLE_SEC) { this.interact('poble-sec-emilie'); return; }
    if (this.at.environment === PISO) { this.interact(this.has('poble-sec-emilie') ? 'portatil-emilie' : 'talk-emilie'); return; }
    if (this.at.environment === MODELO_PLACE) this.section();
  }
  /**
   * One zone of her model (src/modelo.ts, docs/quests/emilie.md § The section, as built) as src/game.ts
   * plays it: along the gallery to the zone's well, its patrols walking and coming for the party
   * meanwhile, a stake measured on the way by whoever stops for it, and down the lift once one of the
   * zone's patrols is beaten (while it has no power, at the nearest of them: they are all in the way).
   * At the bottom, up to El que no converge.
   */
  private section() {
    const run = this.story.modeloRun(), zone = run.zone;
    if (zone === 'fondo') {
      if (this.sectionWalk(() => ({ x: GALLERY.boss, reach: GALLERY.bossReach }), true)) this.send({ type: 'near', id: 'modelo-jefe' });
      return;
    }
    const well = WELLS[zone];
    const aim = () => {
      if (charged(run)) return { x: well, reach: SECTION.reach };
      const patrol = roaming(run).sort((a, b) => Math.abs(a.x - this.at.cell.x) - Math.abs(b.x - this.at.cell.x))[0];
      // Walked at until it is met (it comes for them as soon as it sees them).
      return patrol ? { x: patrol.x, reach: -1 } : { x: well, reach: SECTION.reach };
    };
    if (!this.sectionWalk(aim, true)) return;
    if (!charged(run)) { this.send({ type: 'interact', id: 'modelo-pozo-apagado' }); this.gap('Un pozo del modelo de Emilie sin corriente ni patrullas que la den'); return; }
    const landed = descend(run);
    if (!landed) return;
    this.spend('scene', LIFT);
    this.at.cell = { x: landed.x, z: GALLERY.row };
    // Emilie says a little more of the why, from outside, the first time they reach each zone.
    this.send({ type: 'near', id: `modelo-zona-${landed.zone}` });
  }
  /**
   * Walks the section towards `aim()` (metres along the party's zone, aimed again each step) in steps
   * of SECTION_STEP, its patrols walking meanwhile (`tick`); one that reaches the party is met
   * (`meetPatrol`). `stakes`: stops at a stake on the way to measure it, if the player does. False if a
   * fight took the party out of the model.
   */
  private sectionWalk(aim: () => { x: number; reach: number }, stakes: boolean): boolean {
    const speed = this.story.canRun ? RUN_SPEED : WALK_SPEED;
    let stood = 0;
    for (let t = 0; t < 240; t += SECTION_STEP) {
      const run = this.story.modeloRun(), x = this.at.cell.x, goal = aim();
      const stake = stakes ? stakeAt(run, x) : undefined;
      if (stake && this.measures(run, stake.id)) {
        if (stood >= MEASURE) { measure(run, stake.id); stood = 0; continue; }
        stood += SECTION_STEP; this.spend('puzzle', SECTION_STEP);
      } else if (Math.abs(goal.x - x) <= goal.reach + 1e-6) return true;
      else {
        this.at.cell = { x: x + Math.sign(goal.x - x) * Math.min(speed * SECTION_STEP, Math.abs(goal.x - x)), z: GALLERY.row };
        this.spend('walk', SECTION_STEP * this.player.pace);
      }
      const hit = tick(run, SECTION_STEP, this.at.cell.x);
      if (hit && !this.meetPatrol(hit)) return false;
    }
    this.gap('Atascado en el modelo de Emilie: se le pone donde iba');
    this.at.cell = { x: aim().x, z: GALLERY.row };
    return true;
  }
  /**
   * Whether the player stops to measure this stake: whoever reads the model does (Aitor and Emilie say
   * the stakes were her plan); whoever does not, now and then, deciding once for each run through it.
   */
  private measures(run: ModeloState, id: string) {
    if (run.placed.includes(id)) return false;
    if (this.understands('no-converge')) return true;
    const choices = this.stakeChoices.get(run) ?? new Map<string, boolean>();
    this.stakeChoices.set(run, choices);
    if (!choices.has(id)) choices.set(id, this.random() < .5);
    return choices.get(id)!;
  }
  /**
   * A patrol of her model reached the party: its fight, the story's as the game sends it, and beaten it
   * is gone and its power is in the zone's lift (src/game.ts). Whoever runs past everything backs off
   * once the lift has power: it stands still a while and they go by, and nothing reaches the story.
   * False if the fight was lost.
   */
  private meetPatrol(spec: PatrolSpec): boolean {
    const run = this.story.modeloRun();
    if (this.player.engage === 'avoid' && charged(run)) { shake(run, spec.id); this.spend('fight', FIGHT_FRAME + this.player.think); return true; }
    const n = this.out.fights.length;
    this.send({ type: 'near', id: `modelo-${spec.id}` });
    const won = this.out.fights[n]?.won === true && this.at.environment === MODELO_PLACE;
    if (won) beat(run, spec.id);
    return won;
  }
  /** Out of her model by *Volver*, only from El suelo, behind where they landed. False if something on the way took them elsewhere. */
  private leaveModelo(): boolean {
    if (this.story.modeloRun().zone !== 'suelo') { this.gap('Sin salida del modelo de Emilie desde abajo: se le pone en su piso'); this.moveTo({ environment: PISO, cell: { ...PLACES_PISO.laptop } }); return true; }
    if (!this.sectionWalk(() => ({ x: PLACES_MODELO.exit.x, reach: SECTION.reach }), false)) return false;
    this.send({ type: 'interact', id: 'salir-modelo' });
    return this.at.environment === PISO;
  }
  /**
   * Luca's mission (docs/quests/luca.md § Beats), once the photo gone grey at home has been looked at
   * (`next`): Luca by the pond (the door first, where Aitor sees him), and inside Fran's salon zone by
   * zone round the crossing, the nave's mirrors turned on the way by whoever reads them, then the
   * chaplain and Fran.
   */
  private luca() {
    const s = this.story;
    if (!this.has('clue-luca-foto') && !this.has('clue-sagrada-cartel') && !this.has('sagrada-luca')) this.gap('Nada ha llevado aún a Luca: se va igualmente');
    if (this.at.environment !== SAGRADA && this.at.environment !== INTERIOR) this.travelTo('sagrada-familia');
    if (this.at.environment === SAGRADA) {
      if (!this.has('sagrada-luca')) { this.interact(LUCA_DOOR); this.interact('talk-luca'); return; }
      this.interact(LUCA_DOOR);
      return;
    }
    if (this.at.environment !== INTERIOR || !s.salon) return;
    const run = s.luca;
    if (!run.told.includes('dentro')) { this.near('luca-dentro', { x: PLACES_LUCA.inside.x, z: PLACES_LUCA.inside.z - 1 }, 1.2); return; }
    const next = s.lucaNext;
    if (!next) { this.interact('talk-capellan'); return; }
    if (next.id === 'sillones') {
      // Into the nave the window's light is seen going from mirror to mirror; whoever reads it brings it to the chairs first.
      if (!run.told.includes('espejos')) this.near('luca-espejos', MIRRORS_SEEN, 2);
      if (this.at.environment !== INTERIOR) return;
      if (this.understands('luca-sillones') && !s.beam.hit) this.turnMirrors(next.cell, next.radius);
      if (this.at.environment !== INTERIOR) return;
    }
    this.near(`luca-${next.id}`, next.cell, next.radius);
  }
  /**
   * The nave's mirrors (src/espejos.ts): the fewest turns that bring the window's light to the
   * chaplains' chairs, worked out (a wrong idea or two when the player slips) and turned one by one,
   * walking round the chairs so as not to set their fight off first.
   */
  private turnMirrors(chairs: Cell, radius: number) {
    const from = this.story.luca.mirrors as Facing[], grid = ENVIRONMENTS[INTERIOR].grid;
    let turns: number[] | undefined;
    for (let mask = 1; mask < 1 << MIRRORS.length; mask++) {
      const pick = MIRRORS.map((_, i) => i).filter(i => mask & 1 << i);
      if (beamThrough(grid, MIRRORS, pick.reduce<Facing[]>((f, i) => turned(f, i), from), BEAM).hit && (!turns || pick.length < turns.length)) turns = pick;
    }
    if (!turns) { this.gap('Los espejos de la nave no llevan la luz a los sillones'); return; }
    let slips = 0;
    while (this.random() < this.player.slip && slips < 3) slips++;
    this.spend('puzzle', 20 + 15 * slips);
    const avoid = new Set<string>();
    for (let x = Math.floor(chairs.x - radius - 1); x <= chairs.x + radius + 1; x++) for (let z = Math.floor(chairs.z - radius - 1); z <= chairs.z + radius + 1; z++) if (dist({ x, z }, chairs) <= radius + .5) avoid.add(key({ x, z }));
    for (const i of turns) {
      const mirror = this.usable(INTERIOR).find(m => m.id === `luca-espejo-${i}`);
      if (!mirror || !this.walk({ cell: mirror.cell, radius: 1.5 }, avoid)) return;
      this.use(mirror);
    }
  }
  /**
   * After the friends: the castle (docs/castle.md). The guards before the curtain once; then each
   * day from the checkpoint the story enters at (the hall, the gym, the secretaría) through that
   * day's generated floor, its pupils hunting the party, out of it into the boss's room and up to
   * the boss. The Queen the first time takes Aitor and Gerard falls; the morning after Bernat calls,
   * his box at El Nucli brings the artilugio home, and the second time ends the game.
   */
  private castle(): { name: string; run: () => void } | undefined {
    this.stageName = 'El castillo';
    if (this.has('reina')) return undefined;
    if (!this.guardsBeaten) return { name: 'Los guardianes', run: () => this.castleTry() };
    // Bernat called after she took Aitor: to El Nucli, his game told, his box solved, the artilugio home.
    if (this.has('bernat-llama') && !this.has('artilugio')) return { name: 'Bernat y su caja', run: () => {
      this.stageName = 'Bernat';
      if (this.at.environment !== NUCLI) this.travelTo('placa-de-sants');
      if (!this.goTo(NUCLI, { cell: PLACES_BERNAT.seat, radius: 2 })) return;
      if (!this.has('bernat-juego')) this.interact('talk-bernat35');
      if (this.has('bernat-juego')) this.interact('nucli-mesa');
    } };
    const phase = CASTLE_PHASES[castlePhaseAt(this.story) - 1];
    this.stageName = phase.name;
    return { name: phase.name, run: () => {
      if (!this.isInCastle()) {
        this.travelTo('trinitat-vella');
        if (this.at.environment !== 'rec-comtal') return;
        this.interact('enter-school');
      }
      const day = this.story.clock.day;
      // Through the floor to the boss's room (doors followed: the story sends the school's door onto today's floor).
      if (!this.goTo(phase.into.environment, { cell: phase.bossAt, radius: phase.bossRadius })) return;
      if (this.story.clock.day !== day || this.story.night) return;
      this.send({ type: 'near', id: `castillo-${phase.boss}` });
    } };
  }
  private isInCastle() {
    const env = this.at.environment;
    return env === 'palacio' || env.startsWith('palacio-') || env.startsWith('castillo-');
  }
}

/** One playthrough of `player` (an id of PLAYERS or a whole Player) with `seed`. */
export function playGame(player: Player | string, seed = 35, rules = { doom: true }): Playthrough {
  const who = typeof player === 'string' ? PLAYERS[player] : player;
  if (!who) throw new Error(`Unknown player "${player}": use ${Object.keys(PLAYERS).join(', ')}.`);
  return new Playing(who, seed, undefined, rules).playAll();
}

// ── What many playthroughs add up to ─────────────────────────────────────
/** Each story fight's name for the report (the castle's fall back to their id until they have one here). */
export const ENCOUNTER_NAMES: Record<string, string> = {
  dogs: 'Los perros', 'palace-minion': 'El esbirro', 'palace-guards': 'Los guardianes de la cortina', 'night-guard': 'Guardianes de noche',
  'crias-1': 'Crías · anillo 1', 'crias-2': 'Crías · anillo 2', 'crias-3': 'Crías · anillo 3', cebolla: 'La Cebolla', cebollon: 'El Cebollón',
  plato: 'El Plato Misterioso', escolta: 'La Cebolla y los suyos', 'uri-vertigo': 'Vertitrón',
  'camping-magos': 'Magos', 'camping-dados': 'Dados', 'camping-agentes': 'Agentes', 'camping-tienda': 'Tienda equivocada', 'camping-negra': 'Parcela negra',
  campeon: 'El Campeón', sobremesa: 'La Sobremesa', 'cuerdas-lealtad': 'La Lealtad', 'cuerdas-cristalino': 'Lo Cristalino', 'cuerdas-directo': 'Lo Directo', voz: 'La Voz',
  'modelo-celdas': 'Celdas secas', 'modelo-oscilacion': 'Oscilaciones', 'modelo-atomo': 'El Átomo', 'no-converge': 'El que no converge',
  'luca-recepcion': 'La recepción', 'luca-sillones': 'Los sillones', 'luca-carta': 'La carta de colores', fran: 'Fran',
  // The castle (docs/castle.md): a room of pupils per letter, La Delegada, and its three bosses.
  ...Object.fromEntries(Object.keys(CASTLE_FIGHTS).map(id => { const [, year, room] = /-(\d)(\w?)$/.exec(id)!; return [id, room ? `Alumnos · ${year}.º ${room.toUpperCase()}` : `La Delegada · ${year}.º curso`]; })),
  aurelia: 'Aurelià', direccion: 'Mar, Montse y Pilar', reina: 'La Reina Bubbaloo', 'reina-vuelta': 'La Reina, con el artilugio',
};
/** A fight that tests nothing any more: won almost whole and quickly. */
export const TRIVIAL = { hpLeft: .85, rounds: 3 };
/** A fight that is a wall: won the first time it is met in fewer than this share of games. */
export const WALL = .35;
/** How hard one fight was: 1 lost, otherwise the share of the party's PV it took. */
export const difficultyOf = (f: Pick<FightLog, 'won' | 'hpLeft'>) => f.won ? 1 - f.hpLeft : 1;
export const trivialOf = (f: Pick<FightLog, 'won' | 'hpLeft' | 'rounds'>) => f.won && f.hpLeft >= TRIVIAL.hpLeft && f.rounds <= TRIVIAL.rounds;
const avg = (values: number[]) => values.length ? values.reduce((s, v) => s + v, 0) / values.length : null;
const pct = (values: number[], p: number) => { if (!values.length) return null; const v = [...values].sort((a, b) => a - b); return v[Math.min(v.length - 1, Math.max(0, Math.round(p * (v.length - 1))))]; };
const r2 = (value: number | null, places = 2) => value === null ? null : Number(value.toFixed(places));
/** Where the game's fights go, in tenths of each playthrough's length. */
export const CURVE_STEPS = 10;
export interface EncounterSummary {
  encounter: string; stage: string;
  /** Times met per game, and the share of games that met it. */
  met: number; games: number;
  /** Share of games whose first meeting with it was a win, and of all meetings won. */
  firstWin: number | null; win: number;
  /** Meetings until the first win, among games that won it. */
  tries: number | null;
  hpLeft: number | null; rounds: number | null; seconds: number | null;
  /** Share of meetings played understood after losing to it (`learnAfter`), and of meetings that were trivial. */
  learnt: number; trivial: number;
  /** Share of meetings that ended with the Queen holding Aitor: lost as the story asks, not a wall. */
  taken: number;
}
export interface PlayerSummary {
  id: string; name: string; policy: Policy; runs: number;
  /** Share of games that reached the route's end, and why the others stopped. */
  finished: number; reasons: Record<string, number>;
  minutes: { mean: number | null; p10: number | null; p50: number | null; p90: number | null };
  days: { mean: number | null; max: number }; rewinds: { mean: number | null; max: number };
  fights: number | null; losses: number | null;
  /** Mean minutes of each kind of time. */
  time: Record<TimeKind, number | null>;
  /** The game's fights by tenths of its length: how hard they are, how often lost, how often trivial. */
  curve: { at: number; fights: number; difficulty: number | null; lossRate: number | null; trivial: number | null }[];
  /** Each level each shared ánima reaches: in how many games, at what minute and what share of the game. */
  levels: { anima: ClassId; level: number; reached: number; minute: number | null; at: number | null; fight: number | null }[];
  /** EXP earned after the top level, lost, per game. */
  wasted: number | null;
  /** From what share of the game (and minute) every fight left is trivial and none is lost, if it ever comes. */
  saturation: { at: number; minute: number | null } | null;
  encounters: EncounterSummary[];
  walls: string[];
  /** The game nearest the median length, condensed: what the picker draws. */
  sample: { seed: number; minutes: number; days: number; fights: { t: number; stage: string; encounter: string; won: boolean; hpLeft: number; rounds: number; day: number }[]; moments: Moment[] };
}
export interface GameSummary { version: number; runs: number; seed: number; players: PlayerSummary[]; gaps: { text: string; games: number }[] }

/** Many playthroughs of each player, added up (`plays` grouped by `player`). */
export function summarise(plays: readonly Playthrough[], seed = 35): GameSummary {
  const byPlayer = new Map<string, Playthrough[]>();
  for (const play of plays) byPlayer.set(play.player, [...byPlayer.get(play.player) ?? [], play]);
  const players = [...byPlayer].map(([id, games]): PlayerSummary => {
    const who = PLAYERS[id] ?? { id, name: id, policy: 'smart' as Policy };
    const minutes = games.map(g => g.seconds / 60);
    const reasons: Record<string, number> = {};
    for (const g of games.filter(g => !g.finished)) reasons[g.reason] = (reasons[g.reason] ?? 0) + 1;
    // The curve: each fight at the share of its game's length it came at.
    const curve = Array.from({ length: CURVE_STEPS }, (_, i) => {
      const fights = games.flatMap(g => g.fights.filter(f => Math.min(CURVE_STEPS - 1, Math.floor(f.t / Math.max(1, g.seconds) * CURVE_STEPS)) === i));
      return { at: i / CURVE_STEPS, fights: fights.length, difficulty: r2(avg(fights.map(difficultyOf))), lossRate: r2(avg(fights.map(f => f.won ? 0 : 1))), trivial: r2(avg(fights.map(f => trivialOf(f) ? 1 : 0))) };
    });
    const saturated = curve.findIndex((_, i) => curve.slice(i).every(c => !c.fights || ((c.trivial ?? 0) >= .6 && (c.lossRate ?? 0) <= .05)) && curve.slice(i).some(c => c.fights));
    const levels = LEVELLED.flatMap(anima => Array.from({ length: topOf(anima) - 1 }, (_, i) => i + 2).map(level => {
      const hits = games.map(g => ({ g, m: g.moments.find(m => m.kind === 'level' && m.anima === anima && m.level === level) })).filter(h => h.m);
      return {
        anima, level, reached: r2(hits.length / games.length)!,
        minute: r2(avg(hits.map(h => h.m!.t / 60)), 1), at: r2(avg(hits.map(h => h.m!.t / Math.max(1, h.g.seconds)))),
        fight: r2(avg(hits.map(h => h.g.fights.filter(f => f.t <= h.m!.t).length)), 1),
      };
    }));
    const names = [...new Set(games.flatMap(g => g.fights.map(f => f.encounter)))];
    const encounters = names.map((encounter): EncounterSummary => {
      const per = games.map(g => g.fights.filter(f => f.encounter === encounter)).filter(list => list.length);
      const all = per.flat(), won = all.filter(f => f.won);
      const tries = per.map(list => list.findIndex(f => f.won)).filter(i => i >= 0).map(i => i + 1);
      return {
        encounter, stage: all[0].stage,
        met: r2(all.length / games.length)!, games: r2(per.length / games.length)!,
        firstWin: r2(avg(per.map(list => list[0].won ? 1 : 0))), win: r2(won.length / all.length)!,
        tries: r2(avg(tries), 1), hpLeft: r2(avg(won.map(f => f.hpLeft))), rounds: r2(avg(won.map(f => f.rounds)), 1), seconds: r2(avg(all.map(f => f.seconds)), 0),
        learnt: r2(avg(all.map(f => f.learnt ? 1 : 0)))!, trivial: r2(avg(all.map(f => trivialOf(f) ? 1 : 0)))!, taken: r2(avg(all.map(f => f.taken ? 1 : 0)))!,
      };
    }).sort((a, b) => (avg(games.map(g => g.fights.find(f => f.encounter === a.encounter)?.t ?? Infinity).filter(Number.isFinite)) ?? 0) - (avg(games.map(g => g.fights.find(f => f.encounter === b.encounter)?.t ?? Infinity).filter(Number.isFinite)) ?? 0));
    const median = pct(minutes, .5) ?? 0, sample = [...games].sort((a, b) => Math.abs(a.seconds / 60 - median) - Math.abs(b.seconds / 60 - median))[0];
    return {
      id, name: who.name, policy: who.policy, runs: games.length,
      finished: r2(games.filter(g => g.finished).length / games.length)!, reasons,
      minutes: { mean: r2(avg(minutes), 1), p10: r2(pct(minutes, .1), 1), p50: r2(median, 1), p90: r2(pct(minutes, .9), 1) },
      days: { mean: r2(avg(games.map(g => g.days)), 1), max: Math.max(...games.map(g => g.days)) },
      rewinds: { mean: r2(avg(games.map(g => g.rewinds)), 1), max: Math.max(...games.map(g => g.rewinds)) },
      fights: r2(avg(games.map(g => g.fights.length)), 1), losses: r2(avg(games.map(g => g.fights.filter(f => !f.won).length)), 1),
      time: Object.fromEntries((Object.keys(TIME_KINDS) as TimeKind[]).map(k => [k, r2(avg(games.map(g => g.time[k] / 60)), 1)])) as Record<TimeKind, number | null>,
      curve, levels,
      wasted: r2(avg(games.map(g => g.fights.reduce((s, f) => s + f.wasted, 0))), 0),
      saturation: saturated >= 0 ? { at: saturated / CURVE_STEPS, minute: r2(median * saturated / CURVE_STEPS, 0) } : null,
      // A fight lost as the story asks (the first Queen, who takes Aitor) is not a wall.
      encounters, walls: encounters.filter(e => e.firstWin !== null && e.firstWin < WALL && e.games >= .5 && !e.taken).map(e => e.encounter),
      sample: {
        seed: sample.seed, minutes: Math.round(sample.seconds / 60), days: sample.days,
        fights: sample.fights.map(f => ({ t: f.t, stage: f.stage, encounter: f.encounter, won: f.won, hpLeft: f.hpLeft, rounds: f.rounds, day: f.day })),
        moments: sample.moments.filter(m => m.kind !== 'day'),
      },
    };
  });
  const gaps = new Map<string, number>();
  for (const play of plays) for (const gap of play.gaps) gaps.set(gap, (gaps.get(gap) ?? 0) + 1);
  return { version: GAME_SIM_VERSION, runs: plays.length, seed, players, gaps: [...gaps].map(([text, games]) => ({ text, games })).sort((a, b) => b.games - a.games) };
}
