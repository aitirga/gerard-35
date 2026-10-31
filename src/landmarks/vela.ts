import type { GeoLandmark } from '../geo';
import type { LandmarkKit } from '../landmarks';

/**
 * The W Barcelona, the *Hotel Vela* (Ricardo Bofill, 2009), seen from the Barceloneta at the end of
 * the beach: a glass sail on the port's reclaimed land, its curved front to the city (+z), straight
 * up on one side and rounding down to the other. A backdrop past the map's edge: scaled down
 * (`height_m`, the real one is 99 m) and paled by the sea haze, on a low podium and a spit of land.
 */
export const kind = 'vela';

export function build(kit: LandmarkKit, landmark: GeoLandmark) {
  const H = Number(landmark.params.height_m ?? 26), W = H * 0.5, bow = W * 0.32, thick = W * 0.36;
  const haze = String(landmark.params.haze ?? '#a9bcc8');
  kit.part('Tierra del puerto', 'box', kit.mat('Tierra del puerto', '#d8cba9', 0.05), [0, 0.1, -2], [W * 3.2, 0.2, W * 2]);
  kit.part('Podio del hotel', 'box', kit.mat('Podio del hotel', '#c7c9c6', 0.1), [W * 0.25, 1.2, -1], [W * 1.8, 2.4, W * 0.9]);
  const glass = kit.mat('Cristal de la Vela', '#ffffff', 0.7);
  glass.diffuseMap = kit.texture(floors()); glass.emissive.fromString(haze); glass.emissiveIntensity = 0.25; glass.update();
  const sail = kit.mesh(), steps = 18;
  // The plan bows out to the front; the height falls from full at the left edge to nothing at the right.
  const plan = (t: number, back: boolean): [number, number] => [-W / 2 + W * t, (back ? -thick : 0) + bow * Math.sin(Math.PI * t) * (back ? 0.6 : 1)];
  const top = (t: number) => 2.4 + (H - 2.4) * Math.sqrt(Math.max(0, 1 - t * t));
  for (let i = 0; i < steps; i++) {
    const [t0, t1] = [i / steps, (i + 1) / steps], [f0, f1, b0, b1] = [plan(t0, false), plan(t1, false), plan(t0, true), plan(t1, true)];
    const [h0, h1] = [top(t0), top(t1)];
    // Front and back glass (UVs: storeys up, bays along), and the roof's thin edge.
    sail.quad([f0[0], 2.4, f0[1]], [f1[0], 2.4, f1[1]], [f1[0], h1, f1[1]], [f0[0], h0, f0[1]], [0, 0, 1], [t0, h0 / 3.2], [t1, h1 / 3.2], [t1, 0], [t0, 0]);
    sail.quad([b1[0], 2.4, b1[1]], [b0[0], 2.4, b0[1]], [b0[0], h0, b0[1]], [b1[0], h1, b1[1]], [0, 0, -1], [t1, h1 / 3.2], [t0, h0 / 3.2], [t0, 0], [t1, 0]);
    sail.quad([f0[0], h0, f0[1]], [f1[0], h1, f1[1]], [b1[0], h1, b1[1]], [b0[0], h0, b0[1]], [0, 1, 0], [0, 0], [0, 0], [0, 0], [0, 0]);
  }
  const [f, b] = [plan(0, false), plan(0, true)];
  sail.quad([b[0], 2.4, b[1]], [f[0], 2.4, f[1]], [f[0], H, f[1]], [b[0], H, b[1]], [-1, 0, 0], [0, 0], [0, 0], [0, 0], [0, 0]);
  kit.add('La Vela', sail, glass, { shadows: false });
}

/** Floors of dark glass between pale bands, the haze already in them. */
function floors() {
  const c = document.createElement('canvas'); c.width = 64; c.height = 64;
  const ctx = c.getContext('2d')!;
  const g = ctx.createLinearGradient(0, 0, 64, 0);
  g.addColorStop(0, '#7f97a6'); g.addColorStop(0.6, '#93a9b6'); g.addColorStop(1, '#a8bac4');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64);
  ctx.fillStyle = 'rgba(225,232,236,.55)'; ctx.fillRect(0, 0, 64, 7);
  return c;
}
