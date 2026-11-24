/**
 * Las parcelas (docs/quests/universidad.md § Càmping Eurocamping): the campsite's word-clue puzzle.
 * Pure: the board's rules and how a puzzle is loaded. The screen is `src/parcelas-ui.ts`; the
 * puzzles are made by `just parcelas` (tools/parcelas.py) into `src/parcelas/`.
 *
 * A grid of pitches, each with a word. The blackboard shows one clue at a time, a word and how many
 * pitches go with it; after that many picks and one more, or when they are all lit, it shows the next
 * one. A pitch of a later clue can be lit early, and one of an earlier clue late. A wrong pitch wakes
 * its tent (a fight); the black one puts every lantern out.
 */
export type Role = 'ours' | 'tent' | 'black';
export interface Pitch { word: string; role: Role }
export interface Clue { word: string; count: number; targets: number[] }
export interface Puzzle { version: 1; level: string; cols: number; rows: number; pitches: Pitch[]; clues: Clue[] }
/** The real day's puzzle: compressed (zlib) and in base64, so nobody reads it by accident. Not a secret. */
export interface Sealed { version: 1; level: string; sealed: string }

export interface Board {
  /** Pitches whose lantern is lit. */
  lit: readonly number[];
  /** Pitches turned over that were wrong: tents woken and the black one. They stay shown. */
  shown: readonly number[];
  /** How many times the black pitch was chosen. */
  darkness: number;
  /** The clue the blackboard was left on (its index; 0 when missing). */
  clue?: number;
  /** Pitches chosen under that clue: at its number and one more, the blackboard shows the next. */
  picks?: number;
}
export type Outcome = 'lit' | 'tent' | 'black' | 'taken';

export const createBoard = (): Board => ({ lit: [], shown: [], darkness: 0, clue: 0, picks: 0 });

const missing = (clue: Clue, board: Board) => !clue.targets.every(t => board.lit.includes(t));
/** Index of the clue on the blackboard: the one it was left on, or the next still missing a pitch (after the last, the first again). */
function clueAt(puzzle: Puzzle, board: Board, from = board.clue ?? 0): number {
  const n = puzzle.clues.length;
  for (let k = 0; k < n; k++) if (missing(puzzle.clues[(from + k) % n], board)) return (from + k) % n;
  return -1;
}
/** The clue on the blackboard now. None once the puzzle is done. */
export function currentClue(puzzle: Puzzle, board: Board): Clue | undefined {
  return puzzle.clues[clueAt(puzzle, board)];
}
export const solved = (puzzle: Puzzle, board: Board) => !currentClue(puzzle, board);

/**
 * Choosing a pitch: what happens, and the board after it. As at the real table, a clue lets the
 * players choose its number and one more (MAR · 2: three picks); then, or once its pitches are all
 * lit, the blackboard shows the next clue. Its pitches still missing can be lit under a later one.
 */
export function choose(puzzle: Puzzle, board: Board, index: number): { outcome: Outcome; board: Board } {
  const pitch = puzzle.pitches[index];
  if (!pitch || solved(puzzle, board) || board.lit.includes(index) || board.shown.includes(index) && pitch.role === 'tent') return { outcome: 'taken', board };
  const shown = board.shown.includes(index) ? board.shown : [...board.shown, index];
  // Every lantern goes out: the board starts again from the first clue. What was shown stays shown.
  if (pitch.role === 'black') return { outcome: 'black', board: { lit: [], shown, darkness: board.darkness + 1, clue: 0, picks: 0 } };
  const at = clueAt(puzzle, board), picks = (board.picks ?? 0) + 1;
  const next = pitch.role === 'ours' ? { ...board, lit: [...board.lit, index] } : { ...board, shown };
  const over = picks > puzzle.clues[at].count || !missing(puzzle.clues[at], next);
  const moved = { ...next, clue: over ? (at + 1) % puzzle.clues.length : at, picks: over ? 0 : picks };
  return { outcome: pitch.role === 'ours' ? 'lit' : 'tent', board: moved };
}

const isSealed = (data: Puzzle | Sealed): data is Sealed => 'sealed' in data;

/** A puzzle as stored: plain, or sealed (zlib, the format Python's `zlib.compress` writes). */
export async function loadPuzzle(data: Puzzle | Sealed): Promise<Puzzle> {
  if (!isSealed(data)) return data;
  const bytes = Uint8Array.from(atob(data.sealed), c => c.charCodeAt(0));
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate'));
  return JSON.parse(await new Response(stream).text()) as Puzzle;
}
