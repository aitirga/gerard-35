#!/usr/bin/env -S node --experimental-strip-types
/** The whole game played headless, from a terminal: see docs/game-sim.md and src/game-sim.ts. */
import { mkdir, writeFile } from 'node:fs/promises';
import { availableParallelism } from 'node:os';
import { resolve } from 'node:path';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { ENCOUNTER_NAMES, GAME_SIM_VERSION, PLAYERS, Playing, TIME_KINDS, playGame, summarise } from '../src/game-sim.ts';
import { withTuning } from '../src/battle-sim.ts';
import { gamePage } from './game-sim-report.mjs';

const HELP = `El juego entero jugado sin pantalla: la historia real, los lugares, los perseguidores y los combates.

  just game-sim                         La página del juego entero (= report)
  just game-sim report [opciones]       Juega y escribe output/reports/game/index.html y data.json (el selector la enseña)
  just game-sim run [opciones]          Juega y resume en el terminal
  just game-sim play [opciones]         Una partida, combate a combate (--trace: cada paso y cada paseo)
  just game-sim list                    Los jugadores simulados, en JSON

Opciones:
  --player a,b       Jugadores: ${Object.keys(PLAYERS).join(', ')} (por defecto, todos)
  --runs N           Partidas por jugador (24; play juega 1)
  --seed N           Semilla de la primera partida: misma semilla, mismas partidas (35)
  --workers N        Hilos en paralelo (los núcleos menos uno)
  --tune p=a:b       Prueba números sin tocar el código, los mismos de just fight-sim (repetible, se combinan). Con
                     varios valores juega cada combinación y las compara en una tabla, sin escribir la página:
                     --tune growth.rules.pct=0:.12:.24 (lo que suma cada ánima de amigo) · --tune level.xp.2=950:1290 · --tune xp.rules.castle=1:3
  --set campo=valor  Cambia cómo juegan los jugadores elegidos (repetible): order=nuria/marta/luca/emilie/universidad,
                     build=tronco, policy=casual, carrier=gerard, engage=avoid, grind=2, seekLevel=3, castleFirst=false
  --sin-cuenta-atras Juega sin el fin de la cuenta atrás de la Reina (para ver qué aporta); el informe va a output/reports/game-sin-cuenta-atras/
  --json             Solo JSON por la salida estándar
  --trace            (play) Cada paso de la ruta y cada paseo con perseguidores

Los bots no son personas: el tiempo es una estimación (andar por las cuadrículas reales, leer cada línea,
el reloj de cada combate) y sirve para comparar, no para prometer cuánto dura el juego.
`;

function parse(args) {
  const options = { command: args[0] && !args[0].startsWith('--') ? args.shift() : 'report' };
  for (let i = 0; i < args.length; i++) {
    const flag = args[i], value = args[i + 1];
    if (flag === '--player') { options.players = value.split(','); i++; }
    else if (flag === '--runs') { options.runs = Number(value); i++; }
    else if (flag === '--seed') { options.seed = Number(value); i++; }
    else if (flag === '--workers') { options.workers = Number(value); i++; }
    else if (flag === '--tune') {
      const [path, list] = (value ?? '').split('='), values = (list ?? '').split(':').map(Number);
      if (!path || !list || values.some(n => !Number.isFinite(n))) throw new Error(`--tune necesita algo como growth.rules.pct=0:.12:.24, no "${value}"`);
      (options.tune ??= {})[path] = values; i++;
    } else if (flag === '--set') {
      const [field, text] = (value ?? '').split('=');
      if (!field || text === undefined || !(field in PLAYERS.pensando)) throw new Error(`--set necesita campo=valor con un campo de jugador (${Object.keys(PLAYERS.pensando).join(', ')}), no "${value}"`);
      const now = PLAYERS.pensando[field];
      (options.set ??= {})[field] = Array.isArray(now) ? text.split('/') : typeof now === 'number' ? Number(text) : typeof now === 'boolean' ? text === 'true' : text; i++;
    } else if (flag === '--json') options.json = true;
    else if (flag === '--sin-cuenta-atras') options.noDoom = true;
    else if (flag === '--trace') options.trace = true;
    else if (flag === '--help' || flag === '-h') options.command = 'help';
    else throw new Error(`Opción desconocida: ${flag}. Usa --help.`);
  }
  for (const id of options.players ?? []) if (!PLAYERS[id]) throw new Error(`Jugador desconocido: ${id}. Usa ${Object.keys(PLAYERS).join(', ')}.`);
  return options;
}

/** Every game asked for, shared among worker threads. */
async function playMany(players, runs, seed, workers, rules = { doom: true }, tuning = {}, set = {}) {
  const jobs = players.flatMap(player => Array.from({ length: runs }, (_, i) => [{ ...PLAYERS[player], ...set }, seed + i, rules, tuning]));
  const count = Math.max(1, Math.min(workers, jobs.length));
  const shares = Array.from({ length: count }, (_, w) => jobs.filter((_, i) => i % count === w));
  const results = await Promise.all(shares.map(share => new Promise((done, fail) => {
    const worker = new Worker(new URL(import.meta.url), { workerData: { jobs: share }, execArgv: ['--experimental-strip-types', '--no-warnings'] });
    worker.once('message', done); worker.once('error', fail);
  })));
  return results.flat();
}

const minutes = value => value === null || value === undefined ? '–' : `${Math.round(value)} min`;
const percent = value => value === null || value === undefined ? '–' : `${Math.round(value * 100)} %`;
const cell = (text, width) => String(text ?? '–').padEnd(width);
const r2 = value => Number(value.toFixed(2));

function lines(summary) {
  const out = [];
  for (const p of summary.players) {
    out.push(`\n${p.name} (${p.id}, ${p.policy}) · ${p.runs} partidas · terminan ${percent(p.finished)}${Object.keys(p.reasons).length ? ` (${Object.entries(p.reasons).map(([r, n]) => `${r}: ${n}`).join('; ')})` : ''}`);
    out.push(`  Duración: mediana ${minutes(p.minutes.p50)} (p10 ${minutes(p.minutes.p10)}, p90 ${minutes(p.minutes.p90)}) · días ${p.days.mean} (máx. ${p.days.max}) · rebobinados ${p.rewinds.mean} (máx. ${p.rewinds.max})`);
    out.push(`  Combates ${p.fights} (${p.losses} perdidos) · ${Object.entries(p.time).map(([k, v]) => `${TIME_KINDS[k].toLowerCase()} ${minutes(v)}`).join(', ')}`);
    out.push(`  Niveles: ${p.levels.map(l => `${l.anima} ${l.level} en el ${percent(l.at)} (min ${l.minute ?? '–'}, ${percent(l.reached)} de partidas)`).join(' · ')} · EXP perdida en el tope: ${p.wasted}`);
    out.push(`  Al acabar: ${p.grown.five} de ${Object.keys(p.grown.level).length} ánimas compartidas en nivel 5 o más (${p.grown.seven} en el 7) · ${Object.entries(p.grown.level).map(([id, n]) => `${id} ${n}`).join(' · ')}`);
    out.push(`  EXP por tramo: ${p.stretches.map(s => `${s.stage} ${s.xp} (${s.fights} combates)`).join(' · ')}`);
    out.push(`  Se satura: ${p.saturation ? `desde el ${percent(p.saturation.at)} de la partida (min ${p.saturation.minute})` : 'no'}`);
    out.push(`  ${cell('combate', 20)}${cell('tramo', 24)}${cell('veces', 7)}${cell('1.ª', 7)}${cell('gana', 7)}${cell('intentos', 9)}${cell('PV', 7)}${cell('rondas', 7)}${cell('trivial', 9)}llega con`);
    for (const e of p.encounters) out.push(`  ${cell(e.encounter, 20)}${cell(e.stage, 24)}${cell(e.met, 7)}${cell(percent(e.firstWin), 7)}${cell(percent(e.win), 7)}${cell(e.tries ?? '–', 9)}${cell(percent(e.hpLeft), 7)}${cell(e.rounds ?? '–', 7)}${cell(percent(e.trivial), 9)}${cell(`${Object.entries(e.levels).map(([id, n]) => `${id.slice(0, 4)} ${n}`).join(' ') || '–'} · ${e.friends ?? 0} amigos`, 28)}${e.taken ? `  ← toma a Aitor en el ${percent(e.taken)}` : p.walls.includes(e.encounter) ? '  ← muro' : ''}`);
  }
  if (summary.gaps.length) out.push(`\nLo que el juego aún no tiene y se ha puenteado:\n${summary.gaps.map(g => `- ${g.text} (${g.games} partidas)`).join('\n')}`);
  return out;
}

async function main(args) {
  let options;
  try { options = parse(args); } catch (error) { console.error(error.message); return 2; }
  const say = text => { if (!options.json) console.log(text); };
  if (options.command === 'help') { console.log(HELP); return 0; }
  if (options.command === 'list') { process.stdout.write(`${JSON.stringify({ version: GAME_SIM_VERSION, players: PLAYERS, time: TIME_KINDS }, null, 2)}\n`); return 0; }
  const players = options.players ?? Object.keys(PLAYERS), seed = options.seed ?? 35;
  if (options.command === 'play') {
    const playing = new Playing(PLAYERS[players[0]], seed);
    if (options.trace) playing.trace = line => console.log(line);
    const game = playing.playAll();
    if (options.json) { process.stdout.write(`${JSON.stringify(game, null, 1)}\n`); return 0; }
    say(`${game.player} · semilla ${seed}: ${game.reason} · ${minutes(game.seconds / 60)} · días ${game.days} · rebobinados ${game.rewinds} · ${game.fights.length} combates (${game.fights.filter(f => !f.won).length} perdidos)`);
    for (const f of game.fights) say(`  ${cell(`#${f.n}`, 5)}${cell(`${Math.round(f.t / 60)} min`, 9)}${cell(f.day ? `día ${f.day} ${f.hour} h` : '', 12)}${cell(f.stage, 24)}${cell(f.encounter, 20)}${f.won ? 'gana  ' : 'PIERDE'} ${cell(`${f.rounds} r`, 5)} PV ${percent(f.hpLeft)}  ${f.worn.join('+')}${f.learnt ? ' (aprendido)' : ''}`);
    for (const m of game.moments.filter(m => m.kind !== 'flag')) say(`  ${cell(`${Math.round(m.t / 60)} min`, 9)}${m.kind}: ${m.label}`);
    return 0;
  }
  if (options.command !== 'run' && options.command !== 'report') { console.error(`Orden desconocida: ${options.command}. Usa --help.`); return 2; }
  const runs = options.runs ?? 24, started = Date.now();
  const rules = { doom: !options.noDoom };
  const workers = options.workers ?? Math.max(1, availableParallelism() - 1);
  const tried = Object.entries(options.tune ?? {}).reduce((all, [path, values]) => all.flatMap(tuning => values.map(value => ({ ...tuning, [path]: value }))), [{}]);
  if (tried.length > 1) {
    // Several numbers to try: the same games with each, side by side. No page: it compares, it does not report.
    const rows = [];
    for (const tuning of tried) {
      const label = Object.entries(tuning).map(([path, value]) => `${path}=${value}`).join(' ');
      for (const p of summarise(await playMany(players, runs, seed, workers, rules, tuning, options.set), seed).players) {
        const top = p.levels.filter(l => l.reached >= .5).reduce((best, l) => ({ ...best, [l.anima]: Math.max(best[l.anima] ?? 1, l.level) }), {});
        rows.push({ tuning, label, player: p.id, finished: p.finished, minutes: p.minutes.p50, fights: p.fights, losses: p.losses, rewinds: p.rewinds.mean, walls: p.walls, grown: p.grown, trivial: r2(p.encounters.reduce((sum, e) => sum + e.trivial * e.met, 0) / Math.max(1, p.encounters.reduce((sum, e) => sum + e.met, 0))), levels: top });
      }
    }
    say(`${cell('números', 34)}${cell('jugador', 10)}${cell('terminan', 9)}${cell('mediana', 9)}${cell('combates', 9)}${cell('perdidos', 9)}${cell('rebob.', 7)}${cell('triviales', 10)}${cell('niveles (≥ media)', 36)}${cell('≥5 · 7', 10)}muros`);
    for (const r of rows) say(`${cell(r.label, 34)}${cell(r.player, 10)}${cell(percent(r.finished), 9)}${cell(minutes(r.minutes), 9)}${cell(r.fights, 9)}${cell(r.losses, 9)}${cell(r.rewinds, 7)}${cell(percent(r.trivial), 10)}${cell(Object.entries(r.levels).map(([id, n]) => `${id.slice(0, 4)} ${n}`).join(' ') || '–', 36)}${cell(`${r.grown.five} · ${r.grown.seven}`, 10)}${r.walls.join(', ') || '–'}`);
    say(`\n${tried.length * players.length * runs} partidas en ${Math.round((Date.now() - started) / 1000)} s`);
    if (options.json) process.stdout.write(`${JSON.stringify({ version: GAME_SIM_VERSION, runs, seed, rows })}\n`);
    return 0;
  }
  const games = await playMany(players, runs, seed, workers, rules, tried[0], options.set);
  const summary = { ...summarise(games, seed), made: new Date().toISOString(), seconds: Math.round((Date.now() - started) / 1000), names: ENCOUNTER_NAMES, rules, tuning: tried[0], set: options.set ?? {} };
  if (options.command === 'report') {
    const altered = Object.keys(summary.tuning).length || Object.keys(summary.set).length;
    const folder = resolve(altered ? 'output/reports/game-prueba' : rules.doom ? 'output/reports/game' : 'output/reports/game-sin-cuenta-atras');
    await mkdir(folder, { recursive: true });
    await writeFile(resolve(folder, 'data.json'), `${JSON.stringify(summary)}\n`, 'utf8');
    await writeFile(resolve(folder, 'index.html'), gamePage(summary, ENCOUNTER_NAMES), 'utf8');
    say(lines(summary).join('\n'));
    say(`\n${games.length} partidas en ${summary.seconds} s · Página: ${resolve(folder, 'index.html')}`);
  } else say(lines(summary).join('\n'));
  if (options.json) process.stdout.write(`${JSON.stringify(summary)}\n`);
  return 0;
}

if (!isMainThread) {
  // A worker: plays its share of the games and hands them back.
  const { jobs } = workerData;
  parentPort.postMessage(jobs.map(([player, seed, rules, tuning]) => withTuning(tuning ?? {}, () => playGame(player, seed, rules))));
} else {
  process.exitCode = await main(process.argv.slice(2));
}
