import type { GeoLandmark } from '../geo';
import type { LandmarkKit } from '../landmarks';

/**
 * Pere Falqués' modernista lamp post, the one on Avinguda de Gaudí (made for Passeig de Gràcia in
 * 1909, set on the avenue in 1985 and usually taken for Gaudí's): a tapering pedestal of rough
 * white stone, then a spire of wrought iron painted oxide red, scrolled and leafy, holding two tiers
 * of four white globes. The pedestal is tall enough to hide Gerard, so it opens the cut.
 */
export const kind = 'falques-lamp';

export function build(kit: LandmarkKit, _landmark: GeoLandmark) {
  const stone = kit.surface('formigo', '#e4ddcf', 0.05);
  const iron = kit.mat('Hierro de la farola', '#8a4b3a', 0.35);
  const globe = kit.mat('Globo de la farola', '#fff4dc', 0.6, 0.7);
  // The pedestal: a truncated pyramid, 1.5 m square at the foot, 0.8 m at 2.8 m.
  const pedestal = kit.mesh();
  const ring = (h: number, r: number) => [[-r, h, -r], [r, h, -r], [r, h, r], [-r, h, r]] as [number, number, number][];
  const foot = ring(0, 0.75), top = ring(2.8, 0.4);
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4, out: [number, number, number] = [(foot[i][0] + foot[j][0]) / 2, 0.2, (foot[i][2] + foot[j][2]) / 2];
    pedestal.quad(foot[i], foot[j], top[j], top[i], out, [0, 0], [1.5, 0], [1.5, 2.8], [0, 2.8]);
  }
  pedestal.quad(top[0], top[1], top[2], top[3], [0, 1, 0], [0, 0], [0.8, 0], [0.8, 0.8], [0, 0.8]);
  kit.add('Pedestal de la farola', pedestal, stone, { cut: true });
  kit.part('Basa de la farola', 'box', stone, [0, 0.15, 0], [1.7, 0.3, 1.7]);
  // The iron spire with its scrolls (the leaves and twists are too small to read: a rib on each face).
  kit.part('Fuste de hierro', 'cylinder', iron, [0, 4.3, 0], [0.34, 3.2, 0.34]);
  kit.part('Aguja', 'cone', iron, [0, 6.6, 0], [0.26, 1.6, 0.26]);
  for (let k = 0; k < 4; k++) {
    const a = k * 90 + 45, c = Math.cos(a * Math.PI / 180), s = Math.sin(a * Math.PI / 180);
    kit.part('Voluta', 'box', iron, [c * 0.3, 3.1, s * 0.3], [0.08, 0.7, 0.32], [0, -a, 18]);
    for (const [y, r, g] of [[3.9, 0.62, 0.42], [5.5, 0.95, 0.5]]) {
      kit.part('Brazo de la farola', 'box', iron, [c * r / 2, y + 0.18, s * r / 2], [r, 0.07, 0.07], [0, -a, -12]);
      kit.part('Globo', 'sphere', globe, [c * r, y, s * r], [g, g, g]);
      kit.part('Corona del globo', 'cylinder', iron, [c * r, y + g * 0.5, s * r], [g * 0.55, 0.08, g * 0.55]);
    }
  }
}
