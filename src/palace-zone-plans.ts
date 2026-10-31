import type { Environment, WorldProp } from './environments';

/**
 * Inside La Reina Bubbaloo's palace in chapter 2 (docs/places/palace-zones.md): the Rec Comtal
 * school showing through her palace, one zone at a time, each with its own main colour so a
 * screenshot names it at a glance. This file is the data: plans, glyphs, anchors and each zone's
 * theme (palette, light, real materials); `src/palace-zones.ts` builds any zone from it.
 * One cell is one metre, north is up and the camera looks from the south-east, so the north and
 * west walls stand tall and the south and east ones are cut low.
 */

export type PalaceZoneId = 'patio' | 'gimnasio';

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
  '1': 'puerta', '2': 'puerta', '3': 'puerta', ' ': 'fuera',
} as const;
const WALKABLE = new Set(['.', ',', 'B', 'r', 'o']);
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
    { id: 'patio-secretaria', cell: { x: 28, z: 1 }, label: 'Abrir la secretaría' },
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
