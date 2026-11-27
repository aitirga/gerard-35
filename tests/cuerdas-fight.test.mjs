import test from 'node:test';
import assert from 'node:assert/strict';
import { CUERDAS_ENCOUNTERS, CUERDAS_FIGHTS, DIRECTO_TURNS, FEAR_ENCOUNTERS, MARTA, SECOND_VOICE, STAGED_MOMENTS, VOZ_NOTES, VOZ_TURNS, act, cornered, createFearBattle, enemyAct, intentLabel, nextRound, partFor, resonancia, runClock, singing, songLabel, songNow, stageMoment, takeNews, takeSongNews, vozMove } from '../src/battle.ts';
import { VOZ_SONG, phraseLength, songAt, turnAt, turnStarts } from '../src/song.ts';
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
/** Moves the song to `t` seconds into Marta's recording, with no note sung on the way. */
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
  // Factor común reaches both.
  s.improved = { skills: ['factor-comun'] }; as(s, 'gerard');
  const both = act(s, 'skill', undefined, 'factor-comun');
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

test('La Lealtad swears at the start of a round, on whoever struck her last in the one before; her Eco repeats it on the same one', () => {
  const s = fight('cuerdas-lealtad'), lealtad = s.foes[0], first = firstOf(s);
  assert.equal(intentLabel(s, lealtad), `Juramento → ${first.name}`);
  // Blows inside the round do not move her oath: whoever it names can still hold on.
  as(s, 'aitor'); act(s, 'attack', 'lealtad');
  // A blow aimed at the Eco lands on her, so it counts too.
  as(s, 'gerard'); act(s, 'attack', 'eco');
  assert.equal(intentLabel(s, lealtad), `Juramento → ${first.name}`);
  const oath = turn(s, 'lealtad', 'aitor');
  assert.equal(oath.ability.id, 'juramento'); assert.equal(oath.target, first.id);
  assert.equal(enemyAct(s, 'eco', 'aitor').target, first.id);
  // The round over, she swears on the last one who struck her.
  round(s);
  assert.equal(intentLabel(s, lealtad), 'Juramento → Gerard');
  // He falls: she turns to whoever is left.
  ally(s, 'gerard').hp = 0; as(s, 'aitor'); act(s, 'defend');
  assert.equal(intentLabel(s, lealtad), 'Juramento → Aitor');
});

test('Lazo: every third turn of hers, an Eco hurt or fallen is whole again, and one brought back starts over', () => {
  const s = fight('cuerdas-lealtad'), [lealtad, eco] = s.foes;
  // Nothing to tie while her Eco is whole: a Juramento.
  lealtad.turns = MARTA.lazoEvery - 1;
  assert.equal(turn(s, 'lealtad').ability.id, 'juramento');
  // Hurt: her plate says it a turn ahead, and it is whole again, its Resonancia as it was.
  lealtad.turns = MARTA.lazoEvery - 1; eco.hp = 10; eco.turns = 3;
  as(s, 'gerard'); act(s, 'defend');
  assert.equal(intentLabel(s, lealtad), 'Lazo → Eco');
  const tied = turn(s, 'lealtad');
  assert.equal(tied.ability.id, 'lazo'); assert.deepEqual(tied.lazo, { target: 'eco', amount: 9989, back: false });
  assert.equal(eco.hp, eco.maxHp); assert.equal(eco.turns, 3);
  assert.match(intentLabel(s, lealtad), /^Juramento → /);
  // Fallen: back on its feet, from the start, and it sits this round out.
  lealtad.turns = MARTA.lazoEvery - 1; eco.hp = 0;
  const back = turn(s, 'lealtad');
  assert.equal(back.lazo.back, true); assert.equal(eco.hp, eco.maxHp); assert.equal(eco.turns, 0);
  assert.equal(enemyAct(s, 'eco'), undefined);
  assert.equal(resonancia(eco), MARTA.resonancia);
  // With her gone nobody ties it again.
  lealtad.hp = 0; eco.hp = 0;
  assert.equal(turn(s, 'lealtad'), undefined);
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

test('at half its PV Lo Cristalino cracks: an Estallido on everyone that takes nobody\'s last PV, magic goes in, and its turns are a Prisma on everyone', () => {
  const s = fight('cuerdas-cristalino'), glass = s.foes[0];
  glass.hp = Math.floor(glass.maxHp * MARTA.crack) + 1;
  // Whoever is last in line is on their last PV.
  const weak = s.allies[1];
  weak.hp = 1;
  as(s, s.allies[0].id);
  const blow = act(s, 'attack', 'cristalino');
  assert.ok(blow.amount > 0); assert.equal(glass.cracked, true);
  const [burst] = takeNews(s);
  assert.equal(burst.ability.id, 'estallido'); assert.equal(burst.cracked, true); assert.equal(burst.actor, 'cristalino');
  assert.ok(burst.amount > 0); assert.equal(burst.splash.length, 1);
  assert.equal(burst.splash[0].amount, 0); assert.equal(weak.hp, 1, 'the shards never take the last PV');
  assert.equal(intentLabel(s, glass), 'Prisma → todos');
  assert.deepEqual(takeNews(s), [], 'it only cracks once');
  // Magic goes in now, and lights it.
  as(s, 'gerard');
  const magic = act(s, 'skill', 'cristalino', 'foc-binari');
  assert.ok(magic.amount > 0); assert.equal(magic.reflected, undefined); assert.ok(glass.timed.quemado);
  weak.hp = 9999;
  const prisma = turn(s, 'cristalino');
  assert.equal(prisma.ability.id, 'prisma'); assert.equal(prisma.splash.length, 1);
  assert.equal(intentLabel(s, glass), 'Prisma → todos');
});

test('a fire can crack Lo Cristalino between two actions', () => {
  const s = fight('cuerdas-cristalino'), glass = s.foes[0];
  glass.cracked = true; as(s, 'gerard'); act(s, 'skill', 'cristalino', 'foc-binari');
  glass.cracked = false; glass.hp = Math.floor(glass.maxHp * MARTA.crack) + 1;
  runClock(s, 2.01);
  assert.equal(glass.cracked, true);
  assert.equal(takeNews(s)[0].ability.id, 'estallido');
});

test('magic sent back can end the fight on the party\'s own turn', () => {
  const s = fight('cuerdas-cristalino');
  ally(s, 'gerard').hp = 1; ally(s, 'aitor').hp = 0; as(s, 'gerard');
  act(s, 'skill', 'cristalino', 'foc-binari');
  assert.equal(s.phase, 'lost');
});

test('Lo Directo goes round its turns, each said a turn ahead: two Golpes directos, everyone, and an Estocada; holding on takes two thirds off', () => {
  assert.deepEqual([...DIRECTO_TURNS], ['golpe-directo', 'golpe-directo', 'en-linea', 'estocada']);
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
  assert.equal(line.intent.ability, 'estocada');
  const marked = line.intent.target;
  assert.equal(intentLabel(s, line), `Estocada → ${ally(s, marked).name}`);
  round(s);
  const lunge = turn(s, 'directo', marked === 'gerard' ? 'aitor' : 'gerard');
  assert.equal(lunge.ability.id, 'estocada'); assert.equal(lunge.target, marked); assert.equal(lunge.stuck, true);
  assert.ok(lunge.amount > first.amount, 'the Estocada is its hardest blow');
  assert.equal(line.intent.ability, 'golpe-directo');
  // Defender: a third of it.
  const open = fight('cuerdas-directo'), held = fight('cuerdas-directo');
  firstOf(held).guarding = true;
  const whole = turn(open, 'directo').amount, guarded = turn(held, 'directo').amount;
  assert.equal(guarded, Math.ceil(whole / 3));
  assert.ok(whole >= 40, `Golpe directo should hurt: ${whole}`);
});

test('after its Estocada Lo Directo is stuck until its next turn: every blow on it lands half as hard again', () => {
  const s = fight('cuerdas-directo'), line = s.foes[0];
  as(s, 'gerard');
  const plain = act(s, 'attack', 'directo').amount;
  as(s, 'gerard');
  const magic = act(s, 'skill', 'directo', 'foc-binari').amount;
  line.turns = DIRECTO_TURNS.indexOf('estocada'); line.intent = { ability: 'estocada', target: 'gerard' };
  turn(s, 'directo');
  assert.equal(line.stuck, true);
  round(s);
  as(s, 'gerard');
  assert.ok(Math.abs(act(s, 'attack', 'directo').amount - plain * MARTA.clavado) <= 1);
  as(s, 'gerard'); delete line.timed;
  assert.ok(Math.abs(act(s, 'skill', 'directo', 'foc-binari').amount - magic * MARTA.clavado) <= 1);
  // Its next turn pulls the lance out.
  turn(s, 'directo');
  assert.equal(line.stuck, undefined);
  as(s, 'gerard');
  assert.ok(Math.abs(act(s, 'attack', 'directo').amount - plain) <= 1);
});

/** Where in Marta's recording the `n`th note (0 up) that is `tone` starts, and its beat. */
const noteAt = (tone, n = 0) => {
  let clock = 0, seen = 0;
  for (const beat of VOZ_SONG.beats) {
    if (beat.tone === tone && seen++ === n) return { at: clock, beat };
    clock += beat.sing + beat.rest;
  }
  throw new Error(`No ${tone} number ${n}`);
};
/** The note `tone` (its `n`th) starts: the song is put just before it and runs over it. Returns what it did. */
const sung = (s, tone, n = 0) => {
  takeSongNews(s);
  sing(s, noteAt(tone, n).at - .005); runClock(s, .01);
  return takeSongNews(s).find(news => news.kind === 'nota');
};
/** A note that starts after a silence, and one bound to the note before it (no silence between). */
const afterSilence = () => { let clock = 0; for (const [i, beat] of VOZ_SONG.beats.entries()) { if (i && VOZ_SONG.beats[i - 1].rest > .2) return clock; clock += beat.sing + beat.rest; } };
const afterBound = () => { let clock = 0; for (const [i, beat] of VOZ_SONG.beats.entries()) { if (i && VOZ_SONG.beats[i - 1].rest === 0) return clock; clock += beat.sing + beat.rest; } };

test('La Voz is only hurt in her silences: while a note sounds a blow goes through her, maná spent', () => {
  const s = fight('voz'), voz = s.foes[0], beat = VOZ_SONG.beats[0];
  sing(s, .7);
  assert.equal(songLabel(s), 'Nota · Do'); assert.ok(singing(s, voz));
  as(s, 'gerard');
  const hp = voz.hp, mana = ally(s, 'gerard').secondary, miss = act(s, 'skill', 'voz', 'foc-binari');
  assert.equal(miss.amount, 0); assert.equal(miss.sung, true); assert.equal(miss.burn, undefined);
  assert.equal(voz.hp, hp); assert.equal(ally(s, 'gerard').secondary, mana - 1);
  // A blow that reaches every foe finds nobody either.
  s.improved = { skills: ['factor-comun'] }; as(s, 'gerard');
  assert.equal(act(s, 'skill', undefined, 'factor-comun').hits[0].amount, 0);
  assert.equal(voz.hp, hp);
  // In the silence after it, she is there.
  sing(s, beat.sing + .1);
  assert.equal(songLabel(s), 'Silencio'); assert.ok(!singing(s, voz));
  as(s, 'gerard');
  assert.ok(act(s, 'attack', 'voz').amount > 0);
});

test('her gaps reach into her notes: `hueco` on each side of a silence, `ligado` on each side of a bound change of note', () => {
  const s = fight('voz'), voz = s.foes[0];
  // Taking a note up again after a silence, and letting the one before it go.
  sing(s, afterSilence() + MARTA.hueco / 2);
  assert.ok(songNow(s).sounding); assert.ok(!singing(s, voz));
  sing(s, afterSilence() + MARTA.hueco * 1.5);
  assert.ok(singing(s, voz));
  const silent = VOZ_SONG.beats.findIndex((_, i) => i && VOZ_SONG.beats[i - 1].rest > .2), letGo = afterSilence() - VOZ_SONG.beats[silent - 1].rest;
  sing(s, letGo - MARTA.hueco / 2);
  assert.ok(songNow(s).sounding); assert.ok(!singing(s, voz));
  // Even where she sings on, the voice breaks as it moves: a shorter gap at each bound change.
  sing(s, afterBound() + MARTA.ligado / 2);
  assert.ok(songNow(s).sounding); assert.ok(!singing(s, voz));
  sing(s, afterBound() - MARTA.ligado / 2);
  assert.ok(songNow(s).sounding); assert.ok(!singing(s, voz));
  sing(s, afterBound() + MARTA.ligado * 2);
  assert.ok(singing(s, voz));
  // A blow in a bound gap lands, and the gap is the note it follows, for the Acorde.
  sing(s, afterBound() + MARTA.ligado / 2);
  as(s, 'gerard');
  assert.ok(act(s, 'attack', 'voz').amount > 0);
});

test('a blow is judged when it was pressed: one pressed in a silence lands though it plays after a note started', () => {
  const s = fight('voz'), voz = s.foes[0], beat = VOZ_SONG.beats[0];
  sing(s, beat.sing + beat.rest + .4);
  assert.ok(singing(s, voz));
  s.song.aim = beat.sing + .1;
  as(s, 'gerard');
  assert.ok(act(s, 'attack', 'voz').amount > 0);
  // Pressed too long ago, it is judged now.
  s.song.aim = s.song.t - 4;
  as(s, 'gerard');
  assert.equal(act(s, 'attack', 'voz').sung, true);
});

test('a fire on La Voz burns on, and only takes PV in a silence', () => {
  const s = fight('voz'), voz = s.foes[0];
  // Set alight in a silence whose next pulse lands in a silence too, and the one after on a note.
  let at = 0;
  while (!(!songAt(VOZ_SONG, at).sounding && !songAt(VOZ_SONG, at + 2.01).sounding && songAt(VOZ_SONG, at + 4.02).sounding && songAt(VOZ_SONG, at + 4.02).into > MARTA.hueco)) at += .01;
  sing(s, at);
  as(s, 'gerard'); act(s, 'skill', 'voz', 'foc-binari');
  assert.ok(voz.timed.quemado);
  const hp = voz.hp;
  // Two seconds on, still silent: the fire pulses.
  assert.equal(runClock(s, 2.01).filter(p => p.target === 'voz').length, 1);
  assert.ok(voz.hp < hp);
  // On a note: the next pulse comes and takes nothing, and shows nothing.
  const kept = voz.hp;
  assert.equal(runClock(s, 2.01).filter(p => p.target === 'voz').length, 0);
  assert.equal(voz.hp, kept); assert.ok(voz.timed.quemado);
});

test('every note she starts is a move of hers, a beam at whom she sings at, with its element; La reaches everyone', () => {
  assert.deepEqual(Object.keys(VOZ_NOTES).sort(), ['do', 'fa', 'la', 're', 'sib', 'sol']);
  const s = fight('voz'), voz = s.foes[0], at = voz.facing, other = s.allies.find(a => a.id !== at).id;
  assert.equal(at, firstOf(s).id);
  for (const tone of ['do', 're']) {
    const note = sung(s, tone);
    assert.equal(note.ability, VOZ_NOTES[tone].ability); assert.equal(note.element, undefined);
    assert.equal(note.hits.length, 1); assert.equal(note.hits[0].target, at); assert.ok(note.hits[0].amount > 0);
  }
  const water = sung(s, 'sol');
  assert.equal(water.element, 'agua'); assert.equal(water.hits[0].wet, true); assert.ok(ally(s, at).timed.mojado);
  delete ally(s, at).timed.mojado;
  const fire = sung(s, 'sib');
  assert.equal(fire.element, 'fuego'); assert.equal(fire.hits[0].burn, 1); assert.equal(ally(s, at).timed.quemado.level, 1);
  const bolt = sung(s, 'fa');
  assert.equal(bolt.element, 'electrico'); assert.equal(bolt.conducted, undefined);
  const all = sung(s, 'la');
  assert.deepEqual(all.hits.map(h => h.target).sort(), [at, other].sort());
  assert.equal(intentLabel(s, voz), undefined, 'her notes are not announced: the song is what says them');
});

test('holding on against her song takes two thirds off and leaves nothing on: no water, no fire', () => {
  const s = fight('voz'), voz = s.foes[0], who = ally(s, voz.facing);
  // Many Crescendos in, so that a third of it is less than all of it.
  voz.lasting = { shifts: { magia: 20 }, from: 'Crescendo' };
  const look = structuredClone(s), whole = sung(look, 'sol').hits[0].amount;
  who.guarding = true;
  const held = sung(s, 'sol').hits[0];
  assert.equal(held.amount, Math.ceil(whole / 3)); assert.equal(held.guarded, true); assert.equal(held.wet, undefined);
  assert.equal(who.timed?.mojado, undefined);
  assert.equal(sung(s, 'sib').hits[0].burn, undefined); assert.equal(who.timed?.quemado, undefined);
});

test('Fa on someone wet runs through the water: Conducción on everyone wet, who are left dry; Si♭ on someone wet dries them and does not catch', () => {
  const s = fight('voz'), voz = s.foes[0], who = ally(s, voz.facing);
  const dry = structuredClone(s), plain = sung(dry, 'fa').hits[0].amount;
  sung(s, 'sol');
  assert.ok(who.timed.mojado);
  const bolt = sung(s, 'fa');
  assert.equal(bolt.conducted, true); assert.equal(bolt.hits[0].conducted, true); assert.ok(bolt.hits[0].amount > plain);
  assert.equal(who.timed.mojado, undefined);
  sung(s, 'sol');
  const fire = sung(s, 'sib');
  assert.equal(fire.hits[0].dried, true); assert.equal(fire.hits[0].burn, undefined);
  assert.equal(who.timed.mojado, undefined); assert.equal(who.timed.quemado, undefined);
});

test('she sings each turn of her phrase at whoever touched her last in the one before', () => {
  const s = fight('voz'), voz = s.foes[0], first = voz.facing, other = s.allies.find(a => a.id !== first).id;
  // The other one lands a blow in a silence: she remembers it, and goes on singing at the first.
  sing(s, VOZ_SONG.beats[0].sing + .1); as(s, other);
  act(s, 'attack', 'voz');
  assert.equal(voz.struck, other); assert.equal(voz.facing, first);
  // A blow that goes through her (on a note) does not count.
  sing(s, .3); as(s, first);
  act(s, 'attack', 'voz');
  assert.equal(voz.struck, other);
  assert.equal(sung(s, 'sol').hits[0].target, first);
  // Her phrase comes round: this turn is the other one's, and the fight says so.
  takeSongNews(s);
  sing(s, turnAt(VOZ_SONG, 0).length - .005); runClock(s, .01);
  const news = takeSongNews(s);
  assert.deepEqual(news.find(n => n.kind === 'mira'), { kind: 'mira', target: other });
  assert.equal(news.find(n => n.kind === 'nota').hits[0].target, other);
  assert.equal(voz.facing, other); assert.equal(voz.struck, undefined);
});

test('every time her phrase comes round in the recording, a Crescendo: her Magia up, with no ceiling', () => {
  const s = fight('voz'), voz = s.foes[0];
  runClock(s, turnAt(VOZ_SONG, 0).length + .01);
  const news = takeSongNews(s);
  assert.deepEqual(news.filter(n => n.kind === 'crescendo'), [{ kind: 'crescendo', level: 1 }]);
  assert.equal(voz.lasting.shifts.magia, MARTA.crescendo);
  // The whole recording again: its eight turns, and the song goes on from its top.
  runClock(s, phraseLength(VOZ_SONG));
  assert.equal(voz.crescendo, 9);
  assert.equal(voz.lasting.shifts.magia, 9 * MARTA.crescendo);
});

test('her notes can end the fight on their own', () => {
  const s = fight('voz');
  s.allies.forEach(a => { a.hp = 1; });
  // Her La reaches everyone.
  sung(s, 'la');
  assert.equal(s.phase, 'lost');
});

test('against her song Defender lasts until that fighter acts again, not to the end of the round', () => {
  const s = fight('voz');
  as(s, 'gerard'); act(s, 'defend');
  assert.ok(ally(s, 'gerard').guarding);
  round(s);
  assert.ok(ally(s, 'gerard').guarding, 'still holding on in the round after');
  sing(s, VOZ_SONG.beats[0].sing + .1); as(s, 'gerard');
  act(s, 'attack', 'voz');
  assert.equal(ally(s, 'gerard').guarding, false);
  // Anywhere else it ends with the round, as always.
  const line = fight('cuerdas-directo');
  as(line, 'gerard'); act(line, 'defend'); round(line);
  assert.equal(ally(line, 'gerard').guarding, false);
});

test('Acorde: a second blow inside the same silence, by the other fighter, lands half as hard again, once a silence', () => {
  const s = fight('voz'), voz = s.foes[0], [first, second] = VOZ_SONG.beats;
  // Both attack with the same arm, so one blow can be measured against the other.
  ally(s, 'aitor').stats = { ...ally(s, 'gerard').stats };
  sing(s, first.sing + .05);
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
  // Spent: a third blow in the same silence is a plain one.
  as(s, 'gerard');
  assert.equal(act(s, 'attack', 'voz').chord, undefined);
  // In the next silence a blow starts over: nothing is owed from the one before.
  sing(s, first.sing + first.rest + second.sing + .05);
  as(s, 'aitor');
  assert.equal(act(s, 'attack', 'voz').chord, undefined);
  as(s, 'gerard');
  assert.equal(act(s, 'attack', 'voz').chord, true);
  assert.ok(voz.hp < voz.maxHp);
});

test('in Andante she takes no turn of her own: her song is all she does, and the round does not wait on her', () => {
  const s = fight('voz'), voz = s.foes[0];
  assert.deepEqual([...VOZ_TURNS.andante], []);
  assert.equal(vozMove(s, voz), undefined);
  s.phase = 'enemy'; s.enemyActions = [];
  assert.equal(enemyAct(s, 'voz'), undefined);
  assert.ok(s.enemyActions.includes('voz'));
  nextRound(s);
  assert.equal(s.phase, 'player'); assert.equal(s.round, 2);
});

test('Coro: in Allegro she calls a second voice, once, an Eco that can be struck while she sings, at the one she is not singing at; it goes when she does', () => {
  const s = fight('voz'), voz = s.foes[0];
  voz.hp = Math.floor(voz.maxHp * MARTA.allegro); runClock(s, .016); takeSongNews(s);
  assert.equal(voz.turns, 0, 'a new part starts her turns over');
  const call = turn(s, 'voz');
  assert.equal(call.ability.id, 'coro'); assert.equal(call.summoned, SECOND_VOICE);
  const second = s.foes.find(f => f.id === SECOND_VOICE);
  assert.equal(second.kind, 'eco'); assert.equal(second.name, 'Segunda voz'); assert.ok(second.hp > 0);
  // It waits for the next round, then sings at the other one, harder each time.
  assert.equal(enemyAct(s, SECOND_VOICE), undefined);
  round(s);
  const blows = [turn(s, SECOND_VOICE), turn(s, SECOND_VOICE)];
  assert.ok(blows.every(b => b.target !== voz.facing));
  assert.ok(blows[1].amount > blows[0].amount);
  // While she sings a blow goes through her and lands on it.
  sing(s, .3); as(s, 'gerard');
  assert.equal(act(s, 'attack', 'voz').amount, 0);
  as(s, 'gerard');
  assert.ok(act(s, 'attack', SECOND_VOICE).amount > 0);
  // She calls it once: standing or fallen, she only sings from then on.
  voz.turns = 0;
  assert.equal(vozMove(s, voz), undefined);
  second.hp = 0;
  assert.equal(vozMove(s, voz), undefined);
  assert.equal(s.foes.filter(f => f.id === SECOND_VOICE).length, 1);
  second.hp = second.maxHp;
  // She falls: it goes with her, and the fight is won.
  voz.hp = 1; sing(s, VOZ_SONG.beats[0].sing + .1); as(s, 'gerard');
  act(s, 'attack', 'voz');
  assert.equal(second.hp, 0); assert.equal(s.phase, 'won');
});

test('Calderón: in A capela she takes a breath and holds a note on everyone, unless an Acorde in a silence breaks it first', () => {
  assert.deepEqual([...VOZ_TURNS['a-capela']], ['aliento', 'calderon', null]);
  const silence = VOZ_SONG.beats[0].sing + .05;
  const stage = () => {
    const s = fight('voz'), voz = s.foes[0];
    voz.hp = Math.floor(voz.maxHp * MARTA.capela); runClock(s, .016); takeSongNews(s);
    return { s, voz };
  };
  const { s, voz } = stage();
  const breath = turn(s, 'voz');
  assert.equal(breath.ability.id, 'aliento'); assert.equal(breath.target, undefined);
  assert.equal(intentLabel(s, voz), 'Calderón → todos');
  round(s);
  const held = turn(s, 'voz');
  assert.equal(held.ability.id, 'calderon'); assert.ok(held.amount > 0); assert.equal(held.splash.length, 1);
  assert.equal(intentLabel(s, voz), undefined);
  // The round after, she only sings; then she takes a breath again.
  round(s);
  assert.equal(turn(s, 'voz'), undefined);
  round(s);
  assert.equal(turn(s, 'voz').ability.id, 'aliento');
  // Broken: a blow alone does nothing to it; the other fighter's, inside the same silence, does.
  const again = stage();
  turn(again.s, 'voz'); round(again.s); sing(again.s, silence);
  as(again.s, 'gerard');
  assert.equal(act(again.s, 'attack', 'voz').cancelled, undefined);
  assert.equal(intentLabel(again.s, again.voz), 'Calderón → todos');
  as(again.s, 'aitor');
  const chord = act(again.s, 'attack', 'voz');
  assert.equal(chord.chord, true); assert.equal(chord.cancelled, 'calderon');
  assert.equal(again.voz.winded, true); assert.equal(intentLabel(again.s, again.voz), undefined);
  const before = again.s.allies.map(a => a.hp), lost = turn(again.s, 'voz');
  assert.equal(lost.ability.id, 'calderon'); assert.equal(lost.cancelled, 'calderon'); assert.equal(lost.amount, undefined);
  assert.deepEqual(again.s.allies.map(a => a.hp), before);
  assert.equal(again.voz.winded, undefined);
});

test('her PV say which part she is in; her song goes on through them, never from the top', () => {
  assert.equal(partFor(1), 'andante'); assert.equal(partFor(MARTA.allegro), 'allegro'); assert.equal(partFor(MARTA.capela), 'a-capela');
  const s = fight('voz'), voz = s.foes[0];
  runClock(s, 1); takeSongNews(s);
  voz.hp = Math.floor(voz.maxHp * MARTA.allegro);
  runClock(s, .016);
  assert.equal(s.song.part, 'allegro'); assert.ok(Math.abs(s.song.t - 1.016) < 1e-9); assert.ok(songNow(s).sounding);
  assert.deepEqual(takeSongNews(s), [{ kind: 'part', part: 'allegro' }]);
  voz.hp = Math.floor(voz.maxHp * MARTA.capela);
  runClock(s, .016);
  assert.equal(s.song.part, 'a-capela');
});

test('the picker can put each fight at its moments', () => {
  const line = createFearBattle(party, 'cuerdas-directo');
  assert.ok(stageMoment(line, 'directo-linea'));
  assert.equal(intentLabel(line, line.foes[0]), 'En línea recta → todos');
  assert.ok(stageMoment(line, 'directo-estocada'));
  assert.equal(intentLabel(line, line.foes[0]), `Estocada → ${line.allies[0].name}`);
  assert.ok(stageMoment(line, 'directo-clavado'));
  assert.equal(line.foes[0].stuck, true);
  const oath = createFearBattle(party, 'cuerdas-lealtad');
  assert.ok(stageMoment(oath, 'lealtad-lazo'));
  assert.equal(intentLabel(oath, oath.foes[0]), 'Lazo → Eco'); assert.equal(oath.foes[1].hp, 0);
  const glass = createFearBattle(party, 'cuerdas-cristalino');
  assert.ok(stageMoment(glass, 'cristalino-rajado'));
  assert.equal(glass.foes[0].cracked, true); assert.equal(intentLabel(glass, glass.foes[0]), 'Prisma → todos');
  assert.deepEqual(takeNews(glass), [], 'staged cracked, it does not crack again');
  const choir = createFearBattle(party, 'voz');
  assert.ok(stageMoment(choir, 'voz-coro'));
  assert.equal(choir.song.part, 'allegro'); assert.ok(choir.foes.some(f => f.id === SECOND_VOICE && f.hp > 0));
  assert.ok(stageMoment(choir, 'voz-calderon'));
  assert.equal(choir.song.part, 'a-capela'); assert.equal(intentLabel(choir, choir.foes[0]), 'Calderón → todos');
  assert.ok(!choir.foes.some(f => f.id === SECOND_VOICE), 'a staged moment starts clean');
  for (const [moment, part] of [['voz-andante', 'andante'], ['voz-allegro', 'allegro'], ['voz-a-capela', 'a-capela']]) {
    const s = createFearBattle(party, 'voz');
    assert.equal(STAGED_MOMENTS[moment].encounter, 'voz');
    assert.ok(stageMoment(s, moment), moment);
    assert.equal(s.song.part, part); assert.equal(s.song.t, 0); assert.equal(s.phase, 'player');
    // Standing there, the clock does not move her to another part.
    runClock(s, .016);
    assert.equal(s.song.part, part, moment);
  }
  const fast = createFearBattle(party, 'voz');
  assert.ok(stageMoment(fast, 'voz-deprisa'));
  assert.equal(fast.song.part, 'andante'); assert.ok(Math.abs(fast.song.t - (turnStarts(VOZ_SONG)[5] - .5)) < 1e-9);
  assert.equal(stageMoment(createFearBattle(party, 'cuerdas-lealtad'), 'voz-allegro'), false);
});

test('La Voz beaten is the fight won, whatever her song was on', () => {
  const s = createFearBattle(party, 'voz');
  s.foes[0].hp = 1; as(s, 'gerard');
  act(s, 'attack', 'voz');
  assert.equal(s.phase, 'won');
  assert.match(s.message, /hilo a hilo/);
});
