import test from 'node:test';
import assert from 'node:assert/strict';
import { createBattle, act, enemyAct, nextRound, skillsFor, validTargets, boostRounds, BOOST_ROUNDS, switchAnima, wearAnima, SKILLS, STATUSES, addStatus, stacks, MANA_POINTS, DEFEND_CHARGE, REST_CHARGE, TIMED, pulseDamage, runClock, actDual } from '../src/battle.ts';

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
  assert.equal(s.allies[1].secondary, 0, 'Bernat has no Ánima'); assert.equal(s.foes[1].hp, 36);
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
  s.allies[0].secondary = 0;
  assert.equal(act(s, 'skill', 'dog-1', 'foc-binari'), undefined);
  assert.equal(s.phase, 'player'); assert.equal(s.allies[0].secondary, 0);
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
      if (action === 'skill' && (actor.id !== 'gerard' || actor.secondary < 1)) action = 'attack';
      if (i % 20 === 0) action = 'escape';
      assert.ok(act(s, action, target.id, 'foc-binari'));
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

test('Matemágico gives Gerard Foc Binari, and Bernat has nothing', () => {
  const s = createBattle(2, 4, false, 'matemagico');
  assert.deepEqual(skillsFor(s, s.allies[0]).map(k => k.id), ['foc-binari']);
  assert.deepEqual(skillsFor(s, s.allies[1]), []);
  const before = structuredClone(s);
  assert.equal(act(s, 'skill', 'dog-0', 'zarpazo'), undefined, 'Zarpazo is Papagato\'s');
  assert.deepEqual(s, before);
});
test('Maná: three points to start, a skill spends its cost, Defender gives two back to the ánima worn, up to the top', () => {
  const s = createBattle(1, 2, false, 'matemagico');
  const gerard = s.allies[0];
  assert.equal(MANA_POINTS, 3); assert.equal(DEFEND_CHARGE, 2);
  assert.equal(gerard.secondary, 3); assert.equal(gerard.maxSecondary, 3);
  act(s, 'skill', 'dog-0', 'foc-binari');
  assert.equal(gerard.secondary, 2, 'Foc Binari spends one');
  s.foes.forEach(f => enemyAct(s, f.id)); nextRound(s);
  gerard.secondary = 1;
  const guard = act(s, 'defend');
  assert.equal(guard.charged, 2); assert.equal(gerard.secondary, 3);
  s.foes.forEach(f => enemyAct(s, f.id)); nextRound(s);
  gerard.secondary = 3;
  assert.equal(act(s, 'defend').charged, 0, 'never past the top');
  assert.equal(gerard.secondary, 3);
  s.foes.forEach(f => enemyAct(s, f.id)); nextRound(s);
  gerard.secondary = 0;
  assert.equal(act(s, 'skill', 'dog-0', 'foc-binari'), undefined, 'no maná, no skill');
});
test('each ánima keeps its own maná, and the ones not worn all round get some back at its end', () => {
  const s = createBattle([{ id: 'gerard', name: 'Gerard', profile: 'gerard', classId: 'matemagico', kit: ['matemagico', 'papagato'] }, { id: 'bernat', name: 'Bernat', profile: 'bernat' }], 2, false, undefined, ['matemagico', 'papagato']);
  // Foes that do not fall, so every round runs its whole course.
  s.foes.forEach(f => { f.hp = f.maxHp = 9999; });
  const gerard = s.allies.find(a => a.id === 'gerard');
  const endRound = () => {
    for (let i = 0; i < 9 && s.phase === 'player'; i++) act(s, 'attack', 'dog-0');
    s.foes.forEach(f => enemyAct(s, f.id)); nextRound(s);
    s.allies.forEach(a => { a.hp = a.maxHp; });
    s.active = s.allies.indexOf(gerard);
  };
  s.active = s.allies.indexOf(gerard);
  act(s, 'skill', 'dog-0', 'foc-binari', 0);
  endRound();
  assert.equal(gerard.secondary, MANA_POINTS - 1, 'worn all round: nothing back');
  wearAnima(s, 'papagato');
  assert.equal(gerard.secondary, MANA_POINTS, 'Papagato brings its own, full');
  act(s, 'skill', 'dog-0', 'zarpazo');
  endRound();
  assert.equal(gerard.mana.matemagico, MANA_POINTS - 1, 'worn at the start of that round: no rest yet');
  endRound();
  assert.equal(gerard.mana.matemagico, Math.min(MANA_POINTS, MANA_POINTS - 1 + REST_CHARGE), 'a whole round off: some back');
  assert.equal(gerard.secondary, MANA_POINTS - 1, 'the worn one rests not');
});

test('Foc Binari: light fire damage, and it sets the foe on fire (Quemado I)', () => {
  const s = createBattle(1, 2, false, 'matemagico');
  const dog = s.foes[0];
  const fire = act(s, 'skill', 'dog-0', 'foc-binari');
  assert.equal(fire.amount, 17, '16 base, Magia 11 with Matemágico');
  assert.deepEqual(fire.strikes, [8, 9], 'two streams, the zero then the one: the same damage, landed twice');
  assert.deepEqual(fire.burn, { id: 'quemado', level: 1 }, 'and it catches once');
  assert.deepEqual(dog.timed.quemado, { level: 1, left: TIMED.quemado.seconds, next: TIMED.quemado.every });
  assert.match(s.message, /¡Se quema!/);
  // Rounds do not wear it down: only the clock does.
  s.foes.forEach(f => enemyAct(s, f.id));
  assert.deepEqual(nextRound(s), []);
  assert.equal(dog.timed.quemado.level, 1);
});
test('Quemado pulses on the fight\'s clock, every few seconds while it lasts, then goes out', () => {
  const s = createBattle(1, 2, false, 'matemagico');
  const dog = s.foes[0];
  act(s, 'skill', 'dog-0', 'foc-binari');
  const hp = dog.hp, { seconds, every } = TIMED.quemado, each = pulseDamage('quemado', 1, dog.maxHp);
  assert.deepEqual(runClock(s, every * 3, () => true), [], 'its clock waits for a fire still on its way');
  assert.deepEqual(runClock(s, every - .01), [], 'nothing before its first pulse');
  assert.deepEqual(runClock(s, .01), [{ target: 'dog-0', status: 'quemado', level: 1, amount: each }]);
  // Frame by frame, the same pulses as in one go.
  let pulses = 0;
  for (let t = 0; t < seconds + 1; t += 1 / 60) pulses += runClock(s, 1 / 60).length;
  assert.equal(pulses, seconds / every - 1);
  assert.equal(dog.hp, hp - each * seconds / every);
  assert.equal(dog.timed.quemado, undefined, 'out once its time is up');
});
test('burning again before it goes out raises Quemado a level, up to III, and starts its clock over', () => {
  const s = createBattle(1, 2, false, 'matemagico');
  const [gerard] = s.allies, dog = s.foes[0];
  dog.hp = dog.maxHp = 500;
  // Fire again each round, as fast as the round goes by: the clock only moves with `runClock`.
  const cast = () => { gerard.secondary = gerard.maxSecondary; const fire = act(s, 'skill', 'dog-0', 'foc-binari'); s.foes.forEach(f => enemyAct(s, f.id)); nextRound(s); return fire; };
  cast();
  runClock(s, 7);
  assert.deepEqual(cast().burn, { id: 'quemado', level: 2 });
  assert.equal(dog.timed.quemado.left, TIMED.quemado.seconds, 'its clock starts over');
  assert.equal(runClock(s, 2)[0].amount, pulseDamage('quemado', 2, 500));
  assert.equal(cast().burn.level, 3);
  cast();
  assert.equal(dog.timed.quemado.level, 3, 'III is the top: again only starts its clock over');
  // Once it is out, fire starts again at I.
  runClock(s, TIMED.quemado.seconds);
  assert.equal(dog.timed.quemado, undefined);
  assert.equal(cast().burn.level, 1);
});
test('keeping a fire going always does more than letting it go out and lighting it again', () => {
  const { seconds, every, levels } = TIMED.quemado, count = seconds / every;
  for (let hp = 20; hp <= 600; hp++) for (let level = 1; level < levels.length; level++) {
    const now = pulseDamage('quemado', level, hp), up = pulseDamage('quemado', level + 1, hp);
    // Raised after `done` of its pulses, against waiting it out and lighting a new one at I.
    for (let done = 0; done < count; done++) {
      assert.ok(done * now + count * up > count * now + count * pulseDamage('quemado', 1, hp), `${hp} PV, level ${level}, after ${done} pulses`);
    }
  }
});
test('Quemado takes a smaller share of a big foe than of a small one', () => {
  const share = hp => pulseDamage('quemado', 3, hp) / hp;
  assert.ok(share(54) > share(130) && share(130) > share(260), 'a dog burns down faster than a boss');
  assert.ok(pulseDamage('quemado', 1, 260) >= pulseDamage('quemado', 1, 54), 'yet a boss still feels it');
});
test('the clock stands still once the fight is over, and a fire can end it on its own', () => {
  const s = createBattle(1, 1, false, 'matemagico');
  const dog = s.foes[0];
  act(s, 'skill', 'dog-0', 'foc-binari');
  dog.hp = 1;
  runClock(s, TIMED.quemado.every);
  assert.equal(dog.hp, 0); assert.equal(s.phase, 'won');
  assert.equal(dog.timed.quemado, undefined, 'whoever falls stops burning');
  const after = createBattle(1, 1, false, 'matemagico');
  act(after, 'skill', 'dog-0', 'foc-binari'); after.phase = 'won';
  assert.deepEqual(runClock(after, 5), []);
});
test('L and R swap the active fighter\'s ánima for free among their own (their kit), with its skills and stats; Bernat wears none', () => {
  const s = createBattle([{ id: 'gerard', name: 'Gerard', profile: 'gerard', classId: 'matemagico', kit: ['matemagico', 'papagato'] }, { id: 'bernat', name: 'Bernat', profile: 'bernat' }], 2, false, undefined, ['matemagico', 'papagato']);
  const [gerard, bernat] = s.allies;
  assert.equal(gerard.stats.magia, 11);
  assert.equal(switchAnima(s, 1), 'papagato');
  assert.equal(gerard.classId, 'papagato'); assert.equal(gerard.stats.magia, 10); assert.equal(gerard.stats.velocidad, 12);
  assert.deepEqual(skillsFor(s, gerard).map(k => k.id), ['zarpazo', 'escondite']);
  assert.equal(s.active, 0, 'the turn is still his');
  assert.equal(switchAnima(s, 1), 'matemagico', 'round the list');
  assert.equal(switchAnima(s, -1), 'papagato');
  assert.equal(wearAnima(s, 'papagato'), false, 'already on');
  gerard.hp = 50; gerard.secondary = 1; switchAnima(s, 1);
  assert.equal(gerard.hp, 50, 'PV stay');
  assert.equal(gerard.secondary, MANA_POINTS, 'Matemágico brings its own maná, full');
  switchAnima(s, -1);
  assert.equal(gerard.secondary, 1, 'and Papagato kept what it had left');
  switchAnima(s, 1);
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
  };
  for (const [name, move] of Object.entries(strategies)) {
    // Gerard has no ánima yet: it wakes up here.
    const state = createMinionBattle(undefined, []);
    assert.equal(cornered(state), true, 'nobody escapes the palace minion');
    assert.equal(act(state, 'escape'), undefined);
    assert.deepEqual(skillsFor(state, state.allies[0]), [], 'no skills before Matemágico');
    while (state.phase !== 'beat') {
      assert.ok(state.round <= 6, `${name}: the beat came by round 6`);
      const gerard = name === 'guard' ? act(state, 'defend') : act(state, 'attack', 'minion-0');
      if (gerard.kind === 'attack') { assert.equal(gerard.amount, 0); assert.equal(gerard.swallowed, true); }
      move(state);
      enemyAct(state, 'minion-0');
      assert.ok(state.allies.every(a => a.hp > 0), `${name}: nobody falls before the beat`);
      nextRound(state);
    }
    assert.equal(state.allies[1].hp, Math.min(state.allies[1].hp, BEAT_HP));
    assert.equal(state.foes[0].hp, 40, `${name}: not a scratch`);
    awaken(state, 'matemagico');
    assert.equal(state.phase, 'player');
    const gerard = state.allies[state.active];
    assert.equal(gerard.id, 'gerard'); assert.equal(gerard.classId, 'matemagico');
    assert.equal(gerard.secondary, MANA_POINTS, 'its maná full');
    assert.deepEqual(skillsFor(state, gerard).map(s => s.id), ['foc-binari']);
    assert.deepEqual(state.animas, ['matemagico'], 'Matemágico joins the ánimas L and R walk through');
    assert.ok(!skillsFor(state, state.allies[1]).length, 'Bernat still only attacks');
    const fire = act(state, 'skill', 'minion-0', 'foc-binari');
    assert.equal(fire.melted, true, 'fire melts the gum'); assert.ok(fire.amount > 0);
    assert.equal(state.foes[0].shell, false);
    assert.match(state.message, /derrite/);
  }
});

test('skill descriptions follow the plain shape in AGENTS.md, with the intensity their power gives', () => {
  const intensity = power => power <= 20 ? 'leve' : power <= 34 ? 'medi[oa]' : power <= 49 ? 'alt[oa]' : 'muy alt[oa]';
  const targets = { foes: 'a un enemigo', 'all-foes': 'a todos los enemigos', allies: 'a un aliado herido', party: 'a todo el equipo' };
  for (const skill of SKILLS.filter(s => !('abstract' in s && s.abstract))) {
    const extra = '( [A-ZÁÉÍÓÚ][^.]*\\.)*';
    const shape = skill.kind === 'boost' || skill.kind === 'debuff' ? `^(Sube|Baja) [^.]+ de ${targets[skill.side].slice(2)} durante ${BOOST_ROUNDS} rondas\\.${extra}$`
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
test('Papagato: Haru\'s claw adds Sangrado and Yuki raises Defensa', async () => {
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
  assert.deepEqual(skillsFor(s, aitor).map(k => k.id), ['foc-binari']);
  s.phase = 'player'; s.active = s.allies.indexOf(gerard);
  act(s, 'skill', undefined, 'escondite');
  assert.equal(boostRounds(s, 'escondite'), BOOST_ROUNDS);
  s.phase = 'player';
  assert.deepEqual(validTargets(s, 'skill', 'escondite'), [], 'cannot be stacked while it runs');
});
test('Papagato is the party\'s once the mission is won', async () => {
  const { Story } = await import('../src/story.ts');
  assert.deepEqual(new Story([]).classes, [], 'no ánima before the palace');
  assert.deepEqual(new Story(['matemagico']).classes, ['matemagico']);
  assert.deepEqual(new Story(['matemagico', 'papagato']).classes, ['matemagico', 'papagato']);
  assert.deepEqual(new Story(['noista']).classes, ['matemagico'], 'an old save\'s Noísta flag is Matemágico now');
});
test('Papagato grows: Zarpa en la llaga cashes in Sangrado, Las dos a la vez reaches every foe', () => {
  const party = [{ id: 'gerard', name: 'Gerard', profile: 'gerard35', classId: 'papagato' }];
  const s = createBattle(party, 3, false, undefined, ['papagato']);
  const gerard = s.allies[0];
  assert.deepEqual(skillsFor(s, gerard).map(k => k.id), ['zarpazo', 'escondite'], 'level 1');
  s.levels = { papagato: 2 };
  assert.deepEqual(skillsFor(s, gerard).map(k => k.id), ['zarpazo', 'escondite', 'zarpazos', 'ronroneo'], 'level 2');
  s.levels = { papagato: 3 };
  assert.deepEqual(skillsFor(s, gerard).map(k => k.id), ['zarpazo', 'escondite', 'zarpazos', 'ronroneo', 'llaga', 'a-la-vez']);
  const all = act(s, 'skill', undefined, 'a-la-vez');
  assert.equal(all.hits.length, 3);
  assert.ok(s.foes.every(f => stacks(f, 'sangrado') === 1));
  const plain = createBattle(party, 1, false, undefined, ['papagato']); plain.levels = { papagato: 3 };
  const bled = createBattle(party, 1, false, undefined, ['papagato']); bled.levels = { papagato: 3 };
  addStatus(bled.foes[0], 'sangrado', 5);
  for (const dog of [plain.foes[0], bled.foes[0]]) dog.hp = dog.maxHp = 999;
  const a = act(plain, 'skill', 'dog-0', 'llaga').amount, b = act(bled, 'skill', 'dog-0', 'llaga').amount;
  assert.equal(b, a * 3, 'each stack opens the wound twice as far: +40% each, five of them ×3');
  assert.equal(stacks(bled.foes[0], 'sangrado'), 0, 'and it spends them');
});
test('Sangrado is an open wound: the next physical blow spends it all, +20% for each stack', async () => {
  const { BLEED_BONUS, woundScale } = await import('../src/battle.ts');
  assert.equal(BLEED_BONUS, .2);
  const party = [{ id: 'gerard', name: 'Gerard', profile: 'gerard35', classId: 'papagato' }];
  const plain = createBattle(party, 1, false, undefined, ['papagato']);
  const bled = createBattle(party, 1, false, undefined, ['papagato']);
  addStatus(bled.foes[0], 'sangrado', 3);
  const a = act(plain, 'attack', 'dog-0'), b = act(bled, 'attack', 'dog-0');
  assert.equal(b.amount, Math.round(a.amount * 1.6), 'Atacar on three stacks lands 60% harder');
  assert.equal(b.bled, 3); assert.equal(a.bled, undefined);
  assert.equal(stacks(bled.foes[0], 'sangrado'), 0, 'spent all at once');
  assert.match(bled.message, /La herida se abre: \+60 %/);
  assert.equal(woundScale(3), 1.6); assert.equal(woundScale(3, 'llaga'), 2.2); assert.equal(woundScale(0), 1);
  // Haru's claw on a bleeding foe spends the old wound first, then opens a new one.
  const claw = createBattle(party, 1, false, undefined, ['papagato']);
  addStatus(claw.foes[0], 'sangrado', 2);
  const swipe = act(claw, 'skill', 'dog-0', 'zarpazo');
  assert.equal(swipe.bled, 2);
  assert.deepEqual(swipe.status, { id: 'sangrado', stacks: 2 }, 'and adds its own again');
  // Every claw of a flurry lands harder; a magic blow leaves the wound alone.
  const fire = createBattle([{ id: 'gerard', name: 'Gerard', profile: 'gerard35', classId: 'matemagico' }], 1, false, undefined, ['matemagico']);
  addStatus(fire.foes[0], 'sangrado', 4);
  assert.equal(act(fire, 'skill', 'dog-0', 'foc-binari').bled, undefined);
  assert.equal(stacks(fire.foes[0], 'sangrado'), 4, 'fire does not open it');
  // Las dos a la vez spends each foe's own.
  const all = createBattle(party, 2, false, undefined, ['papagato']); all.levels = { papagato: 3 };
  for (const dog of all.foes) dog.hp = dog.maxHp = 999;
  addStatus(all.foes[1], 'sangrado', 2);
  const both = act(all, 'skill', undefined, 'a-la-vez');
  assert.deepEqual(both.hits.map(h => h.bled), [undefined, 2]);
  assert.ok(all.foes.every(f => stacks(f, 'sangrado') === 1), 'each left with the one it adds');
});

// Ángulo exacto, Ronroneo de Yuki and the dual attacks (docs/animas/README.md § Combined skills).
const DUO = [{ id: 'gerard', name: 'Gerard', profile: 'gerard35', classId: 'matemagico' }, { id: 'aitor', name: 'Aitor', profile: 'aitor', classId: 'papagato' }];
/** Gerard on Matemágico and Aitor on Papagato against `dogs` sturdy dogs: Aitor (quicker) acts first. */
const duoFight = (levels = { papagato: 2, matemagico: 2 }, dogs = 2) => {
  const s = createBattle(DUO, dogs, false, undefined, ['matemagico', 'papagato']);
  s.levels = { ...levels }; s.seed = 35;
  s.foes.forEach(f => { f.hp = f.maxHp = 9999; });
  return s;
};
const byId = (s, id) => s.allies.find(a => a.id === id);
const endRound = s => { s.phase = 'enemy'; s.enemyActions = []; s.foes.filter(f => f.hp > 0).forEach(f => enemyAct(s, f.id)); return nextRound(s); };

test('Ángulo exacto marks a foe: Defensa and Espíritu down for three rounds, every hit on it a little harder, not twice at once', async () => {
  const { statShifts, markRounds } = await import('../src/battle.ts');
  const s = duoFight();
  s.active = s.allies.indexOf(byId(s, 'gerard'));
  const plain = act(structuredClone(s), 'attack', 'dog-0').amount;
  const mark = act(s, 'skill', 'dog-0', 'angulo');
  assert.deepEqual(mark.stats, [{ target: 'dog-0', way: 'down', stats: ['defensa', 'espiritu'] }]);
  assert.equal(markRounds(s, s.foes[0], 'angulo'), BOOST_ROUNDS);
  assert.match(s.message, /Defensa y Espíritu −3 durante 3 rondas/);
  assert.deepEqual(statShifts(s, s.foes[0]).map(x => [x.stat, x.way, x.amount, x.rounds, x.from]), [['defensa', 'down', 3, 3, ['Ángulo exacto']], ['espiritu', 'down', 3, 3, ['Ángulo exacto']]]);
  s.phase = 'player';
  assert.deepEqual(validTargets(s, 'skill', 'angulo').map(f => f.id), ['dog-1'], 'not on a foe already marked');
  assert.equal(act(s, 'attack', 'dog-0').amount, plain + 3, 'damage is flat: three points off, three more a hit');
  for (let round = 0; round < BOOST_ROUNDS; round++) endRound(s);
  assert.equal(markRounds(s, s.foes[0], 'angulo'), 0, 'gone after its three rounds');
  assert.equal(s.foes[0].marks.angulo, undefined);
  assert.deepEqual(statShifts(s, s.foes[0]), []);
});

test('Ronroneo de Yuki cures everyone standing a little and takes away every status of the mind, whichever it is', async () => {
  const { MENTAL_STATUSES } = await import('../src/battle.ts');
  const { healing } = await import('../src/stats.ts');
  assert.deepEqual(MENTAL_STATUSES, ['mareo', 'llorera']);
  assert.ok(!STATUSES.sangrado.mental, 'a wound is not of the mind');
  const s = duoFight();
  const aitor = byId(s, 'aitor'), gerard = byId(s, 'gerard');
  assert.deepEqual(validTargets(s, 'skill', 'ronroneo'), [], 'nothing to do with everyone well');
  assert.equal(act(s, 'skill', undefined, 'ronroneo'), undefined);
  addStatus(aitor, 'mareo', 2);
  assert.deepEqual(validTargets(s, 'skill', 'ronroneo').map(a => a.id), ['aitor'], 'a status of the mind is worth calming');
  gerard.hp -= 30; addStatus(gerard, 'llorera', 1); addStatus(gerard, 'sangrado', 3);
  const purr = act(s, 'skill', undefined, 'ronroneo');
  const each = healing(14, aitor.stats);
  assert.equal(each, 14 - 10 + aitor.stats.magia);
  assert.deepEqual(purr.healedAll, [{ target: 'aitor', amount: 0 }, { target: 'gerard', amount: each }]);
  assert.equal(gerard.hp, gerard.maxHp - 30 + each);
  assert.deepEqual(purr.cleansed, [{ target: 'aitor', statuses: ['mareo'] }, { target: 'gerard', statuses: ['llorera'] }]);
  assert.equal(stacks(aitor, 'mareo'), 0); assert.equal(stacks(gerard, 'llorera'), 0);
  assert.equal(stacks(gerard, 'sangrado'), 3, 'bleeding stays');
  assert.deepEqual(purr.stats.map(c => [c.target, c.way]), [['aitor', 'up'], ['gerard', 'up']]);
  assert.match(s.message, /Se les pasan los efectos de estado mentales\./);
  assert.doesNotMatch(s.message, /mareo|llorera/i, 'never names the statuses it takes away');
  assert.equal(aitor.secondary, MANA_POINTS - 2);
});

test('dual descriptions follow the plain shape too, and each dual pairs a skill of each of two ánimas, in either order', async () => {
  const { DUALS, dualOf, dualCost } = await import('../src/battle.ts');
  const intensity = power => power <= 20 ? 'leve' : power <= 34 ? 'medi[oa]' : power <= 49 ? 'alt[oa]' : 'muy alt[oa]';
  assert.deepEqual(DUALS.map(d => d.id), ['zarpazos-de-fuego', 'punto-debil']);
  for (const d of DUALS) {
    const [a, b] = d.parts.map(id => SKILLS.find(s => s.id === id));
    assert.notEqual(a.class, b.class, `${d.name}: two ánimas`);
    assert.equal(dualOf(a.id, b.id), d); assert.equal(dualOf(b.id, a.id), d);
    assert.deepEqual(dualCost(d), { [a.id]: a.cost, [b.id]: b.cost });
    if (d.abstract) continue;
    assert.match(d.description, new RegExp(`^Daño ${intensity(d.power)} ${d.kind === 'physical' ? 'físico' : 'mágico'}( de tipo [^ ]+)? a un enemigo\\.( [A-ZÁÉÍÓÚ][^.]*\\.)*$`), d.name);
  }
  assert.equal(dualOf('foc-binari', 'zarpazo'), undefined);
});

test('Zarpazos de fuego: both turns go into it, each wearer pays their own half, both ánimas take part, eight claws on Aitor\'s Fuerza', async () => {
  const s = duoFight();
  const aitor = byId(s, 'aitor'), gerard = byId(s, 'gerard');
  assert.equal(s.allies[s.active], aitor, 'the quicker one first');
  const claws = actDual(s, 'zarpazos-de-fuego', 'dog-1');
  assert.deepEqual(claws.dual, { id: 'zarpazos-de-fuego', name: 'Zarpazos de fuego', parts: ['zarpazos', 'foc-binari'], actors: ['aitor', 'gerard'], spent: { aitor: 2, gerard: 1 } });
  assert.equal(claws.kind, 'skill'); assert.equal(claws.target, 'dog-1');
  assert.equal(aitor.secondary, MANA_POINTS - 2); assert.equal(gerard.secondary, MANA_POINTS - 1);
  assert.equal(s.phase, 'enemy', 'both turns used');
  assert.deepEqual(s.fought, { papagato: ['aitor'], matemagico: ['gerard'] });
  const { DUALS } = await import('../src/battle.ts'), power = DUALS.find(d => d.id === 'zarpazos-de-fuego').power;
  assert.deepEqual(claws.strikes, Array(8).fill(power + aitor.stats.fuerza - 10), 'the claws are the Papagato wearer\'s');
  assert.match(s.message, /^¡Ataque dual! Zarpazos de fuego contra/);
  assert.equal(actDual(s, 'zarpazos-de-fuego', 'dog-1'), undefined, 'not outside the party\'s turn');
});

test('Zarpazos de fuego\'s coins come from the fight\'s own dice: the same seed gives the same claws of fire; wet layers never catch', async () => {
  const { roll, createFearBattle } = await import('../src/battle.ts');
  const coinsAt = seed => { const s = duoFight(); s.seed = seed; return actDual(s, 'zarpazos-de-fuego', 'dog-0'); };
  const a = coinsAt(7), b = coinsAt(7);
  assert.deepEqual(a.coins, b.coins);
  const dice = { seed: 7 };
  assert.deepEqual(a.coins, Array.from({ length: 8 }, () => roll(dice) < .75 ? 1 : 0), 'a coin a claw on a bare foe, three in four of them fire');
  const lit = a.coins.filter(Boolean).length;
  assert.deepEqual(a.burns.filter(Boolean), Array.from({ length: lit }, (_, i) => Math.min(3, i + 1)), 'each coin of fire lights it or raises it a level');
  if (lit) assert.deepEqual(a.burn, { id: 'quemado', level: Math.min(3, lit) });
  const seen = new Set(Array.from({ length: 12 }, (_, seed) => coinsAt(seed + 1).coins.join('')));
  assert.ok(seen.size > 6, 'different dice, different fire');
  const onion = createFearBattle(DUO, 'cebolla', undefined, () => .3);
  onion.levels = { papagato: 2 }; onion.foes[0].hp = onion.foes[0].maxHp = 999;
  const wet = actDual(onion, 'zarpazos-de-fuego', 'cebolla');
  assert.equal(wet.peeled, 8); assert.equal(onion.foes[0].layers, 0);
  assert.deepEqual(wet.coins.slice(0, 7), [0, 0, 0, 0, 0, 0, 0], 'no fire while it has layers');
});

test('Punto débil: a light blow that leaves the next damaging action on that foe three times as hard, every strike of it, once; ticks neither use nor spend it', async () => {
  const { statShifts, weakSpotRounds, WEAK_SPOT } = await import('../src/battle.ts');
  const s = duoFight(), dog = s.foes[0], aitor = byId(s, 'aitor');
  const spot = actDual(s, 'punto-debil', 'dog-0');
  assert.deepEqual(spot.dual.parts, ['zarpazo', 'angulo']); assert.deepEqual(spot.dual.spent, { aitor: 1, gerard: 1 });
  assert.equal(spot.amount, 20 + aitor.stats.fuerza - 10); assert.equal(spot.strikes, undefined, 'one blow');
  assert.equal(spot.weakSpot, 'set'); assert.equal(weakSpotRounds(s, dog), 2, 'this round and the next');
  assert.equal(stacks(dog, 'sangrado'), 0, 'it leaves no wound');
  assert.ok(statShifts(s, dog).some(x => x.stat === 'defensa' && x.way === 'down' && x.from.includes('Punto débil')), 'its guard shows it');
  // Burning and bleeding go on as ever, and the mark waits.
  dog.timed = { quemado: { level: 2, left: 10, next: 2 } }; addStatus(dog, 'sangrado', 1);
  const pulse = runClock(s, 2)[0];
  assert.equal(pulse.amount, pulseDamage('quemado', 2, dog.maxHp));
  const ticks = endRound(s);
  assert.equal(ticks.find(t => t.target === 'dog-0').amount, STATUSES.sangrado.tick);
  assert.equal(weakSpotRounds(s, dog), 1, 'still there next round');
  delete dog.timed;
  const bare = structuredClone(s); delete bare.foes[0].weakSpot;
  const without = act(bare, 'skill', 'dog-0', 'zarpazos');
  const hit = act(s, 'skill', 'dog-0', 'zarpazos');
  assert.deepEqual(hit.strikes, without.strikes.map(n => n * WEAK_SPOT), 'every claw of it');
  assert.equal(hit.weakSpot, 'spent'); assert.equal(dog.weakSpot, undefined, 'spent at once');
  assert.match(s.message, /el triple de daño/);
  const after = act(s, 'attack', 'dog-0');
  assert.equal(after.weakSpot, undefined, 'the next one lands as ever');
  // Unused, it fades at the end of the next round.
  const fade = duoFight();
  actDual(fade, 'punto-debil', 'dog-0');
  endRound(fade); assert.equal(weakSpotRounds(fade, fade.foes[0]), 1);
  endRound(fade); assert.equal(weakSpotRounds(fade, fade.foes[0]), 0); assert.equal(fade.foes[0].weakSpot, undefined);
  // A second Punto débil on a foe that still has one: it spends that one (three times as hard) and leaves a new one.
  // (A dual goes off once a fight: forgetting the first one checks the mark's own rule.)
  const { markSpent, markLeft } = await import('../src/battle.ts');
  const again = duoFight();
  actDual(again, 'punto-debil', 'dog-0'); endRound(again); delete again.usedDuals;
  const plain = structuredClone(again); delete plain.foes[0].weakSpot;
  const once = actDual(plain, 'punto-debil', 'dog-0'), twice = actDual(again, 'punto-debil', 'dog-0');
  assert.equal(twice.amount, once.amount * WEAK_SPOT);
  assert.equal(twice.weakSpot, 'renewed'); assert.ok(markSpent(twice) && markLeft(twice));
  assert.ok(markLeft(once) && !markSpent(once));
  assert.equal(weakSpotRounds(again, again.foes[0]), 2, 'the new one, this round and the next');
});

test('a skill the later fighter queued turns the earlier one\'s matching skill into their dual, by surprise; otherwise each plays their own', async () => {
  const { queue, queuedDual, commit, takeQueued } = await import('../src/battle.ts');
  const s = duoFight();
  assert.equal(queue(s, 'aitor', { action: 'defend' }), false, 'not the one choosing now');
  assert.equal(queue(s, 'gerard', { action: 'skill', skill: 'zarpazos', target: 'dog-0' }), false, 'only what they have on');
  assert.ok(queue(s, 'gerard', { action: 'skill', skill: 'foc-binari', target: 'dog-0' }));
  assert.equal(queuedDual(s, 'zarpazo'), undefined, 'Zarpazo and Foc Binari make nothing');
  assert.equal(queuedDual(s, 'zarpazos').id, 'zarpazos-de-fuego');
  const dual = commit(s, 'skill', 'dog-1', 'zarpazos');
  assert.equal(dual.dual.id, 'zarpazos-de-fuego');
  assert.equal(dual.target, 'dog-1', 'where the one confirming aims it');
  assert.equal(s.queued, undefined, 'nothing left queued');
  assert.equal(s.phase, 'enemy');
  // Not a pair: Aitor's own action, then Gerard's queued one when his turn comes.
  const t = duoFight();
  queue(t, 'gerard', { action: 'skill', skill: 'foc-binari', target: 'dog-0' });
  const own = commit(t, 'attack', 'dog-0');
  assert.equal(own.dual, undefined); assert.equal(own.kind, 'attack');
  assert.equal(t.allies[t.active].id, 'gerard');
  assert.equal(queue(t, 'aitor', { action: 'defend' }), false, 'nobody queues behind the last one: an earlier fighter has had their turn');
  assert.deepEqual(takeQueued(t), { action: 'skill', skill: 'foc-binari', target: 'dog-0' });
  assert.equal(t.queued.gerard, undefined, 'taken');
  assert.equal(act(t, 'skill', 'dog-0', 'foc-binari').skill, 'foc-binari');
  // Queued, then no longer possible: cleared, and they choose again.
  const u = duoFight();
  queue(u, 'gerard', { action: 'attack', target: 'dog-0' });
  u.foes[0].hp = 1; act(u, 'attack', 'dog-0');
  assert.equal(takeQueued(u), undefined, 'its target fell');
  assert.equal(u.queued.gerard, undefined);
  const v = duoFight();
  byId(v, 'gerard').secondary = 0;
  assert.equal(queue(v, 'gerard', { action: 'skill', skill: 'foc-binari', target: 'dog-0' }), false, 'no maná for it');
  // A queue never outlives the round, nor a fight left.
  const w = duoFight();
  queue(w, 'gerard', { action: 'defend' }); act(w, 'escape');
  assert.equal(w.queued, undefined);
  const x = duoFight();
  queue(x, 'gerard', { action: 'skill', skill: 'foc-binari', target: 'dog-0' });
  byId(x, 'gerard').secondary = 0;
  assert.equal(queuedDual(x, 'zarpazos'), undefined, 'a half it can no longer pay: no dual');
  assert.equal(commit(x, 'skill', 'dog-0', 'zarpazos').dual, undefined, 'Aitor\'s Zarpazos on its own');
});

test('each dual goes off once a fight: after it, its two skills are each one\'s own again, and the other dual still can', async () => {
  const { queue, queuedDual, commit, dualOptions } = await import('../src/battle.ts');
  const reasons = s => Object.fromEntries(dualOptions(s).map(o => [o.dual.id, o.reason ?? 'ok']));
  const s = duoFight();
  queue(s, 'gerard', { action: 'skill', skill: 'foc-binari', target: 'dog-0' });
  assert.equal(commit(s, 'skill', 'dog-0', 'zarpazos').dual.id, 'zarpazos-de-fuego');
  assert.deepEqual(s.usedDuals, ['zarpazos-de-fuego']);
  endRound(s); s.allies.forEach(a => { a.secondary = MANA_POINTS; });
  assert.deepEqual(reasons(s), { 'zarpazos-de-fuego': 'used', 'punto-debil': 'ok' });
  assert.equal(actDual(s, 'zarpazos-de-fuego', 'dog-0'), undefined, 'not twice');
  queue(s, 'gerard', { action: 'skill', skill: 'foc-binari', target: 'dog-0' });
  assert.equal(queuedDual(s, 'zarpazos'), undefined, 'nothing to show while aiming it');
  const own = commit(s, 'skill', 'dog-0', 'zarpazos');
  assert.equal(own.dual, undefined); assert.equal(own.skill, 'zarpazos', 'Aitor\'s Zarpazos on its own');
  assert.equal(s.queued.gerard.skill, 'foc-binari', 'and Gerard\'s Foc Binari still to come');
  // The other one, once too.
  const t = duoFight();
  actDual(t, 'zarpazos-de-fuego', 'dog-0'); endRound(t);
  assert.equal(actDual(t, 'punto-debil', 'dog-0').dual.id, 'punto-debil');
  endRound(t);
  assert.deepEqual(reasons(t), { 'zarpazos-de-fuego': 'used', 'punto-debil': 'used' });
  // A new fight has them all again.
  assert.deepEqual(reasons(duoFight()), { 'zarpazos-de-fuego': 'ok', 'punto-debil': 'ok' });
});

test('the development Dual list says why each dual cannot happen now, and may put the active fighter\'s ánima on', async () => {
  const { dualOptions } = await import('../src/battle.ts');
  const reasons = s => Object.fromEntries(dualOptions(s).map(o => [o.dual.id, o.reason ?? 'ok']));
  assert.deepEqual(reasons(duoFight({})), { 'zarpazos-de-fuego': 'level', 'punto-debil': 'level' }, 'none at level 1');
  assert.deepEqual(reasons(duoFight({ papagato: 2 })), { 'zarpazos-de-fuego': 'ok', 'punto-debil': 'level' });
  assert.deepEqual(reasons(duoFight()), { 'zarpazos-de-fuego': 'ok', 'punto-debil': 'ok' });
  const poor = duoFight(); byId(poor, 'aitor').secondary = 1;
  assert.deepEqual(reasons(poor), { 'zarpazos-de-fuego': 'mana', 'punto-debil': 'ok' });
  const down = duoFight(); byId(down, 'gerard').hp = 0;
  assert.deepEqual(reasons(down), { 'zarpazos-de-fuego': 'down', 'punto-debil': 'down' });
  const late = duoFight(); act(late, 'defend');
  assert.deepEqual(reasons(late), { 'zarpazos-de-fuego': 'acted', 'punto-debil': 'acted' }, 'from the later fighter: the earlier one is through');
  const bare = createBattle([{ id: 'gerard', name: 'Gerard', profile: 'gerard35', kit: ['matemagico'] }, { id: 'aitor', name: 'Aitor', profile: 'aitor', classId: 'papagato' }], 1, false, undefined, ['matemagico', 'papagato']);
  bare.levels = { papagato: 2, matemagico: 2 };
  bare.allies.sort((a, b) => (a.id === 'gerard' ? -1 : 1) - (b.id === 'gerard' ? -1 : 1)); bare.active = 0;
  assert.equal(dualOptions(bare)[0].reason, 'wear');
  const swap = dualOptions(bare, true)[0];
  assert.equal(swap.ok, true); assert.equal(swap.wear, 'matemagico');
  assert.equal(bare.allies[0].classId, undefined, 'only looked at: nothing put on');
});
