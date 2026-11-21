#!/usr/bin/env -S node --experimental-strip-types
/** The campaign's fight simulator from a terminal: see docs/fight-sim.md and src/battle-sim.ts. */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { BUILDS, CASTLE_STAGE_IDS, DUO, MISSIONS, MISSION_IDS, MISSION_PARTY, POLICIES, SIM_VERSION, STRETCHES, STRETCH_IDS, TARGETS, TECH, catalogue, conclude, fullKit, judge, storyJobs, storyPoint, sweepSetups, targetSetup, tunables, withTuning } from '../src/battle-sim.ts';
import { coverage, levers, optimize, pairGoals, progressLines, readsOf, skillReport, targetGoals, variable } from '../src/balance.ts';
import { createPool } from './fight-sim-pool.mjs';
import { DEFAULT_INTENT, askJev, jevLines, jevRequest } from './fight-sim-jev.mjs';
import { balanceData, balancePage } from './fight-sim-report.mjs';

const HELP = `Simulador de combates de la campaña: las reglas reales del juego, sin pantalla.

  just fight-sim list                     Qué se puede simular, en JSON (combates, habilidades, políticas, objetivos)
  just fight-sim check                    Comprueba que los combates siguen siendo lo que deben ser; sale con 1 si no
  just fight-sim run [opciones]           Prueba todas las combinaciones de las listas dadas
  just fight-sim story [opciones]         Cada combate con el equipo que llega a él según la historia
  just fight-sim report [opciones]        La página de balance: todo lo anterior junto, en output/reports/balance/index.html
                                          --build, --party, --runs (120), --seed, --tune (un valor por número) y
                                          --baseline, que la guarda además como referencia con la que comparar las siguientes

El banco de balance (docs/fight-sim.md § The balance bench):
  just fight-sim levers --fight voz       Qué números mueven un combate y hacia dónde: cada número que el combate lee,
                                          un quinto arriba y abajo. --scope fight (lo suyo) · party (habilidades, ánimas) · all
  just fight-sim optimize --fight voz --auto 4
                                          Busca los números que dejan los objetivos de esos combates donde deben estar, sin
                                          tocar el código. Con --vary libro.id.campo=min..max[/paso] (repetible) se eligen a mano
  just fight-sim skills                   Qué vale cada habilidad: usos, daño, PV por maná y qué pasa sin ella (con todo abierto)
  just fight-sim progress                 Si el crecimiento del equipo acompaña a la historia: cada punto con lo que suma
                                          cada ánima de amigo a 0, como está y al doble (o los --tune que se den)
  just fight-sim coverage                 Lo que la pasada final aún no sujeta: combates sin pareja, habilidades y ánimas que
                                          ningún objetivo juega, números que ningún objetivo lee

Qué se mide en levers y optimize (una de tres):
  --fight a,b        Los objetivos de esos combates (por defecto en optimize: los de los combates que leen los números elegidos)
  --target a,b       Esos objetivos, por su id
  --pairs            Las parejas de la historia en vez de los objetivos: pensando gana ≥ 90 %, sin pensar ≤ 20 %,
                     en cada punto de --at y --build (con --fight, solo esos combates)
Opciones de optimize:
  --vary p=a..b/s    Un número que la búsqueda puede mover, entre a y b, de s en s; sin rango, un 40 % a cada lado
  --auto N           Sin --vary: los N números propios del combate que más lo mueven (los busca con levers)
  --budget N         Cuántos juegos de números puede probar (60) · --keep X: cuánto pesa cambiar poco (0.1)
  --runs N           Combates por fila mientras busca (80) · --check-runs N: al comprobar con otra semilla (200)
Opciones de levers: --scope · --delta X (0.2: un quinto) · --top N (las 25 primeras) · --vary p (solo esos números)
Opciones de skills: --fight (los jefes; all: todos los que preguntan algo), --party, --level, --improved, --friends como
                     en run (por defecto, todo abierto: niveles al tope, el tarro entero, todas las ánimas) · --anima a,b
                     --story: cada combate con lo que la historia ha dado al acabar su tramo (--build), no con todo

Opciones de story (listas separadas por comas):
  --at a,b           Puntos de la historia: nuria (la introducción) · marta:first (solo la introducción detrás) ·
                     marta:last (todas las demás detrás) · marta:universidad (las hechas, con /).
                     Por defecto, cada misión abierta como primera y como última. Misiones: ${MISSION_IDS.join(', ')}
  --build a,b        En qué se gastan los ecos: ${Object.keys(BUILDS).join(', ')} (por defecto nada,mixto)
  --fight a,b        Solo estos combates (por defecto, todos los de cada misión)
  --party p          El equipo de partida (${DUO}); las ánimas, amigos, ecos y nivel los pone el punto
  --policy p,q       Por defecto casual,smart

Opciones de run (cada una acepta una lista separada por comas: se prueban todas las combinaciones):
  --fight a,b        Combates (por defecto, las tres cebollas: crias-1,cebolla,cebollon)
  --party p,q        Equipos: ${MISSION_PARTY} · ${DUO} (los duales) · gerard:papagato · aitor:-
                     Tras una /, a qué más puede cambiar cada uno en el combate: gerard:matemagico/papagato+aitor:tecnopata/dadaista
  --level l,m        Niveles: papagato=1,papagato=2. Varios a la vez con /: papagato=2/matemagico=1
  --policy p,q       ${Object.keys(POLICIES).join(', ')} (por defecto casual,smart)
  --ban a,b          Prohíbe una habilidad o un dual, para ver cuánto decide: none,zarpazos,duals,punto-debil.
                     Prohibir una habilidad prohíbe sus duales; duals los prohíbe todos. Varias a la vez con /
  --friends a,b      Ánimas de amigos ya conseguidas: none,nuria. Varias a la vez con /
  --tune p=a:b       Prueba números sin tocar el código, también en check; repetible, se combinan:
                     --tune onion.cebollon.layers=10:12 --tune foe.cebollon.pv=120:150 --tune skill.zarpazos.strikes=3:4
                     Libros: onion, foe, brood, skill, dual (dual.zarpazos-de-fuego.power), vertigo (vertigo.boss.pisoton),
                     fear (fear.rules.escortLayers, fear.plato.power), las reglas de cada misión (camping, marta, modelo,
                     luca, castle, sobremesa, night), reaction, element, powder, crit, y la progresión: class (lo que suma
                     llevar un ánima), anima y growth (lo que suma cada ánima de amigo), level y xp (la EXP), stage (los
                     topes del castillo), foes (cuánto crecen los enemigos de una misión abierta con las ánimas de las otras).
                     just fight-sim levers --fight X dice cuáles lee un combate
Opciones de una sola respuesta:
  --animas a,b       Las ánimas que se pueden poner en el combate (por defecto, todas)
  --runs N           Combates por combinación (200)
  --seed N           Semilla: misma semilla, mismos números (35)
  --error X          Probabilidad de despiste por decisión, de 0 a 1 (la de cada política)
  --think S          Segundos que piensa cada jugador: el fuego arde mientras (3)
  --max-rounds N     Rondas hasta dar el combate por empate (60)
  --workers N        Hilos entre los que se reparten los combates (los núcleos menos uno)
Salida:
  --json             Solo JSON por la salida estándar, para leerlo desde otro programa
  --out FICHERO      Guarda además el informe completo en JSON
Opinión de Jev, solo si se pide (necesita TYPESAFE_API_KEY en .env):
  --jev              Al final, pregunta a Jev si los resultados encajan con la intención
  --jev-dry-run      Enseña la petición exacta a Jev sin enviar nada
  --intent TEXTO     Lo que deberían ser estos combates, para Jev

Los bots no son personas: sirven para comparar combinaciones, no para medir cómo se siente un combate.
`;
const LISTS = { '--at': 'at', '--build': 'builds', '--fight': 'fights', '--party': 'parties', '--level': 'levels', '--policy': 'policies', '--ban': 'bans', '--friends': 'friends', '--animas': 'animas', '--improved': 'improved', '--target': 'targets', '--anima': 'only' };
const NUMBERS = { '--runs': 'runs', '--seed': 'seed', '--error': 'error', '--think': 'think', '--max-rounds': 'maxRounds', '--workers': 'workers', '--budget': 'budget', '--keep': 'keep', '--check-runs': 'checkRuns', '--auto': 'auto', '--delta': 'delta', '--top': 'top' };
const FLAGS = { '--baseline': 'baseline', '--json': 'json', '--jev': 'jev', '--jev-dry-run': 'jevDryRun', '--help': 'help', '--pairs': 'pairs', '--story': 'story' };

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
    // A number the search may move: "--vary foe.voz.pv=500..800/20", or only its path for 40 % either side.
    if (flag === '--vary') {
      const value = inline ?? words[++i], [path, spec] = (value ?? '').split('=');
      if (!path || path.startsWith('--')) throw new Error('--vary necesita algo como foe.voz.pv=500..800');
      (options.vary ??= {})[path] = spec;
      continue;
    }
    if (!(flag in LISTS || flag in NUMBERS || flag === '--out' || flag === '--intent' || flag === '--scope')) throw new Error(`Opción desconocida: ${flag}`);
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
    lines.push(`${cell(row.fight, 12)}${cell(row.party, 36)}${cell(levels, 14)}${cell(row.ban.join('/') || '–', 12)}${cell(row.policy, 7)}${percent(row.win)} ${cell(ci, 13)}${cell(row.rounds, 8)}${cell(row.roundsWon, 10)}${cell(row.roundsLost, 11)}${cell(row.hpLeftWon === null ? null : `${Math.round(row.hpLeftWon * 100)} %`, 13)}${cell(row.kos, 6)}${cell(row.duals || null, 8)}${cell(row.peeledBy === null ? null : `r${row.peeledBy} (${Math.round(row.peeledRate * 100)} %)`, 13)}${top}${row.improved.length ? `  {${row.improved.join(' ')}}` : ''}${tuned ? `  [${tuningLabel(row.tuning)}]` : ''}`);
  }
  return lines;
}
async function jevStep(options, report, say) {
  const intent = options.intent ?? DEFAULT_INTENT, model = process.env.JEV_MODEL || 'jev-latest';
  if (options.jevDryRun) { report.jevRequest = jevRequest(report, { intent, model }); say(`\nPetición a Jev (no se ha enviado):\n${JSON.stringify(report.jevRequest, null, 2)}`); }
  if (options.jev) { report.jev = await askJev(report, { apiKey: process.env.TYPESAFE_API_KEY, intent, model }); say(`\n${jevLines(report.jev).join('\n')}`); }
}
const signed = (n, places = 0) => n === null || n === undefined ? '–' : `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n).toFixed(places)}`;
const points100 = share => share === null || share === undefined ? '–' : signed(Math.round(share * 100));
const FLAG_WORDS = { unused: 'no se usa', decides: 'decide', dominates: 'domina', idle: 'quitarla no cambia nada', cheap: 'barata', dear: 'cara' };
/** The story points asked for (every open mission first and last, and the castle's three), under the numbers tried: a level's EXP moves the levels. */
function pointsFrom(options, tuning = {}, builds = ['nada', 'mixto']) {
  const open = MISSION_IDS.filter(id => !MISSIONS[id].intro), levels = options.levels ? levelsOf(options.levels[0]) : undefined;
  return withTuning(tuning, () => (options.at ?? [...open.flatMap(id => [`${id}:first`, `${id}:last`]), ...CASTLE_STAGE_IDS]).flatMap(at => (options.builds ?? builds).map(build => storyPoint(at, build, levels))));
}
/** What levers and optimize measure: the story's pairs, the targets named, or those of the fights named. */
function goalsFrom(options, tuning = {}) {
  if (options.pairs) return pairGoals(pointsFrom(options, tuning, ['mixto']), { fights: options.fights, party: options.parties?.[0] });
  if (options.targets) return targetGoals(options.targets.map(id => TARGETS.find(t => t.id === id) ?? (() => { throw new Error(`Objetivo desconocido: ${id}. Están en just fight-sim list.`); })()));
  if (options.fights) {
    const mine = TARGETS.filter(t => options.fights.includes(t.fight) || options.fights.includes(t.fight.split(':')[0]));
    if (!mine.length) throw new Error(`Ningún objetivo juega ${options.fights.join(', ')}: usa --pairs, o añade su pareja a TARGETS (just fight-sim coverage).`);
    return targetGoals(mine);
  }
  return undefined;
}
export async function main(argv = process.argv.slice(2)) {
  const options = parseArguments(argv);
  const pool = createPool(options.workers);
  try { return await command(options, pool.play); } finally { await pool.close(); }
}
async function command(options, play) {
  // With --json nothing but the JSON goes to the standard output.
  const say = text => { if (!options.json) process.stdout.write(`${text}\n`); };
  if (options.help || options.command === 'help') { process.stdout.write(HELP); return 0; }
  if (options.command === 'list') { process.stdout.write(`${JSON.stringify(catalogue(), null, 2)}\n`); return 0; }
  const shared = { runs: options.runs ?? 200, seed: options.seed ?? 35 };
  const job = (setup, tuning = {}) => ({ setup, runs: shared.runs, seed: shared.seed, tuning });
  let report, failed = false;
  if (options.command === 'check') {
    // Several numbers to try: which combination holds up best, the best last.
    const tried = tunings(options.tune), setups = TARGETS.map(targetSetup);
    const rows = await play(tried.flatMap(tuning => setups.map(setup => job(setup, tuning))));
    const judged = tried.map((_, n) => TARGETS.map((target, i) => judge(target, rows[n * TARGETS.length + i])));
    if (tried.length > 1) {
      const results = tried.map((tuning, n) => ({ tuning, passed: judged[n].filter(t => t.pass).length, of: judged[n].length, failing: judged[n].filter(t => !t.pass).map(t => ({ id: t.id, failures: t.failures })) })).sort((a, b) => a.passed - b.passed);
      for (const r of results) say(`${String(r.passed).padStart(2)}/${r.of}  ${tuningLabel(r.tuning)}${r.failing.length ? `\n       falla: ${r.failing.map(f => f.id).join(', ')}` : ''}`);
      report = { version: SIM_VERSION, ...shared, tunings: results };
      await jevStep(options, report, say);
      if (options.out) { await mkdir(dirname(resolve(options.out)), { recursive: true }); await writeFile(resolve(options.out), `${JSON.stringify(report, null, 2)}\n`, 'utf8'); }
      if (options.json) process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
      return 0;
    }
    const targets = judged[0];
    failed = targets.some(t => !t.pass);
    report = { version: SIM_VERSION, ...shared, pass: !failed, targets };
    for (const t of targets) say(`${t.pass ? 'ok  ' : 'MAL '} ${t.id.padEnd(30)} gana ${percent(t.row.win)}${t.row.roundsLost === null ? '' : `, pierde en ${t.row.roundsLost} rondas`}${t.row.hpLeftWon === null ? '' : `, gana con ${Math.round(t.row.hpLeftWon * 100)} % de PV en ${t.row.roundsWon} rondas`}${t.row.duals ? `, ${t.row.duals} duales` : ''}${t.pass ? '' : `\n     ${t.failures.join('; ')}\n     Debería: ${t.why}`}`);
    say(failed ? `\nHay combates que no son lo que deberían: ${targets.filter(t => !t.pass).length} de ${targets.length}.` : '\nTodos los combates son lo que deberían.');
  } else if (options.command === 'run') {
    const setups = sweepSetups({
      fights: options.fights ?? ['crias-1', 'cebolla', 'cebollon'],
      parties: options.parties ?? [MISSION_PARTY],
      levels: (options.levels ?? ['papagato=1', 'papagato=2', 'papagato=3']).map(levelsOf),
      policies: options.policies ?? ['casual', 'smart'],
      bans: (options.bans ?? ['none']).map(listOf),
      friends: (options.friends ?? ['none']).map(listOf),
      improved: (options.improved ?? ['none']).map(listOf),
      tunings: tunings(options.tune),
    }, { error: options.error, think: options.think, maxRounds: options.maxRounds, animas: options.animas });
    const rows = await play(setups.map(({ setup, tuning }) => job(setup, tuning)));
    const conclusions = conclude(rows);
    report = { version: SIM_VERSION, ...shared, rows, conclusions };
    say(table(rows).join('\n'));
    if (conclusions.length) say(`\nConclusiones:\n${conclusions.map(line => `- ${line}`).join('\n')}`);
  } else if (options.command === 'report') {
    const folder = resolve('output/reports/balance'), basePath = resolve(folder, 'baseline.json');
    const data = await balanceData({ runs: options.runs ?? 120, seed: shared.seed, tuning: tunings(options.tune)[0], builds: options.builds, party: options.parties?.[0], label: options.intent, play });
    let baseline = null;
    try { baseline = JSON.parse(await readFile(basePath, 'utf8')); } catch { /* No reference yet. */ }
    await mkdir(folder, { recursive: true });
    if (options.baseline) { await writeFile(basePath, `${JSON.stringify(data)}\n`, 'utf8'); baseline = null; }
    await writeFile(resolve(folder, 'data.json'), `${JSON.stringify(data, null, 1)}\n`, 'utf8');
    await writeFile(resolve(folder, 'index.html'), balancePage(data, baseline), 'utf8');
    const asked = data.cells.filter(c => !c.teaching);
    say(`Parejas que se cumplen: ${asked.filter(c => c.holds).length}/${asked.length} · objetivos: ${data.targets.filter(t => t.pass).length}/${data.targets.length}${options.baseline ? ' · guardada como referencia' : baseline ? ' · comparada con la referencia' : ''}`);
    say(`Página: ${resolve(folder, 'index.html')}`);
    report = data;
    if (options.json) { process.stdout.write(`${JSON.stringify(data)}\n`); } 
    return 0;
  } else if (options.command === 'story') {
    const tuning = tunings(options.tune)[0], points = pointsFrom(options, tuning);
    const jobs = storyJobs(points, options.policies ?? ['casual', 'smart'], { fights: options.fights, party: options.parties?.[0] });
    const played = await play(jobs.map(j => job(j.setup, tuning))), rows = jobs.map((j, i) => ({ ...j, row: played[i] }));
    report = { version: SIM_VERSION, ...shared, points, rows: rows.map(r => ({ ...r.row, at: r.at, build: r.build, ecos: r.ecos })) };
    say(`${cell('combate', 20)}${cell('punto', 22)}${cell('ecos', 10)}${cell('gasto', 11)}${cell('bot', 8)}gana   PV al ganar  rondas`);
    for (const r of rows) say(`${cell(r.row.fight, 20)}${cell(r.at, 22)}${cell(`${r.spent}/${r.ecos}`, 10)}${cell(r.build, 11)}${cell(r.row.policy, 8)}${percent(r.row.win)}  ${cell(r.row.hpLeftWon === null ? '–' : `${Math.round(r.row.hpLeftWon * 100)} %`, 11)}  ${r.row.roundsWon ?? '–'}`);
    for (const point of points) say(`\n${point.at} · ${point.build}: amigos ${point.setup.friends.join(', ') || 'ninguno'}; ${levelWords(point.setup.levels)}; ${point.ecos} ecos en ${point.setup.improved.join(', ') || 'nada'}`);
  } else if (options.command === 'levers') {
    const base = tunings(options.tune)[0], goals = goalsFrom(options, base);
    if (!goals) throw new Error('levers necesita --fight, --target o --pairs: qué combates mirar.');
    const runs = options.runs ?? 80;
    const found = await levers({ goals, play, runs, seed: shared.seed, delta: options.delta, scope: options.scope ?? 'fight', paths: options.vary ? Object.keys(options.vary) : undefined, base });
    report = { version: SIM_VERSION, runs, seed: shared.seed, goals: goals.map((g, i) => ({ id: g.id, want: g.want, win: found.base[i].win })), levers: found.levers };
    say(`${goals.length} objetivos · ${found.levers.length} números que sus combates leen (${options.scope ?? 'fight'}) · ${runs} combates por fila`);
    say(`\n${cell('número', 38)}${cell('ahora', 8)}${cell('prueba', 14)}${cell('mueve', 8)}${cell('separa', 8)}${cell('pérdida', 22)}lo que más cambia (gana: abajo → ahora → arriba)`);
    for (const l of found.levers.slice(0, options.top ?? 25)) {
      const most = [...l.goals].sort((a, b) => Math.abs(b.win[2] - b.win[0]) - Math.abs(a.win[2] - a.win[0])).slice(0, 2);
      say(`${cell(l.path, 38)}${cell(l.now, 8)}${cell(`${l.low} · ${l.high}`, 14)}${cell(points100(l.swing).replace('+', ''), 8)}${cell(points100(l.apart), 8)}${cell(`${l.loss[0]} → ${l.loss[1]} → ${l.loss[2]}`, 22)}${most.map(g => `${g.id} ${Math.round(g.win[0] * 100)} → ${Math.round(g.win[1] * 100)} → ${Math.round(g.win[2] * 100)} %`).join(' · ')}`);
    }
    if (found.levers.length > (options.top ?? 25)) say(`… y ${found.levers.length - (options.top ?? 25)} más (--top N, o --json para todas).`);
    say('\n«mueve»: lo más que cambian las victorias de un objetivo entre el valor de abajo y el de arriba, en puntos. «separa»: subirlo\naleja (+) o acerca (−) a los que deben ganar de los que no. «pérdida»: lo lejos que quedan sus objetivos de lo que piden (0: cumplen).');
  } else if (options.command === 'optimize') {
    const base = tunings(options.tune)[0], numbers = withTuning(base, tunables), runs = options.runs ?? 80;
    let goals = goalsFrom(options, base), variables = Object.entries(options.vary ?? {}).map(([path, spec]) => variable(path, spec, numbers));
    if (!variables.length) {
      if (!options.auto || !goals) throw new Error('optimize necesita qué mover: --vary libro.id.campo=min..max (repetible), o --auto N con --fight, --target o --pairs.');
      say(`Buscando los ${options.auto} números que más mueven estos combates…`);
      const found = await levers({ goals, play, runs: Math.min(runs, 60), seed: shared.seed, scope: options.scope ?? 'fight', base });
      variables = found.levers.filter(l => l.swing > 0).slice(0, options.auto).map(l => variable(l.path, undefined, numbers));
      if (!variables.length) throw new Error('Ningún número propio de esos combates mueve sus victorias: prueba --scope party o all.');
    }
    if (!goals) {
      // Nothing named: every target whose fight reads one of the numbers, so nothing else is broken on the way.
      const paths = variables.map(v => v.path);
      goals = targetGoals(TARGETS.filter(target => { const read = readsOf(targetSetup(target)); return paths.some(path => read.has(path)); }));
      if (!goals.length) throw new Error(`Ningún objetivo lee ${paths.join(', ')}.`);
    }
    say(`${goals.length} objetivos · ${variables.length} números · hasta ${options.budget ?? 60} pruebas de ${runs} combates por fila`);
    for (const v of variables) say(`  ${cell(v.path, 38)}ahora ${v.now}, entre ${v.min} y ${v.max} de ${v.step} en ${v.step}`);
    say('\nCada paso que mejora (lo que falta para cumplir, y los números):');
    const found = await optimize({ variables, goals, play, base, runs, seed: shared.seed, budget: options.budget, keep: options.keep, checkRuns: options.checkRuns, say });
    const changed = variables.filter((v, i) => found.best.x[i] !== v.now), held = scored => scored.misses.filter(m => m <= 1e-9 || m < .1).length;
    const holds = (scored, i) => judgeGoal(goals[i], scored.rows[i]);
    say(`\n${found.tried} pruebas. Lo que falta para cumplir: ${found.start.missed.toFixed(2)} → ${found.best.missed.toFixed(2)} buscando; con otra semilla y ${found.checked.runs} combates, ${found.checked.start.missed.toFixed(2)} → ${found.checked.best.missed.toFixed(2)}.`);
    say(`\n${cell('número', 38)}${cell('ahora', 10)}propuesto`);
    for (const [i, v] of variables.entries()) say(`${cell(v.path, 38)}${cell(v.now, 10)}${found.best.x[i]}${found.best.x[i] === v.now ? '  (igual)' : ''}`);
    say(`\n${cell('objetivo', 44)}${cell('pide', 14)}${cell('ahora', 16)}con lo propuesto  (comprobado con otra semilla)`);
    for (const [i, goal] of goals.entries()) {
      const was = found.checked.start.rows[i], now = found.checked.best.rows[i], want = goal.want.win ? `${Math.round(goal.want.win[0] * 100)}–${Math.round(goal.want.win[1] * 100)} %` : '–';
      say(`${cell(goal.id, 44)}${cell(want, 14)}${cell(`${percent(was.win).trim()} ${holds(found.checked.start, i) ? 'ok' : 'MAL'}`, 16)}${percent(now.win).trim()} ${holds(found.checked.best, i) ? 'ok' : 'MAL'}${now.roundsWon === null ? '' : ` · ${now.roundsWon} rondas`}${now.hpLeftWon === null ? '' : ` · ${Math.round(now.hpLeftWon * 100)} % de PV`}`);
    }
    const count = scored => goals.filter((_, i) => holds(scored, i)).length;
    say(`\nCumplen ${count(found.checked.start)} → ${count(found.checked.best)} de ${goals.length}.`);
    if (changed.length) say(`\nNada se ha escrito en el código. Para verlo entero: just fight-sim check ${[...Object.entries(base), ...changed.map(v => [v.path, found.best.tuning[v.path]])].map(([path, n]) => `--tune ${path}=${n}`).join(' ')}`);
    else say('\nLos números de ahora son los mejores que ha encontrado en ese rango.');
    report = { version: SIM_VERSION, runs, seed: shared.seed, tried: found.tried, variables, proposed: found.best.tuning, missed: { search: [found.start.missed, found.best.missed], checked: [found.checked.start.missed, found.checked.best.missed] }, goals: goals.map((goal, i) => ({ id: goal.id, want: goal.want, before: found.checked.start.rows[i], after: found.checked.best.rows[i], held: [holds(found.checked.start, i), holds(found.checked.best, i)] })), trail: found.trail };
    void held;
  } else if (options.command === 'skills') {
    const full = fullKit(), tuning = tunings(options.tune)[0], runs = options.runs ?? 60;
    const SHARED = ['papagato', 'dadaista', 'prismatico', 'sincopante', 'freatica'];
    const parties = options.parties ?? [DUO, TECH, ...SHARED.map((id, i) => `gerard:${id}+aitor:${SHARED[(i + 1) % SHARED.length]}`)];
    const asking = STRETCH_IDS.flatMap(id => STRETCHES[id].fights.filter(f => !STRETCHES[id].teaching.includes(f)));
    const fights = !options.fights ? ['uri-vertigo', 'campeon', 'sobremesa', 'voz', 'no-converge', 'fran', 'aurelia', 'direccion', 'delegada-3', 'reina-vuelta'] : options.fights[0] === 'all' ? asking : options.fights;
    // --story: each fight with what the story has given by its stretch's end (its mission done last, or its year of the castle), not everything.
    const kitFor = fight => {
      const stretch = options.story && STRETCH_IDS.find(id => STRETCHES[id].fights.includes(fight));
      if (!stretch) return full;
      return withTuning(tuning, () => storyPoint(stretch in MISSIONS ? MISSIONS[stretch].intro ? stretch : `${stretch}:last` : stretch, options.builds?.[0] ?? 'mixto')).setup;
    };
    const setups = fights.flatMap(fight => parties.flatMap(party => (options.policies ?? ['smart']).map(policy => {
      const kit = kitFor(fight);
      return {
        fight, party, policy, animas: options.animas ?? kit.animas, exact: true,
        levels: options.levels ? levelsOf(options.levels[0]) : kit.levels, improved: options.improved ? listOf(options.improved[0]) : kit.improved, friends: options.friends ? listOf(options.friends[0]) : kit.friends,
      };
    })));
    say(`${setups.length} combinaciones (${fights.length} combates × ${parties.length} equipos, ${options.story ? 'cada uno con lo que la historia ha dado al acabar su tramo' : 'con todo abierto'}), ${runs} combates cada una; y otra vez sin cada habilidad usada…`);
    const found = await skillReport({ setups, play, runs, seed: shared.seed, tuning });
    const lines = found.lines.filter(line => !options.only || options.only.includes(line.anima ?? '-'));
    report = { version: SIM_VERSION, runs, seed: shared.seed, fights, parties, lines, base: found.base.map(row => ({ fight: row.fight, party: row.party, policy: row.policy, win: row.win, roundsWon: row.roundsWon, hpLeftWon: row.hpLeftWon, used: row.used, damageShare: row.damageShare })) };
    say(`\n${cell('habilidad', 24)}${cell('ánima', 12)}${cell('maná', 6)}${cell('usada en', 10)}${cell('usos', 7)}${cell('daño', 7)}${cell('PV/uso', 8)}${cell('PV/maná', 9)}${cell('sin ella: gana', 16)}${cell('rondas', 8)}${cell('PV', 6)}avisos`);
    for (const l of lines) say(`${cell(l.name, 24)}${cell(l.anima ?? (l.kind === 'dual' ? 'dual' : '–'), 12)}${cell(l.cost, 6)}${cell(`${l.usedIn}/${l.known}`, 10)}${cell(l.uses, 7)}${cell(percent(l.share).trim(), 7)}${cell(l.perUse, 8)}${cell(l.perMana, 9)}${cell(l.drop === null ? '–' : `${points100(-l.drop)} (peor ${points100(-l.worst)})`, 16)}${cell(signed(l.rounds, 1), 8)}${cell(points100(l.hp === null ? null : -l.hp), 6)}${l.flags.map(f => FLAG_WORDS[f]).join(', ')}`);
    const deciding = lines.filter(l => l.decides.length);
    if (deciding.length) say(`\nLo que decide combates (sin ello se pierden 30 puntos o más):\n${deciding.map(l => `- ${l.name}: ${l.decides.slice(0, 4).map(d => `${d.fight} con ${d.party} (${points100(-d.drop)})`).join('; ')}${l.decides.length > 4 ? `; y ${l.decides.length - 4} más` : ''}`).join('\n')}`);
    say(`\nCombates de la tabla, con todo: ${found.base.filter(r => r.win >= .99 && (r.hpLeftWon ?? 0) >= .85).length} de ${found.base.length} son triviales (se ganan siempre con más del 85 % de PV) y ${found.base.filter(r => r.win <= .2).length} casi nunca se ganan.`);
    say('«sin ella»: lo que cambian las victorias, las rondas de una victoria y los PV al ganar si se prohíbe, de media donde se usa.\nLos bots no son personas: una habilidad que «no se usa» puede sobrar, o puede que el bot no sepa valorarla (worth, src/battle-sim.ts).');
  } else if (options.command === 'progress') {
    const runs = options.runs ?? 100, tried = options.tune ? tunings(options.tune) : [0, 1, 2].map(scale => ({ 'growth.rules.pct': Math.round(scale * tunables()['growth.rules.pct'] * 1000) / 1000 }));
    const now = tunables(), variants = [];
    for (const tuning of tried) {
      const points = pointsFrom({ ...options, builds: options.builds ?? ['mixto'] }, tuning), jobs = storyJobs(points, ['smart', 'casual'], { fights: options.fights, party: options.parties?.[0] });
      variants.push({ tuning, label: tuningLabel(tuning) || 'como está', same: Object.entries(tuning).every(([path, n]) => now[path] === n), points, jobs });
    }
    const played = await play(variants.flatMap(v => v.jobs.map(j => ({ setup: j.setup, runs, seed: shared.seed, tuning: v.tuning }))));
    let at = 0;
    for (const v of variants) { v.lines = progressLines(v.points, v.jobs, played.slice(at, at + v.jobs.length)); at += v.jobs.length; }
    report = { version: SIM_VERSION, runs, seed: shared.seed, variants: variants.map(v => ({ tuning: v.tuning, current: v.same, lines: v.lines })) };
    for (const v of variants) {
      say(`\n${v.label}${v.same ? '  ← el juego ahora' : ''}`);
      say(`  ${cell('punto', 20)}${cell('amigos', 8)}${cell('niveles', 44)}${cell('parejas', 9)}${cell('pensando', 10)}${cell('PV', 7)}${cell('sin pensar', 12)}no cumplen`);
      for (const l of v.lines) say(`  ${cell(l.at, 20)}${cell(l.friends, 8)}${cell(levelWords(l.levels), 44)}${cell(`${l.held}/${l.pairs}`, 9)}${cell(percent(l.smartWin).trim(), 10)}${cell(l.smartHp === null ? '–' : percent(l.smartHp).trim(), 7)}${cell(percent(l.casualWin).trim(), 12)}${[...l.hard.map(f => `${f} (duro)`), ...l.easy.map(f => `${f} (fácil)`)].join(', ') || '–'}`);
    }
    // What the growth does, in plain words: pairs held, and what going first or last changes.
    const total = v => `${v.lines.reduce((sum, l) => sum + l.held, 0)}/${v.lines.reduce((sum, l) => sum + l.pairs, 0)}`;
    const order = v => {
      const pairs = v.lines.filter(l => l.at.endsWith(':first')).map(first => ({ first, last: v.lines.find(l => l.at === first.at.replace(':first', ':last') && l.build === first.build) })).filter(p => p.last);
      const mean = pick => pairs.length ? pairs.reduce((sum, p) => sum + pick(p), 0) / pairs.length : null;
      return { casual: mean(p => p.last.casualWin - p.first.casualWin), hp: mean(p => (p.last.smartHp ?? 0) - (p.first.smartHp ?? 0)), smart: mean(p => p.last.smartWin - p.first.smartWin) };
    };
    const keys = v => ({ hard: new Set(v.lines.flatMap(l => l.hard.map(f => `${f} en ${l.at}`))), easy: new Set(v.lines.flatMap(l => l.easy.map(f => `${f} en ${l.at}`))) });
    const reference = variants.find(v => v.same) ?? variants[0], ref = keys(reference);
    say('\nConclusiones:');
    for (const v of variants) {
      const o = order(v), mine = keys(v);
      say(`- ${v.label}: cumplen su pareja ${total(v)}. De hacer una misión la primera a hacerla la última, pensando gana ${points100(o.smart)} puntos y acaba con ${points100(o.hp)} de PV; sin pensar gana ${points100(o.casual)}.`);
      if (v !== reference) {
        const list = (set, other) => [...set].filter(k => !other.has(k));
        const harder = list(mine.hard, ref.hard), softer = list(ref.hard, mine.hard), easier = list(mine.easy, ref.easy), firmer = list(ref.easy, mine.easy);
        const few = items => `${items.slice(0, 6).join(', ')}${items.length > 6 ? ` y ${items.length - 6} más` : ''}`;
        if (harder.length) say(`    Frente a «${reference.label}», pensando deja de llegar al 90 % en: ${few(harder)}.`);
        if (softer.length) say(`    Pensando pasa a llegar al 90 % en: ${few(softer)}.`);
        if (easier.length) say(`    Sin pensar pasa del 20 % en: ${few(easier)}.`);
        if (firmer.length) say(`    Sin pensar deja de pasar del 20 % en: ${few(firmer)}.`);
        if (!harder.length && !softer.length && !easier.length && !firmer.length) say(`    Frente a «${reference.label}», ninguna pareja cambia de lado.`);
      }
    }
    say('\nLos niveles de cada punto salen de la EXP que deja cada tramo (STRETCH_XP) y de LEVEL_XP, bajo el tope del castillo;\ncon --level papagato=5/dadaista=4 se ponen a mano. just game-sim dice con qué llega de verdad cada jugador.');
  } else if (options.command === 'coverage') {
    const found = await coverage({ play, runs: options.runs ?? 20, seed: shared.seed });
    report = { version: SIM_VERSION, ...found };
    say(`Combates sin su pareja de objetivos (${found.fights.length}):`);
    for (const f of found.fights) say(`  ${cell(f.fight, 22)}${!f.with.length && !f.without.length ? 'sin ningún objetivo' : !f.with.length ? `falta el que juega su respuesta (sin ella: ${f.without.join(', ')})` : `falta el que juega sin su respuesta (con ella: ${f.with.join(', ')})`}`);
    say(`\nCada ánima, como está:\n  ${cell('ánima', 14)}${cell('habilidades', 13)}${cell('crece hasta', 14)}${cell('definitiva', 12)}${cell('la lleva un objetivo', 22)}habilidades que un objetivo usa`);
    for (const k of found.kits) say(`  ${cell(k.name, 14)}${cell(k.skills, 13)}${cell(k.top === 1 ? 'por el tarro' : k.top, 14)}${cell(k.definitiva ? 'sí' : 'por hacer', 12)}${cell(k.worn ? 'sí' : 'NO', 22)}${k.played}/${k.skills}`);
    say(`\nHabilidades que ningún objetivo usa (${found.skills.length}): ${found.skills.map(s => `${s.name} (${s.anima})`).join(', ') || '–'}`);
    say(`Duales que ningún objetivo hace (${found.duals.length}): ${found.duals.map(d => d.name).join(', ') || '–'}`);
    say(`\nNúmeros que ningún objetivo lee, por libro (${Object.values(found.numbers).flat().length} de ${Object.keys(tunables()).length}):`);
    for (const [book, paths] of Object.entries(found.numbers)) say(`  ${cell(book, 12)}${cell(paths.length, 5)}${paths.slice(0, 6).join(', ')}${paths.length > 6 ? ', …' : ''}`);
    say('\nLo que no sale aquí está sujeto por algún objetivo. Lo que sale, la pasada final no lo nota si se rompe: --json lo da entero.');
  } else throw new Error(`Orden desconocida: ${options.command}. Usa run, check, story, report, levers, optimize, skills, progress, coverage, list o help.`);
  await jevStep(options, report, say);
  if (options.out) {
    await mkdir(dirname(resolve(options.out)), { recursive: true });
    await writeFile(resolve(options.out), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    say(`\nInforme completo: ${resolve(options.out)}`);
  }
  if (options.json) process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  return failed ? 1 : 0;
}
const levelWords = levels => Object.entries(levels ?? {}).map(([id, n]) => `${id} ${n}`).join(', ') || 'nivel 1';
/** Whether a goal's row is inside every range it asks (and ended every fight). */
function judgeGoal(goal, row) {
  if (row.draws) return false;
  return ['win', 'roundsLost', 'hpLeftWon', 'roundsWon', 'duals'].every(key => { const range = goal.want[key], value = row[key]; return !range || value === null || (value >= range[0] && value <= range[1]); });
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().then(code => { process.exitCode = code; }).catch(error => {
    process.stderr.write(`Error: ${error instanceof Error ? error.message : String(error)}\nUsa --help para ver las opciones.\n`);
    process.exitCode = 2;
  });
}
