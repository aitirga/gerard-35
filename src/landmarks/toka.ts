import type { GeoLandmark } from '../geo';
import type { LandmarkKit } from '../landmarks';

/**
 * A toka pitch, the old men's game of the Basque villages: a strip of brick pavers between kerbs,
 * at its far end (local -z) a low wooden box with a raised back board and the toka, the iron plate the
 * discs must hit, set in it; a throwing line at the near end, and the heavy iron discs (tejos) lying
 * where they fell. The footprint is the strip (Alegia's, by the river, is in Commons' File:Toka.jpg).
 */
export const kind = 'toka';

export function build(kit: LandmarkKit, landmark: GeoLandmark) {
  const half = landmark.d * kit.cell / 2, side = landmark.w * kit.cell / 2;
  // The strip: brick pavers (the brick wall's texture laid flat) between two grey kerbs.
  const strip = kit.mesh(), kerbs = kit.mesh();
  strip.quad([-side, 0.03, -half], [side, 0.03, -half], [side, 0.03, half], [-side, 0.03, half], [0, 1, 0], [-side, -half], [side, -half], [side, half], [-side, half]);
  for (const s of [-1, 1]) kerbs.box([s * (side + 0.07), 0.06, 0], [0.14, 0.12, half * 2]);
  kit.add('Losas de la toka', strip, kit.surface('mao', '#8d5d4a', 0.15), { shadows: false });
  kit.add('Bordillos de la toka', kerbs, kit.surface('granit', '#a9a69e', 0.1));
  const wood = kit.mat('Madera de la toka', '#6b4a32', 0.15), iron = kit.mat('Hierro de la toka', '#2f3133', 0.5);
  const box = kit.mesh(), z = -half + 0.4;
  box.box([0, 0.17, z], [0.7, 0.28, 0.7]);
  box.box([0, 0.5, z - 0.32], [0.78, 0.72, 0.08]);
  for (const s of [-1, 1]) box.box([s * 0.36, 0.36, z - 0.05], [0.06, 0.44, 0.6]);
  kit.add('Caja de la toka', box, wood);
  const plates = kit.mesh();
  plates.box([0, 0.34, z], [0.22, 0.04, 0.22]);
  // The discs: a few near the box, one or two short, as a game in progress leaves them.
  for (const [x, dz] of [[0.18, 0.55], [-0.3, 0.9], [0.05, 1.6], [0.5, 2.4], [-0.15, 0.3]]) plates.box([x, 0.045, z + dz], [0.11, 0.03, 0.11]);
  kit.add('Tejos', plates, iron, { shadows: false });
  // The throwing line, chalked on the paving.
  const line = kit.mesh();
  line.quad([-side, 0.04, half - 0.6], [side, 0.04, half - 0.6], [side, 0.04, half - 0.7], [-side, 0.04, half - 0.7], [0, 1, 0], [0, 0], [1, 0], [1, 1], [0, 1]);
  kit.add('Raya de tiro', line, kit.mat('Raya de tiza', '#e9e6dc', 0.05), { shadows: false });
}
