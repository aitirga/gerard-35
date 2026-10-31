import type { GeoLandmark } from '../geo';
import type { LandmarkKit } from '../landmarks';

/**
 * A patch of ground in the open with a broken edge, flat on the gravel: what is left of a shack's
 * floor (Els Canons, Turó de la Rovira, 1944-1990) or a tuft of the hill's dry grass. `kind`:
 * `terracota` (red 25 cm grès tiles, the library's `rajola`), `hidraulica` (grey 20 cm cement tiles,
 * some patterned, a few missing: painted here) or `herba` (dry grass, `herba-seca`). It fills the
 * footprint (`size_m`); `seed` varies the edge.
 */
export const kind = 'rajoles';

export function build(kit: LandmarkKit, landmark: GeoLandmark) {
  const p = landmark.params, seed = Number(p.seed ?? 1), w = landmark.w * kit.cell / 2, d = landmark.d * kit.cell / 2;
  const rand = (i: number) => { const v = Math.sin((i + seed * 19) * 91.3 + 17.1) * 43758.5453; return v - Math.floor(v); };
  // A ring of jittered points round the footprint's ellipse, fanned from the middle; UVs in metres.
  const SIDES = 18, y = 0.04, mesh = kit.mesh();
  const ring = Array.from({ length: SIDES }, (_, i) => {
    const a = i / SIDES * Math.PI * 2, r = 0.55 + rand(i) * 0.45;
    return [Math.cos(a) * w * r, Math.sin(a) * d * r];
  });
  for (let i = 0; i < SIDES; i++) {
    const [ax, az] = ring[i], [bx, bz] = ring[(i + 1) % SIDES];
    mesh.tri([0, y, 0], [ax, y, az], [bx, y, bz], [0, 1, 0], [0, 0], [ax, az], [bx, bz]);
  }
  const material = p.kind === 'terracota' ? kit.surface('rajola', '#b5664a', 0.15)
    : p.kind === 'herba' ? kit.surface('herba-seca', '#ab9566', 0.05)
    : hydraulic(kit);
  kit.add(p.kind === 'herba' ? 'Hierba seca' : 'Suelo de barraca', mesh, material, { shadows: false });
  // Dry grass grows in tufts, a few leaning blades each, thicker in the middle of the patch.
  if (p.kind !== 'herba') return;
  const blades = [kit.mat('Brizna seca', '#b89c5e', 0.05), kit.mat('Brizna seca clara', '#cdb27a', 0.05), kit.mat('Brizna seca oscura', '#8c7a4c', 0.05)];
  for (let k = 0, n = Math.round(w * d * 1.6); k < n; k++) {
    const a = rand(k + 40) * Math.PI * 2, r = Math.sqrt(rand(k + 60)) * 0.7, x = Math.cos(a) * w * r, z = Math.sin(a) * d * r;
    for (let b = 0; b < 3; b++) {
      const h = 0.22 + rand(k * 3 + b + 80) * 0.22;
      kit.part('Brizna', 'cone', blades[(k + b) % 3], [x + (b - 1) * 0.05, h / 2, z], [0.06, h, 0.06], [(rand(k + b + 90) - 0.5) * 40, 0, (b - 1) * 18]);
    }
  }
}

/** Grey cement tiles 20 cm square, one in five with a four-petal pattern, some lost to the gravel; 0.8 m across. */
function hydraulic(kit: LandmarkKit) {
  const m = kit.mat('Baldosa hidráulica', '#ffffff', 0.12);
  if (m.diffuseMap) return m;   // shared by every patch of the scene
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const ctx = c.getContext('2d')!, t = 32;
  ctx.fillStyle = '#8a857c'; ctx.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
    const k = i * 4 + j, x = i * t, z = j * t;
    if (k === 6 || k === 13) continue;   // lifted: the grout bed shows
    ctx.fillStyle = ['#a8a39a', '#9f9a90', '#b0aa9f'][k % 3]; ctx.fillRect(x + 1, z + 1, t - 2, t - 2);
    if ((k * 7) % 5 === 0) {
      ctx.fillStyle = '#7b5a3c';
      for (const [dx, dz] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) { ctx.beginPath(); ctx.ellipse(x + t / 2 + dx * 7, z + t / 2 + dz * 7, dx ? 6 : 3.2, dz ? 6 : 3.2, 0, 0, Math.PI * 2); ctx.fill(); }
      ctx.fillStyle = '#2f2c28'; ctx.fillRect(x + t / 2 - 2.5, z + t / 2 - 2.5, 5, 5);
    }
  }
  m.diffuseMap = kit.texture(c);
  // The mesh's UVs are metres: one canvas is 0.8 m.
  m.diffuseMapTiling.set(1 / 0.8, 1 / 0.8); m.update();
  return m;
}
