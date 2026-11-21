import test from 'node:test';
import assert from 'node:assert/strict';
import { act, actDual, bitsOf, createBattle, CRECIDA, DUALS, enemyAct, improve, IDEA_FIJA, POWDER_RULES, runClock, stacks, TIMED, waterOf, CRIT_RULES } from '../src/battle.ts';
import { improvedBy, IMPROVEMENTS, stageOf } from '../src/ecos.ts';

// The dúos mayores of every line but fire (docs/animas/README.md § Dúos mayores) and the duals of the pairs that had
// none (§ Combined skills): Marea, Fulgurita, Suceso seguro, Metralla, Idea fija, Caleidoscopio; Géiser, A escala, Seiche,
// Staccato, Cadáver exquisito, Trampantojo.
const NODES = {
  marea: ['matemagico:agua', 'matemagico:vasos', 'matemagico:capilaridad', 'matemagico:marea'],
  fulgurita: ['matemagico:electrico', 'matemagico:descarga', 'matemagico:toma-de-tierra', 'matemagico:cortocircuito', 'matemagico:condensador', 'matemagico:fulgurita'],
  'suceso-seguro': ['matemagico:angulo', 'matemagico:analisis', 'matemagico:cardioide', 'matemagico:mana-1', 'matemagico:integral', 'matemagico:suceso-seguro'],
  metralla: ['tecnopata:explosion', 'tecnopata:telemetria', 'tecnopata:reinicio', 'tecnopata:metralla'],
  'idea-fija': ['tecnopata:confusion', 'tecnopata:control-remoto', 'tecnopata:virus', 'tecnopata:idea-fija'],
  caleidoscopio: ['tecnopata:rayo-encogedor', 'tecnopata:nanitos', 'tecnopata:escudo-de-bits', 'tecnopata:redundancia', 'tecnopata:caleidoscopio'],
};
const LEVELS = { papagato: 7, dadaista: 7, sincopante: 7, prismatico: 7, freatica: 7 };
/** Gerard in `g` and Aitor in `a`, every shared ánima grown, `nodes` bought, against three sturdy dogs; Gerard to act. */
function pair(g, a, nodes = []) {
  const s = createBattle([{ id: 'gerard', name: 'Gerard', profile: 'gerard35', classId: g }, { id: 'aitor', name: 'Aitor', profile: 'aitor', classId: a }], 3, false, undefined, [g, a]);
  s.levels = { ...LEVELS };
  improve(s, improvedBy(nodes));
  s.foes.forEach(f => { f.hp = f.maxHp = 999; });
  s.phase = 'player'; s.active = 0;
  for (const ally of s.allies) ally.secondary = ally.maxSecondary;
  return s;
}
const by = (s, id) => [...s.allies, ...s.foes].find(c => c.id === id);
const water = (level, left = CRECIDA.mark) => ({ agua: { level, left, next: CRECIDA.mark }, mojado: { level: 1, left: 20, next: 20 } });
const foesTurn = s => { s.phase = 'enemy'; s.enemyActions = []; };

test('every dúo mayor has its node past the top of its line, after Aurelià, and is not there without it', () => {
  const majors = DUALS.filter(d => d.major).map(d => d.id);
  assert.deepEqual(majors, ['vulcano', 'marea', 'fulgurita', 'suceso-seguro', 'metralla', 'idea-fija', 'caleidoscopio']);
  for (const id of majors) {
    const node = IMPROVEMENTS.find(item => item.kind === 'dual' && item.dual === id);
    assert.ok(node, id); assert.equal(stageOf(node), 2, `${id}: after the first boss`); assert.equal(node.cost, 2);
  }
  // One a line: seven lines, seven dúos mayores.
  assert.equal(new Set(IMPROVEMENTS.filter(item => item.kind === 'dual').map(item => item.line)).size, 7);
  const locked = pair('matemagico', 'freatica', NODES.marea.slice(0, -1));
  assert.equal(actDual(locked, 'marea'), undefined);
});

test('Marea: every water to the highest and a mark more, and for 20 seconds what rises in one rises in all', () => {
  const s = pair('matemagico', 'freatica', NODES.marea);
  s.foes[1].timed = water(1);
  const e = actDual(s, 'marea');
  assert.equal(e.dual.id, 'marea'); assert.ok(e.hits.every(h => h.amount > 0));
  assert.deepEqual(s.foes.map(waterOf), [2, 2, 2]); assert.ok(s.foes.every(f => f.timed.marea));
  assert.equal(s.water.by, 'aitor', 'held by whoever wears Freática');
  // Recarga on one raises the three.
  s.phase = 'player'; s.active = 1; delete s.spent; by(s, 'aitor').secondary = 3;
  act(s, 'skill', 'dog-0', 'recarga');
  assert.deepEqual(s.foes.map(waterOf), [3, 3, 3]); assert.ok(s.foes.every(f => f.timed.hundido));
  runClock(s, TIMED.marea.seconds + .1);
  assert.ok(s.foes.every(f => !f.timed?.marea), 'the cells part again');
});

test('Fulgurita: every foe full of shards, and a blow on one drives them deeper in all', () => {
  const s = pair('matemagico', 'prismatico', NODES.fulgurita);
  const e = actDual(s, 'fulgurita');
  assert.equal(e.hits.length, 3);
  assert.ok(s.foes.every(f => f.timed.cristalizado?.level === 1 && f.timed.fulgurita));
  s.phase = 'player'; s.active = 0; delete s.spent;
  const blow = act(s, 'attack', 'dog-0');
  assert.equal(blow.amplified[0].shards, POWDER_RULES.shard);
  assert.deepEqual(s.foes.map(f => f.timed.cristalizado.level), [2, 2, 2], 'one count');
});

test('Suceso seguro: both boosts for three rounds, and every blow a golpe crítico up to the end of the next round', () => {
  const was = CRIT_RULES.chance; CRIT_RULES.chance = 0;
  try {
    const s = pair('matemagico', 'dadaista', NODES['suceso-seguro']);
    const dice = by(s, 'aitor').dice?.length;
    const e = actDual(s, 'suceso-seguro');
    assert.equal(e.dual.id, 'suceso-seguro'); assert.deepEqual(e.boosted, ['gerard', 'aitor']);
    assert.ok(s.boosts.analisis && s.boosts['ases-en-duo']); assert.equal(s.certain, s.round + 1);
    if (dice !== undefined) assert.equal(by(s, 'aitor').dice.length, dice - 1, 'Dadista pays its die');
    s.phase = 'player'; s.active = 0; delete s.spent;
    assert.equal(act(s, 'attack', 'dog-0').crit, true);
    s.round += 2; s.phase = 'player'; s.active = 0; delete s.spent;
    assert.ok(!act(s, 'attack', 'dog-0').crit, 'two rounds on, luck is luck again');
  } finally { CRIT_RULES.chance = was; }
});

test('Metralla: every foe cut, and for 20 seconds a physical blow takes the wound\'s bonus and leaves the wound', () => {
  const s = pair('papagato', 'tecnopata', NODES.metralla);
  const e = actDual(s, 'metralla');
  assert.ok(e.hits.every(h => h.amount > 0 && h.status.id === 'sangrado'));
  assert.ok(s.foes.every(f => stacks(f, 'sangrado') === 2 && f.timed.metralla));
  s.phase = 'player'; s.active = 1; delete s.spent;
  const blow = act(s, 'attack', 'dog-0');
  assert.equal(blow.bled, 2, 'the wound is charged'); assert.equal(stacks(s.foes[0], 'sangrado'), 2, 'and stays open');
  delete s.foes[1].timed.metralla;
  s.phase = 'player'; s.active = 1; delete s.spent;
  act(s, 'attack', 'dog-1');
  assert.equal(stacks(s.foes[1], 'sangrado'), 0, 'without it a wound is spent as always');
});

test('Idea fija: an eco in a foe\'s head; every 5 seconds it strikes the strongest of its own, for 20', () => {
  const s = pair('sincopante', 'tecnopata', NODES['idea-fija']);
  s.foes[2].hp = 900;
  const e = actDual(s, 'idea-fija', 'dog-0');
  assert.equal(e.amount, undefined, 'no blow of its own'); assert.deepEqual(e.left, { id: 'idea-fija', targets: ['dog-0'] });
  s.phase = 'player';
  const pulses = runClock(s, TIMED['idea-fija'].every + .01);
  assert.equal(pulses.length, 1); assert.equal(pulses[0].target, 'dog-1'); assert.equal(pulses[0].by, 'dog-0');
  assert.equal(pulses[0].amount, IDEA_FIJA + s.foes[0].stats.fuerza - 10); assert.equal(s.foes[0].hp, 999, 'it does not hurt its carrier');
  for (let i = 0; i < 3; i++) runClock(s, TIMED['idea-fija'].every);
  assert.equal(s.foes[0].timed['idea-fija'], undefined);
  assert.equal(s.foes[1].hp + s.foes[2].hp, 999 + 900 - 4 * pulses[0].amount, 'four blows in its twenty seconds, each on whoever has most PV then');
});

test('Caleidoscopio: a dome that stops the blow, gives it back to whoever struck it, and powders them', () => {
  const s = pair('prismatico', 'tecnopata', NODES.caleidoscopio);
  const e = actDual(s, 'caleidoscopio');
  assert.deepEqual(e.bits, { raised: 40 }); assert.ok(bitsOf(s).mirror);
  foesTurn(s);
  const blow = enemyAct(s, 'dog-0', 'gerard');
  assert.ok(blow.bits.took > 0); assert.deepEqual(blow.mirrored, { target: 'dog-0', amount: blow.bits.took });
  assert.equal(s.foes[0].hp, 999 - blow.bits.took); assert.ok(s.foes[0].timed.empolvado);
  assert.equal(by(s, 'gerard').hp, by(s, 'gerard').maxHp);
});

test('Géiser: a blow for each mark of its water, all of it spent, and the steam blinds every foe at that level', () => {
  const s = pair('matemagico', 'freatica');
  s.foes[0].timed = water(3);
  const e = actDual(s, 'geiser', 'dog-0');
  assert.equal(e.strikes.length, 3); assert.equal(waterOf(s.foes[0]), 0);
  assert.deepEqual(s.foes.map(f => f.timed.cegado.level), [3, 3, 3]); assert.deepEqual(e.vapour, ['dog-0', 'dog-1', 'dog-2']);
  const dry = pair('matemagico', 'freatica');
  const one = actDual(dry, 'geiser', 'dog-1');
  assert.equal(one.strikes, undefined, 'one blow on a dry foe'); assert.equal(dry.foes[0].timed.cegado.level, 1);
});

test('A escala: shrunk and a mark of water more; a shrunk foe is under at the second mark', () => {
  const s = pair('freatica', 'tecnopata', ['tecnopata:rayo-encogedor']);
  s.foes[0].timed = water(1);
  const e = actDual(s, 'a-escala', 'dog-0');
  assert.ok(e.amount > 0); assert.equal(waterOf(s.foes[0]), 2);
  assert.ok(s.foes[0].timed.encogido && s.foes[0].timed.hundido, 'sunk at two');
  s.foes[1].timed = water(2); runClock(s, .1);
  assert.equal(s.foes[1].timed.hundido, undefined, 'a foe its own size is not');
});

test('Seiche: water on every foe, and an eco that strikes again every 5 seconds and keeps their water from draining', () => {
  const s = pair('freatica', 'sincopante');
  s.foes[0].timed = water(2, 6);
  const e = actDual(s, 'seiche');
  assert.equal(e.hits.length, 3); assert.ok(s.foes.every(f => f.timed.seiche));
  s.phase = 'player';
  const pulses = runClock(s, TIMED.seiche.every + .01);
  assert.equal(pulses.filter(p => p.status === 'seiche').length, 3);
  for (let i = 0; i < 3; i++) runClock(s, TIMED.seiche.every);
  assert.equal(waterOf(s.foes[0]), 2, 'twenty seconds on, the water has not lost a mark');
});

test('Staccato: a cut that piles up, and an eco that cuts again on every beat', () => {
  const s = pair('papagato', 'sincopante');
  s.foes[0].statuses = { sangrado: 1 };
  const e = actDual(s, 'staccato', 'dog-0');
  assert.equal(e.bled, undefined, 'it spends no wound'); assert.deepEqual(e.status, { id: 'sangrado', stacks: 3 });
  s.phase = 'player';
  runClock(s, TIMED.staccato.every + .01);
  assert.equal(stacks(s.foes[0], 'sangrado'), 4);
  for (let i = 0; i < 3; i++) runClock(s, TIMED.staccato.every);
  assert.equal(stacks(s.foes[0], 'sangrado'), 7); assert.equal(s.foes[0].timed.staccato, undefined);
});

test('Cadáver exquisito: three handfuls, each with an element by the dice; with a Racha of three, no two alike', () => {
  const s = pair('prismatico', 'dadaista');
  by(s, 'aitor').racha = 3;
  const e = actDual(s, 'cadaver-exquisito', 'dog-0');
  assert.equal(e.strikes.length, 3); assert.deepEqual([...e.drawn].sort(), ['agua', 'electrico', 'fuego']);
  const foe = s.foes[0];
  assert.ok(foe.timed.quemado && foe.timed.envenenado && foe.timed.cristalizado, 'the powder has been all three things');
  assert.deepEqual([...s.finale.seen].sort(), ['cristal', 'estallido', 'veneno']);
  const luck = pair('prismatico', 'dadaista');
  assert.equal(actDual(luck, 'cadaver-exquisito', 'dog-0').drawn.length, 3);
});

test('Trampantojo: a cortina on any ally; the foe that breaks it is powdered and does not know whose side it is on', () => {
  const s = pair('prismatico', 'tecnopata', ['tecnopata:confusion']);
  const gerard = by(s, 'gerard');
  const e = actDual(s, 'trampantojo', 'gerard');
  assert.deepEqual(e.cortina.raised, ['gerard']); assert.ok(gerard.decoy);
  foesTurn(s);
  const blow = enemyAct(s, 'dog-0', 'gerard');
  assert.equal(blow.fooled, 'dog-0'); assert.equal(s.foes[0].timed.confusion.left, 20); assert.ok(s.foes[0].timed.empolvado);
  assert.equal(gerard.decoy, undefined);
});
