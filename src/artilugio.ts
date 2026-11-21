/**
 * The artilugio (docs/story-outline.md § The device): the board hidden in the real flat, and
 * the one way its notes come into the game. A note (0–7: a button alone or a pair, `artilugioNote`)
 * comes from the real board through the game's server (artilugio.py, as server-sent events), or,
 * when the board is not there, from the keyboard (1–4, two at once for a pair) or player 1's pad
 * (hold the left trigger and press the face buttons). Movement in front of the board comes the same
 * way, and so do its comings and goings.
 *
 * The game tells the server what the story says the board is (`setMode`): asleep until the portal
 * at El Nucli sends it, alive from then on, awake in the Queen's last fight, free after it.
 */
import { ARTILUGIO_BUTTONS, artilugioNote } from './castle.ts';
import type { PadSnapshot } from './controller.ts';

export type ArtilugioMode = 'asleep' | 'alive' | 'awake' | 'free';
export type NoteSource = 'board' | 'keyboard' | 'pad';
export interface ArtilugioNote { note: number; source: NoteSource }
export interface BoardStatus { mode: ArtilugioMode; connected: boolean }

/** Two buttons pressed this close together (ms) are one pair, as on the board (firmware/artilugio/notes.h). */
export const CHORD_MS = 60;
/** The keys that stand in for its buttons: red, yellow, green, blue. */
export const NOTE_KEYS = ['1', '2', '3', '4'] as const;
/** The pad's face buttons for them, by the colours an Xbox pad prints on its own: B red, Y yellow, A green, X blue. */
export const PAD_FACES = [1, 3, 0, 2] as const;
/** The standard mapping's left trigger, held to play them. */
export const PAD_HOLD = 6;

/**
 * Presses grouped into notes: the first button waits `CHORD_MS` for a second one; together they are a
 * pair. Pure apart from the clock it is given, so the tests drive it by hand.
 */
export class Chords {
  private pending: number[] = [];
  private timer: ReturnType<typeof setTimeout> | undefined;
  private readonly play: (note: number) => void;
  private readonly later: (run: () => void, ms: number) => ReturnType<typeof setTimeout>;
  constructor(play: (note: number) => void, later: (run: () => void, ms: number) => ReturnType<typeof setTimeout> = (run, ms) => setTimeout(run, ms)) { this.play = play; this.later = later; }
  press(button: number) {
    if (button < 0 || button >= ARTILUGIO_BUTTONS) return;
    if (!this.pending.length) { this.pending = [button]; this.timer = this.later(() => this.flush(), CHORD_MS); return; }
    if (this.pending.length === 1 && this.pending[0] !== button) { this.pending.push(button); this.flush(); }
  }
  flush() {
    if (this.timer !== undefined) clearTimeout(this.timer);
    this.timer = undefined;
    const buttons = this.pending;
    this.pending = [];
    if (buttons.length) this.play(artilugioNote(buttons));
  }
}

export interface Artilugio {
  onNote(listener: (note: ArtilugioNote) => void): () => void;
  onMotion(listener: () => void): () => void;
  onBoard(listener: (status: BoardStatus) => void): () => void;
  /** What the server last said of the board. */
  readonly board: BoardStatus;
  /** What the story says the board is now; the server passes it on the next time the board asks. */
  setMode(mode: ArtilugioMode): void;
  /** Escuchar: the real board sounds in the flat. */
  listen(): void;
  /** Player 1's pad, every frame: true while its trigger is held to play, so its face buttons do nothing else. */
  pad(pad: PadSnapshot | undefined): boolean;
  destroy(): void;
}

/**
 * The bus. `standIns` says whether the keyboard and the pad play its notes now (the story has it, and
 * nothing else on screen wants those keys); the real board is always heard once it is alive.
 */
export function createArtilugio(standIns: () => boolean): Artilugio {
  const notes = new Set<(note: ArtilugioNote) => void>(), motions = new Set<() => void>(), boards = new Set<(status: BoardStatus) => void>();
  let board: BoardStatus = { mode: 'asleep', connected: false };
  let mode: ArtilugioMode | undefined;
  const emit = (note: number, source: NoteSource) => { for (const listener of notes) listener({ note, source }); };
  const keyboard = new Chords(note => emit(note, 'keyboard'));
  const padChords = new Chords(note => emit(note, 'pad'));
  let padHeld = false, padDown: boolean[] = [];

  function keydown(event: KeyboardEvent) {
    const button = NOTE_KEYS.indexOf(event.key as typeof NOTE_KEYS[number]);
    if (button < 0 || event.metaKey || event.ctrlKey || event.altKey || !standIns()) return;
    if ((event.target as HTMLElement | null)?.closest?.('input, textarea, [contenteditable]')) return;
    event.preventDefault(); event.stopImmediatePropagation();
    if (!event.repeat) keyboard.press(button);
  }
  window.addEventListener('keydown', keydown, { capture: true });

  // The real board, through the server: notes and movement as they happen, and whether it is there.
  /** The last word sent to the server, so what follows it (Escuchar) arrives after it. */
  let sent: Promise<unknown> = Promise.resolve();
  const send = (next: ArtilugioMode) => (sent = sent.then(() => fetch('/api/artilugio', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ mode: next }) }).catch(() => undefined)));
  let source: EventSource | undefined;
  let retry: ReturnType<typeof setTimeout> | undefined;
  function connect() {
    if (typeof EventSource === 'undefined') return;
    // `game=1`: while this stream is open the board knows someone is playing, and only then calls out.
    source = new EventSource('/api/artilugio/events?game=1');
    /** The stream's first word is what the server holds now; after it, a change is another tab's say. */
    let first = true;
    source.onmessage = message => {
      let event: { type: string; note?: number; mode?: ArtilugioMode | null; connected?: boolean };
      try { event = JSON.parse(message.data); } catch { return; }
      if (event.type === 'note' && typeof event.note === 'number') emit(event.note, 'board');
      else if (event.type === 'motion') for (const listener of motions) listener();
      else if (event.type === 'board') {
        board = { mode: event.mode ?? board.mode, connected: !!event.connected };
        for (const listener of boards) listener(board);
        // A server started again knows no mode (null) until told: tell it again, once per stream. Answering
        // every change would set two open tabs arguing over the board for ever; the tab in view wins (`shown`).
        if (first && mode && event.mode !== mode) send(mode);
        first = false;
      }
    };
    // No server (a static build) or a dropped one: try again now and then, quietly.
    source.onerror = () => {
      source?.close(); source = undefined; retry = setTimeout(connect, 10_000);
      // Without the server nothing says the board is there.
      if (board.connected) { board = { ...board, connected: false }; for (const listener of boards) listener(board); }
    };
  }
  connect();
  /** The tab coming into view takes the board back from any other the game is open in. */
  const shown = () => { if (globalThis.document?.visibilityState === 'visible' && mode && board.mode !== mode) send(mode); };
  globalThis.document?.addEventListener('visibilitychange', shown);

  return {
    onNote(listener) { notes.add(listener); return () => notes.delete(listener); },
    onMotion(listener) { motions.add(listener); return () => motions.delete(listener); },
    onBoard(listener) { boards.add(listener); return () => boards.delete(listener); },
    get board() { return board; },
    setMode(next) { if (next === mode) return; mode = next; void send(next); },
    listen() { sent = sent.then(() => fetch('/api/artilugio/listen', { method: 'POST' }).catch(() => undefined)); },
    pad(pad) {
      const held = !!pad?.connected && !!pad.buttons[PAD_HOLD]?.pressed && standIns();
      const down = PAD_FACES.map(face => held && !!pad!.buttons[face]?.pressed);
      if (held) down.forEach((pressed, button) => { if (pressed && !padDown[button]) padChords.press(button); });
      padDown = down; padHeld = held;
      return padHeld;
    },
    destroy() {
      window.removeEventListener('keydown', keydown, { capture: true });
      globalThis.document?.removeEventListener('visibilitychange', shown);
      clearTimeout(retry); source?.close();
      notes.clear(); motions.clear(); boards.clear();
    },
  };
}
