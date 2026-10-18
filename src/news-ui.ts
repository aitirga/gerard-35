/**
 * The TV news (docs/chapter-2.md): the screen fills the view as a broadcast. A red ÚLTIMA HORA
 * band, the headline, images in a loop (aerial shots of Trinitat Vella with the pink castle on the
 * school, cutting between a wide and a close shot) and a ticker where the first hidden clue sits
 * among ordinary news. Any key, button or click turns away from it. Looks live in style.css (#news).
 */
import type { ControlAction } from './controller';
import { around, renderCityMap } from './city-map';
import { NEWS } from './chapter-2';

/** How long a shot holds before the cut, and how soon the broadcast can be left. */
const SHOT_MS = 4200, MIN_MS = 1200;

export function createNewsUI(hud: HTMLElement) {
  // A <dialog> so the panels' and the dialogue's keys stand aside while it is open.
  const root = document.createElement('dialog');
  root.id = 'news';
  root.setAttribute('aria-label', `${NEWS.kicker}: ${NEWS.headline}`);
  const shots = [
    renderCityMap({ view: around('rec-comtal', 1100), style: 'news', castle: true, label: 'Imagen aérea de Trinitat Vella con el castillo sobre la escuela' }),
    renderCityMap({ view: around('rec-comtal', 420), style: 'news', castle: true, label: 'Primer plano del castillo sobre la escuela Rec Comtal' }),
  ];
  const ticker = [...NEWS.ticker, ...NEWS.ticker].map(item => `<span>${item}</span>`).join('');
  root.innerHTML = `<div class="news-tv"><div class="news-screen">
      <div class="news-footage">${shots.map((svg, i) => `<div class="news-shot" data-shot="${i}">${svg}</div>`).join('')}</div>
      <div class="news-scan" aria-hidden="true"></div>
      <p class="news-live"><i></i>${NEWS.live}</p><p class="news-caption"></p><p class="news-channel">${NEWS.channel}</p>
      <div class="news-band"><span class="news-kicker">${NEWS.kicker}</span><h1>${NEWS.headline}</h1><p>${NEWS.sub}</p></div>
      <div class="news-ticker" aria-hidden="true"><div>${ticker}</div></div>
    </div></div>
    <p class="news-help"><kbd>E</kbd> Dejar de mirar</p>`;
  hud.append(root);
  // The ticker is read aloud once, as a list, for screen readers.
  const spoken = document.createElement('ul'); spoken.className = 'sr-only'; spoken.innerHTML = NEWS.ticker.map(t => `<li>${t}</li>`).join(''); root.append(spoken);
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let finish: (() => void) | undefined, shown = 0, timer: ReturnType<typeof setInterval> | undefined, shot = 0;
  function cut(to: number) {
    shot = to;
    root.querySelectorAll<HTMLElement>('.news-shot').forEach(el => { el.dataset.on = String(Number(el.dataset.shot) === shot); });
    root.querySelector('.news-caption')!.textContent = NEWS.shots[shot];
  }
  function close() {
    if (!root.open || performance.now() - shown < MIN_MS) return;
    root.open = false; clearInterval(timer);
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
    /** Shows the broadcast; resolves when the player looks away. */
    show(): Promise<void> {
      root.open = true; shown = performance.now(); cut(0);
      clearInterval(timer);
      if (!reducedMotion.matches) timer = setInterval(() => cut((shot + 1) % shots.length), SHOT_MS);
      window.addEventListener('keydown', keydown, { capture: true });
      return new Promise(resolve => { finish = resolve; });
    },
    control(action: ControlAction) { if (action === 'confirm' || action === 'cancel') close(); },
    destroy() { clearInterval(timer); window.removeEventListener('keydown', keydown, { capture: true }); root.remove(); },
  };
}
