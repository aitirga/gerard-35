import { isDpad, type ControllerEvent } from './controller';
import { CAMP_LOCK } from './friends/universidad';
import type { SoundId } from './sfx';

/**
 * The pool gate's padlock on screen (docs/quests/universidad.md § El candado): three wheels of
 * numbers, 0 to 9, and nothing else. Either player turns the wheel that is chosen (up and down) or
 * chooses another (left and right), and tries the numbers. Nothing on it says which: the maze's foes
 * say their words as they fall, and the players have to work it out.
 */
type Player = 1 | 2;

export function createCandadoUI(hud: HTMLElement, callbacks: {
  pause: (paused: boolean) => void;
  sound: (id: SoundId) => void;
  /** The numbers tried; the story answers whether the padlock gives (`true` closes it). */
  tried: (numbers: number[]) => boolean;
}) {
  const root = document.createElement('section');
  root.id = 'candado-panel'; root.hidden = true; root.tabIndex = -1;
  root.setAttribute('role', 'dialog'); root.setAttribute('aria-label', 'El candado del portón');
  hud.append(root);
  let open = false, openedAt = 0, wheel = 0, note = '', shake = false;
  let closed: (() => void) | undefined;
  const turned = Array.from({ length: CAMP_LOCK.wheels }, () => 0);
  const digit = (n: number) => String((n + 10) % 10);

  function render() {
    root.innerHTML = `<div class="candado-body">
        <span class="candado-kicker">CÀMPING EUROSPORT · PISCINA</span>
        <div class="candado-wheels" ${shake ? 'data-shake' : ''}>${turned.map((n, w) => `
          <button type="button" class="candado-wheel" data-wheel="${w}" ${w === wheel ? 'aria-current="true"' : ''} aria-label="Rueda ${w + 1}: ${n}">
            <small>${digit(n - 1)}</small>
            <strong>${n}</strong>
            <small>${digit(n + 1)}</small>
          </button>`).join('')}</div>
        <p class="candado-note" aria-live="polite">${escape(note)}</p>
      </div>
      <footer class="parcelas-help">
        <span data-glyph-template="{arrows} · Girar y cambiar de rueda  ·  {confirm} · Probar  ·  {cancel} · Dejarlo"></span>
        <button type="button" class="journal-close" data-candado-close data-back>Dejarlo <kbd data-glyph="cancel"></kbd></button>
      </footer>`;
    shake = false;
  }
  function turn(by: number) {
    turned[wheel] = (turned[wheel] + by + 10) % 10;
    note = ''; callbacks.sound('ui-move'); render();
  }
  function choose(by: number) {
    wheel = (wheel + by + CAMP_LOCK.wheels) % CAMP_LOCK.wheels;
    callbacks.sound('ui-move'); render();
  }
  function attempt() {
    if (callbacks.tried([...turned])) { callbacks.sound('unlock'); close(); return; }
    note = 'El candado no cede.'; shake = true;
    callbacks.sound('denied'); render();
  }
  /** Opens the padlock where its wheels were left; resolves when it is closed (given or left). */
  function show() {
    if (open) return Promise.resolve();
    open = true; openedAt = performance.now(); note = '';
    root.hidden = false; hud.dataset.candado = 'open'; callbacks.pause(true);
    render();
    return new Promise<void>(resolve => { closed = resolve; });
  }
  function close() {
    if (!open) return;
    open = false; root.hidden = true; root.replaceChildren(); delete hud.dataset.candado; callbacks.pause(false);
    document.querySelector<HTMLElement>('#game')?.focus({ preventScroll: true });
    closed?.(); closed = undefined;
  }
  function control(action: ControllerEvent, _player: Player = 1) {
    if (!open) return;
    if (action === 'cancel' || action === 'menu') close();
    else if (action === 'confirm') attempt();
    else if (action === 'up') turn(-1);
    else if (action === 'down') turn(1);
    else if (action === 'left') choose(-1);
    else if (action === 'right') choose(1);
    else if (isDpad(action)) return;
  }
  root.addEventListener('click', event => {
    const target = event.target as HTMLElement;
    if (target.closest('[data-candado-close]')) { close(); return; }
    const button = target.closest<HTMLButtonElement>('.candado-wheel');
    if (!button) return;
    const w = Number(button.dataset.wheel);
    if (w !== wheel) { wheel = w; render(); } else turn(1);
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
    // The press that opened it must not try straight away.
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
