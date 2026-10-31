import type { GeoLandmark } from '../geo';
import type { MeshBuilder } from '../geo-scenery';
import type { LandmarkKit } from '../landmarks';

/**
 * The top of Avinguda de la Reina Maria Cristina, compressed to fit the corner of Plaça d'Espanya's
 * map: Buïgas' Magic Fountain in its basin, Puig i Cadafalch's four columns, the stairs and the
 * cascade up Montjuïc's pine slope, and the Palau Nacional on top (the MNAC: a long block, the
 * central dome, two small domes and four corner towers). Real order and shapes, a fraction of the real
 * distances and heights, so the overview sees it up the axis between the towers. Out of reach: the
 * front (+z) faces the square; `fountain_z` is how far in front of the centre the fountain stands.
 */
export const kind = 'palau-nacional';

export function build(kit: LandmarkKit, landmark: GeoLandmark) {
  const fz = Number(landmark.params.fountain_z ?? 29);
  const stone = kit.surface('carreu', '#d9ccb0');
  const granite = kit.surface('granit', '#a8a196');
  const grass = kit.surface('gespa', '#5c7344');
  const water = kit.mat('Agua de la Font Màgica', '#4d8090', 0.92);
  const spray = kit.mat('Chorros', '#e8f2f4', 0.6, 0.35);
  const dome = kit.mat('Cúpula del Palau', '#9aa29a', 0.35);
  const dark = kit.mat('Ventanas del Palau', '#3a3530', 0.2);
  const pine = [kit.mat('Pino', '#3f5a36', 0.1), kit.mat('Pino claro', '#4f6b40', 0.1)];
  const trunk = kit.mat('Tronco de pino', '#6b5a48', 0.1);

  // The Magic Fountain: its stone kerb, the water and a crown of jets round a tall one.
  kit.part('Borde de la Font Màgica', 'cylinder', stone, [0, 0.35, fz], [19.5, 0.7, 19.5]);
  kit.part('Font Màgica', 'cylinder', water, [0, 0.5, fz], [18.4, 0.42, 18.4]);
  for (let i = 0; i < 12; i++) {
    const a = i / 12 * Math.PI * 2;
    kit.part('Chorro', 'cylinder', spray, [Math.sin(a) * 6, 2.2, fz + Math.cos(a) * 6], [0.5, 3.6, 0.5]);
  }
  kit.part('Chorro central', 'cylinder', spray, [0, 4.5, fz], [1.1, 8.2, 1.1]);
  // The four columns, standing in a row across the axis behind the fountain.
  for (const x of [-13.5, -4.5, 4.5, 13.5]) {
    kit.part('Basa de columna', 'box', stone, [x, 0.9, 11], [2.6, 1.8, 2.6]);
    kit.part('Columna jónica', 'cylinder', stone, [x, 7.6, 11], [1.6, 11.6, 1.6]);
    kit.part('Capitel jónico', 'box', stone, [x, 13.7, 11], [2.4, 0.7, 1.7]);
  }
  // The slope: stairs either side of the cascade up to the plateau, green banks beyond.
  const slope = kit.mesh(), stair = kit.mesh(), fall = kit.mesh(), top = 7, front = 7, back = -6;
  ramp(slope, -75, -14, front, back, top);
  ramp(slope, 14, 75, front, back, top);
  ramp(stair, -14, -4, front, back, top);
  ramp(stair, 4, 14, front, back, top);
  ramp(fall, -4, 4, front, back, top);
  for (let k = 1; k < 8; k++) {
    // The cascade's lips catch the light as steps of foam.
    const t = k / 8, z = front + (back - front) * t;
    kit.part('Salto de agua', 'box', spray, [0, top * t + 0.05, z], [8, 0.12, 0.3]);
  }
  // The plateau and the hill behind, out to the map's corner and beyond.
  slope.quad([-75, top, back], [75, top, back], [75, top, -90], [-75, top, -90], [0, 1, 0], [-75, back], [75, back], [75, -90], [-75, -90]);
  for (const side of [-1, 1]) slope.quad([side * 75, 0, front], [side * 75, 0, -90], [side * 75, top, -90], [side * 75, top, back], [side, 0, 0], [front, 0], [-90, 0], [-90, top], [back, top]);
  kit.add('Ladera de Montjuïc', slope, grass);
  kit.add('Escalinata', stair, granite);
  kit.add('Cascada', fall, water);
  // The Palau Nacional on the plateau: the block, its windows, the domes and the corner towers.
  const pz = -20, block = kit.mesh(), domes = kit.mesh();
  box(block, [0, top + 5.5, pz], [56, 11, 18]);
  box(block, [0, top + 11.4, pz], [58, 0.8, 19.5]);
  for (let i = -6; i <= 6; i++) box(domes, [i * 4, top + 6, pz + 9.05], [1.4, 4.5, 0.1]);
  box(block, [0, top + 13.2, pz], [12, 2.8, 12]);
  kit.part('Tambor', 'cylinder', stone, [0, top + 15.6, pz], [11, 2.4, 11]);
  kit.part('Cúpula central', 'sphere', dome, [0, top + 16.8, pz], [12.4, 9.6, 12.4]);
  kit.part('Linterna', 'cylinder', stone, [0, top + 22, pz], [1.8, 1.8, 1.8]);
  for (const x of [-15, 15]) {
    kit.part('Tambor menor', 'cylinder', stone, [x, top + 12.6, pz], [5, 1.6, 5]);
    kit.part('Cúpula menor', 'sphere', dome, [x, top + 13.4, pz], [5.6, 4.6, 5.6]);
  }
  for (const x of [-26, 26]) for (const z of [pz - 7, pz + 7]) {
    box(block, [x, top + 8.5, z], [5, 17, 5]);
    kit.part('Remate de torre', 'cone', dome, [x, top + 18.6, z], [3.6, 3.2, 3.6]);
  }
  kit.add('Palau Nacional', block, stone);
  kit.add('Ventanas del Palau', domes, dark);
  // Montjuïc's pines on the banks either side of the stairs and behind the Palau.
  for (let i = 0; i < 46; i++) {
    const r = (n: number) => { const v = Math.sin(i * 91.7 + n * 37.3) * 43758.5; return v - Math.floor(v); };
    const side = i % 2 ? 1 : -1, x = side * (18 + r(1) * 56), z = front - 2 - r(2) * 80;
    if (Math.abs(x) < 34 && z < back + 4 && z > pz - 14) continue;
    const ground = z > back ? top * (front - z) / (front - back) : top, s = 3.2 + r(3) * 2.6;
    kit.part('Tronco de pino', 'cylinder', trunk, [x, ground + s * 0.45, z], [0.4, s * 0.9, 0.4]);
    kit.part('Copa de pino', 'sphere', pine[i % 2], [x, ground + s, z], [s * 1.3, s * 0.7, s * 1.3]);
  }
}

/** A ramp from the ground at `z0` up to `y` at `z1`, between `x0` and `x1`; UVs in metres along the slope. */
function ramp(m: MeshBuilder, x0: number, x1: number, z0: number, z1: number, y: number) {
  const len = Math.hypot(y, z0 - z1);
  m.quad([x0, 0, z0], [x1, 0, z0], [x1, y, z1], [x0, y, z1], [0, z0 - z1, y], [x0, 0], [x1, 0], [x1, len], [x0, len]);
}
/** A box (centre, size) in metres; UVs in metres, no bottom. */
function box(m: MeshBuilder, [x, y, z]: number[], [w, h, d]: number[]) {
  const x0 = x - w / 2, x1 = x + w / 2, y0 = y - h / 2, y1 = y + h / 2, z0 = z - d / 2, z1 = z + d / 2;
  m.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1], [x0, y0], [x1, y0], [x1, y1], [x0, y1]);
  m.quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [0, 0, -1], [-x1, y0], [-x0, y0], [-x0, y1], [-x1, y1]);
  m.quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [1, 0, 0], [-z1, y0], [-z0, y0], [-z0, y1], [-z1, y1]);
  m.quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [-1, 0, 0], [z0, y0], [z1, y0], [z1, y1], [z0, y1]);
  m.quad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], [0, 1, 0], [x0, z1], [x1, z1], [x1, z0], [x0, z0]);
}
