import test from 'node:test';
import assert from 'node:assert/strict';
import { NIGHT_TIERS, PORTAL_SAFE, RISE_CLEAR, hiddenAt, hunterSpec, huntersGrid, isLit, litLamps, nightTier, risingAt, sightOf, sizeUp } from '../src/night.ts';
import { ENVIRONMENTS } from '../src/environments.ts';
import { canWalk } from '../src/movement.ts';
import { createChaser, updateChaser } from '../src/chasers.ts';

const street = ENVIRONMENTS['meridiana-calle'];
const portal = street.interactions.find(i => i.id === 'meridiana-portal').cell;
const station = street.interactions.find(i => i.id === 'station-fabra-i-puig').cell;
const grates = street.props.filter(p => p.kind === 'grate').map(p => ({ x: p.x, z: p.z }));
const lamps = street.props.filter(p => p.kind === 'lamp').map(p => ({ x: p.x, z: p.z }));

test('the station is far from home: the way home is a real walk', () => {
  assert.ok(Math.hypot(station.x - portal.x, station.z - portal.z) > 70, `${station.x},${station.z} to ${portal.x},${portal.z}`);
  assert.ok(canWalk(portal, street.grid) && canWalk(station, street.grid));
});

test('the tiers get harder as her power spreads, never easier', () => {
  for (const key of ['hunters', 'run', 'sightLit']) {
    const values = NIGHT_TIERS.map(t => t[key]);
    assert.ok(values.every((v, i) => i === 0 || v >= values[i - 1]), key);
  }
  assert.equal(nightTier(0), NIGHT_TIERS[0]);
  assert.equal(nightTier(1), NIGHT_TIERS[0], 'the first days are calm');
  assert.equal(nightTier(4), NIGHT_TIERS[3]);
  assert.ok(NIGHT_TIERS[0].run < 5.2, 'at first they are slower than Gerard walking');
  assert.ok(NIGHT_TIERS.at(-1).run < 7.8, 'and never faster than him running');
});

test('light gives Gerard away, the dark hides him, still behind cover he is out of sight', () => {
  const tier = NIGHT_TIERS[1], lamp = lamps[0];
  assert.ok(isLit(lamp, lamps));
  assert.ok(sightOf(tier, true, false) > sightOf(tier, false, true));
  assert.ok(sightOf(tier, false, true) > sightOf(tier, false, false), 'once after him, they keep him in view a little longer');
  const hide = { x: 10, z: 10 };
  assert.equal(hiddenAt({ x: 10.5, z: 10 }, true, false, [hide], portal), true);
  assert.equal(hiddenAt({ x: 10.5, z: 10 }, false, false, [hide], portal), false, 'moving gives him away');
  assert.equal(hiddenAt({ x: 10.5, z: 10 }, true, true, [hide], portal), false, 'not under a lamp');
  assert.equal(hiddenAt(portal, false, true, [], portal), true, "the portal's light keeps them off");
});

test("the portal's light is a wall to them", () => {
  const grid = huntersGrid(street.grid, portal);
  assert.equal(canWalk(portal, grid), false);
  assert.ok(canWalk({ x: portal.x + Math.ceil(PORTAL_SAFE) + 1, z: portal.z + 1 }, grid));
  const tier = NIGHT_TIERS[3];
  const guard = createChaser(hunterSpec(1, { x: portal.x + 6, z: portal.z + 2 }, grid, tier));
  for (let i = 0; i < 400; i++) updateChaser(guard, .05, portal, grid, true);
  assert.ok(Math.hypot(guard.position.x - portal.x, guard.position.z - portal.z) > PORTAL_SAFE - .5, 'it never reaches him there');
});

test('they come up out of the grates, never in the party’s face', () => {
  assert.ok(grates.length >= 5, 'the median and the plaza have grates');
  const at = risingAt(grates, station, 4);
  assert.equal(at.length, 4);
  for (const g of at) assert.ok(Math.hypot(g.x - station.x, g.z - station.z) >= RISE_CLEAR);
  const spec = hunterSpec(3, at[0], street.grid, NIGHT_TIERS[0]);
  assert.equal(spec.id, 'night-3');
  assert.ok(spec.patrol.every(c => canWalk(c, street.grid) || (c.x === Math.round(at[0].x) && c.z === Math.round(at[0].z))));
});

test('on the last night her pink puts some lamps out; Aitor sizes them up by the ánimas', () => {
  assert.equal(litLamps(lamps, NIGHT_TIERS[0]).length, lamps.length);
  assert.ok(litLamps(lamps, NIGHT_TIERS[3]).length < lamps.length);
  assert.notEqual(sizeUp(0), sizeUp(2));
});

test('the picker\'s castle stage picks the first day at it, ánimas pushing it later', async () => {
  const { dayForStage, spread, stage } = await import('../src/days.ts');
  for (const animas of [0, 1, 2]) {
    for (let castle = 0; castle <= 4; castle++) {
      const day = dayForStage(castle, animas);
      assert.equal(stage(spread(day, animas)), castle, `castle ${castle}, ${animas} ánimas: day ${day}`);
      assert.ok(spread(day, animas) < 1, 'never the doomed morning');
      if (day > 1) assert.ok(stage(spread(day - 1, animas)) < castle, 'the first such day');
    }
  }
  assert.deepEqual([0, 1, 2, 3, 4].map(c => dayForStage(c, 0)), [1, 3, 4, 5, 6]);
  assert.deepEqual([0, 1, 2, 3, 4].map(c => nightTier(c).id), ['calma', 'calma', 'tensa', 'dura', 'ultima']);
});
