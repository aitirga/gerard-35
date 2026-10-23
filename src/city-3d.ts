/**
 * Barcelona's network map as a 3D model of the real city (docs/barcelona.md § The network map):
 * the ground lies flat (`public/maps/barcelona.webp`: streets, parks, beaches and the sea), every
 * building from OpenStreetMap stands on it at its height (`public/maps/barcelona-buildings.bin`,
 * `just city-fetch-buildings`), and the metro lines run over the roofs as thick cartoon ribbons
 * on posts. Stations, names, markers, the pin and the train are drawn over the picture in one SVG,
 * placed every frame where the camera sees them, so they stay upright and readable.
 *
 * Map metres as everywhere (x right along the coast, y down towards the sea): in the scene x is
 * X, y is Z and up is Y. The camera orbits a point on the ground; `travel-ui.ts` drives it.
 * Falls back to the flat SVG (`city-map.ts`) when WebGL or the data are missing.
 */
import * as pc from 'playcanvas';
import { CITY_MAP, LINES, STATIONS, type Leg } from './transit';
import { renderMarker } from './map-markers';
import type { CityMapOptions } from './city-map';

const BASE = (import.meta as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? './';
const escape = (text: string) => text.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const INK = '#3b2a20';

/** Buildings stand this many times their real height, so the city still reads from high up. */
const STRETCH = 2.4;
/** The lines run this high over the ground (m), each a little above the one before; this wide. */
const LINE_Y = 170, LINE_STEP = 8, LINE_W = 90, LINE_DEPTH = 22;
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
 */
function buildingChunks(data: Int16Array, bounds: { x0: number; y0: number; x1: number; y1: number }) {
  const chunks = Array.from({ length: CHUNKS * CHUNKS }, () => new Geometry(4096, 8192));
  const cw = (bounds.x1 - bounds.x0) / CHUNKS, chh = (bounds.y1 - bounds.y0) / CHUNKS;
  const xs: number[] = [], zs: number[] = [], roof: number[] = [];
  for (let o = 0, n = 0; o < data.length; o += 3 + data[o + 2] * 2, n++) {
    const height = data[o] * STRETCH, kind = data[o + 1], count = data[o + 2];
    xs.length = zs.length = roof.length = 0;
    let area = 0;
    for (let i = 0; i < count; i++) { xs.push(data[o + 3 + i * 2]); zs.push(data[o + 4 + i * 2]); }
    for (let i = 0, j = count - 1; i < count; j = i++) area += xs[j] * zs[i] - xs[i] * zs[j];
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

/**
 * The lines as slabs over the roofs: the top in the line's colour, the sides in dark ink, a round
 * joint at every station, a post down to the street under each station, and a soft shadow on the
 * ground, cast to the right as the light comes from the left.
 */
function lineGeometry() {
  const slab = new Geometry(), shadow = new Geometry();
  const ink = rgb(INK);
  const ribbon = (g: Geometry, pts: number[][], y: number, w: number, colour: number[], sides: boolean, alpha = 255) => {
    for (let i = 0; i + 1 < pts.length; i++) {
      const [ax, az] = pts[i], [bx, bz] = pts[i + 1], len = Math.hypot(bx - ax, bz - az) || 1;
      const px = -(bz - az) / len * w / 2, pz = (bx - ax) / len * w / 2;
      g.reserve(12, 18);
      g.quad(g.vertex(ax + px, y, az + pz, colour, 1, alpha), g.vertex(bx + px, y, bz + pz, colour, 1, alpha), g.vertex(bx - px, y, bz - pz, colour, 1, alpha), g.vertex(ax - px, y, az - pz, colour, 1, alpha));
      if (!sides) continue;
      for (const s of [1, -1]) g.quad(g.vertex(ax + px * s, y, az + pz * s, ink), g.vertex(bx + px * s, y, bz + pz * s, ink), g.vertex(bx + px * s, y - LINE_DEPTH, bz + pz * s, ink, .8), g.vertex(ax + px * s, y - LINE_DEPTH, az + pz * s, ink, .8));
    }
    for (const [x, z] of pts) {
      const sides_ = 16, r = w / 2;
      g.reserve(sides_ * 5 + 1, sides_ * 9);
      const centre = g.vertex(x, y + .5, z, colour, 1, alpha);
      const ring = Array.from({ length: sides_ }, (_, k) => g.vertex(x + Math.cos(k / sides_ * Math.PI * 2) * r, y + .5, z + Math.sin(k / sides_ * Math.PI * 2) * r, colour, 1, alpha));
      for (let k = 0; k < sides_; k++) g.tri(centre, ring[k], ring[(k + 1) % sides_]);
      if (sides) for (let k = 0; k < sides_; k++) {
        const a0 = k / sides_ * Math.PI * 2, a1 = (k + 1) / sides_ * Math.PI * 2;
        g.quad(g.vertex(x + Math.cos(a0) * r, y, z + Math.sin(a0) * r, ink), g.vertex(x + Math.cos(a1) * r, y, z + Math.sin(a1) * r, ink),
          g.vertex(x + Math.cos(a1) * r, y - LINE_DEPTH, z + Math.sin(a1) * r, ink, .8), g.vertex(x + Math.cos(a0) * r, y - LINE_DEPTH, z + Math.sin(a0) * r, ink, .8));
      }
    }
  };
  LINES.forEach((line, i) => {
    const pts = line.stations.map(id => [STATIONS[id].x, STATIONS[id].y]);
    const y = LINE_Y + i * LINE_STEP;
    ribbon(slab, pts, y, LINE_W, rgb(line.colour), true);
    ribbon(shadow, pts.map(([x, z]) => [x + y * .55, z - y * .2]), 3, LINE_W * 1.1, ink, false, 255);
  });
  // A post under every station: where on the street it is.
  for (const s of Object.values(STATIONS)) {
    const y = LINE_Y + Math.max(0, LINES.findIndex(l => l.stations.includes(s.id))) * LINE_STEP - LINE_DEPTH, r = 7;
    slab.reserve(16, 24);
    for (const [dx, dz, shade] of [[1, 0, .7], [0, 1, .85], [-1, 0, 1], [0, -1, .75]] as const) {
      const ax = s.x + (dx - dz) * r, az = s.y + (dz + dx) * r, bx = s.x + (dx + dz) * r, bz = s.y + (dz - dx) * r;
      slab.quad(slab.vertex(ax, 0, az, ink, shade), slab.vertex(bx, 0, bz, ink, shade), slab.vertex(bx, y, bz, ink, shade), slab.vertex(ax, y, az, ink, shade));
    }
  }
  return { slab, shadow };
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

/** Builds the model in `host` (the travel panel's map box); undefined if WebGL is not there. */
export function createCity3D(host: HTMLElement): City3D | undefined {
  const background = CITY_MAP.background, buildings = (CITY_MAP as { buildings?: { href: string } }).buildings;
  if (!background || !buildings) return undefined;
  const canvas = document.createElement('canvas');
  canvas.className = 'city-3d';
  host.append(canvas);
  let app: pc.Application;
  try {
    app = new pc.Application(canvas, { graphicsDeviceOptions: { antialias: true, alpha: false } });
  } catch {
    canvas.remove();
    return undefined;
  }
  const device = app.graphicsDevice;
  device.maxPixelRatio = Math.min(2, window.devicePixelRatio);
  app.setCanvasFillMode(pc.FILLMODE_NONE);
  app.setCanvasResolution(pc.RESOLUTION_AUTO);
  const overlay = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  overlay.classList.add('city-overlay');
  host.append(overlay);
  const resize = () => { const r = host.getBoundingClientRect(); if (r.width && r.height) app.resizeCanvas(r.width, r.height); };
  const observer = new ResizeObserver(resize);
  observer.observe(host);

  const unlit = (blend = false) => {
    const m = new pc.StandardMaterial();
    m.useLighting = false; m.diffuse.set(0, 0, 0); m.emissive.set(1, 1, 1); m.emissiveVertexColor = true;
    m.cull = pc.CULLFACE_NONE;
    if (blend) { m.blendType = pc.BLEND_NORMAL; m.opacity = .16; m.depthWrite = false; }
    m.update();
    return m;
  };
  const solid = unlit(), shade = unlit(true);
  const add = (name: string, mesh: pc.Mesh, material: pc.Material) => {
    const e = new pc.Entity(name);
    e.addComponent('render', { meshInstances: [new pc.MeshInstance(mesh, material)], castShadows: false, receiveShadows: false });
    app.root.addChild(e);
    return e;
  };

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
  void fetch(`${BASE}${buildings.href}`).then(r => r.ok ? r.arrayBuffer() : Promise.reject(new Error(r.statusText))).then(buffer => {
    buildingChunks(new Int16Array(buffer), background).forEach((g, i) => add(`Edificios ${i + 1}`, g.mesh(device), solid));
  }).catch(error => console.warn('No buildings for the city map', error));
  const { slab, shadow } = lineGeometry();
  add('Sombra de las líneas', shadow.mesh(device), shade);
  add('Líneas', slab.mesh(device), solid);

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
    const iconScale = 22 * Math.min(1.7, Math.max(.75, Math.pow(k / .1, .3)));
    for (const el of overlay.querySelectorAll<SVGGElement>('[data-at]')) {
      const [x, y, h] = el.dataset.at!.split(',').map(Number);
      const p = project(x, y, h);
      if (!p) { el.setAttribute('visibility', 'hidden'); continue; }
      el.removeAttribute('visibility');
      el.setAttribute('transform', `translate(${p[0].toFixed(1)} ${p[1].toFixed(1)})${el.classList.contains('map-marker-slot') ? ` scale(${iconScale.toFixed(2)})` : ''}`);
    }
    for (const t of trips) {
      const pts = t.points.map(([x, y, h]) => project(x, y, h)).filter((p): p is number[] => !!p);
      t.el.setAttribute('d', pts.length > 1 ? `M${pts.map(p => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join('L')}` : '');
    }
    const dot = overlay.querySelector<SVGCircleElement>('.city-train');
    if (dot) {
      const p = train && project(train.x, train.y, LINE_Y + LINE_STEP + 4);
      if (p) { dot.setAttribute('cx', p[0].toFixed(1)); dot.setAttribute('cy', p[1].toFixed(1)); dot.removeAttribute('visibility'); }
      else dot.setAttribute('visibility', 'hidden');
    }
  }
  const lineHeight = (id: string) => LINE_Y + Math.max(0, LINES.findIndex(l => l.id === id)) * LINE_STEP;
  const legPoints = (leg: Leg) => leg.stations.map(id => [STATIONS[id].x, STATIONS[id].y, lineHeight(leg.line) + 2]);

  function draw(options: CityMapOptions) {
    const selectable = new Set(options.selectable ?? []);
    const counts = new Map<string, number>();
    for (const line of LINES) for (const id of line.stations) counts.set(id, (counts.get(id) ?? 0) + 1);
    const named = new Set([...LINES.flatMap(l => [l.stations[0], l.stations.at(-1)!]), ...[...counts].filter(([, n]) => n > 1).map(([id]) => id)]);
    const parts = [`<defs><radialGradient id="queen-halo"><stop offset=".25" stop-color="#ff6fae" stop-opacity="0"/><stop offset=".62" stop-color="#ff6fae" stop-opacity=".5"/><stop offset=".8" stop-color="#ff9fcb" stop-opacity=".22"/><stop offset="1" stop-color="#ff9fcb" stop-opacity="0"/></radialGradient></defs>`];
    const tripLegs: { cls: string; colour: string; leg: Leg }[] = [
      ...(options.route ?? []).map(leg => ({ cls: 'city-route', colour: LINES.find(l => l.id === leg.line)!.colour, leg })),
      ...(options.route?.length ? [] : options.preview ?? []).map(leg => ({ cls: 'city-preview', colour: '#fffaf0', leg })),
    ];
    parts.push(...tripLegs.map((t, i) => `<path class="${t.cls}" data-trip="${i}" stroke="${t.colour}"/>`));
    // Markers stand on the ground, upright, a little over the roofs round them.
    for (const m of options.markers ?? []) parts.push(`<g class="map-marker-slot" data-at="${m.x},${m.y},60">${renderMarker({ ...m, x: 0, y: -1 }, 1)}</g>`);
    // Every station is named, as on the plan in a station; the ones that matter a size up.
    for (const s of Object.values(STATIONS)) {
      const pickable = selectable.has(s.id), here = options.current === s.id, chosen = options.selected === s.id;
      const big = pickable || here, minor = !big && !named.has(s.id);
      const r = big ? 9 : (counts.get(s.id) ?? 1) > 1 ? 7.5 : 5.5, size = big ? 17 : named.has(s.id) ? 14 : 12;
      const line = LINES.find(l => l.stations.includes(s.id))!;
      parts.push(`<g class="city-station${pickable ? ' is-pickable' : ''}${here ? ' is-here' : ''}${chosen ? ' is-selected' : ''}${minor ? ' is-minor' : ''}" data-station="${s.id}" data-at="${s.x},${s.y},${lineHeight(line.id) + 2}">`
        + `${pickable ? `<circle class="city-station-glow" r="${r * 2.2}"/>` : ''}<circle r="${r}" stroke-width="3"/>`
        + `<text x="${r + 6}" y="${size * .36}" font-size="${size}">${escape(s.name)}</text><title>${escape(s.name)}</title></g>`);
    }
    if (options.current) {
      const s = STATIONS[options.current], line = LINES.find(l => l.stations.includes(s.id))!;
      parts.push(`<g class="city-pin" data-at="${s.x},${s.y},${lineHeight(line.id) + 2}"><path d="M0,0L-11,-22A14,14,0,1,1,11,-22Z" stroke-width="3"/><text y="-26" font-size="13">G</text>`
        + `<text class="city-pin-label" y="-48" font-size="14" stroke-width="4">Estás aquí</text></g>`);
    }
    parts.push(`<circle class="city-train" r="9" visibility="hidden"/>`);
    overlay.setAttribute('role', 'img');
    overlay.setAttribute('aria-label', options.label ?? 'Plano de Barcelona con las líneas de metro');
    overlay.innerHTML = parts.join('');
    trips = tripLegs.map((t, i) => ({ el: overlay.querySelector<SVGPathElement>(`[data-trip="${i}"]`)!, points: legPoints(t.leg) }));
    placeOverlay();
  }

  // The scene moves only when the camera does; the overlay follows it every frame it draws.
  let paused = false;
  app.on('update', () => { place(); });
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
      set({ x: (Math.min(...xs) + Math.max(...xs)) / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2 + span * .08, distance: span / aspect / (2 * Math.tan(FOV * Math.PI / 360)), yaw: w.yaw, pitch: .82 });
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
    pause(value) { paused = value; app.autoRender = !paused; if (!paused) { resize(); app.renderNextFrame = true; } },
    destroy() { observer.disconnect(); app.destroy(); canvas.remove(); overlay.remove(); },
  };
}
