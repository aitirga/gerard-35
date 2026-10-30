import type { GeoLandmark } from '../geo';
import type { LandmarkKit } from '../landmarks';

/**
 * A street kiosk on the pavement: the map's shop=kiosk. A ONCE booth (its `name`) is white
 * aluminium with the green band and the coupons in the window; any other is Barcelona's dark green
 * newspaper kiosk with magazines hung round its open front. `colour`, `accent` and `sign` override.
 */
export const kind = 'kiosk';

export function build(kit: LandmarkKit, landmark: GeoLandmark) {
  const once = String(landmark.params.name ?? '').toUpperCase() === 'ONCE';
  const body = kit.mat('Chapa del quiosco', String(landmark.params.colour ?? (once ? '#e6e8e6' : '#2e4a3a')), 0.35);
  const accent = kit.mat('Franja del quiosco', String(landmark.params.accent ?? (once ? '#11884a' : '#1f3328')), 0.35);
  const sign = String(landmark.params.sign ?? (once ? 'ONCE' : 'PREMSA'));
  // Footprint 2.2 × 1.5 m: the body, a roof that overhangs on every side, a plinth.
  kit.part('Zócalo del quiosco', 'box', accent, [0, 0.08, 0], [2.05, 0.16, 1.35]);
  kit.part('Cuerpo del quiosco', 'box', body, [0, 1.1, 0], [2, 1.9, 1.3]);
  kit.part('Tejadillo', 'box', accent, [0, 2.12, 0], [2.3, 0.14, 1.6]);
  kit.part('Mostrador', 'box', accent, [0, 0.95, 0.74], [1.7, 0.06, 0.2]);
  // The open front, painted: the sign over a window of coupons or magazines.
  const front = kit.texture(paint(sign, once));
  const glass = kit.mat(`Escaparate ${sign}`, '#ffffff', 0.5, 0.25);
  glass.diffuseMap = front; glass.emissiveMap = front; glass.emissive.set(1, 1, 1); glass.update();
  const quad = kit.mesh();
  quad.quad([-0.95, 0.98, 0.652], [0.95, 0.98, 0.652], [0.95, 2.0, 0.652], [-0.95, 2.0, 0.652], [0, 0, 1], [0, 1], [1, 1], [1, 0], [0, 0]);
  kit.add('Frente del quiosco', quad, glass, { shadows: false });
}

function paint(sign: string, once: boolean) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 136;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = once ? '#11884a' : '#1f3328'; ctx.fillRect(0, 0, 256, 136);
  ctx.fillStyle = '#ffffff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = '800 26px "Helvetica Neue", Arial, sans-serif'; ctx.fillText(sign, 128, 17);
  // The window: rows of coupons (ONCE) or magazine covers, lit from inside.
  ctx.fillStyle = '#f6efd9'; ctx.fillRect(10, 36, 236, 94);
  const colours = once ? ['#11884a', '#f2c230', '#ffffff', '#e2483d'] : ['#e2483d', '#2f6fb5', '#f2c230', '#f4f1ea', '#8a3fa0', '#1d1d1d'];
  for (let r = 0; r < 3; r++) for (let k = 0; k < 9; k++) {
    ctx.fillStyle = colours[(r * 5 + k * 3) % colours.length];
    ctx.fillRect(16 + k * 26, 42 + r * 30, once ? 22 : 20, once ? 12 : 26);
  }
  return c;
}
