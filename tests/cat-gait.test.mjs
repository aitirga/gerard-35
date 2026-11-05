import test from 'node:test';
import assert from 'node:assert/strict';
import { CAT_LEGS, CAT_RIG, CatGait, GAITS, pawOf, solveLeg } from '../src/cat-gait.ts';

const DT = 1 / 60;
/** Runs a cat for `seconds` at `speed` world units per second (scale 1.35, as in the game); calls `each` with every pose. */
function run(gait, seconds, speed, each = () => {}, action = {}, start = { x: 0, t: 0 }) {
  let x = start.x, pose;
  for (let i = 0; i < Math.round(seconds / DT); i++) {
    x += speed * DT;
    pose = gait.update(DT, { x: 0, z: x, facing: 0, scale: 1.35, ...action });
    each(pose, x);
  }
  return { pose, x };
}

test('the two-bone solver puts the paw exactly where it is asked, both ways of bending', () => {
  const [a, b] = CAT_RIG.bones.lh;
  for (const bend of [1, -1]) for (const [z, y] of [[0, -.14], [.05, -.12], [-.06, -.1], [.02, -.07]]) {
    const { hip, knee } = solveLeg(z, y, bend, a, b);
    const pz = Math.sin(hip) * a + Math.sin(hip + knee) * b;
    const py = -Math.cos(hip) * a - Math.cos(hip + knee) * b;
    assert.ok(Math.hypot(pz - z, py - y) < 1e-6, `${bend} ${z} ${y}`);
    // The middle joint bends the way the leg does: the foreleg's wrist forward, the hock back.
    assert.ok(Math.sign(-knee) === bend || Math.abs(knee) < 1e-6);
  }
});

test('standing still, all four paws rest on the ground under their joints', () => {
  const gait = new CatGait();
  const { pose } = run(gait, 2, 0);
  for (const leg of CAT_LEGS) {
    const paw = pawOf(pose, leg);
    assert.ok(Math.abs(paw.y) < 1e-4, `${leg} on the ground (${paw.y})`);
    assert.ok(Math.abs(paw.z - CAT_RIG.joints[leg].z) < .01, `${leg} under its joint`);
  }
  assert.equal(pose.moving < .01, true);
});

test('each gait keeps a weight-bearing paw still on the ground: no sliding, no sinking', () => {
  // Strolling at home (0.75 cells/s), following a walk (5.2) and a run (7.8).
  for (const speed of [.5, .75, 2, 5.2, 7.8]) {
    const gait = new CatGait(1);
    const warm = run(gait, 2, speed);
    const planted = new Map();
    let worst = 0, lowest = 0, steps = 0;
    run(gait, 3, speed, (pose, x) => {
      for (const leg of CAT_LEGS) {
        const paw = pawOf(pose, leg);
        lowest = Math.min(lowest, paw.y);
        // The paw's place in the world: the cat's position plus its offset, scaled.
        const world = x + paw.z * 1.35;
        if (!pose.targets[leg].stance) { planted.delete(leg); continue; }
        if (!planted.has(leg)) { planted.set(leg, world); steps++; continue; }
        worst = Math.max(worst, Math.abs(world - planted.get(leg)));
      }
    }, {}, { x: warm.x });
    assert.ok(steps > 4, `${speed}: it steps`);
    assert.ok(lowest > -1e-3, `${speed}: no paw sinks (${lowest})`);
    // A planted paw drifts less than a millimetre of the cat (it would be the stride otherwise).
    assert.ok(worst < .004, `${speed}: planted paws stay put (${worst.toFixed(4)})`);
  }
});

test('slow is a walk in lateral sequence, then a trot in diagonal pairs, then a gallop', () => {
  const at = speed => { const gait = new CatGait(); return run(gait, 2, speed).pose; };
  assert.equal(at(.6).gait, 'walk');
  assert.equal(at(1.8).gait, 'trot');
  assert.equal(at(5.2).gait, 'gallop');
  // Walk: left hind, left fore, right hind, right fore, a quarter apart.
  const w = GAITS.walk.offsets;
  assert.deepEqual([w.lh, w.lf, w.rh, w.rf], [0, .25, .5, .75]);
  // Trot: diagonal pairs move together, the two pairs half a cycle apart.
  const t = GAITS.trot.offsets;
  assert.equal(t.lf, t.rh); assert.equal(t.rf, t.lh); assert.equal(Math.abs(t.lf - t.rf), .5);
  // Faster cats cycle their legs faster, never past what the legs can reach.
  assert.ok(at(1.1).period > at(1.8).period);
  for (const speed of [.3, 1.1, 5.2, 7.8]) {
    const gait = new CatGait();
    run(gait, 2, speed, pose => {
      for (const leg of CAT_LEGS) assert.ok(Math.abs(pose.targets[leg].z - CAT_RIG.joints[leg].z) <= GAITS.gallop.maxStride / 2 + .03);
    });
  }
});

test('a cat right at the edge between two gaits does not flicker between them', () => {
  const gait = new CatGait();
  const seen = [];
  run(gait, 4, 1.35 * 1, pose => { if (seen.at(-1) !== pose.gait) seen.push(pose.gait); });
  assert.ok(seen.length <= 2, seen.join(' → '));
});

test('starting, stopping and changing gait never snap a joint', () => {
  /** The largest turn of a joint between two frames, and the largest change of that turn (a snap). */
  const watch = legs => {
    const gait = new CatGait(3);
    let x = 0, a, b, step = 0, snap = 0;
    for (const [seconds, speed] of legs) x = run(gait, seconds, speed, pose => {
      for (const leg of CAT_LEGS) for (const k of ['hip', 'knee']) {
        assert.ok(Number.isFinite(pose.legs[leg][k]));
        if (a) step = Math.max(step, Math.abs(pose.legs[leg][k] - a.legs[leg][k]));
        if (a && b) snap = Math.max(snap, Math.abs(pose.legs[leg][k] - 2 * a.legs[leg][k] + b.legs[leg][k]));
      }
      b = a; a = structuredClone(pose);
    }, {}, { x }).x;
    return { step, snap };
  };
  // Where the legs read best (standing, strolling, trotting and back), nothing jerks.
  const calm = watch([[1, 0], [1.5, .75], [1.5, 2], [1, .75], [1.5, 0]]);
  assert.ok(calm.snap < 30, `walk and trot: largest snap ${calm.snap.toFixed(1)}°`);
  // A gallop cycles in a fifth of a second, a paw on the ground for three frames: quick, never wild.
  const fast = watch([[1, 2], [1.5, 5.2], [1.5, 7.8], [1, 2], [1.5, 0]]);
  assert.ok(fast.step < 80, `gallop: largest step ${fast.step.toFixed(1)}°`);
});

test('sitting puts the rear down and keeps every paw on the ground; crouching and fear go low', () => {
  const gait = new CatGait();
  const { pose: sitting } = run(gait, 2, 0, () => {}, { sit: 1 });
  assert.ok(sitting.body.pitch > 25, 'nose up');
  assert.ok(sitting.body.y < .16, 'rear down');
  for (const leg of CAT_LEGS) {
    const paw = pawOf(sitting, leg);
    assert.ok(Math.abs(paw.y) < 2e-3 && paw.y > -1e-3, `${leg} on the ground (${paw.y.toFixed(4)})`);
  }
  const low = run(new CatGait(), 2, 0, () => {}, { fear: 1 }).pose;
  assert.ok(low.body.y < .14, 'pressed to the floor');
  assert.ok(low.ears.every(a => a > 40), 'ears flat');
  assert.ok(low.tail[0].pitch < -150, 'tail tucked');
  for (const leg of CAT_LEGS) assert.ok(Math.abs(pawOf(low, leg).y) < 2e-3, `${leg} on the ground`);
});

test('the tail rides high walking, the ears flick and the eyes blink on their own', () => {
  const standing = run(new CatGait(), 2, 0).pose, walking = run(new CatGait(), 2, .6).pose;
  assert.ok(walking.tail[0].pitch > standing.tail[0].pitch + 40, 'tail up walking');
  const gait = new CatGait(5);
  let blinked = false, flicked = false;
  run(gait, 20, 0, pose => { blinked ||= pose.blink < .5; flicked ||= pose.ears.some(a => a > 10); });
  assert.ok(blinked && flicked);
});

test('in the air the legs stretch out, and a frozen or reduced-motion cat stands still', () => {
  const gait = new CatGait();
  run(gait, 1, 0);
  const air = gait.update(DT, { x: 0, z: 0, facing: 0, scale: 1.35, leap: .5 });
  assert.ok(air.legs.lf.hip > 40 && air.legs.lh.hip < -40);
  const still = new CatGait();
  const a = run(still, 1, 1.1, () => {}, { animate: false }).pose;
  const b = still.update(DT, { x: 0, z: 10, facing: 0, scale: 1.35, animate: false });
  assert.deepEqual(a, b);
  for (const leg of CAT_LEGS) assert.ok(Math.abs(pawOf(a, leg).y) < 1e-4);
});
