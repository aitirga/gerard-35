/**
 * The ánimas' sheet's notes (docs/dev-tools.md § The ánimas' sheet): Aitor's comments on an ánima,
 * the duals, the shared mechanics or how ánimas grow, kept in docs/anima-notes.json (tracked, so they
 * travel between machines). The sheet (scripts/animas.mjs, served by `just animas`) writes them
 * through the dev server (`notesEndpoint` in vite.config.ts), and the `anima` skill reads the open
 * ones on what it works on and answers each in `reply`. Keep this shape: the skill depends on it.
 */
import { NOTE_STATUS, isoNow, type NoteStatus } from './bestiary-notes.ts';

export interface AnimaNote {
  /** `n-` and the time it was made, in base 36. */
  id: string;
  /** What it is about: an ánima's folder in docs/animas/ (its `ClassId`) or one of `SHEET_PAGES`, and its name as shown. */
  entry: string; name: string;
  text: string;
  status: NoteStatus;
  /** ISO dates, to the second; `edited`: the last time its text was changed. */
  created: string; edited?: string; closed?: string;
  /** What was done about it, written by the `anima` skill. */
  reply?: string;
}
export interface AnimaNotesFile { notes: AnimaNote[] }

/** The sheet's pages that are not an ánima. */
export const SHEET_PAGES = { catalogo: 'Catálogo', duos: 'Dúos', mecanicas: 'Mecánicas compartidas', reglas: 'Cómo crecen' } as const;
/** Where the notes live: the real file, and a scratch one the screenshots write to (`?notas=scratch`). */
export const ANIMA_NOTES_FILES = { real: 'docs/anima-notes.json', scratch: 'output/reports/animas/notes-scratch.json' } as const;
export const ANIMA_NOTES_ENDPOINT = '/__animas/notas';
/** Where the dev server serves the sheet, written again each time it is asked for. */
export const ANIMAS_PAGE = '/output/reports/animas/';

export function newAnimaNote(entry: string, name: string, text: string, now = new Date()): AnimaNote {
  return { id: `n-${now.getTime().toString(36)}`, entry, name, text: text.trim(), status: 'abierta', created: isoNow(now) };
}

const FIELDS = ['id', 'entry', 'name', 'text', 'status', 'created', 'edited', 'closed', 'reply'];
/** What is wrong with a notes file, if anything: the dev server refuses to write one that is not this shape. */
export function animaNotesProblem(data: unknown): string | undefined {
  if (!data || typeof data !== 'object' || !Array.isArray((data as AnimaNotesFile).notes)) return 'Se esperaba { "notes": [...] }.';
  const ids = new Set<string>();
  for (const [i, note] of (data as AnimaNotesFile).notes.entries()) {
    const at = `notes[${i}]`;
    if (!note || typeof note !== 'object') return `${at} no es un objeto.`;
    for (const key of ['id', 'entry', 'name', 'text', 'created'] as const) if (typeof note[key] !== 'string') return `${at}.${key} debe ser texto.`;
    if (!/^n-[0-9a-z]+$/.test(note.id)) return `${at}.id debe ser n-<base 36>.`;
    if (ids.has(note.id)) return `${at}.id repetido: ${note.id}.`;
    ids.add(note.id);
    if (!/^[a-z][a-z0-9-]*$/.test(note.entry)) return `${at}.entry debe ser el id de un ánima o una página de la hoja: ${note.entry}.`;
    if (!note.text.trim()) return `${at}.text está vacío.`;
    if (!(NOTE_STATUS as readonly string[]).includes(note.status)) return `${at}.status: ${NOTE_STATUS.join(', ')}.`;
    for (const key of ['edited', 'closed', 'reply'] as const) if (note[key] !== undefined && typeof note[key] !== 'string') return `${at}.${key} debe ser texto.`;
    const extra = Object.keys(note).filter(k => !FIELDS.includes(k));
    if (extra.length) return `${at} tiene campos que no son del formato: ${extra.join(', ')}.`;
  }
  return undefined;
}

/** The file as it is written: two spaces, notes in the order they were made. */
export const animaNotesJson = (data: AnimaNotesFile) => JSON.stringify({ notes: [...data.notes].sort((a, b) => a.created.localeCompare(b.created) || a.id.localeCompare(b.id)) }, null, 2) + '\n';
