#!/usr/bin/env node
// Stitches the places report: one HTML fragment per contribution in <dir>/sections/*.html
// (a <section data-title data-group data-status> each, in file-name order) into <dir>/index.html.
// Usage: node scripts/places-report.mjs [--dir output/reports/places]
import { mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const { values } = parseArgs({ options: { dir: { type: 'string', default: resolve(root, 'output/reports/places') } } });
const dir = resolve(values.dir);
await mkdir(resolve(dir, 'sections'), { recursive: true });
await mkdir(resolve(dir, 'img'), { recursive: true });

const attr = (tag, name) => tag.match(new RegExp(`${name}="([^"]*)"`))?.[1] ?? '';
const files = (await readdir(resolve(dir, 'sections'))).filter(f => f.endsWith('.html')).sort();
const sections = [];
for (const file of files) {
  const html = (await readFile(resolve(dir, 'sections', file), 'utf8')).trim();
  const open = html.match(/<section\b[^>]*>/)?.[0];
  if (!open) { console.warn(`skip ${file}: no <section>`); continue; }
  const id = attr(open, 'id') || file.replace(/^\d+-|\.html$/g, '');
  const thumb = html.match(/<img[^>]*src="([^"]+)"/)?.[1];
  sections.push({ id, file, html, title: attr(open, 'data-title') || id, group: attr(open, 'data-group') || 'Otros', status: attr(open, 'data-status') || 'en curso', thumb });
}
const esc = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const groups = [...new Set(sections.map(s => s.group))];
const nav = groups.map(g => `<h3>${esc(g)}</h3><ul>${sections.filter(s => s.group === g).map(s => `<li><a href="#${esc(s.id)}"><span class="dot" data-status="${esc(s.status)}"></span>${esc(s.title)}</a></li>`).join('')}</ul>`).join('');
const overview = sections.filter(s => s.id !== 'overview').map(s => `<a class="tile" href="#${esc(s.id)}">${s.thumb ? `<img loading="lazy" src="${esc(s.thumb)}" alt="">` : '<div class="noimg"></div>'}<span class="tile-text"><small>${esc(s.group)}</small><strong>${esc(s.title)}</strong><span class="badge" data-status="${esc(s.status)}">${esc(s.status)}</span></span></a>`).join('');
const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ');

const page = `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Lugares y assets</title>
<style>
:root { --bg:#f6f3ee; --panel:#fffdf9; --ink:#1f1c19; --muted:#6c655c; --line:#e3ddd3; --accent:#c2410c; --ok:#15803d; --wip:#b45309; --todo:#94a3b8; color-scheme: light; }
@media (prefers-color-scheme: dark) { :root { --bg:#151412; --panel:#1d1b19; --ink:#efe9e1; --muted:#a39a8e; --line:#34302b; --accent:#fb923c; --ok:#4ade80; --wip:#fbbf24; --todo:#64748b; color-scheme: dark; } }
* { box-sizing: border-box; }
body { margin:0; background:var(--bg); color:var(--ink); font:15px/1.55 ui-sans-serif, -apple-system, "Segoe UI", sans-serif; }
aside { position:fixed; inset:0 auto 0 0; width:250px; overflow:auto; padding:22px 18px; border-right:1px solid var(--line); background:var(--panel); }
aside h1 { font-size:17px; margin:0 0 4px; } aside p { margin:0 0 16px; color:var(--muted); font-size:12px; }
aside h3 { font-size:11px; letter-spacing:.08em; text-transform:uppercase; color:var(--muted); margin:18px 0 6px; }
aside ul { list-style:none; margin:0; padding:0; } aside a { display:flex; gap:8px; align-items:center; padding:4px 6px; border-radius:6px; color:inherit; text-decoration:none; }
aside a:hover { background:var(--bg); }
.dot { width:8px; height:8px; border-radius:50%; background:var(--todo); flex:none; }
.dot[data-status="hecho"], .badge[data-status="hecho"] { background:var(--ok); } .dot[data-status="en curso"], .badge[data-status="en curso"] { background:var(--wip); }
main { margin-left:250px; padding:28px 40px 80px; max-width:1500px; }
.tiles { display:grid; grid-template-columns:repeat(auto-fill, minmax(230px, 1fr)); gap:14px; margin:18px 0 40px; }
.tile { display:flex; flex-direction:column; border:1px solid var(--line); border-radius:10px; overflow:hidden; background:var(--panel); color:inherit; text-decoration:none; }
.tile img, .noimg { width:100%; aspect-ratio:16/9; object-fit:cover; background:var(--line); display:block; }
.tile-text { padding:10px 12px; display:grid; gap:2px; } .tile small { color:var(--muted); font-size:11px; text-transform:uppercase; letter-spacing:.06em; }
.badge { justify-self:start; color:#fff; font-size:11px; padding:1px 8px; border-radius:20px; background:var(--todo); margin-top:4px; }
section { background:var(--panel); border:1px solid var(--line); border-radius:12px; padding:24px 28px; margin:0 0 28px; scroll-margin-top:16px; }
section h2 { margin:0 0 4px; font-size:24px; } section h3 { margin:22px 0 8px; font-size:16px; }
.lede { color:var(--muted); font-size:16px; margin:0 0 14px; }
.shots { display:grid; grid-template-columns:repeat(auto-fill, minmax(360px, 1fr)); gap:14px; }
figure { margin:0; } figure img { width:100%; border-radius:8px; border:1px solid var(--line); display:block; cursor:zoom-in; }
figcaption { font-size:13px; color:var(--muted); margin-top:6px; }
.ba { display:grid; grid-template-columns:1fr 1fr; gap:12px; } .ba figcaption::before { font-weight:600; color:var(--ink); }
.palette { display:flex; flex-wrap:wrap; gap:10px; margin:8px 0; } .swatch { display:grid; gap:4px; font-size:11px; color:var(--muted); width:84px; }
.swatch::before { content:""; height:44px; border-radius:6px; background:var(--c); border:1px solid var(--line); }
table { border-collapse:collapse; width:100%; font-size:13px; margin:8px 0; } th, td { text-align:left; border-bottom:1px solid var(--line); padding:6px 8px; vertical-align:top; } th { color:var(--muted); font-weight:600; }
code { font:12px ui-monospace, Menlo, monospace; background:var(--bg); padding:1px 5px; border-radius:4px; }
.note { border-left:3px solid var(--accent); padding:6px 12px; background:var(--bg); border-radius:0 6px 6px 0; }
#lightbox { position:fixed; inset:0; background:rgba(0,0,0,.88); display:none; place-items:center; z-index:9; cursor:zoom-out; } #lightbox img { max-width:96vw; max-height:94vh; }
</style></head><body>
<aside><h1>Lugares y assets</h1><p>Actualizado ${stamp} · ${sections.length} secciones</p>${nav}</aside>
<main>
<div class="tiles">${overview}</div>
${sections.map(s => s.html).join('\n')}
</main>
<div id="lightbox"><img alt=""></div>
<script>
const box = document.getElementById('lightbox');
document.addEventListener('click', e => {
  if (e.target.matches('figure img')) { box.firstElementChild.src = e.target.src; box.style.display = 'grid'; }
  else if (box.contains(e.target)) box.style.display = 'none';
});
</script>
</body></html>
`;
const tmp = resolve(dir, `.index.${process.pid}.html`);
await writeFile(tmp, page);
await rename(tmp, resolve(dir, 'index.html'));
console.log(`${resolve(dir, 'index.html')} · ${sections.length} sections`);
