import test from 'node:test';
import assert from 'node:assert/strict';
import { act, createBattle, improve, inflict, addStatus, stacks, skillsFor, runClock, MANA_POINTS, PASSIVES, REACTION_RULES, RESCOLDO, TELEMETRIA, TIMED } from '../src/battle.ts';
import { improvedBy } from '../src/ecos.ts';

// The trees of the own ánimas (docs/animas/README.md § The jar): nodes bought at the jar, the
// elements' skills, Mojado and its reactions, Control remoto and the passives.
const PARTY = [{ id: 'gerard', name: 'Gerard', profile: 'gerard35', classId: 'matemagico' }, { id: 'aitor', name: 'Aitor', profile: 'aitor', classId: 'tecnopata' }];
/** Gerard and Aitor against `dogs` sturdy dogs, with `nodes` bought (ids as the jar has them). */
function fight(nodes = [], dogs = 3) {
  const s = createBattle(PARTY, dogs, false, undefined, ['matemagico', 'tecnopata']);
  improve(s, improvedBy(nodes));
  s.foes.forEach(f => { f.hp = f.maxHp = 999; });
  return s;
}
const by = (s, id) => [...s.allies, ...s.foes].find(c => c.id === id);
/** `id`'s turn, with their maná full. */
const turn = (s, id) => { s.phase = 'player'; s.active = s.allies.indexOf(by(s, id)); delete s.spent; delete s.queued; by(s, id).secondary = by(s, id).maxSecondary; return by(s, id); };
const wet = { level: 1, left: TIMED.mojado.seconds, next: TIMED.mojado.every };
const ELEMENTS = ['matemagico:fuego', 'matemagico:agua', 'matemagico:electrico'];

test('a node is a skill only once it is bought: nothing of the tree from the start, and never by level', () => {
  const bare = fight();
  assert.deepEqual(skillsFor(bare, by(bare, 'gerard')).map(s => s.id), ['foc-binari']);
  assert.deepEqual(skillsFor(bare, by(bare, 'aitor')).map(s => s.id), ['rayo-energia', 'rayo-sanacion']);
  bare.levels = { matemagico: 3, tecnopata: 3 };
  assert.deepEqual(skillsFor(bare, by(bare, 'gerard')).map(s => s.id), ['foc-binari'], 'a level teaches it nothing');
  turn(bare, 'gerard');
  assert.equal(act(bare, 'skill', undefined, 'vasos'), undefined, 'not bought: it cannot be used');
  const some = fight(['matemagico:agua', 'matemagico:vasos', 'tecnopata:confusion', 'tecnopata:control-remoto']);
  assert.deepEqual(skillsFor(some, by(some, 'gerard')).map(s => s.id), ['foc-binari', 'vasos']);
  assert.deepEqual(skillsFor(some, by(some, 'aitor')).map(s => s.id), ['rayo-energia', 'rayo-sanacion', 'confusion', 'control-remoto']);
});

test('Vasos comunicantes: water on every foe leaves them Mojado for 20 seconds; on a fire it is Humo instead', () => {
  const s = fight(['matemagico:agua', 'matemagico:vasos']);
  inflict(s.foes[1], 'quemado'); inflict(s.foes[1], 'quemado');
  const g = turn(s, 'gerard');
  const e = act(s, 'skill', undefined, 'vasos');
  assert.equal(g.secondary, MANA_POINTS - 2); assert.equal(e.element, 'agua');
  assert.equal(e.hits.length, 3); assert.ok(e.hits.every(h => h.amount > 0));
  assert.deepEqual(e.hits.map(h => h.burn), [{ id: 'mojado', level: 1 }, { id: 'cegado', level: 2 }, { id: 'mojado', level: 1 }]);
  assert.ok(s.foes[0].timed.mojado && s.foes[2].timed.mojado);
  assert.equal(s.foes[1].timed.quemado, undefined); assert.equal(s.foes[1].timed.cegado.level, 2); assert.equal(s.foes[1].timed.mojado, undefined);
  assert.deepEqual(e.reaction, { id: 'humo', level: 2 });
  // Mojado hurts nobody and runs out on the clock.
  const hp = s.foes[0].hp;
  assert.deepEqual(runClock(s, TIMED.mojado.seconds - 1), []); assert.equal(s.foes[0].hp, hp); assert.ok(s.foes[0].timed.mojado);
  runClock(s, 1.1); assert.equal(s.foes[0].timed.mojado, undefined);
});

test('Descarga: a bolt on one foe that runs through the water to everyone wet, and leaves them dry', () => {
  const s = fight([...ELEMENTS, 'matemagico:descarga']);
  s.foes[1].timed = { mojado: { ...wet } }; s.foes[2].timed = { mojado: { ...wet } };
  turn(s, 'gerard');
  const hp = s.foes.map(f => f.hp), e = act(s, 'skill', 'dog-0', 'descarga');
  assert.equal(e.element, 'electrico'); assert.ok(e.amount > 0);
  assert.equal(e.reaction.id, 'conduccion');
  assert.deepEqual(e.reaction.hits.map(h => h.target), ['dog-1', 'dog-2'], 'wherever the bolt landed');
  assert.ok(e.reaction.hits.every(h => h.amount >= REACTION_RULES.conduct));
  assert.equal(hp[0] - s.foes[0].hp, e.amount); assert.equal(hp[1] - s.foes[1].hp, e.reaction.hits[0].amount);
  assert.ok(s.foes.every(f => !f.timed?.mojado));
  // Nobody wet: only the bolt.
  const dry = fight([...ELEMENTS, 'matemagico:descarga']); turn(dry, 'gerard');
  assert.equal(act(dry, 'skill', 'dog-0', 'descarga').reaction, undefined);
  // Atacar with electricity conducts too, but only from a wet target.
  const plain = fight(ELEMENTS); plain.foes[1].timed = { mojado: { ...wet } };
  const g = turn(plain, 'gerard'); g.element = 'electrico';
  assert.equal(act(plain, 'attack', 'dog-0').reaction, undefined);
  turn(plain, 'gerard');
  assert.equal(act(plain, 'attack', 'dog-1').reaction.id, 'conduccion');
});

test('fire on Mojado is Vapor: the water goes and leaves Cegado, from Atacar, from Foc Binari and from Factor común', () => {
  const s = fight(ELEMENTS); s.foes[0].timed = { mojado: { ...wet } };
  const g = turn(s, 'gerard'); g.element = 'fuego';
  assert.deepEqual(act(s, 'attack', 'dog-0').reaction, { id: 'vapor', level: 1 });
  assert.equal(s.foes[0].timed.mojado, undefined); assert.equal(s.foes[0].timed.cegado.level, 1);
  const foc = fight(); foc.foes[0].timed = { mojado: { ...wet } }; turn(foc, 'gerard');
  const e = act(foc, 'skill', 'dog-0', 'foc-binari');
  assert.equal(e.reaction.id, 'vapor'); assert.equal(e.burn, undefined); assert.equal(foc.foes[0].timed.quemado, undefined, 'wet, it does not catch');
});

test('Factor común: fire on every foe, and the highest fire among them becomes everyone\'s', () => {
  const s = fight(['matemagico:fuego', 'matemagico:factor-comun']);
  inflict(s.foes[0], 'quemado'); inflict(s.foes[0], 'quemado');
  s.foes[2].timed = { mojado: { ...wet } };
  turn(s, 'gerard');
  const e = act(s, 'skill', undefined, 'factor-comun');
  assert.ok(e.hits.every(h => h.amount > 0));
  assert.equal(s.foes[0].timed.quemado.level, 2); assert.equal(s.foes[1].timed.quemado.level, 2);
  assert.equal(s.foes[0].timed.quemado.left, TIMED.quemado.seconds, 'its clock starts over');
  assert.equal(s.foes[2].timed.quemado, undefined); assert.ok(s.foes[2].timed.cegado, 'the wet one steams');
  assert.deepEqual(e.hits.map(h => h.burn), [{ id: 'quemado', level: 2 }, { id: 'quemado', level: 2 }, { id: 'cegado', level: 1 }]);
  // Nobody burning: it only hurts.
  const cold = fight(['matemagico:fuego', 'matemagico:factor-comun']); turn(cold, 'gerard');
  const none = act(cold, 'skill', undefined, 'factor-comun');
  assert.ok(none.hits.every(h => !h.burn)); assert.ok(cold.foes.every(f => !f.timed?.quemado));
});

test('Control remoto: the foe turns on the strongest of its own now, with its own strength, and forgets its plan', () => {
  const s = fight(['tecnopata:confusion', 'tecnopata:control-remoto']);
  s.foes[2].hp = 500; s.foes[0].intent = { id: 'pisoton', target: 'gerard' };
  const a = turn(s, 'aitor');
  const e = act(s, 'skill', 'dog-0', 'control-remoto');
  assert.equal(a.secondary, MANA_POINTS - 2);
  assert.equal(e.controlled.victim, 'dog-1', 'the one with most PV left'); assert.ok(e.controlled.amount > 20);
  assert.equal(s.foes[1].hp, 999 - e.controlled.amount); assert.equal(s.foes[0].hp, 999);
  assert.equal(s.foes[0].intent, undefined);
  const alone = fight(['tecnopata:confusion', 'tecnopata:control-remoto'], 1); turn(alone, 'aitor');
  assert.equal(act(alone, 'skill', 'dog-0', 'control-remoto').controlled.victim, 'dog-0', 'on itself if alone');
});

test('a passive is on only for whoever wears its ánima, and says so each time it does something', () => {
  // Rescoldo: his fires last longer.
  const s = fight(['matemagico:fuego', 'matemagico:factor-comun', 'matemagico:rescoldo']); turn(s, 'gerard');
  const lit = act(s, 'skill', 'dog-0', 'foc-binari');
  assert.equal(s.foes[0].timed.quemado.left, RESCOLDO);
  assert.deepEqual(lit.passives, [{ id: 'rescoldo', name: PASSIVES.rescoldo.name, who: 'gerard' }]);
  const plain = fight(); turn(plain, 'gerard');
  const cold = act(plain, 'skill', 'dog-0', 'foc-binari');
  assert.equal(plain.foes[0].timed.quemado.left, TIMED.quemado.seconds); assert.equal(cold.passives, undefined);
  // Capilaridad: Atacar with water wets a foe it turns nothing on.
  const c = fight(['matemagico:agua', 'matemagico:vasos', 'matemagico:capilaridad']);
  let g = turn(c, 'gerard'); g.element = 'agua';
  const drop = act(c, 'attack', 'dog-0');
  assert.ok(c.foes[0].timed.mojado); assert.deepEqual(drop.afflicted, { id: 'mojado', level: 1 }); assert.equal(drop.passives[0].id, 'capilaridad');
  inflict(c.foes[1], 'quemado'); g = turn(c, 'gerard'); g.element = 'agua';
  const out = act(c, 'attack', 'dog-1');
  assert.equal(out.reaction.id, 'humo'); assert.equal(c.foes[1].timed.mojado, undefined, 'it put a fire out: no water left on it');
  const dry = fight(['matemagico:agua']); g = turn(dry, 'gerard'); g.element = 'agua';
  act(dry, 'attack', 'dog-0'); assert.equal(dry.foes[0].timed?.mojado, undefined, 'without it, water wets nobody');
});

test('Toma de tierra: a reaction he sets off gives one maná back, once a round', () => {
  const s = fight([...ELEMENTS, 'matemagico:descarga', 'matemagico:toma-de-tierra']);
  s.foes[0].timed = { mojado: { ...wet } }; s.foes[1].timed = { mojado: { ...wet } };
  const g = turn(s, 'gerard'); g.secondary = 1; g.element = 'fuego';
  const first = act(s, 'attack', 'dog-0');
  assert.equal(first.reaction.id, 'vapor'); assert.equal(first.mana, 1); assert.equal(g.secondary, 2);
  assert.equal(first.passives[0].id, 'toma-de-tierra');
  s.phase = 'player'; s.active = s.allies.indexOf(g); delete s.spent; g.element = 'fuego';
  const second = act(s, 'attack', 'dog-1');
  assert.equal(second.reaction.id, 'vapor'); assert.equal(second.mana, undefined, 'only once a round'); assert.equal(g.secondary, 2);
  // Full, there is nothing to give back.
  const full = fight([...ELEMENTS, 'matemagico:descarga', 'matemagico:toma-de-tierra']); full.foes[0].timed = { mojado: { ...wet } };
  const h = turn(full, 'gerard'); h.element = 'fuego';
  assert.equal(act(full, 'attack', 'dog-0').mana, undefined);
});

test('Telemetría: Bip\'s Atacar gives 3 seconds more to what runs out on its target; Nanitos: Rayo de sanación takes a status off', () => {
  const s = fight(['tecnopata:explosion', 'tecnopata:telemetria']);
  s.foes[0].timed = { quemado: { level: 1, left: 4, next: 1 } };
  turn(s, 'aitor');
  const ram = act(s, 'attack', 'dog-0');
  assert.equal(s.foes[0].timed.quemado.left, 4 + TELEMETRIA);
  assert.deepEqual(ram.extended, { statuses: ['quemado'], seconds: TELEMETRIA }); assert.equal(ram.passives[0].id, 'telemetria');
  turn(s, 'aitor');
  assert.equal(act(s, 'attack', 'dog-1').passives, undefined, 'nothing running: nothing to say');
  // Gerard's Atacar is not Bip's.
  s.foes[2].timed = { quemado: { level: 1, left: 4, next: 1 } }; turn(s, 'gerard');
  act(s, 'attack', 'dog-2'); assert.equal(s.foes[2].timed.quemado.left, 4);
  const n = fight(['tecnopata:rayo-encogedor', 'tecnopata:nanitos']);
  const gerard = by(n, 'gerard'); gerard.hp -= 30; addStatus(gerard, 'llorera', 2);
  turn(n, 'aitor');
  const cure = act(n, 'skill', 'gerard', 'rayo-sanacion');
  assert.equal(stacks(gerard, 'llorera'), 0); assert.deepEqual(cure.cleansed, [{ target: 'gerard', statuses: ['llorera'] }]);
  assert.equal(cure.passives[0].id, 'nanitos'); assert.ok(gerard.timed.sanacion, 'and the cure is still a cure');
  const m = fight(); by(m, 'gerard').hp -= 30; addStatus(by(m, 'gerard'), 'llorera', 2); turn(m, 'aitor');
  act(m, 'skill', 'gerard', 'rayo-sanacion'); assert.equal(stacks(by(m, 'gerard'), 'llorera'), 2, 'without it, only the cure');
});
