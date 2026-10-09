import { clickControllerButton, focusControllerButton } from './controller-ui';
import type { ControlAction } from './controller';
import { ENVIRONMENTS, type EnvironmentId } from './environments';
import type { Cell } from './movement';
import { renderWorldMap } from './world-map';
import { ITEMS, ITEM_KIND_LABELS, itemsOfKind, type ItemKind } from './items';
import type { Story } from './story';

export type PanelId = 'character' | 'items' | 'map';
// Register another panel here, then supply its content in render().
const PANELS = [
  { id: 'character', key: 'KeyC', label: 'Personaje' },
  { id: 'items', key: 'KeyI', label: 'Objetos' },
  { id: 'map', key: 'KeyM', label: 'Mapa' },
] as const;
const TITLES: Record<PanelId, string> = { character: 'Tu aventura.', items: 'Lo que llevas.', map: 'Por aquí.' };
const COMPANION: Record<Story['companion'], string> = { none: 'Por tu cuenta', follow: 'Bernat', stalled: 'Bernat · Se ha quedado atrás' };
const escape = (text: string) => text.replace(/[&<>"]/g, c => `&#${c.charCodeAt(0)};`);

export function createExplorationUI(hud: HTMLElement, pause: (paused: boolean) => void, openMenu: () => void, story: Story) {
  let location: EnvironmentId = 'maresme';
  let cell: Cell = { ...ENVIRONMENTS[location].spawn };
  let steps = 0;
  let active: PanelId | undefined;
  let previousFocus: HTMLElement | null = null;
  const inertBefore = new Map<HTMLElement, boolean>();
  const dock = document.createElement('nav');
  dock.className = 'journal-dock'; dock.setAttribute('aria-label', 'Menú de aventura');
  // Character and map live in the menu; C / M stay as keyboard shortcuts.
  dock.innerHTML = `<button type="button" aria-haspopup="dialog"><kbd>Esc</kbd> Menú</button>`;
  const root = document.createElement('section');
  root.id = 'exploration-panel'; root.hidden = true; root.tabIndex = -1;
  root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.setAttribute('aria-labelledby', 'journal-title');
  root.innerHTML = `<header class="journal-heading"><div><span class="battle-kicker">DIARIO / GERARD 35</span><h1 id="journal-title"></h1></div><button class="journal-close" type="button" aria-label="Cerrar panel">Cerrar <kbd>Esc</kbd></button></header><nav class="journal-tabs" aria-label="Secciones del diario">${PANELS.map(p => `<button type="button" data-panel="${p.id}" aria-pressed="false">${p.label}</button>`).join('')}</nav><div class="journal-content"></div><p class="journal-help">Esc · Volver a la aventura</p>`;
  hud.append(dock, root);
  const content = root.querySelector<HTMLElement>('.journal-content')!;
  function render() {
    if (!active) return;
    root.querySelector('h1')!.textContent = TITLES[active];
    root.querySelectorAll('[data-panel]').forEach(el => el.setAttribute('aria-pressed', String(el.getAttribute('data-panel') === active)));
    content.dataset.page = active;
    if (active === 'character') {
      content.innerHTML = `<article class="character-sheet"><div class="character-portrait"><img src="${import.meta.env.BASE_URL}portraits/gerard-child.png" alt="Retrato de Gerard de niño con gafas"/></div><div><span class="battle-kicker">EL PROTAGONISTA</span><h2>Gerard</h2><p>Una infancia llena de aventuras.</p><dl><div><dt>Ubicación</dt><dd></dd></div><div><dt>Pasos de esta sesión</dt><dd>${steps}</dd></div><div><dt>Compañía</dt><dd>${COMPANION[story.companion]}</dd></div></dl></div></article><section class="party-equipment" aria-label="Equipo"><span class="battle-kicker">EQUIPO</span><div class="equipment-cards">${story.party.map(member => `<article class="equipment-card" data-member="${member.id}"><h3>${member.name}</h3>${member.equipment.length
        ? `<ul>${member.equipment.map(id => `<li><span>${ITEMS[id].equip === 'feet' ? 'Pies' : 'Espalda'}</span>${escape(ITEMS[id].name)}</li>`).join('')}</ul>`
        : '<ul><li class="empty"><span>—</span>Nada equipado</li></ul>'}<p>${escape(member.note)}</p></article>`).join('')}</div></section>`;
      content.querySelector('dd')!.textContent = ENVIRONMENTS[location].name;
    } else if (active === 'items') {
      const column = (kind: ItemKind) => {
        const items = itemsOfKind(story.items, kind);
        return `<section class="item-column" data-kind="${kind}"><span class="battle-kicker">${ITEM_KIND_LABELS[kind].toUpperCase()}</span><p class="journal-muted">${kind === 'common' ? 'Se gastan al usarlos.' : 'Para la historia. No se pierden.'}</p><ul>${items.length
          ? items.map(item => `<li><strong>${escape(item.name)}</strong><span>${escape(item.description)}</span></li>`).join('')
          : '<li class="empty">Nada por aquí todavía.</li>'}</ul></section>`;
      };
      content.innerHTML = `<div class="item-columns">${column('common')}${column('key')}</div>`;
    } else {
      content.innerHTML = `<div class="map-layout"><div class="map-frame">${renderWorldMap(ENVIRONMENTS[location], cell)}</div><aside class="map-details"><span class="battle-kicker">MAPA LOCAL</span><h2></h2><p>Tu posición · ${cell.x} / ${cell.z}</p><div class="map-legend"><span>● Gerard</span><span>▧ Camino transitable</span><span>■ Edificios / obstáculos</span></div><ol class="map-landmarks"></ol><p class="journal-muted">Vista esquemática del entorno actual.</p></aside></div>`;
      content.querySelector('h2')!.textContent = ENVIRONMENTS[location].name;
      const list = content.querySelector('ol')!;
      for (const point of ENVIRONMENTS[location].interactions) { const li = document.createElement('li'); li.textContent = point.label; list.append(li); }
      if (!list.children.length) list.textContent = 'Sin puntos de interacción en este entorno.';
    }
  }
  function close() {
    if (!active) return;
    active = undefined; root.hidden = true; delete hud.dataset.panel;
    inertBefore.forEach((value, el) => { el.inert = value; }); inertBefore.clear();
    pause(false);
    (previousFocus?.isConnected ? previousFocus : document.querySelector<HTMLElement>('#game'))?.focus({ preventScroll: true });
  }
  function toggle(id: PanelId) {
    if (hud.hasAttribute('data-battle') || hud.hasAttribute('data-dialogue')) return;
    if (active === id) { close(); return; }
    if (!active) {
      previousFocus = document.activeElement as HTMLElement;
      for (const el of [...hud.children, document.querySelector('#game')]) {
        if (el instanceof HTMLElement && el !== root) { inertBefore.set(el, el.inert); el.inert = true; }
      }
      pause(true);
    }
    active = id; hud.dataset.panel = id; root.hidden = false; render();
    root.querySelector<HTMLButtonElement>(`[data-panel="${id}"]`)!.focus({ preventScroll: true });
  }
  function click(event: MouseEvent) {
    const button = (event.target as HTMLElement).closest<HTMLElement>('[data-panel]');
    if (button) toggle(button.dataset.panel as PanelId);
  }
  // Return focus to the world, not the dock button, once the menu closes.
  dock.addEventListener('click', () => { document.querySelector<HTMLElement>('#game')?.focus({ preventScroll: true }); openMenu(); }); root.addEventListener('click', click);
  root.querySelector('.journal-close')!.addEventListener('click', close);
  function keydown(event: KeyboardEvent) {
    if (document.querySelector('dialog[open]')) return;
    if (event.altKey || event.ctrlKey || event.metaKey || (event.target instanceof HTMLElement && event.target.closest('input, textarea, select, [contenteditable="true"]'))) return;
    const panel = PANELS.find(p => p.key === event.code);
    if (panel || (active && event.key === 'Escape')) {
      if (hud.hasAttribute('data-battle') || hud.hasAttribute('data-dialogue')) return;
      event.preventDefault(); event.stopImmediatePropagation();
      if (!event.repeat) { if (panel) toggle(panel.id); else close(); }
    } else if (active && event.key === 'Tab') {
      event.preventDefault();
      const buttons = [...root.querySelectorAll<HTMLButtonElement>('button')];
      const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
      buttons[(index + (event.shiftKey ? -1 : 1) + buttons.length) % buttons.length].focus();
    }
  }
  window.addEventListener('keydown', keydown, { capture: true });
  return {
    close, toggle,
    show(id: PanelId) { if (active !== id) toggle(id); },
    get active() { return active; },
    control(action: ControlAction) {
      if (!active) return;
      if (action === 'cancel') close();
      else if (action === 'confirm') clickControllerButton(root);
      else if (action !== 'menu') focusControllerButton(root, action);
    },
    update(id: EnvironmentId, position: Cell, count = steps) { location = id; cell = { ...position }; steps = count; render(); },
    /** Redraws the open panel after the story changes. */
    refresh() { render(); },
    destroy() { close(); window.removeEventListener('keydown', keydown, { capture: true }); dock.remove(); root.remove(); },
  };
}
