import test from 'node:test';
import assert from 'node:assert/strict';
import { ACTION_SECONDS, CONTACT_SECONDS } from '../src/battle-motion.ts';
import { FightClock, HIT, landing, spring } from '../src/hit-feel.ts';

/** Plays one action the way battle-scene.ts does: real frames in, the fight's own clock out. */
function play(stop, frame) {
  const clock = new FightClock();
  let real = 0, t = 0, contactAt, heldFrom, heldUntil;
  const poses = [];
  while (t < ACTION_SECONDS) {
    real += frame; t += clock.advance(frame);
    if (contactAt === undefined && t >= CONTACT_SECONDS) { contactAt = real; t -= clock.stop(stop, t - CONTACT_SECONDS); }
    poses.push({ real, t });
  }
  const contactPoses = poses.filter(p => Math.abs(p.t - CONTACT_SECONDS) < 1e-9);
  if (contactPoses.length) { heldFrom = contactPoses[0].real; heldUntil = contactPoses.at(-1).real; }
  return { done: real, contactAt, heldFrom, heldUntil, poses };
}

test('a hit-stop holds the contact pose and the action grows by exactly the stop', () => {
  for (const frame of [1 / 144, 1 / 60, 1 / 30, .25]) for (const stop of [0, .055, .09, .18]) {
    const plain = play(0, frame), held = play(stop, frame);
    // The action still ends, a stop later (within the frame it lands in).
    assert.ok(Math.abs(held.done - plain.done - stop) <= frame + 1e-9, `${frame} ${stop}: ${held.done} vs ${plain.done}`);
    // Contact still lands on time: hit-stop only starts there.
    assert.equal(held.contactAt, plain.contactAt);
    // Smooth frames show the contact pose itself for the whole stop (each pose stays up a frame).
    if (stop > frame) assert.ok(held.heldUntil - held.heldFrom + frame >= stop - frame - 1e-9, `${frame} ${stop}`);
    // The fight's clock never runs backwards past contact nor skips the end.
    assert.ok(held.poses.every(p => p.t <= ACTION_SECONDS + frame));
  }
});

test('a cleared clock holds nothing', () => {
  const clock = new FightClock();
  clock.stop(.1, 0); clock.clear();
  assert.equal(clock.advance(1 / 60), 1 / 60);
});

test('heavier blows hold longer and fringe harder; guarded and swallowed ones barely', () => {
  const plain = landing({ share: .25 }), big = landing({ share: .9 });
  const skill = landing({ share: .4, skill: true }), ko = landing({ share: .3, ko: true });
  const guarded = landing({ share: .25, guarded: true }), swallowed = landing({ share: 0, swallowed: true });
  const beat = landing({ share: .8, beat: true }), skillKo = landing({ share: .9, skill: true, ko: true });
  // Plain blows hold roughly 50–90 ms.
  for (const l of [landing({ share: 0 }), plain, big]) assert.ok(l.stop >= .05 && l.stop <= .09, String(l.stop));
  assert.ok(big.stop > plain.stop && skill.stop > big.stop && ko.stop > plain.stop);
  assert.ok(guarded.stop < plain.stop && guarded.stop < .05);
  assert.ok(swallowed.stop < plain.stop && swallowed.fringe === 0 && swallowed.punch === 0);
  assert.ok(beat.stop >= HIT.stop.beat && beat.fringe > .9);
  assert.ok(skillKo.stop <= HIT.stop.max);
  // A light plain blow does not fringe; skills, knockouts and the beat do, and only they bloom.
  assert.equal(landing({ share: .05 }).fringe, 0);
  assert.equal(guarded.fringe, 0);
  assert.ok(skill.fringe > plain.fringe && ko.fringe > plain.fringe);
  assert.equal(plain.bloom, 0);
  assert.ok(skill.bloom > 0 && ko.bloom > 0 && beat.bloom > 0);
  assert.ok(skillKo.punch > 0 && plain.punch === 0 && guarded.kick < plain.kick);
  for (const l of [plain, big, skill, ko, guarded, swallowed, beat, skillKo]) for (const v of [l.fringe, l.bloom, l.weight]) assert.ok(v >= 0 && v <= 1);
});

test('the camera lurch springs back with one small overshoot and settles', () => {
  const s = { x: .1, v: 0 };
  let lowest = 0;
  for (let i = 0; i < 30; i++) { spring(s, 1 / 60, HIT.spring.omega, HIT.spring.zeta); lowest = Math.min(lowest, s.x); }
  assert.ok(lowest < 0 && lowest > -.04, String(lowest));
  assert.ok(Math.abs(s.x) < .002);
  // A slow frame (the 0.25 s show step) stays stable.
  const slow = { x: .1, v: 0 }; spring(slow, .25, HIT.spring.omega, HIT.spring.zeta);
  assert.ok(Math.abs(slow.x) < .02);
});

test('slow motion stretches the fight by its scale, eases back to full speed and stacks with a hit-stop', () => {
  const clock = new FightClock(), frame = 1 / 60;
  clock.slow(.35, 1, .25);
  // While it holds, a real second is a third of a fight second.
  let fight = 0;
  for (let real = 0; real < 1 - 1e-9; real += frame) fight += clock.advance(frame);
  assert.ok(Math.abs(fight - .35) < .02, String(fight));
  // Then it eases back over a quarter of a second, and runs at full speed after that.
  let easing = 0;
  for (let real = 0; real < .25 - 1e-9; real += frame) easing += clock.advance(frame);
  assert.ok(easing > .25 * .35 && easing < .25, String(easing));
  assert.equal(clock.scale, 1);
  assert.equal(clock.advance(frame), frame);
  // A hit-stop holds first, and what is left runs slow; two slow motions multiply; scale 1 ends one.
  clock.slow(.5, 1); clock.stop(frame / 2, 0);
  assert.ok(Math.abs(clock.advance(frame) - frame / 4) < 1e-9);
  clock.slow(.5, 1, 0, 'scene');
  assert.ok(Math.abs(clock.scale - .25) < 1e-9);
  clock.slow(1, 1, 0, 'scene');
  assert.ok(Math.abs(clock.scale - .5) < 1e-9);
  // Clearing a fight's hit-stop keeps the slow motion; clearing it at its end does not.
  clock.clear(); assert.ok(clock.scale < 1);
  clock.clear(true); assert.equal(clock.scale, 1);
});
