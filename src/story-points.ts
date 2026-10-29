/**
 * The development picker's story points (src/jump-menu.ts, docs/dev-tools.md): the story as
 * chapters, arcs and steps. Chapter 1 runs in one line; chapter 2 is open, so its arcs only need
 * the one they hang from, and each ánima mission stands on its own. Pure: `main.ts` turns a
 * point into the flags to start with and where to stand.
 */
import { ANIMA_IDS, type AnimaId } from './animas.ts';
import { PLACES } from './chapter-1.ts';
import type { EnvironmentId } from './environments.ts';
import type { Cell } from './movement.ts';
import { STORY_FLAGS, type StoryFlag } from './story.ts';

/** Where a jump stands Gerard; without one, where the story resumes (`story.resume`). */
export interface Spot { environment: EnvironmentId; cell?: Cell }
/** One thing that happens: the flags it sets, and where it leaves Gerard. */
interface Step { flags: readonly StoryFlag[]; label: string; spot?: Spot }
export interface Arc {
  id: string; chapter: 1 | 2; title: string; detail: string;
  /** The step this arc starts from (its flags and everything they need). */
  after?: StoryFlag;
  /** An ánima mission: added as done to any chapter 2 jump with `with`. */
  anima?: AnimaId;
  steps: readonly Step[];
}

const castle: Spot = { environment: PLACES.palaceEntry.environment, cell: { ...PLACES.palaceEntry.cell } };
export const STORY_ARCS = [
  { id: 'home', chapter: 1, title: 'En casa', detail: 'Passatge Maresme, 20', steps: [
    { flags: ['intro'], label: 'Despierta en casa' }, { flags: ['met-jan'], label: 'Habla con Jan' },
    { flags: ['got-shoes'], label: 'Las zapatillas' }, { flags: ['got-potion'], label: 'La poción' },
    { flags: ['got-backpack'], label: 'La mochila' },
  ] },
  { id: 'street', chapter: 1, title: 'Con Bernat', detail: 'Passatge Maresme', after: 'got-backpack', steps: [
    { flags: ['bernat-joined'], label: 'Bernat se une' }, { flags: ['bernat-stalled'], label: 'Bernat se planta' },
    { flags: ['dejavu'], label: 'Déjà vu' }, { flags: ['minion'], label: 'El esbirro y los perros' },
    { flags: ['first-fight'], label: 'Primer combate' },
  ] },
  { id: 'palace', chapter: 1, title: 'El palacio', detail: 'Al final de la calle', after: 'first-fight', steps: [
    { flags: ['palace'], label: 'Se alza el palacio' }, { flags: ['in-palace'], label: 'Dentro del palacio' },
    { flags: ['got-chicle'], label: 'El chicle' }, { flags: ['noista'], label: 'Despierta Noísta' },
    { flags: ['wrapper-room'], label: 'Sala de los Envoltorios' },
  ] },
  { id: 'waking', chapter: 2, title: 'El despertar', detail: 'Meridiana', after: 'wrapper-room', steps: [
    { flags: ['caught'], label: 'Atrapados: despierta a los 35' }, { flags: ['got-wrapper'], label: 'El envoltorio' },
    // The ticker carries the R4 clue: seeing the news is knowing it.
    { flags: ['tv-news', 'clue-r4'], label: 'Las noticias y la pista del R4' },
  ] },
  { id: 'city', chapter: 2, title: 'La ciudad', detail: 'Tras las noticias', after: 'tv-news', steps: [
    { flags: ['metro'], label: 'Primer metro', spot: { environment: 'meridiana-calle' } },
    { flags: ['rec-comtal'], label: 'Escola Rec Comtal', spot: { environment: 'rec-comtal' } },
    { flags: ['castle'], label: 'Dentro del castillo', spot: castle },
    { flags: ['palace-tried'], label: 'Primera caída en el castillo' },
  ] },
  { id: 'nuria', chapter: 2, title: 'Misión de Nuria', detail: 'Cardedeu', after: 'metro', anima: 'nuria', steps: [
    { flags: ['anima-nuria'], label: 'Ánima de Nuria' },
  ] },
  { id: 'uri', chapter: 2, title: 'Misión de Uri', detail: 'Cardedeu', after: 'metro', anima: 'uri', steps: [
    { flags: ['anima-uri'], label: 'Ánima de Uri' },
  ] },
] as const satisfies readonly Arc[];

// TypeScript asks for a step for every flag in STORY_FLAGS.
type Placed = (typeof STORY_ARCS)[number]['steps'][number]['flags'][number];
const everyFlagPlaced: Record<Exclude<StoryFlag, Placed>, never> = {};
void everyFlagPlaced;

const ARCS: readonly Arc[] = STORY_ARCS;
/** The arc and step a flag is set in. */
export function stepOf(flag: StoryFlag) {
  for (const arc of ARCS) {
    const index = arc.steps.findIndex(s => s.flags.includes(flag));
    if (index >= 0) return { arc, index, step: arc.steps[index] };
  }
  throw new Error(`No step sets ${flag}`);
}
/** Chapter 2 starts when the Queen's hands catch them. */
export const isChapter2 = (flag: StoryFlag) => stepOf(flag).arc.chapter === 2;

/**
 * The flags a jump to `flag` starts with: its arc up to it, what that arc hangs from, and every
 * other ánima mission in `withAnimas` as done once the jump has reached where that mission starts.
 * In story order, so the story reads them as it would have set them.
 */
export function flagsAt(flag: StoryFlag, withAnimas: readonly AnimaId[] = []): StoryFlag[] {
  const flags = new Set<StoryFlag>();
  const reach = (to: StoryFlag) => {
    const { arc, index } = stepOf(to);
    if (arc.after) reach(arc.after);
    for (const step of arc.steps.slice(0, index + 1)) step.flags.forEach(f => flags.add(f));
  };
  reach(flag);
  const own = stepOf(flag).arc.anima;
  for (const mission of ARCS.filter(a => a.anima && a.anima !== own && withAnimas.includes(a.anima))) {
    if (mission.after && flags.has(mission.after)) reach(mission.steps.at(-1)!.flags.at(-1)!);
  }
  return STORY_FLAGS.filter(f => flags.has(f));
}
/** Where a jump to `flag` stands Gerard, if not where the story resumes. */
export const spotAt = (flag: StoryFlag): Spot | undefined => stepOf(flag).step.spot;
/** The ánima missions the flags have finished. */
export const missionsDone = (flags: readonly StoryFlag[]): AnimaId[] =>
  ANIMA_IDS.filter(id => ARCS.find(a => a.anima === id)?.steps.every(s => s.flags.every(f => flags.includes(f))));
