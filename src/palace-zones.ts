import * as pc from 'playcanvas';
import type { Environment } from './environments';
import type { GeoTexture } from './geo';
import { shine } from './lighting';
import { gpuTexture, greyOf, loadTextures, textureUrl, tintColour, type LoadedTexture } from './materials';
import type { ZoneMaterial } from './palace-zone-plans';

/**
 * Chapter 2's zones inside La Reina Bubbaloo's palace (docs/places/palace-zones.md), built from
 * their plan and theme (src/palace-zone-plans.ts). What every zone shares is built here once: the
 * floors of its rooms and the school's walls, tall on the north and west and cut low on the south
 * and east so the camera always sees in, with the school's orange on every door. Each zone then
 * dresses itself (`dressPatio`, `dressGym`) in its own palette. Everything that stands still is
 * batched; real materials load meanwhile and replace the paint.
 */
export interface PalaceZoneKit {
  app: pc.Application;
  root: pc.Entity;
  batch: number;
  x: (v: number) => number;
  z: (v: number) => number;
  texture: (canvas: HTMLCanvasElement) => pc.Texture;
}
type V3 = [number, number, number];
type Shape = 'box' | 'cylinder' | 'sphere' | 'cone' | 'plane';
/** How high the south and east walls are cut, and the doors in them. */
const LOW = .55;

export function buildPalaceZone(kit: PalaceZoneKit, environment: Environment) {
  const { app, root, batch, x, z, texture } = kit;
  const { plan, rooms, theme } = environment.palace!;
  const t = theme!, P = t.palette;
  const W = plan[0].length, D = plan.length;
  const glyph = (px: number, pz: number) => plan[pz]?.[px] ?? ' ';
  const jitter = (i: number) => { const v = Math.sin(i * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };
  const materials: pc.StandardMaterial[] = [], meshes: pc.Mesh[] = [], uploads: pc.Texture[] = [];
  const animated: ((time: number) => void)[] = [];

  function mat(hex: string, gloss = .25, glow = 0, kind: 'paint' | 'steel' | 'glass' | 'gum' = 'paint') {
    const m = new pc.StandardMaterial(); m.diffuse.fromString(hex); m.gloss = gloss; m.useMetalness = false;
    shine(m, kind);
    if (glow) { m.emissive.fromString(hex); m.emissiveIntensity = glow; }
    m.update(); materials.push(m); return m;
  }
  /** A primitive under `parent`; still ones join the scene's batch. */
  function part(parent: pc.Entity, name: string, type: Shape, m: pc.Material, p: V3, s: V3, r: V3 = [0, 0, 0], shadows = true, still = true) {
    const e = new pc.Entity(name);
    e.addComponent('render', { type, material: m, castShadows: shadows, receiveShadows: true, ...(still ? { batchGroupId: batch } : {}) });
    e.setLocalPosition(...p); e.setLocalScale(...s); e.setLocalEulerAngles(...r);
    parent.addChild(e); return e;
  }
  /** A child of `root` at a cell's centre, so pieces are laid out in metres around it. */
  function at(px: number, pz: number, name: string) {
    const e = new pc.Entity(name); e.setLocalPosition(x(px), 0, z(pz)); root.addChild(e); return e;
  }

  // ——— Real materials ———————————————————————————————————————————————————————————————————
  // A box whose UVs count metres on every face, so a texture tiles at its real size whatever
  // the box's size, and every slab of one surface shares one material (one batch).
  const boxes = new Map<string, pc.Mesh>();
  function metreBox(w: number, h: number, d: number) {
    const key = `${w}|${h}|${d}`;
    let mesh = boxes.get(key);
    if (mesh) return mesh;
    const half = [w / 2, h / 2, d / 2], positions: number[] = [], normals: number[] = [], uvs: number[] = [], indices: number[] = [];
    // Each face: its normal and the two axes its u and v run along (u × v = normal).
    const faces: [V3, V3, V3][] = [
      [[0, 0, 1], [1, 0, 0], [0, 1, 0]], [[0, 0, -1], [-1, 0, 0], [0, 1, 0]],
      [[1, 0, 0], [0, 0, -1], [0, 1, 0]], [[-1, 0, 0], [0, 0, 1], [0, 1, 0]],
      [[0, 1, 0], [1, 0, 0], [0, 0, -1]], [[0, -1, 0], [1, 0, 0], [0, 0, 1]],
    ];
    for (const [n, u, v] of faces) {
      const base = positions.length / 3;
      for (const [su, sv] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        const p = [0, 1, 2].map(i => (n[i] + u[i] * su + v[i] * sv) * half[i]);
        positions.push(...p); normals.push(...n);
        uvs.push(p[0] * u[0] + p[1] * u[1] + p[2] * u[2], p[0] * v[0] + p[1] * v[1] + p[2] * v[2]);
      }
      indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
    mesh = new pc.Mesh(app.graphicsDevice);
    mesh.setPositions(positions); mesh.setNormals(normals); mesh.setUvs(0, uvs); mesh.setIndices(indices); mesh.update();
    boxes.set(key, mesh); meshes.push(mesh);
    return mesh;
  }
  /** A slab of a real surface: `p` its centre, `s` its size in metres. */
  function slab(parent: pc.Entity, name: string, m: pc.Material, p: V3, s: V3, shadows = true) {
    const e = new pc.Entity(name);
    e.addComponent('render', { meshInstances: [new pc.MeshInstance(metreBox(...s), m)], castShadows: shadows, receiveShadows: true, batchGroupId: batch });
    e.setLocalPosition(...p); parent.addChild(e); return e;
  }
  /** A surface of the theme (`key` in its palette and materials), painted until its texture loads. */
  const surfaces = new Map<string, pc.StandardMaterial>();
  function surface(key: string, gloss = .12) {
    let m = surfaces.get(key);
    if (!m) { m = mat(t.materials[key]?.tint ?? P[key] ?? '#8a8a8a', gloss); surfaces.set(key, m); }
    return m;
  }
  let alive = true;
  async function loadReal() {
    const ids = [...new Set(Object.values(t.materials).map(m => m.texture))];
    const infos = await Promise.all(ids.map(id => fetch(textureUrl(id, 'texture.json')).then(r => r.ok ? r.json() as Promise<GeoTexture> : undefined).catch(() => undefined)));
    const loaded = await loadTextures(Object.fromEntries(ids.flatMap((id, i) => infos[i] ? [[id, infos[i]!]] : [])));
    if (!alive) return;
    for (const [key, m] of surfaces) if (t.materials[key]) dress(m, loaded, t.materials[key]);
  }
  /** Lays a loaded texture on a surface: tiled by its real size, tinted, with its normal map. */
  function dress(m: pc.StandardMaterial, loaded: Map<string, LoadedTexture>, { texture: id, tint, size }: ZoneMaterial) {
    const tex = loaded.get(id);
    if (!tex) return;
    const [sw, sh = sw] = size ? [size, size] : tex.info.size_m;
    const upload = (image: ImageBitmap | HTMLCanvasElement, name: string) => { const g = gpuTexture(app.graphicsDevice, image, name); uploads.push(g); return g; };
    m.diffuseMap = upload(tint ? greyOf(tex).canvas : tex.albedo, `${id} albedo`); m.diffuseMapTiling.set(1 / sw, 1 / sh);
    if (tex.normal) { m.normalMap = upload(tex.normal, `${id} normal`); m.normalMapTiling.set(1 / sw, 1 / sh); m.bumpiness = .7; }
    m.diffuse.copy(tint ? tintColour(tint, greyOf(tex)) : pc.Color.WHITE);
    m.update();
  }

  // ——— Painted details: signs, and the canvases the school is drawn on ——————————————————————
  function canvas(w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void) {
    const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d')!); return c;
  }
  function painted(c: HTMLCanvasElement, gloss = .2, glow = 0) {
    const m = mat('#ffffff', gloss); m.diffuseMap = texture(c);
    if (glow) { m.emissiveMap = m.diffuseMap; m.emissive.set(1, 1, 1); m.emissiveIntensity = glow; }
    m.update(); return m;
  }
  /** A school sign in Catalan, as on the real doors: dark letters on a pale plate. */
  function sign(text: string, fg = '#2b2b2b', bg = '#f4f1ea') {
    return painted(canvas(256, 64, ctx => {
      ctx.fillStyle = bg; ctx.fillRect(0, 0, 256, 64);
      ctx.fillStyle = fg; ctx.font = `bold ${Math.min(40, 360 / text.length)}px Arial, sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, 128, 34);
    }), .3);
  }
  /** A flat picture on the north wall's face (facing the camera): `w` × `h` metres, bottom at `y`. */
  function onNorthWall(name: string, m: pc.Material, px: number, w: number, y: number, h: number) {
    return part(root, name, 'plane', m, [x(px), y + h / 2, z(0) + .52], [w, 1, h], [90, 0, 0], false);
  }

  // ——— Floors ——————————————————————————————————————————————————————————————————————————————
  part(root, 'Base de la zona', 'box', mat(P.shade ?? '#2a2630', .1), [x((W - 1) / 2), -.32, z((D - 1) / 2)], [W + .4, .6, D + .4], [0, 0, 0], false);
  for (const room of rooms) {
    slab(root, `Suelo: ${room.name}`, surface(t.floors[room.name] ?? 'floor', .3), [x(room.x + (room.w - 1) / 2), -.03, z(room.z + (room.d - 1) / 2)], [room.w, .06, room.d], false);
  }

  // ——— Walls: the school's, tall on the north and west, cut low on the south and east ————————
  const tall = t.height;
  const wallMat = surface('wall'), plinth = mat(P.plinth ?? P.dado ?? '#8d8a83', .15);
  const orange = mat(P.door, .35), doorway = mat('#15121a', .1), steel = mat(P.steel ?? '#8f9699', .5, 0, 'steel');
  const leaf = mat('#5d6b73', .4), glassDark = mat('#24303a', .8, 0, 'glass');
  /** Runs of cells along a side that are not doors, so each wall is a few long slabs. */
  function runs(cells: number[], isWall: (i: number) => boolean) {
    const out: [number, number][] = [];
    let start = -1;
    cells.forEach((i, k) => {
      if (isWall(i) && start < 0) start = i;
      if (start >= 0 && (!isWall(i) || k === cells.length - 1)) { out.push([start, isWall(i) ? i : i - 1]); start = -1; }
    });
    return out;
  }
  const xs = Array.from({ length: W }, (_, i) => i), zs = Array.from({ length: D - 2 }, (_, i) => i + 1);
  const tallWall = (c: string) => c === '#' || c === 'E';
  // The north wall, with a plinth band (or a painted dado) along its foot.
  const dadoH = P.dado ? 1.5 : .6, dadoMat = P.dado ? surface('dado') : plinth;
  for (const [a, b] of runs(xs, i => tallWall(glyph(i, 0)))) {
    const cx = x((a + b) / 2), len = b - a + 1;
    slab(root, 'Muro norte', wallMat, [cx, tall / 2, z(0)], [len, tall, 1]);
    slab(root, 'Zócalo norte', dadoMat, [cx, dadoH / 2, z(0) + .52], [len, dadoH, .04], false);
  }
  // The west wall (the patio's is the neighbours' party wall).
  const westMat = t.materials.party ? surface('party') : wallMat;
  for (const [a, b] of runs(zs, i => tallWall(glyph(0, i)))) {
    const cz = z((a + b) / 2), len = b - a + 1;
    slab(root, 'Muro oeste', westMat, [x(0), tall / 2, cz], [1, tall, len]);
    if (!t.materials.party) slab(root, 'Zócalo oeste', dadoMat, [x(0) + .52, dadoH / 2, cz], [.04, dadoH, len], false);
  }
  // South and east: low walls, or a galvanised fence the camera sees through.
  const fenceMesh = (() => {
    const c = canvas(64, 64, ctx => {
      ctx.strokeStyle = '#d5dadb'; ctx.lineWidth = 3;
      for (const k of [-64, 0, 64]) { ctx.beginPath(); ctx.moveTo(k, 0); ctx.lineTo(k + 64, 64); ctx.moveTo(k + 64, 0); ctx.lineTo(k, 64); ctx.stroke(); }
    });
    const m = mat(P.fence ?? '#9aa0a0', .5, 0, 'steel'); m.diffuseMap = texture(c); m.opacityMap = m.diffuseMap; m.opacityMapChannel = 'a';
    m.alphaTest = .35; m.cull = pc.CULLFACE_NONE; m.diffuseMapTiling.set(1, 1); m.update(); return m;
  })();
  const lowWall = mat(P.wall, .15);
  function edge(px: number, pz: number, along: 'x' | 'z') {
    const c = glyph(px, pz);
    if (c === '#' || c === 'E') {
      part(root, 'Muro bajo', 'box', lowWall, [x(px), LOW / 2, z(pz)], [1, LOW, 1]);
      part(root, 'Remate', 'box', plinth, [x(px), LOW + .03, z(pz)], [1.04, .06, 1.04]);
    } else if (c === '|') {
      const fence = at(px, pz, 'Valla');
      part(fence, 'Poste', 'cylinder', steel, [along === 'x' ? -.5 : 0, .55, along === 'x' ? 0 : -.5], [.06, 1.1, .06]);
      part(fence, 'Barra', 'cylinder', steel, [0, 1.08, 0], [.04, 1, .04], along === 'x' ? [0, 0, 90] : [90, 0, 0], false);
      part(fence, 'Malla', 'plane', fenceMesh, [0, .55, 0], [1, 1, 1.05], along === 'x' ? [90, 0, 0] : [90, 90, 0], false);
    }
  }
  for (const px of xs) edge(px, D - 1, 'x');
  for (const pz of zs) edge(W - 1, pz, 'z');

  // ——— Doors: the school's orange frame on every one ——————————————————————————————————————
  /** A door in the north wall: an orange frame, the dark doorway and its leaf (shut, or ajar). */
  function northDoor(px: number, label: string, open: boolean) {
    const door = at(px, 0, `Puerta: ${label}`);
    slab(door, 'Dintel', wallMat, [0, (tall + 2.4) / 2, 0], [1, tall - 2.4, 1]);
    for (const side of [-1, 1]) part(door, 'Marco', 'box', orange, [side * .55, 1.22, .5], [.12, 2.44, .14]);
    part(door, 'Marco', 'box', orange, [0, 2.44, .5], [1.22, .12, .14]);
    if (open) part(door, 'Hueco', 'box', doorway, [0, 1.2, .1], [1.02, 2.4, .8], [0, 0, 0], false);
    else {
      part(door, 'Hoja', 'box', leaf, [0, 1.17, .45], [1, 2.34, .06]);
      part(door, 'Ventanuco', 'box', glassDark, [0, 1.65, .49], [.42, .55, .02], [0, 0, 0], false);
      part(door, 'Barra antipánico', 'box', steel, [0, 1, .51], [.8, .05, .05], [0, 0, 0], false);
    }
    part(door, 'Rótulo', 'plane', sign(label), [0, 2.78, .53], [1.25, 1, .32], [90, 0, 0], false);
    return door;
  }
  /** A door in a low wall facing the camera (south): cut low like the wall, its orange sill and posts. */
  function lowDoor(px: number, pz: number) {
    const door = at(px, pz, 'Puerta baja');
    for (const side of [-1, 1]) part(door, 'Marco cortado', 'box', orange, [side * .55, .45, 0], [.12, .9, .14]);
    part(door, 'Umbral', 'box', orange, [0, .02, 0], [1.1, .04, .5], [0, 0, 0], false);
    part(door, 'Felpudo', 'box', doorway, [0, .025, -.45], [.9, .02, .5], [0, 0, 0], false);
  }

  // ——— Lamps ———————————————————————————————————————————————————————————————————————————————
  const glow = new pc.Color().fromString(t.glow);
  function lamp(px: number, y: number, pz: number, intensity: number, range: number, color = glow) {
    const e = new pc.Entity('Luz de la zona');
    e.addComponent('light', { type: 'omni', color, intensity, range, castShadows: false });
    e.setLocalPosition(x(px), y, z(pz)); root.addChild(e); return e;
  }

  // Her gum, wherever she has crept in: glossy, a little see-through at the edges.
  const gum = mat(P.her, .88, .08, 'gum'), gumDeep = mat('#d94a8c', .8, .04, 'gum');
  /** A flattened smear of her gum on the ground, at cell coordinates. */
  function smear(px: number, pz: number, seed: number, size = 1) {
    part(root, 'Chicle', 'sphere', jitter(seed) < .5 ? gum : gumDeep, [x(px), .01, z(pz)], [(.25 + jitter(seed + 1) * .35) * size, .03, (.08 + jitter(seed + 2) * .1) * size], [0, jitter(seed + 3) * 180, 0], false);
  }

  // ——— El patio ————————————————————————————————————————————————————————————————————————————
  function dressPatio() {
    // The court: the painted resin inside its lines, worn asphalt round it.
    slab(root, 'Pista pintada', surface('court', .2), [x(17), -.01, z(14)], [26, .04, 16], false);
    // Its lines rose into knee-high kerbs of white-painted concrete, drawn as lines from cell to
    // cell (diagonals where an arc steps), so the maze reads as the court it was.
    const line = mat(P.line, .3), H = .42, wide = .3;
    const kerb = (px: number, pz: number) => glyph(px, pz) === '=';
    plan.forEach((row, pz) => [...row].forEach((c, px) => {
      if (c !== '=') return;
      part(root, 'Bordillo', 'box', line, [x(px), H / 2, z(pz)], [wide, H, wide]);
      if (kerb(px + 1, pz)) part(root, 'Bordillo', 'box', line, [x(px + .5), H / 2, z(pz)], [1, H, wide]);
      if (kerb(px, pz + 1)) part(root, 'Bordillo', 'box', line, [x(px), H / 2, z(pz + .5)], [wide, H, 1]);
      for (const dx of [-1, 1]) if (kerb(px + dx, pz + 1) && !kerb(px + dx, pz) && !kerb(px, pz + 1)) {
        part(root, 'Bordillo', 'box', line, [x(px + dx / 2), H / 2, z(pz + .5)], [wide, H, Math.SQRT2], [0, dx * 45, 0]);
      }
      // Where a line stayed down, its paint still crosses the gap to the next kerb.
      for (const [dx, dz] of [[1, 0], [0, 1]]) {
        if (kerb(px + dx, pz + dz)) continue;
        const floor = (k: number) => '.B'.includes(glyph(px + dx * k, pz + dz * k));
        const gap = [2, 3].find(g => kerb(px + dx * g, pz + dz * g) && [...Array(g - 1)].every((_, k) => floor(k + 1)));
        if (gap) part(root, 'Línea pintada', 'box', line, [x(px + dx * gap / 2), .012, z(pz + dz * gap / 2)], [dx ? gap - .3 : .08, .01, dz ? gap - .3 : .08], [0, 0, 0], false);
      }
      // Her gum at some of the joints.
      if (jitter(px * 7 + pz * 13) < .07) part(root, 'Chicle en el bordillo', 'sphere', gum, [x(px), H, z(pz)], [.36, .16, .36], [0, 0, 0], false);
    }));
    // Gum in the court's cracks.
    for (let i = 0; i < 14; i++) smear(5 + jitter(i + 40) * 24, 7 + jitter(i + 60) * 14, i + 80, 1.4);

    // The porch: square concrete pillars carrying beams back to the school; its roof is cut away
    // so the camera sees under it, and only a shallow canopy runs along the wall.
    const concrete = mat(P.porch, .15), cream = mat(P.wall, .15);
    plan.forEach((row, pz) => [...row].forEach((c, px) => {
      if (c !== 'A') return;
      const pillar = at(px, pz, 'Pilar del porche');
      part(pillar, 'Basa', 'box', concrete, [0, .15, 0], [.62, .3, .62]);
      part(pillar, 'Pilar', 'box', cream, [0, 1.6, 0], [.46, 3.2, .46]);
      part(pillar, 'Viga', 'box', concrete, [0, 3.05, -1.75], [.3, .3, 3.5]);
    }));
    slab(root, 'Alero', concrete, [x(17), 3.25, z(0) + .95], [W - 2, .2, .9]);

    // The school's facade: classroom windows with their blinds half down, between the doors.
    const glass = mat('#2a3540', .85, 0, 'glass'), frame = mat('#f1f1ee', .4), blind = mat('#d9cba8', .2);
    for (const px of [3, 9.5, 21.5, 24.5, 31.5]) {
      const w = 1.7;
      part(root, 'Ventana', 'box', frame, [x(px), 1.8, z(0) + .5], [w + .12, 1.42, .06], [0, 0, 0], false);
      part(root, 'Cristal', 'box', glass, [x(px), 1.8, z(0) + .53], [w, 1.3, .02], [0, 0, 0], false);
      part(root, 'Persiana', 'box', blind, [x(px), 2.15 + jitter(px) * .2 - .1, z(0) + .55], [w, .55 + jitter(px) * .3, .02], [0, 0, 0], false);
    }
    // The first floor's windows, above the canopy, where the castle has swallowed the rest.
    for (let px = 2; px < W - 1; px += 3.2) part(root, 'Ventana del primer piso', 'box', glass, [x(px), 4.1, z(0) + .52], [1.6, .9, .03], [0, 0, 0], false);
    // Her gum creeping over the top of the wall from her hall's door, thinning out towards the
    // corners: she has the building, not yet the yard.
    for (let px = 0; px < W; px += .7) {
      const s = jitter(px * 3 + 300), near = 1 - Math.min(1, Math.abs(px - 17) / 15);
      if (s > .15 + near * .7) continue;
      part(root, 'Chicle en lo alto', 'sphere', s < .2 ? gumDeep : gum, [x(px + (s - .5) * .6), tall, z(0) + .3], [(.5 + s) * (.6 + near), .16 + near * .25, .55 + near * .3], [0, s * 90, 0], false);
      if (s < near * .25) part(root, 'Goterón', 'sphere', gum, [x(px), tall - .3 - s, z(0) + .53], [.09, .4 + near * 1.2, .07], [0, 0, 0], false);
    }
    // The mural on the porch wall: welcome in the pupils' languages, painted over in pink but one.
    const mural = canvas(512, 160, ctx => {
      ctx.fillStyle = '#f3ecd9'; ctx.fillRect(0, 0, 512, 160);
      const words = ['Benvinguts', 'Bienvenidos', 'Welcome', 'Bienvenue', 'مرحبا', '欢迎', 'Ongi etorri', 'Witamy', 'Bine ați venit', 'Khush amdeed', 'Mirë se vini', 'Benvenuti'];
      const colours = ['#2f6db5', '#d8452b', '#2e8b57', '#e0a21b', '#7a3fa0', '#d8452b', '#2f6db5', '#2e8b57', '#e0a21b', '#2f6db5', '#d8452b', '#2e8b57'];
      ctx.textBaseline = 'middle';
      words.forEach((word, i) => {
        ctx.fillStyle = colours[i]; ctx.font = `bold ${i ? 22 : 40}px Arial, sans-serif`;
        ctx.fillText(word, i ? 20 + (i % 4) * 124 : 150, i ? 70 + Math.floor((i - 1) / 4) * 34 : 34);
      });
      // Children's hands round the edge, in poster paint.
      for (let i = 0; i < 14; i++) { ctx.fillStyle = colours[i % colours.length]; ctx.beginPath(); ctx.arc(16 + i * 37, 152, 9, 0, Math.PI * 2); ctx.fill(); }
      // Her pink, rolled over everything but the first word.
      ctx.fillStyle = '#ff6fae';
      for (let i = 0; i < 9; i++) { ctx.globalAlpha = .82; ctx.fillRect(8 + i * 56 + (i % 2) * 6, 56 + (i % 3) * 4, 60, 92 - (i % 2) * 8); }
      ctx.globalAlpha = 1;
    });
    onNorthWall('Mural «Benvinguts»', painted(mural, .25), 12.5, 4.6, .9, 1.45);

    // Doors off the porch: back to her hall (open, her gum round it), the gym and the secretaría.
    const hall = northDoor(17, 'VESTÍBUL', true);
    part(hall, 'Resplandor rosa', 'box', mat('#ff3d8b', .6, 1.4), [0, 1.2, .505], [.96, 2.3, .01], [0, 0, 0], false);
    for (let k = 0; k < 7; k++) {
      const a = k / 6 * Math.PI, s = jitter(k + 500);
      part(hall, 'Chicle en el marco', 'sphere', s < .4 ? gumDeep : gum, [Math.cos(a) * .72, .3 + Math.sin(a) * 2.3, .55], [.4 + s * .3, .45 + s * .3, .3], [0, 0, 0], false);
    }
    northDoor(6, 'GIMNÀS', false);
    northDoor(28, 'SECRETARIA', false);

    // The drinking trough with push taps; the water that comes out is hers.
    const trough = at(1, 7, 'Fuente de grifos');
    part(trough, 'Pila', 'box', mat(P.trough, .2), [0, .38, 0], [.75, .76, 2.9]);
    part(trough, 'Fondo', 'box', mat('#6f6b63', .3), [.02, .74, 0], [.55, .04, 2.7], [0, 0, 0], false);
    part(trough, 'Agua rosa', 'box', mat('#ff7fb5', .95, .25, 'gum'), [.02, .765, 0], [.5, .02, 2.6], [0, 0, 0], false);
    for (const dz of [-.9, 0, .9]) {
      part(trough, 'Grifo', 'cylinder', steel, [-.25, 1.02, dz], [.08, .16, .08], [0, 0, 90], false);
      part(trough, 'Pulsador', 'cylinder', steel, [-.3, 1.12, dz], [.07, .05, .07], [0, 0, 0], false);
    }
    part(trough, 'Hilo de agua rosa', 'cylinder', gum, [-.12, .9, 0], [.025, .26, .025], [0, 0, 0], false);

    // Two minibasket hoops on tubular posts (the rim at 2.60 m, as for primary), their nets stiff with gum.
    const hoopRed = mat(P.hoop, .45), board = mat('#f4f4f0', .5), rim = mat('#e0602a', .5, 0, 'steel');
    for (const [px, face] of [[4, 1], [30, -1]] as const) {
      const hoop = at(px, 14, 'Canasta');
      part(hoop, 'Pie', 'box', hoopRed, [-face * .3, .04, 0], [.4, .08, .4]);
      part(hoop, 'Poste', 'cylinder', hoopRed, [-face * .3, 1.45, 0], [.13, 2.9, .13]);
      part(hoop, 'Brazo', 'box', hoopRed, [-face * .1, 2.85, 0], [.42, .1, .1], [0, 0, 0], false);
      part(hoop, 'Tablero', 'box', board, [face * .12, 2.95, 0], [.04, .9, 1.5]);
      part(hoop, 'Cuadro', 'box', hoopRed, [face * .145, 2.85, 0], [.01, .4, .55], [0, 0, 0], false);
      part(hoop, 'Aro', 'cylinder', rim, [face * .38, 2.6, 0], [.46, .03, .46], [0, 0, 0], false);
      part(hoop, 'Red de chicle', 'cone', mat('#ff9cc8', .8, .1, 'gum'), [face * .38, 2.38, 0], [.42, .4, .42], [180, 0, 0], false);
    }

    // School bags in a row against the east fence, where the bell left them.
    const bags = ['#2e4f7a', '#c8402e', '#3c7a4a', '#e0a21b', '#5b5f8f', '#2a6f8f', '#8a3b5c', '#2e4f7a'];
    plan.forEach((row, pz) => [...row].forEach((c, px) => {
      if (c !== 'm') return;
      for (let k = 0; k < 2; k++) {
        const seed = pz * 5 + k, colour = bags[(pz + k * 3) % bags.length];
        const bag = at(px, pz + (k - .5) * .55, 'Mochila');
        bag.setLocalEulerAngles(0, -90 + (jitter(seed) - .5) * 30, -8 - jitter(seed + 1) * 10);
        const m = mat(colour, .35);
        part(bag, 'Cuerpo', 'box', m, [0, .26, .1], [.36, .44, .2]);
        part(bag, 'Tapa', 'sphere', m, [0, .48, .1], [.36, .16, .2], [0, 0, 0], false);
        part(bag, 'Bolsillo', 'box', mat('#1d1d22', .3), [0, .17, .21], [.26, .16, .05], [0, 0, 0], false);
      }
    }));

    // The lost-property heap in the centre circle: jackets, a recorder, a lunchbox and a ball of gum.
    const heap = at(17, 14, 'Objetos perdidos');
    ['#2e4f7a', '#c8402e', '#6d6f73', '#3c7a4a', '#e0a21b', '#2a2a30'].forEach((colour, k) => {
      const s = jitter(k + 700);
      part(heap, 'Chaqueta', 'box', mat(colour, .2), [(s - .5) * .5, .08 + k * .07, (jitter(k + 710) - .5) * .5], [.7 - k * .05, .1, .5], [(s - .5) * 14, s * 160, (jitter(k + 720) - .5) * 14]);
    });
    part(heap, 'Flauta', 'cylinder', mat('#efe6cf', .5), [.18, .5, -.05], [.04, .34, .04], [80, 20, 0], false);
    part(heap, 'Táper', 'box', mat('#6fb4d6', .6), [-.22, .5, .12], [.22, .08, .16], [0, 30, 0], false);
    part(heap, 'Bola de chicle', 'sphere', gum, [.05, .6, .05], [.16, .16, .16], [0, 0, 0], false);

    // The street gate, sealed with her gum.
    const gate = at(17, D - 1, 'Puerta del patio');
    const bars = mat('#55665e', .4, 0, 'steel');
    for (let k = 0; k < 9; k++) part(gate, 'Barrote', 'box', bars, [-.8 + k * .2, .62, 0], [.04, 1.24, .04]);
    part(gate, 'Travesaño', 'box', bars, [0, 1.2, 0], [1.8, .06, .06]);
    part(gate, 'Chicle que la sella', 'sphere', gum, [0, .55, 0], [2.1, .9, .45]);
    part(gate, 'Chicle que la sella', 'sphere', gumDeep, [.5, .3, .08], [.8, .5, .4], [0, 0, 0], false);

    // Dry plane leaves under the trees and blown against the walls.
    const leafMats = ['#a0763a', '#8a6230', '#b98a45'].map(c => mat(c, .1));
    for (let i = 0; i < 60; i++) {
      const lx = .7 + jitter(i + 900) * (i % 3 ? 4 : 30), lz = 4.5 + jitter(i + 950) * 19;
      if (glyph(Math.round(lx), Math.round(lz)) === '=') continue;
      part(root, 'Hoja seca', 'box', leafMats[i % 3], [x(lx), .015, z(lz)], [.16, .01, .11], [0, jitter(i + 990) * 180, 0], false);
    }

    // One cold floodlight on a pole over the east fence, the only lamp lit.
    const pole = at(34, 4, 'Foco');
    part(pole, 'Poste del foco', 'cylinder', steel, [.45, 3, 0], [.12, 6, .12]);
    part(pole, 'Foco', 'box', mat(t.glow, .5, 1.6), [.25, 5.9, .25], [.5, .3, .25], [20, 45, 0], false);
    lamp(24, 5.5, 9, 1.4, 16);
    // A ball goes on bouncing by itself in the far court.
    const ball = part(root, 'Pelota', 'sphere', mat('#d8662a', .4), [x(25), .12, z(19)], [.24, .24, .24], [0, 0, 0], true, false);
    animated.push(time => {
      const k = Math.abs(Math.sin(time * 2.6));
      ball.setLocalPosition(x(25), .12 + k * .9, z(19));
    });
  }

  // ——— El gimnasio —————————————————————————————————————————————————————————————————————————
  function dressGym() {
    // Above the cream wall the room goes on up into a dark with no ceiling.
    const fade = painted(canvas(4, 128, ctx => {
      const g = ctx.createLinearGradient(0, 128, 0, 0); g.addColorStop(0, P.wall); g.addColorStop(.35, '#5c5a5c'); g.addColorStop(1, P.shade);
      ctx.fillStyle = g; ctx.fillRect(0, 0, 4, 128);
    }), .05);
    part(root, 'Oscuridad norte', 'plane', fade, [x((W - 1) / 2), 5.05, z(0) + .53], [W - 1, 1, 2.9], [90, 0, 0], false);
    part(root, 'Oscuridad oeste', 'plane', fade, [x(0) + .53, 5.05, z((D - 1) / 2)], [D - 1, 1, 2.9], [90, 90, 0], false);
    // Even the walls' tops are lost in it.
    const dark = mat(P.shade, .05);
    part(root, 'Remate oscuro', 'box', dark, [x((W - 1) / 2), tall + .01, z(0)], [W + .02, .03, 1.02], [0, 0, 0], false);
    part(root, 'Remate oscuro', 'box', dark, [x(0), tall + .01, z((D - 1) / 2)], [1.02, .03, D + .02], [0, 0, 0], false);
    // High barred windows on the north wall: her plum light, the only colour up there.
    const pane = mat(P.window, .6, .9), bar = mat('#1f1a22', .3);
    for (let px = 3; px < W - 2; px += 4) {
      part(root, 'Ventana alta', 'box', pane, [x(px), 4.85, z(0) + .55], [1.8, .9, .02], [0, 0, 0], false);
      for (let k = 0; k < 7; k++) part(root, 'Reja', 'box', bar, [x(px) - .78 + k * .26, 4.85, z(0) + .58], [.04, .95, .03], [0, 0, 0], false);
    }

    // Wall bars (espatlleres) along the tall walls: pine uprights every metre and round rungs, up
    // past where anyone could climb, until the dark takes them.
    const pine = mat(P.pine, .45);
    const rungs = (y: number) => y < 2.7 ? .19 : .4;
    const north = runs(xs, i => glyph(i, 0) === 'E'), west = runs(zs, i => glyph(0, i) === 'E');
    for (const [a, b] of north) {
      for (let px = a; px <= b + 1; px++) part(root, 'Larguero', 'box', pine, [x(px - .5), 3, z(0) + .62], [.07, 6, .09]);
      for (let y = .25; y < 4.2; y += rungs(y)) part(root, 'Barrote', 'cylinder', pine, [x((a + b) / 2), y, z(0) + .64], [.04, b - a + 1, .04], [0, 0, 90], false);
    }
    for (const [a, b] of west) {
      for (let pz = a; pz <= b + 1; pz++) part(root, 'Larguero', 'box', pine, [x(0) + .62, 3, z(pz - .5)], [.09, 6, .07]);
      for (let y = .25; y < 4.2; y += rungs(y)) part(root, 'Barrote', 'cylinder', pine, [x(0) + .64, y, z((a + b) / 2)], [.04, b - a + 1, .04], [90, 0, 0], false);
    }

    // The floor's painted court: yellow lines, the centre circle round the plint.
    const yellow = mat(P.line, .3), white = mat(P.lineWhite, .3);
    const flat = (m: pc.Material, x0: number, z0: number, x1: number, z1: number) =>
      part(root, 'Línea', 'box', m, [x((x0 + x1) / 2), .012, z((z0 + z1) / 2)], [Math.max(.07, x1 - x0), .01, Math.max(.07, z1 - z0)], [0, 0, 0], false);
    flat(yellow, 1.2, 1.2, 24.8, 1.2); flat(yellow, 1.2, 16.8, 24.8, 16.8); flat(yellow, 1.2, 1.2, 1.2, 16.8); flat(yellow, 24.8, 1.2, 24.8, 16.8);
    flat(yellow, 13, 1.2, 13, 16.8);
    flat(white, 4.5, 4.5, 21.5, 4.5); flat(white, 4.5, 13.5, 21.5, 13.5);
    const circle = new pc.Entity('Círculo central');
    const ringMesh = pc.Mesh.fromGeometry(app.graphicsDevice, new pc.TorusGeometry({ ringRadius: 2.6, tubeRadius: .04, segments: 64, sides: 6 }));
    meshes.push(ringMesh);
    circle.addComponent('render', { meshInstances: [new pc.MeshInstance(ringMesh, yellow)], castShadows: false, receiveShadows: true, batchGroupId: batch });
    circle.setLocalPosition(x(13), .005, z(7)); circle.setLocalScale(1, .2, 1); root.addChild(circle);

    // Blue vinyl mats, stacked waist-high into the obstacle course.
    const matTop = mat(P.mat, .55), matSide = mat(P.matSide, .45);
    plan.forEach((row, pz) => [...row].forEach((c, px) => {
      if (c !== 'M') return;
      const layers = 3 + (jitter(px * 3 + pz) < .3 ? 1 : 0);
      for (let k = 0; k < layers; k++) {
        const s = jitter(px * 11 + pz * 7 + k);
        part(root, 'Colchoneta', 'box', k === layers - 1 ? matTop : matSide, [x(px) + (s - .5) * .08, .1 + k * .2, z(pz) + (jitter(s * 99) - .5) * .08], [.97, .19, .97], [0, (s - .5) * 6, 0]);
      }
    }));

    // El plint: the vaulting box grown into a stepped tower, its handholds oozing her gum.
    const plint = at(13, 7, 'El plint');
    const leather = mat(P.leather, .35), slot = mat('#2a1d14', .2);
    const tiers = 6;
    for (let k = 0; k < tiers; k++) {
      const w = 2.9 - k * .34, y = .15 + k * .3;
      part(plint, 'Cajón', 'box', pine, [0, y, 0], [w, .29, w * .8]);
      for (const side of [-1, 1]) part(plint, 'Asidero', 'box', slot, [0, y + .02, side * (w * .4 + .005)], [w * .35, .07, .02], [0, 0, 0], false);
      if (k % 2) part(plint, 'Chicle en el asidero', 'sphere', gum, [w * .18, y - .06, w * .4 + .02], [.18, .12, .08], [0, 0, 0], false);
    }
    part(plint, 'Tapa de cuero', 'box', leather, [0, .15 + tiers * .3 - .05, 0], [2.9 - tiers * .34 + .06, .16, (2.9 - tiers * .34) * .8 + .06]);
    // Her gum seeping between the floor's seams round it.
    for (let i = 0; i < 10; i++) smear(13 + (jitter(i + 1200) - .5) * 7, 7 + (jitter(i + 1300) - .5) * 6, i + 1400);

    // The ball cage in the corner: orange balls, and one that is not.
    const cage = at(23, 1.5, 'Carro de pelotas');
    for (const [cx, cz] of [[-1.4, -.9], [1.4, -.9], [-1.4, .9], [1.4, .9]]) part(cage, 'Esquina', 'box', steel, [cx, .6, cz], [.05, 1.1, .05]);
    for (const y of [.15, 1.15]) for (const [w, d, cx, cz] of [[2.85, .04, 0, -.9], [2.85, .04, 0, .9], [.04, 1.85, -1.4, 0], [.04, 1.85, 1.4, 0]]) part(cage, 'Barra', 'box', steel, [cx, y, cz], [w, .04, d], [0, 0, 0], false);
    for (const cz of [-.9, .9]) part(cage, 'Malla', 'plane', fenceMesh, [0, .65, cz], [2.8, 1, 1], [90, 0, 0], false);
    const ballMat = mat(P.ball, .4);
    for (let i = 0; i < 26; i++) {
      const bx = (jitter(i + 1500) - .5) * 2.5, bz = (jitter(i + 1600) - .5) * 1.5, by = .3 + jitter(i + 1700) * .7;
      part(cage, 'Pelota', 'sphere', i === 17 ? gum : ballMat, [bx, by, bz], [.24, .24, .24], [0, 0, 0], false);
    }

    // Ropes hanging from the dark, swaying though nothing moves the air.
    const rope = mat('#c8b48a', .15);
    plan.forEach((row, pz) => [...row].forEach((c, px) => {
      if (c !== 'r') return;
      const pivot = new pc.Entity('Cuerda'); pivot.setLocalPosition(x(px), 6.6, z(pz)); root.addChild(pivot);
      part(pivot, 'Cuerda', 'cylinder', rope, [0, -3.05, 0], [.05, 6.1, .05], [0, 0, 0], true, false);
      part(pivot, 'Nudo', 'sphere', rope, [0, -6.1, 0], [.12, .16, .12], [0, 0, 0], false, false);
      const phase = px * .7;
      animated.push(time => pivot.setLocalEulerAngles(Math.sin(time * .5 + phase) * 1.4, 0, Math.sin(time * .4 + phase * 1.3) * 1.6));
    }));
    // Hoops left on the floor.
    const hoopColours = ['#d8452b', '#e0a21b', '#2f6db5', '#2e8b57', P.her];
    let hoopIndex = 0;
    plan.forEach((row, pz) => [...row].forEach((c, px) => {
      if (c !== 'o') return;
      const ring = pc.Mesh.fromGeometry(app.graphicsDevice, new pc.TorusGeometry({ ringRadius: .36, tubeRadius: .025, segments: 28, sides: 6 }));
      meshes.push(ring);
      const e = new pc.Entity('Aro');
      e.addComponent('render', { meshInstances: [new pc.MeshInstance(ring, mat(hoopColours[hoopIndex++ % hoopColours.length], .5))], castShadows: false, receiveShadows: true, batchGroupId: batch });
      e.setLocalPosition(x(px) + (jitter(px) - .5) * .2, .03, z(pz) + (jitter(px + 9) - .5) * .2); root.addChild(e);
    }));
    // Swedish benches along the east wall: a pine board on its upturned beam.
    for (const pz of [5, 11]) {
      const bench = at(24, pz + .5, 'Banco sueco');
      part(bench, 'Tabla', 'box', pine, [0, .32, 0], [.24, .05, 2]);
      part(bench, 'Viga', 'box', pine, [0, .14, 0], [.1, .08, 1.9]);
      for (const dz of [-.85, .85]) part(bench, 'Pata', 'box', pine, [0, .16, dz], [.36, .3, .08]);
    }

    // Doors: back to the patio (south), and the changing rooms, always shut.
    lowDoor(13, D - 1);
    northDoor(19, 'VESTIDORS', false);

    // Rows of cold tubes hanging in the dark; one of them flickers.
    const tube = mat(P.tube, .5, 1.5), housing = mat('#c9cdd2', .4);
    const flicker = mat(P.tube, .5, 1.5);
    const tubes: [number, number][] = [[7, 4], [13, 4], [19, 4], [7, 12], [13, 12], [19, 12]];
    tubes.forEach(([px, pz], i) => {
      const fixture = at(px, pz, 'Fluorescente');
      part(fixture, 'Carcasa', 'box', housing, [0, 5.2, 0], [1.4, .08, .22], [0, 0, 0], false);
      for (const dx of [-.55, .55]) part(fixture, 'Cable', 'cylinder', bar, [dx, 5.95, 0], [.015, 1.5, .015], [0, 0, 0], false);
      part(fixture, 'Tubo', 'box', i === 4 ? flicker : tube, [0, 5.14, 0], [1.3, .05, .1], [0, 0, 0], false, i !== 4);
    });
    lamp(7, 4.6, 4, 1.05, 11); lamp(19, 4.6, 4, 1.05, 11); lamp(19, 4.6, 12, 1.05, 11);
    const flickerLight = lamp(13, 4.6, 12, .9, 9);
    animated.push(time => {
      // Mostly on, then a stutter now and then, as old tubes do.
      const on = Math.sin(time * 1.3) > -.85 || Math.sin(time * 37) > 0;
      flicker.emissiveIntensity = on ? 1.5 : .15; flicker.update();
      flickerLight.light!.intensity = on ? .9 : .1;
    });
  }

  ({ patio: dressPatio, gimnasio: dressGym })[t.zone]();
  void loadReal();

  let time = 0;
  return {
    update(dt: number, animate: boolean) {
      if (!animate) return;
      time += dt;
      for (const step of animated) step(time);
    },
    destroy() { alive = false; materials.forEach(m => m.destroy()); meshes.forEach(m => m.destroy()); uploads.forEach(u => u.destroy()); },
  };
}

/**
 * Chapter 2: the hall's east door (the sealed Ala Líquida of chapter 1) shows the school's orange
 * frame under her gum, because the school is behind it now. Built over the `palacio` scene.
 */
export function buildSchoolDoor(app: pc.Application, toWorld: (px: number, pz: number) => pc.Vec3) {
  const root = new pc.Entity('Marco de la escuela'); app.root.addChild(root);
  const m = new pc.StandardMaterial(); m.diffuse.fromString('#e8742c'); m.gloss = .35; m.useMetalness = false; shine(m, 'paint'); m.update();
  const p = toWorld(22, 13); root.setPosition(p.x, 0, p.z);
  const piece = (s: V3, at: V3) => {
    const e = new pc.Entity('Marco naranja'); e.addComponent('render', { type: 'box', material: m, castShadows: true, receiveShadows: true });
    e.setLocalPosition(...at); e.setLocalScale(...s); root.addChild(e);
  };
  for (const side of [-1, 1]) piece([.16, 2.1, .14], [-.2, 1.05, side * .62]);
  piece([.16, .14, 1.4], [-.2, 2.1, 0]);
  return { destroy() { root.destroy(); m.destroy(); } };
}
