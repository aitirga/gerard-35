/**
 * The bestiary's notes (docs/dev-tools.md § The bestiary): Aitor's comments on an entry and what he
 * marks to redo, kept in docs/bestiary-notes.json (tracked, so they travel between machines). The page
 * (src/bestiary.ts) writes them through the dev server (`bestiaryNotes` in vite.config.ts), and the
 * `bestiario` skill reads them, does what they ask and answers each one in `reply`. Keep this shape:
 * the skill depends on it.
 */
export const REDO = ['modelo', 'retrato', 'diseño', 'animaciones', 'combate'] as const;
export type Redo = (typeof REDO)[number];
export const NOTE_STATUS = ['abierta', 'hecha', 'descartada'] as const;
export type NoteStatus = (typeof NOTE_STATUS)[number];
export interface Note {
  /** `n-` and the time it was made, in base 36. */
  id: string;
  /** The bestiary entry's key (`aliado:`, `anima:`, `enemigo:`, `diseno:`, `npc:`), and its name as shown. */
  entry: string; name: string;
  /** What to redo; none: just a comment. */
  redo: Redo[];
  text: string;
  status: NoteStatus;
  /** ISO dates, to the second. */
  created: string; closed?: string;
  /** What was done about it, written by the `bestiario` skill. */
  reply?: string;
}
export interface NotesFile { notes: Note[] }

/** Where the notes live: the real file, and a scratch one the screenshots write to (`?notas=scratch`). */
export const NOTES_FILES = { real: 'docs/bestiary-notes.json', scratch: 'output/bestiary/notes-scratch.json' } as const;
export const NOTES_ENDPOINT = '/__bestiario/notas';

/** An ISO date to the second, as the file keeps them. */
export const isoNow = (now = new Date()) => now.toISOString().replace(/\.\d{3}Z$/, 'Z');

export function newNote(entry: string, name: string, redo: readonly Redo[], text: string, now = new Date()): Note {
  return { id: `n-${now.getTime().toString(36)}`, entry, name, redo: REDO.filter(r => redo.includes(r)), text: text.trim(), status: 'abierta', created: isoNow(now) };
}

/** What is wrong with a notes file, if anything: the dev server refuses to write one that is not this shape. */
export function notesProblem(data: unknown): string | undefined {
  if (!data || typeof data !== 'object' || !Array.isArray((data as NotesFile).notes)) return 'Se esperaba { "notes": [...] }.';
  const ids = new Set<string>();
  for (const [i, note] of (data as NotesFile).notes.entries()) {
    const at = `notes[${i}]`;
    if (!note || typeof note !== 'object') return `${at} no es un objeto.`;
    for (const key of ['id', 'entry', 'name', 'text', 'created'] as const) if (typeof note[key] !== 'string') return `${at}.${key} debe ser texto.`;
    if (!/^n-[0-9a-z]+$/.test(note.id)) return `${at}.id debe ser n-<base 36>.`;
    if (ids.has(note.id)) return `${at}.id repetido: ${note.id}.`;
    ids.add(note.id);
    if (!/^(aliado|anima|enemigo|diseno|npc):.+/.test(note.entry)) return `${at}.entry no es una entrada del bestiario: ${note.entry}.`;
    if (!Array.isArray(note.redo) || note.redo.some(r => !(REDO as readonly string[]).includes(r))) return `${at}.redo: solo ${REDO.join(', ')}.`;
    if (!(NOTE_STATUS as readonly string[]).includes(note.status)) return `${at}.status: ${NOTE_STATUS.join(', ')}.`;
    for (const key of ['reply', 'closed'] as const) if (note[key] !== undefined && typeof note[key] !== 'string') return `${at}.${key} debe ser texto.`;
    const extra = Object.keys(note).filter(k => !['id', 'entry', 'name', 'redo', 'text', 'status', 'created', 'closed', 'reply'].includes(k));
    if (extra.length) return `${at} tiene campos que no son del formato: ${extra.join(', ')}.`;
  }
  return undefined;
}

/** The file as it is written: two spaces, notes in the order they were made. */
export const notesJson = (data: NotesFile) => JSON.stringify({ notes: [...data.notes].sort((a, b) => a.created.localeCompare(b.created) || a.id.localeCompare(b.id)) }, null, 2) + '\n';
