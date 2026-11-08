import type { GeoLandmark } from '../geo';
import type { LandmarkKit } from '../landmarks';
import { bar, box } from '../landmark-shapes.ts';

/**
 * A pool's lifeguard chair (Càmping Eurosport's landmark, docs/quests/universidad.md § La piscina):
 * a tall white frame on four splayed legs, a slatted seat and back two metres up facing local +z
 * (the water and the camera), a footrest, rungs up the front, and an orange rescue float hung on its
 * side. Empty. Tall enough to hide Gerard: it opens the cut.
 */
export const kind = 'cadira-socorrista';

export function build(kit: LandmarkKit, _landmark: GeoLandmark) {
  const frame = kit.mesh(), slats = kit.mesh(), float = kit.mesh(), seat = 2.3;
  // Four legs splayed out at the foot, rails tying them, rungs up the front.
  const foot = 0.55, top = 0.34;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) bar(frame, [sx * foot, 0, sz * foot], [sx * top, seat, sz * top], 0.085);
  for (const y of [0.6, 1.3]) {
    const r = foot + (top - foot) * (y / seat);
    for (const sx of [-1, 1]) bar(frame, [sx * r, y, -r], [sx * r, y, r], 0.04);
    bar(frame, [-r, y, -r], [r, y, -r], 0.04);
  }
  for (let y = 0.35; y < seat; y += 0.33) {
    const r = foot + (top - foot) * (y / seat);
    bar(frame, [-r, y, r], [r, y, r], 0.035);
  }
  // The seat and its back in slats, the footrest in front, the armrests.
  for (let i = 0; i < 6; i++) box(slats, 0, seat, -0.3 + i * 0.12, 0.74, 0.04, 0.09);
  for (let i = 0; i < 4; i++) box(slats, 0, seat + 0.2 + i * 0.14, -0.34, 0.74, 0.09, 0.04);
  for (const sx of [-1, 1]) {
    bar(frame, [sx * 0.37, seat, -0.36], [sx * 0.37, seat + 0.78, -0.36], 0.055);
    bar(frame, [sx * 0.37, seat + 0.32, -0.36], [sx * 0.37, seat + 0.32, 0.3], 0.05);
  }
  box(slats, 0, seat - 0.85, 0.5, 0.62, 0.04, 0.2);
  // The float hung on the right: an orange ring, in eight pieces.
  for (let k = 0; k < 8; k++) {
    const a0 = (k / 8) * Math.PI * 2, a1 = ((k + 1) / 8) * Math.PI * 2, r = 0.22;
    bar(float, [0.5, 1.6 + Math.sin(a0) * r, Math.cos(a0) * r], [0.5, 1.6 + Math.sin(a1) * r, Math.cos(a1) * r], 0.1);
  }
  kit.add('Silla del socorrista', frame, kit.mat('Blanco de la silla', '#ecebe5', 0.3), { cut: true });
  kit.add('Asiento del socorrista', slats, kit.surface('fusta-passera', '#d9d2c2'), { cut: true });
  kit.add('Flotador', float, kit.mat('Flotador naranja', '#d9662e', 0.3), { cut: true, shadows: false });
}
