import * as pc from 'playcanvas';
import type { GeoLandmark } from '../geo';
import type { LandmarkKit } from '../landmarks';
import type { MeshBuilder } from '../geo-scenery';

type V3 = [number, number, number];

/**
 * The joare of Txintxarri plaza, Alegia: a giant cowbell carved in stone (Tomas Ugartemendia) lying
 * on its side on two rough rocks, its loop of a handle at one end and the clapper poking out of the
 * mouth at the other. People from Alegia are called txintxarris after the cowbells the town made.
 * About 2.8 m long; local +x runs from the handle to the mouth, the broad faces look along ±z.
 */
export const kind = 'joare';

const N = 24;
const hash = (n: number) => { const h = Math.sin(n * 12.9898) * 43758.5453; return h - Math.floor(h); };

export function build(kit: LandmarkKit, landmark: GeoLandmark) {
  const stone = kit.surface('granit', String(landmark.params.colour ?? '#625d56'), 0.12);
  const rock = kit.surface('harri-hezea', '#77766d', 0.06);
  // The bell: rings of a flattened, boxy section (beaten iron, carved in stone), a little wider at the
  // mouth than at the crown, whose shoulders round over into a flat top: a slab more than a cone,
  // which from above would read as a megaphone.
  const ring = (x: number, a: number, b: number) => Array.from({ length: N }, (_, k): V3 => {
    const q = (k / N) * Math.PI * 2, c = Math.cos(q), s = Math.sin(q);
    return [x, a * Math.sign(c) * Math.abs(c) ** 0.35, b * Math.sign(s) * Math.abs(s) ** 0.45];
  });
  const profile: [number, number, number][] = [[-1.32, 0.5, 0.12], [-1.26, 0.7, 0.19], [-1.15, 0.8, 0.23], [-0.6, 0.86, 0.25], [0.1, 0.92, 0.27], [0.75, 0.98, 0.29], [1.1, 1.02, 0.3]];
  const rings = profile.map(([x, a, b]) => ring(x, a, b));
  const body = kit.mesh(), mouth = kit.mesh();
  for (let r = 0; r + 1 < rings.length; r++) for (let k = 0; k < N; k++) {
    const a = rings[r][k], b = rings[r][(k + 1) % N], c = rings[r + 1][(k + 1) % N], d = rings[r + 1][k];
    const out: V3 = [0, (a[1] + c[1]) / 2, (a[2] + c[2]) / 2];
    body.quad(a, b, c, d, out, [a[0], k * 0.25], [b[0], (k + 1) * 0.25], [c[0], (k + 1) * 0.25], [d[0], k * 0.25]);
  }
  const crown = rings[0], rim = rings[rings.length - 1];
  for (let k = 0; k < N; k++) {
    const a = crown[k], b = crown[(k + 1) % N];
    body.tri([-1.33, 0, 0], a, b, [-1, 0, 0], [0, 0], [a[1], a[2]], [b[1], b[2]]);
    // The mouth: a thick lip, then dark inside, a hand back from the rim.
    const m = rim[k], n = rim[(k + 1) % N], inner = (p: V3): V3 => [p[0], p[1] * 0.86, p[2] * 0.62];
    body.quad(m, n, inner(n), inner(m), [1, 0, 0], [m[1], m[2]], [n[1], n[2]], [n[1] * 0.86, n[2] * 0.62], [m[1] * 0.86, m[2] * 0.62]);
    const p = inner(m), o = inner(n);
    mouth.quad(p, o, [0.6, o[1], o[2]], [0.6, p[1], p[2]], [0, -p[1], -p[2]], [0, 0], [1, 0], [1, 1], [0, 1]);
    mouth.tri([0.6, 0, 0], [0.6, p[1], p[2]], [0.6, o[1], o[2]], [1, 0, 0]);
  }
  // Lying on its side with its broad faces upright, the mouth tipped up a little, raised on the rocks.
  const bell = new pc.Entity('Joare'); bell.setLocalPosition(0, 1.38, 0); bell.setLocalEulerAngles(0, 0, 5);
  kit.root.addChild(bell);
  kit.add('Joare', body, stone, { parent: bell });
  kit.add('Boca del joare', mouth, kit.mat('Boca del joare', '#24211d', 0.1), { parent: bell, shadows: false });
  // The handle: a thick loop of stone from the top of the crown round to its foot, like the sculpture's.
  for (let k = 0; k < 13; k++) {
    const q = Math.PI * (k + 0.5) / 13;
    kit.part('Asa del joare', 'box', stone, [-1.2 - Math.sin(q) * 0.55, Math.cos(q) * 0.6, 0], [0.18, 0.24, 0.2], [0, 0, (q * 180) / Math.PI - 90], bell);
  }
  // The clapper: a thick stone rod lying on the ground out of the mouth, a ring at its end.
  kit.part('Badajo', 'cylinder', stone, [1.6, 0.2, 0.1], [0.32, 1.3, 0.32], [0, 0, 90]);
  kit.part('Anilla del badajo', 'cylinder', stone, [2.27, 0.2, 0.1], [0.4, 0.08, 0.4], [0, 0, 90]);
  // Two rough limestone rocks under it: faceted lumps, not balls.
  const rocks = kit.mesh();
  boulder(rocks, [-0.55, 0.42, 0.05], [0.8, 0.5, 0.68], 3);
  boulder(rocks, [0.5, 0.38, -0.05], [0.9, 0.46, 0.74], 7);
  kit.add('Rocas del joare', rocks, rock);
}

/** A rough rock: a low sphere of facets whose corners are pushed in and out, flat at the bottom. */
function boulder(m: MeshBuilder, [cx, cy, cz]: V3, [rx, ry, rz]: V3, seed: number) {
  const rows = 5, cols = 7;
  const at = (i: number, j: number): V3 => {
    const v = Math.PI * i / rows, u = 2 * Math.PI * (j % cols) / cols;
    const bump = i === 0 || i === rows ? 1 : 0.78 + hash(seed * 97 + i * 13 + (j % cols)) * 0.4;
    return [cx + Math.sin(v) * Math.cos(u) * rx * bump, Math.max(0, cy + Math.cos(v) * ry * bump), cz + Math.sin(v) * Math.sin(u) * rz * bump];
  };
  for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) {
    const a = at(i, j), b = at(i, j + 1), c = at(i + 1, j + 1), d = at(i + 1, j);
    const out: V3 = [(a[0] + c[0]) / 2 - cx, (a[1] + c[1]) / 2 - cy, (a[2] + c[2]) / 2 - cz];
    if (i > 0) m.tri(a, b, c, out, [a[0] + a[2], a[1]], [b[0] + b[2], b[1]], [c[0] + c[2], c[1]]);
    if (i < rows - 1) m.tri(a, c, d, out, [a[0] + a[2], a[1]], [c[0] + c[2], c[1]], [d[0] + d[2], d[1]]);
  }
}
