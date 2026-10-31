import * as pc from 'playcanvas';
import type { GeoLandmark } from '../geo';
import type { LandmarkKit } from '../landmarks';
import { CITY_MAP } from '../transit.ts';

/**
 * The view from a hilltop (docs/places/bunkers.md § The view): the real city below, every building
 * of the network map's model (public/maps/barcelona-buildings.bin, tools/city.py) on its ground
 * picture (streets, parks, the port and the sea), laid round the summit at its real bearing with its
 * distance compressed, ρ = foot + gap + scale · ln(1 + r / near), so the sea lands within sight and
 * near blocks stand bigger than far ones, as in the real view. Heights follow the width a building
 * gets at its distance, and the far city fades into the evening haze. Behind the sea, the sky at
 * dusk; far off on Trinitat Vella, her castle.
 *
 * It stands on the summit turned by minus the zone's `rotation_deg`, so its x is east and z south,
 * and starts where the zone's flank (`drop`) ends. Everything is unlit, baked with the game's sun.
 * params: `below_m` (the zone's drop), `map` ([x, y]: the summit in the network map's metres),
 * `map_turn_deg` (the map's turn in tools/city.py), `scale_m`, `near_m`, `gap_m` (added straight
 * ahead, where the brow hides the plain), `height` (buildings' height against their width),
 * `min_m` (narrower buildings stay in the picture), `castle_m` (how far beyond the flank her castle stands).
 */
export const kind = 'vista';

const BASE = (import.meta as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? './';
/** How far the city goes (m): past the coast, so the sea fills the view to the sky. */
const FAR = 9000;
/** The evening haze the far city fades into, and the sky behind the sea, from the horizon up. */
const HAZE = '#cdb7b1';
const SKY: [number, string][] = [[0, '#c9b2b0'], [0.1, '#e7bfaa'], [0.22, '#e9c7b4'], [0.42, '#cfd0d6'], [0.7, '#b6c8db'], [1, '#9db6d3']];
/** Façades by kind (tools/city.py `building_kind`: homes, works, civic), glass towers, and roof terraces. */
const FACADES = [
  ['#ead2ae', '#e2c39c', '#efdcbc', '#dcb48c', '#e7cfb0', '#d3ae8a', '#e9c9a0'],
  ['#d3cbbf', '#c9c4ba', '#ddd3c3'],
  ['#dd9f7c', '#d4a274', '#e2b08c'],
];
const GLASS = ['#9fb3c6', '#aab9c8'], TOWER_M = 70, ROOF = '#d6cabd';
/** Toward the game's sun in the scene (src/scenery.ts turns it 48°, -35°): walls facing it are lit. */
const SUN: [number, number] = [-0.573, 0.819];

const rgb = (hex: string) => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
const mix = (a: number[], b: number[], t: number) => a.map((v, i) => v + (b[i] - v) * t);
/** How much of the haze covers the city at `r` metres. */
const hazeAt = (r: number) => 0.85 * r / (r + 3000);

/** Unlit triangles with a colour per vertex, grown as needed. */
class Geometry {
  pos: number[] = []; col: number[] = []; uv: number[] = []; idx: number[] = [];
  vertex(x: number, y: number, z: number, c: number[], u = 0, v = 0) {
    this.pos.push(x, y, z); this.col.push(Math.min(255, c[0]), Math.min(255, c[1]), Math.min(255, c[2]), 255); this.uv.push(u, v);
    return this.pos.length / 3 - 1;
  }
  mesh(device: pc.GraphicsDevice) {
    const m = new pc.Mesh(device);
    // Unlit, but WebGPU's pipelines still want a normal for every vertex.
    m.setPositions(this.pos); m.setNormals(new Array(this.pos.length).fill(0).map((_, i) => i % 3 === 1 ? 1 : 0));
    m.setColors32(this.col); m.setUvs(0, this.uv); m.setIndices(this.idx); m.update();
    return m;
  }
}

/** Ear clipping on a ring (xs[i], zs[i]), as index triples. */
function ears(xs: number[], zs: number[], out: number[]) {
  let area = 0;
  for (let i = 0, j = xs.length - 1; i < xs.length; j = i++) area += xs[j] * zs[i] - xs[i] * zs[j];
  const ccw = area > 0, idx = xs.map((_, i) => i);
  const cross = (a: number, b: number, c: number) => (xs[b] - xs[a]) * (zs[c] - zs[a]) - (zs[b] - zs[a]) * (xs[c] - xs[a]);
  const inside = (p: number, a: number, b: number, c: number) => {
    const d1 = cross(a, b, p), d2 = cross(b, c, p), d3 = cross(c, a, p);
    return ccw ? d1 > 0 && d2 > 0 && d3 > 0 : d1 < 0 && d2 < 0 && d3 < 0;
  };
  let guard = idx.length * idx.length;
  while (idx.length > 3 && guard-- > 0) {
    let clipped = false;
    for (let k = 0; k < idx.length; k++) {
      const a = idx[(k + idx.length - 1) % idx.length], b = idx[k], c = idx[(k + 1) % idx.length];
      const turn = cross(a, b, c);
      if (ccw ? turn <= 0 : turn >= 0) continue;
      if (idx.some(j => j !== a && j !== b && j !== c && inside(j, a, b, c))) continue;
      out.push(a, b, c); idx.splice(k, 1); clipped = true; break;
    }
    if (!clipped) break;
  }
  for (let k = 1; k + 1 < idx.length; k++) out.push(idx[0], idx[k], idx[k + 1]);
  return area;
}

export function build(kit: LandmarkKit, landmark: GeoLandmark) {
  const p = landmark.params, num = (v: unknown, d: number) => typeof v === 'number' ? v : d;
  const below = num(p.below_m, 28), scale = num(p.scale_m, 8), near = num(p.near_m, 300), gapM = num(p.gap_m, 10);
  const tall = num(p.height, 0.6), minW = num(p.min_m, 0.3), castleM = num(p.castle_m, 30);
  const [mx, my] = (p.map as number[] | undefined) ?? [0, 0], turn = num(p.map_turn_deg, 0) * Math.PI / 180;
  const ca = Math.cos(landmark.angle * Math.PI / 180), sa = Math.sin(landmark.angle * Math.PI / 180);
  /** A direction in the scene's grid, in this landmark's frame (x east, z south). */
  const local = (gx: number, gz: number) => [gx * ca - gz * sa, gx * sa + gz * ca];
  const ahead = local(-Math.SQRT1_2, -Math.SQRT1_2), sun = local(SUN[0], SUN[1]);

  // Where the flank ends in every direction (one per degree of bearing): the farthest crossing of
  // the brow, plus the flank's run; straight ahead the plain starts further, under the brow's shadow.
  const drop = kit.scene.drop;
  const edge = (drop?.edge ?? []).map(([px, pz]) => local((px - landmark.x) * kit.cell, (pz - landmark.z) * kit.cell));
  const run = (drop?.run ?? 0) * kit.cell;
  const start = Array.from({ length: 360 }, (_, deg) => {
    const dx = Math.sin(deg * Math.PI / 180), dz = -Math.cos(deg * Math.PI / 180);
    let far = 0;
    for (let i = 0; i < edge.length; i++) {
      const [px, pz] = edge[i], [qx, qz] = edge[(i + 1) % edge.length], sx = qx - px, sz = qz - pz;
      const denom = dx * sz - dz * sx;
      if (Math.abs(denom) < 1e-9) continue;
      const t = (px * sz - pz * sx) / denom, u = (px * dz - pz * dx) / denom;
      if (u >= 0 && u <= 1 && t > far) far = t;
    }
    const facing = Math.max(0, dx * ahead[0] + dz * ahead[1]);
    return { foot: far + run, base: far + run + gapM * facing * facing };
  });
  const at = (bearing: number) => {
    const d = ((bearing * 180 / Math.PI) % 360 + 360) % 360, i = Math.floor(d), f = d - i;
    const a = start[i], b = start[(i + 1) % 360];
    return { foot: a.foot + (b.foot - a.foot) * f, base: a.base + (b.base - a.base) * f };
  };
  /** Network-map metres → east/north of the summit, and back. */
  const fromMap = (x: number, y: number) => { const dx = x - mx, dy = y - my; return [dx * Math.cos(turn) - dy * Math.sin(turn), -dx * Math.sin(turn) - dy * Math.cos(turn)]; };
  const toMap = (east: number, north: number) => [mx + east * Math.cos(turn) - north * Math.sin(turn), my - (east * Math.sin(turn) + north * Math.cos(turn))];
  /** Where a real point lies in the view: [x, z] in this frame, its compressed distance and how much wider it stands than real. */
  const place = (east: number, north: number) => {
    const r = Math.hypot(east, north), bearing = Math.atan2(east, north), rho = at(bearing).base + scale * Math.log(1 + r / near);
    return { x: rho * Math.sin(bearing), z: -rho * Math.cos(bearing), rho, r, wide: rho / Math.max(r, 1) };
  };

  const device = kit.app.graphicsDevice, y0 = -below;
  const unlit = (name: string, colour = '#ffffff') => {
    const m = kit.mat(name, colour, 0);
    m.useLighting = false; m.diffuse.set(0, 0, 0); m.emissive.fromString(colour); m.cull = pc.CULLFACE_NONE; m.update();
    return m;
  };
  const add = (name: string, g: Geometry, material: pc.Material) => {
    if (!g.idx.length || !kit.root.parent) return;
    const e = new pc.Entity(name);
    e.addComponent('render', { meshInstances: [new pc.MeshInstance(g.mesh(device), material)], castShadows: false, receiveShadows: false });
    kit.root.addChild(e);
  };

  // ------------------------------------------------ the haze far round, and the sky behind the sea
  const haze = new Geometry(), hz = rgb(HAZE);
  for (const [x, z] of [[-900, -900], [900, -900], [900, 900], [-900, 900]]) haze.vertex(x, y0 - 0.06, z, hz);
  haze.idx.push(0, 1, 2, 0, 2, 3);
  const hazeMat = unlit('Bruma lejana'); hazeMat.emissiveVertexColor = true; hazeMat.update();
  add('Bruma lejana', haze, hazeMat);
  let farAhead = 0;
  for (let d = -40; d <= 40; d += 5) {
    const b = Math.atan2(ahead[0], -ahead[1]) + d * Math.PI / 180;
    farAhead = Math.max(farAhead, at(b).base + scale * Math.log(1 + FAR / near));
  }
  // A card square to the camera, its foot on the horizon beyond the sea: the camera looks along the grid's (−1, −1) 42.6° down.
  const sky = document.createElement('canvas'); sky.width = 4; sky.height = 256;
  const sctx = sky.getContext('2d')!, grad = sctx.createLinearGradient(0, 256, 0, 0);
  for (const [t, c] of SKY) grad.addColorStop(t, c);
  sctx.fillStyle = grad; sctx.fillRect(0, 0, 4, 256);
  const skyMat = unlit('Cielo del atardecer'); skyMat.emissiveMap = kit.texture(sky); skyMat.update();
  const cos = Math.cos(42.6 * Math.PI / 180), sin = Math.sin(42.6 * Math.PI / 180);
  const right = [-ahead[1], ahead[0]], up = [ahead[0] * sin, cos, ahead[1] * sin];
  const foot = [ahead[0] * (farAhead + 4), y0, ahead[1] * (farAhead + 4)], W = 700, H = 160;
  const card = new Geometry(), white = [255, 255, 255];
  for (const [s, t] of [[-1, 0], [1, 0], [1, 1], [-1, 1]]) {
    card.vertex(foot[0] + right[0] * s * W / 2 + up[0] * t * H, foot[1] + up[1] * t * H, foot[2] + right[1] * s * W / 2 + up[2] * t * H, white, 0.5, t);
  }
  card.idx.push(0, 1, 2, 0, 2, 3);
  add('Cielo', card, skyMat);

  // ------------------------------------------------ the ground: the map's picture, warped round the hill
  const bg = CITY_MAP.background!;
  const ground = new Geometry(), RINGS = 64;
  const uvOf = (east: number, north: number) => { const [x, y] = toMap(east, north); return [(x - bg.x0) / (bg.x1 - bg.x0), (y - bg.y0) / (bg.y1 - bg.y0)]; };
  for (let deg = 0; deg <= 360; deg++) {
    const b = deg * Math.PI / 180, s = at(b), dx = Math.sin(b), dz = -Math.cos(b);
    for (let k = 0; k <= RINGS; k++) {
      // Ring 0 is the flank's foot; then the real distance grows geometrically out to FAR.
      const r = k === 0 ? 0 : near * ((1 + FAR / near) ** ((k - 1) / (RINGS - 1)) - 1);
      const rho = k === 0 ? s.foot : s.base + scale * Math.log(1 + r / near);
      const [u, v] = uvOf(r * dx, r * -dz);
      ground.vertex(rho * dx, y0, rho * dz, white, u, v);
      if (deg && k) { const i = deg * (RINGS + 1) + k, j = i - (RINGS + 1); ground.idx.push(j - 1, j, i, j - 1, i, i - 1); }
    }
  }
  // Haze until the picture arrives.
  const groundMat = unlit('Suelo de la ciudad', HAZE);
  add('Ciudad (suelo)', ground, groundMat);
  void cityPicture(bg, (mx - bg.x0) / (bg.x1 - bg.x0), (my - bg.y0) / (bg.y1 - bg.y0)).then(c => {
    if (!c || !kit.root.parent) return;
    const t = kit.texture(c);
    t.addressU = t.addressV = pc.ADDRESS_CLAMP_TO_EDGE;
    groundMat.emissiveMap = t; groundMat.emissive.set(1, 1, 1); groundMat.update();
  });

  // ------------------------------------------------ the buildings
  const href = (CITY_MAP as { buildings?: { href: string } }).buildings?.href;
  if (href) void fetch(`${BASE}${href}`).then(r => r.ok ? r.arrayBuffer() : Promise.reject(new Error(r.statusText))).then(buffer => {
    if (!kit.root.parent) return;
    const data = new Int16Array(buffer), city = new Geometry(), xs: number[] = [], zs: number[] = [], roof: number[] = [];
    const sunlit = mix(white, rgb('#ffd29a'), 1), shade = rgb('#a99aaf');
    for (let o = 0, n = 0; o < data.length; o += 3 + data[o + 2] * 2, n++) {
      const height = data[o], kindOf = data[o + 1], count = data[o + 2];
      let cx = 0, cy = 0, area = 0;
      for (let i = 0; i < count; i++) { cx += data[o + 3 + i * 2]; cy += data[o + 4 + i * 2]; }
      for (let i = 0, j = count - 1; i < count; j = i++) area += data[o + 3 + j * 2] * data[o + 4 + i * 2] - data[o + 3 + i * 2] * data[o + 4 + j * 2];
      const [ce, cn] = fromMap(cx / count, cy / count), centre = place(ce, cn);
      // The hill and its foot are the zone's own; tiny buildings far off are left to the picture.
      if (centre.r < 150 || centre.r > FAR || Math.sqrt(Math.abs(area) / 2) * centre.wide < minW) continue;
      xs.length = zs.length = roof.length = 0;
      for (let i = 0; i < count; i++) {
        const [e, nn] = fromMap(data[o + 3 + i * 2], data[o + 4 + i * 2]), q = place(e, nn);
        xs.push(q.x); zs.push(q.z);
      }
      const h = height * tall * centre.wide, top = y0 + h;
      const palette = height >= TOWER_M ? GLASS : FACADES[kindOf] ?? FACADES[0];
      const fog = hazeAt(centre.r);
      const base = mix(rgb(palette[(n * 2654435761 >>> 0) % palette.length]), hz, fog);
      const lid = mix(mix(base, rgb(ROOF), 0.45), hz, fog * 0.6);
      const turnSign = ears(xs, zs, roof) > 0 ? 1 : -1;
      // Walls: only those the camera can see, lit gold on the sun's side and lilac in the shade.
      for (let i = 0; i < count; i++) {
        const j = (i + 1) % count, ex = xs[j] - xs[i], ez = zs[j] - zs[i], len = Math.hypot(ex, ez) || 1;
        const nx = ez / len * turnSign, nz = -ex / len * turnSign;
        if (nx * -ahead[0] + nz * -ahead[1] < -0.2) continue;
        const lit = Math.max(0, nx * sun[0] + nz * sun[1]);
        const c = mix(mix(base.map(v => v * 0.72), shade, 0.18 * (1 - fog)), base.map((v, k) => v * sunlit[k] / 255), lit);
        const foot = c.map(v => v * 0.82);
        const a = city.vertex(xs[i], y0, zs[i], foot), b = city.vertex(xs[j], y0, zs[j], foot);
        const t1 = city.vertex(xs[j], top, zs[j], c), t0 = city.vertex(xs[i], top, zs[i], c);
        city.idx.push(a, b, t1, a, t1, t0);
      }
      const first = city.pos.length / 3;
      for (let i = 0; i < count; i++) city.vertex(xs[i], top, zs[i], lid);
      for (const k of roof) city.idx.push(first + k);
    }
    const m = unlit('Ciudad (edificios)'); m.emissiveVertexColor = true; m.update();
    add('Ciudad (edificios)', city, m);
  }).catch(error => console.warn('Sin edificios para la vista', error));

  // ------------------------------------------------ her castle, far off on Trinitat Vella
  const school = CITY_MAP.places.find(pl => pl.id === 'rec-comtal');
  if (school) {
    const [e, n] = fromMap(school.x, school.y), real = place(e, n), bearing = Math.atan2(e, n);
    const rho = Math.min(real.rho, at(bearing).base + castleM);
    castle(kit, [rho * Math.sin(bearing), y0, -rho * Math.cos(bearing)]);
  }
}

/**
 * The map's picture of the city at dusk: warmed, a little greyed, and hazier the farther it lies
 * from the summit (at `sx`, `sy`, 0–1 across it), as the real view is.
 */
async function cityPicture(bg: { x0: number; x1: number; y0: number; y1: number; href: string }, sx: number, sy: number) {
  const image = new Image();
  image.src = `${BASE}${bg.href}`;
  try { await image.decode(); } catch { console.warn('Sin plano para la vista'); return undefined; }
  const c = document.createElement('canvas'), w = 3072, h = Math.round(w * image.height / image.width);
  c.width = w; c.height = h;
  const ctx = c.getContext('2d')!;
  ctx.drawImage(image, 0, 0, w, h);
  ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = '#d9bca6'; ctx.fillRect(0, 0, w, h);
  ctx.globalCompositeOperation = 'saturation'; ctx.fillStyle = 'rgba(128,128,128,.4)'; ctx.fillRect(0, 0, w, h);
  ctx.globalCompositeOperation = 'source-over';
  const perM = w / (bg.x1 - bg.x0), haze = ctx.createRadialGradient(sx * w, sy * h, 0, sx * w, sy * h, FAR * perM);
  const [r, g, b] = rgb(HAZE);
  for (const d of [0, 500, 1000, 2000, 3000, 4500, 6000, FAR]) haze.addColorStop(d / FAR, `rgba(${r},${g},${b},${hazeAt(d).toFixed(3)})`);
  ctx.fillStyle = haze; ctx.fillRect(0, 0, w, h);
  return c;
}

/**
 * Her castle seen from afar: a pink body under a dome and a crown of thin spires, each tipped with
 * a glowing bead (src/palace.ts is the real one; this is its silhouette, a few metres high).
 */
function castle(kit: LandmarkKit, [x, y, z]: number[]) {
  const gum = kit.mat('Castillo lejano', '#d9579a', 0.45), dark = kit.mat('Castillo lejano en sombra', '#a8467c', 0.35);
  const glow = kit.mat('Cuentas del castillo', '#ff7fbf', 0.3, 2.4);
  kit.part('Cuerpo del castillo', 'box', dark, [x, y + 1.1, z], [5.2, 2.2, 3.6]);
  kit.part('Cúpula del castillo', 'sphere', gum, [x + 0.4, y + 2.6, z], [2.6, 2.4, 2.6]);
  const spires: number[][] = [[-2.1, -1.2, 5.4], [-1.2, 1.1, 6.6], [0.1, -1.4, 7.8], [1.3, 1.2, 6], [2.2, -0.6, 5], [-0.6, 0.2, 8.6], [1.9, 0.9, 4.4]];
  for (const [dx, dz, h] of spires) {
    kit.part('Aguja del castillo', 'cylinder', gum, [x + dx, y + h / 2, z + dz], [0.42, h, 0.42]);
    kit.part('Tejado de aguja', 'cone', dark, [x + dx, y + h + 0.45, z + dz], [0.62, 0.9, 0.62]);
    kit.part('Cuenta del castillo', 'sphere', glow, [x + dx, y + h + 1.05, z + dz], [0.34, 0.34, 0.34]);
  }
}
