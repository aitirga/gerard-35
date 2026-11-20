import test from 'node:test';
import assert from 'node:assert/strict';
import { AFFINITIES, FEAR_ENCOUNTERS, LUCA, LUCA_ENCOUNTERS, LUCA_FIGHTS, LUCA_WALKS, dazzle, act, cornered, createFearBattle, enemyAct, intentLabel, lightNow, nextRound, runClock, shirtLit, takeNews } from '../src/battle.ts';
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
    assert.deepEqual(s.light, { t: 0, walk: LUCA_WALKS[encounter] }, 'it starts at the start of its side\'s walk');
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

test('a shirt of Luca\'s is only hurt in the light of its own colour, and its light goes out with it', () => {
  for (const kind of ['estampado-rojo', 'estampado-azul', 'estampado-oro']) assert.equal(AFFINITIES[kind], undefined, `${kind} resists nothing of its own: the light already eats that element`);
  const s = fight('luca-carta');
  const red = s.foes.find(f => f.kind === 'estampado-rojo'), blue = s.foes.find(f => f.kind === 'estampado-azul');
  assert.equal(s.light.walk, 'pasion');
  as(s, 'gerard');
  assert.equal(lightNow(s), 'rojo');
  assert.ok(shirtLit(s, red) && !shirtLit(s, blue));
  const off = act(s, 'attack', blue.id);
  assert.equal(off.amount, 0);
  assert.deepEqual(off.unlit, [blue.id]);
  assert.equal(blue.hp, 9999);
  as(s, 'gerard');
  assert.ok(act(s, 'attack', red.id).amount > 0, 'in its light, a blow lands');
  // Fire is what red light eats: the lit shirt has to be hit with something else.
  as(s, 'gerard');
  assert.equal(act(s, 'skill', red.id, 'foc-binari').amount, 0);
  red.hp = 1;
  as(s, 'gerard');
  const down = act(s, 'attack', red.id);
  assert.equal(down.lightOut, 'rojo');
  assert.notEqual(lightNow(s), 'rojo', 'its light does not stay on over nobody');
  s.phase = 'player';
  for (let i = 0; i < 60; i++) { runClock(s, 1); assert.notEqual(lightNow(s), 'rojo'); }
});

test('the freshly styled chaplain repeats the last gesture; down, the others stop mid-gesture', () => {
  const s = fight('luca-sillones');
  const [styled, other] = s.foes.filter(f => f.kind === 'capellan');
  assert.equal(styled.peinado, true);
  const cut = turn(s, other.id, 'gerard');
  const copy = turn(s, styled.id, 'gerard');
  assert.equal(copy.ability.id, 'imitacion');
  assert.ok(copy.amount > 0 && cut.amount > 0, 'it cuts again, as the other just did');
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
  assert.equal(s.allies[0].lasting.shifts.fuerza, -LUCA.aspersionDown * 3, 'every lamp still hangs: it takes the most');
  fran.hp = 1;
  as(s, 'aitor');
  act(s, 'attack', fran.id);
  assert.ok(s.foes.filter(f => f.kind === 'capellan').every(f => f.hp === 0));
  assert.equal(s.phase, 'won');
});

test('the chaplains dazzled by the nave\'s mirrors start the fight Cegado II', () => {
  const s = fight('luca-sillones');
  dazzle(s);
  for (const f of s.foes) assert.equal(f.timed?.cegado?.level, f.kind === 'capellan' ? 2 : undefined, f.id);
  assert.match(s.message, /espejos/);
});

test('each side of the basilica fights under its own windows; the apse has no fight: it is Fran\'s zone', () => {
  assert.deepEqual(LUCA_ENCOUNTERS, ['luca-recepcion', 'luca-sillones', 'luca-carta', 'fran']);
  assert.deepEqual(LUCA_FIGHTS['luca-sillones'], ['capellan', 'capellan', 'capellan'], 'the chaplains alone');
  assert.equal(fight('luca-carta').light.walk, 'pasion');
});
test('a lamp broken rains its colour back: its light eats nothing of the party\'s for the rest of the fight', async () => {
  const { lightFreed } = await import('../src/battle.ts');
  const s = fight('fran');
  const fran = s.foes.find(f => f.kind === 'fran'), gerard = s.allies.find(a => a.id === 'gerard');
  fran.stage = 2;
  s.light.t = 15; // naranja: fire is eaten
  as(s, 'gerard');
  assert.equal(act(s, 'skill', fran.id, 'foc-binari').annulled, 'naranja');
  const warm = s.foes.find(f => f.lamp === 'calido');
  warm.hp = 1;
  as(s, 'aitor');
  const broke = act(s, 'attack', warm.id);
  assert.equal(broke.lampBroken, warm.id);
  assert.match(s.message, /naranja y roja/);
  assert.ok(lightFreed(s, 'naranja') && lightFreed(s, 'rojo') && !lightFreed(s, 'oro'));
  gerard.secondary = 99;
  as(s, 'gerard');
  const fire = act(s, 'skill', fran.id, 'foc-binari');
  assert.equal(fire.annulled, undefined);
  assert.ok(fire.amount > 0, 'fire lands again');
  s.light.t = 22; // roja, the same lamp's
  gerard.secondary = 99;
  as(s, 'gerard');
  assert.equal(act(s, 'skill', fran.id, 'foc-binari').annulled, undefined);
});

test('the Aspersión is dyed by every lamp still hanging: with all of them broken it only wets', () => {
  const wash = broken => {
    const s = fight('fran');
    const fran = s.foes.find(f => f.kind === 'fran');
    fran.stage = 3; fran.turns = 0;
    for (const lamp of s.foes.filter(f => f.kind === 'lampara').slice(0, broken)) lamp.hp = 0;
    const load = turn(s, fran.id, 'gerard');
    const effect = turn(s, fran.id, 'gerard');
    return { s, load, effect };
  };
  const full = wash(0), clean = wash(3);
  assert.match(full.s.message, /color se va/);
  assert.ok(full.effect.amount > clean.effect.amount, 'three lamps hanging hurt more than none');
  assert.equal(clean.s.allies[0].lasting, undefined, 'none hanging: it takes no colour');
  assert.equal(clean.effect.stats, undefined);
  assert.match(clean.s.message, /no os quita el color/);
  assert.equal(wash(1).s.allies[0].lasting.shifts.magia, -LUCA.aspersionDown * 2);
});
