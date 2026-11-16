import test from 'node:test';
import assert from 'node:assert/strict';
import { PATROLS, SECTION, STAKES, beat, below, boreholes, calibration, createModelo, descend, enter, leave, measure, measured, roaming, shake, stakeAction, stakeAt, stakesIn, tick } from '../src/modelo.ts';
import { MODELO_ENCOUNTERS } from '../src/battle.ts';

/** Runs the section for `seconds` in small steps with the party standing at `x`; returns the first patrol to reach it. */
const run = (s, seconds, x, dt = .05) => { for (let t = 0; t < seconds; t += dt) { const hit = tick(s, dt, x); if (hit) return hit; } };

test('the section has three zones of three stakes, fewer piezometers than stakes, and fights the game knows', () => {
  for (const zone of ['suelo', 'gravas', 'ciudad']) {
    assert.equal(stakesIn(zone).length, 3, zone);
    assert.ok(SECTION.piezometers < stakesIn(zone).length);
    assert.ok(PATROLS.some(p => p.zone === zone), zone);
  }
  assert.equal(stakesIn('fondo').length, 0);
  for (const p of PATROLS) assert.ok(MODELO_ENCOUNTERS.includes(p.encounter), p.id);
  // No stake stands right under another: each way down lands on ground still to measure.
  for (const a of STAKES) for (const b of STAKES) if (below(a.zone) === b.zone) assert.ok(Math.abs(a.x - b.x) > SECTION.safe, `${a.id} over ${b.id}`);
  assert.deepEqual([below('suelo'), below('gravas'), below('ciudad'), below('fondo')], ['gravas', 'ciudad', 'fondo', undefined]);
});

test('Medir spends a piezometer, makes a borehole and the ground round it real', () => {
  const s = createModelo();
  assert.equal(stakeAt(s, 7.5)?.id, 'suelo-1'); assert.equal(stakeAt(s, 12), undefined);
  assert.equal(stakeAction(s, 'suelo-1'), 'medir');
  assert.ok(!measured(s, 'suelo', 7));
  assert.ok(measure(s, 'suelo-1'));
  assert.equal(s.piezometers, SECTION.piezometers - 1);
  assert.ok(measured(s, 'suelo', 7 + SECTION.safe)); assert.ok(!measured(s, 'suelo', 7 + SECTION.safe + .5));
  assert.ok(!measured(s, 'gravas', 7), 'only its own zone');
  assert.equal(stakeAction(s, 'suelo-1'), 'entrar');
  assert.equal(measure(s, 'suelo-1'), false, 'not twice');
  assert.equal(measure(s, 'gravas-1'), false, 'not from another zone');
  assert.ok(measure(s, 'suelo-2'));
  assert.equal(stakeAction(s, 'suelo-3'), undefined, 'none left for the third');
  assert.equal(measure(s, 'suelo-3'), false);
});

test('a patrol walks its stretch, turns at its ends and never steps on measured ground', () => {
  const s = createModelo(), spec = PATROLS.find(p => p.id === 'celdas-1');
  measure(s, 'suelo-1');
  // The party far away on measured ground: nothing sees it.
  let low = Infinity, high = -Infinity;
  for (let t = 0; t < 60; t += .05) {
    assert.equal(tick(s, .05, 7), undefined);
    const x = s.patrols['celdas-1'].x;
    low = Math.min(low, x); high = Math.max(high, x);
    assert.ok(!measured(s, 'suelo', x) || Math.abs(Math.abs(x - 7) - SECTION.safe) < 1e-6, `at ${x}`);
  }
  assert.ok(Math.abs(low - (7 + SECTION.safe)) < 1e-6, `turns at the edge of the measured ground, ${low}`);
  assert.ok(Math.abs(high - spec.to) < 1e-6, `and at the end of its stretch, ${high}`);
});

test('a patrol that sees the party comes for it and its fight starts; measured ground and a borehole stop it', () => {
  const open = createModelo();
  const hit = run(open, 20, 11);
  assert.equal(hit?.id, 'celdas-1'); assert.equal(hit.encounter, 'modelo-celdas');
  // On measured ground it is not seen: the patrol keeps to its walk and stays out.
  const safe = createModelo();
  measure(safe, 'suelo-1');
  assert.equal(run(safe, 40, 8), undefined);
  // Inside the borehole, the same.
  const hidden = createModelo();
  measure(hidden, 'suelo-2');
  assert.ok(enter(hidden, 'suelo-2'));
  assert.equal(stakeAction(hidden, 'suelo-2'), undefined, 'nothing to do at a stake from inside');
  assert.equal(run(hidden, 40, 19), undefined);
  assert.equal(leave(hidden), 19); assert.equal(hidden.inside, undefined);
});

test('measuring under a patrol puts it at the edge of the new ground', () => {
  const s = createModelo();
  s.patrols['celdas-1'].x = 8;
  measure(s, 'suelo-1');
  assert.ok(Math.abs(s.patrols['celdas-1'].x - (7 + SECTION.safe)) < .1);
  assert.ok(!measured(s, 'suelo', s.patrols['celdas-1'].x));
});

test('a patrol beaten is gone, and one run from stands still a while', () => {
  const s = createModelo();
  shake(s, 'celdas-1');
  assert.equal(run(s, SECTION.rest - .5, s.patrols['celdas-1'].x + 1), undefined, 'resting, it reaches nobody');
  assert.ok(run(s, 10, s.patrols['celdas-1'].x + 1), 'then it does');
  beat(s, 'celdas-1');
  assert.deepEqual(roaming(s).map(p => p.id), ['celdas-2']);
  assert.deepEqual(s.beaten, ['celdas-1']);
});

test('a borehole is the way down: out at the same place a zone below, with new piezometers', () => {
  const s = createModelo();
  assert.equal(descend(s), undefined, 'not from the open');
  measure(s, 'suelo-2'); enter(s, 'suelo-2');
  assert.deepEqual(descend(s), { zone: 'gravas', x: 19 });
  assert.equal(s.zone, 'gravas'); assert.equal(s.inside, undefined);
  assert.equal(s.piezometers, 2 * SECTION.piezometers - 1);
  assert.ok(!measured(s, 'gravas', 19), 'it lands on ground still to measure');
  assert.deepEqual(roaming(s).map(p => p.id), ['oscilacion-1', 'oscilacion-2']);
  measure(s, 'gravas-2'); enter(s, 'gravas-2'); descend(s);
  measure(s, 'ciudad-1'); enter(s, 'ciudad-1');
  const before = s.piezometers;
  assert.deepEqual(descend(s), { zone: 'fondo', x: 8 });
  assert.equal(s.piezometers, before, 'none at the bottom');
});

test('every piezometer beyond the one a zone needs calibrates the model', () => {
  const s = createModelo();
  assert.equal(calibration(s), 0);
  measure(s, 'suelo-1'); assert.equal(calibration(s), 0);
  measure(s, 'suelo-2'); assert.equal(calibration(s), 1);
  assert.equal(boreholes(s, 'suelo').length, 2);
  enter(s, 'suelo-2'); descend(s);
  measure(s, 'gravas-1'); measure(s, 'gravas-2');
  assert.equal(calibration(s), 2);
  assert.equal(measure(s, 'gravas-3'), false, 'two for each zone, never the third');
});
