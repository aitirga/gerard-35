/**
 * A curiosity, not a measure (docs/fight-sim.md § Jev on both sides): one real fight where Jev,
 * TypeSafe's model, chooses for both sides. For the party it picks among the legal actions; for
 * the foes it picks whom each one goes for (what a foe does is its own rule). It only sees what a
 * player sees: PV, maná, the plates' chips and announced moves, skill descriptions and what just happened.
 * Nobody's real name is sent: the party goes as J1 and J2.
 *
 *   node --experimental-strip-types scripts/fight-sim-duel.mjs <fight> [party] [seed]
 */
import { readFileSync } from 'node:fs';
import { SKILLS, DUALS, ELEMENTS, enemyAct, nextRound, runClock, intentLabel, takeNews, takeSongNews } from '../src/battle.ts';
import { createFight, legalChoices, seeded, simulate } from '../src/battle-sim.ts';
import { JEV_URL } from './fight-sim-jev.mjs';

try { for (const line of readFileSync('.env', 'utf8').split('\n')) { const m = line.match(/^([A-Z_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ''); } } catch {}
const [fight = 'cuerdas-directo', party = 'gerard:matemagico+aitor:papagato', seedArg = '35'] = process.argv.slice(2);
const levels = { matemagico: 2, papagato: 2 }, setup = { fight, party, levels, policy: 'smart', improved: ['matemagico:fuego', 'matemagico:agua', 'matemagico:electrico'] };
const state = createFight(setup, seeded(Number(seedArg)));
const alias = Object.fromEntries(state.allies.map((a, i) => [a.name, `J${i + 1}`]));
const anon = text => Object.entries(alias).reduce((t, [name, to]) => t.replaceAll(name, to), String(text ?? ''));
const log = [];
let calls = 0;

async function ask(side, options) {
  const keys = Object.keys(options);
  if (keys.length === 1) return keys[0];
  const view = {
    round: state.round,
    party: state.allies.map(a => ({ who: alias[a.name], pv: `${a.hp}/${a.maxHp}`, mana: `${a.secondary}/${a.maxSecondary}`, anima: a.classId ?? 'none', guarding: a.guarding })),
    foes: state.foes.filter(f => f.hp > 0).map(f => ({ id: f.id, name: f.name, pv: `${f.hp}/${f.maxHp}`, announced: anon(intentLabel(state, f) ?? ''), layers: f.layers, dish: f.dish, stuck: f.stuck, cracked: f.cracked, form: f.form, countdown: f.countdown, burning: f.timed?.quemado?.level, wet: !!f.timed?.mojado })),
    justHappened: log.slice(-8),
  };
  const body = { model: process.env.JEV_MODEL || 'jev-latest', state: view, questions: { move: {
    type: 'choice',
    instructions: side === 'party'
      ? 'You play the party in a turn-based fight. You win only by taking every foe to 0 PV, and lose if the whole party falls. `foes[].announced` is what each foe will do next and to whom. Read `justHappened` for what worked and what did not. Which action is best for this fighter now?'
      : 'You play the foes in a turn-based fight and want the party to lose. Whom should this foe go for now?',
    criteria: options } } };
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(JEV_URL, { method: 'POST', headers: { Authorization: `Bearer ${process.env.TYPESAFE_API_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(60000) });
      if (!response.ok) throw new Error(`${response.status}: ${(await response.text()).slice(0, 200)}`);
      calls++;
      const pick = (await response.json()).answers.move.choice;
      return keys.includes(pick) ? pick : keys[0];
    } catch (error) { if (attempt === 2) throw error; }
  }
}
const describe = choice => {
  const target = state.foes.find(f => f.id === choice.target)?.name;
  if (choice.action === 'defend') return 'Hold on (defend): two thirds off the blows this round, some maná back';
  if (choice.action === 'attack') return `Atacar ${target}${choice.element ? ` with ${ELEMENTS[choice.element].name}` : ''}`;
  if (choice.action === 'dual') { const d = DUALS.find(x => x.id === choice.dual); return `Dual attack with your partner (uses both turns): ${d.name} on ${target}. ${d.description}`; }
  const s = SKILLS.find(x => x.id === choice.skill);
  return `${s.name}${target ? ` on ${target}` : ''} (${s.cost} maná). ${s.description}`;
};
const { act, actDual, wearAnima } = await import('../src/battle.ts');
const say = effect => { const line = anon(state.message) + (effect?.affinity ? ` (${effect.affinity === 'weak' ? 'WEAK to that element: it hurt more' : 'RESISTS that element'})` : ''); log.push(line); console.log(`  r${state.round} ${line}`); };
const over = () => state.phase === 'won' || state.phase === 'lost';
while (!over() && state.round <= 40) {
  if (state.phase === 'player') {
    runClock(state, 3); takeNews(state); takeSongNews(state);
    if (state.phase !== 'player') continue;
    const choices = legalChoices(state, setup, false, true), options = Object.fromEntries(choices.map((c, i) => [`o${i}`, describe(c)]));
    const choice = choices[Number((await ask('party', options)).slice(1))];
    if (choice.wear) wearAnima(state, choice.wear);
    if (choice.action === 'attack') state.allies[state.active].element = choice.element;
    const effect = choice.action === 'dual' ? actDual(state, choice.dual, choice.target) : act(state, choice.action, choice.target, choice.skill);
    if (!effect) throw new Error(`illegal: ${JSON.stringify(choice)}`);
    say(effect); takeNews(state);
    runClock(state, 1.2); takeNews(state);
  } else if (state.phase === 'enemy') {
    for (const foe of state.foes.filter(f => f.hp > 0)) {
      if (state.phase !== 'enemy') break;
      const alive = state.allies.filter(a => a.hp > 0);
      const target = await ask('foes', Object.fromEntries(alive.map(a => [a.id, `${foe.name}${intentLabel(state, foe) ? ` (announced: ${anon(intentLabel(state, foe))})` : ''} goes for ${alias[a.name]}, who has ${a.hp} PV${a.guarding ? ' and is holding on' : ''}`])));
      say(enemyAct(state, foe.id, target)); takeNews(state);
      if (state.phase === 'enemy') runClock(state, 1.2);
    }
    if (state.phase === 'enemy') nextRound(state);
    takeNews(state);
  } else break;
}
const left = Math.round(100 * state.allies.reduce((s, a) => s + a.hp, 0) / state.allies.reduce((s, a) => s + a.maxHp, 0));
console.log(`\n${fight}: ${state.phase === 'won' ? 'GANA EL EQUIPO' : state.phase === 'lost' ? 'GANAN LOS ENEMIGOS' : 'sin acabar'} en ${state.round} rondas, equipo con ${left} % de PV · ${calls} llamadas a Jev`);
const bots = ['smart', 'casual'].map(policy => `${policy} ${Math.round(simulate({ ...setup, policy }, 100, 35).win * 100)} %`).join(', ');
console.log(`Los bots, mismo combate y equipo: ${bots}`);
