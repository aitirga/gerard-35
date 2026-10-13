import * as pc from 'playcanvas';
import type { Environment, FloorKind, Stairs } from './environments';
import type { PropKit } from './props';

/** What `buildScenery` lends the house, so everything is tracked and destroyed with the scene. */
export interface HomeKit {
  app: pc.Application;
  root: pc.Entity;
  props: PropKit;
  mat: (name: string, hex: string, gloss?: number, glow?: number) => pc.StandardMaterial;
  texture: (canvas: HTMLCanvasElement) => pc.Texture;
  /** Grid → scene coordinates. */
  x: (px: number) => number;
  z: (pz: number) => number;
  /** Registers a walkable top, so feet follow decks, steps and landings. */
  surface: (px: number, pz: number, w: number, d: number, top: number) => void;
}

/** Heights and thickness in world units; one grid cell is one unit. */
const WALL_HEIGHT = 2.6;
const CUT_HEIGHT = 0.42;
const THICKNESS = 0.26;
const FACE = THICKNESS / 2;
/** Extra room around Gerard's silhouette before a wall folds, so he is never seen through a slit. */
const CUT_MARGIN = 0.45;
const FOLD_RATE = 14;
const LINE_GLYPHS = new Set(['#', 'W', 'D', 'G', '+']);
const SOLID_GLYPHS = new Set(['#', 'W', 'D', 'G']);
const MANA = ['#f4efdc', '#3a7fc0', '#433b3b', '#d4492f', '#3f8a4f'];

type Along = 'x' | 'z';
type Face = 'south' | 'east';
interface Fold { pivot: pc.Entity; min: pc.Vec3; max: pc.Vec3; t: number }

/**
 * Builds a floor plan from `environment.plan`: walls, doors, glazing, floors, steps and furniture.
 * Walls and tall furniture fold down to a skirting while they stand between Gerard and the camera.
 */
export function buildHome(kit: HomeKit, environment: Environment) {
  const { app, root, mat, x, z } = kit;
  const plan = environment.plan ?? environment.grid;
  const width = plan[0].length, depth = plan.length;
  const glyph = (px: number, pz: number) => plan[pz]?.[px] ?? ' ';
  const outdoors = environment.id === 'home-entrance';
  const apartment = environment.id === 'meridiana';
  const wallHeight = outdoors ? 2.3 : WALL_HEIGHT;
  const doorTop = outdoors ? 2.05 : 2.2;
  const folds: Fold[] = [];
  const meshes: pc.Mesh[] = [];
  const jitter = (i: number) => { const v = Math.sin(i * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };

  // Bottom-anchored primitives in grid coordinates; `parent` may be a folding pivot.
  function piece(parent: pc.Entity, name: string, type: string, m: pc.Material, px: number, y: number, pz: number, w: number, h: number, d: number, shadows = true) {
    const e = new pc.Entity(name);
    e.addComponent('render', { type, material: m, castShadows: shadows, receiveShadows: true });
    parent.addChild(e); e.setPosition(x(px), y, z(pz)); e.setLocalScale(w, h, d);
    return e;
  }
  const box = (name: string, m: pc.Material, px: number, pz: number, y0: number, w: number, h: number, d: number, parent = root) => piece(parent, name, 'box', m, px, y0 + h / 2, pz, w, h, d);
  const cyl = (name: string, m: pc.Material, px: number, pz: number, y0: number, w: number, h: number, d: number, parent = root) => piece(parent, name, 'cylinder', m, px, y0 + h / 2, pz, w, h, d);
  const ball = (name: string, m: pc.Material, px: number, pz: number, y0: number, w: number, h: number, d: number, parent = root) => piece(parent, name, 'sphere', m, px, y0 + h / 2, pz, w, h, d);
  const cone = (name: string, m: pc.Material, px: number, pz: number, y0: number, w: number, h: number, d: number, parent = root) => piece(parent, name, 'cone', m, px, y0 + h / 2, pz, w, h, d);
  function light(px: number, y: number, pz: number, color = '#ffd9a8', intensity = 1.1, range = 5.5) {
    const e = new pc.Entity('Luz de casa');
    e.addComponent('light', { type: 'omni', color: new pc.Color().fromString(color), intensity, range, castShadows: false });
    root.addChild(e); e.setPosition(x(px), y, z(pz));
  }
  /** A pivot at `base`: everything added to it folds down there while it hides Gerard. */
  function foldaway(x0: number, z0: number, x1: number, z1: number, base: number, top: number) {
    const pivot = new pc.Entity('Pieza plegable');
    root.addChild(pivot); pivot.setPosition(0, base, 0);
    folds.push({ pivot, min: new pc.Vec3(x(x0), base, z(z0)), max: new pc.Vec3(x(x1), top, z(z1)), t: 1 });
    return pivot;
  }
  /** Tall furniture: the part below `split` stays, the rest folds like the walls. */
  function standing(name: string, m: pc.Material, px: number, pz: number, w: number, d: number, h: number, split = 0.9) {
    box(name, m, px, pz, 0, w, split, d);
    const pivot = foldaway(px - w / 2, pz - d / 2, px + w / 2, pz + d / 2, split, h);
    box(name, m, px, pz, split, w, h - split, d, pivot);
    return pivot;
  }
  function canvas(w: number, h = w) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    return [c, c.getContext('2d')!] as const;
  }
  function painted(name: string, c: HTMLCanvasElement, gloss = 0.15, glow = 0) {
    const m = mat(name, '#ffffff', gloss);
    m.diffuseMap = kit.texture(c);
    if (glow) { m.emissive.set(1, 1, 1); m.emissiveMap = m.diffuseMap; m.emissiveIntensity = glow; }
    m.update(); return m;
  }
  /** An upright image facing south (+z) or east (+x), reading left to right. */
  function picture(parent: pc.Entity, m: pc.Material, face: Face, px: number, pz: number, yc: number, w: number, h: number) {
    const holder = new pc.Entity('Imagen');
    parent.addChild(holder); holder.setPosition(x(px), yc, z(pz)); holder.setEulerAngles(0, face === 'east' ? 90 : 0, 0);
    const plane = new pc.Entity('Lámina');
    plane.addComponent('render', { type: 'plane', material: m, castShadows: false, receiveShadows: true });
    holder.addChild(plane); plane.setLocalEulerAngles(90, 0, 0); plane.setLocalScale(w, 1, h);
    return holder;
  }
  /** A framed canvas hung on a wall face; `px`/`pz` is the point on the wall surface. */
  function framed(art: pc.Material, face: Face, px: number, pz: number, yc: number, w: number, h: number, frame: pc.Material = black) {
    const parent = onWall(face, px, pz);
    const [fx, fz] = face === 'south' ? [px, pz + 0.02] : [px + 0.02, pz];
    if (face === 'south') box('Marco', frame, fx, fz, yc - h / 2 - 0.04, w + 0.08, h + 0.08, 0.04, parent);
    else box('Marco', frame, fx, fz, yc - h / 2 - 0.04, 0.04, h + 0.08, w + 0.08, parent);
    picture(parent, art, face, face === 'south' ? px : px + 0.045, face === 'south' ? pz + 0.045 : pz, yc, w, h);
  }
  function customMesh(positions: number[], indices: number[]) {
    // Duplicate vertices per triangle so facets keep hard edges.
    const flat = indices.flatMap(i => positions.slice(i * 3, i * 3 + 3));
    const order = indices.map((_, i) => i);
    const geometry = new pc.Mesh(app.graphicsDevice);
    geometry.setPositions(flat); geometry.setNormals(pc.calculateNormals(flat, order)); geometry.setIndices(order); geometry.update();
    meshes.push(geometry); return geometry;
  }
  const pyramidMesh = customMesh([-.5, 0, -.5, .5, 0, -.5, .5, 0, .5, -.5, 0, .5, 0, 1, 0], [0, 4, 1, 1, 4, 2, 2, 4, 3, 3, 4, 0, 0, 1, 2, 0, 2, 3]);
  const d20Mesh = (() => {
    const t = (1 + Math.sqrt(5)) / 2;
    const p = [-1, t, 0, 1, t, 0, -1, -t, 0, 1, -t, 0, 0, -1, t, 0, 1, t, 0, -1, -t, 0, 1, -t, t, 0, -1, t, 0, 1, -t, 0, -1, -t, 0, 1].map(v => v / 3.8);
    return customMesh(p, [0, 11, 5, 0, 5, 1, 0, 1, 7, 0, 7, 10, 0, 10, 11, 1, 5, 9, 5, 11, 4, 11, 10, 2, 10, 7, 6, 7, 1, 8, 3, 9, 4, 3, 4, 2, 3, 2, 6, 3, 6, 8, 3, 8, 9, 4, 9, 5, 2, 4, 11, 6, 2, 10, 8, 6, 7, 9, 8, 1]);
  })();
  function solid(name: string, geometry: pc.Mesh, m: pc.Material, px: number, pz: number, y0: number, w: number, h: number, d: number, parent = root) {
    const e = new pc.Entity(name);
    e.addComponent('render', { meshInstances: [new pc.MeshInstance(geometry, m)], castShadows: true, receiveShadows: true });
    parent.addChild(e); e.setPosition(x(px), y0, z(pz)); e.setLocalScale(w, h, d);
    return e;
  }

  // ——— Palette: a white, modern house with oak, black steel and a cream sofa ———
  const wall = mat('Pared blanca', outdoors ? '#eeeae2' : '#f4f2ed', 0.1);
  const black = mat('Perfilería negra', '#2a2d30', 0.35);
  const steel = mat('Acero cepillado', '#b7bcbe', 0.8);
  const oak = mat('Roble claro', '#c9a273', 0.3);
  const walnut = mat('Nogal', '#7b573b', 0.35);
  const lacquer = mat('Lacado blanco', '#f8f7f4', 0.55);
  const quartz = mat('Encimera de cuarzo', '#eeeceb', 0.7);
  const linen = mat('Lino', '#e6dfd2', 0.05);
  const cream = mat('Tapizado crema', '#e9d9b8', 0.05);
  const creamLight = mat('Cojines crema', '#f3e9d3', 0.05);
  const charcoal = mat('Antracita', '#3b3f43', 0.3);
  const sky = mat('Luz de ventana', '#d3e8ef', 0.7, 0.45);
  const glow = mat('Luz cálida', '#ffe3b3', 0.2, 1.6);
  const screen = mat('Pantalla', '#86b4d8', 0.8, 0.55);
  const gold = mat('Oro', '#d7ad45', 0.85);
  const leaves = [mat('Hoja', '#5f8a55', 0.3), mat('Hoja clara', '#80a867', 0.3), mat('Hoja oscura', '#476f4b', 0.3)];
  const pot = mat('Maceta blanca', '#e9e5dc', 0.3);
  const soil = mat('Tierra', '#5e4d3c');
  const glass = mat('Vidrio', '#d6ecf0', 0.95);
  glass.opacity = 0.22; glass.blendType = pc.BLEND_NORMAL; glass.depthWrite = false; glass.update();
  // The flat keeps its old cream-painted timber windows; the house has black steel.
  const profile = apartment ? mat('Carpintería crema', '#efe8da', 0.3) : black;

  // ——— Floors: one texture cell per grid cell, aligned with the movement grid ———
  const surfaceTextures = new Map<FloorKind, pc.Texture>();
  function surfaceTexture(kind: FloorKind) {
    const cached = surfaceTextures.get(kind);
    if (cached) return cached;
    const size = 256, [c, ctx] = canvas(size);
    const speckle = (color: string, count: number, s = 2, seed = 0) => {
      ctx.fillStyle = color;
      for (let i = 0; i < count; i++) ctx.fillRect(jitter(i * 3 + seed) * size, jitter(i * 7 + seed + 11) * size, s, s);
    };
    if (kind === 'tile') {
      // Large white porcelain: one tile per cell, soft veining and a pale grout line.
      ctx.fillStyle = '#f3f2ee'; ctx.fillRect(0, 0, size, size);
      for (let i = 0; i < 28; i++) {
        ctx.fillStyle = `rgba(190,186,178,${0.025 + jitter(i) * 0.03})`;
        ctx.beginPath(); ctx.ellipse(jitter(i + 1) * size, jitter(i + 2) * size, 30 + jitter(i + 3) * 60, 6 + jitter(i + 4) * 16, jitter(i + 5) * 3, 0, Math.PI * 2); ctx.fill();
      }
      ctx.strokeStyle = '#d8d5cd'; ctx.lineWidth = 4; ctx.strokeRect(0, 0, size, size);
    } else if (kind === 'stone') {
      ctx.fillStyle = '#c9c1b0'; ctx.fillRect(0, 0, size, size);
      for (let r = 0; r < 2; r++) for (let k = -1; k < 2; k++) {
        const ox = r ? size / 4 : 0, shade = 0.95 + jitter(r * 5 + k) * 0.08;
        ctx.fillStyle = `rgb(${[222, 214, 199].map(v => Math.min(255, v * shade)).join()})`;
        ctx.fillRect(k * size / 2 + ox + 3, r * size / 2 + 3, size / 2 - 6, size / 2 - 6);
      }
      speckle('#00000010', 300, 2, 3);
    } else if (kind === 'deck') {
      ctx.fillStyle = '#6d5238'; ctx.fillRect(0, 0, size, size);
      for (let i = 0; i < 5; i++) {
        const shade = 0.9 + jitter(i + 20) * 0.16;
        ctx.fillStyle = `rgb(${[168, 126, 86].map(v => v * shade).join()})`;
        ctx.fillRect(0, i * size / 5 + 3, size, size / 5 - 6);
        ctx.fillStyle = '#ffffff10'; ctx.fillRect(0, i * size / 5 + 6, size, 3);
      }
    } else if (kind === 'gravel') {
      ctx.fillStyle = '#cfc8b9'; ctx.fillRect(0, 0, size, size);
      speckle('#a39b8b', 900, 4, 5); speckle('#ebe6dc', 700, 3, 9); speckle('#8a8375', 250, 3, 13);
    } else if (kind === 'laminate') {
      // Honey-oak planks, four to a cell, with staggered end joints and a hint of grain.
      ctx.fillStyle = '#8e5f36'; ctx.fillRect(0, 0, size, size);
      for (let i = 0; i < 4; i++) {
        const y = i * size / 4, joint = jitter(i + 31) * size;
        for (const [x0, x1, k] of [[joint - size, joint, 0], [joint, joint + size, 1]] as const) {
          const shade = 0.92 + jitter(i * 3 + k + 40) * 0.14;
          ctx.fillStyle = `rgb(${[178, 128, 84].map(v => Math.min(255, v * shade)).join()})`;
          ctx.fillRect(x0 + 1, y + 1, x1 - x0 - 2, size / 4 - 2);
        }
        ctx.strokeStyle = '#7d522c26'; ctx.lineWidth = 1.5;
        for (let g = 0; g < 4; g++) {
          const gy = y + 8 + jitter(i * 7 + g) * (size / 4 - 16);
          ctx.beginPath(); ctx.moveTo(0, gy);
          for (let px = 0; px <= size; px += 16) ctx.lineTo(px, gy + Math.sin(px / 40 + g + i) * 2.5);
          ctx.stroke();
        }
      }
    } else if (kind === 'terracotta') {
      // Small red clay tiles in a running bond, as in the gallery and on the balcony.
      ctx.fillStyle = '#c9b6a2'; ctx.fillRect(0, 0, size, size);
      for (let r = 0; r < 4; r++) for (let k = -1; k < 2; k++) {
        const ox = r % 2 ? size / 4 : 0, shade = 0.88 + jitter(r * 9 + k + 60) * 0.2;
        ctx.fillStyle = `rgb(${[168, 72, 44].map(v => Math.min(255, v * shade)).join()})`;
        ctx.fillRect(k * size / 2 + ox + 3, r * size / 4 + 3, size / 2 - 6, size / 4 - 6);
      }
      speckle('#00000014', 260, 2, 6); speckle('#ffffff10', 160, 2, 12);
    } else if (kind === 'grass') {
      ctx.fillStyle = '#7c9a5b'; ctx.fillRect(0, 0, size, size);
      speckle('#6a8a4c', 1200, 3, 2); speckle('#93b06b', 800, 2, 7);
    } else {
      ctx.fillStyle = '#b8b4ab'; ctx.fillRect(0, 0, size, size);
      speckle('#00000012', 500, 2, 4); speckle('#ffffff14', 400, 2, 8);
      ctx.strokeStyle = '#9d998f55'; ctx.lineWidth = 2; ctx.strokeRect(0, 0, size, size);
    }
    const t = kit.texture(c); surfaceTextures.set(kind, t); return t;
  }
  const GLOSS: Record<FloorKind, number> = { tile: 0.62, stone: 0.25, deck: 0.2, gravel: 0.05, grass: 0.05, concrete: 0.3, laminate: 0.45, terracotta: 0.15 };
  function surface(kind: FloorKind, w: number, d: number, offset: number) {
    const m = mat(`Suelo: ${kind}`, '#ffffff', GLOSS[kind]);
    m.diffuseMap = surfaceTexture(kind); m.diffuseMapTiling.set(w, d); m.diffuseMapOffset.set(offset, offset); m.update();
    return m;
  }
  // Rooms reach half a cell under their walls, so floors meet the wall centre lines.
  for (const room of environment.rooms ?? []) {
    const px = room.x + (room.w - 1) / 2, pz = room.z + (room.d - 1) / 2, w = room.w + 1, d = room.d + 1;
    const level = room.level ?? 0;
    if (level) {
      box(`Base: ${room.name}`, room.floor === 'deck' ? walnut : wall, px, pz, 0, w, level, d);
      kit.surface(px, pz, w, d, level + 0.02);
    }
    piece(root, `Suelo: ${room.name}`, 'plane', surface(room.floor, w, d, 0.5), px, level + 0.02, pz, w, 1, d, false);
  }
  // Outside the walls: gravel roofs upstairs, a planted verge by the entrance, a flat's landing and light well.
  for (let pz = 0; pz < depth; pz++) {
    for (let px = 0; px < width; px++) {
      if (glyph(px, pz) !== ' ') continue;
      let end = px;
      while (glyph(end + 1, pz) === ' ' && end + 1 < width) end++;
      const w = end - px + 1;
      piece(root, 'Exterior', 'plane', surface(outdoors ? 'grass' : apartment ? 'concrete' : 'gravel', w, 1, 0), px + (w - 1) / 2, 0.01, pz, w, 1, 1, false);
      px = end;
    }
  }

  // ——— Plinth, with a hole where a stairwell goes down ———
  const well = [...plan.join('')].some(g => g === '_') ? (() => {
    const cells = plan.flatMap((row, pz) => [...row].flatMap((g, px) => g === '_' ? [{ px, pz }] : []));
    const xs = cells.map(c => c.px), zs = cells.map(c => c.pz);
    // Reach the wall faces on the enclosed sides; the open south edge meets the hallway floor.
    return { x0: Math.min(...xs) - 1 + FACE, x1: Math.max(...xs) + 1 - FACE, z0: Math.min(...zs) - 1 + FACE, z1: Math.max(...zs) + 0.5 };
  })() : undefined;
  const plinthMat = mat('Maqueta', '#8b887e');
  const bottom = -1.5, top = -0.02;
  const plinth = (x0: number, x1: number, z0: number, z1: number) => {
    if (x1 > x0 && z1 > z0) box('Maqueta', plinthMat, (x0 + x1) / 2, (z0 + z1) / 2, bottom, x1 - x0, top - bottom, z1 - z0);
  };
  const [px0, px1, pz0, pz1] = [-0.6, width - 0.4, -0.6, depth - 0.4];
  const backdrop = mat('Fondo', apartment ? '#6b6964' : '#67746b');
  const ground = (x0: number, x1: number, z0: number, z1: number) => {
    if (x1 > x0 && z1 > z0) box('Fondo', backdrop, (x0 + x1) / 2, (z0 + z1) / 2, -1.15, x1 - x0, 0.2, z1 - z0);
  };
  if (!well) { plinth(px0, px1, pz0, pz1); ground(-100, 100, -100, 100); }
  else {
    plinth(px0, well.x0, pz0, pz1); plinth(well.x1, px1, pz0, pz1);
    plinth(well.x0, well.x1, pz0, well.z0); plinth(well.x0, well.x1, well.z1, pz1);
    ground(-100, well.x0, -100, 100); ground(well.x1, 100, -100, 100);
    ground(well.x0, well.x1, -100, well.z0); ground(well.x0, well.x1, well.z1, 100);
  }

  // ——— Walls from the plan: every wall cell has an arm along x and/or z ———
  const isLine = (px: number, pz: number) => LINE_GLYPHS.has(glyph(px, pz));
  const outside = (px: number, pz: number) => px < 0 || pz < 0 || px >= width || pz >= depth || glyph(px, pz) === ' ';
  const pivots = new Map<string, pc.Entity>();
  function slab(parent: pc.Entity, name: string, m: pc.Material, along: Along, line: number, a0: number, a1: number, y0: number, y1: number, thick = THICKNESS) {
    const mid = (a0 + a1) / 2, len = a1 - a0;
    return along === 'x' ? box(name, m, mid, line, y0, len, y1 - y0, thick, parent) : box(name, m, line, mid, y0, thick, y1 - y0, len, parent);
  }
  function door(along: Along, line: number, a0: number, a1: number, pivot: pc.Entity | null, prev: boolean, next: boolean) {
    const jamb = 0.07, s0 = prev ? a0 : a0 + jamb, s1 = next ? a1 : a1 - jamb;
    const sectional = prev || next;
    if (!prev) slab(root, 'Marco de puerta', black, along, line, a0, a0 + jamb, 0, doorTop + 0.08, THICKNESS + 0.02);
    if (!next) slab(root, 'Marco de puerta', black, along, line, a1 - jamb, a1, 0, doorTop + 0.08, THICKNESS + 0.02);
    slab(root, 'Dintel', black, along, line, a0, a1, doorTop, doorTop + 0.08, THICKNESS + 0.02);
    slab(root, sectional ? 'Puerta del garaje' : 'Puerta', sectional ? garageDoor : frontDoor, along, line, s0, s1, 0, doorTop, 0.08);
    if (sectional) for (let k = 1; k < 5; k++) slab(root, 'Junta', charcoal, along, line, s0, s1, k * doorTop / 5 - 0.01, k * doorTop / 5 + 0.01, 0.1);
    else slab(root, 'Tirador', steel, along, line, s1 - 0.16, s1 - 0.12, 0.7, 1.4, 0.18);
    if (pivot && doorTop + 0.08 < wallHeight) slab(pivot, 'Muro', wall, along, line, a0, a1, doorTop + 0.08, wallHeight);
  }
  function glazing(along: Along, line: number, a0: number, a1: number, pivot: pc.Entity | null, prev: boolean, next: boolean) {
    const top = doorTop + 0.05;
    slab(root, 'Vidrio', glass, along, line, a0, a1, 0.04, top, 0.03).render!.castShadows = false;
    slab(root, 'Perfil inferior', profile, along, line, a0, a1, 0, 0.05, 0.08);
    slab(root, 'Perfil superior', profile, along, line, a0, a1, top, top + 0.06, 0.08);
    if (!prev) slab(root, 'Montante', profile, along, line, a0, a0 + 0.05, 0, top, 0.08);
    slab(root, 'Montante', profile, along, line, a1 - (next ? 0.025 : 0.05), a1 + (next ? 0.025 : 0), 0, top, 0.08);
    if (pivot && top + 0.06 < wallHeight) slab(pivot, 'Muro', wall, along, line, a0, a1, top + 0.06, wallHeight);
  }
  function windowPane(along: Along, line: number, a0: number, a1: number, pivot: pc.Entity, prev: boolean, next: boolean) {
    const sill = 0.85, head = 2.1, i0 = prev ? 0 : 0.1, i1 = next ? 0 : 0.1;
    slab(root, 'Muro', wall, along, line, a0, a1, 0, CUT_HEIGHT);
    slab(pivot, 'Muro', wall, along, line, a0, a1, CUT_HEIGHT, sill);
    slab(pivot, 'Muro', wall, along, line, a0, a1, head, wallHeight);
    if (!prev) slab(pivot, 'Muro', wall, along, line, a0, a0 + i0, sill, head);
    if (!next) slab(pivot, 'Muro', wall, along, line, a1 - i1, a1, sill, head);
    slab(pivot, 'Marco de ventana', profile, along, line, a0 + i0, a1 - i1, sill, head, 0.1);
    slab(pivot, 'Ventana', sky, along, line, a0 + i0 + (prev ? 0.02 : 0.05), a1 - i1 - (next ? 0.02 : 0.05), sill + 0.05, head - 0.05, 0.12);
    slab(pivot, 'Alféizar', lacquer, along, line, a0 + i0, a1 - i1, sill - 0.04, sill, THICKNESS + 0.1);
  }
  const frontDoor = mat('Puerta de entrada', apartment ? '#f1efe9' : '#3a3531', 0.35);
  const garageDoor = mat('Puerta seccional', '#d2d3cf', 0.4);
  for (let pz = 0; pz < depth; pz++) for (let px = 0; px < width; px++) {
    const g = glyph(px, pz);
    if (!SOLID_GLYPHS.has(g)) continue;
    const [l, r, u, dn] = [isLine(px - 1, pz), isLine(px + 1, pz), isLine(px, pz - 1), isLine(px, pz + 1)];
    const arms: { along: Along; a0: number; a1: number }[] = [];
    if (l || r || !(u || dn)) arms.push({ along: 'x', a0: px - (l ? 0.5 : FACE), a1: px + (r ? 0.5 : FACE) });
    if (u || dn) arms.push({ along: 'z', a0: pz - (u ? 0.5 : FACE), a1: pz + (dn ? 0.5 : FACE) });
    for (const { along, a0, a1 } of arms) {
      const line = along === 'x' ? pz : px;
      // Walls facing the camera over open ground stay folded: they would only hide rooms.
      const near = along === 'x' ? outside(px, pz + 1) : outside(px + 1, pz);
      const [x0, x1, z0, z1] = along === 'x' ? [a0, a1, pz - FACE, pz + FACE] : [px - FACE, px + FACE, a0, a1];
      const pivot = near ? null : foldaway(x0, z0, x1, z1, CUT_HEIGHT, wallHeight);
      if (pivot) pivots.set(`${px},${pz},${along}`, pivot);
      const same = (dx: number, dz: number) => glyph(px + dx, pz + dz) === g;
      const [prev, next] = along === 'x' ? [same(-1, 0), same(1, 0)] : [same(0, -1), same(0, 1)];
      if (arms.length === 1 && g === 'D') door(along, line, a0, a1, pivot, prev, next);
      else if (arms.length === 1 && g === 'G') glazing(along, line, a0, a1, pivot, prev, next);
      else if (arms.length === 1 && g === 'W' && pivot) windowPane(along, line, a0, a1, pivot, prev, next);
      else {
        slab(root, 'Muro', wall, along, line, a0, a1, 0, CUT_HEIGHT);
        if (pivot) slab(pivot, 'Muro', wall, along, line, a0, a1, CUT_HEIGHT, wallHeight);
      }
    }
  }
  /** The folding part of the wall behind a point on a south or east face, so hangings fold with it. */
  const onWall = (face: Face, px: number, pz: number) => pivots.get(face === 'east'
    ? `${Math.round(px - FACE)},${Math.round(pz)},z` : `${Math.round(px)},${Math.round(pz - FACE)},x`) ?? root;
  // Oak thresholds mark the open doorways between rooms.
  for (let pz = 0; pz < depth; pz++) for (let px = 0; px < width; px++) {
    if (glyph(px, pz) !== '+') continue;
    const across = SOLID_GLYPHS.has(glyph(px, pz - 1)) || SOLID_GLYPHS.has(glyph(px, pz + 1));
    box('Umbral', oak, px, pz, 0.02, across ? THICKNESS : 1, 0.012, across ? 1 : THICKNESS);
  }

  // ——— Steps: stone blocks outdoors, white risers with oak treads indoors ———
  const riserMat = mat('Peldaño', '#efece6', 0.2);
  const nosing = mat('Canto del peldaño', '#5c554b', 0.3);
  /** One indoor step from `base` to `top`; `drop` is the side it steps down towards.
   * A folding step keeps a skirting and folds the rest like the walls, so it never hides Gerard. */
  function step(px: number, pz: number, w: number, d: number, base: number, top: number, drop: 'north' | 'south', walkable = true, fold = false) {
    const lip = 0.04, dz = drop === 'south' ? lip / 2 : -lip / 2;
    const split = fold ? base + CUT_HEIGHT : base;
    const upper = fold ? foldaway(px - w / 2, pz - d / 2 - lip, px + w / 2, pz + d / 2 + lip, split, top) : root;
    if (fold) box('Peldaño', riserMat, px, pz, base, w, CUT_HEIGHT, d);
    box('Peldaño', riserMat, px, pz, split, w, top - 0.045 - split, d, upper);
    box('Huella de roble', oak, px, pz + dz, top - 0.045, w, 0.045, d + lip, upper);
    box('Sombra del canto', nosing, px, pz + (drop === 'south' ? d / 2 + lip - 0.01 : -d / 2 - lip + 0.01), top - 0.06, w, 0.015, 0.02, upper);
    if (walkable) kit.surface(px, pz, w, d, top);
  }
  function steps(s: Stairs) {
    const count = s.up === 'north' ? s.d : s.w;
    const side = 0.5 - FACE;
    const stones = [mat('Escalón de piedra', '#d3cab8', 0.25), mat('Escalón de piedra', '#c7bda9', 0.25)];
    for (let i = 0; i < count; i++) {
      const top = s.from + (s.to - s.from) * (i + 1) / (count + 1);
      const [px, pz, w, d] = s.up === 'north'
        ? [s.x + (s.w - 1) / 2, s.z + s.d - 1 - i, s.w + 2 * side, 1]
        : [s.x + i, s.z + (s.d - 1) / 2, 1, s.d + 2 * side];
      if (!outdoors) { step(px, pz, w, d, 0, top, 'south'); continue; }
      box('Escalón', stones[i % 2], px, pz, 0, w, top, d);
      // From above only the treads show, so a dark nosing marks where each step drops.
      box('Canto', nosing, px - 0.47, pz, top, 0.06, 0.006, d);
      kit.surface(px, pz, w, d, top);
    }
  }
  for (const flight of environment.stairs ?? []) steps(flight);

  // ——— Reusable furniture ———
  function plant(px: number, pz: number, size = 1, vessel: pc.Material = pot) {
    cyl('Maceta', vessel, px, pz, 0, 0.36 * size, 0.38 * size, 0.36 * size);
    cyl('Tierra', soil, px, pz, 0.37 * size, 0.3 * size, 0.02, 0.3 * size);
    for (let i = 0; i < 5; i++) {
      const a = i * 2.4 + px, r = 0.12 * size;
      ball('Hojas', leaves[i % 3], px + Math.cos(a) * r, pz + Math.sin(a) * r, (0.4 + (i % 3) * 0.18) * size, 0.32 * size, 0.36 * size, 0.3 * size);
    }
  }
  /** A slim four-legged chair; `facing` is where the sitter looks, `base` the floor it stands on. */
  function chair(px: number, pz: number, facing: 'north' | 'south' | 'east' | 'west', seat: pc.Material, frame: pc.Material = black, base = 0) {
    const [bx, bz] = facing === 'north' ? [0, 1] : facing === 'south' ? [0, -1] : facing === 'east' ? [-1, 0] : [1, 0];
    const leg = 0.035, spread = 0.18;
    for (const u of [-spread, spread]) for (const v of [-spread, spread]) {
      // The rear legs rise past the seat as the backrest posts.
      const rear = bx * u + bz * v > 0;
      box(rear ? 'Poste del respaldo' : 'Pata de silla', frame, px + u, pz + v, base, leg, rear ? 0.9 : 0.43, leg);
    }
    box('Bastidor del asiento', frame, px, pz, base + 0.4, 2 * spread + leg, 0.03, 2 * spread + leg);
    box('Asiento', seat, px - bx * 0.01, pz - bz * 0.01, base + 0.43, 0.42, 0.05, 0.42);
    const [w, d] = bx ? [0.03, 2 * spread] : [2 * spread, 0.03];
    box('Respaldo', seat, px + bx * spread, pz + bz * spread, base + 0.6, w, 0.26, d);
    box('Remate del respaldo', frame, px + bx * spread, pz + bz * spread, base + 0.87, w + 0.01, 0.03, d + leg);
  }
  function rug(px: number, pz: number, w: number, d: number, fill: string, border: string) {
    const [c, ctx] = canvas(256, Math.max(32, Math.round(256 * d / w)));
    ctx.fillStyle = border; ctx.fillRect(0, 0, c.width, c.height);
    ctx.fillStyle = fill; ctx.fillRect(10, 10, c.width - 20, c.height - 20);
    ctx.strokeStyle = border; ctx.lineWidth = 2; ctx.strokeRect(20, 20, c.width - 40, c.height - 40);
    ctx.fillStyle = '#ffffff0c'; for (let i = 0; i < 300; i++) ctx.fillRect(jitter(i + w) * c.width, jitter(i + d) * c.height, 2, 2);
    const e = box('Alfombra', painted('Alfombra', c, 0.02), px, pz, 0.02, w, 0.018, d);
    e.render!.castShadows = false;
  }
  function books(px: number, pz: number, y0: number, width: number, along: Along = 'x', seed = 0, parent = root) {
    const colors = ['#8c3b32', '#2f4a6b', '#d1a54a', '#3f6b4f', '#e7dcc6', '#5a3f5f', '#c8643f'];
    let at = -width / 2;
    for (let i = 0; at < width / 2 - 0.04; i++) {
      const t = 0.035 + jitter(seed + i) * 0.035, h = 0.18 + jitter(seed + i + 9) * 0.1;
      const m = bookMaterials[(seed + i) % colors.length] ??= mat('Lomo', colors[(seed + i) % colors.length], 0.3);
      if (along === 'x') box('Libro', m, px + at + t / 2, pz, y0, t, h, 0.2, parent);
      else box('Libro', m, px, pz + at + t / 2, y0, 0.2, h, t, parent);
      at += t + 0.005;
    }
  }
  const bookMaterials: pc.StandardMaterial[] = [];

  // ——— Procedural art for walls, posters and cards ———
  const PALETTES = [
    ['#f3ead8', '#c66b4a', '#e0a84f', '#2f4466'], ['#ece7dc', '#8fa58a', '#2c2c2c', '#e9c3b0'],
    ['#efe6d4', '#2f4466', '#c66b4a', '#8fa58a'], ['#f4efe6', '#d9a44b', '#50656f', '#b85c43'],
  ];
  function art(seed: number, w: number, h: number) {
    const [c, ctx] = canvas(256, Math.round(256 * h / w));
    const [bg, a, b, k] = PALETTES[seed % PALETTES.length], W = c.width, H = c.height;
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    const style = seed % 4;
    if (style === 0) { // colour fields
      ctx.fillStyle = a; ctx.fillRect(W * 0.12, H * 0.1, W * 0.76, H * 0.42);
      ctx.fillStyle = b; ctx.fillRect(W * 0.12, H * 0.58, W * 0.76, H * 0.3);
    } else if (style === 1) { // sun over Mediterranean hills
      ctx.fillStyle = a; ctx.beginPath(); ctx.arc(W * 0.62, H * 0.38, W * 0.18, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = b; ctx.beginPath(); ctx.moveTo(0, H); ctx.quadraticCurveTo(W * 0.3, H * 0.45, W * 0.65, H * 0.8); ctx.lineTo(W, H); ctx.fill();
      ctx.fillStyle = k; ctx.beginPath(); ctx.moveTo(W * 0.3, H); ctx.quadraticCurveTo(W * 0.75, H * 0.55, W, H * 0.72); ctx.lineTo(W, H); ctx.fill();
    } else if (style === 2) { // arcs and a line
      for (let i = 0; i < 3; i++) { ctx.strokeStyle = [a, b, k][i]; ctx.lineWidth = W * 0.07; ctx.beginPath(); ctx.arc(W * 0.5, H * 0.95, W * (0.2 + i * 0.12), Math.PI, 0); ctx.stroke(); }
      ctx.fillStyle = k; ctx.fillRect(W * 0.1, H * 0.15, W * 0.05, H * 0.5);
    } else { // stacked shapes
      ctx.fillStyle = a; ctx.beginPath(); ctx.arc(W * 0.35, H * 0.35, W * 0.2, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = b; ctx.fillRect(W * 0.45, H * 0.4, W * 0.4, H * 0.45);
      ctx.fillStyle = k; ctx.beginPath(); ctx.moveTo(W * 0.1, H * 0.9); ctx.lineTo(W * 0.4, H * 0.55); ctx.lineTo(W * 0.7, H * 0.9); ctx.fill();
    }
    ctx.fillStyle = '#00000008'; for (let i = 0; i < 400; i++) ctx.fillRect(jitter(i + seed * 13) * W, jitter(i + seed * 17) * H, 2, 2);
    return painted('Cuadro', c, 0.1);
  }
  const hang = (seed: number, face: Face, px: number, pz: number, yc: number, w: number, h: number, frame: pc.Material = black) =>
    framed(art(seed, w, h), face, px, pz, yc, w, h, frame);
  function sign(text: string, face: Face, px: number, pz: number, yc: number, w: number, h: number, bg: string, fg: string, font = '600 64px sans-serif') {
    const [c, ctx] = canvas(256, Math.round(256 * h / w));
    ctx.fillStyle = bg; ctx.fillRect(0, 0, c.width, c.height);
    ctx.fillStyle = fg; ctx.font = font; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text, c.width / 2, c.height / 2 + 2, c.width - 24);
    const parent = onWall(face, px, pz);
    const [bx, bz] = face === 'south' ? [px, pz + 0.015] : [px + 0.015, pz];
    if (face === 'south') box('Placa', black, bx, bz, yc - h / 2 - 0.015, w + 0.03, h + 0.03, 0.03, parent);
    else box('Placa', black, bx, bz, yc - h / 2 - 0.015, 0.03, h + 0.03, w + 0.03, parent);
    picture(parent, painted(text, c, 0.3), face, face === 'south' ? px : px + 0.035, face === 'south' ? pz + 0.035 : pz, yc, w, h);
  }

  // ——— Rooms ———
  if (environment.id === 'home-entrance') entrance();
  else if (environment.id === 'home-floor-1') floorOne();
  else if (environment.id === 'home-floor-2') floorTwo();
  else if (apartment) meridiana();

  function entrance() {
    const west = FACE, north = FACE;
    sign('20', 'east', west, 1.1, 1.55, 0.36, 0.3, '#f2eee6', '#2a2d30', '600 150px sans-serif');
    box('Felpudo', mat('Coco', '#8a6a45', 0.05), 1.35, 2, 0.02, 0.6, 0.02, 0.85);
    // A long planter of grasses and wall lights along the open corridor.
    box('Jardinera', charcoal, 4.6, north + 0.23, 0, 6, 0.48, 0.46);
    box('Tierra', soil, 4.6, north + 0.23, 0.47, 5.9, 0.02, 0.38);
    for (let i = 0; i < 16; i++) cone('Gramínea', leaves[i % 3], 1.8 + i * 0.37, north + 0.18 + jitter(i) * 0.12, 0.48, 0.22, 0.45 + jitter(i + 3) * 0.3, 0.22);
    for (const px of [2.5, 5.6]) {
      box('Aplique', black, px, north + 0.04, 1.55, 0.24, 0.12, 0.08);
      box('Luz del aplique', glow, px, north + 0.08, 1.52, 0.2, 0.03, 0.05);
      light(px, 1.5, 0.9, '#ffd49a', 0.8, 3.5);
    }
    // Garage: the family car facing the street door, shelves and a pair of bikes.
    kit.props.place({ kind: 'car', x: 2, z: 7, color: '#9aa4a8' }, root, new pc.Vec3(x(2.3), 0, z(7.5))).setLocalEulerAngles(0, 90, 0);
    const shelf = foldaway(1.2, 4 + FACE, 4.4, 4.6, 0, 1.8);
    for (const y of [0.05, 0.6, 1.15, 1.7]) box('Balda', steel, 2.8, 4.37, y, 3.2, 0.03, 0.42, shelf);
    for (const px of [1.25, 4.35]) box('Montante', steel, px, 4.37, 0, 0.04, 1.75, 0.42, shelf);
    const kraft = mat('Caja de cartón', '#b8905f', 0.1);
    for (let i = 0; i < 6; i++) box('Caja', kraft, 1.6 + (i % 3) * 1.05, 4.35, [0.08, 0.63, 1.18][i % 3] + 0.001, 0.5 + jitter(i) * 0.3, 0.3 + jitter(i + 4) * 0.15, 0.36, shelf);
    for (const pz of [9.2, 9.8]) {
      for (const px of [4.4, 5.3]) { const wheel = cyl('Rueda de bici', black, px, pz, 0.34, 0.62, 0.04, 0.62); wheel.setEulerAngles(90, 0, 0); }
      box('Cuadro de bici', mat('Bici', pz < 9.5 ? '#c8553d' : '#3f7896', 0.5), 4.85, pz, 0.45, 0.9, 0.05, 0.04);
    }
    // Patio: gravel, stepping stones, a bench and pots around the olive tree.
    const paver = mat('Losa', '#e2ddd2', 0.2);
    for (const [px, pz] of [[7.6, 4.8], [8.2, 5.8], [7.8, 6.9], [8.4, 8.1], [8.0, 9.3], [8.6, 10.3]]) cyl('Pisadera', paver, px, pz, 0.01, 0.55, 0.03, 0.5);
    box('Banco', oak, 6.42, 8.6, 0.38, 0.5, 0.06, 1.8);
    for (const pz of [7.9, 9.3]) box('Pata de banco', charcoal, 6.42, pz, 0, 0.42, 0.38, 0.12);
    plant(10.6, 10.55, 0.9); plant(9.7, 5.45, 0.7);
    // Patio 2: a raised deck with an outdoor sofa and a dining table by the doors.
    const deck = 0.56, cushion = mat('Cojín exterior', '#d9d6cf', 0.05);
    box('Sofá de exterior', charcoal, 14, north + 0.4, deck, 3, 0.36, 0.78);
    box('Cojines', cushion, 14, north + 0.44, deck + 0.36, 2.9, 0.12, 0.68);
    box('Respaldo', cushion, 14, north + 0.1, deck + 0.36, 2.9, 0.42, 0.2);
    for (const px of [12.6, 15.4]) box('Brazo', charcoal, px, north + 0.4, deck, 0.2, 0.58, 0.78);
    // A long oak table along the glazing, leaving a path to the sliding door free.
    const tx = 16.45, tz = 6, tw = 0.85, tl = 2.8, th = 0.72;
    box('Mesa larga', oak, tx, tz, deck + th - 0.05, tw, 0.05, tl);
    box('Faldón', charcoal, tx, tz, deck + th - 0.11, tw - 0.12, 0.06, tl - 0.12);
    for (const dx of [-1, 1]) for (const dz of [-1, 1]) box('Pata de mesa', charcoal, tx + dx * (tw / 2 - 0.07), tz + dz * (tl / 2 - 0.08), deck, 0.06, th - 0.05, 0.06);
    box('Camino de mesa', linen, tx, tz, deck + th, 0.32, 0.006, tl - 0.4);
    const outdoorChair = mat('Silla de exterior', '#343739', 0.3);
    for (const pz of [5, 6, 7]) { chair(tx - 0.88, pz, 'east', cushion, outdoorChair, deck); chair(tx + 0.88, pz, 'west', cushion, outdoorChair, deck); }
    chair(tx, tz - tl / 2 - 0.5, 'south', cushion, outdoorChair, deck); chair(tx, tz + tl / 2 + 0.5, 'north', cushion, outdoorChair, deck);
    for (const pz of [5.2, 6.8]) {
      cyl('Farol', glow, tx, pz, deck + th, 0.12, 0.18, 0.12);
      box('Tapa del farol', black, tx, pz, deck + th + 0.18, 0.14, 0.02, 0.14);
      light(tx, deck + 1.2, pz, '#ffcf8f', 0.7, 3.2);
    }
    ball('Cuenco', mat('Cerámica', '#d9cbb5', 0.4), tx, tz, deck + th, 0.3, 0.09, 0.3);
    for (let i = 0; i < 3; i++) ball('Limón', mat('Limón', '#efcf45', 0.4), tx - 0.05 + i * 0.05, tz + (i % 2) * 0.05, deck + th + 0.06, 0.09, 0.08, 0.08);
    box('Felpudo', mat('Coco', '#8a6a45', 0.05), 18.4, 2, deck + 0.02, 0.6, 0.02, 0.85);
    // The terrace's open edge over the patio: a stone lip where Gerard hops down.
    box('Canto de la terraza', mat('Canto de piedra', '#d9d2c3', 0.25), 10.56, 6.75, deck - 0.04, 0.12, 0.06, 4.5);
  }

  function floorOne() {
    const west = FACE, north = FACE;
    // Hall: console, round mirror, bench and a tall plant.
    box('Consola', oak, 6.2, north + 0.2, 0.78, 1.8, 0.05, 0.4);
    for (const px of [5.4, 7.0]) box('Pata de consola', black, px, north + 0.2, 0, 0.04, 0.78, 0.36);
    const mirror = cyl('Espejo', steel, 6.2, north + 0.03, 1.6, 0.8, 0.03, 0.8); mirror.setEulerAngles(90, 0, 0);
    cyl('Jarrón', mat('Cerámica', '#d9cbb5', 0.4), 6.8, north + 0.2, 0.83, 0.14, 0.3, 0.14);
    box('Banco del recibidor', oak, 2.6, north + 0.22, 0.4, 1.3, 0.06, 0.4);
    box('Zapatero', lacquer, 2.6, north + 0.22, 0, 1.2, 0.4, 0.36);
    for (const px of [2.2, 2.6, 3.0]) ball('Colgador', black, px, north + 0.03, 1.7, 0.06, 0.06, 0.06);
    plant(8.5, 0.55, 1.4);
    light(4.5, 2.2, 1.5);
    // Living room: cream sofa facing the TV, arc lamp, oval dining table.
    rug(3, 8.4, 4.4, 3.6, '#d7cdbd', '#b9ab95');
    box('Base del sofá', mat('Base del sofá', '#cdbd9c', 0.05), 2.5, 6.02, 0.05, 3.7, 0.2, 0.9);
    box('Asiento', cream, 2.5, 6.05, 0.2, 3.8, 0.22, 0.95);
    for (const px of [1.35, 2.5, 3.65]) box('Cojín de asiento', creamLight, px, 6.1, 0.42, 1.1, 0.08, 0.72);
    box('Respaldo', cream, 2.5, 5.68, 0.42, 3.8, 0.42, 0.24);
    for (const px of [0.7, 4.3]) box('Brazo del sofá', cream, px, 6.05, 0.2, 0.2, 0.42, 0.95);
    for (const [px, c] of [[1.1, '#d9a446'], [3.9, '#8fa58a'], [2.9, '#f6f0e3']] as const) {
      const cushion = box('Cojín', mat('Cojín', c, 0.05), px, 5.88, 0.5, 0.42, 0.36, 0.12); cushion.setEulerAngles(-12, px * 20, 0);
    }
    cyl('Mesa de centro', mat('Travertino', '#d8cdb8', 0.35), 2.5, 8, 0.3, 1.3, 0.06, 0.8);
    cyl('Base mesa de centro', mat('Travertino oscuro', '#bfb29a', 0.3), 2.5, 8, 0, 0.8, 0.3, 0.4);
    books(2.2, 8, 0.36, 0.35, 'x', 3);
    // Arc floor lamp in the corner behind the sofa.
    cyl('Base de lámpara', mat('Mármol', '#e8e4dc', 0.6), 1.05, 4.1, 0, 0.36, 0.06, 0.36);
    box('Pie de lámpara', black, 1.05, 4.1, 0.06, 0.04, 1.9, 0.04);
    box('Brazo de lámpara', black, 1.5, 4.55, 1.9, 0.04, 0.04, 1.25).setEulerAngles(0, 45, 0);
    cone('Pantalla', black, 1.95, 5.0, 1.55, 0.44, 0.34, 0.44);
    ball('Bombilla', glow, 1.95, 5.0, 1.5, 0.14, 0.1, 0.14);
    light(1.95, 1.4, 5.1, '#ffd49a', 1.3, 4.5);
    // Media console and TV on the south wall; the screen lights the sofa.
    box('Mueble de TV', walnut, 2.5, 11.62, 0, 3.4, 0.42, 0.42);
    box('Televisor', black, 2.5, 11.6, 0.58, 1.7, 0.96, 0.05);
    box('Pie de TV', black, 2.5, 11.6, 0.42, 0.5, 0.16, 0.2);
    box('Imagen de TV', screen, 2.5, 11.57, 0.62, 1.62, 0.88, 0.01);
    light(2.5, 1.1, 10.6, '#9cc3ea', 0.6, 3.5);
    // Oval dining table with six chairs next to the kitchen opening.
    cyl('Mesa ovalada', oak, 6.5, 9, 0.72, 1.05, 0.05, 2.1);
    for (const pz of [8.5, 9.5]) cyl('Pie de mesa', black, 6.5, pz, 0, 0.12, 0.72, 0.12);
    for (const pz of [8.5, 9.5]) { chair(5.78, pz, 'east', linen); chair(7.22, pz, 'west', linen); }
    chair(6.5, 7.72, 'south', linen); chair(6.5, 10.28, 'north', linen);
    ball('Frutero', mat('Cerámica', '#d9cbb5', 0.4), 6.5, 9, 0.77, 0.36, 0.1, 0.36);
    light(6.5, 2.1, 9, '#ffd9a8', 1.2, 4.5);
    // Art over the sofa nook, sheer curtains by the west window, a fig tree by the TV.
    hang(2, 'south', 2.5, 3 + FACE, 1.6, 1.7, 0.95);
    for (const pz of [4.5, 6.5]) box('Visillo', mat('Visillo', '#f4efe4', 0.05), west + 0.06, pz, 0.05, 0.05, 2.35, 0.36);
    plant(8.45, 11.45, 1.6);
    // Stairwell: a U-shaped stair, as seen going down from floor 2. The lower flight climbs
    // north to the landing, the upper one turns back south; it folds away so Gerard stays in view.
    const rise = 1.32 / 6, spine = 10.5;
    for (let k = 1; k <= 5; k++) {
      step((9 + FACE + spine - 0.005) / 2, 7 - k, spine - 0.005 - 9 - FACE, 1, 0, rise * k, 'south');
      step((spine + 0.005 + 12 - FACE) / 2, 1 + k, 12 - FACE - spine - 0.005, 1, 0, 1.32 + rise * k, 'north', k <= 2, true);
    }
    hang(5, 'east', 9 + FACE, 5.4, 1.25, 0.62, 0.82);
    hang(6, 'east', 9 + FACE, 3.9, 1.7, 0.78, 0.56);
    hang(7, 'east', 9 + FACE, 2.4, 2.05, 0.56, 0.72, oak);
    hang(1, 'south', 10.5, north, 2.0, 1.25, 0.72, oak);
    light(10.5, 2.4, 3.5, '#ffe0b5', 0.9, 4);
    // Bathroom behind the stairs: shower, floating vanity, wall-hung toilet.
    box('Plato de ducha', lacquer, 13.5, 0.82, 0.02, 2.72, 0.03, 1.36);
    box('Mampara', glass, 13.9, 1.5, 0.05, 1.3, 1.95, 0.02).render!.castShadows = false;
    box('Perfil de mampara', black, 13.9, 1.5, 2.0, 1.3, 0.03, 0.03);
    box('Rociador', black, 13.5, 0.5, 2.05, 0.3, 0.02, 0.3);
    box('Mueble de lavabo', walnut, 12 + FACE + 0.24, 3.9, 0.35, 0.48, 0.4, 1.3);
    box('Lavabo', lacquer, 12 + FACE + 0.24, 3.9, 0.75, 0.42, 0.08, 0.52);
    box('Grifo', black, 12 + FACE + 0.06, 3.9, 0.83, 0.04, 0.18, 0.04);
    box('Espejo', steel, 12 + FACE + 0.02, 3.9, 1.15, 0.03, 0.8, 0.9, onWall('east', 12 + FACE, 3.9));
    box('Inodoro', lacquer, 14.62, 5, 0.3, 0.46, 0.3, 0.38);
    box('Tapa', lacquer, 14.64, 5, 0.6, 0.42, 0.03, 0.34);
    light(13.5, 2.2, 3.5, '#fff0dc', 0.8, 3.5);
    // Studio: oak desk under the north window, bookcase, reading chair.
    box('Escritorio', oak, 18.2, north + 0.4, 0.72, 3, 0.05, 0.76);
    for (const px of [16.9, 19.5]) box('Caballete', black, px, north + 0.4, 0, 0.06, 0.72, 0.62);
    box('Monitor', black, 18.2, north + 0.18, 0.95, 0.9, 0.52, 0.04);
    box('Imagen del monitor', screen, 18.2, north + 0.205, 0.98, 0.84, 0.46, 0.01);
    box('Pie del monitor', black, 18.2, north + 0.12, 0.77, 0.2, 0.18, 0.12);
    box('Teclado', lacquer, 18.2, north + 0.56, 0.77, 0.5, 0.02, 0.16);
    chair(18.2, 1.55, 'north', charcoal);
    const bookcase = standing('Librería', lacquer, 15 + FACE + 0.18, 3.5, 0.36, 2.6, 2.1, 0.45);
    for (const [i, y] of [0.5, 1.02, 1.54].entries()) {
      box('Balda', oak, 15 + FACE + 0.18, 3.5, y, 0.37, 0.03, 2.5, bookcase);
      books(15 + FACE + 0.2, 3.5, y + 0.03, 2.3, 'z', i * 5, bookcase);
    }
    box('Butaca', mat('Butaca', '#b86b4b', 0.05), 20.4, 5, 0.2, 0.78, 0.26, 0.78);
    box('Respaldo de butaca', mat('Butaca', '#b86b4b', 0.05), 20.72, 5, 0.46, 0.16, 0.44, 0.78);
    box('Patas de butaca', walnut, 20.4, 5, 0, 0.6, 0.2, 0.6);
    rug(18.3, 3.8, 3.2, 2.2, '#c9c1b4', '#8f8676');
    plant(16.5, 6.5, 1.1);
    light(18.3, 2.2, 3.4);
    // Kitchen: new, handleless white units, quartz tops, oak island ends and black taps.
    const k = 7 + FACE;
    box('Muebles bajos', lacquer, 15, k + 0.3, 0.08, 3, 0.8, 0.6);
    box('Zócalo', charcoal, 15, k + 0.28, 0, 3, 0.08, 0.56);
    box('Encimera', quartz, 15, k + 0.31, 0.88, 3.04, 0.04, 0.62);
    box('Fregadero', steel, 14.5, k + 0.33, 0.9, 0.62, 0.012, 0.42);
    box('Grifo', black, 14.5, k + 0.08, 0.92, 0.04, 0.34, 0.04);
    box('Caño', black, 14.5, k + 0.18, 1.22, 0.04, 0.04, 0.22);
    box('Cafetera', black, 16.05, k + 0.2, 0.92, 0.26, 0.36, 0.3);
    const uppers = foldaway(13.5, k, 16.5, k + 0.38, 1.45, 2.25);
    box('Armarios altos', lacquer, 15, k + 0.18, 1.45, 3, 0.75, 0.36, uppers);
    box('Luz bajo armario', glow, 15, k + 0.3, 1.43, 2.9, 0.02, 0.1, uppers);
    const column = standing('Columnas', lacquer, 19.2, k + 0.32, 3.34, 0.64, 2.3);
    box('Frigorífico', mat('Frigorífico', '#e9e9e6', 0.6), 20.25, k + 0.645, 0.1, 1.08, 0.8, 0.02);
    box('Frigorífico', mat('Frigorífico', '#e9e9e6', 0.6), 20.25, k + 0.645, 0.9, 1.08, 1.35, 0.02, column);
    box('Horno', black, 18.9, k + 0.645, 0.9, 0.62, 0.62, 0.02, column);
    box('Tirador del horno', steel, 18.9, k + 0.66, 1.46, 0.5, 0.02, 0.03, column);
    box('Microondas', black, 18.9, k + 0.645, 1.62, 0.62, 0.38, 0.02, column);
    box('Zócalo', charcoal, 19.2, k + 0.3, 0, 3.34, 0.08, 0.6);
    // Island with an induction hob, lemons and three stools on the south side.
    box('Isla', lacquer, 14.5, 9.5, 0.08, 3.4, 0.8, 1.1);
    for (const px of [12.78, 16.22]) box('Lateral de roble', oak, px, 9.62, 0, 0.06, 0.9, 1.36);
    box('Encimera de la isla', quartz, 14.5, 9.62, 0.88, 3.5, 0.05, 1.36);
    box('Placa de inducción', black, 15.4, 9.35, 0.93, 0.62, 0.008, 0.5);
    ball('Frutero', mat('Cerámica', '#d9cbb5', 0.4), 13.5, 9.4, 0.93, 0.34, 0.08, 0.34);
    for (let i = 0; i < 4; i++) ball('Limón', mat('Limón', '#efcf45', 0.4), 13.42 + (i % 2) * 0.13, 9.35 + (i >> 1) * 0.1, 0.97, 0.1, 0.09, 0.08);
    for (const px of [13.4, 14.5, 15.6]) {
      cyl('Taburete', black, px, 10.32, 0, 0.05, 0.62, 0.05);
      cyl('Asiento de taburete', oak, px, 10.32, 0.62, 0.36, 0.05, 0.36);
      cyl('Reposapiés', black, px, 10.32, 0.25, 0.3, 0.02, 0.3);
    }
    plant(17.6, 11.45, 0.9);
    light(14.5, 2.2, 9.4, '#ffe2b8', 1.3, 5.5);
    // The sliding door stands open over its fixed pane.
    box('Hoja corredera', glass, 21 - 0.08, 8, 0.04, 0.03, doorTop, 1).render!.castShadows = false;
    box('Perfil de hoja', black, 21 - 0.08, 8.48, 0.04, 0.05, doorTop, 0.05);
    box('Carril', black, 21, 9.5, 0.02, 0.1, 0.012, 4);
    // Garden: stepping slabs, loungers, lavender under the north wall, wall lights.
    const slabStone = mat('Losa', '#e2ddd2', 0.2);
    for (const [px, pz] of [[22.1, 9.5], [22.9, 10.1], [23.6, 9.3], [22.6, 8.4]]) box('Losa', slabStone, px, pz, 0.02, 0.6, 0.03, 0.45);
    for (const px of [24, 25]) {
      box('Tumbona', oak, px, 7.55, 0.2, 0.66, 0.08, 1.9);
      box('Colchoneta', creamLight, px, 7.65, 0.28, 0.6, 0.07, 1.6);
      const back = box('Respaldo de tumbona', creamLight, px, 6.75, 0.3, 0.6, 0.06, 0.6); back.setEulerAngles(40, 0, 0);
      for (const pz of [6.8, 8.3]) box('Pata de tumbona', oak, px, pz, 0, 0.6, 0.2, 0.06);
    }
    box('Mesita', charcoal, 24.5, 8.9, 0, 0.3, 0.4, 0.3);
    box('Arriate', charcoal, 23.5, north + 0.25, 0, 3.4, 0.36, 0.5);
    for (let i = 0; i < 12; i++) ball('Lavanda', mat('Lavanda', '#9a84c4', 0.3), 22.1 + i * 0.26, north + 0.25 + (i % 2) * 0.1, 0.34, 0.2, 0.28, 0.2);
    for (const pz of [2.6, 5.4]) {
      box('Aplique exterior', black, 21 + FACE + 0.04, pz, 1.7, 0.08, 0.2, 0.14, onWall('east', 21 + FACE, pz));
      light(21.7, 1.8, pz, '#ffd49a', 0.6, 3);
    }
  }

  function floorTwo() {
    const north = FACE;
    // Stairwell going down: the upper flight, the landing and the start of the lower flight.
    if (well) {
      // A U-shaped stair: the upper flight drops north to a half landing, the lower one
      // turns back south towards floor 1. Rises match the floor 1 flight.
      const floorBelow = -2.64, rise = 1.32 / 5, run = 0.75, spine = 10.5;
      for (let j = 1; j <= 4; j++) {
        step((spine + 0.05 + well.x1) / 2, well.z1 - run * (j - 0.5), well.x1 - spine - 0.05, run, floorBelow, -rise * j, 'south', j <= 2);
        step((well.x0 + spine - 0.05) / 2, 1.5 + run * (j - 0.5), spine - 0.05 - well.x0, run, floorBelow, -1.32 - rise * j, 'south', false);
        box('Zanca', wall, spine, well.z1 - run * (j - 0.5), floorBelow, 0.1, floorBelow * -1 - rise * j + 0.12, run);
      }
      box('Rellano', riserMat, (well.x0 + well.x1) / 2, (well.z0 + 1.5) / 2, floorBelow, well.x1 - well.x0, 1.32 - 0.045, 1.5 - well.z0);
      box('Huella del rellano', oak, (well.x0 + well.x1) / 2, (well.z0 + 1.5) / 2, -1.32 - 0.045, well.x1 - well.x0, 0.045, 1.5 - well.z0);
      box('Suelo de la planta 1', surface('tile', 3, 3, 0), (well.x0 + well.x1) / 2, (1.5 + well.z1) / 2, floorBelow, well.x1 - well.x0, 0.01, well.z1 - 1.5);
      // Lining sits just inside the hole, so it never shares a face with the plinth.
      for (const [x0, x1, z0, z1] of [[well.x0, well.x0 + 0.03, well.z0, well.z1], [well.x0, well.x1, well.z0, well.z0 + 0.03], [well.x1 - 0.03, well.x1, well.z0, well.z1]]) {
        box('Revestimiento', wall, (x0 + x1) / 2, (z0 + z1) / 2, floorBelow, x1 - x0, -floorBelow, z1 - z0);
      }
      box('Barandilla del tramo', glass, 10.5, 3.3, -0.6, 0.03, 1.6, 3.6).render!.castShadows = false;
      box('Pasamanos del tramo', black, 10.5, 3.3, 1.0, 0.05, 0.04, 3.6);
      // Glass balustrade along the hallway, open where the flight arrives.
      box('Barandilla', glass, (well.x0 + 10.5) / 2, 5.05, 0.02, 10.5 - well.x0, 1, 0.03).render!.castShadows = false;
      box('Pasamanos', black, (well.x0 + 10.5) / 2, 5.05, 1.0, 10.5 - well.x0, 0.04, 0.05);
      box('Poste', black, 10.5, 5.05, 0, 0.05, 1.04, 0.05);
      box('Pasamanos', black, 12.82, 3, 0.8, 0.04, 0.04, 3.5).setEulerAngles(-18, 0, 0);
      hang(8, 'east', 8 + FACE, 1.6, 1.45, 0.66, 0.88);
      hang(9, 'east', 8 + FACE, 3.35, 1.2, 0.8, 0.6, oak);
      hang(10, 'south', 10.9, north, 1.55, 1.3, 0.78);
      // The well sits in the walls' shadow; a low light shows the steps going down.
      light(11.2, -0.4, 2.8, '#ffe6c4', 1.4, 4);
      light(9.4, -1.6, 2.4, '#ffe6c4', 1.2, 3.5);
      light(10.8, 1.6, 2.6, '#ffe0b5', 0.7, 4.5);
    }
    sign('GERARD', 'east', 8 + FACE, 5.1, 1.45, 0.62, 0.2, '#c79a64', '#2d2219', '700 92px serif');
    gerardsRoom();
    // Hallway: runner, gallery wall and a small olive tree at the end.
    rug(15, 6.5, 10, 1.2, '#cfc6b8', '#a39987');
    hang(11, 'south', 16, 5 + FACE, 1.5, 1.1, 0.7);
    for (const [i, px] of [19.7, 20.3].entries()) hang(12 + i, 'south', px, 5 + FACE, 1.55 - i * 0.12, 0.34, 0.44, oak);
    hang(3, 'east', 8 + FACE, 7.05, 1.5, 0.5, 0.5);
    light(12, 2.2, 6.5); light(18, 2.2, 6.5);
    // Bathroom: bath under the window, floating vanity, toilet.
    box('Bañera', lacquer, 14.5, north + 0.38, 0, 1.74, 0.55, 0.74);
    box('Agua', mat('Agua del baño', '#bfe1e6', 0.9), 14.5, north + 0.38, 0.5, 1.6, 0.02, 0.6);
    box('Mueble de lavabo', walnut, 13 + FACE + 0.24, 2.7, 0.35, 0.48, 0.4, 1.1);
    box('Lavabo', lacquer, 13 + FACE + 0.24, 2.7, 0.75, 0.42, 0.08, 0.48);
    box('Espejo', steel, 13 + FACE + 0.02, 2.7, 1.15, 0.03, 0.8, 0.8, onWall('east', 13 + FACE, 2.7));
    box('Inodoro', lacquer, 15.62, 4, 0.3, 0.46, 0.3, 0.38);
    light(14.5, 2.2, 2.5, '#fff0dc', 0.7, 3.5);
    // Other bedroom: a guest bed under the windows.
    bed(18.5, north, 1.9, 2.1, 'south', mat('Funda', '#9fb3b9', 0.05));
    box('Mesita', oak, 17.1, north + 0.3, 0, 0.5, 0.5, 0.5);
    ball('Lámpara de mesita', glow, 17.1, north + 0.3, 0.5, 0.2, 0.24, 0.2);
    rug(18.8, 3.2, 2.6, 1.5, '#d9d2c4', '#b7ab95');
    plant(20.45, 4.45, 1);
    light(18.8, 2.2, 2.6);
    // Parents' bedroom: double bed against the west wall, wardrobe, art above the headboard.
    bed(12, 8 + FACE, 2.2, 2.55, 'east', mat('Funda', '#e7ddd0', 0.05));
    for (const pz of [10.2, 13.8]) {
      box('Mesita', oak, 8 + FACE + 0.28, pz, 0, 0.52, 0.5, 0.5);
      ball('Lámpara de mesita', glow, 8 + FACE + 0.28, pz, 0.5, 0.2, 0.26, 0.2);
    }
    hang(4, 'east', 8 + FACE, 12, 1.5, 1.3, 0.65);
    standing('Armario', lacquer, 12.7, 8 + FACE + 0.36, 2.3, 0.72, 2.25);
    rug(11.5, 12.2, 2.6, 3, '#cfc4b2', '#a8977c');
    light(11, 2.2, 12);
    // Jan's bedroom: bed on the north wall, desk with a laptop, posters.
    bed(18.5, 8 + FACE, 1.4, 2.4, 'south', mat('Funda', '#5f7f63', 0.05));
    box('Escritorio', oak, 14 + FACE + 0.33, 12.5, 0.72, 0.66, 0.05, 1.8);
    for (const pz of [11.7, 13.3]) box('Pata de escritorio', black, 14 + FACE + 0.33, pz, 0, 0.6, 0.72, 0.05);
    box('Portátil', steel, 14 + FACE + 0.35, 12.5, 0.77, 0.3, 0.02, 0.42);
    const lid = box('Pantalla del portátil', black, 14 + FACE + 0.18, 12.5, 0.78, 0.02, 0.28, 0.42); lid.setEulerAngles(0, 0, 10);
    chair(15.15, 12.5, 'west', mat('Silla', '#c8553d', 0.2));
    hang(14, 'east', 14 + FACE, 12.5, 1.55, 0.7, 0.9);
    hang(15, 'east', 14 + FACE, 10.2, 1.5, 0.6, 0.6);
    rug(18, 12.3, 2.8, 2, '#c7cfc4', '#8d9a88');
    light(17.8, 2.2, 11.5);
  }

  /**
   * Gerard and Aitor's flat on the Meridiana, furnished after the photos of every room.
   * The plan is the croquis turned a quarter left: study west, kitchen wall north, balcony east.
   */
  function meridiana() {
    const north = FACE;
    const bodbyn = mat('Cocina crema', '#ece4d1', 0.35);
    const bodbynPanel = mat('Moldura crema', '#ddd2ba', 0.35);
    const butcher = mat('Encimera de roble', '#b7773f', 0.35);
    const ceramic = mat('Cerámica blanca', '#f7f6f2', 0.8);
    const pull = mat('Tirador negro', '#1f1f21', 0.5);
    const paleOak = mat('Roble claro', '#d2ae7c', 0.3);
    const white = mat('Blanco mate', '#f1f0ec', 0.25);
    const graphite = mat('Grafito', '#4a4a4c', 0.3);
    const cork = mat('Corcho', '#c9a26b', 0.1);
    const wallPivot = (px: number, pz: number, along: Along) => pivots.get(`${px},${pz},${along}`) ?? root;
    /** A thin bar from one point to another, for stands, rails and lamp arms. */
    function rod(name: string, m: pc.Material, [x0, y0, z0]: number[], [x1, y1, z1]: number[], t = 0.035, parent = root) {
      const e = piece(parent, name, 'box', m, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, t, t, Math.hypot(x1 - x0, y1 - y0, z1 - z0));
      e.lookAt(x(x1), y1, z(z1));
      return e;
    }
    /** Wall tiles one unit wide, repeated along the wall; `bond` staggers rows like subway tiles. */
    function tiles(name: string, height: number, tw: number, th: number, fill: string, grout: string, bond: boolean) {
      const [c, ctx] = canvas(256, Math.round(256 * height));
      ctx.fillStyle = grout; ctx.fillRect(0, 0, c.width, c.height);
      const W = 256 * tw, H = 256 * th;
      for (let r = 0; r * H < c.height; r++) for (let k = -1; k * W < 256; k++) {
        const x0 = k * W + (bond && r % 2 ? W / 2 : 0), y0 = c.height - (r + 1) * H;
        ctx.fillStyle = fill; ctx.fillRect(x0 + 2, y0 + 2, W - 4, H - 4);
        ctx.fillStyle = '#ffffff66'; ctx.fillRect(x0 + 4, y0 + 4, W - 8, 3);
        ctx.fillStyle = '#00000012'; ctx.fillRect(x0 + 4, y0 + H - 7, W - 8, 3);
      }
      const t = kit.texture(c);
      return (a: number, b: number) => {
        const m = mat(name, '#ffffff', 0.6);
        m.diffuseMap = t; m.diffuseMapTiling.set(b - a, 1); m.diffuseMapOffset.set(a - Math.floor(a), 0); m.update();
        return m;
      };
    }
    /** Tiles a wall face cell by cell, so each piece folds with the wall behind it. */
    function clad(material: (a: number, b: number) => pc.StandardMaterial, face: Face, line: number, a0: number, a1: number, y0: number, y1: number) {
      for (let a = a0; a < a1 - 0.01;) {
        const b = Math.min(a1, Math.floor(a + 0.5) + 0.5), c = (a + b) / 2, m = material(a, b);
        if (face === 'south') box('Alicatado', m, c, line + FACE + 0.01, y0, b - a, y1 - y0, 0.02, onWall('south', c, line + FACE));
        else box('Alicatado', m, line + FACE + 0.01, c, y0, 0.02, y1 - y0, b - a, onWall('east', line + FACE, c));
        a = b;
      }
    }
    /** A swivel chair on a five-star base; `facing` is where the sitter looks. */
    function swivel(px: number, pz: number, facing: 'north' | 'south', seat: pc.Material, back = 0.6, trim?: pc.Material) {
      const dir = facing === 'south' ? 1 : -1;
      for (let i = 0; i < 5; i++) {
        const a = i * 72 + 18, r = a * Math.PI / 180;
        const spoke = box('Pata de la base', black, px + Math.sin(r) * 0.15, pz + Math.cos(r) * 0.15, 0.05, 0.04, 0.04, 0.3); spoke.setEulerAngles(0, a, 0);
        ball('Rueda', black, px + Math.sin(r) * 0.29, pz + Math.cos(r) * 0.29, 0, 0.06, 0.06, 0.06);
      }
      cyl('Pistón', black, px, pz, 0.08, 0.05, 0.36, 0.05);
      box('Asiento', seat, px, pz, 0.44, 0.52, 0.1, 0.5);
      box('Respaldo', seat, px, pz - dir * 0.24, 0.54, 0.48, back, 0.08);
      for (const side of [-1, 1]) box('Reposabrazos', black, px + side * 0.27, pz, 0.62, 0.05, 0.04, 0.32);
      if (trim) {
        for (const side of [-1, 1]) box('Oreja del respaldo', seat, px + side * 0.22, pz - dir * 0.21, 0.54 + back * 0.55, 0.08, back * 0.4, 0.1);
        box('Etiqueta', trim, px + 0.12, pz - dir * 0.285, 0.54 + back * 0.8, 0.07, 0.07, 0.01);
      }
    }
    /** Upright blades in a white pot, like the snake plant by the TV. */
    function snakePlant(px: number, pz: number, size = 1) {
      cyl('Maceta', pot, px, pz, 0, 0.34 * size, 0.36 * size, 0.34 * size);
      const blade = [mat('Sansevieria', '#3f6b3a', 0.3), mat('Sansevieria clara', '#8fa04d', 0.3)];
      for (let i = 0; i < 7; i++) {
        const a = i * 2.3, r = 0.07 * size;
        const leaf = cone('Hoja', blade[i % 2], px + Math.cos(a) * r, pz + Math.sin(a) * r, 0.36 * size, 0.09 * size, (0.55 + jitter(i + px) * 0.4) * size, 0.03);
        leaf.setEulerAngles(Math.sin(a) * 8, a * 40, Math.cos(a) * 8);
      }
    }
    /** Broad paddle leaves on long stems: the bird of paradise by the sofa. */
    function birdOfParadise(px: number, pz: number) {
      cyl('Maceta', pot, px, pz, 0, 0.5, 0.45, 0.5);
      cyl('Tierra', soil, px, pz, 0.44, 0.44, 0.02, 0.44);
      const stem = mat('Tallo', '#5f7f45', 0.3);
      for (let i = 0; i < 8; i++) {
        const a = i * 2.4, lean = 0.12 + (i % 3) * 0.1, h = 0.9 + jitter(i + 7) * 0.7;
        const tip = [px + Math.cos(a) * lean * 2, 0.45 + h, pz + Math.sin(a) * lean * 2];
        rod('Tallo', stem, [px, 0.45, pz], tip, 0.03);
        const leaf = ball('Hoja', leaves[i % 3], tip[0], tip[2], tip[1] - 0.05, 0.26, 0.62, 0.05);
        leaf.setEulerAngles(0, a * 57 + 90, Math.cos(a) * 25);
      }
    }

    // ——— Hall: a small entrance between two short walls that open onto the kitchen. The shoe
    // cabinet, meter, Basque hand and thistle sit against the right-hand wall; coats hang on the
    // back of the left-hand one, with the shoe bench beside it. ———
    box('Telefonillo', white, 5 + FACE + 0.03, 2.05, 1.25, 0.05, 0.24, 0.11, onWall('east', 5 + FACE, 2.05));
    const hallSide = 8 - FACE;
    /** A flat piece hung on the hall side of the short walls, facing into the entrance. */
    function hallArt(m: pc.Material, pz: number, yc: number, w: number, h: number, frame: pc.Material) {
      box('Marco', frame, hallSide - 0.02, pz, yc - h / 2 - 0.03, 0.04, h + 0.06, w + 0.06);
      picture(root, m, 'east', hallSide - 0.045, pz, yc, w, h).setEulerAngles(0, -90, 0);
    }
    box('Zapatero', white, hallSide - 0.17, 1.55, 0.06, 0.33, 0.96, 0.86);
    for (const dz of [-0.38, 0.38]) box('Pata del zapatero', white, hallSide - 0.17, 1.55 + dz, 0, 0.28, 0.06, 0.05);
    box('Junta del zapatero', mat('Junta', '#d9d7d0', 0.3), hallSide - 0.34, 1.55, 0.06, 0.01, 0.96, 0.012);
    for (const dz of [-0.21, 0.21]) for (const y of [0.9, 0.44]) box('Asa', black, hallSide - 0.34, 1.55 + dz, y, 0.01, 0.03, 0.12);
    cyl('Jarra de flores secas', glass, hallSide - 0.2, 1.3, 1.02, 0.1, 0.18, 0.1);
    for (let i = 0; i < 6; i++) ball('Flor seca', mat('Flor seca', ['#c79a3e', '#9a7a52', '#b7b2a0'][i % 3], 0.1), hallSide - 0.18 - (i >> 1) * 0.03, 1.24 + (i % 3) * 0.06, 1.2 + (i % 2) * 0.08, 0.13, 0.12, 0.13);
    box('Bandeja de llaves', mat('Cerámica', '#d9cbb5', 0.4), hallSide - 0.2, 1.68, 1.02, 0.14, 0.02, 0.26);
    box('Contador de la luz', mat('Caja del contador', '#c9ccce', 0.6), hallSide - 0.07, 0.95, 1.62, 0.14, 0.4, 0.34);
    box('Cuadro eléctrico', white, hallSide - 0.03, 0.95, 1.02, 0.06, 0.54, 0.34);
    const [plate, plateCtx] = canvas(256, 60);
    plateCtx.fillStyle = '#1d1d1f'; plateCtx.fillRect(0, 0, 256, 60);
    plateCtx.fillStyle = '#f1efe9'; plateCtx.font = '700 40px sans-serif'; plateCtx.textAlign = 'center'; plateCtx.textBaseline = 'middle';
    plateCtx.fillText('SORIONEKU', 128, 32, 236);
    hallArt(painted('SORIONEKU', plate, 0.3), 1.5, 1.47, 0.34, 0.08, black);
    box('Mano', black, hallSide - 0.02, 1.5, 1.2, 0.02, 0.18, 0.18);
    for (let i = 0; i < 4; i++) box('Dedo', black, hallSide - 0.02, 1.43 + i * 0.047, 1.08, 0.02, 0.12, 0.03);
    hallArt(thistle(), 1.93, 1.68, 0.34, 0.34, oak);
    const hooks = wallPivot(8, 5, 'z');
    box('Colgador', black, hallSide - 0.03, 5.35, 1.72, 0.04, 0.06, 0.8, hooks);
    for (const pz of [5.05, 5.35, 5.65]) box('Gancho', black, hallSide - 0.1, pz, 1.66, 0.12, 0.16, 0.03, hooks);
    box('Calzador rojo', mat('Calzador', '#d63b2f', 0.4), hallSide - 0.08, 5.05, 1.18, 0.03, 0.4, 0.07, hooks);
    box('Bolsa azul', mat('Bolsa azul', '#2f58b8', 0.1), hallSide - 0.08, 5.35, 1.02, 0.06, 0.55, 0.3, hooks);
    box('Mochila', mat('Mochila azul petróleo', '#1f6f78', 0.1), hallSide - 0.14, 5.65, 1.18, 0.2, 0.45, 0.26, hooks);
    box('Bolsillo de mochila', black, hallSide - 0.25, 5.65, 1.2, 0.04, 0.26, 0.2, hooks);
    box('Banco negro', black, 7.05, 5.58, 0.4, 0.8, 0.05, 0.4);
    for (const dx of [-0.36, 0.36]) for (const dz of [-0.16, 0.16]) box('Pata del banco', black, 7.05 + dx, 5.58 + dz, 0, 0.03, 0.4, 0.03);
    box('Balda del banco', black, 7.05, 5.58, 0.12, 0.76, 0.02, 0.36);
    for (const [i, c] of ['#6b3b2c', '#d8d4ca', '#2e2f33'].entries()) box('Zapato', mat('Zapato', c, 0.2), 6.8 + i * 0.25, 5.58, 0.14, 0.12, 0.08, 0.28);
    for (const dx of [0, 0.16]) box('Chancla', mat('Chancla', '#9fd0d6', 0.2), 6.25 + dx, 4.75 + dx, 0.02, 0.1, 0.02, 0.26);
    light(6.8, 2.3, 3, '#ffe4bd', 0.9, 4);

    // ——— Kitchen: cream framed doors with black cup handles, oak butcher-block top, subway tiles ———
    const k0 = 8 + FACE, k1 = 12.52, kd = 0.68, kFront = north + kd + 0.005;
    box('Zócalo', bodbyn, (k0 + k1) / 2, north + kd / 2 - 0.03, 0, k1 - k0, 0.1, kd - 0.06);
    box('Muebles bajos', bodbyn, (k0 + k1) / 2, north + kd / 2, 0.1, k1 - k0, 0.76, kd);
    box('Encimera de roble', butcher, (k0 + k1) / 2, north + kd / 2 + 0.02, 0.86, k1 - k0 + 0.02, 0.05, kd + 0.04);
    function front(cx: number, w: number, y0: number, h: number, handle: 'cup' | 'knob', z0 = kFront) {
      box('Frente', bodbynPanel, cx, z0, y0 + 0.02, w - 0.05, h - 0.04, 0.012);
      box('Plafón', bodbyn, cx, z0 + 0.008, y0 + 0.08, w - 0.17, h - 0.16, 0.012);
      if (handle === 'cup') box('Tirador de concha', pull, cx, z0 + 0.025, y0 + h - 0.1, 0.13, 0.035, 0.03);
      else box('Tirador', pull, cx + w / 2 - 0.09, z0 + 0.025, y0 + h - 0.32, 0.025, 0.13, 0.03);
    }
    front(9.0, 1.0, 0.1, 0.5, 'knob');
    front(10.0, 1.0, 0.1, 0.76, 'cup');
    front(11.0, 1.0, 0.36, 0.5, 'knob'); front(11.0, 1.0, 0.1, 0.26, 'cup');
    for (const [y, h] of [[0.7, 0.16], [0.52, 0.18], [0.1, 0.42]]) front(12.0, 1.0, y, h, 'cup');
    // Farmhouse sink, a gooseneck tap and a few things on the counter.
    box('Fregadero cerámico', ceramic, 9.0, north + 0.46, 0.6, 0.82, 0.32, 0.72);
    box('Seno', mat('Seno del fregadero', '#d9dcdc', 0.7), 9.0, north + 0.44, 0.915, 0.7, 0.01, 0.52);
    cyl('Grifo', steel, 9.0, north + 0.12, 0.91, 0.04, 0.34, 0.04);
    box('Caño', steel, 9.0, north + 0.2, 1.23, 0.03, 0.03, 0.2);
    box('Escurridor', black, 8.3, north + 0.3, 0.91, 0.36, 0.14, 0.26);
    box('Estropajo', mat('Estropajo', '#b9d24a', 0.1), 8.25, north + 0.3, 1.05, 0.1, 0.05, 0.14);
    cyl('Olla negra', black, 9.72, north + 0.34, 0.91, 0.24, 0.26, 0.24);
    cyl('Botella de cristal', glass, 9.98, north + 0.44, 0.91, 0.09, 0.3, 0.09);
    box('Bandeja de aceites', oak, 10.25, north + 0.25, 0.91, 0.32, 0.02, 0.14);
    cyl('Aceite', mat('Aceite', '#c6a432', 0.6), 10.16, north + 0.25, 0.93, 0.06, 0.28, 0.06);
    cyl('Vinagre', mat('Vinagre', '#6b4a2a', 0.6), 10.32, north + 0.25, 0.93, 0.05, 0.2, 0.05);
    box('Placa de inducción', black, 11.0, north + 0.36, 0.912, 0.78, 0.008, 0.52);
    box('Robot de cocina', black, 12.1, north + 0.38, 0.91, 0.5, 0.18, 0.36);
    cyl('Tapa del robot', mat('Tapa verde', '#2f4e3f', 0.5), 12.2, north + 0.4, 1.09, 0.2, 0.03, 0.2);
    cyl('Portarrollos', oak, 11.72, north + 0.2, 0.91, 0.14, 0.02, 0.14);
    cyl('Papel de cocina', white, 11.72, north + 0.2, 0.93, 0.13, 0.28, 0.13);
    const subway = tiles('Azulejo metro', 0.62, 0.2, 0.1, '#f2f1ee', '#d9d7d2', true);
    box('Azulejo metro', subway(k0, k1), (k0 + k1) / 2, north + 0.01, 0.91, k1 - k0, 0.62, 0.02);
    // Wall units either side of the black chimney hood.
    box('Armarios altos', bodbyn, 9.29, north + 0.18, 1.55, 2.22, 0.74, 0.36);
    for (const [cx, side] of [[8.55, 1], [9.29, 1], [10.03, -1]] as const) {
      box('Frente alto', bodbynPanel, cx, north + 0.365, 1.57, 0.7, 0.7, 0.012);
      box('Plafón alto', bodbyn, cx, north + 0.373, 1.63, 0.56, 0.58, 0.012);
      box('Tirador', pull, cx + side * 0.34, north + 0.39, 1.62, 0.025, 0.13, 0.03);
    }
    box('Campana', black, 11.0, north + 0.25, 1.56, 1.0, 0.1, 0.5);
    solid('Campana', pyramidMesh, black, 11.0, north + 0.25, 1.66, 1.0, 0.3, 0.5);
    box('Chimenea', black, 11.0, north + 0.14, 1.9, 0.3, 0.7, 0.26);
    box('Armario alto', bodbyn, 12.05, north + 0.18, 1.4, 0.92, 0.9, 0.36);
    box('Frente alto', bodbynPanel, 12.05, north + 0.365, 1.42, 0.86, 0.86, 0.012);
    box('Plafón alto', bodbyn, 12.05, north + 0.373, 1.48, 0.72, 0.74, 0.012);
    box('Tirador', pull, 11.72, north + 0.39, 1.48, 0.025, 0.13, 0.03);
    light(10.2, 2.3, 2.2, '#ffe6c4', 1.1, 5);
    // Tall units across the kitchen: the fridge with a pine wine rack on top, and the oven column.
    const fridge = standing('Frigorífico', white, 9.02, 5.52, 0.9, 0.7, 1.85);
    const pine = mat('Pino', '#d8b98a', 0.2);
    for (const dx of [-0.34, 0.34]) box('Botellero', pine, 9.02 + dx, 5.52, 1.85, 0.04, 0.38, 0.4, fridge);
    for (const y of [1.87, 2.0, 2.13]) box('Balda del botellero', pine, 9.02, 5.52, y, 0.68, 0.02, 0.4, fridge);
    for (let i = 0; i < 5; i++) {
      const bottle = cyl('Botella', mat('Botella', ['#2f4a2a', '#6b1f2b', '#3a3f25'][i % 3], 0.7), 8.8 + (i % 3) * 0.2, 5.52, 1.94 + (i >> 1) * 0.12, 0.08, 0.36, 0.08, fridge);
      bottle.setEulerAngles(90, 0, 0);
    }
    const column = standing('Columna del horno', bodbyn, 10.02, 5.52, 0.92, 0.7, 2.25);
    box('Cajas sobre la columna', mat('Caja de cartón', '#b8905f', 0.1), 10.0, 5.5, 2.25, 0.6, 0.18, 0.4, column);
    // Rolling standing desk, white frame and light oak top.
    box('Mesa con ruedas', paleOak, 12.0, 5.42, 0.74, 0.95, 0.04, 0.6);
    for (const dx of [-0.4, 0.4]) {
      box('Columna de la mesa', white, 12 + dx, 5.42, 0.08, 0.05, 0.66, 0.05);
      box('Pie de la mesa', white, 12 + dx, 5.42, 0.05, 0.06, 0.04, 0.56);
      for (const dz of [-0.25, 0.25]) ball('Rueda', black, 12 + dx, 5.42 + dz, 0, 0.06, 0.06, 0.06);
    }

    // ——— Study: fold-down bed under grey and white wall units, the piano, desk and gaming chair ———
    const back = 2 + FACE;
    box('Cama abatible', mat('Cama abatible', '#eeebe4', 0.3), 2.5, back + 0.3, 0, 3.3, 1.12, 0.6);
    box('Tapa de roble', paleOak, 2.5, back + 0.31, 1.12, 3.36, 0.04, 0.64);
    for (const px of [0.83, 4.17]) box('Costado', graphite, px, back + 0.31, 0, 0.04, 1.14, 0.62);
    box('Junta', mat('Junta', '#d9d7d0', 0.3), 2.5, back + 0.605, 0.06, 0.012, 1.02, 0.01);
    box('Tirador largo', pull, 1.95, back + 0.63, 0.98, 0.9, 0.025, 0.03);
    // Wall units centred over the bed: a big grey box either side of the white double doors.
    for (const px of [1.2, 3.8]) box('Módulo gris', graphite, px, back + 0.2, 1.6, 0.95, 0.85, 0.4);
    box('Módulo blanco', white, 2.5, back + 0.2, 1.81, 1.66, 0.42, 0.4);
    box('Junta', mat('Junta', '#d9d7d0', 0.3), 2.5, back + 0.405, 1.83, 0.012, 0.38, 0.01);
    // Digital piano on an X stand against the west wall, keys facing the room.
    for (const pz of [4.35, 5.65]) for (const s of [-1, 1]) rod('Soporte en X', black, [0.48 + s * 0.2, 0, pz], [0.48 - s * 0.2, 0.66, pz], 0.035);
    const pianoWhite = mat('Piano blanco', '#f4f3ef', 0.5);
    box('Piano', pianoWhite, 0.47, 5.0, 0.66, 0.44, 0.13, 1.72);
    box('Teclado', ceramic, 0.6, 5.0, 0.79, 0.16, 0.012, 1.6);
    for (let i = 0; i < 36; i++) {
      const octave = Math.floor(i / 5), key = [0.5, 1.5, 3.5, 4.5, 5.5][i % 5];
      const pz = 4.22 + (octave * 7 + key) * 0.0305;
      if (pz < 5.78) box('Tecla negra', black, 0.56, pz, 0.8, 0.09, 0.012, 0.016);
    }
    box('Pedal', black, 0.95, 5.3, 0, 0.14, 0.03, 0.08);
    // Desk under the little window: black top edge, cork mat, monitor, printer on a drawer unit.
    box('Escritorio', mat('Escritorio', '#2b2a2c', 0.3), 1.25, 8.52, 0.72, 2.2, 0.04, 0.68);
    for (const px of [0.25, 2.3]) box('Pata del escritorio', black, px, 8.52, 0, 0.05, 0.72, 0.6);
    box('Alfombrilla de corcho', cork, 1.3, 8.4, 0.76, 0.8, 0.005, 0.3);
    box('Monitor', black, 1.2, 8.72, 0.95, 0.9, 0.5, 0.04);
    box('Pie del monitor', black, 1.2, 8.76, 0.76, 0.2, 0.2, 0.12);
    box('Teclado del PC', black, 1.2, 8.44, 0.765, 0.46, 0.02, 0.14);
    box('Altavoz', black, 1.85, 8.68, 0.76, 0.14, 0.24, 0.16);
    box('Impresora', mat('Impresora', '#3a3b3e', 0.4), 0.45, 8.55, 0.76, 0.46, 0.2, 0.38);
    box('Papel', white, 0.45, 8.45, 0.96, 0.3, 0.01, 0.2);
    box('Torre del PC', black, 2.05, 8.5, 0, 0.22, 0.46, 0.46);
    swivel(1.3, 7.3, 'south', mat('Silla gamer', '#26262a', 0.2), 0.85, mat('Etiqueta amarilla', '#f2d23a', 0.4));
    light(2.6, 2.3, 5.5, '#ffe4bd', 1, 5);

    // ——— Gallery: red clay floor, washer, boiler, outdoor AC unit, drying rack and a railing ———
    for (let pz = 9.2; pz < 12.85; pz += 0.12) box('Barrote', black, 5, pz, 0, 0.025, 1.0, 0.025).render!.castShadows = false;
    for (const y of [0.08, 0.98]) box('Pasamanos', black, 5, 11.0, y, 0.05, 0.04, 3.74);
    rod('Tendedero', mat('Cuerda', '#cfcac0', 0.2), [4.35, 1.95, 9.3], [4.35, 1.95, 12.8], 0.012);
    for (const [pz, c] of [[9.9, '#3b5a86'], [10.6, '#e8e2d5'], [11.5, '#6f8a5a']] as const) box('Ropa tendida', mat('Ropa', c, 0.05), 4.35, pz, 1.35, 0.03, 0.58, 0.45);
    box('Lavadora', white, 6.02, 12.55, 0, 0.6, 0.85, 0.6);
    box('Mandos de la lavadora', mat('Panel gris', '#c9cccf', 0.5), 6.02, 12.28, 0.72, 0.56, 0.1, 0.04);
    for (const [i, c] of ['#f4f4f0', '#2f63b5', '#e9e5da'].entries()) cyl('Detergente', mat('Detergente', c, 0.5), 5.85 + i * 0.16, 12.6, 0.85, 0.1, 0.22, 0.1);
    const boiler = wallPivot(8, 12, 'z');
    box('Caldera', white, 7.7, 11.95, 1.4, 0.32, 0.7, 0.44, boiler);
    for (const dz of [-0.12, 0, 0.12]) box('Tubería', steel, 7.75, 11.95 + dz, 1.1, 0.04, 0.3, 0.04, boiler);
    box('Aire acondicionado portátil', white, 7.1, 12.5, 0, 0.6, 0.78, 0.5);
    cyl('Cubo de fregar', mat('Cubo', '#3c4046', 0.3), 7.1, 11.88, 0, 0.3, 0.26, 0.3);
    for (let i = 0; i < 7; i++) cone('Fregona', mat('Fregona', '#e7cf3a', 0.1), 7.02 + (i % 3) * 0.08, 11.82 + (i >> 1) * 0.04, 0.2, 0.08, 0.2, 0.08).setEulerAngles(180, 0, (i - 3) * 12);
    box('Unidad exterior', white, 7.25, 6.68, 0.08, 1.0, 0.68, 0.36);
    for (const dx of [-0.4, 0.4]) box('Pie de la unidad', black, 7.25 + dx, 6.68, 0, 0.06, 0.08, 0.34);
    cyl('Rejilla del ventilador', mat('Rejilla', '#b7bbbd', 0.3), 7.05, 6.865, 0.42, 0.52, 0.02, 0.52).setEulerAngles(90, 0, 0);
    box('Logo', mat('Logo azul', '#1f5fae', 0.4), 7.6, 6.865, 0.5, 0.2, 0.24, 0.01);
    const lantern = onWall('south', 7.3, 6 + FACE);
    box('Farol de pared', black, 7.3, 6 + FACE + 0.1, 1.85, 0.16, 0.24, 0.16, lantern);
    box('Luz del farol', glow, 7.3, 6 + FACE + 0.1, 1.9, 0.1, 0.12, 0.17, lantern);
    const rack = mat('Tendedero', '#9aa0a4', 0.5);
    for (const [px, pz] of [[6.85, 8.65], [7.7, 8.65], [6.85, 9.4], [7.7, 9.4]]) box('Montante del tendedero', rack, px, pz, 0, 0.025, 1.3, 0.025);
    for (const y of [0.45, 0.85, 1.25]) box('Varillas', rack, 7.27, 9.02, y, 0.86, 0.02, 0.76);
    for (const [i, c] of ['#1f2a3d', '#6b4a3a', '#c9503f', '#8a8f94', '#2f2f33'].entries()) box('Ropa', mat('Ropa', c, 0.05), 6.95 + (i % 3) * 0.33, 8.75 + (i >> 1) * 0.28, 0.75 + (i % 2) * 0.4, 0.26, 0.5, 0.02);
    box('Baúl', mat('Baúl', '#2b2b2d', 0.2), 7.35, 10.5, 0, 0.84, 0.6, 1.6);
    box('Tapa del baúl', mat('Baúl', '#353538', 0.2), 7.35, 10.5, 0.6, 0.88, 0.04, 1.64);
    light(6.4, 2.2, 10, '#fff0dc', 0.8, 4);

    // ——— Bedroom: bed with drawers, headboard with shelves, open oak wardrobe, AC over the windows ———
    const pax = mat('Armario roble', '#c9a36e', 0.25), wireBasket = mat('Cesta blanca', '#ecebe8', 0.4);
    const wz0 = 6 + FACE, wz1 = wz0 + 0.62, wx0 = 8.2, wx1 = 12.8, bays = [8.2, 9.73, 11.27, 12.8];
    const tall = foldaway(wx0, wz0, wx1, wz1, 0.9, 2.62);
    box('Trasera', pax, (wx0 + wx1) / 2, wz0 + 0.02, 0, wx1 - wx0, 0.9, 0.02);
    box('Trasera', pax, (wx0 + wx1) / 2, wz0 + 0.02, 0.9, wx1 - wx0, 1.45, 0.02, tall);
    for (const px of bays) {
      box('Costado', pax, px, (wz0 + wz1) / 2, 0, 0.04, 0.9, wz1 - wz0);
      box('Costado', pax, px, (wz0 + wz1) / 2, 0.9, 0.04, 1.45, wz1 - wz0, tall);
    }
    box('Techo del armario', pax, (wx0 + wx1) / 2, (wz0 + wz1) / 2, 2.33, wx1 - wx0, 0.03, wz1 - wz0, tall);
    const colours = ['#1f2a3d', '#b8503a', '#2f67b0', '#6b4a3a', '#8a8f94', '#e0a646', '#3f5a48', '#d8d2c5', '#a0522d'];
    bays.slice(0, 3).forEach((b0, i) => {
      const b1 = bays[i + 1], cx = (b0 + b1) / 2, w = b1 - b0 - 0.08;
      box('Balda superior', pax, cx, (wz0 + wz1) / 2, 2.0, w, 0.025, wz1 - wz0, tall);
      box('Caja de tela', white, cx, (wz0 + wz1) / 2, 2.03, w - 0.1, 0.28, 0.5, tall);
      box('Barra', steel, cx, (wz0 + wz1) / 2, 1.9, w, 0.025, 0.025, tall);
      const low = i === 1 ? 0.8 : 1.05;
      for (let k = 0, px = b0 + 0.1; px < b1 - 0.1; k++, px += 0.07) {
        const h = 1.88 - low - jitter(k + i * 20) * 0.25;
        box('Prenda', mat('Prenda', colours[(k * 7 + i * 3) % colours.length], 0.05), px, (wz0 + wz1) / 2 + 0.02, 1.88 - h, 0.05, h, 0.44, tall);
      }
      if (i === 2) for (const y of [0.1, 0.4, 0.7]) {
        box('Cajón de roble', pax, cx, wz1 - 0.02, y, w - 0.02, 0.27, 0.04);
        box('Tirador del cajón', black, cx, wz1 + 0.005, y + 0.2, 0.3, 0.02, 0.02);
      } else for (const y of i === 1 ? [0.1, 0.36] : [0.1, 0.36, 0.62]) {
        box('Cesta de rejilla', wireBasket, cx, (wz0 + wz1) / 2 + 0.03, y, w - 0.06, 0.2, 0.5);
        box('Ropa doblada', mat('Ropa doblada', colours[(i * 4 + Math.round(y * 10)) % colours.length], 0.05), cx, (wz0 + wz1) / 2 + 0.03, y + 0.06, w - 0.3, 0.18, 0.36);
      }
    });
    // A double bed with its headboard on the south wall, centred across the room so there is a
    // nightstand with a lamp on each side; a rug under it.
    const bedWhite = mat('Canapé blanco', '#f2f1ee', 0.3), seam = mat('Junta', '#d9d7d0', 0.3);
    const bl = 3.0, bw = 2.0, hz = 17 - FACE - 0.1, bcx = 10.5, bcz = hz - bl / 2;
    box('Alfombra', mat('Alfombra de lana', '#c9b9a0', 0.05), bcx, bcz - 0.35, 0, 3.4, 0.015, 3.8);
    box('Canapé', bedWhite, bcx, bcz, 0, bw, 0.42, bl);
    for (const dz of [-0.75, 0, 0.75]) for (const side of [-1, 1]) box('Cajón del canapé', seam, bcx + side * (bw / 2 + 0.005), bcz + dz, 0.1, 0.01, 0.24, 0.65);
    box('Colchón', ceramic, bcx, bcz, 0.42, bw - 0.08, 0.18, bl - 0.06);
    box('Sábana', mat('Sábana beige', '#d9c7a7', 0.05), bcx, bcz, 0.6, bw - 0.06, 0.02, bl - 0.04);
    const duvet = mat('Nórdico de rayas', '#eadcc6', 0.05);
    box('Nórdico', duvet, bcx, bcz - 0.45, 0.6, bw + 0.04, 0.14, 2.1).setEulerAngles(0, 2, 0);
    box('Nórdico arrugado', duvet, bcx - 0.5, bcz - 0.2, 0.66, 0.9, 0.16, 0.8).setEulerAngles(0, -14, 4);
    for (const dx of [-0.5, 0.5]) box('Almohada', mat('Almohada', '#f1ebe0', 0.05), bcx + dx, hz - 0.3, 0.62, 0.78, 0.13, 0.4);
    for (const [i, c] of ['#8a5a8c', '#2c3a5c', '#6f9a8a'].entries()) box('Ropa sobre la cama', mat('Ropa', c, 0.05), bcx - 0.6 + i * 0.18, bcz - 0.8 - i * 0.12, 0.74 + i * 0.02, 0.4, 0.06, 0.34).setEulerAngles(0, i * 35, 0);
    box('Cabecero', bedWhite, bcx, 17 - FACE - 0.04, 0.3, bw + 0.9, 0.95, 0.08);
    for (const y of [0.62, 0.9]) box('Ranura del cabecero', seam, bcx, 17 - FACE - 0.085, y, bw + 0.8, 0.015, 0.01);
    const nightOak = mat('Mesilla de roble', '#c9a36e', 0.3), shade = mat('Pantalla de lino', '#f3ead8', 0.1, 0.25);
    for (const side of [-1, 1]) {
      const nx = bcx + side * (bw / 2 + 0.38), nz = hz - 0.25;
      box('Mesilla', nightOak, nx, nz, 0, 0.5, 0.5, 0.5);
      box('Cajón de la mesilla', seam, nx, nz - 0.255, 0.22, 0.38, 0.14, 0.01);
      cyl('Pie de la lámpara', black, nx + side * 0.08, nz + 0.05, 0.5, 0.05, 0.3, 0.05);
      cyl('Pantalla de la lámpara', shade, nx + side * 0.08, nz + 0.05, 0.76, 0.28, 0.22, 0.28);
    }
    // Aitor's side (west): water and phone. Gerard's side (east) is where the wrapper turns up.
    cyl('Botella de agua', glass, bcx - bw / 2 - 0.5, hz - 0.35, 0.5, 0.08, 0.24, 0.08);
    box('Móvil', black, bcx - bw / 2 - 0.28, hz - 0.4, 0.5, 0.08, 0.01, 0.15);
    box('Cesto de la ropa', black, 12.45, 10.4, 0, 0.36, 0.55, 0.36);
    const ac = onWall('east', 8 + FACE, 9);
    box('Split', white, 8 + FACE + 0.12, 9, 2.12, 0.24, 0.3, 1.0, ac);
    box('Rejilla del split', mat('Rejilla', '#c9cccf', 0.3), 8 + FACE + 0.245, 9, 2.14, 0.01, 0.06, 0.9, ac);
    light(10.5, 2.3, 14, '#ffe4bd', 0.9, 6);

    // ——— Bathroom: tub with a pale blue curtain, beige square tiles, oak vanity, towel rail ———
    const beige = tiles('Azulejo beige', 1.6, 0.2, 0.2, '#ddd6ca', '#f0ece5', false);
    clad(beige, 'south', 8, 15 + FACE, 18 - FACE, 0, 1.6);
    clad(beige, 'east', 15, 8 + FACE, 10.5, 0, 1.6);
    clad(beige, 'east', 15, 11.5, 13 - FACE, 0, 1.6);
    box('Bañera', ceramic, 16.5, 8.55, 0, 2.68, 0.56, 0.8);
    box('Interior de la bañera', mat('Seno', '#e4e8e8', 0.8), 16.5, 8.5, 0.56, 2.5, 0.005, 0.62);
    cyl('Rociador', steel, 15.55, north + 8.15, 1.9, 0.28, 0.02, 0.28);
    rod('Barra de cortina', steel, [15.13, 2.05, 8.98], [17.87, 2.05, 8.98], 0.025);
    const curtain = mat('Cortina azul', '#a8c4c9', 0.1);
    for (let i = 0; i < 5; i++) box('Cortina', curtain, 16.0 + i * 0.13, 8.98 + (i % 2) * 0.05, 0.4, 0.14, 1.62, 0.04);
    box('Mueble de lavabo', oak, 17.52, 10.05, 0.25, 0.68, 0.55, 0.9);
    box('Lavabo', ceramic, 17.52, 10.05, 0.8, 0.72, 0.08, 0.92);
    box('Grifo', steel, 17.72, 10.05, 0.88, 0.05, 0.16, 0.05);
    for (const dz of [-0.3, 0.3]) cyl('Dosificador', mat('Dosificador', '#e9e4d8', 0.4), 17.75, 10.05 + dz, 0.88, 0.07, 0.16, 0.07);
    box('Inodoro', ceramic, 16.0, 12.55, 0, 0.4, 0.42, 0.6);
    box('Tapa', ceramic, 16.0, 12.72, 0.42, 0.4, 0.44, 0.06).setEulerAngles(-8, 0, 0);
    box('Bidé', ceramic, 17.05, 12.6, 0, 0.38, 0.4, 0.5);
    cyl('Papelera', steel, 16.55, 12.7, 0, 0.26, 0.36, 0.26);
    cyl('Tapa de bambú', mat('Bambú', '#c89a5c', 0.3), 16.55, 12.7, 0.36, 0.28, 0.03, 0.28);
    const rail = onWall('east', 15 + FACE, 9.6);
    for (const pz of [9.3, 9.9]) box('Radiador toallero', ceramic, 15 + FACE + 0.06, pz, 0.6, 0.03, 1.3, 0.03, rail);
    for (let y = 0.65; y < 1.9; y += 0.1) box('Barra del toallero', ceramic, 15 + FACE + 0.06, 9.6, y, 0.025, 0.02, 0.6, rail);
    box('Toalla verde', mat('Toalla verde', '#1f5a3e', 0.05), 15 + FACE + 0.1, 9.45, 0.9, 0.05, 1.0, 0.36, rail);
    box('Toalla granate', mat('Toalla granate', '#5a2438', 0.05), 15 + FACE + 0.1, 9.8, 1.05, 0.05, 0.8, 0.3, rail);
    box('Alfombrilla', mat('Alfombrilla', '#58595b', 0.02), 16.5, 9.35, 0.01, 0.9, 0.02, 0.5);
    box('Báscula', black, 16.3, 11.2, 0.01, 0.3, 0.03, 0.3);
    light(16.7, 2.2, 10.6, '#fff0dc', 0.8, 3.5);

    // ——— Living room: OLED on a floating unit, cream chaise sofa, the desk behind it ———
    box('Mueble de TV', white, 16.75, north + 0.22, 0.3, 2.4, 0.45, 0.44);
    for (const px of [16.0, 16.8, 17.6]) box('Puerta de roble', paleOak, px, north + 0.445, 0.33, 0.76, 0.34, 0.01);
    box('Televisor', mat('Marco del televisor', '#b8bcbf', 0.7), 16.75, north + 0.03, 0.98, 1.84, 1.04, 0.03);
    box('Pantalla apagada', mat('Pantalla apagada', '#15181c', 0.95), 16.75, north + 0.05, 1.0, 1.8, 1.0, 0.01);
    box('Marco de fotos', white, 15.85, north + 0.3, 0.75, 0.2, 0.24, 0.04).setEulerAngles(-10, 0, 0);
    for (const px of [16.3, 17.7]) ball('Altavoz', black, px, north + 0.3, 0.75, 0.16, 0.16, 0.16);
    for (const px of [16.7, 16.9]) cyl('Vela', mat('Vela', '#f5eedc', 0.2), px, north + 0.28, 0.75, 0.08, 0.1, 0.08);
    box('Mando', black, 17.2, north + 0.34, 0.75, 0.16, 0.04, 0.1);
    box('Gatillos', mat('Gatillos amarillos', '#f2c230', 0.4), 17.2, north + 0.3, 0.77, 0.14, 0.02, 0.03);
    snakePlant(18.05, north + 0.4, 1.3);
    box('Radiador', ceramic, 18.95, north + 0.07, 0.15, 0.7, 0.62, 0.1);
    // Sofa facing the TV: two wide seat blocks between low arms, tall headrests, rust and sand cushions.
    const sofa = mat('Sofá crema', '#d9c7a6', 0.05), sofaShade = mat('Sofá crema sombra', '#c6b291', 0.05);
    box('Base del sofá', sofaShade, 16.5, 4.35, 0.06, 3.9, 0.28, 1.12);
    for (const px of [15.6, 17.4]) box('Asiento', sofa, px, 4.3, 0.34, 1.78, 0.16, 1.0);
    for (const px of [15.15, 16.05, 16.95, 17.85]) box('Cabezal', sofa, px, 4.78, 0.5, 0.88, 0.55, 0.26).setEulerAngles(-6, 0, 0);
    for (const px of [14.6, 18.4]) box('Brazo', sofa, px, 4.35, 0.3, 0.26, 0.3, 1.12);
    for (const px of [14.6, 18.4]) for (const pz of [3.85, 4.85]) box('Pata del sofá', black, px, pz, 0, 0.05, 0.06, 0.05);
    box('Cojín teja', mat('Cojín teja', '#b35a2c', 0.05), 16.3, 4.45, 0.5, 0.62, 0.42, 0.14).setEulerAngles(-20, 20, 8);
    box('Cojín arena', mat('Cojín arena', '#d9c29a', 0.05), 16.7, 4.35, 0.5, 0.56, 0.4, 0.14).setEulerAngles(-24, -12, -6);
    box('Móvil', black, 18.4, 4.1, 0.6, 0.16, 0.02, 0.3).setEulerAngles(0, 20, 0);
    for (const dx of [0, 0.12]) box('Mando a distancia', black, 17.6 + dx, 4.0, 0.5, 0.05, 0.02, 0.2);
    // Desk behind the sofa: monitor, laptop and two black office chairs.
    box('Escritorio', paleOak, 16.0, 5.45, 0.72, 2.8, 0.04, 0.68);
    for (const px of [14.68, 17.32]) box('Pata del escritorio', black, px, 5.45, 0, 0.05, 0.72, 0.6);
    box('Portátil', steel, 15.3, 5.45, 0.76, 0.42, 0.02, 0.3);
    box('Pantalla del portátil', black, 15.3, 5.29, 0.77, 0.42, 0.28, 0.02).setEulerAngles(-12, 0, 0);
    box('Monitor', black, 16.6, 5.2, 0.98, 0.9, 0.52, 0.04);
    box('Pantalla del monitor', mat('Pantalla del monitor', '#1b2027', 0.9), 16.6, 5.225, 1.0, 0.84, 0.46, 0.01);
    box('Pie del monitor', black, 16.6, 5.15, 0.76, 0.22, 0.24, 0.12);
    box('Webcam', black, 16.6, 5.2, 1.5, 0.12, 0.05, 0.05);
    for (const px of [15.2, 17.0]) swivel(px, 6.2, 'north', mat('Malla negra', '#2a2b2e', 0.2), 0.62);
    birdOfParadise(18.1, 6.05);
    light(16.6, 2.3, 3.2, '#ffe4bd', 1.1, 5.5);
    // French windows onto the balcony: both leaves open into the room, a header and transom above.
    const header = foldaway(21 - FACE, 2.5, 21 + FACE, 4.5, CUT_HEIGHT, wallHeight);
    box('Travesaño', profile, 21, 3.5, doorTop, THICKNESS, 0.08, 2.0, header);
    box('Montante de vidrio', glass, 21, 3.5, doorTop + 0.08, 0.03, wallHeight - doorTop - 0.12, 1.9, header).render!.castShadows = false;
    box('Marco del montante', profile, 21, 3.5, wallHeight - 0.04, THICKNESS, 0.04, 2.0, header);
    for (const [hinge, dz] of [[2.5, 0.06], [4.5, -0.06]] as const) {
      const leaf = foldaway(20.05, hinge + Math.min(0, dz) - 0.03, 21, hinge + Math.max(0, dz) + 0.03, CUT_HEIGHT, doorTop);
      box('Hoja abierta', glass, 20.52, hinge + dz, 0.04, 0.9, doorTop - 0.08, 0.02, leaf).render!.castShadows = false;
      for (const px of [20.08, 20.96]) box('Larguero', profile, px, hinge + dz, 0.02, 0.06, doorTop - 0.04, 0.05, leaf);
      for (const y of [0.02, doorTop - 0.08]) box('Travesaño de la hoja', profile, 20.52, hinge + dz, y, 0.9, 0.06, 0.05, leaf);
    }

    // ——— Dining corner: round oak table, white folding chairs, open shelving, arc lamp, Barcelona at night ———
    framed(barcelonaNight(), 'east', 18 + FACE, 10.4, 1.55, 1.9, 1.2, steel);
    cyl('Mesa redonda', paleOak, 19.55, 9.5, 0.72, 1.35, 0.04, 1.35);
    for (const dz of [-0.36, 0.36]) {
      box('Pata de la mesa', black, 19.55, 9.5 + dz, 0.02, 0.05, 0.7, 0.05);
      box('Travesaño', black, 19.55, 9.5 + dz * 0.5, 0.68, 0.05, 0.04, 0.75);
    }
    box('Pie de la mesa', black, 19.55, 9.5, 0, 0.6, 0.04, 0.9);
    cyl('Botella decorada', mat('Botella decorada', '#c8b6e2', 0.7), 19.5, 9.4, 0.76, 0.09, 0.3, 0.09);
    const folding = mat('Silla plegable', '#f4f3ef', 0.4), quilted = mat('Cojín acolchado', '#efe9dc', 0.05);
    chair(19.55, 8.52, 'south', quilted, folding);
    chair(20.52, 9.6, 'west', quilted, folding);
    chair(19.7, 10.5, 'north', quilted, folding);
    chair(18.62, 9.45, 'east', quilted, folding);
    // Open shelving (no back, so the books show from both sides) with plants and treasures on top.
    const kallax = mat('Estantería de roble', '#cfae7e', 0.25), ky = 1.8, kz = 12.6;
    for (const [i, y] of [0, 0.44, 0.88, 1.32, 1.76].entries()) box(i % 4 ? 'Balda' : 'Tablero', kallax, 19.48, kz, y, 1.86, 0.04, 0.4);
    for (const px of [18.55, 19.0, 19.48, 19.95, 20.41]) box('Divisor', kallax, px, kz, 0, 0.04, ky, 0.4);
    for (let col = 0; col < 4; col++) {
      const cx = 18.78 + col * 0.47;
      box('Caja blanca', white, cx, kz, 0.04, 0.4, 0.38, 0.38);
      books(cx, kz, 0.48 + (col % 2) * 0.44, 0.38, 'x', col * 7);
      box('Juego de mesa', mat('Juego de mesa', ['#c9423a', '#2f5a8a', '#e3b341', '#3d7a4f'][col], 0.3), cx, kz, 1.36 - (col % 2) * 0.44, 0.38, 0.3, 0.36);
    }
    picture(root, moonArt(), 'south', 19.1, kz + 0.12, ky + 0.2, 0.44, 0.36).setEulerAngles(-8, 0, 0);
    ball('Geoda', mat('Amatista', '#5a3f7a', 0.6), 19.6, kz, ky + 0.04, 0.2, 0.3, 0.16);
    for (const [px, n] of [[18.7, 5], [20.25, 4]] as const) {
      cyl('Maceta', pot, px, kz, ky + 0.04, 0.2, 0.18, 0.2);
      for (let i = 0; i < n; i++) ball('Potus', leaves[i % 3], px + (i % 2 ? 0.12 : -0.1), kz - 0.05 - i * 0.02, ky + 0.2 - i * 0.28, 0.16, 0.14, 0.12);
    }
    box('Pie de la lámpara de arco', black, 21.2, 12.45, 0.06, 0.035, 1.69, 0.035);
    rod('Arco', black, [21.2, 1.75, 12.45], [20.9, 2.15, 11.9]);
    rod('Arco', black, [20.9, 2.15, 11.9], [20.4, 2.0, 11.15]);
    box('Base de mármol', mat('Mármol', '#e8e4dc', 0.6), 21.2, 12.45, 0, 0.34, 0.06, 0.34);
    cone('Pantalla', mat('Pantalla crema', '#d9d2c6', 0.3), 20.4, 11.15, 1.72, 0.5, 0.32, 0.5);
    ball('Bombilla', glow, 20.4, 11.15, 1.68, 0.14, 0.1, 0.14);
    light(20.3, 1.6, 10.6, '#ffd49a', 1.1, 4.5);
    cyl('Esterilla', mat('Esterilla', '#2aa6a0', 0.3), 21.72, 12.25, 0, 0.14, 0.62, 0.14);
    for (let pz = 7.25; pz < 8.3; pz += 0.1) box('Radiador', ceramic, 21.78, pz, 0.12, 0.1, 0.6, 0.07);

    // ——— Balcony: red clay floor, grey folding table and chairs, a lantern and the railing ———
    for (let pz = north + 0.08; pz < 6 - FACE; pz += 0.12) box('Barrote', black, 24, pz, 0, 0.025, 1.05, 0.025).render!.castShadows = false;
    for (const y of [0.06, 1.03]) box('Pasamanos', black, 24, 3, y, 0.05, 0.04, 6 - 2 * FACE);
    const outdoor = mat('Aluminio gris', '#4f5559', 0.4);
    box('Mesa plegable', outdoor, 23.25, 3.5, 0.7, 0.8, 0.03, 1.5);
    for (const s of [-1, 1]) rod('Pata plegable', outdoor, [23.25, 0, 3.5 + s * 0.6], [23.25, 0.7, 3.5 - s * 0.6], 0.03);
    chair(23.2, 2.3, 'south', outdoor, outdoor);
    chair(23.2, 4.7, 'north', outdoor, outdoor);
    box('Farol de pared', black, 22.4, north + 0.1, 1.85, 0.16, 0.26, 0.16);
    box('Luz del farol', glow, 22.4, north + 0.1, 1.9, 0.1, 0.14, 0.17);
    box('Toldo recogido', mat('Toldo crema', '#efe6cf', 0.1), 22.5, north + 0.12, 2.42, 3.0, 0.14, 0.2);

    // ——— Across the Meridiana: peach blocks with green awnings, clear of the camera's view of the flat ———
    const facades = [mat('Fachada salmón', '#e3b192', 0.1), mat('Fachada crema', '#e9dcc4', 0.1)];
    const awning = mat('Toldo verde', '#2f7d73', 0.2), windowDark = mat('Ventana de enfrente', '#3b4449', 0.5);
    for (const [i, [z0, z1, top]] of ([[-8, 5, 4.6], [-19, -8.4, 5.4]] as const).entries()) {
      const x0 = 28.5, x1 = 34;
      box('Edificio de enfrente', facades[i], (x0 + x1) / 2, (z0 + z1) / 2, -1.15, x1 - x0, top + 1.15, z1 - z0);
      box('Azotea', mat('Azotea', '#bdb6a7', 0.05), (x0 + x1) / 2, (z0 + z1) / 2, top, x1 - x0 - 0.3, 0.04, z1 - z0 - 0.3);
      for (let y = -0.4; y < top - 1; y += 1.55) {
        for (let pz = z0 + 0.9; pz < z1 - 0.8; pz += 2.1) {
          box('Balcón de enfrente', facades[i], x0 - 0.3, pz, y, 0.6, 0.08, 1.5);
          for (let k = 0; k < 6; k++) box('Barrote', black, x0 - 0.58, pz - 0.7 + k * 0.28, y + 0.08, 0.02, 0.6, 0.02);
          const blind = box('Toldo', awning, x0 - 0.42, pz, y + 1.2, 0.85, 0.04, 1.5); blind.setEulerAngles(0, 0, 28);
        }
        for (let px = x0 + 0.6; px < x1 - 0.4; px += 1.1) box('Ventana', windowDark, px, z1 + 0.01, y + 0.4, 0.55, 0.8, 0.02);
      }
    }
  }

  /** A bed centred on `px` (x, or z when it runs east), headboard on the wall at `head`. */
  function bed(px: number, head: number, w: number, length: number, toward: 'south' | 'east', duvet: pc.StandardMaterial) {
    const [cx, cz, bw, bd] = toward === 'south' ? [px, head + length / 2, w, length] : [head + length / 2, px, length, w];
    box('Somier', oak, cx, cz, 0.08, bw, 0.22, bd);
    box('Colchón', lacquer, cx, cz, 0.3, bw - 0.06, 0.18, bd - 0.06);
    const [dx, dz, dw, dd] = toward === 'south' ? [cx, cz + 0.25, bw + 0.02, bd - 0.5] : [cx + 0.25, cz, bw - 0.5, bd + 0.02];
    box('Edredón', duvet, dx, dz, 0.32, dw, 0.2, dd);
    for (const k of w > 1.6 ? [-0.45, 0.45] : [0]) {
      if (toward === 'south') box('Almohada', creamLight, px + k * w / 1.2, head + 0.28, 0.48, w > 1.6 ? 0.7 : 0.8, 0.12, 0.36);
      else box('Almohada', creamLight, head + 0.28, px + k * w / 1.2, 0.48, 0.36, 0.12, w > 1.6 ? 0.7 : 0.8);
    }
    if (toward === 'south') box('Cabecero', linen, px, head + 0.06, 0.08, w + 0.1, 1.05, 0.1);
    else box('Cabecero', linen, head + 0.06, px, 0.08, 0.1, 1.05, w + 0.1);
  }

  /** Gerard's room, after the sketch: shelves along the north wall, bed on the west, wardrobe south. */
  function gerardsRoom() {
    const west = FACE;
    rug(4.5, 4.2, 3, 2.6, '#2e3f63', '#d0a04a');
    // Bed against the west wall, pillow to the south; navy duvet, mustard throw, a plush Anubis.
    box('Somier', oak, 0.85, 6.42, 0.06, 1.42, 0.24, 2.9);
    box('Colchón', lacquer, 0.85, 6.42, 0.3, 1.36, 0.16, 2.84);
    box('Edredón', mat('Edredón azul', '#34467a', 0.05), 0.87, 6.12, 0.3, 1.46, 0.2, 2.34);
    box('Manta mostaza', mat('Manta mostaza', '#e0a646', 0.05), 0.87, 5.35, 0.5, 1.48, 0.04, 0.5);
    box('Almohada', creamLight, 0.85, 7.52, 0.46, 1.1, 0.13, 0.46);
    box('Cojín dorado', gold, 1.15, 7.3, 0.52, 0.34, 0.26, 0.1).setEulerAngles(-20, 10, 0);
    const plush = mat('Peluche negro', '#2b2a2c', 0.1);
    ball('Peluche', plush, 0.55, 7.25, 0.5, 0.2, 0.2, 0.18);
    ball('Cabeza de peluche', plush, 0.55, 7.2, 0.66, 0.14, 0.14, 0.14);
    for (const k of [-0.035, 0.035]) box('Oreja de peluche', plush, 0.55 + k, 7.2, 0.76, 0.025, 0.1, 0.03);
    box('Hocico de peluche', plush, 0.55, 7.12, 0.69, 0.05, 0.04, 0.08);
    // Posters above the bed and navy curtains by the window.
    framed(egyptPoster(), 'east', west, 5.6, 1.5, 0.84, 1.1, oak);
    framed(manaPoster(), 'east', west, 7.1, 1.45, 0.74, 0.74);
    for (const pz of [1.45, 3.55]) box('Cortina', mat('Cortina azul', '#2e3f63', 0.05), west + 0.07, pz, 0.1, 0.06, 2.3, 0.3);
    // Nightstand with a pyramid lamp and an alarm clock.
    box('Mesita', oak, 1.9, 7.55, 0, 0.5, 0.5, 0.56);
    solid('Lámpara pirámide', pyramidMesh, glow, 1.9, 7.62, 0.5, 0.26, 0.3, 0.26);
    box('Despertador', black, 1.85, 7.35, 0.5, 0.16, 0.09, 0.07);
    box('Hora', mat('Dígitos', '#ff7a5c', 0.3, 1.2), 1.85, 7.31, 0.52, 0.12, 0.045, 0.005);
    light(1.9, 0.95, 7.2, '#ffc47a', 0.8, 3);
    // Wardrobe along the south wall, with storage boxes on top.
    const wardrobe = standing('Armario', lacquer, 5.22, 7.46, 5.3, 0.8, 2.25);
    box('Caja de juegos', mat('Caja roja', '#b8453a', 0.2), 3.6, 7.45, 2.25, 0.8, 0.14, 0.6, wardrobe);
    box('Caja de cartón', mat('Caja de cartón', '#b8905f', 0.1), 5.4, 7.45, 2.25, 0.9, 0.3, 0.6, wardrobe);
    const tube = cyl('Tubo del tapete', black, 6.9, 7.45, 2.3, 0.12, 1, 0.12, wardrobe); tube.setEulerAngles(0, 0, 90);
    // Mustard beanbag with a book on it.
    ball('Puf', mat('Puf mostaza', '#d99a3d', 0.05), 6.1, 4, 0, 0.9, 0.55, 0.85);
    box('Libro abierto', mat('Libro', '#f2ead8', 0.1), 6.05, 3.95, 0.55, 0.3, 0.03, 0.22).setEulerAngles(0, 20, 8);
    light(4.3, 2.2, 4, '#ffdcae', 1.1, 6);
    shelves();
  }

  /** Four bays of shelving: Egyptian gods, minerals, Magic cards and everything else. */
  function shelves() {
    const back = FACE, x0 = 0.2, x1 = 7.8, bay = (x1 - x0) / 4;
    const counter = 0.77, levels = [1.32, 1.86], deep = 0.42;
    box('Cajonera', lacquer, 4, back + 0.4, 0, x1 - x0, 0.72, 0.8);
    const seam = mat('Junta de cajón', '#d6d2ca', 0.3);
    for (let i = 0; i < 4; i++) box('Junta de cajón', seam, x0 + bay * (i + 0.5), back + 0.805, 0.36, bay - 0.1, 0.012, 0.01);
    box('Encimera', oak, 4, back + 0.41, 0.72, x1 - x0 + 0.04, 0.05, 0.84);
    box('Trasera', oak, 4, back + 0.02, counter, x1 - x0, 1.68, 0.03);
    for (let i = 0; i <= 4; i++) box('Montante', lacquer, x0 + i * bay, back + deep / 2, counter, 0.05, 1.68, deep);
    for (const y of [...levels, 2.4]) {
      box('Balda', lacquer, 4, back + deep / 2, y - 0.04, x1 - x0, 0.04, deep);
      box('Tira LED', glow, 4, back + deep - 0.03, y - 0.05, x1 - x0 - 0.1, 0.01, 0.02);
    }
    const centre = (i: number) => x0 + bay * (i + 0.5);
    const shelfZ = back + 0.24, counterZ = back + 0.5;
    egypt(centre(0), shelfZ, counterZ, counter, levels);
    minerals(centre(1), shelfZ, counterZ, counter, levels);
    magic(centre(2), shelfZ, counterZ, counter, levels);
    etc(centre(3), shelfZ, counterZ, counter, levels);
    light(4, 1.6, 1.4, '#ffe3b8', 0.7, 3.2);
  }
  function egypt(cx: number, sz: number, cz: number, counter: number, [low, high]: number[]) {
    const sand = mat('Arenisca', '#d8b77a', 0.2), onyx = mat('Ónice', '#1e1d20', 0.6), lapis = mat('Lapislázuli', '#2d4f9a', 0.6);
    // Counter: pyramids, an obelisk and the golden mask.
    solid('Pirámide', pyramidMesh, sand, cx - 0.6, cz, counter, 0.36, 0.26, 0.36);
    solid('Pirámide', pyramidMesh, sand, cx - 0.22, cz + 0.08, counter, 0.22, 0.16, 0.22);
    box('Obelisco', sand, cx + 0.62, cz, counter, 0.06, 0.4, 0.06);
    solid('Piramidión', pyramidMesh, gold, cx + 0.62, cz, counter + 0.4, 0.06, 0.05, 0.06);
    box('Nemes', gold, cx + 0.18, cz, counter, 0.2, 0.26, 0.14);
    for (let i = 0; i < 4; i++) box('Franja del nemes', lapis, cx + 0.18, cz + 0.071, counter + 0.04 + i * 0.05, 0.205, 0.018, 0.005);
    ball('Rostro dorado', gold, cx + 0.18, cz + 0.05, counter + 0.14, 0.11, 0.13, 0.09);
    box('Barba', lapis, cx + 0.18, cz + 0.08, counter + 0.07, 0.025, 0.06, 0.025);
    // Low shelf: Anubis, Horus and Bastet keep watch.
    anubis(cx - 0.55, sz, low, onyx);
    horus(cx, sz, low, lapis);
    bastet(cx + 0.55, sz, low, onyx);
    // High shelf: canopic jars, a scarab and a framed papyrus.
    for (const [i, head] of ['#2a2a2a', '#c3a46a', '#b56b3f'].entries()) {
      cyl('Vaso canopo', mat('Alabastro', '#efe6cf', 0.4), cx - 0.6 + i * 0.16, sz + 0.04, high, 0.1, 0.16, 0.1);
      ball('Tapa de canopo', mat('Tapa', head, 0.4), cx - 0.6 + i * 0.16, sz + 0.04, high + 0.16, 0.09, 0.09, 0.09);
    }
    ball('Escarabajo', mat('Turquesa', '#2fa39b', 0.7), cx + 0.55, sz + 0.06, high, 0.14, 0.07, 0.18);
    const papyrus = picture(root, papyrusArt(), 'south', cx + 0.05, sz - 0.05, high + 0.2, 0.36, 0.34); papyrus.setEulerAngles(-8, 0, 0);
  }
  function anubis(px: number, pz: number, y: number, onyx: pc.Material) {
    box('Piernas', onyx, px, pz, y, 0.08, 0.12, 0.06);
    box('Faldellín', gold, px, pz, y + 0.12, 0.1, 0.05, 0.07);
    box('Torso', onyx, px, pz, y + 0.17, 0.1, 0.1, 0.06);
    cyl('Collar', gold, px, pz, y + 0.26, 0.11, 0.02, 0.08);
    box('Cabeza de chacal', onyx, px, pz, y + 0.28, 0.07, 0.07, 0.08);
    box('Hocico', onyx, px, pz + 0.06, y + 0.29, 0.035, 0.035, 0.07);
    for (const k of [-0.022, 0.022]) box('Oreja', onyx, px + k, pz - 0.01, y + 0.34, 0.018, 0.08, 0.025);
    box('Cetro', gold, px + 0.075, pz + 0.02, y, 0.012, 0.36, 0.012);
  }
  function horus(px: number, pz: number, y: number, lapis: pc.Material) {
    box('Piernas', gold, px, pz, y, 0.08, 0.12, 0.06);
    box('Torso', lapis, px, pz, y + 0.12, 0.1, 0.14, 0.06);
    ball('Cabeza de halcón', mat('Plumaje', '#5a6f8a', 0.4), px, pz, y + 0.26, 0.09, 0.09, 0.09);
    cone('Pico', gold, px, pz + 0.05, y + 0.28, 0.03, 0.04, 0.03).setEulerAngles(90, 0, 0);
    ball('Disco solar', mat('Disco solar', '#d4492f', 0.6), px, pz - 0.01, y + 0.34, 0.08, 0.08, 0.03);
  }
  function bastet(px: number, pz: number, y: number, onyx: pc.Material) {
    ball('Cuerpo de gata', onyx, px, pz, y, 0.12, 0.2, 0.13);
    ball('Cabeza de gata', onyx, px, pz + 0.02, y + 0.19, 0.08, 0.08, 0.08);
    for (const k of [-0.025, 0.025]) cone('Oreja de gata', onyx, px + k, pz + 0.02, y + 0.25, 0.03, 0.05, 0.02);
    cyl('Collar', gold, px, pz + 0.01, y + 0.16, 0.08, 0.015, 0.08);
    ball('Pendiente', gold, px + 0.04, pz + 0.03, y + 0.2, 0.015, 0.015, 0.015);
  }
  function minerals(cx: number, sz: number, cz: number, counter: number, [low, high]: number[]) {
    const rock = mat('Roca', '#8d8984', 0.2), amethyst = mat('Amatista', '#8e5bc4', 0.7, 0.15);
    // Counter: the big geode and a glowing selenite tower.
    ball('Geoda', rock, cx - 0.35, cz, counter, 0.42, 0.34, 0.34);
    ball('Interior de la geoda', amethyst, cx - 0.35, cz + 0.13, counter + 0.05, 0.32, 0.24, 0.12);
    for (let i = 0; i < 6; i++) cone('Cristal de amatista', amethyst, cx - 0.47 + (i % 3) * 0.12, cz + 0.17, counter + 0.08 + (i >> 1) * 0.04, 0.035, 0.08, 0.035).setEulerAngles(80, 0, (i - 2.5) * 12);
    box('Selenita', mat('Selenita', '#f5f1e8', 0.6, 0.9), cx + 0.45, cz, counter, 0.08, 0.34, 0.08);
    light(cx + 0.45, counter + 0.4, cz + 0.2, '#fff4e0', 0.35, 1.5);
    // Low shelf: a quartz cluster, pyrite cubes and banded malachite.
    box('Base de cuarzo', rock, cx - 0.5, sz, low, 0.24, 0.05, 0.18);
    for (let i = 0; i < 7; i++) {
      const c = cone('Cuarzo', mat('Cuarzo', '#eef3f5', 0.9), cx - 0.58 + (i % 4) * 0.05, sz - 0.04 + (i >> 2) * 0.07, low + 0.04, 0.035, 0.12 + jitter(i) * 0.1, 0.035);
      c.setEulerAngles((i % 3 - 1) * 12, 0, (i % 4 - 1.5) * 10);
    }
    const pyrite = mat('Pirita', '#c9a94a', 0.9);
    for (const [dx, dy, s] of [[0, 0, 0.1], [0.08, 0, 0.07], [0.03, 0.1, 0.06]]) box('Pirita', pyrite, cx + dx, sz, low + dy, s, s, s);
    ball('Malaquita', mat('Malaquita', '#2f8f5b', 0.7), cx + 0.5, sz, low, 0.2, 0.14, 0.16);
    // High shelf: rose quartz and a specimen box.
    ball('Cuarzo rosa', mat('Cuarzo rosa', '#e7b3be', 0.7), cx - 0.5, sz, high, 0.16, 0.13, 0.14);
    box('Caja de muestras', oak, cx + 0.2, sz, high, 0.5, 0.05, 0.3);
    const samples = ['#8e5bc4', '#2f8f5b', '#c9a94a', '#e7b3be', '#3a6fb0', '#c75c3a'];
    for (let i = 0; i < 6; i++) ball('Muestra', mat('Muestra', samples[i], 0.7), cx + 0.03 + (i % 3) * 0.17, sz - 0.07 + Math.floor(i / 3) * 0.14, high + 0.05, 0.08, 0.06, 0.08);
  }
  function magic(cx: number, sz: number, cz: number, counter: number, [low, high]: number[]) {
    // Counter: a playmat with a fanned hand, a spin-down twenty-sided die and a binder.
    box('Tapete', mat('Tapete', '#2d2748', 0.1), cx - 0.12, cz + 0.02, counter, 0.9, 0.006, 0.48);
    const back = cardBack();
    for (let i = 0; i < 5; i++) {
      const card = box('Carta', back, cx - 0.35 + i * 0.07, cz + 0.05, counter + 0.008 + i * 0.002, 0.13, 0.004, 0.18);
      card.setEulerAngles(0, (i - 2) * 14, 0);
    }
    solid('Dado de veinte caras', d20Mesh, mat('Dado', '#3f8a4f', 0.7), cx + 0.22, cz + 0.02, counter + 0.06, 0.13, 0.13, 0.13);
    box('Carpeta de cartas', black, cx + 0.62, cz - 0.05, counter, 0.07, 0.34, 0.28);
    // Low shelf: one deck box per mana colour.
    for (let i = 0; i < 5; i++) {
      const colour = mat('Caja de mazo', MANA[i], 0.5);
      box('Caja de mazo', colour, cx - 0.6 + i * 0.3, sz, low, 0.2, 0.14, 0.12);
      cyl('Símbolo', mat('Símbolo', i === 0 ? '#c9b98c' : '#f4efdc', 0.4), cx - 0.6 + i * 0.3, sz + 0.061, low + 0.07, 0.07, 0.005, 0.07).setEulerAngles(90, 0, 0);
    }
    // High shelf: three favourite cards on stands.
    for (let i = 0; i < 3; i++) {
      const px = cx - 0.5 + i * 0.5;
      box('Atril', black, px, sz + 0.05, high, 0.2, 0.02, 0.08);
      const card = picture(root, cardFace(i * 2), 'south', px, sz + 0.02, high + 0.15, 0.2, 0.28);
      card.setEulerAngles(-10, 0, 0);
    }
  }
  function etc(cx: number, sz: number, cz: number, counter: number, [low, high]: number[]) {
    // Counter: a globe and a trophy nobody explains.
    cyl('Pie del globo', walnut, cx - 0.4, cz, counter, 0.16, 0.03, 0.16);
    box('Eje del globo', gold, cx - 0.4, cz, counter + 0.03, 0.015, 0.14, 0.015);
    ball('Globo terráqueo', mat('Océano', '#3d6f9e', 0.6), cx - 0.4, cz, counter + 0.1, 0.28, 0.28, 0.28);
    for (let i = 0; i < 4; i++) ball('Continente', mat('Continente', '#6f9a58', 0.4), cx - 0.4 + Math.cos(i * 1.7) * 0.1, cz + 0.08 + Math.sin(i) * 0.03, counter + 0.16 + (i % 2) * 0.08, 0.1, 0.07, 0.08);
    box('Peana', black, cx + 0.45, cz, counter, 0.14, 0.06, 0.14);
    cyl('Copa', gold, cx + 0.45, cz, counter + 0.06, 0.05, 0.1, 0.05);
    ball('Trofeo', gold, cx + 0.45, cz, counter + 0.14, 0.16, 0.14, 0.16);
    // Shelves: books, a plant and a framed photo.
    books(cx - 0.2, sz, low, 0.9, 'x', 11);
    plant(cx + 0.55, sz + 0.03, 0.45);
    for (let i = 0; i < 3; i++) box('Libro tumbado', bookMaterials[i] ?? walnut, cx - 0.45, sz, high + i * 0.045, 0.34, 0.04, 0.24);
    const photo = picture(root, art(16, 0.26, 0.2), 'south', cx + 0.25, sz, high + 0.12, 0.26, 0.2); photo.setEulerAngles(-8, 0, 0);
    box('Marco de foto', oak, cx + 0.25, sz - 0.02, high, 0.3, 0.24, 0.02).setEulerAngles(-8, 0, 0);
  }

  // ——— Poster, papyrus and card textures ———
  function egyptPoster() {
    const [c, ctx] = canvas(256, 336);
    const sky = ctx.createLinearGradient(0, 0, 0, 240);
    sky.addColorStop(0, '#e9774f'); sky.addColorStop(0.6, '#f3b95f'); sky.addColorStop(1, '#f7dd9a');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, 256, 336);
    ctx.fillStyle = '#fff3cf'; ctx.beginPath(); ctx.arc(170, 120, 34, 0, Math.PI * 2); ctx.fill();
    for (const [x0, w, h, col] of [[20, 150, 120, '#b8783f'], [120, 110, 90, '#a0652f'], [185, 70, 55, '#8f5a2b']] as const) {
      ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(x0, 250); ctx.lineTo(x0 + w / 2, 250 - h); ctx.lineTo(x0 + w, 250); ctx.fill();
    }
    ctx.fillStyle = '#d59f5a'; ctx.fillRect(0, 250, 256, 86);
    ctx.fillStyle = '#2d2219'; ctx.font = '700 44px serif'; ctx.textAlign = 'center'; ctx.fillText('EGIPTO', 128, 310);
    return painted('Póster de Egipto', c, 0.2);
  }
  function manaPoster() {
    const [c, ctx] = canvas(256);
    ctx.fillStyle = '#1e1b2b'; ctx.fillRect(0, 0, 256, 256);
    ctx.strokeStyle = '#d0a04a'; ctx.lineWidth = 3; ctx.strokeRect(10, 10, 236, 236);
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + i * Math.PI * 2 / 5, px = 128 + Math.cos(a) * 78, py = 132 + Math.sin(a) * 78;
      ctx.fillStyle = MANA[i]; ctx.beginPath(); ctx.arc(px, py, 32, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#d0a04a'; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = i === 0 ? '#c9a45a' : '#f4efdc'; ctx.beginPath(); ctx.arc(px, py, 11, 0, Math.PI * 2); ctx.fill();
    }
    return painted('Póster de los cinco colores', c, 0.2);
  }
  function papyrusArt() {
    const [c, ctx] = canvas(256, 240);
    ctx.fillStyle = '#e8d5a3'; ctx.fillRect(0, 0, 256, 240);
    ctx.strokeStyle = '#c9ae72'; for (let i = 0; i < 30; i++) { ctx.beginPath(); ctx.moveTo(0, i * 8); ctx.lineTo(256, i * 8 + 3); ctx.stroke(); }
    ctx.fillStyle = '#2b2a2c'; ctx.fillRect(60, 70, 34, 120); ctx.fillRect(66, 40, 22, 34); ctx.fillRect(84, 46, 18, 10);
    ctx.fillStyle = '#2d4f9a'; ctx.fillRect(150, 70, 34, 120); ctx.beginPath(); ctx.arc(167, 55, 16, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#d4492f'; ctx.beginPath(); ctx.arc(167, 30, 11, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#8a5a2b'; for (let i = 0; i < 6; i++) ctx.fillRect(210, 30 + i * 30, 20, 18);
    return painted('Papiro', c, 0.1);
  }
  function cardBack() {
    const [c, ctx] = canvas(64, 88);
    ctx.fillStyle = '#5a3a22'; ctx.fillRect(0, 0, 64, 88);
    ctx.fillStyle = '#2e4d7c'; ctx.beginPath(); ctx.ellipse(32, 44, 20, 30, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#c8553d'; ctx.beginPath(); ctx.arc(32, 44, 8, 0, Math.PI * 2); ctx.fill();
    return painted('Dorso de carta', c, 0.3);
  }
  function cardFace(colour: number) {
    const [c, ctx] = canvas(128, 176);
    ctx.fillStyle = '#161616'; ctx.fillRect(0, 0, 128, 176);
    ctx.fillStyle = MANA[colour % 5]; ctx.fillRect(6, 6, 116, 164);
    ctx.fillStyle = '#efe6cf'; ctx.fillRect(12, 12, 104, 14); ctx.fillRect(12, 110, 104, 52);
    const art = ctx.createLinearGradient(0, 30, 0, 104);
    art.addColorStop(0, ['#f6e7b8', '#8cc6ea', '#5b4b6a', '#f09a5a', '#9fd08a'][colour % 5]); art.addColorStop(1, '#2e3a4a');
    ctx.fillStyle = art; ctx.fillRect(12, 30, 104, 76);
    ctx.fillStyle = '#00000055'; ctx.beginPath(); ctx.moveTo(30, 104); ctx.lineTo(64, 50); ctx.lineTo(98, 104); ctx.fill();
    ctx.fillStyle = '#8a8272'; for (let i = 0; i < 4; i++) ctx.fillRect(18, 118 + i * 10, 70 + (i % 2) * 20, 3);
    return painted('Carta', c, 0.3);
  }

  /** Barcelona from above at night: the sea, the lit Eixample grid, the Diagonal and a glowing tower. */
  function barcelonaNight() {
    const [c, ctx] = canvas(512, 324);
    const sky = ctx.createLinearGradient(0, 0, 0, 324);
    sky.addColorStop(0, '#1d3358'); sky.addColorStop(0.25, '#2c4670'); sky.addColorStop(0.32, '#1c2a44'); sky.addColorStop(1, '#10151f');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, 512, 324);
    ctx.fillStyle = '#18263d'; ctx.fillRect(0, 84, 512, 20);
    for (let r = 0; r < 34; r++) {
      const t = r / 34, y = 106 + 218 * t ** 1.5, gap = 5 + t * 16;
      for (let k = 0, px = jitter(r) * gap; px < 512; k++, px += gap) {
        ctx.fillStyle = jitter(r * 97 + k) > 0.8 ? '#fff0c4' : jitter(r * 31 + k) > 0.45 ? '#ffb85c' : '#d9793a';
        ctx.globalAlpha = 0.55 + jitter(r + k * 13) * 0.45;
        ctx.fillRect(px, y, 1.5 + t * 2.5, 1.2 + t * 1.8);
      }
    }
    ctx.globalAlpha = 1;
    ctx.strokeStyle = '#ffd38a'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(0, 300); ctx.lineTo(512, 118); ctx.stroke();
    ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(60, 324); ctx.lineTo(300, 104); ctx.stroke();
    const tower = ctx.createLinearGradient(0, 60, 0, 112);
    tower.addColorStop(0, '#6fb4ff'); tower.addColorStop(0.6, '#3d6fd8'); tower.addColorStop(1, '#e0473c');
    ctx.fillStyle = tower; ctx.beginPath(); ctx.ellipse(118, 94, 8, 34, 0, Math.PI, 0); ctx.lineTo(126, 118); ctx.lineTo(110, 118); ctx.fill();
    ctx.fillStyle = '#2a2622';
    for (const [px, h] of [[398, 46], [410, 58], [422, 50], [434, 40]]) { ctx.beginPath(); ctx.moveTo(px - 5, 132); ctx.lineTo(px, 132 - h); ctx.lineTo(px + 5, 132); ctx.fill(); }
    ctx.fillStyle = '#ffd89a'; for (const px of [398, 410, 422, 434]) ctx.fillRect(px - 1, 118, 2, 10);
    return painted('Barcelona de noche', c, 0.35);
  }
  function moonArt() {
    const [c, ctx] = canvas(128, 104);
    ctx.fillStyle = '#1c1633'; ctx.fillRect(0, 0, 128, 104);
    const moon = ctx.createRadialGradient(60, 50, 4, 64, 52, 40);
    moon.addColorStop(0, '#f6d1e6'); moon.addColorStop(0.6, '#c78bd6'); moon.addColorStop(1, '#6a4fb0');
    ctx.fillStyle = moon; ctx.beginPath(); ctx.arc(64, 52, 38, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#120d20'; ctx.lineWidth = 2;
    for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.moveTo(i * 30, 104); ctx.lineTo(i * 30 + 12, 70 - i * 3); ctx.lineTo(i * 30 + 24, 58); ctx.stroke(); }
    return painted('Luna', c, 0.2);
  }
  /** A pressed thistle, star-shaped and dry, on cream paper. */
  function thistle() {
    const [c, ctx] = canvas(128);
    ctx.fillStyle = '#f2ede2'; ctx.fillRect(0, 0, 128, 128);
    ctx.strokeStyle = '#6e5a3e'; ctx.lineWidth = 2; ctx.lineCap = 'round';
    for (let i = 0; i < 18; i++) {
      const a = i * Math.PI / 9, r = 28 + (i % 2) * 14;
      ctx.beginPath(); ctx.moveTo(64 + Math.cos(a) * 12, 64 + Math.sin(a) * 12); ctx.lineTo(64 + Math.cos(a) * r, 64 + Math.sin(a) * r); ctx.stroke();
    }
    ctx.fillStyle = '#a58a5e'; ctx.beginPath(); ctx.arc(64, 64, 13, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#7d6644'; for (let i = 0; i < 30; i++) ctx.fillRect(56 + jitter(i) * 16, 56 + jitter(i + 5) * 16, 2, 2);
    return painted('Cardo', c, 0.15);
  }

  const origin = new pc.Vec3();
  function hides(fold: Fold, focus: pc.Vec3, toCamera: pc.Vec3) {
    const dir = [toCamera.x, toCamera.y, toCamera.z];
    const lo = [fold.min.x - CUT_MARGIN, fold.min.y, fold.min.z - CUT_MARGIN], hi = [fold.max.x + CUT_MARGIN, fold.max.y, fold.max.z + CUT_MARGIN];
    // Test Gerard's knees, chest and head against the box, along the line to the camera.
    for (const lift of [-0.45, 0, 0.55]) {
      origin.set(focus.x, focus.y + lift, focus.z);
      const o = [origin.x, origin.y, origin.z];
      let near = 0, far = Infinity, hit = true;
      for (let a = 0; a < 3 && hit; a++) {
        if (Math.abs(dir[a]) < 1e-6) { hit = o[a] >= lo[a] && o[a] <= hi[a]; continue; }
        const t1 = (lo[a] - o[a]) / dir[a], t2 = (hi[a] - o[a]) / dir[a];
        near = Math.max(near, Math.min(t1, t2)); far = Math.min(far, Math.max(t1, t2));
        hit = near <= far;
      }
      if (hit) return true;
    }
    return false;
  }
  return {
    /** Folds walls and tall furniture that stand between `focus` and the camera. */
    update(dt: number, animate: boolean, focus?: pc.Vec3, toCamera?: pc.Vec3) {
      for (const fold of folds) {
        const target = focus && toCamera && hides(fold, focus, toCamera) ? 0 : 1;
        if (fold.t === target) continue;
        fold.t = animate ? fold.t + (target - fold.t) * (1 - Math.exp(-dt * FOLD_RATE)) : target;
        if (Math.abs(fold.t - target) < 0.02) fold.t = target;
        fold.pivot.enabled = fold.t > 0.02;
        fold.pivot.setLocalScale(1, Math.max(fold.t, 0.02), 1);
      }
    },
    destroy() { meshes.forEach(m => m.destroy()); },
  };
}
