import type { GeoLandmark } from '../geo';
import type { LandmarkKit } from '../landmarks';
import type { MeshBuilder } from '../geo-scenery';

type V3 = [number, number, number];

/**
 * A wooden pergola over a terrace: square posts on stone footings, a pair of beams clasping each row
 * of posts, close joists across with their ends overhanging, and a climber grown over the top
 * (wisteria in Txintxarri plaza, green in July, its flowers long gone): two stems twisting up
 * opposite posts, round cushions of leaves in three greens over the joists and shoots hanging from
 * the edges. The footprint is the pergola's; `height` its top (default 2.8 m). The leaves and the
 * joists under them open the cut, so Gerard is never lost under them; the posts and beams stay.
 */
export const kind = 'pergola';

/** A round cushion of leaves: an ellipsoid in facets that shades smooth, like the trees' crowns. */
function lobe(builder: MeshBuilder, c: number[], rad: number[]) {
  const U = 9, V = 5;
  const at = (i: number, j: number) => {
    const th = i / U * Math.PI * 2, ph = j / V * Math.PI;
    const d = [Math.sin(ph) * Math.cos(th), Math.cos(ph), Math.sin(ph) * Math.sin(th)];
    const n = [d[0] / rad[0], d[1] / rad[1], d[2] / rad[2]], len = Math.hypot(n[0], n[1], n[2]) || 1;
    return { p: [c[0] + d[0] * rad[0], c[1] + d[1] * rad[1], c[2] + d[2] * rad[2]] as V3, n: [n[0] / len, n[1] / len, n[2] / len] as V3 };
  };
  const uv = (p: V3) => [p[0] + p[1], p[2] + p[1]];
  for (let i = 0; i < U; i++) for (let j = 0; j < V; j++) {
    const a = at(i, j), b = at(i + 1, j), e = at(i + 1, j + 1), d = at(i, j + 1);
    builder.quad(a.p, b.p, e.p, d.p, at(i + 0.5, j + 0.5).n, uv(a.p), uv(b.p), uv(e.p), uv(d.p), [a.n, b.n, e.n, d.n]);
  }
}

/** A round stem along `path`, its radius from `from` at the start to `to` at the end, in six facets that shade smooth. */
function tube(builder: MeshBuilder, path: V3[], from: number, to: number) {
  const SIDES = 6;
  const ring = (k: number) => {
    const p = path[k], a = path[Math.max(0, k - 1)], b = path[Math.min(path.length - 1, k + 1)];
    const t = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], len = Math.hypot(t[0], t[1], t[2]) || 1, d = [t[0] / len, t[1] / len, t[2] / len];
    // Two directions across the stem: the path here never runs along x, so x is a safe start.
    let u = [1 - d[0] * d[0], -d[0] * d[1], -d[0] * d[2]]; const ul = Math.hypot(u[0], u[1], u[2]) || 1; u = [u[0] / ul, u[1] / ul, u[2] / ul];
    const v = [d[1] * u[2] - d[2] * u[1], d[2] * u[0] - d[0] * u[2], d[0] * u[1] - d[1] * u[0]], rad = from + (to - from) * k / (path.length - 1);
    return Array.from({ length: SIDES + 1 }, (_, i) => {
      const a2 = i / SIDES * Math.PI * 2, n: V3 = [Math.cos(a2) * u[0] + Math.sin(a2) * v[0], Math.cos(a2) * u[1] + Math.sin(a2) * v[1], Math.cos(a2) * u[2] + Math.sin(a2) * v[2]];
      return { p: [p[0] + n[0] * rad, p[1] + n[1] * rad, p[2] + n[2] * rad] as V3, n };
    });
  };
  let below = ring(0);
  for (let k = 1; k < path.length; k++) {
    const above = ring(k);
    for (let i = 0; i < SIDES; i++) {
      const a = below[i], b = below[i + 1], c = above[i + 1], d = above[i];
      builder.quad(a.p, b.p, c.p, d.p, a.n, [i / SIDES, k - 1], [(i + 1) / SIDES, k - 1], [(i + 1) / SIDES, k], [i / SIDES, k], [a.n, b.n, c.n, d.n]);
    }
    below = above;
  }
}

export function build(kit: LandmarkKit, landmark: GeoLandmark) {
  const hw = landmark.w * kit.cell / 2, hd = landmark.d * kit.cell / 2, top = Number(landmark.params.height ?? 2.8);
  const r = (i: number) => { const v = Math.sin(i * 91.7 + 13.1) * 43758.5453; return v - Math.floor(v); };
  const timber = kit.mesh(), lattice = kit.mesh(), footing = kit.mesh(), vine = kit.mesh();
  const across = Math.max(1, Math.round(hw * 2 / 2.6)), posts: [number, number][] = [];
  for (let k = 0; k <= across; k++) {
    const x = -hw + (2 * hw * k) / across;
    for (const z of [-hd, hd]) {
      posts.push([x, z]);
      timber.box([x, top / 2, z], [0.18, top, 0.18]);
      footing.box([x, 0.07, z], [0.34, 0.14, 0.34]);
    }
  }
  // A pair of beams clasps each row of posts; the joists lie on them, close together, their ends past the beams.
  for (const z of [-hd, hd]) for (const side of [-0.125, 0.125]) timber.box([0, top - 0.1, z + side], [hw * 2 + 0.7, 0.2, 0.07]);
  const joists = Math.max(2, Math.round(hw * 2 / 0.7));
  for (let j = 0; j <= joists; j++) lattice.box([-hw + (2 * hw * j) / joists, top + 0.08, 0], [0.07, 0.16, hd * 2 + 0.8]);
  const wood = kit.mat('Madera de la pérgola', '#6a5442', 0.12);
  kit.add('Pérgola', timber, wood);
  kit.add('Viguetas de la pérgola', lattice, wood, { cut: true });
  kit.add('Zapatas de la pérgola', footing, kit.mat('Piedra de las zapatas', '#8f8e8b', 0.05));
  // The wisteria's stems: each winds up its post in short lengths and sends an arm over the joists.
  for (const [n, [px, pz]] of [posts[1], posts[posts.length - 2]].entries()) {
    // Two strands winding round the post, each a thin tube, thicker at the foot.
    for (const strand of [0, Math.PI]) {
      const steps = 22, path: V3[] = [];
      for (let s = 0; s <= steps; s++) { const a = s * 0.42 + n * 2 + strand; path.push([px + Math.cos(a) * 0.125, s * top / steps, pz + Math.sin(a) * 0.125]); }
      tube(vine, path, 0.055, 0.035);
    }
    vine.box([px * 0.5, top + 0.2, pz * 0.6], [Math.abs(px) + 0.3, 0.07, 0.07]);
  }
  kit.add('Tronco de la glicinia', vine, kit.mat('Tronco de la glicinia', '#6b6156', 0.05));
  // The leaves: flat cushions over the joists, lighter the higher they lie, thinning to loose tufts at the ends.
  const greens = [kit.mesh(), kit.mesh(), kit.mesh()];
  for (let i = 0; i < Math.round(hw * hd * 7); i++) {
    const x = -hw + r(i) * 2 * hw, z = (r(i + 50) - 0.5) * (2 * hd + 0.7), s = 0.42 + r(i + 100) * 0.4, lift = r(i + 150);
    if (Math.abs(x) / hw > 0.8 + r(i + 250) * 0.3) continue;
    lobe(greens[lift > 0.66 ? 0 : lift > 0.3 ? 1 : 2], [x, top + 0.2 + lift * 0.22, z], [s * 1.25, 0.17 + lift * 0.1, s]);
  }
  // Shoots hanging from both long edges.
  for (let i = 0; i < Math.round(hw * 4); i++) {
    const x = -hw * 0.85 + r(i + 600) * 1.7 * hw, z = (r(i + 650) > 0.5 ? 1 : -1) * (hd + 0.15 + r(i + 700) * 0.2), len = 0.3 + r(i + 750) * 0.45;
    lobe(greens[2 - (i % 2)], [x, top + 0.1 - len / 2, z], [0.13 + r(i + 800) * 0.08, len / 2 + 0.08, 0.13]);
  }
  // Painted leaves (small overlapping blades in a few close greens, so a cushion reads as foliage and not as stripes), a metre per repeat.
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#8a9a7c'; ctx.fillRect(0, 0, 128, 128);
  for (let k = 0; k < 260; k++) {
    ctx.fillStyle = ['#a3b392', '#bccaa8', '#93a485', '#b0c09d', '#7f9072'][k % 5];
    ctx.save(); ctx.translate(r(k + 500) * 128, r(k + 700) * 128); ctx.rotate(r(k + 900) * Math.PI);
    ctx.beginPath(); ctx.ellipse(0, 0, 5 + r(k + 1100) * 3, 2.2, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  }
  const leafy = (name: string, hex: string) => { const m = kit.mat(name, hex, 0.08); m.diffuseMap = kit.texture(c); m.update(); return m; };
  kit.add('Glicinia al sol', greens[0], leafy('Hojas de la glicinia al sol', '#93b262'), { cut: 'canopy' });
  kit.add('Glicinia', greens[1], leafy('Hojas de la glicinia', '#7f9f5c'), { cut: 'canopy' });
  kit.add('Glicinia en sombra', greens[2], leafy('Hojas de la glicinia en sombra', '#557a40'), { cut: 'canopy' });
}
