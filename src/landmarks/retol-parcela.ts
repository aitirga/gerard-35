import type { GeoLandmark } from '../geo';
import type { LandmarkKit } from '../landmarks';
import { bar, box } from '../landmark-shapes.ts';

/**
 * A campsite pitch's sign post (Càmping Eurosport, docs/quests/universidad.md § Las parcelas): a
 * square pine post with a blank board on top, facing local +z (the camera and the cell in front of
 * it, where Gerard stands to read it), the pitch's `number` on a small enamel plate under it, and a
 * storm lantern hanging from an arm, unlit. Las parcelas writes its word on the board: the board's
 * face is centred `BOARD` metres from the pivot (`Monumento rotulo-<n>`), leaning back `tilt` degrees, so
 * the story can lay its text there.
 */
export const kind = 'retol-parcela';

/** Where the board's face is, from the landmark's pivot, and its size (metres). */
export const BOARD = { y: 1.0, z: 0.045, w: 1.1, h: 0.46, tilt: 25 };

export function build(kit: LandmarkKit, landmark: GeoLandmark) {
  const wood = kit.mesh(), dark = kit.mesh(), glass = kit.mesh();
  box(wood, 0, 0, -0.08, 0.1, BOARD.y + 0.1, 0.1);
  // The board, leaning back on the post towards whoever stands in front (and the camera), its edges in the darker wood.
  const board = kit.mesh();
  board.box([0, BOARD.y, 0], [BOARD.w, BOARD.h, 0.06], [-BOARD.tilt, 0, 0]);
  board.box([0, BOARD.y, -0.04], [BOARD.w + 0.05, BOARD.h + 0.05, 0.03], [-BOARD.tilt, 0, 0]);
  // The lantern's arm out to the right and the lantern hanging from it: a frame over amber glass.
  const lx = BOARD.w / 2 + 0.22, ly = BOARD.y + 0.45;
  bar(dark, [0, ly, -0.08], [lx + 0.02, ly, -0.08], 0.03);
  box(dark, 0, BOARD.y + 0.1, -0.08, 0.12, ly - BOARD.y - 0.06, 0.12);
  bar(dark, [lx, ly, -0.08], [lx, ly - 0.08, -0.08], 0.012);
  box(dark, lx, ly - 0.12, -0.08, 0.15, 0.035, 0.15);
  box(glass, lx, ly - 0.3, -0.08, 0.12, 0.18, 0.12);
  box(dark, lx, ly - 0.33, -0.08, 0.16, 0.035, 0.16);
  kit.add('Poste de la parcela', wood, kit.surface('fusta-passera', '#a58a63'));
  kit.add('Tabla de la parcela', board, kit.surface('fusta-passera', '#b59a72'));
  kit.add('Herrajes de la parcela', dark, kit.mat('Madera oscura y hierro', '#3a3129', 0.25), { shadows: false });
  kit.add('Farol apagado', glass, kit.mat('Farol apagado', '#7a5a2c', 0.6), { shadows: false });
  // The pitch's number on an enamel plate on the post, under the board.
  const n = String(landmark.params.number ?? '');
  if (!n) return;
  const plate = kit.mat(`Placa de parcela ${n}`, '#ffffff', 0.4);
  plate.diffuseMap = kit.texture(paintNumber(n)); plate.update();
  const q = kit.mesh(), y = BOARD.y - BOARD.h / 2 - 0.16;
  q.quad([-0.08, y - 0.06, -0.025], [0.08, y - 0.06, -0.025], [0.08, y + 0.06, -0.025], [-0.08, y + 0.06, -0.025], [0, 0, 1], [0, 1], [1, 1], [1, 0], [0, 0]);
  kit.add('Número de la parcela', q, plate, { shadows: false });
}

function paintNumber(n: string) {
  const c = document.createElement('canvas'); c.width = 64; c.height = 48;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#2f4a3c'; ctx.fillRect(0, 0, 64, 48);
  ctx.strokeStyle = '#e9e2cf'; ctx.lineWidth = 3; ctx.strokeRect(3, 3, 58, 42);
  ctx.fillStyle = '#e9e2cf'; ctx.font = '700 28px "Helvetica Neue", Arial, sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(n, 32, 26);
  return c;
}
