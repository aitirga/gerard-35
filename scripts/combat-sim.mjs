#!/usr/bin/env -S node --experimental-strip-types
/** Reproducible headless entry point; shares the exact engine used by the browser lab. */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { comparePolicies, normalizeConfig, runSimulation } from '../src/combat/simulator.ts';

const HELP = `Laboratorio de combate — contenido mecánico provisional

Uso: node --experimental-strip-types scripts/combat-sim.mjs [opciones]

  --runs N              Combates por política (1–10000; predeterminado: 200)
  --seed N              Semilla inicial uint32 (predeterminado: 3517)
  --policy ID           basic | random | tactical (predeterminado: tactical)
  --enemy-policy ID     Política rival (predeterminado: tactical)
  --enemy-hp N          Multiplicador de PV rivales (0.1–10; predeterminado: 1)
  --enemy-power N       Daño directo de acciones rivales × (0.1–10; predeterminado: 1)
  --max-rounds N        Límite por combate (1–500; predeterminado: 80)
  --compare             Comparar las tres políticas con las mismas semillas
  --encounter FILE      Definición JSON propia; equipo del jugador: "party"
  --out FILE            Guardar informe JSON completo y reproducible
  --help                Mostrar esta ayuda

El primer combate usa exactamente --seed. Para reproducir un resultado,
usa su semilla con --runs 1, las mismas opciones y la misma definición.
Las tasas incluyen empates; el intervalo del 95 % es Wilson para victorias.
Las políticas son heurísticas de prueba, no una medida de dificultad humana.
`;

export function parseArguments(argv) {
  const options = {};
  let out;
  let encounter;
  let compare = false;
  let help = false;
  const flags = {
    '--runs': 'runs', '--seed': 'seed', '--policy': 'policy', '--enemy-policy': 'enemyPolicy',
    '--enemy-hp': 'enemyHp', '--enemy-power': 'enemyPower', '--max-rounds': 'maxRounds',
  };
  for (let i = 0; i < argv.length; i++) {
    const raw = argv[i];
    const equals = raw.indexOf('=');
    const flag = equals < 0 ? raw : raw.slice(0, equals);
    const inline = equals < 0 ? undefined : raw.slice(equals + 1);
    if (flag === '--help' || flag === '--compare') {
      if (inline !== undefined) throw new Error(`${flag} no acepta un valor`);
      if (flag === '--help') help = true;
      else compare = true;
      continue;
    }
    if (!(flag in flags) && flag !== '--out' && flag !== '--encounter') throw new Error(`Opción desconocida: ${flag}`);
    const value = inline ?? argv[++i];
    if (!value || value.startsWith('--')) throw new Error(`Falta el valor de ${flag}`);
    if (flag === '--out') out = resolve(value);
    else if (flag === '--encounter') encounter = resolve(value);
    else options[flags[flag]] = flag.includes('policy') ? value : Number(value);
  }
  return { config: normalizeConfig(options), out, encounter, compare, help };
}

const percent = n => `${(100 * n).toFixed(1)} %`;
function printReport(report) {
  const s = report.summary;
  process.stdout.write(`\n${report.config.policy} contra ${report.config.enemyPolicy} · ${report.runs.length} combates\n`);
  process.stdout.write(`Victorias ${s.wins} (${percent(s.winRate)}) · derrotas ${s.losses} (${percent(s.lossRate)}) · empates ${s.draws} (${percent(s.drawRate)})\n`);
  process.stdout.write(`IC 95 % de victorias: ${percent(s.winRateCI[0])}–${percent(s.winRateCI[1])}\n`);
  process.stdout.write(`Medias: ${s.meanRounds.toFixed(2)} rondas · ${s.meanActions.toFixed(2)} acciones · ${percent(s.meanPartyHpRemaining)} PV del grupo · ${s.meanPartyCasualties.toFixed(2)} bajas · ${s.meanResourceSpent.toFixed(2)} recursos gastados\n`);
  if (s.draws) process.stdout.write(`Motivos de empate: ${JSON.stringify(s.drawReasons)}\n`);
}

export async function main(argv = process.argv.slice(2)) {
  const args = parseArguments(argv);
  if (args.help) { process.stdout.write(HELP); return; }
  const baseline = args.encounter ? JSON.parse(await readFile(args.encounter, 'utf8')) : undefined;
  const report = args.compare ? comparePolicies(args.config, baseline) : runSimulation(args.config, baseline);
  process.stdout.write('Banco de pruebas provisional: estos resultados comparan políticas, no la dificultad humana final.\n');
  for (const item of args.compare ? report.reports : [report]) printReport(item);
  if (args.out) {
    await mkdir(dirname(args.out), { recursive: true });
    await writeFile(args.out, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    process.stdout.write(`\nInforme completo: ${args.out}\n`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(error => {
    process.stderr.write(`Error: ${error instanceof Error ? error.message : String(error)}\nUsa --help para ver las opciones.\n`);
    process.exitCode = 1;
  });
}
