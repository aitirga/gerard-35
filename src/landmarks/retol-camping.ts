import type { GeoLandmark } from '../geo';
import type { LandmarkKit } from '../landmarks';

/**
 * A campsite's sign by the road in (Càmping Eurosport, docs/quests/universidad.md § La entrada): a
 * long board on two pine logs, painted cream with the name in dark green, CÀMPING over EUROSPORT,
 * the two stars of its category and a pine between them. Its face is local +z, the camera. Tall
 * enough to hide Gerard: it opens the cut. `name` and `kind` change the words.
 */
export const kind = 'retol-camping';

export function build(kit: LandmarkKit, landmark: GeoLandmark) {
  const W = landmark.w * kit.cell - 0.3, bottom = 1.25, top = 2.55;
  const logs = kit.mesh(), board = kit.mesh(), face = kit.mesh();
  for (const x of [-W / 2 + 0.15, W / 2 - 0.15]) logs.box([x, (top + 0.25) / 2, -0.05], [0.2, top + 0.25, 0.2]);
  board.box([0, (bottom + top) / 2, 0], [W, top - bottom, 0.08]);
  board.box([0, top + 0.06, 0], [W + 0.12, 0.08, 0.16]);
  face.quad([-W / 2 + 0.06, bottom + 0.06, 0.045], [W / 2 - 0.06, bottom + 0.06, 0.045], [W / 2 - 0.06, top - 0.06, 0.045], [-W / 2 + 0.06, top - 0.06, 0.045],
    [0, 0, 1], [0, 1], [1, 1], [1, 0], [0, 0]);
  kit.add('Troncos del rótulo', logs, kit.surface('fusta-passera', '#6e5a43'), { cut: true });
  kit.add('Tabla del rótulo', board, kit.mat('Madera del rótulo', '#5b4a37', 0.15), { cut: true });
  const m = kit.mat('Rótulo CÀMPING EUROSPORT', '#ffffff', 0.25);
  m.diffuseMap = kit.texture(paint(String(landmark.params.kind ?? 'CÀMPING'), String(landmark.params.name ?? 'EUROSPORT'), W / (top - bottom))); m.update();
  kit.add('Rótulo del camping', face, m, { cut: true, shadows: false });
}

function paint(kind: string, name: string, aspect: number) {
  const h = 160, w = Math.round(h * aspect);
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#e6dcc2'; ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = '#3c5a44'; ctx.lineWidth = 5; ctx.strokeRect(9, 9, w - 18, h - 18);
  ctx.fillStyle = '#3c5a44'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = '600 30px "Helvetica Neue", Arial, sans-serif'; ctx.fillText(kind.split('').join(' '), w / 2, 42);
  ctx.font = '800 64px "Helvetica Neue", Arial, sans-serif'; ctx.fillText(name, w / 2, 98, w - 60);
  // The category's two stars, a stylised pine between them.
  const star = (cx: number, cy: number, r: number) => {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r; ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); }
    ctx.closePath(); ctx.fill();
  };
  star(w / 2 - 34, 138, 9); star(w / 2 + 34, 138, 9);
  ctx.beginPath(); ctx.ellipse(w / 2, 132, 14, 6, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillRect(w / 2 - 1.5, 132, 3, 12);
  return c;
}
