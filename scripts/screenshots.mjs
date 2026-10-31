// Plays a scripted scenario in a real browser and saves numbered screenshots plus a gallery page.
// Usage: node scripts/screenshots.mjs <scenario | path/to/scenario.json> [--url http://127.0.0.1:5173] [--size 1440x900] [--headed] [--gpu] [--perf] [--chrome] [--frames] [--scale 2] [--out dir]
// Scenarios live in scripts/screenshots/<name>.json; the step format is documented in scripts/screenshots/README.md.
import { spawn } from 'node:child_process';
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { chromium } from 'playwright';

const { values: options, positionals } = parseArgs({
  allowPositionals: true,
  options: { url: { type: 'string' }, size: { type: 'string', default: '1440x900' }, headed: { type: 'boolean', default: false }, gpu: { type: 'boolean', default: false }, perf: { type: 'boolean', default: false }, chrome: { type: 'boolean', default: false }, frames: { type: 'boolean', default: false }, scale: { type: 'string', default: '1' }, out: { type: 'string' } },
});
const scenarioDir = resolve('scripts/screenshots');
const available = (await readdir(scenarioDir)).filter(f => f.endsWith('.json')).map(f => f.slice(0, -5));
// A path to a .json runs a scenario kept anywhere (a throwaway one while debugging).
const given = positionals[0] ?? '';
const name = given.endsWith('.json') ? basename(given, '.json') : given;
if (!given.endsWith('.json') && !available.includes(name)) {
  console.error(`Choose a scenario: ${available.join(', ')}`);
  process.exit(1);
}
const scenario = JSON.parse(await readFile(given.endsWith('.json') ? resolve(given) : resolve(scenarioDir, `${name}.json`), 'utf8'));
const [width, height] = options.size.split('x').map(Number);
const out = resolve(options.out ?? `output/screenshots/${name}`);
await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });

// Without --url, start a private Vite dev server; the game copes without the API.
let vite;
let base = options.url;
if (!base) {
  const { createServer } = await import('vite');
  // --perf serves the engine's profiler build (release code with timings): the debug build that
  // development uses validates every WebGPU call and costs several milliseconds a frame.
  const engine = options.perf ? { resolve: { alias: [{ find: /^playcanvas$/, replacement: resolve('node_modules/playcanvas/build/playcanvas.prf/src/index.js') }] } } : {};
  vite = await createServer({ logLevel: process.env.SCREENSHOT_DEBUG ? 'info' : 'silent', server: { port: 5199, strictPort: false, open: false, hmr: false, watch: null }, ...engine });
  await vite.listen();
  base = vite.resolvedUrls.local[0];
}

const browser = await chromium.launch({
  headless: !options.headed,
  // Playwright's Chromium cannot decode AAC, so scenarios that play music (.m4a) use the installed Chrome.
  ...(options.chrome ? { channel: 'chrome' } : {}),
  // The game draws only on WebGPU. Headless Chromium needs --enable-unsafe-webgpu to expose it; with
  // --gpu it uses this machine's GPU, without it the SwiftShader software adapter (slow, but it runs
  // anywhere). --perf also lifts the 60 fps cap, so frame times show what the GPU can do.
  args: ['--enable-unsafe-webgpu', ...(options.gpu ? ['--enable-gpu'] : ['--use-webgpu-adapter=swiftshader', '--enable-unsafe-swiftshader']), ...(options.perf ? ['--disable-gpu-vsync', '--disable-frame-rate-limit'] : []), '--ignore-gpu-blocklist', '--no-proxy-server'],
});
// --scale 2 renders at twice the pixels (the game follows devicePixelRatio up to 2): close crops of small things stay sharp.
const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: Number(options.scale) || 1 });
// Web fonts and other outside requests are not needed and can hang offline machines.
await page.route(url => !['localhost', '127.0.0.1'].includes(url.hostname), route => route.abort());
const errors = [];
page.on('pageerror', error => errors.push(error.stack ?? String(error)));
page.on('console', m => { if (process.env.SCREENSHOT_DEBUG) console.log('  [page]', m.text()); });

const shots = [];
const wait = ms => page.waitForTimeout(ms);
const inDialogue = () => page.evaluate(() => !!document.querySelector('#hud[data-dialogue]'));
// Polls from outside, gently: software rendering can manage only a frame or two per second.
async function until(expression, timeout = 60000) {
  const end = Date.now() + timeout;
  while (!await page.evaluate(expression).catch(() => false)) {
    if (Date.now() > end) throw new Error(`Timed out after ${timeout} ms waiting for: ${expression}`);
    await wait(1000);
  }
}
// Actions in priority order: a step's first matching key is its action, the rest are options
// (a hold may have an `until`, a shot a `delay`).
const steps = {
  async open(step) {
    await page.emulateMedia({ reducedMotion: step.reducedMotion ?? 'no-preference' });
    const url = new URL(step.open, base);
    await page.goto(url.href, { waitUntil: 'domcontentloaded' });
    await until(step.ready ?? '!!window.gerard', 30000);
  },
  async teleport(step) {
    const [x, z] = step.cell;
    await page.evaluate(([environment, x, z]) => window.gerard.game.setEnvironment(environment, { x, z }), [step.teleport, x, z]);
    await wait(step.settle ?? 800);
  },
  async press(step) {
    for (let i = 0; i < (step.times ?? 1); i++) { await page.keyboard.press(step.press); await wait(step.gap ?? 300); }
  },
  async hold(step) {
    for (const key of step.hold) await page.keyboard.down(key);
    if (step.until) await until(step.until, step.timeout); else await wait(step.ms ?? 1000);
    for (const key of step.hold) await page.keyboard.up(key);
  },
  async skipDialogue(step) {
    for (let i = 0; i < 60 && await inDialogue(); i++) { await page.keyboard.press('KeyE'); await wait(300); }
    await wait(step.settle ?? 400);
  },
  async shot(step) {
    if (step.delay) await wait(step.delay);
    const file = `${String(shots.length + 1).padStart(2, '0')}-${step.shot}.png`;
    const [x, y, width, height] = step.clip ?? [];
    await page.screenshot({ path: resolve(out, file), ...(step.clip ? { clip: { x, y, width, height } } : {}) });
    shots.push({ file, caption: step.caption ?? step.shot });
    console.log(`  ${file}`);
  },
  // A short clip: the game's clock is driven frame by frame (each frame exactly 1/fps later, however
  // slowly the browser renders it), every frame is captured, and ffmpeg makes an .mp4 and a contact
  // sheet. `warmup` seconds run first without capturing; `each` runs in the page before every frame.
  async record(step) {
    const fps = step.fps ?? 30, frames = Math.max(2, Math.round((step.seconds ?? 2) * fps));
    const number = String(shots.length + 1).padStart(2, '0'), base = `${number}-${step.record}`;
    const frameDir = resolve(out, `${base}-frames`);
    await mkdir(frameDir, { recursive: true });
    for (const key of step.keys ?? []) await page.keyboard.down(key);
    // Every tick reads the fake clock, so ticks between captures see no time pass.
    await page.evaluate(([appExpression, warmup, fps]) => {
      const app = (0, eval)(appExpression);
      if (!app) throw new Error(`record: no app at ${appExpression}`);
      let now = performance.now();
      const own = app._processTimestamp;
      app._processTimestamp = () => now;
      app._time = now;
      for (let i = 0; i < Math.round(warmup * fps); i++) app.update(1 / fps);
      window.__recording = {
        advance(ms) { now += ms; app.renderNextFrame = true; return new Promise(done => app.once('frameend', done)); },
        release() { app._processTimestamp = own; app._time = 0; delete window.__recording; },
      };
    }, [step.app ?? 'window.gerard.game.app', step.warmup ?? 0, fps]);
    const [x, y, width, height] = step.clip ?? [];
    try {
      for (let i = 0; i < frames; i++) {
        if (step.each) await page.evaluate(([code, i, t]) => { window.frame = i; window.frameTime = t; return (0, eval)(code); }, [step.each, i, i / fps]);
        await page.evaluate(ms => window.__recording.advance(ms), 1000 / fps);
        await page.screenshot({ path: resolve(frameDir, `${String(i).padStart(4, '0')}.jpg`), type: 'jpeg', quality: 92, ...(step.clip ? { clip: { x, y, width, height } } : {}) });
        if (process.stdout.isTTY && i % fps === fps - 1) process.stdout.write(`\r  ${base}: ${i + 1}/${frames} frames`);
      }
    } finally {
      await page.evaluate(() => window.__recording?.release()).catch(() => {});
      for (const key of step.keys ?? []) await page.keyboard.up(key);
    }
    if (process.stdout.isTTY) process.stdout.write('\r\x1b[K');
    // The video, at the clip's own pace, and a sheet of `tiles` frames evenly spread over it.
    const tiles = step.tiles ?? 12, columns = 4, rows = Math.ceil(tiles / columns), every = Math.max(1, Math.floor(frames / tiles));
    const input = ['-y', '-loglevel', 'error', '-framerate', String(fps), '-i', resolve(frameDir, '%04d.jpg')];
    await ffmpeg([...input, '-vf', 'pad=ceil(iw/2)*2:ceil(ih/2)*2', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', '-movflags', '+faststart', resolve(out, `${base}.mp4`)]);
    await ffmpeg([...input, '-vf', `select=not(mod(n\\,${every})),scale=${step.sheetWidth ?? 480}:-2,tile=${columns}x${rows}:padding=4:color=0x101f25`, '-frames:v', '1', '-update', '1', resolve(out, `${base}-sheet.png`)]);
    if (!options.frames) await rm(frameDir, { recursive: true, force: true });
    const caption = step.caption ?? step.record;
    shots.push({ file: `${base}.mp4`, sheet: `${base}-sheet.png`, caption: `${caption} (${(frames / fps).toFixed(1)} s at ${fps} fps; sheet: every ${(every / fps).toFixed(2)} s)` });
    console.log(`  ${base}.mp4 + ${base}-sheet.png`);
  },
  eval: step => page.evaluate(step.eval),
  until: step => until(step.until, step.timeout),
  wait: step => wait(step.wait),
};
function ffmpeg(args) {
  return new Promise((done, fail) => {
    const child = spawn('ffmpeg', args, { stdio: ['ignore', 'inherit', 'inherit'] });
    child.on('error', error => fail(new Error(`ffmpeg failed to start (${error.message}); install it (brew install ffmpeg) to record clips`)));
    child.on('exit', code => code === 0 ? done() : fail(new Error(`ffmpeg exited with ${code}`)));
  });
}

console.log(`Scenario ${name}: ${scenario.title ?? ''}`);
let failed;
try {
  for (const [index, step] of scenario.steps.entries()) {
    const kind = Object.keys(steps).find(key => key in step);
    if (!kind) throw new Error(`Step ${index + 1} has no known action: ${JSON.stringify(step)}`);
    if (process.env.SCREENSHOT_DEBUG) console.log(`  step ${index + 1}: ${JSON.stringify(step)}`);
    await steps[kind](step);
  }
} catch (error) {
  failed = error;
  // A short game summary makes timeouts easier to read.
  failed.state = await page.evaluate(() => window.gerard && JSON.stringify({
    location: document.title, position: window.gerard.game.position, flags: window.gerard.story.saved,
    day: window.gerard.story.days.clock, wake: window.gerard.game.wakePhase,
    timeScale: window.gerard.game.app.timeScale,
    reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
    companion: window.gerard.story.companion, bubble: window.gerard.story.bubble,
  })).catch(() => undefined);
  await page.screenshot({ path: resolve(out, 'failure.png') }).catch(() => {});
  shots.push({ file: 'failure.png', caption: `Failed: ${error.message.split('\n')[0]}` });
} finally {
  await browser.close();
  await vite?.close();
}

const escape = text => String(text).replace(/[&<>"]/g, c => `&#${c.charCodeAt(0)};`);
await writeFile(resolve(out, 'index.html'), `<!doctype html><meta charset="utf-8"><title>${escape(scenario.title ?? name)} · screenshots</title>
<style>body{margin:0;padding:32px;font:15px system-ui,sans-serif;background:#101f25;color:#eeeade}h1{margin:0 0 4px}p{color:#9db0aa}
main{display:grid;grid-template-columns:repeat(auto-fill,minmax(420px,1fr));gap:24px}figure{margin:0}img,video{width:100%;border:1px solid #c6d6ad33;display:block}a{color:#9db0aa;font-size:13px}
figcaption{margin-top:8px;font-size:13px;color:#d6dccb}</style>
<h1>${escape(scenario.title ?? name)}</h1><p>${escape(scenario.description ?? '')} · ${new Date().toISOString().slice(0, 16).replace('T', ' ')}</p>
<main>${shots.map(s => `<figure>${s.sheet
  ? `<video src="${s.file}" autoplay loop muted playsinline controls></video><a href="${s.sheet}">Contact sheet</a>`
  : `<a href="${s.file}"><img src="${s.file}" alt="" loading="lazy"></a>`}<figcaption>${escape(s.file)} · ${escape(s.caption)}</figcaption></figure>`).join('')}</main>\n`);
const clips = shots.filter(s => s.sheet).length;
console.log(`Saved ${shots.length - clips} screenshots${clips ? ` and ${clips} clips` : ''} and a gallery to ${out}/index.html`);
if (errors.length) console.error(`Page errors:\n${errors.map(e => `  ${e}`).join('\n')}`);
if (failed) { console.error(`Scenario failed: ${failed.message}${failed.state ? `\nGame state: ${failed.state}` : ''}`); process.exit(1); }
if (errors.length) process.exit(1);
