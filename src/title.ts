/**
 * The welcome screen (docs/audio.md § Where music plays now): the game's name and one button,
 * «Nueva partida» the first time and «Continuar» once a game is under way, and nothing else
 * (Aitor, 2026-11-19: «només això»). Aitor's piano plays under it (`intro-piano`, src/main.ts).
 * Behind it, Gerard's room at night, so blurred it cannot be told (Aitor, 2026-11-21): the game's
 * own picture, dark and out of focus (`:root[data-title]`), with the interface hidden. A new game
 * brings it into focus and the morning starts there; «Continuar» goes to black and on where they were.
 *
 * A browser keeps sound off until a key, click or pad button. If it still is when the button is
 * pressed, that press only brings the piano in (`wake`), and the next one starts the game; once sound
 * is on (or the browser has none), the first press starts it.
 */
const STYLE = `
#title { position: absolute; inset: 0; z-index: 95; display: grid; grid-template-rows: 1fr auto auto 1fr; justify-items: center; gap: 7vh;
  background: radial-gradient(ellipse at 50% 46%, #0a14305c 0%, #060b1e8c 45%, #03050de0 100%); color: #ece6da; opacity: 0; transition: opacity 1.2s ease; }
#title[data-on="true"] { opacity: 1; }
#title[data-leaving] { transition-duration: .7s; }
#title hgroup { grid-row: 2; display: grid; justify-items: center; gap: 18px; margin: 0; text-align: center; }
#title h1 { margin: 0; font: italic 500 clamp(48px, 6.4vw, 100px)/1 Georgia, 'Times New Roman', serif; letter-spacing: -.01em; text-shadow: 0 2px 40px #000a; }
#title hgroup p { margin: 0; display: flex; align-items: center; gap: 18px; font: 600 clamp(13px, 1.05vw, 16px)/1 'DM Sans', sans-serif; letter-spacing: .42em; text-transform: uppercase; color: #d9c89a; }
#title hgroup p::before, #title hgroup p::after { content: ''; width: clamp(36px, 4vw, 64px); height: 1px; background: currentColor; opacity: .5; }
#title button { grid-row: 3; min-width: 260px; padding: 16px 30px; border: 1px solid #ece6da55; border-radius: 4px; background: #0b0d1ccc; color: inherit;
  font: 600 clamp(16px, 1.3vw, 20px)/1 Georgia, 'Times New Roman', serif; letter-spacing: .05em; cursor: pointer; transition: border-color .2s, background .2s; }
#title button:focus-visible, #title button:hover { outline: none; border-color: #f0c46a; background: #151830; }
#title button[data-waiting] { visibility: hidden; }
/* The room behind, at night and out of focus; it comes into focus as the game starts («waking»). */
:root[data-title] #game { filter: blur(22px) brightness(.5) sepia(.85) hue-rotate(188deg) saturate(1.7); transform: scale(1.06); }
:root[data-title="waking"] #game { filter: none; transform: none; transition: filter 2.6s cubic-bezier(.4,0,.2,1), transform 2.6s cubic-bezier(.4,0,.2,1); }
:root[data-title] .vignette, :root[data-title] #hud > :not(#title):not(#blackout) { visibility: hidden; }
@media (prefers-reduced-motion: reduce) { #title { transition: none; } :root[data-title="waking"] #game { transition: none; } }
`;
/** How long the room takes to come into focus on a new game. */
const WAKING_MS = 2600;

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
  root.innerHTML = '<hgroup><h1>Mareas del Tiempo</h1><p>La Reina</p></hgroup><button type="button"></button>';
  hud.append(root);
  const button = root.querySelector('button')!;
  let done: ((continued: boolean) => void) | undefined, frame = 0, held = true, woken = false;

  function press() {
    if (!done || button.dataset.waiting !== undefined) return;
    // The first gesture with sound still off only turns it on: the piano comes in, and the next press starts.
    if (!woken && !sound.ready()) { woken = true; sound.wake(); return; }
    const resolve = done; done = undefined;
    cancelAnimationFrame(frame);
    root.dataset.leaving = ''; root.dataset.on = 'false';
    resolve(button.dataset.continuing !== undefined);
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

  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  function close() {
    root.hidden = true; delete root.dataset.leaving;
    delete document.documentElement.dataset.title;
  }

  return {
    /**
     * Shows it at once, over the room at night; its button comes once the save has said whether a
     * game is under way («Continuar») or not. Resolves on the press, with whether it continued; the
     * caller then `wake`s (a new game) or covers the picture and `close`s.
     */
    open(continuing: Promise<boolean>) {
      document.documentElement.dataset.title = 'night';
      button.dataset.waiting = '';
      root.hidden = false; held = true; woken = false;
      requestAnimationFrame(() => { root.dataset.on = 'true'; });
      void continuing.then(yes => {
        button.textContent = yes ? 'Continuar' : 'Nueva partida';
        if (yes) button.dataset.continuing = ''; else delete button.dataset.continuing;
        delete button.dataset.waiting;
        button.focus({ preventScroll: true });
      });
      frame = requestAnimationFrame(pad);
      return new Promise<boolean>(resolve => { done = resolve; });
    },
    /** A new game: the room comes into focus, out of the night; resolves once it has, and the screen is gone. */
    wake() {
      document.documentElement.dataset.title = 'waking';
      return new Promise<void>(resolve => setTimeout(() => { close(); resolve(); }, reduced() ? 0 : WAKING_MS));
    },
    close,
    get isOpen() { return !root.hidden; },
    destroy() { cancelAnimationFrame(frame); close(); root.remove(); style.remove(); },
  };
}
