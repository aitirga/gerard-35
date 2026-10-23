import { clickControllerButton, focusControllerButton } from './controller-ui';
import type { ControlAction } from './controller';
import { ENVIRONMENTS, type EnvironmentId } from './environments';
import type { Cell } from './movement';
import { renderWorldMap } from './world-map';
import { renderExplorationWorldMap } from './exploration-world-map';
import { ITEMS, ITEM_KIND_LABELS, itemsOfKind, type ItemKind } from './items';
import type { MemberId, PartyMember, Story } from './story';
import { CLASS_STATS, type ClassId } from './battle';
import { CLASSES } from './classes';
import { ANIMAS, animaBonus } from './animas';
import { SPEAKERS } from './dialogue';
import { PROFILES, STAT_LABELS, withBonus, type Stats } from './stats';

export type PanelId = 'character' | 'items' | 'map' | 'help';
// Register another panel here, then supply its content in render().
const PANELS = [
  { id: 'character', key: 'KeyC', shortcut: 'C', label: 'Personaje', icon: '<circle cx="12" cy="8" r="3"/><path d="M5 21v-3a7 7 0 0 1 14 0v3"/>' },
  { id: 'items', key: 'KeyI', shortcut: 'I', label: 'Objetos', icon: '<path d="M8 7V5a4 4 0 0 1 8 0v2M5 7h14l1 14H4L5 7Z"/><path d="M9 12h6"/>' },
  { id: 'map', key: 'KeyM', shortcut: 'M', label: 'Mapa', icon: '<path d="m3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2V5ZM9 3v16M15 5v16"/>' },
  { id: 'help', key: 'KeyH', shortcut: 'H', label: 'Cómo jugar', icon: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 4.2 1.8c-1 .7-1.7 1.1-1.7 2.7M12 17h.01"/>' },
] as const;
const TITLES: Record<PanelId, string> = { character: 'Tu aventura.', items: 'Lo que llevas.', map: 'Por aquí.', help: 'A tu ritmo.' };
const COMPANION: Record<Story['companion'], string> = { none: 'Por tu cuenta', follow: 'Bernat', stalled: 'Bernat · Se ha quedado atrás' };
const STAT_ORDER: (keyof Stats)[] = ['pv', 'sec', 'fuerza', 'magia', 'defensa', 'espiritu', 'velocidad'];
const escape = (text: string) => text.replace(/[&<>"]/g, c => `&#${c.charCodeAt(0)};`);

/** `wear` puts one of the party's classes on a member (or takes it off with `null`). */
export function createExplorationUI(hud: HTMLElement, pause: (paused: boolean) => void, openMenu: () => void, story: Story, wear: (member: MemberId, classId: ClassId | null) => void) {
  let location: EnvironmentId = 'maresme';
  let cell: Cell = { ...ENVIRONMENTS[location].spawn };
  let active: PanelId | undefined;
  let mapLevel: 'local' | 'world' = 'local';
  let previousFocus: HTMLElement | null = null;
  const inertBefore = new Map<HTMLElement, boolean>();
  const dock = document.createElement('nav');
  dock.className = 'journal-dock'; dock.setAttribute('aria-label', 'Menús del juego');
  dock.innerHTML = `<button class="user-menu-trigger" type="button" data-user-menu aria-haspopup="dialog" aria-label="Abrir menú de usuario"><span class="user-menu-avatar" aria-hidden="true"></span><span><strong>Gerard</strong><small>Menú de usuario</small></span><kbd>Tab</kbd></button><button class="pause-menu-trigger" type="button" data-pause-menu aria-haspopup="dialog" aria-label="Abrir menú de pausa"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14M16 5v14"/></svg><kbd>Esc</kbd></button>`;
  const root = document.createElement('section');
  root.id = 'exploration-panel'; root.hidden = true; root.tabIndex = -1;
  root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.setAttribute('aria-labelledby', 'journal-title');
  root.innerHTML = `<header class="journal-heading"><div><span class="battle-kicker">MENÚ DE USUARIO / GERARD 35</span><div class="journal-identity"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 2 8 10-8 10L4 12 12 2Z"/><path d="m8 12 4-5 4 5-4 5-4-5Z"/></svg><h1 id="journal-title"></h1></div><p class="journal-context"></p></div><button class="journal-close" type="button" aria-label="Cerrar menú de usuario">Volver al juego <kbd>Esc</kbd></button></header><nav class="journal-tabs" aria-label="Secciones del menú de usuario">${PANELS.map(p => `<button type="button" data-panel="${p.id}" aria-pressed="false"><svg class="journal-tab-icon" viewBox="0 0 24 24" aria-hidden="true">${p.icon}</svg><span class="journal-tab-label">${p.label}</span><kbd>${p.shortcut}</kbd></button>`).join('')}</nav><div class="journal-content"></div><p class="journal-help">C · Personaje &nbsp; I · Objetos &nbsp; M · Mapa local &nbsp; Mayús + M · Mapa del mundo &nbsp; H · Cómo jugar &nbsp; / &nbsp; Esc · Volver al juego</p>`;
  hud.append(dock, root);
  const content = root.querySelector<HTMLElement>('.journal-content')!;
  function updateAvatar() {
    const avatar = dock.querySelector<HTMLElement>('.user-menu-avatar')!;
    const age = story.adult ? 'adult' : 'child';
    if (avatar.dataset.age === age) return;
    avatar.dataset.age = age;
    avatar.innerHTML = story.adult ? SPEAKERS.gerard35.art : `<img src="${import.meta.env.BASE_URL}portraits/gerard-child.png" alt=""/>`;
  }
  updateAvatar();
  /** Chapter 2: the friends' ánimas the party carries, each a light of its own colour. */
  function animaSection() {
    const owned = story.animas.map(id => ANIMAS[id]);
    const bonus = animaBonus(story.animas);
    const total = (Object.entries(bonus) as [keyof Stats, number][]).map(([key, value]) => `${STAT_LABELS[key]} +${value}`).join(' · ');
    return `<section class="party-animas" aria-label="Ánimas"><span class="battle-kicker">ÁNIMAS</span>${owned.length
      ? `<ul>${owned.map(a => `<li style="--anima:${a.colour}"><i aria-hidden="true"></i><strong>${escape(a.name)}</strong><span>${escape(a.friend)}</span></li>`).join('')}</ul><p class="journal-muted">Todo el equipo: ${total}</p>`
      : '<p class="journal-muted">Ninguna todavía.</p>'}</section>`;
  }
  /** A member's stats with their class on, and the class picker: classes belong to the whole party. */
  function memberStats(member: PartyMember) {
    const stats = withBonus(PROFILES[member.profile], member.classId ? CLASS_STATS[member.classId] : undefined);
    const rows = STAT_ORDER.map(key => {
      const bonus = member.classId ? CLASS_STATS[member.classId][key] ?? 0 : 0;
      return `<div><dt>${STAT_LABELS[key]}</dt><dd>${stats[key]}${bonus ? `<small data-sign="${bonus > 0 ? 'up' : 'down'}">${bonus > 0 ? '+' : '−'}${Math.abs(bonus)}</small>` : ''}</dd></div>`;
    }).join('');
    const classes = story.classes;
    const picker = classes.length ? `<div class="class-picker" role="group" aria-label="Clase de ${escape(member.name)}">${[null, ...classes].map(id => `<button type="button" data-wear="${member.id}" data-class-id="${id ?? ''}" aria-pressed="${(member.classId ?? null) === id}">${id ? CLASSES[id].name : 'Sin clase'}</button>`).join('')}</div>` : '';
    return `<dl class="member-stats">${rows}</dl>${picker}`;
  }
  function render() {
    updateAvatar();
    if (!active) return;
    root.querySelector('h1')!.textContent = TITLES[active];
    root.querySelector('.journal-context')!.textContent = ENVIRONMENTS[location].name;
    root.querySelectorAll('[data-panel]').forEach(el => el.setAttribute('aria-pressed', String(el.getAttribute('data-panel') === active)));
    content.dataset.page = active;
    root.dataset.layout = active === 'map' ? 'map' : 'journal';
    if (active === 'map') root.dataset.mapLevel = mapLevel; else delete root.dataset.mapLevel;
    root.setAttribute('aria-labelledby', active === 'map' ? 'map-title' : 'journal-title');
    for (const el of root.querySelectorAll<HTMLElement>(':scope > .journal-heading, :scope > .journal-tabs, :scope > .journal-help')) el.hidden = active === 'map';
    if (active === 'character') {
      content.innerHTML = `<article class="character-sheet"><div class="character-portrait">${story.adult ? `<span class="character-art" role="img" aria-label="Retrato provisional de Gerard a los treinta y cinco">${SPEAKERS.gerard35.art}</span>` : `<img src="${import.meta.env.BASE_URL}portraits/gerard-child.png" alt="Retrato de Gerard de niño con gafas"/>`}</div><div><span class="battle-kicker">EL PROTAGONISTA</span><h2>Gerard</h2><p>${story.adult ? 'Treinta y cinco años. Y el día no ha hecho más que empezar.' : 'Una infancia llena de aventuras.'}</p><dl><div><dt>Ubicación</dt><dd></dd></div><div><dt>Compañía</dt><dd>${story.partner === 'aitor' ? 'Aitor' : COMPANION[story.companion]}</dd></div></dl></div></article><section class="party-equipment" aria-label="Equipo"><span class="battle-kicker">EQUIPO</span><div class="equipment-cards">${story.party.map(member => `<article class="equipment-card" data-member="${member.id}"><h3>${member.name}</h3>${member.equipment.length
        ? `<ul>${member.equipment.map(id => `<li><span>${ITEMS[id].equip === 'feet' ? 'Pies' : 'Espalda'}</span>${escape(ITEMS[id].name)}</li>`).join('')}</ul>`
        : '<ul><li class="empty"><span>—</span>Nada equipado</li></ul>'}<p>${escape(member.note)}</p>${memberStats(member)}</article>`).join('')}</div></section>${story.adult ? animaSection() : ''}`;
      content.querySelector('dd')!.textContent = ENVIRONMENTS[location].name;
    } else if (active === 'items') {
      const column = (kind: ItemKind) => {
        const items = itemsOfKind(story.items, kind);
        return `<section class="item-column" data-kind="${kind}"><span class="battle-kicker">${ITEM_KIND_LABELS[kind].toUpperCase()}</span><p class="journal-muted">${kind === 'common' ? 'Se gastan al usarlos.' : 'Para la historia. No se pierden.'}</p><ul>${items.length
          ? items.map(item => `<li><strong>${escape(item.name)}</strong><span>${escape(item.description)}</span></li>`).join('')
          : '<li class="empty">Nada por aquí todavía.</li>'}</ul></section>`;
      };
      content.innerHTML = `<div class="item-columns">${column('common')}${column('key')}</div>`;
    } else if (active === 'map') {
      const world = mapLevel === 'world';
      const drawing = world ? renderExplorationWorldMap(location, { castle: story.has('tv-news'), threat: story.castleThreat, spread: Math.min(1, story.spread) }) : renderWorldMap(ENVIRONMENTS[location], cell);
      content.innerHTML = `<div class="map-view"><header class="map-heading"><div><span class="battle-kicker">${world ? 'BARCELONA' : 'MAPA LOCAL'}</span><h2 id="map-title">${world ? 'Mapa del mundo' : escape(ENVIRONMENTS[location].name)}</h2></div><button class="journal-close" type="button" data-map-back>${world ? 'Mapa local' : 'Volver al juego'} <kbd>Esc</kbd></button></header><div class="map-canvas">${drawing}</div><footer class="map-footer">${world ? '<span>Barcelona · Vista general</span>' : '<span class="map-player-key"><i aria-hidden="true"></i>Gerard</span>'}<button type="button" data-map-level="${world ? 'local' : 'world'}">${world ? 'Mapa local <kbd>M</kbd>' : 'Mapa del mundo <kbd>Mayús</kbd> + <kbd>M</kbd>'}</button></footer></div>`;
    } else {
      content.innerHTML = `<div class="user-help-intro"><span class="battle-kicker">LOS CONTROLES</span><h2>La aventura se juega probando.</h2><p>Explora, habla con la gente y descubre el mundo a tu ritmo.</p></div>
        <dl class="menu-controls"><div><dt>Moverte</dt><dd>W A S D o flechas · Stick izquierdo o cruceta</dd></div><div><dt>Correr</dt><dd>Con las zapatillas: mantén Shift · Mantén B (Volver) en el mando</dd></div><div><dt>Interactuar / avanzar</dt><dd>E · Enter · Espacio · Confirmar en el mando</dd></div><div><dt>Menú de usuario</dt><dd>Tab · C para Personaje · I para Objetos · H para Cómo jugar. En el mando, botón superior: X en Nintendo, △ en PlayStation, Y en Xbox.</dd></div><div><dt>Mapas</dt><dd>M · Mapa local. Mayús + M · Mapa del mundo (Barcelona). Esc vuelve del mundo al mapa local y después al juego.</dd></div><div><dt>Vista general</dt><dd>R · − o Select en el mando</dd></div><div><dt>Combate</dt><dd>1–4 o flechas · Enter para confirmar · Esc para volver</dd></div><div><dt>Pausa y configuración</dt><dd>Esc · + o Start en el mando. En Configuración puedes ajustar el mando y las luces de casa.</dd></div></dl>
        <p class="controller-note">En mandos Nintendo reconocidos: A confirma y B vuelve. Mantén B mientras te mueves para correr. Puedes cambiar la asignación en Pausa → Configuración → Mando.</p>`;
    }
  }
  function close() {
    if (!active) return;
    active = undefined; root.hidden = true; delete hud.dataset.panel;
    inertBefore.forEach((value, el) => { el.inert = value; }); inertBefore.clear();
    pause(false);
    (previousFocus?.isConnected ? previousFocus : document.querySelector<HTMLElement>('#game'))?.focus({ preventScroll: true });
  }
  function blocked() {
    return hud.hasAttribute('data-battle') || hud.hasAttribute('data-dialogue') || hud.hasAttribute('data-watching') || hud.hasAttribute('data-lamp') || !!document.querySelector('dialog[open]');
  }
  function openPanel(id: PanelId) {
    if (blocked()) return;
    if (!active) {
      previousFocus = document.activeElement as HTMLElement;
      for (const el of [...hud.children, document.querySelector('#game')]) {
        if (el instanceof HTMLElement && el !== root) { inertBefore.set(el, el.inert); el.inert = true; }
      }
      pause(true);
    }
    active = id; hud.dataset.panel = id; root.hidden = false; render();
    root.querySelector<HTMLButtonElement>(id === 'map' ? '[data-map-back]' : `[data-panel="${id}"]`)!.focus({ preventScroll: true });
  }
  function toggle(id: PanelId) {
    if (blocked()) return;
    if (active === id) { close(); return; }
    if (id === 'map') mapLevel = 'local';
    openPanel(id);
  }
  function showMap(level: typeof mapLevel) {
    if (blocked()) return;
    mapLevel = level; openPanel('map');
  }
  function back() {
    if (active === 'map' && mapLevel === 'world') showMap('local'); else close();
  }
  function click(event: MouseEvent) {
    const target = event.target as HTMLElement;
    const level = target.closest<HTMLElement>('[data-map-level]');
    if (level) { showMap(level.dataset.mapLevel as typeof mapLevel); return; }
    if (target.closest('[data-map-back]')) { back(); return; }
    const choice = (event.target as HTMLElement).closest<HTMLElement>('[data-wear]');
    if (choice) {
      const member = choice.dataset.wear as MemberId, classId = (choice.dataset.classId || null) as ClassId | null;
      wear(member, classId);
      root.querySelector<HTMLElement>(`[data-wear="${member}"][data-class-id="${classId ?? ''}"]`)?.focus({ preventScroll: true });
      return;
    }
    const button = (event.target as HTMLElement).closest<HTMLElement>('[data-panel]');
    if (button) toggle(button.dataset.panel as PanelId);
  }
  // Each menu has its own entry point; both return focus to the world on closing.
  dock.querySelector('[data-user-menu]')!.addEventListener('click', () => { document.querySelector<HTMLElement>('#game')?.focus({ preventScroll: true }); toggle('character'); });
  dock.querySelector('[data-pause-menu]')!.addEventListener('click', () => { document.querySelector<HTMLElement>('#game')?.focus({ preventScroll: true }); openMenu(); });
  root.addEventListener('click', click);
  root.querySelector('.journal-close')!.addEventListener('click', close);
  function keydown(event: KeyboardEvent) {
    if (document.querySelector('dialog[open]')) return;
    if (event.altKey || event.ctrlKey || event.metaKey || (event.target instanceof HTMLElement && event.target.closest('input, textarea, select, [contenteditable="true"]'))) return;
    const panel = PANELS.find(p => p.key === event.code);
    const openUserMenu = !active && event.code === 'Tab' && !event.shiftKey;
    if (panel || openUserMenu || (active && event.key === 'Escape')) {
      if (hud.hasAttribute('data-battle') || hud.hasAttribute('data-dialogue') || hud.hasAttribute('data-watching') || hud.hasAttribute('data-lamp')) return;
      event.preventDefault(); event.stopImmediatePropagation();
      if (!event.repeat) {
        if (panel?.id === 'map') {
          if (event.shiftKey) showMap(active === 'map' && mapLevel === 'world' ? 'local' : 'world');
          else if (active === 'map' && mapLevel === 'world') showMap('local');
          else toggle('map');
        } else if (panel) toggle(panel.id);
        else if (openUserMenu) toggle('character');
        else back();
      }
    } else if (active && event.key === 'Tab') {
      event.preventDefault();
      const buttons = [...root.querySelectorAll<HTMLButtonElement>('button')].filter(button => !button.closest('[hidden]') && button.getClientRects().length);
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
      if (action === 'cancel') back();
      else if (action === 'confirm') clickControllerButton(root);
      else if (action !== 'menu') focusControllerButton(root, action);
    },
    update(id: EnvironmentId, position: Cell) { location = id; cell = { ...position }; render(); },
    /** Redraws the open panel after the story changes. */
    refresh() { render(); },
    destroy() { close(); window.removeEventListener('keydown', keydown, { capture: true }); dock.remove(); root.remove(); },
  };
}
