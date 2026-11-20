import test from 'node:test';
import assert from 'node:assert/strict';
import { CASTLE_KINDS } from '../src/castle.ts';
import { ALL_FIGHTS, CASTLE_ANSWERS, MOTION, familyOf, foesOfTheGame, modelStatusOf, movesOf, placeOf, setupFor, startFight } from '../src/bestiary-data.ts';

// The bestiary (src/bestiary.ts, `just bestiario`) reads every foe from the fights themselves: a fight
// or a foe added to the game must show up there, with a place, a model status and its moves.

test('every fight of the game starts, and every foe in it is in the bestiary with a place', () => {
  for (const fight of ALL_FIGHTS) assert.ok(startFight(fight, 1).state.foes.length, fight);
  const foes = foesOfTheGame();
  const kinds = new Set(foes.map(f => f.kind));
  for (const fight of ALL_FIGHTS) for (const foe of startFight(fight, 1).state.foes) assert.ok(kinds.has(foe.kind), `${foe.kind} of ${fight}`);
  for (const seen of foes) {
    assert.notEqual(seen.place.id, 'otros', `${seen.kind} is met somewhere the bestiary does not know: add it to PLACES`);
    for (const template of [true, false]) {
      assert.ok(modelStatusOf(seen.kind, template).label, seen.kind);
      assert.ok(MOTION[familyOf(seen.kind, template)].length, seen.kind);
    }
  }
});

test('the castle answers cover every castle foe', () => {
  for (const kind of CASTLE_KINDS) assert.ok(CASTLE_ANSWERS[kind], kind);
});

test('a foe\'s moves come from playing its fights, and the bot plays each with a setup of its own', () => {
  assert.equal(setupFor('aurelia').fight, 'aurelia');
  assert.equal(placeOf('alumnos-2b').id, 'castillo');
  const { moves, failed } = movesOf('repetidor', ['alumnos-1a'], 2);
  assert.deepEqual(failed, []);
  assert.ok(moves.some(m => m.name === 'Empujón'), JSON.stringify(moves));
});

test('a note is kept in the shape the bestiario skill reads, and a wrong one is refused', async () => {
  const { REDO, newNote, notesJson, notesProblem } = await import('../src/bestiary-notes.ts');
  const note = newNote('enemigo:repetidor', 'El Repetidor', ['animaciones', 'modelo'], '  más chicle  ', new Date('2026-11-19T22:50:00.123Z'));
  assert.deepEqual(note, { id: `n-${Date.parse('2026-11-19T22:50:00.123Z').toString(36)}`, entry: 'enemigo:repetidor', name: 'El Repetidor', redo: ['modelo', 'animaciones'], text: 'más chicle', status: 'abierta', created: '2026-11-19T22:50:00Z' });
  assert.deepEqual(REDO, ['modelo', 'retrato', 'diseño', 'animaciones', 'combate']);
  assert.equal(notesProblem({ notes: [note, { ...note, id: 'n-zz', status: 'hecha', reply: 'Hecho.', closed: '2026-11-20T10:00:00Z' }] }), undefined);
  assert.ok(notesProblem({ notes: [{ ...note, redo: ['pelo'] }] }));
  assert.ok(notesProblem({ notes: [{ ...note, status: 'cerrada' }] }));
  assert.ok(notesProblem({ notes: [{ ...note, entry: 'repetidor' }] }));
  assert.ok(notesProblem({ notes: [note, note] }), 'ids are unique');
  assert.ok(notesProblem([]));
  const later = { ...note, id: 'n-zz', created: '2026-11-20T09:00:00Z' };
  assert.match(notesJson({ notes: [later, note] }), /^\{\n  "notes": \[\n    \{\n      "id": "n-/);
  assert.deepEqual(JSON.parse(notesJson({ notes: [later, note] })).notes.map(n => n.id), [note.id, 'n-zz'], 'in the order they were made');
});
