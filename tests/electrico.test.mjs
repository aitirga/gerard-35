import test from 'node:test';
import assert from 'node:assert/strict';
import { act, createBattle, enemyAct, improve, validTargets, skillsFor, CONDENSADOR, TIMED, SKILLS } from '../src/battle.ts';
import { improvedBy } from '../src/ecos.ts';

// Matemágico's electric line past Toma de tierra (docs/animas/matemagico/README.md § Cortocircuito and
// ∂Q/∂t Condensador, Aitor 2026-11-21): the current that stays in one foe, and the charge he stores.
const PARTY = [{ id: 'gerard', name: 'Gerard', profile: 'gerard35', classId: 'matemagico' }, { id: 'aitor', name: 'Aitor', profile: 'aitor', classId: 'tecnopata' }];
const LINE = ['matemagico:electrico', 'matemagico:descarga', 'matemagico:toma-de-tierra', 'matemagico:cortocircuito', 'matemagico:condensador'];
function fight(nodes = LINE, dogs = 3) {
  const s = createBattle(PARTY, dogs, false, undefined, ['matemagico', 'tecnopata']);
  improve(s, improvedBy(nodes));
  s.foes.forEach(f => { f.hp = f.maxHp = 999; });
  return s;
}
const by = (s, id) => [...s.allies, ...s.foes].find(c => c.id === id);
const turn = (s, id) => { s.phase = 'player'; s.active = s.allies.indexOf(by(s, id)); delete s.spent; delete s.queued; by(s, id).secondary = by(s, id).maxSecondary; return by(s, id); };
/** `foe`'s turn now, on `target`. */
const foeTurn = (s, foe, target = 'gerard') => { s.phase = 'enemy'; s.enemyActions = []; return enemyAct(s, foe, target); };
const wet = () => ({ level: 1, left: TIMED.mojado.seconds, next: TIMED.mojado.every });

test('both are nodes of the electric line, past Toma de tierra, and only once bought', () => {
  assert.ok(!skillsFor(fight(LINE.slice(0, 3)), { classId: 'matemagico', id: 'gerard' }).some(s => s.id === 'cortocircuito'));
  const s = fight();
  assert.deepEqual(skillsFor(s, by(s, 'gerard')).map(k => k.id).slice(-3), ['descarga', 'cortocircuito', 'condensador']);
  assert.equal(SKILLS.find(k => k.id === 'condensador').name, '∂Q/∂t Condensador');
});

test('Cortocircuito on someone wet: the current stays in them, Shock for sure, and nobody else is touched', () => {
  const s = fight();
  s.foes[0].timed = { mojado: wet() }; s.foes[1].timed = { mojado: wet() };
  turn(s, 'gerard');
  const hp = s.foes.map(f => f.hp), e = act(s, 'skill', 'dog-0', 'cortocircuito');
  assert.ok(e.amount > 0); assert.equal(e.reaction, undefined, 'no Conducción');
  assert.equal(s.foes[1].hp, hp[1], 'the other wet dog is untouched');
  assert.ok(s.foes[0].timed.mojado && s.foes[1].timed.mojado, 'the water stays for a Punto eléctrico after');
  assert.deepEqual(e.shocked, ['dog-0']); assert.deepEqual(e.shorted, { target: 'dog-0', why: 'mojado' });
  assert.equal(foeTurn(s, 'dog-0').stunned, true, 'it loses its next turn');
});

test('Cortocircuito never twice running: the foe has to act once before it can short again', () => {
  const s = fight();
  s.foes[0].timed = { mojado: wet() };
  turn(s, 'gerard'); act(s, 'skill', 'dog-0', 'cortocircuito');
  assert.equal(foeTurn(s, 'dog-0').stunned, true);
  turn(s, 'gerard');
  const again = act(s, 'skill', 'dog-0', 'cortocircuito');
  assert.equal(again.shocked, undefined); assert.equal(again.shorted.why, 'again');
  assert.ok(!foeTurn(s, 'dog-0').stunned, 'it acts');
  turn(s, 'gerard');
  assert.deepEqual(act(s, 'skill', 'dog-0', 'cortocircuito').shocked, ['dog-0'], 'once it has acted, it can short again');
});

test('Cortocircuito on a foe with a move announced: it loses its turn and the move waits; on a dry foe with nothing, only the blow', () => {
  const s = fight();
  s.foes[0].intent = { ability: 'carrerilla', target: 'gerard' };
  turn(s, 'gerard');
  const e = act(s, 'skill', 'dog-0', 'cortocircuito');
  assert.equal(e.shorted.why, 'anuncio'); assert.equal(e.shorted.move, 'Carrerilla');
  assert.ok(s.foes[0].shock); assert.deepEqual(s.foes[0].intent, { ability: 'carrerilla', target: 'gerard' }, 'what it announced is still there, waiting');
  turn(s, 'gerard');
  const plain = act(s, 'skill', 'dog-1', 'cortocircuito');
  assert.ok(plain.amount > 0); assert.equal(plain.shorted, undefined); assert.equal(s.foes[1].shock, undefined);
});

test('∂Q/∂t Condensador: one maná, a charge on him, and his next electric blow lands twice as hard', () => {
  const s = fight(), g = turn(s, 'gerard');
  assert.deepEqual(validTargets(s, 'skill', 'condensador').map(c => c.id), ['gerard']);
  const e = act(s, 'skill', undefined, 'condensador');
  assert.equal(e.capacitor, 'stored'); assert.equal(g.capacitor, true); assert.equal(g.secondary, g.maxSecondary - 1);
  turn(s, 'gerard');
  assert.deepEqual(validTargets(s, 'skill', 'condensador'), [], 'not twice: it carries one already');
  // A blow with no electricity leaves it where it is.
  act(s, 'skill', 'dog-0', 'foc-binari');
  assert.equal(g.capacitor, true);
  const plain = fight(); turn(plain, 'gerard');
  const single = act(plain, 'skill', 'dog-1', 'descarga').amount;
  turn(s, 'gerard');
  const charged = act(s, 'skill', 'dog-1', 'descarga');
  assert.equal(charged.capacitor, 'spent'); assert.equal(g.capacitor, undefined);
  assert.ok(Math.abs(charged.amount - single * CONDENSADOR.scale) <= 2, `${charged.amount} ≈ ${single} × ${CONDENSADOR.scale}`);
});

test('∂Q/∂t Condensador: a foe that strikes him first takes the charge, and it is gone', () => {
  const s = fight();
  turn(s, 'gerard'); act(s, 'skill', undefined, 'condensador');
  const hp = s.foes[0].hp, e = foeTurn(s, 'dog-0', 'gerard');
  assert.ok(e.amount > 0);
  assert.equal(e.discharge.from, 'gerard'); assert.equal(e.discharge.target, 'dog-0');
  assert.ok(e.discharge.amount > 0); assert.equal(s.foes[0].hp, hp - e.discharge.amount);
  assert.equal(by(s, 'gerard').capacitor, undefined);
  // A blow on someone else leaves it on him.
  const t = fight(); turn(t, 'gerard'); act(t, 'skill', undefined, 'condensador');
  assert.equal(foeTurn(t, 'dog-0', 'aitor').discharge, undefined); assert.equal(by(t, 'gerard').capacitor, true);
});
