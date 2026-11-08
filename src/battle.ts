/** Campaign turn/story adapter. Numeric resolution is shared with the generic combat core. */
import { adjustResource } from './combat/engine.ts';
import { DOG_PROFILES } from './encounters.ts';
import { PROFILES, healing, magical, physical, withBonus, type ProfileId, type StatBonus, type Stats } from './stats.ts';
export type BattleAction = 'attack' | 'defend' | 'skill' | 'escape';
/** `beat`: the fight holds still for a story moment (the palace minion about to finish Bernat). */
export type BattlePhase = 'player' | 'enemy' | 'beat' | 'won' | 'lost' | 'escaped';
/**
 * Ánimas (the code calls them classes; docs/party.md). They belong to the party, not to one
 * person: once unlocked, anyone in the party but Bernat can wear one, and it adds its stats and
 * its skills to whoever wears it. In a fight the active fighter swaps them with L and R.
 */
export type ClassId = 'matemagico' | 'papagato' | 'tecnopata';
export const ANIMA_NAMES: Record<ClassId, string> = { matemagico: 'Matemágico', papagato: 'Papagato', tecnopata: 'Tecnópata' };
export const CLASS_STATS: Record<ClassId, StatBonus> = {
  // Counting everything twice sharpens the mind a little.
  matemagico: { magia: 1, espiritu: 1 },
  // Haru and Yuki at your feet: quick and scrappy, less calm (docs/animas/papagato/).
  papagato: { velocidad: 2, fuerza: 1, espiritu: -1 },
  // Aitor's own ánima: a placeholder, still to design (no stats, no skills).
  tecnopata: {},
};
/**
 * Ánimas bound to one person: Matemágico is Gerard's own mind, Tecnópata is Aitor's. The rest (Papagato)
 * anyone can wear but Bernat. Whoever it is, two people never wear the same ánima at once.
 */
export const ANIMA_OWNERS: Partial<Record<ClassId, string>> = { matemagico: 'gerard', tecnopata: 'aitor' };
/** Whether `who` (a party member's id) may ever wear `id`. */
export const canWear = (who: string, id: ClassId) => who !== 'bernat' && (!ANIMA_OWNERS[id] || ANIMA_OWNERS[id] === who);
/**
 * Descriptions follow the shape in AGENTS.md ("Daño alto mágico a un enemigo. Rompe el pringue."),
 * unless the skill is marked `abstract: true`, which lets its description stay vague on purpose.
 * `power` is the amount at average stats (see stats.ts); for a `boost` it is what it adds to
 * the stats it names. `cost` is in points of maná (MANA_POINTS). Every skill comes with an
 * ánima (`class`), so whoever wears none has none: Bernat only attacks.
 */
export const SKILLS = [
  // Matemágico's first spell: two streams of fire. It sets the foe on fire (`burn`, a timed status:
  // again while it burns, the fire goes up a level); fire also melts the palace minion's gum.
  // Foc Binari: a zero and a one, two streams that land one after the other (`split`).
  { id: 'foc-binari', name: 'Foc Binari', cost: 1, side: 'foes', power: 16, kind: 'magic', burn: 'quemado', melts: true, split: 2, description: 'Daño leve mágico de tipo fuego a un enemigo. Golpea dos veces. Lo quema durante unos segundos. Si ya arde, el fuego sube de nivel. Derrite el pringue.', class: 'matemagico' },
  // Learned as Matemágico grows (src/levels.ts; docs/animas/matemagico/): Gerard works out how
  // everyone should hit (a boost), and later draws a cardioid of light under a friend (a cure).
  { id: 'analisis', name: 'Análisis Parálisis', cost: 2, side: 'party', power: 3, kind: 'boost', stats: ['fuerza', 'magia'], level: 2, description: 'Sube Fuerza y Magia de todo el equipo durante 3 rondas.', class: 'matemagico' },
  // Ángulo exacto: Gerard works out the angle a foe is open at (a `debuff`: a mark on that foe,
  // `marks`, for BOOST_ROUNDS). Damage is flat, so every point off adds a point to every hit.
  { id: 'angulo', name: 'Ángulo exacto', cost: 1, side: 'foes', power: 3, kind: 'debuff', stats: ['defensa', 'espiritu'], level: 2, description: 'Baja Defensa y Espíritu de un enemigo durante 3 rondas.', class: 'matemagico' },
  { id: 'cardioide', name: 'Cardioide', cost: 2, side: 'allies', power: 30, kind: 'heal', level: 3, description: 'Cura media a un aliado herido.', class: 'matemagico' },
  // Papagato's skills are Haru's and Yuki's: the wearer only asks.
  { id: 'zarpazo', name: 'Zarpazo sangriento', cost: 1, side: 'foes', power: 16, kind: 'physical', bleed: 2, description: 'Daño leve físico a un enemigo. Añade sangrado.', class: 'papagato' },
  { id: 'escondite', name: 'Yuki se esconde', cost: 1, side: 'party', power: 4, kind: 'boost', stats: ['defensa'], description: 'Sube Defensa de todo el equipo durante 3 rondas.', class: 'papagato' },
  // Learned as Papagato grows (src/levels.ts): `level` is the one that teaches it.
  // Zarpazos: a flurry of little claws. Weak, but each one takes a layer off an onion (`strikes`).
  { id: 'zarpazos', name: 'Zarpazos', cost: 2, side: 'foes', power: 7, kind: 'physical', strikes: 4, level: 2, description: 'Daño leve físico a un enemigo. Golpea cuatro veces.', class: 'papagato' },
  // Ronroneo de Yuki: Yuki purrs and everyone calms down. A cure for the whole party that also takes
  // away every status marked `mental` in STATUSES (`cleanse`), whichever they are.
  { id: 'ronroneo', name: 'Ronroneo de Yuki', cost: 2, side: 'party', power: 14, kind: 'heal', cleanse: 'mental', level: 2, description: 'Cura leve a todo el equipo. Quita los efectos de estado mentales.', class: 'papagato' },
  // Zarpa en la llaga: every blow spends Sangrado (`wound`); this one opens the wound twice as far (`deep`).
  { id: 'llaga', name: 'Zarpa en la llaga', cost: 2, side: 'foes', power: 26, kind: 'physical', deep: true, level: 3, description: 'Daño medio físico a un enemigo. Gasta el sangrado: cada uno suma el doble de daño.', class: 'papagato' },
  { id: 'a-la-vez', name: 'Las dos a la vez', cost: 2, side: 'all-foes', power: 24, kind: 'physical', bleed: 1, level: 3, description: 'Daño medio físico a todos los enemigos. Añade sangrado.', class: 'papagato' },
  // Tecnópata's skills are Bip's: Aitor points, Bip does it (docs/animas/tecnopata/). Its ánima does
  // not grow yet (src/levels.ts LEVELLED), so they are all there from the start.
  // Rayo de energía: a beam; what is running out on the foe by the clock (TIMED: a fire, the smoke,
  // Confusión; never a cure) lasts `extend` seconds longer.
  { id: 'rayo-energia', name: 'Rayo de energía', cost: 2, side: 'foes', power: 18, kind: 'magic', extend: 5, description: 'Daño leve mágico a un enemigo. Sus estados con reloj duran 5 segundos más.', class: 'tecnopata' },
  // Rayo de sanación: a cure that comes bit by bit on the fight's clock (`regen`: a timed status, as
  // Quemado is a fire, its pulses healing). `power` is what it gives back in all at level I.
  { id: 'rayo-sanacion', name: 'Rayo de sanación', cost: 1, side: 'allies', power: 20, kind: 'heal', regen: 'sanacion', description: 'Cura leve a un aliado herido. La cura llega poco a poco durante 15 segundos.', class: 'tecnopata' },
  // Explosión: Bip blows itself up among the foes (fire: it melts the pringue), blinds them until
  // their turn is over (`blind`: Cegado until the round ends), and its wearer loses their next turn
  // while it puts itself back together (`spends`, `Combatant.out`).
  { id: 'explosion', name: 'Explosión', cost: 2, side: 'all-foes', power: 32, kind: 'magic', melts: true, blind: true, spends: true, description: 'Daño medio mágico de tipo fuego a todos los enemigos. Los ciega durante 1 ronda. Pierdes tu siguiente turno.', class: 'tecnopata' },
  // Confusión: waves of the mind off Bip; for a while the foe does not know whose side it is on
  // (`confuse`: the timed status Confusión), and its blows go to its own (`enemyAct`).
  { id: 'confusion', name: 'Confusión', cost: 2, side: 'foes', power: 0, kind: 'debuff', stats: [], confuse: true, abstract: true, description: 'Ondas mentales confunden a un enemigo durante 30 segundos: golpea a los suyos.', class: 'tecnopata' },
  // Rayo encogedor: the foe shrinks for a while (`shrink`: the timed status Encogido), a quarter of
  // its Defensa gone. In seconds, not rounds, so it skips the fixed shape (`abstract`).
  { id: 'rayo-encogedor', name: 'Rayo encogedor', cost: 1, side: 'foes', power: 0, kind: 'debuff', stats: ['defensa'], shrink: true, abstract: true, description: 'Encoge a un enemigo durante 15 segundos: su Defensa baja un 25 %.', class: 'tecnopata' },
] as const;
/**
 * Maná (docs/combat.md § Maná): what skills spend, shown as circles. Every ánima has its own, for
 * each wearer, full at the start of every fight; the ones resting get some back each round, so a
 * fighter who wants to keep using skills changes ánima. Bernat wears none and has none.
 */
export const MANA_POINTS = 3;
/** What Ecos de luz (src/ecos.ts) added to each ánima: more maná, the elements its Atacar can carry. */
export interface Improved { mana?: Partial<Record<ClassId, number>>; elements?: Partial<Record<ClassId, readonly Element[]>> }
/** How much maná `id` holds: MANA_POINTS and what Ecos de luz added. */
export const manaMax = (improved: Improved | undefined, id?: ClassId) => MANA_POINTS + (id ? improved?.mana?.[id] ?? 0 : 0);
/** What Defender gives back to the ánima worn (only that one). */
export const DEFEND_CHARGE = 2;
/** What an ánima not worn at all during a round gets back at its end. */
export const REST_CHARGE = 1;
/** How many rounds a boost lasts, counting the one it is used in. */
export const BOOST_ROUNDS = 3;
export type SkillId = typeof SKILLS[number]['id'];
type Skill = typeof SKILLS[number];
/** `vertigo`: Vertitrón, the tower's boss; `vertigo-ojo`: its eye, a part of it (its own PV, no turns, `part`). */
export type FoeKind = 'dog' | 'minion' | 'guardian' | 'cebollon' | 'cebolla' | 'plato' | 'vertigo' | 'vertigo-ojo' | BroodKind;
/** The fears' young (docs/quests/nuria.md § The tower). */
export type BroodKind = 'cebollita' | 'platito' | 'fantasmita';
/**
 * Onions (docs/quests/nuria.md § Monsters): one rule at three sizes. While it has layers a hit only
 * peels one off and lands at half, and every layer adds weight to its blow: a big one hits very hard
 * until it is peeled and ends up small and weak. A big one's weight also reaches everyone else
 * (`splash`, a share of the blow, while it has layers), so holding on (Defender) does not answer it,
 * and with layers on it does not catch fire. One hit a layer is too slow for the big ones, which is
 * what Zarpazos is for. `size` is how big the fight draws it, peeled and with every layer on.
 */
export type OnionKind = 'cebollita' | 'cebolla' | 'cebollon';
export const ONIONS: Record<OnionKind, { layers: number; power: number; perLayer: number; cry: number; splash: number; size: readonly [number, number] }> = {
  cebollita: { layers: 2, power: 12, perLayer: 3, cry: 1, splash: 0, size: [.4, .66] },
  cebolla: { layers: 8, power: 16, perLayer: 6, cry: 2, splash: .5, size: [.5, 1.3] },
  // 10 layers since only one of the party can wear Papagato at a time (2026-11-05): its blow at full layers is as heavy as ever.
  cebollon: { layers: 10, power: 13, perLayer: 5, cry: 2, splash: .5, size: [.55, 1.8] },
};
export const isOnion = (kind?: FoeKind): kind is OnionKind => !!kind && kind in ONIONS;
/** How hard an onion's blow is at average stats with the layers it has left. */
export const onionPower = (kind: OnionKind, layers: number) => ONIONS[kind].power + ONIONS[kind].perLayer * layers;
/** How big an onion stands with `layers` left: a step smaller with each one, small with none. */
export function onionSize(kind: OnionKind, layers: number) {
  const { size: [peeled, full], layers: most } = ONIONS[kind];
  return peeled + (full - peeled) * Math.min(1, layers / most);
}
/** El Plato Misterioso's dishes: each round a new one under the cloche, each with its own weakness. */
export const DISHES = {
  alcachofa: { name: 'una alcachofa', physical: 1.5, magic: .5 },
  coliflor: { name: 'una coliflor', physical: .5, magic: 1.5 },
  sorpresa: { name: 'algo que nadie sabe qué es', physical: 1, magic: 1 },
} as const;
export type DishId = keyof typeof DISHES;
const DISH_ORDER: DishId[] = ['alcachofa', 'coliflor', 'sorpresa'];
/**
 * Uri's fears' abilities (docs/quests/nuria.md § Monsters): every foe action in the tower carries one
 * (`BattleEffect.ability`), and one announced a turn ahead also comes as `telegraph` and sets the
 * foe's `intent` (`intentLabel` reads it: «Carrerilla → Aitor», «Rayo terrorífico → todos»). The fight
 * never shows an ability's name when it is used; its picture says what it does. `card`: not a plain
 * blow, so the fight holds a beat after it for that picture to be seen (BEAT.ability).
 */
export type FoeAbilityId = 'lagrimilla' | 'capa-nueva' | 'peso' | 'carrerilla' | 'aplaston'
  | 'salpicon' | 'vuelta' | 'atravesar' | 'transparente' | 'game-over'
  | 'cambio-plato' | 'sorpresa' | 'puaj'
  | 'pisoton' | 'barrido' | 'grito' | 'carga' | 'rayo';
export const FOE_ABILITIES: Record<FoeAbilityId, { name: string; card: boolean }> = {
  lagrimilla: { name: 'Lagrimilla', card: false },
  'capa-nueva': { name: 'Capa nueva', card: true },
  peso: { name: 'Peso', card: false },
  carrerilla: { name: 'Carrerilla', card: true },
  aplaston: { name: 'Aplastón', card: true },
  salpicon: { name: 'Salpicón', card: false },
  vuelta: { name: 'Darle la vuelta', card: true },
  atravesar: { name: 'Atravesar', card: false },
  transparente: { name: 'Transparente', card: false },
  'game-over': { name: '«GAME OVER»', card: true },
  'cambio-plato': { name: 'Cambio de plato', card: false },
  sorpresa: { name: 'Plato sorpresa', card: false },
  puaj: { name: '¡Puaj!', card: true },
  pisoton: { name: 'Pisotón', card: false },
  barrido: { name: 'Barrido', card: false },
  grito: { name: 'Grito liberador', card: true },
  carga: { name: 'Rayo terrorífico', card: true },
  rayo: { name: 'Rayo terrorífico', card: true },
};
const foeAbility = (id: FoeAbilityId) => ({ id, name: FOE_ABILITIES[id].name, ...FOE_ABILITIES[id].card ? { card: true as const } : {} });
/**
 * The tower's foe rules, tunable (`just fight-sim`, book `fear.rules`). A big onion takes a run-up
 * (Carrerilla) on its own turn `aplastonFirst` and every `aplastonEvery` after, while it has layers,
 * and on its next turn, still layered, falls on whom it looked at: `aplaston` times its blow, no splash
 * (the escort's onion starts a turn later, `escortAplastonFirst`). A platito flips its dish once at
 * `flipAt` of its PV. A fantasmita on its last count lets physical blows through at `transparent`.
 * El Plato's surprise dish lets single blows in at `sorpresaSingle` and a dual at `sorpresaDual`, and
 * on that turn it splashes everyone (`puaj`). Ring 3's fear brings La Cebolla with `escortLayers`;
 * a pack of ring 3 is mixed (a cebolla with `mixLayers` and young) at `mixChance`.
 */
export const FEAR_RULES = {
  aplastonEvery: 4, aplastonFirst: 3, aplaston: 1.5, escortAplastonFirst: 3,
  flipAt: .5, transparent: .5, sorpresaSingle: .5, sorpresaDual: 1, puaj: 26,
  escortLayers: 4, mixChance: .35, mixLayers: 3,
};
/**
 * Vertitrón (docs/quests/nuria.md § Final boss), every number in one book (`vertigo.boss`); its PV
 * are PROFILES.vertigo and its eye's PROFILES['vertigo-ojo']. Its turns go round VERTIGO_TURNS:
 * Pisotón (`pisoton` on one), Barrido (`barrido` on everyone), Grito liberador (the party's Fuerza and
 * Magia down by `gritoDown` and its own up by `gritoUp`, for the rest of the fight, adding up with
 * every shout), the eye charging (Rayo terrorífico → todos, announced) and the Rayo (`rayo`, magic, on
 * everyone). Holding on (Defender) takes two thirds off any of them. Its eye is a part of it, an
 * optional target: broken, it can no longer charge nor fire the Rayo (one charging is called off).
 */
export const VERTIGO = {
  pisoton: 22, barrido: 14, rayo: 32, gritoDown: 2, gritoUp: 1,
};
/** Vertitrón's turns, in order, round and round (with its eye broken it skips the charge and the Rayo). */
export const VERTIGO_TURNS = ['pisoton', 'barrido', 'grito', 'carga', 'rayo'] as const;
/** Punto débil's mark: the next damaging action on that foe lands this many times as hard. */
export const WEAK_SPOT = 3;
/**
 * Dual attacks (docs/animas/README.md § Combined skills): two skills of two ánimas, each chosen by
 * whoever wears it, become one action when the earlier fighter's skill goes off while the later one
 * has queued the other (`commit`). Each one goes off once a fight (`usedDuals`). Both turns go into
 * it, and each pays their own half from their own ánima's maná. Its blow is the stats of whoever brings the half of its kind (`kind`), and it counts
 * as every kind against a foe's kind-based rules (the better dish, whole through Transparente and on
 * the surprise dish). `burn`/`burnChance`: each strike landing on a foe without layers may light or
 * raise that status, on the fight's dice (`roll`). `weakSpot`: it leaves Punto débil on its target.
 */
export type DualId = 'zarpazos-de-fuego' | 'punto-debil' | 'rayo-solar';
export interface DualSpec {
  id: DualId; name: string;
  parts: readonly [SkillId, SkillId];
  side: 'foes' | 'all-foes'; kind: 'physical' | 'magic';
  power: number; strikes?: number;
  burn?: TimedId; burnChance?: number;
  /** The fire it leaves on each foe it reaches is at least this level (Rayo solar: II). */
  burnLevel?: number;
  weakSpot?: boolean;
  /**
   * It goes off in two times: on its turn whoever brings its first half charges up with it
   * (`Combatant.charge`), and it lands on every foe as the next round starts, before anyone
   * chooses (`nextRound`, as news). Whoever holds it falling first loses it.
   */
  charge?: boolean;
  description: string; abstract?: boolean;
}
export const DUALS: DualSpec[] = [
  { id: 'zarpazos-de-fuego', name: 'Zarpazos de fuego', parts: ['foc-binari', 'zarpazos'], side: 'foes', kind: 'physical', power: 8, strikes: 8, burn: 'quemado', burnChance: .75, description: 'Daño leve físico de tipo fuego a un enemigo. Golpea ocho veces. Cada golpe puede quemarlo o subir su fuego.' },
  { id: 'punto-debil', name: 'Punto débil', parts: ['angulo', 'zarpazo'], side: 'foes', kind: 'physical', power: 20, weakSpot: true, description: 'Daño leve físico a un enemigo. El siguiente ataque que reciba hace el triple de daño.' },
  // Rayo solar: Gerard gives Bip his fire; Bip charges with it, sun yellow, and as the next round
  // starts it sweeps every foe with it.
  { id: 'rayo-solar', name: 'Rayo solar', parts: ['rayo-energia', 'foc-binari'], side: 'all-foes', kind: 'magic', power: 40, charge: true, burn: 'quemado', burnLevel: 2, description: 'Daño alto mágico de tipo fuego a todos los enemigos. Se carga un turno y sale al empezar el siguiente. Los quema con fuego de nivel II.' },
];
/** The dual two skills make, in either order. */
export const dualOf = (a: SkillId, b: SkillId) => DUALS.find(d => (d.parts[0] === a && d.parts[1] === b) || (d.parts[0] === b && d.parts[1] === a));
/** What each half costs, by skill (each paid by whoever wears it). */
export const dualCost = (d: DualSpec) => Object.fromEntries(d.parts.map(id => [id, SKILLS.find(s => s.id === id)!.cost])) as Partial<Record<SkillId, number>>;
/**
 * Statuses that stack, counted in rounds (docs/animas/README.md § Shared mechanics). Each stack does
 * its part once more: Sangrado hurts at the end of every round, Mareo and Llorera weaken the stats.
 * Every round each one loses `decay` stacks, so they fade unless something keeps adding them.
 */
export type StatusId = 'sangrado' | 'mareo' | 'llorera';
/**
 * `mental`: a status of the mind, not the body (a skill that calms, `cleanse: 'mental'`, takes every
 * one of these away, whatever they are).
 */
export interface StatusSpec { name: string; max: number; decay: number; tick?: number; stats?: StatBonus; mental?: boolean }
export const STATUSES: Record<StatusId, StatusSpec> = {
  sangrado: { name: 'Sangrado', max: 10, decay: 1, tick: 2 },
  mareo: { name: 'Mareo', max: 5, decay: 1, stats: { velocidad: -2, defensa: -1, espiritu: -1 }, mental: true },
  llorera: { name: 'Llorera', max: 5, decay: 1, stats: { fuerza: -2, magia: -2 }, mental: true },
};
/** The statuses of the mind (`mental` in STATUSES). */
export const MENTAL_STATUSES = (Object.keys(STATUSES) as StatusId[]).filter(id => STATUSES[id].mental);
const STATUS_IDS = Object.keys(STATUSES) as StatusId[];
/**
 * Statuses that run on the fight's clock, in seconds, not rounds (docs/combat.md § Estados en
 * tiempo real). The clock runs while the players choose and while everyone acts; only the pause
 * menu (and the story's own moments) stop it. Each one pulses every `every` seconds for `seconds`.
 *
 * Its own element landing again while it is on raises it a level, up to its last, and starts its
 * clock over (`escalate`). Each level hurts more per pulse than the one below, by `levels`, so
 * keeping a fire going is worth more than letting it go out and lighting it again: it rewards
 * acting quickly and, with two players, one keeping up what the other started.
 *
 * A pulse is part flat, part a share of the carrier's PV (`pulseDamage`); the share only counts PV
 * up to `cap`, so a small foe feels it and a boss mostly takes the flat part.
 */
export type Element = 'fuego' | 'agua' | 'electrico';
/** The elements an Atacar can carry, in the order X walks through them (`cycleElement`). */
export const ELEMENTS: Record<Element, { name: string; colour: string }> = {
  agua: { name: 'Agua', colour: '#6cc8f2' },
  fuego: { name: 'Fuego', colour: '#ff8f3f' },
  electrico: { name: 'Eléctrico', colour: '#ffe45c' },
};
export const ELEMENT_ORDER = Object.keys(ELEMENTS) as Element[];
export type TimedId = 'quemado' | 'cegado' | 'sanacion' | 'confusion' | 'encogido';
export interface TimedSpec {
  /** `element`: the one that lights it, for the reactions; `heal`: its pulses give PV back instead of taking it. */
  name: string; element?: Element; heal?: boolean; seconds: number; every: number;
  /** The share of the carrier's stats it takes away while it lasts, whatever they are (Encogido: a quarter of Defensa). */
  cut?: Partial<Record<keyof Stats, number>>;
  /** How hard each level's pulses hit, as times the base pulse (level I, II, III…); none: it never pulses (Cegado). */
  levels: readonly number[];
  /** The base pulse: `flat` PV plus `share` of the carrier's PV, counted up to `cap` PV. */
  flat: number; share: number; cap: number;
}
export const TIMED: Record<TimedId, TimedSpec> = {
  quemado: { name: 'Quemado', element: 'fuego', seconds: 10, every: 2, levels: [1, 3, 5], flat: 1, share: .01, cap: 100 },
  // Cegado (Humo, below): it hurts nobody, the foe's blows land lighter while it lasts (`sighted`).
  cegado: { name: 'Cegado', element: 'agua', seconds: 10, every: 10, levels: [], flat: 0, share: 0, cap: 0 },
  // Sanación (Rayo de sanación): Quemado's other side, a pulse of PV back every few seconds.
  sanacion: { name: 'Sanación', heal: true, seconds: 15, every: 3, levels: [1, 2, 3], flat: 2, share: .015, cap: 150 },
  // Confusión (Tecnópata): it hurts nobody; while it lasts the foe's blows go to its own (`enemyAct`).
  confusion: { name: 'Confusión', seconds: 30, every: 30, levels: [], flat: 0, share: 0, cap: 0 },
  // Encogido (Rayo encogedor): smaller, and a quarter of its guard gone while it lasts.
  encogido: { name: 'Encogido', seconds: 15, every: 15, levels: [], flat: 0, share: 0, cap: 0, cut: { defensa: .25 } },
};
const TIMED_IDS = Object.keys(TIMED) as TimedId[];
/**
 * Reactions (docs/combat.md § Reacciones entre elementos): an Atacar with an element never lights a
 * status of its own; it turns what the foe already carries, whoever put it there.
 * Agua on Quemado is Humo: the fire goes out and leaves Cegado at the fire's level, its blows at
 * `blindN` of their weight. Fuego on Sangrado is Cauterizado: the blow opens no wound, every stack
 * burns away at once for `cauterize` PV. Eléctrico on Cegado is Tormenta: the bolt runs through the
 * smoke, `storm` of magic on everyone blinded, and the smoke is gone. Tunable (`just fight-sim`, book `reaction`).
 */
export type ElementReaction = 'humo' | 'cauterizado' | 'tormenta';
export const REACTION_RULES = { blind1: .7, blind2: .5, blind3: .3, cauterize: 6, storm: 24 };
/** A foe's blow as a blinded foe lands it: lighter the higher its Cegado. */
function sighted(actor: Combatant, raw: number) {
  const level = actor.timed?.cegado?.level;
  return level ? Math.max(1, Math.round(raw * REACTION_RULES[`blind${Math.min(3, level) as 1 | 2 | 3}`])) : raw;
}
/** A timed status on someone: its level (1 up), seconds left and seconds to its next pulse. */
export interface Timed {
  level: number; left: number; next: number;
  /** It also ends with this round, whatever its clock says (Explosión's blinding lasts one round). */
  until?: number;
}
/** What one pulse of a timed status did. */
export interface TimedPulse { target: string; status: TimedId; level: number; amount: number; heal?: boolean }
/** Level in roman numerals, as the fight shows it ("Quemado II"). */
export const roman = (level: number) => ['I', 'II', 'III', 'IV', 'V'][level - 1] ?? String(level);
/** How much one pulse of `id` at `level` takes from someone with `maxHp` PV. */
export function pulseDamage(id: TimedId, level: number, maxHp: number) {
  const spec = TIMED[id];
  return Math.max(1, Math.round(spec.levels[Math.min(level, spec.levels.length) - 1] * (spec.flat + spec.share * Math.min(maxHp, spec.cap))));
}
/**
 * An element lands on `c`: the timed statuses it lights. One already on goes up a level and starts
 * its clock over; otherwise it starts at level I. Returns how it is now.
 */
export function inflict(c: Combatant, id: TimedId): Timed {
  const spec = TIMED[id], on = c.timed?.[id];
  const timed = { level: on ? Math.min(spec.levels.length, on.level + 1) : 1, left: spec.seconds, next: spec.every };
  c.timed = { ...c.timed, [id]: timed };
  return timed;
}
export interface Combatant {
  id: string; name: string; hp: number; maxHp: number;
  /** Maná of the ánima worn now: what its skills spend (MANA_POINTS; 0 for Bernat, who wears none). */
  secondary: number; maxSecondary: number; guarding: boolean;
  /** Maná of each ánima not worn now, kept until it is worn again (missing: full). */
  mana?: Partial<Record<ClassId, number>>;
  /** Ánimas worn at some moment of this round: they do not rest at its end. */
  worn?: ClassId[];
  /** The ánimas this fighter can switch between (L / R): their own and the extras they equipped (docs/party.md). */
  kit?: ClassId[];
  /** The element chosen for their Atacar (`cycleElement`); it only counts while the ánima worn has it (`attackElement`). */
  element?: Element;
  /** Stats in this fight: the fighter's own plus their class's. */
  stats: Stats;
  /** Who the fighter is underneath (stats.ts), e.g. Gerard as a boy or at 35. */
  profile: ProfileId;
  /** The class the fighter wears, if any. */
  classId?: ClassId;
  kind?: FoeKind;
  /** Pringue: a gum shell that swallows every hit except fire (Foc Binari). */
  shell?: boolean;
  /** A foe's own hit at average stats, when it has one (the palace guards). */
  power?: number;
  /** Stacks of each status the fighter carries. */
  statuses?: Partial<Record<StatusId, number>>;
  /** Timed statuses on the fighter (TIMED), running on the fight's clock. */
  timed?: Partial<Record<TimedId, Timed>>;
  /** An onion's layers (ONIONS): while it has any, each hit only peels one off and lands at half. */
  layers?: number;
  /** El Plato Misterioso: the dish under the cloche this round. */
  dish?: DishId;
  /** A fantasmita: its turns left before «GAME OVER». */
  countdown?: number;
  /**
   * A foe's move announced a turn ahead (Carrerilla → Aplastón, Vertitrón's Rayo terrorífico, Capa
   * nueva): what it will do, and at whom: one ally (`target`, their id) or, in words, `at` (everyone,
   * or Uri). `intentLabel` says it as the fight shows it.
   */
  intent?: { ability: FoeAbilityId; target?: string; at?: Aim };
  /** A foe's own turns taken so far (a lost turn does not count). */
  turns?: number;
  /** A big onion: the own turn it first takes a run-up on (Carrerilla), then every `FEAR_RULES.aplastonEvery`. */
  rushFirst?: number;
  /** A dual charged and still to go off (Rayo solar, `DualSpec.charge`): which, and whose stats it hits with. */
  charge?: { dual: DualId; striker: string };
  /** The round this fighter sits out (Explosión: Bip is putting itself back together). */
  out?: number;
  /** Marks a debuff left on a foe (Ángulo exacto), by skill: its stats down by `amount` until the end of round `until`. */
  marks?: Partial<Record<SkillId, { amount: number; stats: (keyof Stats)[]; until: number }>>;
  /**
   * Punto débil (a dual): the next action that does damage to this foe lands every strike at
   * WEAK_SPOT times, and spends it. Unused, it fades at the end of round `weakSpot`.
   */
  weakSpot?: number;
  /** A cebollita has grown its one new layer (Capa nueva); a platito has flipped its dish (Darle la vuelta). */
  regrown?: boolean; flipped?: boolean;
  /** A fantasmita on its last count: blows go through it (physical at FEAR_RULES.transparent). */
  transparent?: boolean;
  /**
   * A part of a bigger foe (Vertitrón's eye): a target with its own PV, but it never takes a turn,
   * is worth no EXP, is not a kill, and never holds up the win.
   */
  part?: boolean;
  /** Vertitrón's eye: its breaking has been told (and its Rayo called off). */
  told?: boolean;
  /** Stats up or down for the rest of the fight (Vertitrón's Grito liberador), stat by stat; `from` names why. */
  lasting?: { shifts: Partial<Record<keyof Stats, number>>; from: string };
}
/** Whom a move is aimed at when it is not one ally: everyone. */
export type Aim = 'todos';
/** Which fight this is: the street dogs, the palace minion that wakes Matemágico, or the palace guards of chapter 2. */
/** `escolta`: ring 3's fear, La Cebolla y los suyos (La Cebolla, a fantasmita and a cebollita). */
export type Encounter = 'dogs' | 'palace-minion' | 'palace-guards' | 'night-guard' | 'cebollon' | 'cebolla' | 'plato' | 'escolta' | 'uri-vertigo' | BroodEncounter;
/** The young that chase the party up each ring of Uri's tower, a few at a time. */
export const BROOD_ENCOUNTERS = ['crias-1', 'crias-2', 'crias-3'] as const;
export type BroodEncounter = (typeof BROOD_ENCOUNTERS)[number];
/** Uri's maze and roof (docs/quests/nuria.md): the fears' fights. */
export const FEAR_ENCOUNTERS = ['cebollon', 'cebolla', 'plato', 'escolta', 'uri-vertigo', ...BROOD_ENCOUNTERS] as const;
/** Bernat's HP floor in the palace fight: the hit that would cross it stops there and starts the beat. */
export const BEAT_HP = 20;
export interface BattleState {
  allies: Combatant[]; foes: Combatant[]; active: number; round: number;
  phase: BattlePhase; message: string;
  enemyActions: string[];
  /** Dogs under La Reina Bubbaloo's spell: they surround the party, so nobody can escape. */
  possessed: boolean;
  encounter: Encounter;
  /** Party boosts running, by skill (Yuki se esconde: Defensa), each up by `amount` until the end of round `until`. */
  boosts?: Partial<Record<SkillId, { amount: number; until: number }>>;
  /**
   * Choices allies later in the round have queued while an earlier one chooses (split mode, two
   * players): if the earlier one's skill and a queued one make a dual, it fires (`commit`); otherwise
   * the queued choice plays on its own when that ally's turn comes (`takeQueued`). Cleared every round.
   */
  queued?: Partial<Record<string, Queued>>;
  /** Allies whose turn a dual already used this round: the next-active search skips them. */
  spent?: string[];
  /** Duals already played this fight: each one goes off once a fight (`dualBlock` 'used'). */
  usedDuals?: DualId[];
  /**
   * Development (the picker's *Sin límites*): skills have no limit of use. A cure reaches anyone
   * standing, a boost or a mark can go again while it runs (it starts over), and a dual goes off as
   * often as wanted, maná or not.
   */
  unbound?: boolean;
  /** The fight's dice (`roll`): a seed set when the fight is created, stepped on every roll. */
  seed?: number;
  /** Things that happened outside an action (a phase that a pulse or a round's end brought on): `takeNews`. */
  news?: BattleEffect[];
  /** The ánimas the party has unlocked, in the order L and R walk through them. */
  animas: ClassId[];
  /** Matemágico has woken up in Gerard: the palace minion stops escalating. */
  awakened: boolean;
  /** Each ánima's level (src/levels.ts); a skill with a higher `level` is not learned yet. */
  levels?: Partial<Record<ClassId, number>>;
  /** What Ecos de luz added to the party's ánimas (`improve`). */
  improved?: Improved;
  /** Who acted wearing each ánima this fight (src/levels.ts `participants`: the ánimas a win teaches). */
  fought?: Partial<Record<ClassId, string[]>>;
  /** Development: EXP added to what the foes are worth (the picker's «Victoria subiendo de nivel»). */
  extraXp?: number;
}
/** A choice queued ahead by an ally later in the round (`queue`). */
export interface Queued { action: 'attack' | 'defend' | 'skill'; skill?: SkillId; target?: string }
/**
 * Someone who fights on the party's side: `id` names them in the fight, `profile` gives their
 * stats, `bonus` adds what the party has gathered (chapter 2's ánimas).
 */
export interface PartySlot {
  id: string; name: string; profile: ProfileId; classId?: ClassId; bonus?: StatBonus;
  /** The ánimas they can switch between: their own and their extras. Missing: their own (if unlocked) and the one they wear. */
  kit?: ClassId[];
}
/** Each one's own ánima (the inverse of `ANIMA_OWNERS`): Matemágico Gerard's, Tecnópata Aitor's. */
export const fixedAnima = (who: string) => (Object.entries(ANIMA_OWNERS) as [ClassId, string][]).find(([, owner]) => owner === who)?.[0];
/** What a slot can switch between when nobody said: their own ánima if it is unlocked, and the one they wear. */
export function kitOf(slot: PartySlot, unlocked: readonly ClassId[]): ClassId[] {
  if (slot.kit) return slot.kit.filter(id => unlocked.includes(id) || id === slot.classId);
  if (slot.profile === 'bernat') return [];
  const own = fixedAnima(slot.id);
  return [...new Set([...own && unlocked.includes(own) ? [own] : [], ...slot.classId ? [slot.classId] : []])];
}
/** Chapter 1's party: Gerard, and Bernat once he walks with him. */
export function childParty(allyCount: number, gerardClass?: ClassId): PartySlot[] {
  return [{ id: 'gerard', name: 'Gerard', profile: 'gerard', classId: gerardClass }, ...(allyCount === 2 ? [{ id: 'bernat', name: 'Bernat', profile: 'bernat' as const }] : [])];
}
/** Nobody runs from possessed dogs, the palace minion or Vertitrón's roof; the palace guards and the maze's fears let them back off. */
export const cornered = (state: BattleState) => state.possessed || state.encounter === 'palace-minion' || state.encounter === 'uri-vertigo';
/** Gerard's ánima in this fight. */
export const gerardClass = (state: BattleState) => state.allies.find(a => a.id === 'gerard')?.classId;
/** Bernat wears no ánima: he only attacks. */
export const wearsAnimas = (c: Combatant) => c.profile !== 'bernat';
/**
 * The active fighter puts on `id`, one of the unlocked ánimas. It is free, the turn stays theirs,
 * and their skills and stats change with it. Returns whether anything changed.
 */
export function wearAnima(state: BattleState, id: ClassId) {
  const actor = state.allies[state.active];
  if (state.phase !== 'player' || !actor || !wearsAnimas(actor) || !kitIn(state, actor).includes(id) || actor.classId === id || !free(state, actor, id)) return false;
  // PV stay; the stats, the skills and the maná change with the ánima.
  swapMana(state, actor, id);
  actor.classId = id; actor.stats = withBonus(PROFILES[actor.profile], CLASS_STATS[id]);
  return true;
}
/** What `actor` can switch between in this fight: their kit, as far as the party has it unlocked. */
export const kitIn = (state: BattleState, actor: Combatant) => (actor.kit ?? state.animas).filter(id => state.animas.includes(id));
/** Whether `actor` can put on `id` now: it is theirs to wear, and nobody else in the fight has it on. */
export function free(state: BattleState, actor: Combatant, id: ClassId) {
  return canWear(actor.id, id) && !state.allies.some(a => a !== actor && a.classId === id);
}
/** L (-1) and R (+1): the previous or next unlocked ánima `actor` can put on, round the list. Returns the new one. */
export function switchAnima(state: BattleState, step: -1 | 1): ClassId | undefined {
  const actor = state.allies[state.active];
  if (!actor) return;
  const list = kitIn(state, actor).filter(id => id === actor.classId || free(state, actor, id));
  if (!list.length) return;
  const index = list.indexOf(actor.classId!);
  const next = list[index < 0 ? (step > 0 ? 0 : list.length - 1) : (index + step + list.length) % list.length];
  return wearAnima(state, next) ? next : undefined;
}
/** Unlocked ánimas, starting from whatever the party already wears. */
const wornAnimas = (slots: PartySlot[]) => [...new Set(slots.flatMap(s => s.classId ? [s.classId] : []))];
/** The skills `actor` can use: their ánima's, as far as it has grown. */
export function skillsFor(state: BattleState, actor: Combatant) {
  return SKILLS.filter(skill => actor.classId === skill.class && (!('level' in skill) || (state.levels?.[skill.class] ?? 1) >= skill.level));
}
/** Rounds a party boost has left, this one included (0 when it is not running); without `skill`, the longest. */
export function boostRounds(state: BattleState, skill?: SkillId): number {
  if (!skill) return Math.max(0, ...Object.keys(state.boosts ?? {}).map(id => boostRounds(state, id as SkillId)));
  const boost = state.boosts?.[skill];
  return boost ? Math.max(0, boost.until - state.round + 1) : 0;
}
/** What a boost skill raises, in words ("Fuerza y Magia"). */
export function boostedStats(skill: SkillId) {
  const ability = SKILLS.find(s => s.id === skill);
  return statNames(ability && 'stats' in ability ? ability.stats : []);
}
const STAT_NAMES: Record<string, string> = { fuerza: 'Fuerza', magia: 'Magia', defensa: 'Defensa', espiritu: 'Espíritu', velocidad: 'Velocidad' };
/** A fighter's stats right now: the party boost adds to the allies' own, a debuff's mark takes from a foe's. */
function current(state: BattleState, c: Combatant, cut = true): Stats {
  let stats = c.stats;
  if (state.allies.includes(c)) for (const ability of SKILLS) {
    if (ability.kind !== 'boost' || !boostRounds(state, ability.id)) continue;
    const amount = state.boosts![ability.id]!.amount;
    stats = withBonus(stats, Object.fromEntries(ability.stats.map(stat => [stat, amount])));
  }
  for (const mark of Object.values(c.marks ?? {})) {
    if (mark && mark.until >= state.round) stats = withBonus(stats, Object.fromEntries(mark.stats.map(stat => [stat, -mark.amount])));
  }
  if (c.lasting) stats = withBonus(stats, c.lasting.shifts);
  for (const id of STATUS_IDS) {
    const stacks = c.statuses?.[id], spec = STATUSES[id];
    if (!stacks || !spec.stats) continue;
    stats = withBonus(stats, Object.fromEntries(Object.entries(spec.stats).map(([key, value]) => [key, value * stacks])));
  }
  // A share off, after everything else (Encogido: a quarter of whatever Defensa they have now), never below 1.
  if (cut) for (const id of TIMED_IDS) {
    const share = c.timed?.[id] && TIMED[id].cut;
    if (!share) continue;
    stats = { ...stats };
    for (const [stat, part] of Object.entries(share) as [keyof Stats, number][]) stats[stat] = Math.max(1, stats[stat] - Math.max(1, Math.round(stats[stat] * part)));
  }
  return stats;
}
/** Stats in the order the fight lists them. */
const STAT_ORDER = Object.keys(STAT_NAMES) as (keyof Stats)[];
/** A stat in three letters, where room is short (over a fighter's head). */
export const STAT_SHORT: Record<string, string> = { fuerza: 'FUE', magia: 'MAG', defensa: 'DEF', espiritu: 'ESP', velocidad: 'VEL' };
/**
 * One of a fighter's stats up or down right now, all its causes added up: a party boost, a status
 * that weakens (Mareo, Llorera, by its stacks), an onion with no layers left (its defence broken,
 * with no number). `rounds` is how long the longest of them still lasts, this round included.
 */
export interface StatShift { stat: keyof Stats; way: 'up' | 'down'; amount?: number; rounds?: number; from: string[] }
/** What raises and lowers `c`'s stats now, stat by stat; nothing on someone fallen. The fight shows it over them and in its summary. */
export function statShifts(state: BattleState, c: Combatant): StatShift[] {
  if (c.hp <= 0) return [];
  const sums = new Map<keyof Stats, { amount: number; rounds: number; from: string[]; broken?: boolean }>();
  const add = (stat: keyof Stats, amount: number, rounds: number, from: string) => {
    const sum = sums.get(stat) ?? { amount: 0, rounds: 0, from: [] };
    sum.amount += amount; sum.rounds = Math.max(sum.rounds, rounds); sum.from.push(from); sums.set(stat, sum);
  };
  if (state.allies.includes(c)) for (const ability of SKILLS) {
    if (ability.kind !== 'boost' || !boostRounds(state, ability.id)) continue;
    for (const stat of ability.stats) add(stat, state.boosts![ability.id]!.amount, boostRounds(state, ability.id), ability.name);
  }
  for (const [id, mark] of Object.entries(c.marks ?? {}) as [SkillId, NonNullable<Combatant['marks']>[SkillId]][]) {
    if (!mark || mark.until < state.round) continue;
    for (const stat of mark.stats) add(stat, -mark.amount, mark.until - state.round + 1, SKILLS.find(s => s.id === id)!.name);
  }
  // For good, so with no rounds (Vertitrón's Grito liberador).
  for (const [stat, amount] of Object.entries(c.lasting?.shifts ?? {}) as [keyof Stats, number][]) if (amount) add(stat, amount, 0, c.lasting!.from);
  for (const id of STATUS_IDS) {
    const count = stacks(c, id), spec = STATUSES[id];
    if (!count || !spec.stats) continue;
    for (const [stat, value] of Object.entries(spec.stats) as [keyof Stats, number][]) add(stat, value * count, Math.ceil(count / spec.decay), `${spec.name} ${count}`);
  }
  // What a timed status takes as a share (Encogido) lasts while its clock runs: no rounds to count, the points it takes now.
  if (TIMED_IDS.some(id => c.timed?.[id] && TIMED[id].cut)) {
    const whole = current(state, c, false), now = current(state, c);
    for (const id of TIMED_IDS) {
      const spec = TIMED[id];
      if (!c.timed?.[id] || !spec.cut) continue;
      for (const stat of Object.keys(spec.cut) as (keyof Stats)[]) add(stat, now[stat] - whole[stat], 0, spec.name);
    }
  }
  // The last layer off an onion breaks its defence (what `BattleEffect.stats` said when it came off).
  if (isOnion(c.kind) && c.layers === 0) { add('defensa', 0, 0, 'Sin capas'); sums.get('defensa')!.broken = true; }
  // Punto débil: open to the next blow (WEAK_SPOT times), shown as its guard down, with no number.
  if (weakSpotRounds(state, c)) { add('defensa', 0, weakSpotRounds(state, c), 'Punto débil'); sums.get('defensa')!.broken = true; }
  return STAT_ORDER.flatMap(stat => {
    const sum = sums.get(stat);
    if (!sum || (!sum.amount && !sum.broken)) return [];
    const way = sum.amount > 0 && !sum.broken ? 'up' as const : 'down' as const;
    return [{ stat, way, amount: sum.amount ? Math.abs(sum.amount) : undefined, rounds: sum.rounds || undefined, from: sum.from }];
  });
}
/** Stacks of `id` on `c` (0 when none). */
export const stacks = (c: Combatant, id: StatusId) => c.statuses?.[id] ?? 0;
/** Adds `count` stacks of `id`, up to its maximum; returns the stacks it ends with. */
export function addStatus(c: Combatant, id: StatusId, count = 1) {
  const next = Math.min(STATUSES[id].max, stacks(c, id) + count);
  c.statuses = { ...c.statuses, [id]: next };
  return next;
}
/** What happens to one fighter's statuses at the end of a round. */
export interface StatusTick { target: string; status: StatusId; amount: number; stacks: number }
export interface BattleEffect {
  kind: BattleAction | 'enemy'; actor: string; target?: string; amount?: number; skill?: SkillId; swallowed?: boolean; boosted?: string[]; status?: { id: StatusId; stacks: number };
  /** A cure: `amount` is the PV it gave back to `target`. */
  healed?: boolean;
  /** A timed status the hit lit or raised (Foc Binari's fire), and the level it is at now. */
  burn?: { id: TimedId; level: number };
  /** Maná Defender gave back. */
  charged?: number;
  /** Fire melted the palace minion's gum. */
  melted?: boolean;
  /** A skill of several little hits (Zarpazos), or one hit landed in parts (Foc Binari): the PV each one took, in order. `amount` is their sum. */
  strikes?: number[];
  /** Layers this blow took off an onion. */
  peeled?: number;
  /** A blow that reaches the others too (a big onion's weight): what it did to each. */
  splash?: { target: string; amount: number }[];
  /** Whose stats this action changed, and which (the last layer off an onion breaks its defence). */
  stats?: StatChange[];
  /** A skill that reaches every foe: what it did to each one (`target` is the first). */
  hits?: { target: string; amount: number; status?: { id: StatusId; stacks: number }; peeled?: number; bled?: number; weakSpot?: true; burn?: { id: TimedId; level: number } }[];
  /** Sangrado stacks a physical blow spent on its target, each one making it land harder (`woundScale`). */
  bled?: number;
  /** A dual attack: its two halves (by skill), who brought each, and the maná each one spent. */
  dual?: { id: DualId; name: string; parts: [SkillId, SkillId]; actors: [string, string]; spent: Record<string, number> };
  /** Per strike of a dual that may set fire (Zarpazos de fuego): 1 if it lit or raised it, 0 if not. */
  coins?: (0 | 1)[];
  /** Per strike: the level of fire it left (0 if none). */
  burns?: number[];
  /** A foe's ability (every foe action in the tower names one); `card` if it is not a plain blow. */
  ability?: { id: FoeAbilityId; name: string; card?: true };
  /** A move announced a turn ahead (the foe's `intent`): what, and at whom (an ally's id, or `at` in words). */
  telegraph?: { id: FoeAbilityId; name: string; target?: string; at?: Aim };
  /** A move announced before that this action called off (Rayo terrorífico, when the eye breaks). */
  cancelled?: FoeAbilityId;
  /** Vertitrón's eye broke: no more Rayo terrorífico. */
  eye?: 'broken';
  /** Matemágico's Atacar and Ángulo exacto: thrown, not punched (src/math-cast.ts). */
  spell?: true;
  /** Atacar carried an element: the little burst it lands with. It lights nothing of its own. */
  element?: Element;
  /** What that element turned on its target: Humo at the fire's `level`, Cauterizado's `stacks`, and the PV it took from whom. */
  reaction?: { id: ElementReaction; level?: number; stacks?: number; hits?: { target: string; amount: number }[] };
  /** Rayo de energía: the timed statuses it made last longer on its target, and by how many seconds. */
  extended?: { statuses: TimedId[]; seconds: number };
  /** Rayo de sanación: the cure over time it left on its target, at this level. */
  regen?: { id: TimedId; level: number };
  /** Explosión: Bip blew itself up; who it blinded until the round ends. */
  exploded?: boolean; blinded?: string[];
  /** A timed status a skill left on its target and nothing else (Confusión, Encogido). */
  afflicted?: { id: TimedId; level: number };
  /** A foe's own action while confused: it hit one of its own (or itself). */
  confused?: boolean;
  /** A dual that charges first (Rayo solar): who holds it until it goes off. */
  charging?: string;
  /** A charged dual going off as the round starts (Rayo solar): the news that shows it. */
  release?: { id: DualId; name: string };
  /** A cure for the whole party: what each one got back. */
  healedAll?: { target: string; amount: number }[];
  /** Statuses a cure took away, from whom. */
  cleansed?: { target: string; statuses: StatusId[] }[];
  /** A platito's new dish; a cebollita grew a layer; a fantasmita went see-through. */
  flipped?: DishId; regrown?: true; transparent?: string[];
  /**
   * Punto débil left on the target, or spent by this action (the blow landed WEAK_SPOT times as
   * hard), or `renewed`: both, a Punto débil on a foe that still had one. Read it with `markSpent`
   * and `markLeft`.
   */
  weakSpot?: 'set' | 'spent' | 'renewed';
}
/** Whether this action spent a Punto débil on its target (it landed WEAK_SPOT times as hard). */
export const markSpent = (e: BattleEffect) => e.weakSpot === 'spent' || e.weakSpot === 'renewed';
/** Whether this action left a Punto débil on its target. */
export const markLeft = (e: BattleEffect) => e.weakSpot === 'set' || e.weakSpot === 'renewed';
/**
 * A fighter's stats went up or down because of this action. Say so here and the fight shows it,
 * always the same way (src/stat-fx.ts): whatever changes stats fills in `BattleEffect.stats`.
 */
export interface StatChange { target: string; way: 'up' | 'down'; stats: (keyof Stats)[] }
/** What a status that weakens does to whoever it lands on. */
const weakened = (c: Combatant, id: StatusId): StatChange => ({ target: c.id, way: 'down', stats: Object.keys(STATUSES[id].stats ?? {}) as (keyof Stats)[] });
/** Stats in words ("Fuerza y Magia"). */
export function statNames(stats: readonly (keyof Stats)[]) {
  const names = stats.map(stat => STAT_NAMES[stat]);
  return names.length > 1 ? `${names.slice(0, -1).join(', ')} y ${names.at(-1)}` : names[0] ?? '';
}
/** Bridge the campaign's flat resources to the core; positive healing never revives. */
function changeHealth(target: Combatant, delta: number) {
  const result = adjustResource({ current: target.hp, max: target.maxHp }, delta, false);
  target.hp = result.resource.current;
  return Math.abs(result.amount);
}
/** Damage on a foe, from anything (a blow, a tick, a pulse). */
function hurt(_state: BattleState, c: Combatant, amount: number) {
  return changeHealth(c, -Math.max(0, Math.min(amount, c.hp)));
}
/** Rounds a Punto débil on `c` still lasts, this one included (0: none). */
export const weakSpotRounds = (state: BattleState, c: Combatant) => c.weakSpot !== undefined && c.weakSpot >= state.round && c.hp > 0 ? c.weakSpot - state.round + 1 : 0;
/** The action is validated before payment, just as it is in the generic command resolver. */
function spendSecondary(actor: Combatant, cost: number) {
  actor.secondary = adjustResource({ current: actor.secondary, max: actor.maxSecondary }, -cost).resource.current;
}
function fighter(slot: PartySlot, unlocked: readonly ClassId[] = []): Combatant {
  const stats = withBonus(withBonus(PROFILES[slot.profile], slot.classId ? CLASS_STATS[slot.classId] : undefined), slot.bonus);
  const points = slot.profile === 'bernat' ? 0 : MANA_POINTS;
  return { id: slot.id, name: slot.name, profile: slot.profile, classId: slot.classId, stats, hp: stats.pv, maxHp: stats.pv, secondary: slot.classId ? points : 0, maxSecondary: points, guarding: false, mana: {}, worn: slot.classId ? [slot.classId] : [], kit: kitOf(slot, unlocked) };
}
/** The fighter's maná goes with the ánima: the one taken off keeps what it had, the one put on brings its own, up to what it holds. */
function swapMana(state: BattleState, actor: Combatant, to: ClassId | undefined) {
  const pools = actor.mana ??= {};
  if (actor.classId) pools[actor.classId] = actor.secondary;
  actor.maxSecondary = manaMax(state.improved, to);
  actor.secondary = to ? pools[to] ?? actor.maxSecondary : 0;
  if (!to) return;
  delete pools[to];
  if (!(actor.worn ??= []).includes(to)) actor.worn.push(to);
}
function foe(id: string, name: string, kind: FoeKind, hp?: number): Combatant {
  const stats = { ...PROFILES[kind], ...(hp ? { pv: hp } : {}) };
  return { id, name, kind, profile: kind, stats, hp: stats.pv, maxHp: stats.pv, secondary: 0, maxSecondary: 0, guarding: false };
}
/** What Ecos de luz added comes into the fight as it starts: everyone wearing an ánima starts with all it now holds. */
export function improve(state: BattleState, improved: Improved | undefined) {
  state.improved = improved;
  for (const ally of state.allies) {
    if (!wearsAnimas(ally)) continue;
    ally.maxSecondary = manaMax(improved, ally.classId);
    if (ally.classId) ally.secondary = ally.maxSecondary;
  }
}
/** The elements `actor`'s Atacar can carry now: those the ánima worn has, in the order X walks through them. */
export function elementsFor(state: BattleState, actor: Combatant): Element[] {
  const have = actor.classId ? state.improved?.elements?.[actor.classId] : undefined;
  return have?.length ? ELEMENT_ORDER.filter(id => have.includes(id)) : [];
}
/** The element `actor`'s next Atacar carries, if any: the one chosen, while the ánima worn has it. */
export function attackElement(state: BattleState, actor: Combatant) {
  return actor.element && elementsFor(state, actor).includes(actor.element) ? actor.element : undefined;
}
/** X: the next element for `actor`'s Atacar, then none, and round again. Returns whether there is any to choose. */
export function cycleElement(state: BattleState, actor: Combatant) {
  const list = elementsFor(state, actor);
  if (!list.length) return false;
  actor.element = list[list.indexOf(attackElement(state, actor)!) + 1];
  return true;
}
/** A click on one of Atacar's segments: that element, or none. Returns whether it can be. */
export function chooseElement(state: BattleState, actor: Combatant, element: Element | undefined) {
  if (element && !elementsFor(state, actor).includes(element)) return false;
  actor.element = element;
  return true;
}
/** The party in turn order: the fastest acts first (a stable sort keeps ties in party order). */
function lineUp(party: PartySlot[], unlocked: readonly ClassId[]) {
  return party.map(slot => fighter(slot, unlocked)).sort((a, b) => b.stats.velocidad - a.stats.velocidad);
}
/** `party` is a size for chapter 1's boys (1 or 2), or the actual party. `animas` defaults to what they wear. */
export function createBattle(party: number | PartySlot[] = 1, foeCount = 1, possessed = false, gerardClassId?: ClassId, animas?: ClassId[]): BattleState {
  if (!Number.isInteger(foeCount) || foeCount < 1 || foeCount > 4) throw new Error('An encounter needs 1–4 foes');
  const slots = typeof party === 'number' ? childParty(party, gerardClassId) : party;
  if (!slots.length) throw new Error('A battle needs someone on the party\'s side');
  // Solo Gerard can clear a pack with focused attacks; a companion keeps full-strength foes.
  const foeHp = slots.length === 1 && foeCount > 1 ? 36 : 54;
  const unlocked = animas ?? wornAnimas(slots);
  return {
    allies: lineUp(slots, unlocked),
    foes: Array.from({ length: foeCount }, (_, i) => foe(`dog-${i}`, DOG_PROFILES[i].name, 'dog', foeHp)),
    active: 0, round: 1, phase: 'player', enemyActions: [], possessed, encounter: 'dogs',
    animas: unlocked, awakened: false,
    message: possessed ? `${foeCount === 1 ? 'Un perro con los ojos rosados se lanza' : `${foeCount} perros con los ojos rosados se lanzan`} a por vosotros. ¡No hay escapatoria!`
      : `${foeCount === 1 ? 'Un perro curioso te corta' : `${foeCount} perros curiosos te cortan`} el paso. Elige tu movimiento.`,
  };
}
/** The palace fight: Gerard and Bernat against one minion in a shell of gum. */
export function createMinionBattle(gerardClassId?: ClassId, animas?: ClassId[]): BattleState {
  const slots = childParty(2, gerardClassId);
  const unlocked = animas ?? wornAnimas(slots);
  return {
    allies: lineUp(slots, unlocked),
    foes: [{ ...foe('minion-0', 'Esbirro de la Reina', 'minion'), shell: true }],
    active: 0, round: 1, phase: 'player', enemyActions: [], possessed: false, encounter: 'palace-minion',
    animas: unlocked, awakened: unlocked.includes('matemagico'),
    message: 'Un esbirro de la Reina Bubbaloo sale del sumidero, brillante de pringue.',
  };
}
/**
 * The Guardianes de Chicle before the throne stair (docs/chapter-2.md): far too strong without
 * ánimas, one fewer every two ánimas, and softer and weaker with each one.
 */
export function palaceGuards(animas: number) {
  return { count: Math.max(1, 3 - Math.floor(animas / 2)), hp: Math.max(40, 220 - 30 * animas), power: Math.max(8, 30 - 3 * animas) };
}
export type GuardStrength = ReturnType<typeof palaceGuards>;
/**
 * Chapter 2: the party against the palace guards, as strong as the party's ánimas leave them.
 * `night-guard`: they are loose on the Meridiana at night (src/night.ts); the one that catches the
 * party brings the others, as many and as strong as the palace has now, so the way home says
 * honestly how ready the party is for her.
 */
export function createGuardBattle(party: PartySlot[], guards: GuardStrength, animas?: ClassId[], encounter: 'palace-guards' | 'night-guard' = 'palace-guards'): BattleState {
  const unlocked = animas ?? wornAnimas(party);
  const count = guards.count;
  return {
    allies: lineUp(party, unlocked),
    foes: Array.from({ length: count }, (_, i) => ({ ...foe(`guard-${i}`, count > 1 ? `Guardián de chicle ${i + 1}` : 'Guardián de chicle', 'guardian', guards.hp), power: guards.power })),
    active: 0, round: 1, phase: 'player', enemyActions: [], possessed: false, encounter,
    animas: unlocked, awakened: unlocked.includes('matemagico'),
    message: encounter === 'night-guard' ? count > 1 ? `${count} guardianes de chicle os rodean, chorreando de las rejillas.` : 'Un guardián de chicle os corta el paso, chorreando de la rejilla.'
      : count > 1 ? `${count} guardianes de chicle se despegan de la cortina. Son enormes.` : 'Un guardián de chicle se despega de la cortina.',
  };
}
/** Uri's fears, one foe each (ring 3's comes with company: `createFearBattle`). `power` is tunable (book `fear`). */
export const FEAR_FOES = {
  cebollon: { id: 'cebollon', name: 'El Cebollón', kind: 'cebollon' as const, power: ONIONS.cebollon.power, message: 'El contenedor salta. Dentro hay una cebolla enorme, capa sobre capa. Ya pica en los ojos.' },
  cebolla: { id: 'cebolla', name: 'La Cebolla', kind: 'cebolla' as const, power: ONIONS.cebolla.power, message: 'Una cebolla grande os corta el paso. Cuantas más capas le quedan, más pesa.' },
  plato: { id: 'plato', name: 'El Plato Misterioso', kind: 'plato' as const, power: 28, message: 'La campana tiembla sobre el plato. Algo dentro se mueve.' },
  escolta: { id: 'cebolla', name: 'La Cebolla', kind: 'cebolla' as const, power: ONIONS.cebolla.power, message: 'La Cebolla sube por la rampa, y no viene sola: un fantasmita y una cebollita le abren paso.' },
  'uri-vertigo': { id: 'vertigo', name: 'Vertitrón', kind: 'vertigo' as const, power: 10, message: 'Del borde del tejado se levanta un robot de escaleras y tejas, con un ojo en el pecho que no para de girar. Arriba, Uri, con Nil en brazos.' },
};
/**
 * The fears' young (docs/quests/nuria.md § The tower): small and quick, they hit hard, and each kind
 * asks for its own answer. A Cebollita is an onion at its smallest (ONIONS), the easy one: a layer or
 * two, and while it has any its blow makes its target cry (Llorera). A Platito has its own dish for good, weak to blows or to magic:
 * read it and choose. A Fantasmita counts down on its turns and at zero «GAME OVER» hits everyone:
 * finish it first, or hold on (Defender) that turn.
 */
export const BROOD = {
  // Tuned for Gerard and Aitor with level 1 ánimas: a pack takes about two thirds of the party's PV
  // and sometimes wins (it is the first dungeon, and they come back).
  cebollita: { name: 'Cebollita', power: ONIONS.cebollita.power },
  platito: { name: 'Platito', power: 25 },
  fantasmita: { name: 'Fantasmita', power: 23, countdown: 3, gameOver: 34 },
} as const satisfies Record<BroodKind, { name: string; power: number; countdown?: number; gameOver?: number }>;
/** Which young come out on each ring: its own first, then those of the rings below, mixed at random. */
export const BROOD_RINGS: Record<BroodEncounter, readonly BroodKind[]> = {
  'crias-1': ['cebollita'], 'crias-2': ['platito', 'cebollita'], 'crias-3': ['fantasmita', 'platito', 'cebollita'],
};
const BROOD_WORDS: Record<BroodKind, [string, string, string]> = { cebollita: ['una', 'cebollita', 'cebollitas'], platito: ['un', 'platito', 'platitos'], fantasmita: ['un', 'fantasmita', 'fantasmitas'] };
/** One of the fears' young, as it comes into a fight. */
function young(kind: BroodKind, id: string, name: string, random: () => number, closer = false): Combatant {
  const one: Combatant = { ...foe(id, name, kind), power: BROOD[kind].power };
  if (kind === 'cebollita') one.layers = random() < .5 ? 1 : ONIONS.cebollita.layers;
  // Never the surprise dish: a platito always has a weakness to find.
  if (kind === 'platito') one.dish = random() < .5 ? 'alcachofa' : 'coliflor';
  // Not all in step: one may be a turn closer to its «GAME OVER».
  if (kind === 'fantasmita') one.countdown = BROOD.fantasmita.countdown - (closer && random() < .5 ? 1 : 0);
  return one;
}
/** A big onion that comes with its own: `layers` on, its run-up from its own turn `rushFirst`. */
function bigOnion(layers: number, rushFirst?: number): Combatant {
  const spec = FEAR_FOES.cebolla;
  return { ...foe(spec.id, spec.name, spec.kind), power: spec.power, layers, ...rushFirst ? { rushFirst } : {} };
}
/** The fight's dice, seeded from the `random` it was created with. */
const seedFrom = (random: () => number) => Math.floor(random() * 2 ** 32) >>> 0;
/**
 * A pack of young for a ring: two or three, at least one of the ring's own, the rest at random. On
 * ring 3, now and then (`FEAR_RULES.mixChance`) La Cebolla comes up with them, half peeled
 * (`mixLayers`), and one or two young.
 */
export function createBroodBattle(party: PartySlot[], encounter: BroodEncounter, animas?: ClassId[], random: () => number = Math.random): BattleState {
  const kinds = BROOD_RINGS[encounter];
  const mixed = encounter === 'crias-3' && random() < FEAR_RULES.mixChance;
  const size = mixed ? 1 + (random() < .5 ? 1 : 0) : encounter === 'crias-1' ? 2 + (random() < .4 ? 1 : 0) : 2 + (random() < .6 ? 1 : 0);
  const pick = [kinds[0], ...Array.from({ length: size - 1 }, () => kinds[Math.floor(random() * kinds.length)])].sort((a, b) => kinds.indexOf(a) - kinds.indexOf(b));
  const count = (kind: BroodKind) => pick.filter(k => k === kind).length;
  const seen: Partial<Record<BroodKind, number>> = {};
  const foes = pick.map((kind, i) => {
    const n = seen[kind] = (seen[kind] ?? 0) + 1;
    return young(kind, `${kind}-${i}`, count(kind) > 1 ? `${BROOD[kind].name} ${n}` : BROOD[kind].name, random, n > 1);
  });
  const said = (Object.keys(BROOD_WORDS) as BroodKind[]).filter(count).map(kind => `${count(kind) === 1 ? BROOD_WORDS[kind][0] : count(kind) === 2 ? 'dos' : 'tres'} ${BROOD_WORDS[kind][count(kind) === 1 ? 1 : 2]}`);
  const list = said.length > 1 ? `${said.slice(0, -1).join(', ')} y ${said.at(-1)}` : said[0];
  const unlocked = animas ?? wornAnimas(party);
  return {
    allies: lineUp(party, unlocked), foes: mixed ? [bigOnion(FEAR_RULES.mixLayers), ...foes] : foes,
    active: 0, round: 1, phase: 'player', enemyActions: [], possessed: false, encounter,
    animas: unlocked, awakened: unlocked.includes('matemagico'), seed: seedFrom(random),
    message: mixed ? `La Cebolla sube a medio pelar, y con ella ${list}. Esta vez no vienen solos.` : `Os cortan el paso ${list}. Pequeños, pero no vienen a jugar.`,
  };
}
/** Uri's fears (docs/quests/nuria.md): one foe each, with its own rule; their young come in packs. */
export function createFearBattle(party: PartySlot[], encounter: (typeof FEAR_ENCOUNTERS)[number], animas?: ClassId[], random: () => number = Math.random): BattleState {
  if ((BROOD_ENCOUNTERS as readonly string[]).includes(encounter)) return createBroodBattle(party, encounter as BroodEncounter, animas, random);
  const spec = FEAR_FOES[encounter as keyof typeof FEAR_FOES];
  const one: Combatant = { ...foe(spec.id, spec.name, spec.kind), power: spec.power };
  if (isOnion(spec.kind)) one.layers = ONIONS[spec.kind].layers;
  if (encounter === 'plato') one.dish = DISH_ORDER[0];
  // Ring 3's fear: La Cebolla half peeled, a fantasmita and a cebollita clearing the way for it.
  const foes = encounter === 'escolta' ? [
    bigOnion(FEAR_RULES.escortLayers, FEAR_RULES.escortAplastonFirst),
    young('fantasmita', 'fantasmita-1', BROOD.fantasmita.name, random),
    { ...young('cebollita', 'cebollita-2', BROOD.cebollita.name, random), layers: 1 },
  ] : encounter === 'uri-vertigo' ? [one, spiralEye()] : [one];
  const unlocked = animas ?? wornAnimas(party);
  return {
    allies: lineUp(party, unlocked), foes,
    active: 0, round: 1, phase: 'player', enemyActions: [], possessed: false, encounter,
    animas: unlocked, awakened: unlocked.includes('matemagico'), seed: seedFrom(random),
    message: encounter === 'plato' ? `${spec.message} Levanta la campana: ¡es ${DISHES[one.dish!].name}!` : spec.message,
  };
}
/** The mental statuses `c` carries (what a calming cure takes away). */
const cleansable = (c: Combatant) => MENTAL_STATUSES.filter(id => stacks(c, id) > 0);
/** Rounds a debuff's mark (`skill`) still lasts on `c`, this one included (0: none). */
export function markRounds(state: BattleState, c: Combatant, skill: SkillId) {
  const mark = c.marks?.[skill];
  return mark && mark.until >= state.round ? mark.until - state.round + 1 : 0;
}
/** Who an action can be aimed at. A party skill is not aimed: these are who it would reach. */
export function validTargets(state: BattleState, action: BattleAction, skill: SkillId = 'foc-binari'): Combatant[] {
  if (action === 'attack') return state.foes.filter(f => f.hp > 0);
  if (action !== 'skill') return [];
  const ability = SKILLS.find(s => s.id === skill);
  if (!ability) return [];
  // A cure for everyone is worth it while someone standing is hurt, or carries a status it takes away.
  if (state.unbound && (ability.kind === 'heal' || ability.kind === 'boost')) return state.allies.filter(a => a.hp > 0);
  if (state.unbound && ability.kind === 'debuff') return state.foes.filter(f => f.hp > 0);
  if (ability.kind === 'heal' && ability.side === 'party') return state.allies.filter(a => a.hp > 0 && (a.hp < a.maxHp || ('cleanse' in ability && cleansable(a).length > 0)));
  // A cure only reaches someone hurt and still standing: it never gets anyone back up.
  if (ability.kind === 'heal') return state.allies.filter(a => a.hp > 0 && a.hp < a.maxHp);
  // A boost already running has nothing to add until it wears off.
  if (ability.kind === 'boost') return boostRounds(state, ability.id) ? [] : state.allies.filter(a => a.hp > 0);
  // Nor a debuff on a foe that still carries its mark.
  if (ability.kind === 'debuff') return state.foes.filter(f => f.hp > 0 && !markRounds(state, f, ability.id));
  return state.foes.filter(f => f.hp > 0);
}
/** Whether a skill needs a target picked, or simply happens (Yuki se esconde reaches the whole party, Las dos a la vez every foe). */
export const aimed = (skill: SkillId) => { const side = SKILLS.find(s => s.id === skill)?.side; return side !== 'party' && side !== 'all-foes'; };
/** What `skill` (or a plain attack) does to `target` before it is clamped to what is left. */
function strike(state: BattleState, actor: Combatant, target: Combatant, skill?: Skill) {
  const stats = current(state, actor), guard = current(state, target);
  if (!skill) return physical(18, stats, guard);
  return skill.kind === 'magic' ? magical(skill.power, stats, guard) : physical(skill.power, stats, guard);
}
/**
 * Sangrado is an open wound: the next physical blow on someone bleeding (Atacar or a physical
 * skill, every claw of it) lands this much harder for each stack, and spends them all. A skill
 * that adds Sangrado spends the old first. Zarpa en la llaga (`deep`) opens it twice as far.
 */
export const BLEED_BONUS = .2;
/** How much harder a blow lands for `bled` stacks of Sangrado (×, 1 for none). */
export const woundScale = (bled: number, skill?: SkillId) => 1 + bled * BLEED_BONUS * (skill && SKILLS.find(s => s.id === skill && 'deep' in s) ? 2 : 1);
/** The stacks a blow spends on `target` and how much harder it lands for them: only a physical blow opens the wound. */
function wound(target: Combatant, physicalBlow: boolean, skill?: SkillId) {
  const bled = physicalBlow ? stacks(target, 'sangrado') : 0;
  return { bled, scale: woundScale(bled, skill) };
}
/** What kind of blow lands: a dual counts as every kind against a foe's kind-based rules. */
type Blow = 'physical' | 'magic' | 'dual';
/**
 * What a fear's own rule does to a hit that lands on it: the dish's weakness (the surprise dish lets
 * single blows in at half, a dual whole), the onion's layers, a fantasmita gone see-through.
 */
function fearDamage(_state: BattleState, target: Combatant, damage: number, blow: Blow) {
  let out = damage;
  if (target.dish) {
    const dish = DISHES[target.dish];
    out *= blow === 'dual' ? Math.max(dish.physical, dish.magic) : dish[blow];
    if (target.dish === 'sorpresa') out *= blow === 'dual' ? FEAR_RULES.sorpresaDual : FEAR_RULES.sorpresaSingle;
  }
  if (target.layers) out /= 2;
  if (target.transparent && blow === 'physical') out *= FEAR_RULES.transparent;
  return Math.max(1, Math.round(out));
}
/** What the fight says when the last foe falls. */
function winMessage(state: BattleState) {
  return state.encounter === 'cebollon' ? 'El Cebollón se queda sin capas. Debajo no había nada. Ya no pica.'
    : state.encounter === 'cebolla' ? 'La cebolla, ya del tamaño de un puño, rueda hasta el borde y cae. Se os pasa el picor.'
    : state.encounter === 'plato' ? 'La campana cae al suelo. El plato, vacío. Uri, a lo lejos: «¡Puaj!».'
    : state.encounter === 'escolta' ? 'La Cebolla rueda hasta el borde y se lleva a los suyos. Arriba, Uri ya no se ríe.'
    : state.encounter === 'uri-vertigo' ? 'Vertitrón cae de rodillas. Uri baja con Nil en brazos, y el violeta se le va de los ojos.'
    : (BROOD_ENCOUNTERS as readonly string[]).includes(state.encounter) ? 'Se deshacen en humo violeta. Desde arriba, la risa de Uri. Volverán.'
    : state.encounter === 'palace-minion' ? 'El esbirro se queda tieso, se agrieta como chicle viejo… y revienta.'
    : state.encounter === 'palace-guards' ? 'Los guardianes se deshacen en charcos rosas. La cortina tiembla.'
    : state.encounter === 'night-guard' ? 'El guardián se deshace en un charco rosa sobre las baldosas.'
    : state.possessed ? `El rosa se les va de los ojos. ${state.foes.length === 1 ? 'El perro sale corriendo' : 'Los perros salen corriendo'}, con el rabo entre las patas.`
    : `${state.foes.length === 1 ? 'El perro se tranquiliza' : 'Los perros se tranquilizan'}. ¡Camino despejado!`;
}
/** The ánima `actor` wears takes part in the fight: a win teaches it (src/levels.ts). */
function took(state: BattleState, actor: Combatant) {
  if (!actor.classId) return;
  const who = (state.fought ??= {})[actor.classId] ??= [];
  if (!who.includes(actor.id)) who.push(actor.id);
}
/** Every foe down: a part (Vertitrón's eye) never holds up the win. */
const beaten = (state: BattleState) => state.foes.every(f => f.hp <= 0 || f.part);
/** A fight over: nothing queued or spent is left behind. */
function endFight(state: BattleState) { delete state.queued; delete state.spent; }
/** After an action: the fight is won, or the next ally still to act (a dual's partner has already) chooses, or the foes' turn comes. */
function settle(state: BattleState) {
  if (beaten(state)) { state.phase = 'won'; state.message = winMessage(state); endFight(state); return; }
  const next = state.allies.findIndex((a, i) => i > state.active && a.hp > 0 && !state.spent?.includes(a.id));
  if (next >= 0) state.active = next;
  else { state.phase = 'enemy'; delete state.queued; }
}
/** An onion out of layers: a cebollita will wrap itself in a new one, once (its intent shows it, «Pelada»). */
function bare(c: Combatant) {
  if (c.kind === 'cebollita' && !c.regrown && c.hp > 0) c.intent = { ability: 'capa-nueva' };
}
/** Punto débil on `c` now: how many times as hard the next damaging action lands (1: none). */
const weakScale = (state: BattleState, c: Combatant) => weakSpotRounds(state, c) ? WEAK_SPOT : 1;
/** An element has landed on `target` with Atacar: what it turns (`REACTION_RULES`), if it finds anything to turn. */
function react(state: BattleState, actor: Combatant, target: Combatant, element: Element, effect: BattleEffect) {
  const fire = target.timed?.quemado, bleeding = stacks(target, 'sangrado');
  if (element === 'agua' && fire) {
    const { quemado: _out, ...rest } = target.timed!;
    target.timed = { ...rest, cegado: { level: fire.level, left: TIMED.cegado.seconds, next: TIMED.cegado.every } };
    effect.reaction = { id: 'humo', level: fire.level };
    state.message += ` ¡El agua apaga el fuego! ${TIMED.cegado.name} ${roman(fire.level)}.`;
  } else if (element === 'fuego' && bleeding) {
    delete target.statuses!.sangrado;
    const amount = hurt(state, target, bleeding * REACTION_RULES.cauterize);
    effect.reaction = { id: 'cauterizado', stacks: bleeding, hits: [{ target: target.id, amount }] };
    state.message += ` ¡Cauteriza la herida! −${amount} PV.`;
  } else if (element === 'electrico' && target.timed?.cegado) {
    const hits = state.foes.filter(f => f.hp > 0 && f.timed?.cegado).map(f => {
      delete f.timed!.cegado;
      return { target: f.id, amount: hurt(state, f, fearDamage(state, f, magical(REACTION_RULES.storm, current(state, actor), current(state, f)), 'magic')) };
    });
    effect.reaction = { id: 'tormenta', hits };
    state.message += ` ¡La descarga salta por el humo! ${hits.map(h => `−${h.amount}`).join(', ')} PV.`;
  }
}
export function act(state: BattleState, action: BattleAction, targetId?: string, skill?: SkillId): BattleEffect | undefined {
  if (state.phase !== 'player') return;
  const actor = state.allies[state.active];
  if (!actor || actor.hp <= 0) return;
  const ability = SKILLS.find(s => s.id === skill);
  const targets = validTargets(state, action, skill);
  const party = action === 'skill' && ability?.side === 'party';
  const everyone = action === 'skill' && ability?.side === 'all-foes';
  const target = party ? undefined : everyone ? targets[0] : targets.find(f => f.id === targetId);
  if ((action === 'attack' || action === 'skill') && !target && !(party && targets.length)) return;
  if (action === 'skill' && (!ability || actor.secondary < ability.cost || !skillsFor(state, actor).includes(ability))) return;
  const effect: BattleEffect = { actor: actor.id, kind: action };
  if (action === 'escape' && cornered(state)) return;
  if (action !== 'escape') took(state, actor);
  if (action === 'escape') {
    state.phase = 'escaped'; endFight(state);
    state.message = state.encounter === 'palace-guards' ? 'Retrocedéis hasta el vestíbulo. Los guardianes vuelven a pegarse a la cortina.'
      : state.encounter === 'night-guard' ? 'Echáis a correr. El guardián se queda un momento pegado a la acera.' : 'Te alejas con calma. La aventura sigue.';
    return effect;
  }
  if (action === 'defend') {
    actor.guarding = true;
    // Holding still gathers maná back into the ánima worn.
    effect.charged = adjustResource({ current: actor.secondary, max: actor.maxSecondary }, DEFEND_CHARGE).amount;
    actor.secondary += effect.charged;
    state.message = `${actor.name} se prepara para el siguiente golpe.${effect.charged ? ` Maná +${effect.charged}.` : ''}`;
  } else if (party && ability!.kind === 'heal') {
    // Ronroneo de Yuki: a cure for everyone standing, and it takes away the statuses it calms.
    spendSecondary(actor, ability!.cost); effect.skill = skill; effect.target = actor.id; effect.healed = true;
    const amount = healing(ability!.power, current(state, actor)), standing = state.allies.filter(a => a.hp > 0);
    effect.healedAll = standing.map(ally => ({ target: ally.id, amount: changeHealth(ally, amount) }));
    effect.amount = effect.healedAll.find(h => h.target === actor.id)?.amount ?? 0;
    if ('cleanse' in ability!) {
      const cleansed = standing.flatMap(ally => {
        const gone = cleansable(ally);
        for (const id of gone) delete ally.statuses![id];
        return gone.length ? [{ target: ally.id, statuses: gone }] : [];
      });
      if (cleansed.length) {
        effect.cleansed = cleansed;
        effect.stats = cleansed.map(c => ({ target: c.target, way: 'up' as const, stats: [...new Set(c.statuses.flatMap(id => Object.keys(STATUSES[id].stats ?? {}) as (keyof Stats)[]))] }));
      }
    }
    state.message = `${actor.name} usa ${ability!.name}. +${amount} PV para el equipo.${effect.cleansed ? ' Se les pasan los efectos de estado mentales.' : ''}`;
  } else if (party && ability!.kind === 'boost') {
    spendSecondary(actor, ability!.cost); effect.skill = skill; effect.target = actor.id;
    state.boosts = { ...state.boosts, [ability!.id]: { amount: ability!.power, until: state.round + BOOST_ROUNDS - 1 } };
    effect.boosted = targets.map(ally => ally.id);
    effect.stats = targets.map(ally => ({ target: ally.id, way: 'up' as const, stats: [...ability!.stats] }));
    state.message = `${actor.name} usa ${ability!.name}. ${boostedStats(ability!.id)} +${ability!.power} para el equipo durante ${BOOST_ROUNDS} rondas.`;
  } else if (ability?.kind === 'heal' && target && 'regen' in ability) {
    // Rayo de sanación: the cure comes bit by bit on the fight's clock; again while it lasts, a level up.
    spendSecondary(actor, ability.cost); effect.skill = skill; effect.target = target.id;
    const on = inflict(target, ability.regen);
    effect.regen = { id: ability.regen, level: on.level };
    state.message = `${actor.name} usa ${ability.name}${target === actor ? '' : ` con ${target.name}`}. ¡${TIMED[ability.regen].name}${on.level > 1 ? ` ${roman(on.level)}` : ''}!`;
  } else if (ability?.kind === 'heal' && target) {
    // Cardioide: a curve of light under a friend gives back PV, more with Magia.
    spendSecondary(actor, ability.cost); effect.skill = skill; effect.target = target.id; effect.healed = true;
    effect.amount = changeHealth(target, healing(ability.power, current(state, actor)));
    state.message = `${actor.name} usa ${ability.name}${target === actor ? '' : ` con ${target.name}`}. +${effect.amount} PV.`;
  } else if (ability && 'shrink' in ability && target) {
    // Rayo encogedor: smaller and much easier to hurt for a while; again, its clock starts over.
    spendSecondary(actor, ability.cost); effect.skill = skill; effect.target = target.id; effect.afflicted = { id: 'encogido', level: 1 };
    target.timed = { ...target.timed, encogido: { level: 1, left: TIMED.encogido.seconds, next: TIMED.encogido.every } };
    effect.stats = [{ target: target.id, way: 'down', stats: ['defensa'] }];
    state.message = `${actor.name} usa ${ability.name} contra ${target.name}. ¡Se encoge! ${statNames(['defensa'])} −${Math.round((TIMED.encogido.cut!.defensa ?? 0) * 100)} % durante ${TIMED.encogido.seconds} s.`;
  } else if (ability && 'confuse' in ability && target) {
    // Confusión: for a while it does not know whose side it is on (`enemyAct`); again, its clock starts over.
    spendSecondary(actor, ability.cost); effect.skill = skill; effect.target = target.id; effect.afflicted = { id: 'confusion', level: 1 };
    target.timed = { ...target.timed, confusion: { level: 1, left: TIMED.confusion.seconds, next: TIMED.confusion.every } };
    state.message = `${actor.name} usa ${ability.name} contra ${target.name}. ¡No sabe de qué lado está!`;
  } else if (ability?.kind === 'debuff' && target) {
    // Ángulo exacto: a mark on the foe, its stats down for a few rounds (every hit on it lands harder).
    spendSecondary(actor, ability.cost); effect.skill = skill; effect.target = target.id; effect.spell = true;
    target.marks = { ...target.marks, [ability.id]: { amount: ability.power, stats: [...ability.stats], until: state.round + BOOST_ROUNDS - 1 } };
    effect.stats = [{ target: target.id, way: 'down', stats: [...ability.stats] }];
    state.message = `${actor.name} usa ${ability.name} contra ${target.name}. ${statNames(ability.stats)} −${ability.power} durante ${BOOST_ROUNDS} rondas.`;
  } else if (everyone) {
    // Las dos a la vez: Haru and Yuki go for every foe at once.
    spendSecondary(actor, ability!.cost); effect.skill = skill; effect.target = target!.id;
    const blow: Blow = ability!.kind === 'physical' ? 'physical' : 'magic';
    effect.hits = targets.map(foe => {
      const { bled, scale } = wound(foe, blow === 'physical', skill), weak = weakScale(state, foe);
      const amount = hurt(state, foe, fearDamage(state, foe, strike(state, actor, foe, ability) * scale * weak, blow));
      if (bled) delete foe.statuses!.sangrado;
      // Only an action that takes PV off spends the mark (one the floor swallows leaves it).
      const spends = weak > 1 && amount > 0;
      if (spends) { delete foe.weakSpot; effect.weakSpot = 'spent'; }
      const peeled = foe.layers ? 1 : undefined;
      if (foe.layers && !--foe.layers) bare(foe);
      const status = 'bleed' in ability! && foe.hp > 0 ? { id: 'sangrado' as const, stacks: addStatus(foe, 'sangrado', ability.bleed) } : undefined;
      // Fire melts the pringue (Explosión).
      if ('melts' in ability! && foe.shell) { foe.shell = false; effect.melted = true; }
      return { target: foe.id, amount, status, peeled, ...bled ? { bled } : {}, ...spends ? { weakSpot: true as const } : {} };
    });
    // Explosión: the flash blinds whoever is still standing until the round is over (a longer smoke stays as it is).
    if ('blind' in ability!) {
      effect.exploded = true;
      effect.blinded = targets.filter(foe => foe.hp > 0).map(foe => {
        const on = foe.timed?.cegado;
        if (!on || on.until !== undefined) foe.timed = { ...foe.timed, cegado: { level: Math.max(1, on?.level ?? 0), left: TIMED.cegado.seconds, next: TIMED.cegado.every, until: state.round } };
        return foe.id;
      });
    }
    // …and Bip has to put itself back together: its wearer sits the next round out.
    if ('spends' in ability!) actor.out = state.round + 1;
    effect.amount = effect.hits[0]?.amount;
    // The last layer off breaks an onion's defence.
    const broken = effect.hits.filter(h => h.peeled && !targets.find(foe => foe.id === h.target)?.layers && targets.find(foe => foe.id === h.target)!.hp > 0);
    if (broken.length) effect.stats = broken.map(h => ({ target: h.target, way: 'down' as const, stats: ['defensa' as const] }));
    state.message = `${actor.name} usa ${ability!.name}. ${effect.hits.length === 1 ? `−${effect.amount} PV.` : `Todos reciben: ${effect.hits.map(h => `−${h.amount}`).join(', ')} PV.`}`;
    if (effect.weakSpot) state.message += ' ¡Punto débil: el triple de daño!';
    if (effect.blinded?.length) state.message += ' ¡Cegados hasta que acabe la ronda!';
    if (actor.out !== undefined && actor.out > state.round) state.message += ` ${actor.name} pierde su siguiente turno.`;
  } else if (target) {
    if (action === 'skill') { spendSecondary(actor, ability!.cost); effect.skill = skill; }
    effect.target = target.id;
    if (action === 'attack' && actor.classId === 'matemagico') effect.spell = true;
    const melts = action === 'skill' && !!ability && 'melts' in ability;
    if (target.shell && !melts) {
      // The gum swallows the blow whole.
      effect.amount = 0; effect.swallowed = true;
      state.message = `${actor.name} golpea a ${target.name}… y el chicle se lo traga. Ni un rasguño.`;
    } else {
      if (melts && target.shell) { target.shell = false; effect.melted = true; }
      // Each hit is measured on its own, since the layers it finds change the next one's weight.
      // A physical blow on someone bleeding opens the wound: every claw of it lands harder.
      const times = action === 'skill' && ability && 'strikes' in ability ? ability.strikes : 1, layered = target.layers ?? 0, strikes: number[] = [];
      const magic = action === 'skill' && ability!.kind === 'magic';
      // The element Atacar carries; fire seals a wound instead of opening it (`react`).
      const element = action === 'attack' ? attackElement(state, actor) : undefined;
      if (element) effect.element = element;
      const { bled, scale } = wound(target, !magic && element !== 'fuego', action === 'skill' ? skill : undefined), weak = weakScale(state, target);
      for (let i = 0; i < times && target.hp > 0; i++) {
        strikes.push(hurt(state, target, fearDamage(state, target, strike(state, actor, target, action === 'skill' ? ability : undefined) * scale * weak, magic ? 'magic' : 'physical')));
        if (target.layers && !--target.layers) bare(target);
      }
      if (bled) { delete target.statuses!.sangrado; effect.bled = bled; }
      effect.amount = strikes.reduce((sum, amount) => sum + amount, 0);
      const spent = weak > 1 && effect.amount > 0;
      if (spent) { delete target.weakSpot; effect.weakSpot = 'spent'; }
      // One hit's damage landed in parts (Foc Binari's zero, then its one): the same total, felt twice.
      if (action === 'skill' && ability && 'split' in ability && strikes.length === 1 && strikes[0] > 1) strikes.splice(0, 1, Math.floor(strikes[0] / 2), Math.ceil(strikes[0] / 2));
      if (times > 1 || strikes.length > 1) effect.strikes = strikes;
      const peeled = layered - (target.layers ?? 0);
      if (peeled) effect.peeled = peeled;
      const name = action !== 'skill' ? 'Atacar' : ability!.name;
      state.message = effect.melted ? `${actor.name} usa ${name}. El pringue se derrite. −${effect.amount} PV.` : `${actor.name} usa ${name} contra ${target.name}. −${effect.amount} PV.`;
      if (spent) state.message += ' ¡Punto débil: el triple de daño!';
      if (peeled && !target.layers && target.hp > 0) effect.stats = [{ target: target.id, way: 'down', stats: ['defensa'] }];
      if (peeled) state.message += !target.layers ? ' ¡Sin capas!' : peeled > 1 ? ` ${peeled} capas menos: quedan ${target.layers}.` : ` Una capa menos: quedan ${target.layers}.`;
      if (bled) state.message += ` La herida se abre: +${Math.round((scale - 1) * 100)} %.`;
      if (action === 'skill' && ability && 'bleed' in ability && target.hp > 0) {
        effect.status = { id: 'sangrado', stacks: addStatus(target, 'sangrado', ability.bleed) };
        state.message += ` Sangrado ${effect.status.stacks}.`;
      }
      // Foc Binari sets them on fire; on someone already burning, the fire goes up a level. An onion's wet layers do not catch.
      if (action === 'skill' && ability && 'burn' in ability && target.hp > 0 && target.layers) state.message += ' Las capas, húmedas, no prenden.';
      else if (action === 'skill' && ability && 'burn' in ability && target.hp > 0) {
        const fire = inflict(target, ability.burn);
        effect.burn = { id: ability.burn, level: fire.level };
        state.message += fire.level > 1 ? ` ¡El fuego sube: ${TIMED[ability.burn].name} ${roman(fire.level)}!` : ' ¡Se quema!';
      }
      // Rayo de energía: whatever is running out on them by the clock (never a cure) lasts longer.
      if (action === 'skill' && ability && 'extend' in ability && target.hp > 0) {
        const longer = TIMED_IDS.filter(id => !TIMED[id].heal && target.timed?.[id]);
        for (const id of longer) target.timed![id]!.left += ability.extend;
        if (longer.length) {
          effect.extended = { statuses: longer, seconds: ability.extend };
          state.message += ` ${longer.map(id => TIMED[id].name).join(' y ')}: ${ability.extend} s más.`;
        }
      }
      if (element && target.hp > 0) react(state, actor, target, element, effect);
    }
  }
  checkEye(state, effect);
  settle(state);
  return effect;
}
/** Whether `skill` is learned at the levels the fight has (wearing it aside). */
function learned(state: BattleState, skill: SkillId) {
  const spec = SKILLS.find(s => s.id === skill)!;
  return (state.levels?.[spec.class] ?? 1) >= ('level' in spec ? spec.level : 1);
}
/** Which half each one brings, `a`'s first: each wears the ánima of their half. */
function halvesOf(d: DualSpec, a: Combatant, b: Combatant): [SkillId, SkillId] | undefined {
  const owner = (id: SkillId) => SKILLS.find(s => s.id === id)!.class;
  const [x, y] = d.parts;
  if (a.classId === owner(x) && b.classId === owner(y)) return [x, y];
  if (a.classId === owner(y) && b.classId === owner(x)) return [y, x];
}
/** Why a dual cannot happen now (`DualBlock`), or nothing when it can. */
export type DualBlock = 'level' | 'used' | 'wear' | 'down' | 'acted' | 'mana' | 'target';
/**
 * What stops `d` between `a` (the active fighter) and `b`: a half not learned yet, `d` already
 * played this fight (once each), someone not wearing the ánima of their half, `b` fallen, `b`
 * already through this round (or before `a` in it: only the earlier fighter completes a dual), the
 * maná of a half, or nobody to aim it at.
 */
export function dualBlock(state: BattleState, d: DualSpec, a: Combatant, b?: Combatant): DualBlock | undefined {
  if (!d.parts.every(id => learned(state, id))) return 'level';
  if (state.usedDuals?.includes(d.id) && !state.unbound) return 'used';
  if (!b) return 'acted';
  if (b.hp <= 0) return 'down';
  const halves = halvesOf(d, a, b);
  if (!halves) return 'wear';
  if (state.phase !== 'player' || state.allies[state.active] !== a || state.allies.indexOf(b) <= state.allies.indexOf(a) || state.spent?.includes(b.id)) return 'acted';
  const cost = dualCost(d);
  if (!state.unbound && (a.secondary < cost[halves[0]]! || b.secondary < cost[halves[1]]!)) return 'mana';
  if (!validTargets(state, 'attack').length) return 'target';
}
export const dualReady = (state: BattleState, d: DualSpec, a: Combatant, b: Combatant) => !dualBlock(state, d, a, b);
/** The ally a dual (or a queue) from the active fighter pairs with: later this round, standing, not spent, wearing ánimas. */
export function dualPartner(state: BattleState): Combatant | undefined {
  return state.allies.find((x, i) => i > state.active && x.hp > 0 && !state.spent?.includes(x.id) && wearsAnimas(x));
}
/**
 * Development (the Dual command): every dual, whether it can happen now and why not. With `swaps`,
 * the active fighter may first put on the ánima of their half if it is free in their kit (`wear`).
 */
export function dualOptions(state: BattleState, swaps = false): { dual: DualSpec; ok: boolean; reason?: DualBlock; holder: Combatant; partner?: Combatant; wear?: ClassId }[] {
  const holder = state.allies[state.active];
  const partner = dualPartner(state) ?? state.allies.find(x => x !== holder && wearsAnimas(x));
  return DUALS.map(dual => {
    let reason = dualBlock(state, dual, holder, partner), wear: ClassId | undefined;
    if (reason === 'wear' && swaps && partner) {
      const owner = (id: SkillId) => SKILLS.find(s => s.id === id)!.class;
      const need = dual.parts.map((id, i) => partner.classId === owner(dual.parts[1 - i]) ? owner(id) : undefined).find(Boolean);
      if (need && need !== holder.classId && kitIn(state, holder).includes(need) && free(state, holder, need)) {
        const look = structuredClone(state);
        wearAnima(look, need);
        reason = dualBlock(look, dual, look.allies[look.active], look.allies.find(x => x.id === partner.id));
        wear = need;
      }
    }
    return { dual, ok: !reason, ...reason ? { reason } : {}, holder, ...partner ? { partner } : {}, ...wear ? { wear } : {} };
  });
}
/**
 * A dual from the active fighter with `dualPartner`: each pays their own half from the ánima they
 * wear, both turns go into it, both ánimas take part. Its blow is the stats of whoever brings the
 * half of its kind; it counts as every kind against a foe's rules.
 */
export function actDual(state: BattleState, id: DualId, targetId?: string): BattleEffect | undefined {
  const d = DUALS.find(x => x.id === id), a = state.allies[state.active], b = dualPartner(state);
  if (state.phase !== 'player' || !d || !a || !b || dualBlock(state, d, a, b)) return;
  const halves = halvesOf(d, a, b)!, cost = dualCost(d), targets = validTargets(state, 'attack');
  const target = targets.find(f => f.id === targetId) ?? targets[0];
  spendSecondary(a, cost[halves[0]]!); spendSecondary(b, cost[halves[1]]!);
  took(state, a); took(state, b);
  (state.spent ??= []).push(b.id);
  (state.usedDuals ??= []).push(d.id);
  if (state.queued) delete state.queued[b.id];
  const parts = halves.map(h => SKILLS.find(s => s.id === h)!);
  const striker = [a, b][Math.max(0, parts.findIndex(p => p.kind === d.kind))];
  const effect: BattleEffect = { actor: a.id, kind: 'skill', target: target.id, dual: { id: d.id, name: d.name, parts: [...halves], actors: [a.id, b.id], spent: { [a.id]: cost[halves[0]]!, [b.id]: cost[halves[1]]! } } };
  const melts = parts.some(p => 'melts' in p);
  if (d.charge) {
    // Its turn it only charges up: whoever brings its first half holds it, and it goes off as the next round starts.
    const holder = halves[0] === d.parts[0] ? a : b;
    holder.charge = { dual: d.id, striker: striker.id };
    effect.charging = holder.id; delete effect.target;
    state.message = `¡Ataque dual! ${d.name}: ${holder.name} se carga. Saldrá al empezar la siguiente ronda.`;
    checkEye(state, effect);
    settle(state);
    return effect;
  }
  state.message = `¡Ataque dual! ${d.name} contra ${target.name}.`;
  if (target.shell && !melts) {
    effect.amount = 0; effect.swallowed = true;
    state.message += ' El chicle se lo traga. Ni un rasguño.';
  } else {
    if (melts && target.shell) { target.shell = false; effect.melted = true; state.message += ' El pringue se derrite.'; }
    const layered = target.layers ?? 0, strikes: number[] = [], coins: (0 | 1)[] = [], burns: number[] = [];
    const { bled, scale } = wound(target, d.kind === 'physical'), weak = weakScale(state, target), chance = d.burnChance ?? 1;
    let fire: Timed | undefined;
    for (let i = 0; i < (d.strikes ?? 1) && target.hp > 0; i++) {
      const dealt = hurt(state, target, fearDamage(state, target, dualBlow(d, current(state, striker), current(state, target)) * scale * weak, 'dual'));
      strikes.push(dealt);
      if (target.layers && !--target.layers) bare(target);
      if (!d.burn) continue;
      // Fire never catches on wet layers; each strike checks after its own peel.
      const coin = dealt > 0 && target.hp > 0 && !target.layers && (chance >= 1 || roll(state) < chance) ? 1 : 0;
      if (coin) fire = inflict(target, d.burn);
      coins.push(coin); burns.push(coin ? fire!.level : 0);
    }
    if (bled) { delete target.statuses!.sangrado; effect.bled = bled; }
    effect.amount = strikes.reduce((sum, n) => sum + n, 0);
    const spent = weak > 1 && effect.amount > 0;
    if (spent) { delete target.weakSpot; effect.weakSpot = 'spent'; }
    if (strikes.length > 1) effect.strikes = strikes;
    if (d.burn) { effect.coins = coins; effect.burns = burns; }
    if (fire) effect.burn = { id: d.burn!, level: fire.level };
    const peeled = layered - (target.layers ?? 0);
    if (peeled) effect.peeled = peeled;
    state.message += ` −${effect.amount} PV.`;
    if (spent) state.message += ' ¡Punto débil: el triple de daño!';
    if (peeled && !target.layers && target.hp > 0) effect.stats = [{ target: target.id, way: 'down', stats: ['defensa'] }];
    if (peeled) state.message += !target.layers ? ' ¡Sin capas!' : peeled > 1 ? ` ${peeled} capas menos: quedan ${target.layers}.` : ` Una capa menos: quedan ${target.layers}.`;
    if (bled) state.message += ` La herida se abre: +${Math.round((scale - 1) * 100)} %.`;
    if (fire && target.hp > 0) state.message += fire.level > 1 ? ` ¡El fuego sube: ${TIMED[d.burn!].name} ${roman(fire.level)}!` : ' ¡Se quema!';
    else if (d.burn && target.hp > 0 && target.layers) state.message += ' Las capas, húmedas, no prenden.';
    if (d.weakSpot && target.hp > 0) {
      target.weakSpot = state.round + 1; effect.weakSpot = spent ? 'renewed' : 'set';
      state.message += ' ¡Punto débil! El siguiente golpe que reciba hará el triple de daño.';
    }
  }
  checkEye(state, effect);
  settle(state);
  return effect;
}
/** A dual's blow at average stats, by its kind. */
const dualBlow = (d: DualSpec, attacker: Stats, target: Stats) => d.kind === 'magic' ? magical(d.power, attacker, target) : physical(d.power, attacker, target);
/** A fire lit at `level` at least (Rayo solar's Quemado II); one already higher stays, its clock starting over. */
function kindle(c: Combatant, id: TimedId, level: number): Timed {
  const spec = TIMED[id], on = c.timed?.[id];
  const timed = { level: Math.min(spec.levels.length, Math.max(level, on?.level ?? 0)), left: spec.seconds, next: on?.next ?? spec.every };
  c.timed = { ...c.timed, [id]: timed };
  return timed;
}
/**
 * A charged dual goes off (`DualSpec.charge`), as the round starts: on every foe standing, with the
 * stats of whoever brought its half of its kind, the fire it leaves at its level at least. Kept as
 * news (`takeNews`) for the fight to show before anyone chooses. Whoever held it fallen: it is lost.
 */
function release(state: BattleState, holder: Combatant) {
  const charge = holder.charge!;
  delete holder.charge;
  const d = DUALS.find(x => x.id === charge.dual), striker = state.allies.find(a => a.id === charge.striker) ?? holder;
  if (!d || holder.hp <= 0) return;
  const melts = d.parts.some(id => SKILLS.some(s => s.id === id && 'melts' in s));
  const effect: BattleEffect = { kind: 'skill', actor: holder.id, release: { id: d.id, name: d.name } };
  effect.hits = state.foes.filter(f => f.hp > 0).map(foe => {
    if (foe.shell && melts) { foe.shell = false; effect.melted = true; }
    const weak = weakScale(state, foe);
    const amount = hurt(state, foe, fearDamage(state, foe, dualBlow(d, current(state, striker), current(state, foe)) * weak, 'dual'));
    const spends = weak > 1 && amount > 0;
    if (spends) { delete foe.weakSpot; effect.weakSpot = 'spent'; }
    const peeled = foe.layers ? 1 : undefined;
    if (foe.layers && !--foe.layers) bare(foe);
    // Fire never catches on wet layers.
    const burn = d.burn && foe.hp > 0 && !foe.layers ? { id: d.burn, level: kindle(foe, d.burn, d.burnLevel ?? 1).level } : undefined;
    return { target: foe.id, amount, ...peeled ? { peeled } : {}, ...spends ? { weakSpot: true as const } : {}, ...burn ? { burn } : {} };
  });
  effect.target = effect.hits[0]?.target; effect.amount = effect.hits[0]?.amount;
  const said = `¡${d.name}! ${holder.name} barre a todos: ${effect.hits.map(h => `−${h.amount}`).join(', ')} PV.${effect.hits.some(h => h.burn) ? ` ¡${TIMED[d.burn!].name} ${roman(d.burnLevel ?? 1)}!` : ''}`;
  checkEye(state, effect);
  (state.news ??= []).push(effect);
  return said;
}
/**
 * Queues `allyId`'s choice ahead (or clears it, with `null`): only an ally later in the round than
 * the active one, standing, not spent, wearing ánimas, in the party's turn; a skill they have on now
 * and can pay for, aimed at someone it can reach. Returns whether it took.
 */
export function queue(state: BattleState, allyId: string, choice: Queued | null): boolean {
  const index = state.allies.findIndex(a => a.id === allyId), ally = state.allies[index];
  if (state.phase !== 'player' || !ally || index <= state.active || ally.hp <= 0 || state.spent?.includes(ally.id) || !wearsAnimas(ally)) return false;
  if (!choice) { if (state.queued) delete state.queued[ally.id]; return true; }
  if (choice.action === 'skill') {
    const ability = SKILLS.find(s => s.id === choice.skill);
    if (!ability || !skillsFor(state, ally).includes(ability) || ally.secondary < ability.cost) return false;
    const targets = validTargets(state, 'skill', ability.id);
    if (!targets.length || (aimed(ability.id) && !targets.some(t => t.id === choice.target))) return false;
  } else if (choice.action === 'attack') {
    if (!validTargets(state, 'attack').some(t => t.id === choice.target)) return false;
  } else if (choice.action !== 'defend') return false;
  (state.queued ??= {})[ally.id] = { ...choice };
  return true;
}
/**
 * What confirming `skill` now would become with the partner's queued choice: the dual, or nothing.
 * The skill list never hints at it; once the skill is picked, the target picker shows its banner.
 */
export function queuedDual(state: BattleState, skill: SkillId): DualSpec | undefined {
  const a = state.allies[state.active], b = dualPartner(state), queued = b && state.queued?.[b.id];
  if (!a || !b || queued?.action !== 'skill' || !queued.skill) return;
  const d = dualOf(skill, queued.skill), halves = d && halvesOf(d, a, b);
  return d && halves && halves[0] === skill && halves[1] === queued.skill && dualReady(state, d, a, b) ? d : undefined;
}
/**
 * The fight's confirm: a skill that a later ally's queued skill completes becomes their dual (aimed
 * where the one confirming aims it, else where the queued one was, else the first foe standing);
 * anything else is `act`.
 */
export function commit(state: BattleState, action: BattleAction, targetId?: string, skill?: SkillId): BattleEffect | undefined {
  const d = action === 'skill' && skill ? queuedDual(state, skill) : undefined;
  if (!d) return act(state, action, targetId, skill);
  const queued = state.queued![dualPartner(state)!.id]!;
  const foes = validTargets(state, 'attack').map(f => f.id);
  return actDual(state, d.id, [aimed(skill!) ? targetId : undefined, queued.target].find(t => t && foes.includes(t)));
}
/** For the new active fighter: their queued choice if `act` would still take it now. It is cleared either way. */
export function takeQueued(state: BattleState): Queued | undefined {
  const actor = state.allies[state.active], queued = actor && state.queued?.[actor.id];
  if (!queued) return;
  delete state.queued![actor.id];
  return act(structuredClone(state), queued.action, queued.target, queued.skill) ? queued : undefined;
}
/** The fight's dice: a mulberry32 step on `state.seed` (set from the `random` the fight was made with). */
export function roll(state: BattleState) {
  let a = state.seed ?? Math.floor(Math.random() * 2 ** 32);
  a = (a + 0x6D2B79F5) >>> 0;
  state.seed = a;
  let t = a;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
/** What happened outside an action since last asked (a phase a pulse or a round's end brought on), oldest first. */
export function takeNews(state: BattleState): BattleEffect[] {
  const news = state.news ?? [];
  delete state.news;
  return news;
}
/** `targetId` is an AI suggestion; without a valid one the dogs take turns picking heroes. */
export function enemyAct(state: BattleState, id: string, targetId?: string): BattleEffect | undefined {
  if (state.phase !== 'enemy' || state.enemyActions.includes(id)) return;
  const actor = state.foes.find(f => f.id === id && f.hp > 0);
  const alive = state.allies.filter(a => a.hp > 0);
  const target = alive.find(a => a.id === targetId) ?? alive[(state.round + state.foes.findIndex(f => f.id === id) - 1) % alive.length];
  if (!actor || !target) return;
  // A part (Vertitrón's eye) has no turn of its own: it is through at once, with nothing to show.
  if (actor.part) { state.enemyActions.push(id); return; }
  if (actor.timed?.confusion) return confusedAct(state, actor);
  if (state.encounter === 'palace-minion') return minionAct(state, actor);
  if ((FEAR_ENCOUNTERS as readonly string[]).includes(state.encounter)) return fearAct(state, actor, target);
  state.enemyActions.push(id);
  if (actor.power !== undefined) {
    // The palace guards: one heavy fist each, guarding takes two thirds off.
    const hit = sighted(actor, physical(actor.power, current(state, actor), current(state, target)));
    const amount = changeHealth(target, -(target.guarding ? Math.ceil(hit / 3) : hit));
    state.message = `${actor.name} aplasta a ${target.name} con un puño de chicle. −${amount} PV${target.guarding ? ' · Protegido' : ''}.`;
    if (state.allies.every(a => a.hp === 0)) { state.phase = 'lost'; state.message = 'Todo se vuelve rosa… y luego negro.'; }
    return { actor: actor.id, kind: 'enemy', target: target.id, amount };
  }
  const strength = sighted(actor, physical(state.allies.length === 1 && state.foes.length > 1 ? 5 : 9, current(state, actor), current(state, target)));
  const damage = target.guarding ? Math.ceil(strength / 3) : strength;
  const amount = changeHealth(target, -damage);
  state.message = `${actor.name} da un empujón a ${target.name}. −${amount} PV${target.guarding ? ' · Protegido' : ''}.`;
  if (state.allies.every(a => a.hp === 0)) { state.phase = 'lost'; state.message = 'Toca recuperar el aliento. Puedes volver a intentarlo.'; }
  return { actor: actor.id, kind: 'enemy', target: target.id, amount };
}
/** How hard a confused foe's blow is at average stats, whatever it is: a plain shove, never its own moves. */
export const CONFUSED_BLOW = 12;
/**
 * Confusión: it does not know whose side it is on. Its turn goes into one plain blow on one of its
 * own standing (picked on the fight's dice), or on itself if it has nobody; whatever it announced is
 * forgotten. A part (Vertitrón's eye) is never picked.
 */
function confusedAct(state: BattleState, actor: Combatant): BattleEffect {
  state.enemyActions.push(actor.id);
  delete actor.intent;
  const others = state.foes.filter(f => f !== actor && f.hp > 0 && !f.part);
  const victim = others.length ? others[Math.floor(roll(state) * others.length)] : actor;
  const amount = hurt(state, victim, fearDamage(state, victim, sighted(actor, physical(CONFUSED_BLOW, current(state, actor), current(state, victim))), 'physical'));
  state.message = victim === actor ? `${actor.name}, confundido, se golpea a sí mismo. −${amount} PV.` : `${actor.name}, confundido, golpea a ${victim.name}. −${amount} PV.`;
  const effect: BattleEffect = { actor: actor.id, kind: 'enemy', target: victim.id, amount, confused: true };
  checkEye(state, effect);
  if (beaten(state)) { state.phase = 'won'; state.message = winMessage(state); endFight(state); }
  return effect;
}
/**
 * The palace minion spits at Bernat, harder every round, and its hits never knock him out: the
 * one that would leave him at BEAT_HP or less stops there and starts the beat, so whatever the
 * player does (attack, guard) Bernat's cry comes by round 6. After Matemágico it simply fights.
 */
function minionAct(state: BattleState, actor: Combatant): BattleEffect | undefined {
  const bernat = state.allies.find(a => a.id === 'bernat' && a.hp > 0);
  const target = bernat ?? state.allies.find(a => a.hp > 0);
  if (!target) return;
  state.enemyActions.push(actor.id);
  // Once Matemágico is awake the minion is shaken: plain spits, no more escalation.
  const raw = state.awakened ? 12 : state.round >= 6 ? 999 : Math.round(10 * 1.5 ** (state.round - 1));
  let amount = Math.min(target.guarding ? Math.ceil(raw / 3) : raw, target.hp);
  const awakening = !state.awakened && target.id === 'bernat' && target.hp - amount <= BEAT_HP;
  if (awakening) amount = Math.max(0, target.hp - BEAT_HP);
  amount = changeHealth(target, -amount);
  state.message = `${actor.name} escupe chicle a ${target.name}. −${amount} PV${target.guarding ? ' · Protegido' : ''}.`;
  if (awakening) { state.phase = 'beat'; state.message = `${target.name} cae de rodillas. El esbirro se infla para el último golpe…`; }
  else if (state.allies.every(a => a.hp === 0)) { state.phase = 'lost'; state.message = 'Toca recuperar el aliento. Puedes volver a intentarlo.'; }
  return { actor: actor.id, kind: 'enemy', target: target.id, amount };
}
/** Vertitrón and its eye, in its fight. */
const vertigoBody = (state: BattleState) => state.foes.find(f => f.kind === 'vertigo');
const eyeOf = (state: BattleState) => state.foes.find(f => f.kind === 'vertigo-ojo');
/** Vertitrón's eye: a part of it, with its own PV and no turns. */
function spiralEye(): Combatant {
  return { ...foe('ojo', 'El ojo de Vertitrón', 'vertigo-ojo'), part: true };
}
/** Whether Vertitrón's eye still stands (it can charge and fire the Rayo). */
export const eyeOpen = (state: BattleState) => { const eye = eyeOf(state); return !!eye && eye.hp > 0; };
/**
 * Vertitrón's eye breaks with whatever broke it (a blow, a dual, a tick, a pulse): no more Rayo
 * terrorífico, and one charging is called off. Without an `effect`, it is kept as news (`takeNews`).
 */
function checkEye(state: BattleState, effect?: BattleEffect) {
  const eye = eyeOf(state), body = vertigoBody(state);
  if (!eye || !body || eye.hp > 0 || eye.told) return;
  eye.told = true;
  delete eye.statuses; delete eye.timed; delete eye.marks; delete eye.weakSpot;
  const news: BattleEffect = effect ?? { kind: 'enemy', actor: body.id }, said = state.message;
  if (!effect) state.message = '';
  news.eye = 'broken';
  if (body.intent?.ability === 'rayo') { delete body.intent; news.cancelled = 'rayo'; }
  state.message += body.hp > 0 ? ' ¡El ojo de Vertitrón se apaga! Ya no puede lanzar el Rayo terrorífico.' : '';
  if (effect) return;
  state.message = state.message.trim() || said;
  (state.news ??= []).push(news);
}
/** A blow on everyone: `target` takes the main one, the rest the splash; holding on takes two thirds off. */
type Hit = (who: Combatant, power: number) => number;
function onEveryone(state: BattleState, effect: BattleEffect, target: Combatant, hit: Hit, power: number) {
  const alive = state.allies.filter(a => a.hp > 0);
  effect.amount = hit(target, power);
  effect.splash = alive.filter(ally => ally !== target).map(ally => ({ target: ally.id, amount: hit(ally, power) }));
}
/**
 * Vertitrón's turns (docs/quests/nuria.md § Final boss), round VERTIGO_TURNS: Pisotón on one, Barrido
 * on everyone, Grito liberador (the party weaker and it stronger, for good), its eye charging and,
 * on its next turn, the Rayo terrorífico on everyone. With its eye broken it skips the charge and
 * the Rayo.
 */
function vertigoTurn(state: BattleState, actor: Combatant, target: Combatant, effect: BattleEffect, hit: Hit, stats: StatChange[]) {
  const open = eyeOpen(state);
  const turns = open ? VERTIGO_TURNS : VERTIGO_TURNS.filter(t => t !== 'carga' && t !== 'rayo');
  const move = turns[(actor.turns ?? 0) % turns.length];
  actor.turns = (actor.turns ?? 0) + 1;
  delete actor.intent;
  effect.ability = foeAbility(move);
  if (move === 'pisoton') {
    effect.amount = hit(target, VERTIGO.pisoton);
    state.message = `Vertitrón pisa fuerte a ${target.name}. −${effect.amount} PV.`;
  } else if (move === 'barrido') {
    onEveryone(state, effect, target, hit, VERTIGO.barrido);
    state.message = `Vertitrón pasa la mano por el tejado y os barre a los dos. −${effect.amount} PV a ${target.name}.`;
  } else if (move === 'grito') {
    // Grito liberador: the party loses Fuerza and Magia and Vertitrón gains them, for the rest of the fight.
    delete effect.target;
    const stat: (keyof Stats)[] = ['fuerza', 'magia'];
    const shift = (c: Combatant, amount: number) => {
      const lasting = c.lasting ??= { shifts: {}, from: FOE_ABILITIES.grito.name };
      for (const s of stat) lasting.shifts[s] = (lasting.shifts[s] ?? 0) + amount;
    };
    for (const ally of state.allies.filter(a => a.hp > 0)) { shift(ally, -VERTIGO.gritoDown); stats.push({ target: ally.id, way: 'down', stats: stat }); }
    shift(actor, VERTIGO.gritoUp); stats.push({ target: actor.id, way: 'up', stats: stat });
    state.message = 'Grito liberador. Os flaquean la Fuerza y la Magia, y Vertitrón se crece.';
  } else if (move === 'carga') {
    // The eye charges: the Rayo comes on its next turn, at everyone.
    delete effect.target;
    actor.intent = { ability: 'rayo', at: 'todos' };
    effect.telegraph = { id: 'rayo', name: FOE_ABILITIES.rayo.name, at: 'todos' };
    state.message = 'El ojo de Vertitrón empieza a cargarse. Gira cada vez más rápido…';
  } else {
    const zap: Hit = (who, power) => {
      const raw = sighted(actor, magical(power, current(state, actor), current(state, who)));
      return changeHealth(who, -(who.guarding ? Math.ceil(raw / 3) : raw));
    };
    onEveryone(state, effect, target, zap, VERTIGO.rayo);
    state.message = `Rayo terrorífico. El ojo barre el tejado de lado a lado. −${effect.amount} PV a ${target.name}.`;
  }
}
/** A foe's announced move as the fight shows it over them: «Carrerilla → Aitor», «Rayo terrorífico → todos», «Pelada». */
export function intentLabel(state: BattleState, c: Combatant): string | undefined {
  const intent = c.intent;
  if (!intent || c.hp <= 0) return;
  if (intent.ability === 'capa-nueva') return 'Pelada';
  const name = FOE_ABILITIES[intent.ability === 'aplaston' ? 'carrerilla' : intent.ability].name;
  const who = intent.target ? state.allies.find(a => a.id === intent.target)?.name : intent.at;
  return who ? `${name} → ${who}` : name;
}
/** Whether a big onion takes its run-up on the turn it is on: its first one, then every `aplastonEvery`. */
function rushTurn(c: Combatant) {
  const turn = c.turns ?? 0, first = c.rushFirst ?? FEAR_RULES.aplastonFirst;
  return turn >= first && (turn - first) % FEAR_RULES.aplastonEvery === 0;
}
/**
 * The fears' own turns, each named (FOE_ABILITIES). Onions weigh and make everyone cry while they
 * have layers; a big one takes a run-up and falls on whom it looked at; a cebollita peeled grows a
 * layer back, once. A platito flips its dish once; El Plato swaps it, and on the surprise splashes
 * everyone. A fantasmita counts down to «GAME OVER» and goes see-through on its last count.
 */
function fearAct(state: BattleState, actor: Combatant, target: Combatant): BattleEffect | undefined {
  state.enemyActions.push(actor.id);
  const hit: Hit = (who, power) => {
    const raw = sighted(actor, physical(power, current(state, actor), current(state, who)));
    return changeHealth(who, -(who.guarding ? Math.ceil(raw / 3) : raw));
  };
  const effect: BattleEffect = { actor: actor.id, kind: 'enemy', target: target.id };
  const stats: StatChange[] = [];
  const cry = (who: Combatant, count: number) => { addStatus(who, 'llorera', count); if (who.hp > 0) stats.push(weakened(who, 'llorera')); };
  const use = (id: FoeAbilityId) => { effect.ability = foeAbility(id); };
  if (actor.kind === 'vertigo') vertigoTurn(state, actor, target, effect, hit, stats);
  else {
    actor.turns = (actor.turns ?? 0) + 1;
    if (actor.kind === 'cebollita' && !actor.layers && !actor.regrown) {
      // Capa nueva: peeled and still standing, it spends its turn wrapping itself up again.
      actor.layers = 1; actor.regrown = true; delete actor.intent; effect.regrown = true; delete effect.target;
      use('capa-nueva');
      state.message = `${actor.name} se envuelve en una capa nueva.`;
    } else if (actor.kind === 'cebollita') {
      use(actor.layers ? 'lagrimilla' : 'peso');
      effect.amount = hit(target, onionPower('cebollita', actor.layers ?? 0));
      if (actor.layers && target.hp > 0) cry(target, ONIONS.cebollita.cry);
      state.message = actor.layers ? `${actor.name} rueda contra ${target.name} y le hace llorar. −${effect.amount} PV.` : `${actor.name}, pelada, rueda contra ${target.name}. −${effect.amount} PV.`;
    } else if (actor.kind === 'platito' && !actor.flipped && actor.hp <= actor.maxHp * FEAR_RULES.flipAt) {
      // Darle la vuelta: once, hurt, it spends its turn turning its dish over (its weakness with it).
      actor.flipped = true; actor.dish = actor.dish === 'coliflor' ? 'alcachofa' : 'coliflor'; effect.flipped = actor.dish; delete effect.target;
      use('vuelta');
      state.message = `¡${actor.name} le da la vuelta al plato! Ahora es ${DISHES[actor.dish].name}.`;
    } else if (actor.kind === 'platito') {
      use('salpicon'); effect.amount = hit(target, actor.power!);
      state.message = `${actor.name}, ${DISHES[actor.dish ?? 'alcachofa'].name}, salpica a ${target.name}. −${effect.amount} PV.`;
    } else if (actor.kind === 'fantasmita') {
      actor.countdown = (actor.countdown ?? BROOD.fantasmita.countdown) - 1;
      if (actor.countdown <= 0) {
        // «GAME OVER»: everyone takes it; holding on (Defender) takes two thirds off. Then it is solid again.
        use('game-over'); onEveryone(state, effect, target, hit, BROOD.fantasmita.gameOver);
        actor.countdown = BROOD.fantasmita.countdown; delete actor.transparent;
        state.message = `«GAME OVER». ${actor.name} estalla en píxeles contra todos.`;
      } else {
        use('atravesar'); effect.amount = hit(target, actor.power!);
        state.message = `${actor.name} atraviesa a ${target.name}. −${effect.amount} PV. «${actor.countdown}…»`;
        if (actor.countdown === 1) { actor.transparent = true; effect.transparent = [actor.id]; state.message += ' Se vuelve transparente.'; }
      }
    } else if (actor.kind === 'cebollon' || actor.kind === 'cebolla') {
      const kind = actor.kind, power = onionPower(kind, actor.layers ?? 0);
      const rush = actor.intent?.ability === 'aplaston' ? actor.intent : undefined;
      if (rush) delete actor.intent;
      if (rush && actor.layers) {
        // Aplastón: the run-up ends on whom it looked at, all its weight on one, no splash.
        const named = state.allies.find(a => a.id === rush.target && a.hp > 0) ?? target;
        use('aplaston'); effect.target = named.id;
        effect.amount = hit(named, Math.round(FEAR_RULES.aplaston * power));
        for (const ally of state.allies.filter(a => a.hp > 0)) cry(ally, ONIONS[kind].cry);
        state.message = `¡Aplastón! ${actor.name} cae rodando sobre ${named.name}. −${effect.amount} PV.`;
      } else {
        use('peso'); effect.amount = hit(target, power);
        if (actor.layers) {
          const alive = state.allies.filter(a => a.hp > 0 && a !== target);
          effect.splash = alive.map(ally => ({ target: ally.id, amount: hit(ally, Math.round(power * ONIONS[kind].splash)) }));
          for (const ally of state.allies.filter(a => a.hp > 0)) cry(ally, ONIONS[kind].cry);
        }
        state.message = `${rush ? 'Pelada, ya no pesa: la carrerilla se queda en nada. ' : ''}${actor.layers ? `${actor.name} cae con todo su peso sobre ${target.name}. A todos se les saltan las lágrimas. −${effect.amount} PV.` : `${actor.name}, pelada y pequeña, rueda contra ${target.name}. −${effect.amount} PV.`}`;
        const alive = state.allies.filter(a => a.hp > 0);
        if (actor.layers && rushTurn(actor) && alive.length) {
          // Carrerilla: it rolls back and looks at whom it will fall on next turn (next round's turn order).
          const next = alive[(state.round + state.foes.indexOf(actor)) % alive.length];
          actor.intent = { ability: 'aplaston', target: next.id };
          effect.telegraph = { id: 'carrerilla', name: FOE_ABILITIES.carrerilla.name, target: next.id };
          state.message += ` …y rueda hacia atrás: mira a ${next.name}.`;
        }
      }
    } else if (actor.kind === 'plato') {
      if (actor.dish === 'sorpresa') {
        // ¡Puaj!: on the surprise dish it splashes everyone.
        use('puaj'); onEveryone(state, effect, target, hit, FEAR_RULES.puaj);
        state.message = `¡Puaj! El Plato Misterioso lo salpica todo. −${effect.amount} PV a ${target.name}.`;
      } else {
        use('cambio-plato'); effect.amount = hit(target, actor.power!);
        state.message = `El Plato Misterioso salpica a ${target.name}. −${effect.amount} PV.`;
      }
      actor.dish = DISH_ORDER[(DISH_ORDER.indexOf(actor.dish ?? 'alcachofa') + 1) % DISH_ORDER.length];
      state.message += ` Cambia de plato: ¡ahora es ${DISHES[actor.dish].name}!`;
    } else {
      effect.amount = hit(target, actor.power ?? 10);
      state.message = `${actor.name} golpea a ${target.name}. −${effect.amount} PV.`;
    }
  }
  if (!effect.splash?.length) delete effect.splash;
  if (stats.length) effect.stats = stats;
  if (state.allies.every(a => a.hp === 0)) { state.phase = 'lost'; state.message = 'Todo se vuelve rosa… y luego negro.'; endFight(state); }
  return effect;
}
/**
 * A fighter changes ánima (class) on their own turn, or takes it off with `null`. It does not
 * spend the turn: it only changes their stats and skills. PV keep what is left, within the new
 * maximum; the maná goes with each ánima (`swapMana`). Returns whether it changed.
 */
export function changeAnima(state: BattleState, allyId: string, classId: ClassId | null) {
  const ally = state.allies.find(a => a.id === allyId);
  if (state.phase !== 'player' || !ally || ally.hp <= 0 || state.allies[state.active] !== ally || (ally.classId ?? null) === classId || (classId && (!free(state, ally, classId) || !kitIn(state, ally).includes(classId)))) return false;
  const { hp } = ally;
  swapMana(state, ally, classId ?? undefined);
  const { secondary, maxSecondary, mana, worn, kit } = ally;
  Object.assign(ally, fighter({ id: ally.id, name: ally.name, profile: ally.profile, classId: classId ?? undefined }));
  Object.assign(ally, { hp: Math.min(hp, ally.maxHp), secondary, maxSecondary, mana, worn, kit });
  state.message = classId ? `${ally.name} cambia de ánima.` : `${ally.name} se quita el ánima.`;
  return true;
}
/**
 * The beat is over: Bernat cried out to him to think, to do the magic with his mind, and
 * Matemágico woke up in Gerard. It is his turn again, with Foc Binari and its maná full.
 */
export function awaken(state: BattleState, classId: ClassId) {
  if (state.phase !== 'beat') return;
  const gerard = state.allies.find(a => a.id === 'gerard')!;
  const hurt = gerard.maxHp - gerard.hp, kit = [...new Set([classId, ...gerard.kit ?? []])];
  Object.assign(gerard, fighter({ id: gerard.id, name: gerard.name, profile: gerard.profile, classId, kit }, [classId]));
  gerard.hp = Math.max(1, gerard.maxHp - hurt);
  if (!state.animas.includes(classId)) state.animas.push(classId);
  state.awakened = true;
  state.allies.forEach(a => { a.guarding = false; });
  state.enemyActions = []; state.round++;
  state.active = state.allies.indexOf(gerard); state.phase = 'player';
  state.message = 'Gerard piensa. Algo ha despertado en él: Matemágico.';
}
/**
 * The end of a round: statuses do their part and fade (Sangrado hurts first, then every status
 * loses its `decay`), marks and weak spots due run out (Sangrado can break Vertitrón's eye). Then
 * the next round starts. Returns what the statuses did, in order, so the fight can show it. A
 * fight can end here: foes bled out, or the party did.
 */
export function nextRound(state: BattleState): StatusTick[] {
  // A part (Vertitrón's eye) takes no turn, so the round never waits for it.
  if (state.phase !== 'enemy' || state.foes.some(f => f.hp > 0 && !f.part && !state.enemyActions.includes(f.id))) return [];
  const ticks: StatusTick[] = [];
  for (const c of [...state.foes, ...state.allies]) {
    if (!c.statuses) continue;
    const foeSide = state.foes.includes(c);
    for (const id of STATUS_IDS) {
      const count = stacks(c, id), spec = STATUSES[id];
      if (!count) continue;
      const amount = spec.tick && c.hp > 0 ? foeSide ? hurt(state, c, spec.tick * count) : changeHealth(c, -spec.tick * count) : 0;
      const left = c.hp > 0 ? Math.max(0, count - spec.decay) : 0;
      if (left) c.statuses[id] = left; else delete c.statuses[id];
      if (amount) ticks.push({ target: c.id, status: id, amount, stacks: left });
    }
  }
  checkEye(state);
  if (beaten(state)) { state.phase = 'won'; state.message = winMessage(state); endFight(state); return ticks; }
  if (state.allies.every(a => a.hp === 0)) { state.phase = 'lost'; state.message = 'Todo se vuelve rosa… y luego negro.'; endFight(state); return ticks; }
  for (const f of state.foes) {
    for (const [id, mark] of Object.entries(f.marks ?? {}) as [SkillId, { until: number }][]) if (mark.until <= state.round) delete f.marks![id];
    if (f.weakSpot !== undefined && f.weakSpot <= state.round) delete f.weakSpot;
  }
  // What lasts one round whatever its clock says (Explosión's blinding) ends with it.
  for (const c of [...state.foes, ...state.allies]) for (const id of TIMED_IDS) if (c.timed?.[id]?.until !== undefined && c.timed[id]!.until! <= state.round) delete c.timed[id];
  // Ánimas not worn all round get some maná back; next round counts afresh from the one worn.
  for (const ally of state.allies) {
    if (!wearsAnimas(ally)) continue;
    const pools = ally.mana ??= {};
    for (const id of kitIn(state, ally)) if (id !== ally.classId && !ally.worn?.includes(id)) { const most = manaMax(state.improved, id); pools[id] = Math.min(most, (pools[id] ?? most) + REST_CHARGE); }
    ally.worn = ally.classId ? [ally.classId] : [];
  }
  state.round++;
  state.allies.forEach(a => { a.guarding = false; });
  state.enemyActions = []; delete state.queued; delete state.spent;
  // Whoever sits this round out (Explosión: Bip is putting itself back together) is through already.
  const out = state.allies.filter(a => a.out === state.round && a.hp > 0);
  // Kept through the round they sit out (Bip shows nowhere until it is over), gone after it.
  for (const a of state.allies) if (a.out !== undefined && a.out < state.round) delete a.out;
  if (out.length) state.spent = out.map(a => a.id);
  state.active = state.allies.findIndex(a => a.hp > 0 && !state.spent?.includes(a.id));
  state.phase = 'player'; state.message = 'Tu turno. Elige tu siguiente movimiento.';
  if (out.length) state.message += ` ${out.map(a => a.name).join(' y ')} no ${out.length > 1 ? 'actúan' : 'actúa'} esta ronda.`;
  // A dual charged last round goes off now, before anyone chooses (Rayo solar).
  const released = state.allies.filter(a => a.charge).map(a => release(state, a)).filter(Boolean);
  if (released.length) state.message = `${released.join(' ')} ${state.message}`;
  if (beaten(state)) { state.phase = 'won'; state.message = winMessage(state); endFight(state); return ticks; }
  // Nobody left to choose this round: the foes go again.
  if (state.active < 0) { state.active = 0; state.phase = 'enemy'; }
  return ticks;
}
/**
 * The fight's clock: `seconds` of real time pass (the fight runs it every frame, in both phases).
 * Timed statuses pulse when their moment comes and go out when their time is up; whoever falls
 * loses theirs. Returns the pulses, in order, so the fight can show them. A fight can end here.
 */
export function runClock(state: BattleState, seconds: number, waiting?: (c: Combatant) => boolean): TimedPulse[] {
  if (!(seconds > 0) || (state.phase !== 'player' && state.phase !== 'enemy')) return [];
  const pulses: TimedPulse[] = [];
  for (const c of [...state.foes, ...state.allies]) for (const id of TIMED_IDS) {
    const on = c.timed?.[id];
    // A fire settled but still on its way (`waiting`): its clock starts when it lands.
    if (!on || waiting?.(c)) continue;
    let dt = seconds;
    const foeSide = state.foes.includes(c);
    while (TIMED[id].levels.length && c.hp > 0 && on.left > 1e-6 && dt >= on.next - 1e-6) {
      dt -= on.next; on.left -= on.next; on.next = TIMED[id].every;
      const amount = pulseDamage(id, on.level, c.maxHp);
      // A cure's pulse (Sanación) gives PV back, never past the most.
      if (TIMED[id].heal) pulses.push({ target: c.id, status: id, level: on.level, amount: changeHealth(c, amount), heal: true });
      else pulses.push({ target: c.id, status: id, level: on.level, amount: foeSide ? hurt(state, c, amount) : changeHealth(c, -amount) });
      // Vertitrón's eye burnt out: no more Rayo.
      if (c.kind === 'vertigo-ojo') checkEye(state);
    }
    on.left -= dt; on.next -= dt;
    if ((c.hp <= 0 || on.left <= 1e-6) && c.timed) delete c.timed[id];
  }
  if (!pulses.length) return pulses;
  if (beaten(state)) { state.phase = 'won'; state.message = winMessage(state); endFight(state); }
  else if (state.allies.every(a => a.hp === 0)) { state.phase = 'lost'; state.message = 'Todo se vuelve rosa… y luego negro.'; endFight(state); }
  return pulses;
}
/** Moments of a fight the picker can jump to that the fight itself stages (docs/dev-tools.md). */
export type StagedMoment = 'vertigo-carga' | 'vertigo-grito' | 'vertigo-sin-ojo' | 'plato-sorpresa';
export const STAGED_MOMENTS: Record<StagedMoment, { label: string; encounter: Encounter }> = {
  'vertigo-carga': { label: 'Rayo cargado', encounter: 'uri-vertigo' },
  'vertigo-grito': { label: 'Tras dos gritos', encounter: 'uri-vertigo' },
  'vertigo-sin-ojo': { label: 'Ojo roto', encounter: 'uri-vertigo' },
  'plato-sorpresa': { label: 'Plato sorpresa', encounter: 'plato' },
};
/**
 * Development: puts the fight at `moment`, the party to choose (pure; the picker's `jumpTo` calls
 * it). Vertitrón with its eye charged (Rayo terrorífico → todos announced); after two Gritos
 * liberadores, at half its PV, the third shout next; or with its eye broken. El Plato with the
 * surprise under its cloche. Returns whether it fits this fight.
 */
export function stageMoment(state: BattleState, moment: StagedMoment): boolean {
  if (state.phase !== 'player' && state.phase !== 'enemy') return false;
  if (moment === 'plato-sorpresa') {
    const plato = state.foes.find(f => f.kind === 'plato' && f.hp > 0);
    if (!plato) return false;
    plato.dish = 'sorpresa';
  } else {
    const body = vertigoBody(state), eye = eyeOf(state);
    if (!body || !eye) return false;
    // From a clean start: full PV, its eye open, nothing shouted nor announced.
    for (const c of [body, eye, ...state.allies]) delete c.lasting;
    delete body.intent; delete eye.told; body.hp = body.maxHp; eye.hp = eye.maxHp; body.turns = 0;
    if (moment === 'vertigo-carga') {
      body.turns = VERTIGO_TURNS.indexOf('rayo');
      body.intent = { ability: 'rayo', at: 'todos' };
    } else if (moment === 'vertigo-grito') {
      body.turns = VERTIGO_TURNS.length + VERTIGO_TURNS.indexOf('grito');
      body.hp = Math.floor(body.maxHp / 2);
      const stat = ['fuerza', 'magia'] as const;
      for (const c of [body, ...state.allies]) {
        const amount = c === body ? 2 * VERTIGO.gritoUp : -2 * VERTIGO.gritoDown;
        c.lasting = { shifts: Object.fromEntries(stat.map(s => [s, amount])), from: FOE_ABILITIES.grito.name };
      }
    } else {
      eye.hp = 0; eye.told = true;
    }
  }
  state.phase = 'player'; state.enemyActions = []; state.active = Math.max(0, state.allies.findIndex(a => a.hp > 0));
  delete state.queued; delete state.spent; delete state.news;
  state.message = `Depuración: ${STAGED_MOMENTS[moment].label}.`;
  return true;
}
