import * as pc from 'playcanvas';
import type { GeoLandmark } from '../geo';
import type { LandmarkKit } from '../landmarks';
import type { MeshBuilder } from '../geo-scenery';
import { bar, box } from '../landmark-shapes.ts';

/**
 * A campsite's fences (Càmping Eurosport, docs/quests/universidad.md), running along local x through
 * the footprint. `style`:
 * - `malla`, green wire mesh on green steel posts, 1.3 m;
 * - `seto`, a clipped hedge, 1.6 m, as thick as its footprint (the pitches' maze); `round: true`
 *   makes it a round bed of hedge filling the footprint (the roundabout's island);
 * - `porta`, a gate of two mesh leaves in steel frames, PISCINA on a plate, hanging from entities
 *   named `Hoja de la puerta` (`open: true` draws them open);
 * - `fusta`, the tall wall of weathered pine boards that hides the pool and the merendero, 4.6 m;
 * - `portalo`, its double gate under a lintel with PISCINA, shut with a padlock of three word wheels
 *   (`Candado del portón`, which the story takes off); its two leaves of boards hang from entities
 *   named `Hoja del portón`, which the story swings open once the padlock's words are right;
 * - `blindada`, the heavy steel door in the wall between the pool and the merendero: two riveted
 *   leaves in a concrete frame, a locking bar across them, and a row of `lamps` bulbs on the lintel,
 *   one per pitch of Las parcelas (`doorLamps` places them for the story to light). The leaves hang
 *   from entities named `Hoja blindada`, the bar from `Cerrojo blindado`, for the story to open once
 *   Las parcelas is solved.
 * The gates are not solid: the story blocks their cells while they are shut (`CAMPING_GATE`,
 * `CAMPING_DOOR`, src/environments.ts).
 */
export const kind = 'tanca-camping';

const H = 1.3;
/** The tall wall: its height and the kerb of boards it stands on (metres). */
export const TALL = { h: 4.6, kerb: 0.55 };
/** How far the pool gate's leaves swing open (degrees, away from the pitches). */
export const GATE_SWING = 100;
/** The steel door's bulbs on its lintel, from the pivot (local x along the door, metres), facing local +z (the pool). */
export function doorLamps(width: number, count: number) {
  const span = Math.min(width * 0.86, count * 0.34);
  return Array.from({ length: count }, (_, i) => ({ x: -span / 2 + (i + 0.5) * span / count, y: DOOR.h + 0.32, z: 0.4 }));
}
/** The pool gate's padlock: three wheels of words, on the leaves' seam (local, metres). */
export const PADLOCK = { y: 1.45, z: 0.2 };

/** The wire mesh: a see-through panel of diamonds, tiling every 0.25 m. */
function mesh(kit: LandmarkKit) {
  const m = kit.mat('Malla de la piscina', '#ffffff', 0.3);
  if (!m.opacityMap) {
    const c = document.createElement('canvas'); c.width = 64; c.height = 64;
    const ctx = c.getContext('2d')!;
    ctx.strokeStyle = '#6d8466'; ctx.lineWidth = 4;
    for (let k = -64; k <= 128; k += 32) {
      ctx.beginPath(); ctx.moveTo(k, 0); ctx.lineTo(k + 64, 64); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(k + 64, 0); ctx.lineTo(k, 64); ctx.stroke();
    }
    m.diffuseMap = kit.texture(c); m.opacityMap = m.diffuseMap; m.opacityMapChannel = 'a'; m.alphaTest = 0.45;
    m.diffuseMapTiling.set(4, 4); m.opacityMapTiling.set(4, 4); m.cull = pc.CULLFACE_NONE; m.update();
  }
  return m;
}

export function build(kit: LandmarkKit, landmark: GeoLandmark) {
  const L = landmark.w * kit.cell, style = String(landmark.params.style ?? 'malla');
  const steel = kit.mat('Acero verde', '#4d6a52', 0.35);
  if (style === 'seto') {
    const hedge = kit.mesh(), T = Math.max(0.8, landmark.d * kit.cell - 0.35);
    if (landmark.params.round === true) {
      // A round bed: wedges of hedge round the middle, a little lower towards the rim.
      const R = Math.min(L, landmark.d * kit.cell) / 2;
      for (let i = 0; i < 12; i++) box(hedge, Math.cos(i * Math.PI / 6) * R * 0.55, 0, Math.sin(i * Math.PI / 6) * R * 0.55, R * 0.62, 0.95 + (i % 3) * 0.08, R * 0.9, -i * Math.PI / 6);
    } else {
      box(hedge, 0, 0, 0, L, 1.45, T);
      // A ragged clipped top: low lumps along it.
      for (let x = -L / 2 + 0.4, i = 0; x < L / 2 - 0.3; x += 0.7, i++) box(hedge, x, 1.4, (i % 3 - 1) * 0.08, 0.75, 0.12 + (i % 4) * 0.04, T - 0.1, (i % 5) * 0.2);
    }
    kit.add('Seto', hedge, kit.mat('Seto del camping', '#46593a', 0.08));
    return;
  }
  if (style === 'porta') return gate(kit, landmark, L);
  if (style === 'blindada') return armoured(kit, landmark, L);
  if (style === 'fusta' || style === 'portalo') return tall(kit, L, style === 'portalo');
  // Posts every 2.5 m, a top rail, the mesh between.
  const frame = kit.mesh(), panel = kit.mesh();
  const n = Math.max(1, Math.round(L / 2.5));
  for (let i = 0; i <= n; i++) box(frame, -L / 2 + (i / n) * L, 0, 0, 0.06, H + 0.05, 0.06);
  bar(frame, [-L / 2, H, 0], [L / 2, H, 0], 0.04);
  bar(frame, [-L / 2, 0.06, 0], [L / 2, 0.06, 0], 0.03);
  panel.quad([-L / 2, 0.05, 0], [L / 2, 0.05, 0], [L / 2, H, 0], [-L / 2, H, 0], [0, 0, 1], [-L / 2, 0], [L / 2, 0], [L / 2, H], [-L / 2, H]);
  kit.add('Postes de la valla', frame, steel);
  kit.add('Malla', panel, mesh(kit), { shadows: false });
}

function gate(kit: LandmarkKit, landmark: GeoLandmark, L: number) {
  // Taller posts and white frames: the gate reads at once in the run of green mesh.
  const posts = kit.mesh(), white = kit.mat('Puerta blanca', '#e9e6dc', 0.35);
  for (const x of [-L / 2, L / 2]) { box(posts, x, 0, 0, 0.14, H + 0.45, 0.14); box(posts, x, H + 0.45, 0, 0.2, 0.06, 0.2); }
  kit.add('Pilares de la puerta', posts, white);
  const open = landmark.params.open === true, leaf = L / 2 - 0.1;
  for (const side of [-1, 1]) {
    // The hinge on the post; the leaf reaches to the middle (towards −side along x from the hinge).
    const hinge = new pc.Entity('Hoja de la puerta');
    hinge.setLocalPosition(side * (L / 2 - 0.08), 0, 0);
    hinge.setLocalEulerAngles(0, open ? side * 90 : 0, 0);
    kit.root.addChild(hinge);
    const frame = kit.mesh(), panel = kit.mesh();
    const x0 = -side * 0.02, x1 = -side * leaf;
    bar(frame, [x0, 0.1, 0], [x0, H, 0], 0.045);
    bar(frame, [x1, 0.1, 0], [x1, H, 0], 0.045);
    bar(frame, [x0, H, 0], [x1, H, 0], 0.045);
    bar(frame, [x0, 0.1, 0], [x1, 0.1, 0], 0.045);
    const a = Math.min(x0, x1), b = Math.max(x0, x1);
    panel.quad([a, 0.1, 0], [b, 0.1, 0], [b, H, 0], [a, H, 0], [0, 0, 1], [a, 0], [b, 0], [b, H], [a, H]);
    kit.add('Marco de la hoja', frame, white, { parent: hinge, shadows: false });
    kit.add('Malla de la hoja', panel, mesh(kit), { parent: hinge, shadows: false });
    if (side < 0) {
      // PISCINA on an enamel plate on the left leaf, facing the pitches (local +z).
      const plate = kit.mat('Placa PISCINA', '#ffffff', 0.4);
      if (!plate.diffuseMap) { plate.diffuseMap = kit.texture(paintPlate()); plate.update(); }
      const q = kit.mesh(), cx = -side * leaf / 2;
      for (const z of [0.03, -0.03]) q.quad([cx - 0.3, 0.75, z], [cx + 0.3, 0.75, z], [cx + 0.3, 1.0, z], [cx - 0.3, 1.0, z], [0, 0, Math.sign(z)],
        z > 0 ? [0, 1] : [1, 1], z > 0 ? [1, 1] : [0, 1], z > 0 ? [1, 0] : [0, 0], z > 0 ? [0, 0] : [1, 0]);
      kit.add('Placa de la puerta', q, plate, { parent: hinge, shadows: false });
    }
  }
}

/** The tall wall of boards, on a kerb of the same boards; with `gate`, its double gate whose leaves hang from `Hoja del portón`. */
function tall(kit: LandmarkKit, L: number, gate: boolean) {
  const boards = [kit.mesh(), kit.mesh()], low = kit.mesh(), frame = kit.mesh();
  const T = 0.16, step = 0.21;
  const shade = [kit.surface('fusta-passera', '#8d7656', 0.1), kit.surface('fusta-passera', '#76624a', 0.1)];
  const dark = kit.surface('fusta-passera', '#5b4a38', 0.1);
  /** Boards on end along [a, b] (local x), two weathered shades, their tops a little ragged, up to `top`. */
  const planks = (into: [MeshBuilder, MeshBuilder], a: number, b: number, top: number, z = 0) => {
    for (let x = a + step / 2, i = 0; x < b; x += step, i++) box(into[(i * 5) % 7 < 3 ? 1 : 0], x, TALL.kerb - 0.02, z, step - 0.025, top - ((i * 7) % 5) * 0.035 - TALL.kerb, T);
  };
  if (!gate) {
    planks(boards as [MeshBuilder, MeshBuilder], -L / 2, L / 2, TALL.h);
    // Rails across the back and posts every 2.5 m on the far side, so the front stays boards.
    const n = Math.max(1, Math.round(L / 2.5));
    for (let i = 0; i <= n; i++) box(frame, -L / 2 + (i / n) * L, TALL.kerb, -T / 2 - 0.07, 0.14, TALL.h - TALL.kerb - 0.1, 0.14);
    for (const y of [1.2, 2.9, 4.1]) box(frame, 0, y, -T / 2 - 0.05, L, 0.12, 0.08);
    box(low, 0, 0, 0, L, TALL.kerb, T + 0.08);
    kit.add('Tablones de la tapia', boards[0], shade[0]);
    kit.add('Tablones de la tapia', boards[1], shade[1]);
    kit.add('Travesaños de la tapia', frame, dark);
    kit.add('Pie de la tapia', low, shade[1]);
    return;
  }
  // The gate: two posts higher than the wall, a lintel across with PISCINA.
  const posts = kit.mesh();
  for (const x of [-L / 2, L / 2]) box(posts, x, 0, 0.05, 0.3, TALL.h + 0.35, 0.34);
  box(posts, 0, TALL.h - 0.5, 0.08, L + 0.3, 0.55, 0.3);
  kit.add('Pilares del portón', posts, dark);
  // The padlock on the seam: a chain round both leaves' straps, a brass body with three wheels of words.
  const lock = new pc.Entity('Candado del portón');
  kit.root.addChild(lock);
  const chain = kit.mesh(), body = kit.mesh(), wheels = kit.mesh(), P = PADLOCK;
  for (const side of [-1, 1]) bar(chain, [side * 0.22, P.y + 0.12, T / 2 + 0.04], [0, P.y + 0.02, P.z], 0.035);
  box(body, 0, P.y - 0.32, P.z, 0.3, 0.36, 0.1);
  for (let k = 0; k < 3; k++) box(wheels, 0, P.y - 0.29 + k * 0.105, P.z + 0.055, 0.24, 0.07, 0.03);
  kit.add('Cadena del candado', chain, kit.mat('Cadena', '#4a4744', 0.6), { parent: lock, moving: true, shadows: false });
  kit.add('Candado', body, kit.mat('Latón del candado', '#a8833f', 0.7), { parent: lock, moving: true, shadows: false });
  kit.add('Ruedas del candado', wheels, kit.mat('Ruedas del candado', '#d9d2bd', 0.3), { parent: lock, moving: true, shadows: false });
  const plate = kit.mat('Placa PISCINA', '#ffffff', 0.4);
  if (!plate.diffuseMap) { plate.diffuseMap = kit.texture(paintPlate()); plate.update(); }
  const q = kit.mesh(), y = TALL.h - 0.16, z = 0.24;
  q.quad([-0.75, y - 0.02, z], [0.75, y - 0.02, z], [0.75, y + 0.6, z], [-0.75, y + 0.6, z], [0, 0, 1], [0, 1], [1, 1], [1, 0], [0, 0]);
  kit.add('Letrero del portón', q, plate, { shadows: false });
  // Two leaves of boards, each on its post, braced with iron straps; they swing away from the pitches when Las parcelas is solved.
  const iron = kit.mat('Hierro del portón', '#2f2c2a', 0.4), leaf = L / 2 - 0.16;
  for (const side of [-1, 1]) {
    const hinge = new pc.Entity('Hoja del portón');
    hinge.setLocalPosition(side * (L / 2 - 0.14), 0, 0);
    kit.root.addChild(hinge);
    const wood: [MeshBuilder, MeshBuilder] = [kit.mesh(), kit.mesh()], straps = kit.mesh();
    const a = side < 0 ? 0 : -leaf, b = side < 0 ? leaf : 0;
    planks(wood, a, b, TALL.h - 0.55);
    for (const y of [1.0, 2.6]) box(straps, (a + b) / 2, y, T / 2 + 0.01, leaf - 0.1, 0.06, 0.03);
    box(straps, side < 0 ? leaf - 0.12 : -leaf + 0.12, 1.5, T / 2 + 0.03, 0.06, 0.24, 0.05);
    kit.add('Tablones del portón', wood[0], shade[0], { parent: hinge, moving: true });
    kit.add('Tablones del portón', wood[1], shade[1], { parent: hinge, moving: true });
    kit.add('Herrajes del portón', straps, iron, { parent: hinge, moving: true, shadows: false });
  }
}

/** The steel door's opening: how wide each leaf swings (degrees, away from the pool) and how far the bar lifts (metres). */
export const DOOR = { swing: 96, lift: 0.75, h: 3.7 };

/** The steel door: a concrete frame as tall as the wall, two riveted leaves, a locking bar across them. */
function armoured(kit: LandmarkKit, landmark: GeoLandmark, L: number) {
  const frame = kit.mesh(), H = DOOR.h, leaf = L / 2 - 0.22;
  for (const x of [-L / 2, L / 2]) box(frame, x, 0, 0, 0.42, TALL.h + 0.3, 0.6);
  box(frame, 0, H, 0, L + 0.42, TALL.h + 0.3 - H, 0.6);
  box(frame, 0, 0, 0, L, 0.08, 0.7);
  kit.add('Marco de hormigón', frame, kit.surface('formigo', '#8a877f', 0.05));
  const sockets = kit.mesh();
  for (const lamp of doorLamps(L, Number(landmark.params.lamps ?? 9))) box(sockets, lamp.x, lamp.y - 0.09, lamp.z - 0.06, 0.12, 0.18, 0.12);
  kit.add('Bombillas apagadas', sockets, kit.mat('Bombilla apagada', '#4a4436', 0.6), { shadows: false });
  const paint = kit.mat('Acero de la puerta', '#3d4a45', 0.45), rivets = kit.mat('Remaches', '#7e857e', 0.7);
  const rust = kit.mat('Óxido de la puerta', '#6b4630', 0.15);
  for (const side of [-1, 1]) {
    const hinge = new pc.Entity('Hoja blindada');
    hinge.setLocalPosition(side * (L / 2 - 0.2), 0, 0);
    kit.root.addChild(hinge);
    const plate = kit.mesh(), studs = kit.mesh(), stain = kit.mesh();
    const c = -side * leaf / 2;
    // A thick plate, three ribs across, a frame of flat bar round it, rivets along every rib and edge.
    box(plate, c, 0.08, 0, leaf, H - 0.12, 0.16);
    for (const y of [0.55, H / 2 - 0.1, H - 0.6]) box(plate, c, y, 0.1, leaf - 0.1, 0.18, 0.06);
    for (const x of [c - leaf / 2 + 0.06, c + leaf / 2 - 0.06]) box(plate, x, 0.1, 0.1, 0.1, H - 0.16, 0.06);
    for (const y of [0.64, H / 2, H - 0.51]) for (let k = 0; k < 7; k++) box(studs, c - leaf / 2 + 0.16 + k * (leaf - 0.32) / 6, y - 0.03, 0.14, 0.06, 0.06, 0.04);
    for (let k = 0; k < 9; k++) for (const x of [c - leaf / 2 + 0.06, c + leaf / 2 - 0.06]) box(studs, x, 0.25 + k * (H - 0.5) / 8, 0.14, 0.05, 0.05, 0.04);
    // Hinges on the frame side, and rust bleeding down from the ribs.
    for (const y of [0.4, H - 0.6]) box(studs, -side * 0.02, y, 0.05, 0.12, 0.32, 0.26);
    for (let k = 0; k < 3; k++) box(stain, c + (k - 1) * leaf * 0.28 + side * 0.1, 0.12 + k * 0.4, 0.085, 0.07, 0.5 + k * 0.2, 0.01);
    kit.add('Chapa de la hoja', plate, paint, { parent: hinge, moving: true });
    kit.add('Remaches de la hoja', studs, rivets, { parent: hinge, moving: true, shadows: false });
    kit.add('Óxido de la hoja', stain, rust, { parent: hinge, moving: true, shadows: false });
  }
  // The locking bar across both leaves, in two brackets on the frame, and a wheel in the middle.
  const bolt = new pc.Entity('Cerrojo blindado');
  kit.root.addChild(bolt);
  const iron = kit.mesh();
  box(iron, 0, 1.45, 0.24, L + 0.3, 0.16, 0.12);
  for (const x of [-L / 2 - 0.05, L / 2 + 0.05]) box(iron, x, 1.38, 0.24, 0.16, 0.3, 0.2);
  const r = 0.34;
  for (let k = 0; k < 12; k++) {
    const a = k / 12 * Math.PI * 2, b = (k + 1) / 12 * Math.PI * 2;
    bar(iron, [Math.cos(a) * r, 1.53 + Math.sin(a) * r, 0.36], [Math.cos(b) * r, 1.53 + Math.sin(b) * r, 0.36], 0.05);
  }
  for (const a of [0, Math.PI / 2]) bar(iron, [Math.cos(a) * r, 1.53 + Math.sin(a) * r, 0.36], [-Math.cos(a) * r, 1.53 - Math.sin(a) * r, 0.36], 0.04);
  kit.add('Cerrojo de la puerta', iron, kit.mat('Hierro del cerrojo', '#2a2826', 0.5), { parent: bolt, moving: true });
}

function paintPlate() {
  const c = document.createElement('canvas'); c.width = 128; c.height = 52;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#f0ece0'; ctx.fillRect(0, 0, 128, 52);
  ctx.strokeStyle = '#2f5f86'; ctx.lineWidth = 4; ctx.strokeRect(3, 3, 122, 46);
  ctx.fillStyle = '#2f5f86'; ctx.font = '700 26px "Helvetica Neue", Arial, sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('PISCINA', 64, 28);
  return c;
}
