import * as pc from 'playcanvas';
import type { GeoPoint } from './geo';
import type { GeoKit } from './geo-scenery';
import { shine } from './lighting';

/**
 * The sea of a beach place (`look.water: "sea"`, docs/environment-styling.md § The sea): instead of
 * the river's flat water, the zone's water polygon gives its coastline, and everything follows it in
 * bands measured from the waterline, so the miniature reads like the real shore seen from above:
 *
 * - the sea itself, turquoise over the sand at the shore and deep blue further out, carrying on past
 *   the map's edges to the frame; two layers of small waves scroll over it and glitter in the sun;
 * - the wet sand, a dark band a few metres wide along the waterline;
 * - two or three lines of white water rolling in and fading as they reach the shore;
 * - the swash: a thin sheet of water that runs up the wet band, leaves a lace of foam at its edge
 *   and slides back, about every seven seconds, two waves out of step;
 * - higher up the dry sand, the morning's tracks of the cleaning tractor and people's footprints.
 *
 * Distances are metres from the waterline (+ out to sea, − up the beach); the coastline is the edge
 * of the water polygon that is not the map's own edge, resampled every couple of metres.
 */
const LAYER = { tracks: 0.017, sea: 0.028, wet: 0.031, breakers: 0.034, swash: 0.037 };
/** Bands across the shore, metres from the waterline. */
const SEA_OUT = 260, WET_IN = -5, BREAKERS = [0.6, 24] as const, SWASH = [3, -7] as const;
/** The sea's colour by distance from the shore: sand showing through, turquoise, then deep blue. */
const DEPTHS: [number, string][] = [[0, '#86c9bd'], [2.5, '#5bb5b0'], [9, '#3f9fa6'], [24, '#2f86a0'], [55, '#22698e'], [SEA_OUT, '#1b557a']];
/** Seconds for one wave to run up the sand and slide back; the white water rolls in on the same beat. */
const CYCLE = 7.2;
/** Metres between two lines of white water, and how fast they roll in (m/s). */
const BREAKER_GAP = 8.5, BREAKER_SPEED = BREAKER_GAP / CYCLE;
/** Metres one picture of tractor tracks and footprints covers, along and across the beach. */
const TRACKS = [64, 40];
/** How far past the map's side edges the coast and its sea carry on, in cells. */
const BEYOND = 160;

interface Shore { points: GeoPoint[]; normals: GeoPoint[]; along: number[] }

/** Builds the sea and its shore; `wet` is the wet sand's material (the zone's `wet` surface). */
export function buildSea(kit: GeoKit, water: GeoPoint[][], size: { width: number; depth: number; cell: number }, wet: pc.StandardMaterial) {
  const { app, root, x, z } = kit;
  const device = app.graphicsDevice, cellM = size.cell;
  const meshes: pc.Mesh[] = [], textures: pc.Texture[] = [];
  const shore = coastline(water, size.width, size.depth, cellM);
  if (!shore) return undefined;

  // The sea and its white water carry on past the map's sides; the beach's bands stop at its edges.
  const first = Math.max(0, shore.points.findIndex(p => p[0] >= -0.5));
  const last = shore.points.length - 1 - Math.max(0, [...shore.points].reverse().findIndex(p => p[0] <= size.width - 0.5));
  /** One band along the shore: rows at `d` metres, each with its colour and opacity; `beach` keeps it on the map. */
  function band(name: string, rows: { d: number; colour?: string; alpha?: number }[], y: number, m: pc.Material, batched: boolean, beach = false) {
    const positions: number[] = [], normals: number[] = [], uvs: number[] = [], colours: number[] = [], indices: number[] = [];
    const points = beach ? shore!.points.slice(first, last + 1) : shore!.points, offset = beach ? first : 0, n = points.length;
    rows.forEach(({ d, colour = '#ffffff', alpha = 1 }) => {
      const c = new pc.Color().fromString(colour);
      points.forEach((p, k) => {
        const i = k + offset, q = shore!.normals[i];
        positions.push(x(p[0] + q[0] * d / cellM), y, z(p[1] + q[1] * d / cellM));
        normals.push(0, 1, 0); uvs.push(shore!.along[i], d); colours.push(c.r, c.g, c.b, alpha);
      });
    });
    for (let r = 0; r + 1 < rows.length; r++) for (let i = 0; i + 1 < n; i++) {
      const a = r * n + i, b = a + 1, c = a + n, e = c + 1;
      // Rows run seaward with d, so this winding faces up.
      if (rows[r + 1].d > rows[r].d) indices.push(a, c, b, b, c, e); else indices.push(a, b, c, b, e, c);
    }
    const mesh = new pc.Mesh(device);
    mesh.setPositions(positions); mesh.setNormals(normals); mesh.setUvs(0, uvs); mesh.setColors(colours); mesh.setIndices(indices); mesh.update();
    meshes.push(mesh);
    const e = new pc.Entity(name);
    e.addComponent('render', { meshInstances: [new pc.MeshInstance(mesh, m)], castShadows: false, receiveShadows: true, ...(batched ? { batchGroupId: kit.batch } : {}) });
    root.addChild(e);
    return e;
  }
  function canvasTexture(w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void, clampV = false) {
    const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d')!);
    const t = new pc.Texture(device, { width: w, height: h, mipmaps: true, anisotropy: 8, addressU: pc.ADDRESS_REPEAT, addressV: clampV ? pc.ADDRESS_CLAMP_TO_EDGE : pc.ADDRESS_REPEAT });
    t.setSource(c); textures.push(t); return t;
  }

  // ------------------------------------------------------------ the sea
  // Its colour is in the vertices (by depth); small waves in two normal maps drifting across each other.
  const sea = new pc.StandardMaterial();
  sea.name = 'Mar'; sea.diffuse.set(1, 1, 1); sea.diffuseVertexColor = true; sea.gloss = 0.86;
  const ripples = canvasTexture(256, 256, ctx => waveNormals(ctx, 256));
  sea.normalMap = ripples; sea.normalMapTiling.set(1 / 7, 1 / 7); sea.bumpiness = 0.3;
  sea.normalDetailMap = ripples; sea.normalDetailMapTiling.set(1 / 2.6, 1 / 3.1); sea.normalDetailMapBumpiness = 0.35;
  // Less of the sky and the sun than a pool: the sea keeps its own blue, and the sun glitters on it
  // without burning a white patch into the overview.
  shine(sea, 'water'); sea.specular.fromString('#55605f'); sea.reflectivity = 0.5; sea.update();
  band('Mar', DEPTHS.map(([d, colour]) => ({ d, colour })), LAYER.sea, sea, false);

  // ------------------------------------------------------------ the wet sand
  // Fades in from the dry sand to the waterline, glossier as it nears the water.
  wet.opacityVertexColor = true; wet.opacityVertexColorChannel = 'a'; wet.blendType = pc.BLEND_NORMAL; wet.depthWrite = false; wet.update();
  band('Arena mojada', [{ d: WET_IN, alpha: 0 }, { d: WET_IN * 0.55, alpha: 0.7 }, { d: -1.2, alpha: 0.95 }, { d: 0.02, alpha: 1 }], LAYER.wet, wet, false, true);

  // ------------------------------------------------------------ tracks on the dry sand
  // The cleaning tractor's tyre tracks running along the beach, and footprints across them.
  const trodden = new pc.StandardMaterial();
  trodden.name = 'Rodadas'; trodden.diffuse.set(1, 1, 1); trodden.diffuseMap = canvasTexture(1024, 512, ctx => tracks(ctx, 1024, 512));
  trodden.opacityMap = trodden.diffuseMap; trodden.opacityMapChannel = 'a'; trodden.opacityVertexColor = true; trodden.opacityVertexColorChannel = 'a';
  trodden.blendType = pc.BLEND_NORMAL; trodden.depthWrite = false; trodden.gloss = 0.05;
  trodden.diffuseMapTiling.set(1 / TRACKS[0], 1 / TRACKS[1]); trodden.opacityMapTiling.copy(trodden.diffuseMapTiling); trodden.update();
  band('Rodadas', [{ d: -46, alpha: 0 }, { d: -40, alpha: 0.9 }, { d: -10, alpha: 0.9 }, { d: -6.5, alpha: 0 }], LAYER.tracks, trodden, true, true);

  // ------------------------------------------------------------ white water
  // Lines of foam with their leading edge towards the shore, scrolling in, fading out where they die.
  const foam = canvasTexture(512, 128, ctx => breakerFoam(ctx, 512, 128));
  const breakers = new pc.StandardMaterial();
  breakers.name = 'Rompientes'; breakers.diffuse.set(1, 1, 1); breakers.diffuseMap = foam; breakers.opacityMap = foam; breakers.opacityMapChannel = 'a';
  breakers.opacityVertexColor = true; breakers.opacityVertexColorChannel = 'a';
  breakers.blendType = pc.BLEND_NORMAL; breakers.depthWrite = false; breakers.gloss = 0.5; breakers.emissive.set(0.12, 0.13, 0.13);
  breakers.diffuseMapTiling.set(1 / 26, 1 / BREAKER_GAP); breakers.opacityMapTiling.copy(breakers.diffuseMapTiling); breakers.update();
  const [b0, b1] = BREAKERS;
  band('Rompientes', [{ d: b0, alpha: 0.25 }, { d: 2.2, alpha: 0.85 }, { d: 9, alpha: 1 }, { d: 16, alpha: 0.6 }, { d: b1, alpha: 0 }], LAYER.breakers, breakers, false);

  // ------------------------------------------------------------ the swash
  // A sheet of water with a lace of foam at its edge; its texture slides up and down the band.
  const [s0, s1] = SWASH, span = s0 - s1;
  const sheet = canvasTexture(512, 256, ctx => swashSheet(ctx, 512, 256), true);
  const waves = [0, 0.5].map((phase, k) => {
    const m = new pc.StandardMaterial();
    m.name = `Ola ${k + 1}`; m.diffuse.set(1, 1, 1); m.diffuseMap = sheet; m.opacityMap = sheet; m.opacityMapChannel = 'a';
    m.opacityVertexColor = true; m.opacityVertexColorChannel = 'a';
    m.blendType = pc.BLEND_NORMAL; m.depthWrite = false; m.gloss = 0.9; m.emissive.set(0.1, 0.11, 0.11); shine(m, 'water');
    // v counts from the sea end of the band (0) to its land end (1), one band per texture.
    m.diffuseMapTiling.set(1 / 30, -1 / span); m.opacityMapTiling.copy(m.diffuseMapTiling); m.update();
    band(`Ola ${k + 1}`, [{ d: s0, alpha: 0 }, { d: 1.2, alpha: 1 }, { d: s1, alpha: 1 }], LAYER.swash + k * 0.002, m, false, true);
    return { m, phase, reach: 0.8, shift: k * 0.37 };
  });

  let time = 0;
  /** Where a wave's edge is over its cycle (0–1): it runs up fast, slides back slower, then rests. */
  const runUp = (t: number) => t < 0.28 ? 1 - (1 - t / 0.28) ** 2.4 : t < 0.78 ? 1 - ((t - 0.28) / 0.5) ** 1.6 : 0;
  function animate(dt: number) {
    time += dt;
    sea.normalMapOffset.set(time * 0.035, time * 0.06); sea.normalDetailMapOffset.set(-time * 0.05, time * 0.025); sea.update();
    // White water rolls towards the shore: the texture slides out to sea in v.
    breakers.diffuseMapOffset.set(Math.sin(time * 0.05) * 0.3, time * BREAKER_SPEED / BREAKER_GAP); breakers.opacityMapOffset.copy(breakers.diffuseMapOffset); breakers.update();
    for (const w of waves) {
      const t = time / CYCLE + w.phase, cycle = Math.floor(t), k = t - cycle;
      // Each wave reaches a little further or shorter, with its lace in a new place.
      if (k < 0.02) { w.reach = 0.55 + noise(cycle * 7 + w.phase * 13) * 0.45; w.shift = noise(cycle * 3 + w.phase * 5); }
      // The texture's edge sits half-way (v .5); the band's v runs from the sea (0) to the land (1).
      const edge = 0.3 + runUp(k) * w.reach * 0.62;
      w.m.diffuseMapOffset.set(w.shift, s0 / span + 0.5 - edge); w.m.opacityMapOffset.copy(w.m.diffuseMapOffset); w.m.update();
    }
  }
  animate(0);
  return {
    update(dt: number, moving: boolean) { if (moving) animate(dt); },
    destroy() { meshes.forEach(m => m.destroy()); textures.forEach(t => t.destroy()); [sea, wet, breakers, ...waves.map(w => w.m)].forEach(m => m.destroy()); },
  };
}

const noise = (i: number) => { const v = Math.sin(i * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };

/**
 * The coastline: the longest run of the water polygons' edges that is not the map's border, turned
 * to run along +x with the sea on its +z side, carried on straight past both side edges, resampled
 * about every two metres; with smoothed normals pointing out to sea and the length along it (metres).
 */
export function coastline(water: GeoPoint[][], width: number, depth: number, cell = 1.5): Shore | undefined {
  const onBorder = (p: GeoPoint) => Math.abs(p[0] + 0.5) < 0.02 || Math.abs(p[0] - (width - 0.5)) < 0.02 || Math.abs(p[1] + 0.5) < 0.02 || Math.abs(p[1] - (depth - 0.5)) < 0.02;
  let best: GeoPoint[] = [];
  for (const poly of water) {
    const n = poly.length;
    // Start the walk on a border edge, so a run is never split where the ring closes.
    const start = poly.findIndex((p, i) => onBorder(p) && onBorder(poly[(i + 1) % n]));
    if (start < 0) continue;
    let run: GeoPoint[] = [];
    for (let k = 1; k <= n; k++) {
      const a = poly[(start + k) % n], b = poly[(start + k + 1) % n];
      if (onBorder(a) && onBorder(b)) { if (run.length > best.length) best = run; run = []; continue; }
      if (!run.length) run.push(a);
      run.push(b);
    }
    if (run.length > best.length) best = run;
  }
  if (best.length < 2) return undefined;
  if (best[0][0] > best[best.length - 1][0]) best = [...best].reverse();
  // Carry the coast on past the map's sides, so the sea fills the frame.
  const line: GeoPoint[] = [[best[0][0] - BEYOND, best[0][1]], ...best, [best[best.length - 1][0] + BEYOND, best[best.length - 1][1]]];
  const points: GeoPoint[] = [], step = 2 / cell;
  for (let i = 0; i + 1 < line.length; i++) {
    const [a, b] = [line[i], line[i + 1]], len = Math.hypot(b[0] - a[0], b[1] - a[1]), count = Math.max(1, Math.ceil(len / step));
    for (let k = 0; k < count; k++) points.push([a[0] + (b[0] - a[0]) * k / count, a[1] + (b[1] - a[1]) * k / count]);
  }
  points.push(line[line.length - 1]);
  // Each point's normal is the mean of the segments a few points either side, turned out to sea (+z).
  const normals = points.map((_, i) => {
    const a = points[Math.max(0, i - 3)], b = points[Math.min(points.length - 1, i + 3)];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    return [-(b[1] - a[1]) / len, (b[0] - a[0]) / len];
  });
  const along = [0];
  for (let i = 1; i < points.length; i++) along.push(along[i - 1] + Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]) * cell);
  return { points, normals, along };
}

/** A tileable field of small wind waves as a normal map: a few crossing swells and a fine chop. */
function waveNormals(ctx: CanvasRenderingContext2D, size: number) {
  const h = new Float32Array(size * size);
  const swells: [number, number, number, number][] = [[3, 1, 1, 0], [2, -3, 0.6, 1.3], [5, 2, 0.45, 2.1], [-4, 5, 0.35, 0.4], [9, -2, 0.2, 3.3], [7, 8, 0.15, 5.1]];
  for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
    let v = 0;
    for (const [fx, fy, amp, ph] of swells) v += amp * Math.sin((fx * i + fy * j) / size * Math.PI * 2 + ph);
    // Fine chop: a sharpened sum, so crests are narrow like real ripples.
    v += 0.25 * Math.abs(Math.sin((13 * i + 11 * j) / size * Math.PI * 2 + noise(j) * 0.4)) ** 3;
    h[j * size + i] = v;
  }
  const img = ctx.createImageData(size, size), at = (i: number, j: number) => h[((j + size) % size) * size + ((i + size) % size)];
  for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
    const dx = (at(i + 1, j) - at(i - 1, j)) * 1.6, dy = (at(i, j + 1) - at(i, j - 1)) * 1.6, len = Math.hypot(dx, dy, 1);
    const o = (j * size + i) * 4;
    img.data[o] = (-dx / len * 0.5 + 0.5) * 255; img.data[o + 1] = (-dy / len * 0.5 + 0.5) * 255; img.data[o + 2] = (1 / len * 0.5 + 0.5) * 255; img.data[o + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
}

/**
 * One line of white water per texture height (v grows out to sea): a bright, ragged leading edge on
 * the shore side, then the churned foam behind it thinning into streaks and holes.
 */
function breakerFoam(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.clearRect(0, 0, w, h);
  for (let i = 0; i < w; i += 2) {
    const wobble = Math.sin(i / w * Math.PI * 6) * 4 + Math.sin(i / w * Math.PI * 22 + 1.3) * 2 + (noise(i) - 0.5) * 3;
    const lead = 18 + wobble, thick = 5 + noise(i + 900) * 6;
    const g = ctx.createLinearGradient(0, lead - 2, 0, lead + thick + 46);
    g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.04, 'rgba(255,255,255,.95)');
    g.addColorStop(0.16, 'rgba(244,250,250,.85)'); g.addColorStop(0.45, 'rgba(232,244,244,.32)'); g.addColorStop(1, 'rgba(232,244,244,0)');
    ctx.fillStyle = g; ctx.fillRect(i, lead - 2, 2, thick + 48);
  }
  // Holes and streaks in the churned water behind the edge.
  ctx.globalCompositeOperation = 'destination-out';
  for (let k = 0; k < 260; k++) {
    ctx.fillStyle = `rgba(0,0,0,${0.35 + noise(k + 50) * 0.5})`;
    ctx.beginPath(); ctx.ellipse(noise(k) * w, 30 + noise(k + 300) * 40, 3 + noise(k + 600) * 9, 1.5 + noise(k + 700) * 3, 0, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalCompositeOperation = 'source-over';
}

/**
 * The swash, from the sea (top rows) to the sand (bottom): a thin glassy sheet of water, a lace of
 * foam at its edge half-way down, and nothing beyond, so sliding it in v runs the wave up and back.
 */
function swashSheet(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.clearRect(0, 0, w, h);
  const edge = h / 2;
  const sheet = ctx.createLinearGradient(0, 0, 0, edge);
  sheet.addColorStop(0, 'rgba(214,240,238,.55)'); sheet.addColorStop(1, 'rgba(226,246,244,.35)');
  for (let i = 0; i < w; i += 2) {
    const reach = edge + Math.sin(i / w * Math.PI * 4 + 0.7) * 7 + Math.sin(i / w * Math.PI * 14) * 3 + (noise(i + 40) - 0.5) * 3;
    ctx.fillStyle = sheet; ctx.fillRect(i, 0, 2, reach);
    // The lace: a bright rim with a softer foam just behind it.
    ctx.fillStyle = 'rgba(255,255,255,.95)'; ctx.fillRect(i, reach - 3 - noise(i) * 2, 2, 3 + noise(i) * 2);
    ctx.fillStyle = 'rgba(250,253,253,.55)'; ctx.fillRect(i, reach - 12 - noise(i + 7) * 6, 2, 8);
  }
  ctx.globalCompositeOperation = 'destination-out';
  for (let k = 0; k < 140; k++) {
    ctx.fillStyle = `rgba(0,0,0,${0.4 + noise(k + 90) * 0.4})`;
    ctx.beginPath(); ctx.ellipse(noise(k + 11) * w, edge - 14 + noise(k + 222) * 10, 2 + noise(k + 3) * 5, 1 + noise(k + 4) * 2, 0, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalCompositeOperation = 'source-over';
}

/**
 * The dry sand's marks, tiling along the beach: three passes of the cleaning tractor (pairs of tyre
 * tracks with their treads, wavering as it steers), then footprints wandering across them.
 */
function tracks(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.clearRect(0, 0, w, h);
  const pxU = w / TRACKS[0], pxV = h / TRACKS[1];
  for (const [y0, amp, phase, waves] of [[0.22, 1.2, 0.4, 1], [0.48, 0.8, 2.1, 2], [0.71, 1.5, 4, 1]] as const) {
    // Each tyre: a darker groove with paler, ridged edges; the waves divide the tile, so it repeats.
    for (const tyre of [-0.95, 0.95]) for (let i = 0; i < w; i += 2) {
      const y = (y0 * TRACKS[1] + tyre + amp * Math.sin(i / w * Math.PI * 2 * waves + phase)) * pxV;
      ctx.fillStyle = 'rgba(122,98,62,.2)'; ctx.fillRect(i, y - 0.22 * pxV, 2, 0.44 * pxV);
      ctx.fillStyle = 'rgba(255,248,230,.16)'; ctx.fillRect(i, y - 0.32 * pxV, 2, 0.08 * pxV); ctx.fillRect(i, y + 0.24 * pxV, 2, 0.08 * pxV);
      if (i % 6 === 0) { ctx.fillStyle = 'rgba(110,88,55,.16)'; ctx.fillRect(i, y - 0.22 * pxV, 1.5, 0.44 * pxV); }
    }
  }
  // Footprints: pairs of small ovals walking in a few directions, fainter where older.
  for (let k = 0; k < 9; k++) {
    let px = noise(k + 400) * w, py = noise(k + 500) * h;
    const a = noise(k + 600) * Math.PI * 2, steps = 14 + Math.floor(noise(k + 700) * 20), age = 0.08 + noise(k + 800) * 0.1;
    for (let j = 0; j < steps; j++) {
      const side = j % 2 ? 1 : -1, sx = Math.cos(a + Math.PI / 2) * 0.12 * pxU * side, sy = Math.sin(a + Math.PI / 2) * 0.12 * pxV * side;
      ctx.fillStyle = `rgba(112,90,58,${age})`;
      ctx.beginPath(); ctx.ellipse((px + sx + w) % w, (py + sy + h) % h, 0.14 * pxU, 0.07 * pxV, a, 0, Math.PI * 2); ctx.fill();
      px += Math.cos(a) * 0.7 * pxU; py += Math.sin(a) * 0.7 * pxV;
    }
  }
}
