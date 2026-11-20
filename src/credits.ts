/**
 * The credits (docs/story-outline.md § The Queen's identity and the false lead): after the Monday of
 * either ending, over black, who made the game and who is in it, rolling up slowly; then, alone,
 * the last thing the game says: Nuria Mendoza was on holiday the whole time. A key or a button
 * hurries the roll; at the last card it closes them, and the game goes on at home.
 *
 * The words are a draft for Aitor to correct (`CREDITS`).
 */

/** The roll, card by card: a heading (small caps) over its names. */
export const CREDITS: readonly { heading: string; names: readonly string[] }[] = [
  { heading: 'Gerard 35', names: ['Un juego de Aitor para Gerard, por sus treinta y cinco'] },
  { heading: 'Idea, historia, código y música', names: ['Aitor'] },
  { heading: 'Gerard', names: ['Gerard, que lo ha jugado'] },
  { heading: 'Con', names: ['Aitor, siempre al lado'] },
  { heading: 'Los amigos', names: ['Nuria y Uri, con Nil, Haru y Yuki', 'Anna y Álvaro', 'Miquel y Sarah', 'Guillem y Soraya', 'Nico y Joan', 'Marta', 'Emilie', 'Luca, Fran y Yadelin', 'Bernat'] },
  { heading: 'En el instituto escuela Rec Comtal', names: ['Aurelià', 'Mar, Montse y Pilar'] },
  { heading: 'La voz de La Voz', names: ['Marta'] },
  { heading: 'La Reina Bubbaloo', names: ['Nadie'] },
  { heading: 'Mapas', names: ['© OpenStreetMap contributors (ODbL)'] },
  { heading: 'Gracias', names: ['A todos los que aparecen aquí sin saberlo'] },
];
/** The last card, alone (decided): the false lead, closed. */
export const LAST_CARD = 'Nuria Mendoza estuvo de vacaciones todo este tiempo. No se enteró de nada.';

const STYLE = `
#credits { position: absolute; inset: 0; z-index: 95; overflow: hidden; background: #05060c; color: #ece6da; opacity: 0; transition: opacity 1.6s ease; pointer-events: auto; }
#credits[data-on="true"] { opacity: 1; }
#credits .credits-roll { position: absolute; left: 0; right: 0; top: 100%; display: grid; gap: 64px; justify-items: center; padding-bottom: 40vh; text-align: center; will-change: transform; }
#credits h3 { margin: 0 0 12px; font: 600 12px/1 system-ui, sans-serif; letter-spacing: .22em; text-transform: uppercase; color: #f0c46a; }
#credits li { list-style: none; margin: 6px 0; font: 500 clamp(19px, 1.7vw, 26px)/1.35 Georgia, 'Times New Roman', serif; }
#credits ul { margin: 0; padding: 0; }
#credits .credits-last { position: absolute; inset: 0; display: grid; place-items: center; padding: 0 12vw; margin: 0; text-align: center; opacity: 0; transition: opacity 2s ease;
  font: 500 clamp(18px, 1.6vw, 24px)/1.5 Georgia, 'Times New Roman', serif; text-wrap: balance; }
#credits .credits-last[data-on="true"] { opacity: 1; }
#credits small { position: absolute; left: 0; right: 0; bottom: 6vh; text-align: center; font: 500 13px/1 system-ui, sans-serif; letter-spacing: .08em; opacity: 0; transition: opacity 1s; }
#credits small[data-on="true"] { opacity: .6; }
@media (prefers-reduced-motion: reduce) { #credits, #credits .credits-last { transition: none; } }
`;
/** Seconds the whole roll takes at its own pace; held, a key or a button runs it four times as fast. */
const ROLL_SECONDS = 70, HURRY = 4;

export function createCredits(hud: HTMLElement) {
  const style = document.createElement('style'); style.textContent = STYLE; document.head.append(style);
  const root = document.createElement('section');
  root.id = 'credits'; root.hidden = true; root.setAttribute('aria-live', 'polite');
  const escape = (text: string) => text.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
  root.innerHTML = `<div class="credits-roll">${CREDITS.map(card => `<section><h3>${escape(card.heading)}</h3><ul>${card.names.map(n => `<li>${escape(n)}</li>`).join('')}</ul></section>`).join('')}</div>`
    + `<p class="credits-last">${escape(LAST_CARD)}</p><small data-glyph-template="{confirm} Continuar"></small>`;
  hud.append(root);
  const roll = root.querySelector<HTMLElement>('.credits-roll')!, last = root.querySelector<HTMLElement>('.credits-last')!, hint = root.querySelector('small')!;
  let hurry = false, closing: (() => void) | undefined;
  const press = (down: boolean) => { hurry = down; if (down && closing) closing(); };
  const keydown = (event: KeyboardEvent) => { if (root.hidden) return; event.stopImmediatePropagation(); event.preventDefault(); if (!event.repeat && ['Enter', ' ', 'e', 'E', 'Escape'].includes(event.key)) press(true); };
  const keyup = (event: KeyboardEvent) => { if (!root.hidden) { event.stopImmediatePropagation(); hurry = false; } };
  window.addEventListener('keydown', keydown, { capture: true });
  window.addEventListener('keyup', keyup, { capture: true });
  root.addEventListener('pointerdown', () => press(true));
  root.addEventListener('pointerup', () => { hurry = false; });

  return {
    get open() { return !root.hidden; },
    /** Rolls them; resolves once the last card has been closed. */
    play(): Promise<void> {
      root.hidden = false; hurry = false; closing = undefined;
      last.dataset.on = 'false'; hint.dataset.on = 'false';
      roll.style.transform = '';
      requestAnimationFrame(() => { root.dataset.on = 'true'; });
      const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
      return new Promise(resolve => {
        let at = 0, before = performance.now();
        const step = (now: number) => {
          const pad = [...navigator.getGamepads?.() ?? []].find(p => p?.connected);
          const held = hurry || !!pad?.buttons.some((b, i) => i <= 3 && b.pressed);
          at += (now - before) / 1000 * (held ? HURRY : 1); before = now;
          // The roll runs from below the screen until its last card has left at the top.
          const travel = roll.offsetHeight + root.offsetHeight;
          const k = still ? 1 : Math.min(1, at / ROLL_SECONDS);
          roll.style.transform = `translateY(${-k * travel}px)`;
          if (k < 1) { requestAnimationFrame(step); return; }
          // Then the last card, alone; a moment later, the way on.
          last.dataset.on = 'true';
          setTimeout(() => {
            hint.dataset.on = 'true';
            closing = () => {
              closing = undefined; root.dataset.on = 'false';
              setTimeout(() => { root.hidden = true; resolve(); }, still ? 0 : 1600);
            };
          }, 2500);
        };
        requestAnimationFrame(now => { before = now; step(now); });
      });
    },
    /** A controller's confirm, from the game's own pad reading. */
    confirm() { if (!root.hidden) press(true); },
    destroy() { window.removeEventListener('keydown', keydown, { capture: true }); window.removeEventListener('keyup', keyup, { capture: true }); root.remove(); style.remove(); },
  };
}
