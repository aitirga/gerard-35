import * as pc from 'playcanvas';
import { separateFlushFaces } from './flush-faces';

/**
 * A character built from primitives, stored as JSON in src/characters/.
 * `just character <id>` writes these files; the format is documented in tools/README.md.
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
  materials: Record<string, { name: string; color: string; gloss?: number }>;
  /** Pivots on the +x side; arms and legs are mirrored to −x. */
  rig: { head: Vec3; headScale: Vec3; arm: Vec3; leg: Vec3 };
  parts: CharacterPart[];
}

/** Names the animations look up; keep them in sync with battle-scene.ts. */
export const RIG = { body: 'Cuerpo', head: 'Pivote de cabeza', arm: 'Brazo', leg: 'Pierna', eye: 'Ojo', foot: 'Zapatilla' };

const RING_SEGMENTS = 16;

export function buildCharacter(spec: CharacterSpec, parent: pc.Entity) {
  const materials = new Map(Object.entries(spec.materials).map(([key, m]) => {
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
  // Leg then arm per side, left first: the gait pairs limbs 0 and 3 against 1 and 2.
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
  return { body, head, limbs, feet, eyes, eyeHeights: eyes.map(eye => eye.getLocalScale().y), materials: [...materials.values()] };
}
