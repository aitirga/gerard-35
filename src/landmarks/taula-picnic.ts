import type { GeoLandmark } from '../geo';
import type { LandmarkKit } from '../landmarks';
import { bar, box } from '../landmark-shapes.ts';

/**
 * Where people eat at a campsite (Càmping Eurosport, docs/quests/universidad.md). Default: a long
 * picnic table of weathered wood along local x, its two benches fixed to it on A-frame legs, filling
 * the footprint (El merendero). `melo: true` leaves a melon on it, the group's melon, the one detail
 * no other place has. `style: "plegable"`: a folding aluminium camping table with four folding chairs
 * round it (where foes wait at the entrance). Under a metre high; the footprint is solid.
 */
export const kind = 'taula-picnic';

export function build(kit: LandmarkKit, landmark: GeoLandmark) {
  const W = landmark.w * kit.cell, seed = Number(landmark.params.seed ?? 1);
  if (landmark.params.style === 'plegable') return folding(kit, seed);
  const L = W - 0.5, wood = kit.mesh(), bench = 0.62;
  // Planks of the top and the benches, a hair apart; the A-frames under them at both ends.
  for (let i = 0; i < 4; i++) box(wood, (seed % 2 ? 0.02 : -0.02) * i, 0.72, -0.3 + i * 0.2, L, 0.05, 0.18);
  for (const s of [-1, 1]) for (let i = 0; i < 2; i++) box(wood, 0, 0.42, s * (bench - 0.08 + i * 0.16), L - 0.1, 0.045, 0.14);
  for (const x of [-L / 2 + 0.35, L / 2 - 0.35]) {
    for (const s of [-1, 1]) bar(wood, [x, 0, s * (bench + 0.08)], [x, 0.72, s * 0.12], 0.08);
    box(wood, x, 0.36, 0, 0.08, 0.06, (bench + 0.2) * 2);
  }
  kit.add('Mesa de merendero', wood, kit.surface('fusta-passera', '#8f7a5e'));
  if (landmark.params.melo) {
    const melon = kit.mat('Melón', '#ffffff', 0.35);
    if (!melon.diffuseMap) { melon.diffuseMap = kit.texture(paintMelon()); melon.update(); }
    kit.part('Melón', 'sphere', melon, [0.25, 0.88, 0.02], [0.44, 0.27, 0.27], [0, 18, 0]);
    kit.part('Rabito del melón', 'cylinder', kit.mat('Rabito', '#6b5a2e', 0.2), [0.04, 0.88, -0.05], [0.02, 0.04, 0.02], [0, 0, 80]);
  }
}

/** A folding camping table, aluminium and a laminate top, four folding chairs of faded canvas round it. */
function folding(kit: LandmarkKit, seed: number) {
  const metal = kit.mesh(), top = kit.mesh();
  box(top, 0, 0.68, 0, 1.15, 0.03, 0.7);
  for (const sx of [-1, 1]) {
    bar(metal, [sx * 0.5, 0, -0.32], [sx * 0.5, 0.68, 0.3], 0.025);
    bar(metal, [sx * 0.5, 0, 0.32], [sx * 0.5, 0.68, -0.3], 0.025);
  }
  const cloths = ['#5b6f80', '#6f7a52', '#8a5a40', '#7d7a6a'];
  const chairs = cloths.map(() => kit.mesh());
  const spots: [number, number, number][] = [[-0.95, 0, 90], [0.95, 0, -90], [0, -0.75, 0], [0, 0.75, 180]];
  spots.forEach(([x, z, yaw], i) => {
    const a = yaw * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
    // Local to the chair: +z towards the table.
    const at = (u: number, y: number, v: number): [number, number, number] => [x + u * c + v * s, y, z - u * s + v * c];
    for (const u of [-0.22, 0.22]) {
      bar(metal, at(u, 0, -0.2), at(u, 0.45, 0.2), 0.02);
      bar(metal, at(u, 0, 0.2), at(u, 0.85, -0.22), 0.02);
    }
    const seat = chairs[(i + seed) % chairs.length];
    seat.quad(at(-0.22, 0.44, -0.18), at(0.22, 0.44, -0.18), at(0.22, 0.42, 0.2), at(-0.22, 0.42, 0.2), [0, 1, 0], [0, 0], [1, 0], [1, 1], [0, 1]);
    seat.quad(at(-0.22, 0.5, -0.2), at(0.22, 0.5, -0.2), at(0.22, 0.85, -0.24), at(-0.22, 0.85, -0.24), [s, 0.2, c], [0, 0], [1, 0], [1, 1], [0, 1]);
  });
  kit.add('Mesa plegable', top, kit.mat('Tablero laminado', '#d8d2c2', 0.3));
  kit.add('Patas de aluminio', metal, kit.mat('Aluminio', '#b7bcbd', 0.6), { shadows: false });
  chairs.forEach((m, i) => kit.add('Silla plegable', m, kit.mat(`Lona de silla ${cloths[i]}`, cloths[i], 0.1)));
}

/** A piel de sapo melon: dark green, mottled with yellow-green, a paler belly. */
function paintMelon() {
  const c = document.createElement('canvas'); c.width = 128; c.height = 64;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#4f6a34'; ctx.fillRect(0, 0, 128, 64);
  for (let i = 0; i < 70; i++) {
    const x = (i * 53) % 128, y = (i * 29) % 64, r = 2 + (i % 4);
    ctx.fillStyle = i % 3 ? 'rgba(170,175,95,.55)' : 'rgba(40,58,30,.6)';
    ctx.beginPath(); ctx.ellipse(x, y, r * 1.6, r, 0, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = 'rgba(190,185,110,.5)'; ctx.fillRect(0, 50, 128, 14);
  return c;
}
