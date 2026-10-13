/**
 * Story progress as a set of flags, and the rules that turn game events into story beats.
 * Pure: no DOM, no engine. `main.ts` runs the returned effects; `game.ts` reads the derived
 * state (NPCs, companion, extra interactions). Flags are what the server saves.
 */
import type { Dialogue } from './dialogue';
import type { EnvironmentId, Interaction } from './environments';
import type { Cell } from './movement';
import type { ItemId } from './items';
import { BUBBLES, CARDS, HINTS, LEASH, LINES, PLACES, type CardId, type HintId } from './chapter-1.ts';

/** Keep in sync with STORY_FLAGS in server.py (a test checks it). */
export const STORY_FLAGS = [
  'intro', 'met-jan', 'got-shoes', 'got-potion', 'got-backpack', 'bernat-joined', 'bernat-stalled', 'dejavu',
  'minion', 'first-fight', 'palace', 'in-palace', 'got-chicle', 'noista', 'wrapper-room',
  'caught', 'got-wrapper',
] as const;
export type StoryFlag = typeof STORY_FLAGS[number];

export type StoryEvent =
  | { type: 'start' }
  | { type: 'interact'; id: string }
  /** Gerard walked past PLACES.southRow on the street. */
  | { type: 'south' }
  /** Gerard pulled against the leash while Bernat stalls. */
  | { type: 'leash' }
  /** La Reina Bubbaloo's minion has stepped out and popped its bubble: the dogs obey it now. */
  | { type: 'minion' }
  /** A fight ended; `encounter` says which one (the street dogs if missing). */
  | { type: 'battle'; won: boolean; encounter?: EncounterId }
  /** The palace has finished rising over the north end of the street. */
  | { type: 'palace' }
  /** Gerard is (or is no longer) heading back south, away from the palace. */
  | { type: 'away'; away: boolean }
  /** Gerard stepped into a named room of the scene. */
  | { type: 'room'; id: string }
  /** A class woke up in Gerard, mid-fight. */
  | { type: 'class'; id: GerardClass }
  /** The Queen's hands have caught Gerard and Bernat: the screen is black. */
  | { type: 'caught' };

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
  /** Chapter 2: out of the black, Gerard (35) wakes in bed with a start. */
  | { kind: 'wake' };

/** Scripted fights: the possessed street dogs, and the palace minion that wakes Noísta. */
export type EncounterId = 'dogs' | 'palace-minion';
/** Gerard's classes (docs/bubbaloo-palace.md). Only one so far; how the system grows is still open. */
export type GerardClass = 'noista';

export interface StoryNpc { id: 'mama' | 'jan' | 'aitor'; character: string; environment: EnvironmentId; cell: Cell; scale: number }
export type Companion = 'none' | 'follow' | 'stalled';
/** La Reina Bubbaloo's minion in the manhole: lurking (a faint bubble now and then) until its entrance, then gone below. */
export type MinionState = 'lurking' | 'gone';
/** The light over Sant Quirze: an ordinary autumn morning, or La Reina Bubbaloo's pink gloom. */
export type Tone = 'day' | 'bubbaloo';
export interface PartyMember { id: 'gerard' | 'bernat'; name: string; equipment: ItemId[]; note: string }

/** Interactions only the story adds; the game merges them with the scene's own. */
const STORY_INTERACTIONS = {
  'talk-mama': { place: PLACES.mama, label: 'Hablar con mamá' },
  'talk-jan': { place: PLACES.jan, label: 'Hablar con Jan' },
  'take-pocion': { place: PLACES.pocion, label: 'Mirar la mesa de Jan' },
  'take-mochila': { place: PLACES.mochila, label: 'Coger la mochila' },
  'take-chicle': { place: PLACES.chicle, label: 'Mirar el bol de chicles' },
  'take-envoltorio': { place: PLACES.envoltorio, label: 'Mirar la mesilla' },
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
/** Doors out of the house: closed by the story until Gerard is ready for school. */
const HOUSE_EXITS = new Set(['leave-hall', 'leave-living']);
/** La Pompa from the inside: it will not let them out until the wrapper room is cleared. */
const PALACE_EXIT = 'leave-palace';

export const STORY_CARDS = CARDS;
export const STORY_HINTS = HINTS;

export class Story {
  readonly flags: Set<StoryFlag>;
  /** How many times Gerard tugged at the leash: Bernat's bubble escalates. Not saved. */
  private tugs = 0;
  /** Whether Gerard is heading back south once the palace stands. Not saved. */
  private away = false;
  constructor(flags: Iterable<string> = []) {
    this.flags = new Set([...flags].filter((f): f is StoryFlag => (STORY_FLAGS as readonly string[]).includes(f)));
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
  /** Gerard's active class, if one has woken up. */
  get gerardClass(): GerardClass | undefined { return this.has('noista') ? 'noista' : undefined; }
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
    const note = this.has('noista') ? 'Clase: Noísta. Siempre dice que no.' : this.has('got-shoes') ? 'Listo para el cole.' : 'Aún en pijama.';
    if (this.adult) return [{ id: 'gerard', name: 'Gerard', equipment: [], note: this.has('noista') ? 'Treinta y cinco años. Clase: Noísta.' : 'Treinta y cinco años.' }];
    const gerard: PartyMember = { id: 'gerard', name: 'Gerard', equipment: this.items.filter(i => i !== 'pocion' && i !== 'chicle'), note };
    return this.has('bernat-joined') ? [gerard, { id: 'bernat', name: 'Bernat', equipment: [], note: 'Modo escuela: nada equipado.' }] : [gerard];
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
    // Chapter 1 is a dream: once Gerard wakes, home in Sant Quirze is empty and Aitor is in Barcelona.
    if (this.adult) return environment === PLACES.aitor.environment ? [{ id: 'aitor', character: 'aitor', environment, cell: PLACES.aitor.cell, scale: 1.38 }] : [];
    return all.filter(npc => npc.environment === environment);
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
  /** Story interactions in this scene; `bernat` is the companion's current cell on the street. */
  interactions(environment: EnvironmentId, bernat?: Cell): Interaction[] {
    const list: Interaction[] = [];
    for (const [id, { place, label }] of Object.entries(STORY_INTERACTIONS)) {
      if (place.environment !== environment) continue;
      if (id === 'take-pocion' && this.has('got-potion')) continue;
      if (id === 'take-mochila' && this.has('got-backpack')) continue;
      if (id === 'take-chicle' && this.has('got-chicle')) continue;
      if (id === 'take-envoltorio' && (this.has('got-wrapper') || !this.adult)) continue;
      list.push({ id, label, cell: { ...place.cell } });
    }
    if (this.adult && environment === PLACES.aitor.environment) list.push({ id: 'talk-aitor', label: 'Hablar con Aitor', cell: { ...PLACES.aitor.cell } });
    if (environment === 'maresme' && this.has('palace') && !this.adult) list.push({ id: 'enter-palace', label: 'Atravesar la pompa', cell: { x: PLACES.palace.door.x, z: PLACES.palace.door.z - 1 } });
    if (environment === 'palacio') {
      for (const look of PALACE_LOOKS) list.push({ id: look.id, label: look.label, cell: { ...look.cell } });
      if (!this.has('wrapper-room')) list.push({ id: 'push-back-door', label: 'Empujar la puerta', cell: { ...BACK_DOOR } });
    }
    if (bernat && this.companion !== 'none') list.push({ id: 'talk-bernat', label: this.companion === 'stalled' ? 'Preguntarle a Bernat qué pasa' : 'Hablar con Bernat', cell: { x: Math.round(bernat.x), z: Math.round(bernat.z) } });
    return list;
  }
  /** A dialogue that stops a door from working, if the story is not ready for it. */
  gate(interactionId: string): Dialogue | undefined {
    if (interactionId === PALACE_EXIT) return this.has('wrapper-room') ? undefined : LINES.leaveLocked;
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
    const say = (dialogue: Dialogue): StoryEffect => ({ kind: 'dialogue', dialogue });
    switch (event.type) {
      case 'start':
        // A reload between a beat's trigger and its cut-scene plays the cut-scene again.
        if (this.has('dejavu') && !this.has('minion')) return [{ kind: 'minion' }];
        if (this.has('first-fight') && !this.has('palace')) return [{ kind: 'palace' }];
        if (this.has('wrapper-room') && !this.has('caught')) return [{ kind: 'ambush' }];
        if (!this.set('intro')) return [];
        return [{ kind: 'card', id: 'intro' }, say(LINES.wake), { kind: 'hint', id: 'move' }];
      case 'minion':
        if (!this.has('dejavu') || !this.set('minion')) return [];
        return [say(LINES.minion), { kind: 'battle', encounter: 'dogs' }];
      case 'battle':
        if (!event.won) return [];
        if (event.encounter === 'palace-minion') {
          if (!this.set('wrapper-room')) return [];
          return [say(LINES.afterNoista), { kind: 'ambush' }];
        }
        if (!this.has('minion') || !this.set('first-fight')) return [];
        return [say(LINES.afterFight), { kind: 'palace' }];
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
        this.set(event.id);
        return [];
      case 'caught': {
        if (!this.has('wrapper-room') || !this.set('caught')) return [];
        const home: StoryEffect = { kind: 'travel', environment: PLACES.wakeUp.environment, cell: { ...PLACES.wakeUp.cell } };
        return [home, { kind: 'wake' }, say(LINES.waking)];
      }
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
      case 'talk-aitor':
        if (!this.adult) return [];
        return [say(this.has('got-wrapper') ? LINES.aitorWrapper : LINES.aitorAgain)];
      case 'push-back-door':
        return this.has('wrapper-room') ? [] : [say(LINES.backDoorStuck)];
      case 'talk-bernat':
        if (this.companion === 'stalled') { this.set('dejavu'); return [say(LINES.dejavu), { kind: 'minion' }]; }
        if (this.has('wrapper-room')) return [say(LINES.bernatAfterNoista)];
        if (this.has('in-palace')) return [say(LINES.bernatInPalace)];
        if (this.has('palace')) return [say(LINES.bernatPalace)];
        if (this.has('first-fight')) return [say(LINES.bernatAfterFight)];
        if (this.has('minion')) return [say(LINES.bernatFight)];
        if (this.has('dejavu')) return [say(LINES.bernatAfter)];
        return this.companion === 'follow' ? [say(LINES.bernatHere)] : [];
    }
    const look = PALACE_LOOKS.find(l => l.id === event.id);
    return look ? [say(look.dialogue)] : [];
  }
}
