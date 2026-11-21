#!/usr/bin/env -S node --experimental-strip-types
// The ánimas' sheet (`just animas`): every ánima on one page, to read and check a design against the
// game. For each one, what the game has today, read from the code (stats, skills by level or node,
// passives, duals, what the jar sells), beside its design, the ánima's own doc (docs/animas/<id>/).
// Plus every dual, the shared mechanics and how ánimas grow, from docs/animas/README.md.
// Writes output/reports/animas/index.html: nothing to keep in step by hand.
// Each page has its notes beside it (src/anima-notes.ts, docs/anima-notes.json): served by the dev
// server (`just animas`, which writes this page again on every reload) they are written, edited and
// closed there; opened as a file they are read-only, as they were when it was written.
import { existsSync } from 'node:fs';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ANIMA_NOTES_ENDPOINT, ANIMA_NOTES_FILES, CHANGES, SHEET_PAGES } from '../src/anima-notes.ts';
import { ANIMA_NAMES, ANIMA_OWNERS, ANIMA_RULES, CLASS_STATS, DUALS, MANA_POINTS, PASSIVES, SKILLS } from '../src/battle.ts';
import { IMPROVEMENTS } from '../src/ecos.ts';
import { LEVELLED, LEVEL_XP, topOf } from '../src/levels.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const docs = resolve(root, 'docs/animas'), out = resolve(root, 'output/reports/animas');
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

// ——— Markdown, as much of it as the docs use ———
/** Inline marks. A link to another ánima's doc becomes a jump inside the page; any other, the file itself. */
function inline(text, from) {
  const kept = [];
  const keep = html => `\u0000${kept.push(html) - 1}\u0000`;
  let s = text.replace(/`([^`]+)`/g, (_, code) => keep(`<code>${esc(code)}</code>`));
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, href) => {
    const file = /^[a-z]+:/.test(href) ? undefined : resolve(from, href.split('#')[0] || '.');
    const anima = file?.match(/docs\/animas\/([^/]+)\/README\.md$/)?.[1];
    const to = anima ? `#${anima}` : file === resolve(docs, 'README.md') ? '#reglas' : file ? relative(out, file) : href;
    return keep(`<a href="${esc(to)}">`) + label + keep('</a>');
  });
  s = esc(s).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/\*([^*\s][^*]*)\*/g, '<em>$1</em>').replace(/(^|[\s(>])_([^_]+)_(?=$|[\s.,;:)<])/g, '$1<em>$2</em>');
  return s.replace(/\u0000(\d+)\u0000/g, (_, i) => kept[+i]);
}
const cells = row => row.trim().replace(/^\||\|$/g, '').split(/(?<!\\)\|/).map(cell => cell.trim());
/** Blocks: headings, tables, lists (nested by indent), fenced code, quotes and paragraphs. */
function markdown(source, from, shift = 0) {
  const lines = source.replace(/\r/g, '').split('\n'), html = [];
  const item = /^(\s*)([-*]|\d+\.)\s+/;
  for (let i = 0; i < lines.length;) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    if (line.startsWith('```')) {
      const code = [];
      for (i++; i < lines.length && !lines[i].startsWith('```'); i++) code.push(lines[i]);
      i++; html.push(`<pre>${esc(code.join('\n'))}</pre>`); continue;
    }
    const heading = line.match(/^(#{1,5})\s+(.*)$/);
    if (heading) { const level = Math.min(6, heading[1].length + shift); html.push(`<h${level}>${inline(heading[2], from)}</h${level}>`); i++; continue; }
    if (line.trim().startsWith('|') && /^\s*\|[\s:|-]+\|\s*$/.test(lines[i + 1] ?? '')) {
      const head = cells(line), rows = [];
      for (i += 2; i < lines.length && lines[i].trim().startsWith('|'); i++) rows.push(cells(lines[i]));
      html.push(`<div class="table"><table><thead><tr>${head.map(c => `<th>${inline(c, from)}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map(c => `<td>${inline(c, from)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`);
      continue;
    }
    const first = line.match(item);
    if (first) {
      const indent = first[1].length, ordered = /\d/.test(first[2]), items = [];
      while (i < lines.length) {
        const at = lines[i].match(item);
        if (at && at[1].length === indent) { items.push([lines[i].slice(at[0].length)]); i++; }
        else if (items.length && (!lines[i].trim() ? /^\s+\S/.test(lines[i + 1] ?? '') : /^\s/.test(lines[i]) && lines[i].search(/\S/) > indent)) { items.at(-1).push(lines[i].slice(Math.min(lines[i].search(/\S/) < 0 ? 0 : lines[i].search(/\S/), indent + 2))); i++; }
        else break;
      }
      const tag = ordered ? 'ol' : 'ul';
      html.push(`<${tag}>${items.map(body => `<li>${markdown(body.join('\n'), from, shift).replace(/^<p>([\s\S]*?)<\/p>/, '$1')}</li>`).join('')}</${tag}>`);
      continue;
    }
    if (line.startsWith('>')) {
      const quote = [];
      for (; i < lines.length && lines[i].startsWith('>'); i++) quote.push(lines[i].replace(/^>\s?/, ''));
      html.push(`<blockquote>${markdown(quote.join('\n'), from, shift)}</blockquote>`); continue;
    }
    const para = [];
    for (; i < lines.length && lines[i].trim() && !/^(#{1,5}\s|```|>)/.test(lines[i]) && !item.test(lines[i]) && !(lines[i].trim().startsWith('|') && /^\s*\|[\s:|-]+\|\s*$/.test(lines[i + 1] ?? '')); i++) para.push(lines[i].trim());
    html.push(`<p>${inline(para.join(' '), from)}</p>`);
  }
  return html.join('\n');
}
/** A doc cut by its `## ` sections: what comes before the first one, and each with its title. */
function sections(source) {
  const parts = source.split(/^## +/m);
  return { intro: parts[0], list: parts.slice(1).map(part => ({ title: part.slice(0, part.indexOf('\n')).trim(), body: part.slice(part.indexOf('\n') + 1) })) };
}

// ——— What the game has ———
const classesSource = await readFile(resolve(root, 'src/classes.ts'), 'utf8');
/** An ánima's motto and colour: src/classes.ts draws with PlayCanvas and cannot be loaded here, so its two strings are read. */
function identity(id) {
  const block = classesSource.match(new RegExp(`\\n  ${id}: \\{[\\s\\S]*?\\n  \\},`))?.[0] ?? '';
  return { motto: block.match(/motto: '([^']*)'/)?.[1], colour: block.match(/colour: '(#[0-9a-fA-F]+)'/)?.[1] };
}
// How the statuses and reactions look in a fight: src/status-fx.ts draws with PlayCanvas too, so its two catalogues are read as text.
const statusSource = await readFile(resolve(root, 'src/status-fx.ts'), 'utf8');
const catalogue = name => { const at = statusSource.indexOf(`export const ${name}`); return statusSource.slice(at, statusSource.indexOf('\n};', at)); };
const text = t => t.replace(/\\'/g, "'");
const STRING = String.raw`'((?:[^'\\]|\\.)*)'`;
const LOOKS = [...catalogue('STATUS_LOOKS').matchAll(new RegExp(String.raw`^  '?([\w-]+)'?: \{\s*name: ${STRING}, family: ${STRING}[^\n]*\n\s*shows: ${STRING}`, 'gm'))]
  .map(([, id, name, family, shows]) => ({ id, name: text(name), family: text(family), shows: text(shows) }));
const REACTION_LOOKS = [...catalogue('REACTIONS').matchAll(new RegExp(String.raw`^  '?([\w-]+)'?: \{ name: ${STRING}, status: '([\w-]+)', element: ${STRING}, leaves: ${STRING}, shows: ${STRING} \}`, 'gm'))]
  .map(([, id, name, status, element, leaves, shows]) => ({ id, name: text(name), status, element: text(element), leaves: text(leaves), shows: text(shows) }));
for (const [name, list] of [['STATUS_LOOKS', LOOKS], ['REACTIONS', REACTION_LOOKS]]) {
  const keys = (catalogue(name).match(/^  '?[\w-]+'?: \{/gm) ?? []).length;
  if (list.length !== keys) throw new Error(`scripts/animas.mjs: leídos ${list.length} de ${keys} en ${name} (src/status-fx.ts): ¿ha cambiado su forma?`);
}
const STATS = { pv: 'PV', fuerza: 'Fuerza', magia: 'Magia', defensa: 'Defensa', espiritu: 'Espíritu', critico: 'Crítico' };
const SIDES = { foes: 'un enemigo', 'all-foes': 'todos los enemigos', allies: 'un aliado', party: 'todo el equipo' };
const KINDS = { physical: 'físico', magic: 'mágico', heal: 'cura', boost: 'sube atributos', debuff: 'baja atributos', guard: 'protege' };
const PEOPLE = { gerard: 'Gerard', aitor: 'Aitor' };
/**
 * A row's tools: ▶ plays it on the stage (a real fight in a frame, `/?anima-demo`, src/anima-demo.ts;
 * only served), ✎ writes a note about it in the rail, and how many open notes it has.
 */
const tools = (item, name, play) => `<span class="tools">${play ? `<button type="button" class="play" data-play="${esc(JSON.stringify(play))}" data-play-name="${esc(name)}" title="Verlo en un combate">▶</button>` : ''}<button type="button" class="pen" data-about="${item}" data-about-name="${esc(name)}" title="Una nota sobre ${esc(name)}">✎</button><span class="mark" data-item-mark="${item}"></span></span>`;
const pips = n => `<span class="pips" title="${n} de maná">${'<i></i>'.repeat(n)}</span>`;
const skillOf = id => SKILLS.find(s => s.id === id);
/** What a skill is, in a line of chips read from its own data. */
function chips(skill) {
  const list = [`${KINDS[skill.kind] ?? skill.kind} ${skill.power ?? ''}`.trim()];
  if (skill.strikes) list.push(`× ${skill.strikes} golpes`);
  if (skill.split) list.push(`× ${skill.split} golpes`);
  if (skill.element) list.push(skill.element);
  if (skill.bleed) list.push(`sangrado +${skill.bleed}`);
  if (skill.deep) list.push('abre la herida el doble');
  if (skill.charge) list.push('se carga un turno');
  if (skill.abstract) list.push('abstracta');
  return [...list, SIDES[skill.side] ?? skill.side].map(c => `<span class="chip">${esc(c)}</span>`).join('');
}
const skillRow = (skill, when) => `<tr data-item="skill:${skill.id}"><td>${tools(`skill:${skill.id}`, skill.name, { skill: skill.id })}</td><td class="when">${when}</td><td><strong>${esc(skill.name)}</strong></td><td>${pips(skill.cost)}</td><td>${chips(skill)}</td><td class="say">${esc(skill.description)}</td></tr>`;
/** What the game has of an ánima today, all from the code. */
function built(id) {
  const stats = Object.entries(CLASS_STATS[id] ?? {}).map(([stat, n]) => `<span class="stat" data-sign="${n < 0 ? 'down' : 'up'}">${STATS[stat] ?? stat} ${n > 0 ? '+' : '−'}${Math.abs(n)}</span>`).join('') || '<span class="none">Ninguno</span>';
  const mine = SKILLS.filter(s => s.class === id);
  const nodes = IMPROVEMENTS.filter(i => i.anima === id);
  const levelled = LEVELLED.includes(id);
  const when = s => 'face' in s ? 'Cara' : s.node ? `Bote · ${nodes.find(n => n.skill === s.id)?.cost ?? '?'} eco` : `Nv ${s.level ?? 1}`;
  const order = s => s.node ? 100 : s.level ?? 1;
  const skills = mine.length ? `<div class="table"><table><thead><tr><th></th><th>Viene con</th><th>Habilidad</th><th>Maná</th><th>Qué es</th><th>Descripción en el juego</th></tr></thead><tbody>${[...mine].sort((a, b) => order(a) - order(b)).map(s => skillRow(s, when(s))).join('')}</tbody></table></div>` : '<p class="none">Ninguna habilidad en el juego todavía.</p>';
  // The rule an ánima has from level 1 (Dadista's Racha) goes first, with what the game says of it.
  const rule = ANIMA_RULES[id] ? `<li data-item="regla:${id}"><strong>${esc(ANIMA_RULES[id].name)}</strong> <small>regla · nivel 1</small> ${tools(`regla:${id}`, ANIMA_RULES[id].name)}<br>${esc(ANIMA_RULES[id].description)}</li>` : '';
  const passives = Object.entries(PASSIVES).filter(([, p]) => p.anima === id).map(([key, p]) => { const node = nodes.find(n => n.kind === 'passive' && n.name === p.name); return `<li data-item="pasiva:${key}"><strong>${esc(p.name)}</strong>${node ? ` <small>bote · ${node.cost} ecos</small>` : ''} ${tools(`pasiva:${key}`, p.name)}${node ? `<br>${esc(node.description)}` : ''}</li>`; }).join('');
  const duals = DUALS.filter(d => d.parts.some(part => skillOf(part)?.class === id)).map(dualRow).join('');
  const jar = nodes.filter(n => n.kind !== 'skill' && n.kind !== 'passive').map(n => `<span class="chip">${n.kind === 'dual' ? 'Dúo mayor · ' : ''}${esc(n.name)} · ${n.cost} eco${n.cost > 1 ? 's' : ''}${n.veiled ? ' · duerme' : ''}</span>`).join('');
  return `
    <div class="facts">
      <div><small>De quién</small><b>${ANIMA_OWNERS[id] ? `Propia de ${PEOPLE[ANIMA_OWNERS[id]]}` : 'Compartida'}</b></div>
      <div><small>Crece</small><b>${levelled ? `Por niveles (EXP ${LEVEL_XP.slice(0, topOf(id) - 1).join(' · ')})` : ANIMA_OWNERS[id] ? 'Árbol en el bote' : 'No crece aún'}</b></div>
      <div><small>Maná</small><b>${MANA_POINTS}</b></div>
      <div><small>Atributos de quien la lleva</small><b class="stats">${stats}</b></div>
    </div>
    <h4>Habilidades</h4>${skills}
    <h4>Pasivas</h4>${rule || passives ? `<ul class="plain">${rule}${passives}</ul>` : '<p class="none">Ninguna.</p>'}
    <h4>Dúos de los que es mitad</h4>${duals ? dualTable(duals) : '<p class="none">Ninguno.</p>'}
    <h4>En el bote</h4><p>${jar || '<span class="none">Nada.</span>'}</p>`;
}
const dualTable = rows => `<div class="table"><table><thead><tr><th></th><th>Dúo</th><th>Pareja</th><th>Mitades</th><th>Qué es</th><th>Descripción en el juego</th></tr></thead><tbody>${rows}</tbody></table></div>`;
function dualRow(dual) {
  const halves = dual.parts.map(skillOf);
  const pair = halves.map(s => `<a href="#${s.class}">${esc(ANIMA_NAMES[s.class])}</a>`).join(' + ');
  const parts = halves.map(s => `${esc(s.name)} ${pips(s.cost)} <small>${s.node ? 'bote' : `nv ${s.level ?? 1}`}</small>`).join('<br>');
  return `<tr data-item="dual:${dual.id}"><td>${tools(`dual:${dual.id}`, dual.name, { dual: dual.id })}</td><td><strong>${esc(dual.name)}</strong></td><td>${pair}</td><td>${parts}</td><td>${chips(dual)}</td><td class="say">${esc(dual.description)}</td></tr>`;
}

// ——— The page ———
const rules = sections(await readFile(resolve(docs, 'README.md'), 'utf8'));
const rule = title => rules.list.find(s => s.title.startsWith(title));
const ids = (await readdir(docs, { withFileTypes: true })).filter(d => d.isDirectory() && existsSync(resolve(docs, d.name, 'README.md'))).map(d => d.name);
// In the game first, in the order the game names them; then the ones that are only a design.
const ordered = [...Object.keys(ANIMA_NAMES).filter(id => ids.includes(id)), ...ids.filter(id => !(id in ANIMA_NAMES))];
const animas = [];
for (const id of ordered) {
  const dir = resolve(docs, id), source = await readFile(resolve(dir, 'README.md'), 'utf8');
  const doc = sections(source), inGame = id in ANIMA_NAMES, who = identity(id);
  const name = source.match(/^# +(.*)$/m)?.[1] ?? id;
  const status = doc.intro.match(/^Status:\s*([\s\S]*?)(?:\n\s*\n|$(?![\s\S]))/m)?.[1].replace(/\s+/g, ' ') ?? '';
  const gallery = existsSync(resolve(root, 'output/screenshots', id, 'index.html')) ? relative(out, resolve(root, 'output/screenshots', id, 'index.html')) : undefined;
  animas.push({ id, name, inGame, status, gallery, colour: who.colour ?? '#8f8a73', motto: who.motto, doc, dir });
}
const view = (id, title, body) => `<section class="view" id="${id}" data-title="${esc(title)}">${body}</section>`;
const fold = (section, dir, open = false) => `<details${open ? ' open' : ''}><summary>${esc(section.title)}</summary>${markdown(section.body, dir, 2)}</details>`;
/**
 * An ánima's definitiva, on its own card: what its doc's `## Definitiva: <name>` section says (the
 * table's rows, the text the game will show, and how it works under it), or, until that ánima has
 * been designed, its row in the shared table (README § Definitivas). Whether the game has it is read
 * from the code: a skill of that name.
 */
const ULT_LABELS = { 'Wakes in a fight when': 'Se despierta cuando', Then: 'Entonces', 'In the game': 'En el juego' };
function definitiva(a) {
  const own = a.doc.list.find(s => /^Definitiva\b/.test(s.title));
  const row = rule('Definitivas')?.body.split('\n').filter(l => l.trim().startsWith('|')).map(cells).find(r => r[0] === a.name);
  if (!own && !row) return '';
  let name, text, facts = [], more = '';
  if (own) {
    name = own.title.split(':').slice(1).join(':').trim();
    const lines = own.body.split('\n'), table = lines.filter(l => /^\|\s*\*\*/.test(l)).map(cells).map(([label, value]) => [label.replace(/\*\*/g, ''), value]);
    text = table.find(([label]) => label === 'In the game')?.[1].replace(/`/g, '');
    facts = table.filter(([label]) => label !== 'In the game');
    const last = lines.findLastIndex(l => l.trim().startsWith('|'));
    more = lines.slice(last + 1).join('\n').trim();
  } else {
    const told = row[2].match(/^\*([^*]+)\*:?\s*(.*)$/);
    name = told?.[1] ?? row[2]; facts = [['Wakes in a fight when', row[1]], ['What it does', told?.[2] ?? '']];
  }
  const skill = SKILLS.find(s => s.name === name), inGame = !!skill;
  const item = skill ? `skill:${skill.id}` : `definitiva:${a.id}`;
  return `<article class="card ult" style="--c:${a.colour}" data-item="${item}">
    <h2>Definitiva <small>una vez por combate · gasta el turno · sin maná · se compra en el bote</small></h2>
    <div class="ult-head"><h3>${esc(name)}</h3>${tools(item, name, skill && { skill: skill.id })}<span class="state${inGame ? ' on' : ''}">${inGame ? 'En el juego' : own ? 'Diseñada · todavía no está en el juego' : 'Solo la idea · su ánima aún no se ha repasado'}</span></div>
    ${text ? `<p class="ult-text">${esc(text)}</p>` : ''}
    <dl>${facts.map(([label, value]) => `<dt>${esc(ULT_LABELS[label] ?? label)}</dt><dd>${inline(value, a.dir)}</dd>`).join('')}</dl>
    ${more ? `<details><summary>Cómo funciona</summary>${markdown(more, a.dir, 2)}</details>` : ''}
  </article>`;
}
const animaView = a => view(a.id, a.name, `
  <header class="hero" style="--c:${a.colour}">
    <h1>${esc(a.name)}</h1>
    ${a.motto ? `<p class="motto">«${esc(a.motto)}»</p>` : ''}
    <p class="status">${inline(a.status, a.dir)}</p>
    <p class="links">${a.gallery ? `<a href="${esc(a.gallery)}">Capturas y clips</a> · ` : ''}<a href="${esc(relative(out, resolve(a.dir, 'README.md')))}">docs/animas/${a.id}/README.md</a></p>
  </header>
  ${definitiva(a)}
  <div class="cols">
    <article class="card"><h2>Diseño <small>lo que se quiere que sea · su doc</small></h2>${a.doc.list.filter(s => !/^Definitiva\b/.test(s.title)).map((s, i) => fold(s, a.dir, i < 6)).join('')}</article>
    <article class="card game"><h2>En el juego hoy <small>leído del código</small></h2>${a.inGame ? built(a.id) : '<p class="none">Todavía no existe en el juego: solo su diseño.</p>'}</article>
  </div>`);
const catalogueRule = rule('Catalogue'), combined = rule('Combined skills'), shared = rule('Shared mechanics');
const grow = ['Two ways to grow', 'Levels', 'Ecos de luz', 'Growth opens with the castle', 'Definitivas', 'Ánima points'].map(rule).filter(Boolean);
const mark = id => `<span class="mark" data-mark="${id}"></span>`;
const views = [
  view('catalogo', SHEET_PAGES.catalogo, `<header class="hero"><h1>Ánimas</h1><p class="status">Cada ánima con su diseño al lado de lo que el juego tiene hoy. Se escribe de nuevo con <code>just animas</code> (al recargar) o <code>just animas-report</code>.</p></header>
    <div class="tiles">${animas.map(a => `<a class="tile" href="#${a.id}" style="--c:${a.colour}"><strong>${esc(a.name)}</strong><span>${a.motto ? `«${esc(a.motto)}»` : ''}</span><small>${a.inGame ? `${SKILLS.filter(s => s.class === a.id).length} habilidades en el juego` : 'Solo diseño'} ${mark(a.id)}</small></a>`).join('')}</div>
    <article class="card">${catalogueRule ? markdown(catalogueRule.body, docs, 2) : ''}</article>`),
  ...animas.map(animaView),
  view('duos', SHEET_PAGES.duos, `<header class="hero"><h1>Dúos</h1><p class="status">Dos habilidades de dos ánimas, una de cada jugador, que se vuelven una sola acción.</p></header>
    <article class="card game"><h2>En el juego hoy <small>leído del código</small></h2>${dualTable(DUALS.map(dualRow).join(''))}</article>
    <article class="card"><h2>Diseño <small>reglas, parejas e ideas</small></h2>${combined ? markdown(combined.body, docs, 2) : ''}</article>`),
  view('mecanicas', SHEET_PAGES.mecanicas, `<header class="hero"><h1>Mecánicas compartidas</h1><p class="status">Estados y reglas que más de un ánima puede poner o aprovechar.</p></header>
    <article class="card game"><h2>En el juego hoy <small>cómo se ven · ▶ los pone en el perro del medio</small></h2>
      <h4>Estados</h4><div class="table"><table><thead><tr><th></th><th>Estado</th><th>De</th><th>Cómo se ve</th></tr></thead><tbody>${LOOKS.map(l => `<tr data-item="estado:${l.id}"><td>${tools(`estado:${l.id}`, l.name, { status: l.id })}</td><td><strong>${esc(l.name)}</strong></td><td class="when">${esc(l.family)}</td><td class="say">${esc(l.shows)}</td></tr>`).join('')}</tbody></table></div>
      <h4>Reacciones</h4><div class="table"><table><thead><tr><th></th><th>Reacción</th><th>Sobre</th><th>Con</th><th>Deja</th><th>Cómo se ve</th></tr></thead><tbody>${REACTION_LOOKS.map(r => `<tr data-item="reaccion:${r.id}"><td>${tools(`reaccion:${r.id}`, r.name, { reaction: r.id })}</td><td><strong>${esc(r.name)}</strong></td><td class="when">${esc(LOOKS.find(l => l.id === r.status)?.name ?? r.status)}</td><td class="when">${esc(r.element)}</td><td>${esc(r.leaves)}</td><td class="say">${esc(r.shows)}</td></tr>`).join('')}</tbody></table></div>
    </article>
    <article class="card"><h2>Diseño <small>docs/animas/README.md</small></h2>${shared ? markdown(shared.body, docs, 2) : ''}</article>`),
  view('reglas', SHEET_PAGES.reglas, `<header class="hero"><h1>Cómo crecen</h1><p class="status">Niveles, el bote, los ecos de luz y las definitivas.</p></header><article class="card">${grow.map((s, i) => fold(s, docs, i === 0)).join('')}</article>`),
  view('notas', 'Notas', `<header class="hero"><h1>Notas</h1><p class="status">Lo anotado en cada ánima y página de la hoja, en <code>docs/anima-notes.json</code>. Las abiertas las lee <code>/anima</code>, que contesta debajo de cada una.</p></header><div id="all-notes"></div>`),
];
const right = (id, extra = '') => `<span class="right">${mark(id)}${extra}</span>`;
const nav = `<a href="#catalogo">Catálogo${right('catalogo')}</a><a href="#notas">Notas<span class="right"><span class="mark" id="open-count"></span></span></a>
  <h3>Ánimas</h3>${animas.map(a => `<a href="#${a.id}"><i class="dot" style="--c:${a.colour}"></i>${esc(a.name)}${right(a.id, a.inGame ? '' : '<small>diseño</small>')}</a>`).join('')}
  <h3>De todas</h3>${['duos', 'mecanicas', 'reglas'].map(id => `<a href="#${id}">${SHEET_PAGES[id]}${right(id)}</a>`).join('')}`;
/** The notes as they were when the page was written: what it shows opened as a file, with no server to ask. */
const notesFile = resolve(root, ANIMA_NOTES_FILES.real);
const notesAtWrite = existsSync(notesFile) ? JSON.parse(await readFile(notesFile, 'utf8')) : { notes: [] };

const page = `<!doctype html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Ánimas · Gerard 35</title>
<style>
  :root { --bg: #14170f; --panel: #1b1f16; --line: #ffffff1c; --text: #ece6cf; --soft: #c7c1a6; --dim: #8f8a73; --gold: #f3cf78; --game: #7fc88f; --open: #f0a35a; --bad: #e0707a; }
  * { box-sizing: border-box; }
  html, body { margin: 0; background: var(--bg); color: var(--text); font: 14px/1.5 'DM Sans', system-ui, sans-serif; }
  a { color: var(--gold); text-decoration: none; } a:hover { text-decoration: underline; }
  code { background: #ffffff10; border-radius: 3px; padding: 0 4px; font: 12px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace; color: var(--soft); }
  pre { background: #0e100b; border: 1px solid var(--line); border-radius: 4px; padding: 10px 12px; overflow: auto; font: 12px/1.45 ui-monospace, Menlo, monospace; color: var(--soft); }
  #app { display: grid; grid-template-columns: 230px minmax(0, 1fr) clamp(520px, 40vw, 820px); min-height: 100vh; }
  #app[data-view="notas"] { grid-template-columns: 230px minmax(0, 1fr); } #app[data-view="notas"] #rail { display: none; }
  nav { position: sticky; top: 0; align-self: start; height: 100vh; overflow: auto; border-right: 1px solid var(--line); padding: 16px 10px; }
  nav h3 { margin: 16px 8px 4px; font-size: 10px; letter-spacing: .16em; text-transform: uppercase; color: var(--dim); font-weight: 600; }
  nav a { display: flex; align-items: center; gap: 8px; padding: 5px 8px; border-radius: 3px; color: var(--soft); }
  nav a:hover { background: #ffffff0d; text-decoration: none; } nav a[aria-current="true"] { background: #f3cf7826; color: var(--text); }
  nav a .right { margin-left: auto; display: flex; gap: 6px; align-items: baseline; } nav a small { color: var(--dim); font-size: 11px; }
  .mark { color: var(--open); font-size: 11px; font-weight: 600; white-space: nowrap; } .mark:empty { display: none; }
  #rail { position: sticky; top: 0; align-self: start; height: 100vh; overflow: auto; border-left: 1px solid var(--line); background: #171a12; padding: 14px 14px 40px; }
  #rail > h2, #notes > h2 { margin: 0 0 10px; font-size: 12px; letter-spacing: .16em; text-transform: uppercase; color: var(--gold); }
  /* The stage: the game in a frame, in a fight that never ends (src/anima-demo.ts). */
  #stage { margin-bottom: 16px; }
  #stage .stage-head { display: flex; align-items: center; gap: 6px; margin-bottom: 6px; } #stage .stage-head h2 { margin: 0 auto 0 0; font-size: 12px; letter-spacing: .16em; text-transform: uppercase; color: var(--game); }
  #stage .screen { position: relative; aspect-ratio: 16 / 9; background: #0b0d08; border: 1px solid #7fc88f55; border-radius: 4px; overflow: hidden; }
  /* The game is drawn at 1280 × 720, as on a screen, and scaled to the box (\`fit\`), so its HUD keeps its proportions. */
  #stage iframe { position: absolute; left: 0; top: 0; width: 1280px; height: 720px; border: 0; transform-origin: 0 0; }
  /* A layer over the frame: a click enlarges the stage (or shrinks it back), and keeps the keys on the page for ← / →. */
  #stage .screen .zoom { position: absolute; inset: 0; z-index: 1; cursor: zoom-in; } #stage.big .screen .zoom { cursor: zoom-out; }
  #stage .stage-keys { margin: 0 0 6px; font-size: 11px; color: var(--dim); white-space: nowrap; }
  #stage .screen p { position: absolute; inset: 0; display: grid; place-items: center; margin: 0; padding: 16px; text-align: center; color: var(--dim); font-size: 12px; }
  #stage .stage-say { min-height: 1.5em; margin: 6px 0 0; font-size: 12px; color: var(--soft); } #stage .stage-say.bad { color: var(--bad); }
  #stage.big { position: fixed; z-index: 10; inset: 4vh 4vw; margin: 0; padding: 12px 14px; background: #171a12; border: 1px solid var(--line); border-radius: 6px; box-shadow: 0 0 0 100vmax #000000b0; display: flex; flex-direction: column; }
  #stage.big .screen { flex: 1; aspect-ratio: auto; } #stage.big .screen iframe { left: 50%; top: 50%; }
  body:not([data-served]) .play, body:not([data-served]) #stage { display: none; }
  .tools { display: inline-flex; gap: 3px; align-items: center; vertical-align: middle; white-space: nowrap; }
  .tools button { padding: 0 7px; font-size: 12px; line-height: 20px; }
  .tools .play { color: var(--game); border-color: #7fc88f66; } .tools .play:hover { background: #7fc88f26; }
  [data-item].playing { background: #7fc88f14; } [data-item].flash { animation: flash 1.6s ease-out; }
  @keyframes flash { from { background: #f3cf7840; } to { background: transparent; } }
  .ult-head .tools { align-self: center; }
  .about { display: flex; flex-wrap: wrap; gap: 4px; align-items: center; margin-bottom: 6px; font-size: 12px; }
  .about .chip { cursor: default; } .about .chip button { all: unset; cursor: pointer; margin-left: 4px; color: var(--dim); } .about .chip button:hover { color: var(--text); }
  .change-chips { display: flex; flex-wrap: wrap; gap: 4px; align-items: center; margin-bottom: 6px; font-size: 12px; color: var(--dim); }
  .change-chips button { font-size: 11px; padding: 1px 8px; border-radius: 99px; }
  .tag { display: inline-block; padding: 0 7px; border-radius: 99px; font-size: 11px; background: #ffffff10; border: 1px solid #ffffff1c; color: var(--soft); }
  .tag.item { cursor: pointer; color: var(--gold); border-color: #f3cf7855; } .tag.change { color: var(--open); border-color: #f0a35a66; }
  #notes > h2 { margin: 0 0 10px; font-size: 12px; letter-spacing: .16em; text-transform: uppercase; color: var(--gold); }
  #notes > h2 small { color: var(--dim); letter-spacing: 0; text-transform: none; font-weight: 400; margin-left: 6px; font-size: 12px; }
  button { padding: 4px 10px; border: 1px solid #ffffff2a; border-radius: 3px; background: #ffffff0d; color: var(--text); font: inherit; font-size: 12px; cursor: pointer; }
  button:hover { background: #ffffff1f; } button.primary { background: var(--gold); border-color: var(--gold); color: #1a1a12; } button.danger { background: var(--bad); border-color: var(--bad); color: #1a1a12; }
  button[aria-pressed="true"] { background: #f3cf7826; border-color: var(--gold); }
  textarea { display: block; width: 100%; padding: 7px 9px; background: #0e100b; color: var(--text); border: 1px solid var(--line); border-radius: 3px; font: inherit; resize: vertical; }
  textarea:focus { outline: none; border-color: var(--gold); }
  .note-form { margin-bottom: 12px; } .note-save { display: flex; justify-content: flex-end; align-items: center; gap: 8px; margin-top: 6px; }
  .note { padding: 9px 0; border-top: 1px solid #ffffff12; } .note.hecha, .note.descartada { opacity: .6; }
  .note-head { display: flex; flex-wrap: wrap; gap: 4px 8px; align-items: baseline; font-size: 12px; } .note-head small { margin-left: auto; }
  .note .state { font-size: 10px; letter-spacing: .1em; text-transform: uppercase; color: var(--dim); } .note.abierta .state { color: var(--open); }
  .note p { margin: 5px 0; color: var(--text); overflow-wrap: anywhere; }
  .note .reply { border-left: 2px solid var(--game); padding-left: 8px; color: var(--soft); } .note .reply b { display: block; color: var(--game); font-size: 10px; font-weight: 600; letter-spacing: .1em; text-transform: uppercase; }
  .note textarea { margin-top: 6px; }
  .note-actions { display: flex; flex-wrap: wrap; gap: 4px; align-items: center; margin-top: 6px; } .note-actions button { font-size: 11px; padding: 2px 8px; } .note-actions small { margin-left: auto; }
  .ro { font-size: 12px; } .err { color: var(--bad); font-size: 12px; }
  .toggle { display: flex; gap: 4px; margin-bottom: 14px; }
  #all-notes .card h2 a { color: inherit; }
  .dot { width: 10px; height: 10px; border-radius: 50%; background: var(--c); flex: none; }
  main { padding: 22px 28px 80px; min-width: 0; }
  .view { display: none; } .view.on { display: block; }
  .hero { border-left: 4px solid var(--c, var(--gold)); padding: 2px 0 2px 16px; margin-bottom: 18px; }
  .hero h1 { margin: 0; font-size: 30px; letter-spacing: .01em; color: var(--c, var(--text)); }
  .hero p { margin: 4px 0; color: var(--soft); max-width: 110ch; } .hero .motto { font-style: italic; color: var(--text); font-size: 16px; } .hero .links { font-size: 12px; }
  .cols { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 18px; align-items: start; }
  @media (max-width: 1800px) { .cols { grid-template-columns: minmax(0, 1fr); } }
  .card { background: var(--panel); border: 1px solid var(--line); border-radius: 6px; padding: 14px 18px 18px; margin-bottom: 18px; min-width: 0; }
  .card.game { border-color: #7fc88f55; }
  .card.ult { border-color: color-mix(in srgb, var(--c) 55%, transparent); border-left: 4px solid var(--c); }
  .card.ult h2 { color: var(--c); }
  .ult-head { display: flex; align-items: baseline; gap: 14px; flex-wrap: wrap; }
  .ult-head h3 { margin: 0; font-size: 26px; letter-spacing: -.01em; color: var(--text); }
  .ult-head .state { font-size: 11px; letter-spacing: .08em; text-transform: uppercase; color: var(--dim); border: 1px solid var(--line); border-radius: 99px; padding: 2px 10px; }
  .ult-head .state.on { color: var(--game); border-color: #7fc88f55; }
  .ult-text { margin: 10px 0 14px; padding: 10px 14px; border-radius: 4px; background: #00000030; font-size: 16px; line-height: 1.45; color: var(--text); }
  .card.ult dl { display: grid; grid-template-columns: max-content 1fr; gap: 6px 16px; margin: 0 0 6px; }
  .card.ult dt { color: var(--dim); font-size: 12px; letter-spacing: .06em; text-transform: uppercase; padding-top: 2px; }
  .card.ult dd { margin: 0; color: var(--soft); }
  @media (max-width: 700px) { .card.ult dl { grid-template-columns: 1fr; } }
  .card h2 { margin: 0 0 10px; font-size: 12px; letter-spacing: .16em; text-transform: uppercase; color: var(--gold); } .card.game h2 { color: var(--game); }
  .card h2 small { color: var(--dim); letter-spacing: 0; text-transform: none; font-weight: 400; margin-left: 8px; font-size: 12px; }
  h3, h4, h5, h6 { margin: 16px 0 6px; font-size: 14px; color: var(--text); } h4 { font-size: 11px; letter-spacing: .14em; text-transform: uppercase; color: var(--dim); }
  .card details h4 { letter-spacing: 0; text-transform: none; font-size: 14px; color: var(--text); }
  p { margin: 6px 0; color: var(--soft); max-width: 110ch; } li { color: var(--soft); margin: 3px 0; max-width: 110ch; } ul, ol { padding-left: 20px; margin: 6px 0; } ul.plain { list-style: none; padding: 0; }
  strong { color: var(--text); } small { color: var(--dim); }
  .table { overflow-x: auto; margin: 8px 0; }
  table { border-collapse: collapse; width: 100%; font-size: 13px; } th, td { text-align: left; padding: 6px 12px 6px 0; vertical-align: top; border-bottom: 1px solid #ffffff12; }
  th { color: var(--dim); font-weight: 500; font-size: 11px; letter-spacing: .06em; text-transform: uppercase; white-space: nowrap; } td { color: var(--soft); }
  td.when { white-space: nowrap; color: var(--dim); } td.say { color: var(--text); min-width: 26ch; }
  details { border-top: 1px solid #ffffff12; padding: 2px 0; } details:first-of-type { border-top: 0; }
  summary { cursor: pointer; padding: 7px 0; font-weight: 600; color: var(--text); font-size: 15px; } summary:hover { color: var(--gold); }
  .facts { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 8px; }
  .facts div { background: #ffffff08; border-radius: 4px; padding: 7px 10px; } .facts small { display: block; font-size: 11px; } .facts b { font-weight: 600; }
  .stat { display: inline-block; margin-right: 8px; } .stat[data-sign="up"] { color: var(--game); } .stat[data-sign="down"] { color: #e0707a; }
  .chip { display: inline-block; padding: 1px 8px; margin: 1px 4px 1px 0; border-radius: 99px; background: #ffffff10; border: 1px solid #ffffff1c; font-size: 12px; color: var(--soft); white-space: nowrap; }
  .pips { display: inline-flex; gap: 3px; vertical-align: middle; } .pips i { width: 9px; height: 9px; border-radius: 50%; background: var(--gold); }
  .none { color: var(--dim); font-style: italic; }
  .tiles { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 10px; margin-bottom: 18px; }
  .tile { display: flex; flex-direction: column; gap: 3px; background: var(--panel); border: 1px solid var(--line); border-left: 4px solid var(--c); border-radius: 6px; padding: 10px 14px; color: var(--soft); }
  .tile:hover { background: #ffffff0d; text-decoration: none; } .tile strong { color: var(--c); font-size: 17px; } .tile span { font-style: italic; font-size: 13px; min-height: 1.5em; }
  blockquote { margin: 8px 0; padding: 2px 12px; border-left: 3px solid var(--line); }
</style>
</head>
<body>
<div id="app"><nav>${nav}</nav><main>${views.join('\n')}</main><aside id="rail">
  <section id="stage"><div class="stage-head"><h2>Escenario</h2><button type="button" data-stage="again" disabled>Repetir</button><button type="button" data-stage="big" aria-pressed="false">Ampliar</button></div>
    <p class="stage-keys" hidden>← → otra habilidad · clic para ampliar · Esc para cerrar</p>
    <div class="screen"><p>Pulsa ▶ en una habilidad, un dúo, un estado o una reacción para verlo en un combate de verdad: Gerard y Aitor contra tres perros, con todo desbloqueado y sin que nadie caiga.</p></div>
    <p class="stage-say"></p></section>
  <div id="notes"></div>
</aside></div>
<script type="application/json" id="notes-at-write">${JSON.stringify(notesAtWrite).replace(/</g, '\\u003c')}</script>
<script>
  // ——— Notes (src/anima-notes.ts): written through the dev server when there is one (just animas) ———
  const query = new URLSearchParams(location.search);
  const endpoint = '${ANIMA_NOTES_ENDPOINT}' + (query.get('notas') === 'scratch' ? '?archivo=scratch' : '');
  const VIEWS = Object.fromEntries([...document.querySelectorAll('.view')].map(v => [v.id, v.dataset.title]));
  const STATES = { abierta: 'Abierta', hecha: 'Hecha', descartada: 'Descartada' };
  const CHANGES = ${JSON.stringify(CHANGES)};
  const served = location.protocol.startsWith('http');
  if (served) document.body.dataset.served = '';
  let notes = JSON.parse(document.getElementById('notes-at-write').textContent).notes;
  let writable = false, loaded = false, error = '', current = 'catalogo', showAll = false;
  /**
   * What is being typed: a new note per page, with what on it it is about (✎ on a row) and what it
   * asks to change; the note whose text is being changed, the one whose Borrar was pressed once.
   */
  const drafts = {}, abouts = {}, changing = {};
  let editing, confirming;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const lines = s => esc(s).replace(/\\n/g, '<br>');
  const isoNow = () => new Date().toISOString().replace(/\\.\\d{3}Z$/, 'Z');
  const when = iso => new Date(iso).toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  const open = entry => notes.filter(n => n.status === 'abierta' && (!entry || n.entry === entry));
  const newestOpenFirst = list => [...list].sort((a, b) => (b.status === 'abierta') - (a.status === 'abierta') || b.created.localeCompare(a.created));
  const here = () => current === 'notas' ? '#all-notes' : '#notes';

  async function fetchNotes() {
    const answer = await fetch(endpoint, { cache: 'no-store' });
    const data = answer.ok && answer.headers.get('content-type')?.includes('json') ? await answer.json() : undefined;
    if (!data || !Array.isArray(data.notes)) throw new Error('sin servidor de desarrollo');
    return data.notes;
  }
  async function load() {
    if (location.protocol.startsWith('http')) try { notes = await fetchNotes(); writable = true; } catch {}
    loaded = true; render();
  }
  /** A change, made on the file as it is now (the anima skill may have answered meanwhile) and written whole; done() only if it was kept. */
  async function change(edit, done) {
    try {
      const fresh = await fetchNotes();
      edit(fresh);
      const answer = await fetch(endpoint, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ notes: fresh }) });
      const body = await answer.json();
      if (!answer.ok) throw new Error(body.error ?? answer.status);
      notes = body.notes; error = ''; done?.();
    } catch (e) { error = 'No se pudo guardar: ' + e.message; }
    render();
  }
  function add() {
    const entry = current, text = (drafts[entry] ?? '').trim(), about = abouts[entry], asks = changing[entry] ?? [];
    if (!writable || (!text && !asks.length) || !VIEWS[entry] || entry === 'notas') return;
    const now = new Date();
    const note = { id: 'n-' + now.getTime().toString(36), entry, name: VIEWS[entry], ...about ? { item: about.item, itemName: about.name } : {}, ...asks.length ? { change: [...asks] } : {}, text, status: 'abierta', created: isoNow() };
    change(list => { list.push(note); }, () => { drafts[entry] = ''; delete abouts[entry]; delete changing[entry]; });
  }
  function act(id, action) {
    if (action === 'editar') { editing = { id, text: notes.find(n => n.id === id)?.text ?? '' }; confirming = undefined; render(); focus(here() + ' [data-edit]'); return; }
    if (action === 'cancelar') { editing = undefined; render(); return; }
    if (action === 'borrar' && confirming !== id) { confirming = id; render(); return; }
    const text = editing?.text.trim();
    if (action === 'guardar' && !text) return;
    confirming = undefined;
    change(list => {
      const note = list.find(n => n.id === id);
      if (!note) return;
      if (action === 'borrar') list.splice(list.indexOf(note), 1);
      else if (action === 'guardar') { if (text !== note.text) { note.text = text; note.edited = isoNow(); } }
      else if (action === 'abierta') { note.status = 'abierta'; delete note.closed; }
      else { note.status = action; note.closed = isoNow(); }
    }, () => { if (action === 'guardar' || action === 'borrar') editing = undefined; });
  }

  function noteHtml(n) {
    const head = '<span class="state">' + STATES[n.status] + '</span><small>' + when(n.created)
      + (n.edited ? ' · editada ' + when(n.edited) : '') + (n.closed ? ' · cerrada ' + when(n.closed) : '') + '</small>';
    const body = editing?.id === n.id
      ? '<textarea data-edit rows="4">' + esc(editing.text) + '</textarea><div class="note-actions"><button class="primary" data-act="guardar">Guardar</button><button data-act="cancelar">Cancelar</button><small>Ctrl/⌘ + Enter · Esc</small></div>'
      : '<p>' + lines(n.text) + '</p>' + (n.reply ? '<p class="reply"><b>Respuesta</b>' + lines(n.reply) + '</p>' : '')
        + (writable ? '<div class="note-actions"><button data-act="editar">Editar</button>'
          + (n.status === 'abierta' ? '<button data-act="hecha">Hecha</button><button data-act="descartada">Descartar</button>' : '<button data-act="abierta">Reabrir</button>')
          + '<button data-act="borrar"' + (confirming === n.id ? ' class="danger">¿Borrar?' : '>Borrar') + '</button></div>' : '');
    const tags = n.item || n.change ? '<div class="about">' + (n.item ? '<span class="tag item" data-goto="' + esc(n.item) + '" title="Ir a ' + esc(n.itemName) + '">' + esc(n.itemName) + '</span>' : '') + (n.change ?? []).map(c => '<span class="tag change">Cambiar · ' + esc(c) + '</span>').join('') + '</div>' : '';
    return '<div class="note ' + n.status + '" data-note="' + n.id + '"><div class="note-head">' + head + '</div>' + tags + body + '</div>';
  }
  function renderRail() {
    const rail = document.getElementById('notes');
    if (current === 'notas') { rail.innerHTML = ''; return; }
    const about = abouts[current], asks = changing[current] ?? [];
    const form = writable
      ? '<div class="note-form">'
        + '<div class="about">' + (about ? '<span class="chip">Sobre ' + esc(about.name) + '<button type="button" data-about-clear title="Que sea sobre toda la página">×</button></span>' : '<small>Sobre toda la página · ✎ en una fila para que sea sobre ella</small>') + '</div>'
        + '<div class="change-chips"><span>Cambiar ·</span>' + CHANGES.map(c => '<button type="button" data-change="' + c + '" aria-pressed="' + asks.includes(c) + '">' + c + '</button>').join('') + '</div>'
        + '<textarea data-draft rows="3" placeholder="' + (about ? 'Una nota sobre ' + esc(about.name) : 'Una nota sobre ' + esc(VIEWS[current])) + '…">' + esc(drafts[current] ?? '') + '</textarea><div class="note-save"><small>Ctrl/⌘ + Enter</small><button class="primary" data-save>Guardar nota</button></div></div>'
      : '<p class="ro">' + (loaded ? 'Solo lectura. Para escribir, editar o cerrar notas, ábrela con <code>just animas</code>: el servidor de desarrollo las guarda en docs/anima-notes.json.' : 'Cargando…') + '</p>';
    const mine = newestOpenFirst(notes.filter(n => n.entry === current));
    rail.innerHTML = '<h2>Notas<small>' + esc(VIEWS[current]) + '</small></h2>' + form + (error ? '<p class="err">' + esc(error) + '</p>' : '')
      + (mine.map(n => noteHtml(n)).join('') || '<p class="none">Ninguna nota todavía.</p>');
  }
  function renderAll() {
    const list = newestOpenFirst(notes.filter(n => showAll || n.status === 'abierta'));
    const entries = [...new Set([...Object.keys(VIEWS), ...list.map(n => n.entry)])].filter(e => list.some(n => n.entry === e));
    document.getElementById('all-notes').innerHTML = '<div class="toggle"><button data-all="0" aria-pressed="' + !showAll + '">Abiertas · ' + open().length + '</button><button data-all="1" aria-pressed="' + showAll + '">Todas · ' + notes.length + '</button></div>'
      + (error ? '<p class="err">' + esc(error) + '</p>' : '')
      + (entries.map(e => '<article class="card"><h2><a href="#' + e + '">' + esc(VIEWS[e] ?? list.find(n => n.entry === e).name) + '</a></h2>' + list.filter(n => n.entry === e).map(n => noteHtml(n)).join('') + '</article>').join('')
        || '<p class="none">' + (showAll ? 'Ninguna nota.' : 'Ninguna nota abierta.') + '</p>');
  }
  function renderMarks() {
    document.querySelectorAll('[data-mark]').forEach(m => { const k = open(m.dataset.mark).length; m.textContent = k ? '✎ ' + k : ''; m.title = k ? k + (k > 1 ? ' notas abiertas' : ' nota abierta') : ''; });
    document.getElementById('open-count').textContent = open().length ? '✎ ' + open().length : '';
    document.querySelectorAll('[data-item-mark]').forEach(m => { const k = notes.filter(n => n.status === 'abierta' && n.item === m.dataset.itemMark).length; m.textContent = k ? '✎ ' + k : ''; m.title = k ? k + (k > 1 ? ' notas abiertas' : ' nota abierta') : ''; });
  }
  /** Draws the notes again, keeping the place in whatever was being typed. */
  function render() {
    const typing = document.activeElement?.matches?.('[data-draft], [data-edit]') ? (document.activeElement.matches('[data-draft]') ? '[data-draft]' : '[data-edit]') : '';
    renderRail(); renderAll(); renderMarks();
    if (typing) focus(here() + ' ' + typing);
  }
  function focus(selector) { const t = document.querySelector(selector); if (t) { t.focus(); t.setSelectionRange(t.value.length, t.value.length); } }

  // ——— The stage (src/anima-demo.ts): the game in a frame, in a fight that never ends, asked for one thing at a time ———
  const stageEl = document.getElementById('stage'), say = stageEl.querySelector('.stage-say');
  let frame, lastPlay, playing = 0;
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  function tell(text, bad = false) { say.textContent = text; say.classList.toggle('bad', bad); }
  async function play(move, name, row) {
    if (!served) return;
    const mine = ++playing;
    lastPlay = { move, name, row }; stageEl.querySelector('[data-stage="again"]').disabled = false;
    document.querySelectorAll('.playing').forEach(r => r.classList.remove('playing')); row?.classList.add('playing');
    if (!frame) {
      frame = document.createElement('iframe');
      frame.src = '/?anima-demo'; frame.allow = 'autoplay'; frame.title = 'Escenario';
      frame.addEventListener('load', () => frame.contentWindow.addEventListener('keydown', stageKeys, true));
      const zoom = document.createElement('div'); zoom.className = 'zoom'; zoom.dataset.stage = 'big'; zoom.title = 'Ampliar';
      stageEl.querySelector('.screen').replaceChildren(frame, zoom);
      stageEl.querySelector('.stage-keys').hidden = false;
      fit();
    }
    tell('▶ ' + name + ' · preparando el combate…');
    const start = Date.now();
    while (mine === playing) {
      const demo = frame.contentWindow?.animaDemo;
      if (demo?.ready()) {
        tell('▶ ' + name);
        const result = await demo.play(move);
        if (mine !== playing) return;
        if (result.ok || !/^Espera/.test(result.text)) { tell((result.ok ? '✓ ' : '') + result.text, !result.ok); row?.classList.remove('playing'); return; }
      }
      if (Date.now() - start > 120000) { tell('El combate no ha cargado: mira la consola del escenario.', true); return; }
      await sleep(150);
    }
  }
  /** Scales the frame to its box: whole, centred when the stage is enlarged. */
  function fit() {
    if (!frame) return;
    const box = stageEl.querySelector('.screen').getBoundingClientRect(), k = Math.min(box.width / 1280, box.height / 720);
    frame.style.transform = stageEl.classList.contains('big') ? 'translate(-50%, -50%) scale(' + k + ')' : 'scale(' + k + ')';
  }
  new ResizeObserver(fit).observe(stageEl.querySelector('.screen'));
  function goTo(item) {
    const row = document.querySelector('.view.on [data-item="' + item + '"]') ?? document.querySelector('[data-item="' + item + '"]');
    if (!row) return;
    const view = row.closest('.view');
    if (!view.classList.contains('on')) location.hash = view.id;
    requestAnimationFrame(() => { row.closest('details')?.setAttribute('open', ''); row.scrollIntoView({ block: 'center', behavior: 'smooth' }); row.classList.remove('flash'); void row.offsetWidth; row.classList.add('flash'); });
  }
  function enlarge(big) {
    stageEl.classList.toggle('big', big);
    stageEl.querySelector('button[data-stage="big"]').setAttribute('aria-pressed', big);
    const zoom = stageEl.querySelector('.zoom'); if (zoom) zoom.title = big ? 'Reducir' : 'Ampliar';
    stageEl.querySelector('.stage-keys').textContent = '← → otra habilidad · clic para ' + (big ? 'reducir' : 'ampliar') + ' · Esc para cerrar';
  }
  /** ← / →: the previous or next thing to play on the page being read, from the one playing. */
  function step(by) {
    const buttons = [...document.querySelectorAll('.view.on [data-play]')];
    if (!buttons.length) return;
    const at = buttons.findIndex(b => b.closest('[data-item]') === lastPlay?.row);
    const next = buttons[at < 0 ? (by > 0 ? 0 : buttons.length - 1) : (at + by + buttons.length) % buttons.length];
    const row = next.closest('[data-item]');
    row?.closest('details')?.setAttribute('open', '');
    if (!stageEl.classList.contains('big')) row?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    void play(JSON.parse(next.dataset.play), next.dataset.playName, row);
  }
  // The game in the frame takes the focus as it loads, so its keys are heard there too.
  function stageKeys(ev) {
    if (ev.key === 'Escape' && stageEl.classList.contains('big')) { enlarge(false); return; }
    if ((ev.key === 'ArrowLeft' || ev.key === 'ArrowRight') && frame && !ev.altKey && !ev.metaKey && !ev.ctrlKey && !ev.target.matches?.('input, textarea, select, [contenteditable]')) {
      ev.preventDefault(); ev.stopPropagation(); step(ev.key === 'ArrowRight' ? 1 : -1);
    }
  }
  addEventListener('keydown', stageKeys);

  document.addEventListener('click', ev => {
    const t = ev.target;
    const playButton = t.closest('[data-play]');
    if (playButton) { void play(JSON.parse(playButton.dataset.play), playButton.dataset.playName, playButton.closest('[data-item]')); return; }
    const stageButton = t.closest('[data-stage]');
    if (stageButton) {
      if (stageButton.dataset.stage === 'again' && lastPlay) void play(lastPlay.move, lastPlay.name, lastPlay.row);
      if (stageButton.dataset.stage === 'big') { enlarge(!stageEl.classList.contains('big')); stageButton.blur(); }
      return;
    }
    const pen = t.closest('[data-about]');
    if (pen) { if (!writable) return; abouts[current] = { item: pen.dataset.about, name: pen.dataset.aboutName }; render(); focus('#notes [data-draft]'); document.getElementById('rail').scrollTo({ top: document.getElementById('notes').offsetTop - 8, behavior: 'smooth' }); return; }
    if (t.closest('[data-about-clear]')) { delete abouts[current]; render(); return; }
    const chip = t.closest('[data-change]');
    if (chip) { const list = changing[current] ??= [], c = chip.dataset.change; list.includes(c) ? list.splice(list.indexOf(c), 1) : list.push(c); render(); return; }
    const goto = t.closest('[data-goto]');
    if (goto) { goTo(goto.dataset.goto); return; }
    if (t.closest('[data-save]')) { add(); return; }
    const action = t.closest('[data-act]');
    if (action) { act(action.closest('[data-note]').dataset.note, action.dataset.act); return; }
    const all = t.closest('[data-all]');
    if (all) { showAll = all.dataset.all === '1'; renderAll(); return; }
    if (confirming) { confirming = undefined; render(); }
  });
  document.addEventListener('input', ev => {
    if (ev.target.matches('[data-draft]')) drafts[current] = ev.target.value;
    else if (ev.target.matches('[data-edit]') && editing) editing.text = ev.target.value;
  });
  document.addEventListener('keydown', ev => {
    const t = ev.target;
    if (!t.matches?.('[data-draft], [data-edit]')) return;
    if (ev.key === 'Enter' && (ev.ctrlKey || ev.metaKey)) { ev.preventDefault(); if (t.matches('[data-draft]')) add(); else act(editing.id, 'guardar'); }
    else if (ev.key === 'Escape' && t.matches('[data-edit]')) { ev.preventDefault(); act(editing.id, 'cancelar'); }
  });
  // Coming back to the page shows what the anima skill answered meanwhile.
  addEventListener('focus', () => { if (writable && !editing) fetchNotes().then(list => { notes = list; render(); }).catch(() => {}); });

  const show = () => {
    const id = decodeURIComponent(location.hash.slice(1)) || 'catalogo';
    const view = document.getElementById(id)?.closest('.view') ?? document.getElementById('catalogo');
    document.querySelectorAll('.view').forEach(v => v.classList.toggle('on', v === view));
    document.querySelectorAll('nav a').forEach(a => a.setAttribute('aria-current', a.getAttribute('href') === '#' + view.id));
    document.title = view.dataset.title + ' · Ánimas · Gerard 35';
    document.getElementById('app').dataset.view = current = view.id;
    confirming = undefined;
    render();
    scrollTo(0, 0);
  };
  addEventListener('hashchange', show); show();
  load();
  window.animaNotes = { notes: () => notes, writable: () => writable, ready: () => loaded, stage: () => frame?.contentWindow?.animaDemo, said: () => say.textContent };
</script>
</body>
</html>
`;
await mkdir(out, { recursive: true });
await writeFile(resolve(out, 'index.html'), page);
const openNotes = notesAtWrite.notes.filter(n => n.status === 'abierta').length;
console.log(`${relative(root, resolve(out, 'index.html'))}: ${animas.length} ánimas (${animas.filter(a => a.inGame).length} en el juego), ${DUALS.length} dúos${openNotes ? `, ${openNotes} nota${openNotes > 1 ? 's' : ''} abierta${openNotes > 1 ? 's' : ''}` : ''}`);
