// Story HUD: the objective line, chapter cards, and the item and tutorial notes on the right.
// Looks live in style.css (#objective, #story-card, .story-notes).
import { ITEMS, ITEM_KIND_LABELS, type ItemId } from './items';
import { STORY_CARDS, STORY_TUTORIALS } from './story';

const ITEM_NOTE_MS = 4200;
const TUTORIAL_NOTE_MS = 14000;
const CARD_MS = 3400;

export function createStoryUI(hud: HTMLElement) {
  const objective = document.createElement('section');
  objective.id = 'objective'; objective.setAttribute('aria-live', 'polite'); objective.hidden = true;
  objective.innerHTML = `<span class="eyebrow">OBJETIVO</span><strong></strong>`;
  const notes = document.createElement('div');
  notes.className = 'story-notes'; notes.setAttribute('aria-live', 'polite');
  const card = document.createElement('section');
  card.id = 'story-card'; card.hidden = true; card.setAttribute('role', 'status');
  card.innerHTML = `<span class="battle-kicker"></span><h1></h1><p></p>`;
  hud.append(objective, notes, card);
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

  function note(kind: 'item' | 'tutorial', kicker: string, title: string, body: string, ms: number) {
    // One tutorial at a time: a new lesson replaces the previous one.
    if (kind === 'tutorial') notes.querySelectorAll('[data-kind="tutorial"]').forEach(el => el.remove());
    const el = document.createElement('article');
    el.className = 'story-note'; el.dataset.kind = kind;
    el.innerHTML = `<span class="battle-kicker"></span><strong></strong><p></p>`;
    el.querySelector('span')!.textContent = kicker;
    el.querySelector('strong')!.textContent = title;
    el.querySelector('p')!.textContent = body;
    notes.append(el);
    const remove = () => { el.dataset.leaving = 'true'; setTimeout(() => el.remove(), reducedMotion.matches ? 0 : 300); };
    const timer = setTimeout(remove, ms);
    return { el, done() { clearTimeout(timer); remove(); } };
  }

  return {
    setObjective(text: string, glitch: boolean) {
      objective.hidden = false;
      const label = objective.querySelector('strong')!;
      if (label.textContent !== text) label.textContent = text;
      objective.toggleAttribute('data-glitch', glitch);
    },
    item(id: ItemId) {
      const item = ITEMS[id];
      note('item', `HAS CONSEGUIDO · ${ITEM_KIND_LABELS[item.kind].toUpperCase()}`, item.name, item.description, ITEM_NOTE_MS);
    },
    /** Shows a lesson; with `learned`, it closes early once the player has done the thing. */
    tutorial(id: keyof typeof STORY_TUTORIALS, learned?: () => boolean) {
      const t = STORY_TUTORIALS[id];
      const shown = note('tutorial', 'TUTORIAL', t.title, t.body, TUTORIAL_NOTE_MS);
      if (!learned) return;
      const check = () => {
        if (!shown.el.isConnected || shown.el.dataset.leaving) return;
        if (learned()) { shown.el.dataset.learned = 'true'; setTimeout(shown.done, 900); } else requestAnimationFrame(check);
      };
      requestAnimationFrame(check);
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
    destroy() { objective.remove(); notes.remove(); card.remove(); },
  };
}
