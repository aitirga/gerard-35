import test from 'node:test';
import assert from 'node:assert/strict';
import { TONES, VOZ_RECORDING, VOZ_SONG, duty, gapAt, onsets, phraseLength, recordingAt, songAt, turnAt, untilGap, untilNote } from '../src/song.ts';

test('her song has silences, and a note sounding most of the time', () => {
  const d = duty(VOZ_SONG);
  assert.ok(d > .5 && d < .95, `duty ${d}`);
});

test('La Voz\'s song is Marta\'s recording: as long as the file, from its first note', () => {
  assert.ok(Math.abs(phraseLength(VOZ_SONG) - VOZ_RECORDING.length) < 1e-9);
  assert.ok(VOZ_SONG.beats.every(b => b.sing > 0 && b.rest >= 0 && b.tone in TONES));
  assert.ok(Math.abs(recordingAt(0) - VOZ_RECORDING.offset) < 1e-9);
  assert.ok(Math.abs(recordingAt(VOZ_RECORDING.length - VOZ_RECORDING.offset + 2) - 2) < 1e-9, 'it wraps to the top of the file');
  // One phrase, eight times over: each turn opens on Do and goes on to Sol.
  const firsts = [];
  for (let t = 0; t < VOZ_RECORDING.length - 1e-6;) { const turn = turnAt(VOZ_SONG, t); firsts.push(turn.beats.slice(0, 2).map(b => b.tone).join(' ')); t = turn.start + turn.length; }
  assert.deepEqual(firsts, Array(8).fill('do sol'));
  assert.deepEqual(turnAt(VOZ_SONG, 0).beats.map(b => b.tone), ['do', 'sol', 'fa', 're', 'do', 'sib', 'la', 'fa']);
});

test('the song says what is on at any moment, and comes round', () => {
  const p = VOZ_SONG, length = phraseLength(p), [first] = p.beats;
  assert.deepEqual({ ...songAt(p, 0) }, { index: 0, loop: 0, tone: 'do', sounding: true, into: 0, left: first.sing, k: 0 });
  const rest = songAt(p, first.sing + .1);
  assert.equal(rest.sounding, false); assert.equal(rest.index, 0);
  assert.ok(Math.abs(rest.left - (first.rest - .1)) < 1e-9);
  assert.equal(songAt(p, first.sing + first.rest + .1).tone, 'sol');
  const again = songAt(p, length + .5);
  assert.equal(again.loop, 1); assert.equal(again.index, 0); assert.ok(again.sounding);
});

test('the notes that start in a stretch are counted once each, and the phrase coming round is told', () => {
  const p = VOZ_SONG, length = phraseLength(p), [first] = p.beats;
  assert.deepEqual(onsets(p, 0, 1), []);
  assert.deepEqual(onsets(p, first.sing, first.sing + first.rest + .01).map(o => o.tone), ['sol']);
  assert.equal(onsets(p, 0, length).length, p.beats.length);
  assert.deepEqual(onsets(p, length - .1, length + .1), [{ index: 0, loop: 1, tone: 'do', round: true }]);
  // Inside the recording too, each time her phrase starts over.
  const second = turnAt(p, 0).length;
  assert.deepEqual(onsets(p, second - .01, second + .01).map(o => o.round), [true]);
  assert.equal(onsets(p, 0, length + .1).filter(o => o.round).length, 8);
  // Frame by frame it adds up to the same.
  let count = 0;
  for (let t = 0; t < length * 2; t += 1 / 60) count += onsets(p, t, t + 1 / 60).length;
  assert.equal(count, p.beats.length * 2);
});

test('waiting for a note: none in one, the rest of the silence otherwise, or until one long enough', () => {
  const p = VOZ_SONG, [first] = p.beats;
  assert.equal(untilNote(p, .2), 0);
  assert.ok(Math.abs(untilNote(p, first.sing + .1) - (first.rest - .1)) < 1e-9);
  // Room for her longest note only on it.
  const longest = Math.max(...p.beats.map(b => b.sing)), wait = untilNote(p, .2, longest - .05), there = songAt(p, .2 + wait + .01);
  assert.ok(there.sounding && there.left >= longest - .06);
  assert.equal(p.beats[there.index].sing, longest);
});

test('no note is pink or violet', () => {
  for (const tone of Object.values(TONES)) {
    const [r, g, b] = [1, 3, 5].map(i => parseInt(tone.colour.slice(i, i + 2), 16));
    // Pink and violet: red and blue both well over green.
    assert.ok(!(r > g + 40 && b > g + 40), tone.name);
  }
});

test('the wait for a gap and the gap at each moment agree, round the end of the song too', () => {
  const edges = { rest: .3, bound: .15 }, open = t => !!gapAt(VOZ_SONG, songAt(VOZ_SONG, t), edges), length = phraseLength(VOZ_SONG);
  for (let t = 0; t < length + 3; t += .37) {
    const wait = untilGap(VOZ_SONG, t, edges, .2);
    assert.ok(open(t + wait + .005), `open at ${t} + ${wait}`);
    assert.ok(open(t + wait + .195), `still open .2 s later (${t})`);
  }
  // Even bound, every change of note opens a gap.
  for (const [i, beat] of VOZ_SONG.beats.entries()) if (beat.rest === 0) {
    const end = VOZ_SONG.beats.slice(0, i + 1).reduce((sum, b, j) => sum + b.sing + (j < i ? b.rest : 0), 0);
    assert.ok(open(end - .05) && open(end + .05), `bound change after note ${i}`);
  }
});
