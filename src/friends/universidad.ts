/**
 * The university friends' mission (docs/quests/universidad.md): where they stand on the beach of the
 * Barceloneta, the game of tag, the spiral in the water, and every line. `src/story.ts` decides when each
 * one plays; this file is data only, as the one-file-per-friend convention asks (docs/barcelona.md
 * § Architecture). Cells are in the Barceloneta's grid (src/geo/barceloneta.json): the sea is south, at
 * the bottom of the screen, and the L4 stair north.
 */
import type { Dialogue, DialogueLine, SpeakerId } from '../dialogue';
import type { EnvironmentId } from '../environments';
import type { Cell } from '../movement';
import type { GeoScene } from '../geo';
import type { CampingEncounter } from '../battle';
import CAMPING_SCENE from '../geo/camping.json' with { type: 'json' };

export const BEACH: EnvironmentId = 'barceloneta';

/** The seven, as the game's speakers and models are named (public/models/characters/<id>.glb). */
export const UNI_FRIENDS = ['anna', 'alvaro', 'miquel', 'sarah', 'soraya', 'nico', 'joan'] as const;
export type UniFriend = typeof UNI_FRIENDS[number];
/** Their figures' scale in the world (tools/figures.toml `scale`): the cast's adults are all close to it. */
export const UNI_SCALE = 1.3;

/** Where things are on the beach. Friends' cells must be walkable sand; Anna's is in the shallows. */
export const PLACES_UNI = {
  /**
   * On the sand near the water, backs to the town and facing the sea: all six together in a small
   * huddle, as a group that has come to the beach as one (the user: «deberían estar todos juntos al
   * principio»). The way to the water is round them, on either side.
   */
  friends: {
    miquel: { x: 101, z: 95 }, sarah: { x: 102, z: 96 }, alvaro: { x: 104, z: 96 },
    soraya: { x: 105, z: 95 }, nico: { x: 102, z: 94 }, joan: { x: 104, z: 94 },
  } as Record<Exclude<UniFriend, 'anna'>, Cell>,
  /** Anna, out in the cold water a few metres past the shoreline, up to her waist (`wade`). */
  anna: { x: 101, z: 106 },
  /** How deep Anna stands in the sea (m below the sand's level, before her scale). */
  wade: .42,
  /** The spiral, beside Anna in the water from the moment they arrive: she goes into it, and they after her. */
  portal: { x: 98, z: 106 },
  /** Walking up behind them, the conversation starts. */
  talk: { x: 103, z: 89, radius: 6 },
  /** Caught: back to here, up the sand, before the conversation (decided: the game goes back to just before it). */
  retry: { x: 104, z: 75 },
  /** How close to Anna they must get for the spiral to take her, and then how close to go through it. */
  spiral: { radius: 4, through: 1.2 },
  /** The camera during the talk: over the huddle, Anna and the spiral, a little towards the sea so the dialogue box leaves them in view; metres of view. */
  intro: { x: 101, z: 101.5, height: 17 },
  /** Back from the campsite: where Gerard comes out of the spiral, the seven round him. */
  home: { x: 103, z: 96 },
  /**
   * Free, after the campsite: all seven round Gerard and Aitor on the sand, Anna out of the water, in
   * a half ring on the side away from the camera (it looks from +x +z), so every face shows.
   */
  freed: {
    sarah: { x: 105, z: 94 }, miquel: { x: 104, z: 93 }, alvaro: { x: 102, z: 93 }, anna: { x: 101, z: 94 },
    nico: { x: 100, z: 95 }, joan: { x: 100, z: 97 }, soraya: { x: 101, z: 98 },
  } as Record<UniFriend, Cell>,
  /** The spiral they come out of, back from the campsite: close behind the ring, away from the camera. */
  out: { x: 99, z: 92 },
  /** The row of the beach the tentacles close behind the party: the promenade is shut, only the sea is open. */
  tentacles: { z: 80, depth: 2 },
} as const;

/**
 * The shallows the party may wade into: the sea's cells within `radius` of Anna. The beach's grid
 * walls the sea off (geo-build); this opens a little of it (src/environments.ts `withShallows`).
 */
export const SHALLOWS = { centre: { x: 99.5, z: 106 }, radius: 6 };

/** Càmping Eurosport, through the spiral (assets/geo/camping, src/environments.ts `CAMPING`). */
export const CAMP: EnvironmentId = 'camping';
/** A named spot of the campsite (`anchors` of its zone) as the cell it falls on: rebuilding the zone keeps the mission in place. */
function camp(anchor: string): Cell {
  const at = (CAMPING_SCENE as GeoScene).anchors?.[anchor];
  if (!at) throw new Error(`Càmping Eurosport has no anchor «${anchor}»`);
  return { x: Math.round(at.x), z: Math.round(at.z) };
}
/** Where things are in the campsite. */
export const PLACES_CAMP = {
  /** Out of the spiral, on the road in by the barrier. */
  entrada: camp('entrada'),
  /** The reception's blackboard: only the campsite's notices. */
  pizarra: camp('recepcio-pizarra'),
  /** The blackboard on its easel by the pool: Las parcelas' board, behind El Campeón. */
  tablero: camp('pissarra-piscina'),
  /** Where Gerard stands to read each pitch's sign, in the board's order (row by row, left to right). */
  pitches: Array.from({ length: 25 }, (_, i) => camp(`parcela-${i}`)),
  /** The gate in the tall wall round the pool: padlocked until the maze's three words are put on it (src/environments.ts `CAMPING_GATE` are its cells). */
  gate: { x: Math.round((CAMPING_SCENE as GeoScene).anchors!['barrera-piscina'].x) + 1, z: camp('barrera-piscina').z, radius: 2.5 },
  /** The steel door in the wall between the pool and the merendero: shut until Las parcelas is solved (src/environments.ts `CAMPING_DOOR`). */
  door: { ...camp('porta-merendero'), z: camp('porta-merendero').z + 1, radius: 2 },
  /** El Campeón on the pool's edge, and the long table with the melon where La Sobremesa sits. */
  campeon: { ...camp('campeon'), radius: 4.5 },
  mesa: { ...camp('foto'), radius: 3 },
  foto: camp('foto'),
  /** The spiral that opens behind the long table once they are free, and takes everyone home. */
  vuelta: { x: camp('merendero-mesa').x, z: camp('merendero-mesa').z - 2 },
};
/**
 * The campsite's foes on their rounds (decided: magos and agentes patrol the paths): Las parcelas is a
 * maze of hedges, and each group walks a lane, a square or the roundabout; if it sees Gerard down a
 * lane it runs at him (src/chasers.ts), and the hedges hide him; reaching him is the fight. Beaten,
 * it stays beaten this visit. The dados never walk: they come out of a wrong pitch's tent
 * (`camping-tienda`) and the black one (`camping-negra`).
 *
 * Each of a group's foes shouts its `word` as it falls in the fight, before it comes apart (decided round 3): «Empiezo» near the way in, «Continúo» in
 * the middle, «Acabo» by the pool gate. Their letters are the padlock's numbers (`CAMP_LOCK`): 7, 8, 5.
 */
export const CAMP_HUNTERS: readonly { id: string; encounter: CampingEncounter; patrol: readonly Cell[]; sight: number; walk: number; run: number; word: string }[] = [
  // Up and down along the maze's hedge, across its one way in: seen from the road before they see the party, and slipped past on their way back.
  { id: 'magos-entrada', encounter: 'camping-magos', patrol: [{ x: 54, z: 21 }, { x: 54, z: 31 }], sight: 6, walk: 1.5, run: 4.4, word: 'Empiezo' },
  // Round the square by the way in, the first turn north.
  { id: 'magos-plaza', encounter: 'camping-magos', patrol: [{ x: 44, z: 18 }, { x: 50, z: 18 }, { x: 50, z: 22 }, { x: 44, z: 22 }], sight: 6, walk: 1.5, run: 4.4, word: 'Empiezo' },
  // Round and round the roundabout, the middle of the maze.
  { id: 'agentes-rotonda', encounter: 'camping-agentes', patrol: [{ x: 36, z: 21 }, { x: 39, z: 22 }, { x: 40, z: 24 }, { x: 39, z: 26 }, { x: 36, z: 26 }, { x: 34, z: 25 }, { x: 33, z: 23 }, { x: 34, z: 21 }], sight: 6, walk: 1.7, run: 4.6, word: 'Continúo' },
  // Up and down the long lanes: the one along the woods at the back, the one past the roundabout's south mouth, the last one.
  { id: 'agentes-norte', encounter: 'camping-agentes', patrol: [{ x: 20, z: 4 }, { x: 51, z: 4 }], sight: 8, walk: 1.8, run: 4.6, word: 'Continúo' },
  { id: 'magos-sur', encounter: 'camping-magos', patrol: [{ x: 28, z: 33 }, { x: 46, z: 33 }], sight: 7, walk: 1.6, run: 4.4, word: 'Continúo' },
  { id: 'agentes-fondo', encounter: 'camping-agentes', patrol: [{ x: 20, z: 45 }, { x: 51, z: 45 }], sight: 8, walk: 1.8, run: 4.6, word: 'Acabo' },
  // The yard along the tall wall, where both ways through the maze end: the gate's guard.
  { id: 'magos-patio', encounter: 'camping-magos', patrol: [{ x: 19, z: 18 }, { x: 19, z: 28 }], sight: 6, walk: 1.4, run: 4.4, word: 'Acabo' },
];
/**
 * The pool gate's padlock (docs/quests/universidad.md § El candado): three wheels of numbers, 0 to 9,
 * and nothing else on it. The numbers are the letters of the three words the maze's foes say as they
 * fall: «Empiezo», «Continúo», «Acabo».
 */
export const CAMP_LOCK = { wheels: 3, code: [7, 8, 5] } as const;
/** Whether the numbers tried on the padlock open it. */
export const lockOpens = (numbers: readonly number[]) => numbers.length === CAMP_LOCK.wheels && CAMP_LOCK.code.every((n, i) => numbers[i] === n);
/**
 * Where the freed friends stand round the melon table for the photo, left where La Sobremesa came
 * apart: three along its far side (where the body sat), two at each end, the near side open to
 * Gerard and Aitor and the camera. Its middle is `merendero-mesa`'s cell; the table runs a cell either way along x.
 */
export const CAMP_FREED: Record<UniFriend, Cell> = (() => {
  const t = camp('merendero-mesa');
  return {
    anna: { x: t.x - 1, z: t.z }, alvaro: { x: t.x, z: t.z }, miquel: { x: t.x + 1, z: t.z },
    soraya: { x: t.x - 2, z: t.z + 1 }, joan: { x: t.x - 2, z: t.z + 2 },
    sarah: { x: t.x + 2, z: t.z + 1 }, nico: { x: t.x + 2, z: t.z + 2 },
  };
})();

/** The game of tag: each friend runs at the party and never gives up; a short stare first. */
export const TAG = { run: 6.1, stare: 1.1, reach: .9 };

const gerard = (text: string): DialogueLine => ({ speaker: 'gerard35', text });
const aitor = (text: string): DialogueLine => ({ speaker: 'aitor', text });
const line = (speaker: SpeakerId, text: string): DialogueLine => ({ speaker, text });
const group = (right: SpeakerId, ...lines: DialogueLine[]): Dialogue => ({ left: 'gerard35', right, lines });

export const LINES_UNI = {
  /** The morning's message: the way in (a person says it, as the game asks). */
  clue: [
    aitor('Por cierto, el grupo de la uni lleva toda la mañana escribiendo.'),
    aitor('Que te esperan en la playa de la Barceloneta. Para felicitarte. Todos.'),
    gerard('¿Todos? Si no hay manera de juntarlos ni para una cena.'),
  ],
  /** Walking up behind them on the sand: they never turn round until the end (docs/quests/universidad.md § Beats). */
  beach: group('miquel',
    line('miquel', 'Anna se ha ido directa al agua. Ya sabes cómo es.'),
    line('sarah', 'Le encanta el agua fría. Y el peligro.'),
    line('miquel', 'Felicidades, Gerard. Treinta y cinco.'),
    line('sarah', 'Hemos dejado a los niños en casa. A todos. Hemos venido corriendo a felicitarte.'),
    aitor('¿Con quién los habéis dejado?'),
    line('nico', '…'),
    line('soraya', 'He dejado a Guillem. Ahora tengo muchísimo tiempo. Para vosotros. Muchísimo.'),
    line('joan', 'Muchísimo.'),
    line('alvaro', 'Con lo que me gustan a mí los juegos. Vamos a jugar al pilla-pilla.'),
    line('alvaro', 'Nos la quedamos nosotros.'),
  ),
  /** Caught, and back up the sand: the second time only Álvaro's last lines (decided). */
  again: group('alvaro',
    line('alvaro', 'Vamos a jugar al pilla-pilla.'),
    line('alvaro', 'Nos la quedamos nosotros.'),
  ),
  /** Caught: what they say as it all goes back. */
  caught: group('alvaro', line('alvaro', 'Te pillé. Otra vez.')),
  /** Aitor, over his head, as the tentacles shut the promenade behind them. */
  run: '¡Al agua! ¡Con Anna!',
  /** Near her: she turns and smiles, and steps into the spiral beside her (`gone` after she has come apart into it). */
  spiral: group('anna', line('anna', 'Está buenísima. Venid.')),
  gone: group('anna',
    aitor('Gerard… se ha deshecho. Se la ha tragado.'),
    gerard('Es la espiral. Como la de Uri. Vamos detrás.'),
  ),
  /** Out of the spiral: the campsite, in a summer evening that never ends. */
  camp: { left: 'gerard35', right: 'aitor', lines: [
    aitor('Esto es el Eurosport. El camping.'),
    gerard('Es verano. Hace un momento era noviembre.'),
    aitor('Están todas las tiendas montadas y no hay nadie. Ni un ruido.'),
    gerard('Anna tiene que estar por aquí. Y los demás detrás.'),
  ] } as Dialogue,
  /** By the pool, the blackboard on its easel, the first time: the notice that is the puzzle. */
  board: { left: 'gerard35', right: 'aitor', lines: [
    aitor('«Torneo. Asignación de parcelas». Una palabra y un número, en tiza.'),
    gerard('Como cuando jugábamos en la mesa del merendero. Hay que adivinar qué parcelas van con la pista.'),
    aitor('Y encima de la puerta de acero hay una bombilla por parcela.'),
  ] } as Dialogue,
  /** The pool's blackboard once every pitch is found. */
  boardDone: { left: 'gerard35', right: 'aitor', lines: [gerard('Todas las parcelas asignadas. La puerta del merendero está abierta.')] } as Dialogue,
  /** The reception's blackboard: the campsite's notices, nothing more. */
  boardIdle: { left: 'gerard35', lines: [gerard('La pizarra de avisos, en tiza: «Piscina de 10 a 20 h. Silenci a partir de les 24 h.»')] } as Dialogue,
  /** The pool gate, padlocked: three wheels of words. */
  gate: { left: 'gerard35', right: 'aitor', lines: [
    aitor('Esta tapia no estaba. La piscina está detrás, y no se ve nada por encima.'),
    gerard('Un candado. Tres ruedas de números.'),
  ] } as Dialogue,
  /** The padlock gives: the gate swings open onto the pool. */
  unlocked: { left: 'gerard35', right: 'aitor', lines: [
    aitor('Ha cedido.'),
    gerard('La piscina. Y al fondo, otro muro.'),
  ] } as Dialogue,
  /** The steel door to the merendero, before Las parcelas is solved: bolted, and something behind it. */
  door: { left: 'gerard35', right: 'aitor', lines: [
    aitor('Una puerta de acero. En un camping.'),
    gerard('Detrás está el merendero. Se oye algo. Como dados sobre una mesa.'),
    aitor('Tiene una fila de bombillas apagadas encima. Como las parcelas de la pizarra.'),
  ] } as Dialogue,
  /** Every pitch found: the bar lifts and the steel door swings open onto the merendero. */
  doorOpen: { left: 'gerard35', right: 'aitor', lines: [
    aitor('Las bombillas. Todas encendidas. Y el cerrojo se ha levantado solo.'),
    gerard('El merendero. Vamos.'),
  ] } as Dialogue,
  /** At the pool, the miniature on its plinth turns its head. */
  campeon: { left: 'gerard35', right: 'aitor', lines: [
    aitor('Esa figura es de las del juego de los superhéroes. A tamaño de persona.'),
    gerard('Se está bajando de la peana.'),
  ] } as Dialogue,
  /** The long table under the pines, and what is sitting at it. */
  sobremesa: group('alvaro',
    aitor('Gerard. La mesa.'),
    line('alvaro', 'Siéntate. Ya está repartido.'),
    line('sarah', 'Nadie se levanta hasta que acabe la partida.'),
    line('joan', 'Do…'),
  ),
  /** Free: the seven on the grass by the table, themselves again. */
  won: group('anna',
    line('anna', 'Gerard… ¿Qué hacemos aquí? ¿Esto es el Eurosport?'),
    line('miquel', 'Los niños. ¿Con quién hemos dejado a los niños?'),
    line('soraya', 'Tengo que llamar a Guillem. Le he dicho cosas horribles.'),
    line('alvaro', 'Ya que estamos aquí… la foto. Hay un melón en la mesa.'),
    line('nico', 'Pues claro que hay un melón.'),
  ),
  /** After the photo, back on the beach in November. */
  home: group('sarah',
    line('sarah', 'Felicidades, Gerard. Ahora sí.'),
    line('joan', 'A ver si quedamos. De verdad, esta vez.'),
    aitor('Esta vez sí.'),
  ),
  /** Gerard's caption on the photo. */
  photo: 'Càmping Eurosport · Los nueve y el melón',
};
