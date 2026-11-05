/**
 * The development picker's story points (src/jump-menu.ts, docs/dev-tools.md): the story as
 * chapters, arcs and steps. Chapter 1 runs in one line; chapter 2 is open, so its arcs only need
 * the one they hang from, and each ánima mission stands on its own. Pure: `main.ts` turns a
 * point into the flags to start with and where to stand.
 */
import { ANIMA_IDS, type AnimaId } from './animas.ts';
import type { ClassId } from './battle.ts';
import { PLACES } from './chapter-1.ts';
import { ENVIRONMENTS, type EnvironmentId } from './environments.ts';
import { FEARS, PLACES_NURIA, STREET } from './friends/nuria.ts';
import { LEVELLED, MAX_LEVEL } from './levels.ts';
import type { Cell } from './movement.ts';
import { STORY_FLAGS, type NuriaRun, type StoryEvent, type StoryFlag } from './story.ts';
import { entranceId } from './transit.ts';

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
    { flags: ['got-chicle'], label: 'El chicle' }, { flags: ['matemagico'], label: 'Despierta Matemágico' },
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
  { id: 'nuria', chapter: 2, title: 'Misión de Nuria y Uri', detail: 'Cardedeu', after: 'metro', anima: 'nuria', steps: [
    { flags: ['cardedeu'], label: 'La R4 hasta Cardedeu', spot: { environment: 'cardedeu' } },
    // Winning at the top of the tower sets them all at once (story.ts): Papagato, the ánima and the two lights.
    { flags: ['nuria-uri', 'papagato', 'luz-nuria', 'luz-uri', 'anima-nuria'], label: 'Uri vuelve en sí' },
  ] },
  // Ánimas grow with the EXP of fights won (src/levels.ts); Matemágico's are chapter 2's, at 35.
  { id: 'matemagico', chapter: 2, title: 'Matemágico crece', detail: 'Experiencia de combate', after: 'caught', steps: [
    { flags: ['matemagico-2'], label: 'Matemágico, nivel 2' }, { flags: ['matemagico-3'], label: 'Matemágico, nivel 3' },
  ] },
  { id: 'papagato', chapter: 2, title: 'Papagato crece', detail: 'Experiencia de combate', after: 'papagato', steps: [
    { flags: ['papagato-2'], label: 'Papagato, nivel 2' }, { flags: ['papagato-3'], label: 'Papagato, nivel 3' },
  ] },
  { id: 'lights', chapter: 2, title: 'El bote de las luces', detail: 'Meridiana', after: 'nuria-uri', steps: [
    { flags: ['luz-nuria-usada'], label: 'Primera luz al castillo' }, { flags: ['luz-uri-usada'], label: 'Segunda luz' },
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

/**
 * A point inside an ánima mission to start at (the picker's Misiones tab): the step it hangs from
 * (its flags and everything they need), where it stands Gerard, the mission's own unsaved state
 * (Nuria's cats lent, the tower's ring), and a story event to play on arrival.
 */
export interface MissionPart {
  id: string; label: string; detail: string;
  at: StoryFlag; spot?: Spot;
  nuria?: Partial<NuriaRun>;
  event?: StoryEvent;
}
const maze = (cell: Cell): Spot => ({ environment: PLACES_NURIA.mazeIn.environment, cell: { ...cell } });
const station = ENVIRONMENTS[STREET].interactions.find(i => i.id === entranceId('cardedeu'))!.cell;
const lent = { haru: true, lent: true, street: true, portal: true, entered: true } as const;
/** Nuria's fears, by the ring they hunt: reaching a ring has beaten the ones below it. */
const beaten = (rings: number) => FEARS.slice(0, rings).map(f => f.id);
/**
 * Nuria's mission, part by part (docs/quests/nuria.md § Beats). Most of it is not saved (the cats
 * are only lent until Uri is back), so the parts set the run itself.
 */
const NURIA_PARTS: readonly MissionPart[] = [
  { id: 'start', label: 'Desde el principio', detail: 'Bajan de la R4 en Cardedeu', at: 'metro', spot: { environment: STREET, cell: { ...station } }, event: { type: 'arrive', station: 'cardedeu' } },
  { id: 'door', label: 'Nuria en su puerta', detail: 'Haru los ha traído hasta la puerta; aún no presta los gatos', at: 'cardedeu', spot: { environment: STREET, cell: { x: PLACES_NURIA.nuria.cell.x - 1, z: PLACES_NURIA.nuria.cell.z + 2 } }, nuria: { haru: true, led: true } },
  // From her door, so walking up the street turns it into La calle que no acaba (src/street-shift.ts).
  { id: 'lent', label: 'Con los gatos', detail: 'Papagato prestado; calle arriba, la calle se transforma', at: 'cardedeu', spot: { environment: STREET, cell: { x: PLACES_NURIA.nuria.cell.x + 1, z: PLACES_NURIA.nuria.cell.z - 2 } }, nuria: { haru: true, lent: true } },
  { id: 'street', label: 'La calle que no acaba', detail: 'Recta hacia la pompa; se vuelve más inquietante a cada paso', at: 'cardedeu', spot: { environment: PLACES_NURIA.calleIn.environment, cell: { ...PLACES_NURIA.calleIn.cell } }, nuria: { haru: true, lent: true, street: true } },
  { id: 'portal', label: 'Ante la pompa', detail: 'Al final de la calle; acercarse a ella lleva a la torre', at: 'cardedeu', spot: { environment: PLACES_NURIA.calleBack.environment, cell: { ...PLACES_NURIA.calleBack.cell } }, nuria: { haru: true, lent: true, street: true, portal: true } },
  { id: 'ring-1', label: 'La torre · primer anillo', detail: 'Uri delante; ronda El Cebollón', at: 'cardedeu', spot: maze(PLACES_NURIA.mazeIn.cell), nuria: { ...lent, stage: 0 } },
  { id: 'ring-2', label: 'Segundo anillo', detail: 'El Cebollón vencido; ronda El Plato Misterioso', at: 'cardedeu', spot: maze(PLACES_NURIA.uri[0].cell), nuria: { ...lent, stage: 1, beaten: beaten(1) } },
  { id: 'ring-3', label: 'Tercer anillo', detail: 'Ronda La Cebolla con los suyos', at: 'cardedeu', spot: maze(PLACES_NURIA.uri[1].cell), nuria: { ...lent, stage: 2, beaten: beaten(2) } },
  { id: 'summit', label: 'Bajo la cima', detail: 'Uri arriba; subir empieza Vertitrón', at: 'cardedeu', spot: maze(PLACES_NURIA.uri[2].cell), nuria: { ...lent, stage: 3, beaten: beaten(3) } },
  { id: 'vertigo', label: 'Vertitrón', detail: 'En la cima: el combate empieza al llegar', at: 'cardedeu', spot: maze(PLACES_NURIA.summit.cell), nuria: { ...lent, stage: 3, beaten: beaten(3) } },
  { id: 'won', label: 'Uri vuelve en sí', detail: 'El final: las dos luces van con Gerard y Aitor', at: 'cardedeu', spot: maze(PLACES_NURIA.uri[2].cell), nuria: { ...lent, stage: 3, beaten: beaten(3) }, event: { type: 'battle', won: true, encounter: 'uri-vertigo' } },
  { id: 'done', label: 'Misión hecha', detail: 'A la mañana siguiente, en casa', at: 'nuria-uri' },
];
/** The parts each mission can start at; one without its own list starts at its beginning or at each step. */
export function missionParts(anima: AnimaId): readonly MissionPart[] {
  if (anima === 'nuria') return NURIA_PARTS;
  const arc = ARCS.find(a => a.anima === anima)!;
  return [
    { id: 'start', label: 'Desde el principio', detail: arc.detail, at: arc.after!, spot: spotAt(arc.after!) },
    ...arc.steps.map(step => ({ id: step.flags[0], label: step.label, detail: arc.detail, at: step.flags.at(-1)!, spot: step.spot })),
  ];
}
/** What a jump to a mission's part starts with: the flags (other missions in `withAnimas` too), where it stands, its run and event. */
export function missionJump(anima: AnimaId, partId: string, withAnimas: readonly AnimaId[] = []) {
  const part = missionParts(anima).find(p => p.id === partId);
  if (!part) return undefined;
  return { part, flags: flagsAt(part.at, withAnimas.filter(id => id !== anima)), spot: part.spot ?? spotAt(part.at) };
}

/** The highest level an ánima can reach (those without a level table stay at 1). */
export const topLevel = (id: ClassId) => LEVELLED.includes(id) ? MAX_LEVEL : 1;
/**
 * Where a mission is now, as the part a jump to it would start at: the last one the flags and the
 * run have reached (`undefined` before the mission can start).
 */
export function missionNow(anima: AnimaId, flags: readonly StoryFlag[], nuria?: NuriaRun): string | undefined {
  const parts = missionParts(anima), arc = ARCS.find(a => a.anima === anima)!;
  if (arc.after && !flags.includes(arc.after)) return undefined;
  if (anima === 'nuria') {
    if (flags.includes('nuria-uri')) return 'done';
    if (nuria?.entered) return nuria.stage >= PLACES_NURIA.uri.length ? 'summit' : `ring-${nuria.stage + 1}`;
    if (nuria?.portal) return 'portal';
    if (nuria?.street) return 'street';
    if (nuria?.lent) return 'lent';
    return flags.includes('cardedeu') ? 'door' : 'start';
  }
  return [...parts].reverse().find(p => p.id !== 'start' && flags.includes(p.at))?.id ?? 'start';
}
