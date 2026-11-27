/**
 * The castle in the story (docs/castle.md, docs/castle-bosses.md): its lines, what a visit keeps,
 * and what each walk, door and fight inside it means. Pure. `src/story.ts` owns the flags and the
 * days and calls in here through a small `CastleHost`, so the castle's rules read in one place.
 *
 * Preliminary (2026-11-19): the dynamics end to end. The salón de juegos, where Bernat hands the
 * artilugio over, is not built: his call the morning after stands in for it.
 */
import type { Dialogue, DialogueLine } from './dialogue';
import type { EnvironmentId, Interaction } from './environments';
import type { StoryEffect, Trigger } from './story.ts';
import { CASTLE_LIGHTS, CASTLE_PHASES, DIRECCION_MEETING, ROOM_LIGHTS, STRONG_LIGHTS, castlePhase, floorFor, isCastleEncounter, isCastlePlace, roomRound,
  type CastleEncounter, type CastleFlag, type CastleFloor, type CastlePhaseId, type CastlePuzzle, type Cell, type RoomEncounter } from './castle.ts';
import { horarioFor, squares, withGiven, type Board, type Horario } from './horario.ts';

const gerard = (text: string): DialogueLine => ({ speaker: 'gerard35', text });
const aitor = (text: string): DialogueLine => ({ speaker: 'aitor', text });
const both = (...lines: DialogueLine[]): Dialogue => ({ left: 'gerard35', right: 'aitor', lines });
const withThem = (right: 'aurelia' | 'mar' | 'reina' | 'bernat35', ...lines: DialogueLine[]): Dialogue => ({ left: 'gerard35', right, lines });
const aurelia = (text: string): DialogueLine => ({ speaker: 'aurelia', text });
const mar = (text: string): DialogueLine => ({ speaker: 'mar', text });
const montse = (text: string): DialogueLine => ({ speaker: 'montse', text });
const pilar = (text: string): DialogueLine => ({ speaker: 'pilar', text });
const reina = (text: string): DialogueLine => ({ speaker: 'reina', text });
const bernat = (text: string): DialogueLine => ({ speaker: 'bernat35', text });

export const LINES_CASTLE = {
  /** Up the stair behind the curtain the first time: not the throne of the dream, the school's first floor, and not as it was. */
  floorFirst: both(
    gerard('Esto es el primer piso de la escuela. O lo era: aquí había un pasillo y seis aulas.'),
    aitor('Pues ahora hay salas. Y se mueve algo dentro.'),
    gerard('Llevan bata. Son… del tamaño de los de tercero.'),
    aitor('No son niños, Gerard. Mírales la cara.'),
  ),
  /** A new day, a new floor. */
  floorChanged: both(aitor('Ayer esto no estaba así.'), gerard('No. Cada mañana lo recoloca.')),
  rest: both(gerard('La sala de profesores. La cafetera sigue caliente.'), aitor('Cinco minutos. Y seguimos.')),
  find: both(gerard('Un armario de material. Tizas, fundas, un silbato.'), aitor('Nada que sirva. Todavía.')),
  /** The second floor's closed door (docs/castle.md § The closed doors): it says why it will not open, and whose job that is. */
  horarioShut: both(
    gerard('No abre. Lleva un sello de secretaría: «Aula sin horario asignado».'),
    aitor('¿Y quién le pone horario a un aula?'),
    gerard('Yo. Cada septiembre.'),
  ),
  /** The sheet on the wall, the first time he looks at it each day: what a timetable is, said by whoever makes them. */
  horarioBoard: both(
    gerard('El horario de segundo, a medias. Cuatro asignaturas, cuatro aulas, cuatro horas.'),
    gerard('Nadie da clase en dos aulas a la vez, y ningún grupo repite asignatura en la mañana.'),
    aitor('Dicho así, parece fácil.'),
    gerard('Lo parece hasta que falta una casilla.'),
  ),
  horarioDone: both(
    gerard('Cuadra.'),
    aitor('La puerta. Ha soltado el sello ella sola.'),
    gerard('Once años haciendo esto. Nunca me había abierto nada.'),
  ),
  /** The third floor's: they reached the wall. What the game was, said by whoever played it. */
  picaDone: both(
    aitor('Ha dejado de contar.'),
    gerard('Un, dos, tres, pica pared. En el patio, quien tocaba la pared ganaba.'),
    aitor('¿Y el que contaba?'),
    gerard('Se quedaba solo, de cara a ella.'),
  ),
  aureliaBefore: withThem('aurelia',
    aurelia('Arriba tard, Gerard. I porta algú que no està matriculat.'),
    gerard('Aurelià. Tens els ulls…'),
    aurelia('Aquí per fi hi ha ordre. Ningú corre, ningú contesta. Segui.'),
    aitor('No se va a apartar.'),
  ),
  aureliaWon: withThem('aurelia',
    aurelia('…Gerard? Què hi faig, jo, al gimnàs?'),
    gerard('Fent classe. A la teva manera.'),
    aurelia('Em feia menys mal quan manava ella. No havia de decidir res.'),
    aitor('Sal por el patio. La pompa de la puerta te deja pasar.'),
  ),
  aureliaAfter: both(
    aitor('Te ha dejado algo. A ti y a mí.'),
    gerard('Noto que cabe más. Como si hubiera sitio para otra.'),
    aitor('La puerta de los vestuarios ya no está pegada.'),
  ),
  lockers: both(gerard('Los vestuarios. Detrás suena papel. Mucho papel.'), aitor('¿Papel?'), gerard('Actas. Por ahí se llega a Direcció. O se llegaba.')),
  direccionBefore: withThem('mar',
    mar('Gerard. T\'esperàvem a les vuit. Hem de tancar l\'acta.'),
    montse('Només falta la teva signatura. I la de l\'acompanyant.'),
    pilar('És un tràmit. Després ja no cal pensar en res més.'),
    gerard('Mar. Montse. Pilar. Soc jo. Ara soc el secretari...'),
    mar('Per això mateix. Signa.'),
  ),
  direccionWon: withThem('mar',
    mar('…L\'acta és en blanc.'),
    montse('Quant fa que som aquí assegudes?'),
    pilar('Gerard, la porta de Direcció. La de dins. L\'ha oberta ella.'),
    gerard('Ho sé. Marxeu pel pati.'),
  ),
  direccionAfter: both(
    aitor('Tres luces. Tres más para el bote.'),
    gerard('Y algo más. Algo que no sé usar todavía.'),
    aitor('Detrás de Direcció ya no hay escuela, ¿verdad?'),
    gerard('No. Detrás está ella.'),
  ),
  reinaBefore: withThem('reina',
    reina('Has trigat vint-i-cinc anys.'),
    gerard('…Nuria?'),
    reina('Em vaig posar la seva cara perquè la buscàveu. Mai n\'he tingut una de meva. Odio creixer... odio que tothom tingui fills... odio el futur'),
    reina('No us vull fer mal. Pero esque no ho enteneu... vull que tothom sigui feliç, que tothom visqui La vida, no un constructe de la societat'),
    aitor('Però... això ho han decidit ells, no pots impondre la teva visió'),
    reina('Ai Aitor... no ho entens... jo soc tú, tú ets jo,... i no em podeu parar, tothom tornarà als seus origens, sense filtres socials, i viuran feliços, molt més que ara'),
    gerard('No, no ho permitirem. Et destruirem junts, Aitor i jo'),
    reina('Jaaaaa ja ja ja ja'),
  ),
  reinaAgain: withThem('reina',
    reina('Tornes. I ell torna amb tu. He estat mirant tot lo que feu, deixeu estar a la gent. Però es inutil, no podeu salvar a tothom, i jo cada día soc mes forta'),
    gerard('Me\'n recordo de tot... Núria...'),
    reina('Llavors ja saps com acaba.'),
    aitor('Esta vez no.'),
  ),
  /** The morning after Gerard fell to Aitor's hand: Bernat calls them to El Nucli (docs/quests/bernat.md, round 5). */
  bernatCall: withThem('bernat35',
    aitor('Te suena el móvil. Pone «Bernat».'),
    bernat('Gerard. Sé com parar-la, vine al Nucli, no preguntis'),
    aitor('…Gerard. Ayer. Yo te…'),
    gerard('No eras tú. Coge la chaqueta.'),
  ),
  /**
   * A boss beaten (decided with Aitor 2026-11-20): her voice through the whole building, more afraid
   * each time; then the picture goes white and they are in bed, the same morning again.
   */
  screams: {
    aurelia: 'No. NO! Torneu-me\'l! Era meu!',
    direccion: 'Un altre cop no! No us n\'aneu! NO EM DEIXEU AQUÍ SOLA!',
  },
  /** The school's door once it is over. */
  schoolAgain: both(gerard('Es la escuela. Solo la escuela.'), aitor('El lunes abren.')),
  /**
   * The last scene (docs/castle-bosses.md § The last scene): said over it as Gerard holds her by the
   * neck, before he chooses. Then Aitor's one line, said in the fight as it plays out; Acabar's
   * `scene` over black once she has come apart in front of them (Bajar la mano has none: the dream
   * ends in white and they wake).
   */
  lastScene: 'La mà del Gerard és al seu coll. Ella no s\'hi resisteix.',
  /** Her last words, with his hand at her neck, just before the two commands come up (said in the fight, one after another). */
  lastWords: withThem('reina',
    reina('No pot ser...'),
    reina('Aquesta melodia... aquestes sis notes...'),
    reina('Tot el meu mon està construit al voltant de elle'),
    reina('Com les heu trobat...'),
    reina('Es imposible, es l\'unic que podia alliberar al Aitor'),
    reina('I ara... no puc.... estic feble...'),
    reina('Tothom tornarà a ser com era... i vosaltres també us convertireu en ells...'),
    reina('Em necesiteu, necesiteu la inocencia...'),
    reina('Necesiteu respectar, viure pels amics...'),
    reina('No soc dolenta... només us volia protegir...'),
    reina('Soc la imaginatzio, represento la cohesió, la amistad...'),
    reina('Deixeu-me viure...'),
  ),
  acabar: {
    aitor: aitor('Hazlo.'),
    scene: 'On hi havia el tron hi ha una aula, amb les cadires pujades a les taules.',
    epilogue: both(
      gerard('Dilluns. El despertador ha sonat a la seva hora.'),
      aitor('Hay café. Y nadie canta en la calle.'),
      gerard('Tot és al seu lloc. La ciutat, l\'escola, l\'horari.'),
      gerard('He trucat al Bernat. Diu que aquesta nit no ha somiat res.'),
    ),
  },
  bajar: {
    aitor: aitor('…Vale. Vale.'),
    epilogue: both(
      gerard('Dilluns. El despertador ha sonat a la seva hora.'),
      aitor('Hay café. En el bote hay una luz que no es como las otras.'),
      gerard('Queda una mica de rosa a la ciutat. En un tendal. En un xiclet enganxat al metro.'),
      aitor('Estás silbando.'),
      gerard('Són sis notes. No me les trec del cap.'),
    ),
  },
} as const;
export type EndingChoice = 'acabar' | 'bajar';

/** What a visit to the castle keeps while the day lasts: the rooms cleared, by phase. Not saved. */
export interface CastleRun {
  stamp: string; beaten: Partial<Record<CastlePhaseId, number[]>>; fighting?: { phase: CastlePhaseId; room: number };
  /** The floor has been stepped onto today, and whether it is another than the one last walked (`changed`). */
  seen?: boolean; changed?: boolean;
  /** Today's Eco de luz from Encarnados is taken (`strong`), and the fight starting now is against them (`strongFight`). */
  strong?: boolean; strongFight?: boolean;
  /** El horario: Gerard has said what a timetable is today (`told`), and what is pencilled on today's sheet (`pencil`). */
  told?: boolean; pencil?: number[];
}
export const freshCastle = (stamp = ''): CastleRun => ({ stamp, beaten: {} });

/** What the castle needs of the story: its flags, its days, and its ways of spending them. */
export interface CastleHost {
  has(flag: string): boolean;
  /** Sets a flag; returns whether it was new. */
  raise(flag: CastleFlag | `luz-${string}`): boolean;
  readonly adult: boolean;
  /** The save's own number and the day: what a floor is generated from. */
  readonly seed: number; readonly day: number;
  castle: CastleRun;
  /**
   * An hour goes by (a fight inside); a boss beaten makes her scream, the picture goes white and
   * they are in bed, the day over (never a night to walk home through); the party falls and wakes at
   * home the next morning.
   */
  hour(): StoryEffect[]; scream(boss: 'aurelia' | 'direccion'): StoryEffect[]; fall(): StoryEffect[];
  /** The next morning at home, with nothing said: black, home, awake. */
  morning(): StoryEffect[];
}
const say = (dialogue: Dialogue): StoryEffect => ({ kind: 'dialogue', dialogue });
/** Today's run: a new day (or a day gone back to) starts it over, since the floor is another. */
function run(host: CastleHost): CastleRun {
  const stamp = `${host.seed}:${host.day}`;
  if (host.castle.stamp !== stamp) host.castle = { ...freshCastle(stamp), changed: host.castle.stamp !== '' };
  return host.castle;
}
/** The Eco de luz the next Encarnados beaten will let go of, while any is left in the game. */
const strongNext = (host: CastleHost) => STRONG_LIGHTS.find(id => !host.has(`luz-${id}`));
/** Encarnados are out today: one day in two (even days), nobody has beaten the day's yet, and the game still has an Eco de luz for them. */
export const strongOpen = (host: CastleHost) => host.adult && !host.has('reina') && host.day % 2 === 0 && !run(host).strong && !!strongNext(host);
/** The room of today's floor of `phase` whose pupils are Encarnados: one of its plain rooms, another each day. */
export function strongRoom(host: CastleHost, phase: CastlePhaseId): number | undefined {
  if (!strongOpen(host)) return undefined;
  const rooms = castleFloor(host, phase).rooms.filter(room => room.encounter?.startsWith('alumnos-'));
  return rooms.length ? rooms[host.day % rooms.length].id : undefined;
}
/** Encarnados beaten: the day's Eco de luz, out of them and into the jar. */
export function strongWon(host: CastleHost): StoryEffect[] {
  const light = strongNext(host), today = run(host);
  if (!light || today.strong) return [];
  today.strong = true;
  host.raise(`luz-${light}`);
  return [{ kind: 'lights', people: [light] }];
}
/** Today's floor of `phase` (docs/castle.md § The generated floor): the same all day, another tomorrow. */
export function castleFloor(host: Pick<CastleHost, 'seed' | 'day'>, phase: CastlePhaseId): CastleFloor {
  // Asked for every frame (what a floor keeps shut): the day's three floors are kept, and no more.
  const key = `${host.seed}:${host.day}:${phase}`;
  let floor = FLOORS.get(key);
  if (!floor) { if (FLOORS.size >= 6) FLOORS.clear(); FLOORS.set(key, floor = floorFor(host.seed, host.day, phase)); }
  return floor;
}
const FLOORS = new Map<string, CastleFloor>();
const roomTag = (phase: CastlePhaseId, room: number) => `castillo-sala-${phase}-${room}`;

/** The pupils roaming today's floor (src/chasers.ts walks them): each fight room's, round its room, until beaten. */
export function castleFears(host: CastleHost, environment: EnvironmentId): { id: string; encounter: CastleEncounter; patrol: readonly Cell[]; sight: number; walk: number; run: number }[] {
  if (!host.adult || host.has('reina')) return [];
  if (isCastlePlace(environment)) {
    const phase = castlePhase(environment), beaten = run(host).beaten[phase.id] ?? [];
    return castleFloor(host, phase.id).rooms.filter(room => room.encounter && !beaten.includes(room.id)).map(room => ({
      id: roomTag(phase.id, room.id), encounter: room.encounter!, patrol: roomRound(room),
      // The élite does not leave her room: she waits. The others come when they see someone.
      sight: room.kind === 'elite' ? 3.5 : 5, walk: room.kind === 'elite' ? .9 : 1.3, run: room.kind === 'elite' ? 3.2 : 3.9,
    }));
  }
  // The bosses stand where they wait, and do not move: walking up to them is what starts it.
  const waiting = bossHere(host, environment);
  return waiting ? [{ id: `castillo-${waiting.boss}`, encounter: bossFight(host, waiting.boss), patrol: [{ ...waiting.bossAt }], sight: 0, walk: 0, run: 0 }] : [];
}
const bossFight = (host: CastleHost, boss: 'aurelia' | 'direccion' | 'reina'): CastleEncounter => boss === 'reina' ? (host.has('artilugio') ? 'reina-vuelta' : 'reina') : boss;
/** The boss still waiting in this fixed room, if any. */
function bossHere(host: CastleHost, environment: EnvironmentId) {
  if (!host.adult) return undefined;
  const phase = CASTLE_PHASES.find(p => p.into.environment === environment);
  return phase && !host.has(phase.flag) && !host.has('reina') ? phase : undefined;
}
/** A floor's puzzle while it stands: today's floor has one and nobody has solved it yet (solved once, it is solved for good). */
export function castlePuzzle(host: CastleHost, environment: EnvironmentId): CastlePuzzle | undefined {
  if (!host.adult || host.has('reina') || !isCastlePlace(environment)) return undefined;
  const puzzle = castleFloor(host, castlePhase(environment).id).puzzle;
  return puzzle && !host.has(`luz-${puzzle.id}`) ? puzzle : undefined;
}
/** The cells a floor's puzzle keeps shut: the corridor behind its door, and the door itself where the great Castigado stands against it. */
export function castleBlocked(host: CastleHost, environment: EnvironmentId): Cell[] {
  const puzzle = castlePuzzle(host, environment);
  return puzzle ? [...puzzle.gate, ...puzzle.id === 'pica-pared' ? puzzle.door : []].map(c => ({ ...c })) : [];
}
const PICA_WALL = 'castillo-pica-pared';
/** Today's timetable and what is pencilled on it (src/horario-ui.ts). */
export function castleHorario(host: CastleHost): { horario: Horario; tried: Board } {
  return { horario: horarioFor(castleFloor(host, 2).seed), tried: [...run(host).pencil ?? []] };
}
export function castlePencil(host: CastleHost, tried: Board) { run(host).pencil = [...tried]; }
/** A puzzle solved: its way opens for good, and it lets go of an Eco de luz. */
function solved(host: CastleHost, id: CastlePuzzle['id'], line: Dialogue): StoryEffect[] {
  return host.raise(`luz-${id}`) ? [say(line), { kind: 'lights', people: [id] }] : [];
}
/** A sheet handed in: it squares over what was in ink, and the door gives. */
export function castleSquared(host: CastleHost, board: Board): StoryEffect[] {
  if (!castlePuzzle(host, 'castillo-2')) return [];
  const { horario } = castleHorario(host);
  return squares(withGiven(horario, board)) ? solved(host, 'horario', LINES_CASTLE.horarioDone) : [];
}
/** Walking up to a boss starts its fight (the same id as the boss standing there). */
export function castleTriggers(host: CastleHost, environment: EnvironmentId): Trigger[] {
  const waiting = bossHere(host, environment);
  if (waiting) return [{ id: `castillo-${waiting.boss}`, cell: { ...waiting.bossAt }, radius: waiting.bossRadius }];
  // Pica pared: the wall the great Castigado stands against. Reaching it is touching it.
  const puzzle = castlePuzzle(host, environment);
  if (puzzle?.id === 'pica-pared') {
    // The wall's row from one side of it to the other, and the row before it: right behind its back is the wall too.
    const cells = puzzle.touch.flatMap(c => [c, { x: c.x - puzzle.out.x, z: c.z - puzzle.out.z }]);
    const x = Math.min(...cells.map(c => c.x)), z = Math.min(...cells.map(c => c.z));
    return [{ id: PICA_WALL, cell: { ...puzzle.touch[0] }, radius: 0, area: { x, z, w: Math.max(...cells.map(c => c.x)) - x + 1, d: Math.max(...cells.map(c => c.z)) - z + 1 } }];
  }
  // The first steps onto the first floor, once a day until Aurelià has fallen: it is not the gym, and it is not yesterday's.
  if (host.adult && environment === 'castillo-1' && !host.has('aurelia') && !run(host).seen) return [{ id: 'castillo-entrada', cell: { ...castleFloor(host, 1).spawn }, radius: 2.5 }];
  return [];
}
/** Something of the castle reached the party, or the party it: a room's pupils, a boss. */
export function castleNear(host: CastleHost, id: string): StoryEffect[] {
  if (!host.adult || host.has('reina')) return [];
  if (id === 'castillo-entrada') {
    const today = run(host);
    if (today.seen) return [];
    today.seen = true;
    return [say(today.changed ? LINES_CASTLE.floorChanged : LINES_CASTLE.floorFirst)];
  }
  if (id.startsWith(PICA_WALL)) return castlePuzzle(host, 'castillo-3')?.id === 'pica-pared' ? solved(host, 'pica-pared', LINES_CASTLE.picaDone) : [];
  const room = /^castillo-sala-(\d)-(\d+)$/.exec(id);
  if (room) {
    const phase = Number(room[1]) as CastlePhaseId, n = Number(room[2]), today = run(host);
    const there = castleFloor(host, phase).rooms.find(r => r.id === n);
    if (!there?.encounter || today.beaten[phase]?.includes(n)) return [];
    const strong = strongRoom(host, phase) === n;
    today.fighting = { phase, room: n }; today.strongFight = strong;
    return [{ kind: 'battle', encounter: there.encounter }];
  }
  const boss = id.slice('castillo-'.length);
  if (boss === 'aurelia') return host.has('aurelia') ? [] : [say(LINES_CASTLE.aureliaBefore), { kind: 'battle', encounter: 'aurelia' }];
  if (boss === 'direccion') return host.has('direccion') ? [] : [
    { kind: 'look', cell: DIRECCION_MEETING.table, height: 3.7 }, say(LINES_CASTLE.direccionBefore),
    { kind: 'look' }, { kind: 'battle', encounter: 'direccion' },
  ];
  if (boss === 'reina') return [say(host.has('artilugio') ? LINES_CASTLE.reinaAgain : LINES_CASTLE.reinaBefore), { kind: 'battle', encounter: bossFight(host, 'reina') }];
  return [];
}
/**
 * A castle fight's end. Returns nothing for a fall like any other (the story ends the day).
 * `taken`: the Queen had Aitor when it ended.
 */
export function castleBattle(host: CastleHost, event: { won: boolean; encounter?: string; taken?: boolean; ending?: EndingChoice }): StoryEffect[] | undefined {
  if (!isCastleEncounter(event.encounter)) return undefined;
  const today = run(host), fighting = today.fighting;
  today.fighting = undefined;
  const { encounter } = event;
  if (encounter === 'reina' || encounter === 'reina-vuelta') {
    // She does not die at 0: the fight closes on Gerard's hand at her neck, and he chooses there
    // (src/main.ts `lastScene`). Where the fight could not show it, the picture closes on him after.
    if (event.won && event.ending) return castleEnding(host, event.ending, true);
    if (event.won) return [{ kind: 'look', cell: { ...castlePhase(3).bossAt }, height: 4.5 }, { kind: 'ending' }];
    // The once it has to happen: Aitor hers, Gerard down. The morning after, Bernat calls them to
    // El Nucli, where the portal sends the artilugio home (docs/quests/bernat.md); until it has, a
    // fall to her is an ordinary one.
    if (event.taken && !host.has('artilugio') && !host.has('bernat-llama')) {
      host.raise('aitor-poseido');
      const morning = host.fall();
      host.raise('bernat-llama');
      return [...morning, say(LINES_CASTLE.bernatCall)];
    }
    return undefined;
  }
  if (!event.won) return undefined;
  if (encounter === 'aurelia' || encounter === 'direccion') {
    if (!host.raise(encounter)) return [];
    for (const who of CASTLE_LIGHTS[encounter]) host.raise(`luz-${who}`);
    const lines = encounter === 'aurelia' ? [LINES_CASTLE.aureliaWon, LINES_CASTLE.aureliaAfter] : [LINES_CASTLE.direccionWon, LINES_CASTLE.direccionAfter];
    return [say(lines[0]), { kind: 'lights', people: [...CASTLE_LIGHTS[encounter]] }, say(lines[1]), ...host.scream(encounter)];
  }
  // A room cleared stays cleared today; an hour of the day went into it.
  if (fighting && !today.beaten[fighting.phase]?.includes(fighting.room)) (today.beaten[fighting.phase] ??= []).push(fighting.room);
  // The first time each room is beaten, its Eco de luz (`ROOM_LIGHTS`).
  const room = ROOM_LIGHTS.find(id => id === encounter);
  const eco: StoryEffect[] = room && host.raise(`luz-${room}`) ? [{ kind: 'lights', people: [room] }] : [];
  return [...eco, ...host.hour()];
}
/**
 * Gerard chose (docs/castle-bosses.md § The last scene): the end, and the Monday after. `seen`: it
 * played in her fight, Aitor's line with it; otherwise he says it here.
 */
export function castleEnding(host: CastleHost, choice: EndingChoice, seen = false): StoryEffect[] {
  if (host.has('reina')) return [];
  host.raise('reina'); host.raise(choice === 'acabar' ? 'final-acabar' : 'final-bajar');
  const lines = LINES_CASTLE[choice];
  const answer: StoryEffect[] = seen ? [] : [say({ left: 'gerard35', right: 'aitor', lines: [lines.aitor] })];
  const told: StoryEffect[] = 'scene' in lines ? [{ kind: 'epilogue', choice, text: lines.scene }] : [];
  return [...answer, ...told, { kind: 'look' }, ...host.morning(), say(lines.epilogue), { kind: 'credits', choice }];
}

/** Where a door of the school leads instead, while the castle stands between its rooms. */
export function castleRedirect(host: CastleHost, interactionId: string): { environment: EnvironmentId; cell: Cell } | undefined {
  if (!host.adult || host.has('reina')) return undefined;
  const into = (phase: CastlePhaseId) => ({ environment: castlePhase(phase).environment as EnvironmentId, cell: { ...castleFloor(host, phase).spawn } });
  // The stair behind the curtain climbs to the first floor until Aurelià has fallen; then his stretch is
  // the school again and the stair comes out by the gym (the gym's own door, from the patio, is held
  // shut from inside until then: `castleGate`).
  if (interactionId === CURTAIN_WAY) return host.has('aurelia') ? { environment: 'palacio-gimnasio', cell: { ...castlePhase(1).into.cell } } : into(1);
  if (interactionId === 'gimnasio-vestuarios' && host.has('aurelia') && !host.has('direccion')) return into(2);
  if (interactionId === 'secretaria-direccio' && host.has('direccion')) return into(3);
  return undefined;
}
/** A door of the school that will not open yet says why (the lines are chapter 2's own). */
export function castleGate(host: CastleHost, interactionId: string, shut: { gym: Dialogue; office: Dialogue; direction: Dialogue }): Dialogue | undefined {
  // Aurelià holds his gym from inside: the way to him is the first floor, up the stair behind the curtain.
  if (interactionId === 'patio-gimnasio' && !host.has('aurelia')) return shut.gym;
  if (interactionId === 'patio-secretaria' && !host.has('direccion')) return shut.office;
  if (interactionId === 'secretaria-direccio' && !host.has('direccion')) return shut.direction;
  return undefined;
}
/** The curtain in the hall once its guards have fallen: open for good, its stair the way up (`castleRedirect` says where to). */
export const CURTAIN_WAY = 'cruzar-cortina';
const CURTAIN_CELL: Cell = { x: 16, z: 10 };
/** What the story adds to a floor: its staff room and its cupboard, rooms with nothing in them yet; and the curtain's stair in the hall. */
export function castleInteractions(host: CastleHost, environment: EnvironmentId): Interaction[] {
  if (host.adult && environment === 'palacio' && host.has('cortina') && !host.has('reina')) {
    return [{ id: CURTAIN_WAY, label: 'Subir por la escalera', hint: 'Subir', cell: { ...CURTAIN_CELL }, to: { environment: castlePhase(1).environment, cell: { ...castleFloor(host, 1).spawn } } }];
  }
  if (!host.adult || !isCastlePlace(environment)) return [];
  const floor = castleFloor(host, castlePhase(environment).id), puzzle = castlePuzzle(host, environment);
  return [
    ...floor.rooms.flatMap(room => room.kind === 'rest' ? [{ id: 'castillo-descanso', label: 'Sentarse un momento', hint: 'Descansar', cell: { ...room.cell } }]
      : room.kind === 'find' ? [{ id: 'castillo-armario', label: 'Mirar el armario', cell: { ...room.cell } }] : []),
    // El horario: the sheet on the wall, and the door that says why it will not open.
    ...puzzle?.id === 'horario' ? [
      { id: 'castillo-horario', label: 'Mirar el horario', hint: 'Mirar', cell: { ...puzzle.board } },
      { id: 'castillo-puerta', label: 'Abrir la puerta', cell: { ...puzzle.door[0] } },
    ] : [],
  ];
}
/** A castle interaction used, or the first step onto a floor. Returns nothing if it is not the castle's. */
export function castleInteract(host: CastleHost, id: string): StoryEffect[] | undefined {
  if (id === 'castillo-descanso') return [say(LINES_CASTLE.rest), ...host.hour()];
  if (id === 'castillo-armario') return [say(LINES_CASTLE.find)];
  if (id === 'castillo-puerta') return [say(LINES_CASTLE.horarioShut)];
  if (id === 'castillo-horario') {
    const today = run(host), first = !today.told;
    today.told = true;
    return [...first ? [say(LINES_CASTLE.horarioBoard)] : [], { kind: 'horario' }];
  }
  if (id === 'enter-school' && host.has('reina')) return [say(LINES_CASTLE.schoolAgain)];
  return undefined;
}
/** The room encounters of a phase, for whoever wants to list them (the picker, the simulator). */
export const roomFights = (phase: CastlePhaseId): readonly RoomEncounter[] => [...castlePhase(phase).fights, castlePhase(phase).elite];
