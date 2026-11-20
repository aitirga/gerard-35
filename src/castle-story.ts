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
import { CASTLE_LIGHTS, CASTLE_PHASES, castlePhase, floorFor, isCastleEncounter, isCastlePlace, roomRound,
  type CastleEncounter, type CastleFlag, type CastleFloor, type CastlePhaseId, type Cell, type RoomEncounter } from './castle.ts';

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
  /** Through the gym's door the first time: it is not the gym. */
  floorFirst: both(
    gerard('Esto no es el gimnasio. Aquí había un pasillo de diez metros.'),
    aitor('Pues ahora hay salas. Y se mueve algo dentro.'),
    gerard('Llevan bata. Son… del tamaño de los de tercero.'),
    aitor('No son niños, Gerard. Mírales la cara.'),
  ),
  /** A new day, a new floor. */
  floorChanged: both(aitor('Ayer esto no estaba así.'), gerard('No. Cada mañana lo recoloca.')),
  rest: both(gerard('La sala de profesores. La cafetera sigue caliente.'), aitor('Cinco minutos. Y seguimos.')),
  find: both(gerard('Un armario de material. Tizas, fundas, un silbato.'), aitor('Nada que sirva. Todavía.')),
  aureliaBefore: withThem('aurelia',
    aurelia('Llega tarde, Gerard. Y trae a alguien que no está matriculado.'),
    gerard('Aurelià. Tienes los ojos…'),
    aurelia('Aquí por fin hay orden. Nadie corre, nadie contesta. Siéntese.'),
    aitor('No se va a apartar.'),
  ),
  aureliaWon: withThem('aurelia',
    aurelia('…¿Gerard? ¿Qué hago yo en el gimnasio?'),
    gerard('Dando clase. A tu manera.'),
    aurelia('Me dolía menos cuando mandaba ella. No tenía que decidir nada.'),
    aitor('Sal por el patio. La pompa de la puerta te deja pasar.'),
  ),
  aureliaAfter: both(
    aitor('Te ha dejado algo. A ti y a mí.'),
    gerard('Noto que cabe más. Como si hubiera sitio para otra.'),
    aitor('La puerta de los vestuarios ya no está pegada.'),
  ),
  lockers: both(gerard('Los vestuarios. Detrás suena papel. Mucho papel.'), aitor('Secretaría queda por ahí. O quedaba.')),
  direccionBefore: withThem('mar',
    mar('Gerard. Te esperábamos a las ocho. Hay que cerrar el acta.'),
    montse('Solo falta tu firma. Y la del acompañante.'),
    pilar('Es un trámite. Luego ya no hay que pensar en nada más.'),
    gerard('Mar. Montse. Pilar. Soy yo. Os llevo el café cada mañana.'),
    mar('Por eso mismo. Firma.'),
  ),
  direccionWon: withThem('mar',
    mar('…El acta está en blanco.'),
    montse('¿Cuánto llevamos aquí sentadas?'),
    pilar('Gerard, la puerta de Direcció. La de dentro. La ha abierto ella.'),
    gerard('Lo sé. Marchaos por el patio.'),
  ),
  direccionAfter: both(
    aitor('Tres luces. Tres más para el bote.'),
    gerard('Y algo más. Algo que no sé usar todavía.'),
    aitor('Detrás de Direcció ya no hay escuela, ¿verdad?'),
    gerard('No. Detrás está ella.'),
  ),
  reinaBefore: withThem('reina',
    reina('Has tardado veinticinco años.'),
    gerard('…¿Nuria?'),
    reina('Me puse su cara porque la buscabais. Nunca tuve una mía. Soy lo que dejasteis en el patio cuando sonó el timbre.'),
    reina('No quiero haceros daño. Quiero que no os vayáis otra vez.'),
    aitor('Tiene a medio barrio durmiendo de pie. Eso es daño.'),
  ),
  reinaAgain: withThem('reina',
    reina('Vuelves. Y él vuelve contigo, como si no hubiera pasado.'),
    gerard('Ha pasado. Me acuerdo de todo.'),
    reina('Entonces sabes cómo acaba.'),
    aitor('Esta vez no.'),
  ),
  /** The morning after Gerard fell to Aitor's hand: Bernat calls them to El Nucli (docs/quests/bernat.md, round 5). */
  bernatCall: withThem('bernat35',
    aitor('Te suena el móvil. Pone «Bernat».'),
    bernat('Gerard. Os vi caer anoche. No me preguntes cómo: lo vi.'),
    bernat('Venid a El Nucli. Ya. Tengo que enseñaros algo, y por teléfono no.'),
    aitor('…Gerard. Ayer. Yo te…'),
    gerard('No eras tú. Coge la chaqueta.'),
  ),
  /** The school's door once it is over. */
  schoolAgain: both(gerard('Es la escuela. Solo la escuela.'), aitor('El lunes abren.')),
  /** The last scene (docs/castle-bosses.md § The last scene): what is seen before Gerard chooses. */
  lastScene: 'Está en el suelo, pequeña. En la mano de Gerard el Foc Binari ya tiene forma, y los números giran despacio a su alrededor.',
  acabar: {
    aitor: aitor('Hazlo.'),
    scene: 'Q.E.D. Se deshace en motas que pasan del rosa al gris. Donde estaba el trono hay un aula, con las sillas subidas a las mesas.',
    epilogue: both(
      gerard('Lunes. Ha sonado el despertador a su hora.'),
      aitor('Hay café. Y nadie canta en la calle.'),
      gerard('Todo está en su sitio. La ciudad, la escuela, el horario.'),
      gerard('He abierto la libreta de Bernat. Está en blanco.'),
    ),
  },
  bajar: {
    aitor: aitor('…Vale. Vale.'),
    scene: 'La magia se apaga en la mano. Ella encoge hasta ser una canica rosa, tibia, que cabe en el bolsillo.',
    epilogue: both(
      gerard('Lunes. Ha sonado el despertador a su hora.'),
      aitor('Hay café. En el bote hay una luz que no es como las otras.'),
      gerard('Queda algo de rosa en la ciudad. En un toldo. En un chicle pegado en el metro.'),
      aitor('Estás silbando.'),
      gerard('Son seis notas. No me las quito.'),
    ),
  },
} as const;
export type EndingChoice = 'acabar' | 'bajar';

/** What a visit to the castle keeps while the day lasts: the rooms cleared, by phase. Not saved. */
export interface CastleRun {
  stamp: string; beaten: Partial<Record<CastlePhaseId, number[]>>; fighting?: { phase: CastlePhaseId; room: number };
  /** The floor has been stepped onto today, and whether it is another than the one last walked (`changed`). */
  seen?: boolean; changed?: boolean;
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
  /** An hour goes by (a fight inside); night falls at once (a boss beaten); the party falls and wakes at home the next morning. */
  hour(): StoryEffect[]; nightfall(): StoryEffect[]; fall(): StoryEffect[];
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
/** Today's floor of `phase` (docs/castle.md § The generated floor): the same all day, another tomorrow. */
export const castleFloor = (host: Pick<CastleHost, 'seed' | 'day'>, phase: CastlePhaseId): CastleFloor => floorFor(host.seed, host.day, phase);
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
/** Walking up to a boss starts its fight (the same id as the boss standing there). */
export function castleTriggers(host: CastleHost, environment: EnvironmentId): Trigger[] {
  const waiting = bossHere(host, environment);
  if (waiting) return [{ id: `castillo-${waiting.boss}`, cell: { ...waiting.bossAt }, radius: waiting.bossRadius }];
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
  const room = /^castillo-sala-(\d)-(\d+)$/.exec(id);
  if (room) {
    const phase = Number(room[1]) as CastlePhaseId, n = Number(room[2]), today = run(host);
    const there = castleFloor(host, phase).rooms.find(r => r.id === n);
    if (!there?.encounter || today.beaten[phase]?.includes(n)) return [];
    today.fighting = { phase, room: n };
    return [{ kind: 'battle', encounter: there.encounter }];
  }
  const boss = id.slice('castillo-'.length);
  if (boss === 'aurelia') return host.has('aurelia') ? [] : [say(LINES_CASTLE.aureliaBefore), { kind: 'battle', encounter: 'aurelia' }];
  if (boss === 'direccion') return host.has('direccion') ? [] : [say(LINES_CASTLE.direccionBefore), { kind: 'battle', encounter: 'direccion' }];
  if (boss === 'reina') return [say(host.has('artilugio') ? LINES_CASTLE.reinaAgain : LINES_CASTLE.reinaBefore), { kind: 'battle', encounter: bossFight(host, 'reina') }];
  return [];
}
/**
 * A castle fight's end. Returns nothing for a fall like any other (the story ends the day).
 * `taken`: the Queen had Aitor when it ended.
 */
export function castleBattle(host: CastleHost, event: { won: boolean; encounter?: string; taken?: boolean }): StoryEffect[] | undefined {
  if (!isCastleEncounter(event.encounter)) return undefined;
  const today = run(host), fighting = today.fighting;
  today.fighting = undefined;
  const { encounter } = event;
  if (encounter === 'reina' || encounter === 'reina-vuelta') {
    // She does not die at 0: the picture closes on Gerard, and he chooses (src/endings.ts).
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
    return [say(lines[0]), { kind: 'lights', people: [...CASTLE_LIGHTS[encounter]] }, say(lines[1]), ...host.hour(), ...host.nightfall()];
  }
  // A room cleared stays cleared today; an hour of the day went into it.
  if (fighting && !today.beaten[fighting.phase]?.includes(fighting.room)) (today.beaten[fighting.phase] ??= []).push(fighting.room);
  return host.hour();
}
/** Gerard chose (docs/castle-bosses.md § The last scene): the end, and the Monday after. */
export function castleEnding(host: CastleHost, choice: EndingChoice): StoryEffect[] {
  if (host.has('reina')) return [];
  host.raise('reina'); host.raise(choice === 'acabar' ? 'final-acabar' : 'final-bajar');
  const lines = LINES_CASTLE[choice];
  return [say({ left: 'gerard35', right: 'aitor', lines: [lines.aitor] }), { kind: 'epilogue', choice, text: lines.scene }, { kind: 'look' }, ...host.morning(), say(lines.epilogue), { kind: 'credits' }];
}

/** Where a door of the school leads instead, while the castle stands between its rooms. */
export function castleRedirect(host: CastleHost, interactionId: string): { environment: EnvironmentId; cell: Cell } | undefined {
  if (!host.adult || host.has('reina')) return undefined;
  const into = (phase: CastlePhaseId) => ({ environment: castlePhase(phase).environment as EnvironmentId, cell: { ...castleFloor(host, phase).spawn } });
  // The gym's door opens onto the first floor until Aurelià has fallen; then it is the gym's door again.
  if (interactionId === 'patio-gimnasio' && !host.has('aurelia')) return into(1);
  if (interactionId === 'gimnasio-vestuarios' && host.has('aurelia') && !host.has('direccion')) return into(2);
  if (interactionId === 'secretaria-direccio' && host.has('direccion')) return into(3);
  return undefined;
}
/** A door of the school that will not open yet says why (the lines are chapter 2's own). */
export function castleGate(host: CastleHost, interactionId: string, shut: { office: Dialogue; direction: Dialogue }): Dialogue | undefined {
  if (interactionId === 'patio-secretaria' && !host.has('direccion')) return shut.office;
  if (interactionId === 'secretaria-direccio' && !host.has('direccion')) return shut.direction;
  return undefined;
}
/** What the story adds to a floor: its staff room and its cupboard, rooms with nothing in them yet. */
export function castleInteractions(host: CastleHost, environment: EnvironmentId): Interaction[] {
  if (!host.adult || !isCastlePlace(environment)) return [];
  const floor = castleFloor(host, castlePhase(environment).id);
  return floor.rooms.flatMap(room => room.kind === 'rest' ? [{ id: 'castillo-descanso', label: 'Sentarse un momento', hint: 'Descansar', cell: { ...room.cell } }]
    : room.kind === 'find' ? [{ id: 'castillo-armario', label: 'Mirar el armario', cell: { ...room.cell } }] : []);
}
/** A castle interaction used, or the first step onto a floor. Returns nothing if it is not the castle's. */
export function castleInteract(host: CastleHost, id: string): StoryEffect[] | undefined {
  if (id === 'castillo-descanso') return [say(LINES_CASTLE.rest), ...host.hour()];
  if (id === 'castillo-armario') return [say(LINES_CASTLE.find)];
  if (id === 'enter-school' && host.has('reina')) return [say(LINES_CASTLE.schoolAgain)];
  return undefined;
}
/** The room encounters of a phase, for whoever wants to list them (the picker, the simulator). */
export const roomFights = (phase: CastlePhaseId): readonly RoomEncounter[] => [...castlePhase(phase).fights, castlePhase(phase).elite];
