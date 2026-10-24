import test from 'node:test';
import assert from 'node:assert/strict';
import { createBattle, act, enemyAct, nextRound, skillsFor, validTargets, boostRounds, BOOST_ROUNDS, switchAnima, wearAnima, SKILLS, STATUSES, addStatus, stacks } from '../src/battle.ts';

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
  assert.equal(act(s, 'skill', 'dog-1'), undefined, 'Bernat has no skills: he only attacks');
  act(s, 'attack', 'dog-1');
  assert.equal(s.allies[1].secondary, 24); assert.equal(s.foes[1].hp, 36);
  assert.equal(s.phase, 'enemy');
  s.foes.forEach(f => enemyAct(s, f.id));
  assert.equal(s.allies[0].hp, 94); assert.equal(s.allies[1].hp, 76);
  nextRound(s); assert.equal(s.active, 0); assert.equal(s.allies[0].guarding, false);
});
test('invalid or defeated targets and insufficient resource never consume a turn', () => {
  const s = createBattle(1, 2, false, 'matemagico');
  s.foes[0].hp = 0;
  assert.equal(act(s, 'attack', 'dog-0'), undefined);
  assert.equal(act(s, 'attack', 'missing'), undefined);
  s.allies[0].secondary = 9;
  assert.equal(act(s, 'skill', undefined, 'analisis'), undefined);
  assert.equal(s.phase, 'player'); assert.equal(s.allies[0].secondary, 9);
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
    const s = createBattle(i % 2 + 1, i % 3 + 2, false, 'matemagico');
    for (let turn = 0; turn < 200 && s.phase === 'player'; turn++) {
      const targets = s.foes.filter(f => f.hp > 0);
      const target = targets[Math.floor(random() * targets.length)];
      let action = random() < .55 ? 'attack' : random() < .5 ? 'skill' : 'defend';
      const actor = s.allies[s.active];
      if (action === 'skill' && (actor.id !== 'gerard' || actor.secondary < 10 || !validTargets(s, 'skill', 'analisis').length)) action = 'attack';
      if (i % 20 === 0) action = 'escape';
      assert.ok(act(s, action, target.id, 'analisis'));
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

test('Matemágico gives Gerard Análisis Parálisis and Cardioide, and Bernat has nothing', () => {
  const s = createBattle(2, 4, false, 'matemagico');
  assert.deepEqual(skillsFor(s, s.allies[0]).map(k => k.id), ['analisis', 'cardioide']);
  assert.deepEqual(skillsFor(s, s.allies[1]), []);
  const before = structuredClone(s);
  assert.equal(act(s, 'skill', 'dog-0', 'nota'), undefined, 'No-ta is Noísta\'s');
  assert.deepEqual(s, before);
});
test('Análisis Parálisis raises the party\'s Fuerza and Magia for three rounds and cannot stack', () => {
  const s = createBattle(2, 4, false, 'matemagico');
  const effect = act(s, 'skill', undefined, 'analisis');
  assert.deepEqual(effect.boosted, ['gerard', 'bernat']); assert.equal(effect.skill, 'analisis');
  assert.equal(s.allies[0].secondary, 20); assert.equal(boostRounds(s), BOOST_ROUNDS);
  assert.equal(act(s, 'attack', 'dog-0').amount, 21, 'Bernat hits 18 + 3');
  s.foes.forEach(f => enemyAct(s, f.id)); nextRound(s);
  assert.equal(validTargets(s, 'skill', 'analisis').length, 0, 'nothing to add while it runs');
  assert.equal(act(s, 'skill', undefined, 'analisis'), undefined);
  assert.equal(act(s, 'attack', 'dog-1').amount, 21);
  act(s, 'attack', 'dog-1');
  s.foes.forEach(f => enemyAct(s, f.id)); nextRound(s);
  assert.equal(boostRounds(s), 1);
  act(s, 'defend'); act(s, 'defend'); s.foes.forEach(f => enemyAct(s, f.id)); nextRound(s);
  assert.equal(boostRounds(s), 0, 'it wears off after round 3');
  assert.equal(act(s, 'attack', 'dog-2').amount, 18);
});
test('Cardioide heals one hurt ally, never the dead or the unhurt, and only with energy', () => {
  const s = createBattle(2, 2, false, 'matemagico');
  assert.equal(act(s, 'skill', 'bernat', 'cardioide'), undefined, 'nobody is hurt');
  assert.equal(act(s, 'skill', 'dog-0', 'cardioide'), undefined, 'not on a foe');
  s.allies[1].hp = 80;
  const effect = act(s, 'skill', 'bernat', 'cardioide');
  assert.equal(effect.amount, 5); assert.equal(s.allies[1].hp, 85); assert.equal(s.allies[0].secondary, 22);
  act(s, 'defend'); s.foes.forEach(f => enemyAct(s, f.id)); nextRound(s);
  s.allies[1].hp = 20;
  assert.equal(act(s, 'skill', 'bernat', 'cardioide').amount, 25, '24 base, Magia 11 with Matemágico');
  const dead = createBattle(2, 2, false, 'matemagico'); dead.allies[1].hp = 0;
  assert.equal(act(dead, 'skill', 'bernat', 'cardioide'), undefined);
  dead.allies[0].hp = 10; dead.allies[0].secondary = 7;
  assert.equal(act(dead, 'skill', 'gerard', 'cardioide'), undefined, 'not enough Secundaria');
});
test('L and R swap the active fighter\'s ánima for free, with its skills and stats; Bernat wears none', () => {
  const s = createBattle(2, 2, false, 'matemagico', ['matemagico', 'noista']);
  const [gerard, bernat] = s.allies;
  assert.equal(gerard.stats.magia, 11);
  assert.equal(switchAnima(s, 1), 'noista');
  assert.equal(gerard.classId, 'noista'); assert.equal(gerard.stats.magia, 12); assert.equal(gerard.stats.defensa, 9);
  assert.deepEqual(skillsFor(s, gerard).map(k => k.id), ['nota']);
  assert.equal(s.active, 0, 'the turn is still his');
  assert.equal(switchAnima(s, 1), 'matemagico', 'round the list');
  assert.equal(switchAnima(s, -1), 'noista');
  assert.equal(wearAnima(s, 'noista'), false, 'already on');
  gerard.hp = 50; gerard.secondary = 3; switchAnima(s, 1);
  assert.equal(gerard.hp, 50); assert.equal(gerard.secondary, 3, 'PV and Secundaria stay');
  act(s, 'defend');
  assert.equal(switchAnima(s, 1), undefined, 'Bernat only attacks');
  assert.equal(bernat.classId, undefined);
  const locked = createBattle(1, 2, false, 'matemagico', ['matemagico']);
  assert.equal(switchAnima(locked, 1), undefined, 'nothing else unlocked');
  act(locked, 'defend'); assert.equal(wearAnima(locked, 'matemagico'), false, 'not outside your turn');
});
test('enemies follow a valid AI target and ignore invalid ones', () => {
  const s = createBattle(2, 2); act(s, 'defend'); act(s, 'defend');
  assert.equal(enemyAct(s, 'dog-0', 'bernat').target, 'bernat');
  assert.equal(enemyAct(s, 'dog-1', 'nobody').target, 'bernat'); // Built-in rotation.
});

test('the palace minion swallows every hit, and whatever the party does the beat comes by round 6', async () => {
  const { createMinionBattle, enemyAct, nextRound, act, awaken, skillsFor, cornered, BEAT_HP } = await import('../src/battle.ts');
  const strategies = {
    attack: s => act(s, 'attack', 'minion-0'),
    guard: s => act(s, 'defend'),
    boost: s => act(s, 'defend'),
    heal: s => act(s, 'defend'),
  };
  for (const [name, move] of Object.entries(strategies)) {
    const state = createMinionBattle('matemagico');
    assert.equal(cornered(state), true, 'nobody escapes the palace minion');
    assert.equal(act(state, 'escape'), undefined);
    assert.deepEqual(skillsFor(state, state.allies[0]).map(s => s.id), ['analisis', 'cardioide'], 'No-ta waits for Noísta');
    while (state.phase !== 'beat') {
      assert.ok(state.round <= 6, `${name}: the beat came by round 6`);
      const bernat = state.allies.find(a => a.id === 'bernat');
      const gerard = name === 'boost' && state.round === 1 ? act(state, 'skill', undefined, 'analisis')
        : name === 'heal' && bernat.hp < bernat.maxHp ? act(state, 'skill', 'bernat', 'cardioide') ?? act(state, 'attack', 'minion-0') : act(state, 'attack', 'minion-0');
      if (gerard.kind === 'attack') { assert.equal(gerard.amount, 0); assert.equal(gerard.swallowed, true); }
      move(state);
      enemyAct(state, 'minion-0');
      assert.ok(state.allies.every(a => a.hp > 0), `${name}: nobody falls before the beat`);
      nextRound(state);
    }
    assert.equal(state.allies[1].hp, Math.min(state.allies[1].hp, BEAT_HP));
    assert.equal(state.foes[0].hp, 40, `${name}: not a scratch`);
    awaken(state, 'noista');
    assert.equal(state.phase, 'player');
    assert.equal(state.allies[state.active].id, 'gerard');
    assert.ok(skillsFor(state, state.allies[0]).some(s => s.id === 'nota'));
    assert.deepEqual(state.animas, ['matemagico', 'noista'], 'Noísta joins the ánimas L and R walk through');
    assert.ok(!skillsFor(state, state.allies[1]).some(s => s.id === 'nota'), 'No-ta is Gerard\'s');
    const nota = act(state, 'skill', 'minion-0', 'nota');
    assert.equal(nota.amount, 40);
    assert.equal(state.phase, 'won');
  }
});

test('skill descriptions follow the plain shape in AGENTS.md, with the intensity their power gives', () => {
  const intensity = power => power <= 20 ? 'leve' : power <= 34 ? 'medi[oa]' : power <= 49 ? 'alt[oa]' : 'muy alt[oa]';
  const targets = { foes: 'a un enemigo', allies: 'a un aliado herido', party: 'a todo el equipo' };
  for (const skill of SKILLS.filter(s => !('abstract' in s && s.abstract))) {
    const extra = '( [A-ZÁÉÍÓÚ][^.]*\\.)*';
    const shape = skill.kind === 'boost' ? `^(Sube|Baja) [^.]+ de ${targets[skill.side].slice(2)} durante ${BOOST_ROUNDS} rondas\\.${extra}$`
      : skill.kind === 'heal' ? `^Cura ${intensity(skill.power)} ${targets[skill.side]}\\.${extra}$`
      : `^Daño ${intensity(skill.power)} ${skill.kind === 'magic' ? 'mágico' : 'físico'}( de tipo [^ ]+)? ${targets[skill.side]}\\.${extra}$`;
    assert.match(skill.description, new RegExp(shape), skill.name);
  }
});

test('the palace guards cannot be beaten without ánimas, and can be backed off from', async () => {
  const { palaceGuards, createGuardBattle, act, enemyAct, nextRound } = await import('../src/battle.ts');
  const { Story, STORY_FLAGS } = await import('../src/story.ts');
  const party = new Story(STORY_FLAGS.slice(0, STORY_FLAGS.indexOf('castle') + 1)).battleParty(true);
  assert.deepEqual(palaceGuards(0), { count: 3, hp: 220, power: 30 });
  assert.ok(palaceGuards(6).count === 1 && palaceGuards(6).hp === 40);
  // Without ánimas, attacking every turn loses.
  const state = createGuardBattle(party, palaceGuards(0));
  for (let round = 0; round < 30 && state.phase !== 'lost' && state.phase !== 'won'; round++) {
    while (state.phase === 'player') act(state, 'attack', state.foes.find(f => f.hp > 0).id);
    for (const foe of state.foes) if (state.phase === 'enemy') enemyAct(state, foe.id);
    nextRound(state);
  }
  assert.equal(state.phase, 'lost');
  // Backing off is allowed.
  const retreat = createGuardBattle(party, palaceGuards(0));
  assert.ok(act(retreat, 'escape'));
  assert.equal(retreat.phase, 'escaped');
  // With every ánima, the fight is fair.
  const strong = createGuardBattle(party, palaceGuards(6));
  for (let round = 0; round < 30 && strong.phase !== 'lost' && strong.phase !== 'won'; round++) {
    while (strong.phase === 'player') act(strong, 'attack', strong.foes.find(f => f.hp > 0).id);
    for (const foe of strong.foes) if (strong.phase === 'enemy') enemyAct(strong, foe.id);
    nextRound(strong);
  }
  assert.equal(strong.phase, 'won');
});
test('statuses stack to their maximum, Sangrado hurts per stack each round and fades', () => {
  const s = createBattle();
  const dog = s.foes[0];
  assert.equal(addStatus(dog, 'sangrado', 3), 3);
  assert.equal(addStatus(dog, 'sangrado', 20), STATUSES.sangrado.max);
  dog.statuses.sangrado = 3;
  act(s, 'defend'); enemyAct(s, 'dog-0');
  const ticks = nextRound(s);
  assert.deepEqual(ticks, [{ target: 'dog-0', status: 'sangrado', amount: 3 * STATUSES.sangrado.tick, stacks: 2 }]);
  assert.equal(dog.hp, 54 - 6);
  act(s, 'defend'); enemyAct(s, 'dog-0'); nextRound(s);
  act(s, 'defend'); enemyAct(s, 'dog-0'); nextRound(s);
  assert.equal(stacks(dog, 'sangrado'), 0, 'gone once it runs out');
  assert.equal(dog.hp, 54 - 6 - 4 - 2);
});
test('a foe that bleeds out ends the fight at the end of the round', () => {
  const s = createBattle();
  s.foes[0].hp = 3; addStatus(s.foes[0], 'sangrado', 2);
  act(s, 'defend'); enemyAct(s, 'dog-0'); nextRound(s);
  assert.equal(s.phase, 'won');
});
test('Mareo and Llorera weaken the stats they name, per stack', () => {
  const s = createBattle();
  const clear = act(s, 'attack', 'dog-0').amount;
  enemyAct(s, 'dog-0'); nextRound(s);
  addStatus(s.allies[0], 'llorera', 2);
  assert.equal(act(s, 'attack', 'dog-0').amount, clear - 2 * 2, 'Llorera takes Fuerza away');
  enemyAct(s, 'dog-0'); nextRound(s);
  const before = s.allies[0].hp;
  s.allies[0].statuses = {}; addStatus(s.allies[0], 'mareo', 2);
  act(s, 'defend'); s.allies[0].guarding = false; enemyAct(s, 'dog-0');
  assert.equal(before - s.allies[0].hp, 9 + 2, 'Mareo takes Defensa away');
});
test('Papagato: Haru\'s claw adds Sangrado, Yuki raises Defensa, and both boosts run side by side', async () => {
  const { boostRounds, createGuardBattle, palaceGuards } = await import('../src/battle.ts');
  const party = [{ id: 'gerard', name: 'Gerard', profile: 'gerard35', classId: 'papagato' }, { id: 'aitor', name: 'Aitor', profile: 'aitor', classId: 'matemagico' }];
  const s = createGuardBattle(party, palaceGuards(6));
  const gerard = s.allies.find(a => a.id === 'gerard'), aitor = s.allies.find(a => a.id === 'aitor');
  assert.deepEqual(skillsFor(s, gerard).map(k => k.id), ['zarpazo', 'escondite']);
  s.active = s.allies.indexOf(gerard);
  const claw = act(s, 'skill', 'guard-0', 'zarpazo');
  assert.deepEqual(claw.status, { id: 'sangrado', stacks: 2 });
  assert.equal(stacks(s.foes[0], 'sangrado'), 2);
  s.phase = 'player'; s.active = s.allies.indexOf(aitor);
  act(s, 'skill', undefined, 'analisis');
  s.phase = 'player'; s.active = s.allies.indexOf(gerard);
  act(s, 'skill', undefined, 'escondite');
  assert.equal(boostRounds(s, 'analisis'), BOOST_ROUNDS); assert.equal(boostRounds(s, 'escondite'), BOOST_ROUNDS);
  s.phase = 'player';
  assert.deepEqual(validTargets(s, 'skill', 'escondite'), [], 'cannot be stacked while it runs');
});
test('Papagato is the party\'s once the mission is won', async () => {
  const { Story } = await import('../src/story.ts');
  assert.deepEqual(new Story(['noista']).classes, ['matemagico', 'noista']);
  assert.deepEqual(new Story(['noista', 'papagato']).classes, ['matemagico', 'noista', 'papagato']);
});
