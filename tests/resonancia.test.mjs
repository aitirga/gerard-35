import test from 'node:test';
import assert from 'node:assert/strict';
import { act, createBattle, improve, frozenOf, CRECIDA, SKILLS, TIMED } from '../src/battle.ts';
import { improvedBy, improvementOf, stageOf } from '../src/ecos.ts';

// Resonancia (docs/animas/matemagico/README.md § Grade III): the electric line's top. A hard bolt on one foe; on a foe
// frozen in Bajo cero's ice (Congelado) it breaks the ice at once, where any other bolt does nothing to it.
const LINE = ['matemagico:electrico', 'matemagico:descarga', 'matemagico:toma-de-tierra', 'matemagico:cortocircuito', 'matemagico:condensador', 'matemagico:resonancia'];
const PARTY = [{ id: 'gerard', name: 'Gerard', profile: 'gerard35', classId: 'matemagico' }, { id: 'aitor', name: 'Aitor', profile: 'aitor', classId: 'freatica' }];
function fight(foes = 2) {
  const s = createBattle(PARTY, foes, false, undefined, ['matemagico', 'freatica']);
  s.levels = { freatica: 7 };
  improve(s, improvedBy(LINE));
  s.foes.forEach(f => { f.hp = f.maxHp = 4000; });
  return s;
}
const by = (s, id) => [...s.allies, ...s.foes].find(c => c.id === id);
const turn = (s, id = 'gerard') => { s.phase = 'player'; s.active = s.allies.indexOf(by(s, id)); delete s.spent; delete s.queued; by(s, id).secondary = by(s, id).maxSecondary; return by(s, id); };
/** `foe` in Bajo cero's ice, `marks` of it, frozen by Aitor (Freática). */
const freeze = (s, foe, marks = 3) => { foe.timed = { congelado: { level: marks, left: marks * CRECIDA.ice, next: TIMED.congelado.every } }; foe.cracks = 0; s.cold = { used: true, by: 'aitor' }; };

test('its node: Eléctrico, grade III, 2 ecos past Condensador; 2 maná, 38 of electric magic on one foe', () => {
  const node = improvementOf('matemagico:resonancia');
  assert.equal(node.cost, 2); assert.equal(node.line, 'electrico'); assert.equal(node.after, 'matemagico:condensador');
  assert.equal(stageOf(node), 2);
  const spec = SKILLS.find(s => s.id === 'resonancia');
  assert.equal(spec.cost, 2); assert.equal(spec.kind, 'magic'); assert.equal(spec.element, 'electrico'); assert.equal(spec.power, 38); assert.equal(spec.side, 'foes');
  assert.equal(spec.description, 'Daño mágico eléctrico alto a un enemigo. Si está congelado, rompe el hielo de golpe.');
});

test('on a foe that is not frozen it is a hard bolt, and runs through the wet as any bolt does', () => {
  const s = fight(), [a, b] = s.foes;
  for (const f of [a, b]) f.timed = { mojado: { level: 1, left: TIMED.mojado.seconds, next: TIMED.mojado.every } };
  turn(s);
  const e = act(s, 'skill', a.id, 'resonancia');
  assert.ok(e.amount > 0); assert.equal(e.ice, undefined);
  assert.ok(b.hp < b.maxHp, 'Conducción reaches the other wet foe');
});

test('on a frozen foe it breaks the ice at once: its blow at a quarter, then the break by the ice left, and the foe is free', () => {
  const s = fight(), a = s.foes[0];
  freeze(s, a, 3);
  turn(s);
  const before = a.hp, e = act(s, 'skill', a.id, 'resonancia');
  const broke = e.ice?.find(i => i.broke !== undefined);
  assert.ok(broke && broke.broke > 0, JSON.stringify(e.ice));
  assert.equal(broke.added, CRECIDA.blows, 'the whole ice at once');
  assert.ok(!frozenOf(a)); assert.equal(a.cracks, undefined);
  assert.ok(before - a.hp >= broke.broke + e.amount - 1, 'the bolt and the break');
});

test('half cracked, it breaks the rest; the other bolts still do nothing to the ice', () => {
  const s = fight(), [a, b] = s.foes;
  freeze(s, a, 2); a.cracks = 5;
  freeze(s, b, 3);
  turn(s);
  const e = act(s, 'skill', a.id, 'resonancia');
  assert.deepEqual(e.ice?.map(i => [i.target, i.added, i.broke !== undefined]), [[a.id, CRECIDA.blows - 5, true]]);
  turn(s);
  act(s, 'skill', b.id, 'descarga');
  assert.ok(frozenOf(b)); assert.equal(b.cracks, 0, 'Punto eléctrico does not crack it');
});

// When to break it (docs/animas/matemagico/README.md § Resonancia): `smart` weighs the ice's rounds left, the turns the foe gets
// back, against the break, which is worth most fresh.
async function choose(marks, fuerza = 1) {
  const { decide } = await import('../src/battle-sim.ts');
  const s = fight(), [a] = s.foes;
  freeze(s, a, marks);
  if (marks < 1) { a.timed.congelado.left = CRECIDA.ice * marks; a.timed.congelado.level = 1; }
  a.stats.fuerza *= fuerza;
  turn(s);
  const setup = { fight: 'dogs:2', party: 'gerard:matemagico+aitor:freatica', policy: 'smart', ban: ['duals', 'defend'] };
  return [decide(s, setup, () => .99), a.id];
}

test('the smart bot rings a fresh ice apart when the foe in it hits little: the break is worth more than its turns', async () => {
  const [choice, id] = await choose(3);
  assert.equal(choice.skill, 'resonancia', JSON.stringify(choice)); assert.equal(choice.target, id);
});

test('on a foe that hits hard it lets the fresh ice hold, and breaks it once it is nearly thawed', async () => {
  const [fresh, id] = await choose(3, 3);
  assert.ok(!(fresh.skill === 'resonancia' && fresh.target === id), JSON.stringify(fresh));
  const [fading] = await choose(.2, 3);
  assert.equal(fading.skill, 'resonancia', JSON.stringify(fading)); assert.equal(fading.target, id);
});
