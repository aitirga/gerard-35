/**
 * Barcelona's network map as a 3D model of the real city (docs/barcelona.md § The network map):
 * the ground lies flat (`public/maps/barcelona.webp`: streets, parks, beaches and the sea), every
 * building from OpenStreetMap stands on it at its height (`public/maps/barcelona-buildings.bin`,
 * `just city-fetch-buildings`), and the metro lines run under the streets: thin bands of their
 * colour on the ground, in a soft glow, seen faintly through the buildings that stand over them.
 * Famous places stand as little models in the castle's style (src/city-landmarks.ts); La Reina
 * Bubbaloo's castle rises in 3D in its pink halo. Stations, names, the landmarks' labels, the pin and the train are drawn over the picture
 * in one SVG, placed every frame where the camera sees them, so they stay upright and readable.
 *
 * Map metres as everywhere (x right along the coast, y down towards the sea): in the scene x is
 * X, y is Z and up is Y. The camera orbits a point on the ground; `travel-ui.ts` drives it.
 * Falls back to the flat SVG (`city-map.ts`) when WebGPU or the data are missing.
 */
import * as pc from 'playcanvas';
import { CITY_MAP, LINES, STATIONS, type Leg } from './transit';
import type { MapMarker } from './map-markers';
import { LANDMARK_MODELS, LANDMARK_SCALE, type Sink } from './city-landmarks';
import type { CityMapOptions } from './city-map';

const BASE = (import.meta as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? './';
const escape = (text: string) => text.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** Buildings stand this many times their real height, so the city still reads from high up. */
const STRETCH = 2.4;
/** The lines lie this high over the ground (m), each a little above the one before. */
const LINE_Y = 9, LINE_STEP = 2.5;
/** How wide a line reads on screen (px), and its glow round it (times the line's width). */
const LINE_PX = 5.5, GLOW = 4;
/** Seen through the buildings, a line is this opaque. */
const XRAY = .55;
/** The castle's pinks (La Reina Bubbaloo's alone, docs/visual-style.md). */
const QUEEN = ['#ff6fae', '#d94a8c'], QUEEN_GLOW = '#ff6fae';
/** A landmark's label stands this many pixels over the top of its building. */
const STEM = 22;
/** The camera: field of view, the lowest and highest it looks down from, nearest and farthest. */
const FOV = 38, PITCH_MIN = .5, PITCH_MAX = 1.45, NEAR = 700;
/** Chunks per side: the buildings are cut into CHUNKS × CHUNKS meshes so off-screen ones are skipped. */
const CHUNKS = 8;
/** Facade colours by kind (tools/city.py `building_kind`): homes, works and offices, civic buildings. */
const BUILDING_COLOURS = [
  ['#f2dcb5', '#ecd0a6', '#f5e4c6', '#e8c9a0', '#f0d6b8', '#ead5bb', '#f3d9a8'],
  ['#d9d5cc', '#cdd2d6', '#ddd6c8', '#c9cfcf'],
  ['#e7a98a', '#e3b27c', '#e9b896'],
];
/** Tall towers are glass. */
const TOWER_M = 70, TOWER_COLOURS = ['#a9c3d6', '#9fb9cc', '#b6cad8'];
const HAZE = '#efe7d3', SEA = '#7ec4e0', LAND = '#d8cbac';

/** Where the camera looks from: a point on the ground, how far, turned how much, how steeply. */
export interface Orbit { x: number; y: number; distance: number; yaw: number; pitch: number }

const rgb = (hex: string) => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];

/** Positions and colours of unlit triangles, grown as needed. */
class Geometry {
  pos: Float32Array; col: Uint8Array; idx: Uint32Array; v = 0; i = 0;
  constructor(vertices = 1024, indices = 2048) { this.pos = new Float32Array(vertices * 3); this.col = new Uint8Array(vertices * 4); this.idx = new Uint32Array(indices); }
  reserve(vertices: number, indices: number) {
    if ((this.v + vertices) * 3 > this.pos.length) {
      const n = Math.max(this.pos.length * 2, (this.v + vertices) * 3);
      const pos = new Float32Array(n); pos.set(this.pos); this.pos = pos;
      const col = new Uint8Array(n / 3 * 4); col.set(this.col); this.col = col;
    }
    if (this.i + indices > this.idx.length) { const idx = new Uint32Array(Math.max(this.idx.length * 2, this.i + indices)); idx.set(this.idx); this.idx = idx; }
  }
  vertex(x: number, y: number, z: number, [r, g, b]: number[], shade = 1, a = 255) {
    const k = this.v * 3, c = this.v * 4;
    this.pos[k] = x; this.pos[k + 1] = y; this.pos[k + 2] = z;
    this.col[c] = Math.min(255, r * shade); this.col[c + 1] = Math.min(255, g * shade); this.col[c + 2] = Math.min(255, b * shade); this.col[c + 3] = a;
    return this.v++;
  }
  tri(a: number, b: number, c: number) { this.idx[this.i++] = a; this.idx[this.i++] = b; this.idx[this.i++] = c; }
  quad(a: number, b: number, c: number, d: number) { this.tri(a, b, c); this.tri(a, c, d); }
  mesh(device: pc.GraphicsDevice) {
    const m = new pc.Mesh(device);
    m.setPositions(this.pos.subarray(0, this.v * 3)); m.setColors32(this.col.subarray(0, this.v * 4)); m.setIndices(this.idx.subarray(0, this.i)); m.update();
    return m;
  }
}

/** Ear clipping on a ring of [x, z] pairs (xs[i], zs[i]), as index triples into it. */
function triangulate(xs: number[], zs: number[], ccw: boolean, out: number[]) {
  const idx = xs.map((_, i) => i);
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
    if (!clipped) break; // Self-touching rings: fan the rest rather than lose the roof.
  }
  for (let k = 1; k + 1 < idx.length; k++) out.push(idx[0], idx[k], idx[k + 1]);
}

/**
 * The buildings, `barcelona-buildings.bin` (tools/city.py `buildings`): int16s, per building its
 * height, kind, point count and points. Walls are shaded as if lit from the left like the map's
 * icons, a little darker at the foot; roofs are flat terraces a shade lighter than the facade.
 * Buildings within a famous place's `clear` radius are left out: its model stands there instead.
 */
function buildingChunks(data: Int16Array, bounds: { x0: number; y0: number; x1: number; y1: number }, clear: readonly { x: number; y: number; r: number }[]) {
  const chunks = Array.from({ length: CHUNKS * CHUNKS }, () => new Geometry(4096, 8192));
  const cw = (bounds.x1 - bounds.x0) / CHUNKS, chh = (bounds.y1 - bounds.y0) / CHUNKS;
  const xs: number[] = [], zs: number[] = [], roof: number[] = [];
  for (let o = 0, n = 0; o < data.length; o += 3 + data[o + 2] * 2, n++) {
    const height = data[o] * STRETCH, kind = data[o + 1], count = data[o + 2];
    xs.length = zs.length = roof.length = 0;
    let area = 0;
    for (let i = 0; i < count; i++) { xs.push(data[o + 3 + i * 2]); zs.push(data[o + 4 + i * 2]); }
    for (let i = 0, j = count - 1; i < count; j = i++) area += xs[j] * zs[i] - xs[i] * zs[j];
    if (clear.some(c => Math.hypot(c.x - xs[0], c.y - zs[0]) < c.r)) continue;
    const palette = data[o] >= TOWER_M ? TOWER_COLOURS : BUILDING_COLOURS[kind] ?? BUILDING_COLOURS[0];
    const base = rgb(palette[(n * 2654435761 >>> 0) % palette.length]);
    const top = base.map(c => c + (255 - c) * .3);
    const cx = Math.min(CHUNKS - 1, Math.max(0, Math.floor((xs[0] - bounds.x0) / cw)));
    const cz = Math.min(CHUNKS - 1, Math.max(0, Math.floor((zs[0] - bounds.y0) / chh)));
    const g = chunks[cz * CHUNKS + cx];
    g.reserve(count * 5, count * 9);
    // Walls: one quad per edge, its normal pointing out of the ring.
    const sign = area > 0 ? 1 : -1;
    for (let i = 0; i < count; i++) {
      const j = (i + 1) % count, dx = xs[j] - xs[i], dz = zs[j] - zs[i], len = Math.hypot(dx, dz) || 1;
      const nx = dz / len * sign, nz = -dx / len * sign;
      const lit = .6 + .32 * Math.max(0, -nx * .8 + nz * .6);
      const a = g.vertex(xs[i], 0, zs[i], base, lit * .78), b = g.vertex(xs[j], 0, zs[j], base, lit * .78);
      const c = g.vertex(xs[j], height, zs[j], base, lit), d = g.vertex(xs[i], height, zs[i], base, lit);
      g.quad(a, b, c, d);
    }
    const first = g.v;
    for (let i = 0; i < count; i++) g.vertex(xs[i], height, zs[i], top);
    triangulate(xs, zs, area > 0, roof);
    for (let k = 0; k < roof.length; k += 3) g.tri(first + roof[k], first + roof[k + 1], first + roof[k + 2]);
  }
  return chunks.filter(g => g.i);
}

/** A disc round (x, z) at height y, from `inner` alpha at its centre to `outer` at its rim. */
function disc(g: Geometry, x: number, y: number, z: number, r: number, colour: number[], inner = 255, outer = 255, sides = 20) {
  g.reserve(sides + 1, sides * 3);
  const centre = g.vertex(x, y, z, colour, 1, inner);
  const ring = Array.from({ length: sides }, (_, k) => g.vertex(x + Math.cos(k / sides * Math.PI * 2) * r, y, z + Math.sin(k / sides * Math.PI * 2) * r, colour, 1, outer));
  for (let k = 0; k < sides; k++) g.tri(centre, ring[k], ring[(k + 1) % sides]);
}

/** A band `r` to each side of `pts`, round at every station; fading from `alpha` in its middle to `edge` at its sides. */
function band(g: Geometry, pts: number[][], y: number, r: number, colour: number[], alpha = 255, edge = 255) {
  for (let i = 0; i + 1 < pts.length; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[i + 1], len = Math.hypot(bx - ax, bz - az) || 1;
    const px = -(bz - az) / len * r, pz = (bx - ax) / len * r;
    g.reserve(6, 12);
    const a = g.vertex(ax, y, az, colour, 1, alpha), b = g.vertex(bx, y, bz, colour, 1, alpha);
    g.quad(g.vertex(ax + px, y, az + pz, colour, 1, edge), g.vertex(bx + px, y, bz + pz, colour, 1, edge), b, a);
    g.quad(a, b, g.vertex(bx - px, y, bz - pz, colour, 1, edge), g.vertex(ax - px, y, az - pz, colour, 1, edge));
  }
  for (const [x, z] of pts) disc(g, x, y, z, r, colour, alpha, edge);
}

/**
 * The lines under the streets, `w` metres wide (kept a few pixels wide on screen as the camera
 * moves): a band of the line's colour on the ground, and round it a soft glow of the same colour
 * that the buildings standing over it hide.
 */
function lineGeometry(w: number) {
  const core = new Geometry(), glow = new Geometry();
  LINES.forEach((line, i) => {
    const pts = line.stations.map(id => [STATIONS[id].x, STATIONS[id].y]), y = LINE_Y + i * LINE_STEP, colour = rgb(line.colour);
    band(core, pts, y, w / 2, colour);
    band(glow, pts, y - 4, w / 2 * GLOW, colour.map(c => c + (255 - c) * .2), 130, 0);
  });
  return { core, glow };
}

/** A pointed tower of `sides` faces round (x, z), lit from the left like the blocks. */
function tower(g: Geometry, x: number, z: number, r: number, h: number, roof: number, colour: number[], sides = 8) {
  g.reserve(sides * 7, sides * 9);
  const top = colour.map(c => c + (255 - c) * .2);
  for (let k = 0; k < sides; k++) {
    const a0 = k / sides * Math.PI * 2, a1 = (k + 1) / sides * Math.PI * 2, am = (a0 + a1) / 2;
    const lit = .6 + .32 * Math.max(0, -Math.cos(am) * .8 + Math.sin(am) * .6);
    const x0 = x + Math.cos(a0) * r, z0 = z + Math.sin(a0) * r, x1 = x + Math.cos(a1) * r, z1 = z + Math.sin(a1) * r;
    g.quad(g.vertex(x0, 0, z0, colour, lit * .78), g.vertex(x1, 0, z1, colour, lit * .78), g.vertex(x1, h, z1, colour, lit), g.vertex(x0, h, z0, colour, lit));
    if (roof > 0) g.tri(g.vertex(x0, h, z0, top, lit), g.vertex(x1, h, z1, top, lit), g.vertex(x, h + roof, z, top, lit * 1.05));
  }
}

/**
 * La Reina Bubbaloo's castle over the school: pink towers on a pink keep, more and taller the
 * stronger she is (`level`, 0 to 1), `size` times as big; and on the ground round it her halo,
 * `reach` icon units wide like the flat plan's (its brightest ring at .62 of it).
 */
function castleGeometry(m: MapMarker) {
  const body = new Geometry(), halo = new Geometry();
  const level = m.level ?? 0, size = m.size ?? 1, glow = rgb(QUEEN_GLOW);
  const r = Math.max(1.6, m.reach ?? 0) * 210;
  // The halo: clear in the middle, brightest on a ring, gone at its rim.
  const sides = 48, ring = (k: number, rad: number, a: number) => halo.vertex(m.x + Math.cos(k / sides * Math.PI * 2) * rad, 4, m.y + Math.sin(k / sides * Math.PI * 2) * rad, glow, 1, a);
  halo.reserve(sides * 3 + 1, sides * 9);
  const c = halo.vertex(m.x, 4, m.y, glow, 1, 70);
  const inner = Array.from({ length: sides }, (_, k) => ring(k, r * .62, 200)), outer = Array.from({ length: sides }, (_, k) => ring(k, r, 0));
  for (let k = 0; k < sides; k++) {
    const n = (k + 1) % sides;
    halo.tri(c, inner[k], inner[n]);
    halo.quad(inner[k], outer[k], outer[n], inner[n]);
  }
  const towers = 3 + Math.round(level * 6), spread = 130 * size;
  tower(body, m.x, m.y, 150 * size, 80 * size, 0, rgb(QUEEN[1]), 12);
  for (let i = 0; i < towers; i++) {
    // A spiral out from the middle: the tallest in the middle, lower towards the walls.
    const t = Math.sqrt((i + .5) / towers), angle = i * 2.39996;
    const h = (260 + (1 - t) * (260 + level * 420)) * size;
    tower(body, m.x + Math.cos(angle) * t * spread, m.y + Math.sin(angle) * t * spread, (34 + (1 - t) * 18) * size, h, (90 + (1 - t) * 40) * size, rgb(QUEEN[i % 2]));
  }
  return { body, halo };
}

export interface City3D {
  orbit: Orbit;
  /** The orbit that shows the whole city. */
  readonly whole: Orbit;
  /** Redraws the stations, names, markers and trips over the model. */
  draw(options: CityMapOptions): void;
  /** Puts the little train at a point of the map (on the line's height), or takes it away. */
  train(at?: { x: number; y: number }): void;
  /** Frames these map points with room round them. */
  frame(points: { x: number; y: number }[], least?: number): void;
  pan(dx: number, dy: number): void;
  rotate(dx: number, dy: number): void;
  /** Zooms by `factor` keeping the ground under the pixel (px, py) of the panel in place. */
  zoom(factor: number, px?: number, py?: number): void;
  pause(paused: boolean): void;
  destroy(): void;
}

/** Builds the model in `host` (the travel panel's map box); undefined if WebGPU is not there. */
export async function createCity3D(host: HTMLElement): Promise<City3D | undefined> {
  const background = CITY_MAP.background, buildings = (CITY_MAP as { buildings?: { href: string } }).buildings;
  if (!background || !buildings) return undefined;
  const canvas = document.createElement('canvas');
  canvas.className = 'city-3d';
  host.append(canvas);
  // Its own WebGPU device on its own canvas, like the game's.
  const made = 'gpu' in navigator ? await pc.createGraphicsDevice(canvas, { deviceTypes: [pc.DEVICETYPE_WEBGPU], antialias: true, alpha: false }).catch(() => undefined) : undefined;
  if (!made?.isWebGPU) { made?.destroy(); canvas.remove(); return undefined; }
  const device: pc.GraphicsDevice = made;
  const app = new pc.AppBase(canvas);
  const options = new pc.AppOptions();
  options.graphicsDevice = device;
  options.componentSystems = [pc.RenderComponentSystem, pc.CameraComponentSystem];
  options.resourceHandlers = [pc.TextureHandler];
  app.init(options);
  device.maxPixelRatio = Math.min(2, window.devicePixelRatio);
  app.setCanvasFillMode(pc.FILLMODE_NONE);
  app.setCanvasResolution(pc.RESOLUTION_AUTO);
  const overlay = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  overlay.classList.add('city-overlay');
  host.append(overlay);
  const resize = () => { const r = host.getBoundingClientRect(); if (r.width && r.height) app.resizeCanvas(r.width, r.height); };
  const observer = new ResizeObserver(resize);
  observer.observe(host);

  /** Unlit vertex colours; see-through ones take their vertices' alpha, x-ray ones draw over everything. */
  const unlit = ({ blend = false, opacity = 1, xray = false } = {}) => {
    const m = new pc.StandardMaterial();
    m.useLighting = false; m.diffuse.set(0, 0, 0); m.emissive.set(1, 1, 1); m.emissiveVertexColor = true;
    m.cull = pc.CULLFACE_NONE;
    if (blend) { m.blendType = pc.BLEND_NORMAL; m.opacity = opacity; m.opacityVertexColor = true; m.opacityVertexColorChannel = 'a'; m.depthWrite = false; }
    if (xray) m.depthTest = false;
    m.update();
    return m;
  };
  const solid = unlit(), soft = unlit({ blend: true }), xray = unlit({ blend: true, opacity: XRAY, xray: true }), halo = unlit({ blend: true });
  // See-through things draw in the order they are added: the glows on the ground, then the lines seen through the buildings.
  app.scene.layers.getLayerById(pc.LAYERID_WORLD)!.transparentSortMode = pc.SORTMODE_MANUAL;
  let order = 0;
  const add = (name: string, mesh: pc.Mesh, material: pc.Material) => {
    const e = new pc.Entity(name), instance = new pc.MeshInstance(mesh, material);
    instance.drawOrder = order++;
    e.addComponent('render', { meshInstances: [instance], castShadows: false, receiveShadows: false });
    app.root.addChild(e);
    return e;
  };
  /** Puts a new mesh in an entity's place, dropping the old one. */
  const swap = (e: pc.Entity, mesh: pc.Mesh) => { const instance = e.render!.meshInstances[0], old = instance.mesh; instance.mesh = mesh; old?.destroy(); };

  // The ground: land and sea far round the picture, then the picture of the city.
  const far = 60_000, { x0, y0, x1, y1 } = background;
  const base = new Geometry();
  base.reserve(8, 12);
  base.quad(base.vertex(x0 - far, -2, y0 - far, rgb(LAND)), base.vertex(x1 + far, -2, y0 - far, rgb(LAND)), base.vertex(x1 + far, -2, y1 - 1500, rgb(LAND)), base.vertex(x0 - far, -2, y1 - 1500, rgb(LAND)));
  base.quad(base.vertex(x0 - far, -2, y1 - 1500, rgb(SEA)), base.vertex(x1 + far, -2, y1 - 1500, rgb(SEA)), base.vertex(x1 + far, -2, y1 + far, rgb(SEA)), base.vertex(x0 - far, -2, y1 + far, rgb(SEA)));
  add('Alrededores', base.mesh(device), solid);
  const groundMesh = new pc.Mesh(device);
  groundMesh.setPositions([x0, 0, y0, x1, 0, y0, x1, 0, y1, x0, 0, y1]);
  groundMesh.setUvs(0, [0, 0, 1, 0, 1, 1, 0, 1]);
  groundMesh.setIndices([0, 2, 1, 0, 3, 2]);
  groundMesh.update();
  const groundMaterial = new pc.StandardMaterial();
  groundMaterial.useLighting = false; groundMaterial.diffuse.set(0, 0, 0); groundMaterial.emissive.set(1, 1, 1); groundMaterial.cull = pc.CULLFACE_NONE;
  const ground = add('Suelo de Barcelona', groundMesh, groundMaterial);
  ground.enabled = false;
  const texture = new pc.Asset('barcelona-ground', 'texture', { url: `${BASE}${background.href}` }, { srgb: true, mipmaps: true, anisotropy: 8 } as object);
  texture.ready(() => {
    groundMaterial.emissiveMap = texture.resource as pc.Texture; groundMaterial.update();
    ground.enabled = true;
    app.renderNextFrame = true;
  });
  app.assets.add(texture); app.assets.load(texture);
  /** How high each famous place's model stands: its name card hangs over it. */
  const tops = new Map<string, number>();
  // Room for every model: the landmarks, home, and the school (and later the castle over it).
  const clearing = [
    ...CITY_MAP.landmarks.map(l => ({ x: l.x, y: l.y, r: (LANDMARK_MODELS[l.icon]?.clear ?? 0) * LANDMARK_SCALE })),
    ...CITY_MAP.places.filter(p => p.id === 'home' || p.id === 'rec-comtal').map(p => ({ x: p.x, y: p.y, r: p.id === 'home' ? LANDMARK_MODELS.home.clear * LANDMARK_SCALE : 300 })),
  ];
  void fetch(`${BASE}${buildings.href}`).then(r => r.ok ? r.arrayBuffer() : Promise.reject(new Error(r.statusText))).then(buffer => {
    buildingChunks(new Int16Array(buffer), background, clearing).forEach((g, i) => add(`Edificios ${i + 1}`, g.mesh(device), solid));
    app.renderNextFrame = true;
  }).catch(error => console.warn('No buildings for the city map', error));
  // The castle (built when the story puts it on the map), the lines' glow, the lines, and the lines again through the buildings.
  const empty = () => { const g = new Geometry(3, 3); g.tri(g.vertex(0, 0, 0, [0, 0, 0]), g.vertex(0, 0, 0, [0, 0, 0]), g.vertex(0, 0, 0, [0, 0, 0])); return g.mesh(device); };
  const castleHalo = add('Halo del castillo', empty(), halo), castle = add('Castillo de la Reina', empty(), solid);
  let castleKey = '';
  const places = add('Lugares', empty(), solid);
  let placesKey = '';
  let lineWidth = 0;
  const lineGlow = add('Brillo de las líneas', empty(), soft), lines = add('Líneas', empty(), solid), linesThrough = add('Líneas a través de los edificios', empty(), xray);
  /** Keeps the lines LINE_PX wide on screen: rebuilt when the zoom changes their width by more than a tenth. */
  function sizeLines(pxPerMetre: number) {
    const w = Math.min(160, Math.max(12, LINE_PX / pxPerMetre));
    if (lineWidth && Math.abs(w / lineWidth - 1) < .1) return;
    lineWidth = w;
    const { core, glow } = lineGeometry(w);
    swap(lineGlow, glow.mesh(device)); swap(lines, core.mesh(device)); swap(linesThrough, core.mesh(device));
  }

  const camera = new pc.Entity('Cámara del plano');
  camera.addComponent('camera', { fov: FOV, nearClip: 20, farClip: 120_000, clearColor: new pc.Color().fromString(HAZE), toneMapping: pc.TONEMAP_NONE, gammaCorrection: pc.GAMMA_SRGB });
  app.root.addChild(camera);
  app.scene.fog.type = pc.FOG_LINEAR;
  app.scene.fog.color = new pc.Color().fromString(HAZE);

  const extent = CITY_MAP.extent;
  const whole = (): Orbit => {
    const r = host.getBoundingClientRect(), aspect = r.width && r.height ? r.width / r.height : 1.6;
    const span = Math.max(extent.x1 - extent.x0, (extent.y1 - extent.y0) * aspect);
    return { x: (extent.x0 + extent.x1) / 2, y: (extent.y0 + extent.y1) / 2 + 800, distance: span / aspect / (2 * Math.tan(FOV * Math.PI / 360)) * 1.05, yaw: 0, pitch: 1.05 };
  };
  let orbit: Orbit = whole();
  const clamp = (o: Orbit): Orbit => ({
    x: Math.min(extent.x1, Math.max(extent.x0, o.x)), y: Math.min(extent.y1, Math.max(extent.y0, o.y)),
    distance: Math.min(whole().distance * 1.25, Math.max(NEAR, o.distance)),
    yaw: o.yaw, pitch: Math.min(PITCH_MAX, Math.max(PITCH_MIN, o.pitch)),
  });
  function place() {
    const { x, y, distance: d, yaw, pitch } = orbit;
    camera.setPosition(x + Math.sin(yaw) * Math.cos(pitch) * d, Math.sin(pitch) * d, y + Math.cos(yaw) * Math.cos(pitch) * d);
    camera.lookAt(x, 0, y);
    camera.camera!.nearClip = Math.max(10, d * .05);
    app.scene.fog.start = d * 1.4; app.scene.fog.end = d * 5;
    sizeLines(scale());
  }

  // The overlay: every element with a `data-at` (x, y, height) is moved to where it is seen.
  const world = new pc.Vec3(), screen = new pc.Vec3(), forward = new pc.Vec3();
  function project(x: number, y: number, h: number) {
    world.set(x, h, y);
    forward.copy(world).sub(camera.getPosition());
    if (forward.dot(camera.forward) <= 0) return undefined;
    camera.camera!.worldToScreen(world, screen);
    return Number.isFinite(screen.x) && Number.isFinite(screen.y) ? [screen.x, screen.y] : undefined;
  }
  /** Pixels per metre on the ground at the point the camera looks at: how big things read. */
  const scale = () => {
    const a = project(orbit.x, orbit.y, 0), b = project(orbit.x + 100 * Math.cos(orbit.yaw), orbit.y - 100 * Math.sin(orbit.yaw), 0);
    return a && b ? Math.hypot(b[0] - a[0], b[1] - a[1]) / 100 : .1;
  };
  let trips: { el: SVGPathElement; points: number[][] }[] = [];
  let train: { x: number; y: number } | undefined;
  function placeOverlay() {
    const k = scale();
    overlay.classList.toggle('is-far', k < .13);
    // Stations first, then the landmarks' cards wherever they do not cover a station's name or another card.
    const taken: number[][] = [], far = k < .13;
    const overlaps = (r: number[]) => taken.some(t => r[0] < t[2] && r[2] > t[0] && r[1] < t[3] && r[3] > t[1]);
    for (const el of overlay.querySelectorAll<SVGGElement>('[data-at]')) {
      const [x, y, h] = el.dataset.at!.split(',').map(Number);
      // A landmark's label hangs over the top of its building, once the buildings are in.
      const p = project(x, y, el.dataset.landmark ? tops.get(el.dataset.landmark) ?? h : h);
      if (!p) { el.setAttribute('visibility', 'hidden'); continue; }
      const w = Number(el.dataset.w ?? 0);
      if (el.dataset.station && !(far && el.classList.contains('is-minor'))) taken.push([p[0] - 8, p[1] - 10, p[0] + 12 + w, p[1] + 8]);
      if (el.dataset.landmark) {
        const card = [p[0] - w / 2, p[1] - STEM - 22, p[0] + w / 2, p[1] - STEM];
        if (overlaps(card)) { el.setAttribute('visibility', 'hidden'); continue; }
        taken.push(card);
      }
      el.removeAttribute('visibility');
      el.setAttribute('transform', `translate(${p[0].toFixed(1)} ${p[1].toFixed(1)})`);
    }
    for (const t of trips) {
      const pts = t.points.map(([x, y, h]) => project(x, y, h)).filter((p): p is number[] => !!p);
      t.el.setAttribute('d', pts.length > 1 ? `M${pts.map(p => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join('L')}` : '');
    }
    const dot = overlay.querySelector<SVGGElement>('.city-train');
    if (dot) {
      const p = train && project(train.x, train.y, LINE_Y + 4);
      if (p) { dot.setAttribute('transform', `translate(${p[0].toFixed(1)} ${p[1].toFixed(1)})`); dot.removeAttribute('visibility'); }
      else dot.setAttribute('visibility', 'hidden');
    }
  }
  const lineHeight = (id: string) => LINE_Y + Math.max(0, LINES.findIndex(l => l.id === id)) * LINE_STEP;
  const legPoints = (leg: Leg) => leg.stations.map(id => [STATIONS[id].x, STATIONS[id].y, lineHeight(leg.line) + 2]);
  /** A label on a small rounded card, its bottom centre at (0, `y`): sized to its text once in the page. */
  const card = (cls: string, text: string, y: number) => `<g class="${cls}" transform="translate(0 ${y})"><rect x="-20" y="-21" width="40" height="21" rx="10.5"/><text y="-6.5">${escape(text)}</text></g>`;
  /** Sizes every card to its text, and notes how wide each name is (`data-w`) for placeOverlay to keep them apart. */
  function fitCards() {
    for (const g of overlay.querySelectorAll<SVGGElement>('.city-card')) {
      const text = g.querySelector('text')!, rect = g.querySelector('rect')!, w = text.getComputedTextLength() + 20;
      rect.setAttribute('x', (-w / 2).toFixed(1)); rect.setAttribute('width', w.toFixed(1));
      const landmark = g.closest<SVGGElement>('[data-landmark]');
      if (landmark) landmark.dataset.w = w.toFixed(0);
    }
    for (const g of overlay.querySelectorAll<SVGGElement>('[data-station]')) g.dataset.w = g.querySelector('text')!.getComputedTextLength().toFixed(0);
  }

  function draw(options: CityMapOptions) {
    const selectable = new Set(options.selectable ?? []);
    const counts = new Map<string, number>();
    for (const line of LINES) for (const id of line.stations) counts.set(id, (counts.get(id) ?? 0) + 1);
    const named = new Set([...LINES.flatMap(l => [l.stations[0], l.stations.at(-1)!]), ...[...counts].filter(([, n]) => n > 1).map(([id]) => id)]);
    const parts: string[] = [];
    const tripLegs: { cls: string; colour: string; leg: Leg }[] = [
      ...(options.route ?? []).map(leg => ({ cls: 'city-route', colour: LINES.find(l => l.id === leg.line)!.colour, leg })),
      ...(options.route?.length ? [] : options.preview ?? []).map(leg => ({ cls: 'city-preview', colour: '#fffaf0', leg })),
    ];
    parts.push(...tripLegs.map((t, i) => `<path class="${t.cls}" data-trip="${i}" stroke="${t.colour}"/>`));
    // The castle is in the model itself; every other marker is a name on a card over where it stands.
    const queen = options.markers?.find(m => m.icon === 'bubbaloo');
    const key = queen ? `${queen.x},${queen.y},${queen.level},${queen.size},${queen.reach}` : '';
    if (key !== castleKey) {
      castleKey = key;
      const built = queen && castleGeometry(queen);
      swap(castle, built ? built.body.mesh(device) : empty()); swap(castleHalo, built ? built.halo.mesh(device) : empty());
    }
    // The famous places, home and the school as models, rebuilt when the story changes which stand.
    const models = (options.markers ?? []).filter(m => m !== queen && LANDMARK_MODELS[m.icon]);
    const modelsKey = models.map(m => `${m.id}:${m.icon}`).join();
    if (modelsKey !== placesKey) {
      placesKey = modelsKey;
      const g = new Geometry(8192, 16384);
      for (const m of models) {
        // Each model is built at its place, then grown LANDMARK_SCALE times round its foot.
        const k = LANDMARK_SCALE, grown: Sink = { reserve: (v, i) => g.reserve(v, i), tri: (a, b, c) => g.tri(a, b, c), quad: (a, b, c, d) => g.quad(a, b, c, d), vertex: (x, y, z, colour, shade, alpha) => g.vertex(m.x + (x - m.x) * k, y * k, m.y + (z - m.y) * k, colour, shade, alpha) };
        LANDMARK_MODELS[m.icon].build(grown, m.x, m.y);
        tops.set(m.id, LANDMARK_MODELS[m.icon].top * k);
      }
      swap(places, g.v ? g.mesh(device) : empty());
    }
    const cards: string[] = [];
    for (const m of options.markers ?? []) {
      if (m === queen) continue;
      cards.push(`<g class="city-landmark" data-landmark="${m.id}" data-icon="${m.icon}" data-at="${m.x},${m.y},0">`
        + `<line class="city-landmark-stem" y2="${-STEM}"/><circle class="city-landmark-foot" r="2.5"/>${card('city-card', m.name, -STEM)}<title>${escape(m.name)}</title></g>`);
    }
    // Every station is named, as on the plan in a station; the ones that matter a size up.
    for (const s of Object.values(STATIONS)) {
      const pickable = selectable.has(s.id), here = options.current === s.id, chosen = options.selected === s.id;
      const big = pickable || here, minor = !big && !named.has(s.id), interchange = (counts.get(s.id) ?? 1) > 1;
      const r = big ? 6.5 : interchange ? 5 : 3.8, size = big ? 15 : named.has(s.id) ? 13 : 11.5;
      const line = LINES.find(l => l.stations.includes(s.id))!;
      parts.push(`<g class="city-station${pickable ? ' is-pickable' : ''}${here ? ' is-here' : ''}${chosen ? ' is-selected' : ''}${minor ? ' is-minor' : ''}${interchange ? ' is-interchange' : ''}" data-station="${s.id}" data-at="${s.x},${s.y},${lineHeight(line.id) + 2}" style="--line:${line.colour}">`
        + `${pickable ? `<circle class="city-station-glow" r="${r * 2.4}"/>` : ''}<circle class="city-station-dot" r="${r}"/>`
        + `<text x="${r + 5}" y="${size * .35}" font-size="${size}">${escape(s.name)}</text><title>${escape(s.name)}</title></g>`);
    }
    // After the stations, so they keep their room and the cards lie over them.
    parts.push(...cards);
    if (options.current) {
      const s = STATIONS[options.current], line = LINES.find(l => l.stations.includes(s.id))!;
      parts.push(`<g class="city-pin" data-at="${s.x},${s.y},${lineHeight(line.id) + 2}"><circle class="city-pin-pulse" r="11"/>${card('city-card city-pin-card', 'Estás aquí', -14)}</g>`);
    }
    parts.push(`<g class="city-train" visibility="hidden"><circle r="7"/><circle class="city-train-core" r="3"/></g>`);
    overlay.setAttribute('role', 'img');
    overlay.setAttribute('aria-label', options.label ?? 'Plano de Barcelona con las líneas de metro');
    overlay.innerHTML = parts.join('');
    fitCards();
    trips = tripLegs.map((t, i) => ({ el: overlay.querySelector<SVGPathElement>(`[data-trip="${i}"]`)!, points: legPoints(t.leg) }));
    placeOverlay();
  }

  // The scene moves only when the camera does; the overlay follows it every frame it draws.
  let paused = false;
  let time = 0;
  app.on('update', (dt: number) => {
    place();
    // Her halo breathes, as on the flat plan.
    if (castleKey) { time += dt; halo.opacity = .75 + .25 * Math.sin(time * Math.PI * 2 / 3.2); halo.update(); }
  });
  app.on('postrender', placeOverlay);
  place();
  app.start();
  resize();

  /** The ground point under a pixel of the panel. */
  function groundAt(px: number, py: number) {
    const near = camera.camera!.screenToWorld(px, py, camera.camera!.nearClip), farP = camera.camera!.screenToWorld(px, py, camera.camera!.farClip);
    const t = near.y / (near.y - farP.y);
    return t > 0 && t < 1 ? { x: near.x + (farP.x - near.x) * t, y: near.z + (farP.z - near.z) * t } : undefined;
  }
  const set = (o: Orbit) => { orbit = clamp(o); place(); placeOverlay(); app.renderNextFrame = true; };

  return {
    get orbit() { return orbit; },
    set orbit(o: Orbit) { set(o); },
    get whole() { return whole(); },
    draw,
    train(at) { train = at; if (at) set({ ...orbit, x: orbit.x + (at.x - orbit.x) * .04, y: orbit.y + (at.y - orbit.y) * .04 }); else placeOverlay(); },
    frame(points, least = .42) {
      const xs = points.map(p => p.x), ys = points.map(p => p.y), w = whole();
      const r = host.getBoundingClientRect(), aspect = r.width && r.height ? r.width / r.height : 1.6;
      const span = Math.max((Math.max(...xs) - Math.min(...xs)) * 2.2, (Math.max(...ys) - Math.min(...ys)) * 2.2 * aspect, (extent.x1 - extent.x0) * least);
      const distance = span / aspect / (2 * Math.tan(FOV * Math.PI / 360));
      // Places all over the city (every line's playable stops): the whole of it from above, rather
      // than a low view that reaches past the model's edges.
      if (distance >= w.distance * .8) { set(w); return; }
      set({ x: (Math.min(...xs) + Math.max(...xs)) / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2 + span * .08, distance, yaw: w.yaw, pitch: .82 });
    },
    pan(dx, dy) {
      const k = scale() || .1, c = Math.cos(orbit.yaw), s = Math.sin(orbit.yaw);
      // Screen right is the camera's right on the ground; screen up is away from the camera.
      const right = -dx / k, away = dy / k / Math.max(.4, Math.sin(orbit.pitch));
      set({ ...orbit, x: orbit.x + right * c - away * s, y: orbit.y - right * s - away * c });
    },
    rotate(dx, dy) { set({ ...orbit, yaw: orbit.yaw - dx * .006, pitch: orbit.pitch + dy * .004 }); },
    zoom(factor, px, py) {
      const r = host.getBoundingClientRect();
      const at = groundAt(px ?? r.width / 2, py ?? r.height / 2);
      const next = clamp({ ...orbit, distance: orbit.distance * factor }), k = 1 - next.distance / orbit.distance;
      set(at ? { ...next, x: orbit.x + (at.x - orbit.x) * k, y: orbit.y + (at.y - orbit.y) * k } : next);
    },
    // Paused, the model stops its frame loop altogether: a running PlayCanvas app makes itself the
    // current one every frame, and entities the game creates between frames (the place a ride
    // arrives at) would join this app instead of the game's and never be drawn.
    pause(value) {
      paused = value; app.autoRender = !paused;
      if (paused) { cancelAnimationFrame(app.frameRequestId); app.frameRequestId = null; }
      else { resize(); app.renderNextFrame = true; if (!app.frameRequestId) app.requestAnimationFrame(); }
    },
    destroy() { observer.disconnect(); app.destroy(); canvas.remove(); overlay.remove(); },
  };
}
