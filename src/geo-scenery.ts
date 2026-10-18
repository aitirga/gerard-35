import * as pc from 'playcanvas';
import type { GeoBuilding, GeoPoint, GeoScene } from './geo';

/** What `buildScenery` lends a generated place, so everything is tracked and destroyed with the scene. */
export interface GeoKit {
  app: pc.Application;
  root: pc.Entity;
  batch: number;
  mat: (name: string, hex: string, gloss?: number, glow?: number) => pc.StandardMaterial;
  texture: (canvas: HTMLCanvasElement) => pc.Texture;
  label: (text: string, px: number, y: number, pz: number, width?: number) => pc.Entity;
  water: pc.StandardMaterial;
  /** Grid → scene coordinates. */
  x: (px: number) => number;
  z: (pz: number) => number;
}

/** One facade bay is this wide in cells; textures repeat once per bay and storey. */
const BAY = 1.8;
const EAVE = 0.35;
const ROOF_PITCH = Math.tan(30 * Math.PI / 180);
/** Ground layers stack a hair apart so large flat polygons never z-fight. */
const LAYER = { ground: 0.004, grass: 0.012, forest: 0.016, square: 0.02, water: 0.028, path: 0.036, road: 0.042, rail: 0.046, bridge: 0.07 };
const FOLD_RATE = 12;
const FOLDED = 0.05;
/** Extra room around Gerard's silhouette before a building folds. */
const CUT_MARGIN = 1;

type V3 = [number, number, number];
interface Fold { pivot: pc.Entity; poly: GeoPoint[]; min: pc.Vec3; max: pc.Vec3; t: number }

/** Collects triangles with flat normals; every face is wound so its normal agrees with `facing`. */
class MeshBuilder {
  positions: number[] = []; normals: number[] = []; uvs: number[] = []; indices: number[] = [];
  tri(a: V3, b: V3, c: V3, facing: V3, ua: number[] = [0, 0], ub: number[] = [0, 0], uc: number[] = [0, 0]) {
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    let n: V3 = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    const len = Math.hypot(...n) || 1;
    n = [n[0] / len, n[1] / len, n[2] / len];
    if (n[0] * facing[0] + n[1] * facing[1] + n[2] * facing[2] < 0) { [b, c] = [c, b]; [ub, uc] = [uc, ub]; n = [-n[0], -n[1], -n[2]]; }
    const base = this.positions.length / 3;
    for (const [p, t] of [[a, ua], [b, ub], [c, uc]] as const) { this.positions.push(...p); this.normals.push(...n); this.uvs.push(...t); }
    this.indices.push(base, base + 1, base + 2);
  }
  quad(a: V3, b: V3, c: V3, d: V3, facing: V3, ua: number[], ub: number[], uc: number[], ud: number[]) {
    this.tri(a, b, c, facing, ua, ub, uc); this.tri(a, c, d, facing, ua, uc, ud);
  }
  mesh(device: pc.GraphicsDevice) {
    const m = new pc.Mesh(device);
    m.setPositions(this.positions); m.setNormals(this.normals); m.setUvs(0, this.uvs); m.setIndices(this.indices); m.update();
    return m;
  }
  get empty() { return this.indices.length === 0; }
}

function inside(px: number, pz: number, poly: GeoPoint[]) {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [x1, z1] = poly[i], [x2, z2] = poly[j];
    if ((z1 > pz) !== (z2 > pz) && px < (x2 - x1) * (pz - z1) / (z2 - z1) + x1) hit = !hit;
  }
  return hit;
}
function signedArea(poly: GeoPoint[]) {
  let a = 0;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) a += poly[j][0] * poly[i][1] - poly[i][0] * poly[j][1];
  return a / 2;
}
/** Ear clipping for simple polygons, as triangles of vertex indices. */
function triangulate(poly: GeoPoint[]): [number, number, number][] {
  const ccw = signedArea(poly) > 0;
  const idx = poly.map((_, i) => i);
  const out: [number, number, number][] = [];
  const cross = (a: GeoPoint, b: GeoPoint, c: GeoPoint) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  let guard = poly.length * poly.length;
  while (idx.length > 3 && guard-- > 0) {
    let clipped = false;
    for (let k = 0; k < idx.length; k++) {
      const i0 = idx[(k + idx.length - 1) % idx.length], i1 = idx[k], i2 = idx[(k + 1) % idx.length];
      const turn = cross(poly[i0], poly[i1], poly[i2]);
      if (ccw ? turn <= 0 : turn >= 0) continue;
      const tri = [poly[i0], poly[i1], poly[i2]];
      if (idx.some(j => j !== i0 && j !== i1 && j !== i2 && inside(poly[j][0], poly[j][1], tri))) continue;
      out.push([i0, i1, i2]); idx.splice(k, 1); clipped = true; break;
    }
    if (!clipped) break; // Self-touching rings: fan the rest rather than lose the area.
  }
  for (let k = 1; k + 1 < idx.length; k++) out.push([idx[0], idx[k], idx[k + 1]]);
  return out;
}

/**
 * Builds a place generated from map data: ground layers, roads and rails, a river, and every
 * building extruded from its real footprint with a hipped roof and painted facades. Buildings
 * between Gerard and the camera fold down to their footprint, like walls in the houses.
 */
export function buildGeo(kit: GeoKit, scene: GeoScene) {
  const { app, root, mat, x, z } = kit;
  const device = app.graphicsDevice;
  const meshes: pc.Mesh[] = [];
  const folds: Fold[] = [];
  const jitter = (i: number) => { const v = Math.sin(i * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };
  const P = (p: GeoPoint, y: number): V3 => [x(p[0]), y, z(p[1])];
  function add(name: string, builder: MeshBuilder, m: pc.Material, parent = root, batched = true, shadows = true) {
    if (builder.empty) return;
    const mesh = builder.mesh(device); meshes.push(mesh);
    const e = new pc.Entity(name);
    e.addComponent('render', { meshInstances: [new pc.MeshInstance(mesh, m)], castShadows: shadows, receiveShadows: true, ...(batched ? { batchGroupId: kit.batch } : {}) });
    parent.addChild(e); return e;
  }
  function textured(name: string, c: HTMLCanvasElement, gloss = 0.12) {
    const m = mat(name, '#ffffff', gloss); m.diffuseMap = kit.texture(c); m.update(); return m;
  }
  function canvas(w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void) {
    const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d')!); return c;
  }

  // ------------------------------------------------------------ ground
  const W = scene.width, D = scene.depth;
  function flat(name: string, polys: GeoPoint[][], y: number, m: pc.Material, uvScale = 0.25) {
    const b = new MeshBuilder();
    for (const poly of polys) for (const [i, j, k] of triangulate(poly)) {
      const uv = (p: GeoPoint) => [p[0] * uvScale, p[1] * uvScale];
      b.tri(P(poly[i], y), P(poly[j], y), P(poly[k], y), [0, 1, 0], uv(poly[i]), uv(poly[j]), uv(poly[k]));
    }
    const e = add(name, b, m, root, true, false);
    return e;
  }
  function speckled(name: string, base: string, specks: string[], size = 128, count = 900) {
    return textured(name, canvas(size, size, ctx => {
      ctx.fillStyle = base; ctx.fillRect(0, 0, size, size);
      for (let i = 0; i < count; i++) { ctx.fillStyle = specks[i % specks.length]; ctx.fillRect(jitter(i) * size, jitter(i + 7e3) * size, 2, 2); }
    }), 0.05);
  }
  const groundMat = speckled('Suelo urbano', '#cbc2ab', ['#bfb59c', '#d6cdb8', '#b8ad94']);
  flat('Suelo', [[[-0.5, -0.5], [W - 0.5, -0.5], [W - 0.5, D - 0.5], [-0.5, D - 0.5]]], LAYER.ground, groundMat);
  flat('Huertas y jardines', scene.areas.grass, LAYER.grass, speckled('Hierba', '#86a462', ['#7a9858', '#95b36d', '#6f8c4f']));
  flat('Bosque', scene.areas.forest, LAYER.forest, speckled('Sotobosque', '#4f6d42', ['#45603a', '#5c7b4b', '#3d5634']));
  const plaza = textured('Losas de la plaza', canvas(128, 128, ctx => {
    ctx.fillStyle = '#a99d88'; ctx.fillRect(0, 0, 128, 128);
    for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) {
      ctx.fillStyle = `hsl(${30 + jitter(r * 4 + k) * 8}, 18%, ${68 + jitter(r * 9 + k) * 8}%)`;
      ctx.fillRect(k * 32 + 1, r * 32 + 1, 30, 30);
    }
  }), 0.1);
  flat('Plazas', scene.areas.square, LAYER.square, plaza, 0.5);
  // Rivers reuse the pool's caustics, tinted deep green and drifting downstream.
  const river = mat('Río', '#7f9f8c', 0.85);
  river.diffuseMap = kit.water.diffuseMap; river.emissive.fromString('#6f9a86'); river.emissiveMap = kit.water.diffuseMap; river.emissiveIntensity = 0.08;
  river.update();
  flat('Río', scene.areas.water, LAYER.water, river, 0.08);
  let time = 0;

  // ------------------------------------------------------------ roads, paths, rails, bridges
  const asphalt = speckled('Asfalto', '#66625e', ['#5b5854', '#726e69', '#7c7771']);
  const bikeway = speckled('Bidegorri', '#8a6b5f', ['#7e6156', '#957568']);
  const footway = speckled('Senda', '#b7a888', ['#a99a7b', '#c3b596']);
  const ballast = speckled('Balasto', '#857b6f', ['#6f665b', '#9a9083', '#5f574e']);
  const bridgeStone = mat('Piedra del puente', '#b3a68d', 0.1);
  const steel = mat('Carriles', '#5a5652', 0.6), sleeper = mat('Traviesas', '#6b5a48', 0.1);
  const barrier = mat('Bionda', '#c9c6bd', 0.4);
  function ribbon(builder: MeshBuilder, line: GeoPoint[], half: number, y: number) {
    for (let i = 0; i + 1 < line.length; i++) {
      const [a, b] = [line[i], line[i + 1]];
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]); if (len < 1e-3) continue;
      const nx = -(b[1] - a[1]) / len * half, nz = (b[0] - a[0]) / len * half;
      // Each segment runs a little past its ends so joints have no gaps.
      const ex = (b[0] - a[0]) / len * half * 0.6, ez = (b[1] - a[1]) / len * half * 0.6;
      const s0 = [a[0] - ex, a[1] - ez], s1 = [b[0] + ex, b[1] + ez];
      builder.quad(P([s0[0] + nx, s0[1] + nz], y), P([s1[0] + nx, s1[1] + nz], y), P([s1[0] - nx, s1[1] - nz], y), P([s0[0] - nx, s0[1] - nz], y),
        [0, 1, 0], [0, 0], [len / 2, 0], [len / 2, 1], [0, 1]);
    }
  }
  /** Thin walls along both edges of a line: bridge parapets, rails, crash barriers. */
  function edges(name: string, line: GeoPoint[], offset: number, h: number, thick: number, y: number, m: pc.Material) {
    for (let i = 0; i + 1 < line.length; i++) {
      const [a, b] = [line[i], line[i + 1]];
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]); if (len < 1e-3) continue;
      const yaw = -Math.atan2(b[1] - a[1], b[0] - a[0]) * 180 / Math.PI;
      for (const side of [-1, 1]) {
        const nx = -(b[1] - a[1]) / len * offset * side, nz = (b[0] - a[0]) / len * offset * side;
        const e = new pc.Entity(name);
        e.addComponent('render', { type: 'box', material: m, castShadows: true, receiveShadows: true, batchGroupId: kit.batch });
        e.setPosition(x((a[0] + b[0]) / 2 + nx), y + h / 2, z((a[1] + b[1]) / 2 + nz)); e.setEulerAngles(0, yaw, 0); e.setLocalScale(len, h, thick);
        root.addChild(e);
      }
    }
  }
  const layers = { road: new MeshBuilder(), bike: new MeshBuilder(), foot: new MeshBuilder(), rail: new MeshBuilder(), motorway: new MeshBuilder(), bridge: new MeshBuilder() };
  for (const road of scene.roads) {
    const half = Math.max(road.width / 2, 0.75);
    if (road.kind === 'rail') {
      ribbon(layers.rail, road.line, half, LAYER.rail);
      edges('Carril', road.line, 0.6, 0.12, 0.08, LAYER.rail, steel);
      for (let i = 0; i + 1 < road.line.length; i++) {
        const [a, b] = [road.line[i], road.line[i + 1]], len = Math.hypot(b[0] - a[0], b[1] - a[1]);
        const yaw = -Math.atan2(b[1] - a[1], b[0] - a[0]) * 180 / Math.PI;
        for (let t = 0.4; t < len; t += 0.8) {
          const e = new pc.Entity('Traviesa');
          e.addComponent('render', { type: 'box', material: sleeper, castShadows: false, receiveShadows: true, batchGroupId: kit.batch });
          e.setPosition(x(a[0] + (b[0] - a[0]) * t / len), LAYER.rail + 0.03, z(a[1] + (b[1] - a[1]) * t / len)); e.setEulerAngles(0, yaw, 0); e.setLocalScale(0.25, 0.05, 1.7);
          root.addChild(e);
        }
      }
    } else if (road.kind === 'motorway') {
      ribbon(layers.motorway, road.line, half, LAYER.road);
      edges('Bionda', road.line, half - 0.1, 0.45, 0.12, LAYER.road, barrier);
    } else if (road.kind === 'bridge') {
      ribbon(layers.bridge, road.line, half, LAYER.bridge);
      edges('Pretil', road.line, half + 0.12, 0.55, 0.28, 0, bridgeStone);
    } else if (road.kind === 'path') ribbon(road.highway === 'cycleway' ? layers.bike : layers.foot, road.line, half, LAYER.path);
    else ribbon(layers.road, road.line, half, LAYER.road);
  }
  add('Calles', layers.road, asphalt, root, true, false);
  add('Autovía', layers.motorway, asphalt, root, true, false);
  add('Bidegorri', layers.bike, bikeway, root, true, false);
  add('Sendas', layers.foot, footway, root, true, false);
  add('Vía del tren', layers.rail, ballast, root, true, false);
  add('Puente', layers.bridge, bridgeStone, root, true, false);

  // ------------------------------------------------------------ facades and roofs
  const textures = new Map<string, pc.StandardMaterial>();
  /** One bay of one storey (or two bays of the ground floor), painted once per look and colour. */
  function facade(kind: string, wall: string, trim: string, base: string) {
    const key = `${kind}|${wall}|${trim}|${base}`;
    let m = textures.get(key);
    if (m) return m;
    const ground = ['masonry', 'arcade', 'ashlar', 'ashlar-arcade', 'shops', 'lobby'].includes(kind);
    const w = ground ? 256 : 128, h = 192;
    const glass = '#2c3a42', wood = '#5b3d2a';
    // Varies blinds, shutters and awnings between walls of different colours.
    const seed = [...wall].reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
    const c = canvas(w, h, ctx => {
      const stones = (fill: string, rows: number) => {
        ctx.fillStyle = fill; ctx.fillRect(0, 0, w, h);
        const rh = h / rows;
        for (let r = 0; r < rows; r++) for (let k = -1; k < w / 40 + 1; k++) {
          ctx.fillStyle = `rgba(${jitter(r * 13 + k) > 0.5 ? '255,255,255' : '0,0,0'},${0.04 + jitter(r * 7 + k) * 0.06})`;
          ctx.fillRect(k * 40 + (r % 2) * 20 + 1, r * rh + 1, 38, rh - 2);
        }
        ctx.strokeStyle = 'rgba(60,50,40,.28)'; ctx.lineWidth = 1.5;
        for (let r = 0; r <= rows; r++) { ctx.beginPath(); ctx.moveTo(0, r * rh); ctx.lineTo(w, r * rh); ctx.stroke(); }
        for (let r = 0; r < rows; r++) for (let k = 0; k < w / 40 + 1; k++) { ctx.beginPath(); ctx.moveTo(k * 40 + (r % 2) * 20, r * rh); ctx.lineTo(k * 40 + (r % 2) * 20, (r + 1) * rh); ctx.stroke(); }
      };
      const window = (x0: number, y0: number, ww: number, wh: number, frame: string) => {
        ctx.fillStyle = frame; ctx.fillRect(x0 - 5, y0 - 5, ww + 10, wh + 10);
        ctx.fillStyle = glass; ctx.fillRect(x0, y0, ww, wh);
        ctx.fillStyle = 'rgba(190,220,235,.22)'; ctx.fillRect(x0 + 3, y0 + 3, ww * 0.35, wh - 6);
        ctx.fillStyle = frame; ctx.fillRect(x0 + ww / 2 - 2, y0, 4, wh);
      };
      if (kind === 'rendered' || kind === 'timber') {
        ctx.fillStyle = wall; ctx.fillRect(0, 0, w, h);
        if (kind === 'timber') {
          ctx.fillStyle = trim;
          ctx.fillRect(0, 0, w, 9); ctx.fillRect(0, h - 9, w, 9); ctx.fillRect(0, 0, 8, h); ctx.fillRect(w - 8, 0, 8, h);
          ctx.save(); ctx.translate(14, h - 14); ctx.rotate(-0.95); ctx.fillRect(0, -4, 70, 8); ctx.restore();
        }
        window(36, 46, 56, 92, kind === 'timber' ? '#efe6d4' : trim);
        ctx.fillStyle = kind === 'timber' ? '#7a4b2f' : '#3f6b4a';
        ctx.fillRect(18, 41, 14, 102); ctx.fillRect(96, 41, 14, 102);
        // A wooden balcony rail under each window.
        ctx.fillStyle = wood; ctx.fillRect(26, 138, 76, 8);
        for (let i = 0; i < 9; i++) ctx.fillRect(28 + i * 9, 146, 4, 26);
        ctx.fillRect(22, 170, 84, 7);
      } else if (kind === 'iron-balconies') {
        ctx.fillStyle = wall; ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = trim; ctx.fillRect(0, h - 14, w, 14);
        window(34, 30, 60, 128, trim);
        ctx.fillStyle = '#b7b0a2'; ctx.fillRect(18, 150, 92, 9);
        ctx.fillStyle = '#1f2224';
        ctx.fillRect(18, 108, 92, 5);
        for (let i = 0; i < 12; i++) ctx.fillRect(20 + i * 8, 108, 2.5, 44);
        for (let i = 0; i < 14; i++) {
          ctx.fillStyle = ['#d23a4a', '#e8607a', '#c22f3a', '#4f7a3a'][i % 4];
          ctx.beginPath(); ctx.arc(22 + i * 6.3, 104 + jitter(i) * 6, 4 + jitter(i + 3) * 2, 0, Math.PI * 2); ctx.fill();
        }
      } else if (kind === 'flats' || kind === 'school') {
        // Barcelona blocks of flats: a window with its roller blind half down and a small iron
        // balcony; a school: one wide band of glazing per storey with coloured frames.
        ctx.fillStyle = wall; ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = 'rgba(0,0,0,.05)'; ctx.fillRect(0, h - 10, w, 10);
        if (kind === 'school') {
          ctx.fillStyle = trim; ctx.fillRect(0, 44, w, 104);
          ctx.fillStyle = glass; ctx.fillRect(0, 52, w, 88);
          ctx.fillStyle = 'rgba(190,220,235,.25)'; ctx.fillRect(6, 56, 40, 80);
          ctx.fillStyle = trim; for (const x0 of [0, 64]) ctx.fillRect(x0, 44, 6, 104);
        } else {
          window(36, 40, 56, 100, trim);
          ctx.fillStyle = '#d9cfbf'; ctx.fillRect(31, 35, 66, 16 + jitter(seed) * 30);
          ctx.fillStyle = 'rgba(0,0,0,.12)'; for (let y = 38; y < 50 + jitter(seed) * 30; y += 4) ctx.fillRect(31, y, 66, 1);
          ctx.fillStyle = '#9d988d'; ctx.fillRect(22, 146, 84, 8);
          ctx.fillStyle = '#2b2e30'; ctx.fillRect(22, 112, 84, 4);
          for (let i = 0; i < 11; i++) ctx.fillRect(24 + i * 8, 112, 2.5, 34);
        }
      } else if (kind === 'shops' || kind === 'lobby') {
        // Ground floors on a Barcelona avenue: shop windows under striped awnings, metal shutters;
        // `lobby`: a school or block entrance, glass doors under a coloured band.
        ctx.fillStyle = base; ctx.fillRect(0, 0, w, h);
        for (const [i, x0] of [14, 142].entries()) {
          const shut = kind === 'shops' && jitter(seed + i) > 0.7;
          ctx.fillStyle = '#3a3f42'; ctx.fillRect(x0, 50, 100, h - 50);
          ctx.fillStyle = shut ? '#8f9396' : 'rgba(255,214,150,.55)'; ctx.fillRect(x0 + 6, 56, 88, h - 62);
          if (shut) { ctx.fillStyle = 'rgba(0,0,0,.18)'; for (let y = 58; y < h; y += 6) ctx.fillRect(x0 + 6, y, 88, 1.5); }
          if (kind === 'shops') {
            const stripe = ['#3f6b4a', '#a8423a', '#2f5d8a', '#c88b2c'][(seed + i) % 4];
            for (let k = 0; k < 10; k++) { ctx.fillStyle = k % 2 ? '#f3eee2' : stripe; ctx.fillRect(x0 + k * 10, 30, 10, 20); }
          } else { ctx.fillStyle = trim; ctx.fillRect(x0, 34, 100, 16); ctx.fillStyle = '#2c3a42'; ctx.fillRect(x0 + 30, 70, 40, h - 70); }
        }
      } else if (kind === 'ashlar' || kind === 'ashlar-windows') {
        stones(wall, 8);
        if (kind === 'ashlar-windows') {
          ctx.fillStyle = trim; ctx.beginPath(); ctx.roundRect(38, 40, 52, 104, [26, 26, 0, 0]); ctx.fill();
          ctx.fillStyle = glass; ctx.beginPath(); ctx.roundRect(44, 46, 40, 94, [20, 20, 0, 0]); ctx.fill();
        }
      } else if (kind === 'masonry') {
        stones(base, 6);
        ctx.fillStyle = '#4a3324'; ctx.beginPath(); ctx.roundRect(36, 54, 58, h - 54, [6, 6, 0, 0]); ctx.fill();
        ctx.fillStyle = '#5f4330'; for (let i = 0; i < 4; i++) ctx.fillRect(40 + i * 14, 60, 9, h - 64);
        ctx.fillStyle = '#c9b48a'; ctx.fillRect(84, 120, 4, 8);
        window(164, 62, 48, 62, '#e8e0cf');
        ctx.fillStyle = '#26292b'; for (let i = 0; i < 5; i++) ctx.fillRect(166 + i * 10, 62, 3, 62);
      } else if (kind === 'arcade' || kind === 'ashlar-arcade') {
        if (kind === 'arcade') { ctx.fillStyle = base; ctx.fillRect(0, 0, w, h); } else stones(base, 6);
        for (const x0 of [14, 142]) {
          ctx.fillStyle = '#3c3530'; ctx.beginPath(); ctx.roundRect(x0, 34, 100, h - 34, [50, 50, 0, 0]); ctx.fill();
          ctx.fillStyle = '#6f5a44'; ctx.fillRect(x0 + 24, 96, 52, h - 96);
          ctx.fillStyle = 'rgba(255,214,150,.45)'; ctx.fillRect(x0 + 30, 104, 40, 40);
        }
        ctx.fillStyle = trim; ctx.fillRect(0, 0, w, 10);
      }
      // A soft darker base so walls sit on the street.
      const fade = ctx.createLinearGradient(0, h * 0.82, 0, h);
      fade.addColorStop(0, 'rgba(0,0,0,0)'); fade.addColorStop(1, ground ? 'rgba(0,0,0,.18)' : 'rgba(0,0,0,0)');
      ctx.fillStyle = fade; ctx.fillRect(0, 0, w, h);
    });
    m = textured(`Fachada ${kind}`, c, 0.1);
    textures.set(key, m);
    return m;
  }
  const roofs = new Map<string, pc.StandardMaterial>();
  function roofMaterial(colour: string) {
    let m = roofs.get(colour);
    if (m) return m;
    m = textured(`Tejado ${colour}`, canvas(64, 64, ctx => {
      ctx.fillStyle = colour; ctx.fillRect(0, 0, 64, 64);
      for (let r = 0; r < 4; r++) {
        const g = ctx.createLinearGradient(0, r * 16, 0, r * 16 + 16);
        g.addColorStop(0, 'rgba(255,230,200,.16)'); g.addColorStop(0.75, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(40,10,0,.35)');
        ctx.fillStyle = g; ctx.fillRect(0, r * 16, 64, 16);
        for (let k = 0; k < 4; k++) { ctx.fillStyle = 'rgba(50,15,0,.25)'; ctx.fillRect(k * 16 + (r % 2) * 8, r * 16, 1.5, 16); }
      }
      for (let i = 0; i < 40; i++) { ctx.fillStyle = `rgba(${jitter(i) > .5 ? '90,60,40' : '255,220,190'},.12)`; ctx.fillRect(jitter(i + 1) * 64, jitter(i + 2) * 64, 6, 3); }
    }), 0.15);
    roofs.set(colour, m);
    return m;
  }

  function building(b: GeoBuilding) {
    const pivot = new pc.Entity(`Edificio ${b.number ?? b.name ?? b.id}`);
    root.addChild(pivot);
    const poly = b.poly, H = b.height, storey = scene.storey;
    const groundTop = Math.min(H, storey * 1.15);
    const ccw = signedArea(poly) > 0;
    const walls = new MeshBuilder(), base = new MeshBuilder();
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], c = poly[(i + 1) % poly.length];
      const len = Math.hypot(c[0] - a[0], c[1] - a[1]); if (len < 1e-3) continue;
      // Outward normal in grid space, turned into scene space (same axes).
      const sign = ccw ? 1 : -1;
      const n: V3 = [(c[1] - a[1]) / len * sign, 0, -(c[0] - a[0]) / len * sign];
      const bays = Math.max(1, Math.round(len / BAY));
      base.quad(P(a, 0), P(c, 0), P(c, groundTop), P(a, groundTop), n, [0, 0], [bays / 2, 0], [bays / 2, 1], [0, 1]);
      if (H > groundTop + 0.05) {
        const floors = (H - groundTop) / storey;
        walls.quad(P(a, groundTop), P(c, groundTop), P(c, H), P(a, H), n, [0, 0], [bays, 0], [bays, floors], [0, floors]);
      }
    }
    const trim = b.trim ?? '#f2ede2', baseColour = b.base ?? '#a69a86';
    add('Planta baja', base, facade(b.ground, b.walls, trim, baseColour), pivot, false);
    add('Fachada', walls, facade(b.facade, b.walls, trim, baseColour), pivot, false);
    // A flat ceiling under the eaves closes the top of any footprint the roof does not cover.
    const lid = new MeshBuilder();
    for (const [i, j, k] of triangulate(poly)) lid.tri(P(poly[i], H), P(poly[j], H), P(poly[k], H), [0, 1, 0]);
    add('Forjado', lid, mat('Forjado', b.walls), pivot, false, false);
    add('Tejado', roof(b, H), roofMaterial(b.roofColor ?? '#b4643f'), pivot, false);
    if (!boxy(b)) {
      // A low parapet hides the edge of a flat roof.
      const parapet = new MeshBuilder();
      for (let i = 0; i < poly.length; i++) {
        const a = poly[i], c = poly[(i + 1) % poly.length], len = Math.hypot(c[0] - a[0], c[1] - a[1]);
        if (len < 1e-3) continue;
        const sign = ccw ? 1 : -1, n: V3 = [(c[1] - a[1]) / len * sign, 0, -(c[0] - a[0]) / len * sign];
        parapet.quad(P(a, H), P(c, H), P(c, H + 0.45), P(a, H + 0.45), n, [0, 0.9], [len / BAY, 0.9], [len / BAY, 1], [0, 1]);
      }
      add('Peto', parapet, facade(b.facade, b.walls, trim, baseColour), pivot, false);
    }
    if (b.roof !== 'flat') add('Hastial', gableEnds(b, H), facade('rendered', b.walls, trim, baseColour), pivot, false);
    const xs = poly.map(p => x(p[0])), zs = poly.map(p => z(p[1]));
    folds.push({ pivot, poly, t: 1, min: new pc.Vec3(Math.min(...xs), 0, Math.min(...zs)), max: new pc.Vec3(Math.max(...xs), H + 3, Math.max(...zs)) });
  }
  /** Whether the footprint nearly fills its oriented box, so a pitched roof on the box fits it. */
  const boxy = (b: GeoBuilding) => Math.abs(signedArea(b.poly)) / (b.box.w * b.box.d) > 0.85;
  /** The roof over the footprint's oriented box: hipped, gabled, pyramid or flat. */
  function roof(b: GeoBuilding, H: number) {
    const box = b.box, long = box.w >= box.d;
    // An L or a courtyard would put a box roof over open ground: those keep a flat roof on the real outline.
    if (b.roof !== 'flat' && !boxy(b)) {
      const out = new MeshBuilder();
      for (const [i, j, k] of triangulate(b.poly)) out.tri(P(b.poly[i], H + 0.25), P(b.poly[j], H + 0.25), P(b.poly[k], H + 0.25), [0, 1, 0],
        [b.poly[i][0] * 0.9, b.poly[i][1] * 1.1], [b.poly[j][0] * 0.9, b.poly[j][1] * 1.1], [b.poly[k][0] * 0.9, b.poly[k][1] * 1.1]);
      return out;
    }
    const ua = long ? box.angle : box.angle + Math.PI / 2;
    const e1 = [Math.cos(ua), Math.sin(ua)], e2 = [-Math.sin(ua), Math.cos(ua)];
    const hl = Math.max(box.w, box.d) / 2 + EAVE, hs = Math.min(box.w, box.d) / 2 + EAVE;
    const rise = b.roof === 'flat' ? 0 : b.roof === 'pyramid' ? Math.max(hl, hs) * 1.4 : hs * ROOF_PITCH;
    const ridge = b.roof === 'gable' ? hl : b.roof === 'pyramid' ? 0 : Math.max(0, hl - hs);
    const at = (u: number, v: number, y: number): V3 => P([box.cx + e1[0] * u + e2[0] * v, box.cz + e1[1] * u + e2[1] * v], y);
    const out = new MeshBuilder();
    const up = (u: number, v: number): V3 => [x(box.cx + e1[0] * u + e2[0] * v) - x(box.cx), 0.6, z(box.cz + e1[1] * u + e2[1] * v) - z(box.cz)];
    const uv = (u: number, v: number) => [u * 0.9, Math.abs(v) * 1.1];
    const c00 = at(-hl, -hs, H), c10 = at(hl, -hs, H), c11 = at(hl, hs, H), c01 = at(-hl, hs, H);
    if (b.roof === 'flat') { out.quad(c00, c10, c11, c01, [0, 1, 0], [0, 0], [hl, 0], [hl, hs], [0, hs]); return out; }
    const r0 = at(-ridge, 0, H + rise), r1 = at(ridge, 0, H + rise);
    out.quad(c00, c10, r1, r0, up(0, -1), uv(-hl, -hs), uv(hl, -hs), uv(ridge, 0), uv(-ridge, 0));
    out.quad(c11, c01, r0, r1, up(0, 1), uv(hl, hs), uv(-hl, hs), uv(-ridge, 0), uv(ridge, 0));
    if (b.roof !== 'gable') {
      out.tri(c10, c11, r1, up(1, 0), uv(-hs, hl), uv(hs, hl), uv(0, 0));
      out.tri(c01, c00, r0, up(-1, 0), uv(-hs, hl), uv(hs, hl), uv(0, 0));
    }
    return out;
  }
  /** Gabled roofs leave a triangle of wall at each end. */
  function gableEnds(b: GeoBuilding, H: number) {
    const out = new MeshBuilder();
    if (b.roof !== 'gable' || !boxy(b)) return out;
    const box = b.box, long = box.w >= box.d, ua = long ? box.angle : box.angle + Math.PI / 2;
    const e1 = [Math.cos(ua), Math.sin(ua)], e2 = [-Math.sin(ua), Math.cos(ua)];
    const hl = Math.max(box.w, box.d) / 2, hs = Math.min(box.w, box.d) / 2, rise = (hs + EAVE) * ROOF_PITCH;
    for (const s of [-1, 1]) {
      const at = (v: number, y: number): V3 => P([box.cx + e1[0] * hl * s + e2[0] * v, box.cz + e1[1] * hl * s + e2[1] * v], y);
      out.tri(at(-hs, H), at(hs, H), at(0, H + rise), [e1[0] * s, 0, e1[1] * s], [0, 0], [hs / BAY * 2, 0], [hs / BAY, rise / scene.storey]);
    }
    return out;
  }
  scene.buildings.forEach(building);

  // ------------------------------------------------------------ surroundings
  for (const l of scene.labels) kit.label(l.text, l.x, LAYER.bridge + 0.01, l.z, l.width);
  // Wooded hills close every side but the camera's, as the valley does around the town.
  const hill = [mat('Monte', '#4e6b45', 0.05), mat('Monte lejano', '#5f7c55', 0.05), mat('Monte sombra', '#41593b', 0.05)];
  const hills: [number, number, number, number, number][] = [
    [W * 0.15, -18, 70, 22, 40], [W * 0.5, -22, 90, 30, 46], [W * 0.88, -16, 70, 20, 38],
    [-22, D * 0.3, 40, 18, 70], [-20, D * 0.85, 34, 14, 50],
  ];
  hills.forEach(([px, pz, w, h, d], i) => {
    const e = new pc.Entity('Monte');
    e.addComponent('render', { type: 'sphere', material: hill[i % 3], castShadows: false, receiveShadows: true, batchGroupId: kit.batch });
    e.setPosition(x(px), -h * 0.15, z(pz)); e.setLocalScale(w, h, d); root.addChild(e);
  });

  // ------------------------------------------------------------ folding
  const origin = new pc.Vec3(), sample = new pc.Vec3();
  function hides(fold: Fold, focus: pc.Vec3, toCamera: pc.Vec3) {
    const lo = [fold.min.x - CUT_MARGIN, fold.min.y, fold.min.z - CUT_MARGIN], hi = [fold.max.x + CUT_MARGIN, fold.max.y, fold.max.z + CUT_MARGIN];
    const dir = [toCamera.x, toCamera.y, toCamera.z];
    for (const lift of [-0.45, 0.1, 0.6]) {
      origin.set(focus.x, focus.y + lift, focus.z);
      const o = [origin.x, origin.y, origin.z];
      let near = 0, far = Infinity, hit = true;
      for (let a = 0; a < 3 && hit; a++) {
        if (Math.abs(dir[a]) < 1e-6) { hit = o[a] >= lo[a] && o[a] <= hi[a]; continue; }
        const t1 = (lo[a] - o[a]) / dir[a], t2 = (hi[a] - o[a]) / dir[a];
        near = Math.max(near, Math.min(t1, t2)); far = Math.min(far, Math.max(t1, t2));
        hit = near <= far;
      }
      if (!hit) continue;
      // Inside the box: walk the ray through it and test the real footprint, a little grown.
      // Starting a step out keeps a wall right behind Gerard from counting as in front of him.
      for (let t = Math.max(near, 0.8); t <= far; t += 0.35) {
        sample.copy(toCamera).mulScalar(t).add(origin);
        const gx = sample.x + (W - 1) / 2, gz = sample.z + (D - 1) / 2;
        for (const [dx, dz] of [[0, 0], [CUT_MARGIN, 0], [-CUT_MARGIN, 0], [0, CUT_MARGIN], [0, -CUT_MARGIN]]) {
          if (inside(gx + dx, gz + dz, fold.poly)) return true;
        }
      }
    }
    return false;
  }

  return {
    /** Folds buildings that stand between `focus` and the camera. */
    update(dt: number, animate: boolean, focus?: pc.Vec3, toCamera?: pc.Vec3) {
      if (animate) { time += dt; river.diffuseMapOffset.set(time * 0.05, time * 0.02); river.emissiveMapOffset.set(-time * 0.03, time * 0.04); river.update(); }
      for (const fold of folds) {
        const target = focus && toCamera && hides(fold, focus, toCamera) ? FOLDED : 1;
        if (fold.t === target) continue;
        fold.t = animate ? fold.t + (target - fold.t) * (1 - Math.exp(-dt * FOLD_RATE)) : target;
        if (Math.abs(fold.t - target) < 0.01) fold.t = target;
        fold.pivot.setLocalScale(1, fold.t, 1);
      }
    },
    destroy() { meshes.forEach(m => m.destroy()); },
  };
}
