import type { GeoLandmark } from '../geo';
import type { LandmarkKit } from '../landmarks';

/**
 * A campsite's reception hut (Càmping Eurosport, docs/quests/universidad.md § La entrada): a low
 * whitewashed hut under a flat roof with a deep eave, RECEPCIÓ painted on the fascia, green
 * shutters, the counter window's shutter rolled down, the door shut, a lamp lit over it, and the
 * notice blackboard on the front wall (local +z, the camera), in the middle, where Las parcelas'
 * clues are chalked. Nobody inside. Tall enough to hide Gerard: it opens the cut.
 */
export const kind = 'recepcio';

/** The blackboard's centre on the front wall, from the pivot (metres), and its size. */
export const BLACKBOARD = { x: 0.05, y: 1.3, z: 2.12, w: 1.2, h: 0.9 };

export function build(kit: LandmarkKit, landmark: GeoLandmark) {
  const W = Math.min(5.4, landmark.w * kit.cell - 0.6), front = 2.05, back = -2.3, H = 2.7;
  const walls = kit.mesh(), base = kit.mesh(), roof = kit.mesh(), green = kit.mesh(), wood = kit.mesh(), metal = kit.mesh(), lamp = kit.mesh();
  walls.box([0, H / 2, (front + back) / 2], [W, H, front - back]);
  base.box([0, 0.22, (front + back) / 2], [W + 0.04, 0.44, front - back + 0.04]);
  // The flat roof with a deep eave over the front, and its fascia.
  roof.box([0, H + 0.09, (front + back) / 2 + 0.15], [W + 0.5, 0.18, front - back + 0.7]);
  green.box([0, H + 0.08, front + 0.5], [W + 0.54, 0.3, 0.06]);
  // Left: the counter window, its grey shutter down, green shutters open beside it. Right: the door.
  metal.box([-1.75, 1.35, front + 0.02], [0.9, 1.0, 0.05]);
  wood.box([-1.75, 0.82, front + 0.12], [1.05, 0.06, 0.24]);
  for (const x of [-2.42, -1.08]) green.box([x, 1.35, front + 0.03], [0.4, 1.1, 0.05]);
  wood.box([1.75, 1.05, front + 0.02], [0.95, 2.1, 0.06]);
  metal.box([1.42, 1.0, front + 0.07], [0.04, 0.16, 0.04]);
  // The lamp over the door, lit.
  metal.box([1.75, 2.3, front + 0.1], [0.06, 0.06, 0.2]);
  lamp.box([1.75, 2.18, front + 0.2], [0.16, 0.18, 0.16]);
  kit.add('Recepción', walls, kit.surface('estuc', '#ebe4d3'), { cut: true });
  kit.add('Zócalo de la recepción', base, kit.mat('Zócalo', '#b8ad97', 0.1), { cut: true });
  kit.add('Tejado de la recepción', roof, kit.mat('Losa del tejado', '#8a8174', 0.1), { cut: true });
  kit.add('Persianas verdes', green, kit.mat('Verde carpintería', '#3f5a45', 0.25), { cut: true });
  kit.add('Puerta y mostrador', wood, kit.surface('fusta-passera', '#8a6a48'), { cut: true });
  kit.add('Persiana metálica', metal, kit.mat('Persiana metálica', '#8d918e', 0.45), { cut: true });
  kit.add('Farol de la puerta', lamp, kit.mat('Bombilla del camping', '#ffad4a', 0.4, 1.5), { shadows: false });
  // The fascia's letters and the blackboard, painted.
  const sign = kit.mat('Rótulo RECEPCIÓ', '#ffffff', 0.3);
  sign.diffuseMap = kit.texture(paintFascia()); sign.update();
  const fascia = kit.mesh(), z = front + 0.535;
  fascia.quad([-1.4, H - 0.05, z], [1.4, H - 0.05, z], [1.4, H + 0.21, z], [-1.4, H + 0.21, z], [0, 0, 1], [0, 1], [1, 1], [1, 0], [0, 0]);
  kit.add('Rótulo de la recepción', fascia, sign, { cut: true, shadows: false });
  const board = kit.mat('Pizarra de avisos', '#ffffff', 0.15);
  board.diffuseMap = kit.texture(paintBlackboard()); board.update();
  const B = BLACKBOARD, q = kit.mesh(), frame = kit.mesh();
  frame.box([B.x, B.y, front + 0.03], [B.w + 0.1, B.h + 0.1, 0.05]);
  q.quad([B.x - B.w / 2, B.y - B.h / 2, B.z], [B.x + B.w / 2, B.y - B.h / 2, B.z], [B.x + B.w / 2, B.y + B.h / 2, B.z], [B.x - B.w / 2, B.y + B.h / 2, B.z],
    [0, 0, 1], [0, 1], [1, 1], [1, 0], [0, 0]);
  kit.add('Marco de la pizarra', frame, kit.surface('fusta-passera', '#8a6a48'), { cut: true });
  kit.add('Pizarra de avisos', q, board, { cut: true, shadows: false });
}

function paintFascia() {
  const c = document.createElement('canvas'); c.width = 512; c.height = 48;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#3f5a45'; ctx.fillRect(0, 0, 512, 48);
  ctx.fillStyle = '#efe6cf'; ctx.font = '700 34px "Helvetica Neue", Arial, sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('R E C E P C I Ó', 256, 26);
  return c;
}

/** The campsite's notice board: AVISOS chalked at the top, the pool's hours, quiet hours; room for more. */
function paintBlackboard() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 188;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#2b3530'; ctx.fillRect(0, 0, 256, 188);
  // Old chalk wiped off, in pale clouds.
  for (let i = 0; i < 18; i++) {
    ctx.fillStyle = `rgba(220,225,215,${0.03 + (i % 4) * 0.012})`;
    ctx.beginPath(); ctx.ellipse((i * 67) % 240 + 8, (i * 41) % 170 + 10, 30 + (i % 3) * 12, 9, (i % 5) * 0.3, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = '#ecebe2'; ctx.textAlign = 'center';
  ctx.font = '700 26px "Chalkboard SE", "Bradley Hand", "Segoe Print", cursive'; ctx.fillText('AVISOS', 128, 34);
  ctx.fillRect(84, 42, 88, 2);
  ctx.font = '400 15px "Chalkboard SE", "Bradley Hand", "Segoe Print", cursive'; ctx.textAlign = 'left';
  ctx.fillText('Piscina: de 10 a 20 h', 18, 72);
  ctx.fillText('Silenci a partir de les 24 h', 18, 96);
  return c;
}
