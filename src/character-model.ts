import * as pc from 'playcanvas';
import { separateFlushFaces } from './flush-faces';
import { ELBOW_REST } from './walk-animation';

/**
 * A character, stored as JSON in src/characters/: built from primitives (`just character <id>`) or,
 * with `glb`, a rigged model made from photos (`just character-3d <id>`). tools/README.md has the format.
 */
export type Vec3 = [number, number, number];
export type CharacterShape = 'box' | 'sphere' | 'cylinder' | 'cone' | 'ring';
/** body: the trunk; head: relative to the neck pivot; arm/leg: relative to shoulder/hip, built on both sides. */
export type CharacterAttach = 'body' | 'head' | 'arm' | 'leg';

export interface CharacterPart {
  name: string;
  shape: CharacterShape;
  material: string;
  attach: CharacterAttach;
  position: Vec3;
  /** Full size; for a ring: x/y radii and depth. */
  scale: Vec3;
  /** Euler degrees (ignored by rings, which face +z). */
  rotation?: Vec3;
  /** Body/head parts: also place a copy at −x. */
  mirror?: boolean;
  /** Ring line width. */
  thickness?: number;
}

export interface CharacterSpec {
  id: string;
  name: string;
  /** The model's file under public/, loaded by `loadCharacterModels`. It replaces `parts`, which then only stand for its body in tests. */
  glb?: string;
  /** On a `glb` character `color` is what the texture averages to, so an ánima can dye it (classes.ts). */
  materials: Record<string, { name: string; color: string; gloss?: number }>;
  /** Pivots on the +x side; arms and legs are mirrored to −x. `elbow` and `knee`, if any, are relative to the shoulder and the hip. */
  rig: { head: Vec3; headScale: Vec3; arm: Vec3; leg: Vec3; elbow?: Vec3; knee?: Vec3 };
  /** A model from a file: its eyelids (src/face.ts), of the skin round its eyes and with the size to cover them. */
  lids?: { color: string; size: Vec3 };
  /** Where on this body an ánima's pieces sit (anima-looks.ts), if not where the primitive cast has them. */
  fit?: Partial<Record<keyof typeof BODY_FIT, Vec3>>;
  /**
   * A model from a file wearing a school backpack (Gerard and Bernat at ten): its colours. It is built
   * of rounded blocks on the model's back, sized by its `Torso`, and its pieces carry the names
   * game.ts shows once the backpack is picked up (`BACKPACK_PARTS`).
   */
  backpack?: { bag: string; straps: string };
  parts: CharacterPart[];
}

/** Points on the body that ánimas dress, where the cast of primitives has them. */
export const BODY_FIT = {
  /** Base of the neck; its z is the collar's half depth, its x its half width. */
  collar: [.2, .93, .1675] as Vec3,
  /** The front of the chest, at the height of the middle of the shirt. */
  chest: [0, .66, .152] as Vec3,
  /** The small of the back. */
  back: [0, .44, -.165] as Vec3,
};
/** Empty nodes carrying a character's `fit`, so a battle copy keeps it. */
const FIT_NODE = 'Ajuste de ánima: ';
/** A point of `body`'s fit, or the cast's. */
export function bodyFit(body: pc.Entity, point: keyof typeof BODY_FIT) {
  const node = body.findByName(FIT_NODE + point) as pc.Entity | null;
  if (!node) return BODY_FIT[point];
  const p = node.getLocalPosition();
  return [p.x, p.y, p.z] as Vec3;
}

/**
 * Names the animations look up; keep them in sync with battle-scene.ts. In a model from a file these
 * are nodes too (tools/character_rig.py), with two more: `ankle`, the joint its foot turns on, and
 * `mount`, scaled so that what is placed in it for the cast's head fits this one (anima-looks.ts).
 */
export const RIG = { body: 'Cuerpo', head: 'Pivote de cabeza', arm: 'Brazo', leg: 'Pierna', eye: 'Ojo', foot: 'Zapatilla', ankle: 'Tobillo', mount: 'Soporte de cabeza', lid: 'Párpado', lash: 'Pestañas' };

const RING_SEGMENTS = 16;
const LASH_COLOUR = '#2c2019';

/** A creature from `just character-3d`: a foe in one piece (`buildCreature`). */
export interface CreatureSpec { id: string; name: string; glb: string; height: number }
/** Every creature with a file, by its path. */
export const CREATURES = import.meta.glob<CreatureSpec>('./creatures/*.json', { eager: true, import: 'default' });

/** What each file holds, ready to copy from. */
const models = new Map<string, pc.ContainerResource>();

/** Loads the files of `specs`: whoever builds them needs them at hand. */
export function loadCharacterModels(app: pc.AppBase, specs: { id: string; glb?: string }[]) {
  return Promise.all(specs.filter(spec => spec.glb).map(spec => new Promise<void>((resolve, reject) => {
    app.assets.loadFromUrl(`${import.meta.env.BASE_URL}${spec.glb}`, 'container', (error, asset) => {
      if (error || !asset) { reject(new Error(`Could not load ${spec.glb}: ${error}`)); return; }
      models.set(spec.id, asset.resource as pc.ContainerResource);
      resolve();
    });
  })));
}

/**
 * What each material is for, by its name: its key in the spec (jacket, navy, cream, trousers…),
 * the same in every character. Ánimas recolour clothes by it (classes.ts `wearClass`).
 */
export const MATERIAL_ROLES = new Map<string, string>();
/** What a textured material averages to, by its name: dyeing it tints its texture by the difference. */
export const TEXTURE_COLOURS = new Map<string, pc.Color>();

export interface CharacterModel {
  body: pc.Entity;
  head: pc.Entity;
  /** Leg then arm per side, left first: the gait pairs limbs 0 and 3 against 1 and 2. */
  limbs: pc.Entity[];
  /** Knee or elbow of each limb, where it has them. */
  joints: (pc.Entity | null)[];
  /** The shoes' boxes, which ground contact plants. */
  feet: pc.Entity[];
  /** The ankles, where the foot is a joint of its own rather than its box. */
  ankles: pc.Entity[];
  eyes: pc.Entity[];
  /** Materials only this model uses: whoever rebuilds it destroys them. */
  materials: pc.StandardMaterial[];
}

/** A copy of a character's file, in the scene. The file's materials stay shared: a fight copies them for its own. */
function buildFromFile(spec: CharacterSpec, parent: pc.Entity): CharacterModel {
  const file = models.get(spec.id);
  if (!file) throw new Error(`${spec.id}'s model is not loaded (loadCharacterModels).`);
  for (const [key, m] of Object.entries(spec.materials)) {
    MATERIAL_ROLES.set(m.name, key);
    TEXTURE_COLOURS.set(m.name, new pc.Color().fromString(m.color));
  }
  // The file's one root is the body, and its bones are looked up from there: a copy of the model finds its own.
  const body = file.instantiateRenderEntity({ castShadows: true, receiveShadows: true }) as pc.Entity;
  parent.addChild(body);
  // The parser numbers siblings of the same name (Brazo, Brazo1); the game looks for them by name.
  for (const node of body.find(node => /\d$/.test(node.name))) node.name = node.name.replace(/\d+$/, '');
  for (const [point, [x, y, z]] of Object.entries(spec.fit ?? {})) {
    const node = new pc.Entity(FIT_NODE + point); node.setLocalPosition(x, y, z); body.addChild(node);
  }
  // Painted eyes close under a lid of the skin round them; shut, a dark line shows where they were.
  const eyes = body.find(node => node.name === RIG.eye) as pc.Entity[];
  const materials: pc.StandardMaterial[] = [];
  if (spec.lids) {
    const flat = (name: string, colour: string) => {
      const material = new pc.StandardMaterial(); material.name = name; material.diffuse.fromString(colour); material.gloss = .18; material.update();
      materials.push(material); return material;
    };
    const skin = flat(`Párpado de ${spec.name}`, spec.lids.color), line = flat(`Pestañas de ${spec.name}`, LASH_COLOUR);
    MATERIAL_ROLES.set(skin.name, 'lid');
    const [w, h, d] = spec.lids.size;
    for (const eye of eyes) {
      const lid = new pc.Entity(RIG.lid);
      lid.addComponent('render', { type: 'sphere', material: skin, castShadows: false, receiveShadows: true });
      lid.setLocalScale(w, h, d); lid.enabled = false; eye.addChild(lid);
      const lash = new pc.Entity(RIG.lash);
      lash.addComponent('render', { type: 'box', material: line, castShadows: false, receiveShadows: false });
      lash.setLocalPosition(0, -h * .1, d * .5); lash.setLocalScale(w * .8, Math.max(h * .09, .005), .004); lash.enabled = false; eye.addChild(lash);
    }
  }
  if (spec.backpack) materials.push(...wearBackpack(body, spec, spec.backpack));
  const limbs = body.children.filter(node => node.name === RIG.leg || node.name === RIG.arm) as pc.Entity[];
  const joints = limbs.map((limb, i) => limb.findByName(i % 2 ? 'Antebrazo' : 'Espinilla') as pc.Entity);
  joints[1].setLocalEulerAngles(ELBOW_REST, 0, 0); joints[3].setLocalEulerAngles(ELBOW_REST, 0, 0);
  return {
    body, limbs, joints,
    head: body.findByName(RIG.head) as pc.Entity,
    feet: [limbs[0], limbs[2]].map(leg => leg.findByName(RIG.foot) as pc.Entity),
    ankles: [limbs[0], limbs[2]].map(leg => leg.findByName(RIG.ankle) as pc.Entity),
    eyes, materials,
  };
}

/**
 * A school backpack on a model from a file: a bag with a rounded top and a front pocket on its back,
 * and two straps over the shoulders down to their buckles, all measured from the `Torso` box (its
 * back is the box's −z face, the shoulders its top). Matte flat colours, like the figure's plastic.
 * Returns its materials, for whoever rebuilds the model to destroy.
 */
function wearBackpack(body: pc.Entity, spec: CharacterSpec, colours: { bag: string; straps: string }) {
  const torso = spec.parts.find(part => part.name === 'Torso');
  if (!torso) return [];
  const flat = (name: string, colour: string) => {
    const material = new pc.StandardMaterial(); material.name = name; material.diffuse.fromString(colour); material.gloss = .2; material.update();
    MATERIAL_ROLES.set(name, 'bag'); return material;
  };
  const bag = flat(`Mochila de ${spec.name}`, colours.bag), straps = flat(`Correas de mochila de ${spec.name}`, colours.straps);
  const [px, py, pz] = torso.position, [sx, sy, sz] = torso.scale;
  // The blocks were drawn for the cast's 0.45 m trunk: they grow with this one's.
  const k = sy / .45, back = pz - sz / 2, top = py + sy / 2, strapX = sx * .3;
  const w = sx * .8, h = sy * .74, d = .17 * k, y = top - .07 * k - h / 2, z = back - d / 2 + .025 * k;
  const add = (name: string, shape: 'box' | 'cylinder', material: pc.StandardMaterial, [x, py2, z2]: Vec3, scale: Vec3, rotation: Vec3 = [0, 0, 0]) => {
    const node = new pc.Entity(name);
    node.addComponent('render', { type: shape, material, castShadows: true, receiveShadows: true });
    node.setLocalPosition(px + x, py2, z2); node.setLocalScale(...scale); node.setLocalEulerAngles(...rotation);
    body.addChild(node);
  };
  add('Mochila', 'box', bag, [0, y - d * .15, z], [w, h - d * .3, d]);
  // The top is a half-round lid across the bag, so it reads soft like the figure, not as a crate.
  add('Mochila', 'cylinder', bag, [0, y + h / 2 - d * .45, z], [d, w, d], [0, 0, 90]);
  add('Bolsillo de mochila', 'box', straps, [0, y - h * .18, z - d / 2 - .025 * k], [w * .72, h * .4, .05 * k]);
  for (const side of [-1, 1]) {
    add('Correa de hombro', 'box', bag, [side * strapX, top + .012 * k, pz - .01 * k], [.06 * k, .035 * k, sz * 1.04]);
    add('Correa frontal', 'box', straps, [side * strapX, top - sy * .36, pz + sz / 2 + .008 * k], [.052 * k, sy * .72, .028 * k]);
    add('Hebilla de mochila', 'box', straps, [side * strapX, top - sy * .62, pz + sz / 2 + .02 * k], [.064 * k, .045 * k, .018 * k]);
  }
  return [bag, straps];
}

/**
 * A copy of a creature's file under `parent`, hidden: a template for a fight to clone, with the part
 * names of the minion and Uri's fears (src/fears.ts), so it moves like them.
 */
export function buildCreature(spec: CreatureSpec, parent: pc.Entity) {
  const file = models.get(spec.id);
  if (!file) throw new Error(`${spec.id}'s model is not loaded (loadCharacterModels).`);
  const root = file.instantiateRenderEntity({ castShadows: true, receiveShadows: true }) as pc.Entity;
  root.enabled = false;
  parent.addChild(root);
  return root;
}

/** Shows or hides the shoes: a primitive shoe is its node, a skinned one folds into its ankle. */
export function showFeet(model: CharacterModel, shown: boolean) {
  for (const foot of model.feet) foot.enabled = shown;
  const size = shown ? 1 : .001;
  for (const ankle of model.ankles) ankle.setLocalScale(size, size, size);
}

export function buildCharacter(spec: CharacterSpec, parent: pc.Entity): CharacterModel {
  if (spec.glb) return buildFromFile(spec, parent);
  const materials = new Map(Object.entries(spec.materials).map(([key, m]) => {
    MATERIAL_ROLES.set(m.name, key);
    const mat = new pc.StandardMaterial(); mat.name = m.name; mat.diffuse.fromString(m.color); mat.gloss = (m.gloss ?? 20) / 100;
    mat.update(); return [key, mat] as const;
  }));
  function entity(name: string, holder: pc.Entity, [x, y, z]: Vec3) {
    const node = new pc.Entity(name); node.setLocalPosition(x, y, z); holder.addChild(node); return node;
  }
  function mesh(name: string, shape: pc.RenderComponent['type'], mat: pc.StandardMaterial, holder: pc.Entity, pos: Vec3, [sx, sy, sz]: Vec3, [rx, ry, rz]: Vec3) {
    const node = entity(name, holder, pos);
    node.addComponent('render', { type: shape, material: mat, castShadows: true, receiveShadows: true });
    node.setLocalScale(sx, sy, sz); node.setLocalEulerAngles(rx, ry, rz);
  }

  const body = entity(RIG.body, parent, [0, 0, 0]);
  const head = entity(RIG.head, body, spec.rig.head);
  head.setLocalScale(...spec.rig.headScale);
  const limbs = [-1, 1].flatMap(side => (['leg', 'arm'] as const).map(kind => {
    const [x, y, z] = spec.rig[kind];
    return entity(RIG[kind], body, [x * side, y, z]);
  }));
  const holder = (attach: CharacterAttach, side: number) =>
    attach === 'body' ? body : attach === 'head' ? head : limbs[(side < 0 ? 0 : 2) + (attach === 'arm' ? 1 : 0)];

  for (const part of spec.parts) {
    const mat = materials.get(part.material)!;
    const limb = part.attach === 'arm' || part.attach === 'leg';
    for (const side of limb || part.mirror ? [-1, 1] : [1]) {
      const [x, y, z] = part.position;
      const target = holder(part.attach, side);
      if (part.shape === 'ring') {
        // Segmented outline with an open centre, e.g. glasses rims.
        const [rx, ry, depth] = part.scale;
        for (let i = 0; i < RING_SEGMENTS; i++) {
          const a = i * Math.PI * 2 / RING_SEGMENTS, b = (i + 1) * Math.PI * 2 / RING_SEGMENTS;
          const x1 = x * side + Math.cos(a) * rx, y1 = y + Math.sin(a) * ry;
          const x2 = x * side + Math.cos(b) * rx, y2 = y + Math.sin(b) * ry;
          mesh(part.name, 'box', mat, target, [(x1 + x2) / 2, (y1 + y2) / 2, z],
            [Math.hypot(x2 - x1, y2 - y1) + .003, part.thickness ?? .012, depth], [0, 0, Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI]);
        }
        continue;
      }
      const [ex, ey, ez] = part.rotation ?? [0, 0, 0];
      mesh(part.name, part.shape, mat, target, [x * side, y, z], part.scale, [ex, ey * side, ez * side]);
    }
  }
  // Rebuilt into a model already in the scene (Gerard growing up), so it settles its own faces.
  separateFlushFaces(body);
  const eyes = body.find(node => node.name === RIG.eye) as pc.Entity[];
  const feet = [limbs[0], limbs[2]].map(leg => leg.findByName(RIG.foot) as pc.Entity);
  return { body, head, limbs, joints: limbs.map(() => null), feet, ankles: [], eyes, materials: [...materials.values()] };
}
