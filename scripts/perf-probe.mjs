// Times every place of the game, and where the CPU goes in each: frame, update and render time, draw
// calls, the worst frames and the functions that cost most (a sampled CPU profile).
// Usage: node scripts/perf-probe.mjs [place ...] [--engine profiler|debug|release] [--size 1728x1050] [--scale 1.5]
//          [--seconds 4] [--walk] [--top 14] [--story metro] [--fight <fight tester query>] [--json file] [--uncapped]
// Without places it goes through all of them (`ENVIRONMENTS`); `maresme@20,24` stands Gerard on a cell.
// The size and scale are a 16" MacBook's screen drawing 1.5 device pixels a point. docs/graphics.md § Performance.
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { chromium } from 'playwright';

const { values: options, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    engine: { type: 'string', default: 'profiler' }, size: { type: 'string', default: '1728x1050' }, scale: { type: 'string', default: '1.5' },
    seconds: { type: 'string', default: '4' }, walk: { type: 'boolean', default: false }, top: { type: 'string', default: '14' },
    story: { type: 'string', default: 'metro' }, fight: { type: 'string' }, json: { type: 'string' }, uncapped: { type: 'boolean', default: false },
    url: { type: 'string' },
  },
});
const [width, height] = options.size.split('x').map(Number);
const seconds = Number(options.seconds), top = Number(options.top);

let vite, base = options.url;
if (!base) {
  const { createServer } = await import('vite');
  process.env.VITE_PIXEL_RATIO = '';
  process.env.GERARD_ENGINE = options.engine;
  vite = await createServer({ logLevel: 'silent', server: { port: 5198, strictPort: false, open: false, hmr: false, watch: null } });
  await vite.listen();
  base = vite.resolvedUrls.local[0];
}
const browser = await chromium.launch({
  headless: true,
  // Frames keep the screen's pace (60 Hz headless), so `cpu` is what a frame costs and `frame` only says
  // whether it held. --uncapped lifts the cap to see how fast it could go, but Chromium then stalls for
  // 50–70 ms a few times a second as frames queue up: read its medians, never its worst frames.
  args: ['--enable-unsafe-webgpu', '--enable-gpu', ...(options.uncapped ? ['--disable-gpu-vsync', '--disable-frame-rate-limit'] : []), '--ignore-gpu-blocklist', '--no-proxy-server'],
});
const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: Number(options.scale) || 1 });
await page.route(url => !['localhost', '127.0.0.1'].includes(url.hostname), route => route.abort());
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const cdp = await page.context().newCDPSession(page);
await cdp.send('Profiler.enable');
await cdp.send('Profiler.setSamplingInterval', { interval: 400 });

async function ready(expression, timeout = 90000) {
  const end = Date.now() + timeout;
  while (!await page.evaluate(expression).catch(() => false)) {
    if (Date.now() > end) throw new Error(`Timed out waiting for ${expression}`);
    await page.waitForTimeout(250);
  }
}

/** Samples frames for `seconds` with the CPU profiler on; returns timings and the costliest functions. */
async function sample(label) {
  await page.evaluate(() => {
    const app = window.gerard.game.app, frames = [];
    let start = 0, last = performance.now();
    const begin = () => { start = performance.now(); };
    const end = () => {
      const now = performance.now(), s = app.stats;
      frames.push([now - last, now - start, s.frame.updateTime, s.frame.renderTime, s.drawCalls.total]);
      last = now;
    };
    app.on('frameupdate', begin); app.on('frameend', end);
    window.__probe = { frames, stop() { app.off('frameupdate', begin); app.off('frameend', end); return frames; } };
  });
  await cdp.send('Profiler.start');
  await page.waitForTimeout(seconds * 1000);
  const { profile } = await cdp.send('Profiler.stop');
  const frames = (await page.evaluate(() => window.__probe.stop())).slice(3);
  const column = i => frames.map(f => f[i]).filter(v => Number.isFinite(v));
  const mean = v => v.reduce((a, b) => a + b, 0) / Math.max(1, v.length);
  const sorted = column(0).sort((a, b) => a - b), cpu = column(1).sort((a, b) => a - b);
  const at = (v, q) => v[Math.min(v.length - 1, Math.floor(v.length * q))] ?? NaN;
  // Self time per function, and the time under each of the frame's own stages.
  const nodes = new Map(profile.nodes.map(n => [n.id, n]));
  const self = new Map();
  const dt = profile.timeDeltas, samples = profile.samples;
  let total = 0;
  for (let i = 0; i < samples.length; i++) { self.set(samples[i], (self.get(samples[i]) ?? 0) + dt[i]); total += dt[i]; }
  const name = n => `${n.callFrame.functionName || '(anonymous)'} ${n.callFrame.url.replace(/^.*\/(src|node_modules)\//, '$1/').replace(/\?.*$/, '').replace(/node_modules\/\.vite\/(\w+\/)?deps\/playcanvas\.js/, 'engine')}:${n.callFrame.lineNumber + 1}`;
  const byFunction = new Map();
  for (const [id, micros] of self) { const key = name(nodes.get(id)); byFunction.set(key, (byFunction.get(key) ?? 0) + micros); }
  const inclusive = new Map();
  const walk = (node, seen) => {
    let sum = self.get(node.id) ?? 0;
    const key = name(node), fresh = !seen.has(key);
    if (fresh) seen.add(key);
    for (const child of node.children ?? []) sum += walk(nodes.get(child), seen);
    if (fresh) { seen.delete(key); inclusive.set(key, (inclusive.get(key) ?? 0) + sum); }
    return sum;
  };
  walk(profile.nodes[0], new Set());
  const perFrame = micros => micros / 1000 / Math.max(1, frames.length);
  const rank = map => [...map].filter(([k]) => !/^\((program|idle|root)\)/.test(k)).sort((a, b) => b[1] - a[1]).slice(0, top).map(([k, v]) => ({ fn: k, ms: +perFrame(v).toFixed(3) }));
  const idle = [...byFunction].filter(([k]) => /^\((idle|program)\)/.test(k)).reduce((a, [, v]) => a + v, 0);
  const gc = [...byFunction].filter(([k]) => /^\(garbage collector\)/.test(k)).reduce((a, [, v]) => a + v, 0);
  return {
    label, frames: frames.length, frameMs: +mean(column(0)).toFixed(2), p95: +at(sorted, .95).toFixed(2), p99: +at(sorted, .99).toFixed(2), worst: +(sorted.at(-1) ?? NaN).toFixed(2),
    cpuMs: +mean(column(1)).toFixed(2), cpuP95: +at(cpu, .95).toFixed(2), updateMs: +mean(column(2)).toFixed(2), renderMs: +mean(column(3)).toFixed(2),
    draws: Math.round(mean(column(4))), gcMs: +perFrame(gc).toFixed(3), busy: +((total - idle) / total).toFixed(2),
    self: rank(byFunction), inclusive: rank(inclusive),
  };
}

const results = [];
const report = r => {
  console.log(`\n■ ${r.label}: frame ${r.frameMs} ms (p95 ${r.p95}, p99 ${r.p99}, worst ${r.worst}) · cpu ${r.cpuMs} (p95 ${r.cpuP95}; update ${r.updateMs}, render ${r.renderMs}) · ${r.draws} draws · gc ${r.gcMs} ms/frame`);
  console.log('  self ms/frame:'); for (const f of r.self) console.log(`    ${f.ms.toFixed(3)}  ${f.fn}`);
  console.log('  inclusive ms/frame:'); for (const f of r.inclusive) console.log(`    ${f.ms.toFixed(3)}  ${f.fn}`);
};
try {
  if (options.fight) {
    await page.goto(new URL(`/?${options.fight}`, base).href, { waitUntil: 'domcontentloaded' });
    await ready("!!window.gerard && !!document.querySelector('#battle:not([hidden]):not([data-entering])')");
    await page.waitForTimeout(2500);
    const r = await sample(`fight ${options.fight}`); results.push(r); report(r);
  } else {
    await page.goto(new URL(`/?story=${options.story}`, base).href, { waitUntil: 'domcontentloaded' });
    await ready('!!window.gerard');
    const places = positionals.length ? positionals : await page.evaluate(async () => Object.keys((await import('/src/environments.ts')).ENVIRONMENTS));
    for (const place of places) {
      const [id, cell] = place.split('@');
      const [x, z] = cell ? cell.split(',').map(Number) : [];
      await page.evaluate(([id, x, z]) => window.gerard.game.setEnvironment(id, x === undefined ? undefined : { x, z }), [id, x, z]);
      await page.waitForTimeout(3000);
      for (let i = 0; i < 40 && await page.evaluate(() => !!document.querySelector('#hud[data-dialogue]')); i++) { await page.keyboard.press('KeyE'); await page.waitForTimeout(200); }
      if (options.walk) { await page.keyboard.down('KeyS'); await page.keyboard.down('KeyD'); }
      const r = await sample(place + (options.walk ? ' (walking)' : ''));
      if (options.walk) { await page.keyboard.up('KeyS'); await page.keyboard.up('KeyD'); }
      results.push(r); report(r);
    }
  }
} finally {
  await browser.close();
  await vite?.close();
}
console.log(`\n${options.engine} engine · ${width}×${height} @${options.scale}x · ms a frame (frame holds the screen's pace; cpu is what it costs)`);
console.log('place                              frame   p95   p99  worst    cpu  update render  draws  gc');
for (const r of results) console.log(`${r.label.padEnd(33)} ${String(r.frameMs).padStart(6)} ${String(r.p95).padStart(5)} ${String(r.p99).padStart(5)} ${String(r.worst).padStart(6)} ${String(r.cpuMs).padStart(6)} ${String(r.updateMs).padStart(7)} ${String(r.renderMs).padStart(6)} ${String(r.draws).padStart(6)}  ${r.gcMs}`);
if (options.json) await writeFile(resolve(options.json), JSON.stringify(results, null, 1));
if (errors.length) console.error(`Page errors:\n${[...new Set(errors)].map(e => `  ${e}`).join('\n')}`);
