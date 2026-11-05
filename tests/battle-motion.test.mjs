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
test('the tempo: a short breath between actors, and time to read whatever an action changed', async () => {
  const { BEAT, holdAfter, surge } = await import('../src/battle-motion.ts');
  assert.equal(holdAfter({}), BEAT.breath, 'a plain blow: only a breath before the next one moves');
  assert.equal(holdAfter({ burn: { id: 'quemado', level: 1 } }), BEAT.status, 'a fire lit is read before anyone moves');
  assert.equal(holdAfter({ status: { id: 'sangrado', stacks: 2 } }), BEAT.status);
  assert.equal(holdAfter({ hits: [{}, { status: { id: 'sangrado', stacks: 1 } }] }), BEAT.status);
  assert.equal(holdAfter({ stats: [{ target: 'gerard', way: 'down', stats: ['fuerza'] }] }), BEAT.stats, 'stats falling get the longest look');
  assert.equal(holdAfter({}, true), BEAT.down);
  assert.ok(BEAT.breath < BEAT.peel && BEAT.peel < BEAT.status && BEAT.status < BEAT.stats, 'quick, but each change has its moment');
  // Into a fight things gather speed: slow off the mark, fastest in the middle.
  assert.equal(surge(0), 0); assert.equal(surge(1), 1);
  assert.ok(surge(.25) - surge(0) < surge(.5) - surge(.25), 'it accelerates');
});
test('a dual gets its moment, and so does a foe\'s ability that is not a plain blow, or one announced a turn ahead', async () => {
  const { BEAT, holdAfter, DUAL_SLOW, DUAL_BANNER, DUAL_BANNER_SEEN, DUAL_CLOCK, DUAL_SECONDS } = await import('../src/battle-motion.ts');
  assert.equal(holdAfter({ dual: { id: 'zarpazos-de-fuego' } }), BEAT.dual);
  assert.equal(holdAfter({ dual: { id: 'zarpazos-de-fuego' } }, false, true), BEAT.dualSeen, 'shorter once seen');
  assert.ok(BEAT.dualSeen < BEAT.dual);
  assert.equal(holdAfter({ ability: { id: 'aplaston', card: true } }), BEAT.ability);
  assert.equal(holdAfter({ ability: { id: 'pisoton' } }), BEAT.breath, 'a plain blow only names itself');
  assert.equal(holdAfter({ telegraph: { id: 'carrerilla' } }), BEAT.ability);
  assert.ok(DUAL_SLOW > 0 && DUAL_SLOW < 1 && DUAL_BANNER_SEEN < DUAL_BANNER && DUAL_SECONDS < DUAL_CLOCK);
  assert.ok(BEAT.queue < BEAT.ability && BEAT.ability < BEAT.dual);
});
