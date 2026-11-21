/**
 * Chapter 1, block 1: Gerard's birthday morning in Sant Quirze. Lines, places and tutorials live
 * here; `src/story.ts` decides when each one plays. docs/chapter-1.md explains the design.
 */
import type { Dialogue, DialogueLine } from './dialogue';
import { MERIDIANA_BED } from './bed.ts';

const g = (text: string, expression?: string): DialogueLine => ({ speaker: 'gerard', text, expression });
const mama = (text: string): DialogueLine => ({ speaker: 'mama', text });
/** Mama going on: these lines run into each other and a press cuts her off. */
const mamaRuns = (text: string): DialogueLine => ({ speaker: 'mama', text, pace: 'rambling' });
const jan = (text: string): DialogueLine => ({ speaker: 'jan', text });
const bernat = (text: string): DialogueLine => ({ speaker: 'bernat', text });
/** Chapter 2: Gerard at 35, and Aitor. */
const gerard35 = (text: string): DialogueLine => ({ speaker: 'gerard35', text });
const aitor = (text: string): DialogueLine => ({ speaker: 'aitor', text });
const withAitor = (...lines: DialogueLine[]): Dialogue => ({ left: 'gerard35', right: 'aitor', lines });
const solo = (...lines: DialogueLine[]): Dialogue => ({ left: 'gerard', lines });
const withMama = (...lines: DialogueLine[]): Dialogue => ({ left: 'gerard', right: 'mama', lines });
const withJan = (...lines: DialogueLine[]): Dialogue => ({ left: 'gerard', right: 'jan', lines });
const withBernat = (...lines: DialogueLine[]): Dialogue => ({ left: 'gerard', right: 'bernat', lines });

/** Where the people and loose things of block 1 stand. Cells must be walkable (see tests). */
export const PLACES = {
  /** Gerard wakes up beside his bed. */
  wake: { environment: 'home-floor-2', cell: { x: 3, z: 4 } },
  mama: { environment: 'home-floor-1', cell: { x: 18, z: 10 } },
  jan: { environment: 'home-floor-2', cell: { x: 17, z: 12 } },
  /** On Jan's desk; picked up from the floor next to it. */
  pocion: { environment: 'home-floor-2', cell: { x: 17, z: 10 } },
  /** Hanging by the front door in the recibidor. */
  mochila: { environment: 'home-floor-1', cell: { x: 5, z: 1 } },
  /** Bernat steps out of his front patio when he joins. */
  bernat: { environment: 'maresme', cell: { x: 9, z: 24 } },
  /** Walking past this row with Bernat makes him stop: the dogs are just below. */
  southRow: 30,
  /** La Reina Bubbaloo's minion lives in the manhole at the bottom of the street, among the dogs. */
  minion: { manhole: { x: 15, z: 38 } },
  /**
   * La Reina Bubbaloo's palace rises past the north end of the street (docs/bubbaloo-palace.md):
   * `gate` is the middle of La Pompa in street cells, `door` the cell in front of it.
   */
  palace: { gate: { x: 16, z: 0.6 }, door: { x: 16, z: 2 } },
  /** Inside the palace: where La Pompa lets them in, and the strawberry gum bowl in the gallery. */
  palaceEntry: { environment: 'palacio', cell: { x: 16, z: 18 } },
  chicle: { environment: 'palacio', cell: { x: 5, z: 9 } },
  /**
   * Chapter 2 opens in the Meridiana flat: Gerard and Aitor asleep in the double bed (src/bed.ts),
   * heads on the pillows against the south wall (`bed` is where Gerard rests: east, Aitor west).
   * Gerard wakes with a start and gets out on his side (`wakeUp`); Aitor gets out on his (`aitor`).
   * The Bubbaloo wrapper lies on Gerard's nightstand (`spot`), picked up from the cell in front of it.
   */
  bed: MERIDIANA_BED.sleepers.gerard.rest,
  wakeUp: { environment: 'meridiana', cell: MERIDIANA_BED.sleepers.gerard.stand },
  /** The bedroom's door onto the hallway (east wall): the morning light comes in through it. */
  bedroomDoor: { x: 13, z: 8 },
  aitor: { environment: 'meridiana', cell: MERIDIANA_BED.sleepers.aitor.stand },
  envoltorio: { environment: 'meridiana', cell: { x: 12, z: 15 }, spot: { x: 11.78, z: 16.45, y: .53 } },
  /** The drain in the wrapper room the second minion rises from. */
  drain: { x: 5, z: 16 },
  /** Past this row, on the way back south, Bernat reminds Gerard where the palace is. */
  awayRow: 24,
} as const satisfies Record<string, unknown>;

/** How far Gerard may wander from Bernat once he stops, in cells. */
export const LEASH = 4;

export const LINES = {
  wake: solo(g('Avui... és el meu aniversari! Yupi!'), g('Però quina merda, he de marxar al col·legi... a veure què m\'ha preparat la mama')),
  jan: withJan(
    jan('Eii! Felicitats, Gerard!'),
    g('Mercii, vaig corrents que arribo tard al cole'),
    jan('OK, Gerard! Jo avui... crec que em quedo a caseta'),
    jan('I mira quin frasc més curiós que tinc: té llums a dins. Com ecos de llum, saps?'),
  ),
  janAgain: withJan(jan('Venga, baixa ja, que la mama t\'espera')),
  pocion: solo(g('Un frasc amb llums a dins... serà un efecte òptic?')),
  /** Mama does not stop talking: her `rambling` lines run into each other, and pressing cuts her off (src/dialogue.ts). */
  mama: withMama(
    mamaRuns('Aiii! Felicitats, Gerard! Ja et fas graaan!'),
    mamaRuns('I mira, has d\'anar al metge, que no m\'agrada gens aquesta tos.'),
    mamaRuns('De fet, després li has de donar classe al teu germà, que crec que últimament no està gaire pendent de l\'escola.'),
    mamaRuns('Aiii, ahir mateix vaig veure la teva cosina Helena, està tan petitona...'),
    mamaRuns('I la teva àvia vindrà després a dinar, eh, que no se t\'oblidi.'),
    mamaRuns('I recorda sobretot, i molt important, que has de comprar pa quan tornis de l\'escola.'),
    mamaRuns('El teu pare no sé on s\'ha quedat, em va dir que demanava un dia per assumptes propis, però al final...'),
    mamaRuns('...al final res, com sempre, i jo aquí amb tot: que si la rentadora, que si el forn, que si la teva tia...'),
    mamaRuns('...i la veïna del tercer, que t\'ho he dit? S\'ha tornat a deixar les claus a dins, la pobra...'),
    mamaRuns('...i el pa, eh, el pa, que l\'altre dia el vas portar tou i el teu pare...'),
    g('Sii, ja ho seee, merciii, adeeeu'),
    mama('Espeeera! Agafa aquest regalet que t\'he comprat.'),
    mamaRuns('Però recorda sobretot que, quan vagis a comprar el pa, és molt important que tinguis en compte que el pa sempre ha d\'estar cruixent, vigila amb això, d\'acord?'),
    g('Alaaa! Sabatilles! Amb això aniré súper ràpid'),
    mama('Bueno, així aniràs més ràpid. Recorda agafar la motxilla i, sobretot, sobretot, has de comprar el pa després'),
    mama('Ah, i passa a recollir el Bernat de camí'),
  ),
  /** Still going: the same run of sentences as `mama`, cut off by pressing. */
  mamaWaiting: withMama(
    mamaRuns('Encara ets aquí? Gerard, que faràs tard!'),
    mamaRuns('La motxilla és al rebedor, on sempre, que no sé per què cada dia l\'has de buscar com si fos la primera vegada...'),
    mamaRuns('I passa a buscar el Bernat, eh, que la seva mare em va dir que últimament s\'adorm, pobret, que no sé què li passa...'),
    mamaRuns('...i el pa, recorda el pa, cruixent, eh, que tou no el vol ningú, i el teu pare encara menys...'),
    mamaRuns('...i tapa\'t el coll, amb aquesta tos, que després tot són corredisses i qui va a la farmàcia? Jo...'),
  ),
  mamaBye: withMama(mama('Venga! Que arribaràs tard, vigila amb aquesta tos i mira d\'ajudar després el teu germà, pensa que diumenge sopem amb els tiets, així que no facis plans pel finde...')),
  leaveBeforeBreakfast: solo(g('Hmmm quin bon dia que m\'espera! M\'encanta el meu cumple')),
  leaveWithoutBackpack: withMama(mama('Gerard! Recorda! La motxilla! I sobretot, no t\'oblidis del pa, i com t\'he dit, o no sé si t\'ho he dit, el cap de setmana, diumenge, hem de marxar a Vilassar a fer un dinar, i recorda sobretot que no trepitgis res amb les sabatilles noves, que les has de cuidar')),
  bernatNotYet: solo(g('La motxilla... torno')),
  bernatJoins: withBernat(
    g('Bernaaat, vaaa, que arribem tard'),
    bernat('Ja vaig! Un moment!'),
    bernat('Ei! Per molts anys, Gerard! Quines sabatilles més maques!'),
    g('Just ara me les han regalat!'),
    { speaker: 'bernat', text: 'Som-hi... encara que, no sé, avui he tingut un mal somni...', pace: 'spooky' },
  ),
  bernatHere: withBernat(bernat('Ei, torna cap aquí')),
  dejavu: withBernat(
    g('Hmm, Bernat, per què et quedes quiet? Som-hi, que no hi arribem!'),
    bernat('Ai... és que... és el mateix que en el somni d\'aquesta nit: tu amb les sabatilles, el cumple, els gossos allà baix, la bombolla...'),
    g('Tens un... déjà-vu?'),
    bernat('És que és EXACTAMENT el somni que he tingut avui. Tinc por, Gerard, anem a casa. Has vist la claveguera?'),
  ),
  /** After the minion's head pops its bubble and sinks; the dogs' eyes are pink and the fight starts right after. */
  minion: withBernat(
    g('Això... què és això?'),
    g('Sembla com un... xiclet'),
    bernat('És que és el mateix... ho estic veient, perquè hi penso tant, perquè vaig parlar amb la llum'),
    g('Em començo a preocupar, Bernat. De què parles? Què dius?'),
    g('Bernat... mira els gossos... tenen els ulls... com rosa...'),
    bernat('Gerard, compte! Ens ataquen!!'),
  ),
  /** The first fight is won: the light has turned. */
  afterFight: withBernat(
    g('Han desaparegut... què està passant, Bernat?'),
    bernat('És que és el meu somni, ara tot canviarà, ella no pararà...'),
    g('Hmmm, ho veig tot més fosc... i més... rosa?'),
    bernat('Gerard... mira els edificis...'),
  ),
  /** The palace has risen at the north end of the street. */
  palaceRises: withBernat(
    g('¿Qué… qué es això?'),
    bernat('És justament el meu somni, Gerard, és el Palau... de la Reina Bubbaloo...'),
    g('Però... si només era un joc, Bernat, és impossible'),
    bernat('No m\'ho puc creure, és com la meva imaginació plasmada a la vida real... és... magnífic!'),
    g('Calla, Bernat, calla...'),
  ),
  bernatPalace: withBernat(bernat('Hmm, crec que hem de continuar a dins d\'això... xiclós')),
  /** Through La Pompa for the first time. */
  inPalace: withBernat(
    bernat('Puaj! Tinc xiclet fins i tot a les orelles'),
    g('Quina bogeria...'),
    bernat('Fa olor de maduixa... ho notes?'),
  ),
  leaveLocked: solo(g('Ja no podem sortir... què és això, Bernat?')),
  curtain: withBernat(
    g('És com una cortina feta de xiclet...'),
    bernat('Ai, ai, ai... al meu somni la reina estava a dalt, però encara no, encara no... la reina es pot materialitzar de moltes maneres'),
  ),
  backDoorStuck: solo(g('Aquesta porta està enganxada amb xiclet. No es mou ni un mil·límetre.')),
  portrait1: withBernat(g('«La coronació». Se l\'està ficant ella mateixa...'), bernat('És que ningú més s\'hi atrevia.')),
  portrait2: solo(g('«Al tron». Asseguda en una bola de xiclet gegant… amb cara d\'avorrir-se moltíssim.')),
  portrait3: withBernat(g('«La gran pompa». El marc està abonyegat per la pompa.'), bernat('Aquesta la vaig dibuixar jo. Igualeta.')),
  portrait4: solo(g('«Des del balcó». Saluda una ciutat de nit: una torre de colors, una avinguda llarguíssima…'), g('No és Sant Quirze.')),
  portrait5: withBernat(g('Aquest és… un dibuix amb retoladors. Signat: «Bernat».'), bernat('…Això ho tenia penjat a la meva habitació.')),
  chicle: solo(g('Anda, quants xiclets hehe')),
  /** Stepping into the wrapper room: the drain gurgles, then the minion rises. */
  drainGurgle: withBernat(g('Ho sents?... ve de la claveguera')),
  drainRises: withBernat(bernat('És un esbirro de la reina, és tal com me l\'imaginava...! Compte, Gerard!'), g('Bernat, enrere!')),
  /** Matemágico's fire has burst the minion. */
  afterMatemagico: withBernat(
    bernat('Què… què ha sigut això? Has fet foc amb les mans...?'),
    g('No ho sé. He pensat en números, en mates, i m\'ha sortit sol...'),
    bernat('Que fort'),
    g('A veure, Bernat, què collons està passant aquí? En serio, ara...'),
    bernat('Doncs crec que som al castell, al palau de la Reina Bubbaloo... i no saps totes les coses que m\'he imaginat d\'ella...'),
    bernat('I ella és real, Gerard... ai no, és que me\'n recordo perfectament, ara morirem, Gerard, ens morim, mira, MIRA!'),
  ),
  /** Chapter 2: Gerard wakes up with a start in the Meridiana flat, and Aitor is there. */
  waking: withAitor(
    gerard35('¡NO!'),
    aitor('Ey, que pasa Gerard? Tranqui, soy yo'),
    aitor('Estabas gritando «¡no!» en sueños. Llevándome la contraria hasta dormido.'),
    gerard35('He tingut un somni rarísim... amb el Bernat. Amb Sant Quirze, amb un castell... unas manos de chicle enormes.'),
    aitor('¿Manos de chicle? Eso te pasa por cenar pizza a las once.'),
    aitor('Venga, despierta del todo. Felicidades, Gerard. Treinta y cinco, ¿eh?'),
    gerard35('…Treinta y cinco. Sí.'),
    aitor('Venga, el meu regal, 35 horas de rascado! jeje'),
  ),
  aitorAgain: withAitor(aitor('Feliz cumpleaños, dormilón. El café está en la cocina… si te lo haces tú.')),
  envoltorio: withAitor(
    gerard35('Un envoltorio de chicle. Bubbaloo, de fresa.'),
    gerard35('…Estaba en mi mesilla. Y huele igual que en el sueño.'),
  ),
  bernatInPalace: withBernat(bernat('No et separis. Al meu somni, aquest lloc no s\'acabava mai.')),
  bernatAfterMatemagico: withBernat(bernat('Matemágico. Així et diré. El que fa màgia amb el cap.')),
  bernatFight: withBernat(bernat('Gerard, els gossos! Els hem de treure aquest rosa dels ulls!')),
  bernatAfter: withBernat(bernat('No em miris així. Aquests gossos ahir no eren al carrer… eren al meu somni.')),
  bernatAfterFight: withBernat(bernat('La Reina Bubbaloo només era un joc. Un joc, Gerard. Amb corona de xiclet.')),
} satisfies Record<string, Dialogue>;

/** Said inside the palace fight, as speech over their heads (the rest of the HUD is shut during fights). */
export const BATTLE_LINES = {
  aboutToDie: { speaker: 'bernat', text: 'Gerard, em matarà' },
  /** Bernat, on his knees, says it in Catalan: it is what wakes Matemágico. */
  think: { speaker: 'bernat', text: 'Pensa, Gerard! Pensa, ho fas molt bé això, fes la màgia amb la teva ment!' },
} as const satisfies Record<string, DialogueLine>;

/**
 * Key hints: a key and a verb, shown the first time the action makes sense and gone once used.
 * They never say what to do or where to go; that comes from exploring and from people.
 */
export const HINTS = {
  // `glyph` names the key in input-glyphs.ts, shown for whichever device is in use.
  run: { glyph: 'run', verb: 'Correr' },
  items: { glyph: 'items', verb: 'Objetos' },
  party: { glyph: 'party', verb: 'Estado' },
  /** Chapter 2: Aitor walks with Gerard, and a second controller can take him. */
  duo: { keys: 'Mando 2', verb: 'Jugar como Aitor' },
} as const;
export type HintId = keyof typeof HINTS;

export const CARDS = {
  intro: { kicker: 'PRÓLOGO · SANT QUIRZE DEL VALLÈS', title: '22 de noviembre del 19XX', text: 'Hoy es tu cumpleaños.' },
} as const;
export type CardId = keyof typeof CARDS;

/** What Bernat mutters over his head while he stalls, one more line each time Gerard pulls away. */
export const BUBBLES = {
  stalled: ['Gerard…?', 'Espera.', 'Això… ja ho he vist.'],
  /** Heading back south once the palace has risen. */
  away: ['És per l\'altre costat.'],
  /** Aitor, when two players pull apart further than the camera can follow. */
  tether: ['¡Eh, espérame!', '¿A dónde vas tan rápido?'],
} as const;
