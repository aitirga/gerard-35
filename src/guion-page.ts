/**
 * The script's page (`just guion`, guion.html; docs/dev-tools.md § El guion): every line the game says,
 * by section and in the order the simulated game says it, with who says it, where it is written and a
 * photo of the moment. A line can be edited straight into the code (the dev server writes the literal,
 * vite.config.ts `guionPage`), left as a suggestion or commented; notes go to docs/guion-notes.json for
 * the `guion` skill. `?ver=<entry id>` opens at an entry; `?notas=scratch` uses the screenshots' file.
 */
import { SPEAKERS, type SpeakerId } from './dialogue';
import { GROUPS, GUION_EDIT_ENDPOINT, GUION_NOTES_ENDPOINT, KIND_LABELS, VOICES, closeGuionNote, newGuionNote, type EntryKind, type GuionBlockLine, type GuionEntry, type GuionLine, type GuionNote, type GuionNoteStatus, type GuionPlace, type Moment, type Partida } from './guion';

interface Script { made: string; places: Record<string, string>; entries: GuionEntry[] }
interface Photo { file: string; made: string; jump: string; environment: string }
type Mode = 'edit' | 'suggest' | 'comment' | 'add' | 'remove';

const query = new URLSearchParams(location.search);
const scratch = query.get('notas') === 'scratch';
const notesUrl = `${GUION_NOTES_ENDPOINT}${scratch ? '?archivo=scratch' : ''}`;
const $ = <T extends HTMLElement = HTMLElement>(selector: string) => document.querySelector<T>(selector)!;
const html = (text: string) => text.replace(/[&<>"]/g, c => `&#${c.charCodeAt(0)};`);
const domId = (entry: string) => `e-${entry.replace(/[^a-zA-Z0-9-]+/g, '_')}`;

const main = $('#script'), nav = $('#nav'), search = $<HTMLInputElement>('#search'), whoSelect = $<HTMLSelectElement>('#who');
const kindSelect = $<HTMLSelectElement>('#kind'), onlyNotes = $<HTMLInputElement>('#only-notes'), toastBox = $('#toast');

let script: Script = { made: '', places: {}, entries: [] };
let partida: Partida | undefined;
let photos: Record<string, Photo> = {};
let notes: GuionNote[] = [];
let writable = true;
const moments = new Map<string, Moment[]>();
/** For an entry the game never says: where trying something (or another player) does. */
const tried = new Map<string, Moment>();
/** Lines changed from this page since it opened, `<entry>#<line>`: shown green. */
const changed = new Set<string>();
/** What is open to write: a line's editor, a comment, or a block to add (`place` the line, its rows kept across redraws). */
let editing: { entry: string; line?: number; mode: Mode; place?: GuionPlace; block?: GuionBlockLine[]; why?: string } | undefined;
let message: { kind: 'err' | 'warn' | 'ok'; text: string } | undefined;

// ── Who says it ─────────────────────────────────────────────────────────────
const YOUNG = new Set(['gerard', 'bernat']);
function voice(id: string): { name: string; colour: string; portrait?: string; mark: string } {
  if (id in VOICES) return { name: VOICES[id as keyof typeof VOICES], colour: '#8f8a73', mark: { narracion: '¶', tele: 'TV', rotulo: 'Aa', diario: '✎' }[id as keyof typeof VOICES] };
  const speaker = (SPEAKERS as Record<string, (typeof SPEAKERS)[SpeakerId] | undefined>)[id];
  if (!speaker) return { name: id, colour: '#9a9a9a', mark: id.slice(0, 1).toUpperCase() };
  const portrait = 'portrait' in speaker ? speaker.portrait : undefined;
  return { name: `${speaker.name}${YOUNG.has(id) ? ' · niño' : ''}`, colour: speaker.accent, portrait: portrait ? `/portraits/${portrait}.png` : undefined, mark: speaker.name.slice(0, 1) };
}

const EVENTS: Record<string, string> = {
  start: 'al empezar', interact: 'al hablar o mirar', near: 'al acercarse', battle: 'tras el combate', arrive: 'al llegar', room: 'al entrar',
  minion: 'el esbirro', palace: 'el palacio', caught: 'atrapados', home: 'al volver a casa', candado: 'el candado', parcelas: 'las parcelas',
  ending: 'el final', evening: 'la tarde', use: 'al usarlo', ticket: 'el billete', portal: 'el portal',
};

// ── Loading and saving ──────────────────────────────────────────────────────
const json = async <T>(url: string): Promise<T | undefined> => fetch(url, { cache: 'no-store' }).then(r => r.ok ? r.json() as Promise<T> : undefined).catch(() => undefined);

async function loadScript() {
  const [s, p, f] = await Promise.all([json<Script>('/output/guion/guion.json'), json<Partida>('/output/guion/partida.json'), json<Record<string, Photo>>('/output/guion/fotos.json')]);
  script = s ?? { made: '', places: {}, entries: [] };
  partida = p; photos = f ?? {};
  moments.clear(); tried.clear();
  for (const m of partida?.extra ?? []) tried.set(m.entry, m);
  for (const m of partida?.moments ?? []) { if (!moments.has(m.entry)) moments.set(m.entry, []); moments.get(m.entry)!.push(m); }
}
async function loadNotes() {
  const answer = await fetch(notesUrl, { cache: 'no-store' }).catch(() => undefined);
  const body = answer?.ok ? await answer.json().catch(() => undefined) as { notes?: GuionNote[] } | undefined : undefined;
  writable = !!body && Array.isArray(body.notes);
  notes = body?.notes ?? [];
}
async function saveNotes(next: GuionNote[]): Promise<boolean> {
  const answer = await fetch(notesUrl, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ notes: next }) }).catch(() => undefined);
  if (!answer?.ok) { toast(`No se han guardado las notas: ${(await answer?.json().catch(() => undefined))?.error ?? 'sin servidor (abre la página con just guion)'}`); return false; }
  notes = (await answer.json() as { notes: GuionNote[] }).notes;
  return true;
}

let toastTimer = 0;
function toast(text: string) {
  toastBox.textContent = text; toastBox.style.display = 'block';
  clearTimeout(toastTimer); toastTimer = window.setTimeout(() => { toastBox.style.display = 'none'; }, 6000);
}

// ── Showing it ──────────────────────────────────────────────────────────────
const entryById = (id: string) => script.entries.find(e => e.id === id);
const openNotes = (entry: string) => notes.filter(n => n.entry === entry && n.status === 'abierta');
const editable = (line: GuionLine) => !!line.at && !line.dynamic;
const placeName = (environment: string) => script.places[environment] ?? environment;
const whereOf = (line?: GuionLine) => line?.at ? `${line.at.file}:${line.at.line}` : undefined;
/** The line a change note is about now: where it was if it still says `quote`, else the line that does; none when it is gone. */
function anchorOf(note: GuionNote, e: GuionEntry): number | undefined {
  if (note.line === undefined) return undefined;
  if (e.lines[note.line]?.text === note.quote) return note.line;
  const i = e.lines.findIndex(l => l.text === note.quote);
  return i >= 0 ? i : undefined;
}
/** Is a note shown on line `i` (a change, wherever its line is now; anything else, by its number)? */
const onLine = (note: GuionNote, e: GuionEntry, i: number) => note.change ? anchorOf(note, e) === i && !(note.change === 'añadir' && note.status === 'abierta') : note.line === i;
/** The open blocks to add `place` line `i`, in the order they were written. */
const blocksAt = (e: GuionEntry, i: number, place: GuionPlace) => notes.filter(n => n.entry === e.id && n.change === 'añadir' && n.status === 'abierta' && n.place === place && anchorOf(n, e) === i);
const removing = (e: GuionEntry, i: number) => notes.some(n => n.entry === e.id && n.change === 'quitar' && n.status === 'abierta' && anchorOf(n, e) === i);
/** Who can say an added line: the moment's own voices first, then everyone. */
function speakerIds(e: GuionEntry) {
  const own = [...new Set([e.left, e.right, ...e.lines.map(l => l.speaker)].filter((v): v is string => !!v))];
  const rest = [...Object.keys(SPEAKERS), ...Object.keys(VOICES)].filter(id => !own.includes(id));
  return { own, rest };
}
/** Who would say the next line after `after`: in a dialogue, the other side; else the same voice. */
function nextSpeaker(e: GuionEntry, after?: string) {
  if (!after) return e.left ?? e.lines[0]?.speaker ?? 'gerard';
  if (e.left && e.right) return after === e.left ? e.right : e.left;
  return after;
}
/** Where to open the game for an entry: just before its first moment, so it is seen happening; a look, at the first visit to its place. */
const jumpFor = (e: GuionEntry) => { const m = moments.get(e.id)?.[0] ?? tried.get(e.id); return m ? m.before ?? m.jump : e.place?.environment ? partida?.visits[e.place.environment] : undefined; };
/** How a moment the game did not play is reached: the interaction tried (its label where the place has it), or the player who hears it. */
function howTried(m: Moment) {
  if (m.player) return `jugando «${m.player}»`;
  const label = m.label ?? script.entries.find(e => e.id === `lugar:${m.via}`)?.title.split(' · ').pop();
  return `${m.again ? 'la segunda vez, ' : ''}${label ? `«${label}»` : `al usar ${m.via}`}`;
}

function matches(e: GuionEntry) {
  const q = search.value.trim().toLowerCase();
  if (whoSelect.value && !e.lines.some(l => l.speaker === whoSelect.value)) return false;
  if (kindSelect.value && e.kind !== kindSelect.value) return false;
  if (onlyNotes.checked && !openNotes(e.id).length) return false;
  if (!q) return true;
  const hay = [e.id, e.title, e.place?.name ?? '', ...e.lines.flatMap(l => [l.text, voice(l.speaker).name])].join('\n').toLowerCase();
  return hay.includes(q);
}

/** A section's entries: those said in the game in its order, then the rest as the code has them. */
function ordered(group: string) {
  const all = script.entries.filter(e => e.group === group);
  const n = (e: GuionEntry) => moments.get(e.id)?.[0]?.n ?? Infinity;
  return all.map((e, i) => ({ e, i })).sort((a, b) => n(a.e) - n(b.e) || a.i - b.i).map(({ e }) => e);
}

/** A note; `inline`, for a block shown in place among the lines: only its header and why. */
function noteHtml(note: GuionNote, e: GuionEntry, inline = false) {
  const line = note.line !== undefined ? e.lines[note.line] : undefined;
  const canApply = writable && note.status === 'abierta' && note.proposal && line && editable(line) && line.text === note.quote;
  const kind = inline ? (note.block?.length === 1 ? 'Línea nueva' : `${note.block?.length} líneas nuevas`) : note.change === 'añadir' ? `Añadir ${note.block?.length === 1 ? 'línea' : `${note.block?.length ?? 0} líneas`} ${note.place === 'antes' ? 'antes de' : 'después de'} esta`
    : note.change === 'quitar' ? 'Quitar esta línea' : note.proposal ? 'Sugerencia' : 'Comentario';
  const lost = note.change && note.status === 'abierta' && e.lines.length && anchorOf(note, e) === undefined
    ? `<p class="lost">La línea a la que se refería ya no está: «${html(note.quote ?? '')}»${note.at ? ` (${html(note.at)})` : ''}.</p>` : '';
  const block = inline ? '' : note.change === 'añadir' ? `<div class="diff">${(note.block ?? []).map(l => `<ins><b>${html(voice(l.speaker).name)}:</b> ${html(l.text)}</ins>`).join('')}</div>`
    : note.change === 'quitar' && (note.status !== 'abierta' || anchorOf(note, e) === undefined) ? `<div class="diff"><del>${html(note.quote ?? '')}</del></div>` : '';
  const when = note.created.slice(0, 16).replace('T', ' ');
  const buttons = !writable ? '' : note.status === 'abierta'
    ? `${canApply ? `<button data-note="aplicar" data-id="${note.id}" title="Escribe la sugerencia en el código y cierra la nota">Aplicar</button>` : ''}<button data-note="hecha" data-id="${note.id}">Hecha</button><button data-note="descartada" data-id="${note.id}">Descartar</button>${note.reply ? '' : `<button data-note="borrar" data-id="${note.id}">Borrar</button>`}`
    : `<button data-note="abierta" data-id="${note.id}">Reabrir</button>`;
  return `<div class="note ${note.status}">
    <div class="meta"><b>${kind}</b><span>${note.status}</span><span>${when}</span><span class="btns">${buttons}</span></div>
    ${lost}${block}${note.proposal ? `<div class="diff"><del>${html(note.quote ?? '')}</del><ins>${html(note.proposal)}</ins></div>` : ''}
    ${note.text ? `<p>${html(note.text)}</p>` : ''}
    ${note.reply ? `<p class="reply">${html(note.reply)}</p>` : ''}
  </div>`;
}

function editorHtml(e: GuionEntry, mode: Mode, line?: GuionLine) {
  const msg = message ? `<div class="msg ${message.kind}">${html(message.text)}</div>` : '<div class="msg"></div>';
  if (mode === 'comment') return `<div class="editor" data-mode="comment">
    <textarea placeholder="${line ? 'Qué piensas de esta línea…' : `Qué piensas de «${html(e.title)}»…`}"></textarea>
    <div class="buttons"><button class="main" data-act="note">Guardar comentario</button><button data-act="cancel">Cancelar</button><small>⌘↵ guarda · Esc cancela</small></div>${msg}</div>`;
  if (mode === 'remove') return `<div class="editor" data-mode="remove">
    <input placeholder="Por qué se quita (opcional)" />
    <div class="buttons"><button class="main" data-act="remove-save" title="Queda como nota: la skill guion la quita del código">Marcar para quitar</button><button data-act="cancel">Cancelar</button><small>⌘↵ guarda · Esc cancela</small></div>${msg}</div>`;
  if (mode === 'add') {
    const { own, rest } = speakerIds(e);
    const options = (chosen: string) => `<optgroup label="En este momento">${own.map(id => `<option value="${id}"${id === chosen ? ' selected' : ''}>${html(voice(id).name)}</option>`).join('')}</optgroup>`
      + `<optgroup label="Todos">${rest.map(id => `<option value="${id}"${id === chosen ? ' selected' : ''}>${html(voice(id).name)}</option>`).join('')}</optgroup>`;
    const rows = editing?.block?.length ? editing.block : [{ speaker: nextSpeaker(e, line?.speaker), text: '' }];
    return `<div class="editor block-editor" data-mode="add">
    <div class="block-head">${editing?.place === 'antes' ? 'Líneas nuevas antes de esta' : 'Líneas nuevas después de esta'}, en este orden</div>
    ${rows.map((r, j) => `<div class="block-row" style="--c:${voice(r.speaker).colour}"><select>${options(r.speaker)}</select><textarea rows="2" placeholder="Qué dice…">${html(r.text)}</textarea>${rows.length > 1 ? `<button data-act="add-drop" data-row="${j}" title="Quita esta línea del bloque">×</button>` : ''}</div>`).join('')}
    <input placeholder="Por qué (opcional)" value="${html(editing?.why ?? '')}" />
    <div class="buttons"><button class="main" data-act="add-save" title="Queda como nota: la skill guion las escribe en el código">Guardar bloque</button><button data-act="add-row">+ Otra línea</button><button data-act="cancel">Cancelar</button><small>⌘↵ guarda · Esc cancela</small></div>${msg}</div>`;
  }
  const direct = mode === 'edit' && line && editable(line);
  return `<div class="editor" data-mode="${mode}">
    <textarea>${html(line?.text ?? '')}</textarea>
    <input placeholder="${direct ? 'Por qué (solo si la dejas como sugerencia)' : 'Por qué (opcional)'}" />
    <div class="buttons">${direct ? '<button class="main" data-act="save" title="Cambia el texto en el código ahora mismo">Guardar en el juego</button>' : ''}<button ${direct ? '' : 'class="main"'} data-act="propose" title="Queda como nota, para revisarla con la skill guion">Dejar como sugerencia</button><button data-act="cancel">Cancelar</button><small>⌘↵ ${direct ? 'guarda en el juego' : 'guarda'} · Esc cancela</small></div>${msg}</div>`;
}

function lineHtml(e: GuionEntry, line: GuionLine, i: number) {
  const v = voice(line.speaker);
  const own = notes.filter(n => n.entry === e.id && onLine(n, e, i));
  const gone = removing(e, i);
  const here = editing?.entry === e.id && editing.line === i ? editing.mode : undefined;
  const face = v.portrait ? `<img src="${v.portrait}" alt="" loading="lazy" />` : html(v.mark);
  const where = line.at ? `<code title="Dónde está escrito">${line.at.file}:${line.at.line}</code>` : line.dynamic ? '<code title="Se arma con piezas en el código">(con piezas)</code>' : '';
  const text = here === 'edit' || here === 'suggest' ? editorHtml(e, here, line)
    : `<p class="text${line.dynamic ? ' dynamic' : ''}${gone ? ' removing' : ''}${changed.has(`${e.id}#${i}`) ? ' changed' : ''}" ${writable && editable(line) ? 'data-editable title="Clic para editar"' : ''}>${html(line.text)}</p>`;
  const actions = writable && !here ? `<div class="actions">${editable(line) ? '<button data-act="edit">Editar</button>' : ''}<button data-act="suggest">Sugerir</button><button data-act="comment">Comentar</button>${i === 0 ? '<button data-act="add-before" title="Líneas nuevas antes de esta">+ Antes</button>' : ''}<button data-act="add-after" title="Líneas nuevas después de esta">+ Después</button>${gone ? '' : '<button data-act="remove" title="Que esta línea deje de decirse">Quitar</button>'}</div>` : '';
  return `<div class="say" data-line="${i}" style="--c:${v.colour}">
    <div class="face">${face}</div>
    <div><div class="who">${html(v.name)}${where}</div>${text}
      <div class="line-notes">${own.map(n => noteHtml(n, e)).join('')}${here === 'comment' || here === 'remove' ? editorHtml(e, here, line) : ''}</div></div>
    ${actions}
  </div>`;
}

/** What goes `place` line `i`: the open blocks to add there, and the block being written there. */
function around(e: GuionEntry, i: number, place: GuionPlace) {
  const ghosts = blocksAt(e, i, place).map(n => `<div class="ghost" data-id="${n.id}">
    ${(n.block ?? []).map(l => { const v = voice(l.speaker); return `<div class="say added" style="--c:${v.colour}"><div class="face">${v.portrait ? `<img src="${v.portrait}" alt="" loading="lazy" />` : html(v.mark)}</div><div><div class="who">${html(v.name)}<code>nueva</code></div><p class="text">${html(l.text)}</p></div></div>`; }).join('')}
    ${noteHtml(n, e, true)}
  </div>`).join('');
  const writing = editing?.entry === e.id && editing.mode === 'add' && editing.line === i && (editing.place ?? 'despues') === place
    ? `<div class="say adding" data-line="${i}"><div></div><div>${editorHtml(e, 'add', e.lines[i])}</div></div>` : '';
  return ghosts + writing;
}

function entryHtml(e: GuionEntry) {
  const said = moments.get(e.id) ?? [], first = said[0], other = first ? undefined : tried.get(e.id);
  const photo = photos[e.id];
  const jump = jumpFor(e);
  const at = first ?? other;
  const when = at ? [at.stage, at.day ? `día ${at.day}${at.hour >= 21 ? `, ${at.hour}:00` : ''}` : '', placeName(at.environment), first ? EVENTS[first.event] ?? first.event : howTried(at)].filter(Boolean).join(' · ') : '';
  const head = `<div class="head">
    ${first ? `<span class="n" title="Su orden en la partida simulada">#${first.n}</span><span>${html(when)}</span>${said.length > 1 ? `<span title="Veces que se dice en la partida">×${said.length}</span>` : ''}`
      : other ? `<span class="n tried" title="La partida simulada no lo dice; probando cada cosa a su alcance, o en otra partida, sí">fuera de la partida</span><span>${html(when)}</span>`
      : `<span>${e.place ? html(e.place.name) : 'No sale en la partida simulada'}</span>`}
    <span class="kind">${KIND_LABELS[e.kind]}</span><code title="${html(e.id)}">${html(e.title)}</code>
    ${jump ? `<a href="${jump}" target="_blank" title="Abre el juego en ese punto">Abrir en el juego ↗</a>` : ''}
  </div>`;
  const picture = photo ? `<img src="/output/guion/fotos/${photo.file}?v=${encodeURIComponent(photo.made)}" alt="" loading="lazy" data-zoom /><small>${html(placeName(photo.environment))} · ${photo.made.slice(0, 10)}</small>`
    : `<div class="none">${first || other || (e.kind === 'mirar' && jump) ? 'Sin foto todavía: <code>just guion-fotos</code>' : 'Sin foto: no sale en la partida simulada'}</div>`;
  const entryNotes = notes.filter(n => n.entry === e.id && (n.line === undefined || (n.change && anchorOf(n, e) === undefined)));
  const commenting = editing?.entry === e.id && editing.line === undefined;
  return `<article class="entry${first || other ? '' : ' unplayed'}${query.get('ver') === e.id ? ' target' : ''}" id="${domId(e.id)}" data-entry="${html(e.id)}">
    <div>${head}<div class="lines">${e.lines.map((l, i) => around(e, i, 'antes') + lineHtml(e, l, i) + around(e, i, 'despues')).join('')}</div></div>
    <div class="photo">${picture}</div>
    <div class="notes">${entryNotes.map(n => noteHtml(n, e)).join('')}</div>
    ${writable ? `<div class="entry-tools">${commenting ? editorHtml(e, 'comment') : '<button data-act="comment-entry">Comentar el momento</button>'}</div>` : ''}
  </article>`;
}

function render() {
  const sections = GROUPS.map(g => ({ ...g, entries: ordered(g.id).filter(matches) })).filter(s => s.entries.length);
  const total = script.entries.reduce((n, e) => n + e.lines.length, 0);
  $('#count').textContent = `${script.entries.length} momentos · ${total} líneas`;
  main.innerHTML = sections.map(s => `<section id="s-${s.id}"><h2>${html(s.label)} · ${s.entries.length}</h2>${s.entries.map(entryHtml).join('')}</section>`).join('')
    + orphans() || `<p class="empty">${onlyNotes.checked ? 'Ninguna nota abierta.' : 'Nada con eso.'}</p>`;
  nav.innerHTML = sections.map(s => {
    const open = s.entries.reduce((n, e) => n + openNotes(e.id).length, 0);
    return `<a data-section="${s.id}"><span>${html(s.label)}</span><small>${open ? `<span class="open-notes">${open} ●</span> ` : ''}${s.entries.length}</small></a>`;
  }).join('');
  focusEditor();
}
/** Notes whose entry the code no longer has (renamed or gone): still shown, to be closed. */
function orphans() {
  const lost = notes.filter(n => n.status === 'abierta' && !entryById(n.entry));
  if (!lost.length) return '';
  return `<section><h2>Notas sin sitio · ${lost.length}</h2>${lost.map(n => `<article class="entry"><div><div class="head"><code>${html(n.entry)}</code><span>${html(n.title)}</span></div>${noteHtml(n, { id: n.entry, group: '', kind: 'dialogo', title: n.title, lines: [] })}</div></article>`).join('')}</section>`;
}
function refresh(entry: string) {
  const e = entryById(entry), node = document.getElementById(domId(entry));
  if (!e || !node) { render(); return; }
  node.outerHTML = entryHtml(e);
  focusEditor();
}
function focusEditor() {
  const areas = main.querySelectorAll<HTMLTextAreaElement>('.editor textarea'), area = areas[areas.length - 1] ?? main.querySelector<HTMLInputElement>('.editor input');
  if (area && document.activeElement !== area) { area.focus(); if (area instanceof HTMLTextAreaElement) area.setSelectionRange(area.value.length, area.value.length); }
}

function about() {
  const made = partida ? `Orden y lugar de cada momento: una partida simulada (jugador <b>${html(partida.player)}</b>, ${partida.moments.length} momentos; <code>just guion</code> la vuelve a jugar).` : 'Sin partida simulada: <code>just guion</code> la juega y ordena los momentos.';
  const shot = Object.keys(photos).length;
  $('#about').innerHTML = `${made}<br>Fotos: <b>${shot}</b> (<code>just guion-fotos</code> hace las que faltan).<br>`
    + (writable ? '<b>Editar</b> cambia el texto en el código al momento (lo verás en <code>git diff</code>); <b>Sugerir</b> y <b>Comentar</b> lo dejan en <code>docs/guion-notes.json</code> para la skill <code>guion</code>.'
      : 'Solo lectura: las notas y las ediciones necesitan el servidor de <code>just guion</code>.');
  const speakers = new Map<string, number>(), kinds = new Map<EntryKind, number>();
  for (const e of script.entries) { kinds.set(e.kind, (kinds.get(e.kind) ?? 0) + 1); for (const l of e.lines) speakers.set(l.speaker, (speakers.get(l.speaker) ?? 0) + 1); }
  const keepWho = whoSelect.value, keepKind = kindSelect.value;
  whoSelect.innerHTML = `<option value="">Quien sea</option>${[...speakers].sort((a, b) => b[1] - a[1]).map(([id, n]) => `<option value="${id}">${html(voice(id).name)} · ${n}</option>`).join('')}`;
  kindSelect.innerHTML = `<option value="">Todo</option>${[...kinds].map(([k, n]) => `<option value="${k}">${KIND_LABELS[k]} · ${n}</option>`).join('')}`;
  whoSelect.value = keepWho; kindSelect.value = keepKind;
}

// ── Changing it ─────────────────────────────────────────────────────────────
async function saveLine(entry: string, i: number, next: string): Promise<string | undefined> {
  const e = entryById(entry), line = e?.lines[i];
  if (!line?.at) return 'Esta línea no se puede editar desde aquí.';
  if (next === line.text) return 'No has cambiado nada.';
  const answer = await fetch(GUION_EDIT_ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...line.at, old: line.text, next }) }).catch(() => undefined);
  const body = await answer?.json().catch(() => undefined) as { error?: string; aviso?: string; at?: { file: string; line: number } } | undefined;
  if (!answer?.ok) return body?.error ?? 'Sin servidor: abre la página con just guion.';
  await loadScript();
  changed.add(`${entry}#${i}`);
  toast(body?.aviso ?? `Guardado en ${body?.at?.file}:${body?.at?.line}. El juego lo dice así en cuanto se recargue.`);
  return undefined;
}

async function act(button: HTMLElement) {
  const article = button.closest<HTMLElement>('article[data-entry]');
  const entry = article?.dataset.entry;
  const e = entry ? entryById(entry) : undefined;
  if (!entry || !e) return;
  const say = button.closest<HTMLElement>('.say');
  const i = say ? Number(say.dataset.line) : undefined;
  const editor = button.closest<HTMLElement>('.editor');
  const text = editor?.querySelector('textarea')?.value ?? '';
  const why = editor?.querySelector('input')?.value ?? '';
  const act = button.dataset.act;
  message = undefined;
  if (act === 'edit' || act === 'suggest' || act === 'comment') { editing = { entry, line: i, mode: act }; refresh(entry); return; }
  if (act === 'comment-entry') { editing = { entry, mode: 'comment' }; refresh(entry); return; }
  if (act === 'cancel') { editing = undefined; refresh(entry); return; }
  const line = i !== undefined ? e.lines[i] : undefined;
  if (act === 'remove') { editing = { entry, line: i, mode: 'remove' }; refresh(entry); return; }
  if ((act === 'add-before' || act === 'add-after') && i !== undefined) { editing = { entry, line: i, mode: 'add', place: act === 'add-before' ? 'antes' : 'despues' }; refresh(entry); return; }
  if (act?.startsWith('add-') && editing?.mode === 'add' && editor) {
    const rows = [...editor.querySelectorAll('.block-row')].map(r => ({ speaker: r.querySelector('select')!.value, text: r.querySelector('textarea')!.value }));
    editing = { ...editing, block: rows, why };
    if (act === 'add-row') { editing.block = [...rows, { speaker: nextSpeaker(e, rows[rows.length - 1]?.speaker), text: '' }]; refresh(entry); return; }
    if (act === 'add-drop') { editing.block = rows.filter((_, j) => j !== Number(button.dataset.row)); refresh(entry); return; }
    if (act === 'add-save' && i !== undefined) {
      if (!rows.some(r => r.text.trim())) { message = { kind: 'warn', text: 'Escribe al menos una línea.' }; refresh(entry); return; }
      const was = editing;
      if (await saveNotes([...notes, newGuionNote({ entry, title: e.title, text: why, line: i, quote: line?.text, at: whereOf(line), change: 'añadir', place: editing.place, block: rows })])) { if (editing === was) editing = undefined; toast('Bloque guardado en docs/guion-notes.json: la skill guion lo escribirá en el código.'); }
      refresh(entry); return;
    }
  }
  if (act === 'remove-save' && i !== undefined) {
    const was = editing;
    if (await saveNotes([...notes, newGuionNote({ entry, title: e.title, text: why, line: i, quote: line?.text, at: whereOf(line), change: 'quitar' })])) { if (editing === was) editing = undefined; toast('Marcada para quitar en docs/guion-notes.json.'); }
    refresh(entry); return;
  }
  if (act === 'save' && i !== undefined) {
    button.setAttribute('disabled', '');
    const was = editing;
    const wrong = await saveLine(entry, i, text.trim());
    if (wrong) { message = { kind: 'err', text: wrong }; editing = { entry, line: i, mode: 'edit' }; refresh(entry); const area = document.querySelector<HTMLTextAreaElement>(`#${domId(entry)} .editor textarea`); if (area) area.value = text; return; }
    if (editing === was) editing = undefined;
    refresh(entry); return;
  }
  if (act === 'propose') {
    if (!text.trim() || text.trim() === line?.text) { message = { kind: 'warn', text: 'Escribe cómo quedaría la línea.' }; refresh(entry); return; }
    const was = editing;
    if (await saveNotes([...notes, newGuionNote({ entry, title: e.title, text: why, line: i, quote: line?.text, at: whereOf(line), proposal: text })])) { if (editing === was) editing = undefined; toast('Sugerencia guardada en docs/guion-notes.json.'); }
    refresh(entry); return;
  }
  if (act === 'note') {
    if (!text.trim()) { message = { kind: 'warn', text: 'El comentario está vacío.' }; refresh(entry); return; }
    const was = editing;
    if (await saveNotes([...notes, newGuionNote({ entry, title: e.title, text, ...(i !== undefined ? { line: i, quote: line?.text, at: whereOf(line) } : {}) })]) && editing === was) editing = undefined;
    render(); return;
  }
}

async function noteAction(button: HTMLElement) {
  const note = notes.find(n => n.id === button.dataset.id);
  if (!note) return;
  const what = button.dataset.note!;
  if (what === 'borrar') { if (await saveNotes(notes.filter(n => n !== note))) render(); return; }
  if (what === 'aplicar' && note.line !== undefined && note.proposal) {
    const wrong = await saveLine(note.entry, note.line, note.proposal);
    if (wrong) { toast(wrong); return; }
    const done = { ...closeGuionNote(note, 'hecha'), reply: note.reply ?? 'Aplicada desde el guion.' };
    await saveNotes(notes.map(n => n === note ? done : n));
    render(); return;
  }
  if (await saveNotes(notes.map(n => n === note ? closeGuionNote(note, what as GuionNoteStatus) : n))) render();
}

main.addEventListener('click', event => {
  const target = event.target as HTMLElement;
  const zoom = target.closest<HTMLImageElement>('img[data-zoom]');
  if (zoom) { const box = $('#zoom'); box.querySelector('img')!.src = zoom.src; box.style.display = 'grid'; return; }
  const noteButton = target.closest<HTMLElement>('[data-note]');
  if (noteButton) { void noteAction(noteButton); return; }
  const button = target.closest<HTMLElement>('[data-act]');
  if (button) { void act(button); return; }
  const text = target.closest<HTMLElement>('.text[data-editable]');
  if (text && !getSelection()?.toString()) {
    const entry = text.closest<HTMLElement>('article')!.dataset.entry!, line = Number(text.closest<HTMLElement>('.say')!.dataset.line);
    message = undefined; editing = { entry, line, mode: 'edit' }; refresh(entry);
  }
});
main.addEventListener('keydown', event => {
  const area = (event.target as HTMLElement).closest('.editor');
  if (!area) return;
  if (event.key === 'Escape') { event.preventDefault(); area.querySelector<HTMLElement>('[data-act="cancel"]')?.click(); }
  if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) { event.preventDefault(); area.querySelector<HTMLElement>('button.main')?.click(); }
});
main.addEventListener('change', event => {
  const select = (event.target as HTMLElement).closest<HTMLSelectElement>('.block-row select');
  if (select) select.parentElement!.style.setProperty('--c', voice(select.value).colour);
});
$('#zoom').addEventListener('click', () => { $('#zoom').style.display = 'none'; });
nav.addEventListener('click', event => {
  const id = (event.target as HTMLElement).closest<HTMLElement>('[data-section]')?.dataset.section;
  if (id) document.getElementById(`s-${id}`)?.scrollIntoView({ block: 'start' });
});
for (const input of [search, whoSelect, kindSelect, onlyNotes]) input.addEventListener('input', () => { editing = undefined; render(); });

await Promise.all([loadScript(), loadNotes()]);
about();
render();
const wanted = query.get('ver');
if (wanted) document.getElementById(domId(wanted))?.scrollIntoView({ block: 'center' });
if (query.get('editar') && wanted) { editing = { entry: wanted, line: Number(query.get('editar')), mode: 'edit' }; refresh(wanted); }
