import * as pc from 'playcanvas';
import type { GeoLandmark } from '../geo';
import type { LandmarkKit } from '../landmarks';

/**
 * A beach volleyball court on the sand: two steel posts with guy ropes, the net across the middle
 * (x), white with a dark band along the top, and the court marked with rope pegged into the sand
 * (16 × 8 m, or the footprint). Not solid: people walk across courts nobody is playing on.
 */
export const kind = 'voleibol';

export function build(kit: LandmarkKit, landmark: GeoLandmark) {
  const [w, d] = [landmark.w * kit.cell, landmark.d * kit.cell], half = d / 2 + 0.6, top = 2.43;
  const steel = kit.mat('Poste de vóley', '#b9bec1', 0.55), rope = kit.mat('Cinta del campo', '#2f5d8a', 0.1);
  for (const side of [-1, 1]) {
    kit.part('Poste de vóley', 'cylinder', steel, [0, (top + 0.15) / 2, side * half], [0.09, top + 0.15, 0.09]);
    // A guy rope from the post's top out to a peg in the sand.
    const len = Math.hypot(top, 1.6), tilt = Math.atan2(1.6, top) * 180 / Math.PI;
    kit.part('Viento', 'box', kit.mat('Cuerda', '#d8cfb8', 0.1), [0, top / 2, side * (half + 0.8)], [0.02, len, 0.02], [-side * tilt, 0, 0]);
  }
  // The net: a mesh texture with holes, seen from both sides.
  const net = kit.mat('Red de vóley', '#ffffff', 0.1);
  net.diffuseMap = kit.texture(paintNet()); net.opacityMap = net.diffuseMap; net.opacityMapChannel = 'a'; net.alphaTest = 0.4; net.cull = pc.CULLFACE_NONE; net.update();
  const quad = kit.mesh();
  quad.quad([0, top - 1, -half], [0, top - 1, half], [0, top, half], [0, top, -half], [1, 0, 0], [0, 1], [1, 1], [1, 0], [0, 0]);
  kit.add('Red de vóley', quad, net, { shadows: true });
  // The court's lines: tape on the sand round the footprint and across under the net.
  for (const [x, z, sx, sz] of [[0, -d / 2, w, 0.05], [0, d / 2, w, 0.05], [-w / 2, 0, 0.05, d], [w / 2, 0, 0.05, d]]) {
    kit.part('Línea del campo', 'box', rope, [x, 0.03, z], [sx, 0.02, sz]);
  }
}

/** A square mesh with a dark band along the top edge (the canvas's top is the net's top). */
function paintNet() {
  const c = document.createElement('canvas'); c.width = 512; c.height = 64;
  const ctx = c.getContext('2d')!;
  ctx.clearRect(0, 0, 512, 64);
  ctx.strokeStyle = 'rgba(245,245,240,1)'; ctx.lineWidth = 2.5;
  for (let x = 0; x <= 512; x += 10) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 64); ctx.stroke(); }
  for (let y = 0; y <= 64; y += 10) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(512, y); ctx.stroke(); }
  ctx.fillStyle = '#1e2a36'; ctx.fillRect(0, 0, 512, 6); ctx.fillRect(0, 60, 512, 4);
  for (const x of [0, 506]) ctx.fillRect(x, 0, 6, 64);
  return c;
}
