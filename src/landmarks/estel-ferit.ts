import type { GeoLandmark } from '../geo';
import type { LandmarkKit } from '../landmarks';

/**
 * L'Estel Ferit (Rebecca Horn, 1992), on the Platja de Sant Miquel: four hollow iron cubes stacked
 * off true to 10.6 m on a low concrete base people sit on, each turned and tilted a little more than
 * the one below, so the column leans out over the sand. Rusted iron, the lowest cube darker; a band
 * of small square windows near the top of each. In 2021 a rope on timber posts ran round it.
 * `cubes`, `cube_m` and `height_m` follow the city's record (10.60 × 5.17 × 5.17 m).
 */
export const kind = 'estel-ferit';

/** Each cube's shift (metres) and turn (degrees: roll, pitch, yaw) from true, bottom to top. */
const OFF_TRUE: [number, number, number, number, number][] = [
  [0, 0, 0, 0, 0], [0.22, -0.08, -3, 1.5, 7], [0.62, 0.06, -6.5, -1, -4], [1.15, -0.1, -9.5, 2, 10],
];

export function build(kit: LandmarkKit, landmark: GeoLandmark) {
  const count = Number(landmark.params.cubes ?? 4), side = Number(landmark.params.cube_m ?? 2.6);
  const height = Number(landmark.params.height_m ?? 10.6), base = 0.45, step = (height - base) / count;
  const rust = kit.surface('acer-corten', '#6a3620', 0.18), dark = kit.surface('acer-corten', '#4a3a31', 0.18);
  const concrete = kit.surface('formigo', '#c9c3b6', 0.08);
  // The base: a slab a little wider than the column, where people sit facing the sea.
  kit.part('Base de hormigón', 'box', concrete, [0.3, base / 2, 0], [side + 2.2, base, side + 1]);
  const iron = kit.mesh(), lowest = kit.mesh(), glass = kit.mesh();
  // The windows: a texture of two rows of six panes in rusted frames, the glass catching the sky.
  const panes = kit.mat('Ventanas del Estel', '#ffffff', 0.85);
  const band = [side * 0.72, step * 0.34];
  // The box's UVs count metres from its lower corner: once across the band, the canvas upright.
  panes.diffuseMap = kit.texture(windowBand()); panes.diffuseMapTiling.set(1 / band[0], -1 / band[1]); panes.diffuseMapOffset.set(0, 1); panes.update();
  let y = base;
  for (let i = 0; i < count; i++) {
    const [dx, dz, roll, pitch, yaw] = OFF_TRUE[Math.min(i, OFF_TRUE.length - 1)];
    const centre = [dx, y + step / 2, dz], euler = [pitch, yaw, roll];
    (i === 0 ? lowest : iron).box(centre, [side, step, side], euler);
    // The band sits on the front face near the top, a hair proud of the iron.
    glass.box(rotate([-side * 0.08, step * 0.27, side / 2 + 0.012], euler, centre), [band[0], band[1], 0.01], euler);
    // The next cube rests on this one's top, carried by its lean.
    y += step * Math.cos(roll * Math.PI / 180);
  }
  kit.add('Cubos del Estel', iron, rust, { cut: true });
  kit.add('Cubo de abajo', lowest, dark, { cut: true });
  kit.add('Ventanas del Estel', glass, panes, { cut: true, shadows: false });
  // The rope cordon: timber posts round the base, a slack rope between them.
  const post = kit.mat('Poste de madera', '#8a6a48', 0.1), rope = kit.mat('Cuerda', '#d8cfb8', 0.1);
  const [w, d] = [landmark.w * kit.cell / 2 - 0.3, landmark.d * kit.cell / 2 - 0.3];
  const corners = [[-w, -d], [w, -d], [w, d], [-w, d]];
  for (let k = 0; k < 4; k++) {
    const [ax, az] = corners[k], [bx, bz] = corners[(k + 1) % 4], len = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.round(len / 2.2));
    for (let j = 0; j < n; j++) {
      const t = j / n, px = ax + (bx - ax) * t, pz = az + (bz - az) * t;
      kit.part('Poste del cordón', 'cylinder', post, [px, 0.45, pz], [0.1, 0.9, 0.1]);
      // Each rope sags a little in the middle of its span.
      const mx = px + (bx - ax) / n / 2, mz = pz + (bz - az) / n / 2, yaw = -Math.atan2(bz - az, bx - ax) * 180 / Math.PI;
      kit.part('Cuerda del cordón', 'box', rope, [mx, 0.72, mz], [len / n, 0.03, 0.03], [0, yaw, 0]);
    }
  }
}

/** A point given in a cube's own frame (turned by `euler`, degrees) moved into the landmark's. */
function rotate(p: number[], euler: number[], centre: number[]) {
  const [rx, ry, rz] = euler.map(d => d * Math.PI / 180);
  let [x, y, z] = p;
  [x, y] = [x * Math.cos(rz) - y * Math.sin(rz), x * Math.sin(rz) + y * Math.cos(rz)];
  [y, z] = [y * Math.cos(rx) - z * Math.sin(rx), y * Math.sin(rx) + z * Math.cos(rx)];
  [x, z] = [x * Math.cos(ry) + z * Math.sin(ry), -x * Math.sin(ry) + z * Math.cos(ry)];
  return [x + centre[0], y + centre[1], z + centre[2]];
}

/** Two rows of six panes in heavy rusted frames; the glass dark, with the sky's sheen at the top. */
function windowBand() {
  const c = document.createElement('canvas'); c.width = 192; c.height = 64;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#5a2f1c'; ctx.fillRect(0, 0, 192, 64);
  for (let r = 0; r < 2; r++) for (let k = 0; k < 6; k++) {
    const g = ctx.createLinearGradient(0, 4 + r * 30, 0, 30 + r * 30);
    g.addColorStop(0, '#9fb6c2'); g.addColorStop(0.45, '#45545c'); g.addColorStop(1, '#262d31');
    ctx.fillStyle = g; ctx.fillRect(5 + k * 31, 5 + r * 29, 26, 25);
  }
  return c;
}
