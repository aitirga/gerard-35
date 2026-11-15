import type { Interaction } from './environments';

/** A small control attached to the thing in reach; only special actions need visible words. */
export function createInteractionPrompt(button: HTMLButtonElement) {
  const caption = button.querySelector('span')!;
  let current: Interaction | undefined;
  // Called every frame: only what changed is written, since any write (even of the same value) makes
  // the browser work out styles and layout again that frame.
  let left = NaN, top = NaN;
  return {
    show(interaction: Interaction | undefined) {
      // Wait for the next projection before showing a newly selected target.
      if (current?.id !== interaction?.id) button.hidden = true;
      current = interaction;
      button.dataset.interaction = interaction?.id ?? '';
      button.setAttribute('aria-label', interaction?.label ?? 'Interactuar');
      caption.textContent = interaction?.hint ?? '';
      caption.hidden = !interaction?.hint;
      if (!interaction) button.hidden = true;
    },
    position(at: { x: number; y: number } | undefined) {
      const hidden = !current || !at;
      if (button.hidden !== hidden) button.hidden = hidden;
      if (!at || !current) return;
      // Companions also speak above their heads; keep their key beside the face, below the bubble.
      const companion = current.id === 'talk-bernat';
      // To a tenth of a pixel: the camera's easing never quite stops, and nobody sees less.
      const x = Math.round((at.x + (companion ? 24 : 0)) * 10) / 10, y = Math.round((at.y + (companion ? 24 : 0)) * 10) / 10;
      if (x !== left) { left = x; button.style.left = `${x}px`; }
      if (y !== top) { top = y; button.style.top = `${y}px`; }
      // Keep the key on its world anchor; let the caption open towards the viewport's centre.
      const side = x > window.innerWidth - 220 ? 'left' : 'right';
      if (button.dataset.side !== side) button.dataset.side = side;
    },
  };
}
