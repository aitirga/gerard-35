import type { GeoLandmark } from '../geo';
import type { LandmarkKit } from '../landmarks';
import { box, prism, crown } from '../landmark-shapes.ts';

/**
 * A pintxos bar's terrace on Carrer de Blai (docs/places/poble-sec.md): a strip along the bar's front,
 * its local x along the street and its back (−z) against the wall. Square aluminium tables in a
 * row, two folding chairs at each, plates of pintxos on some, a parasol folded shut at one end, a
 * planter closing the other and the bar's A-frame chalkboard out on the slabs. Low, so it never
 * hides Gerard. `canvas`: the parasol's colour; `board`: the chalkboard's words; `seed` varies it.
 */
export const kind = 'terrassa-blai';

export function build(kit: LandmarkKit, landmark: GeoLandmark) {
  const { params } = landmark;
  const length = landmark.w * kit.cell, depth = landmark.d * kit.cell;
  const seed = Number(params.seed ?? 0);
  const rand = (i: number) => { const v = Math.sin((seed + 1) * 91.7 + i * 47.3) * 43758.5453; return v - Math.floor(v); };
  const metal = kit.mesh(), plates = kit.mesh(), food = kit.mesh(), planter = kit.mesh(), leaves = kit.mesh(), canvas = kit.mesh();
  const tables = Math.max(1, Math.floor((length - 1.4) / 1.55));
  const span = (tables - 1) * 1.55;
  for (let t = 0; t < tables; t++) {
    const tx = -span / 2 + t * 1.55 + 0.3, tz = (rand(t) - 0.5) * 0.12;
    // A square aluminium table on one leg and a cross foot.
    box(metal, tx, 0.7, tz, 0.62, 0.035, 0.62, 0, true);
    box(metal, tx, 0.02, tz, 0.05, 0.68, 0.05);
    box(metal, tx, 0, tz, 0.5, 0.025, 0.06); box(metal, tx, 0, tz, 0.06, 0.025, 0.5);
    for (const side of [-1, 1]) {
      // A folding chair on each side of it, along the street, a little askew.
      const cx = tx + side * 0.55, cz = tz + (rand(t * 3 + side) - 0.5) * 0.2, yaw = (rand(t * 7 + side) - 0.5) * 0.5;
      box(metal, cx, 0.43, cz, 0.42, 0.03, 0.42, yaw, true);
      box(metal, cx + side * 0.2 * Math.cos(yaw), 0.46, cz - side * 0.2 * Math.sin(yaw), 0.03, 0.42, 0.4, yaw);
      for (const leg of [-1, 1]) box(metal, cx + leg * 0.17 * Math.sin(yaw), 0, cz + leg * 0.17 * Math.cos(yaw), 0.4, 0.43, 0.025, yaw);
    }
    if (rand(t + 11) > 0.35) {
      // A plate of pintxos on their toothpicks, and a glass of vermut.
      box(plates, tx - 0.08, 0.735, tz, 0.24, 0.015, 0.18, 0, false);
      for (let k = 0; k < 3; k++) box(food, tx - 0.16 + k * 0.08, 0.75, tz + (rand(t * 5 + k) - 0.5) * 0.06, 0.06, 0.035, 0.05);
      prism(plates, tx + 0.17, 0.735, tz + 0.12, 0.03, 0.09, 6);
    }
  }
  // At one end a parasol folded shut on its pole; at the other a planter screening the terrace.
  const end = length / 2 - 0.4, flip = rand(99) > 0.5 ? 1 : -1;
  prism(metal, flip * end, 0, -depth / 2 + 0.45, 0.25, 0.06, 8);
  prism(metal, flip * end, 0.06, -depth / 2 + 0.45, 0.025, 2.3, 6);
  prism(canvas, flip * end, 1.25, -depth / 2 + 0.45, 0.11, 1.2, 8);
  box(planter, -flip * end, 0, 0, 0.36, 0.5, Math.min(1.4, depth - 0.2));
  crown(leaves, -flip * end, 0.62, -0.25, 0.28, 0.32, 0.32, 0.1, 7, seed);
  crown(leaves, -flip * end, 0.6, 0.28, 0.26, 0.3, 0.38, 0.1, 7, seed + 2);
  kit.add('Mesas y sillas de la terraza', metal, kit.mat('Aluminio de terraza', '#b7babb', 0.55));
  kit.add('Platos', plates, kit.mat('Loza blanca', '#f1eee6', 0.5), { shadows: false });
  kit.add('Pinchos', food, kit.mat('Pinchos', '#c98a4a', 0.2), { shadows: false });
  kit.add('Plantas de la jardinera', leaves, kit.mat('Boj', '#4f6d3a', 0.1), { shadows: false });
  kit.add('Sombrilla cerrada', canvas, kit.mat('Lona de sombrilla', String(params.canvas ?? '#e6dcc4'), 0.15), { shadows: false });
  // The bar's A-frame chalkboard, out on the slabs at the terrace's front corner, read from the street.
  const words = String(params.board ?? 'PINTXOS');
  const boardX = flip * (end - 0.8), boardZ = depth / 2 + 0.25;
  box(planter, boardX, 0, boardZ - 0.12, 0.62, 0.95, 0.04, 0);
  box(planter, boardX, 0, boardZ + 0.12, 0.62, 0.95, 0.04, 0);
  kit.add('Jardinera y pizarra', planter, kit.mat('Madera de terraza', '#4f3d2c', 0.1), { shadows: false });
  const chalk = kit.mat(`Pizarra ${words}`, '#ffffff', 0.1);
  chalk.diffuseMap = kit.texture(board(words)); chalk.update();
  const face = kit.mesh();
  face.quad([boardX - 0.27, 0.12, boardZ + 0.145], [boardX + 0.27, 0.12, boardZ + 0.145], [boardX + 0.27, 0.9, boardZ + 0.145], [boardX - 0.27, 0.9, boardZ + 0.145], [0, 0, 1], [0, 1], [1, 1], [1, 0], [0, 0]);
  kit.add('Pizarra escrita', face, chalk, { shadows: false });
}

/** The chalkboard: the bar's word in chalk over a few lines of prices. */
function board(words: string) {
  const c = document.createElement('canvas'); c.width = 96; c.height = 136;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#23292a'; ctx.fillRect(0, 0, 96, 136);
  ctx.fillStyle = '#f2efe6'; ctx.textAlign = 'center';
  let size = 22; ctx.font = `700 ${size}px "Helvetica Neue", Arial, sans-serif`;
  while (ctx.measureText(words).width > 86 && size > 10) { size -= 1; ctx.font = `700 ${size}px "Helvetica Neue", Arial, sans-serif`; }
  ctx.fillText(words, 48, 30);
  ctx.fillStyle = 'rgba(242,239,230,.75)';
  for (let k = 0; k < 5; k++) { ctx.fillRect(12, 48 + k * 16, 44 - (k * 7) % 18, 3); ctx.fillRect(68, 48 + k * 16, 16, 3); }
  ctx.fillStyle = '#f2c27a'; ctx.fillRect(12, 126, 72, 3);
  return c;
}
