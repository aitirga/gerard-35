/**
 * The credits (docs/story-outline.md § The Queen's identity and the false lead): after the Monday of
 * either ending, over black, who made the game and who is in it, rolling up slowly, while snapshots
 * of the adventure and the friends' missions are laid down on both sides, a collage (`SNAPSHOTS`).
 * Then, alone: Nuria Mendoza, whose face the Queen wore, was on holiday the whole time, posing for
 * photos, and never knew; her photos drop in round it one by one, an album of the trips (`ALBUM`).
 * Last, the ending's own closing text and «Fi» (`FINAL_CARD`, `THE_END`); after it the game goes back
 * to the welcome screen (src/main.ts). A key or a button hurries the roll and turns each card.
 *
 * The words are a draft for Aitor to correct (`CREDITS`, `FINAL_CARD`: both in the guion).
 */
import type { EndingChoice } from './castle-story.ts';


/** The roll, card by card: a heading (small caps) over its names. */
export const CREDITS: readonly { heading: string; names: readonly string[] }[] = [
  { heading: 'Mareas del Tiempo: La Reina', names: ['Un juego de Aitor para Gerard, por sus treinta y cinco'] },
  { heading: 'Dirección, diseño y música', names: ['Aitor Iraola'] },
  { heading: 'Programación', names: ['Claude'] },
  { heading: 'Gerard', names: ['Gerard, que lo ha jugado'] },
  { heading: 'Con', names: ['Aitor, siempre al lado'] },
  { heading: 'Los amigos', names: ['Nuria y Uri, con Nil, Haru y Yuki', 'Anna y Álvaro', 'Miquel y Sarah', 'Guillem y Soraya', 'Nico y Joan', 'Marta', 'Emilie', 'Luca, Fran y Yadelin', 'Bernat'] },
  { heading: 'En el instituto escuela Rec Comtal', names: ['Aurelià', 'Mar, Montse y Pilar'] },
  { heading: 'La voz de La Voz', names: ['Marta'] },
  { heading: 'La Reina Bubbaloo', names: ['Nadie', 'con la cara de Nuria Mendoza'] },
  { heading: 'Mapas', names: ['© OpenStreetMap contributors (ODbL)'] },
  { heading: 'Gracias', names: ['A Luca, Marta y Nuria, por su ayuda durante el desarrollo', 'A todos los que aparecen aquí sin saberlo'] },
];
/**
 * The collage round the roll, in the order the story meets them: the game's own pictures, cut from
 * the screenshot galleries (`public/credits/`, 640×480). One is laid down each time the roll has gone
 * that much further, alternating sides.
 */
export const SNAPSHOTS: readonly { file: string; caption: string }[] = [
  { file: 'casa', caption: 'Casa de Gerard' },
  { file: 'passatge', caption: 'Passatge Maresme' },
  { file: 'ojos', caption: 'Ojos rosados' },
  { file: 'meridiana', caption: 'Meridiana' },
  { file: 'escola', caption: 'Escola Rec Comtal' },
  { file: 'cardedeu', caption: 'Cardedeu' },
  { file: 'torre', caption: 'La torre de Uri' },
  { file: 'vertigo', caption: 'No mires abajo' },
  { file: 'alegia', caption: 'Alegia' },
  { file: 'cuerdas', caption: 'Las cuerdas' },
  { file: 'poblesec', caption: 'Poble-sec' },
  { file: 'emilie', caption: 'Casa de Emilie' },
  { file: 'templo', caption: 'Sagrada Família' },
  { file: 'fran', caption: 'Les toca' },
  { file: 'barceloneta', caption: 'La Barceloneta' },
  { file: 'carmel', caption: 'Búnkers del Carmel' },
  { file: 'nucli', caption: 'El Nucli' },
  { file: 'aurelia', caption: 'Nadie sale hasta el timbre' },
  { file: 'direccion', caption: 'Consta en acta' },
  { file: 'reina', caption: 'Otra vez, con música' },
];
/**
 * The very last card, after Nuria's: each ending's own closing lines (drafts for Aitor), coming in
 * one after another over black, and the word under them once they are all there.
 */
export const FINAL_CARD: Record<EndingChoice, readonly string[]> = {
  acabar: [
    'Tot va tornar al seu lloc: l\'horari, la feina, els amics,...',
    'La ciutat és més neta i més callada. Ningú canta pel carrer, i ningú ho troba a faltar.',
    'En Gerard i l\'Aitor són feliços i queden amb els seus amics de tant en tant, l\'Aitor ja no toca gaire el piano, no ho troba a faltar —la vida d\'adult és el que té—, pensa.',
    'Tots són feliços, però no hi ha màgia al món.',
  ],
  bajar: [
    'No ho hem arreglat tot, el temps s\'ha recuperat però la ciutat té una mica de rosa',
    'Els nostres amics ens esperen a la coral, tenim noves incorporacions',
    'Els dilluns continuen sent dilluns. Però alguns vespres, miren el pot de llum, que encara brilla',
    'I en Gerard xiula les sis notes cada matí, de camí a la feina.',
  ],
};
/** Seconds between one closing line and the next. */
const FINAL_STEP = 2.6;
export const THE_END = 'Fi';
/** The last card, alone (decided): the false lead, closed. */
export const LAST_CARD = 'Nuria Mendoza estuvo todo este tiempo de vacaciones, posando para las fotos. No se enteró de nada.';
/**
 * Her photos round the last card (Aitor, 2026-11-20): the trips she was on while the game happened.
 * They are personal, so they live only on this machine (`public/private/`, ignored by git and by the
 * deploy: the repository is public); one that is not there is left out, and the card stays words.
 * `at` is where each lands (vw, vh: its top left corner) and how it is turned.
 */
export const ALBUM: readonly { file: string; caption: string; at: readonly [number, number, number] }[] = [
  { file: 'sigiriya', caption: 'Sigiriya, Sri Lanka', at: [7, 4, -6] },
  { file: 'monaco', caption: 'Montecarlo', at: [31, 2, 4] },
  { file: 'guatemala', caption: 'Volcán de Fuego, Guatemala', at: [56, 4, -3] },
  { file: 'ella', caption: 'De Ella a Kandy', at: [10, 56, 5] },
  { file: 'zaragoza', caption: 'Zaragoza', at: [43, 58, -4] },
  { file: 'agulhas', caption: 'Cabo de las Agujas', at: [72, 55, 7] },
];
const albumUrl = (file: string) => `${import.meta.env?.BASE_URL ?? '/'}private/nuria-mendoza/${file}.jpg`;
const snapshotUrl = (file: string) => `${import.meta.env?.BASE_URL ?? '/'}credits/${file}.jpg`;
/** Where snapshot `i` lands: alternating sides, two overlapping columns of five on each, a little turned (vw, vh, degrees). */
function snapshotAt(i: number): [number, number, number] {
  const side = i % 2, slot = Math.floor(i / 2), row = [0, 2, 4, 1, 3][slot % 5], column = Math.floor(slot / 5);
  const jitter = (n: number) => Math.sin(i * 12.9898 + n * 78.233) * 43758.5453 % 1;
  const x = (side ? 69 : 1) + column * 12 + jitter(1) * 2, y = row * 18.5 - 3 + jitter(2) * 3;
  return [x, y, jitter(3) * 7];
}

const STYLE = `
#credits { position: absolute; inset: 0; z-index: 95; overflow: hidden; background: #05060c; color: #ece6da; opacity: 0; transition: opacity 1.6s ease; pointer-events: auto; }
#credits[data-on="true"] { opacity: 1; }
#credits .credits-roll { position: absolute; left: 33vw; right: 33vw; top: 100%; display: grid; gap: 64px; justify-items: center; padding-bottom: 40vh; text-align: center; will-change: transform; }
#credits h3 { margin: 0 0 12px; font: 600 12px/1 system-ui, sans-serif; letter-spacing: .22em; text-transform: uppercase; color: #f0c46a; }
#credits li { list-style: none; margin: 6px 0; text-wrap: balance; font: 500 clamp(19px, 1.7vw, 26px)/1.35 Georgia, 'Times New Roman', serif; }
#credits ul { margin: 0; padding: 0; }
#credits .credits-last { position: absolute; inset: 0; display: grid; place-items: center; padding: 0 12vw; margin: 0; text-align: center; opacity: 0; transition: opacity 2s ease;
  font: 500 clamp(18px, 1.6vw, 24px)/1.5 Georgia, 'Times New Roman', serif; text-wrap: balance; }
#credits .credits-last[data-on="true"] { opacity: 1; }
#credits small { position: absolute; z-index: 1; left: 0; right: 0; bottom: 3vh; text-align: center; font: 500 13px/1 system-ui, sans-serif; letter-spacing: .08em; opacity: 0; transition: opacity 1s; }
#credits small[data-on="true"] { opacity: .6; }
#credits .credits-album figure { position: absolute; margin: 0; width: min(13.5vw, 26vh); padding: .55vw .55vw 2.6vw; background: #f4efe4; box-shadow: 0 1.2vw 2.4vw #000a;
  opacity: 0; transform: translateY(-3vh) rotate(var(--turn)) scale(1.08); transition: opacity .9s ease, transform 1.1s cubic-bezier(.2, .8, .25, 1); transition-delay: var(--delay); }
#credits .credits-album[data-on="true"] figure { opacity: 1; transform: rotate(var(--turn)); }
#credits .credits-album img { display: block; width: 100%; aspect-ratio: 4 / 5; object-fit: cover; }
#credits .credits-album figcaption { position: absolute; left: 0; right: 0; bottom: .7vw; text-align: center; color: #3a332c; font: italic 500 clamp(10px, .9vw, 14px)/1 Georgia, 'Times New Roman', serif; }
#credits .credits-collage { position: absolute; inset: 0; transition: opacity 1.6s ease; }
#credits .credits-collage[data-done="true"] { opacity: 0; }
#credits .credits-collage figure { position: absolute; margin: 0; width: 14vw; padding: .45vw .45vw 2vw; background: #ece6da; box-shadow: 0 .9vw 2vw #000c;
  opacity: 0; transform: translateY(2.5vh) rotate(var(--turn)) scale(1.04); transition: opacity 1.2s ease, transform 1.4s cubic-bezier(.2, .8, .25, 1); }
#credits .credits-collage figure[data-on="true"] { opacity: 1; transform: rotate(var(--turn)); }
#credits .credits-collage img { display: block; width: 100%; aspect-ratio: 4 / 3; object-fit: cover; }
#credits .credits-collage figcaption { position: absolute; left: 0; right: 0; bottom: .55vw; text-align: center; color: #3a332c; font: italic 500 clamp(10px, .8vw, 13px)/1 Georgia, 'Times New Roman', serif; }
#credits .credits-final { position: absolute; inset: 0; display: grid; place-content: center; justify-items: center; gap: 7vh; padding: 0 22vw; text-align: center; }
#credits .credits-final div { display: grid; gap: 2.2vh; }
#credits .credits-final p { margin: 0; font: italic 500 clamp(18px, 1.6vw, 24px)/1.6 Georgia, 'Times New Roman', serif; text-wrap: pretty; }
#credits .credits-final :is(p, strong) { opacity: 0; transition: opacity 2s ease; transition-delay: var(--d, 0s); }
#credits .credits-final strong { font: 500 clamp(30px, 3vw, 46px)/1 Georgia, 'Times New Roman', serif; letter-spacing: .08em; color: #f0c46a; }
#credits .credits-final[data-on="true"] :is(p, strong) { opacity: 1; }
@media (prefers-reduced-motion: reduce) { #credits, #credits .credits-last, #credits .credits-album figure, #credits .credits-collage, #credits .credits-collage figure, #credits .credits-final :is(p, strong) { transition: none; } }
`;
/** Seconds the whole roll takes at its own pace; held, a key or a button runs it four times as fast. */
const ROLL_SECONDS = 70, HURRY = 4;

export function createCredits(hud: HTMLElement) {
  const style = document.createElement('style'); style.textContent = STYLE; document.head.append(style);
  const root = document.createElement('section');
  root.id = 'credits'; root.hidden = true; root.setAttribute('aria-live', 'polite');
  const escape = (text: string) => text.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
  root.innerHTML = `<div class="credits-collage" aria-hidden="true">${SNAPSHOTS.map((photo, i) => { const [x, y, turn] = snapshotAt(i); return `<figure style="left:${x.toFixed(1)}vw;top:${y.toFixed(1)}vh;--turn:${turn.toFixed(1)}deg"><img alt="" src="${snapshotUrl(photo.file)}"><figcaption>${escape(photo.caption)}</figcaption></figure>`; }).join('')}</div>`
    + `<div class="credits-roll">${CREDITS.map(card => `<section><h3>${escape(card.heading)}</h3><ul>${card.names.map(n => `<li>${escape(n)}</li>`).join('')}</ul></section>`).join('')}</div>`
    + `<div class="credits-album" aria-hidden="true">${ALBUM.map((photo, i) => `<figure style="left:${photo.at[0]}vw;top:${photo.at[1]}vh;--turn:${photo.at[2]}deg;--delay:${(1.2 + i * .9).toFixed(1)}s"><img alt="" src="${albumUrl(photo.file)}"><figcaption>${escape(photo.caption)}</figcaption></figure>`).join('')}</div>`
    + `<p class="credits-last">${escape(LAST_CARD)}</p><div class="credits-final"><div></div><strong>${escape(THE_END)}</strong></div><small data-glyph-template="{confirm} Continuar"></small>`;
  hud.append(root);
  const roll = root.querySelector<HTMLElement>('.credits-roll')!, last = root.querySelector<HTMLElement>('.credits-last')!, hint = root.querySelector('small')!;
  const album = root.querySelector<HTMLElement>('.credits-album')!;
  const collage = root.querySelector<HTMLElement>('.credits-collage')!, snapshots = [...collage.querySelectorAll<HTMLElement>('figure')];
  const final = root.querySelector<HTMLElement>('.credits-final')!;
  // A photo that is not on this machine is left out.
  album.querySelectorAll('img').forEach(img => img.addEventListener('error', () => img.closest('figure')?.remove(), { once: true }));
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
    /** Rolls them, then Nuria's card, then the ending's own (`choice`); resolves once the last has been closed. */
    play(choice?: EndingChoice): Promise<void> {
      root.hidden = false; hurry = false; closing = undefined;
      last.dataset.on = 'false'; hint.dataset.on = 'false'; album.dataset.on = 'false'; final.dataset.on = 'false';
      collage.dataset.done = 'false'; snapshots.forEach(s => { s.dataset.on = 'false'; });
      const lines = choice ? FINAL_CARD[choice] : [];
      final.querySelector('div')!.replaceChildren(...lines.map((text, i) => { const p = document.createElement('p'); p.textContent = text; p.style.setProperty('--d', `${i * FINAL_STEP}s`); return p; }));
      final.querySelector('strong')!.style.setProperty('--d', `${lines.length * FINAL_STEP + 1}s`);
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
          // The collage: one more snapshot each time the roll has gone that much further.
          snapshots.forEach((s, i) => { if (k >= (i + .5) / (snapshots.length + 1)) s.dataset.on = 'true'; });
          if (k < 1) { requestAnimationFrame(step); return; }
          // Then the last card, alone, the collage gone; a moment later, the way on.
          collage.dataset.done = 'true'; last.dataset.on = 'true'; album.dataset.on = 'true';
          const end = () => { closing = undefined; root.dataset.on = 'false'; setTimeout(() => { root.hidden = true; resolve(); }, still ? 0 : 1600); };
          // The ending's own card and «Fi», over black, once Nuria's has been turned.
          const ending = () => {
            closing = undefined; hint.dataset.on = 'false'; last.dataset.on = 'false'; album.dataset.on = 'false';
            setTimeout(() => { final.dataset.on = 'true'; setTimeout(() => { hint.dataset.on = 'true'; closing = end; }, still ? 0 : (lines.length * FINAL_STEP + 3) * 1000); }, still ? 0 : 2200);
          };
          setTimeout(() => { hint.dataset.on = 'true'; closing = choice ? ending : end; }, 2500 + ALBUM.length * 900);
        };
        requestAnimationFrame(now => { before = now; step(now); });
      });
    },
    /** A controller's confirm, from the game's own pad reading. */
    confirm() { if (!root.hidden) press(true); },
    destroy() { window.removeEventListener('keydown', keydown, { capture: true }); window.removeEventListener('keyup', keyup, { capture: true }); root.remove(); style.remove(); },
  };
}
