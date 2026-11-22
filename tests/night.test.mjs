import test from 'node:test';
import assert from 'node:assert/strict';
import { CLIMB, FIRST_CLEAR, NIGHT_TIERS, PORTAL_SAFE, RISE_CLEAR, avenueRows, hiddenAt, huntersGrid, isLit, litLamps, nightTier, risingAt, roundAbout, sightOf, sizeUp } from '../src/night.ts';
import { STREET, carriageway, coverOf, createStreet, groupsOut, postGroups, removeGroup, restGroup, riseGroup, shows, stepStreet } from '../src/night-pupils.ts';
import { ENVIRONMENTS } from '../src/environments.ts';
import { canWalk } from '../src/movement.ts';

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
  const night = createStreet({ tier: NIGHT_TIERS[3], phase: 1, grid, lamps: [], covers: [], portal });
  const pupils = riseGroup(night, { x: portal.x + 8, z: portal.z + 2 });
  for (let i = 0; i < 600; i++) stepStreet(night, .05, { position: portal, pace: 'run', heading: { x: 0, z: 0 }, still: 0 });
  for (const p of pupils) assert.ok(Math.hypot(p.position.x - portal.x, p.position.z - portal.z) > PORTAL_SAFE - .5, `${p.kind} never reaches him there`);
});

test('they come up out of the grates, never in the party’s face', () => {
  assert.ok(grates.length >= 5, 'the median and the plaza have grates');
  const at = risingAt(grates, station, 4);
  assert.equal(at.length, 4);
  for (const g of at) assert.ok(Math.hypot(g.x - station.x, g.z - station.z) >= RISE_CLEAR);
  // Their rounds keep off the carriageways: no pupil is run over just walking its round.
  const road = carriageway(street.geo.roads);
  assert.ok(road({ x: 136, z: 52 }) && road({ x: 136, z: 64 }), 'both carriageways are road');
  assert.ok(!road({ x: 136, z: 58 }) && !road(portal), 'the median and the pavement are not');
  for (const grate of grates.filter(g => !road(g))) {
    const loop = roundAbout(grate, street.grid, 4, cell => !road(cell));
    assert.ok(loop.slice(1).every(c => canWalk(c, street.grid) && !road(c)), `round at ${grate.x},${grate.z}`);
  }
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

test('at night the castle pupils of the floor the party is on walk the Meridiana, stronger out there the fewer friends and levels', async () => {
  const { nightMight, NIGHT_PUPILS } = await import('../src/night.ts');
  const { nightGroup, castlePhase, CASTLE_FIGHTS } = await import('../src/castle.ts');
  const { createEncounter } = await import('../src/battle.ts');
  const floor = castlePhase(1);
  assert.deepEqual([1, 2, 3, 4, 5].map(n => nightGroup(n, 1)), [...floor.fights, floor.elite, floor.fights[0]], 'its rooms in turn, La Delegada last');
  assert.ok(nightGroup(1, 2).endsWith('-2a') && nightGroup(1, 3).endsWith('-3a'), 'a floor further on, its own pupils');
  assert.equal(nightMight(0), NIGHT_PUPILS.start);
  assert.ok(nightMight(1, { papagato: 2 }) < nightMight(1) && nightMight(1) < nightMight(0), 'each friend and each level takes some off');
  assert.equal(nightMight(9, { papagato: 9, matemagico: 9 }), NIGHT_PUPILS.floor, 'never weaker than inside');
  const party = [{ id: 'gerard', name: 'Gerard', profile: 'gerard35', classId: 'matemagico' }, { id: 'aitor', name: 'Aitor', profile: 'aitor', classId: 'papagato' }];
  const inside = createEncounter(party, 'alumnos-1a'), out = createEncounter(party, 'night-guard', { night: { room: 'alumnos-1a', might: 2 } });
  assert.equal(out.encounter, 'night-guard', 'still the night: lost, they wake late; won, the hunt goes on');
  assert.deepEqual(out.foes.map(f => f.kind), [...CASTLE_FIGHTS['alumnos-1a']]);
  assert.deepEqual(out.foes.map(f => f.maxHp), inside.foes.map(f => f.maxHp * 2));
});

// ——— How each pupil hunts (src/night-pupils.ts) ———————————————————————————————————————————
const OPEN = Array.from({ length: 60 }, () => '.'.repeat(120));
const FAR = { x: 110, z: 55 };
/** An open street in the dark, with one group of `phase`'s `n`th room risen at `at`, already on its feet. */
function nightWith(n, phase, at, extra = {}) {
  const night = createStreet({ tier: NIGHT_TIERS[1], phase, grid: OPEN, lamps: [], covers: [], portal: FAR, ...extra });
  night.groups = n - 1;
  const pupils = riseGroup(night, at);
  stepStreet(night, .05, prey({ x: 5, z: 5 }));
  for (let t = 0; t < CLIMB + 2; t += .25) stepStreet(night, .25, prey({ x: 5, z: 55 }));
  return { night, pupils, of: kind => pupils.filter(p => p.kind === kind) };
}
const prey = (position, pace = 'still', heading = { x: 0, z: 0 }, still = pace === 'still' ? 9 : 0) => ({ position, pace, heading, still });
/** Runs the street for `seconds` with Gerard as `who(t)` says, and returns every event. */
function play(night, seconds, who, cars = () => []) {
  const events = [];
  for (let t = 0; t < seconds && !events.some(e => e.type === 'caught'); t += .05) events.push(...stepStreet(night, .05, who(t), cars(t)));
  return events;
}
const far = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

test('each pupil is a body of its own, in the group of the room it fights in', async () => {
  const { CASTLE_FIGHTS, nightGroup } = await import('../src/castle.ts');
  const night = createStreet({ tier: NIGHT_TIERS[0], phase: 1, grid: OPEN, lamps: [], covers: [], portal: FAR });
  const first = riseGroup(night, { x: 30, z: 30 }), second = riseGroup(night, { x: 60, z: 30 });
  assert.deepEqual(first.map(p => p.kind), [...CASTLE_FIGHTS[nightGroup(1, 1)]]);
  assert.deepEqual(second.map(p => p.kind), [...CASTLE_FIGHTS[nightGroup(2, 1)]]);
  assert.ok(first.every(p => p.id.startsWith('night-1-') && p.mode === 'rising'), 'climbing out, they see nothing yet');
  for (let i = 0; i < 9; i++) riseGroup(night, { x: 30, z: 30 });
  assert.equal(new Set(night.pupils.map(p => p.group)).size, NIGHT_TIERS[0].hunters * 2, 'never more than twice the first count out');
  removeGroup(night, 1);
  assert.ok(!night.pupils.some(p => p.group === 1), 'a group beaten is gone');
  restGroup(night, 2);
  assert.ok(night.pupils.filter(p => p.group === 2).every(p => p.mode === 'resting'));
});

test('a run is heard from far off in the dark; a walk is not', () => {
  const walking = nightWith(3, 1, { x: 30, z: 30 }), running = nightWith(3, 1, { x: 30, z: 30 });
  const beside = { x: 30 + STREET.hear - 3, z: 30 };
  const quiet = play(walking.night, 2, () => prey(beside, 'walk', { x: 1, z: 0 }));
  assert.ok(!quiet.some(e => e.type === 'heard' || e.type === 'alert'), 'walking past in the dark, nobody turns');
  const loud = play(running.night, 2, () => prey(beside, 'run', { x: 1, z: 0 }));
  assert.ok(loud.some(e => e.type === 'heard'), 'running, they come to look');
  assert.ok(running.pupils.some(p => p.mode === 'search' || p.mode === 'chase'));
});

test('they doubt before they run, and having lost him they look where he was', () => {
  const { night, pupils } = nightWith(3, 1, { x: 30, z: 30 }, { lamps: [{ x: 36, z: 30 }] });
  const lit = { x: 36, z: 30 };
  const first = play(night, STREET.hesitate * .6, () => prey(lit));
  assert.ok(first.some(e => e.type === 'alert') && !first.some(e => e.type === 'spotted'), 'a moment of doubt first');
  // Out of sight before the doubt is over: it never becomes a chase.
  const gone = play(night, 3, () => prey({ x: 100, z: 5 }));
  assert.ok(!gone.some(e => e.type === 'spotted'));
  assert.ok(pupils.some(p => p.mode === 'search' && far(p.known, lit) < 1), 'they go and look where they saw him');
  const after = play(night, 30, () => prey({ x: 100, z: 5 }));
  assert.ok(after.some(e => e.type === 'lost') && pupils.every(p => p.mode === 'patrol' || p.mode === 'return'), 'and then back to their round');
  // Standing in the light, the doubt ends in a chase.
  const stay = play(night, 6, () => prey(lit));
  assert.ok(stay.some(e => e.type === 'spotted'));
});

test('El Repetidor tells its charge, runs straight, and crashes into what stands in its way', () => {
  const walls = OPEN.map(row => row.slice(0, 40) + '#' + row.slice(41));
  const { night, of } = nightWith(1, 1, { x: 30, z: 30 }, { grid: walls, lamps: [{ x: 37, z: 30 }] });
  const big = of('repetidor')[0], chivata = of('chivata')[0];
  chivata.mode = 'flat'; chivata.timer = 999;
  big.position = { x: 30, z: 30 }; big.mode = 'patrol';
  const spot = { x: 37, z: 30 };
  let events = play(night, 6, () => prey(spot), undefined);
  assert.ok(events.some(e => e.type === 'windup'), 'it plants itself and tells');
  assert.ok(events.some(e => e.type === 'caught' && e.pupil === big), 'standing in its line, the charge lands');
  // Again, stepping aside while it winds up: it runs past and into the wall.
  big.position = { x: 30, z: 30 }; big.mode = 'chase'; big.timer = 0; big.seeing = true;
  events = [];
  let side = { ...spot };
  for (let t = 0; t < 8 && !events.some(e => e.type === 'crash' || e.type === 'caught'); t += .05) {
    // He steps aside once it no longer turns.
    const dodging = big.mode === 'charge' || (big.mode === 'windup' && big.timer <= STREET.lock);
    if (dodging) side = { x: spot.x, z: Math.min(40, side.z + 7.8 * .05) };
    events.push(...stepStreet(night, .05, prey(side, dodging ? 'run' : 'still', { x: 0, z: 1 })));
  }
  assert.ok(events.some(e => e.type === 'charge'));
  assert.ok(events.some(e => e.type === 'crash') && !events.some(e => e.type === 'caught'), 'out of its line, it crashes');
  assert.equal(big.mode, 'stunned');
  assert.ok(big.timer > STREET.spent, 'and stays stunned a good while');
});

test('La Chivata never runs at him: she points, and everyone knows where he is', () => {
  const { night, of } = nightWith(1, 1, { x: 30, z: 30 }, { lamps: [{ x: 40, z: 30 }] });
  const chivata = of('chivata')[0], big = of('repetidor')[0];
  // The big one far away in the dark, with no sight of his own.
  big.position = { x: 60, z: 30 }; big.patrol = [{ x: 60, z: 30 }]; big.next = 0; big.mode = 'patrol';
  chivata.position = { x: 31, z: 30 }; chivata.mode = 'patrol';
  const lit = { x: 40, z: 30 };
  const events = play(night, 4, () => prey(lit));
  assert.ok(events.some(e => e.type === 'point' && e.pupil === chivata));
  assert.equal(chivata.mode, 'point');
  assert.ok(night.pointed, 'while she sees him');
  assert.ok(events.some(e => (e.type === 'alert' || e.type === 'spotted') && e.pupil === big), 'the others have him too, from where they could not see');
  assert.ok(far(chivata.position, lit) >= STREET.keep - 1.5, 'and she keeps her distance');
  // Out of her sight (into the dark, far), she loses him and the pointing stops.
  play(night, STREET.lose + .5, () => prey({ x: 40, z: 5 }));
  assert.ok(!night.pointed);
});

test('El Empollón learns the cover that hid Gerard from it, and only the last one', () => {
  const covers = [{ x: 40, z: 31, kind: 'containers' }, { x: 40, z: 20, kind: 'shelter' }];
  const { night, of } = nightWith(2, 1, { x: 30, z: 30 }, { covers });
  const empollon = of('empollon')[0], chivata = of('chivata')[0];
  chivata.mode = 'flat'; chivata.timer = 999;
  const behind = { x: 40, z: 30 }, hidden = () => prey(behind, 'still');
  assert.equal(coverOf(night, prey(behind))?.kind, 'containers');
  assert.equal(coverOf(night, prey(behind, 'walk')), undefined, 'moving, nothing hides him');
  // It comes to a noise, finds nothing, and learns the containers.
  empollon.position = { x: 34, z: 30 }; empollon.mode = 'search'; empollon.known = { x: 39, z: 29 }; empollon.look = STREET.search;
  let events = play(night, 12, hidden);
  assert.ok(events.some(e => e.type === 'learned') && !events.some(e => e.type === 'caught'), 'the first time the containers hide him');
  assert.equal(night.learned, 'containers');
  // He has to leave it some time; the second time behind containers, it walks straight to him.
  play(night, 1, () => prey({ x: 70, z: 50 }, 'walk', { x: 1, z: 0 }));
  empollon.position = { x: 34, z: 30 }; empollon.mode = 'search'; empollon.known = { x: 39, z: 29 }; empollon.look = STREET.search;
  events = play(night, 12, hidden);
  assert.ok(events.some(e => e.type === 'caught' && e.pupil === empollon), 'the same cover twice does not work');
  // Another kind of cover still does, and then that is the one it knows.
  const shelter = { x: 40, z: 21 };
  empollon.position = { x: 34, z: 21 }; empollon.mode = 'search'; empollon.known = { x: 39, z: 22 }; empollon.look = STREET.search; empollon.checked = true;
  events = play(night, 12, () => prey(shelter, 'still'));
  assert.ok(!events.some(e => e.type === 'caught'));
  assert.equal(night.learned, 'shelter');
});

test('Los Gemelos hunt as two: one behind, the other round to cut the way ahead', () => {
  const { night, of } = nightWith(3, 1, { x: 30, z: 30 }, { lamps: Array.from({ length: 12 }, (_, i) => ({ x: 30 + i * 6, z: 30 })) });
  const [a, b] = of('gemelo');
  assert.equal(a.twin, b.id); assert.equal(b.twin, a.id);
  a.position = { x: 30, z: 30 }; b.position = { x: 27, z: 33 };
  for (const p of [a, b]) { p.mode = 'chase'; p.timer = 0; p.seeing = true; }
  // Gerard walks away along the street, slower than they run.
  const events = play(night, 3, t => prey({ x: 40 + t * 2, z: 30 }, 'walk', { x: 1, z: 0 }));
  assert.ok(events.some(e => e.type === 'flank' && e.pupil === b), 'the one further off runs round');
  assert.ok(b.flanking && !a.flanking);
  // A twin under a car is got up by the other as soon as it is beside it.
  a.mode = 'flat'; a.timer = STREET.flat; b.position = { x: a.position.x + 1, z: a.position.z }; b.mode = 'patrol';
  play(night, 1.2, () => prey({ x: 5, z: 5 }));
  assert.notEqual(a.mode, 'flat');
});

test('La Delegada walks at him cover or not, and with her standing nobody gives up', () => {
  const covers = [{ x: 60, z: 31, kind: 'containers' }];
  const { night, of } = nightWith(4, 1, { x: 30, z: 30 }, { covers });
  const delegada = of('delegada')[0], twins = of('gemelo');
  assert.equal(delegada.mode, 'chase', 'from the moment she is out');
  assert.ok(night.marching);
  const behind = { x: 60, z: 30 };
  const before = far(delegada.position, behind);
  for (const p of twins) { p.position = { x: 50, z: 30 }; p.mode = 'chase'; p.timer = 0; p.known = { x: 57, z: 30 }; }
  const events = play(night, 8, () => prey(behind));
  assert.ok(far(delegada.position, behind) < before - 8, 'hidden behind the containers, she still comes');
  assert.ok(!events.some(e => e.type === 'lost') && twins.every(p => p.mode === 'chase'), 'and hers do not give up');
  assert.ok(Math.max(NIGHT_TIERS[1].walk * STREET.march, STREET.marchLeast) < 5.2, 'she never outwalks Gerard');
  // Without her, the same two give up and go and look.
  delegada.mode = 'flat'; delegada.timer = 999;
  play(night, STREET.giveUp + 1, () => prey(behind));
  assert.ok(twins.every(p => p.mode === 'search'));
});

test('El Ausente is only seen in a lamp\'s light', () => {
  const lamp = { x: 30, z: 30 };
  const { night, of } = nightWith(4, 2, { x: 30, z: 30 }, { lamps: [lamp] });
  const ausente = of('ausente')[0];
  ausente.mode = 'patrol'; ausente.position = { ...lamp };
  assert.equal(shows(ausente, night), true, 'under the lamp');
  ausente.position = { x: 60, z: 30 };
  assert.equal(shows(ausente, night), false, 'in the dark it is not there');
  ausente.mode = 'chase';
  assert.equal(shows(ausente, night), true, 'but it shows when it comes at him');
  assert.ok(of('repetidor').every(p => shows(p, night)), 'the others are always there');
});

test('El Castigado faces the wall until someone runs past: at three points of Rabia it bursts', () => {
  const { night, of } = nightWith(5, 2, { x: 30, z: 30 });
  const castigado = of('castigado')[0], empollon = of('empollon')[0];
  assert.equal(castigado.mode, 'wall');
  empollon.position = { x: 45, z: 30 }; empollon.patrol = [{ x: 45, z: 30 }]; empollon.next = 0; empollon.mode = 'patrol';
  const near = { x: castigado.position.x + 4, z: castigado.position.z + 3 };
  const walked = play(night, 6, () => prey(near, 'walk', { x: 1, z: 0 }));
  assert.ok(!walked.some(e => e.type === 'rage') && castigado.mode === 'wall', 'walking past, it does not turn');
  const ran = play(night, STREET.rageEvery * STREET.rage + .3, () => prey(near, 'run', { x: 1, z: 0 }));
  assert.equal(ran.filter(e => e.type === 'rage').length, STREET.rage - 1, 'each stretch of running is a point');
  assert.ok(ran.some(e => e.type === 'burst'));
  assert.ok(castigado.burst && castigado.mode === 'chase');
  // From then on it never loses him, hidden or not.
  const after = play(night, 4, () => prey({ x: 80, z: 50 }, 'walk', { x: 1, z: 0 }));
  assert.ok(!after.some(e => e.type === 'lost' && e.pupil === castigado) && castigado.mode === 'chase');
});

test('El Montón does what Gerard does: it runs, walks and stops with him', () => {
  const { night, of } = nightWith(4, 3, { x: 30, z: 30 }, { lamps: [{ x: 36, z: 30 }] });
  const monton = of('monton')[0], chivata = of('chivata')[0];
  chivata.mode = 'flat'; chivata.timer = 999;
  monton.position = { x: 30, z: 30 }; monton.mode = 'patrol';
  const seen = play(night, 3, () => prey({ x: 36, z: 30 }));
  assert.ok(seen.some(e => e.type === 'shape'));
  const moved = seconds => { const from = { ...monton.position }; return who => { play(night, seconds, who); return far(from, monton.position) / seconds; }; };
  const still = moved(2)(() => prey({ x: 60, z: 30 }));
  assert.ok(still < .01, 'he stands still, it stands still');
  const walking = moved(2)(() => prey({ x: 60, z: 30 }, 'walk', { x: 1, z: 0 }));
  const running = moved(2)(() => prey({ x: 60, z: 30 }, 'run', { x: 1, z: 0 }));
  assert.ok(Math.abs(walking - STREET.mimicWalk) < .2 && Math.abs(running - STREET.mimicRun) < .2, `${walking} walking, ${running} running`);
  assert.ok(STREET.mimicWalk < 5.2 && STREET.mimicRun < 7.8, 'at either pace Gerard gains a little on it');
});

test('a car runs a pupil over and leaves it flat for a while; standing cars do nothing', () => {
  const { night, of } = nightWith(3, 1, { x: 30, z: 30 });
  const [a] = of('gemelo');
  const car = v => [{ x: a.position.x, z: a.position.z, hx: 1, hz: 0, length: 4, width: 1.8, v }];
  assert.ok(!stepStreet(night, .05, prey({ x: 5, z: 5 }), car(0)).some(e => e.type === 'flat'), 'a car waiting at the light');
  assert.ok(stepStreet(night, .05, prey({ x: 5, z: 5 }), car(6)).some(e => e.type === 'flat' && e.pupil === a));
  assert.equal(a.mode, 'flat');
  const events = play(night, STREET.flat + .5, () => prey({ x: 5, z: 5 }));
  assert.ok(events.some(e => e.type === 'up' && e.pupil === a) && a.mode !== 'flat', 'then it peels itself up');
});

test('walking into one is its fight; one that catches the party names its group', () => {
  const { night, pupils } = nightWith(2, 1, { x: 30, z: 30 });
  const one = pupils[0];
  const events = stepStreet(night, .05, prey({ x: one.position.x + .3, z: one.position.z }, 'walk', { x: -1, z: 0 }));
  assert.deepEqual(events.map(e => e.type), ['caught']);
  assert.equal(events[0].pupil.group, 2);
});

test('the avenue is theirs at night: groups posted all along it, on both sides, more the further her power spreads, none where the party comes out', () => {
  const road = carriageway(street.geo?.roads ?? []), grid = huntersGrid(street.grid, portal);
  const grates = street.props.filter(p => p.kind === 'grate'), rows = avenueRows(grates, portal);
  const station = street.interactions.find(i => i.id === 'station-fabra-i-puig').cell;
  let before = 0;
  for (const tier of NIGHT_TIERS) {
    const night = createStreet({ tier, phase: 1, grid, lamps: [], covers: [], portal, road });
    const posted = postGroups(night, station, rows);
    const groups = groupsOut(night);
    assert.ok(groups >= Math.floor(grid[0].length / tier.every) - 2, `${tier.id}: a group every ${tier.every} cells or so (${groups})`);
    assert.ok(groups > before, `${tier.id}: more than the tier before`);
    before = groups;
    assert.ok(posted.length >= groups * 2, 'a body each');
    for (const p of posted) {
      assert.ok(canWalk({ x: Math.round(p.position.x), z: Math.round(p.position.z) }, grid) && !road(p.position), `${p.id} stands off the carriageway`);
      assert.ok(Math.hypot(p.position.x - station.x, p.position.z - station.z) >= FIRST_CLEAR - 7, `${p.id} is not in the party's face`);
      assert.ok(p.position.z >= rows[0] - 7 && p.position.z <= rows[1] + 7, `${p.id} is on the avenue, not up a side street`);
    }
    // All along it: every fifth of the avenue has someone, and both pavements do.
    const fifth = grid[0].length / 5;
    for (let i = 0; i < 5; i++) assert.ok(posted.some(p => p.position.x >= i * fifth && p.position.x < (i + 1) * fifth), `${tier.id}: someone in fifth ${i + 1}`);
    assert.ok(posted.some(p => p.position.z < 50) && posted.some(p => p.position.z > 66), `${tier.id}: on both pavements`);
    // They are out already, walking, on the rules' first step; and the grates can still bring some more.
    stepStreet(night, .05, { position: station, pace: 'still', heading: { x: 0, z: 0 }, still: 0 });
    assert.ok(posted.every(p => p.mode !== 'rising'));
    assert.equal(night.most, groups + tier.hunters * 2);
    assert.ok(riseGroup(night, grates[0]).length > 0);
  }
});

test('a saved afternoon is read only from the afternoons that leave something', async () => {
  const { isBoost, readDays } = await import('../src/days.ts');
  assert.ok(isBoost('sofa'));
  for (const id of ['cama', 'toString', 'constructor', '__proto__', 7]) assert.equal(isBoost(id), false, String(id));
  const days = readDays({ epoch: 0, clock: { day: 2, hour: 9 }, mornings: [], boost: { id: 'toString', until: 3 } });
  assert.equal(days?.boost, undefined);
});
