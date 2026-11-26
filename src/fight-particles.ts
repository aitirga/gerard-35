import * as pc from 'playcanvas';
import { SURFACE_SAMPLES, writeSurface } from './surface-samples.ts';
import { FILM_COL, HIT_SAMPLES, LATTICE_COLS, LATTICE_DISSOLVES, LATTICE_SHAPES, LOOK_COL, MAX_PULSES, MAX_RIPPLES, RIPPLE_COL, RUPTURE_COL, SNAP_COL, TRAVEL_COL, packColour, MAX_AIMS, MAX_LATTICES, MAX_MEMBERS, latticeReach, latticeRippleWgsl, latticeSpacing, latticeWgsl, stringReflections, type LatticeDissolve, type LatticeShape, type Vec3Like } from './lattice.ts';

/**
 * A general particle engine on the GPU, for fights (docs/graphics.md, "Fight particles on the GPU").
 *
 * State lives in a float texture of seven bands of rows, ping-ponged by one full-screen pass a frame
 * on WebGPU (WGSL):
 *   A position + age · B velocity + life · C kind, seed, the part it clings to, size ·
 *   D when it lets go + its colour tint · E the particle it follows, where it sits in its chain, its batch ·
 *   F where it was born · G where it was a moment after (`REWIND`): the two its `rewind` plays it back through.
 * The CPU keeps a ring of slots and sends batches to spawn (`burst`, `emitter`); everything else
 * happens on the GPU:
 * - spawning in a ball, on a ring, along a line, on a fighter's real surface (points on its
 *   triangles, bent by its bones: src/surface-samples.ts), or its parts' boxes if it has none, or on a
 *   cloud of points the CPU gives (`points`: any model's surface, sampled the same way);
 * - played back (`rewind`): a batch runs its own path backwards to where it was born, and becomes another kind;
 * - motion: gravity or buoyancy, drag, a divergence-free turbulent flow and force `field`s
 *   (swirl round any axis, pull, lift) that can follow a fighter;
 * - particles that see each other: siblings from the same batch flock (separation, cohesion,
 *   alignment) and a few random neighbours a frame push apart or draw together;
 * - chains: a batch can be cut into chains whose followers trail their leader, drawn as strands;
 * - meeting the fighters: every part of every fighter is an oriented box from its own transform,
 *   so particles bounce off it, slide along it or cling to it and ride along, and the floor (a
 *   heightmap) catches the rest;
 * - turning into another kind when they land or die (an ember into ash, a drop into a splash).
 * One instanced draw reads the state back: glows, streaks, flame tongues, smoke, crisp lines,
 * shards, rings, stars, dots, strands and sparks (thin streaks white-hot at the head, cooling down
 * the tail), coloured white-hot → mid → end over their lives.
 */

export type GpuShape = 'glow' | 'streak' | 'flame' | 'smoke' | 'line' | 'shard' | 'ring' | 'star' | 'dot' | 'strand' | 'spark' | 'powder' | 'pool';
const SHAPES: Record<GpuShape, number> = { glow: 0, streak: 1, flame: 2, smoke: 3, line: 4, shard: 5, ring: 6, star: 7, dot: 8, strand: 9, spark: 10, powder: 11, pool: 12 };

/** How a kind of particle moves and looks; everything but `colours` and `shape` has a default. Colours are sRGB hex, × `intensity`. */
export interface GpuKind {
  shape: GpuShape;
  colours: readonly [string, string, string];
  /** Brightness of each colour stop (past 1 it blooms) and when the middle one shows (fraction of life). */
  intensity?: readonly [number, number, number]; middle?: number;
  /** 1/s; m/s² down (negative rises); m/s of turbulence; how much force fields move it. */
  drag?: number; gravity?: number; curl?: number; response?: number;
  /** Meets fighters and the floor; keeps this much of its speed off a surface; loses this much sliding. */
  collide?: boolean; bounce?: number; friction?: number;
  /** Chance a frame to cling to a fighter it touches, and about how long it stays; settles on the floor. */
  stick?: number; stickTime?: number; settle?: boolean;
  /** Half-size at birth and at death (m) and how much each particle's size varies (0–1). */
  size: readonly [number, number]; sizeJitter?: number;
  /** Streak length per m/s for lines, streaks and shards; how wide a line is against its length. */
  stretch?: number; aspect?: number;
  /** Degrees a second it turns (each particle either way, up to this). */
  spin?: number;
  fadeIn?: number; fadeOut?: number;
  /**
   * How out of focus it is (0 crisp, 1 very soft, up to 2): one value, or at birth and at death so it
   * blurs as it fades (smoke spreading, a spark cooling into a smudge of light). Soft particles cost
   * five lookups a pixel instead of one.
   */
  blur?: number | readonly [number, number];
  /** 0 covers what is behind, 1 only adds light; 0–1 overall; 0–1 twinkle. */
  additive?: number; opacity?: number; flicker?: number;
  /**
   * Seeing each other, within `radius` metres: how hard it keeps away from neighbours (m/s²),
   * moves towards its siblings' middle and matches their velocity (1/s).
   */
  separation?: number; cohesion?: number; alignment?: number; radius?: number;
  /** In a chain, how quickly a follower catches its leader up (1/s). */
  follow?: number;
  /**
   * Glass (0–1): see-through in its middle, bright at its edge, with a glint up on its left, like a bead
   * of glass or a soap bubble; 1 leaves little but its rim and the glint.
   */
  glass?: number;
  /** How white-hot its middle is (0–1, 1 by default): 0 keeps it its own colour all through, for specks too small to have a core. */
  core?: number;
  /** Lies on the floor instead of facing the camera (a stain, a pool): for kinds that land and stay. */
  flat?: boolean;
  /** Becomes this kind when it first lands on the floor, or when it dies; its own life when it becomes one. */
  onLand?: string; onDeath?: string; life?: readonly [number, number];
  /**
   * A fluid (src/fight-particles.ts § The fluid): its particles feel each other through a grid. They are
   * pushed down the density (`pressure`, m/s² at twice their rest packing), so a body of them keeps its
   * volume, falls as a mass and spreads when it lands; they move with the flow round them (`viscosity`,
   * 1/s), so it moves as one; `rest` is how many to a 20 cm cell before they push (6 by default).
   */
  fluid?: { pressure: number; viscosity?: number; rest?: number };
  /** Bounces off `mirror` volumes, losing nothing: only the kinds that say so see a mirror at all. */
  mirror?: boolean;
  /**
   * A bubble in a fluid: where the fluid's grid is packed (any fluid, as packed as a cell of 6 at full)
   * it rises by `lift` m/s² and is carried by the flow there (`flow`, 1/s). Out of the fluid it keeps to
   * its own gravity and drag (a slow drift); while no fluid is out it never looks.
   */
  bubble?: { lift: number; flow?: number };
  /**
   * Catches fire: within `radius` metres (0.2 by default) of a burning particle (a kind with `burns`), or
   * of a point lit with `ignite(at, radius)`, it becomes `into` after about `delay` seconds (0.05 by
   * default, ±40 % each). Each frame it looks at four particles near it on the ring (its batch: a cloud
   * spawned at once lies on consecutive slots) and two anywhere, so a cloud burns from where it was lit
   * outwards, a deflagration front, at about `radius / delay` m/s.
   */
  ignite?: { into: string; delay?: number; radius?: number };
  /** Sets alight what can catch (`ignite`). True by default for any kind that some kind catches `into`. */
  burns?: boolean;
}

/**
 * A motion law particles follow in a space of its own (`law`, `GpuBurst.law`): the first fields that are
 * not a push or a pull. Every field can change from frame to frame (ρ for a bifurcation, `at` to move it).
 * - `lorenz`: the Lorenz field, `params` [σ, ρ, β, speed] (speed: its time units a second). Its point
 *   (X, Y, Z) stands at `at` + (X, Z, Y) × `scale` in the law's own axes, so its two lobes stand side by
 *   side along x and up y (0.05 m a unit makes the butterfly about 2.5 m tall at ρ 28). Below ρ = 1 the
 *   origin (`at`) is all that is left: what follows it spirals into it (faster with a higher speed).
 *   Integrated by RK2; each particle turns towards the field's velocity at `grip` (1/s).
 * - `galton`: a Galton board standing in the law's x–y plane, its top peg at `at`; `params` [rows, row gap
 *   (m), peg gap (m), fall (m/s²)]. Each particle falls straight onto the top peg, and at every row is
 *   knocked half a peg gap left or right by one bit of its burst's `path` (`galtonPath`; random bits
 *   without one, so many fall in a bell), hopping up by `bounce` of its speed (a quarter of a row at most), flashing by `spark` (its
 *   brightness × 1 + spark, fading); past the last row it falls straight. Give its kinds gravity 0: the
 *   law falls them itself, along the board's own down. `spread` (m) keeps a ball's particles that far apart.
 *   Drop them at least half a row gap over the top peg, or they start past it.
 */
export type GpuLawName = 'lorenz' | 'galton';
export interface GpuLaw {
  readonly law: GpuLawName;
  /** Its origin and axes (or the node it `follow`s). */
  readonly at: pc.Vec3; readonly rotation: pc.Quat; follow?: pc.GraphNode;
  params: [number, number, number, number];
  /** Lorenz: metres a unit of its space. */
  scale: number;
  /** Lorenz: how quickly a particle turns to the field's velocity (1/s). Any law: the fastest it lets them go (m/s). */
  grip: number; maxSpeed: number;
  /** Galton: the hop off each peg (share of the speed it met it at), the flash, how far apart a ball's particles keep (m). */
  bounce: number; spark: number; spread: number;
  readonly alive: boolean;
  /** Gone: its particles go on as their kinds would. */
  remove(): void;
}

export interface GpuBurst {
  at: { x: number; y: number; z: number };
  count: number;
  /**
   * `ball` fills a sphere of `spread`; `ring` a circle of `spread` round `axis`; `line` from `at` to `to`; `surface` a fighter's
   * parts; `points` the points given (`points`, each particle the next of them, `spread` round it).
   */
  shape?: 'ball' | 'ring' | 'line' | 'surface' | 'points';
  spread?: number;
  /** The ring's axis (up by default). */
  axis?: { x: number; y: number; z: number };
  to?: { x: number; y: number; z: number };
  /** Which fighter (`setFighters` order) for `surface`; its parts above this fraction of its height only. */
  fighter?: number; above?: number;
  /**
   * `surface` only: born within this band of the fighter's height (0 its lowest point, 1 its highest),
   * as a front eating it from the feet up leaves it (src/disintegrate.ts).
   */
  band?: readonly [number, number];
  /** `surface` only: takes this much (0–1) of the colour of the part it is born on, the rest from `colour`. */
  fromPart?: number;
  /**
   * Base velocity plus a kick of up to `speed` m/s any way; with a `cone` (radians) its direction is
   * instead spread within that cone round `velocity`, at its speed ± `speed`. Then off the surface by
   * `outward` and up by `up`.
   */
  velocity?: { x: number; y: number; z: number }; speed?: number; cone?: number; outward?: number; up?: number;
  /** Ring only: m/s round the axis, so a ring spins as it spreads. */
  around?: number;
  life: readonly [number, number];
  size?: number;
  /** Tints the kind's colours (sRGB hex): one kind in any colour. */
  colour?: string;
  /** Cuts the batch into chains of this many: the first leads, the rest trail it (draw them as `strand`). */
  chain?: number;
  /**
   * Its particles light what is around them: a real light follows their cloud (its brightness-
   * weighted middle), in their colour (or `colour`), fading as they do. `intensity` at their
   * brightest, `range` metres.
   */
  light?: { intensity: number; range: number; colour?: string };
  /** Its particles follow this law (`law`) while it lives, whatever their kind (not a lattice's). */
  law?: GpuLaw;
  /**
   * `points` only: where its particles are born, in the world, up to MAX_CLOUD_POINTS (a model's surface as
   * `writeSurface` gives it: a cat's silhouette standing where she sat). Up to MAX_CLOUDS such bursts a frame.
   */
  points?: readonly Vec3Like[];
  /**
   * A path through a `galton` law: one bit a row, 1 knocks it right (`galtonPath` makes one that ends in a
   * bin). Every particle of the burst takes it; without one each draws its own at random.
   */
  path?: number;
}

// ── What the laws draw, worked out on the CPU once (the figures drawn over them, the rule's choices) ──

/** A path through a Galton board of `rows` that ends in `bin` (0 the far left … `rows`): `bin` right turns among its rows, in a random order. */
export function galtonPath(bin: number, rows: number, random: () => number = Math.random) {
  const n = Math.max(0, Math.min(16, Math.round(rows))), right = Math.max(0, Math.min(n, Math.round(bin)));
  const order = [...Array(n).keys()];
  for (let i = n - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
  return order.slice(0, right).reduce((bits, row) => bits | (1 << row), 0);
}
/** The bin a path ends in: how many of its first `rows` turns go right. */
export function galtonBin(path: number, rows: number) {
  let bin = 0;
  for (let r = 0; r < Math.min(16, rows); r++) bin += (path >> r) & 1;
  return bin;
}
/** Where a bin lies across the board (its own x, metres from the top peg). */
export const galtonBinX = (bin: number, rows: number, pegGap: number) => (bin - rows / 2) * pegGap;
/** The board's pegs in its own space (metres; the top one at the origin, rows going down y): row r has r + 1. */
export function galtonPegs(rows: number, rowGap: number, pegGap: number) {
  const pegs: { x: number; y: number; row: number }[] = [];
  for (let r = 0; r < rows; r++) for (let i = 0; i <= r; i++) pegs.push({ x: (i - r / 2) * pegGap, y: -r * rowGap, row: r });
  return pegs;
}
/**
 * When a ball born at rest `drop` metres over the top peg meets each row and then the bin line (`rows` + 1
 * times, seconds after it is born), for timing what goes with it (a peg's flash, a tick).
 */
export function galtonTimes(o: { rows: number; rowGap: number; fall: number; bounce: number; drop: number }) {
  const times: number[] = [];
  let t = Math.sqrt(2 * Math.max(0, o.drop) / o.fall), speed = o.fall * t;
  for (let r = 0; r <= o.rows; r++) {
    times.push(t);
    if (r === o.rows) break;
    const up = o.bounce * speed;
    t += (up + Math.sqrt(up * up + 2 * o.fall * o.rowGap)) / o.fall;
    speed = Math.sqrt(up * up + 2 * o.fall * o.rowGap);
  }
  return times;
}
/**
 * `count` points along a Lorenz orbit (RK4, `step` of its time apart), in a `lorenz` law's own space as the
 * GPU lays it out: (X, Y, Z) is (X, Z, Y) × `scale` metres. Starts off its unstable middle and lets the
 * orbit settle onto the attractor first. About 0.2 ms for 1 800 points.
 */
export function lorenzPoints(count: number, o: { sigma?: number; rho?: number; beta?: number; scale?: number; step?: number; settle?: number } = {}) {
  const s = o.sigma ?? 10, r = o.rho ?? 28, b = o.beta ?? 8 / 3, k = o.scale ?? .05, h = o.step ?? .01;
  const f = (x: number, y: number, z: number) => [s * (y - x), x * (r - z) - y, x * y - b * z];
  let p = [1, 1, 1];
  const advance = () => {
    const [x, y, z] = p;
    const a = f(x, y, z), c = f(x + a[0] * h / 2, y + a[1] * h / 2, z + a[2] * h / 2);
    const d = f(x + c[0] * h / 2, y + c[1] * h / 2, z + c[2] * h / 2), e = f(x + d[0] * h, y + d[1] * h, z + d[2] * h);
    p = p.map((v, i) => v + (a[i] + 2 * c[i] + 2 * d[i] + e[i]) * h / 6);
  };
  for (let i = 0; i < (o.settle ?? 300); i++) advance();
  const points: { x: number; y: number; z: number }[] = [];
  for (let i = 0; i < count; i++) { points.push({ x: p[0] * k, y: p[2] * k, z: p[1] * k }); advance(); }
  return points;
}

/** A shape particles meet (a crystal), placed by `at` and `rotation` or by the node it `follow`s. */
export interface GpuVolume {
  readonly at: pc.Vec3; readonly rotation: pc.Quat;
  /**
   * `sphere` (radius `size.x`), `box` (half-sizes), `crystal` (a double pyramid: half-width,
   * half-height, half-depth) or `quartz` (a hexagonal prism pointed at both ends: apothem, half the
   * prism's length, each point's length) or `paraboloid` (a dish opening up its y axis from its vertex at
   * `at`: focal length, rim radius, thickness; its focus `size.x` above the vertex).
   */
  shape: 'sphere' | 'box' | 'crystal' | 'quartz' | 'paraboloid'; readonly size: pc.Vec3;
  /**
   * `contain` keeps what is inside in (and what is outside out), bouncing; `solid` is bounced off;
   * `orbit` draws them onto a shell `distance` from its surface and swirls them round it; `attract`
   * pulls them in to settle on it and slide. `range`: how far past its surface it pulls (m).
   * `mirror` reflects what crosses its surface, losing nothing (a paraboloid sends what falls along its
   * axis through its focus), and only for kinds with `mirror`.
   */
  mode: 'contain' | 'solid' | 'orbit' | 'attract' | 'mirror'; strength: number; swirl: number; bounce: number; range: number; distance: number;
  /** The kinds it affects (all by default; up to four). */
  kinds?: readonly string[];
  follow?: pc.GraphNode;
  remove(): void;
}

export interface GpuField {
  readonly at: pc.Vec3;
  /** The axis it swirls round and lifts along (normalised for you). */
  readonly axis: pc.Vec3;
  radius: number;
  /** m/s² round its axis, towards its middle (negative pushes away), along its axis; extra turbulence. */
  swirl: number; pull: number; lift: number; turbulence: number;
  /** A model it follows each frame, `offset` above its origin. */
  follow?: pc.Entity; offset?: { x: number; y: number; z: number };
  remove(): void;
}

/** The slots a burst took on the GPU's ring: hand it to `lattice.hitBy` to throw it at a lattice. */
export interface GpuBatch { readonly start: number; readonly count: number }

/**
 * A lattice (src/lattice.ts): a shape made of particles that holds together. Every member is drawn to
 * its home (`rigidity`) and to its grid neighbours at the distance their homes keep (`bonds`), so a
 * push, a force field, a fighter or particles thrown at it (`hitBy`) bend it and it springs back,
 * keeping its structure; moving, turning or reshaping it (`morph`, `flow`, `wave`) carries its members
 * along. A bond stretched past `toughness` snaps: the member breaks loose (as `breakInto`), and the
 * strain passes to its neighbours, so cracks spread. `reform` draws loose members home to bond again.
 * Every field can change from frame to frame.
 */
export interface GpuLattice {
  /** Where it is and how it is turned (or the node it `follow`s). */
  readonly at: pc.Vec3; readonly rotation: pc.Quat; follow?: pc.GraphNode;
  /** Cells along x, y and z (one member each) and its half-size (a ring: radius, tube half-height, tube half-width). */
  readonly grid: readonly [number, number, number]; readonly size: pc.Vec3;
  /** Its shape, the one it blends towards and how far (0–1): blending keeps every member's neighbours. */
  shape: LatticeShape; morphTo: LatticeShape; morph: number;
  /** 1/s²: pull home, pull to neighbours; 1/s: damping towards its own motion, towards its neighbours' (viscosity). */
  rigidity: number; bonds: number; damping: number; viscosity: number;
  /** How far a bond stretches before it snaps (0.5 = half its length; 0 never), what a member becomes when it does, and how hard loose members are drawn home (1/s², 0 never). */
  toughness: number; breakInto?: string; reform: number;
  /** Cells a second its members stream along x (round a ring, they circle it), and a ripple through it (m, m, m/s). */
  flow: number; wave: { height: number; length: number; speed: number };
  /** How much strain brightens a member (0 none), and how much brighter its outline (first and last rows and columns) shines: a shield's rim. */
  glow: number; rim: number;
  /**
   * How see-through it is: `opacity` (0–1) over all its members, loose ones too; `fresnel` (0–1) makes
   * the members whose surface faces you nearly vanish and keeps its outline bright, like a body of glass.
   */
  opacity: number; fresnel: number;
  /** Drawn as `strand`, which way its members join: along x (a sphere's parallels) or y (its meridians). */
  strands: 'x' | 'y';
  /** What is thrown at it (`hitBy`): how near a member it hits (m), how much of its motion it hands over (0–1), and its bounce (below 0: caught). */
  hitRadius: number; transfer: number; bounce: number;
  /** 0–1 of it broken loose, starting from `dissolveFrom`: raise it over time to crumble it. */
  dissolve: number; dissolveFrom: LatticeDissolve;
  /**
   * The share of its members' life they hold at while bonded (0.05–0.95): lowering it takes them back
   * along their kind's colours (a fire's lattice going white-hot), raising it lets them age on to it.
   */
  hold: number;
  /**
   * Its look over its kind's: `tint` (sRGB hex) its bonded members turn to, `tintAmount` (0–1) how far;
   * `cracks` (0–1) how much of it is split by cracks (dark gaps with bright edges across its cells,
   * more and wider the higher), laid out by `crackSeed`.
   */
  tint: string; tintAmount: number; cracks: number; crackSeed: number;
  /**
   * A soap film's look (a `catenoid`'s, or any sheet's): each member takes the colour of thin-film
   * interference from how thick the film is there, gold → white → cyan → water blue and back, never
   * magenta or violet. `thickness` (0–1, 1 a fresh film) thins it all: below about 0.15 it turns black
   * film, which shows nothing, so lowering it to 0 is its fade-out (from the top, where it is thinnest).
   * `drain` (0–1) is how much thinner its top is than its bottom (gravity), `swirl` (0–1) how much it
   * swirls, turning with its `flow` and its `wave`. Its first and last rows (a catenoid's rings) keep
   * the lattice's own colour, bigger.
   */
  film: boolean; thickness: number; drain: number; swirl: number;
  /** What it sheds when it breaks (a film's members, but its rings, or anything that `rupture`s): this share (0–1) as `breakInto`, the rest gone. */
  shed: number;
  /** Its members' slots. */
  readonly members: GpuBatch;
  readonly alive: boolean;
  /** A push this frame: members within `radius` of `at` are kicked away at up to `strength` m/s (towards it if negative). */
  push(at: Vec3Like, radius: number, strength: number): void;
  /**
   * Thrown at up to MAX_AIMS points (`[]` lets go): from now on each loose member flies at the point on
   * its side of the lattice (latticeAim), steering towards it at `speed` m/s (`steer` 1/s), arcing up
   * over the way by `arc` of how far it still has to go; within its `radius` it goes off, scattering at
   * up to `blast` m/s as its kind's `onDeath` (or dying, without one). Loose members it reforms ignore it.
   */
  throwAt(points: readonly { at: Vec3Like; radius: number }[], o?: { speed?: number; steer?: number; arc?: number; blast?: number }): void;
  /** A burst thrown at it: its particles meet its members (up to three bursts, the newest kept). */
  hitBy(batch: GpuBatch | undefined): void;
  /**
   * Places it between two points: a `catenoid`'s axis (its y) runs from `from` to `to`, its rings on
   * them; a `string`'s length (its x) from `from` (cell −1, its start) to `to` (cell 1, its end), its y
   * kept as near up as it can. Its half-size along that axis becomes half the distance. Call it every
   * frame to keep it on moving points (a chest, a pair of ankles).
   */
  span(from: Vec3Like, to: Vec3Like): void;
  /**
   * Capillary ripples from `at` (a world point on it, where a blow lands): rings that run out across its
   * surface at `speed` m/s, `length` m apart, `height` m high, dying away over `decay` s. Two at once;
   * a third replaces the oldest. Any shape; across its surface's facing (out of a sphere, from a
   * catenoid's axis, up from a string).
   */
  ripple(at: Vec3Like, o?: { height?: number; length?: number; speed?: number; decay?: number }): void;
  /**
   * It bursts like a soap film: a hole opens at `at` (a world point on it) and its rim runs back at
   * `speed` m/s, the same all the way, bright and thick (`rim` m wide) as it rolls up the film. Each
   * member the rim passes breaks loose: `shed` (0–1, sets the lattice's own) of them as `breakInto` (the
   * droplets: set it, e.g. 'fluido-agua', and `throwAt` the attacker to send them there), flung out
   * from the hole at up to `fling` m/s; the rest are gone. Returns how long until the rim has crossed all of it (s).
   */
  rupture(at: Vec3Like, o?: { speed?: number; rim?: number; shed?: number; fling?: number }): number;
  /**
   * A string's travel mode: a d'Alembert pulse plucked at `from` (cell −1…1, its middle by default)
   * runs towards the end `toward` (1 its end, −1 its start) at `speed` m/s, `height` m high and `width`
   * m wide, and each fixed end throws it back upside down; it dies away over `decay` s, lighting the
   * string up to `shine` times brighter where it lifts it (all its pulses share the last width and shine given). Two run at once;
   * a third replaces the oldest. `onReflect(end, n)` is called on the frame its `n`th reflection
   * (0 the first) reaches `end`. Returns when that first reflection comes (`reachesEnd`, s from now)
   * and every how long the next ones do (`every`, s), at its length now.
   */
  travel(o: { toward: 1 | -1; from?: number; height?: number; speed?: number; width?: number; decay?: number; shine?: number; onReflect?: (end: 1 | -1, n: number) => void }): { reachesEnd: number; every: number };
  /**
   * A string snaps at `at` (cell −1…1, its middle by default): the members by the cut break loose (as
   * `breakInto`), its pulses stop, and each half recoils onto its own end over `seconds`, whipping
   * `whip` m. Remove it after.
   */
  snap(o?: { at?: number; seconds?: number; whip?: number }): void;
  /** Gone: its members are free, and age out as their kind. */
  remove(): void;
}

/** How to make a lattice: its grid, shape and size, where, and how its members live; any `GpuLattice` field too. */
export interface GpuLatticeOptions extends Partial<Omit<GpuLattice, 'at' | 'rotation' | 'grid' | 'size' | 'members' | 'alive' | 'push' | 'hitBy' | 'throwAt' | 'remove' | 'wave' | 'span' | 'ripple' | 'rupture' | 'travel' | 'snap'>> {
  grid: readonly [number, number, number];
  size: Vec3Like;
  at?: Vec3Like; rotation?: pc.Quat;
  wave?: Partial<GpuLattice['wave']>;
  /** For a `string` or a `catenoid`: placed between these two points (`span`). */
  between?: [Vec3Like, Vec3Like];
  /** Each member's life (s) and the share of it it holds at while bonded: once loose it ages on through the rest. */
  life?: number; hold?: number;
  /** Members' size (× the kind's) and their tint. */
  scale?: number; colour?: string;
  /** Born loose, thrown from here (a ball or a ring of `spread`), to fly home and bond (set `reform`). Otherwise born in place. */
  from?: { at: Vec3Like; spread?: number; speed?: number; shape?: 'ball' | 'ring' };
  /** It lights what is round it, like a burst's `light`. */
  light?: { intensity: number; range: number; colour?: string };
}

/** A stream (no `light`: a light group per spawn would push every other group out). */
export interface GpuEmitter extends Omit<GpuBurst, 'count' | 'light'> { rate: number; remove(): void }

// The pool: 131 072 particles since 2026-11-21 (32 768 before). The GPU is not the limit (Aitor plays on an RTX 5070 Ti):
// effects can be dense. The simulation pass and the draw cover the whole pool every frame.
const W = 512, H = 256, N = W * H, BANDS = 7;
// Every kind registered at once: the fight's own, the duals', the statuses', the motes' and the ánimas' looks (Colorista's
// powder, Freática's water: one name each). A row of a small data texture each: 128 since Freática's water joined the fights, 256 since each newer dual brings its own (src/duo-fx).
export const MAX_KINDS = 256;
// MAX_BATCHES: bursts a frame. The spawn loop stops at the frame's own count, so only a frame that uses them pays;
// 256 since the newer duals' drawings (src/duo-fx) burst more than 64 on their busiest frames.
const KIND_COLS = 15, MAX_BATCHES = 256, SPAWN_COLS = 9, MAX_FIELDS = 16, FIELD_COLS = 3, MAX_PARTS = 256, PART_COLS = 9, MAX_FIGHTERS = 8, FLOOR = 64;
const SPAWN_SHAPES = { ball: 0, ring: 1, surface: 2, line: 3, points: 4 } as const;
/**
 * Clouds of points bursts are born on (`points`): up to MAX_CLOUDS a frame, MAX_CLOUD_POINTS each, a row of
 * a small texture each.
 */
export const MAX_CLOUDS = 8, MAX_CLOUD_POINTS = 1024;
/**
 * Played back (`rewind`): batches running their path backwards at once, and how long after its birth a
 * particle's second point (band G) is kept, the moment after the blow it played back through.
 */
export const MAX_REWINDS = 8;
const REWIND = { mid: .17 };
/**
 * The fluid's grid: cells of `CELL` metres, `GX` × `GY` × `GZ` of them round where the fluid was last
 * thrown, laid out on one texture `GX × GY` wide (a slice of `GX` columns for each height) and `GZ` tall.
 */
const GX = 64, GY = 24, GZ = 64, GW = GX * GY, CELL = .2;
/** Frames a fighter's real surface may be old before it is written again (src/surface-samples.ts). */
const SURFACE_EVERY = 3;
/** Crystals and other volumes particles meet; light groups (bursts that light their surroundings), the lights they share and how many particles each samples. */
export const MAX_VOLUMES = 8;
const VOLUME_COLS = 10, MAX_LIGHT_GROUPS = 8, FX_LIGHTS = 4, LIGHT_SAMPLES = 64;
const VOLUME_SHAPES = { sphere: 0, box: 1, crystal: 2, quartz: 3, paraboloid: 4 } as const;
const VOLUME_MODES = { contain: 0, solid: 1, orbit: 2, attract: 3, mirror: 4 } as const;
/**
 * Motion laws alive at once (`law`), and the columns of each: its inverse transform (world to its
 * space), its rotation (its space to the world), its four parameters, then [which law, scale, grip,
 * top speed] and [spark, spread, bounce, 0]. A particle following one keeps `LAW_BASE + slot` where a
 * lattice's member keeps its lattice.
 */
export const MAX_LAWS = 16;
const LAW_COLS = 9, LAW_BASE = 4096;
const LAW_IDS: Record<GpuLawName, number> = { lorenz: 1, galton: 2 };
/** Points lit this frame (`ignite`). */
const MAX_IGNITES = 8;

// ── Light: where each light group's particles are and how bright, summed on the GPU ───────────
// One texel per group and row: row 0 the brightness-weighted position (sum) and total brightness,
// row 1 the brightness-weighted colour and what they would weigh without fading in (their peak). Read back
// asynchronously, it moves a real light with the cloud, in its colour, fading as it does.

const LIGHT_WGSL = /* wgsl */ `
var uState: texture_2d<uff>;
var uKinds: texture_2d<uff>;
var uGroups: texture_2d<uff>;
varying vUv0: vec2f;
fn st(band: i32, index: i32) -> vec4f { return textureLoad(uState, vec2i(index % ${W}, index / ${W} + band * ${H}), 0); }
fn kin(k: i32, c: i32) -> vec4f { return textureLoad(uKinds, vec2i(c, k), 0); }
@fragment
fn fragmentMain(input: FragmentInput) -> FragmentOutput {
  var output: FragmentOutput;
  let fc = vec2i(pcPosition.xy);
  let g = textureLoad(uGroups, vec2i(0, fc.x), 0);
  var sumP = vec3f(0.0); var sumC = vec3f(0.0); var sumW = 0.0; var alive = 0.0;
  for (var i = 0; i < ${LIGHT_SAMPLES}; i++) {
    if (g.y < 0.5) { break; }
    let idx = i32(g.x + floor(f32(i) * g.y / ${LIGHT_SAMPLES}.0)) % ${N};
    let A = st(0, idx); let B = st(1, idx);
    if (!(B.w > 0.0 && A.w < B.w) || abs(st(4, idx).z - g.x) > 0.5) { continue; }
    let C = st(2, idx); let D = st(3, idx);
    let k = i32(C.x);
    let c0 = kin(k, 2); let c1 = kin(k, 3); let c2 = kin(k, 4); let f = kin(k, 6);
    let t = clamp(A.w / B.w, 0.0, 1.0);
    var colour = mix(c1.rgb, c2.rgb, (t - c1.w) / (1.0 - c1.w));
    if (t < c1.w) { colour = mix(c0.rgb * c0.w, c1.rgb, t / c1.w); }
    colour *= D.yzw;
    let alpha = c2.w * min(1.0, t / max(f.x, 0.001)) * min(1.0, (1.0 - t) / max(f.y, 0.001));
    let w = alpha * (colour.r + colour.g + colour.b) / 3.0;
    sumP += A.xyz * w; sumC += colour * w; sumW += w;
    // What it would weigh without fading in, so a light grows as its particles do.
    alive += c2.w * min(1.0, (1.0 - t) / max(f.y, 0.001)) * (colour.r + colour.g + colour.b) / 3.0 + 1e-6;
  }
  output.color = select(vec4f(sumC, alive), vec4f(sumP, sumW), fc.y == 0);
  return output;
}`;

// ── The simulation pass ─────────────────────────────────────────────────────────────────────────

const SIM_WGSL = /* wgsl */ `
var uState: texture_2d<uff>;
var uKinds: texture_2d<uff>;
var uSpawns: texture_2d<uff>;
var uFields: texture_2d<uff>;
var uParts: texture_2d<uff>;
var uFighters: texture_2d<uff>;
var uSurface: texture_2d<uff>;
var uFloorMap: texture_2d<uff>;
uniform uDt: f32;
uniform uTime: f32;
uniform uFrame: f32;
uniform uCounts: vec4f;
uniform uFloor: vec4f;
var uVolumes: texture_2d<uff>;
uniform uExtra: vec4f;
var uLattices: texture_2d<uff>;
var uGrid: texture_2d<uff>;
uniform uGridAt: vec4f;
var uLaws: texture_2d<uff>;
var uIgnites: texture_2d<uff>;
var uClouds: texture_2d<uff>;
var uRewinds: texture_2d<uff>;
varying vUv0: vec2f;

fn hashu(v: u32) -> u32 { var x = v; x ^= x >> 16u; x *= 0x7feb352du; x ^= x >> 15u; x *= 0x846ca68bu; x ^= x >> 16u; return x; }
fn rnd(a: u32, b: u32) -> f32 { return f32(hashu(a * 1664525u + hashu(b + 1013904223u))) / 4294967295.0; }
fn st(band: i32, index: i32) -> vec4f { return textureLoad(uState, vec2i(index % ${W}, index / ${W} + band * ${H}), 0); }
fn kin(k: i32, c: i32) -> vec4f { return textureLoad(uKinds, vec2i(c, k), 0); }
fn spawn4(c: i32, b: i32) -> vec4f { return textureLoad(uSpawns, vec2i(c, b), 0); }
fn unitVec(u: f32, v: f32) -> vec3f { let z = u * 2.0 - 1.0; let a = v * 6.2831853; let r = sqrt(max(0.0, 1.0 - z * z)); return vec3f(r * cos(a), z, r * sin(a)); }
fn anyPerp(a: vec3f) -> vec3f { return normalize(cross(a, select(vec3f(1.0, 0.0, 0.0), vec3f(0.0, 1.0, 0.0), abs(a.y) < 0.9))); }
fn flow(p: vec3f, t: f32) -> vec3f {
  var v = vec3f(0.0);
  v += vec3f(0.0, 0.6, -0.8) * sin(dot(p, vec3f(1.7, 0.0, 0.0)) + t * 1.3);
  v += vec3f(-0.8, 0.0, 0.6) * sin(dot(p, vec3f(0.0, 1.9, 0.0)) - t * 1.7 + 1.3);
  v += vec3f(0.6, -0.8, 0.0) * sin(dot(p, vec3f(0.0, 0.0, 2.3)) + t * 1.1 + 2.1);
  v += vec3f(0.0, -0.7, 0.71) * sin(dot(p, vec3f(3.1, 0.0, 0.0)) - t * 2.3 + 0.7) * 0.6;
  v += vec3f(0.71, 0.0, -0.7) * sin(dot(p, vec3f(0.0, 3.7, 0.0)) + t * 2.9 + 4.0) * 0.6;
  v += vec3f(-0.7, 0.71, 0.0) * sin(dot(p, vec3f(0.0, 0.0, 4.1)) - t * 2.1 + 5.2) * 0.6;
  return v * 0.45;
}
fn part4(x: i32, p: i32) -> vec4f { return textureLoad(uParts, vec2i(x, p), 0); }
fn toLocal(p: i32, w: vec3f) -> vec3f { let a = part4(0, p); let b = part4(1, p); let c = part4(2, p); return vec3f(dot(a.xyz, w) + a.w, dot(b.xyz, w) + b.w, dot(c.xyz, w) + c.w); }
fn toWorld(p: i32, l: vec3f) -> vec3f { let a = part4(3, p); let b = part4(4, p); let c = part4(5, p); return vec3f(dot(a.xyz, l) + a.w, dot(b.xyz, l) + b.w, dot(c.xyz, l) + c.w); }
fn floorAt(p: vec3f) -> f32 {
  let c = (p.xz - uniform.uFloor.xy) / uniform.uFloor.z;
  if (c.x < 0.0 || c.y < 0.0 || c.x >= ${FLOOR}.0 || c.y >= ${FLOOR}.0) { return uniform.uFloor.w; }
  return textureLoad(uFloorMap, vec2i(i32(c.x), i32(c.y)), 0).x;
}
// The fluid's grid (GX by GY by GZ cells): what was splatted in a cell this frame, momentum and mass.
fn cellAt(c: vec3i) -> vec4f { return textureLoad(uGrid, vec2i(c.x + c.y * ${GX}, c.z), 0); }
fn lifeOf(k: f32, s: f32) -> f32 { let l = kin(i32(k), 11); return mix(l.x, l.y, s); }
// Volumes (crystals): a shape in its own space, from a rigid transform; signed distance and normal.
fn vol(v: i32, c: i32) -> vec4f { return textureLoad(uVolumes, vec2i(c, v), 0); }
fn vLocal(v: i32, w: vec3f) -> vec3f { let a = vol(v, 0); let b = vol(v, 1); let c = vol(v, 2); return vec3f(dot(a.xyz, w) + a.w, dot(b.xyz, w) + b.w, dot(c.xyz, w) + c.w); }
fn vTurn(v: i32, l: vec3f) -> vec3f { return vec3f(dot(vol(v, 3).xyz, l), dot(vol(v, 4).xyz, l), dot(vol(v, 5).xyz, l)); }
fn sdfOf(v: i32, p: vec3f) -> f32 {
  let s = vol(v, 6);
  if (s.w < 0.5) { return length(p) - s.x; }
  if (s.w < 1.5) { let q = abs(p) - s.xyz; return length(max(q, vec3f(0.0))) + min(max(q.x, max(q.y, q.z)), 0.0); }
  if (s.w < 2.5) {
    // A crystal: a double pyramid, |x|/a + |y|/b + |z|/c = 1, distance to its faces.
    let q = abs(p) / s.xyz;
    return (q.x + q.y + q.z - 1.0) / length(1.0 / s.xyz);
  }
  if (s.w < 3.5) {
    // Quartz: a hexagonal prism (apothem a, half-length h) with a six-sided point at each end (length tip).
    let q = abs(p.xz);
    let hexR = max(q.x * 0.8660254 + q.y * 0.5, q.y);
    let k = s.z / s.x;
    return max(hexR - s.x, (hexR * k + abs(p.y) - (s.y + s.z)) / sqrt(k * k + 1.0));
  }
  // A paraboloid dish: a shell of its thickness round the surface, cut at its rim.
  return max(abs(dishAt(s, p)) - max(s.z, 0.005), length(p.xz) - s.y);
}
// A paraboloid y = r² / 4f (f its focal length, s.x): how far above its surface, near enough, and which way that is.
fn dishAt(s: vec4f, p: vec3f) -> f32 { let f = max(s.x, 0.01); let r2 = dot(p.xz, p.xz); return (p.y - r2 / (4.0 * f)) / sqrt(1.0 + r2 / (4.0 * f * f)); }
fn dishNormal(s: vec4f, p: vec3f) -> vec3f { let f = max(s.x, 0.01); return normalize(vec3f(-p.x / (2.0 * f), 1.0, -p.z / (2.0 * f))); }
fn vWorld(v: i32, l: vec3f) -> vec3f { let a = vol(v, 3); let b = vol(v, 4); let c = vol(v, 5); return vec3f(dot(a.xyz, l) + a.w, dot(b.xyz, l) + b.w, dot(c.xyz, l) + c.w); }
// Motion laws (\`law\`): a space of their own, from a rigid transform, and their parameters.
fn law(l: i32, c: i32) -> vec4f { return textureLoad(uLaws, vec2i(c, l), 0); }
fn lawLocal(l: i32, w: vec3f) -> vec3f { let a = law(l, 0); let b = law(l, 1); let c = law(l, 2); return vec3f(dot(a.xyz, w) + a.w, dot(b.xyz, w) + b.w, dot(c.xyz, w) + c.w); }
fn lawIn(l: i32, w: vec3f) -> vec3f { return vec3f(dot(law(l, 0).xyz, w), dot(law(l, 1).xyz, w), dot(law(l, 2).xyz, w)); }
fn lawTurn(l: i32, v: vec3f) -> vec3f { return vec3f(dot(law(l, 3).xyz, v), dot(law(l, 4).xyz, v), dot(law(l, 5).xyz, v)); }
fn lawWorld(l: i32, v: vec3f) -> vec3f { return lawTurn(l, v) + vec3f(law(l, 3).w, law(l, 4).w, law(l, 5).w); }
// The Lorenz field at a point (world velocity): (X, Y, Z) in its space is (x, z, y) / scale in the law's.
fn lorenzAt(l: i32, w: vec3f) -> vec3f {
  let p = law(l, 6); let l7 = law(l, 7);
  let q = lawLocal(l, w) / max(l7.y, 1e-4);
  let X = q.x; let Y = q.z; let Z = q.y;
  let d = vec3f(p.x * (Y - X), X * (p.y - Z) - Y, X * Y - p.z * Z);
  return lawTurn(l, vec3f(d.x, d.z, d.y)) * l7.y * p.w;
}
// The fluid's grid where a point is (trilinear): the momentum (xyz) and mass (w) there.
fn gridSample(w: vec3f) -> vec4f {
  let g = (w - uniform.uGridAt.xyz) / uniform.uGridAt.w - 0.5;
  let c0 = vec3i(floor(g));
  if (c0.x < 0 || c0.y < 0 || c0.z < 0 || c0.x >= ${GX - 1} || c0.y >= ${GY - 1} || c0.z >= ${GZ - 1}) { return vec4f(0.0); }
  let t = g - floor(g);
  var sum = vec4f(0.0);
  for (var q = 0; q < 8; q++) {
    let o = vec3i(q & 1, (q >> 1) & 1, (q >> 2) & 1);
    let wx = select(1.0 - t.x, t.x, o.x == 1); let wy = select(1.0 - t.y, t.y, o.y == 1); let wz = select(1.0 - t.z, t.z, o.z == 1);
    sum += textureLoad(uGrid, vec2i(c0.x + o.x + (c0.y + o.y) * ${GX}, c0.z + o.z), 0) * wx * wy * wz;
  }
  return sum;
}
// A lattice's member keeps its lattice + 1 (negative: loose); a law's follower keeps LAW_BASE + its law.
fn latticeCode(m: f32) -> bool { return abs(m) > 0.5 && abs(m) < ${LAW_BASE - .5}; }
fn normalOf(v: i32, p: vec3f) -> vec3f {
  let e = 0.01;
  let g = vec3f(sdfOf(v, p + vec3f(e, 0.0, 0.0)) - sdfOf(v, p - vec3f(e, 0.0, 0.0)), sdfOf(v, p + vec3f(0.0, e, 0.0)) - sdfOf(v, p - vec3f(0.0, e, 0.0)), sdfOf(v, p + vec3f(0.0, 0.0, e)) - sdfOf(v, p - vec3f(0.0, 0.0, e)));
  return normalize(vTurn(v, g) + vec3f(0.0, 1e-6, 0.0));
}
// The kinds it affects: all, or up to four by their slots.
fn affects(v: i32, k: i32) -> bool {
  let n = vol(v, 8).z; let l = vol(v, 9); let kf = f32(k);
  return n < 0.5 || abs(l.x - kf) < 0.5 || (n > 1.5 && abs(l.y - kf) < 0.5) || (n > 2.5 && abs(l.z - kf) < 0.5) || (n > 3.5 && abs(l.w - kf) < 0.5);
}
// Lattices (src/lattice.ts): shapes held by particles.
${latticeWgsl(N)}

@fragment
fn fragmentMain(input: FragmentInput) -> FragmentOutput {
  var output: FragmentOutput;
  let fc = vec2i(pcPosition.xy);
  let band = fc.y / ${H};
  let row = fc.y - band * ${H};
  let index = row * ${W} + fc.x;
  let id = u32(index);
  let frame = u32(uniform.uFrame);
  let A = st(0, index); let B = st(1, index); let C = st(2, index); let D = st(3, index); let E = st(4, index);
  // Where it was born and where it was a moment after (\`rewind\` plays it back through them).
  var origin = st(5, index).xyz; var mid = st(6, index).xyz;
  var pos = A.xyz; var vel = B.xyz; var tint = D.yzw;
  var age = A.w; var life = B.w; var kind = C.x; var seed = C.y; var part = C.z; var size = C.w; var release = D.x;
  var link = E.x; var chainPos = E.y; var group = E.z; var member = E.w;

  // Spawn: each batch covers consecutive slots of the ring. A particle born this frame waits for
  // the next to move, when its leader (born this frame too) is in the state it reads.
  var fresh = false;
  let batches = i32(uniform.uCounts.x);
  for (var b = 0; b < ${MAX_BATCHES}; b++) {
    if (b >= batches) { break; }
    let s0 = spawn4(0, b);
    let offset = (f32(index) - s0.x + ${N}.0) % ${N}.0;
    if (offset >= s0.y) { continue; }
    let s1 = spawn4(1, b); let s2 = spawn4(2, b); let s3 = spawn4(3, b); let s4 = spawn4(4, b); let s5 = spawn4(5, b); let s6 = spawn4(6, b); let s7 = spawn4(7, b);
    // In a chain every link starts where its leader does: they draw the same numbers.
    let chain = max(1.0, s5.y);
    let inChain = f32(i32(offset + 0.5) % i32(chain + 0.5));
    let key = (u32(f32(index) - inChain + ${N}.0) % ${N}u) * 7u + u32(s0.w * 65535.0);
    let r1 = rnd(key, 1u); let r2 = rnd(key, 2u); let r3 = rnd(key, 3u); let r4 = rnd(key, 4u); let r5 = rnd(key, 5u); let r6 = rnd(key, 6u);
    kind = s0.z; seed = rnd(id * 7u + u32(s0.w * 65535.0), 7u); part = 0.0; release = 0.0; age = 0.0;
    // A path through a Galton board (\`path\`): its bits are the seed's first sixteen.
    let sPath = spawn4(8, b).w;
    if (sPath > 0.5) { seed = (sPath - 1.0 + 0.25 + 0.5 * rnd(id, 15u)) / 65536.0; }
    size = s3.w * max(0.05, 1.0 + kin(i32(kind), 10).x * (rnd(id, 14u) * 2.0 - 1.0));
    life = mix(s4.x, s4.y, r1);
    tint = select(vec3f(1.0), s6.rgb, s6.w > 0.5);
    link = select(-1.0, f32((index - 1 + ${N}) % ${N}), inChain > 0.5);
    chainPos = select(0.0, inChain / (chain - 1.0), chain > 1.5);
    group = s0.x;
    var normal = vec3f(0.0, 1.0, 0.0);
    if (s3.x < 0.5) { pos = s1.xyz + unitVec(r2, r3) * s1.w * pow(r4, 0.333); }
    else if (s3.x < 1.5) {
      let axis = normalize(s7.xyz); let u = anyPerp(axis); let v = cross(axis, u);
      let a = r2 * 6.2831853;
      normal = u * cos(a) + v * sin(a);
      pos = s1.xyz + normal * s1.w;
    } else if (s3.x > 3.5) {
      // On a cloud of points the CPU gave (\`points\`): each particle the next point, a little round it.
      let n = max(1, i32(s7.x + 0.5));
      pos = textureLoad(uClouds, vec2i(i32(offset - inChain + 0.5) % n, i32(s3.y)), 0).xyz + unitVec(r2, r3) * s1.w * r4;
    } else if (s3.x > 2.5) { pos = mix(s1.xyz, s7.xyz, (offset - inChain + 0.5) / s0.y) + unitVec(r2, r3) * s1.w * r4; }
    else if (textureLoad(uFighters, vec2i(1, i32(s3.y)), 0).y < 0.5) { pos = s1.xyz; }
    else if (textureLoad(uFighters, vec2i(2, i32(s3.y)), 0).x > 0.5) {
      // On a fighter's real surface: one of its points (src/surface-samples.ts), above a fraction of
      // its height and within a band of it (a front eating it), drawn again until it is.
      let g = i32(s3.y);
      let fighter = textureLoad(uFighters, vec2i(1, g), 0);
      let samples = i32(textureLoad(uFighters, vec2i(2, g), 0).x);
      let s8 = spawn4(8, b);
      let span = fighter.w - fighter.z;
      let bandLow = max(fighter.z + span * s8.x, fighter.z + span * s4.z); let bandHigh = fighter.z + span * s8.y;
      var pickAt = 0;
      for (var draw = 0u; draw < 12u; draw++) {
        pickAt = min(samples - 1, i32(select(rnd(key, 48u + draw), r2, draw == 0u) * f32(samples)));
        let y = textureLoad(uSurface, vec2i(pickAt, g * 3), 0).y;
        if (y >= bandLow && y <= bandHigh) { break; }
      }
      normal = textureLoad(uSurface, vec2i(pickAt, g * 3 + 1), 0).xyz;
      // A little off the point, along the skin, so specks from one point never stack.
      let side1 = anyPerp(normal); let side2 = cross(normal, side1);
      pos = textureLoad(uSurface, vec2i(pickAt, g * 3), 0).xyz + normal * 0.006 + (side1 * (r3 - 0.5) + side2 * (r4 - 0.5)) * 0.03;
      if (s8.z > 0.0) { tint = mix(tint, textureLoad(uSurface, vec2i(pickAt, g * 3 + 2), 0).rgb, s8.z); }
    }
    else {
      // On a fighter: a random part (above a fraction of its height), a random face, a random point on
      // it. Within a band of its height (a front eating it), drawn again until the point is in it.
      let fighter = textureLoad(uFighters, vec2i(1, i32(s3.y)), 0);
      let count = i32(fighter.y);
      let s8 = spawn4(8, b);
      let bandLow = fighter.z + (fighter.w - fighter.z) * s8.x; let bandHigh = fighter.z + (fighter.w - fighter.z) * s8.y;
      var pick = 0;
      for (var draw = 0u; draw < 8u; draw++) {
        // The first draw takes the burst's own numbers, as it always has.
        let first = draw == 0u; let q = 48u + draw * 8u;
        let d2 = select(rnd(key, q), r2, first); let d3 = select(rnd(key, q + 1u), r3, first); let d4 = select(rnd(key, q + 2u), r4, first);
        let d5 = select(rnd(key, q + 3u), r5, first); let d6 = select(rnd(key, q + 4u), r6, first); let d7 = select(rnd(key, q + 5u), rnd(key, 8u), first);
        let retry = select(q + 6u, 20u, first);
        pick = i32(fighter.x) + min(count - 1, i32(d2 * f32(count)));
        for (var tries = 0; tries < 4; tries++) {
          if (toWorld(pick, part4(6, pick).xyz).y >= fighter.z + (fighter.w - fighter.z) * s4.z) { break; }
          pick = i32(fighter.x) + min(count - 1, i32(rnd(key, retry + u32(tries) * select(1u, 97u, !first)) * f32(count)));
        }
        let box = part4(6, pick); let half_ = part4(7, pick);
        var local = box.xyz + (vec3f(d3, d4, d5) * 2.0 - 1.0) * half_.xyz;
        let axis = i32(d6 * 3.0);
        let side = select(1.0, -1.0, d7 < 0.5);
        if (axis == 0) { local.x = box.x + side * half_.x; } else if (axis == 1) { local.y = box.y + side * half_.y; } else { local.z = box.z + side * half_.z; }
        normal = normalize(part4(axis, pick).xyz) * side;
        pos = toWorld(pick, local) + normal * 0.02;
        if (pos.y >= bandLow && pos.y <= bandHigh) { break; }
      }
      // The colour of the part it leaves, as much as asked.
      if (s8.z > 0.0) { tint = mix(tint, part4(8, pick).rgb, s8.z); }
    }
    var dir = unitVec(rnd(key, 9u), rnd(key, 10u));
    let speed = length(s2.xyz);
    if (speed > 0.001 && s3.z < 3.5) {
      // Within a cone round the given velocity.
      let aim = s2.xyz / speed; let side1 = anyPerp(aim); let side2 = cross(aim, side1);
      let ct = 1.0 - rnd(key, 11u) * (1.0 - cos(s3.z)); let b2 = rnd(key, 12u) * 6.2831853;
      dir = aim * ct + (side1 * cos(b2) + side2 * sin(b2)) * sqrt(max(0.0, 1.0 - ct * ct));
      vel = dir * (speed + s2.w * (rnd(key, 13u) * 2.0 - 1.0));
    } else { vel = s2.xyz + dir * s2.w * rnd(key, 13u); }
    vel += normal * s4.w + vec3f(0.0, s5.x, 0.0);
    if (s3.x > 0.5 && s3.x < 1.5) { vel += cross(normalize(s7.xyz), normal) * s5.z; }
    // A lattice's member (s5.w: + bonded, − loose), born where it belongs (s7.w) or where the burst puts it.
    member = s5.w;
    if (latticeCode(member)) {
      let l = i32(abs(member) + 0.5) - 1; let o = i32(offset + 0.5);
      if (s7.w > 0.5) { pos = homeOf(l, o); vel = lat(l, 12).xyz; }
      // The cell before it along x leads it, so a strand draws each row of the lattice as a line.
      link = rowLeader(l, o);
      chainPos = -lat(l, 19).z * 1.6;
    }
    origin = pos; mid = pos;
    fresh = true;
    break;
  }

  // Played back (\`rewind\`): a batch (its start, how many, the seconds since it started going back, how long it takes)
  // runs back through where each particle was a moment after its birth (G) to where it was born (F), the
  // tape speeding up, its age going back with it; there it becomes the request's kind (or is gone). Then
  // it leaves its batch, so it is played back once.
  var rewinding = false;
  if (life > 0.0 && age < life && uniform.uDt > 0.0 && !fresh && abs(member) < 0.5) {
    let rewinds = i32(uniform.uExtra.w);
    for (var q = 0; q < ${MAX_REWINDS}; q++) {
      if (q >= rewinds) { break; }
      let r0 = textureLoad(uRewinds, vec2i(0, q), 0);
      let off = (f32(index) - r0.x + ${N}.0) % ${N}.0;
      if (off >= r0.y || abs(group - r0.x) > 0.5 || r0.z < 0.0) { continue; }
      rewinding = true;
      let dt = uniform.uDt; let total = max(r0.w, 1e-3); let was = max(0.0, r0.z - dt);
      part = 0.0; link = -1.0;
      if (r0.z >= total) {
        pos = origin; vel = vec3f(0.0);
        let into = textureLoad(uRewinds, vec2i(1, q), 0).x;
        if (into > -0.5) { kind = into; age = 0.0; life = lifeOf(kind, seed); } else { age = life; }
        group = -2.0;
      } else {
        // Two legs, the second shorter (the tape speeds up): to G by 60 % of the time, then to F.
        let bend = total * 0.6;
        let goal = select(origin, mid, was < bend);
        let legEnd = select(total, bend, was < bend);
        let k = clamp(dt / max(legEnd - was, dt), 0.0, 1.0);
        let next = mix(pos, goal, k);
        vel = (next - pos) / dt;
        pos = next;
        age = max(0.0, age * (1.0 - k * select(1.0, 0.5, was < bend)));
      }
      break;
    }
  }

  let alive = life > 0.0 && age < life;
  if (alive && uniform.uDt > 0.0 && !fresh && !rewinding) {
    let k = i32(kind);
    let k0 = kin(k, 0); let k1 = kin(k, 1); let k7 = kin(k, 7); let k8 = kin(k, 8); let k9 = kin(k, 9);
    let dt = uniform.uDt;
    // A follower whose leader is gone (or re-spawned as something else) goes its own way.
    var leaderA = vec4f(0.0);
    if (link > -0.5) {
      let li = i32(link);
      let lb = st(1, li); let le = st(4, li);
      leaderA = st(0, li);
      if (!(lb.w > 0.0 && leaderA.w < lb.w) || abs(le.z - group) > 0.5) { link = -1.0; }
    }
    // A lattice's member: which lattice, bonded or loose, and its cell. With its lattice gone it is free.
    // Thrown (\`throwAt\`), a loose one flies at its point (\`aim\`) and goes off there.
    var ml = -1; var mo = 0; var bonded = false; var thrown = false; var aim = vec4f(0.0);
    if (latticeCode(member)) {
      let l = i32(abs(member) + 0.5) - 1;
      if (l < ${MAX_LATTICES} && lat(l, 6).y > 0.5 && abs(lat(l, 6).x - group) < 0.5) { ml = l; bonded = member > 0.0; mo = i32(fmodf(f32(index) - group + ${N}.0, ${N}.0) + 0.5); }
      else { member = 0.0; link = -1.0; chainPos = 0.0; }
    }
    if (part > 0.5) {
      // Clinging to a fighter's part (fighter slot × ${MAX_PARTS} + part within them, + 1): it rides along
      // wherever the part goes, and lets go in time, or where it is if that fighter is gone.
      let code = i32(part) - 1;
      let g = code / ${MAX_PARTS};
      let q = code - g * ${MAX_PARTS};
      let range = textureLoad(uFighters, vec2i(1, g), 0);
      if (age >= release || q >= i32(range.y)) { vel = vec3f(0.0, 0.4, 0.0); part = 0.0; }
      else { pos = toWorld(i32(range.x) + q, vel); }
    } else if (part < -0.5) {
      // Settled on the floor; a loose member its lattice calls home gets up again.
      if (ml >= 0 && lat(ml, 10).z > 0.0) { part = 0.0; }
    } else if (link > -0.5 && ml < 0) {
      // Trailing its leader: it closes in on where the leader is, lagging, so the chain draws a curve.
      let next = mix(pos, leaderA.xyz, 1.0 - exp(-k9.w * dt)) + flow(pos * 1.3 + seed * 3.0, uniform.uTime) * k0.z * dt * 0.3;
      vel = (next - pos) / dt;
      pos = next;
    } else {
      var acc = vec3f(0.0, -k0.y, 0.0);
      var swirl = flow(pos * 1.3 + seed * 3.0, uniform.uTime) * k0.z;
      let fields = i32(uniform.uCounts.y);
      for (var f = 0; f < ${MAX_FIELDS}; f++) {
        if (f >= fields) { break; }
        let f0 = textureLoad(uFields, vec2i(0, f), 0); let f1 = textureLoad(uFields, vec2i(1, f), 0); let f2 = textureLoad(uFields, vec2i(2, f), 0);
        let d = pos - f0.xyz;
        let dist = length(d);
        if (dist >= f0.w || dist < 0.0001) { continue; }
        let fall = (1.0 - dist / f0.w) * k0.w;
        let axis = f2.xyz;
        let radial = d - axis * dot(d, axis);
        let rl = max(length(radial), 0.0001);
        acc += (cross(axis, radial) / rl * f1.x - d / dist * f1.y + axis * f1.z) * fall;
        swirl *= 1.0 + f1.w * fall;
      }
      // Seeing each other: siblings from the same batch flock; a few random others keep apart.
      if (k8.x + k8.y + k8.z > 0.0) {
        let radius = max(k8.w, 0.01);
        var apart = vec3f(0.0); var middle = vec3f(0.0); var heading = vec3f(0.0); var n = 0.0;
        for (var j = 0; j < 7; j++) {
          var other: i32;
          if (j < 4) { other = index + select(j - 1, j - 2, j < 2); }
          else { other = i32(hashu(id * 3u + u32(j) + frame * 7919u) % ${N}u); }
          other = (other + ${N}) % ${N};
          if (other == index) { continue; }
          let oa = st(0, other); let ob = st(1, other);
          if (!(ob.w > 0.0 && oa.w < ob.w)) { continue; }
          let d = pos - oa.xyz;
          let dist = length(d);
          if (dist >= radius) { continue; }
          apart += d / max(dist * dist, 0.0004) * (1.0 - dist / radius);
          if (j < 4 && abs(st(4, other).z - group) < 0.5) { middle += oa.xyz; heading += ob.xyz; n += 1.0; }
        }
        acc += apart * k8.x * radius * 0.1;
        if (n > 0.0) { acc += (middle / n - pos) * k8.y + (heading / n - vel) * k8.z; }
      }
      // Catching fire (\`ignite\`): a point lit this frame, or a burning particle near it among a few it
      // looks at (four near it on the ring, its own cloud; two anywhere), sets it alight after a delay.
      let ig = kin(k, 14);
      if (ig.x > -0.5 && abs(member) < 0.5 && release >= 0.0) {
        var lit = false;
        let points = i32(uniform.uExtra.y);
        for (var q = 0; q < ${MAX_IGNITES}; q++) {
          if (q >= points) { break; }
          let pt = textureLoad(uIgnites, vec2i(0, q), 0);
          if (length(pos - pt.xyz) < pt.w) { lit = true; }
        }
        for (var j = 0; j < 6; j++) {
          if (lit) { break; }
          var other: i32;
          if (j < 4) { other = index + i32(hashu(id * 5u + u32(j) + frame * 6151u) % 1024u) - 512; }
          else { other = i32(hashu(id * 11u + u32(j) + frame * 4271u) % ${N}u); }
          other = (other + ${N}) % ${N};
          if (other == index) { continue; }
          let oa = st(0, other); let ob = st(1, other);
          if (!(ob.w > 0.0 && oa.w < ob.w)) { continue; }
          if (kin(i32(st(2, other).x), 14).w < 0.5) { continue; }
          if (length(oa.xyz - pos) < ig.z) { lit = true; }
        }
        // It burns once its age reaches −release.
        if (lit) { release = -(age + ig.y * (0.6 + 0.8 * rnd(id * 3u + frame, 63u)) + 1e-4); }
      }
      // A fluid: the grid round it (trilinear over the eight cells about it) gives how packed it is
      // there and which way it thins, and the flow there. Pushed down the packing it keeps its volume
      // and spreads; drawn into the flow it moves as one body.
      let fl = kin(k, 12);
      if (fl.x > 0.0) {
        let g = (pos - uniform.uGridAt.xyz) / uniform.uGridAt.w - 0.5;
        let c0 = vec3i(floor(g));
        if (c0.x >= 0 && c0.y >= 0 && c0.z >= 0 && c0.x < ${GX - 1} && c0.y < ${GY - 1} && c0.z < ${GZ - 1}) {
          let t = g - floor(g);
          var mass = 0.0; var mom = vec3f(0.0); var grad = vec3f(0.0);
          for (var q = 0; q < 8; q++) {
            let o = vec3i(q & 1, (q >> 1) & 1, (q >> 2) & 1);
            let cell = cellAt(c0 + o);
            let wx = select(1.0 - t.x, t.x, o.x == 1); let wy = select(1.0 - t.y, t.y, o.y == 1); let wz = select(1.0 - t.z, t.z, o.z == 1);
            let w = wx * wy * wz;
            mass += cell.w * w; mom += cell.xyz * w;
            grad += cell.w * vec3f(select(-1.0, 1.0, o.x == 1) * wy * wz, wx * select(-1.0, 1.0, o.y == 1) * wz, wx * wy * select(-1.0, 1.0, o.z == 1));
          }
          let rest = max(fl.z, 0.5);
          // How hard it pushes grows as it packs past its rest; capped, so a crowd never blows up in one frame.
          let push = -grad / (rest * uniform.uGridAt.w) * fl.x * (0.35 + max(mass / rest - 1.0, 0.0));
          let pl = length(push);
          acc += select(push, push / pl * 40.0, pl > 40.0);
          if (mass > 0.05 && fl.y > 0.0) { vel = mix(vel, mom / mass, clamp(fl.y * dt, 0.0, 1.0)); }
        }
      }
      // A bubble (\`bubble\`): where the fluid is packed it rises and is carried by the flow there.
      let bb = kin(k, 13);
      if ((bb.y != 0.0 || bb.z > 0.0) && uniform.uExtra.z > 0.5) {
        let cell = gridSample(pos);
        let full = clamp(cell.w / 6.0, 0.0, 1.5);
        acc.y += bb.y * full;
        if (cell.w > 0.05 && bb.z > 0.0) { vel = mix(vel, cell.xyz / cell.w, clamp(bb.z * dt * min(full, 1.0), 0.0, 1.0)); }
      }
      // Volumes pull and swirl what is near them: onto their shell (orbit) or into them (attract).
      let volumes = i32(uniform.uExtra.x);
      for (var v = 0; v < ${MAX_VOLUMES}; v++) {
        if (v >= volumes) { break; }
        let m = vol(v, 7); let r = vol(v, 8);
        if (m.x < 1.5 || m.x > 3.5 || !affects(v, k)) { continue; }
        let lp = vLocal(v, pos);
        let d = sdfOf(v, lp);
        if (d > r.x) { continue; }
        let n = normalOf(v, lp);
        let axis = normalize(vec3f(vol(v, 3).y, vol(v, 4).y, vol(v, 5).y));
        let reach = (1.0 - max(d, 0.0) / max(r.x, 0.001)) * k0.w;
        let around = cross(axis, n);
        let al = length(around);
        if (al > 0.0001) { acc += around / al * m.z * reach; }
        if (m.x < 2.5) { acc += (-n * (d - r.y) * m.y - n * dot(vel, n) * 2.5) * k0.w; }
        else { acc -= n * m.y * reach; }
      }
      // A lattice holds its members: each is drawn to its home and to its neighbours, and what is
      // thrown at it or pushes it moves them; the springs are capped so no frame overshoots.
      var strain = 0.0;
      if (ml >= 0) {
        // A catenoid's or a string's strands reach as far as its cells are apart now (it may be made
        // folded up and opened, or drawn out from one end).
        if (bonded && dominant(ml) > 7.5) { chainPos = -lat(ml, 19).z * 1.6; }
        let g9 = lat(ml, 9); let g10 = lat(ml, 10); let g13 = lat(ml, 13); let g14 = lat(ml, 14);
        let home = homeOf(ml, mo);
        let homeVel = lat(ml, 12).xyz + cross(g13.xyz, home - vec3f(lat(ml, 0).w, lat(ml, 1).w, lat(ml, 2).w));
        let stiff = 1.0 / (dt * dt);
        // Flowing past its end, it starts again at the other.
        if (bonded && wrappedNow(ml, mo)) { pos = home; vel = homeVel; }
        if (bonded) {
          acc += (home - pos) * min(g9.x, 0.5 * stiff) + (homeVel - vel) * min(g9.z, 0.8 / dt);
          let kb = min(g9.y, 0.2 * stiff); let kv = min(g9.w, 0.12 / dt); let reach = lat(ml, 19).z;
          for (var d = 0; d < 6; d++) {
            let no = neighbourOf(ml, mo, d);
            if (no < 0 || no == mo) { continue; }
            let ni = slotOf(ml, no);
            let nA = st(0, ni); let nB = st(1, ni);
            if (abs(st(4, ni).w - member) > 0.5 || !(nB.w > 0.0 && nA.w < nB.w)) { continue; }
            // Each bond keeps the distance their homes keep; across a flowing lattice's seam there is none.
            let rest = length(homeOf(ml, no) - home);
            if (rest > reach * 3.0) { continue; }
            let dd = nA.xyz - pos; let dist = length(dd);
            if (dist < 1e-5) { continue; }
            acc += dd / dist * (dist - rest) * kb + (nB.xyz - vel) * kv;
            strain = max(strain, abs(dist - rest) / max(rest, 1e-4));
          }
          // Struck: what is thrown at it hands it part of its motion, nearest along its step this frame.
          let h16 = lat(ml, 16); let h17 = lat(ml, 17);
          let total = h16.y + h16.w + h17.y; let hitR = g13.w;
          if (total > 0.5 && hitR > 0.0) {
            let samples = min(total, ${HIT_SAMPLES}.0);
            let shift = select(0.0, fract(uniform.uFrame * 0.618034), total > ${HIT_SAMPLES}.0);
            for (var s = 0; s < ${HIT_SAMPLES}; s++) {
              if (f32(s) >= samples) { break; }
              var n = floor((f32(s) + shift) * total / samples); var first = h16.x;
              if (n >= h16.y) { n -= h16.y; first = h16.z; if (n >= h16.w) { n -= h16.w; first = h17.x; } }
              let hi = i32(fmodf(first + n, ${N}.0) + 0.5);
              let hA = st(0, hi); let hB = st(1, hi);
              if (!(hB.w > 0.0 && hA.w < hB.w) || abs(st(4, hi).z - first) > 0.5) { continue; }
              let stride = hB.xyz * dt; let rel = pos - hA.xyz;
              let u = clamp(dot(rel, stride) / max(dot(stride, stride), 1e-8), 0.0, 1.0); let dist = length(rel - stride * u);
              if (dist < hitR) { vel += (hB.xyz - vel) * h17.z * (1.0 - dist / hitR); }
            }
          }
        } else if (lat(ml, 22).x > 0.5 && g10.z <= 0.0) {
          // Thrown: it steers at its point at the lattice's speed, arcing up over the way while far
          // off, its weight carried, and goes off once there (below).
          let g22 = lat(ml, 22);
          aim = aimOf(ml, home); thrown = true;
          let d = aim.xyz - pos; let dist = max(length(d), 1e-4);
          let want = normalize(d / dist + vec3f(0.0, lat(ml, 23).y * min(1.0, dist / 3.0), 0.0)) * g22.z;
          acc += (want - vel) * min(g22.y, 0.8 / dt) + vec3f(0.0, k0.y, 0.0);
        } else if (g10.z > 0.0) {
          // Loose, it is drawn home (reform), to bond again once there.
          // Its weight is carried home with it, or it would hang short of its place and never bond.
          let kr = min(g10.z, 0.5 * stiff);
          acc += (home - pos) * kr + (homeVel - vel) * min(2.0 * sqrt(kr), 0.8 / dt) + vec3f(0.0, k0.y, 0.0);
        }
        // A push (one frame): away from where it lands, fading with distance (towards it if negative).
        if (g14.w > 0.0) { let d = pos - g14.xyz; let dist = length(d); if (dist < g14.w && dist > 1e-5) { vel += d / dist * lat(ml, 15).x * (1.0 - dist / g14.w); } }
      }
      vel += acc * dt;
      // Turbulence steers the velocity towards the flow rather than adding to it forever.
      vel += (swirl - vel * 0.15) * min(1.0, dt * 3.0) * step(0.001, k0.z);
      vel *= exp(-k0.x * dt);
      // A law (\`law\`): its motion, in its own space, over everything above.
      if (member > ${LAW_BASE - .5}) {
        let ls = i32(member - ${LAW_BASE}.0 + 0.5);
        let l7 = law(ls, 7);
        if (ls < ${MAX_LAWS} && l7.x > 0.5) {
          if (l7.x < 1.5) {
            // Lorenz, by RK2 (the midpoint): it turns to the field's velocity at its grip.
            let v1 = lorenzAt(ls, pos);
            let v2 = lorenzAt(ls, pos + v1 * dt * 0.5);
            vel = mix(vel, v2, 1.0 - exp(-l7.z * dt));
          } else {
            // Galton: a fall decided beforehand. Above the top peg it steers onto it; crossing a row it is
            // put on that row's peg its path leads to and knocked half a peg gap the way its bit says, on a
            // hop timed to land on the next row's; past the last it falls straight.
            let p = law(ls, 6); let l8 = law(ls, 8);
            let rows = p.x; let gap = max(p.y, 0.01); let peg = p.z; let g = max(p.w, 0.01);
            var L = lawLocal(ls, pos); var lv = lawIn(ls, vel);
            let bits = u32(floor(seed * 65536.0));
            let jx = (rnd(id, 61u) - 0.5) * 2.0 * l8.y; let jz = (rnd(id, 62u) - 0.5) * 2.0 * l8.y;
            release *= exp(-10.0 * dt);
            lv.y -= g * dt;
            // The row it last met: a hop off a peg (never higher than a quarter of a gap) is still past it.
            let rowNow = max(-1.0, floor(-L.y / gap + 0.3));
            if (rowNow < -0.5) { lv.x = (jx - L.x) * 10.0; lv.z = (jz - L.z) * 10.0; }
            let r = rowNow + 1.0;
            if (-(L.y + lv.y * dt) / gap >= r && r < rows + 0.5) {
              var x = 0.0;
              for (var i = 0u; i < 16u; i++) { if (f32(i) >= r) { break; } x += select(-0.5, 0.5, ((bits >> i) & 1u) == 1u) * peg; }
              L = vec3f(x + jx, -r * gap, jz);
              if (r < rows - 0.5) {
                let side = select(-1.0, 1.0, ((bits >> u32(r)) & 1u) == 1u);
                let up = min(l8.z * abs(lv.y), sqrt(0.5 * g * gap));
                let t = (up + sqrt(up * up + 2.0 * g * gap)) / g;
                lv = vec3f(side * 0.5 * peg / t, up, 0.0);
                release = l8.x;
              } else { lv = vec3f(0.0, lv.y, 0.0); }
              pos = lawWorld(ls, L);
            }
            vel = lawTurn(ls, lv);
          }
          let speed = length(vel);
          if (speed > l7.w) { vel *= l7.w / speed; }
        }
      }
      var next = pos + vel * dt;
      // Volumes are glass: what is inside a containing one stays in, bouncing; the rest bounce off
      // them, or settle on an attracting one and slide.
      for (var v = 0; v < ${MAX_VOLUMES}; v++) {
        if (v >= volumes) { break; }
        let m = vol(v, 7);
        if (!affects(v, k)) { continue; }
        if (m.x > 3.5) {
          // A mirror: what crosses its surface this step is put back where it crossed, its velocity
          // reflected whole. Only the kinds that see mirrors; a dish only within its rim.
          if (kin(k, 13).x < 0.5) { continue; }
          let s = vol(v, 6); let dish = s.w > 3.5;
          let lp = vLocal(v, pos); let lq = vLocal(v, next);
          let hp = select(sdfOf(v, lp), dishAt(s, lp), dish); let hq = select(sdfOf(v, lq), dishAt(s, lq), dish);
          if (hp * hq < 0.0) {
            let hit = mix(lp, lq, hp / (hp - hq));
            if (!dish || length(hit.xz) <= s.y) {
              var n = normalOf(v, hit);
              if (dish) { n = normalize(vTurn(v, dishNormal(s, hit))); }
              vel -= n * dot(vel, n) * 2.0;
              next = vWorld(v, hit) + n * sign(hp) * 0.004;
            }
          }
          continue;
        }
        let dp = sdfOf(v, vLocal(v, pos));
        var ln = vLocal(v, next);
        var dn = sdfOf(v, ln);
        if (m.x < 0.5 && dp < 0.0) {
          if (dn > -0.012) {
            let n = normalOf(v, ln);
            next -= n * (dn + 0.012);
            // Near a tip one push may not get it back in: then it stays where it was, inside.
            if (sdfOf(v, vLocal(v, next)) > -0.001) { next = pos; }
            let vn = dot(vel, n);
            if (vn > 0.0) { vel -= n * vn * (1.0 + m.w); }
          }
        } else {
          // From outside (or, for the rest, anywhere: a fast step may have crossed it), checking the
          // middle of the step too, so nothing tunnels through.
          if (m.x > 0.5) { let mid = (pos + next) * 0.5; let lm = vLocal(v, mid); let dm = sdfOf(v, lm); if (dm < dn) { ln = lm; dn = dm; next = mid; } }
          if ((dp >= 0.0 || m.x > 0.5) && dn < 0.006) {
            let n = normalOf(v, ln);
            next += n * (0.006 - dn);
            let vn = dot(vel, n);
            if (vn < 0.0) { if (m.x > 2.5) { vel = (vel - n * vn) * 0.85; } else { vel -= n * vn * (1.0 + m.w); } }
          }
        }
      }
      // Thrown at a lattice: it meets the bonded members nearest its step, sharing its motion with
      // them, and bounces off (or is caught, a bounce below 0). Where it broke through, it flies on.
      if (ml < 0) {
        for (var l = 0; l < ${MAX_LATTICES}; l++) {
          let g6 = lat(l, 6); let h16 = lat(l, 16); let h17 = lat(l, 17);
          if (g6.y < 0.5) { continue; }
          if (!((h16.y > 0.5 && abs(group - h16.x) < 0.5) || (h16.w > 0.5 && abs(group - h16.z) < 0.5) || (h17.y > 0.5 && abs(group - h17.x) < 0.5))) { continue; }
          let hitR = lat(l, 13).w; var best = hitR;
          let seg = next - pos; var near = next;
          let guess = cellNear(l, (pos + next) * 0.5); var hit = -1;
          for (var d = -1; d < 6; d++) {
            var o = guess;
            if (d >= 0) { o = neighbourOf(l, guess, d); }
            if (o < 0) { continue; }
            let ni = slotOf(l, o);
            let nA = st(0, ni); let nB = st(1, ni); let nE = st(4, ni);
            if (abs(nE.w - f32(l + 1)) > 0.5 || abs(nE.z - g6.x) > 0.5 || !(nB.w > 0.0 && nA.w < nB.w)) { continue; }
            let u = clamp(dot(nA.xyz - pos, seg) / max(dot(seg, seg), 1e-8), 0.0, 1.0);
            let q = pos + seg * u; let dist = length(q - nA.xyz);
            if (dist < best) { best = dist; hit = ni; near = q; }
          }
          if (hit < 0) { continue; }
          let hA = st(0, hit); let hB = st(1, hit);
          let off = near - hA.xyz;
          var n = -normalize(seg + vec3f(0.0, 1e-6, 0.0));
          if (length(off) > 1e-4) { n = off / length(off); }
          vel -= (vel - hB.xyz) * h17.z;
          if (h17.w < 0.0) { age = life; }
          else { let vn = dot(vel - hB.xyz, n); if (vn < 0.0) { vel -= n * vn * (1.0 + h17.w); } next = hA.xyz + n * hitR; }
          break;
        }
      }
      if (k1.w > 0.5) {
        let fighters = i32(uniform.uCounts.z);
        for (var g = 0; g < ${MAX_FIGHTERS}; g++) {
          if (g >= fighters) { break; }
          let sphere = textureLoad(uFighters, vec2i(0, g), 0);
          if (length(next - sphere.xyz) > sphere.w) { continue; }
          let range = textureLoad(uFighters, vec2i(1, g), 0);
          for (var q = 0; q < ${MAX_PARTS}; q++) {
            if (q >= i32(range.y)) { break; }
            let p = i32(range.x) + q;
            let box = part4(6, p); let half_ = part4(7, p);
            var local = toLocal(p, next);
            let inset = abs(local - box.xyz) - half_.xyz - box.w;
            if (max(inset.x, max(inset.y, inset.z)) >= 0.0) { continue; }
            // Inside: out through the nearest face, bouncing off it and sliding along it.
            let axis = select(select(2, 1, inset.y > inset.z), select(2, 0, inset.x > inset.z), inset.x > inset.y);
            var offAxis = local.z - box.z;
            if (axis == 0) { offAxis = local.x - box.x; } else if (axis == 1) { offAxis = local.y - box.y; }
            let side = select(1.0, -1.0, offAxis < 0.0);
            if (axis == 0) { local.x = box.x + side * (half_.x + box.w); } else if (axis == 1) { local.y = box.y + side * (half_.y + box.w); } else { local.z = box.z + side * (half_.z + box.w); }
            let nrm = normalize(part4(axis, p).xyz) * side;
            next = toWorld(p, local);
            let vn = dot(vel, nrm);
            if (vn < 0.0) { let tangent = vel - nrm * vn; vel = tangent * (1.0 - k1.y) - nrm * vn * k1.x; }
            if (!bonded && rnd(id * 13u + frame, 31u) < k1.z) { part = f32(g * ${MAX_PARTS} + q + 1); release = age + k7.x * (0.5 + seed); vel = local; }
            break;
          }
          if (part > 0.5) { break; }
        }
        let ground = floorAt(next);
        if (part < 0.5 && next.y < ground) {
          next.y = ground + 0.005;
          if (vel.y < 0.0) { vel.y = -vel.y * k1.x; }
          vel = vec3f(vel.x * (1.0 - k1.y), vel.y, vel.z * (1.0 - k1.y));
          if (k9.x > -0.5 && !bonded) { kind = k9.x; age = 0.0; life = lifeOf(kind, seed); vel *= 0.4; }
          else if (k7.y > 0.5 && length(vel) < 0.6 && !bonded) { part = -1.0; vel = vec3f(0.0); }
        }
      }
      pos = next;
      if (ml >= 0) {
        let g10 = lat(ml, 10); let g15 = lat(ml, 15);
        let dissolving = g15.y > 0.0 && rankOf(ml, mo, pos, seed) < g15.y;
        if (thrown && length(aim.xyz - pos) < aim.w) {
          // Thrown, it reaches its point and goes off: free of its lattice, it scatters as its onDeath.
          let r = id * 13u + frame;
          vel = unitVec(rnd(r, 41u), rnd(r, 42u)) * lat(ml, 22).w * (0.35 + 0.65 * rnd(r, 43u)) + vel * 0.12;
          member = 0.0; link = -1.0; chainPos = 0.0;
          if (k9.y > -0.5) { kind = k9.y; age = 0.0; life = lifeOf(kind, seed); } else { age = life; }
        } else if (bonded) {
          // A bond stretched past its toughness snaps, or the lattice dissolves under it, or a string
          // snaps by it: it breaks loose.
          let burst = rupturedAt(ml, pos);
          if ((g10.x > 0.0 && strain > g10.x) || dissolving || snappedAt(ml, mo) || burst) {
            member = -member; link = -1.0;
            let f1 = lat(ml, ${FILM_COL + 1});
            let r = id * 13u + frame;
            // A film bursts: its rim runs past it, flinging it out from the hole.
            if (burst) {
              let away = pos - lWorld(ml, lat(ml, ${RUPTURE_COL}).xyz);
              vel += (away / max(length(away), 1e-4) + unitVec(rnd(r, 44u), rnd(r, 45u)) * 0.35) * f1.w * (0.5 + 0.5 * rnd(r, 46u));
            }
            // A film (but its rings) or what bursts sheds a share of itself as its breakInto (droplets,
            // motes), and the rest is gone; anything else breaks into it whole.
            if (burst || (lat(ml, ${FILM_COL}).x > 0.5 && !onRim(ml, mo))) {
              if (rnd(r, 47u) < f1.z && g10.y > -0.5) { kind = g10.y; age = 0.0; life = lifeOf(kind, seed); } else { age = life; }
            } else if (g10.y > -0.5) { kind = g10.y; age = 0.0; life = lifeOf(kind, seed); }
          }
          // How strained it is, on a shield's rim how much brighter its outline is, and how far a
          // string's pulse lifts it, for its glow.
          else { release = select(strain, strain / g10.x, g10.x > 0.0) * lat(ml, 11).w + select(0.0, lat(ml, 19).w, onRim(ml, mo)) + travelGlow(ml, mo) * lat(ml, ${TRAVEL_COL + MAX_PULSES}).y; }
        } else if (g10.z > 0.0 && !dissolving && length(homeOf(ml, mo) - pos) < lat(ml, 19).x * 0.4) {
          // Home again: it bonds, as the lattice's own kind.
          member = -member; kind = g10.w; life = lat(ml, 19).y; age = life * g15.w; part = 0.0;
          link = rowLeader(ml, mo);
        }
      }
    }
    age += dt;
    // A member holds at its prime while bonded (or on its way home), and ages on once loose.
    if (ml >= 0 && (member > 0.0 || lat(ml, 10).z > 0.0)) { age = min(age, life * lat(ml, 15).w); }
    // Alight (\`ignite\`): its delay run out, it becomes what it burns as.
    if (release < 0.0 && abs(member) < 0.5 && part < 0.5 && age >= -release) {
      let into = kin(i32(kind), 14).x;
      if (into > -0.5) { kind = into; age = 0.0; life = lifeOf(kind, seed); }
      release = 0.0;
    }
    // Dying, it may become something else where it is.
    if (age >= life && k9.y > -0.5 && part < 0.5) { kind = k9.y; age = 0.0; life = lifeOf(kind, seed); vel *= 0.3; link = -1.0; part = 0.0; }
    // The moment after its birth, kept for a \`rewind\` to play back through.
    if (age < ${REWIND.mid}) { mid = pos; }
  }
  if (band == 0) { output.color = vec4f(pos, age); }
  else if (band == 1) { output.color = vec4f(vel, life); }
  else if (band == 2) { output.color = vec4f(kind, seed, part, size); }
  else if (band == 3) { output.color = vec4f(release, tint); }
  else if (band == 4) { output.color = vec4f(link, chainPos, group, member); }
  else if (band == 5) { output.color = vec4f(origin, 0.0); }
  else { output.color = vec4f(mid, 0.0); }
  return output;
}`;

// ── Drawing ─────────────────────────────────────────────────────────────────────────────────────


const DRAW_VS_WGSL = /* wgsl */ `
attribute vertex_position: vec3f;
attribute aIndex: vec4f;
uniform matrix_viewProjection: mat4x4f;
uniform matrix_view: mat4x4f;
uniform uTime: f32;
var uState: texture_2d<uff>;
var uKinds: texture_2d<uff>;
var uLattices: texture_2d<uff>;
varying vUv: vec2f;
varying vColour: vec4f;
varying vLook: vec4f;
varying vGlass: f32;
varying vCore: f32;
varying vFloor: vec4f;
varying vAge: vec3f;
fn st(band: i32, index: i32) -> vec4f { return textureLoad(uState, vec2i(index % ${W}, index / ${W} + band * ${H}), 0); }
fn kin(k: i32, c: i32) -> vec4f { return textureLoad(uKinds, vec2i(c, k), 0); }
fn fmodf(x: f32, y: f32) -> f32 { return x - y * floor(x / y); }
fn lat(l: i32, c: i32) -> vec4f { return textureLoad(uLattices, vec2i(c, l), 0); }
${latticeRippleWgsl}
// Thin-film interference, as this game paints it: from how thick a film is (0–1 fresh), back and forth
// along gold → white → cyan → teal water blue (#2aa8d8), never through magenta or violet: its last stop has as
// much green as blue in it, so gold laid over it sums to a warm white, never lilac.
fn filmRamp(h: f32) -> vec3f {
  let t = 1.0 - abs(fract(h * 1.35) * 2.0 - 1.0);
  let gold = vec3f(1.0, 0.6, 0.1); let white = vec3f(1.0, 0.95, 0.78); let cyan = vec3f(0.12, 0.88, 0.78); let blue = vec3f(0.165, 0.66, 0.85);
  if (t < 0.22) { return mix(gold, white, t / 0.22); }
  if (t < 0.55) { return mix(white, cyan, (t - 0.22) / 0.33); }
  return mix(cyan, blue, (t - 0.55) / 0.45);
}
fn crackMix(x: u32) -> u32 { let v = x * 747796405u + 2891336453u; let w = ((v >> ((v >> 28u) + 4u)) ^ v) * 277803737u; return (w >> 22u) ^ w; }
// A hash of two whole numbers and a salt, 0…1 (integer, so the GPU gives the same as anywhere).
fn crackHash(a: f32, b: f32, salt: u32) -> f32 {
  return f32(crackMix((u32(i32(a) + 4096) * 73856093u) ^ (u32(i32(b) + 4096) * 19349663u) ^ crackMix(salt)) >> 8u) / 16777215.0;
}
// A web of cracks over a lattice's cells (0…1 round it, 0…1 up it), as its amount (0–1) opens them:
// how deep in a crack a cell is (x) and how much on its lip (y). Cells of a Voronoi web, wrapped round,
// a little jagged; each crack (the edge between two of them) opens at its own share of the damage.
fn crackAt(cell: vec2f, amount: f32, seed: f32) -> vec2f {
  let K = vec2f(6.0, 2.0);
  let salt = u32(max(seed, 0.0));
  let turn = f32(salt % 97u) * 0.37;
  let wob = vec2f(sin(cell.y * 37.0 + turn) * 0.12 + sin(cell.y * 91.0 + turn * 1.7) * 0.05, sin(cell.x * 6.2831853 * 3.0 + turn * 0.6) * 0.1);
  let p = cell * K + wob;
  let base = floor(p);
  var d1 = 9.0; var d2 = 9.0; var id1 = vec2f(0.0); var id2 = vec2f(0.0);
  for (var y = -1; y <= 1; y++) {
    for (var x = -1; x <= 1; x++) {
      let c = base + vec2f(f32(x), f32(y));
      let id = vec2f(c.x - K.x * floor(c.x / K.x), c.y);
      let site = c + 0.15 + 0.7 * vec2f(crackHash(id.x, id.y, salt), crackHash(id.x, id.y, salt + 7919u));
      let d = length(p - site);
      if (d < d1) { d2 = d1; id2 = id1; d1 = d; id1 = id; } else if (d < d2) { d2 = d; id2 = id; }
    }
  }
  let edge = d2 - d1;
  let h = crackHash(id1.x + id2.x + 64.0 * abs(id1.x - id2.x), id1.y + id2.y + 64.0 * abs(id1.y - id2.y), salt + 104729u) * 0.85;
  let open = smoothstep(h, h + 0.12, amount);
  let width = max((0.1 + 0.18 * amount) * open, 1e-4);
  let inside = (1.0 - smoothstep(width * 0.5, width, edge)) * open;
  let lip = (1.0 - smoothstep(width, width * 1.8 + 0.05, edge)) * open;
  return vec2f(inside, max(lip - inside, 0.0));
}
@vertex
fn vertexMain(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;
  let i = i32(aIndex.x);
  let A = st(0, i); let B = st(1, i); let C = st(2, i); let D = st(3, i); let E = st(4, i);
  if (!(B.w > 0.0 && A.w < B.w)) {
    output.position = vec4f(2.0, 2.0, 2.0, 1.0); output.vUv = vec2f(0.0); output.vColour = vec4f(0.0); output.vLook = vec4f(0.0); output.vGlass = 0.0; output.vCore = 0.0; output.vFloor = vec4f(0.0); output.vAge = vec3f(0.0);
    return output;
  }
  let k = i32(C.x);
  let c0 = kin(k, 2); let c1 = kin(k, 3); let c2 = kin(k, 4); let s = kin(k, 5); let f = kin(k, 6); let k7 = kin(k, 7); let k10 = kin(k, 10);
  let t = clamp(A.w / B.w, 0.0, 1.0);
  let seed = C.y;
  var colour = mix(c1.rgb, c2.rgb, (t - c1.w) / (1.0 - c1.w));
  if (t < c1.w) { colour = mix(c0.rgb * c0.w, c1.rgb, t / c1.w); }
  colour *= D.yzw;
  // A lattice's bonded member glows brighter the more it is strained.
  if (E.w > 0.5) { colour *= 1.0 + D.x; }
  var alpha = c2.w * min(1.0, t / max(f.x, 0.001)) * min(1.0, (1.0 - t) / max(f.y, 0.001));
  alpha *= 1.0 - f.w * (0.5 + 0.5 * sin(uniform.uTime * (6.0 + seed * 9.0) + seed * 40.0));
  // Blurred, its quad grows so the soft halo is never cut; the shape keeps its own size.
  let blur = mix(k10.z, k10.w, t); let expand = 1.0 + blur * 0.8;
  // A pool of paint spreads as it lands, in a third of a second, and then stays as it is.
  let grown = select(t, 1.0 - exp(-A.w * 9.0), s.w > 11.5);
  var size = mix(s.x, s.y, grown) * C.w * expand;
  // Each particle a touch brighter or dimmer than its kind, so a burst never looks flat.
  colour *= 0.86 + 0.28 * fract(seed * 7.13);
  let shape = s.w;
  let view = uniform.matrix_view;
  let right = vec3f(view[0][0], view[1][0], view[2][0]);
  let up = vec3f(view[0][1], view[1][1], view[2][1]);
  let back = vec3f(view[0][2], view[1][2], view[2][2]);
  // A lattice's member takes its lattice's opacity, and with \`fresnel\` turns see-through where its
  // surface faces you and bright along its outline: a body of glass.
  if (abs(E.w) > 0.5) {
    let l = i32(abs(E.w) + 0.5) - 1;
    if (l < ${MAX_LATTICES}) {
      let g6 = textureLoad(uLattices, vec2i(6, l), 0);
      if (g6.y > 0.5 && abs(g6.x - E.z) < 0.5) {
        let g20 = textureLoad(uLattices, vec2i(20, l), 0); let g21 = textureLoad(uLattices, vec2i(21, l), 0);
        let form = textureLoad(uLattices, vec2i(7, l), 0).y;
        var facingDir = A.xyz - g20.xyz + vec3f(0.0, 1e-5, 0.0);
        if (form > 7.5 && form < 8.5) {
          // A catenoid's surface faces out from its axis.
          let axis = normalize(vec3f(textureLoad(uLattices, vec2i(0, l), 0).y, textureLoad(uLattices, vec2i(1, l), 0).y, textureLoad(uLattices, vec2i(2, l), 0).y));
          facingDir = facingDir - axis * dot(facingDir, axis) + vec3f(0.0, 1e-5, 0.0);
        }
        let facing = abs(dot(normalize(facingDir), back));
        alpha *= g20.w * mix(1.0, 0.08 + 0.92 * pow(1.0 - facing, 1.5), g21.x);
        // Its look: the colour its members turn to (as bright as they were), and its cracks.
        let look = textureLoad(uLattices, vec2i(${LOOK_COL}, l), 0);
        if (look.y > 0.001) {
          let packed = u32(look.x + 0.5);
          let to = vec3f(f32((packed >> 16u) & 255u), f32((packed >> 8u) & 255u), f32(packed & 255u)) / 255.0;
          colour = mix(colour, to * max(max(colour.r, colour.g), max(colour.b, 0.05)) / max(max(to.r, to.g), max(to.b, 0.05)), look.y);
        }
        // A soap film: thin-film colour from how thick it is where the member sits, thinner up top as it
        // drains and swirling; black film (nothing) where it is thinnest. Its first and last rows (a
        // catenoid's rings) keep their own colour, bigger.
        let film = textureLoad(uLattices, vec2i(${FILM_COL}, l), 0);
        let film1 = textureLoad(uLattices, vec2i(${FILM_COL + 1}, l), 0);
        if (film.x > 0.5 && E.w > 0.5) {
          let mo = fmodf(f32(i) - E.z + ${N}.0, ${N}.0);
          let ii = fmodf(floor(mo + 0.5), g6.z); let jj = fmodf(floor((mo + 0.5) / g6.z), g6.w);
          let cx = (ii + 0.5) / g6.z; let cy = (jj + 0.5) / g6.w;
          if (g6.w > 1.5 && (jj < 0.5 || jj > g6.w - 1.5)) { size *= 1.6; colour *= 1.5; }
          else {
            let a = cx * 6.2831853; let t = film1.x; let phase = textureLoad(uLattices, vec2i(11, l), 0).z;
            let swirl = 0.5 * sin(a * 2.0 + cy * 5.0 + t * 0.9 + phase) + 0.35 * sin(a * 3.0 - cy * 7.0 - t * 1.3) + 0.15 * sin(a + cy * 11.0 + t * 0.6 + phase * 0.5);
            // A ripple running across it thickens and thins it as it goes: rings of colour.
            let q3 = lat(l, 3); let q4 = lat(l, 4); let q5 = lat(l, 5);
            let ownAt = vec3f(dot(q3.xyz, A.xyz) + q3.w, dot(q4.xyz, A.xyz) + q4.w, dot(q5.xyz, A.xyz) + q5.w);
            let wave = rippleOf(l, ownAt) / max(lat(l, ${RIPPLE_COL + MAX_RIPPLES}).x, 1e-4);
            let h = film.y * max(0.0, 1.0 + film.z * (0.5 - cy) * 1.7) * (1.0 + film.w * 0.35 * swirl) * (1.0 + 0.8 * wave);
            colour = filmRamp(h) * max(max(colour.r, colour.g), max(colour.b, 0.05));
            alpha *= smoothstep(0.03, 0.16, h);
          }
        }
        // Bursting: the rim of the hole, running back, is bright and thick.
        let rup = textureLoad(uLattices, vec2i(${RUPTURE_COL}, l), 0);
        if (rup.w > 0.0 && E.w > 0.5) {
          let r3 = textureLoad(uLattices, vec2i(3, l), 0); let r4 = textureLoad(uLattices, vec2i(4, l), 0); let r5 = textureLoad(uLattices, vec2i(5, l), 0);
          let own = vec3f(dot(r3.xyz, A.xyz) + r3.w, dot(r4.xyz, A.xyz) + r4.w, dot(r5.xyz, A.xyz) + r5.w);
          let band = 1.0 - smoothstep(0.0, max(film1.y, 1e-3), length(own - rup.xyz) - rup.w);
          colour = mix(colour, vec3f(2.4, 2.9, 3.0), band * 0.75);
          alpha = mix(alpha, 1.0, band);
          size *= 1.0 + band * 1.3;
        }
        if (look.z > 0.001) {
          // Where on it the member is, from where it stands in the lattice's own space (0…1 each way):
          // round and up a sphere or a dome, across and up anything else.
          let w3 = textureLoad(uLattices, vec2i(3, l), 0); let w4 = textureLoad(uLattices, vec2i(4, l), 0); let w5 = textureLoad(uLattices, vec2i(5, l), 0);
          let own = vec3f(dot(w3.xyz, A.xyz) + w3.w, dot(w4.xyz, A.xyz) + w4.w, dot(w5.xyz, A.xyz) + w5.w);
          let half = max(textureLoad(uLattices, vec2i(8, l), 0).xyz, vec3f(1e-4));
          var cell = own.xy / half.xy * 0.5 + 0.5;
          if (form > 7.5 && form < 8.5) { cell = vec2f(fract(atan2(own.z, own.x) / 6.2831853 + 1.0), own.y / half.y * 0.5 + 0.5); }
          else if (form > 8.5) { cell = vec2f(own.x / half.x * 0.5 + 0.5, 0.5); }
          else if (form > 5.5) {
            let u = vec3f(own.x / half.x, own.y / half.y, own.z / half.x);
            let up = acos(clamp(u.y / max(length(u), 1e-5), -1.0, 1.0)) / select(1.5707963, 0.78539816, form > 6.5);
            cell = vec2f(fract(atan2(u.z, u.x) / 6.2831853 + 1.0), clamp(1.0 - up * 0.5, 0.0, 1.0));
          }
          let crack = crackAt(cell, look.z, look.w);
          // In the crack it is a gap; along its lips the bits are bigger and bright, strained; the rest of it dims as it gives way.
          alpha = mix(alpha * (1.0 - 0.45 * look.z), 0.0, crack.x);
          alpha = mix(alpha, 1.0, crack.y);
          colour = mix(colour * (1.0 - 0.4 * look.z), vec3f(3.2, 3.5, 3.6), crack.y);
          size *= 1.0 + 1.3 * crack.y;
        }
      }
    }
  }
  let corner = vertex_position.xy;
  var world = A.xyz;
  var drawn = false;
  // A strand: a ribbon from its leader to itself, so a chain reads as one line.
  // A lattice's rows join only members still bonded to it, and only across a cell or two (E.y < 0).
  if (shape > 8.5 && shape < 9.5 && E.x > -0.5) {
    let L = st(0, i32(E.x)); let LB = st(1, i32(E.x));
    let onScreen = vec2f(dot(A.xyz - L.xyz, right), dot(A.xyz - L.xyz, up));
    let len = length(onScreen);
    let reach = select(1.5, -E.y, E.y < 0.0);
    let joined = abs(E.w) < 0.5 || (E.w > 0.5 && abs(st(4, i32(E.x)).w - E.w) < 0.5);
    if (LB.w > 0.0 && L.w < LB.w && len > 0.0005 && len < reach && joined) {
      let dir = onScreen / len;
      let across = up * dir.x - right * dir.y;
      world = mix(L.xyz, A.xyz, corner.x * 0.5 + 0.5) + across * corner.y * size * (1.0 - max(E.y, 0.0) * 0.7);
      drawn = true;
    }
  }
  if (!drawn) {
    // Lines, streaks and shards stretch along their motion; the rest turn as they spin.
    let vel = select(B.xyz, vec3f(0.0), C.z > 0.5);
    var onScreen = vec2f(dot(vel, right), dot(vel, up)) * s.z;
    var tail = min(length(onScreen), 0.8);
    // A spark is never round: a few times longer than it is wide, pointing the way it flies (up when still).
    let spark = shape > 9.5 && shape < 10.5;
    if (spark) { if (tail < 0.0005) { onScreen = vec2f(0.0, 0.001); } tail = max(tail, size * 3.0); }
    let stretched = (shape > 0.5 && shape < 1.5) || (shape > 3.5 && shape < 5.5) || spark;
    // A stain lies on the floor: its quad is spread over the ground, a hair above it, turned its own way.
    if (kin(k, 9).z > 0.5) {
      let angle = seed * 6.2831853;
      let c = cos(angle); let sn = sin(angle);
      let q = vec2f(c * corner.x - sn * corner.y, sn * corner.x + c * corner.y) * size * vec2f(1.0, 0.72 + 0.28 * fract(seed * 3.7));
      world = A.xyz + vec3f(q.x, 0.012, q.y);
    } else if (stretched && tail > 0.0005) {
      let dir = onScreen / length(onScreen);
      let along = right * dir.x + up * dir.y;
      let across = up * dir.x - right * dir.y;
      let halfLength = size + tail * 0.5;
      let width = select(size, size * k10.y, (shape > 3.5 && shape < 4.5) || spark);
      world = A.xyz - along * (tail * 0.5) + along * (corner.x * halfLength) + across * (corner.y * width);
    } else {
      var angle = seed * 6.2831853 + k7.w * (seed * 2.0 - 1.0) * A.w;
      if (shape > 1.5 && shape < 2.5) { angle = 1.5707963; }
      // Beads are lit from one side: they never turn, or their glint would spin with them.
      if ((shape > 7.5 && shape < 8.5) || (shape > 10.5 && shape < 11.5)) { angle = 0.0; }
      let c = cos(angle); let sn = sin(angle);
      var q = vec2f(c * corner.x - sn * corner.y, sn * corner.x + c * corner.y) * size;
      if (shape > 3.5 && shape < 4.5) { q.y *= k10.y; }
      world = A.xyz + right * q.x + up * q.y;
    }
  }
  world += back * select(0.0, 0.06, C.z > 0.5);
  output.vUv = corner * expand;
  output.vColour = vec4f(colour, alpha);
  output.vLook = vec4f(shape, seed, f.z, blur);
  output.vGlass = k7.z;
  output.vCore = kin(k, 11).z;
  // For a pool of paint: where this corner is in the plane it lies in, and which way in that plane
  // the light comes from (the screen's upper left, as beads are lit), so every pool shines the same
  // way and pools that touch read as one. On the floor that plane is the floor (and its quad is
  // squashed); clinging to someone it is the screen.
  let lit = right * -0.55 + up * 0.6;
  let onFloor = vec2f(lit.x, lit.z);
  var plane = vec4f(world.x, world.z, onFloor / max(length(onFloor), 0.0001));
  var squash = 0.72 + 0.28 * fract(seed * 3.7);
  if (kin(k, 9).z < 0.5) { plane = vec4f(dot(world, right), dot(world, up), -0.6757, 0.7372); squash = 1.0; }
  output.vFloor = plane;
  output.vAge = vec3f(A.w, t, squash);
  output.position = uniform.matrix_viewProjection * vec4f(world, 1.0);
  return output;
}`;

const DRAW_FS_WGSL = /* wgsl */ `
#include "gammaPS"
#include "tonemappingPS"
#include "fogPS"
uniform uLight: vec3f;
varying vUv: vec2f;
varying vColour: vec4f;
varying vLook: vec4f;
varying vGlass: f32;
varying vCore: f32;
varying vFloor: vec4f;
varying vAge: vec3f;
fn hash(p: vec2f) -> f32 { return fract(sin(dot(p, vec2f(127.1, 311.7))) * 43758.5453); }
fn noise(p: vec2f) -> f32 { let i = floor(p); var f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(hash(i), hash(i + vec2f(1.0, 0.0)), f.x), mix(hash(i + vec2f(0.0, 1.0)), hash(i + vec2f(1.0, 1.0)), f.x), f.y); }
// Each shape: how covered (a), how white-hot (white) and how its colour is tinted at uv.
struct Shape { a: f32, white: f32, tint: vec3f, shine: f32 };
// A tapering ray along x, w sharp across, reaching len.
fn ray(p: vec2f, w: f32, len: f32) -> f32 { return exp(-abs(p.y) * w) * smoothstep(len, 0.0, abs(p.x)); }
fn shapeAt(uv: vec2f, shape: f32, seed: f32, aa: f32, light: f32) -> Shape {
  var sh: Shape; sh.a = 0.0; sh.white = 0.0; sh.tint = vec3f(1.0); sh.shine = 0.0;
  let r = length(uv);
  if (shape < 0.5) {
    // Light: a white-hot pinpoint, a body of its colour and a faint halo, fading to nothing at the edge.
    var edge = clamp(1.0 - r * r, 0.0, 1.0); edge *= edge;
    let core = exp(-r * r * 60.0); let body = exp(-r * r * 9.0); let halo = 0.12 / (1.0 + r * r * 40.0);
    sh.a = (core + body * 0.55 + halo) * edge;
    sh.white = core * 0.9 + body * 0.1;
  } else if (shape < 1.5) {
    let across = 1.0 - uv.y * uv.y;
    sh.a = across * across * across * smoothstep(-1.0, -0.3, uv.x) * smoothstep(1.0, 0.6, uv.x);
    sh.white = pow(max(0.0, 1.0 - abs(uv.y)), 6.0) * smoothstep(-0.4, 0.7, uv.x) * 0.8;
  } else if (shape < 2.5) {
    // A tongue of flame: round at its root, licking up to a point at its head, ragged by noise.
    let n = noise(vec2f(uv.x * 2.5 + seed * 17.0, uv.y * 3.0));
    let w = mix(1.0, 0.2, smoothstep(-0.6, 1.0, uv.x)) * (0.75 + 0.5 * n);
    sh.a = smoothstep(1.0, 0.2, abs(uv.y) / w) * smoothstep(-1.0, -0.55, uv.x) * smoothstep(1.0, 0.7, uv.x);
    sh.white = smoothstep(0.5, 0.0, abs(uv.y)) * smoothstep(0.2, -0.6, uv.x) * 0.4;
  } else if (shape < 3.5) {
    let n = noise(uv * 2.2 + seed * 37.0) * 0.6 + noise(uv * 4.8 - seed * 11.0) * 0.4;
    sh.a = smoothstep(1.0, 0.25, r + (n - 0.5) * 0.7) * 0.8;
    sh.tint *= uniform.uLight * (0.85 + n * 0.3);
  } else if (shape < 4.5) {
    // A crisp little line, its ends rounded.
    sh.a = smoothstep(1.0, 0.55, abs(uv.y)) * smoothstep(1.0, 0.75, abs(uv.x));
    sh.white = smoothstep(0.6, 0.0, abs(uv.y)) * 0.5;
  } else if (shape < 5.5) {
    // A shard: a sharp diamond with a lit facet.
    let d = abs(uv.x) * 0.55 + abs(uv.y);
    sh.a = smoothstep(1.0, 0.86, d);
    sh.white = smoothstep(0.5, 0.0, d) * 0.4 + step(0.0, uv.y) * step(0.0, uv.x) * 0.25;
  } else if (shape < 6.5) {
    let d = (r - 0.78) / 0.12;
    sh.a = exp(-d * d) * smoothstep(1.0, 0.92, r);
    sh.white = exp(-d * d * 3.0) * 0.3;
  } else if (shape < 7.5) {
    // A star: four fine tapering rays, four shorter ones between them, a hot core and a soft glow.
    let rd = vec2f(uv.x + uv.y, uv.x - uv.y) * 0.7071;
    let main = max(ray(uv, 28.0, 1.0), ray(uv.yx, 28.0, 1.0));
    let diag = max(ray(rd, 36.0, 0.55), ray(rd.yx, 36.0, 0.55)) * 0.6;
    let core = exp(-r * r * 30.0);
    sh.a = (max(main, diag) + core + exp(-r * r * 6.0) * 0.25) * clamp(1.0 - r * r, 0.0, 1.0);
    sh.white = core * 0.8 + main * 0.3;
  } else if (shape < 8.5 && light > 0.5) {
    // A dot of light: a round orb, smooth-edged, white-hot in the middle and glowing just outside.
    let edge = 1.0 - smoothstep(0.62 - aa, 0.86 + aa, r);
    let core = exp(-r * r * 14.0);
    sh.a = edge * 0.55 + core * 0.7 + exp(-r * r * 3.0) * 0.18 * clamp(1.0 - r * r, 0.0, 1.0);
    sh.white = core * 0.75;
  } else if (shape < 8.5) {
    // A bead (matter: gum, frost): a little lit sphere, crisp but smooth-edged, shaded from the upper
    // left with a glint and a brighter rim, and a faint glow just outside it.
    let edge = 1.0 - smoothstep(0.86 - aa, 0.86 + aa, r);
    let n = vec3f(uv / 0.86, sqrt(max(0.0, 1.0 - dot(uv, uv) / 0.7396)));
    let diffuse = 0.55 + 0.45 * max(0.0, dot(n, vec3f(-0.4, 0.55, 0.73)));
    let spec = pow(max(0.0, dot(n, vec3f(-0.24, 0.34, 0.91))), 40.0);
    let rim = pow(1.0 - n.z, 2.0);
    let outside = exp(-max(r - 0.86, 0.0) * 18.0) * (1.0 - edge) * 0.35 * smoothstep(1.0, 0.86, r);
    sh.a = edge + outside;
    sh.tint *= mix(vec3f(diffuse * (0.85 + rim * 0.5)), vec3f(1.0), 1.0 - edge);
    sh.white = spec * edge;
  } else if (shape < 9.5) {
    // A strand: a soft-edged ribbon with a hot core.
    sh.a = smoothstep(1.0, 0.25, abs(uv.y));
    sh.white = smoothstep(0.5, 0.0, abs(uv.y)) * 0.55;
  } else if (shape > 10.5) {
    // Pigment: a lump of dry powder, or a grain of it. Matte: it takes the scene's light and has none
    // of its own. Dense in its middle and thinning out to a fringe that breaks into grains, shaded
    // as a soft ball from the upper left, so many of them overlapping read as one billowing cloud.
    // (A pool, 12, is drawn by poolAt.)
    let n = noise(uv * 2.4 + seed * 37.0) * 0.6 + noise(uv * 5.5 - seed * 11.0) * 0.4;
    let cloud = smoothstep(1.0, 0.1, r + (n - 0.5) * 0.75);
    let grit = noise(uv * 24.0 + seed * 91.0);
    sh.a = smoothstep(0.0, 0.3, cloud + (grit - 0.5) * 0.35) * (0.35 + 0.65 * cloud);
    let nz = sqrt(max(0.0, 1.0 - min(r * r, 1.0)));
    let diffuse = 0.62 + 0.5 * max(0.0, dot(vec3f(uv * 0.9, nz), vec3f(-0.4, 0.55, 0.73)));
    // Lit by the place and by nothing of its own; in a dark place it keeps a floor of plain light, or its colours would be lost.
    sh.tint *= max(uniform.uLight, vec3f(0.55)) * diffuse * (0.86 + 0.28 * n);
  } else {
    // A spark: a thin streak, white-hot at its head, its own colour behind it, cooling to deep red
    // down a tail that tapers and fades.
    let along = uv.x * 0.5 + 0.5;
    let w = mix(0.3, 1.0, smoothstep(0.05, 0.8, along));
    sh.a = smoothstep(1.0, 0.3, abs(uv.y) / w) * smoothstep(1.0, 0.82, uv.x) * smoothstep(0.0, 0.35, along) * (0.35 + 0.65 * along);
    sh.tint *= mix(vec3f(0.85, 0.2, 0.05), vec3f(1.0), smoothstep(0.1, 0.75, along));
    sh.white = smoothstep(0.6, 0.95, along) * smoothstep(0.7, 0.0, abs(uv.y)) * 0.85;
  }
  return sh;
}
// A pool of wet paint lying on the floor: a lobed blot, thicker in the middle, with a bright line
// along the edge that faces the light and a shadow along the other, and patches of the sky's light
// lying on it. The patches are placed on the floor, not on the particle, so pools that overlap
// shine as one. It dries: the shine goes over the last part of its life and leaves it matte.
fn poolAt(uv: vec2f, seed: f32, aa: f32) -> Shape {
  var sh: Shape; sh.white = 0.0; sh.shine = 0.0;
  let r = length(uv);
  let dir = uv / max(r, 0.0001);
  let reach = 0.56 + 0.36 * noise(dir * 1.7 + seed * 31.0) + 0.07 * noise(dir * 5.0 + seed * 7.0);
  let d = r / reach;
  sh.a = 1.0 - smoothstep(1.0 - aa * 2.0 - 0.03, 1.0, d);
  // The way out of the pool at this point, on the floor (its quad is turned by its seed and squashed).
  let angle = seed * 6.2831853; let c = cos(angle); let sn = sin(angle);
  let squashed = dir * vec2f(1.0, vAge.z);
  let outward = normalize(vec2f(c * squashed.x - sn * squashed.y, sn * squashed.x + c * squashed.y) + vec2f(0.00001, 0.0));
  let toLight = dot(outward, vFloor.zw);
  let wet = 1.0 - smoothstep(0.55, 0.95, vAge.y);
  let dome = clamp(1.0 - d * d, 0.0, 1.0);
  let lip = smoothstep(0.62, 0.9, d) * (1.0 - smoothstep(0.93, 1.0, d));
  // The sky lying on it: soft patches stretched across the light's way, steadier in the thick middle.
  let w = vFloor.xy;
  let across = vec2f(dot(w, vFloor.zw) * 2.2, dot(w, vec2f(-vFloor.w, vFloor.z)) * 6.5);
  let sky = smoothstep(0.56, 0.74, noise(across + 3.7) * 0.75 + noise(across * 2.3 - 9.1) * 0.25) * (0.35 + 0.65 * dome);
  let glint = lip * pow(max(0.0, toLight), 1.5);
  let shade = 1.0 - 0.3 * lip * max(0.0, -toLight) - 0.12 * (1.0 - dome);
  sh.tint = uniform.uLight * shade * mix(1.0, 0.84, wet);
  sh.shine = (sky * 1.0 + glint * 2.2) * wet * sh.a;
  return sh;
}
@fragment
fn fragmentMain(input: FragmentInput) -> FragmentOutput {
  var output: FragmentOutput;
  let shape = vLook.x; let blur = vLook.w;
  // How much uv a pixel spans, for smooth edges (taken here, in uniform control flow, as WGSL requires).
  let aa = max(fwidth(length(vUv)), 0.002) * 1.2;
  var sh = shapeAt(vUv, shape, vLook.y, aa, vLook.z);
  if (shape > 11.5) { sh = poolAt(vUv, vLook.y, aa); }
  // Blurred: the shape averaged over five points, as if out of focus.
  if (blur > 0.001) {
    let o = blur * 0.55;
    var total = sh.a;
    var tint = sh.tint * sh.a;
    for (var i = 0; i < 4; i++) {
      let d = vec2f(select(o, -o, i < 2), select(o, -o, i == 0 || i == 2));
      let t = shapeAt(vUv + d, shape, vLook.y, aa, vLook.z);
      total += t.a; sh.white += t.white; tint += t.tint * t.a;
    }
    sh.tint = select(sh.tint, tint / total, total > 0.0001);
    sh.a = total / 5.0; sh.white /= 5.0;
  }
  // Glass: its middle see-through, its edge kept, a glint up on its left.
  if (vGlass > 0.001) {
    let r = length(vUv);
    let hollow = 0.1 + 0.9 * smoothstep(0.25, 0.8, r);
    let g = vUv - vec2f(-0.3, 0.32);
    let glint = exp(-dot(g, g) * 45.0) * step(r, 0.9);
    sh.a = mix(sh.a, sh.a * hollow + glint * 0.8, vGlass);
    sh.white = mix(sh.white, sh.white * hollow + glint, vGlass);
  }
  var a = sh.a; let white = sh.white * vCore;
  var colour = vColour.rgb * sh.tint;
  a *= vColour.a;
  if (a < 0.004) { discard; }
  let additive = vLook.z;
  let peak = max(1.0, max(colour.r, max(colour.g, colour.b)));
  colour = mix(colour, vec3f(peak), clamp(white, 0.0, 1.0));
  // Wet paint's shine is light on top of its colour, bright enough to bloom.
  colour += uniform.uLight * sh.shine;
  #if (FOG != NONE)
    let fogged = getFogFactor();
    colour = mix(mix(uniform.fog_color, colour, fogged), colour * fogged, additive);
  #endif
  colour = gammaCorrectOutput(toneMap(colour));
  output.color = vec4f(colour * a, a * (1.0 - additive));
  return output;
}`;

const linear = (hex: string) => { const c = new pc.Color().fromString(hex); return [c.r ** 2.2, c.g ** 2.2, c.b ** 2.2]; };

/** Whether this device can run the GPU simulation (WebGPU, which renders to float textures). */
export function canSimulate(device: pc.GraphicsDevice) {
  return device.isWebGPU && device.textureFloatRenderable;
}

// ── The fluid ───────────────────────────────────────────────────────────────────────────────────
// A basic fluid on the GPU, particle-in-cell: every frame each particle of a fluid kind adds its mass
// and momentum to the cell it is in (a quad a slot, one texel, added up); then, in the simulation pass,
// each reads the eight cells round it for how packed the fluid is there, which way it thins and how it
// flows, and is pushed and carried by them (`fluid` on its kind). It costs nothing while no fluid is out.

const SPLAT_VS_WGSL = /* wgsl */ `
attribute vertex_position: vec2f;
var uState: texture_2d<uff>;
var uKinds: texture_2d<uff>;
uniform uGridAt: vec4f;
varying vMom: vec4f;
fn st(band: i32, index: i32) -> vec4f { return textureLoad(uState, vec2i(index % ${W}, index / ${W} + band * ${H}), 0); }
fn kin(k: i32, c: i32) -> vec4f { return textureLoad(uKinds, vec2i(c, k), 0); }
@vertex
fn vertexMain(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;
  output.position = vec4f(2.0, 2.0, 2.0, 1.0); output.vMom = vec4f(0.0);
  let i = i32(pcInstanceIndex);
  let A = st(0, i); let B = st(1, i);
  if (!(B.w > 0.0 && A.w < B.w)) { return output; }
  if (kin(i32(st(2, i).x), 12).x <= 0.0) { return output; }
  let c = vec3i(floor((A.xyz - uniform.uGridAt.xyz) / uniform.uGridAt.w));
  if (c.x < 0 || c.y < 0 || c.z < 0 || c.x >= ${GX} || c.y >= ${GY} || c.z >= ${GZ}) { return output; }
  let px = f32(c.x + c.y * ${GX}) + 0.5 + vertex_position.x * 0.45;
  let py = f32(c.z) + 0.5 + vertex_position.y * 0.45;
  output.position = vec4f(px / ${GW}.0 * 2.0 - 1.0, 1.0 - py / ${GZ}.0 * 2.0, 0.0, 1.0);
  output.vMom = vec4f(B.xyz, 1.0);
  return output;
}`;
const SPLAT_FS_WGSL = /* wgsl */ `
varying vMom: vec4f;
@fragment
fn fragmentMain(input: FragmentInput) -> FragmentOutput {
  var output: FragmentOutput;
  output.color = vMom;
  return output;
}`;
/** Everything adds up: momentum and mass from every particle in a cell. */
const ADD_ALL = new pc.BlendState(true, pc.BLENDEQUATION_ADD, pc.BLENDMODE_ONE, pc.BLENDMODE_ONE, pc.BLENDEQUATION_ADD, pc.BLENDMODE_ONE, pc.BLENDMODE_ONE);
/** The splat: every slot's quad drawn into the grid at once, instanced, added up. */
class SplatPass extends pc.RenderPass {
  quad: pc.QuadRender; rect: pc.Vec4; count: number;
  constructor(device: pc.GraphicsDevice, quad: pc.QuadRender, rect: pc.Vec4, count: number) { super(device); this.quad = quad; this.rect = rect; this.count = count; }
  execute() {
    this.device.setDrawStates(ADD_ALL, pc.DepthState.NODEPTH, pc.CULLFACE_NONE);
    this.quad.render(this.rect, undefined, this.count);
    // Back to no blending: the simulation's own pass draws with whatever the device was left with.
    this.device.setDrawStates();
  }
}

export function createFightParticles(app: pc.AppBase, kinds: Record<string, GpuKind> = {}) {
  const device = app.graphicsDevice;
  const data = (width: number, height: number, name: string) => new pc.Texture(device, {
    name, width, height, format: pc.PIXELFORMAT_RGBA32F, mipmaps: false,
    minFilter: pc.FILTER_NEAREST, magFilter: pc.FILTER_NEAREST, addressU: pc.ADDRESS_CLAMP_TO_EDGE, addressV: pc.ADDRESS_CLAMP_TO_EDGE,
  });
  const fill = (texture: pc.Texture, write: (out: Float32Array) => void) => { const out = texture.lock() as Float32Array; out.fill(0); write(out); texture.unlock(); };
  // Two state textures, ping-ponged; all zeros is every particle dead.
  const states = [data(W, H * BANDS, 'Partículas de combate A'), data(W, H * BANDS, 'Partículas de combate B')];
  states.forEach(s => fill(s, () => {}));
  const targets = states.map(colorBuffer => new pc.RenderTarget({ colorBuffer, depth: false }));
  let current = 0;
  const kindTex = data(KIND_COLS, MAX_KINDS, 'Clases de partículas'), spawnTex = data(SPAWN_COLS, MAX_BATCHES, 'Nacimientos'), fieldTex = data(FIELD_COLS, MAX_FIELDS, 'Campos');
  const partTex = data(PART_COLS, MAX_PARTS, 'Partes de luchadores'), fighterTex = data(3, MAX_FIGHTERS, 'Luchadores'), surfaceTex = data(SURFACE_SAMPLES, MAX_FIGHTERS * 3, 'Superficie de luchadores'), floorTex = data(FLOOR, FLOOR, 'Suelo del combate');
  fill(floorTex, () => {});
  const lawTex = data(LAW_COLS, MAX_LAWS, 'Leyes de movimiento'), igniteTex = data(1, MAX_IGNITES, 'Igniciones');
  fill(lawTex, () => {}); fill(igniteTex, () => {});
  const cloudTex = data(MAX_CLOUD_POINTS, MAX_CLOUDS, 'Nubes de puntos'), rewindTex = data(2, MAX_REWINDS, 'Rebobinados');
  fill(cloudTex, () => {}); fill(rewindTex, () => {});
  const volumeTex = data(VOLUME_COLS, MAX_VOLUMES, 'Volúmenes'), groupTex = data(1, MAX_LIGHT_GROUPS, 'Grupos de luz'), latticeTex = data(LATTICE_COLS, MAX_LATTICES, 'Retículas');
  const lightTex = data(MAX_LIGHT_GROUPS, 2, 'Luz de las partículas'), lightTarget = new pc.RenderTarget({ colorBuffer: lightTex, depth: false });
  fill(volumeTex, () => {}); fill(groupTex, () => {}); fill(latticeTex, () => {});

  // Kinds: a CPU copy of the kinds texture, rewritten whenever one is defined.
  const names: string[] = [];
  const defs: GpuKind[] = [];
  const kindData = new Float32Array(KIND_COLS * MAX_KINDS * 4);
  function pack(k: number) {
    const d = defs[k], o = k * KIND_COLS * 4, c = d.colours.map(linear), int = d.intensity ?? [1, 1, 1];
    const ref = (name?: string) => name === undefined ? -1 : names.indexOf(name);
    const row = (col: number, values: number[]) => kindData.set(values, o + col * 4);
    row(0, [d.drag ?? 1, d.gravity ?? 0, d.curl ?? 0, d.response ?? 1]);
    row(1, [d.bounce ?? .3, d.friction ?? .3, d.stick ?? 0, d.collide ? 1 : 0]);
    row(2, [...c[0], int[0]]);
    row(3, [c[1][0] * int[1], c[1][1] * int[1], c[1][2] * int[1], Math.min(.99, Math.max(.01, d.middle ?? .5))]);
    row(4, [c[2][0] * int[2], c[2][1] * int[2], c[2][2] * int[2], d.opacity ?? 1]);
    row(5, [d.size[0], d.size[1], d.stretch ?? 0, SHAPES[d.shape]]);
    row(6, [d.fadeIn ?? 0, d.fadeOut ?? .3, d.additive ?? 1, d.flicker ?? 0]);
    row(7, [d.stickTime ?? .5, d.settle ? 1 : 0, Math.min(1, Math.max(0, d.glass ?? 0)), (d.spin ?? 0) * Math.PI / 180]);
    row(8, [d.separation ?? 0, d.cohesion ?? 0, d.alignment ?? 0, d.radius ?? .3]);
    row(9, [ref(d.onLand), ref(d.onDeath), d.flat ? 1 : 0, d.follow ?? 12]);
    const blur = typeof d.blur === 'number' ? [d.blur, d.blur] : d.blur ?? [0, 0];
    row(10, [d.sizeJitter ?? 0, d.aspect ?? .25, Math.max(0, blur[0]), Math.max(0, blur[1])]);
    row(11, [d.life?.[0] ?? .5, d.life?.[1] ?? d.life?.[0] ?? .5, Math.min(1, Math.max(0, d.core ?? 1)), 0]);
    row(12, [d.fluid?.pressure ?? 0, d.fluid?.viscosity ?? 0, d.fluid?.rest ?? 6, 0]);
    row(13, [d.mirror ? 1 : 0, d.bubble?.lift ?? 0, d.bubble?.flow ?? 0, 0]);
    const burns = d.burns ?? defs.some(o => o?.ignite?.into === names[k]);
    row(14, [d.ignite ? ref(d.ignite.into) : -1, Math.max(0, d.ignite?.delay ?? .05), d.ignite?.radius ?? .2, burns ? 1 : 0]);
  }
  function uploadKinds() { const out = kindTex.lock() as Float32Array; out.set(kindData); kindTex.unlock(); }
  function define(name: string, kind: GpuKind) {
    let k = names.indexOf(name);
    if (k < 0) { if (names.length >= MAX_KINDS) throw new Error(`Too many fight particle kinds (${MAX_KINDS})`); k = names.length; names.push(name); }
    defs[k] = kind;
    // Every kind is packed again: one defined now may be another's `onLand` or `onDeath`.
    for (let i = 0; i < names.length; i++) pack(i);
    uploadKinds();
  }
  const initial = Object.entries(kinds);
  if (initial.length > MAX_KINDS) throw new Error(`Too many fight particle kinds (${MAX_KINDS})`);
  initial.forEach(([name, kind]) => { names.push(name); defs.push(kind); });
  for (let i = 0; i < names.length; i++) pack(i);
  uploadKinds();

  const sim = pc.ShaderUtils.createShader(device, {
    uniqueName: 'gerard-fight-particles-sim-5', attributes: { vertex_position: pc.SEMANTIC_POSITION },
    vertexChunk: 'fullscreenQuadVS', fragmentWGSL: SIM_WGSL, fragmentOutputTypes: 'vec4',
  });
  const lightShader = pc.ShaderUtils.createShader(device, {
    uniqueName: 'gerard-fight-particles-light', attributes: { vertex_position: pc.SEMANTIC_POSITION },
    vertexChunk: 'fullscreenQuadVS', fragmentWGSL: LIGHT_WGSL, fragmentOutputTypes: 'vec4',
  });
  // The fluid's grid and its splat (§ The fluid).
  const gridTex = new pc.Texture(device, {
    name: 'Fluido de combate', width: GW, height: GZ, format: pc.PIXELFORMAT_RGBA16F, mipmaps: false,
    minFilter: pc.FILTER_NEAREST, magFilter: pc.FILTER_NEAREST, addressU: pc.ADDRESS_CLAMP_TO_EDGE, addressV: pc.ADDRESS_CLAMP_TO_EDGE,
  });
  const gridTarget = new pc.RenderTarget({ colorBuffer: gridTex, depth: false });
  const splatShader = pc.ShaderUtils.createShader(device, {
    uniqueName: 'gerard-fight-particles-splat', attributes: { vertex_position: pc.SEMANTIC_POSITION },
    vertexWGSL: SPLAT_VS_WGSL, fragmentWGSL: SPLAT_FS_WGSL, fragmentOutputTypes: 'vec4',
  });
  const splatQuad = new pc.QuadRender(splatShader);
  const splat = new SplatPass(device, splatQuad, new pc.Vec4(0, 0, GW, GZ), N);
  splat.init(gridTarget);
  splat.setClearColor(new pc.Color(0, 0, 0, 0));
  /** Where the grid's corner is and its cell (m), and until when (the engine's seconds) a fluid may be out. */
  const gridAt = new Float32Array([0, 0, 0, CELL]);
  let fluidUntil = -1, fluidSeen = -99;
  /** The fluid was thrown at `at`: the grid goes round it, the floor a little under it. */
  function aimGrid(at: { x: number; y: number; z: number }, until: number) {
    const fresh = time - fluidSeen > 2, k = fresh ? 1 : .25;
    const cx = gridAt[0] + GX * CELL / 2, cz = gridAt[2] + GZ * CELL / 2;
    gridAt[0] = cx + (at.x - cx) * k - GX * CELL / 2;
    gridAt[2] = cz + (at.z - cz) * k - GZ * CELL / 2;
    // Its floor: as low as anything thrown since it was fresh, and half a metre under that.
    gridAt[1] = fresh ? at.y - .5 : Math.min(gridAt[1], at.y - .5);
    fluidSeen = time; fluidUntil = Math.max(fluidUntil, until);
  }
  const scope = device.scope;
  const u = (name: string) => scope.resolve(name);
  const uniforms = {
    state: u('uState'), kinds: u('uKinds'), spawns: u('uSpawns'), fields: u('uFields'), parts: u('uParts'), fighters: u('uFighters'), surface: u('uSurface'), floorMap: u('uFloorMap'),
    dt: u('uDt'), time: u('uTime'), frame: u('uFrame'), counts: u('uCounts'), floor: u('uFloor'),
    volumes: u('uVolumes'), extra: u('uExtra'), groups: u('uGroups'), lattices: u('uLattices'),
    grid: u('uGrid'), gridAt: u('uGridAt'), laws: u('uLaws'), ignites: u('uIgnites'), clouds: u('uClouds'), rewinds: u('uRewinds'),
  };

  // The draw: one quad per slot; dead slots collapse to nothing in the vertex shader.
  const quad = new pc.Mesh(device);
  quad.setPositions(new Float32Array([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0]));
  quad.setIndices([0, 1, 2, 0, 2, 3]);
  quad.update();
  const format = new pc.VertexFormat(device, [{ semantic: pc.SEMANTIC_ATTR10, components: 4, type: pc.TYPE_FLOAT32 }]);
  const indices = new Float32Array(N * 4);
  for (let i = 0; i < N; i++) indices[i * 4] = i;
  const buffer = new pc.VertexBuffer(device, format, N, { data: indices.buffer });
  const material = new pc.ShaderMaterial({
    uniqueName: 'gerard-fight-particles-3', attributes: { vertex_position: pc.SEMANTIC_POSITION, aIndex: pc.SEMANTIC_ATTR10 },
    vertexWGSL: DRAW_VS_WGSL, fragmentWGSL: DRAW_FS_WGSL,
  });
  material.name = 'Partículas de combate';
  material.blendType = pc.BLEND_PREMULTIPLIED;
  material.depthWrite = false;
  material.cull = pc.CULLFACE_NONE;
  material.setParameter('uKinds', kindTex);
  material.setParameter('uLattices', latticeTex);
  const light = new Float32Array([1, 1, 1]);
  material.setParameter('uLight', light);
  material.update();
  const instance = new pc.MeshInstance(quad, material);
  instance.setInstancing(buffer);
  instance.instancingCount = N;
  instance.cull = false;
  const entity = new pc.Entity('Partículas de combate');
  entity.addComponent('render', { meshInstances: [instance], castShadows: false, receiveShadows: false });
  entity.enabled = false;
  app.root.addChild(entity);

  // What to spawn this frame, the force fields, the fighters' parts.
  /** `member`: the lattice slot + 1 its particles belong to (negative: loose); `home`: born in place. */
  const batches: { start: number; count: number; kind: number; o: GpuBurst; member: number; home: boolean }[] = [];
  let head = 0, time = 0, frame = 0, live = 0, draw = true;
  const fields: GpuField[] = [];
  const emitters: (GpuEmitter & { kind: string; acc: number })[] = [];
  let fighters: pc.Entity[] = [];
  const inverse = new pc.Mat4();
  const box = new pc.BoundingBox();
  /** The fight's floor: its corner (x, z), metres a texel, and the height outside it. */
  const floor = new Float32Array([0, 0, 1, 0]);
  const counts = new Float32Array(4);
  const tintCache = new Map<string, number[]>();
  const extra = new Float32Array(4);
  const volumes: GpuVolume[] = [];
  const rigid = new pc.Mat4(), rigidInverse = new pc.Mat4();
  /** Bursts that light their surroundings: their slots, how bright and how far, until when, and what the GPU last said of them. */
  interface LightGroup { start: number; count: number; intensity: number; range: number; colour?: number[]; until: number; peak: number; seen: boolean; brightness: number; at: pc.Vec3; tint: pc.Color; aimed: boolean }
  const groups: LightGroup[] = [];
  /** The lights groups share: the brightest groups get one each. */
  const lights = Array.from({ length: FX_LIGHTS }, () => {
    const e = new pc.Entity('Luz de partículas');
    e.addComponent('light', { type: 'omni', color: new pc.Color(1, 1, 1), intensity: 0, range: 2, castShadows: false });
    e.enabled = false;
    app.root.addChild(e);
    return e;
  });
  const lightData = new Float32Array(MAX_LIGHT_GROUPS * 2 * 4);
  let reading: LightGroup[] | undefined, lightScale = 1, destroyed = false;

  /**
   * Where a batch of `count` goes on the ring: at its head, past any living lattice's slots (which no
   * burst may overwrite), never wrapping round the ring's end while lattices hold slots or when it
   * must not (`whole`).
   */
  function place(count: number, whole: boolean) {
    const held = lattices.filter(l => l.alive).map(l => l.members);
    for (let tries = 0; tries <= MAX_LATTICES + 1; tries++) {
      if ((whole || held.length) && head + count > N) head = 0;
      const clash = held.find(r => head < r.start + r.count && r.start < head + count);
      if (!clash) return head;
      head = clash.start + clash.count;
    }
    return -1;
  }
  /** Kinds whose bursts were dropped for want of a batch, warned of once each. */
  const dropped = new Set<string>();
  function queue(kind: string, o: GpuBurst, member = 0, home = false): GpuBatch | undefined {
    const k = names.indexOf(kind);
    if (k < 0) throw new Error(`Unknown fight particle kind: ${kind}`);
    const chain = Math.max(1, Math.round(o.chain ?? 1));
    // Whole chains only, so no chain is cut in two by the end of a batch.
    const count = Math.floor(Math.min(Math.round(o.count), N / 4) / chain) * chain;
    if (count <= 0) return undefined;
    // Past the frame's batches the burst is lost: say so once a kind while developing, it never shows.
    if (batches.length >= MAX_BATCHES) { if (import.meta.env?.DEV && !dropped.has(kind)) { dropped.add(kind); console.warn(`Fight particles: more than ${MAX_BATCHES} bursts this frame, "${kind}" dropped`); } return undefined; }
    // A chain must not wrap round the ring's end: its links follow the slot before them.
    const start = place(count, chain > 1);
    if (start < 0) return undefined;
    // Following a law: its particles keep its slot where a lattice's members keep theirs.
    if (!member && o.law?.alive) member = LAW_BASE + (o.law as LawState).slot;
    batches.push({ start, count, kind: k, o, member, home });
    if (defs[k].fluid) aimGrid(o.at, time + Math.max(o.life[1], defs[k].life?.[1] ?? 0) + .5);
    if (o.light) {
      if (groups.length >= MAX_LIGHT_GROUPS) groups.shift();
      const lifeLeft = o.life[1] * 2.5 + .5;
      groups.push({ start, count, intensity: o.light.intensity, range: o.light.range, colour: o.light.colour ? tint(o.light.colour) : undefined, until: time + lifeLeft, peak: 0, seen: false, brightness: 0, at: new pc.Vec3(o.at.x, o.at.y, o.at.z), tint: new pc.Color(1, 1, 1), aimed: false });
    }
    head = (start + count) % N;
    return { start, count };
  }
  /** Each fighter slot's real surface as last written: whose, on which frame, how many points. */
  const written: ({ model: pc.Entity; frame: number; count: number } | undefined)[] = [];
  function writeParts() {
    let parts = 0, count = 0;
    const pd = partTex.lock() as Float32Array, fd = fighterTex.lock() as Float32Array;
    pd.fill(0); fd.fill(0);
    // Which fighters something is born on this frame: only they get their real surface written, and
    // a status streaming off someone every frame only every few (a frame or two late does not show).
    const sampled = new Set(batches.filter(b => b.o.shape === 'surface').map(b => b.o.fighter ?? 0));
    const stale = [...sampled].filter(g => { const w = written[g]; return !w || w.model !== fighters[g] || frame - w.frame >= SURFACE_EVERY; });
    const surface = stale.length ? surfaceTex.lock() as Float32Array : undefined;
    // One slot per fighter in `setFighters` order, empty for whoever is gone, so indices stay theirs.
    for (const model of fighters) {
      if (count >= MAX_FIGHTERS) break;
      const start = parts;
      const empty = () => { fd.set([0, -1e4, 0, -1], count * 12); fd.set([start, 0, 0, 0], count * 12 + 4); count++; };
      if (!model.enabled) { empty(); continue; }
      let first = true;
      for (const r of model.findComponents('render') as pc.RenderComponent[]) {
        if (!r.enabled) continue;
        for (const m of r.meshInstances) {
          if (parts >= MAX_PARTS || !m.mesh || !m.visible) continue;
          const world = m.node.getWorldTransform(), w = world.data;
          inverse.copy(world).invert();
          const inv = inverse.data, o = parts * PART_COLS * 4, local = m.mesh.aabb;
          for (let row = 0; row < 3; row++) {
            pd.set([inv[row], inv[4 + row], inv[8 + row], inv[12 + row]], o + row * 4);
            pd.set([w[row], w[4 + row], w[8 + row], w[12 + row]], o + 12 + row * 4);
          }
          // A few millimetres of skin, so what bounces off never touches the body.
          pd.set([local.center.x, local.center.y, local.center.z, .004], o + 24);
          pd.set([local.halfExtents.x, local.halfExtents.y, local.halfExtents.z, 0], o + 28);
          // Its colour, for what is born on it in its colour (`fromPart`).
          const diffuse = (m.material as pc.StandardMaterial | null)?.diffuse;
          pd.set(diffuse ? [diffuse.r ** 2.2, diffuse.g ** 2.2, diffuse.b ** 2.2, 1] : [1, 1, 1, 1], o + 32);
          if (first) { box.copy(m.aabb); first = false; } else box.add(m.aabb);
          parts++;
        }
      }
      if (parts === start) { empty(); continue; }
      const c = box.center, h = box.halfExtents, f = count * 12;
      fd.set([c.x, c.y, c.z, h.length() + .3], f);
      fd.set([start, parts - start, box.getMin().y, box.getMax().y], f + 4);
      // Its real surface, only when something is born on it this frame (it costs a little to bend).
      if (stale.includes(count)) written[count] = { model, frame, count: writeSurface(model, surface!, count * 3 * SURFACE_SAMPLES, SURFACE_SAMPLES) };
      if (sampled.has(count) && written[count]?.model === model) fd.set([written[count]!.count, 0, 0, 0], f + 8);
      count++;
    }
    partTex.unlock(); fighterTex.unlock();
    if (surface) surfaceTex.unlock();
    return { parts, count };
  }
  function writeVolumes() {
    fill(volumeTex, out => volumes.slice(0, MAX_VOLUMES).forEach((v, i) => {
      if (v.follow) { v.at.copy(v.follow.getPosition()); v.rotation.copy(v.follow.getRotation()); }
      rigid.setTRS(v.at, v.rotation, pc.Vec3.ONE);
      rigidInverse.copy(rigid).invert();
      const w = rigid.data, inv = rigidInverse.data, o = i * VOLUME_COLS * 4;
      for (let row = 0; row < 3; row++) {
        out.set([inv[row], inv[4 + row], inv[8 + row], inv[12 + row]], o + row * 4);
        out.set([w[row], w[4 + row], w[8 + row], w[12 + row]], o + 12 + row * 4);
      }
      // Up to four kinds by their slots (one not defined yet matches nothing).
      const only = (v.kinds ?? []).slice(0, 4).map(kind => names.indexOf(kind)).map(k => k < 0 ? -99 : k);
      out.set([v.size.x, v.size.y, v.size.z, VOLUME_SHAPES[v.shape]], o + 24);
      out.set([VOLUME_MODES[v.mode], v.strength, v.swirl, v.bounce], o + 28);
      out.set([v.range, v.distance, only.length, 0], o + 32);
      out.set([only[0] ?? -99, only[1] ?? -99, only[2] ?? -99, only[3] ?? -99], o + 36);
    }));
    return Math.min(volumes.length, MAX_VOLUMES);
  }
  /** Lattices in their slots, with what the CPU keeps of them between frames. */
  interface LatticeState extends GpuLattice {
    slot: number; kind: number; life: number; hold: number; flowAt: number; phase: number; last: pc.Vec3; lastTurn: pc.Quat; pending?: { at: Vec3Like; radius: number; strength: number }; origin: pc.Vec3; hitters: GpuBatch[]; glowGroup?: LightGroup; dead: boolean;
    /** Thrown (`throwAt`): the points sorted round it from straight behind, the way they lie, and how its members fly. */
    aim?: { points: { at: Vec3Like; radius: number }[]; facing: number; speed: number; steer: number; arc: number; blast: number };
    /** A film's clock (s); its ripples (in its own space), its rupture, a string's pulses and its snap. */
    clock: number;
    ripples: { at: pc.Vec3; age: number }[]; rippleLook: { height: number; length: number; speed: number; decay: number };
    burst?: { at: pc.Vec3; age: number; speed: number; rim: number; fling: number };
    pulses: { from: number; toward: 1 | -1; travelled: number; height: number; age: number; speed: number; decay: number; reflected: number; onReflect?: (end: 1 | -1, n: number) => void }[]; pulseWidth: number; pulseShine: number;
    snapped?: { at: number; age: number; seconds: number; whip: number };
  }
  const lattices: LatticeState[] = [];
  /** Motion laws in their slots (§ `law`), and the points lit this frame (`ignite`). */
  interface LawState extends GpuLaw { slot: number; dead: boolean }
  const laws: LawState[] = [];
  /** Which slot a new law takes: the one freed longest ago, so particles of an old law are the least likely to pick up a new one. */
  let lawTurn = 0;
  const ignites: { at: Vec3Like; radius: number }[] = [];
  /**
   * Batches played back (`rewind`): seconds since they started going back (below 0, still waiting), how long it takes, the
   * kind they become; `sent` once the GPU has been told they are there, so it turns them.
   */
  const rewinds: { start: number; count: number; elapsed: number; seconds: number; into: number; sent: boolean }[] = [];
  function writeLaws() {
    fill(lawTex, out => laws.forEach(l => {
      if (l.follow) { l.at.copy(l.follow.getPosition()); l.rotation.copy(l.follow.getRotation()); }
      rigid.setTRS(l.at, l.rotation, pc.Vec3.ONE);
      rigidInverse.copy(rigid).invert();
      const w = rigid.data, inv = rigidInverse.data, o = l.slot * LAW_COLS * 4;
      for (let row = 0; row < 3; row++) {
        out.set([inv[row], inv[4 + row], inv[8 + row], inv[12 + row]], o + row * 4);
        out.set([w[row], w[4 + row], w[8 + row], w[12 + row]], o + 12 + row * 4);
      }
      const p = [...l.params];
      // A board of at most sixteen rows: a path's bits are the seed's first sixteen.
      if (l.law === 'galton') p[0] = Math.max(0, Math.min(16, Math.round(p[0])));
      out.set(p, o + 24);
      out.set([LAW_IDS[l.law], Math.max(1e-4, l.scale), Math.max(0, l.grip), Math.max(.01, l.maxSpeed)], o + 28);
      out.set([l.spark, Math.max(0, l.spread), Math.max(0, l.bounce), 0], o + 32);
    }));
  }
  function makeLaw(name: GpuLawName, o: Partial<Omit<GpuLaw, 'law' | 'at' | 'rotation' | 'alive' | 'remove'>> & { at?: Vec3Like; rotation?: pc.Quat } = {}): GpuLaw {
    if (!(name in LAW_IDS)) throw new Error(`Unknown motion law: ${name}`);
    if (laws.length >= MAX_LAWS) laws[0].remove();
    const free = [...Array(MAX_LAWS).keys()].map(i => (lawTurn + i) % MAX_LAWS).find(i => !laws.some(l => l.slot === i))!;
    lawTurn = (free + 1) % MAX_LAWS;
    const at = new pc.Vec3(o.at?.x ?? 0, o.at?.y ?? 0, o.at?.z ?? 0), rotation = o.rotation?.clone() ?? new pc.Quat();
    if (o.follow) { at.copy(o.follow.getPosition()); rotation.copy(o.follow.getRotation()); }
    const { at: _at, rotation: _rotation, params, ...rest } = o;
    const defaults: [number, number, number, number] = name === 'lorenz' ? [10, 28, 8 / 3, .5] : [8, .22, .2, 30];
    const l: LawState = {
      scale: .05, grip: 30, maxSpeed: name === 'lorenz' ? 12 : 30, bounce: .25, spark: 0, spread: 0,
      ...rest, law: name, at, rotation, params: params ? [...params] as [number, number, number, number] : defaults,
      slot: free, dead: false,
      get alive() { return !l.dead; },
      remove() { if (l.dead) return; l.dead = true; const i = laws.indexOf(l); if (i >= 0) laws.splice(i, 1); },
    };
    laws.push(l);
    return l;
  }
  const turn = new pc.Quat(), back = new pc.Quat(), spin = new pc.Vec3(), centre = new pc.Vec3();
  function writeLattices(dt: number) {
    fill(latticeTex, out => lattices.forEach(l => {
      if (l.follow) { l.at.copy(l.follow.getPosition()); l.rotation.copy(l.follow.getRotation()); }
      rigid.setTRS(l.at, l.rotation, pc.Vec3.ONE);
      rigidInverse.copy(rigid).invert();
      const w = rigid.data, inv = rigidInverse.data, o = l.slot * LATTICE_COLS * 4, [nx, ny, nz] = l.grid;
      for (let row = 0; row < 3; row++) {
        out.set([w[row], w[4 + row], w[8 + row], w[12 + row]], o + row * 4);
        out.set([inv[row], inv[4 + row], inv[8 + row], inv[12 + row]], o + 12 + row * 4);
      }
      // How fast it moves and turns, so its members keep up with their homes instead of dragging.
      const step = dt > 0 ? 1 / dt : 0;
      const velocity = new pc.Vec3().sub2(l.at, l.last).mulScalar(step);
      back.copy(l.lastTurn).invert(); turn.mul2(l.rotation, back);
      if (turn.w < 0) turn.set(-turn.x, -turn.y, -turn.z, -turn.w);
      spin.set(turn.x, turn.y, turn.z).mulScalar(2 * step);
      l.last.copy(l.at); l.lastTurn.copy(l.rotation);
      const flowStep = l.flow * dt;
      l.flowAt = (((l.flowAt + flowStep) % nx) + nx) % nx;
      const k = 2 * Math.PI / Math.max(l.wave.length, .01);
      l.phase = (l.phase + k * l.wave.speed * dt) % (2 * Math.PI * 1000);
      const push = l.pending;
      l.pending = undefined;
      if (push && l.dissolveFrom === 'push') l.origin.set(push.at.x, push.at.y, push.at.z);
      const ref = (name?: string) => name === undefined ? -1 : names.indexOf(name);
      const hit = (i: number) => l.hitters[i] ?? { start: 0, count: 0 };
      const extent = l.shape === 'ring' || l.morphTo === 'ring' ? l.size.x + l.size.z : Math.max(l.size.x, l.size.y, l.size.z);
      out.set([l.members.start, l.members.count, nx, ny], o + 24);
      out.set([nz, LATTICE_SHAPES[l.shape], LATTICE_SHAPES[l.morphTo], Math.min(1, Math.max(0, l.morph))], o + 28);
      out.set([l.size.x, l.size.y, l.size.z, l.flowAt], o + 32);
      out.set([l.rigidity, l.bonds, l.damping, l.viscosity], o + 36);
      out.set([l.toughness, ref(l.breakInto), l.reform, l.kind], o + 40);
      out.set([l.wave.height, k, l.phase, l.glow], o + 44);
      out.set([velocity.x, velocity.y, velocity.z, flowStep], o + 48);
      out.set([spin.x, spin.y, spin.z, l.hitRadius], o + 52);
      out.set([push?.at.x ?? 0, push?.at.y ?? 0, push?.at.z ?? 0, push?.radius ?? 0], o + 56);
      out.set([push?.strength ?? 0, Math.min(1, Math.max(0, l.dissolve)), LATTICE_DISSOLVES[l.dissolveFrom], l.hold], o + 60);
      out.set([hit(0).start, hit(0).count, hit(1).start, hit(1).count], o + 64);
      out.set([hit(2).start, hit(2).count, Math.min(1, Math.max(0, l.transfer)), l.bounce], o + 68);
      out.set([l.origin.x, l.origin.y, l.origin.z, extent], o + 72);
      // Mid-blend a bond may be as long as in either shape.
      const reach = Math.max(latticeReach(l.shape, l.grid, l.size), latticeReach(l.morphTo, l.grid, l.size));
      out.set([latticeSpacing(l.morph < .5 ? l.shape : l.morphTo, l.grid, l.size), l.life, reach, l.rim], o + 76);
      // Its surface faces away from its middle; a shield's, bent out, from a point well behind it.
      const shape = l.morph < .5 ? l.shape : l.morphTo;
      rigid.transformPoint(shape === 'shield' ? new pc.Vec3(0, 0, -1.5 * Math.max(l.size.x, l.size.y)) : pc.Vec3.ZERO, centre);
      out.set([centre.x, centre.y, centre.z, Math.min(1, Math.max(0, l.opacity))], o + 80);
      out.set([Math.min(1, Math.max(0, l.fresnel)), l.strands === 'y' ? 1 : 0, 0, 0], o + 84);
      const aim = l.aim;
      out.set([aim?.points.length ?? 0, aim?.steer ?? 0, aim?.speed ?? 0, aim?.blast ?? 0], o + 88);
      out.set([aim?.facing ?? 0, aim?.arc ?? 0, 0, 0], o + 92);
      aim?.points.forEach((p, i) => out.set([p.at.x, p.at.y, p.at.z, p.radius], o + 96 + i * 4));
      out.set([packColour(tint(l.tint)), Math.min(1, Math.max(0, l.tintAmount)), Math.min(1, Math.max(0, l.cracks)), l.crackSeed], o + LOOK_COL * 4);
      // A film, its ripples and its rupture; a string's pulses and its snap.
      l.clock += dt;
      const burst = l.burst;
      if (burst) burst.age += dt;
      out.set([l.film ? 1 : 0, Math.max(0, l.thickness), Math.min(1, Math.max(0, l.drain)), Math.min(1, Math.max(0, l.swirl))], o + FILM_COL * 4);
      out.set([l.clock, burst?.rim ?? 0, Math.min(1, Math.max(0, l.shed)), burst?.fling ?? 0], o + (FILM_COL + 1) * 4);
      for (let i = l.ripples.length - 1; i >= 0; i--) { l.ripples[i].age += dt; if (l.ripples[i].age > l.rippleLook.decay * 6) l.ripples.splice(i, 1); }
      for (let i = 0; i < MAX_RIPPLES; i++) { const r = l.ripples[i]; out.set(r ? [r.at.x, r.at.y, r.at.z, r.age] : [0, 0, 0, -1], o + (RIPPLE_COL + i) * 4); }
      const look = l.rippleLook;
      out.set([l.ripples.length ? look.height : 0, look.length, look.speed, look.decay], o + (RIPPLE_COL + MAX_RIPPLES) * 4);
      out.set(burst ? [burst.at.x, burst.at.y, burst.at.z, burst.age * burst.speed] : [0, 0, 0, -1], o + RUPTURE_COL * 4);
      const length = 2 * l.size.x;
      for (let i = l.pulses.length - 1; i >= 0; i--) {
        const p = l.pulses[i];
        p.age += dt; p.travelled += p.speed * dt;
        // Each reflection as it comes (at the string's length now).
        const r = stringReflections(length, p.from, p.toward);
        while (p.travelled >= r.first + p.reflected * r.every) { const n = p.reflected++; p.onReflect?.(r.end(n) as 1 | -1, n); }
        if (p.height * Math.exp(-p.age / p.decay) < Math.abs(p.height) * .01) l.pulses.splice(i, 1);
      }
      for (let i = 0; i < MAX_PULSES; i++) {
        const p = l.pulses[i];
        out.set(p ? [p.from, p.toward, p.travelled, p.height * Math.exp(-p.age / p.decay)] : [0, 1, 0, 0], o + (TRAVEL_COL + i) * 4);
      }
      out.set([l.pulseWidth, l.pulseShine, 0, 0], o + (TRAVEL_COL + MAX_PULSES) * 4);
      const snap = l.snapped;
      if (snap) snap.age += dt;
      const recoil = snap ? 1 - (1 - Math.min(1, snap.age / snap.seconds)) ** 3 : 0;
      out.set(snap ? [snap.at, recoil, snap.whip, 1] : [0, 0, 0, 0], o + SNAP_COL * 4);
    }));
  }
  function makeLattice(kind: string, o: GpuLatticeOptions): GpuLattice {
    const k = names.indexOf(kind);
    if (k < 0) throw new Error(`Unknown fight particle kind: ${kind}`);
    const grid = o.grid.map(n => Math.max(1, Math.round(n))) as unknown as [number, number, number];
    const count = grid[0] * grid[1] * grid[2];
    if (count > MAX_MEMBERS) throw new Error(`A lattice holds at most ${MAX_MEMBERS} particles (asked ${count})`);
    // The oldest lattice gives up its slot (its members go free) when all are taken.
    if (lattices.length >= MAX_LATTICES) lattices[0].remove();
    const slot = [...Array(MAX_LATTICES).keys()].find(i => !lattices.some(l => l.slot === i))!;
    const at = new pc.Vec3(o.at?.x ?? 0, o.at?.y ?? 0, o.at?.z ?? 0), rotation = o.rotation?.clone() ?? new pc.Quat();
    if (o.follow) { at.copy(o.follow.getPosition()); rotation.copy(o.follow.getRotation()); }
    const life = o.life ?? 6, member = slot + 1;
    const { light, from, life: _life, hold, scale, colour, at: _at, rotation: _rotation, size, grid: _grid, wave, between, ...fields } = o;
    const l: LatticeState = {
      shape: 'box', morph: 0, rigidity: 120, bonds: 300, damping: 6, viscosity: 1, toughness: 0, reform: 0, flow: 0, glow: .6, rim: 0, opacity: 1, fresnel: 0, strands: 'x',
      hitRadius: .08, transfer: .5, bounce: .3, dissolve: 0, dissolveFrom: 'random', tint: '#ffffff', tintAmount: 0, cracks: 0, crackSeed: Math.floor(Math.random() * 100000),
      film: false, thickness: 1, drain: .6, swirl: .5, shed: .35,
      ...fields, morphTo: o.morphTo ?? o.shape ?? 'box', wave: { height: 0, length: 1, speed: 0, ...wave },
      at, rotation, grid, size: new pc.Vec3(size.x, size.y, size.z),
      slot, kind: k, life, hold: Math.min(.95, Math.max(.05, hold ?? .4)), flowAt: 0, phase: 0, last: at.clone(), lastTurn: rotation.clone(),
      origin: at.clone(), hitters: [], dead: false, members: { start: 0, count: 0 },
      clock: 0, ripples: [], rippleLook: { height: .03, length: .12, speed: 1.4, decay: .7 }, pulses: [], pulseWidth: .16, pulseShine: 1.5,
      get alive() { return !l.dead; },
      push(where, radius, strength) { l.pending = { at: { x: where.x, y: where.y, z: where.z }, radius, strength }; },
      hitBy(batch) { if (!batch) return; l.hitters.push(batch); if (l.hitters.length > 3) l.hitters.shift(); },
      throwAt(points, o = {}) {
        if (!points.length) { l.aim = undefined; return; }
        // The way they lie from its middle, and each one's angle against it (−π…π): sorted so, the
        // lattice's wedges from straight behind go to them in order (latticeAim).
        const kept = points.slice(0, MAX_AIMS);
        const mid = kept.reduce((sum, p) => ({ x: sum.x + p.at.x / kept.length, z: sum.z + p.at.z / kept.length }), { x: 0, z: 0 });
        const facing = Math.atan2(mid.z - l.at.z, mid.x - l.at.x);
        const off = (p: Vec3Like) => { const a = Math.atan2(p.z - l.at.z, p.x - l.at.x) - facing; return Math.atan2(Math.sin(a), Math.cos(a)); };
        const sorted = [...kept].sort((a, b) => off(a.at) - off(b.at)).map(p => ({ at: { x: p.at.x, y: p.at.y, z: p.at.z }, radius: p.radius }));
        l.aim = { points: sorted, facing, speed: o.speed ?? 9, steer: o.steer ?? 7, arc: o.arc ?? .3, blast: o.blast ?? 4 };
      },
      span(a, b) {
        const d = new pc.Vec3(b.x - a.x, b.y - a.y, b.z - a.z), half = d.length() / 2;
        l.at.set((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
        if (half < 1e-5) return;
        d.mulScalar(1 / (2 * half));
        if (l.shape === 'string' || l.morphTo === 'string') {
          // x along it, y as near up as it can be (or along z when it stands upright).
          const up = Math.abs(d.y) > .99 ? new pc.Vec3(0, 0, 1) : new pc.Vec3(0, 1, 0);
          const z = new pc.Vec3().cross(d, up).normalize(), y = new pc.Vec3().cross(z, d).normalize();
          l.rotation.setFromMat4(new pc.Mat4().set([d.x, d.y, d.z, 0, y.x, y.y, y.z, 0, z.x, z.y, z.z, 0, 0, 0, 0, 1]));
          l.size.x = half;
        } else {
          // y along it.
          const side = Math.abs(d.x) > .99 ? new pc.Vec3(0, 0, 1) : new pc.Vec3(1, 0, 0);
          const z = new pc.Vec3().cross(side, d).normalize(), x = new pc.Vec3().cross(d, z).normalize();
          l.rotation.setFromMat4(new pc.Mat4().set([x.x, x.y, x.z, 0, d.x, d.y, d.z, 0, z.x, z.y, z.z, 0, 0, 0, 0, 1]));
          l.size.y = half;
        }
      },
      ripple(where, o = {}) {
        const local = toOwn(where);
        l.ripples.unshift({ at: local, age: 0 });
        l.ripples.length = Math.min(l.ripples.length, MAX_RIPPLES);
        Object.assign(l.rippleLook, Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)));
      },
      rupture(where, o = {}) {
        const speed = o.speed ?? 2.2;
        if (o.shed !== undefined) l.shed = o.shed;
        l.burst = { at: toOwn(where), age: 0, speed, rim: o.rim ?? .05, fling: o.fling ?? 1.5 };
        // Far enough to cross any of it from anywhere on it.
        return 2 * Math.hypot(l.size.x, l.size.y, l.size.z) / speed;
      },
      travel(o) {
        const from = Math.min(1, Math.max(-1, o.from ?? 0)), speed = o.speed ?? 3, length = 2 * l.size.x;
        if (o.width !== undefined) l.pulseWidth = o.width;
        if (o.shine !== undefined) l.pulseShine = o.shine;
        l.pulses.unshift({ from, toward: o.toward, travelled: 0, height: o.height ?? .1, age: 0, speed, decay: o.decay ?? 1.2, reflected: 0, onReflect: o.onReflect });
        l.pulses.length = Math.min(l.pulses.length, MAX_PULSES);
        const r = stringReflections(length, from, o.toward);
        return { reachesEnd: r.first / speed, every: r.every / speed };
      },
      snap(o = {}) {
        l.snapped = { at: Math.min(.95, Math.max(-.95, o.at ?? 0)), age: 0, seconds: o.seconds ?? .45, whip: o.whip ?? .12 };
        l.pulses.length = 0;
      },
      remove() {
        if (l.dead) return;
        l.dead = true;
        const i = lattices.indexOf(l);
        if (i >= 0) lattices.splice(i, 1);
        if (l.glowGroup) l.glowGroup.until = time + l.life * (1 - l.hold) + .5;
      },
    };
    /** A world point in its own space, as it stands now. */
    function toOwn(where: Vec3Like) {
      const own = new pc.Vec3(where.x - l.at.x, where.y - l.at.y, where.z - l.at.z);
      return new pc.Quat().copy(l.rotation).invert().transformVector(own, own);
    }
    // Placed between two points from the start: it was never anywhere else, so it neither moved nor turned to get there.
    if (between) { l.span(between[0], between[1]); l.last.copy(l.at); l.lastTurn.copy(l.rotation); l.origin.copy(l.at); }
    lattices.push(l);
    // Its slots are held from now on, so no burst lands on them.
    const batch = queue(kind, {
      at: from?.at ?? at, count, shape: from?.shape ?? 'ball', spread: from?.spread ?? 0, speed: from?.speed ?? 0,
      life: [life, life], size: scale ?? 1, colour, light,
    }, from ? -member : member, !from);
    if (!batch || batch.count !== count) { l.remove(); throw new Error('No room on the GPU for this lattice'); }
    (l as { members: GpuBatch }).members = batch;
    if (light) { l.glowGroup = groups[groups.length - 1]; l.glowGroup.until = Infinity; }
    return l;
  }
  /** Sums each light group on the GPU and reads it back without waiting; the answer moves the lights. */
  function measureLight() {
    for (let i = groups.length - 1; i >= 0; i--) if (time > groups[i].until) groups.splice(i, 1);
    if (reading || !groups.length) return;
    const asked = groups.slice(0, MAX_LIGHT_GROUPS);
    fill(groupTex, out => asked.forEach((g, i) => out.set([g.start, g.count, 0, 0], i * 4)));
    uniforms.state.setValue(states[current]); uniforms.kinds.setValue(kindTex); uniforms.groups.setValue(groupTex);
    pc.drawQuadWithShader(device, lightTarget, lightShader, undefined, undefined, 'Luz de partículas');
    reading = asked;
    const done = () => { reading = undefined; };
    const read = lightTex.read(0, 0, MAX_LIGHT_GROUPS, 2, { renderTarget: lightTarget, data: lightData, immediate: false }) as Promise<unknown> | undefined;
    if (!read) { done(); return; }
    read.then(() => {
      if (destroyed) return;
      asked.forEach((g, i) => {
        const p = i * 4, c = (MAX_LIGHT_GROUPS + i) * 4, weight = lightData[p + 3], full = lightData[c + 3];
        if (full > 0) g.seen = true; else if (g.seen) g.until = 0;
        g.peak = Math.max(g.peak, full);
        g.brightness = g.peak > 0 ? weight / g.peak : 0;
        if (weight > 1e-5) {
          const x = lightData[p] / weight, y = lightData[p + 1] / weight, z = lightData[p + 2] / weight;
          if (g.aimed) g.at.lerp(g.at, new pc.Vec3(x, y, z), .6); else { g.at.set(x, y, z); g.aimed = true; }
          const r = lightData[c] / weight, gr = lightData[c + 1] / weight, b = lightData[c + 2] / weight, top = Math.max(r, gr, b, 1e-4);
          const own = g.colour;
          g.tint.set(own ? own[0] ** (1 / 2.2) : (r / top) ** (1 / 2.2), own ? own[1] ** (1 / 2.2) : (gr / top) ** (1 / 2.2), own ? own[2] ** (1 / 2.2) : (b / top) ** (1 / 2.2));
        }
      });
    }).catch(() => {}).finally(done);
  }
  /** The brightest groups light their surroundings. */
  function placeLights(on: boolean) {
    const lit = on ? groups.filter(g => g.aimed && g.brightness > .02).sort((a, b) => b.intensity * b.brightness - a.intensity * a.brightness).slice(0, FX_LIGHTS) : [];
    lights.forEach((e, i) => {
      const g = lit[i];
      e.enabled = !!g;
      if (!g) return;
      e.setPosition(g.at);
      const light = e.light!;
      light.color = g.tint;
      light.intensity = g.intensity * g.brightness * lightScale;
      light.range = g.range;
    });
  }
  const tint = (hex: string) => { let c = tintCache.get(hex); if (!c) { c = linear(hex); tintCache.set(hex, c); } return c; };

  return {
    capacity: N,
    /** The kinds defined, in their slots. */
    get kinds() { return [...names]; },
    /** Particles spawned and still possibly alive (an upper bound; the GPU knows exactly). */
    get spawned() { return live; },
    get active() { return entity.enabled; },
    /** Whether they are drawn (development comparisons; they keep simulating either way). */
    get draw() { return draw; },
    set draw(on: boolean) { draw = on; },
    /** Adds a kind, or changes one already defined (particles of it in flight take the change at once). */
    define,
    /** A kind as defined, to change it with `define` (development). */
    get(name: string): GpuKind | undefined { const k = names.indexOf(name); return k < 0 ? undefined : { ...defs[k] }; },
    /** Who is fighting: their parts are what particles meet, and `fighter` indexes this list. */
    setFighters(models: readonly pc.Entity[]) { fighters = [...models]; },
    /** The floor around the fight, as a heightmap `size` metres wide centred on `centre`. */
    setFloor(centre: { x: number; z: number }, size: number, groundAt: (x: number, z: number) => number) {
      const step = size / FLOOR, x0 = centre.x - size / 2, z0 = centre.z - size / 2;
      fill(floorTex, out => { for (let j = 0; j < FLOOR; j++) for (let i = 0; i < FLOOR; i++) out[(j * FLOOR + i) * 4] = groundAt(x0 + (i + .5) * step, z0 + (j + .5) * step); });
      floor[0] = x0; floor[1] = z0; floor[2] = step; floor[3] = groundAt(centre.x, centre.z);
    },
    burst: queue,
    /** A stream of `rate` a second; move `at`, change `rate` or the fighter as it goes. */
    emitter(kind: string, o: Omit<GpuEmitter, 'remove'>): GpuEmitter {
      if (!names.includes(kind)) throw new Error(`Unknown fight particle kind: ${kind}`);
      const e = { ...o, kind, acc: 0, remove() { const i = emitters.indexOf(e); if (i >= 0) emitters.splice(i, 1); } };
      emitters.push(e);
      return e;
    },
    /** A force field: swirl round `axis`, pull to its middle, lift along `axis`; `follow` a model to move with it. */
    field(o: Partial<Omit<GpuField, 'remove' | 'at' | 'axis'>> & { at: { x: number; y: number; z: number }; axis?: { x: number; y: number; z: number } }): GpuField {
      const axis = new pc.Vec3(o.axis?.x ?? 0, o.axis?.y ?? 1, o.axis?.z ?? 0).normalize();
      const f: GpuField = { radius: 1, swirl: 0, pull: 0, lift: 0, turbulence: 0, ...o, at: new pc.Vec3(o.at.x, o.at.y, o.at.z), axis, remove() { const i = fields.indexOf(f); if (i >= 0) fields.splice(i, 1); } };
      fields.push(f);
      return f;
    },
    setLight(r: number, g: number, b: number) { light[0] = r; light[1] = g; light[2] = b; material.setParameter('uLight', light); },
    /** How much of their light particles throw in this scene's light (1 at night, less by day). */
    get lightScale() { return lightScale; },
    set lightScale(value: number) { lightScale = value; },
    /** Light groups alive (development and tests). */
    get lightGroups() { return groups.length; },
    /** A volume particles meet: a crystal they stay in, bounce off, orbit or gather on. */
    volume(o: Partial<Omit<GpuVolume, 'remove' | 'at' | 'rotation' | 'size'>> & { at?: { x: number; y: number; z: number }; rotation?: pc.Quat; size?: { x: number; y: number; z: number } }): GpuVolume {
      if ((o.kinds?.length ?? 0) > 4) throw new Error('A volume affects at most four kinds by name (or all)');
      if (volumes.length >= MAX_VOLUMES) volumes.shift();
      const v: GpuVolume = {
        shape: 'crystal', mode: 'contain', strength: 0, swirl: 0, bounce: .6, range: 1, distance: .1, ...o,
        at: new pc.Vec3(o.at?.x ?? 0, o.at?.y ?? 0, o.at?.z ?? 0), rotation: o.rotation?.clone() ?? new pc.Quat(),
        size: new pc.Vec3(o.size?.x ?? .3, o.size?.y ?? .5, o.size?.z ?? .3),
        remove() { const i = volumes.indexOf(v); if (i >= 0) volumes.splice(i, 1); },
      };
      volumes.push(v);
      return v;
    },
    /** A lattice of `kind` (src/lattice.ts): a shape its particles hold together, that bends, flows, breaks and mends. */
    lattice: makeLattice,
    /** Lattices alive (development and tests). */
    get lattices(): readonly GpuLattice[] { return [...lattices]; },
    /**
     * A motion law (`GpuLaw`, up to MAX_LAWS at once, the oldest giving way): bursts given it (`law`) follow
     * it while it lives. `lorenz` takes [σ, ρ, β, speed] (10, 28, 8/3, 0.5 by default), `galton` [rows,
     * row gap, peg gap, fall] (8, 0.22, 0.2, 30).
     */
    law: makeLaw,
    /** Laws alive (development and tests). */
    get laws(): readonly GpuLaw[] { return [...laws]; },
    /** Lights every particle that can catch (`ignite`) within `radius` of `at`, this frame (up to MAX_IGNITES a frame). */
    ignite(at: Vec3Like, radius: number) { if (ignites.length < MAX_IGNITES) ignites.push({ at: { x: at.x, y: at.y, z: at.z }, radius }); },
    /**
     * Plays `batch` back, `after` seconds from now (the moment of the blow it recorded): over `seconds` each of its particles
     * runs its own path backwards (from where it is, through where it was a moment after its birth, to where it was born),
     * the tape speeding up and its colours going back with it; there it becomes `into` (or is gone). Up to MAX_REWINDS at
     * once, the oldest giving way. Siete vidas' blow un-happening.
     */
    rewind(batch: GpuBatch | undefined, o: { seconds?: number; after?: number; into?: string } = {}) {
      if (!batch) return;
      const into = o.into === undefined ? -1 : names.indexOf(o.into);
      if (o.into !== undefined && into < 0) throw new Error(`Unknown fight particle kind: ${o.into}`);
      if (rewinds.length >= MAX_REWINDS) rewinds.shift();
      rewinds.push({ start: batch.start, count: batch.count, elapsed: -Math.max(0, o.after ?? 0), seconds: Math.max(.05, o.seconds ?? .45), into, sent: false });
    },
    /** Simulates `dt` (and draws) while `on`; off, nothing runs and nothing is drawn. */
    update(dt: number, on: boolean) {
      entity.enabled = on && draw;
      if (!on) { batches.length = 0; ignites.length = 0; placeLights(false); return; }
      for (const e of emitters) {
        e.acc += e.rate * dt;
        const n = Math.floor(e.acc);
        if (n > 0) { e.acc -= n; queue(e.kind, { ...e, count: n, light: undefined }); }
      }
      for (const f of fields) {
        if (!f.follow) continue;
        const p = f.follow.getPosition(), o = f.offset;
        f.at.set(p.x + (o?.x ?? 0), p.y + (o?.y ?? 0), p.z + (o?.z ?? 0));
      }
      time += dt; frame++;
      const { parts, count } = writeParts();
      // Clouds of points (`points`): a row each, the first MAX_CLOUDS bursts of the frame; past them, a ball at `at`.
      const clouds = new Map<GpuBurst, number>();
      fill(cloudTex, out => batches.forEach(b => {
        if (b.o.shape !== 'points' || !b.o.points?.length || clouds.size >= MAX_CLOUDS) return;
        const row = clouds.size, points = b.o.points.slice(0, MAX_CLOUD_POINTS);
        clouds.set(b.o, row);
        points.forEach((p, i) => out.set([p.x, p.y, p.z, 1], (row * MAX_CLOUD_POINTS + i) * 4));
      }));
      uniforms.clouds.setValue(cloudTex);
      fill(spawnTex, out => batches.forEach((b, i) => {
        const o = b.o, cloud = clouds.get(o), s = SPAWN_SHAPES[o.shape === 'points' && cloud === undefined ? 'ball' : o.shape ?? 'ball'], v = o.velocity ?? { x: 0, y: 0, z: 0 }, at = o.at, row = i * SPAWN_COLS * 4;
        const end = cloud !== undefined ? { x: Math.min(MAX_CLOUD_POINTS, o.points!.length), y: 0, z: 0 } : o.shape === 'ring' ? (o.axis ?? { x: 0, y: 1, z: 0 }) : (o.to ?? o.at), c = o.colour ? tint(o.colour) : undefined;
        out.set([b.start, b.count, b.kind, Math.random()], row);
        out.set([at.x, at.y, at.z, o.spread ?? 0], row + 4);
        out.set([v.x, v.y, v.z, o.speed ?? 0], row + 8);
        out.set([s, cloud ?? o.fighter ?? 0, o.cone ?? 4, o.size ?? 1], row + 12);
        out.set([o.life[0], o.life[1], o.above ?? 0, o.outward ?? 0], row + 16);
        out.set([o.up ?? 0, Math.max(1, Math.round(o.chain ?? 1)), o.around ?? 0, b.member], row + 20);
        out.set([c?.[0] ?? 1, c?.[1] ?? 1, c?.[2] ?? 1, c ? 1 : 0], row + 24);
        out.set([end.x, end.y, end.z, b.home ? 1 : 0], row + 28);
        out.set([o.band?.[0] ?? -1, o.band?.[1] ?? 2, Math.min(1, Math.max(0, o.fromPart ?? 0)), o.path === undefined ? 0 : (Math.max(0, Math.round(o.path)) & 0xffff) + 1], row + 32);
      }));
      live = Math.min(N, live + batches.reduce((n, b) => n + b.count, 0));
      fill(fieldTex, out => fields.slice(0, MAX_FIELDS).forEach((f, i) => {
        const o = i * FIELD_COLS * 4;
        out.set([f.at.x, f.at.y, f.at.z, f.radius], o);
        out.set([f.swirl, f.pull, f.lift, f.turbulence], o + 4);
        out.set([f.axis.x, f.axis.y, f.axis.z, 0], o + 8);
      }));
      uniforms.state.setValue(states[current]);
      uniforms.kinds.setValue(kindTex); uniforms.spawns.setValue(spawnTex); uniforms.fields.setValue(fieldTex);
      uniforms.parts.setValue(partTex); uniforms.fighters.setValue(fighterTex); uniforms.surface.setValue(surfaceTex); uniforms.floorMap.setValue(floorTex);
      uniforms.dt.setValue(Math.min(dt, 1 / 20)); uniforms.time.setValue(time % 600); uniforms.frame.setValue(frame % 1e6);
      counts[0] = batches.length; counts[1] = Math.min(fields.length, MAX_FIELDS); counts[2] = count; counts[3] = parts;
      uniforms.counts.setValue(counts);
      extra[0] = writeVolumes();
      uniforms.extra.setValue(extra); uniforms.volumes.setValue(volumeTex);
      writeLattices(Math.min(dt, 1 / 20));
      uniforms.lattices.setValue(latticeTex);
      writeLaws();
      uniforms.laws.setValue(lawTex);
      fill(igniteTex, out => ignites.forEach((p, i) => out.set([p.at.x, p.at.y, p.at.z, p.radius], i * 4)));
      // Kept until a step with time in it reads them (a paused frame simulates nothing).
      extra[1] = ignites.length; if (dt > 0) ignites.length = 0;
      uniforms.ignites.setValue(igniteTex);
      // Batches played back: on the same clock as the step (a paused frame moves none of them).
      const step = Math.min(dt, 1 / 20);
      if (step > 0) for (const r of rewinds) r.elapsed += step;
      fill(rewindTex, out => rewinds.forEach((r, i) => { out.set([r.start, r.count, r.elapsed, r.seconds], i * 8); out.set([r.into, 0, 0, 0], i * 8 + 4); }));
      extra[3] = rewinds.length;
      uniforms.rewinds.setValue(rewindTex);
      // Told once they are past their time (the step turns them into what they become), they are done.
      if (step > 0) { for (const r of rewinds) if (r.elapsed >= r.seconds) r.sent = true; for (let i = rewinds.length - 1; i >= 0; i--) if (rewinds[i].sent && rewinds[i].elapsed >= rewinds[i].seconds + step * 1.5) rewinds.splice(i, 1); }
      uniforms.floor.setValue(floor);
      // The fluid: splat this frame's particles into the grid first, so the simulation reads it (§ The fluid).
      uniforms.gridAt.setValue(gridAt);
      // Bubbles read the grid only while it is filled this frame (otherwise it holds an old one).
      extra[2] = time < fluidUntil ? 1 : 0;
      uniforms.extra.setValue(extra);
      if (time < fluidUntil) splat.render();
      uniforms.grid.setValue(gridTex);
      pc.drawQuadWithShader(device, targets[1 - current], sim, undefined, undefined, 'Partículas de combate');
      current = 1 - current;
      batches.length = 0;
      material.setParameter('uState', states[current]);
      material.setParameter('uTime', time % 600);
      measureLight();
      placeLights(true);
    },
    /** Every particle gone (the fight ended). */
    clear() {
      states.forEach(s => fill(s, () => {}));
      [...lattices].forEach(l => l.remove());
      batches.length = 0; emitters.length = 0; fields.length = 0; volumes.length = 0; groups.length = 0; live = 0; head = 0;
      [...laws].forEach(l => l.remove()); ignites.length = 0; rewinds.length = 0;
      placeLights(false);
    },
    destroy() { destroyed = true; lights.forEach(e => e.destroy()); lightTarget.destroy(); entity.destroy(); targets.forEach(t => t.destroy()); gridTarget.destroy(); gridTex.destroy(); splatQuad.destroy(); splat.destroy(); [...states, kindTex, spawnTex, fieldTex, partTex, fighterTex, surfaceTex, floorTex, volumeTex, groupTex, lightTex, latticeTex, lawTex, igniteTex, cloudTex, rewindTex].forEach(t => t.destroy()); buffer.destroy(); quad.destroy(); material.destroy(); },
  };
}
export type FightParticles = ReturnType<typeof createFightParticles>;
