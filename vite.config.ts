import { execFile } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import { ANIMAS_PAGE, ANIMA_NOTES_ENDPOINT, ANIMA_NOTES_FILES, animaNotesJson, animaNotesProblem, type AnimaNotesFile } from './src/anima-notes';
import { NOTES_ENDPOINT, NOTES_FILES, notesJson, notesProblem, type NotesFile } from './src/bestiary-notes';
import { GUION_EDIT_ENDPOINT, GUION_NOTES_ENDPOINT, GUION_NOTES_FILES, GUION_PAGE, guionNotesJson, guionNotesProblem, literals, replaceLiteral, type GuionNotesFile } from './src/guion';

// The game is played in Chrome: `--open` (just dev, herdr's Start, the dev-* recipes) opens it there,
// whatever the default browser is. BROWSER set in the environment still wins.
if (!process.env.BROWSER && process.platform === 'darwin' && existsSync('/Applications/Google Chrome.app')) process.env.BROWSER = 'Google Chrome';

// Which PlayCanvas build the dev server gives the game (GERARD_ENGINE; a build always gets the release one):
// - `profiler` (the default): release code with timings (app.stats, ?stats). What `just dev` plays on.
// - `debug`: validates every call and logs what is wrong, at three to four times the CPU a frame
//   (14 ms of render against 3.8 on Avinguda Meridiana, so it cannot hold 60 fps there). The screenshot
//   runner uses it, so mistakes still show up in its runs: GERARD_ENGINE=debug just dev to play on it.
// - `release`: exactly what the deployed game runs.
const ENGINES: Record<string, string> = { debug: 'playcanvas.dbg', profiler: 'playcanvas.prf', release: 'playcanvas' };

/**
 * A page's notes, only while serving: the bestiary's (`just bestiario`, src/bestiary-notes.ts) and the
 * ánimas' sheet's (`just animas`, src/anima-notes.ts). GET gives the file (or no notes), PUT with the
 * whole file writes it, checked and atomically (a temp file, then rename). `?archivo=scratch` is the
 * screenshots' scratch file, so they never leave a real note.
 */
function notesEndpoint<T>(name: string, endpoint: string, files: { real: string; scratch: string }, problem: (data: unknown) => string | undefined, json: (data: T) => string): Plugin {
  return {
    name,
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(endpoint, (req, res) => {
        const file = resolve(new URL(req.originalUrl ?? '', 'http://x').searchParams.get('archivo') === 'scratch' ? files.scratch : files.real);
        const send = (status: number, body: string) => { res.statusCode = status; res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.end(body); };
        if (req.method === 'GET') { send(200, existsSync(file) ? readFileSync(file, 'utf8') : '{"notes":[]}\n'); return; }
        if (req.method !== 'PUT') { send(405, JSON.stringify({ error: 'GET o PUT' })); return; }
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
          let data: unknown;
          try { data = JSON.parse(body); } catch { send(400, JSON.stringify({ error: 'No es JSON.' })); return; }
          const wrong = problem(data);
          if (wrong) { send(400, JSON.stringify({ error: wrong })); return; }
          mkdirSync(dirname(file), { recursive: true });
          const temp = `${file}.${process.pid}.tmp`;
          writeFileSync(temp, json(data as T));
          renameSync(temp, file);
          send(200, readFileSync(file, 'utf8'));
        });
      });
    },
  };
}

/**
 * The ánimas' sheet (`just animas`), only while serving: each time its page is asked for, it is written
 * again (scripts/animas.mjs, a quarter of a second), so a reload shows the docs and the game as they
 * are now. Vite then serves the file like any other page.
 */
function animasSheet(): Plugin {
  return {
    name: 'animas-hoja',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        const path = new URL(req.url ?? '', 'http://x').pathname;
        if (path !== ANIMAS_PAGE && path !== `${ANIMAS_PAGE}index.html`) { next(); return; }
        execFile(process.execPath, ['--experimental-strip-types', '--no-warnings', 'scripts/animas.mjs'], { cwd: server.config.root }, (error, _out, err) => {
          if (error) server.config.logger.error(`[animas] scripts/animas.mjs falló: ${err || error.message}`);
          next();
        });
      });
    },
  };
}

/**
 * The script (`just guion`, src/guion.ts), only while serving: each time its page is asked for, the
 * script is gathered again from the code (scripts/guion.mjs, half a second), and an edit made on the
 * page is written straight into the source: the literal where the line is written, if it still says
 * what the page saw. A place's look written in src/geo/<zone>.json is written in its source too,
 * assets/geo/<zone>/zone.json, so the next `just geo` keeps it.
 */
function guionPage(): Plugin {
  const write = (file: string, text: string) => { const temp = `${file}.${process.pid}.tmp`; writeFileSync(temp, text); renameSync(temp, file); };
  return {
    name: 'guion',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        if (new URL(req.url ?? '', 'http://x').pathname !== GUION_PAGE) { next(); return; }
        execFile(process.execPath, ['--experimental-strip-types', '--no-warnings', 'scripts/guion.mjs'], { cwd: server.config.root }, (error, _out, err) => {
          if (error) server.config.logger.error(`[guion] scripts/guion.mjs falló: ${err || error.message}`);
          next();
        });
      });
      server.middlewares.use(GUION_EDIT_ENDPOINT, (req, res) => {
        const send = (status: number, body: object) => { res.statusCode = status; res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.end(JSON.stringify(body)); };
        if (req.method !== 'POST') { send(405, { error: 'POST' }); return; }
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
          let edit: { file?: unknown; line?: unknown; col?: unknown; old?: unknown; next?: unknown };
          try { edit = JSON.parse(body); } catch { send(400, { error: 'No es JSON.' }); return; }
          const { file, line, col, old, next } = edit;
          if (typeof file !== 'string' || !/^src\/[\w/.-]+\.(ts|json)$/.test(file) || file.includes('..') || /(^|\/)guion/.test(file)) { send(400, { error: `No se edita ese archivo: ${String(file)}.` }); return; }
          if (typeof line !== 'number' || typeof col !== 'number' || typeof old !== 'string' || typeof next !== 'string') { send(400, { error: 'Se esperaba { file, line, col, old, next }.' }); return; }
          const path = resolve(server.config.root, file);
          if (!existsSync(path)) { send(404, { error: `No existe ${file}.` }); return; }
          const done = replaceLiteral(readFileSync(path, 'utf8'), { line, col }, old, next);
          if ('error' in done) { send(409, { error: done.error }); return; }
          write(path, done.source);
          let aviso: string | undefined;
          const zone = /^src\/geo\/([\w-]+)\.json$/.exec(file)?.[1];
          const source = zone && resolve(server.config.root, 'assets/geo', zone, 'zone.json');
          if (source && existsSync(source)) {
            const text = readFileSync(source, 'utf8');
            const same = literals(text).filter(l => l.value === old);
            const mirrored = same.length === 1 ? replaceLiteral(text, same[0], old, next) : undefined;
            if (mirrored && 'source' in mirrored) write(source, mirrored.source);
            else aviso = `Cambiado en ${file}, pero no en assets/geo/${zone}/zone.json (${same.length ? 'aparece varias veces' : 'no aparece'}): el próximo just geo lo volvería a poner.`;
          }
          server.config.logger.info(`[guion] ${file}:${done.literal.line} «${old}» → «${next}»`);
          // Gathered again, so every other line's place in the file is right when the page reads it.
          execFile(process.execPath, ['--experimental-strip-types', '--no-warnings', 'scripts/guion.mjs'], { cwd: server.config.root }, () => {
            send(200, { at: { file, line: done.literal.line, col: done.literal.col }, ...(aviso ? { aviso } : {}) });
          });
        });
      });
    },
  };
}

export default defineConfig(({ command }) => {
  const name = process.env.GERARD_ENGINE || (command === 'serve' ? 'profiler' : '');
  const engine = ENGINES[name];
  if (name && !engine) throw new Error(`GERARD_ENGINE must be one of ${Object.keys(ENGINES).join(', ')}`);
  return {
    plugins: [
      notesEndpoint<NotesFile>('bestiario-notas', NOTES_ENDPOINT, NOTES_FILES, notesProblem, notesJson),
      notesEndpoint<AnimaNotesFile>('animas-notas', ANIMA_NOTES_ENDPOINT, ANIMA_NOTES_FILES, animaNotesProblem, animaNotesJson),
      animasSheet(),
      notesEndpoint<GuionNotesFile>('guion-notas', GUION_NOTES_ENDPOINT, GUION_NOTES_FILES, guionNotesProblem, guionNotesJson),
      guionPage(),
    ],
    resolve: engine ? { alias: [{ find: /^playcanvas$/, replacement: resolve(`node_modules/playcanvas/build/${engine}/src/index.js`) }] } : {},
    // Each engine keeps its own pre-bundled copy, so a screenshot run (debug) and the game being played
    // (profiler) never rebuild each other's.
    cacheDir: engine ? `node_modules/.vite/${name}` : 'node_modules/.vite',
    // Relative base so the build works both locally and under
    // a sub-path like https://aitirga.github.io/gerard-35/
    base: './',
    // `just backend` listens on 8035 (GERARD_API_PORT); GERARD_API points the proxy at any other backend.
    server: {
      proxy: { '/api': process.env.GERARD_API ?? `http://127.0.0.1:${process.env.GERARD_API_PORT ?? 8035}` },
      // No live reload: agents edit files while the game is being played, so the page only
      // picks up changes when the player reloads it by hand.
      hmr: false,
    },
    build: {
      rollupOptions: { input: { game: 'index.html', combatLab: 'combat-lab.html' } },
      // The PlayCanvas engine makes the game a single ~2.6 MB chunk; that's expected.
      chunkSizeWarningLimit: 3000,
    },
  };
});
