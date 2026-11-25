import test from 'node:test';
import assert from 'node:assert/strict';
import { ORBITAL_BLIND, improve, createBattle, act, enemyAct, nextRound, skillsFor, validTargets, boostRounds, BOOST_ROUNDS, switchAnima, wearAnima, SKILLS, STATUSES, addStatus, stacks, MANA_POINTS, DEFEND_CHARGE, REST_CHARGE, TIMED, pulseDamage, runClock, actDual, ESCAPE, escapeChance, escapeShown, cornered } from '../src/battle.ts';

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

test('Huir is in the game only in the friends\' missions and at night on the Meridiana; tried as chance it can fail and grow likelier', async () => {
  const { createGuardBattle, createFearBattle, palaceGuards, FLEEABLE } = await import('../src/battle.ts');
  try {
    ESCAPE.mode = 'off';
    const off = createBattle();
    assert.equal(escapeShown(off), false); assert.equal(cornered(off), true);
    assert.equal(act(off, 'escape'), undefined);
    const guards = createGuardBattle([{ id: 'gerard', name: 'Gerard', profile: 'gerard' }], palaceGuards(0));
    assert.equal(act(guards, 'escape'), undefined, 'not from the palace guards either');
    const party = [{ id: 'gerard', name: 'Gerard', profile: 'gerard35', classId: 'matemagico' }];
    for (const encounter of ['cuerdas-lealtad', 'modelo-celdas', 'luca-sillones', 'camping-dados', 'crias-1']) {
      const mission = createFearBattle(party, encounter);
      assert.ok(escapeShown(mission) && !cornered(mission), `${encounter}: Huir is there`);
      assert.equal(escapeChance(mission), 1, `${encounter}: and it works`);
      act(mission, 'escape');
      assert.equal(mission.phase, 'escaped');
    }
    const night = createGuardBattle(party, palaceGuards(0), undefined, 'night-guard');
    assert.ok(escapeShown(night) && !cornered(night), 'the way home at night lets them run');
    for (const boss of ['voz', 'no-converge', 'fran', 'campeon', 'camping-negra', 'uri-vertigo', 'sobremesa', 'aurelia', 'reina']) assert.ok(!FLEEABLE.has(boss), `${boss}: nobody runs from it`);
    assert.ok(!FLEEABLE.has('alumnos-1a'), 'nor from the castle\'s rooms');
    ESCAPE.mode = 'chance';
    let failed = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const s = createBattle(2); s.seed = seed;
      assert.equal(escapeChance(s), ESCAPE.chance);
      const effect = act(s, 'escape');
      assert.ok(effect);
      if (!effect.noWayOut) { assert.equal(s.phase, 'escaped'); continue; }
      failed++;
      assert.equal(s.phase, 'player', 'the fight goes on'); assert.equal(s.active, 1, 'the turn was spent');
      assert.equal(s.escapeTries, 1); assert.equal(escapeChance(s), ESCAPE.chance + ESCAPE.step);
    }
    assert.ok(failed > 5 && failed < 35, `about half fail (${failed}/40)`);
    const tries = createBattle(); tries.escapeTries = 9;
    assert.equal(escapeChance(tries), 1, 'never past certain');
  } finally { ESCAPE.mode = 'always'; }
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
test('each ánima keeps its own maná, and the others get some back every time their wearer acts', () => {
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
  assert.equal(gerard.secondary, MANA_POINTS - 1, 'the one worn gets nothing back');
  gerard.secondary = 0;
  wearAnima(s, 'papagato');
  assert.equal(gerard.secondary, MANA_POINTS, 'Papagato brings its own, full');
  assert.equal(gerard.mana.matemagico, 0, 'put away, Matemágico keeps what it had');
  act(s, 'skill', 'dog-0', 'zarpazo');
  assert.equal(gerard.mana.matemagico, REST_CHARGE, 'changed and acted: the one put away gets some back at once');
  assert.equal(gerard.secondary, MANA_POINTS - 1, 'the worn one rests not');
  endRound();
  assert.equal(gerard.mana.matemagico, REST_CHARGE, 'the round\'s end gives nothing of its own');
  act(s, 'defend');
  assert.equal(gerard.mana.matemagico, 2 * REST_CHARGE, 'any action counts, Defender too');
  for (let i = 0; i < MANA_POINTS; i++) { endRound(); act(s, 'attack', 'dog-0'); }
  assert.equal(gerard.mana.matemagico, MANA_POINTS, 'never past the top');
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
  assert.equal(gerard.classId, 'papagato'); assert.equal(gerard.stats.magia, 10); assert.equal(gerard.stats.fuerza, 11); assert.equal(gerard.stats.critico, 15);
  assert.equal('velocidad' in gerard.stats, false, 'there is no Velocidad (docs/combat.md § Sin Velocidad)');
  assert.deepEqual(skillsFor(s, gerard).map(k => k.id), ['zarpazo']);
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

// A damage description names its kind, then its element, then how strong (AGENTS.md): `Daño mágico de fuego medio`.
// Magic always says its element, or `no elemental`; a physical blow says one only if it has it.
const ELEMENT_WORDS = { fuego: 'de fuego', agua: 'de agua', electrico: 'eléctrico' };
const damageKind = ({ kind, element }) => kind === 'physical' ? `físico( (${Object.values(ELEMENT_WORDS).join('|')}))?`
  : `mágico ${element ? ELEMENT_WORDS[element] : `(${Object.values(ELEMENT_WORDS).join('|')}|no elemental)`}`;

test('skill descriptions follow the plain shape in AGENTS.md, with the intensity their power gives', () => {
  const intensity = power => power <= 20 ? 'leve' : power <= 34 ? 'medi[oa]' : power <= 49 ? 'alt[oa]' : 'muy alt[oa]';
  const targets = { foes: 'a un enemigo', 'all-foes': 'a todos los enemigos', allies: 'a un aliado herido', party: 'a todo el equipo' };
  for (const skill of SKILLS.filter(s => !('abstract' in s && s.abstract))) {
    const extra = '( [A-ZÁÉÍÓÚ][^.]*\\.)*';
    const shape = skill.kind === 'boost' || skill.kind === 'debuff' ? `^(Sube|Baja) [^.]+ de ${targets['screen' in skill ? 'party' : skill.side].slice(2)} durante ${BOOST_ROUNDS} rondas\\.${extra}$`
      : skill.kind === 'heal' ? `^Cura ${intensity(skill.power)} ${targets[skill.side]}\\.${extra}$`
      : skill.kind === 'guard' ? skill.side === 'party' ? `^Protege a todo el equipo durante \\d rondas\\.${extra}$` : `^Protege a un aliado (hasta el final de la ronda|durante \\d rondas)\\.${extra}$`
      // Sincopante's ecos (AGENTS.md § Ecos): one left at an ally's side, or the ecos themselves.
      // A charge on whoever uses it (∂Q/∂t Condensador).
      : skill.kind === 'charge' ? `^Carga a quien la usa [^.]+\\.${extra}$`
      : skill.kind === 'eco' ? `^(Deja un eco [^.]+ durante \\d+ segundos|Los ecos [^.]+)\\.${extra}$`
      : `^Daño ${damageKind(skill)} ${intensity(skill.power)} ${'rain' in skill || 'volley' in skill ? 'a enemigos al azar' : targets[skill.side]}\\.${extra}$`;
    assert.match(skill.description, new RegExp(shape), skill.name);
  }
});

test('the palace guards cannot be beaten without ánimas, and can be backed off from', async () => {
  const { palaceGuards, createGuardBattle, act, enemyAct, nextRound } = await import('../src/battle.ts');
  const { Story, STORY_FLAGS } = await import('../src/story.ts');
  const party = new Story(STORY_FLAGS.slice(0, STORY_FLAGS.indexOf('castle') + 1)).battleParty(true);
  assert.deepEqual(palaceGuards(0), { count: 3, hp: 250, power: 33 });
  assert.equal(palaceGuards(2).count, 3, 'three until the third ánima');
  assert.ok(palaceGuards(6).count === 1 && palaceGuards(6).hp === 70);
  // Without ánimas, attacking every turn loses.
  const state = createGuardBattle(party, palaceGuards(0));
  for (let round = 0; round < 30 && state.phase !== 'lost' && state.phase !== 'won'; round++) {
    while (state.phase === 'player') act(state, 'attack', state.foes.find(f => f.hp > 0).id);
    for (const foe of state.foes) if (state.phase === 'enemy') enemyAct(state, foe.id);
    nextRound(state);
  }
  assert.equal(state.phase, 'lost');
  // Backing off, where Huir is there (development).
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
test('Papagato: Haru\'s claw adds Sangrado; a party boost (Análisis Parálisis) cannot be stacked while it runs', async () => {
  const { boostRounds, createGuardBattle, palaceGuards } = await import('../src/battle.ts');
  const party = [{ id: 'gerard', name: 'Gerard', profile: 'gerard35', classId: 'papagato' }, { id: 'aitor', name: 'Aitor', profile: 'aitor', classId: 'matemagico' }];
  const s = createGuardBattle(party, palaceGuards(6));
  const gerard = s.allies.find(a => a.id === 'gerard'), aitor = s.allies.find(a => a.id === 'aitor');
  assert.deepEqual(skillsFor(s, gerard).map(k => k.id), ['zarpazo']);
  s.active = s.allies.indexOf(gerard);
  const claw = act(s, 'skill', 'guard-0', 'zarpazo');
  assert.deepEqual(claw.status, { id: 'sangrado', stacks: 2 });
  assert.equal(stacks(s.foes[0], 'sangrado'), 2);
  s.phase = 'player'; s.active = s.allies.indexOf(aitor);
  assert.deepEqual(skillsFor(s, aitor).map(k => k.id), ['foc-binari']);
  improve(s, { skills: ['analisis'] });
  assert.deepEqual(skillsFor(s, aitor).map(k => k.id), ['foc-binari', 'analisis'], 'a node of the jar, once bought');
  act(s, 'skill', undefined, 'analisis');
  assert.equal(boostRounds(s, 'analisis'), BOOST_ROUNDS);
  s.phase = 'player';
  assert.deepEqual(validTargets(s, 'skill', 'analisis'), [], 'cannot be stacked while it runs');
});
test('Papagato is the party\'s once the mission is won', async () => {
  const { Story } = await import('../src/story.ts');
  assert.deepEqual(new Story([]).classes, [], 'no ánima before the palace');
  assert.deepEqual(new Story(['matemagico']).classes, ['matemagico']);
  assert.deepEqual(new Story(['matemagico', 'papagato']).classes, ['matemagico', 'papagato']);
  assert.deepEqual(new Story(['noista']).classes, ['matemagico'], 'an old save\'s Noísta flag is Matemágico now');
});
test('Papagato grows: Zarpazos and Ronroneo at level 2, and Zarpa en la llaga, which cashes in Sangrado, at 3', () => {
  const party = [{ id: 'gerard', name: 'Gerard', profile: 'gerard35', classId: 'papagato' }];
  const s = createBattle(party, 3, false, undefined, ['papagato']);
  const gerard = s.allies[0];
  assert.deepEqual(skillsFor(s, gerard).map(k => k.id), ['zarpazo'], 'level 1');
  s.levels = { papagato: 2 };
  assert.deepEqual(skillsFor(s, gerard).map(k => k.id), ['zarpazo', 'zarpazos', 'ronroneo'], 'level 2');
  s.levels = { papagato: 3 };
  assert.deepEqual(skillsFor(s, gerard).map(k => k.id), ['zarpazo', 'zarpazos', 'ronroneo', 'llaga']);
  s.foes[0].hp = s.foes[0].maxHp = 999;
  const flurry = act(s, 'skill', 'dog-0', 'zarpazos');
  assert.equal(flurry.strikes.length, 2);
  assert.deepEqual(flurry.status, { id: 'sangrado', stacks: 1 }, 'a wide cut: one stack for the whole flurry');
  assert.match(SKILLS.find(k => k.id === 'zarpazos').description, /Añade sangrado\.$/);
  const plain = createBattle(party, 1, false, undefined, ['papagato']); plain.levels = { papagato: 3 };
  const bled = createBattle(party, 1, false, undefined, ['papagato']); bled.levels = { papagato: 3 };
  addStatus(bled.foes[0], 'sangrado', 5);
  for (const dog of [plain.foes[0], bled.foes[0]]) dog.hp = dog.maxHp = 999;
  const a = act(plain, 'skill', 'dog-0', 'llaga').amount, b = act(bled, 'skill', 'dog-0', 'llaga').amount;
  assert.equal(b, a * 3, 'each stack opens the wound twice as far: +40% each, five of them ×3');
  assert.equal(stacks(bled.foes[0], 'sangrado'), 0, 'and it spends them');
});
test('Sangrado is an open wound: the next physical blow that adds none spends it all, +20% for each stack', async () => {
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
  // Haru's claw on a bleeding foe spends nothing: a cut only adds its own on top, and lands as on a foe with no wound.
  const claw = createBattle(party, 1, false, undefined, ['papagato']), clean = createBattle(party, 1, false, undefined, ['papagato']);
  addStatus(claw.foes[0], 'sangrado', 2);
  const swipe = act(claw, 'skill', 'dog-0', 'zarpazo');
  assert.equal(swipe.bled, undefined);
  assert.equal(swipe.amount, act(clean, 'skill', 'dog-0', 'zarpazo').amount, 'no harder for the wound it leaves alone');
  assert.deepEqual(swipe.status, { id: 'sangrado', stacks: 4 }, 'the old two and its own two');
  assert.doesNotMatch(claw.message, /La herida se abre/);
  // Every claw of a flurry lands harder; a magic blow leaves the wound alone.
  const fire = createBattle([{ id: 'gerard', name: 'Gerard', profile: 'gerard35', classId: 'matemagico' }], 1, false, undefined, ['matemagico']);
  addStatus(fire.foes[0], 'sangrado', 4);
  assert.equal(act(fire, 'skill', 'dog-0', 'foc-binari').bled, undefined);
  assert.equal(stacks(fire.foes[0], 'sangrado'), 4, 'fire does not open it');
  // Nor does a magic blow on every foe (Factor común): each keeps its own.
  const all = createBattle([{ id: 'gerard', name: 'Gerard', profile: 'gerard35', classId: 'matemagico' }], 2, false, undefined, ['matemagico']);
  improve(all, { skills: ['factor-comun'] });
  for (const dog of all.foes) dog.hp = dog.maxHp = 999;
  addStatus(all.foes[1], 'sangrado', 2);
  const both = act(all, 'skill', undefined, 'factor-comun');
  assert.deepEqual(both.hits.map(h => h.bled), [undefined, undefined]);
  assert.deepEqual(all.foes.map(f => stacks(f, 'sangrado')), [0, 2]);
});

// Ángulo exacto, Ronroneo and the dual attacks (docs/animas/README.md § Combined skills).
const DUO = [{ id: 'gerard', name: 'Gerard', profile: 'gerard35', classId: 'matemagico' }, { id: 'aitor', name: 'Aitor', profile: 'aitor', classId: 'papagato' }];
/** Gerard on Matemágico and Aitor on Papagato against `dogs` sturdy dogs: Gerard, first in the party, is the one choosing first. */
/** Matemágico grows by its tree, not by level: "matemagico 2" here is its trunk's first nodes, 3 its cure too. */
const trunk = (levels = {}) => ({ skills: (levels.matemagico ?? 1) >= 3 ? ['angulo', 'analisis', 'cardioide'] : (levels.matemagico ?? 1) >= 2 ? ['angulo', 'analisis'] : [] });
const duoFight = (levels = { papagato: 2, matemagico: 2 }, dogs = 2) => {
  const s = createBattle(DUO, dogs, false, undefined, ['matemagico', 'papagato']);
  s.levels = { ...levels }; s.seed = 35; improve(s, trunk(levels));
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
  s.phase = 'player'; delete s.spent; s.active = s.allies.indexOf(byId(s, 'gerard'));
  assert.deepEqual(validTargets(s, 'skill', 'angulo').map(f => f.id), ['dog-1'], 'not on a foe already marked');
  assert.equal(act(s, 'attack', 'dog-0').amount, plain + 3, 'damage is flat: three points off, three more a hit');
  for (let round = 0; round < BOOST_ROUNDS; round++) endRound(s);
  assert.equal(markRounds(s, s.foes[0], 'angulo'), 0, 'gone after its three rounds');
  assert.equal(s.foes[0].marks.angulo, undefined);
  assert.deepEqual(statShifts(s, s.foes[0]), []);
});

test('Ronroneo is for one ally: a cure at once, Sanación running on them, and their statuses of the mind gone, whichever they are', async () => {
  const { MENTAL_STATUSES, takeTurn } = await import('../src/battle.ts');
  const { healing } = await import('../src/stats.ts');
  assert.deepEqual(MENTAL_STATUSES, ['mareo', 'llorera']);
  assert.ok(!STATUSES.sangrado.mental, 'a wound is not of the mind');
  const purring = SKILLS.find(k => k.id === 'ronroneo');
  assert.equal(purring.name, 'Ronroneo'); assert.equal(purring.side, 'allies');
  const s = duoFight();
  const aitor = byId(s, 'aitor'), gerard = byId(s, 'gerard');
  assert.ok(takeTurn(s, 'aitor'), 'the one wearing Papagato');
  assert.deepEqual(validTargets(s, 'skill', 'ronroneo'), [], 'nothing to do with everyone well');
  assert.equal(act(s, 'skill', 'gerard', 'ronroneo'), undefined);
  addStatus(aitor, 'mareo', 2);
  assert.deepEqual(validTargets(s, 'skill', 'ronroneo').map(a => a.id), ['aitor'], 'a status of the mind is worth calming');
  gerard.hp -= 60; addStatus(gerard, 'llorera', 1); addStatus(gerard, 'sangrado', 3);
  assert.deepEqual(validTargets(s, 'skill', 'ronroneo').map(a => a.id), ['gerard', 'aitor'], 'and so is someone hurt');
  assert.equal(act(s, 'skill', undefined, 'ronroneo'), undefined, 'it needs someone picked');
  const purr = act(s, 'skill', 'gerard', 'ronroneo');
  const each = healing(16, gerard.maxHp);
  assert.equal(each, Math.round(gerard.maxHp * 16 / 60), 'a share of the PV of whoever gets it');
  assert.equal(purr.target, 'gerard'); assert.equal(purr.healed, true); assert.equal(purr.amount, each);
  assert.equal(purr.healedAll, undefined, 'one ally, not the party');
  assert.equal(gerard.hp, gerard.maxHp - 60 + each, 'part of the cure at once');
  assert.deepEqual(purr.regen, { id: 'sanacion', level: 1 });
  assert.equal(gerard.timed.sanacion.left, TIMED.sanacion.seconds, 'and the rest on the clock');
  assert.equal(aitor.timed?.sanacion, undefined);
  assert.deepEqual(purr.cleansed, [{ target: 'gerard', statuses: ['llorera'] }]);
  assert.equal(stacks(gerard, 'llorera'), 0);
  assert.equal(stacks(gerard, 'sangrado'), 3, 'bleeding stays');
  assert.equal(stacks(aitor, 'mareo'), 2, 'only whoever Yuki settles on');
  assert.deepEqual(purr.stats, [{ target: 'gerard', way: 'up', stats: ['fuerza', 'magia'] }]);
  assert.match(s.message, /Se le pasan los efectos de estado mentales\./);
  assert.doesNotMatch(s.message, /mareo|llorera/i, 'never names the statuses it takes away');
  assert.equal(aitor.secondary, MANA_POINTS - 2);
  const pulses = runClock(s, TIMED.sanacion.every);
  assert.ok(pulses.length === 1 && pulses[0].heal && pulses[0].target === 'gerard' && pulses[0].amount > 0, 'Sanación gives PV back as the fight goes on');
});

test('dual descriptions follow the plain shape too, and each dual pairs a skill of each of two ánimas, in either order', async () => {
  const { DUALS, dualOf, dualCost } = await import('../src/battle.ts');
  const intensity = power => power <= 20 ? 'leve' : power <= 34 ? 'medi[oa]' : power <= 49 ? 'alt[oa]' : 'muy alt[oa]';
  assert.deepEqual(DUALS.map(d => d.id), ['zarpazos-de-fuego', 'punto-debil', 'rayo-solar', 'sutura-de-luz', 'relevo-de-sangre', 'bombardeo-orbital', 'reserva-de-color', 'sobrecalentamiento', 'vulcano',
    'marea', 'fulgurita', 'suceso-seguro', 'metralla', 'idea-fija', 'caleidoscopio', 'geiser', 'a-escala', 'seiche', 'staccato', 'cadaver-exquisito', 'trampantojo', 'electrolisis', 'campana-de-gauss', 'corriente-alterna', 'arco-voltaico']);
  for (const d of DUALS) {
    const [a, b] = d.parts.map(id => SKILLS.find(s => s.id === id));
    assert.notEqual(a.class, b.class, `${d.name}: two ánimas`);
    assert.equal(dualOf(a.id, b.id), d); assert.equal(dualOf(b.id, a.id), d);
    assert.deepEqual(dualCost(d), { [a.id]: a.cost, [b.id]: b.cost });
    if (d.abstract) continue;
    if (d.kind === 'heal') { assert.match(d.description, new RegExp(`^Cura ${intensity(d.power)} a un aliado herido\\.`)); continue; }
    // A dual that deals no blow of its own keeps its kind's shape: a boost, a dome or a screen, an eco.
    if (d.kind === 'boost') { assert.match(d.description, /^Sube [^.]+ de todo el equipo durante 3 rondas\.( [A-ZÁÉÍÓÚ][^.]*\.)*$/, d.name); continue; }
    if (d.kind === 'guard') { assert.match(d.description, /^Protege a (todo el equipo durante \d rondas|un aliado[^.]*)\.( [A-ZÁÉÍÓÚ][^.]*\.)*$/, d.name); continue; }
    if (d.kind === 'eco') { assert.match(d.description, /^Deja un eco [^.]+ durante \d+ segundos\.( [A-ZÁÉÍÓÚ][^.]*\.)*$/, d.name); continue; }
    assert.match(d.description, new RegExp(`^Daño ${damageKind(d)} ${intensity(d.power)} ${d.side === 'all-foes' ? 'a todos los enemigos' : 'a un enemigo'}\\.( [A-ZÁÉÍÓÚ][^.]*\\.)*$`), d.name);
  }
  assert.equal(dualOf('foc-binari', 'zarpazo'), undefined);
});

test('Zarpazos de fuego: both turns go into it, each wearer pays their own half, both ánimas take part, eight claws on Aitor\'s Fuerza', async () => {
  const s = duoFight();
  const aitor = byId(s, 'aitor'), gerard = byId(s, 'gerard');
  assert.equal(s.allies[s.active], gerard, 'the first in the party first');
  const claws = actDual(s, 'zarpazos-de-fuego', 'dog-1');
  assert.deepEqual(claws.dual, { id: 'zarpazos-de-fuego', name: 'Zarpazos de fuego', parts: ['foc-binari', 'zarpazos'], actors: ['gerard', 'aitor'], spent: { gerard: 1, aitor: 2 } });
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
  assert.equal(wet.peeled, 7); assert.equal(onion.foes[0].layers, 0);
  assert.deepEqual(wet.coins.slice(0, 6), [0, 0, 0, 0, 0, 0], 'no fire while it has layers');
});

test('Punto débil: a light blow that leaves the next damaging action on that foe three times as hard, every strike of it, once; ticks neither use nor spend it', async () => {
  const { statShifts, weakSpotRounds, takeTurn, WEAK_SPOT } = await import('../src/battle.ts');
  const s = duoFight(), dog = s.foes[0], aitor = byId(s, 'aitor');
  const spot = actDual(s, 'punto-debil', 'dog-0');
  assert.deepEqual(spot.dual.parts, ['angulo', 'zarpazo'], 'Gerard\'s half first: he is the one who goes'); assert.deepEqual(spot.dual.spent, { aitor: 1, gerard: 1 });
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
  takeTurn(s, 'aitor');
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
  assert.equal(queue(s, 'gerard', { action: 'defend' }), false, 'not the one choosing now');
  assert.equal(queue(s, 'aitor', { action: 'skill', skill: 'foc-binari', target: 'dog-0' }), false, 'only what they have on');
  assert.ok(queue(s, 'aitor', { action: 'skill', skill: 'zarpazos', target: 'dog-0' }));
  assert.equal(queuedDual(s, 'angulo'), undefined, 'Ángulo exacto and Zarpazos make nothing');
  assert.equal(queuedDual(s, 'foc-binari').id, 'zarpazos-de-fuego');
  const dual = commit(s, 'skill', 'dog-1', 'foc-binari');
  assert.equal(dual.dual.id, 'zarpazos-de-fuego');
  assert.equal(dual.target, 'dog-1', 'where the one confirming aims it');
  assert.equal(s.queued, undefined, 'nothing left queued');
  assert.equal(s.phase, 'enemy');
  // Not a pair: Gerard's own action, then Aitor's queued one when his turn comes.
  const t = duoFight();
  queue(t, 'aitor', { action: 'skill', skill: 'zarpazos', target: 'dog-0' });
  const own = commit(t, 'attack', 'dog-0');
  assert.equal(own.dual, undefined); assert.equal(own.kind, 'attack');
  assert.equal(t.allies[t.active].id, 'aitor');
  assert.equal(queue(t, 'gerard', { action: 'defend' }), false, 'nobody queues behind the last one: an earlier fighter has had their turn');
  assert.deepEqual(takeQueued(t), { action: 'skill', skill: 'zarpazos', target: 'dog-0' });
  assert.equal(t.queued.aitor, undefined, 'taken');
  assert.equal(act(t, 'skill', 'dog-0', 'zarpazos').skill, 'zarpazos');
  // Queued, then no longer possible: cleared, and they choose again.
  const u = duoFight();
  queue(u, 'aitor', { action: 'attack', target: 'dog-0' });
  u.foes[0].hp = 1; act(u, 'attack', 'dog-0');
  assert.equal(takeQueued(u), undefined, 'its target fell');
  assert.equal(u.queued.aitor, undefined);
  const v = duoFight();
  byId(v, 'aitor').secondary = 0;
  assert.equal(queue(v, 'aitor', { action: 'skill', skill: 'zarpazos', target: 'dog-0' }), false, 'no maná for it');
  // A queue never outlives the round, nor a fight left.
  const w = duoFight();
  queue(w, 'aitor', { action: 'defend' }); act(w, 'escape');
  assert.equal(w.queued, undefined);
  const x = duoFight();
  queue(x, 'aitor', { action: 'skill', skill: 'zarpazos', target: 'dog-0' });
  byId(x, 'aitor').secondary = 0;
  assert.equal(queuedDual(x, 'foc-binari'), undefined, 'a half it can no longer pay: no dual');
  assert.equal(commit(x, 'skill', 'dog-0', 'foc-binari').dual, undefined, 'Gerard\'s Foc Binari on its own');
});

test('each dual goes off once a fight: after it, its two skills are each one\'s own again, and the other dual still can', async () => {
  const { queue, queuedDual, commit, dualOptions } = await import('../src/battle.ts');
  // Matemágico and Papagato's duals (Rayo solar is Tecnópata's).
  const reasons = s => Object.fromEntries(dualOptions(s).filter(o => ['zarpazos-de-fuego', 'punto-debil'].includes(o.dual.id)).map(o => [o.dual.id, o.reason ?? 'ok']));
  const s = duoFight();
  queue(s, 'aitor', { action: 'skill', skill: 'zarpazos', target: 'dog-0' });
  assert.equal(commit(s, 'skill', 'dog-0', 'foc-binari').dual.id, 'zarpazos-de-fuego');
  assert.deepEqual(s.usedDuals, ['zarpazos-de-fuego']);
  endRound(s); s.allies.forEach(a => { a.secondary = MANA_POINTS; });
  assert.deepEqual(reasons(s), { 'zarpazos-de-fuego': 'used', 'punto-debil': 'ok' });
  assert.equal(actDual(s, 'zarpazos-de-fuego', 'dog-0'), undefined, 'not twice');
  queue(s, 'aitor', { action: 'skill', skill: 'zarpazos', target: 'dog-0' });
  assert.equal(queuedDual(s, 'foc-binari'), undefined, 'nothing to show while aiming it');
  const own = commit(s, 'skill', 'dog-0', 'foc-binari');
  assert.equal(own.dual, undefined); assert.equal(own.skill, 'foc-binari', 'Gerard\'s Foc Binari on its own');
  assert.equal(s.queued.aitor.skill, 'zarpazos', 'and Aitor\'s Zarpazos still to come');
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
  // Matemágico and Papagato's duals (Rayo solar is Tecnópata's).
  const reasons = s => Object.fromEntries(dualOptions(s).filter(o => ['zarpazos-de-fuego', 'punto-debil'].includes(o.dual.id)).map(o => [o.dual.id, o.reason ?? 'ok']));
  assert.deepEqual(reasons(duoFight({})), { 'zarpazos-de-fuego': 'level', 'punto-debil': 'level' }, 'none at level 1');
  assert.deepEqual(reasons(duoFight({ papagato: 2 })), { 'zarpazos-de-fuego': 'ok', 'punto-debil': 'level' });
  assert.deepEqual(reasons(duoFight()), { 'zarpazos-de-fuego': 'ok', 'punto-debil': 'ok' });
  const poor = duoFight(); byId(poor, 'aitor').secondary = 1;
  assert.deepEqual(reasons(poor), { 'zarpazos-de-fuego': 'mana', 'punto-debil': 'ok' });
  const down = duoFight(); byId(down, 'aitor').hp = 0;
  assert.deepEqual(reasons(down), { 'zarpazos-de-fuego': 'down', 'punto-debil': 'down' });
  const late = duoFight(); act(late, 'defend');
  assert.deepEqual(reasons(late), { 'zarpazos-de-fuego': 'acted', 'punto-debil': 'acted' }, 'from the later fighter: the earlier one is through');
  const bare = createBattle([{ id: 'gerard', name: 'Gerard', profile: 'gerard35', kit: ['matemagico'] }, { id: 'aitor', name: 'Aitor', profile: 'aitor', classId: 'papagato' }], 1, false, undefined, ['matemagico', 'papagato']);
  bare.levels = { papagato: 2, matemagico: 2 }; improve(bare, trunk(bare.levels));
  bare.allies.sort((a, b) => (a.id === 'gerard' ? -1 : 1) - (b.id === 'gerard' ? -1 : 1)); bare.active = 0;
  assert.equal(dualOptions(bare)[0].reason, 'wear');
  const swap = dualOptions(bare, true)[0];
  assert.equal(swap.ok, true); assert.equal(swap.wear, 'matemagico');
  assert.equal(bare.allies[0].classId, undefined, 'only looked at: nothing put on');
});

test('Sin límites (development): cures on anyone standing, boosts and marks again while they run, every dual as often as wanted', async () => {
  const { dualOptions } = await import('../src/battle.ts');
  const reasons = s => Object.fromEntries(dualOptions(s).map(o => [o.dual.id, o.reason ?? 'ok']));
  const s = duoFight();
  s.boosts = { analisis: { amount: 3, until: s.round + 2 } };
  assert.equal(validTargets(s, 'skill', 'analisis').length, 0, 'a boost running has nothing to add');
  assert.equal(validTargets(s, 'skill', 'ronroneo').length, 0, 'nobody hurt: the cure has no one');
  actDual(s, 'zarpazos-de-fuego', 'dog-0'); endRound(s);
  assert.equal(reasons(s)['zarpazos-de-fuego'], 'used');
  s.unbound = true;
  s.allies.forEach(a => { a.secondary = MANA_POINTS; });
  assert.deepEqual(validTargets(s, 'skill', 'analisis').map(a => a.id), s.allies.filter(a => a.hp > 0).map(a => a.id), 'the boost again');
  assert.equal(validTargets(s, 'skill', 'ronroneo').length, s.allies.filter(a => a.hp > 0).length, 'the cure on anyone standing');
  assert.equal(reasons(s)['zarpazos-de-fuego'], 'ok', 'the dual again');
  assert.equal(actDual(s, 'zarpazos-de-fuego', 'dog-0').dual.id, 'zarpazos-de-fuego');
});

// Sangrado that piles up and the golpe crítico (docs/animas/README.md § Sangrado, § Golpe crítico).
/** The same fighter goes again, maná full: for a test that plays several of one fighter's turns in a row. */
const again = (s, id) => { s.phase = 'player'; delete s.spent; s.active = s.allies.indexOf(byId(s, id)); byId(s, id).secondary = byId(s, id).maxSecondary; };

test('cuts pile up: a blow that adds Sangrado spends none of it, and the next one that adds none spends it all', () => {
  const s = duoFight(), dog = s.foes[0], plain = duoFight();
  again(s, 'aitor');
  const first = act(s, 'skill', 'dog-0', 'zarpazo');
  again(s, 'aitor');
  const second = act(s, 'skill', 'dog-0', 'zarpazo');
  assert.equal(first.bled, undefined); assert.equal(second.bled, undefined);
  assert.equal(second.amount, first.amount, 'the second cut lands no harder for the first');
  assert.deepEqual(second.status, { id: 'sangrado', stacks: 4 });
  assert.equal(stacks(dog, 'sangrado'), 4, 'two and two');
  again(s, 'aitor'); again(plain, 'aitor');
  const open = act(s, 'attack', 'dog-0');
  assert.equal(open.bled, 4);
  assert.equal(open.amount, Math.round(act(plain, 'attack', 'dog-0').amount * 1.8), 'Atacar opens the four of them: +80 %');
  assert.match(s.message, /La herida se abre: \+80 %/);
  assert.equal(stacks(dog, 'sangrado'), 0, 'spent all at once');
  // Zarpazos is a cut too: one more on top.
  addStatus(dog, 'sangrado', 3); again(s, 'aitor');
  const flurry = act(s, 'skill', 'dog-0', 'zarpazos');
  assert.equal(flurry.bled, undefined); assert.deepEqual(flurry.status, { id: 'sangrado', stacks: 4 });
});

test('Sangrado fades slowly: a wound cut this round keeps every stack at its end; left alone, it loses one a round', () => {
  const s = duoFight(), dog = s.foes[0], tick = STATUSES.sangrado.tick;
  again(s, 'aitor');
  act(s, 'skill', 'dog-0', 'zarpazo');
  assert.equal(dog.cutRound, s.round);
  assert.deepEqual(endRound(s), [{ target: 'dog-0', status: 'sangrado', amount: 2 * tick, stacks: 2 }], 'it bleeds 2 PV a stack all the same');
  assert.equal(stacks(dog, 'sangrado'), 2, 'cut this round: nothing closes');
  assert.deepEqual(endRound(s), [{ target: 'dog-0', status: 'sangrado', amount: 2 * tick, stacks: 1 }]);
  assert.equal(stacks(dog, 'sangrado'), 1, 'a round with no cut: one stack less');
  // Cut again, it holds; then it goes on closing.
  again(s, 'aitor');
  act(s, 'skill', 'dog-0', 'zarpazo');
  endRound(s); assert.equal(stacks(dog, 'sangrado'), 3);
  endRound(s); assert.equal(stacks(dog, 'sangrado'), 2);
  // A wound that was not cut by a blow (no `cutRound`) fades from its first round.
  const other = duoFight();
  addStatus(other.foes[1], 'sangrado', 3);
  endRound(other); assert.equal(stacks(other.foes[1], 'sangrado'), 2);
});

test('the golpe crítico: by the Crítico of whoever lands it, half as hard again, and added to the wound\'s bonus, not multiplied', async () => {
  const { CRIT_RULES, critChance, woundScale } = await import('../src/battle.ts');
  assert.equal(CRIT_RULES.chance, 0, 'by chance, off in the tests (tests/setup.mjs)');
  assert.equal(CRIT_RULES.bonus, .5);
  const base = duoFight();
  assert.equal(byId(base, 'gerard').stats.critico, 5); assert.equal(byId(base, 'aitor').stats.critico, 15, 'Papagato finds the soft spot');
  assert.equal(critChance(base, byId(base, 'aitor'), base.foes[0]), 15);
  assert.equal(base.foes[0].stats.critico, 0); assert.equal(critChance(base, base.foes[0], byId(base, 'gerard')), 0, 'foes have none');
  /** Gerard's Atacar on the first dog, with `critico` Crítico and `bleeding` stacks on it. */
  const blow = (critico, bleeding = 0) => {
    const s = duoFight(), gerard = byId(s, 'gerard');
    gerard.stats = { ...gerard.stats, critico };
    if (bleeding) addStatus(s.foes[0], 'sangrado', bleeding);
    return [act(s, 'attack', 'dog-0'), s];
  };
  CRIT_RULES.chance = 1;
  try {
    const [plain] = blow(0), [crit, fight] = blow(100);
    assert.equal(plain.crit, undefined);
    assert.equal(crit.crit, true); assert.equal(crit.crits, undefined, 'one blow: no list of strikes');
    assert.equal(crit.amount, Math.round(plain.amount * 1.5), '50 % harder');
    assert.match(fight.message, /¡Golpe crítico!/);
    const [both] = blow(100, 3);
    assert.equal(both.bled, 3); assert.equal(both.crit, true);
    assert.equal(both.amount, Math.round(plain.amount * (woundScale(3) + CRIT_RULES.bonus)), 'three stacks and a crítico: ×(1 + .6 + .5)');
    assert.notEqual(both.amount, Math.round(plain.amount * woundScale(3) * 1.5), 'never one times the other');
    // Each claw of a flurry rolls its own.
    const s = duoFight(), aitor = byId(s, 'aitor'), tame = duoFight();
    again(s, 'aitor'); again(tame, 'aitor');
    aitor.stats = { ...aitor.stats, critico: 100 }; byId(tame, 'aitor').stats = { ...aitor.stats, critico: 0 };
    const claws = act(s, 'skill', 'dog-0', 'zarpazos');
    assert.deepEqual(claws.crits, [true, true]);
    assert.deepEqual(claws.strikes, act(tame, 'skill', 'dog-0', 'zarpazos').strikes.map(n => Math.round(n * 1.5)));
  } finally { CRIT_RULES.chance = 0; }
  assert.equal(blow(100)[0].crit, undefined, 'off again');
});

test('Olor a sangre (Papagato at 5): 20 more Crítico on a foe that bleeds, and spending a wound of five or more is always a golpe crítico, for the whole party', async () => {
  const { SCENT, PASSIVES, CRIT_RULES, scentOf, critChance, woundScale } = await import('../src/battle.ts');
  assert.deepEqual(SCENT, { level: 5, crit: 20, sure: 5 });
  assert.equal(PASSIVES['olor-a-sangre'].anima, 'papagato'); assert.equal(PASSIVES['olor-a-sangre'].level, SCENT.level);
  /** Papagato at `level`, the first dog with `bleeding` stacks, `who` to go. */
  const fight = (level, bleeding, who = 'gerard') => {
    const s = duoFight({ papagato: level, matemagico: 2 });
    if (bleeding) addStatus(s.foes[0], 'sangrado', bleeding);
    again(s, who);
    return s;
  };
  const named = [{ id: 'olor-a-sangre', name: 'Olor a sangre', who: 'aitor' }];
  const s = fight(5, 5), gerard = byId(s, 'gerard'), aitor = byId(s, 'aitor'), [bleeding, clean] = s.foes;
  assert.equal(scentOf(s), aitor, 'whoever wears Papagato, standing');
  assert.equal(critChance(s, gerard, clean), 5); assert.equal(critChance(s, gerard, bleeding), 5 + SCENT.crit, 'the partner smells it too');
  assert.equal(critChance(s, aitor, clean), 15); assert.equal(critChance(s, aitor, bleeding), 15 + SCENT.crit);
  assert.equal(critChance(s, bleeding, gerard), 0);
  // The partner who does not wear Papagato spends the wound: a crítico for sure, and it is added to the wound.
  const plain = act(fight(5, 0), 'attack', 'dog-0');
  assert.equal(plain.crit, undefined); assert.equal(plain.passives, undefined);
  const open = act(s, 'attack', 'dog-0');
  assert.equal(open.actor, 'gerard'); assert.equal(open.bled, 5); assert.equal(open.crit, true);
  assert.deepEqual(open.passives, named, 'shown over whoever wears it');
  assert.equal(open.amount, Math.round(plain.amount * (woundScale(5) + CRIT_RULES.bonus)));
  // And so does the wearer: Zarpa en la llaga on more than five.
  const deep = fight(5, 6, 'aitor'), bare = fight(5, 0, 'aitor');
  const llaga = act(deep, 'skill', 'dog-0', 'llaga');
  assert.equal(llaga.crit, true); assert.deepEqual(llaga.passives, named);
  assert.equal(llaga.amount, Math.round(act(bare, 'skill', 'dog-0', 'llaga').amount * (woundScale(6, 'llaga') + CRIT_RULES.bonus)));
  // A cut spends nothing, so it is no sure crítico however deep the wound.
  const cut = act(fight(5, 6, 'aitor'), 'skill', 'dog-0', 'zarpazo');
  assert.equal(cut.crit, undefined); assert.equal(cut.passives, undefined);
  // Four stacks are not enough: only the chance is left, and the tests have it off.
  const four = act(fight(5, 4), 'attack', 'dog-0');
  assert.equal(four.bled, 4); assert.equal(four.crit, undefined); assert.equal(four.passives, undefined);
  assert.equal(four.amount, Math.round(plain.amount * woundScale(4)));
  // Nor a Papagato not grown enough, nor one whose wearer has fallen.
  const young = fight(3, 5);
  assert.equal(scentOf(young), undefined); assert.equal(critChance(young, byId(young, 'gerard'), young.foes[0]), 5);
  const early = act(young, 'attack', 'dog-0');
  assert.equal(early.bled, 5); assert.equal(early.crit, undefined); assert.equal(early.passives, undefined);
  const alone = fight(5, 5); byId(alone, 'aitor').hp = 0;
  assert.equal(scentOf(alone), undefined);
  assert.equal(act(alone, 'attack', 'dog-0').crit, undefined);
});

// Tecnópata's skills (docs/animas/tecnopata/): Bip's.
const TECH = [{ id: 'gerard', name: 'Gerard', profile: 'gerard35', classId: 'matemagico' }, { id: 'aitor', name: 'Aitor', profile: 'aitor', classId: 'tecnopata' }];
/** Gerard on Matemágico and Aitor on Tecnópata against `dogs` sturdy dogs. */
const techFight = (dogs = 2) => {
  const s = createBattle(TECH, dogs, false, undefined, ['matemagico']);
  s.seed = 35; improve(s, { skills: ['explosion', 'confusion', 'rayo-encogedor'] });
  s.foes.forEach(f => { f.hp = f.maxHp = 9999; });
  return s;
};
const turnOf = (s, id) => { s.phase = 'player'; s.active = s.allies.indexOf(byId(s, id)); delete s.spent; delete s.queued; byId(s, id).secondary = byId(s, id).maxSecondary; };

test('Rayo de energía hits with magic and starts what runs out by the clock on the foe over from its whole time, never a cure', () => {
  const s = techFight();
  assert.deepEqual(skillsFor(s, byId(s, 'aitor')).map(x => x.id), ['rayo-energia', 'bomba-remota', 'rayo-sanacion', 'explosion', 'confusion', 'rayo-encogedor'], 'the two rays and the bomb, and the nodes bought');
  assert.deepEqual(skillsFor(createBattle(TECH, 1, false, undefined, ['matemagico']), byId(s, 'aitor')).map(x => x.id), ['rayo-energia', 'bomba-remota', 'rayo-sanacion'], 'only the two rays and the bomb from the start');
  s.foes[0].timed = { quemado: { level: 2, left: 3, next: 1 }, cegado: { level: 1, left: 6, next: 6 } };
  turnOf(s, 'aitor');
  const ray = act(s, 'skill', 'dog-0', 'rayo-energia');
  assert.ok(ray.amount > 0);
  assert.deepEqual(ray.restarted, [{ target: 'dog-0', statuses: ['quemado', 'cegado'] }]);
  assert.equal(s.foes[0].timed.quemado.left, TIMED.quemado.seconds); assert.equal(s.foes[0].timed.quemado.level, 2, 'the same fire, from the start');
  assert.equal(s.foes[0].timed.cegado.left, TIMED.cegado.seconds);
  turnOf(s, 'aitor');
  assert.equal(act(s, 'skill', 'dog-1', 'rayo-energia').restarted, undefined, 'nothing to start over, only the blow');
});

test('Rayo de sanación cures an ally at once and leaves a cure that gives PV back on the clock for 15 seconds, a level up if cast again', async () => {
  const { healing } = await import('../src/stats.ts');
  const s = techFight();
  const gerard = byId(s, 'gerard');
  gerard.hp = 1;
  turnOf(s, 'aitor');
  const cure = act(s, 'skill', 'gerard', 'rayo-sanacion');
  assert.deepEqual(cure.regen, { id: 'sanacion', level: 1 });
  const once = healing(SKILLS.find(k => k.id === 'rayo-sanacion').power, gerard.maxHp);
  assert.equal(cure.amount, once, 'part of it at once');
  assert.equal(gerard.hp, 1 + once);
  assert.equal(gerard.timed.sanacion.left, 15);
  const pulses = runClock(s, 15);
  assert.equal(pulses.length, 5, 'one every 3 seconds');
  assert.ok(pulses.every(p => p.heal && p.target === 'gerard' && p.amount > 0));
  const each = Math.round(gerard.maxHp * TIMED.sanacion.share);
  assert.equal(pulses.reduce((sum, p) => sum + p.amount, 0), 5 * each, 'a quarter of their PV over its 15 seconds, at level I');
  assert.equal(gerard.hp, 1 + once + 5 * each); assert.equal(gerard.timed.sanacion, undefined, 'gone when its time is up');
  turnOf(s, 'aitor'); act(s, 'skill', 'gerard', 'rayo-sanacion');
  turnOf(s, 'aitor'); assert.equal(act(s, 'skill', 'gerard', 'rayo-sanacion').regen.level, 2);
});

test('Explosión burns every foe, blinds them until the round ends, and Aitor sits the next round out while Bip comes back', () => {
  const s = techFight();
  turnOf(s, 'aitor');
  const boom = act(s, 'skill', undefined, 'explosion');
  assert.equal(boom.hits.length, 2); assert.ok(boom.hits.every(h => h.amount > 0));
  assert.equal(boom.exploded, true); assert.deepEqual(boom.blinded, ['dog-0', 'dog-1']);
  assert.ok(s.foes.every(f => f.timed.cegado.level === 1 && f.timed.cegado.until === s.round));
  assert.match(s.message, /Aitor pierde su siguiente turno/);
  const round = s.round;
  endRound(s);
  assert.equal(s.round, round + 1);
  assert.ok(s.foes.every(f => !f.timed?.cegado), 'the blinding lasted the round');
  assert.deepEqual(s.spent, ['aitor'], 'Aitor sits this round out');
  assert.equal(s.allies[s.active].id, 'gerard');
  assert.match(s.message, /Aitor no actúa esta ronda/);
  act(s, 'attack', 'dog-0');
  assert.equal(s.phase, 'enemy', 'after Gerard the foes go');
  endRound(s);
  assert.equal(s.spent, undefined, 'back the round after');
  assert.equal(byId(s, 'aitor').out, undefined);
});

test('a confused foe hits one of its own for 30 seconds (itself if alone); Rayo de energía makes it last longer', () => {
  const s = techFight();
  turnOf(s, 'aitor');
  const mind = act(s, 'skill', 'dog-0', 'confusion');
  assert.deepEqual(mind.afflicted, { id: 'confusion', level: 1 }); assert.equal(s.foes[0].timed.confusion.left, 30);
  s.phase = 'enemy'; s.enemyActions = [];
  const before = s.foes[1].hp, party = s.allies.map(a => a.hp);
  const blow = enemyAct(s, 'dog-0');
  assert.equal(blow.confused, true); assert.equal(blow.target, 'dog-1');
  assert.equal(s.foes[1].hp, before - blow.amount); assert.deepEqual(s.allies.map(a => a.hp), party, 'nobody in the party hurt');
  runClock(s, 30);
  assert.equal(s.foes[0].timed?.confusion, undefined, 'over after 30 seconds');
  const alone = techFight(1);
  turnOf(alone, 'aitor'); act(alone, 'skill', 'dog-0', 'confusion');
  alone.phase = 'enemy'; alone.enemyActions = [];
  assert.equal(enemyAct(alone, 'dog-0').target, 'dog-0', 'alone, it hits itself');
});

test('Rayo solar: Rayo de energía and Foc Binari charge Bip this round, and it sweeps every foe with Quemado II as the next one starts', async () => {
  const { commit, queue, takeNews } = await import('../src/battle.ts');
  const s = techFight(3);
  const first = s.allies[0], later = s.allies[1];
  turnOf(s, first.id);
  const skillOf = c => c.classId === 'tecnopata' ? 'rayo-energia' : 'foc-binari';
  assert.ok(queue(s, later.id, { action: 'skill', skill: skillOf(later), target: 'dog-0' }));
  const charge = commit(s, 'skill', 'dog-0', skillOf(first));
  assert.equal(charge.dual.id, 'rayo-solar');
  assert.equal(charge.charging, 'aitor', 'Bip holds it'); assert.equal(charge.amount, undefined, 'nothing lands yet');
  assert.ok(s.foes.every(f => f.hp === f.maxHp));
  assert.deepEqual(byId(s, 'aitor').charge, { dual: 'rayo-solar', striker: byId(s, s.allies[0].id).classId === 'tecnopata' ? 'aitor' : first.id === 'aitor' ? 'aitor' : 'gerard' });
  assert.equal(s.phase, 'enemy', 'both turns went into it');
  endRound(s);
  assert.equal(s.phase, 'player', 'the round starts as usual');
  const [sweep] = takeNews(s);
  assert.deepEqual(sweep.release, { id: 'rayo-solar', name: 'Rayo solar' });
  assert.equal(sweep.hits.length, 3); assert.ok(sweep.hits.every(h => h.amount > 0 && h.burn.level === 2));
  assert.ok(s.foes.every(f => f.timed.quemado.level === 2));
  assert.equal(byId(s, 'aitor').charge, undefined, 'spent');
  assert.match(s.message, /¡Rayo solar!/);
  // Bip's holder down before it goes off: it is lost.
  const t = techFight(2);
  turnOf(t, t.allies[0].id);
  queue(t, t.allies[1].id, { action: 'skill', skill: skillOf(t.allies[1]), target: 'dog-0' });
  commit(t, 'skill', 'dog-0', skillOf(t.allies[0]));
  byId(t, 'aitor').hp = 0;
  endRound(t);
  assert.equal(takeNews(t).length, 0); assert.ok(t.foes.every(f => f.hp === f.maxHp));
});

test('Rayo encogedor shrinks a foe for 15 seconds: a quarter of its Defensa gone while it lasts, and Rayo de energía makes it last longer', async () => {
  const { statShifts } = await import('../src/battle.ts');
  const s = techFight();
  turnOf(s, 'aitor');
  const plain = act(structuredClone(s), 'attack', 'dog-0').amount;
  const shrink = act(s, 'skill', 'dog-0', 'rayo-encogedor');
  assert.deepEqual(shrink.stats, [{ target: 'dog-0', way: 'down', stats: ['defensa'] }]);
  assert.equal(s.foes[0].timed.encogido.left, 15);
  const quarter = Math.max(1, Math.round(s.foes[0].stats.defensa * .25));
  assert.deepEqual(statShifts(s, s.foes[0]).map(x => [x.stat, x.way, x.amount]), [['defensa', 'down', quarter]]);
  assert.match(s.message, /Defensa −25 % durante 15 s/);
  turnOf(s, 'aitor');
  const ram = act(structuredClone(s), 'attack', 'dog-0').amount;
  assert.equal(ram, plain + quarter, 'Bip\'s ram (physical) lands as much harder as the Defensa it lost');
  const ray = act(s, 'skill', 'dog-0', 'rayo-energia');
  assert.deepEqual(ray.restarted[0].statuses, ['encogido']); assert.equal(s.foes[0].timed.encogido.left, TIMED.encogido.seconds);
  runClock(s, TIMED.encogido.seconds);
  assert.equal(s.foes[0].timed?.encogido, undefined);
  assert.deepEqual(statShifts(s, s.foes[0]), []);
});

function pairBattle(gerard, aitor) {
  const party = DUO.map((slot, i) => ({ ...slot, classId: i ? aitor : gerard }));
  const s = createBattle(party, 3, false, undefined, [gerard, aitor]);
  s.levels = { papagato: 3, dadaista: 3 };
  improve(s, { skills: ['cardioide', 'explosion'] });
  s.foes.forEach(f => { f.hp = f.maxHp = 200; });
  return s;
}

test('Sutura de luz discovers on the chosen ally, cushions one hit and expires with the round', async () => {
  const { queue, commit, dualTargets, DUALS } = await import('../src/battle.ts');
  const s = pairBattle('matemagico', 'tecnopata'), ally = byId(s, 'aitor');
  assert.deepEqual(dualTargets(s, DUALS.find(d => d.id === 'sutura-de-luz')), []);
  ally.hp = 9;
  const [first, second] = s.allies;
  const part = a => a.classId === 'tecnopata' ? 'rayo-sanacion' : 'cardioide';
  assert.ok(queue(s, second.id, { action: 'skill', skill: part(second), target: ally.id }));
  const cure = commit(s, 'skill', ally.id, part(first));
  assert.equal(cure.dual.id, 'sutura-de-luz');
  assert.equal(cure.target, ally.id);
  assert.equal(ally.hp, 9 + cure.amount);
  const plain = structuredClone(s);
  delete byId(plain, ally.id).suture;
  assert.equal(enemyAct(s, 'dog-0', ally.id).amount, Math.ceil(enemyAct(plain, 'dog-0', ally.id).amount / 2));
  assert.equal(ally.suture, undefined);
  assert.equal(enemyAct(s, 'dog-1', ally.id).amount, enemyAct(plain, 'dog-1', ally.id).amount);
  byId(s, 'gerard').suture = true;
  enemyAct(s, 'dog-2', ally.id); nextRound(s);
  assert.equal(byId(s, 'gerard').suture, undefined);
});

test('Relevo de sangre relays only a killing wound and spends the chosen die', () => {
  const s = pairBattle('papagato', 'dadaista'), roller = byId(s, 'aitor');
  roller.dice = ['ojo', 'tijeras', 'mano'];
  s.foes[0].hp = 1; s.foes[1].hp = 90; addStatus(s.foes[0], 'sangrado', 3);
  const survives = structuredClone(s); survives.foes[0].hp = 200;
  assert.equal(actDual(survives, 'relevo-de-sangre', 'dog-0', 1).relay, undefined);
  const blow = actDual(s, 'relevo-de-sangre', 'dog-0', 1);
  assert.deepEqual(roller.dice, ['ojo', 'mano']);
  assert.equal(roller.racha, 1);
  assert.equal(s.foes[0].hp, 0);
  assert.deepEqual(blow.relay, { target: 'dog-2', stacks: 3 });
  assert.equal(stacks(s.foes[2], 'sangrado'), 3);
});

test('Bombardeo orbital waits for the round and the holder, strips three layers and leaves Cegado for longer', () => {
  const s = pairBattle('sincopante', 'tecnopata');
  s.foes[1].layers = 5;
  const charge = actDual(s, 'bombardeo-orbital');
  assert.equal(charge.charging, 'aitor');
  assert.ok(s.foes.every(f => f.hp === 200));
  const interrupted = structuredClone(s); byId(interrupted, 'aitor').hp = 0;
  endRound(interrupted);
  assert.ok(!interrupted.news?.some(e => e.detonation));
  endRound(s);
  assert.equal(s.foes[1].layers, 2);
  assert.equal(s.news.find(e => e.detonation).hits.length, 3);
  assert.ok(s.foes.every(f => f.hp < 200 && f.timed.cegado.level === 1 && f.timed.cegado.left === ORBITAL_BLIND));
});

test('Reserva de color detonates exactly once after the marked turn or an early knockout', () => {
  const s = pairBattle('matemagico', 'prismatico');
  actDual(s, 'reserva-de-color', 'dog-1');
  const early = structuredClone(s);
  enemyAct(s, 'dog-0');
  assert.ok(s.foes.every(f => f.hp === 200));
  enemyAct(s, 'dog-1');
  assert.equal(s.news.filter(e => e.detonation).length, 1);
  assert.ok(s.foes.every(f => f.hp < 200));
  assert.equal(s.foes[1].fuse, undefined);
  early.foes[1].hp = 1;
  early.foes[1].timed.quemado = { level: 1, next: 1, left: 5 };
  runClock(early, 1);
  assert.equal(early.foes[1].hp, 0);
  assert.equal(early.news.filter(e => e.detonation).length, 1);
  assert.equal(early.news[0].hits.length, 2);
});

test('each new pair combines from the two individual skill choices in either turn order', async () => {
  const { DUALS, aimed, commit, queue, takeTurn } = await import('../src/battle.ts');
  for (const [id, g, a] of [
    ['sutura-de-luz', 'matemagico', 'tecnopata'],
    ['relevo-de-sangre', 'papagato', 'dadaista'],
    ['bombardeo-orbital', 'sincopante', 'tecnopata'],
    ['reserva-de-color', 'matemagico', 'prismatico'],
  ]) {
    for (const who of ['gerard', 'aitor']) {
      const s = pairBattle(g, a);
      const target = id === 'sutura-de-luz' ? 'aitor' : 'dog-1';
      byId(s, 'aitor').hp -= 8;
      assert.ok(takeTurn(s, who));
      const first = s.allies[s.active], other = s.allies.find(c => c !== first);
      const parts = DUALS.find(d => d.id === id).parts.map(part => SKILLS.find(skill => skill.id === part));
      const skillOf = c => parts.find(skill => skill.class === c.classId).id;
      const waiting = skillOf(other), active = skillOf(first);
      assert.ok(queue(s, other.id, { action: 'skill', skill: waiting, target: aimed(waiting) ? target : undefined }));
      const combined = commit(s, 'skill', aimed(active) ? target : undefined, active);
      assert.equal(combined.dual.id, id);
      if (!combined.charging) assert.equal(combined.target, target);
      assert.deepEqual(s.usedDuals, [id]);
    }
  }
});

// Bomba remota, Escolta and Enjambre (docs/animas/tecnopata/README.md § The design, Aitor 2026-11-21).
test('Bomba remota: a bomb on a foe goes off when its clock is up, harder the longer it has been on', async () => {
  const { BOMBA, bombPower } = await import('../src/battle.ts');
  const s = techFight(), dog = s.foes[0];
  turnOf(s, 'aitor');
  const e = act(s, 'skill', 'dog-0', 'bomba-remota');
  assert.deepEqual(e.planted, ['dog-0']); assert.equal(e.amount, undefined, 'no blow now');
  assert.equal(dog.timed.bomba.left, BOMBA.seconds); assert.equal(dog.hp, dog.maxHp);
  const pulses = runClock(s, BOMBA.seconds - 1);
  assert.equal(pulses.length, 0, 'it waits'); assert.equal(dog.hp, dog.maxHp);
  const [blast] = runClock(s, 1.5);
  assert.equal(blast.status, 'bomba'); assert.ok(blast.blast); assert.ok(blast.amount > 0);
  assert.equal(dog.maxHp - dog.hp, blast.amount); assert.equal(dog.timed.bomba, undefined, 'gone once it blows');
  // Started over, it grows: Rayo de energía gives it its 12 s again, and it goes off later and harder.
  const late = techFight();
  turnOf(late, 'aitor'); act(late, 'skill', 'dog-0', 'bomba-remota');
  runClock(late, 6); turnOf(late, 'aitor');
  const ray = act(late, 'skill', 'dog-0', 'rayo-energia');
  assert.ok(ray.restarted[0].statuses.includes('bomba')); assert.equal(late.foes[0].timed.bomba.left, BOMBA.seconds);
  const before = late.foes[0].hp;
  assert.equal(runClock(late, BOMBA.seconds - 1).length, 0, 'still on: its whole fuse again');
  const [big] = runClock(late, 1.5);
  assert.ok(big.amount > blast.amount, `${big.amount} > ${blast.amount}`);
  assert.equal(before - late.foes[0].hp, big.amount);
  assert.ok(bombPower(0) < bombPower(12) && bombPower(1000) === BOMBA.top, 'it grows with time, up to its top');
});

test('Bomba remota again on its foe starts its clock over and keeps what it grew; Reinicio does the same on everyone', () => {
  const s = techFight();
  improve(s, { skills: ['explosion', 'confusion', 'reinicio'] });
  turnOf(s, 'aitor'); act(s, 'skill', 'dog-0', 'bomba-remota');
  runClock(s, 10);
  turnOf(s, 'aitor'); const again = act(s, 'skill', 'dog-0', 'bomba-remota');
  assert.match(s.message, /vuelve a contar/); assert.deepEqual(again.planted, ['dog-0']);
  assert.equal(s.foes[0].timed.bomba.left, 12); assert.ok(s.foes[0].timed.bomba.age >= 10);
  runClock(s, 10);
  turnOf(s, 'aitor'); act(s, 'skill', 'dog-0', 'reinicio');
  assert.equal(s.foes[0].timed.bomba.left, 12); assert.ok(s.foes[0].timed.bomba.age >= 20, 'grown for 20 s and counting');
});

test('Explosión sets off every bomb it finds now, as grown as it is', () => {
  const s = techFight();
  turnOf(s, 'aitor'); act(s, 'skill', 'dog-0', 'bomba-remota');
  turnOf(s, 'aitor'); act(s, 'skill', 'dog-1', 'bomba-remota');
  runClock(s, 4);
  turnOf(s, 'aitor');
  const e = act(s, 'skill', 'dog-0', 'explosion');
  assert.deepEqual(e.detonated.map(d => d.target), ['dog-0', 'dog-1']); assert.ok(e.detonated.every(d => d.amount > 0));
  assert.ok(s.foes.every(f => !f.timed?.bomba)); assert.match(s.message, /Estallan las bombas/);
});

test('Escolta: Bip stands by an ally for 2 rounds; a foe that strikes them gets a bomb, and it ends if Aitor takes Tecnópata off', () => {
  const s = techFight(1);
  improve(s, { skills: ['escolta'] });
  s.foes[0].hp = s.foes[0].maxHp = 9999;
  turnOf(s, 'aitor');
  const e = act(s, 'skill', 'gerard', 'escolta');
  assert.equal(e.escorted, 2); assert.ok(byId(s, 'gerard').guarding); assert.match(s.message, /durante 2 rondas/);
  // The dog goes for Gerard: he takes a third, and the dog leaves with a bomb.
  s.phase = 'enemy'; s.enemyActions = [];
  const g = byId(s, 'gerard'), hp = g.hp;
  const hit = enemyAct(s, 'dog-0', 'gerard');
  if (g.hp < hp) { assert.deepEqual(hit.planted, ['dog-0']); assert.ok(s.foes[0].timed.bomba); }
  nextRound(s);
  assert.ok(g.guarding, 'still guarded in its second round'); assert.ok(g.escort);
  endRound(s);
  assert.ok(!g.guarding && !g.escort, 'Bip goes back after its second round');
  // Taken off, Bip goes back into Aitor at once.
  turnOf(s, 'aitor'); act(s, 'skill', 'gerard', 'escolta');
  byId(s, 'aitor').classId = undefined;
  endRound(s);
  assert.ok(!g.escort && !g.guarding);
});

test('Enjambre wakes when a bomb goes off at its top while Tecnópata is worn, and puts a bomb at its top on every foe', async () => {
  const { BOMBA, swarmReady, ultiReady } = await import('../src/battle.ts');
  const s = techFight();
  improve(s, { skills: ['explosion', 'confusion', 'enjambre'] });
  assert.equal(swarmReady(s), false);
  turnOf(s, 'aitor'); act(s, 'skill', 'dog-0', 'bomba-remota');
  s.foes[0].timed.bomba.age = 40;
  const [blast] = runClock(s, BOMBA.seconds + .5);
  assert.equal(blast.awoken, 'enjambre'); assert.ok(swarmReady(s)); assert.ok(ultiReady(s, 'enjambre'));
  turnOf(s, 'aitor');
  const e = act(s, 'skill', 'dog-0', 'enjambre');
  assert.deepEqual(e.planted, ['dog-0', 'dog-1']);
  assert.ok(s.foes.every(f => f.timed.bomba && f.timed.bomba.age * BOMBA.perSecond + BOMBA.base >= BOMBA.top - 1e-9));
  assert.equal(swarmReady(s), false, 'once a fight');
});
