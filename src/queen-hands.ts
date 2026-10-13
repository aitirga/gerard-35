import * as pc from 'playcanvas';
import { palaceKit } from './palace';

/**
 * La Reina Bubbaloo's hands (docs/lore.md): she is far too big to fit on screen, so all we ever
 * see are two huge hands and forearms of pink gelatine, coming down from above the frame.
 * `pose(reach, grip)`: reach 0 = out of sight above, 1 = down around the target; grip 0 = open,
 * 1 = closed round whoever is there.
 */
export function createQueenHands(app: pc.Application) {
  const kit = palaceKit(app);
  const { mat, part } = kit;
  const jelly = mat('#ff6fae', .97, .3, .74), jellyDeep = mat('#e0488a', .95, .22, .8);
  const arm = mat('#e0488a', .97, .2, .55), cuffTrim = mat('#fbeef3', .7, .05, .85);
  const ring = mat('#9a5cd6', .95, .4), drip = mat('#ff6fae', .97, .25, .8);
  const root = new pc.Entity('Manos de la Reina Bubbaloo'); app.root.addChild(root);
  const hands = [-1, 1].map(side => {
    // Each hand hangs from a wrist pivot; the palm faces down and the fingers point inwards.
    const wrist = new pc.Entity(side < 0 ? 'Mano izquierda' : 'Mano derecha'); root.addChild(wrist);
    // Her forearm, gelatine too, rising out of the frame: she is far too big to fit on screen.
    part(wrist, 'Antebrazo de gelatina', 'cylinder', arm, [0, 6.5, 0], [1.7, 12, 1.5], [0, 0, 0], false);
    part(wrist, 'Pulsera de envoltorio', 'cylinder', cuffTrim, [0, .75, 0], [1.85, .3, 1.65], [0, 0, 0], false);
    part(wrist, 'Muñeca', 'cylinder', jelly, [0, .2, 0], [1.6, .8, 1.4]);
    part(wrist, 'Palma', 'sphere', jelly, [-side * .3, -.35, 0], [2.3, .9, 2.1]);
    for (let k = 0; k < 4; k++) part(wrist, 'Goterón de gelatina', 'sphere', drip, [-side * .2 + (k - 1.5) * .45, -.85, (k % 2 - .5) * .6], [.22, .7 + (k % 3) * .2, .22], [0, 0, 0], false);
    const fingers: pc.Entity[][] = [];
    for (let f = 0; f < 4; f++) {
      // Fingers spread along z, reaching inwards (-side along x) and curling down.
      let joint = new pc.Entity('Dedo'); joint.setLocalPosition(-side * 1.2, -.35, (f - 1.5) * .5); wrist.addChild(joint);
      const segments: pc.Entity[] = [joint];
      for (let k = 0; k < 3; k++) {
        const length = [.9, .75, .6][k];
        part(joint, 'Falange', 'capsule', k % 2 ? jellyDeep : jelly, [-side * length / 2, 0, 0], [.42 - k * .05, length + .2, .42 - k * .05], [0, 0, 90], false);
        if (f === 1 && k === 0) part(joint, 'Anillo de bola de chicle', 'sphere', ring, [-side * length * .4, .25, 0], [.42, .42, .42], [0, 0, 0], false);
        if (k < 2) { const next = new pc.Entity('Nudillo'); next.setLocalPosition(-side * length, 0, 0); joint.addChild(next); joint = next; segments.push(next); }
      }
      fingers.push(segments);
    }
    // The thumb comes round the near side, towards the camera.
    const thumb = new pc.Entity('Pulgar'); thumb.setLocalPosition(-side * .6, -.3, 1.05); wrist.addChild(thumb);
    part(thumb, 'Pulgar de gelatina', 'capsule', jelly, [-side * .45, 0, .2], [.48, 1.1, .48], [0, side * 30, 90], false);
    return { side, wrist, fingers, thumb };
  });
  let time = 0;
  const target = new pc.Vec3();
  return {
    /** Where the hands close (between Gerard and Bernat), in world space. */
    aim(at: pc.Vec3) { target.copy(at); },
    pose(reach: number, grip: number, animate = true) {
      root.enabled = reach > 0;
      for (const h of hands) {
        const spread = 2.6 - grip * 1.25;
        const wobble = animate ? Math.sin(time * 3 + h.side) * .12 * (1 - grip) : 0;
        h.wrist.setPosition(target.x + h.side * spread, target.y + 1.9 + (1 - reach) * 14 + wobble, target.z - .2);
        h.wrist.setLocalEulerAngles(0, 0, h.side * (8 - grip * 6));
        // Curl every knuckle down and inwards as the grip closes.
        for (const segments of h.fingers) segments.forEach((joint, k) => joint.setLocalEulerAngles(0, 0, -h.side * (15 + grip * (k === 0 ? 55 : 45))));
        h.thumb.setLocalEulerAngles(grip * 40, 0, 0);
      }
    },
    update(dt: number) { time += dt; },
    destroy() { root.destroy(); kit.materials.forEach(m => m.destroy()); kit.meshes.forEach(m => m.destroy()); },
  };
}
export type QueenHands = ReturnType<typeof createQueenHands>;
