/**
 * Las parcelas (docs/quests/universidad.md § Càmping Eurosport): the campsite's word-clue puzzle.
 * Pure: the board's rules and how a puzzle is loaded. The screen is `src/parcelas-ui.ts`; the
 * puzzles are made by `just parcelas` (tools/parcelas.py) into `src/parcelas/`.
 *
 * A grid of pitches, each with a word. The blackboard shows one clue at a time, a word and how many
 * pitches go with it; when they are all lit it shows the next one. A pitch of a later clue can be lit
 * early. A wrong pitch wakes its tent (a fight); the black one puts every lantern out.
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
}
export type Outcome = 'lit' | 'tent' | 'black' | 'taken';

export const createBoard = (): Board => ({ lit: [], shown: [], darkness: 0 });

/** The clue on the blackboard now: the first one not wholly lit. None once the puzzle is done. */
export function currentClue(puzzle: Puzzle, board: Board): Clue | undefined {
  return puzzle.clues.find(clue => !clue.targets.every(t => board.lit.includes(t)));
}
export const solved = (puzzle: Puzzle, board: Board) => !currentClue(puzzle, board);

/** Choosing a pitch: what happens, and the board after it. */
export function choose(puzzle: Puzzle, board: Board, index: number): { outcome: Outcome; board: Board } {
  const pitch = puzzle.pitches[index];
  if (!pitch || solved(puzzle, board) || board.lit.includes(index) || board.shown.includes(index) && pitch.role === 'tent') return { outcome: 'taken', board };
  if (pitch.role === 'ours') return { outcome: 'lit', board: { ...board, lit: [...board.lit, index] } };
  const shown = board.shown.includes(index) ? board.shown : [...board.shown, index];
  if (pitch.role === 'tent') return { outcome: 'tent', board: { ...board, shown } };
  // Every lantern goes out: the board starts again from the first clue. What was shown stays shown.
  return { outcome: 'black', board: { lit: [], shown, darkness: board.darkness + 1 } };
}

const isSealed = (data: Puzzle | Sealed): data is Sealed => 'sealed' in data;

/** A puzzle as stored: plain, or sealed (zlib, the format Python's `zlib.compress` writes). */
export async function loadPuzzle(data: Puzzle | Sealed): Promise<Puzzle> {
  if (!isSealed(data)) return data;
  const bytes = Uint8Array.from(atob(data.sealed), c => c.charCodeAt(0));
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate'));
  return JSON.parse(await new Response(stream).text()) as Puzzle;
}
