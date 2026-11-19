import test from 'node:test';
import assert from 'node:assert/strict';
import { GALLERY, PATROLS, SECTION, STAKES, WELLS, ZONE_IDS, arrival, atWell, beat, below, calibration, charged, createModelo, descend, energy, measure, patrolsIn, roaming, shake, stakeVerb, stakesIn, tick } from '../src/modelo.ts';
import { MODELO_ENCOUNTERS } from '../src/battle.ts';

/** Runs the section for `seconds` in small steps with the party standing at `x`; returns the first patrol to reach it. */
const run = (s, seconds, x, dt = .05) => { for (let t = 0; t < seconds; t += dt) { const hit = tick(s, dt, x); if (hit) return hit; } };

test('three zones and the bottom: each zone with its patrols, one stake and a well at the far end, the sides alternating', () => {
  assert.deepEqual([below('suelo'), below('gravas'), below('ciudad'), below('fondo')], ['gravas', 'ciudad', 'fondo', undefined]);
  for (const zone of ['suelo', 'gravas', 'ciudad']) {
    assert.equal(patrolsIn(zone).length, 2, zone);
    assert.equal(stakesIn(zone).length, 1, zone);
    // The well is at the other end from where the party comes in: the whole zone is crossed.
    assert.ok(Math.abs(WELLS[zone] - arrival(zone)) > SECTION.length * .7, zone);
    for (const p of patrolsIn(zone)) assert.ok(Math.min(p.from, p.to) > Math.min(arrival(zone), WELLS[zone]) && Math.max(p.from, p.to) < Math.max(arrival(zone), WELLS[zone]), `${p.id} walks between the way in and the well`);
  }
  assert.equal(stakesIn('fondo').length, 0);
  assert.deepEqual(ZONE_IDS.map(arrival), [SECTION.landing, WELLS.suelo, WELLS.gravas, WELLS.ciudad]);
  for (const p of PATROLS) assert.ok(MODELO_ENCOUNTERS.includes(p.encounter), p.id);
  // At the bottom the boss is half the gallery away from the lift that brings them down.
  assert.ok(Math.abs(GALLERY.boss - arrival('fondo')) - GALLERY.bossReach > 8);
});

test('the lift has no power until one of its zone\'s patrols is beaten; then it goes down to the same place a zone below', () => {
  const s = createModelo();
  assert.ok(!charged(s)); assert.equal(energy(s), 0);
  assert.equal(descend(s), undefined, 'no power, no lift');
  assert.equal(s.zone, 'suelo');
  // A patrol of another zone puts nothing in this one's lift.
  beat(s, 'pluma-2');
  assert.ok(!charged(s));
  beat(s, 'celdas-2');
  assert.ok(charged(s)); assert.equal(energy(s), 1);
  assert.ok(atWell(s, WELLS.suelo) && !atWell(s, WELLS.suelo - 3));
  assert.deepEqual(descend(s), { zone: 'gravas', x: WELLS.suelo });
  assert.ok(!charged(s), 'each lift needs its own');
  beat(s, 'oscilacion-2'); assert.deepEqual(descend(s), { zone: 'ciudad', x: WELLS.gravas });
  beat(s, 'pluma-1'); assert.deepEqual(descend(s), { zone: 'fondo', x: WELLS.ciudad });
  assert.equal(descend(s), undefined, 'the bottom has no lift');
  assert.ok(!atWell(s, WELLS.ciudad));
});

test('nowhere is safe: a patrol that sees the party comes for it, wherever it stands, and its fight starts', () => {
  for (const x of [11, 24]) {
    const s = createModelo();
    measure(s, 'suelo-1');
    const hit = run(s, 30, x);
    assert.ok(hit, `at ${x}`); assert.equal(hit.encounter, 'modelo-celdas');
  }
});

test('a patrol walks its stretch and turns at its ends while it sees nobody', () => {
  const s = createModelo(), spec = PATROLS.find(p => p.id === 'oscilacion-1');
  s.zone = 'fondo';
  let low = Infinity, high = -Infinity;
  for (let t = 0; t < 60; t += .05) {
    assert.equal(tick(s, .05, 20), undefined, 'the party is in another zone');
    const x = s.patrols['oscilacion-1'].x;
    low = Math.min(low, x); high = Math.max(high, x);
  }
  assert.ok(Math.abs(low - spec.from) < 1e-6 && Math.abs(high - spec.to) < 1e-6, `${low}..${high}`);
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

test('each stake measured, once and only in its zone, takes a mark of Error off the boss', () => {
  const s = createModelo();
  assert.equal(stakeVerb(s, 'suelo-1'), 'Medir');
  assert.equal(stakeVerb(s, 'gravas-1'), undefined, 'not a stake of another zone');
  assert.ok(!measure(s, 'gravas-1'));
  assert.ok(measure(s, 'suelo-1')); assert.ok(!measure(s, 'suelo-1'));
  assert.equal(stakeVerb(s, 'suelo-1'), undefined, 'measured, nothing more to do there');
  assert.equal(calibration(s), 1);
});

test('the section is a place: one gallery the party walks, with its stakes and its wells on the way', async () => {
  const { MODELO_GRID, interactionStake, stakeInteraction, interactionWell, wellInteraction } = await import('../src/modelo.ts');
  const { MODELO } = await import('../src/environments.ts');
  assert.equal(MODELO_GRID.length, GALLERY.depth + 2);
  assert.equal(MODELO_GRID[GALLERY.row].length, SECTION.length + 2);
  assert.ok(MODELO.view && MODELO.hollow, 'seen from the side, drawn by its own builder');
  for (const stake of STAKES) {
    const i = MODELO.interactions.find(i => i.id === stakeInteraction(stake.id));
    assert.deepEqual(i?.cell, { x: stake.x, z: GALLERY.row }, stake.id);
    assert.equal(interactionStake(i.id)?.id, stake.id);
    assert.ok(Math.abs(stake.x - WELLS[stake.zone]) > 3 && Math.abs(stake.x - arrival(stake.zone)) > 3, `${stake.id} is on the way, not at a lift`);
  }
  for (const [zone, x] of Object.entries(WELLS)) {
    const i = MODELO.interactions.find(i => i.id === wellInteraction(zone));
    assert.deepEqual(i?.cell, { x, z: GALLERY.row }, zone);
    assert.equal(interactionWell(i.id), zone);
  }
  for (const p of PATROLS) assert.ok(p.from >= 1 && p.to <= SECTION.length, p.id);
});
