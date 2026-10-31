import * as pc from 'playcanvas';
import type { GeoLandmark } from '../geo';
import type { LandmarkKit } from '../landmarks';

/**
 * El Nucli's shop front on Carrer de Valladolid (docs/places/nucli.md): a wine-red front with the
 * name in cream on the fascia, two windows of game boxes and the glass door between them, all lit
 * from inside, the street's one warm light; and the round sign hung out over the door on an iron
 * bracket. The real badge is not copied: the disc carries the name and a fan of plain cards.
 * Built against the wall, its front (+z) to the street. `door` is the door's centre along the
 * front (metres from the landmark's centre), `width` the front's length.
 */
export const kind = 'nucli-front';

const WINE = '#5d0e11', CREAM = '#f3e6d0';

export function build(kit: LandmarkKit, landmark: GeoLandmark) {
  const width = Number(landmark.params.width ?? 8.4), door = Number(landmark.params.door ?? 0), half = width / 2;
  const top = 3.3, sill = 0.5, head = 2.55, doorW = 1.15;
  const wine = kit.mat('Frente granate', WINE, 0.25);
  const iron = kit.mat('Hierro del rótulo', '#26292a', 0.4);
  // The front itself: wine-red panels round the openings, standing a hand in front of the wall.
  const panels = kit.mesh(), z = 0.06;
  const rect = (x0: number, x1: number, y0: number, y1: number) => panels.quad([x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z], [0, 0, 1], [x0, 0], [x1, 0], [x1, y1], [x0, y1]);
  const openings: [number, number, number][] = [[-half + 0.3, door - doorW / 2 - 0.25, sill], [door - doorW / 2, door + doorW / 2, 0.02], [door + doorW / 2 + 0.25, half - 0.3, sill]];
  rect(-half, half, head, top);
  rect(-half, openings[0][0], 0, head); rect(openings[2][1], half, 0, head);
  rect(openings[0][1], openings[1][0], 0, head); rect(openings[1][1], openings[2][0], 0, head);
  rect(openings[0][0], openings[0][1], 0, sill); rect(openings[2][0], openings[2][1], 0, sill);
  kit.add('Frente de El Nucli', panels, wine);
  // A cream moulding round the fascia, and the sills.
  kit.part('Moldura', 'box', kit.mat('Moldura crema', CREAM, 0.3), [0, head + 0.02, z + 0.03], [width, 0.05, 0.06]);
  kit.part('Cornisa', 'box', kit.mat('Moldura crema', CREAM, 0.3), [0, top, z + 0.04], [width + 0.1, 0.07, 0.12]);
  for (const [x0, x1] of [openings[0], openings[2]]) kit.part('Alféizar', 'box', iron, [(x0 + x1) / 2, sill - 0.03, z + 0.06], [x1 - x0 + 0.06, 0.06, 0.1]);

  // The fascia: the name in cream, hand-painted letters.
  const fascia = canvas(1024, 96, ctx => {
    ctx.fillStyle = WINE; ctx.fillRect(0, 0, 1024, 96);
    ctx.fillStyle = CREAM; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = '700 62px Georgia, "Times New Roman", serif'; ctx.fillText('EL NUCLI', 512, 42);
    ctx.font = '600 15px "Helvetica Neue", Arial, sans-serif'; ctx.fillText('JOCS DE TAULA  ·  CARTES  ·  ROL', 512, 82);
  });
  const sign = kit.mat('Rótulo de El Nucli', '#ffffff', 0.2);
  sign.diffuseMap = kit.texture(fascia); sign.update();
  const name = kit.mesh(), fy0 = head + 0.06, fy1 = top - 0.05, fw = Math.min(width - 0.4, 6.5);
  name.quad([-fw / 2, fy0, z + 0.005], [fw / 2, fy0, z + 0.005], [fw / 2, fy1, z + 0.005], [-fw / 2, fy1, z + 0.005], [0, 0, 1], [0, 1], [1, 1], [1, 0], [0, 0]);
  kit.add('Nombre en la fachada', name, sign, { shadows: false });

  // The windows and the door, lit from inside: one painted picture across the three openings.
  const x0 = openings[0][0], x1 = openings[2][1];
  const glow = canvas(1024, 256, ctx => paintWindows(ctx, (door - doorW / 2 - x0) / (x1 - x0), (door + doorW / 2 - x0) / (x1 - x0)));
  const lit = kit.mat('Escaparate encendido', '#ffffff', 0.6, 0.95);
  lit.diffuseMap = kit.texture(glow); lit.emissiveMap = lit.diffuseMap; lit.emissive.set(1, 1, 1); lit.update();
  const glass = kit.mesh(), gz = 0.03;
  for (const [a, b, y0] of openings) {
    const u0 = (a - x0) / (x1 - x0), u1 = (b - x0) / (x1 - x0), v0 = 1 - (y0 / head);
    glass.quad([a, y0, gz], [b, y0, gz], [b, head, gz], [a, head, gz], [0, 0, 1], [u0, v0], [u1, v0], [u1, 0], [u0, 0]);
  }
  kit.add('Escaparate de El Nucli', glass, lit, { shadows: false });
  // The door's frame and push bar, and the mullions of the windows.
  for (const x of [door - doorW / 2, door + doorW / 2]) kit.part('Marco de la puerta', 'box', wine, [x, head / 2, z + 0.02], [0.08, head, 0.08]);
  kit.part('Barra de la puerta', 'box', kit.mat('Latón', '#b8913f', 0.7), [door, 1.05, z + 0.06], [doorW * 0.6, 0.04, 0.04]);
  for (const [a, b] of [openings[0], openings[2]]) kit.part('Montante', 'box', wine, [(a + b) / 2, (sill + head) / 2, z + 0.02], [0.06, head - sill, 0.06]);

  // The round sign hung out over the door: a wine disc on an iron bracket, the name and a fan of cards on both faces.
  const sx = door - doorW / 2 - 0.45, sy = 3.0, out = 0.75;
  kit.part('Escuadra', 'box', iron, [sx, sy + 0.5, out / 2 + 0.05], [0.04, 0.04, out + 0.1]);
  kit.part('Escuadra', 'box', iron, [sx, sy + 0.3, 0.2], [0.03, 0.03, 0.45], [35, 0, 0]);
  for (const k of [-1, 1]) kit.part('Cadena', 'box', iron, [sx, sy + 0.44, out + k * 0.18], [0.015, 0.12, 0.015]);
  kit.part('Rótulo redondo', 'cylinder', wine, [sx, sy, out], [0.78, 0.06, 0.78], [0, 0, 90]);
  const disc = canvas(256, 256, ctx => paintDisc(ctx));
  const face = kit.mat('Cara del rótulo redondo', '#ffffff', 0.25);
  face.diffuseMap = kit.texture(disc); face.opacityMap = face.diffuseMap; face.opacityMapChannel = 'a'; face.alphaTest = 0.5; face.update();
  const faces = kit.mesh(), r = 0.39;
  for (const side of [1, -1]) {
    // Each face reads left to right from its own side of the street.
    const fx = sx + side * 0.033, left = out + side * r, right = out - side * r;
    faces.quad([fx, sy - r, left], [fx, sy - r, right], [fx, sy + r, right], [fx, sy + r, left], [side, 0, 0], [0, 1], [1, 1], [1, 0], [0, 0]);
  }
  kit.add('Caras del rótulo', faces, face, { shadows: false });

  // The window's warm light spilling on the pavement in front.
  const spill = kit.mat('Luz del escaparate en la acera', '#000000', 0);
  spill.emissiveMap = kit.texture(canvas(256, 128, ctx => {
    const g = ctx.createRadialGradient(128, 0, 0, 128, 0, 150);
    g.addColorStop(0, '#ffffff'); g.addColorStop(0.35, '#9c9c9c'); g.addColorStop(1, '#000000');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 256, 128);
  }));
  spill.emissive.fromString('#ffb35c'); spill.emissiveIntensity = 0.55; spill.useLighting = false;
  spill.blendType = pc.BLEND_ADDITIVE; spill.depthWrite = false; spill.update();
  const pool = kit.mesh(), py = 0.07, pz0 = 0.15, pz1 = 3.4;
  pool.quad([x0 - 0.6, py, pz0], [x1 + 0.6, py, pz0], [x1 + 0.6, py, pz1], [x0 - 0.6, py, pz1], [0, 1, 0], [0, 0], [1, 0], [1, 1], [0, 1]);
  kit.add('Luz en la acera', pool, spill, { shadows: false });

  function canvas(w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    draw(c.getContext('2d')!);
    return c;
  }
}

/** The lit shop seen through its glass: shelves of boxes, a display of boxes in front, the tournament poster, the open door. */
function paintWindows(ctx: CanvasRenderingContext2D, d0: number, d1: number) {
  const W = 1024, H = 256, colours = ['#8c3b32', '#2f4a6b', '#d1a54a', '#3f6b4f', '#e7dcc6', '#5a3f5f', '#c8643f', '#2e5e6e', '#d9b25a', '#7a8f4a'];
  const back = ctx.createLinearGradient(0, 0, 0, H);
  back.addColorStop(0, '#ffcf8a'); back.addColorStop(1, '#d9894a');
  ctx.fillStyle = back; ctx.fillRect(0, 0, W, H);
  // Shelves of boxes at the back of the shop, spines out.
  for (let row = 0; row < 3; row++) {
    const y = 18 + row * 46;
    ctx.fillStyle = '#7a5a3a'; ctx.fillRect(0, y + 38, W, 5);
    for (let x = 4, k = row * 5; x < W; k++) { const w = 10 + ((k * 37) % 13); ctx.fillStyle = colours[k % colours.length]; ctx.fillRect(x, y + 6 + (k % 3) * 3, w, 32 - (k % 3) * 3); x += w + 2; }
  }
  // The display in the window: boxes standing face out on two steps.
  for (let k = 0; k < 18; k++) {
    const x = 10 + k * 56 + (k % 2) * 8, y = k % 2 ? 160 : 190, s = 44;
    if (x / W > d0 - 0.04 && x / W < d1 + 0.01) continue;
    ctx.fillStyle = colours[(k * 3) % colours.length]; ctx.fillRect(x, y, s, s);
    ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(x, y, s, 8);
    ctx.fillStyle = colours[(k * 3 + 4) % colours.length]; ctx.beginPath(); ctx.arc(x + s / 2, y + s * 0.6, s * 0.2, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = '#c69a62'; ctx.fillRect(0, 234, W, 22);
  // The tournament poster stuck on the glass.
  const px = W * (d1 + 0.04);
  ctx.fillStyle = '#efe6d2'; ctx.fillRect(px, 40, 52, 74);
  ctx.fillStyle = WINE; ctx.fillRect(px, 40, 52, 18);
  ctx.fillStyle = CREAM; ctx.font = '800 11px "Helvetica Neue", Arial, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('TORNEIG', px + 26, 53);
  ctx.fillStyle = '#2a2d30'; ctx.font = '700 7px "Helvetica Neue", Arial, sans-serif'; ctx.fillText('DIVENDRES 19 H', px + 26, 108);
  // The door: glass in a wine frame, the shop straight through it, the OBERT sign.
  ctx.fillStyle = 'rgba(255,235,200,.35)'; ctx.fillRect(W * d0, 0, W * (d1 - d0), H);
  ctx.fillStyle = '#f4efe2'; ctx.fillRect(W * (d0 + d1) / 2 - 22, 92, 44, 16);
  ctx.fillStyle = '#2f6b45'; ctx.font = '800 11px "Helvetica Neue", Arial, sans-serif'; ctx.fillText('OBERT', W * (d0 + d1) / 2, 104);
  // Reflections of the street on the glass.
  ctx.fillStyle = 'rgba(255,255,255,.12)';
  for (let k = 0; k < 6; k++) { ctx.beginPath(); ctx.moveTo(k * 190, 0); ctx.lineTo(k * 190 + 60, 0); ctx.lineTo(k * 190 - 40, H); ctx.lineTo(k * 190 - 100, H); ctx.fill(); }
}

/** The hanging sign's face: a wine disc ringed in cream, a fan of three plain cards and the name. */
function paintDisc(ctx: CanvasRenderingContext2D) {
  ctx.clearRect(0, 0, 256, 256);
  ctx.fillStyle = WINE; ctx.beginPath(); ctx.arc(128, 128, 126, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = CREAM; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(128, 128, 114, 0, Math.PI * 2); ctx.stroke();
  for (let k = -1; k <= 1; k++) {
    ctx.save(); ctx.translate(128, 150); ctx.rotate(k * 0.35);
    ctx.fillStyle = WINE; ctx.strokeStyle = CREAM; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.roundRect(-24, -86, 48, 70, 6); ctx.fill(); ctx.stroke();
    ctx.restore();
  }
  ctx.fillStyle = CREAM; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = '700 34px Georgia, "Times New Roman", serif'; ctx.fillText('EL NUCLI', 128, 186);
}
