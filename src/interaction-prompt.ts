import type { Interaction } from './environments';

/** A small control attached to the thing in reach; only special actions need visible words. */
export function createInteractionPrompt(button: HTMLButtonElement) {
  const caption = button.querySelector('span')!;
  let current: Interaction | undefined;
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
      button.hidden = !current || !at;
      if (!at || !current) return;
      // Companions also speak above their heads; keep their key beside the face, below the bubble.
      const companion = current.id === 'talk-bernat' || current.id === 'talk-aitor';
      const x = at.x + (companion ? 24 : 0), y = at.y + (companion ? 24 : 0);
      button.style.left = `${x}px`;
      button.style.top = `${y}px`;
      // Keep the key on its world anchor; let the caption open towards the viewport's centre.
      button.dataset.side = x > window.innerWidth - 220 ? 'left' : 'right';
    },
  };
}
