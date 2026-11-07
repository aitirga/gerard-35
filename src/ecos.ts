/**
 * Ecos de luz (docs/animas/README.md § Ecos de luz): the lights the party has won, put into its
 * ánimas at the jar at home and only there (src/jar-ui.ts). Nothing is lost: every one can be taken
 * back and put somewhere else whenever they are at the jar. What is bought lives in the browser,
 * like the loadout. Pure.
 */
import { ANIMA_NAMES, type ClassId, type Element, type Improved } from './battle.ts';

export type ImprovementKind = 'mana' | 'element' | 'passive' | 'ulti';
export interface Improvement {
  id: string; anima: ClassId; kind: ImprovementKind; name: string; cost: number; description: string;
  /** What has to be there first. */
  after?: string;
  /** Maná it adds to the ánima. */
  mana?: number;
  /** The element it lets the ánima's Atacar carry. */
  element?: Element;
  /** A place kept for what is still to design: it shows, asleep, and cannot be bought. */
  veiled?: true;
}

/** Each element on Atacar's block (SVG on a 16 × 16 box); no element is the empty set. */
export const ELEMENT_ICONS: Record<Element | 'none', string> = {
  none: '<circle cx="8" cy="8" r="4.6" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M12.6 3.4 3.4 12.6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
  agua: '<path d="M8 1.4C6 4.6 3.7 7 3.7 9.9a4.3 4.3 0 0 0 8.6 0C12.3 7 10 4.6 8 1.4z"/>',
  fuego: '<path d="M8 1.2c.6 2.6 3.8 4 3.8 7.9a3.8 3.8 0 0 1-7.6 0c0-2 1-3.3 2-4.2-.1 1.6.5 2.6 1.3 2.9C7 6 7 3.4 8 1.2z"/>',
  electrico: '<path d="M9.4 1 3.6 9h3.6l-1 6 6.2-8.4H8.6z"/>',
};
/** What every ánima can get: more maná, and the places kept for its passive and its ultimate. */
const common = (anima: ClassId): Improvement[] => [
  { id: `${anima}:mana-1`, anima, kind: 'mana', name: 'Maná +1', cost: 2, mana: 1, description: `Sube en 1 el maná de ${ANIMA_NAMES[anima]}.` },
  { id: `${anima}:mana-2`, anima, kind: 'mana', name: 'Maná +2', cost: 3, mana: 1, after: `${anima}:mana-1`, description: `Sube en 1 más el maná de ${ANIMA_NAMES[anima]}.` },
  { id: `${anima}:pasiva`, anima, kind: 'passive', name: 'Pasiva', cost: 2, veiled: true, description: 'Todavía duerme.' },
  { id: `${anima}:definitiva`, anima, kind: 'ulti', name: 'Definitiva', cost: 3, veiled: true, description: 'Todavía duerme.' },
];
/** Elements for Atacar (battle.ts `react`): Gerard's mind can dress a plain blow with them. */
const ELEMENTS_OF_MATEMAGICO: Improvement[] = [
  { id: 'matemagico:agua', anima: 'matemagico', kind: 'element', element: 'agua', name: 'Agua', cost: 1, description: 'Atacar puede llevar agua. No moja. Sobre un enemigo quemado, apaga el fuego y lo ciega: sus golpes pierden fuerza.' },
  { id: 'matemagico:fuego', anima: 'matemagico', kind: 'element', element: 'fuego', name: 'Fuego', cost: 1, description: 'Atacar puede llevar fuego. No quema. Sobre un enemigo con sangrado, cauteriza: gasta el sangrado de golpe y le hace más daño.' },
  { id: 'matemagico:electrico', anima: 'matemagico', kind: 'element', element: 'electrico', name: 'Eléctrico', cost: 1, description: 'Atacar puede llevar electricidad. No paraliza. Sobre un enemigo cegado, salta por el humo: daño medio mágico a todos los cegados.' },
];
export const IMPROVEMENTS: readonly Improvement[] = (Object.keys(ANIMA_NAMES) as ClassId[]).flatMap(anima => [...anima === 'matemagico' ? ELEMENTS_OF_MATEMAGICO : [], ...common(anima)]);
export const improvementOf = (id: string) => IMPROVEMENTS.find(item => item.id === id);
/** What `list` costs, in ecos. */
export const costOf = (list: readonly string[]) => list.reduce((sum, id) => sum + (improvementOf(id)?.cost ?? 0), 0);
/**
 * What stands of `list` with `ecos` to spend, in the order it was bought: nothing unknown or asleep,
 * nothing without what it needs first, and nothing past what the ecos pay for (a rewound day can
 * take a light back; what it paid for comes back with it).
 */
export function withinEcos(list: readonly string[], ecos: number) {
  const kept: string[] = [];
  let left = ecos;
  for (const id of list) {
    const item = improvementOf(id);
    if (!item || item.veiled || kept.includes(id) || item.cost > left || (item.after && !kept.includes(item.after))) continue;
    kept.push(id); left -= item.cost;
  }
  return kept;
}
/** `list` without `id` and whatever needs it. */
export function without(list: readonly string[], id: string): string[] {
  const needing = IMPROVEMENTS.filter(item => item.after === id).map(item => item.id);
  return needing.reduce((rest, need) => without(rest, need), list.filter(other => other !== id));
}
/** What `list` adds up to in a fight. */
export function improvedBy(list: readonly string[]): Improved {
  const improved: { mana: Partial<Record<ClassId, number>>; elements: Partial<Record<ClassId, Element[]>> } = { mana: {}, elements: {} };
  for (const id of list) {
    const item = improvementOf(id);
    if (!item) continue;
    if (item.mana) improved.mana[item.anima] = (improved.mana[item.anima] ?? 0) + item.mana;
    if (item.element) (improved.elements[item.anima] ??= []).push(item.element);
  }
  return improved;
}
