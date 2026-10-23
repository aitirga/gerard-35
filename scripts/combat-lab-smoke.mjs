// Desktop browser acceptance check using the project's installed Playwright and private Vite.
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { createServer, preview } from 'vite';

const production = process.argv.includes('--build');
const server = production
  ? await preview({ logLevel: 'silent', preview: { host: '127.0.0.1', port: 5201, strictPort: false, open: false } })
  : await createServer({ logLevel: 'silent', server: { host: '127.0.0.1', port: 5201, strictPort: false, open: false, hmr: false, watch: null } });
if (!production) await server.listen();
const browser = await chromium.launch({ args: ['--no-proxy-server'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const temporary = await mkdtemp(join(tmpdir(), 'gerard-combat-lab-'));
const finished = () => page.waitForFunction(() => document.querySelector('#combat-lab')?.dataset.running === 'false', { timeout: 30000 });
try {
  await page.goto(new URL('/combat-lab.html', server.resolvedUrls.local[0]).href);
  await page.waitForFunction(() => document.querySelector('#combat-lab')?.dataset.ready === 'true', { timeout: 30000 });
  await finished();
  assert.equal(await page.locator('#comparison-body tr').count(), 3);
  assert.equal(await page.locator('.unit').count(), 6);
  assert.equal(await page.locator('#status').getAttribute('data-error'), 'false');
  for (const width of [1440, 1280]) {
    await page.setViewportSize({ width, height: 1000 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `horizontal overflow at ${width}`);
  }
  await page.setViewportSize({ width: 1440, height: 1000 });

  // Move forward and back; replaying a seed reconstructs the exact original frame.
  const originalFrame = await page.locator('#arena').innerHTML();
  await page.locator('#next').click();
  assert.match(await page.locator('#replay-position').textContent(), /Acción 1 \/ /);
  assert.notEqual(await page.locator('#arena').innerHTML(), originalFrame);
  await page.locator('#rewind').click();
  assert.equal(await page.locator('#arena').innerHTML(), originalFrame);
  await page.locator('#replay-run').click();
  assert.equal(await page.locator('#arena').innerHTML(), originalFrame);
  await page.locator('#replay-loss').click();
  assert.match(await page.locator('#replay-subtitle').textContent(), /derrota/);

  // A real file download must contain three complete reports on the same seeds.
  const downloadPromise = page.waitForEvent('download');
  await page.locator('#export').click();
  const download = await downloadPromise;
  const exportedPath = join(temporary, 'report.json');
  await download.saveAs(exportedPath);
  const exported = JSON.parse(await readFile(exportedPath, 'utf8'));
  assert.equal(exported.reports.length, 3);
  for (const report of exported.reports) {
    assert.deepEqual(report.seeds, exported.reports[0].seeds);
    assert.equal(report.runs.length, 200);
    assert.ok(report.sampleReplay.commands.length > 0);
  }

  // Cancellation preserves the last complete report, without freezing browser controls.
  const results = await page.locator('#metrics').textContent();
  await page.locator('[name=runs]').fill('5000');
  await page.locator('#run').click();
  await page.locator('#cancel').click();
  assert.match(await page.locator('#status').textContent(), /cancelada/);
  assert.equal(await page.locator('#metrics').textContent(), results);

  // All unfinished battles must count as draws, and a malformed edit cannot replace the baseline.
  await page.locator('[name=runs]').fill('12');
  await page.locator('[name=maxRounds]').fill('1');
  await page.locator('#run').click();
  await finished();
  assert.match(await page.locator('#status').textContent(), /36 combates completados/);
  assert.match(await page.locator('#interpretation').textContent(), /36 empates/);
  await page.locator('.editor summary').click();
  const baseline = await page.locator('#definition').inputValue();
  await page.locator('#definition').fill('{"id":"invalid"}');
  await page.locator('#apply-definition').click();
  assert.equal(await page.locator('#status').getAttribute('data-error'), 'true');
  await page.locator('#definition').fill(baseline);
  await page.locator('#apply-definition').click();
  await finished();
  assert.equal(await page.locator('#status').getAttribute('data-error'), 'false');
  assert.deepEqual(errors, []);
  console.log(`Combat lab ${production ? 'production' : 'development'}: comparison, desktop layout, replay, defeat inspection, download, cancellation and definition validation passed.`);
} finally {
  await browser.close();
  if (production) await new Promise(resolve => server.httpServer.close(resolve));
  else await server.close();
  await rm(temporary, { recursive: true, force: true });
}
