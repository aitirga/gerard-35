import test from 'node:test';
import assert from 'node:assert/strict';
import { CAMPING, CAMPING_ENCOUNTERS, CAMPING_FIGHTS, FEAR_ENCOUNTERS, SKILLS, act, cornered, createFearBattle, dadoPower, enemyAct, intentLabel, nextRound, planMost, stageMoment } from '../src/battle.ts';
import { fightXp } from '../src/levels.ts';

const party = [{ id: 'gerard', name: 'Gerard', profile: 'gerard35', classId: 'matemagico' }, { id: 'aitor', name: 'Aitor', profile: 'aitor', classId: 'papagato' }];
const fight = (encounter, random = () => .5) => {
  const s = createFearBattle(party, encounter, undefined, random);
  s.allies.forEach(a => { a.hp = a.maxHp = 9999; });
  return s;
};
const turn = (s, id, target) => { s.phase = 'enemy'; s.enemyActions = []; return enemyAct(s, id, target); };
/** The PV a plain Atacar (physical) or Foc Binari (magic) by `who` takes off `foeId` now, on a copy. */
const blow = (s, foeId, how) => {
  const look = structuredClone(s);
  look.phase = 'player'; look.active = look.allies.findIndex(a => a.id === 'gerard'); look.foes.forEach(f => { f.hp = f.maxHp = 9999; });
  const e = how === 'magic' ? act(look, 'skill', foeId, 'foc-binari') : act(look, 'attack', foeId);
  return e.amount;
};
const round = s => { s.phase = 'enemy'; s.enemyActions = s.foes.map(f => f.id); return nextRound(s); };

test('the campsite\'s fights are fears\' fights, each with the foes it says, and the black pitch and El Campeón cannot be run from', () => {
  for (const encounter of CAMPING_ENCOUNTERS) {
    assert.ok(FEAR_ENCOUNTERS.includes(encounter));
    const s = fight(encounter);
    assert.deepEqual(s.foes.map(f => f.kind), [...CAMPING_FIGHTS[encounter]], encounter);
    assert.equal(cornered(s), encounter === 'camping-negra' || encounter === 'campeon', encounter);
  }
  assert.deepEqual(fight('camping-magos').foes.map(f => f.name), ['Mago de camping 1', 'Mago de camping 2']);
  assert.deepEqual(fight('campeon').foes.map(f => f.name), ['El Campeón']);
});

test('a Mago de camping takes half from magic and more from blows', () => {
  const s = fight('camping-magos'), plain = fight('camping-agentes');
  const physical = blow(s, 'mago-0', 'physical'), magic = blow(s, 'mago-0', 'magic');
  // The same blows on an agente face up, who takes everything whole.
  const wholePhysical = blow(plain, 'agente-0', 'physical'), wholeMagic = blow(plain, 'agente-0', 'magic');
  assert.ok(physical > wholePhysical, `${physical} > ${wholePhysical}`);
  assert.ok(magic < wholeMagic, `${magic} < ${wholeMagic}`);
});

test('Bombona is charged a turn ahead (Bombona → todos), then lands on everyone; holding on takes two thirds off', () => {
  const s = fight('camping-magos');
  const charge = turn(s, 'mago-0', 'gerard');
  assert.equal(charge.telegraph.id, 'bombona');
  assert.equal(charge.amount, undefined);
  assert.equal(intentLabel(s, s.foes[0]), 'Bombona → todos');
  const open = structuredClone(s), held = structuredClone(s);
  held.allies.forEach(a => { a.guarding = true; });
  const full = turn(open, 'mago-0', 'gerard'), guarded = turn(held, 'mago-0', 'gerard');
  assert.equal(full.ability.id, 'bombona');
  assert.equal(full.splash.length, 1, 'it reaches both');
  assert.ok(guarded.amount < full.amount / 2);
  assert.equal(intentLabel(open, open.foes[0]), undefined, 'spent');
});

test('a Dado shows its face, hits as hard as it, and rolls a new one every round', () => {
  const s = fight('camping-dados', (() => { let n = 0; return () => [.99, .01, .5][n++ % 3]; })());
  assert.deepEqual(s.foes.map(f => f.face), [6, 1, 4]);
  const six = turn(s, 'dado-0', 'gerard'), one = turn(s, 'dado-1', 'gerard');
  assert.equal(six.ability.id, 'tumbarse');
  assert.ok(six.amount > one.amount * 2, `${six.amount} vs ${one.amount}`);
  assert.ok(dadoPower(6) > dadoPower(1));
  const faces = new Set();
  for (let i = 0; i < 12; i++) { round(s); faces.add(s.foes[0].face); }
  assert.ok(faces.size > 2, 'it rolls again');
  assert.ok([...faces].every(face => face >= 1 && face <= 6));
});

test('agentes: one face up, one face down, turning over every round; face down takes half from any blow, ticks whole', () => {
  const s = fight('camping-agentes');
  assert.deepEqual(s.foes.map(f => f.faceUp), [true, false]);
  const up = blow(s, 'agente-0', 'physical'), down = blow(s, 'agente-1', 'physical');
  assert.ok(Math.abs(down - up * CAMPING.downTaken) <= 1, `${down} ≈ ${up} × ${CAMPING.downTaken}`);
  assert.ok(blow(s, 'agente-1', 'magic') < blow(s, 'agente-0', 'magic'), 'magic too');
  round(s);
  assert.deepEqual(s.foes.map(f => f.faceUp), [false, true]);
  // Sangrado on the one face down ticks in full.
  s.foes[0].statuses = { sangrado: 4 };
  const before = s.foes[0].hp, ticks = round(s);
  assert.equal(before - s.foes[0].hp, 4 * 2);
  assert.equal(ticks[0].amount, 8);
  const e = turn(s, 'agente-0', 'gerard');
  assert.equal(e.ability.id, 'contrasena');
  assert.ok(e.amount > 0);
});

test('El Campeón: his Rayo goes at whom he said and he says the next; his Plan fills, fires on everyone and starts again', () => {
  const s = fight('campeon');
  const champion = s.foes[0];
  assert.equal(champion.plan, 0);
  const lead = s.allies.find(a => a.hp > 0).id, other = s.allies.find(a => a.id !== lead).id;
  assert.deepEqual(champion.intent, { ability: 'rayo-guantelete', target: lead }, 'he comes out aiming at whoever leads');
  assert.equal(intentLabel(s, champion) !== undefined, true);
  const open = structuredClone(s), held = structuredClone(s);
  held.allies.forEach(a => { a.guarding = true; });
  const guarded = turn(held, 'campeon', other);
  const first = turn(s, 'campeon', other);
  assert.equal(first.ability.id, 'rayo-guantelete');
  assert.equal(first.target, lead, 'at whom he said, not at whoever the turn picked');
  assert.ok(first.amount > 0);
  assert.ok(guarded.amount < turn(open, 'campeon', other).amount / 2, 'Defender takes two thirds off');
  assert.equal(champion.plan, 1);
  assert.equal(first.plan, 1);
  assert.equal(first.telegraph.id, 'rayo-guantelete');
  assert.equal(champion.intent.target, first.telegraph.target);
  champion.plan = planMost(champion);
  const fired = turn(s, 'campeon', 'gerard');
  assert.equal(fired.ability.id, 'rayo-total');
  assert.equal(fired.splash.length, 1, 'it reaches both');
  assert.equal(champion.plan, 0, 'and starts again');
});

test('a magic blow on El Campeón lands lighter and takes his Plan a step down; a physical blow does neither', () => {
  const s = fight('campeon');
  s.foes[0].plan = 2;
  const strike = (how) => {
    const look = structuredClone(s);
    look.phase = 'player'; look.active = look.allies.findIndex(a => a.id === 'gerard');
    const e = how === 'magic' ? act(look, 'skill', 'campeon', 'foc-binari') : act(look, 'attack', 'campeon');
    return { e, plan: look.foes[0].plan };
  };
  const magic = strike('magic'), physical = strike('physical');
  assert.equal(magic.plan, 1);
  assert.equal(magic.e.foiled, 1);
  assert.equal(physical.plan, 2);
  assert.equal(physical.e.foiled, undefined);
  const lighter = blow(s, 'campeon', 'magic');
  const was = CAMPING.campeonMagic;
  CAMPING.campeonMagic = 1;
  const whole = blow(s, 'campeon', 'magic');
  CAMPING.campeonMagic = was;
  assert.ok(lighter < whole, `${lighter} < ${whole}`);
  // With his Plan at nothing, magic has nothing to take down.
  s.foes[0].plan = 0;
  assert.equal(strike('magic').plan, 0);
});

test('El Campeón turns his card at half his PV: Etapa II, and his Plan fires a step sooner', () => {
  const s = fight('campeon');
  const champion = s.foes[0];
  assert.equal(planMost(champion), CAMPING.planMost);
  champion.hp = Math.floor(champion.maxHp * CAMPING.stageAt) + 5;
  s.phase = 'player'; s.active = 0;
  const e = act(s, 'attack', 'campeon');
  assert.equal(e.stage2, true);
  assert.equal(champion.stage2, true);
  assert.equal(planMost(champion), CAMPING.planMostII);
  assert.ok(CAMPING.planMostII < CAMPING.planMost);
});

test('a campsite fight is won when every foe is down, and is worth its EXP', () => {
  const s = fight('camping-tienda');
  s.foes.forEach(f => { f.hp = 1; });
  s.phase = 'player'; s.active = 0;
  for (const f of s.foes) { s.phase = 'player'; s.active = 0; act(s, 'attack', f.id); }
  assert.equal(s.phase, 'won');
  assert.match(s.message, /tienda/);
  assert.ok(fightXp(s) > 0);
});

test('the picker stages Bombona charged and El Campeón\'s Plan about to fire and his Etapa II, only in their own fights', () => {
  const magos = fight('camping-magos');
  assert.ok(stageMoment(magos, 'magos-bombona'));
  assert.ok(magos.foes.every(f => intentLabel(magos, f) === 'Bombona → todos'));
  const champion = fight('campeon');
  const villain = champion.foes[0];
  assert.ok(stageMoment(champion, 'campeon-etapa'));
  assert.equal(villain.stage2, true); assert.equal(villain.hp, Math.floor(villain.maxHp * CAMPING.stageAt));
  assert.equal(villain.plan, CAMPING.planMostII - 1);
  assert.ok(stageMoment(champion, 'campeon-plan'));
  assert.equal(villain.stage2, false); assert.equal(villain.hp, villain.maxHp);
  assert.equal(villain.plan, CAMPING.planMost);
  assert.equal(turn(champion, 'campeon', 'gerard').ability.id, 'rayo-total');
  assert.equal(stageMoment(fight('camping-dados'), 'magos-bombona'), false);
  assert.equal(stageMoment(magos, 'campeon-plan'), false);
});

test('no rule of the campsite asks for a skill or an ánima by name', async () => {
  const { readFile } = await import('node:fs/promises');
  const source = await readFile(new URL('../src/battle.ts', import.meta.url), 'utf8');
  const start = source.indexOf(' * How much of a blow a campsite foe takes'), end = source.indexOf('/** La Sobremesa: the seven friends, Joan on his first note. */');
  const rules = source.slice(start, end);
  assert.ok(start > 0 && end > start);
  for (const id of [...SKILLS.map(s => s.id), 'papagato', 'matemagico', 'tecnopata']) assert.ok(!rules.includes(`'${id}'`), id);
});
