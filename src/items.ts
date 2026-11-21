import { ANIMA_GROWTH } from './animas.ts';
import { CASTLE_UNLOCKS } from './castle.ts';

/**
 * Everything Gerard can carry. Almost all of it is a key object: a thing of the story that is never
 * lost. `kind` only tells the few that are spent apart; `equip` puts it on a party member; `use`
 * is the verb of what it does from the Objetos panel (the story decides what happens, `use` event).
 * `icon` is the inside of a 24 × 24 stroked SVG and `tint` its accent, for the panel and the note.
 */
export type ItemKind = 'common' | 'key' | 'trophy';
/**
 * `effect`: a trophy's (`kind: 'trophy'`). A trophy adds nothing of its own: it writes down what
 * winning it already gave (the ánima's growth, the castle's stage), as a skill's description would.
 */
export interface Item { id: ItemId; name: string; kind: ItemKind; description: string; icon: string; tint: string; equip?: 'feet' | 'back'; use?: string; effect?: string }

/** A small cup on its foot, the shape every trophy shares; `inside` is what is engraved on it. */
const cup = (inside: string) => `<path d="M8 4h8v4a4 4 0 0 1-8 0Z"/><path d="M8 5.5H5.5A2.5 2.5 0 0 0 8.4 9.6M16 5.5h2.5a2.5 2.5 0 0 1-2.9 4.1"/><path d="M12 12v3M9 20h6l-1-5h-4Z"/>${inside}`;
/** A boss's: the same cup, taller, with a laurel round it. */
const bigCup = (inside: string) => `<path d="M7.5 3h9v5.5a4.5 4.5 0 0 1-9 0Z"/><path d="M5 6c-1.5 2 0 5 3 6M19 6c1.5 2 0 5-3 6"/><path d="M12 13v3M8.5 21h7l-1-5h-5Z"/>${inside}`;

/**
 * What each trophy writes down. A mission's: the friend's ánima, gathered, makes everyone larger
 * (src/animas.ts `ANIMA_GROWTH`). A boss's: what its stage of the castle opens (src/castle.ts `CASTLE_UNLOCKS`).
 */
const MISSION = `Sube PV, Fuerza, Magia, Defensa y Espíritu de todo el equipo un ${Math.round(ANIMA_GROWTH.pct * 100)} %.`;
const AURELIA = `Cada uno puede llevar ${CASTLE_UNLOCKS[2].slots} ánimas además de la suya. Las ánimas compartidas suben hasta el nivel ${CASTLE_UNLOCKS[2].cap}.`;
const DIRECCION = `Las ánimas compartidas suben hasta el nivel ${CASTLE_UNLOCKS[3].cap}. El bote despierta las definitivas.`;

const CATALOGUE = {
  zapatillas: { id: 'zapatillas', name: 'Zapatillas de correr', kind: 'key', equip: 'feet', tint: '#e9ad48', description: 'El regalo de mamá. Con ellas puedes correr.', icon: '<path d="M3 17v-4l4-1 3-4 2 3 7 2a3 3 0 0 1 2 3v1H3Z"/><path d="M3 15h18"/>' },
  mochila: { id: 'mochila', name: 'Mochila del cole', kind: 'key', equip: 'back', tint: '#7fb39f', description: 'Libros, estuche y un bocadillo de fuet.', icon: '<path d="M9 7V5a3 3 0 0 1 6 0v2M7 7h10a2 2 0 0 1 2 2v11H5V9a2 2 0 0 1 2-2Z"/><path d="M9 13h6v4H9z"/>' },
  pocion: { id: 'pocion', name: 'Poción', kind: 'common', tint: '#a77ad6', description: 'Un brebaje de color sospechoso. Recupera algo de vida.', icon: '<path d="M10 3h4M10 3v5l-4 8a3 3 0 0 0 3 4h6a3 3 0 0 0 3-4l-4-8V3"/><path d="M8 14h8"/>' },
  chicle: { id: 'chicle', name: 'Chicle de fresa', kind: 'common', tint: '#ff6fae', description: 'Del palacio de la Reina Bubbaloo. Sabe a fresa… casi.', icon: '<rect x="5" y="8" width="14" height="8" rx="2"/><path d="M9 8v8M15 8v8"/>' },
  envoltorio: { id: 'envoltorio', name: 'Envoltorio de Bubbaloo', kind: 'key', tint: '#ff6fae', description: 'Estaba en tu mesilla al despertar. Huele a fresa, como en el sueño.', icon: '<path d="M8 9h8v6H8z"/><path d="m8 9-4-2v10l4-2M16 9l4-2v10l-4-2"/>' },
  bola: { id: 'bola', name: 'Bola de nieve', kind: 'key', use: 'Agitar', tint: '#9fd0e6', description: 'Dentro nieva sobre vuestro portal. Agitarla os lleva a casa, y lo que llevéis hecho por alguien se queda como está.', icon: '<circle cx="12" cy="10" r="7"/><path d="M7 15.5h10l1.5 4.5h-13L7 15.5Z"/><path d="M10 14v-4l2-1.5 2 1.5v4M8.5 8h.01M15.5 7h.01M12 5h.01"/>' },
  // One for each ánima mission, the day its friend comes back, and one for each boss of her castle.
  'trofeo-nuria': { id: 'trofeo-nuria', name: 'Trofeo de la torre', kind: 'trophy', tint: '#f0954a', effect: MISSION, description: 'Latón, con dos gatos grabados. Uri volvió en sí en lo alto de la torre de Cardedeu.', icon: cup('<path d="m10.5 7.5.5-1.5.8 1M12.2 7l.8-1 .5 1.5"/>') },
  'trofeo-universidad': { id: 'trofeo-universidad', name: 'Trofeo de la sobremesa', kind: 'trophy', tint: '#efe6cf', effect: MISSION, description: 'Siete nombres rayados con una llave en el pie. Los de la uni salieron del camping.', icon: cup('<path d="M10 7h4"/>') },
  'trofeo-marta': { id: 'trofeo-marta', name: 'Trofeo de la voz', kind: 'trophy', tint: '#8fe3c4', effect: MISSION, description: 'Tiene una nota grabada que no suena. Marta volvió a cantar en Alegia.', icon: cup('<path d="M12.5 5.5v2.5"/><circle cx="11.6" cy="8" r=".9"/>') },
  'trofeo-emilie': { id: 'trofeo-emilie', name: 'Trofeo del modelo', kind: 'trophy', tint: '#27c2a0', effect: MISSION, description: 'Por dentro tiene una línea de agua que no se seca. Emilie volvió a entender su modelo.', icon: cup('<path d="M10 7.5q1-1 2 0t2 0"/>') },
  'trofeo-luca': { id: 'trofeo-luca', name: 'Trofeo de la peluquería', kind: 'trophy', tint: '#617ce2', effect: MISSION, description: 'Refleja colores que no hay en la sala. Luca volvió a verlos todos.', icon: cup('<path d="m10.5 6 3 2M13.5 6l-3 2"/>') },
  'trofeo-aurelia': { id: 'trofeo-aurelia', name: 'Trofeo de Aurelià', kind: 'trophy', tint: '#c9a86a', effect: AURELIA, description: 'Un silbato grabado en el asa. El gimnasio ya no se cierra por dentro.', icon: bigCup('<path d="m10.5 6.5 1.5 1.5 1.5-1.5"/>') },
  'trofeo-direccion': { id: 'trofeo-direccion', name: 'Trofeo de Dirección', kind: 'trophy', tint: '#b9c3cc', effect: DIRECCION, description: 'Tres sellos de secretaría en la base: Mar, Montse, Pilar. Ya no firman nada.', icon: bigCup('<path d="M10 9.5h.01M12 9.5h.01M14 9.5h.01"/>') },
} as const satisfies Record<string, Omit<Item, 'id'> & { id: string }>;
export type ItemId = keyof typeof CATALOGUE;
export const ITEMS: Record<ItemId, Item> = CATALOGUE;

export const ITEM_KIND_LABELS: Record<ItemKind, string> = { common: 'Se gasta', key: 'Objeto clave', trophy: 'Trofeo' };

/** Each trophy and the story flag that gives it: the end of an ánima mission, a boss of her castle. */
export const TROPHIES = [
  { item: 'trofeo-nuria', flag: 'nuria-uri' },
  { item: 'trofeo-universidad', flag: 'sobremesa' },
  { item: 'trofeo-marta', flag: 'voz' },
  { item: 'trofeo-emilie', flag: 'converge' },
  { item: 'trofeo-luca', flag: 'fran' },
  { item: 'trofeo-aurelia', flag: 'aurelia' },
  { item: 'trofeo-direccion', flag: 'direccion' },
] as const satisfies readonly { item: ItemId; flag: string }[];
/** The trophies the flags have won, in catalogue order. */
export const trophiesFor = (has: (flag: string) => boolean): ItemId[] => TROPHIES.filter(t => has(t.flag)).map(t => t.item);

/** Items in catalogue order, so the panel never reshuffles as things are picked up. */
export function sortItems(ids: Iterable<ItemId>): Item[] {
  const owned = new Set(ids);
  return (Object.keys(ITEMS) as ItemId[]).filter(id => owned.has(id)).map(id => ITEMS[id]);
}
