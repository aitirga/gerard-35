import * as pc from 'playcanvas';
import type { GeoLandmark } from '../geo';
import type { LandmarkKit } from '../landmarks';

/**
 * A weir across a sunk river (the map's waterway=weir): a low sill of stone blocks just over the
 * water, the river spilling over it in a white sheet of foam on the downstream side (local -z), and a
 * bar of grey gravel where the current drops what it carries. Local x runs across the river.
 */
export const kind = 'weir';

export function build(kit: LandmarkKit, landmark: GeoLandmark) {
  const half = landmark.w * kit.cell / 2, water = kit.water + 0.035;
  const sill = kit.surface('harri-hezea', '#9a978b', 0.2);
  kit.part('Azud', 'box', sill, [0, water + 0.06, 0.2], [half * 2, 0.32, 0.9]);
  // The spill: a sloping sheet of foam, painted as streaks running downstream.
  const c = document.createElement('canvas'); c.width = 256; c.height = 64;
  const ctx = c.getContext('2d')!;
  const g = ctx.createLinearGradient(0, 0, 0, 64);
  g.addColorStop(0, '#f4f7f5'); g.addColorStop(0.55, '#d5e2dc'); g.addColorStop(1, 'rgba(160,190,180,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 256, 64);
  for (let k = 0; k < 160; k++) {
    const h = Math.sin(k * 12.9898) * 43758.5453, f = h - Math.floor(h);
    ctx.fillStyle = k % 3 ? 'rgba(255,255,255,.55)' : 'rgba(120,150,140,.35)';
    ctx.fillRect(f * 256, (k * 7) % 40, 1.5 + (k % 4), 10 + (k % 5) * 6);
  }
  const foam = kit.mat('Espuma del azud', '#ffffff', 0.4, 0.12);
  foam.diffuseMap = kit.texture(c); foam.opacityMap = foam.diffuseMap; foam.opacityMapChannel = 'a';
  foam.blendType = pc.BLEND_NORMAL; foam.depthWrite = false; foam.update();
  const sheet = kit.mesh();
  sheet.quad([-half, water + 0.2, -0.25], [half, water + 0.2, -0.25], [half, water + 0.01, -2.4], [-half, water + 0.01, -2.4], [0, 1, -0.3], [0, 0], [half / 2, 0], [half / 2, 1], [0, 1]);
  kit.add('Espuma del azud', sheet, foam, { shadows: false });
  // A gravel bar below the weir, along the bank at the start of the sill.
  const gravel = kit.surface('legarra', '#8c8a80', 0.05);
  const bar = kit.mesh(), n = 16, cx = -half * 0.55, cz = -6, rx = half * 0.42, rz = 3;
  for (let k = 0; k < n; k++) {
    const a0 = (k / n) * Math.PI * 2, a1 = ((k + 1) / n) * Math.PI * 2, w0 = 1 + Math.sin(k * 2.1) * 0.15, w1 = 1 + Math.sin((k + 1) * 2.1) * 0.15;
    const p0 = [cx + Math.cos(a0) * rx * w0, cz + Math.sin(a0) * rz * w0], p1 = [cx + Math.cos(a1) * rx * w1, cz + Math.sin(a1) * rz * w1];
    bar.tri([cx, water + 0.12, cz], [p0[0], water + 0.01, p0[1]], [p1[0], water + 0.01, p1[1]], [0, 1, 0], [cx, cz], p0, p1);
  }
  kit.add('Barra de grava', bar, gravel, { shadows: false });
}
