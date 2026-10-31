import type { GeoLandmark } from '../geo';
import type { LandmarkKit } from '../landmarks';

/**
 * Torre Lligé, Cardedeu's town hall (Plaça de Sant Joan): what a summer villa of 1900 adds to its
 * box, read from Enric's photo on Wikimedia Commons. The footprint is the building's (`size_m`,
 * the front facing +z, `eave_m` its walls' height): a gable rising over the eave in the middle of
 * the front with the clock in it, and on the roof a square belvedere with arched windows under its
 * own hipped roof of Arab tiles. The porch and its terrace are a `porxo`.
 */
export const kind = 'torre-llige';

export function build(kit: LandmarkKit, landmark: GeoLandmark) {
  const p = landmark.params, D = landmark.d * kit.cell, eave = Number(p.eave_m ?? 6);
  const render = kit.surface('estuc', String(p.colour ?? '#efe6d2'));
  const trim = kit.mat('Molduras', String(p.trim ?? '#fbf7ee'), 0.1);
  const dark = kit.mat('Vano oscuro', '#2c3236', 0.3);
  // The front gable: a wall rising over the eave, stepped up to a pointed top, with the clock. It
  // stands out as far as the roof's overhang (0.35 cells), so it rises from the front in front of the
  // tiles instead of out of them: a solid block back to the wall, read as one from the overview.
  const wall = D / 2 + 0.01, front = D / 2 + 0.35 * kit.cell + 0.06, depth = front - wall, gw = Number(p.gable_m ?? 5), gh = 2.3;
  const g = gw / 2, low = eave - 0.4, mid = eave + gh * 0.55, peak = eave + gh, slope = Math.hypot(g, peak - mid);
  const gable = kit.mesh();
  for (const [z, facing] of [[front, 1], [wall, -1]] as const) {
    gable.quad([-g, low, z], [g, low, z], [g, mid, z], [-g, mid, z], [0, 0, facing], [-g, low], [g, low], [g, mid], [-g, mid]);
    gable.tri([-g, mid, z], [g, mid, z], [0, peak, z], [0, 0, facing], [-g, mid], [g, mid], [0, peak]);
  }
  for (const side of [-1, 1]) {
    // Its ends, and the two slopes of its top.
    gable.quad([side * g, low, wall], [side * g, low, front], [side * g, mid, front], [side * g, mid, wall], [side, 0, 0], [0, low], [depth, low], [depth, mid], [0, mid]);
    gable.quad([side * g, mid, wall], [side * g, mid, front], [0, peak, front], [0, peak, wall], [side * (peak - mid), g, 0], [0, 0], [depth, 0], [depth, slope], [0, slope]);
  }
  gable.quad([-g, low, wall], [g, low, wall], [g, low, front], [-g, low, front], [0, -1, 0], [-g, 0], [g, 0], [g, depth], [-g, depth]);
  kit.add('Frontón', gable, render, { cut: true });
  kit.part('Cornisa del frontón', 'box', trim, [0, mid, front - depth / 2], [gw + 0.3, 0.14, depth + 0.1]);
  // The clock: a white face in a moulded ring.
  kit.part('Marco del reloj', 'cylinder', trim, [0, eave + 0.75, front + 0.04], [1.25, 0.08, 1.25], [90, 0, 0]);
  kit.part('Esfera', 'cylinder', kit.mat('Esfera blanca', '#f6f4ee', 0.3, 0.1), [0, eave + 0.75, front + 0.09], [1.0, 0.04, 1.0], [90, 0, 0]);
  for (const [len, turn] of [[0.32, 145], [0.42, 0]] as const) {
    kit.part('Aguja', 'box', dark, [Math.sin(turn * Math.PI / 180) * len / 2, eave + 0.75 + Math.cos(turn * Math.PI / 180) * len / 2, front + 0.12], [0.05, len, 0.02], [0, 0, -turn]);
  }
  // The belvedere on the roof: a square room with an arched window on each side, its own hip.
  const bw = Number(p.belvedere_m ?? 3.8), bh = Number(p.belvedere_h_m ?? 5.6), [bx, bz] = (p.belvedere_at as number[] | undefined) ?? [0, 0];
  const room = kit.mesh(), y0 = eave - 0.3, y1 = eave + bh, h = bw / 2;
  const sides: [number, number][] = [[0, 1], [1, 0], [0, -1], [-1, 0]];
  for (const [nx, nz] of sides) {
    const ax = bx + nx * h - nz * h, az = bz + nz * h + nx * h, cx = bx + nx * h + nz * h, cz = bz + nz * h - nx * h;
    room.quad([ax, y0, az], [cx, y0, cz], [cx, y1, cz], [ax, y1, az], [nx, 0, nz], [0, y0], [bw, y0], [bw, y1], [0, y1]);
    const wx = bx + nx * (h + 0.03), wz = bz + nz * (h + 0.03);
    kit.part('Ventana del mirador', 'box', dark, [wx, y1 - 1.9, wz], [nz ? 1.1 : 0.04, 1.8, nx ? 1.1 : 0.04]);
    kit.part('Arco de la ventana', 'cylinder', dark, [wx, y1 - 1.0, wz], [1.1, 0.04, 1.1], [nz ? 90 : 0, 0, nx ? 90 : 0]);
    kit.part('Alféizar', 'box', trim, [bx + nx * (h + 0.08), y1 - 2.85, bz + nz * (h + 0.08)], [nz ? 1.5 : 0.18, 0.1, nx ? 1.5 : 0.18]);
  }
  kit.add('Mirador', room, render, { cut: true });
  kit.part('Cornisa del mirador', 'box', trim, [bx, y1 + 0.08, bz], [bw + 0.4, 0.16, bw + 0.4]);
  const cap = kit.mesh(), ce = h + 0.45, apex: [number, number, number] = [bx, y1 + 1.7, bz];
  for (const [nx, nz] of sides) {
    const a: [number, number, number] = [bx + (nx - nz) * ce, y1 + 0.16, bz + (nz + nx) * ce], c: [number, number, number] = [bx + (nx + nz) * ce, y1 + 0.16, bz + (nz - nx) * ce];
    cap.tri(a, c, apex, [nx, 0.8, nz], [0, 0], [ce * 2, 0], [ce, 2]);
  }
  kit.add('Tejado del mirador', cap, kit.surface('teula', String(p.tiles ?? '#9a5b40')), { cut: true });
}
