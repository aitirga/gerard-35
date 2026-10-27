import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_AUDIO, levelGain, validAudioSettings } from '../src/audio.ts';
import { TRACKS, fadeCurve, loopPosition, loopRange, markTime, untilBoundary } from '../src/music.ts';

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
