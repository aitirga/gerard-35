/**
 * Las cuerdas (docs/quests/marta.md): Marta's own place, past the bubble the wrong note opens. A dark
 * void crossed by strings of light, walked from south to north: three rectangles of hanging pieces,
 * a wide knot of strings after each where one of her qualities waits, and at the far end the round
 * place where every string meets and La Voz sings.
 *
 * Each rectangle is a maze of pieces. Marta's voice is heard far off, her recording in a loop
 * (`VOZ_SONG`, src/song.ts), and every piece answers to one of her notes: it is there while its note sounds and falls when it does not. Pure: the
 * plan and its grid, what holds at a moment, and whether a maze can be crossed. The look is
 * src/cuerdas-scene.ts.
 */
import type { Cell } from './movement.ts';
import { TONE_IDS, VOZ_SONG, phraseLength, type ToneId } from './song.ts';

/** A piece is this many cells on a side. */
export const TILE = 2;
/** Seconds before it falls that a piece trembles. */
export const TREMBLE = .7;
/** Seconds a piece is there before its note starts, and after its note ends. */
export const EARLY = .3, LATE = .3;
/** Seconds a piece takes to drop out from under whoever stands on it once it is gone: a step's grace. */
export const GRACE = .12;

export type MazeId = 'dos-notas' | 'una-pasada' | 'clavijas';
/**
 * A maze as drawn: rows of pieces, the far (north) one first. `d` `e` `f` `s` `l` `b` are pieces of
 * Do, Re, Fa, Sol, La and Si♭, the notes Marta sings far off (`VOZ_SONG`, src/song.ts); a capital is
 * cracked (it falls for good once stepped off); `K` is a knot, always there; `I` is a switch, always
 * there, that lays the maze's bridge (`=`) once stood on; `.` is nothing. With `pegs`, every piece of
 * a row answers to its row's peg instead (`r` is a piece of its row's note), each peg starting on the
 * note given, the near (south) row first.
 *
 * Her song decides what can be walked: two pieces side by side are both there only as she goes from
 * one note to the next (Do→Sol, Sol→Fa, Fa→Re, Do→Si♭, Si♭→La, La→Fa, each a few times a turn of the
 * recording), so a way across follows her melody, and a knot is where to wait for it.
 */
export interface MazeSpec { id: MazeId; name: string; rows: readonly string[]; pegs?: readonly ToneId[] }
const GLYPH: Record<string, ToneId> = { d: 'do', e: 're', f: 'fa', s: 'sol', l: 'la', b: 'sib' };

export const MAZES: readonly MazeSpec[] = [
  // Two notes, La and Fa, how each turn of her phrase ends: one piece is there while she sings its
  // note, and from La she goes straight to Fa. Knots to stop and listen on.
  { id: 'dos-notas', name: 'Dos notas', rows: [
    '. l f . . .',
    '. K l . f .',
    'f l K f l .',
    'K . f . K .',
    'l f l K f .',
    '. . K l . .',
  ] },
  // Cracked pieces that only hold once, and no way off the far side until the switch lays its bridge.
  // The switch is reached from below or from the far row, each over a cracked piece, and the far row
  // from below over a third: whoever goes up first and over to the switch cannot get back to the far
  // row. Up the right, over the switch, along the far row to the bridge. The right way up is the start
  // of her phrase (Do, Sol, Fa, Re), the left the end of it (Si♭, La, Fa).
  { id: 'una-pasada', name: 'Una pasada', rows: [
    '. . = = .',
    'f e e K D',
    'F . . . I',
    'l . . . E',
    'b K d s f',
    '. . d . .',
  ] },
  // Six rows, each answering to its peg: turned into the order she sings, the rows light one after
  // another as she goes from note to note; the knot is where she takes a breath, between Re and Do.
  { id: 'clavijas', name: 'Las clavijas', pegs: ['fa', 'do', 're', 'sol', 'la', 'sib'], rows: [
    '. r r . .',
    'r K . r .',
    '. r r r .',
    'r r . r .',
    '. r r r r',
    '. r r r .',
  ] },
];

export interface Piece {
  /** Its name in the run (`broken`): maze, column and row (row 0 is the near one). */
  id: string; maze: number; col: number; row: number;
  /** Its first cell (the piece covers TILE × TILE from it). */
  x: number; z: number;
  /** The note it answers to; none for a knot, which is always there, and for a pegged row's piece (`toneOf`). */
  tone?: ToneId; knot: boolean; cracked: boolean;
  /** A switch, always there, that lays the maze's bridge; a piece of that bridge, there once it is laid. */
  switch: boolean; bridge: boolean;
}
export interface Rect { x: number; z: number; w: number; d: number }
export interface Maze {
  spec: MazeSpec; cols: number; rows: number; rect: Rect; pieces: Piece[];
  /** Where a fall takes whoever fell: the near edge, on the way in. */
  start: Cell;
  /** Its pegs, one beside each row (near row first): the cell to stand on to turn it. */
  pegs: Cell[];
}
export type PlatformId = 'entrada' | 'lealtad' | 'cristalino' | 'directo';
export interface Platform { id: PlatformId; rect: Rect; centre: Cell }
export interface CuerdasPlan {
  width: number; depth: number; grid: string[]; spawn: Cell;
  mazes: Maze[]; platforms: Platform[]; bridges: Rect[];
  /** Walls standing on the way: closed cells, drawn as a block (the pegs' walkway meets the platform beyond its maze at one). */
  walls: Rect[];
  /** Where every string meets: La Voz's place. */
  centre: { x: number; z: number; radius: number };
}

const WIDTH = 41, MID = 20;
const span = (cols: number) => MID - Math.floor(cols * TILE / 2) + 1;
/** The whole place, laid out from the far end (north, z = 0) to the way in. */
export function buildPlan(): CuerdasPlan {
  const rects: Rect[] = [], bridges: Rect[] = [], platforms: Platform[] = [], mazes: Maze[] = [], walls: Rect[] = [];
  const centre = { x: MID, z: 10, radius: 8 };
  let z = centre.z + centre.radius + 1;
  const bridge = (d: number, x = MID - 1, w = 3) => { const r = { x, z, w, d }; bridges.push(r); rects.push(r); z += d; return r; };
  const platform = (id: PlatformId, w: number, d: number) => {
    const rect = { x: MID - Math.floor(w / 2), z, w, d };
    platforms.push({ id, rect, centre: { x: MID, z: z + Math.floor(d / 2) } }); rects.push(rect); z += d;
  };
  const maze = (index: number) => {
    const spec = MAZES[index], tokens = spec.rows.map(row => row.split(' '));
    const cols = tokens[0].length, rows = tokens.length, x0 = span(cols), z0 = z;
    // A pegged maze has a walkway down its west side, where the pegs are, reached from the landing before it.
    // Its far end is a wall: the walkway would otherwise run straight onto the platform beyond, round the maze.
    const pegs: Cell[] = [];
    if (spec.pegs) {
      const walk = { x: x0 - 3, z: z0 + 1, w: 2, d: rows * TILE + 1 };
      rects.push(walk); bridges.push(walk); walls.push({ x: walk.x, z: z0, w: walk.w, d: 1 });
      for (let row = 0; row < rows; row++) pegs.push({ x: walk.x + 1, z: z0 + (rows - 1 - row) * TILE + 1 });
    }
    const pieces: Piece[] = [];
    tokens.forEach((line, k) => line.forEach((glyph, col) => {
      if (glyph === '.') return;
      const row = rows - 1 - k, lower = glyph.toLowerCase();
      pieces.push({
        id: `${index}:${col}:${row}`, maze: index, col, row, x: x0 + col * TILE, z: z0 + k * TILE,
        tone: GLYPH[lower], knot: glyph === 'K', cracked: glyph !== lower && !'KI='.includes(glyph),
        switch: glyph === 'I', bridge: glyph === '=',
      });
    }));
    z += rows * TILE;
    // The landing before it, as wide as the maze (and its pegs' walkway), where a fall puts them back.
    const landing = { x: spec.pegs ? x0 - 3 : x0, z, w: cols * TILE + (spec.pegs ? 3 : 0), d: 2 };
    rects.push(landing); bridges.push(landing); z += 2;
    mazes[index] = { spec, cols, rows, rect: { x: x0, z: z0, w: cols * TILE, d: rows * TILE }, pieces, start: { x: MID, z: landing.z }, pegs };
  };
  bridge(6);
  platform('directo', 15, 12); maze(2); bridge(3);
  platform('cristalino', 15, 12); maze(1); bridge(3);
  platform('lealtad', 15, 12); maze(0); bridge(3);
  platform('entrada', 11, 9);
  const depth = z + 1;
  const cells = Array.from({ length: depth }, () => Array.from({ length: WIDTH }, () => '#'));
  const open = (x: number, zz: number) => { if (cells[zz]?.[x] !== undefined) cells[zz][x] = '.'; };
  for (const r of rects) for (let dz = 0; dz < r.d; dz++) for (let dx = 0; dx < r.w; dx++) open(r.x + dx, r.z + dz);
  for (const m of mazes) for (const p of m.pieces) for (let dz = 0; dz < TILE; dz++) for (let dx = 0; dx < TILE; dx++) open(p.x + dx, p.z + dz);
  for (let dz = -centre.radius; dz <= centre.radius; dz++) for (let dx = -centre.radius; dx <= centre.radius; dx++) {
    if (Math.hypot(dx, dz) <= centre.radius + .2) open(centre.x + dx, centre.z + dz);
  }
  const entrada = platforms.find(p => p.id === 'entrada')!;
  return {
    width: WIDTH, depth, grid: cells.map(row => row.join('')), spawn: { x: MID, z: entrada.rect.z + entrada.rect.d - 3 },
    mazes, platforms, bridges, walls, centre,
  };
}
export const CUERDAS = buildPlan();

/** The maze's puzzle while it runs: what each pegged row is tuned to, the cracked pieces gone, the mazes whose bridge is laid. Not saved. */
export interface CuerdasRun { tuning: ToneId[]; broken: string[]; laid?: number[] }
export const freshCuerdas = (): CuerdasRun => ({ tuning: [...MAZES.find(m => m.pegs)!.pegs!], broken: [], laid: [] });

/** The piece under a cell, if any. */
export function pieceAt(cell: Cell, plan: CuerdasPlan = CUERDAS): Piece | undefined {
  const x = Math.round(cell.x), z = Math.round(cell.z);
  for (const maze of plan.mazes) {
    const r = maze.rect;
    if (x < r.x || z < r.z || x >= r.x + r.w || z >= r.z + r.d) continue;
    return maze.pieces.find(p => x >= p.x && x < p.x + TILE && z >= p.z && z < p.z + TILE);
  }
}
/** The maze a cell is in (its rectangle), if any. */
export const mazeAt = (cell: Cell, plan: CuerdasPlan = CUERDAS) =>
  plan.mazes.find(({ rect: r }) => Math.round(cell.x) >= r.x && Math.round(cell.z) >= r.z && Math.round(cell.x) < r.x + r.w && Math.round(cell.z) < r.z + r.d);
/** The note a piece answers to now: its own, or its row's peg. */
export function toneOf(piece: Piece, run: CuerdasRun, plan: CuerdasPlan = CUERDAS): ToneId | undefined {
  if (piece.knot || piece.switch || piece.bridge) return undefined;
  return plan.mazes[piece.maze].spec.pegs ? run.tuning[piece.row] : piece.tone;
}
export type Hold = 'up' | 'trembling' | 'down';
/**
 * How a piece is `t` seconds into the song: up from EARLY before its note until LATE after it
 * (trembling in its last TREMBLE seconds), down otherwise; a knot is always up, a cracked piece
 * already stepped off always down. Two notes that follow each other overlap EARLY + LATE seconds:
 * the moment to step from one to the other. `sinceDown` is how long it has been down (to draw it
 * falling, and a step's grace), `untilUp` how long until it holds again (to draw it coming up).
 */
export function hold(piece: Piece, run: CuerdasRun, t: number, plan: CuerdasPlan = CUERDAS): { state: Hold; sinceDown: number; untilUp: number } {
  if (piece.knot || piece.switch) return { state: 'up', sinceDown: 0, untilUp: 0 };
  if (piece.bridge) return run.laid?.includes(piece.maze) ? { state: 'up', sinceDown: 0, untilUp: 0 } : { state: 'down', sinceDown: Infinity, untilUp: Infinity };
  if (run.broken.includes(piece.id)) return { state: 'down', sinceDown: Infinity, untilUp: Infinity };
  const phrase = VOZ_SONG, tone = toneOf(piece, run, plan), length = phraseLength(phrase);
  // When it holds within a turn of the phrase, and the turns either side.
  const spans: [number, number][] = [];
  let start = 0;
  for (const beat of phrase.beats) {
    if (beat.tone === tone) for (const k of [-1, 0, 1]) spans.push([start - EARLY + k * length, start + beat.sing + LATE + k * length]);
    start += beat.sing + beat.rest;
  }
  // A note no beat of the phrase sings never comes.
  if (!spans.length) return { state: 'down', sinceDown: Infinity, untilUp: Infinity };
  spans.sort((a, b) => a[0] - b[0]);
  const u = Math.max(0, t) % length, merged: [number, number][] = [];
  for (const span of spans) {
    const last = merged[merged.length - 1];
    if (last && span[0] <= last[1]) last[1] = Math.max(last[1], span[1]); else merged.push([...span]);
  }
  const on = merged.find(([a, b]) => u >= a && u < b);
  if (on) return { state: on[1] - u <= TREMBLE ? 'trembling' : 'up', sinceDown: 0, untilUp: 0 };
  const before = merged.filter(([, b]) => b <= u).pop()!, after = merged.find(([a]) => a > u)!;
  return { state: 'down', sinceDown: u - before[1], untilUp: after[0] - u };
}
/** Whether whoever stands on `cell` is held there `t` seconds into the song: solid ground, or a piece that is up (or only just gone, GRACE). */
export function holds(cell: Cell, run: CuerdasRun, t: number, plan: CuerdasPlan = CUERDAS) {
  if (!mazeAt(cell, plan)) return true;
  const piece = pieceAt(cell, plan);
  if (!piece) return false;
  const h = hold(piece, run, t, plan);
  return h.state !== 'down' || h.sinceDown < GRACE;
}
/** Stepping off a cracked piece breaks it for good (until the run starts over). Returns whether it broke now. */
export function leave(piece: Piece | undefined, run: CuerdasRun) {
  if (!piece?.cracked || run.broken.includes(piece.id)) return false;
  run.broken.push(piece.id);
  return true;
}
/** Turns a row's peg one note on, round the notes she sings. */
export function turnPeg(run: CuerdasRun, row: number): ToneId {
  const sung = TONE_IDS.filter(t => VOZ_SONG.beats.some(b => b.tone === t));
  const next = sung[(sung.indexOf(run.tuning[row]) + 1) % sung.length];
  run.tuning[row] = next;
  return next;
}
/** Standing on a switch lays its maze's bridge. Returns whether it was laid now. */
export function press(piece: Piece | undefined, run: CuerdasRun) {
  if (!piece?.switch || run.laid?.includes(piece.maze)) return false;
  (run.laid ??= []).push(piece.maze);
  return true;
}
/** A fall, or walking back out before it, puts that maze back as it was: its cracked pieces hang again and its bridge is taken up. */
export function mend(run: CuerdasRun, maze: number) {
  run.broken = run.broken.filter(id => !id.startsWith(`${maze}:`));
  run.laid = (run.laid ?? []).filter(m => m !== maze);
}

/**
 * Whether a maze can be crossed at `speed` cells a second, from its near edge to its far one, never
 * standing on a piece that is down: a search over (piece, moment of the phrase, cracked pieces
 * gone), a step taking the time to walk a piece's width. A step only counts if setting out up to
 * `slack` seconds earlier or later works too: a person presses a key, not a frame. For the tests,
 * so no maze ships unbeatable.
 */
export function crossable(index: number, run: CuerdasRun = freshCuerdas(), speed = 5.2, plan: CuerdasPlan = CUERDAS, slack = .2) {
  const maze = plan.mazes[index], phrase = VOZ_SONG, length = phraseLength(phrase), pieces = maze.pieces, n = pieces.length;
  const step = TILE / speed, ticks = Math.round(length / step) * 8, tick = length / ticks, stride = Math.max(1, Math.round(step / tick));
  const give = Math.round(slack / tick), edge = Math.floor(stride / 2);
  // Whether each piece holds at each tick of the phrase, before anything breaks and with the bridge laid.
  const up = pieces.map(p => Array.from({ length: ticks }, (_, k) => holds({ x: p.x, z: p.z }, { tuning: run.tuning, broken: [], laid: [index] }, k * tick, plan)));
  const next = pieces.map(p => [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dc, dr]) => pieces.findIndex(q => q.col === p.col + dc && q.row === p.row + dr)).filter(i => i >= 0));
  // The cracked pieces are bits of a mask; a state is (piece, tick, cracked gone, bridge laid).
  const bit = pieces.map(p => p.cracked ? 1 << pieces.filter(q => q.cracked).indexOf(p) : 0), masks = 1 << pieces.filter(p => p.cracked).length;
  const safe = (i: number, time: number, gone: number, laid: number) => !(bit[i] & gone) && (!pieces[i].bridge || !!laid) && up[i][((time % ticks) + ticks) % ticks];
  const code = (i: number, time: number, gone: number, laid: number) => ((gone * 2 + laid) * n + i) * ticks + time % ticks;
  const seen = new Uint8Array(masks * 2 * n * ticks), queue: number[] = [];
  const push = (i: number, time: number, gone: number, laid: number) => { const c = code(i, time, gone, laid); if (!seen[c]) { seen[c] = 1; queue.push(c); } };
  const gone0 = pieces.reduce((m, p, i) => run.broken.includes(p.id) ? m | bit[i] : m, 0), laid0 = run.laid?.includes(index) ? 1 : 0;
  // Onto any piece of the near row, at any moment it is up (they wait on the landing).
  pieces.forEach((p, i) => { if (p.row === 0) for (let t = 0; t < ticks; t++) if (safe(i, t, gone0, laid0)) push(i, t, gone0, laid0 | (p.switch ? 1 : 0)); });
  for (let q = 0; q < queue.length; q++) {
    let c = queue[q];
    const time = c % ticks; c = (c - time) / ticks;
    const i = c % n; c = (c - i) / n;
    const laid = c % 2, gone = (c - laid) / 2;
    if (pieces[i].row === maze.rows - 1 && safe(i, time + stride, gone, laid)) return true;
    // Wait a moment where they stand, if it still holds.
    if (safe(i, time + 1, gone, laid)) push(i, time + 1, gone, laid);
    const left = gone | bit[i];
    for (const j of next[i]) {
      if (bit[j] & gone) continue;
      // Both hold at the moment they cross from one to the other (halfway, at the edge between them),
      // and the new one still as they reach its middle: setting out a little sooner or later too.
      let ok = true;
      for (let d = -give; d <= give && ok; d++) ok = safe(i, time + d + edge, gone, laid) && safe(j, time + d + edge, left, laid) && safe(j, time + d + stride, left, laid);
      if (ok) push(j, time + stride, left, laid | (pieces[j].switch ? 1 : 0));
    }
  }
  return false;
}
/** The tuning that puts a pegged maze's rows in the song's order, starting on its first note. */
export function inOrder(plan: CuerdasPlan = CUERDAS): ToneId[] {
  const maze = plan.mazes.find(m => m.spec.pegs)!, beats = VOZ_SONG.beats;
  return Array.from({ length: maze.rows }, (_, row) => beats[row % beats.length].tone);
}
