// Renders output/city/background.svg (tools/city.py build) into public/maps/barcelona.webp, the
// real city under the network map (docs/barcelona.md). Usage: node scripts/city-background.mjs [width]
import { chromium } from 'playwright';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

const root = new URL('..', import.meta.url);
const source = new URL('output/city/background.svg', root);
const target = new URL('public/maps/barcelona.webp', root);
const width = Number(process.argv[2] ?? 8192);

const svg = await readFile(source, 'utf8').catch(() => {
  console.error('No output/city/background.svg; run just city first.');
  process.exit(1);
});
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  const data = await page.evaluate(async ({ svg, width }) => {
    const [, , w, h] = svg.match(/viewBox="([^"]+)"/)[1].split(' ').map(Number);
    const height = Math.round(width * h / w);
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
    const image = new Image(width, height);
    image.src = url;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = width; canvas.height = height;
    canvas.getContext('2d').drawImage(image, 0, 0, width, height);
    return canvas.toDataURL('image/webp', .82);
  }, { svg, width });
  await mkdir(new URL('.', target), { recursive: true });
  const bytes = Buffer.from(data.split(',')[1], 'base64');
  await writeFile(target, bytes);
  console.log(`Wrote public/maps/barcelona.webp (${width} px wide, ${Math.round(bytes.length / 1024)} KB)`);
} finally {
  await browser.close();
}
