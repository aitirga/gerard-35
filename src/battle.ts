/** Campaign turn/story adapter. Numeric resolution is shared with the generic combat core. */
import { adjustResource } from './combat/engine.ts';
import { DOG_PROFILES } from './encounters.ts';
import { PROFILES, healing, magical, physical, withBonus, type ProfileId, type StatBonus, type Stats } from './stats.ts';
import { TONES, VOZ_SONG, onsets, songAt, type Moment, type ToneId } from './song.ts';
import { CASTLE_ENCOUNTERS, CASTLE_MOMENTS, isCastle, isCastleEncounter, isCastleMoment, type CastleEncounter, type CastleFight, type CastleKind, type CastleMark, type CastleMoment } from './castle.ts';
import { castleAfter, castleIdle, castleIntent, castleRoundEnd, castleRoundStart, castleTaken, castleTurn, castleWinMessage, createCastleBattle, runCastle, stageCastle, type CastleKit } from './castle-fight.ts';
export type BattleAction = 'attack' | 'defend' | 'skill' | 'escape';
/** `beat`: the fight holds still for a story moment (the palace minion about to finish Bernat). */
export type BattlePhase = 'player' | 'enemy' | 'beat' | 'won' | 'lost' | 'escaped';
/**
 * Ánimas (the code calls them classes; docs/party.md). They belong to the party, not to one
 * person: once unlocked, anyone in the party but Bernat can wear one, and it adds its stats and
 * its skills to whoever wears it. In a fight the active fighter swaps them with L and R.
 */
export type ClassId = 'matemagico' | 'papagato' | 'tecnopata' | 'dadaista';
export const ANIMA_NAMES: Record<ClassId, string> = { matemagico: 'Matemágico', papagato: 'Papagato', tecnopata: 'Tecnópata', dadaista: 'Dadaísta' };
export const CLASS_STATS: Record<ClassId, StatBonus> = {
  // Counting everything twice sharpens the mind a little.
  matemagico: { magia: 1, espiritu: 1 },
  // Haru and Yuki at your feet: quick and scrappy, less calm (docs/animas/papagato/).
  papagato: { velocidad: 2, fuerza: 1, espiritu: -1 },
  // Aitor's own ánima: a placeholder, still to design (no stats, no skills).
  tecnopata: {},
  // The university friends' ánima: it throws dice, and hard; it thinks less (docs/animas/dadaista/).
  dadaista: { fuerza: 3, defensa: 2, magia: -1 },
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
  // The rest of Matemágico comes from its tree at the jar (`node`, src/ecos.ts; docs/animas/README.md
  // § The jar), never from levels. The trunk, Cálculo: Gerard works out how everyone should hit (a
  // boost), the angle a foe is open at, and draws a cardioid of light under a friend (a cure).
  { id: 'analisis', name: 'Análisis Parálisis', cost: 2, side: 'party', power: 3, kind: 'boost', stats: ['fuerza', 'magia'], node: true, description: 'Sube Fuerza y Magia de todo el equipo durante 3 rondas.', class: 'matemagico' },
  // Ángulo exacto: Gerard works out the angle a foe is open at (a `debuff`: a mark on that foe,
  // `marks`, for BOOST_ROUNDS). Damage is flat, so every point off adds a point to every hit.
  { id: 'angulo', name: 'Ángulo exacto', cost: 1, side: 'foes', power: 3, kind: 'debuff', stats: ['defensa', 'espiritu'], node: true, description: 'Baja Defensa y Espíritu de un enemigo durante 3 rondas.', class: 'matemagico' },
  { id: 'cardioide', name: 'Cardioide', cost: 2, side: 'allies', power: 30, kind: 'heal', node: true, description: 'Cura media a un aliado herido.', class: 'matemagico' },
  // The elements' lines. Fire piles up: Factor común takes the highest fire among the foes to all of
  // them (`evens`). Water sets up: Vasos comunicantes leaves them Mojado (`wets`), or puts a fire
  // out into smoke. Electricity cashes in: Descarga jumps to everyone wet (`react`, Conducción).
  { id: 'factor-comun', name: 'Factor común', cost: 2, side: 'all-foes', power: 24, kind: 'magic', element: 'fuego', melts: true, evens: 'quemado', node: true, description: 'Daño medio mágico de tipo fuego a todos los enemigos. El fuego de todos sube al más alto.', class: 'matemagico' },
  { id: 'vasos', name: 'Vasos comunicantes', cost: 2, side: 'all-foes', power: 16, kind: 'magic', element: 'agua', wets: 'mojado', node: true, description: 'Daño leve mágico de tipo agua a todos los enemigos. Los moja.', class: 'matemagico' },
  { id: 'descarga', name: 'Descarga', cost: 2, side: 'foes', power: 26, kind: 'magic', element: 'electrico', node: true, description: 'Daño medio mágico de tipo eléctrico a un enemigo. Salta a todos los mojados.', class: 'matemagico' },
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
  // not level: the two rays are there from the start, the rest are nodes of its tree (`node`).
  // Rayo de energía: a beam; what is running out on the foe by the clock (TIMED: a fire, the smoke,
  // Confusión; never a cure) lasts `extend` seconds longer.
  { id: 'rayo-energia', name: 'Rayo de energía', cost: 2, side: 'foes', power: 18, kind: 'magic', extend: 5, description: 'Daño leve mágico a un enemigo. Sus estados con reloj duran 5 segundos más.', class: 'tecnopata' },
  // Rayo de sanación: a cure that comes bit by bit on the fight's clock (`regen`: a timed status, as
  // Quemado is a fire, its pulses healing). `power` is what it gives back in all at level I.
  { id: 'rayo-sanacion', name: 'Rayo de sanación', cost: 1, side: 'allies', power: 20, kind: 'heal', regen: 'sanacion', description: 'Cura leve a un aliado herido. La cura llega poco a poco durante 15 segundos.', class: 'tecnopata' },
  // Explosión: Bip blows itself up among the foes (fire: it melts the pringue), blinds them until
  // their turn is over (`blind`: Cegado until the round ends), and its wearer loses their next turn
  // while it puts itself back together (`spends`, `Combatant.out`).
  { id: 'explosion', name: 'Explosión', cost: 2, side: 'all-foes', power: 32, kind: 'magic', melts: true, blind: true, spends: true, node: true, description: 'Daño medio mágico de tipo fuego a todos los enemigos. Los ciega durante 1 ronda. Pierdes tu siguiente turno.', class: 'tecnopata' },
  // Confusión: waves of the mind off Bip; for a while the foe does not know whose side it is on
  // (`confuse`: the timed status Confusión), and its blows go to its own (`enemyAct`).
  { id: 'confusion', name: 'Confusión', cost: 2, side: 'foes', power: 0, kind: 'debuff', stats: [], confuse: true, abstract: true, node: true, description: 'Ondas mentales confunden a un enemigo durante 30 segundos: golpea a los suyos.', class: 'tecnopata' },
  // Rayo encogedor: the foe shrinks for a while (`shrink`: the timed status Encogido), a quarter of
  // its Defensa gone. In seconds, not rounds, so it skips the fixed shape (`abstract`).
  { id: 'rayo-encogedor', name: 'Rayo encogedor', cost: 1, side: 'foes', power: 0, kind: 'debuff', stats: ['defensa'], shrink: true, abstract: true, node: true, description: 'Encoge a un enemigo durante 15 segundos: su Defensa baja un 25 %.', class: 'tecnopata' },
  // Control remoto: Bip takes a foe over for a moment. It turns on one of its own right now, with its
  // own strength (`control`, `power` the blow at average stats), and forgets what it had announced.
  { id: 'control-remoto', name: 'Control remoto', cost: 2, side: 'foes', power: 34, kind: 'debuff', stats: [], control: true, abstract: true, node: true, description: 'Bip toma el mando de un enemigo: golpea con fuerza a uno de los suyos y olvida lo que iba a hacer.', class: 'tecnopata' },
  // Dadaísta's skills are dice thrown (docs/animas/dadaista/): its maná is dice, each with its face in
  // view, and a skill with `die` spends the one chosen. Golpe de dados lands `power`, and `pip` more
  // for each pip of that die. Their strength changes with the die, so they skip the fixed shape.
  { id: 'golpe-dados', name: 'Golpe de dados', cost: 1, side: 'foes', power: 6, pip: 5, kind: 'physical', die: 'face', abstract: true, description: 'Daño variable físico a un enemigo. Más fuerte cuanto más alta la cara del dado.', class: 'dadaista' },
  // Doble o nada: the die bet is rolled again. The same or higher, the blow lands twice; lower, there
  // is no blow and the die is gone all the same: a skill always spends its die, as any maná.
  { id: 'doble-o-nada', name: 'Doble o nada', cost: 1, side: 'foes', power: 6, pip: 5, kind: 'physical', die: 'bet', abstract: true, description: 'Daño variable físico a un enemigo. Vuelve a tirar el dado: si sale igual o más alto, golpe doble. Si sale más bajo, no hay golpe y el dado se pierde.', class: 'dadaista' },
] as const;
/**
 * Maná (docs/combat.md § Maná): what skills spend, shown as circles. Every ánima has its own, for
 * each wearer, full at the start of every fight; the ones resting get some back each round, so a
 * fighter who wants to keep using skills changes ánima. Bernat wears none and has none.
 */
export const MANA_POINTS = 3;
/** What Ecos de luz (src/ecos.ts) added to each ánima: more maná, the elements its Atacar can carry. */
export interface Improved {
  mana?: Partial<Record<ClassId, number>>; elements?: Partial<Record<ClassId, readonly Element[]>>;
  /** The skills bought as nodes of a tree (`node` in SKILLS), and the passives. */
  skills?: readonly SkillId[]; passives?: readonly PassiveId[];
}
/**
 * Passives (docs/animas/README.md § The jar): bought as nodes, always on while their ánima is worn,
 * no cost and no button. Each time one does something the fight says so (`BattleEffect.passives`).
 * Rescoldo: Matemágico's fires last RESCOLDO seconds. Capilaridad: his Atacar with water wets a foe
 * it turns nothing on. Toma de tierra: a reaction he sets off gives a maná back, once a round.
 * Telemetría: Bip's Atacar gives TELEMETRIA seconds more to what runs out on its target. Nanitos:
 * Rayo de sanación also takes one harmful status off whoever it cures.
 */
export type PassiveId = 'rescoldo' | 'capilaridad' | 'toma-de-tierra' | 'telemetria' | 'nanitos';
export const PASSIVES: Record<PassiveId, { name: string; anima: ClassId }> = {
  rescoldo: { name: 'Rescoldo', anima: 'matemagico' },
  capilaridad: { name: 'Capilaridad', anima: 'matemagico' },
  'toma-de-tierra': { name: 'Toma de tierra', anima: 'matemagico' },
  telemetria: { name: 'Telemetría', anima: 'tecnopata' },
  nanitos: { name: 'Nanitos', anima: 'tecnopata' },
};
export const RESCOLDO = 15, TELEMETRIA = 3;
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
export type FoeKind = 'dog' | 'minion' | 'guardian' | 'cebollon' | 'cebolla' | 'plato' | 'vertigo' | 'vertigo-ojo' | BroodKind | SobremesaKind | CampingKind | CuerdasKind | CastleKind | ModeloKind;
/**
 * The foes of Emilie's model (docs/quests/emilie.md § Fights): what goes wrong in a groundwater model.
 * Each asks one question with water and electricity, by kind of blow and never by who wears what, and
 * shows its answer on its plate. A Celda seca takes half while dry; water wets it, and then
 * electricity is Conducción. An Oscilación shows the value it is on («Agua» or «Eléctrico», the other
 * one every round): a blow of that element is absorbed, one of the other lands hard. La pluma wets
 * one of the party every turn, and the cells that come with it shock whoever is wet. El que no
 * converge, the boss, is all of it: it wets and shocks the party by turns, and only blows of the
 * element it is not on take its Error away, until it converges.
 */
export type ModeloKind = 'celda-seca' | 'oscilacion' | 'pluma' | 'no-converge';
export const MODELO_KINDS = ['celda-seca', 'oscilacion', 'pluma', 'no-converge'] as const satisfies readonly ModeloKind[];
export const isModelo = (kind?: FoeKind): kind is ModeloKind => !!kind && (MODELO_KINDS as readonly string[]).includes(kind);
/** The value an Oscilación or El que no converge is on, as its plate names it. */
export type Sign = 'agua' | 'electrico';
export const SIGNS: Record<Sign, string> = { agua: 'Agua', electrico: 'Eléctrico' };
const otherSign = (sign: Sign): Sign => sign === 'agua' ? 'electrico' : 'agua';
/**
 * Las cuerdas' foes (docs/quests/marta.md § The qualities, § Final boss): what makes Marta herself,
 * loose with nobody to govern it. Each asks one question, by kind of blow and never by who wears what,
 * and shows its answer on its plate, with a few named moves of its own (`cuerdasTurn`). La Lealtad
 * takes the blows aimed at whoever stands with her, hits whoever struck her last and ties her Eco back
 * together. Lo Cristalino sends magic back and breaks under a blow; cracked, it lets magic in and its
 * light out on everyone. Lo Directo says whom it will hit, and hits very hard; its Estocada leaves it
 * stuck. An Eco's blow grows every turn. La Voz, all of them together, can only be hurt while she sings.
 */
export type CuerdasKind = 'lealtad' | 'cristalino' | 'directo' | 'eco' | 'voz';
export const CUERDAS_KINDS = ['lealtad', 'cristalino', 'directo', 'eco', 'voz'] as const satisfies readonly CuerdasKind[];
export const isCuerdas = (kind?: FoeKind): kind is CuerdasKind => !!kind && (CUERDAS_KINDS as readonly string[]).includes(kind);
/**
 * Càmping Eurosport's foes (docs/quests/universidad.md § Càmping Eurosport, Monsters): each asks one
 * question, by kind of blow and never by who wears what, and shows its answer on its plate. A Mago de
 * camping takes half from magic and more from blows, and charges its Bombona a turn ahead (the chip
 * says so). A Dado shows its top face, the weight of its blow this round, and rolls again every round.
 * Agentes come in pairs: one face up, who takes everything, one face down, who takes half (ticks
 * ignore it); they turn over every round. El Campeón, the mini-boss, is a hero or a man in plain
 * clothes, two turns each, as its plate says.
 */
export type CampingKind = 'mago' | 'dado' | 'agente' | 'campeon';
export const CAMPING_KINDS = ['mago', 'dado', 'agente', 'campeon'] as const satisfies readonly CampingKind[];
export const isCamping = (kind?: FoeKind): kind is CampingKind => !!kind && (CAMPING_KINDS as readonly string[]).includes(kind);
/** El Campeón's two forms, as its plate names them. */
export type CampeonForm = 'heroe' | 'paisano';
export const CAMPEON_FORMS: Record<CampeonForm, string> = { heroe: 'Héroe', paisano: 'De paisano' };
/**
 * La Sobremesa's seven (docs/quests/universidad.md § Final boss): the university friends fused into
 * one body, each a foe of their own with their own PV and move. In this order they act each round:
 * Álvaro before Anna (their duo goes off on his turn), Sarah before Miquel, Joan before Soraya.
 */
export const SOBREMESA_FRIENDS = ['alvaro', 'anna', 'sarah', 'miquel', 'joan', 'soraya', 'nico'] as const;
export type SobremesaFriend = (typeof SOBREMESA_FRIENDS)[number];
export type SobremesaKind = `sobremesa-${SobremesaFriend}`;
export const SOBREMESA_NAMES: Record<SobremesaFriend, string> = { alvaro: 'Álvaro', anna: 'Anna', sarah: 'Sarah', miquel: 'Miquel', joan: 'Joan', soraya: 'Soraya', nico: 'Nico' };
export const isSobremesa = (kind?: FoeKind): kind is SobremesaKind => !!kind && kind.startsWith('sobremesa-');
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
  | 'pisoton' | 'barrido' | 'grito' | 'carga' | 'rayo'
  | 'tirada' | 'sopeta' | 'regla-nueva' | 'carta-negra' | 'escala' | 'correccion' | 'cortafuegos' | 'duo-tirada' | 'duo-regla'
  | 'bombona' | 'tumbarse' | 'contrasena' | 'punetazo' | 'recuperarse'
  | 'juramento' | 'lazo' | 'resonancia' | 'destello' | 'estallido' | 'prisma' | 'golpe-directo' | 'en-linea' | 'estocada'
  | 'guardia' | 'nota-clara' | 'coro' | 'aliento' | 'calderon'
  // The castle (src/castle-fight.ts): the pupils, Aurelià, Dirección and the Queen.
  | 'empujon' | 'repaso' | 'chivatazo' | 'pellizco' | 'codazo' | 'orden'
  | 'dictado' | 'pregunta' | 'castigo' | 'sprint' | 'expulsion' | 'record'
  | 'expediente' | 'horario' | 'circular' | 'firma' | 'resolucion' | 'cambio-cargo'
  | 'pegote' | 'envolver' | 'manos' | 'atrapar' | 'aplastar' | 'pompa' | 'suyo'
  | 'chispa' | 'ola' | 'empapa' | 'inunda' | 'descarga-modelo' | 'converge';
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
  tirada: { name: 'Tirada', card: true },
  sopeta: { name: 'Sopeta', card: false },
  'regla-nueva': { name: 'Regla nueva', card: true },
  'carta-negra': { name: 'Carta negra', card: true },
  escala: { name: 'Escala', card: true },
  correccion: { name: 'Corrección', card: true },
  cortafuegos: { name: 'Cortafuegos', card: true },
  'duo-tirada': { name: 'Dúo · Tirada', card: true },
  'duo-regla': { name: 'Dúo · Regla nueva', card: true },
  bombona: { name: 'Bombona', card: true },
  tumbarse: { name: 'Tumbarse', card: false },
  contrasena: { name: 'Contraseña', card: false },
  punetazo: { name: 'Puñetazo', card: false },
  recuperarse: { name: 'Recuperarse', card: true },
  juramento: { name: 'Juramento', card: true },
  lazo: { name: 'Lazo', card: true },
  resonancia: { name: 'Resonancia', card: true },
  destello: { name: 'Destello', card: true },
  estallido: { name: 'Estallido', card: true },
  prisma: { name: 'Prisma', card: true },
  'golpe-directo': { name: 'Golpe directo', card: true },
  'en-linea': { name: 'En línea recta', card: true },
  estocada: { name: 'Estocada', card: true },
  guardia: { name: 'Guardia', card: true },
  'nota-clara': { name: 'Nota clara', card: true },
  coro: { name: 'Coro', card: true },
  aliento: { name: 'Toma aire', card: true },
  calderon: { name: 'Calderón', card: true },
  empujon: { name: 'Empujón', card: true },
  repaso: { name: 'Repaso', card: false },
  chivatazo: { name: 'Chivatazo', card: true },
  pellizco: { name: 'Pellizco', card: false },
  codazo: { name: 'Codazo', card: false },
  orden: { name: 'Orden', card: true },
  dictado: { name: 'Dictado', card: true },
  pregunta: { name: 'Pregunta', card: true },
  castigo: { name: 'Castigo', card: true },
  sprint: { name: 'Sprint', card: true },
  expulsion: { name: 'Expulsión', card: true },
  record: { name: 'Récord', card: true },
  expediente: { name: 'Expediente', card: true },
  horario: { name: 'Horario', card: true },
  circular: { name: 'Circular', card: true },
  firma: { name: 'Acta', card: true },
  resolucion: { name: 'Resolución', card: true },
  'cambio-cargo': { name: 'Cambio de cargo', card: true },
  pegote: { name: 'Pegote', card: false },
  envolver: { name: 'Otra capa', card: true },
  manos: { name: 'Las manos', card: true },
  atrapar: { name: 'Atrapar', card: true },
  aplastar: { name: 'Aplastar', card: false },
  pompa: { name: 'La Pompa', card: true },
  suyo: { name: 'Suyo', card: true },
  chispa: { name: 'Chispa', card: false },
  ola: { name: 'Ola', card: false },
  empapa: { name: 'Empapa', card: false },
  inunda: { name: 'Inunda', card: true },
  'descarga-modelo': { name: 'Descarga', card: true },
  converge: { name: 'Converge', card: true },
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
  flipAt: .5, transparent: .5, sorpresaSingle: .5, sorpresaDual: 1, puaj: 38,
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
/**
 * La Sobremesa (docs/quests/universidad.md § Final boss), every number in one book (`sobremesa.boss`);
 * each friend's PV are their PROFILES entry. Tirada: two dice, each pip `pip` PV in a hundred of the
 * target's most (four dice in the duo with Anna). Sopeta: `sopeta`, `sopetaStep` more each own turn,
 * up to `sopetaMost`, and every friend still held gets `sopetaHeal` of their PV back. Regla nueva: Fuerza +`regla` to one friend for good, up to
 * `reglaMost` (to every friend in the duo with Miquel). Carta negra: announced, then `carta` on whom it marked; in the duo it leaves them at
 * 1 PV unless they hold on. Escala: Joan's note (NOTES) sets his blow on both, `escala[note]`, and
 * climbs one each turn; Soraya's Corrección climbs it one more. Every `duoEvery` own turns a couple
 * announces its duo. Cortafuegos: the next blow on the friend Nico shields lands at `shield`.
 */
export const SOBREMESA = {
  pip: 1.2, dice: 2, duoDice: 4,
  sopeta: 5, sopetaStep: 1.5, sopetaMost: 11, sopetaHeal: .1,
  regla: 2, reglaMost: 4, carta: 12,
  escala: [1, 2, 3, 4, 5, 7, 9],
  duoEvery: 4, shield: .5,
};
/**
 * Càmping Eurosport's foes, every number in one book (`camping.rules`); their PV are their PROFILES
 * entries. A Mago de camping takes `magoMagic` of a magic blow and `magoPhysical` of a physical one,
 * and its Bombona is `bombona` of magic on everyone. A Dado's Tumbarse is `dadoBase` and `dadoPip` for
 * each pip of the face it shows. An Agente face down takes `downTaken` of every blow; its Contraseña is
 * `contrasena`. El Campeón as a hero takes `heroeTaken` and punches `punetazo`; in plain clothes it
 * takes `paisanoTaken` and gets `recuperarse` of its PV back; it changes every `formTurns` own turns.
 */
export const CAMPING = {
  magoMagic: .5, magoPhysical: 1.5, bombona: 26,
  dadoBase: 4, dadoPip: 4,
  downTaken: .5, contrasena: 18,
  heroeTaken: .5, paisanoTaken: 2, punetazo: 56, recuperarse: .1, formTurns: 2,
};
/**
 * Las cuerdas' foes and La Voz (docs/quests/marta.md), every number in one book (`marta.rules`); their
 * PV are their PROFILES entries.
 * La Lealtad's Juramento is `juramento`, on whoever struck her last; every `lazoEvery` own turns, if
 * her Eco is hurt or gone, a Lazo instead: it is whole again (back on its feet, its Resonancia starts
 * over). An Eco's Resonancia starts at `resonancia` and grows `resonanciaStep` each own turn, up to
 * `resonanciaMost`.
 * Lo Cristalino takes `cristalPhysical` of a physical blow and none of a magic one, `reflect` of which
 * goes back to whoever cast it; its Destello is `destello`. At `crack` of its PV it cracks: an
 * Estallido on everyone (`estallido`), magic goes in from then on, and its turns are a Prisma on
 * everyone (`prisma`).
 * Lo Directo goes round DIRECTO_TURNS: Golpe directo (`directo`), En línea recta on everyone
 * (`linea`), and an Estocada (`estocada`) that leaves it stuck until its next turn: every blow on it
 * lands `clavado` times as hard.
 * La Voz: a blow only lands while a note sounds. Every note that starts is an Eco on the whole party,
 * `eco` PV and `ecoStep` more for each Crescendo; every time the phrase comes round, a Crescendo: her
 * Magia up `crescendo`. A second blow by the other fighter inside the same note is an Acorde, `acorde`
 * times as hard. Her Guardia halves the next blow on her (SOBREMESA.shield), her Nota clara sends magic
 * back as Lo Cristalino does, and her Golpe directo is `vozDirecto`. From `allegro` of her PV down she
 * sings Allegro and calls a second voice of `coro` PV, once (Coro); from `capela` down A capela, where she takes a breath
 * and holds a Calderón on everyone (`calderon`) unless an Acorde breaks it first (src/song.ts).
 */
export const MARTA = {
  juramento: 36, lazoEvery: 4, resonancia: 12, resonanciaStep: 12, resonanciaMost: 48,
  cristalPhysical: 1.5, reflect: .5, destello: 34, crack: .5, estallido: 14, prisma: 16,
  directo: 44, linea: 26, estocada: 60, clavado: 3.5,
  // Her song is Marta's recording (src/song.ts): some 64 notes in 87 s, so each Eco starts at nothing and grows a
  // PV every ten Crescendos, and each Crescendo is half a point of Magia (2026-11-19, `just fight-sim`).
  eco: 0, ecoStep: .1, crescendo: .5, acorde: 1.5, vozDirecto: 64, coro: 32, calderon: 20,
  allegro: .6, capela: .25,
};
/**
 * Emilie's model (docs/quests/emilie.md § Fights), every number in one book (`modelo.rules`); PV are
 * each foe's PROFILES entry. A Celda seca takes `seca` of every blow while dry. An Oscilación takes
 * `contra` of a blow of the element it is not on, `plano` of one with no element (or fire), nothing
 * of its own. Chispa, Ola and Empapa are the small foes' blows; `conduce` is what runs through
 * everyone wet in the party when a spark finds one of them. El que no converge: while it iterates it
 * takes `itera` of every blow and nothing of its own element; it starts with `error` marks (`errorDiverge`
 * from `diverge` of its PV, never more than `errorMost`); at none it is solid for `convergeTurns` of
 * its own turns and takes `converge`. Inunda takes `inunda` and wets everyone; its Descarga is
 * `descarga` plus `descargaStep` for each mark of Error, on everyone wet. Holding on takes two thirds off.
 */
export const MODELO = {
  seca: .5, contra: 1.5, plano: .5,
  chispa: 16, ola: 14, empapa: 10, conduce: 22,
  itera: .5, converge: 2, convergeTurns: 2,
  error: 3, errorDiverge: 4, errorMost: 6, diverge: .5,
  inunda: 10, descarga: 20, descargaStep: 7,
};
/** Lo Directo's turns, in order, round and round; each is said a turn ahead. */
export const DIRECTO_TURNS = ['golpe-directo', 'golpe-directo', 'en-linea', 'estocada'] as const;
/**
 * La Voz's turns in each phrase, in order, round and round (a new phrase starts on its first). Andante:
 * one from each of the qualities she is made of. Allegro: the first time, a second voice in place of
 * her Guardia. A capela: a breath, the Calderón it was for, and a Golpe directo.
 */
export const VOZ_TURNS = {
  andante: ['guardia', 'nota-clara', 'golpe-directo'],
  allegro: ['coro', 'nota-clara', 'golpe-directo'],
  'a-capela': ['aliento', 'calderon', 'golpe-directo'],
} as const satisfies Record<'andante' | 'allegro' | 'a-capela', readonly FoeAbilityId[]>;
/** La Voz's three parts, by her PV: each its own round of turns, over the same song. */
export type VozPart = keyof typeof VOZ_TURNS;
export const VOZ_PARTS: Record<VozPart, string> = { andante: 'Andante', allegro: 'Allegro', 'a-capela': 'A capela' };
/** The second voice La Voz calls in Allegro: an Eco by another name, so it is not taken for her song's. */
export const SECOND_VOICE = 'segunda-voz';
/** How hard a Dado's Tumbarse is at average stats with `face` up. */
export const dadoPower = (face: number) => CAMPING.dadoBase + CAMPING.dadoPip * face;
/** Joan's scale, note by note: each one more out of tune. */
export const NOTES = ['Do', 'Re', 'Mi', 'Fa', 'Sol', 'La', 'Si'] as const;
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
export type TimedId = 'quemado' | 'cegado' | 'sanacion' | 'confusion' | 'encogido' | 'mojado';
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
  // Mojado (Vasos comunicantes, Capilaridad): it hurts nobody; it waits for electricity (Conducción) or fire (Vapor).
  mojado: { name: 'Mojado', seconds: 20, every: 20, levels: [], flat: 0, share: 0, cap: 0 },
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
export type ElementReaction = 'humo' | 'cauterizado' | 'tormenta' | 'vapor' | 'conduccion';
/**
 * With Mojado: Fuego on it is Vapor (the water goes up and leaves Cegado I), and Eléctrico on it is
 * Conducción (`conduct` of magic on everyone wet, who are left dry). A foe's bolt on the party lands
 * whole on the one it struck and `share` of it on the others wet. Either way, whoever was struck wet
 * is left in Shock with a chance of `shock`: their next turn is lost (`Combatant.shock`).
 */
export const REACTION_RULES = { blind1: .7, blind2: .5, blind3: .3, cauterize: 6, storm: 24, conduct: 20, shock: .5, share: .5 };
/**
 * What a foe is made of (docs/combat.md § Debilidades por elemento): a blow carrying an element it is
 * weak to lands `weak` times as hard, one it resists `resist`. By kind of foe and by element, never by
 * who strikes or with which skill: Atacar with an element, a skill of that element and a dual made
 * with one all count. Nothing says it beforehand; the first blow that finds it does (`BattleEffect.affinity`),
 * and from then on the foe's plate keeps it. Few foes have one, and only where it is part of the
 * fight's answer. Tunable (`just fight-sim`, book `element`).
 */
export const ELEMENT_RULES = { weak: 1.5, resist: .5 };
export type Affinity = 'weak' | 'resist';
export const AFFINITIES: Partial<Record<FoeKind, Partial<Record<Element, Affinity>>>> = {
  // Onions fry: fire goes through every layer's worth of them.
  cebollita: { fuego: 'weak' }, cebolla: { fuego: 'weak' }, cebollon: { fuego: 'weak' },
  // A fantasmita is a screen's ghost: a spark undoes it, water goes straight through.
  fantasmita: { electrico: 'weak', agua: 'resist' },
  // Vertitrón is a machine: water gets in, and its own lightning does little to it.
  vertigo: { agua: 'weak', electrico: 'resist' },
  // The Queen's gum softens with heat.
  minion: { fuego: 'weak' }, guardian: { fuego: 'weak' },
  // A mago de camping lives by its gas flame: fire is its own, water puts it out.
  mago: { agua: 'weak', fuego: 'resist' },
  // Lo Directo is a lance, a rod in a storm; an Eco is air, and fire eats it.
  directo: { electrico: 'weak' }, eco: { fuego: 'weak' },
};
/** What `element` finds in `c`: a weakness, a resistance or nothing. */
export const affinityOf = (c: Pick<Combatant, 'kind' | 'affinities'>, element?: Element): Affinity | undefined => element && c.kind ? (c.affinities ? c.affinities[element] : AFFINITIES[c.kind]?.[element]) : undefined;
const affinityScale = (c: Combatant, element?: Element) => { const a = affinityOf(c, element); return a ? ELEMENT_RULES[a] : 1; };
/** The element a skill or a dual lands with: its own, or the one of what it lights (Foc Binari burns, Explosión melts: fire). */
export function elementOf(spec?: object): Element | undefined {
  if (!spec) return undefined;
  const s = spec as { element?: Element; burn?: TimedId; melts?: boolean };
  return s.element ?? (s.burn ? TIMED[s.burn].element : undefined) ?? (s.melts ? 'fuego' : undefined);
}
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
  /** Dadaísta's maná as dice: the face of each point it holds, worn or resting (`diceOf` keeps them in step). */
  dice?: number[];
  /** Dadaísta: they took part in a dual attack, and the next die dealt to them is likelier the Joker (`JOKER_AFTER_DUAL`). */
  jokerDue?: boolean;
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
  /** The round Toma de tierra last gave this fighter a maná back. */
  grounded?: number;
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
  /** In Shock (a bolt found them wet): their next turn is lost, and it is gone with it. Shown as a status. */
  shock?: boolean;
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
  /** Joan's place on his scale (NOTES): his next note. */
  note?: number;
  /** Cortafuegos: the next damaging blow on this foe lands at SOBREMESA.shield, and spends it. It fades at the end of round `shielded`. */
  shielded?: number;
  /** A Dado: the face it shows this round (1–6), the weight of its blow. */
  face?: number;
  /** An Agente: face up (it takes every blow whole) or face down (half). */
  faceUp?: boolean;
  /** El Campeón: its form, and its own turns left in it before it changes. */
  form?: CampeonForm; formLeft?: number;
  /** La Voz's Nota clara: until her next turn magic comes back at whoever cast it, as off Lo Cristalino. */
  clear?: boolean;
  /** La Voz: how many times her phrase has come round (Crescendo), and whether she is silent now (kept by the fight's clock for whoever draws her). */
  crescendo?: number; silent?: boolean;
  /** La Lealtad: who struck her last (an ally's id): whom her Juramento, and her Eco's Resonancia, are for. */
  sworn?: string;
  /** La Lealtad: who struck her last this round. Her oath moves to them when the round ends, never inside it, so whoever it names can hold on. */
  struck?: string;
  /** Lo Cristalino has cracked: magic goes in, and its light comes out on everyone (Prisma). */
  cracked?: boolean;
  /** Lo Directo after its Estocada: stuck until its next turn, every blow on it lands MARTA.clavado times as hard. */
  stuck?: boolean;
  /** La Voz: an Acorde broke the Calderón she was holding her breath for; her next turn is lost to it. */
  winded?: boolean;
  /** The castle's rules on this fighter (src/castle.ts `CastleMark`). */
  castle?: CastleMark;
  /** What this one is weak to or resists, when it is its own and not its kind's (`AFFINITIES`): a pupil's year, a directiva's element, the Queen's gum. */
  affinities?: Partial<Record<Element, Affinity>>;
  /** An Oscilación, El que no converge: the value it is on now, on its plate; the other one next round. */
  sign?: Sign;
  /** El que no converge: its marks of Error, on its plate. */
  error?: number;
  /** El que no converge has converged: its own turns left as a solid body (no move, every blow harder). */
  converged?: number;
  /** El que no converge is past its mark: Diverge, its second phase. */
  diverged?: boolean;
  /** El que no converge: the water of its Inunda ran off the party on the fight's clock, before its Descarga came. */
  drained?: boolean;
  /** El que no converge has seen the party wait its water out once (nothing says so but the look it gave): it will not shock a dried party again. */
  wary?: boolean;
}
/** Whom a move is aimed at when it is not one ally: everyone. */
export type Aim = 'todos';
/** Which fight this is: the street dogs, the palace minion that wakes Matemágico, or the palace guards of chapter 2. */
/** `escolta`: ring 3's fear, La Cebolla y los suyos (La Cebolla, a fantasmita and a cebollita). */
export type Encounter = 'dogs' | 'palace-minion' | 'palace-guards' | 'night-guard' | 'cebollon' | 'cebolla' | 'plato' | 'escolta' | 'uri-vertigo' | 'sobremesa' | BroodEncounter | CampingEncounter | CuerdasEncounter | CastleEncounter | ModeloEncounter;
/** The young that chase the party up each ring of Uri's tower, a few at a time. */
export const BROOD_ENCOUNTERS = ['crias-1', 'crias-2', 'crias-3'] as const;
export type BroodEncounter = (typeof BROOD_ENCOUNTERS)[number];
/**
 * Càmping Eurosport's fights (docs/quests/universidad.md § Càmping Eurosport): the entrance's magos,
 * the pitches' dados and agentes, a wrong pitch's tent waking, the black pitch, and El Campeón by the pool.
 */
export const CAMPING_ENCOUNTERS = ['camping-magos', 'camping-dados', 'camping-agentes', 'camping-tienda', 'camping-negra', 'campeon'] as const;
export type CampingEncounter = (typeof CAMPING_ENCOUNTERS)[number];
/** Who comes out in each of them, in the order they stand. */
export const CAMPING_FIGHTS: Record<CampingEncounter, readonly CampingKind[]> = {
  'camping-magos': ['mago', 'mago'],
  'camping-dados': ['dado', 'dado', 'dado'],
  'camping-agentes': ['agente', 'agente'],
  'camping-tienda': ['dado', 'agente', 'agente'],
  'camping-negra': ['mago', 'mago', 'dado', 'dado'],
  campeon: ['campeon'],
};
/** Las cuerdas' fights (docs/quests/marta.md): a quality on each platform after a maze, and La Voz where every string meets. */
export const CUERDAS_ENCOUNTERS = ['cuerdas-lealtad', 'cuerdas-cristalino', 'cuerdas-directo', 'voz'] as const;
export type CuerdasEncounter = (typeof CUERDAS_ENCOUNTERS)[number];
/** Who comes out in each of them, in the order they stand. */
export const CUERDAS_FIGHTS: Record<CuerdasEncounter, readonly CuerdasKind[]> = {
  'cuerdas-lealtad': ['lealtad', 'eco'],
  'cuerdas-cristalino': ['cristalino'],
  'cuerdas-directo': ['directo'],
  voz: ['voz'],
};
/** The fights inside Emilie's model (docs/quests/emilie.md): one for each zone of the section, and El que no converge at the bottom. */
export const MODELO_ENCOUNTERS = ['modelo-celdas', 'modelo-oscilacion', 'modelo-pluma', 'no-converge'] as const;
export type ModeloEncounter = (typeof MODELO_ENCOUNTERS)[number];
/** Who comes out in each of them, in the order they stand. */
export const MODELO_FIGHTS: Record<ModeloEncounter, readonly ModeloKind[]> = {
  'modelo-celdas': ['celda-seca', 'celda-seca', 'celda-seca'],
  'modelo-oscilacion': ['oscilacion', 'oscilacion'],
  'modelo-pluma': ['pluma', 'celda-seca', 'celda-seca'],
  'no-converge': ['no-converge'],
};
/** Uri's maze and roof (docs/quests/nuria.md), La Sobremesa, the campsite, Las cuerdas, the castle and Emilie's model: the fights whose foes have rules of their own. */
export const FEAR_ENCOUNTERS = ['cebollon', 'cebolla', 'plato', 'escolta', 'uri-vertigo', 'sobremesa', ...BROOD_ENCOUNTERS, ...CAMPING_ENCOUNTERS, ...CUERDAS_ENCOUNTERS, ...CASTLE_ENCOUNTERS, ...MODELO_ENCOUNTERS] as const;
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
  /**
   * Elements the place lends to everyone's Atacar for this fight, whatever they wear and whatever the
   * jar has given (inside Emilie's model: its two variables, water and electricity).
   */
  lent?: Element[];
  /** Who acted wearing each ánima this fight (src/levels.ts `participants`: the ánimas a win teaches). */
  fought?: Partial<Record<ClassId, string[]>>;
  /** Development: EXP added to what the foes are worth (the picker's «Victoria subiendo de nivel»). */
  extraXp?: number;
  /**
   * La Voz's song (docs/quests/marta.md § Final boss): the part she is in (by her PV), seconds into
   * her recording on the fight's clock (`VOZ_SONG`, the same in every part), and who last landed a
   * blow on her and in which note (`struck`, for the Acorde).
   */
  song?: { part: VozPart; t: number; struck?: { loop: number; index: number; by: string } };
  /** What the song did since it was last asked (`takeSongNews`): an Eco, a Crescendo, a new part. */
  songNews?: SongNews[];
  /** The castle's rules on this fight (src/castle.ts `CastleFight`). */
  castle?: CastleFight;
}
/** Something the song did on its own, for the fight to show. */
export type SongNews =
  | { kind: 'eco'; tone: ToneId; hits: { target: string; amount: number }[] }
  | { kind: 'crescendo'; level: number }
  | { kind: 'part'; part: VozPart };
/** A choice queued ahead by an ally later in the round (`queue`). */
export interface Queued { action: 'attack' | 'defend' | 'skill'; skill?: SkillId; target?: string; die?: number }
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
export const cornered = (state: BattleState) => state.possessed || state.encounter === 'palace-minion' || state.encounter === 'uri-vertigo' || state.encounter === 'sobremesa'
  // The black pitch puts every lantern out round them, and El Campeón stands between them and the way on.
  || state.encounter === 'camping-negra' || state.encounter === 'campeon'
  // Where every string meets there is nowhere to back off to.
  || state.encounter === 'voz' || state.encounter === 'no-converge'
  // Nobody walks out of Aurelià's class, of Direcció or of the throne room.
  || state.encounter === 'aurelia' || state.encounter === 'direccion' || state.encounter === 'reina' || state.encounter === 'reina-vuelta';
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
  return SKILLS.filter(skill => actor.classId === skill.class && learned(state, skill.id));
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
  /** Dadaísta defending: the faces of the dice that maná came as. */
  dealt?: number[];
  /**
   * A skill that spent a die (Dadaísta): its `face` (`JOKER`: the blow is on every foe, the others in
   * `splash`); for a bet (Doble o nada), what it `rolled` when thrown again and whether that `won`
   * (lost: no blow, and the die is gone all the same).
   */
  die?: { face: number; at: number; rolled?: number; won?: boolean };
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
  hits?: { target: string; amount: number; status?: { id: StatusId; stacks: number }; peeled?: number; bled?: number; weakSpot?: true; burn?: { id: TimedId; level: number }; smoked?: true; affinity?: Affinity }[];
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
  /** The blow's element found what the foe is made of: its weakness or its resistance (`AFFINITIES`). In `hits` when it reaches several. */
  affinity?: Affinity;
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
  /** La Sobremesa's Sopeta: besides its blow, what each friend still held got back. */
  soothed?: { target: string; amount: number }[];
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
  /** La Sobremesa: the dice Álvaro threw (Tirada), and the friend Nico shielded (Cortafuegos) or a shield this blow spent. */
  dice?: number[]; shielded?: string; shield?: 'spent';
  /** El Campeón changed form at the end of this turn: the one it is in now. */
  form?: CampeonForm;
  /** La Lealtad stepped in: the foe the blow was aimed at (`target` is her). */
  interposed?: string;
  /** Magic sent back (Lo Cristalino, La Voz's Nota clara): the PV it took off whoever cast it. */
  reflected?: number;
  /** A blow on La Voz between two notes: it went through her. */
  silent?: true;
  /** A second blow on La Voz inside the same note, by the other fighter: an Acorde. */
  chord?: true;
  /** La Voz's Nota clara: magic comes back until her next turn. */
  clear?: true;
  /** La Lealtad's Lazo: the Eco it made whole again, the PV it got back, and whether it had fallen. */
  lazo?: { target: string; amount: number; back: boolean };
  /** Lo Cristalino cracked with this (its Estallido). */
  cracked?: true;
  /** Lo Directo's Estocada left it stuck. */
  stuck?: true;
  /** La Voz's Coro: the second voice it called (a foe's id). */
  summoned?: string;
  /** Passives that did something in this action (PASSIVES), and over whom to say so. */
  passives?: { id: PassiveId; name: string; who: string }[];
  /** Maná a passive gave back to the actor (Toma de tierra). */
  mana?: number;
  /** Control remoto: the foe `target` turned on, and the PV it took from it. */
  controlled?: { victim: string; amount: number };
  /** Nanitos: the timed statuses a cure took off its target. */
  cleared?: TimedId[];
  /** Things a rule of the fight says by name over someone (the castle's: «Respuesta correcta», «Tropiezo», «No firma»). */
  called?: { target: string; text: string; detail?: string }[];
  /** Water left these Mojado: a foe's on the party (Ola, Empapa, Inunda), or anyone's on a Celda seca, which switches on. */
  wetted?: string[];
  /** A foe's spark ran through everyone wet in the party (their PV are `amount` and `splash`), and left them dry. */
  conducted?: true;
  /** El que no converge: its marks of Error after this blow, when it changed them (`mark`: one fewer or one more). */
  error?: { left: number; mark: 'off' | 'on' };
  /** El que no converge converged with this blow, or diverged again; an Oscilación or the boss is now on `sign`. */
  converged?: true; diverged?: true; sign?: Sign;
  /** Left in Shock by this blow (a bolt on someone wet): their next turn is lost. */
  shocked?: string[];
  /** This foe's turn, lost to Shock: nothing else happened in it. */
  stunned?: true;
  /** El que no converge saw the party wait its water out, the first time: its figures stop for a moment (src/modelo-foes.ts). */
  wary?: true;
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
function hurt(state: BattleState, c: Combatant, amount: number) {
  // La Voz is only there while she sings: between two notes nothing reaches her, not even a fire already on her.
  if (silenced(state, c)) return 0;
  return changeHealth(c, -Math.max(0, Math.min(amount, c.hp)));
}
/** What La Voz's song is on now (`undefined` in any other fight). */
export const songNow = (state: BattleState): Moment | undefined => state.song ? songAt(VOZ_SONG, state.song.t) : undefined;
/** Whether `c` is La Voz between two notes: nothing hurts her then. */
export const silenced = (state: BattleState, c: Combatant) => c.kind === 'voz' && !!state.song && !songNow(state)!.sounding;
/** Whether magic comes back off `c`: Lo Cristalino until it cracks, La Voz while her Nota clara lasts. */
export const reflects = (c: Combatant) => c.hp > 0 && ((c.kind === 'cristalino' && !c.cracked) || (c.kind === 'voz' && !!c.clear));
/** La Lealtad, if she stands and `target` is another foe: she takes the blow aimed at it. */
const guardOf = (state: BattleState, target: Combatant) => target.kind === 'lealtad' ? undefined : state.foes.find(f => f.kind === 'lealtad' && f.hp > 0);
/**
 * A blow on La Voz inside a note someone else already struck her in is an Acorde: `acorde` times as
 * hard, once a note. Returns the scale; `landed` (after the blow) remembers who struck, or spends it.
 */
function chordScale(state: BattleState, actor: Combatant, target: Combatant) {
  const now = target.kind === 'voz' ? songNow(state) : undefined, struck = state.song?.struck;
  return now?.sounding && struck && struck.loop === now.loop && struck.index === now.index && struck.by !== actor.id ? MARTA.acorde : 1;
}
function landed(state: BattleState, actor: Combatant, target: Combatant, amount: number, chord: number, effect: BattleEffect) {
  const now = target.kind === 'voz' ? songNow(state) : undefined;
  if (!now?.sounding || !state.song || amount <= 0) return;
  if (chord > 1) {
    effect.chord = true; delete state.song.struck;
    // An Acorde breaks the Calderón she was holding her breath for: her next turn is lost to it.
    if (target.intent?.ability === 'calderon' && target.hp > 0) { delete target.intent; target.winded = true; effect.cancelled = 'calderon'; }
  } else state.song.struck = { loop: now.loop, index: now.index, by: actor.id };
}
/** The whole party down ends the fight (magic sent back can do it on the party's own turn). */
function fallen(state: BattleState) {
  if (!state.allies.every(a => a.hp === 0)) return false;
  state.phase = 'lost'; state.message = 'Todo se vuelve rosa… y luego negro.'; endFight(state);
  return true;
}
/** Rounds a Punto débil on `c` still lasts, this one included (0: none). */
export const weakSpotRounds = (state: BattleState, c: Combatant) => c.weakSpot !== undefined && c.weakSpot >= state.round && c.hp > 0 ? c.weakSpot - state.round + 1 : 0;
/**
 * Dadaísta's maná is dice (docs/animas/dadaista/): each point is a die with its face in view, rolled
 * when the maná comes (the fight's start, Defender, a round's rest). A skill with `die` spends the
 * one chosen, whatever comes of it, and that face says how hard it lands.
 */
export const DICED: ClassId = 'dadaista';
/**
 * The Joker: a die that now and then comes in place of a face (`JOKER_CHANCE` of the dice dealt). It
 * is the best a skill can ask of a die (a six for a blow by its face, a bet that cannot be lost), and
 * its blow falls on every foe standing. A dual attack calls it: the next die dealt to whoever took
 * part in one (`Combatant.jokerDue`) is the Joker `JOKER_AFTER_DUAL` of the times.
 */
export const JOKER = 7, JOKER_CHANCE = .02, JOKER_AFTER_DUAL = .2;
/** A die dealt to `c`'s hand: a face from 1 to 6 or, rarely, the Joker (less rarely on the first die after a dual). */
function dealDie(state: BattleState, c: Combatant) {
  const chance = c.jokerDue ? JOKER_AFTER_DUAL : JOKER_CHANCE, r = roll(state);
  delete c.jokerDue;
  return r < chance ? JOKER : 1 + Math.floor((r - chance) / (1 - chance) * 6);
}
/** One roll of the fight's dice, 1 to 6. */
export const d6 = (state: BattleState) => 1 + Math.floor(roll(state) * 6);
/**
 * `c`'s dice, in the order they came: as many as their Dadaísta holds maná now, whether they wear it
 * or it rests. Maná that came since the last look is rolled here, so the hand is always in step.
 */
export function diceOf(state: BattleState, c: Combatant): number[] {
  if (!state.allies.includes(c) || (c.classId !== DICED && !kitIn(state, c).includes(DICED))) return [];
  const most = manaMax(state.improved, DICED), count = c.classId === DICED ? c.secondary : Math.min(most, c.mana?.[DICED] ?? most);
  const hand = c.dice ??= [];
  while (hand.length < count) hand.push(dealDie(state, c));
  hand.length = Math.min(hand.length, count);
  return hand;
}
/** Whether `skill` spends a die, and how it reads it: its `face` as its strength, or as a `bet`. */
export const dieUse = (skill?: SkillId): 'face' | 'bet' | undefined => { const spec = SKILLS.find(s => s.id === skill); return spec && 'die' in spec ? spec.die : undefined; };
/** The die a skill takes when nobody chose: the Joker if there is one; else the highest for a blow by its face; for a bet the highest of the sure ones (3 or less), else the lowest. */
export function bestDie(skill: SkillId, hand: readonly number[]) {
  if (!dieUse(skill) || !hand.length) return -1;
  if (hand.includes(JOKER)) return hand.indexOf(JOKER);
  const sure = hand.filter(face => face <= 3);
  return hand.indexOf(dieUse(skill) === 'bet' ? sure.length ? Math.max(...sure) : Math.min(...hand) : Math.max(...hand));
}
/** What `skill` lands with a die of `face` at average stats, before a bet doubles it (the Joker lands as a six). */
export const diePower = (skill: SkillId, face: number) => { const spec = SKILLS.find(s => s.id === skill); return spec && 'pip' in spec ? spec.power + spec.pip * Math.min(face, 6) : 0; };
/**
 * The die a Dadaísta skill spends: `index` in the hand (or the one `bestDie` would take). It is gone
 * from the hand whatever happens. A bet rolls it again: the same or higher and the blow lands twice;
 * lower, and there is no blow. The Joker is never rolled: its bet is won, and its blow is on `all`.
 */
function castDie(state: BattleState, actor: Combatant, skill: SkillId, index: number | undefined, effect: BattleEffect) {
  const hand = diceOf(state, actor), at = index !== undefined && hand[index] ? index : bestDie(skill, hand), face = hand[at];
  const power = diePower(skill, face);
  const all = face === JOKER;
  hand.splice(at, 1); actor.secondary--;
  if (dieUse(skill) === 'bet') {
    const rolled = all ? JOKER : d6(state), won = rolled >= face;
    effect.die = { face, at, rolled, won };
    return { power, times: won ? 2 : 0, lost: !won, all };
  }
  effect.die = { face, at };
  return { power, times: 1, lost: false, all };
}
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
  const have = [...actor.classId ? state.improved?.elements?.[actor.classId] ?? [] : [], ...state.lent ?? []];
  return have.length ? ELEMENT_ORDER.filter(id => have.includes(id)) : [];
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
 * Any story encounter as a fight starts: what the fight screen opens (src/battle-ui.ts) and what the
 * whole-game simulator plays (src/game-sim.ts), one dispatch for both, so an encounter added here is
 * met the same on screen and headless.
 */
export function createEncounter(slots: PartySlot[], encounter: Encounter, options: { foeCount?: number; possessed?: boolean; animas?: ClassId[]; guards?: GuardStrength; random?: () => number } = {}): BattleState {
  const { foeCount = 1, possessed = false, animas, guards = palaceGuards(0), random } = options;
  return (FEAR_ENCOUNTERS as readonly string[]).includes(encounter) ? createFearBattle(slots, encounter as (typeof FEAR_ENCOUNTERS)[number], animas, random)
    : encounter === 'palace-minion' ? createMinionBattle(slots[0]?.classId, animas)
    : encounter === 'palace-guards' || encounter === 'night-guard' ? createGuardBattle(slots, guards, animas, encounter)
    : createBattle(slots, foeCount, possessed, undefined, animas);
}
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
  plato: { id: 'plato', name: 'El Plato Misterioso', kind: 'plato' as const, power: 38, message: 'La campana tiembla sobre el plato. Algo dentro se mueve.' },
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
  if (isCastleEncounter(encounter)) return createCastleBattle(castleKit, party, encounter, animas, random);
  if (encounter === 'sobremesa') return createSobremesaBattle(party, animas, random);
  if ((CAMPING_ENCOUNTERS as readonly string[]).includes(encounter)) return createCampingBattle(party, encounter as CampingEncounter, animas, random);
  if ((CUERDAS_ENCOUNTERS as readonly string[]).includes(encounter)) return createCuerdasBattle(party, encounter as CuerdasEncounter, animas, random);
  if ((MODELO_ENCOUNTERS as readonly string[]).includes(encounter)) return createModeloBattle(party, encounter as ModeloEncounter, animas, random);
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
function strike(state: BattleState, actor: Combatant, target: Combatant, skill?: Skill, power: number = skill?.power ?? 18) {
  const stats = current(state, actor), guard = current(state, target);
  if (!skill) return physical(18, stats, guard);
  return skill.kind === 'magic' ? magical(power, stats, guard) : physical(power, stats, guard);
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
function fearDamage(state: BattleState, target: Combatant, damage: number, blow: Blow, element?: Element) {
  let out = damage;
  if (target.dish) {
    const dish = DISHES[target.dish];
    out *= blow === 'dual' ? Math.max(dish.physical, dish.magic) : dish[blow];
    if (target.dish === 'sorpresa') out *= blow === 'dual' ? FEAR_RULES.sorpresaDual : FEAR_RULES.sorpresaSingle;
  }
  if (target.layers) out /= 2;
  if (target.transparent && blow === 'physical') out *= FEAR_RULES.transparent;
  out *= campingTaken(target, blow) * cuerdasTaken(target, blow) * castleTaken(state, target, blow) * modeloTaken(target, element);
  // Magic off glass does nothing at all (Lo Cristalino, La Voz's Nota clara).
  return out <= 0 ? 0 : Math.max(1, Math.round(out));
}
/** What the fight says when the last foe falls. */
function winMessage(state: BattleState) {
  return state.encounter === 'cebollon' ? 'El Cebollón se queda sin capas. Debajo no había nada. Ya no pica.'
    : state.encounter === 'cebolla' ? 'La cebolla, ya del tamaño de un puño, rueda hasta el borde y cae. Se os pasa el picor.'
    : state.encounter === 'plato' ? 'La campana cae al suelo. El plato, vacío. Uri, a lo lejos: «¡Puaj!».'
    : state.encounter === 'escolta' ? 'La Cebolla rueda hasta el borde y se lleva a los suyos. Arriba, Uri ya no se ríe.'
    : state.encounter === 'uri-vertigo' ? 'Vertitrón cae de rodillas. Uri baja con Nil en brazos, y el violeta se le va de los ojos.'
    : state.encounter === 'sobremesa' ? 'La Sobremesa se deshace sobre la hierba. Quedan siete personas tumbadas entre las sillas, mirándose como si acabaran de llegar.'
    : isCampingFight(state) ? CAMPING_WON[state.encounter as CampingEncounter]
    : isCuerdasFight(state) ? CUERDAS_WON[state.encounter as CuerdasEncounter]
    : isCastleEncounter(state.encounter) ? castleWinMessage(state)
    : isModeloFight(state) ? MODELO_WON[state.encounter as ModeloEncounter]
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
/** Every foe down. The Queen is looked at first: whatever brings her below a tenth, she takes Aitor instead of falling (src/castle-fight.ts). */
const beaten = (state: BattleState) => {
  if (state.foes.some(f => f.kind === 'reina')) checkEye(state);
  return state.foes.every(f => f.hp <= 0 || f.part);
};
/** What src/castle-fight.ts borrows from here: this file's own stats, PV and line-up. */
const castleKit: CastleKit = { current: (state, c) => current(state, c), changeHealth: (target, delta) => changeHealth(target, delta), sighted: (actor, raw) => sighted(actor, raw), foe: (id, name, kind, hp) => foe(id, name, kind, hp), lineUp: (party, unlocked) => lineUp(party, unlocked), seedFrom: random => seedFrom(random) };
/** A fight over: nothing queued or spent is left behind. */
function endFight(state: BattleState) { delete state.queued; delete state.spent; }
/**
 * After an action: the fight is won, or an ally still to act chooses, or the foes' turn comes. The
 * one who acted is through for the round (`spent`); allies may act in any order (two players choose
 * at once, docs/combat.md), so the next is whoever is left, the first in party order.
 */
function settle(state: BattleState) {
  if (beaten(state)) { state.phase = 'won'; state.message = winMessage(state); endFight(state); return; }
  const actor = state.allies[state.active];
  if (actor && !state.spent?.includes(actor.id)) (state.spent ??= []).push(actor.id);
  const next = state.allies.findIndex(a => a.hp > 0 && !state.spent?.includes(a.id));
  if (next >= 0) state.active = next;
  else { state.phase = 'enemy'; delete state.queued; }
}
/** An onion out of layers: a cebollita will wrap itself in a new one, once (its intent shows it, «Pelada»). */
function bare(c: Combatant) {
  if (c.kind === 'cebollita' && !c.regrown && c.hp > 0) c.intent = { ability: 'capa-nueva' };
}
/** Rounds a Cortafuegos on `c` still lasts, this one included (0: none). */
export const shieldRounds = (state: BattleState, c: Combatant) => c.shielded !== undefined && c.shielded >= state.round && c.hp > 0 ? c.shielded - state.round + 1 : 0;
/** Punto débil and Cortafuegos on `c` now: how many times as hard the next damaging action lands (1: neither). */
const weakScale = (state: BattleState, c: Combatant) => (weakSpotRounds(state, c) ? WEAK_SPOT : 1) * (shieldRounds(state, c) ? SOBREMESA.shield : 1);
/** A blow that took PV off a shielded foe spends its Cortafuegos. */
function spendShield(state: BattleState, c: Combatant, amount: number, effect: BattleEffect) {
  if (amount > 0 && shieldRounds(state, c)) { delete c.shielded; effect.shield = 'spent'; }
}
/**
 * Shock: a bolt found `who` wet. Half the time (`REACTION_RULES.shock`) it leaves them unable to act:
 * their next turn is lost. Whoever has no turn of their own (a part), or has fallen, takes none.
 */
function shock(state: BattleState, who: Combatant, effect: BattleEffect) {
  if (who.hp <= 0 || who.part || who.shock || roll(state) >= REACTION_RULES.shock) return;
  who.shock = true;
  effect.shocked = [...effect.shocked ?? [], who.id];
  state.message += ` ¡${who.name} queda en shock!`;
}
/** An element has landed on `target` with Atacar: what it turns (`REACTION_RULES`), if it finds anything to turn. */
function react(state: BattleState, actor: Combatant, target: Combatant, element: Element, effect: BattleEffect, reach = false) {
  const fire = target.timed?.quemado, bleeding = stacks(target, 'sangrado');
  const wet = state.foes.filter(f => f.hp > 0 && f.timed?.mojado);
  if (target.hp > 0 && element === 'agua' && fire) {
    effect.reaction = { id: 'humo', level: smoke(target) };
    state.message += ` ¡El agua apaga el fuego! ${TIMED.cegado.name} ${roman(fire.level)}.`;
  } else if (target.hp > 0 && element === 'fuego' && bleeding) {
    delete target.statuses!.sangrado;
    const amount = hurt(state, target, bleeding * REACTION_RULES.cauterize);
    effect.reaction = { id: 'cauterizado', stacks: bleeding, hits: [{ target: target.id, amount }] };
    state.message += ` ¡Cauteriza la herida! −${amount} PV.`;
  } else if (target.hp > 0 && element === 'fuego' && target.timed?.mojado) {
    effect.reaction = { id: 'vapor', level: steam(target) };
    state.message += ` ¡El agua se va en vapor! ${TIMED.cegado.name} I.`;
  } else if (target.hp > 0 && element === 'electrico' && target.timed?.cegado) {
    const hits = state.foes.filter(f => f.hp > 0 && f.timed?.cegado).map(f => {
      delete f.timed!.cegado;
      return { target: f.id, amount: hurt(state, f, fearDamage(state, f, magical(REACTION_RULES.storm, current(state, actor), current(state, f)) * affinityScale(f, 'electrico'), 'magic', 'electrico')) };
    });
    effect.reaction = { id: 'tormenta', hits };
    state.message += ` ¡La descarga salta por el humo! ${hits.map(h => `−${h.amount}`).join(', ')} PV.`;
  } else if (element === 'electrico' && wet.length && (reach || (target.hp > 0 && target.timed?.mojado))) {
    // Conducción: the water carries it to everyone wet (a skill's reaches them wherever it landed), and dries.
    const struck = target.hp > 0 && !!target.timed?.mojado;
    const hits = wet.map(f => {
      delete f.timed!.mojado;
      return { target: f.id, amount: hurt(state, f, fearDamage(state, f, magical(REACTION_RULES.conduct, current(state, actor), current(state, f)) * affinityScale(f, 'electrico'), 'magic', 'electrico')) };
    });
    effect.reaction = { id: 'conduccion', hits };
    state.message += ` ¡La corriente corre por el agua! ${hits.map(h => `−${h.amount}`).join(', ')} PV.`;
    if (struck) shock(state, target, effect);
  }
  if (effect.reaction) ground(state, actor, effect);
}
/** Humo: the fire on `c` goes out and leaves Cegado at its level. Returns that level. */
function smoke(c: Combatant) {
  const { quemado: fire, ...rest } = c.timed!;
  c.timed = { ...rest, cegado: { level: fire!.level, left: TIMED.cegado.seconds, next: TIMED.cegado.every } };
  return fire!.level;
}
/** Vapor: the water on `c` goes up and leaves Cegado I (a longer or higher smoke stays). Returns its level. */
function steam(c: Combatant) {
  const { mojado: _out, ...rest } = c.timed!;
  const on = rest.cegado && rest.cegado.until === undefined ? rest.cegado : undefined;
  c.timed = { ...rest, cegado: { level: Math.max(1, on?.level ?? 0), left: TIMED.cegado.seconds, next: TIMED.cegado.every } };
  return c.timed.cegado!.level;
}
/** Whether `actor` wears the ánima of the passive `id` and has it. */
const passive = (state: BattleState, actor: Combatant, id: PassiveId) => actor.classId === PASSIVES[id].anima && !!state.improved?.passives?.includes(id);
/** A passive did something: the fight shows it over whoever has it. */
function note(effect: BattleEffect, id: PassiveId, who: Combatant) {
  if (!effect.passives?.some(p => p.id === id)) effect.passives = [...effect.passives ?? [], { id, name: PASSIVES[id].name, who: who.id }];
}
/** Toma de tierra: a reaction its wearer set off gives a maná back, once a round. */
function ground(state: BattleState, actor: Combatant, effect: BattleEffect) {
  if (!passive(state, actor, 'toma-de-tierra') || actor.grounded === state.round || actor.secondary >= actor.maxSecondary) return;
  actor.grounded = state.round; actor.secondary++;
  effect.mana = 1; note(effect, 'toma-de-tierra', actor);
  state.message += ' Toma de tierra: maná +1.';
}
/** A fire `actor` lit on `c`: with Rescoldo it lasts longer. */
function bank(state: BattleState, actor: Combatant, c: Combatant, effect: BattleEffect) {
  if (!passive(state, actor, 'rescoldo') || !c.timed?.quemado) return;
  c.timed.quemado.left = RESCOLDO; note(effect, 'rescoldo', actor);
}
export function act(state: BattleState, action: BattleAction, targetId?: string, skill?: SkillId, die?: number): BattleEffect | undefined {
  if (state.phase !== 'player') return;
  const actor = state.allies[state.active];
  if (!actor || actor.hp <= 0) return;
  const ability = SKILLS.find(s => s.id === skill);
  const targets = validTargets(state, action, skill);
  const party = action === 'skill' && ability?.side === 'party';
  const everyone = action === 'skill' && ability?.side === 'all-foes';
  let target = party ? undefined : everyone ? targets[0] : targets.find(f => f.id === targetId);
  if ((action === 'attack' || action === 'skill') && !target && !(party && targets.length)) return;
  if (action === 'skill' && (!ability || actor.secondary < ability.cost || !skillsFor(state, actor).includes(ability))) return;
  const effect: BattleEffect = { actor: actor.id, kind: action };
  // La Lealtad steps in front of whoever a blow is aimed at (one that reaches every foe gets past her).
  const aimedAt = target, guard = target && !everyone && state.foes.includes(target) ? guardOf(state, target) : undefined;
  if (guard && aimedAt) { target = guard; effect.interposed = aimedAt.id; }
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
    // Dadaísta's maná comes as dice, rolled in view.
    if (actor.classId === DICED && effect.charged) effect.dealt = diceOf(state, actor).slice(-effect.charged);
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
    // Nanitos: the cure also takes one harmful status off them (a stacking one first, then one on the clock).
    if (passive(state, actor, 'nanitos')) {
      const stacked = STATUS_IDS.find(id => stacks(target, id) > 0), clocked = TIMED_IDS.find(id => !TIMED[id].heal && target.timed?.[id]);
      if (stacked) { delete target.statuses![stacked]; effect.cleansed = [{ target: target.id, statuses: [stacked] }]; }
      else if (clocked) { delete target.timed![clocked]; effect.cleared = [clocked]; }
      if (stacked || clocked) note(effect, 'nanitos', actor);
    }
    state.message = `${actor.name} usa ${ability.name}${target === actor ? '' : ` con ${target.name}`}. ¡${TIMED[ability.regen].name}${on.level > 1 ? ` ${roman(on.level)}` : ''}!${effect.cleansed ? ` Nanitos: fuera ${STATUSES[effect.cleansed[0].statuses[0]].name}.` : effect.cleared ? ` Nanitos: fuera ${TIMED[effect.cleared[0]].name}.` : ''}`;
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
  } else if (ability && 'control' in ability && target) {
    // Control remoto: it turns on the strongest of its own standing (on itself if alone), now, and forgets its plan.
    spendSecondary(actor, ability.cost); effect.skill = skill; effect.target = target.id;
    delete target.intent;
    const others = state.foes.filter(f => f !== target && f.hp > 0 && !f.part);
    const victim = others.length ? others.reduce((most, f) => f.hp > most.hp ? f : most) : target;
    const amount = hurt(state, victim, fearDamage(state, victim, physical(ability.power, current(state, target), current(state, victim)), 'physical'));
    effect.controlled = { victim: victim.id, amount };
    state.message = victim === target ? `${actor.name} usa ${ability.name}. ${target.name} se golpea a sí mismo. −${amount} PV.` : `${actor.name} usa ${ability.name}. ${target.name} golpea a ${victim.name}. −${amount} PV.`;
  } else if (ability?.kind === 'debuff' && target) {
    // Ángulo exacto: a mark on the foe, its stats down for a few rounds (every hit on it lands harder).
    spendSecondary(actor, ability.cost); effect.skill = skill; effect.target = target.id; effect.spell = true;
    target.marks = { ...target.marks, [ability.id]: { amount: ability.power, stats: [...ability.stats], until: state.round + BOOST_ROUNDS - 1 } };
    effect.stats = [{ target: target.id, way: 'down', stats: [...ability.stats] }];
    state.message = `${actor.name} usa ${ability.name} contra ${target.name}. ${statNames(ability.stats)} −${ability.power} durante ${BOOST_ROUNDS} rondas.`;
  } else if (everyone) {
    // Las dos a la vez: Haru and Yuki go for every foe at once.
    spendSecondary(actor, ability!.cost); effect.skill = skill; effect.target = target!.id;
    if ('element' in ability!) effect.element = ability.element;
    const blow: Blow = ability!.kind === 'physical' ? 'physical' : 'magic';
    effect.hits = targets.map(foe => {
      const { bled, scale } = wound(foe, blow === 'physical', skill), weak = weakScale(state, foe);
      const found = affinityOf(foe, elementOf(ability));
      const amount = hurt(state, foe, fearDamage(state, foe, strike(state, actor, foe, ability) * scale * weak * affinityScale(foe, elementOf(ability)), blow, elementOf(ability)));
      iterate(state, foe, elementOf(ability), effect);
      if (bled) delete foe.statuses!.sangrado;
      // Only an action that takes PV off spends the mark (one the floor swallows leaves it).
      const spends = weak > 1 && amount > 0;
      if (spends) { delete foe.weakSpot; effect.weakSpot = 'spent'; }
      spendShield(state, foe, amount, effect);
      const peeled = foe.layers ? 1 : undefined;
      if (foe.layers && !--foe.layers) bare(foe);
      const status = 'bleed' in ability! && foe.hp > 0 ? { id: 'sangrado' as const, stacks: addStatus(foe, 'sangrado', ability.bleed) } : undefined;
      // Fire melts the pringue (Explosión).
      if ('melts' in ability! && foe.shell) { foe.shell = false; effect.melted = true; }
      return { target: foe.id, amount, status, peeled, ...bled ? { bled } : {}, ...spends ? { weakSpot: true as const } : {}, ...found && amount > 0 ? { affinity: found } : {} };
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
    const hitOf = (foe: Combatant) => effect.hits!.find(h => h.target === foe.id)!;
    // Vasos comunicantes: water on everyone standing. On a fire it is Humo; otherwise they are left Mojado.
    if ('wets' in ability!) {
      let smoked = 0;
      for (const foe of targets.filter(f => f.hp > 0)) {
        if (foe.timed?.quemado) { const level = smoke(foe); smoked = Math.max(smoked, level); Object.assign(hitOf(foe), { burn: { id: 'cegado', level }, smoked: true }); }
        else { foe.timed = { ...foe.timed, mojado: { level: 1, left: TIMED.mojado.seconds, next: TIMED.mojado.every } }; hitOf(foe).burn = { id: 'mojado', level: 1 }; }
      }
      if (smoked) { effect.reaction = { id: 'humo', level: smoked }; ground(state, actor, effect); }
    }
    // Factor común: the highest fire among them is everyone's (wet layers never catch; on water it is Vapor).
    if ('evens' in ability!) {
      const standing = targets.filter(f => f.hp > 0), top = Math.max(0, ...standing.map(f => f.timed?.quemado?.level ?? 0));
      let steamed = 0;
      for (const foe of standing) {
        if (foe.timed?.mojado) { steamed = steam(foe); Object.assign(hitOf(foe), { burn: { id: 'cegado', level: steamed }, smoked: true }); }
        else if (top && !foe.layers) {
          foe.timed = { ...foe.timed, quemado: { level: top, left: TIMED.quemado.seconds, next: foe.timed?.quemado?.next ?? TIMED.quemado.every } };
          bank(state, actor, foe, effect);
          hitOf(foe).burn = { id: 'quemado', level: top };
        }
      }
      if (steamed) { effect.reaction = { id: 'vapor', level: steamed }; ground(state, actor, effect); }
    }
    effect.amount = effect.hits[0]?.amount;
    // The last layer off breaks an onion's defence.
    const broken = effect.hits.filter(h => h.peeled && !targets.find(foe => foe.id === h.target)?.layers && targets.find(foe => foe.id === h.target)!.hp > 0);
    if (broken.length) effect.stats = broken.map(h => ({ target: h.target, way: 'down' as const, stats: ['defensa' as const] }));
    state.message = `${actor.name} usa ${ability!.name}. ${effect.hits.length === 1 ? `−${effect.amount} PV.` : `Todos reciben: ${effect.hits.map(h => `−${h.amount}`).join(', ')} PV.`}`;
    if (effect.weakSpot) state.message += ' ¡Punto débil: el triple de daño!';
    if (effect.blinded?.length) state.message += ' ¡Cegados hasta que acabe la ronda!';
    if ('wets' in ability!) state.message += effect.reaction ? ' El agua apaga los fuegos y moja al resto.' : ' ¡Mojados!';
    if ('evens' in ability! && effect.hits.some(h => h.burn?.id === 'quemado')) state.message += ` El fuego de todos: ${TIMED.quemado.name} ${roman(Math.max(...effect.hits.map(h => h.burn?.id === 'quemado' ? h.burn.level : 0)))}.`;
    if (effect.mana) state.message += ' Toma de tierra: maná +1.';
    if (actor.out !== undefined && actor.out > state.round) state.message += ` ${actor.name} pierde su siguiente turno.`;
  } else if (target) {
    // Dadaísta: the die spent says how hard the blow is; a bet lost is no blow at all (`castDie`).
    const cast = action === 'skill' && dieUse(skill) ? castDie(state, actor, skill!, die, effect) : undefined;
    if (action === 'skill') { if (!cast) spendSecondary(actor, ability!.cost); effect.skill = skill; }
    effect.target = target.id;
    if (action === 'attack' && actor.classId === 'matemagico') effect.spell = true;
    const melts = action === 'skill' && !!ability && 'melts' in ability;
    if (cast?.lost) {
      effect.amount = 0;
      state.message = `${actor.name} usa ${ability!.name}: apostaba un ${effect.die!.face} y sale un ${effect.die!.rolled}. Nada. El dado se pierde.`;
    } else if (target.shell && !melts) {
      // The gum swallows the blow whole.
      effect.amount = 0; effect.swallowed = true;
      state.message = `${actor.name} golpea a ${target.name}… y el chicle se lo traga. Ni un rasguño.`;
    } else if (silenced(state, target)) {
      // Between two notes La Voz is not there: the blow goes through her.
      effect.amount = 0; effect.silent = true;
      state.message = `${actor.name} golpea donde estaba ${target.name}. Entre nota y nota no hay nadie.`;
    } else if (action === 'skill' && ability!.kind === 'magic' && reflects(target)) {
      // Magic off glass: nothing for the target, and a share of it back at whoever cast it.
      effect.amount = 0;
      effect.reflected = changeHealth(actor, -Math.max(1, Math.round(strike(state, actor, target, ability) * MARTA.reflect)));
      state.message = `${actor.name} usa ${ability!.name} contra ${target.name}. La magia rebota y vuelve. −${effect.reflected} PV para ${actor.name}.`;
    } else {
      if (melts && target.shell) { target.shell = false; effect.melted = true; }
      // Each hit is measured on its own, since the layers it finds change the next one's weight.
      // A physical blow on someone bleeding opens the wound: every claw of it lands harder.
      const times = cast?.times ?? (action === 'skill' && ability && 'strikes' in ability ? ability.strikes : 1), layered = target.layers ?? 0, strikes: number[] = [];
      const magic = action === 'skill' && ability!.kind === 'magic';
      // The element Atacar carries; fire seals a wound instead of opening it (`react`).
      const element = action === 'attack' ? attackElement(state, actor) : ability && 'element' in ability ? ability.element : undefined;
      if (element) effect.element = element;
      const { bled, scale } = wound(target, !magic && element !== 'fuego', action === 'skill' ? skill : undefined), weak = weakScale(state, target);
      const chord = chordScale(state, actor, target);
      // What the blow lands with, for what the foe is made of: Atacar's element, or the skill's own (Foc Binari is fire).
      const landing = element ?? (action === 'skill' ? elementOf(ability) : undefined), found = affinityOf(target, landing);
      for (let i = 0; i < times && target.hp > 0; i++) {
        strikes.push(hurt(state, target, fearDamage(state, target, strike(state, actor, target, action === 'skill' ? ability : undefined, cast?.power) * scale * weak * chord * affinityScale(target, landing), magic ? 'magic' : 'physical', landing)));
        if (target.layers && !--target.layers) bare(target);
      }
      if (bled) { delete target.statuses!.sangrado; effect.bled = bled; }
      effect.amount = strikes.reduce((sum, amount) => sum + amount, 0);
      if (found && effect.amount > 0) effect.affinity = found;
      landed(state, actor, target, effect.amount, chord, effect);
      const spent = weak > 1 && effect.amount > 0;
      if (spent) { delete target.weakSpot; effect.weakSpot = 'spent'; }
      spendShield(state, target, effect.amount, effect);
      // One hit's damage landed in parts (Foc Binari's zero, then its one): the same total, felt twice.
      if (action === 'skill' && ability && 'split' in ability && strikes.length === 1 && strikes[0] > 1) strikes.splice(0, 1, Math.floor(strikes[0] / 2), Math.ceil(strikes[0] / 2));
      if (times > 1 || strikes.length > 1) effect.strikes = strikes;
      const peeled = layered - (target.layers ?? 0);
      if (peeled) effect.peeled = peeled;
      const name = action !== 'skill' ? 'Atacar' : ability!.name;
      state.message = effect.melted ? `${actor.name} usa ${name}. El pringue se derrite. −${effect.amount} PV.` : `${actor.name} usa ${name} contra ${target.name}. −${effect.amount} PV.`;
      if (spent) state.message += ' ¡Punto débil: el triple de daño!';
      if (effect.chord) state.message += effect.cancelled === 'calderon' ? ' ¡Acorde! Se le rompe el Calderón.' : ' ¡Acorde!';
      if (effect.interposed) state.message += ` ${target.name} se ha puesto delante.`;
      if (peeled && !target.layers && target.hp > 0) effect.stats = [{ target: target.id, way: 'down', stats: ['defensa'] }];
      if (peeled) state.message += !target.layers ? ' ¡Sin capas!' : peeled > 1 ? ` ${peeled} capas menos: quedan ${target.layers}.` : ` Una capa menos: quedan ${target.layers}.`;
      if (bled) state.message += ` La herida se abre: +${Math.round((scale - 1) * 100)} %.`;
      if (action === 'skill' && ability && 'bleed' in ability && target.hp > 0) {
        effect.status = { id: 'sangrado', stacks: addStatus(target, 'sangrado', ability.bleed) };
        state.message += ` Sangrado ${effect.status.stacks}.`;
      }
      // Foc Binari sets them on fire; on someone already burning, the fire goes up a level. An onion's wet layers do not catch.
      if (action === 'skill' && ability && 'burn' in ability && target.hp > 0 && target.layers) state.message += ' Las capas, húmedas, no prenden.';
      else if (action === 'skill' && ability && 'burn' in ability && target.hp > 0 && target.timed?.mojado) react(state, actor, target, 'fuego', effect);
      else if (action === 'skill' && ability && 'burn' in ability && target.hp > 0) {
        const fire = inflict(target, ability.burn);
        bank(state, actor, target, effect);
        effect.burn = { id: ability.burn, level: fire.level };
        state.message += fire.level > 1 ? ` ¡El fuego sube: ${TIMED[ability.burn].name} ${roman(fire.level)}!` : ' ¡Se quema!';
      }
      // Rayo de energía: whatever is running out on them by the clock (never a cure) lasts longer.
      // Telemetría gives Bip's own Atacar a little of the same.
      const telemetry = action === 'attack' && effect.amount > 0 && passive(state, actor, 'telemetria');
      const extend = action === 'skill' && ability && 'extend' in ability ? ability.extend : telemetry ? TELEMETRIA : 0;
      if (extend && target.hp > 0) {
        const longer = TIMED_IDS.filter(id => !TIMED[id].heal && target.timed?.[id]);
        for (const id of longer) target.timed![id]!.left += extend;
        if (longer.length) {
          effect.extended = { statuses: longer, seconds: extend };
          if (telemetry) note(effect, 'telemetria', actor);
          state.message += ` ${longer.map(id => TIMED[id].name).join(' y ')}: ${extend} s más.`;
        }
      }
      // An absorbed bolt still finds the water (Conducción), and a blow that took nothing still counts for El que no converge's Error.
      iterate(state, target, landing, effect);
      if (element) react(state, actor, target, element, effect, action === 'skill');
      // A Celda seca takes water in by its own rule, whoever throws it: Mojado, and switched on.
      if (target.kind === 'celda-seca' && landing === 'agua' && !effect.reaction && target.hp > 0 && !target.timed?.mojado) {
        target.timed = { ...target.timed, mojado: { level: 1, left: TIMED.mojado.seconds, next: TIMED.mojado.every } };
        effect.wetted = [target.id];
        state.message += ' La celda se moja y se enciende.';
      }
      // Capilaridad: his Atacar with water leaves a foe it turned nothing on Mojado.
      if (action === 'attack' && element === 'agua' && !effect.reaction && target.hp > 0 && effect.amount > 0 && passive(state, actor, 'capilaridad')) {
        target.timed = { ...target.timed, mojado: { level: 1, left: TIMED.mojado.seconds, next: TIMED.mojado.every } };
        effect.afflicted = { id: 'mojado', level: 1 }; note(effect, 'capilaridad', actor);
        state.message += ' ¡Mojado!';
      }
    }
    // The Joker's blow falls on every other foe standing as well, each strike measured on its own.
    if (cast?.all) {
      const others = state.foes.filter(foe => foe !== target && foe.hp > 0 && !foe.shell);
      const splash = others.map(foe => {
        let amount = 0;
        for (let i = 0; i < cast.times && foe.hp > 0; i++) {
          amount += hurt(state, foe, fearDamage(state, foe, strike(state, actor, foe, ability, cast.power) * weakScale(state, foe), 'physical'));
          if (foe.layers && !--foe.layers) bare(foe);
        }
        return { target: foe.id, amount };
      });
      if (splash.length) { effect.splash = splash; state.message += ' ¡Joker! Cae sobre todos.'; }
    }
  }
  // In Diverge, El que no converge comes out of the blow that converged it soaked: the next bolt is Conducción.
  if (effect.converged) for (const f of state.foes) if (f.kind === 'no-converge' && f.diverged && f.hp > 0) soak(f);
  checkEye(state, effect);
  if (fallen(state)) return effect;
  settle(state);
  return effect;
}
/** Whether `skill` is known: a node of a tree is bought at the jar (`improved`); the rest come with the ánima's level. */
export function skillKnown(skill: SkillId, levels: Partial<Record<ClassId, number>> | undefined, improved: Improved | undefined) {
  const spec = SKILLS.find(s => s.id === skill)!;
  if ('node' in spec) return !!improved?.skills?.includes(skill);
  return (levels?.[spec.class] ?? 1) >= ('level' in spec ? spec.level : 1);
}
/** Whether `skill` is learned in this fight (wearing it aside). */
const learned = (state: BattleState, skill: SkillId) => skillKnown(skill, state.levels, state.improved);
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
 * already through this round (either may complete it, in any order), the
 * maná of a half, or nobody to aim it at.
 */
export function dualBlock(state: BattleState, d: DualSpec, a: Combatant, b?: Combatant): DualBlock | undefined {
  if (!d.parts.every(id => learned(state, id))) return 'level';
  if (state.usedDuals?.includes(d.id) && !state.unbound) return 'used';
  if (!b) return 'acted';
  if (b.hp <= 0) return 'down';
  const halves = halvesOf(d, a, b);
  if (!halves) return 'wear';
  if (state.phase !== 'player' || state.allies[state.active] !== a || a === b || state.spent?.includes(a.id) || state.spent?.includes(b.id)) return 'acted';
  const cost = dualCost(d);
  if (!state.unbound && (a.secondary < cost[halves[0]]! || b.secondary < cost[halves[1]]!)) return 'mana';
  if (!validTargets(state, 'attack').length) return 'target';
}
export const dualReady = (state: BattleState, d: DualSpec, a: Combatant, b: Combatant) => !dualBlock(state, d, a, b);
/** The ally a dual (or a queue) from the active fighter pairs with: another one still to act this round, standing, wearing ánimas. */
export function dualPartner(state: BattleState): Combatant | undefined {
  return state.allies.find((x, i) => i !== state.active && x.hp > 0 && !state.spent?.includes(x.id) && wearsAnimas(x));
}
/** Two players choose at once: `allyId` takes the turn now if they are still to act this round. Returns whether they did. */
export function takeTurn(state: BattleState, allyId: string): boolean {
  const index = state.allies.findIndex(a => a.id === allyId), ally = state.allies[index];
  if (state.phase !== 'player' || !ally || ally.hp <= 0 || state.spent?.includes(ally.id)) return false;
  state.active = index;
  return true;
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
  // A dual calls the Joker: the next die dealt to either of them (the hand is brought in step first, so it is a die still to come).
  for (const c of [a, b]) if (kitIn(state, c).includes(DICED)) { diceOf(state, c); c.jokerDue = true; }
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
      const dealt = hurt(state, target, fearDamage(state, target, dualBlow(d, current(state, striker), current(state, target)) * scale * weak * affinityScale(target, elementOf(d)), 'dual'));
      strikes.push(dealt);
      if (dealt > 0 && affinityOf(target, elementOf(d))) effect.affinity = affinityOf(target, elementOf(d));
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
    spendShield(state, target, effect.amount, effect);
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
    const found = affinityOf(foe, elementOf(d));
    const amount = hurt(state, foe, fearDamage(state, foe, dualBlow(d, current(state, striker), current(state, foe)) * weak * affinityScale(foe, elementOf(d)), 'dual'));
    const spends = weak > 1 && amount > 0;
    if (spends) { delete foe.weakSpot; effect.weakSpot = 'spent'; }
    spendShield(state, foe, amount, effect);
    const peeled = foe.layers ? 1 : undefined;
    if (foe.layers && !--foe.layers) bare(foe);
    // Fire never catches on wet layers.
    const burn = d.burn && foe.hp > 0 && !foe.layers ? { id: d.burn, level: kindle(foe, d.burn, d.burnLevel ?? 1).level } : undefined;
    return { target: foe.id, amount, ...peeled ? { peeled } : {}, ...spends ? { weakSpot: true as const } : {}, ...burn ? { burn } : {}, ...found && amount > 0 ? { affinity: found } : {} };
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
  if (state.phase !== 'player' || !ally || index === state.active || ally.hp <= 0 || state.spent?.includes(ally.id) || !wearsAnimas(ally)) return false;
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
export function commit(state: BattleState, action: BattleAction, targetId?: string, skill?: SkillId, die?: number): BattleEffect | undefined {
  const d = action === 'skill' && skill ? queuedDual(state, skill) : undefined;
  if (!d) return act(state, action, targetId, skill, die);
  const queued = state.queued![dualPartner(state)!.id]!;
  const foes = validTargets(state, 'attack').map(f => f.id);
  return actDual(state, d.id, [aimed(skill!) ? targetId : undefined, queued.target].find(t => t && foes.includes(t)));
}
/** For the new active fighter: their queued choice if `act` would still take it now. It is cleared either way. */
export function takeQueued(state: BattleState): Queued | undefined {
  const actor = state.allies[state.active], queued = actor && state.queued?.[actor.id];
  if (!queued) return;
  delete state.queued![actor.id];
  return act(structuredClone(state), queued.action, queued.target, queued.skill, queued.die) ? queued : undefined;
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
  if (actor.part || castleIdle(actor)) { state.enemyActions.push(id); return; }
  // In Shock: this turn is lost, whatever it had announced waits for the next one.
  if (actor.shock) {
    delete actor.shock; state.enemyActions.push(id);
    state.message = `${actor.name} sigue en shock: pierde el turno.`;
    return { actor: actor.id, kind: 'enemy', stunned: true };
  }
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
/** The foes of Emilie's model, by name (more than one of a kind are numbered). */
export const MODELO_NAMES: Record<ModeloKind, string> = { 'celda-seca': 'Celda seca', oscilacion: 'Oscilación', pluma: 'La pluma', 'no-converge': 'El que no converge' };
/** What each fight in the model says as it starts, and as it is won. */
const MODELO_MESSAGES: Record<ModeloEncounter, string> = {
  'modelo-celdas': 'Tres celdas de la malla se desprenden del corte. Están apagadas: huecas, grises, secas.',
  'modelo-oscilacion': 'Dos figuras parpadean entre dos valores, sin quedarse en ninguno. Una está en el que la otra acaba de dejar.',
  'modelo-pluma': 'Una mancha se extiende por el agua hacia vosotros. Detrás, dos celdas apagadas, esperando.',
  'no-converge': 'Al fondo del modelo, columnas de cifras que caen sin parar. Tienen forma de alguien. No se quedan quietas en ningún valor.',
};
const MODELO_WON: Record<ModeloEncounter, string> = {
  'modelo-celdas': 'Las celdas se apagan del todo y vuelven a su sitio en la malla. Ahora tienen un valor.',
  'modelo-oscilacion': 'Las dos figuras se quedan quietas, cada una en su valor. Luego ya no están.',
  'modelo-pluma': 'La mancha se diluye corriente abajo. El agua vuelve a no tener color.',
  'no-converge': 'Las cifras dejan de caer. Se quedan todas quietas un instante, y son un solo número.',
};
const isModeloFight = (state: BattleState) => (MODELO_ENCOUNTERS as readonly string[]).includes(state.encounter);
/**
 * A fight in the model: who comes out (MODELO_FIGHTS). Two oscilaciones start on different values; the
 * boss on «Agua», with all its Error. The place lends water and electricity to everyone's Atacar.
 */
function createModeloBattle(party: PartySlot[], encounter: ModeloEncounter, animas?: ClassId[], random: () => number = Math.random): BattleState {
  const kinds = MODELO_FIGHTS[encounter], seen: Partial<Record<ModeloKind, number>> = {};
  const foes = kinds.map((kind, i) => {
    const n = seen[kind] = (seen[kind] ?? 0) + 1;
    const one = foe(kind === 'no-converge' || kind === 'pluma' ? kind : `${kind}-${i}`, kinds.filter(k => k === kind).length > 1 ? `${MODELO_NAMES[kind]} ${n}` : MODELO_NAMES[kind], kind);
    if (kind === 'oscilacion') one.sign = n % 2 === 1 ? 'agua' : 'electrico';
    if (kind === 'no-converge') { one.sign = 'agua'; one.error = MODELO.error; }
    return one;
  });
  const unlocked = animas ?? wornAnimas(party);
  return {
    allies: lineUp(party, unlocked), foes,
    active: 0, round: 1, phase: 'player', enemyActions: [], possessed: false, encounter,
    animas: unlocked, awakened: unlocked.includes('matemagico'), seed: seedFrom(random),
    lent: ['agua', 'electrico'],
    message: MODELO_MESSAGES[encounter],
  };
}
/**
 * What the dungeon did before the fight (docs/quests/emilie.md § Final boss): El que no converge
 * starts with one mark of Error fewer for each piezometer placed on the way down, never fewer than one.
 */
export function calibrate(state: BattleState, piezometers: number) {
  const boss = state.foes.find(f => f.kind === 'no-converge');
  if (boss && !boss.converged) boss.error = Math.max(1, (boss.error ?? MODELO.error) - Math.max(0, Math.floor(piezometers)));
}
/**
 * How much of a blow a foe of the model takes, by the element it carries (a dual carries none): a
 * Celda seca, half while dry; an Oscilación, nothing of the element it is on and more of the other;
 * El que no converge, nothing of its own while it iterates, little of anything else, and more of
 * everything once converged. Ticks and pulses never come through here.
 */
function modeloTaken(target: Combatant, element?: Element) {
  if (target.kind === 'celda-seca') return target.timed?.mojado ? 1 : MODELO.seca;
  if (target.kind === 'oscilacion') return element === target.sign ? 0 : element && element === otherSign(target.sign ?? 'agua') ? MODELO.contra : MODELO.plano;
  if (target.kind === 'no-converge') return target.converged ? MODELO.converge : element === target.sign ? 0 : MODELO.itera;
  return 1;
}
/**
 * A blow has landed on El que no converge while it iterates: one of the element it is not on takes a
 * mark of Error away, one of its own adds one. At none it converges: a solid body for `convergeTurns`
 * of its own turns (in Diverge, soaked too once the blow is over, so the next bolt runs through it: `act`).
 */
function iterate(state: BattleState, target: Combatant, element: Element | undefined, effect: BattleEffect) {
  if (target.kind !== 'no-converge' || target.hp <= 0 || target.converged || !target.sign || (element !== 'agua' && element !== 'electrico')) return;
  const before = target.error ?? 0;
  target.error = element === target.sign ? Math.min(MODELO.errorMost, before + 1) : Math.max(0, before - 1);
  if (target.error === before) return;
  effect.error = { left: target.error, mark: target.error < before ? 'off' : 'on' };
  if (target.error > before) { state.message += ` ${target.name} se lo traga: su Error crece.`; return; }
  if (target.error > 0) { state.message += ` Una marca de Error menos: quedan ${target.error}.`; return; }
  target.converged = MODELO.convergeTurns; effect.converged = true;
  state.message += ` ¡Converge! Las cifras dejan de caer: ${target.name} es un cuerpo sólido.`;
}
/** After anything that may have hurt El que no converge: past its mark it diverges for good, with more Error (once converged, when that ends). */
function checkModelo(state: BattleState, effect?: BattleEffect) {
  const boss = state.foes.find(f => f.kind === 'no-converge' && f.hp > 0);
  if (!boss || boss.diverged || boss.hp > boss.maxHp * MODELO.diverge) return;
  boss.diverged = true;
  if (boss.converged) return;
  boss.error = Math.max(boss.error ?? 0, MODELO.errorDiverge);
  const news: BattleEffect = effect ?? { kind: 'enemy', actor: boss.id };
  news.diverged = true; news.error = { left: boss.error, mark: 'on' };
  const said = ` ${boss.name} diverge: las cifras caen más deprisa. Error ${boss.error}.`;
  if (effect) state.message += said; else { state.message = state.message.trim() || said.trim(); (state.news ??= []).push(news); }
}
/** A foe's water on `who`: Mojado, its clock started over. */
function soak(who: Combatant) {
  who.timed = { ...who.timed, mojado: { level: 1, left: TIMED.mojado.seconds, next: TIMED.mojado.every } };
}
/**
 * A foe's spark has found someone wet: `power` of magic through everyone wet in the party, who are
 * left dry (Conducción, turned on them). Holding on takes two thirds off.
 */
function conduct(state: BattleState, actor: Combatant, target: Combatant, power: number, effect: BattleEffect) {
  const wet = state.allies.filter(a => a.hp > 0 && a.timed?.mojado);
  // It lands whole on the one it struck (the first one wet, if that one is dry) and part of it on the others.
  const struck = wet.find(a => a === target) ?? wet[0];
  const hits = wet.map(who => {
    const raw = sighted(actor, magical(who === struck ? power : Math.round(power * REACTION_RULES.share), current(state, actor), current(state, who)));
    const { mojado: _dry, ...rest } = who.timed!;
    who.timed = rest;
    return { target: who.id, amount: changeHealth(who, -(who.guarding ? Math.ceil(raw / 3) : raw)) };
  });
  const main = hits.find(h => h.target === target.id) ?? hits[0];
  effect.target = main.target; effect.amount = main.amount; effect.conducted = true;
  effect.splash = hits.filter(h => h !== main);
  if (struck) shock(state, struck, effect);
  return hits;
}
/**
 * The model's foes' turns (docs/quests/emilie.md § Fights), each a named move. A Celda seca throws a
 * spark at one (Chispa): on someone wet it runs through everyone wet. An Oscilación on «Agua» breaks
 * over one and leaves them wet (Ola); on «Eléctrico» it is a Chispa. La pluma soaks whoever is still
 * dry (Empapa). El que no converge floods everyone on «Agua» (Inunda) and shocks everyone wet on
 * «Eléctrico» (Descarga), harder for each mark of Error; converged, it does nothing at all.
 */
function modeloTurn(state: BattleState, actor: Combatant, target: Combatant, effect: BattleEffect) {
  actor.turns = (actor.turns ?? 0) + 1;
  const use = (id: FoeAbilityId) => { effect.ability = foeAbility(id); };
  const magic = (who: Combatant, power: number) => {
    const raw = sighted(actor, magical(power, current(state, actor), current(state, who)));
    return changeHealth(who, -(who.guarding ? Math.ceil(raw / 3) : raw));
  };
  const alive = state.allies.filter(a => a.hp > 0);
  const spark = () => {
    use('chispa');
    if (target.timed?.mojado) {
      const hits = conduct(state, actor, target, MODELO.conduce, effect);
      state.message = `${actor.name} suelta una chispa sobre ${target.name}, y corre por el agua. ${hits.map(h => `−${h.amount}`).join(', ')} PV.`;
    } else {
      effect.amount = magic(target, MODELO.chispa);
      state.message = `${actor.name} suelta una chispa sobre ${target.name}. −${effect.amount} PV.`;
    }
  };
  if (actor.kind === 'celda-seca') spark();
  else if (actor.kind === 'oscilacion') {
    if (actor.sign === 'electrico') spark();
    else {
      use('ola'); effect.amount = magic(target, MODELO.ola);
      if (target.hp > 0) { soak(target); effect.wetted = [target.id]; }
      state.message = `${actor.name} rompe sobre ${target.name}. −${effect.amount} PV.${effect.wetted ? ' ¡Mojado!' : ''}`;
    }
  } else if (actor.kind === 'pluma') {
    // It goes for whoever is still dry: the cells behind it need them wet.
    const dry = alive.find(a => !a.timed?.mojado) ?? target;
    use('empapa'); effect.target = dry.id; effect.amount = magic(dry, MODELO.empapa);
    if (dry.hp > 0) { soak(dry); effect.wetted = [dry.id]; }
    state.message = `${actor.name} alcanza a ${dry.name} y lo empapa. −${effect.amount} PV.${effect.wetted ? ' ¡Mojado!' : ''}`;
  } else if (actor.converged) {
    use('converge'); delete effect.target;
    // Solid, it is not waiting for its water: what dries meanwhile is not held against the party.
    actor.converged--; delete actor.drained;
    if (actor.converged > 0) state.message = `${actor.name} sigue quieto: un solo valor, sólido.`;
    else {
      delete actor.converged;
      actor.error = actor.diverged ? MODELO.errorDiverge : MODELO.error;
      effect.diverged = true; effect.error = { left: actor.error, mark: 'on' };
      state.message = `Las cifras de ${actor.name} vuelven a caer. Diverge otra vez: Error ${actor.error}.`;
    }
  } else if (actor.sign === 'electrico') {
    // Its water waited out on the clock: once it works, and it sees it. After that it does not shock a
    // dried party: it floods and discharges in the one move, and the bolt runs through everyone.
    const waited = !!actor.drained && !alive.some(a => a.timed?.mojado);
    delete actor.drained;
    use('descarga-modelo');
    const power = MODELO.descarga + MODELO.descargaStep * (actor.error ?? 0);
    if (waited && actor.wary) {
      effect.wetted = alive.map(a => { soak(a); return a.id; });
      const hits = conduct(state, actor, target, power, effect);
      state.message = `${actor.name} no espera esta vez: inunda el corte y descarga a la vez. ${hits.map(h => `−${h.amount}`).join(', ')} PV.`;
    } else if (alive.some(a => a.timed?.mojado)) {
      const hits = conduct(state, actor, target, power, effect);
      state.message = `${actor.name} descarga, y la corriente corre por el agua. ${hits.map(h => `−${h.amount}`).join(', ')} PV.`;
    } else {
      effect.amount = magic(target, Math.round(power / 2));
      state.message = `${actor.name} descarga sobre ${target.name}, que está seco. −${effect.amount} PV.`;
      if (waited) { actor.wary = true; effect.wary = true; state.message += ' Sus cifras se detienen un instante.'; }
    }
  } else {
    use('inunda');
    effect.amount = magic(target, MODELO.inunda);
    effect.splash = alive.filter(a => a !== target).map(a => ({ target: a.id, amount: magic(a, MODELO.inunda) }));
    effect.wetted = alive.filter(a => a.hp > 0).map(a => { soak(a); return a.id; });
    delete actor.drained;
    state.message = `${actor.name} inunda el corte. Todos mojados. −${effect.amount} PV a ${target.name}.`;
  }
}
/** The end of a round in the model: every Oscilación standing, and El que no converge while it iterates, goes to its other value. */
function modeloRoundEnd(state: BattleState) {
  for (const f of state.foes) if (f.hp > 0 && f.sign && (f.kind === 'oscilacion' || (f.kind === 'no-converge' && !f.converged))) f.sign = otherSign(f.sign);
}
/** Càmping Eurosport's foes, by name (more than one of a kind are numbered). */
export const CAMPING_NAMES: Record<CampingKind, string> = { mago: 'Mago de camping', dado: 'Dado', agente: 'Agente', campeon: 'El Campeón' };
/** What each campsite fight says as it starts, and as it is won. */
const CAMPING_MESSAGES: Record<CampingEncounter, string> = {
  'camping-magos': 'Junto a la barrera se levantan dos figuras con túnicas de lona vieja y una linterna frontal encendida. Huele a gas.',
  'camping-dados': 'Tres dados del tamaño de una persona ruedan por la tierra y se paran delante de vosotros. Los puntos, quemados.',
  'camping-agentes': 'Dos figuras de cartón se despegan de la tienda. Una os enseña la cara; la otra, la espalda.',
  'camping-tienda': 'La tienda se abre sola. Dentro no había nadie: un dado y dos agentes de cartón, esperando.',
  'camping-negra': 'Todos los farolillos se apagan a la vez. En la oscuridad se encienden dos linternas frontales, y algo rueda hacia vosotros.',
  campeon: 'Al borde de la piscina, sobre su peana, una figura de héroe del tamaño de un hombre. La pintura, desconchada. Se baja.',
};
const CAMPING_WON: Record<CampingEncounter, string> = {
  'camping-magos': 'Las túnicas caen vacías sobre la tierra. Las linternas siguen encendidas un momento, y se apagan.',
  'camping-dados': 'Los dados se quedan quietos, cada uno con una cara hacia arriba. Ya no cuentan nada.',
  'camping-agentes': 'Los agentes se doblan por la mitad y se quedan boca abajo. Nadie ha dicho la contraseña.',
  'camping-tienda': 'La tienda se cierra sola. Dentro vuelve a no haber nadie.',
  'camping-negra': 'Los farolillos vuelven a encenderse, uno a uno. El tablero empieza otra vez.',
  campeon: 'El Campeón vuelve a su peana y se queda quieto, con el puño en alto. Solo era una figura pintada.',
};
/** Whether this is one of the campsite's fights. */
const isCampingFight = (state: BattleState) => (CAMPING_ENCOUNTERS as readonly string[]).includes(state.encounter);
/** A campsite fight: who comes out (CAMPING_FIGHTS), each dado with a face rolled, the first agente face up, El Campeón a hero. */
function createCampingBattle(party: PartySlot[], encounter: CampingEncounter, animas?: ClassId[], random: () => number = Math.random): BattleState {
  const kinds = CAMPING_FIGHTS[encounter], seen: Partial<Record<CampingKind, number>> = {};
  const foes = kinds.map((kind, i) => {
    const n = seen[kind] = (seen[kind] ?? 0) + 1;
    const one = foe(kind === 'campeon' ? 'campeon' : `${kind}-${i}`, kinds.filter(k => k === kind).length > 1 ? `${CAMPING_NAMES[kind]} ${n}` : CAMPING_NAMES[kind], kind);
    if (kind === 'dado') one.face = 1 + Math.floor(random() * 6);
    if (kind === 'agente') one.faceUp = n % 2 === 1;
    if (kind === 'campeon') { one.form = 'heroe'; one.formLeft = CAMPING.formTurns; }
    return one;
  });
  const unlocked = animas ?? wornAnimas(party);
  return {
    allies: lineUp(party, unlocked), foes,
    active: 0, round: 1, phase: 'player', enemyActions: [], possessed: false, encounter,
    animas: unlocked, awakened: unlocked.includes('matemagico'), seed: seedFrom(random),
    message: CAMPING_MESSAGES[encounter],
  };
}
/** Las cuerdas' foes, by name. */
export const CUERDAS_NAMES: Record<CuerdasKind, string> = { lealtad: 'La Lealtad', cristalino: 'Lo Cristalino', directo: 'Lo Directo', eco: 'Eco', voz: 'La Voz' };
const CUERDAS_MESSAGES: Record<CuerdasEncounter, string> = {
  'cuerdas-lealtad': 'En el nudo de cuerdas hay dos luces. La grande se pone delante de la pequeña, de espaldas a ella, y no se mueve.',
  'cuerdas-cristalino': 'Una figura de vidrio fino os espera en el nudo. Se ve a través de ella todo lo que hay detrás.',
  'cuerdas-directo': 'Una sola línea de luz, recta, sin una curva. Apunta a uno de vosotros.',
  voz: 'Donde se juntan todas las cuerdas hay alguien. Tiene la forma de Marta y no pesa nada. Canta una nota, y calla.',
};
const CUERDAS_WON: Record<CuerdasEncounter, string> = {
  'cuerdas-lealtad': 'La Lealtad se deshace en un hilo de luz que corre por las cuerdas hacia el centro.',
  'cuerdas-cristalino': 'El vidrio se raja sin ruido. Lo que había dentro se va por las cuerdas, hacia el centro.',
  'cuerdas-directo': 'La línea se afloja, se curva por primera vez y se suelta. Va hacia el centro, como las otras.',
  voz: 'La última nota se queda sonando. La figura se deshace despacio, hilo a hilo, y todos los hilos van hacia Marta.',
};
const isCuerdasFight = (state: BattleState) => (CUERDAS_ENCOUNTERS as readonly string[]).includes(state.encounter);
/** One of Las cuerdas' fights: who comes out (CUERDAS_FIGHTS), each with what it has already said it will do; La Voz with her song. */
function createCuerdasBattle(party: PartySlot[], encounter: CuerdasEncounter, animas?: ClassId[], random: () => number = Math.random): BattleState {
  const unlocked = animas ?? wornAnimas(party), allies = lineUp(party, unlocked);
  const first = allies[Math.floor(random() * allies.length)]?.id;
  const foes = CUERDAS_FIGHTS[encounter].map(kind => {
    const one = foe(kind, CUERDAS_NAMES[kind], kind);
    // What says whom it will hit comes in having said it.
    if (kind === 'lealtad') { one.sworn = first; one.intent = { ability: 'juramento', target: first }; }
    if (kind === 'cristalino') one.intent = { ability: 'destello', target: first };
    if (kind === 'directo') one.intent = { ability: 'golpe-directo', target: first };
    return one;
  });
  return {
    allies, foes,
    active: 0, round: 1, phase: 'player', enemyActions: [], possessed: false, encounter,
    animas: unlocked, awakened: unlocked.includes('matemagico'), seed: seedFrom(random),
    message: CUERDAS_MESSAGES[encounter],
    ...encounter === 'voz' ? { song: { part: 'andante' as VozPart, t: 0 } } : {},
  };
}
/** How much of a blow one of Las cuerdas' foes takes, by the kind of blow (a dual counts as every kind): glass takes no magic, and more of a blow. */
function cuerdasTaken(target: Combatant, blow: Blow) {
  // A dual is half magic: it lands whole, neither sent back nor harder. Cracked, magic goes in too.
  if (target.kind === 'cristalino') return blow === 'magic' ? (target.cracked ? 1 : 0) : blow === 'dual' ? 1 : MARTA.cristalPhysical;
  if (target.kind === 'voz' && target.clear && blow === 'magic') return 0;
  // Lo Directo stuck after its Estocada: whatever lands, lands harder.
  if (target.kind === 'directo' && target.stuck) return MARTA.clavado;
  return 1;
}
/** What La Lealtad's next turn is: a Lazo if it is its turn and her Eco is hurt or gone, else her Juramento on whoever struck her last. Her plate says it. */
function swear(state: BattleState) {
  const lealtad = state.foes.find(f => f.kind === 'lealtad' && f.hp > 0), alive = state.allies.filter(a => a.hp > 0);
  if (!lealtad || !alive.length) return;
  const eco = state.foes.find(f => f.kind === 'eco');
  const lazo = (lealtad.turns ?? 0) % MARTA.lazoEvery === MARTA.lazoEvery - 1 && !!eco && eco.hp < eco.maxHp;
  const who = alive.find(a => a.id === lealtad.sworn) ?? alive[0];
  lealtad.sworn = who.id;
  lealtad.intent = lazo ? { ability: 'lazo' } : { ability: 'juramento', target: who.id };
}
/**
 * Lo Cristalino cracks (its PV at `crack` or less): an Estallido, its shards on everyone (it never
 * takes anyone's last PV), and from now on magic goes in and its light comes out on everyone. Told as
 * news (`takeNews`), since any blow or fire can bring it on.
 */
function crack(state: BattleState, glass: Combatant) {
  glass.cracked = true;
  const alive = state.allies.filter(a => a.hp > 0);
  const shard = (who: Combatant) => {
    const raw = sighted(glass, physical(MARTA.estallido, current(state, glass), current(state, who)));
    return changeHealth(who, -Math.min(who.hp - 1, who.guarding ? Math.ceil(raw / 3) : raw));
  };
  const news: BattleEffect = { kind: 'enemy', actor: glass.id, ability: foeAbility('estallido'), cracked: true };
  if (alive.length) {
    news.target = alive[0].id; news.amount = shard(alive[0]);
    news.splash = alive.slice(1).map(ally => ({ target: ally.id, amount: shard(ally) }));
  }
  glass.intent = { ability: 'prisma', at: 'todos' };
  news.telegraph = { id: 'prisma', name: FOE_ABILITIES.prisma.name, at: 'todos' };
  state.message = `${state.message} ${glass.name} se raja de arriba abajo y salta en esquirlas. Ya no devuelve la magia: la luz se le escapa por las grietas.`.trim();
  (state.news ??= []).push(news);
}
/**
 * After anything that may have hurt one of Las cuerdas' foes: La Lealtad remembers who struck her
 * last (`effect`, an ally's action) and says what she will do; Lo Cristalino cracks at its mark; and
 * the second voice goes when La Voz does.
 */
function checkCuerdas(state: BattleState, effect?: BattleEffect) {
  if (!isCuerdasFight(state)) return;
  const lealtad = state.foes.find(f => f.kind === 'lealtad' && f.hp > 0);
  if (lealtad && effect && effect.kind !== 'enemy' && state.allies.some(a => a.id === effect.actor && a.hp > 0)
    && ((effect.target === lealtad.id && (effect.amount ?? 0) > 0) || effect.hits?.some(h => h.target === lealtad.id && h.amount > 0))) lealtad.struck = effect.actor;
  swear(state);
  const glass = state.foes.find(f => f.kind === 'cristalino' && f.hp > 0 && !f.cracked);
  if (glass && glass.hp <= glass.maxHp * MARTA.crack) crack(state, glass);
  if (state.foes.some(f => f.kind === 'voz' && f.hp <= 0)) for (const f of state.foes) if (f.id === SECOND_VOICE) f.hp = 0;
}
/** How hard an Eco's Resonancia is now: more each of its own turns. */
export const resonancia = (c: Combatant) => Math.min(MARTA.resonanciaMost, MARTA.resonancia + MARTA.resonanciaStep * (c.turns ?? 0));
/** The part La Voz is in at this much of her PV. */
export const partFor = (share: number): VozPart => share <= MARTA.capela ? 'a-capela' : share <= MARTA.allegro ? 'allegro' : 'andante';
/**
 * Las cuerdas' foes' turns (docs/quests/marta.md), each a named move. La Lealtad strikes whoever
 * struck her last (Juramento); every `lazoEvery` turns, if her Eco is hurt or gone, she ties it back
 * together instead (Lazo). An Eco repeats her blow on the same one, harder every turn (Resonancia).
 * Lo Cristalino flashes at whom it said (Destello, magic) and says who is next; cracked, its light
 * goes out on everyone (Prisma). Lo Directo goes round DIRECTO_TURNS, each said a turn ahead: whom it
 * said, very hard (Golpe directo); everyone (En línea recta); and an Estocada that leaves it stuck. La
 * Voz goes round her phrase's VOZ_TURNS: Guardia, Nota clara (and whom she will hit), Golpe directo;
 * in Allegro a second voice, once (Coro); in A capela a breath and the Calderón it was for.
 */
function cuerdasTurn(state: BattleState, actor: Combatant, target: Combatant, effect: BattleEffect, hit: Hit) {
  const turn = actor.turns ?? 0;
  actor.turns = turn + 1;
  const use = (id: FoeAbilityId) => { effect.ability = foeAbility(id); };
  const alive = state.allies.filter(a => a.hp > 0);
  const zap: Hit = (who, power) => {
    const raw = sighted(actor, magical(power, current(state, actor), current(state, who)));
    return changeHealth(who, -(who.guarding ? Math.ceil(raw / 3) : raw));
  };
  /** Whom it said, if still standing; and who is next (next round's turn order). */
  const named = () => alive.find(a => a.id === actor.intent?.target) ?? target;
  const next = () => alive[(state.round + state.foes.indexOf(actor)) % alive.length];
  const announce = (ability: 'destello' | 'golpe-directo' | 'en-linea' | 'estocada') => {
    const who = next();
    if (!who) return;
    actor.intent = ability === 'en-linea' ? { ability, at: 'todos' } : { ability, target: who.id };
    effect.telegraph = { id: ability, name: FOE_ABILITIES[ability].name, ...ability === 'en-linea' ? { at: 'todos' as const } : { target: who.id } };
    state.message += ability === 'en-linea' ? ' Se pone recta del todo: os mira a los dos.' : ability === 'estocada' ? ` Retrocede un paso y apunta a ${who.name}.` : ` Ahora mira a ${who.name}.`;
  };
  if (actor.kind === 'lealtad') {
    const eco = state.foes.find(f => f.kind === 'eco');
    if (turn % MARTA.lazoEvery === MARTA.lazoEvery - 1 && eco && eco.hp < eco.maxHp) {
      // Lazo: her Eco whole again. One that had fallen is back, its Resonancia from the start, and waits for the next round.
      const back = eco.hp <= 0;
      use('lazo'); delete effect.target;
      effect.lazo = { target: eco.id, amount: eco.maxHp - eco.hp, back };
      eco.hp = eco.maxHp;
      if (back) {
        eco.turns = 0; delete eco.statuses; delete eco.timed; delete eco.marks; delete eco.weakSpot;
        if (!state.enemyActions.includes(eco.id)) state.enemyActions.push(eco.id);
      }
      state.message = back ? `${actor.name} tira del cordón y el Eco vuelve a sonar, entero, como si nada.` : `${actor.name} ata otra vez su cordón al Eco. Vuelve a estar entero.`;
    } else {
      const who = alive.find(a => a.id === actor.sworn) ?? target;
      use('juramento'); effect.target = who.id; effect.amount = hit(who, MARTA.juramento);
      state.message = `${actor.name} hace sonar su escudo contra ${who.name}, que fue quien la tocó. −${effect.amount} PV${who.guarding ? ' · Protegido' : ''}.`;
    }
    swear(state);
  } else if (actor.kind === 'eco') {
    // It repeats the blow La Lealtad swore, on the same one; alone, on whoever is in front.
    const lealtad = state.foes.find(f => f.kind === 'lealtad' && f.hp > 0);
    const who = (lealtad && alive.find(a => a.id === lealtad.sworn)) || target;
    const power = Math.min(MARTA.resonanciaMost, MARTA.resonancia + MARTA.resonanciaStep * turn);
    use('resonancia'); effect.target = who.id; effect.amount = hit(who, power);
    state.message = `${actor.name} repite el golpe contra ${who.name}, más fuerte que antes. −${effect.amount} PV${who.guarding ? ' · Protegido' : ''}.`;
  } else if (actor.kind === 'cristalino' && actor.cracked) {
    use('prisma'); onEveryone(state, effect, target, zap, MARTA.prisma);
    actor.intent = { ability: 'prisma', at: 'todos' };
    state.message = `A ${actor.name} se le escapa la luz por todas las grietas a la vez. −${effect.amount} PV a ${target.name}.`;
  } else if (actor.kind === 'cristalino') {
    const who = named();
    use('destello'); effect.target = who.id; effect.amount = zap(who, MARTA.destello);
    state.message = `${actor.name} devuelve la luz que le llega sobre ${who.name}. −${effect.amount} PV.`;
    announce('destello');
  } else if (actor.kind === 'directo') {
    const move = DIRECTO_TURNS[turn % DIRECTO_TURNS.length];
    delete actor.stuck;
    if (move === 'en-linea') {
      use('en-linea'); onEveryone(state, effect, target, hit, MARTA.linea);
      state.message = `${actor.name} os atraviesa a los dos de un solo trazo. −${effect.amount} PV a ${target.name}.`;
    } else if (move === 'estocada') {
      // Estocada: everything it has, on whom it said; and its lance stays in the floor until its next turn.
      const who = named();
      use('estocada'); effect.target = who.id; effect.amount = hit(who, MARTA.estocada);
      actor.stuck = true; effect.stuck = true;
      state.message = `${actor.name} se lanza con todo contra ${who.name}. −${effect.amount} PV${who.guarding ? ' · Protegido' : ''}. La lanza se queda clavada en el suelo.`;
    } else {
      const who = named();
      use('golpe-directo'); effect.target = who.id; effect.amount = hit(who, MARTA.directo);
      state.message = `${actor.name} va recto a ${who.name}. −${effect.amount} PV${who.guarding ? ' · Protegido' : ''}.`;
    }
    announce(DIRECTO_TURNS[actor.turns % DIRECTO_TURNS.length]);
  } else {
    const cycle: readonly FoeAbilityId[] = VOZ_TURNS[state.song?.part ?? 'andante'];
    const voice = state.foes.find(f => f.id === SECOND_VOICE);
    // She calls her second voice once: after that, standing or fallen, the turn is her Guardia.
    const move = cycle[turn % cycle.length] === 'coro' && voice ? 'guardia' : cycle[turn % cycle.length];
    use(move);
    const look = () => {
      const who = next();
      if (!who) return;
      actor.intent = { ability: 'golpe-directo', target: who.id };
      effect.telegraph = { id: 'golpe-directo', name: FOE_ABILITIES['golpe-directo'].name, target: who.id };
      state.message += ` Y mira a ${who.name}.`;
    };
    if (move === 'guardia') {
      // Guardia: the next blow on her lands at half, and spends it (it fades with the round after this one).
      delete effect.target; delete actor.intent;
      actor.shielded = state.round + 1; effect.shielded = actor.id;
      state.message = `${actor.name} cruza los brazos, como quien no piensa moverse de ahí. El siguiente golpe le llegará a medias.`;
    } else if (move === 'coro') {
      // Coro: a second voice beside her, an Eco in all but name. It can be struck at any moment, and waits for the next round.
      delete effect.target; delete actor.intent;
      const second = foe(SECOND_VOICE, 'Segunda voz', 'eco', MARTA.coro);
      state.foes.push(second); state.enemyActions.push(second.id);
      effect.summoned = second.id;
      state.message = `${actor.name} canta, y otra voz le contesta desde las cuerdas. Ya son dos.`;
    } else if (move === 'nota-clara') {
      // Nota clara: glass until her next turn, and she says whom the next one is for.
      delete effect.target;
      actor.clear = true; effect.clear = true;
      state.message = `${actor.name} canta una nota tan limpia que se ve a través de ella. La magia rebotará.`;
      look();
    } else if (move === 'aliento') {
      // She takes a breath: the Calderón comes on her next turn, on everyone, unless an Acorde breaks it.
      delete effect.target; delete actor.clear; delete actor.winded;
      actor.intent = { ability: 'calderon', at: 'todos' };
      effect.telegraph = { id: 'calderon', name: FOE_ABILITIES.calderon.name, at: 'todos' };
      state.message = `${actor.name} toma aire, muy despacio. Todas las cuerdas se tensan hacia ella.`;
    } else if (move === 'calderon') {
      if (actor.intent?.ability === 'calderon') {
        onEveryone(state, effect, target, zap, MARTA.calderon);
        state.message = `${actor.name} sostiene una sola nota, y no la suelta. −${effect.amount} PV a ${target.name}.`;
      } else {
        // The breath she took is gone (an Acorde, or she forgot it): nothing comes out.
        delete effect.target; effect.cancelled = 'calderon';
        state.message = `A ${actor.name} se le ha roto la nota. Abre la boca y no sale nada.`;
      }
      delete actor.winded;
      look();
    } else {
      const who = named();
      delete actor.intent; delete actor.clear;
      effect.target = who.id; effect.amount = zap(who, MARTA.vozDirecto);
      state.message = `${actor.name} le dice a ${who.name} una sola cosa, sin rodeos. −${effect.amount} PV${who.guarding ? ' · Protegido' : ''}.`;
    }
  }
}
/**
 * La Voz's song goes on (the fight's clock, `runClock`): `seconds` more of her recording, which never
 * stops or starts over. Every note that starts is an Eco on the whole party; her phrase coming round
 * is a Crescendo; and her PV say which part she is in (a new one starts her turns over). Returns
 * whether anything happened to tell.
 */
function runSong(state: BattleState, seconds: number) {
  const song = state.song, voz = state.foes.find(f => f.kind === 'voz' && f.hp > 0);
  if (!song || !voz) return false;
  const news = state.songNews ??= [], before = news.length;
  const wanted = partFor(voz.hp / voz.maxHp);
  if (wanted !== song.part) {
    song.part = wanted;
    // A new part, a new round of turns: whatever she had said is called off. The song goes on.
    voz.turns = 0; delete voz.intent; delete voz.clear; delete voz.winded;
    news.push({ kind: 'part', part: wanted });
  }
  for (const onset of onsets(VOZ_SONG, song.t, song.t + seconds)) {
    if (onset.round) {
      voz.crescendo = (voz.crescendo ?? 0) + 1;
      const lasting = voz.lasting ??= { shifts: {}, from: 'Crescendo' };
      lasting.shifts.magia = (lasting.shifts.magia ?? 0) + MARTA.crescendo;
      news.push({ kind: 'crescendo', level: voz.crescendo });
    }
    const raw = Math.round(MARTA.eco + MARTA.ecoStep * (voz.crescendo ?? 0));
    const hits = state.allies.filter(a => a.hp > 0).map(ally => ({ target: ally.id, amount: changeHealth(ally, -(ally.guarding ? Math.ceil(raw / 3) : raw)) }));
    news.push({ kind: 'eco', tone: onset.tone, hits });
  }
  song.t += seconds;
  voz.silent = !songAt(VOZ_SONG, song.t).sounding;
  return news.length > before;
}
/** What the song did since it was last asked, in order. */
export function takeSongNews(state: BattleState): SongNews[] {
  const news = state.songNews ?? [];
  delete state.songNews;
  return news;
}
/** How La Voz's plate says what she sings now: «Nota · Mi», or «Silencio». */
export function songLabel(state: BattleState) {
  const now = songNow(state);
  return now ? now.sounding ? `Nota · ${TONES[now.tone].name}` : 'Silencio' : undefined;
}
/**
 * How much of a blow a campsite foe takes, by its rule and the kind of blow (a dual counts as every
 * kind, so it takes the better): a Mago de camping, little from magic and more from blows; an Agente
 * face down, half; El Campeón, half as a hero and double in plain clothes. Ticks and pulses never
 * come through here, so they land whole on anyone.
 */
function campingTaken(target: Combatant, blow: Blow) {
  if (target.kind === 'mago') return blow === 'dual' ? Math.max(CAMPING.magoMagic, CAMPING.magoPhysical) : blow === 'magic' ? CAMPING.magoMagic : CAMPING.magoPhysical;
  if (target.kind === 'agente' && target.faceUp === false) return CAMPING.downTaken;
  if (target.kind === 'campeon') return target.form === 'paisano' ? CAMPING.paisanoTaken : CAMPING.heroeTaken;
  return 1;
}
/**
 * The campsite foes' turns (docs/quests/universidad.md § Càmping Eurosport), each one named move. A
 * Mago de camping charges its Bombona on one turn (announced: «Bombona → todos») and lets it go on the
 * next, magic on everyone; holding on takes two thirds off. A Dado falls on one with the weight of its
 * face (Tumbarse). An Agente strikes one (Contraseña). El Campeón punches as a hero and gets PV back
 * in plain clothes, and changes form after `formTurns` own turns in one.
 */
function campingTurn(state: BattleState, actor: Combatant, target: Combatant, effect: BattleEffect, hit: Hit) {
  actor.turns = (actor.turns ?? 0) + 1;
  const use = (id: FoeAbilityId) => { effect.ability = foeAbility(id); };
  if (actor.kind === 'mago') {
    if (actor.intent?.ability === 'bombona') {
      delete actor.intent;
      const blast: Hit = (who, power) => {
        const raw = sighted(actor, magical(power, current(state, actor), current(state, who)));
        return changeHealth(who, -(who.guarding ? Math.ceil(raw / 3) : raw));
      };
      use('bombona'); onEveryone(state, effect, target, blast, CAMPING.bombona);
      state.message = `${actor.name} prende la bombona. La llamarada os alcanza a todos. −${effect.amount} PV a ${target.name}.`;
    } else {
      actor.intent = { ability: 'bombona', at: 'todos' };
      effect.telegraph = { id: 'bombona', name: FOE_ABILITIES.bombona.name, at: 'todos' };
      use('bombona'); delete effect.target;
      state.message = `${actor.name} desenrosca una bombona de gas. Se oye el silbido.`;
    }
  } else if (actor.kind === 'dado') {
    const face = actor.face ?? 1;
    use('tumbarse'); effect.amount = hit(target, dadoPower(face));
    state.message = `${actor.name} se deja caer sobre ${target.name} con el ${face} arriba. −${effect.amount} PV.`;
  } else if (actor.kind === 'agente') {
    use('contrasena'); effect.amount = hit(target, CAMPING.contrasena);
    state.message = `${actor.name} se dobla y golpea a ${target.name} con el canto. −${effect.amount} PV.`;
  } else {
    if (actor.form === 'paisano') {
      // Recuperarse: it hits nobody; it gets back a share of its PV.
      use('recuperarse');
      effect.target = actor.id; effect.healed = true;
      effect.amount = changeHealth(actor, Math.round(actor.maxHp * CAMPING.recuperarse));
      state.message = `${actor.name}, de paisano, se sienta en su peana y se recompone. +${effect.amount} PV.`;
    } else {
      use('punetazo'); effect.amount = hit(target, CAMPING.punetazo);
      state.message = `${actor.name} descarga un puñetazo sobre ${target.name}. −${effect.amount} PV.`;
    }
    actor.formLeft = (actor.formLeft ?? CAMPING.formTurns) - 1;
    if (actor.formLeft <= 0) {
      actor.form = actor.form === 'paisano' ? 'heroe' : 'paisano'; actor.formLeft = CAMPING.formTurns; effect.form = actor.form;
      state.message += actor.form === 'paisano' ? ' La pintura se le apaga y baja los puños: va de paisano.' : ' Se le enciende la pintura y levanta los puños: otra vez héroe.';
    }
  }
}
/** The end of a round on the campsite: every dado standing rolls a new face, and every agente turns over. */
function campingRoundEnd(state: BattleState) {
  for (const f of state.foes) {
    if (f.hp <= 0) continue;
    if (f.kind === 'dado') f.face = 1 + Math.floor(roll(state) * 6);
    if (f.kind === 'agente') f.faceUp = !f.faceUp;
  }
}
/** La Sobremesa: the seven friends, Joan on his first note. */
function createSobremesaBattle(party: PartySlot[], animas?: ClassId[], random: () => number = Math.random): BattleState {
  const foes = SOBREMESA_FRIENDS.map(id => foe(id, SOBREMESA_NAMES[id], `sobremesa-${id}`));
  const joan = foes.find(f => f.id === 'joan')!;
  joan.note = 0; joan.intent = { ability: 'escala' };
  const unlocked = animas ?? wornAnimas(party);
  return {
    allies: lineUp(party, unlocked), foes,
    active: 0, round: 1, phase: 'player', enemyActions: [], possessed: false, encounter: 'sobremesa',
    animas: unlocked, awakened: unlocked.includes('matemagico'), seed: seedFrom(random),
    message: 'Las mesas plegables crujen y se levantan. De la masa salen siete medio cuerpos que conocéis de toda la vida. Ninguno os mira a la cara.',
  };
}
/** A friend of La Sobremesa still held (not freed). */
const held = (state: BattleState, id: SobremesaFriend) => state.foes.find(c => c.id === id && c.hp > 0);
/** Who a blow announced a turn ahead lands on: whom it marked, if still standing, or today's target. */
const marked = (state: BattleState, intent: Combatant['intent'], fallback: Combatant) => state.allies.find(a => a.id === intent?.target && a.hp > 0) ?? fallback;
/**
 * La Sobremesa's turns (docs/quests/universidad.md § Final boss), each friend their own move, by
 * kind of blow and never by who wears what. A couple announces its duo a turn ahead on both plates
 * and it only goes off while both are held. Joan and Soraya need each other: with one freed, the other
 * loses their turn.
 */
function sobremesaTurn(state: BattleState, actor: Combatant, target: Combatant, effect: BattleEffect, hit: Hit, stats: StatChange[]) {
  const me = actor.id as SobremesaFriend;
  actor.turns = (actor.turns ?? 0) + 1;
  const use = (id: FoeAbilityId) => { effect.ability = foeAbility(id); };
  const lose = (id: FoeAbilityId, why: string) => { use(id); effect.cancelled = id; delete effect.target; state.message = why; };
  const announce = (id: FoeAbilityId, partner: Combatant, at: Combatant) => {
    for (const c of [actor, partner]) c.intent = { ability: id, target: at.id };
    effect.telegraph = { id, name: FOE_ABILITIES[id].name, target: at.id };
    delete effect.target;
  };
  const throwDice = (n: number) => Array.from({ length: n }, () => 1 + Math.floor(roll(state) * 6));
  // A share of the target's PV: as many in a hundred as the dice add up to; holding on takes two thirds off.
  const share = (who: Combatant, dice: number[]) => {
    const raw = sighted(actor, Math.max(1, Math.round(who.maxHp * dice.reduce((a, b) => a + b, 0) * SOBREMESA.pip / 100)));
    return changeHealth(who, -(who.guarding ? Math.ceil(raw / 3) : raw));
  };
  const sung: Hit = (who, power) => {
    const raw = sighted(actor, magical(power, current(state, actor), current(state, who)));
    return changeHealth(who, -(who.guarding ? Math.ceil(raw / 3) : raw));
  };
  const raise = (c: Combatant) => {
    const lasting = c.lasting ??= { shifts: {}, from: FOE_ABILITIES['regla-nueva'].name };
    if ((lasting.shifts.fuerza ?? 0) >= SOBREMESA.reglaMost) return;
    lasting.shifts.fuerza = Math.min(SOBREMESA.reglaMost, (lasting.shifts.fuerza ?? 0) + SOBREMESA.regla);
    stats.push({ target: c.id, way: 'up', stats: ['fuerza'] });
  };
  const duo = actor.intent?.ability === 'duo-tirada' || actor.intent?.ability === 'duo-regla' ? actor.intent : undefined;
  if (me === 'alvaro') {
    const anna = held(state, 'anna');
    if (duo) delete actor.intent;
    if (duo && anna) {
      // Dúo · Tirada: four dice on whom they marked; Anna's turn goes into it.
      delete anna.intent;
      const at = marked(state, duo, target), dice = throwDice(SOBREMESA.duoDice);
      use('duo-tirada'); effect.target = at.id; effect.dice = dice; effect.amount = share(at, dice);
      if (!state.enemyActions.includes(anna.id)) state.enemyActions.push(anna.id);
      state.message = `Álvaro y Anna tiran cuatro dados a la vez: ${dice.join(' + ')}. −${effect.amount} PV a ${at.name}.`;
    } else if (!duo && anna && actor.turns % SOBREMESA.duoEvery === 0) {
      announce('duo-tirada', anna, target);
      use('duo-tirada');
      state.message = `Álvaro le pasa los dados a Anna sin mirarla. Los dos miran a ${target.name}.`;
    } else {
      const dice = throwDice(SOBREMESA.dice);
      use('tirada'); effect.dice = dice; effect.amount = share(target, dice);
      if (duo) effect.cancelled = 'duo-tirada';
      state.message = `${duo ? 'Sin Anna no hay dúo. ' : ''}Álvaro tira los dados: ${dice.join(' + ')}. −${effect.amount} PV a ${target.name}.`;
    }
  } else if (me === 'anna') {
    // Here only when Álvaro is no longer there to throw with her: their duo is over.
    if (duo) { delete actor.intent; effect.cancelled = 'duo-tirada'; }
    // Sopeta: she hits someone, harder each time, and the soup goes round the table: every friend still held gets some PV back.
    const power = Math.min(SOBREMESA.sopetaMost, SOBREMESA.sopeta + SOBREMESA.sopetaStep * (actor.turns - 1));
    use('sopeta'); effect.amount = hit(target, power);
    effect.soothed = state.foes.filter(f => f.hp > 0 && f.hp < f.maxHp).map(f => ({ target: f.id, amount: changeHealth(f, Math.max(1, Math.round(f.maxHp * SOBREMESA.sopetaHeal))) })).filter(h => h.amount > 0);
    state.message = `Anna reparte sopeta: −${effect.amount} PV a ${target.name}${effect.soothed.length ? ', y la mesa entera se recompone un poco' : ''}.`;
  } else if (me === 'sarah') {
    const miquel = held(state, 'miquel');
    const friends = state.foes.filter(f => f.hp > 0 && f !== actor && (f.lasting?.shifts.fuerza ?? 0) < SOBREMESA.reglaMost);
    if (duo) delete actor.intent;
    if (duo && miquel) {
      // Dúo · Regla nueva: every friend hits harder, and Miquel's card is about to fall.
      use('duo-regla'); delete effect.target;
      for (const f of state.foes.filter(c => c.hp > 0)) raise(f);
      state.message = `Sarah escribe una regla en la mesa: «Todos valen más». Miquel le da la vuelta a su carta.`;
    } else if (!duo && miquel && actor.turns % SOBREMESA.duoEvery === 0) {
      announce('duo-regla', miquel, target);
      use('duo-regla');
      state.message = `Sarah y Miquel se miran. La carta de Miquel señala a ${target.name}.`;
    } else if (friends.length) {
      const one = friends[0];
      use('regla-nueva'); delete effect.target; raise(one);
      if (duo) effect.cancelled = 'duo-regla';
      state.message = `${duo ? 'Sin Miquel, la regla vale para uno. ' : ''}Sarah escribe una regla nueva. ${one.name} se crece.`;
    } else lose('regla-nueva', 'Sarah escribe una regla, pero ya no queda nadie a quien le sirva.');
  } else if (me === 'miquel') {
    if (duo) {
      delete actor.intent;
      const at = marked(state, duo, target);
      effect.target = at.id;
      if (held(state, 'sarah') || state.enemyActions.includes('sarah')) {
        // The duo's blow: it leaves them at one PV, unless they hold on.
        use('duo-regla');
        effect.amount = at.guarding ? hit(at, SOBREMESA.carta) : changeHealth(at, -Math.max(0, at.hp - 1));
        state.message = at.guarding ? `La carta negra cae sobre ${at.name}, que la para. −${effect.amount} PV · Protegido.` : `La carta negra cae sobre ${at.name}. Se queda con 1 PV.`;
      } else {
        use('carta-negra'); effect.cancelled = 'duo-regla'; effect.amount = hit(at, SOBREMESA.carta);
        state.message = `Sin Sarah, la carta es solo una carta. −${effect.amount} PV a ${at.name}.`;
      }
    } else if (actor.intent?.ability === 'carta-negra') {
      const at = marked(state, actor.intent, target);
      delete actor.intent;
      use('carta-negra'); effect.target = at.id; effect.amount = hit(at, SOBREMESA.carta);
      state.message = `Miquel deja caer la carta negra sobre ${at.name}. −${effect.amount} PV.`;
    } else {
      actor.intent = { ability: 'carta-negra', target: target.id };
      effect.telegraph = { id: 'carta-negra', name: FOE_ABILITIES['carta-negra'].name, target: target.id };
      use('carta-negra'); delete effect.target;
      state.message = `Miquel gira una carta negra y la deja mirando a ${target.name}.`;
    }
  } else if (me === 'joan') {
    if (!held(state, 'soraya')) return lose('escala', 'Joan abre la boca y no le sale ninguna nota. Sin Soraya no sabe qué cantar.');
    const note = actor.note ?? 0;
    use('escala'); onEveryone(state, effect, target, sung, SOBREMESA.escala[note]);
    actor.note = Math.min(NOTES.length - 1, note + 1);
    state.message = `Joan canta un ${NOTES[note]}, más desafinado que el anterior. −${effect.amount} PV a ${target.name}.`;
  } else if (me === 'soraya') {
    const joan = held(state, 'joan');
    if (!joan) return lose('correccion', 'Soraya abre la boca para corregir a Joan, pero Joan ya no está. No sabe qué hacer.');
    joan.note = Math.min(NOTES.length - 1, (joan.note ?? 0) + 1);
    use('correccion'); delete effect.target;
    state.message = `Soraya corrige a Joan: «¡Más alto!». Joan salta a ${NOTES[joan.note]}.`;
  } else {
    // Nico: Cortafuegos on the friend most hurt who is not shielded yet.
    const others = state.foes.filter(f => f.hp > 0 && f !== actor && !shieldRounds(state, f)).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp);
    if (!others.length) return lose('cortafuegos', 'Nico mira a su alrededor. No queda nadie a quien proteger.');
    const one = others[0];
    one.shielded = state.round + 1;
    use('cortafuegos'); delete effect.target; effect.shielded = one.id;
    state.message = `Nico levanta un cortafuegos delante de ${one.name}. El próximo golpe le hará la mitad.`;
  }
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
  checkCuerdas(state, effect);
  castleAfter(castleKit, state, effect);
  checkModelo(state, effect);
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
  if (isCastle(c.kind)) return castleIntent(state, c);
  if (intent.ability === 'capa-nueva') return 'Pelada';
  if (intent.ability === 'lazo') return `${FOE_ABILITIES.lazo.name} → Eco`;
  if (intent.ability === 'escala') return `${FOE_ABILITIES.escala.name} · ${NOTES[c.note ?? 0]}`;
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
  else if (isSobremesa(actor.kind)) sobremesaTurn(state, actor, target, effect, hit, stats);
  else if (isCamping(actor.kind)) campingTurn(state, actor, target, effect, hit);
  else if (isCuerdas(actor.kind)) cuerdasTurn(state, actor, target, effect, hit);
  else if (isCastle(actor.kind)) castleTurn(castleKit, state, actor, target, effect, hit);
  else if (isModelo(actor.kind)) modeloTurn(state, actor, target, effect);
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
  if (state.phase !== 'enemy' || state.foes.some(f => f.hp > 0 && !f.part && !castleIdle(f) && !state.enemyActions.includes(f.id))) return [];
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
    if (f.shielded !== undefined && f.shielded <= state.round) delete f.shielded;
  }
  campingRoundEnd(state);
  castleRoundEnd(state);
  modeloRoundEnd(state);
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
  // La Lealtad swears for the round that starts: on whoever struck her last in the one that ended.
  for (const f of state.foes) if (f.kind === 'lealtad' && f.struck) { f.sworn = f.struck; delete f.struck; }
  if (isCuerdasFight(state)) swear(state);
  state.enemyActions = []; delete state.queued; delete state.spent;
  // Whoever sits this round out (Explosión: Bip is putting itself back together) is through already.
  // The castle: whoever a hand or the Queen holds, or Aurelià sent out, sits it out too.
  // So is whoever a bolt left in Shock: this is the turn they lose.
  const kept = castleRoundStart(state);
  const out = state.allies.filter(a => (a.out === state.round || kept.out.includes(a.id) || a.shock) && a.hp > 0);
  for (const a of state.allies) delete a.shock;
  // Kept through the round they sit out (Bip shows nowhere until it is over), gone after it.
  for (const a of state.allies) if (a.out !== undefined && a.out < state.round) delete a.out;
  if (out.length) state.spent = out.map(a => a.id);
  state.active = state.allies.findIndex(a => a.hp > 0 && !state.spent?.includes(a.id));
  state.phase = 'player'; state.message = 'Tu turno. Elige tu siguiente movimiento.';
  if (out.length) state.message += ` ${out.map(a => a.name).join(' y ')} no ${out.length > 1 ? 'actúan' : 'actúa'} esta ronda.`;
  if (kept.said) state.message = `${kept.said} ${state.message}`;
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
  // La Voz's song first: what sounds now decides whether a fire on her hurts this frame.
  const sung = runSong(state, seconds), lapped = runCastle(castleKit, state, seconds);
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
      // A fire on La Voz burns on, but between two notes it takes nothing: no pulse to show.
      else if (!(foeSide && silenced(state, c))) pulses.push({ target: c.id, status: id, level: on.level, amount: foeSide ? hurt(state, c, amount) : changeHealth(c, -amount) });
      // Vertitrón's eye burnt out: no more Rayo.
      if (c.kind === 'vertigo-ojo' || isCuerdas(c.kind) || isCastle(c.kind)) checkEye(state);
    }
    on.left -= dt; on.next -= dt;
    if ((c.hp <= 0 || on.left <= 1e-6) && c.timed) {
      // The party's water ran off on the clock while El que no converge iterates: it will know at its Descarga.
      if (id === 'mojado' && !foeSide && c.hp > 0) for (const f of state.foes) if (f.kind === 'no-converge' && f.hp > 0 && !f.converged) f.drained = true;
      delete c.timed[id];
    }
  }
  if (!pulses.length && !sung && !lapped) return pulses;
  if (beaten(state)) { state.phase = 'won'; state.message = winMessage(state); endFight(state); }
  else if (state.allies.every(a => a.hp === 0)) { state.phase = 'lost'; state.message = 'Todo se vuelve rosa… y luego negro.'; endFight(state); }
  // Whoever was choosing fell to the song (an Eco): the turn passes to the next one standing, or to the foes.
  else if (state.phase === 'player' && (state.allies[state.active]?.hp ?? 0) <= 0) {
    const next = state.allies.findIndex(a => a.hp > 0 && !state.spent?.includes(a.id) && state.allies.indexOf(a) > state.active);
    if (next >= 0) state.active = next; else { state.phase = 'enemy'; delete state.queued; }
  }
  return pulses;
}
/** Moments of a fight the picker can jump to that the fight itself stages (docs/dev-tools.md). */
export type StagedMoment = 'vertigo-carga' | 'vertigo-grito' | 'vertigo-sin-ojo' | 'plato-sorpresa' | 'sobremesa-duo-carta' | 'sobremesa-escala-alta' | 'sobremesa-ultimo' | 'magos-bombona' | 'campeon-heroe' | 'campeon-paisano'
  | 'lealtad-lazo' | 'cristalino-casi' | 'cristalino-rajado' | 'directo-linea' | 'directo-estocada' | 'directo-clavado'
  | 'voz-andante' | 'voz-nota-clara' | 'voz-allegro' | 'voz-coro' | 'voz-a-capela' | 'voz-calderon'
  | CastleMoment
  | 'modelo-itera' | 'modelo-converge' | 'modelo-diverge' | 'modelo-sobre-aviso';
export const STAGED_MOMENTS: Record<StagedMoment, { label: string; encounter: Encounter }> = {
  'vertigo-carga': { label: 'Rayo cargado', encounter: 'uri-vertigo' },
  'vertigo-grito': { label: 'Tras dos gritos', encounter: 'uri-vertigo' },
  'vertigo-sin-ojo': { label: 'Ojo roto', encounter: 'uri-vertigo' },
  'plato-sorpresa': { label: 'Plato sorpresa', encounter: 'plato' },
  'sobremesa-duo-carta': { label: 'Dúo de la carta negra', encounter: 'sobremesa' },
  'sobremesa-escala-alta': { label: 'Joan en La', encounter: 'sobremesa' },
  'sobremesa-ultimo': { label: 'Queda uno', encounter: 'sobremesa' },
  'magos-bombona': { label: 'Bombona cargada', encounter: 'camping-magos' },
  'campeon-heroe': { label: 'Héroe', encounter: 'campeon' },
  'campeon-paisano': { label: 'De paisano', encounter: 'campeon' },
  'lealtad-lazo': { label: 'Lazo: el Eco caído', encounter: 'cuerdas-lealtad' },
  'cristalino-casi': { label: 'A punto de rajarse', encounter: 'cuerdas-cristalino' },
  'cristalino-rajado': { label: 'Rajado', encounter: 'cuerdas-cristalino' },
  'directo-linea': { label: 'En línea recta', encounter: 'cuerdas-directo' },
  'directo-estocada': { label: 'Estocada', encounter: 'cuerdas-directo' },
  'directo-clavado': { label: 'Clavado', encounter: 'cuerdas-directo' },
  'voz-andante': { label: 'Andante', encounter: 'voz' },
  'voz-nota-clara': { label: 'Nota clara', encounter: 'voz' },
  'voz-allegro': { label: 'Allegro', encounter: 'voz' },
  'voz-coro': { label: 'Allegro, con segunda voz', encounter: 'voz' },
  'voz-a-capela': { label: 'A capela', encounter: 'voz' },
  'voz-calderon': { label: 'Calderón tomado', encounter: 'voz' },
  ...CASTLE_MOMENTS,
  'modelo-itera': { label: 'Itera', encounter: 'no-converge' },
  'modelo-converge': { label: 'Converge', encounter: 'no-converge' },
  'modelo-diverge': { label: 'Diverge', encounter: 'no-converge' },
  'modelo-sobre-aviso': { label: 'Ya vio la espera', encounter: 'no-converge' },
};
/**
 * Development: puts the fight at `moment`, the party to choose (pure; the picker's `jumpTo` calls
 * it). Vertitrón with its eye charged (Rayo terrorífico → todos announced); after two Gritos
 * liberadores, at half its PV, the third shout next; or with its eye broken. El Plato with the
 * surprise under its cloche. Returns whether it fits this fight.
 */
export function stageMoment(state: BattleState, moment: StagedMoment): boolean {
  if (state.phase !== 'player' && state.phase !== 'enemy') return false;
  if (isCastleMoment(moment)) {
    // The castle's bosses, phase by phase (src/castle-fight.ts).
    if (!stageCastle(castleKit, state, moment)) return false;
  } else if (moment.startsWith('sobremesa-')) {
    // La Sobremesa from a clean start: all seven held at full PV, nothing announced, Joan on Do.
    if (state.encounter !== 'sobremesa') return false;
    for (const f of state.foes) { f.hp = f.maxHp; f.turns = 0; delete f.intent; delete f.lasting; delete f.shielded; }
    const one = (id: SobremesaFriend) => state.foes.find(f => f.id === id)!;
    one('joan').note = 0; one('joan').intent = { ability: 'escala' };
    const first = state.allies.find(a => a.hp > 0)!;
    if (moment === 'sobremesa-duo-carta') {
      for (const id of ['sarah', 'miquel'] as const) { one(id).intent = { ability: 'duo-regla', target: first.id }; one(id).turns = SOBREMESA.duoEvery; }
    } else if (moment === 'sobremesa-escala-alta') {
      one('joan').note = NOTES.indexOf('La'); one('joan').turns = 5;
    } else {
      for (const f of state.foes) if (f.id !== 'miquel') f.hp = 0;
      one('miquel').hp = Math.ceil(one('miquel').maxHp / 2);
    }
  } else if (moment === 'lealtad-lazo') {
    // La Lealtad whole and her Eco fallen, her Lazo next.
    const lealtad = state.foes.find(f => f.kind === 'lealtad' && f.hp > 0), eco = state.foes.find(f => f.kind === 'eco');
    if (!lealtad || !eco) return false;
    lealtad.hp = lealtad.maxHp; lealtad.turns = MARTA.lazoEvery - 1; eco.hp = 0;
    swear(state);
  } else if (moment === 'cristalino-casi') {
    // Lo Cristalino one blow from cracking: still glass, its Destello announced.
    const glass = state.foes.find(f => f.kind === 'cristalino' && f.hp > 0), first = state.allies.find(a => a.hp > 0);
    if (!glass || !first) return false;
    glass.hp = Math.floor(glass.maxHp * MARTA.crack) + 1; delete glass.cracked; glass.intent = { ability: 'destello', target: first.id };
  } else if (moment === 'cristalino-rajado') {
    // Lo Cristalino just cracked: at its mark, its Prisma next.
    const glass = state.foes.find(f => f.kind === 'cristalino' && f.hp > 0);
    if (!glass) return false;
    glass.hp = Math.floor(glass.maxHp * MARTA.crack); glass.cracked = true; glass.intent = { ability: 'prisma', at: 'todos' };
  } else if (moment.startsWith('directo-')) {
    // Lo Directo whole: about to go through everyone, about to lunge, or stuck after lunging.
    const line = state.foes.find(f => f.kind === 'directo' && f.hp > 0), first = state.allies.find(a => a.hp > 0);
    if (!line || !first) return false;
    line.hp = line.maxHp; delete line.stuck;
    if (moment === 'directo-linea') { line.turns = DIRECTO_TURNS.indexOf('en-linea'); line.intent = { ability: 'en-linea', at: 'todos' }; }
    else if (moment === 'directo-estocada') { line.turns = DIRECTO_TURNS.indexOf('estocada'); line.intent = { ability: 'estocada', target: first.id }; }
    else { line.turns = 0; line.stuck = true; line.intent = { ability: 'golpe-directo', target: first.id }; }
  } else if (moment.startsWith('modelo-')) {
    // El que no converge at the start of a phase, on «Agua», the party dry: whole and iterating, one blow past
    // converging (solid), or at its mark, diverging with all its Error.
    const boss = state.foes.find(f => f.kind === 'no-converge');
    if (!boss) return false;
    for (const a of state.allies) if (a.timed?.mojado) { const { mojado: _dry, ...rest } = a.timed; a.timed = rest; }
    delete boss.converged; delete boss.diverged; delete boss.timed; delete boss.drained; delete boss.wary; boss.turns = 0; boss.sign = 'agua';
    boss.hp = boss.maxHp; boss.error = MODELO.error;
    if (moment === 'modelo-converge') { boss.error = 0; boss.converged = MODELO.convergeTurns; }
    else if (moment === 'modelo-diverge') { boss.hp = Math.floor(boss.maxHp * MODELO.diverge); boss.diverged = true; boss.error = MODELO.errorDiverge; }
    // It has already seen its water waited out once: wait it out again and it floods and discharges at once.
    else if (moment === 'modelo-sobre-aviso') boss.wary = true;
  } else if (moment.startsWith('voz-')) {
    // La Voz at the start of her song, nothing announced, no Crescendo yet: whole in Andante, at its mark in the others.
    const voz = state.foes.find(f => f.kind === 'voz'), first = state.allies.find(a => a.hp > 0);
    if (!voz || !state.song || !first) return false;
    delete voz.intent; delete voz.clear; delete voz.shielded; delete voz.lasting; delete voz.crescendo; delete voz.winded; voz.turns = 0;
    state.foes = state.foes.filter(f => f.id !== SECOND_VOICE);
    const share = moment === 'voz-allegro' || moment === 'voz-coro' ? MARTA.allegro : moment === 'voz-a-capela' || moment === 'voz-calderon' ? MARTA.capela : 1;
    voz.hp = Math.max(1, Math.floor(voz.maxHp * share));
    state.song = { part: partFor(voz.hp / voz.maxHp), t: 0 }; delete state.songNews;
    if (moment === 'voz-nota-clara') {
      voz.clear = true; voz.turns = VOZ_TURNS.andante.indexOf('golpe-directo'); voz.intent = { ability: 'golpe-directo', target: first.id };
    } else if (moment === 'voz-coro') {
      // Her second voice already there, a turn old; her Nota clara next.
      const second = foe(SECOND_VOICE, 'Segunda voz', 'eco', MARTA.coro); second.turns = 1;
      state.foes.push(second); voz.turns = 1;
    } else if (moment === 'voz-calderon') {
      voz.turns = VOZ_TURNS['a-capela'].indexOf('calderon'); voz.intent = { ability: 'calderon', at: 'todos' };
    }
  } else if (moment === 'magos-bombona') {
    // Every mago standing, whole, with its Bombona charged (Bombona → todos).
    const magos = state.foes.filter(f => f.kind === 'mago' && f.hp > 0);
    if (!magos.length) return false;
    for (const m of magos) { m.hp = m.maxHp; m.intent = { ability: 'bombona', at: 'todos' }; }
  } else if (moment === 'campeon-heroe' || moment === 'campeon-paisano') {
    // El Campeón at the start of a form, two turns ahead of it: whole as a hero, at half its PV in plain clothes.
    const champion = state.foes.find(f => f.kind === 'campeon' && f.hp > 0);
    if (!champion) return false;
    champion.form = moment === 'campeon-paisano' ? 'paisano' : 'heroe'; champion.formLeft = CAMPING.formTurns;
    champion.hp = moment === 'campeon-paisano' ? Math.ceil(champion.maxHp / 2) : champion.maxHp;
  } else if (moment === 'plato-sorpresa') {
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
  delete state.queued; delete state.spent; delete state.news;
  // Whoever the castle holds (Aitor, hers) sits the round out.
  const held = state.allies.filter(a => a.castle?.held).map(a => a.id);
  if (held.length) state.spent = held;
  state.phase = 'player'; state.enemyActions = []; state.active = Math.max(0, state.allies.findIndex(a => a.hp > 0 && !held.includes(a.id)));
  state.message = `Depuración: ${STAGED_MOMENTS[moment].label}.`;
  return true;
}
