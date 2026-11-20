/**
 * The welcome screen (docs/audio.md § Where music plays now): the game's name and one button,
 * «Començar el joc» the first time and «Continuar» once a game is under way, and nothing else
 * (Aitor, 2026-11-19: «només això»). Aitor's piano plays under it (`intro-piano`, src/main.ts).
 *
 * A browser keeps sound off until a key, click or pad button. If it still is when the button is
 * pressed, that press only brings the piano in (`wake`), and the next one starts the game; once sound
 * is on (or the browser has none), the first press starts it.
 */
const STYLE = `
#title { position: absolute; inset: 0; z-index: 95; display: grid; grid-template-rows: 1fr auto auto 1fr; justify-items: center; gap: 6vh;
  background: radial-gradient(ellipse at 50% 45%, #05060cd9 0 30%, #05060cf2 70%, #05060c 100%); color: #ece6da; opacity: 0; transition: opacity 1.2s ease; }
#title[data-on="true"] { opacity: 1; }
#title h1 { grid-row: 2; margin: 0; font: 500 clamp(44px, 6vw, 92px)/1 Georgia, 'Times New Roman', serif; letter-spacing: .06em; }
#title button { grid-row: 3; min-width: 260px; padding: 16px 30px; border: 1px solid #ece6da55; border-radius: 4px; background: #0b0d1ccc; color: inherit;
  font: 600 clamp(16px, 1.3vw, 20px)/1 Georgia, 'Times New Roman', serif; letter-spacing: .05em; cursor: pointer; transition: border-color .2s, background .2s; }
#title button:focus-visible, #title button:hover { outline: none; border-color: #f0c46a; background: #151830; }
#title button[data-waiting] { visibility: hidden; }
@media (prefers-reduced-motion: reduce) { #title { transition: none; } }
`;

export interface TitleSound {
  /** Whether sound plays now (or never will: no Web Audio). */
  ready(): boolean;
  /** Asks for sound to start, on the press that is the first gesture. */
  wake(): void;
}

export function createTitle(hud: HTMLElement, sound: TitleSound) {
  const style = document.createElement('style'); style.textContent = STYLE; document.head.append(style);
  const root = document.createElement('section');
  root.id = 'title'; root.hidden = true;
  root.innerHTML = '<h1>Gerard 35</h1><button type="button"></button>';
  hud.append(root);
  const button = root.querySelector('button')!;
  let done: (() => void) | undefined, frame = 0, held = true, woken = false;

  function press() {
    if (!done || button.dataset.waiting !== undefined) return;
    // The first gesture with sound still off only turns it on: the piano comes in, and the next press starts.
    if (!woken && !sound.ready()) { woken = true; sound.wake(); return; }
    const resolve = done; done = undefined;
    cancelAnimationFrame(frame);
    root.dataset.on = 'false';
    setTimeout(() => { root.hidden = true; resolve(); }, matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 700);
  }
  button.addEventListener('click', press);
  // Nothing behind it hears a key while it is up; Enter, Space or E press its button.
  window.addEventListener('keydown', event => {
    if (root.hidden || !done) return;
    event.stopImmediatePropagation();
    if (event.key === 'Tab') return;
    event.preventDefault();
    if (!event.repeat && ['Enter', ' ', 'e', 'E'].includes(event.key)) press();
  }, { capture: true });
  /** A controller, read here: its confirm presses the button. */
  function pad() {
    frame = requestAnimationFrame(pad);
    const one = [...navigator.getGamepads?.() ?? []].find(p => p?.connected);
    const confirm = !!one?.buttons[0]?.pressed;
    if (confirm && !held) press();
    held = confirm;
  }

  return {
    /**
     * Shows it at once; its button comes once the save has said whether a game is under way
     * («Continuar») or not. Resolves when the player starts.
     */
    open(continuing: Promise<boolean>) {
      button.dataset.waiting = '';
      root.hidden = false; held = true; woken = false;
      requestAnimationFrame(() => { root.dataset.on = 'true'; });
      void continuing.then(yes => {
        button.textContent = yes ? 'Continuar' : 'Començar el joc';
        delete button.dataset.waiting;
        button.focus({ preventScroll: true });
      });
      frame = requestAnimationFrame(pad);
      return new Promise<void>(resolve => { done = resolve; });
    },
    get isOpen() { return !root.hidden; },
    destroy() { cancelAnimationFrame(frame); root.remove(); style.remove(); },
  };
}
