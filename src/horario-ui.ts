import { isDpad, type ControllerEvent } from './controller';
import { CLASSROOMS, HORARIO_SIZE, HOURS, SUBJECTS, squares, withGiven, type Board, type Horario } from './horario';
import type { SoundId } from './sfx';

/**
 * El horario on screen (docs/castle.md § The closed doors): the sheet pinned by the second floor's closed
 * door, an hour a row and a classroom a column. What is in ink stays; either player moves the pencil
 * from cell to cell and changes what is written in it. Nothing on it says how it squares: Gerard says
 * what a timetable is when he first looks at it, and the sheet answers only once it is full.
 */
type Player = 1 | 2;
const N = HORARIO_SIZE;
const escape = (text: string) => text.replace(/[&<>"]/g, c => `&#${c.charCodeAt(0)};`);

export function createHorarioUI(hud: HTMLElement, callbacks: {
  pause: (paused: boolean) => void;
  sound: (id: SoundId) => void;
  /** Today's sheet, and what was pencilled on it the last time it was looked at. */
  sheet: () => { horario: Horario; tried: Board };
  /** What is pencilled now, kept for the next look. */
  keep: (tried: Board) => void;
  /** A full sheet that squares; the story answers whether the door gives (`true` closes the sheet). */
  squared: (board: Board) => boolean;
}) {
  const root = document.createElement('section');
  root.id = 'horario-panel'; root.hidden = true; root.tabIndex = -1;
  root.setAttribute('role', 'dialog'); root.setAttribute('aria-label', 'El horario');
  hud.append(root);
  let open = false, openedAt = 0, at = 0, note = '', shake = false;
  let horario: Horario | undefined, tried: Board = [];
  let closed: (() => void) | undefined;
  const board = () => withGiven(horario!, tried);

  function render() {
    if (!horario) return;
    const now = board();
    root.innerHTML = `<div class="horario-sheet" ${shake ? 'data-shake' : ''}>
        <header><span class="horario-kicker">SECRETARÍA · CURSO 2.º</span><strong>Horario provisional</strong></header>
        <table class="horario-grid">
          <thead><tr><th></th>${CLASSROOMS.map(room => `<th scope="col">${escape(room)}</th>`).join('')}</tr></thead>
          <tbody>${HOURS.map((hour, row) => `<tr><th scope="row">${escape(hour)}</th>${Array.from({ length: N }, (_, column) => {
            const i = row * N + column, value = now[i], ink = !!horario!.given[i], subject = value ? SUBJECTS[value - 1] : undefined;
            return `<td><button type="button" class="horario-cell" data-cell="${i}" ${ink ? 'data-ink' : ''} ${value ? `data-subject="${value}"` : ''} ${i === at ? 'aria-current="true"' : ''} aria-label="${escape(`${hour}, ${CLASSROOMS[column]}: ${subject?.name ?? 'vacío'}`)}">${subject ? `<b>${subject.code}</b>` : ''}</button></td>`;
          }).join('')}</tr>`).join('')}</tbody>
        </table>
        <ul class="horario-key">${SUBJECTS.map((subject, i) => `<li data-subject="${i + 1}"><b>${subject.code}</b> ${escape(subject.name)}</li>`).join('')}</ul>
        <p class="horario-note" aria-live="polite">${escape(note)}</p>
      </div>
      <footer class="parcelas-help">
        <span data-glyph-template="{arrows} · Moverse  ·  {confirm} · Cambiar lo escrito  ·  {cancel} · Dejarlo"></span>
        <button type="button" class="journal-close" data-horario-close data-back>Dejarlo <kbd data-glyph="cancel"></kbd></button>
      </footer>`;
    shake = false;
  }
  function move(dx: number, dz: number) {
    const row = (Math.floor(at / N) + dz + N) % N, column = (at % N + dx + N) % N;
    at = row * N + column; note = '';
    callbacks.sound('ui-move'); render();
  }
  /** The next subject in the cell under the pencil (empty after the last); ink does not change. */
  function write() {
    if (!horario) return;
    if (horario.given[at]) { note = 'Eso está en tinta.'; callbacks.sound('denied'); render(); return; }
    tried[at] = ((tried[at] ?? 0) + 1) % (N + 1); note = '';
    callbacks.keep([...tried]);
    const now = board();
    if (now.every(Boolean)) {
      if (squares(now) && callbacks.squared(now)) { callbacks.sound('unlock'); close(); return; }
      note = 'No cuadra.'; shake = true; callbacks.sound('denied'); render(); return;
    }
    callbacks.sound('ui-confirm'); render();
  }
  /** Opens today's sheet as it was left; resolves when it is closed (squared or left). */
  function show() {
    if (open) return Promise.resolve();
    const sheet = callbacks.sheet();
    horario = sheet.horario; tried = Array.from({ length: N * N }, (_, i) => sheet.tried[i] ?? 0);
    // The pencil starts on the first cell there is something to write in.
    at = Math.max(0, horario.given.findIndex(value => !value));
    open = true; openedAt = performance.now(); note = '';
    root.hidden = false; hud.dataset.horario = 'open'; callbacks.pause(true);
    render();
    return new Promise<void>(resolve => { closed = resolve; });
  }
  function close() {
    if (!open) return;
    open = false; root.hidden = true; root.replaceChildren(); delete hud.dataset.horario; callbacks.pause(false);
    document.querySelector<HTMLElement>('#game')?.focus({ preventScroll: true });
    closed?.(); closed = undefined;
  }
  function control(action: ControllerEvent, _player: Player = 1) {
    if (!open) return;
    if (action === 'cancel' || action === 'menu') close();
    else if (action === 'confirm') write();
    else if (action === 'up') move(0, -1);
    else if (action === 'down') move(0, 1);
    else if (action === 'left') move(-1, 0);
    else if (action === 'right') move(1, 0);
    else if (isDpad(action)) return;
  }
  root.addEventListener('click', event => {
    const target = event.target as HTMLElement;
    if (target.closest('[data-horario-close]')) { close(); return; }
    const button = target.closest<HTMLButtonElement>('.horario-cell');
    if (!button) return;
    const cell = Number(button.dataset.cell);
    if (cell !== at) { at = cell; note = ''; render(); } else write();
  });
  // Ahead of the game and the menu: while it is open the keys are its own (player 1's).
  function keydown(event: KeyboardEvent) {
    if (!open || document.querySelector('dialog[open]')) return;
    const keys: Record<string, ControllerEvent> = {
      ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down',
      Space: 'confirm', Enter: 'confirm', Escape: 'cancel',
    };
    const action = keys[event.code];
    if (!action) return;
    event.preventDefault(); event.stopImmediatePropagation();
    // The press that opened it must not write straight away.
    if (action === 'confirm' && (performance.now() - openedAt < 250 || event.repeat)) return;
    control(action, 1);
  }
  window.addEventListener('keydown', keydown, { capture: true });
  return {
    open: show, close, control,
    get isOpen() { return open; },
    destroy() { close(); window.removeEventListener('keydown', keydown, { capture: true }); root.remove(); },
  };
}
