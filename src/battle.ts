/** Campaign turn/story adapter. Numeric resolution is shared with the generic combat core. */
import { adjustResource } from './combat/engine.ts';
import type { AnimaId } from './animas.ts';
import { DOG_PROFILES } from './encounters.ts';
import { PROFILES, grown, healing, magical, physical, withBonus, type ProfileId, type StatBonus, type Stats } from './stats.ts';
import { TONES, VOZ_SONG, onsets, songAt, turnStarts, type Moment, type ToneId } from './song.ts';
import { CASTLE_ENCOUNTERS, CASTLE_MOMENTS, SHREWD, closestToFalling, isCastle, isCastleEncounter, isCastleMoment, type CastleEncounter, type CastleFight, type CastleKind, type CastleMark, type CastleMoment, type HeldMove, type NightFight } from './castle.ts';
import { castleAffinity, castleBlow, castleAfter, castleAtNight, castleStrong, castleIdle, castleIntent, castleRoundEnd, castleRoundStart, castleTaken, castleTurn, castleWinMessage, createCastleBattle, runCastle, stageCastle, type CastleKit } from './castle-fight.ts';
import { LIGHTS, cancels, changes, lightAt, type LightId, type WalkId } from './vidrieras.ts';
export type BattleAction = 'attack' | 'defend' | 'skill' | 'escape';
/** `beat`: the fight holds still for a story moment (the palace minion about to finish Bernat). */
export type BattlePhase = 'player' | 'enemy' | 'beat' | 'won' | 'lost' | 'escaped';
/**
 * Ánimas (the code calls them classes; docs/party.md). They belong to the party, not to one
 * person: once unlocked, anyone in the party but Bernat can wear one, and it adds its stats and
 * its skills to whoever wears it. In a fight the active fighter swaps them with L and R.
 */
export type ClassId = 'matemagico' | 'papagato' | 'tecnopata' | 'dadaista' | 'sincopante' | 'prismatico' | 'freatica';
export const ANIMA_NAMES: Record<ClassId, string> = { matemagico: 'Matemágico', papagato: 'Papagato', tecnopata: 'Tecnópata', dadaista: 'Dadista', sincopante: 'Sincopante', prismatico: 'Colorista', freatica: 'Freática' };
export const CLASS_STATS: Record<ClassId, StatBonus> = {
  // Counting everything twice sharpens the mind a little.
  matemagico: { magia: 1, espiritu: 1 },
  // Haru and Yuki at your feet: the claws hit hard and find the soft spot (Crítico), and magic gets through (docs/animas/papagato/).
  papagato: { fuerza: 1, critico: 10, espiritu: -1 },
  // Aitor's own: Bip stands in front and loads the bombs, Aitor never hits (docs/animas/tecnopata/ § Stats).
  tecnopata: { magia: 2, espiritu: 1, defensa: 2, fuerza: -1 },
  sincopante: { magia: 2, espiritu: 2, defensa: 1, fuerza: -1 },
  prismatico: { defensa: 3, espiritu: 2, fuerza: -1 },
  // Emilie's: water held on the foes' side (docs/animas/freatica/). Its look only so far: no skills, and these are a first guess.
  freatica: { magia: 3, espiritu: 2, fuerza: -1 },
  // The university friends' ánima: dice, luck and the astral. It hits with both hands, finds the soft
  // spot more often (Crítico) and stands worse (docs/animas/dadaista/ § Stats; Aitor 2026-11-20).
  dadaista: { fuerza: 2, magia: 2, critico: 10, defensa: -1 },
};
/**
 * Ánimas bound to one person: Matemágico is Gerard's own mind, Tecnópata is Aitor's. The rest (Papagato)
 * anyone can wear but Bernat. Whoever it is, two people never wear the same ánima at once.
 */
export const ANIMA_OWNERS: Partial<Record<ClassId, string>> = { matemagico: 'gerard', tecnopata: 'aitor' };
/** Whether `who` (a party member's id) may ever wear `id`. */
export const canWear = (who: string, id: ClassId) => who !== 'bernat' && (!ANIMA_OWNERS[id] || ANIMA_OWNERS[id] === who);
/**
 * Descriptions follow the shape in AGENTS.md ("Daño mágico no elemental alto a un enemigo. Rompe el pringue."),
 * unless the skill is marked `abstract: true`, which lets its description stay vague on purpose.
 * `power` is the amount at average stats (see stats.ts); for a `boost` it is what it adds to
 * the stats it names. `cost` is in points of maná (MANA_POINTS). Every skill comes with an
 * ánima (`class`), so whoever wears none has none: Bernat only attacks.
 */
export const SKILLS = [
  // Sincopante (docs/animas/sincopante/): what its wearer does stays in the air as an eco (`eco`, `Eco`, ECOS) that
  // repeats it on the compás, every 5 s for 20 s. Ostinato's strikes the foe it was called on; Bordón's cures whoever
  // has least of their PV left. Crescendo raises them (`raise`); Acompañamiento leaves one at an ally's side that
  // repeats their blows (`accompany`); Tutti spends them all in a last note (`tutti`); Da capo is its definitiva.
  { id: 'ostinato', name: 'Ostinato', cost: 2, side: 'foes', power: 14, kind: 'magic', eco: true, class: 'sincopante', description: 'Daño mágico no elemental leve a un enemigo. Un eco repite el golpe cada 5 segundos durante 20 segundos.' },
  { id: 'bordon', name: 'Bordón', cost: 2, side: 'allies', power: 16, kind: 'heal', eco: true, class: 'sincopante', description: 'Cura leve a un aliado herido. Deja un eco que cura al aliado más herido cada 5 segundos durante 20 segundos.' },
  { id: 'crescendo', name: 'Crescendo', cost: 1, side: 'party', power: 0, kind: 'eco', raise: true, level: 2, class: 'sincopante', description: 'Los ecos suenan más fuerte y su reloj vuelve a empezar. Los que ya sonaban fuerte llegan a todos.' },
  { id: 'acompanamiento', name: 'Acompañamiento', cost: 2, side: 'allies', power: 6, kind: 'eco', accompany: true, level: 5, class: 'sincopante', description: 'Deja un eco junto a un aliado durante 20 segundos. Repite cada golpe suyo con daño mágico no elemental leve.' },
  { id: 'tutti', name: 'Tutti', cost: 3, side: 'all-foes', power: 36, kind: 'magic', tutti: true, level: 7, class: 'sincopante', description: 'Daño mágico no elemental alto a todos los enemigos. Cada eco suena una última vez, el doble de fuerte, y se apaga.' },
  // Da capo, its definitiva (`ulti`): bought at the jar, it wakes once three ecos sound at once, a chord, while Sincopante is
  // worn (`capoReady`). The duals already used in the fight can go off again, and every ánima of the party is full of maná.
  { id: 'da-capo', name: 'Da capo', cost: 0, side: 'party', power: 0, kind: 'eco', capo: true, ulti: true, node: true, abstract: true, class: 'sincopante', description: 'Los ataques dúo ya usados en este combate se pueden usar otra vez. Todo el equipo recupera todo su maná.' },
  // Colorista (docs/animas/prismatico/): dry coloured powder. A blow that powders (`powders`) leaves whoever it
  // took PV from Empolvado, for an element to turn into something (`powder`, POWDER_RULES).
  { id: 'punado', name: 'Puñado', cost: 1, side: 'foes', power: 16, kind: 'physical', powders: true, class: 'prismatico', description: 'Daño físico leve a un enemigo. Lo empolva durante 20 segundos.' },
  // Cortina and Telón raise the party's Defensa and stand a screen of powder (`screen`): in front of the ally picked,
  // or of everyone. It halves the next blow and bursts over whoever dealt it (`CORTINA`; Rebufo, `ANIMA_RULES`).
  { id: 'cortina', name: 'Cortina', cost: 1, side: 'allies', power: 3, kind: 'boost', stats: ['defensa'], screen: 'one', class: 'prismatico', description: 'Sube Defensa de todo el equipo durante 3 rondas. Una cortina de polvo reduce a la mitad el siguiente daño que reciba un aliado.' },
  // Rociada: the ánima's own water. It wets nobody; on powder it is poison, on a fire smoke, as any water.
  { id: 'rociada', name: 'Rociada', cost: 2, side: 'all-foes', power: 14, kind: 'magic', element: 'agua', level: 2, class: 'prismatico', description: 'Daño mágico de agua leve a todos los enemigos.' },
  { id: 'polvareda', name: 'Polvareda', cost: 2, side: 'all-foes', power: 12, kind: 'physical', powders: true, level: 3, class: 'prismatico', description: 'Daño físico leve a todos los enemigos. Los empolva durante 20 segundos.' },
  { id: 'telon', name: 'Telón', cost: 2, side: 'party', power: 3, kind: 'boost', stats: ['defensa'], screen: 'all', level: 6, class: 'prismatico', description: 'Sube Defensa de todo el equipo durante 3 rondas. Una cortina de polvo reduce a la mitad el siguiente daño que reciba cada aliado.' },
  // Traca: a string of small puffs (`volley`), each on a foe standing picked on the fight's dice.
  { id: 'traca', name: 'Traca', cost: 3, side: 'all-foes', power: 10, kind: 'physical', volley: 5, powders: true, level: 7, class: 'prismatico', description: 'Daño físico leve a enemigos al azar. Golpea cinco veces. Los empolva durante 20 segundos.' },
  // Fin de fiesta, its definitiva (`ulti`): bought at the jar, it wakes in a fight once the powder has been all three
  // things in it (`finaleReady`), and goes off once, for the turn and no maná.
  { id: 'fin-de-fiesta', name: 'Fin de fiesta', cost: 0, side: 'all-foes', power: 0, kind: 'magic', ulti: true, node: true, abstract: true, class: 'prismatico', description: 'Empolva a todos los enemigos. Su polvo estalla, envenena y cristaliza a la vez.' },
  // Freática (docs/animas/freatica/): La crecida, the water held under each foe (`CRECIDA`). A blow that raises (`raises`) puts a
  // mark under whom it reaches; Sondeo's current lasts `current` times as long; Bombeo spends a mark as a cure (`pumps`);
  // Golpe de ariete spends every mark of each foe in blows (`hammer`); Bajo cero freezes the water (`freezes`).
  { id: 'recarga', name: 'Recarga', cost: 1, side: 'foes', power: 16, kind: 'magic', element: 'agua', raises: 1, class: 'freatica', description: 'Daño mágico de agua leve a un enemigo. Sube su agua una marca.' },
  { id: 'sondeo', name: 'Sondeo eléctrico', cost: 1, side: 'foes', power: 18, kind: 'magic', element: 'electrico', current: 2, level: 2, class: 'freatica', description: 'Daño mágico eléctrico leve a un enemigo. La corriente que deja en el agua dura el doble.' },
  { id: 'bombeo', name: 'Bombeo', cost: 1, side: 'party', power: 16, kind: 'heal', pumps: true, level: 3, class: 'freatica', description: 'Cura leve a todo el equipo. Baja una marca el agua del enemigo que más tiene.' },
  { id: 'riada', name: 'Riada', cost: 2, side: 'all-foes', power: 12, kind: 'magic', element: 'agua', raises: 1, level: 6, class: 'freatica', description: 'Daño mágico de agua leve a todos los enemigos. Sube el agua de cada uno una marca.' },
  { id: 'golpe-de-ariete', name: 'Golpe de ariete', cost: 2, side: 'all-foes', power: 26, kind: 'magic', element: 'agua', hammer: true, level: 7, class: 'freatica', description: 'Daño mágico de agua medio a todos los enemigos. Gasta el agua de cada uno: un golpe por cada marca.' },
  // Bajo cero, its definitiva: bought at the jar, it wakes once a foe's water reaches the third mark while Freática is worn (`coldReady`).
  { id: 'bajo-cero', name: 'Bajo cero', cost: 0, side: 'all-foes', power: 0, kind: 'magic', freezes: true, ulti: true, node: true, abstract: true, class: 'freatica', description: 'Congela a los enemigos que tienen agua, más tiempo cuanta más tengan. Congelados no actúan y reciben poco daño. Romper el hielo a golpes les hace un daño muy alto, menor cuanto más derretido esté.' },
  // Matemágico's first spell: two streams of fire. It sets the foe on fire (`burn`, a timed status:
  // again while it burns, the fire goes up a level); fire also melts the palace minion's gum.
  // Foc Binari: a zero and a one, two streams that land one after the other (`split`).
  { id: 'foc-binari', name: 'Foc Binari', cost: 1, side: 'foes', power: 16, kind: 'magic', burn: 'quemado', melts: true, split: 2, description: 'Daño mágico de fuego leve a un enemigo. Golpea dos veces. Lo quema durante unos segundos. Si ya arde, el fuego sube de nivel. Derrite el pringue.', class: 'matemagico' },
  // The rest of Matemágico comes from its tree at the jar (`node`, src/ecos.ts; docs/animas/README.md
  // § The jar), never from levels. The trunk, Cálculo: Gerard works out how everyone should hit (a
  // boost), the angle a foe is open at, and draws a cardioid of light under a friend (a cure).
  { id: 'analisis', name: 'Análisis Parálisis', cost: 2, side: 'party', power: 3, kind: 'boost', stats: ['fuerza', 'magia'], node: true, description: 'Sube Fuerza y Magia de todo el equipo durante 3 rondas.', class: 'matemagico' },
  // Ángulo exacto: Gerard works out the angle a foe is open at (a `debuff`: a mark on that foe,
  // `marks`, for BOOST_ROUNDS). Damage is flat, so every point off adds a point to every hit.
  { id: 'angulo', name: 'Ángulo exacto', cost: 1, side: 'foes', power: 3, kind: 'debuff', stats: ['defensa', 'espiritu'], node: true, description: 'Baja Defensa y Espíritu de un enemigo durante 3 rondas.', class: 'matemagico' },
  { id: 'cardioide', name: 'Cardioide', cost: 2, side: 'allies', power: 30, kind: 'heal', node: true, description: 'Cura media a un aliado herido.', class: 'matemagico' },
  // The elements' lines, each a figure he draws (src/math-figures.ts). Fire piles up: Pirámide ígnea
  // takes the highest fire among the foes to all of them (`evens`). Water sets up: Cubo acuático leaves
  // them Mojado (`wets`), or puts a fire out into smoke. Electricity cashes in: Punto eléctrico jumps to
  // everyone wet (`react`, Conducción). Their ids are the names they had first (saves keep them).
  { id: 'factor-comun', name: 'Pirámide ígnea', cost: 2, side: 'all-foes', power: 24, kind: 'magic', element: 'fuego', melts: true, evens: 'quemado', node: true, description: 'Daño mágico de fuego medio a todos los enemigos. El fuego de todos sube al más alto.', class: 'matemagico' },
  { id: 'vasos', name: 'Cubo acuático', cost: 2, side: 'all-foes', power: 16, kind: 'magic', element: 'agua', wets: 'mojado', node: true, description: 'Daño mágico de agua leve a todos los enemigos. Los moja.', class: 'matemagico' },
  // Integral impropia (Cálculo, grade III): everything the party lost, added up and given back, to everyone,
  // at once and then bit by bit on the fight's clock (`regen`), an integral that does not end.
  { id: 'integral', name: 'Integral impropia', cost: 3, side: 'party', power: 26, kind: 'heal', regen: 'sanacion', node: true, description: 'Cura media a todo el equipo. Sigue curándolos poco a poco durante 15 segundos.', class: 'matemagico' },
  // Atractor extraño (Cálculo, grade III): a blow of the astral, and then every status on the clock that can move (`moves` in
  // TIMED) leaves the other foes for its target, adding up where it is already on; what meets there reacts (`gather`).
  { id: 'atractor', name: 'Atractor extraño', cost: 2, side: 'foes', power: 16, kind: 'magic', gathers: true, node: true, description: 'Daño mágico no elemental leve a un enemigo. Los estados con reloj de los demás enemigos pasan a él: si ya tiene uno, sus niveles se suman. Al juntarse, los elementos reaccionan.', class: 'matemagico' },
  { id: 'descarga', name: 'Punto eléctrico', cost: 2, side: 'foes', power: 26, kind: 'magic', element: 'electrico', node: true, description: 'Daño mágico eléctrico medio a un enemigo. Salta a todos los mojados.', class: 'matemagico' },
  // Cortocircuito: a bolt that does not jump (`short`): on someone wet, or about to let go of a move announced, the
  // current shorts in them and they lose their next turn (Shock, for sure, which keeps what they announced waiting).
  // Never twice running on the same foe: it has to act once before it can short again (`Combatant.shorted`).
  { id: 'cortocircuito', name: 'Cortocircuito', cost: 2, side: 'foes', power: 14, kind: 'magic', element: 'electrico', short: true, node: true, description: 'Daño mágico eléctrico leve a un enemigo. Si está mojado o prepara un movimiento anunciado, pierde su siguiente turno. No se repite hasta que vuelva a actuar.', class: 'matemagico' },
  // ∂Q/∂t Condensador: Gerard stores charge (`Combatant.capacitor`). His next electric blow lands `CONDENSADOR.scale`
  // times; a foe that strikes him first gets it instead, `CONDENSADOR.jump` of electric magic.
  { id: 'condensador', name: '∂Q/∂t Condensador', cost: 1, side: 'party', power: 0, kind: 'charge', node: true, description: 'Carga a quien la usa hasta su siguiente golpe eléctrico, que hace el doble de daño. Si un enemigo le golpea antes, la carga salta a ese enemigo.', class: 'matemagico' },
  // Papagato's skills are Haru's and Yuki's: the wearer only asks (docs/animas/papagato/). Haru cuts
  // (`bleed`: Sangrado stacks, which pile up) and the party cashes the wound in with a blow that adds none.
  { id: 'zarpazo', name: 'Zarpazo sangriento', cost: 1, side: 'foes', power: 16, kind: 'physical', bleed: 2, description: 'Daño físico leve a un enemigo. Añade sangrado.', class: 'papagato' },
  // Learned as Papagato grows (src/levels.ts): `level` is the one that teaches it.
  // Zarpazos: a flurry of little claws, a wide cut. Each takes a layer off an onion (`strikes`) and rolls its own Crítico.
  { id: 'zarpazos', name: 'Zarpazos', cost: 2, side: 'foes', power: 9, kind: 'physical', strikes: 2, bleed: 1, level: 2, description: 'Daño físico leve a un enemigo. Golpea dos veces. Añade sangrado.', class: 'papagato' },
  // Ronroneo: Yuki settles on one ally and purrs. A cure at once (`instant`) and the rest bit by bit on
  // the fight's clock (`regen`), and it takes away every status marked `mental` in STATUSES (`cleanse`).
  { id: 'ronroneo', name: 'Ronroneo', cost: 2, side: 'allies', power: 16, kind: 'heal', regen: 'sanacion', instant: true, cleanse: 'mental', level: 2, description: 'Cura leve a un aliado herido. Sigue curándolo poco a poco durante 15 segundos. Quita sus efectos de estado mentales.', class: 'papagato' },
  // Zarpa en la llaga: a blow that spends Sangrado (`wound`); this one opens the wound twice as far (`deep`).
  { id: 'llaga', name: 'Zarpa en la llaga', cost: 2, side: 'foes', power: 26, kind: 'physical', deep: true, level: 3, description: 'Daño físico medio a un enemigo. Gasta el sangrado: cada uno suma el doble de daño.', class: 'papagato' },
  // Acecho: Haru crouches and nothing happens this turn (`stalk`, Combatant.stalk). As the next round starts, before
  // anyone chooses, she lands on the foe picked (`pounce`): a golpe crítico for sure, that spends its wound.
  { id: 'acecho', name: 'Acecho', cost: 2, side: 'foes', power: 38, kind: 'physical', stalk: true, level: 6, description: 'Daño físico alto a un enemigo. Se carga un turno y sale al empezar el siguiente. Golpe crítico seguro.', class: 'papagato' },
  // Cacería: the whole field's blood at once (`hunt`). A claw for each stack on each foe that bleeds, none with the
  // wound's bonus (the count is the bonus); the claws on a wound of five or more are críticos with Olor a sangre.
  { id: 'caceria', name: 'Cacería', cost: 3, side: 'all-foes', power: 10, kind: 'physical', hunt: true, level: 7, description: 'Daño físico leve a todos los enemigos. Golpea una vez por cada sangrado que haya en el campo, repartido entre quienes sangran. Gasta el sangrado.', class: 'papagato' },
  // Siete vidas, its definitiva (`ulti`): bought at the jar, it wakes in a fight once a wound of five or more is spent
  // (`livesReady`). Haru goes through every foe and cuts; Yuki walks among the party and stays (`lives`, LivesWard).
  { id: 'siete-vidas', name: 'Siete vidas', cost: 0, side: 'all-foes', power: 14, kind: 'physical', bleed: 2, lives: true, ulti: true, node: true, class: 'papagato', description: 'Daño físico leve a todos los enemigos. Añade sangrado. El próximo golpe que fuera a matar a alguien del equipo no lo mata: lo cura.' },
  // Tecnópata's skills are Bip's: Aitor points, Bip does it (docs/animas/tecnopata/). Its ánima does
  // not level: the two rays are there from the start, the rest are nodes of its tree (`node`).
  // Rayo de energía: a beam; what is running out on the foe by the clock (TIMED: a Bomba remota, a fire, the smoke,
  // Confusión; never a cure) starts over from its whole time (`restart`, as Reinicio does on every foe; Aitor 2026-11-22:
  // it used to add 5 s). On a bomb that is more time to grow (BOMBA).
  { id: 'rayo-energia', name: 'Rayo de energía', cost: 1, side: 'foes', power: 16, kind: 'magic', restart: true, description: 'Daño mágico no elemental leve a un enemigo. Sus estados con reloj vuelven a empezar.', class: 'tecnopata' },
  // Bomba remota (Aitor 2026-11-21): Bip sticks a bomb on a foe (`bomb`: the timed status Bomba, BOMBA). It goes off when its
  // time is up, harder the longer it has been on: stretching or restarting its clock (Rayo de energía, Telemetría, Reinicio) loads it, and
  // Explosión sets it off now. Its strength changes, so it skips the fixed shape (`abstract`).
  { id: 'bomba-remota', name: 'Bomba remota', cost: 2, side: 'foes', power: 0, kind: 'magic', bomb: true, abstract: true, description: 'Bip le pega una bomba a un enemigo. Estalla a los 12 segundos con daño mágico no elemental, más cuanto más tiempo lleve puesta.', class: 'tecnopata' },
  // Rayo de sanación: a cure at once (`instant`, `power` as any cure: about a quarter of their PV) and the rest bit by bit on the fight's clock (`regen`: a
  // timed status, as Quemado is a fire, its pulses healing; again while it lasts, a level up). Aitor 2026-11-22: more, and at once.
  { id: 'rayo-sanacion', name: 'Rayo de sanación', cost: 1, side: 'allies', power: 14, kind: 'heal', regen: 'sanacion', instant: true, description: 'Cura leve a un aliado herido. Sigue curándolo poco a poco durante 15 segundos.', class: 'tecnopata' },
  // Explosión: Bip blows itself up among the foes (fire: it melts the pringue), blinds them until
  // their turn is over (`blind`: Cegado until the round ends), sets off every Bomba remota on them now (`detonates`), and its
  // wearer loses their next turn while it puts itself back together (`spends`, `Combatant.out`).
  { id: 'explosion', name: 'Explosión', cost: 2, side: 'all-foes', power: 32, kind: 'magic', melts: true, blind: true, detonates: true, spends: true, node: true, description: 'Daño mágico de fuego medio a todos los enemigos. Los ciega durante 1 ronda. Hace estallar sus bombas. Pierdes tu siguiente turno.', class: 'tecnopata' },
  // Confusión: waves of the mind off Bip; for a while the foe does not know whose side it is on
  // (`confuse`: the timed status Confusión), and its blows go to its own (`enemyAct`).
  { id: 'confusion', name: 'Confusión', cost: 2, side: 'foes', power: 0, kind: 'debuff', stats: [], confuse: true, abstract: true, node: true, description: 'Ondas mentales confunden a un enemigo durante 30 segundos: golpea a los suyos.', class: 'tecnopata' },
  // Rayo encogedor: the foe shrinks for a while (`shrink`: the timed status Encogido), a quarter of
  // its Defensa gone. In seconds, not rounds, so it skips the fixed shape (`abstract`). Out of Tecnópata's tree since
  // 2026-11-21 (Escolta took its place); kept for its dual, A escala, until the duals are looked at again.
  { id: 'rayo-encogedor', name: 'Rayo encogedor', cost: 1, side: 'foes', power: 0, kind: 'debuff', stats: ['defensa'], shrink: true, abstract: true, node: true, description: 'Encoge a un enemigo durante 15 segundos: su Defensa baja un 25 %.', class: 'tecnopata' },
  // Control remoto: Bip takes a foe over for a moment. It turns on one of its own right now, with its
  // own strength (`control`, `power` the blow at average stats), and forgets what it had announced.
  { id: 'control-remoto', name: 'Control remoto', cost: 2, side: 'foes', power: 34, kind: 'debuff', stats: [], control: true, abstract: true, node: true, description: 'Bip toma el mando de un enemigo: golpea con fuerza a uno de los suyos y olvida lo que iba a hacer.', class: 'tecnopata' },
  // Reinicio (grade III, Bip's line): Bip reboots the foes' clocks; every status on the clock on each
  // of them (never a cure) starts over from its whole time, at the level it has (`restart`).
  { id: 'reinicio', name: 'Reinicio', cost: 3, side: 'all-foes', power: 14, kind: 'magic', restart: true, node: true, description: 'Daño mágico no elemental leve a todos los enemigos. Sus estados con reloj vuelven a empezar.', class: 'tecnopata' },
  // Virus atómico (Mente): a swarm of tiny Bips gets into a foe (`infect`: the timed status Virus);
  // while it lasts, every status that lands on it lands on every other foe too (`spread`).
  { id: 'virus', name: 'Virus atómico', cost: 2, side: 'foes', power: 14, kind: 'magic', infect: true, node: true, description: 'Daño mágico no elemental leve a un enemigo. Durante 20 segundos, cada estado que reciba se contagia a los demás enemigos.', class: 'tecnopata' },
  // Escudo de bits (Taller): Bip's bits close as a dome over the party (`bits`: its PV, BITS); every blow
  // on the party goes into it first and it stops it whole until it breaks or wears off; cures patch it.
  // Escolta (Taller, Aitor 2026-11-21): Bip leaves Aitor's side and hovers by an ally for `escort` rounds (`Combatant.escort`):
  // the ally takes a third of each blow, as Defending, and Bip sticks a Bomba remota on the foe that struck them (`enemyAct`).
  { id: 'escolta', name: 'Escolta', cost: 1, side: 'allies', power: 0, kind: 'guard', escort: 2, node: true, description: 'Protege a un aliado durante 2 rondas. Bip le pega una bomba remota a quien le golpee.', class: 'tecnopata' },
  // Enjambre, its definitiva (`ulti`): bought at the jar, it wakes once a Bomba remota goes off at its top while Tecnópata
  // is worn (`swarmReady`). Bip comes apart over the foes: a bomb already at its top on each, and every clock over.
  { id: 'enjambre', name: 'Enjambre', cost: 0, side: 'all-foes', power: 0, kind: 'magic', swarm: true, ulti: true, node: true, abstract: true, class: 'tecnopata', description: 'Bip se deshace en un enjambre: le pega a cada enemigo una bomba remota que ya está al máximo. Sus estados con reloj vuelven a empezar.' },
  { id: 'escudo-de-bits', name: 'Escudo de bits', cost: 2, side: 'party', power: 40, kind: 'guard', bits: true, node: true, description: 'Protege a todo el equipo durante 2 rondas. Una cúpula de bits detiene los golpes hasta que se rompe. Lo que una cura no puede dar a un aliado bajo la cúpula, la repara.', class: 'tecnopata' },
  // Dadista's skill is a die thrown (docs/animas/dadaista/): its maná is dice, each with a face in
  // view that is a move of its own. Tirar dado (`die`) spends the die chosen and does what its face
  // says, so what it does depends on the die: it skips the fixed shape.
  { id: 'tirar-dado', name: 'Tirar dado', cost: 1, side: 'foes', power: 0, kind: 'physical', die: true, abstract: true, description: 'Gasta un dado y hace lo que marca su cara.', class: 'dadaista' },
  // The faces' moves (`face`): never in the skill list, reached only by a die (`FACE_SKILLS`).
  { id: 'cara-mano', name: 'Mano', cost: 1, side: 'foes', power: 38, kind: 'physical', face: 'mano', description: 'Daño físico alto a un enemigo.', class: 'dadaista' },
  { id: 'cara-tijeras', name: 'Tijeras', cost: 1, side: 'foes', power: 16, kind: 'physical', bleed: 2, face: 'tijeras', description: 'Daño físico leve a un enemigo. Añade sangrado.', class: 'dadaista' },
  // Ojo: the blow that lands after it, from anyone, does triple (Punto débil, as the dual's).
  { id: 'cara-ojo', name: 'Ojo', cost: 1, side: 'foes', power: 10, kind: 'physical', mark: true, face: 'ojo', description: 'Daño físico leve a un enemigo. El siguiente ataque que reciba hace el triple de daño.', class: 'dadaista' },
  // Corchete: an ally held between brackets takes a third of every blow until the round ends, as Defender.
  { id: 'cara-corchete', name: 'Corchete', cost: 1, side: 'allies', power: 0, kind: 'guard', face: 'corchete', description: 'Protege a un aliado hasta el final de la ronda.', class: 'dadaista' },
  // Comodín: the rare die with the star (`COMODIN_CHANCE`), a hand's blow on every foe standing.
  { id: 'cara-comodin', name: 'Comodín', cost: 1, side: 'all-foes', power: 38, kind: 'physical', face: 'comodin', description: 'Daño físico alto a todos los enemigos.', class: 'dadaista' },
  // Agitar (level 2): the whole hand thrown again. It is not an action (`free`: `shake`, never `act`), so the
  // turn stays; once a fight (`SHAKES`), twice with its node at the jar (Otra vez). With Racha enough, one die comes out the Comodín.
  { id: 'agitar', name: 'Agitar', cost: 0, side: 'party', power: 0, kind: 'hand', free: true, level: 2, abstract: true, description: 'Vuelve a tirar los dados de la mano sin gastar el turno, una vez por combate. Con racha 3 o más, uno sale Comodín.', class: 'dadaista' },
  // Estrella fugaz (level 3): the astral, magic of no element. It is paid with a die of any face (`die: 'paid'`,
  // the face does nothing), and with Racha enough it spends it to deal dice (`star`, RACHA).
  { id: 'estrella-fugaz', name: 'Estrella fugaz', cost: 1, side: 'foes', power: 16, kind: 'magic', die: 'paid', star: true, level: 3, description: 'Daño mágico no elemental leve a un enemigo. Gasta 3 de racha y reparte dos dados.', class: 'dadaista' },
  // Dados astrales (level 4, beside Maná +1) cashes the luck: a die pays for a rain of dice of light, one
  // for each `RAIN.per` % of Crítico (`rain`), each on a foe at random, none of them a golpe crítico.
  // It spends the whole Racha.
  { id: 'dados-astrales', name: 'Dados astrales', cost: 1, side: 'all-foes', power: 16, kind: 'magic', die: 'paid', rain: true, level: 4, description: 'Daño mágico no elemental leve a enemigos al azar. Caen más dados cuanto más Crítico. Gasta la racha.', class: 'dadaista' },
  // Ases en dúo: two dice, and for three rounds the Crítico of everyone in the party counts twice (`double`).
  { id: 'ases-en-duo', name: 'Ases en dúo', cost: 2, side: 'party', power: 0, kind: 'boost', stats: ['critico'], double: true, die: 'paid', level: 5, description: 'Sube Crítico de todo el equipo durante 3 rondas.', class: 'dadaista' },
  // One skill in three sizes (`meteor`: its stage). The list shows Meteorito; used on the wearer's
  // next turn it is Meteoro, and on the one after, Asteroide. Anything else puts it back (`meteorOf`).
  { id: 'meteorito', name: 'Meteorito', cost: 1, side: 'foes', power: 30, kind: 'magic', die: 'paid', meteor: 0, level: 7, description: 'Daño mágico no elemental medio a un enemigo. Usado otra vez en el turno siguiente, es Meteoro.', class: 'dadaista' },
  { id: 'meteoro', name: 'Meteoro', cost: 2, side: 'foes', power: 48, kind: 'magic', die: 'paid', meteor: 1, level: 7, description: 'Daño mágico no elemental alto a un enemigo. Usado otra vez en el turno siguiente, es Asteroide.', class: 'dadaista' },
  { id: 'asteroide', name: 'Asteroide', cost: 3, side: 'all-foes', power: 80, kind: 'magic', die: 'paid', meteor: 2, level: 7, description: 'Daño mágico no elemental muy alto a todos los enemigos.', class: 'dadaista' },
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
  /** The dúos mayores whose node is bought (docs/animas/README.md § Dúos mayores). */
  duals?: readonly DualId[];
}
/**
 * Passives (docs/animas/README.md § The jar): bought as nodes, always on while their ánima is worn,
 * no cost and no button. Each time one does something the fight says so (`BattleEffect.passives`).
 * Rescoldo: Matemágico's fires last RESCOLDO seconds. Capilaridad: his Atacar with water wets a foe
 * it turns nothing on. Toma de tierra: a reaction he sets off gives a maná back, once a round.
 * Telemetría: Bip's Atacar gives TELEMETRIA seconds more to what runs out on its target. Nanitos:
 * Rayo de sanación also takes one harmful status off whoever it cures.
 */
export type PassiveId = 'rescoldo' | 'capilaridad' | 'toma-de-tierra' | 'combustion' | 'telemetria' | 'nanitos' | 'redundancia' | 'olor-a-sangre' | 'otra-vez' | 'remolino' | 'a-contratiempo' | 'pedal' | 'nivel-de-base';
export const PASSIVES: Record<PassiveId, { name: string; anima: ClassId; level?: number; description?: string }> = {
  rescoldo: { name: 'Rescoldo', anima: 'matemagico' },
  capilaridad: { name: 'Capilaridad', anima: 'matemagico' },
  'toma-de-tierra': { name: 'Toma de tierra', anima: 'matemagico' },
  // The fire line's end (grade III): fire climbs to a fourth level, Combustión, while Matemágico is worn
  // by someone standing; any physical blow on it makes it burst (`combust`, COMBUSTION). Reaches the whole party.
  combustion: { name: 'Combustión', anima: 'matemagico', description: 'El fuego puede subir a un cuarto nivel, Combustión. Un golpe físico sobre un enemigo en Combustión lo hace estallar: daño mágico de fuego medio a todos los enemigos, y el fuego de los demás sube un nivel.' },
  telemetria: { name: 'Telemetría', anima: 'tecnopata' },
  nanitos: { name: 'Nanitos', anima: 'tecnopata' },
  // The Taller line's end: the dome a cure patches can be filled past its PV, up to BITS.redundancia times (`raiseBits`).
  redundancia: { name: 'Redundancia', anima: 'tecnopata' },
  // Not a node of the jar: it comes with a level of its ánima (`level`, SCENT) and reaches the whole party.
  // Dadista's node at the jar: Agitar a second time in a fight (`shakesLeft`).
  'otra-vez': { name: 'Otra vez', anima: 'dadaista' },
  // Colorista's, with its level 5 (`remolinoOf`): each time a foe's powder turns into something, a cortina stands in front of its wearer.
  remolino: { name: 'Remolino', anima: 'prismatico', level: 5, description: 'Cuando el polvo de un enemigo reacciona, se levanta una cortina ante quien la lleva.' },
  'olor-a-sangre': { name: 'Olor a sangre', anima: 'papagato', level: 5, description: 'Los golpes a un enemigo que sangra tienen un 20 % más de Crítico. Gastar una herida de cinco cargas o más es siempre un golpe crítico.' },
  // Sincopante's, with its levels 3 and 6 (`contratiempoOf`, `pedalOf`), while it is worn.
  'a-contratiempo': { name: 'A contratiempo', anima: 'sincopante', level: 3, description: 'Si quien la lleva actúa justo entre dos pulsos, todos sus ecos suenan una vez más.' },
  pedal: { name: 'Pedal', anima: 'sincopante', level: 6, description: 'Mientras quien la lleva se defiende, el reloj de sus ecos se para. Siguen sonando.' },
  // Freática's, with its level 5 (`baseOf`): while its wearer stands wearing it, no foe's water drains below the first mark by itself.
  'nivel-de-base': { name: 'Nivel de base', anima: 'freatica', level: 5, description: 'Mientras lleves esta ánima, el agua de un enemigo no baja sola de la primera marca.' },
};
export const RESCOLDO = 15, TELEMETRIA = 3;
/**
 * Bomba remota (docs/animas/tecnopata/README.md § Bomba remota): a bomb of Bip's on a foe, `seconds` on its clock. It goes off
 * when its time is up with magic of no element of power `base` plus `perSecond` for every second it has been on, `top` at
 * most (reached after about 27 s). Stretching its clock (Rayo de energía, Telemetría, Reinicio, Bomba remota again) is
 * what loads it; Explosión sets it off now. First guesses (docs/fight-sim.md).
 */
export const BOMBA = { seconds: 12, base: 10, perSecond: 1.5, top: 50 };
/** The power a bomb that has been on for `age` seconds goes off with. */
export const bombPower = (age: number) => Math.min(BOMBA.top, BOMBA.base + BOMBA.perSecond * Math.max(0, age));
/** The level at which an ánima that grows by level gains a point of maná (docs/animas/README.md § Levels). */
export const MANA_LEVEL = 4;
/** How much maná `id` holds: MANA_POINTS, what Ecos de luz added, and one more from level 4 on (`levels`). */
export const manaMax = (improved: Improved | undefined, id?: ClassId, levels?: Partial<Record<ClassId, number>>) =>
  MANA_POINTS + (id ? (improved?.mana?.[id] ?? 0) + ((levels?.[id] ?? 1) >= MANA_LEVEL ? 1 : 0) : 0);
/** What Defender gives back to the ánima worn (only that one). */
export const DEFEND_CHARGE = 2;
/** What each of a fighter's other ánimas, resting, gets back every time they act (Atacar, Defender, a skill, a dual). */
export const REST_CHARGE = 1;
/** How many rounds a boost lasts, counting the one it is used in. */
export const BOOST_ROUNDS = 3;
export type SkillId = typeof SKILLS[number]['id'];
type Skill = typeof SKILLS[number];
/** `vertigo`: Vertitrón, the tower's boss; `vertigo-ojo`: its eye, a part of it (its own PV, no turns, `part`). */
export type FoeKind = 'dog' | 'minion' | 'guardian' | 'cebollon' | 'cebolla' | 'plato' | 'vertigo' | 'vertigo-ojo' | BroodKind | SobremesaKind | CampingKind | CuerdasKind | CastleKind | ModeloKind | LucaKind;
/**
 * The foes of Emilie's model (docs/quests/emilie.md § Fights): what goes wrong in a groundwater model.
 * Each asks one question with water and electricity, by kind of blow and never by who wears what, and
 * shows its answer on its plate. A Celda seca takes two fifths while dry; water wets it, and then
 * electricity is Conducción. An Oscilación shows the value it is on («Agua» or «Eléctrico», the other
 * one every round): a blow of that element is absorbed, one of the other lands hard. El Átomo, the
 * model's chemistry, carries three electrons (fire, water, electricity) and throws them at the party;
 * every third turn they all go at once (Reacción), and what comes out depends on which are left. A
 * blow of an electron's element tears it off (Ionizado); one of an element it has lost gives it back
 * (Captura); with none left, what has no element lands double. El que no converge, the boss, is all
 * of it: it wets and shocks the party by turns, and only blows of the element it is not on take its
 * Error away, until it converges.
 */
export type ModeloKind = 'celda-seca' | 'oscilacion' | 'atomo' | 'no-converge';
export const MODELO_KINDS = ['celda-seca', 'oscilacion', 'atomo', 'no-converge'] as const satisfies readonly ModeloKind[];
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
/**
 * Fran's salon's foes (docs/quests/luca.md § Monsters): what is eating Luca's colour, each asking one
 * question and showing its answer on its plate. Polillas come in more while two of them stand (a blow
 * on everyone, fire best); a shirt of Luca's (`estampado-*`) is only hurt in the light of its own colour;
 * the chaplains copy what was done last, the freshly styled one (*Recién peinado*) leading, and stop
 * mid-gesture when it falls. (El Telescopio and La Laca were cut on 2026-11-20, Aitor: the apse is Fran's zone.)
 */
export type LucaKind = 'polilla' | 'estampado-rojo' | 'estampado-azul' | 'estampado-oro' | 'capellan' | 'fran' | 'lampara';
export const LUCA_KINDS = ['polilla', 'estampado-rojo', 'estampado-azul', 'estampado-oro', 'capellan', 'fran', 'lampara'] as const satisfies readonly LucaKind[];
export const isLuca = (kind?: FoeKind): kind is LucaKind => !!kind && (LUCA_KINDS as readonly string[]).includes(kind);
export const CUERDAS_KINDS = ['lealtad', 'cristalino', 'directo', 'eco', 'voz'] as const satisfies readonly CuerdasKind[];
export const isCuerdas = (kind?: FoeKind): kind is CuerdasKind => !!kind && (CUERDAS_KINDS as readonly string[]).includes(kind);
/**
 * Càmping Eurocamping's foes (docs/quests/universidad.md § Càmping Eurocamping, Monsters): each asks one
 * question, by kind of blow and never by who wears what, and shows its answer on its plate. A Mago de
 * camping takes half from magic and more from blows, and charges its Bombona a turn ahead (the chip
 * says so). A Dado shows its top face, the weight of its blow this round, and rolls again every round.
 * Agentes come in pairs: one face up, who takes everything, one face down, who takes half (ticks
 * ignore it); they turn over every round. El Campeón, the mini-boss, is the villain of a superhero
 * board game: his Plan goes up a step every turn and fires on everyone when full, every magic blow
 * on him takes it a step down, and his Rayo goes at whom he said a turn ahead (his plate says both).
 */
export type CampingKind = 'mago' | 'dado' | 'agente' | 'campeon';
export const CAMPING_KINDS = ['mago', 'dado', 'agente', 'campeon'] as const satisfies readonly CampingKind[];
export const isCamping = (kind?: FoeKind): kind is CampingKind => !!kind && (CAMPING_KINDS as readonly string[]).includes(kind);
/** How many steps El Campeón's Plan has before it fires: fewer once he is in his Etapa II. */
export const planMost = (champion: { stage2?: boolean }) => champion.stage2 ? CAMPING.planMostII : CAMPING.planMost;
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
  cebolla: { layers: 7, power: 16, perLayer: 8, cry: 2, splash: .5, size: [.5, 1.3] },
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
 * foe's `intent` (`intentLabel` reads it: «Carrerilla → Aitor», «Rayo terrorífico → todos»). When it
 * is used its name is up top, in the foe's callout (src/battle-ui.ts `showCallout`), never on its
 * numbers. `card`: not a plain blow, so the fight holds a beat after it for its picture to be seen (BEAT.ability).
 */
export type FoeAbilityId = 'lagrimilla' | 'capa-nueva' | 'peso' | 'carrerilla' | 'aplaston'
  | 'salpicon' | 'vuelta' | 'atravesar' | 'transparente' | 'game-over'
  | 'cambio-plato' | 'sorpresa' | 'puaj'
  | 'pisoton' | 'barrido' | 'grito' | 'carga' | 'rayo'
  | 'tirada' | 'sopeta' | 'regla-nueva' | 'carta-negra' | 'escala' | 'correccion' | 'cortafuegos' | 'duo-tirada' | 'duo-regla'
  | 'bombona' | 'tumbarse' | 'contrasena' | 'rayo-guantelete' | 'rayo-total'
  | 'juramento' | 'lazo' | 'resonancia' | 'destello' | 'estallido' | 'prisma' | 'golpe-directo' | 'en-linea' | 'estocada'
  | 'nota-do' | 'nota-sol' | 'nota-fa' | 'nota-re' | 'nota-sib' | 'nota-la' | 'coro' | 'aliento' | 'calderon'
  // The castle (src/castle-fight.ts): the pupils, Aurelià, Dirección and the Queen.
  | 'empujon' | 'repaso' | 'chivatazo' | 'pellizco' | 'codazo' | 'orden' | 'presente' | 'revienta' | 'arrimarse' | 'copia'
  | 'dictado' | 'pregunta' | 'castigo' | 'sprint' | 'expulsion' | 'record'
  | 'expediente' | 'horario' | 'circular' | 'firma' | 'resolucion' | 'cambio-cargo'
  | 'pegote' | 'envolver' | 'manos' | 'atrapar' | 'aplastar' | 'pompa' | 'suyo'
  | 'chispa' | 'ola' | 'electron' | 'reaccion' | 'choque' | 'inunda' | 'descarga-modelo' | 'converge'
  | 'aleteo' | 'estampar' | 'tijeretazo' | 'imitacion'
  | 'corte' | 'repeinar' | 'brillo' | 'tomar-hisopo' | 'aspersion';
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
  'rayo-guantelete': { name: 'Rayo', card: true },
  'rayo-total': { name: 'Rayo total', card: true },
  juramento: { name: 'Juramento', card: true },
  lazo: { name: 'Lazo', card: true },
  resonancia: { name: 'Resonancia', card: true },
  destello: { name: 'Destello', card: true },
  estallido: { name: 'Estallido', card: true },
  prisma: { name: 'Prisma', card: true },
  'golpe-directo': { name: 'Golpe directo', card: true },
  'en-linea': { name: 'En línea recta', card: true },
  estocada: { name: 'Estocada', card: true },
  // La Voz's notes (VOZ_NOTES): each one she sings is a move of hers, named after the note.
  'nota-do': { name: 'Do', card: false },
  'nota-sol': { name: 'Sol', card: false },
  'nota-fa': { name: 'Fa', card: false },
  'nota-re': { name: 'Re', card: false },
  'nota-sib': { name: 'Si♭', card: false },
  'nota-la': { name: 'La', card: false },
  coro: { name: 'Coro', card: true },
  aliento: { name: 'Toma aire', card: true },
  calderon: { name: 'Calderón', card: true },
  empujon: { name: 'Empujón', card: true },
  repaso: { name: 'Repaso', card: false },
  chivatazo: { name: 'Chivatazo', card: true },
  pellizco: { name: 'Pellizco', card: false },
  codazo: { name: 'Codazo', card: false },
  orden: { name: 'Orden', card: true },
  presente: { name: '«Presente»', card: true },
  revienta: { name: 'Revienta', card: true },
  arrimarse: { name: 'Se arrima', card: false },
  copia: { name: 'Copia', card: true },
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
  electron: { name: 'Electrón', card: false },
  reaccion: { name: 'Reacción', card: true },
  choque: { name: 'Choque', card: false },
  inunda: { name: 'Inunda', card: true },
  'descarga-modelo': { name: 'Descarga', card: true },
  converge: { name: 'Converge', card: true },
  aleteo: { name: 'Aleteo', card: false },
  estampar: { name: 'Estampar', card: false },
  tijeretazo: { name: 'Tijeretazo', card: false },
  imitacion: { name: 'Imitación', card: true },
  corte: { name: 'Corte a medida', card: false },
  repeinar: { name: 'Repeinar', card: true },
  brillo: { name: 'Brillo', card: true },
  'tomar-hisopo': { name: 'Toma el hisopo', card: true },
  aspersion: { name: 'Aspersión', card: true },
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
  flipAt: .5, transparent: .5, sorpresaSingle: .5, sorpresaDual: 1, puaj: 37,
  escortLayers: 2, mixChance: .35, mixLayers: 3,
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
 * Càmping Eurocamping's foes, every number in one book (`camping.rules`); their PV are their PROFILES
 * entries. A Mago de camping takes `magoMagic` of a magic blow and `magoPhysical` of a physical one,
 * and its Bombona is `bombona` of magic on everyone. A Dado's Tumbarse is `dadoBase` and `dadoPip` for
 * each pip of the face it shows. An Agente face down takes `downTaken` of every blow; its Contraseña is
 * `contrasena`. El Campeón's Rayo is `rayo` of magic on whom he said; his Plan fires at `planMost`
 * steps (`planMostII` in his Etapa II, from `stageAt` of his PV down) as a Rayo total of `rayoTotal`
 * on everyone; a magic blow on him lands at `campeonMagic` and takes his Plan a step down. The Bombona went from 24 to 18
 * (2026-11-23) when Cegado's misses turned chance: Explosión's flash had been what held La parcela negra.
 */
export const CAMPING = {
  magoMagic: .5, magoPhysical: 1.4, bombona: 18,
  dadoBase: 4, dadoPip: 6,
  downTaken: .5, contrasena: 18,
  rayo: 22, rayoTotal: 38, planMost: 3, planMostII: 2, stageAt: .5, campeonMagic: .7,
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
 * La Voz (docs/quests/marta.md § Final boss): a blow only lands in one of her silences; while a note
 * sounds it goes through her. A blow pressed up to `hueco` seconds into a note that came after a
 * silence still counts as that silence (the ear hears her start a little late). Every note she sings
 * is a move of hers, a beam of it at whom she sings that turn of her phrase at, whoever struck her last
 * in the turn before (VOZ_NOTES): `vozDo`, `vozSol` (water,
 * it wets), `vozFa` (a bolt; on someone wet it runs through the water, `vozConduce`, and may leave
 * them in Shock), `vozRe` (physical), `vozSib` (fire, it burns) and `vozLa` (on everyone). Holding on
 * takes two thirds off and leaves nothing on (no water, no fire, no Shock); in her fight it lasts
 * until that fighter acts again, since her song does not wait for rounds. Every time the phrase comes
 * round, a Crescendo: her Magia up `crescendo`. A second blow by the other fighter inside the same
 * silence is an Acorde, `acorde` times as hard. From `allegro` of her PV down she sings Allegro and
 * calls a second voice of `coro` PV, once (Coro); from `capela` down A capela, where she takes a
 * breath and holds a Calderón on everyone (`calderon`) unless an Acorde breaks it first (src/song.ts).
 * A blow that goes through her while she sings angers her (Enfado, up to `enfadoMost` grades, Aitor
 * 2026-11-21): her next note goes at whoever angered her last, `enfado` times as hard more for each
 * grade, and spends it. Holding on still takes two thirds off.
 */
export const MARTA = {
  juramento: 48, lazoEvery: 4, resonancia: 16, resonanciaStep: 12, resonanciaMost: 48,
  cristalPhysical: 1.5, reflect: .5, destello: 34, crack: .5, estallido: 14, prisma: 22,
  directo: 54, linea: 28, estocada: 62, clavado: 3.5,
  // Her song is Marta's recording (src/song.ts): some 64 notes in 87 s, each one a beam, so each is small and her
  // Magia (13) against the party's Espíritu does the rest: light on Gerard (13), heavy on Aitor (10); Re, a physical
  // blow, the other way round. Each Crescendo is a quarter point of Magia (2026-11-20, `just fight-sim`).
  vozDo: 2, vozSol: 1, vozFa: 2, vozConduce: 6, vozRe: 4, vozSib: 1, vozLa: 1, hueco: .1,
  crescendo: .25, acorde: 1.5, coro: 32, calderon: 30,
  allegro: .6, capela: .25, enfado: 3, enfadoMost: 3,
};
/**
 * Emilie's model (docs/quests/emilie.md § Fights), every number in one book (`modelo.rules`); PV are
 * each foe's PROFILES entry. A Celda seca takes `seca` of every blow while dry. An Oscilación takes
 * `contra` of a blow of the element it is not on, `plano` of one with no element (or fire), nothing
 * of its own. Chispa and Ola are the small foes' blows; `conduce` is what runs through everyone wet in
 * the party when a spark finds one of them. El Átomo takes `ioniza` of a blow that tears an electron
 * off, `captura` of one that gives it one back, and `desnudo` of one with no element once it has none
 * left. Its Electrón is `electron` (fire burns, water wets, a spark is a Chispa); every `reaccionEvery`
 * turns its Reacción throws each electron left at everyone, `reaccion` each, the spark as `reaccionRayo`
 * through whoever is wet. Bare, it rams one (`choque`). El que no converge: while it iterates it
 * takes `itera` of every blow and nothing of its own element; it starts with `error` marks (`errorDiverge`
 * from `diverge` of its PV, never more than `errorMost`); at none it is solid for `convergeTurns` of
 * its own turns and takes `converge`. Inunda takes `inunda` and wets everyone; its Descarga is
 * `descarga` plus `descargaStep` for each mark of Error, on everyone wet. Holding on takes two thirds off.
 */
export const MODELO = {
  seca: .4, contra: 1.5, plano: .5,
  chispa: 16, ola: 16, conduce: 22,
  ioniza: 1.5, captura: .5, desnudo: 2,
  electron: 16, reaccionEvery: 3, reaccion: 20, reaccionRayo: 32, choque: 20,
  itera: .5, converge: 2, convergeTurns: 2,
  error: 3, errorDiverge: 4, errorMost: 6, diverge: .5,
  inunda: 18, descarga: 20, descargaStep: 7,
};
/** Lo Directo's turns, in order, round and round; each is said a turn ahead. */
export const DIRECTO_TURNS = ['golpe-directo', 'golpe-directo', 'en-linea', 'estocada'] as const;
/**
 * La Voz's own turns in each part, in order, round and round (a new part starts on its first). Her
 * song is what she does to the party (VOZ_NOTES): in Andante she takes no turn of her own. In
 * Allegro she calls a second voice, once. In A capela she takes a breath, lets the Calderón it was for
 * go, and sings on for a round (`null`: no turn).
 */
export const VOZ_TURNS = {
  andante: [],
  allegro: ['coro'],
  'a-capela': ['aliento', 'calderon', null],
} as const satisfies Record<'andante' | 'allegro' | 'a-capela', readonly (FoeAbilityId | null)[]>;
/**
 * What each note La Voz sings does (docs/quests/marta.md § Final boss): a beam of it from her throat,
 * at whom she sings this turn of her phrase at (`Combatant.facing`), or at everyone (`all`). Its power is its MARTA
 * entry; `physical` blows go against Defensa, the rest are magic against Espíritu. `element` is what
 * it lands with (water wets, fire burns, a bolt runs through the water).
 */
export type SungTone = Exclude<ToneId, 'mi'>;
export const VOZ_NOTES: Record<SungTone, { ability: FoeAbilityId; power: 'vozDo' | 'vozSol' | 'vozFa' | 'vozRe' | 'vozSib' | 'vozLa'; element?: Element; physical?: true; all?: true }> = {
  do: { ability: 'nota-do', power: 'vozDo' },
  sol: { ability: 'nota-sol', power: 'vozSol', element: 'agua' },
  fa: { ability: 'nota-fa', power: 'vozFa', element: 'electrico' },
  re: { ability: 'nota-re', power: 'vozRe', physical: true },
  sib: { ability: 'nota-sib', power: 'vozSib', element: 'fuego' },
  la: { ability: 'nota-la', power: 'vozLa', all: true },
};
/** What the note `tone` is to La Voz (Mi, which she never sings, would be her plain Do). */
export const vozNote = (tone: ToneId) => VOZ_NOTES[tone === 'mi' ? 'do' : tone];
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
export type DualId = 'zarpazos-de-fuego' | 'punto-debil' | 'rayo-solar' | 'sutura-de-luz' | 'relevo-de-sangre' | 'bombardeo-orbital' | 'reserva-de-color' | 'sobrecalentamiento' | 'vulcano'
  | 'marea' | 'fulgurita' | 'suceso-seguro' | 'metralla' | 'idea-fija' | 'caleidoscopio'
  | 'geiser' | 'a-escala' | 'seiche' | 'staccato' | 'cadaver-exquisito' | 'trampantojo';
export interface DualSpec {
  id: DualId; name: string;
  parts: readonly [SkillId, SkillId];
  /** `allies`: a cure picks a wounded ally; any other kind, anyone standing (the whole party for a boost or a dome). */
  side: 'foes' | 'all-foes' | 'allies';
  /** `boost`, `guard` and `eco` deal no blow of their own (Suceso seguro, Caleidoscopio and Trampantojo, Idea fija). */
  kind: 'physical' | 'magic' | 'heal' | 'boost' | 'guard' | 'eco'; element?: Element;
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
  /** Vulcano: it leaves a volcano under every foe it reaches (the timed status Volcán). */
  volcano?: boolean;
  /**
   * A dúo mayor (docs/animas/README.md § Dúos mayores): far stronger than a dual, and it exists only
   * once its node at the jar is bought (`Improved.duals`), besides both halves being known.
   */
  major?: boolean;
  /** Sangrado stacks each foe it lands on is left with; a blow that cuts piles up, it never spends the wound. */
  bleed?: number;
  /** A timed status it leaves on every foe it reaches (Marea, Fulgurita, Metralla, Seiche; Staccato and Idea fija on its target). */
  leaves?: TimedId;
  description: string; abstract?: boolean;
}
export const DUALS: DualSpec[] = [
  { id: 'zarpazos-de-fuego', name: 'Zarpazos de fuego', parts: ['foc-binari', 'zarpazos'], side: 'foes', kind: 'physical', power: 8, strikes: 8, burn: 'quemado', burnChance: .75, description: 'Daño físico de fuego leve a un enemigo. Golpea ocho veces. Cada golpe puede quemarlo o subir su fuego.' },
  { id: 'punto-debil', name: 'Punto débil', parts: ['angulo', 'zarpazo'], side: 'foes', kind: 'physical', power: 20, weakSpot: true, description: 'Daño físico leve a un enemigo. El siguiente ataque que reciba hace el triple de daño.' },
  // Rayo solar: Gerard gives Bip his fire; Bip charges with it, sun yellow, and as the next round
  // starts it sweeps every foe with it.
  { id: 'rayo-solar', name: 'Rayo solar', parts: ['rayo-energia', 'foc-binari'], side: 'all-foes', kind: 'magic', power: 40, charge: true, burn: 'quemado', burnLevel: 2, description: 'Daño mágico de fuego alto a todos los enemigos. Se carga un turno y sale al empezar el siguiente. Los quema con fuego de nivel II.' },
  { id: 'sutura-de-luz', name: 'Sutura de luz', parts: ['cardioide', 'rayo-sanacion'], side: 'allies', kind: 'heal', power: 48, description: 'Cura alta a un aliado herido. Reduce a la mitad el siguiente daño que reciba esta ronda.' },
  { id: 'relevo-de-sangre', name: 'Relevo de sangre', parts: ['llaga', 'estrella-fugaz'], side: 'foes', kind: 'physical', power: 38, description: 'Daño físico alto a un enemigo. Gasta su sangrado. Si lo derrota, traslada la herida al enemigo con más PV.' },
  { id: 'bombardeo-orbital', name: 'Bombardeo orbital', parts: ['explosion', 'ostinato'], side: 'all-foes', kind: 'magic', power: 14, strikes: 3, charge: true, description: 'Daño mágico no elemental leve a todos los enemigos. Al empezar la ronda siguiente golpea tres veces. Los ciega durante 20 segundos.' },
  { id: 'reserva-de-color', name: 'Reserva de color', parts: ['foc-binari', 'punado'], side: 'foes', kind: 'magic', element: 'fuego', power: 38, abstract: true, description: 'Deja una mecha de polvo en un enemigo. Cuando termine su turno o caiga, estalla con daño mágico de fuego alto a todos los enemigos.' },
  // Sobrecalentamiento, a dual: Bip raises the dome of bits, of fire this time, Gerard's binary fire runs
  // into it, and it swells and bursts, its own bits flying at the foes and going off on each.
  { id: 'sobrecalentamiento', name: 'Sobrecalentamiento', parts: ['foc-binari', 'escudo-de-bits'], side: 'all-foes', kind: 'magic', element: 'fuego', power: 36, burn: 'quemado', burnLevel: 2, description: 'Daño mágico de fuego alto a todos los enemigos. Los quema con fuego de nivel II.' },
  // Vulcano, a dúo mayor: Gerard's fire goes into the ground and Marta's eco keeps it sounding. A volcano
  // of particles stands among the foes for 20 s, and every 5 s it throws lava on each and raises its fire.
  { id: 'vulcano', name: 'Vulcano', parts: ['foc-binari', 'ostinato'], side: 'all-foes', kind: 'magic', element: 'fuego', power: 28, burn: 'quemado', burnLevel: 1, volcano: true, major: true, description: 'Daño mágico de fuego medio a todos los enemigos. Los quema. Durante 20 segundos, un volcán les sube el fuego un nivel cada 5 segundos.' },
  // The dúos mayores of the other lines (docs/animas/README.md § Dúos mayores), one at the top of each.
  // Marea (Agua, with Freática): the cells are joined as communicating vessels; what rises in one rises in all.
  { id: 'marea', name: 'Marea', parts: ['vasos', 'recarga'], side: 'all-foes', kind: 'magic', element: 'agua', power: 26, leaves: 'marea', major: true, description: 'Daño mágico de agua medio a todos los enemigos. El agua de todos sube a la del que más tiene, y una marca más. Durante 20 segundos, el agua que sube en un enemigo sube en todos.' },
  // Fulgurita (Eléctrico, with Colorista): the glass a bolt leaves in sand. Every foe full of shards, and the shards one count.
  { id: 'fulgurita', name: 'Fulgurita', parts: ['descarga', 'punado'], side: 'all-foes', kind: 'magic', element: 'electrico', power: 26, leaves: 'fulgurita', major: true, description: 'Daño mágico eléctrico medio a todos los enemigos. Los cristaliza durante 20 segundos. Las esquirlas de todos cuentan juntas: cada golpe sobre uno hace crecer las de todos.' },
  // Suceso seguro (Cálculo, with Dadista): probability one. Luck worked out, for a round and the next.
  { id: 'suceso-seguro', name: 'Suceso seguro', parts: ['analisis', 'ases-en-duo'], side: 'allies', kind: 'boost', power: 3, major: true, description: 'Sube Fuerza, Magia y Crítico de todo el equipo durante 3 rondas. Hasta el final de la ronda siguiente, cada golpe del equipo es un golpe crítico seguro.' },
  // Metralla (Bip, with Papagato): Bip goes off in splinters that stay in the wounds and hold them open.
  { id: 'metralla', name: 'Metralla', parts: ['explosion', 'zarpazo'], side: 'all-foes', kind: 'physical', power: 26, bleed: 2, leaves: 'metralla', major: true, description: 'Daño físico medio a todos los enemigos. Añade sangrado. Durante 20 segundos, los golpes físicos cobran el sangrado sin gastarlo.' },
  // Idea fija (Mente, with Sincopante): an eco inside a foe's head; on each beat it strikes one of its own.
  { id: 'idea-fija', name: 'Idea fija', parts: ['confusion', 'ostinato'], side: 'foes', kind: 'eco', power: 34, leaves: 'idea-fija', major: true, description: 'Deja un eco dentro de un enemigo durante 20 segundos. Cada 5 segundos le hace golpear con fuerza a uno de los suyos.' },
  // Caleidoscopio (Taller, with Colorista): the dome of bits, of mirrors and powder. What it stops goes back.
  { id: 'caleidoscopio', name: 'Caleidoscopio', parts: ['escudo-de-bits', 'telon'], side: 'allies', kind: 'guard', power: 40, major: true, description: 'Protege a todo el equipo durante 2 rondas. Una cúpula de espejos detiene los golpes hasta que se rompe. Quien la golpea queda empolvado y recibe el daño que ha detenido.' },
  // The pairs that had none (docs/animas/README.md § Combined skills).
  // Géiser: fire under a foe's water; it all goes up at once, a blow a mark, and the steam blinds everyone.
  { id: 'geiser', name: 'Géiser', parts: ['foc-binari', 'recarga'], side: 'foes', kind: 'magic', element: 'fuego', power: 24, description: 'Daño mágico de fuego medio a un enemigo. Gasta su agua: un golpe por cada marca. El vapor ciega a todos los enemigos.' },
  // A escala: a foe shrunk stands lower in the same water.
  { id: 'a-escala', name: 'A escala', parts: ['rayo-encogedor', 'recarga'], side: 'foes', kind: 'magic', element: 'agua', power: 16, description: 'Daño mágico de agua leve a un enemigo. Lo encoge durante 20 segundos y sube su agua una marca. Encogido, se hunde con dos marcas.' },
  // Seiche: the water of a closed basin swinging to and fro. The eco keeps it moving, and so it never drains.
  { id: 'seiche', name: 'Seiche', parts: ['recarga', 'ostinato'], side: 'all-foes', kind: 'magic', element: 'agua', power: 14, leaves: 'seiche', description: 'Daño mágico de agua leve a todos los enemigos. Un eco repite el golpe cada 5 segundos durante 20 segundos y sostiene su agua.' },
  // Staccato: short notes, cut apart. The eco cuts again on each beat, so the wound grows by itself.
  { id: 'staccato', name: 'Staccato', parts: ['zarpazo', 'ostinato'], side: 'foes', kind: 'physical', power: 16, bleed: 2, leaves: 'staccato', description: 'Daño físico leve a un enemigo. Añade sangrado. Un eco repite el corte cada 5 segundos durante 20 segundos.' },
  // Cadáver exquisito: each adds a part without seeing the other's. Three handfuls, three elements nobody chose.
  { id: 'cadaver-exquisito', name: 'Cadáver exquisito', parts: ['punado', 'estrella-fugaz'], side: 'foes', kind: 'physical', power: 12, strikes: 3, description: 'Daño físico leve a un enemigo. Golpea tres veces. Cada golpe lo empolva y lleva un elemento al azar. Con racha 3 o más, los tres son distintos.' },
  // Trampantojo: a painted figure on the screen. Whoever goes through it no longer knows whose side it is on.
  { id: 'trampantojo', name: 'Trampantojo', parts: ['confusion', 'cortina'], side: 'allies', kind: 'guard', power: 0, description: 'Protege a un aliado con una cortina de polvo que reduce a la mitad el siguiente daño que reciba. El enemigo que la rompa queda confundido durante 20 segundos.' },
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
  mareo: { name: 'Mareo', max: 5, decay: 1, stats: { defensa: -1, espiritu: -1 }, mental: true },
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
export type TimedId = 'quemado' | 'cegado' | 'sanacion' | 'confusion' | 'encogido' | 'mojado' | 'empolvado' | 'envenenado' | 'cristalizado' | 'volcan' | 'virus' | 'bomba' | DualTimedId | WaterId;
/** What the newer duals leave on a foe: Marea's joined cells, Fulgurita's shared shards, Metralla's open wounds, and the ecos of Idea fija, Seiche and Staccato. */
export type DualTimedId = 'marea' | 'fulgurita' | 'metralla' | 'idea-fija' | 'seiche' | 'staccato';
/** La crecida's states (`CRECIDA`): the water under a foe, its current, the foe sunk in it, and the water frozen round it. */
export type WaterId = 'agua' | 'corriente' | 'hundido' | 'congelado';
export const WATER_IDS: readonly WaterId[] = ['agua', 'corriente', 'hundido', 'congelado'];
export interface TimedSpec {
  /** `element`: the one that lights it, for the reactions; `heal`: its pulses give PV back instead of taking it. */
  name: string; element?: Element; heal?: boolean; seconds: number; every: number;
  /** The share of the carrier's stats it takes away while it lasts, whatever they are (Encogido: a quarter of Defensa). */
  cut?: Partial<Record<keyof Stats, number>>;
  /** How hard each level's pulses hit, as times the base pulse (level I, II, III…); none: it never pulses (Cegado). */
  levels: readonly number[];
  /** The base pulse: `flat` PV plus `share` of the carrier's PV, counted up to `cap` PV. */
  flat: number; share: number; cap: number;
  /**
   * It can leave its carrier for another foe (Atractor extraño, `gather`): a trait of the kind of status, never of who
   * carries it. Not La crecida's water (the floor under each foe), a cure, Virus, a dual's own, nor the ones counted in rounds.
   */
  moves?: boolean;
}
export const TIMED: Record<TimedId, TimedSpec> = {
  // Empolvado (Colorista's powder): it hurts nobody; it waits for an element (`powder`, `POWDER_RULES`).
  empolvado: { name: 'Empolvado', seconds: 20, every: 20, levels: [], flat: 0, share: 0, cap: 0, moves: true },
  // Envenenado (water on powder): a pulse every few seconds, and every blow on its carrier lands harder while it lasts.
  envenenado: { name: 'Envenenado', seconds: 20, every: 4, levels: [1, 3, 5], flat: 2, share: .02, cap: 100, moves: true },
  // Cristalizado (electricity on powder): it hurts nobody by itself; its level is how deep the shards are (`POWDER_RULES.shard` more a blow for each).
  cristalizado: { name: 'Cristalizado', seconds: 20, every: 20, levels: [], flat: 0, share: 0, cap: 0, moves: true },
  // Its fourth level is Combustión (`COMBUSTION`): only reached while the passive is in the fight (`fireTop`).
  // Its levels do not climb in a line (Aitor 2026-11-22): each step bigger than the last (×1, ×3, ×6, ×11), so feeding a fire
  // pays more the higher it already is. II stays ×3 (more than twice I, `inflict`'s rule); El Plato and El Campeón got PV for III.
  quemado: { name: 'Quemado', element: 'fuego', seconds: 10, every: 2, levels: [1, 3, 6, 11], flat: 1, share: .01, cap: 100, moves: true },
  // Cegado (Humo, below): it hurts nobody; while it lasts the foe's physical blows often miss (`CEGADO`, `misses`). It has no
  // levels and never adds up (Aitor 2026-11-23): laid again, its clock only starts over (`blind`).
  cegado: { name: 'Cegado', element: 'agua', seconds: 10, every: 10, levels: [], flat: 0, share: 0, cap: 0, moves: true },
  // Sanación (Rayo de sanación): Quemado's other side, a pulse of PV back every few seconds.
  // A share of the carrier's PV, as every cure is (`HEAL`, src/stats.ts): a quarter of them over its 15 seconds at level I, and
  // each level up more than the last (×1, ×2.5, ×4: Aitor 2026-11-22, the cure was too thin).
  sanacion: { name: 'Sanación', heal: true, seconds: 15, every: 3, levels: [1, 2.5, 4], flat: 0, share: .05, cap: 1000 },
  // Confusión (Tecnópata): it hurts nobody; while it lasts the foe's blows go to its own (`enemyAct`).
  confusion: { name: 'Confusión', seconds: 30, every: 30, levels: [], flat: 0, share: 0, cap: 0, moves: true },
  // Encogido (Rayo encogedor): smaller, and a quarter of its guard gone while it lasts.
  encogido: { name: 'Encogido', seconds: 15, every: 15, levels: [], flat: 0, share: 0, cap: 0, cut: { defensa: .25 }, moves: true },
  // Mojado (Vasos comunicantes, Capilaridad): it hurts nobody; it waits for electricity (Conducción) or fire (Vapor).
  mojado: { name: 'Mojado', seconds: 20, every: 20, levels: [], flat: 0, share: 0, cap: 0, moves: true },
  // Volcán (the dúo mayor Vulcano): every beat a bomb of lava on its carrier, and its fire a level up (`runClock`).
  volcan: { name: 'Volcán', element: 'fuego', seconds: 20, every: 5, levels: [1], flat: 6, share: 0, cap: 0 },
  // The newer duals (`DUALS`). Marea: the cells joined, what rises in one rises in all (`raiseWater`). Fulgurita: the shards one
  // count (`fearDamage`). Metralla: a physical blow takes the wound's bonus and leaves the wound (`closeWound`). None of the three pulses.
  marea: { name: 'Vasos comunicantes', seconds: 20, every: 20, levels: [], flat: 0, share: 0, cap: 0 },
  fulgurita: { name: 'Fulgurita', seconds: 20, every: 20, levels: [], flat: 0, share: 0, cap: 0 },
  metralla: { name: 'Metralla', seconds: 20, every: 20, levels: [], flat: 0, share: 0, cap: 0 },
  // Their ecos, on the beat (`runClock`): Idea fija's makes its carrier strike one of its own (no pulse on itself), Seiche's
  // is a water blow that holds the water, Staccato's cuts again.
  'idea-fija': { name: 'Idea fija', seconds: 20, every: 5, levels: [1], flat: 0, share: 0, cap: 0 },
  seiche: { name: 'Seiche', seconds: 20, every: 5, levels: [1], flat: 7, share: 0, cap: 0 },
  staccato: { name: 'Staccato', seconds: 20, every: 5, levels: [1], flat: 5, share: 0, cap: 0 },
  // Virus (Virus atómico): it hurts nobody; what lands on its carrier spreads to the other foes (`spread`).
  virus: { name: 'Virus', seconds: 20, every: 20, levels: [], flat: 0, share: 0, cap: 0 },
  // Bomba (Bomba remota, BOMBA): it never pulses; it counts how long it has been on (`Timed.age`) and goes off when its time is up (`runClock`).
  bomba: { name: 'Bomba', seconds: 12, every: 12, levels: [], flat: 0, share: 0, cap: 0, moves: true },
  // La crecida (Freática, `CRECIDA`). Agua: its level is the marks (1–3), its clock the top mark's 20 s (`runWater` drains it).
  // Corriente: a bolt left in the water, Quemado's base pulse at ×1, ×2, ×3 with the water's mark. Hundido: while the water
  // stands at the third mark, 2 % of all the foe's PV every 2 s (the one pure share: no cap). Congelado (Bajo cero): the water
  // frozen, its level the marks of ice left, its clock all of them (`seconds`: three marks).
  agua: { name: 'Agua', seconds: 20, every: 20, levels: [], flat: 0, share: 0, cap: 0 },
  corriente: { name: 'Corriente', element: 'electrico', seconds: 10, every: 2, levels: [1, 2, 3], flat: 1, share: .01, cap: 100 },
  hundido: { name: 'Hundido', seconds: 20, every: 2, levels: [1], flat: 0, share: .02, cap: Infinity },
  congelado: { name: 'Congelado', seconds: 60, every: 60, levels: [], flat: 0, share: 0, cap: 0 },
};
const TIMED_IDS = Object.keys(TIMED) as TimedId[];
/**
 * Sincopante's ecos (docs/animas/sincopante/README.md § Signature). An eco is not a fighter: a figure of
 * light over the party that nobody can hurt or aim at. Every eco sounds on one shared beat, the compás
 * (`beat` s; the first eco called starts it, and it runs while one is up), for `life` s from its call.
 * At most `most` at once: a new one replaces the oldest. Crescendo raises its grade (*p*, *mf*, *f*):
 * `raise` times as strong from *mf*, and at *f* it reaches everyone. A pulse is not a blow: no golpe
 * crítico, no wound spent, no reaction, as a fire's pulse; it is the wearer's Magia at the moment it
 * sounds (`pulse` power: astral damage, or a cure). With its wearer in another ánima the ecos go on
 * muffled, at `muffled`; their wearer falling puts them all out. `offbeat`: half the window round the
 * middle of the compás where A contratiempo counts. `tutti`: how hard Tutti's last note sounds.
 */
export const ECOS = { beat: 5, life: 20, most: 3, pulse: 4, raise: 1.5, muffled: .5, offbeat: .5, tutti: 2 } as const;
export type EcoKind = 'ostinato' | 'bordon' | 'acompanamiento';
/** An eco on the field: its kind, who called it, whom it goes for (a foe, or the ally it goes with), its grade (0 *p*, 1 *mf*, 2 *f*) and the seconds it has left. */
export interface Eco { id: number; kind: EcoKind; owner: string; target?: string; grade: 0 | 1 | 2; left: number }
/** What an eco's note did to one fighter: PV off, or a cure (`heal`). */
export interface EcoHit { target: string; amount: number; heal?: true }
/** What the ecos did on their own, for the fight to show (`takeEcoNews`): a pulse (accented, off the beat), an eco gone (its wearer fell), three at once. */
export type EcoNews =
  | { kind: 'pulse'; eco: number; hits: EcoHit[]; accent?: true; muffled?: true }
  | { kind: 'out'; eco: number; fell?: true }
  | { kind: 'chord'; awoken?: true };
export const GRADE_NAMES = ['p', 'mf', 'f'] as const;
/** The ecos `c` called that are up now. */
export const ecosOf = (state: BattleState, c?: Combatant) => (state.ecos ?? []).filter(e => !c || e.owner === c.id);
/** Whether the ecos of `owner` sound muffled: their wearer is in another ánima. */
export const ecoMuffled = (state: BattleState, e: Eco) => state.allies.find(a => a.id === e.owner)?.classId !== 'sincopante';
/** Whether now is the off-beat: half a second either side of the middle of the compás. */
export const offbeat = (state: BattleState) => !!state.ecos?.length && state.compas !== undefined && (!!state.sureOffbeat || Math.abs(state.compas - ECOS.beat / 2) <= ECOS.offbeat);
/** A contratiempo, with Sincopante's level 3, on whoever wears it now. */
export const contratiempoOf = (state: BattleState, c: Combatant) => c.classId === 'sincopante' && c.hp > 0 && ((state.levels?.sincopante ?? 1) >= PASSIVES['a-contratiempo'].level! || !!state.unbound);
/** Pedal, with Sincopante's level 6, on whoever wears it now. */
export const pedalOf = (state: BattleState, c: Combatant) => c.classId === 'sincopante' && c.hp > 0 && ((state.levels?.sincopante ?? 1) >= PASSIVES.pedal.level! || !!state.unbound);
/** How strong an eco's note is: its grade, and half while muffled. */
const ecoScale = (state: BattleState, e: Eco) => (e.grade ? ECOS.raise : 1) * (ecoMuffled(state, e) ? ECOS.muffled : 1);
/** Whether Da capo is awake in this fight: bought, a chord has sounded while Sincopante was worn, and not used yet. */
export const capoReady = (state: BattleState) => skillKnown('da-capo', state.levels, state.improved)
  && (state.unbound || (!!state.dacapo?.woke && !state.dacapo.used));
/** What the ecos did since last asked (`EcoNews`), oldest first. */
export function takeEcoNews(state: BattleState): EcoNews[] {
  const news = state.ecoNews ?? [];
  delete state.ecoNews;
  return news;
}
/**
 * `actor` calls an eco of `kind` on `target` (a foe for Ostinato, the ally for Bordón and
 * Acompañamiento). A fourth replaces the oldest; the first starts the compás. The action says so (`ecoCalled`).
 */
function callEco(state: BattleState, actor: Combatant, kind: EcoKind, target: string | undefined, effect: BattleEffect) {
  const ecos = state.ecos ??= [];
  if (!ecos.length) state.compas = 0;
  const gone = ecos.length >= ECOS.most ? ecos.shift() : undefined;
  if (gone) (state.ecoNews ??= []).push({ kind: 'out', eco: gone.id });
  const eco: Eco = { id: state.ecoSerial = (state.ecoSerial ?? 0) + 1, kind, owner: actor.id, ...target ? { target } : {}, grade: 0, left: ECOS.life };
  ecos.push(eco);
  effect.ecoCalled = { ...eco };
  if (gone) effect.ecoReplaced = gone.id;
  state.message += kind === 'acompanamiento' ? ` Un eco acompaña a ${state.allies.find(a => a.id === target)?.name ?? 'su aliado'}.` : ' Queda un eco en el aire.';
}
/** The foe an Ostinato eco goes for: the one it was called on, or once it falls, the next its wearer hit, or the one with the fewest PV. */
function ecoAim(state: BattleState, e: Eco): Combatant | undefined {
  const standing = state.foes.filter(f => f.hp > 0 && !f.part);
  const named = standing.find(f => f.id === e.target);
  if (named) return named;
  const fewest = standing.reduce<Combatant | undefined>((least, f) => !least || f.hp < least.hp ? f : least, undefined);
  if (fewest) e.target = fewest.id;
  return fewest;
}
/**
 * One note of `e`, `scale` times as strong as its grade and wearer make it (Tutti's last, ×2): an
 * Ostinato eco strikes its foe (every foe at *f*), a Bordón eco cures whoever has least of their PV left
 * (the whole party at *f*). An Acompañamiento eco only sounds with its ally's blows (`accompany`), or in
 * Tutti's last note, on the foes. Never a golpe crítico, no wound, no reaction: a pulse, as a fire's.
 */
function ecoNote(state: BattleState, e: Eco, scale = 1): EcoHit[] {
  const owner = state.allies.find(a => a.id === e.owner);
  if (!owner || owner.hp <= 0) return [];
  const k = ecoScale(state, e) * scale, stats = current(state, owner);
  if (e.kind === 'bordon') {
    const party = state.allies.filter(a => a.hp > 0);
    const most = party.reduce<Combatant | undefined>((low, a) => !low || a.hp / a.maxHp < low.hp / low.maxHp ? a : low, undefined);
    const reached = e.grade === 2 ? party : most ? [most] : [];
    return reached.map(a => ({ target: a.id, amount: changeHealth(a, Math.max(1, Math.round(healing(ECOS.pulse, a.maxHp) * k))), heal: true as const }));
  }
  const power = e.kind === 'acompanamiento' ? SKILLS.find(s => s.id === 'acompanamiento')!.power : ECOS.pulse;
  const reached = e.grade === 2 ? state.foes.filter(f => f.hp > 0 && !f.part) : [ecoAim(state, e)].filter((f): f is Combatant => !!f);
  return reached.map(foe => ({ target: foe.id, amount: hurt(state, foe, Math.max(1, Math.round(magical(power, stats, current(state, foe)) * k))) }));
}
/**
 * The compás on the fight's clock (`runClock`): `seconds` pass for the ecos. Each beat every eco up
 * sounds (Acompañamiento's only with its ally's blows), three at once is a chord (it wakes Da capo while
 * Sincopante is worn); each eco's clock runs (stopped by Pedal while its wearer holds on) and it goes out
 * at its end. Whoever called them falling puts theirs out at once. What happened goes to `ecoNews`.
 */
function runEcos(state: BattleState, seconds: number): boolean {
  const ecos = state.ecos;
  if (!ecos?.length) { delete state.compas; return false; }
  const news = state.ecoNews ??= [];
  const before = news.length;
  const out = (e: Eco, fell?: true) => { ecos.splice(ecos.indexOf(e), 1); news.push({ kind: 'out', eco: e.id, ...fell ? { fell } : {} }); };
  let left = seconds;
  while (left > 1e-9 && ecos.length) {
    for (const e of [...ecos]) if ((state.allies.find(a => a.id === e.owner)?.hp ?? 0) <= 0) out(e, true);
    if (!ecos.length) break;
    const compas = state.compas ?? 0, step = Math.min(left, ECOS.beat - compas);
    left -= step; state.compas = compas + step;
    for (const e of ecos) { const owner = state.allies.find(a => a.id === e.owner); if (!owner?.pedal) e.left -= step; }
    if (state.compas >= ECOS.beat - 1e-9) {
      state.compas = 0;
      const sounding = ecos.filter(e => e.left > -1e-6);
      for (const e of sounding) {
        if (e.kind === 'acompanamiento') continue;
        const hits = ecoNote(state, e);
        if (hits.length) news.push({ kind: 'pulse', eco: e.id, hits, ...ecoMuffled(state, e) ? { muffled: true as const } : {} });
      }
      if (sounding.length >= ECOS.most) {
        const awake = state.allies.some(a => a.hp > 0 && a.classId === 'sincopante');
        const was = capoReady(state);
        if (awake) (state.dacapo ??= {}).woke = true;
        news.push({ kind: 'chord', ...!was && capoReady(state) && !state.unbound ? { awoken: true as const } : {} });
      }
    }
    for (const e of [...ecos]) if (e.left <= 1e-6) out(e);
  }
  if (!ecos.length) delete state.compas;
  return news.length > before;
}
/**
 * A contratiempo (Sincopante's level 3): an action of its wearer in the off-beat makes every eco of
 * theirs sound once more, at once and accented, their clocks untouched.
 */
function offbeatNotes(state: BattleState, actor: Combatant, effect: BattleEffect) {
  if (!contratiempoOf(state, actor) || !offbeat(state)) return;
  const mine = ecosOf(state, actor).filter(e => e.kind !== 'acompanamiento');
  if (!mine.length) return;
  const news = state.ecoNews ??= [];
  for (const e of mine) news.push({ kind: 'pulse', eco: e.id, hits: ecoNote(state, e), accent: true });
  note(effect, 'a-contratiempo', actor);
  state.message += ' A contratiempo: sus ecos suenan una vez más.';
}
/**
 * Acompañamiento: an eco at `actor`'s side repeats the blow of their action once, a light astral note
 * on the foe it struck (every foe at *f*). Its call itself is not a blow.
 */
function accompany(state: BattleState, actor: Combatant, effect: BattleEffect) {
  const e = state.ecos?.find(x => x.kind === 'acompanamiento' && x.target === actor.id);
  if (!e || effect.ecoCalled?.id === e.id) return;
  const struck = [...effect.hits?.map(h => h.target) ?? [], ...effect.target ? [effect.target] : []].find(id => state.foes.some(f => f.id === id));
  if (!struck || !(effect.amount || effect.hits?.some(h => h.amount))) return;
  const keep = e.target;
  e.target = struck;
  const foe = state.foes.find(f => f.id === struck)!;
  const hits = e.grade === 2 ? ecoNote(state, e) : foe.hp > 0 ? (() => { const k = ecoScale(state, e), owner = state.allies.find(a => a.id === e.owner); return owner && owner.hp > 0 ? [{ target: foe.id, amount: hurt(state, foe, Math.max(1, Math.round(magical(SKILLS.find(s => s.id === 'acompanamiento')!.power, current(state, owner), current(state, foe)) * k))) }] : []; })() : [];
  e.target = keep;
  if (hits.length) effect.accompanied = { eco: e.id, hits };
}
/** Tutti: every eco up sounds its last note, `ECOS.tutti` times as strong, and goes out. */
function lastNotes(state: BattleState, effect: BattleEffect) {
  const ecos = state.ecos ?? [];
  effect.tutti = ecos.map(e => ({ eco: e.id, kind: e.kind, hits: ecoNote(state, e, ECOS.tutti) }));
  ecos.length = 0; delete state.compas;
  if (effect.tutti.length) state.message += ` ${effect.tutti.length === 1 ? 'El eco suena' : `Los ${effect.tutti.length} ecos suenan`} una última vez y se apaga${effect.tutti.length === 1 ? '' : 'n'}.`;
}
/**
 * What the ecos up are still worth, for the bot (src/battle-sim.ts): each one's notes still to come at
 * its grade on whoever it would reach now, about. Pure: a copy of the fight is looked at.
 */
export function ecoWorth(state: BattleState): number {
  let worth = 0;
  const foes = state.foes.filter(f => f.hp > 0 && !f.part);
  if (!foes.length) return 0;
  for (const e of state.ecos ?? []) {
    const owner = state.allies.find(a => a.id === e.owner);
    if (!owner || owner.hp <= 0) continue;
    const beats = Math.max(0, Math.floor(e.left / ECOS.beat)), k = ecoScale(state, e), stats = current(state, owner);
    const aimed = foes.find(f => f.id === e.target) ?? foes.reduce((least, f) => f.hp < least.hp ? f : least);
    const guard = current(state, aimed);
    if (e.kind === 'bordon') {
      const hurtNow = state.allies.filter(a => a.hp > 0).reduce((sum, a) => sum + (a.maxHp - a.hp), 0);
      worth += Math.min(hurtNow, beats * healing(ECOS.pulse, owner.maxHp) * k * (e.grade === 2 ? state.allies.filter(a => a.hp > 0).length : 1)) * .9;
    } else if (e.kind === 'acompanamiento') worth += beats * .7 * magical(SKILLS.find(s => s.id === 'acompanamiento')!.power, stats, guard) * k * (e.grade === 2 ? foes.length : 1);
    else worth += Math.min(e.grade === 2 ? Infinity : aimed.hp, beats * magical(ECOS.pulse, stats, guard) * k * (e.grade === 2 ? foes.length : 1));
  }
  return worth;
}
/**
 * Reactions (docs/combat.md § Reacciones entre elementos): an Atacar with an element never lights a
 * status of its own; it turns what the foe already carries, whoever put it there.
 * Agua on Quemado is Humo: the fire goes out and leaves Cegado (its physical blows miss while it
 * lasts). Fuego on Sangrado is Cauterizado: the blow opens no wound, every stack
 * burns away at once for `cauterize` PV. Eléctrico on Cegado is Tormenta: the bolt runs through the
 * smoke, `storm` of magic on everyone blinded, and the smoke is gone. Eléctrico on Quemado is Plasma
 * (2026-11-23): the bolt sets the whole fire off at once, every pulse it had left `plasma` times as
 * hard, and it goes out. Tunable (`just fight-sim`, book `reaction`).
 */
export type ElementReaction = 'humo' | 'cauterizado' | 'tormenta' | 'vapor' | 'conduccion' | 'plasma' | 'estallido' | 'veneno' | 'cristal';
/**
 * With Mojado: Fuego on it is Vapor (the water goes up and leaves Cegado), and Eléctrico on it is
 * Conducción (`conduct` of magic on everyone wet, who are left dry). A foe's bolt on the party lands
 * whole on the one it struck and `share` of it on the others wet. Either way, whoever was struck wet
 * is left in Shock with a chance of `shock`: their next turn is lost (`Combatant.shock`).
 */
/** ∂Q/∂t Condensador: how many times the next electric blow lands, and what jumps to a foe that strikes first (base power). Tunable. */
export const CONDENSADOR = { scale: 2, jump: 20 };
export const REACTION_RULES = { cauterize: 6, storm: 24, conduct: 20, shock: .5, share: .5, plasma: 1.5 };
/**
 * Escudo de bits (docs/animas/tecnopata/README.md § Grade III): a dome of Bip's bits over the party.
 * Every blow on one of them goes into it first: it stops `share` of it (all of it), out of its own PV,
 * until they run out (it breaks, and what it could not stop gets through) or the round `until` is
 * over. Pulses go past it. A cure on someone under it that they have no room for patches it, up to
 * `cap` (its PV; Redundancia, `redundancia` times them). Tunable (`just fight-sim`).
 */
export const BITS = { share: 1, rounds: 2, redundancia: 3 };
export interface BitShield { hp: number; max: number; cap: number; until: number; share: number; broken?: boolean; hot?: boolean;
  /** Caleidoscopio: a dome of mirrors. Whoever strikes it takes what it stopped, and is left Empolvado (`wallSay`). */
  mirror?: boolean }
/**
 * Siete vidas' ward (docs/animas/papagato/README.md § Definitiva): one object shared by every ally
 * it covers. The first blow that would kill any of them, a pulse too, cures them instead what it was
 * going to take (never past their PV), and spends it for everyone (`changeHealth`).
 */
export interface LivesWard { spent?: { target: string; blow: number; amount: number } }
/** Whether `c` is still under Siete vidas' ward. */
export const warded = (c: Combatant) => !!c.lives && !c.lives.spent;
/** The shield standing in front of the party, if any. */
export const bitsOf = (state: BattleState) => state.allies.find(a => a.bits && a.bits.hp > 0 && !a.bits.broken)?.bits;
/** Under a bit dome a cure can still patch (`changeHealth`). */
const patchable = (c: Combatant) => !!c.bits && !c.bits.broken && c.bits.hp > 0 && c.bits.hp < c.bits.cap;
/** How high fire climbs by itself: Quemado III. */
export const FIRE_TOP = 3;
/**
 * Combustión (docs/animas/README.md § Combustión): with Matemágico's passive in the fight, fire climbs
 * one more, to `level` (IV, its own icon and look). A physical blow on a foe there makes it burst:
 * `blast` of fire magic on every foe, that one included, and every other foe's fire goes a level up
 * (Vapor on a wet one). The fire that burst goes back to `after`. Tunable (`just fight-sim`).
 */
export const COMBUSTION = { level: 4, blast: 24, after: 3 };
/**
 * Powder (docs/animas/README.md § Empolvado): it does nothing by itself and waits for a blow of an
 * element, whoever lands it. Fuego is Estallido: the powder explodes, `blast` of fire magic on its
 * carrier and `splash` of that on every other foe, which sets off the powder on any of them too, and
 * every foe standing is left Quemado a level higher, once. Agua is Envenenado: pulses, and every
 * blow on its carrier lands `poison` times as hard while it lasts. Eléctrico is Cristalizado: every
 * blow on its carrier does `shard` more for each level of it, and drives it a level deeper, up to
 * `shards`. Tunable (`just fight-sim`, book `powder`).
 */
export const POWDER_RULES = { blast: 22, splash: .5, poison: 1.25, shard: 4, shards: 5 };
/**
 * The cortina (docs/animas/README.md § Cortina de polvo): a screen of powder in front of an ally. The
 * next blow on them (never a pulse) lands at `share` of itself and breaks it; unbroken, it stands
 * `rounds` rounds, this one included. Whoever breaks it is left Empolvado (Rebufo). Tunable.
 */
export const CORTINA = { share: .5, rounds: 3 };
/** Trampantojo: how long the foe that breaks the painted cortina stays confused. */
export const DECOY_SECONDS = 20;
/** Rounds the cortina in front of `c` still stands, this one included (0: none). */
export const cortinaRounds = (state: BattleState, c: Combatant) => c.cortina !== undefined && c.cortina >= state.round && c.hp > 0 ? c.cortina - state.round + 1 : 0;
/** The reactions of powder, the three things it can be: Fin de fiesta wakes once a fight has seen them all. */
export const POWDER_TURNS = ['estallido', 'veneno', 'cristal'] as const;
export type PowderTurn = typeof POWDER_TURNS[number];
/** Whether Fin de fiesta is awake in this fight: bought, the powder has been all three things while Colorista was worn, and not used yet. */
export const finaleReady = (state: BattleState) => skillKnown('fin-de-fiesta', state.levels, state.improved)
  && (state.unbound || (!state.finale?.used && POWDER_TURNS.every(id => state.finale?.seen.includes(id))));
/** Whether Siete vidas is awake in this fight: bought, a wound of five stacks or more spent while Papagato was worn (`wakeLives`), and not used yet. */
export const livesReady = (state: BattleState) => skillKnown('siete-vidas', state.levels, state.improved)
  && (state.unbound || (!!state.lives?.woke && !state.lives.used));
/** Whether Bajo cero is awake in this fight: bought, a foe's water has reached the third mark while Freática was worn (`raiseWater`), and not used yet. */
export const coldReady = (state: BattleState) => skillKnown('bajo-cero', state.levels, state.improved)
  && (state.unbound || (!!state.cold?.woke && !state.cold.used));
/** Whether Enjambre is awake in this fight: bought, a Bomba remota has gone off at its top while Tecnópata was worn (`blowBomb`), and not used yet. */
export const swarmReady = (state: BattleState) => skillKnown('enjambre', state.levels, state.improved)
  && (state.unbound || (!!state.swarm?.woke && !state.swarm.used));
/** Whether the definitiva `skill` is awake in this fight (each wakes by its own condition). */
export const ultiReady = (state: BattleState, skill: SkillId) => skill === 'fin-de-fiesta' ? finaleReady(state) : skill === 'siete-vidas' ? livesReady(state) : skill === 'da-capo' ? capoReady(state) : skill === 'bajo-cero' ? coldReady(state) : skill === 'enjambre' ? swarmReady(state) : false;
/** The definitiva awake for `c`, if the ánima they wear has one and it is awake now. */
export const awakeUlti = (state: BattleState, c: Combatant) => SKILLS.find(skill => 'ulti' in skill && skill.class === c.classId && ultiReady(state, skill.id));
/** Whether the definitiva `skill` has gone off in this fight already. */
const ultiUsed = (state: BattleState, skill: SkillId) => !!(skill === 'fin-de-fiesta' ? state.finale?.used : skill === 'siete-vidas' ? state.lives?.used
  : skill === 'da-capo' ? state.dacapo?.used : skill === 'bajo-cero' ? state.cold?.used : skill === 'enjambre' ? state.swarm?.used : false);
/**
 * The definitiva of the ánima `c` wears, bought but still asleep in this fight, and how near it is to
 * waking (`have` of `need`), measured as its own condition measures it: the powder's turns seen
 * (Fin de fiesta), the deepest wound on a foe (Siete vidas), the most water on a foe (Bajo cero),
 * the ecos up at once (Da capo), the ripest bomb's power (Enjambre). `used`: it went off already.
 */
export function ultiProgress(state: BattleState, c: Combatant): { skill: SkillId; name: string; have: number; need: number; used?: true } | undefined {
  const spec = SKILLS.find(skill => 'ulti' in skill && skill.class === c.classId);
  if (!spec || !skillKnown(spec.id, state.levels, state.improved) || ultiReady(state, spec.id)) return undefined;
  const base = { skill: spec.id, name: spec.name };
  if (ultiUsed(state, spec.id)) return { ...base, have: 0, need: 0, used: true };
  const foes = state.foes.filter(f => f.hp > 0);
  const most = (values: number[]) => Math.max(0, ...values);
  switch (spec.id) {
    case 'fin-de-fiesta': return { ...base, have: state.finale?.seen.length ?? 0, need: POWDER_TURNS.length };
    case 'siete-vidas': return { ...base, have: Math.min(SCENT.sure, most(foes.map(f => stacks(f, 'sangrado')))), need: SCENT.sure };
    case 'bajo-cero': return { ...base, have: most(foes.map(waterOf)), need: CRECIDA.marks };
    case 'da-capo': return { ...base, have: Math.min(ECOS.most, state.ecos?.length ?? 0), need: ECOS.most };
    case 'enjambre': return { ...base, have: Math.round(most(foes.map(f => f.timed?.bomba ? bombPower(f.timed.bomba.age ?? 0) : 0))), need: BOMBA.top };
    default: return undefined;
  }
}
/** Whoever wears Colorista with Remolino learned, standing. */
export const remolinoOf = (state: BattleState) => (state.levels?.prismatico ?? 1) >= PASSIVES.remolino.level! || state.unbound ? state.allies.find(a => a.hp > 0 && a.classId === 'prismatico') : undefined;
/** The blows of the action being resolved that found a foe weak to their kind, or resisting it (`blowAffinity`); `amplify` hands them to its effect. */
const met: { target: string; blow: 'physical' | 'magic'; affinity: Affinity }[] = [];
/** What the poison and the shards added to the blows of the action being resolved; `amplify` hands it to its effect. */
const dug: { target: string; venom?: true; shards?: number }[] = [];
/** The blows of this action that landed on someone poisoned or full of shards: who, and what the shards added. */
function amplify(effect: BattleEffect) {
  if (met.length) effect.kinds = met.splice(0).filter((k, i, all) => all.findIndex(x => x.target === k.target) === i);
  if (dug.length) effect.amplified = dug.splice(0);
}
/**
 * What a foe is made of (docs/combat.md § Debilidades): a blow carrying an element it is
 * weak to lands `weak` times as hard, one it resists `resist`. By kind of foe and by element, never by
 * who strikes or with which skill: Atacar with an element, a skill of that element and a dual made
 * with one all count. Nothing says it beforehand; the first blow that finds it does (`BattleEffect.affinity`),
 * and from then on the foe's plate keeps it. Few foes have one, and only where it is part of the
 * fight's answer. Tunable (`just fight-sim`, book `element`).
 */
export const ELEMENT_RULES = { weak: 1.5, resist: .5 };
export type Affinity = 'weak' | 'resist';
/** What a foe can be weak to or resist: an element, or a physical blow (docs/combat.md § Debilidades). */
export type AffinityKey = Element | 'fisico';
export const affinityName = (key: AffinityKey) => key === 'fisico' ? 'Físico' : ELEMENTS[key].name;
export const AFFINITIES: Partial<Record<FoeKind, Partial<Record<AffinityKey, Affinity>>>> = {
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
  // Fran's salon (docs/quests/luca.md): a moth to the flame.
  // (Luca's shirts keep nothing off: the light of their colour already eats that element while they can be hurt.)
  polilla: { fuego: 'weak' },
};
/** What `element` finds in `c`: a weakness, a resistance or nothing. */
export const affinityOf = (c: Pick<Combatant, 'kind' | 'affinities' | 'castle' | 'timed'>, element?: AffinityKey): Affinity | undefined =>
  !element || !c.kind ? undefined : c.castle && isCastle(c.kind) ? castleAffinity(c, element) : c.affinities ? c.affinities[element] : AFFINITIES[c.kind]?.[element];
const affinityScale = (c: Combatant, element?: AffinityKey) => { const a = affinityOf(c, element); return a ? ELEMENT_RULES[a] : 1; };
/** The element a skill or a dual lands with: its own, or the one of what it lights (Foc Binari burns, Explosión melts: fire). */
export function elementOf(spec?: object): Element | undefined {
  if (!spec) return undefined;
  const s = spec as { element?: Element; burn?: TimedId; melts?: boolean };
  return s.element ?? (s.burn ? TIMED[s.burn].element : undefined) ?? (s.melts ? 'fuego' : undefined);
}
/** How long Bombardeo orbital's salvos leave every foe they find Cegado (s): longer than a smoke's. */
export const ORBITAL_BLIND = 20;
/** Whom a blinded foe's physical blows missed during the action being resolved, for its effect (`missSay`). */
const missTook: string[] = [];
/**
 * How often a blinded foe's physical blow misses (Aitor, 2026-11-23, `just fight-sim`, book `cegado`): in smoke (Humo,
 * Vapor, Géiser, the ice, the chaplains' mirrors, Bombardeo orbital) two blows in three; in Explosión's flash, which blinds
 * every foe at once for the round, one in three. A sure miss made the flash win fights it should not (the palace guards)
 * and taking the flash away lost the fights it answers (Negra, La Voz).
 */
export const CEGADO = { smoke: .66, flash: .33 };
/** Whether a blow of `actor`, blinded, misses this time (the fight's dice). */
export function blindMiss(state: BattleState, actor: Combatant) {
  const on = actor.timed?.cegado;
  if (!on || actor.hp <= 0) return false;
  return roll(state) < (on.until !== undefined ? CEGADO.flash : CEGADO.smoke);
}
/**
 * Cegado: a physical blow of a blinded foe may miss `who` whole (`blindMiss`: nothing lands, nothing is broken or spent on
 * them). Its magic still finds them. Says whether it missed, and keeps who for the effect.
 */
function misses(state: BattleState, actor: Combatant, who: Combatant) {
  if (!blindMiss(state, actor)) return false;
  if (!missTook.includes(who.id)) missTook.push(who.id);
  return true;
}
/** Hands whom this action's blows missed to `effect`, and says so in place of their «−0 PV». */
function missSay(state: BattleState, effect: BattleEffect, actor?: Combatant) {
  const missed = missTook.splice(0);
  if (!missed.length || !actor) return;
  effect.missed = missed;
  if (state.phase === 'lost') return;
  const said = state.message.replace(/−0 PV(?=[.!,]| ·|$)/g, '¡Falla!');
  state.message = said === state.message ? `${state.message} ${actor.name} no ve: ¡falla!` : `${said} ${actor.name} no ve nada.`;
}
/**
 * Cegado on `c` for `seconds`: laid again, it never adds up, its clock starts over (a longer one already on keeps its own). `until`: it also ends with that
 * round (Explosión's flash), unless a smoke of its own is already on, which stays as it is.
 */
function blind(c: Combatant, seconds: number = TIMED.cegado.seconds, until?: number) {
  const on = c.timed?.cegado, smoke = on && on.until === undefined ? on : undefined;
  if (until !== undefined && smoke) return;
  c.timed = { ...c.timed, cegado: { level: 1, left: Math.max(seconds, smoke?.left ?? 0), next: TIMED.cegado.every, ...until !== undefined ? { until } : {} } };
}
/** What Atractor extraño brought to its target from one other foe (`BattleEffect.gathered`). */
export interface Gathered { from: string; ids: TimedId[]; reactions: { id: ElementReaction; hits?: { target: string; amount: number }[] }[] }
/** A timed status on someone: its level (1 up), seconds left and seconds to its next pulse. */
export interface Timed {
  level: number; left: number; next: number;
  /** It also ends with this round, whatever its clock says (Explosión's blinding lasts one round). */
  until?: number;
  /** Bomba: the seconds it has been on, what it goes off with (`bombPower`). */
  age?: number;
}
/** What one pulse of a timed status did. */
export interface TimedPulse { target: string; status: TimedId; level: number; amount: number; heal?: boolean; mended?: number; saved?: Saved;
  /** Idea fija: the foe whose eco made it strike `target`. */
  by?: string;
  /** A Bomba remota went off (its `amount`), and the definitiva it woke, if any (Enjambre). */
  blast?: true; awoken?: SkillId }
/** Siete vidas' ward went off on a pulse or a round's tick: what it would have taken (`blow`), and the cure it gave instead. */
export interface Saved { blow: number; amount: number }
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
export function inflict(c: Combatant, id: TimedId, top = id === 'quemado' ? FIRE_TOP : TIMED[id].levels.length || 1): Timed {
  const spec = TIMED[id], on = c.timed?.[id];
  const timed = { level: on ? Math.max(on.level, Math.min(top, on.level + 1)) : 1, left: spec.seconds, next: spec.every };
  c.timed = { ...c.timed, [id]: timed };
  return timed;
}
export interface Combatant {
  id: string; name: string; hp: number; maxHp: number;
  /** Maná of the ánima worn now: what its skills spend (MANA_POINTS; 0 for Bernat, who wears none). */
  secondary: number; maxSecondary: number; guarding: boolean;
  /** Maná of each ánima not worn now, kept until it is worn again (missing: full). */
  mana?: Partial<Record<ClassId, number>>;
  /** Dadista's maná as dice: the face of each point it holds, worn or resting (`diceOf` keeps them in step). */
  dice?: DieFace[];
  /** Dadista: the last face spent this fight, the one a blank die repeats. */
  lastFace?: Exclude<DieFace, 'blanco'>;
  /** Dadista: they took part in a dual attack, and the next die dealt to them is likelier the Comodín (`COMODIN_AFTER_DUAL`). */
  comodinDue?: boolean;
  /** Dadista: the dice they have spent since they put it on (`RACHA`), and the times they shook the hand this fight (Agitar). */
  racha?: number; shaken?: number;
  /** Dadista: the size the meteor comes in on their next turn (1 Meteoro, 2 Asteroide), kept only by using it turn after turn. */
  meteor?: number;
  /** The ánimas this fighter can switch between (L / R): their own and the extras they equipped (docs/party.md). */
  kit?: ClassId[];
  /** The element chosen for their Atacar (`cycleElement`); it only counts while the ánima worn has it (`attackElement`). */
  element?: Element;
  /** Stats in this fight: the fighter's own plus their class's. */
  stats: Stats;
  /** Who the fighter is underneath (stats.ts), e.g. Gerard as a boy or at 35. */
  profile: ProfileId;
  /** How much larger the friends' ánimas have made them (.24: 24 % more): the foes' blows keep step with it (`FOE_BLOW`). */
  grown?: number;
  /** In the castle or out at night: the foes' blows land as hard whatever the party has grown (`FOE_BLOW.castle`), so the fight measures it. */
  steady?: boolean;
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
  /** Escolta: Bip stands by this ally until the end of round `until`, sent by `by` (who must keep wearing Tecnópata, standing). */
  escort?: { until: number; by: string };
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
  suture?: boolean;
  /** A cortina of powder in front of them: the round it stands until (`CORTINA`, `cortinaRounds`). */
  cortina?: number;
  /** Trampantojo: the cortina in front of them has a figure painted on it; the foe that breaks it is left confused (`cortinaSay`). */
  decoy?: boolean;
  /** Escudo de bits in front of the party: one shield, the same object on every ally it covers (`BitShield`). */
  bits?: BitShield;
  /** Virus atómico: what the foe carried when it was last looked at, so what lands on it after spreads (`spread`). */
  virusSeen?: { timed: Partial<Record<TimedId, Timed>>; statuses: Partial<Record<StatusId, number>> };
  fuse?: string; // The caster whose fire is in the paint.
  charge?: { dual: DualId; striker: string };
  /** Acecho: Haru crouched for this wearer, the foe she waits on; she lands as the next round starts (`pounce`). */
  stalk?: { target: string };
  /** Pedal (Sincopante, level 6): they hold on, and their ecos' clocks stand still until they act again. */
  pedal?: true;
  /** Siete vidas: Yuki among the party, the same ward on every ally it covers, until a blow that would kill one of them (`LivesWard`). */
  lives?: LivesWard;
  /** The round this fighter sits out (Explosión: Bip is putting itself back together). */
  out?: number;
  /** In Shock (a bolt found them wet): their next turn is lost, and it is gone with it. Shown as a status. */
  shock?: boolean;
  /** Cortocircuito left them in Shock: it cannot again until they have taken a turn of their own. */
  shorted?: true;
  /** ∂Q/∂t Condensador: charge stored, for the next electric blow they give or for the foe that strikes them first. Shown as a status. */
  capacitor?: true;
  /** Marks a debuff left on a foe (Ángulo exacto), by skill: its stats down by `amount` until the end of round `until`. */
  marks?: Partial<Record<SkillId, { amount: number; stats: (keyof Stats)[]; until: number }>>;
  /**
   * Punto débil (a dual): the next action that does damage to this foe lands every strike at
   * WEAK_SPOT times, and spends it. Unused, it fades at the end of round `weakSpot`.
   */
  weakSpot?: number;
  /** The round a blow last added Sangrado to them: a wound cut this round does not close at its end. */
  cutRound?: number;
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
  /** What the party's last afternoon left them (src/days.ts `EVENINGS`: En forma, Afinados…): a few points for the whole fight, shown with the other shifts. */
  evening?: { shifts: Partial<Record<keyof Stats, number>>; from: string };
  /** Joan's place on his scale (NOTES): his next note. */
  note?: number;
  /** Cortafuegos: the next damaging blow on this foe lands at SOBREMESA.shield, and spends it. It fades at the end of round `shielded`. */
  shielded?: number;
  /** A Dado: the face it shows this round (1–6), the weight of its blow. */
  face?: number;
  /** An Agente: face up (it takes every blow whole) or face down (half). */
  faceUp?: boolean;
  /** El Campeón: the steps his Plan has taken (it fires at `planMost`), whether he is in his Etapa II, and the steps magic took off it in the action under way. */
  plan?: number; stage2?: boolean; foiled?: number;
  /** La Voz: how many times her phrase has come round (Crescendo), and whether she is silent now (kept by the fight's clock for whoever draws her). */
  crescendo?: number; silent?: boolean;
  /** La Voz: whom she sings this turn of her phrase at (an ally's id): whoever struck her last in the turn before. */
  facing?: string;
  /** La Lealtad: who struck her last (an ally's id): whom her Juramento, and her Eco's Resonancia, are for. */
  sworn?: string;
  /**
   * La Lealtad: who struck her last this round. Her oath moves to them when the round ends, never
   * inside it, so whoever it names can hold on. La Voz: who struck her last in this turn of her
   * phrase; she sings the next turn at them, for the same reason.
   */
  struck?: string;
  /** Lo Cristalino has cracked: magic goes in, and its light comes out on everyone (Prisma). */
  cracked?: boolean;
  /** Lo Directo after its Estocada: stuck until its next turn, every blow on it lands MARTA.clavado times as hard. */
  stuck?: boolean;
  /** La Voz: an Acorde broke the Calderón she was holding her breath for; her next turn is lost to it. */
  winded?: boolean;
  /** La Voz's Enfado: blows that went through her while she sang; her next note goes at `at` and spends it (MARTA.enfado). */
  enfado?: { at: string; level: number };
  /** The castle's rules on this fighter (src/castle.ts `CastleMark`). */
  castle?: CastleMark;
  /** What this one is weak to or resists, when it is its own and not its kind's (`AFFINITIES`). The castle's are worked out from what each one is now (`castleAffinity`). */
  affinities?: Partial<Record<AffinityKey, Affinity>>;
  /** An Oscilación, El que no converge: the value it is on now, on its plate; the other one next round. */
  sign?: Sign;
  /** El que no converge: its marks of Error, on its plate. */
  error?: number;
  /** El Átomo: the electrons it still has, in the order they go round (ATOM_ORDER), and the one it threw last. */
  electrons?: Element[]; thrown?: Element;
  /** El que no converge has converged: its own turns left as a solid body (no move, every blow harder). */
  converged?: number;
  /** El que no converge is past its mark: Diverge, its second phase. */
  diverged?: boolean;
  /** El que no converge: the water of its Inunda ran off the party on the fight's clock, before its Descarga came. */
  drained?: boolean;
  /** El que no converge has seen the party wait its water out once (nothing says so but the look it gave): it will not shock a dried party again. */
  wary?: boolean;
  /** A chaplain Fran has just restyled (*Recién peinado*): the others copy what it does. */
  peinado?: boolean;
  /** A chaplain left mid-gesture by the fall of the freshly styled one: it loses its turn this round. */
  still?: number;
  /** Fran: the phase he is in (1 acolytes, 2 the canopy, 3 the aspergillum), and his Brillo, a shield that grows with every light. */
  stage?: 1 | 2 | 3; brillo?: number;
  /** One of the canopy's lamps (a part of Fran's fight): the lights it drinks. */
  lamp?: LampId;
  /** Bajo cero: the blows from outside its ice has taken, counted as `CRECIDA.blows` counts them (it breaks at that many). */
  cracks?: number;
}
/** Whom a move is aimed at when it is not one ally: everyone. */
export type Aim = 'todos';
/** Which fight this is: the street dogs, the palace minion that wakes Matemágico, or the palace guards of chapter 2. */
/** `escolta`: ring 3's fear, La Cebolla y los suyos (La Cebolla, a fantasmita and a cebollita). */
export type Encounter = 'dogs' | 'palace-minion' | 'palace-guards' | 'night-guard' | 'cebollon' | 'cebolla' | 'plato' | 'escolta' | 'uri-vertigo' | 'sobremesa' | BroodEncounter | CampingEncounter | CuerdasEncounter | CastleEncounter | ModeloEncounter | LucaEncounter;
/** The young that chase the party up each ring of Uri's tower, a few at a time. */
export const BROOD_ENCOUNTERS = ['crias-1', 'crias-2', 'crias-3'] as const;
export type BroodEncounter = (typeof BROOD_ENCOUNTERS)[number];
/**
 * Càmping Eurocamping's fights (docs/quests/universidad.md § Càmping Eurocamping): the entrance's magos,
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
export const MODELO_ENCOUNTERS = ['modelo-celdas', 'modelo-oscilacion', 'modelo-atomo', 'no-converge'] as const;
export type ModeloEncounter = (typeof MODELO_ENCOUNTERS)[number];
/** Who comes out in each of them, in the order they stand. */
export const MODELO_FIGHTS: Record<ModeloEncounter, readonly ModeloKind[]> = {
  'modelo-celdas': ['celda-seca', 'celda-seca', 'celda-seca'],
  'modelo-oscilacion': ['oscilacion', 'oscilacion'],
  'modelo-atomo': ['atomo'],
  'no-converge': ['no-converge'],
};
/** El Átomo's electrons, in the order they go round it and come off it in its Electrón. */
export const ATOM_ORDER: readonly Element[] = ['fuego', 'agua', 'electrico'];
/** In its Reacción they land in this order: the water first, the spark through it, then the fire on whoever the spark dried. */
const REACTION_ORDER: readonly Element[] = ['agua', 'electrico', 'fuego'];
/** Fran's salon in the Sagrada Família (docs/quests/luca.md): a fight in each zone, the light walking through all of them. */
export const LUCA_ENCOUNTERS = ['luca-recepcion', 'luca-sillones', 'luca-carta', 'fran'] as const;
export type LucaEncounter = (typeof LUCA_ENCOUNTERS)[number];
/** Who comes out in each of them, in the order they stand. */
export const LUCA_FIGHTS: Record<LucaEncounter, readonly LucaKind[]> = {
  'luca-recepcion': ['polilla', 'polilla', 'polilla'],
  'luca-sillones': ['capellan', 'capellan', 'capellan'],
  'luca-carta': ['estampado-rojo', 'estampado-azul', 'estampado-oro'],
  // Fran under the canopy with two acolytes; the canopy's three lamps (parts) are added by createLucaBattle.
  fran: ['fran', 'capellan', 'capellan'],
};
/** Uri's maze and roof (docs/quests/nuria.md), La Sobremesa, the campsite, Las cuerdas, the castle, Emilie's model and Fran's salon: the fights whose foes have rules of their own. */
export const FEAR_ENCOUNTERS = ['cebollon', 'cebolla', 'plato', 'escolta', 'uri-vertigo', 'sobremesa', ...BROOD_ENCOUNTERS, ...CAMPING_ENCOUNTERS, ...CUERDAS_ENCOUNTERS, ...CASTLE_ENCOUNTERS, ...MODELO_ENCOUNTERS, ...LUCA_ENCOUNTERS] as const;
/** Bernat's HP floor in the palace fight: the hit that would cross it stops there and starts the beat. */
export const BEAT_HP = 20;
export interface BattleState {
  allies: Combatant[]; foes: Combatant[]; active: number; round: number;
  phase: BattlePhase; message: string;
  enemyActions: string[];
  /** Dogs under La Reina Bubbaloo's spell: they surround the party, so nobody can escape. */
  possessed: boolean;
  encounter: Encounter;
  /** The ánimas this fight's foes have grown with (`growFoes`), for whoever joins it later. */
  grown?: number;
  /** Its pupils are Encarnados (src/castle.ts `STRONG`): beaten, the group lets go of an Eco de luz. */
  strong?: boolean;
  /** Party boosts running, by skill (Análisis Parálisis: Fuerza and Magia), each up by `amount` until the end of round `until`. */
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
  /** What the powder has been in this fight while Colorista was worn (`POWDER_TURNS`), and whether Fin de fiesta went off already. */
  finale?: { seen: PowderTurn[]; used?: true };
  /** Siete vidas in this fight: whether a wound of five or more has been spent while Papagato was worn (`woke`), and whether it went off. */
  lives?: { woke?: true; used?: true };
  /** Sincopante's ecos up now (`Eco`, ECOS), the last one's number, and what they did on their own since last asked (`takeEcoNews`). */
  ecos?: Eco[]; ecoSerial?: number; ecoNews?: EcoNews[];
  /** Seconds into the compás, the ecos' shared beat: it runs while an eco is up. */
  compas?: number;
  /** Da capo in this fight: whether a chord has sounded while Sincopante was worn (`woke`), and whether it went off. */
  dacapo?: { woke?: true; used?: true };
  /** La crecida: who holds the foes' water (whoever raised it last); if they fall, every cell breaks (`holdWater`). */
  water?: { by: string };
  /** Bajo cero in this fight: whether a foe's water has reached the third mark while Freática was worn, whether it went off, and whose Magia its ice breaks with. */
  cold?: { woke?: true; used?: true; by?: string };
  /** Enjambre (Tecnópata's definitiva): woken by a Bomba remota going off at its top while Tecnópata was worn; used. */
  swarm?: { woke?: true; used?: true };
  /**
   * Development (the picker's *Sin límites*): skills have no limit of use. A cure reaches anyone
   * standing, a boost or a mark can go again while it runs (it starts over), and a dual goes off as
   * often as wanted, maná or not.
   */
  unbound?: boolean;
  /** Development (the fight tester's «Crítico seguro»): every blow of the party is a golpe crítico. */
  sureCrits?: boolean;
  /** Suceso seguro: every blow of the party is a golpe crítico up to the end of this round. */
  certain?: number;
  /** Development (the fight tester's «Contratiempo seguro»): every action of Sincopante's wearer counts as in the off-beat. */
  sureOffbeat?: boolean;
  /** The fight's dice (`roll`): a seed set when the fight is created, stepped on every roll. */
  seed?: number;
  /** The golpe crítico's own dice (`luck`), started from `seed`. */
  luck?: number;
  /** Tries at Huir that failed in this fight (`escapeChance`): each one makes the next likelier. */
  escapeTries?: number;
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
   * blow on her and in which silence (`struck`, for the Acorde: the note it follows). `aim`: while a
   * blow confirmed earlier plays (behind the partner's), the moment it was pressed, which is the one
   * it is judged at (src/battle-ui.ts sets it and takes it away).
   */
  song?: { part: VozPart; t: number; struck?: { loop: number; index: number; by: string }; aim?: number };
  /** What the song did since it was last asked (`takeSongNews`): an Eco, a Crescendo, a new part. */
  songNews?: SongNews[];
  /** The castle's rules on this fight (src/castle.ts `CastleFight`). */
  castle?: CastleFight;
  /**
   * The light through the windows in Fran's salon (docs/quests/luca.md, src/vidrieras.ts): seconds
   * into its walk on the fight's clock. While a colour is on, the party's blows of its element do nothing.
   */
  light?: { t: number; walk?: WalkId };
  /** The lights that came on since it was last asked (`takeLightNews`). */
  lightNews?: LightId[];
  /** Fran's salon: the last gesture a foe made, for the freshly styled chaplain to copy. */
  copied?: { ability: FoeAbilityId; power: number; all: boolean; magic: boolean; by: string };
  /** Fran's salon: who of the party last struck with an element; the moths go for that flash. */
  flash?: string;
}
/** Something the song did on its own, for the fight to show. */
export type SongNews =
  | { kind: 'nota'; tone: ToneId; ability: FoeAbilityId; element?: Element; hits: NoteHit[]; conducted?: true; shocked?: string[] }
  | { kind: 'crescendo'; level: number }
  | { kind: 'mira'; target: string }
  | { kind: 'part'; part: VozPart };
/**
 * What one of La Voz's notes did to one of the party: the PV it took, whether they held on (a third,
 * and nothing left on them), and what it left: wet, a fire at that level, dried by the fire, or the
 * bolt run through the water; `angry`, the grade of the Enfado it spent.
 */
export interface NoteHit { target: string; amount: number; guarded?: true; wet?: true; burn?: number; dried?: true; conducted?: true; angry?: number;
  /** Cegado: a physical note of hers, blinded, missed them. */
  missed?: true }
/** A choice queued ahead by an ally later in the round (`queue`). */
export interface Queued { action: 'attack' | 'defend' | 'skill'; skill?: SkillId; target?: string; die?: number }
/**
 * Someone who fights on the party's side: `id` names them in the fight, `profile` gives their
 * stats, `grown` is how much larger the friends' ánimas gathered make them (.24: 24 % more), `evening` what their last
 * afternoon left them (src/days.ts `EVENINGS`), by name.
 */
export interface PartySlot {
  id: string; name: string; profile: ProfileId; classId?: ClassId; grown?: number;
  evening?: { shifts: Partial<Record<keyof Stats, number>>; from: string };
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
/**
 * How Huir works (docs/combat.md § Huir). The game plays `off`: Huir is only in the menu of the fights
 * the party can walk away from (`FLEEABLE`: the friends' missions and the way home at night), and there
 * it always works; anywhere else losing is how a party backs off (inside the palace and the castle,
 * Gerard wakes up at home to get stronger). `always`: it is in every fight and always works, as
 * development plays it (src/main.ts). `chance`: it works with `chance`, `step` more for each try that
 * failed in the same fight; a failed one spends that fighter's turn. `?escape=` in development tries the others.
 */
export type EscapeMode = 'always' | 'chance' | 'off';
export const ESCAPE: { mode: EscapeMode; chance: number; step: number } = { mode: 'off', chance: .5, step: .25 };
/**
 * The fights the game lets the party walk away from (2026-11-23): the friends' missions (Uri's maze and
 * his young, the campsite, Las cuerdas, Emilie's model, Fran's salon) and the guards loose on the
 * Meridiana at night. Not their bosses: there Huir is not in the menu at all.
 */
export const FLEEABLE: ReadonlySet<Encounter> = new Set(([
  'cebollon', 'cebolla', 'plato', 'escolta', ...BROOD_ENCOUNTERS, ...CAMPING_ENCOUNTERS, ...CUERDAS_ENCOUNTERS, ...MODELO_ENCOUNTERS, ...LUCA_ENCOUNTERS, 'night-guard',
] as Encounter[]).filter(id => !(['camping-negra', 'campeon', 'voz', 'no-converge', 'fran'] as Encounter[]).includes(id)));
/** The chance the next Huir works in this fight. */
export const escapeChance = (state: BattleState) => ESCAPE.mode === 'always' ? 1
  : ESCAPE.mode === 'off' ? FLEEABLE.has(state.encounter) ? 1 : 0 : Math.min(1, ESCAPE.chance + ESCAPE.step * (state.escapeTries ?? 0));
/** Whether Huir is in the menu of this fight at all. */
export const escapeShown = (state: BattleState) => ESCAPE.mode !== 'off' || FLEEABLE.has(state.encounter);
/** Nobody runs from possessed dogs, the palace minion or Vertitrón's roof; the palace guards and the maze's fears let them back off. */
export const cornered = (state: BattleState) => !escapeShown(state) || state.possessed || state.encounter === 'palace-minion' || state.encounter === 'uri-vertigo' || state.encounter === 'sobremesa' || state.encounter === 'fran'
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
  // PV stay; the stats, the skills and the maná change with the ánima. The Racha goes with Dadista.
  delete actor.racha; delete actor.meteor;
  swapMana(state, actor, id);
  actor.classId = id; actor.stats = statsWith(state, actor, id);
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
  // A die's faces are not skills of the list: Tirar dado reaches them (`FACE_SKILLS`).
  // …and the meteor is one row: the size it comes in now.
  const known = SKILLS.filter(skill => actor.classId === skill.class && !('face' in skill) && learned(state, skill.id) && (!('meteor' in skill) || skill.meteor === meteorOf(actor)) && (!('ulti' in skill) || ultiReady(state, skill.id)));
  // An awake definitiva heads the list: it is there for one use, and not below the fold.
  return [...known.filter(skill => 'ulti' in skill), ...known.filter(skill => !('ulti' in skill))];
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
const STAT_NAMES: Record<string, string> = { fuerza: 'Fuerza', magia: 'Magia', defensa: 'Defensa', espiritu: 'Espíritu', critico: 'Crítico' };
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
  if (c.evening) stats = withBonus(stats, c.evening.shifts);
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
export const STAT_SHORT: Record<string, string> = { fuerza: 'FUE', magia: 'MAG', defensa: 'DEF', espiritu: 'ESP', critico: 'CRÍ' };
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
    // Ases en dúo adds as much Crítico again as they have.
    for (const stat of ability.stats) add(stat, 'double' in ability ? ownCrit(state, c) / 2 : state.boosts![ability.id]!.amount, boostRounds(state, ability.id), ability.name);
  }
  // Racha: Crítico for as long as it is kept, so with no rounds.
  if (rachaOf(c)) add('critico', rachaOf(c) * RACHA.crit, 0, `Racha ${rachaOf(c)}`);
  for (const [id, mark] of Object.entries(c.marks ?? {}) as [SkillId, NonNullable<Combatant['marks']>[SkillId]][]) {
    if (!mark || mark.until < state.round) continue;
    for (const stat of mark.stats) add(stat, -mark.amount, mark.until - state.round + 1, SKILLS.find(s => s.id === id)!.name);
  }
  // For good, so with no rounds (Vertitrón's Grito liberador).
  for (const [stat, amount] of Object.entries(c.lasting?.shifts ?? {}) as [keyof Stats, number][]) if (amount) add(stat, amount, 0, c.lasting!.from);
  // And for the whole fight: what the afternoon left (En forma, Bien cenados…).
  for (const [stat, amount] of Object.entries(c.evening?.shifts ?? {}) as [keyof Stats, number][]) if (amount) add(stat, amount, 0, c.evening!.from);
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
export interface StatusTick { target: string; status: StatusId; amount: number; stacks: number; saved?: Saved }
export interface BattleEffect {
  kind: BattleAction | 'enemy'; actor: string; target?: string;
  /** Huir tried and not managed: the turn is spent and the fight goes on. */
  noWayOut?: true; amount?: number; skill?: SkillId; swallowed?: boolean; boosted?: string[]; status?: { id: StatusId; stacks: number };
  /** A cure: `amount` is the PV it gave back to `target`. */
  healed?: boolean;
  /** A timed status the hit lit or raised (Foc Binari's fire), and the level it is at now. */
  burn?: { id: TimedId; level: number };
  /** Maná Defender gave back. */
  charged?: number;
  /** Dadista defending: the faces of the dice that maná came as. */
  dealt?: DieFace[];
  /** A die spent (Dadista): its `face`, its place in the hand, and the face it did (`as`: a blank repeats another). */
  die?: { face: DieFace; at: number; as?: Exclude<DieFace, 'blanco'> };
  /** Dadista: the Racha after this action, when it moved; `starred` is what Estrella fugaz spent of it for the dice in `dealt`. */
  racha?: number; starred?: number;
  /** Dadista: the other dice a skill of two or three was paid with, after `die`. */
  paid?: DieFace[];
  /** Dados astrales: each die of light in the order it fell, and on whom. */
  rain?: { target: string; amount: number }[];
  /** The meteor's stage this action left the wearer at (0: back to Meteorito), when it moved. */
  meteor?: number;
  /** Corchete: the ally it now protects until the round ends. */
  guarded?: boolean;
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
  hits?: { target: string; amount: number; status?: { id: StatusId; stacks: number }; peeled?: number; bled?: number; drained?: number; crit?: true; weakSpot?: true; burn?: { id: TimedId; level: number }; smoked?: true; affinity?: Affinity }[];
  /** Sangrado stacks a physical blow spent on its target, each one making it land harder (`woundScale`). */
  bled?: number;
  /**
   * Papagato's claws one after another, in the order they land, each on the foe it found and with its
   * own golpe crítico: Cacería's (a claw for each stack; `hits[].drained` is the wound each foe lost) and
   * Siete vidas' (one on each foe).
   */
  hunt?: { target: string; amount: number; crit?: true }[];
  /** Acecho: Haru crouched for the wearer, waiting on this foe; she lands as the next round starts. */
  stalking?: string;
  /** Acecho landing as the round starts (news, `takeNews`): Haru's pounce on `target`. */
  pounce?: true;
  /** Siete vidas: the allies Yuki's ward now covers. */
  ward?: string[];
  /** Sincopante: the eco this action called (Ostinato, Bordón, Acompañamiento), and the oldest one it replaced, if three were up. */
  ecoCalled?: Eco; ecoReplaced?: number;
  /** Crescendo: each eco raised, with its new grade (its clock starts over). */
  ecosRaised?: { eco: number; grade: number }[];
  /** Tutti: each eco's last note, twice as strong, on whoever it reached; then they are all gone. */
  tutti?: { eco: number; kind: EcoKind; hits: EcoHit[] }[];
  /** Acompañamiento: the eco at this fighter's side repeated their blow. */
  accompanied?: { eco: number; hits: EcoHit[] };
  /** Da capo: the duals given back, and the ecos whose clocks started over. */
  dacapo?: { duals: DualId[]; ecos: number[] };
  /** Siete vidas' ward went off: the blow that would have killed `target` (`blow` PV) cured them `amount` instead. */
  lives?: { target: string; blow: number; amount: number };
  /** The blow, or one strike of it at least, was a golpe crítico (CRIT_RULES); `crits` says which strikes of a flurry. */
  crit?: boolean;
  crits?: boolean[];
  /** A dual attack: its two halves (by skill), who brought each, and the maná each one spent. */
  dual?: { id: DualId; name: string; parts: [SkillId, SkillId]; actors: [string, string]; spent: Record<string, number> };
  /** Per strike of a dual that may set fire (Zarpazos de fuego): 1 if it lit or raised it, 0 if not. */
  coins?: (0 | 1)[];
  detonation?: 'reserva-de-color' | 'bombardeo-orbital';
  relay?: { target: string; stacks: number };
  sutureSpent?: string;
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
  /** `targets`: whose powder turned (to poison, to shards). `burns`: who an Estallido left burning, and at what level. */
  reaction?: { id: ElementReaction; level?: number; stacks?: number; hits?: { target: string; amount: number }[]; targets?: string[]; burns?: { target: string; level: number }[] };
  /** Blows of this action that landed on someone Envenenado (`venom`) or Cristalizado (`shards`: what they added). */
  amplified?: { target: string; venom?: true; shards?: number }[];
  /** The kind of blow found what a foe is weak to or resists (a dish, a mago, glass, rancid gum): said on the blow as an element's is. */
  kinds?: { target: string; blow: 'physical' | 'magic'; affinity: Affinity }[];
  /** Cortinas of powder: the allies one stood up in front of, the ones whose screen this blow broke, and whoever it burst over (Rebufo). */
  cortina?: { raised?: string[]; broke?: string[]; rebufo?: string };
  /** Traca: each puff in the order it went off, and the foe it found. */
  volley?: { target: string; amount: number; crit?: true }[];
  /** Fin de fiesta: the blast on each foe and the fire it left, whom the water poisoned and whom the spark crystallised. */
  finale?: { hits: { target: string; amount: number }[]; burns: { target: string; level: number }[]; poisoned: { target: string; level: number }[]; crystallised: string[] };
  /** A definitiva woke with this action: the powder has now been all three things. */
  awoken?: SkillId;
  /** Telemetría: the timed statuses Bip's Atacar made last longer on its target, and by how many seconds. */
  extended?: { statuses: TimedId[]; seconds: number };
  /** Combustión burst on `target` (a physical blow found its fire at IV): the fire blast on each foe, and the fires it raised. */
  combustion?: { target: string; hits: { target: string; amount: number }[]; burns: { target: string; level: number }[]; steamed?: string[] };
  /** Reinicio and Rayo de energía: the clocks they started over on each foe. */
  restarted?: { target: string; statuses: TimedId[] }[];
  /** Escudo de bits raised (its PV), or what it took in this action and whether it broke. */
  bits?: { raised?: number; took?: number; broke?: boolean; mended?: number };
  /** Virus atómico: what spread from an infected foe to the others in this action. */
  spread?: { from: string; to: string[]; statuses: string[] }[];
  /**
   * Atractor extraño: what came to its target from each other foe (`from`), in the order it came, and what met there and
   * reacted (an Estallido's PV on each foe; `water`, the mark Vapor took off La crecida's).
   */
  gathered?: Gathered[];
  /** A cure on the whole party (Integral): what each one got back. */
  cures?: { target: string; amount: number }[];
  /** Rayo de sanación: the cure over time it left on its target, at this level. */
  regen?: { id: TimedId; level: number };
  /** Explosión: Bip blew itself up; who it blinded until the round ends. */
  exploded?: boolean; blinded?: string[];
  /** Cegado: whom a blinded foe's physical blows missed in this action (nothing landed on them). */
  missed?: string[];
  /** Bombas remotas set off by this action (Explosión), with what each took; foes a bomb was stuck on (Bomba remota, Escolta, Enjambre). */
  detonated?: { target: string; amount: number }[]; planted?: string[];
  /** Escolta: Bip went to stand by `target` for these rounds. */
  escorted?: number;
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
  /** El Campeón: his Plan after this action (`foiled`: the steps magic took off it), and his Etapa II just begun. */
  plan?: number; foiled?: number; stage2?: true;
  /** La Lealtad stepped in: the foe the blow was aimed at (`target` is her). */
  interposed?: string;
  /** Magic sent back (Lo Cristalino): the PV it took off whoever cast it. */
  reflected?: number;
  /** A blow on La Voz while a note sounds: it went through her. */
  sung?: true;
  /** La Voz's Enfado after this action: the grade it left her at (it went through her while she sang). */
  angered?: number;
  /** A blow of the element the light on now cancels (Fran's salon): it did nothing. */
  annulled?: LightId;
  /** Fran's salon: the chaplains the freshly styled one's fall left mid-gesture. */
  stopped?: string[];
  /** Fran's salon: shirts of Luca's a blow found out of their light (nothing done to them), and the light of one that fell, gone for good. */
  unlit?: string[]; lightOut?: LightId;
  /** Fran: his Brillo now (it grew with a light, or a lamp breaking took it away), his new phase, a lamp broken. */
  brillo?: number; stage?: 2 | 3; lampBroken?: string;
  /** A second blow on La Voz inside the same silence, by the other fighter: an Acorde. */
  chord?: true;
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
  /** Caleidoscopio: the dome of mirrors gave back what it stopped to whoever struck it, and powdered them. */
  mirrored?: { target: string; amount: number };
  /** Trampantojo: the foe that broke the painted cortina, left confused. */
  fooled?: string;
  /** A dual's own statuses, for the fight to show: who was left blinded by Géiser's steam, who a timed status of the dual was laid on. */
  vapour?: string[]; left?: { id: TimedId; targets: string[] };
  /** Cadáver exquisito: the element each handful carried, in order. */
  drawn?: Element[];
  /** Nanitos: the timed statuses a cure took off its target. */
  cleared?: TimedId[];
  /** Things a rule of the fight says by name over someone (the castle's: «Respuesta correcta», «Tropiezo», «No firma»). */
  called?: { target: string; text: string; detail?: string; status?: string }[];
  /** Water left these Mojado: a foe's on the party (Ola, an Electrón, Inunda), or anyone's on a Celda seca, which switches on. */
  wetted?: string[];
  /** El Átomo's fire left these Quemado; on these it found water and went up as Vapor (Cegado). */
  burnt?: string[]; steamed?: string[];
  /** El Átomo lost an electron to this blow (`off`, Ionizado) or took one back (`on`, Captura). */
  electron?: { element: Element; mark: 'off' | 'on' };
  /** El Átomo's Reacción: the electrons that went out at once, in the order they landed. */
  reacted?: Element[];
  /** A foe's spark ran through everyone wet in the party (their PV are `amount` and `splash`), and left them dry. */
  conducted?: true;
  /** El que no converge: its marks of Error after this blow, when it changed them (`mark`: one fewer or one more). */
  error?: { left: number; mark: 'off' | 'on' };
  /** El que no converge converged with this blow, or diverged again; an Oscilación or the boss is now on `sign`. */
  converged?: true; diverged?: true; sign?: Sign;
  /** Left in Shock by this blow (a bolt on someone wet): their next turn is lost. */
  shocked?: string[];
  /** Cortocircuito shorted in its target: why (it was wet, or it had a move announced, named), or why not (`again`: it shorted last time). */
  shorted?: { target: string; why: 'mojado' | 'anuncio' | 'again'; move?: string };
  /** ∂Q/∂t Condensador: `stored` on whoever used it; `spent` doubling this blow. */
  capacitor?: 'stored' | 'spent';
  /** ∂Q/∂t Condensador: a foe struck the one carrying the charge, and it jumped to that foe. */
  discharge?: { from: string; target: string; amount: number };
  /** This foe's turn, lost to Shock: nothing else happened in it. */
  stunned?: true;
  /** El que no converge saw the party wait its water out, the first time: its figures stop for a moment (src/modelo-foes.ts). */
  wary?: true;
  /** La crecida: each foe's water this action moved, from one mark to another (a raise, Bombeo, Golpe de ariete, Vapor). */
  water?: { target: string; from: number; to: number }[];
  /** La crecida: the waters a bolt charged (`renewed`: it only started their current over), and for how long. */
  current?: { targets: string[]; seconds: number; renewed?: true };
  /** Golpe de ariete: each blow of the water hammer in the order it landed, one a mark on each foe, and each one's golpe crítico. */
  hammer?: { target: string; amount: number; crit?: true }[];
  /** Bajo cero: who froze, and with how many marks of ice. */
  frozen?: { target: string; marks: number }[];
  /** Blows on a frozen foe's ice: the cracks it has now, a flame that melted a mark (`melted`), or the break and its blow (`broke`, its PV). */
  ice?: { target: string; cracks?: number; added?: number; melted?: true; broke?: number }[];
  /** Whoever held the water fell: every cell broke, and these were left Mojado on both sides. */
  cells?: { broke: string[]; wetted: string[] };
  /** This foe's turn was lost to its ice (Bajo cero). */
  iced?: true;
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
function changeHealth(target: Combatant, delta: number, pulse = false, exact = false) {
  // A blow on one of the party (never a pulse, never one measured to leave them standing) lands harder the more the party has grown.
  if (delta < 0 && !pulse && !exact && !target.kind) delta = -Math.round(-delta * foeBlow(target));
  if (target.suture && delta < 0) {
    delete target.suture;
    delta = -Math.ceil(-delta / 2);
  }
  // A cortina of powder: the next blow (never a pulse) lands at half and breaks it (`cortinaSay`).
  if (target.cortina !== undefined && delta < 0 && !pulse) {
    delete target.cortina; screenTook.push(target.id);
    delta = -Math.ceil(-delta * CORTINA.share);
  }
  // Escudo de bits: a blow (never a pulse) goes into the shield first, which stops its share of it.
  const wall = target.bits;
  if (wall && !wall.broken && wall.hp > 0 && delta < 0 && !pulse) {
    const stopped = Math.min(wall.hp, Math.round(-delta * wall.share));
    wall.hp -= stopped; delta += stopped;
    wallTook.took += stopped; if (wall.mirror) wallTook.mirror += stopped;
    if (wall.hp <= 0) { wall.broken = true; wallTook.broke = true; }
  }
  // A cure on someone under it: what they have no room for patches it, up to its cap.
  if (wall && !wall.broken && wall.hp > 0 && delta > 0 && target.hp > 0) {
    const mended = Math.min(Math.max(0, delta - (target.maxHp - target.hp)), wall.cap - wall.hp);
    if (mended > 0) { wall.hp += mended; wallTook.mended += mended; }
  }
  // Siete vidas: the blow that would kill them (whatever is left of it, a pulse too) cures them that much instead, once for the whole party.
  if (target.lives && !target.lives.spent && delta < 0 && target.hp > 0 && target.hp + delta <= 0) {
    const cure = Math.min(-delta, target.maxHp - target.hp);
    target.hp += cure;
    target.lives.spent = { target: target.id, blow: -delta, amount: cure };
    livesTook.push(target.lives.spent);
    return 0;
  }
  const result = adjustResource({ current: target.hp, max: target.maxHp }, delta, false);
  target.hp = result.resource.current;
  // Whoever falls loses the Racha.
  if (target.hp <= 0) { delete target.racha; delete target.meteor; }
  return Math.abs(result.amount);
}
/** What the bit shield took during the action being resolved (`changeHealth`), for its effect (`wallSay`). */
const wallTook = { took: 0, broke: false, mended: 0, mirror: 0 };
/** Siete vidas going off during the action being resolved (`changeHealth`): whom it saved, for its effect (`livesSay`). */
const livesTook: { target: string; blow: number; amount: number }[] = [];
/** Hands Siete vidas going off in this action to `effect`, and says so. */
function livesSay(state: BattleState, effect: BattleEffect) {
  const saved = livesTook.splice(0)[0];
  if (!saved) return;
  effect.lives = saved;
  const who = state.allies.find(a => a.id === saved.target);
  if (who && state.phase !== 'lost') state.message += ` ¡Siete vidas! El golpe no tumba a ${who.name}: +${saved.amount} PV.`;
}
/** Siete vidas going off on a pulse or a tick (no action to carry it): what it saved (the ward's own record), taken off the list. */
const livesOn = (id: string): Saved | undefined => {
  const i = livesTook.findIndex(s => s.target === id);
  return i < 0 ? undefined : livesTook.splice(i, 1)[0];
};
/** The allies whose cortina a blow broke during the action being resolved (`changeHealth`), for its effect (`cortinaSay`). */
const screenTook: string[] = [];
/** A cortina stands in front of `ally`; one already there starts over. */
function raiseCortina(state: BattleState, ally: Combatant, effect: BattleEffect) {
  delete ally.decoy;
  ally.cortina = state.round + CORTINA.rounds - 1;
  effect.cortina = { ...effect.cortina, raised: [...new Set([...effect.cortina?.raised ?? [], ally.id])] };
}
/**
 * Hands the cortinas this action broke to `effect`. Rebufo: the screen is powder, so it bursts over
 * whoever broke it (`breaker`, a foe standing) and leaves them Empolvado, whoever wears what.
 */
function cortinaSay(state: BattleState, effect: BattleEffect, breaker?: Combatant) {
  if (!screenTook.length) return;
  effect.cortina = { ...effect.cortina, broke: screenTook.splice(0) };
  const said = state.phase !== 'lost';
  // Trampantojo: the cortina had a figure painted on it. Whoever went through it does not know whose side it is on.
  const painted = state.allies.filter(a => a.decoy && effect.cortina!.broke!.includes(a.id));
  for (const a of painted) delete a.decoy;
  if (painted.length && breaker && breaker.hp > 0 && state.foes.includes(breaker) && !breaker.part) {
    breaker.timed = { ...breaker.timed, confusion: { level: 1, left: DECOY_SECONDS, next: DECOY_SECONDS } };
    effect.fooled = breaker.id;
    if (said) state.message += ` ¡Era un trampantojo! ${breaker.name} no sabe de qué lado está.`;
  }
  if (breaker && breaker.hp > 0 && state.foes.includes(breaker)) {
    kindle(breaker, 'empolvado', 1); effect.cortina.rebufo = breaker.id;
    if (said) state.message += ` La cortina revienta sobre ${breaker.name}: ¡${TIMED.empolvado.name}!`;
  } else if (said) state.message += ' La cortina se rompe.';
}
/** Hands what the shield took (and what a cure patched) in this action to `effect`, says it, and clears it. */
function wallSay(state: BattleState, effect: BattleEffect, striker?: Combatant) {
  // Caleidoscopio: what the mirrors stopped goes back to whoever struck them, with the powder they are made of.
  if (wallTook.mirror && striker && striker.hp > 0 && state.foes.includes(striker)) {
    const amount = hurt(state, striker, wallTook.mirror);
    if (striker.hp > 0) kindle(striker, 'empolvado', 1);
    effect.mirrored = { target: striker.id, amount };
    if (state.phase !== 'lost') state.message += ` El caleidoscopio se lo devuelve a ${striker.name}: −${amount} PV.`;
    if (!state.allies.every(a => a.hp <= 0) && beaten(state)) { state.phase = 'won'; state.message = winMessage(state); endFight(state); }
  }
  if (wallTook.took || wallTook.broke) effect.bits = { ...effect.bits, took: (effect.bits?.took ?? 0) + wallTook.took, ...wallTook.broke ? { broke: true } : {} };
  if (wallTook.mended) effect.bits = { ...effect.bits, mended: (effect.bits?.mended ?? 0) + wallTook.mended };
  if (state.phase !== 'lost') {
    if (wallTook.broke) state.message += ' ¡La cúpula de bits se rompe!';
    else if (wallTook.took && !effect.amount && !effect.hits?.some(h => h.amount > 0)) state.message += ' La cúpula de bits lo para.';
    if (wallTook.mended) state.message += ` La cúpula de bits se recompone: +${wallTook.mended} PV.`;
  }
  wallTook.took = 0; wallTook.broke = false; wallTook.mended = 0; wallTook.mirror = 0;
}
/** What a cure's pulse patched on the shield, taken (`runClock`). */
const wallMended = () => { const n = wallTook.mended; wallTook.mended = 0; return n; };
/** Damage on a foe, from anything (a blow, a tick, a pulse). */
function hurt(state: BattleState, c: Combatant, amount: number) {
  // La Voz is all voice while she sings: nothing reaches her then, not even a fire already on her.
  if (singing(state, c)) return 0;
  const dealt = changeHealth(c, -Math.max(0, Math.min(amount, c.hp)));
  if (c.fuse && !c.hp) ignitePaint(state, c);
  return dealt;
}
/** What La Voz's song is on now (`undefined` in any other fight). */
export const songNow = (state: BattleState): Moment | undefined => state.song ? songAt(VOZ_SONG, state.song.t) : undefined;
/** Seconds a blow may be judged at the moment it was pressed, before its turn came to play (`song.aim`). */
const AIM_KEPT = 3;
/**
 * The moment a blow on La Voz is judged at: when it was pressed (the fight sets `song.aim` while it
 * plays a blow confirmed earlier, behind the partner's), or now.
 */
function songAim(state: BattleState): Moment {
  const { t, aim } = state.song!;
  return songAt(VOZ_SONG, aim !== undefined && aim <= t && t - aim <= AIM_KEPT ? aim : t);
}
/**
 * The silence of La Voz's song at moment `m`: which one (the note it follows, and the turn round that
 * note is in), or nothing while a note sounds. A note that came after a silence still counts as it for
 * its first `hueco` seconds: the ear hears her start a little late.
 */
export function silenceAt(m: Moment): { loop: number; index: number } | undefined {
  if (!m.sounding) return { loop: m.loop, index: m.index };
  const last = VOZ_SONG.beats.length - 1, before = m.index ? { loop: m.loop, index: m.index - 1 } : { loop: m.loop - 1, index: last };
  return m.into < MARTA.hueco && VOZ_SONG.beats[before.index].rest > 0 ? before : undefined;
}
/** The silence a blow on La Voz falls in (when it was pressed), if she is silent then. */
const openSilence = (state: BattleState) => state.song ? silenceAt(songAim(state)) : undefined;
/** Whether `c` is La Voz while a note sounds: she is all voice then, and nothing hurts her. */
export const singing = (state: BattleState, c: Combatant) => c.kind === 'voz' && !!state.song && !openSilence(state);
/** The light on now in Fran's salon (`undefined` in any other fight). */
export const lightNow = (state: BattleState): LightId | undefined => state.light ? lightAt(state.light.t, state.light.walk).light : undefined;
/**
 * Whether the light on now eats `actor`'s blow of `element`: only the party's, only in Fran's salon
 * (docs/quests/luca.md). Returns the light, to say which.
 */
export function annulled(state: BattleState, actor: Combatant, element?: Element, kind?: string): LightId | undefined {
  const light = lightNow(state);
  if (!light || !state.allies.includes(actor)) return undefined;
  // The white light carries no element: it eats the physical blows, whatever element Atacar carries.
  const eats = lightEats(state, light);
  return (eats === 'fisico' ? kind === 'physical' : !!element && eats === element) ? light : undefined;
}
/**
 * Fran's fight (docs/quests/luca.md § Final boss): whether the canopy's lamp that drinks `light` lies
 * broken, its colour rained back on the party, so that light eats nothing of theirs any more.
 */
export const lightFreed = (state: BattleState, light: LightId) => state.encounter === 'fran' && state.foes.some(f => f.kind === 'lampara' && f.hp <= 0 && !!f.lamp && LAMPS[f.lamp].lights.includes(light));
/** What `light` eats of the party's blows now: its element, `fisico` for the white one, nothing once its lamp is broken. */
export const lightEats = (state: BattleState, light: LightId) => lightFreed(state, light) ? undefined : cancels(light);
/** How the fight says a blow the light ate. */
const annulledText = (light: LightId) => `La luz ${LIGHTS[light].name.toLowerCase()} se lo come: nada.`;
/** Whether magic comes back off `c`: Lo Cristalino until it cracks. */
export const reflects = (c: Combatant) => c.hp > 0 && c.kind === 'cristalino' && !c.cracked;
/** La Lealtad, if she stands and `target` is another foe: she takes the blow aimed at it. */
const guardOf = (state: BattleState, target: Combatant) => target.kind === 'lealtad' ? undefined : state.foes.find(f => f.kind === 'lealtad' && f.hp > 0);
/**
 * A blow on La Voz inside a silence someone else already struck her in is an Acorde: `acorde` times
 * as hard, once a silence. Returns the scale; `landed` (after the blow) remembers who struck, or spends it.
 */
function chordScale(state: BattleState, actor: Combatant, target: Combatant) {
  const gap = target.kind === 'voz' ? openSilence(state) : undefined, struck = state.song?.struck;
  return gap && struck && struck.loop === gap.loop && struck.index === gap.index && struck.by !== actor.id ? MARTA.acorde : 1;
}
function landed(state: BattleState, actor: Combatant, target: Combatant, amount: number, chord: number, effect: BattleEffect) {
  const gap = target.kind === 'voz' ? openSilence(state) : undefined;
  if (!gap || !state.song || amount <= 0) return;
  if (chord > 1) {
    effect.chord = true; delete state.song.struck;
    // An Acorde breaks the Calderón she was holding her breath for: her next turn is lost to it.
    if (target.intent?.ability === 'calderon' && target.hp > 0) { delete target.intent; target.winded = true; effect.cancelled = 'calderon'; }
  } else state.song.struck = { loop: gap.loop, index: gap.index, by: actor.id };
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
 * Dadista's maná is dice (docs/animas/dadaista/): each point is a die with its face in view, rolled
 * when the maná comes (the fight's start, Defender, a round's rest). Each face is a move of its own:
 * Tirar dado spends the die chosen and does what its face says (`FACE_SKILLS`).
 */
export const DICED: ClassId = 'dadaista';
/**
 * What a face can show. Blanco does nothing of its own: it repeats the last face spent (`lastFace`).
 * The Comodín is not a face of the die but a die of its own (black lacquer, a vermilion star).
 */
export type DieFace = 'mano' | 'tijeras' | 'ojo' | 'corchete' | 'blanco' | 'comodin';
/** The die's six faces: two hands, and one of each of the rest. */
export const DIE_FACES: readonly DieFace[] = ['mano', 'mano', 'tijeras', 'ojo', 'corchete', 'blanco'];
/** The move each face does when its die is spent. */
export const FACE_SKILLS: Record<Exclude<DieFace, 'blanco'>, SkillId> = { mano: 'cara-mano', tijeras: 'cara-tijeras', ojo: 'cara-ojo', corchete: 'cara-corchete', comodin: 'cara-comodin' };
/** One roll of the fight's dice: a face. */
export const rollFace = (state: BattleState): DieFace => DIE_FACES[Math.floor(roll(state) * DIE_FACES.length)];
/**
 * The Comodín (Aitor, 2026-11-15; on the faces since 2026-11-19): now and then a die dealt is not a
 * face but the Comodín, `COMODIN_CHANCE` of them, and a hand's blow on every foe standing. A dual
 * attack calls it: the next die dealt to whoever took part in one (`Combatant.comodinDue`) is the
 * Comodín `COMODIN_AFTER_DUAL` of the times.
 */
export const COMODIN_CHANCE = .02, COMODIN_AFTER_DUAL = .2;
/** A die dealt to `c`'s hand: a face of the die or, rarely, the Comodín (less rarely on the first die after a dual). */
function dealDie(state: BattleState, c: Combatant): DieFace {
  const chance = c.comodinDue ? COMODIN_AFTER_DUAL : COMODIN_CHANCE, r = roll(state);
  delete c.comodinDue;
  return r < chance ? 'comodin' : DIE_FACES[Math.min(DIE_FACES.length - 1, Math.floor((r - chance) / (1 - chance) * DIE_FACES.length))];
}
/**
 * `c`'s dice, in the order they came: as many as their Dadista holds maná now, whether they wear it
 * or it rests. Maná that came since the last look is rolled here, so the hand is always in step.
 */
export function diceOf(state: BattleState, c: Combatant): DieFace[] {
  if (!state.allies.includes(c) || (c.classId !== DICED && !kitIn(state, c).includes(DICED))) return [];
  const most = manaMax(state.improved, DICED, state.levels), count = c.classId === DICED ? c.secondary : Math.min(most, c.mana?.[DICED] ?? most);
  const hand = c.dice ??= [];
  while (hand.length < count) hand.push(dealDie(state, c));
  hand.length = Math.min(hand.length, count);
  return hand;
}
/** Whether `skill` spends a die of the hand, chosen by whoever uses it (Tirar dado, Estrella fugaz). */
export const dieUse = (skill?: SkillId): boolean => { const spec = SKILLS.find(s => s.id === skill); return !!spec && 'die' in spec; };
/** Whether the die `skill` spends decides what it does (Tirar dado); Estrella fugaz is only paid with one. */
export const faceUse = (skill?: SkillId): boolean => { const spec = SKILLS.find(s => s.id === skill); return !!spec && 'die' in spec && spec.die === true; };
/**
 * Racha (docs/animas/dadaista/ § Racha): Dadista's own rule, from its first level, and what the rest
 * of it hangs from. Every die its wearer spends, on whatever, adds one, and each point is `crit`
 * more Crítico for them. It is lost on taking Dadista off and on falling. With `comodin` or more,
 * Agitar turns one die of the hand into the Comodín; Estrella fugaz spends `star` to deal `deal` dice.
 */
export const RACHA = { crit: 10, comodin: 3, star: 3, deal: 2 };
/**
 * The rule an ánima has from its first level and that all of it hangs from, as its page in the
 * status screen says it (not a passive: nothing teaches it and nothing buys it).
 */
export const ANIMA_RULES: Partial<Record<ClassId, { name: string; description: string }>> = {
  dadaista: { name: 'Racha', description: `Cada dado gastado suma 1 de racha: Crítico +${RACHA.crit} % por cada uno. Se pierde al cambiar de ánima o al caer.` },
  prismatico: { name: 'Rebufo', description: 'Quien rompe una cortina de polvo queda empolvado.' },
};
/** Dados astrales: a die of light for each `per` % of Crítico, never fewer than `least` nor more than `most`. */
export const RAIN = { per: 15, least: 2, most: 12 };
/** The stage the meteor comes in for `c` now: 0 Meteorito, 1 Meteoro, 2 Asteroide. */
export const meteorOf = (c: Combatant) => c.classId === DICED && c.hp > 0 ? Math.min(2, c.meteor ?? 0) : 0;
/** The dice of light Dados astrales drops for `c` now, from their Crítico with the Racha (and Ases en dúo). */
export const rainCount = (state: BattleState, c: Combatant) => Math.max(RAIN.least, Math.min(RAIN.most, Math.floor(ownCrit(state, c) / RAIN.per)));
/** `c`'s Racha now: none unless they wear Dadista and stand. */
export const rachaOf = (c: Combatant) => c.classId === DICED && c.hp > 0 ? c.racha ?? 0 : 0;
/** How many times a fight Agitar can be used, before its node at the jar. */
export const SHAKES = 1;
/** The times `c` can still shake the hand in this fight: none before Agitar is learned. */
export const shakesLeft = (state: BattleState, c: Combatant) => c.classId === DICED && c.hp > 0 && learned(state, 'agitar') ? Math.max(0, SHAKES + (passive(state, c, 'otra-vez') ? 1 : 0) - (c.shaken ?? 0)) : 0;
/**
 * Agitar: the active ally throws the whole hand again, and the turn stays theirs. With Racha enough
 * (`RACHA.comodin`) one of the dice, picked on the fight's dice, comes out the Comodín unless one
 * already did. Returns the new hand and where the Comodín it gave is, or nothing when it cannot be.
 */
export function shake(state: BattleState): { faces: DieFace[]; comodin?: number } | undefined {
  const actor = state.allies[state.active];
  if (state.phase !== 'player' || !actor || !shakesLeft(state, actor)) return;
  const hand = diceOf(state, actor);
  if (!hand.length) return;
  for (let at = 0; at < hand.length; at++) hand[at] = dealDie(state, actor);
  let comodin: number | undefined;
  if (rachaOf(actor) >= RACHA.comodin && !hand.includes('comodin')) { comodin = Math.floor(roll(state) * hand.length); hand[comodin] = 'comodin'; }
  actor.shaken = (actor.shaken ?? 0) + 1;
  state.message = `${actor.name} agita la mano y vuelve a tirar.${comodin !== undefined ? ' La racha le saca el Comodín.' : ''}`;
  return { faces: [...hand], comodin };
}
/** The face a die of `face` does for `c`: its own, or for a blank the last one spent (none yet: nothing). */
export const faceAs = (c: Combatant, face: DieFace): Exclude<DieFace, 'blanco'> | undefined => face === 'blanco' ? c.lastFace : face;
/** The move the die at `at` in the active ally's hand does, if it can do one. */
export function dieSkill(state: BattleState, at: number): SkillId | undefined {
  const actor = state.allies[state.active], face = actor && diceOf(state, actor)[at], as = actor && face ? faceAs(actor, face) : undefined;
  return as && FACE_SKILLS[as];
}
/** Which faces go first when nobody chose: the Comodín, a blow, a wound, an eye (on a foe not marked yet), then the rest. */
const FACE_ORDER: readonly Exclude<DieFace, 'blanco'>[] = ['comodin', 'mano', 'tijeras', 'ojo', 'corchete'];
/** The die the active ally spends when nobody chose: by `FACE_ORDER`, a blank after the face it repeats; −1 when no die can do anything. */
export function bestDie(state: BattleState) {
  const actor = state.allies[state.active], hand = actor ? diceOf(state, actor) : [];
  const usable = hand.map((_, at) => at).filter(at => { const skill = dieSkill(state, at); return !!skill && validTargets(state, 'skill', skill).length > 0; });
  const rank = (at: number) => FACE_ORDER.indexOf(faceAs(actor!, hand[at])!) * 2 + (hand[at] === 'blanco' ? 1 : 0)
    + (hand[at] !== 'blanco' && faceAs(actor!, hand[at]) === 'ojo' && state.foes.every(f => f.hp <= 0 || weakSpotRounds(state, f)) ? 10 : 0);
  return usable.sort((a, b) => rank(a) - rank(b))[0] ?? -1;
}
/** The die that pays for a skill when nobody chose: the one worth least now (a blank with nothing to repeat, then by `FACE_ORDER` from its end); −1 with an empty hand. */
export function spareDie(state: BattleState) {
  const actor = state.allies[state.active], hand = actor ? diceOf(state, actor) : [];
  const worth = (face: DieFace) => { const as = faceAs(actor!, face); return as ? FACE_ORDER.length - FACE_ORDER.indexOf(as) : 0; };
  return hand.map((_, at) => at).sort((a, b) => worth(hand[a]) - worth(hand[b]))[0] ?? -1;
}
/**
 * Spends the die at `at`, and says on `effect` which face it was and, when the face is what was
 * played (Tirar dado: `played`), what it did. A die that only pays (Estrella fugaz) leaves the last
 * face as it was. Either way it is one more for the Racha.
 */
function spendDie(actor: Combatant, hand: DieFace[], at: number, effect: BattleEffect, played = true) {
  const face = hand[at], as = played ? faceAs(actor, face)! : undefined;
  effect.die = { face, at, ...as ? { as } : {} };
  hand.splice(at, 1); actor.secondary--;
  actor.racha = (actor.racha ?? 0) + 1;
  // A blank after the Comodín repeats its hand, on one foe: the star is not repeated.
  if (as) actor.lastFace = as === 'comodin' ? 'mano' : as;
}
/** The action is validated before payment, just as it is in the generic command resolver. */
function spendSecondary(actor: Combatant, cost: number) {
  actor.secondary = adjustResource({ current: actor.secondary, max: actor.maxSecondary }, -cost).resource.current;
}
function fighter(slot: PartySlot, unlocked: readonly ClassId[] = []): Combatant {
  const stats = grown(withBonus(PROFILES[slot.profile], slot.classId ? CLASS_STATS[slot.classId] : undefined), slot.grown);
  const points = slot.profile === 'bernat' ? 0 : MANA_POINTS;
  return { id: slot.id, name: slot.name, profile: slot.profile, classId: slot.classId, stats, ...slot.grown ? { grown: slot.grown } : {}, hp: stats.pv, maxHp: stats.pv, secondary: slot.classId ? points : 0, maxSecondary: points, guarding: false, mana: {}, kit: kitOf(slot, unlocked), ...slot.evening ? { evening: { shifts: { ...slot.evening.shifts }, from: slot.evening.from } } : {} };
}
/** The fighter's maná goes with the ánima: the one taken off keeps what it had, the one put on brings its own, up to what it holds. */
function swapMana(state: BattleState, actor: Combatant, to: ClassId | undefined) {
  const pools = actor.mana ??= {};
  if (actor.classId) pools[actor.classId] = actor.secondary;
  actor.maxSecondary = manaMax(state.improved, to, state.levels);
  actor.secondary = to ? pools[to] ?? actor.maxSecondary : 0;
  if (to) delete pools[to];
}
/** `actor` has acted: each of their other ánimas, resting, gets some maná back (`REST_CHARGE`), up to what it holds. */
function restReserves(state: BattleState, actor: Combatant) {
  if (!wearsAnimas(actor)) return;
  const pools = actor.mana ??= {};
  for (const id of kitIn(state, actor)) if (id !== actor.classId) { const most = manaMax(state.improved, id, state.levels); pools[id] = Math.min(most, (pools[id] ?? most) + REST_CHARGE); }
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
    ally.maxSecondary = manaMax(improved, ally.classId, state.levels);
    if (ally.classId) ally.secondary = ally.maxSecondary;
    // The levels come in here too: whoever wears an ánima starts as large as its level makes them (`LEVEL_GROWTH`).
    const whole = ally.hp >= ally.maxHp;
    ally.stats = statsWith(state, ally, ally.classId); ally.maxHp = ally.stats.pv; if (whole) ally.hp = ally.maxHp;
  }
}
/**
 * What levelling an ánima gives besides its skills (Aitor, 2026-11-21: «que si farmeo y desbloqueo
 * cosas, pues es más fácil»): whoever wears it is `pct` larger in PV, Fuerza, Magia, Defensa and
 * Espíritu for each level past the first, added to what the friends' ánimas give (`ANIMA_GROWTH`).
 * The foes' blows do not keep step with this share (`FOE_BLOW` only counts the ánimas): what is
 * earned fighting makes the game easier. Tunable (`--tune growth.level.pct=0:.03:.05`).
 */
export const LEVEL_GROWTH = { pct: .03 };
/** `ally`'s attributes wearing `id` in this fight: profile, ánima, and the share the friends' ánimas and its level add. */
function statsWith(state: BattleState, ally: Combatant, id?: ClassId): Stats {
  const level = id ? state.levels?.[id] ?? 1 : 1;
  return grown(withBonus(PROFILES[ally.profile], id ? CLASS_STATS[id] : undefined), (ally.grown ?? 0) + LEVEL_GROWTH.pct * (level - 1));
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
/** The party as it is lined up: there is no Velocidad, the players choose who acts when (docs/combat.md § Sin Velocidad). */
function lineUp(party: PartySlot[], unlocked: readonly ClassId[]) {
  return party.map(slot => fighter(slot, unlocked));
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
/**
 * The palace guards' numbers (`palaceGuards`), tunable as book `guards`: with no ánimas each one's
 * `hp` and `power`, less `hpPerAnima` and `powerPerAnima` for each friend's ánima, and one guardian
 * fewer every `animasPerGuard` ánimas. Three until the third ánima (Aitor, 2026-11-23: with Nuria's and
 * a mission's, «un reto pero no imposible»; with two they were won without thinking, in three rounds). Power 33
 * since Cegado makes physical blows miss (2026-11-23): with only Nuria's ánima, Explosión's flash had made them winnable.
 */
export const GUARDS = { hp: 250, hpPerAnima: 30, power: 33, powerPerAnima: 3, animasPerGuard: 3 };
export function palaceGuards(animas: number) {
  return { count: Math.max(1, 3 - Math.floor(animas / GUARDS.animasPerGuard)), hp: Math.max(40, GUARDS.hp - GUARDS.hpPerAnima * animas), power: Math.max(8, GUARDS.power - GUARDS.powerPerAnima * animas) };
}
export type GuardStrength = ReturnType<typeof palaceGuards>;
/**
 * The open missions and their fights: after Nuria and Uri's they can be done in any order, so each is
 * met with none of the others' ánimas or with all three (docs/combat.md § Los enemigos crecen con el equipo).
 */
/** Nuria and Uri's tower: the introduction, met as tuned when it is done first (`gatheredFor`). */
export const NURIA_ENCOUNTERS = [...BROOD_ENCOUNTERS, 'cebolla', 'cebollon', 'plato', 'escolta', 'uri-vertigo'] as const;
export const OPEN_MISSIONS = {
  universidad: [...CAMPING_ENCOUNTERS, 'sobremesa'], marta: CUERDAS_ENCOUNTERS, emilie: MODELO_ENCOUNTERS, luca: LUCA_ENCOUNTERS,
} as const satisfies Partial<Record<AnimaId, readonly Encounter[]>>;
/**
 * How the foes of an open mission keep up with the party: for each other open mission's ánima the
 * party already has, every foe of the fight has `stat` more Fuerza, Magia, Defensa and Espíritu
 * (rounded once, on the sum) and `pv` more of its PV (.1: a tenth each). The party grows with every
 * ánima (`ANIMAS`' bonus), so without this a mission done last was far easier than the same one done
 * first. Nuria's ánima is not counted (her tower is meant to come first, and the open missions are tuned with it), nor
 * the mission's own; her tower's foes grow with every open mission's ánima a party brings to it. The castle never grows: its numbers are its own, and they
 * are what asks for ánimas (docs/fight-sim.md § Power and the castle). A point and a quarter each
 * (+1, +3 and +4 with one, two and all three of the others behind) is what keeps the order from
 * counting now that every ánima gives the party a point of all four (`ANIMA_GROWTH`): in whole
 * games a point and a half made a wall of La Voz done last, and a point left the last mission the
 * easy one. More PV instead only made the fights longer (2026-11-21, docs/fight-sim.md §
 * Progression). Tunable (`just fight-sim`, book `foes`).
 */
export const FOE_GROWTH = { pv: 0, stat: 1.25 };
/**
 * The foes keep step with the party's growth (Aitor, 2026-11-21: «que los enemigos peguen algo más,
 * pero que los combates sean un poco más cortos»): every blow on someone of the party lands `share`
 * of what the friends' ánimas have made them larger harder (`ANIMA_GROWTH`: five ánimas are 60 %
 * more of everything, so a blow lands 24 % harder at .4). With no ánimas, nothing changes: the
 * first fights are as they were. What the party keeps of its growth is the PV its cures give back
 * (`HEAL`) and the harder blows of its own. Tunable (`--tune foes.blow.share=0:.25:.4`).
 */
export const FOE_BLOW = { share: .4, castle: 1.24 };
const foeBlow = (target: Combatant) => target.steady ? FOE_BLOW.castle : 1 + FOE_BLOW.share * (target.grown ?? 0);
/**
 * Each open fight's own growth (`pv`, `stat`, as `FOE_GROWTH`, which a fight not listed here takes): fights
 * do not lean on their foes' attributes alike (La Sobremesa's many small blows grow far more with a point of
 * Magia than El Campeón's one big told one), so one number for all left some harder done last and others
 * easier. Each is the one that keeps its fight the same question with one ánima behind it or with four,
 * found with the bench at both ends of the story (docs/fight-sim.md § The final pass). Book `foes.<fight>`.
 */
/** How a fight's foes grow for each ánima gathered: `pv`, a share of their PV; `stat`, Fuerza, Magia, Defensa and Espíritu; `hit`, Fuerza and Magia on top (harder, not longer). */
export interface Growth { pv: number; stat: number; hit?: number }
export const FIGHT_GROWTH: Partial<Record<Encounter, Growth>> = {
  // Nuria's tower, done after an open mission (`gatheredFor`): it grows by its blows, never by its length. +3 of each with
  // one ánima behind (2026-11-22, Emilie's): Vertitrón, La Escolta and the third ring are then what they are done first
  // (careless play loses, the answer wins); at the default +1, Freática made them a third of the fight.
  'crias-1': { pv: 0, stat: 2.5 },
  'crias-2': { pv: 0, stat: 2.5 },
  'crias-3': { pv: 0, stat: 2.5 },
  cebolla: { pv: 0, stat: 2.5 },
  cebollon: { pv: 0, stat: 2.5 },
  plato: { pv: 0, stat: 2.5 },
  escolta: { pv: 0, stat: 2.5 },
  'uri-vertigo': { pv: 0, stat: 2.5 },
  'camping-magos': { pv: .1, stat: 1, hit: 0 },
  'camping-dados': { pv: .1, stat: .75, hit: 0 },
  'camping-agentes': { pv: 0, stat: 2.25, hit: 0 },
  'camping-tienda': { pv: .05, stat: 2, hit: 0 },
  'camping-negra': { pv: .05, stat: 3.5, hit: 5.25 },
  campeon: { pv: .05, stat: 1, hit: 3.5 },
  sobremesa: { pv: 0, stat: 2.75, hit: 3.5 },
  'cuerdas-lealtad': { pv: .05, stat: 1.25, hit: 2.25 },
  'cuerdas-cristalino': { pv: .1, stat: 1.5, hit: 0 },
  'cuerdas-directo': { pv: .05, stat: 2.25, hit: .75 },
  voz: { pv: 0, stat: 1.75, hit: .75 },
  'modelo-celdas': { pv: 0, stat: 1.5, hit: 0 },
  'modelo-oscilacion': { pv: 0, stat: 1.5, hit: 0 },
  'modelo-atomo': { pv: .05, stat: 1, hit: 0 },
  'no-converge': { pv: .075, stat: .25, hit: 0 },
  'luca-recepcion': { pv: .15, stat: 3.25, hit: 0 },
  'luca-sillones': { pv: .05, stat: 2, hit: .5 },
  'luca-carta': { pv: 0, stat: 1, hit: 4.5 },
  fran: { pv: 0, stat: 2.25, hit: 3.5 },
};
/** How `encounter`'s foes grow with each ánima gathered: its own rule, or the one for all. */
export const growthOf = (encounter?: string) => (encounter ? FIGHT_GROWTH[encounter as Encounter] : undefined) ?? FOE_GROWTH;
/** How many ánimas count against the foes of `encounter`: the other open missions' the party has. */
export function gatheredFor(encounter: string, animas: readonly string[] = []) {
  const missions = Object.keys(OPEN_MISSIONS) as (keyof typeof OPEN_MISSIONS)[];
  // Nuria's tower is meant to come first, but nothing stops a party from doing an open mission before it (Aitor and
  // Gerard did Emilie's, 2026-11-22): then it grows with every open mission's ánima they bring, as the others do.
  if ((NURIA_ENCOUNTERS as readonly string[]).includes(encounter)) return missions.filter(id => animas.includes(id)).length;
  const own = missions.find(id => (OPEN_MISSIONS[id] as readonly string[]).includes(encounter));
  return own ? missions.filter(id => id !== own && animas.includes(id)).length : 0;
}
/** One foe grown by `gathered` ánimas (`FOE_GROWTH`). */
function grow<T extends Combatant>(c: T, gathered = 0, rule: Growth = FOE_GROWTH): T {
  const hit = rule.hit ?? 0;
  if (!gathered || !(rule.pv || rule.stat || hit)) return c;
  const pv = Math.round(c.maxHp * (1 + rule.pv * gathered)), more = Math.round(rule.stat * gathered), harder = more + Math.round(hit * gathered);
  c.stats = { ...c.stats, pv, fuerza: c.stats.fuerza + harder, magia: c.stats.magia + harder, defensa: c.stats.defensa + more, espiritu: c.stats.espiritu + more };
  c.hp = c.maxHp = pv;
  return c;
}
/**
 * The fight's foes as strong as `gathered` ánimas make them, as it starts; whoever joins later comes
 * grown the same (`state.grown`). The fight screen, both simulators and the fight tester go through here.
 */
export function growFoes(state: BattleState, gathered: number): BattleState {
  if (gathered > 0) { state.grown = gathered; state.foes.forEach(c => grow(c, gathered, growthOf(state.encounter))); }
  return state;
}
/**
 * Any story encounter as a fight starts: what the fight screen opens (src/battle-ui.ts) and what the
 * whole-game simulator plays (src/game-sim.ts), one dispatch for both, so an encounter added here is
 * met the same on screen and headless. `friends`: the friends' ánimas the party has gathered, which an
 * open mission's foes grow with (`FOE_GROWTH`); `strong`: the castle's pupils come as Encarnados (`castleStrong`).
 */
export function createEncounter(slots: PartySlot[], encounter: Encounter, options: { foeCount?: number; possessed?: boolean; animas?: ClassId[]; guards?: GuardStrength; night?: NightFight; friends?: readonly string[]; strong?: boolean; random?: () => number } = {}): BattleState {
  const state = startEncounter(slots, encounter, options);
  return options.strong ? castleStrong(state) : state;
}
function startEncounter(slots: PartySlot[], encounter: Encounter, options: { foeCount?: number; possessed?: boolean; animas?: ClassId[]; guards?: GuardStrength; night?: NightFight; friends?: readonly string[]; random?: () => number }): BattleState {
  const { foeCount = 1, possessed = false, animas, guards = palaceGuards(0), night, random } = options;
  // At night on the Meridiana: the castle's pupils of the floor the party is on, a room's group, stronger out here (src/night.ts).
  if (encounter === 'night-guard' && night) return castleAtNight(createCastleBattle(castleKit, slots, night.room, animas, random ?? Math.random), night.might);
  return growFoes((FEAR_ENCOUNTERS as readonly string[]).includes(encounter) ? createFearBattle(slots, encounter as (typeof FEAR_ENCOUNTERS)[number], animas, random)
    : encounter === 'palace-minion' ? createMinionBattle(slots[0]?.classId, animas)
    : encounter === 'palace-guards' || encounter === 'night-guard' ? createGuardBattle(slots, guards, animas, encounter)
    : createBattle(slots, foeCount, possessed, undefined, animas), gatheredFor(encounter, options.friends));
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
  if ((LUCA_ENCOUNTERS as readonly string[]).includes(encounter)) return createLucaBattle(party, encounter as LucaEncounter, animas, random);
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
export function validTargets(state: BattleState, action: BattleAction, skill: SkillId = 'foc-binari', die?: number): Combatant[] {
  if (action === 'attack') return state.foes.filter(f => f.hp > 0);
  if (action !== 'skill') return [];
  // Tirar dado: whom the face of the die it spends reaches (the one `bestDie` picks if none was chosen).
  if (faceUse(skill)) { const at = die ?? bestDie(state), face = at >= 0 ? dieSkill(state, at) : undefined; return face ? validTargets(state, action, face) : []; }
  const ability = SKILLS.find(s => s.id === skill);
  // Agitar is not an action (`shake`): it has nobody to reach.
  if (!ability || 'free' in ability) return [];
  // Sincopante's: Crescendo raises the wearer's ecos, so with none up it has nothing to do; Acompañamiento goes with
  // anyone standing; Da capo reaches the party.
  if (ability.kind === 'eco') return 'raise' in ability && !ecosOf(state, state.allies[state.active]).length ? [] : state.allies.filter(a => a.hp > 0);
  // ∂Q/∂t Condensador: the one who uses it, unless they carry a charge already.
  if (ability.kind === 'charge') { const self = state.allies[state.active]; return self && self.hp > 0 && !self.capacitor ? [self] : []; }
  // Corchete: anyone standing who is not protected already.
  // Escolta lasts two rounds: anyone standing Bip is not with already, even someone Defending this one.
  if (ability.kind === 'guard' && 'escort' in ability) return state.allies.filter(a => a.hp > 0 && !a.escort);
  if (ability.kind === 'guard') return state.allies.filter(a => a.hp > 0 && !a.guarding);
  // La crecida: Bombeo needs some water to pump; Golpe de ariete reaches whoever has water; Bajo cero freezes whoever has
  // it, once one of them has it at the third mark.
  const watered = state.foes.filter(f => f.hp > 0 && waterOf(f) > 0);
  if ('pumps' in ability && !watered.length) return [];
  if ('hammer' in ability) return watered;
  if ('freezes' in ability) return watered.some(f => waterOf(f) >= CRECIDA.marks) ? watered : [];
  // A cure for everyone is worth it while someone standing is hurt, or carries a status it takes away.
  if (state.unbound && (ability.kind === 'heal' || ability.kind === 'boost')) return state.allies.filter(a => a.hp > 0);
  if (state.unbound && ability.kind === 'debuff') return state.foes.filter(f => f.hp > 0);
  // A cure only reaches someone hurt and still standing (or carrying a status it takes away, or under a bit
  // dome it can patch): it never gets anyone back up.
  if (ability.kind === 'heal') return state.allies.filter(a => a.hp > 0 && (a.hp < a.maxHp || ('cleanse' in ability && cleansable(a).length > 0) || patchable(a)));
  // A cortina can always be raised: again, it starts over, and so does the Defensa it comes with.
  if (ability.kind === 'boost' && 'screen' in ability) return state.allies.filter(a => a.hp > 0);
  // A boost already running has nothing to add until it wears off.
  if (ability.kind === 'boost') return boostRounds(state, ability.id) ? [] : state.allies.filter(a => a.hp > 0);
  // Nor a debuff on a foe that still carries its mark.
  if (ability.kind === 'debuff') return state.foes.filter(f => f.hp > 0 && !markRounds(state, f, ability.id));
  // Cacería hunts whoever bleeds: with no blood on the field it has nobody to reach.
  if ('hunt' in ability) return state.foes.filter(f => f.hp > 0 && stacks(f, 'sangrado') > 0);
  return state.foes.filter(f => f.hp > 0);
}
/** Whether a skill needs a target picked, or simply happens (Análisis Parálisis reaches the whole party, Factor común every foe). */
export const aimed = (skill: SkillId) => { const side = SKILLS.find(s => s.id === skill)?.side; return side !== 'party' && side !== 'all-foes'; };
/** What `skill` (or a plain attack) does to `target` before it is clamped to what is left. */
function strike(state: BattleState, actor: Combatant, target: Combatant, skill?: Skill, power: number = skill?.power ?? 18) {
  const stats = current(state, actor), guard = current(state, target);
  if (!skill) return physical(18, stats, guard);
  return skill.kind === 'magic' ? magical(power, stats, guard) : physical(power, stats, guard);
}
/**
 * Sangrado is an open wound (docs/animas/README.md § Sangrado). A blow that adds it (a cut: `bleed`)
 * piles its stacks on top and spends none. Any other physical blow on someone bleeding (Atacar or a
 * physical skill, every claw of it) lands this much harder for each stack, and spends them all.
 * Zarpa en la llaga (`deep`) opens it twice as far.
 */
export const BLEED_BONUS = .2;
/** How much harder a blow lands for `bled` stacks of Sangrado (×, 1 for none). */
export const woundScale = (bled: number, skill?: SkillId) => 1 + bled * BLEED_BONUS * (skill && SKILLS.find(s => s.id === skill && 'deep' in s) ? 2 : 1);
/** The stacks a blow spends on `target` and how much harder it lands for them: only a physical blow that adds none opens the wound. */
function wound(target: Combatant, physicalBlow: boolean, skill?: SkillId) {
  const cut = !!skill && SKILLS.some(s => s.id === skill && 'bleed' in s);
  const bled = physicalBlow && !cut ? stacks(target, 'sangrado') : 0;
  return { bled, scale: woundScale(bled, skill) };
}
/** A physical blow has spent the wound on `target`: its stacks go, unless Metralla holds it open. */
function closeWound(target: Combatant) {
  if (!target.timed?.metralla) delete target.statuses!.sangrado;
}
/** A cut: `count` Sangrado stacks more on `target`. A wound cut this round does not close at its end (`nextRound`). */
function cut(state: BattleState, target: Combatant, count: number) {
  target.cutRound = state.round;
  return addStatus(target, 'sangrado', count);
}
/**
 * The golpe crítico (docs/animas/README.md § Golpe crítico): a blow that lands `bonus` harder, added
 * to the wound's own bonus, never multiplied by it. Each strike is one by the Crítico of whoever lands
 * it (`chance` scales that roll: 0 leaves only the sure ones, which is how the tests keep their
 * numbers), or for sure when a rule says so. Mutable on purpose, as the other rule books are.
 */
export const CRIT_RULES = { bonus: .5, chance: 1 };
/**
 * Olor a sangre, Papagato's passive from `level`: while someone standing wears it, every blow on a
 * foe that bleeds has `crit` more Crítico, and the blow that spends a wound of `sure` stacks or
 * more is always a golpe crítico. It reaches the whole party.
 */
export const SCENT = { level: 5, crit: 20, sure: 5 };
/** Who gives the fight Olor a sangre now: someone standing who wears a Papagato grown enough. */
export const scentOf = (state: BattleState) => (state.levels?.papagato ?? 1) >= SCENT.level || state.unbound ? state.allies.find(a => a.hp > 0 && a.classId === 'papagato') : undefined;
/** The chance, in percent, that a blow of `actor`'s on `target` is a golpe crítico. Foes have none. */
export function critChance(state: BattleState, actor: Combatant, target: Combatant) {
  if (!state.allies.includes(actor)) return 0;
  return ownCrit(state, actor, scentOf(state) && stacks(target, 'sangrado') ? SCENT.crit : 0);
}
/** `actor`'s Crítico whoever the blow is for: their own, the Racha's, `extra`, and all of it twice while Ases en dúo lasts. */
function ownCrit(state: BattleState, actor: Combatant, extra = 0) {
  return (current(state, actor).critico + rachaOf(actor) * RACHA.crit + extra) * (boostRounds(state, 'ases-en-duo') ? 2 : 1);
}
/** The crítico's own dice: a stream apart from `roll`, so a fight's other rolls never move because a blow was or was not one. */
function luck(state: BattleState) {
  let a = state.luck ?? ((state.seed ?? Math.floor(Math.random() * 2 ** 32)) ^ 0x9E3779B9) >>> 0;
  a = (a + 0x6D2B79F5) >>> 0;
  state.luck = a;
  let t = a;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
/** Whether one strike of `actor`'s on `target` is a golpe crítico: for sure (`sure`), or by its chance. */
function critical(state: BattleState, actor: Combatant, target: Combatant, sure = false) {
  if (!state.allies.includes(actor)) return false;
  if (sure || state.sureCrits || (state.certain ?? 0) >= state.round) return true;
  const chance = critChance(state, actor, target) * CRIT_RULES.chance;
  return chance > 0 && luck(state) * 100 < chance;
}
/** Whether spending `bled` stacks is a sure crítico (Olor a sangre), and says so over whoever wears it. */
function sureCrit(state: BattleState, bled: number, effect: BattleEffect) {
  if (bled >= SCENT.sure) wakeLives(state, effect);
  const wearer = bled >= SCENT.sure ? scentOf(state) : undefined;
  if (wearer) note(effect, 'olor-a-sangre', wearer);
  return !!wearer;
}
/**
 * A wound of five stacks or more spent, by anyone, while someone standing wears Papagato: Siete vidas
 * wakes for the rest of the fight (`livesReady`), and the action that woke it says so (`awoken`).
 */
function wakeLives(state: BattleState, effect: BattleEffect) {
  if (!state.allies.some(a => a.hp > 0 && a.classId === 'papagato')) return;
  const was = livesReady(state);
  (state.lives ??= {}).woke = true;
  if (!was && livesReady(state) && !state.unbound) effect.awoken = 'siete-vidas';
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
  // Bajo cero: a foe in its ice takes a quarter of every blow (`CRECIDA.frozen`), a boss too.
  if (frozenOf(target)) out *= CRECIDA.frozen;
  if (target.transparent && blow === 'physical') out *= FEAR_RULES.transparent;
  foil(target, blow);
  out *= campingTaken(target, blow) * cuerdasTaken(target, blow) * castleTaken(state, target, blow) * modeloTaken(target, element) * lucaTaken(state, target);
  // What it is made of gives under a blow (rancid gum): a dual is a blow too, and never the worse for it.
  const hard = affinityOf(target, 'fisico');
  if (hard && (blow === 'physical' || (blow === 'dual' && hard === 'weak'))) out *= ELEMENT_RULES[hard];
  // Magic off glass does nothing at all (Lo Cristalino).
  if (out <= 0) return 0;
  if (blow !== 'dual') { const kind = blowAffinity(target, blow); if (kind) met.push({ target: target.id, blow, affinity: kind }); }
  // Envenenado: the blow lands harder. Cristalizado: the shards dig in, a level deeper with each blow (`POWDER_RULES`).
  const venom = target.timed?.envenenado, glass = target.timed?.cristalizado;
  let landing = Math.max(1, Math.round(out * (venom ? POWDER_RULES.poison : 1)));
  if (glass) {
    const shards = glass.level * POWDER_RULES.shard;
    landing += shards; glass.level = Math.min(POWDER_RULES.shards, glass.level + 1);
    // Fulgurita: the shards of every foe it joined grow with this blow too.
    if (target.timed?.fulgurita) for (const f of state.foes) if (f !== target && f.hp > 0 && f.timed?.fulgurita && f.timed.cristalizado) f.timed.cristalizado.level = Math.min(POWDER_RULES.shards, f.timed.cristalizado.level + 1);
    dug.push({ target: target.id, shards, ...venom ? { venom: true as const } : {} });
  } else if (venom) dug.push({ target: target.id, venom: true });
  return landing;
}
/**
 * Whether `target` is weak to this kind of blow or resists it, by its own rule (a dish, a mago's flame,
 * glass, El Campeón's plan, a fantasmita gone see-through, the castle's gum): what the blow says when it lands.
 */
function blowAffinity(target: Combatant, blow: 'physical' | 'magic'): Affinity | undefined {
  const scaled = (scale: number) => scale > 1 ? 'weak' as const : scale < 1 ? 'resist' as const : undefined;
  if (target.dish) return scaled(DISHES[target.dish][blow]);
  if (target.kind === 'mago') return blow === 'physical' ? 'weak' : 'resist';
  if (target.kind === 'campeon') return blow === 'magic' ? 'resist' : undefined;
  if (target.kind === 'cristalino' && !target.cracked) return blow === 'physical' ? 'weak' : undefined;
  if (target.transparent && blow === 'physical') return 'resist';
  if (isCastle(target.kind)) return castleBlow(target, blow);
  return blow === 'physical' ? affinityOf(target, 'fisico') : undefined;
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
    : isLucaFight(state) ? LUCA_WON[state.encounter as LucaEncounter]
    : (BROOD_ENCOUNTERS as readonly string[]).includes(state.encounter) ? 'Se deshacen en humo violeta. Desde arriba, la risa de Uri. Volverán.'
    : state.encounter === 'palace-minion' ? 'El esbirro se queda tieso, se agrieta como chicle viejo… y revienta.'
    : state.encounter === 'palace-guards' ? 'Los guardianes se deshacen en charcos rosas. La cortina tiembla.'
    : state.encounter === 'night-guard' ? state.foes.some(f => isCastle(f.kind)) ? 'El chicle pierde la forma y se queda pegado a las baldosas. Solo era chicle.' : 'El guardián se deshace en un charco rosa sobre las baldosas.'
    : state.possessed ? `El rosa se les va de los ojos. ${state.foes.length === 1 ? 'El perro sale corriendo' : 'Los perros salen corriendo'}, con el rabo entre las patas.`
    : `${state.foes.length === 1 ? 'El perro se tranquiliza' : 'Los perros se tranquilizan'}. ¡Camino despejado!`;
}
/** The ánima `actor` wears takes part in the fight: a win teaches it (src/levels.ts). */
function took(state: BattleState, actor: Combatant) {
  restReserves(state, actor);
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
const castleKit: CastleKit = { current: (state, c) => current(state, c), changeHealth: (target, delta) => changeHealth(target, delta), foe: (id, name, kind, hp) => foe(id, name, kind, hp), lineUp: (party, unlocked) => lineUp(party, unlocked), seedFrom: random => seedFrom(random), heldAct: (state, held, move) => heldAct(state, held, move) };
/**
 * Someone the Queen holds acting on her side (docs/castle-bosses.md § Aitor, held): their own turn,
 * driven by player 2, with their own kit against the rest of the party. The same `act` runs on a
 * view of the fight where they are the only ally and the party standing are their foes, with nobody's
 * boosts: what it does to people and to the fight's message is real; the turn order and the outcome
 * it would settle are the view's, and the caller (the Queen's turn) settles those.
 */
export function heldAct(state: BattleState, held: Combatant, move: HeldMove): BattleEffect | undefined {
  const local: Record<string | symbol, unknown> = { allies: [held], foes: state.allies.filter(a => a !== held && a.hp > 0), active: 0, phase: 'player', boosts: undefined };
  const view = new Proxy(state, {
    get: (real, key) => key in local ? local[key] : Reflect.get(real, key),
    set: (real, key, value) => { if (key in local) { local[key] = value; return true; } return Reflect.set(real, key, value); },
    // Settling the view (its foes all down, or its one ally through) must not end the real fight.
    deleteProperty: (real, key) => key === 'queued' || key === 'spent' ? true : Reflect.deleteProperty(real, key),
  });
  const foes = local.foes as Combatant[];
  return act(view, move.action, foes[0]?.id, move.skill as SkillId | undefined);
}
/** What someone the Queen holds can do on her side: Atacar, each skill of theirs aimed at a foe that they can pay for, Defender. */
export function heldMoves(state: BattleState, held: Combatant): HeldMove[] {
  const aimedAtFoes = skillsFor(state, held).filter(s => (s.side === 'foes' || s.side === 'all-foes') && held.secondary >= s.cost && !dieUse(s.id));
  return [{ action: 'attack' }, ...aimedAtFoes.map(s => ({ action: 'skill' as const, skill: s.id })), { action: 'defend' }];
}
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
/**
 * Cortocircuito: on someone wet, or with a move announced, the current shorts in them: Shock for sure, so
 * they lose their next turn and what they announced waits for the one after. Not again until they have
 * acted (`shorted`), so it delays a move once and never locks a foe down.
 */
function shortCircuit(state: BattleState, target: Combatant, effect: BattleEffect) {
  if (target.hp <= 0 || target.part) return false;
  const wet = !!target.timed?.mojado, move = target.intent ? FOE_ABILITIES[target.intent.ability].name : undefined;
  if (!wet && !move) return false;
  if (target.shorted) {
    effect.shorted = { target: target.id, why: 'again' };
    state.message += ` ${target.name} aún no se ha repuesto del último cortocircuito: esta vez aguanta.`;
    return true;
  }
  if (target.shock) return true;
  target.shock = true; target.shorted = true;
  effect.shocked = [...effect.shocked ?? [], target.id];
  effect.shorted = { target: target.id, why: wet ? 'mojado' : 'anuncio', ...move ? { move } : {} };
  state.message += move ? ` ¡Cortocircuito! ${target.name} pierde su siguiente turno: ${move} tendrá que esperar.` : ` ¡Cortocircuito en el agua! ${target.name} pierde su siguiente turno.`;
  return true;
}
/**
 * ∂Q/∂t Condensador: a foe's blow found someone carrying the charge, and it jumps to that foe
 * (`CONDENSADOR.jump` of electric magic, with the wearer's stats).
 */
function discharge(state: BattleState, effect: BattleEffect) {
  if (effect.kind !== 'enemy') return;
  const foe = state.foes.find(f => f.id === effect.actor && f.hp > 0 && !f.part);
  if (!foe) return;
  const struck = new Set([...effect.target && (effect.amount ?? 0) > 0 ? [effect.target] : [], ...(effect.hits ?? []).filter(h => h.amount > 0).map(h => h.target)]);
  const wearer = state.allies.find(a => a.capacitor && struck.has(a.id));
  if (!wearer) return;
  delete wearer.capacitor;
  const amount = hurt(state, foe, fearDamage(state, foe, magical(CONDENSADOR.jump, current(state, wearer), current(state, foe)) * affinityScale(foe, 'electrico'), 'magic', 'electrico'));
  effect.discharge = { from: wearer.id, target: foe.id, amount };
  state.message += ` ¡La carga de ${wearer.name} salta a ${foe.name}! −${amount} PV.`;
  if (!state.allies.every(a => a.hp <= 0) && beaten(state)) { state.phase = 'won'; state.message = winMessage(state); endFight(state); }
}
/**
 * `element` has landed on `target`, who carries powder (`POWDER_RULES`): it explodes, runs as poison
 * or sets as shards. Returns whether there was any to turn. Fire turns it even on someone the blow felled.
 */
function powder(state: BattleState, actor: Combatant, target: Combatant, element: Element, effect: BattleEffect) {
  if (!target.timed?.empolvado || (target.hp <= 0 && element !== 'fuego')) return false;
  if (element === 'fuego') {
    // Estallido: each powdered foe goes up once; its blast reaches the others and sets their powder off.
    const totals = new Map<string, number>(effect.reaction?.id === 'estallido' ? effect.reaction.hits!.map(h => [h.target, h.amount]) : []), queue = [target];
    while (queue.length) {
      const origin = queue.shift()!;
      if (!origin.timed?.empolvado) continue;
      delete origin.timed.empolvado;
      for (const foe of state.foes.filter(f => f.hp > 0)) {
        const power = POWDER_RULES.blast * (foe === origin ? 1 : POWDER_RULES.splash);
        const amount = hurt(state, foe, fearDamage(state, foe, magical(power, current(state, actor), current(state, foe)) * affinityScale(foe, 'fuego'), 'magic', 'fuego'));
        totals.set(foe.id, (totals.get(foe.id) ?? 0) + amount);
        if (foe !== origin && foe.timed?.empolvado) queue.push(foe);
      }
    }
    // Everyone left standing burns a level more (an onion's wet layers do not catch).
    const burns = state.foes.filter(f => f.hp > 0 && !f.layers).map(f => { const fire = inflict(f, 'quemado', fireTop(state)); bank(state, actor, f, effect); return { target: f.id, level: fire.level }; });
    const hits = [...totals].map(([id, amount]) => ({ target: id, amount }));
    effect.reaction = { id: 'estallido', hits, burns };
    state.message += ` ¡El polvo estalla! ${hits.map(h => `−${h.amount}`).join(', ')} PV. Todos arden un nivel más.`;
    powderTurned(state, 'estallido', effect);
    return true;
  }
  delete target.timed.empolvado;
  const turned = effect.reaction?.id === (element === 'agua' ? 'veneno' : 'cristal') ? effect.reaction.targets ?? [] : [];
  if (element === 'agua') {
    const venom = inflict(target, 'envenenado');
    effect.reaction = { id: 'veneno', level: Math.max(venom.level, turned.length ? effect.reaction!.level ?? 1 : 1), targets: [...turned, target.id] };
    state.message += ` ¡El agua corre el polvo! ${TIMED.envenenado.name} ${roman(venom.level)}.`;
  } else {
    // Shards already in stay as deep as they were; the clock starts over.
    target.timed = { ...target.timed, cristalizado: { level: target.timed.cristalizado?.level ?? 1, left: TIMED.cristalizado.seconds, next: TIMED.cristalizado.every } };
    effect.reaction = { id: 'cristal', targets: [...turned, target.id] };
    state.message += ` ¡El polvo cristaliza! ${TIMED.cristalizado.name}.`;
  }
  powderTurned(state, element === 'agua' ? 'veneno' : 'cristal', effect);
  return true;
}
/** Two boosts that are the same screen (Cortina, Telón) do not add up: raising one takes the other's Defensa with it. */
function screenBoost(state: BattleState, kept: SkillId) {
  for (const other of SKILLS) if ('screen' in other && other.id !== kept && state.boosts?.[other.id]) delete state.boosts[other.id];
}
/**
 * A foe's powder has turned into something. While Colorista is worn by someone standing the fight
 * remembers which (Fin de fiesta wakes at the third, `finaleReady`), and with Remolino a cortina
 * stands in front of its wearer: one, however many foes turned at once.
 */
function powderTurned(state: BattleState, id: PowderTurn, effect: BattleEffect) {
  if (state.allies.some(a => a.hp > 0 && a.classId === 'prismatico')) {
    const finale = state.finale ??= { seen: [] }, was = finaleReady(state);
    if (!finale.seen.includes(id)) finale.seen.push(id);
    if (!was && finaleReady(state) && !state.unbound) effect.awoken = 'fin-de-fiesta';
  }
  const wearer = remolinoOf(state);
  if (wearer) { raiseCortina(state, wearer, effect); note(effect, 'remolino', wearer); }
}
/**
 * An element has landed on `target` with Atacar: what it turns (`REACTION_RULES`, `POWDER_RULES`), if it finds anything to turn.
 * `reach`: a skill's bolt reaches everyone wet wherever it landed. `stays`: the current stays in `target` (Cortocircuito), so
 * nothing jumps from it.
 */
function react(state: BattleState, actor: Combatant, target: Combatant, element: Element, effect: BattleEffect, reach = false, stays = false) {
  const fire = target.timed?.quemado, bleeding = stacks(target, 'sangrado');
  const wet = state.foes.filter(f => f.hp > 0 && f.timed?.mojado);
  if (powder(state, actor, target, element, effect)) {
    // Powder first: it is what the element finds on top.
  } else if (target.hp > 0 && element === 'agua' && fire) {
    effect.reaction = { id: 'humo', level: smoke(target) };
    state.message += ` ¡El agua apaga el fuego! ¡${TIMED.cegado.name}!`;
  } else if (target.hp > 0 && element === 'fuego' && bleeding) {
    delete target.statuses!.sangrado;
    const amount = hurt(state, target, bleeding * REACTION_RULES.cauterize);
    effect.reaction = { id: 'cauterizado', stacks: bleeding, hits: [{ target: target.id, amount }] };
    state.message += ` ¡Cauteriza la herida! −${amount} PV.`;
  } else if (target.hp > 0 && element === 'fuego' && target.timed?.mojado) {
    vapour(state, target, effect);
  } else if (target.hp > 0 && element === 'electrico' && fire) {
    // Plasma: the bolt sets off all the fire had left to burn, harder, at once, and it goes out.
    const left = firePulses(fire), amount = hurt(state, target, Math.max(1, Math.round(left * pulseDamage('quemado', fire.level, target.maxHp) * REACTION_RULES.plasma)));
    delete target.timed!.quemado;
    effect.reaction = { id: 'plasma', level: fire.level, hits: [{ target: target.id, amount }] };
    state.message += ` ¡Plasma! El fuego estalla de golpe: −${amount} PV.`;
  } else if (!stays && target.hp > 0 && element === 'electrico' && target.timed?.cegado) {
    const hits = state.foes.filter(f => f.hp > 0 && f.timed?.cegado).map(f => {
      delete f.timed!.cegado;
      return { target: f.id, amount: hurt(state, f, fearDamage(state, f, magical(REACTION_RULES.storm, current(state, actor), current(state, f)) * affinityScale(f, 'electrico'), 'magic', 'electrico')) };
    });
    effect.reaction = { id: 'tormenta', hits };
    state.message += ` ¡La descarga salta por el humo! ${hits.map(h => `−${h.amount}`).join(', ')} PV.`;
  } else if (!stays && element === 'electrico' && wet.length && (reach || (target.hp > 0 && target.timed?.mojado))) {
    // Conducción: the water carries it to everyone wet (a skill's reaches them wherever it landed), and dries.
    // Water held under a foe (La crecida) does not go: it keeps the current; one already charged only starts it over.
    const seconds = currentFor(effect), running = wet.filter(f => f.timed?.agua && f.timed.corriente);
    for (const f of running) charge(f, seconds);
    const through = wet.filter(f => !running.includes(f));
    const struck = target.hp > 0 && !!target.timed?.mojado && through.includes(target);
    if (through.length) {
      const hits = through.map(f => {
        if (!f.timed!.agua) delete f.timed!.mojado;
        return { target: f.id, amount: hurt(state, f, fearDamage(state, f, magical(REACTION_RULES.conduct, current(state, actor), current(state, f)) * affinityScale(f, 'electrico'), 'magic', 'electrico')) };
      });
      effect.reaction = { id: 'conduccion', hits };
      state.message += ` ¡La corriente corre por el agua! ${hits.map(h => `−${h.amount}`).join(', ')} PV.`;
    }
    const charged = through.filter(f => f.hp > 0 && waterOf(f) > 0);
    for (const f of charged) charge(f, seconds);
    if (charged.length || running.length) {
      effect.current = { targets: [...charged, ...running].map(f => f.id), seconds, ...!charged.length ? { renewed: true as const } : {} };
      state.message += charged.length ? ` ¡${TIMED.corriente.name}! Se queda en el agua ${seconds} s.` : ` La ${TIMED.corriente.name.toLowerCase()} del agua vuelve a empezar.`;
    }
    if (struck) shock(state, target, effect);
  }
  if (effect.reaction) ground(state, actor, effect);
}
/** Vapor from a blow of fire on someone wet (`react`, or a skill that burns, which finds the water before it can light). */
function vapour(state: BattleState, target: Combatant, effect: BattleEffect) {
  const held = waterOf(target), level = steam(target);
  effect.reaction = { id: 'vapor', level };
  if (held) effect.water = [...effect.water ?? [], { target: target.id, from: held, to: held - 1 }];
  state.message += ` ¡El agua se va en vapor! ¡${TIMED.cegado.name}!`;
}
/** How many pulses a fire still has to give before its clock runs out (`runClock`): the next one, and one every `every` after it. */
export const firePulses = (fire: Timed) => fire.left > 1e-6 ? Math.floor(Math.max(0, fire.left - fire.next) / TIMED.quemado.every + 1e-6) + 1 : 0;
/** Humo: the fire on `c` goes out and leaves Cegado (whatever the fire's level: it has none). Returns the level it shows, 1. */
function smoke(c: Combatant) {
  const { quemado: _fire, ...rest } = c.timed!;
  c.timed = rest;
  blind(c);
  return 1;
}
/**
 * Vapor: the water on `c` goes up and leaves Cegado (`blind`). Returns the level it shows, 1. Water held under it
 * (La crecida, `CRECIDA`) loses only its top mark.
 */
function steam(c: Combatant) {
  if (waterOf(c)) lowerWater(c, 1);
  else { const { mojado: _out, ...rest } = c.timed!; c.timed = rest; }
  blind(c);
  return 1;
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
/** Escudo de bits: a dome of `hp` over everyone standing in the party, for BITS.rounds; Redundancia lets cures fill it past them. */
function raiseBits(state: BattleState, hp: number, mirror = false) {
  const spare = state.allies.some(a => a.hp > 0 && passive(state, a, 'redundancia'));
  const wall: BitShield = { hp, max: hp, cap: hp * (spare ? BITS.redundancia : 1), until: state.round + BITS.rounds - 1, share: BITS.share, ...mirror ? { mirror } : {} };
  for (const ally of state.allies) if (ally.hp > 0) ally.bits = wall; else delete ally.bits;
}
/** What a foe carries now, as Virus atómico remembers it. */
const seen = (c: Combatant) => ({ timed: { ...c.timed }, statuses: { ...c.statuses } });
/**
 * Virus atómico (docs/animas/tecnopata/README.md § Grade III): every status that has landed on an
 * infected foe since it was last looked at (a new one, a level up, one lit again) lands on every
 * other foe standing too, at its level and with its time; stacks add the same stacks. The virus
 * itself never spreads. A fire on a wet foe is Vapor, water on a burning one Humo, as anywhere.
 */
function spread(state: BattleState, effect: BattleEffect) {
  for (const host of state.foes) {
    if (!host.timed?.virus || !host.virusSeen || host.hp <= 0) { delete host.virusSeen; continue; }
    const before = host.virusSeen, others = state.foes.filter(f => f !== host && f.hp > 0 && !f.part);
    // La crecida's states belong to each foe's own water (its Mojado too, while the water stands): they never spread.
    const held = (id: TimedId) => (WATER_IDS as readonly TimedId[]).includes(id) || (id === 'mojado' && !!host.timed?.agua);
    const fresh = TIMED_IDS.filter(id => id !== 'virus' && !held(id) && !TIMED[id].heal && host.timed![id] && (host.timed![id] !== before.timed[id] || host.timed![id]!.level > (before.timed[id]?.level ?? 0)));
    const piled = STATUS_IDS.filter(id => stacks(host, id) > (before.statuses[id] ?? 0));
    host.virusSeen = seen(host);
    if (!others.length || (!fresh.length && !piled.length)) continue;
    for (const o of others) {
      for (const id of fresh) {
        const on = host.timed![id]!, mine = o.timed?.[id];
        if (id === 'quemado' && o.timed?.mojado) { steam(o); continue; }
        if (id === 'mojado' && o.timed?.quemado) { smoke(o); continue; }
        o.timed = { ...o.timed, [id]: { level: Math.max(on.level, mine?.level ?? 0), left: Math.max(on.left, mine?.left ?? 0), next: mine?.next ?? TIMED[id].every } };
      }
      for (const id of piled) addStatus(o, id, stacks(host, id) - (before.statuses[id] ?? 0));
      if (o.virusSeen) o.virusSeen = seen(o);
    }
    const names = [...fresh.map(id => TIMED[id].name), ...piled.map(id => STATUSES[id].name)];
    (effect.spread ??= []).push({ from: host.id, to: others.map(o => o.id), statuses: names });
    state.message += ` El virus contagia: ${names.join(', ')}.`;
  }
}
/** How high a status gathered by Atractor extraño adds up to: fire's top (IV with Combustión), the shards' deepest, or its own last level. */
const gatherTop = (state: BattleState, id: TimedId) => id === 'quemado' ? fireTop(state) : id === 'cristalizado' ? POWDER_RULES.shards : TIMED[id].levels.length || 1;
/** What can leave `c` for Atractor extraño, in TIMED's order: its `moves` statuses, but not the Mojado of the water standing under it (La crecida's). */
export const movable = (c: Combatant) => TIMED_IDS.filter(id => TIMED[id].moves && !!c.timed?.[id] && !(id === 'mojado' && c.timed.agua));
/**
 * Atractor extraño (docs/animas/matemagico/README.md § Atractor extraño): every status on the clock that can move (`moves`)
 * leaves every other foe standing at once, and then reaches `target` one after another, in the plate's order. One it already
 * has adds up: the levels to its top (`gatherTop`), the longer clock; two bombs add their charge up to `BOMBA.top` and keep the
 * clock of the one closer to going off. What meets there reacts as an element landing would, with no blow of its own: water on
 * a fire is Humo, fire on water Vapor, fire and powder Estallido, water and powder Envenenado. Since everything has left before
 * anything arrives, the order of the plate never changes what the others are left with: the fire an Estallido lights on them
 * stays on them, the same on each. A fire does not catch on an onion's wet layers: it stays where it was. If the blow felled the
 * target, nothing comes; if a reaction fells it, what had not reached it yet is lost with it. What came was not put on anyone,
 * so Virus never spreads it.
 */
function gather(state: BattleState, actor: Combatant, target: Combatant, effect: BattleEffect) {
  if (target.hp <= 0 || target.part) return;
  // Everything leaves first, off everyone.
  const leaving = state.foes.filter(f => f !== target && f.hp > 0 && !f.part).map(from => ({
    from,
    on: movable(from).filter(id => !(id === 'quemado' && target.layers)).map(id => { const on = from.timed![id]!; delete from.timed![id]; return [id, on] as const; }),
  })).filter(l => l.on.length);
  if (!leaving.length) return;
  const came: Gathered[] = leaving.map(({ from, on }) => {
    const entry: Gathered = { from: from.id, ids: on.map(([id]) => id), reactions: [] };
    for (const [id, status] of on) {
      // An Estallido on the way can fell it: the rest goes down with it.
      if (target.hp <= 0) break;
      const turned = arrive(state, actor, target, id, status, effect);
      if (turned) entry.reactions.push(turned);
    }
    return entry;
  });
  effect.gathered = came;
  const names = [...new Set(came.flatMap(c => c.ids))].filter(id => target.timed?.[id]).map(id => `${TIMED[id].name}${TIMED[id].levels.length && target.timed![id]!.level > 1 ? ` ${roman(target.timed![id]!.level)}` : ''}`);
  state.message += names.length ? ` Los estados de los demás caen en ${target.name}: ${names.join(', ')}.` : ` Lo de los demás cae en ${target.name}.`;
  if (came.some(c => c.reactions.length)) ground(state, actor, effect);
  // Nothing of it was put on anyone: Virus does not spread what came, nor what it set off.
  for (const f of state.foes) if (f.virusSeen) f.virusSeen = seen(f);
}
/**
 * One status `on`, of kind `id`, reaches `target` (Atractor extraño): it reacts with what it finds, as an element landing does
 * (powder first), or adds up to the one already there. Returns the reaction, if any. Whatever a reaction does besides (the
 * water's mark Vapor took, a passive, a definitiva woken) goes on `effect`.
 */
function arrive(state: BattleState, actor: Combatant, target: Combatant, id: TimedId, on: Timed, effect: BattleEffect): Gathered['reactions'][number] | undefined {
  const t = target.timed ??= {};
  const turn = (element: Element) => {
    const scratch: BattleEffect = { kind: 'skill', actor: actor.id };
    powder(state, actor, target, element, scratch);
    carry(scratch, effect);
    return scratch.reaction && { id: scratch.reaction.id, ...scratch.reaction.hits ? { hits: scratch.reaction.hits } : {} };
  };
  // Powder first: fire on it explodes, water on it is poison (and powder arriving finds a fire or water the same way).
  if ((id === 'quemado' || id === 'mojado') && t.empolvado) return turn(id === 'quemado' ? 'fuego' : 'agua');
  if (id === 'empolvado' && (t.quemado || t.mojado)) { t.empolvado = on; return turn(t.quemado ? 'fuego' : 'agua'); }
  if (id === 'mojado' && t.quemado) { smoke(target); state.message += ` ¡El agua apaga el fuego! ¡${TIMED.cegado.name}!`; return { id: 'humo' }; }
  if (id === 'quemado' && t.mojado) { const scratch: BattleEffect = { kind: 'skill', actor: actor.id }; vapour(state, target, scratch); carry(scratch, effect); return { id: 'vapor' }; }
  // The water standing under it (La crecida) keeps its own Mojado, as long as the water: what comes runs into it.
  if (id === 'mojado' && t.agua && t.mojado) return undefined;
  const mine = t[id];
  if (!mine) { t[id] = { ...on }; return undefined; }
  if (id === 'bomba') {
    const power = Math.min(BOMBA.top, bombPower(mine.age ?? 0) + bombPower(on.age ?? 0));
    t.bomba = { ...mine, left: Math.min(mine.left, on.left), age: Math.max(0, (power - BOMBA.base) / BOMBA.perSecond) };
    return undefined;
  }
  const level = Math.max(mine.level, on.level, Math.min(gatherTop(state, id), mine.level + on.level));
  const until = mine.until !== undefined && on.until !== undefined ? Math.max(mine.until, on.until) : undefined;
  t[id] = { level, left: Math.max(mine.left, on.left), next: mine.next, ...until !== undefined ? { until } : {} };
  return undefined;
}
/** What a reaction worked out on a scratch effect did besides itself, onto the action's own `effect`. */
function carry(scratch: BattleEffect, effect: BattleEffect) {
  if (scratch.water) effect.water = [...effect.water ?? [], ...scratch.water];
  for (const p of scratch.passives ?? []) if (!effect.passives?.some(q => q.id === p.id)) effect.passives = [...effect.passives ?? [], p];
  if (scratch.awoken) effect.awoken = scratch.awoken;
}
/** Who brings Combustión to the fight: someone standing who wears Matemágico with the passive bought. */
const combustor = (state: BattleState) => state.improved?.passives?.includes('combustion') ? state.allies.find(a => a.hp > 0 && a.classId === 'matemagico') : undefined;
/** How high fire can climb in this fight: Combustión (IV) while its passive is in it, Quemado III otherwise. */
export const fireTop = (state: BattleState) => combustor(state) ? COMBUSTION.level : FIRE_TOP;
/**
 * A physical blow has landed on `target`, by whoever (an ally, a confused foe): if its fire is at
 * Combustión it bursts (COMBUSTION). Never from a pulse, a reaction or magic, so a burst never sets
 * off another. Say it in `effect.combustion`; Toma de tierra counts it as a reaction of its wearer's.
 */
function combust(state: BattleState, actor: Combatant, target: Combatant, effect: BattleEffect) {
  const fire = target.timed?.quemado, owner = combustor(state);
  if (!owner || !fire || fire.level < COMBUSTION.level || state.foes.indexOf(target) < 0) return;
  if (target.hp > 0) { fire.level = COMBUSTION.after; fire.left = Math.max(fire.left, TIMED.quemado.seconds); } else delete target.timed!.quemado;
  const blast = (foe: Combatant) => hurt(state, foe, fearDamage(state, foe, magical(COMBUSTION.blast, current(state, owner), current(state, foe)) * affinityScale(foe, 'fuego'), 'magic', 'fuego'));
  const hits: { target: string; amount: number }[] = [], burns: { target: string; level: number }[] = [], steamed: string[] = [];
  for (const foe of state.foes.filter(f => f.hp > 0 || f === target)) {
    if (foe.hp > 0) hits.push({ target: foe.id, amount: blast(foe) });
    if (foe.shell) foe.shell = false;
    if (foe === target || foe.hp <= 0 || foe.layers) continue;
    if (foe.timed?.mojado) { steam(foe); steamed.push(foe.id); continue; }
    const raised = inflict(foe, 'quemado', fireTop(state));
    if (actor === owner) bank(state, owner, foe, effect);
    burns.push({ target: foe.id, level: raised.level });
  }
  effect.combustion = { target: target.id, hits, burns, ...steamed.length ? { steamed } : {} };
  note(effect, 'combustion', owner);
  state.message += ` ¡Combustión! ${target.name} estalla: ${hits.map(h => `−${h.amount}`).join(', ')} PV. El fuego salta a los demás.`;
  if (actor === owner) ground(state, owner, effect);
}
/** Bomba remota on `foe`: a new bomb, or the one on it started over, keeping what it has grown. `age`: born already grown (Enjambre). */
function plantBomb(foe: Combatant, age = 0) {
  const on = foe.timed?.bomba;
  foe.timed = { ...foe.timed, bomba: { level: 1, left: Math.max(on?.left ?? 0, BOMBA.seconds), next: BOMBA.seconds, age: Math.max(on?.age ?? 0, age) } };
}
/** Who sets the bombs off: whoever has Tecnópata in their kit (Aitor), worn or not. */
const bomber = (state: BattleState) => state.allies.find(a => a.classId === 'tecnopata') ?? state.allies.find(a => a.kit?.includes('tecnopata'));
/**
 * A Bomba remota goes off on `foe` (its clock ran out, or Explosión): magic of no element of `bombPower` by its age, with the
 * bomber's Magia. One at its top while its bomber wears Tecnópata, standing, wakes Enjambre (`swarmReady`). Returns what it took.
 */
function blowBomb(state: BattleState, foe: Combatant, effect?: BattleEffect): number {
  const on = foe.timed?.bomba;
  if (!on) return 0;
  delete foe.timed!.bomba;
  const owner = bomber(state), power = bombPower(on.age ?? 0);
  const stats = owner ? current(state, owner) : current(state, foe);
  const amount = foe.hp > 0 ? hurt(state, foe, fearDamage(state, foe, magical(power, stats, current(state, foe)) * affinityScale(foe, undefined), 'magic')) : 0;
  if (power >= BOMBA.top && owner && owner.hp > 0 && owner.classId === 'tecnopata' && skillKnown('enjambre', state.levels, state.improved)) {
    const was = swarmReady(state);
    (state.swarm ??= {}).woke = true;
    if (!was && swarmReady(state) && !state.unbound && effect) effect.awoken = 'enjambre';
  }
  return amount;
}
/** Reinicio and Rayo de energía: every clock on `foe` that is not a cure starts over from its whole time, at its level. */
function restartClocks(foe: Combatant) {
  // Bajo cero's ice is not a clock that starts over: it melts.
  const statuses = TIMED_IDS.filter(id => id !== 'congelado' && !TIMED[id].heal && foe.timed?.[id] && foe.timed[id]!.until === undefined);
  for (const id of statuses) { const on = foe.timed![id]!; on.left = Math.max(on.left, TIMED[id].seconds); }
  return statuses;
}
/**
 * La crecida (docs/animas/freatica/README.md § Signature; docs/animas/README.md § Agua contenida, § Corriente, § Hundido,
 * § Congelado), every number in one book (`crecida.rules`). Each foe carries its own water, 0 to `marks` marks
 * (`TIMED.agua`); its top mark drains in `mark` seconds, and any water blow on that foe starts it over. A foe with water is
 * Mojado for as long as it stands, so it is wet for everything that asks. A bolt runs through the water as always
 * (Conducción) and stays in it as Corriente for `current` seconds, pulsing every `pulse`; while it runs a bolt only starts
 * it over. Fire takes the top mark as Vapor and blinds. At the third mark the foe is Hundido. Bajo cero
 * freezes the water: `ice` seconds a mark; a frozen foe acts not and takes `frozen` of every blow; its ice holds `blows`
 * blows from outside (one of power `hard` or more counts two, each strike of a flurry one), and cracked through it breaks
 * for magic water damage from `breakLow` to `breakTop` by the ice left. A flame melts a mark of it; electricity does nothing.
 */
export const CRECIDA = { marks: 3, mark: 20, current: 10, pulse: 2, ice: 20, frozen: .25, blows: 8, hard: 35, breakTop: 90, breakLow: 40 };
/** The marks of water under `c` (0: dry). */
export const waterOf = (c: Pick<Combatant, 'timed'>) => c.timed?.agua?.level ?? 0;
/** Whether `c` stands in Bajo cero's ice. */
export const frozenOf = (c: Pick<Combatant, 'timed'>) => !!c.timed?.congelado;
/** Who brings Nivel de base: someone standing who wears a Freática grown enough. */
export const baseOf = (state: BattleState) => (state.levels?.freatica ?? 1) >= PASSIVES['nivel-de-base'].level! || state.unbound ? state.allies.find(a => a.hp > 0 && a.classId === 'freatica') : undefined;
/** The break's blow at average stats with `left` marks of ice still there (Aitor: huge at the start, less as it melts, still a lot). */
export const iceBreakPower = (left: number) => CRECIDA.breakLow + (CRECIDA.breakTop - CRECIDA.breakLow) * Math.min(1, Math.max(0, left) / CRECIDA.marks);
/** A foe's water gone: no Mojado, no current, not sunk. */
function dry(c: Combatant) {
  if (!c.timed) return;
  delete c.timed.agua; delete c.timed.mojado; delete c.timed.corriente; delete c.timed.hundido;
}
/** What standing water keeps on its foe: Mojado with no clock of its own, the current at the water's mark, Hundido at the third. */
function settleWater(c: Combatant) {
  const water = c.timed?.agua;
  if (!water || water.level <= 0) { dry(c); return; }
  const timed = c.timed!;
  timed.mojado = { level: 1, left: TIMED.mojado.seconds, next: TIMED.mojado.every };
  if (timed.corriente) timed.corriente.level = water.level;
  // A part of a boss can have water, and is never sunk.
  // A escala: a foe shrunk stands lower in the same water, and is under it a mark sooner.
  if (water.level >= CRECIDA.marks - (timed.encogido ? 1 : 0) && !c.part) timed.hundido = { level: 1, left: TIMED.hundido.seconds, next: timed.hundido?.next ?? TIMED.hundido.every };
  else delete timed.hundido;
}
/** Marea's joined cells are rising together (`raiseWater`). */
let tiding = false;
/** A mark more under `foe` (`n`, up to the third), raised by `actor`, who holds it from now on. A frozen foe has no water to raise. */
function raiseWater(state: BattleState, actor: Combatant, foe: Combatant, effect: BattleEffect, n = 1) {
  if (foe.hp <= 0 || frozenOf(foe)) return;
  const from = waterOf(foe), to = Math.min(CRECIDA.marks, from + n);
  foe.timed = { ...foe.timed, agua: { level: to, left: CRECIDA.mark, next: CRECIDA.mark } };
  settleWater(foe);
  state.water = { by: actor.id };
  (effect.water ??= []).push({ target: foe.id, from, to });
  if (to >= CRECIDA.marks) wakeCold(state, effect);
  // Marea: the cells are joined. What rises in one rises in every other (once: the others do not answer back).
  if (foe.timed?.marea && !tiding && to > from) {
    tiding = true;
    for (const other of state.foes) if (other !== foe && other.hp > 0 && other.timed?.marea) raiseWater(state, actor, other, effect, to - from);
    tiding = false;
  }
  return to;
}
/** `n` marks off `foe`'s water (spent, not drained): the next one starts its own clock. */
function lowerWater(foe: Combatant, n: number, effect?: BattleEffect) {
  const from = waterOf(foe);
  if (!from) return 0;
  const to = Math.max(0, from - n);
  if (to) { foe.timed!.agua = { level: to, left: CRECIDA.mark, next: CRECIDA.mark }; settleWater(foe); } else dry(foe);
  if (effect) (effect.water ??= []).push({ target: foe.id, from, to });
  return to;
}
/** A water blow on `foe`, from anyone: its top mark's clock starts over. */
function refill(foe: Combatant) {
  if (foe.timed?.agua) foe.timed.agua.left = CRECIDA.mark;
}
/** A foe's water at the third mark while someone standing wears Freática: Bajo cero wakes for the rest of the fight. */
function wakeCold(state: BattleState, effect: BattleEffect) {
  if (!state.allies.some(a => a.hp > 0 && a.classId === 'freatica')) return;
  const was = coldReady(state);
  (state.cold ??= {}).woke = true;
  if (!was && coldReady(state) && !state.unbound) effect.awoken = 'bajo-cero';
}
/** How long the current a bolt leaves lasts: Sondeo eléctrico's, twice. */
const currentFor = (effect: BattleEffect) => { const spec = SKILLS.find(s => s.id === effect.skill); return CRECIDA.current * (spec && 'current' in spec ? spec.current : 1); };
/** The water on `foe` keeps a bolt for `seconds` (one already running there only starts over, never shorter). */
function charge(foe: Combatant, seconds: number) {
  const water = foe.timed?.agua;
  if (!water) return;
  const on = foe.timed!.corriente;
  foe.timed!.corriente = { level: water.level, left: Math.max(seconds, on?.left ?? 0), next: on?.next ?? CRECIDA.pulse };
}
/** The ice goes, melted or broken: the foe is free, and its cell empty. */
function thaw(c: Combatant) {
  if (c.timed) delete c.timed.congelado;
  delete c.cracks;
}
/**
 * The water and the ice on the fight's clock (`runClock`, before the statuses pulse): each top mark drains and the one below
 * starts its own (Nivel de base holds the first while its wearer stands in Freática), and what stands keeps its foe wet,
 * charged at its mark and sunk at the third. The ice melts all the while, a mark every `CRECIDA.ice` seconds.
 */
function runWater(state: BattleState, seconds: number) {
  const base = baseOf(state);
  for (const c of state.foes) {
    const water = c.timed?.agua;
    if (water && c.hp <= 0) dry(c);
    else if (water) {
      water.left -= seconds;
      while (water.left <= 1e-6 && water.level > 0) {
        if (water.level === 1 && base) { water.left = CRECIDA.mark; break; }
        water.level--; water.left += CRECIDA.mark;
      }
      settleWater(c);
    }
    const ice = c.timed?.congelado;
    if (!ice) continue;
    ice.left -= seconds;
    if (c.hp <= 0 || ice.left <= 1e-6) thaw(c); else ice.level = Math.ceil(ice.left / CRECIDA.ice);
  }
}
/**
 * Whoever held the water fell (`state.water`): every cell breaks. The water runs over the whole floor and is gone, and
 * everyone standing on both sides is Mojado for its ordinary 20 s. Said on `effect` when there is one.
 */
function holdWater(state: BattleState, effect?: BattleEffect) {
  const by = state.water?.by;
  if (!by || state.allies.some(a => a.id === by && a.hp > 0)) return;
  delete state.water;
  const broke = state.foes.filter(f => waterOf(f) > 0).map(f => { dry(f); return f.id; });
  if (!broke.length) return;
  const wetted = [...state.foes, ...state.allies].filter(c => c.hp > 0 && !c.part && !frozenOf(c)).map(c => {
    c.timed = { ...c.timed, mojado: { level: 1, left: TIMED.mojado.seconds, next: TIMED.mojado.every } };
    return c.id;
  });
  if (!effect) return;
  effect.cells = { broke, wetted };
  if (state.phase !== 'lost') state.message += ' Las celdas se rompen: el agua corre por el suelo y moja a todos.';
}
/** A blow from outside on a frozen foe: how many strikes reached it, each worth `weight` of the ice's blows, and of what kind. */
interface IceBlow { target: string; strikes: number; weight: number; magic: boolean; element?: Element }
/**
 * The blows of an action on each foe, as the ice counts them: a flurry's strikes (`flurry`, a rain, a volley, the claws, the
 * hammer) one each; any other blow one, or two when it is hard (power `CRECIDA.hard` or more). Only blows that reached.
 */
function iceBlows(effect: BattleEffect, kind: string | undefined, power: number, element?: Element, flurry = false): IceBlow[] {
  const counts = new Map<string, number>(), add = (id: string | undefined, n: number) => { if (id && n > 0) counts.set(id, (counts.get(id) ?? 0) + n); };
  const seq = effect.rain ?? effect.volley ?? effect.hunt ?? effect.hammer;
  if (seq?.length) for (const s of seq) add(s.amount > 0 ? s.target : undefined, 1);
  else if (effect.hits?.length) for (const h of effect.hits) add(h.amount > 0 ? h.target : undefined, 1);
  else if (effect.amount) add(effect.target, flurry && effect.strikes ? effect.strikes.filter(n => n > 0).length : 1);
  const weight = seq?.length || flurry ? 1 : power >= CRECIDA.hard ? 2 : 1;
  return [...counts].map(([target, strikes]) => ({ target, strikes, weight, magic: kind === 'magic', element }));
}
/**
 * Bajo cero's ice takes the blows of an action (`iceBlows`). A flame melts a mark of it at once, with its steam (Cegado at
 * the ice's level), and cracks nothing; electricity does nothing to it; any other blow cracks it. Cracked through, it
 * breaks: the foe takes magic water damage by the ice still there, with the Magia of whoever froze it (a blow: a weakness
 * to water counts, never a golpe crítico), and is free.
 */
function chill(state: BattleState, actor: Combatant, effect: BattleEffect, blows: IceBlow[]) {
  for (const b of blows) {
    const foe = state.foes.find(f => f.id === b.target), ice = foe?.timed?.congelado;
    if (!foe || !ice || foe.hp <= 0) continue;
    if (b.magic && b.element === 'electrico') continue;
    if (b.magic && b.element === 'fuego') {
      ice.left -= CRECIDA.ice;
      blind(foe);
      delete foe.timed!.quemado;
      if (ice.left <= 1e-6) thaw(foe); else ice.level = Math.ceil(ice.left / CRECIDA.ice);
      (effect.ice ??= []).push({ target: foe.id, melted: true });
      state.message += ` El fuego derrite una marca de hielo: ¡${TIMED.cegado.name}!`;
      continue;
    }
    const added = b.strikes * b.weight;
    foe.cracks = Math.min(CRECIDA.blows, (foe.cracks ?? 0) + added);
    if (foe.cracks < CRECIDA.blows) { (effect.ice ??= []).push({ target: foe.id, cracks: foe.cracks, added }); continue; }
    const left = ice.left / CRECIDA.ice;
    thaw(foe);
    const caster = state.allies.find(a => a.id === state.cold?.by) ?? actor;
    const amount = hurt(state, foe, fearDamage(state, foe, magical(iceBreakPower(left), current(state, caster), current(state, foe)) * affinityScale(foe, 'agua'), 'magic', 'agua'));
    (effect.ice ??= []).push({ target: foe.id, cracks: CRECIDA.blows, added, broke: amount });
    state.message += ` ¡El hielo de ${foe.name} se rompe! −${amount} PV.`;
  }
}
/** Bajo cero: every foe standing with water freezes in it, as many marks of ice as it had of water; the water is gone. */
function freeze(state: BattleState, actor: Combatant, effect: BattleEffect) {
  const cold = state.cold ??= {};
  cold.used = true; cold.by = actor.id;
  effect.frozen = state.foes.filter(f => f.hp > 0 && waterOf(f) > 0).map(foe => {
    const marks = waterOf(foe);
    dry(foe);
    foe.timed = { ...foe.timed, congelado: { level: marks, left: marks * CRECIDA.ice, next: TIMED.congelado.every } };
    foe.cracks = 0;
    return { target: foe.id, marks };
  });
  const names = effect.frozen.map(f => state.foes.find(foe => foe.id === f.target)!.name);
  state.message = `${actor.name} usa Bajo cero. ${names.length === 1 ? `${names[0]} se congela` : `Se congelan ${names.join(', ')}`}: no actúan mientras dure el hielo.`;
}
/**
 * Development (the fight tester's «Agua»): every foe standing has `marks` of water now (0: dry), held by whoever wears
 * Freática (the active fighter otherwise). A frozen one thaws first. Returns whether it fits this fight.
 */
export function stageWater(state: BattleState, marks: number) {
  if (state.phase !== 'player' && state.phase !== 'enemy') return false;
  const holder = state.allies.find(a => a.hp > 0 && a.classId === 'freatica') ?? state.allies[state.active];
  const effect: BattleEffect = { kind: 'skill', actor: holder.id };
  for (const foe of state.foes.filter(f => f.hp > 0)) {
    thaw(foe); dry(foe);
    if (marks > 0) raiseWater(state, holder, foe, effect, marks);
  }
  state.message = marks > 0 ? `Depuración: agua ${roman(marks)} bajo cada enemigo.` : 'Depuración: sin agua.';
  return true;
}
export function act(state: BattleState, action: BattleAction, targetId?: string, skill?: SkillId, die?: number): BattleEffect | undefined {
  if (state.phase !== 'player') return;
  const actor = state.allies[state.active];
  if (!actor || actor.hp <= 0) return;
  dug.length = 0; met.length = 0; screenTook.length = 0; livesTook.length = 0;
  // Tirar dado: the die spent decides the move, its face's own (`FACE_SKILLS`); a blank repeats the last face spent.
  let cast: number | undefined, paid: number | undefined;
  const streak = rachaOf(actor);
  if (action === 'skill' && faceUse(skill)) {
    if (!skillsFor(state, actor).some(s => s.id === skill)) return;
    const hand = diceOf(state, actor);
    cast = die !== undefined && hand[die] ? die : bestDie(state);
    const as = cast >= 0 ? dieSkill(state, cast) : undefined;
    if (!as) return;
    skill = as;
  } else if (action === 'skill' && dieUse(skill)) {
    // Estrella fugaz: any die pays for it, the one chosen or the one worth least.
    const hand = diceOf(state, actor);
    paid = die !== undefined && hand[die] ? die : spareDie(state);
    if (paid < 0) return;
    // The meteor only comes in the size it has grown to.
    const spec = SKILLS.find(s => s.id === skill);
    if (spec && 'meteor' in spec && spec.meteor !== meteorOf(actor)) return;
  }
  const ability = SKILLS.find(s => s.id === skill);
  const targets = validTargets(state, action, skill);
  const party = action === 'skill' && ability?.side === 'party';
  const everyone = action === 'skill' && ability?.side === 'all-foes';
  let target = party ? undefined : everyone ? targets[0] : targets.find(f => f.id === targetId);
  if ((action === 'attack' || action === 'skill') && !target && !(party && targets.length)) return;
  if (action === 'skill' && (!ability || actor.secondary < ability.cost || (cast === undefined && !skillsFor(state, actor).includes(ability)))) return;
  const effect: BattleEffect = { actor: actor.id, kind: action };
  if (cast !== undefined) spendDie(actor, diceOf(state, actor), cast, effect);
  else if (paid !== undefined) {
    // The die chosen first, then as many more as the skill costs: the ones worth least.
    spendDie(actor, diceOf(state, actor), paid, effect, false);
    const first = effect.die!, more: DieFace[] = [];
    for (let i = 1; i < ability!.cost; i++) { spendDie(actor, diceOf(state, actor), spareDie(state), effect, false); more.push(effect.die!.face); }
    effect.die = first;
    if (more.length) effect.paid = more;
  }
  // La Lealtad steps in front of whoever a blow is aimed at (one that reaches every foe gets past her).
  const aimedAt = target, guard = target && !everyone && state.foes.includes(target) ? guardOf(state, target) : undefined;
  if (guard && aimedAt) { target = guard; effect.interposed = aimedAt.id; }
  if (action === 'escape' && cornered(state)) return;
  if (action !== 'escape') took(state, actor);
  // Pedal holds the ecos' clocks only until their wearer acts again (Defender again sets it again).
  delete actor.pedal;
  // La Voz's song does not wait for rounds: a guard held against it lasts until that fighter acts again.
  if (state.song && action !== 'defend') actor.guarding = false;
  if (action === 'escape' && escapeChance(state) < 1 && roll(state) >= escapeChance(state)) {
    state.escapeTries = (state.escapeTries ?? 0) + 1;
    effect.noWayOut = true;
    state.message = `${actor.name} intenta salir, pero no encuentra hueco.`;
    settle(state);
    return effect;
  }
  if (action === 'escape') {
    state.phase = 'escaped'; endFight(state);
    state.message = state.encounter === 'palace-guards' ? 'Retrocedéis hasta el vestíbulo. Los guardianes vuelven a pegarse a la cortina.'
      : state.encounter === 'night-guard' ? 'Echáis a correr. Se quedan un momento pegados a la acera.'
      : FLEEABLE.has(state.encounter) ? 'Retrocedéis sin darles la espalda. Seguirán ahí.' : 'Te alejas con calma. La aventura sigue.';
    return effect;
  }
  if (action === 'defend') {
    actor.guarding = true;
    // Holding still gathers maná back into the ánima worn.
    effect.charged = adjustResource({ current: actor.secondary, max: actor.maxSecondary }, DEFEND_CHARGE).amount;
    actor.secondary += effect.charged;
    // Dadista's maná comes as dice, rolled in view.
    if (actor.classId === DICED && effect.charged) effect.dealt = diceOf(state, actor).slice(-effect.charged);
    state.message = state.song ? `${actor.name} se cubre: aguanta su voz hasta que vuelva a moverse.${effect.charged ? ` Maná +${effect.charged}.` : ''}`
      : `${actor.name} se prepara para el siguiente golpe.${effect.charged ? ` Maná +${effect.charged}.` : ''}`;
    // Pedal (Sincopante, level 6): while they hold on, their ecos keep sounding and their clocks stand still.
    if (pedalOf(state, actor) && ecosOf(state, actor).length) {
      actor.pedal = true; note(effect, 'pedal', actor);
      state.message += ' Pedal: sus ecos siguen sonando sin gastar su tiempo.';
    }
  } else if (party && ability && ability.kind === 'charge') {
    // ∂Q/∂t Condensador: the charge stays on them until their next electric blow, or a foe's blow on them.
    spendSecondary(actor, ability.cost); effect.skill = skill; effect.target = actor.id;
    actor.capacitor = true; effect.capacitor = 'stored';
    state.message = `${actor.name} usa ${ability.name}. Se carga: su siguiente golpe eléctrico hará el doble.`;
  } else if (party && ability && 'raise' in ability) {
    // Crescendo: every eco of the wearer a grade up (*f* at most: from there it only starts over), and their clocks start over.
    spendSecondary(actor, ability.cost); effect.skill = skill; effect.target = actor.id;
    const mine = ecosOf(state, actor);
    for (const e of mine) { e.grade = Math.min(2, e.grade + 1) as Eco['grade']; e.left = ECOS.life; }
    effect.ecosRaised = mine.map(e => ({ eco: e.id, grade: e.grade }));
    const loudest = Math.max(...mine.map(e => e.grade));
    state.message = `${actor.name} usa ${ability.name}. ${mine.length === 1 ? 'Su eco suena' : 'Sus ecos suenan'} ${GRADE_NAMES[loudest]}${loudest === 2 ? ': llegan a todos' : ', más fuerte'}.`;
  } else if (party && ability && 'capo' in ability) {
    // Da capo: back to the beginning. Every dual already used can go off once more, every ánima of everyone is full
    // of maná again (worn or not), and the ecos up start their clocks over. It fires no dual by itself.
    effect.skill = skill; effect.target = actor.id;
    (state.dacapo ??= {}).used = true;
    const duals = [...state.usedDuals ?? []];
    delete state.usedDuals;
    for (const ally of state.allies) if (ally.hp > 0 && wearsAnimas(ally)) { ally.secondary = ally.maxSecondary; delete ally.mana; }
    for (const e of state.ecos ?? []) e.left = ECOS.life;
    effect.dacapo = { duals, ecos: (state.ecos ?? []).map(e => e.id) };
    state.message = `${actor.name} usa ${ability.name}. ¡Todo vuelve al principio! El maná de todo el equipo se llena${duals.length ? ` y ${duals.length === 1 ? 'el ataque dúo ya usado vuelve' : 'los ataques dúo ya usados vuelven'}` : ''}.`;
  } else if (ability && 'accompany' in ability && target) {
    // Acompañamiento: an eco at the ally's side that repeats their blows (`accompany`). One per ally: a new one takes the old one's place.
    spendSecondary(actor, ability.cost); effect.skill = skill; effect.target = target.id;
    state.message = `${actor.name} usa ${ability.name}${target === actor ? '' : ` con ${target.name}`}.`;
    for (const old of ecosOf(state).filter(e => e.kind === 'acompanamiento' && e.target === target.id)) {
      state.ecos!.splice(state.ecos!.indexOf(old), 1); (state.ecoNews ??= []).push({ kind: 'out', eco: old.id });
    }
    callEco(state, actor, 'acompanamiento', target.id, effect);
  } else if (party && ability!.kind === 'heal') {
    // Integral: everyone standing who is hurt gets back a share of their own PV.
    spendSecondary(actor, ability!.cost); effect.skill = skill; effect.target = actor.id; effect.healed = true;
    effect.cures = targets.map(ally => ({ target: ally.id, amount: changeHealth(ally, healing(ability!.power, ally.maxHp)) }));
    effect.amount = effect.cures[0]?.amount;
    state.message = `${actor.name} usa ${ability!.name}. ${effect.cures.map(c => `+${c.amount}`).join(', ')} PV para el equipo.`;
    // Integral impropia: and the rest bit by bit on the fight's clock, on each of them (again while it lasts, a level up).
    if ('regen' in ability!) {
      const levels = targets.map(ally => inflict(ally, ability.regen).level);
      effect.regen = { id: ability.regen, level: Math.max(...levels) };
      state.message += ` ¡${TIMED[ability.regen].name}${effect.regen.level > 1 ? ` ${roman(effect.regen.level)}` : ''} para el equipo!`;
    }
    // Bombeo: the cure is a mark of water, taken from the foe that has the most (the first of them on a tie).
    if ('pumps' in ability!) {
      const source = state.foes.filter(f => f.hp > 0 && waterOf(f) > 0).sort((x, y) => waterOf(y) - waterOf(x))[0];
      if (source) { const left = lowerWater(source, 1, effect); state.message += left ? ` El agua de ${source.name} baja a ${roman(left)}.` : ` El agua de ${source.name} se acaba.`; }
    }
  } else if (party && ability && 'bits' in ability) {
    // Escudo de bits: one wall in front of everyone standing (a new one replaces the old).
    spendSecondary(actor, ability.cost); effect.skill = skill; effect.target = actor.id;
    raiseBits(state, ability.power);
    effect.bits = { raised: ability.power };
    state.message = `${actor.name} usa ${ability.name}. Bip levanta una cúpula de bits sobre el equipo: ${ability.power} PV durante ${BITS.rounds} rondas.`;
  } else if (party && ability!.kind === 'boost') {
    if (paid === undefined) spendSecondary(actor, ability!.cost);
    effect.skill = skill; effect.target = actor.id;
    state.boosts = { ...state.boosts, [ability!.id]: { amount: ability!.power, until: state.round + BOOST_ROUNDS - 1 } };
    effect.boosted = targets.map(ally => ally.id);
    effect.stats = targets.map(ally => ({ target: ally.id, way: 'up' as const, stats: [...ability!.stats] }));
    state.message = 'double' in ability! ? `${actor.name} usa ${ability!.name}. El Crítico de todo el equipo cuenta el doble durante ${BOOST_ROUNDS} rondas.`
      : `${actor.name} usa ${ability!.name}. ${boostedStats(ability!.id)} +${ability!.power} para el equipo durante ${BOOST_ROUNDS} rondas.`;
    // Telón: a cortina in front of everyone standing.
    if ('screen' in ability!) {
      screenBoost(state, ability!.id);
      for (const ally of targets) raiseCortina(state, ally, effect);
      state.message += ' Una cortina de polvo delante de cada uno.';
    }
  } else if (ability?.kind === 'boost' && 'screen' in ability && target) {
    // Cortina: Defensa for everyone standing, and the screen in front of the ally picked.
    spendSecondary(actor, ability.cost); effect.skill = skill; effect.target = target.id;
    state.boosts = { ...state.boosts, [ability.id]: { amount: ability.power, until: state.round + BOOST_ROUNDS - 1 } };
    screenBoost(state, ability.id);
    effect.boosted = targets.map(ally => ally.id);
    effect.stats = targets.map(ally => ({ target: ally.id, way: 'up' as const, stats: [...ability.stats] }));
    raiseCortina(state, target, effect);
    state.message = `${actor.name} usa ${ability.name}. ${boostedStats(ability.id)} +${ability.power} para el equipo durante ${BOOST_ROUNDS} rondas. Una cortina de polvo delante de ${target.name}.`;
  } else if (ability?.kind === 'heal' && target && 'regen' in ability) {
    // Rayo de sanación: part of the cure at once, the rest bit by bit on the fight's clock; again while it lasts, a level up.
    spendSecondary(actor, ability.cost); effect.skill = skill; effect.target = target.id;
    const on = inflict(target, ability.regen);
    effect.regen = { id: ability.regen, level: on.level };
    // Rayo de sanación, Ronroneo: part of the cure comes at once (Ronroneo: and what troubles the mind goes with it).
    if ('instant' in ability) { effect.healed = true; effect.amount = changeHealth(target, healing(ability.power, target.maxHp)); }
    if ('cleanse' in ability) {
      const gone = cleansable(target);
      for (const id of gone) delete target.statuses![id];
      if (gone.length) {
        effect.cleansed = [{ target: target.id, statuses: gone }];
        effect.stats = [{ target: target.id, way: 'up' as const, stats: [...new Set(gone.flatMap(id => Object.keys(STATUSES[id].stats ?? {}) as (keyof Stats)[]))] }];
      }
    }
    // Nanitos: the cure also takes one harmful status off them (a stacking one first, then one on the clock).
    if (passive(state, actor, 'nanitos')) {
      const stacked = STATUS_IDS.find(id => stacks(target, id) > 0), clocked = TIMED_IDS.find(id => !TIMED[id].heal && target.timed?.[id]);
      if (stacked) { delete target.statuses![stacked]; effect.cleansed = [{ target: target.id, statuses: [stacked] }]; }
      else if (clocked) { delete target.timed![clocked]; effect.cleared = [clocked]; }
      if (stacked || clocked) note(effect, 'nanitos', actor);
    }
    state.message = `${actor.name} usa ${ability.name}${target === actor ? '' : ` con ${target.name}`}.${effect.amount ? ` +${effect.amount} PV.` : ''} ¡${TIMED[ability.regen].name}${on.level > 1 ? ` ${roman(on.level)}` : ''}!${'cleanse' in ability ? effect.cleansed ? ' Se le pasan los efectos de estado mentales.' : '' : effect.cleansed ? ` Nanitos: fuera ${STATUSES[effect.cleansed[0].statuses[0]].name}.` : effect.cleared ? ` Nanitos: fuera ${TIMED[effect.cleared[0]].name}.` : ''}`;
  } else if (ability?.kind === 'guard' && target) {
    // Corchete: the ally between brackets takes a third of each blow until the round ends, as if Defending.
    if (cast === undefined) spendSecondary(actor, ability.cost);
    effect.skill = skill; effect.target = target.id; effect.guarded = true;
    target.guarding = true;
    // Escolta: Bip stays by them for its rounds (`keepEscorts` guards them again as each round starts).
    if ('escort' in ability) { target.escort = { until: state.round + ability.escort - 1, by: actor.id }; effect.escorted = ability.escort; }
    state.message = `${actor.name} usa ${ability.name}${target === actor ? '' : ` con ${target.name}`}. ${'escort' in ability ? `Bip se queda a su lado: protegido durante ${ability.escort} rondas.` : 'Protegido hasta el final de la ronda.'}`;
  } else if (ability?.kind === 'heal' && target) {
    // Cardioide: a curve of light under a friend gives back half their PV.
    spendSecondary(actor, ability.cost); effect.skill = skill; effect.target = target.id; effect.healed = true;
    effect.amount = changeHealth(target, healing(ability.power, target.maxHp));
    state.message = `${actor.name} usa ${ability.name}${target === actor ? '' : ` con ${target.name}`}. +${effect.amount} PV.`;
  } else if (ability && 'shrink' in ability && target) {
    // Rayo encogedor: smaller and much easier to hurt for a while; again, its clock starts over.
    spendSecondary(actor, ability.cost); effect.skill = skill; effect.target = target.id; effect.afflicted = { id: 'encogido', level: 1 };
    target.timed = { ...target.timed, encogido: { level: 1, left: TIMED.encogido.seconds, next: TIMED.encogido.every } };
    effect.stats = [{ target: target.id, way: 'down', stats: ['defensa'] }];
    state.message = `${actor.name} usa ${ability.name} contra ${target.name}. ¡Se encoge! ${statNames(['defensa'])} −${Math.round((TIMED.encogido.cut!.defensa ?? 0) * 100)} % durante ${TIMED.encogido.seconds} s.`;
  } else if (ability && 'bomb' in ability && target) {
    // Bomba remota: a bomb on the foe; on one that has a bomb already, its clock starts over and it keeps growing (`plantBomb`).
    spendSecondary(actor, ability.cost); effect.skill = skill; effect.target = target.id;
    const again = !!target.timed?.bomba;
    plantBomb(target); effect.planted = [target.id]; effect.afflicted = { id: 'bomba', level: 1 };
    state.message = `${actor.name} usa ${ability.name} contra ${target.name}. ${again ? 'Su bomba vuelve a contar desde el principio, sin perder lo cargado.' : `Bip le pega una bomba: ${BOMBA.seconds} s.`}`;
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
    if (amount > 0) combust(state, target, victim, effect);
  } else if (ability?.kind === 'debuff' && target) {
    // Ángulo exacto: a mark on the foe, its stats down for a few rounds (every hit on it lands harder).
    spendSecondary(actor, ability.cost); effect.skill = skill; effect.target = target.id; effect.spell = true;
    target.marks = { ...target.marks, [ability.id]: { amount: ability.power, stats: [...ability.stats], until: state.round + BOOST_ROUNDS - 1 } };
    effect.stats = [{ target: target.id, way: 'down', stats: [...ability.stats] }];
    state.message = `${actor.name} usa ${ability.name} contra ${target.name}. ${statNames(ability.stats)} −${ability.power} durante ${BOOST_ROUNDS} rondas.`;
  } else if (ability && 'stalk' in ability && target) {
    // Acecho: nothing lands this turn. The wearer's cat crouches on the foe picked, and lands as the next round starts (`pounce`).
    spendSecondary(actor, ability.cost); effect.skill = skill; effect.target = target.id; effect.stalking = target.id;
    actor.stalk = { target: target.id };
    state.message = `${actor.name} usa ${ability.name} contra ${target.name}. Saldrá al empezar la siguiente ronda.`;
    if (effect.interposed) state.message += ` ${target.name} se ha puesto delante.`;
  } else if (everyone && annulled(state, actor, elementOf(ability), ability?.kind)) {
    // Fran's salon: the light eats a blow on everyone of its element too.
    if (cast === undefined && paid === undefined) spendSecondary(actor, ability!.cost);
    effect.skill = skill; effect.target = target!.id;
    const light = annulled(state, actor, elementOf(ability), ability?.kind)!;
    effect.annulled = light; effect.amount = 0;
    effect.hits = targets.map(foe => ({ target: foe.id, amount: 0 }));
    state.message = `${actor.name} usa ${ability!.name}. ${annulledText(light)}`;
  } else if (everyone && 'rain' in ability!) {
    // Dados astrales: the luck, cashed. Each die of light picks a foe still standing on the fight's dice;
    // none rolls for a golpe crítico (the luck is in how many fall), and only the first on a foe spends its mark.
    effect.skill = skill; effect.target = target!.id;
    const count = rainCount(state, actor), totals = new Map<string, { amount: number; weakSpot?: true }>();
    effect.rain = [];
    for (let i = 0; i < count; i++) {
      const standing = targets.filter(foe => foe.hp > 0);
      if (!standing.length) break;
      const foe = standing[Math.floor(roll(state) * standing.length)], weak = weakScale(state, foe);
      const blocked = foe.shell || singing(state, foe) || reflects(foe);
      const amount = blocked ? 0 : hurt(state, foe, fearDamage(state, foe, strike(state, actor, foe, ability) * weak * affinityScale(foe, undefined), 'magic'));
      const sum = totals.get(foe.id) ?? { amount: 0 };
      sum.amount += amount;
      if (weak > 1 && amount > 0) { delete foe.weakSpot; effect.weakSpot = 'spent'; sum.weakSpot = true; }
      spendShield(state, foe, amount, effect);
      if (foe.layers && !blocked && !--foe.layers) bare(foe);
      totals.set(foe.id, sum);
      effect.rain.push({ target: foe.id, amount });
    }
    effect.hits = [...totals].map(([id, sum]) => ({ target: id, ...sum }));
    effect.amount = effect.rain.reduce((sum, drop) => sum + drop.amount, 0);
    const spent = rachaOf(actor);
    if (spent) { actor.racha = 0; effect.starred = spent; }
    state.message = `${actor.name} usa ${ability!.name}. Caen ${effect.rain.length} dados de luz: −${effect.amount} PV entre todos.${spent ? ' La racha empieza de cero.' : ''}`;
    if (effect.weakSpot) state.message += ' ¡Punto débil: el triple de daño!';
  } else if (everyone && 'hunt' in ability!) {
    // Cacería: a claw for each stack on each foe that bleeds, one foe after another (`targets`: only they). None lands with
    // the wound's bonus: the count is the bonus. With Olor a sangre the claws on a wound of five or more are golpes
    // críticos for sure (and spending it wakes Siete vidas); the rest roll. Each claw peels a layer. It spends the wound.
    spendSecondary(actor, ability.cost); effect.skill = skill; effect.target = target!.id;
    const hunt: NonNullable<BattleEffect['hunt']> = effect.hunt = [];
    effect.hits = targets.map(foe => {
      const drained = stacks(foe, 'sangrado'), sure = sureCrit(state, drained, effect), layered = foe.layers ?? 0;
      let amount = 0, crit = false, marked = false;
      for (let i = 0; i < drained && foe.hp > 0; i++) {
        const blocked = foe.shell || singing(state, foe), weak = weakScale(state, foe);
        const hard = !blocked && critical(state, actor, foe, sure);
        const dealt = blocked ? 0 : hurt(state, foe, fearDamage(state, foe, strike(state, actor, foe, ability) * (1 + (hard ? CRIT_RULES.bonus : 0)) * weak * affinityScale(foe, undefined), 'physical'));
        if (weak > 1 && dealt > 0) { delete foe.weakSpot; effect.weakSpot = 'spent'; marked = true; }
        spendShield(state, foe, dealt, effect);
        if (foe.layers && !blocked && !--foe.layers) bare(foe);
        amount += dealt;
        if (hard && dealt > 0) { crit = true; effect.crit = true; }
        hunt.push({ target: foe.id, amount: dealt, ...hard && dealt > 0 ? { crit: true as const } : {} });
      }
      closeWound(foe);
      const peeled = layered - (foe.layers ?? 0);
      return { target: foe.id, amount, drained, ...crit ? { crit: true as const } : {}, ...peeled ? { peeled } : {}, ...marked ? { weakSpot: true as const } : {} };
    });
    effect.amount = hunt.reduce((sum, claw) => sum + claw.amount, 0);
    const broken = effect.hits.filter(h => h.peeled && !targets.find(foe => foe.id === h.target)?.layers && targets.find(foe => foe.id === h.target)!.hp > 0);
    if (broken.length) effect.stats = broken.map(h => ({ target: h.target, way: 'down' as const, stats: ['defensa' as const] }));
    state.message = `${actor.name} usa ${ability.name}. ${hunt.length === 1 ? 'Un zarpazo' : `${hunt.length} zarpazos`}: −${effect.amount} PV entre ${targets.length === 1 ? targets[0].name : 'quienes sangraban'}. La sangre se gasta.`;
    if (effect.weakSpot) state.message += ' ¡Punto débil: el triple de daño!';
    if (effect.crit) state.message += ' ¡Golpe crítico!';
    for (const foe of targets) if ((effect.hits.find(h => h.target === foe.id)?.amount ?? 0) > 0) combust(state, actor, foe, effect);
  } else if (everyone && 'freezes' in ability!) {
    // Bajo cero: no blow; every foe with water stands in its ice (`freeze`).
    effect.skill = skill; effect.target = target!.id;
    freeze(state, actor, effect);
  } else if (everyone && 'hammer' in ability!) {
    // Golpe de ariete: on each foe with water (`targets`: only they), a blow a mark of its own water, one foe after another,
    // each its own golpe crítico; then the water is spent, and with it the current and the sinking.
    spendSecondary(actor, ability.cost); effect.skill = skill; effect.target = target!.id; effect.element = 'agua';
    const hammer: NonNullable<BattleEffect['hammer']> = effect.hammer = [];
    effect.hits = targets.map(foe => {
      const marks = waterOf(foe), found = affinityOf(foe, 'agua');
      let amount = 0, crit = false, marked = false;
      for (let i = 0; i < marks && foe.hp > 0; i++) {
        const blocked = foe.shell || singing(state, foe), weak = weakScale(state, foe);
        const hard = !blocked && critical(state, actor, foe);
        const dealt = blocked ? 0 : hurt(state, foe, fearDamage(state, foe, strike(state, actor, foe, ability) * (1 + (hard ? CRIT_RULES.bonus : 0)) * weak * affinityScale(foe, 'agua'), 'magic', 'agua'));
        if (weak > 1 && dealt > 0) { delete foe.weakSpot; effect.weakSpot = 'spent'; marked = true; }
        spendShield(state, foe, dealt, effect);
        if (foe.layers && !blocked && !--foe.layers) bare(foe);
        amount += dealt;
        if (hard && dealt > 0) { crit = true; effect.crit = true; }
        hammer.push({ target: foe.id, amount: dealt, ...hard && dealt > 0 ? { crit: true as const } : {} });
      }
      lowerWater(foe, marks, effect);
      iterate(state, foe, 'agua', effect);
      return { target: foe.id, amount, ...crit ? { crit: true as const } : {}, ...marked ? { weakSpot: true as const } : {}, ...found && amount > 0 ? { affinity: found } : {} };
    });
    effect.amount = hammer.reduce((sum, blow) => sum + blow.amount, 0);
    state.message = `${actor.name} usa ${ability.name}. ${hammer.length === 1 ? 'Un golpe de agua' : `${hammer.length} golpes de agua`}: −${effect.amount} PV${targets.length > 1 ? ' entre todos' : ''}. El agua se gasta.`;
    if (effect.weakSpot) state.message += ' ¡Punto débil: el triple de daño!';
    if (effect.crit) state.message += ' ¡Golpe crítico!';
  } else if (everyone && 'swarm' in ability!) {
    // Enjambre: every clock on every foe starts over, and each gets a bomb already at its top (`plantBomb`).
    effect.skill = skill; effect.target = target!.id;
    (state.swarm ??= {}).used = true;
    const standing = targets.filter(foe => foe.hp > 0);
    effect.restarted = standing.map(foe => ({ target: foe.id, statuses: restartClocks(foe) })).filter(r => r.statuses.length);
    for (const foe of standing) plantBomb(foe, (BOMBA.top - BOMBA.base) / BOMBA.perSecond);
    effect.planted = standing.map(foe => foe.id);
    effect.hits = targets.map(foe => ({ target: foe.id, amount: 0 }));
    state.message = `${actor.name} usa ${ability!.name}. Bip se deshace sobre los enemigos: cada uno lleva una bomba al máximo.`;
  } else if (everyone && skill === 'fin-de-fiesta') {
    // Fin de fiesta: three puffs over every foe standing, and each takes its exit at once (`powder`): fire, water, a spark.
    effect.skill = skill; effect.target = target!.id;
    (state.finale ??= { seen: [] }).used = true;
    const standing = () => targets.filter(foe => foe.hp > 0), dust = () => { for (const foe of standing()) kindle(foe, 'empolvado', 1); };
    state.message = `${actor.name} usa ${ability!.name}.`;
    // What each puff turned into is the definitiva's own (`effect.finale`), not a reaction of the blow's.
    const take = () => { const reaction = effect.reaction; delete effect.reaction; return reaction; };
    dust();
    if (standing()[0]) powder(state, actor, standing()[0], 'fuego', effect);
    const blown = take();
    dust();
    for (const foe of standing()) powder(state, actor, foe, 'agua', effect);
    const poisoned = (take()?.targets ?? []).map(id => ({ target: id, level: targets.find(foe => foe.id === id)?.timed?.envenenado?.level ?? 1 }));
    dust();
    for (const foe of standing()) powder(state, actor, foe, 'electrico', effect);
    const crystallised = take()?.targets ?? [];
    delete effect.awoken;
    effect.finale = { hits: blown?.hits ?? [], burns: blown?.burns ?? [], poisoned, crystallised };
    effect.hits = targets.map(foe => ({ target: foe.id, amount: effect.finale!.hits.find(h => h.target === foe.id)?.amount ?? 0 }));
    effect.amount = effect.hits[0]?.amount;
  } else if (everyone && 'volley' in ability!) {
    // Traca: a string of puffs, each on a foe still standing picked on the fight's dice. Each is a blow of its own
    // (its golpe crítico, its layer, what a poison or the shards add); a wound is spent by the first that finds it.
    spendSecondary(actor, ability.cost); effect.skill = skill; effect.target = target!.id;
    const totals = new Map<string, { amount: number; bled?: number; crit?: true; weakSpot?: true; peeled?: number }>();
    effect.volley = [];
    for (let i = 0; i < ability.volley; i++) {
      const left = targets.filter(foe => foe.hp > 0);
      if (!left.length) break;
      const foe = left[Math.floor(roll(state) * left.length)], weak = weakScale(state, foe), sum = totals.get(foe.id) ?? { amount: 0 };
      const blocked = foe.shell || singing(state, foe);
      const { bled, scale } = totals.has(foe.id) || blocked ? { bled: 0, scale: 1 } : wound(foe, true, skill);
      const crit = !blocked && critical(state, actor, foe, sureCrit(state, bled, effect));
      const amount = blocked ? 0 : hurt(state, foe, fearDamage(state, foe, strike(state, actor, foe, ability) * (scale + (crit ? CRIT_RULES.bonus : 0)) * weak * affinityScale(foe, undefined), 'physical'));
      sum.amount += amount;
      if (bled) { closeWound(foe); sum.bled = bled; }
      if (crit && amount > 0) { effect.crit = true; sum.crit = true; }
      if (weak > 1 && amount > 0) { delete foe.weakSpot; effect.weakSpot = 'spent'; sum.weakSpot = true; }
      spendShield(state, foe, amount, effect);
      if (foe.layers && !blocked) { sum.peeled = (sum.peeled ?? 0) + 1; if (!--foe.layers) bare(foe); }
      totals.set(foe.id, sum);
      effect.volley.push({ target: foe.id, amount, ...crit && amount > 0 ? { crit: true as const } : {} });
    }
    effect.hits = [...totals].map(([id, sum]) => {
      const foe = targets.find(f => f.id === id)!, dusted = sum.amount > 0 && foe.hp > 0;
      if (dusted) kindle(foe, 'empolvado', 1);
      return { target: id, ...sum, ...dusted ? { burn: { id: 'empolvado' as const, level: 1 } } : {} };
    });
    effect.amount = effect.volley.reduce((sum, puff) => sum + puff.amount, 0);
    state.message = `${actor.name} usa ${ability.name}. ${effect.volley.length} estallidos de polvo: −${effect.amount} PV entre todos.`;
    if (effect.weakSpot) state.message += ' ¡Punto débil: el triple de daño!';
    if (effect.crit) state.message += ' ¡Golpe crítico!';
    for (const foe of targets) if ((totals.get(foe.id)?.amount ?? 0) > 0) combust(state, actor, foe, effect);
  } else if (everyone) {
    // A blow on every foe at once: Factor común, Explosión; the Comodín, a hand on each (its die paid already).
    if (cast === undefined && paid === undefined) spendSecondary(actor, ability!.cost);
    effect.skill = skill; effect.target = target!.id;
    if ('element' in ability!) effect.element = ability.element;
    const blow: Blow = ability!.kind === 'physical' ? 'physical' : 'magic';
    effect.hits = targets.map(foe => {
      const { bled, scale } = wound(foe, blow === 'physical', skill), weak = weakScale(state, foe);
      const found = affinityOf(foe, elementOf(ability));
      const crit = critical(state, actor, foe, sureCrit(state, bled, effect));
      const amount = hurt(state, foe, fearDamage(state, foe, strike(state, actor, foe, ability) * (scale + (crit ? CRIT_RULES.bonus : 0)) * weak * affinityScale(foe, elementOf(ability)), blow, elementOf(ability)));
      if (crit && amount > 0) effect.crit = true;
      iterate(state, foe, elementOf(ability), effect);
      if (bled) closeWound(foe);
      // Only an action that takes PV off spends the mark (one the floor swallows leaves it).
      const spends = weak > 1 && amount > 0;
      if (spends) { delete foe.weakSpot; effect.weakSpot = 'spent'; }
      spendShield(state, foe, amount, effect);
      const peeled = foe.layers ? 1 : undefined;
      if (foe.layers && !--foe.layers) bare(foe);
      const status = 'bleed' in ability! && foe.hp > 0 ? { id: 'sangrado' as const, stacks: cut(state, foe, ability.bleed as number) } : undefined;
      // Fire melts the pringue (Explosión).
      if (elementOf(ability) === 'fuego' && foe.shell) { foe.shell = false; effect.melted = true; }
      return { target: foe.id, amount, status, peeled, ...bled ? { bled } : {}, ...crit && amount > 0 ? { crit: true as const } : {}, ...spends ? { weakSpot: true as const } : {}, ...found && amount > 0 ? { affinity: found } : {} };
    });
    // Explosión: the flash blinds whoever is still standing until the round is over (a longer smoke stays as it is).
    if ('blind' in ability!) {
      effect.exploded = true;
      effect.blinded = targets.filter(foe => foe.hp > 0).map(foe => { blind(foe, TIMED.cegado.seconds, state.round); return foe.id; });
    }
    // …it sets off every Bomba remota it finds on them, as grown as it is now…
    if ('detonates' in ability!) {
      const armed = targets.filter(foe => foe.hp > 0 && foe.timed?.bomba);
      if (armed.length) effect.detonated = armed.map(foe => ({ target: foe.id, amount: blowBomb(state, foe, effect) }));
    }
    // …and Bip has to put itself back together: its wearer sits the next round out.
    if ('spends' in ability!) actor.out = state.round + 1;
    const hitOf = (foe: Combatant) => effect.hits!.find(h => h.target === foe.id)!;
    // Powder on any of them meets the blow's element (`powder`): fire sets all of it off, water and electricity turn each one's.
    const landing = elementOf(ability), powdered = new Set<string>();
    state.message = '';
    if (landing) for (const foe of targets) if (powder(state, actor, foe, landing, effect)) powdered.add(foe.id);
    if (powdered.size) ground(state, actor, effect);
    const powderSaid = state.message;
    // A blow that powders (Polvareda): whoever it took PV from and still stands is Empolvado.
    if ('powders' in ability!) for (const foe of targets) if (foe.hp > 0 && hitOf(foe).amount > 0) { kindle(foe, 'empolvado', 1); hitOf(foe).burn = { id: 'empolvado', level: 1 }; }
    // Water on everyone standing: on a fire it is Humo, whoever throws it. Vasos comunicantes leaves the rest Mojado (`wets`); Rociada wets nobody.
    let smoked = 0;
    if (landing === 'agua') {
      for (const foe of targets.filter(f => f.hp > 0)) {
        // Whoever's powder took the water is poisoned, not wet (the reaction says so over each, `reaction.targets`).
        if (powdered.has(foe.id)) continue;
        if (foe.timed?.quemado) { const level = smoke(foe); smoked = Math.max(smoked, level); Object.assign(hitOf(foe), { burn: { id: 'cegado', level }, smoked: true }); }
        else if ('wets' in ability!) { foe.timed = { ...foe.timed, mojado: { level: 1, left: TIMED.mojado.seconds, next: TIMED.mojado.every } }; hitOf(foe).burn = { id: 'mojado', level: 1 }; }
      }
      if (smoked) { if (!effect.reaction) effect.reaction = { id: 'humo', level: smoked }; ground(state, actor, effect); }
      // La crecida: water on each one's water starts its clock over; Riada raises every foe's a mark.
      for (const foe of targets.filter(f => f.hp > 0)) {
        refill(foe);
        if ('raises' in ability!) raiseWater(state, actor, foe, effect, ability.raises);
      }
    }
    // Fire on everyone (Explosión): any water held under a foe goes up as Vapor (Factor común does it below).
    if (landing === 'fuego' && !('evens' in ability!)) {
      let steamed = 0;
      for (const foe of targets.filter(f => f.hp > 0 && waterOf(f) > 0)) {
        const held = waterOf(foe);
        steamed = Math.max(steamed, steam(foe));
        effect.water = [...effect.water ?? [], { target: foe.id, from: held, to: held - 1 }];
        Object.assign(hitOf(foe), { burn: { id: 'cegado', level: 1 }, smoked: true });
      }
      if (steamed) { effect.reaction = { id: 'vapor', level: steamed }; ground(state, actor, effect); }
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
    // Reinicio: the clocks on every foe start over.
    if ('restart' in ability!) effect.restarted = targets.filter(f => f.hp > 0).map(foe => ({ target: foe.id, statuses: restartClocks(foe) })).filter(r => r.statuses.length);
    effect.amount = effect.hits[0]?.amount;
    // The last layer off breaks an onion's defence.
    const broken = effect.hits.filter(h => h.peeled && !targets.find(foe => foe.id === h.target)?.layers && targets.find(foe => foe.id === h.target)!.hp > 0);
    if (broken.length) effect.stats = broken.map(h => ({ target: h.target, way: 'down' as const, stats: ['defensa' as const] }));
    state.message = `${actor.name} usa ${ability!.name}. ${effect.hits.length === 1 ? `−${effect.amount} PV.` : `Todos reciben: ${effect.hits.map(h => `−${h.amount}`).join(', ')} PV.`}`;
    if (effect.weakSpot) state.message += ' ¡Punto débil: el triple de daño!';
    if (effect.blinded?.length) state.message += ' ¡Cegados hasta que acabe la ronda!';
    if (effect.detonated?.length) state.message += ` ¡Estallan las bombas: ${effect.detonated.map(d => `−${d.amount}`).join(', ')} PV!`;
    if ('wets' in ability!) state.message += smoked ? ' El agua apaga los fuegos y moja al resto.' : powdered.size === targets.length ? '' : ' ¡Mojados!';
    else if (smoked) state.message += ' El agua apaga los fuegos.';
    if ('raises' in ability! && effect.water?.length) state.message += ` El agua sube: ${effect.water.map(w => roman(w.to)).join(', ')}.${effect.water.some(w => w.to >= CRECIDA.marks && w.from < CRECIDA.marks) ? ' ¡Hundidos!' : ''}`;
    if (landing === 'fuego' && effect.reaction?.id === 'vapor') state.message += ` ¡El agua se va en vapor! ¡${TIMED.cegado.name}!`;
    if ('powders' in ability! && effect.hits.some(h => h.burn?.id === 'empolvado')) state.message += ` ¡${TIMED.empolvado.name}s!`;
    if ('restart' in ability!) state.message += effect.restarted?.length ? ' Sus relojes vuelven a empezar.' : ' No llevan nada con reloj.';
    if (effect.mana) state.message += ' Toma de tierra: maná +1.';
    if (actor.out !== undefined && actor.out > state.round) state.message += ` ${actor.name} pierde su siguiente turno.`;
    state.message += powderSaid;
    // Pirámide ígnea: the fire everyone ends up with, after the powder has burst (it says what it raised).
    if ('evens' in ability! && effect.hits.some(h => h.burn?.id === 'quemado')) state.message += ` El fuego de todos: ${TIMED.quemado.name} ${roman(Math.max(...effect.hits.map(h => h.burn?.id === 'quemado' ? h.burn.level : 0)))}.`;
    // Combustión: a physical blow on everyone sets off each fire at IV it finds.
    if (ability!.kind === 'physical') for (const foe of targets) if ((effect.hits.find(h => h.target === foe.id)?.amount ?? 0) > 0) combust(state, actor, foe, effect);
    // Siete vidas: Haru's claw went through every foe, one after another (`hunt`, for the fight to land them so);
    // Yuki walks among the party and stays: one ward on all of them, until a blow that would kill one (`changeHealth`).
    if ('lives' in ability!) {
      (state.lives ??= {}).used = true;
      const ward: LivesWard = {};
      for (const ally of state.allies) ally.lives = ward;
      effect.ward = state.allies.filter(a => a.hp > 0).map(a => a.id);
      effect.hunt = effect.hits.map(h => ({ target: h.target, amount: h.amount, ...h.crit ? { crit: true as const } : {} }));
      state.message += ' Hasta el final del combate, el próximo golpe que fuera a tumbar a alguien del equipo lo curará.';
    }
  } else if (target) {
    // Dadista's die was spent already (`spendDie`): its maná with it.
    if (action === 'skill') { if (cast === undefined && paid === undefined) spendSecondary(actor, ability!.cost); effect.skill = skill; }
    effect.target = target.id;
    if (action === 'attack' && actor.classId === 'matemagico') effect.spell = true;
    // Any blow of fire melts the pringue: a skill of fire, or Atacar carrying it.
    const melts = (action === 'skill' ? elementOf(ability) : attackElement(state, actor)) === 'fuego';
    if (annulled(state, actor, action === 'attack' ? attackElement(state, actor) : elementOf(ability), action === 'attack' ? 'physical' : ability?.kind)) {
      // Fran's salon: the light on now eats a blow of its own element (the white one, a physical blow), whole.
      const light = annulled(state, actor, action === 'attack' ? attackElement(state, actor) : elementOf(ability), action === 'attack' ? 'physical' : ability?.kind)!;
      effect.amount = 0; effect.annulled = light;
      state.message = `${actor.name} usa ${action === 'skill' ? ability!.name : 'Atacar'} contra ${target.name}. ${annulledText(light)}`;
    } else if (target.shell && !melts) {
      // The gum swallows the blow whole.
      effect.amount = 0; effect.swallowed = true;
      state.message = `${actor.name} golpea a ${target.name}… y el chicle se lo traga. Ni un rasguño.`;
    } else if (singing(state, target)) {
      // While a note sounds La Voz is all voice: the blow goes through her.
      effect.amount = 0; effect.sung = true;
      state.message = `${actor.name} golpea a ${target.name} mientras canta, y la atraviesa. Mientras suena una nota no hay nadie a quien darle.`;
    } else if (action === 'skill' && ability!.kind === 'magic' && reflects(target)) {
      // Magic off glass: nothing for the target, and a share of it back at whoever cast it.
      effect.amount = 0;
      effect.reflected = changeHealth(actor, -Math.max(1, Math.round(strike(state, actor, target, ability) * MARTA.reflect)));
      state.message = `${actor.name} usa ${ability!.name} contra ${target.name}. La magia rebota y vuelve. −${effect.reflected} PV para ${actor.name}.`;
    } else {
      if (melts && target.shell) { target.shell = false; effect.melted = true; }
      // Each hit is measured on its own, since the layers it finds change the next one's weight.
      // A physical blow on someone bleeding opens the wound: every claw of it lands harder.
      const times = (action === 'skill' && ability && 'strikes' in ability ? ability.strikes : 1), layered = target.layers ?? 0, strikes: number[] = [];
      const magic = action === 'skill' && ability!.kind === 'magic';
      // The element Atacar carries; fire seals a wound instead of opening it (`react`).
      const element = action === 'attack' ? attackElement(state, actor) : ability && 'element' in ability ? ability.element : undefined;
      if (element) effect.element = element;
      const { bled, scale } = wound(target, !magic && element !== 'fuego', action === 'skill' ? skill : undefined), weak = weakScale(state, target);
      const chord = chordScale(state, actor, target);
      // What the blow lands with, for what the foe is made of: Atacar's element, or the skill's own (Foc Binari is fire).
      const landing = element ?? (action === 'skill' ? elementOf(ability) : undefined), found = affinityOf(target, landing);
      // Each strike can be a golpe crítico on its own; the one that spends a wound of five is, for sure (Olor a sangre).
      const sure = sureCrit(state, bled, effect), crits: boolean[] = [];
      // ∂Q/∂t Condensador: the charge goes into the first electric blow.
      const charged = actor.capacitor && landing === 'electrico' ? CONDENSADOR.scale : 1;
      for (let i = 0; i < times && target.hp > 0; i++) {
        const crit = critical(state, actor, target, sure && i === 0);
        strikes.push(hurt(state, target, fearDamage(state, target, strike(state, actor, target, action === 'skill' ? ability : undefined) * (scale + (crit ? CRIT_RULES.bonus : 0)) * weak * chord * charged * affinityScale(target, landing), magic ? 'magic' : 'physical', landing)));
        crits.push(crit && strikes[i] > 0);
        if (target.layers && !--target.layers) bare(target);
      }
      if (crits.some(Boolean)) { effect.crit = true; if (times > 1) effect.crits = crits; }
      if (bled) { closeWound(target); effect.bled = bled; }
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
      if (charged > 1) { delete actor.capacitor; effect.capacitor = 'spent'; state.message += ' ¡Suelta la carga: el doble!'; }
      if (effect.chord) state.message += effect.cancelled === 'calderon' ? ' ¡Acorde! Se le rompe el Calderón.' : ' ¡Acorde!';
      if (effect.interposed) state.message += ` ${target.name} se ha puesto delante.`;
      if (peeled && !target.layers && target.hp > 0) effect.stats = [{ target: target.id, way: 'down', stats: ['defensa'] }];
      if (peeled) state.message += !target.layers ? ' ¡Sin capas!' : peeled > 1 ? ` ${peeled} capas menos: quedan ${target.layers}.` : ` Una capa menos: quedan ${target.layers}.`;
      if (bled) state.message += ` La herida se abre: +${Math.round((scale - 1) * 100)} %.`;
      if (effect.crit) state.message += ' ¡Golpe crítico!';
      if (action === 'skill' && ability && 'bleed' in ability && target.hp > 0) {
        effect.status = { id: 'sangrado', stacks: cut(state, target, ability.bleed) };
        state.message += ` Sangrado ${effect.status.stacks}.`;
      }
      // Ojo: it finds where the foe gives, and the next blow there does triple (Punto débil).
      if (action === 'skill' && ability && 'mark' in ability && target.hp > 0) {
        target.weakSpot = state.round + 1; effect.weakSpot = spent ? 'renewed' : 'set';
        state.message += ' Punto débil: el siguiente ataque hace el triple.';
      }
      // Foc Binari sets them on fire; on someone already burning, the fire goes up a level. An onion's wet layers do not catch.
      if (action === 'skill' && ability && 'burn' in ability && target.timed?.empolvado) react(state, actor, target, 'fuego', effect);
      else if (action === 'skill' && ability && 'burn' in ability && target.hp > 0 && target.layers) state.message += ' Las capas, húmedas, no prenden.';
      // On someone wet the fire finds the water first: Vapor, and it does not catch (a skill's fire never cauterizes a wound: Atacar's does).
      else if (action === 'skill' && ability && 'burn' in ability && target.hp > 0 && target.timed?.mojado) { vapour(state, target, effect); ground(state, actor, effect); }
      else if (action === 'skill' && ability && 'burn' in ability && target.hp > 0) {
        const fire = inflict(target, ability.burn, fireTop(state));
        bank(state, actor, target, effect);
        effect.burn = { id: ability.burn, level: fire.level };
        state.message += fire.level > 1 ? ` ¡El fuego sube: ${TIMED[ability.burn].name} ${roman(fire.level)}!` : ' ¡Se quema!';
      }
      // Rayo de energía: whatever is running out on them by the clock (never a cure) starts over, as Reinicio does on every foe.
      if (action === 'skill' && ability && 'restart' in ability && target.hp > 0) {
        const statuses = restartClocks(target);
        if (statuses.length) {
          effect.restarted = [{ target: target.id, statuses }];
          state.message += ` ${statuses.map(id => TIMED[id].name).join(' y ')}: ${statuses.length > 1 ? 'vuelven' : 'vuelve'} a empezar.`;
        }
      }
      // Telemetría gives Bip's own Atacar a few seconds more on the same clocks.
      const telemetry = action === 'attack' && effect.amount > 0 && passive(state, actor, 'telemetria');
      if (telemetry && target.hp > 0) {
        // The water's own Mojado and Hundido last as long as it does: the water's clock is the one that grows.
        const longer = TIMED_IDS.filter(id => !TIMED[id].heal && target.timed?.[id] && !(target.timed.agua && (id === 'mojado' || id === 'hundido')));
        for (const id of longer) target.timed![id]!.left += TELEMETRIA;
        if (longer.length) {
          effect.extended = { statuses: longer, seconds: TELEMETRIA };
          note(effect, 'telemetria', actor);
          state.message += ` ${longer.map(id => TIMED[id].name).join(' y ')}: ${TELEMETRIA} s más.`;
        }
      }
      // An absorbed bolt still finds the water (Conducción), and a blow that took nothing still counts for El que no converge's Error.
      iterate(state, target, landing, effect);
      // La crecida: a water blow starts its target's top mark over; Recarga raises it a mark (`raises`).
      if (landing === 'agua') refill(target);
      if (action === 'skill' && ability && 'raises' in ability) {
        const was = waterOf(target), to = raiseWater(state, actor, target, effect, ability.raises);
        if (to !== undefined) state.message += to > was ? ` Agua ${roman(to)}.${to >= CRECIDA.marks ? ' ¡Hundido!' : ''}` : ' El agua vuelve a su marca.';
        else if (frozenOf(target)) state.message += ' Su agua es hielo: no sube.';
      }
      // Cortocircuito: the current stays in its target and jumps nowhere.
      // Cortocircuito: on someone wet or about to move the current stays in them and jumps nowhere (no Tormenta, no
      // Conducción; what is on them still turns: powder, a fire); on anyone else it is a bolt like any other.
      if (action === 'skill' && ability && 'short' in ability && shortCircuit(state, target, effect)) react(state, actor, target, 'electrico', effect, false, true);
      else if (element) react(state, actor, target, element, effect, action === 'skill');
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
      // Combustión: a physical blow (Atacar, a claw, a die, Bip's ram) on a fire at IV makes it burst.
      if (!magic && effect.amount > 0) combust(state, actor, target, effect);
      // Virus atómico: the swarm gets in; from now on what lands on it lands on the others.
      if (action === 'skill' && ability && 'infect' in ability && target.hp > 0) {
        target.timed = { ...target.timed, virus: { level: 1, left: TIMED.virus.seconds, next: TIMED.virus.every } };
        target.virusSeen = seen(target);
        effect.afflicted = { id: 'virus', level: 1 };
        state.message += ' ¡Virus! Lo que reciba se contagia a los demás.';
      }
      // Atractor extraño: the others' statuses on the clock come to it.
      if (action === 'skill' && ability && 'gathers' in ability) gather(state, actor, target, effect);
    }
  }
  if (skill === 'punado' && target && state.foes.includes(target) && target.hp > 0 && effect.amount && !effect.annulled) {
    kindle(target, 'empolvado', 1);
    effect.afflicted = { id: 'empolvado', level: 1 };
  }
  // Ostinato and Bordón: what it did stays in the air as an eco, on the foe it struck or the ally it cured.
  if (action === 'skill' && ability && 'eco' in ability && target && !effect.annulled && (ability.kind === 'heal' ? state.allies.includes(target) : state.foes.includes(target)))
    callEco(state, actor, ability.kind === 'heal' ? 'bordon' : 'ostinato', target.id, effect);
  // Tutti: every eco sounds its last note, twice as strong, and goes out.
  if (action === 'skill' && ability && 'tutti' in ability) lastNotes(state, effect);
  // Estrella fugaz: with Racha enough it spends it and deals dice, as far as the hand has room, whatever became of the blow.
  if (action === 'skill' && ability && 'star' in ability && rachaOf(actor) >= RACHA.star) {
    actor.racha! -= RACHA.star; effect.starred = RACHA.star;
    const got = adjustResource({ current: actor.secondary, max: actor.maxSecondary }, RACHA.deal).amount;
    actor.secondary += got;
    if (got) effect.dealt = diceOf(state, actor).slice(-got);
    state.message += got ? ` La racha se gasta: ${got === 1 ? 'un dado más' : `${got} dados más`}.` : ' La racha se gasta, pero la mano está llena.';
  }
  if (rachaOf(actor) !== streak) effect.racha = rachaOf(actor);
  // The meteor grows only by being used again on the wearer's next turn: anything else puts it back.
  if (actor.classId === DICED) {
    const before = meteorOf(actor), stage = action === 'skill' && ability && 'meteor' in ability ? ability.meteor : undefined;
    actor.meteor = stage === undefined || stage >= 2 ? 0 : stage + 1;
    if (meteorOf(actor) !== before) effect.meteor = meteorOf(actor);
  }
  // In Diverge, El que no converge comes out of the blow that converged it soaked: the next bolt is Conducción.
  if (effect.converged) for (const f of state.foes) if (f.kind === 'no-converge' && f.diverged && f.hp > 0) soak(f);
  // Sincopante: an Ostinato eco whose foe fell goes for the next one its wearer strikes; an eco at this fighter's
  // side repeats the blow (Acompañamiento); acted in the off-beat, their ecos sound once more (A contratiempo).
  if (target && state.foes.includes(target) && target.hp > 0) for (const e of ecosOf(state, actor)) if (e.kind === 'ostinato' && !state.foes.some(f => f.id === e.target && f.hp > 0)) e.target = target.id;
  accompany(state, actor, effect); offbeatNotes(state, actor, effect);
  // Bajo cero's ice takes the blows that reached it, and whoever held the water may have fallen (reflected magic).
  if (action === 'attack' || (action === 'skill' && ability && ability.kind !== 'heal' && !('freezes' in ability))) {
    chill(state, actor, effect, iceBlows(effect, action === 'attack' ? 'physical' : ability!.kind, action === 'attack' ? 18 : ability!.power, action === 'attack' ? attackElement(state, actor) : elementOf(ability), action === 'skill' && !!ability && 'strikes' in ability));
  }
  holdWater(state, effect);
  cortinaSay(state, effect, target && state.foes.includes(target) ? target : undefined);
  livesSay(state, effect);
  spread(state, effect); wallSay(state, effect);
  amplify(effect); checkEye(state, effect);
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
export function dualTargets(state: BattleState, d: DualSpec): Combatant[] {
  if (d.side === 'allies') return d.kind === 'heal' ? validTargets(state, 'skill', 'cardioide') : state.allies.filter(a => a.hp > 0);
  const foes = validTargets(state, 'attack');
  // A fuse, or an eco in its head: on a whole foe, never on a part of one.
  return d.id === 'reserva-de-color' || d.kind === 'eco' ? foes.filter(f => !f.part) : foes;
}
/**
 * Whether a dual goes to one fighter picked (a foe, or an ally as Sutura de luz and Trampantojo do), so
 * both players have to pick the same one; one on every foe or on the whole party (Vulcano, Suceso
 * seguro) has nobody to agree on.
 */
export const dualSingle = (d: DualSpec) => d.side === 'foes' || (d.side === 'allies' && d.parts.some(aimed));

export function dualBlock(state: BattleState, d: DualSpec, a: Combatant, b?: Combatant): DualBlock | undefined {
  if (!d.parts.every(id => learned(state, id))) return 'level';
  // A dúo mayor needs its node at the jar as well.
  if (d.major && !state.improved?.duals?.includes(d.id) && !state.unbound) return 'level';
  if (state.usedDuals?.includes(d.id) && !state.unbound) return 'used';
  if (!b) return 'acted';
  if (b.hp <= 0) return 'down';
  const halves = halvesOf(d, a, b);
  if (!halves) return 'wear';
  if (state.phase !== 'player' || state.allies[state.active] !== a || a === b || state.spent?.includes(a.id) || state.spent?.includes(b.id)) return 'acted';
  const cost = dualCost(d);
  if (!state.unbound && (a.secondary < cost[halves[0]]! || b.secondary < cost[halves[1]]!)) return 'mana';
  if (!dualTargets(state, d).length) return 'target';
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
export function actDual(state: BattleState, id: DualId, targetId?: string, die?: number): BattleEffect | undefined {
  const effect = dualAct(state, id, targetId, die);
  if (!effect?.dual) return effect;
  // A dual is an action like any other for Sincopante: an eco at either one's side repeats it once, a wearer of it in
  // the off-beat makes theirs sound again, and Pedal ends for both.
  const pair = effect.dual.actors.map(who => state.allies.find(a => a.id === who)!);
  for (const c of pair) delete c.pedal;
  const accompanied = pair.find(c => state.ecos?.some(e => e.kind === 'acompanamiento' && e.target === c.id));
  if (accompanied) accompany(state, accompanied, effect);
  for (const c of pair) offbeatNotes(state, c, effect);
  if (beaten(state) && state.phase !== 'won') { state.phase = 'won'; state.message = winMessage(state); endFight(state); }
  return effect;
}
function dualAct(state: BattleState, id: DualId, targetId?: string, die?: number): BattleEffect | undefined {
  const d = DUALS.find(x => x.id === id), a = state.allies[state.active], b = dualPartner(state);
  if (state.phase !== 'player' || !d || !a || !b || dualBlock(state, d, a, b)) return;
  const halves = halvesOf(d, a, b)!, cost = dualCost(d), targets = dualTargets(state, d);
  const target = targets.find(f => f.id === targetId) ?? targets[0];
  if (d.side === 'allies' && targetId && target.id !== targetId) return;
  const roller = [a, b].find(wearer => wearer.classId === DICED);
  // Cadáver exquisito: with a Racha of three before its die is spent, luck is no longer needed.
  const streak = roller ? rachaOf(roller) >= 3 : false;
  if (roller) {
    const hand = diceOf(state, roller);
    const at = die ?? (roller === b ? state.queued?.[b.id]?.die : undefined) ?? hand.length - 1;
    if (!Number.isInteger(at) || at < 0 || at >= hand.length) return;
    hand.splice(at, 1);
    roller.racha = rachaOf(roller) + 1;
  }
  spendSecondary(a, cost[halves[0]]!); spendSecondary(b, cost[halves[1]]!);
  // A dual is not the meteor: it goes back to its first size.
  delete a.meteor; delete b.meteor;
  took(state, a); took(state, b);
  if (state.song) { a.guarding = false; b.guarding = false; }
  // A dual calls the Comodín: the next die dealt to either of them (the hand is brought in step first, so it is a die still to come).
  for (const c of [a, b]) if (kitIn(state, c).includes(DICED)) { diceOf(state, c); c.comodinDue = true; }
  (state.spent ??= []).push(b.id);
  (state.usedDuals ??= []).push(d.id);
  if (state.queued) delete state.queued[b.id];
  const parts = halves.map(h => SKILLS.find(s => s.id === h)!);
  const striker = [a, b][Math.max(0, parts.findIndex(p => p.kind === d.kind))];
  const effect: BattleEffect = { actor: a.id, kind: 'skill', target: target.id, dual: { id: d.id, name: d.name, parts: [...halves], actors: [a.id, b.id], spent: { [a.id]: cost[halves[0]]!, [b.id]: cost[halves[1]]! } } };
  const melts = parts.some(p => 'melts' in p) || elementOf(d) === 'fuego';
  if (d.kind === 'heal') {
    effect.healed = true;
    effect.amount = changeHealth(target, healing(d.power, target.maxHp));
    target.suture = true;
    state.message = `Sutura de luz cura a ${target.name}. El hilo amortiguará el siguiente daño.`;
    settle(state);
    return effect;
  }
  if (d.id === 'suceso-seguro') {
    // Both boosts at once, as if each had been cast, and luck worked out until the end of the next round.
    const until = state.round + BOOST_ROUNDS - 1;
    state.boosts = { ...state.boosts, analisis: { amount: SKILLS.find(x => x.id === 'analisis')!.power, until }, 'ases-en-duo': { amount: 0, until } };
    state.certain = state.round + 1;
    effect.boosted = state.allies.filter(c => c.hp > 0).map(c => c.id);
    effect.stats = effect.boosted.map(who => ({ target: who, way: 'up' as const, stats: ['fuerza', 'magia', 'critico'] as (keyof Stats)[] }));
    state.message = `¡Ataque dual! ${d.name}: ${statNames(['fuerza', 'magia', 'critico'])} de todo el equipo suben ${BOOST_ROUNDS} rondas. Hasta el final de la ronda siguiente, cada golpe es un golpe crítico.`;
    settle(state);
    return effect;
  }
  if (d.id === 'caleidoscopio') {
    raiseBits(state, d.power, true);
    effect.bits = { raised: d.power };
    state.message = `¡Ataque dual! ${d.name}: una cúpula de espejos sobre el equipo, ${d.power} PV durante ${BITS.rounds} rondas. Lo que pare, lo devuelve.`;
    settle(state);
    return effect;
  }
  if (d.id === 'trampantojo') {
    raiseCortina(state, target, effect);
    target.decoy = true;
    state.message = `¡Ataque dual! ${d.name}: una cortina con la figura de ${target.name}. Quien la rompa no sabrá de qué lado está.`;
    settle(state);
    return effect;
  }
  if (d.id === 'idea-fija') {
    // No blow now: the eco is in its head, and it forgets what it was going to do.
    delete target.intent;
    lay(target, 'idea-fija');
    effect.left = { id: 'idea-fija', targets: [target.id] };
    state.message = `¡Ataque dual! ${d.name}: un eco queda sonando dentro de ${target.name}. Cada ${TIMED['idea-fija'].every} segundos golpeará a uno de los suyos.`;
    settle(state);
    return effect;
  }
  if (d.id === 'reserva-de-color') {
    target.fuse = striker.id;
    kindle(target, 'empolvado', 1);
    state.message = `La mecha prende en ${target.name}.`;
    settle(state);
    return effect;
  }
  if (d.charge) {
    // Its turn it only charges up: whoever brings its first half holds it, and it goes off as the next round starts.
    const holder = halves[0] === d.parts[0] ? a : b;
    holder.charge = { dual: d.id, striker: striker.id };
    effect.charging = holder.id; delete effect.target;
    state.message = `¡Ataque dual! ${d.name}: ${holder.name} se carga. Saldrá al empezar la siguiente ronda.`;
    amplify(effect); checkEye(state, effect);
    settle(state);
    return effect;
  }
  if (d.side === 'all-foes') {
    // On every foe at once: Vulcano and Sobrecalentamiento.
    state.message = `¡Ataque dual! ${d.name}.`;
    const standing = state.foes.filter(f => f.hp > 0);
    let steamed = 0;
    effect.hits = standing.map(foe => {
      const amount = hurt(state, foe, fearDamage(state, foe, dualBlow(d, current(state, striker), current(state, foe)) * affinityScale(foe, elementOf(d)), 'dual'));
      if (melts && foe.shell) foe.shell = false;
      const hit: NonNullable<BattleEffect['hits']>[number] = { target: foe.id, amount, ...amount > 0 && affinityOf(foe, elementOf(d)) ? { affinity: affinityOf(foe, elementOf(d)) } : {} };
      if (foe.hp <= 0 || foe.layers) return hit;
      if (d.burn && foe.timed?.mojado) { steamed = steam(foe); return { ...hit, burn: { id: 'cegado' as const, level: steamed }, smoked: true as const }; }
      if (d.burn) {
        const on = foe.timed?.quemado, level = Math.min(fireTop(state), Math.max(d.burnLevel ?? 1, on ? on.level + (d.volcano ? 1 : 0) : 0));
        foe.timed = { ...foe.timed, quemado: { level, left: TIMED.quemado.seconds, next: on?.next ?? TIMED.quemado.every } };
        hit.burn = { id: 'quemado', level };
      }
      if (d.volcano) foe.timed = { ...foe.timed, volcan: { level: 1, left: TIMED.volcan.seconds, next: TIMED.volcan.every } };
      // Water on a burning foe puts its fire out, as anywhere (Humo).
      if (d.element === 'agua' && foe.timed?.quemado) smoke(foe);
      if (d.element === 'agua') refill(foe);
      if (d.bleed) hit.status = { id: 'sangrado', stacks: cut(state, foe, d.bleed) };
      // Fulgurita: the bolt fuses whatever powder is on them, and what was not, into shards.
      if (d.id === 'fulgurita') { delete foe.timed?.empolvado; foe.timed = { ...foe.timed, cristalizado: { level: foe.timed?.cristalizado?.level ?? 1, left: TIMED.cristalizado.seconds, next: TIMED.cristalizado.every } }; hit.burn = { id: 'cristalizado', level: 1 }; }
      if (d.leaves && d.id !== 'marea') lay(foe, d.leaves);
      return hit;
    });
    if (d.id === 'marea') {
      // Every water to the highest and a mark more, raised by whoever wears Freática (they hold it); then the cells are joined.
      const holder = [a, b].find(c => c.classId === 'freatica') ?? striker, wet = standing.filter(f => f.hp > 0 && !frozenOf(f));
      const top = Math.min(CRECIDA.marks, Math.max(0, ...wet.map(waterOf)) + 1);
      for (const foe of wet) if (waterOf(foe) < top) raiseWater(state, holder, foe, effect, top - waterOf(foe)); else refill(foe);
      for (const foe of wet) lay(foe, 'marea');
      state.message += ` El agua de todos sube a ${roman(top)} y queda comunicada.`;
    }
    if (d.leaves) effect.left = { id: d.leaves, targets: standing.filter(f => f.hp > 0 && f.timed?.[d.leaves!]).map(f => f.id) };
    if (d.id === 'fulgurita') { powderTurned(state, 'cristal', effect); state.message += ' El polvo y la arena se funden en vidrio: sus esquirlas cuentan juntas.'; }
    if (d.id === 'metralla') state.message += ' Las esquirlas se quedan en las heridas: no se cierran.';
    if (d.id === 'seiche') state.message += ' Un eco se queda meciendo el agua.';
    if (steamed) effect.reaction = { id: 'vapor', level: steamed };
    effect.amount = effect.hits[0]?.amount;
    state.message += ` Todos reciben: ${effect.hits.map(h => `−${h.amount}`).join(', ')} PV.`;
    if (d.volcano) state.message += ' Un volcán se levanta entre ellos: cada 5 segundos les sube el fuego.';
    chill(state, striker, effect, iceBlows(effect, d.kind, d.power, elementOf(d), !!d.strikes));
    spread(state, effect); amplify(effect); checkEye(state, effect);
    settle(state);
    return effect;
  }
  state.message = `¡Ataque dual! ${d.name} contra ${target.name}.`;
  const eaten = annulled(state, a, elementOf(d), d.kind);
  if (eaten) {
    effect.amount = 0; effect.annulled = eaten;
    state.message += ` ${annulledText(eaten)}`;
  } else if (target.shell && !melts) {
    effect.amount = 0; effect.swallowed = true;
    state.message += ' El chicle se lo traga. Ni un rasguño.';
  } else {
    if (melts && target.shell) { target.shell = false; effect.melted = true; state.message += ' El pringue se derrite.'; }
    const layered = target.layers ?? 0, strikes: number[] = [], coins: (0 | 1)[] = [], burns: number[] = [];
    // A dual that cuts piles its own stacks on the wound and spends none (Staccato).
    const { bled, scale } = wound(target, d.kind === 'physical' && !d.bleed, id === 'relevo-de-sangre' ? 'llaga' : undefined), weak = weakScale(state, target), chance = d.burnChance ?? 1;
    // Géiser: a blow for each mark of the water under it, all of it spent. Cadáver exquisito: three elements nobody chose.
    const marks = id === 'geiser' ? waterOf(target) : 0, blows = id === 'geiser' ? Math.max(1, marks) : d.strikes ?? 1;
    const drawn: Element[] = id === 'cadaver-exquisito' ? exquisite(state, blows, streak) : [];
    let fire: Timed | undefined;
    const sure = sureCrit(state, bled, effect), crits: boolean[] = [];
    for (let i = 0; i < blows && target.hp > 0; i++) {
      const crit = critical(state, striker, target, sure && i === 0);
      const dealt = hurt(state, target, fearDamage(state, target, dualBlow(d, current(state, striker), current(state, target)) * (scale + (crit ? CRIT_RULES.bonus : 0)) * weak * affinityScale(target, elementOf(d)), 'dual'));
      strikes.push(dealt); crits.push(crit && dealt > 0);
      // Cadáver exquisito: the handful powders, and the element it carried finds that powder at once.
      if (drawn[i] && dealt > 0) { kindle(target, 'empolvado', 1); powder(state, striker, target, drawn[i], effect); (effect.drawn ??= []).push(drawn[i]); }
      if (dealt > 0 && affinityOf(target, elementOf(d))) effect.affinity = affinityOf(target, elementOf(d));
      if (target.layers && !--target.layers) bare(target);
      if (!d.burn) continue;
      // Fire never catches on wet layers; each strike checks after its own peel.
      const coin = dealt > 0 && target.hp > 0 && !target.layers && (chance >= 1 || roll(state) < chance) ? 1 : 0;
      if (coin) fire = inflict(target, d.burn, fireTop(state));
      coins.push(coin); burns.push(coin ? fire!.level : 0);
    }
    if (bled) { closeWound(target); effect.bled = bled; }
    if (crits.some(Boolean)) { effect.crit = true; if (crits.length > 1) effect.crits = crits; }
    if (elementOf(d)) powder(state, striker, target, elementOf(d)!, effect);
    if (d.bleed && target.hp > 0 && strikes.some(n => n > 0)) effect.status = { id: 'sangrado', stacks: cut(state, target, d.bleed) };
    if (d.leaves && target.hp > 0) { lay(target, d.leaves); effect.left = { id: d.leaves, targets: [target.id] }; }
    if (id === 'geiser') {
      // All its water goes up in steam, and the steam is everyone's: Cegado on every foe.
      if (marks) lowerWater(target, marks, effect);
      effect.vapour = state.foes.filter(f => f.hp > 0 && !f.part).map(f => { blind(f); return f.id; });
      effect.reaction = { id: 'vapor', level: 1 };
    }
    if (id === 'a-escala' && target.hp > 0) {
      target.timed = { ...target.timed, encogido: { level: 1, left: SCALE_SECONDS, next: SCALE_SECONDS } };
      effect.afflicted = { id: 'encogido', level: 1 };
      effect.stats = [{ target: target.id, way: 'down', stats: ['defensa'] }];
      raiseWater(state, [a, b].find(c => c.classId === 'freatica') ?? striker, target, effect);
    }
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
    if (effect.vapour) state.message += ` ${marks ? 'Su agua se va entera en vapor' : 'El vapor lo llena todo'}: ¡${TIMED.cegado.name}s todos!`;
    if (id === 'a-escala' && target.hp > 0) state.message += ` ¡Se encoge! El agua le llega a ${roman(waterOf(target))}${target.timed?.hundido ? ': ¡hundido!' : '.'}`;
    if (id === 'staccato' && target.hp > 0) state.message += ' Un eco se queda cortando.';
    if (peeled && !target.layers && target.hp > 0) effect.stats = [{ target: target.id, way: 'down', stats: ['defensa'] }];
    if (peeled) state.message += !target.layers ? ' ¡Sin capas!' : peeled > 1 ? ` ${peeled} capas menos: quedan ${target.layers}.` : ` Una capa menos: quedan ${target.layers}.`;
    if (bled) state.message += ` La herida se abre: +${Math.round((scale - 1) * 100)} %.`;
    if (fire && target.hp > 0) state.message += fire.level > 1 ? ` ¡El fuego sube: ${TIMED[d.burn!].name} ${roman(fire.level)}!` : ' ¡Se quema!';
    else if (d.burn && target.hp > 0 && target.layers) state.message += ' Las capas, húmedas, no prenden.';
    if (d.kind === 'physical' && effect.amount > 0) combust(state, striker, target, effect);
    if (id === 'relevo-de-sangre' && bled && !target.hp) {
      const next = state.foes.filter(f => f.hp > 0 && !f.part).sort((x, y) => y.hp - x.hp)[0];
      if (next) {
        addStatus(next, 'sangrado', bled);
        next.cutRound = state.round;
        effect.relay = { target: next.id, stacks: bled };
        state.message += ` La herida pasa a ${next.name}.`;
      }
    }
    if (d.weakSpot && target.hp > 0) {
      target.weakSpot = state.round + 1; effect.weakSpot = spent ? 'renewed' : 'set';
      state.message += ' ¡Punto débil! El siguiente golpe que reciba hará el triple de daño.';
    }
    chill(state, striker, effect, iceBlows(effect, d.kind, d.power, elementOf(d), !!d.strikes));
  }
  amplify(effect); checkEye(state, effect);
  settle(state);
  return effect;
}
/** A escala: how long its target stays shrunk (longer than Rayo encogedor's, so the water has time to rise). */
export const SCALE_SECONDS = 20;
/** Idea fija: the base power of the blow its carrier lands on one of its own each beat, with its own Fuerza (Control remoto's). */
export const IDEA_FIJA = 34;
/** A timed status a dual leaves on `c`, from its whole time. */
function lay(c: Combatant, id: TimedId) {
  c.timed = { ...c.timed, [id]: { level: 1, left: TIMED[id].seconds, next: TIMED[id].every } };
}
/** Cadáver exquisito: an element for each of its `n` handfuls, by the fight's dice; with `sure`, no two alike. */
function exquisite(state: BattleState, n: number, sure: boolean): Element[] {
  const all: Element[] = ['fuego', 'agua', 'electrico'];
  if (!sure) return Array.from({ length: n }, () => all[Math.floor(roll(state) * all.length)]);
  const bag = [...all], out: Element[] = [];
  while (out.length < n) { if (!bag.length) bag.push(...all); out.push(bag.splice(Math.floor(roll(state) * bag.length), 1)[0]); }
  return out;
}
/** A dual's blow at average stats, by its kind. */
const dualBlow = (d: DualSpec, attacker: Stats, target: Stats) => d.kind === 'magic' ? magical(d.power, attacker, target) : physical(d.power, attacker, target);
/** A fire lit at `level` at least (Rayo solar's Quemado II); one already higher stays, its clock starting over. */
function kindle(c: Combatant, id: TimedId, level: number): Timed {
  const spec = TIMED[id], on = c.timed?.[id];
  const timed = { level: Math.min(Math.max(1, spec.levels.length), Math.max(level, on?.level ?? 0)), left: spec.seconds, next: on?.next ?? spec.every };
  c.timed = { ...c.timed, [id]: timed };
  return timed;
}
function blast(state: BattleState, id: 'reserva-de-color' | 'bombardeo-orbital', caster: Combatant, origin: string) {
  const d = DUALS.find(spec => spec.id === id)!;
  const effect: BattleEffect = { actor: caster.id, kind: 'skill', detonation: id, target: origin, element: d.element, hits: [] };
  const blocked = annulled(state, caster, d.element, 'magic');
  if (blocked) effect.annulled = blocked;
  for (const foe of state.foes.filter(f => f.hp > 0)) {
    let amount = 0;
    for (let i = 0; !blocked && foe.hp > 0 && i < (d.strikes ?? 1); i++) {
      if (foe.shell && d.element !== 'fuego') break;
      if (foe.shell) { foe.shell = false; effect.melted = true; }
      const raw = dualBlow(d, current(state, caster), current(state, foe)) * affinityScale(foe, d.element) * weakScale(state, foe);
      amount += hurt(state, foe, fearDamage(state, foe, raw, 'dual', d.element));
      if (foe.layers && !--foe.layers) bare(foe);
    }
    if (amount && foe.weakSpot) delete foe.weakSpot;
    spendShield(state, foe, amount, effect);
    if (id === 'bombardeo-orbital' && amount && foe.hp) {
      blind(foe, ORBITAL_BLIND);
    }
    effect.hits!.push({ target: foe.id, amount });
  }
  if (!blocked && d.element) for (const foe of state.foes) powder(state, caster, foe, d.element, effect);
  amplify(effect); checkEye(state, effect);
  (state.news ??= []).push(effect);
  return d.name;
}

function ignitePaint(state: BattleState, host: Combatant) {
  const caster = state.allies.find(a => a.id === host.fuse);
  delete host.fuse;
  if (host.timed) delete host.timed.empolvado;
  if (caster) blast(state, 'reserva-de-color', caster, host.id);
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
  if (d.id === 'bombardeo-orbital') return blast(state, d.id, striker, state.foes.find(f => f.hp > 0)?.id ?? holder.id);
  const melts = d.parts.some(id => SKILLS.some(s => s.id === id && 'melts' in s)) || elementOf(d) === 'fuego';
  const effect: BattleEffect = { kind: 'skill', actor: holder.id, release: { id: d.id, name: d.name } };
  const eaten = annulled(state, holder, elementOf(d), d.kind);
  if (eaten) {
    effect.annulled = eaten;
    effect.hits = state.foes.filter(f => f.hp > 0).map(foe => ({ target: foe.id, amount: 0 }));
    effect.target = effect.hits[0]?.target; effect.amount = 0;
    (state.news ??= []).push(effect);
    return `¡${d.name}! ${annulledText(eaten)}`;
  }
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
    // Water held under a foe goes up as Vapor instead (La crecida).
    if (d.burn && foe.hp > 0 && waterOf(foe) > 0) { const level = steam(foe); return { target: foe.id, amount, burn: { id: 'cegado' as const, level }, smoked: true as const }; }
    const burn = d.burn && foe.hp > 0 && !foe.layers ? { id: d.burn, level: kindle(foe, d.burn, d.burnLevel ?? 1).level } : undefined;
    return { target: foe.id, amount, ...peeled ? { peeled } : {}, ...spends ? { weakSpot: true as const } : {}, ...burn ? { burn } : {}, ...found && amount > 0 ? { affinity: found } : {} };
  });
  if (elementOf(d)) for (const foe of state.foes) powder(state, striker, foe, elementOf(d)!, effect);
  effect.target = effect.hits[0]?.target; effect.amount = effect.hits[0]?.amount;
  chill(state, striker, effect, iceBlows(effect, d.kind, d.power, elementOf(d), !!d.strikes));
  const said = `¡${d.name}! ${holder.name} barre a todos: ${effect.hits.map(h => `−${h.amount}`).join(', ')} PV.${effect.hits.some(h => h.burn) ? ` ¡${TIMED[d.burn!].name} ${roman(d.burnLevel ?? 1)}!` : ''}`;
  amplify(effect); checkEye(state, effect);
  (state.news ??= []).push(effect);
  return said;
}
/**
 * Acecho lands (`stalk`) as the round starts, before anyone chooses: the wearer's cat on the foe she
 * waited on, or, if it fell, on whoever standing bleeds most. A high physical blow with the wearer's
 * stats, a golpe crítico for sure, that spends the foe's wound (it adds none). Its wearer fallen, or
 * out of Papagato by now: the moment is lost and nothing happens. Kept as news (`takeNews`).
 */
function pounce(state: BattleState, holder: Combatant) {
  const stalk = holder.stalk!;
  delete holder.stalk;
  const ability = SKILLS.find(s => s.id === 'acecho')!;
  const standing = state.foes.filter(f => f.hp > 0);
  const target = standing.find(f => f.id === stalk.target) ?? [...standing].sort((a, b) => stacks(b, 'sangrado') - stacks(a, 'sangrado'))[0];
  if (holder.hp <= 0 || holder.classId !== ability.class || !target) return;
  dug.length = 0; met.length = 0; screenTook.length = 0;
  const effect: BattleEffect = { kind: 'skill', actor: holder.id, skill: 'acecho', target: target.id, pounce: true };
  let said: string;
  const light = annulled(state, holder, undefined, 'physical');
  if (light) { effect.amount = 0; effect.annulled = light; said = `¡${ability.name}! ${annulledText(light)}`; }
  else if (target.shell) { effect.amount = 0; effect.swallowed = true; said = `¡${ability.name}! El chicle de ${target.name} se lo traga.`; }
  else if (singing(state, target)) { effect.amount = 0; effect.sung = true; said = `¡${ability.name}! Atraviesa a ${target.name} mientras canta.`; }
  else {
    const layered = target.layers ?? 0, { bled, scale } = wound(target, true, 'acecho'), weak = weakScale(state, target), chord = chordScale(state, holder, target);
    // For sure, whatever the foe has: spending a wound of five or more still says Olor a sangre, and wakes Siete vidas.
    sureCrit(state, bled, effect);
    effect.crit = true;
    effect.amount = hurt(state, target, fearDamage(state, target, strike(state, holder, target, ability) * (scale + CRIT_RULES.bonus) * weak * chord * affinityScale(target, undefined), 'physical'));
    if (target.layers && !--target.layers) bare(target);
    if (bled) { closeWound(target); effect.bled = bled; }
    landed(state, holder, target, effect.amount, chord, effect);
    const spent = weak > 1 && effect.amount > 0;
    if (spent) { delete target.weakSpot; effect.weakSpot = 'spent'; }
    spendShield(state, target, effect.amount, effect);
    const peeled = layered - (target.layers ?? 0);
    if (peeled) { effect.peeled = peeled; if (!target.layers && target.hp > 0) effect.stats = [{ target: target.id, way: 'down', stats: ['defensa'] }]; }
    said = `¡${ability.name}! Cae sobre ${target.name}: −${effect.amount} PV.${spent ? ' ¡Punto débil!' : ''}${bled ? ` La herida se abre: +${Math.round((scale - 1) * 100)} %.` : ''} ¡Golpe crítico!`;
    iterate(state, target, undefined, effect);
    if (effect.amount > 0) combust(state, holder, target, effect);
    chill(state, holder, effect, iceBlows(effect, 'physical', ability.power));
  }
  spread(state, effect); amplify(effect); checkEye(state, effect);
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
  const foes = dualTargets(state, d).map(f => f.id);
  return actDual(state, d.id, [aimed(skill!) ? targetId : undefined, queued.target].find(t => t && foes.includes(t)), die ?? queued.die);
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
/**
 * Escolta: an ally Bip stands by stays guarded round after round until its last (`escort.until`); it ends sooner if whoever
 * sent Bip falls or takes Tecnópata off (Bip goes back into them).
 */
function keepEscorts(state: BattleState) {
  for (const ally of state.allies) {
    if (!ally.escort) continue;
    const by = state.allies.find(a => a.id === ally.escort!.by);
    if (ally.escort.until < state.round || ally.hp <= 0 || !by || by.hp <= 0 || by.classId !== 'tecnopata') delete ally.escort;
    else ally.guarding = true;
  }
}
/** The allies Bip stands by now (Escolta), with their PV before a foe acts. */
const escortedNow = (state: BattleState) => state.allies.filter(a => a.escort && a.hp > 0 && state.allies.some(b => b.id === a.escort!.by && b.hp > 0 && b.classId === 'tecnopata')).map(a => ({ ally: a, hp: a.hp }));
export function enemyAct(state: BattleState, id: string, targetId?: string): BattleEffect | undefined {
  if (state.phase !== 'enemy' || state.enemyActions.includes(id)) return;
  const protectedAlly = state.allies.find(a => a.suture);
  screenTook.length = 0; livesTook.length = 0; missTook.length = 0;
  const escorted = escortedNow(state);
  const effect = enemyMove(state, id, targetId);
  // Escolta: the foe that struck someone Bip stands by gets a Bomba remota (one it carries already starts over).
  const striker = state.foes.find(f => f.id === id);
  if (effect && striker && striker.hp > 0 && escorted.some(e => e.ally.hp < e.hp)) {
    plantBomb(striker); effect.planted = [...effect.planted ?? [], striker.id];
    state.message += ` Bip le pega una bomba a ${striker.name}.`;
  }
  if (effect) discharge(state, effect);
  if (effect && protectedAlly && !protectedAlly.suture) effect.sutureSpent = protectedAlly.id;
  // Whoever held the foes' water may have fallen to this: every cell breaks (La crecida).
  if (effect) holdWater(state, effect); else holdWater(state);
  if (effect) { missSay(state, effect, state.foes.find(f => f.id === id)); cortinaSay(state, effect, state.foes.find(f => f.id === id)); livesSay(state, effect); wallSay(state, effect, state.foes.find(f => f.id === id)); spread(state, effect); } else { wallTook.took = 0; wallTook.broke = false; wallTook.mirror = 0; screenTook.length = 0; livesTook.length = 0; missTook.length = 0; }
  const host = state.foes.find(f => f.id === id && f.fuse);
  if (host && state.enemyActions.includes(id)) {
    ignitePaint(state, host);
    if (!state.allies.every(a => a.hp <= 0) && beaten(state)) { state.phase = 'won'; state.message = winMessage(state); endFight(state); }
  }
  return effect;
}

function enemyMove(state: BattleState, id: string, targetId?: string): BattleEffect | undefined {
  const actor = state.foes.find(f => f.id === id && f.hp > 0);
  const alive = state.allies.filter(a => a.hp > 0);
  // A boss goes for whoever is closest to falling (`SHREWD`, src/castle.ts); everyone else takes turns, one each.
  const turn = state.round + state.foes.findIndex(f => f.id === id) - 1;
  const target = alive.find(a => a.id === targetId) ?? (actor && alive.length && SHREWD.includes(actor.kind ?? '') ? closestToFalling(alive, turn) : alive[turn % alive.length]);
  if (!actor || !target) return;
  // A part (Vertitrón's eye) has no turn of its own: it is through at once, with nothing to show.
  if (actor.part || castleIdle(actor)) { state.enemyActions.push(id); return; }
  // In Bajo cero's ice: this turn is lost, and whatever it had announced waits for it to come out.
  if (frozenOf(actor)) {
    state.enemyActions.push(id);
    state.message = `${actor.name} está congelado: pierde el turno.`;
    return { actor: actor.id, kind: 'enemy', stunned: true, iced: true };
  }
  // In Shock: this turn is lost, whatever it had announced waits for the next one.
  if (actor.shock) {
    delete actor.shock; state.enemyActions.push(id);
    state.message = `${actor.name} sigue en shock: pierde el turno.`;
    return { actor: actor.id, kind: 'enemy', stunned: true };
  }
  // A turn of its own: Cortocircuito can find it again.
  delete actor.shorted;
  // La Voz with no move of her own on this turn: her song is all she does, and the round does not wait on her.
  if (actor.kind === 'voz' && state.song && !vozMove(state, actor)) { actor.turns = (actor.turns ?? 0) + 1; state.enemyActions.push(id); return; }
  if (actor.timed?.confusion) return confusedAct(state, actor);
  if (state.encounter === 'palace-minion') return minionAct(state, actor);
  // The castle's pupils out on the Meridiana at night (`night-guard`) fight with their own moves, as inside.
  if ((FEAR_ENCOUNTERS as readonly string[]).includes(state.encounter) || isCastle(actor.kind)) return fearAct(state, actor, target);
  state.enemyActions.push(id);
  if (actor.power !== undefined) {
    // The palace guards: one heavy fist each, guarding takes two thirds off.
    const hit = misses(state, actor, target) ? 0 : physical(actor.power, current(state, actor), current(state, target));
    const amount = hit ? changeHealth(target, -(target.guarding ? Math.ceil(hit / 3) : hit)) : 0;
    state.message = `${actor.name} aplasta a ${target.name} con un puño de chicle. −${amount} PV${target.guarding ? ' · Protegido' : ''}.`;
    if (state.allies.every(a => a.hp === 0)) { state.phase = 'lost'; state.message = 'Todo se vuelve rosa… y luego negro.'; }
    return { actor: actor.id, kind: 'enemy', target: target.id, amount };
  }
  const strength = misses(state, actor, target) ? 0 : physical(state.allies.length === 1 && state.foes.length > 1 ? 5 : 9, current(state, actor), current(state, target));
  const damage = target.guarding ? Math.ceil(strength / 3) : strength;
  const amount = damage ? changeHealth(target, -damage) : 0;
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
  const amount = misses(state, actor, victim) ? 0 : hurt(state, victim, fearDamage(state, victim, physical(CONFUSED_BLOW, current(state, actor), current(state, victim)), 'physical'));
  state.message = victim === actor ? `${actor.name}, confundido, se golpea a sí mismo. −${amount} PV.` : `${actor.name}, confundido, golpea a ${victim.name}. −${amount} PV.`;
  const effect: BattleEffect = { actor: actor.id, kind: 'enemy', target: victim.id, amount, confused: true };
  if (amount > 0) combust(state, actor, victim, effect);
  amplify(effect); checkEye(state, effect);
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
export const MODELO_NAMES: Record<ModeloKind, string> = { 'celda-seca': 'Celda seca', oscilacion: 'Oscilación', atomo: 'El Átomo', 'no-converge': 'El que no converge' };
/** What each fight in the model says as it starts, and as it is won. */
const MODELO_MESSAGES: Record<ModeloEncounter, string> = {
  'modelo-celdas': 'Tres celdas de la malla se desprenden del corte. Están apagadas: huecas, grises, secas.',
  'modelo-oscilacion': 'Dos figuras parpadean entre dos valores, sin quedarse en ninguno. Una está en el que la otra acaba de dejar.',
  'modelo-atomo': 'Sobre el agua del túnel flota algo pesado: un núcleo, y tres luces girando a su alrededor, cada una en su órbita.',
  'no-converge': 'Al fondo del modelo, columnas de cifras que caen sin parar. Tienen forma de alguien. No se quedan quietas en ningún valor.',
};
const MODELO_WON: Record<ModeloEncounter, string> = {
  'modelo-celdas': 'Las celdas se apagan del todo y vuelven a su sitio en la malla. Ahora tienen un valor.',
  'modelo-oscilacion': 'Las dos figuras se quedan quietas, cada una en su valor. Luego ya no están.',
  'modelo-atomo': 'El núcleo se deshace en gotas oscuras. El agua sigue corriendo, sin nada que reaccione en ella.',
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
    const one = foe(kind === 'no-converge' || kind === 'atomo' ? kind : `${kind}-${i}`, kinds.filter(k => k === kind).length > 1 ? `${MODELO_NAMES[kind]} ${n}` : MODELO_NAMES[kind], kind);
    if (kind === 'oscilacion') one.sign = n % 2 === 1 ? 'agua' : 'electrico';
    if (kind === 'atomo') one.electrons = [...ATOM_ORDER];
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
 * Celda seca, two fifths while dry; an Oscilación, nothing of the element it is on and more of the other;
 * El Átomo, more of an element whose electron it still has (it tears it off), less of one it has
 * lost (it takes it back), and double of what has none once it has no electrons left; El que no
 * converge, nothing of its own while it iterates, little of anything else, and more of everything
 * once converged. Ticks and pulses never come through here.
 */
function modeloTaken(target: Combatant, element?: Element) {
  if (target.kind === 'celda-seca') return target.timed?.mojado ? 1 : MODELO.seca;
  if (target.kind === 'oscilacion') return element === target.sign ? 0 : element && element === otherSign(target.sign ?? 'agua') ? MODELO.contra : MODELO.plano;
  if (target.kind === 'atomo') return element ? target.electrons?.includes(element) ? MODELO.ioniza : MODELO.captura : target.electrons?.length ? 1 : MODELO.desnudo;
  if (target.kind === 'no-converge') return target.converged ? MODELO.converge : element === target.sign ? 0 : MODELO.itera;
  return 1;
}
/** How each of El Átomo's electrons is named when it comes off or goes back («el electrón de agua»). */
const ELECTRON_OF: Record<Element, string> = { fuego: 'de fuego', agua: 'de agua', electrico: 'eléctrico' };
/** The colour a word about an electron is stamped in: its element's status. */
const ELECTRON_STATUS: Record<Element, string> = { fuego: 'quemado', agua: 'mojado', electrico: 'conduccion' };
/**
 * A blow with an element has landed on El Átomo: an electron of that element it still had comes off
 * (¡Ionizado!), one it had lost goes back to its orbit (Captura). The last one off leaves the nucleus
 * bare, and the fight says so.
 */
function ionize(state: BattleState, target: Combatant, element: Element | undefined, effect: BattleEffect) {
  if (target.kind !== 'atomo' || target.hp <= 0 || !element) return;
  const had = target.electrons ?? [];
  const call = (text: string, detail: string) => { (effect.called ??= []).push({ target: target.id, text, detail, status: ELECTRON_STATUS[element] }); };
  if (had.includes(element)) {
    target.electrons = had.filter(e => e !== element);
    effect.electron = { element, mark: 'off' };
    call('¡Ionizado!', `Pierde el electrón ${ELECTRON_OF[element]}`);
    state.message += ` ¡Ionizado! El electrón ${ELECTRON_OF[element]} se apaga y cae al agua.`;
    if (!target.electrons.length) {
      (effect.called ??= []).push({ target: target.id, text: 'Núcleo desnudo', detail: 'Sin elemento, recibe el doble' });
      state.message += ' No le queda ninguno: el núcleo está desnudo.';
    }
  } else {
    target.electrons = ATOM_ORDER.filter(e => e === element || had.includes(e));
    effect.electron = { element, mark: 'on' };
    call('Captura', `Recupera el electrón ${ELECTRON_OF[element]}`);
    state.message += ` ${target.name} lo atrapa: el electrón ${ELECTRON_OF[element]} vuelve a su órbita.`;
  }
}
/** El Átomo's turns until its Reacción: 1 means its next turn is the Reacción. None while it has no electrons. */
export const reactionIn = (c: Combatant) => c.kind === 'atomo' && c.electrons?.length ? MODELO.reaccionEvery - (c.turns ?? 0) % MODELO.reaccionEvery : 0;
/**
 * A blow has landed on El que no converge while it iterates: one of the element it is not on takes a
 * mark of Error away, one of its own adds one. At none it converges: a solid body for `convergeTurns`
 * of its own turns (in Diverge, soaked too once the blow is over, so the next bolt runs through it: `act`).
 */
function iterate(state: BattleState, target: Combatant, element: Element | undefined, effect: BattleEffect) {
  if (target.kind === 'atomo') return ionize(state, target, element, effect);
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
    const raw = magical(who === struck ? power : Math.round(power * REACTION_RULES.share), current(state, actor), current(state, who));
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
 * over one and leaves them wet (Ola); on «Eléctrico» it is a Chispa. El Átomo throws its electrons
 * (`atomTurn`). El que no converge floods everyone on «Agua» (Inunda) and shocks everyone wet on
 * «Eléctrico» (Descarga), harder for each mark of Error; converged, it does nothing at all.
 */
function modeloTurn(state: BattleState, actor: Combatant, target: Combatant, effect: BattleEffect) {
  actor.turns = (actor.turns ?? 0) + 1;
  const use = (id: FoeAbilityId) => { effect.ability = foeAbility(id); };
  const magic = (who: Combatant, power: number) => {
    const raw = magical(power, current(state, actor), current(state, who));
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
  } else if (actor.kind === 'atomo') atomTurn(state, actor, target, effect, magic);
  else if (actor.converged) {
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
/**
 * El Átomo's turn (docs/quests/emilie.md § El Átomo). Most turns, *Electrón*: the next electron it still
 * has, round ATOM_ORDER, at whoever it does most to (fire and water at someone dry, the spark at someone
 * wet, where it runs through everyone wet). Every `reaccionEvery` turns, *Reacción*: every electron it
 * has goes at everyone at once, water first, then the spark through it, then fire on whoever the spark
 * dried; what comes out depends on which are left (water and spark: everyone soaked and shocked; water
 * and fire: Vapor, blinded; no water: sparks and a burn). Bare, it only rams one (*Choque*).
 */
function atomTurn(state: BattleState, actor: Combatant, target: Combatant, effect: BattleEffect, magic: (who: Combatant, power: number) => number) {
  const use = (id: FoeAbilityId) => { effect.ability = foeAbility(id); };
  const alive = state.allies.filter(a => a.hp > 0), lit = actor.electrons ?? [];
  const wet = (a: Combatant) => !!a.timed?.mojado;
  const shocked = () => (effect.shocked ?? []).map(id => ` ¡${state.allies.find(a => a.id === id)?.name} queda en shock!`).join('');
  /** Fire on `who`: a burn if dry, Vapor if wet (the water goes, Cegado stays). */
  const burn = (who: Combatant, power: number) => {
    const amount = magic(who, power);
    if (who.hp > 0 && wet(who)) { steam(who); (effect.steamed ??= []).push(who.id); }
    else if (who.hp > 0) { kindle(who, 'quemado', 1); (effect.burnt ??= []).push(who.id); }
    return amount;
  };
  if (!lit.length) {
    use('choque');
    const raw = misses(state, actor, target) ? 0 : physical(MODELO.choque, current(state, actor), current(state, target));
    effect.amount = raw ? changeHealth(target, -(target.guarding ? Math.ceil(raw / 3) : raw)) : 0;
    state.message = `El núcleo desnudo de ${actor.name} choca contra ${target.name}. −${effect.amount} PV.`;
    return;
  }
  if ((actor.turns ?? 0) % MODELO.reaccionEvery === 0) {
    use('reaccion');
    const took = new Map<string, number>(), add = (id: string, amount: number) => took.set(id, (took.get(id) ?? 0) + amount);
    const said: string[] = [];
    effect.reacted = REACTION_ORDER.filter(e => lit.includes(e));
    for (const element of effect.reacted) {
      const standing = alive.filter(a => a.hp > 0);
      if (!standing.length) break;
      if (element === 'agua') {
        // Soaked; when the spark comes right behind, the water is only what it runs through, and says nothing of its own.
        const quiet = effect.reacted.includes('electrico');
        for (const a of standing) { add(a.id, magic(a, MODELO.reaccion)); if (a.hp > 0) { soak(a); if (!quiet) (effect.wetted ??= []).push(a.id); } }
        said.push('el agua os empapa a todos');
      } else if (element === 'electrico') {
        const dry = standing.filter(a => !wet(a));
        if (standing.some(wet)) {
          for (const h of conduct(state, actor, wet(target) && target.hp > 0 ? target : standing.find(wet)!, MODELO.reaccionRayo, effect)) add(h.target, h.amount);
          said.push('la descarga corre por el agua');
        } else said.push('las chispas saltan sobre todos');
        for (const a of dry) add(a.id, magic(a, MODELO.reaccion));
      } else {
        for (const a of standing) add(a.id, burn(a, MODELO.reaccion));
        said.push(effect.steamed?.length && !effect.burnt?.length ? 'el fuego se va en vapor' : 'el fuego os prende');
      }
    }
    const main = took.has(target.id) ? target : alive.find(a => took.has(a.id)) ?? target;
    effect.target = main.id; effect.amount = took.get(main.id) ?? 0;
    effect.splash = [...took].filter(([id]) => id !== main.id).map(([id, amount]) => ({ target: id, amount }));
    state.message = `${actor.name} reacciona: ${said.join(', ')}. ${[...took.values()].map(n => `−${n}`).join(', ')} PV.${shocked()}`;
    return;
  }
  // Electrón: the next one round from the last it threw.
  const from = actor.thrown ? ATOM_ORDER.indexOf(actor.thrown) + 1 : 0;
  const element = [...ATOM_ORDER.slice(from), ...ATOM_ORDER.slice(0, from)].find(e => lit.includes(e))!;
  actor.thrown = element;
  use('electron'); effect.element = element;
  const at = element === 'electrico' ? alive.find(wet) ?? target : wet(target) ? alive.find(a => !wet(a)) ?? target : target;
  effect.target = at.id;
  if (element === 'electrico' && wet(at)) {
    const hits = conduct(state, actor, at, MODELO.conduce, effect);
    state.message = `${actor.name} lanza su electrón eléctrico a ${at.name}, y corre por el agua. ${hits.map(h => `−${h.amount}`).join(', ')} PV.${shocked()}`;
  } else if (element === 'electrico') {
    effect.amount = magic(at, MODELO.chispa);
    state.message = `${actor.name} lanza su electrón eléctrico a ${at.name}. −${effect.amount} PV.`;
  } else if (element === 'agua') {
    effect.amount = magic(at, MODELO.electron);
    if (at.hp > 0) { soak(at); effect.wetted = [at.id]; }
    state.message = `${actor.name} lanza su electrón de agua a ${at.name}. −${effect.amount} PV.${effect.wetted ? ' ¡Mojado!' : ''}`;
  } else {
    effect.amount = burn(at, MODELO.electron);
    state.message = `${actor.name} lanza su electrón de fuego a ${at.name}. −${effect.amount} PV.${effect.burnt ? ' ¡Quemado!' : effect.steamed ? ' El agua se va en vapor.' : ''}`;
  }
}
/** The end of a round in the model: every Oscilación standing, and El que no converge while it iterates, goes to its other value. */
function modeloRoundEnd(state: BattleState) {
  for (const f of state.foes) if (f.hp > 0 && f.sign && (f.kind === 'oscilacion' || (f.kind === 'no-converge' && !f.converged))) f.sign = otherSign(f.sign);
}
/** Càmping Eurocamping's foes, by name (more than one of a kind are numbered). */
export const CAMPING_NAMES: Record<CampingKind, string> = { mago: 'Mago de camping', dado: 'Dado', agente: 'Agente', campeon: 'El Campeón' };
/** What each campsite fight says as it starts, and as it is won. */
const CAMPING_MESSAGES: Record<CampingEncounter, string> = {
  'camping-magos': 'Junto a la barrera se levantan dos figuras con túnicas de lona vieja y una linterna frontal encendida. Huele a gas.',
  'camping-dados': 'Tres dados del tamaño de una persona ruedan por la tierra y se paran delante de vosotros. Los puntos, quemados.',
  'camping-agentes': 'Dos figuras de cartón se despegan de la tienda. Una os enseña la cara; la otra, la espalda.',
  'camping-tienda': 'La tienda se abre sola. Dentro no había nadie: un dado y dos agentes de cartón, esperando.',
  'camping-negra': 'Todos los farolillos se apagan a la vez. En la oscuridad se encienden dos linternas frontales, y algo rueda hacia vosotros.',
  campeon: 'Al borde de la piscina, el villano del juego de superhéroes, del tamaño de un hombre. Se le enciende la rejilla del pecho.',
};
const CAMPING_WON: Record<CampingEncounter, string> = {
  'camping-magos': 'Las túnicas caen vacías sobre la tierra. Las linternas siguen encendidas un momento, y se apagan.',
  'camping-dados': 'Los dados se quedan quietos, cada uno con una cara hacia arriba. Ya no cuentan nada.',
  'camping-agentes': 'Los agentes se doblan por la mitad y se quedan boca abajo. Nadie ha dicho la contraseña.',
  'camping-tienda': 'La tienda se cierra sola. Dentro vuelve a no haber nadie.',
  'camping-negra': 'Los farolillos vuelven a encenderse, uno a uno. El tablero empieza otra vez.',
  campeon: 'A El Campeón se le apaga la rejilla del pecho. Cae de rodillas al borde de la piscina y se queda quieto, como una ficha tumbada.',
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
    if (kind === 'campeon') one.plan = 0;
    return one;
  });
  const unlocked = animas ?? wornAnimas(party), allies = lineUp(party, unlocked);
  // El Campeón comes out aiming his first Rayo at whoever leads.
  const champion = foes.find(f => f.kind === 'campeon'), first = allies.find(a => a.hp > 0);
  if (champion && first) champion.intent = { ability: 'rayo-guantelete', target: first.id };
  return {
    allies, foes,
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
    // La Voz sings at someone from her first note: whoever strikes her takes it from them.
    if (kind === 'voz') one.facing = first;
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
    const raw = physical(MARTA.estallido, current(state, glass), current(state, who));
    return changeHealth(who, -Math.min(who.hp - 1, Math.round((who.guarding ? Math.ceil(raw / 3) : raw) * foeBlow(who))), false, true);
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
  // La Voz remembers whoever touched her last: she sings the next turn of her phrase at them (`runSong`). Someone fallen is sung at no more.
  const voz = state.foes.find(f => f.kind === 'voz' && f.hp > 0);
  if (voz && effect && effect.kind !== 'enemy' && state.allies.some(a => a.id === effect.actor && a.hp > 0)
    && ((effect.target === voz.id && (effect.amount ?? 0) > 0) || effect.hits?.some(h => h.target === voz.id && h.amount > 0))) voz.struck = effect.actor;
  // A blow that went through her while she sang angers her: her next note goes at whoever did it, harder (Enfado).
  if (voz && effect && effect.kind !== 'enemy' && effect.angered === undefined && state.allies.some(a => a.id === effect.actor && a.hp > 0)
    && (effect.sung || (singing(state, voz) && effect.hits?.some(h => h.target === voz.id && h.amount === 0)))) {
    const level = Math.min(MARTA.enfadoMost, (voz.enfado?.level ?? 0) + 1);
    voz.enfado = { at: effect.actor, level };
    effect.angered = level;
    state.message = `${state.message} ${voz.name} se enfada${level > 1 ? ' más' : ''}: su siguiente nota irá a por ${state.allies.find(a => a.id === effect.actor)!.name}.`;
  }
  if (voz && !state.allies.some(a => a.id === voz.facing && a.hp > 0)) voz.facing = state.allies.find(a => a.hp > 0)?.id;
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
 * Voz's song is what she does (`runSong`); her own turns are her part's VOZ_TURNS: in Allegro a second
 * voice, once (Coro), which sings at whoever she does not; in A capela a breath and the Calderón it was for.
 */
function cuerdasTurn(state: BattleState, actor: Combatant, target: Combatant, effect: BattleEffect, hit: Hit) {
  const turn = actor.turns ?? 0;
  actor.turns = turn + 1;
  const use = (id: FoeAbilityId) => { effect.ability = foeAbility(id); };
  const alive = state.allies.filter(a => a.hp > 0);
  const zap: Hit = (who, power) => {
    const raw = magical(power, current(state, actor), current(state, who));
    return changeHealth(who, -(who.guarding ? Math.ceil(raw / 3) : raw));
  };
  /** Whom it said, if still standing; and who is next (next round's turn order). */
  const named = () => alive.find(a => a.id === actor.intent?.target) ?? target;
  const next = () => SHREWD.includes(actor.kind ?? '') ? closestToFalling(alive, state.round + state.foes.indexOf(actor)) : alive[(state.round + state.foes.indexOf(actor)) % alive.length];
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
    // It repeats the blow La Lealtad swore, on the same one; alone, on whoever is in front. La Voz's
    // second voice sings at the one she is not singing at.
    const lealtad = state.foes.find(f => f.kind === 'lealtad' && f.hp > 0), voz = state.foes.find(f => f.kind === 'voz' && f.hp > 0);
    const who = (lealtad && alive.find(a => a.id === lealtad.sworn)) || (voz && alive.find(a => a.id !== voz.facing)) || target;
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
    const move = vozMove(state, actor, turn)!;
    use(move);
    if (move === 'coro') {
      // Coro: a second voice beside her, an Eco in all but name. It can be struck at any moment, and waits for the next round.
      delete effect.target; delete actor.intent;
      const second = grow(foe(SECOND_VOICE, 'Segunda voz', 'eco', MARTA.coro), state.grown, growthOf(state.encounter));
      state.foes.push(second); state.enemyActions.push(second.id);
      effect.summoned = second.id;
      state.message = `${actor.name} canta, y otra voz le contesta desde las cuerdas. Ya son dos.`;
    } else if (move === 'aliento') {
      // She takes a breath: the Calderón comes on her next turn, on everyone, unless an Acorde breaks it.
      delete effect.target; delete actor.winded;
      actor.intent = { ability: 'calderon', at: 'todos' };
      effect.telegraph = { id: 'calderon', name: FOE_ABILITIES.calderon.name, at: 'todos' };
      state.message = `${actor.name} toma aire, muy despacio. Todas las cuerdas se tensan hacia ella.`;
    } else {
      if (actor.intent?.ability === 'calderon') {
        onEveryone(state, effect, target, zap, MARTA.calderon);
        state.message = `${actor.name} sostiene una sola nota, y no la suelta. −${effect.amount} PV a ${target.name}.`;
      } else {
        // The breath she took is gone (an Acorde, or she forgot it): nothing comes out.
        delete effect.target; effect.cancelled = 'calderon';
        state.message = `A ${actor.name} se le ha roto la nota. Abre la boca y no sale nada.`;
      }
      delete actor.intent; delete actor.winded;
    }
  }
}
/**
 * La Voz's own move on this turn of hers (VOZ_TURNS of her part), or nothing: in Andante, in Allegro
 * once her second voice has come, and in A capela's round after the Calderón she only sings.
 */
export function vozMove(state: BattleState, voz: Combatant, turn = voz.turns ?? 0): FoeAbilityId | undefined {
  const cycle: readonly (FoeAbilityId | null)[] = VOZ_TURNS[state.song?.part ?? 'andante'];
  if (!cycle.length) return undefined;
  const move = cycle[turn % cycle.length];
  // She calls her second voice once: after that, standing or fallen, she only sings.
  if (move === 'coro' && state.foes.some(f => f.id === SECOND_VOICE)) return undefined;
  return move ?? undefined;
}
/**
 * A note La Voz starts to sing (VOZ_NOTES): its beam at whoever she is singing at, or at everyone.
 * Holding on takes two thirds off and leaves nothing on. Otherwise water wets, fire burns (or dries
 * someone wet, and does not catch), and a bolt on someone wet runs through everyone wet (Conducción,
 * turned on the party), drying them, and may leave whoever it struck in Shock.
 */
function voiceNote(state: BattleState, voz: Combatant, tone: ToneId): SongNews {
  const note = vozNote(tone), alive = state.allies.filter(a => a.hp > 0);
  const news: Extract<SongNews, { kind: 'nota' }> = { kind: 'nota', tone, ability: note.ability, ...note.element ? { element: note.element } : {}, hits: [] };
  // Angry, her next note goes at whoever angered her, and spends it.
  const angry = voz.enfado && alive.find(a => a.id === voz.enfado!.at), grade = angry ? voz.enfado!.level : 0;
  delete voz.enfado;
  const who = angry || (alive.find(a => a.id === voz.facing) ?? alive[0]);
  if (!who) return news;
  const power = MARTA[note.power];
  // Blinded, her physical notes miss (`misses`); her other notes still find them.
  const blinded = !!note.physical && blindMiss(state, voz);
  const strike = (at: Combatant) => {
    const raw = (note.physical ? physical(power, current(state, voz), current(state, at)) : magical(power, current(state, voz), current(state, at)))
      * (at === angry ? 1 + MARTA.enfado * grade : 1);
    return changeHealth(at, -Math.round(at.guarding ? Math.ceil(raw / 3) : raw));
  };
  const plain = (at: Combatant): NoteHit => blinded ? { target: at.id, amount: 0, missed: true } : { target: at.id, amount: strike(at), ...at.guarding ? { guarded: true } : {}, ...at === angry ? { angry: grade } : {} };
  if (note.all) { news.hits = alive.map(plain); return news; }
  if (note.element === 'electrico' && !who.guarding && who.timed?.mojado) {
    // The bolt finds the water: it runs through everyone wet (whoever holds on takes a third) and dries them.
    const effect: BattleEffect = { actor: voz.id, kind: 'enemy' }, said = state.message;
    const hits = conduct(state, voz, who, MARTA.vozConduce, effect);
    state.message = said;
    // Angry, the bolt lands that much harder on whoever angered her.
    const mad = angry && hits.find(h => h.target === angry.id);
    if (mad) mad.amount += changeHealth(angry, -Math.round(mad.amount * MARTA.enfado * grade), false, true);
    news.hits = hits.map(h => ({ ...h, conducted: true as const, ...state.allies.find(a => a.id === h.target)?.guarding ? { guarded: true as const } : {}, ...h === mad ? { angry: grade } : {} }));
    news.conducted = true;
    if (effect.shocked) news.shocked = effect.shocked;
    return news;
  }
  const hit = plain(who);
  if (hit.missed) { news.hits = [hit]; return news; }
  if (!who.guarding && who.hp > 0 && note.element === 'agua') { soak(who); hit.wet = true; }
  else if (!who.guarding && who.hp > 0 && note.element === 'fuego') {
    if (who.timed?.mojado) { const { mojado: _dry, ...rest } = who.timed; who.timed = rest; hit.dried = true; }
    else hit.burn = inflict(who, 'quemado').level;
  }
  news.hits = [hit];
  return news;
}
/**
 * La Voz's song goes on (the fight's clock, `runClock`): `seconds` more of her recording, which never
 * stops or starts over. Every note that starts is a move of hers (`voiceNote`); her phrase coming
 * round is a Crescendo; and her PV say which part she is in (a new one starts her turns over).
 * Returns whether anything happened to tell.
 */
function runSong(state: BattleState, seconds: number) {
  const song = state.song, voz = state.foes.find(f => f.kind === 'voz' && f.hp > 0);
  if (!song || !voz) return false;
  const news = state.songNews ??= [], before = news.length;
  const wanted = partFor(voz.hp / voz.maxHp);
  if (wanted !== song.part) {
    song.part = wanted;
    // A new part, a new round of turns: whatever she had said is called off. The song goes on.
    voz.turns = 0; delete voz.intent; delete voz.winded;
    news.push({ kind: 'part', part: wanted });
  }
  for (const onset of onsets(VOZ_SONG, song.t, song.t + seconds)) {
    if (onset.round) {
      voz.crescendo = (voz.crescendo ?? 0) + 1;
      const lasting = voz.lasting ??= { shifts: {}, from: 'Crescendo' };
      lasting.shifts.magia = (lasting.shifts.magia ?? 0) + MARTA.crescendo;
      news.push({ kind: 'crescendo', level: voz.crescendo });
      // A new turn of her phrase: she sings it at whoever touched her last in the one that ended.
      const next = state.allies.find(a => a.id === voz.struck && a.hp > 0);
      delete voz.struck;
      if (next && next.id !== voz.facing) { voz.facing = next.id; news.push({ kind: 'mira', target: next.id }); }
    }
    // In Bajo cero's ice she cannot sing: the notes go by unsung.
    if (state.allies.some(a => a.hp > 0) && !frozenOf(voz)) news.push(voiceNote(state, voz, onset.tone));
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
/** The light walks on (the fight's clock, `runClock`): `seconds` more of it. Returns whether a new one came on. */
function runLight(state: BattleState, seconds: number) {
  if (!state.light) return false;
  const came = changes(state.light.t, state.light.t + seconds, state.light.walk);
  state.light.t += seconds;
  if (came.length) (state.lightNews ??= []).push(...came);
  // Fran drinks every light whose lamp still hangs: one more Brillo each time.
  const fran = state.foes.find(f => f.kind === 'fran' && f.hp > 0 && (f.stage ?? 1) >= 2);
  if (fran) for (const light of came) {
    if (!state.foes.some(f => f.kind === 'lampara' && f.hp > 0 && f.lamp === lampOf(light)) || (fran.brillo ?? 0) >= LUCA.brilloMost) continue;
    fran.brillo = (fran.brillo ?? 0) + 1;
    (state.news ??= []).push({ kind: 'enemy', actor: fran.id, ability: foeAbility('brillo'), brillo: fran.brillo });
  }
  // A fallen shirt's light does not come on again.
  return passFallenLights(state) || came.length > 0;
}
/** The light a shirt of Luca's hangs in: its own colour's. */
const shirtLight = (c: Combatant): LightId | undefined => c.kind?.startsWith('estampado-') ? c.kind.slice('estampado-'.length) as LightId : undefined;
/** Whether a shirt hangs in the light of its own colour now: the only one a blow can hurt (La carta de colores). */
export const shirtLit = (state: BattleState, shirt: Combatant) => !state.light || lightNow(state) === shirtLight(shirt);
/**
 * La carta de colores: the light of a shirt that has fallen is gone for good. If it is the one on,
 * the walk goes straight on to the next light that still has its shirt. Returns whether it moved.
 */
function passFallenLights(state: BattleState) {
  if (!state.light) return false;
  const standing = state.foes.filter(f => f.hp > 0).map(shirtLight), fallen = state.foes.filter(f => f.hp <= 0).map(shirtLight).filter(light => light && !standing.includes(light));
  if (!fallen.length || !standing.some(Boolean)) return false;
  let moved = false;
  for (let step = 0; step < 8; step++) {
    const now = lightAt(state.light.t, state.light.walk);
    if (!fallen.includes(now.light)) break;
    state.light.t += now.left + 1e-3; moved = true;
  }
  if (moved) (state.lightNews ??= []).push(lightNow(state)!);
  return moved;
}
/** The lights that came on since it was last asked, in order. */
export function takeLightNews(state: BattleState): LightId[] {
  const news = state.lightNews ?? [];
  delete state.lightNews;
  return news;
}
/** How La Voz's plate says what she sings now: «Nota · Mi», or «Silencio». */
export function songLabel(state: BattleState) {
  const now = songNow(state);
  return now ? now.sounding ? `Nota · ${TONES[now.tone].name}` : 'Silencio' : undefined;
}
/**
 * Fran's salon (docs/quests/luca.md § Monsters), every number in one book (`luca.rules`). Polillas
 * flutter at whoever struck with an element last (`aleteo`); at the end of a round, while two of them
 * stand, one more comes in, up to `polillasMost`. Estampados stamp (`estampar`). A chaplain cuts
 * (`tijeretazo`); the freshly styled one
 * repeats the last gesture made, whole, and its fall leaves the others still for the round. A
 * shirt of Luca's is only hurt in the light of its own colour (`shirtLit`); fallen, its light is gone.
 * Fran (§ Final boss): a Corte a medida (`corte`) on one, his acolytes copying it. From `standAt` of
 * his PV he stands and the canopy's three lamps light up: every light whose lamp still hangs gives
 * him a Brillo (up to `brilloMost`), each one taking `brilloStep` more off a blow on him; only the lamp
 * of the light on now can be broken, and breaking one takes all his Brillo. From `hisopoAt` he takes
 * the aspergillum: a turn to load it (said a turn ahead), then the Aspersión on everyone (`aspersion`,
 * `aspersionLamp` more for each lamp still hanging), their Fuerza and Magia down by `aspersionDown`
 * for each lamp still hanging, for the rest of the fight. A lamp broken rains its colour back: its
 * lights no longer eat the party's blows (`lightFreed`).
 */
export const LUCA = {
  aleteo: 11, polillasMost: 3,
  estampar: 18,
  tijeretazo: 29,
  deslumbre: 14,
  corte: 26, acolito: 55, acolitoCorte: 22, aspersion: 22, aspersionLamp: 12, aspersionDown: 1, brilloStep: .625, brilloMost: 3, standAt: .75, hisopoAt: .33,
};
/** The canopy's three lamps (Fran's fight): each drinks the lights of one side of the day. */
export type LampId = 'frio' | 'calido' | 'oro';
export const LAMPS: Record<LampId, { name: string; lights: readonly LightId[] }> = {
  frio: { name: 'Lámpara fría', lights: ['azul', 'verde'] },
  calido: { name: 'Lámpara cálida', lights: ['naranja', 'rojo'] },
  oro: { name: 'Lámpara de oro', lights: ['oro'] },
};
/** The lamp a light belongs to. */
export const lampOf = (light: LightId) => (Object.keys(LAMPS) as LampId[]).find(id => LAMPS[id].lights.includes(light))!;
/** Fran's turns in each phase, in order, round and round. */
export const FRAN_TURNS = { 1: ['corte', 'repeinar'], 2: ['corte', 'corte', 'repeinar'], 3: ['tomar-hisopo', 'aspersion', 'corte'] } as const satisfies Record<1 | 2 | 3, readonly FoeAbilityId[]>;
/** Fran's salon's foes, by name. */
export const LUCA_NAMES: Record<LucaKind, string> = {
  polilla: 'Polilla', 'estampado-rojo': 'Camisa roja', 'estampado-azul': 'Camisa azul', 'estampado-oro': 'Camisa dorada',
  capellan: 'Capellán', fran: 'Fran', lampara: 'Lámpara',
};
const LUCA_MESSAGES: Record<LucaEncounter, string> = {
  'luca-recepcion': 'Polillas grises salen de detrás del mostrador. Van hacia la luz, y la luz sois vosotros.',
  'luca-sillones': 'Los capellanes se levantan de los sillones a la vez, cada uno con un peinado que no es suyo.',
  'luca-carta': 'Tres camisas de Luca cuelgan de sus perchas delante de la carta de colores: roja, azul, dorada. Sin nadie dentro.',
  fran: 'Fran no levanta la vista de sus papeles. A cada lado, un capellán con el peinado recién hecho. La luz cambia de color sobre los tres.',
};
const LUCA_WON: Record<LucaEncounter, string> = {
  'luca-recepcion': 'La última polilla se deshace en polvo gris. Por la puerta sale un poco de azul.',
  'luca-sillones': 'Los capellanes se sientan, despeinados, y se miran como si se acabaran de despertar. Un rojo se va hacia la puerta.',
  'luca-carta': 'La última camisa cae de su percha, vacía. Un naranja se va hacia la puerta.',
  fran: 'Fran se queda quieto bajo el baldaquino. La luz deja de correr y se queda blanca, de mediodía.',
};
/** Which windows light each of the salon's fights (src/vidrieras.ts WALKS): the side of the basilica it is fought in. */
export const LUCA_WALKS: Record<LucaEncounter, WalkId> = { 'luca-recepcion': 'nacimiento', 'luca-sillones': 'nave', 'luca-carta': 'pasion', fran: 'nave' };
const isLucaFight = (state: BattleState) => (LUCA_ENCOUNTERS as readonly string[]).includes(state.encounter);
/** One of the salon's fights: who comes out (LUCA_FIGHTS), the first chaplain freshly styled, and the light walking from the cold morning. */
function createLucaBattle(party: PartySlot[], encounter: LucaEncounter, animas?: ClassId[], random: () => number = Math.random): BattleState {
  const kinds = LUCA_FIGHTS[encounter], seen: Partial<Record<LucaKind, number>> = {};
  const foes = kinds.map((kind, i) => {
    const n = seen[kind] = (seen[kind] ?? 0) + 1, many = kinds.filter(k => k === kind).length > 1;
    const one = foe(many ? `${kind}-${i}` : kind, many ? `${LUCA_NAMES[kind]} ${n}` : LUCA_NAMES[kind], kind);
    if (kind === 'capellan' && n === 1) one.peinado = true;
    // Fran's acolytes: chaplains by another name, so the zone's are not taken for them.
    if (encounter === 'fran' && kind === 'capellan') { one.name = `Acólito ${n}`; one.hp = one.maxHp = one.stats.pv = LUCA.acolito; }
    if (kind === 'fran') { one.stage = 1; one.brillo = 0; }
    return one;
  });
  // Fran's canopy: its three lamps hang there from the start, parts of his fight; they only drink the light, and break, once he stands.
  if (encounter === 'fran') for (const id of Object.keys(LAMPS) as LampId[]) foes.push({ ...foe(`lampara-${id}`, LAMPS[id].name, 'lampara'), part: true, lamp: id });
  const unlocked = animas ?? wornAnimas(party);
  return {
    allies: lineUp(party, unlocked), foes,
    active: 0, round: 1, phase: 'player', enemyActions: [], possessed: false, encounter,
    animas: unlocked, awakened: unlocked.includes('matemagico'), seed: seedFrom(random),
    message: LUCA_MESSAGES[encounter], light: { t: 0, walk: LUCA_WALKS[encounter] },
  };
}
/**
 * The chaplains dazzled (docs/quests/luca.md § Review C): the light the nave's mirrors bring to their
 * chairs is in their eyes as the fight starts, Cegado for `deslumbre` seconds (their physical blows miss).
 */
export function dazzle(state: BattleState) {
  const dazzled = state.foes.filter(f => f.kind === 'capellan' && f.hp > 0);
  for (const f of dazzled) blind(f, LUCA.deslumbre);
  if (dazzled.length) state.message = `${state.message} La luz de los espejos les da en la cara: no ven nada.`;
}
/** How much of a blow one of the salon's foes takes: Fran through his Brillo; a lamp and a shirt of Luca's only in their own light. */
function lucaTaken(state: BattleState, target: Combatant) {
  if (shirtLight(target)) return shirtLit(state, target) ? 1 : 0;
  if (target.kind === 'fran') return 1 / (1 + LUCA.brilloStep * (target.brillo ?? 0));
  if (target.kind === 'lampara') return lampLit(state, target) ? 1 : 0;
  return 1;
}
/** Whether a lamp of the canopy hangs in the light on now: the only one that can be broken. */
export const lampLit = (state: BattleState, lamp: Combatant) => { const light = lightNow(state); return !!light && !!lamp.lamp && LAMPS[lamp.lamp].lights.includes(light) && (state.foes.find(f => f.kind === 'fran')?.stage ?? 1) >= 2; };
/** The canopy's lamps still hanging: each one gives Fran a Brillo with its light and dyes his Aspersión. */
const lampsHanging = (state: BattleState) => state.foes.filter(f => f.kind === 'lampara' && f.hp > 0).length;
/** Fran, in his fight. */
const franOf = (state: BattleState) => state.foes.find(f => f.kind === 'fran');
/** The element a party's action landed with, if any: Atacar's, a skill's, a dual's. */
function landingOf(effect: BattleEffect): Element | undefined {
  if (effect.annulled) return undefined;
  const dual = DUALS.find(d => d.id === (effect.dual?.id ?? effect.release?.id));
  return effect.element ?? elementOf(effect.skill ? SKILLS.find(s => s.id === effect.skill) : undefined) ?? elementOf(dual);
}
/**
 * After anything that may have hurt one of the salon's foes. A party's blow with an element calls
 * the moths to whoever struck it. The freshly styled chaplain
 * fallen: the others stop mid-gesture for the round.
 */
function checkLuca(state: BattleState, effect?: BattleEffect) {
  if (!isLucaFight(state)) return;
  const ally = effect && effect.kind !== 'enemy' ? state.allies.find(a => a.id === effect.actor) : undefined;
  const landing = ally && effect ? landingOf(effect) : undefined;
  if (ally && landing) state.flash = ally.id;
  const struck = (id: string) => !!effect && ((effect.target === id && (effect.amount ?? 0) > 0) || !!effect.hits?.some(h => h.target === id && h.amount > 0));
  // A shirt of Luca's struck out of its light: nothing done to it, and the fight says so. One fallen: its light goes out for good.
  if (ally && effect && !effect.annulled) {
    const missed = [effect.target, ...effect.hits?.map(h => h.target) ?? []].filter((id, i, all) => id && all.indexOf(id) === i && !struck(id)).map(id => state.foes.find(f => f.id === id)).filter(f => f && f.hp > 0 && shirtLight(f) && !shirtLit(state, f)) as Combatant[];
    if (missed.length) { effect.unlit = missed.map(f => f.id); state.message += ` ${missed.length > 1 ? 'Están' : `${missed[0].name} está`} fuera de su luz: nada.`; }
  }
  const out = state.foes.find(f => f.hp <= 0 && !f.told && shirtLight(f));
  if (out) {
    out.told = true;
    const light = shirtLight(out)!, left = state.foes.some(f => f.hp > 0 && shirtLight(f));
    if (effect) effect.lightOut = light;
    if (left) state.message += ` La luz ${LIGHTS[light].name.toLowerCase()} se apaga con ella.`;
    passFallenLights(state);
  }
  // The freshly styled chaplain down: the others stop mid-gesture, with nothing to copy.
  const styled = state.foes.find(f => f.kind === 'capellan' && f.peinado);
  if (styled && styled.hp <= 0) {
    delete styled.peinado;
    const stopped = state.foes.filter(f => f.kind === 'capellan' && f.hp > 0);
    for (const f of stopped) f.still = state.round;
    delete state.copied;
    if (stopped.length) {
      const news: BattleEffect = effect ?? { kind: 'enemy', actor: stopped[0].id };
      news.stopped = stopped.map(f => f.id);
      state.message += ' Los otros capellanes se quedan a medio gesto, sin saber qué hacer.';
      if (!effect) (state.news ??= []).push(news);
    }
  }
  checkFran(state, effect);
}
/**
 * Fran's fight (docs/quests/luca.md § Final boss): a lamp broken takes all his Brillo; at `standAt`
 * of his PV he stands and the canopy's lamps come down; at `hisopoAt` he takes the aspergillum; and
 * his acolytes go down with him.
 */
function checkFran(state: BattleState, effect?: BattleEffect) {
  const fran = franOf(state);
  if (!fran) return;
  const say = (news: BattleEffect, text: string) => { state.message = `${state.message} ${text}`.trim(); if (news !== effect) (state.news ??= []).push(news); };
  const broken = state.foes.find(f => f.kind === 'lampara' && f.hp <= 0 && !f.told);
  if (broken) {
    broken.told = true; fran.brillo = 0;
    const news = effect ?? { kind: 'enemy', actor: fran.id };
    news.lampBroken = broken.id; news.brillo = 0;
    const colours = LAMPS[broken.lamp!].lights.map(id => LIGHTS[id].name.toLowerCase()).join(' y ');
    say(news, `¡La ${broken.name.toLowerCase()} estalla! Llueve ${colours} sobre vosotros, y a Fran se le apaga el brillo. Esa luz ya no se come nada vuestro.`);
  }
  if (fran.hp <= 0) { for (const f of state.foes) if (f.kind === 'capellan') f.hp = 0; return; }
  const share = fran.hp / fran.maxHp;
  if (fran.stage === 1 && share <= LUCA.standAt) {
    fran.stage = 2; fran.turns = 0; delete fran.intent;
    const news = effect ?? { kind: 'enemy', actor: fran.id };
    news.stage = 2;
    say(news, 'Fran se levanta. Las tres lámparas del baldaquino se encienden, y cada una bebe una luz.');
  }
  if (fran.stage === 2 && share <= LUCA.hisopoAt) {
    fran.stage = 3; fran.turns = 0; delete fran.intent;
    const news = effect ?? { kind: 'enemy', actor: fran.id };
    news.stage = 3;
    say(news, 'Fran deja las tijeras sobre el altar y coge el hisopo. Lo moja en un cuenco que huele a decolorante.');
  }
}
/**
 * The salon's foes' turns (docs/quests/luca.md § Monsters), each a named move. A moth flutters at the
 * flash. An Estampado stamps. A chaplain left mid-gesture loses its turn; the freshly styled one repeats the last
 * gesture made by a foe, whole; the others cut.
 */
function lucaTurn(state: BattleState, actor: Combatant, target: Combatant, effect: BattleEffect, hit: Hit) {
  const turn = actor.turns ?? 0;
  actor.turns = turn + 1;
  const use = (id: FoeAbilityId) => { effect.ability = foeAbility(id); };
  const alive = state.allies.filter(a => a.hp > 0);
  const zap: Hit = (who, power) => {
    const raw = magical(power, current(state, actor), current(state, who));
    return changeHealth(who, -(who.guarding ? Math.ceil(raw / 3) : raw));
  };
  const remember = (ability: FoeAbilityId, power: number, all: boolean, magic: boolean) => { state.copied = { ability, power, all, magic, by: actor.name }; };
  if (actor.kind === 'fran') {
    const cycle: readonly FoeAbilityId[] = FRAN_TURNS[actor.stage ?? 1];
    const move = cycle[turn % cycle.length];
    if (move === 'repeinar') {
      // He restyles an acolyte from where he stands: that one leads the copying now.
      const chaplains = state.foes.filter(f => f.kind === 'capellan' && f.hp > 0);
      use('repeinar'); delete effect.target;
      if (chaplains.length) {
        const next = chaplains.find(f => !f.peinado) ?? chaplains[0];
        for (const f of chaplains) delete f.peinado;
        next.peinado = true;
        state.message = `${actor.name} chasquea las tijeras sin mirar. ${next.name} se toca el pelo: es otro.`;
      } else {
        effect.amount = undefined; use('corte'); effect.target = target.id; effect.amount = hit(target, LUCA.corte);
        remember('corte', LUCA.corte, false, false);
        state.message = `${actor.name} se gira hacia ${target.name}, sin prisa, y corta. −${effect.amount} PV.`;
      }
    } else if (move === 'tomar-hisopo') {
      // He loads the aspergillum: the Aspersión comes on his next turn, on everyone.
      use('tomar-hisopo'); delete effect.target;
      actor.intent = { ability: 'aspersion', at: 'todos' };
      effect.telegraph = { id: 'aspersion', name: FOE_ABILITIES.aspersion.name, at: 'todos' };
      const hanging = lampsHanging(state);
      state.message = `${actor.name} hunde el hisopo en el cuenco y lo levanta despacio. ${hanging ? `Gotea del color de ${hanging === 1 ? 'la lámpara que queda' : `las ${hanging} lámparas que quedan`}.` : 'Gotea claro: ya no queda luz que beber.'}`;
    } else if (move === 'aspersion') {
      // Bleach over everyone: it hurts, and it takes the colour out of their Fuerza and Magia for good.
      // Each lamp still hanging dyes it: it hurts more and takes more colour out.
      use('aspersion');
      const hanging = lampsHanging(state);
      onEveryone(state, effect, target, zap, LUCA.aspersion + LUCA.aspersionLamp * hanging);
      const stat: (keyof Stats)[] = ['fuerza', 'magia'], changes: StatChange[] = [], down = LUCA.aspersionDown * hanging;
      if (down) for (const ally of alive) {
        const lasting = ally.lasting ??= { shifts: {}, from: FOE_ABILITIES.aspersion.name };
        for (const s of stat) lasting.shifts[s] = (lasting.shifts[s] ?? 0) - down;
        changes.push({ target: ally.id, way: 'down', stats: stat });
      }
      if (changes.length) effect.stats = changes;
      delete actor.intent;
      state.message = hanging
        ? `${actor.name} sacude el hisopo sobre vosotros. Donde cae, el color se va. −${effect.amount} PV a ${target.name}.`
        : `${actor.name} sacude el hisopo sobre vosotros. Moja, y nada más: no os quita el color. −${effect.amount} PV a ${target.name}.`;
    } else {
      use('corte'); effect.target = target.id; effect.amount = hit(target, LUCA.corte);
      remember('corte', LUCA.corte, false, false);
      state.message = `${actor.name} os mira por fin a uno: a ${target.name}. Y corta. −${effect.amount} PV.`;
    }
  } else if (actor.kind === 'lampara') {
    delete effect.target;
  } else if (actor.kind === 'polilla') {
    const who = alive.find(a => a.id === state.flash) ?? target;
    use('aleteo'); effect.target = who.id; effect.amount = hit(who, LUCA.aleteo);
    state.message = `${actor.name} va a por ${who.name}${who.id === state.flash ? ', atraída por el destello' : ''}. −${effect.amount} PV.`;
  } else if (actor.kind?.startsWith('estampado')) {
    use('estampar'); effect.target = target.id; effect.amount = hit(target, LUCA.estampar);
    remember('estampar', LUCA.estampar, false, false);
    state.message = `${actor.name} se le pega a ${target.name} y aprieta. −${effect.amount} PV.`;
  } else if (actor.still === state.round) {
    // Left mid-gesture by the fall of the freshly styled one: nothing to copy, nothing to do.
    use('tijeretazo'); delete effect.target; effect.cancelled = 'tijeretazo';
    state.message = `${actor.name} levanta las tijeras y se queda así, quieto, sin saber qué venía después.`;
  } else if (actor.peinado && state.copied && state.copied.by !== actor.name) {
    // Recién peinado: it does again what was just done, whole.
    const copy = state.copied;
    use('imitacion');
    const blow: Hit = copy.magic ? zap : hit;
    if (copy.all) onEveryone(state, effect, target, blow, copy.power);
    else { effect.target = target.id; effect.amount = blow(target, copy.power); }
    state.message = `${actor.name}, recién peinado, repite lo que hizo ${copy.by}. −${effect.amount} PV a ${target.name}.`;
  } else {
    const cut = state.encounter === 'fran' ? LUCA.acolitoCorte : LUCA.tijeretazo;
    use('tijeretazo'); effect.target = target.id; effect.amount = hit(target, cut);
    remember('tijeretazo', cut, false, false);
    state.message = `${actor.name} corta el aire delante de ${target.name}, muy cerca. −${effect.amount} PV.`;
  }
}
/**
 * A round of the salon ends: one more moth comes in while two stand (up to `polillasMost`), and Fran
 * restyles the next chaplain standing (*Recién peinado*), from a distance, with a snip.
 */
function lucaRoundEnd(state: BattleState) {
  if (!isLucaFight(state)) return;
  const moths = state.foes.filter(f => f.kind === 'polilla');
  if (moths.filter(f => f.hp > 0).length >= 2 && moths.length < LUCA.polillasMost + 2 && moths.filter(f => f.hp > 0).length < LUCA.polillasMost) {
    const n = moths.length + 1, one = grow(foe(`polilla-${state.foes.length}`, `${LUCA_NAMES.polilla} ${n}`, 'polilla'), state.grown, growthOf(state.encounter));
    state.foes.push(one);
    (state.news ??= []).push({ kind: 'enemy', actor: one.id, summoned: one.id });
    state.message = `${state.message} Entra otra polilla, atraída por la luz.`.trim();
  }
  const chaplains = state.foes.filter(f => f.kind === 'capellan');
  if (chaplains.some(f => f.hp > 0)) {
    const at = chaplains.findIndex(f => f.peinado), standing = chaplains.filter(f => f.hp > 0);
    for (const f of chaplains) delete f.peinado;
    const next = chaplains.slice(at + 1).find(f => f.hp > 0) ?? standing[0];
    next.peinado = true;
  }
}
/**
 * How much of a blow a campsite foe takes, by its rule and the kind of blow (a dual counts as every
 * kind, so it takes the better): a Mago de camping, little from magic and more from blows; an Agente
 * face down, half; El Campeón, less from magic (which also takes his Plan a step down, `foil`). Ticks and
 * pulses never come through here, so they land whole on anyone.
 */
function campingTaken(target: Combatant, blow: Blow) {
  if (target.kind === 'mago') return blow === 'dual' ? Math.max(CAMPING.magoMagic, CAMPING.magoPhysical) : blow === 'magic' ? CAMPING.magoMagic : CAMPING.magoPhysical;
  if (target.kind === 'agente' && target.faceUp === false) return CAMPING.downTaken;
  if (target.kind === 'campeon') return blow === 'magic' ? CAMPING.campeonMagic : 1;
  return 1;
}
/**
 * The campsite foes' turns (docs/quests/universidad.md § Càmping Eurocamping), each one named move. A
 * Mago de camping charges its Bombona on one turn (announced: «Bombona → todos») and lets it go on the
 * next, magic on everyone; holding on takes two thirds off. A Dado falls on one with the weight of its
 * face (Tumbarse). An Agente strikes one (Contraseña). El Campeón fires his Rayo at whom he said and
 * says the next, and his Plan goes a step up; if it was already full, the Rayo total goes on everyone
 * instead and it starts again (`campeonTurn`).
 */
function campingTurn(state: BattleState, actor: Combatant, target: Combatant, effect: BattleEffect, hit: Hit) {
  actor.turns = (actor.turns ?? 0) + 1;
  const use = (id: FoeAbilityId) => { effect.ability = foeAbility(id); };
  if (actor.kind === 'mago') {
    if (actor.intent?.ability === 'bombona') {
      delete actor.intent;
      const blast: Hit = (who, power) => {
        const raw = magical(power, current(state, actor), current(state, who));
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
  } else campeonTurn(state, actor, target, effect);
}
/**
 * El Campeón's turn: with his Plan full, the Rayo total on everyone, and it starts again; otherwise
 * his Rayo at whom he said (the one in front if they fell), and his Plan a step up. Either way he then
 * says whom his next Rayo is for: next round's turn order, so it goes round the party. Both are magic,
 * and Defender takes two thirds off.
 */
function campeonTurn(state: BattleState, actor: Combatant, target: Combatant, effect: BattleEffect) {
  const alive = state.allies.filter(a => a.hp > 0);
  const beam: Hit = (who, power) => {
    const raw = magical(power, current(state, actor), current(state, who));
    return changeHealth(who, -(who.guarding ? Math.ceil(raw / 3) : raw));
  };
  if ((actor.plan ?? 0) >= planMost(actor)) {
    effect.ability = foeAbility('rayo-total');
    onEveryone(state, effect, target, beam, CAMPING.rayoTotal);
    actor.plan = 0;
    state.message = `El plan de ${actor.name} se cumple: abre la rejilla del pecho y el rayo os barre a todos. −${effect.amount} PV a ${target.name}.`;
  } else {
    const who = alive.find(a => a.id === actor.intent?.target) ?? target;
    effect.ability = foeAbility('rayo-guantelete');
    effect.target = who.id; effect.amount = beam(who, CAMPING.rayo);
    actor.plan = (actor.plan ?? 0) + 1;
    state.message = `${actor.name} dispara el guantelete contra ${who.name}. −${effect.amount} PV${who.guarding ? ' · Protegido' : ''}. Su plan avanza: ${actor.plan}/${planMost(actor)}.`;
  }
  effect.plan = actor.plan;
  const next = alive.filter(a => a.hp > 0)[(state.round + 1) % Math.max(1, alive.filter(a => a.hp > 0).length)];
  if (!next) { delete actor.intent; return; }
  actor.intent = { ability: 'rayo-guantelete', target: next.id };
  effect.telegraph = { id: 'rayo-guantelete', name: FOE_ABILITIES['rayo-guantelete'].name, target: next.id };
  state.message += ` Se le cargan los guanteletes: apunta a ${next.name}.`;
}
/** A magic blow, or a dual, landing on El Campeón takes his Plan a step down (`checkCampeon` says so). */
function foil(target: Combatant, blow: Blow) {
  if (target.kind !== 'campeon' || blow === 'physical' || !target.plan) return;
  target.plan -= 1;
  target.foiled = (target.foiled ?? 0) + 1;
}
/**
 * After anything that may have hurt El Campeón: the steps magic took off his Plan, said on the
 * action (`effect`) or kept as news; and his Etapa II once he is down to `stageAt` of his PV, from
 * when his Plan fires a step sooner.
 */
function checkCampeon(state: BattleState, effect?: BattleEffect) {
  const champion = state.foes.find(f => f.kind === 'campeon');
  if (!champion) return;
  const foiled = champion.foiled ?? 0;
  delete champion.foiled;
  const stage = champion.hp > 0 && !champion.stage2 && champion.hp <= champion.maxHp * CAMPING.stageAt;
  if (stage) champion.stage2 = true;
  if (!foiled && !stage) return;
  const said = `${foiled ? ` ¡Plan frustrado! ${champion.plan ?? 0}/${planMost(champion)}.` : ''}${stage ? ` ${champion.name} da la vuelta a su carta: Etapa II. Su plan se cumple antes.` : ''}`;
  if (effect) {
    if (foiled) { effect.foiled = (effect.foiled ?? 0) + foiled; effect.plan = champion.plan; }
    if (stage) effect.stage2 = true;
    state.message = `${state.message}${said}`.trim();
  } else (state.news ??= []).push({ kind: 'enemy', actor: champion.id, ...foiled ? { foiled, plan: champion.plan } : {}, ...stage ? { stage2: true as const } : {} });
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
    const raw = Math.max(1, Math.round(who.maxHp * dice.reduce((a, b) => a + b, 0) * SOBREMESA.pip / 100));
    return changeHealth(who, -(who.guarding ? Math.ceil(raw / 3) : raw));
  };
  const sung: Hit = (who, power) => {
    const raw = magical(power, current(state, actor), current(state, who));
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
        effect.amount = at.guarding ? hit(at, SOBREMESA.carta) : changeHealth(at, -Math.max(0, at.hp - 1), false, true);
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
  checkCampeon(state, effect);
  castleAfter(castleKit, state, effect);
  checkModelo(state, effect);
  checkLuca(state, effect);
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
      const raw = magical(power, current(state, actor), current(state, who));
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
    if (misses(state, actor, who)) return 0;
    const raw = physical(power, current(state, actor), current(state, who));
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
  else if (isLuca(actor.kind)) lucaTurn(state, actor, target, effect, hit);
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
  delete ally.racha; delete ally.meteor;
  swapMana(state, ally, classId ?? undefined);
  const { secondary, maxSecondary, mana, kit } = ally;
  Object.assign(ally, fighter({ id: ally.id, name: ally.name, profile: ally.profile, classId: classId ?? undefined }));
  Object.assign(ally, { hp: Math.min(hp, ally.maxHp), secondary, maxSecondary, mana, kit });
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
      const amount = spec.tick && c.hp > 0 ? foeSide ? hurt(state, c, spec.tick * count) : changeHealth(c, -spec.tick * count, true) : 0;
      // Sangrado goes little by little: a wound cut this round keeps every stack.
      const fed = id === 'sangrado' && c.cutRound === state.round;
      const left = c.hp > 0 ? Math.max(0, count - (fed ? 0 : spec.decay)) : 0;
      if (left) c.statuses[id] = left; else delete c.statuses[id];
      // Siete vidas took the tick that would have killed them: it cured them instead.
      const saved = foeSide ? undefined : livesOn(c.id);
      if (amount || saved) ticks.push({ target: c.id, status: id, amount, stacks: left, ...saved ? { saved } : {} });
    }
  }
  checkEye(state);
  holdWater(state);
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
  lucaRoundEnd(state);
  // What lasts one round whatever its clock says (Explosión's blinding) ends with it.
  for (const c of [...state.foes, ...state.allies]) for (const id of TIMED_IDS) if (c.timed?.[id]?.until !== undefined && c.timed[id]!.until! <= state.round) delete c.timed[id];
  for (const ally of state.allies) delete ally.suture;
  // A cortina nobody broke comes down with its last round.
  for (const ally of state.allies) if (ally.cortina !== undefined && (ally.cortina <= state.round || ally.hp <= 0)) delete ally.cortina;
  // Escudo de bits: broken, or its last round over, it is gone.
  for (const ally of state.allies) if (ally.bits && (ally.bits.broken || ally.bits.hp <= 0 || ally.bits.until < state.round)) delete ally.bits;
  state.round++;
  // Against La Voz's song a guard lasts until that fighter acts again (`act`), not to the round's end.
  if (!state.song) state.allies.forEach(a => { a.guarding = false; });
  keepEscorts(state);
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
  // …and so does a cat that crouched last round (Acecho).
  const pounced = state.allies.filter(a => a.stalk).map(a => pounce(state, a)).filter(Boolean);
  if (pounced.length) state.message = `${pounced.join(' ')} ${state.message}`;
  if (beaten(state)) { state.phase = 'won'; state.message = winMessage(state); endFight(state); return ticks; }
  // What landed before anyone chose can leave nobody on the party's side (the Queen takes Aitor with Gerard down).
  if (fallen(state)) return ticks;
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
  const lit = runLight(state, seconds), sung = runSong(state, seconds) || lit, lapped = runCastle(castleKit, state, seconds);
  // Sincopante's ecos sound on their compás (`runEcos`), what they did kept as news (`takeEcoNews`).
  const echoed = runEcos(state, seconds);
  // La crecida: the water drains and the ice melts on their own clocks (`runWater`); the current and the sinking pulse below.
  runWater(state, seconds);
  for (const c of [...state.foes, ...state.allies]) for (const id of TIMED_IDS) {
    if (id === 'agua' || id === 'congelado') continue;
    const on = c.timed?.[id];
    // A fire settled but still on its way (`waiting`): its clock starts when it lands.
    if (!on || waiting?.(c)) continue;
    let dt = seconds;
    const foeSide = state.foes.includes(c);
    // A Bomba remota grows while it is on, and goes off when its time is up (`blowBomb`).
    if (id === 'bomba') {
      on.age = (on.age ?? 0) + seconds; on.left -= seconds;
      if (on.left <= 1e-6 || c.hp <= 0) {
        const was = swarmReady(state), amount = foeSide && c.hp > 0 ? blowBomb(state, c) : (delete c.timed![id], 0);
        if (foeSide && amount >= 0 && !c.timed?.bomba) pulses.push({ target: c.id, status: id, level: 1, amount, blast: true, ...!was && swarmReady(state) && !state.unbound ? { awoken: 'enjambre' as const } : {} });
      }
      continue;
    }
    while (TIMED[id].levels.length && c.hp > 0 && on.left > 1e-6 && dt >= on.next - 1e-6) {
      dt -= on.next; on.left -= on.next; on.next = TIMED[id].every;
      const amount = pulseDamage(id, on.level, c.maxHp);
      // Idea fija: the eco in its head sounds, and it strikes the strongest of its own standing (itself if alone), as under Control remoto.
      if (id === 'idea-fija') {
        const others = state.foes.filter(f => f !== c && f.hp > 0 && !f.part);
        const victim = others.length ? others.reduce((most, f) => f.hp > most.hp ? f : most) : c;
        const dealt = hurt(state, victim, fearDamage(state, victim, physical(IDEA_FIJA, current(state, c), current(state, victim)), 'physical'));
        pulses.push({ target: victim.id, status: id, level: on.level, amount: dealt, by: c.id });
        continue;
      }
      // A cure's pulse (Sanación) gives PV back, never past the most.
      if (TIMED[id].heal) { const healed = changeHealth(c, amount), mended = wallMended(); pulses.push({ target: c.id, status: id, level: on.level, amount: healed, heal: true, ...mended ? { mended } : {} }); }
      // A fire on La Voz burns on, but while she sings it takes nothing: no pulse to show.
      else if (!(foeSide && singing(state, c))) {
        const dealt = foeSide ? hurt(state, c, amount) : changeHealth(c, -amount, true), saved = foeSide ? undefined : livesOn(c.id);
        pulses.push({ target: c.id, status: id, level: on.level, amount: dealt, ...saved ? { saved } : {} });
      }
      // Seiche's eco is a water blow: it holds the water under its foe. Staccato's cuts again.
      if (id === 'seiche' && foeSide) refill(c);
      if (id === 'staccato' && foeSide && c.hp > 0) cut(state, c, 1);
      // Vulcano's volcano: each beat raises the fire on whoever it stands under (a wet one steams instead).
      if (id === 'volcan' && foeSide && c.hp > 0 && !c.layers) {
        if (c.timed?.mojado) steam(c);
        else { const fire = inflict(c, 'quemado', fireTop(state)); pulses[pulses.length - 1] = { ...pulses[pulses.length - 1], level: fire.level }; }
      }
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
  if (!pulses.length && !sung && !lapped && !echoed) return pulses;
  holdWater(state);
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
export type StagedMoment = 'vertigo-carga' | 'vertigo-grito' | 'vertigo-sin-ojo' | 'plato-sorpresa' | 'sobremesa-duo-carta' | 'sobremesa-escala-alta' | 'sobremesa-ultimo' | 'magos-bombona' | 'campeon-plan' | 'campeon-etapa'
  | 'lealtad-lazo' | 'cristalino-casi' | 'cristalino-rajado' | 'directo-linea' | 'directo-estocada' | 'directo-clavado'
  | 'voz-andante' | 'voz-deprisa' | 'voz-allegro' | 'voz-coro' | 'voz-a-capela' | 'voz-calderon'
  | CastleMoment
  | 'modelo-itera' | 'modelo-converge' | 'modelo-diverge' | 'modelo-sobre-aviso'
  | 'fran-acolitos' | 'fran-baldaquino' | 'fran-aspersion';
export const STAGED_MOMENTS: Record<StagedMoment, { label: string; encounter: Encounter }> = {
  'vertigo-carga': { label: 'Rayo cargado', encounter: 'uri-vertigo' },
  'vertigo-grito': { label: 'Tras dos gritos', encounter: 'uri-vertigo' },
  'vertigo-sin-ojo': { label: 'Ojo roto', encounter: 'uri-vertigo' },
  'plato-sorpresa': { label: 'Plato sorpresa', encounter: 'plato' },
  'sobremesa-duo-carta': { label: 'Dúo de la carta negra', encounter: 'sobremesa' },
  'sobremesa-escala-alta': { label: 'Joan en La', encounter: 'sobremesa' },
  'sobremesa-ultimo': { label: 'Queda uno', encounter: 'sobremesa' },
  'magos-bombona': { label: 'Bombona cargada', encounter: 'camping-magos' },
  'campeon-plan': { label: 'Plan a punto', encounter: 'campeon' },
  'campeon-etapa': { label: 'Etapa II', encounter: 'campeon' },
  'lealtad-lazo': { label: 'Lazo: el Eco caído', encounter: 'cuerdas-lealtad' },
  'cristalino-casi': { label: 'A punto de rajarse', encounter: 'cuerdas-cristalino' },
  'cristalino-rajado': { label: 'Rajado', encounter: 'cuerdas-cristalino' },
  'directo-linea': { label: 'En línea recta', encounter: 'cuerdas-directo' },
  'directo-estocada': { label: 'Estocada', encounter: 'cuerdas-directo' },
  'directo-clavado': { label: 'Clavado', encounter: 'cuerdas-directo' },
  'voz-andante': { label: 'Andante', encounter: 'voz' },
  'voz-deprisa': { label: 'Andante, donde canta deprisa', encounter: 'voz' },
  'voz-allegro': { label: 'Allegro', encounter: 'voz' },
  'voz-coro': { label: 'Allegro, con segunda voz', encounter: 'voz' },
  'voz-a-capela': { label: 'A capela', encounter: 'voz' },
  'voz-calderon': { label: 'Calderón tomado', encounter: 'voz' },
  ...CASTLE_MOMENTS,
  'modelo-itera': { label: 'Itera', encounter: 'no-converge' },
  'modelo-converge': { label: 'Converge', encounter: 'no-converge' },
  'modelo-diverge': { label: 'Diverge', encounter: 'no-converge' },
  'modelo-sobre-aviso': { label: 'Ya vio la espera', encounter: 'no-converge' },
  'fran-acolitos': { label: 'Los acólitos', encounter: 'fran' },
  'fran-baldaquino': { label: 'El baldaquino', encounter: 'fran' },
  'fran-aspersion': { label: 'Aspersión tomada', encounter: 'fran' },
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
    delete voz.intent; delete voz.shielded; delete voz.lasting; delete voz.crescendo; delete voz.winded; delete voz.enfado; voz.turns = 0; voz.facing = first.id; delete voz.struck;
    state.foes = state.foes.filter(f => f.id !== SECOND_VOICE);
    const share = moment === 'voz-allegro' || moment === 'voz-coro' ? MARTA.allegro : moment === 'voz-a-capela' || moment === 'voz-calderon' ? MARTA.capela : 1;
    voz.hp = Math.max(1, Math.floor(voz.maxHp * share));
    state.song = { part: partFor(voz.hp / voz.maxHp), t: 0 }; delete state.songNews;
    if (moment === 'voz-deprisa') {
      // Just before the turns of her phrase she sings fastest and most bound (the sixth and seventh of her recording): a time to hold on.
      state.song.t = Math.max(0, turnStarts(VOZ_SONG)[5] - .5);
    } else if (moment === 'voz-coro') {
      // Her second voice already there, a turn old.
      const second = grow(foe(SECOND_VOICE, 'Segunda voz', 'eco', MARTA.coro), state.grown, growthOf(state.encounter)); second.turns = 1;
      state.foes.push(second); voz.turns = 1;
    } else if (moment === 'voz-calderon') {
      voz.turns = VOZ_TURNS['a-capela'].indexOf('calderon'); voz.intent = { ability: 'calderon', at: 'todos' };
    }
  } else if (moment.startsWith('fran-')) {
    // Fran at the start of a phase: whole with his acolytes, at his mark with the lamps down, or with the aspergillum loaded.
    const fran = state.foes.find(f => f.kind === 'fran'), first = state.allies.find(a => a.hp > 0);
    if (!fran || !first) return false;
    for (const f of state.foes) { f.hp = f.maxHp; delete f.intent; delete f.still; delete f.told; }
    fran.turns = 0; fran.brillo = 0; delete fran.lasting;
    if (moment === 'fran-acolitos') { fran.stage = 1; }
    else {
      fran.stage = moment === 'fran-baldaquino' ? 2 : 3;
      fran.hp = Math.floor(fran.maxHp * (moment === 'fran-baldaquino' ? LUCA.standAt : LUCA.hisopoAt));
      if (moment === 'fran-aspersion') { fran.turns = 1; fran.intent = { ability: 'aspersion', at: 'todos' }; }
    }
  } else if (moment === 'magos-bombona') {
    // Every mago standing, whole, with its Bombona charged (Bombona → todos).
    const magos = state.foes.filter(f => f.kind === 'mago' && f.hp > 0);
    if (!magos.length) return false;
    for (const m of magos) { m.hp = m.maxHp; m.intent = { ability: 'bombona', at: 'todos' }; }
  } else if (moment === 'campeon-plan' || moment === 'campeon-etapa') {
    // El Campeón with his Plan full (whole, the Rayo total his next turn), or just into his Etapa II
    // (at the edge of `stageAt` of his PV, his Plan a step from firing).
    const champion = state.foes.find(f => f.kind === 'campeon' && f.hp > 0);
    if (!champion) return false;
    champion.stage2 = moment === 'campeon-etapa';
    champion.hp = champion.stage2 ? Math.floor(champion.maxHp * CAMPING.stageAt) : champion.maxHp;
    champion.plan = planMost(champion) - (champion.stage2 ? 1 : 0);
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
