#!/usr/bin/env node
/**
 * Whether what the game has is wired to everything it must be wired to, read from the game itself
 * and never from a list: its story flags, places, fights, ánimas, people and exports, each against
 * the registries that must know it (docs/dev-tools.md § The progress panel). `just progress --audit`
 * prints it under the progress file's own health.
 *
 *   node --experimental-strip-types scripts/integration.mjs [--json]
 *
 * A section is `broken` when something in the game is missing from where it must be (the run
 * fails: fix it now) or `pending` when it is work still to do (it only lists it).
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, normalize, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = path => readFileSync(join(root, path), 'utf8');
const game = path => import(pathToFileURL(join(root, 'src', path)).href);
const walk = dir => readdirSync(join(root, dir)).flatMap(name => {
  const path = join(dir, name);
  return statSync(join(root, path)).isDirectory() ? walk(path) : [path];
});

const { STORY_FLAGS, Story } = await game('story.ts');
const { flagsAt } = await game('story-points.ts');
const { ENVIRONMENTS } = await game('environments.ts');
const { FIGHTS, TARGETS, MISSIONS } = await game('battle-sim.ts');
const { SKILLS, ANIMA_NAMES } = await game('battle.ts');
const { ANIMAS } = await game('animas.ts');
const { LEVELLED, EMPTY_LEVELS, MANA_LEVEL, topOf, skillsAt } = await game('levels.ts');
const { TREE_ANIMAS } = await game('ecos.ts');
const { foesOfTheGame, modelStatusOf } = await game('bestiary-data.ts');

const sections = [];
const section = (id, title, kind, what, gaps) => sections.push({ id, title, kind, what, gaps });

// ——— The development picker: every flag, place and fight can be jumped to (AGENTS.md) ———
const just = read('justfile'), picker = read('src/jump-menu.ts'), main = read('src/main.ts');
const beats = /dev-chapter beat[\s\S]*?\^\(([^)]*)\)\$/.exec(just)?.[1].split('|') ?? [];
const pickerPlaces = [...picker.matchAll(/^\s*\{ id: '([^']+)', name:/gm)].map(m => m[1]);
const places = Object.keys(ENVIRONMENTS);
const fightIds = [...new Set(FIGHTS.map(fight => fight.split(':')[0]))];
const castleFights = (await game('castle.ts')).CASTLE_ENCOUNTERS;
/** The fight a target measures: one of FIGHTS, or one that takes a parameter (`night-guard:<room>`, src/battle-sim.ts createFight). */
const fightOf = target => FIGHTS.includes(target.fight) ? target.fight : FIGHTS.find(fight => target.fight.startsWith(`${fight}:`));
section('selector', 'Selector de desarrollo', 'broken', 'cada flag, lugar y combate se alcanza desde el selector y el justfile', [
  ...STORY_FLAGS.filter(flag => !beats.includes(flag)).map(flag => `flag «${flag}» falta en la lista de dev-chapter del justfile`),
  ...beats.filter(beat => beat !== 'new' && !STORY_FLAGS.includes(beat)).map(beat => `dev-chapter acepta «${beat}», que no es un flag`),
  ...places.filter(id => !pickerPlaces.includes(id)).map(id => `lugar «${id}» falta en PLACES (src/jump-menu.ts)`),
  ...pickerPlaces.filter(id => !places.includes(id)).map(id => `PLACES ofrece «${id}», que no es un lugar`),
  ...fightIds.filter(id => !castleFights.includes(id) && !picker.includes(`'${id}'`)).map(id => `combate «${id}» falta en el probador (src/jump-menu.ts)`),
  ...TARGETS.filter(target => !fightOf(target)).map(target => `el objetivo «${target.id}» mide «${target.fight}», que no es un combate`),
]);

// ——— Fights: each keeps its pair of targets, with the answer and without it (docs/combat.md) ———
const measured = fight => TARGETS.filter(target => fightOf(target) === fight);
section('combates', 'Combates y su pareja de objetivos', 'pending', 'cada combate tiene dos TARGETS: jugando su respuesta y sin ella', FIGHTS.flatMap(fight => {
  const own = measured(fight), policies = new Set(own.map(target => target.policy));
  if (!own.length) return [`${fight}: sin objetivos`];
  return policies.size < 2 ? [`${fight}: solo ${own.length === 1 ? 'uno' : `la política «${[...policies][0]}»`}`] : [];
}));

// ——— Places: a song of its own (docs/audio.md) ———
const songs = /PLACE_SONGS[^=]*= \{([^}]*)\}/.exec(main)?.[1] ?? '';
// Barcelona's streets play the city's song by the hour (`CITY`), and Las cuerdas Marta's voice (`CUERDAS_PLACE`, src/voz-song.ts).
const city = /const CITY[^=]*= \[([^\]]*)\]/.exec(main)?.[1] ?? '';
const sung = [...songs.matchAll(/'?([\w-]+)'?: '/g), ...city.matchAll(/'([\w-]+)'/g)].map(m => m[1]).concat(main.includes('CUERDAS_PLACE') ? ['cuerdas'] : []);
section('lugares', 'Lugares y su canción', 'pending', 'cada lugar suena a algo (PLACE_SONGS, src/main.ts)',
  places.filter(id => id !== 'patio' && !sung.includes(id)).map(id => `${id}: sin canción`));

// ——— Ánimas: a mission's ánima can be worn, and whatever is worn grows ———
const worn = Object.keys(ANIMA_NAMES);
/** What the party can wear once a mission is done that it could not before, asked of the story itself. */
const before = new Story(flagsAt('metro')).classes;
const wonWith = id => new Story(flagsAt(`anima-${id}`)).classes.filter(classId => !before.includes(classId));
const growth = id => {
  if (TREE_ANIMAS.includes(id)) return [];
  if (!LEVELLED.includes(id)) return [`${ANIMA_NAMES[id]}: ni niveles ni árbol en el bote`];
  const empty = Array.from({ length: topOf(id) - 1 }, (_, i) => i + 2).filter(level => !skillsAt(id, level).length && level !== MANA_LEVEL && !EMPTY_LEVELS[id]?.includes(level));
  return empty.length ? [`${ANIMA_NAMES[id]}: sube a nivel ${empty.join(' y ')} sin aprender nada (sus ${SKILLS.filter(skill => skill.class === id).length} habilidades son de nivel 1)`] : [];
};
section('animas', 'Ánimas', 'pending', 'la ánima de cada misión se puede vestir, y toda ánima vestible crece', [
  ...Object.values(ANIMAS).filter(anima => !wonWith(anima.id).length).map(anima => `misión de ${anima.friend}: da su luz y un bonus de estadísticas, ninguna ánima que vestir`),
  ...worn.flatMap(growth),
]);

// ——— People and foes: a portrait to talk with, a model of their own to fight ———
const speakers = [...read('src/dialogue.ts').matchAll(/^  '?([\w-]+)'?: \{ name: '([^']+)'([^\n]*)$/gm)].map(m => ({ id: m[1], name: m[2], portrait: /portrait: '([^']+)'/.exec(m[3])?.[1] }));
// Provisional whatever the fight draws: the castle's and the guards, on the palace minion (`modelStatusOf`; a fear's own model is built in the browser).
const provisional = [...new Map(foesOfTheGame().filter(foe => /esbirro/.test(modelStatusOf(foe.kind, false).label)).map(foe => [foe.kind, foe])).values()];
section('gente', 'Retratos y modelos', 'pending', 'quien habla tiene retrato; quien pelea, modelo propio (just bestiario)', [
  ...speakers.filter(speaker => !speaker.portrait).map(speaker => `${speaker.name} (${speaker.id}): habla sin retrato`),
  ...speakers.filter(speaker => speaker.portrait && !existsSync(join(root, 'public/portraits', `${speaker.portrait}.png`))).map(speaker => `${speaker.name}: falta public/portraits/${speaker.portrait}.png`),
  ...provisional.map(foe => `${foe.name} (${foe.kind}): pelea con el modelo del esbirro`),
]);

// ——— Code: what is exported is used, and every module is reached from the game, a lab or a test ———
const sources = walk('src').filter(path => path.endsWith('.ts'));
const text = Object.fromEntries(sources.map(path => [path, read(path)]));
const outside = [...walk('tests'), ...walk('scripts'), 'vite.config.ts'].filter(path => /\.(mjs|ts)$/.test(path)).map(path => [path, read(path)]);
const resolve = (from, spec) => [spec, `${spec}.ts`, `${spec}/index.ts`].map(to => normalize(join(dirname(from), to))).find(to => to in text);
const imports = Object.fromEntries(sources.map(path => [path, [
  ...[...text[path].matchAll(/(?:from\s+|import\s*\(\s*|import\s+|new URL\(\s*)['"](\.[^'"]+)['"]/g)].map(m => resolve(path, m[1])),
  // A folder loaded whole (`import.meta.glob('./landmarks/*.ts')`).
  ...[...text[path].matchAll(/import\.meta\.glob(?:<[^>]*>)?\(\s*['"](\.[^'"*]*)\*\.ts['"]/g)].flatMap(m => sources.filter(to => to.startsWith(normalize(join(dirname(path), m[1]))))),
].filter(Boolean)]));
const reached = new Set();
const entries = [
  ...readdirSync(root).filter(name => name.endsWith('.html')).flatMap(page => [...read(page).matchAll(/src="\/?(src\/[^"]+\.ts)"/g)].map(m => m[1])),
  ...outside.flatMap(([path, body]) => [...body.matchAll(/['"](\.\.?\/[^'"]*\.ts)['"]/g)].map(m => normalize(join(dirname(path), m[1])))),
];
for (const todo = [...entries]; todo.length;) { const path = todo.pop(); if (path in text && !reached.has(path)) { reached.add(path); todo.push(...imports[path]); } }
const word = name => new RegExp(`(?<![\\w$])${name.replace(/\$/g, '\\$')}(?![\\w$])`, 'g');
const unused = sources.flatMap(path => [...text[path].matchAll(/^export\s+(?:async\s+)?(?:const|let|function\*?|class)\s+([A-Za-z_$][\w$]*)/gm)].map(m => m[1])
  .filter(name => (text[path].match(word(name)) ?? []).length === 1 && !sources.some(other => other !== path && word(name).test(text[other])) && !outside.some(([, body]) => word(name).test(body)))
  .map(name => `${name} (${path}): exportado y nadie lo usa`));
section('codigo', 'Definido y sin conectar', 'pending', 'lo que se exporta se usa, y cada módulo se alcanza desde el juego, un laboratorio o un test', [
  ...sources.filter(path => !reached.has(path)).map(path => `${path}: nadie lo importa`),
  ...unused,
]);

const broken = sections.filter(s => s.kind === 'broken' && s.gaps.length);
if (process.argv.includes('--json')) console.log(JSON.stringify({ sections }, null, 1));
else {
  console.log(` INTEGRACIÓN (leída del juego: scripts/${relative(join(root, 'scripts'), fileURLToPath(import.meta.url))})`);
  for (const s of sections) {
    const mark = !s.gaps.length ? '✓' : s.kind === 'broken' ? '✗' : '·';
    console.log(`\n ${mark} ${s.title}: ${s.gaps.length ? `${s.gaps.length} ${s.kind === 'broken' ? 'por arreglar' : 'por hacer'}` : 'todo conectado'}`);
    console.log(`   ${s.what}`);
    for (const gap of s.gaps) console.log(`     ${s.kind === 'broken' ? '✗' : '·'} ${gap}`);
  }
}
process.exit(broken.length ? 1 : 0);
