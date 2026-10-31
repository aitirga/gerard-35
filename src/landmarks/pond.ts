import * as pc from 'playcanvas';
import type { GeoLandmark } from '../geo';
import type { LandmarkKit } from '../landmarks';

/**
 * A park pond's dressing (the water is the place's own, `look.water`): reeds and rocks round the
 * edge, the wooden rafts the ducks climb on and, with `reflection`, the building beyond it upside
 * down on the water and trembling, the postcard of Plaça de Gaudí. `outline` is the pond's edge in
 * metres from the centre (from the map); the reflection grows towards +z, away from the facade.
 */
export const kind = 'pond';

type Reflection = { towers: [number, number][]; spire?: number; width?: number; colour?: string };

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

  // The reflection: a fan over the pond's outline (it is roughly round), painted with the facade
  // upside down, its towers reaching across the water, in strips that slide sideways like ripples.
  const xs = outline.map(o => o[0]), zs = outline.map(o => o[1]);
  const [x0, x1, z0, z1] = [Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)];
  const uv = (x: number, z: number) => [(x - x0) / (x1 - x0), (z - z0) / (z1 - z0)];
  const fan = kit.mesh(), y = 0.07;
  for (let i = 0; i < outline.length; i++) {
    const [ax, az] = outline[i], [bx, bz] = outline[(i + 1) % outline.length];
    fan.tri([0, y, 0], [ax, y, az], [bx, y, bz], [0, 1, 0], uv(0, 0), uv(ax, az), uv(bx, bz));
  }
  const texture = kit.texture(mirror(p.reflection, x0, x1, z1 - z0));
  const m = kit.mat('Reflejo en el estanque', '#ffffff', 0, 0);
  m.diffuseMap = texture; m.opacityMap = texture; m.opacityMapChannel = 'a';
  m.blendType = pc.BLEND_NORMAL; m.depthWrite = false; m.update();
  kit.add('Reflejo en el estanque', fan, m, { shadows: false });
}

/**
 * The upside-down facade: its foot along the canvas's top edge (the pond's far side), each tower a
 * taper `[x, length]` in metres reaching down, a paler spire behind them, every row nudged sideways
 * like ripples and the whole faded towards the near edge. Soft on purpose: nothing on the water may
 * read as a mark to walk to.
 */
function mirror(r: Reflection, x0: number, x1: number, depth: number) {
  const W = 512, H = 512, px = (x: number) => (x - x0) / (x1 - x0) * W, py = (m: number) => m / depth * H;
  const shape = document.createElement('canvas'); shape.width = W; shape.height = H;
  const ctx = shape.getContext('2d')!;
  const stone = r.colour ?? 'rgba(150,128,98,.42)';
  const taper = (x: number, half: number, length: number, fill: string) => {
    ctx.fillStyle = fill; ctx.beginPath();
    ctx.moveTo(px(x - half), 0); ctx.lineTo(px(x + half), 0); ctx.lineTo(px(x + half * 0.4), py(length * 0.78)); ctx.lineTo(px(x), py(length)); ctx.lineTo(px(x - half * 0.4), py(length * 0.78));
    ctx.fill();
  };
  if (r.spire) taper(0, 4.2, r.spire, 'rgba(206,196,176,.32)');
  const width = r.width ?? 40;
  ctx.fillStyle = stone; ctx.fillRect(px(-width / 2), 0, px(width / 2) - px(-width / 2), py(depth * 0.14));
  for (const [x, length] of r.towers) taper(x, 2.8, length, stone);
  const out = document.createElement('canvas'); out.width = W; out.height = H;
  const o = out.getContext('2d')!;
  for (let row = 0; row < H; row++) o.drawImage(shape, 0, row, W, 1, Math.sin(row * 0.09) * 2.2 + Math.sin(row * 0.31) * 1.2, row, W, 1);
  o.globalCompositeOperation = 'destination-in';
  const fade = o.createLinearGradient(0, 0, 0, H); fade.addColorStop(0, 'rgba(0,0,0,.95)'); fade.addColorStop(1, 'rgba(0,0,0,.2)');
  o.fillStyle = fade; o.fillRect(0, 0, W, H);
  return out;
}
