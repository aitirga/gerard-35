import test from 'node:test';
import assert from 'node:assert/strict';
import { act, actDual, bitsOf, createBattle, CRECIDA, DUALS, dualSingle, enemyAct, GAS, gasOf, improve, IDEA_FIJA, POWDER_RULES, runClock, stacks, TIMED, waterOf, CRIT_RULES } from '../src/battle.ts';
import { improvedBy, IMPROVEMENTS, stageOf } from '../src/ecos.ts';
import { MAT_FRE, createFight, decide, legalChoices } from '../src/battle-sim.ts';

// The dúos mayores of every line but fire (docs/animas/README.md § Dúos mayores) and the duals of the pairs that had
// none (§ Combined skills): Marea, Fulgurita, Suceso seguro, Metralla, Idea fija, Caleidoscopio; Géiser, A escala, Seiche,
// Staccato, Cadáver exquisito, Trampantojo.
const NODES = {
  marea: ['matemagico:agua', 'matemagico:vasos', 'matemagico:capilaridad', 'matemagico:marea'],
  fulgurita: ['matemagico:electrico', 'matemagico:descarga', 'matemagico:toma-de-tierra', 'matemagico:cortocircuito', 'matemagico:condensador', 'matemagico:fulgurita'],
  'suceso-seguro': ['matemagico:angulo', 'matemagico:analisis', 'matemagico:cardioide', 'matemagico:mana-1', 'matemagico:integral', 'matemagico:suceso-seguro'],
  metralla: ['tecnopata:explosion', 'tecnopata:telemetria', 'tecnopata:reinicio', 'tecnopata:metralla'],
  'idea-fija': ['tecnopata:confusion', 'tecnopata:control-remoto', 'tecnopata:virus', 'tecnopata:idea-fija'],
  caleidoscopio: ['tecnopata:escolta', 'tecnopata:nanitos', 'tecnopata:escudo-de-bits', 'tecnopata:redundancia', 'tecnopata:caleidoscopio'],
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
    assert.ok(node, id); assert.equal(stageOf(node), 2, `${id}: after the first boss`); assert.equal(node.cost, 3, 'a dúo mayor costs 3 ecos (2026-11-24)');
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

test('Géiser: a blow for each mark of its water, all of it spent, and the steam blinds every foe', () => {
  const s = pair('matemagico', 'freatica');
  s.foes[0].timed = water(3);
  const e = actDual(s, 'geiser', 'dog-0');
  assert.equal(e.strikes.length, 3); assert.equal(waterOf(s.foes[0]), 0);
  assert.deepEqual(s.foes.map(f => f.timed.cegado.level), [1, 1, 1], 'Cegado has no levels'); assert.deepEqual(e.vapour, ['dog-0', 'dog-1', 'dog-2']);
  const dry = pair('matemagico', 'freatica');
  const one = actDual(dry, 'geiser', 'dog-1');
  assert.equal(one.strikes, undefined, 'one blow on a dry foe'); assert.equal(dry.foes[0].timed.cegado.level, 1);
});

test('A escala: shrunk and a mark of water more; a shrunk foe is under at the second mark', () => {
  const s = pair('freatica', 'tecnopata', ['tecnopata:escolta', 'tecnopata:nanitos', 'tecnopata:escudo-de-bits', 'tecnopata:redundancia', 'tecnopata:rayo-encogedor']);
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

// Electrólisis (Matemágico's Cubo acuático + Freática's Sondeo eléctrico): the water split into gas, set off by the next fire.
const ELECTRO = ['matemagico:agua', 'matemagico:vasos'];
/** Gerard on Matemágico and Aitor on Freática, Electrólisis known, and `levels` of water under each foe (0: dry; 'wet': only Mojado). */
function gassing(levels = [1, 2, 3]) {
  const s = pair('matemagico', 'freatica', ELECTRO);
  s.foes.forEach((f, i) => { if (levels[i] === 'wet') f.timed = { mojado: { level: 1, left: 20, next: 20 } }; else if (levels[i]) f.timed = water(levels[i]); });
  return s;
}
/** Gerard's turn again, maná full, the round fresh. */
function again(s, who = 0) { s.phase = 'player'; s.active = who; delete s.spent; for (const a of s.allies) a.secondary = a.maxSecondary; }

test('Electrólisis: every foe\'s water becomes gas at its level (the marks, or I if only wet), dry and with no current', () => {
  const s = gassing([3, 'wet', 0]);
  s.foes[0].timed.corriente = { level: 3, left: 10, next: 2 };
  const e = actDual(s, 'electrolisis');
  assert.equal(e.dual.id, 'electrolisis'); assert.equal(e.hits.length, 3); assert.ok(e.hits.every(h => h.amount > 0));
  assert.deepEqual(s.foes.map(gasOf), [3, 1, 0], 'three marks make gas III, Mojado alone gas I, a dry foe none');
  assert.deepEqual(e.gas, [{ target: 'dog-0', level: 3 }, { target: 'dog-1', level: 1 }]);
  assert.deepEqual(e.left, { id: 'gas', targets: ['dog-0', 'dog-1'] });
  for (const f of s.foes) assert.ok(!f.timed?.agua && !f.timed?.mojado && !f.timed?.corriente && !f.timed?.hundido, `${f.id} is dry`);
  assert.deepEqual(e.water, [{ target: 'dog-0', from: 3, to: 0 }], 'the water it took, for the cells to drain');
  assert.equal(s.foes[0].timed.gas.left, TIMED.gas.seconds);
});

test('Electrólisis: the water splits, it does not conduct (no Conducción, no Shock), and frozen water is not water', () => {
  const s = gassing([2, 2, 2]);
  s.foes[2].timed = { congelado: { level: 2, left: 40, next: 60 } };
  const e = actDual(s, 'electrolisis');
  assert.equal(e.reaction, undefined); assert.equal(e.shocked, undefined); assert.equal(e.current, undefined);
  assert.ok(s.foes.every(f => !f.shock));
  assert.deepEqual(s.foes.map(gasOf), [2, 2, 0], 'the ice is not split');
  assert.ok(s.foes[2].timed.congelado, 'and stays ice');
});

test('Electrólisis: the next fire blow on one sets off the gas of all, each by its level, and leaves them burning', () => {
  const s = gassing([1, 2, 3]);
  actDual(s, 'electrolisis');
  again(s);
  const hp = s.foes.map(f => f.hp);
  const e = act(s, 'skill', 'dog-1', 'foc-binari');
  assert.equal(e.ignited.from, 'dog-1');
  assert.deepEqual(e.ignited.hits.map(h => h.target), ['dog-1', 'dog-0', 'dog-2'], 'from the one the fire found outwards');
  assert.deepEqual(e.ignited.hits.map(h => h.level), [2, 1, 3]);
  const blast = Object.fromEntries(e.ignited.hits.map(h => [h.target, h.amount]));
  assert.ok(blast['dog-2'] > blast['dog-1'] && blast['dog-1'] > blast['dog-0'], 'more gas, a bigger blast');
  assert.equal(s.foes[0].hp, hp[0] - blast['dog-0']); assert.equal(s.foes[2].hp, hp[2] - blast['dog-2']);
  assert.ok(s.foes.every(f => gasOf(f) === 0), 'the gas is gone');
  assert.ok(s.foes.every(f => f.timed.quemado?.level >= 1), 'every one burns');
  assert.deepEqual(e.ignited.burns.map(b => b.target).sort(), ['dog-0', 'dog-1', 'dog-2']);
  // Gone: the next fire is only fire.
  again(s);
  assert.equal(act(s, 'skill', 'dog-0', 'foc-binari').ignited, undefined);
});

test('Electrólisis: any fire sets it off (Atacar with fire, a fire on everyone); a fire pulse never does', () => {
  const a = gassing([1, 1, 1]);
  improve(a, improvedBy([...ELECTRO, 'matemagico:fuego']));
  actDual(a, 'electrolisis');
  a.foes[0].timed.quemado = { level: 2, left: 10, next: 2 };
  a.phase = 'player';
  const pulses = runClock(a, 6.1);
  assert.ok(pulses.some(p => p.status === 'quemado'), 'the fire pulsed');
  assert.deepEqual(a.foes.map(gasOf), [1, 1, 1], 'and the gas is still there');
  again(a);
  a.allies[0].element = 'fuego';
  const swing = act(a, 'attack', 'dog-2');
  assert.equal(swing.element, 'fuego'); assert.equal(swing.ignited?.hits.length, 3, 'Atacar with fire');
  const b = gassing([1, 1, 1]);
  improve(b, improvedBy([...ELECTRO, 'matemagico:fuego', 'matemagico:factor-comun']));
  actDual(b, 'electrolisis'); again(b);
  assert.equal(act(b, 'skill', undefined, 'factor-comun').ignited?.hits.length, 3, 'Pirámide ígnea on everyone');
  // Water or electricity on it do nothing to it.
  const c = gassing([1, 1, 1]);
  actDual(c, 'electrolisis'); again(c);
  assert.equal(act(c, 'attack', 'dog-0').ignited, undefined);
  assert.deepEqual(c.foes.map(gasOf), [1, 1, 1]);
});

test('Electrólisis: the gas blast is magic fire, so a foe weak to fire takes more and one that resists it less', () => {
  const s = gassing([1, 1, 1]);
  s.foes[0].affinities = { fuego: 'weak' }; s.foes[2].affinities = { fuego: 'resist' };
  actDual(s, 'electrolisis'); again(s);
  s.foes.forEach(f => { f.hp = f.maxHp; });
  const e = act(s, 'skill', 'dog-1', 'foc-binari');
  const blast = Object.fromEntries(e.ignited.hits.map(h => [h.target, h.amount]));
  assert.ok(blast['dog-0'] > blast['dog-1'] && blast['dog-1'] > blast['dog-2'], JSON.stringify(blast));
  assert.equal(GAS.blast, 12);
});

test('Electrólisis: unlit, the gas goes after 20 seconds', () => {
  const s = gassing([2, 2, 2]);
  actDual(s, 'electrolisis');
  s.phase = 'player';
  runClock(s, TIMED.gas.seconds - 1);
  assert.deepEqual(s.foes.map(gasOf), [2, 2, 2]);
  runClock(s, 1.1);
  assert.deepEqual(s.foes.map(gasOf), [0, 0, 0]);
});

test('Electrólisis: the simulator\'s pair of Matemágico and Freática can play it', () => {
  const s = createFight({ fight: 'dogs:3', party: MAT_FRE, levels: { freatica: 4, matemagico: 4 }, improved: ELECTRO, policy: 'smart' }, () => .5);
  s.foes.forEach(f => { f.timed = water(2); });
  s.phase = 'player'; s.active = 0;
  for (const a of s.allies) a.secondary = a.maxSecondary;
  const options = legalChoices(s, {}, true, true).filter(o => o.dual === 'electrolisis');
  assert.ok(options.length, 'it is among the choices');
  assert.ok(['dual', 'skill', 'attack', 'defend'].includes(decide(s, { policy: 'smart' }, () => .5).action));
  actDual(s, 'electrolisis');
  assert.deepEqual(s.foes.map(gasOf), [2, 2, 2]);
});

test('two players agree on one fighter only when a dual goes to one (dualSingle)', () => {
  const single = DUALS.filter(dualSingle).map(d => d.id);
  // On one foe, or one ally (Sutura de luz cures one, Trampantojo's cortina stands before one).
  for (const id of ['zarpazos-de-fuego', 'punto-debil', 'reserva-de-color', 'idea-fija', 'sutura-de-luz', 'trampantojo']) assert.ok(single.includes(id), id);
  // On every foe, or on the whole party: nobody to agree on.
  for (const id of ['rayo-solar', 'bombardeo-orbital', 'sobrecalentamiento', 'vulcano', 'marea', 'metralla', 'seiche', 'suceso-seguro', 'caleidoscopio', 'electrolisis']) assert.ok(!single.includes(id), id);
});
