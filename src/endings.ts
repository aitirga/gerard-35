/**
 * The last scene (docs/castle-bosses.md § The last scene): she is on the floor, the Foc Binari is in
 * Gerard's hand, and his dock has two commands and no clock: Acabar, or Bajar la mano. Only Gerard
 * chooses. Then what the choice does, told over black before the Monday after.
 *
 * Preliminary (2026-11-19): the choice and its words. The slowed fight, the held chord and the
 * camera closing on his hand are to come; the story already frames him (`look`) before this opens.
 */
import type { EndingChoice } from './castle-story.ts';

const STYLE = `
#ending { position: absolute; inset: 0; z-index: 90; display: grid; grid-template-rows: 1fr auto auto 12vh; justify-items: center; gap: 22px;
  background: radial-gradient(ellipse at 50% 42%, #0000 0 22%, #05060cdd 68%, #05060c 100%); color: #ece6da; opacity: 0; transition: opacity 1.4s ease; }
#ending[data-on="true"] { opacity: 1; }
#ending[data-black="true"] { background: #05060c; }
#ending p { grid-row: 2; max-width: min(760px, 78vw); margin: 0; text-align: center; font: 500 clamp(17px, 1.5vw, 23px)/1.5 Georgia, 'Times New Roman', serif; text-wrap: balance; }
#ending .ending-commands { grid-row: 3; display: flex; gap: clamp(18px, 4vw, 64px); }
#ending button { min-width: 220px; padding: 14px 26px; border: 1px solid #ece6da55; border-radius: 4px; background: #0b0d1ccc; color: inherit;
  font: 600 clamp(15px, 1.2vw, 19px)/1 Georgia, 'Times New Roman', serif; letter-spacing: .04em; cursor: pointer; transition: border-color .2s, background .2s; }
#ending button:focus-visible, #ending button:hover { outline: none; border-color: #f0c46a; background: #151830; }
#ending small { grid-row: 4; align-self: start; font: 500 13px/1 system-ui, sans-serif; letter-spacing: .08em; opacity: .6; }
@media (prefers-reduced-motion: reduce) { #ending { transition: none; } }
`;

export function createEndings(hud: HTMLElement) {
  const style = document.createElement('style'); style.textContent = STYLE; document.head.append(style);
  const root = document.createElement('section');
  root.id = 'ending'; root.hidden = true; root.setAttribute('aria-live', 'polite');
  root.innerHTML = `<p></p><div class="ending-commands"><button type="button" data-choice="acabar">Acabar</button><button type="button" data-choice="bajar">Bajar la mano</button></div><small data-glyph-template="{confirm} Elegir"></small>`;
  hud.append(root);
  const text = root.querySelector('p')!, commands = root.querySelector<HTMLElement>('.ending-commands')!, hint = root.querySelector('small')!;
  const buttons = [...root.querySelectorAll<HTMLButtonElement>('button')];
  let done: ((choice?: EndingChoice) => void) | undefined, shown = 0, frame = 0, held = true;
  /** A key or a button still held from the fight's last blow must not choose for him. */
  const ready = () => performance.now() - shown > 1600;
  const finish = (choice?: EndingChoice) => {
    if (!done || !ready()) return;
    const resolve = done; done = undefined;
    cancelAnimationFrame(frame);
    root.dataset.on = 'false';
    setTimeout(() => { root.hidden = true; resolve(choice); }, matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 900);
  };
  const focused = () => Math.max(0, buttons.indexOf(document.activeElement as HTMLButtonElement));
  root.addEventListener('click', event => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button');
    if (button) finish(button.dataset.choice as EndingChoice); else if (commands.hidden) finish();
  });
  window.addEventListener('keydown', event => {
    if (root.hidden || !done) return;
    event.stopImmediatePropagation();
    if (event.key === 'Tab') return;
    event.preventDefault();
    if (commands.hidden) { if (!event.repeat && ['Enter', ' ', 'e', 'E'].includes(event.key)) finish(); return; }
    if (['ArrowLeft', 'ArrowRight', 'a', 'd', 'A', 'D'].includes(event.key)) buttons[(focused() + 1) % buttons.length].focus({ preventScroll: true });
    else if (!event.repeat && ['Enter', ' ', 'e', 'E'].includes(event.key)) finish(buttons[focused()].dataset.choice as EndingChoice);
  }, { capture: true });
  /** A controller, read here: left and right move between the two commands, its confirm takes one. */
  function pad() {
    frame = requestAnimationFrame(pad);
    const one = [...navigator.getGamepads?.() ?? []].find(p => p?.connected);
    if (!one) return;
    const side = one.buttons[14]?.pressed || one.axes[0] < -.6 ? -1 : one.buttons[15]?.pressed || one.axes[0] > .6 ? 1 : 0, confirm = !!one.buttons[0]?.pressed;
    const any = side !== 0 || confirm;
    if (any && !held) {
      if (commands.hidden) { if (confirm) finish(); }
      else if (side) buttons[(focused() + 1) % buttons.length].focus({ preventScroll: true });
      else finish(buttons[focused()].dataset.choice as EndingChoice);
    }
    held = any;
  }
  function open(words: string, choosing: boolean) {
    text.textContent = words; commands.hidden = !choosing;
    hint.dataset.glyphTemplate = choosing ? '{confirm} Elegir' : '{confirm} Seguir';
    root.dataset.black = String(!choosing);
    root.hidden = false; shown = performance.now(); held = true;
    requestAnimationFrame(() => { root.dataset.on = 'true'; if (choosing) buttons[0].focus({ preventScroll: true }); });
    frame = requestAnimationFrame(pad);
    return new Promise<EndingChoice | undefined>(resolve => { done = resolve; });
  }
  return {
    /** The scene and Gerard's two commands; resolves with the one he takes. Nothing else closes it. */
    choose: (scene: string) => open(scene, true) as Promise<EndingChoice>,
    /** What the choice does, over black, until someone goes on. */
    tell: async (words: string) => { await open(words, false); },
    get open() { return !root.hidden; },
    destroy() { cancelAnimationFrame(frame); root.remove(); style.remove(); },
  };
}
