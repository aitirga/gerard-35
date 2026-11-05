import test from 'node:test';
import assert from 'node:assert/strict';
import { BODY, CAMERA, FOE_SIZE, POCKET, ROOM, axes, catSpots, fightCamera, fits, formation, placeCell, planPocket, pocketCellOf, pocketGrid, stageFight } from '../src/arena.ts';
import { ENVIRONMENTS, propCells } from '../src/environments.ts';
import { STREET_AREA, STREET_END_AREA } from '../src/encounters.ts';
import { PLACES_NURIA } from '../src/friends/nuria.ts';
import { canWalk } from '../src/movement.ts';
import { TOWER, inTower, onTop } from '../src/tower.ts';

const field = (w, d) => Array.from({ length: d }, () => '.'.repeat(w));
const walled = (w, d) => Array.from({ length: d }, (_, z) => z === 0 || z === d - 1 ? '#'.repeat(w) : `#${'.'.repeat(w - 2)}#`);
const dogs = n => Array(n).fill('dog');

test('the formation: party behind, foes ahead, side by side across with room, every other one a step back', () => {
  const open = formation('open', 2, 3);
  assert.deepEqual(open.allies.map(p => [+p.x.toFixed(2), +p.z.toFixed(2)]), [[-2.2, -.5], [-3.1, 1.7]]);
  assert.deepEqual(open.foes.map(p => [+p.x.toFixed(2), +p.z.toFixed(2)]), [[1.2, -2.75], [1.9, -.6], [1.2, 1.55]]);
  // A big foe stands back by its size, so it never looms over the party; the others keep their place.
  const big = formation('open', 2, ['vertigo']), dog = formation('open', 2, ['dog']), minion = formation('open', 2, ['minion']);
  assert.ok(big.foes[0].x - dog.foes[0].x > 1, 'Vertitrón stands well back');
  assert.deepEqual(minion.foes, dog.foes);
  // A giant on open ground is seen over the party's shoulders: the camera turns round towards their back (−x), as far away; along a street it stays.
  const turned = fightCamera('open', ['vertigo']);
  assert.ok(turned.x < 0 && turned.z > 0 && Math.abs(Math.hypot(turned.x, turned.z) - Math.hypot(CAMERA.open.x, CAMERA.open.z)) < 1e-9, JSON.stringify(turned));
  assert.deepEqual(fightCamera('open', ['dog', 'cebollon']), CAMERA.open);
  assert.deepEqual(fightCamera('z', ['vertigo']), CAMERA.z);
  // …and from there Gerard and Aitor still stand apart on screen, not one behind the other.
  const right = { x: turned.z, z: -turned.x }, across = big.allies.map(p => (p.x * right.x + p.z * right.z) / Math.hypot(turned.x, turned.z));
  assert.ok(Math.abs(across[0] - across[1]) > 1.5, `${across}`);
  assert.deepEqual(formation('open', 2, 3), formation('open', 2, [undefined, 'dog', 'dog']), 'a count is dogs');
  // Gerard and Aitor stand apart on screen too: the camera looks from the south, so a step back shows as a step aside.
  assert.ok(Math.hypot(open.allies[1].x - open.allies[0].x, open.allies[1].z - open.allies[0].z) > 2.3);
  // Along a street that runs z the party is at the near end (+z, the camera's) and the foes at the far one.
  const z = formation('z', 2, 1);
  assert.ok(z.allies.every(p => p.z > 2.8) && z.foes.every(p => p.z < -1.5));
  assert.ok(Math.abs(Math.abs(z.allies[0].x - z.allies[1].x) - 2.2) < 1e-9, 'side by side across a street');
  // The cats keep to the line: Haru a step towards the foes, Yuki a step back, whichever way it runs.
  for (const layout of ['open', 'x', 'z']) {
    const { ahead } = axes(layout), wearer = { x: 0, z: 0 }, cats = catSpots(layout, wearer);
    assert.ok(cats.haru.x * ahead.x + cats.haru.z * ahead.z > .7, `${layout}: Haru ahead`);
    assert.ok(cats.yuki.x * ahead.x + cats.yuki.z * ahead.z < -.5, `${layout}: Yuki behind`);
  }
});

test('on open ground a fight stands where it starts; a wall nearby moves it a few steps, never through the wall', () => {
  const cast = { allies: 2, foes: dogs(3), cats: [0] };
  assert.deepEqual(stageFight(field(21, 21), { x: 10, z: 10 }, cast), { pocket: false, layout: 'open', centre: { x: 10, z: 10 } });
  // A lamp post right where the party would stand: the fight shifts off it.
  const lamp = field(21, 21).map((row, z) => z === 11 ? row.slice(0, 7) + '#' + row.slice(8) : row);
  const moved = stageFight(lamp, { x: 10, z: 10 }, cast);
  assert.equal(moved.pocket, false);
  assert.notDeepEqual(moved.centre, { x: 10, z: 10 });
  assert.ok(Math.abs(moved.centre.x - 10) + Math.abs(moved.centre.z - 10) <= 4);
});

test('a street too narrow to line up across, or a closed room, sends the fight to a pocket; a wide street lines it up along it', () => {
  const cast = { allies: 2, foes: dogs(4) };
  // Five cells wide, as Uri's tower's corridors.
  const passage = walled(40, 7);
  assert.equal(stageFight(passage, { x: 20, z: 3 }, cast).pocket, true);
  assert.equal(stageFight(walled(7, 7), { x: 3, z: 3 }, cast).pocket, true, 'a small room');
  // Eight wide: four dogs do not fit side by side on open ground, but do along the street.
  const street = walled(40, 10);
  const along = stageFight(street, { x: 20, z: 4 }, cast);
  assert.equal(along.pocket, false);
  assert.equal(along.layout, 'x');
  assert.ok(fits(street, along.centre, 'x', cast));
});

test('where walls are tall enough to hide the fight, it keeps room to be seen over them, or goes to a pocket', () => {
  // A wall two cells in front of the party, between them and the camera (it looks from +z).
  const grid = field(30, 30).map((row, z) => z === 17 ? '#'.repeat(30) : row);
  const cast = { allies: 1, foes: dogs(1) };
  const low = stageFight(grid, { x: 15, z: 13 }, cast);
  assert.deepEqual(low, { pocket: false, layout: 'open', centre: { x: 15, z: 13 } }, 'a low wall hides nobody');
  const tall = stageFight(grid, { x: 15, z: 13 }, cast, 4);
  assert.equal(tall.pocket, false);
  assert.ok(tall.centre.z < 13, 'moved away from the tall wall, so the camera sees over it');
  assert.equal(CAMERA.open.z > 0, true);
});

test('every fight the story stages has room where it was meant to be, or goes to a pocket', () => {
  // The street dogs at either end of Passatge Maresme, two to four of them, with Gerard alone or with Bernat.
  for (const area of [STREET_AREA, STREET_END_AREA]) for (const n of [2, 3, 4]) for (const allies of [1, 2]) {
    const stage = stageFight(ENVIRONMENTS.maresme.grid, area.stage, { allies, foes: dogs(n) });
    assert.equal(stage.pocket, false, `${n} dogs at ${area.stage.x},${area.stage.z}`);
    assert.equal(stage.layout, 'open');
    assert.ok(Math.abs(stage.centre.x - area.stage.x) + Math.abs(stage.centre.z - area.stage.z) <= 2, 'where it was meant to be, or a step or two off it');
  }
  // The palace minion, Gerard with or without Bernat: off the candy on the floor, still in its room.
  for (const allies of [1, 2]) {
    const stage = stageFight(ENVIRONMENTS.palacio.grid, { x: 5, z: 15.5 }, { allies, foes: ['minion'] });
    assert.equal(stage.pocket, false);
    assert.equal(stage.layout, 'open');
  }
  // The guards: two wardrobes before the fountain have no room in the hall, so they fight in a pocket of the palace.
  assert.equal(stageFight(ENVIRONMENTS.palacio.grid, { x: 16, z: 17 }, { allies: 2, foes: ['guardian', 'guardian'] }).pocket, true);
  // Vertitrón on top of the tower: in the middle of the platform, where it stands, not at its edge behind the wall.
  const maze = ENVIRONMENTS['cardedeu-laberinto'];
  assert.deepEqual(PLACES_NURIA.summit.stage, TOWER.centre);
  const top = stageFight(maze.grid, PLACES_NURIA.summit.stage, { allies: 2, foes: ['vertigo'], cats: [0] }, maze.walls);
  assert.equal(top.pocket, false);
  assert.deepEqual(top.centre, TOWER.centre, `centre ${top.centre.x},${top.centre.z}`);
});

test('a fear that catches the party anywhere on the tower\'s ramp fights in a pocket', () => {
  const { grid, walls } = ENVIRONMENTS['cardedeu-laberinto'];
  assert.ok(walls > 2, 'the tower says its walls are tall');
  let cells = 0;
  for (let x = TOWER.centre.x - TOWER.walls[0]; x <= TOWER.centre.x + TOWER.walls[0]; x++) for (let z = TOWER.centre.z - TOWER.walls[0]; z <= TOWER.centre.z + TOWER.walls[0]; z++) {
    if (!inTower({ x, z }) || onTop({ x, z }) || !canWalk({ x, z }, grid)) continue;
    cells++;
    for (const foes of [['cebollon'], ['cebollita', 'platito', 'fantasmita']]) {
      assert.equal(stageFight(grid, { x, z }, { allies: 2, foes, cats: [0] }, walls).pocket, true, `${x},${z}`);
    }
  }
  assert.ok(cells > 300);
});

test('in place, everyone stands clear of walls with room to move, and every blow has a clear run', () => {
  const grid = ENVIRONMENTS.maresme.grid;
  const cast = { allies: 2, foes: dogs(4), cats: [0] };
  const stage = stageFight(grid, STREET_AREA.stage, cast);
  const slots = formation(stage.layout, 2, 4);
  const free = (p, r) => [0, 1, 2, 3, 4, 5, 6, 7].every(i => canWalk({ x: Math.round(p.x + Math.cos(i * Math.PI / 4) * r), z: Math.round(p.z + Math.sin(i * Math.PI / 4) * r) }, grid));
  for (const p of slots.allies) assert.ok(free({ x: stage.centre.x + p.x, z: stage.centre.z + p.z }, BODY.party + ROOM));
  for (const p of slots.foes) assert.ok(free({ x: stage.centre.x + p.x, z: stage.centre.z + p.z }, FOE_SIZE.dog + ROOM));
});

const things = env => new Set(ENVIRONMENTS[env].props.flatMap(propCells).map(c => `${c.x},${c.z}`));
const fightIn = (plan, cast) => fits(pocketGrid(plan.cells), plan.stage.centre, plan.stage.layout, { ...cast, spread: POCKET.spread });
/** How many floor cells across the pocket's ground runs through its centre, along x and along z. */
const widths = plan => {
  const { cells } = plan, c = { x: Math.round(plan.stage.centre.x), z: Math.round(plan.stage.centre.z) };
  const run = (dx, dz) => { let n = 1; for (const s of [1, -1]) for (let k = 1; cells[c.z + dz * k * s]?.[c.x + dx * k * s] === 'floor'; k++) n++; return n; };
  return { x: run(1, 0), z: run(0, 1) };
};

test('in a pocket the two sides stand further apart than in place', () => {
  const near = formation('open', 2, 2), far = formation('open', 2, 2, POCKET.spread);
  const gap = f => f.foes[0].x - f.allies[0].x;
  assert.ok(gap(far) > gap(near) * 1.4, `${gap(near)} → ${gap(far)}`);
});

test('a pocket of a corridor is the same corridor, wider; of a corner, the same corner; the fight fits it with room', () => {
  const { grid } = ENVIRONMENTS['cardedeu-laberinto'], props = things('cardedeu-laberinto');
  const cast = { allies: 2, foes: ['cebollita', 'platito', 'fantasmita'], cats: [0] };
  // An east–west stretch of the first ring (five cells between its walls): more rows, the same length.
  const ew = planPocket(grid, { x: 30, z: 4 }, cast, props);
  assert.ok(ew.rows >= POCKET.least && ew.columns === 0);
  assert.ok(widths(ew).z === 5 + ew.rows && widths(ew).x > 12, JSON.stringify(widths(ew)));
  assert.ok(fightIn(ew, cast));
  // Its long sides are still walls, the ends open onto the sky where the copy stops.
  const top = ew.cells.findIndex(row => row.includes('floor')) - 1;
  assert.ok(ew.cells[top].filter(c => c === 'wall').length > 12);
  // A north–south stretch: more columns.
  const ns = planPocket(grid, { x: 52, z: 30 }, cast, props);
  assert.ok(ns.columns >= POCKET.least && ns.rows === 0);
  assert.ok(fightIn(ns, cast));
  // A corner: wider both ways, still an L, with the tower's cypress pot where it stood.
  const corner = planPocket(grid, { x: 4, z: 4 }, cast, props);
  assert.ok(corner.rows >= POCKET.least && corner.columns >= POCKET.least);
  assert.ok(corner.cells.flat().includes('prop'));
  assert.ok(fightIn(corner, cast));
});

test('a pocket copies the place cell by cell: a widened row or column copies the one through where the fight started', () => {
  const { grid } = ENVIRONMENTS.palacio;
  const plan = planPocket(grid, { x: 16, z: 17 }, { allies: 2, foes: ['guardian', 'guardian'] }, things('palacio'));
  assert.ok(fightIn(plan, { allies: 2, foes: ['guardian', 'guardian'] }));
  plan.cells.forEach((row, z) => row.forEach((c, x) => {
    const from = placeCell(plan, { x, z });
    if (c === 'floor') assert.ok(grid[from.z][from.x] !== '#', `${x},${z} copies floor`);
    if (c === 'wall') assert.equal(grid[from.z]?.[from.x] ?? '#', '#', `${x},${z} copies a wall`);
  }));
  // The fountain is solid, not a hole onto the sky.
  const fountain = pocketCellOf(plan, { x: 16, z: 13 });
  assert.equal(plan.cells[fountain.z][fountain.x], 'wall');
  // Back and forth: a place cell outside the widened band lands where it copies from.
  for (const c of [{ x: 10, z: 10 }, { x: 20, z: 19 }]) assert.deepEqual(placeCell(plan, pocketCellOf(plan, c)), c);
});
