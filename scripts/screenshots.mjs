// Plays a scripted scenario in a real browser and saves numbered screenshots plus a gallery page.
// Usage: node scripts/screenshots.mjs <scenario> [--url http://127.0.0.1:5173] [--size 1440x900] [--headed] [--out dir]
// Scenarios live in scripts/screenshots/<name>.json; the step format is documented in scripts/screenshots/README.md.
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { chromium } from 'playwright';

const { values: options, positionals } = parseArgs({
  allowPositionals: true,
  options: { url: { type: 'string' }, size: { type: 'string', default: '1440x900' }, headed: { type: 'boolean', default: false }, gpu: { type: 'boolean', default: false }, out: { type: 'string' } },
});
const scenarioDir = resolve('scripts/screenshots');
const available = (await readdir(scenarioDir)).filter(f => f.endsWith('.json')).map(f => f.slice(0, -5));
const name = positionals[0];
if (!name || !available.includes(name)) {
  console.error(`Choose a scenario: ${available.join(', ')}`);
  process.exit(1);
}
const scenario = JSON.parse(await readFile(resolve(scenarioDir, `${name}.json`), 'utf8'));
const [width, height] = options.size.split('x').map(Number);
const out = resolve(options.out ?? `output/screenshots/${name}`);
await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });

// Without --url, start a private Vite dev server; the game copes without the API.
let vite;
let base = options.url;
if (!base) {
  const { createServer } = await import('vite');
  vite = await createServer({ logLevel: process.env.SCREENSHOT_DEBUG ? 'info' : 'silent', server: { port: 5199, strictPort: false, open: false, hmr: false, watch: null } });
  await vite.listen();
  base = vite.resolvedUrls.local[0];
}

const browser = await chromium.launch({
  headless: !options.headed,
  // Default to software WebGL for machines without a GPU; desktops can opt into their GPU.
  args: [...(options.gpu ? [] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader']), '--ignore-gpu-blocklist', '--no-proxy-server'],
});
const page = await browser.newPage({ viewport: { width, height } });
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
    await page.goto(new URL(step.open, base).href, { waitUntil: 'domcontentloaded' });
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
    await page.screenshot({ path: resolve(out, file) });
    shots.push({ file, caption: step.caption ?? step.shot });
    console.log(`  ${file}`);
  },
  eval: step => page.evaluate(step.eval),
  until: step => until(step.until, step.timeout),
  wait: step => wait(step.wait),
};

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
main{display:grid;grid-template-columns:repeat(auto-fill,minmax(420px,1fr));gap:24px}figure{margin:0}img{width:100%;border:1px solid #c6d6ad33;display:block}
figcaption{margin-top:8px;font-size:13px;color:#d6dccb}</style>
<h1>${escape(scenario.title ?? name)}</h1><p>${escape(scenario.description ?? '')} · ${new Date().toISOString().slice(0, 16).replace('T', ' ')}</p>
<main>${shots.map(s => `<figure><a href="${s.file}"><img src="${s.file}" alt="" loading="lazy"></a><figcaption>${escape(s.file)} · ${escape(s.caption)}</figcaption></figure>`).join('')}</main>\n`);
console.log(`Saved ${shots.length} screenshots and a gallery to ${out}/index.html`);
if (errors.length) console.error(`Page errors:\n${errors.map(e => `  ${e}`).join('\n')}`);
if (failed) { console.error(`Scenario failed: ${failed.message}${failed.state ? `\nGame state: ${failed.state}` : ''}`); process.exit(1); }
if (errors.length) process.exit(1);
