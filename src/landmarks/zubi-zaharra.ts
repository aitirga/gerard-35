import type { GeoLandmark } from '../geo';
import type { LandmarkKit } from '../landmarks';

type V3 = [number, number, number];

/**
 * Zubi Zaharra, Alegia's old bridge over the Oria (late 17th century, rebuilt after the 1983 flood):
 * grey rubble with a ring of dressed stones round each arch, a wide arch on the town hall's side and
 * a smaller one to the south, and between them the pier, whose round cutwater faces upstream and
 * rises to a refuge in the parapet with a stone cross; moss and ferns where the river reaches. The
 * deck is the map's bridge (walkable, with its parapets); this draws what stands under it, down to the
 * sunk river (`look.river_m`). Local x runs along the bridge from the town hall (-) to the south bank
 * (+), +z faces upstream. `arches`: [from, to] pairs in metres along x; the pier stands between the
 * first two.
 */
export const kind = 'zubi-zaharra';

export function build(kit: LandmarkKit, landmark: GeoLandmark) {
  const half = landmark.w * kit.cell / 2, side = landmark.d * kit.cell / 2;
  const water = Math.min(-1, kit.water), top = 0.09;
  const arches = (landmark.params.arches as [number, number][] | undefined) ?? [[-16, -1], [3, 13]];
  const crown = top - 0.65;
  const rubble = kit.surface('harri-hezea', String(landmark.params.colour ?? '#8d8b80'), 0.12);
  const dressed = kit.surface('harri-hezea', '#a7a497', 0.12);
  const moss = kit.mat('Musgo del puente', '#4b5a37', 0.1);
  // Each arch is a segment of a circle springing from the water and rising to just under the deck.
  const curves = arches.map(([a, b]) => {
    const span = b - a, rise = crown - water, r = (span * span / 4 + rise * rise) / (2 * rise);
    return { a, b, mid: (a + b) / 2, r, cy: crown - r };
  });
  const under = (x: number) => {
    const c = curves.find(k => x > k.a && x < k.b);
    return c ? c.cy + Math.sqrt(Math.max(0, c.r * c.r - (x - c.mid) ** 2)) : water - 0.05;
  };
  // The two faces, in strips down to the water or to the arch below them.
  const faces = kit.mesh(), soffits = kit.mesh(), rings = kit.mesh();
  const xs = new Set<number>([-half, half]);
  for (let x = -half; x < half; x += 0.4) xs.add(x);
  for (const c of curves) { xs.add(c.a); xs.add(c.b); }
  const steps = [...xs].sort((p, q) => p - q);
  for (const s of [-1, 1]) {
    const z = s * side, n: V3 = [0, 0, s];
    for (let k = 0; k + 1 < steps.length; k++) {
      const xa = steps[k], xb = steps[k + 1], ya = under(xa + 1e-4), yb = under(xb - 1e-4);
      faces.quad([xa, ya, z], [xb, yb, z], [xb, top, z], [xa, top, z], n, [xa, ya], [xb, yb], [xb, top], [xa, top]);
    }
  }
  for (const c of curves) {
    // The barrel under each arch, and on both faces a ring of dressed voussoirs a hair proud of the rubble.
    const from = Math.acos(Math.max(-1, Math.min(1, (c.b - c.mid) / c.r))), to = Math.PI - from, n = 18;
    for (let k = 0; k < n; k++) {
      const t0 = from + (to - from) * k / n, t1 = from + (to - from) * (k + 1) / n;
      const p0 = [c.mid + Math.cos(t0) * c.r, c.cy + Math.sin(t0) * c.r], p1 = [c.mid + Math.cos(t1) * c.r, c.cy + Math.sin(t1) * c.r];
      const u0 = c.r * (t0 - from), u1 = c.r * (t1 - from);
      soffits.quad([p0[0], p0[1], -side], [p1[0], p1[1], -side], [p1[0], p1[1], side], [p0[0], p0[1], side], [c.mid - p0[0], c.cy - p0[1], 0], [u0, -side], [u1, -side], [u1, side], [u0, side]);
      const q0 = [c.mid + Math.cos(t0) * (c.r + 0.55), c.cy + Math.sin(t0) * (c.r + 0.55)], q1 = [c.mid + Math.cos(t1) * (c.r + 0.55), c.cy + Math.sin(t1) * (c.r + 0.55)];
      for (const s of [-1, 1]) {
        const z = s * (side + 0.03);
        rings.quad([p0[0], Math.min(p0[1], top), z], [p1[0], Math.min(p1[1], top), z], [q1[0], Math.min(q1[1], top), z], [q0[0], Math.min(q0[1], top), z], [0, 0, s],
          [u0, 0], [u1, 0], [u1, 0.55], [u0, 0.55]);
      }
    }
  }
  kit.add('Paramentos de Zubi Zaharra', faces, rubble);
  kit.add('Bóvedas de Zubi Zaharra', soffits, rubble, { shadows: false });
  kit.add('Dovelas de Zubi Zaharra', rings, dressed);

  // The pier between the arches: a round cutwater on each side, the upstream one up to the refuge.
  const pier = arches.length > 1 ? (arches[0][1] + arches[1][0]) / 2 : 0;
  const width = arches.length > 1 ? arches[1][0] - arches[0][1] : 3;
  const drum = kit.mesh(), green = kit.mesh();
  const cylinder = (mesh: ReturnType<typeof kit.mesh>, cx: number, cz: number, r: number, y0: number, y1: number, from: number, to: number) => {
    const n = 14;
    for (let k = 0; k < n; k++) {
      const a0 = from + (to - from) * k / n, a1 = from + (to - from) * (k + 1) / n;
      const p0: V3 = [cx + Math.sin(a0) * r, 0, cz + Math.cos(a0) * r], p1: V3 = [cx + Math.sin(a1) * r, 0, cz + Math.cos(a1) * r];
      mesh.quad([p0[0], y0, p0[2]], [p1[0], y0, p1[2]], [p1[0], y1, p1[2]], [p0[0], y1, p0[2]], [Math.sin((a0 + a1) / 2), 0, Math.cos((a0 + a1) / 2)],
        [r * a0, y0], [r * a1, y0], [r * a1, y1], [r * a0, y1]);
      mesh.tri([cx, y1, cz], [p0[0], y1, p0[2]], [p1[0], y1, p1[2]], [0, 1, 0], [cx, cz], [p0[0], p0[2]], [p1[0], p1[2]]);
    }
  };
  const refuge = 0.95, r = width / 2;
  cylinder(drum, pier, side, r, water - 0.05, top + refuge, -Math.PI / 2, Math.PI / 2);
  cylinder(drum, pier, -side, r * 0.8, water - 0.05, top - 0.2, Math.PI / 2, Math.PI * 1.5);
  // Moss where the river rises and falls, round both cutwaters.
  cylinder(green, pier, side, r + 0.02, water - 0.05, water + 0.55, -Math.PI / 2, Math.PI / 2);
  cylinder(green, pier, -side, r * 0.8 + 0.02, water - 0.05, water + 0.45, Math.PI / 2, Math.PI * 1.5);
  kit.add('Tajamar de Zubi Zaharra', drum, rubble);
  kit.add('Verdín de Zubi Zaharra', green, moss, { shadows: false });
  // The cross on the refuge, over the river.
  const cross = kit.surface('harri-hezea', '#b3b0a4', 0.15);
  const at = side + r * 0.55;
  kit.part('Pedestal de la cruz', 'box', cross, [pier, top + refuge + 0.25, at], [0.6, 0.5, 0.6]);
  kit.part('Fuste de la cruz', 'box', cross, [pier, top + refuge + 1.5, at], [0.24, 2.1, 0.24]);
  kit.part('Brazos de la cruz', 'box', cross, [pier, top + refuge + 2.05, at], [1.05, 0.22, 0.22]);
  // Ferns and moss on the spandrels, more of them low on the stone.
  const fern = kit.mat('Helecho', '#5d7a3c', 0.1);
  for (let k = 0; k < 22; k++) {
    const h = Math.sin(k * 91.7) * 43758.5453, f = h - Math.floor(h), g = (Math.sin(k * 37.3) * 9631.7) % 1;
    const x = -half + 1 + f * (2 * half - 2), s = k % 2 ? 1 : -1, y = Math.max(under(x) + 0.25, water + 0.3) + Math.abs(g) * 0.8;
    if (y > top - 0.2) continue;
    kit.part('Helecho', 'sphere', fern, [x, y, s * (side + 0.08)], [0.5 + Math.abs(g) * 0.4, 0.28, 0.22]);
  }
}
