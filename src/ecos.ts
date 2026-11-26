/**
 * Ecos de luz (docs/animas/README.md § Ecos de luz): the lights the party has won, put into its
 * ánimas at the jar at home and only there (src/jar-ui.ts). Nothing is lost: every one can be taken
 * back and put somewhere else whenever they are at the jar. What is bought lives in the browser,
 * like the loadout. Pure.
 */
import { ANIMA_NAMES, ANIMA_OWNERS, DUALS, PASSIVES, SKILLS, type ClassId, type DualId, type Element, type Improved, type PassiveId, type SkillId } from './battle.ts';
import { definitivasOpen, type GrowthStage } from './castle.ts';

/**
 * What a friend's light is worth in ecos (Aitor, 2026-11-22: ten more ecos, from the friends): each of
 * the friends freed lets go of two, the castle's lights and the levels' one each. Two lights fly per friend.
 */
export const FRIEND_ECOS = 2;
export type ImprovementKind ='mana' | 'element' | 'skill' | 'passive' | 'ulti' | 'dual';
/** The lines of a tree (docs/animas/README.md § The jar): Matemágico's three elements and its trunk, Tecnópata's three. */
export type LineId = 'fuego' | 'agua' | 'electrico' | 'calculo' | 'bip' | 'mente' | 'taller';
export const LINES: Record<LineId, { name: string; note: string; colour: string }> = {
  fuego: { name: 'Fuego', note: 'se acumula', colour: '#ff8f3f' },
  agua: { name: 'Agua', note: 'prepara', colour: '#6cc8f2' },
  electrico: { name: 'Eléctrico', note: 'cobra', colour: '#ffe45c' },
  calculo: { name: 'Cálculo', note: '', colour: '#f3cf78' },
  bip: { name: 'Bip', note: '', colour: '#4fe0ff' },
  mente: { name: 'Mente', note: '', colour: '#9be7ff' },
  taller: { name: 'Taller', note: '', colour: '#7df0b5' },
};
export interface Improvement {
  id: string; anima: ClassId; kind: ImprovementKind; name: string; cost: number; description: string;
  /** What has to be there first. */
  after?: string;
  /** Maná it adds to the ánima. */
  mana?: number;
  /** The element it lets the ánima's Atacar carry. */
  element?: Element;
  /** A node of a tree: its line, and the skill or the passive it gives. */
  line?: LineId; skill?: SkillId; passive?: PassiveId;
  /** A dúo mayor it opens (docs/animas/README.md § Dúos mayores), and the ánima that brings its other half. */
  dual?: DualId; partner?: ClassId;
  /** A place kept for what is still to design: it shows, asleep, and cannot be bought. */
  veiled?: true;
  /**
   * The castle's stage it opens at, if not the first (docs/animas/README.md § Growth opens with the
   * castle): grade III after Aurelià, the definitivas after Dirección. What hangs from it opens with it (`stageOf`).
   */
  stage?: GrowthStage;
}

/** Each element on Atacar's block (SVG on a 16 × 16 box); no element is the empty set. */
export const ELEMENT_ICONS: Record<Element | 'none', string> = {
  none: '<circle cx="8" cy="8" r="4.6" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M12.6 3.4 3.4 12.6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
  agua: '<path d="M8 1.4C6 4.6 3.7 7 3.7 9.9a4.3 4.3 0 0 0 8.6 0C12.3 7 10 4.6 8 1.4z"/>',
  fuego: '<path d="M8 1.2c.6 2.6 3.8 4 3.8 7.9a3.8 3.8 0 0 1-7.6 0c0-2 1-3.3 2-4.2-.1 1.6.5 2.6 1.3 2.9C7 6 7 3.4 8 1.2z"/>',
  electrico: '<path d="M9.4 1 3.6 9h3.6l-1 6 6.2-8.4H8.6z"/>',
};
/** The ánimas that grow by a tree at the jar and never by level: the ones that are someone's own. */
export const TREE_ANIMAS = Object.keys(ANIMA_OWNERS) as ClassId[];
/**
 * What the biggest nodes cost (Aitor, 2026-11-24: the jar some 25 % dearer, the big moves dearest): a
 * dúo mayor 3 ecos, grade III 3 for its big ones (Combustión, Integral impropia, Escudo de bits) and 2
 * for the rest (Reinicio, Virus atómico); everything else one, the definitivas two.
 */
const DUAL_COST = 3;
/**
 * A dúo mayor's node (docs/animas/README.md § Dúos mayores, § The jar as one sky): bought with the
 * own ánima that brings a half, it is what lets the dual exist. In the jar it is a gold star between
 * that ánima's constellation and `partner`'s, and only there once both ends are lit (`after`, and
 * the partner's half learned), so its card can name both halves.
 */
const dualNode = (anima: ClassId, line: LineId, dual: DualId, partner: ClassId, after: string): Improvement => {
  const spec = DUALS.find(d => d.id === dual)!, halves = spec.parts.map(part => SKILLS.find(s => s.id === part)!);
  const one = halves.find(s => s.class === anima)!, two = halves.find(s => s.class !== anima)!;
  // Never before Aurelià, whatever it hangs from (Aitor 2026-11-21: the dúos mayores come after him, a «?» until both ends are lit).
  return { id: `${anima}:${dual}`, anima, kind: 'dual', line, dual, partner, name: spec.name, cost: DUAL_COST, description: `Dúo mayor de ${one.name} y ${two.name}. ${spec.description}`, after: `${anima}:${after}`, stage: 2 };
};
const skillNode = (anima: ClassId, line: LineId, skill: SkillId, cost: number, after?: string): Improvement => {
  const spec = SKILLS.find(s => s.id === skill)!;
  return { id: `${anima}:${skill}`, anima, kind: 'skill', line, skill, name: spec.name, cost, description: spec.description, ...after ? { after: `${anima}:${after}` } : {} };
};
const passiveNode = (anima: ClassId, line: LineId, passive: PassiveId, cost: number, after: string, description: string): Improvement =>
  ({ id: `${anima}:${passive}`, anima, kind: 'passive', line, passive, name: PASSIVES[passive].name, cost, description, after: `${anima}:${after}` });
const manaNode = (anima: ClassId, line?: LineId, after?: string): Improvement =>
  ({ id: `${anima}:mana-1`, anima, kind: 'mana', name: 'Maná +1', cost: 1, mana: 1, description: `Sube en 1 el maná de ${ANIMA_NAMES[anima]}.`, ...line ? { line } : {}, ...after ? { after: `${anima}:${after}` } : {} });
/** Grade III of a tree: in the sky once Aurelià has fallen, with whatever hangs from it (docs/castle.md § What each boss opens). */
const gradeIII = (item: Improvement): Improvement => ({ ...item, stage: 2 });
/** The first stage that wakes the definitivas (src/castle.ts `CASTLE_UNLOCKS`): Dirección's. */
const DEFINITIVAS = ([1, 2, 3] as const).find(definitivasOpen) ?? 3;
/**
 * The definitiva: a place kept on every ánima (docs/animas/README.md § Definitivas), 2 ecos each
 * (Aitor, 2026-11-20). Asleep until its move is built (Colorista's Fin de fiesta is the first) and
 * the castle's stage wakes the definitivas; until then it shows as a place kept (`asleep`).
 */
const DEFINITIVA_COST = 2;
const ulti = (anima: ClassId): Improvement => {
  // One whose move is built (`ulti` in SKILLS) wakes with the stage: it is that skill, bought here and woken in each fight by its condition.
  const built = SKILLS.find(skill => skill.class === anima && 'ulti' in skill);
  return built ? { id: `${anima}:definitiva`, anima, kind: 'ulti', skill: built.id, name: built.name, cost: DEFINITIVA_COST, stage: DEFINITIVAS, description: `Definitiva. ${built.description} Despierta en cada combate, una vez, sin gastar maná.` }
    : { id: `${anima}:definitiva`, anima, kind: 'ulti', name: 'Definitiva', cost: DEFINITIVA_COST, stage: DEFINITIVAS, veiled: true, description: 'Todavía duerme.' };
};
/**
 * Matemágico's tree: a line per element (the element on Atacar, the skill that lays or cashes it,
 * its passive) and the trunk, Cálculo. Each node needs the one before it on its line.
 */
const MATEMAGICO: Improvement[] = [
  { id: 'matemagico:fuego', anima: 'matemagico', kind: 'element', line: 'fuego', element: 'fuego', name: 'Fuego', cost: 1, description: 'Atacar puede llevar fuego. No quema. Sobre un enemigo con sangrado, cauteriza: gasta el sangrado de golpe y le hace más daño. Sobre uno mojado, lo ciega con el vapor.' },
  skillNode('matemagico', 'fuego', 'factor-comun', 1, 'fuego'),
  passiveNode('matemagico', 'fuego', 'rescoldo', 1, 'factor-comun', 'Pasiva. Los fuegos que prende Matemágico duran 15 segundos en vez de 10.'),
  // Grade III (docs/animas/matemagico/README.md § Grade III): the fire line's top, and the dúo mayor past it, both after Aurelià.
  gradeIII(passiveNode('matemagico', 'fuego', 'combustion', 3, 'rescoldo', 'Pasiva. El fuego puede subir a un cuarto nivel, Combustión. Un golpe físico sobre un enemigo en Combustión lo hace estallar: daño mágico de fuego medio a todos los enemigos, y el fuego de los demás sube un nivel.')),
  dualNode('matemagico', 'fuego', 'vulcano', 'sincopante', 'combustion'),
  { id: 'matemagico:agua', anima: 'matemagico', kind: 'element', line: 'agua', element: 'agua', name: 'Agua', cost: 1, description: 'Atacar puede llevar agua. No moja. Sobre un enemigo quemado, apaga el fuego y lo ciega: sus golpes pierden fuerza.' },
  skillNode('matemagico', 'agua', 'vasos', 1, 'agua'),
  passiveNode('matemagico', 'agua', 'capilaridad', 1, 'vasos', 'Pasiva. Atacar con agua deja mojado al enemigo si no apaga ningún fuego.'),
  // Superficie mínima (Matemágico grows, 2026-11-25): a branch off Cubo acuático beside Capilaridad, his first guard.
  skillNode('matemagico', 'agua', 'superficie-minima', 1, 'vasos'),
  // The dúo mayor past each of the other lines (docs/animas/README.md § Dúos mayores), after Aurelià as Vulcano.
  dualNode('matemagico', 'agua', 'marea', 'freatica', 'capilaridad'),
  { id: 'matemagico:electrico', anima: 'matemagico', kind: 'element', line: 'electrico', element: 'electrico', name: 'Eléctrico', cost: 1, description: 'Atacar puede llevar electricidad. No paraliza. Sobre un enemigo cegado, salta por el humo: daño medio mágico a todos los cegados. Sobre uno mojado, corre por el agua a todos los mojados. Sobre uno que arde, hace de golpe todo el daño que le quedaba al fuego, y más, y lo apaga.' },
  skillNode('matemagico', 'electrico', 'descarga', 1, 'electrico'),
  passiveNode('matemagico', 'electrico', 'toma-de-tierra', 1, 'descarga', 'Pasiva. Una reacción entre elementos que provoque Matemágico le devuelve 1 de maná, una vez por ronda.'),
  // Aitor 2026-11-21: past Toma de tierra, the current that stays in one foe and the charge he stores.
  skillNode('matemagico', 'electrico', 'cortocircuito', 1, 'toma-de-tierra'),
  skillNode('matemagico', 'electrico', 'condensador', 1, 'cortocircuito'),
  dualNode('matemagico', 'electrico', 'fulgurita', 'prismatico', 'condensador'),
  skillNode('matemagico', 'calculo', 'angulo', 1),
  skillNode('matemagico', 'calculo', 'analisis', 1, 'angulo'),
  skillNode('matemagico', 'calculo', 'cardioide', 1, 'analisis'),
  manaNode('matemagico', 'calculo', 'cardioide'),
  gradeIII(skillNode('matemagico', 'calculo', 'integral', 3, 'mana-1')),
  // Atractor extraño (Aitor 2026-11-25: 2 ecos, not 3), beside Integral past Maná +1.
  gradeIII(skillNode('matemagico', 'calculo', 'atractor', 2, 'mana-1')),
  dualNode('matemagico', 'calculo', 'suceso-seguro', 'dadaista', 'integral'),
  // Serie de Fourier: a branch off Análisis Parálisis (grade II), a strike for each thing on a foe's plate.
  skillNode('matemagico', 'calculo', 'fourier', 1, 'analisis'),
];
/** Tecnópata's tree: Bip, Mente and Taller, and a maná on its own. */
const TECNOPATA: Improvement[] = [
  skillNode('tecnopata', 'bip', 'explosion', 1),
  passiveNode('tecnopata', 'bip', 'telemetria', 1, 'explosion', 'Pasiva. El Atacar de Bip alarga 3 segundos los estados con reloj de su objetivo.'),
  // Grade III (docs/animas/tecnopata/README.md § Grade III): each line's top, after Aurelià.
  gradeIII(skillNode('tecnopata', 'bip', 'reinicio', 2, 'telemetria')),
  dualNode('tecnopata', 'bip', 'metralla', 'papagato', 'reinicio'),
  skillNode('tecnopata', 'mente', 'confusion', 1),
  skillNode('tecnopata', 'mente', 'control-remoto', 1, 'confusion'),
  // The Mente line's first passive (docs/animas/tecnopata/README.md § Sugestión), beside Virus atómico.
  passiveNode('tecnopata', 'mente', 'sugestion', 1, 'control-remoto', 'Pasiva. Un enemigo confundido golpea al último enemigo al que ha apuntado un aliado, en vez de a uno al azar. Idea fija también golpea a ese enemigo.'),
  gradeIII(skillNode('tecnopata', 'mente', 'virus', 2, 'control-remoto')),
  dualNode('tecnopata', 'mente', 'idea-fija', 'sincopante', 'virus'),
  // Taller is Bip as a protector since 2026-11-21: Escolta heads it where Rayo encogedor was (docs/animas/tecnopata/README.md).
  skillNode('tecnopata', 'taller', 'escolta', 1),
  passiveNode('tecnopata', 'taller', 'nanitos', 1, 'escolta', 'Pasiva. Rayo de sanación quita además un efecto de estado dañino a quien cura.'),
  gradeIII(skillNode('tecnopata', 'taller', 'escudo-de-bits', 3, 'nanitos')),
  passiveNode('tecnopata', 'taller', 'redundancia', 1, 'escudo-de-bits', 'Pasiva. Las curas pueden reparar la cúpula de bits hasta el triple de sus PV.'),
  // Rayo encogedor left the head of Taller for Escolta (Aitor 2026-11-21); it waits at the line's end only so its dual,
  // A escala, can still be met, until the duals are looked at again.
  skillNode('tecnopata', 'taller', 'rayo-encogedor', 1, 'redundancia'),
  dualNode('tecnopata', 'taller', 'caleidoscopio', 'prismatico', 'redundancia'),
  manaNode('tecnopata'),
];
/** Dadista grows by level, and keeps one node of its own beside its maná: Agitar a second time in a fight (Aitor 2026-11-20). */
const DADAISTA: Improvement[] = [manaNode('dadaista'), { id: 'dadaista:otra-vez', anima: 'dadaista', kind: 'passive', passive: 'otra-vez', name: PASSIVES['otra-vez'].name, cost: 1, description: 'Pasiva. Agitar se puede usar dos veces por combate.' }];
const TREES: Partial<Record<ClassId, Improvement[]>> = { matemagico: MATEMAGICO, tecnopata: TECNOPATA, dadaista: DADAISTA };
/** What the jar offers each ánima: its tree if it has one, or one more maná; and the definitiva, asleep. */
export const IMPROVEMENTS: readonly Improvement[] = (Object.keys(ANIMA_NAMES) as ClassId[]).flatMap(anima => [...TREES[anima] ?? [manaNode(anima)], ulti(anima)]);
export const improvementOf = (id: string) => IMPROVEMENTS.find(item => item.id === id);
/** What `list` costs, in ecos. */
export const costOf = (list: readonly string[]) => list.reduce((sum, id) => sum + (improvementOf(id)?.cost ?? 0), 0);
/** The castle's stage `item` opens at: its own, or that of what it hangs from if later (whatever is past grade III is grade III too). */
export function stageOf(item: Improvement): GrowthStage {
  const before = item.after ? improvementOf(item.after) : undefined;
  return Math.max(item.stage ?? 1, before ? stageOf(before) : 1) as GrowthStage;
}
/**
 * Whether `item` is in the jar's sky at `stage`: a node once its stage has come (until then the
 * constellation simply has fewer stars), a definitiva always, as a place kept (`asleep`).
 */
export const inSky = (item: Improvement, stage: GrowthStage) => item.kind === 'ulti' || stageOf(item) <= stage;
/** Whether `item` shows but cannot be bought at `stage`: still to design, or a definitiva before the stage that wakes them. */
export const asleep = (item: Improvement, stage: GrowthStage) => !!item.veiled || stageOf(item) > stage;
/**
 * What stands of `list` with `ecos` to spend, in the order it was bought: nothing unknown or asleep,
 * nothing the castle's `stage` has not opened yet, nothing without what it needs first, and nothing
 * past what the ecos pay for (a rewound day can take a light back, or a boss beaten; what it paid
 * for comes back with it). The development tools leave `stage` at the last: everything.
 */
export function withinEcos(list: readonly string[], ecos: number, stage: GrowthStage = 3) {
  const kept: string[] = [];
  let left = ecos;
  for (const id of list) {
    const item = improvementOf(id);
    if (!item || asleep(item, stage) || kept.includes(id) || item.cost > left || (item.after && !kept.includes(item.after))) continue;
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
  const improved: { mana: Partial<Record<ClassId, number>>; elements: Partial<Record<ClassId, Element[]>>; skills: SkillId[]; passives: PassiveId[]; duals: DualId[] } = { mana: {}, elements: {}, skills: [], passives: [], duals: [] };
  for (const id of list) {
    const item = improvementOf(id);
    if (!item) continue;
    if (item.mana) improved.mana[item.anima] = (improved.mana[item.anima] ?? 0) + item.mana;
    if (item.element) (improved.elements[item.anima] ??= []).push(item.element);
    if (item.skill) improved.skills.push(item.skill);
    if (item.passive) improved.passives.push(item.passive);
    if (item.dual) improved.duals.push(item.dual);
  }
  return improved;
}
