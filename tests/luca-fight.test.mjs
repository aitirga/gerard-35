import test from 'node:test';
import assert from 'node:assert/strict';
import { AFFINITIES, FEAR_ENCOUNTERS, LUCA, LUCA_ENCOUNTERS, LUCA_FIGHTS, act, cornered, createFearBattle, enemyAct, intentLabel, nextRound, runClock, takeNews } from '../src/battle.ts';
import { FOE_XP } from '../src/levels.ts';
import { LUCA_SIZES } from '../src/luca-foes.ts';

const party = [{ id: 'gerard', name: 'Gerard', profile: 'gerard35', classId: 'matemagico' }, { id: 'aitor', name: 'Aitor', profile: 'aitor', classId: 'papagato' }];
const fight = (encounter, random = () => 0) => {
  const s = createFearBattle(party, encounter, undefined, random);
  s.allies.forEach(a => { a.hp = a.maxHp = 9999; a.secondary = a.maxSecondary = 99; });
  s.foes.forEach(f => { f.hp = f.maxHp = 9999; });
  return s;
};
const turn = (s, id, target) => { s.phase = 'enemy'; s.enemyActions = []; return enemyAct(s, id, target); };
const round = s => { s.phase = 'enemy'; s.enemyActions = s.foes.map(f => f.id); return nextRound(s); };
const as = (s, who) => { s.phase = 'player'; s.active = s.allies.findIndex(a => a.id === who); };

test('the salon\'s fights are fears\' fights, each with the foes it says, under the walking light; only Fran corners the party', () => {
  for (const encounter of LUCA_ENCOUNTERS) {
    assert.ok(FEAR_ENCOUNTERS.includes(encounter));
    const s = createFearBattle(party, encounter);
    assert.deepEqual(s.foes.map(f => f.kind), [...LUCA_FIGHTS[encounter], ...encounter === 'fran' ? ['lampara', 'lampara', 'lampara'] : []], encounter);
    assert.deepEqual(s.light, { t: 0 }, 'it starts in the cold morning');
    assert.equal(cornered(s), encounter === 'fran');
    for (const f of s.foes) { assert.ok(FOE_XP[f.kind] > 0 || f.part, f.kind); assert.ok(LUCA_SIZES[f.kind] > 0, f.kind); }
  }
});

test('the moths go for whoever struck with an element, and one more comes in while two stand', () => {
  const s = fight('luca-recepcion');
  as(s, 'aitor');
  act(s, 'attack', s.foes[0].id);
  as(s, 'gerard');
  act(s, 'skill', s.foes[1].id, 'foc-binari');
  assert.equal(s.flash, 'gerard');
  const hit = turn(s, s.foes[2].id, 'aitor');
  assert.equal(hit.target, 'gerard');
  const before = s.foes.length;
  round(s);
  assert.equal(s.foes.length, before + 1);
  assert.ok(takeNews(s).some(n => n.summoned?.startsWith('polilla')));
});

test('an Estampado keeps its own colour\'s element off, and fills in again when its light comes on', () => {
  for (const [kind, element] of [['estampado-rojo', 'fuego'], ['estampado-azul', 'agua'], ['estampado-oro', 'electrico']]) assert.equal(AFFINITIES[kind][element], 'resist', kind);
  const s = fight('luca-carta');
  const red = s.foes.find(f => f.kind === 'estampado-rojo');
  red.hp = 5000;
  s.phase = 'player';
  runClock(s, 14.5);
  assert.equal(red.hp, 5000, 'not yet: orange is not its light');
  runClock(s, 7);
  assert.equal(red.hp, 5000 + Math.round(9999 * LUCA.recolor));
  assert.ok(takeNews(s).some(n => n.recolored?.target === red.id));
});

test('El Telescopio says whom it focuses on; a blow then cracks its lens and calls its beam off', () => {
  const s = fight('luca-abside');
  const scope = s.foes.find(f => f.kind === 'telescopio');
  turn(s, scope.id, 'gerard');
  assert.equal(scope.intent.ability, 'rayo-lente');
  assert.match(intentLabel(s, scope), /Rayo de lente →/);
  as(s, 'aitor');
  const blow = act(s, 'attack', scope.id);
  assert.equal(blow.lens, scope.id);
  assert.equal(scope.intent, undefined);
  const beam = turn(s, scope.id, 'gerard');
  assert.equal(beam.cancelled, 'rayo-lente');
  assert.equal(beam.amount, undefined);
});

test('the beam lands whole when nobody cracks the lens, and La Laca\'s fixer makes fire hurt double', () => {
  const s = fight('luca-abside');
  const scope = s.foes.find(f => f.kind === 'telescopio');
  turn(s, scope.id, 'gerard');
  const beam = turn(s, scope.id, 'gerard');
  assert.ok(beam.amount > 0);
  const t = fight('luca-abside');
  const lens = t.foes.find(f => f.kind === 'telescopio');
  turn(t, lens.id, 'gerard');
  t.allies.find(a => a.id === 'gerard').lacado = t.round + 1;
  const doubled = turn(t, lens.id, 'gerard');
  assert.ok(doubled.amount >= beam.amount * LUCA.lacado - 2, `${doubled.amount} against ${beam.amount}`);
});

test('fire on La Laca bursts it over every other foe, unless the light eats the fire', () => {
  const s = fight('luca-sillones');
  const laca = s.foes.find(f => f.kind === 'laca');
  as(s, 'gerard');
  const fire = act(s, 'skill', laca.id, 'foc-binari');
  assert.equal(laca.hp, 0);
  assert.equal(fire.burst.actor, laca.id);
  assert.ok(fire.burst.hits.length >= 3 && fire.burst.hits.every(h => h.amount > 0));
  const t = fight('luca-sillones');
  t.light.t = 15;
  as(t, 'gerard');
  const eaten = act(t, 'skill', t.foes.find(f => f.kind === 'laca').id, 'foc-binari');
  assert.equal(eaten.annulled, 'naranja');
  assert.equal(eaten.burst, undefined);
});

test('the freshly styled chaplain repeats the last gesture; down, the others stop mid-gesture', () => {
  const s = fight('luca-sillones');
  const [styled, other] = s.foes.filter(f => f.kind === 'capellan');
  assert.equal(styled.peinado, true);
  const laca = s.foes.find(f => f.kind === 'laca');
  turn(s, laca.id, 'gerard');
  const copy = turn(s, styled.id, 'gerard');
  assert.equal(copy.ability.id, 'imitacion');
  assert.ok(copy.lacquered?.length, 'it lacquers again');
  styled.hp = 1;
  as(s, 'aitor');
  const down = act(s, 'attack', styled.id);
  assert.deepEqual(down.stopped, s.foes.filter(f => f.kind === 'capellan' && f.hp > 0).map(f => f.id));
  const still = turn(s, other.id, 'gerard');
  assert.equal(still.cancelled, 'tijeretazo');
  round(s);
  assert.ok(s.foes.some(f => f.kind === 'capellan' && f.peinado && f.hp > 0), 'Fran restyles the next one');
});

test('Fran stands at his mark and the canopy\'s lamps light up; each light whose lamp hangs gives him Brillo', async () => {
  const { LAMPS, lampLit, stageMoment, STAGED_MOMENTS } = await import('../src/battle.ts');
  const s = fight('fran');
  assert.equal(cornered(s), true);
  const fran = s.foes.find(f => f.kind === 'fran');
  assert.equal(fran.stage, 1);
  s.phase = 'player';
  runClock(s, 8.5);
  assert.equal(fran.brillo, 0, 'sitting, he drinks nothing yet');
  assert.ok(s.foes.filter(f => f.kind === 'lampara').every(l => !lampLit(s, l)));
  s.light.t = 0;
  fran.hp = Math.floor(fran.maxHp * LUCA.standAt);
  as(s, 'aitor');
  const blow = act(s, 'attack', fran.id);
  assert.equal(blow.stage, 2);
  const lamps = s.foes.filter(f => f.kind === 'lampara');
  assert.deepEqual(lamps.map(l => l.lamp), Object.keys(LAMPS));
  assert.ok(lamps.every(l => l.part));
  s.phase = 'player';
  runClock(s, 8.5);
  assert.equal(fran.brillo, 1, 'green: the cold lamp drinks it');
  // Only the lamp in its own light can be broken.
  const cold = lamps.find(l => l.lamp === 'frio'), warm = lamps.find(l => l.lamp === 'calido');
  assert.ok(lampLit(s, cold) && !lampLit(s, warm));
  as(s, 'aitor');
  assert.equal(act(s, 'attack', warm.id).amount, 0);
  cold.hp = 1;
  as(s, 'aitor');
  const broke = act(s, 'attack', cold.id);
  assert.equal(broke.lampBroken, cold.id);
  assert.equal(fran.brillo, 0);
  for (const id of ['fran-acolitos', 'fran-baldaquino', 'fran-aspersion']) assert.equal(STAGED_MOMENTS[id].encounter, 'fran');
  const t = fight('fran');
  assert.ok(stageMoment(t, 'fran-aspersion'));
  assert.equal(t.foes.find(f => f.kind === 'fran').intent.ability, 'aspersion');
});

test('the Aspersión is said a turn ahead and takes Fuerza and Magia for the rest of the fight; the acolytes fall with him', () => {
  const s = fight('fran');
  const fran = s.foes.find(f => f.kind === 'fran');
  fran.stage = 3; fran.turns = 0;
  const load = turn(s, fran.id, 'gerard');
  assert.equal(load.telegraph.id, 'aspersion');
  const wash = turn(s, fran.id, 'gerard');
  assert.equal(wash.ability.id, 'aspersion');
  assert.ok(wash.amount > 0 && wash.splash.length === 1);
  assert.equal(s.allies[0].lasting.shifts.fuerza, -LUCA.aspersionDown);
  fran.hp = 1;
  as(s, 'aitor');
  act(s, 'attack', fran.id);
  assert.ok(s.foes.filter(f => f.kind === 'capellan').every(f => f.hp === 0));
  assert.equal(s.phase, 'won');
});
