/**
 * The development picker's story points (src/jump-menu.ts, docs/dev-tools.md): the story as
 * chapters, arcs and steps. Chapter 1 runs in one line; chapter 2 is open, so its arcs only need
 * the one they hang from, and each ánima mission stands on its own. Pure: `main.ts` turns a
 * point into the flags to start with and where to stand.
 */
import { NUCLI, PLACES_BERNAT } from './friends/bernat.ts';
import { ANIMA_IDS, type AnimaId } from './animas.ts';
import type { ClassId } from './battle.ts';
import { castleEntry } from './castle.ts';
import { PLACES } from './chapter-1.ts';
import { ENVIRONMENTS, type EnvironmentId } from './environments.ts';
import { FEARS, PLACES_NURIA, STREET } from './friends/nuria.ts';
import { topOf } from './levels.ts';
import type { Cell } from './movement.ts';
import { STORY_FLAGS, type EmilieRun, type LucaRun, type MartaRun, type NuriaRun, type StoryEvent, type StoryFlag, type UniRun } from './story.ts';
import { BEACH, CAMP, CAMP_HUNTERS, PLACES_CAMP, PLACES_UNI } from './friends/universidad.ts';
import { CUERDAS_PLACE, PLACES_CUERDAS, PLACES_MARTA, QUALITIES } from './friends/marta.ts';
import { MODELO_PLACE, PISO, PLACES_EMILIE, PLACES_MODELO, PLACES_PISO, POBLE_SEC } from './friends/emilie.ts';
import { GALLERY, ZONE_IDS, arrival, beat, createModelo, patrolsIn, type ModeloState, type ZoneId } from './modelo.ts';
import { INTERIOR, PLACES_LUCA, SAGRADA, ZONES } from './friends/luca.ts';
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
    { flags: ['caught'], label: 'Atrapados: despierta a los 35' }, { flags: ['got-wrapper'], label: 'El envoltorio' }, { flags: ['got-bola'], label: 'La bola de nieve' },
    // The ticker carries the R4 clue: seeing the news is knowing it.
    { flags: ['tv-news', 'clue-r4', 'clue-sagrada'], label: 'Las noticias: las pistas del R4 y de la Sagrada Família' },
  ] },
  { id: 'city', chapter: 2, title: 'La ciudad', detail: 'Tras las noticias', after: 'tv-news', steps: [
    { flags: ['metro'], label: 'Primer metro', spot: { environment: 'meridiana-calle' } },
    { flags: ['rec-comtal'], label: 'Escola Rec Comtal', spot: { environment: 'rec-comtal' } },
    { flags: ['castle'], label: 'Dentro del castillo', spot: castle },
    { flags: ['palace-tried'], label: 'Primera caída en el castillo' },
  ] },
  // Memory tickets (src/tickets.ts): each step opens one more station on the map, in this order.
  { id: 'billetes', chapter: 2, title: 'Billetes-recuerdo', detail: 'La tableta de la estación', after: 'metro', steps: [
    { flags: ['ticket-cardedeu'], label: 'Nuria y Uri en Cardedeu', spot: { environment: 'meridiana-calle' } },
    { flags: ['ticket-barceloneta'], label: 'Los de la uni en la Barceloneta', spot: { environment: 'meridiana-calle' } },
    { flags: ['ticket-sagrada-familia'], label: 'Luca en la Sagrada Família', spot: { environment: 'meridiana-calle' } },
    { flags: ['ticket-placa-de-sants'], label: 'Bernat en El Nucli (Sants)', spot: { environment: 'meridiana-calle' } },
    { flags: ['ticket-poble-sec'], label: 'Emilie en Poble Sec', spot: { environment: 'meridiana-calle' } },
    { flags: ['ticket-el-carmel'], label: 'Aitor en los Búnkers del Carmel', spot: { environment: 'meridiana-calle' } },
    { flags: ['ticket-alegia'], label: 'Marta cantando en Alegia (el tren largo)', spot: { environment: 'meridiana-calle' } },
    { flags: ['ticket-espanya'], label: "Aitor en Plaça d'Espanya", spot: { environment: 'meridiana-calle' } },
  ] },
  { id: 'nuria', chapter: 2, title: 'Misión de Nuria y Uri', detail: 'Cardedeu', after: 'metro', anima: 'nuria', steps: [
    { flags: ['cardedeu'], label: 'La R4 hasta Cardedeu', spot: { environment: 'cardedeu' } },
    // Winning at the top of the tower sets them all at once (story.ts): Papagato, the ánima and the two lights.
    { flags: ['nuria-uri', 'papagato', 'luz-nuria', 'luz-uri', 'anima-nuria'], label: 'Uri vuelve en sí' },
  ] },
  { id: 'universidad', chapter: 2, title: 'Misión de los amigos de la uni', detail: 'La Barceloneta · Càmping Eurosport', after: 'metro', anima: 'universidad', steps: [
    { flags: ['clue-uni'], label: 'Aitor: los de la uni esperan en la playa' },
    { flags: ['barceloneta-uni'], label: 'En la playa, con los siete', spot: { environment: 'barceloneta' } },
    { flags: ['camping'], label: 'Dentro de la espiral: el camping' },
    { flags: ['candado'], label: 'El candado del portón: las tres palabras' },
    { flags: ['parcelas'], label: 'Las parcelas resueltas: la puerta del merendero' },
    // Beating La Sobremesa frees the seven and gives their ánima and five lights (a couple, one; alone, one each).
    { flags: ['sobremesa', 'anima-universidad', 'luz-anna-alvaro', 'luz-miquel-sarah', 'luz-soraya', 'luz-nico', 'luz-joan'], label: 'Libres: La Sobremesa vencida' },
  ] },
  { id: 'marta', chapter: 2, title: 'Misión de Marta', detail: 'Alegia · Las cuerdas', after: 'metro', anima: 'marta', steps: [
    { flags: ['alegia-marta'], label: 'Marta en Alegia: no le sale la voz', spot: { environment: 'alegia', cell: { ...PLACES_MARTA.back } } },
    { flags: ['cuerdas'], label: 'El piano: dentro de Las cuerdas' },
    // Beating La Voz gives her everything back at once, and her ánima and light with it.
    { flags: ['voz', 'anima-marta', 'luz-marta'], label: 'La Voz vencida: Marta vuelve a cantar' },
  ] },
  { id: 'emilie', chapter: 2, title: 'Misión de Emilie', detail: 'Poble Sec · Su modelo', after: 'metro', anima: 'emilie', steps: [
    // Aitor, one morning: she has not written since the castle came out, and her streets are flooding.
    { flags: ['clue-emilie'], label: 'Aitor: Emilie no contesta, y hay una fuga en el Poble Sec' },
    { flags: ['poble-sec-emilie'], label: 'Emilie en su piso inundado: ha perdido el porqué', spot: { environment: PISO, cell: { ...PLACES_PISO.laptop } } },
    { flags: ['modelo'], label: 'El portátil: dentro de su modelo' },
    // Beating El que no converge gives her the why back at once, and her ánima and light with it.
    { flags: ['converge', 'anima-emilie', 'luz-emilie'], label: 'El que no converge vencido: Emilie entiende otra vez' },
  ] },
  { id: 'luca', chapter: 2, title: 'Misión de Luca', detail: 'La Sagrada Família · La peluquería de Fran', after: 'metro', anima: 'luca', steps: [
    { flags: ['clue-luca-foto'], label: 'La foto: Luca se ha quedado gris', spot: { environment: 'meridiana' } },
    { flags: ['clue-sagrada-cartel'], label: 'El cartel de la Sagrada Família', spot: { environment: 'meridiana-calle' } },
    { flags: ['sagrada-luca'], label: 'Luca, gris, junto al estanque', spot: { environment: SAGRADA, cell: { ...PLACES_LUCA.won } } },
    { flags: ['peluqueria'], label: 'Dentro: la peluquería de Fran', spot: { environment: INTERIOR, cell: { ...PLACES_LUCA.inside } } },
    // Beating Fran gives Luca everything back at once, and his ánima and light with it.
    { flags: ['fran', 'anima-luca', 'luz-luca'], label: 'Fran vencido: Luca, a todo color', spot: { environment: SAGRADA, cell: { ...PLACES_LUCA.won } } },
  ] },
  // Bernat the first time (docs/quests/bernat.md): the confidant at his table in El Nucli.
  { id: 'bernat', chapter: 2, title: 'Bernat', detail: 'El Nucli · Sants', after: 'metro', steps: [
    { flags: ['bernat-nucli'], label: 'Bernat en El Nucli: es el castillo de su libreta', spot: { environment: NUCLI, cell: { ...PLACES_BERNAT.portal } } },
  ] },
  // The castle's three phases and its end (docs/castle.md): each boss beaten moves the way in to its room.
  { id: 'castillo', chapter: 2, title: 'El castillo', detail: 'Tres plantas, tres jefes y el final', after: 'castle', steps: [
    { flags: ['aurelia', 'luz-aurelia'], label: 'Aurelià vencido: la entrada pasa al gimnasio', spot: castleEntry(new Set(['aurelia'])) },
    { flags: ['direccion', 'luz-mar', 'luz-montse', 'luz-pilar'], label: 'Dirección vencida: la entrada pasa a Direcció', spot: castleEntry(new Set(['direccion'])) },
    { flags: ['aitor-poseido'], label: 'La Reina toma a Aitor: Gerard cae' },
    // Bernat's part (docs/quests/bernat.md, rounds 5 and 6): his call, the game told and his model of the flat, its riddle solved.
    { flags: ['bernat-llama'], label: 'Llama Bernat: venid a El Nucli', spot: { environment: 'meridiana' } },
    { flags: ['bernat-juego'], label: 'En El Nucli: «estamos dentro de un juego»; la maqueta del piso', spot: { environment: NUCLI, cell: { ...PLACES_BERNAT.portal } } },
    { flags: ['portal-nucli', 'artilugio'], label: 'El acertijo de la maqueta resuelto: el artilugio, en casa', spot: { environment: 'meridiana' } },
    { flags: ['reina'], label: 'La Reina, vencida' },
  ] },
  // Only one of the two is ever set: each ending hangs from her fall on its own.
  { id: 'final-acabar', chapter: 2, title: 'Final · Acabar', detail: 'El lunes después', after: 'reina', steps: [
    { flags: ['final-acabar'], label: 'Gerard acaba: todo en orden, un poco más gris' },
  ] },
  { id: 'final-bajar', chapter: 2, title: 'Final · Bajar la mano', detail: 'El lunes después', after: 'reina', steps: [
    { flags: ['final-bajar'], label: 'Gerard baja la mano: queda algo de rosa' },
  ] },
  // Ánimas grow with the EXP of fights won (src/levels.ts); Matemágico's are chapter 2's, at 35.
  { id: 'matemagico', chapter: 2, title: 'Matemágico crece', detail: 'Experiencia de combate', after: 'caught', steps: [
    { flags: ['matemagico-2'], label: 'Matemágico, nivel 2' }, { flags: ['matemagico-3'], label: 'Matemágico, nivel 3' },
  ] },
  { id: 'papagato', chapter: 2, title: 'Papagato crece', detail: 'Experiencia de combate', after: 'papagato', steps: [
    { flags: ['papagato-2'], label: 'Papagato, nivel 2' }, { flags: ['papagato-3'], label: 'Papagato, nivel 3' },
  ] },
  { id: 'dadaista', chapter: 2, title: 'Dadista crece', detail: 'Experiencia de combate', after: 'anima-universidad', steps: [
    { flags: ['dadaista-2'], label: 'Dadista, nivel 2' }, { flags: ['dadaista-3'], label: 'Dadista, nivel 3' },
    { flags: ['dadaista-4'], label: 'Dadista, nivel 4' }, { flags: ['dadaista-5'], label: 'Dadista, nivel 5' },
    { flags: ['dadaista-6'], label: 'Dadista, nivel 6' }, { flags: ['dadaista-7'], label: 'Dadista, nivel 7' },
  ] },
] as const satisfies readonly Arc[];

/**
 * The main line's key events, in order: the picker's timeline (src/jump-menu.ts). Marking one marks
 * everything before it; the ánima missions hang from `metro` and are ticked on their own.
 */
export const TIMELINE: readonly { at: StoryFlag | 'new'; label: string }[] = [
  { at: 'new', label: 'Inicio' }, { at: 'got-backpack', label: 'Mochila' }, { at: 'bernat-joined', label: 'Bernat' },
  { at: 'first-fight', label: 'Primer combate' }, { at: 'in-palace', label: 'Palacio' }, { at: 'matemagico', label: 'Mate\u00admágico' },
  { at: 'caught', label: '35 años' }, { at: 'got-bola', label: 'Bola de nieve' }, { at: 'tv-news', label: 'Noticias' },
  { at: 'metro', label: 'Primer metro' }, { at: 'castle', label: 'Castillo' },
  { at: 'aurelia', label: 'Aurelià' }, { at: 'direccion', label: 'Dirección' }, { at: 'artilugio', label: 'Artilugio' }, { at: 'reina', label: 'La Reina' },
];

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
  uni?: Partial<UniRun>;
  marta?: Partial<MartaRun>;
  emilie?: Partial<EmilieRun>;
  luca?: Partial<LucaRun>;
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
const beach = (x: number, z: number): Spot => ({ environment: BEACH, cell: { x, z } });
const camp = (cell: Cell): Spot => ({ environment: CAMP, cell: { ...cell } });
/**
 * The university friends' mission, part by part (docs/quests/universidad.md § Beats). The game of tag
 * and the spiral are not saved (a fall or a new day puts the friends back on the sand), so those parts
 * set the run itself.
 */
const UNI_PARTS: readonly MissionPart[] = [
  { id: 'start', label: 'Desde el principio', detail: 'Bajan de la L4 en la Barceloneta', at: 'clue-uni', spot: { environment: BEACH }, event: { type: 'arrive', station: 'barceloneta' } },
  { id: 'beach', label: 'Detrás de ellos', detail: 'Los seis de espaldas mirando al mar; Anna en el agua', at: 'clue-uni', spot: beach(PLACES_UNI.retry.x, PLACES_UNI.retry.z) },
  { id: 'tag', label: 'El pilla-pilla', detail: 'Corren detrás; el paseo cerrado por los tentáculos', at: 'barceloneta-uni', spot: beach(PLACES_UNI.talk.x, PLACES_UNI.talk.z - 6), uni: { chase: true } },
  { id: 'spiral', label: 'La espiral en el agua', detail: 'Anna se ha ido por ella; entrar lleva al camping', at: 'barceloneta-uni', spot: beach(PLACES_UNI.anna.x, PLACES_UNI.anna.z - 4), uni: { spiral: true, sunk: true } },
  { id: 'camp', label: 'Càmping Eurosport', detail: 'Recién salidos de la espiral; los magos rondan la entrada', at: 'camping', spot: camp(PLACES_CAMP.entrada), uni: { entered: true } },
  { id: 'lock', label: 'El candado', detail: 'Las patrullas vencidas (sus siete palabras dichas); ante el candado del portón de la piscina', at: 'camping', spot: camp({ x: PLACES_CAMP.gate.x + 1, z: PLACES_CAMP.gate.z }), uni: { entered: true, beaten: CAMP_HUNTERS.map(h => h.id), told: ['gate'] } },
  { id: 'pool', label: 'La piscina', detail: 'El candado abierto: El Campeón ante la pizarra del torneo', at: 'candado', spot: camp({ x: PLACES_CAMP.gate.x - 3, z: PLACES_CAMP.gate.z }), uni: { entered: true, beaten: CAMP_HUNTERS.map(h => h.id), told: ['gate'] } },
  { id: 'board', label: 'La pizarra', detail: 'El Campeón vencido; ante la pizarra de la piscina: Las parcelas', at: 'candado', spot: camp({ x: PLACES_CAMP.tablero.x, z: PLACES_CAMP.tablero.z + 1 }), uni: { entered: true, beaten: [...CAMP_HUNTERS.map(h => h.id), 'campeon'], told: ['gate', 'board', 'door'] } },
  { id: 'sobremesa', label: 'La Sobremesa', detail: 'Las parcelas resueltas, la puerta de acero abierta; en la mesa larga del merendero', at: 'parcelas', spot: camp({ x: PLACES_CAMP.foto.x - 6, z: PLACES_CAMP.foto.z + 2 }), uni: { entered: true, beaten: [...CAMP_HUNTERS.map(h => h.id), 'campeon'], told: ['gate', 'board', 'door'] } },
  { id: 'won', label: 'Libres', detail: 'La foto con el melón, las cinco luces y de vuelta en la playa', at: 'parcelas', spot: camp({ x: PLACES_CAMP.foto.x, z: PLACES_CAMP.foto.z + 2 }), uni: { entered: true, beaten: [...CAMP_HUNTERS.map(h => h.id), 'campeon'] }, event: { type: 'battle', won: true, encounter: 'sobremesa' } },
  { id: 'done', label: 'Misión hecha', detail: 'Los siete, libres, en la arena', at: 'luz-joan', spot: beach(PLACES_UNI.home.x, PLACES_UNI.home.z) },
];
const cuerdas = (cell: Cell, dz = 0): Spot => ({ environment: CUERDAS_PLACE, cell: { x: cell.x, z: cell.z + dz } });
const qualities = (n: number) => QUALITIES.slice(0, n).map(q => q.id);
/**
 * Marta's mission, part by part (docs/quests/marta.md § Beats). What is beaten inside Las cuerdas is
 * not saved (it is all one visit), so those parts set the run itself.
 */
const MARTA_PARTS: readonly MissionPart[] = [
  { id: 'start', label: 'Desde el principio', detail: 'En la plaza de Alegia; Marta junto al piano', at: 'metro', spot: { environment: 'alegia', cell: { x: PLACES_MARTA.back.x + 4, z: PLACES_MARTA.back.z + 2 } } },
  { id: 'piano', label: 'El piano', detail: 'Ya han hablado con ella; tocar el piano abre la pompa', at: 'alegia-marta', spot: { environment: 'alegia', cell: { ...PLACES_MARTA.back } } },
  { id: 'inside', label: 'Las cuerdas', detail: 'Recién entrados; el primer laberinto delante', at: 'cuerdas', spot: cuerdas(PLACES_CUERDAS.spawn) },
  { id: 'maze-1', label: 'Dos notas', detail: 'Ante el primer laberinto', at: 'cuerdas', spot: cuerdas(PLACES_CUERDAS.mazes[0].cell, 1) },
  { id: 'lealtad', label: 'La Lealtad', detail: 'Cruzado el primer laberinto; ella y su Eco en la plataforma', at: 'cuerdas', spot: cuerdas(QUALITIES[0].cell, 5) },
  { id: 'maze-2', label: 'Una pasada', detail: 'La Lealtad vencida; ante las piezas rajadas', at: 'cuerdas', spot: cuerdas(PLACES_CUERDAS.mazes[1].cell, 1), marta: { beaten: qualities(1) } },
  { id: 'cristalino', label: 'Lo Cristalino', detail: 'Cruzado el segundo laberinto', at: 'cuerdas', spot: cuerdas(QUALITIES[1].cell, 5), marta: { beaten: qualities(1) } },
  { id: 'maze-3', label: 'Las clavijas', detail: 'Lo Cristalino vencido; las filas por afinar', at: 'cuerdas', spot: cuerdas(PLACES_CUERDAS.mazes[2].cell, 1), marta: { beaten: qualities(2) } },
  { id: 'directo', label: 'Lo Directo', detail: 'Cruzado el tercer laberinto', at: 'cuerdas', spot: cuerdas(QUALITIES[2].cell, 5), marta: { beaten: qualities(2) } },
  { id: 'voz', label: 'La Voz', detail: 'Las tres vencidas; el centro, donde se juntan todas las cuerdas', at: 'cuerdas', spot: cuerdas(PLACES_CUERDAS.voz, 10), marta: { beaten: qualities(3) } },
  { id: 'won', label: 'Marta vuelve a cantar', detail: 'El final: su luz va con Gerard y Aitor, de vuelta en Alegia', at: 'cuerdas', spot: cuerdas(PLACES_CUERDAS.voz, 10), marta: { beaten: qualities(3) }, event: { type: 'battle', won: true, encounter: 'voz' } },
  { id: 'done', label: 'Misión hecha', detail: 'Marta, ella otra vez, junto al piano', at: 'luz-marta', spot: { environment: 'alegia', cell: { ...PLACES_MARTA.back } } },
];
/**
 * The run through Emilie's model having come down into `zone`: in each zone above, its first patrol
 * beaten (the power its lift needed) and nothing measured.
 */
function cameDown(zone: ZoneId): ModeloState {
  const run = createModelo();
  for (const up of ZONE_IDS.slice(0, ZONE_IDS.indexOf(zone))) beat(run, patrolsIn(up)[0].id);
  run.zone = zone;
  return run;
}
const modelo = (x: number): Spot => ({ environment: MODELO_PLACE, cell: { x, z: GALLERY.row } });
const told = (...zones: string[]) => ['door', ...zones.map(z => `modelo-zona-${z}`)];
/**
 * Emilie's mission, part by part (docs/quests/emilie.md). The run through her model is not saved (it is
 * one visit, kept while they come and go by her laptop), so the parts inside it set the run itself.
 */
const EMILIE_PARTS: readonly MissionPart[] = [
  { id: 'start', label: 'Desde el principio', detail: 'En Poble Sec, ante su portal; sale agua por debajo', at: 'metro', spot: { environment: POBLE_SEC, cell: { x: PLACES_EMILIE.door.x, z: PLACES_EMILIE.door.z + 1 } } },
  { id: 'piso', label: 'Su piso', detail: 'Recién subidos; Emilie de pie en el agua', at: 'metro', spot: { environment: PISO, cell: { ...PLACES_PISO.spawn } }, emilie: { told: told() } },
  { id: 'laptop', label: 'El portátil', detail: 'Ya han hablado con ella; su modelo abierto en la mesa', at: 'poble-sec-emilie', spot: { environment: PISO, cell: { ...PLACES_PISO.laptop } }, emilie: { told: told() } },
  { id: 'suelo', label: 'El suelo', detail: 'Recién entrados en el modelo; una patrulla que viene y el pozo al fondo', at: 'modelo', spot: modelo(PLACES_MODELO.spawn.x), emilie: { told: told() } },
  { id: 'gravas', label: 'Las gravas', detail: 'Bajados en el ascensor de El suelo; el pozo siguiente, al otro lado', at: 'modelo', spot: modelo(arrival('gravas')), emilie: { told: told(), section: cameDown('gravas') } },
  { id: 'ciudad', label: 'Bajo la ciudad', detail: 'El túnel de la L3 y sus bombas', at: 'modelo', spot: modelo(arrival('ciudad')), emilie: { told: told('gravas'), section: cameDown('ciudad') } },
  { id: 'fondo', label: 'El fondo', detail: 'El que no converge delante; el combate empieza al acercarse', at: 'modelo', spot: modelo(arrival('fondo')), emilie: { told: told('gravas', 'ciudad'), section: cameDown('fondo') } },
  { id: 'won', label: 'Emilie entiende otra vez', detail: 'El final: su luz va con Gerard y Aitor, de vuelta en su piso', at: 'modelo', spot: modelo(arrival('fondo')), emilie: { told: [...told('gravas', 'ciudad', 'fondo'), 'modelo-jefe'], section: cameDown('fondo') }, event: { type: 'battle', won: true, encounter: 'no-converge' } },
  { id: 'done', label: 'Misión hecha', detail: 'Emilie, ella otra vez, en su piso', at: 'luz-emilie', spot: { environment: PISO, cell: { ...PLACES_PISO.laptop } } },
];
const salon = (x: number, z: number): Spot => ({ environment: INTERIOR, cell: { x, z } });
const zones = (n: number) => ZONES.slice(0, n).map(z => z.id);
const sagradaStation = ENVIRONMENTS[SAGRADA].interactions.find(i => i.id === entranceId('sagrada-familia'))?.cell;
/**
 * Luca's mission, part by part (docs/quests/luca.md § Beats). What is won inside the salon is not
 * saved (it is all one visit), so those parts set the run itself.
 */
const LUCA_PARTS: readonly MissionPart[] = [
  { id: 'start', label: 'Desde el principio', detail: 'Salen del metro en la Sagrada Família', at: 'metro', spot: { environment: SAGRADA, ...sagradaStation ? { cell: { ...sagradaStation } } : {} }, event: { type: 'arrive', station: 'sagrada-familia' } },
  { id: 'luca', label: 'Luca junto al estanque', detail: 'Gris, frente a la fachada del Nacimiento; aún no han hablado', at: 'metro', spot: { environment: SAGRADA, cell: { ...PLACES_LUCA.won } } },
  { id: 'door', label: 'La puerta del Nacimiento', detail: 'Ya han hablado con Luca; entrar lleva a la peluquería', at: 'sagrada-luca', spot: { environment: SAGRADA, cell: { ...PLACES_LUCA.outside } } },
  { id: 'recepcion', label: 'La recepción', detail: 'Recién entrados; las polillas delante', at: 'peluqueria', spot: salon(36, 36), luca: { entered: true, told: ['dentro'] } },
  { id: 'sillones', label: 'Los sillones', detail: 'La recepción ganada; la cola de la nave ha avanzado: los capellanes', at: 'peluqueria', spot: salon(21, 20), luca: { entered: true, beaten: zones(1), told: ['dentro'] } },
  { id: 'espejos', label: 'Los espejos de la nave', detail: 'La recepción ganada; entran en la nave y la luz de la vidriera acaba en la pared: dos espejos por girar', at: 'peluqueria', spot: salon(22, 14), luca: { entered: true, beaten: zones(1), told: ['dentro'] } },
  { id: 'carta', label: 'La carta de colores', detail: 'La nave ganada; la cola de la Pasión ha avanzado y esperan los Estampados', at: 'peluqueria', spot: salon(36, 9), luca: { entered: true, beaten: zones(2), told: ['dentro'] } },
  { id: 'abside', label: 'El ábside, zona de Fran', detail: 'Las tres zonas ganadas; la cola del ábside ha avanzado: las lentes y las cartas de Luca, delante de Fran', at: 'peluqueria', spot: salon(50, 21), luca: { entered: true, beaten: zones(3), told: ['dentro'] } },
  { id: 'crucero', label: 'El crucero', detail: 'Las tres ganadas; el capellán deja pasar a Fran', at: 'peluqueria', spot: salon(38, 21), luca: { entered: true, beaten: zones(3), told: ['dentro', 'abside'] } },
  { id: 'fran', label: 'Fran', detail: 'El capellán deja pasar: el combate empieza en cuanto llegan', at: 'peluqueria', spot: salon(38, 21), luca: { entered: true, beaten: zones(3), told: ['dentro', 'abside'] }, event: { type: 'interact', id: 'talk-capellan' } },
  { id: 'won', label: 'Luca, a todo color', detail: 'El final: Fran se va, y fuera la luz de Luca va con Gerard y Aitor', at: 'peluqueria', spot: salon(38, 21), luca: { entered: true, beaten: zones(3), told: ['dentro', 'abside'] }, event: { type: 'battle', won: true, encounter: 'fran' } },
  { id: 'done', label: 'Misión hecha', detail: 'Luca, a todo color, junto al estanque', at: 'luz-luca', spot: { environment: SAGRADA, cell: { ...PLACES_LUCA.won } } },
];
/** The parts each mission can start at; one without its own list starts at its beginning or at each step. */
export function missionParts(anima: AnimaId): readonly MissionPart[] {
  if (anima === 'nuria') return NURIA_PARTS;
  if (anima === 'universidad') return UNI_PARTS;
  if (anima === 'marta') return MARTA_PARTS;
  if (anima === 'emilie') return EMILIE_PARTS;
  if (anima === 'luca') return LUCA_PARTS;
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
export const topLevel = (id: ClassId) => topOf(id);
/**
 * Where a mission is now, as the part a jump to it would start at: the last one the flags and the
 * run have reached (`undefined` before the mission can start).
 */
export function missionNow(anima: AnimaId, flags: readonly StoryFlag[], nuria?: NuriaRun, uni?: UniRun, luca?: LucaRun): string | undefined {
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
  if (anima === 'emilie') return flags.includes('converge') ? 'done' : flags.includes('modelo') ? 'suelo' : flags.includes('poble-sec-emilie') ? 'laptop' : 'start';
  if (anima === 'universidad') {
    if (flags.includes('sobremesa')) return 'done';
    if (flags.includes('parcelas')) return 'sobremesa';
    if (flags.includes('candado')) return uni?.beaten.includes('campeon') ? 'board' : 'pool';
    if (uni?.entered) return uni.told.includes('gate') ? 'lock' : 'camp';
    if (uni?.spiral) return 'spiral';
    if (uni?.chase) return 'tag';
    return flags.includes('barceloneta-uni') || flags.includes('clue-uni') ? 'beach' : 'start';
  }
  if (anima === 'luca') {
    if (flags.includes('fran')) return 'done';
    if (luca?.entered || flags.includes('peluqueria')) return ['recepcion', 'espejos', 'carta', 'abside'][Math.min(3, luca?.beaten.length ?? 0)];
    return flags.includes('sagrada-luca') ? 'door' : 'luca';
  }
  return [...parts].reverse().find(p => p.id !== 'start' && flags.includes(p.at))?.id ?? 'start';
}
