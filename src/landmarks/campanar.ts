import type { GeoLandmark } from '../geo';
import type { LandmarkKit } from '../landmarks';

/**
 * A square stone bell tower crowned with Catalan merlons, like Santa Maria de Cardedeu's (27 m):
 * a plain shaft of ashlar, a string course, the belfry with two round-arched openings on each side,
 * a cornice and the merlons round a flat top. `size_m` is its square base, `height_m` its height to
 * the top of the merlons; `stone` its colour.
 */
export const kind = 'campanar';

export function build(kit: LandmarkKit, landmark: GeoLandmark) {
  const s = landmark.w * kit.cell, H = Number(landmark.params.height_m ?? 27), h = s / 2;
  const stone = kit.surface('carreu', String(landmark.params.stone ?? '#b7ab95'));
  const course = kit.mat('Imposta de piedra', String(landmark.params.trim ?? '#c9bea8'), 0.1);
  const dark = kit.mat('Campanario por dentro', '#26292b', 0.2);
  const bronze = kit.mat('Bronce', '#6f5a36', 0.6);
  const shaft = kit.mesh(), top = H - 1.4;
  const sides: [number, number][] = [[0, 1], [1, 0], [0, -1], [-1, 0]];
  for (const [nx, nz] of sides) {
    const a: [number, number, number] = [(nx - nz) * h, 0, (nz + nx) * h], c: [number, number, number] = [(nx + nz) * h, 0, (nz - nx) * h];
    shaft.quad(a, c, [c[0], top, c[2]], [a[0], top, a[2]], [nx, 0, nz], [0, 0], [s, 0], [s, top], [0, top]);
    // Two round-arched openings of the belfry on each side, a bell in each.
    for (const off of [-s * 0.22, s * 0.22]) {
      const x = nx * (h + 0.02) + nz * off, z = nz * (h + 0.02) - nx * off, w = s * 0.26;
      kit.part('Ventanal', 'box', dark, [x, top - 3.4, z], [nz ? w : 0.04, 3.2, nx ? w : 0.04]);
      kit.part('Arco del ventanal', 'cylinder', dark, [x, top - 1.8, z], [w, 0.04, w], [nz ? 90 : 0, 0, nx ? 90 : 0]);
      kit.part('Campana', 'cone', bronze, [x - nx * 0.3, top - 3.2, z - nz * 0.3], [w * 0.7, 1.0, w * 0.7]);
    }
    // The merlons: three square teeth on each side over the cornice.
    for (const k of [-1, 0, 1]) {
      const along = k * s * 0.36;
      kit.part('Merlón', 'box', stone, [nx * (h - 0.25) + nz * along, top + 0.85, nz * (h - 0.25) - nx * along], [nz ? s * 0.18 : 0.5, 1.1, nx ? s * 0.18 : 0.5]);
    }
  }
  // The flat top behind the merlons.
  shaft.quad([-h, top + 0.25, -h], [h, top + 0.25, -h], [h, top + 0.25, h], [-h, top + 0.25, h], [0, 1, 0], [0, 0], [s, 0], [s, s], [0, s]);
  kit.add('Torre', shaft, stone, { cut: true });
  kit.part('Imposta', 'box', course, [0, top - 5.6, 0], [s + 0.2, 0.25, s + 0.2]);
  kit.part('Cornisa', 'box', course, [0, top + 0.1, 0], [s + 0.45, 0.3, s + 0.45]);
}
