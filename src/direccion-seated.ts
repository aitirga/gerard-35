import * as pc from 'playcanvas';

/** Pose a private copy of a directiva before putting it on its office chair. All three rigs
 * face +Z but their joint axes and proportions differ. Use the child joint as the limb tip. */
export function seatDirectiva(body: pc.Entity) {
  function aim(joint: pc.GraphNode, tip: pc.GraphNode, x: number, y: number, z: number) {
    const from = tip.getPosition().clone().sub(joint.getPosition()).normalize();
    const turn = new pc.Quat().setFromDirections(from, new pc.Vec3(x, y, z).normalize());
    joint.setRotation(turn.mul(joint.getRotation()));
  }
  const hips = body.findByName('LeftUpLeg');
  if (!hips) return 0;
  const height = hips.getPosition().y;
  for (const side of ['Left', 'Right']) {
    const thigh = body.findByName(side + 'UpLeg'), shin = body.findByName(side + 'Leg'), foot = body.findByName(side + 'Foot');
    const arm = body.findByName(side + 'Arm'), elbow = body.findByName(side + 'ForeArm'), hand = body.findByName(side + 'Hand');
    const outward = side === 'Left' ? 1 : -1;
    if (thigh && shin && foot) {
      const sole = foot.getRotation().clone();
      aim(thigh, shin, outward * .12, -.12, 1);
      aim(shin, foot, 0, -1, -.04);
      foot.setRotation(sole);
    }
    if (arm && elbow && hand) {
      aim(arm, elbow, outward * .18, -.94, .28);
      aim(elbow, hand, -outward * .38, .08, 1);
    }
  }
  return .58 - height;
}
