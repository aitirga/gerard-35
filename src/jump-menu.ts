import { ANIMAS, ANIMA_IDS, type AnimaId } from './animas';
import { canWear, DUALS, STAGED_MOMENTS, type ClassId, type Encounter, type StagedMoment } from './battle';
import type { FightMoment } from './battle-ui';
import { CASTLE_ENCOUNTERS, CASTLE_FIGHTS as CASTLE_ROOMS, CASTLE_FIGHT_NAMES, CASTLE_NAMES, castlePhase, type CastlePhaseId } from './castle.ts';
import { CLASSES } from './classes';
import { IMPROVEMENTS, TREE_ANIMAS, improvementOf } from './ecos';
import { xpFloor, LEVELLED } from './levels';
import type { EnvironmentId } from './environments';
import { dayForStage } from './days';
import { nightMight, nightTier } from './night';
import { STORY_ARCS, TIMELINE, isChapter2, missionParts, missionsDone, topLevel, type Arc } from './story-points';
import type { StoryFlag } from './story';
import type { GameSummary } from './game-sim';
import { GAME_REPORT, simPage, type SimJump } from './game-sim-panel';

/**
 * The place panel's picker: the places to go to and, in development, story points to jump to and
 * a fight tester (docs/dev-tools.md). A non-modal dialog under the panel, so the street stays in view.
 */
interface Place { id: EnvironmentId; name: string; detail: string; group: string; open: boolean }
/** `open`: reachable from the picker in production too (the places the old dropdown offered). */
const PLACES: Place[] = [
  { id: 'maresme', name: 'Passatge Maresme', detail: 'La calle de casa', group: 'Sant Quirze del Vallès', open: true },
  { id: 'home-entrance', name: 'Casa de Gerard · Entrada', detail: 'Passatge Maresme, 20', group: 'Sant Quirze del Vallès', open: false },
  { id: 'home-floor-1', name: 'Casa de Gerard · Planta 1', detail: 'Passatge Maresme, 20', group: 'Sant Quirze del Vallès', open: false },
  { id: 'home-floor-2', name: 'Casa de Gerard · Planta 2', detail: 'Passatge Maresme, 20', group: 'Sant Quirze del Vallès', open: false },
  { id: 'palacio', name: 'Palacio de la Reina Bubbaloo', detail: 'Al final de la calle', group: 'Sant Quirze del Vallès', open: false },
  { id: 'meridiana', name: 'Meridiana · Casa de Gerard y Aitor', detail: 'El piso', group: 'Barcelona', open: true },
  { id: 'meridiana-calle', name: 'Avinguda Meridiana', detail: 'La calle del piso', group: 'Barcelona', open: true },
  { id: 'rec-comtal', name: 'Escola Rec Comtal', detail: 'Trinitat Vella', group: 'Barcelona', open: true },
  { id: 'cardedeu', name: 'Cardedeu · Jacint Verdaguer', detail: 'La calle de Nuria, de la estación al centro', group: 'Cardedeu', open: false },
  { id: 'cardedeu-calle', name: 'La calle que no acaba', detail: 'Jacint Verdaguer, recta hasta la pompa', group: 'Cardedeu', open: false },
  { id: 'cardedeu-laberinto', name: 'La torre de Uri', detail: 'Al otro lado de la pompa', group: 'Cardedeu', open: false },
  { id: 'bunkers-carmel', name: 'Búnkers del Carmel', detail: 'Turó de la Rovira', group: 'Barcelona', open: false },
  { id: 'barceloneta', name: 'La Barceloneta', detail: 'La playa · L4', group: 'Barcelona', open: true },
  { id: 'camping', name: 'Càmping Eurosport', detail: 'Al otro lado de la espiral', group: 'Barcelona', open: false },
  { id: 'sants', name: 'Sants · Carrer de Valladolid', detail: 'De la Plaça de Sants a El Nucli', group: 'Barcelona', open: true },
  { id: 'el-nucli', name: 'El Nucli', detail: 'La tienda de juegos, Sants', group: 'Barcelona', open: true },
  { id: 'poble-sec', name: 'Poble Sec · Carrer de Blai', detail: 'Donde vive Emilie', group: 'Barcelona', open: false },
  { id: 'placa-espanya', name: "Plaça d'Espanya", detail: 'Metro Espanya, L1 y L3', group: 'Barcelona', open: false },
  { id: 'sagrada-familia', name: 'Sagrada Família', detail: 'Plaça de Gaudí', group: 'Barcelona', open: false },
  { id: 'sagrada-familia-interior', name: 'Sagrada Família · Interior', detail: 'La nave', group: 'Barcelona', open: false },
  { id: 'palacio-patio', name: 'Palacio · El patio', detail: 'Dentro de la escuela', group: 'Palacio de la Reina', open: false },
  { id: 'palacio-gimnasio', name: 'Palacio · El gimnasio', detail: 'Dentro de la escuela', group: 'Palacio de la Reina', open: false },
  { id: 'palacio-secretaria', name: 'Palacio · La secretaría', detail: 'Dentro de la escuela', group: 'Palacio de la Reina', open: false },
  { id: 'palacio-trono', name: 'Palacio · El salón del trono', detail: 'Dentro de la escuela', group: 'Palacio de la Reina', open: false },
  { id: 'castillo-1', name: 'Castillo · Primer curso', detail: 'Del patio al gimnasio; cambia cada día', group: 'Palacio de la Reina', open: false },
  { id: 'castillo-2', name: 'Castillo · Segundo curso', detail: 'Del gimnasio a la secretaría; cambia cada día', group: 'Palacio de la Reina', open: false },
  { id: 'castillo-3', name: 'Castillo · Tercer curso', detail: 'De Direcció al trono; cambia cada día', group: 'Palacio de la Reina', open: false },
  { id: 'alegia', name: 'Alegia · San Juan kalea', detail: 'Donde está Marta', group: 'Alegia', open: true },
  { id: 'cuerdas', name: 'Las cuerdas', detail: 'Al otro lado de la pompa', group: 'Alegia', open: false },
  { id: 'piso-emilie', name: 'Casa de Emilie', detail: 'Carrer de Margarit, Poble Sec', group: 'Barcelona', open: false },
  { id: 'modelo', name: 'El modelo de Emilie', detail: 'Dentro de su portátil', group: 'Barcelona', open: false },
  { id: 'patio', name: 'El patio', detail: 'Prueba de movimiento', group: 'Otros lugares', open: true },
];
export const placeName = (id: EnvironmentId) => PLACES.find(p => p.id === id)?.name ?? id;

/** Days of chapter 2 to wake up on (7 is the last). */
const DAYS = [1, 2, 3, 4, 5, 6, 7];
/** Her castle's stages (days.ts `stage`, the TV's headlines), for the way home at night. */
const CASTLE_STAGES = ['Aparece', 'Crece', 'Sant Andreu', 'Hacia la Meridiana', 'En la Meridiana'];
const TIER_NAMES: Record<string, string> = { calma: 'calma', tensa: 'tensa', dura: 'dura', ultima: 'última' };

/** Uri's tower (chapter 2): his fears, Vertitrón and the young of each ring. */
const TOWER_FIGHTS = ['cebollon', 'cebolla', 'plato', 'escolta', 'uri-vertigo', 'crias-1', 'crias-2', 'crias-3'] as const;
/** The university friends' mission (docs/quests/universidad.md): La Sobremesa. */
const UNI_FIGHTS = ['sobremesa'] as const;
/** Càmping Eurosport, the university friends' dungeon (docs/quests/universidad.md): its small fights, the black pitch and El Campeón. */
const CAMPING_FIGHTS = ['camping-magos', 'camping-dados', 'camping-agentes', 'camping-tienda', 'camping-negra', 'campeon'] as const;
/** Las cuerdas, Marta's dungeon (docs/quests/marta.md): a quality after each maze, and La Voz. */
const CUERDAS_FIGHTS = ['cuerdas-lealtad', 'cuerdas-cristalino', 'cuerdas-directo', 'voz'] as const;
/** The castle (docs/castle.md): each room's pupils by year, La Delegada, Aurelià, the management team and the Queen. */
const CASTLE_FIGHTS = CASTLE_ENCOUNTERS;
/** Emilie's model (docs/quests/emilie.md): a fight in each zone of the section, and El que no converge. */
const MODELO_FIGHTS = ['modelo-celdas', 'modelo-oscilacion', 'modelo-atomo', 'no-converge'] as const;
/** Fran's salon, Luca's dungeon (docs/quests/luca.md): a fight in each zone, under the walking light. */
const LUCA_FIGHTS = ['luca-recepcion', 'luca-sillones', 'luca-carta', 'fran'] as const;
export type FightEncounter = 'dogs' | 'possessed' | 'palace-minion' | 'palace-guards' | 'night-guard' | (typeof TOWER_FIGHTS)[number] | (typeof UNI_FIGHTS)[number] | (typeof CAMPING_FIGHTS)[number] | (typeof CUERDAS_FIGHTS)[number] | (typeof CASTLE_FIGHTS)[number] | (typeof MODELO_FIGHTS)[number] | (typeof LUCA_FIGHTS)[number];
/** What the fight tester starts: who fights, wearing what, against whom, and the help it gives. */
export interface FightSetup {
  adult: boolean; partner: boolean;
  wear: { gerard?: ClassId; aitor?: ClassId };
  animas: ClassId[]; friends: AnimaId[];
  encounter: FightEncounter; foes: number;
  /** Skills cost no PM. */
  free: boolean;
  /** No blow takes the party's PV. */
  immune: boolean;
  /**
   * Sin límites: every ánima unlocked at its top level for whoever can wear it, maná always full in
   * all of them, and skills with no limit of use (cures on anyone standing, boosts and marks again
   * while they run, every dual as often as wanted).
   */
  unbound: boolean;
  /** Crítico seguro: every blow of the party is a golpe crítico (to see it, and what it does to the numbers). */
  crit: boolean;
  /** Contratiempo seguro: every action of Sincopante's wearer counts as pressed in the off-beat (A contratiempo, its level 3). */
  offbeat?: boolean;
  /** Encarnados (src/castle.ts `STRONG`): the castle's pupils of a room, or the night's, red inside and stronger. */
  strong?: boolean;
  /** What the Ecos de luz are in for this fight (src/ecos.ts): awake improvements, whatever they would cost. */
  improved: string[];
  trial?: keyof typeof DUAL_TRIALS;
}
/** The help any fight gets in development, the story's too. */
export type FightHelp = Pick<FightSetup, 'free' | 'immune' | 'unbound' | 'crit' | 'offbeat'>;
const CLASS_IDS = Object.keys(CLASSES) as ClassId[];
export const DEFAULT_FIGHT: FightSetup = { adult: false, partner: true, wear: { gerard: 'matemagico' }, animas: [...CLASS_IDS], friends: [], encounter: 'dogs', foes: 3, free: true, immune: false, unbound: false, crit: false, improved: [] };
const DUAL_TRIALS = {
  'sutura-de-luz': { gerard: 'matemagico', aitor: 'tecnopata', encounter: 'cuerdas-lealtad', improved: ['matemagico:cardioide'] },
  'relevo-de-sangre': { gerard: 'papagato', aitor: 'dadaista', encounter: 'crias-2', improved: [] },
  'bombardeo-orbital': { gerard: 'sincopante', aitor: 'tecnopata', encounter: 'camping-dados', improved: ['tecnopata:explosion'] },
  'reserva-de-color': { gerard: 'matemagico', aitor: 'prismatico', encounter: 'luca-recepcion', improved: [] },
  // Grade III (docs/animas/README.md § Dúos mayores): the bit wall going off, and the volcano (its node bought, with Combustión).
  sobrecalentamiento: { gerard: 'matemagico', aitor: 'tecnopata', encounter: 'dogs', improved: ['tecnopata:rayo-encogedor', 'tecnopata:nanitos', 'tecnopata:escudo-de-bits'] },
  vulcano: { gerard: 'matemagico', aitor: 'sincopante', encounter: 'dogs', improved: ['matemagico:fuego', 'matemagico:factor-comun', 'matemagico:rescoldo', 'matemagico:combustion', 'matemagico:vulcano'] },
  // The dúos mayores of the other lines, each with its line bought as far as its node.
  marea: { gerard: 'matemagico', aitor: 'freatica', encounter: 'dogs', improved: ['matemagico:agua', 'matemagico:vasos', 'matemagico:capilaridad', 'matemagico:marea'] },
  fulgurita: { gerard: 'matemagico', aitor: 'prismatico', encounter: 'dogs', improved: ['matemagico:electrico', 'matemagico:descarga', 'matemagico:toma-de-tierra', 'matemagico:cortocircuito', 'matemagico:condensador', 'matemagico:fulgurita'] },
  'suceso-seguro': { gerard: 'matemagico', aitor: 'dadaista', encounter: 'dogs', improved: ['matemagico:angulo', 'matemagico:analisis', 'matemagico:cardioide', 'matemagico:mana-1', 'matemagico:integral', 'matemagico:suceso-seguro'] },
  metralla: { gerard: 'papagato', aitor: 'tecnopata', encounter: 'dogs', improved: ['tecnopata:explosion', 'tecnopata:telemetria', 'tecnopata:reinicio', 'tecnopata:metralla'] },
  'idea-fija': { gerard: 'sincopante', aitor: 'tecnopata', encounter: 'dogs', improved: ['tecnopata:confusion', 'tecnopata:control-remoto', 'tecnopata:virus', 'tecnopata:idea-fija'] },
  caleidoscopio: { gerard: 'prismatico', aitor: 'tecnopata', encounter: 'dogs', improved: ['tecnopata:rayo-encogedor', 'tecnopata:nanitos', 'tecnopata:escudo-de-bits', 'tecnopata:redundancia', 'tecnopata:caleidoscopio'] },
  // The pairs that had no dual.
  geiser: { gerard: 'matemagico', aitor: 'freatica', encounter: 'dogs', improved: [] },
  'a-escala': { gerard: 'freatica', aitor: 'tecnopata', encounter: 'dogs', improved: ['tecnopata:rayo-encogedor'] },
  seiche: { gerard: 'freatica', aitor: 'sincopante', encounter: 'dogs', improved: [] },
  staccato: { gerard: 'papagato', aitor: 'sincopante', encounter: 'dogs', improved: [] },
  'cadaver-exquisito': { gerard: 'prismatico', aitor: 'dadaista', encounter: 'dogs', improved: [] },
  trampantojo: { gerard: 'prismatico', aitor: 'tecnopata', encounter: 'dogs', improved: ['tecnopata:confusion'] },
} as const;
const isDualTrial = (id: unknown): id is keyof typeof DUAL_TRIALS => typeof id === 'string' && Object.hasOwn(DUAL_TRIALS, id);
/** Whatever was stored or passed in a URL, as a setup the tester can start. */
export function validFight(value: unknown): FightSetup {
  const v: Partial<FightSetup> = value && typeof value === 'object' ? value as Partial<FightSetup> : DEFAULT_FIGHT;
  if (isDualTrial(v.trial)) {
    const { gerard, aitor, encounter, improved } = DUAL_TRIALS[v.trial];
    return { ...DEFAULT_FIGHT, adult: true, wear: { gerard, aitor }, animas: [gerard, aitor],
      encounter, improved: [...improved], free: false, trial: v.trial };
  }
  const isClass = (id: unknown): id is ClassId => typeof id === 'string' && (CLASS_IDS as string[]).includes(id);
  const animas = Array.isArray(v.animas) ? CLASS_IDS.filter(id => v.animas!.includes(id)) : DEFAULT_FIGHT.animas;
  // Each wears only what is theirs to wear (Matemágico Gerard, Tecnópata Aitor), and never the same one.
  const pick = (member: 'gerard' | 'aitor', id: unknown) => isClass(id) && animas.includes(id) && canWear(member, id) ? id : undefined;
  const gerard = pick('gerard', v.wear?.gerard), aitor = pick('aitor', v.wear?.aitor);
  const wear = { gerard, aitor: aitor === gerard ? undefined : aitor };
  const adult = v.adult === true;
  // The palace minion is chapter 1's fight: the boys, always together.
  const encounter = (['dogs', 'possessed', 'palace-minion', 'palace-guards', 'night-guard', ...TOWER_FIGHTS, ...UNI_FIGHTS, ...CAMPING_FIGHTS, ...CUERDAS_FIGHTS, ...CASTLE_FIGHTS, ...MODELO_FIGHTS, ...LUCA_FIGHTS] as const).find(e => e === v.encounter) ?? 'dogs';
  const tower = ([...TOWER_FIGHTS, ...UNI_FIGHTS, ...CAMPING_FIGHTS, ...CUERDAS_FIGHTS, ...CASTLE_FIGHTS, ...MODELO_FIGHTS, ...LUCA_FIGHTS] as readonly string[]).includes(encounter);
  return {
    adult, partner: encounter === 'palace-minion' ? true : v.partner !== false,
    wear, animas, friends: Array.isArray(v.friends) ? ANIMA_IDS.filter(id => v.friends!.includes(id)) : [],
    // The palace minion is chapter 1's; Uri's tower, chapter 2's.
    encounter: (adult && encounter === 'palace-minion') || (!adult && (tower || encounter === 'night-guard')) ? 'dogs' : encounter,
    foes: Number.isInteger(v.foes) ? Math.max(1, Math.min(4, v.foes!)) : DEFAULT_FIGHT.foes,
    free: v.free !== false, immune: v.immune === true, unbound: v.unbound === true, crit: v.crit === true, offbeat: v.offbeat === true,
    strong: v.strong === true && adult && (encounter === 'night-guard' || encounter.startsWith('alumnos-')),
    improved: Array.isArray(v.improved) ? v.improved.filter(id => { const item = improvementOf(id); return !!item && !item.veiled && (!item.after || v.improved!.includes(item.after)); }) : [],
  };
}
const fightKey = 'gerard35.fight.v1';

type Tab = 'places' | 'story' | 'missions' | 'fight' | 'sim';
/** The ánimas unlocked, each at its level (absent: locked). */
export type AnimaLevels = Partial<Record<ClassId, number>>;
export interface JumpMenuDev {
  /** The story's flags now, to mark where it is. */
  flags: () => readonly StoryFlag[];
  day: () => number;
  /**
   * Starts over at a story point (`new` for the very beginning); in chapter 2, on a day and with
   * those ánima missions done, and at an hour (21: night, the way home from Fabra i Puig); `home`
   * stands Gerard at home instead of where the point happened.
   */
  story: (at: StoryFlag | 'new', day?: number, missions?: AnimaId[], hour?: number, home?: boolean) => void;
  /**
   * Starts the way home at night (src/night.ts) on the Meridiana from Fabra i Puig, with her castle
   * at that stage (0–4): the day follows from it and the ánima missions done. `year`: whose pupils
   * are out (1–3: the castle's floor the party is on, i.e. its bosses beaten up to that year);
   * `crowd`: how many times as full of them the avenue is as the night's tier says.
   */
  night: (castle: number, missions?: AnimaId[], year?: number, crowd?: number) => void;
  /** Her castle's stage now, if it is night in chapter 2. */
  nightNow: () => number | undefined;
  /** Starts over at a part of an ánima mission (`missionParts`), on a day and with those other missions done. */
  mission: (anima: AnimaId, part: string, day: number, missions?: AnimaId[]) => void;
  /** The part of each mission the story is at now (`missionNow`), if it can start. */
  missionNow: (anima: AnimaId) => string | undefined;
  /** The ánimas unlocked and their levels now, those the story gives, each one's EXP, and whether they are the picker's. */
  animas: () => { now: AnimaLevels; story: AnimaLevels; xp: AnimaLevels; changed: boolean; adult: boolean };
  /** An ánima the story has earns EXP for real (saved, with its note if it learns something): an amount, or what takes it to its next level. */
  giveXp: (id: ClassId, amount: number | 'level') => void;
  /** Unlocks ánimas at those levels at once, the fight on now included; `undefined` gives back the story's. */
  setAnimas: (levels: AnimaLevels | undefined) => void;
  /** The Ecos de luz: how many there are, how many are free, those the picker added on top of the story's, and the improvements they are in. */
  ecos: () => { total: number; free: number; extra: number; improved: readonly string[] };
  /** Adds ecos on top of the story's (not saved); opens the jar's screen wherever you are. */
  giveEcos: (count: number) => void;
  openJar: () => void;
  /** Opens Las parcelas' board (docs/quests/universidad.md): the test puzzle, from the start or where it was left. */
  openParcelas: (fresh: boolean) => void;
  fight: (setup: FightSetup) => void;
  /** The fight on now, if any: what it is and whether it can jump (only on a player's turn). */
  current: () => { encounter: Encounter; phase: string; awakened: boolean; busy: boolean } | undefined;
  help: () => FightHelp;
  setHelp: (help: FightHelp) => void;
  jumpTo: (moment: FightMoment) => void;
  /** Leaves the fight now, with no result and no story. */
  leave: () => void;
  /** Whether walls and tall furniture fold away while they hide Gerard. */
  folding: () => boolean;
  setFolding: (on: boolean) => void;
}

export function createJumpMenu(panel: HTMLElement, callbacks: { travel: (id: EnvironmentId) => void; open: (open: boolean) => void; dev?: JumpMenuDev }) {
  const trigger = panel.querySelector<HTMLButtonElement>('#environment')!;
  const dev = callbacks.dev;
  const root = document.createElement('dialog');
  root.id = 'jump-menu'; root.setAttribute('aria-label', dev ? 'Saltar a un lugar, un punto de la historia o un combate' : 'Elegir lugar');
  panel.append(root);
  let place: EnvironmentId = 'maresme';
  let tab: Tab = 'places';
  let fight = DEFAULT_FIGHT;
  try { fight = validFight(JSON.parse(localStorage.getItem(fightKey) ?? 'null')); } catch { /* Storage is optional. */ }
  let day = 1;
  /** The chapter 2 jump's hour: the morning, or night (src/night.ts). */
  let hour = 8;
  /** The way home at night's castle stage (days.ts `stage`); until chosen, tonight's, or the middle one. */
  let castle: number | undefined;
  /** Whose pupils walk the night (1–3: the castle's year the party is on, src/night-pupils.ts). */
  let year = 1;
  /** How many times as full of pupils the avenue is as the night's tier says (to try densities). */
  let crowd = 1;
  /** Ánima missions a chapter 2 jump starts with done; until chosen, the ones the story has. */
  let missions: AnimaId[] | undefined;
  /** The mission whose parts Misiones shows; until chosen, the first one. */
  let mission: AnimaId = ANIMA_IDS[0];
  /** The timeline's point: every key event up to it is done; until chosen, the last one the story has. */
  let point: StoryFlag | 'new' | undefined;
  /** Whether the timeline's jump starts at home instead of where its point happened. */
  let atHome = true;
  let returnFocus: HTMLElement | undefined;
  /** Partida: the last whole-game report (`just game-sim`), once fetched, and the simulated player shown. */
  let simData: GameSummary | null | 'missing' = null;
  let simPlayer: string | undefined;
  function loadSim() {
    simData = null;
    const load = async (): Promise<GameSummary | 'missing'> => {
      try { const r = await fetch(GAME_REPORT, { cache: 'no-store' }); return r.ok ? await r.json() as GameSummary : 'missing'; } catch { return 'missing'; }
    };
    void load().then(data => { simData = data; if (root.open && tab === 'sim') render(); });
  }
  const escape = (text: string) => text.replace(/[&<>"]/g, c => `&#${c.charCodeAt(0)};`);

  function placesPage(filter: string) {
    const words = filter.trim().toLowerCase();
    const shown = PLACES.filter(p => (dev || p.open) && (!words || `${p.name} ${p.detail} ${p.group}`.toLowerCase().includes(words)));
    const groups = [...new Set(shown.map(p => p.group))];
    const folds = dev ? `<div class="jump-row" role="group" aria-label="Paredes que se pliegan"><span>Paredes que se pliegan</span>${[['1', 'Sí'], ['0', 'No']].map(([v, label]) => `<button type="button" data-folds="${v}" aria-pressed="${dev.folding() === (v === '1')}">${label}</button>`).join('')}</div>` : '';
    return folds + (groups.length ? groups.map(group => `<section class="jump-group"><h3 class="eyebrow">${escape(group.toUpperCase())}</h3>${shown.filter(p => p.group === group).map(p => `
      <button type="button" class="jump-item" data-place="${p.id}" ${p.id === place ? 'aria-current="true"' : ''}>
        <strong>${escape(p.name)}</strong><small>${escape(p.detail)}${dev && !p.open ? ' · solo depuración' : ''}</small>
      </button>`).join('')}</section>`).join('') : '<p class="jump-empty">Ningún lugar se llama así.</p>');
  }
  /**
   * The timeline over Historia: the main line's key events in a row and the ánima missions after
   * it. Clicking an event marks it and all before it as done; a mission is ticked on its own once
   * the line reaches the first metro. «Empezar» reloads the game with exactly that done.
   */
  function timeline() {
    const flags = dev!.flags(), done = missions ??= missionsDone(flags);
    const reached = TIMELINE.map(t => t.at === 'new' || flags.includes(t.at)).lastIndexOf(true);
    const at = TIMELINE.findIndex(t => t.at === (point ??= TIMELINE[reached].at));
    const open = at >= TIMELINE.findIndex(t => t.at === 'metro');
    const event = (t: (typeof TIMELINE)[number], i: number) => `<li ${t.at === 'caught' ? 'data-chapter="2"' : ''}><button type="button" class="timeline-event" data-point="${t.at}" aria-pressed="${i === at}" ${i <= at ? 'data-done' : ''} ${i === reached ? 'data-now' : ''} title="${t.at}"><i></i><span>${escape(t.label)}</span></button></li>`;
    const friend = (id: AnimaId) => `<li><button type="button" class="timeline-event timeline-mission" data-mission="${id}" aria-pressed="${open && done.includes(id)}" ${open && done.includes(id) ? 'data-done' : ''} ${open ? '' : 'disabled'} style="--chip:${ANIMAS[id].colour}"><i></i><span>${escape(ANIMAS[id].friend)}</span></button></li>`;
    const count = open ? done.length : 0;
    return `<section class="jump-group jump-timeline" aria-label="Línea temporal"><h3 class="eyebrow">LÍNEA TEMPORAL</h3>
      <ol class="timeline-track">${TIMELINE.map(event).join('')}</ol>
      <ol class="timeline-track timeline-missions" aria-label="Misiones de ánima hechas"><li class="timeline-label">Misiones</li>${ANIMA_IDS.map(friend).join('')}</ol>
      <div class="jump-row" role="group" aria-label="Dónde empezar"><span>Empezar</span>${([['1', 'En casa'], ['0', 'Donde pasa']] as const).map(([v, label]) => `<button type="button" data-home="${v}" aria-pressed="${atHome === (v === '1')}">${label}</button>`).join('')}
        <button type="button" class="timeline-go" data-go>Empezar aquí${count ? ` · ${count} ${count > 1 ? 'misiones' : 'misión'}` : ''}</button></div>
      <p class="jump-note">Pulsa un evento: queda hecho con todo lo anterior. Las misiones se marcan aparte, desde el primer metro. El aro es donde está la partida ahora.</p>
    </section>`;
  }
  function storyPage() {
    const flags = dev!.flags(), last = flags.at(-1);
    const beat = (flag: StoryFlag, label: string, n: number, all: readonly StoryFlag[]) => `<button type="button" class="jump-item jump-beat" data-beat="${flag}" ${last && all.includes(last) ? 'aria-current="true"' : ''} ${all.every(f => flags.includes(f)) ? 'data-done' : ''}>
      <span class="jump-step">${n}</span><strong>${escape(label)}</strong><code>${flag}</code></button>`;
    const arc = (a: Arc) => `<div class="jump-arc" role="group" aria-label="${escape(a.title)}">
      <h4><span>${escape(a.title)}</span><small>${escape(a.detail)}</small></h4>
      ${a.steps.map((s, i) => beat(s.flags[0], s.label, i + 1, s.flags)).join('')}</div>`;
    const chapter = (n: 1 | 2, missions: boolean) => STORY_ARCS.filter(a => a.chapter === n && 'anima' in a === missions).map(arc).join('');
    return `${timeline()}
      <section class="jump-group"><h3 class="eyebrow">CAPÍTULO 1 · SANT QUIRZE</h3>
        <button type="button" class="jump-item jump-beat" data-beat="new" ${!flags.length ? 'aria-current="true"' : ''}><span class="jump-step">0</span><strong>Desde el principio</strong><code>new</code></button>
        ${chapter(1, false)}</section>
      <section class="jump-group"><h3 class="eyebrow">CAPÍTULO 2 · BARCELONA</h3>
        ${dayRows()}
        ${chapter(2, false)}
        ${nightArc()}</section>
      <p class="jump-note">Las misiones de ánima, parte a parte, están en «Misiones».</p>
      <p class="jump-note">Recarga la partida en ese punto, donde pasa, sin guardar nada.</p>`;
  }
  /**
   * The way home at night: her castle's stage picks the day (with the ánimas chosen in «Con ánimas»),
   * and that, how hard the hunt is (`NIGHT_TIERS`); the ánimas alone set how strong a caught fight is.
   */
  function nightArc() {
    const done = missions ??= missionsDone(dev!.flags());
    const on = dev!.nightNow(), stage = castle ??= on ?? 2;
    const tier = nightTier(stage), might = nightMight(done.length);
    const phase = castlePhase(year as CastlePhaseId);
    const out = [...new Set([...phase.fights, phase.elite].flatMap(room => CASTLE_ROOMS[room]))].map(kind => CASTLE_NAMES[kind]);
    return `<div class="jump-arc" role="group" aria-label="De noche">
      <h4><span>De noche</span><small>La vuelta a casa desde Fabra i Puig</small></h4>
      <div class="jump-row jump-castle" role="group" aria-label="Estado del castillo"><span>El castillo</span>${CASTLE_STAGES.map((label, i) => `<button type="button" data-castle="${i}" aria-pressed="${i === stage}">${i} · ${escape(label)}</button>`).join('')}</div>
      <div class="jump-row" role="group" aria-label="Cuántos alumnos hay en la avenida"><span>Cuántos</span>${([[.5, 'La mitad'], [1, 'Lo normal'], [2, 'El doble'], [3, 'El triple']] as const).map(([times, label]) => `<button type="button" data-crowd="${times}" aria-pressed="${times === crowd}">${label}</button>`).join('')}</div>
      <div class="jump-row" role="group" aria-label="Curso de los alumnos que salen"><span>Alumnos</span>${[1, 2, 3].map(y => `<button type="button" data-year="${y}" aria-pressed="${y === year}">${y}.º curso</button>`).join('')}</div>
      <button type="button" class="jump-item jump-beat" data-night="${stage}" ${on === stage ? 'aria-current="true"' : ''}><span class="jump-step">☾</span><strong>La vuelta a casa</strong><code>día ${dayForStage(stage, done.length + (year - 1))} · ${TIER_NAMES[tier.id] ?? tier.id}</code></button>
      <p class="jump-note">Noche ${TIER_NAMES[tier.id] ?? tier.id}: la avenida llena, un grupo cada ${+((tier.every ?? 0) / crowd).toFixed(1)} casillas a lo largo (aceras y mediana, unos ${Math.round(350 / ((tier.every ?? 350) / crowd) * 2.2)} alumnos), ${tier.hunters} más por las rejillas al salir${tier.perTrain ? `, ${tier.perTrain} más con cada tren (cada ${tier.trainEvery} s)` : ''}${tier.lampsOut ? `, una farola de cada ${tier.lampsOut} apagada` : ''}. Salen los alumnos de ${year}.º, cada uno suelto y cazando a su manera (${escape(out.join(', '))}); si uno os toca, el combate es con su grupo, ×${might.toFixed(2)} de PV y de golpe por las ánimas reunidas.</p>
    </div>`;
  }
  /** The chapter 2 jump's day and the other missions it starts with done, shared by Historia and Misiones. */
  function dayRows(own?: AnimaId) {
    const done = missions ??= missionsDone(dev!.flags());
    return `<div class="jump-row" role="group" aria-label="Día al saltar al capítulo 2"><span>Día</span>${DAYS.map(d => `<button type="button" data-day="${d}" aria-pressed="${d === day}">${d}</button>`).join('')}</div>
      <div class="jump-row" role="group" aria-label="Hora al saltar al capítulo 2"><span>Hora</span>${([[8, 'Mañana'], [21, 'Noche']] as const).map(([h, label]) => `<button type="button" data-hour="${h}" aria-pressed="${h === hour}">${label}</button>`).join('')}</div>
      <div class="jump-row" role="group" aria-label="Misiones hechas al saltar al capítulo 2"><span>Con ánimas</span>${ANIMA_IDS.map(id => `<button type="button" data-mission="${id}" aria-pressed="${id !== own && done.includes(id)}" ${id === own ? 'disabled' : ''}>${escape(ANIMAS[id].friend)}</button>`).join('')}</div>`;
  }
  /** Misiones: each ánima mission, and the parts of the chosen one to start at. */
  function missionsPage() {
    const arcs = STORY_ARCS.filter((a): a is Extract<typeof a, { anima: AnimaId }> => 'anima' in a);
    const picker = `<div class="jump-row jump-missions" role="group" aria-label="Misión"><span>Misión</span>${arcs.map(a => `<button type="button" data-open-mission="${a.anima}" aria-pressed="${a.anima === mission}">${escape(ANIMAS[a.anima].friend)}</button>`).join('')}</div>`;
    const arc = arcs.find(a => a.anima === mission)!, now = dev!.missionNow(mission);
    const parts = missionParts(mission), at = parts.findIndex(p => p.id === now);
    const part = (p: (typeof parts)[number], n: number) => `<button type="button" class="jump-item jump-beat jump-part" data-part="${p.id}" ${p.id === now ? 'aria-current="true"' : ''} ${n < at ? 'data-done' : ''}>
      <span class="jump-step">${n}</span><strong>${escape(p.label)}</strong><code>${p.id}</code><small>${escape(p.detail)}</small></button>`;
    return `
      <section class="jump-group"><h3 class="eyebrow">CAPÍTULO 2 · MISIONES DE ÁNIMA</h3>
        ${picker}${dayRows(mission)}
        <div class="jump-arc" role="group" aria-label="${escape(arc.title)}">
          <h4><span>${escape(arc.title)}</span><small>${escape(arc.detail)}</small></h4>
          ${parts.map(part).join('')}</div></section>
      <p class="jump-note">Recarga la partida en esa parte, donde pasa, sin guardar nada. Cada misión va por su cuenta: solo lleva lo que necesita y las ánimas marcadas arriba.</p>`;
  }
  /** The column beside Historia and Misiones: the ánimas unlocked now and their levels, changed at once. */
  function animasColumn() {
    const { now, story, xp, changed, adult } = dev!.animas(), ecos = dev!.ecos();
    const name = (id: ClassId) => adult ? CLASSES[id].name : CLASSES[id].child?.name ?? CLASSES[id].name;
    const chip = (id: ClassId, level: number, label: string) => `<button type="button" data-set-anima="${id}" data-level="${level}" aria-pressed="${(now[id] ?? 0) === level}" ${(story[id] ?? 0) === level ? 'data-story' : ''}>${label}</button>`;
    const row = (id: ClassId) => `<div class="jump-anima"><strong style="--chip:${CLASSES[id].colour}">${escape(name(id))}</strong><div class="fight-chips" role="group" aria-label="${escape(name(id))}">
      ${chip(id, 0, 'No')}${Array.from({ length: topLevel(id) }, (_, i) => chip(id, i + 1, `Nv ${i + 1}`)).join('')}</div></div>`;
    // EXP for real, as a fight would give it: the shared ánimas (LEVELLED), once the story has them, up to the top level.
    const grow = (id: ClassId) => {
      const level = story[id], top = !!level && level >= topLevel(id);
      const earned = level ? Math.max(xp[id] ?? 0, xpFloor(level)) : 0;
      const state = !level ? 'Sin desbloquear' : top ? `Nv ${level} · máx · ${earned} EXP` : `Nv ${level} · ${earned} EXP`;
      return `<div class="jump-anima jump-grow"><strong style="--chip:${CLASSES[id].colour}">${escape(name(id))}<small>${state}</small></strong>
        <div class="fight-chips jump-xp" role="group" aria-label="Subir de nivel a ${escape(name(id))}">
        <button type="button" class="jump-level-up" data-give-xp="${id}" data-amount="level" ${!level || top ? 'disabled' : ''}>${level && !top ? `Subir a Nv ${level + 1}` : 'Subir de nivel'}</button>
        <button type="button" data-give-xp="${id}" data-amount="25" ${!level || top ? 'disabled' : ''}>+25 EXP</button></div></div>`;
    };
    // The own ánimas (Matemágico, Tecnópata) have no levels and earn no EXP: at 35 they are always
    // worn and grow at the jar, so their row says how far their constellation is. As a child they
    // are only had or not (Matemágico wakes in the palace).
    const own = (id: ClassId) => {
      const nodes = IMPROVEMENTS.filter(item => item.anima === id), bought = nodes.filter(item => ecos.improved.includes(item.id)).length;
      return `<div class="jump-anima"><strong style="--chip:${CLASSES[id].colour}">${escape(name(id))}</strong>${adult
        ? `<p class="jump-note jump-own">Siempre puesta, sin niveles. Constelación: ${bought} de ${nodes.length} mejoras.</p>`
        : `<div class="fight-chips" role="group" aria-label="${escape(name(id))}">${chip(id, 0, 'No')}${chip(id, 1, 'Despierta')}</div>`}</div>`;
    };
    const shared = CLASS_IDS.filter(id => !TREE_ANIMAS.includes(id));
    return `<aside class="jump-side" aria-label="Ánimas">
      <h3 class="eyebrow">SUBIR DE NIVEL</h3>
      ${LEVELLED.map(grow).join('')}
      <p class="jump-note">De verdad, como un combate ganado: se guarda, pone su marca de nivel y sale su aviso. Matemágico y Tecnópata no suben de nivel: crecen en el bote.</p>
      <h3 class="eyebrow">ÁNIMAS PROPIAS</h3>
      ${TREE_ANIMAS.map(own).join('')}
      ${adult ? '<div class="fight-chips jump-xp"><button type="button" data-open-jar>Abrir el bote</button></div>' : ''}
      <h3 class="eyebrow">ÁNIMAS COMPARTIDAS</h3>
      ${shared.map(row).join('')}
      ${changed ? '<button type="button" class="jump-reset" data-animas-reset>Volver a las de la historia</button>' : '<p class="jump-note jump-story-note">Las que da la historia hasta aquí.</p>'}
      <p class="jump-note">Los niveles se aplican al momento, también al combate en curso. Subrayado, lo que da la historia. No se guarda: un salto vuelve a las de la historia.</p>
      <h3 class="eyebrow">ECOS DE LUZ</h3>
      <div class="fight-chips jump-xp" role="group" aria-label="Ecos de luz"><span>${ecos.total} ecos · ${ecos.free} libres${ecos.extra ? ` · ${ecos.extra} de aquí` : ''}</span>
        <button type="button" data-give-ecos="1">+1 eco</button><button type="button" data-give-ecos="-1" ${ecos.extra ? '' : 'disabled'}>−1 eco</button><button type="button" data-open-jar>Abrir el bote</button></div>
      <p class="jump-note">Los ecos de aquí no se guardan. El bote se abre desde cualquier sitio.</p>
      <h3 class="eyebrow">LAS PARCELAS</h3>
      <div class="fight-chips jump-xp" role="group" aria-label="Las parcelas"><button type="button" data-open-parcelas="1">Empezar el tablero</button><button type="button" data-open-parcelas="0">Seguir donde estaba</button></div>
      <p class="jump-note">El puzzle de prueba (just parcelas prueba). El de verdad solo lo abre la versión final.</p>
    </aside>`;
  }
  /** Every fight by name (TypeScript asks for each new one). */
  const FIGHT_NAMES: Record<Encounter, string> = { dogs: 'perros', 'palace-minion': 'el esbirro', 'palace-guards': 'guardianes de chicle', 'night-guard': 'los alumnos en la Meridiana', cebollon: 'El Cebollón', cebolla: 'La Cebolla', plato: 'El Plato Misterioso', escolta: 'La Cebolla y los suyos', 'uri-vertigo': 'Vertitrón', 'crias-1': 'cebollitas', 'crias-2': 'crías del segundo anillo', 'crias-3': 'crías del tercer anillo', sobremesa: 'La Sobremesa',
    'camping-magos': 'magos de camping', 'camping-dados': 'dados', 'camping-agentes': 'agentes', 'camping-tienda': 'una tienda equivocada', 'camping-negra': 'la parcela negra', campeon: 'El Campeón',
    'cuerdas-lealtad': 'La Lealtad', 'cuerdas-cristalino': 'Lo Cristalino', 'cuerdas-directo': 'Lo Directo', voz: 'La Voz', ...CASTLE_FIGHT_NAMES,
    'modelo-celdas': 'celdas secas', 'modelo-oscilacion': 'oscilaciones', 'modelo-atomo': 'El Átomo', 'no-converge': 'El que no converge',
    'luca-recepcion': 'las polillas de la recepción', 'luca-sillones': 'los capellanes', 'luca-carta': 'las camisas de Luca', fran: 'Fran' };
  /** During a fight: the help it gets, the moments it can jump to, and the way out. */
  function livePage() {
    const now = dev!.current()!, help = dev!.help();
    const ready = now.phase === 'player' && !now.busy;
    // The moments a fight stages itself (Vertitrón's moments, El Plato's surprise), only in their own fight.
    const staged = (Object.keys(STAGED_MOMENTS) as StagedMoment[]).filter(id => STAGED_MOMENTS[id].encounter === now.encounter);
    const moment = (id: FightMoment, label: string, disabled = false) => `<button type="button" data-moment="${id}" ${!ready || disabled ? 'disabled' : ''}>${label}</button>`;
    return `
      <p class="jump-note jump-live">Combate en curso · ${escape(FIGHT_NAMES[now.encounter])}</p>
      <div class="fight-row"><span>Ayudas</span><div class="fight-chips">
        <button type="button" data-help="immune" aria-pressed="${help.immune}">Inmunidad</button><button type="button" data-help="free" aria-pressed="${help.free}">PM infinitos</button><button type="button" data-help="unbound" aria-pressed="${help.unbound}">Sin límites</button><button type="button" data-help="crit" aria-pressed="${help.crit}">Crítico seguro</button><button type="button" data-help="offbeat" aria-pressed="${!!help.offbeat}">Contratiempo seguro</button></div></div>
      <div class="fight-row"><span>Saltar a</span><div class="fight-chips">
        ${moment('won', 'Victoria')}${moment('won-level', 'Victoria subiendo de nivel')}${moment('lost', 'Derrota')}${moment('foes-low', 'Enemigos a 1 PV')}${moment('party-low', 'Equipo a 1 PV')}
        ${now.encounter === 'palace-minion' ? moment('beat', 'Despierta Matemágico', now.awakened) : ''}</div></div>
      <div class="fight-row"><span>Agua</span><div class="fight-chips">${moment('agua-0', 'Sin agua')}${moment('agua-1', 'Agua I')}${moment('agua-2', 'Agua II')}${moment('agua-3', 'Agua III')}</div></div>
      ${staged.length ? `<div class="fight-row"><span>Momentos</span><div class="fight-chips">${staged.map(id => moment(id, STAGED_MOMENTS[id].label)).join('')}</div></div>` : ''}
      ${ready ? '' : '<p class="jump-note">Los saltos esperan al turno de un jugador.</p>'}
      <button type="button" class="jump-go jump-leave" data-leave>Salir del combate</button>
      <p class="jump-note">Salir no cuenta para la historia. Un lugar de «Lugares» también sale del combate.</p>`;
  }
  const TOWER_LABELS: Record<(typeof TOWER_FIGHTS)[number], string> = { cebollon: 'El Cebollón', cebolla: 'La Cebolla', plato: 'El Plato Misterioso', escolta: 'La Cebolla y los suyos', 'uri-vertigo': 'Vertitrón', 'crias-1': 'Crías · anillo 1', 'crias-2': 'Crías · anillo 2', 'crias-3': 'Crías · anillo 3' };
  const CAMPING_LABELS: Record<(typeof CAMPING_FIGHTS)[number], string> = { 'camping-magos': 'Magos', 'camping-dados': 'Dados', 'camping-agentes': 'Agentes', 'camping-tienda': 'Tienda equivocada', 'camping-negra': 'Parcela negra', campeon: 'El Campeón' };
  const CUERDAS_LABELS: Record<(typeof CUERDAS_FIGHTS)[number], string> = { 'cuerdas-lealtad': 'La Lealtad', 'cuerdas-cristalino': 'Lo Cristalino', 'cuerdas-directo': 'Lo Directo', voz: 'La Voz' };
  const MODELO_LABELS: Record<(typeof MODELO_FIGHTS)[number], string> = { 'modelo-celdas': 'Celdas secas', 'modelo-oscilacion': 'Oscilaciones', 'modelo-atomo': 'El Átomo', 'no-converge': 'El que no converge' };
  const LUCA_LABELS: Record<(typeof LUCA_FIGHTS)[number], string> = { 'luca-recepcion': 'Recepción', 'luca-sillones': 'Los sillones', 'luca-carta': 'La carta de colores', fran: 'Fran' };
  function fightPage() {
    if (dev!.current()) return livePage();
    const f = fight;
    const chip = (name: string, value: string, label: string, on: boolean, disabled = false) => `<button type="button" data-${name}="${value}" aria-pressed="${on}" ${disabled ? 'disabled' : ''}>${escape(label)}</button>`;
    const wearRow = (member: 'gerard' | 'aitor', label: string) => `<div class="fight-row"><span>${label}</span><div class="fight-chips">
      ${chip(`wear-${member}`, '', 'Sin ánima', !f.wear[member])}${f.animas.filter(id => canWear(member, id)).map(id => chip(`wear-${member}`, id, f.adult || member === 'aitor' ? CLASSES[id].name : CLASSES[id].child?.name ?? CLASSES[id].name, f.wear[member] === id, f.wear[member === 'gerard' ? 'aitor' : 'gerard'] === id)).join('')}</div></div>`;
    const guards = f.encounter === 'palace-guards' || f.encounter === 'night-guard', dogs = f.encounter === 'dogs' || f.encounter === 'possessed';
    return `
      <div class="fight-row"><span>Probar un dúo</span><div class="fight-chips">${DUALS.filter(d => isDualTrial(d.id)).map(d => `<button type="button" data-dual-trial="${d.id}">${escape(d.name)}</button>`).join('')}</div></div>
      <div class="fight-row"><span>Época</span><div class="fight-chips">${chip('adult', '0', 'Capítulo 1 · niños', !f.adult)}${chip('adult', '1', 'Capítulo 2 · a los 35', f.adult)}</div></div>
      <div class="fight-row"><span>Equipo</span><div class="fight-chips">${chip('partner', '0', 'Gerard solo', !f.partner, f.encounter === 'palace-minion')}${chip('partner', '1', f.adult ? 'Gerard y Aitor' : 'Gerard y Bernat', f.partner)}</div></div>
      <div class="fight-row"><span>Ánimas</span><div class="fight-chips">${CLASS_IDS.map(id => chip('anima', id, CLASSES[id].name, f.animas.includes(id))).join('')}</div></div>
      ${wearRow('gerard', 'Gerard lleva')}
      ${f.adult && f.partner ? wearRow('aitor', 'Aitor lleva') : ''}
      ${f.adult ? `<div class="fight-row"><span>Amigos</span><div class="fight-chips">${ANIMA_IDS.map(id => chip('friend', id, ANIMAS[id].friend, f.friends.includes(id))).join('')}</div></div>` : ''}
      <div class="fight-row"><span>Contra</span><div class="fight-chips">
        ${chip('encounter', 'dogs', 'Perros', f.encounter === 'dogs')}${chip('encounter', 'possessed', 'Perros poseídos', f.encounter === 'possessed')}
        ${chip('encounter', 'palace-minion', 'El esbirro', f.encounter === 'palace-minion', f.adult)}${chip('encounter', 'palace-guards', 'Guardianes de chicle', f.encounter === 'palace-guards')}${f.adult ? chip('encounter', 'night-guard', 'De noche en la Meridiana', f.encounter === 'night-guard') : ''}</div></div>
      ${f.adult ? `<div class="fight-row"><span>Amigos de la uni</span><div class="fight-chips">${chip('encounter', 'sobremesa', 'La Sobremesa', f.encounter === 'sobremesa')}</div></div>` : ''}
      ${f.adult ? `<div class="fight-row"><span>La peluquería</span><div class="fight-chips">${LUCA_FIGHTS.map(id => chip('encounter', id, LUCA_LABELS[id], f.encounter === id)).join('')}</div></div>` : ''}
      ${f.adult ? `<div class="fight-row"><span>Las cuerdas</span><div class="fight-chips">${CUERDAS_FIGHTS.map(id => chip('encounter', id, CUERDAS_LABELS[id], f.encounter === id)).join('')}</div></div>` : ''}
      ${f.adult ? `<div class="fight-row"><span>El modelo de Emilie</span><div class="fight-chips">${MODELO_FIGHTS.map(id => chip('encounter', id, MODELO_LABELS[id], f.encounter === id)).join('')}</div></div>` : ''}
      ${f.adult ? `<div class="fight-row"><span>Camping Eurosport</span><div class="fight-chips">${CAMPING_FIGHTS.map(id => chip('encounter', id, CAMPING_LABELS[id], f.encounter === id)).join('')}</div></div>` : ''}
      ${f.adult ? `<div class="fight-row"><span>Castillo</span><div class="fight-chips">${CASTLE_FIGHTS.map(id => chip('encounter', id, CASTLE_FIGHT_NAMES[id], f.encounter === id)).join('')}</div></div>` : ''}
      ${f.adult ? `<div class="fight-row"><span>Torre de Uri</span><div class="fight-chips">${TOWER_FIGHTS.map(id => chip('encounter', id, TOWER_LABELS[id], f.encounter === id)).join('')}</div></div>` : ''}
      ${f.adult && (f.encounter === 'night-guard' || f.encounter.startsWith('alumnos-')) ? `<div class="fight-row"><span>Alumnos</span><div class="fight-chips">${chip('strong', '0', 'Como siempre', !f.strong)}${chip('strong', '1', 'Encarnados', !!f.strong)}</div></div>` : ''}
      ${dogs ? `<div class="fight-row"><span>Cuántos</span><div class="fight-chips">${[1, 2, 3, 4].map(n => chip('foes', String(n), String(n), f.foes === n)).join('')}</div></div>` : ''}
      ${guards ? `<p class="jump-note">${f.encounter === 'night-guard' ? 'El primer grupo de alumnos de la planta del castillo en la que estáis, más fuerte fuera cuantos menos amigos y niveles.' : 'Los guardianes son tantos y tan fuertes como dejan las ánimas de los amigos.'}</p>` : ''}
      ${f.adult ? `<div class="fight-row"><span>Ecos de luz</span><div class="fight-chips">${IMPROVEMENTS.filter(item => !item.veiled && f.animas.includes(item.anima)).map(item => chip('improve', item.id, `${CLASSES[item.anima].name} · ${item.name}`, f.improved.includes(item.id), !!item.after && !f.improved.includes(item.after))).join('')}</div></div>` : ''}
      <div class="fight-row"><span>Ayudas</span><div class="fight-chips">${chip('immune', '1', 'Inmunidad', f.immune)}${chip('free', '1', 'PM infinitos', f.free)}${chip('unbound', '1', 'Sin límites', f.unbound)}${chip('crit', '1', 'Crítico seguro', f.crit)}${chip('offbeat', '1', 'Contratiempo seguro', !!f.offbeat)}</div></div>
      <button type="button" class="jump-go" data-start>Empezar combate</button>
      <p class="jump-note">No cuenta para la historia. Cambiar de época recarga la partida.</p>`;
  }
  function render(focus?: string) {
    const filter = root.querySelector<HTMLInputElement>('.jump-search')?.value ?? '';
    // Historia and Misiones are wide: the page, and the ánimas beside it.
    const split = !!dev && (tab === 'story' || tab === 'missions');
    root.toggleAttribute('data-wide', split);
    // A chip changed on the same page keeps both columns where they were.
    const keep = focus && !focus.startsWith('[data-tab') ? [...root.querySelectorAll<HTMLElement>('.jump-body, .jump-side')].map(el => el.scrollTop) : undefined;
    root.innerHTML = `
      ${dev ? `<nav class="jump-tabs" role="tablist">${([['places', 'Lugares'], ['story', 'Historia'], ['missions', 'Misiones'], ['fight', 'Combate'], ['sim', 'Partida']] as const).map(([id, label]) => `<button type="button" role="tab" data-tab="${id}" aria-selected="${tab === id}">${label}</button>`).join('')}</nav>` : ''}
      ${tab === 'places' ? `<input class="jump-search" type="search" placeholder="Buscar lugar" aria-label="Buscar lugar" value="${escape(filter)}" autocomplete="off">` : ''}
      ${split ? `<div class="jump-split"><div class="jump-body" data-page="${tab}">${tab === 'story' ? storyPage() : missionsPage()}</div>${animasColumn()}</div>`
        : `<div class="jump-body" data-page="${tab}">${tab === 'places' ? placesPage(filter) : tab === 'sim' ? simPage(simData, simPlayer) : fightPage()}</div>`}`;
    if (keep) root.querySelectorAll<HTMLElement>('.jump-body, .jump-side').forEach((el, i) => { el.scrollTop = keep[i] ?? 0; });
    if (focus) root.querySelector<HTMLElement>(focus)?.focus({ preventScroll: true });
  }
  function setFight(change: Partial<FightSetup>) {
    fight = validFight({ ...fight, ...change });
    try { localStorage.setItem(fightKey, JSON.stringify(fight)); } catch { /* Storage is optional. */ }
  }
  function show(next: Tab = tab) {
    tab = next;
    // In a fight everything outside it is inert, so the picker opens inside it.
    const host = document.querySelector('#hud[data-battle] #battle') ?? panel;
    if (root.parentElement !== host) { if (root.open) root.close(); host.append(root); }
    render();
    if (!root.open) {
      // Focus goes back where it was: the street, or the fight's commands.
      const active = document.activeElement as HTMLElement | null;
      returnFocus = active && active !== document.body && !active.closest('[data-jump-trigger]') ? active : undefined;
      root.show(); trigger.setAttribute('aria-expanded', 'true'); callbacks.open(true);
    }
    (root.querySelector<HTMLElement>('.jump-search') ?? root.querySelector<HTMLElement>('[aria-current="true"]') ?? root.querySelector<HTMLElement>('.jump-body button'))?.focus({ preventScroll: true });
  }
  function close() {
    if (!root.open) return;
    root.close(); trigger.setAttribute('aria-expanded', 'false'); callbacks.open(false);
    const back = returnFocus?.isConnected && !returnFocus.closest('[inert]') ? returnFocus : document.querySelector<HTMLElement>('#hud[data-battle] #battle') ?? document.querySelector<HTMLElement>('#game');
    back?.focus({ preventScroll: true });
  }

  trigger.addEventListener('click', () => root.open ? close() : show());
  root.addEventListener('input', event => {
    if (!(event.target as HTMLElement).matches('.jump-search')) return;
    root.querySelector('.jump-body')!.innerHTML = placesPage((event.target as HTMLInputElement).value);
  });
  root.addEventListener('click', event => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button');
    if (!button || button.disabled) return;
    const data = button.dataset;
    if (data.tab) { tab = data.tab as Tab; if (tab === 'sim') loadSim(); render(`[data-tab="${tab}"]`); return; }
    if (data.simPlayer) { simPlayer = data.simPlayer; render(`[data-sim-player="${simPlayer}"]`); return; }
    if (data.simJump) { close(); const jump = JSON.parse(data.simJump) as SimJump; dev!.story(jump.flag, jump.day, jump.missions, undefined, false); return; }
    if (data.place) { close(); if (data.place !== place) callbacks.travel(data.place as EnvironmentId); return; }
    if (data.beat) {
      close();
      const at = data.beat as StoryFlag | 'new', later = at !== 'new' && isChapter2(at);
      dev!.story(at, later ? day : undefined, later ? missions : undefined, later ? hour : undefined);
      return;
    }
    if (data.point) { point = data.point as StoryFlag | 'new'; render(`[data-point="${point}"]`); return; }
    if (data.home) { atHome = data.home === '1'; render(`[data-home="${data.home}"]`); return; }
    if (data.go !== undefined) {
      close();
      const at = point ?? 'new', later = at !== 'new' && isChapter2(at);
      dev!.story(at, later ? day : undefined, later ? missions : undefined, later ? hour : undefined, atHome);
      return;
    }
    if (data.part) { close(); dev!.mission(mission, data.part, day, missions); return; }
    if (data.night) { close(); dev!.night(Number(data.night), missions, year, crowd); return; }
    if (data.castle) { castle = Number(data.castle); render(`[data-castle="${castle}"]`); return; }
    if (data.year) { year = Number(data.year); render(`[data-year="${year}"]`); return; }
    if (data.crowd) { crowd = Number(data.crowd); render(`[data-crowd="${crowd}"]`); return; }
    if (data.openMission) { mission = data.openMission as AnimaId; render(`[data-open-mission="${mission}"]`); return; }
    if (data.setAnima) {
      const id = data.setAnima as ClassId, level = Number(data.level), next = { ...dev!.animas().now };
      if (level) next[id] = level; else delete next[id];
      dev!.setAnimas(next); render(`[data-set-anima="${id}"][data-level="${level}"]`); return;
    }
    if (data.giveXp) {
      const id = data.giveXp as ClassId, amount = data.amount === 'level' ? 'level' : Number(data.amount);
      dev!.giveXp(id, amount); render(`[data-give-xp="${id}"][data-amount="${data.amount}"]`); return;
    }
    if (data.giveEcos) { dev!.giveEcos(Number(data.giveEcos)); render(`[data-give-ecos="${data.giveEcos}"]`); return; }
    if (data.openJar !== undefined) { close(); dev!.openJar(); return; }
    if (data.openParcelas !== undefined) { close(); dev!.openParcelas(data.openParcelas === '1'); return; }
    if (data.improve) { setFight({ improved: fight.improved.includes(data.improve) ? fight.improved.filter(id => id !== data.improve) : [...fight.improved, data.improve] }); render(`[data-improve="${data.improve}"]`); return; }
    if (data.animasReset !== undefined) { dev!.setAnimas(undefined); render('.jump-side [aria-pressed="true"]'); return; }
    if (data.folds) { dev!.setFolding(data.folds === '1'); render(`[data-folds="${data.folds}"]`); return; }
    if (data.day) { day = Number(data.day); render(`[data-day="${day}"]`); return; }
    if (data.hour) { hour = Number(data.hour); render(`[data-hour="${hour}"]`); return; }
    if (data.mission) { const id = data.mission as AnimaId; missions = missions?.includes(id) ? missions.filter(m => m !== id) : [...missions ?? [], id]; render(`[data-mission="${id}"]`); return; }
    if (isDualTrial(data.dualTrial)) { close(); dev!.fight(validFight({ trial: data.dualTrial })); return; }
    if (data.start !== undefined) { close(); dev!.fight(fight); return; }
    if (data.leave !== undefined) { close(); dev!.leave(); return; }
    if (data.moment) { close(); dev!.jumpTo(data.moment as FightMoment); return; }
    if (data.help) { const help = dev!.help(), key = data.help as keyof FightHelp; dev!.setHelp({ ...help, [key]: !help[key] }); render(`[data-help="${key}"]`); return; }
    const key = Object.keys(data)[0];
    if (!key) return;
    const value = data[key]!;
    const toggle = <T extends string>(list: T[], id: T) => list.includes(id) ? list.filter(x => x !== id) : [...list, id];
    if (key === 'adult') setFight({ adult: value === '1' });
    else if (key === 'partner') setFight({ partner: value === '1' });
    else if (key === 'anima') setFight({ animas: toggle(fight.animas, value as ClassId) });
    else if (key === 'friend') setFight({ friends: toggle(fight.friends, value as AnimaId) });
    else if (key === 'wearGerard') setFight({ wear: { ...fight.wear, gerard: (value || undefined) as ClassId | undefined } });
    else if (key === 'wearAitor') setFight({ wear: { ...fight.wear, aitor: (value || undefined) as ClassId | undefined } });
    else if (key === 'encounter') setFight({ encounter: value as FightEncounter });
    else if (key === 'foes') setFight({ foes: Number(value) });
    else if (key === 'free') setFight({ free: !fight.free });
    else if (key === 'immune') setFight({ immune: !fight.immune });
    else if (key === 'unbound') setFight({ unbound: !fight.unbound });
    else if (key === 'crit') setFight({ crit: !fight.crit });
    else if (key === 'offbeat') setFight({ offbeat: !fight.offbeat });
    else if (key === 'strong') setFight({ strong: value === '1' });
    else return;
    // Keep focus on the same chip after the page redraws.
    render(`[data-${key.replace(/[A-Z]/g, c => `-${c.toLowerCase()}`)}="${value}"]`);
  });
  root.addEventListener('keydown', event => {
    // Keys stay in the picker: a fight under it must not hear them.
    event.stopPropagation();
    if (event.key === 'Escape') { event.preventDefault(); close(); return; }
    // Up and down walk the rows (the search box, each place or beat, each row of chips); left and
    // right walk within a row: the tabs, the chips, the days.
    const step = event.key === 'ArrowDown' || event.key === 'ArrowRight' ? 1 : event.key === 'ArrowUp' || event.key === 'ArrowLeft' ? -1 : 0;
    if (!step) return;
    const active = document.activeElement as HTMLElement | null;
    const enabled = (scope: Element) => [...scope.querySelectorAll<HTMLElement>('button:not([disabled])')];
    let next: HTMLElement | undefined;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      const row = active?.closest('.jump-tabs, .fight-chips, .jump-row');
      if (!row) return;
      const items = enabled(row);
      next = items[(items.indexOf(active!) + step + items.length) % items.length];
    } else {
      const rows = [...root.querySelectorAll<HTMLElement>('.jump-search, .jump-item, .fight-chips, .jump-row, .jump-go, .jump-reset')];
      const at = rows.findIndex(row => row === active || row.contains(active));
      const row = rows[(at + step + rows.length) % rows.length];
      next = row?.matches('.fight-chips, .jump-row') ? row.querySelector<HTMLElement>('[aria-pressed="true"]:not([disabled])') ?? enabled(row)[0] : row;
    }
    if (!next) return;
    event.preventDefault();
    next.focus({ preventScroll: true });
    if (next.matches('[data-tab]')) next.click();
  });
  const outside = (event: PointerEvent) => { if (root.open && !root.contains(event.target as Node) && !(event.target as HTMLElement).closest?.('[data-jump-trigger]')) close(); };
  window.addEventListener('pointerdown', outside, true);

  return {
    get isOpen() { return root.open; },
    /** Shows where the player is now, on the trigger and in the list. */
    setPlace(id: EnvironmentId) {
      place = id;
      trigger.querySelector('.place-name')!.textContent = placeName(id);
      if (root.open && tab === 'places') render();
    },
    /** Development: the day chapter 2 jumps wake up on. */
    setDay(value: number) { day = Math.max(1, Math.min(7, value)); },
    open: show, close,
    toggle(next?: Tab) { if (root.open) close(); else show(next); },
    destroy() { window.removeEventListener('pointerdown', outside, true); root.remove(); },
  };
}
