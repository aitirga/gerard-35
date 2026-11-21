import test from 'node:test';
import assert from 'node:assert/strict';
import { CASTLE_FIGHTS, floorFor, roomAt } from '../src/castle.ts';
import { FLOOR_TIERS, INDOORS, createFloorStreet, pupilsGrid, roomGroups, roomTag, syncFloor } from '../src/castle-pupils.ts';
import { STREET, shows, stepStreet } from '../src/night-pupils.ts';
import { canWalk } from '../src/movement.ts';

/** A floor with its street and everyone on it; `light` is the party's light, kept on Gerard by `play`. */
function floorOf(phase, day = 3) {
  const floor = floorFor(7, day, phase), light = { ...floor.spawn }, street = createFloorStreet(floor, light), placed = new Set();
  syncFloor(street, roomGroups(floor), placed);
  return { floor, light, street, placed };
}
const prey = (position, pace = 'still', heading = { x: 0, z: 0 }) => ({ position, pace, heading, still: 0 });
/** Plays `seconds` with Gerard standing at `at`; returns every event. */
function play(f, at, seconds, pace = 'still') {
  const events = [];
  f.light.x = at.x; f.light.z = at.z;
  for (let t = 0; t < seconds && !events.some(e => e.type === 'caught'); t += .1) events.push(...stepStreet(f.street, .1, prey(at, pace)));
  return events;
}

test('every room\'s pupils are on the floor, a body each, on their own room\'s round', () => {
  for (const phase of [1, 2, 3]) {
    const { floor, street } = floorOf(phase), groups = roomGroups(floor);
    assert.equal(street.pupils.length, groups.reduce((sum, g) => sum + CASTLE_FIGHTS[g.encounter].length, 0));
    for (const p of street.pupils) {
      const room = roomAt(floor, { x: Math.round(p.position.x), z: Math.round(p.position.z) });
      assert.equal(room?.id, p.group, `${p.id} starts in its room`);
      assert.ok(p.patrol.every(c => canWalk(c, street.grid)), `${p.id}'s round is walkable`);
    }
    const twins = street.pupils.filter(p => p.kind === 'gemelo');
    assert.ok(twins.every(t => street.pupils.some(o => o.id === t.twin && o.group === t.group)), 'each Gemelo knows its twin, of its own room');
  }
});

test('the floors get harder, and nobody inside outruns Gerard running', () => {
  for (const key of ['walk', 'run']) assert.ok(FLOOR_TIERS[1][key] <= FLOOR_TIERS[2][key] && FLOOR_TIERS[2][key] <= FLOOR_TIERS[3][key], key);
  assert.ok(FLOOR_TIERS[3].run < 7.8 && INDOORS.mimicRun < 7.8);
  assert.ok(FLOOR_TIERS[1].sightDark === FLOOR_TIERS[1].sightLit, 'the first floor is in daylight');
  assert.ok(INDOORS.reveal < STREET.reveal && INDOORS.chargeLength < STREET.chargeLength, 'cut to rooms');
});

test('standing in a room, its pupils come and it is that room\'s fight; won, the room is gone from the floor', () => {
  const f = floorOf(1), group = roomGroups(f.floor).find(g => !CASTLE_FIGHTS[g.encounter].includes('delegada'));
  const room = f.floor.rooms.find(r => r.id === group.room);
  const events = play(f, room.cell, 30);
  const caught = events.find(e => e.type === 'caught');
  assert.ok(caught, 'someone reaches the party');
  assert.equal(roomTag(1, caught.pupil.group), `castillo-sala-1-${caught.pupil.group}`);
  // The story no longer lists the room: its pupils go, the others stay, and it is not put back.
  const before = f.street.pupils.length, gone = f.street.pupils.filter(p => p.group === caught.pupil.group).length;
  syncFloor(f.street, roomGroups(f.floor, [caught.pupil.group]), f.placed);
  assert.equal(f.street.pupils.length, before - gone);
  syncFloor(f.street, roomGroups(f.floor, [caught.pupil.group]), f.placed);
  assert.equal(f.street.pupils.length, before - gone);
});

test('La Delegada waits in her room until she has seen Gerard; then she never stops', () => {
  const f = floorOf(1), her = f.street.pupils.find(p => p.kind === 'delegada'), start = { ...her.position };
  assert.ok(her.waits);
  play(f, f.floor.spawn, 8);
  assert.deepEqual(her.position, start, 'far from her she stands where she is');
  assert.equal(f.street.marching, false, 'and nobody is held to the chase');
  // In her room, in her sight: she is roused, and from then on walks at him wherever he goes.
  const room = f.floor.rooms.find(r => r.id === her.group);
  const events = play(f, { x: room.cell.x, z: room.cell.z }, .3);
  assert.ok(events.some(e => e.type === 'order' && e.pupil === her));
  assert.equal(her.waits, false);
  const from = Math.hypot(her.position.x - f.floor.spawn.x, her.position.z - f.floor.spawn.z);
  f.street.pupils = [her];
  play(f, f.floor.spawn, 6);
  assert.ok(Math.hypot(her.position.x - f.floor.spawn.x, her.position.z - f.floor.spawn.z) < from - 3, 'she comes across the floor');
  assert.equal(f.street.marching, true);
});

test('El Ausente shows only inside the light the party carries, or once it comes', () => {
  const f = floorOf(2), absent = f.street.pupils.find(p => p.kind === 'ausente');
  assert.ok(absent, 'the second floor has one');
  f.light.x = f.floor.spawn.x; f.light.z = f.floor.spawn.z;
  assert.equal(shows(absent, f.street), false, 'far from the party it is not there');
  f.light.x = absent.position.x + 2; f.light.z = absent.position.z;
  assert.equal(shows(absent, f.street), true);
});

test('the staff room is safe: a wall to them, and nobody in it is caught', () => {
  for (const phase of [1, 2, 3]) {
    const f = floorOf(phase), staff = f.floor.rooms.find(r => r.kind === 'rest');
    if (!staff) continue;
    const grid = pupilsGrid(f.floor);
    assert.equal(canWalk(staff.cell, f.floor.grid), true);
    assert.equal(canWalk(staff.cell, grid), false);
    // Even with everyone told where Gerard is, nobody reaches him there.
    for (const p of f.street.pupils) { p.mode = 'chase'; p.waits = false; }
    const events = play(f, staff.cell, 20);
    assert.ok(!events.some(e => e.type === 'caught'), `floor ${phase}`);
  }
});
