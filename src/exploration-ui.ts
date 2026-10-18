import type { ControllerEvent } from './controller';
import { ENVIRONMENTS, type EnvironmentId } from './environments';
import type { Cell, Direction } from './movement';
import { renderWorldMap } from './world-map';
import { ITEMS, ITEM_KIND_LABELS, itemsOfKind, type ItemKind } from './items';
import type { MemberId, PartyMember, Story } from './story';
import { CLASS_STATS, SKILLS, type ClassId } from './battle';
import { CLASSES } from './classes';
import { PROFILES, STAT_LABELS, withBonus, type Stats } from './stats';
import { currentThought, diary, storyClock } from './journal';
import type { PlayerId } from './party';
import { flashAnima, portrait as face, vitalsPlate } from './vitals';

/**
 * The status screen (C on the keyboard, the top face button on a controller). Everything fits on
 * screen without scrolling; L / R (Q / E on the keyboard) turn the pages. With a second player on
 * Aitor each player opens their own half: Gerard on the left, Aitor on the right.
 */
export type PanelId = 'character' | 'animas' | 'items' | 'map' | 'diary';
// Register another page here, then supply its content in render().
const PAGES: { id: PanelId; label: string; key?: string }[] = [
  { id: 'character', label: 'Estado', key: 'KeyC' },
  { id: 'animas', label: 'Ánimas' },
  { id: 'items', label: 'Objetos', key: 'KeyI' },
  { id: 'map', label: 'Mapa', key: 'KeyM' },
  { id: 'diary', label: 'Diario' },
];
const TITLES: Record<PanelId, string> = { character: 'Así estás.', animas: 'Lo que despierta en ti.', items: 'Lo que lleváis.', map: 'Por aquí.', diary: 'Lo que recuerdas.' };
const COMPANION: Record<Story['companion'], string> = { none: 'Por tu cuenta', follow: 'Bernat', stalled: 'Bernat · Se ha quedado atrás' };
/** PV and Secundaria run as waves on the vitals plate; these are the rest, which sit around 10. */
const STAT_ORDER: (keyof Stats)[] = ['fuerza', 'magia', 'defensa', 'espiritu', 'velocidad'];
const STAT_SCALE = 20;
const SLOT_LABELS = { feet: 'Pies', back: 'Espalda' } as const;
const escape = (text: string) => text.replace(/[&<>"]/g, c => `&#${c.charCodeAt(0)};`);

export interface StatusCallbacks {
  pause: (paused: boolean) => void;
  openMenu: () => void;
  /** Puts one of the party's ánimas (classes) on a member, or takes it off with `null`. */
  wear: (member: MemberId, classId: ClassId | null) => void;
  /** Whether a second player plays Aitor right now: then each player gets their own half. */
  split: () => boolean;
  /** Where the partner (Aitor, Bernat) stands, for the map. */
  partner: () => Cell | undefined;
  /** Development only: one player plays both Gerard and Aitor (docs/party.md). */
  solo: () => boolean;
}
interface Sheet { player: PlayerId; el: HTMLElement; page?: PanelId; cursor?: string; viewing?: ClassId }
type Seen = Map<MemberId, ClassId | undefined>;

export function createExplorationUI(hud: HTMLElement, story: Story, callbacks: StatusCallbacks) {
  let location: EnvironmentId = 'maresme';
  let cell: Cell = { ...ENVIRONMENTS[location].spawn };
  let previousFocus: HTMLElement | null = null;
  const inertBefore = new Map<HTMLElement, boolean>();
  const dock = document.createElement('nav');
  dock.className = 'journal-dock'; dock.setAttribute('aria-label', 'Menú de aventura');
  // The status screen lives in the menu too; C / I / M stay as keyboard shortcuts.
  dock.innerHTML = `<button type="button" aria-haspopup="dialog"><kbd data-glyph="menu">Esc</kbd> Menú</button>`;
  const root = document.createElement('section');
  root.id = 'exploration-panel'; root.hidden = true; root.tabIndex = -1;
  const sheets: Sheet[] = ([1, 2] as const).map(player => {
    const el = document.createElement('article');
    el.className = 'status-sheet'; el.dataset.player = String(player); el.hidden = true;
    // Player 2's half shows the buttons of player 2's own pad (input-glyphs.ts).
    if (player === 2) el.dataset.glyphPlayer = '2';
    el.setAttribute('role', 'dialog'); el.setAttribute('aria-labelledby', `status-title-${player}`);
    root.append(el);
    return { player, el };
  });
  hud.append(dock, root);
  const sheetOf = (player: PlayerId) => sheets[player - 1];
  const anyOpen = () => sheets.some(s => s.page);
  const blocked = () => hud.hasAttribute('data-battle') || hud.hasAttribute('data-dialogue');
  /** Ánimas appear once the story wakes the first one: a new system shows up when it is needed. */
  const pages = () => PAGES.filter(p => p.id !== 'animas' || story.classes.length);
  /** Whose sheet it is: player 2 always plays Aitor. */
  const ownerOf = (sheet: Sheet): MemberId => sheet.player === 2 ? 'aitor' : 'gerard';
  /** Who a sheet can dress: alone, player 1 looks after the whole party; split, each their own. */
  const wardsOf = (sheet: Sheet) => story.party.filter(m => !callbacks.split() || m.id === ownerOf(sheet));
  /** An ánima's colours and look come with it (classes.ts). */
  const animaColour = (member: PartyMember) => member.classId ? CLASSES[member.classId].colour : undefined;

  const portrait = (member: PartyMember) => face(member.profile, member.name, member.classId && CLASSES[member.classId].scarf);
  /** Out of a fight everyone is rested: full PV and Secundaria, with the ánima's colours. */
  function plate(member: PartyMember) {
    const stats = withBonus(PROFILES[member.profile], member.classId ? CLASS_STATS[member.classId] : undefined);
    return vitalsPlate({ id: member.id, name: member.name, profile: member.profile, hp: stats.pv, maxHp: stats.pv, sec: stats.sec, maxSec: stats.sec, anima: member.classId && CLASSES[member.classId].name, colour: animaColour(member), scarf: member.classId && CLASSES[member.classId].scarf });
  }
  /** One chip per woken ánima (and none): each member wears their own, and two can differ. */
  function animaSwitch(member: PartyMember) {
    // Bernat wears no ánima: he only attacks.
    if (!story.classes.length || member.id === 'bernat') return '';
    return `<div class="anima-switch" role="group" aria-label="Ánima de ${escape(member.name)}"><span class="battle-kicker">ÁNIMA</span><div class="anima-chips">${[null, ...story.classes].map(id => `<button type="button" data-key="wear:${member.id}:${id ?? ''}" data-wear="${member.id}" data-class-id="${id ?? ''}" aria-pressed="${(member.classId ?? null) === id}" style="--chip:${id ? CLASSES[id].colour : 'var(--ui-paper)'}">${id ? CLASSES[id].name : 'Sin ánima'}</button>`).join('')}</div></div>`;
  }
  const bonusChips = (classId: ClassId) => (Object.entries(CLASS_STATS[classId]) as [keyof Stats, number][])
    .map(([key, value]) => `<li data-sign="${value > 0 ? 'up' : 'down'}">${STAT_LABELS[key]} ${value > 0 ? '+' : '−'}${Math.abs(value)}</li>`).join('');
  const skillsOf = (classId: ClassId) => SKILLS.filter(s => s.class === classId);
  function statRows(member: PartyMember) {
    const stats = withBonus(PROFILES[member.profile], member.classId ? CLASS_STATS[member.classId] : undefined);
    return `<dl class="status-bars">${STAT_ORDER.map(key => {
      const bonus = member.classId ? CLASS_STATS[member.classId][key] ?? 0 : 0;
      return `<div data-stat="${key}"><dt>${STAT_LABELS[key]}</dt><dd><i style="--fill:${Math.min(100, stats[key] / STAT_SCALE * 100).toFixed(1)}%"></i><b>${stats[key]}</b>${bonus ? `<small data-sign="${bonus > 0 ? 'up' : 'down'}">${bonus > 0 ? '+' : '−'}${Math.abs(bonus)}</small>` : ''}</dd></div>`;
    }).join('')}</dl>`;
  }
  /** What the worn ánima is about, in one line under the switch. */
  function animaLine(member: PartyMember) {
    if (!story.classes.length || !member.classId) return '';
    const spec = CLASSES[member.classId];
    return `<p class="anima-line">${spec.motto} <b>${skillsOf(member.classId).map(s => s.name).join(' · ')}</b></p>`;
  }
  function equipment(member: PartyMember) {
    if (!member.equipment.length) return '';
    return `<ul class="status-equipment">${member.equipment.map(id => `<li><span>${SLOT_LABELS[ITEMS[id].equip ?? 'back']}</span>${escape(ITEMS[id].name)}</li>`).join('')}</ul>`;
  }

  function statusPage(sheet: Sheet) {
    const own = ownerOf(sheet);
    const member = story.party.find(m => m.id === own) ?? story.party[0];
    const others = sheet.player === 1 && !callbacks.split() ? story.party.filter(m => m.id !== member.id) : [];
    const company = own === 'aitor' ? 'Gerard' : story.partner === 'aitor' ? 'Aitor' : COMPANION[story.companion];
    return `<div class="status-page">
      <section class="status-hero">
        <div class="status-portrait" data-member="${member.id}" style="--anima:${animaColour(member) ?? 'var(--sheet-accent)'}">${portrait(member)}<i class="vitals-burst" aria-hidden="true"></i></div>
        <div class="status-name"><span class="battle-kicker">${own === 'aitor' ? 'EL COMPAÑERO' : 'EL PROTAGONISTA'}</span><h2>${escape(member.name)}</h2><p>${escape(member.note)}</p>${equipment(member)}</div>
      </section>
      <section class="status-stats"><span class="battle-kicker">ESTADÍSTICAS</span>${statRows(member)}${story.battles ? `<span class="battle-kicker">HABILIDADES</span><ul class="status-skills">${SKILLS.filter(s => s.class === member.classId).map(s => `<li><strong>${s.name}</strong><small>${s.cost} SEC</small><span>${s.description}</span></li>`).join('')}</ul>` : ''}</section>
      <section class="status-side">
        <div class="status-vitals">${plate(member)}${animaSwitch(member)}${animaLine(member)}</div>
        <article class="status-mission"><span class="battle-kicker">AHORA</span><p>${currentThought(story, own).mission}</p></article>
        <dl class="status-facts"><div><dt>Lugar</dt><dd>${escape(ENVIRONMENTS[location].name)}</dd></div><div><dt>Compañía</dt><dd>${company}</dd></div></dl>
        ${others.map(m => `<article class="status-mate" data-member="${m.id}">${plate(m)}</article>`).join('')}
      </section>
    </div>`;
  }
  function animasPage(sheet: Sheet) {
    const classes = story.classes, wards = wardsOf(sheet);
    const own = wards.find(m => m.id === ownerOf(sheet)) ?? wards[0];
    const viewing = sheet.viewing && classes.includes(sheet.viewing) ? sheet.viewing : own?.classId ?? classes[0];
    const spec = CLASSES[viewing];
    // Each member: their vitals and their own ánima.
    const wearers = wards.map(m => `<article class="anima-wearer" data-member="${m.id}">${plate(m)}${animaSwitch(m)}</article>`).join('');
    return `<div class="animas-page">
      <section class="anima-wearers" data-count="${wards.length}">${wearers}</section>
      <article class="anima-detail" style="--scarf:${spec.colour}">
        <div><span class="battle-kicker">ÁNIMA</span><h2>${spec.name}</h2><p class="anima-motto">${spec.motto}</p></div>
        <section><span class="battle-kicker">CAMBIA</span><ul class="anima-bonus">${bonusChips(viewing)}</ul></section>
        <section><span class="battle-kicker">HABILIDADES</span><ul class="anima-skills">${skillsOf(viewing).map(s => `<li><strong>${s.name}</strong><small>${s.cost} SEC</small><span>${s.description}</span></li>`).join('')}</ul></section>
        <p class="anima-rule">Cada uno lleva la suya. En combate se cambia en tu turno y no lo gasta.</p>
      </article>
    </div>`;
  }
  function itemsPage() {
    const equipped = new Map(story.party.flatMap(m => m.equipment.map(id => [id, m.name] as const)));
    const column = (kind: ItemKind) => {
      const items = itemsOfKind(story.items, kind);
      return `<section class="item-column" data-kind="${kind}"><span class="battle-kicker">${ITEM_KIND_LABELS[kind].toUpperCase()}</span><p class="journal-muted">${kind === 'common' ? 'Se gastan al usarlos.' : 'Para la historia. No se pierden.'}</p><ul>${items.length
        ? items.map(item => `<li><strong>${escape(item.name)}${equipped.has(item.id) ? `<em>${SLOT_LABELS[item.equip ?? 'back']} · ${escape(equipped.get(item.id)!)}</em>` : ''}</strong><span>${escape(item.description)}</span></li>`).join('')
        : '<li class="empty">Nada por aquí todavía.</li>'}</ul></section>`;
    };
    const shared = story.partner === 'aitor' ? '<p class="items-shared"><b>Compartido con Aitor.</b> Lo que lleva uno lo lleva el otro.</p>' : '';
    return `<div class="items-page">${shared}<div class="item-columns">${column('common')}${column('key')}</div></div>`;
  }
  function mapPage(sheet: Sheet) {
    const environment = ENVIRONMENTS[location];
    const partnerAt = callbacks.partner();
    const partnerName = story.partner === 'aitor' ? 'Aitor' : story.partner === 'bernat' ? 'Bernat' : undefined;
    const partner = partnerAt && partnerName ? { cell: { x: Math.round(partnerAt.x), z: Math.round(partnerAt.z) }, name: partnerName } : undefined;
    return `<div class="map-layout" data-viewer="${ownerOf(sheet)}"><div class="map-frame">${renderWorldMap(environment, cell, partner)}</div><aside class="map-details"><span class="battle-kicker">MAPA LOCAL</span><h2>${escape(environment.name)}</h2><div class="map-legend"><span class="legend-player">● Gerard</span>${partner ? `<span class="legend-partner">● ${partner.name}</span>` : ''}<span>▧ Camino transitable</span><span>■ Edificios / obstáculos</span></div>${environment.interactions.length
      ? `<ol class="map-landmarks">${environment.interactions.map(point => `<li>${escape(point.label)}</li>`).join('')}</ol>`
      : '<p class="journal-muted">Sin puntos de interacción en este entorno.</p>'}</aside></div>`;
  }
  function diaryPage(sheet: Sheet) {
    const own = ownerOf(sheet);
    const { mission, thought } = currentThought(story, own);
    const chapters = diary(story, own).map((chapter, i) => i === 0
      ? `<section class="diary-chapter"><span class="battle-kicker">${chapter.kicker}</span><h3>${chapter.title}</h3>${chapter.entries.length ? `<ol>${chapter.entries.map(e => `<li>${e}</li>`).join('')}</ol>` : '<p class="journal-muted">Todavía nada que contar.</p>'}</section>`
      : `<section class="diary-chapter" data-past><span class="battle-kicker">${chapter.kicker}</span><h3>${chapter.title}</h3>${chapter.entries.length ? `<p>«${chapter.entries[chapter.entries.length - 1]}»</p>` : ''}</section>`).join('');
    return `<div class="diary-page"><article class="diary-now"><span class="battle-kicker">AHORA</span><h2>${mission}</h2><blockquote>${thought}</blockquote><p class="diary-sign">— ${own === 'aitor' ? 'Aitor' : 'Gerard'}</p></article><div class="diary-past">${chapters}</div></div>`;
  }

  function renderSheet(sheet: Sheet) {
    if (!sheet.page) return;
    if (!pages().some(p => p.id === sheet.page)) sheet.page = 'character';
    const page = sheet.page, own = story.party.find(m => m.id === ownerOf(sheet)) ?? story.party[0];
    const { time, day } = storyClock(story);
    sheet.el.dataset.member = own.id;
    // Each half wears the colours of its own player's ánima.
    sheet.el.dataset.anima = own.classId ?? 'none';
    const dev = sheet.player === 1 && callbacks.solo() && story.partner === 'aitor' ? '<span class="sheet-dev">DEPURACIÓN · UN JUGADOR LLEVA A LOS DOS</span>' : '';
    sheet.el.innerHTML = `<header class="sheet-head">
        <div><span class="battle-kicker">ESTADO · ${escape(own.name.toUpperCase())}${dev}</span><h1 id="status-title-${sheet.player}">${page === 'items' && story.partner !== 'aitor' ? 'Lo que llevas.' : TITLES[page]}</h1></div>
        <div class="sheet-clock" role="img" aria-label="Son las ${time}"><strong>${time}</strong><span>${day}</span></div>
        <button class="journal-close" type="button" data-key="close" data-close>Cerrar <kbd data-glyph="cancel"></kbd></button>
      </header>
      <nav class="journal-tabs" aria-label="Páginas del estado"><kbd data-tab-key="prev" data-glyph="prev"></kbd>${pages().map(p => `<button type="button" data-key="panel:${p.id}" data-panel="${p.id}" aria-pressed="${p.id === page}">${p.label}</button>`).join('')}<kbd data-tab-key="next" data-glyph="next"></kbd></nav>
      <div class="journal-content" data-page="${page}">${page === 'character' ? statusPage(sheet) : page === 'animas' ? animasPage(sheet) : page === 'items' ? itemsPage() : page === 'map' ? mapPage(sheet) : diaryPage(sheet)}</div>
      <p class="sheet-help" data-glyph-template="{prev} / {next} · Página  ·  {arrows} · Elegir  ·  {confirm} · Usar  ·  {cancel} · Cerrar"></p>`;
    point(sheet, sheet.el.querySelector<HTMLButtonElement>(`[data-key="${sheet.cursor}"]`) ?? sheet.el.querySelector<HTMLButtonElement>(`[data-panel="${page}"]`)!);
  }
  /** Who wore what at the last redraw, so a change of ánima lights up that member's face. */
  let seen: Seen = new Map();
  const remember = () => { seen = new Map(story.party.map(m => [m.id, m.classId])); };
  function render() {
    const changed = story.party.filter(m => seen.has(m.id) && seen.get(m.id) !== m.classId);
    sheets.forEach(renderSheet);
    for (const m of changed) root.querySelectorAll(`.status-portrait[data-member="${m.id}"], .vitals[data-member="${m.id}"] .vitals-avatar`).forEach(el => flashAnima(el, animaColour(m)));
    remember();
  }
  function layout() {
    const open = anyOpen();
    root.hidden = !open; root.dataset.split = String(callbacks.split());
    sheets.forEach(s => { s.el.hidden = !s.page; });
    const page = sheetOf(1).page ?? sheetOf(2).page;
    if (page) hud.dataset.panel = page; else delete hud.dataset.panel;
  }

  /** Each sheet keeps its own cursor, so two players can browse at once; player 1's is also the focus. */
  function point(sheet: Sheet, button: HTMLButtonElement | null | undefined) {
    if (!button) return;
    sheet.el.querySelectorAll('.is-cursor').forEach(el => el.classList.remove('is-cursor'));
    button.classList.add('is-cursor'); sheet.cursor = button.dataset.key;
    if (sheet.player === 1 || !sheetOf(1).page) button.focus({ preventScroll: true });
  }
  const buttonsOf = (sheet: Sheet) => [...sheet.el.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')].filter(b => b.getClientRects().length);
  /** Moves the cursor to the nearest button that way on screen, so grids and rows read naturally. */
  function move(sheet: Sheet, direction: Direction) {
    const list = buttonsOf(sheet);
    const from = list.find(b => b.dataset.key === sheet.cursor);
    if (!from) { point(sheet, list[0]); return; }
    const a = from.getBoundingClientRect();
    let best: HTMLButtonElement | undefined, bestScore = Infinity, inCone = false;
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
    point(sheet, best);
  }
  function turn(sheet: Sheet, step: 1 | -1) {
    const list = pages(), index = list.findIndex(p => p.id === sheet.page);
    show(list[(index + step + list.length) % list.length].id, sheet.player);
  }
  function show(id: PanelId, player: PlayerId = 1) {
    if (blocked() || (player === 2 && !callbacks.split())) return;
    const sheet = sheetOf(player);
    if (!anyOpen()) {
      previousFocus = document.activeElement as HTMLElement;
      for (const el of [...hud.children, document.querySelector('#game')]) {
        if (el instanceof HTMLElement && el !== root) { inertBefore.set(el, el.inert); el.inert = true; }
      }
      callbacks.pause(true);
    }
    sheet.page = pages().some(p => p.id === id) ? id : 'character'; sheet.cursor = `panel:${sheet.page}`;
    layout(); renderSheet(sheet); remember();
  }
  /** Closes one player's half, or the whole screen without `player`. */
  function close(player?: PlayerId) {
    if (!anyOpen()) return;
    for (const sheet of sheets) if (!player || sheet.player === player) { sheet.page = undefined; sheet.el.replaceChildren(); }
    layout();
    if (anyOpen()) { const other = sheets.find(s => s.page)!; renderSheet(other); return; }
    inertBefore.forEach((value, el) => { el.inert = value; }); inertBefore.clear();
    callbacks.pause(false);
    (previousFocus?.isConnected ? previousFocus : document.querySelector<HTMLElement>('#game'))?.focus({ preventScroll: true });
  }
  /** A page's shortcut: opens it, closes the screen if it is already showing, or switches to it. */
  function toggle(id: PanelId, player: PlayerId = 1) {
    if (sheetOf(player).page === id) close(player); else show(id, player);
  }
  function click(event: MouseEvent) {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button');
    const sheet = sheets.find(s => button && s.el.contains(button));
    if (!button || !sheet) return;
    sheet.cursor = button.dataset.key;
    const { wear, classId, panel } = button.dataset;
    if (wear && classId) sheet.viewing = classId as ClassId;
    if (wear) callbacks.wear(wear as MemberId, (classId || null) as ClassId | null);
    else if (panel) show(panel as PanelId, sheet.player);
    else if (button.hasAttribute('data-close')) close(sheet.player);
  }
  // Return focus to the world, not the dock button, once the menu closes.
  dock.addEventListener('click', () => { document.querySelector<HTMLElement>('#game')?.focus({ preventScroll: true }); callbacks.openMenu(); });
  root.addEventListener('click', click);
  const arrows: Record<string, Direction> = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };
  function keydown(event: KeyboardEvent) {
    if (document.querySelector('dialog[open]')) return;
    if (event.altKey || event.ctrlKey || event.metaKey || (event.target instanceof HTMLElement && event.target.closest('input, textarea, select, [contenteditable="true"]'))) return;
    const shortcut = PAGES.find(p => p.key === event.code);
    const own = sheetOf(1);
    if (shortcut) {
      if (blocked()) return;
      event.preventDefault(); event.stopImmediatePropagation();
      if (!event.repeat) toggle(shortcut.id);
      return;
    }
    if (!own.page) return;
    const handled = event.key === 'Escape' || event.code === 'KeyQ' || event.code === 'KeyE' || arrows[event.code] || event.key === 'Tab';
    if (!handled) return;
    event.preventDefault(); event.stopImmediatePropagation();
    if (event.key === 'Escape') { if (!event.repeat) close(1); }
    else if (event.code === 'KeyQ' || event.code === 'KeyE') { if (!event.repeat) turn(own, event.code === 'KeyQ' ? -1 : 1); }
    else if (arrows[event.code]) move(own, arrows[event.code]);
    else {
      const list = buttonsOf(own), index = list.findIndex(b => b.dataset.key === own.cursor);
      point(own, list[(index + (event.shiftKey ? -1 : 1) + list.length) % list.length]);
    }
  }
  window.addEventListener('keydown', keydown, { capture: true });
  // Keyboard focus moved by the browser (a click, Tab from outside) carries player 1's cursor along.
  sheetOf(1).el.addEventListener('focusin', event => { const key = (event.target as HTMLElement).dataset?.key; if (key) point(sheetOf(1), event.target as HTMLButtonElement); });
  return {
    close, toggle, show,
    /** The page open in player 1's half, or else in player 2's. */
    get active() { return sheetOf(1).page ?? sheetOf(2).page; },
    isOpen(player: PlayerId) { return !!sheetOf(player).page; },
    control(action: ControllerEvent, player: PlayerId = 1) {
      const sheet = sheetOf(player);
      if (action === 'character') { if (sheet.page) close(player); else show('character', player); return; }
      if (!sheet.page) return;
      if (action === 'cancel') close(player);
      else if (action === 'prev' || action === 'next') turn(sheet, action === 'prev' ? -1 : 1);
      else if (action === 'confirm') buttonsOf(sheet).find(b => b.dataset.key === sheet.cursor)?.click();
      else if (action !== 'menu' && action !== 'overview') move(sheet, action);
    },
    update(id: EnvironmentId, position: Cell) { location = id; cell = { ...position }; render(); },
    /** Redraws the open pages after the story changes. */
    refresh() { render(); },
    /** Who plays whom changed: player 2's half goes when the second player does. */
    relayout() { if (!callbacks.split() && sheetOf(2).page) close(2); layout(); render(); },
    destroy() { close(); window.removeEventListener('keydown', keydown, { capture: true }); dock.remove(); root.remove(); },
  };
}
