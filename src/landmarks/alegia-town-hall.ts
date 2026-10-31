import type { GeoLandmark } from '../geo';
import type { LandmarkKit } from '../landmarks';
import type { MeshBuilder } from '../geo-scenery';

type V3 = [number, number, number];

/**
 * What Alegia's town hall (Alegiko udaletxea, 18th century) has in relief over its square front, which
 * is the real photo (`signature` on the building): the stone slab of the long first-floor balcony and
 * the four small ones above, the raised pediment in the middle of the eaves with its own little roof,
 * and on it the clock turret, curved shoulders, a cornice and an iron lantern with the bell and the
 * weathervane. The pivot stands on the front wall's middle, local +z out to the square; `height` is
 * the wall's height to the eaves (default 15 m).
 */
export const kind = 'alegia-town-hall';

/** A box with UVs in metres on every face. */
function box(mesh: MeshBuilder, [cx, cy, cz]: V3, [w, h, d]: V3) {
  const x0 = cx - w / 2, x1 = cx + w / 2, y0 = cy - h / 2, y1 = cy + h / 2, z0 = cz - d / 2, z1 = cz + d / 2;
  mesh.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1], [x0, y0], [x1, y0], [x1, y1], [x0, y1]);
  mesh.quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [0, 0, -1], [x1, y0], [x0, y0], [x0, y1], [x1, y1]);
  mesh.quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [1, 0, 0], [z1, y0], [z0, y0], [z0, y1], [z1, y1]);
  mesh.quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [-1, 0, 0], [z0, y0], [z1, y0], [z1, y1], [z0, y1]);
  mesh.quad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], [0, 1, 0], [x0, z1], [x1, z1], [x1, z0], [x0, z0]);
  mesh.quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [0, -1, 0], [x0, z0], [x1, z0], [x1, z1], [x0, z1]);
}

export function build(kit: LandmarkKit, landmark: GeoLandmark) {
  const eaves = Number(landmark.params.height ?? 15);
  const stone = kit.surface('carreu', '#a19f99', 0.1);
  const tiles = kit.surface('teila-zaharra', '#7a5244', 0.1);
  const slabs = kit.mesh(), ashlar = kit.mesh(), roof = kit.mesh(), shade = kit.mesh();
  // The balconies' stone slabs, where the photo has them: the long one on the first floor, four above.
  box(slabs, [-0.2, 4.85, 0.36], [18.1, 0.2, 0.72]);
  for (const [a, b] of [[-8.8, -5.3], [-4.3, -0.85], [0.5, 3.7], [5.1, 8.4]]) box(slabs, [(a + b) / 2, 9.9, 0.26], [b - a, 0.16, 0.52]);
  // The pediment: a triangle of ashlar over the middle of the eaves, under its own little roof.
  const half = 5.6, rise = 2.4, out = 0.75, back = -4.6, apex = eaves + rise;
  ashlar.tri([-half, eaves - 0.1, 0.02], [half, eaves - 0.1, 0.02], [0, apex, 0.02], [0, 0, 1], [-half, eaves], [half, eaves], [0, apex]);
  for (const s of [-1, 1]) {
    const foot: V3 = [s * (half + 0.5), eaves - 0.15, out], ridge: V3 = [0, apex + 0.3, out];
    roof.quad(foot, ridge, [0, apex + 0.3, back], [s * (half + 0.5), eaves - 0.15, back], [s * 0.4, 1, 0], [s * foot[0], 0], [0, 3.1], [0, 3.1 - back], [s * foot[0], -back]);
    // The eaves' dark underside and the fascia along their edge, which give the deep shadow of the photo.
    shade.quad([s * (half + 0.5), eaves - 0.15, out], [0, apex + 0.3, out], [0, apex + 0.08, out - 0.02], [s * (half + 0.5), eaves - 0.37, out - 0.02], [0, 0, 1], [0, 0], [1, 0], [1, 1], [0, 1]);
    shade.quad([s * (half + 0.5), eaves - 0.37, out - 0.02], [0, apex + 0.08, out - 0.02], [0, apex + 0.05, 0.05], [s * half, eaves - 0.12, 0.05], [0, -1, 0.2], [0, 0], [1, 0], [1, 1], [0, 1]);
  }
  // The clock turret on the pediment: a stone block with the clock, curved shoulders, a cornice.
  const tz = -0.95, ty = apex - 0.3;
  box(ashlar, [0, ty + 1.3, tz], [2.4, 2.6, 2.0]);
  for (const s of [-1, 1]) {
    for (let k = 0; k < 4; k++) box(ashlar, [s * (1.35 + k * 0.2), ty + 0.75 - k * 0.22, tz], [0.32, 0.5, 1.6]);
  }
  box(ashlar, [0, ty + 2.72, tz], [2.8, 0.24, 2.4]);
  box(ashlar, [0, ty + 2.98, tz], [2.1, 0.28, 1.7]);
  kit.add('Losas de los balcones', slabs, kit.mat('Losa de balcón', '#5f4434', 0.2), { cut: true });
  kit.add('Frontón y torreta', ashlar, stone, { cut: true });
  kit.add('Tejado del frontón', roof, tiles, { cut: true });
  kit.add('Alero del frontón', shade, kit.mat('Alero del ayuntamiento', '#3a2f28', 0.1), { cut: true, shadows: false });
  // The clock face: white enamel, black ring, hour marks and the hands at ten past ten.
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#a19f99'; ctx.fillRect(0, 0, 128, 128);
  ctx.fillStyle = '#f4f1e8'; ctx.beginPath(); ctx.arc(64, 64, 58, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#1c1c1c'; ctx.lineWidth = 4; ctx.stroke();
  ctx.fillStyle = '#1c1c1c';
  for (let k = 0; k < 12; k++) { const a = k * Math.PI / 6; ctx.fillRect(64 + Math.cos(a) * 46 - 3, 64 + Math.sin(a) * 46 - 3, 6, 6); }
  ctx.lineCap = 'round';
  for (const [a, len, wd] of [[-Math.PI / 2 - Math.PI / 3 * 1.0, 30, 6], [-Math.PI / 2 + Math.PI / 3, 42, 4]]) {
    ctx.lineWidth = wd; ctx.beginPath(); ctx.moveTo(64, 64); ctx.lineTo(64 + Math.cos(a) * len, 64 + Math.sin(a) * len); ctx.stroke();
  }
  const face = kit.mat('Esfera del reloj', '#ffffff', 0.3);
  face.diffuseMap = kit.texture(c); face.update();
  const dial = kit.mesh(), z = tz + 1.02, r = 0.85, cy = ty + 1.35;
  dial.quad([-r, cy - r, z], [r, cy - r, z], [r, cy + r, z], [-r, cy + r, z], [0, 0, 1], [0, 1], [1, 1], [1, 0], [0, 0]);
  kit.add('Reloj', dial, face, { cut: true, shadows: false });
  // The iron lantern with the bell, its little dome and the weathervane.
  const iron = kit.mat('Hierro de la linterna', '#2a2c2d', 0.45), top = ty + 3.12;
  for (const [x, zz] of [[-0.4, -0.4], [0.4, -0.4], [0.4, 0.4], [-0.4, 0.4]]) kit.part('Montante', 'box', iron, [x, top + 0.55, tz + zz], [0.06, 1.1, 0.06]);
  kit.part('Campana del reloj', 'cone', kit.mat('Bronce', '#4f4330', 0.55), [0, top + 0.5, tz], [0.6, 0.65, 0.6]);
  kit.part('Cupulín', 'cone', iron, [0, top + 1.35, tz], [1.2, 0.55, 1.2]);
  kit.part('Veleta', 'box', iron, [0, top + 2.0, tz], [0.04, 1.2, 0.04]);
  kit.part('Flecha de la veleta', 'box', iron, [0.15, top + 2.4, tz], [0.75, 0.05, 0.05]);
}
