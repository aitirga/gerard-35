#!/usr/bin/env -S node --experimental-strip-types
/**
 * The script of the game (`just guion`, docs/dev-tools.md § El guion), from the game's own data:
 *
 *   node scripts/guion.mjs            output/guion/guion.json: every line, who says it and where it is written
 *   node scripts/guion.mjs partida    output/guion/partida.json: when each is said, in one simulated game (src/game-sim.ts), and what it
 *                                     only says trying every interaction or in another player's game (`extra`)
 *   node scripts/guion.mjs fotos      output/guion/fotos/: a photo of each moment, the game at that point with its line on screen
 *
 * The page (guion.html, src/guion-page.ts) reads the three; the dev server writes guion.json again each
 * time the page is opened, so it shows the code as it is.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { GROUPS, literals, photoName, readsLikeText, walk } from '../src/guion.ts';

const ROOT = resolve(import.meta.dirname, '..');
const OUT = resolve(ROOT, 'output/guion');
const rel = path => relative(ROOT, path).split('\\').join('/');

// ── Where every literal is ─────────────────────────────────────────────────
/** Every literal under src/ (TypeScript and the places' JSON), by what it says. */
function literalIndex() {
  const byValue = new Map();
  const visit = dir => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) { visit(path); continue; }
      if (!/\.(ts|json)$/.test(name) || /^guion/.test(name)) continue;
      const file = rel(path);
      for (const literal of literals(readFileSync(path, 'utf8'))) {
        if (!byValue.has(literal.value)) byValue.set(literal.value, []);
        byValue.get(literal.value).push({ ...literal, file });
      }
    }
  };
  visit(resolve(ROOT, 'src'));
  return byValue;
}

// ── The script ─────────────────────────────────────────────────────────────
/** Modules whose exports are walked for dialogues, lone lines and things to look at, and their section. */
const MODULES = [
  ['chapter-1', 'capitulo-1'], ['chapter-2', 'capitulo-2'], ['castle-story', 'castillo'],
  ['friends/nuria', 'nuria'], ['friends/universidad', 'universidad'], ['friends/emilie', 'emilie'],
  ['friends/luca', 'luca'], ['friends/marta', 'marta'], ['friends/bernat', 'bernat'],
  ['environments', 'lugares'], ['palace-zone-plans', 'lugares'],
];
/** Files read whole: every literal in them that reads like something said, as one entry. */
const SCANNED = [
  { file: 'src/journal.ts', id: 'journal:textos', group: 'diario', kind: 'diario', voice: 'diario', title: 'El diario y lo que piensa (pantalla de estado)' },
  { file: 'src/castle-fight.ts', id: 'castle-fight:textos', group: 'castillo', kind: 'narracion', voice: 'narracion', title: 'Lo que cuentan los combates del castillo' },
];
/** Places where Gerard is a boy: their looks are said in his child's voice (src/game.ts `use`). */
const CHILDHOOD = new Set(['patio', 'maresme', 'home-entrance', 'home-floor-1', 'home-floor-2', 'palacio']);

/** Texts that are not dialogues: bubbles, shouts, the TV, cards, captions. `lines` gives [speaker, text] pairs. */
function extras(m) {
  const { BUBBLES, CARDS } = m['chapter-1'], { NEWS } = m['chapter-2'], { LINES_CASTLE } = m['castle-story'];
  const { LINES_NURIA, STREET_MARKS } = m['friends/nuria'], { LINES_UNI } = m['friends/universidad'];
  const all = (speaker, texts) => texts.map(text => [speaker, text]);
  return [
    { id: 'chapter-1:CARDS.intro', group: 'capitulo-1', kind: 'rotulo', title: 'Cartela del capítulo 1', file: 'chapter-1', lines: all('rotulo', [CARDS.intro.kicker, CARDS.intro.title, CARDS.intro.text]) },
    { id: 'chapter-1:BUBBLES.stalled', group: 'capitulo-1', kind: 'burbuja', title: 'Bernat se para (uno más cada vez que Gerard se aleja)', file: 'chapter-1', lines: all('bernat', BUBBLES.stalled) },
    { id: 'chapter-1:BUBBLES.away', group: 'capitulo-1', kind: 'burbuja', title: 'Bernat, si vuelven calle abajo', file: 'chapter-1', lines: all('bernat', BUBBLES.away) },
    { id: 'chapter-1:BUBBLES.tether', group: 'capitulo-2', kind: 'burbuja', title: 'Aitor, si el otro jugador se aleja', file: 'chapter-1', lines: all('aitor', BUBBLES.tether) },
    { id: 'chapter-2:NEWS.stages', group: 'capitulo-2', kind: 'tele', title: 'Las noticias: el titular de cada mañana', file: 'chapter-2', lines: all('tele', NEWS.stages.flatMap(s => [s.headline, s.sub])) },
    { id: 'chapter-2:NEWS.screen', group: 'capitulo-2', kind: 'tele', title: 'Las noticias: rótulos', file: 'chapter-2', lines: all('tele', [NEWS.channel, NEWS.kicker, NEWS.live, ...Object.values(NEWS.shots), NEWS.reporter.name, NEWS.reporter.role]) },
    { id: 'chapter-2:NEWS.ticker', group: 'capitulo-2', kind: 'tele', title: 'Las noticias: el teletipo', file: 'chapter-2', lines: all('tele', NEWS.ticker) },
    { id: 'castle-story:LINES_CASTLE.screams', group: 'castillo', kind: 'grito', title: 'El grito de la Reina al caer cada jefe', file: 'castle-story', lines: all('reina', Object.values(LINES_CASTLE.screams)) },
    { id: 'castle-story:LINES_CASTLE.scenes', group: 'castillo', kind: 'narracion', title: 'La última escena y los dos finales', file: 'castle-story', lines: all('narracion', [LINES_CASTLE.lastScene, LINES_CASTLE.acabar.scene]) },
    { id: 'friends/nuria:LINES_NURIA.shouts', group: 'nuria', kind: 'grito', title: 'Uri grita desde lo alto de la torre', file: 'friends/nuria', lines: all('uri', [LINES_NURIA.mazeIn, ...LINES_NURIA.shouts, LINES_NURIA.roof]) },
    { id: 'friends/nuria:STREET_MARKS', group: 'nuria', kind: 'burbuja', title: 'Aitor por La calle que no acaba', file: 'friends/nuria', lines: all('aitor', STREET_MARKS.map(s => s.text)) },
    { id: 'friends/universidad:LINES_UNI.run', group: 'universidad', kind: 'burbuja', title: 'Aitor, al empezar el pilla-pilla', file: 'friends/universidad', lines: all('aitor', [LINES_UNI.run]) },
    { id: 'friends/universidad:LINES_UNI.photo', group: 'universidad', kind: 'rotulo', title: 'El pie de la foto del melón', file: 'friends/universidad', lines: all('rotulo', [LINES_UNI.photo]) },
    { id: 'credits:LAST_CARD', group: 'castillo', kind: 'rotulo', title: 'Créditos: la última cartela y las fotos', file: 'credits', lines: all('rotulo', [m.credits.LAST_CARD, ...m.credits.ALBUM.map(a => a.caption)]) },
    ...Object.values(m.items.ITEMS).map(item => ({ id: `items:${item.id}`, group: 'objetos', kind: 'objeto', title: item.name, file: 'items', lines: all('rotulo', [item.name, item.description]) })),
  ];
}

/** The whole script, with the objects it was made from (for `partida` to know each dialogue when it is said). */
export async function collect() {
  const m = {};
  for (const name of [...MODULES.map(([name]) => name), 'credits', 'items']) m[name] = await import(`../src/${name}.ts`);
  const index = literalIndex(), used = new Set();
  // Where a text is written: an unused literal saying it, in its own module's file first.
  const locate = (text, file) => {
    const candidates = index.get(text) ?? [];
    const pick = candidates.find(l => l.file === file && !used.has(`${l.file}:${l.start}`)) ?? candidates.find(l => !used.has(`${l.file}:${l.start}`)) ?? candidates[0];
    if (!pick) return {};
    used.add(`${pick.file}:${pick.start}`);
    return pick.dynamic ? { dynamic: true } : { at: { file: pick.file, line: pick.line, col: pick.col } };
  };
  const line = (speaker, text, file) => ({ speaker, text, ...locate(text, file) });

  // Which place each thing to look at is in.
  const places = new Map();
  const envs = [...Object.values(m.environments.ENVIRONMENTS), ...Object.values(m['palace-zone-plans']).filter(e => e && typeof e === 'object' && 'interactions' in e && 'id' in e)];
  for (const env of envs) for (const i of env.interactions ?? []) if (!places.has(i.id)) places.set(i.id, { environment: env.id, name: env.name, cell: i.cell });

  const entries = [], objects = new Map(), looks = new Set(), seen = new WeakSet();
  for (const [name, group] of MODULES) {
    const file = `src/${name}.ts`;
    for (const [key, value] of Object.entries(m[name])) {
      walk(key, value, (path, item, kind) => {
        const id = kind === 'mirar' ? `lugar:${item.id}` : `${name}:${path}`;
        if (kind === 'mirar') {
          if (looks.has(item.id) || !item.lines.length) return;
          looks.add(item.id);
          const place = places.get(item.id) ?? { environment: '', name: 'Sin lugar' };
          const voice = CHILDHOOD.has(place.environment) ? 'gerard' : 'gerard35';
          entries.push({ id, group: 'lugares', kind, title: `${place.name} · ${item.label}`, place: { ...place, cell: item.cell ?? place.cell }, lines: item.lines.map(text => line(voice, text, file)) });
        } else if (kind === 'linea') {
          entries.push({ id, group, kind, title: path, lines: [line(item.speaker, item.text, file)] });
        } else {
          objects.set(item, id);
          entries.push({ id, group, kind, title: path, left: item.left, ...(item.right ? { right: item.right } : {}), lines: item.lines.map(l => line(l.speaker, l.text, file)) });
        }
      }, seen);
    }
  }
  for (const extra of extras(m)) {
    const { file, lines, ...entry } = extra;
    entries.push({ ...entry, lines: lines.map(([speaker, text]) => line(speaker, text, `src/${file}.ts`)) });
  }
  for (const scan of SCANNED) {
    const found = literals(readFileSync(resolve(ROOT, scan.file), 'utf8')).filter(l => readsLikeText(l) && !used.has(`${scan.file}:${l.start}`));
    if (!found.length) continue;
    for (const l of found) used.add(`${scan.file}:${l.start}`);
    entries.push({ id: scan.id, group: scan.group, kind: scan.kind, title: scan.title, lines: found.map(l => ({ speaker: scan.voice, text: l.value, ...(l.dynamic ? { dynamic: true } : { at: { file: scan.file, line: l.line, col: l.col } }) })) });
  }
  const order = new Map(GROUPS.map((g, i) => [g.id, i]));
  entries.sort((a, b) => (order.get(a.group) ?? 99) - (order.get(b.group) ?? 99));
  return { entries, objects, places: Object.fromEntries(envs.map(env => [env.id, env.name])) };
}

function writeJson(name, data) {
  mkdirSync(OUT, { recursive: true });
  const file = resolve(OUT, name), temp = `${file}.${process.pid}.tmp`;
  writeFileSync(temp, JSON.stringify(data, null, 1) + '\n');
  // A rename, so the page never reads half a file.
  renameSync(temp, file);
  return rel(file);
}

async function script() {
  const { entries, places } = await collect();
  const lines = entries.reduce((n, e) => n + e.lines.length, 0);
  const file = writeJson('guion.json', { made: new Date().toISOString(), places, entries });
  return { file, entries: entries.length, lines };
}

// ── When it is said ────────────────────────────────────────────────────────
/** The story with the same state, to try things on without touching the game (its own `handle` stays behind). */
const copyStory = story => Object.assign(Object.create(Object.getPrototypeOf(story)), structuredClone(Object.fromEntries(Object.entries(story).filter(([, v]) => typeof v !== 'function'))));

/**
 * One simulated game (src/game-sim.ts) with the story listened to: each dialogue said, where and when,
 * and how to get the game back to that point. With `probe`, at each new point it also tries, on a copy
 * of the story, every interaction of the place it is in, twice: what that would say (talking again, a
 * portrait, an afternoon) goes to `tried`, with the interaction it came from.
 */
async function listen({ player, seed, probe, entries, objects }) {
  const { PLAYERS, Playing } = await import('../src/game-sim.ts');
  const { MISSIONS } = await import('../src/battle-sim.ts');
  const { missionNow, missionsDone } = await import('../src/story-points.ts');
  const { ENVIRONMENTS } = await import('../src/environments.ts');
  const byText = new Map();
  for (const entry of entries) for (const l of entry.lines) if (!byText.has(l.text)) byText.set(l.text, entry.id);
  const entryOf = effect => {
    const text = effect.kind === 'dialogue' ? effect.dialogue.lines[0].text : effect.kind === 'shout' || effect.kind === 'scream' || effect.kind === 'epilogue' ? effect.text : effect.kind === 'photo' ? effect.caption : undefined;
    return text === undefined ? undefined : (effect.kind === 'dialogue' && objects.get(effect.dialogue)) || byText.get(text);
  };
  const game = new Playing(PLAYERS[player], seed);
  const story = game.story, handle = story.handle.bind(story);
  const flags = [...story.saved], moments = [], visits = {}, tried = new Map(), probed = new Set();
  const jump = () => {
    const adult = story.adult, clock = story.clock;
    const time = adult ? `&day=${clock.day}${clock.hour >= 21 ? `&hour=${clock.hour}` : ''}` : '';
    const mission = Object.entries(MISSIONS).find(([, m]) => m.name === game.stageName)?.[0];
    const done = missionsDone(story.saved).filter(id => id !== mission);
    const part = mission && missionNow(mission, story.saved, story.nuria, story.uni, story.luca);
    if (part) return `/?mission=${mission}&part=${part}${done.length ? `&with=${done.join(',')}` : ''}${time}`;
    return flags.length ? `/?story=${flags.at(-1)}${done.length ? `&with=${done.join(',')}` : ''}${time}` : '/?story=new';
  };
  const when = () => ({ stage: game.stageName, day: story.adult ? story.clock.day : 0, hour: story.adult ? story.clock.hour : 0 });
  const tryAll = environment => {
    const point = jump();
    if (probed.has(`${environment} ${point}`)) return;
    probed.add(`${environment} ${point}`);
    const ids = new Map();
    for (const i of story.interactions(environment)) ids.set(i.id, i);
    for (const i of ENVIRONMENTS[environment]?.interactions ?? []) if (!ids.has(i.id)) ids.set(i.id, i);
    for (const [id, { cell, label }] of ids) {
      const copy = copyStory(story);
      for (const again of [false, true]) {
        let effects;
        try { effects = copy.handle({ type: 'interact', id }); } catch { break; }
        for (const effect of effects) {
          const entry = entryOf(effect);
          if (entry && !tried.has(entry)) tried.set(entry, { n: 0, entry, ...when(), environment, cell: { x: Math.round(cell.x), z: Math.round(cell.z) }, event: 'interact', via: id, ...(label ? { label } : {}), ...(again ? { again } : {}), jump: point });
        }
      }
    }
  };
  story.handle = event => {
    const at = { environment: game.at.environment, cell: { x: Math.round(game.at.cell.x), z: Math.round(game.at.cell.z) } };
    const before = jump();
    visits[at.environment] ??= before;
    const effects = handle(event);
    for (const flag of story.saved) if (!flags.includes(flag)) flags.push(flag);
    // The photo loads the game just after the moment, what set it off already spent (a fight won, a
    // door talked to), so arriving does not set it off again; just before it is the second try.
    const after = jump();
    for (const effect of effects) {
      const entry = entryOf(effect);
      if (entry) moments.push({ n: moments.length + 1, entry, ...when(), ...at, event: event.type, jump: after, ...(before !== after ? { before } : {}) });
    }
    if (probe) tryAll(game.at.environment);
    return effects;
  };
  const played = game.playAll();
  return { moments, visits, tried: [...tried.values()], finished: played.finished };
}

/** Who else plays the game for the script: they take other branches (another ending, losing, another order) and say what the first player never hears. */
const OTHER_PLAYERS = ['corredor'];

/**
 * The game played by `player` (its moments, in order) and what it never says but the game can: each
 * interaction tried at every point (`listen`'s probe), and what `others` hear in their own game.
 */
async function partida({ player = 'pensando', seed = 35, others = OTHER_PLAYERS } = {}) {
  const { entries, objects } = await collect();
  const main = await listen({ player, seed, probe: true, entries, objects });
  const said = new Set(main.moments.map(m => m.entry)), extra = new Map();
  const keep = (list, from) => { for (const m of list) if (!said.has(m.entry) && !extra.has(m.entry)) extra.set(m.entry, { ...m, n: 0, ...(from ? { player: from } : {}) }); };
  keep(main.tried);
  for (const other of others) {
    const game = await listen({ player: other, seed, probe: true, entries, objects });
    keep(game.moments, other); keep(game.tried, other);
  }
  const file = writeJson('partida.json', { player, seed, made: new Date().toISOString(), finished: main.finished, moments: main.moments, extra: [...extra.values()], visits: main.visits });
  return { file, moments: main.moments.length, entries: said.size, extra: extra.size, finished: main.finished };
}

// ── The photos ─────────────────────────────────────────────────────────────
/** The open cell nearest `cell` in a place's grid (a thing to look at stands on a solid cell). */
function standing(env, cell) {
  const grid = env?.grid;
  if (!grid || !cell) return cell;
  let best = cell, bestD = Infinity;
  for (let z = 0; z < grid.length; z++) for (let x = 0; x < grid[z].length; x++) {
    if (grid[z][x] !== '.') continue;
    const d = (x - cell.x) ** 2 + (z - cell.z) ** 2;
    if (d < bestD) { bestD = d; best = { x, z }; }
  }
  return best;
}

async function fotos({ all = false, only, headed = false, gpu = true } = {}) {
  const { entries } = await collect();
  if (!existsSync(resolve(OUT, 'partida.json'))) await partida();
  const played = JSON.parse(readFileSync(resolve(OUT, 'partida.json'), 'utf8'));
  const { ENVIRONMENTS } = await import('../src/environments.ts');
  const dir = resolve(OUT, 'fotos'), manifestFile = resolve(OUT, 'fotos.json');
  mkdirSync(dir, { recursive: true });
  const manifest = existsSync(manifestFile) ? JSON.parse(readFileSync(manifestFile, 'utf8')) : {};
  const first = new Map();
  for (const moment of [...played.moments, ...(played.extra ?? [])]) if (!first.has(moment.entry)) first.set(moment.entry, moment);

  // What to photograph: each moment of the game, and each thing to look at in a place the game went to.
  const targets = [];
  for (const entry of entries) {
    if (only && entry.group !== only && !entry.id.startsWith(only)) continue;
    if (!all && manifest[entry.id] && existsSync(resolve(dir, manifest[entry.id].file))) continue;
    const moment = first.get(entry.id);
    const said = { left: entry.left ?? entry.lines[0].speaker, ...(entry.right ? { right: entry.right } : {}), lines: [{ speaker: entry.lines[0].speaker, text: entry.lines[0].text }] };
    const faceless = ['narracion', 'tele', 'rotulo', 'diario'].includes(said.lines[0].speaker);
    // Where to load the game for it, and where else to try if a fight starts on arrival.
    const tries = urls => [...new Set(urls.filter(Boolean))];
    // A moment only tried (`extra`) stands Gerard by the thing that says it, not on it.
    const cell = moment?.via ? standing(ENVIRONMENTS[moment.environment], moment.cell) : moment?.cell;
    if (moment) targets.push({ entry: entry.id, urls: tries([moment.jump, moment.before, played.visits[moment.environment]]), environment: moment.environment, cell, said: faceless ? undefined : said });
    else if (entry.kind === 'mirar' && entry.place?.environment && played.visits[entry.place.environment]) {
      targets.push({ entry: entry.id, urls: [played.visits[entry.place.environment]], environment: entry.place.environment, cell: standing(ENVIRONMENTS[entry.place.environment], entry.place.cell), said });
    }
  }
  if (!targets.length) { console.log('No hay fotos que hacer (--todas para rehacerlas).'); return; }
  // One load of the game for each point in it, its moments one after another.
  const byUrl = new Map();
  for (const t of targets) { if (!byUrl.has(t.urls[0])) byUrl.set(t.urls[0], []); byUrl.get(t.urls[0]).push(t); }
  const queue = [...byUrl].map(([url, group]) => ({ url, group }));
  console.log(`${targets.length} fotos en ${byUrl.size} cargas del juego…`);

  const { createServer } = await import('vite');
  const { chromium } = await import('playwright');
  process.env.VITE_PIXEL_RATIO = '';
  process.env.GERARD_ENGINE = 'profiler';
  const vite = await createServer({ root: ROOT, logLevel: 'silent', server: { port: 5197, strictPort: false, open: false, hmr: false, watch: null } });
  await vite.listen();
  const base = vite.resolvedUrls.local[0];
  const browser = await chromium.launch({ headless: !headed, args: ['--enable-unsafe-webgpu', ...(gpu ? ['--enable-gpu'] : ['--use-webgpu-adapter=swiftshader', '--enable-unsafe-swiftshader']), '--ignore-gpu-blocklist', '--no-proxy-server'] });
  // A fresh tab for each load: one tab reloaded dozens of times runs out of GPU memory.
  let page, lastError = '';
  const freshPage = async () => {
    await page?.close().catch(() => {});
    page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    await page.route(url => !['localhost', '127.0.0.1'].includes(url.hostname), route => route.abort());
    page.on('pageerror', error => { lastError = error.message.split('\n')[0]; });
  };
  const wait = ms => page.waitForTimeout(ms);
  const until = async (expression, timeout) => {
    const end = Date.now() + timeout;
    while (!await page.evaluate(expression).catch(() => false)) { if (Date.now() > end) throw new Error(`no llega: ${expression}`); await wait(500); }
  };
  const quiet = () => page.evaluate(() => { for (let i = 0; i < 20 && window.gerard.dialogue.open; i++) window.gerard.dialogue.close(); });
  let made = 0, failed = 0;
  const save = () => writeFileSync(manifestFile, JSON.stringify(manifest, null, 1) + '\n');
  try {
    while (queue.length) {
      const { url, group } = queue.shift();
      try {
        await freshPage();
        lastError = '';
        // No fight starts (`?combates=no`): one on arriving (a castle room's pupils, a patrol) would hide the place.
        const href = new URL(url, base); href.searchParams.set('combates', 'no');
        await page.goto(href.href, { waitUntil: 'domcontentloaded' });
        await until('!!window.gerard?.started && !!window.gerard.dialogue', 60000);
        await wait(1500);
        await quiet();
      } catch (error) {
        failed += group.length;
        console.log(`  ✗ ${url}: ${error.message}${lastError ? ` (la página: ${lastError})` : ''}`);
        continue;
      }
      while (group.length) {
        const t = group.shift();
        try {
          await page.evaluate(([environment, x, z]) => window.gerard.game.setEnvironment(environment, { x, z }), [t.environment, t.cell.x, t.cell.z]);
          await wait(1400);
          // Arriving may set the moment off by itself: then the game is already saying it, as it would.
          const own = t.said && await page.evaluate(text => window.gerard.dialogue.open && document.querySelector('#dialogue .text')?.textContent === text, t.said.lines[0].text);
          if (!own) await quiet();
          const fighting = () => page.evaluate(() => !!document.querySelector('#battle:not([hidden])'));
          // A fight started on arrival (a castle room's pupils, a patrol): left at once with no result,
          // as the picker does, so the place and the line are photographed all the same.
          if (!own && await fighting()) {
            // A fight started on arrival: the rest of this point go on after a fresh load, and this
            // moment is tried again at its next point.
            if (group.length) queue.unshift({ url, group });
            const [, ...rest] = t.urls;
            if (rest.length) { queue.push({ url: rest[0], group: [{ ...t, urls: rest }] }); console.log(`  … ${t.entry}: empieza un combate; otra vez desde ${rest[0]}`); }
            else { failed++; console.log(`  ✗ ${t.entry}: ha empezado un combate`); }
            break;
          }
          if (t.said && !own) {
            await page.evaluate(said => window.gerard.dialogue.show(said, () => {}), t.said);
            await wait(Math.min(3200, 500 + 16 * t.said.lines[0].text.length));
          }
          const file = photoName(t.entry);
          await page.screenshot({ path: resolve(dir, file), type: 'jpeg', quality: 82 });
          await quiet();
          manifest[t.entry] = { file, made: new Date().toISOString(), jump: url, environment: t.environment, cell: t.cell };
          made++;
          if (made % 10 === 0) save();
          console.log(`  ✓ ${t.entry}`);
        } catch (error) {
          failed++;
          console.log(`  ✗ ${t.entry}: ${error.message.split('\n')[0]}`);
          await quiet().catch(() => {});
        }
      }
    }
  } finally {
    save();
    await browser.close();
    await vite.close();
  }
  console.log(`${made} fotos nuevas en ${rel(dir)}${failed ? `, ${failed} sin hacer` : ''}.`);
}

// ── From the terminal ──────────────────────────────────────────────────────
if (process.argv[1] === import.meta.filename) {
  const [command = 'guion', ...args] = process.argv.slice(2);
  const option = name => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
  if (command === 'guion') {
    const { file, entries, lines } = await script();
    console.log(`${file}: ${entries} entradas, ${lines} líneas`);
  } else if (command === 'partida') {
    const others = option('--otros');
    const { file, moments, entries, extra, finished } = await partida({ player: option('--jugador'), seed: option('--semilla') ? Number(option('--semilla')) : undefined, ...(others !== undefined ? { others: others ? others.split(',') : [] } : {}) });
    console.log(`${file}: ${moments} momentos de ${entries} entradas, y ${extra} más que solo se dicen probando${finished ? '' : ' (la partida no llegó al final)'}`);
  } else if (command === 'fotos') {
    await fotos({ all: args.includes('--todas'), only: option('--solo'), headed: args.includes('--ver'), gpu: !args.includes('--sin-gpu') });
  } else {
    console.log(`Uso: node scripts/guion.mjs [guion | partida [--jugador pensando] [--otros corredor,casual] | fotos [--todas] [--solo <sección o id>] [--ver] [--sin-gpu]]`);
    process.exit(1);
  }
}
