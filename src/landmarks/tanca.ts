import type { GeoLandmark } from '../geo';
import type { LandmarkKit } from '../landmarks';
import type { MeshBuilder } from '../geo-scenery';

/**
 * A garden wall of the Vallès towns: rendered, with a stone coping, often an iron railing on top
 * and an iron gate between two pillars; sometimes a clipped hedge behind it. It runs along local x
 * through the middle of the footprint (`size_m` [length, depth]: the depth is what it blocks).
 * Params: `height_m`, `railing_m` (0: none), `gates` (x of each gate, metres from the middle),
 * `colour`, `hedge_m` (height of the hedge behind, on the −z side).
 */
export const kind = 'tanca';

type V3 = [number, number, number];

/** A box with UVs in metres, for real materials (no bottom face). */
export function slab(b: MeshBuilder, x0: number, x1: number, y0: number, y1: number, z0: number, z1: number) {
  const q = (a: V3, c: V3, d: V3, e: V3, n: V3, u: number, v: number, w: number, h: number) => b.quad(a, c, d, e, n, [u, v], [u + w, v], [u + w, v + h], [u, v + h]);
  q([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1], x0, y0, x1 - x0, y1 - y0);
  q([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [0, 0, -1], x0, y0, x1 - x0, y1 - y0);
  q([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [1, 0, 0], z0, y0, z1 - z0, y1 - y0);
  q([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [-1, 0, 0], z0, y0, z1 - z0, y1 - y0);
  q([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], [0, 1, 0], x0, z0, x1 - x0, z1 - z0);
}

/** Iron bars over a wall or between pillars: a see-through panel with its bars painted. */
export function railing(kit: LandmarkKit) {
  const m = kit.mat('Barandilla de forja', '#ffffff', 0.4);
  if (!m.opacityMap) {
    const c = document.createElement('canvas'); c.width = 64; c.height = 64;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#25282a';
    ctx.fillRect(0, 0, 64, 5); ctx.fillRect(0, 56, 64, 4);
    for (let x = 3; x < 64; x += 8) { ctx.fillRect(x, 0, 2.5, 60); ctx.beginPath(); ctx.arc(x + 1.25, 4, 3, 0, Math.PI * 2); ctx.fill(); }
    m.diffuseMap = kit.texture(c); m.opacityMap = m.diffuseMap; m.opacityMapChannel = 'a'; m.alphaTest = 0.5; m.update();
  }
  return m;
}

export function build(kit: LandmarkKit, landmark: GeoLandmark) {
  const p = landmark.params, L = landmark.w * kit.cell;
  const H = Number(p.height_m ?? 1), rail = Number(p.railing_m ?? 0), T = 0.3, gate = 1.2;
  const gates = ((p.gates as number[] | undefined) ?? []).slice().sort((a, b) => a - b);
  const wall = kit.mesh(), coping = kit.mesh(), bars = kit.mesh(), hedge = kit.mesh(), hedgeH = Number(p.hedge_m ?? 0);
  // The wall in stretches between the gates, each gate between two pillars; the hedge behind leaves the gates open.
  let x = -L / 2;
  for (const g of [...gates, L / 2 + gate]) {
    const end = Math.min(L / 2, g - gate / 2);
    if (end - x > 0.05) {
      slab(wall, x, end, 0, H, -T / 2, T / 2);
      slab(coping, x - 0.03, end + 0.03, H, H + 0.07, -T / 2 - 0.04, T / 2 + 0.04);
      if (rail) bars.quad([x, H + 0.07, 0], [end, H + 0.07, 0], [end, H + 0.07 + rail, 0], [x, H + 0.07 + rail, 0], [0, 0, 1], [x, 1], [end, 1], [end, 0], [x, 0]);
      if (hedgeH > 0) slab(hedge, Math.max(x, -L / 2 + 0.2), Math.min(end, L / 2 - 0.2), 0, hedgeH, -T / 2 - 0.9, -T / 2 - 0.05);
    }
    if (g > L / 2) break;
    for (const side of [-1, 1]) slab(wall, g + side * gate / 2 - 0.22, g + side * gate / 2 + 0.22, 0, H + rail + 0.2, -0.22, 0.22);
    bars.quad([g - gate / 2 + 0.2, 0.05, 0], [g + gate / 2 - 0.2, 0.05, 0], [g + gate / 2 - 0.2, H + rail, 0], [g - gate / 2 + 0.2, H + rail, 0], [0, 0, 1], [0, 1], [1, 1], [1, 0], [0, 0]);
    x = g + gate / 2;
  }
  kit.add('Muro del jardín', wall, kit.surface('estuc', String(p.colour ?? '#efe4cc')));
  kit.add('Albardilla', coping, kit.mat('Albardilla', String(p.coping ?? '#b9b3a8'), 0.1), { shadows: false });
  kit.add('Reja', bars, railing(kit), { shadows: false });
  kit.add('Seto', hedge, kit.mat('Seto', String(p.hedge ?? '#4f6b3f'), 0.05));
}
