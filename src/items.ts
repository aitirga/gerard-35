/**
 * Everything Gerard can carry. Almost all of it is a key object: a thing of the story that is never
 * lost. `kind` only tells the few that are spent apart; `equip` puts it on a party member; `use`
 * is the verb of what it does from the Objetos panel (the story decides what happens, `use` event).
 * `icon` is the inside of a 24 × 24 stroked SVG and `tint` its accent, for the panel and the note.
 */
export type ItemKind = 'common' | 'key';
export interface Item { id: ItemId; name: string; kind: ItemKind; description: string; icon: string; tint: string; equip?: 'feet' | 'back'; use?: string }

const CATALOGUE = {
  zapatillas: { id: 'zapatillas', name: 'Zapatillas de correr', kind: 'key', equip: 'feet', tint: '#e9ad48', description: 'El regalo de mamá. Con ellas puedes correr.', icon: '<path d="M3 17v-4l4-1 3-4 2 3 7 2a3 3 0 0 1 2 3v1H3Z"/><path d="M3 15h18"/>' },
  mochila: { id: 'mochila', name: 'Mochila del cole', kind: 'key', equip: 'back', tint: '#7fb39f', description: 'Libros, estuche y un bocadillo de fuet.', icon: '<path d="M9 7V5a3 3 0 0 1 6 0v2M7 7h10a2 2 0 0 1 2 2v11H5V9a2 2 0 0 1 2-2Z"/><path d="M9 13h6v4H9z"/>' },
  pocion: { id: 'pocion', name: 'Poción', kind: 'common', tint: '#a77ad6', description: 'Un brebaje de color sospechoso. Recupera algo de vida.', icon: '<path d="M10 3h4M10 3v5l-4 8a3 3 0 0 0 3 4h6a3 3 0 0 0 3-4l-4-8V3"/><path d="M8 14h8"/>' },
  chicle: { id: 'chicle', name: 'Chicle de fresa', kind: 'common', tint: '#ff6fae', description: 'Del palacio de la Reina Bubbaloo. Sabe a fresa… casi.', icon: '<rect x="5" y="8" width="14" height="8" rx="2"/><path d="M9 8v8M15 8v8"/>' },
  envoltorio: { id: 'envoltorio', name: 'Envoltorio de Bubbaloo', kind: 'key', tint: '#ff6fae', description: 'Estaba en tu mesilla al despertar. Huele a fresa, como en el sueño.', icon: '<path d="M8 9h8v6H8z"/><path d="m8 9-4-2v10l4-2M16 9l4-2v10l-4-2"/>' },
  bola: { id: 'bola', name: 'Bola de nieve', kind: 'key', use: 'Agitar', tint: '#9fd0e6', description: 'Dentro nieva sobre vuestro portal. Agitarla os lleva a casa, y lo que llevéis hecho por alguien se queda como está.', icon: '<circle cx="12" cy="10" r="7"/><path d="M7 15.5h10l1.5 4.5h-13L7 15.5Z"/><path d="M10 14v-4l2-1.5 2 1.5v4M8.5 8h.01M15.5 7h.01M12 5h.01"/>' },
} as const satisfies Record<string, Omit<Item, 'id'> & { id: string }>;
export type ItemId = keyof typeof CATALOGUE;
export const ITEMS: Record<ItemId, Item> = CATALOGUE;

export const ITEM_KIND_LABELS: Record<ItemKind, string> = { common: 'Se gasta', key: 'Objeto clave' };

/** Items in catalogue order, so the panel never reshuffles as things are picked up. */
export function sortItems(ids: Iterable<ItemId>): Item[] {
  const owned = new Set(ids);
  return (Object.keys(ITEMS) as ItemId[]).filter(id => owned.has(id)).map(id => ITEMS[id]);
}
