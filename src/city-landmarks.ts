/**
 * The famous places on the 3D network map (src/city-3d.ts) as little models standing in the city,
 * in the castle's style: plain volumes, each face lit from the front left, the icons' colours
 * (src/map-markers.ts `ICONS`), much bigger than life so they read from the whole city. Each
 * model clears the real buildings round it (`clear`, metres) so it stands on open ground.
 * Map metres: x right along the coast, z down towards the sea, y up; the camera starts on the sea
 * side, so a model's front faces +z.
 * Pure: it writes triangles into any `Sink` (city-3d.ts's Geometry), no DOM, no GPU.
 */

/** Where the triangles go: vertices with a colour and a shade (1 = as is), and triangles or quads of them. */
export interface Sink {
  reserve(vertices: number, indices: number): void;
  vertex(x: number, y: number, z: number, colour: number[], shade?: number, alpha?: number): number;
  tri(a: number, b: number, c: number): void;
  quad(a: number, b: number, c: number, d: number): void;
}

type V3 = [number, number, number];
const rgb = (hex: string) => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];

/** Light from the front left and above, as on the blocks: tops brightest, undersides darkest. */
export function shadeOf([nx, ny, nz]: V3) {
  if (ny > .55) return 1.1;
  if (ny < -.55) return .5;
  return .62 + .34 * Math.max(0, -nx * .8 + nz * .6) + ny * .2;
}

/** One flat face (3 or more points, in order), shaded by its normal turned away from `centre`. */
function face(g: Sink, pts: V3[], colour: number[], centre: V3) {
  // Newell's normal: sound even when two points meet (the tip of a cone).
  let nx = 0, ny = 0, nz = 0;
  for (let i = 0; i < pts.length; i++) {
    const [ax, ay, az] = pts[i], [bx, by, bz] = pts[(i + 1) % pts.length];
    nx += (ay - by) * (az + bz); ny += (az - bz) * (ax + bx); nz += (ax - bx) * (ay + by);
  }
  const len = Math.hypot(nx, ny, nz) || 1, m = pts.reduce((s, p) => [s[0] + p[0] / pts.length, s[1] + p[1] / pts.length, s[2] + p[2] / pts.length], [0, 0, 0]);
  const out = (m[0] - centre[0]) * nx + (m[1] - centre[1]) * ny + (m[2] - centre[2]) * nz < 0 ? -1 : 1;
  const shade = shadeOf([nx / len * out, ny / len * out, nz / len * out]);
  g.reserve(pts.length, (pts.length - 2) * 3);
  const ids = pts.map(p => g.vertex(p[0], p[1], p[2], colour, shade));
  for (let i = 1; i + 1 < ids.length; i++) g.tri(ids[0], ids[i], ids[i + 1]);
}

interface PrismOptions {
  /** Radii across (x) and deep (z); `rz` defaults to `rx`. */
  rx: number; rz?: number;
  /** Bottom and height. */
  y0?: number; h: number;
  /** The top's size as a share of the bottom's: 0 is a cone, more than 1 opens like a bowl. */
  top?: number;
  sides?: number;
  /** Turned this much round the vertical (radians). */
  rot?: number;
  /** The walls' colour, or one per side in turn (stripes). */
  colour: string | string[];
  /** The top's colour; none leaves it open. */
  cap?: string | false;
}
/** An upright prism, cylinder, cone, frustum or bowl round (x, z). */
export function prism(g: Sink, x: number, z: number, o: PrismOptions) {
  const { rx, rz = rx, y0 = 0, h, top = 1, sides = 12, rot = 0 } = o;
  const colours = (Array.isArray(o.colour) ? o.colour : [o.colour]).map(rgb);
  const ring = (k: number, y: number, s: number): V3 => { const a = rot + k / sides * Math.PI * 2; return [x + Math.cos(a) * rx * s, y, z + Math.sin(a) * rz * s]; };
  const centre: V3 = [x, y0 + h / 2, z];
  for (let k = 0; k < sides; k++) {
    const pts = top > 0 ? [ring(k, y0, 1), ring(k + 1, y0, 1), ring(k + 1, y0 + h, top), ring(k, y0 + h, top)] : [ring(k, y0, 1), ring(k + 1, y0, 1), [x, y0 + h, z] as V3];
    face(g, pts, colours[k % colours.length], centre);
  }
  if (top > 0 && o.cap !== false) face(g, Array.from({ length: sides }, (_, k) => ring(k, y0 + h, top)), rgb(o.cap ?? (Array.isArray(o.colour) ? o.colour[0] : o.colour)), [x, y0, z]);
}

/** A box centred at `c`, `size` across, high and deep: rolled round z, tipped `pitch` round x, then turned `yaw` round the vertical. */
export function box(g: Sink, c: V3, size: V3, colour: string, yaw = 0, pitch = 0, roll = 0) {
  const [hx, hy, hz] = size.map(s => s / 2), cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch), cr = Math.cos(roll), sr = Math.sin(roll);
  const at = (a0: number, b0: number, d: number): V3 => {
    const a = a0 * cr - b0 * sr, b = a0 * sr + b0 * cr;
    const y = b * cp - d * sp, z = b * sp + d * cp;
    return [c[0] + a * cy + z * sy, c[1] + y, c[2] - a * sy + z * cy];
  };
  const p = [-1, 1].flatMap(a => [-1, 1].flatMap(b => [-1, 1].map(d => at(a * hx, b * hy, d * hz))));
  // Corners indexed a*4 + b*2 + d (0 = minus side, 1 = plus side).
  const col = rgb(colour);
  for (const q of [[0, 1, 3, 2], [4, 6, 7, 5], [0, 4, 5, 1], [2, 3, 7, 6], [0, 2, 6, 4], [1, 5, 7, 3]]) face(g, q.map(i => p[i]), col, c);
}

/** A dome of `r` on a drum at height y0, its top at y0 + r·squash. */
function dome(g: Sink, x: number, z: number, y0: number, r: number, colour: string, squash = 1, sides = 14, rings = 5) {
  for (let k = 0; k < rings; k++) {
    const a0 = k / rings * Math.PI / 2, a1 = (k + 1) / rings * Math.PI / 2;
    prism(g, x, z, { rx: r * Math.cos(a0), y0: y0 + r * squash * Math.sin(a0), h: r * squash * (Math.sin(a1) - Math.sin(a0)), top: Math.cos(a1) / Math.cos(a0), sides, colour, cap: false });
  }
}

const INK = '#3b2a20';

/** How each icon stands in the city: how far it clears the blocks, how high its top is (for its name card), and how it is built. */
export interface LandmarkModel { clear: number; top: number; build(g: Sink, x: number, z: number): void }

/** A spire of the Sagrada Família: a long cone on a short shaft, a coloured fruit on top. */
function spire(g: Sink, x: number, z: number, r: number, h: number, fruit: string) {
  prism(g, x, z, { rx: r, h: h * .55, sides: 8, colour: STONE });
  prism(g, x, z, { rx: r, y0: h * .55, h: h * .45, top: 0, sides: 8, colour: STONE });
  box(g, [x, h + r * .5, z], [r * 1.3, r * 1.3, r * 1.3], fruit, .6, .6);
}
/** The Sagrada Família's sandstone, warmer than any block round it. */
const STONE = '#e0a862';

/** Every model is drawn this many times its size, so it reads from the whole city. */
export const LANDMARK_SCALE = 1.35;

export const LANDMARK_MODELS: Record<string, LandmarkModel> = {
  /** Sagrada Família: the naves, eight bell towers on its two façades, the four Evangelists and Jesus in the middle. */
  temple: {
    clear: 170, top: 470,
    build(g, x, z) {
      box(g, [x, 55, z], [260, 110, 150], '#d39a58');
      prism(g, x, z, { rx: 75, rz: 55, y0: 110, h: 40, top: .8, sides: 10, colour: '#c98d4c' });
      const fruits = ['#ef6b5f', '#ffd257', '#8fc46a', '#5aa8e0'];
      for (let i = 0; i < 4; i++) for (const side of [-1, 1]) spire(g, x + (i - 1.5) * 42, z + side * 85, 13, 260 + (i === 1 || i === 2 ? 40 : 0), fruits[(i + (side > 0 ? 0 : 2)) % 4]);
      for (let i = 0; i < 4; i++) spire(g, x + Math.cos(i * Math.PI / 2 + .78) * 45, z + Math.sin(i * Math.PI / 2 + .78) * 35, 16, 360, fruits[i]);
      spire(g, x, z, 22, 450, '#fff4c8');
    },
  },
  /** Torre Glòries: a rounded bullet of blue glass dotted with coloured windows. */
  tower: {
    clear: 90, top: 440,
    build(g, x, z) {
      prism(g, x, z, { rx: 62, h: 300, sides: 16, colour: '#5aa0dc', cap: false });
      dome(g, x, z, 300, 62, '#5aa0dc', 2.1, 16, 6);
      const colours = ['#ef6b5f', '#ffd257', '#9fdcf0'];
      for (let i = 0; i < 26; i++) {
        const a = Math.PI * (.1 + (i * .61803 % 1) * .9), y = 30 + (i * 37 % 260);
        box(g, [x + Math.cos(a) * 63, y, z + Math.sin(a) * 63], [16, 24, 3], colours[i % 3], -a + Math.PI / 2);
      }
    },
  },
  /** Park Güell: a green hill crossed by the mosaic bench, the gatehouse with its frosted roof. */
  park: {
    clear: 260, top: 250,
    build(g, x, z) {
      dome(g, x, z, 0, 260, '#86c260', .5, 16, 4);
      for (let i = 0; i < 18; i++) {
        const t = i / 17, bx = x - 200 + t * 400, bz = z + 40 + Math.sin(t * Math.PI * 3) * 50;
        const ground = 130 * Math.sqrt(Math.max(0, 1 - ((bx - x) ** 2 + (bz - z) ** 2) / 260 ** 2));
        box(g, [bx, ground + 8, bz], [26, 20, 18], i % 2 ? '#ffd257' : '#5aa8e0', Math.cos(t * Math.PI * 3) * .8);
      }
      // The gatehouse on the hill's flank (the ground there is ~88 m up).
      box(g, [x - 150, 125, z + 120], [60, 90, 60], '#e9b88a');
      prism(g, x - 150, z + 120, { rx: 48, y0: 170, h: 60, top: 0, sides: 10, colour: '#fff4e0' });
      box(g, [x - 150, 237, z + 120], [14, 14, 14], '#ef6b5f', .6, .6);
    },
  },
  /** Tibidabo: the Ferris wheel and its coloured cabins on the hilltop, the church's spire behind it. */
  wheel: {
    clear: 150, top: 420,
    build(g, x, z) {
      box(g, [x + 90, 120, z - 60], [70, 240, 70], '#e2d4b2');
      prism(g, x + 90, z - 60, { rx: 40, y0: 240, h: 110, top: 0, sides: 8, colour: '#ead2a0' });
      const cy = 210, r = 150, cabins = ['#ef6b5f', '#ffd257', '#5aa8e0', '#8fc46a'];
      // The A-frame legs, then the rim and its spokes, each segment turned along the circle.
      for (const side of [-1, 1]) box(g, [x + side * 40, cy / 2, z - 10], [14, cy * 1.08, 14], '#d9473f', 0, 0, side * .2), box(g, [x + side * 40, cy / 2, z + 10], [14, cy * 1.08, 14], '#d9473f', 0, 0, side * .2);
      const segments = 28;
      for (let i = 0; i < segments; i++) {
        const a = (i + .5) / segments * Math.PI * 2;
        box(g, [x + Math.cos(a) * r, cy + Math.sin(a) * r, z], [r * Math.PI * 2 / segments + 2, 9, 9], '#fff4e0', 0, 0, a + Math.PI / 2);
      }
      for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; box(g, [x + Math.cos(a) * r / 2, cy + Math.sin(a) * r / 2, z], [r, 4, 4], '#fff4e0', 0, 0, a); }
      for (let i = 0; i < 8; i++) { const a = (i + .5) / 8 * Math.PI * 2; box(g, [x + Math.cos(a) * r, cy + Math.sin(a) * r - 20, z], [30, 30, 30], cabins[i % 4]); }
      box(g, [x, cy, z], [24, 24, 24], '#fff4e0');
    },
  },
  /** Montjuïc: the low star fort, bastions at its corners, a flag over the keep. */
  castle: {
    clear: 200, top: 300,
    build(g, x, z) {
      box(g, [x, 35, z], [300, 70, 240], '#c9bba2');
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(g, [x + sx * 150, 45, z + sz * 120], [80, 90, 80], '#ddd2bd', .78);
      box(g, [x, 100, z], [120, 60, 90], '#ddd2bd');
      box(g, [x + 30, 200, z], [6, 140, 6], INK);
      box(g, [x + 68, 245, z], [70, 46, 4], '#ffd257');
      for (const dy of [-12, 0, 12]) box(g, [x + 68, 245 + dy, z + 2.5], [70, 5, 1], '#d9473f');
    },
  },
  /** Camp Nou: a bowl striped in blue and claret round a green pitch. */
  stadium: {
    clear: 230, top: 110,
    build(g, x, z) {
      prism(g, x, z, { rx: 240, rz: 175, h: 90, sides: 24, colour: ['#2f5aa8', '#a8324a'], cap: false });
      prism(g, x, z, { rx: 140, rz: 90, y0: 20, h: 70, top: 240 / 140, sides: 24, colour: '#a8324a', cap: false });
      prism(g, x, z, { rx: 140, rz: 90, h: 20, sides: 24, colour: '#5f9a4a', cap: '#6fbf5a' });
      prism(g, x, z, { rx: 240, rz: 175, y0: 90, h: 4, sides: 24, colour: '#f2efe6', top: 1, cap: false });
    },
  },
  /** Barceloneta: the sail-shaped hotel at the end of the beach, striped parasols on the sand. */
  beach: {
    clear: 140, top: 360,
    build(g, x, z) {
      for (let i = 0; i < 7; i++) {
        const t = i / 6;
        box(g, [x + 60 - t * t * 70, 25 + i * 45, z - 30], [140 - t * 90, 46, 34 - t * 10], i % 2 ? '#bfe3f2' : '#a9d3e8', -.3);
      }
      for (const [dx, dz, c] of [[110, 10, '#ef6b5f'], [160, 40, '#ffd257'], [205, 5, '#5aa8e0']] as const) {
        box(g, [x + dx, 30, z + dz], [5, 60, 5], '#fff4e0');
        prism(g, x + dx, z + dz, { rx: 36, y0: 52, h: 22, top: 0, sides: 8, colour: [c, '#fff4e0'] });
      }
    },
  },
  /** Fòrum: the great solar pergola, a blue panel tilted to the sun on its slanted legs. */
  pergola: {
    clear: 180, top: 260,
    build(g, x, z) {
      for (const side of [-1, 1]) box(g, [x + side * 70, 80, z + side * 15], [24, 160, 24], '#e5ddd0', 0, side * .12);
      box(g, [x, 185, z], [300, 12, 200], '#3f6fb0', -.15, .42);
      for (let i = -2; i <= 2; i++) box(g, [x + i * 55, 192, z + 2], [3, 4, 196], '#8fb8e8', -.15, .42);
    },
  },
  /** Arc de Triomf: a brick arch with depth, its crown in gold. */
  arch: {
    clear: 80, top: 230,
    build(g, x, z) {
      for (const side of [-1, 1]) box(g, [x + side * 60, 90, z], [55, 180, 60], '#c96b4a');
      box(g, [x, 160, z], [175, 50, 60], '#c96b4a');
      box(g, [x, 195, z], [185, 20, 66], '#e9c35a');
      box(g, [x, 130, z + 31], [70, 6, 2], '#e9c35a');
    },
  },
  /** Sant Pau: a brick pavilion under a tiled green dome with a little gold spire. */
  dome: {
    clear: 140, top: 270,
    build(g, x, z) {
      box(g, [x, 50, z], [220, 100, 140], '#e98f5a');
      for (const side of [-1, 1]) box(g, [x + side * 120, 70, z + 40], [50, 140, 50], '#e98f5a'), prism(g, x + side * 120, z + 40, { rx: 30, y0: 140, h: 40, top: 0, sides: 4, rot: Math.PI / 4, colour: '#5fa6a0' });
      prism(g, x, z, { rx: 66, y0: 100, h: 30, sides: 14, colour: '#e98f5a' });
      dome(g, x, z, 130, 66, '#5fa6a0', 1.1);
      box(g, [x, 230, z], [6, 70, 6], '#e9c35a');
      box(g, [x, 268, z], [16, 16, 16], '#e9c35a', .6, .6);
    },
  },
  /** Plaça d'Espanya: the two Venetian towers, brick shafts under stone belfries and pointed roofs. */
  venetian: {
    clear: 140, top: 400,
    build(g, x, z) {
      box(g, [x, 6, z], [340, 12, 120], '#e2d4b2');
      for (const side of [-1, 1]) {
        const tx = x + side * 100;
        box(g, [tx, 130, z], [46, 260, 46], '#c96b4a');
        box(g, [tx, 285, z], [56, 50, 56], '#ead2a0');
        box(g, [tx, 285, z + 28.5], [18, 30, 1], INK);
        prism(g, tx, z, { rx: 40, y0: 310, h: 90, top: 0, sides: 4, rot: Math.PI / 4, colour: '#c96b4a' });
      }
    },
  },
  /** Búnkers del Carmel: the dry hilltop and its round concrete gun pits. */
  bunker: {
    clear: 200, top: 190,
    build(g, x, z) {
      dome(g, x, z, 0, 230, '#c8b47c', .6, 16, 4);
      for (const [dx, dz, r] of [[-60, 10, 48], [70, 50, 40], [0, -70, 34]]) {
        const ground = 138 * Math.sqrt(Math.max(0, 1 - (dx * dx + dz * dz) / 230 ** 2));
        prism(g, x + dx, z + dz, { rx: r, y0: ground - 6, h: 22, sides: 14, colour: '#dedad0', cap: '#6f6658' });
      }
    },
  },
  /** Home: a little yellow house under a red roof. */
  home: {
    clear: 60, top: 170,
    build(g, x, z) {
      box(g, [x, 45, z], [100, 90, 90], '#f7d26a');
      prism(g, x, z, { rx: 78, y0: 90, h: 60, top: 0, sides: 4, rot: Math.PI / 4, colour: '#d9473f' });
      box(g, [x - 20, 25, z + 45.5], [24, 50, 1], INK);
    },
  },
  /** The Rec Comtal school before the castle: a white block under an orange roof, a flag on top. */
  school: {
    clear: 110, top: 260,
    build(g, x, z) {
      box(g, [x, 55, z], [220, 110, 130], '#f2efe6');
      prism(g, x, z, { rx: 140, rz: 95, y0: 110, h: 60, top: 0, sides: 4, rot: Math.PI / 4, colour: '#e8742c' });
      box(g, [x, 200, z], [5, 80, 5], INK);
      box(g, [x + 24, 225, z], [44, 28, 3], '#e8742c');
    },
  },
};
