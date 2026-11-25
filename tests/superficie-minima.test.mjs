import test from 'node:test';
import assert from 'node:assert/strict';
import { CEGADO, act, createBattle, createEncounter, createFearBattle, enemyAct, improve, nextRound, planMost, roll, runClock, skillsFor, takeNews, takeSongNews, validTargets, SKILLS, TIMED } from '../src/battle.ts';
import { IMPROVEMENTS, improvedBy, stageOf } from '../src/ecos.ts';

// Superficie mínima (docs/animas/matemagico/README.md § Superficie mínima, Matemágico grows 2026-11-25): a guard like
// Defender's on an ally until the round ends, and whoever's blow reaches them through the film takes water, no blow.
const PARTY = [{ id: 'gerard', name: 'Gerard', profile: 'gerard35', classId: 'matemagico' }, { id: 'aitor', name: 'Aitor', profile: 'aitor', classId: 'tecnopata' }];
const LINE = ['matemagico:agua', 'matemagico:vasos', 'matemagico:superficie-minima'];
function fight(nodes = LINE, dogs = 3) {
  const s = createBattle(PARTY, dogs, false, undefined, ['matemagico', 'tecnopata']);
  improve(s, improvedBy(nodes));
  s.foes.forEach(f => { f.hp = f.maxHp = 999; });
  s.allies.forEach(a => { a.hp = a.maxHp = 999; });
  return s;
}
const by = (s, id) => [...s.allies, ...s.foes].find(c => c.id === id);
const turn = (s, id) => { s.phase = 'player'; s.active = s.allies.indexOf(by(s, id)); delete s.spent; delete s.queued; by(s, id).secondary = by(s, id).maxSecondary; return by(s, id); };
const foeTurn = (s, foe, target = 'aitor') => { s.phase = 'enemy'; s.enemyActions = s.enemyActions.filter(id => id !== foe); return enemyAct(s, foe, target); };
const clock = id => ({ level: 1, left: TIMED[id].seconds, next: TIMED[id].every });
const film = (s, on = 'aitor') => { turn(s, 'gerard'); return act(s, 'skill', on, 'superficie-minima'); };

test('a node of the water line off Cubo acuático, one eco, grade II, and only once bought', () => {
  const node = IMPROVEMENTS.find(i => i.id === 'matemagico:superficie-minima');
  assert.equal(node.after, 'matemagico:vasos'); assert.equal(node.line, 'agua'); assert.equal(node.cost, 1); assert.equal(stageOf(node), 1);
  const skill = SKILLS.find(k => k.id === 'superficie-minima');
  assert.equal(skill.kind, 'guard'); assert.equal(skill.cost, 1); assert.equal(skill.class, 'matemagico');
  assert.equal(skill.description, 'Protege a un aliado hasta el final de la ronda. El enemigo que le golpee queda mojado.');
  assert.ok(!skillsFor(fight(LINE.slice(0, 2)), { classId: 'matemagico', id: 'gerard' }).some(k => k.id === 'superficie-minima'));
  const s = fight();
  assert.ok(skillsFor(s, by(s, 'gerard')).some(k => k.id === 'superficie-minima'));
});

test('a protection: on anyone standing, himself too, one maná, and never on someone already protected', () => {
  const s = fight(), g = turn(s, 'gerard');
  assert.deepEqual(validTargets(s, 'skill', 'superficie-minima').map(c => c.id).sort(), ['aitor', 'gerard']);
  const e = act(s, 'skill', 'aitor', 'superficie-minima');
  assert.equal(e.guarded, true); assert.equal(e.target, 'aitor'); assert.equal(g.secondary, g.maxSecondary - 1);
  assert.equal(by(s, 'aitor').guarding, true); assert.equal(by(s, 'aitor').film, s.round);
  turn(s, 'gerard');
  assert.deepEqual(validTargets(s, 'skill', 'superficie-minima').map(c => c.id), ['gerard'], 'not on top of a protection');
  const held = fight(); turn(held, 'aitor'); act(held, 'defend'); turn(held, 'gerard');
  assert.deepEqual(validTargets(held, 'skill', 'superficie-minima').map(c => c.id), ['gerard'], 'nor on someone holding on');
});

test('it takes a third of each blow, as Defender does', () => {
  const bare = fight(), plain = foeTurn(bare, 'dog-0').amount;
  const s = fight(); film(s);
  const through = foeTurn(s, 'dog-0').amount;
  assert.ok(through > 0 && through <= Math.ceil(plain / 3) + 1, `${through} against ${plain}`);
});

test('whoever strikes through it is left Mojado, with no blow, and only that one', () => {
  const s = fight(); film(s);
  const hp = s.foes.map(f => f.hp);
  const e = foeTurn(s, 'dog-0');
  assert.deepEqual(e.film, [{ from: 'aitor', target: 'dog-0', left: 'mojado' }]);
  assert.equal(s.foes[0].timed.mojado.left, TIMED.mojado.seconds);
  assert.deepEqual(s.foes.map(f => f.hp), hp, 'water, not a blow');
  assert.ok(!s.foes[1].timed?.mojado && !s.foes[2].timed?.mojado);
  assert.match(s.message, /película de Aitor estalla sobre .*Mojado/);
});

test('on a fire it is Humo, on powder poison: water\'s own rules', () => {
  const s = fight(); film(s);
  s.foes[0].timed = { quemado: clock('quemado') };
  s.foes[1].timed = { empolvado: clock('empolvado') };
  const smoke = foeTurn(s, 'dog-0');
  assert.deepEqual(smoke.film, [{ from: 'aitor', target: 'dog-0', left: 'cegado' }]);
  assert.ok(!s.foes[0].timed.quemado && s.foes[0].timed.cegado && !s.foes[0].timed.mojado);
  const venom = foeTurn(s, 'dog-1');
  assert.deepEqual(venom.film, [{ from: 'aitor', target: 'dog-1', left: 'envenenado' }]);
  assert.ok(!s.foes[1].timed.empolvado && s.foes[1].timed.envenenado && !s.foes[1].timed.mojado);
  assert.equal(venom.reaction?.id, 'veneno');
});

test('every foe that strikes them that round is wet; one that strikes someone else is not', () => {
  const s = fight(); film(s);
  foeTurn(s, 'dog-0', 'aitor'); foeTurn(s, 'dog-1', 'aitor');
  const other = foeTurn(s, 'dog-2', 'gerard');
  assert.ok(s.foes[0].timed.mojado && s.foes[1].timed.mojado);
  assert.equal(other.film, undefined); assert.ok(!s.foes[2].timed?.mojado);
});

test('only blows: a foe\'s action that takes no PV (Vertitrón\'s Grito, the party\'s stats down) leaves nobody wet', () => {
  const s = createFearBattle(PARTY, 'uri-vertigo', ['matemagico', 'tecnopata'], () => .5);
  improve(s, improvedBy(LINE));
  s.allies.forEach(a => { a.hp = a.maxHp = 999; });
  const boss = s.foes.find(f => f.kind === 'vertigo');
  boss.turns = 2;
  film(s);
  const e = foeTurn(s, boss.id);
  assert.equal(e.ability.id, 'grito'); assert.ok(e.stats?.some(c => c.target === 'aitor' && c.way === 'down'));
  assert.equal(e.film, undefined); assert.ok(!boss.timed?.mojado);
});

test('a blow that took nothing (a blinded foe\'s miss) went through no film: nobody wet', () => {
  const s = fight(); film(s);
  s.foes[0].timed = { cegado: clock('cegado') };
  // The fight's dice: a seed whose next roll misses.
  let seed = 0;
  while (roll({ seed }) >= CEGADO.smoke) seed++;
  s.seed = seed;
  const e = foeTurn(s, 'dog-0');
  assert.ok(!e.amount, `missed: ${e.amount}`);
  assert.equal(e.film, undefined); assert.ok(!s.foes[0].timed.mojado);
});

test('the blow that brings them down still goes through it: the striker is wet all the same', () => {
  const s = fight(); film(s);
  by(s, 'aitor').hp = 1;
  const e = foeTurn(s, 'dog-0');
  assert.equal(by(s, 'aitor').hp, 0);
  assert.deepEqual(e.film, [{ from: 'aitor', target: 'dog-0', left: 'mojado' }]);
});

test('it goes with its round: next round the guard and the water are gone', () => {
  const s = fight(); film(s);
  s.phase = 'enemy'; s.enemyActions = s.foes.map(f => f.id);
  nextRound(s);
  assert.equal(by(s, 'aitor').film, undefined); assert.equal(by(s, 'aitor').guarding, false);
  const e = foeTurn(s, 'dog-0');
  assert.equal(e.film, undefined); assert.ok(!s.foes[0].timed?.mojado);
});

test('on whoever carries a charge, the striker is wet before the charge jumps to it', () => {
  const s = fight([...LINE, 'matemagico:electrico', 'matemagico:descarga', 'matemagico:toma-de-tierra', 'matemagico:cortocircuito', 'matemagico:condensador']);
  turn(s, 'gerard'); act(s, 'skill', undefined, 'condensador');
  film(s, 'gerard');
  const e = foeTurn(s, 'dog-0', 'gerard');
  assert.equal(e.film?.[0].left, 'mojado'); assert.equal(e.discharge?.target, 'dog-0');
  assert.ok(s.foes[0].timed.mojado);
});

// El Campeón (proposal § 3, the fight question it answers): his Rayo is announced at someone; the film on them leaves him wet.
const CAMPEON_LINE = [...LINE, 'matemagico:electrico', 'matemagico:descarga', 'matemagico:toma-de-tierra', 'matemagico:cortocircuito'];
function campeon() {
  const s = createFearBattle(PARTY, 'campeon', ['matemagico', 'tecnopata'], () => .5);
  improve(s, improvedBy(CAMPEON_LINE));
  s.allies.forEach(a => { a.hp = a.maxHp = 999; });
  return s;
}

test('El Campeón: the film on whom his Rayo is announced at; the Rayo goes through it, he is wet, and next round Cortocircuito takes his turn', () => {
  const s = campeon(), champion = s.foes[0], aimed = champion.intent.target;
  assert.equal(champion.intent.ability, 'rayo-guantelete');
  film(s, aimed);
  const e = foeTurn(s, 'campeon', s.allies.find(a => a.id !== aimed).id);
  assert.equal(e.ability.id, 'rayo-guantelete'); assert.equal(e.target, aimed, 'at whom he said');
  assert.deepEqual(e.film, [{ from: aimed, target: 'campeon', left: 'mojado' }]);
  assert.ok(champion.timed.mojado);
  s.phase = 'enemy'; s.enemyActions = s.foes.map(f => f.id);
  nextRound(s);
  assert.equal(by(s, aimed).film, undefined);
  turn(s, 'gerard');
  const shorted = act(s, 'skill', 'campeon', 'cortocircuito');
  assert.equal(shorted.shorted?.why, 'mojado', 'for sure, on the water');
  assert.equal(champion.shock, true);
});

test('El Campeón\'s Rayo total on everyone: the film round whoever it only splashes leaves him wet too', () => {
  const s = campeon(), champion = s.foes[0];
  champion.plan = planMost(champion);
  film(s, 'gerard');
  const e = foeTurn(s, 'campeon', 'aitor');
  assert.equal(e.ability.id, 'rayo-total'); assert.equal(e.target, 'aitor');
  assert.ok(e.splash.some(h => h.target === 'gerard' && h.amount > 0));
  assert.deepEqual(e.film, [{ from: 'gerard', target: 'campeon', left: 'mojado' }]);
});

test('La Voz: guards last until their fighter acts again, but the film goes with its round (a known choice, as Defender\'s words)', () => {
  const slots = [{ id: 'gerard', name: 'Gerard', profile: 'gerard35', classId: 'matemagico' }, { id: 'aitor', name: 'Aitor', profile: 'aitor', classId: 'tecnopata' }];
  const s = createEncounter(slots, 'voz', { animas: ['matemagico', 'tecnopata'], random: () => .5 });
  improve(s, improvedBy(LINE));
  assert.ok(s.song, 'a song fight');
  turn(s, 'gerard'); act(s, 'skill', 'aitor', 'superficie-minima');
  assert.equal(by(s, 'aitor').film, s.round);
  s.phase = 'enemy'; s.enemyActions = s.foes.map(f => f.id);
  nextRound(s);
  assert.equal(by(s, 'aitor').guarding, true, 'still guarded: nobody has acted since');
  assert.equal(by(s, 'aitor').film, undefined, 'the film is gone with the round');
});

test('La Voz: a note that reaches someone under the film is a blow of hers, and leaves her wet', () => {
  const slots = [{ id: 'gerard', name: 'Gerard', profile: 'gerard35', classId: 'matemagico' }, { id: 'aitor', name: 'Aitor', profile: 'aitor', classId: 'tecnopata' }];
  const s = createEncounter(slots, 'voz', { animas: ['matemagico', 'tecnopata'], random: () => .5 });
  improve(s, improvedBy(LINE));
  s.allies.forEach(a => { a.hp = a.maxHp = 999; });
  turn(s, 'gerard'); act(s, 'skill', 'gerard', 'superficie-minima');
  turn(s, 'gerard'); act(s, 'skill', 'aitor', 'superficie-minima');
  const voz = s.foes.find(f => f.kind === 'voz');
  takeNews(s); s.phase = 'player';
  let note;
  for (let i = 0; i < 400 && !note; i++) { runClock(s, .05); note = takeSongNews(s).find(n => n.kind === 'nota' && n.hits.some(h => h.amount > 0)); }
  assert.ok(note, 'a note landed');
  assert.ok(note.hits.every(h => h.guarded), 'the film guards as Defender does');
  const news = takeNews(s).find(n => n.film);
  assert.ok(news, 'what the film did comes as news');
  assert.equal(news.actor, voz.id); assert.equal(news.hits, undefined, 'no blow in it: the note\'s numbers are the song\'s');
  assert.equal(news.film[0].target, voz.id);
  assert.ok(voz.timed?.mojado || voz.timed?.cegado, 'she takes the water');
});
