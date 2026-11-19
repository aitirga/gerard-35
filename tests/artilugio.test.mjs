import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { ARTILUGIO_BUTTONS, ARTILUGIO_NOTES, ARTILUGIO_PAIRS, MELODY, artilugioButtons, artilugioNote } from '../src/castle.ts';
import { CHORD_MS, Chords, PAD_FACES, PAD_HOLD, createArtilugio } from '../src/artilugio.ts';

test('four buttons alone and four pairs, eight notes of one scale from G to G', () => {
  assert.equal(ARTILUGIO_NOTES.length, ARTILUGIO_BUTTONS + ARTILUGIO_PAIRS.length);
  assert.deepEqual([0, 1, 2, 3].map(b => artilugioNote([b])), [0, 1, 2, 3]);
  assert.deepEqual(ARTILUGIO_PAIRS.map(pair => artilugioNote(pair)), [4, 5, 6, 7]);
  assert.equal(artilugioNote([1, 0]), 4, 'a pair is the same either way round');
  assert.equal(artilugioNote([0, 2]), 0, 'two that are not a pair sound the first');
  for (let note = 0; note < ARTILUGIO_NOTES.length; note++) assert.equal(artilugioNote(artilugioButtons(note)), note);
  // Each pair's note lies between its two buttons' (blue + red is the G above).
  ARTILUGIO_PAIRS.forEach(([a, b], i) => {
    const [low, high] = [ARTILUGIO_NOTES[a], ARTILUGIO_NOTES[b] < ARTILUGIO_NOTES[a] ? ARTILUGIO_NOTES[b] * 2 : ARTILUGIO_NOTES[b]];
    assert.ok(ARTILUGIO_NOTES[4 + i] > low && ARTILUGIO_NOTES[4 + i] <= high, `pair ${i}`);
  });
  const sorted = [...ARTILUGIO_NOTES].sort((x, y) => x - y);
  assert.ok(Math.abs(sorted[7] / sorted[0] - 2) < .01, 'from G to the G above');
});

test('the melody needs the pairs: it cannot be played on single buttons', () => {
  assert.equal(MELODY.length, 6);
  assert.ok(MELODY.filter(n => n >= ARTILUGIO_BUTTONS).length >= 2);
});

test('two presses within the window are a pair; one alone waits and sounds alone', () => {
  const played = [], timers = [];
  const chords = new Chords(n => played.push(n), (run, ms) => { timers.push({ run, ms }); return 0; });
  chords.press(1); chords.press(2);
  assert.deepEqual(played, [5]);
  chords.press(3);
  assert.deepEqual(played, [5], 'it waits for a second button');
  assert.equal(timers.at(-1).ms, CHORD_MS);
  timers.at(-1).run();
  assert.deepEqual(played, [5, 3]);
  chords.press(0); chords.press(0); timers.at(-1).run();
  assert.deepEqual(played, [5, 3, 0], 'the same button twice is not a pair');
});

test('the board and the game agree on the notes, the pairs and the window', () => {
  const header = readFileSync(new URL('../firmware/artilugio/notes.h', import.meta.url), 'utf8');
  const notes = header.match(/NOTE_HZ\[\]\s*=\s*\{([^}]*)\}/)[1].split(',').map(Number);
  assert.deepEqual(notes.map(Math.round), ARTILUGIO_NOTES.map(Math.round));
  const pairs = [...header.match(/PAIRS\[\]\[2\]\s*=\s*\{(.*)\};/s)[1].matchAll(/\{\s*(\d+)\s*,\s*(\d+)\s*\}/g)].map(m => [Number(m[1]), Number(m[2])]);
  assert.deepEqual(pairs, ARTILUGIO_PAIRS.map(p => [...p]));
  assert.equal(Number(header.match(/CHORD_MS\s*=\s*(\d+)/)[1]), CHORD_MS);
});

test("player 1's pad plays it holding the left trigger, and only when the story lets it", () => {
  globalThis.window ??= { addEventListener() {}, removeEventListener() {} };
  let open = true;
  const bus = createArtilugio(() => open), heard = [];
  bus.onNote(n => heard.push(n));
  const pad = { id: 'Xbox', mapping: 'standard', index: 0, connected: true, axes: [0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) };
  pad.buttons[PAD_FACES[0]].pressed = true;
  assert.equal(bus.pad(pad), false, 'without the trigger the face buttons are the game\'s');
  pad.buttons[PAD_HOLD].pressed = true;
  assert.equal(bus.pad(pad), true);
  pad.buttons[PAD_FACES[1]].pressed = true;
  bus.pad(pad);
  assert.deepEqual(heard, [{ note: 4, source: 'pad' }], 'red and yellow together: the pair');
  open = false;
  assert.equal(bus.pad(pad), false);
  bus.destroy();
});
