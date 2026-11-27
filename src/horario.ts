/**
 * El horario (docs/castle.md § The closed doors): the second floor's closed door. A timetable half made
 * on the wall, the job Gerard does every September: four subjects, four classrooms, four hours.
 * Nobody teaches in two classrooms at once (each subject once in every hour's row) and no group
 * repeats a subject (once in every classroom's column). Some cells are already written in ink; the
 * rest is to be filled so that it squares, and it squares one way only. Another one each day: it is
 * made from the floor's own seed. Pure: no engine, no screen here (src/horario-ui.ts draws it).
 */
export const HORARIO_SIZE = 4;
/** The four subjects, as they are written on the board: a short code and its full name. */
export const SUBJECTS = [
  { code: 'MAT', name: 'Matemáticas' },
  { code: 'LEN', name: 'Lengua' },
  { code: 'ING', name: 'Inglés' },
  { code: 'MÚS', name: 'Música' },
] as const;
export const HOURS = ['8:00', '9:00', '10:00', '11:30'] as const;
export const CLASSROOMS = ['2.º A', '2.º B', '2.º C', '2.º D'] as const;
/** A board: sixteen cells, row by row (an hour a row, a classroom a column); 0 is empty, 1 to 4 a subject. */
export type Board = number[];
export interface Horario { given: Board; solution: Board }

const N = HORARIO_SIZE;
function mulberry(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/** Whether `value` can go in cell `i` of `board` without repeating in its row or its column. */
function fits(board: Board, i: number, value: number) {
  const row = Math.floor(i / N), column = i % N;
  for (let k = 0; k < N; k++) {
    if (k !== column && board[row * N + k] === value) return false;
    if (k !== row && board[k * N + column] === value) return false;
  }
  return true;
}
/** How many ways `board` can be finished, counted up to `most`. */
export function solutions(board: Board, most = 2): number {
  const at = board.indexOf(0);
  if (at < 0) return 1;
  let found = 0;
  for (let value = 1; value <= N && found < most; value++) {
    if (!fits(board, at, value)) continue;
    board[at] = value;
    found += solutions(board, most - found);
    board[at] = 0;
  }
  return found;
}
/** Whether a board is full and squares: every subject once in each row and in each column. */
export function squares(board: Board) {
  return board.length === N * N && board.every((value, i) => value >= 1 && value <= N && fits(board, i, value));
}
/** How few cells are left written, at least: fewer than this and it reads as a guess, not a timetable. */
export const HORARIO_GIVEN = 5;
/**
 * The timetable of `seed`: a full one that squares, with as many cells rubbed out as can go while it
 * still squares one way only (never fewer than `HORARIO_GIVEN` left).
 */
export function horarioFor(seed: number): Horario {
  const random = mulberry(seed ^ 0x5bd1e995);
  const shuffled = <T>(list: readonly T[]) => { const out = [...list]; for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; } return out; };
  // A full board by backtracking over shuffled values: any of the 576 there are.
  const solution: Board = Array.from({ length: N * N }, () => 0);
  const fill = (i: number): boolean => {
    if (i === N * N) return true;
    for (const value of shuffled([1, 2, 3, 4])) {
      if (!fits(solution, i, value)) continue;
      solution[i] = value;
      if (fill(i + 1)) return true;
      solution[i] = 0;
    }
    return false;
  };
  fill(0);
  const given = [...solution];
  let left = N * N;
  for (const i of shuffled(given.map((_, k) => k))) {
    if (left <= HORARIO_GIVEN) break;
    const was = given[i];
    given[i] = 0;
    if (solutions([...given]) === 1) left--; else given[i] = was;
  }
  return { given, solution };
}
/** A board as the player has it: the written cells stay what they are, whatever is tried over them. */
export function withGiven(horario: Horario, tried: Board): Board {
  return horario.given.map((value, i) => value || (tried[i] ?? 0));
}
