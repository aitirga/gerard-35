// Story HUD: chapter cards, item notes, one-line key hints and Bernat's speech bubble.
// There is no objective panel: what to do next comes from exploring and from people (AGENTS.md).
// Looks live in style.css (#story-card, .story-notes, .key-hint, #companion-bubble).
import { ITEMS, ITEM_KIND_LABELS, type ItemId } from './items';
import { STORY_CARDS, STORY_HINTS } from './story';

const ITEM_NOTE_MS = 4200;
const CARD_MS = 3400;

export function createStoryUI(hud: HTMLElement) {
  const notes = document.createElement('div');
  notes.className = 'story-notes'; notes.setAttribute('aria-live', 'polite');
  const hint = document.createElement('p');
  hint.className = 'key-hint'; hint.hidden = true; hint.setAttribute('aria-live', 'polite');
  hint.innerHTML = `<kbd></kbd><span></span>`;
  const bubble = document.createElement('p');
  bubble.id = 'companion-bubble'; bubble.hidden = true; bubble.setAttribute('aria-live', 'polite');
  const card = document.createElement('section');
  card.id = 'story-card'; card.hidden = true; card.setAttribute('role', 'status');
  card.innerHTML = `<span class="battle-kicker"></span><h1></h1><p></p>`;
  hud.append(notes, hint, bubble, card);
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let hintGeneration = 0;

  return {
    item(id: ItemId) {
      const item = ITEMS[id];
      const el = document.createElement('article');
      el.className = 'story-note';
      el.innerHTML = `<span class="battle-kicker"></span><strong></strong><p></p>`;
      el.querySelector('span')!.textContent = `HAS CONSEGUIDO · ${ITEM_KIND_LABELS[item.kind].toUpperCase()}`;
      el.querySelector('strong')!.textContent = item.name;
      el.querySelector('p')!.textContent = item.description;
      notes.append(el);
      setTimeout(() => { el.dataset.leaving = 'true'; setTimeout(() => el.remove(), reducedMotion.matches ? 0 : 300); }, ITEM_NOTE_MS);
    },
    /** A key and a verb that stays until the player has used it (or a newer hint replaces it). */
    hint(id: keyof typeof STORY_HINTS, learned?: () => boolean) {
      const generation = ++hintGeneration;
      hint.querySelector('kbd')!.textContent = STORY_HINTS[id].keys;
      hint.querySelector('span')!.textContent = STORY_HINTS[id].verb;
      hint.hidden = false; delete hint.dataset.learned;
      const hide = () => { if (generation === hintGeneration) hint.hidden = true; };
      const check = () => {
        if (generation !== hintGeneration || hint.hidden) return;
        if (learned?.()) { hint.dataset.learned = 'true'; setTimeout(hide, 700); } else requestAnimationFrame(check);
      };
      if (learned) requestAnimationFrame(check);
    },
    /** Places what Bernat says above his head; `at` is his screen position, or nothing to hide it. */
    bubble(text: string | undefined, at: { x: number; y: number } | undefined) {
      bubble.hidden = !text || !at;
      if (!text || !at) return;
      if (bubble.textContent !== text) bubble.textContent = text;
      bubble.style.transform = `translate(${at.x}px, ${at.y}px) translate(-50%, -100%)`;
    },
    /** A full-screen title, e.g. the chapter opening; resolves once it has faded. */
    card(id: keyof typeof STORY_CARDS) {
      const c = STORY_CARDS[id];
      card.querySelector('span')!.textContent = c.kicker;
      card.querySelector('h1')!.textContent = c.title;
      card.querySelector('p')!.textContent = c.text;
      card.hidden = false; card.dataset.state = 'in';
      return new Promise<void>(resolve => {
        setTimeout(() => {
          card.dataset.state = 'out';
          setTimeout(() => { card.hidden = true; resolve(); }, reducedMotion.matches ? 0 : 600);
        }, reducedMotion.matches ? CARD_MS / 2 : CARD_MS);
      });
    },
    destroy() { hintGeneration++; notes.remove(); hint.remove(); bubble.remove(); card.remove(); },
  };
}
