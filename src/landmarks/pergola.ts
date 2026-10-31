import type { GeoLandmark } from '../geo';
import type { LandmarkKit } from '../landmarks';

/**
 * A wooden pergola over a terrace: square posts, beams along its length and joists across, and a
 * climber grown over the top (wisteria in Txintxarri plaza, green in July, its flowers long gone).
 * The footprint is the pergola's; `height` its top (default 2.8 m). The leaves open the cut, so
 * Gerard is never lost under them.
 */
export const kind = 'pergola';

export function build(kit: LandmarkKit, landmark: GeoLandmark) {
  const hw = landmark.w * kit.cell / 2, hd = landmark.d * kit.cell / 2, top = Number(landmark.params.height ?? 2.8);
  const timber = kit.mesh(), leaves = kit.mesh();
  const across = Math.max(1, Math.round(hw * 2 / 2.6));
  for (let k = 0; k <= across; k++) {
    const x = -hw + (2 * hw * k) / across;
    for (const z of [-hd, hd]) timber.box([x, top / 2, z], [0.16, top, 0.16]);
    timber.box([x, top + 0.08, 0], [0.1, 0.16, hd * 2 + 0.5]);
  }
  for (const z of [-hd, hd]) timber.box([0, top - 0.06, z], [hw * 2 + 0.4, 0.2, 0.12]);
  kit.add('Pérgola', timber, kit.mat('Madera de la pérgola', '#6a5442', 0.12), { cut: true });
  // The climber: lumps of leaves along the joists, thicker towards the middle, hanging a little.
  const r = (i: number) => { const v = Math.sin(i * 91.7 + 13.1) * 43758.5453; return v - Math.floor(v); };
  const dark = kit.mesh();
  for (let i = 0; i < Math.round(hw * hd * 9); i++) {
    const x = -hw + r(i) * 2 * hw, z = -hd - 0.2 + r(i + 50) * (2 * hd + 0.4), s = 0.35 + r(i + 100) * 0.45;
    // Thicker over the middle, thinning to loose tufts at the ends; some tufts hang below the joists.
    if (Math.abs(x) / hw > 0.75 + r(i + 250) * 0.25) continue;
    const hang = r(i + 300) > 0.82 ? -0.25 - r(i + 350) * 0.3 : 0;
    (r(i + 400) > 0.5 ? leaves : dark).box([x, top + 0.2 + r(i + 150) * 0.16 + hang, z], [s * 1.3, 0.16 + r(i + 200) * 0.2 - hang * 0.6, s]);
  }
  // Painted leaves (small overlapping blades in a few greens over a dark ground), a metre per repeat.
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#5d6b55'; ctx.fillRect(0, 0, 128, 128);
  for (let k = 0; k < 260; k++) {
    ctx.fillStyle = ['#9fb08e', '#c9d6b4', '#7d9070', '#b4c4a0', '#6c7d62'][k % 5];
    ctx.save(); ctx.translate(r(k + 500) * 128, r(k + 700) * 128); ctx.rotate(r(k + 900) * Math.PI);
    ctx.beginPath(); ctx.ellipse(0, 0, 5 + r(k + 1100) * 3, 2.2, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  }
  const leafy = (name: string, hex: string) => { const m = kit.mat(name, hex, 0.08); m.diffuseMap = kit.texture(c); m.update(); return m; };
  kit.add('Glicinia', leaves, leafy('Hojas de la glicinia', '#7f9f5c'), { cut: true });
  kit.add('Glicinia en sombra', dark, leafy('Hojas de la glicinia en sombra', '#5f7f45'), { cut: true });
}
