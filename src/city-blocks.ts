/**
 * The city behind the network map (docs/barcelona.md § Look): thousands of little blocks drawn
 * in 3D from above, the Eixample's chamfered squares with their courtyards, smaller and looser
 * blocks in the old town and the outer neighbourhoods, parks, and trees on the hills. Districts
 * only decide how the blocks look; their borders are never drawn. Big avenues, landmarks and
 * home cut the blocks open so they sit on the ground of the city.
 * Deterministic and pure: the same SVG string every time, memoised by `city-map.ts`.
 */
import { CITY_MAP } from './transit.ts';

type Point = number[];

/** How each district builds its blocks: grid pitch and turn, how much of a cell is built, heights. */
interface Texture { pitch: number; turn: number; fill: number; height: [number, number]; jitter: number; parks: number; chamfer?: boolean }
const TEXTURES: Record<string, Texture> = {
  'eixample': { pitch: 230, turn: 0, fill: .8, height: [70, 120], jitter: 0, parks: .02, chamfer: true },
  'sant-marti': { pitch: 230, turn: 0, fill: .74, height: [45, 110], jitter: .08, parks: .05, chamfer: true },
  'ciutat-vella': { pitch: 140, turn: 10, fill: .82, height: [45, 75], jitter: .55, parks: .02 },
  'gracia': { pitch: 165, turn: 7, fill: .8, height: [40, 70], jitter: .3, parks: .03 },
  'sants-montjuic': { pitch: 200, turn: -5, fill: .74, height: [40, 85], jitter: .25, parks: .05 },
  'les-corts': { pitch: 240, turn: -14, fill: .66, height: [40, 120], jitter: .3, parks: .07 },
  'sarria': { pitch: 230, turn: -24, fill: .6, height: [25, 55], jitter: .45, parks: .14 },
  'horta': { pitch: 220, turn: 22, fill: .62, height: [30, 70], jitter: .4, parks: .12 },
  'nou-barris': { pitch: 210, turn: 32, fill: .68, height: [45, 105], jitter: .35, parks: .08 },
  'sant-andreu': { pitch: 210, turn: 14, fill: .7, height: [35, 75], jitter: .3, parks: .06 },
};
const DEFAULT: Texture = { pitch: 220, turn: 0, fill: .7, height: [35, 75], jitter: .3, parks: .06 };
/** Beyond the city's districts (L'Hospitalet, Santa Coloma…): looser, lower, fading out. */
const OUTSKIRTS: Texture = { pitch: 250, turn: 18, fill: .6, height: [25, 60], jitter: .45, parks: .1 };
/** Roofs are drawn this many times higher than the blocks' heights, so the 3D reads from far. */
const LIFT = 1.6;
/** How far beyond its soft outline a district keeps building, so neighbours meet with no gap. */
const REACH = 650;

/** A small seeded random generator: the city never changes between renders. */
function random(seed: number) {
  return () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function inside([x, y]: Point, poly: Point[]) {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}
function distance([x, y]: Point, line: Point[], closed = false) {
  let best = Infinity;
  for (let i = 0; i < line.length - (closed ? 0 : 1); i++) {
    const [ax, ay] = line[i], [bx, by] = line[(i + 1) % line.length];
    const dx = bx - ax, dy = by - ay, len = dx * dx + dy * dy || 1;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / len));
    best = Math.min(best, Math.hypot(x - ax - t * dx, y - ay - t * dy));
  }
  return best;
}
/** Convex hull (monotone chain): the outline of a block's walls, base and roof together. */
function hull(points: Point[]) {
  const p = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o: Point, a: Point, b: Point) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const half = (list: Point[]) => list.reduce<Point[]>((h, q) => { while (h.length > 1 && cross(h[h.length - 2], h[h.length - 1], q) <= 0) h.pop(); h.push(q); return h; }, []);
  const lower = half(p), upper = half([...p].reverse());
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}
const path = (points: Point[]) => `M${points.map(([x, y]) => `${Math.round(x)},${Math.round(y)}`).join('L')}Z`;

/** The grid's main direction: the Gran Via, which runs along the Eixample's streets. */
function gridAngle() {
  const line = CITY_MAP.avenues.find(a => a.id === 'gran-via')?.line;
  if (!line) return 0;
  const [a, b] = [line[0], line.at(-1)!];
  return Math.atan2(b[1] - a[1], b[0] - a[0]);
}

/** Which district a point belongs to: the one it is in, else the nearest within REACH. */
function districtAt(p: Point) {
  let best: string | undefined, near = REACH;
  for (const d of CITY_MAP.districts) {
    if (inside(p, d.poly)) return d.id;
    const gap = distance(p, d.poly, true);
    if (gap < near) { near = gap; best = d.id; }
  }
  return best;
}

interface Block { y: number; svg: string }

/** The whole background city as SVG, in map metres. `unit` is the map's drawing unit. */
export function renderCityBlocks(unit: number): string {
  const rand = random(35);
  const angle = gridAngle();
  const sea = CITY_MAP.sea, coast = CITY_MAP.coast;
  const avenues = CITY_MAP.avenues.map(a => ({ line: a.line, half: unit * (.7 + a.size * .3) / 2 + 30 }));
  // Open ground round landmarks and the places the story marks: little squares.
  const squares = [...CITY_MAP.landmarks, ...CITY_MAP.places].map(p => [p.x, p.y]);
  const blocked = (p: Point, radius: number) =>
    inside(p, sea) || distance(p, coast) < radius + 60
    || CITY_MAP.hills.some(h => inside(p, h.poly))
    || CITY_MAP.rivers.some(r => distance(p, r.line) < radius + 120)
    || avenues.some(a => distance(p, a.line) < a.half + radius * .75)
    || squares.some(([x, y]) => Math.hypot(p[0] - x, p[1] - y) < 300 + radius * .5);

  const blocks: Block[] = [];
  const parts: string[] = [];
  const { x0, y0, x1, y1 } = CITY_MAP.extent;
  // The outskirts reach past the map's frame: a wide screen shows more than the extent.
  const wide = { x0: x0 - (x1 - x0) * .35, x1: x1 + (x1 - x0) * .35, y0: y0 - 1500, y1: y1 + 1500 };
  const areas = [...CITY_MAP.districts.map(d => ({ id: d.id as string | undefined, poly: d.poly })), { id: undefined, poly: [[wide.x0, wide.y0], [wide.x1, wide.y0], [wide.x1, wide.y1], [wide.x0, wide.y1]] }];
  for (const district of areas) {
    const t = district.id ? TEXTURES[district.id] ?? DEFAULT : OUTSKIRTS;
    const far = district.id ? '' : ' city-far';
    const turn = angle + t.turn * Math.PI / 180, cos = Math.cos(turn), sin = Math.sin(turn);
    const xs = district.poly.map(p => p[0]), ys = district.poly.map(p => p[1]);
    const box = { x0: Math.max(wide.x0, Math.min(...xs) - REACH), x1: Math.min(wide.x1, Math.max(...xs) + REACH), y0: Math.max(wide.y0, Math.min(...ys) - REACH), y1: Math.min(wide.y1, Math.max(...ys) + REACH) };
    // Walk the district's own grid (turned) over its bounding box.
    const cx = (box.x0 + box.x1) / 2, cy = (box.y0 + box.y1) / 2, reach = Math.hypot(box.x1 - box.x0, box.y1 - box.y0) / 2;
    const steps = Math.ceil(reach / t.pitch);
    for (let i = -steps; i <= steps; i++) for (let j = -steps; j <= steps; j++) {
      const u = i * t.pitch, v = j * t.pitch;
      const centre = [cx + u * cos - v * sin, cy + u * sin + v * cos];
      const r1 = rand(), r2 = rand(), r3 = rand(), r4 = rand(), r5 = rand();
      if (centre[0] < box.x0 || centre[0] > box.x1 || centre[1] < box.y0 || centre[1] > box.y1) continue;
      if (districtAt(centre) !== district.id) continue;
      const size = t.pitch * t.fill * (1 - t.jitter * .35 * r1);
      if (blocked(centre, size * .6)) continue;
      const tilt = turn + (r2 - .5) * t.jitter * .5;
      const w = size * (1 + (r3 - .5) * t.jitter * .6), d = size * (1 - (r3 - .5) * t.jitter * .6);
      const c = Math.cos(tilt), s = Math.sin(tilt);
      const at = (a: number, b: number): Point => [centre[0] + a * c - b * s, centre[1] + a * s + b * c];
      const k = t.chamfer ? size * .17 : 0;
      const outline = (hw: number, hd: number, cut: number) => cut
        ? [at(-hw + cut, -hd), at(hw - cut, -hd), at(hw, -hd + cut), at(hw, hd - cut), at(hw - cut, hd), at(-hw + cut, hd), at(-hw, hd - cut), at(-hw, -hd + cut)]
        : [at(-hw, -hd), at(hw, -hd), at(hw, hd), at(-hw, hd)];
      const base = outline(w / 2, d / 2, k);
      if (r4 < t.parks) {
        // A park: a flat green block with a few round trees.
        const trees = [[-.22, -.18], [.2, -.1], [-.05, .22]].map(([a, b]) => at(a * w, b * d));
        blocks.push({ y: centre[1], svg: `<path class="city-park${far}" d="${path(base)}"/>${trees.map(([x, y]) => `<circle class="city-tree" cx="${Math.round(x)}" cy="${Math.round(y - 18)}" r="${Math.round(size * .17)}"/>`).join('')}` });
        continue;
      }
      const h = (t.height[0] + (t.height[1] - t.height[0]) * r5 * r5) * LIFT;
      const roof = base.map(([x, y]) => [x, y - h]);
      const tone = t.chamfer ? 'e' : Math.floor(r1 * 3);
      let svg = `<g class="city-block${far}"><path class="city-wall" d="${path(hull([...base, ...roof]))}"/><path class="city-roof city-roof-${tone}" d="${path(roof)}"/>`;
      // The Eixample's courtyards: a green square in the middle of the roof.
      if (t.chamfer && size > 150) svg += `<path class="city-yard" d="${path(outline(w * .2, d * .2, k * .4).map(([x, y]) => [x, y - h]))}"/>`;
      blocks.push({ y: centre[1], svg: `${svg}</g>` });
    }
  }
  // Trees on the hills, scattered on a loose grid.
  for (const hill of CITY_MAP.hills) {
    const xs = hill.poly.map(p => p[0]), ys = hill.poly.map(p => p[1]);
    for (let x = Math.max(wide.x0, Math.min(...xs)); x < Math.min(wide.x1, Math.max(...xs)); x += 300) for (let y = Math.max(wide.y0, Math.min(...ys)); y < Math.min(wide.y1, Math.max(...ys)); y += 260) {
      const p = [x + (rand() - .5) * 240, y + (rand() - .5) * 200], r = 70 + rand() * 60;
      if (!inside(p, hill.poly) || distance(p, hill.poly, true) < r + 40 || rand() < .25) continue;
      blocks.push({ y: p[1], svg: `<circle class="city-tree-shade" cx="${Math.round(p[0])}" cy="${Math.round(p[1])}" r="${Math.round(r)}"/><circle class="city-tree" cx="${Math.round(p[0] - r * .15)}" cy="${Math.round(p[1] - r * .3)}" r="${Math.round(r * .85)}"/>` });
    }
  }
  // Squares under landmarks and places, then everything far to near so nearer blocks hide farther ones.
  for (const [x, y] of squares) parts.push(`<ellipse class="city-square" cx="${x}" cy="${y + unit * .6}" rx="${unit * 3.2}" ry="${unit * 2.2}"/>`);
  blocks.sort((a, b) => a.y - b.y);
  return `<g class="city-blocks" stroke-width="${(unit * .1).toFixed(1)}">${parts.join('')}${blocks.map(b => b.svg).join('')}</g>`;
}
