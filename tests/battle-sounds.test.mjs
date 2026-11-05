import test from 'node:test';
import assert from 'node:assert/strict';
import { FEAR_ENCOUNTERS, ONIONS, SKILLS, VERTIGO_TURNS, act, createBattle, createBroodBattle, createFearBattle, enemyAct } from '../src/battle.ts';
import { PROFILES } from '../src/stats.ts';
import { FOE_SOUNDS, SKILL_SOUNDS, impactSounds, startSounds } from '../src/battle-sounds.ts';
import { SOUNDS } from '../src/sfx.ts';

const party = [{ id: 'gerard', name: 'Gerard', profile: 'gerard35', classId: 'papagato' }, { id: 'aitor', name: 'Aitor', profile: 'aitor', classId: 'matemagico' }];
const ids = cues => cues.map(c => c.id);

test('every skill and every foe says how it sounds, with sounds that exist', () => {
  for (const skill of SKILLS) assert.ok(SKILL_SOUNDS[skill.id], skill.id);
  for (const [name, sounds] of [...Object.entries(SKILL_SOUNDS), ...Object.entries(FOE_SOUNDS)]) {
    for (const cue of [...sounds.start ?? [], ...sounds.impact]) assert.ok(SOUNDS[cue.id], `${name}: ${cue.id}`);
  }
  for (const foe of Object.keys(ONIONS)) assert.ok(FOE_SOUNDS[foe], foe);
  assert.ok(FOE_SOUNDS.dog && FOE_SOUNDS.minion && FOE_SOUNDS.guardian && FOE_SOUNDS.vertigo);
  assert.ok(PROFILES.cebolla);
});

test('every sound can be played: a recipe or a file, and limits that make sense', () => {
  for (const [id, sound] of Object.entries(SOUNDS)) {
    assert.ok(sound.synth || sound.src, id);
    assert.ok((sound.voices ?? 4) >= 1, id);
  }
});

test('a plain blow thumps; Defender stands guard and gives maná back only if it did', () => {
  const s = createBattle(party, 1, false, undefined, ['papagato', 'matemagico']);
  assert.deepEqual(ids(impactSounds(act(s, 'attack', 'dog-0'), s)), ['hit']);
  const held = createBattle(party, 1, false, undefined, ['papagato', 'matemagico']);
  assert.deepEqual(ids(impactSounds(act(held, 'defend'), held)), ['guard'], 'full maná: nothing comes back');
  const spent = createBattle(party, 1, false, undefined, ['papagato', 'matemagico']);
  spent.allies[spent.active].secondary = 0;
  assert.deepEqual(ids(impactSounds(act(spent, 'defend'), spent)), ['guard', 'mana']);
});

test('Papagato\'s skills miaow as they go and claw as they land', () => {
  const s = createBattle(party, 2, false, undefined, ['papagato', 'matemagico']);
  s.levels = { papagato: 3 };
  const zarpazo = act(s, 'skill', 'dog-0', 'zarpazo');
  assert.deepEqual(ids(startSounds(zarpazo, s)), ['meow']);
  assert.ok(ids(impactSounds(zarpazo, s)).includes('claw'));
  assert.deepEqual(ids(SKILL_SOUNDS.llaga.impact), ['claw-deep']);
  assert.deepEqual(ids(SKILL_SOUNDS.escondite.start), ['meow-soft']);
  assert.equal(ids(SKILL_SOUNDS.zarpazos.impact).length, 1, 'the first claw: the scene cues the others as they land');
});

test('Foc Binari gathers, then bursts where it lights and fizzles on wet layers', () => {
  const s = createFearBattle(party, 'cebollon');
  s.active = s.allies.findIndex(a => a.id === 'aitor');
  const wet = act(s, 'skill', 'cebollon', 'foc-binari');
  assert.deepEqual(ids(startSounds(wet, s)), ['fire-cast']);
  assert.deepEqual(ids(impactSounds(wet, s)), ['fizzle']);
  const bare = createFearBattle(party, 'cebollon');
  bare.foes[0].layers = 0; bare.active = bare.allies.findIndex(a => a.id === 'aitor');
  assert.deepEqual(ids(impactSounds(act(bare, 'skill', 'cebollon', 'foc-binari'), bare)), ['fire-hit']);
});

test('a big onion comes down with all its weight while it has layers, and peeled it only rolls', () => {
  const s = createFearBattle(party, 'cebollon');
  s.phase = 'enemy';
  assert.deepEqual(ids(impactSounds(enemyAct(s, 'cebollon', 'gerard'), s)), ['slam']);
  const bare = createFearBattle(party, 'cebollon');
  bare.foes[0].layers = 0; bare.phase = 'enemy';
  assert.deepEqual(ids(impactSounds(enemyAct(bare, 'cebollon', 'gerard'), bare)), ['hit']);
});

test('a blow on someone holding on sounds muffled, whoever gives it', () => {
  const s = createFearBattle(party, 'plato');
  s.phase = 'enemy'; s.allies.find(a => a.id === 'gerard').guarding = true;
  assert.deepEqual(ids(impactSounds(enemyAct(s, 'plato', 'gerard'), s)), ['hit-guarded']);
  const open = createFearBattle(party, 'plato');
  open.phase = 'enemy';
  assert.deepEqual(ids(impactSounds(enemyAct(open, 'plato', 'gerard'), open)), ['splash']);
});

test('a fantasmita\'s «GAME OVER» and Vertitrón\'s Rayo terrorífico reach everyone, and say so', () => {
  const pack = createBroodBattle(party, 'crias-3', undefined, () => .01);
  const ghost = pack.foes.find(f => f.kind === 'fantasmita');
  ghost.countdown = 1; pack.phase = 'enemy';
  const blast = enemyAct(pack, ghost.id, 'gerard');
  assert.deepEqual(blast.splash.map(h => h.target), ['aitor']);
  assert.deepEqual(ids(impactSounds(blast, pack)), ['game-over']);
  const roof = createFearBattle(party, 'uri-vertigo');
  // Its eye charged: this turn is the Rayo, on everyone.
  roof.foes[0].turns = VERTIGO_TURNS.indexOf('rayo'); roof.phase = 'enemy';
  const rayo = enemyAct(roof, 'vertigo', 'gerard');
  assert.equal(rayo.ability.id, 'rayo');
  assert.deepEqual(rayo.splash.map(h => h.target), ['aitor']);
  assert.ok(ids(impactSounds(rayo, roof)).length > 0);
});

test('every tower fight has sound for its foes\' turns', () => {
  for (const encounter of FEAR_ENCOUNTERS) {
    const s = createFearBattle(party, encounter);
    s.phase = 'enemy';
    const foe = s.foes[0], blow = enemyAct(s, foe.id, 'gerard');
    assert.ok(impactSounds(blow, s).length, encounter);
  }
});

test('running off sounds, and a miss swallowed by gum is not a blow', () => {
  const s = createBattle(party, 1, false, undefined, ['papagato']);
  assert.deepEqual(ids(startSounds({ kind: 'escape', actor: 'gerard' }, s)), ['flee']);
  assert.deepEqual(ids(impactSounds({ kind: 'attack', actor: 'gerard', target: 'dog-0', amount: 0, swallowed: true }, s)), ['swallowed']);
});

test('a dual starts like both its halves, and one rolled claw by claw sounds each claw as it lands', async () => {
  const { actDual, createBattle } = await import('../src/battle.ts');
  const s = createBattle([{ id: 'gerard', name: 'Gerard', profile: 'gerard35', classId: 'matemagico' }, { id: 'aitor', name: 'Aitor', profile: 'aitor', classId: 'papagato' }], 1, false, undefined, ['matemagico', 'papagato']);
  s.levels = { papagato: 2 }; s.foes[0].hp = s.foes[0].maxHp = 999;
  const dual = actDual(s, 'zarpazos-de-fuego', 'dog-0');
  assert.ok(startSounds(dual, s).length);
  assert.deepEqual(impactSounds(dual, s), [], 'rolled claw by claw, the first blow says nothing of the fire: each claw sounds as it lands');
});
