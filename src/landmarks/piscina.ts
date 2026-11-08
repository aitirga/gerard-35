import type { GeoLandmark } from '../geo';
import type { LandmarkKit } from '../landmarks';
import { bar, box } from '../landmark-shapes.ts';

/**
 * A campsite pool's edge (Càmping Eurosport, docs/quests/universidad.md § La piscina). The water is
 * the place's own (a sketch `water` area, `look.water`), filled to the brim; this draws round the
 * footprint (the water's rectangle): the band of blue tiles at the waterline, a coping of pale stone
 * slabs, two steel ladders and the depth painted on the coping at both ends. Not solid: the water
 * already is, and the deck is walked on.
 */
export const kind = 'piscina';

export function build(kit: LandmarkKit, landmark: GeoLandmark) {
  const hw = landmark.w * kit.cell / 2 + 0.01, hd = landmark.d * kit.cell / 2 + 0.01, rim = 0.45, tile = 0.22;
  const coping = kit.mesh(), tiles = kit.mesh(), steel = kit.mesh();
  // The coping all round, a little proud of the deck, in slabs a metre long.
  const slabs = (x0: number, x1: number, z0: number, z1: number, along: 'x' | 'z') => {
    const len = along === 'x' ? x1 - x0 : z1 - z0, n = Math.max(1, Math.round(len));
    for (let i = 0; i < n; i++) {
      const a = i / n, b = (i + 1) / n, gap = 0.012;
      if (along === 'x') box(coping, x0 + (a + b) / 2 * len, 0, (z0 + z1) / 2, len / n - gap, 0.07, z1 - z0 - gap);
      else box(coping, (x0 + x1) / 2, 0, z0 + (a + b) / 2 * len, x1 - x0 - gap, 0.07, len / n - gap);
    }
  };
  slabs(-hw - rim, hw + rim, -hd - rim, -hd, 'x');
  slabs(-hw - rim, hw + rim, hd, hd + rim, 'x');
  slabs(-hw - rim, -hw, -hd, hd, 'z');
  slabs(hw, hw + rim, -hd, hd, 'z');
  // The tiles at the waterline, just inside the coping.
  box(tiles, 0, 0, -hd + tile / 2, hw * 2, 0.045, tile);
  box(tiles, 0, 0, hd - tile / 2, hw * 2, 0.045, tile);
  box(tiles, -hw + tile / 2, 0, 0, tile, 0.045, hd * 2 - tile * 2);
  box(tiles, hw - tile / 2, 0, 0, tile, 0.045, hd * 2 - tile * 2);
  // Two ladders: rails curving over the coping into the water, at the shallow and the deep end.
  for (const [x, z, side] of [[-hw + 1.2, hd, 1], [hw - 1.4, -hd, -1]] as const) {
    for (const dx of [-0.25, 0.25]) {
      const p = (u: number, y: number): [number, number, number] => [x + dx, y, z + side * u];
      bar(steel, p(0.35, 0.07), p(0.35, 0.75), 0.04);
      bar(steel, p(0.35, 0.75), p(0.1, 0.9), 0.04);
      bar(steel, p(0.1, 0.9), p(-0.12, 0.75), 0.04);
      bar(steel, p(-0.12, 0.75), p(-0.15, 0.05), 0.04);
    }
  }
  kit.add('Borde de la piscina', coping, kit.mat('Piedra del borde', '#e2dccd', 0.15));
  kit.add('Gresite', tiles, kit.mat('Gresite', '#2f6e86', 0.6), { shadows: false });
  kit.add('Escaleras de la piscina', steel, kit.mat('Acero inoxidable', '#c9ced0', 0.8), { shadows: false });
  // The depth, painted in blue on the coping at each end.
  for (const [x, text] of [[-hw - rim / 2, '1,20 m'], [hw + rim / 2, '2,00 m']] as const) {
    const m = kit.mat(`Profundidad ${text}`, '#ffffff', 0.15);
    m.diffuseMap = kit.texture(paint(text)); m.update();
    const q = kit.mesh(), y = 0.075;
    // Read from the camera: the text's top towards the far side (−z).
    q.quad([x - 0.2, y, 0.08], [x + 0.2, y, 0.08], [x + 0.2, y, -0.08], [x - 0.2, y, -0.08], [0, 1, 0], [0, 1], [1, 1], [1, 0], [0, 0]);
    kit.add('Profundidad', q, m, { shadows: false });
  }
}

function paint(text: string) {
  const c = document.createElement('canvas'); c.width = 128; c.height = 48;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#e2dccd'; ctx.fillRect(0, 0, 128, 48);
  ctx.fillStyle = '#2f5f86'; ctx.font = '700 30px "Helvetica Neue", Arial, sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, 64, 26);
  return c;
}
