import test from 'node:test';
import assert from 'node:assert/strict';
import { ACTION_SECONDS, CONTACT_SECONDS, contactMotion } from '../src/battle-motion.ts';

test('contact reaches the selected target on either side and returns home', () => {
  for (const [from, target] of [
    [{x:-2.2,z:.6},{x:2.2,z:-.6}],
    [{x:2.2,z:-.6},{x:-2.2,z:2.5}],
  ]) {
    const start = contactMotion(from, target, 0);
    assert.equal(start.x, from.x); assert.equal(start.z, from.z);
    const hit = contactMotion(from, target, CONTACT_SECONDS);
    assert.ok(Math.abs(Math.hypot(hit.x-target.x, hit.z-target.z)-1.65)<1e-8);
    const end = contactMotion(from, target, ACTION_SECONDS);
    assert.equal(end.x, from.x); assert.equal(end.z, from.z);
  }
});
test('reaction starts at contact and the attacker never crosses through the target', () => {
  const from = {x:0,z:0}, target = {x:4,z:3};
  for (let t=0;t<ACTION_SECONDS;t+=.005) {
    const frame = contactMotion(from,target,t);
    assert.ok(Math.hypot(frame.x-target.x,frame.z-target.z)>=1.65-1e-8);
    if (t<CONTACT_SECONDS) assert.equal(frame.recoil,0);
  }
  assert.ok(contactMotion(from,target,CONTACT_SECONDS+.12).recoil>0);
});
test('overlapping and already-close positions stay finite without lunging through each other', () => {
  for (const target of [{x:0,z:0},{x:.4,z:.2}]) {
    const frame = contactMotion({x:0,z:0}, target, CONTACT_SECONDS);
    assert.equal(frame.x,0); assert.equal(frame.z,0);
  }
});
