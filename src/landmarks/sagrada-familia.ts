import * as pc from 'playcanvas';
import type { GeoLandmark } from '../geo';
import type { LandmarkKit } from '../landmarks';

/**
 * The Sagrada Família as it stands in 2026 (docs/places/sagrada-familia.md): 14 of its 18 towers,
 * the Tower of Jesus Christ with its white cross, Mary's lit star, the Nativity facade Gaudí built
 * in old Montjuïc stone, the newer pale nave, transept and Passion facade, the old apse with its
 * pinnacles, and the Glory still a construction front with its cranes. Recognisable from the
 * diorama camera, not modelled sculpture by sculpture.
 *
 * The pivot is the crossing, under the Tower of Jesus: +z is the Nativity (the camera's side, on
 * Carrer de la Marina), +x the apse, −x the Glory, −z the Passion. Footprint and tower positions
 * come from OpenStreetMap's building parts; heights are real up to the nave's roof and pressed
 * above it (`height`), so the overview frames the cross. Every piece is cut round Gerard like a
 * building, one mesh per material.
 */
export const kind = 'sagrada-familia';

type V3 = [number, number, number];
type Mesh = ReturnType<LandmarkKit['mesh']>;

/** Real metres up to the nave's roof; the spires above are pressed to 70 % of their real rise. */
const SPIRE_FROM = 40, SPIRE_SCALE = 0.7;
const height = (m: number) => m <= SPIRE_FROM ? m : SPIRE_FROM + (m - SPIRE_FROM) * SPIRE_SCALE;

/** Stone of the two ages: Gaudí's weathered Montjuïc sandstone and the pale ashlar of the new work. */
const OLD = '#8c7f6e', NEW = '#c4b9a4', TOWER = '#b3a690';

export function build(kit: LandmarkKit, _landmark: GeoLandmark) {
  const random = seeded(2026);
  const parts = {
    old: kit.mesh(), montjuic: kit.mesh(), fresh: kit.mesh(), bells: kit.mesh(), pale: kit.mesh(), lattice: kit.mesh(), mosaic: kit.mesh(),
    white: kit.mesh(), red: kit.mesh(), dark: kit.mesh(), glass: kit.mesh(), green: kit.mesh(), star: kit.mesh(),
    crane: kit.mesh(), steel: kit.mesh(), scaffold: kit.mesh(), panel: kit.mesh(),
  };

  // ------------------------------------------------------------ nave, transept, crossing
  // Five aisles: the outer ones under a 30 m vault, the central nave rising above with its own row of
  // gables, the transept crossing it, and the crossing's block under the six high towers.
  box(parts.fresh, -54.5, 0, -23, -15, 32, 23);
  box(parts.fresh, -54.5, 32, -9, -11, height(52), 9);
  roof(parts.fresh, -54.5, -11, -9, 9, height(52), height(60), 'x');
  box(parts.fresh, -15, 0, -37, 15, 32, 30);
  box(parts.fresh, -7.5, 32, -37, 7.5, height(52), 28);
  roof(parts.fresh, -7.5, 7.5, -37, 28, height(52), height(60), 'z');
  box(parts.fresh, -11, 0, -11, 11, height(60), 11);
  // The nave's side walls, the pale front a visitor sees left of the Nativity: a gable over each
  // 7.5 m bay crowned by a basket of fruit, a rose window and two lancets under it.
  for (let x = -52.25; x < -15; x += 7.5) {
    for (const side of [-1, 1]) {
      gable(parts.fresh, x - 3.6, x + 3.6, 32, height(46), side * 23 - 0.7, side * 23 + 0.7);
      gable(parts.fresh, x - 3.6, x + 3.6, height(52), height(62), side * 9 - 0.6, side * 9 + 0.6);
      blob(parts.mosaic, [x, height(46) + 1, side * 23], 1.2, 1.4, 1.2);
      blob(parts.mosaic, [x, height(62) + 0.8, side * 9], 0.9, 1, 0.9);
    }
    disc(parts.glass, x, 11, 23.12, 2.5, 14);
    disc(parts.dark, x, 11, 23.06, 3.1, 14);
    for (const dx of [-1.4, 1.4]) arch(parts.glass, x + dx, 17, 23.08, 1.1, 7.5);
    arch(parts.glass, x, 34.5, 9.08, 1.6, 6);
  }
  // A printed panel on the works' fence by entrance A: the drawing of the facade still to come.
  box(parts.panel, -36, 0, 23.05, -24, 4.6, 23.3);

  // ------------------------------------------------------------ the apse
  // Gaudí's first work above the crypt (1890s), in the old stone: a half ring of chapels with
  // neo-Gothic pinnacles, and the newer apse rising behind it to Mary's tower.
  const APSE: [number, number] = [15, -1];
  lathe(parts.montjuic, APSE[0], APSE[1], [[28, 0], [28, 24], [26.5, 27], [20, 27]], 14, { from: -Math.PI / 2, to: Math.PI / 2 });
  lathe(parts.fresh, APSE[0], APSE[1], [[20, 24], [19, height(52)], [7, height(70)]], 12, { from: -Math.PI / 2, to: Math.PI / 2 });
  for (let i = 0; i < 7; i++) {
    const a = -Math.PI / 2 + Math.PI * (i + 0.5) / 7, cx = APSE[0] + Math.cos(a) * 26, cz = APSE[1] + Math.sin(a) * 26;
    lathe(parts.montjuic, cx, cz, [[2.4, 24], [2.2, 33], [1.3, 40], [0, height(50)]], 8);
    for (const s of [-1, 1]) {
      const b = a + s * Math.PI / 14;
      lathe(parts.montjuic, APSE[0] + Math.cos(b) * 27.5, APSE[1] + Math.sin(b) * 27.5, [[0.8, 26], [0.6, 31], [0, 35]], 6);
    }
  }

  // ------------------------------------------------------------ the Nativity facade
  // The facade Gaudí saw built: one deep, rugged block of dark stone with three portals (Hope,
  // Charity, Faith), sculpture dripping like wax, the green cypress full of white doves over the
  // central portal, and four bell towers pierced by slots and crowned by mosaic mitres.
  const FRONT = 39;
  box(parts.old, -19.5, 0, 29, 19.5, 30, FRONT);
  gable(parts.old, -9, 9, 30, height(46), 30, FRONT - 1.5);
  gable(parts.old, -19.5, -9.5, 30, 36, 30, FRONT - 0.8);
  gable(parts.old, 9.5, 19.5, 30, 36, 30, FRONT - 0.8);
  arch(parts.dark, 0, 0, FRONT + 0.08, 9, 15);
  for (const x of [-13.5, 13.5]) arch(parts.dark, x, 0, FRONT + 0.08, 5.6, 10);
  // The portals' sculpture: lumps of carved stone all over, sculpted columns between the doors,
  // the paler figures of the Nativity over them, stalactites hanging from every arch.
  for (let i = 0; i < 80; i++) {
    const x = -19 + random() * 38, y = 4 + random() * 30;
    if (Math.abs(x) < 5 && y < 21 || Math.abs(Math.abs(x) - 13.5) < 3 && y < 14) continue;
    const r = 0.5 + random() * 1.2;
    blob(parts.old, [x, y, FRONT + r * 0.2], r * (0.8 + random() * 0.6), r * (1 + random() * 1.4), r * 0.7, 7, 4);
  }
  for (const x of [-9.5, -4.9, 4.9, 9.5, -17.6, 17.6]) {
    lathe(parts.old, x, FRONT + 0.3, [[1, 0], [0.8, 1], [0.7, 9], [1.1, 10.5], [0.9, 12], [0, 13]], 8);
  }
  for (let i = 0; i < 12; i++) {
    const x = (i < 6 ? -1 : 1) * (5.6 + (i % 6) * 1.25), y = 12 + (i % 3) * 3.4;
    blob(parts.fresh, [x, y, FRONT + 0.5], 0.42, 1.1, 0.4, 6, 4);
    blob(parts.fresh, [x, y + 1.35, FRONT + 0.5], 0.3, 0.3, 0.3, 5, 3);
  }
  for (const [cx, w, top] of [[0, 9, 15 + 9 * 0.62], [-13.5, 5.6, 10 + 5.6 * 0.62], [13.5, 5.6, 10 + 5.6 * 0.62]]) {
    for (let k = 0; k < 9; k++) {
      const t = (k + 0.5) / 9, x = cx + (t - 0.5) * w * 1.2, y = top + 1.2 - Math.abs(t - 0.5) * w * 0.9;
      lathe(parts.old, x, FRONT + 0.4, [[0, y - 1.5 - random() * 2.2], [0.45, y]], 5);
    }
  }
  // The cypress, the tree of life, over the Portal of Charity: dark green with white doves.
  lathe(parts.green, 0, FRONT - 3.5, [[1.2, height(42)], [3, height(44)], [2.6, height(50)], [1.2, height(55)], [0, height(58)]], 10);
  for (let i = 0; i < 9; i++) {
    const a = i * 2.4, y = height(44) + (i / 9) * (height(55) - height(44));
    blob(parts.white, [Math.cos(a) * 2.4, y, FRONT - 3.5 + Math.sin(a) * 2.4], 0.55, 0.4, 0.55, 4, 3);
  }
  const bells = (x: number, z: number, real: number, stone: Mesh) => bellTower(parts, stone, x, z, height(real));
  bells(-14.5, 33, 98, parts.bells); bells(-7, 33, 107, parts.bells); bells(7, 33, 107, parts.bells); bells(14.5, 33, 98, parts.bells);

  // ------------------------------------------------------------ the Passion facade
  // Bare pale stone (Sardenya, behind the basilica from the camera): six leaning columns like bones
  // under a white pediment, IESUS NAZARENUS REX IUDAEORUM and a cross on top, four slotted towers.
  bells(-13.5, -37, 107, parts.pale); bells(-6.5, -37, 112, parts.pale); bells(6.5, -37, 112, parts.pale); bells(13.5, -37, 107, parts.pale);
  box(parts.fresh, -19, 0, -42, 19, 18, -37);
  box(parts.fresh, -19, 18, -48, 19, 21, -37);
  for (let i = 0; i < 6; i++) {
    const x = -15 + i * 6;
    beam(parts.fresh, [x * 1.1, 0, -49], [x, 18, -46.5], 1.6);
  }
  gable(parts.white, -19, 19, 21, 34, -48, -46.5);
  beam(parts.white, [0, 33, -47.2], [0, 41, -47.2], 0.8);
  beam(parts.white, [-2.6, 38.5, -47.2], [2.6, 38.5, -47.2], 0.8);

  // ------------------------------------------------------------ the six high towers
  // Faceted cones of pale stone covered in a lattice of triangular openings: the four Evangelists
  // (with their white figures: the angel, the lion, the bull and the eagle), Mary's over the apse
  // with its twelve-pointed glass star, and Jesus Christ's over the crossing with its white cross.
  for (const [x, z] of [[-10.5, 10.5], [10.5, 10.5], [-10.5, -10.5], [10.5, -10.5]]) {
    const top = height(125);
    lathe(parts.lattice, x, z, [[5.4, height(58)], [4.8, height(80)], [3.6, height(100)], [1.6, top - 2], [0, top + 0.5]], 8, { phase: Math.PI / 8 });
    figure(parts.white, x, top, z, height(135) - top);
  }
  lathe(parts.lattice, 22.5, 0, [[6.5, height(52)], [6.2, height(70)], [5.2, height(90)], [3.4, height(115)], [1.4, height(128)], [0, height(131)]], 8, { phase: Math.PI / 8 });
  star(parts.star, [22.5, height(134.5), 0], 3.2);
  const jesus = height(155.5);
  lathe(parts.lattice, 0, 0, [[10, height(60)], [9, height(85)], [6.8, height(115)], [3.8, height(140)], [1.6, jesus - 1], [1.2, jesus]], 10, { phase: Math.PI / 10 });
  // The cross: white, hollow and three-dimensional, 17 m by 13.5 m.
  const arm = height(172.5) - jesus;
  beam(parts.white, [0, jesus - 0.5, 0], [0, jesus + arm, 0], 2.2);
  for (const [dx, dz] of [[1, 0], [0, 1]]) beam(parts.white, [-dx * arm * 0.4, jesus + arm * 0.66, -dz * arm * 0.4], [dx * arm * 0.4, jesus + arm * 0.66, dz * arm * 0.4], 2.2);

  // ------------------------------------------------------------ the Glory: still building
  // Carrer de Mallorca: the main facade is a wall in scaffolding behind a hoarding, and two yellow
  // tower cranes stand over the site, as they have for as long as anyone remembers.
  quadX(parts.scaffold, -55.6, -22, 22, 6, 36);
  quadX(parts.scaffold, -55, -22, 22, 6, 36);
  crane(parts, -46, 13, height(150), 46, 0);
  crane(parts, 33, -33, height(132), 40, Math.PI * 0.85);

  // ------------------------------------------------------------ materials, one mesh each
  const tint = (m: pc.StandardMaterial, canvas: HTMLCanvasElement, metres: number[], options: { alpha?: boolean; glow?: number } = {}) => {
    const t = kit.texture(canvas);
    m.diffuseMap = t; m.diffuseMapTiling.set(1 / metres[0], 1 / metres[1]);
    if (options.alpha) { m.opacityMap = t; m.opacityMapChannel = 'a'; m.opacityMapTiling.set(1 / metres[0], 1 / metres[1]); m.alphaTest = 0.5; m.cull = pc.CULLFACE_NONE; }
    if (options.glow) { m.emissiveMap = t; m.emissive.set(1, 1, 1); m.emissiveIntensity = options.glow; m.emissiveMapTiling.set(1 / metres[0], 1 / metres[1]); }
    m.update(); return m;
  };
  const looks: Record<keyof typeof parts, pc.StandardMaterial> = {
    old: kit.surface('pedra-naixement', OLD, 0.05),
    montjuic: kit.surface('pedra-montjuic', '#8e8170', 0.05),
    fresh: kit.surface('carreu', NEW, 0.05),
    bells: tint(kit.mat('Campanarios del Nacimiento', '#ffffff', 0.05), slots(random, '#86735e', '#2a231c', 0.5), [1, 1]),
    pale: tint(kit.mat('Campanarios de la Pasión', '#ffffff', 0.05), slots(random, '#c3b6a0', '#3a322a', 0.12), [1, 1]),
    lattice: tint(kit.mat('Celosía de las torres', '#ffffff', 0.05), lattice(random, TOWER), [4, 4]),
    mosaic: tint(kit.mat('Trencadís de los pináculos', '#ffffff', 0.55), trencadis(random), [1.6, 1.6]),
    white: kit.mat('Piedra blanca', '#f1ede4', 0.3),
    red: kit.mat('Cruz de los pináculos', '#b8322a', 0.5),
    dark: kit.mat('Sombra de los portales', '#2a231d', 0.1),
    glass: kit.mat('Vidrieras', '#2f5664', 0.75, 0.15),
    green: kit.mat('Ciprés de piedra', '#3e6a46', 0.3),
    star: kit.mat('Estrella de María', '#d8eef2', 0.8, 0.9),
    crane: tint(kit.mat('Celosía de las grúas', '#ffffff', 0.4), craneLattice('#e6b31e'), [2.2, 2.2], { alpha: true }),
    steel: kit.mat('Contrapeso de grúa', '#3a3d40', 0.4),
    scaffold: tint(kit.mat('Andamio de la Gloria', '#ffffff', 0.2), scaffolding(), [2, 2], { alpha: true }),
    panel: tint(kit.mat('Lona de la fachada', '#ffffff', 0.1), drawing(), [12, 4.6]),
  };
  for (const [key, mesh] of Object.entries(parts) as [keyof typeof parts, Mesh][]) kit.add(`Sagrada Família: ${key}`, mesh, looks[key], { cut: true });
}

/** A Nativity or Passion bell tower: a slotted parabolic shaft and its mosaic mitre with the white crozier on top. */
function bellTower(parts: Record<string, Mesh>, stone: Mesh, x: number, z: number, top: number) {
  const base = top * 0.76, length = top - base;
  const profile: [number, number][] = [];
  for (let i = 0; i <= 8; i++) { const f = i / 8; profile.push([4.6 * (1 - 0.6 * f ** 1.6), base * f]); }
  lathe(stone, x, z, profile, 16, { wraps: 1, band: 9 });
  lathe(parts.mosaic, x, z, [[1.85, base], [1.2, base + length * 0.3], [1.5, base + length * 0.55], [0.9, base + length * 0.75], [0.45, base + length * 0.86], [0, base + length * 0.9]], 6);
  const y = base + length * 0.93;
  blob(parts.white, [x, y, z], 1.15, 1.15, 1.15, 6, 4);
  lathe(parts.red, x, z, [[0, y - 0.25], [1.7, y - 0.2], [1.7, y + 0.2], [0, y + 0.25]], 8);
  for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3; blob(parts.white, [x + Math.cos(a) * 1.85, y, z + Math.sin(a) * 1.85], 0.45, 0.45, 0.45, 4, 3); }
  blob(parts.red, [x, y + 1.5, z], 0.5, 0.5, 0.5, 4, 3);
}

/** An Evangelist's white figure: a body and two raised wings, read as one bright shape from far away. */
function figure(b: Mesh, x: number, y: number, z: number, h: number) {
  blob(b, [x, y + h * 0.45, z], 1.2, h * 0.45, 1.2, 6, 4);
  for (const s of [-1, 1]) beam(b, [x, y + h * 0.35, z], [x + s * 2.2, y + h * 0.95, z + 0.6], 0.5, 1.4);
}

/** Mary's star: twelve glass points (an icosahedron's corners) round a lit core. */
function star(b: Mesh, c: V3, r: number) {
  blob(b, c, r * 0.4, r * 0.4, r * 0.4, 6, 4);
  const t = (1 + Math.sqrt(5)) / 2;
  const tips: V3[] = [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]];
  for (const tip of tips) {
    const l = Math.hypot(...tip);
    beam(b, c, [c[0] + tip[0] / l * r, c[1] + tip[1] / l * r, c[2] + tip[2] / l * r], 0.5, 0.5, true);
  }
}

/** A tower crane: lattice mast, jib and counter-jib turned to `yaw`, cab and counterweight. */
function crane(parts: Record<string, Mesh>, x: number, z: number, top: number, jib: number, yaw: number) {
  const c = Math.cos(yaw), s = Math.sin(yaw), at = (d: number, y: number): V3 => [x + c * d, y, z + s * d];
  beam(parts.crane, [x, 0, z], [x, top, z], 2.2);
  beam(parts.crane, at(-1, top + 1.1), at(jib, top + 1.1), 1.6);
  beam(parts.crane, at(-14, top + 1.1), at(-1, top + 1.1), 1.8);
  beam(parts.steel, at(-13, top - 0.2), at(-10, top - 0.2), 2.4, 3);
  beam(parts.steel, at(1.4, top - 2.6), at(3.6, top - 2.6), 2.2, 2.4);
  beam(parts.crane, [x, top + 1.9, z], [x, top + 9, z], 1.2);
}

// ------------------------------------------------------------ mesh helpers (metres, UVs in metres)

/** A box from one corner to the other; every face but the bottom, UVs in metres so materials tile at real size. */
function box(b: Mesh, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number) {
  b.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1], [x0, y0], [x1, y0], [x1, y1], [x0, y1]);
  b.quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [0, 0, -1], [-x1, y0], [-x0, y0], [-x0, y1], [-x1, y1]);
  b.quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [1, 0, 0], [-z1, y0], [-z0, y0], [-z0, y1], [-z1, y1]);
  b.quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [-1, 0, 0], [z0, y0], [z1, y0], [z1, y1], [z0, y1]);
  b.quad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], [0, 1, 0], [x0, z1], [x1, z1], [x1, z0], [x0, z0]);
}

/** A pitched roof over a box top, its ridge along `along`, with a gable at each end. */
function roof(b: Mesh, x0: number, x1: number, z0: number, z1: number, y0: number, ridge: number, along: 'x' | 'z') {
  if (along === 'x') {
    const zm = (z0 + z1) / 2;
    b.quad([x0, y0, z1], [x1, y0, z1], [x1, ridge, zm], [x0, ridge, zm], [0, 1, 1], [x0, 0], [x1, 0], [x1, z1 - zm], [x0, z1 - zm]);
    b.quad([x1, y0, z0], [x0, y0, z0], [x0, ridge, zm], [x1, ridge, zm], [0, 1, -1], [x1, 0], [x0, 0], [x0, zm - z0], [x1, zm - z0]);
    for (const [x, n] of [[x0, -1], [x1, 1]] as const) b.tri([x, y0, z0], [x, y0, z1], [x, ridge, zm], [n, 0, 0], [z0, y0], [z1, y0], [zm, ridge]);
  } else {
    const xm = (x0 + x1) / 2;
    b.quad([x1, y0, z0], [x1, y0, z1], [xm, ridge, z1], [xm, ridge, z0], [1, 1, 0], [z0, 0], [z1, 0], [z1, x1 - xm], [z0, x1 - xm]);
    b.quad([x0, y0, z1], [x0, y0, z0], [xm, ridge, z0], [xm, ridge, z1], [-1, 1, 0], [z1, 0], [z0, 0], [z0, xm - x0], [z1, xm - x0]);
    for (const [z, n] of [[z0, -1], [z1, 1]] as const) b.tri([x0, y0, z], [x1, y0, z], [xm, ridge, z], [0, 0, n], [x0, y0], [x1, y0], [xm, ridge]);
  }
}

/** A gable: a triangular wall from x0 to x1 rising to `apex`, between the planes z0 and z1. */
function gable(b: Mesh, x0: number, x1: number, y0: number, apex: number, z0: number, z1: number) {
  const xm = (x0 + x1) / 2;
  b.tri([x0, y0, z1], [x1, y0, z1], [xm, apex, z1], [0, 0, 1], [x0, y0], [x1, y0], [xm, apex]);
  b.tri([x1, y0, z0], [x0, y0, z0], [xm, apex, z0], [0, 0, -1], [-x1, y0], [-x0, y0], [-xm, apex]);
  const slope = Math.hypot(xm - x0, apex - y0);
  b.quad([x0, y0, z0], [x0, y0, z1], [xm, apex, z1], [xm, apex, z0], [-(apex - y0), xm - x0, 0], [z0, 0], [z1, 0], [z1, slope], [z0, slope]);
  b.quad([x1, y0, z1], [x1, y0, z0], [xm, apex, z0], [xm, apex, z1], [apex - y0, x1 - xm, 0], [z1, 0], [z0, 0], [z0, slope], [z1, slope]);
}

/**
 * A body of revolution round (cx, cz): `profile` lists [radius, height] from the foot up. UVs count
 * metres round and up, or with `wraps` the painted band goes that many times round, `band` metres high.
 */
function lathe(b: Mesh, cx: number, cz: number, profile: [number, number][], segments: number,
  o: { from?: number; to?: number; phase?: number; wraps?: number; band?: number; sx?: number; sz?: number } = {}) {
  const from = (o.from ?? 0) + (o.phase ?? 0), to = (o.to ?? Math.PI * 2) + (o.phase ?? 0), sx = o.sx ?? 1, sz = o.sz ?? 1;
  const angle = (j: number) => from + (to - from) * j / segments;
  const point = (r: number, y: number, a: number): V3 => [cx + Math.cos(a) * r * sx, y, cz + Math.sin(a) * r * sz];
  const uv = (r: number, y: number, j: number) => o.wraps ? [j / segments * o.wraps, -y / (o.band ?? 1)] : [angle(j) * r, y];
  for (let i = 0; i + 1 < profile.length; i++) {
    const [r0, y0] = profile[i], [r1, y1] = profile[i + 1];
    const rise = (r0 - r1) / Math.max(1e-3, Math.hypot(y1 - y0, r0 - r1));
    for (let j = 0; j < segments; j++) {
      const mid = angle(j + 0.5), facing: V3 = [Math.cos(mid) * sx, rise, Math.sin(mid) * sz];
      const a = point(r0, y0, angle(j)), bb = point(r0, y0, angle(j + 1)), c = point(r1, y1, angle(j + 1)), d = point(r1, y1, angle(j));
      if (r1 < 1e-4) b.tri(a, bb, c, facing, uv(r0, y0, j), uv(r0, y0, j + 1), uv(r1, y1, j + 0.5));
      else if (r0 < 1e-4) b.tri(a, c, d, facing, uv(r0, y0, j + 0.5), uv(r1, y1, j + 1), uv(r1, y1, j));
      else b.quad(a, bb, c, d, facing, uv(r0, y0, j), uv(r0, y0, j + 1), uv(r1, y1, j + 1), uv(r1, y1, j));
    }
  }
}

/** An ellipsoid centred on `c`. */
function blob(b: Mesh, c: V3, rx: number, ry: number, rz: number, segments = 6, rings = 4) {
  const profile: [number, number][] = [];
  for (let k = 0; k <= rings; k++) { const t = Math.PI * k / rings; profile.push([Math.sin(t), c[1] - Math.cos(t) * ry]); }
  lathe(b, c[0], c[2], profile, segments, { sx: rx, sz: rz });
}

/** A square-section bar from `a` to `c`, `w` wide and `h` deep; `point` tapers it to a tip at `c`. */
function beam(b: Mesh, a: V3, c: V3, w: number, h = w, point = false) {
  const d = norm([c[0] - a[0], c[1] - a[1], c[2] - a[2]]);
  const up: V3 = Math.abs(d[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
  const u = norm(cross(d, up)), v = cross(u, d);
  const corner = (p: V3, su: number, sv: number, k: number): V3 =>
    [p[0] + (u[0] * su * w + v[0] * sv * h) * k / 2, p[1] + (u[1] * su * w + v[1] * sv * h) * k / 2, p[2] + (u[2] * su * w + v[2] * sv * h) * k / 2];
  const length = Math.hypot(c[0] - a[0], c[1] - a[1], c[2] - a[2]);
  const sides: [number, number][] = [[1, 1], [-1, 1], [-1, -1], [1, -1]];
  for (let i = 0; i < 4; i++) {
    const [s0, t0] = sides[i], [s1, t1] = sides[(i + 1) % 4];
    const out: V3 = [u[0] * (s0 + s1) + v[0] * (t0 + t1), u[1] * (s0 + s1) + v[1] * (t0 + t1), u[2] * (s0 + s1) + v[2] * (t0 + t1)];
    const tip = point ? 0 : 1;
    b.quad(corner(a, s0, t0, 1), corner(a, s1, t1, 1), corner(c, s1, t1, tip), corner(c, s0, t0, tip), out, [0, 0], [w, 0], [w, length], [0, length]);
  }
  if (!point) b.quad(corner(c, 1, 1, 1), corner(c, -1, 1, 1), corner(c, -1, -1, 1), corner(c, 1, -1, 1), d, [0, 0], [w, 0], [w, h], [0, h]);
}

/** A flat disc facing +z (a rose window). */
function disc(b: Mesh, x: number, y: number, z: number, r: number, segments: number) {
  for (let j = 0; j < segments; j++) {
    const a0 = j / segments * Math.PI * 2, a1 = (j + 1) / segments * Math.PI * 2;
    b.tri([x, y, z], [x + Math.cos(a0) * r, y + Math.sin(a0) * r, z], [x + Math.cos(a1) * r, y + Math.sin(a1) * r, z], [0, 0, 1], [x, y], [x + Math.cos(a0) * r, y + Math.sin(a0) * r], [x + Math.cos(a1) * r, y + Math.sin(a1) * r]);
  }
}

/** A pointed arch facing +z: `w` wide, its straight sides `h` high, then two arcs meeting at a point. */
function arch(b: Mesh, x: number, y: number, z: number, w: number, h: number) {
  const outline: [number, number][] = [[x - w / 2, y], [x + w / 2, y], [x + w / 2, y + h]];
  for (let k = 1; k < 6; k++) { const t = k / 6; outline.push([x + w / 2 * (1 - t) ** 0.7, y + h + w * 0.62 * Math.sin(t * Math.PI / 2)]); }
  outline.push([x, y + h + w * 0.62]);
  for (let k = 5; k > 0; k--) { const t = k / 6; outline.push([x - w / 2 * (1 - t) ** 0.7, y + h + w * 0.62 * Math.sin(t * Math.PI / 2)]); }
  outline.push([x - w / 2, y + h]);
  const centre: V3 = [x, y + h * 0.6, z];
  for (let i = 0; i < outline.length; i++) {
    const [ax, ay] = outline[i], [bx, by] = outline[(i + 1) % outline.length];
    b.tri(centre, [ax, ay, z], [bx, by, z], [0, 0, 1], [x, y + h * 0.6], [ax, ay], [bx, by]);
  }
}

/** A vertical sheet in the plane x = `x` (scaffolding over the Glory), seen from both sides. */
function quadX(b: Mesh, x: number, z0: number, z1: number, y0: number, y1: number) {
  b.quad([x, y0, z1], [x, y0, z0], [x, y1, z0], [x, y1, z1], [-1, 0, 0], [z1, y0], [z0, y0], [z0, y1], [z1, y1]);
}

const norm = (v: V3): V3 => { const l = Math.hypot(...v) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
function seeded(seed: number) { return () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }; }

// ------------------------------------------------------------ painted surfaces (own procedural painting)

function canvas(w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d')!); return c;
}
/** Grain of weathered stone: specks a shade lighter and darker, `soot` streaks running down. */
function grain(ctx: CanvasRenderingContext2D, random: () => number, w: number, h: number, soot: number) {
  for (let i = 0; i < w * h / 40; i++) {
    ctx.fillStyle = random() > 0.5 ? 'rgba(255,245,225,.10)' : 'rgba(40,30,20,.12)';
    ctx.fillRect(random() * w, random() * h, 1 + random() * 3, 1 + random() * 3);
  }
  for (let i = 0; i < 40 * soot; i++) {
    const x = random() * w, len = h * (0.1 + random() * 0.4);
    ctx.fillStyle = `rgba(30,24,18,${0.06 + random() * 0.12})`; ctx.fillRect(x, random() * h, 2 + random() * 6, len);
  }
}
/**
 * One turn of a bell tower, 9 m high: courses of stone and two rows of the tall slots that let the
 * bells sound (the real towers have them in spiralling bands). `soot` darkens the old stone.
 */
function slots(random: () => number, stone: string, shadow: string, soot: number) {
  return canvas(512, 512, ctx => {
    ctx.fillStyle = stone; ctx.fillRect(0, 0, 512, 512);
    grain(ctx, random, 512, 512, soot);
    for (let row = 0; row < 2; row++) {
      ctx.fillStyle = 'rgba(255,248,232,.16)'; ctx.fillRect(0, row * 256 + 236, 512, 8);
      for (let k = 0; k < 10; k++) {
        const x = k * 51.2 + (row ? 25 : 0) + 14, top = row * 256 + 40;
        ctx.fillStyle = shadow; ctx.beginPath(); ctx.roundRect(x, top, 20, 170, [10, 10, 2, 2]); ctx.fill();
        ctx.fillStyle = 'rgba(255,248,232,.22)'; ctx.fillRect(x + 20, top + 6, 3, 164);
      }
    }
  });
}
/** 4 × 4 m of a high tower: pale stone ribs round triangular openings, staggered row by row. */
function lattice(random: () => number, stone: string) {
  return canvas(256, 256, ctx => {
    ctx.fillStyle = stone; ctx.fillRect(0, 0, 256, 256);
    grain(ctx, random, 256, 256, 0.1);
    for (let row = 0; row < 4; row++) for (let k = -1; k < 5; k++) {
      const x = k * 64 + (row % 2 ? 32 : 0), y = row * 64 + 10, up = (k + row) % 2 === 0;
      ctx.fillStyle = '#4a4236'; ctx.beginPath();
      if (up) { ctx.moveTo(x + 32, y); ctx.lineTo(x + 52, y + 44); ctx.lineTo(x + 12, y + 44); }
      else { ctx.moveTo(x + 12, y); ctx.lineTo(x + 52, y); ctx.lineTo(x + 32, y + 44); }
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,248,232,.25)'; ctx.lineWidth = 2; ctx.stroke();
    }
  });
}
/** Venetian glass mosaic (trencadís) of the mitres and fruit: red, gold, orange and white shards. */
function trencadis(random: () => number) {
  return canvas(128, 128, ctx => {
    ctx.fillStyle = '#ece4d4'; ctx.fillRect(0, 0, 128, 128);
    const colours = ['#b8322a', '#d6a428', '#c8401f', '#f3efe6', '#d6a428', '#b8322a', '#e2782c', '#3f7d4f'];
    for (let i = 0; i < 150; i++) {
      const x = random() * 128, y = random() * 128, r = 4 + random() * 7;
      ctx.fillStyle = colours[Math.floor(random() * colours.length)]; ctx.beginPath();
      for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI * 2 + random() * 0.8; ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); }
      ctx.fill();
    }
  });
}
/** A crane's lattice side, 2.2 m square: yellow chords and diagonals, open between. */
function craneLattice(yellow: string) {
  return canvas(64, 64, ctx => {
    ctx.clearRect(0, 0, 64, 64); ctx.strokeStyle = yellow; ctx.lineWidth = 5;
    ctx.strokeRect(2, -4, 60, 72); ctx.beginPath(); ctx.moveTo(2, 64); ctx.lineTo(62, 0); ctx.stroke();
    ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, 2); ctx.lineTo(64, 2); ctx.stroke();
  });
}
/** 2 × 2 m of scaffolding: galvanised tubes, a plank and a strip of white safety net. */
function scaffolding() {
  return canvas(64, 64, ctx => {
    ctx.clearRect(0, 0, 64, 64);
    ctx.fillStyle = 'rgba(226,224,216,.95)'; ctx.fillRect(0, 34, 64, 18);
    ctx.fillStyle = '#9a9a94'; ctx.fillRect(0, 0, 4, 64); ctx.fillRect(0, 0, 64, 3); ctx.fillRect(0, 30, 64, 3);
    ctx.fillStyle = '#8a6e4c'; ctx.fillRect(0, 26, 64, 4);
    ctx.strokeStyle = '#9a9a94'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(4, 30); ctx.lineTo(64, 3); ctx.stroke();
  });
}
/** The works' printed panel: a pencil drawing of gables and rose windows on white (painted upside down: wall UVs climb with height). */
function drawing() {
  return canvas(512, 196, ctx => {
    ctx.translate(0, 196); ctx.scale(1, -1);
    ctx.fillStyle = '#eceae4'; ctx.fillRect(0, 0, 512, 196);
    ctx.strokeStyle = '#6f7478'; ctx.lineWidth = 2;
    for (let k = 0; k < 5; k++) {
      const x = 20 + k * 96;
      ctx.beginPath(); ctx.moveTo(x, 110); ctx.lineTo(x + 44, 18); ctx.lineTo(x + 88, 110); ctx.stroke();
      ctx.beginPath(); ctx.arc(x + 44, 140, 26, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(x + 44, 140, 12, 0, Math.PI * 2); ctx.stroke();
      for (const dx of [26, 62]) ctx.strokeRect(x + dx - 4, 66, 8, 34);
    }
    ctx.fillStyle = '#e2e0d9'; ctx.fillRect(0, 186, 512, 10);
  });
}
