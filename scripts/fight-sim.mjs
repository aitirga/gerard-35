#!/usr/bin/env -S node --experimental-strip-types
/** The campaign's fight simulator from a terminal: see docs/fight-sim.md and src/battle-sim.ts. */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { DUO, MISSION_PARTY, POLICIES, SIM_VERSION, catalogue, checkTargets, conclude, sweep } from '../src/battle-sim.ts';
import { DEFAULT_INTENT, askJev, jevLines, jevRequest } from './fight-sim-jev.mjs';

const HELP = `Simulador de combates de la campaña: las reglas reales del juego, sin pantalla.

  just fight-sim list                     Qué se puede simular, en JSON (combates, habilidades, políticas, objetivos)
  just fight-sim check                    Comprueba que los combates siguen siendo lo que deben ser; sale con 1 si no
  just fight-sim run [opciones]           Prueba todas las combinaciones de las listas dadas

Opciones de run (cada una acepta una lista separada por comas: se prueban todas las combinaciones):
  --fight a,b        Combates (por defecto, las tres cebollas: crias-1,cebolla,cebollon)
  --party p,q        Equipos: ${MISSION_PARTY} · ${DUO} (los duales) · gerard:papagato · aitor:-
  --level l,m        Niveles: papagato=1,papagato=2. Varios a la vez con /: papagato=2/matemagico=1
  --policy p,q       ${Object.keys(POLICIES).join(', ')} (por defecto casual,smart)
  --ban a,b          Prohíbe una habilidad o un dual, para ver cuánto decide: none,zarpazos,duals,punto-debil.
                     Prohibir una habilidad prohíbe sus duales; duals los prohíbe todos. Varias a la vez con /
  --friends a,b      Ánimas de amigos ya conseguidas: none,nuria. Varias a la vez con /
  --tune p=a:b       Prueba números sin tocar el código, también en check; repetible, se combinan:
                     --tune onion.cebollon.layers=10:12 --tune foe.cebollon.pv=120:150 --tune skill.zarpazos.strikes=3:4
                     Libros: onion, foe, brood, skill, dual (dual.zarpazos-de-fuego.power), vertigo (vertigo.boss.pisoton),
                     fear (fear.rules.escortLayers, fear.plato.power)
Opciones de una sola respuesta:
  --animas a,b       Las ánimas que se pueden poner en el combate (por defecto, todas)
  --runs N           Combates por combinación (200)
  --seed N           Semilla: misma semilla, mismos números (35)
  --error X          Probabilidad de despiste por decisión, de 0 a 1 (la de cada política)
  --think S          Segundos que piensa cada jugador: el fuego arde mientras (3)
  --max-rounds N     Rondas hasta dar el combate por empate (60)
Salida:
  --json             Solo JSON por la salida estándar, para leerlo desde otro programa
  --out FICHERO      Guarda además el informe completo en JSON
Opinión de Jev, solo si se pide (necesita TYPESAFE_API_KEY en .env):
  --jev              Al final, pregunta a Jev si los resultados encajan con la intención
  --jev-dry-run      Enseña la petición exacta a Jev sin enviar nada
  --intent TEXTO     Lo que deberían ser estos combates, para Jev

Los bots no son personas: sirven para comparar combinaciones, no para medir cómo se siente un combate.
`;
const LISTS = { '--fight': 'fights', '--party': 'parties', '--level': 'levels', '--policy': 'policies', '--ban': 'bans', '--friends': 'friends', '--animas': 'animas' };
const NUMBERS = { '--runs': 'runs', '--seed': 'seed', '--error': 'error', '--think': 'think', '--max-rounds': 'maxRounds' };
const FLAGS = { '--json': 'json', '--jev': 'jev', '--jev-dry-run': 'jevDryRun', '--help': 'help' };

/** Words to options; anything unknown is an error, so a typo never reads as a result. */
export function parseArguments(argv) {
  const [first, ...rest] = argv, command = first && !first.startsWith('--') ? first : 'run';
  const words = first && !first.startsWith('--') ? rest : argv, options = { command };
  for (let i = 0; i < words.length; i++) {
    const [flag, inline] = words[i].includes('=') && words[i].startsWith('--') ? [words[i].slice(0, words[i].indexOf('=')), words[i].slice(words[i].indexOf('=') + 1)] : [words[i], undefined];
    if (flag in FLAGS) { options[FLAGS[flag]] = true; continue; }
    // A --tune's own "=" is part of its value: "--tune=onion.cebollon.layers=10" and "--tune onion.cebollon.layers=10" alike.
    if (flag === '--tune') {
      const value = inline ?? words[++i], [path, list] = (value ?? '').split('='), values = (list ?? '').split(':').map(Number);
      if (!path || !list || values.some(n => !Number.isFinite(n))) throw new Error(`--tune necesita algo como onion.cebollon.layers=10:12, no "${value}"`);
      (options.tune ??= {})[path] = values;
      continue;
    }
    if (!(flag in LISTS || flag in NUMBERS || flag === '--out' || flag === '--intent')) throw new Error(`Opción desconocida: ${flag}`);
    const value = inline ?? words[++i];
    if (value === undefined || value.startsWith('--')) throw new Error(`Falta el valor de ${flag}`);
    if (flag in LISTS) options[LISTS[flag]] = value.split(',');
    else if (flag in NUMBERS) { options[NUMBERS[flag]] = Number(value); if (!Number.isFinite(options[NUMBERS[flag]])) throw new Error(`${flag} necesita un número`); }
    else options[flag.slice(2)] = value;
  }
  return options;
}
const levelsOf = text => Object.fromEntries(text.split('/').map(pair => { const [id, n] = pair.split('='); return [id, Number(n)]; }));
const listOf = text => text === 'none' ? [] : text.split('/');
/** Every combination of the numbers asked for with --tune. */
export function tunings(tune = {}) {
  return Object.entries(tune).reduce((all, [path, values]) => all.flatMap(tuning => values.map(value => ({ ...tuning, [path]: value }))), [{}]);
}
const tuningLabel = tuning => Object.entries(tuning).map(([path, value]) => `${path}=${value}`).join(' ');
const percent = share => `${Math.round(share * 100)} %`.padStart(5);
const cell = (value, width) => String(value ?? '–').padEnd(width);
function table(rows) {
  const lines = [`${cell('combate', 12)}${cell('equipo', 36)}${cell('niveles', 14)}${cell('sin', 12)}${cell('bot', 7)}gana  (IC 95 %)     rondas  al ganar  al perder  PV al ganar  caen  duales  capas fuera  más usado`];
  const tuned = rows.some(row => Object.keys(row.tuning).length);
  for (const row of rows) {
    const levels = Object.entries(row.levels).map(([id, n]) => `${id.slice(0, 4)} ${n}`).join(' ') || '–';
    const ci = `${Math.round(row.winCI[0] * 100)}–${Math.round(row.winCI[1] * 100)} %`;
    const top = Object.entries(row.used).slice(0, 3).map(([id, n]) => `${id} ${n}`).join(', ');
    lines.push(`${cell(row.fight, 12)}${cell(row.party, 36)}${cell(levels, 14)}${cell(row.ban.join('/') || '–', 12)}${cell(row.policy, 7)}${percent(row.win)} ${cell(ci, 13)}${cell(row.rounds, 8)}${cell(row.roundsWon, 10)}${cell(row.roundsLost, 11)}${cell(row.hpLeftWon === null ? null : `${Math.round(row.hpLeftWon * 100)} %`, 13)}${cell(row.kos, 6)}${cell(row.duals || null, 8)}${cell(row.peeledBy === null ? null : `r${row.peeledBy} (${Math.round(row.peeledRate * 100)} %)`, 13)}${top}${tuned ? `  [${tuningLabel(row.tuning)}]` : ''}`);
  }
  return lines;
}
async function jevStep(options, report, say) {
  const intent = options.intent ?? DEFAULT_INTENT, model = process.env.JEV_MODEL || 'jev-latest';
  if (options.jevDryRun) { report.jevRequest = jevRequest(report, { intent, model }); say(`\nPetición a Jev (no se ha enviado):\n${JSON.stringify(report.jevRequest, null, 2)}`); }
  if (options.jev) { report.jev = await askJev(report, { apiKey: process.env.TYPESAFE_API_KEY, intent, model }); say(`\n${jevLines(report.jev).join('\n')}`); }
}
export async function main(argv = process.argv.slice(2)) {
  const options = parseArguments(argv);
  // With --json nothing but the JSON goes to the standard output.
  const say = text => { if (!options.json) process.stdout.write(`${text}\n`); };
  if (options.help || options.command === 'help') { process.stdout.write(HELP); return 0; }
  if (options.command === 'list') { process.stdout.write(`${JSON.stringify(catalogue(), null, 2)}\n`); return 0; }
  const shared = { runs: options.runs ?? 200, seed: options.seed ?? 35 };
  let report, failed = false;
  if (options.command === 'check') {
    // Several numbers to try: which combination holds up best, the best last.
    const tried = tunings(options.tune);
    if (tried.length > 1) {
      const results = tried.map(tuning => { const targets = checkTargets(undefined, shared.runs, shared.seed, tuning); return { tuning, passed: targets.filter(t => t.pass).length, of: targets.length, failing: targets.filter(t => !t.pass).map(t => ({ id: t.id, failures: t.failures })) }; }).sort((a, b) => a.passed - b.passed);
      for (const r of results) say(`${String(r.passed).padStart(2)}/${r.of}  ${tuningLabel(r.tuning)}${r.failing.length ? `\n       falla: ${r.failing.map(f => f.id).join(', ')}` : ''}`);
      report = { version: SIM_VERSION, ...shared, tunings: results };
      await jevStep(options, report, say);
      if (options.out) { await mkdir(dirname(resolve(options.out)), { recursive: true }); await writeFile(resolve(options.out), `${JSON.stringify(report, null, 2)}\n`, 'utf8'); }
      if (options.json) process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
      return 0;
    }
    const targets = checkTargets(undefined, shared.runs, shared.seed, tried[0]);
    failed = targets.some(t => !t.pass);
    report = { version: SIM_VERSION, ...shared, pass: !failed, targets };
    for (const t of targets) say(`${t.pass ? 'ok  ' : 'MAL '} ${t.id.padEnd(30)} gana ${percent(t.row.win)}${t.row.roundsLost === null ? '' : `, pierde en ${t.row.roundsLost} rondas`}${t.row.hpLeftWon === null ? '' : `, gana con ${Math.round(t.row.hpLeftWon * 100)} % de PV en ${t.row.roundsWon} rondas`}${t.row.duals ? `, ${t.row.duals} duales` : ''}${t.pass ? '' : `\n     ${t.failures.join('; ')}\n     Debería: ${t.why}`}`);
    say(failed ? '\nHay combates que no son lo que deberían.' : '\nTodos los combates son lo que deberían.');
  } else if (options.command === 'run') {
    const rows = sweep({
      fights: options.fights ?? ['crias-1', 'cebolla', 'cebollon'],
      parties: options.parties ?? [MISSION_PARTY],
      levels: (options.levels ?? ['papagato=1', 'papagato=2', 'papagato=3']).map(levelsOf),
      policies: options.policies ?? ['casual', 'smart'],
      bans: (options.bans ?? ['none']).map(listOf),
      friends: (options.friends ?? ['none']).map(listOf),
      tunings: tunings(options.tune),
    }, { ...shared, error: options.error, think: options.think, maxRounds: options.maxRounds, animas: options.animas });
    const conclusions = conclude(rows);
    report = { version: SIM_VERSION, ...shared, rows, conclusions };
    say(table(rows).join('\n'));
    if (conclusions.length) say(`\nConclusiones:\n${conclusions.map(line => `- ${line}`).join('\n')}`);
  } else throw new Error(`Orden desconocida: ${options.command}. Usa run, check, list o help.`);
  await jevStep(options, report, say);
  if (options.out) {
    await mkdir(dirname(resolve(options.out)), { recursive: true });
    await writeFile(resolve(options.out), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    say(`\nInforme completo: ${resolve(options.out)}`);
  }
  if (options.json) process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  return failed ? 1 : 0;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().then(code => { process.exitCode = code; }).catch(error => {
    process.stderr.write(`Error: ${error instanceof Error ? error.message : String(error)}\nUsa --help para ver las opciones.\n`);
    process.exitCode = 2;
  });
}
