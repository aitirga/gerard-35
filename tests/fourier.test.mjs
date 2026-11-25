import test from 'node:test';
import assert from 'node:assert/strict';
import { act, createBattle, improve, plateCount, plateMarks, skillsFor, SKILLS, CRECIDA } from '../src/battle.ts';
import { improvedBy, improvementOf, stageOf } from '../src/ecos.ts';
import { alongLength, chainAt, dft, epicycles, harmonicColour, meanOf, silhouette, traced } from '../src/fourier.ts';
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

test('the count is taken as it is cast: Punto débil, spent by the blow, still gave its strike', () => {
  const s = fight();
  const dog = s.foes[0];
  dog.timed = { quemado: timed() }; dog.weakSpot = s.round;
  const before = plateCount(s, dog);
  assert.deepEqual(before, ['punto-debil', 'quemado']);
  const e = cast(s);
  assert.equal(e.weakSpot, 'spent');
  assert.ok(!plateCount(s, dog).includes('punto-debil'), 'the blow spent it: the plate after it is not the one counted');
  assert.equal(strikesOf(e), 1 + before.length, 'the strikes are the plate as it was cast');
  assert.deepEqual(e.harmonics, before);
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

// A dog side-on, as its surface laid flat gives it: a body, four legs, a head, a tail, scattered points over each.
function dogPoints() {
  let seed = 7;
  const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647, points = [];
  const box = (x0, y0, x1, y1, n) => { for (let i = 0; i < n; i++) points.push({ x: x0 + random() * (x1 - x0), y: y0 + random() * (y1 - y0) }); };
  box(-.4, .25, .3, .55, 300);
  for (const x of [-.38, -.26, .14, .24]) box(x, 0, x + .07, .3, 60);
  box(.25, .45, .48, .68, 120); box(-.58, .48, -.38, .53, 30);
  return points;
}
const inside = (curve, p) => {
  let odd = false;
  for (let i = 0, j = curve.length - 1; i < curve.length; j = i++) {
    const a = curve[i], b = curve[j];
    if ((a.y > p.y) !== (b.y > p.y) && p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x) odd = !odd;
  }
  return odd;
};

test('the silhouette keeps the body\'s hollows: the gap between its legs is outside it, its belly inside', () => {
  const body = silhouette(dogPoints());
  assert.equal(body.length, 64);
  assert.ok(inside(body, { x: -.05, y: .4 }), 'the belly');
  assert.ok(!inside(body, { x: -.05, y: .08 }), 'between the front and back legs, under the belly');
  assert.ok(!inside(body, { x: .42, y: .3 }), 'under the head, before the chest');
  assert.ok(inside(body, { x: .17, y: .08 }), 'a leg');
  // Anticlockwise (the body on its left): the biggest circle turns forward.
  let area = 0;
  for (let i = 0; i < body.length; i++) { const a = body[i], b = body[(i + 1) % body.length]; area += a.x * b.y - b.x * a.y; }
  assert.ok(area > 0);
  // Evenly along it.
  const steps = body.map((p, i) => Math.hypot(body[(i + 1) % body.length].x - p.x, body[(i + 1) % body.length].y - p.y));
  assert.ok(Math.max(...steps) < Math.min(...steps) * 1.6 + .01);
  assert.equal(silhouette([]).length, 64, 'with nothing to go on, a round');
});

test('the transform: every circle together draws the silhouette back; cut short, the slowest go first', () => {
  const shape = silhouette(dogPoints()), all = dft(shape);
  assert.equal(all.length, shape.length);
  const every = epicycles(all, all.length);
  for (let j = 0; j < shape.length; j += 7) {
    const p = chainAt(every, j / shape.length, meanOf(all)), tip = p[p.length - 1];
    assert.ok(Math.hypot(tip.x - shape[j].x, tip.y - shape[j].y) < 1e-6, `point ${j}`);
  }
  const six = epicycles(all, 6);
  assert.deepEqual(six.map(c => Math.abs(c.k)), [1, 1, 2, 2, 3, 3], 'each speed both ways round, slowest first');
  assert.equal(six[0].k, 1, 'the dial is the way the silhouette goes round');
  assert.equal(epicycles(all, 0).length, 1, 'always the dial at least');
  assert.equal(traced(six, 100).length, 101);
  // Each circle more draws it nearer.
  const far = n => { const c = traced(epicycles(all, n), 64), m = meanOf(all); return shape.reduce((sum, p, i) => sum + Math.hypot(c[i].x + m.x - p.x, c[i].y + m.y - p.y), 0); };
  assert.ok(far(6) < far(2) && far(2) < far(1));
  assert.equal(alongLength([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }], 8).length, 8);
});

test('its circles are never pink nor violet (the Queen\'s and fear\'s), not even on its dark over a magenta street', () => {
  const rgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);
  const hue = ([r, g, b]) => {
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    // Grey or pale (a white with a blush), not a colour: only a saturated pink is hers.
    if (max - min < .08 || (max - min) / max < .25) return -1;
    const h = max === r ? ((g - b) / (max - min)) % 6 : max === g ? (b - r) / (max - min) + 2 : (r - g) / (max - min) + 4;
    return (h * 60 + 360) % 360;
  };
  // The pink (300–350) and the violet (255–300) are theirs.
  const theirs = h => h >= 255 && h <= 350;
  // A magenta street, half hidden by the dark each stroke is drawn on, and the stroke's light added over it.
  const street = rgb('#8a2a5a'), over = colour => rgb(colour).map((c, i) => Math.min(1, street[i] * .5 + c));
  for (const mark of ['quemado', 'mojado', 'agua', 'cristalizado', 'sangrado', 'metralla', 'envenenado', 'empolvado', 'cegado', 'confusion', 'mareo', 'llorera', 'shock', 'punto-debil', 'marca', 'virus', 'compas']) {
    const colour = harmonicColour(mark);
    assert.ok(!theirs(hue(rgb(colour))), `${mark}: ${colour} is violet or pink`);
    assert.ok(!theirs(hue(over(colour))), `${mark}: ${colour} turns violet or pink over the street (${over(colour).map(c => c.toFixed(2))})`);
  }
  assert.equal(harmonicColour('confusion'), '#f3cf78');
});
