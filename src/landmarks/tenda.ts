import type { GeoLandmark } from '../geo';
import type { LandmarkKit } from '../landmarks';
import type { MeshBuilder } from '../geo-scenery';
import { bar, box } from '../landmark-shapes.ts';

/**
 * A tent pitched on a campsite's pitch and left empty (Càmping Eurosport, docs/quests/universidad.md):
 * faded canvas (`lona`) in its `colour`, a darker groundsheet skirt, the door unzipped onto the dark
 * inside, guy lines to pegs. `tent`: `iglu` (a dome, two poles crossing over it), `canadenca` (a ridge
 * tent, its door at the front end, a pole standing out at each end) or `familiar` (a tunnel tent on
 * three hoops, its door on the long side). The door faces local +z, the camera. Under 1.6 m, so it
 * never hides Gerard; the footprint is solid.
 */
export const kind = 'tenda';

type V3 = [number, number, number];

/** A darker or lighter shade of a hex colour (`f` < 1 darkens). */
export function shade(hex: string, f: number) {
  const n = parseInt(hex.slice(1), 16), c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(v => Math.max(0, Math.min(255, Math.round(v * f))));
  return `#${c.map(v => v.toString(16).padStart(2, '0')).join('')}`;
}

export function build(kit: LandmarkKit, landmark: GeoLandmark) {
  const p = landmark.params, colour = String(p.colour ?? '#7d8558');
  const canvas = kit.mat(`Lona ${colour}`, colour, 0.12), skirt = kit.mat(`Lona baja ${colour}`, shade(colour, 0.62), 0.1);
  const inside = kit.mat('Dentro de la tienda', '#2c2722', 0.05), rope = kit.mat('Viento de la tienda', '#d8d2bf', 0.2), pole = kit.mat('Varilla', '#3b3d3c', 0.5);
  const body = kit.mesh(), low = kit.mesh(), dark = kit.mesh(), lines = kit.mesh(), poles = kit.mesh();
  const W = landmark.w * kit.cell, Dp = landmark.d * kit.cell;
  const peg = (from: V3, to: [number, number]) => {
    bar(lines, from, [to[0], 0.02, to[1]], 0.018);
    box(poles, to[0], 0, to[1], 0.04, 0.08, 0.04);
  };
  const kindOf = String(p.tent ?? 'iglu');
  if (kindOf === 'canadenca') ridge(body, low, dark, poles, peg, Math.min(1.9, W * 0.55), Math.min(2.3, Dp * 0.92));
  else if (kindOf === 'familiar') tunnel(body, low, dark, peg, Math.min(3.4, W * 0.92), Math.min(2.1, Dp * 0.85));
  else dome(body, low, dark, poles, Math.min(2.3, W * 0.62), Math.min(2.1, Dp * 0.85));
  kit.add('Tienda', body, canvas);
  kit.add('Faldón de la tienda', low, skirt);
  kit.add('Puerta abierta', dark, inside, { shadows: false });
  kit.add('Vientos', lines, rope, { shadows: false });
  kit.add('Varillas y piquetas', poles, pole, { shadows: false });
}

/** A dome: rings of an ellipsoid shaded round, the lowest band in the skirt, a dark arch at the front. */
function dome(body: MeshBuilder, low: MeshBuilder, dark: MeshBuilder, poles: MeshBuilder, w: number, d: number) {
  const S = 14, J = 5, h = 1.25, rx = w / 2, rz = d / 2;
  const pt = (k: number, j: number): V3 => {
    const t = (k / S) * Math.PI * 2, f = (j / J) * Math.PI / 2;
    return [rx * Math.cos(t) * Math.cos(f), 0.02 + h * Math.sin(f), rz * Math.sin(t) * Math.cos(f)];
  };
  const nrm = (k: number, j: number): V3 => {
    const t = (k / S) * Math.PI * 2, f = (j / J) * Math.PI / 2;
    const v: V3 = [Math.cos(t) * Math.cos(f) / rx, Math.sin(f) / h, Math.sin(t) * Math.cos(f) / rz], l = Math.hypot(...v);
    return [v[0] / l, v[1] / l, v[2] / l];
  };
  for (let j = 0; j < J; j++) for (let k = 0; k < S; k++) {
    const a = pt(k, j), b = pt(k + 1, j), c = pt(k + 1, j + 1), e = pt(k, j + 1);
    const m = nrm(k + 0.5, j + 0.5);
    // The front's lowest bands (round local +z) are the open door; the rest is canvas, its foot the skirt.
    const front = Math.abs(((k + 0.5) / S) - 0.25) < 0.04 && j < 3;
    (front ? dark : j === 0 ? low : body).quad(a, b, c, e, m, [0, 0], [1, 0], [1, 1], [0, 1], [nrm(k, j), nrm(k + 1, j), nrm(k + 1, j + 1), nrm(k, j + 1)]);
  }
  // Two poles crossing over the top from corner to corner, standing just proud of the canvas.
  for (const k0 of [S / 8, (3 * S) / 8]) {
    for (let j = -J; j < J; j++) {
      const at = (jj: number): V3 => { const q = pt(jj < 0 ? k0 + S / 2 : k0, Math.abs(jj)); const n = nrm(jj < 0 ? k0 + S / 2 : k0, Math.abs(jj)); return [q[0] + n[0] * 0.03, q[1] + n[1] * 0.03, q[2] + n[2] * 0.03]; };
      bar(poles, at(j), at(j + 1), 0.025);
    }
  }
}

/** A ridge tent along local z: two sloping sides, the back end closed, the front end open to the dark. */
function ridge(body: MeshBuilder, low: MeshBuilder, dark: MeshBuilder, poles: MeshBuilder, peg: (from: V3, to: [number, number]) => void, w: number, d: number) {
  const h = 1.35, hw = w / 2, hd = d / 2, s = 0.18;
  for (const side of [-1, 1]) {
    const n: V3 = [side * h, hw, 0];
    body.quad([side * hw, s, hd], [side * hw, s, -hd], [0, h, -hd], [0, h, hd], n, [0, 0], [d, 0], [d, 1], [0, 1]);
    low.quad([side * hw, 0.01, hd], [side * hw, 0.01, -hd], [side * hw, s, -hd], [side * hw, s, hd], [side, 0, 0], [0, 0], [d, 0], [d, s], [0, s]);
    peg([side * hw * 0.5, h * 0.62, hd], [side * (hw + 0.55), hd + 0.35]);
    peg([side * hw * 0.5, h * 0.62, -hd], [side * (hw + 0.55), -hd - 0.35]);
  }
  // The back end closed; the front end: dark inside, one flap rolled back on each side.
  body.tri([-hw, s, -hd], [hw, s, -hd], [0, h, -hd], [0, 0, -1]);
  low.quad([-hw, 0.01, -hd], [hw, 0.01, -hd], [hw, s, -hd], [-hw, s, -hd], [0, 0, -1], [0, 0], [1, 0], [1, 1], [0, 1]);
  dark.tri([-hw + 0.04, 0.02, hd - 0.06], [hw - 0.04, 0.02, hd - 0.06], [0, h - 0.05, hd - 0.06], [0, 0, 1]);
  for (const side of [-1, 1]) body.tri([side * hw, s, hd], [side * hw * 0.45, s, hd + 0.04], [0, h, hd], [0, 0, 1]);
  // The poles stand out over the ridge at both ends; the ridge line runs to a peg in front and behind.
  for (const z of [hd + 0.02, -hd - 0.02]) bar(poles, [0, 0, z], [0, h + 0.12, z], 0.03);
  peg([0, h + 0.1, hd + 0.02], [0, hd + 0.8]);
  peg([0, h + 0.1, -hd - 0.02], [0, -hd - 0.8]);
}

/** A tunnel tent along local x on three hoops, round in section, its door on the long side facing the camera. */
function tunnel(body: MeshBuilder, low: MeshBuilder, dark: MeshBuilder, peg: (from: V3, to: [number, number]) => void, w: number, d: number) {
  const h = 1.5, hw = w / 2, rz = d / 2, S = 9, L = 6;
  const pt = (i: number, k: number): V3 => {
    const a = (k / S) * Math.PI, x = -hw + (i / L) * w;
    // The ends slope in: each end's section is lower and narrower, so the tunnel's ends round off.
    const end = Math.min(1, Math.min(i, L - i) / 1.2) * 0.25 + 0.75;
    return [x, 0.02 + h * Math.sin(a) * end, -rz * Math.cos(a) * end];
  };
  const nrm = (k: number): V3 => { const a = (k / S) * Math.PI; return [0, Math.sin(a), -Math.cos(a)]; };
  for (let i = 0; i < L; i++) for (let k = 0; k < S; k++) {
    const a = pt(i, k), b = pt(i + 1, k), c = pt(i + 1, k + 1), e = pt(i, k + 1);
    const front = k >= S - 3 && i >= 2 && i < 4;
    (front ? dark : k === 0 || k === S - 1 ? low : body).quad(a, b, c, e, nrm(k + 0.5), [0, 0], [1, 0], [1, 1], [0, 1], [nrm(k), nrm(k), nrm(k + 1), nrm(k + 1)]);
  }
  // Both ends closed with a fan of canvas.
  for (const i of [0, L]) {
    const c: V3 = [pt(i, 0)[0], 0.02, 0];
    for (let k = 0; k < S; k++) body.tri(c, pt(i, k), pt(i, k + 1), [i === 0 ? -1 : 1, 0, 0]);
  }
  for (const i of [1, 3, 5]) {
    const top = pt(i, S / 2);
    peg([top[0], top[1] * 0.7, rz * 0.7], [top[0], rz + 0.6]);
    peg([top[0], top[1] * 0.7, -rz * 0.7], [top[0], -rz - 0.6]);
  }
}
