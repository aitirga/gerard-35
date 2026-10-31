import * as pc from 'playcanvas';
import type { GeoLandmark } from '../geo';
import type { LandmarkKit } from '../landmarks';

/**
 * A park pond's dressing (the water is the place's own, `look.water`): reeds and rocks round the
 * edge, the wooden rafts the ducks climb on and, with `reflection`, the building beyond it upside
 * down on the water and trembling, the postcard of Plaça de Gaudí. `outline` is the pond's edge in
 * metres from the centre (from the map).
 *
 * The camera looks from the south-east of the grid, so a reflection hangs straight down the screen,
 * along +x +z: the painting is laid in the screen's frame, its top on the far shore. `towers` are
 * `[across, length]` in metres, `across` to the screen's right of the pond's centre.
 */
export const kind = 'pond';

type Reflection = { towers: [number, number][]; spires?: [number, number][]; width?: number; across?: number };

export function build(kit: LandmarkKit, landmark: GeoLandmark) {
  const p = landmark.params as { outline?: [number, number][]; reflection?: Reflection; rafts?: [number, number][] };
  const outline = p.outline ?? [];
  if (outline.length < 3) return;
  let seed = 4242;
  const random = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  const reeds = [kit.mat('Carrizo', '#8f9a4a', 0.15), kit.mat('Carrizo seco', '#b3a865', 0.15), kit.mat('Carrizo oscuro', '#5f6b34', 0.15)];
  const rock = kit.mat('Roca del estanque', '#6f6a5e', 0.15);
  outline.forEach(([x, z], i) => {
    // Every vertex of the edge, a step towards the middle: reeds on most, a rock on some.
    const l = Math.hypot(x, z) || 1, ix = x - x / l * 1.6, iz = z - z / l * 1.6;
    if (i % 3 === 2) { kit.part('Roca', 'sphere', rock, [x - x / l * 0.6, 0.1, z - z / l * 0.6], [1.4 + random(), 0.45, 1.1 + random()], [0, random() * 180, 0]); return; }
    for (let k = 0; k < 6; k++) {
      const a = random() * Math.PI * 2, r = random() * 1.1, h = 1.1 + random() * 0.9;
      kit.part('Carrizo', 'box', reeds[k % 3], [ix + Math.cos(a) * r, h / 2, iz + Math.sin(a) * r], [0.06, h, 0.06], [(random() - 0.5) * 24, random() * 180, (random() - 0.5) * 24]);
    }
  });
  for (const [x, z] of p.rafts ?? []) kit.part('Balsa de los patos', 'box', kit.mat('Tablones de la balsa', '#7a6448', 0.15), [x, 0.14, z], [3.2, 0.16, 1.8], [0, random() * 40 - 20, 0]);
  if (!p.reflection) return;

  // The reflection: a fan over the pond's outline (it is roughly round), painted in the screen's
  // frame (`across` to the right, `down` towards the camera) so the towers hang straight down.
  const across = (x: number, z: number) => (x - z) * Math.SQRT1_2, down = (x: number, z: number) => (x + z) * Math.SQRT1_2;
  const as = outline.map(o => across(...o)), ds = outline.map(o => down(...o));
  const [a0, a1, d0, d1] = [Math.min(...as), Math.max(...as), Math.min(...ds), Math.max(...ds)];
  const uv = (x: number, z: number) => [(across(x, z) - a0) / (a1 - a0), (down(x, z) - d0) / (d1 - d0)];
  const fan = kit.mesh(), y = 0.07;
  for (let i = 0; i < outline.length; i++) {
    const [ax, az] = outline[i], [bx, bz] = outline[(i + 1) % outline.length];
    fan.tri([0, y, 0], [ax, y, az], [bx, y, bz], [0, 1, 0], uv(0, 0), uv(ax, az), uv(bx, bz));
  }
  const texture = kit.texture(mirror(p.reflection, a0, a1, d1 - d0));
  const m = kit.mat('Reflejo en el estanque', '#ffffff', 0, 0);
  m.diffuseMap = texture; m.opacityMap = texture; m.opacityMapChannel = 'a';
  m.blendType = pc.BLEND_NORMAL; m.depthWrite = false; m.update();
  kit.add('Reflejo en el estanque', fan, m, { shadows: false });
}

/**
 * The upside-down facade in the screen's frame: its foot along the canvas's top edge (the far
 * shore), the dark old stone with its four bell towers reaching down and their mosaic tips, the
 * pale high towers longer and fainter behind them with the white cross at the end of the longest,
 * the pines' dark crowns on the shore, every row nudged sideways like ripples, and the whole faded
 * towards the near shore. Soft on purpose: nothing on the water may read as a mark to walk to.
 */
function mirror(r: Reflection, a0: number, a1: number, depth: number) {
  const W = 512, H = 512, centre = r.across ?? 0;
  const px = (a: number) => (centre + a - a0) / (a1 - a0) * W, py = (m: number) => m / depth * H;
  const shape = document.createElement('canvas'); shape.width = W; shape.height = H;
  const ctx = shape.getContext('2d')!;
  const taper = (a: number, half: number, length: number, fill: string) => {
    ctx.fillStyle = fill; ctx.beginPath();
    ctx.moveTo(px(a - half), 0); ctx.lineTo(px(a + half), 0);
    ctx.quadraticCurveTo(px(a + half * 0.9), py(length * 0.6), px(a + half * 0.25), py(length * 0.9));
    ctx.lineTo(px(a), py(length)); ctx.lineTo(px(a - half * 0.25), py(length * 0.9));
    ctx.quadraticCurveTo(px(a - half * 0.9), py(length * 0.6), px(a - half), 0);
    ctx.fill();
  };
  // The high towers first, pale and faint, then the old front over them.
  for (const [a, length] of r.spires ?? []) taper(a, 3.4, length, 'rgba(214,204,184,.22)');
  const longest = (r.spires ?? []).reduce((best, s) => s[1] > best[1] ? s : best, [0, 0]);
  if (longest[1]) {
    ctx.fillStyle = 'rgba(246,242,232,.6)';
    ctx.fillRect(px(longest[0] - 0.4), py(longest[1]), px(0.8) - px(0), py(4));
    ctx.fillRect(px(longest[0] - 1.6), py(longest[1] + 1.2), px(3.2) - px(0), py(0.8));
  }
  const width = r.width ?? 40, stone = 'rgba(122,102,78,.34)';
  ctx.fillStyle = stone; ctx.fillRect(px(-width / 2), 0, px(width) - px(0), py(5));
  for (const [a, length] of r.towers) {
    taper(a, 2.4, length, stone);
    ctx.fillStyle = 'rgba(176,84,58,.4)'; ctx.beginPath(); ctx.arc(px(a), py(length - 0.5), px(0.6) - px(0), 0, Math.PI * 2); ctx.fill();
  }
  // The shore's pines and reeds, dark and close.
  for (let k = 0; k < 9; k++) {
    const a = -width * 0.9 + k * width * 0.24;
    ctx.fillStyle = 'rgba(48,58,30,.4)'; ctx.beginPath(); ctx.ellipse(px(a), py(1.5), px(3.2) - px(0), py(2.2 + (k % 3)), 0, 0, Math.PI * 2); ctx.fill();
  }
  // Water never gives a sharp image: soften it, then shake every row sideways like ripples.
  const soft = document.createElement('canvas'); soft.width = W; soft.height = H;
  const sctx = soft.getContext('2d')!; sctx.filter = 'blur(4px)'; sctx.drawImage(shape, 0, 0);
  const out = document.createElement('canvas'); out.width = W; out.height = H;
  const o = out.getContext('2d')!;
  for (let row = 0; row < H; row++) o.drawImage(soft, 0, row, W, 1, Math.sin(row * 0.09) * 2.4 + Math.sin(row * 0.31) * 1.4, row, W, 1);
  // Ripples: short glints of sky breaking the image, never in a regular row.
  let seed = 77;
  const random = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  for (let k = 0; k < 90; k++) {
    o.fillStyle = `rgba(232,238,234,${0.05 + random() * 0.08})`;
    o.fillRect(random() * W, random() * H, 20 + random() * 90, 1 + Math.round(random()));
  }
  o.globalCompositeOperation = 'destination-in';
  const fade = o.createLinearGradient(0, 0, 0, H); fade.addColorStop(0, 'rgba(0,0,0,.95)'); fade.addColorStop(0.7, 'rgba(0,0,0,.45)'); fade.addColorStop(1, 'rgba(0,0,0,.1)');
  o.fillStyle = fade; o.fillRect(0, 0, W, H);
  return out;
}
