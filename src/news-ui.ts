/**
 * The TV news (docs/chapter-2.md): the broadcast's graphics over the filmed 3D set
 * (src/news-set.ts, filmed by `game.startBroadcast`). A channel bug, EN DIRECTO, a caption for
 * each shot, the reporter's name over her shot, the red ÚLTIMA HORA band with the headline, and a
 * ticker where the first hidden clue sits among ordinary news. Any key, button or click turns away
 * from it. Looks live in style.css (#news).
 */
import type { ControlAction } from './controller';
import { NEWS } from './chapter-2';

/** How soon the broadcast can be left. */
const MIN_MS = 1500;

export function createNewsUI(hud: HTMLElement) {
  // A <dialog> so the panels' and the dialogue's keys stand aside while it is open.
  const root = document.createElement('dialog');
  root.id = 'news';
  root.setAttribute('aria-label', `${NEWS.kicker}: ${NEWS.headline}`);
  const ticker = [...NEWS.ticker, ...NEWS.ticker].map(item => `<span>${item}</span>`).join('');
  root.innerHTML = `<div class="news-scan" aria-hidden="true"></div>
    <p class="news-channel">${NEWS.channel}</p>
    <p class="news-live"><i></i>EN DIRECTO</p><p class="news-caption"></p>
    <div class="news-reporter"><strong>${NEWS.reporter.name}</strong><span>${NEWS.reporter.role}</span></div>
    <div class="news-band"><span class="news-kicker">${NEWS.kicker}</span><h1>${NEWS.headline}</h1><p>${NEWS.sub}</p></div>
    <div class="news-ticker" aria-hidden="true"><div>${ticker}</div></div>
    <p class="news-help"><kbd>E</kbd> Dejar de mirar</p>`;
  hud.append(root);
  // The ticker is read aloud once, as a list, for screen readers.
  const spoken = document.createElement('ul'); spoken.className = 'sr-only'; spoken.innerHTML = NEWS.ticker.map(t => `<li>${t}</li>`).join(''); root.append(spoken);
  let finish: (() => void) | undefined, shown = 0;
  function close() {
    if (!root.open || performance.now() - shown < MIN_MS) return;
    root.open = false;
    window.removeEventListener('keydown', keydown, { capture: true });
    const done = finish; finish = undefined; done?.();
  }
  function keydown(event: KeyboardEvent) {
    if (!root.open) return;
    event.stopPropagation(); event.preventDefault();
    if (!event.repeat) close();
  }
  root.addEventListener('click', close);
  return {
    get open() { return root.open; },
    /** Shows the graphics; resolves when the player looks away. */
    show(): Promise<void> {
      root.open = true; shown = performance.now();
      window.addEventListener('keydown', keydown, { capture: true });
      return new Promise(resolve => { finish = resolve; });
    },
    /** A cut to another shot of the filmed set: its caption, and the reporter's name over hers. */
    shot(id: string) {
      root.dataset.shot = id;
      root.querySelector('.news-caption')!.textContent = NEWS.shots[id as keyof typeof NEWS.shots] ?? '';
    },
    control(action: ControlAction) { if (action === 'confirm' || action === 'cancel') close(); },
    destroy() { window.removeEventListener('keydown', keydown, { capture: true }); root.remove(); },
  };
}
