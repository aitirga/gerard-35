import test from 'node:test';
import assert from 'node:assert/strict';
import { CUERDAS, GRACE, MAZES, TILE, TREMBLE, crossable, freshCuerdas, hold, holds, inOrder, leave, mazeAt, mend, pieceAt, turnPeg } from '../src/cuerdas.ts';
import { PHRASES } from '../src/song.ts';
import { stageFight } from '../src/arena.ts';

const walkable = (x, z) => CUERDAS.grid[z]?.[x] === '.';

test('the place is one way from the way in to where every string meets', () => {
  assert.ok(walkable(CUERDAS.spawn.x, CUERDAS.spawn.z));
  // A walk over everything that can be stood on reaches the centre.
  const seen = new Set([`${CUERDAS.spawn.x},${CUERDAS.spawn.z}`]), queue = [CUERDAS.spawn];
  for (let i = 0; i < queue.length; i++) for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const x = queue[i].x + dx, z = queue[i].z + dz;
    if (!walkable(x, z) || seen.has(`${x},${z}`)) continue;
    seen.add(`${x},${z}`); queue.push({ x, z });
  }
  assert.ok(seen.has(`${CUERDAS.centre.x},${CUERDAS.centre.z}`));
  assert.equal(CUERDAS.mazes.length, 3);
  assert.deepEqual(CUERDAS.platforms.map(p => p.id), ['directo', 'cristalino', 'lealtad', 'entrada']);
  // South to north: the way in, then each maze before its quality's platform.
  const z = id => CUERDAS.platforms.find(p => p.id === id).centre.z;
  assert.ok(z('entrada') > CUERDAS.mazes[0].rect.z && CUERDAS.mazes[0].rect.z > z('lealtad'));
  assert.ok(z('lealtad') > CUERDAS.mazes[1].rect.z && CUERDAS.mazes[1].rect.z > z('cristalino'));
  assert.ok(z('cristalino') > CUERDAS.mazes[2].rect.z && CUERDAS.mazes[2].rect.z > z('directo'));
  assert.ok(z('directo') > CUERDAS.centre.z);
});

test('every piece is whole cells of the grid, and nothing else in a maze can be stood on', () => {
  for (const maze of CUERDAS.mazes) {
    for (const p of maze.pieces) for (let dx = 0; dx < TILE; dx++) for (let dz = 0; dz < TILE; dz++) {
      assert.ok(walkable(p.x + dx, p.z + dz), p.id);
      assert.equal(pieceAt({ x: p.x + dx, z: p.z + dz }), p);
    }
    const { rect: r } = maze;
    for (let x = r.x; x < r.x + r.w; x++) for (let z = r.z; z < r.z + r.d; z++) assert.equal(walkable(x, z), !!pieceAt({ x, z }), `${x},${z}`);
    assert.equal(mazeAt(maze.start), undefined);
    assert.ok(walkable(maze.start.x, maze.start.z));
  }
});

test('a piece is there while its note sounds, trembles before it goes, and a step\'s grace after', () => {
  const run = freshCuerdas(), maze = CUERDAS.mazes[0], sing = PHRASES['dos-notas'].beats[0].sing;
  const la = maze.pieces.find(p => p.tone === 'la'), mi = maze.pieces.find(p => p.tone === 'mi'), knot = maze.pieces.find(p => p.knot);
  assert.equal(hold(la, run, .1).state, 'up');
  assert.equal(hold(mi, run, .1).state, 'down');
  assert.equal(hold(la, run, sing - TREMBLE / 2).state, 'trembling');
  assert.equal(hold(la, run, sing + .05).state, 'down');
  assert.equal(hold(mi, run, sing + .05).state, 'up');
  assert.equal(hold(knot, run, 1.7).state, 'up');
  // Standing on it as its note ends: held for a step, then not.
  assert.ok(holds({ x: la.x, z: la.z }, run, sing + GRACE / 2));
  assert.ok(!holds({ x: la.x, z: la.z }, run, sing + GRACE * 2));
  // Solid ground always holds; a gap in a maze never does.
  assert.ok(holds(CUERDAS.spawn, run, 3));
  const gap = { x: maze.rect.x, z: maze.rect.z + maze.rect.d - 1 };
  assert.equal(pieceAt(gap), undefined);
  assert.ok(!holds(gap, run, 0));
  // How long until it is back, for whoever draws it coming up.
  const down = hold(la, run, sing + .5);
  assert.ok(Math.abs(down.sinceDown - .5) < 1e-9 && Math.abs(down.untilUp - (sing - .5)) < 1e-9);
});

test('a cracked piece holds once: stepped off, it is gone until a fall puts the maze back', () => {
  const run = freshCuerdas(), cracked = CUERDAS.mazes[1].pieces.find(p => p.cracked), whole = CUERDAS.mazes[1].pieces.find(p => !p.cracked && !p.knot);
  assert.ok(cracked);
  assert.equal(leave(whole, run), false);
  assert.equal(leave(cracked, run), true);
  assert.equal(leave(cracked, run), false);
  for (let t = 0; t < 10; t += .3) assert.equal(hold(cracked, run, t).state, 'down');
  mend(run, 0);
  assert.equal(run.broken.length, 1);
  mend(run, 1);
  assert.equal(run.broken.length, 0);
  assert.ok(CUERDAS.mazes[0].pieces.every(p => !p.cracked) && CUERDAS.mazes[2].pieces.every(p => !p.cracked));
});

test('a peg turns its whole row to the next note the phrase sings', () => {
  const run = freshCuerdas(), maze = CUERDAS.mazes[2];
  assert.equal(maze.pegs.length, maze.rows);
  assert.deepEqual(run.tuning, [...MAZES[2].pegs]);
  const row = maze.pieces.filter(p => p.row === 0);
  assert.equal(hold(row[0], run, .1).state, 'down');
  assert.equal(turnPeg(run, 0), 'mi');
  assert.equal(turnPeg(run, 0), 'la');
  for (const p of row) assert.equal(hold(p, run, .1).state, 'up');
  assert.equal(turnPeg(run, 0), 'do');
  // Each peg is beside its own row, on the walkway, never on a piece.
  maze.pegs.forEach((cell, r) => {
    assert.ok(walkable(cell.x, cell.z) && !mazeAt(cell));
    assert.ok(maze.pieces.filter(p => p.row === r).every(p => Math.abs(p.z - cell.z) < TILE));
  });
});

test('every maze can be crossed on foot, the pegged one only once its rows are tuned', () => {
  assert.ok(crossable(0));
  assert.ok(crossable(1));
  assert.ok(!crossable(2), 'as it comes, the pegged maze does not let them through');
  assert.ok(crossable(2, { tuning: inOrder(), broken: [] }));
  // The cracked pieces matter: with all of them gone there is no way through the second.
  assert.ok(!crossable(1, { tuning: [], broken: CUERDAS.mazes[1].pieces.filter(p => p.cracked).map(p => p.id) }));
});

test('every platform and the centre have room for their fight where it starts', () => {
  for (const [id, foes] of [['lealtad', ['lealtad', 'eco']], ['cristalino', ['cristalino']], ['directo', ['directo']]]) {
    const staged = stageFight(CUERDAS.grid, CUERDAS.platforms.find(p => p.id === id).centre, { allies: 2, cats: [1], foes });
    assert.equal(staged.pocket, false, id);
  }
  assert.equal(stageFight(CUERDAS.grid, CUERDAS.centre, { allies: 2, cats: [1], foes: ['voz'] }).pocket, false);
});
