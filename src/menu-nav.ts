import type { Direction } from './movement';

/** The nearest of `list` that way from `from` on screen, so a menu's grids and rows read naturally. */
export function nearestButton(list: readonly HTMLElement[], from: HTMLElement, direction: Direction) {
  const a = from.getBoundingClientRect();
  let best: HTMLElement | undefined, bestScore = Infinity, inCone = false;
  for (const b of list) {
    if (b === from) continue;
    const r = b.getBoundingClientRect();
    const dx = r.left + r.width / 2 - (a.left + a.width / 2), dy = r.top + r.height / 2 - (a.top + a.height / 2);
    const along = direction === 'left' ? -dx : direction === 'right' ? dx : direction === 'up' ? -dy : dy;
    const across = direction === 'left' || direction === 'right' ? Math.abs(dy) : Math.abs(dx);
    if (along < 4) continue;
    // Prefer buttons that really lie that way; anything else only if nothing does.
    const cone = across <= along * 1.5, score = along + across * 2.5;
    if ((cone && !inCone) || (cone === inCone && score < bestScore)) { best = b; bestScore = score; inCone = cone; }
  }
  return best;
}
