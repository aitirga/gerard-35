import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';

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

export default defineConfig(({ command }) => {
  const name = process.env.GERARD_ENGINE || (command === 'serve' ? 'profiler' : '');
  const engine = ENGINES[name];
  if (name && !engine) throw new Error(`GERARD_ENGINE must be one of ${Object.keys(ENGINES).join(', ')}`);
  return {
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
