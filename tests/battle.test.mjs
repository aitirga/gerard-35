import test from 'node:test';
import assert from 'node:assert/strict';
import { createBattle, act, enemyAct, nextRound } from '../src/battle.ts';

test('single ally completes a round and takes damage only during enemy turn', () => {
  const s = createBattle();
  assert.equal(enemyAct(s, 'dog-0'), undefined);
  assert.equal(act(s, 'attack', 'dog-0').amount, 18);
  assert.equal(s.foes[0].hp, 36);
  assert.equal(s.phase, 'enemy');
  assert.equal(act(s, 'attack', 'dog-0'), undefined);
  enemyAct(s, 'dog-0'); nextRound(s);
  assert.equal(s.allies[0].hp, 91);
  assert.equal(s.phase, 'player'); assert.equal(s.round, 2);
});
test('two allies act before variable-size enemy parties, guarding expires next round', () => {
  const s = createBattle(2, 3);
  act(s, 'defend');
  assert.equal(s.phase, 'player'); assert.equal(s.active, 1);
  act(s, 'skill', 'dog-1');
  assert.equal(s.allies[1].secondary, 16); assert.equal(s.foes[1].hp, 26);
  assert.equal(s.phase, 'enemy');
  s.foes.forEach(f => enemyAct(s, f.id));
  assert.equal(s.allies[0].hp, 94); assert.equal(s.allies[1].hp, 76);
  nextRound(s); assert.equal(s.active, 0); assert.equal(s.allies[0].guarding, false);
});
test('invalid or defeated targets and insufficient resource never consume a turn', () => {
  const s = createBattle(1, 2);
  s.foes[0].hp = 0;
  assert.equal(act(s, 'attack', 'dog-0'), undefined);
  assert.equal(act(s, 'attack', 'missing'), undefined);
  s.allies[0].secondary = 7;
  assert.equal(act(s, 'skill', 'dog-1'), undefined);
  assert.equal(s.phase, 'player'); assert.equal(s.allies[0].secondary, 7);
});
test('victory clamps HP, ends combat and prevents retaliation', () => {
  const s = createBattle(); s.foes[0].hp = 5;
  assert.equal(act(s, 'attack', 'dog-0').amount, 5);
  assert.equal(s.phase, 'won'); assert.equal(s.foes[0].hp, 0);
  assert.equal(enemyAct(s, 'dog-0'), undefined); nextRound(s);
  assert.equal(s.phase, 'won');
});
test('defeated allies and foes are skipped, defeat ends the encounter', () => {
  const s = createBattle(2, 2); s.allies[1].hp = 0; s.foes[1].hp = 0; s.allies[0].hp = 1;
  act(s, 'defend'); assert.equal(s.phase, 'enemy');
  assert.equal(enemyAct(s, 'dog-1'), undefined);
  enemyAct(s, 'dog-0'); assert.equal(s.phase, 'lost'); assert.equal(s.allies[0].hp, 0);
  nextRound(s); assert.equal(s.phase, 'lost');
});
test('escape ends cleanly and encounter state is fresh on reentry', () => {
  const s = createBattle(); act(s, 'escape');
  assert.equal(s.phase, 'escaped'); assert.equal(act(s, 'defend'), undefined);
  assert.equal(createBattle().phase, 'player'); assert.equal(createBattle().allies[0].hp, 100);
  assert.throws(() => createBattle(1, 0));
});

test('every 2–4 foe encounter is winnable by focused attacks with either party size', () => {
  for (const allies of [1, 2]) for (const foes of [2, 3, 4]) {
    const s = createBattle(allies, foes);
    let turns = 0;
    while (s.phase === 'player' && turns++ < 40) {
      act(s, 'attack', s.foes.find(f => f.hp > 0).id);
      if (s.phase === 'enemy') {
        for (const f of s.foes) enemyAct(s, f.id);
        nextRound(s);
      }
    }
    assert.equal(s.phase, 'won', `${allies} allies vs ${foes} foes`);
    assert.ok(s.allies.some(a => a.hp > 0));
  }
});
test('enemy rounds cannot skip living foes or attack twice', () => {
  const s = createBattle(1, 4);
  act(s, 'attack', 'dog-0');
  nextRound(s); assert.equal(s.phase, 'enemy');
  enemyAct(s, 'dog-0');
  const hp = s.allies[0].hp;
  assert.equal(enemyAct(s, 'dog-0'), undefined);
  assert.equal(s.allies[0].hp, hp);
  for (const f of s.foes.slice(1)) enemyAct(s, f.id);
  nextRound(s); assert.equal(s.phase, 'player');
  act(s, 'attack', 'dog-0');
  assert.equal(s.foes[0].hp, 0);
  assert.equal(enemyAct(s, 'dog-0'), undefined);
  for (const f of s.foes.slice(1)) enemyAct(s, f.id);
  nextRound(s); assert.equal(s.phase, 'player');
});
test('hundreds of seeded random battles terminate with legal resources and no dead actors', () => {
  let seed = 1701;
  const random = () => ((seed = (1664525 * seed + 1013904223) >>> 0) / 2 ** 32);
  const outcomes = new Set();
  for (let i = 0; i < 240; i++) {
    const s = createBattle(i % 2 + 1, i % 3 + 2);
    for (let turn = 0; turn < 200 && s.phase === 'player'; turn++) {
      const targets = s.foes.filter(f => f.hp > 0);
      const target = targets[Math.floor(random() * targets.length)];
      let action = random() < .55 ? 'attack' : random() < .5 ? 'skill' : 'defend';
      if (action === 'skill' && s.allies[s.active].secondary < 8) action = 'attack';
      if (i % 20 === 0) action = 'escape';
      assert.ok(act(s, action, target.id));
      if (s.phase === 'enemy') {
        for (const foe of s.foes) {
          const effect = enemyAct(s, foe.id);
          if (effect) assert.ok(foe.hp > 0);
        }
        nextRound(s);
      }
      for (const c of [...s.allies, ...s.foes]) {
        assert.ok(c.hp >= 0 && c.hp <= c.maxHp);
        assert.ok(c.secondary >= 0 && c.secondary <= c.maxSecondary);
      }
    }
    assert.ok(['won', 'lost', 'escaped'].includes(s.phase)); outcomes.add(s.phase);
  }
  assert.deepEqual([...outcomes].sort(), ['escaped', 'lost', 'won']);
  for (const count of [0, -1, 1.5, 5, NaN]) assert.throws(() => createBattle(1, count));
});

test('skills validate enemy/ally targets and spend resources only after a valid choice', () => {
  const s = createBattle(2, 4);
  const before = structuredClone(s);
  assert.equal(act(s, 'skill', 'gerard', 'impulse'), undefined);
  assert.equal(act(s, 'skill', 'dog-0', 'encourage'), undefined);
  assert.equal(act(s, 'skill', 'bernat', 'encourage'), undefined);
  assert.deepEqual(s, before);
  s.allies[1].hp = 80;
  const effect = act(s, 'skill', 'bernat', 'encourage');
  assert.equal(effect.amount, 5); assert.equal(effect.skill, 'encourage');
  assert.equal(s.allies[1].hp, 85); assert.equal(s.allies[0].secondary, 22);
  assert.equal(s.active, 1);
  s.allies[1].hp = 20;
  assert.equal(act(s, 'skill', 'bernat', 'encourage').amount, 24);
  assert.equal(s.allies[1].hp, 44);
});
test('healing cannot revive defeated allies or bypass insufficient energy', () => {
  const s = createBattle(2, 2);
  s.allies[1].hp = 0;
  assert.equal(act(s, 'skill', 'bernat', 'encourage'), undefined);
  s.allies[0].hp = 10; s.allies[0].secondary = 7;
  assert.equal(act(s, 'skill', 'gerard', 'encourage'), undefined);
  assert.equal(s.allies[0].hp, 10); assert.equal(s.phase, 'player');
});
