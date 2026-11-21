/**
 * The script (`just guion`, docs/dev-tools.md § El guion): every line the game says, who says it and
 * where it is written, to read, edit in place and comment. Pure (no DOM, no fs): scripts/guion.mjs
 * gathers it from the game's own data, the page (src/guion-page.ts) shows it, and the dev server
 * (vite.config.ts) writes an edit back into the source and keeps the notes in docs/guion-notes.json.
 */

// ── Where a text is written ────────────────────────────────────────────────
/** A string literal in a source file: where it is, its quote and what it says once read. */
export interface Literal {
  start: number; end: number;
  /** 1-based, as editors count. */
  line: number; col: number;
  quote: "'" | '"' | '`';
  value: string;
  /** A template with `${…}` in it: its value keeps the holes as written, and it cannot be edited here. */
  dynamic: boolean;
}

const KEYWORDS_BEFORE_REGEX = new Set(['return', 'typeof', 'case', 'do', 'else', 'in', 'of', 'new', 'delete', 'void', 'throw', 'yield', 'await', 'instanceof']);

function unescape(body: string): string {
  return body.replace(/\\(u\{[0-9a-fA-F]+\}|u[0-9a-fA-F]{4}|x[0-9a-fA-F]{2}|\r\n|[\s\S])/g, (_, e: string) => {
    if (e[0] === 'u' && e[1] === '{') return String.fromCodePoint(parseInt(e.slice(2, -1), 16));
    if (e[0] === 'u' || e[0] === 'x') return String.fromCharCode(parseInt(e.slice(1), 16));
    return ({ n: '\n', t: '\t', r: '\r', b: '\b', f: '\f', v: '\v', 0: '\0', '\n': '', '\r\n': '' } as Record<string, string>)[e] ?? e;
  });
}

/** Every string literal in a TypeScript source, in order, skipping comments and regular expressions. */
export function literals(src: string): Literal[] {
  const found: Literal[] = [];
  const lineStarts = [0];
  for (let i = 0; i < src.length; i++) if (src[i] === '\n') lineStarts.push(i + 1);
  const where = (offset: number) => {
    let lo = 0, hi = lineStarts.length - 1;
    while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (lineStarts[mid] <= offset) lo = mid; else hi = mid - 1; }
    return { line: lo + 1, col: offset - lineStarts[lo] + 1 };
  };
  // What came before, to tell a regular expression from a division.
  let last = '', lastWord = '';
  const quoted = (i: number, quote: "'" | '"') => {
    let j = i + 1;
    while (j < src.length && src[j] !== quote && src[j] !== '\n') j += src[j] === '\\' ? 2 : 1;
    return j;
  };
  // A template from its backtick; returns its end (past the closing backtick) and whether it has holes.
  const template = (i: number): { end: number; dynamic: boolean } => {
    let j = i + 1, dynamic = false;
    while (j < src.length && src[j] !== '`') {
      if (src[j] === '\\') { j += 2; continue; }
      if (src[j] === '$' && src[j + 1] === '{') { dynamic = true; j = code(j + 2, true); continue; }
      j++;
    }
    return { end: j + 1, dynamic };
  };
  // Code from `i`: inside a `${…}` it stops past the closing brace; at the top it reads to the end.
  function code(i: number, hole: boolean): number {
    let depth = 0;
    while (i < src.length) {
      const c = src[i], next = src[i + 1];
      if (c === '/' && next === '/') { const nl = src.indexOf('\n', i); i = nl < 0 ? src.length : nl; continue; }
      if (c === '/' && next === '*') { const close = src.indexOf('*/', i + 2); i = close < 0 ? src.length : close + 2; continue; }
      if (c === "'" || c === '"') {
        const end = quoted(i, c);
        found.push({ start: i, end: end + 1, ...where(i), quote: c, value: unescape(src.slice(i + 1, end)), dynamic: false });
        i = end + 1; last = c; lastWord = ''; continue;
      }
      if (c === '`') {
        const { end, dynamic } = template(i);
        found.push({ start: i, end, ...where(i), quote: '`', value: dynamic ? src.slice(i + 1, end - 1) : unescape(src.slice(i + 1, end - 1)), dynamic });
        i = end; last = '`'; lastWord = ''; continue;
      }
      if (c === '/') {
        const regex = !last || '(,=:[!&|?{};+-*%<>~^'.includes(last) || KEYWORDS_BEFORE_REGEX.has(lastWord);
        if (regex) {
          let j = i + 1, inClass = false;
          while (j < src.length && src[j] !== '\n' && (inClass || src[j] !== '/')) {
            if (src[j] === '\\') j++;
            else if (src[j] === '[') inClass = true;
            else if (src[j] === ']') inClass = false;
            j++;
          }
          j++;
          while (/[a-z]/i.test(src[j] ?? '')) j++;
          i = j; last = '/'; lastWord = ''; continue;
        }
      }
      if (hole && c === '{') depth++;
      if (hole && c === '}') { if (depth === 0) return i + 1; depth--; }
      if (/\s/.test(c)) { i++; continue; }
      if (/[\w$]/.test(c)) {
        let j = i;
        while (j < src.length && /[\w$]/.test(src[j])) j++;
        lastWord = src.slice(i, j); last = src[j - 1]; i = j; continue;
      }
      last = c; lastWord = ''; i++;
    }
    return i;
  }
  code(0, false);
  // A template's own literal goes in after those in its holes: back in the order they are written.
  return found.sort((a, b) => a.start - b.start);
}

/** A text written as a literal with `quote`, ready to go back into the source. */
export function encodeLiteral(value: string, quote: Literal['quote']): string {
  let body = value.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t');
  body = body.split(quote).join(`\\${quote}`);
  if (quote === '`') body = body.replace(/\$\{/g, '\\${');
  return `${quote}${body}${quote}`;
}

/** Where a line of the script is written: the file (from the repository's root) and the literal's start. */
export interface Where { file: string; line: number; col: number }

/**
 * The source with one literal changed from `old` to `next`: the one at `at` if it still says `old`,
 * else the only literal in the file that says it. An error when it is gone, said more than once, or
 * built from pieces (a template with holes).
 */
export function replaceLiteral(src: string, at: Pick<Where, 'line' | 'col'>, old: string, next: string): { source: string; literal: Literal } | { error: string } {
  const all = literals(src);
  const here = all.find(l => l.line === at.line && l.col === at.col);
  if (here?.dynamic) return { error: 'Este texto se arma con piezas en el código: no se puede editar desde aquí. Déjalo como sugerencia.' };
  const same = all.filter(l => !l.dynamic && l.value === old);
  const literal = here && !here.dynamic && here.value === old ? here : same.length === 1 ? same[0] : undefined;
  if (!literal) return { error: same.length ? `El texto aparece ${same.length} veces en el archivo y ya no está donde estaba: recarga la página.` : 'El texto ya no está en el archivo (¿lo ha cambiado alguien?): recarga la página.' };
  if (!next.trim()) return { error: 'El texto nuevo está vacío.' };
  return { source: src.slice(0, literal.start) + encodeLiteral(next, literal.quote) + src.slice(literal.end), literal };
}

// ── The script ─────────────────────────────────────────────────────────────
/**
 * Who says a line: a speaker of `SPEAKERS` (src/dialogue.ts), or one of these, which have no face:
 * the narration (a fight's or an ending's), the TV, what is written on screen (a card, a caption, an
 * object's note) and Gerard's diary.
 */
export const VOICES = { narracion: 'Narración', tele: 'Tele', rotulo: 'En pantalla', diario: 'Diario' } as const;

export type EntryKind = 'dialogo' | 'linea' | 'mirar' | 'grito' | 'burbuja' | 'tele' | 'rotulo' | 'narracion' | 'diario' | 'objeto';
export const KIND_LABELS: Record<EntryKind, string> = {
  dialogo: 'Diálogo', linea: 'En combate', mirar: 'Mirar', grito: 'Grito', burbuja: 'Burbuja', tele: 'Tele',
  rotulo: 'En pantalla', narracion: 'Narración', diario: 'Diario', objeto: 'Objeto',
};

export interface GuionLine {
  speaker: string; text: string;
  /** Where it is written; none when it is built at run time (read only). */
  at?: Where;
  /** Built from pieces in the code (`${…}`): read only. */
  dynamic?: boolean;
}
export interface GuionEntry {
  /** Stable while the code keeps its names: `<module>:<path>` (`chapter-1:LINES.mama`), `lugar:<interaction id>`, `<module>:texto/<line>` for one found in the code. */
  id: string;
  /** The section it belongs to (`GROUPS`). */
  group: string;
  kind: EntryKind;
  /** Its key in the code, or what is looked at. */
  title: string;
  /** A dialogue's two sides. */
  left?: string; right?: string;
  /** Where a thing looked at is. */
  place?: { environment: string; name: string; cell?: { x: number; z: number } };
  lines: GuionLine[];
}
/** The sections, in the order the page shows them. */
export const GROUPS: readonly { id: string; label: string }[] = [
  { id: 'capitulo-1', label: 'Capítulo 1 · Sant Quirze' },
  { id: 'capitulo-2', label: 'Capítulo 2 · Barcelona' },
  { id: 'castillo', label: 'El castillo' },
  { id: 'nuria', label: 'Nuria y Uri' },
  { id: 'universidad', label: 'Los amigos de la uni' },
  { id: 'emilie', label: 'Emilie' },
  { id: 'luca', label: 'Luca' },
  { id: 'marta', label: 'Marta' },
  { id: 'bernat', label: 'Bernat' },
  { id: 'lugares', label: 'Lugares · lo que se mira' },
  { id: 'diario', label: 'Diario' },
  { id: 'objetos', label: 'Objetos' },
];

export const isLine = (v: unknown): v is { speaker: string; text: string } =>
  !!v && typeof v === 'object' && typeof (v as { speaker?: unknown }).speaker === 'string' && typeof (v as { text?: unknown }).text === 'string';
export const isDialogue = (v: unknown): v is { left: string; right?: string; lines: { speaker: string; text: string }[] } =>
  !!v && typeof v === 'object' && typeof (v as { left?: unknown }).left === 'string' && Array.isArray((v as { lines?: unknown }).lines)
  && (v as { lines: unknown[] }).lines.length > 0 && (v as { lines: unknown[] }).lines.every(isLine);
export const isLook = (v: unknown): v is { id: string; label: string; lines: string[]; cell?: { x: number; z: number } } =>
  !!v && typeof v === 'object' && typeof (v as { id?: unknown }).id === 'string' && typeof (v as { label?: unknown }).label === 'string'
  && Array.isArray((v as { lines?: unknown }).lines) && (v as { lines: unknown[] }).lines.every(l => typeof l === 'string');

/**
 * Every dialogue, lone line (said in a fight) and thing to look at under `value`, with its path
 * (`LINES.mama`, `FEARS[2].tell`), in the order the code writes them.
 */
export function walk(name: string, value: unknown, found: (path: string, item: unknown, kind: 'dialogo' | 'linea' | 'mirar') => void, seen = new WeakSet<object>(), depth = 0): void {
  if (!value || typeof value !== 'object' || depth > 9 || seen.has(value)) return;
  seen.add(value);
  if (isDialogue(value)) { found(name, value, 'dialogo'); return; }
  if (isLine(value)) { found(name, value, 'linea'); return; }
  if (isLook(value)) { found(name, value, 'mirar'); return; }
  if (Array.isArray(value)) value.forEach((v, i) => walk(`${name}[${i}]`, v, found, seen, depth + 1));
  else for (const [k, v] of Object.entries(value)) walk(`${name}.${k}`, v, found, seen, depth + 1);
}

/** Does a literal read like something the game says (for the files read whole, `SCANNED` in scripts/guion.mjs)? */
export const readsLikeText = (l: Literal) => /^[«¿¡"'(…A-ZÁÉÍÓÚÑ]/.test(l.value) && /\s/.test(l.value.trim()) && /[a-záéíóúñ]{2}/.test(l.value) && !/^[A-Z][a-z]+[A-Z]/.test(l.value) && l.value.length >= 12;

// ── When it is said: one played game (`partida`) ───────────────────────────
/** One time a dialogue is said in the simulated game (scripts/guion.mjs `partida`, src/game-sim.ts). */
export interface Moment {
  /** Its place in the game: 1 is the first thing said. */
  n: number;
  entry: string;
  /** The game's stretch (`Capítulo 1`, `Nuria y Uri`…), day and hour (chapter 2), where and what set it off. */
  stage: string; day: number; hour: number; environment: string; cell: { x: number; z: number }; event: string;
  /** The game reloaded just after it (`/?story=…` or `/?mission=…&part=…`), for its photo, and just before it when that differs (to see it happen). */
  jump: string; before?: string;
}
export interface Partida { player: string; seed: number; made: string; moments: Moment[]; visits: Record<string, string> }

/** The photo's file for an entry, under output/guion/fotos/. */
export const photoName = (entry: string) => `${entry.replace(/[^a-zA-Z0-9-]+/g, '_').replace(/^_|_$/g, '')}.jpg`;

// ── Aitor's notes ──────────────────────────────────────────────────────────
/**
 * The notes on the script: a comment, or a suggestion (a line written as he would have it, for an agent
 * to apply with the `guion` skill). Kept in docs/guion-notes.json (tracked, so they travel between
 * machines); the skill answers each one in `reply`. Keep this shape: the skill depends on it.
 */
export const GUION_NOTE_STATUS = ['abierta', 'hecha', 'descartada'] as const;
export type GuionNoteStatus = (typeof GUION_NOTE_STATUS)[number];
export interface GuionNote {
  /** `g-` and the time it was made, in base 36. */
  id: string;
  /** The entry's id, and its title as shown. */
  entry: string; title: string;
  /** The line it is about (0-based), and what that line said when the note was written; none: the whole entry. */
  line?: number; quote?: string;
  /** How he would write the line instead; none: a comment. */
  proposal?: string;
  text: string;
  status: GuionNoteStatus;
  /** ISO dates, to the second. */
  created: string; closed?: string;
  /** What was done about it, written by the `guion` skill. */
  reply?: string;
}
export interface GuionNotesFile { notes: GuionNote[] }

export const GUION_NOTES_FILES = { real: 'docs/guion-notes.json', scratch: 'output/guion/notes-scratch.json' } as const;
export const GUION_NOTES_ENDPOINT = '/__guion/notas';
export const GUION_EDIT_ENDPOINT = '/__guion/editar';
export const GUION_PAGE = '/guion.html';

const isoNow = (now = new Date()) => now.toISOString().replace(/\.\d{3}Z$/, 'Z');
export function newGuionNote(fields: Pick<GuionNote, 'entry' | 'title' | 'text'> & Partial<Pick<GuionNote, 'line' | 'quote' | 'proposal'>>, now = new Date()): GuionNote {
  const note: GuionNote = { id: `g-${now.getTime().toString(36)}`, entry: fields.entry, title: fields.title, text: fields.text.trim(), status: 'abierta', created: isoNow(now) };
  if (fields.line !== undefined) { note.line = fields.line; note.quote = fields.quote ?? ''; }
  if (fields.proposal !== undefined && fields.proposal.trim()) note.proposal = fields.proposal.trim();
  return note;
}
export const closeGuionNote = (note: GuionNote, status: GuionNoteStatus, now = new Date()): GuionNote => {
  const { closed: _, ...rest } = note;
  return status === 'abierta' ? { ...rest, status } : { ...rest, status, closed: isoNow(now) };
};

const NOTE_KEYS = ['id', 'entry', 'title', 'line', 'quote', 'proposal', 'text', 'status', 'created', 'closed', 'reply'];
/** What is wrong with a notes file, if anything: the dev server refuses to write one that is not this shape. */
export function guionNotesProblem(data: unknown): string | undefined {
  if (!data || typeof data !== 'object' || !Array.isArray((data as GuionNotesFile).notes)) return 'Se esperaba { "notes": [...] }.';
  const ids = new Set<string>();
  for (const [i, note] of (data as GuionNotesFile).notes.entries()) {
    const at = `notes[${i}]`;
    if (!note || typeof note !== 'object') return `${at} no es un objeto.`;
    for (const key of ['id', 'entry', 'title', 'text', 'created'] as const) if (typeof note[key] !== 'string') return `${at}.${key} debe ser texto.`;
    if (!/^g-[0-9a-z]+$/.test(note.id)) return `${at}.id debe ser g-<base 36>.`;
    if (ids.has(note.id)) return `${at}.id repetido: ${note.id}.`;
    ids.add(note.id);
    if (note.line !== undefined && (!Number.isInteger(note.line) || note.line < 0)) return `${at}.line debe ser un número de línea.`;
    for (const key of ['quote', 'proposal', 'closed', 'reply'] as const) if (note[key] !== undefined && typeof note[key] !== 'string') return `${at}.${key} debe ser texto.`;
    if (!note.text.trim() && !note.proposal) return `${at} no dice nada.`;
    if (!(GUION_NOTE_STATUS as readonly string[]).includes(note.status)) return `${at}.status: ${GUION_NOTE_STATUS.join(', ')}.`;
    const extra = Object.keys(note).filter(k => !NOTE_KEYS.includes(k));
    if (extra.length) return `${at} tiene campos que no son del formato: ${extra.join(', ')}.`;
  }
  return undefined;
}
/** The file as it is written: two spaces, notes in the order they were made. */
export const guionNotesJson = (data: GuionNotesFile) => JSON.stringify({ notes: [...data.notes].sort((a, b) => a.created.localeCompare(b.created) || a.id.localeCompare(b.id)) }, null, 2) + '\n';
