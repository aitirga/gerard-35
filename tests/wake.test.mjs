import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as pc from 'playcanvas';
import { MERIDIANA_BED, WAKE_SECONDS, wakePhase, wakePose } from '../src/bed.ts';
import { PLACES } from '../src/chapter-1.ts';
import { createGroundContact } from '../src/ground-contact.ts';

const floor = .025;
const epsilon = 1e-6;
const near = (a, b) => assert.ok(Math.abs(a - b) < epsilon, `${a} != ${b}`);
const people = Object.keys(MERIDIANA_BED.sleepers);
const bedBounds = {
  minX: MERIDIANA_BED.x - MERIDIANA_BED.width / 2,
  maxX: MERIDIANA_BED.x + MERIDIANA_BED.width / 2,
  minZ: MERIDIANA_BED.z - MERIDIANA_BED.length / 2,
  maxZ: MERIDIANA_BED.z + MERIDIANA_BED.length / 2,
};

// Use PlayCanvas's actual transform hierarchy and the character files, without creating an
// application or rendering meshes. The shoe boxes are the same ones used by ground contact.
function character(who) {
  const file = who === 'gerard' ? 'gerard-adult' : 'aitor';
  const spec = JSON.parse(readFileSync(new URL(`../src/characters/${file}.json`, import.meta.url), 'utf8'));
  const node = (name, parent, position) => {
    const result = new pc.GraphNode(name);
    result.setLocalPosition(...position);
    parent?.addChild(result);
    return result;
  };
  const root = node(who, undefined, [0, 0, 0]);
  const scale = MERIDIANA_BED.sleepers[who].scale;
  root.setLocalScale(scale, scale, scale);
  const body = node('body', root, [0, 0, 0]);
  const head = node('head', body, spec.rig.head);
  head.setLocalScale(...spec.rig.headScale);
  const limbs = [-1, 1].flatMap(side => ['leg', 'arm'].map(kind => {
    const [x, y, z] = spec.rig[kind];
    return node(kind, body, [x * side, y, z]);
  }));
  const parts = [];
  for (const part of spec.parts.filter(part => part.shape !== 'ring')) {
    const limb = part.attach === 'leg' || part.attach === 'arm';
    for (const side of limb || part.mirror ? [-1, 1] : [1]) {
      const parent = part.attach === 'body' ? body : part.attach === 'head' ? head : limbs[(side < 0 ? 0 : 2) + (part.attach === 'arm' ? 1 : 0)];
      const [x, y, z] = part.position;
      const mesh = node(part.name, parent, [x * side, y, z]);
      mesh.setLocalScale(...part.scale);
      const [rx, ry, rz] = part.rotation ?? [0, 0, 0];
      mesh.setLocalEulerAngles(rx, ry * side, rz * side);
      parts.push(mesh);
    }
  }
  const shoes = parts.filter(part => part.name === 'Zapatilla');
  const plant = createGroundContact(root, shoes);
  return {
    root, parts, shoes,
    apply(seconds) {
      const pose = wakePose(who, seconds);
      root.setLocalEulerAngles(pose.pitch, 0, 0);
      root.setPosition(pose.x, pose.y, pose.z);
      body.setLocalEulerAngles(0, pose.yaw, 0);
      const stride = pose.walking ? Math.sin((seconds - 3.55) * Math.PI * 8) * 22 : 0;
      limbs.forEach((limb, i) => limb.setLocalEulerAngles(i % 2 === 0 ? pose.leg + stride * (i === 0 ? 1 : -1) : stride * (i === 1 ? -1 : 1) * .8, 0, 0));
      if (pose.grounded) plant(() => floor);
      return pose;
    },
  };
}

function corners(part) {
  const transform = part.getWorldTransform();
  return [-.5, .5].flatMap(x => [-.5, .5].flatMap(y => [-.5, .5].map(z => transform.transformPoint(new pc.Vec3(x, y, z)))));
}
function bounds(parts) {
  const points = parts.flatMap(corners);
  return {
    minX: Math.min(...points.map(p => p.x)), maxX: Math.max(...points.map(p => p.x)),
    minY: Math.min(...points.map(p => p.y)), maxY: Math.max(...points.map(p => p.y)),
    minZ: Math.min(...points.map(p => p.z)), maxZ: Math.max(...points.map(p => p.z)),
  };
}

test('both start asleep and Gerard wakes before Aitor', () => {
  assert.equal(wakePhase(0), 'asleep');
  for (const who of people) {
    const pose = wakePose(who, 0);
    assert.equal(pose.eyes, 0);
    assert.equal(pose.pitch, 90);
    assert.equal(pose.walking, false);
    assert.deepEqual(wakePose(who, .8), pose, 'the sleeping pose stays still');
  }
  assert.equal(wakePose('gerard', 1.2).eyes, 1);
  assert.ok(wakePose('gerard', 1.2).pitch < 90);
  assert.equal(wakePose('aitor', 1.2).eyes, 0);
  assert.equal(wakePose('aitor', 1.2).pitch, 90);
  assert.equal(wakePose('aitor', 1.8).eyes, 1);
});

test('sleeping bodies fit on the mattress with their heads on the south pillows', () => {
  const sleeping = {};
  for (const who of people) {
    const model = character(who);
    model.apply(0);
    const body = bounds(model.parts);
    sleeping[who] = body;
    assert.ok(body.minX >= bedBounds.minX - epsilon, `${who} extends beyond the west mattress edge`);
    assert.ok(body.maxX <= bedBounds.maxX + epsilon, `${who} extends beyond the east mattress edge`);
    assert.ok(body.minZ >= bedBounds.minZ - epsilon, `${who} extends beyond the foot`);
    assert.ok(body.maxZ <= MERIDIANA_BED.headZ + epsilon, `${who} extends into the headboard`);
    assert.ok(body.minY >= .6 - epsilon, `${who} sinks through the mattress`);
    const head = model.parts.find(part => part.name === 'Cabeza').getPosition();
    assert.ok(Math.abs(head.z - (MERIDIANA_BED.headZ - .3)) < .2, `${who}'s head misses the pillow`);
    near(head.x, MERIDIANA_BED.sleepers[who].rest.x);
  }
  assert.ok(sleeping.aitor.maxX < sleeping.gerard.minX, 'the two sleepers do not intersect');
});

test('shoes stay above the duvet over the mattress, then lower to the floor beyond the side', () => {
  for (const who of people) {
    const model = character(who);
    for (let frame = 0; frame <= WAKE_SECONDS * 120; frame++) {
      const seconds = frame / 120;
      const pose = model.apply(seconds);
      const feet = bounds(model.shoes);
      assert.ok(feet.minY >= floor - epsilon, `${who}'s shoes cross the floor at ${seconds}s (${feet.minY})`);
      for (const shoe of model.shoes) {
        const foot = bounds([shoe]);
        const overMattress = foot.minX < bedBounds.maxX && foot.maxX > bedBounds.minX
          && foot.minZ < bedBounds.maxZ && foot.maxZ > bedBounds.minZ;
        if (overMattress) assert.ok(foot.minY >= MERIDIANA_BED.duvetTop - epsilon,
          `${who}'s shoes enter the duvet at ${seconds}s (${foot.minY})`);
      }
      if (pose.y < MERIDIANA_BED.sleepers[who].height - .48 * MERIDIANA_BED.sleepers[who].scale - epsilon) {
        near(pose.x, MERIDIANA_BED.sleepers[who].side.x);
      }
      if (pose.grounded) near(feet.minY, floor + .002);
    }
  }
});

test('both finish upright at the existing morning destinations with feet planted', () => {
  for (const [who, destination] of [['gerard', PLACES.wakeUp.cell], ['aitor', PLACES.aitor.cell]]) {
    const model = character(who);
    const pose = model.apply(WAKE_SECONDS);
    near(pose.x, destination.x);
    near(pose.z, destination.z);
    assert.equal(pose.pitch, 0);
    near(pose.leg, 0);
    assert.equal(pose.eyes, 1);
    assert.equal(pose.walking, false);
    assert.equal(pose.grounded, true);
    near(bounds(model.shoes).minY, floor + .002);
    assert.deepEqual(wakePose(who, WAKE_SECONDS + 2), pose, 'the final pose remains stable');
  }
});

test('rendering at different frame rates or revisiting a timestamp gives the same absolute pose', () => {
  for (const who of people) for (const seconds of [0, 1.2, 2, 2.6, 3.2, 4, WAKE_SECONDS]) {
    const reference = character(who);
    reference.apply(seconds);
    const expected = bounds(reference.parts);
    for (const fps of [15, 30, 60, 144]) {
      const model = character(who);
      for (let frame = 0; frame / fps < seconds; frame++) model.apply(frame / fps);
      model.apply(seconds);
      for (const [axis, value] of Object.entries(bounds(model.parts))) near(value, expected[axis]);
      model.apply(WAKE_SECONDS);
      model.apply(seconds);
      for (const [axis, value] of Object.entries(bounds(model.parts))) near(value, expected[axis]);
    }
  }
});
