import * as pc from 'playcanvas';
import type { Environment } from './environments';
import type { GeoScene, GeoTexture } from './geo';
import { MeshBuilder } from './geo-scenery';
import { LANDMARKS, type LandmarkKit } from './landmarks';
import { arch, blob, box, canvas, disc, lathe, seeded } from './landmarks/sagrada-familia';
import { gpuTexture, greyOf, loadTextures, tintColour, type LoadedTexture } from './materials';

/**
 * Inside the Sagrada Família (docs/places/sagrada.md § Inside): the forest of columns that branch
 * like trees into the vault, in four stones by the load they carry; Vila-Grau's stained glass, cool
 * on the Nativity side and warm on the Passion side, its light lying in coloured pools that drift
 * over the floor; the altar under its canopy, the organ, the Glory's rose and bronze doors.
 *
 * Built in metres round the crossing, in the outside's frame (src/landmarks/sagrada-familia.ts): +z
 * the Nativity (the camera's side), +x the apse, −x the Glory, −z the Passion. As in every interior,
 * the walls on the far sides (Passion, Glory) stand tall and carry the glass; the near ones are cut
 * low. Heights are pressed so the vault sits in the frame; the vault's cells are funnels seen from
 * above, painted as the vault looks from below, and they open a clearing round Gerard.
 */
export interface BasilicaKit {
  app: pc.Application;
  root: pc.Entity;
  /** The scene's static batch group. */
  batch: number;
  mat: (name: string, hex: string, gloss?: number, glow?: number) => pc.StandardMaterial;
  texture: (canvas: HTMLCanvasElement) => pc.Texture;
  /** Grid → scene coordinates. */
  x: (px: number) => number;
  z: (pz: number) => number;
}

type V3 = [number, number, number];
type Mesh = MeshBuilder;

/** Metres per cell, as outside: the plan shares the outside's scale and frame. */
const CELL = 1.5;
/** The crossing's cell, under the Tower of Jesus: metres are measured from it. */
const CROSSING = { x: 36, z: 20 };
/** The apse is a half circle round the presbytery, as outside. */
const APSE = { x: 15, r: 22.5 };
/**
 * The column stones, by the load they carry (the basilica's own account of its columns): porphyry
 * under the Tower of Jesus, basalt round it, granite in the central nave, sandstone in the aisles,
 * twelve, ten, eight and six points to their star. `knot` and `top` are the knot's and the vault's
 * heights, pressed from the real vaults (aisles 30 m, nave and transept 45, apse 75, crossing 60)
 * so the canopy sits in the frame.
 */
const STONES = {
  P: { name: 'Pórfido', colour: '#8a6a62', gloss: 0.55, radius: 0.85, points: 12, knot: 10, top: 17, branches: 4 },
  B: { name: 'Basalto', colour: '#5c5650', gloss: 0.5, radius: 0.72, points: 10, knot: 8.5, top: 13.5, branches: 4 },
  g: { name: 'Granito', colour: '#8f8c86', gloss: 0.45, radius: 0.6, points: 8, knot: 8, top: 13.5, branches: 3 },
  s: { name: 'Arenisca', colour: '#cbbfa8', gloss: 0.12, radius: 0.48, points: 6, knot: 6.5, top: 10.5, branches: 3 },
} as const;
type Stone = keyof typeof STONES;
/** The vault cells' rim: eight-sided and overlapping over the 7.5 m grid, so they read as one vault stepping up to the crossing. */
const RIM = 4.4;
/** The clearing the vault opens round Gerard (world units, like the buildings' cut), and its glowing edge. */
const CLEARING = 8;
const CLEARING_EDGE = 1.2;
/**
 * The branches open a narrower one, only where they would cross Gerard himself; the trunks (with
 * their knots and medallions) narrower still, so a column standing between him and the camera
 * opens round him and the forest keeps its trunks everywhere else.
 */
const BRANCH_CLEARING = 2.4;
const TRUNK_CLEARING = 1.4;
/** The low walls on the camera's side, and the band of glass along them. */
const LOW = 1.5, GLASS_FROM = 0.45, GLASS_TO = 1.25;
/** The four Evangelists on the crossing's porphyry columns, as they stand: Mark and Luke towards the apse. */
const EVANGELISTS: Record<string, string> = { '41,15': 'MARC', '41,25': 'LLUC', '31,15': 'JOAN', '31,25': 'MATEU' };
/** Vila-Grau's glass: cool on the Nativity side (birth, the morning), warm on the Passion side (death, the evening). */
const COOL = ['#2f6fc0', '#3a9a5c', '#1f4f9a', '#5fb8c8', '#8fd09a', '#dfeaf2', '#2a7f7a', '#4a86d8'];
const WARM = ['#e0742c', '#c43a2a', '#f2b33d', '#9b2420', '#f5d06a', '#e8562a', '#7a1f30', '#ffe2a0'];
const GOLD = ['#f2c14a', '#e8a53a', '#fff0b8', '#d98a2a', '#f7dc7a', '#c9b98a'];
const ROSE = ['#2f6fc0', '#3a9a5c', '#f2b33d', '#e0742c', '#5fb8c8', '#f5d06a', '#c43a2a', '#8fd09a'];
/** The real textures the inside uses (public/textures/<id>/texture.json has their credits). */
const TEXTURES: Record<string, GeoTexture> = {
  marbre: { kind: 'material', files: { albedo: 'albedo.webp', normal: 'normal.webp' }, size_m: [1.5, 1.5] },
  carreu: { kind: 'material', files: { albedo: 'albedo.webp', normal: 'normal.webp' }, size_m: [3, 3] },
};

export function buildBasilica(kit: BasilicaKit, environment: Environment) {
  const { app, root, x, z } = kit;
  const plan = environment.basilica!.plan;
  const device = app.graphicsDevice;
  const glyph = (i: number, j: number) => plan[j]?.[i] ?? ' ';
  /** A cell's centre in metres from the crossing. */
  const X = (i: number) => (i - CROSSING.x) * CELL, Z = (j: number) => (j - CROSSING.z) * CELL;
  const random = seeded(1882);
  const meshes: pc.Mesh[] = [];
  const gpu: pc.Texture[] = [];
  const lights: pc.Entity[] = [];
  let alive = true;

  const pivot = new pc.Entity('Basílica por dentro');
  pivot.setLocalPosition(x(CROSSING.x), 0, z(CROSSING.z)); pivot.setLocalScale(1 / CELL, 1 / CELL, 1 / CELL);
  root.addChild(pivot);
  /** A frame turned a quarter so its +z looks along world +x: the Glory's wall, drawn as if it faced the camera. */
  const glory = new pc.Entity('Muro de la Gloria');
  glory.setLocalPosition(-53.25, 0, 0); glory.setLocalEulerAngles(0, 90, 0); pivot.addChild(glory);
  /** The Passion arm's west wall, turned the same way. */
  const arm = new pc.Entity('Muro del brazo de la Pasión');
  arm.setLocalPosition(-14.25, 0, -26.25); arm.setLocalEulerAngles(0, 90, 0); pivot.addChild(arm);

  function add(name: string, builder: Mesh, material: pc.Material, parent = pivot, { batched = true, shadows = true } = {}) {
    if (builder.empty) return undefined;
    const mesh = builder.mesh(device); meshes.push(mesh);
    const e = new pc.Entity(name);
    e.addComponent('render', { meshInstances: [new pc.MeshInstance(mesh, material)], castShadows: shadows, receiveShadows: true, ...(batched ? { batchGroupId: kit.batch } : {}) });
    parent.addChild(e); return e;
  }

  // ------------------------------------------------------------ materials
  // The floor and the walls are real stone (marble slabs, the ashlar of the new work), tinted to the
  // inside's bone white; they load meanwhile and the painted colour holds until then.
  let loaded = new Map<string, LoadedTexture>();
  const onLoad: (() => void)[] = [];
  function surface(name: string, id: string, tint: string, gloss = 0.1) {
    const m = kit.mat(name, tint, gloss);
    onLoad.push(() => {
      const t = loaded.get(id);
      if (!t) return;
      const [sw, sh] = [t.info.size_m[0], t.info.size_m[1] ?? t.info.size_m[0]];
      const grey = gpuTexture(device, greyOf(t).canvas, `${id} grey`); gpu.push(grey);
      m.diffuseMap = grey; m.diffuseMapTiling.set(1 / sw, 1 / sh);
      if (t.normal) { const normal = gpuTexture(device, t.normal, `${id} normal`); gpu.push(normal); m.normalMap = normal; m.normalMapTiling.set(1 / sw, 1 / sh); m.bumpiness = 0.6; }
      m.diffuse.copy(tintColour(tint, greyOf(t)));
      m.update();
    });
    return m;
  }
  /** A material painted with `c`, tiling every `metres` (UVs in metres), glowing by `glow`. */
  function painted(name: string, c: HTMLCanvasElement, metres: number[], { gloss = 0.1, glow = 0, base = '#ffffff' } = {}) {
    const m = kit.mat(name, base, gloss), t = kit.texture(c);
    m.diffuseMap = t; m.diffuseMapTiling.set(1 / metres[0], 1 / metres[1]);
    if (glow) { m.emissiveMap = t; m.emissive.set(1, 1, 1); m.emissiveIntensity = glow; m.emissiveMapTiling.set(1 / metres[0], 1 / metres[1]); }
    m.update(); return m;
  }
  const floorStone = surface('Losas de mármol', 'marbre', '#ddd7cb', 0.4);
  const wallStone = surface('Sillar blanco', 'carreu', '#e3dccf', 0.08);
  const white = kit.mat('Piedra blanca de las ramas', '#ece6db', 0.25);
  const base = kit.mat('Zócalo de la maqueta', '#3a3530', 0.1);
  const dark = kit.mat('Sombra de las puertas', '#1f1b18', 0.1);
  const glass = {
    warm: painted('Vidriera cálida', stainedGlass(random, WARM), [2.2, 2.2], { glow: 1.5, base: '#2a1610' }),
    cool: painted('Vidriera fría', stainedGlass(random, COOL), [2.2, 2.2], { glow: 1.4, base: '#101a2a' }),
    gold: painted('Vidriera del ábside', stainedGlass(random, GOLD), [2.2, 2.2], { glow: 1.3, base: '#2a2010' }),
    rose: painted('Rosetón de la Gloria', roseWindow(random), [1, 1], { glow: 1.5, base: '#18141c' }),
  };
  const bronze = painted('Puertas de bronce', bronzeDoor(), [1, 1], { gloss: 0.55 });
  // The columns' stone and their medallions open a narrow clearing round Gerard (`setClearing`).
  const stones = Object.fromEntries((Object.keys(STONES) as Stone[]).map(k => [k, clearing(painted(`Columna de ${STONES[k].name.toLowerCase()}`, speckles(random, STONES[k].colour), [1.2, 1.2], { gloss: STONES[k].gloss }))])) as Record<Stone, pc.StandardMaterial>;
  const medallions = clearing(painted('Medallones de los evangelistas', evangelists(), [1, 1], { glow: 0.9, gloss: 0.6 }));
  const trunks = [...Object.values(stones), medallions];
  const wood = kit.mat('Sillas de madera', '#9a6a3e', 0.25), woodDark = kit.mat('Patas de las sillas', '#4a3626', 0.2);
  const brass = kit.mat('Latón', '#c9a24a', 0.7), rope = kit.mat('Cordón rojo', '#a52a2a', 0.2);
  const metal = kit.mat('Tubos del órgano', '#b9b8b2', 0.85);
  const cream = kit.mat('Baldaquino', '#f3ead8', 0.3), gilt = kit.mat('Dorado del baldaquino', '#c48f4e', 0.6);
  const lamp = kit.mat('Lámparas del baldaquino', '#ffe6a8', 0.3, 2.2);
  const grapes = kit.mat('Uvas', '#5a2a5a', 0.4), leaves = kit.mat('Pámpanos', '#5d7a3e', 0.2), wheat = kit.mat('Espigas', '#d6b45a', 0.3);
  const cross = kit.mat('Cruz de madera', '#5a3e28', 0.2), body = kit.mat('Cristo', '#e8dcc8', 0.3);
  const cloth = kit.mat('Mantel del altar', '#f6f2ea', 0.2);
  const crypt = kit.mat('Luz de la cripta', '#ffcf8a', 0.2, 1.6);
  const daylight = kit.mat('Luz del día en la puerta', '#ffeccc', 0.2, 0.55);
  const sign = painted('Cartel de silencio', silence(), [1, 1], { gloss: 0.3 });

  const parts = {
    floor: new MeshBuilder(), base: new MeshBuilder(), wall: new MeshBuilder(), white: new MeshBuilder(), dark: new MeshBuilder(),
    warm: new MeshBuilder(), cool: new MeshBuilder(), gold: new MeshBuilder(), bronze: new MeshBuilder(),
    P: new MeshBuilder(), B: new MeshBuilder(), g: new MeshBuilder(), s: new MeshBuilder(), branches: new MeshBuilder(), vaultWarm: new MeshBuilder(), vaultCool: new MeshBuilder(), medallions: new MeshBuilder(),
    wood: new MeshBuilder(), woodDark: new MeshBuilder(), brass: new MeshBuilder(), rope: new MeshBuilder(), metal: new MeshBuilder(),
    cream: new MeshBuilder(), gilt: new MeshBuilder(), lamp: new MeshBuilder(), grapes: new MeshBuilder(), leaves: new MeshBuilder(), wheat: new MeshBuilder(),
    cross: new MeshBuilder(), body: new MeshBuilder(), cloth: new MeshBuilder(), crypt: new MeshBuilder(), daylight: new MeshBuilder(), sign: new MeshBuilder(),
  };
  /** The Glory's wall and the Passion arm's west wall, in their own turned frames. */
  const gloryParts = { wall: new MeshBuilder(), white: new MeshBuilder(), dark: new MeshBuilder(), rose: new MeshBuilder(), cool: new MeshBuilder(), bronze: new MeshBuilder() };
  const armParts = { dark: new MeshBuilder(), warm: new MeshBuilder() };

  // ------------------------------------------------------------ floor and plinth
  // Marble slabs over every cell inside the walls, one strip per row; the apse's are cut by its round wall.
  const inApse = (i: number, j: number) => i > 46 && Math.hypot(i - 46, j - CROSSING.z) < 14.5;
  plan.forEach((row, j) => {
    let start = -1;
    for (let i = 0; i <= row.length; i++) {
      const c = row[i] ?? ' ', floored = c !== ' ' && (i <= 46 || inApse(i, j));
      if (floored && start < 0) start = i;
      if (!floored && start >= 0) {
        const x0 = X(start) - CELL / 2, x1 = X(i - 1) + CELL / 2, z0 = Z(j) - CELL / 2, z1 = Z(j) + CELL / 2;
        parts.floor.quad([x0, 0, z1], [x1, 0, z1], [x1, 0, z0], [x0, 0, z0], [0, 1, 0], [x0, z1], [x1, z1], [x1, z0], [x0, z0]);
        start = -1;
      }
    }
  });
  // The model stands on a dark plinth shaped like the plan: the nave, the transept and the apse's half circle.
  box(parts.base, -54.75, -1.2, -23.25, 15.75, -0.03, 23.25);
  box(parts.base, -15.75, -1.2, -30.75, 15.75, -0.03, 30.75);
  lathe(parts.base, APSE.x, 0, [[APSE.r + 0.7, -1.2], [APSE.r + 0.7, -0.03]], 18, { from: -Math.PI / 2, to: Math.PI / 2 });

  // ------------------------------------------------------------ the far walls: tall, with the glass
  // The Passion side (north here): the nave's wall with a pair of lancets and a rose in every bay, the
  // transept's end wall with three tall windows and a rose over the Passion's bronze door.
  box(parts.wall, -54.75, 0, -23.25, -14.25, 15, -21.75);
  box(parts.wall, -15.75, 0, -30.75, -14.25, 15, -21.75);
  box(parts.wall, -15.75, 0, -30.75, 15.75, 20, -29.25);
  for (const cx of [-49.5, -41.25, -33.75, -26.25, -18.75]) window2(parts, cx, -21.75, parts.warm);
  window2(armParts, 0, 0, armParts.warm);
  for (const cx of [-6.5, 0, 6.5]) {
    arch(parts.dark, cx, 4.6, -29.2, 2.8, 9.4);
    arch(parts.warm, cx, 4.8, -29.15, 2.3, 9);
  }
  for (const cx of [-11.8, 11.8]) { arch(parts.dark, cx, 2.6, -29.2, 1.9, 6.6); arch(parts.warm, cx, 2.8, -29.15, 1.5, 6.2); }
  disc(parts.dark, 0, 17.6, -29.2, 2.9, 20); rose(parts.warm, [0, 17.6, -29.12], 2.5);
  // The Passion's doors, shut: bronze written over with the Gospel, in a dark recess.
  box(parts.dark, -2.9, 0, -29.3, 2.9, 4.6, -29.2);
  door(parts.bronze, -2.4, 2.4, 4, -29.15);

  // The Glory's inner wall (west, in its turned frame; x runs towards the Passion, the wall's face is z = 0):
  // the great rose, two smaller roses and four lancets over a gallery, the bronze doors with the
  // Lord's Prayer, and a blue window over each side door, as in the photos of 2026.
  box(gloryParts.wall, -23.25, 0, -1.5, 23.25, 18, 0);
  disc(gloryParts.dark, 0, 14.4, 0.04, 3.7, 24); rose(gloryParts.rose, [0, 14.4, 0.1], 3.2);
  for (const cx of [-3.7, 3.7]) { disc(gloryParts.dark, cx, 10.4, 0.04, 1.75, 16); rose(gloryParts.rose, [cx, 10.4, 0.1], 1.45); }
  for (const cx of [-5.1, -1.7, 1.7, 5.1]) { arch(gloryParts.dark, cx, 5.6, 0.04, 1.6, 2.8); arch(gloryParts.rose, cx, 5.75, 0.08, 1.25, 2.6); }
  // The choir's gallery: a balcony of white stone on corbels, dark arches under it.
  box(gloryParts.white, -9.5, 4.2, 0, 9.5, 4.9, 1.3);
  for (let k = 0; k < 8; k++) box(gloryParts.white, -8.9 + k * 2.54, 3.6, 0, -8.3 + k * 2.54, 4.2, 1);
  box(gloryParts.dark, -3, 0, 0.01, 3, 4.6, 0.06);
  door(gloryParts.bronze, -2.4, 2.4, 4, 0.1);
  for (const cx of [-12, 12]) {
    arch(gloryParts.dark, cx, 0, 0.04, 2.6, 2.2);
    disc(gloryParts.dark, cx, 6.8, 0.04, 1.5, 16); rose(gloryParts.cool, [cx, 6.8, 0.1], 1.25);
  }
  for (const cx of [-18.75, 18.75]) { arch(gloryParts.dark, cx, 3, 0.04, 1.9, 6.4); arch(gloryParts.cool, cx, 3.2, 0.08, 1.5, 6); }

  // ------------------------------------------------------------ the near walls: low, a band of glass
  // On the camera's side the walls are cut low, as in the houses, and keep a band of their glass:
  // cool along the Nativity side, warm on the Passion arm's east wall, gold round the apse.
  lowWall(parts, -54.75, 21.75, -14.25, 23.25, 'x', parts.cool);
  lowWall(parts, -15.75, 21.75, -14.25, 30.75, 'z', parts.cool);
  lowWall(parts, 14.25, 21.75, 15.75, 30.75, 'z', parts.cool);
  lowWall(parts, 14.25, -30.75, 15.75, -21.75, 'z', parts.warm);
  // The Nativity's end wall, with the door in the middle: daylight on the threshold from the portal outside.
  lowWall(parts, -15.75, 29.25, -2.6, 30.75, 'x', parts.cool);
  lowWall(parts, 2.6, 29.25, 15.75, 30.75, 'x', parts.cool);
  parts.daylight.quad([-2.6, 0.012, 30.75], [2.6, 0.012, 30.75], [2.6, 0.012, 28.4], [-2.6, 0.012, 28.4], [0, 1, 0], [0, 0], [1, 0], [1, 1], [0, 1]);
  for (const cx of [-2.85, 2.85]) box(parts.wall, cx - 0.25, 0, 29.2, cx + 0.25, LOW + 0.5, 30.8);
  // The apse: a round low wall with its chapels' buttresses and a band of gold glass.
  const apseFrom = -Math.PI / 2, apseTo = Math.PI / 2;
  lathe(parts.wall, APSE.x, 0, [[APSE.r + 0.7, 0], [APSE.r + 0.7, LOW]], 24, { from: apseFrom, to: apseTo });
  lathe(parts.white, APSE.x, 0, [[APSE.r + 0.75, LOW], [APSE.r - 1, LOW + 0.12]], 24, { from: apseFrom, to: apseTo });
  lathe(parts.gold, APSE.x, 0, [[APSE.r + 0.72, GLASS_FROM], [APSE.r + 0.72, GLASS_TO]], 24, { from: apseFrom, to: apseTo });
  for (let k = 0; k <= 7; k++) {
    const a = apseFrom + (apseTo - apseFrom) * k / 7, cx = APSE.x + Math.cos(a) * (APSE.r + 0.3), cz = Math.sin(a) * (APSE.r + 0.3);
    lathe(parts.white, cx, cz, [[0.75, 0], [0.75, LOW + 0.4], [0, LOW + 1.1]], 6);
  }

  // ------------------------------------------------------------ the forest of columns
  // Each column: a star-shaped trunk that turns round as it rises and its flutes fade into a
  // cylinder, a knot (the porphyry ones carry an Evangelist's lit oval), branches spreading to the
  // vault and the vault's cell above them, open at the oculus.
  plan.forEach((row, j) => [...row].forEach((c, i) => {
    if (!(c in STONES)) return;
    const stone = STONES[c as Stone], cx = X(i), cz = Z(j), b = parts[c as Stone];
    // The apse's columns rise to its higher vault.
    const knot = i > 46 ? 9 : stone.knot, top = i > 46 ? 15.5 : stone.top, r = stone.radius;
    lathe(b, cx, cz, [[r + 0.18, 0], [r + 0.18, 0.3], [r + 0.04, 0.42]], stone.points);
    trunk(b, cx, cz, r, stone.points, knot);
    blob(b, [cx, knot, cz], r * 1.45, r * 1.15, r * 1.45, stone.points, 5);
    // The trunk goes on up to the oculus; the branches leave the knot and fork once before the vault.
    lathe(parts.branches, cx, cz, [[r * 0.8, knot + r * 0.6], [r * 0.6, knot + 2.2], [0.4, top - 0.9]], 8);
    const turn = random() * Math.PI;
    for (let k = 0; k < stone.branches; k++) {
      const a = turn + k / stone.branches * Math.PI * 2, fork = knot + (top - knot) * 0.55;
      const elbow: V3 = [cx + Math.cos(a) * 1.1, fork, cz + Math.sin(a) * 1.1];
      tube(parts.branches, [cx, knot + r * 0.5, cz], elbow, r * 0.62, r * 0.48, 6);
      for (const spread of [-0.4, 0.4]) tube(parts.branches, elbow, [cx + Math.cos(a + spread) * 2.6, top - 0.35, cz + Math.sin(a + spread) * 2.6], r * 0.44, r * 0.3, 6);
    }
    cup(cz < 0 ? parts.vaultWarm : parts.vaultCool, cx, cz, top, RIM);
    const evangelist = EVANGELISTS[`${i},${j}`];
    if (evangelist) {
      // The oval faces the camera (+x +z), lit from inside like the real ones.
      const k = ['MATEU', 'MARC', 'LLUC', 'JOAN'].indexOf(evangelist), out: V3 = [Math.SQRT1_2, 0, Math.SQRT1_2], side: V3 = [Math.SQRT1_2, 0, -Math.SQRT1_2];
      const c0: V3 = [cx + out[0] * (r * 1.48), knot, cz + out[2] * (r * 1.48)];
      oval(parts.medallions, c0, side, 1.15, 1.5, out, k);
    }
  }));

  // ------------------------------------------------------------ the presbytery, the altar and the canopy
  // Two steps up, roped off and watched by a guard; the porphyry altar under the seven-sided canopy
  // with its fringe of lamps, vine and wheat, Christ hanging under it; the organ's pipes behind.
  const pres = rect(plan, '^');
  if (pres) {
    const [x0, z0, x1, z1] = [X(pres.i0) - CELL / 2, Z(pres.j0) - CELL / 2, X(pres.i1) + CELL / 2, Z(pres.j1) + CELL / 2];
    box(parts.white, x0, 0, z0, x1, 0.3, z1);
    box(parts.white, x0 + 0.5, 0.3, z0 + 0.3, x1 - 0.3, 0.6, z1 - 0.3);
    // The rope along its front and sides, on brass posts.
    const posts: [number, number][] = [];
    for (let v = z0; v <= z1 + 0.01; v += (z1 - z0) / 6) posts.push([x0 - 0.15, v]);
    for (let u = x0 + 1.5; u <= x1; u += 1.5) posts.push([u, z0 - 0.15], [u, z1 + 0.15]);
    for (const [px, pz] of posts) { lathe(parts.brass, px, pz, [[0.16, 0], [0.06, 0.08], [0.05, 0.9], [0.09, 0.95], [0, 1.05]], 6); }
    const rail = (a: V3, c: V3) => tube(parts.rope, a, c, 0.05, 0.05, 4);
    rail([x0 - 0.15, 0.85, z0], [x0 - 0.15, 0.85, z1]);
    rail([x0 - 0.15, 0.85, z0 - 0.15], [x1, 0.85, z0 - 0.15]);
    rail([x0 - 0.15, 0.85, z1 + 0.15], [x1, 0.85, z1 + 0.15]);
  }
  const altar = find(plan, 'A');
  if (altar) {
    const ax = X(altar.i), az = Z(altar.j);
    box(parts.P, ax - 0.8, 0.6, az - 1.3, ax + 0.8, 1.55, az + 1.3);
    box(parts.cloth, ax - 0.85, 1.55, az - 1.35, ax + 0.85, 1.6, az + 1.35);
    canopyOver(parts, ax, az);
  }
  for (const organ of findAll(plan, 'O')) {
    const ox = X(organ.i), oz = Z(organ.j);
    for (let k = 0; k < 9; k++) {
      const t = k / 8, h = 2.4 + Math.sin(t * Math.PI) * 3.4;
      lathe(parts.metal, ox + 0.5 - Math.abs(t - 0.5) * 0.8, oz - 1.2 + t * 2.4, [[0.13, 0.6], [0.13, 0.6 + h], [0.06, 0.8 + h]], 8);
    }
    box(parts.wood, ox - 0.1, 0.6, oz - 1.4, ox + 0.9, 1.6, oz + 1.4);
  }

  // ------------------------------------------------------------ chairs, the crypt's grilles, a sign
  // Rows of plain wooden chairs facing the altar in the central nave, four to a cell.
  for (const { i, j } of findAll(plan, 'h')) for (const du of [-0.38, 0.38]) for (const dv of [-0.36, 0.36]) {
    const cx = X(i) + du, cz = Z(j) + dv;
    box(parts.woodDark, cx - 0.2, 0, cz - 0.2, cx + 0.2, 0.42, cz + 0.2);
    box(parts.wood, cx - 0.24, 0.42, cz - 0.25, cx + 0.22, 0.48, cz + 0.25);
    box(parts.wood, cx - 0.26, 0.48, cz - 0.25, cx - 0.2, 0.95, cz + 0.25);
  }
  // Openings in the ambulatory's floor over the crypt, where Gaudí lies: warm light below, a brass rail round.
  for (const { i, j } of findAll(plan, 'c')) {
    const cx = X(i), cz = Z(j);
    box(parts.dark, cx - 0.7, -0.6, cz - 0.7, cx + 0.7, 0.01, cz + 0.7);
    box(parts.crypt, cx - 0.55, -0.5, cz - 0.55, cx + 0.55, -0.45, cz + 0.55);
    for (const [px, pz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) lathe(parts.brass, cx + px * 0.72, cz + pz * 0.72, [[0.05, 0], [0.05, 0.9], [0, 0.95]], 6);
    for (const [a, c] of [[[-1, -1], [1, -1]], [[1, -1], [1, 1]], [[1, 1], [-1, 1]], [[-1, 1], [-1, -1]]]) {
      tube(parts.brass, [cx + a[0] * 0.72, 0.88, cz + a[1] * 0.72], [cx + c[0] * 0.72, 0.88, cz + c[1] * 0.72], 0.04, 0.04, 4);
    }
  }
  // A red rope across the shut doors, the Passion's and the Glory's.
  for (const [a, c] of [[[-2.6, -28.4], [2.6, -28.4]], [[-52.3, -2.6], [-52.3, 2.6]]]) {
    for (const [px, pz] of [a, c]) lathe(parts.brass, px, pz, [[0.16, 0], [0.06, 0.08], [0.05, 0.9], [0.09, 0.95], [0, 1.05]], 6);
    tube(parts.rope, [a[0], 0.85, a[1]], [c[0], 0.85, c[1]], 0.05, 0.05, 4);
  }
  // A sign by the door asks for silence, Catalan first.
  for (const { i, j } of findAll(plan, 'i')) {
    const cx = X(i), cz = Z(j), out: V3 = [Math.SQRT1_2, 0, Math.SQRT1_2], side: V3 = [Math.SQRT1_2, 0, -Math.SQRT1_2];
    lathe(parts.brass, cx, cz, [[0.25, 0], [0.05, 0.06], [0.04, 1.4], [0, 1.45]], 6);
    const at = (u: number, y: number): V3 => [cx + side[0] * u + out[0] * 0.06, y, cz + side[2] * u + out[2] * 0.06];
    parts.sign.quad(at(-0.9, 1.2), at(0.9, 1.2), at(0.9, 2.4), at(-0.9, 2.4), out, [0, 1], [1, 1], [1, 0], [0, 0]);
  }

  // ------------------------------------------------------------ the light through the glass
  // Pools of coloured light on the floor, cool on the Nativity half and warm on the Passion half,
  // stretched along the sun's path, and a pale gold one under the crossing's lantern. They drift
  // slowly together and breathe, as the light does while the sun moves (`update`).
  // Each pool is the glass's own painting, blurred and faded at its edges, as light through it lands.
  const poolMat = (name: string, c: HTMLCanvasElement, hex: string, gain: number) => {
    const m = kit.mat(name, '#000000', 0);
    m.emissive.fromString(hex); m.emissiveMap = kit.texture(c); m.emissiveIntensity = gain;
    m.useLighting = false; m.blendType = pc.BLEND_ADDITIVE; m.depthWrite = false; m.update(); return m;
  };
  const pools = [
    { name: 'Luz de las vidrieras frías', palette: COOL, gain: 3, side: 1, mesh: new MeshBuilder() },
    { name: 'Luz de las vidrieras cálidas', palette: WARM, gain: 2.8, side: -1, mesh: new MeshBuilder() },
  ];
  const walkable = (i: number, j: number) => glyph(i, j) === '.';
  for (let n = 0; n < 150; n++) {
    const i = Math.floor(random() * plan[0].length), j = Math.floor(random() * plan.length);
    if (!walkable(i, j) || Math.abs(j - CROSSING.z) < 2) continue;
    const length = 3.6 + random() * 3, width = 1.8 + random() * 1.2, a = 0.5 + (random() - 0.5) * 0.3;
    patch(pools[j > CROSSING.z ? 0 : 1].mesh, [X(i) + (random() - 0.5) * 1.2, 0.03 + n * 0.0001, Z(j) + (random() - 0.5) * 1.2], a, length, width);
  }
  const goldPool = new MeshBuilder();
  patch(goldPool, [0, 0.025, 0], 0.4, 7, 6);
  const drifting = pools.map(p => ({ entity: add(p.name, p.mesh, poolMat(p.name, poolCanvas(random, p.palette), '#ffffff', p.gain), pivot, { batched: false, shadows: false })!, gain: p.gain, side: p.side }));
  add('Luz de la linterna', goldPool, poolMat('Luz de la linterna', poolCanvas(random, GOLD), '#ffe2a0', 1.1), pivot, { batched: false, shadows: false });

  // Coloured lights tint the stone near each glass, the canopy's lamps glow warm over the altar.
  function light(px: number, y: number, pz: number, hex: string, intensity: number, range: number) {
    const e = new pc.Entity('Luz de vidriera');
    e.addComponent('light', { type: 'omni', color: new pc.Color().fromString(hex), intensity, range, castShadows: false });
    e.setLocalPosition(x(CROSSING.x) + px / CELL, y / CELL, z(CROSSING.z) + pz / CELL); root.addChild(e); lights.push(e);
  }
  for (const px of [-44, -26, -6]) { light(px, 5, -17, '#ff8a3a', 1.3, 13); light(px, 5, 17, px === -26 ? '#4fb87a' : '#4f8ae0', 1.3, 13); }
  light(0, 5, -26, '#ff6a3a', 1.2, 10); light(0, 5, 26, '#4fa0e8', 1.2, 10);
  light(15, 6, 0, '#ffd59a', 1.6, 8); light(27, 4, 0, '#ffc86a', 1.1, 10);

  // ------------------------------------------------------------ visitors and the guard
  // Who stands inside: visitors looking about (the outside's crowd, src/landmarks/crowd.ts) and the guard at the rope.
  const crowd = LANDMARKS.get('crowd');
  const shared = new Map<string, pc.StandardMaterial>();
  // The nave is no map: a landmark built in it gets an empty place the size of the plan, and no river.
  const nave: GeoScene = {
    id: environment.id, name: environment.name, region: 'Eixample, Barcelona', attribution: '', fetched: '', cell_m: CELL, storey: 3, zoom: environment.zoom ?? 11,
    width: plan[0].length, depth: plan.length, grid: environment.grid, spawn: environment.spawn,
    areas: { water: [], forest: [], grass: [], square: [] }, roads: [], buildings: [], props: [], places: [], labels: [],
  };
  const crowdKit = (parent: pc.Entity): LandmarkKit => ({
    app, root: parent, cell: CELL, water: 0, scene: nave,
    mat(name, hex, gloss = 0.2, glow = 0) {
      const key = `${name}|${hex}|${gloss}|${glow}`;
      let m = shared.get(key);
      if (!m) { m = kit.mat(name, hex, gloss, glow); shared.set(key, m); }
      return m;
    },
    surface: (texture, tint, gloss = 0.1) => surface(`${texture} ${tint}`, texture, tint, gloss),
    part(name, type, material, position, scale, rotation, p = parent) {
      const e = new pc.Entity(name);
      e.addComponent('render', { type, material, castShadows: true, receiveShadows: true, batchGroupId: kit.batch });
      e.setLocalPosition(position[0], position[1], position[2]); e.setLocalScale(scale[0], scale[1], scale[2]);
      if (rotation) e.setLocalEulerAngles(rotation[0], rotation[1], rotation[2]);
      p.addChild(e); return e;
    },
    mesh: () => new MeshBuilder(),
    add: (name, builder, material, { shadows = true, parent: p = parent } = {}) => add(name, builder, material, p, { shadows }),
    texture: c => kit.texture(c),
  });
  // Where each group of visitors faces: the glass of their side, the altar from the crossing.
  const faceOf = (i: number, j: number) => j < 6 ? 180 : j > 34 ? 0 : i < 8 ? -90 : i > 26 ? 90 : j < CROSSING.z ? 180 : 0;
  for (const [n, group] of clusters(plan, 'v').entries()) {
    const holder = new pc.Entity(`Visitantes ${n}`);
    holder.setLocalPosition((X(group.i0) + X(group.i1)) / 2, 0, (Z(group.j0) + Z(group.j1)) / 2); pivot.addChild(holder);
    const w = group.i1 - group.i0 + 1, d = group.j1 - group.j0 + 1;
    crowd?.build(crowdKit(holder), { kind: 'crowd', id: `dentro-${n}`, x: 0, z: 0, angle: 0, w, d, solid: true, params: { style: 'scatter', count: group.cells * 2, face: faceOf(group.i0, group.j0), phones: 0.45, seed: 40 + n } });
  }
  for (const [n, spot] of findAll(plan, 'w').entries()) {
    // The guard stands at the head of an empty queue, facing the nave.
    const holder = new pc.Entity(`Vigilante ${n}`);
    holder.setLocalPosition(X(spot.i) - CELL * 0.7, 0, Z(spot.j)); pivot.addChild(holder);
    crowd?.build(crowdKit(holder), { kind: 'crowd', id: `vigilante-${n}`, x: 0, z: 0, angle: 0, w: 1, d: 1, solid: true, params: { style: 'queue', count: 0, guard: true, seed: 7 } });
  }

  // ------------------------------------------------------------ meshes, one per material
  // Each material that opens sets its own clearing (a value left in the shared scope would carry over to the next).
  const vaults = [vaultMaterial('Bóveda (lado de la Pasión)', '#fff0e2'), vaultMaterial('Bóveda (lado del Nacimiento)', '#eef3fa')];
  const branches = clearing(kit.mat('Ramas de piedra blanca', '#ece6db', 0.25));
  const looks: Record<keyof typeof parts, pc.Material> = {
    floor: floorStone, base, wall: wallStone, white, dark, warm: glass.warm, cool: glass.cool, gold: glass.gold, bronze,
    P: stones.P, B: stones.B, g: stones.g, s: stones.s, branches, vaultWarm: vaults[0], vaultCool: vaults[1], medallions,
    wood, woodDark, brass, rope, metal, cream, gilt, lamp, grapes, leaves, wheat, cross, body, cloth, crypt, daylight, sign,
  };
  for (const [key, builder] of Object.entries(parts) as [keyof typeof parts, Mesh][]) {
    // The vault opens round Gerard (its own shader) and casts no shadow, so the floor keeps its light.
    if (key === 'vaultWarm' || key === 'vaultCool') add('Bóveda', builder, looks[key], pivot, { batched: false, shadows: false });
    else add(`Basílica: ${key}`, builder, looks[key], pivot, { shadows: key !== 'floor' && key !== 'daylight' });
  }
  const gloryLooks: Record<keyof typeof gloryParts, pc.Material> = { wall: wallStone, white, dark, rose: glass.rose, cool: glass.cool, bronze };
  for (const [key, builder] of Object.entries(gloryParts) as [keyof typeof gloryParts, Mesh][]) add(`Gloria: ${key}`, builder, gloryLooks[key], glory);
  add('Brazo de la Pasión: dark', armParts.dark, dark, arm); add('Brazo de la Pasión: warm', armParts.warm, glass.warm, arm);

  loadTextures(TEXTURES).then(t => { if (!alive) return; loaded = t; onLoad.forEach(dress => dress()); });

  // ------------------------------------------------------------ the vault's clearing round Gerard
  /**
   * The vault's material: its cells painted as seen from below, tinted by the glass of their side,
   * cut open round the line from Gerard to the camera and, in the overview, over the near half.
   */
  function vaultMaterial(name: string, tint: string) {
    return clearing(painted(name, vaultCanvas(random), [1, 1], { gloss: 0.2, glow: 0.14, base: tint }));
  }
  function clearing(m: pc.StandardMaterial) {
    const glsl = m.getShaderChunks(pc.SHADERLANGUAGE_GLSL), wgsl = m.getShaderChunks(pc.SHADERLANGUAGE_WGSL);
    glsl.set('litUserDeclarationPS', CLEARING_DECLARATION); glsl.set('litUserMainStartPS', CLEARING_MAIN); glsl.set('litUserMainEndPS', CLEARING_END);
    wgsl.set('litUserDeclarationPS', CLEARING_DECLARATION_WGSL); wgsl.set('litUserMainStartPS', CLEARING_MAIN_WGSL); wgsl.set('litUserMainEndPS', CLEARING_END_WGSL);
    m.update(); return m;
  }
  const cutFocus = device.scope.resolve('naveCutFocus'), cutToCamera = device.scope.resolve('naveCutToCamera'), cutRadius = device.scope.resolve('naveCutRadius');
  const cutPlane = device.scope.resolve('naveCutPlane');
  // Every pass binds the declared uniforms, so they get a value up front.
  cutRadius.setValue(0); cutFocus.setValue([0, 0, 0]); cutToCamera.setValue([0, 1, 0]); cutPlane.setValue([0, 0, 0, 1e5]);
  /** The vault: the clearing and, in the overview, the plane; the branches and trunks: only a narrow clearing right round Gerard. */
  function setClearing(radius: number, plane: number[]) {
    for (const m of vaults) { m.setParameter('naveCutRadius', radius); m.setParameter('naveCutPlane', plane); }
    branches.setParameter('naveCutRadius', radius ? BRANCH_CLEARING : 0); branches.setParameter('naveCutPlane', [0, 0, 0, 1e5]);
    for (const m of trunks) { m.setParameter('naveCutRadius', radius ? TRUNK_CLEARING : 0); m.setParameter('naveCutPlane', [0, 0, 0, 1e5]); }
  }
  setClearing(0, [0, 0, 0, 1e5]);
  /** The game's camera, whose pulled-back view (the overview) opens the vault's near half like a model cut in two. */
  const view = () => app.systems.camera?.cameras.find(c => c.projection === pc.PROJECTION_ORTHOGRAPHIC);
  const crossing = new pc.Vec3(x(CROSSING.x), 0, z(CROSSING.z)), zoom = environment.zoom ?? 11;

  let time = 0;
  return {
    update(dt: number, animate: boolean, focus?: pc.Vec3, toCamera?: pc.Vec3) {
      if (focus && toCamera) {
        const d = toCamera.clone().normalize();
        cutFocus.setValue([focus.x, focus.y, focus.z]); cutToCamera.setValue([d.x, d.y, d.z]);
        // The cut's plane faces the camera across the ground and sweeps in to the crossing as the view pulls back.
        const across = new pc.Vec3(d.x, 0, d.z).normalize(), height = view()?.orthoHeight ?? zoom;
        const t = Math.min(1, Math.max(0, (height - zoom * 1.25) / (zoom * 0.6)));
        setClearing(CLEARING, [across.x, 0, across.z, across.dot(crossing) + (1 - t) * 80]);
      } else setClearing(0, [0, 0, 0, 1e5]);
      if (!animate) return;
      time += dt;
      // The sun walks: every pool slides the same slow way and breathes a little.
      for (const [k, p] of drifting.entries()) {
        p.entity.setLocalPosition(Math.sin(time * 0.05 + k) * 1.2, 0, Math.cos(time * 0.04 + k * 0.7) * 0.8 * p.side);
        const m = p.entity.render!.meshInstances[0].material as pc.StandardMaterial;
        m.emissiveIntensity = p.gain * (0.85 + 0.15 * Math.sin(time * 0.3 + k * 1.7)); m.update();
      }
    },
    destroy() { alive = false; cutRadius.setValue(0); meshes.forEach(m => m.destroy()); gpu.forEach(t => t.destroy()); lights.length = 0; },
  };
}

// ------------------------------------------------------------ the vault's clearing (GLSL and WGSL, keep both in step)
const CLEARING_DECLARATION = `
uniform vec3 naveCutFocus;
uniform vec3 naveCutToCamera;
uniform float naveCutRadius;
uniform vec4 naveCutPlane;
float naveCutGlow = 0.0;
`;
const CLEARING_MAIN = `
#if defined(FORWARD_PASS) || defined(PREPASS_PASS)
if (dot(naveCutPlane.xyz, vPositionW) > naveCutPlane.w) discard;
if (naveCutRadius > 0.0) {
  vec3 cutOffset = vPositionW - naveCutFocus;
  float cutAlong = dot(cutOffset, naveCutToCamera);
  float cutAcross = length(cutOffset - naveCutToCamera * cutAlong);
  if (cutAlong > 0.0 && cutAcross < naveCutRadius) discard;
  naveCutGlow = step(0.0, cutAlong) * (1.0 - smoothstep(naveCutRadius, naveCutRadius + ${CLEARING_EDGE.toFixed(2)}, cutAcross));
}
#endif
`;
const CLEARING_END = `
#ifdef FORWARD_PASS
gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(1.0, 0.88, 0.62), naveCutGlow * 0.55);
#endif
`;
const CLEARING_DECLARATION_WGSL = `
uniform naveCutFocus: vec3f;
uniform naveCutToCamera: vec3f;
uniform naveCutRadius: f32;
uniform naveCutPlane: vec4f;
var<private> naveCutGlow: f32 = 0.0;
`;
const CLEARING_MAIN_WGSL = `
#if defined(FORWARD_PASS) || defined(PREPASS_PASS)
if (dot(uniform.naveCutPlane.xyz, vPositionW) > uniform.naveCutPlane.w) { discard; }
if (uniform.naveCutRadius > 0.0) {
  let cutOffset = vPositionW - uniform.naveCutFocus;
  let cutAlong = dot(cutOffset, uniform.naveCutToCamera);
  let cutAcross = length(cutOffset - uniform.naveCutToCamera * cutAlong);
  if (cutAlong > 0.0 && cutAcross < uniform.naveCutRadius) { discard; }
  naveCutGlow = step(0.0, cutAlong) * (1.0 - smoothstep(uniform.naveCutRadius, uniform.naveCutRadius + ${CLEARING_EDGE.toFixed(2)}, cutAcross));
}
#endif
`;
const CLEARING_END_WGSL = `
#ifdef FORWARD_PASS
output.color = vec4f(mix(output.color.rgb, vec3f(1.0, 0.88, 0.62), naveCutGlow * 0.55), output.color.a);
#endif
`;

// ------------------------------------------------------------ the plan

/** Every cell of `glyph` in the plan. */
function findAll(plan: string[], glyph: string) {
  return plan.flatMap((row, j) => [...row].flatMap((c, i) => c === glyph ? [{ i, j }] : []));
}
function find(plan: string[], glyph: string) { return findAll(plan, glyph)[0]; }
/** The rectangle round every cell of `glyph` (the presbytery, whose altar and organ sit inside it). */
function rect(plan: string[], glyph: string) {
  const cells = [...findAll(plan, glyph), ...findAll(plan, 'A'), ...findAll(plan, 'O')];
  if (!findAll(plan, glyph).length) return undefined;
  const is = cells.map(c => c.i), js = cells.map(c => c.j);
  return { i0: Math.min(...is), i1: Math.max(...is), j0: Math.min(...js), j1: Math.max(...js) };
}
/** Groups of touching cells of `glyph`, each as its bounding rectangle. */
function clusters(plan: string[], glyph: string) {
  const seen = new Set<string>(), out: { i0: number; i1: number; j0: number; j1: number; cells: number }[] = [];
  for (const start of findAll(plan, glyph)) {
    if (seen.has(`${start.i},${start.j}`)) continue;
    const queue = [start], group: { i: number; j: number }[] = [];
    seen.add(`${start.i},${start.j}`);
    while (queue.length) {
      const c = queue.shift()!; group.push(c);
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const n = { i: c.i + di, j: c.j + dj }, key = `${n.i},${n.j}`;
        if (plan[n.j]?.[n.i] === glyph && !seen.has(key)) { seen.add(key); queue.push(n); }
      }
    }
    out.push({ i0: Math.min(...group.map(c => c.i)), i1: Math.max(...group.map(c => c.i)), j0: Math.min(...group.map(c => c.j)), j1: Math.max(...group.map(c => c.j)), cells: group.length });
  }
  return out;
}

// ------------------------------------------------------------ pieces (metres, UVs in metres)

/** A nave bay's windows on a wall facing +z at `wz`: two lancets and a rose over them, in their dark reveals. */
function window2(parts: { dark: Mesh }, cx: number, wz: number, glass: Mesh) {
  for (const dx of [-1.15, 1.15]) { arch(parts.dark, cx + dx, 2.2, wz + 0.04, 1.85, 6.9); arch(glass, cx + dx, 2.35, wz + 0.08, 1.45, 6.6); }
  disc(parts.dark, cx, 11.9, wz + 0.04, 1.75, 16); rose(glass, [cx, 11.9, wz + 0.1], 1.45);
}
/**
 * A wall on the camera's side, cut low: stone, the band of glass on the face the camera sees, a sill.
 * `along` is the axis it runs along; its glass faces +z (along x) or +x (along z).
 */
function lowWall(parts: { wall: Mesh; white: Mesh }, x0: number, z0: number, x1: number, z1: number, along: 'x' | 'z', glass: Mesh) {
  box(parts.wall, x0, 0, z0, x1, LOW, z1);
  box(parts.white, x0 - 0.05, LOW, z0 - 0.05, x1 + 0.05, LOW + 0.12, z1 + 0.05);
  if (along === 'x') glass.quad([x0, GLASS_FROM, z1 + 0.02], [x1, GLASS_FROM, z1 + 0.02], [x1, GLASS_TO, z1 + 0.02], [x0, GLASS_TO, z1 + 0.02], [0, 0, 1], [x0, GLASS_FROM], [x1, GLASS_FROM], [x1, GLASS_TO], [x0, GLASS_TO]);
  else glass.quad([x1 + 0.02, GLASS_FROM, z1], [x1 + 0.02, GLASS_FROM, z0], [x1 + 0.02, GLASS_TO, z0], [x1 + 0.02, GLASS_TO, z1], [1, 0, 0], [-z1, GLASS_FROM], [-z0, GLASS_FROM], [-z0, GLASS_TO], [-z1, GLASS_TO]);
}
/**
 * A trunk whose section is a star of `points` points: it turns as it rises and its flutes grow
 * shallow, so it reads as a polygon at the foot and nearly round at the knot.
 */
function trunk(b: Mesh, cx: number, cz: number, r: number, points: number, h: number) {
  const rings = 6, n = points * 2;
  const ring = (k: number) => {
    const t = k / rings, depth = 0.22 * (1 - t) + 0.04, twist = t * Math.PI / points * 0.6;
    return Array.from({ length: n }, (_, m) => {
      const a = twist + m / n * Math.PI * 2, rr = m % 2 ? r * (1 - depth) : r;
      return [cx + Math.cos(a) * rr, t * h, cz + Math.sin(a) * rr] as V3;
    });
  };
  const around = Math.PI * 2 * r / n;
  for (let k = 0; k < rings; k++) {
    const lo = ring(k), hi = ring(k + 1);
    for (let m = 0; m < n; m++) {
      const o = (m + 1) % n, mx = (lo[m][0] + lo[o][0]) / 2 - cx, mz = (lo[m][2] + lo[o][2]) / 2 - cz;
      b.quad(lo[m], lo[o], hi[o], hi[m], [mx, 0, mz], [m * around, lo[m][1]], [(m + 1) * around, lo[m][1]], [(m + 1) * around, hi[m][1]], [m * around, hi[m][1]]);
    }
  }
}
/** A round bar from `a` to `c`, its radius going from `r0` to `r1` (a branch, a rope, a rail). */
function tube(b: Mesh, a: V3, c: V3, r0: number, r1: number, sides: number) {
  const d = norm([c[0] - a[0], c[1] - a[1], c[2] - a[2]]);
  const u = norm(cross(d, Math.abs(d[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0])), v = cross(u, d);
  const length = Math.hypot(c[0] - a[0], c[1] - a[1], c[2] - a[2]);
  const at = (p: V3, r: number, k: number): V3 => {
    const t = k / sides * Math.PI * 2, cs = Math.cos(t) * r, sn = Math.sin(t) * r;
    return [p[0] + u[0] * cs + v[0] * sn, p[1] + u[1] * cs + v[1] * sn, p[2] + u[2] * cs + v[2] * sn];
  };
  for (let k = 0; k < sides; k++) {
    const t = (k + 0.5) / sides * Math.PI * 2, out: V3 = [u[0] * Math.cos(t) + v[0] * Math.sin(t), u[1] * Math.cos(t) + v[1] * Math.sin(t), u[2] * Math.cos(t) + v[2] * Math.sin(t)];
    const w0 = k / sides * Math.PI * 2 * r0, w1 = (k + 1) / sides * Math.PI * 2 * r0;
    b.quad(at(a, r0, k), at(a, r0, k + 1), at(c, r1, k + 1), at(c, r1, k), out, [w0, 0], [w1, 0], [w1, length], [w0, length]);
  }
}
/**
 * A cell of the vault: a shallow eight-sided funnel opening upwards from its oculus to its rim at `top`,
 * its inside facing the camera and painted (0–1 across the rim) as the vault looks from below.
 */
function cup(b: Mesh, cx: number, cz: number, top: number, rim: number) {
  const profile: [number, number][] = [[0.7, top - 0.95], [1.8, top - 0.5], [3, top - 0.14], [rim, top]];
  const sides = 8, phase = Math.PI / 8;
  const p = (r: number, y: number, a: number): V3 => [cx + Math.cos(a) * r, y, cz + Math.sin(a) * r];
  const uv = (r: number, a: number) => [0.5 + Math.cos(a) * r / (2 * rim), 0.5 + Math.sin(a) * r / (2 * rim)];
  for (let j = 0; j < sides; j++) {
    const a0 = phase + j / sides * Math.PI * 2, a1 = phase + (j + 1) / sides * Math.PI * 2, am = (a0 + a1) / 2;
    for (let k = 0; k + 1 < profile.length; k++) {
      const [r0, y0] = profile[k], [r1, y1] = profile[k + 1], slope = (y1 - y0) / (r1 - r0);
      b.quad(p(r0, y0, a0), p(r0, y0, a1), p(r1, y1, a1), p(r1, y1, a0), [-Math.cos(am) * slope, 1, -Math.sin(am) * slope], uv(r0, a0), uv(r0, a1), uv(r1, a1), uv(r1, a0));
    }
    // The rim's edge, so the cell reads as a shell of stone.
    b.quad(p(rim, top, a0), p(rim, top, a1), p(rim, top - 0.35, a1), p(rim, top - 0.35, a0), [Math.cos(am), 0, Math.sin(am)], uv(rim * 0.98, a0), uv(rim * 0.98, a1), uv(rim * 0.98, a1), uv(rim * 0.98, a0));
  }
}
/** A pair of doors facing +z from `x0` to `x1`, `h` high: the painting spread over both (UVs 0–1, its top up). */
function door(b: Mesh, x0: number, x1: number, h: number, z: number) {
  b.quad([x0, 0, z], [x1, 0, z], [x1, h, z], [x0, h, z], [0, 0, 1], [0, 1], [1, 1], [1, 0], [0, 0]);
}
/** A round window facing +z, its painting spread over the whole disc (UVs 0–1). */
function rose(b: Mesh, c: V3, r: number, segments = 24) {
  for (let j = 0; j < segments; j++) {
    const a0 = j / segments * Math.PI * 2, a1 = (j + 1) / segments * Math.PI * 2;
    b.tri(c, [c[0] + Math.cos(a0) * r, c[1] + Math.sin(a0) * r, c[2]], [c[0] + Math.cos(a1) * r, c[1] + Math.sin(a1) * r, c[2]], [0, 0, 1],
      [0.5, 0.5], [0.5 + Math.cos(a0) / 2, 0.5 - Math.sin(a0) / 2], [0.5 + Math.cos(a1) / 2, 0.5 - Math.sin(a1) / 2]);
  }
}
/** An Evangelist's oval on a knot, facing `out`, taking the `k`-th quarter of the medallions' painting. */
function oval(b: Mesh, c: V3, side: V3, w: number, h: number, out: V3, k: number) {
  const segments = 16, centre: number[] = [(k + 0.5) / 4, 0.5];
  for (let j = 0; j < segments; j++) {
    const a0 = j / segments * Math.PI * 2, a1 = (j + 1) / segments * Math.PI * 2;
    const at = (a: number): V3 => [c[0] + side[0] * Math.cos(a) * w / 2, c[1] + Math.sin(a) * h / 2, c[2] + side[2] * Math.cos(a) * w / 2];
    const uv = (a: number) => [centre[0] + Math.cos(a) * 0.118, 0.5 - Math.sin(a) * 0.46];
    b.tri(c, at(a0), at(a1), out, centre, uv(a0), uv(a1));
  }
}
/** A soft patch of light on the floor at `c`, `length` along the angle `a` (radians) and `width` across. */
function patch(b: Mesh, c: V3, a: number, length: number, width: number) {
  const u: V3 = [Math.cos(a) * length / 2, 0, Math.sin(a) * length / 2], v: V3 = [-Math.sin(a) * width / 2, 0, Math.cos(a) * width / 2];
  const at = (su: number, sv: number): V3 => [c[0] + u[0] * su + v[0] * sv, c[1], c[2] + u[2] * su + v[2] * sv];
  b.quad(at(-1, -1), at(1, -1), at(1, 1), at(-1, 1), [0, 1, 0], [0, 0], [1, 0], [1, 1], [0, 1]);
}
/**
 * The canopy over the altar: a seven-sided parasol, cream with a gilt rim, fifty lamps hanging
 * round it, vine leaves, grapes and ears of wheat, and Christ on the cross under it.
 */
function canopyOver(parts: Record<'cream' | 'gilt' | 'lamp' | 'grapes' | 'leaves' | 'wheat' | 'cross' | 'body' | 'white', Mesh>, cx: number, cz: number) {
  const y = 7.4, r = 2.7, sides = 7;
  lathe(parts.cream, cx, cz, [[r, y], [r * 0.45, y + 0.7], [0, y + 1]], sides, { phase: Math.PI / 2 });
  lathe(parts.gilt, cx, cz, [[r + 0.05, y - 0.6], [r + 0.05, y], [r - 0.2, y]], sides, { phase: Math.PI / 2 });
  const corner = (k: number) => { const a = Math.PI / 2 + k / sides * Math.PI * 2; return [cx + Math.cos(a) * r, cz + Math.sin(a) * r]; };
  for (let k = 0; k < 50; k++) {
    // Fifty lamps spaced along the seven edges.
    const t = k / 50 * sides, e = Math.floor(t), f = t - e, [ax, az] = corner(e), [bx, bz] = corner(e + 1);
    const px = ax + (bx - ax) * f, pz = az + (bz - az) * f, drop = 0.9 + (k % 3) * 0.25;
    tube(parts.gilt, [px, y - 0.6, pz], [px, y - 0.6 - drop, pz], 0.02, 0.02, 3);
    blob(parts.lamp, [px, y - 0.7 - drop, pz], 0.11, 0.13, 0.11, 6, 3);
    if (k % 2) blob(parts.grapes, [px, y - 0.75, pz], 0.12, 0.2, 0.12, 5, 3);
    else blob(parts.leaves, [px, y - 0.68, pz], 0.22, 0.08, 0.18, 5, 3);
    if (k % 5 === 0) tube(parts.wheat, [px, y - 0.6, pz], [px, y - 1.3, pz], 0.05, 0.02, 4);
  }
  // Christ crucified, hanging under it.
  tube(parts.cross, [cx, y - 3.8, cz], [cx, y - 1.1, cz], 0.07, 0.07, 4);
  tube(parts.cross, [cx, y - 1.75, cz - 0.75], [cx, y - 1.75, cz + 0.75], 0.06, 0.06, 4);
  blob(parts.body, [cx + 0.1, y - 2.5, cz], 0.14, 0.55, 0.16, 6, 4);
  blob(parts.body, [cx + 0.1, y - 1.85, cz], 0.12, 0.13, 0.12, 6, 3);
  for (const s of [-1, 1]) tube(parts.body, [cx + 0.1, y - 2.1, cz], [cx + 0.1, y - 1.78, cz + s * 0.65], 0.05, 0.04, 4);
  // Four cords up into the vault.
  for (let k = 0; k < 4; k++) {
    const a = Math.PI / 4 + k * Math.PI / 2;
    tube(parts.cross, [cx + Math.cos(a) * r * 0.8, y + 0.2, cz + Math.sin(a) * r * 0.8], [cx + Math.cos(a) * 4.6, 15.5, cz + Math.sin(a) * 4.6], 0.025, 0.025, 3);
  }
}

const norm = (v: V3): V3 => { const l = Math.hypot(...v) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

// ------------------------------------------------------------ painted surfaces (own procedural painting)

/**
 * Vila-Grau's glass: rows of panes of uneven width in the side's colours, each a little lighter at
 * its heart, some with a disc of a brighter colour, all held in dark lead.
 */
function stainedGlass(random: () => number, palette: string[]) {
  return canvas(256, 256, ctx => {
    ctx.fillStyle = '#1b1820'; ctx.fillRect(0, 0, 256, 256);
    const pick = () => palette[Math.floor(random() * palette.length)];
    for (let y = 0; y < 256;) {
      const h = Math.min(256 - y, 18 + random() * 28);
      for (let x = 0; x < 256;) {
        const w = Math.min(256 - x, 12 + random() * 36);
        const g = ctx.createRadialGradient(x + w / 2, y + h / 2, 1, x + w / 2, y + h / 2, Math.max(w, h) * 0.7);
        const colour = pick();
        g.addColorStop(0, '#ffffff'); g.addColorStop(0.25, colour); g.addColorStop(1, colour);
        ctx.fillStyle = g; ctx.globalAlpha = 1; ctx.fillRect(x + 1.5, y + 1.5, w - 3, h - 3);
        ctx.globalAlpha = 0.18; ctx.fillStyle = '#000000'; ctx.fillRect(x + 1.5, y + h * 0.6, w - 3, h * 0.4 - 1.5); ctx.globalAlpha = 1;
        x += w;
      }
      y += h;
    }
    for (let i = 0; i < 14; i++) {
      const x = random() * 256, y = random() * 256, r = 5 + random() * 12;
      ctx.fillStyle = pick(); ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#1b1820'; ctx.lineWidth = 2.5; ctx.stroke();
    }
  });
}
/** The Glory's rose: rings of round panes round a gold heart, blue, green, yellow and orange. */
function roseWindow(random: () => number) {
  return canvas(256, 256, ctx => {
    ctx.fillStyle = '#1b1820'; ctx.fillRect(0, 0, 256, 256);
    const ring = (radius: number, count: number, size: number, offset: number) => {
      for (let k = 0; k < count; k++) {
        const a = offset + k / count * Math.PI * 2, px = 128 + Math.cos(a) * radius, py = 128 + Math.sin(a) * radius;
        const g = ctx.createRadialGradient(px, py, 1, px, py, size);
        const colour = ROSE[Math.floor(random() * ROSE.length)];
        g.addColorStop(0, '#ffffff'); g.addColorStop(0.35, colour); g.addColorStop(1, colour);
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(px, py, size, 0, Math.PI * 2); ctx.fill();
      }
    };
    ring(108, 24, 15, 0); ring(78, 16, 15, 0.2); ring(48, 10, 14, 0); ring(0, 1, 22, 0);
    ctx.fillStyle = '#f5d06a'; ctx.beginPath(); ctx.arc(128, 128, 14, 0, Math.PI * 2); ctx.fill();
  });
}
/** Polished stone with its grain: specks lighter and darker than `colour`. */
function speckles(random: () => number, colour: string) {
  return canvas(128, 128, ctx => {
    ctx.fillStyle = colour; ctx.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 900; i++) {
      ctx.fillStyle = random() > 0.5 ? 'rgba(255,250,240,.16)' : 'rgba(20,16,12,.18)';
      ctx.fillRect(random() * 128, random() * 128, 1 + random() * 2, 1 + random() * 2);
    }
  });
}
/**
 * A vault cell from below: white stone, a ring of lit openings and gold-peach rays spreading from
 * the oculus, as the vault over the nave looks when one looks up.
 */
function vaultCanvas(random: () => number) {
  return canvas(512, 512, ctx => {
    ctx.fillStyle = '#efe9df'; ctx.fillRect(0, 0, 512, 512);
    // Faint facets of the hyperboloids.
    for (let k = 0; k < 16; k++) {
      const a = k / 16 * Math.PI * 2;
      ctx.strokeStyle = 'rgba(120,110,95,.18)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(256 + Math.cos(a) * 60, 256 + Math.sin(a) * 60); ctx.lineTo(256 + Math.cos(a) * 250, 256 + Math.sin(a) * 250); ctx.stroke();
    }
    for (let k = 0; k < 24; k++) {
      const a = k / 24 * Math.PI * 2, long = k % 2 ? 170 : 235, half = k % 2 ? 0.08 : 0.12;
      const g = ctx.createLinearGradient(256, 256, 256 + Math.cos(a) * long, 256 + Math.sin(a) * long);
      g.addColorStop(0, '#c98642'); g.addColorStop(0.55, 'rgba(222,160,100,.75)'); g.addColorStop(1, 'rgba(232,190,140,0)');
      ctx.fillStyle = g; ctx.beginPath();
      ctx.moveTo(256 + Math.cos(a - half) * 40, 256 + Math.sin(a - half) * 40);
      ctx.lineTo(256 + Math.cos(a) * long, 256 + Math.sin(a) * long);
      ctx.lineTo(256 + Math.cos(a + half) * 40, 256 + Math.sin(a + half) * 40);
      ctx.fill();
    }
    for (let k = 0; k < 12; k++) {
      const a = (k + 0.5) / 12 * Math.PI * 2, r = 120 + random() * 20;
      ctx.fillStyle = '#fff5d0'; ctx.beginPath(); ctx.arc(256 + Math.cos(a) * r, 256 + Math.sin(a) * r, 6 + random() * 4, 0, Math.PI * 2); ctx.fill();
    }
    ctx.strokeStyle = '#c48f4e'; ctx.lineWidth = 10; ctx.beginPath(); ctx.arc(256, 256, 44, 0, Math.PI * 2); ctx.stroke();
  });
}
/** The four Evangelists' ovals side by side: a gold ground, the winged figure in dark line, the name. */
function evangelists() {
  return canvas(512, 256, ctx => {
    ['MATEU', 'MARC', 'LLUC', 'JOAN'].forEach((name, k) => {
      const cx = 64 + k * 128;
      const g = ctx.createRadialGradient(cx, 110, 4, cx, 128, 120);
      g.addColorStop(0, '#fff2c0'); g.addColorStop(0.6, '#e8b04a'); g.addColorStop(1, name === 'LLUC' || name === 'MATEU' ? '#7a9a3a' : '#c0582a');
      ctx.fillStyle = g; ctx.fillRect(k * 128, 0, 128, 256);
      ctx.strokeStyle = '#3a2a1a'; ctx.lineWidth = 4; ctx.lineCap = 'round';
      // A body and two raised wings: an angel, a lion, a bull or an eagle, all winged.
      ctx.beginPath(); ctx.ellipse(cx, 130, 20, 34, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(cx, 84, 14, 0, Math.PI * 2); ctx.stroke();
      for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(cx + s * 16, 112); ctx.quadraticCurveTo(cx + s * 52, 80, cx + s * 40, 50); ctx.stroke(); }
      if (name === 'LLUC') for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(cx + s * 8, 74); ctx.lineTo(cx + s * 20, 62); ctx.stroke(); }
      ctx.fillStyle = '#3a2a1a'; ctx.font = '700 22px Georgia, serif'; ctx.textAlign = 'center'; ctx.fillText(name, cx, 205);
    });
  });
}
/** Bronze doors written over in raised letters: the Lord's Prayer in Catalan, its bread line in gold. */
function bronzeDoor() {
  return canvas(512, 512, ctx => {
    ctx.fillStyle = '#5e4a2e'; ctx.fillRect(0, 0, 512, 512);
    const lines = ['PARE NOSTRE QUE ESTEU', 'EN EL CEL SIGUI SANTIFICAT', 'EL VOSTRE NOM VINGUI', 'A NOSALTRES EL VOSTRE', 'REGNE FACI\'S LA VOSTRA', 'VOLUNTAT AIXÍ EN LA TERRA', 'COM ES FA EN EL CEL',
      'DONEU-NOS AVUI', 'EL PA DE CADA DIA', 'I PERDONEU LES NOSTRES', 'CULPES AIXÍ COM NOSALTRES', 'PERDONEM ELS QUI ENS', 'HAN OFÈS'];
    ctx.textAlign = 'center'; ctx.font = '700 30px Georgia, serif';
    lines.forEach((line, k) => {
      const gold = k === 7 || k === 8;
      ctx.fillStyle = '#2e2416'; ctx.fillText(line, 258, 40 + k * 37, 480);
      ctx.fillStyle = gold ? '#f0c860' : '#a8875a'; ctx.fillText(line, 256, 38 + k * 37, 480);
    });
    ctx.fillStyle = '#2e2416'; ctx.fillRect(254, 0, 4, 512);
  });
}
/** The sign by the door. */
function silence() {
  return canvas(256, 170, ctx => {
    ctx.fillStyle = '#f4f1ea'; ctx.fillRect(0, 0, 256, 170);
    ctx.strokeStyle = '#3a3a3a'; ctx.lineWidth = 6; ctx.strokeRect(6, 6, 244, 158);
    ctx.fillStyle = '#2a2a2a'; ctx.textAlign = 'center';
    ctx.font = '800 46px "Helvetica Neue", Arial, sans-serif'; ctx.fillText('SILENCI', 128, 78);
    ctx.font = '500 22px "Helvetica Neue", Arial, sans-serif'; ctx.fillText('SILENCIO · SILENCE', 128, 122);
  });
}
/** Light through the glass on the floor: the panes' colours blurred, fading out towards the patch's edges. */
function poolCanvas(random: () => number, palette: string[]) {
  const panes = stainedGlass(random, palette);
  return canvas(128, 128, ctx => {
    ctx.fillStyle = '#000000'; ctx.fillRect(0, 0, 128, 128);
    ctx.filter = 'blur(4px)'; ctx.drawImage(panes, 0, 0, 72, 72, -8, -8, 144, 144); ctx.filter = 'none';
    ctx.globalCompositeOperation = 'multiply';
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, '#ffffff'); g.addColorStop(0.45, '#c8c8c8'); g.addColorStop(0.8, '#2a2a2a'); g.addColorStop(1, '#000000');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128);
    ctx.globalCompositeOperation = 'source-over';
  });
}
