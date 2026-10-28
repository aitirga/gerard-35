import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_AUDIO, levelGain, validAudioSettings } from '../src/audio.ts';
import { TRACKS, cycleCount, evenStart, fadeCurve, loopPosition, loopRange, loudnessAt, markTime, matchGain, medianLoudness, nextVersion, randomStart, untilBoundary, vampLaps, vampPosition } from '../src/music.ts';
import { readFileSync } from 'node:fs';
import { DREAM_HAUNT, HAUNT_SOUNDS, castleHaunt, hauntMix, swing } from '../src/haunt.ts';
import { castleThreat } from '../src/animas.ts';

const close = (actual, expected, message) => assert.ok(Math.abs(actual - expected) < 1e-6, `${message ?? ''} ${actual} ≠ ${expected}`);

test('stored audio settings are clamped and fall back to the defaults', () => {
  assert.deepEqual(validAudioSettings(null), DEFAULT_AUDIO);
  assert.deepEqual(validAudioSettings({ music: 2, sfx: -1, muted: 'yes' }), { music: 1, sfx: 0, muted: false });
  assert.deepEqual(validAudioSettings({ music: .3, sfx: Number.NaN, muted: true }), { music: .3, sfx: DEFAULT_AUDIO.sfx, muted: true });
  close(levelGain(.5), .25);
});

test('every track has the marks it loops between, in order', () => {
  for (const [id, track] of Object.entries(TRACKS)) {
    const range = loopRange(track);
    if (range) assert.ok(range[0] < range[1], `${id} loops backwards`);
    if (track.downbeat) assert.ok(track.downbeat in track.marks, `${id} has no ${track.downbeat} mark`);
  }
  assert.equal(markTime(TRACKS.battle, 12.5), 12.5);
  assert.throws(() => markTime(TRACKS.battle, 'nowhere'));
});

test('the song position plays the intro once, then wraps inside the loop', () => {
  const loop = [2, 10];
  close(loopPosition(1, 0, loop), 1, 'intro');
  close(loopPosition(9, 0, loop), 9);
  close(loopPosition(10, 0, loop), 2, 'wraps at the end');
  close(loopPosition(13, 0, loop), 5);
  close(loopPosition(21, 0, loop), 5, 'second lap');
  close(loopPosition(1, 11, loop), 12, 'the ending plays straight');
  close(loopPosition(5, 0), 5, 'no loop');
});

test('jumps wait for the next beat or bar from the downbeat, never past the loop end', () => {
  const track = { marks: { loop: 1 }, bpm: 120, beatsPerBar: 4, downbeat: 'loop' };
  const loop = [1, 9];
  close(untilBoundary(1.2, 'now', track, loop), 0);
  close(untilBoundary(1.2, 'beat', track, loop), .3, 'beat');
  close(untilBoundary(1.2, 'bar', track, loop), 1.8, 'bar');
  close(untilBoundary(3, 'bar', track, loop), 0, 'already on a bar');
  close(untilBoundary(8.5, 'bar', track, loop), .5, 'capped by the loop end');
  close(untilBoundary(4, 'loop-end', track, loop), 5);
  close(untilBoundary(9.5, 'loop-end', track, loop), 0, 'already in the ending');
  close(untilBoundary(1.2, 'bar', { marks: {} }, loop), 0, 'no tempo means now');
});

test('fades follow an equal-power curve', () => {
  const fadeIn = fadeCurve(0, 1, 16), fadeOut = fadeCurve(1, 0, 16);
  close(fadeIn[0], 0); close(fadeIn[15], 1); close(fadeOut[0], 1); close(fadeOut[15], 0);
  for (let i = 0; i < 16; i++) close(fadeIn[i] ** 2 + fadeOut[i] ** 2, 1, `power at ${i}`);
});

test('a long take comes in anywhere but too near its end', () => {
  close(randomStart(100, 24, () => 0), 0);
  close(randomStart(100, 24, () => .999999), 75.999924);
  close(randomStart(10, 24, () => .5), 0, 'shorter than the margin');
});

test('an unhaunted song plays untouched', () => {
  const mix = hauntMix(0);
  assert.equal(mix.wobble, 0); assert.equal(mix.drift, 0); assert.equal(mix.drone, 0); assert.equal(mix.draught, 0);
  close(mix.cutoff, 20000);
  assert.deepEqual(mix.sounds, []);
  assert.deepEqual(hauntMix(Number.NaN).sounds, [], 'nonsense is silence');
});

test('the castle haunts its song more the stronger it is', () => {
  let previous = hauntMix(0);
  for (let level = .05; level <= 1.0001; level += .05) {
    const mix = hauntMix(level);
    assert.ok(mix.wobble > previous.wobble && mix.cutoff < previous.cutoff && mix.every < previous.every, `at ${level}`);
    assert.ok(mix.drone >= previous.drone && mix.draught >= previous.draught && mix.sounds.length >= previous.sounds.length, `at ${level}`);
    previous = mix;
  }
  assert.deepEqual(hauntMix(1).sounds, Object.keys(HAUNT_SOUNDS), 'everything at her worst');
  // Each ánima takes a sound away, the way the castle's towers fall.
  const heard = animas => hauntMix(castleThreat(animas)).sounds;
  assert.ok(heard(0).includes('heartbeat'));
  assert.ok(!heard(1).includes('heartbeat') && heard(1).includes('sag'));
  assert.ok(!heard(2).includes('sag') && heard(2).includes('thunder'), 'the storm still stands at two ánimas');
  assert.deepEqual(heard(6), ['music-box'], 'the floor keeps a music box');
});

test('chapter 1 dreams the castle; chapter 2 follows its threat', () => {
  assert.equal(castleHaunt({ adult: false, castleThreat: 1 }), DREAM_HAUNT);
  assert.equal(castleHaunt({ adult: true, castleThreat: .55 }), .55);
  assert.deepEqual(hauntMix(DREAM_HAUNT).sounds, ['music-box', 'breath'], 'no storm in the dream');
});

test('the pitch swing bends the song by the cents asked', () => {
  const rate = .37, cents = 24, peak = 2 * Math.PI * rate * swing(cents, rate);
  close(1200 * Math.log2(1 + peak), cents);
  assert.equal(swing(0, rate), 0);
});

test('a long take comes in near the loudness asked, matched and capped', () => {
  const map = { db: [-30, -30, -20, -20, -10, -10, -10, -10, -10, -10] };
  close(loudnessAt(map, 1.5), -25, 'between seconds');
  close(loudnessAt(map, 99), -10, 'past the end');
  close(medianLoudness(map), -10);
  close(medianLoudness({ db: [-1, -3, -2, -4] }), -2.5);
  // Candidates at 0, 2 and 4 s: the one nearest -20 dB wins, whatever order they come in.
  const draws = [0, .4, .2];
  const start = evenStart(15, 5, map, -20, () => draws.shift() ?? 0, 3);
  close(start, 2);
  close(matchGain(-20, -20), 1);
  close(matchGain(-20, -26), 10 ** (6 / 20), 'a quieter point is lifted');
  close(matchGain(-20, -40), 10 ** (6 / 20), 'never more than 6 dB');
  close(matchGain(-30, -20), 10 ** (-6 / 20), 'a louder one is lowered');
});

test('every long take ships its loudness map', () => {
  for (const [id, track] of Object.entries(TRACKS)) {
    if (!track.stream) continue;
    assert.ok(track.loudness, `${id} has no loudness map`);
    const path = new URL(`../public/${track.loudness}`, import.meta.url);
    const { db } = JSON.parse(readFileSync(path, 'utf8'));
    assert.ok(db.length > 60 && db.every(Number.isFinite), `${id}'s map is broken`);
  }
});

test('a cycled song opens with its first version, then mixes the others, never one twice in a row', () => {
  assert.equal(cycleCount(288.02, 48), 6, 'mazmorra-2 holds six versions');
  assert.equal(cycleCount(20, 48), 1, 'a file shorter than its cycle is one version');
  const picks = new Set();
  for (let previous = 0; previous < 6; previous++) {
    for (let i = 0; i < 5; i++) {
      const next = nextVersion(6, previous, () => i / 5);
      assert.notEqual(next, previous);
      assert.ok(next >= 1 && next < 6, 'the first version never comes back');
      picks.add(`${previous}>${next}`);
    }
  }
  assert.equal(picks.size, 25, 'every other version but the first can follow');
  assert.equal(nextVersion(1, 0), 0, 'a single version repeats');
  assert.equal(nextVersion(2, 1), 1, 'with two, the second repeats');
  for (const [id, track] of Object.entries(TRACKS)) if ('cycle' in track) assert.ok(track.cycle > 0 && !('loop' in track), `${id} both loops and cycles`);
});

test('a vamp repeats its section for its laps, then the song goes on', () => {
  const vamp = { from: 2, to: 10, laps: 3 };
  close(vampPosition(1, 0, vamp), 1, 'the intro');
  close(vampPosition(9, 0, vamp), 9, 'the first lap');
  close(vampPosition(10, 0, vamp), 2, 'back to the section start');
  close(vampPosition(25, 0, vamp), 9, 'the third lap');
  close(vampPosition(26, 0, vamp), 10, 'on past the section after the last lap');
  close(vampPosition(30, 0, vamp), 14);
  close(vampPosition(3, 6, vamp), 9, 'started inside the section, that lap counts');
  close(vampPosition(4, 6, vamp), 2);
  close(vampPosition(5, 12, vamp), 17, 'started past the section, it plays straight');
  close(vampPosition(20, 0, { ...vamp, laps: 1 }), 20, 'one lap is no repeat');
  assert.equal(vampLaps([2, 4], () => 0), 2);
  assert.equal(vampLaps([2, 4], () => .999), 4);
  assert.equal(vampLaps([3, 3], () => .5), 3);
  for (const [id, track] of Object.entries(TRACKS)) {
    if (!('vamp' in track)) continue;
    const from = markTime(track, track.vamp.from), to = markTime(track, track.vamp.to), range = loopRange(track);
    assert.ok(from < to && track.vamp.laps[0] >= 1 && track.vamp.laps[0] <= track.vamp.laps[1], `${id}'s vamp is backwards`);
    if (range) assert.ok(range[0] <= from && to <= range[1], `${id} vamps outside its loop`);
    if (track.bpm) { const bars = (to - from) * track.bpm / 60 / (track.beatsPerBar ?? 4); assert.ok(Math.abs(bars - Math.round(bars)) < .01, `${id}'s vamp is ${bars} bars`); }
  }
});
