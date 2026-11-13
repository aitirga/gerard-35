import test from 'node:test';
import assert from 'node:assert/strict';
import { CUERDAS_ENCOUNTERS, CUERDAS_FIGHTS, FEAR_ENCOUNTERS, MARTA, SOBREMESA, STAGED_MOMENTS, VOZ_TURNS, act, cornered, createFearBattle, enemyAct, intentLabel, nextRound, phraseFor, resonancia, runClock, silenced, songLabel, songNow, stageMoment, takeSongNews } from '../src/battle.ts';
import { PHRASES, phraseLength } from '../src/song.ts';
import { FOE_XP } from '../src/levels.ts';

const party = [{ id: 'gerard', name: 'Gerard', profile: 'gerard35', classId: 'matemagico' }, { id: 'aitor', name: 'Aitor', profile: 'aitor', classId: 'papagato' }];
const fight = (encounter, random = () => 0) => {
  const s = createFearBattle(party, encounter, undefined, random);
  s.allies.forEach(a => { a.hp = a.maxHp = 9999; });
  s.foes.forEach(f => { f.hp = f.maxHp = 9999; });
  return s;
};
const turn = (s, id, target) => { s.phase = 'enemy'; s.enemyActions = []; return enemyAct(s, id, target); };
const round = s => { s.phase = 'enemy'; s.enemyActions = s.foes.map(f => f.id); return nextRound(s); };
const as = (s, who) => { s.phase = 'player'; s.active = s.allies.findIndex(a => a.id === who); };
/** Moves the song to `t` seconds into its phrase, with no Eco on the way. */
const sing = (s, t) => { s.song.t = t; };
const ally = (s, id) => s.allies.find(a => a.id === id);
/** Whoever the fight's dice (`random` 0) pick first: the first to stand in line. */
const firstOf = s => s.allies[0];

test('Las cuerdas\' fights are fears\' fights, each with the foes it says, and only La Voz cannot be run from', () => {
  for (const encounter of CUERDAS_ENCOUNTERS) {
    assert.ok(FEAR_ENCOUNTERS.includes(encounter));
    const s = createFearBattle(party, encounter);
    assert.deepEqual(s.foes.map(f => f.kind), [...CUERDAS_FIGHTS[encounter]], encounter);
    assert.equal(cornered(s), encounter === 'voz', encounter);
    assert.equal(!!s.song, encounter === 'voz');
    for (const f of s.foes) assert.ok(FOE_XP[f.kind] > 0, f.kind);
  }
});

test('La Lealtad takes the blow aimed at the Eco while she stands; one that reaches every foe gets past her', () => {
  const s = fight('cuerdas-lealtad');
  as(s, 'gerard');
  const hit = act(s, 'attack', 'eco');
  assert.equal(hit.target, 'lealtad'); assert.equal(hit.interposed, 'eco');
  assert.equal(s.foes.find(f => f.id === 'eco').hp, 9999);
  assert.ok(s.foes.find(f => f.id === 'lealtad').hp < 9999);
  // Aimed at her, nothing steps in.
  as(s, 'gerard');
  assert.equal(act(s, 'attack', 'lealtad').interposed, undefined);
  // Las dos a la vez reaches both.
  s.levels = { papagato: 3 }; as(s, 'aitor');
  const both = act(s, 'skill', undefined, 'a-la-vez');
  assert.deepEqual(both.hits.map(h => h.target).sort(), ['eco', 'lealtad']);
  assert.ok(both.hits.every(h => h.amount > 0));
  // With her down the Eco is on its own.
  s.foes.find(f => f.id === 'lealtad').hp = 0; as(s, 'gerard');
  const free = act(s, 'attack', 'eco');
  assert.equal(free.target, 'eco'); assert.equal(free.interposed, undefined);
});

test('an Eco\'s blow grows every turn of its own, up to a ceiling', () => {
  const s = fight('cuerdas-lealtad'), eco = s.foes.find(f => f.id === 'eco');
  const blows = [];
  for (let i = 0; i < 6; i++) { blows.push(turn(s, 'eco', 'gerard').amount); s.allies.forEach(a => { a.hp = a.maxHp; }); }
  assert.ok(blows[1] > blows[0] && blows[2] > blows[1]);
  assert.equal(blows[5], blows[4]);
  assert.equal(resonancia(eco), MARTA.resonanciaMost);
  assert.equal(turn(s, 'eco', 'gerard').ability.id, 'resonancia');
});

test('Lo Cristalino sends magic back and takes none; a blow lands half as hard again; it says whom it will hit', () => {
  const s = fight('cuerdas-cristalino');
  assert.equal(intentLabel(s, s.foes[0]), `Destello → ${firstOf(s).name}`);
  as(s, 'gerard');
  const before = ally(s, 'gerard').hp, magic = act(s, 'skill', 'cristalino', 'foc-binari');
  assert.equal(magic.amount, 0); assert.ok(magic.reflected > 0); assert.equal(magic.burn, undefined);
  assert.equal(ally(s, 'gerard').hp, before - magic.reflected);
  assert.equal(s.foes[0].hp, 9999); assert.equal(s.foes[0].timed, undefined);
  // A plain blow on it against the same blow on something else of the same guard.
  as(s, 'gerard');
  const glass = act(s, 'attack', 'cristalino').amount;
  const other = fight('cuerdas-directo'); other.foes[0].stats = { ...s.foes[0].stats }; as(other, 'gerard');
  const plain = act(other, 'attack', 'directo').amount;
  assert.ok(Math.abs(glass - plain * MARTA.cristalPhysical) <= 1, `${glass} against ${plain}`);
  // Its Destello lands on whom it said, and it says who is next.
  const named = firstOf(s).id, flash = turn(s, 'cristalino', named === 'gerard' ? 'aitor' : 'gerard');
  assert.equal(flash.target, named); assert.equal(flash.ability.id, 'destello');
  assert.ok(flash.telegraph.target); assert.equal(s.foes[0].intent.target, flash.telegraph.target);
});

test('magic sent back can end the fight on the party\'s own turn', () => {
  const s = fight('cuerdas-cristalino');
  ally(s, 'gerard').hp = 1; ally(s, 'aitor').hp = 0; as(s, 'gerard');
  act(s, 'skill', 'cristalino', 'foc-binari');
  assert.equal(s.phase, 'lost');
});

test('Lo Directo hits whom it said, very hard, and every third turn everyone; holding on takes two thirds off', () => {
  const s = fight('cuerdas-directo'), line = s.foes[0];
  const named = firstOf(s);
  assert.equal(intentLabel(s, line), `Golpe directo → ${named.name}`);
  // It goes for whom it said, whoever the turn order would have given it.
  const first = turn(s, 'directo', named.id === 'gerard' ? 'aitor' : 'gerard');
  assert.equal(first.target, named.id); assert.equal(first.ability.id, 'golpe-directo');
  round(s);
  const second = turn(s, 'directo');
  assert.equal(second.ability.id, 'golpe-directo');
  assert.equal(intentLabel(s, line), 'En línea recta → todos');
  round(s);
  const third = turn(s, 'directo');
  assert.equal(third.ability.id, 'en-linea'); assert.equal(third.splash.length, 1);
  assert.equal(line.intent.ability, 'golpe-directo');
  // Defender: a third of it.
  const open = fight('cuerdas-directo'), held = fight('cuerdas-directo');
  firstOf(held).guarding = true;
  const whole = turn(open, 'directo').amount, guarded = turn(held, 'directo').amount;
  assert.equal(guarded, Math.ceil(whole / 3));
  assert.ok(whole >= 40, `Golpe directo should hurt: ${whole}`);
});

test('La Voz is only hurt while a note sounds: in a silence a blow goes through her, maná spent', () => {
  const s = fight('voz'), voz = s.foes[0], beat = PHRASES.andante.beats[0];
  assert.equal(songLabel(s), 'Nota · La'); assert.ok(!silenced(s, voz));
  as(s, 'gerard');
  assert.ok(act(s, 'attack', 'voz').amount > 0);
  sing(s, beat.sing + .1);
  assert.equal(songLabel(s), 'Silencio'); assert.ok(silenced(s, voz));
  as(s, 'gerard');
  const hp = voz.hp, mana = ally(s, 'gerard').secondary, miss = act(s, 'skill', 'voz', 'foc-binari');
  assert.equal(miss.amount, 0); assert.equal(miss.silent, true); assert.equal(miss.burn, undefined);
  assert.equal(voz.hp, hp); assert.equal(ally(s, 'gerard').secondary, mana - 1);
  // A blow that reaches every foe finds nobody either.
  s.levels = { papagato: 3 }; as(s, 'aitor');
  assert.equal(act(s, 'skill', undefined, 'a-la-vez').hits[0].amount, 0);
  assert.equal(voz.hp, hp);
});

test('a fire on La Voz burns on, and only takes PV on a note', () => {
  const s = fight('voz'), voz = s.foes[0];
  as(s, 'gerard'); act(s, 'skill', 'voz', 'foc-binari');
  assert.ok(voz.timed.quemado);
  const hp = voz.hp;
  // Two seconds on, still inside the first note: the fire pulses.
  assert.equal(runClock(s, 2.01).length, 1);
  assert.ok(voz.hp < hp);
  // Into the silence: the next pulse comes and takes nothing, and shows nothing.
  const kept = voz.hp;
  assert.equal(runClock(s, 2.01).length, 0);
  assert.equal(voz.hp, kept); assert.ok(voz.timed.quemado);
});

test('every note that starts is an Eco on the whole party; holding on takes two thirds off', () => {
  const s = fight('voz'), [first, next] = PHRASES.andante.beats;
  assert.deepEqual(runClock(s, 1), []);
  assert.deepEqual(takeSongNews(s), []);
  // A few Crescendos in, so that a third of it is less than all of it.
  s.foes[0].crescendo = 10;
  const raw = Math.round(MARTA.eco + 10 * MARTA.ecoStep);
  ally(s, 'aitor').guarding = true;
  runClock(s, first.sing + first.rest);
  const news = takeSongNews(s);
  assert.equal(news.length, 1); assert.equal(news[0].kind, 'eco'); assert.equal(news[0].tone, next.tone);
  assert.ok(raw > Math.ceil(raw / 3));
  assert.deepEqual([...news[0].hits].sort((a, b) => b.amount - a.amount), [{ target: 'gerard', amount: raw }, { target: 'aitor', amount: Math.ceil(raw / 3) }]);
  assert.deepEqual(takeSongNews(s), []);
  assert.equal(s.foes[0].silent, false);
});

test('every time the phrase comes round, a Crescendo: her Magia up, and her Eco with it, with no ceiling', () => {
  const s = fight('voz'), voz = s.foes[0], length = phraseLength(PHRASES.andante);
  runClock(s, length + .01);
  const news = takeSongNews(s);
  assert.deepEqual(news.filter(n => n.kind === 'crescendo'), [{ kind: 'crescendo', level: 1 }]);
  assert.equal(voz.lasting.shifts.magia, MARTA.crescendo);
  assert.equal(news.at(-1).hits[0].amount, Math.round(MARTA.eco + MARTA.ecoStep));
  for (let i = 0; i < 9; i++) runClock(s, length);
  assert.equal(voz.crescendo, 10);
  assert.equal(takeSongNews(s).at(-1).hits[0].amount, Math.round(MARTA.eco + 10 * MARTA.ecoStep));
});

test('the Eco can end the fight on its own', () => {
  const s = fight('voz');
  s.allies.forEach(a => { a.hp = 1; });
  runClock(s, PHRASES.andante.beats[0].sing + PHRASES.andante.beats[0].rest + .01);
  assert.equal(s.phase, 'lost');
});

test('Acorde: a second blow inside the same note, by the other fighter, lands half as hard again, once a note', () => {
  const s = fight('voz'), voz = s.foes[0];
  // Both attack with the same arm, so one blow can be measured against the other.
  ally(s, 'aitor').stats = { ...ally(s, 'gerard').stats };
  as(s, 'gerard');
  const one = act(s, 'attack', 'voz');
  assert.equal(one.chord, undefined);
  // The same fighter again: no Acorde with oneself.
  as(s, 'gerard');
  assert.equal(act(s, 'attack', 'voz').chord, undefined);
  as(s, 'aitor');
  const two = act(s, 'attack', 'voz');
  assert.equal(two.chord, true);
  assert.ok(Math.abs(two.amount - one.amount * MARTA.acorde) <= 1, `${two.amount} against ${one.amount}`);
  // Spent: a third blow in the same note is a plain one.
  as(s, 'gerard');
  assert.equal(act(s, 'attack', 'voz').chord, undefined);
  // In the next note a blow starts over: nothing is owed from the one before.
  sing(s, PHRASES.andante.beats[0].sing + PHRASES.andante.beats[0].rest + .1);
  as(s, 'aitor');
  assert.equal(act(s, 'attack', 'voz').chord, undefined);
  as(s, 'gerard');
  assert.equal(act(s, 'attack', 'voz').chord, true);
  assert.ok(voz.hp < voz.maxHp);
});

test('her turns go round Guardia, Nota clara and Golpe directo', () => {
  const s = fight('voz'), voz = s.foes[0];
  assert.deepEqual([...VOZ_TURNS], ['guardia', 'nota-clara', 'golpe-directo']);
  // Guardia: the next blow at half, and it is spent.
  assert.equal(turn(s, 'voz').ability.id, 'guardia');
  round(s); sing(s, .1);
  as(s, 'gerard');
  const halved = act(s, 'attack', 'voz');
  assert.equal(halved.shield, 'spent');
  as(s, 'gerard');
  const whole = act(s, 'attack', 'voz');
  assert.ok(Math.abs(halved.amount - whole.amount * SOBREMESA.shield) <= 1);
  // Nota clara: magic comes back, and she says whom she will hit.
  const clear = turn(s, 'voz');
  assert.equal(clear.ability.id, 'nota-clara'); assert.equal(clear.clear, true);
  assert.equal(intentLabel(s, voz), `Golpe directo → ${s.allies.find(a => a.id === clear.telegraph.target).name}`);
  round(s); sing(s, .1);
  as(s, 'gerard');
  const back = act(s, 'skill', 'voz', 'foc-binari');
  assert.equal(back.amount, 0); assert.ok(back.reflected > 0);
  as(s, 'gerard');
  assert.ok(act(s, 'attack', 'voz').amount > 0, 'a plain blow still lands through her Nota clara');
  // Golpe directo: on whom she said, and the glass is gone.
  const named = voz.intent.target, blow = turn(s, 'voz', named === 'gerard' ? 'aitor' : 'gerard');
  assert.equal(blow.ability.id, 'golpe-directo'); assert.equal(blow.target, named);
  assert.equal(voz.clear, undefined); assert.equal(voz.intent, undefined);
  round(s);
  assert.equal(turn(s, 'voz').ability.id, 'guardia');
});

test('her PV say which phrase she sings, and a new one starts on its first note', () => {
  assert.equal(phraseFor(1), 'andante'); assert.equal(phraseFor(MARTA.allegro), 'allegro'); assert.equal(phraseFor(MARTA.capela), 'a-capela');
  const s = fight('voz'), voz = s.foes[0];
  runClock(s, 4);
  voz.hp = Math.floor(voz.maxHp * MARTA.allegro);
  runClock(s, .016);
  assert.equal(s.song.phrase, 'allegro'); assert.ok(s.song.t < .1); assert.ok(songNow(s).sounding);
  assert.deepEqual(takeSongNews(s), [{ kind: 'phrase', phrase: 'allegro' }]);
  voz.hp = Math.floor(voz.maxHp * MARTA.capela);
  runClock(s, .016);
  assert.equal(s.song.phrase, 'a-capela');
});

test('the picker can put each fight at its moments', () => {
  const line = createFearBattle(party, 'cuerdas-directo');
  assert.ok(stageMoment(line, 'directo-linea'));
  assert.equal(intentLabel(line, line.foes[0]), 'En línea recta → todos');
  for (const [moment, phrase] of [['voz-andante', 'andante'], ['voz-allegro', 'allegro'], ['voz-a-capela', 'a-capela']]) {
    const s = createFearBattle(party, 'voz');
    assert.equal(STAGED_MOMENTS[moment].encounter, 'voz');
    assert.ok(stageMoment(s, moment), moment);
    assert.equal(s.song.phrase, phrase); assert.equal(s.song.t, 0); assert.equal(s.phase, 'player');
    // Standing there, the clock does not move her to another phrase.
    runClock(s, .016);
    assert.equal(s.song.phrase, phrase, moment);
  }
  const clear = createFearBattle(party, 'voz');
  assert.ok(stageMoment(clear, 'voz-nota-clara'));
  assert.equal(clear.foes[0].clear, true); assert.equal(intentLabel(clear, clear.foes[0]), `Golpe directo → ${clear.allies[0].name}`);
  assert.equal(stageMoment(createFearBattle(party, 'cuerdas-lealtad'), 'voz-allegro'), false);
});

test('La Voz beaten is the fight won, whatever her song was on', () => {
  const s = createFearBattle(party, 'voz');
  s.foes[0].hp = 1; as(s, 'gerard');
  act(s, 'attack', 'voz');
  assert.equal(s.phase, 'won');
  assert.match(s.message, /hilo a hilo/);
});
