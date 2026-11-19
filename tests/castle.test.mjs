import test from 'node:test';
import assert from 'node:assert/strict';
import { CASTLE, CASTLE_ENCOUNTERS, CASTLE_PHASES, MELODY, castleEntry, extraSlots, floorFor, isCastle } from '../src/castle.ts';
import { aitorTaken, artilugioLive, castleAfter, castleNote, castleTaken, nextNote } from '../src/castle-fight.ts';
import { castleEnvironment } from '../src/castle-floor.ts';
import { createFearBattle } from '../src/battle.ts';
import { Story } from '../src/story.ts';
import { flagsAt } from '../src/story-points.ts';
import { canWalk } from '../src/movement.ts';

const party = [{ id: 'gerard', name: 'Gerard', profile: 'gerard35', classId: 'papagato' }, { id: 'aitor', name: 'Aitor', profile: 'aitor', classId: 'matemagico' }];
/** Whether `to` can be walked to from `from` on `grid`, step by step. */
function reaches(grid, from, to) {
  const seen = new Set([`${from.x},${from.z}`]), queue = [from];
  while (queue.length) {
    const at = queue.shift();
    if (at.x === to.x && at.z === to.z) return true;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const next = { x: at.x + dx, z: at.z + dz }, key = `${next.x},${next.z}`;
      if (!seen.has(key) && canWalk(next, grid)) { seen.add(key); queue.push(next); }
    }
  }
  return false;
}

test('a castle floor is the same all day and another the next, and always walks from its entry to its boss and back', () => {
  for (const phase of CASTLE_PHASES) for (let seed = 0; seed < 12; seed++) {
    const floor = floorFor(seed, 3, phase.id);
    assert.deepEqual(floorFor(seed, 3, phase.id), floor, 'the same three numbers, the same floor');
    for (const cell of [floor.spawn, floor.back, floor.exit]) assert.ok(canWalk(cell, floor.grid), `${phase.id}/${seed}: ${JSON.stringify(cell)}`);
    assert.ok(reaches(floor.grid, floor.spawn, floor.exit), `${phase.id}/${seed}: the boss's door can be reached`);
    assert.ok(reaches(floor.grid, floor.spawn, floor.back), `${phase.id}/${seed}: the way back can be reached`);
    assert.equal(floor.rooms.filter(r => r.onPath).length, phase.rooms, 'its main path has the phase\'s rooms');
    assert.equal(floor.rooms.filter(r => r.kind === 'rest').length, 1, 'one staff room');
    for (const room of floor.rooms.filter(r => r.kind === 'fight' || r.kind === 'elite')) assert.ok([...phase.fights, phase.elite].includes(room.encounter), room.encounter);
    const place = castleEnvironment(floor);
    assert.deepEqual(place.interactions.map(i => i.id), ['castillo-volver', 'castillo-salir']);
  }
  const days = new Set([1, 2, 3, 4].map(day => JSON.stringify(floorFor(7, day, 1).grid)));
  assert.ok(days.size > 1, 'a new day, a new floor');
});

test('every castle fight stands up, all of it the castle\'s own', () => {
  for (const encounter of CASTLE_ENCOUNTERS) {
    const state = createFearBattle(party, encounter);
    assert.ok(state.foes.length && state.foes.every(f => isCastle(f.kind)), encounter);
  }
});

test('Aurelià behind his lectern takes half; with the lectern broken, all of it', () => {
  const state = createFearBattle(party, 'aurelia'), boss = state.foes.find(f => f.kind === 'aurelia'), atril = state.foes.find(f => f.kind === 'atril');
  assert.equal(castleTaken(state, boss, 'physical'), CASTLE.atril);
  atril.hp = 0; castleAfter(undefined, state);
  assert.equal(castleTaken(state, boss, 'physical'), 1);
});

test('at a tenth of her PV the Queen takes Aitor, even down, and nothing reaches her while she has him', () => {
  for (const down of [false, true]) {
    const state = createFearBattle(party, 'reina'), queen = state.foes.find(f => f.kind === 'reina'), aitor = state.allies.find(a => a.id === 'aitor');
    if (down) aitor.hp = 0;
    // One big blow from well above the tenth straight to nothing: she does not fall.
    queen.castle.stage = 'pompa'; queen.hp = 0;
    castleAfter(undefined, state);
    assert.equal(queen.hp, Math.ceil(queen.maxHp * CASTLE.toma));
    assert.equal(aitor.castle?.held, 'reina');
    assert.ok(aitor.hp > 0, 'she lifts him');
    assert.ok(aitorTaken(state));
    assert.equal(castleTaken(state, queen, 'physical'), 0);
    assert.ok(!artilugioLive(state), 'the first time there is no artilugio');
  }
});

test('she takes Aitor only when she is about to fall: lost before that, it is an ordinary fall', () => {
  for (const who of ['gerard', 'aitor']) {
    const state = createFearBattle(party, 'reina');
    state.allies.find(a => a.id === who).hp = 0;
    castleAfter(undefined, state);
    assert.ok(!aitorTaken(state), who);
  }
  const story = new Story([...flagsAt('castle'), 'aurelia', 'direccion']);
  const fall = story.handle({ type: 'battle', won: false, encounter: 'reina', taken: false });
  assert.ok(!story.has('aitor-poseido') && !story.has('artilugio'), 'no possession, no call from Bernat');
  assert.ok(!fall.some(e => e.kind === 'dialogue' && JSON.stringify(e).includes('Bernat')), 'an ordinary fall');
});

test('with the artilugio, the melody in order frees Aitor; a wrong note puts the marks out', () => {
  const state = createFearBattle(party, 'reina-vuelta'), queen = state.foes.find(f => f.kind === 'reina');
  queen.hp = 0; castleAfter(undefined, state);
  state.phase = 'player';
  assert.ok(artilugioLive(state));
  const first = castleNote(state, nextNote(state));
  assert.ok(first.right && first.startled && first.notes === 1);
  assert.equal(castleNote(state, MELODY[0]).notes, 1, 'the first note again starts the melody again');
  assert.equal(castleNote(state, 6).notes, 0, 'a wrong one, and back to nothing');
  let last;
  for (let i = 0; i < MELODY.length; i++) last = castleNote(state, nextNote(state));
  assert.ok(last.freed);
  assert.ok(!aitorTaken(state));
  assert.equal(state.allies.find(a => a.id === 'aitor').castle?.held, undefined);
  assert.ok(castleTaken(state, queen, 'physical') > 0, 'and she can be finished');
});

test('the castle in the story: the gym leads into the floor, each boss moves the way in, she takes Aitor once, and Gerard chooses', () => {
  const story = new Story(flagsAt('castle'));
  assert.equal(story.redirect('patio-gimnasio').environment, 'castillo-1');
  assert.equal(story.extraSlots, 1);
  story.handle({ type: 'battle', won: true, encounter: 'aurelia' });
  assert.ok(story.has('aurelia') && story.has('luz-aurelia'));
  assert.equal(story.extraSlots, 2, 'Aurelià opens a third ánima each');
  assert.equal(story.redirect('gimnasio-vestuarios').environment, 'castillo-2');
  assert.deepEqual(castleEntry(new Set(['aurelia'])).environment, 'palacio-gimnasio');
  story.handle({ type: 'battle', won: true, encounter: 'direccion' });
  assert.ok(['direccion', 'luz-mar', 'luz-montse', 'luz-pilar'].every(f => story.has(f)));
  assert.equal(story.redirect('secretaria-direccio').environment, 'castillo-3');
  // Lost with Aitor hers: the once it happens. The morning after, the artilugio.
  const fall = story.handle({ type: 'battle', won: false, encounter: 'reina', taken: true });
  assert.ok(story.has('aitor-poseido') && story.has('artilugio'));
  assert.ok(fall.some(e => e.kind === 'dialogue'));
  const won = story.handle({ type: 'battle', won: true, encounter: 'reina-vuelta' });
  assert.ok(won.some(e => e.kind === 'ending'));
  const end = story.handle({ type: 'ending', choice: 'bajar' });
  assert.ok(story.has('reina') && story.has('final-bajar') && !story.has('final-acabar'));
  assert.ok(end.some(e => e.kind === 'epilogue' && e.choice === 'bajar'));
  assert.deepEqual(story.handle({ type: 'ending', choice: 'acabar' }), [], 'only once');
  assert.equal(story.redirect('patio-gimnasio'), undefined, 'after her, the school is a school');
  assert.equal(extraSlots(new Set()), 1);
});

test('each castle boss beaten holds her back as an ánima does, so a castle begun late can be finished', () => {
  const story = new Story(flagsAt('castle'));
  story.days.clock = { day: 6, hour: 9 };
  const before = story.spread;
  story.handle({ type: 'battle', won: true, encounter: 'aurelia' });
  story.days.clock = { day: 6, hour: 9 };
  assert.ok(story.spread < before, 'Aurelià beaten: her spread goes back');
  assert.equal(story.heldBack, story.animas.length + 1);
});
