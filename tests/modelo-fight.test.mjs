import test from 'node:test';
import assert from 'node:assert/strict';
import { FEAR_ENCOUNTERS, MODELO, MODELO_ENCOUNTERS, MODELO_FIGHTS, SKILLS, STAGED_MOMENTS, act, calibrate, cornered, createFearBattle, elementsFor, enemyAct, nextRound, stageMoment } from '../src/battle.ts';
import { FOE_XP } from '../src/levels.ts';

// The party of the first day: Gerard on Matemágico, Aitor wearing nothing, nothing bought at the jar.
const party = [{ id: 'gerard', name: 'Gerard', profile: 'gerard35', classId: 'matemagico' }, { id: 'aitor', name: 'Aitor', profile: 'aitor' }];
const fight = (encounter, random = () => .5) => {
  const s = createFearBattle(party, encounter, undefined, random);
  s.allies.forEach(a => { a.hp = a.maxHp = 9999; });
  return s;
};
const turn = (s, id, target) => { s.phase = 'enemy'; s.enemyActions = []; return enemyAct(s, id, target); };
const round = s => { s.phase = 'enemy'; s.enemyActions = s.foes.map(f => f.id); return nextRound(s); };
/** `who` attacks `foeId` with `element` (none: a plain Atacar), on the fight itself. */
const strike = (s, who, foeId, element) => {
  s.phase = 'player'; s.active = s.allies.findIndex(a => a.id === who); delete s.spent;
  s.allies[s.active].element = element;
  return act(s, 'attack', foeId);
};
/** The PV that blow takes off, on a copy with the foe's PV out of the way. */
const blow = (s, foeId, element) => {
  const look = structuredClone(s);
  look.foes.forEach(f => { f.hp = f.maxHp = 9999; });
  return strike(look, 'gerard', foeId, element).amount;
};
const wet = c => !!c.timed?.mojado;

test('the model\'s fights are fears\' fights, each with the foes it says, and only the boss cannot be run from', () => {
  for (const encounter of MODELO_ENCOUNTERS) {
    assert.ok(FEAR_ENCOUNTERS.includes(encounter));
    const s = fight(encounter);
    assert.deepEqual(s.foes.map(f => f.kind), [...MODELO_FIGHTS[encounter]], encounter);
    assert.equal(cornered(s), encounter === 'no-converge', encounter);
    for (const f of s.foes) assert.ok(FOE_XP[f.kind] > 0, f.kind);
  }
  assert.deepEqual(fight('modelo-celdas').foes.map(f => f.name), ['Celda seca 1', 'Celda seca 2', 'Celda seca 3']);
  assert.deepEqual(fight('no-converge').foes.map(f => f.name), ['El que no converge']);
});

test('inside the model every Atacar can carry water or electricity, whatever is worn and whatever the jar gave', () => {
  const s = fight('modelo-celdas');
  for (const ally of s.allies) assert.deepEqual(elementsFor(s, ally), ['agua', 'electrico'], ally.id);
  // Outside it, the same party has none.
  const street = createFearBattle(party, 'cebolla');
  for (const ally of street.allies) assert.deepEqual(elementsFor(street, ally), []);
});

test('a Celda seca takes half while dry; water wets it, and then electricity runs through every wet one and leaves them dry', () => {
  const s = fight('modelo-celdas');
  const dry = blow(s, 'celda-seca-0');
  const first = strike(s, 'gerard', 'celda-seca-0', 'agua');
  assert.deepEqual(first.wetted, ['celda-seca-0']); assert.ok(first.amount > 0);
  assert.ok(wet(s.foes[0]));
  assert.equal(blow(s, 'celda-seca-0'), Math.round(dry / MODELO.seca), 'wet, a blow lands whole');
  strike(s, 'aitor', 'celda-seca-1', 'agua');
  const bolt = strike(s, 'gerard', 'celda-seca-0', 'electrico');
  assert.equal(bolt.reaction?.id, 'conduccion');
  assert.deepEqual(bolt.reaction.hits.map(h => h.target).sort(), ['celda-seca-0', 'celda-seca-1']);
  assert.ok(!wet(s.foes[0]) && !wet(s.foes[1]), 'dry again');
});

test('a Celda seca\'s Chispa is a spark on one, and runs through everyone wet in the party', () => {
  const s = fight('modelo-celdas');
  const plain = turn(s, 'celda-seca-0', 'gerard');
  assert.equal(plain.ability.id, 'chispa'); assert.ok(plain.amount > 0); assert.ok(!plain.conducted);
  for (const a of s.allies) a.timed = { mojado: { level: 1, left: 20, next: 20 } };
  const run = turn(s, 'celda-seca-1', 'gerard');
  assert.ok(run.conducted); assert.equal(run.target, 'gerard'); assert.equal(run.splash.length, 1);
  assert.ok(run.amount > plain.amount, 'through the water it is harder');
  assert.ok(s.allies.every(a => !wet(a)), 'and it leaves them dry');
});

test('an Oscilación absorbs the element it is on, takes the other hard, and goes to its other value every round', () => {
  const s = fight('modelo-oscilacion');
  assert.deepEqual(s.foes.map(f => f.sign), ['agua', 'electrico']);
  const plain = blow(s, 'oscilacion-0');
  assert.equal(blow(s, 'oscilacion-0', 'agua'), 0);
  assert.ok(blow(s, 'oscilacion-0', 'electrico') > plain * 2);
  assert.equal(blow(s, 'oscilacion-1', 'electrico'), 0);
  assert.ok(blow(s, 'oscilacion-1', 'agua') > plain * 2);
  // On «Agua» it breaks over one and leaves them wet; on «Eléctrico» it sparks.
  const ola = turn(s, 'oscilacion-0', 'aitor');
  assert.equal(ola.ability.id, 'ola'); assert.deepEqual(ola.wetted, ['aitor']);
  assert.equal(turn(s, 'oscilacion-1', 'aitor').ability.id, 'chispa');
  round(s);
  assert.deepEqual(s.foes.map(f => f.sign), ['electrico', 'agua']);
});

test('La pluma soaks whoever is still dry', () => {
  const s = fight('modelo-pluma');
  const one = turn(s, 'pluma', 'gerard');
  assert.equal(one.ability.id, 'empapa'); assert.deepEqual(one.wetted, [one.target]);
  const two = turn(s, 'pluma', one.target);
  assert.notEqual(two.target, one.target, 'the dry one next');
  assert.ok(s.allies.every(wet));
});

test('El que no converge floods on «Agua» and shocks everyone wet on «Eléctrico», harder for each mark of Error', () => {
  const s = fight('no-converge'), boss = s.foes[0];
  assert.equal(boss.sign, 'agua'); assert.equal(boss.error, MODELO.error);
  const flood = turn(s, boss.id, 'gerard');
  assert.equal(flood.ability.id, 'inunda'); assert.equal(flood.wetted.length, 2); assert.ok(s.allies.every(wet));
  round(s);
  assert.equal(boss.sign, 'electrico');
  const few = structuredClone(s), many = structuredClone(s);
  few.foes[0].error = 1; many.foes[0].error = MODELO.errorMost;
  const light = turn(few, boss.id, 'gerard'), heavy = turn(many, boss.id, 'gerard');
  assert.equal(light.ability.id, 'descarga-modelo'); assert.ok(light.conducted);
  assert.ok(heavy.amount > light.amount, `${heavy.amount} > ${light.amount}`);
  assert.ok(few.allies.every(a => !wet(a)));
});

test('a blow of the element it is not on takes a mark of Error off and no more PV than a plain one; one of its own is absorbed and adds a mark', () => {
  const s = fight('no-converge'), boss = s.foes[0];
  const plain = blow(s, boss.id);
  assert.equal(blow(s, boss.id, 'electrico'), plain, 'the right blow buys the mark, not the number');
  assert.equal(blow(s, boss.id, 'agua'), 0);
  const right = strike(s, 'gerard', boss.id, 'electrico');
  assert.deepEqual(right.error, { left: MODELO.error - 1, mark: 'off' });
  const wrong = strike(s, 'aitor', boss.id, 'agua');
  assert.equal(wrong.amount, 0); assert.deepEqual(wrong.error, { left: MODELO.error, mark: 'on' });
  assert.equal(strike(s, 'gerard', boss.id).error, undefined, 'a plain blow leaves the Error as it was');
});

test('at no Error it converges: solid for some of its turns, every blow harder, no move; then it diverges again', () => {
  const s = fight('no-converge'), boss = s.foes[0];
  const plain = blow(s, boss.id);
  let last;
  for (let i = 0; i < MODELO.error; i++) last = strike(s, i % 2 ? 'aitor' : 'gerard', boss.id, 'electrico');
  assert.ok(last.converged); assert.equal(boss.error, 0); assert.equal(boss.converged, MODELO.convergeTurns);
  assert.equal(blow(s, boss.id), Math.round(plain / MODELO.itera * MODELO.converge));
  assert.equal(blow(s, boss.id, 'agua'), blow(s, boss.id), 'solid, it has no element of its own');
  for (let i = 0; i < MODELO.convergeTurns; i++) {
    const still = turn(s, boss.id, 'gerard');
    assert.equal(still.ability.id, 'converge'); assert.equal(still.amount, undefined);
    const sign = boss.sign;
    if (boss.converged) { round(s); assert.equal(boss.sign, sign, 'solid, it stays on its value'); }
    else { assert.ok(still.diverged); assert.equal(boss.error, MODELO.error); }
  }
});

test('past its mark it diverges: more Error, and converging then leaves it wet too', () => {
  const s = fight('no-converge'), boss = s.foes[0];
  boss.hp = Math.floor(boss.maxHp * MODELO.diverge) + 1;
  const e = strike(s, 'gerard', boss.id);
  assert.ok(e.diverged); assert.ok(boss.diverged); assert.equal(boss.error, MODELO.errorDiverge);
  for (let i = 0; i < MODELO.errorDiverge; i++) strike(s, i % 2 ? 'aitor' : 'gerard', boss.id, 'electrico');
  assert.ok(boss.converged); assert.ok(wet(boss));
  assert.equal(strike(s, 'gerard', boss.id, 'electrico').reaction?.id, 'conduccion');
});

test('each piezometer placed on the way down takes a mark of Error off before the fight, never the last one', () => {
  const s = fight('no-converge');
  calibrate(s, 1); assert.equal(s.foes[0].error, MODELO.error - 1);
  calibrate(s, 9); assert.equal(s.foes[0].error, 1);
});

test('the boss has a moment for each of its phases', () => {
  for (const moment of ['modelo-itera', 'modelo-converge', 'modelo-diverge']) {
    assert.equal(STAGED_MOMENTS[moment].encounter, 'no-converge');
    const s = fight('no-converge');
    assert.ok(stageMoment(s, moment), moment);
    assert.equal(s.phase, 'player');
  }
  const s = fight('no-converge');
  stageMoment(s, 'modelo-converge'); assert.ok(s.foes[0].converged);
  stageMoment(s, 'modelo-diverge'); assert.ok(s.foes[0].diverged); assert.equal(s.foes[0].error, MODELO.errorDiverge);
  assert.equal(stageMoment(fight('modelo-celdas'), 'modelo-itera'), false);
});

test('no rule of the model asks for a skill or an ánima by name', async () => {
  const { readFile } = await import('node:fs/promises');
  const source = await readFile(new URL('../src/battle.ts', import.meta.url), 'utf8');
  const start = source.indexOf(' * How much of a blow a foe of the model takes'), end = source.indexOf('/** Càmping Eurosport\'s foes, by name');
  const rules = source.slice(start, end);
  assert.ok(start > 0 && end > start);
  for (const id of [...SKILLS.map(s => s.id), 'papagato', 'matemagico', 'tecnopata']) assert.ok(!rules.includes(`'${id}'`), id);
});
