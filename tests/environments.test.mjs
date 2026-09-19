import assert from 'node:assert/strict';
import test from 'node:test';
import { ENVIRONMENTS, NEIGHBORHOOD, HOME, nearbyInteraction } from '../src/environments.ts';
import { GridMovement, canWalk } from '../src/movement.ts';

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
test('door interactions require adjacency, including no diagonal reach', () => {
  assert.equal(nearbyInteraction(NEIGHBORHOOD, { x:28,z:24 })?.id, 'enter-home');
  assert.equal(nearbyInteraction(NEIGHBORHOOD, { x:9,z:24 })?.id, 'call-bernat');
  assert.equal(nearbyInteraction(NEIGHBORHOOD, { x:9,z:23 }), undefined);
  assert.equal(nearbyInteraction(NEIGHBORHOOD, { x:16,z:24 }), undefined);
  assert.equal(nearbyInteraction(HOME, HOME.spawn)?.id, 'leave-home');
});
test('scene transitions preserve step count and reset interpolation', () => {
  const m = new GridMovement(NEIGHBORHOOD.grid, NEIGHBORHOOD.spawn);
  m.tryStep('right');
  for (let i = 0; i < 12; i++) m.update(1/60);
  assert.equal(m.steps, 1);
  m.tryStep('right');
  m.teleport(HOME.grid, HOME.spawn);
  assert.equal(m.moving, false);
  assert.equal(m.steps, 1);
  assert.deepEqual(m.position, HOME.spawn);
  m.teleport(NEIGHBORHOOD.grid, { x:28,z:24 });
  assert.deepEqual(m.position, { x:28,z:24 });
  assert.throws(() => m.teleport(HOME.grid, {x:0,z:0}), /walkable/);
});
test('cars and trees occupy the same collision cells as their visuals', () => {
  for (const prop of NEIGHBORHOOD.props) {
    assert.equal(canWalk(prop, NEIGHBORHOOD.grid), false);
    if (prop.kind === 'car') assert.equal(canWalk({ x:prop.x,z:prop.z+1 }, NEIGHBORHOOD.grid), false);
  }
});
