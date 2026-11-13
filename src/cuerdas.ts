/**
 * Las cuerdas (docs/quests/marta.md): Marta's own place, past the bubble the wrong note opens. A dark
 * void crossed by strings of light, walked from south to north: three rectangles of hanging pieces,
 * a wide knot of strings after each where one of her qualities waits, and at the far end the round
 * place where every string meets and La Voz sings.
 *
 * Each rectangle is a maze of pieces. The voice sings a phrase in a loop (src/song.ts) and every
 * piece answers to one note: it is there while its note sounds and falls when it does not. Pure: the
 * plan and its grid, what holds at a moment, and whether a maze can be crossed. The look is
 * src/cuerdas-scene.ts.
 */
import type { Cell } from './movement.ts';
import { PHRASES, TONE_IDS, phraseLength, songAt, type PhraseId, type ToneId } from './song.ts';

/** A piece is this many cells on a side. */
export const TILE = 2;
/** Seconds before it falls that a piece trembles. */
export const TREMBLE = .7;
/** Seconds a piece takes to drop out from under whoever stands on it once its note ends: a step's grace. */
export const GRACE = .18;

export type MazeId = 'dos-notas' | 'una-pasada' | 'clavijas';
/**
 * A maze as drawn: rows of pieces, the far (north) one first. `a` `d` `m` `s` are pieces of La, Do, Mi
 * and Sol; a capital is cracked (it falls for good once stepped off); `K` is a knot, always there;
 * `.` is nothing. With `pegs`, every piece of a row answers to its row's peg instead (`r` is a piece
 * of its row's note), each peg starting on the note given, the near (south) row first.
 */
export interface MazeSpec { id: MazeId; name: string; phrase: PhraseId; rows: readonly string[]; pegs?: readonly ToneId[] }
const GLYPH: Record<string, ToneId> = { a: 'la', d: 'do', m: 'mi', s: 'sol' };

export const MAZES: readonly MazeSpec[] = [
  // Two notes taking turns: half the floor is there, half is not. Knots to stop and listen on.
  { id: 'dos-notas', name: 'Dos notas', phrase: 'dos-notas', rows: [
    '. a m a . .',
    'a m . m a .',
    'm K a . m a',
    'a m . a K m',
    '. a m a m .',
    '. . K a . .',
  ] },
  // Three notes, and cracked pieces that only hold once: the way is planned before setting out.
  { id: 'una-pasada', name: 'Una pasada', phrase: 'una-pasada', rows: [
    '. . M a . .',
    '. a D . d .',
    '. M . m A .',
    '. d a D . .',
    '. . K a m .',
    '. . a d . .',
  ] },
  // Six rows, each answering to its peg: turned into the song's order, the rows light one after another.
  { id: 'clavijas', name: 'Las clavijas', phrase: 'clavijas', pegs: ['do', 'la', 'mi', 'mi', 'la', 'do'], rows: [
    '. r r . .',
    'r r . r .',
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
  /** Where every string meets: La Voz's place. */
  centre: { x: number; z: number; radius: number };
}

const WIDTH = 41, MID = 20;
const span = (cols: number) => MID - Math.floor(cols * TILE / 2) + 1;
/** The whole place, laid out from the far end (north, z = 0) to the way in. */
export function buildPlan(): CuerdasPlan {
  const rects: Rect[] = [], bridges: Rect[] = [], platforms: Platform[] = [], mazes: Maze[] = [];
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
    const pegs: Cell[] = [];
    if (spec.pegs) {
      const walk = { x: x0 - 3, z: z0, w: 2, d: rows * TILE + 2 };
      rects.push(walk); bridges.push(walk);
      for (let row = 0; row < rows; row++) pegs.push({ x: walk.x + 1, z: z0 + (rows - 1 - row) * TILE });
    }
    const pieces: Piece[] = [];
    tokens.forEach((line, k) => line.forEach((glyph, col) => {
      if (glyph === '.') return;
      const row = rows - 1 - k, lower = glyph.toLowerCase();
      pieces.push({
        id: `${index}:${col}:${row}`, maze: index, col, row, x: x0 + col * TILE, z: z0 + k * TILE,
        tone: GLYPH[lower], knot: glyph === 'K', cracked: glyph !== lower && glyph !== 'K',
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
    mazes, platforms, bridges, centre,
  };
}
export const CUERDAS = buildPlan();

/** The maze's puzzle while it runs: what each pegged row is tuned to, and the cracked pieces gone. Not saved. */
export interface CuerdasRun { tuning: ToneId[]; broken: string[] }
export const freshCuerdas = (): CuerdasRun => ({ tuning: [...MAZES.find(m => m.pegs)!.pegs!], broken: [] });

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
  if (piece.knot) return undefined;
  return plan.mazes[piece.maze].spec.pegs ? run.tuning[piece.row] : piece.tone;
}
export type Hold = 'up' | 'trembling' | 'down';
/**
 * How a piece is `t` seconds into the song: up while its note sounds (trembling in its last TREMBLE
 * seconds), down otherwise; a knot is always up, a cracked piece already stepped off always down.
 * `sinceDown` is how long it has been down (for the grace of a step, and to draw it falling).
 */
export function hold(piece: Piece, run: CuerdasRun, t: number, plan: CuerdasPlan = CUERDAS): { state: Hold; sinceDown: number; untilUp: number } {
  if (piece.knot) return { state: 'up', sinceDown: 0, untilUp: 0 };
  if (run.broken.includes(piece.id)) return { state: 'down', sinceDown: Infinity, untilUp: Infinity };
  const phrase = PHRASES[plan.mazes[piece.maze].spec.phrase], tone = toneOf(piece, run, plan), now = songAt(phrase, t);
  if (now.tone === tone) return { state: now.left <= TREMBLE ? 'trembling' : 'up', sinceDown: 0, untilUp: 0 };
  // How long ago its note ended, and how long until it sounds again, walking the phrase both ways.
  const beats = phrase.beats, n = beats.length;
  let since = now.into, until = now.left;
  for (let k = 1; k < n && beats[(now.index - k + n) % n].tone !== tone; k++) since += beats[(now.index - k + n) % n].sing;
  for (let k = 1; k < n && beats[(now.index + k) % n].tone !== tone; k++) until += beats[(now.index + k) % n].sing;
  // A note no beat of the phrase sings never comes.
  if (!beats.some(b => b.tone === tone)) return { state: 'down', sinceDown: Infinity, untilUp: Infinity };
  return { state: 'down', sinceDown: since, untilUp: until };
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
/** Turns a row's peg one note on, round the notes its maze's phrase sings. */
export function turnPeg(run: CuerdasRun, row: number, plan: CuerdasPlan = CUERDAS): ToneId {
  const maze = plan.mazes.find(m => m.spec.pegs)!, sung = TONE_IDS.filter(t => PHRASES[maze.spec.phrase].beats.some(b => b.tone === t));
  const next = sung[(sung.indexOf(run.tuning[row]) + 1) % sung.length];
  run.tuning[row] = next;
  return next;
}
/** A fall puts back what broke in that maze: its cracked pieces hang again. */
export function mend(run: CuerdasRun, maze: number) { run.broken = run.broken.filter(id => !id.startsWith(`${maze}:`)); }

/**
 * Whether a maze can be crossed at `speed` cells a second, from its near edge to its far one, never
 * standing on a piece that is down: a search over (piece, moment of the phrase, cracked pieces
 * gone), a step taking the time to walk a piece's width. For the tests, so no maze ships unbeatable.
 */
export function crossable(index: number, run: CuerdasRun = freshCuerdas(), speed = 5.2, plan: CuerdasPlan = CUERDAS) {
  const maze = plan.mazes[index], phrase = PHRASES[maze.spec.phrase], length = phraseLength(phrase);
  const step = TILE / speed, ticks = Math.round(length / step) * 8, tick = length / ticks, stride = Math.max(1, Math.round(step / tick));
  const at = (col: number, row: number) => maze.pieces.find(p => p.col === col && p.row === row);
  const safe = (p: Piece, time: number, broken: readonly string[]) => holds({ x: p.x, z: p.z }, { tuning: run.tuning, broken: [...broken] }, time * tick, plan);
  type State = { piece: Piece; time: number; broken: string[] };
  const key = (s: State) => `${s.piece.id}|${s.time % ticks}|${s.broken.join(',')}`;
  const queue: State[] = [], seen = new Set<string>();
  const push = (s: State) => { const k = key(s); if (!seen.has(k)) { seen.add(k); queue.push(s); } };
  // Onto any piece of the near row, at any moment it is up (they wait on the landing).
  const gone = [...run.broken].sort();
  for (const piece of maze.pieces.filter(p => p.row === 0)) for (let time = 0; time < ticks; time++) if (safe(piece, time, gone)) push({ piece, time, broken: gone });
  for (let i = 0; i < queue.length && i < 400000; i++) {
    const { piece, time, broken } = queue[i];
    if (piece.row === maze.rows - 1 && safe(piece, time + stride, broken)) return true;
    // Wait a moment where they stand, if it still holds.
    if (safe(piece, time + 1, broken)) push({ piece, time: time + 1, broken });
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const to = at(piece.col + dc, piece.row + dr);
      if (!to || broken.includes(to.id)) continue;
      const left = piece.cracked ? [...broken, piece.id].sort() : broken;
      // Both hold while they cross from one to the other.
      if (safe(piece, time + Math.floor(stride / 2), broken) && safe(to, time + stride, left)) push({ piece: to, time: time + stride, broken: left });
    }
  }
  return false;
}
/** The tuning that puts a pegged maze's rows in the song's order, starting on its first note. */
export function inOrder(plan: CuerdasPlan = CUERDAS): ToneId[] {
  const maze = plan.mazes.find(m => m.spec.pegs)!, beats = PHRASES[maze.spec.phrase].beats;
  return Array.from({ length: maze.rows }, (_, row) => beats[row % beats.length].tone);
}
