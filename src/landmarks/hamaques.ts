import * as pc from 'playcanvas';
import type { GeoLandmark } from '../geo';
import type { LandmarkKit } from '../landmarks';

/**
 * Where people lie on the sand. `style: "loungers"`: a beach bar's rows of white loungers in pairs
 * under blue-and-white parasols, filling the footprint. `style: "towels"`: someone's spot, towels
 * side by side under one parasol, a bag and a cooler; `seed` changes the colours. Parasols stay
 * under 2.2 m, and the footprint is solid so nobody walks through them.
 */
export const kind = 'hamaques';

const TOWELS = ['#2f6fb5', '#e9c02a', '#d9583c', '#3fa38a', '#f2efe6', '#7a4fa0', '#e8846a', '#1f3b5a'];
const CLOTHS = [['#2f5d8a', '#f3f1ea'], ['#3a7bbf', '#f3f1ea'], ['#e9c02a', '#f3f1ea'], ['#d9583c', '#f3f1ea']];

export function build(kit: LandmarkKit, landmark: GeoLandmark) {
  const [w, d] = [landmark.w * kit.cell, landmark.d * kit.cell];
  const seed = Number(landmark.params.seed ?? 1), r = (i: number) => { const v = Math.sin((seed * 31 + i) * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };
  if (landmark.params.style === 'towels') {
    const n = 2 + Math.floor(r(1) * 2);
    for (let i = 0; i < n; i++) {
      const x = (i - (n - 1) / 2) * 0.95 + (r(i + 2) - 0.5) * 0.2;
      kit.part('Toalla', 'box', kit.mat('Toalla', TOWELS[Math.floor(r(i + 5) * TOWELS.length)], 0.05), [x, 0.012, (r(i + 9) - 0.5) * 0.3], [0.85, 0.02, 1.7], [0, (r(i + 12) - 0.5) * 14, 0]);
    }
    parasol(kit, [0.2 - n * 0.3, 0, -0.7], CLOTHS[Math.floor(r(20) * CLOTHS.length)], 14 + r(21) * 10);
    kit.part('Bolsa de playa', 'box', kit.mat('Bolsa de playa', ['#c43b2f', '#2f6fb5', '#e9c02a'][Math.floor(r(22) * 3)], 0.1), [n * 0.5, 0.18, -0.7], [0.45, 0.36, 0.22], [0, 20, 0]);
    if (r(23) > 0.4) kit.part('Nevera', 'box', kit.mat('Nevera', '#3a7bbf', 0.3), [n * 0.5 + 0.2, 0.17, 0.5], [0.5, 0.34, 0.32]);
    return;
  }
  // A bar's loungers: pairs facing the sea (+z), a parasol between each pair, rows a little apart.
  const white = kit.mat('Hamaca', '#efede6', 0.3), frame = kit.mat('Patas de hamaca', '#9aa0a3', 0.4);
  for (let z = -d / 2 + 1.3; z < d / 2 - 1; z += 3.2) for (let x = -w / 2 + 1.4; x < w / 2 - 1; x += 2.6) {
    for (const side of [-0.45, 0.45]) {
      kit.part('Hamaca', 'box', white, [x + side, 0.32, z], [0.62, 0.07, 1.6]);
      kit.part('Respaldo', 'box', white, [x + side, 0.52, z - 0.66], [0.62, 0.07, 0.6], [55, 0, 0]);
      for (const fz of [-0.6, 0.6]) kit.part('Pata de hamaca', 'box', frame, [x + side, 0.15, z + fz], [0.58, 0.3, 0.04]);
    }
    parasol(kit, [x, 0, z - 0.95], CLOTHS[0], 0);
  }
}

/** A parasol: a pole stuck in the sand, a canopy of eight panels in two colours, tilted `tilt` degrees. */
function parasol(kit: LandmarkKit, at: number[], [a, b]: string[], tilt: number) {
  const pole = kit.mat('Mástil de sombrilla', '#d9d6cf', 0.3), cloth = [kit.mat('Sombrilla', a, 0.12), kit.mat('Sombrilla', b, 0.12)];
  const holder = new pc.Entity('Sombrilla');
  holder.setLocalPosition(at[0], 0, at[2]); holder.setLocalEulerAngles(tilt, 0, 0); kit.root.addChild(holder);
  kit.part('Mástil', 'cylinder', pole, [0, 1.05, 0], [0.04, 2.1, 0.04], undefined, holder);
  for (let k = 0; k < 8; k++) {
    const yaw = k * 45;
    // Each panel is a thin slab hinged at the top, its outer end drooping like the real cloth.
    kit.part('Gajo de sombrilla', 'box', cloth[k % 2], [Math.sin(yaw * Math.PI / 180) * 0.45, 1.95, Math.cos(yaw * Math.PI / 180) * 0.45], [0.75, 0.02, 0.95], [14, yaw, 0], holder);
  }
}
