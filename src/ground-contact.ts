import * as pc from 'playcanvas';

export type GroundHeight = (x: number, z: number) => number;

/** Plant the lowest shoe/paw corner, accounting for the complete animated pose. */
export function createGroundContact(root: pc.Entity, feet: pc.Entity[]) {
  const corner = new pc.Vec3();
  const world = new pc.Vec3();
  return (height: GroundHeight, airborne = 0) => {
    let correction = -Infinity;
    for (const foot of feet) {
      const transform = foot.getWorldTransform();
      for (const x of [-.5, .5]) for (const y of [-.5, .5]) for (const z of [-.5, .5]) {
        transform.transformPoint(corner.set(x, y, z), world);
        correction = Math.max(correction, height(world.x, world.z) - world.y);
      }
    }
    if (Number.isFinite(correction)) {
      const position = root.getPosition();
      root.setPosition(position.x, position.y + correction + airborne + .002, position.z);
    }
  };
}
