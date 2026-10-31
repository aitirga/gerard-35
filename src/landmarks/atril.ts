import type { GeoLandmark } from '../geo';
import type { LandmarkKit } from '../landmarks';

/**
 * A museum's interpretation lectern (MUHBA's on the Turó de la Rovira): a dark steel panel tilted
 * on two legs, its face towards the camera, the `title` in Catalan over lines of text and an old
 * photograph. World text, never guidance: it says what the place was.
 */
export const kind = 'atril';

export function build(kit: LandmarkKit, landmark: GeoLandmark) {
  const steel = kit.mat('Acero del atril', '#2c2d2f', 0.4);
  for (const x of [-0.4, 0.4]) kit.part('Pata del atril', 'box', steel, [x, 0.42, -0.08], [0.07, 0.84, 0.07]);
  kit.part('Marco del atril', 'box', steel, [0, 0.98, 0], [1.16, 0.05, 0.74], [28, 0, 0]);
  const title = String(landmark.params.title ?? 'Turó de la Rovira');
  const face = kit.texture(paint(title, Number(landmark.params.seed ?? 1)));
  const panel = kit.mat(`Panel ${title}`, '#ffffff', 0.25);
  panel.diffuseMap = face; panel.update();
  // The face lies on the frame, tilted with it towards the camera: its far edge is the top of the text.
  const t = 28 * Math.PI / 180, c = Math.cos(t), s = Math.sin(t);
  const at = (x: number, v: number): [number, number, number] => [x, 0.98 + 0.027 * c - v * s, 0.027 * s + v * c];
  const quad = kit.mesh();
  quad.quad(at(-0.54, -0.34), at(0.54, -0.34), at(0.54, 0.34), at(-0.54, 0.34), [0, c, s], [0, 0], [1, 0], [1, 1], [0, 1]);
  kit.add('Panel del atril', quad, panel, { shadows: false });
}

function paint(title: string, seed: number) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 160;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#e9e5dc'; ctx.fillRect(0, 0, 256, 160);
  // The museum's red tab, the title, an old photograph and its columns of text.
  ctx.fillStyle = '#c0282d'; ctx.fillRect(0, 0, 18, 160);
  ctx.save(); ctx.translate(13, 150); ctx.rotate(-Math.PI / 2); ctx.fillStyle = '#ffffff'; ctx.font = '700 11px Arial, sans-serif'; ctx.fillText('MUHBA', 0, 0); ctx.restore();
  ctx.fillStyle = '#1e1e1e'; ctx.font = '700 19px Arial, sans-serif'; ctx.fillText(title, 28, 28, 220);
  ctx.fillStyle = '#7d7468'; ctx.fillRect(28, 42, 92, 62);
  ctx.fillStyle = '#a49a8a'; ctx.fillRect(34, 70, 80, 28);
  ctx.fillStyle = '#5f574d'; for (let i = 0; i < 6; i++) ctx.fillRect(40 + i * 12, 58 - (i * seed) % 9, 5, 14);
  ctx.fillStyle = '#6a6a6a';
  for (let i = 0; i < 9; i++) ctx.fillRect(130, 44 + i * 7, 96 - ((i * 7 + seed * 13) % 23), 2.5);
  for (let i = 0; i < 6; i++) ctx.fillRect(28, 114 + i * 7, 200 - ((i * 11 + seed * 5) % 31), 2.5);
  return c;
}
