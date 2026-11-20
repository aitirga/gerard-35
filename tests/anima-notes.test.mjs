import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ANIMA_NAMES } from '../src/battle.ts';
import { SHEET_PAGES, animaNotesJson, animaNotesProblem, newAnimaNote } from '../src/anima-notes.ts';

test('a note on the ánimas\' sheet is kept in the shape the anima skill reads, and a wrong one is refused', () => {
  const note = newAnimaNote('papagato', 'Papagato', '  Ronroneo cura poco.  ', new Date('2026-11-20T09:10:00.123Z'));
  assert.deepEqual(note, { id: `n-${Date.parse('2026-11-20T09:10:00.123Z').toString(36)}`, entry: 'papagato', name: 'Papagato', text: 'Ronroneo cura poco.', status: 'abierta', created: '2026-11-20T09:10:00Z' });
  const answered = { ...note, id: 'n-zz', entry: 'duos', status: 'hecha', edited: '2026-11-20T09:20:00Z', reply: 'Hecho.', closed: '2026-11-20T10:00:00Z' };
  assert.equal(animaNotesProblem({ notes: [note, answered] }), undefined);
  assert.ok(animaNotesProblem({ notes: [{ ...note, entry: 'Papagato' }] }), 'an entry is an id, not a name');
  assert.ok(animaNotesProblem({ notes: [{ ...note, text: '  ' }] }), 'no empty note');
  assert.ok(animaNotesProblem({ notes: [{ ...note, status: 'cerrada' }] }));
  assert.ok(animaNotesProblem({ notes: [{ ...note, redo: [] }] }), 'no fields from elsewhere');
  assert.ok(animaNotesProblem({ notes: [note, note] }), 'ids are unique');
  assert.ok(animaNotesProblem([]));
  assert.deepEqual(JSON.parse(animaNotesJson({ notes: [{ ...answered, created: '2026-11-20T11:00:00Z' }, note] })).notes.map(n => n.id), [note.id, 'n-zz'], 'in the order they were made');
  assert.match(animaNotesJson({ notes: [note] }), /^\{\n  "notes": \[\n    \{\n      "id": "n-/);
});

test('every page of the ánimas\' sheet can take a note', () => {
  for (const id of [...Object.keys(ANIMA_NAMES), ...Object.keys(SHEET_PAGES)]) assert.equal(animaNotesProblem({ notes: [newAnimaNote(id, id, 'x')] }), undefined, id);
});
