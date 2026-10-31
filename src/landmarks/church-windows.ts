import type { GeoLandmark } from '../geo';
import type { LandmarkKit } from '../landmarks';

type V3 = [number, number, number];

/**
 * The few small windows high in a church's stone wall, which the map's blank walls lack: `count`
 * round-headed openings spread along the footprint's width, each in a pale dressed-stone surround,
 * dark glass behind a plain iron grille. The pivot stands on the wall's foot, local +z out of the
 * wall; `sill` and `height` in metres (defaults 7 and 2.2), `width` default 0.9.
 */
export const kind = 'church-windows';

export function build(kit: LandmarkKit, landmark: GeoLandmark) {
  const half = landmark.w * kit.cell / 2, count = Number(landmark.params.count ?? 2);
  const sill = Number(landmark.params.sill ?? 7), height = Number(landmark.params.height ?? 2.2), w = Number(landmark.params.width ?? 0.9) / 2;
  const surround = kit.mesh(), glass = kit.mesh(), grille = kit.mesh();
  /** A round-headed shape `w` wide at `z`, `pad` larger all round; its square part ends at `spring`. */
  const arch = (mesh: ReturnType<typeof kit.mesh>, cx: number, z: number, pad: number) => {
    const r = w + pad, y0 = sill - pad, spring = sill + height - w, at = (x: number, y: number): V3 => [cx + x, y, z];
    mesh.quad(at(-r, y0), at(r, y0), at(r, spring), at(-r, spring), [0, 0, 1], [cx - r, y0], [cx + r, y0], [cx + r, spring], [cx - r, spring]);
    for (let k = 0; k < 8; k++) {
      const a0 = Math.PI * k / 8, a1 = Math.PI * (k + 1) / 8;
      mesh.tri(at(0, spring), at(Math.cos(a0) * r, spring + Math.sin(a0) * r), at(Math.cos(a1) * r, spring + Math.sin(a1) * r), [0, 0, 1],
        [cx, spring], [cx + Math.cos(a0) * r, spring + Math.sin(a0) * r], [cx + Math.cos(a1) * r, spring + Math.sin(a1) * r]);
    }
  };
  for (let i = 0; i < count; i++) {
    const cx = -half + (2 * half) * (i + 0.5) / count;
    arch(surround, cx, 0.12, 0.22);
    arch(glass, cx, 0.15, 0);
    // The grille: two uprights and two bars across the square part.
    for (const x of [-w / 3, w / 3]) grille.quad([cx + x - 0.02, sill, 0.18], [cx + x + 0.02, sill, 0.18], [cx + x + 0.02, sill + height - w, 0.18], [cx + x - 0.02, sill + height - w, 0.18], [0, 0, 1], [0, 0], [1, 0], [1, 1], [0, 1]);
    for (const y of [sill + 0.45, sill + height - w - 0.3]) grille.quad([cx - w, y - 0.02, 0.18], [cx + w, y - 0.02, 0.18], [cx + w, y + 0.02, 0.18], [cx - w, y + 0.02, 0.18], [0, 0, 1], [0, 0], [1, 0], [1, 1], [0, 1]);
  }
  kit.add('Recercado de ventanas', surround, kit.surface('carreu', '#b3aea3', 0.1), { cut: true, shadows: false });
  kit.add('Vidrio de la iglesia', glass, kit.mat('Vidrio de la iglesia', '#262c2e', 0.6), { cut: true, shadows: false });
  kit.add('Reja de la iglesia', grille, kit.mat('Reja de la iglesia', '#1f2122', 0.4), { cut: true, shadows: false });
}
