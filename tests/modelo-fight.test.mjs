import test from 'node:test';
import assert from 'node:assert/strict';
import { FEAR_ENCOUNTERS, MODELO, REACTION_RULES, MODELO_ENCOUNTERS, MODELO_FIGHTS, SKILLS, STAGED_MOMENTS, act, calibrate, cornered, createFearBattle, elementsFor, enemyAct, nextRound, runClock, stageMoment, TIMED } from '../src/battle.ts';
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

test('a Celda seca takes less than half while dry; water wets it, and then electricity runs through every wet one and leaves them dry', () => {
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

/** The same fight with its dice set, so a roll can be tried many ways. */
const seeded = (s, seed) => { const copy = structuredClone(s); copy.seed = seed; return copy; };

test('a bolt on a foe that is wet leaves it in Shock half the time, and its next turn is lost', () => {
  const s = fight('modelo-celdas');
  strike(s, 'gerard', 'celda-seca-0', 'agua');
  let shocked = 0, lost;
  for (let seed = 1; seed <= 200; seed++) {
    const one = seeded(s, seed), bolt = strike(one, 'aitor', 'celda-seca-0', 'electrico');
    assert.equal(bolt.reaction?.id, 'conduccion');
    if (!bolt.shocked) { assert.ok(!one.foes[0].shock); continue; }
    assert.deepEqual(bolt.shocked, ['celda-seca-0']); assert.ok(one.foes[0].shock);
    shocked++; lost ??= one;
  }
  assert.ok(Math.abs(shocked / 200 - REACTION_RULES.shock) < .12, `${shocked} of 200`);
  // Its turn passes with nothing done, and the one after is its own again.
  const before = lost.allies.map(a => a.hp);
  const none = turn(lost, 'celda-seca-0', 'gerard');
  assert.ok(none.stunned); assert.equal(none.ability, undefined); assert.equal(none.amount, undefined);
  assert.deepEqual(lost.allies.map(a => a.hp), before); assert.ok(!lost.foes[0].shock);
  assert.equal(turn(lost, 'celda-seca-0', 'gerard').ability.id, 'chispa');
  // A bolt on a dry one is only a bolt.
  for (let seed = 1; seed <= 40; seed++) assert.ok(!strike(seeded(s, seed), 'aitor', 'celda-seca-1', 'electrico').shocked);
});

test('a foe\'s bolt lands whole on the one it strikes wet and part of it on the others, and may leave that one in Shock: they sit the next round out', () => {
  const s = fight('modelo-celdas');
  for (const a of s.allies) a.timed = { mojado: { level: 1, left: 20, next: 20 } };
  let shocked = 0, lost;
  for (let seed = 1; seed <= 200; seed++) {
    const one = seeded(s, seed), run = turn(one, 'celda-seca-0', 'gerard');
    assert.ok(run.conducted); assert.equal(run.target, 'gerard');
    assert.ok(run.splash[0].amount < run.amount * (REACTION_RULES.share + .2), `${run.splash[0].amount} of ${run.amount}`);
    if (!run.shocked) continue;
    assert.deepEqual(run.shocked, ['gerard']); assert.ok(one.allies[0].shock); assert.ok(!one.allies[1].shock);
    shocked++; lost ??= one;
  }
  assert.ok(Math.abs(shocked / 200 - REACTION_RULES.shock) < .12, `${shocked} of 200`);
  round(lost);
  assert.equal(lost.phase, 'player'); assert.deepEqual(lost.spent, ['gerard']);
  assert.equal(lost.allies[lost.active].id, 'aitor', 'the other one chooses');
  assert.ok(!lost.allies[0].shock, 'and it is gone with the turn');
  round(lost);
  assert.equal(lost.allies[lost.active].id, 'gerard');
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

test('El Átomo loses an electron to a blow of its element, takes back one it lost, and bare takes double of what has no element', () => {
  const s = fight('modelo-atomo'), atom = s.foes[0];
  assert.deepEqual(atom.electrons, ['fuego', 'agua', 'electrico']);
  const plain = blow(s, 'atomo');
  assert.equal(blow(s, 'atomo', 'agua'), Math.round(plain * MODELO.ioniza), 'an electron it has: harder');
  const torn = strike(s, 'gerard', 'atomo', 'agua');
  assert.deepEqual(torn.electron, { element: 'agua', mark: 'off' });
  assert.equal(torn.called[0].text, '¡Ionizado!');
  assert.deepEqual(atom.electrons, ['fuego', 'electrico']);
  // The same element again: it catches it back, and the blow lands at half.
  assert.equal(blow(s, 'atomo', 'agua'), Math.round(plain * MODELO.captura));
  const caught = strike(s, 'aitor', 'atomo', 'agua');
  assert.deepEqual(caught.electron, { element: 'agua', mark: 'on' });
  assert.equal(caught.called[0].text, 'Captura');
  assert.deepEqual(atom.electrons, ['fuego', 'agua', 'electrico'], 'back in its orbit, in order');
  // With none left, what has no element lands double, and an element only gives it one back.
  atom.electrons = ['electrico'];
  assert.equal(strike(s, 'gerard', 'atomo', 'electrico').called.at(-1).text, 'Núcleo desnudo');
  assert.deepEqual(atom.electrons, []);
  assert.equal(blow(s, 'atomo'), Math.round(plain * MODELO.desnudo));
});

test('El Átomo throws its electrons round, fire and water at someone dry and the spark at someone wet, and every third turn all at once', () => {
  const s = fight('modelo-atomo'), atom = s.foes[0];
  const fire = turn(s, 'atomo', 'gerard');
  assert.equal(fire.ability.id, 'electron'); assert.equal(fire.element, 'fuego'); assert.deepEqual(fire.burnt, ['gerard']);
  assert.ok(s.allies[0].timed?.quemado);
  const water = turn(s, 'atomo', 'gerard');
  assert.equal(water.element, 'agua'); assert.deepEqual(water.wetted, [water.target]);
  // The third turn: Reacción. Water on everyone, the spark through them, then fire on whoever it dried.
  const reaction = turn(s, 'atomo', 'gerard');
  assert.equal(reaction.ability.id, 'reaccion');
  assert.deepEqual(reaction.reacted, ['agua', 'electrico', 'fuego']);
  assert.ok(reaction.conducted, 'soaked and shocked'); assert.equal(reaction.wetted, undefined, 'the water says nothing of its own with the spark behind it');
  assert.equal(reaction.burnt.length, 2, 'the spark dried them: the fire takes');
  // The next Electrón goes on from the last it threw: the spark, at whoever is wet.
  s.allies[1].timed = { ...s.allies[1].timed, mojado: { level: 1, left: TIMED.mojado.seconds, next: TIMED.mojado.every } };
  const spark = turn(s, 'atomo', 'gerard');
  assert.equal(spark.element, 'electrico'); assert.equal(spark.target, 'aitor'); assert.ok(spark.conducted);
  // Without its spark, its Reacción only wets and steams: Vapor, and nobody shocked.
  atom.electrons = ['fuego', 'agua']; atom.turns = MODELO.reaccionEvery - 1;
  s.allies.forEach(a => { a.timed = {}; });
  const steam = turn(s, 'atomo', 'gerard');
  assert.deepEqual(steam.reacted, ['agua', 'fuego']);
  assert.ok(!steam.conducted); assert.equal(steam.steamed.length, 2); assert.ok(s.allies.every(a => a.timed?.cegado && !a.timed?.mojado));
  // Bare, it only rams.
  atom.electrons = [];
  assert.equal(turn(s, 'atomo', 'gerard').ability.id, 'choque');
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

/** Real time passes on the party's turn. */
const wait = (s, seconds) => { s.phase = 'player'; runClock(s, seconds); };

test('waiting its water out works once: it sees it, and the next time it floods and discharges in one move', () => {
  const s = fight('no-converge'), boss = s.foes[0];
  turn(s, boss.id, 'gerard'); assert.ok(s.allies.every(wet));
  wait(s, TIMED.mojado.seconds + 1);
  assert.ok(s.allies.every(a => !wet(a))); assert.ok(boss.drained);
  round(s);
  const first = turn(s, boss.id, 'gerard');
  assert.equal(first.ability.id, 'descarga-modelo'); assert.ok(!first.conducted);
  assert.ok(first.wary && boss.wary, 'it has seen it'); assert.ok(!boss.drained);
  // Played straight after that, nothing changes: wet, its Descarga runs through them as ever.
  round(s); turn(s, boss.id, 'gerard'); round(s);
  const straight = turn(s, boss.id, 'gerard');
  assert.equal(straight.ability.id, 'descarga-modelo'); assert.ok(straight.conducted); assert.ok(!straight.wetted && !straight.wary);
  // Waited out again: it wets them both itself and the bolt runs through the two, as hard as if they had never dried.
  round(s); turn(s, boss.id, 'gerard');
  wait(s, TIMED.mojado.seconds + 1);
  assert.ok(s.allies.every(a => !wet(a)));
  round(s);
  const again = turn(s, boss.id, 'gerard');
  assert.equal(again.ability.id, 'descarga-modelo'); assert.ok(again.conducted); assert.ok(!again.wary);
  assert.deepEqual([...again.wetted].sort(), ['aitor', 'gerard']);
  assert.equal(again.splash.length, 1);
  assert.ok(again.amount >= straight.amount && again.amount > first.amount * 1.5, `${again.amount} against ${first.amount} dry`);
  assert.ok(s.allies.every(a => !wet(a) && a.hp > 0), 'left dry, and standing: it is its Descarga, no more');
});

test('water that dries while it stands converged is not held against the party', () => {
  const s = fight('no-converge'), boss = s.foes[0];
  boss.wary = true;
  turn(s, boss.id, 'gerard');
  for (let i = 0; i < MODELO.error; i++) strike(s, i % 2 ? 'aitor' : 'gerard', boss.id, 'electrico');
  assert.ok(boss.converged);
  wait(s, TIMED.mojado.seconds + 1);
  assert.ok(!boss.drained);
  for (let i = 0; i < MODELO.convergeTurns; i++) turn(s, boss.id, 'gerard');
  boss.sign = 'electrico';
  const bolt = turn(s, boss.id, 'gerard');
  assert.equal(bolt.ability.id, 'descarga-modelo'); assert.ok(s.allies.every(a => a.hp > 0));
});

test('each piezometer placed on the way down takes a mark of Error off before the fight, never the last one', () => {
  const s = fight('no-converge');
  calibrate(s, 1); assert.equal(s.foes[0].error, MODELO.error - 1);
  calibrate(s, 9); assert.equal(s.foes[0].error, 1);
});

test('the boss has a moment for each of its phases', () => {
  for (const moment of ['modelo-itera', 'modelo-converge', 'modelo-diverge', 'modelo-sobre-aviso']) {
    assert.equal(STAGED_MOMENTS[moment].encounter, 'no-converge');
    const s = fight('no-converge');
    assert.ok(stageMoment(s, moment), moment);
    assert.equal(s.phase, 'player');
  }
  const s = fight('no-converge');
  stageMoment(s, 'modelo-converge'); assert.ok(s.foes[0].converged);
  stageMoment(s, 'modelo-diverge'); assert.ok(s.foes[0].diverged); assert.equal(s.foes[0].error, MODELO.errorDiverge);
  stageMoment(s, 'modelo-sobre-aviso'); assert.ok(s.foes[0].wary); assert.ok(!s.foes[0].diverged);
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
