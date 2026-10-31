import type { GeoLandmark } from '../geo';
import type { LandmarkKit } from '../landmarks';

/**
 * A catenary gantry over the tracks, as on the Rodalies lines out of Barcelona: two lattice masts
 * either side, a lattice beam across, a drop arm over each track holding its contact wire. The
 * footprint is [the beam's thickness, its span] with the span across the tracks (local z); the
 * tracks run along local x. `tracks` are their offsets along z (metres from the middle), and
 * `wire_m` how far each track's wire runs either side, to meet the next gantry's.
 */
export const kind = 'catenaria';

export function build(kit: LandmarkKit, landmark: GeoLandmark) {
  const p = landmark.params, span = landmark.d * kit.cell, H = Number(p.height_m ?? 7.2);
  const steel = kit.mat('Celosía de la catenaria', '#ffffff', 0.4);
  steel.diffuseMap = kit.texture(lattice()); steel.opacityMap = steel.diffuseMap; steel.opacityMapChannel = 'a'; steel.alphaTest = 0.5; steel.update();
  const solid = kit.mat('Acero de la catenaria', '#4a4f53', 0.4), wire = kit.mat('Hilo de contacto', '#2b2d2e', 0.5);
  // Masts and beam as open lattice boxes (four faces each), their latticework painted.
  const frame = kit.mesh();
  const box = (x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, rungs: number) => {
    const q = (a: number[], b: number[], c: number[], d: number[], n: [number, number, number]) =>
      frame.quad(a as [number, number, number], b as [number, number, number], c as [number, number, number], d as [number, number, number], n, [0, 0], [1, 0], [1, rungs], [0, rungs]);
    q([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1]);
    q([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [0, 0, -1]);
    q([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [1, 0, 0]);
    q([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [-1, 0, 0]);
  };
  for (const z of [-span / 2, span / 2]) {
    box(-0.25, 0.25, 0, H + 0.4, z - 0.2, z + 0.2, Math.round(H / 0.6));
    kit.part('Pie del poste', 'box', solid, [0, 0.15, z], [0.7, 0.3, 0.6]);
  }
  // The beam lies along z: its faces run across, so their lattice repeats along the span.
  const beam = kit.mesh(), y0 = H - 0.55, y1 = H + 0.05, n = Math.round(span / 0.6);
  beam.quad([0.25, y0, -span / 2], [0.25, y0, span / 2], [0.25, y1, span / 2], [0.25, y1, -span / 2], [1, 0, 0], [0, 0], [n, 0], [n, 1], [0, 1]);
  beam.quad([-0.25, y0, span / 2], [-0.25, y0, -span / 2], [-0.25, y1, -span / 2], [-0.25, y1, span / 2], [-1, 0, 0], [0, 0], [n, 0], [n, 1], [0, 1]);
  beam.quad([-0.25, y0, -span / 2], [0.25, y0, -span / 2], [0.25, y0, span / 2], [-0.25, y0, span / 2], [0, -1, 0], [0, 0], [1, 0], [1, n], [0, n]);
  beam.quad([-0.25, y1, span / 2], [0.25, y1, span / 2], [0.25, y1, -span / 2], [-0.25, y1, -span / 2], [0, 1, 0], [0, 0], [1, 0], [1, n], [0, n]);
  kit.add('Poste de catenaria', frame, steel, { cut: true });
  kit.add('Pórtico de catenaria', beam, steel, { cut: true });
  const reach = Number(p.wire_m ?? 25);
  for (const z of (p.tracks as number[] | undefined) ?? []) {
    kit.part('Péndola', 'box', solid, [0, H - 1.2, z], [0.08, 1.3, 0.08]);
    kit.part('Brazo', 'box', solid, [0.4, H - 1.9, z], [0.9, 0.06, 0.06]);
    kit.part('Hilo de contacto', 'box', wire, [0, 5.3, z], [reach * 2, 0.03, 0.03]);
    kit.part('Sustentador', 'box', wire, [0, H - 0.75, z], [reach * 2, 0.03, 0.03]);
  }
}

/** One square of lattice: the frame's edges and a diagonal, transparent between. */
function lattice() {
  const c = document.createElement('canvas'); c.width = 32; c.height = 32;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#4a4f53'; ctx.strokeStyle = '#4a4f53';
  ctx.fillRect(0, 0, 4, 32); ctx.fillRect(28, 0, 4, 32); ctx.fillRect(0, 0, 32, 2.5);
  ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(2, 32); ctx.lineTo(30, 0); ctx.stroke();
  return c;
}
