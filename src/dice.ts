import * as pc from 'playcanvas';
import { DIE_FACES, type DieFace } from './battle';
import { FACE_ICONS, FACE_INK, faceInk } from './die-faces';

/**
 * Dadaísta's dice (docs/animas/dadaista/): its maná, as things. A clean ivory cube printed with its
 * six faces (`DIE_FACES`: two hands, scissors, an eye, brackets and a red blank, `src/die-faces.ts`),
 * a touch bigger than life so its face reads from the fight's camera. One mesh and
 * one material for every die (its six faces are cells of one small picture), so a hand of five is
 * five draws. The caller places each die and turns it; `faceUp` is the turn that shows a face on top.
 */
export const DIE = {
  /** Its edge in metres, × its wearer's height scale. */
  size: .21,
  ivory: '#efe6cf',
  /** The Comodín's black lacquer (its star is the die's red, `FACE_INK.red`). */
  lacquer: '#1c1917',
} as const;
/**
 * The cube's six cells (cell `n` prints `DIE_FACES[n - 1]`): each one's normal and the two edges that
 * span it. Cell 1 on top (+Y), 6 below, 2 at the front (+Z), 5 behind, 3 on the right (+X), 4 on the left.
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
const turns = new Map<DieFace, pc.Quat>();
/** The turn that shows `face` on top (a hand: the first of its two cells). */
export function faceUp(face: DieFace) {
  let q = turns.get(face);
  if (!q) { q = new pc.Quat().setFromEulerAngles(...(FACE_UP[DIE_FACES.indexOf(face) + 1] ?? FACE_UP[1])); turns.set(face, q); }
  return q;
}

/** The six faces side by side in one picture: ivory, a soft shade towards the edges, each ornament printed on it. */
function picture() {
  const cell = 128, canvas = document.createElement('canvas');
  canvas.width = cell * 6; canvas.height = cell;
  const ctx = canvas.getContext('2d')!;
  DIE_FACES.forEach((face, i) => {
    const x = i * cell;
    ctx.fillStyle = DIE.ivory; ctx.fillRect(x, 0, cell, cell);
    // A worn edge: darker towards the rim, so the cube reads as rounded.
    const shade = ctx.createRadialGradient(x + cell / 2, cell / 2, cell * .36, x + cell / 2, cell / 2, cell * .76);
    shade.addColorStop(0, 'rgba(120,96,60,0)'); shade.addColorStop(1, 'rgba(120,96,60,.5)');
    ctx.fillStyle = shade; ctx.fillRect(x, 0, cell, cell);
    // The ornament, inset a little from the edge, in its ink.
    const inset = cell * .14, k = (cell - inset * 2) / 100;
    ctx.save(); ctx.translate(x + inset, inset); ctx.scale(k, k);
    ctx.fillStyle = faceInk(face); ctx.fill(new Path2D(FACE_ICONS[face]));
    ctx.restore();
  });
  return canvas;
}

/** The Comodín's six faces, all the same: black lacquer, a lighter rim, its red star with a glint. */
function comodinPicture() {
  const cell = 128, canvas = document.createElement('canvas');
  canvas.width = cell * 6; canvas.height = cell;
  const ctx = canvas.getContext('2d')!, star = new Path2D(FACE_ICONS.comodin);
  for (let n = 0; n < 6; n++) {
    const x = n * cell;
    ctx.fillStyle = DIE.lacquer; ctx.fillRect(x, 0, cell, cell);
    const rim = ctx.createRadialGradient(x + cell / 2, cell / 2, cell * .4, x + cell / 2, cell / 2, cell * .76);
    rim.addColorStop(0, 'rgba(239,230,207,0)'); rim.addColorStop(1, 'rgba(239,230,207,.42)');
    ctx.fillStyle = rim; ctx.fillRect(x, 0, cell, cell);
    const inset = cell * .12, k = (cell - inset * 2) / 100;
    ctx.save(); ctx.translate(x + inset, inset); ctx.scale(k, k);
    ctx.fillStyle = FACE_INK.red; ctx.fill(star);
    ctx.translate(47, 47); ctx.scale(.3, .3); ctx.translate(-50, -50); ctx.fillStyle = 'rgba(255,255,255,.3)'; ctx.fill(star);
    ctx.restore();
  }
  return canvas;
}

interface Kit { mesh: pc.Mesh; material: pc.StandardMaterial; comodin: pc.StandardMaterial }
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
  // Every die shares this mesh, and a mesh instance destroyed with its die destroys the mesh once
  // none holds it: the kit holds it too, so a hand gone empty never leaves the next die without one.
  mesh.incRefCount();
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
  // The Comodín's star glows a little more than an ornament: it is the one die to spot at a glance.
  kit = { mesh, material: paint('Dado', picture(), [.2, .19, .17]), comodin: paint('Dado Comodín', comodinPicture(), [.55, .5, .45]) };
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
/** Dresses a die for the face it shows: the Comodín's black lacquer, or ivory for any other. */
export function dressDie(app: pc.AppBase, entity: pc.Entity, face: DieFace) {
  const kit = kitFor(app.graphicsDevice), want = face === 'comodin' ? kit.comodin : kit.material, instance = entity.render!.meshInstances[0];
  if (instance.material !== want) instance.material = want;
}
