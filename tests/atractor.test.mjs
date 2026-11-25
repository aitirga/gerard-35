import test from 'node:test';
import assert from 'node:assert/strict';
import { act, createBattle, improve, movable, bombPower, BOMBA, COMBUSTION, FIRE_TOP, MANA_POINTS, POWDER_RULES, SKILLS, TIMED } from '../src/battle.ts';
import { improvedBy, improvementOf, stageOf } from '../src/ecos.ts';

// Atractor extraño (docs/animas/matemagico/README.md § Atractor extraño): a blow of the astral, and the others'
// statuses on the clock come to its target, adding up; what meets there reacts.
const PARTY = [{ id: 'gerard', name: 'Gerard', profile: 'gerard35', classId: 'matemagico' }, { id: 'aitor', name: 'Aitor', profile: 'aitor', classId: 'tecnopata' }];
const CALCULO = ['matemagico:angulo', 'matemagico:analisis', 'matemagico:cardioide', 'matemagico:mana-1', 'matemagico:atractor'];
function fight(nodes = CALCULO, dogs = 3) {
  const s = createBattle(PARTY, dogs, false, undefined, ['matemagico', 'tecnopata']);
  improve(s, improvedBy(nodes));
  s.foes.forEach(f => { f.hp = f.maxHp = 999; });
  return s;
}
const by = (s, id) => [...s.allies, ...s.foes].find(c => c.id === id);
const turn = (s, id = 'gerard') => { s.phase = 'player'; s.active = s.allies.indexOf(by(s, id)); delete s.spent; delete s.queued; by(s, id).secondary = by(s, id).maxSecondary; return by(s, id); };
const on = (level, left, every) => ({ level, left, next: every });
const fire = (level, left = TIMED.quemado.seconds) => on(level, left, TIMED.quemado.every);
const wet = (left = TIMED.mojado.seconds) => on(1, left, TIMED.mojado.every);
const dust = () => on(1, TIMED.empolvado.seconds, TIMED.empolvado.every);
const cast = (s, target = 'dog-0') => { turn(s); return act(s, 'skill', target, 'atractor'); };

test('its node: Cálculo, grade III, 2 ecos past Maná +1, beside Integral; 2 maná', () => {
  const node = improvementOf('matemagico:atractor');
  assert.equal(node.cost, 2); assert.equal(node.line, 'calculo'); assert.equal(node.after, 'matemagico:mana-1');
  assert.equal(stageOf(node), 2);
  const spec = SKILLS.find(s => s.id === 'atractor');
  assert.equal(spec.cost, 2); assert.equal(spec.kind, 'magic'); assert.equal(spec.power, 16); assert.ok(!('element' in spec));
  const s = fight();
  const gerard = turn(s); act(s, 'skill', 'dog-0', 'atractor');
  assert.equal(gerard.secondary, MANA_POINTS + 1 - 2);
});

test('the others\' statuses come to its target and leave them; the same one adds its levels up, keeping the longer clock', () => {
  const s = fight();
  s.foes[1].timed = { quemado: fire(2, 4), envenenado: on(1, 9, 4) };
  s.foes[2].timed = { quemado: fire(1, 8), cegado: on(1, 6, 10), confusion: on(1, 20, 30) };
  s.foes[0].timed = { envenenado: on(1, 12, 4) };
  const hp = s.foes[0].hp, e = cast(s);
  assert.ok(e.amount > 0 && s.foes[0].hp < hp, 'the blow lands first');
  const t = s.foes[0].timed;
  assert.equal(t.quemado.level, 3); assert.equal(t.quemado.left, 8);
  assert.equal(t.envenenado.level, 2); assert.equal(t.envenenado.left, 12);
  assert.ok(t.cegado && t.confusion);
  assert.deepEqual(movable(s.foes[1]), []); assert.deepEqual(movable(s.foes[2]), []);
  assert.deepEqual(e.gathered.map(g => g.from), ['dog-1', 'dog-2']);
  assert.deepEqual(e.gathered[1].ids, ['quemado', 'cegado', 'confusion']);
  assert.match(s.message, /Quemado III/);
});

test('three fires II make one at III; with Combustión, at IV', () => {
  const plain = fight(), nodes = [...CALCULO, 'matemagico:fuego', 'matemagico:factor-comun', 'matemagico:rescoldo', 'matemagico:combustion'];
  for (const f of plain.foes) f.timed = { quemado: fire(2) };
  cast(plain);
  assert.equal(plain.foes[0].timed.quemado.level, FIRE_TOP);
  const hot = fight(nodes);
  for (const f of hot.foes) f.timed = { quemado: fire(2) };
  cast(hot);
  assert.equal(hot.foes[0].timed.quemado.level, COMBUSTION.level);
  assert.ok(!hot.foes[1].timed.quemado && !hot.foes[2].timed.quemado);
});

test('shards add up to their deepest, poison to III', () => {
  const s = fight();
  s.foes[0].timed = { cristalizado: on(3, 20, 20), envenenado: on(2, 20, 4) };
  s.foes[1].timed = { cristalizado: on(4, 20, 20), envenenado: on(3, 20, 4) };
  cast(s);
  assert.equal(s.foes[0].timed.cristalizado.level, POWDER_RULES.shards);
  assert.equal(s.foes[0].timed.envenenado.level, 3);
});

test('two bombs add their charge up to the top, with the clock of the one closer to going off', () => {
  const s = fight();
  s.foes[0].timed = { bomba: { level: 1, left: 9, next: 12, age: 4 } };
  s.foes[1].timed = { bomba: { level: 1, left: 3, next: 12, age: 6 } };
  cast(s);
  const b = s.foes[0].timed.bomba;
  assert.equal(b.left, 3);
  assert.equal(Math.round(bombPower(b.age)), Math.round(bombPower(4) + bombPower(6)));
  s.foes[0].timed = { bomba: { level: 1, left: 9, next: 12, age: 20 } };
  s.foes[2].timed = { bomba: { level: 1, left: 5, next: 12, age: 20 } };
  cast(s);
  assert.equal(bombPower(s.foes[0].timed.bomba.age), BOMBA.top);
});

test('what does not move: La crecida\'s water and the Mojado it makes, cures, Virus, a dual\'s own, the statuses counted in rounds', () => {
  const s = fight();
  s.foes[1].timed = { agua: on(2, 20, 20), mojado: wet(), corriente: on(1, 8, 2), hundido: on(1, 10, 2), congelado: on(1, 40, 60), sanacion: on(1, 15, 3), virus: on(1, 20, 20), volcan: on(1, 20, 5), marea: on(1, 20, 20), seiche: on(1, 20, 5) };
  s.foes[1].statuses = { sangrado: 4, mareo: 2 };
  const before = structuredClone(s.foes[1].timed), e = cast(s);
  assert.deepEqual(s.foes[1].timed, before);
  assert.deepEqual(s.foes[1].statuses, { sangrado: 4, mareo: 2 });
  assert.equal(s.foes[0].timed?.mojado, undefined);
  assert.equal(e.gathered, undefined);
  // Every one that moves says so in TIMED, and nothing else does.
  assert.deepEqual(Object.keys(TIMED).filter(id => TIMED[id].moves).sort(), ['bomba', 'cegado', 'confusion', 'cristalizado', 'empolvado', 'encogido', 'envenenado', 'mojado', 'quemado'].sort());
});

test('arrivals react, with no blow of their own: Humo, Vapor, Estallido and Envenenado', () => {
  const humo = fight();
  humo.foes[0].timed = { quemado: fire(2) }; humo.foes[1].timed = { mojado: wet() };
  let e = cast(humo);
  assert.equal(humo.foes[0].timed.quemado, undefined); assert.ok(humo.foes[0].timed.cegado);
  assert.deepEqual(e.gathered[0].reactions.map(r => r.id), ['humo']);
  const vapor = fight();
  vapor.foes[0].timed = { mojado: wet() }; vapor.foes[1].timed = { quemado: fire(2) };
  e = cast(vapor);
  assert.equal(vapor.foes[0].timed.mojado, undefined); assert.ok(vapor.foes[0].timed.cegado); assert.equal(vapor.foes[0].timed.quemado, undefined);
  assert.deepEqual(e.gathered[0].reactions.map(r => r.id), ['vapor']);
  const boom = fight();
  boom.foes[0].timed = { empolvado: dust() }; boom.foes[1].timed = { quemado: fire(1) };
  const hp = boom.foes.map(f => f.hp);
  e = cast(boom);
  const blast = e.gathered[0].reactions[0];
  assert.equal(blast.id, 'estallido'); assert.equal(boom.foes[0].timed.empolvado, undefined);
  assert.ok(blast.hits.length === 3 && boom.foes.every((f, i) => f.hp < hp[i]), 'the powder\'s blast reaches every foe');
  // Powder that comes finds the fire on the target the same way.
  const back = fight();
  back.foes[0].timed = { quemado: fire(1) }; back.foes[2].timed = { empolvado: dust() };
  assert.equal(cast(back).gathered[0].reactions[0].id, 'estallido');
  const venom = fight();
  venom.foes[0].timed = { empolvado: dust() }; venom.foes[1].timed = { mojado: wet() };
  e = cast(venom);
  assert.equal(e.gathered[0].reactions[0].id, 'veneno'); assert.ok(venom.foes[0].timed.envenenado); assert.equal(venom.foes[0].timed.empolvado, undefined);
  const venom2 = fight();
  venom2.foes[0].timed = { mojado: wet() }; venom2.foes[1].timed = { empolvado: dust() };
  assert.equal(cast(venom2).gathered[0].reactions[0].id, 'veneno');
});

test('no loop with Virus: what comes is not spread, and Virus itself stays where it is', () => {
  const s = fight([...CALCULO, 'tecnopata:confusion', 'tecnopata:control-remoto', 'tecnopata:virus']);
  turn(s, 'aitor'); act(s, 'skill', 'dog-0', 'virus');
  assert.ok(s.foes[0].timed.virus);
  s.foes[1].timed = { quemado: fire(2) }; s.foes[2].timed = { mojado: wet() };
  const e = cast(s);
  assert.equal(e.spread, undefined, 'nothing spreads');
  assert.equal(s.foes[0].timed.quemado, undefined, 'the water that came put out the fire that came: Humo');
  assert.ok(s.foes[0].timed.cegado); assert.ok(!s.foes[1].timed.quemado && !s.foes[2].timed.mojado);
  // On an infected target what is put after it spreads as ever.
  turn(s); const after = act(s, 'skill', 'dog-0', 'foc-binari');
  assert.ok(after.spread?.length);
  // And Virus on another foe does not come with the rest.
  const t = fight([...CALCULO, 'tecnopata:confusion', 'tecnopata:control-remoto', 'tecnopata:virus']);
  turn(t, 'aitor'); act(t, 'skill', 'dog-1', 'virus'); t.foes[1].timed.quemado = fire(1);
  cast(t);
  assert.ok(t.foes[1].timed.virus); assert.equal(t.foes[0].timed.virus, undefined);
  assert.ok(t.foes[0].timed.quemado);
});

test('with one foe only the blow lands; a target felled by it takes nothing; fire does not catch on an onion\'s layers', () => {
  const one = fight(CALCULO, 1);
  one.foes[0].timed = { quemado: fire(1) };
  const e = cast(one);
  assert.ok(e.amount > 0); assert.equal(e.gathered, undefined); assert.equal(one.foes[0].timed.quemado.level, 1);
  const felled = fight();
  felled.foes[0].hp = 1; felled.foes[1].timed = { quemado: fire(2) };
  assert.equal(cast(felled).gathered, undefined); assert.equal(felled.foes[1].timed.quemado.level, 2);
  const onion = fight();
  onion.foes[0].layers = 2; onion.foes[1].timed = { quemado: fire(2), mojado: undefined, cegado: on(1, 5, 10) };
  delete onion.foes[1].timed.mojado;
  cast(onion);
  assert.equal(onion.foes[0].timed.quemado, undefined); assert.equal(onion.foes[1].timed.quemado.level, 2, 'the fire stays where it was');
  assert.ok(onion.foes[0].timed.cegado);
});

test('everything leaves first: the plate\'s order never changes what the others are left with', () => {
  // Powder comes to a burning target: Estallido burns every foe a level more; that new fire stays on each source, the same on all.
  const s = fight(CALCULO, 4);
  s.foes[0].timed = { quemado: fire(1) };
  s.foes[1].timed = { envenenado: on(1, 12, 4) };
  s.foes[2].timed = { empolvado: dust() };
  s.foes[3].timed = { cegado: on(1, 6, 10) };
  const e = cast(s);
  assert.ok(e.gathered.some(g => g.reactions.some(r => r.id === 'estallido')));
  const burns = s.foes.slice(1).map(f => f.timed?.quemado?.level ?? 0);
  assert.ok(burns.every(level => level === burns[0] && level > 0), `every source burns the same: ${burns}`);
  assert.ok(s.foes.slice(1).every(f => !f.timed.envenenado && !f.timed.empolvado && !f.timed.cegado), 'and nothing else stays on them');
  assert.ok(s.foes[0].timed.envenenado && s.foes[0].timed.cegado);
  // The same, the powder on the first source instead of the second: the same outcome.
  const t = fight(CALCULO, 4);
  t.foes[0].timed = { quemado: fire(1) };
  t.foes[1].timed = { empolvado: dust() };
  t.foes[2].timed = { envenenado: on(1, 12, 4) };
  t.foes[3].timed = { cegado: on(1, 6, 10) };
  cast(t);
  assert.deepEqual(t.foes.slice(1).map(f => f.timed?.quemado?.level ?? 0), burns);
});

test('an Estallido that fells its target on the way: what had not reached it is lost with it, and the givers keep none of it', () => {
  const s = fight();
  s.foes[0].timed = { empolvado: dust() };
  s.foes[1].timed = { quemado: fire(2) };
  s.foes[2].timed = { envenenado: on(2, 12, 4), confusion: on(1, 20, 30) };
  // Enough to take the blow and not the blast.
  const blow = fight(); turn(blow); const dealt = act(blow, 'skill', 'dog-0', 'atractor').amount;
  s.foes[0].hp = dealt + 1;
  const e = cast(s);
  assert.equal(s.foes[0].hp, 0, 'the blast fells it');
  assert.equal(e.gathered[0].reactions[0].id, 'estallido');
  assert.deepEqual(e.gathered[1].ids, ['envenenado', 'confusion'], 'the second one\'s statuses left it all the same');
  assert.ok(!s.foes[2].timed.envenenado && !s.foes[2].timed.confusion);
});

test('La crecida\'s water keeps its own Mojado: a Mojado that comes runs into it', () => {
  const s = fight();
  s.foes[0].timed = { agua: on(2, 30, 30), mojado: wet(30) };
  s.foes[1].timed = { mojado: wet(5) };
  cast(s);
  assert.equal(s.foes[0].timed.mojado.left, 30);
  assert.equal(s.foes[1].timed.mojado, undefined);
});

test('Toma de tierra counts a reaction on arrival: maná back', () => {
  const s = fight([...CALCULO, 'matemagico:electrico', 'matemagico:descarga', 'matemagico:toma-de-tierra']);
  s.foes[0].timed = { quemado: fire(1) }; s.foes[1].timed = { mojado: wet() };
  const gerard = turn(s), before = gerard.secondary;
  const e = act(s, 'skill', 'dog-0', 'atractor');
  assert.equal(e.mana, 1); assert.ok(e.passives.some(p => p.id === 'toma-de-tierra'));
  assert.equal(gerard.secondary, before - 2 + 1);
});

test('aimed at a boss\'s part, nothing moves', () => {
  const s = fight();
  s.foes[0].part = true;
  s.foes[1].timed = { quemado: fire(2) };
  const e = cast(s);
  assert.equal(e.gathered, undefined); assert.equal(s.foes[1].timed.quemado.level, 2);
});

test('the smart bot gathers three small fires into one big one, onto the foe that will stand longest', async () => {
  const { decide } = await import('../src/battle-sim.ts');
  const s = fight();
  // Three fires at I add up to one at III, which burns harder than the three apart (`clockWorth`); on the big one it burns all its clock.
  s.foes.forEach((f, i) => { f.maxHp = i === 1 ? 300 : 30; f.hp = f.maxHp; f.timed = { quemado: fire(1) }; });
  turn(s);
  const setup = { fight: 'dogs:3', party: 'gerard:matemagico+aitor:tecnopata', policy: 'smart', ban: ['duals', 'factor-comun', 'foc-binari', 'cardioide', 'analisis', 'defend'] };
  const choice = decide(s, setup, () => .99);
  assert.equal(choice.skill, 'atractor', JSON.stringify(choice));
  assert.equal(choice.target, 'dog-1');
});
