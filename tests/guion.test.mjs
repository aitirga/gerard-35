import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { GROUPS, VOICES, closeGuionNote, encodeLiteral, guionNotesJson, guionNotesProblem, literals, newGuionNote, replaceLiteral } from '../src/guion.ts';
import { collect } from '../scripts/guion.mjs';

test('the literal scanner reads strings and skips comments, regular expressions and template holes', () => {
  const src = [
    "// Gerard's comment with 'quotes'",
    "const a = 'Hola, \\'Gerard\\'.'; /* it's a block */",
    'const b = "Dijo \\"no\\".", re = /\'[^\']*\'/g, half = 4 / 2;',
    "const c = `Rabia ${m.rage}/${'tope'}`, d = `Sin piezas`;",
  ].join('\n');
  const values = literals(src).map(l => [l.value, l.dynamic, l.line]);
  assert.deepEqual(values, [
    ["Hola, 'Gerard'.", false, 2],
    ['Dijo "no".', false, 3],
    ['Rabia ${m.rage}/${\'tope\'}', true, 4],
    ['tope', false, 4],
    ['Sin piezas', false, 4],
  ]);
});

test('an edit writes the literal back with its own quotes, and refuses what it cannot find or is built from pieces', () => {
  const src = "const x = { a: say('Uno.'), b: say('Dos.'), c: say('Uno.'), d: `Hola ${who}.` };\n";
  assert.ok('error' in replaceLiteral(src, literals(src).find(l => l.value === 'Dos.'), 'Dos, ¿no?', 'Otro.'), 'the old text must match');
  const done = replaceLiteral(src, literals(src).find(l => l.value === 'Dos.'), 'Dos.', "Dos ya no es 'dos'.");
  assert.equal(done.source, "const x = { a: say('Uno.'), b: say('Dos ya no es \\'dos\\'.'), c: say('Uno.'), d: `Hola ${who}.` };\n");
  assert.equal(literals(done.source).find(l => l.value.startsWith('Dos'))?.value, "Dos ya no es 'dos'.");
  // Said twice: the one at its place, never a guess.
  const second = literals(src).filter(l => l.value === 'Uno.')[1];
  assert.match(replaceLiteral(src, second, 'Uno.', 'Otro.').source, /c: say\('Otro\.'\)/);
  assert.ok('error' in replaceLiteral(src, { line: 9, col: 9 }, 'Uno.', 'Otro.'), 'twice and not where it was: refused');
  assert.ok('error' in replaceLiteral(src, literals(src).find(l => l.dynamic), 'Hola ${who}.', 'Adiós.'), 'a template with pieces is read only');
  assert.equal(encodeLiteral('a\nb `c` ${d}', '`'), '`a\\nb \\`c\\` \\${d}`');
  // JSON (the places' looks) keeps its double quotes.
  const json = '{"lines":["Una \\"casa\\".","Otra."]}';
  assert.deepEqual(JSON.parse(replaceLiteral(json, literals(json)[1], 'Una "casa".', 'Una "casa" vieja.').source), { lines: ['Una "casa" vieja.', 'Otra.'] });
});

test('notes: a comment, a suggestion and a closed one pass the check; anything else is refused', () => {
  const now = new Date('2026-11-21T02:00:00Z');
  const comment = newGuionNote({ entry: 'chapter-1:LINES.jan', title: 'LINES.jan', text: 'Jan suena mayor.' }, now);
  const suggestion = newGuionNote({ entry: 'chapter-1:LINES.wake', title: 'LINES.wake', text: '', line: 0, quote: '¡Hoy es mi cumpleaños!', proposal: '¡Hoy cumplo años!' }, new Date(now.getTime() + 1000));
  const closed = { ...closeGuionNote(suggestion, 'hecha', now), reply: 'Aplicada.' };
  assert.equal(guionNotesProblem({ notes: [comment, suggestion] }), undefined);
  assert.equal(guionNotesProblem({ notes: [comment, closed] }), undefined);
  assert.equal(closeGuionNote(closed, 'abierta').closed, undefined);
  assert.match(guionNotesProblem({ notes: [comment, comment] }), /repetido/);
  assert.match(guionNotesProblem({ notes: [{ ...comment, extra: 1 }] }), /campos/);
  assert.match(guionNotesProblem({ notes: [{ ...comment, text: ' ' }] }), /no dice nada/);
  assert.match(guionNotesProblem({ notes: [{ ...comment, status: 'pendiente' }] }), /status/);
  assert.deepEqual(JSON.parse(guionNotesJson({ notes: [suggestion, comment] })).notes.map(n => n.id), [comment.id, suggestion.id]);
  assert.equal(guionNotesProblem(JSON.parse(readFileSync(new URL('../docs/guion-notes.json', import.meta.url), 'utf8'))), undefined, 'docs/guion-notes.json keeps the format');
});

test('the script has every line of the story, each with who says it and where it is written', async () => {
  const { entries } = await collect();
  const speakers = new Set([...readFileSync(new URL('../src/dialogue.ts', import.meta.url), 'utf8').matchAll(/^ {2}(\w+): \{ name:/gm)].map(m => m[1]));
  const ids = new Set();
  for (const e of entries) {
    assert.ok(!ids.has(e.id), `${e.id} twice`); ids.add(e.id);
    assert.ok(GROUPS.some(g => g.id === e.group), `${e.id}: section ${e.group}`);
    for (const l of e.lines) {
      assert.ok(speakers.has(l.speaker) || l.speaker in VOICES, `${e.id}: who is ${l.speaker}?`);
      assert.ok(l.at || l.dynamic, `${e.id}: «${l.text}» is not found in the code`);
    }
  }
  for (const group of ['capitulo-1', 'capitulo-2', 'castillo', 'nuria', 'universidad', 'emilie', 'luca', 'marta', 'bernat', 'lugares', 'diario', 'objetos']) {
    assert.ok(entries.some(e => e.group === group), `nothing in ${group}`);
  }
  // Each line is written where it says: the literal at file:line says exactly that.
  for (const e of entries) for (const l of e.lines) if (l.at) {
    const at = literals(readFileSync(new URL(`../${l.at.file}`, import.meta.url), 'utf8')).find(x => x.line === l.at.line && x.col === l.at.col);
    assert.equal(at?.value, l.text, `${e.id} at ${l.at.file}:${l.at.line}`);
  }
});
