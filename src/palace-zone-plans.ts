import type { Environment, WorldProp } from './environments';

/**
 * Inside La Reina Bubbaloo's palace in chapter 2 (docs/places/palace-zones.md): the Rec Comtal
 * school showing through her palace, one zone at a time, each with its own main colour so a
 * screenshot names it at a glance. This file is the data: plans, glyphs, anchors and each zone's
 * theme (palette, light, real materials); `src/palace-zones.ts` builds any zone from it.
 * One cell is one metre, north is up and the camera looks from the south-east, so the north and
 * west walls stand tall and the south and east ones are cut low.
 */

export type PalaceZoneId = 'patio' | 'gimnasio' | 'secretaria' | 'trono';

/**
 * A real material from public/textures/<texture>/, tinted to `tint` (its own colours without one);
 * `size` (metres per tile) overrides the texture's own where its wear would repeat too plainly.
 */
export interface ZoneMaterial { texture: string; tint?: string; size?: number }
/**
 * What makes a zone itself. `palette` names every colour its builder paints with; `materials` lays
 * real textures on some of those surfaces (painted in the palette's colour until they load);
 * `floors` says which surface each room's floor is; `height` is how tall the north and west walls
 * stand; `light` is the scene's own light before her tone; `her` is how far La Reina Bubbaloo's
 * light takes over there (the game's tone, 0–1); `glow` is the colour of the zone's few lamps.
 */
export interface ZoneTheme {
  zone: PalaceZoneId;
  palette: Record<string, string>;
  materials: Record<string, ZoneMaterial>;
  floors: Record<string, string>;
  height: number;
  light: { ambient: string; sun: string; intensity: number };
  her: number;
  glow: string;
}

/** What each character of a zone plan stands for. Digits are doors (see each zone's interactions). */
export const ZONE_GLYPHS = {
  '.': 'suelo', ',': 'suelo del porche', 'B': 'sitio del jefe de la zona (suelo)', '#': 'muro de la escuela',
  '|': 'valla', 'P': 'puerta de la calle, sellada', 'A': 'pilar del porche', '=': 'línea de la pista, levantada',
  'H': 'canasta', 'T': 'plátano en su alcorque', 'b': 'banco', 'f': 'fuente de grifos', 'm': 'mochilas',
  'L': 'montón de objetos perdidos', 'E': 'muro con espalderas', 'M': 'colchonetas apiladas', 'C': 'carro de pelotas',
  'V': 'puerta de los vestuarios', 'r': 'cuerda (suelo)', 'o': 'aro en el suelo (suelo)', 'p': 'plinto',
  'K': 'mostrador', 'W': 'la finestreta', 'F': 'trampilla del mostrador (suelo)', 'q': 'la cola', 'N': 'muro con el tablón de corcho',
  'd': 'mesa de oficina', 'X': 'fotocopiadora', 'R': 'armarios del archivo', '~': 'montón de impresos', 'G': 'la mesa de Gerard',
  'k': 'muro con el armario de llaves', 'h': 'sillas', 'O': 'el balcón', 'S': 'escenario (suelo alto)', '_': 'borde del escenario',
  's': 'escalones del escenario (suelo)', 'c': 'bastidores', 'Q': 'el trono', 'n': 'piano',
  '1': 'puerta', '2': 'puerta', '3': 'puerta', ' ': 'fuera',
} as const;
const WALKABLE = new Set(['.', ',', 'B', 'r', 'o', 'F', 'S', 's']);
const grid = (plan: readonly string[]) => plan.map(row => [...row].map(glyph => WALKABLE.has(glyph) ? '.' : '#').join(''));

/** The school's own colour, on every door between zones: orange is the school, pink is her. */
const SCHOOL_ORANGE = '#e8742c';
const HER_PINK = '#ff6fae';

// ——— El patio ———————————————————————————————————————————————————————————————————————
/**
 * The school yard at the end of the day, under her plum sky. The porch along the north wall is
 * the zone's hub: door 1 back to the hall, 2 to the gym, 3 to the secretaría. The court's own
 * markings (side lines, halfway line, centre circle, keys, three-point arcs) have risen into
 * knee-high kerbs, a maze read from above, with gaps where a line stayed down.
 */
const PATIO_PLAN = [
  '######2##########1##########3######', // 0
  '#,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,#', // 1
  '#,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,#', // 2
  '#,,A,,,,,A,,,A,,,,,,,A,,,A,,,,,A,,#', // 3
  '#.................................|', // 4
  '#.................................|', // 5
  '#f...............................m|', // 6
  '#f...======..=========..======....|', // 7
  '#f...=====.......=.......=====...m|', // 8
  '#....=....=.............=....=....|', // 9
  '#..........=.....=.....=.........m|', // 10
  '#....=.....==..=====..==.....=....|', // 11
  '#.T..=====..=.==.B.==.=..=====...m|', // 12
  '#....=...=..=.=.....=.=..=...=....|', // 13
  '#...H=......=....L....=......=H..m|', // 14
  '#b...=...=..=.=.....=.=..=...=....|', // 15
  '#....=====..=.==...==.=..=====...m|', // 16
  '#....=.....==..=====..==.....=....|', // 17
  '#.T........=.....=.....=.........m|', // 18
  '#....=....=.............=....=....|', // 19
  '#....=====.......=.......=====...m|', // 20
  '#b...======..=========..======....|', // 21
  '#.................................|', // 22
  '#.................................|', // 23
  '|||||||||||||||||P|||||||||||||||||', // 24
];
const PATIO_PROPS: WorldProp[] = [
  // Plane trees in their pits along the west wall, as in every Barcelona yard.
  { kind: 'tree', x: 2, z: 12, species: 'plane', base: 'pit', scale: .8 }, { kind: 'tree', x: 2, z: 18, species: 'plane', base: 'pit', scale: .8 },
  { kind: 'bench', x: 1, z: 15, yaw: 90 }, { kind: 'bench', x: 1, z: 21, yaw: 90 },
];
const PATIO_THEME: ZoneTheme = {
  zone: 'patio',
  palette: {
    court: '#3f7d58', line: '#e9ece4', asphalt: '#5d5e5c', porch: '#a9a49a', wall: '#ece6da', plinth: '#8d8a83',
    door: SCHOOL_ORANGE, fence: '#9aa0a0', hoop: '#c8402e', trough: '#b9b4a8', backpack: '#2e4f7a', her: HER_PINK,
    sky: '#2a1430',
  },
  // The end of the school day: a low, flat light, already cooling, under her plum sky.
  light: { ambient: '#6c6a7c', sun: '#ffe2cc', intensity: 1.45 },
  her: .35,
  glow: '#dfe9ff',
  materials: {
    court: { texture: 'pista-pintada', tint: '#3f7d58', size: 4.5 },
    asphalt: { texture: 'asfalt', tint: '#5d5e5c' },
    porch: { texture: 'formigo', tint: '#a9a49a' },
    wall: { texture: 'estuc', tint: '#ece6da' },
    // The neighbours' brick party wall closes the yard on the west, as in Trinitat Vella.
    party: { texture: 'mao' },
  },
  floors: { 'El porche': 'porch', 'La pista': 'asphalt' },
  height: 4.6,
};
export const PALACE_PATIO: Environment = {
  id: 'palacio-patio', name: 'Palacio · El patio', spawn: { x: 17, z: 2 }, zoom: 8.5,
  grid: grid(PATIO_PLAN), houses: [], props: PATIO_PROPS,
  palace: {
    plan: PATIO_PLAN, theme: PATIO_THEME,
    rooms: [
      { name: 'El porche', x: 1, z: 1, w: 33, d: 3, floor: 'concrete' },
      { name: 'La pista', x: 1, z: 4, w: 33, d: 20, floor: 'concrete' },
    ],
    // Where the zone's boss stands, and its set-piece: the lost-property heap in the centre circle.
    anchors: { 'boss-patio': { x: 17, z: 12 }, 'la-pista': { x: 17, z: 14 } },
  },
  interactions: [
    { id: 'patio-vestibulo', cell: { x: 17, z: 1 }, label: 'Volver al vestíbulo', to: { environment: 'palacio', cell: { x: 20, z: 13 } } },
    // The story holds both doors shut until their zone may open (src/story.ts `gate`).
    { id: 'patio-gimnasio', cell: { x: 6, z: 1 }, label: 'Entrar en el gimnasio', to: { environment: 'palacio-gimnasio', cell: { x: 13, z: 16 } } },
    { id: 'patio-secretaria', cell: { x: 28, z: 1 }, label: 'Abrir la secretaría', to: { environment: 'palacio-secretaria', cell: { x: 4, z: 19 } } },
    { id: 'patio-mural', cell: { x: 12, z: 1 }, label: 'Mirar el mural', lines: ['«Benvinguts». En todas las lenguas que se hablan en el cole.', 'Alguien ha pintado encima, en rosa. Solo una palabra se lee todavía.'] },
    { id: 'patio-fuente', cell: { x: 2, z: 7 }, label: 'Mirar la fuente', lines: ['La fuente de los grifos que hay que apretar.', 'Sale un hilo de agua rosa.'] },
    { id: 'patio-objetos', cell: { x: 17, z: 13 }, label: 'Mirar los objetos perdidos', lines: ['Objetos perdidos: chaquetas, una flauta, un táper.', 'Cada junio el montón es el mismo. Nadie viene a buscarlo.'] },
    { id: 'patio-mochilas', cell: { x: 32, z: 14 }, label: 'Mirar las mochilas', lines: ['Mochilas en fila contra la valla, como cuando suena el timbre.', 'Nadie ha vuelto a por ellas.'] },
    { id: 'patio-canasta', cell: { x: 31, z: 14 }, label: 'Mirar la canasta', lines: ['La red está tiesa de chicle. Ninguna pelota pasaría.'] },
    { id: 'patio-calle', cell: { x: 17, z: 23 }, label: 'Mirar la puerta del patio', lines: ['La puerta del patio da a la Via de Bàrcino.', 'Hay chicle hasta arriba. Por aquí no sale nadie.'] },
  ],
};

// ——— El gimnasio —————————————————————————————————————————————————————————————————————
/**
 * The school gym: wall bars on the tall walls rising into a dark with no ceiling, a blue painted
 * dado, high barred windows with her plum light, and the blue mats stacked into the PE lesson's
 * obstacle course, winding from the door to El plint, the vaulting box grown into a stepped tower.
 */
/** `V`, the changing rooms, stays shut: it opens onto nothing yet. */
const GYM_PLAN = [
  '#EEEEEEEEEEEEEEEEEEVEEEEE#', // 0
  'E.....................CCC#', // 1
  'E....r..r........r..r.CCC#', // 2
  'E..MMMMMMMM....MMMMMMMM..#', // 3
  'E..M..................M..#', // 4
  'E..M..................M.b#', // 5
  'E..M........ppp....M..M.b#', // 6
  'E..M..M.....ppp....M..M..#', // 7
  'E.....M.....ppp....M..M..#', // 8
  'E..M..M.ooooo......M..M..#', // 9
  'E..M..M......B........M..#', // 10
  'E..M..MMMMMMMMMMMMMM..M.b#', // 11
  'E..M....................b#', // 12
  'E..M..................M..#', // 13
  'E..MMMMMMMMM..MMMMMMMMM..#', // 14
  'E..MMMMMMMMM..MMMMMMMMM..#', // 15
  'E........................#', // 16
  '#############1############', // 17
];
const GYM_THEME: ZoneTheme = {
  zone: 'gimnasio',
  palette: {
    mat: '#2d5a9e', matSide: '#24497f', floor: '#7d8287', dado: '#2d5a9e', wall: '#e8e2d4', plinth: '#6f747a', pine: '#c79a5b',
    line: '#e5b52e', lineWhite: '#e9ece4', tube: '#e6f0ff', shade: '#1c2333', leather: '#7a4a2c', ball: '#e07a2e',
    door: SCHOOL_ORANGE, steel: '#8f9699', her: HER_PINK, window: '#6a3f7a',
  },
  // Cold tubes overhead; her plum light only through the high windows.
  light: { ambient: '#7c8496', sun: '#e4ecff', intensity: 1.15 },
  her: .2,
  glow: '#e6f0ff',
  materials: {
    // A worn grey sports floor: the soft mottle of a render, laid large and with a sheen.
    floor: { texture: 'estuc', tint: '#7d8287', size: 3 },
    dado: { texture: 'paret-pintada', tint: '#2d5a9e' },
    wall: { texture: 'paret-pintada', tint: '#e8e2d4' },
  },
  floors: { 'El gimnasio': 'floor' },
  height: 6.5,
};
export const PALACE_GYM: Environment = {
  id: 'palacio-gimnasio', name: 'Palacio · El gimnasio', spawn: { x: 13, z: 16 }, zoom: 7.6,
  grid: grid(GYM_PLAN), houses: [], props: [],
  palace: {
    plan: GYM_PLAN, theme: GYM_THEME,
    rooms: [{ name: 'El gimnasio', x: 1, z: 1, w: 24, d: 16, floor: 'concrete' }],
    anchors: { 'boss-gimnasio': { x: 13, z: 10 }, 'el-plint': { x: 13, z: 7 } },
  },
  interactions: [
    { id: 'gimnasio-patio', cell: { x: 13, z: 16 }, label: 'Volver al patio', to: { environment: 'palacio-patio', cell: { x: 6, z: 2 } } },
    { id: 'gimnasio-espalderas', cell: { x: 1, z: 8 }, label: 'Mirar las espalderas', lines: ['Las espalderas de siempre.', 'Suben y suben. No se ve dónde acaban.'] },
    { id: 'gimnasio-cuerdas', cell: { x: 8, z: 2 }, label: 'Tocar la cuerda', lines: ['Cuerdas que bajan de un techo que no se ve.'] },
    { id: 'gimnasio-pelotas', cell: { x: 21, z: 1 }, label: 'Mirar el carro de pelotas', lines: ['El carro de las pelotas. Naranjas, todas.', 'Menos una.'] },
    { id: 'gimnasio-plinto', cell: { x: 13, z: 9 }, label: 'Mirar el plinto', lines: ['El plinto. Seis cajones, y encima más cajones.', 'Nadie ha saltado nunca tan alto.'] },
    { id: 'gimnasio-vestuarios', cell: { x: 19, z: 1 }, label: 'Mirar la puerta', lines: ['Vestidors. Huele a lejía.', 'Dentro gotea una ducha que nadie cierra.'] },
  ],
};

// ——— La secretaría ——————————————————————————————————————————————————————————————————————
/**
 * Gerard's own office, entered for once from the visitors' side: a queue that never moves faces
 * the finestreta in the counter; behind it the office repeats (the same desk in rows, then the
 * archive's aisles of back-to-back cabinets with drifts of forms), and at their end, in the far
 * corner, his own desk under the only warm lamp. *Direcció* (2) is the last shortcut, to the throne.
 */
const OFFICE_PLAN = [
  '######2#####################', // 0
  '#GG........................#', // 1
  '#....RR......RR......RR....#', // 2
  '#....RR..RR..RR~.RR..RR....#', // 3
  'k....RR..RR..RR..RR..RR....#', // 4
  '#..B.RR.~RR..RR..RR..RR....#', // 5
  '#....RR..RR..RR..RR.~RR....#', // 6
  '#....RR..RR..RR..RR..RR....#', // 7
  '#........RR......RR........#', // 8
  '#........................X.#', // 9
  '#..dd..dd.......dd..dd..dd.#', // 10
  '#..........................#', // 11
  '#..dd..dd.......dd..dd..dd.#', // 12
  '#..........................#', // 13
  '#KKKKKWKKKKKKFKKKKKKKKKKKKK#', // 14
  '#.....q....................#', // 15
  'N.....q..........hhhhhh....#', // 16
  'N.....q....................#', // 17
  '#.....qqq..................#', // 18
  '#..........................#', // 19
  '####1#######################', // 20
];
const OFFICE_THEME: ZoneTheme = {
  zone: 'secretaria',
  palette: {
    manila: '#d6b46a', steel: '#7f8a83', floor: '#9ea3a3', paper: '#f2efe6', binder: '#2f3e5c', counter: '#cbbfa6',
    wall: '#e3e0d4', dado: '#8d968c', tube: '#eef4e6', lamp: '#f2c27a', shade: '#1d2124', door: SCHOOL_ORANGE, her: HER_PINK,
  },
  // Greenish tubes overhead, flat and tiring; his desk lamp is the only warm light.
  light: { ambient: '#7d857f', sun: '#eef2e6', intensity: 1.05 },
  her: .25,
  glow: '#eef4e6',
  materials: {
    // The cool terrazzo of every public building, in 40 cm tiles.
    floor: { texture: 'terratzo', tint: '#9ea3a3', size: 3.2 },
    wall: { texture: 'paret-pintada', tint: '#e3e0d4' },
    dado: { texture: 'paret-pintada', tint: '#8d968c' },
    // Archive boxes on the cabinets: what the camera sees most, and the zone's manila.
    box: { texture: 'cartro', tint: '#d6b46a' },
  },
  floors: { 'La secretaría': 'floor', 'La sala de espera': 'floor' },
  height: 3.4,
};
export const PALACE_OFFICE: Environment = {
  id: 'palacio-secretaria', name: 'Palacio · La secretaría', spawn: { x: 4, z: 19 }, zoom: 8,
  grid: grid(OFFICE_PLAN), houses: [], props: [],
  palace: {
    plan: OFFICE_PLAN, theme: OFFICE_THEME,
    rooms: [
      { name: 'La secretaría', x: 1, z: 1, w: 26, d: 14, floor: 'tile' },
      { name: 'La sala de espera', x: 1, z: 15, w: 26, d: 5, floor: 'tile' },
    ],
    // Where the zone's boss stands, before his desk; the desk itself is the set-piece.
    anchors: { 'boss-secretaria': { x: 3, z: 5 }, 'la-mesa': { x: 2, z: 1 } },
  },
  interactions: [
    { id: 'secretaria-patio', cell: { x: 4, z: 19 }, label: 'Volver al patio', to: { environment: 'palacio-patio', cell: { x: 28, z: 2 } } },
    // The story holds Direcció shut until the zone may open (src/story.ts `gate`).
    { id: 'secretaria-direccio', cell: { x: 6, z: 1 }, label: 'Abrir Direcció', to: { environment: 'palacio-trono', cell: { x: 1, z: 16 } } },
    { id: 'secretaria-cola', cell: { x: 7, z: 17 }, label: 'Mirar la cola', lines: ['Una cola delante de la finestreta. Nadie se mueve.', 'Nadie se queja. Cada uno con su impreso en la mano.'] },
    { id: 'secretaria-finestreta', cell: { x: 5, z: 15 }, label: 'Mirar la finestreta', lines: ['La finestreta. Desde este lado nunca la había visto.', 'Desde aquí se ve mi sitio. Vacío.'] },
    { id: 'secretaria-tablon', cell: { x: 1, z: 16 }, label: 'Mirar el tablón', lines: ['Circulares, el calendario escolar, los horarios. Todo en su sitio.', 'Encima de cada hoja, una nota rosa. Sin nada escrito.'] },
    { id: 'secretaria-mesas', cell: { x: 5, z: 11 }, label: 'Mirar las mesas', lines: ['La misma mesa, una y otra vez. La misma taza, el mismo montón.', 'Ninguna es la mía.'] },
    { id: 'secretaria-fotocopiadora', cell: { x: 24, z: 9 }, label: 'Mirar la fotocopiadora', lines: ['La fotocopiadora no para.', 'Copias y copias de una hoja en blanco.'] },
    { id: 'secretaria-llaves', cell: { x: 1, z: 4 }, label: 'Mirar las llaves', lines: ['Las llaves de todas las aulas, cada una en su gancho.', 'Las cuento sin querer. Están todas.'] },
    { id: 'secretaria-mesa', cell: { x: 3, z: 1 }, label: 'Mirar mi mesa', lines: ['Mi mesa. Mi taza, el sello, el montón del día.', 'La única lámpara encendida es la mía.'] },
  ],
};

// ——— El salón del trono —————————————————————————————————————————————————————————————————
/**
 * The school's sala d'actes at night: empty folding chairs face the stage, where her throne stands
 * under one spotlight between velvet curtains; behind it the balcony opens through the north wall
 * onto the night city. The stage is raised (walkable, up its corner steps). Entered down the stair
 * behind her gum curtain (1) or, once la secretaría is won, through Direcció (2).
 */
const THRONE_PLAN = [
  '###########OOOO###########', // 0
  '#cccSSSSSSSSSSSSSSSSSSccc#', // 1
  '#cccSnnSSSSSQQQSSSSSSSccc#', // 2
  '#cccSSSSSSSSQQQSSSSSSSccc#', // 3
  '#cccSSSSSSSSSSSSSSSSSSccc#', // 4
  '#cccSSSSSSSSSSSSSSSSSSccc#', // 5
  '#...ss______________ss...#', // 6
  '#............B...........#', // 7
  '#........................#', // 8
  '#..hhhhhhhhh..hhhhhhhhh..#', // 9
  '#........................#', // 10
  '#..hhhhhhhhh..hhhhhhhhh..#', // 11
  '#........................#', // 12
  '#..hhhhhhhhh..hhhhhhhhh..#', // 13
  '#........................#', // 14
  '#..hhhhhhhhh..hhhhhhhhh..#', // 15
  '2........................#', // 16
  '#..hhhhhhhhh..hhhhhhhhh..#', // 17
  '#........................#', // 18
  '#........................#', // 19
  '#........................#', // 20
  '############11############', // 21
];
const THRONE_THEME: ZoneTheme = {
  zone: 'trono',
  palette: {
    curtain: '#232a5c', night: '#10132b', gold: '#c9a046', stage: '#5a3b2a', floor: '#3b2c26', runner: '#7a5a2e',
    spot: '#fff4dc', wall: '#283063', dado: '#4a3426', shade: '#0b0d1c', chair: '#8f9699', seat: '#3d4150',
    door: SCHOOL_ORANGE, her: HER_PINK, core: '#ff3d8b',
  },
  // Night: cold light from the balcony and the windows; the spotlight and her core do the rest.
  light: { ambient: '#353d6c', sun: '#8f9fe0', intensity: .7 },
  her: .2,
  glow: '#fff4dc',
  materials: {
    floor: { texture: 'fusta-escenari', tint: '#3b2c26', size: 2.4 },
    stage: { texture: 'fusta-escenari', tint: '#5a3b2a', size: 2 },
    dado: { texture: 'fusta-escenari', tint: '#4a3426', size: 1.6 },
    wall: { texture: 'paret-pintada', tint: '#283063' },
    curtain: { texture: 'vellut', tint: '#232a5c', size: .6 },
    runner: { texture: 'vellut', tint: '#7a5a2e', size: .6 },
  },
  floors: { 'El escenario': 'floor', 'La platea': 'floor' },
  height: 6,
};
export const PALACE_THRONE: Environment = {
  id: 'palacio-trono', name: 'Palacio · El salón del trono', spawn: { x: 12, z: 19 }, zoom: 7.8,
  grid: grid(THRONE_PLAN), houses: [], props: [],
  palace: {
    plan: THRONE_PLAN, theme: THRONE_THEME,
    rooms: [
      { name: 'El escenario', x: 1, z: 1, w: 24, d: 6, floor: 'deck' },
      { name: 'La platea', x: 1, z: 7, w: 24, d: 14, floor: 'deck' },
    ],
    // The final confrontation, before the stage; her throne in the spotlight is the set-piece.
    anchors: { 'boss-reina': { x: 13, z: 7 }, 'el-escenario': { x: 13, z: 3 } },
  },
  interactions: [
    // Down the stair to her hall, out through the gum curtain behind the guards.
    { id: 'trono-escalera', cell: { x: 12, z: 20 }, label: 'Bajar por la escalera', to: { environment: 'palacio', cell: { x: 16, z: 11 } } },
    // Direcció opens from this side: the secretaría is locked from inside.
    { id: 'trono-direccio', cell: { x: 1, z: 16 }, label: 'Volver a la secretaría', to: { environment: 'palacio-secretaria', cell: { x: 6, z: 1 } } },
    { id: 'trono-sillas', cell: { x: 12, z: 11 }, label: 'Mirar las sillas', lines: ['Las sillas plegables de las fiestas de la escuela.', 'Todas mirando al escenario, como si fuera a empezar algo.'] },
    { id: 'trono-piano', cell: { x: 7, z: 2 }, label: 'Mirar el piano', lines: ['El piano de los conciertos de fin de curso.', 'Hay una partitura abierta. No tiene título.'] },
    { id: 'trono-trono', cell: { x: 13, z: 4 }, label: 'Mirar el trono', lines: ['Su trono. Una bola de chicle del tamaño de un coche.', 'Vacío. Todavía está caliente.'] },
    { id: 'trono-balcon', cell: { x: 13, z: 1 }, label: 'Asomarse al balcón', lines: ['Barcelona de noche. La torre de colores, la Meridiana entera.', 'Desde aquí se ve casa.'] },
  ],
};
