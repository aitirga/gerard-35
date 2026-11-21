/**
 * What the bestiary (`just bestiario`, src/bestiary.ts) shows of every foe, taken from the game's own
 * rules and never copied by hand: each fight is built as the game builds it (`createFight`, the
 * simulator's door to `createEncounter`) to see who comes out, with what PV, stats and weaknesses, and
 * played a few times by the simulator's bot (`playOut`) to see which moves each foe makes. A fight or
 * a foe added to the game shows up here by itself. Only two things are written by hand, each with its
 * source: the castle's questions and answers (docs/castle.md, docs/castle-bosses.md), and what moves
 * each family of models makes in a fight (src/battle-scene.ts).
 */
import {
  ELEMENTS, ELEMENT_ORDER, FOE_ABILITIES, affinityOf, createMinionBattle, isCamping, isCuerdas, isLuca, isModelo, isOnion, isSobremesa,
  type BattleState, type Combatant, type FoeKind,
} from './battle.ts';
import { DUO, FIGHTS, MISSIONS, MISSION_IDS, TARGETS, createFight, missionOf, playOut, seeded, type Setup } from './battle-sim.ts';
import { CASTLE_FIGHT_NAMES, CASTLE_NAMES, isCastle, isCastleEncounter } from './castle.ts';
import { ENCOUNTER_NAMES } from './game-sim.ts';
import { STAT_LABELS, type Stats } from './stats.ts';
import { BOSS_FIGURES, FOE_BODIES } from './foe-bodies.ts';

/** Every fight of the game: the simulator's, and the palace minion's, which is chapter 1's alone. */
export const ALL_FIGHTS: readonly string[] = [...FIGHTS, 'palace-minion'];

/** Where a fight is met, as the bestiary groups it: chapter 1's street, the palace, each ánima mission, the castle. */
export const PLACES: readonly { id: string; name: string; has: (fight: string) => boolean }[] = [
  { id: 'calle', name: 'La calle · capítulo 1', has: fight => fight.startsWith('dogs') || fight.startsWith('possessed') },
  { id: 'palacio', name: 'El palacio y la noche', has: fight => fight === 'palace-minion' || fight === 'palace-guards' || fight === 'night-guard' },
  ...MISSION_IDS.map(id => ({ id, name: `Misión · ${MISSIONS[id].name}`, has: (fight: string) => missionOf(fight) === id })),
  { id: 'castillo', name: 'El castillo de la Reina', has: (fight: string) => isCastleEncounter(fight) },
];
export const placeOf = (fight: string) => PLACES.find(place => place.has(fight)) ?? { id: 'otros', name: 'Otros', has: () => true };

/** A fight's name as the reports say it: `dogs:3` is «Los perros · 3». */
export function fightName(fight: string) {
  const [id, count] = fight.split(':');
  const name = isCastleEncounter(id) ? CASTLE_FIGHT_NAMES[id] : ENCOUNTER_NAMES[id] ?? (id === 'possessed' ? 'Los perros poseídos' : id);
  return count ? `${name} · ${count}` : name;
}

/** One foe as it comes out in one fight. */
export interface Meeting { fight: string; foe: Combatant }
/** A kind of foe, everywhere it is met. */
export interface FoeKindSeen { kind: FoeKind; name: string; aka: string[]; place: { id: string; name: string }; meetings: Meeting[] }

/** A fight as the game starts it, for the bot that plays it: the target that plays its answer, or one of its mission's, or the dual party. */
export function setupFor(fight: string): Setup {
  const strip = ({ id: _id, why: _why, win: _w, roundsLost: _l, hpLeftWon: _h, roundsWon: _r, duals: _d, ...setup }: (typeof TARGETS)[number]) => setup;
  const own = TARGETS.filter(target => target.fight === fight);
  const kin = TARGETS.filter(target => isCastleEncounter(fight) ? isCastleEncounter(target.fight) : missionOf(target.fight) && missionOf(target.fight) === missionOf(fight));
  const pick = own.find(t => t.policy === 'smart') ?? own[0] ?? kin.find(t => t.policy === 'smart');
  return { ...(pick ? strip(pick) : { party: DUO, levels: { papagato: 3, matemagico: 3 }, policy: 'smart' as const }), fight, maxRounds: 40 };
}

/** The fight as the game starts it; the palace minion's is chapter 1's own. */
export function startFight(fight: string, seed: number): { state: BattleState; setup: Setup; random: () => number } {
  const setup = setupFor(fight), random = seeded(seed);
  return { state: fight === 'palace-minion' ? createMinionBattle() : createFight(setup, random), setup, random };
}

/** A foe's name without the number a fight gives it when there are two («Cebollita 2»). */
const plainName = (foe: Combatant) => foe.kind && isCastle(foe.kind) ? CASTLE_NAMES[foe.kind] : foe.name.replace(/\s+\d+$/, '');

/**
 * Every kind of foe in the game, by building every fight with a few seeds (rooms and packs are drawn
 * at random): its name, where it is met and how it comes out in each fight.
 */
export function foesOfTheGame(seeds = 6): FoeKindSeen[] {
  const kinds = new Map<FoeKind, FoeKindSeen>();
  for (const fight of ALL_FIGHTS) {
    for (let seed = 1; seed <= seeds; seed++) {
      let state: BattleState;
      try { state = startFight(fight, seed).state; } catch { continue; }
      for (const foe of state.foes) {
        if (!foe.kind) continue;
        const seen = kinds.get(foe.kind) ?? { kind: foe.kind, name: plainName(foe), aka: [], place: placeOf(fight), meetings: [] };
        kinds.set(foe.kind, seen);
        const name = plainName(foe);
        if (name !== seen.name && !seen.aka.includes(name)) seen.aka.push(name);
        if (!seen.meetings.some(m => m.fight === fight)) seen.meetings.push({ fight, foe: structuredClone(foe) });
        // A pupil of the castle can come as an Encarnado (src/castle.ts `STRONG`): how it comes out then, once, in the first room it is met in.
        if (/^alumnos-/.test(fight) && foe.castle && !foe.part && !seen.meetings.some(m => m.foe.castle?.strong)) {
          const strong = createFight({ ...setupFor(fight), strong: true }, seeded(seed)).foes.find(f => f.kind === foe.kind);
          if (strong) seen.meetings.push({ fight: `${fight}:encarnados`, foe: structuredClone(strong) });
        }
      }
      // A fight whose foes never change needs no second look.
      if (fight !== 'palace-minion' && seed === 1 && !/^(crias|alumnos|delegada|camping-tienda)/.test(fight)) break;
    }
  }
  return [...kinds.values()];
}

/** What one foe is, in a few words: PV, stats, weaknesses and resistances, and what it carries. */
export function traitsOf(foe: Combatant) {
  const affinities = ELEMENT_ORDER.map(element => ({ element: ELEMENTS[element].name, colour: ELEMENTS[element].colour, affinity: affinityOf(foe, element) })).filter(a => a.affinity);
  const flags: string[] = [];
  if (foe.shell) flags.push('Pringue: solo el fuego entra');
  if (foe.layers) flags.push(`${foe.layers} capas`);
  if (foe.part) flags.push('Parte de otro: no actúa, no hace falta tumbarla');
  if (foe.power) flags.push(`Golpe propio ${foe.power}`);
  if (foe.dish) flags.push(`Plato: ${foe.dish}`);
  if (foe.countdown) flags.push(`Cuenta atrás ${foe.countdown}`);
  if (foe.castle?.year) flags.push(`Curso ${foe.castle.year}.º`);
  if (foe.castle?.filling) flags.push(`Relleno: ${ELEMENTS[foe.castle.filling].name}`);
  if (foe.castle?.gum) flags.push(`Chicle: ${foe.castle.gum}`);
  if (foe.castle?.strong) flags.push('Encarnado: rojo por dentro, más PV y pega más; vencido, un Eco de luz (uno al día)');
  const stats = (Object.keys(STAT_LABELS) as (keyof Stats)[]).filter(key => key !== 'pv').map(key => ({ label: STAT_LABELS[key], value: foe.stats[key] }));
  return { pv: foe.maxHp, stats, affinities, flags };
}

/** The targets that say what a fight is meant to be (`TARGETS`): its question and its answer, in the simulator's words. */
export const targetsOf = (fight: string) => TARGETS.filter(target => target.fight === fight).map(({ id, why, policy, win, ban }) => ({ id, why, policy, win, ban }));

/**
 * The moves a kind of foe makes, as the simulator's bot meets it: every fight it is in, played `runs`
 * times. Abilities by their name in the fight (FOE_ABILITIES), with how often each came; a plain
 * blow with no name of its own does not show.
 */
export function movesOf(kind: FoeKind, fights: readonly string[], runs = 4) {
  const counts: Record<string, number> = {};
  const failed: string[] = [];
  for (const fight of fights) {
    for (let r = 0; r < runs; r++) {
      try {
        const { state, setup, random } = startFight(fight, 100 + r);
        const run = playOut(state, setup, random);
        for (const [id, n] of Object.entries(run.moves[kind] ?? {})) counts[id] = (counts[id] ?? 0) + n;
      } catch (error) { failed.push(`${fight}: ${(error as Error).message}`); break; }
    }
  }
  // Two ids can share a name (Vertitrón's charge and its Rayo are both «Rayo terrorífico»): one line each name.
  const byName = new Map<string, { ids: string[]; name: string; card: boolean; times: number }>();
  for (const [id, times] of Object.entries(counts)) {
    const spec = FOE_ABILITIES[id as keyof typeof FOE_ABILITIES], name = spec?.name ?? id;
    const line = byName.get(name) ?? { ids: [], name, card: false, times: 0 };
    line.ids.push(id); line.card ||= !!spec?.card; line.times += times; byName.set(name, line);
  }
  const moves = [...byName.values()].sort((a, b) => b.times - a.times);
  return { moves, failed, runs: runs * fights.length };
}

/**
 * The castle's questions and answers, by kind (also the pupils still being designed). Copied from
 * docs/castle.md § Bestiary and docs/castle-bosses.md: change them there first.
 */
export const CASTLE_ANSWERS: Record<string, { character: string; answer: string }> = {
  repetidor: { character: 'Grande y lento. Anuncia «Empujón → X» y pega muy fuerte. Envuelto en pringue grueso.', answer: 'Momento y elemento: Defender en el aviso; derretir el pringue.' },
  empollon: { character: 'Estudia al grupo: tras recibir un tipo de golpe, lo aprende y lo resiste (un chip en su placa).', answer: 'Tipo de golpe: alternar físico y mágico; no repetir nunca.' },
  chivata: { character: 'Frágil. «Chivatazo → X» marca a uno del grupo: el siguiente golpe que recibe es triple.', answer: 'A quién primero: a ella, antes de que pegue El Repetidor.' },
  gemelo: { character: 'Dos cuerpos. Si uno cae solo, el otro lo levanta al final de la ronda.', answer: 'Orden y momento: bajarlos juntos y tumbar a los dos en la misma ronda.' },
  ausente: { character: 'No está: solo se le puede golpear en la ronda en que acaba de actuar. Los estados con reloj sí le llegan.', answer: 'Momento, o estado: quemarlo y dejar que el reloj trabaje.' },
  castigado: { character: 'De cara a la pared, no ataca. Cada golpe que no lo tumba le da Rabia; a la tercera revienta sobre todos.', answer: 'Momento: dejarlo para el final y tumbarlo de un golpe grande (una herida abierta, un dual, Punto débil).' },
  monton: { character: 'Chicle sin forma aún. Toma la del primer ánima que le pega y vuelve su estado contra el grupo.', answer: 'Elegir qué se le enseña: abrir con el ánima cuyo estado menos duela.' },
  delegada: { character: 'Manda. Mientras está en pie, los suyos pegan todos al mismo y sus avisos no se ven.', answer: 'Parte y orden: silenciarla (confusión, un turno perdido) o tumbarla primero.' },
  aurelia: { character: 'La lección (Dictado, Pregunta → X, Castigo a quien repite tipo de golpe), La carrera (Vuelta de 20 s, Sprint y Ritmo), La última recta (Expulsión, Récord cargado dos rondas).', answer: 'Parte: romper El Atril (madera, arde); Defender en la Pregunta lo deja expuesto. Estado: un estado de reloj nuevo le hace tropezar la vuelta. Momento: gastar lo guardado antes del Récord.' },
  atril: { character: 'Parte de Aurelià: mientras está en pie, él recibe la mitad de todo. Romperlo quita el Dictado.', answer: 'Romperlo: es madera, arde.' },
  directiva: { character: 'Mar, Montse y Pilar, cada una con un elemento: Expediente (fuego), Horario (agua, moja a todos), Circular (eléctrico, brutal en mojados). Firman el Acta cada tres rondas; Cambio de cargo les cambia elementos y debilidades.', answer: 'Orden: primero la que lleva el agua. Elemento: releer su debilidad tras cada Cambio de cargo. Momento: una cegada, confusa o sin turno no firma.' },
  reina: { character: 'El chicle (capas de pringue, cada una pide otra cosa), Las manos (Atrapar saca a uno hasta romper esa mano), La pompa (carga varias rondas), y al décimo toma a Aitor.', answer: 'Todo el juego otra vez: fuego, golpe o chispa según la capa; romper las manos; romper la pompa o Defender. Con el artilugio, seis notas liberan a Aitor.' },
  mano: { character: 'Una mano de la Reina, con sus PV. «Atrapar» saca a uno del grupo del combate hasta que se rompe.', answer: 'Romperla para recuperar a quien tiene.' },
};

/** The families of models, by how a fight moves them (src/battle-scene.ts). */
export type Family = 'party' | 'monster' | 'castle' | 'castlePiece' | 'minion' | 'onion' | 'dish' | 'ghost' | 'vertigo' | 'camping' | 'cuerdas' | 'modelo' | 'luca' | 'sobremesa' | 'dog' | 'creature';
export const MOTION: Record<Family, string[]> = {
  party: ['Andar y correr con el rig del juego (rodillas, codos, tobillos; WalkAnimation)', 'Atacar: va hasta el enemigo y golpea; lanzar: el hechizo sale de la mano', 'Defender, recibir (destello) y caer', 'Parpadea y habla (párpados y boca, src/face.ts)', 'Se tiñe con el ánima que lleva'],
  monster: ['Clips de Meshy en su archivo: andar y correr (y los que traiga)', 'Aún sin conectar al combate: allí sigue usando su modelo provisional'],
  castle: ['Su figura de Meshy en el combate (src/castle-models.ts): corre con su clip al arremeter y aguanta su pose de pie', 'En las plantas del castillo y de noche en la Meridiana anda su ronda y corre al perseguir', 'Destello al recibir; se deshace en motas al caer'],
  castlePiece: ['Una pieza, sin esqueleto (src/castle-models.ts): quieta en el combate; si se mueve, repta encogiéndose y estirándose', 'Destello al recibir; se deshace en motas al caer'],
  creature: ['Una pieza: bambolea y arremete como los miedos de Uri', 'Destello al recibir, se deshace en motas al caer'],
  minion: ['Bambolea en vez de olfatear; respira (se hincha y deshincha)', 'La cabeza de chicle cabecea y mira; arremete al atacar', 'Destello al recibir; el fuego derrite su pringue (motas de chicle)', 'Se deshace en motas al caer'],
  onion: ['Encoge capa a capa: su piel se aclara con las que le quedan y las capas salen volando', 'Carrerilla: rueda hacia atrás antes del Aplastón', 'Bambolea; se deshace al caer'],
  dish: ['Da una vuelta entera cuando cambia de plato; con la sorpresa, la campana tiembla', 'Bambolea; se deshace al caer'],
  ghost: ['Se vuelve transparente entero y tiembla (Transparente)', 'Se deshace al caer'],
  vertigo: ['Rígido: no se estira ni bambolea; se inclina pesado y tiembla al recibir', 'Su figura de Meshy sigue las juntas del robot (src/fears.ts `dressVertitron`). Poses: pisotón, barrido, grito, carga del rayo, retroceso, arrodillarse al caer', 'Su ojo gira (parte con PV propios); Uri arriba con Nil en brazos'],
  camping: ['Su modelo enseña su regla (src/camping-foes.ts `show`): la cara del dado, el agente boca arriba o abajo, la bombona del mago', 'Bambolea; se deshace al caer'],
  cuerdas: ['Cuerdas, cristal y luz que se mueven con su regla (src/cuerdas-foes.ts `show`): el nudo de La Lealtad y su escudo, los anillos y las ondas del Eco en el suelo; La Voz canta', 'Se deshace al caer; un Eco vuelve a atarse'],
  modelo: ['Celdas, figuras y órbitas que enseñan su valor, su agua y los electrones que le quedan (src/modelo-foes.ts)', 'El Átomo: sus electrones giran, más deprisa antes de la Reacción; arrancados, caen apagados al agua', 'Se deshace al caer'],
  luca: ['Polillas, estampados y lámparas que se encienden con la luz de su color (src/luca-foes.ts)', 'Los capellanes con su peinado; se deshacen al caer'],
  sobremesa: ['Un solo cuerpo con siete amigos, cada uno un hueso del rig (src/sobremesa.ts)', 'Cada amigo ataca con su gesto; liberado, se separa del cuerpo'],
  dog: ['Olfatea, mira y se lanza (la cabeza pivota en el cuello); mueve la cola', 'Ojos rosa oscuro cuando la Reina los tiene'],
};

/** Which family moves a foe's model, by its kind: whether it has a template of its own (src/fears.ts) decides most of it. */
export function familyOf(kind: FoeKind, template: boolean): Family {
  if (isSobremesa(kind)) return 'sobremesa';
  if (template) return isOnion(kind) ? 'onion' : kind === 'plato' || kind === 'platito' ? 'dish' : kind === 'fantasmita' ? 'ghost' : kind === 'vertigo' || kind === 'vertigo-ojo' ? 'vertigo'
    : isCamping(kind) ? 'camping' : isCuerdas(kind) ? 'cuerdas' : isModelo(kind) ? 'modelo' : isLuca(kind) ? 'luca' : 'creature';
  if (kind === 'minion' || kind === 'guardian' || isCastle(kind)) return 'minion';
  if (kind === 'vertigo-ojo') return 'vertigo';
  return 'dog';
}

/** How a foe's model stands today, the bestiary's «what to improve» signal. */
export interface ModelStatus { tone: 'own' | 'procedural' | 'placeholder' | 'part' | 'none'; label: string }
/**
 * Mirrors `sourceOf` in src/battle-scene.ts: a fear's template, else the palace minion for the
 * minion, the guards and the castle, else a dog. La Sobremesa is its own body.
 */
export function modelStatusOf(kind: FoeKind, template: boolean): ModelStatus {
  if (isSobremesa(kind)) return { tone: 'own', label: 'Modelo propio: el cuerpo de La Sobremesa (Meshy, rig del juego)' };
  if (kind === 'vertigo-ojo') return { tone: 'part', label: 'Parte de Vertitrón: el ojo de su pecho' };
  if (kind === 'lampara') return { tone: 'part', label: 'Parte del combate de Fran: una lámpara del palio' };
  if (BOSS_FIGURES[kind]) return { tone: 'own', label: `Modelo propio: figura de Meshy con esqueleto (src/monsters/${BOSS_FIGURES[kind]}.json), como los alumnos del castillo` };
  if (kind === 'vertigo') return { tone: 'own', label: 'Modelo propio: figura de Meshy (src/monsters/vertigo.json) movida por las juntas del combate (src/fears.ts `dressVertitron`), con su ojo y Uri encima' };
  if (FOE_BODIES[kind]) return { tone: 'own', label: `Modelo propio: figura de Meshy (${FOE_BODIES[kind]}), su regla en código encima` };
  if (template) return { tone: 'procedural', label: 'Modelo propio procedural (primitivas en código)' };
  if (kind === 'minion') return { tone: 'procedural', label: 'Modelo propio procedural (src/minion.ts)' };
  if (kind === 'guardian' || isCastle(kind)) return { tone: 'placeholder', label: 'Provisional: usa el esbirro del palacio a otro tamaño' };
  if (kind === 'dog') return { tone: 'procedural', label: 'Procedural (perro de cajas en src/battle-scene.ts)' };
  return { tone: 'placeholder', label: 'Provisional: sin modelo propio, cae en el perro' };
}
