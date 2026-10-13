/** Everything Gerard can carry. `kind` sorts the Objetos panel; `equip` puts it on a party member. */
export type ItemKind = 'common' | 'key';
export interface Item { id: ItemId; name: string; kind: ItemKind; description: string; equip?: 'feet' | 'back' }

const CATALOGUE = {
  zapatillas: { id: 'zapatillas', name: 'Zapatillas de correr', kind: 'key', equip: 'feet', description: 'El regalo de mamá. Con ellas puedes correr.' },
  mochila: { id: 'mochila', name: 'Mochila del cole', kind: 'key', equip: 'back', description: 'Libros, estuche y un bocadillo de fuet.' },
  pocion: { id: 'pocion', name: 'Poción', kind: 'common', description: 'Un brebaje de color sospechoso. Recupera algo de vida.' },
  chicle: { id: 'chicle', name: 'Chicle de fresa', kind: 'common', description: 'Del palacio de la Reina Bubbaloo. Sabe a fresa… casi.' },
  envoltorio: { id: 'envoltorio', name: 'Envoltorio de Bubbaloo', kind: 'key', description: 'Estaba en tu mesilla al despertar. Huele a fresa, como en el sueño.' },
} as const satisfies Record<string, Omit<Item, 'id'> & { id: string }>;
export type ItemId = keyof typeof CATALOGUE;
export const ITEMS: Record<ItemId, Item> = CATALOGUE;

export const ITEM_KIND_LABELS: Record<ItemKind, string> = { common: 'Comunes', key: 'Objetos clave' };

/** Items in catalogue order, so the panel never reshuffles as things are picked up. */
export function sortItems(ids: Iterable<ItemId>): Item[] {
  const owned = new Set(ids);
  return (Object.keys(ITEMS) as ItemId[]).filter(id => owned.has(id)).map(id => ITEMS[id]);
}
export function itemsOfKind(ids: Iterable<ItemId>, kind: ItemKind): Item[] {
  return sortItems(ids).filter(item => item.kind === kind);
}
