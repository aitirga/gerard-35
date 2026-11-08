import type { GeoLandmark } from '../geo';
import type { LandmarkKit } from '../landmarks';
import { bar, box } from '../landmark-shapes.ts';

/**
 * A blackboard on an easel by the pool (Càmping Eurosport, docs/quests/universidad.md § La piscina):
 * the board of Las parcelas, moved from the reception. Two legs and a back strut of pine, the board
 * leaning back, *TORNEO* chalked at the top and the rest wiped; it faces local +z (the camera).
 */
export const kind = 'pissarra';

export function build(kit: LandmarkKit, _landmark: GeoLandmark) {
  const wood = kit.mesh(), W = 1.15, H = 0.9, y0 = 0.75, lean = 0.12;
  // Two front legs and a strut behind, as an easel.
  for (const x of [-W / 2 + 0.05, W / 2 - 0.05]) bar(wood, [x, 0, 0.12], [x, y0 + H + 0.15, -0.05], 0.06);
  bar(wood, [0, 0, -0.55], [0, y0 + H, -0.08], 0.05);
  box(wood, 0, y0 - 0.06, 0.1, W + 0.06, 0.06, 0.12);
  kit.add('Caballete', wood, kit.surface('fusta-passera', '#8a6a48'));
  const board = kit.mat('Pizarra del torneo', '#ffffff', 0.15);
  if (!board.diffuseMap) { board.diffuseMap = kit.texture(paint()); board.update(); }
  const q = kit.mesh(), zb = 0.09, zt = zb - lean;
  q.quad([-W / 2, y0, zb], [W / 2, y0, zb], [W / 2, y0 + H, zt], [-W / 2, y0 + H, zt], [0, 0.13, 1], [0, 1], [1, 1], [1, 0], [0, 0]);
  kit.add('Pizarra del torneo', q, board, { shadows: false });
}

function paint() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 200;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#2b3530'; ctx.fillRect(0, 0, 256, 200);
  for (let i = 0; i < 16; i++) {
    ctx.fillStyle = `rgba(220,225,215,${0.03 + (i % 4) * 0.012})`;
    ctx.beginPath(); ctx.ellipse((i * 71) % 240 + 8, (i * 43) % 180 + 10, 28 + (i % 3) * 12, 9, (i % 5) * 0.3, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = '#ecebe2'; ctx.textAlign = 'center';
  ctx.font = '700 28px "Chalkboard SE", "Bradley Hand", "Segoe Print", cursive'; ctx.fillText('TORNEO', 128, 40);
  ctx.fillRect(78, 50, 100, 2);
  ctx.font = '400 15px "Chalkboard SE", "Bradley Hand", "Segoe Print", cursive';
  ctx.fillText('Asignación de parcelas', 128, 84);
  return c;
}
