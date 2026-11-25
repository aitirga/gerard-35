import test from 'node:test';
import assert from 'node:assert/strict';
import { act, actDual, addStatus, createBattle, dualSingle, enemyAct, improve, nextRound, stacks, takeNews, CONDENSADOR, CRIT_RULES, DUALS, TIMED } from '../src/battle.ts';
import { improvedBy } from '../src/ecos.ts';

// Arco voltaico (docs/animas/README.md § Combined skills): ∂Q/∂t Condensador + Acecho. The cat waits charged on its prey
// and lands as the next round starts, a blow that is physical and electric at once, a golpe crítico for sure. A foe that
// strikes the one waiting first takes the charge, and the blow lands at half.
const ELECTRIC = ['matemagico:electrico', 'matemagico:descarga', 'matemagico:toma-de-tierra', 'matemagico:cortocircuito', 'matemagico:condensador'];
const FIRE = ['matemagico:fuego', 'matemagico:factor-comun', 'matemagico:rescoldo', 'matemagico:combustion'];
/** Gerard (Matemágico, the electric line bought as far as the condenser) and Aitor (Papagato 7) against three sturdy dogs; Gerard to act. */
function pair(nodes = []) {
  const s = createBattle([{ id: 'gerard', name: 'Gerard', profile: 'gerard35', classId: 'matemagico' }, { id: 'aitor', name: 'Aitor', profile: 'aitor', classId: 'papagato' }], 3, false, undefined, ['matemagico', 'papagato']);
  s.levels = { papagato: 7 };
  improve(s, improvedBy([...ELECTRIC, ...nodes]));
  s.foes.forEach(f => { f.hp = f.maxHp = 999; });
  s.phase = 'player'; s.active = 0;
  for (const ally of s.allies) ally.secondary = ally.maxSecondary;
  return s;
}
const by = (s, id) => [...s.allies, ...s.foes].find(c => c.id === id);
/** The foes' turn is over: the round can end. */
const foesDone = s => { s.phase = 'enemy'; s.enemyActions = s.foes.map(f => f.id); };
/** The dual on `target`, the round played out with no foe moving, and the pounce that came of it. */
function landed(s, target = 'dog-0') {
  actDual(s, 'arco-voltaico', target);
  foesDone(s); nextRound(s);
  return takeNews(s).find(n => n.pounce);
}
const burning = level => ({ quemado: { level, left: TIMED.quemado.seconds, next: TIMED.quemado.every } });
const wet = () => ({ mojado: { level: 1, left: 20, next: 20 } });

test('Arco voltaico pairs the condenser with Acecho, aims at one foe, and is there only once both halves are', () => {
  const d = DUALS.find(x => x.id === 'arco-voltaico');
  assert.deepEqual(d.parts, ['condensador', 'acecho']); assert.equal(d.kind, 'physical'); assert.equal(d.element, 'electrico');
  assert.ok(dualSingle(d), 'both players pick the same prey');
  const early = pair(); early.levels = { papagato: 5 };
  assert.equal(actDual(early, 'arco-voltaico', 'dog-0'), undefined, 'no Acecho before Papagato 6');
  const bare = createBattle([{ id: 'gerard', name: 'Gerard', profile: 'gerard35', classId: 'matemagico' }, { id: 'aitor', name: 'Aitor', profile: 'aitor', classId: 'papagato' }], 3, false, undefined, ['matemagico', 'papagato']);
  bare.levels = { papagato: 7 }; bare.phase = 'player'; bare.active = 0;
  assert.equal(actDual(bare, 'arco-voltaico', 'dog-0'), undefined, 'no condenser before its node');
});

test('Arco voltaico: nothing lands on its turn; the cat waits charged on its prey, both pay their half and both turns go', () => {
  const s = pair(), gerard = by(s, 'gerard'), aitor = by(s, 'aitor');
  const e = actDual(s, 'arco-voltaico', 'dog-1');
  assert.equal(e.dual.id, 'arco-voltaico'); assert.equal(e.amount, undefined); assert.equal(s.foes[1].hp, 999, 'nothing yet');
  assert.equal(e.stalking, 'dog-1'); assert.equal(e.stalker, 'aitor', 'whoever brings Acecho waits');
  assert.deepEqual(aitor.stalk, { target: 'dog-1', dual: 'arco-voltaico', charged: true }); assert.equal(gerard.stalk, undefined);
  assert.equal(gerard.secondary, gerard.maxSecondary - 1); assert.equal(aitor.secondary, aitor.maxSecondary - 2);
  assert.deepEqual([...s.spent].sort(), ['aitor', 'gerard']); assert.deepEqual(s.usedDuals, ['arco-voltaico']);
  assert.match(s.message, /Saltará al empezar la siguiente ronda/);
});

test('Arco voltaico lands as the next round starts: a physical and electric blow with the cat\'s stats, a golpe crítico for sure, that spends the wound', () => {
  const s = pair();
  addStatus(s.foes[0], 'sangrado', 3);
  const p = landed(s);
  assert.equal(p.pounceDual.id, 'arco-voltaico'); assert.equal(p.pounceDual.half, undefined);
  assert.equal(p.actor, 'aitor'); assert.equal(p.target, 'dog-0'); assert.equal(p.element, 'electrico');
  assert.equal(p.crit, true); assert.equal(p.bled, 2); assert.equal(stacks(s.foes[0], 'sangrado'), 0);
  assert.equal(by(s, 'aitor').stalk, undefined); assert.equal(s.phase, 'player', 'before anyone chooses');
  assert.match(s.message, /¡Arco voltaico!/);
  // Stronger than Acecho alone on the same foe.
  const alone = pair(); alone.active = 1; addStatus(alone.foes[0], 'sangrado', 3);
  act(alone, 'skill', 'dog-0', 'acecho'); foesDone(alone); nextRound(alone);
  assert.ok(p.amount > takeNews(alone)[0].amount * 1.4, `${p.amount}: the charge is in the blow`);
});

test('Arco voltaico: a foe that strikes the one waiting first takes the charge, a bolt that turns what it finds, and the blow lands at half', () => {
  const s = pair();
  actDual(s, 'arco-voltaico', 'dog-0');
  s.foes[2].timed = burning(2);
  s.phase = 'enemy'; s.enemyActions = [];
  const blow = enemyAct(s, 'dog-2', 'aitor');
  assert.ok(blow.amount > 0, 'it struck the cat\'s wearer');
  assert.equal(blow.discharge.arc, true); assert.equal(blow.discharge.from, 'aitor'); assert.equal(blow.discharge.target, 'dog-2'); assert.ok(blow.discharge.amount > 0);
  assert.equal(blow.discharge.reaction.id, 'plasma', 'the bolt sets off the fire it finds'); assert.equal(s.foes[2].timed.quemado, undefined);
  assert.equal(by(s, 'aitor').stalk.charged, false, 'the moment is kept, without its charge');
  assert.match(s.message, /salta de Aitor a/);
  // A second blow on the cat finds no charge.
  s.enemyActions = [];
  assert.equal(enemyAct(s, 'dog-1', 'aitor').discharge, undefined);
  s.enemyActions = s.foes.map(f => f.id); nextRound(s);
  const half = takeNews(s).find(n => n.pounce);
  assert.equal(half.pounceDual.half, true); assert.equal(half.target, 'dog-0');
  // Its weight: the dual at `jumped` of its power.
  const d = DUALS.find(x => x.id === 'arco-voltaico'), power = d.power;
  const full = () => { const t = pair(); return landed(t).amount; };
  const whole = full();
  d.power = power * d.jumped; const halved = full(); d.power = power;
  assert.equal(half.amount, halved); assert.ok(half.amount < whole * .7);
  assert.ok(blow.discharge.amount < CONDENSADOR.jump * 3, 'the jump is the condenser\'s');
});

test('Arco voltaico turns what Atacar·Eléctrico would: Plasma on a fire, Conducción through the water', () => {
  const s = pair();
  s.foes[0].timed = burning(2);
  const p = landed(s);
  assert.equal(p.reaction.id, 'plasma'); assert.equal(s.foes[0].timed?.quemado, undefined);
  const w = pair();
  w.foes[0].timed = wet(); w.foes[2].timed = wet();
  const q = landed(w);
  assert.equal(q.reaction.id, 'conduccion'); assert.deepEqual(q.reaction.hits.map(h => h.target).sort(), ['dog-0', 'dog-2']);
});

test('Arco voltaico on a fire at Combustión goes the same way as Atacar·Eléctrico: Plasma takes it, and on powder the blow bursts it', () => {
  const was = CRIT_RULES.chance; CRIT_RULES.chance = 0;
  try {
    // What Atacar·Eléctrico does to a Quemado IV, with and without powder over it.
    const atacar = powder => {
      const t = pair(FIRE); t.active = 0;
      t.foes[0].timed = { ...burning(4), ...powder ? { empolvado: { level: 1, left: 20, next: 20 } } : {} };
      t.allies[0].element = 'electrico';
      const e = act(t, 'attack', 'dog-0');
      return { reaction: e.reaction?.id, combustion: !!e.combustion };
    };
    const arco = powder => {
      const t = pair(FIRE);
      t.foes[0].timed = { ...burning(4), ...powder ? { empolvado: { level: 1, left: 20, next: 20 } } : {} };
      actDual(t, 'arco-voltaico', 'dog-0');
      // The clock does not run between the turns here: the fire is still at IV when the cat lands.
      foesDone(t); t.foes[0].timed = { ...burning(4), ...powder ? { empolvado: { level: 1, left: 20, next: 20 } } : {} };
      nextRound(t);
      const p = takeNews(t).find(n => n.pounce);
      return { reaction: p.reaction?.id, combustion: !!p.combustion };
    };
    for (const powder of [false, true]) assert.deepEqual(arco(powder), atacar(powder), powder ? 'with powder' : 'bare');
    assert.deepEqual(arco(true), { reaction: 'cristal', combustion: true }, 'the powder sets as shards first, and the physical blow sets the fire off');
  } finally { CRIT_RULES.chance = was; }
});

test('Arco voltaico: the prey fallen, the cat takes whoever bleeds most; its wearer fallen or out of Papagato, the moment is lost', () => {
  const s = pair();
  actDual(s, 'arco-voltaico', 'dog-0');
  s.foes[0].hp = 0; addStatus(s.foes[1], 'sangrado', 4);
  foesDone(s); nextRound(s);
  assert.equal(takeNews(s).find(n => n.pounce).target, 'dog-1');
  const fell = pair(); actDual(fell, 'arco-voltaico', 'dog-0');
  by(fell, 'aitor').hp = 0; foesDone(fell); nextRound(fell);
  assert.equal(takeNews(fell).find(n => n.pounce), undefined); assert.equal(fell.foes[0].hp, 999);
  const off = pair(); actDual(off, 'arco-voltaico', 'dog-0');
  by(off, 'aitor').classId = 'matemagico'; foesDone(off); nextRound(off);
  assert.equal(takeNews(off).find(n => n.pounce), undefined);
});
