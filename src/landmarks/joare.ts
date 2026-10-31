import * as pc from 'playcanvas';
import type { GeoLandmark } from '../geo';
import type { LandmarkKit } from '../landmarks';

type V3 = [number, number, number];

/**
 * The joare of Txintxarri plaza, Alegia: a giant cowbell carved in stone (Tomas Ugartemendia) lying
 * on its side on two rough rocks, its loop of a handle at one end and the clapper poking out of the
 * mouth at the other. People from Alegia are called txintxarris after the cowbells the town made.
 * About 2.8 m long; local +x runs from the handle to the mouth.
 */
export const kind = 'joare';

export function build(kit: LandmarkKit, landmark: GeoLandmark) {
  const stone = kit.surface('granit', String(landmark.params.colour ?? '#6c6963'), 0.12);
  const rock = kit.surface('harri-hezea', '#7f7e76', 0.08);
  // The bell: rings of a flattened, squarish section that widen from the crown to the mouth.
  const ring = (t: number) => {
    // Broad and flat, the crown two thirds of the mouth, as the sculpture is (a cone would read as a megaphone).
    const a = 0.62 + 0.36 * t ** 1.4, b = 0.26 + 0.1 * t, x = -1.2 + 2.3 * t, pts: V3[] = [];
    for (let k = 0; k < 20; k++) {
      const q = (k / 20) * Math.PI * 2, c = Math.cos(q), s = Math.sin(q);
      // A superellipse: rounded corners, flat sides, like the beaten iron of a real cowbell.
      const ry = a * Math.sign(c) * Math.abs(c) ** 0.6, rz = b * Math.sign(s) * Math.abs(s) ** 0.6;
      pts.push([x, ry, rz]);
    }
    return pts;
  };
  const body = kit.mesh(), mouth = kit.mesh(), rings = [0, 0.15, 0.32, 0.5, 0.68, 0.84, 1].map(ring);
  for (let r = 0; r + 1 < rings.length; r++) for (let k = 0; k < 20; k++) {
    const a = rings[r][k], b = rings[r][(k + 1) % 20], c = rings[r + 1][(k + 1) % 20], d = rings[r + 1][k];
    const mid: V3 = [0, (a[1] + c[1]) / 2, (a[2] + c[2]) / 2];
    body.quad(a, b, c, d, mid, [a[0], k * 0.3], [b[0], (k + 1) * 0.3], [c[0], (k + 1) * 0.3], [d[0], k * 0.3]);
  }
  for (let k = 0; k < 20; k++) {
    const a = rings[0][k], b = rings[0][(k + 1) % 20];
    body.tri([-1.2, 0, 0], a, b, [-1, 0, 0], [0, 0], [a[1], a[2]], [b[1], b[2]]);
    // The mouth: dark inside, a hair back from the rim.
    const m = rings[6][k], n = rings[6][(k + 1) % 20];
    mouth.tri([1.05, 0, 0], [m[0] - 0.02, m[1] * 0.92, m[2] * 0.85], [n[0] - 0.02, n[1] * 0.92, n[2] * 0.85], [1, 0, 0]);
  }
  // Lying on its side with its broad face upright, the mouth tipped up a little, raised on the rocks.
  const bell = new pc.Entity('Joare'); bell.setLocalPosition(0, 1.32, 0); bell.setLocalEulerAngles(0, 0, 6);
  kit.root.addChild(bell);
  kit.add('Joare', body, stone, { parent: bell });
  kit.add('Boca del joare', mouth, kit.mat('Boca del joare', '#26231f', 0.1), { parent: bell, shadows: false });
  // The handle: a loop of stone over the crown, and the clapper, a stone rod out of the mouth.
  // A wide loop from the top of the crown round to its foot, like the sculpture's.
  for (let k = 0; k < 13; k++) {
    const q = Math.PI * (k + 0.5) / 13;
    kit.part('Asa del joare', 'box', stone, [-1.2 - Math.sin(q) * 0.5, Math.cos(q) * 0.55, 0], [0.15, 0.2, 0.16], [0, 0, (q * 180) / Math.PI - 90], bell);
  }
  kit.part('Badajo', 'cylinder', stone, [1.45, -0.85, 0], [0.3, 1.5, 0.3], [0, 0, 92], bell);
  kit.part('Roca', 'sphere', rock, [-0.6, 0.3, 0.05], [1.1, 0.75, 0.95], [0, 25, 8]);
  kit.part('Roca', 'sphere', rock, [0.45, 0.28, -0.05], [1.3, 0.7, 1.1], [0, -15, -6]);
}
