import test from 'node:test';
import assert from 'node:assert/strict';
import { createDayLog } from '../src/day-log.ts';

/** A log with a clock and a time the test moves by hand, and what it sent. */
function setup() {
  const clock = { epoch: 0, day: 1, hour: 8 };
  let time = 0;
  const sent = [];
  const log = createDayLog(() => clock, async events => { sent.push(...events); return true; }, () => time);
  return { log, clock, sent, wait: seconds => { time += seconds * 1000; } };
}

test('time in a place counts only while the page is shown, and is sent on leaving', async () => {
  const { log, sent, wait } = setup();
  log.enter('meridiana');
  wait(30);
  log.visible(false);
  wait(600);
  log.visible(true);
  wait(10);
  log.enter('sants');
  await log.flush();
  assert.deepEqual(sent.map(e => [e.kind, e.place, e.seconds]), [['place', 'meridiana', 30], ['place', 'meridiana', 10]]);
});

test('a new day closes the time spent on the day before, and flags keep the day they were won on', async () => {
  const { log, clock, sent, wait } = setup();
  log.enter('meridiana');
  wait(20);
  const before = log.stamp();
  clock.day = 2; clock.hour = 8;
  log.add({ kind: 'flag', flag: 'luz-luca' }, before);
  log.tick();
  wait(5);
  log.enter('el-nucli');
  await log.flush();
  assert.deepEqual(sent.map(e => [e.kind, e.day]), [['place', 1], ['flag', 1], ['place', 2]]);
  assert.equal(sent[0].seconds, 20);
});

test('what cannot be sent waits for the next try', async () => {
  let up = false;
  const sent = [];
  const log = createDayLog(() => ({ epoch: 0, day: 1, hour: 9 }), async events => { if (!up) throw new Error('offline'); sent.push(...events); return true; });
  log.add({ kind: 'ride', start: 'fabra-i-puig', to: 'sagrada-familia' });
  await log.flush();
  assert.equal(log.waiting.length, 1);
  up = true;
  await log.flush();
  assert.equal(log.waiting.length, 0);
  assert.deepEqual(sent.map(e => [e.kind, e.start, e.to, e.hour]), [['ride', 'fabra-i-puig', 'sagrada-familia', 9]]);
});
