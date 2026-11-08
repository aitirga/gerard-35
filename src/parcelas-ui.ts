import { isDpad, type ControllerEvent } from './controller';
import { nearestButton } from './menu-nav';
import type { Direction } from './movement';
import { choose, createBoard, currentClue, loadPuzzle, solved, type Board, type Outcome, type Puzzle, type Sealed } from './parcelas';
import type { SoundId } from './sfx';

/**
 * Las parcelas on screen (docs/quests/universidad.md § Càmping Eurosport): at the blackboard by the
 * pool the puzzle opens as a board, the blackboard on top with the clue in chalk and the pitches below
 * as wooden signs; each one found lights a bulb over the merendero's steel door. Gerard and Aitor each move their own
 * marker and either can choose. Moves and buttons read the device in use (input-glyphs.ts).
 */
const FILES = import.meta.glob<Puzzle | Sealed>('./parcelas/*.json', { import: 'default' });
/** The easy test puzzle in development, the sealed real one in a release build; lazily, so development never fetches it. */
export async function gamePuzzle(level: 'prueba' | 'produccion' = import.meta.env.DEV ? 'prueba' : 'produccion'): Promise<Puzzle> {
  const file = FILES[`./parcelas/${level}.json`] ?? FILES['./parcelas/prueba.json'];
  if (!file) throw new Error('No hay ningún puzzle en src/parcelas/: just parcelas prueba');
  return loadPuzzle(await file());
}

const escape = (text: string) => text.replace(/[&<>"]/g, c => `&#${c.charCodeAt(0)};`);
const LANTERN = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 3h6M12 3v2M8 7h8l1 3v8l-1 3H8l-1-3v-8z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M12 11c1.6 1.6 1.6 3.4 0 5-1.6-1.6-1.6-3.4 0-5z" fill="currentColor"/></svg>';
const TENT = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 20 12 4l9.5 16zM12 4v16M8.5 20 12 13l3.5 7" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>';
const SAYS: Record<Exclude<Outcome, 'taken'>, string> = {
  lit: 'Se enciende una bombilla sobre la puerta de acero.',
  tent: 'La tienda se mueve. Algo sale de dentro.',
  black: 'Se apagan todas las bombillas de la puerta.',
};
type Player = 1 | 2;
const WHO: Record<Player, string> = { 1: 'Gerard', 2: 'Aitor' };

export function createParcelasUI(hud: HTMLElement, callbacks: {
  pause: (paused: boolean) => void;
  sound: (id: SoundId) => void;
  /** Each choice, for the game to answer (a tent's fight, the dark). */
  chose?: (outcome: Outcome, board: Board, solved: boolean) => void;
}) {
  const root = document.createElement('section');
  root.id = 'parcelas-panel'; root.hidden = true; root.tabIndex = -1;
  root.setAttribute('role', 'dialog'); root.setAttribute('aria-label', 'Las parcelas');
  hud.append(root);
  let open = false, openedAt = 0, puzzle: Puzzle | undefined, board = createBoard();
  let note = '', last: { index: number; outcome: Outcome } | undefined;
  const cursors: Record<Player, number> = { 1: 0, 2: 0 };
  let closed: ((board: Board) => void) | undefined;

  function pitch(i: number) {
    const p = puzzle!.pitches[i];
    const state = board.lit.includes(i) ? 'lit' : board.shown.includes(i) ? p.role : 'sign';
    const here = ([1, 2] as Player[]).filter(player => cursors[player] === i);
    return `<button type="button" class="parcela" data-index="${i}" data-state="${state}" ${last?.index === i ? `data-just="${last.outcome}"` : ''} aria-label="${escape(p.word)}">
      <span class="parcela-post" aria-hidden="true"></span>
      <span class="parcela-sign"><span class="parcela-number">${String(i + 1).padStart(2, '0')}</span><strong>${escape(p.word)}</strong>
        ${state === 'lit' ? `<i class="parcela-icon">${LANTERN}</i>` : state === 'tent' ? `<i class="parcela-icon">${TENT}</i>` : ''}</span>
      ${here.map(player => `<b class="parcela-marker" data-player="${player}">${WHO[player]}</b>`).join('')}
    </button>`;
  }
  function render() {
    if (!puzzle) return;
    const clue = currentClue(puzzle, board), done = solved(puzzle, board);
    root.innerHTML = `<div class="parcelas-dusk" aria-hidden="true"><svg viewBox="0 0 100 10" preserveAspectRatio="none"><path d="M0 1Q50 9 100 1" fill="none" stroke="#0b0d0a" stroke-width=".35" vector-effect="non-scaling-stroke"/></svg><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div>
      <header class="parcelas-board">
        <span class="parcelas-kicker">CÀMPING EUROSPORT · PISCINA</span>
        <div class="parcelas-chalk" aria-live="polite">${done
          ? '<strong>PASO ABIERTO</strong><small>La puerta de acero del merendero está abierta.</small>'
          : `<strong>${escape(clue!.word)}</strong><span class="parcelas-count">· ${clue!.count}</span>`}</div>
        <p class="parcelas-note" aria-live="polite">${escape(note)}</p>
      </header>
      <div class="parcelas-grid" style="--cols:${puzzle.cols}">${puzzle.pitches.map((_, i) => pitch(i)).join('')}</div>
      <footer class="parcelas-help">
        <span data-glyph-template="{arrows} · Moverse  ·  {confirm} · Elegir esta parcela  ·  {cancel} · Cerrar"></span>
        <button type="button" class="journal-close" data-parcelas-close data-back>Cerrar <kbd data-glyph="cancel"></kbd></button>
      </footer>`;
    last = undefined;
  }
  const signs = () => [...root.querySelectorAll<HTMLButtonElement>('.parcela')];
  function move(player: Player, direction: Direction) {
    const list = signs(), from = list[cursors[player]];
    const to = from && nearestButton(list, from, direction) as HTMLButtonElement | undefined;
    if (!to) return;
    cursors[player] = Number(to.dataset.index);
    callbacks.sound('ui-move'); render();
  }
  function pick(player: Player, index = cursors[player]) {
    if (!puzzle || solved(puzzle, board)) return;
    cursors[player] = index;
    const step = choose(puzzle, board, index);
    if (step.outcome === 'taken') { callbacks.sound('denied'); return; }
    board = step.board; last = { index, outcome: step.outcome };
    note = `${WHO[player]} elige ${puzzle.pitches[index].word}. ${SAYS[step.outcome]}${solved(puzzle, board) ? ' Es la última.' : ''}`;
    callbacks.sound(step.outcome === 'lit' ? 'clink' : step.outcome === 'tent' ? 'creak' : 'ko');
    if (solved(puzzle, board)) callbacks.sound('unlock');
    render();
    callbacks.chose?.(step.outcome, board, solved(puzzle, board));
  }
  /** Opens the board where it was left; resolves with it when closed. */
  async function show(from?: { puzzle?: Puzzle; board?: Board }) {
    if (open) return board;
    puzzle = from?.puzzle ?? puzzle ?? await gamePuzzle();
    board = from?.board ?? board;
    open = true; openedAt = performance.now(); note = '';
    cursors[1] = 0; cursors[2] = Math.min(puzzle.pitches.length - 1, puzzle.cols - 1);
    root.hidden = false; hud.dataset.parcelas = 'open'; callbacks.pause(true);
    render();
    return new Promise<Board>(resolve => { closed = resolve; });
  }
  function close() {
    if (!open) return;
    open = false; root.hidden = true; root.replaceChildren(); delete hud.dataset.parcelas; callbacks.pause(false);
    document.querySelector<HTMLElement>('#game')?.focus({ preventScroll: true });
    closed?.(board); closed = undefined;
  }
  function control(action: ControllerEvent, player: Player = 1) {
    if (!open) return;
    if (action === 'cancel' || action === 'menu') close();
    else if (action === 'confirm') pick(player);
    else if (action === 'up' || action === 'down' || action === 'left' || action === 'right') move(player, action);
    else if (isDpad(action)) return;
  }
  root.addEventListener('click', event => {
    const target = event.target as HTMLElement;
    if (target.closest('[data-parcelas-close]')) { close(); return; }
    const sign = target.closest<HTMLButtonElement>('.parcela');
    if (sign) pick(1, Number(sign.dataset.index));
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
    // The press that opened it must not choose straight away.
    if (action === 'confirm' && performance.now() - openedAt < 250) return;
    if (event.repeat && action === 'confirm') return;
    control(action, 1);
  }
  window.addEventListener('keydown', keydown, { capture: true });
  return {
    open: show, close, control,
    get isOpen() { return open; },
    /** Starts the board over (the picker; a new puzzle). */
    reset() { board = createBoard(); },
    destroy() { close(); window.removeEventListener('keydown', keydown, { capture: true }); root.remove(); },
  };
}
