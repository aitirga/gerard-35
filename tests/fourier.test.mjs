import test from 'node:test';
import assert from 'node:assert/strict';
import { act, createBattle, improve, plateCount, plateMarks, skillsFor, SKILLS, CRECIDA } from '../src/battle.ts';
import { improvedBy, improvementOf, stageOf } from '../src/ecos.ts';
import { aroundOnce, chainAt, dft, epicycles, harmonicColour, meanOf, outline, traced } from '../src/fourier.ts';
import { FIGURES, FOURIER_GAP, figureEnd } from '../src/battle-motion.ts';

// Serie de Fourier (docs/animas/matemagico/README.md § Serie de Fourier): a strike for its target, and one more
// for each thing its plate shows as it is cast, up to six. What it counts is the list the plate draws (`plateMarks`).
const PARTY = [{ id: 'gerard', name: 'Gerard', profile: 'gerard35', classId: 'matemagico' }, { id: 'aitor', name: 'Aitor', profile: 'aitor', classId: 'tecnopata' }];
const NODES = ['matemagico:angulo', 'matemagico:analisis', 'matemagico:fourier'];
function fight(nodes = NODES) {
  const s = createBattle(PARTY, 3, false, undefined, ['matemagico', 'tecnopata']);
  improve(s, improvedBy(nodes));
  s.foes.forEach(f => { f.hp = f.maxHp = 999; });
  return s;
}
const by = (s, id) => [...s.allies, ...s.foes].find(c => c.id === id);
const turn = (s, id = 'gerard') => { s.phase = 'player'; s.active = s.allies.indexOf(by(s, id)); delete s.spent; delete s.queued; by(s, id).secondary = by(s, id).maxSecondary; return by(s, id); };
const timed = (level = 1, left = 20) => ({ level, left, next: 5 });
const cast = (s, target = 'dog-0') => { turn(s); return act(s, 'skill', target, 'fourier'); };
const strikesOf = e => e.strikes?.length ?? (e.amount ? 1 : 0);

test('Serie de Fourier is a grade II node of Cálculo, a branch off Análisis Parálisis, one eco', () => {
  const node = improvementOf('matemagico:fourier');
  assert.equal(node.after, 'matemagico:analisis'); assert.equal(node.cost, 1); assert.equal(node.line, 'calculo');
  assert.equal(stageOf(node), 1, 'open from the start, not grade III');
  assert.ok(!skillsFor(fight(NODES.slice(0, 2)), { classId: 'matemagico', id: 'gerard' }).some(k => k.id === 'fourier'), 'only once bought');
  const skill = SKILLS.find(k => k.id === 'fourier');
  assert.equal(skill.cost, 2); assert.equal(skill.kind, 'magic'); assert.equal(skill.element, undefined, 'no element: nothing reacts');
});

test('on a foe with nothing on its plate it is one blow, and it counts nothing', () => {
  const s = fight(), e = cast(s);
  assert.equal(strikesOf(e), 1); assert.deepEqual(e.harmonics, []);
  assert.equal(e.reaction, undefined);
});

test('one strike more for each icon on the plate: the variety, never the depth (Quemado III is one)', () => {
  const s = fight();
  s.foes[0].timed = { quemado: timed(3) };
  let e = cast(s);
  assert.equal(strikesOf(e), 2); assert.deepEqual(e.harmonics, ['quemado']);
  s.foes[1].timed = { quemado: timed(1), mojado: timed(), empolvado: timed() };
  e = cast(s, 'dog-1');
  assert.equal(strikesOf(e), 4, 'three things on it: four strikes');
  assert.deepEqual([...e.harmonics].sort(), ['empolvado', 'mojado', 'quemado']);
});

test('Agua and Mojado are one icon on the plate, so they count as one', () => {
  const s = fight();
  s.foes[0].timed = { agua: { level: 2, left: CRECIDA.mark, next: CRECIDA.mark }, mojado: timed() };
  assert.deepEqual(plateMarks(s, s.foes[0]), ['agua']);
  const e = cast(s);
  assert.equal(strikesOf(e), 2); assert.deepEqual(e.harmonics, ['agua']);
});

test('Ángulo exacto\'s mark, Punto débil and Shock count; Punto débil triples every strike and is spent', () => {
  const s = fight();
  const dog = s.foes[0];
  dog.shock = true; dog.weakSpot = s.round;
  dog.marks = { angulo: { amount: 3, stats: ['defensa', 'espiritu'], until: s.round + 2 } };
  assert.deepEqual(plateCount(s, dog), ['shock', 'punto-debil', 'marca']);
  const plain = fight(), bare = cast(plain);
  const e = cast(s);
  assert.equal(strikesOf(e), 4);
  assert.equal(e.weakSpot, 'spent');
  assert.ok(e.strikes.every(n => n >= bare.amount * 2.5), `every strike lands about triple: ${e.strikes} against ${bare.amount}`);
});

test('at most six strikes, however much is on the plate', () => {
  const s = fight();
  s.foes[0].timed = { quemado: timed(), empolvado: timed(), envenenado: timed(), cegado: timed(), confusion: timed(), cristalizado: timed() };
  s.foes[0].statuses = { sangrado: 3 };
  assert.equal(plateCount(s, s.foes[0]).length, 7);
  const e = cast(s);
  assert.equal(strikesOf(e), 6); assert.equal(e.harmonics.length, 5);
});

test('each strike is a blow of its own: Cristalizado digs in a level deeper with every one', () => {
  const s = fight();
  s.foes[0].timed = { cristalizado: timed(1), quemado: timed() };
  const e = cast(s);
  assert.equal(strikesOf(e), 3);
  assert.equal(s.foes[0].timed.cristalizado.level, 4, 'three strikes, three levels deeper');
  assert.ok(e.strikes[2] > e.strikes[0], 'the shards make each strike land harder than the one before');
});

test('the count is taken as it is cast: what the strikes put on it does not add strikes', () => {
  const s = fight();
  s.foes[0].timed = { quemado: timed() };
  const e = cast(s);
  assert.equal(strikesOf(e), 2);
});

test('a foe that falls partway takes no more strikes', () => {
  const s = fight();
  s.foes[0].timed = { quemado: timed(), empolvado: timed(), envenenado: timed() };
  s.foes[0].hp = 1;
  const e = cast(s);
  assert.equal(strikesOf(e), 1); assert.equal(s.foes[0].hp, 0);
});

test('the plate counts nothing on someone fallen', () => {
  const s = fight();
  s.foes[0].timed = { quemado: timed() }; s.foes[0].hp = 0;
  assert.deepEqual(plateMarks(s, s.foes[0]), []);
});

test('its look runs on a gap for each strike past the first', () => {
  assert.equal(figureEnd('fourier', 1), FIGURES.fourier.end);
  assert.ok(Math.abs(figureEnd('fourier', 6) - (FIGURES.fourier.end + 5 * FOURIER_GAP)) < 1e-9);
  assert.equal(figureEnd('cardioide', 6), FIGURES.cardioide.end);
});

test('the transform: every circle together draws the outline back, and the chain is biggest first', () => {
  const body = [];
  for (let i = 0; i < 400; i++) { const a = i / 400 * Math.PI * 2, r = .5 + .2 * Math.cos(3 * a); body.push({ x: Math.cos(a) * r * .8, y: Math.sin(a) * r * 1.4 }); }
  const shape = outline(body), all = dft(shape);
  assert.equal(all.length, shape.length);
  const every = epicycles(all, all.length);
  for (let j = 0; j < shape.length; j += 7) {
    const p = chainAt(every, j / shape.length, meanOf(all)), tip = p[p.length - 1];
    assert.ok(Math.hypot(tip.x - shape[j].x, tip.y - shape[j].y) < 1e-6, `point ${j}`);
  }
  const six = epicycles(all, 6);
  assert.equal(six.length, 6);
  for (let i = 1; i < six.length; i++) assert.ok(six[i].radius <= six[i - 1].radius);
  assert.equal(epicycles(all, 0).length, 1, 'always the dial at least');
  assert.equal(traced(six, 100).length, 101);
});

test('its circles are never pink nor violet (the Queen\'s and fear\'s): what has no colour of its own is his gold', () => {
  const hue = hex => {
    const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255), max = Math.max(r, g, b), min = Math.min(r, g, b);
    if (max - min < .08) return -1;
    const h = max === r ? ((g - b) / (max - min)) % 6 : max === g ? (b - r) / (max - min) + 2 : (r - g) / (max - min) + 4;
    return (h * 60 + 360) % 360;
  };
  for (const mark of ['quemado', 'mojado', 'agua', 'cristalizado', 'sangrado', 'envenenado', 'empolvado', 'cegado', 'confusion', 'mareo', 'llorera', 'shock', 'punto-debil', 'marca', 'virus', 'compas']) {
    const h = hue(harmonicColour(mark));
    assert.ok(h < 0 || h < 255 || h > 345, `${mark}: ${harmonicColour(mark)} is violet or pink`);
  }
  assert.equal(harmonicColour('confusion'), '#f3cf78');
});

test('a curve that loops over itself is told apart from one that goes round once', () => {
  const circle = Array.from({ length: 65 }, (_, i) => ({ x: Math.cos(i / 64 * Math.PI * 2), y: Math.sin(i / 64 * Math.PI * 2) }));
  assert.ok(aroundOnce(circle));
  const eight = Array.from({ length: 129 }, (_, i) => { const t = i / 128 * Math.PI * 2; return { x: Math.sin(t), y: Math.sin(t) * Math.cos(t) }; });
  assert.ok(!aroundOnce(eight));
});
