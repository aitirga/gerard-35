import type { GeoLandmark } from '../geo';
import type { LandmarkKit } from '../landmarks';
import { railing, slab } from './tanca.ts';

/**
 * A row of small front patios between a block and its street, as along Nuria's block in Cardedeu:
 * a low rendered wall on the street side (+z) with an iron railing and a gate to each patio, low
 * party walls between them, terracotta tiles, and a pot or a shrub in each. `size_m` [length,
 * depth] is the whole strip (it blocks its cells); `every_m` the patios' width; `gates` the x of each
 * gate (metres from the middle; default the middle of each patio); `colour` the walls'.
 */
export const kind = 'patis';

export function build(kit: LandmarkKit, landmark: GeoLandmark) {
  const p = landmark.params, L = landmark.w * kit.cell, D = landmark.d * kit.cell;
  const every = Number(p.every_m ?? 4.6), count = Math.max(1, Math.round(L / every)), w = L / count;
  const gates = (p.gates as number[] | undefined) ?? Array.from({ length: count }, (_, i) => -L / 2 + (i + 0.5) * w);
  const H = 0.9, rail = 0.55, gate = 1, front = D / 2 - 0.12;
  const wall = kit.mesh(), coping = kit.mesh(), bars = kit.mesh(), floor = kit.mesh();
  let x = -L / 2;
  for (const g of [...gates.slice().sort((a, b) => a - b), L / 2 + gate]) {
    const end = Math.min(L / 2, g - gate / 2);
    if (end - x > 0.05) {
      slab(wall, x, end, 0, H, front - 0.12, front + 0.12);
      slab(coping, x - 0.02, end + 0.02, H, H + 0.06, front - 0.15, front + 0.15);
      bars.quad([x, H + 0.06, front], [end, H + 0.06, front], [end, H + 0.06 + rail, front], [x, H + 0.06 + rail, front], [0, 0, 1], [x, 1], [end, 1], [end, 0], [x, 0]);
    }
    if (g > L / 2) break;
    bars.quad([g - gate / 2, 0.04, front], [g + gate / 2, 0.04, front], [g + gate / 2, H + rail, front], [g - gate / 2, H + rail, front], [0, 0, 1], [0, 1], [1, 1], [1, 0], [0, 0]);
    x = g + gate / 2;
  }
  // Party walls between the patios, and the tiles.
  for (let i = 1; i < count; i++) slab(wall, -L / 2 + i * w - 0.1, -L / 2 + i * w + 0.1, 0, 1.1, -D / 2, front - 0.12);
  floor.quad([-L / 2, 0.03, -D / 2], [L / 2, 0.03, -D / 2], [L / 2, 0.03, front], [-L / 2, 0.03, front], [0, 1, 0], [-L / 2, -D / 2], [L / 2, -D / 2], [L / 2, front], [-L / 2, front]);
  kit.add('Tapias de los patios', wall, kit.surface('estuc', String(p.colour ?? '#f4f0e8')));
  kit.add('Albardilla', coping, kit.mat('Albardilla', '#b9b3a8', 0.1), { shadows: false });
  kit.add('Rejas de los patios', bars, railing(kit), { shadows: false });
  // `rajola` is a dark photo: a tint over about #949494 in any channel is clipped there and loses its
  // hue (terracotta turns olive in the shade), so the default is the terracotta at that brightness.
  kit.add('Suelo de los patios', floor, kit.surface('rajola', String(p.tiles ?? '#946c55')), { shadows: false });
  // A pot in each patio, a geranium or a little lemon tree, or a clipped shrub.
  const clay = kit.mat('Maceta de barro', '#b8704f', 0.1);
  const leaves = [kit.mat('Hoja de patio', '#557a3e', 0.1), kit.mat('Hoja clara', '#6f9148', 0.1), kit.mat('Seto', '#4f6b3f', 0.05)];
  const flower = [kit.mat('Geranio', '#c23a3a', 0.15), kit.mat('Limón', '#e8c53a', 0.2)];
  for (let i = 0; i < count; i++) {
    const cx = -L / 2 + (i + 0.5) * w + (i % 2 ? 1.1 : -1.2), cz = -D / 2 + 0.55, k = i % 3;
    kit.part('Maceta', 'cylinder', clay, [cx, 0.22, cz], [0.5, 0.44, 0.5]);
    kit.part('Mata', 'sphere', leaves[k], [cx, 0.62 + k * 0.12, cz], [0.75, 0.6 + k * 0.25, 0.75]);
    if (k < 2) for (let f = 0; f < 4; f++) kit.part('Flor', 'sphere', flower[k], [cx + Math.cos(f * 1.7) * 0.28, 0.82 + k * 0.2 + (f % 2) * 0.12, cz + Math.sin(f * 1.7) * 0.25], [0.14, 0.14, 0.14]);
  }
}
