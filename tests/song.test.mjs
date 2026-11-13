import test from 'node:test';
import assert from 'node:assert/strict';
import { PHRASES, TONES, duty, onsets, phraseLength, songAt, untilNote } from '../src/song.ts';

test('a maze\'s phrase always has a note sounding, the fight\'s have silences', () => {
  for (const id of ['dos-notas', 'una-pasada', 'clavijas']) {
    assert.equal(duty(PHRASES[id]), 1, id);
    for (let t = 0; t < 30; t += .37) assert.ok(songAt(PHRASES[id], t).sounding, `${id} at ${t}`);
  }
  for (const id of ['andante', 'allegro', 'a-capela']) assert.ok(duty(PHRASES[id]) < .7, id);
  // Each phase leaves less of the phrase to hit in than the one before.
  assert.ok(duty(PHRASES.andante) > duty(PHRASES.allegro) && duty(PHRASES.allegro) > duty(PHRASES['a-capela']));
});

test('the song says what is on at any moment, and comes round', () => {
  const p = PHRASES.andante, length = phraseLength(p);
  assert.deepEqual({ ...songAt(p, 0) }, { index: 0, loop: 0, tone: 'la', sounding: true, into: 0, left: 3.2, k: 0 });
  const rest = songAt(p, 3.3);
  assert.equal(rest.sounding, false); assert.equal(rest.index, 0);
  assert.ok(Math.abs(rest.left - 2.1) < 1e-9);
  assert.equal(songAt(p, 5.5).tone, 'do');
  const again = songAt(p, length + 1);
  assert.equal(again.loop, 1); assert.equal(again.index, 0); assert.ok(again.sounding);
  // A capela's long note is its last, and the only one with room for two blows.
  assert.equal(PHRASES['a-capela'].beats.at(-1).sing, Math.max(...PHRASES['a-capela'].beats.map(b => b.sing)));
});

test('the notes that start in a stretch are counted once each, and the phrase coming round is told', () => {
  const p = PHRASES.andante, length = phraseLength(p);
  assert.deepEqual(onsets(p, 0, 1), []);
  assert.deepEqual(onsets(p, 5, 6).map(o => o.tone), ['do']);
  assert.equal(onsets(p, 0, length).length, p.beats.length);
  assert.deepEqual(onsets(p, length - .1, length + .1), [{ index: 0, loop: 1, tone: 'la', round: true }]);
  // Frame by frame it adds up to the same.
  let count = 0;
  for (let t = 0; t < length * 3; t += 1 / 60) count += onsets(p, t, t + 1 / 60).length;
  assert.equal(count, p.beats.length * 3);
});

test('waiting for a note: none in one, the rest of the silence otherwise, or until one long enough', () => {
  const p = PHRASES['a-capela'];
  assert.equal(untilNote(p, .2), 0);
  assert.ok(Math.abs(untilNote(p, 1.3) - 1.4) < 1e-9);
  // Room for two blows only on the long one.
  const wait = untilNote(p, .2, 3);
  assert.ok(songAt(p, .2 + wait + .01).tone === 'la' && songAt(p, .2 + wait + .01).sounding);
});

test('no note is pink or violet', () => {
  for (const tone of Object.values(TONES)) {
    const [r, g, b] = [1, 3, 5].map(i => parseInt(tone.colour.slice(i, i + 2), 16));
    // Pink and violet: red and blue both well over green.
    assert.ok(!(r > g + 40 && b > g + 40), tone.name);
  }
});
