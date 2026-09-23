import assert from 'node:assert/strict';
import test from 'node:test';
import { ENVIRONMENTS, NEIGHBORHOOD, HOME_ENTRANCE, HOME_FLOOR_1, HOME_FLOOR_2, PLAN_GLYPHS, PROP_FOOTPRINTS, blockProps, nearbyInteraction, planGrid, propCells } from '../src/environments.ts';
import { FreeMovement, canWalk } from '../src/movement.ts';

function reachable(environment) {
  const visited = new Set();
  const queue = [environment.spawn];
  while (queue.length) {
    const c = queue.shift(), id = `${c.x},${c.z}`;
    if (!canWalk(c, environment.grid) || visited.has(id)) continue;
    visited.add(id);
    queue.push({ x:c.x+1,z:c.z }, { x:c.x-1,z:c.z }, { x:c.x,z:c.z+1 }, { x:c.x,z:c.z-1 });
  }
  return visited;
}
for (const environment of Object.values(ENVIRONMENTS)) {
  test(`${environment.id}: rectangular map, valid spawn and all paths reachable`, () => {
    const width = environment.grid[0].length;
    assert.ok(environment.grid.every(row => row.length === width));
    assert.equal(canWalk(environment.spawn, environment.grid), true);
    const cells = reachable(environment);
    assert.equal(cells.size, [...environment.grid.join('')].filter(c => c !== '#').length);
    for (const interaction of environment.interactions) {
      assert.ok(cells.has(`${interaction.cell.x},${interaction.cell.z}`), interaction.id);
    }
  });
}
test('Gerard is number 20, Bernat is opposite and every building footprint is solid', () => {
  const gerard = NEIGHBORHOOD.houses.find(h => h.id === 'gerard');
  const bernat = NEIGHBORHOOD.houses.find(h => h.id === 'bernat');
  assert.equal(gerard.number, 20);
  assert.equal(gerard.z, bernat.z);
  assert.notEqual(gerard.side, bernat.side);
  for (const house of NEIGHBORHOOD.houses) {
    for (let z = house.z; z < house.z + house.d; z++) {
      for (let x = house.x; x < house.x + house.w; x++) assert.equal(canWalk({x,z}, NEIGHBORHOOD.grid), false);
    }
  }
});
test('door interactions need to be close, but a diagonal tile is out of reach', () => {
  assert.equal(nearbyInteraction(NEIGHBORHOOD, { x:21,z:23 })?.id, 'enter-home');
  assert.equal(nearbyInteraction(NEIGHBORHOOD, { x:9,z:24 })?.id, 'call-bernat');
  assert.equal(nearbyInteraction(NEIGHBORHOOD, { x:9,z:23 }), undefined);
  assert.equal(nearbyInteraction(NEIGHBORHOOD, { x:16,z:24 }), undefined);
  assert.equal(nearbyInteraction(HOME_ENTRANCE, HOME_ENTRANCE.spawn)?.id, 'leave-home');
});
test('scene transitions preserve step count and land on the destination tile', () => {
  const m = new FreeMovement(NEIGHBORHOOD.grid, NEIGHBORHOOD.spawn);
  for (let i = 0; i < 30 && m.steps === 0; i++) m.drive(1, 0, 1/60);
  assert.equal(m.steps, 1);
  m.drive(1, 0, 1/60);
  m.teleport(HOME_ENTRANCE.grid, HOME_ENTRANCE.spawn);
  assert.equal(m.steps, 1);
  assert.deepEqual(m.position, HOME_ENTRANCE.spawn);
  m.teleport(NEIGHBORHOOD.grid, { x:21,z:23 });
  assert.deepEqual(m.position, { x:21,z:23 });
  assert.throws(() => m.teleport(HOME_ENTRANCE.grid, {x:0,z:0}), /walkable/);
});
for (const environment of Object.values(ENVIRONMENTS)) {
  test(`${environment.id}: every prop blocks exactly its footprint, clear of spawn and doors`, () => {
    const keep = [environment.spawn, ...environment.interactions.map(i => i.cell)];
    for (const prop of environment.props) {
      assert.ok(prop.kind in PROP_FOOTPRINTS, prop.kind);
      for (const cell of propCells(prop)) {
        assert.equal(canWalk(cell, environment.grid), false, `${prop.kind} at ${cell.x},${cell.z}`);
        assert.ok(!keep.some(k => k.x === cell.x && k.z === cell.z), `${prop.kind} covers a spawn or door`);
      }
    }
  });
}
test('cars span two cells, flat props stay walkable and props are reusable in hand-drawn maps', () => {
  const car = NEIGHBORHOOD.props.find(p => p.kind === 'car');
  assert.deepEqual(propCells(car), [{ x:car.x,z:car.z }, { x:car.x,z:car.z+1 }]);
  const manholes = NEIGHBORHOOD.props.filter(p => p.kind === 'manhole');
  assert.ok(manholes.length > 0);
  for (const manhole of manholes) assert.equal(canWalk(manhole, NEIGHBORHOOD.grid), true);
  assert.ok(NEIGHBORHOOD.props.some(p => p.kind === 'lamp'));
  // Every environment uses the shared props, including the interior and the courtyard.
  for (const environment of Object.values(ENVIRONMENTS)) assert.ok(environment.props.some(p => p.kind === 'tree'), environment.id);
  assert.deepEqual(blockProps(['...', '...'], [{ kind:'tree', x:1, z:0 }]), ['.#.', '...']);
  assert.throws(() => blockProps(['..'], [{ kind:'car', x:0, z:0 }]), /outside/);
});

const HOUSE = [HOME_ENTRANCE, HOME_FLOOR_1, HOME_FLOOR_2];
test('the house plans only use known glyphs and their grids block everything but floor, doorways and steps', () => {
  for (const floor of HOUSE) {
    for (const glyph of floor.plan.join('')) assert.ok(glyph in PLAN_GLYPHS, `${floor.id}: ${JSON.stringify(glyph)}`);
    assert.deepEqual(blockProps(planGrid(floor.plan), floor.props), floor.grid);
    floor.plan.forEach((row, z) => [...row].forEach((glyph, x) => {
      assert.equal(canWalk({ x, z }, planGrid(floor.plan)), '.+^'.includes(glyph), `${floor.id} ${x},${z}`);
    }));
  }
});
test('every door and stair lands on a walkable cell, and there is always a way back', () => {
  for (const environment of Object.values(ENVIRONMENTS)) {
    for (const { id, to } of environment.interactions) {
      if (!to) continue;
      const destination = ENVIRONMENTS[to.environment];
      assert.equal(canWalk(to.cell, destination.grid), true, `${environment.id}/${id}`);
      assert.ok(destination.interactions.some(i => i.to?.environment === environment.id), `${to.environment} leads back to ${environment.id}`);
    }
  }
  assert.equal(nearbyInteraction(NEIGHBORHOOD, { x:21,z:23 })?.to?.environment, 'home-entrance');
  assert.equal(nearbyInteraction(HOME_FLOOR_1, { x:10,z:1 })?.to?.environment, 'home-floor-2');
  assert.equal(nearbyInteraction(HOME_FLOOR_2, { x:11,z:5 })?.to?.environment, 'home-floor-1');
});
test("Gerard's room: four shelf bays to look at, each with something to say", () => {
  const shelves = HOME_FLOOR_2.interactions.filter(i => i.id.startsWith('shelf-'));
  assert.deepEqual(shelves.map(i => i.id), ['shelf-egypt', 'shelf-minerals', 'shelf-magic', 'shelf-more']);
  for (const shelf of shelves) {
    assert.ok(shelf.lines.length > 0 && !shelf.to);
    assert.equal(HOME_FLOOR_2.plan[shelf.cell.z - 1][shelf.cell.x], 'o', 'the bay is right behind the spot');
  }
  const room = HOME_FLOOR_2.rooms.find(r => r.name === 'Habitación de Gerard');
  assert.ok(shelves.every(s => s.cell.x >= room.x && s.cell.x < room.x + room.w && s.cell.z >= room.z && s.cell.z < room.z + room.d));
});
test('stairs switch floors by walking onto them, and never land Gerard back on a step', () => {
  const inside = (r, c) => c.x >= r.x && c.x < r.x + r.w && c.z >= r.z && c.z < r.z + r.d;
  for (const floor of [HOME_FLOOR_1, HOME_FLOOR_2]) {
    const stairs = floor.interactions.filter(i => i.step);
    assert.equal(stairs.length, 1, floor.id);
    for (const { step, to } of stairs) {
      for (let z = step.z; z < step.z + step.d; z++) for (let x = step.x; x < step.x + step.w; x++) assert.equal(canWalk({ x, z }, floor.grid), true);
      for (const back of ENVIRONMENTS[to.environment].interactions.filter(i => i.step)) assert.equal(inside(back.step, to.cell), false);
    }
  }
});
