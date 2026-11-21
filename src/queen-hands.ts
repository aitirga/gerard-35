import * as pc from 'playcanvas';
import { CREATURES, buildCreature } from './character-model';

/** How many times bigger than its file her arm comes down: far too big for the frame. */
const ARM_SCALE = 3.3;

/**
 * La Reina Bubbaloo's arms (docs/lore.md): she is far too big to fit on screen, so all we ever see
 * are two huge arms in her gloves of stretched gum, coming down from above the frame. The arm is her
 * own figure from `just character-3d reina-brazo` (tools/figures.toml), made standing on its cut end
 * with the palm forward; here it hangs upside down, each palm turned to the boys.
 * `pose(reach, grip)`: reach 0 = out of sight above, 1 = down around the target; grip 0 = open,
 * 1 = closed round whoever is there (the arms lean in and the hands meet over them).
 */
export function createQueenHands(app: pc.Application) {
  const spec = CREATURES['./creatures/reina-brazo.json'];
  if (!spec) throw new Error('No figure for the Queen\'s arm yet: just character-3d reina-brazo.');
  const length = spec.height * ARM_SCALE;
  const root = new pc.Entity('Brazos de La Reina Bubbaloo'); app.root.addChild(root);
  const hands = [-1, 1].map(side => {
    // The shoulder end, high above; the arm hangs from it with the fingers down.
    const shoulder = new pc.Entity(side < 0 ? 'Brazo izquierdo' : 'Brazo derecho'); root.addChild(shoulder);
    const arm = buildCreature(spec, shoulder);
    arm.enabled = true;
    arm.setLocalScale(ARM_SCALE, ARM_SCALE, ARM_SCALE);
    // Upside down, palm (the file's front) towards the middle and a little towards the camera, so the fingers read from above.
    arm.setLocalEulerAngles(0, -side * 60, 180);
    return { side, shoulder };
  });
  let time = 0;
  const target = new pc.Vec3();
  return {
    /** Where the hands close (between Gerard and Bernat), in world space. */
    aim(at: pc.Vec3) { target.copy(at); },
    pose(reach: number, grip: number, animate = true) {
      root.enabled = reach > 0;
      for (const h of hands) {
        const spread = 3.4 - grip * 1.9;
        // A slow, hungry sway while open; still once they hold.
        const sway = animate ? Math.sin(time * 2.1 + h.side) * .1 * (1 - grip) : 0;
        // The fingertips reach down to just over the floor round them.
        h.shoulder.setPosition(target.x + h.side * spread, target.y + length - .3 + (1 - reach) * (length + 4) + sway, target.z - .2);
        // Leaning in from above, more as the grip closes.
        h.shoulder.setLocalEulerAngles(0, 0, -h.side * (6 + grip * 16) + sway * 20);
      }
    },
    update(dt: number) { time += dt; },
    destroy() { root.destroy(); },
  };
}
export type QueenHands = ReturnType<typeof createQueenHands>;
