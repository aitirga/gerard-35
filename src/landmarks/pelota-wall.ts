import type { GeoLandmark } from '../geo';
import type { LandmarkKit } from '../landmarks';

/**
 * A pelota wall for children, as Basque playgrounds have: the front wall (frontis) painted green
 * with a white line along the top and the strip of sheet metal at its foot that makes the ball ring,
 * and the court's lines painted on the floor in front of it. The footprint is the wall itself (so
 * only the wall is solid); `court` is how far the lines run out in front (+z), in metres.
 */
export const kind = 'pelota-wall';

export function build(kit: LandmarkKit, landmark: GeoLandmark) {
  const w = landmark.w * kit.cell, t = landmark.d * kit.cell, h = Number(landmark.params.height ?? 4.5);
  const court = Number(landmark.params.court ?? 10);
  const c = document.createElement('canvas'); c.width = 512; c.height = 256;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = String(landmark.params.colour ?? '#2f6b4c'); ctx.fillRect(0, 0, 512, 256);
  for (let k = 0; k < 300; k++) { ctx.fillStyle = `rgba(${k % 2 ? '255,255,255' : '0,0,0'},.05)`; ctx.fillRect((k * 97) % 512, (k * 53) % 256, 14, 6); }
  // Balls leave grey marks where they hit most, a band above the strip.
  for (let k = 0; k < 120; k++) { ctx.fillStyle = 'rgba(210,215,205,.16)'; ctx.beginPath(); ctx.arc((k * 131) % 512, 150 + ((k * 37) % 60), 3, 0, Math.PI * 2); ctx.fill(); }
  ctx.fillStyle = '#f2f0e8'; ctx.fillRect(0, 10, 512, 7);
  const y = 256 - 256 * 0.8 / h;
  ctx.fillStyle = '#9aa0a3'; ctx.fillRect(0, y, 512, 256 - y);
  ctx.fillStyle = 'rgba(0,0,0,.18)'; for (let x = 0; x < 512; x += 32) ctx.fillRect(x, y, 2, 256 - y);
  ctx.fillStyle = '#f2f0e8'; ctx.fillRect(0, y - 6, 512, 6);
  const painted = kit.mat('Frontis', '#ffffff', 0.12);
  painted.diffuseMap = kit.texture(c); painted.update();
  const face = kit.mesh();
  face.quad([-w / 2, 0, t / 2 + 0.01], [w / 2, 0, t / 2 + 0.01], [w / 2, h, t / 2 + 0.01], [-w / 2, h, t / 2 + 0.01], [0, 0, 1], [0, 1], [1, 1], [1, 0], [0, 0]);
  kit.add('Frontis', face, painted, { cut: true, shadows: false });
  kit.part('Muro del frontis', 'box', kit.mat('Hormigón del frontis', '#b8b3a8', 0.08), [0, h / 2, 0], [w, h, t]);
  kit.part('Albardilla', 'box', kit.mat('Albardilla del frontis', '#d9d5cb', 0.1), [0, h + 0.05, 0], [w + 0.1, 0.1, t + 0.1]);
  // The court's lines, one every 3.5 m from the wall, and its side line.
  const lines = kit.mat('Rayas de la cancha', '#f2f0e8', 0.1);
  for (let k = 1; k * 3.5 <= court; k++) kit.part('Raya', 'box', lines, [0, 0.012, t / 2 + k * 3.5], [w - 0.4, 0.01, 0.08]);
  kit.part('Raya', 'box', lines, [w / 2 - 0.2, 0.012, t / 2 + court / 2], [0.08, 0.01, court]);
  kit.part('Raya', 'box', lines, [-w / 2 + 0.2, 0.012, t / 2 + court / 2], [0.08, 0.01, court]);
}
