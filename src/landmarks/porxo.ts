import type { GeoLandmark } from '../geo';
import type { LandmarkKit } from '../landmarks';

/**
 * An arcaded porch along a building's front, open under round arches: Cardedeu station's porch on
 * platform 1 (a lean-to of Arab tiles) and the town hall's (a terrace with a balustrade on top).
 * The footprint is the porch: `size_m` [length, depth], its back on the building's wall (local −z)
 * and its arches facing the camera (+z). Params: `arches` along the front, `side` arches on the
 * east (+x) end, `spring_m` and `top_m` (arch springing and wall top), `roof` `teula` or `terrassa`,
 * `colour`, `base` (the piers' plinths, `base_m` high), and on the building's wall `clock` [x, y],
 * `lanterns` [[x, y]…], a ticket `machine` and a `bench` at x (metres from the middle).
 */
export const kind = 'porxo';

type V3 = [number, number, number];

export function build(kit: LandmarkKit, landmark: GeoLandmark) {
  const p = landmark.params;
  const L = landmark.w * kit.cell, D = landmark.d * kit.cell;
  const arches = Number(p.arches ?? 4), side = Number(p.side ?? 0);
  const spring = Number(p.spring_m ?? 2.2), top = Number(p.top_m ?? 3.6), T = 0.42, pier = 0.6;
  const render = kit.surface('estuc', String(p.colour ?? '#ecd69c'));
  const plinth = kit.mat('Zócalo de arenisca', String(p.base ?? '#c4a57a'), 0.1);
  const wall = kit.mesh();
  /**
   * One arcaded face: `count` arches between piers along a wall from `a` to `b` (metres along it),
   * placed by `at(s, y, inward)`; `out` is the face's outward normal.
   */
  function arcade(a: number, b: number, count: number, at: (s: number, y: number, inward: number) => V3, out: V3) {
    const span = (b - a - pier * (count + 1)) / count, R = span / 2, steps = 9;
    const uv = (s: number, y: number) => [s, y];
    for (let k = 0; k <= count; k++) {
      const s0 = a + k * (span + pier), s1 = s0 + pier;
      // The pier's face, its two jambs and, over the arches, the wall up to the top.
      wall.quad(at(s0, 0, 0), at(s1, 0, 0), at(s1, top, 0), at(s0, top, 0), out, uv(s0, 0), uv(s1, 0), uv(s1, top), uv(s0, top));
      for (const [s, sign] of [[s0, -1], [s1, 1]] as const) {
        if ((k === 0 && sign < 0) || (k === count && sign > 0)) continue;
        const n: V3 = [at(sign, 0, 0)[0] - at(0, 0, 0)[0], 0, at(sign, 0, 0)[2] - at(0, 0, 0)[2]];
        wall.quad(at(s, 0, 0), at(s, 0, T), at(s, spring, T), at(s, spring, 0), n, uv(0, 0), uv(T, 0), uv(T, spring), uv(0, spring));
      }
      kit.part('Basa del pilar', 'box', plinth, at(s0 + pier / 2, Number(p.base_m ?? 0.9) / 2, T / 2), [pier + 0.05, Number(p.base_m ?? 0.9), T + 0.05], [0, angleOf(out), 0]);
      if (k === count) break;
      const c = s1 + R;
      for (let j = 0; j < steps; j++) {
        const t0 = Math.PI * (1 - j / steps), t1 = Math.PI * (1 - (j + 1) / steps);
        const p0 = [c + R * Math.cos(t0), spring + R * Math.sin(t0)], p1 = [c + R * Math.cos(t1), spring + R * Math.sin(t1)];
        // The spandrel above the curve, then the arch's soffit.
        wall.quad(at(p0[0], p0[1], 0), at(p1[0], p1[1], 0), at(p1[0], top, 0), at(p0[0], top, 0), out, uv(p0[0], p0[1]), uv(p1[0], p1[1]), uv(p1[0], top), uv(p0[0], top));
        // The soffit faces the arch's centre.
        const tm = (t0 + t1) / 2, along = at(1, 0, 0), o = at(0, 0, 0), sx = along[0] - o[0], sz = along[2] - o[2];
        const inward: V3 = [-Math.cos(tm) * sx, -Math.sin(tm), -Math.cos(tm) * sz];
        wall.quad(at(p0[0], p0[1], 0), at(p1[0], p1[1], 0), at(p1[0], p1[1], T), at(p0[0], p0[1], T), inward, uv(p0[0], 0), uv(p1[0], 0), uv(p1[0], T), uv(p0[0], T));
      }
    }
  }
  // The front, then the east end (its back pier against the building), or a plain end wall.
  arcade(-L / 2, L / 2, arches, (s, y, inward) => [s, y, D / 2 - inward], [0, 0, 1]);
  if (side) arcade(-D / 2, D / 2, side, (s, y, inward) => [L / 2 - inward, y, s], [1, 0, 0]);
  else wall.quad([L / 2, 0, D / 2 - T], [L / 2, 0, D / 2], [L / 2, top, D / 2], [L / 2, top, D / 2 - T], [1, 0, 0], [0, 0], [T, 0], [T, top], [0, top]);
  // A thin cornice over the arches (under a lean-to's eave, so it never shows through the tiles), then the roof.
  const cornice = kit.mat('Cornisa del porche', String(p.trim ?? '#f3e7c8'), 0.1), cy = p.roof === 'terrassa' ? top + 0.08 : top - 0.06;
  kit.part('Cornisa', 'box', cornice, [0, cy, D / 2 - T / 2 + 0.06], [L + 0.12, 0.16, T + 0.12]);
  if (side) kit.part('Cornisa', 'box', cornice, [L / 2 - T / 2 + 0.06, cy, 0], [T + 0.12, 0.16, D]);
  const roof = kit.mesh();
  if (p.roof === 'terrassa') {
    // A terrace on top: a flat slab of terracotta tiles (as dark as `rajola` keeps its hue, see patis.ts)
    // and a balustrade round its open sides.
    roof.quad([-L / 2, top + 0.17, -D / 2], [L / 2, top + 0.17, -D / 2], [L / 2, top + 0.17, D / 2], [-L / 2, top + 0.17, D / 2], [0, 1, 0], [-L / 2, -D / 2], [L / 2, -D / 2], [L / 2, D / 2], [-L / 2, D / 2]);
    kit.add('Terraza', roof, kit.surface('rajola', String(p.floor ?? '#946c55')), { cut: true });
    const stone = kit.mat('Balaustrada', String(p.trim ?? '#f3e7c8'), 0.1);
    kit.part('Pasamanos', 'box', stone, [0, top + 1.05, D / 2 - 0.12], [L, 0.12, 0.24]);
    for (let x = -L / 2 + 0.2; x <= L / 2 - 0.2; x += 0.32) kit.part('Balaústre', 'cylinder', stone, [x, top + 0.6, D / 2 - 0.12], [0.13, 0.78, 0.13]);
  } else {
    // A lean-to of Arab tiles from under the building's eave down to the arches, overhanging them.
    const back = top + Number(p.rise_m ?? 0.7), front = D / 2 + 0.45, slope = Math.hypot(back - top, D / 2 + front);
    roof.quad([-L / 2 - 0.3, top + 0.12, front], [L / 2 + 0.45, top + 0.12, front], [L / 2 + 0.45, back, -D / 2], [-L / 2 - 0.3, back, -D / 2], [0, 1, 0.3], [0, 0], [L + 0.75, 0], [L + 0.75, slope], [0, slope]);
    // The lean-to's end, over the east wall.
    wall.tri([L / 2, top, D / 2], [L / 2, back - 0.05, -D / 2], [L / 2, top, -D / 2], [1, 0, 0], [D / 2, top], [-D / 2, back], [-D / 2, top]);
    kit.add('Tejadillo del porche', roof, kit.surface('teula', String(p.tiles ?? '#a95a3c')), { cut: true });
  }
  kit.add('Arcada', wall, render, { cut: true });
  furniture(kit, p, D);
}

/** What hangs on the building's wall under the porch and stands in it. */
function furniture(kit: LandmarkKit, p: Record<string, unknown>, D: number) {
  const back = -D / 2 + 0.06;
  const iron = kit.mat('Hierro negro', '#25282a', 0.4);
  if (Array.isArray(p.clock)) {
    // A round station clock on a bracket, its face painted.
    const [x, y] = p.clock as number[];
    kit.part('Soporte del reloj', 'box', iron, [x, y, back + 0.18], [0.06, 0.06, 0.36]);
    kit.part('Caja del reloj', 'cylinder', iron, [x, y, back + 0.38], [0.62, 0.1, 0.62], [90, 0, 0]);
    const face = kit.mat('Esfera del reloj', '#ffffff', 0.3, 0.15);
    face.diffuseMap = kit.texture(clockFace()); face.emissiveMap = face.diffuseMap; face.emissive.set(1, 1, 1); face.update();
    const quad = kit.mesh();
    quad.quad([x - 0.27, y - 0.27, back + 0.44], [x + 0.27, y - 0.27, back + 0.44], [x + 0.27, y + 0.27, back + 0.44], [x - 0.27, y + 0.27, back + 0.44], [0, 0, 1], [0, 1], [1, 1], [1, 0], [0, 0]);
    kit.add('Reloj de la estación', quad, face, { shadows: false });
  }
  const glow = kit.mat('Luz de farol', '#ffd89a', 0.2, 1.6);
  for (const [x, y] of (Array.isArray(p.lanterns) ? p.lanterns : []) as number[][]) {
    // An iron wall lantern: a curled bracket and a four-sided cage round a warm light.
    kit.part('Brazo del farol', 'box', iron, [x, y + 0.25, back + 0.22], [0.05, 0.05, 0.44]);
    kit.part('Farol', 'box', iron, [x, y, back + 0.44], [0.26, 0.4, 0.26]);
    kit.part('Luz del farol', 'box', glow, [x, y - 0.02, back + 0.44], [0.2, 0.28, 0.28]);
    kit.part('Sombrerete', 'cone', iron, [x, y + 0.28, back + 0.44], [0.34, 0.18, 0.34]);
  }
  if (typeof p.machine === 'number') {
    // The red ticket machine, its screen lit.
    const x = p.machine;
    kit.part('Máquina de billetes', 'box', kit.mat('Máquina roja', '#c8322b', 0.4), [x, 0.9, back + 0.3], [0.8, 1.8, 0.5]);
    kit.part('Pantalla', 'box', kit.mat('Pantalla', '#cfe6ef', 0.5, 0.8), [x, 1.3, back + 0.56], [0.45, 0.32, 0.02]);
  }
  if (typeof p.bench === 'number') {
    const wood = kit.mat('Listones de banco', '#9b5a34', 0.25), frame = kit.mat('Estructura gris', '#8d9295', 0.55);
    const x = p.bench;
    for (let i = 0; i < 3; i++) kit.part('Listón', 'box', wood, [x, 0.42, back + 0.3 + i * 0.12], [1.6, 0.04, 0.1]);
    for (const dx of [-0.7, 0.7]) kit.part('Pata', 'box', frame, [x + dx, 0.21, back + 0.42], [0.05, 0.42, 0.4]);
  }
}

function clockFace() {
  const c = document.createElement('canvas'); c.width = 64; c.height = 64;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#f7f5ef'; ctx.beginPath(); ctx.arc(32, 32, 31, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#1d1f21';
  for (let i = 0; i < 12; i++) { ctx.save(); ctx.translate(32, 32); ctx.rotate(i * Math.PI / 6); ctx.fillRect(-1.5, -29, 3, i % 3 ? 5 : 8); ctx.restore(); }
  // A quarter to five: the afternoon the town is drawn for.
  ctx.lineCap = 'round'; ctx.strokeStyle = '#1d1f21';
  ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(32, 32); ctx.lineTo(32 + Math.sin(4.75 / 12 * Math.PI * 2) * 15, 32 - Math.cos(4.75 / 12 * Math.PI * 2) * 15); ctx.stroke();
  ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(32, 32); ctx.lineTo(32 - 24, 32); ctx.stroke();
  return c;
}

/** The yaw (degrees) that turns a box's front to an outward normal along x or z. */
function angleOf(n: V3) { return Math.atan2(n[0], n[2]) * 180 / Math.PI; }
