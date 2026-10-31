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
 * dresses itself (`dressPatio`, `dressGym`, `dressSecretaria`, `dressTrono`) in its own palette.
 * Everything that stands still is batched; real materials load meanwhile and replace the paint.
 */
export interface PalaceZoneKit {
  app: pc.Application;
  root: pc.Entity;
  batch: number;
  x: (v: number) => number;
  z: (v: number) => number;
  texture: (canvas: HTMLCanvasElement) => pc.Texture;
  /** A raised floor that feet follow (`top` high over the `w` × `d` cells centred on px, pz): the throne room's stage. */
  surface?: (px: number, pz: number, w: number, d: number, top: number) => void;
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
  /** What follows the party around (the throne room's pool of light). */
  const following: ((focus: pc.Vec3) => void)[] = [];

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
  function dress(m: pc.StandardMaterial, loaded: Map<string, LoadedTexture>, { texture: id, tint, size, soften }: ZoneMaterial) {
    const tex = loaded.get(id);
    if (!tex) return;
    const [sw, sh = sw] = size ? [size, size] : tex.info.size_m;
    const upload = (image: ImageBitmap | HTMLCanvasElement, name: string) => { const g = gpuTexture(app.graphicsDevice, image, name); uploads.push(g); return g; };
    const grey = tint ? greyOf(tex) : undefined;
    // Softened: the grey drawn over with its own mean, so the tint still averages to `tint`.
    const albedo = !grey ? tex.albedo : !soften ? grey.canvas : canvas(grey.canvas.width, grey.canvas.height, ctx => {
      const v = Math.round(grey.linear ** (1 / 2.2) * 255);
      ctx.drawImage(grey.canvas, 0, 0); ctx.globalAlpha = soften; ctx.fillStyle = `rgb(${v}, ${v}, ${v})`; ctx.fillRect(0, 0, grey.canvas.width, grey.canvas.height);
    });
    m.diffuseMap = upload(albedo, `${id} albedo`); m.diffuseMapTiling.set(1 / sw, 1 / sh);
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
  // Walls, and walls with something hung on them (wall bars, the key cabinet, the cork board).
  const tallWall = (c: string) => '#EkN'.includes(c);
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
    if (tallWall(c)) {
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
  function northDoor(px: number, label: string, open: boolean) { return wallDoor(px, 0, 0, label, open); }
  /** The same door in the west wall, turned to face east. */
  function westDoor(pz: number, label: string, open: boolean) { return wallDoor(0, pz, 90, label, open); }
  function wallDoor(px: number, pz: number, yaw: number, label: string, open: boolean) {
    const door = at(px, pz, `Puerta: ${label}`);
    door.setLocalEulerAngles(0, yaw, 0);
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
  /** A flattened smear of her gum on the ground, at cell coordinates, mostly the darker gum. */
  function smear(px: number, pz: number, seed: number, size = 1) {
    part(root, 'Chicle', 'sphere', jitter(seed) < .3 ? gum : gumDeep, [x(px), .01, z(pz)], [(.25 + jitter(seed + 1) * .35) * size, .03, (.12 + jitter(seed + 2) * .12) * size], [0, jitter(seed + 3) * 180, 0], false);
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
    // so the camera sees under it (any slab over it would hide the doors' signs and Gerard).
    const concrete = mat(P.porch, .15), cream = mat(P.wall, .15);
    plan.forEach((row, pz) => [...row].forEach((c, px) => {
      if (c !== 'A') return;
      const pillar = at(px, pz, 'Pilar del porche');
      part(pillar, 'Basa', 'box', concrete, [0, .15, 0], [.62, .3, .62]);
      part(pillar, 'Pilar', 'box', cream, [0, 1.6, 0], [.46, 3.2, .46]);
      part(pillar, 'Viga', 'box', concrete, [0, 3.05, -1.75], [.3, .3, 3.5]);
    }));
    slab(root, 'Imposta', concrete, [x((W - 1) / 2), 3.3, z(0) + .56], [W - 1, .22, .12]);

    // The school's facade: classroom windows with their blinds half down, between the doors.
    const glass = mat('#2a3540', .85, 0, 'glass'), frame = mat('#f1f1ee', .4), blind = mat('#d9cba8', .2);
    for (const px of [3, 9.5, 21.5, 24.5, 31.5]) {
      const w = 1.7;
      part(root, 'Ventana', 'box', frame, [x(px), 1.8, z(0) + .5], [w + .12, 1.42, .06], [0, 0, 0], false);
      part(root, 'Cristal', 'box', glass, [x(px), 1.8, z(0) + .53], [w, 1.3, .02], [0, 0, 0], false);
      part(root, 'Persiana', 'box', blind, [x(px), 2.15 + jitter(px) * .2 - .1, z(0) + .55], [w, .55 + jitter(px) * .3, .02], [0, 0, 0], false);
    }
    // The first floor's windows, above the string course, where the castle has swallowed the rest.
    for (let px = 2; px < W - 1; px += 3.2) part(root, 'Ventana del primer piso', 'box', glass, [x(px), 4.1, z(0) + .52], [1.6, .9, .03], [0, 0, 0], false);
    // Her gum spreading over the facade from her hall's door: she has the building, not yet the
    // yard. Flat blotches on the wall, one mass above the door that breaks into islands a few
    // metres each way, a thin crust over the coping where it is thickest and a few short runs: a
    // stain spreading, not a decoration. Dull, half-dry gum, so her shine stays at the door.
    const stain = mat('#c23f7c', .5, .04, 'gum');
    for (let i = 0; i < 90; i++) {
      const s = jitter(i + 300), side = jitter(i + 340) < .5 ? -1 : 1, reach = s * s * 6.5;
      const px = 17 + side * reach, near = 1 - reach / 6.5, y = 3.05 + jitter(i + 380) * (tall - 3.05);
      part(root, 'Chicle en la fachada', 'sphere', stain, [x(px), y, z(0) + .5], [.18 + near * .55 + jitter(i + 420) * .2, .14 + near * .4, .05], [0, 0, (jitter(i + 460) - .5) * 60], false);
      if (near > .55 && y > tall - .6) part(root, 'Chicle en lo alto', 'sphere', stain, [x(px), tall, z(0) + .38], [.5 + near * .3, .06 + near * .06, .3], [0, 0, 0], false);
      if (near > .5 && jitter(i + 500) < .12) {
        const run = .25 + jitter(i + 540) * .6;
        part(root, 'Goterón', 'cone', stain, [x(px), y - .1 - run / 2, z(0) + .505], [.08, run, .03], [180, 0, 0], false);
      }
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
    // Her gum oozed out round its frame, pressed flat against the wall, more of it low down.
    for (let k = 0; k < 15; k++) {
      const a = k / 14 * Math.PI, s = jitter(k + 500), low = 1 - Math.sin(a) * .5;
      part(hall, 'Chicle en el marco', 'sphere', s < .6 ? gumDeep : gum, [Math.cos(a) * (.66 + s * .1), .12 + Math.sin(a) * 2.28, .52], [(.2 + s * .16) * low + .08, (.26 + s * .2) * low + .06, .12], [0, 0, (s - .5) * 70], false);
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
    // A minibasket board on the west wall, above the bars, as in every school gym.
    const board = at(0, 8.5, 'Canasta de pared');
    part(board, 'Brazo', 'box', steel, [.75, 2.9, 0], [1, .08, .08], [0, 0, 0], false);
    part(board, 'Tablero', 'box', mat('#f4f4f0', .5), [1.25, 2.95, 0], [.04, .9, 1.5]);
    part(board, 'Cuadro', 'box', mat('#c8402e', .4), [1.275, 2.85, 0], [.01, .4, .55], [0, 0, 0], false);
    part(board, 'Aro', 'cylinder', mat('#e0602a', .5, 0, 'steel'), [1.5, 2.6, 0], [.46, .03, .46], [0, 0, 0], false);
    part(board, 'Red', 'cone', mat('#eeeeea', .3), [1.5, 2.4, 0], [.4, .36, .4], [180, 0, 0], false);

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

  // ——— La secretaría ——————————————————————————————————————————————————————————————————————
  function dressSecretaria() {
    const steelMat = mat(P.steel, .45, 0, 'steel'), paper = mat(P.paper, .15), laminate = mat(P.counter, .35);
    const front = mat('#b3a78e', .25), black = mat('#17191b', .55), frameGrey = mat('#55595c', .45, 0, 'steel');
    const note = mat(P.her, .3), box = surface('box', .1);
    /** Her sticky notes, on everything: a pink square on a face looking south, east or up. */
    function sticky(parent: pc.Entity, p: V3, face: 'south' | 'east' | 'up', seed: number) {
      const tilt = (jitter(seed) - .5) * 24;
      const [s, r]: [V3, V3] = face === 'south' ? [[.09, .09, .006], [0, 0, tilt]] : face === 'east' ? [[.006, .09, .09], [tilt, 0, 0]] : [[.09, .006, .09], [0, tilt, 0]];
      part(parent, 'Nota rosa', 'box', note, p, s, r, false);
    }
    const cells = (c: string, fn: (px: number, pz: number) => void) => plan.forEach((row, pz) => [...row].forEach((g, px) => { if (g === c) fn(px, pz); }));

    // The archive: back-to-back steel cabinets of four drawers in long runs (their fronts face
    // east), archive boxes piled on top: the zone's manila, what the camera sees most.
    const CAB = 1.32;
    const drawers = painted(canvas(128, 168, ctx => {
      ctx.fillStyle = '#6c7671'; ctx.fillRect(0, 0, 128, 168);
      for (let col = 0; col < 2; col++) for (let k = 0; k < 4; k++) {
        const x0 = col * 64 + 3, y0 = k * 42 + 3;
        ctx.fillStyle = P.steel; ctx.fillRect(x0, y0, 58, 37);
        ctx.fillStyle = '#5a635e'; ctx.fillRect(x0, y0 + 35, 58, 2);
        ctx.fillStyle = '#ebe6d6'; ctx.fillRect(x0 + 21, y0 + 6, 16, 8);
        ctx.fillStyle = '#32373a'; ctx.fillRect(x0 + 17, y0 + 19, 24, 5);
      }
    }), .4);
    const label = mat('#efeadb', .2);
    cells('R', (px, pz) => {
      part(root, 'Armario', 'box', steelMat, [x(px), CAB / 2, z(pz)], [1, CAB, .98]);
      const east = glyph(px + 1, pz) !== 'R';
      if (east) part(root, 'Cajones', 'plane', drawers, [x(px) + .505, CAB / 2, z(pz)], [.96, 1, CAB - .04], [90, 90, 0], false);
      for (let i = 0; i < 2; i++) for (let k = 0; k < 3; k++) {
        const s = jitter(px * 31 + pz * 17 + i * 5 + k);
        if (s < .14) continue;
        const layers = !east && s > .8 ? 2 : 1, h = .26;
        const bx = x(px) + (i - .5) * .48 + (s - .5) * .05, bz = z(pz) + (k - 1) * .32;
        for (let l = 0; l < layers; l++) slab(root, 'Caja de archivo', box, [bx, CAB + h / 2 + l * h, bz], [.44, h, .3]);
        if (east && i === 1 && s > .45) part(root, 'Etiqueta', 'box', label, [bx + .222, CAB + .14, bz], [.006, .09, .16], [0, 0, 0], false);
        if (s > .93) sticky(root, [bx, CAB + layers * h + .003, bz], 'up', px + pz + k);
      }
      if (east && jitter(px * 3 + pz * 11) < .3) sticky(root, [x(px) + .51, .3 + jitter(pz) * .9, z(pz) + (jitter(px) - .5) * .5], 'east', px * pz);
    });

    // Drifts of forms that have overflowed the aisles, and sheets everywhere on the floor.
    cells('~', (px, pz) => {
      const heap = at(px, pz, 'Montón de impresos');
      part(heap, 'Montón', 'sphere', paper, [0, .08, 0], [1.15, .5, 1.05]);
      for (let k = 0; k < 4; k++) part(heap, 'Pila', 'box', paper, [(jitter(px + k) - .5) * .5, .2 + k * .06, (jitter(pz + k) - .5) * .5], [.3, .28 + k * .08, .21], [(jitter(k + 3) - .5) * 16, jitter(k + px) * 90, (jitter(k + pz) - .5) * 16]);
      for (let k = 0; k < 12; k++) {
        const s = jitter(px * 13 + pz * 7 + k);
        part(heap, 'Hoja', 'box', paper, [(s - .5) * 1.1, .26 + jitter(s * 50) * .3, (jitter(s * 70) - .5) * 1], [.3, .006, .21], [(s - .5) * 50, s * 180, (jitter(s * 90) - .5) * 50], false);
      }
      sticky(heap, [.12, .55, .15], 'up', px + pz);
    });
    for (let i = 0; i < 70; i++) {
      const sx = 1 + jitter(i + 2000) * 25, sz = 1 + jitter(i + 2100) * 12.5;
      if ('.B'.indexOf(glyph(Math.round(sx), Math.round(sz))) < 0) continue;
      part(root, 'Hoja suelta', 'box', paper, [x(sx), .008, z(sz)], [.3, .005, .21], [0, jitter(i + 2200) * 180, 0], false);
    }

    // The same desk, repeated in rows: the same monitor, the same mug, the same pile, the same note.
    const screen = mat('#9fb4c8', .6, .35), mug = mat('#e8e4da', .5), chairMat = mat('#2a2c30', .3);
    function desk(cx: number, pz: number, own: boolean) {
      const d = at(cx, pz, own ? 'La mesa de Gerard' : 'Mesa');
      part(d, 'Tablero', 'box', laminate, [0, .73, 0], [1.6, .04, .78]);
      for (const side of [-1, 1]) part(d, 'Lateral', 'box', frameGrey, [side * .77, .36, 0], [.04, .72, .74]);
      part(d, 'Faldón', 'box', frameGrey, [0, .45, -.36], [1.5, .4, .02], [0, 0, 0], false);
      part(d, 'Pie del monitor', 'box', black, [.1, .76, -.16], [.2, .03, .15], [0, 0, 0], false);
      part(d, 'Monitor', 'box', black, [.1, 1.06, -.17], [.58, .36, .04]);
      part(d, 'Pantalla', 'box', screen, [.1, 1.06, -.148], [.53, .31, .004], [0, 0, 0], false);
      part(d, 'Teclado', 'box', black, [.05, .755, .13], [.44, .02, .14], [0, 0, 0], false);
      for (let k = 0; k < 4; k++) part(d, 'Impresos', 'box', paper, [.55, .76 + k * .022, -.04], [.3, .02, .22], [0, (k % 2 - .5) * 10, 0], false);
      // An office chair pushed in, on its five-legged base.
      const chair = at(cx + .1, pz + .66, 'Silla de oficina');
      part(chair, 'Asiento', 'box', chairMat, [0, .47, 0], [.46, .07, .44], [0, 0, 0], false);
      part(chair, 'Respaldo', 'box', chairMat, [0, .8, .22], [.42, .48, .05], [-6, 0, 0], false);
      part(chair, 'Columna', 'cylinder', frameGrey, [0, .25, 0], [.05, .42, .05], [0, 0, 0], false);
      part(chair, 'Base', 'cylinder', black, [0, .05, 0], [.55, .04, .55], [0, 0, 0], false);
      if (own) return d;
      part(d, 'Taza', 'cylinder', mug, [-.5, .8, .05], [.08, .1, .08], [0, 0, 0], false);
      sticky(d, [.3, 1.18, -.145], 'south', 1);
      return d;
    }
    cells('d', (px, pz) => { if (glyph(px - 1, pz) !== 'd') desk(px + .5, pz, false); });

    // La mesa de Gerard, at the end of the archive: as he left it, under the only warm lamp.
    const own = desk(1.5, 1, true);
    part(own, 'Su taza', 'cylinder', mat('#f4f1e8', .5), [-.42, .8, .1], [.085, .1, .085], [0, 0, 0], false);
    part(own, 'Franja de la taza', 'cylinder', mat('#2f6db5', .5), [-.42, .82, .1], [.087, .025, .087], [0, 0, 0], false);
    part(own, 'Sello de la escuela', 'cylinder', mat('#3a2a22', .4), [-.15, .79, .18], [.07, .09, .07], [0, 0, 0], false);
    part(own, 'Tampón', 'box', black, [-.2, .76, .02], [.16, .02, .1], [0, 0, 0], false);
    part(own, 'Tinta', 'box', mat('#e0488a', .7, .1, 'gum'), [-.2, .772, .02], [.13, .004, .075], [0, 0, 0], false);
    part(own, 'Sello de registro', 'box', mat('#3b2b55', .4), [.0, .8, .2], [.07, .1, .05], [0, 0, 0], false);
    part(own, 'Foto', 'box', mat('#d8cfb8', .3), [-.62, .86, -.2], [.16, .2, .015], [-10, 25, 0], false);
    // The desk lamp: a weighted base, an arm and a shade, its bulb the room's only warm light.
    const lampMat = mat('#2b2e31', .5, 0, 'steel'), bulb = mat(P.lamp, .4, 1.6);
    part(own, 'Base del flexo', 'cylinder', lampMat, [-.65, .77, -.2], [.16, .04, .16], [0, 0, 0], false);
    part(own, 'Brazo', 'box', lampMat, [-.62, .98, -.2], [.025, .42, .025], [0, 0, -12], false);
    part(own, 'Brazo', 'box', lampMat, [-.45, 1.2, -.12], [.025, .38, .025], [30, 0, 62], false);
    part(own, 'Pantalla del flexo', 'cone', lampMat, [-.3, 1.12, -.05], [.2, .18, .2], [0, 0, 28], false);
    part(own, 'Bombilla', 'sphere', bulb, [-.29, 1.06, -.05], [.08, .08, .08], [0, 0, 0], false);
    lamp(1.3, 1.25, 1.2, 1.7, 4.2, new pc.Color().fromString(P.lamp));
    // The key cabinet on the west wall: every classroom's key on its hook, each with its tag.
    const keys = painted(canvas(96, 128, ctx => {
      ctx.fillStyle = '#d9dcd6'; ctx.fillRect(0, 0, 96, 128);
      const tags = ['#d8452b', '#2f6db5', '#e0a21b', '#2e8b57', '#efeadb'];
      for (let r = 0; r < 5; r++) for (let c = 0; c < 6; c++) {
        const kx = 10 + c * 15, ky = 12 + r * 23;
        ctx.fillStyle = '#6d7275'; ctx.fillRect(kx - 1, ky - 4, 3, 4);
        ctx.fillStyle = '#b9a24a'; ctx.fillRect(kx - 1, ky, 3, 9);
        ctx.fillStyle = tags[(r * 6 + c) % tags.length]; ctx.fillRect(kx - 4, ky + 9, 9, 6);
      }
      ctx.strokeStyle = '#7f8a83'; ctx.lineWidth = 4; ctx.strokeRect(2, 2, 92, 124);
    }), .5);
    cells('k', (px, pz) => {
      part(root, 'Armario de llaves', 'box', steelMat, [x(px) + .54, 1.65, z(pz)], [.08, .8, .6]);
      part(root, 'Llaves', 'plane', keys, [x(px) + .585, 1.65, z(pz)], [.56, 1, .76], [90, 90, 0], false);
    });
    // The cork board by the door: circulars, the school calendar, the timetables, a pink note on each.
    const board = painted(canvas(384, 224, ctx => {
      ctx.fillStyle = '#b48a5a'; ctx.fillRect(0, 0, 384, 224);
      for (let i = 0; i < 900; i++) { ctx.fillStyle = jitter(i) < .5 ? '#a07a4c' : '#c29a68'; ctx.fillRect(jitter(i + 1) * 384, jitter(i + 2) * 224, 2, 2); }
      const sheets: [number, number, number, number, string][] = [[14, 14, 70, 96, '#2f6db5'], [96, 10, 90, 64, '#d8452b'], [198, 16, 76, 100, '#2e8b57'], [288, 12, 80, 60, '#e0a21b'], [20, 122, 96, 86, '#2f3e5c'], [130, 88, 70, 120, '#7f8a83'], [214, 128, 80, 82, '#d8452b'], [304, 86, 66, 124, '#2f6db5']];
      for (const [sx, sy, w, h, head] of sheets) {
        ctx.fillStyle = '#f2efe6'; ctx.fillRect(sx, sy, w, h);
        ctx.fillStyle = head; ctx.fillRect(sx + 6, sy + 6, w - 12, 8);
        ctx.fillStyle = '#9a978f'; for (let l = 0; l < (h - 26) / 7; l++) ctx.fillRect(sx + 6, sy + 22 + l * 7, (w - 12) * (.6 + jitter(sx + l) * .4), 2);
        ctx.fillStyle = '#c0304f'; ctx.beginPath(); ctx.arc(sx + w / 2, sy + 3, 3, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = P.her; ctx.save(); ctx.translate(sx + w - 14, sy + h - 14); ctx.rotate((jitter(sx) - .5) * .5); ctx.fillRect(-11, -11, 22, 22); ctx.restore();
      }
      ctx.strokeStyle = '#6b4a2c'; ctx.lineWidth = 10; ctx.strokeRect(0, 0, 384, 224);
    }), .2);
    const boardCells = plan.flatMap((row, pz) => row[0] === 'N' ? [pz] : []);
    if (boardCells.length) {
      const bz = (boardCells[0] + boardCells[boardCells.length - 1]) / 2, w = boardCells.length * 1.1;
      part(root, 'Tablón de corcho', 'plane', board, [x(0) + .53, 1.65, z(bz)], [w, 1, w * 224 / 384], [90, 90, 0], false);
    }

    // The counter: laminate on a panelled front, a glass screen above it with the finestreta cut
    // in, its sign and opening hours; the flap at the end that lets staff through.
    const row = plan.findIndex(r => r.includes('K')), cz = z(row);
    const glass = mat('#cfe0e2', .92, 0, 'glass');
    glass.blendType = pc.BLEND_NORMAL; glass.opacity = .16; glass.depthWrite = false; glass.update();
    const alu = mat('#b9bec0', .6, 0, 'steel');
    for (const [a, b] of runs(xs, i => 'KW'.includes(glyph(i, row)))) {
      const cx = x((a + b) / 2), len = b - a + 1;
      part(root, 'Mostrador', 'box', front, [cx, .5, cz], [len, 1, .66]);
      part(root, 'Encimera', 'box', laminate, [cx, 1.02, cz], [len + .04, .04, .8]);
      part(root, 'Zócalo del mostrador', 'box', black, [cx, .05, cz + .335], [len, .1, .01], [0, 0, 0], false);
      for (let px = a; px <= b + 1; px += 1.5) part(root, 'Perfil', 'box', alu, [x(Math.min(px, b + .5) - .5), 1.55, cz - .05], [.04, 1.02, .04], [0, 0, 0], false);
      // The glass, with the finestreta's opening left at counter height.
      for (const [g0, g1] of runs(Array.from({ length: len }, (_, i) => a + i), i => glyph(i, row) !== 'W')) {
        part(root, 'Mampara', 'box', glass, [x((g0 + g1) / 2), 1.55, cz - .05], [g1 - g0 + 1, .95, .012], [0, 0, 0], false, false);
      }
    }
    cells('W', (px, pz) => {
      part(root, 'Mampara de la finestreta', 'box', glass, [x(px), 1.78, z(pz) - .05], [1, .5, .012], [0, 0, 0], false, false);
      part(root, 'Bandeja', 'box', alu, [x(px), 1.05, z(pz) + .05], [.5, .02, .45], [0, 0, 0], false);
      part(root, 'Rótulo de la finestreta', 'plane', sign('SECRETARIA'), [x(px), 2.2, z(pz) - .03], [1.1, 1, .28], [90, 0, 0], false);
      const hours = painted(canvas(128, 96, ctx => {
        ctx.fillStyle = '#f2efe6'; ctx.fillRect(0, 0, 128, 96);
        ctx.fillStyle = '#2b2b2b'; ctx.font = 'bold 13px Arial, sans-serif'; ctx.fillText("Horari d'atenció", 10, 22);
        ctx.font = '13px Arial, sans-serif'; ctx.fillText('Matins: 9:00 – 10:30', 10, 48); ctx.fillText('Tardes: 16:30 – 17:00', 10, 70);
      }), .2);
      part(root, 'Horario', 'plane', hours, [x(px) + .42, 1.62, z(pz) - .04], [.3, 1, .22], [90, 0, 0], false);
      sticky(root, [x(px) - .3, 1.75, z(pz) - .035], 'south', 7);
      part(root, 'Sello de entrada', 'box', black, [x(px) - .35, 1.08, z(pz) + .1], [.08, .1, .06], [0, 0, 0], false);
    });
    cells('F', (px, pz) => part(root, 'Trampilla levantada', 'box', laminate, [x(px) + .46, 1.4, z(pz)], [.04, .76, .72]));

    // The queue facing the finestreta, as still as the rest: coats on, a form in every hand.
    const coats = ['#4a4f57', '#6b5a4a', '#3d4a5c', '#5c5c55', '#7a6f62', '#384046'], hair = ['#2a211c', '#4a3a2c', '#8a8a86', '#1c1a18'];
    const skin = mat('#c99a7c', .3), trousers = mat('#2a2c30', .3);
    function person(px: number, pz: number, yaw: number, k: number, size = 1) {
      const p = at(px, pz, 'En la cola'); p.setLocalEulerAngles(0, yaw, 0); p.setLocalScale(size, size, size);
      const coat = mat(coats[k % coats.length], .25);
      for (const side of [-1, 1]) part(p, 'Pierna', 'box', trousers, [side * .1, .4, 0], [.15, .8, .17]);
      part(p, 'Abrigo', 'box', coat, [0, 1.08, 0], [.48, .78, .28]);
      for (const side of [-1, 1]) part(p, 'Brazo', 'box', coat, [side * .3, 1.1, -.02], [.12, .62, .14], [-8, 0, side * 3], false);
      part(p, 'Cabeza', 'sphere', skin, [0, 1.63, -.03], [.23, .27, .25], [0, 0, 0], false);
      part(p, 'Pelo', 'sphere', mat(hair[k % hair.length], .3), [0, 1.67, .02], [.25, .25, .25], [0, 0, 0], false);
      part(p, 'Impreso', 'box', paper, [.27, .82, -.12], [.02, .3, .21], [0, 0, 0], false);
      return p;
    }
    let k = 0;
    cells('q', (px, pz) => {
      // Up the column they face the finestreta (north); the tail turns to follow the line (west).
      const tail = glyph(px - 1, pz) === 'q';
      const child = tail && glyph(px + 1, pz) === 'q';
      person(px, pz, tail ? 90 : 0, k++, child ? .62 : 1);
    });

    // A row of waiting chairs on their beam, facing the counter; a form left on one.
    const perforated = mat('#4c5258', .45, 0, 'steel');
    for (const [a, b] of runs(xs, i => glyph(i, row + 2) === 'h')) {
      part(root, 'Viga', 'box', frameGrey, [x((a + b) / 2), .32, z(row + 2)], [b - a + 1, .05, .05]);
      for (const end of [a, b]) part(root, 'Pata', 'box', frameGrey, [x(end), .16, z(row + 2)], [.05, .32, .5], [0, 0, 0], false);
      for (let px = a; px <= b; px++) {
        part(root, 'Asiento', 'box', perforated, [x(px), .45, z(row + 2)], [.46, .05, .44]);
        part(root, 'Respaldo', 'box', perforated, [x(px), .72, z(row + 2) + .22], [.46, .42, .04], [-8, 0, 0], false);
      }
      part(root, 'Impreso olvidado', 'box', paper, [x(a + 2), .48, z(row + 2)], [.3, .005, .21], [0, 20, 0], false);
    }

    // The photocopier, which has not stopped: copies of a blank sheet sliding out, piling up.
    cells('X', (px, pz) => {
      const copier = at(px, pz, 'Fotocopiadora');
      const shell = mat('#dcdcd6', .35);
      part(copier, 'Cuerpo', 'box', shell, [0, .48, 0], [1, .96, .72]);
      part(copier, 'Bandejas', 'box', mat('#c4c5c0', .3), [0, .3, .37], [.9, .02, .02], [0, 0, 0], false);
      part(copier, 'Bandejas', 'box', mat('#c4c5c0', .3), [0, .55, .37], [.9, .02, .02], [0, 0, 0], false);
      part(copier, 'Tapa', 'box', mat('#3b3e42', .4), [0, 1.0, 0], [.9, .08, .6]);
      part(copier, 'Panel', 'box', mat('#7fd38a', .5, .9), [.2, .97, .34], [.3, .05, .06], [-20, 0, 0], false);
      part(copier, 'Salida', 'box', shell, [.62, .8, 0], [.25, .03, .4], [0, 0, -8], false);
      for (let i = 0; i < 6; i++) part(copier, 'Copias', 'box', paper, [.64, .82 + i * .01, 0], [.21, .008, .3], [0, (jitter(i) - .5) * 8, -8], false);
      const sheet = part(copier, 'Copia', 'box', paper, [.5, .86, 0], [.21, .006, .3], [0, 0, -8], false, false);
      animated.push(time => { const k = (time * .45) % 1; sheet.setLocalPosition(.45 + k * .25, .86 + k * .03, 0); });
      for (let i = 0; i < 18; i++) part(copier, 'Copia caída', 'box', paper, [.75 + jitter(i + 40) * .5, .008 + (i % 3) * .004, (jitter(i + 60) - .5) * 1.4], [.21, .005, .3], [0, jitter(i + 80) * 180, 0], false);
      sticky(copier, [-.3, .97, .2], 'up', 3);
    });

    // On the north wall: shelves of binders (registers, enrolments, grants, by school year), the
    // clock stopped at nine, and Direcció's door.
    const binders = painted(canvas(512, 96, ctx => {
      ctx.fillStyle = '#2a2c2e'; ctx.fillRect(0, 0, 512, 96);
      const colours = [P.binder, P.manila, '#8a3b3b', P.binder, '#3c6a4a', '#2a2a30', P.manila, P.binder, '#7f8a83'];
      let bx = 0, i = 0;
      while (bx < 512) {
        const w = 14 + (i % 3) * 3, h = 74 + (i % 4) * 5;
        ctx.fillStyle = colours[i % colours.length]; ctx.fillRect(bx, 96 - h, w - 1, h);
        ctx.fillStyle = '#efeadb'; ctx.fillRect(bx + 3, 96 - h + 14, w - 7, 22);
        ctx.fillStyle = '#efeadb88'; ctx.beginPath(); ctx.arc(bx + w / 2, 96 - 16, 3, 0, Math.PI * 2); ctx.fill();
        bx += w; i++;
      }
    }), .3);
    const shelfFrom = 8, shelfTo = W - 2, shelfLen = shelfTo - shelfFrom + 1, shelfX = x((shelfFrom + shelfTo) / 2);
    binders.diffuseMapTiling.set(shelfLen / 3, 1); binders.emissiveMapTiling.set(shelfLen / 3, 1); binders.update();
    for (const y of [.12, .82, 1.52]) {
      part(root, 'Estante', 'box', frameGrey, [shelfX, y, z(0) + .68], [shelfLen, .03, .34], [0, 0, 0], false);
      part(root, 'Archivadores', 'plane', binders, [shelfX, y + .34, z(0) + .82], [shelfLen, 1, .62], [90, 0, 0], false);
    }
    part(root, 'Estante', 'box', frameGrey, [shelfX, 2.22, z(0) + .68], [shelfLen, .03, .34], [0, 0, 0], false);
    for (let px = shelfFrom; px <= shelfTo + 1; px += 3) part(root, 'Montante', 'box', frameGrey, [x(Math.min(px, shelfTo + .5) - .5), 1.12, z(0) + .68], [.04, 2.24, .34], [0, 0, 0], false);
    for (let i = 0; i < 6; i++) sticky(root, [x(shelfFrom + 1 + jitter(i + 300) * (shelfLen - 2)), .45 + (i % 3) * .7, z(0) + .83], 'south', i + 30);
    const clock = painted(canvas(96, 96, ctx => {
      ctx.fillStyle = '#f4f2ea'; ctx.beginPath(); ctx.arc(48, 48, 44, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#2b2b2b'; ctx.lineWidth = 5; ctx.stroke();
      for (let h = 0; h < 12; h++) { const a = h / 12 * Math.PI * 2; ctx.fillRect(48 + Math.sin(a) * 36 - 1.5, 48 - Math.cos(a) * 36 - 1.5, 3, 3); }
      ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(48, 48); ctx.lineTo(48 - 22, 48); ctx.stroke();
      ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(48, 48); ctx.lineTo(48, 14); ctx.stroke();
    }), .3);
    onNorthWall('Reloj', clock, 16.5, .5, 2.55, .5);
    northDoor(6, 'DIRECCIÓ', false);
    lowDoor(4, D - 1);

    // Pairs of bare tubes overhead, greenish and flat; one has died.
    const tube = mat(P.tube, .5, 1.3), dead = mat('#9aa39a', .4);
    const fixtures: [number, number][] = [[8, 5], [18, 5], [8, 11], [18, 11], [9, 17], [19, 17]];
    fixtures.forEach(([px, pz], i) => {
      for (const dz of [-.08, .08]) part(root, 'Fluorescente', 'cylinder', i === 3 ? dead : tube, [x(px), 3.1, z(pz) + dz], [.04, 1.22, .04], [0, 0, 90], false);
    });
    lamp(8, 2.9, 6, 1, 10); lamp(19, 2.9, 7, 1, 10); lamp(12, 2.9, 17, .9, 10);
  }

  // ——— El salón del trono ——————————————————————————————————————————————————————————————————
  function dressTrono() {
    const gold = mat(P.gold, .6, 0, 'steel'), curtain = surface('curtain', .3), boards = surface('stage', .45);
    const walnut = surface('dado', .35), runnerMat = surface('runner', .25);
    const cells = (c: string, fn: (px: number, pz: number) => void) => plan.forEach((row, pz) => [...row].forEach((g, px) => { if (g === c) fn(px, pz); }));
    /** Velvet hung in pleats: a flat backing and round folds, from `y0` to `y1`, along x or z. */
    function drape(name: string, from: number, to: number, at: number, along: 'x' | 'z', y0: number, y1: number, depth = .14) {
      const len = to - from, mid = (from + to) / 2, h = y1 - y0;
      slab(root, name, curtain, along === 'x' ? [x(mid), y0 + h / 2, z(at)] : [x(at), y0 + h / 2, z(mid)], along === 'x' ? [len, h, .04] : [.04, h, len]);
      for (let k = 0; k < Math.round(len / .3); k++) {
        const c = from + .15 + k * .3, off = (jitter(k + from * 7) - .5) * .04;
        part(root, `${name}: pliegue`, 'cylinder', curtain, along === 'x' ? [x(c), y0 + h / 2, z(at) + .05 + off] : [x(at) + .05 + off, y0 + h / 2, z(c)], [.26, h, depth]);
      }
    }

    // The stage: varnished boards on a walnut front with a gold edge and a row of footlights; the
    // apron runs between its corner steps. Feet follow it up.
    const top = .8, stageRows = plan.flatMap((r, pz) => r.includes('S') ? [pz] : []);
    const s0 = stageRows[0], s1 = stageRows[stageRows.length - 1], sMid = (s0 + s1) / 2, sDepth = s1 - s0 + 1;
    slab(root, 'Escenario', boards, [x((W - 1) / 2), top / 2, z(sMid)], [W - 2, top, sDepth]);
    kit.surface?.((W - 1) / 2, sMid, W - 2, sDepth, top);
    const apron = runs(xs, i => glyph(i, s1 + 1) === '_'), steps = runs(xs, i => glyph(i, s1 + 1) === 's');
    for (const [a, b] of apron) {
      slab(root, 'Proscenio', boards, [x((a + b) / 2), top / 2, z(s1 + 1)], [b - a + 1, top, 1]);
      slab(root, 'Frente del escenario', walnut, [x((a + b) / 2), top / 2 - .02, z(s1 + 1) + .51], [b - a + 1, top - .04, .02], false);
      part(root, 'Filo dorado', 'box', gold, [x((a + b) / 2), top, z(s1 + 1) + .5], [b - a + 1.02, .05, .05], [0, 0, 0], false);
      const foot = mat('#ffe2b0', .5, 1.4);
      for (let px = a + .5; px <= b; px += 1) {
        part(root, 'Candileja', 'box', mat('#2a2220', .4), [x(px), top + .05, z(s1 + 1) + .3], [.36, .1, .16], [0, 0, 0], false);
        part(root, 'Luz de candileja', 'box', foot, [x(px), top + .07, z(s1 + 1) + .385], [.3, .05, .01], [0, 0, 0], false);
      }
    }
    for (const [a, b] of steps) {
      slab(root, 'Escalones', boards, [x((a + b) / 2), top / 4, z(s1 + 1)], [b - a + 1, top / 2, 1]);
      part(root, 'Filo dorado', 'box', gold, [x((a + b) / 2), top / 2, z(s1 + 1) + .5], [b - a + 1, .04, .04], [0, 0, 0], false);
      kit.surface?.((a + b) / 2, s1 + 1, b - a + 1, 1, top / 2);
    }
    // The wings' front, where the stage meets the floor beside the steps.
    for (const [a, b] of runs(xs, i => glyph(i, s1) === 'c')) slab(root, 'Frente del escenario', walnut, [x((a + b) / 2), top / 2 - .02, z(s1) + .51], [b - a + 1, top - .04, .02], false);
    lamp(12.5, 1.2, s1 + 2.2, .7, 6, new pc.Color().fromString('#ffd9a0'));

    // Velvet: the backcloth along the north wall on both sides of the balcony and the west wing's
    // legs. The east wing is the hall's store, as in every school: folding chairs stacked low
    // against the wall, so nothing tall stands between the camera and the stage.
    const balcony = runs(xs, i => glyph(i, 0) === 'O')[0];
    drape('Telón de fondo', .5, balcony[0] - .5, .58, 'x', top, tall - .1);
    drape('Telón de fondo', balcony[1] + .5, W - 1.5, .58, 'x', top, tall - .1);
    const frame = mat(P.chair, .5, 0, 'steel'), seat = mat(P.seat, .35);
    for (const [a, b] of runs(xs, i => glyph(i, s0) === 'c')) {
      if (a < W / 2) { for (const pz of [s0 + .9, s0 + 3.2]) drape('Bastidor', a - .5, b + .5, pz, 'x', top, tall - .4, .18); continue; }
      for (let pz = s0; pz <= s1; pz += 2) {
        const stack = at(b - .6, pz + .5, 'Sillas apiladas'); stack.setLocalEulerAngles(0, (jitter(pz) - .5) * 10, 0);
        part(stack, 'Carro', 'box', frame, [0, top + .06, 0], [1, .08, .6]);
        for (let k = 0; k < 6 + (pz % 3) * 2; k++) {
          part(stack, 'Silla plegada', 'box', seat, [(jitter(k + pz) - .5) * .06, top + .14 + k * .055, 0], [.9, .04, .45]);
          part(stack, 'Marco', 'box', frame, [(jitter(k + pz) - .5) * .06, top + .14 + k * .055, .24], [.94, .02, .02], [0, 0, 0], false);
        }
      }
    }

    // The balcony through the north wall, behind her throne: gold doors thrown open, a railing, and
    // the night city (the view in the gallery's «Desde el balcón»: a tower of colours, an endless avenue).
    const [b0, b1] = balcony, bx = x((b0 + b1) / 2), bw = b1 - b0 + 1, open = 4.6;
    slab(root, 'Muro bajo el balcón', surface('wall'), [bx, top / 2, z(0)], [bw, top, 1]);
    slab(root, 'Dintel del balcón', surface('wall'), [bx, (open + tall) / 2, z(0)], [bw, tall - open, 1]);
    for (const side of [-1, 1]) {
      part(root, 'Marco dorado', 'box', gold, [bx + side * (bw / 2 - .06), (top + open) / 2, z(0) + .45], [.14, open - top, .14], [0, 0, 0], false);
      const leaf = new pc.Entity('Hoja del balcón'); leaf.setLocalPosition(bx + side * (bw / 2 - .1), 0, z(0) - .1); leaf.setLocalEulerAngles(0, -side * 70, 0); root.addChild(leaf);
      part(leaf, 'Hoja', 'box', gold, [-side * .7, (top + open) / 2, 0], [1.4, open - top - .1, .06]);
      part(leaf, 'Cristal', 'box', mat('#1d2350', .9, .15, 'glass'), [-side * .7, (top + open) / 2, .035], [1.15, open - top - .4, .01], [0, 0, 0], false);
    }
    part(root, 'Marco dorado', 'box', gold, [bx, open, z(0) + .45], [bw, .16, .14], [0, 0, 0], false);
    for (let k = 0; k <= bw * 5; k++) part(root, 'Barrote', 'box', gold, [bx - bw / 2 + k / 5, top + .5, z(0) - .2], [.03, 1, .03], [0, 0, 0], false);
    part(root, 'Barandilla', 'box', gold, [bx, top + 1.02, z(0) - .2], [bw, .06, .08], [0, 0, 0], false);
    const city = painted(canvas(512, 384, ctx => {
      const sky = ctx.createLinearGradient(0, 0, 0, 384);
      sky.addColorStop(0, '#070a20'); sky.addColorStop(.14, '#141a44'); sky.addColorStop(.28, '#3a2a4a'); sky.addColorStop(.34, '#1a1a36');
      ctx.fillStyle = sky; ctx.fillRect(0, 0, 512, 384);
      for (let i = 0; i < 40; i++) { ctx.fillStyle = '#ffffff70'; ctx.fillRect(jitter(i + 3000) * 512, jitter(i + 3100) * 60, 1.5, 1.5); }
      // The skyline sits high: the throne hides the bottom of the view.
      ctx.translate(0, -60);
      // Collserola far off on the right, its tower's red lights.
      ctx.fillStyle = '#10142e'; ctx.beginPath(); ctx.moveTo(250, 170); ctx.quadraticCurveTo(400, 128, 512, 152); ctx.lineTo(512, 200); ctx.lineTo(250, 200); ctx.fill();
      ctx.fillStyle = '#ff5050'; ctx.fillRect(431, 118, 2, 22); ctx.fillRect(429, 118, 6, 2);
      // The blocks: rows of roofs with their windows lit, nearer and bigger towards the bottom.
      for (let rowY = 178; rowY < 444; rowY += 18 + (rowY - 178) * .25) {
        const scale = 1 + (rowY - 178) / 60;
        for (let bxp = -10; bxp < 512; bxp += 22 * scale) {
          const h = (10 + jitter(bxp + rowY) * 16) * scale;
          ctx.fillStyle = '#0d1029'; ctx.fillRect(bxp, rowY - h, 21 * scale, h + 20 * scale);
          for (let wy = rowY - h + 3 * scale; wy < rowY; wy += 5 * scale) for (let wx = bxp + 3 * scale; wx < bxp + 19 * scale; wx += 5 * scale) {
            if (jitter(wx * 3 + wy) < .35) { ctx.fillStyle = jitter(wx + wy * 7) < .7 ? '#ffcf7a' : '#cfe0ff'; ctx.fillRect(wx, wy, 2 * scale, 2 * scale); }
          }
        }
      }
      // The Sagrada Família's towers, lit, on the left.
      ctx.fillStyle = '#c9b48a';
      for (const [tx, th] of [[120, 72], [132, 84], [144, 80], [156, 68], [138, 104]] as const) { ctx.beginPath(); ctx.moveTo(tx - 5, 180); ctx.lineTo(tx - 3, 180 - th); ctx.lineTo(tx, 180 - th - 10); ctx.lineTo(tx + 3, 180 - th); ctx.lineTo(tx + 5, 180); ctx.fill(); }
      // The Meridiana: two lines of orange lamps running away to the tower, cars' lights between.
      for (const dx of [-1, 1]) for (let k = 0; k < 26; k++) {
        const f = k / 26, px = 330 + dx * (8 + 200 * f * f), py = 172 + 272 * f * f;
        ctx.fillStyle = '#ffb347'; ctx.beginPath(); ctx.arc(px, py, 1 + f * 3, 0, Math.PI * 2); ctx.fill();
        if (k % 3 === 0) { ctx.fillStyle = dx < 0 ? '#ffffff' : '#ff4a3a'; ctx.fillRect(330 + dx * (3 + 90 * f * f), py, 1 + f * 3, 1 + f * 2); }
      }
      // Torre Glòries, the tower of colours, at the avenue's end.
      ctx.save(); ctx.beginPath(); ctx.ellipse(330, 172, 14, 70, 0, Math.PI, 0); ctx.lineTo(344, 174); ctx.lineTo(316, 174); ctx.closePath(); ctx.clip();
      ['#ff4d7a', '#4da3ff', '#ffe066', '#7fe0c0', '#4da3ff', '#ff4d7a'].forEach((c, i) => { ctx.fillStyle = c; ctx.fillRect(312, 100 + i * 13, 36, 13); });
      for (let i = 0; i < 40; i++) { ctx.fillStyle = '#0d102988'; ctx.fillRect(312, 100 + i * 2, 36, 1); }
      ctx.restore();
    }), .2, 1);
    // Seen from above through the opening, so hung low and tall: the camera looks down onto the city.
    part(root, 'La ciudad de noche', 'plane', city, [bx - 2.9, -.17, z(0) - 1.3], [bw + 4, 1, 6.4], [90, 0, 0], false);
    lamp((b0 + b1) / 2, 3, 1.5, .8, 7, new pc.Color().fromString('#8a98d0'));

    // Her throne: a ball of gum the size of a car on a gum dais, the liquid core glowing in its
    // back; the only saturated colour in the room.
    const thrones = plan.flatMap((r, pz) => [...r].flatMap((g, px) => g === 'Q' ? [[px, pz]] : []));
    const tx = (Math.min(...thrones.map(c => c[0])) + Math.max(...thrones.map(c => c[0]))) / 2;
    const tz = (Math.min(...thrones.map(c => c[1])) + Math.max(...thrones.map(c => c[1]))) / 2;
    const throne = at(tx, tz, 'El trono');
    // The seat is a mass of chewed gum; its back, the bubble she is blowing, swelling and
    // shrinking, her liquid core glowing inside it.
    const chewed = mat('#d94a8c', .75, .05, 'gum');
    part(throne, 'Tarima de chicle', 'cylinder', gumDeep, [0, top + .08, .15], [3.3, .16, 2.5]);
    for (let k = 0; k < 5; k++) {
      const s = jitter(k + 3500);
      part(throne, 'Chicle mascado', 'sphere', k % 2 ? chewed : gumDeep, [(k - 2) * .42, top + .5 + s * .15, .35 + (s - .5) * .3], [.9 + s * .3, .75 + s * .2, 1.2], [0, s * 40, 0]);
    }
    for (const side of [-1, 1]) part(throne, 'Brazo', 'sphere', chewed, [side * 1.05, top + .85, .35], [.55, .7, 1.1]);
    part(throne, 'Centro líquido', 'sphere', mat(P.core, .9, 1.6, 'gum'), [0, top + 2.1, -.45], [.55, .55, .55], [0, 0, 0], false, false);
    const bubbleMat = mat('#ff8cc4', .95, .25, 'gum'); bubbleMat.blendType = pc.BLEND_NORMAL; bubbleMat.opacity = .62; bubbleMat.depthWrite = false; bubbleMat.update();
    const bubble = part(throne, 'Pompa', 'sphere', bubbleMat, [0, top + 2.05, -.5], [2.5, 2.5, 2.1], [0, 0, 0], false, false);
    animated.push(time => { const k = 1 + Math.sin(time * .7) * .045; bubble.setLocalScale(2.5 * k, 2.5 * k, 2.1 * k); });
    for (let k = 0; k < 6; k++) part(throne, 'Goterón', 'sphere', gumDeep, [(jitter(k + 3200) - .5) * 2.6, top + .05, 1 + jitter(k + 3300) * .5], [.3, .05, .5], [0, jitter(k) * 90, 0], false);
    lamp(tx, top + 2.3, tz + .8, 1.1, 5, new pc.Color().fromString(P.core));
    // One spotlight on it, from the dark over the hall.
    const target = new pc.Vec3(x(tx), top + 1.2, z(tz));
    const spot = new pc.Entity('Foco del trono'); spot.setLocalPosition(x(tx), 9, z(tz + 6.5)); root.addChild(spot);
    spot.addComponent('light', { type: 'spot', color: new pc.Color().fromString(P.spot), intensity: 3.2, range: 16, innerConeAngle: 12, outerConeAngle: 19, castShadows: true, shadowResolution: 1024, shadowBias: .2, normalOffsetBias: .05 });
    spot.lookAt(target); spot.rotateLocal(90, 0, 0);

    // The upright piano of the school's concerts, stage left, its score open; its stool.
    cells('n', (px, pz) => {
      if (glyph(px - 1, pz) === 'n') return;
      const piano = at(px + .5, pz, 'Piano');
      const lacquer = mat('#1a1416', .75);
      part(piano, 'Caja', 'box', lacquer, [0, .65 + top, -.1], [1.5, 1.3, .5]);
      part(piano, 'Teclado', 'box', lacquer, [0, .72 + top, .22], [1.42, .08, .26]);
      part(piano, 'Teclas', 'box', mat('#f2efe6', .5), [0, .77 + top, .26], [1.3, .02, .16], [0, 0, 0], false);
      part(piano, 'Partitura', 'box', mat('#f2efe6', .2), [0, 1.05 + top, .17], [.5, .3, .01], [-12, 0, 0], false);
      part(piano, 'Banqueta', 'box', lacquer, [0, .25 + top, .75], [.7, .5, .35]);
    });

    // The school's banner on the backcloth, as on festival days.
    const banner = painted(canvas(512, 96, ctx => {
      ctx.fillStyle = '#e6dcc4'; ctx.fillRect(0, 0, 512, 96);
      ctx.fillStyle = P.door; ctx.font = 'bold 34px Arial, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('INSTITUT ESCOLA REC COMTAL', 256, 50);
      ctx.fillStyle = '#2f3e5c'; ctx.fillRect(0, 0, 512, 8); ctx.fillRect(0, 88, 512, 8);
    }), .15);
    part(root, 'Pancarta', 'plane', banner, [x((4 + balcony[0] - 1) / 2), tall - 1.6, z(0) + .76], [5.2, 1, 1], [90, 0, 0], false);

    // Rows of folding chairs facing the stage, steel frames and dark seats; nobody in them.
    cells('h', (px, pz) => {
      const c = at(px, pz, 'Silla plegable');
      part(c, 'Asiento', 'box', seat, [0, .45, -.02], [.42, .035, .4]);
      part(c, 'Respaldo', 'box', seat, [0, .8, .2], [.42, .26, .03], [-6, 0, 0]);
      for (const side of [-1, 1]) {
        part(c, 'Pata trasera', 'box', frame, [side * .2, .47, .18], [.03, .94, .03], [-6, 0, 0], false);
        part(c, 'Pata delantera', 'box', frame, [side * .2, .23, -.12], [.03, .5, .03], [14, 0, 0], false);
      }
    });
    part(root, 'Programa', 'box', mat('#f2efe6', .2), [x(5), .48, z(plan.findIndex(r => r.includes('h')))], [.21, .006, .3], [0, 15, 0], false);
    // The ochre runner up the aisle, from the stair to the foot of the stage.
    const chairs = plan.find(r => r.includes('h'))!, first = chairs.indexOf('h'), last = chairs.lastIndexOf('h');
    for (const [a, b] of runs(xs, i => i > first && i < last && chairs[i] === '.')) {
      slab(root, 'Alfombra', runnerMat, [x((a + b) / 2), .012, z((s1 + 1.6 + D - 1.5) / 2)], [b - a + .7, .02, D - s1 - 3.1], false);
      for (const side of [-1, 1]) part(root, 'Ribete', 'box', gold, [x((a + b) / 2) + side * (b - a + .7) / 2, .02, z((s1 + 1.6 + D - 1.5) / 2)], [.05, .02, D - s1 - 3.1], [0, 0, 0], false);
    }

    // The west wall: tall windows on the night, hung with velvet; gold sconces between; Direcció's door.
    const sconce = mat('#ffd9a0', .4, 1.2);
    for (const pz of [9.5, 13]) {
      part(root, 'Ventana', 'box', mat('#1d2550', .9, .35, 'glass'), [x(0) + .52, 3.4, z(pz)], [.02, 3, 1.3], [0, 0, 0], false);
      drape('Cortina', pz - 1.4, pz - .55, .62, 'z', 1.5, tall - .4, .16);
      drape('Cortina', pz + .55, pz + 1.4, .62, 'z', 1.5, tall - .4, .16);
      part(root, 'Galería', 'box', gold, [x(0) + .64, tall - .35, z(pz)], [.12, .2, 3], [0, 0, 0], false);
    }
    for (const pz of [7.6, 11.25, 14.6, 18.5]) {
      part(root, 'Aplique', 'box', gold, [x(0) + .58, 2.4, z(pz)], [.1, .3, .16], [0, 0, 0], false);
      part(root, 'Tulipa', 'cone', sconce, [x(0) + .66, 2.62, z(pz)], [.16, .2, .16], [0, 0, 0], false);
    }
    cells('2', (px, pz) => { if (px === 0) westDoor(pz, 'DIRECCIÓ', false); });
    // The stair down to her hall: no school door, her gum round the opening and her light below.
    for (const [a, b] of runs(xs, i => glyph(i, D - 1) === '1')) {
      const stair = at((a + b) / 2, D - 1, 'Escalera de la cortina');
      part(stair, 'Resplandor rosa', 'box', mat('#ff3d8b', .6, 1.2), [0, .02, 0], [b - a + .8, .02, .9], [0, 0, 0], false);
      for (let k = 0; k < 8; k++) {
        const s = jitter(k + 3400), side = k % 2 ? 1 : -1;
        part(stair, 'Chicle', 'sphere', s < .4 ? gumDeep : gum, [side * ((b - a + 1) / 2 + .15), .2 + (k >> 1) * .14, (s - .5) * .8], [.45 + s * .3, .5 + s * .3, .5], [0, 0, 0], false);
      }
    }

    // A pool of light follows the party across the dark floor.
    const pool = lamp(0, 2.6, 0, .9, 4.6, new pc.Color().fromString('#d9c9ae'));
    following.push(focus => pool.setPosition(focus.x, focus.y + 2.6, focus.z));
  }

  ({ patio: dressPatio, gimnasio: dressGym, secretaria: dressSecretaria, trono: dressTrono })[t.zone]();
  void loadReal();

  let time = 0;
  return {
    update(dt: number, animate: boolean, focus?: pc.Vec3) {
      if (focus) for (const follow of following) follow(focus);
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
  // A little light of its own, so the school's orange stays orange in her magenta light.
  const m = new pc.StandardMaterial(); m.diffuse.fromString('#e8742c'); m.emissive.fromString('#e8742c'); m.emissiveIntensity = .35;
  m.gloss = .35; m.useMetalness = false; shine(m, 'paint'); m.update();
  const p = toWorld(22, 13); root.setPosition(p.x, 0, p.z);
  const piece = (s: V3, at: V3) => {
    const e = new pc.Entity('Marco naranja'); e.addComponent('render', { type: 'box', material: m, castShadows: true, receiveShadows: true });
    e.setLocalPosition(...at); e.setLocalScale(...s); root.addChild(e);
  };
  for (const side of [-1, 1]) piece([.16, 2.1, .14], [-.2, 1.05, side * .62]);
  piece([.16, .14, 1.4], [-.2, 2.1, 0]);
  return { destroy() { root.destroy(); m.destroy(); } };
}
