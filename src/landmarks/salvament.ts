import type { GeoLandmark } from '../geo';
import { box, type LandmarkKit } from '../landmarks';

/**
 * A lifeguard post on Barcelona's beaches today (2023): a white cabin on a galvanised steel frame,
 * an orange band round the deck with SALVAMENT and the blue cross, a rail round the deck, steps up
 * the side and a flat roof that overhangs. Its front (+z) faces the sea; `number` is painted on it.
 */
export const kind = 'salvament';

export function build(kit: LandmarkKit, landmark: GeoLandmark) {
  const steel = kit.mat('Acero galvanizado', '#9aa2a6', 0.5), white = kit.mat('Caseta blanca', '#eeeeea', 0.25);
  const deckY = 1.3, cabin = kit.mesh(), roof = kit.mesh();
  // The frame: four legs braced in an X on each side, sled runners on the sand.
  for (const sx of [-1, 1]) {
    kit.part('Patín', 'box', steel, [sx * 1.2, 0.06, 0], [0.1, 0.1, 2.8]);
    for (const sz of [-1, 1]) kit.part('Pata', 'box', steel, [sx * 1.05, deckY / 2, sz * 1.05], [0.09, deckY, 0.09]);
    kit.part('Riostra', 'box', steel, [sx * 1.05, deckY / 2, 0], [0.05, 0.05, 2.5], [Math.atan2(deckY, 2.1) * 180 / Math.PI, 0, 0]);
    kit.part('Riostra', 'box', steel, [sx * 1.05, deckY / 2, 0], [0.05, 0.05, 2.5], [-Math.atan2(deckY, 2.1) * 180 / Math.PI, 0, 0]);
  }
  // The deck with its orange band, the cabin on its back half, the roof over both.
  box(cabin, [0, deckY + 0.05, 0], [2.6, 0.1, 2.6]);
  box(cabin, [0, deckY + 1.1, -0.35], [1.9, 2.0, 1.7]);
  box(roof, [0, deckY + 2.2, -0.1], [2.5, 0.12, 2.4]);
  kit.add('Caseta de socorristas', cabin, white, { cut: true });
  kit.add('Techo de la caseta', roof, white, { cut: true });
  const band = kit.mat('Franja SALVAMENT', '#ffffff', 0.3);
  band.diffuseMap = kit.texture(paintBand(String(landmark.params.number ?? '14'))); band.update();
  const strip = kit.mesh();
  // One painted strip round the deck: front, sides and back, 0.5 m high, read from the sea and the camera.
  strip.quad([-1.32, deckY - 0.45, 1.32], [1.32, deckY - 0.45, 1.32], [1.32, deckY + 0.05, 1.32], [-1.32, deckY + 0.05, 1.32], [0, 0, 1], [0, 1], [1, 1], [1, 0], [0, 0]);
  strip.quad([1.32, deckY - 0.45, 1.32], [1.32, deckY - 0.45, -1.32], [1.32, deckY + 0.05, -1.32], [1.32, deckY + 0.05, 1.32], [1, 0, 0], [0, 1], [1, 1], [1, 0], [0, 0]);
  strip.quad([-1.32, deckY - 0.45, -1.32], [-1.32, deckY - 0.45, 1.32], [-1.32, deckY + 0.05, 1.32], [-1.32, deckY + 0.05, -1.32], [-1, 0, 0], [0, 1], [1, 1], [1, 0], [0, 0]);
  kit.add('Franja SALVAMENT', strip, band, { cut: true, shadows: false });
  // The rail round the front of the deck and the steps down the left side.
  for (const [x, z, w, d] of [[0, 1.25, 2.6, 0.05], [1.27, 0.45, 0.05, 1.6], [-1.27, 0.45, 0.05, 1.6]]) {
    kit.part('Barandilla', 'box', steel, [x, deckY + 0.95, z], [w, 0.05, d]);
    kit.part('Barandilla baja', 'box', steel, [x, deckY + 0.55, z], [w, 0.04, d]);
  }
  for (let i = 0; i < 5; i++) kit.part('Peldaño', 'box', steel, [-1.6 - i * 0.22, deckY - 0.26 * (i + 1), 0.6], [0.28, 0.04, 0.8]);
  // A dark window with the number beside it, on the cabin's front.
  kit.part('Ventana de la caseta', 'box', kit.mat('Cristal de la caseta', '#2f3a40', 0.8), [0.35, deckY + 1.5, 0.52], [0.9, 0.55, 0.02]);
}

/** SALVAMENT in white on orange between two blue crosses, then the post's number. */
function paintBand(number: string) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 64;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#ef7d32'; ctx.fillRect(0, 0, 512, 64);
  for (const cx of [40, 472]) {
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(cx, 32, 22, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#2f6fb5'; ctx.fillRect(cx - 4, 18, 8, 28); ctx.fillRect(cx - 14, 28, 28, 8);
  }
  ctx.fillStyle = '#ffffff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = '800 38px "Helvetica Neue", Arial, sans-serif'; ctx.fillText(`SALVAMENT  ${number}`, 256, 34);
  return c;
}
