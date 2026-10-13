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
  'minion', 'first-fight',
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
  /** A fight on the street ended. */
  | { type: 'battle'; won: boolean };

export type StoryEffect =
  | { kind: 'dialogue'; dialogue: Dialogue }
  | { kind: 'item'; item: ItemId }
  | { kind: 'hint'; id: HintId }
  | { kind: 'card'; id: CardId }
  /** The minion's head rises out of the manhole and pops a gum bubble over the dogs. */
  | { kind: 'minion' }
  /** The possessed dogs attack: a fight starts right away. */
  | { kind: 'battle' };

export interface StoryNpc { id: 'mama' | 'jan'; character: string; environment: EnvironmentId; cell: Cell; scale: number }
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
} as const;
/** Doors out of the house: closed by the story until Gerard is ready for school. */
const HOUSE_EXITS = new Set(['leave-hall', 'leave-living']);

export const STORY_CARDS = CARDS;
export const STORY_HINTS = HINTS;

export class Story {
  readonly flags: Set<StoryFlag>;
  /** How many times Gerard tugged at the leash: Bernat's bubble escalates. Not saved. */
  private tugs = 0;
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
  get canRun() { return this.has('got-shoes'); }
  get battles() { return this.has('dejavu'); }
  /** The street dogs have the minion's dark pink eyes. */
  get possessed() { return this.has('minion'); }
  get minion(): MinionState { return this.has('minion') ? 'gone' : 'lurking'; }
  get tone(): Tone { return this.has('first-fight') ? 'bubbaloo' : 'day'; }
  get items(): ItemId[] {
    const items: ItemId[] = [];
    if (this.has('got-shoes')) items.push('zapatillas');
    if (this.has('got-backpack')) items.push('mochila');
    if (this.has('got-potion')) items.push('pocion');
    return items;
  }
  get companion(): Companion {
    if (!this.has('bernat-joined')) return 'none';
    return this.has('bernat-stalled') && !this.has('dejavu') ? 'stalled' : 'follow';
  }
  get party(): PartyMember[] {
    const gerard: PartyMember = { id: 'gerard', name: 'Gerard', equipment: this.items.filter(i => i !== 'pocion'), note: this.has('got-shoes') ? 'Listo para el cole.' : 'Aún en pijama.' };
    return this.has('bernat-joined') ? [gerard, { id: 'bernat', name: 'Bernat', equipment: [], note: 'Modo escuela: nada equipado.' }] : [gerard];
  }
  /** Where a new or reloaded game puts Gerard, if the story decides it. */
  get resume(): { environment: EnvironmentId; cell: Cell } {
    if (this.has('got-backpack')) return { environment: 'maresme', cell: this.has('bernat-joined') ? { x: 10, z: 25 } : { x: 20, z: 23 } };
    return { environment: PLACES.wake.environment, cell: { ...PLACES.wake.cell } };
  }
  /** What Bernat says over his head right now, if anything. */
  get bubble(): string | undefined {
    if (this.companion !== 'stalled') return undefined;
    return BUBBLES.stalled[Math.min(this.tugs, BUBBLES.stalled.length - 1)];
  }
  npcs(environment: EnvironmentId): StoryNpc[] {
    const all: StoryNpc[] = [
      { id: 'mama', character: 'mama', environment: PLACES.mama.environment, cell: PLACES.mama.cell, scale: 1.3 },
      { id: 'jan', character: 'jan-child', environment: PLACES.jan.environment, cell: PLACES.jan.cell, scale: 1.12 },
    ];
    return all.filter(npc => npc.environment === environment);
  }
  /** Loose things still lying around, drawn as pickups. */
  pickups(environment: EnvironmentId): { id: ItemId; cell: Cell }[] {
    const all = [
      { id: 'pocion' as const, place: PLACES.pocion, taken: this.has('got-potion') },
      { id: 'mochila' as const, place: PLACES.mochila, taken: this.has('got-backpack') },
    ];
    return all.filter(p => !p.taken && p.place.environment === environment).map(p => ({ id: p.id, cell: p.place.cell }));
  }
  /** Story interactions in this scene; `bernat` is the companion's current cell on the street. */
  interactions(environment: EnvironmentId, bernat?: Cell): Interaction[] {
    const list: Interaction[] = [];
    for (const [id, { place, label }] of Object.entries(STORY_INTERACTIONS)) {
      if (place.environment !== environment) continue;
      if (id === 'take-pocion' && this.has('got-potion')) continue;
      if (id === 'take-mochila' && this.has('got-backpack')) continue;
      list.push({ id, label, cell: { ...place.cell } });
    }
    if (bernat && this.companion !== 'none') list.push({ id: 'talk-bernat', label: this.companion === 'stalled' ? 'Preguntarle a Bernat qué pasa' : 'Hablar con Bernat', cell: { x: Math.round(bernat.x), z: Math.round(bernat.z) } });
    return list;
  }
  /** A dialogue that stops a door from working, if the story is not ready for it. */
  gate(interactionId: string): Dialogue | undefined {
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
        // A reload between the déjà-vu and the minion's entrance plays the entrance again.
        if (this.has('dejavu') && !this.has('minion')) return [{ kind: 'minion' }];
        if (!this.set('intro')) return [];
        return [{ kind: 'card', id: 'intro' }, say(LINES.wake), { kind: 'hint', id: 'move' }];
      case 'minion':
        if (!this.has('dejavu') || !this.set('minion')) return [];
        return [say(LINES.minion), { kind: 'battle' }];
      case 'battle':
        if (!event.won || !this.has('minion') || !this.set('first-fight')) return [];
        return [say(LINES.afterFight), { kind: 'card', id: 'end' }];
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
      case 'talk-bernat':
        if (this.companion === 'stalled') { this.set('dejavu'); return [say(LINES.dejavu), { kind: 'minion' }]; }
        if (this.has('first-fight')) return [say(LINES.bernatAfterFight)];
        if (this.has('minion')) return [say(LINES.bernatFight)];
        if (this.has('dejavu')) return [say(LINES.bernatAfter)];
        return this.companion === 'follow' ? [say(LINES.bernatHere)] : [];
    }
    return [];
  }
}
