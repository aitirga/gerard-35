import test from 'node:test';
import assert from 'node:assert/strict';
import { deflateSync } from 'node:zlib';
import { readFileSync } from 'node:fs';
import { choose, createBoard, currentClue, loadPuzzle, solved } from '../src/parcelas.ts';

// 3 × 3: MAR → OLA, ARENA; JUEGO → DADO, CARTA; TREN is the black pitch.
const PUZZLE = {
  version: 1, level: 'test', cols: 3, rows: 3,
  pitches: [['OLA', 'ours'], ['DADO', 'ours'], ['PINO', 'tent'], ['ARENA', 'ours'], ['CARTA', 'ours'], ['GATO', 'tent'],
    ['LUNA', 'tent'], ['TREN', 'black'], ['TOALLA', 'tent']].map(([word, role]) => ({ word, role })),
  clues: [{ word: 'MAR', count: 2, targets: [0, 3] }, { word: 'JUEGO', count: 2, targets: [1, 4] }],
};
const play = picks => picks.reduce(({ board, outcomes }, i) => {
  const step = choose(PUZZLE, board, i);
  return { board: step.board, outcomes: [...outcomes, step.outcome] };
}, { board: createBoard(), outcomes: [] });

test('the blackboard shows the first clue not wholly lit, and the puzzle ends when all are', () => {
  const { board, outcomes } = play([0, 3, 1, 4]);
  assert.deepEqual(outcomes, ['lit', 'lit', 'lit', 'lit']);
  assert.ok(solved(PUZZLE, board));
  assert.equal(currentClue(PUZZLE, play([0, 3]).board).word, 'JUEGO');
});

test('a pitch of a later clue can be lit early, and still counts', () => {
  const { board } = play([1, 0]);
  assert.equal(currentClue(PUZZLE, board).word, 'MAR');
  assert.equal(currentClue(PUZZLE, play([1, 0, 3]).board).word, 'JUEGO');
});

test('a wrong pitch wakes its tent once and stays shown; a lit one cannot be chosen again', () => {
  const { board, outcomes } = play([2, 2, 0, 0]);
  assert.deepEqual(outcomes, ['tent', 'taken', 'lit', 'taken']);
  assert.deepEqual(board.shown, [2]);
});

test('the black pitch puts every lantern out and the board starts again from the first clue', () => {
  const { board, outcomes } = play([0, 3, 1, 7]);
  assert.equal(outcomes.at(-1), 'black');
  assert.deepEqual(board.lit, []);
  assert.equal(board.darkness, 1);
  assert.equal(currentClue(PUZZLE, board).word, 'MAR');
  // It can be chosen again, and it does the same.
  assert.equal(choose(PUZZLE, board, 7).outcome, 'black');
});

test('a sealed puzzle opens as Python wrote it (zlib in base64)', async () => {
  const sealed = { version: 1, level: 'test', sealed: deflateSync(Buffer.from(JSON.stringify(PUZZLE))).toString('base64') };
  assert.deepEqual(await loadPuzzle(sealed), PUZZLE);
  assert.equal(await loadPuzzle(PUZZLE), PUZZLE);
});

test('the test puzzle in the game is the original board: 5 × 5, nine to find, one black', () => {
  const puzzle = JSON.parse(readFileSync(new URL('../src/parcelas/prueba.json', import.meta.url)));
  assert.equal(puzzle.pitches.length, puzzle.cols * puzzle.rows);
  assert.equal(puzzle.cols * puzzle.rows, 25);
  assert.equal(puzzle.pitches.filter(p => p.role === 'ours').length, 9);
  assert.equal(puzzle.pitches.filter(p => p.role === 'black').length, 1);
  assert.deepEqual(puzzle.clues.flatMap(c => c.targets).sort((a, b) => a - b), puzzle.pitches.flatMap((p, i) => p.role === 'ours' ? [i] : []));
});
