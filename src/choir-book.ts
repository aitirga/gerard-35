import { REPERTOIRE, type ChoirTrack } from './choir-repertoire';
import { clickControllerButton, focusControllerButton } from './controller-ui';
import './choir-book.css';

type Playback = { id: ChoirTrack; state: 'loading' | 'playing' | 'error' };

export function createChoirBook(parent: HTMLElement, callbacks: {
  choose: (id: ChoirTrack) => void;
  pauseWorld: (open: boolean) => void;
}) {
  const root = document.createElement('dialog');
  root.id = 'choir-book';
  root.setAttribute('aria-labelledby', 'choir-book-title');
  const tracks = Object.keys(REPERTOIRE) as ChoirTrack[];
  const section = (name: string) => `<section aria-label="${name}"><h3>${name}</h3>${tracks.filter(id => REPERTOIRE[id][1] === name).map(id =>
    `<button type="button" class="score-song" data-song="${id}" aria-pressed="false"><i aria-hidden="true"></i><span>${REPERTOIRE[id][0]}</span></button>`).join('')}</section>`;
  root.innerHTML = `<div class="score-spread">
    <div class="score-leaf score-left">
      <header><div class="score-imprint"><i aria-hidden="true"></i>A cop de diapasó</div>
        <h2 id="choir-book-title">Cuaderno de<br><em>partituras</em></h2></header>
      ${section('Piano y voz')}
      <div class="score-playing" role="status"></div>
    </div>
    <div class="score-leaf score-right">${section('Lugares')}${section('Combates')}
      <footer><span><kbd data-glyph="confirm"></kbd> <span class="score-verb">Tocar</span></span><button type="button" class="score-close">Cerrar <kbd data-glyph="cancel"></kbd></button></footer>
    </div>
  </div>`;
  parent.append(root);
  const status = root.querySelector<HTMLElement>('.score-playing')!;
  const buttons = [...root.querySelectorAll<HTMLButtonElement>('button[data-song]')];
  const closeButton = root.querySelector<HTMLButtonElement>('.score-close')!;
  let playback: Playback | undefined;
  let previousFocus: HTMLElement | null;
  const verb = root.querySelector<HTMLElement>('.score-verb')!;
  function showVerb() {
    if (document.activeElement === closeButton) verb.textContent = 'Cerrar';
    else verb.textContent = document.activeElement?.getAttribute('aria-pressed') === 'true' ? 'Detener' : 'Tocar';
  }
  root.addEventListener('focusin', showVerb);
  function update(value?: Playback) {
    playback = value;
    for (const button of buttons) {
      const active = !!value && value.id === button.dataset.song && value.state !== 'error';
      button.setAttribute('aria-pressed', String(active));
      button.setAttribute('aria-label', (active ? 'Detener ' : 'Tocar ') + button.textContent);
    }
    showVerb();
    const prefix = value?.state === 'error' ? 'No se pudo reproducir' : value?.state === 'playing' ? 'Sonando' : 'Preparando';
    status.textContent = value ? prefix + ' · ' + REPERTOIRE[value.id][0] : '';
  }
  function close() {
    if (!root.open) return;
    root.close();
    callbacks.pauseWorld(false);
    previousFocus?.focus({ preventScroll: true });
  }
  function control(action: string) {
    if (!root.open) return;
    if (action === 'cancel') close();
    else if (action === 'confirm') clickControllerButton(root);
    else if (action === 'up' || action === 'down' || action === 'left' || action === 'right') focusControllerButton(root, action);
  }
  function keydown(event: KeyboardEvent) {
    if (!root.open || document.querySelector('#controller-menu[open]')) return;
    const keys: Record<string, string> = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', Escape: 'cancel', Enter: 'confirm', Space: 'confirm' };
    const action = keys[event.code];
    if (!action) return;
    event.preventDefault(); event.stopImmediatePropagation();
    if (!event.repeat || action !== 'confirm') control(action);
  }
  for (const button of buttons) button.onclick = () => callbacks.choose(button.dataset.song as ChoirTrack);
  closeButton.onclick = close;
  root.oncancel = event => { event.preventDefault(); close(); };
  window.addEventListener('keydown', keydown, true);
  update();
  return {
    get isOpen() { return root.open; },
    open() {
      if (root.open) return;
      previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      callbacks.pauseWorld(true);
      root.showModal();
      (buttons.find(button => button.dataset.song === playback?.id) ?? buttons[0]).focus();
    },
    close, control, update,
    destroy() { close(); root.remove(); window.removeEventListener('keydown', keydown, true); },
  };
}
