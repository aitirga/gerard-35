import test from 'node:test';
import assert from 'node:assert/strict';
import { ENVIRONMENTS } from '../src/environments.ts';
import { PLACES_NURIA, SHIFT } from '../src/friends/nuria.ts';
import { calleCrop, closerHouse, cutsOff, reachable, shiftedGrid, sunkBy, toCalle } from '../src/street-shift.ts';

const street = ENVIRONMENTS.cardedeu, calle = ENVIRONMENTS['cardedeu-calle'];
const door = PLACES_NURIA.nuria.cell;
const all = new Set(SHIFT.closers.map(c => c.id));
const key = c => `${c.x},${c.z}`;

test('Nuria\'s street, shut and unrolled, leaves only the way on: no station, no side street, no corner', () => {
  const grid = shiftedGrid(street.grid, calle.grid, SHIFT, all, true);
  const open = reachable(grid, door);
  assert.ok(!open.has(key(street.spawn)), 'the station is out of reach');
  const { over } = SHIFT;
  for (const k of open) {
    const [x, z] = k.split(',').map(Number);
    const onBlock = x >= 49 && x <= 70 && z >= 57 && z <= 100;
    const inCalle = x >= over.x && x < over.x + over.w && z >= over.z && z < over.z + over.d;
    assert.ok(onBlock || inCalle, `${k} is neither her block nor La calle`);
  }
  // Straight on, up to past the row where they are in La calle itself.
  for (let z = door.z; z >= SHIFT.swap - 2; z--) assert.ok(open.has(`${toCalle({ x: 60, z }, SHIFT).x + SHIFT.calle.dx},${z}`) || open.has(`61,${z}`), `the way on is open at row ${z}`);
});

test('the closers rise in the order they are walked past, and none shuts Nuria\'s door off the way on', () => {
  const order = [...SHIFT.closers].sort((a, b) => b.at - a.at);
  const risen = new Set();
  for (const c of order) {
    risen.add(c.id);
    const grid = shiftedGrid(street.grid, calle.grid, SHIFT, risen, false);
    // Standing just north of its row, Gerard still reaches her door and the corner.
    const at = { x: 60, z: c.at - 1 }, open = reachable(grid, at);
    assert.ok(open.has(key(door)), `${c.id}: her door is still there`);
    assert.ok(open.has(key(PLACES_NURIA.corner.cell)), `${c.id}: the corner is still ahead`);
    assert.ok(!cutsOff(grid, at, [door, PLACES_NURIA.corner.cell]), `${c.id}: nobody walking with them is shut out`);
    // Each rises out of sight of nobody: in the street's open ground, not over her door.
    assert.ok(!(door.x >= c.x && door.x < c.x + c.w && door.z >= c.z && door.z < c.z + c.d), `${c.id} is not on her door`);
  }
  assert.ok(cutsOff(shiftedGrid(street.grid, calle.grid, SHIFT, all, true), { x: 60, z: 80 }, [street.spawn]), 'someone left at the station would be shut out: the street waits for them');
});

test('La calle laid over her street is La calle, cell for cell, and the swap lands on the same spot', () => {
  const grid = shiftedGrid(street.grid, calle.grid, SHIFT, all, true);
  const { over, calle: { dx, dz } } = SHIFT;
  for (let z = over.z; z < over.z + over.d; z++) for (let x = over.x; x < over.x + over.w; x++) {
    assert.equal(grid[z][x], calle.grid[z - dz]?.[x - dx] ?? '#', `${x},${z}`);
  }
  // Where they cross over: on La calle's street, ahead of its start, short of the bubble.
  const there = toCalle({ x: 60, z: SHIFT.swap }, SHIFT);
  assert.equal(calle.grid[there.z][there.x], '.');
  assert.ok(there.z < PLACES_NURIA.calleIn.cell.z && there.z > PLACES_NURIA.portal.cell.z);
  assert.ok(SHIFT.swap > over.z + 12, 'well inside, the map\'s edge still far ahead');
  assert.ok(SHIFT.unroll > over.z + over.d, 'it unrolls before they reach it');
});

test('the piece laid over: La calle\'s houses within it, its ground just there, and the closers in La calle\'s look', () => {
  const crop = calleCrop(calle.geo, SHIFT);
  const [x0, z0] = crop.extent[0], [x1, , ] = crop.extent[1], z1 = crop.extent[2][1];
  assert.ok(crop.buildings.length >= 8, 'a street of houses');
  for (const b of crop.buildings) for (const [x, z] of b.poly) assert.ok(x >= x0 - .01 && x <= x1 + .01 && z >= z0 - .01 && z <= z1 + .01, b.id);
  for (const r of crop.roads) for (const [, z] of r.line) assert.ok(z >= z0 - 1e-6 && z <= z1 + 1e-6);
  assert.deepEqual([crop.places, crop.anchors], [[], {}], 'its doors and names stay in La calle');
  const look = calle.geo.buildings.find(b => b.style.startsWith('nuria'));
  const house = closerHouse(SHIFT.closers[0], look, SHIFT, calle.geo.storey);
  assert.equal(house.number, '1', 'her house again, with a 1 on the door');
  assert.equal(house.poly[0][0] + SHIFT.calle.dx, SHIFT.closers[0].x - .5);
  // What stood where La calle unrolls sinks, and nothing of her own block does.
  const sunk = sunkBy(street.geo, SHIFT.over);
  assert.ok(sunk.length > 0);
  for (const id of sunk) {
    const b = street.geo.buildings.find(o => o.id === id);
    assert.ok(b.poly.every(([, z]) => z < 69), `${id} is not on Nuria's block`);
  }
});
