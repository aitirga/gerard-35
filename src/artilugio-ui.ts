/**
 * The artilugio in Gerard's hands (docs/story-outline.md § The device): once the story has it,
 * moving in front of the real board or pressing it has Gerard take it out, and the player sees him
 * press the same buttons, the pairs lighting two at once. Its little screen shows the shape of what
 * has sounded (each note a bar as high as it is), never what to play. He puts it away after a while
 * untouched. Nothing here explains it: it is an object he has, not a panel.
 */
import { ARTILUGIO_NOTES, artilugioButtons } from './castle.ts';

/** How long it stays out untouched (ms). */
export const PUT_AWAY_MS = 6000;
/** The notes its screen remembers, one bar each. */
const SHOWN = 12;
const COLOURS = ['rojo', 'amarillo', 'verde', 'azul'] as const;

export interface ArtilugioView {
  /** Gerard takes it out (its PIR saw someone, or the story wants it in his hands). */
  takeOut(): void;
  /** A note played on it: out it comes, its buttons light and the screen draws it. */
  play(note: number): void;
  /** Awake in the Queen's last fight: its lights burst (the real board does the same). */
  setAwake(awake: boolean): void;
  /** Keep it out while this holds (the Queen has Aitor and it is the way to him). */
  hold(held: boolean): void;
  readonly out: boolean;
  destroy(): void;
}

export function createArtilugioView(hud: HTMLElement): ArtilugioView {
  const root = document.createElement('div');
  root.className = 'artilugio';
  root.setAttribute('aria-hidden', 'true');
  root.innerHTML = `
    <div class="artilugio-board">
      <div class="artilugio-screen"><div class="artilugio-bars"></div></div>
      <div class="artilugio-leds">${COLOURS.map((c, i) => `<i data-led="${i}" data-colour="${c}"></i>`).join('')}</div>
      <div class="artilugio-keys">${COLOURS.map((c, i) => `<b data-key="${i}" data-colour="${c}"></b>`).join('')}</div>
    </div>`;
  hud.append(root);
  const bars = root.querySelector<HTMLElement>('.artilugio-bars')!;
  const low = Math.min(...ARTILUGIO_NOTES), high = Math.max(...ARTILUGIO_NOTES);
  let away: ReturnType<typeof setTimeout> | undefined, held = false, out = false;
  const lights = new Map<number, ReturnType<typeof setTimeout>>();

  function takeOut() {
    out = true; root.dataset.out = '';
    clearTimeout(away);
    if (!held) away = setTimeout(putAway, PUT_AWAY_MS);
  }
  function putAway() { if (held) return; out = false; delete root.dataset.out; }
  function light(button: number) {
    for (const part of root.querySelectorAll<HTMLElement>(`[data-key="${button}"], [data-led="${button}"]`)) part.dataset.lit = '';
    clearTimeout(lights.get(button));
    lights.set(button, setTimeout(() => { for (const part of root.querySelectorAll<HTMLElement>(`[data-key="${button}"], [data-led="${button}"]`)) delete part.dataset.lit; }, 260));
  }

  return {
    takeOut,
    play(note) {
      takeOut();
      for (const button of artilugioButtons(note)) light(button);
      const bar = document.createElement('i');
      bar.style.setProperty('--h', String(.18 + .82 * (ARTILUGIO_NOTES[note] - low) / (high - low)));
      bars.append(bar);
      while (bars.children.length > SHOWN) bars.firstElementChild!.remove();
    },
    setAwake(awake) { if (awake) root.dataset.awake = ''; else delete root.dataset.awake; },
    hold(next) {
      if (next === held) return;
      held = next;
      if (held) takeOut(); else { clearTimeout(away); away = setTimeout(putAway, PUT_AWAY_MS); }
    },
    get out() { return out; },
    destroy() { clearTimeout(away); for (const t of lights.values()) clearTimeout(t); root.remove(); },
  };
}
