import test from 'node:test';
import assert from 'node:assert/strict';
import { WanderingPack } from '../src/encounters.ts';
import { NEIGHBORHOOD } from '../src/environments.ts';
import { canWalk } from '../src/movement.ts';
const key = c => `${c.x},${c.z}`;
function seeded(seed) { return () => ((seed = (1664525 * seed + 1013904223) >>> 0) / 2 ** 32); }

test('random packs cover 2–4 dogs and remain on free street cells over 120 seeded walks', () => {
  const sizes = new Set();
  for (let seed = 1; seed <= 120; seed++) {
    const pack = new WanderingPack(NEIGHBORHOOD.grid, seeded(seed * 7919));
    sizes.add(pack.dogs.length);
    const start = pack.dogs.map(d => key(d.cell)).join('|');
    let moved = false;
    const player = [{ x: 17, z: 24 }, { x: 17, z: 23 }];
    for (let frame = 0; frame < 1200; frame++) {
      pack.update(1 / 30, player);
      const reserved = pack.occupied.map(key);
      assert.equal(new Set(reserved).size, reserved.length, `overlap at seed ${seed}`);
      assert.ok(pack.occupied.every(c => canWalk(c, NEIGHBORHOOD.grid)));
      assert.ok(player.every(c => !reserved.includes(key(c))));
      moved ||= pack.dogs.map(d => key(d.cell)).join('|') !== start;
      for (const dog of pack.dogs) {
        const p = pack.position(dog);
        assert.ok(Number.isFinite(p.x) && Number.isFinite(p.z));
        assert.ok(Math.abs(p.x - dog.cell.x) + Math.abs(p.z - dog.cell.z) <= 1);
      }
    }
    assert.ok(moved);
  }
  assert.deepEqual([...sizes].sort(), [2, 3, 4]);
});

test('escape/defeat grants a cooldown and automatic contact requires separation', () => {
  const pack = new WanderingPack(NEIGHBORHOOD.grid, () => 0);
  pack.finish(false);
  assert.equal(pack.ready, false); assert.equal(pack.armed, false);
  for (let i = 0; i < 130; i++) {
    pack.dogs.forEach(d => { d.wait = 10; });
    pack.update(.05, [{ x: 19, z: 24 }]);
  }
  assert.equal(pack.ready, true); assert.equal(pack.armed, false);
  pack.update(.05, [{ x: 25, z: 24 }]);
  assert.equal(pack.armed, true);
});

test('victory removes the pack; respawn waits until spawn area is clear', () => {
  const pack = new WanderingPack(NEIGHBORHOOD.grid, seeded(42));
  pack.finish(true);
  assert.equal(pack.dogs.length, 0); assert.equal(pack.ready, false);
  for (let i = 0; i < 300; i++) pack.update(.05, [{ x: 18, z: 24 }]);
  assert.equal(pack.dogs.length, 0);
  pack.update(.05, [{ x: 28, z: 24 }]);
  assert.ok(pack.dogs.length >= 2 && pack.dogs.length <= 4);
  assert.equal(pack.ready, true);
});

test('the chapter 1 pack spawns and wanders around the scarecrow, below Bernat’s leash', async () => {
  const { SCARECROW_AREA } = await import('../src/encounters.ts');
  const { PLACES, LEASH } = await import('../src/chapter-1.ts');
  for (const cell of SCARECROW_AREA.spawns) assert.ok(canWalk(cell, NEIGHBORHOOD.grid), key(cell));
  assert.ok(SCARECROW_AREA.min.z > PLACES.southRow - 1.2 + LEASH, 'Gerard cannot walk into the pack while Bernat stalls');
  const pack = new WanderingPack(NEIGHBORHOOD.grid, seeded(35), SCARECROW_AREA);
  for (let frame = 0; frame < 900; frame++) pack.update(1 / 30, [{ x: 15, z: 30 }]);
  for (const dog of pack.dogs) {
    assert.ok(dog.cell.x >= SCARECROW_AREA.min.x && dog.cell.x <= SCARECROW_AREA.max.x && dog.cell.z >= SCARECROW_AREA.min.z && dog.cell.z <= SCARECROW_AREA.max.z);
  }
});
