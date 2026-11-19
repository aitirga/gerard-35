import * as pc from 'playcanvas';

/**
 * Dadaísta's dice (docs/animas/dadaista/): its maná, as things. A clean ivory cube with black pips,
 * the one in red, a touch bigger than life so its face reads from the fight's camera. One mesh and
 * one material for every die (its six faces are cells of one small picture), so a hand of five is
 * five draws. The caller places each die and turns it; `faceUp` is the turn that shows a face on top.
 */
export const DIE = {
  /** Its edge in metres, × its wearer's height scale. */
  size: .21,
  ivory: '#efe6cf', pip: '#1c1917', one: '#d9422b',
} as const;
/** The Joker (`JOKER` in src/battle.ts): the same cube in black lacquer, a vermilion star on every face. */
const JOKER_FACE = 7;
/** Where the pips sit on each face, in thirds of it. */
const PIPS: Record<number, [number, number][]> = {
  1: [[0, 0]], 2: [[-1, -1], [1, 1]], 3: [[-1, -1], [0, 0], [1, 1]], 4: [[-1, -1], [1, -1], [-1, 1], [1, 1]],
  5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]], 6: [[-1, -1], [-1, 0], [-1, 1], [1, -1], [1, 0], [1, 1]],
};
/**
 * The cube's faces as a real die has them (opposite faces add up to seven): each one's normal and
 * the two edges that span it. One on top (+Y), six below, two at the front (+Z), five behind, three
 * on the right (+X), four on the left: the campsite's Dado, small.
 */
const FACES: { n: number; normal: number[]; u: number[]; v: number[] }[] = [
  { n: 1, normal: [0, 1, 0], u: [1, 0, 0], v: [0, 0, -1] },
  { n: 6, normal: [0, -1, 0], u: [1, 0, 0], v: [0, 0, 1] },
  { n: 2, normal: [0, 0, 1], u: [1, 0, 0], v: [0, 1, 0] },
  { n: 5, normal: [0, 0, -1], u: [-1, 0, 0], v: [0, 1, 0] },
  { n: 3, normal: [1, 0, 0], u: [0, 0, -1], v: [0, 1, 0] },
  { n: 4, normal: [-1, 0, 0], u: [0, 0, 1], v: [0, 1, 0] },
];
/** The turn that brings each face to the top (x, y, z degrees): one is already there. */
const FACE_UP: Record<number, [number, number, number]> = { 1: [0, 0, 0], 6: [180, 0, 0], 2: [-90, 0, 0], 5: [90, 0, 0], 3: [0, 0, 90], 4: [0, 0, -90] };
const turns = new Map<number, pc.Quat>();
/** The turn that shows `face` on top. */
export function faceUp(face: number) {
  let q = turns.get(face);
  if (!q) { q = new pc.Quat().setFromEulerAngles(...(FACE_UP[face] ?? FACE_UP[1])); turns.set(face, q); }
  return q;
}

/** A four-pointed star round (x, y), `r` to its points. */
function star(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath();
  for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4 - Math.PI / 2, d = i % 2 ? r * .34 : r; ctx.lineTo(x + Math.cos(a) * d, y + Math.sin(a) * d); }
  ctx.closePath(); ctx.fill();
}
/** The Joker's six faces, all the same: black lacquer, a lighter rim, the star. */
function jokerPicture() {
  const cell = 128, canvas = document.createElement('canvas');
  canvas.width = cell * 6; canvas.height = cell;
  const ctx = canvas.getContext('2d')!;
  for (let n = 0; n < 6; n++) {
    const x = n * cell;
    ctx.fillStyle = DIE.pip; ctx.fillRect(x, 0, cell, cell);
    const rim = ctx.createRadialGradient(x + cell / 2, cell / 2, cell * .4, x + cell / 2, cell / 2, cell * .76);
    rim.addColorStop(0, 'rgba(239,230,207,0)'); rim.addColorStop(1, 'rgba(239,230,207,.42)');
    ctx.fillStyle = rim; ctx.fillRect(x, 0, cell, cell);
    ctx.fillStyle = DIE.one; star(ctx, x + cell / 2, cell / 2, cell * .36);
    ctx.fillStyle = 'rgba(255,255,255,.25)'; star(ctx, x + cell / 2 - cell * .03, cell / 2 - cell * .03, cell * .12);
  }
  return canvas;
}
/** The six faces side by side in one picture: ivory, a soft shade towards the edges, the pips. */
function picture() {
  const cell = 128, canvas = document.createElement('canvas');
  canvas.width = cell * 6; canvas.height = cell;
  const ctx = canvas.getContext('2d')!;
  for (let n = 1; n <= 6; n++) {
    const x = (n - 1) * cell;
    ctx.fillStyle = DIE.ivory; ctx.fillRect(x, 0, cell, cell);
    // A worn edge: darker towards the rim, so the cube reads as rounded.
    const shade = ctx.createRadialGradient(x + cell / 2, cell / 2, cell * .36, x + cell / 2, cell / 2, cell * .76);
    shade.addColorStop(0, 'rgba(120,96,60,0)'); shade.addColorStop(1, 'rgba(120,96,60,.5)');
    ctx.fillStyle = shade; ctx.fillRect(x, 0, cell, cell);
    for (const [u, v] of PIPS[n]) {
      const px = x + cell / 2 + u * cell * .26, py = cell / 2 + v * cell * .26, r = n === 1 ? cell * .17 : cell * .105;
      ctx.fillStyle = n === 1 ? DIE.one : DIE.pip;
      ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.fill();
      // A glint on each pip: it is a little hollow of lacquer.
      ctx.fillStyle = 'rgba(255,255,255,.22)';
      ctx.beginPath(); ctx.arc(px - r * .3, py - r * .3, r * .28, 0, Math.PI * 2); ctx.fill();
    }
  }
  return canvas;
}

interface Kit { mesh: pc.Mesh; material: pc.StandardMaterial; joker: pc.StandardMaterial }
const kits = new WeakMap<pc.GraphicsDevice, Kit>();
function kitFor(device: pc.GraphicsDevice): Kit {
  let kit = kits.get(device);
  if (kit) return kit;
  const positions: number[] = [], normals: number[] = [], uvs: number[] = [], indices: number[] = [];
  FACES.forEach((face, i) => {
    // Each face is its own cell, a sixth of the picture wide, a hair inside it so no neighbour bleeds in.
    const u0 = (face.n - 1) / 6 + .004, u1 = face.n / 6 - .004;
    for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      positions.push(...[0, 1, 2].map(k => (face.normal[k] + face.u[k] * a + face.v[k] * b) / 2));
      normals.push(...face.normal);
      uvs.push(a < 0 ? u0 : u1, b < 0 ? .01 : .99);
    }
    indices.push(i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3);
  });
  const mesh = new pc.Mesh(device);
  mesh.setPositions(positions); mesh.setNormals(normals); mesh.setUvs(0, uvs); mesh.setIndices(indices);
  mesh.update();
  const paint = (name: string, canvas: HTMLCanvasElement, glow: [number, number, number]) => {
    const texture = new pc.Texture(device, { name, width: canvas.width, height: canvas.height, mipmaps: true, anisotropy: 4, addressU: pc.ADDRESS_CLAMP_TO_EDGE, addressV: pc.ADDRESS_CLAMP_TO_EDGE });
    texture.setSource(canvas);
    const material = new pc.StandardMaterial(); material.name = name;
    material.diffuseMap = texture; material.gloss = .6;
    // A little light of its own, so the faces read in any place (the campsite's dusk, the Queen's pink evening).
    material.emissive.set(...glow); material.emissiveMap = texture;
    material.update();
    return material;
  };
  // The Joker's star glows a little more than a pip: it is the one die to spot at a glance.
  kit = { mesh, material: paint('Dado', picture(), [.2, .19, .17]), joker: paint('Dado Joker', jokerPicture(), [.55, .5, .45]) };
  kits.set(device, kit);
  return kit;
}

/** A die, one unit to its edge: the caller scales it (`DIE.size`), places it and turns it. */
export function createDie(app: pc.AppBase) {
  const { mesh, material } = kitFor(app.graphicsDevice);
  const entity = new pc.Entity('Dado de Dadaísta');
  entity.addComponent('render', { meshInstances: [new pc.MeshInstance(mesh, material)], castShadows: true, receiveShadows: false });
  return entity;
}
/** Dresses a die for the face it shows: the Joker's black lacquer, or ivory for any other. */
export function dressDie(app: pc.AppBase, entity: pc.Entity, face: number) {
  const kit = kitFor(app.graphicsDevice), want = face === JOKER_FACE ? kit.joker : kit.material, instance = entity.render!.meshInstances[0];
  if (instance.material !== want) instance.material = want;
}
