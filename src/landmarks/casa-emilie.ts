import type { GeoLandmark } from '../geo';
import type { LandmarkKit } from '../landmarks';
import { bar, box, crown, prism } from '../landmark-shapes.ts';

/**
 * What tells Emilie's home from its neighbours on the corner of Blai and Margarit (docs/places/poble-sec.md
 * § Emilie): her top-floor balcony crowded with plants, an orange extension cable dropping from it to
 * the balcony below, the bluish light of a screen behind the glass, and on the roof a small aerial
 * and a solar panel. Nothing on it points anywhere: it is just how her home looks.
 *
 * The pivot stands on the wall it decorates, the landmark's front (+z) facing out of it and its local
 * x along it; `floor` is the height of her balcony's slab, `roof` the roof's, `deep` how far the roof
 * runs back from this wall (all in metres).
 */
export const kind = 'casa-emilie';

export function build(kit: LandmarkKit, landmark: GeoLandmark) {
  const { params } = landmark;
  const floor = Number(params.floor ?? 9.1), roof = Number(params.roof ?? 12.4), deep = Number(params.deep ?? 6), below = floor - 2.85;
  const slabs = kit.mesh(), iron = kit.mesh(), pots = kit.mesh(), leaves = kit.mesh(), flowers = kit.mesh(), cable = kit.mesh(), screen = kit.mesh();
  for (const [y, w, d] of [[floor, 3.4, 0.85], [below, 2.6, 0.6]] as const) {
    // A balcony slab and its iron railing: a top rail and close bars, as on the old fronts.
    box(slabs, 0, y - 0.14, d / 2, w, 0.14, d, 0, true);
    for (const [a, b] of [[[-w / 2, y + 1, d - 0.03], [w / 2, y + 1, d - 0.03]], [[-w / 2, y + 1, 0], [-w / 2, y + 1, d - 0.03]], [[w / 2, y + 1, 0], [w / 2, y + 1, d - 0.03]]] as const) bar(iron, [...a], [...b], 0.04);
    for (let x = -w / 2 + 0.1; x < w / 2; x += 0.13) box(iron, x, y, d - 0.04, 0.018, 1, 0.018);
    for (const s of [-1, 1]) for (let z = 0.12; z < d; z += 0.13) box(iron, s * w / 2, y, z, 0.018, 1, 0.018);
  }
  // Her balcony, crowded: pots along the railing and on the floor, a climber up the corner, a hanging pot.
  const pot = (x: number, z: number, r: number, h: number, colour: 'leaf' | 'flower', y = floor) => {
    prism(pots, x, y, z, r, h, 7);
    crown(colour === 'leaf' ? leaves : flowers, x, y + h + r * 0.6, z, r * 1.5, r * 1.4, r * 1.6, r * 0.5, 7, x * 3 + z);
  };
  [[-1.4, 0.55, 0.16, 0.28], [-0.95, 0.62, 0.12, 0.22], [-0.55, 0.5, 0.18, 0.34], [0.2, 0.62, 0.13, 0.24], [0.62, 0.55, 0.15, 0.3], [1.05, 0.6, 0.12, 0.22], [1.42, 0.45, 0.17, 0.36], [-1.2, 0.2, 0.2, 0.42]]
    .forEach(([x, z, r, h], i) => pot(x, z, r, h, i % 3 === 1 ? 'flower' : 'leaf'));
  crown(leaves, -1.62, floor + 1.7, 0.2, 0.3, 0.25, 1.1, 1.2, 6, 2);
  bar(iron, [0.9, floor + 2.3, 0.45], [0.9, floor + 2.0, 0.45], 0.015);
  pot(0.9, 0.45, 0.13, 0.16, 'leaf', floor + 1.75);
  pot(-0.6, 0.4, 0.13, 0.22, 'leaf', below);
  // The orange extension cable: tied to her railing, down the front, into the balcony below.
  const drop: [number, number, number][] = [[1.3, floor + 0.95, 0.82], [1.36, floor + 0.2, 0.9], [1.34, floor - 0.8, 0.86], [1.28, below + 1.4, 0.66], [1.18, below + 0.98, 0.52]];
  for (let i = 0; i + 1 < drop.length; i++) bar(cable, drop[i], drop[i + 1], 0.05);
  // The screen's bluish light behind the glass of her French window.
  screen.quad([-0.45, floor + 0.15, 0.03], [0.45, floor + 0.15, 0.03], [0.45, floor + 2.25, 0.03], [-0.45, floor + 2.25, 0.03], [0, 0, 1], [0, 0], [1, 0], [1, 1], [0, 1]);
  // On the roof: a small aerial on its mast, two solar panels on a frame tilted to the south (local −x
  // on this wall) and a few pots along the front edge.
  const rz = -Math.min(deep * 0.45, 3);
  prism(iron, 0.9, roof, rz, 0.035, 3.2, 6);
  for (const [y, w] of [[2.5, 1.1], [2.8, 0.9], [3.05, 0.7]] as const) box(iron, 0.9, roof + y, rz, w, 0.03, 0.03);
  for (const z of [rz - 0.9, rz + 0.9]) { box(iron, -2.1, roof, z, 0.05, 0.4, 0.05); box(iron, -0.7, roof, z, 0.05, 1.05, 0.05); }
  const pv = kit.mesh();
  for (const z of [rz - 1, rz + 0.05]) pv.quad([-2.2, roof + 0.4, z], [-2.2, roof + 0.4, z + 0.95], [-0.6, roof + 1.1, z + 0.95], [-0.6, roof + 1.1, z], [-0.5, 1, 0], [0, 0], [1, 0], [1, 1], [0, 1]);
  for (const [x, r] of [[-1.4, 0.2], [-0.5, 0.16], [0.4, 0.22], [1.3, 0.17]] as const) pot(x, -0.5, r, 0.3, 'leaf', roof);
  kit.add('Losas de balcón', slabs, kit.surface('estuc', '#d9cfbf'));
  kit.add('Barandillas de Emilie', iron, kit.mat('Hierro de balcón', '#23272a', 0.45));
  kit.add('Macetas', pots, kit.mat('Terracota', '#b4643f', 0.1));
  kit.add('Plantas de Emilie', leaves, kit.mat('Hojas de maceta', '#4f7a3a', 0.1));
  kit.add('Geranios', flowers, kit.mat('Geranio', '#c83d3d', 0.15));
  kit.add('Alargador naranja', cable, kit.mat('Alargador', '#ec7a22', 0.35), { shadows: false });
  kit.add('Luz de pantalla', screen, kit.mat('Luz de pantalla', '#8fb4ff', 0.6, 0.9), { shadows: false });
  kit.add('Placa solar', pv, kit.mat('Placa solar', '#22314a', 0.75));
}
