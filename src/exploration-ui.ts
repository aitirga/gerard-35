import type { ControllerEvent } from './controller';
import { ENVIRONMENTS, type EnvironmentId } from './environments';
import type { Cell, Direction } from './movement';
import { renderWorldMap } from './world-map';
import { renderExplorationWorldMap } from './exploration-world-map';
import { ANIMAS, animaBonus } from './animas';
import { ITEMS, ITEM_KIND_LABELS, itemsOfKind, type ItemKind } from './items';
import type { MemberId, PartyMember, Story } from './story';
import { CLASS_STATS, SKILLS, type ClassId } from './battle';
import { CLASSES } from './classes';
import { PROFILES, STAT_LABELS, withBonus, type Stats } from './stats';
import { currentThought, diary, storyClock } from './journal';
import type { PlayerId } from './party';
import { flashAnima, portrait as face, vitalsPlate } from './vitals';
import { SPEAKERS } from './dialogue';

/**
 * The user menu (Tab, or C / I / H straight to a section; the top face button on a controller).
 * Everything fits on screen without scrolling; L / R (Q / E on the keyboard) turn the sections. M
 * opens the map on its own, centred; Shift + M the Mapa del mundo. With a second player on Aitor
 * each player opens their own half: Gerard on the left, Aitor on the right.
 */
export type PanelId = 'character' | 'animas' | 'items' | 'map' | 'diary' | 'help';
// Register another section here, then supply its content in renderSheet().
const PAGES: { id: PanelId; label: string; key?: string; icon: string }[] = [
  { id: 'character', label: 'Personaje', key: 'KeyC', icon: '<circle cx="12" cy="8" r="3"/><path d="M5 21v-3a7 7 0 0 1 14 0v3"/>' },
  { id: 'animas', label: 'Ánimas', icon: '<path d="M12 3c1 3 6 5 6 10a6 6 0 0 1-12 0c0-2.5 1.5-4 2.5-6 1 1.5 2 2.5 3.5 2.5 0-2-.5-4.5 0-6.5Z"/>' },
  { id: 'items', label: 'Objetos', key: 'KeyI', icon: '<path d="M8 7V5a4 4 0 0 1 8 0v2M5 7h14l1 14H4L5 7Z"/><path d="M9 12h6"/>' },
  { id: 'map', label: 'Mapa', key: 'KeyM', icon: '<path d="m3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2V5ZM9 3v16M15 5v16"/>' },
  { id: 'diary', label: 'Diario', icon: '<path d="M6 4h10a2 2 0 0 1 2 2v14H8a2 2 0 0 1-2-2V4Z"/><path d="M6 18a2 2 0 0 1 2-2h10M10 8h5"/>' },
  { id: 'help', label: 'Cómo jugar', key: 'KeyH', icon: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 4.2 1.8c-1 .7-1.7 1.1-1.7 2.7M12 17h.01"/>' },
];
const TITLES: Record<PanelId, string> = { character: 'Tu aventura.', animas: 'Lo que despierta en ti.', items: 'Lo que lleváis.', map: 'Por aquí.', diary: 'Lo que recuerdas.', help: 'A tu ritmo.' };
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
/** `world`: the map page shows Barcelona (Shift + M) instead of the local map. */
interface Sheet { player: PlayerId; el: HTMLElement; page?: PanelId; cursor?: string; viewing?: ClassId; world?: boolean }
type Seen = Map<MemberId, ClassId | undefined>;

export function createExplorationUI(hud: HTMLElement, story: Story, callbacks: StatusCallbacks) {
  let location: EnvironmentId = 'maresme';
  let cell: Cell = { ...ENVIRONMENTS[location].spawn };
  let previousFocus: HTMLElement | null = null;
  const inertBefore = new Map<HTMLElement, boolean>();
  const dock = document.createElement('nav');
  dock.className = 'journal-dock'; dock.setAttribute('aria-label', 'Menús del juego');
  // Two ways in: Gerard's user menu (Tab) and the pause menu (Esc).
  dock.innerHTML = `<button class="user-menu-trigger" type="button" data-user-menu aria-haspopup="dialog" aria-label="Abrir menú de usuario"><span class="user-menu-avatar" aria-hidden="true"></span><span><strong>Gerard</strong><small>Menú de usuario</small></span><kbd data-glyph="user">Tab</kbd></button><button class="pause-menu-trigger" type="button" data-pause-menu aria-haspopup="dialog" aria-label="Abrir menú de pausa"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14M16 5v14"/></svg><kbd data-glyph="menu">Esc</kbd></button>`;
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
  /** The dock's face: Gerard as a boy or at 35. */
  function updateAvatar() {
    const avatar = dock.querySelector<HTMLElement>('.user-menu-avatar')!;
    const age = story.adult ? 'adult' : 'child';
    if (avatar.dataset.age === age) return;
    avatar.dataset.age = age;
    avatar.innerHTML = story.adult ? SPEAKERS.gerard35.art : `<img src="${import.meta.env.BASE_URL}portraits/gerard-child.png" alt=""/>`;
  }
  updateAvatar();
  const sheetOf = (player: PlayerId) => sheets[player - 1];
  const anyOpen = () => sheets.some(s => s.page);
  const blocked = () => hud.hasAttribute('data-battle') || hud.hasAttribute('data-dialogue') || hud.hasAttribute('data-watching') || hud.hasAttribute('data-lamp');
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
        ${story.adult ? friendAnimas() : ''}
        ${others.map(m => `<article class="status-mate" data-member="${m.id}">${plate(m)}</article>`).join('')}
      </section>
    </div>`;
  }
  /** Chapter 2: the friends' ánimas the party carries, each a light of its own colour. */
  function friendAnimas() {
    const owned = story.animas.map(id => ANIMAS[id]);
    const bonus = animaBonus(story.animas);
    const total = (Object.entries(bonus) as [keyof Stats, number][]).map(([key, value]) => `${STAT_LABELS[key]} +${value}`).join(' · ');
    return `<section class="party-animas" aria-label="Ánimas de los amigos"><span class="battle-kicker">ÁNIMAS DE LOS AMIGOS</span>${owned.length
      ? `<ul>${owned.map(a => `<li style="--anima:${a.colour}"><i aria-hidden="true"></i><strong>${escape(a.name)}</strong><span>${escape(a.friend)}</span></li>`).join('')}</ul><p class="journal-muted">Todo el equipo: ${total}</p>`
      : '<p class="journal-muted">Ninguna todavía.</p>'}</section>`;
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
  /** M: the map on its own, centred in the sheet; Shift + M widens it to the Mapa del mundo. */
  function mapPage(sheet: Sheet) {
    const world = !!sheet.world, environment = ENVIRONMENTS[location];
    const partnerAt = callbacks.partner();
    const partnerName = story.partner === 'aitor' ? 'Aitor' : story.partner === 'bernat' ? 'Bernat' : undefined;
    const partner = partnerAt && partnerName ? { cell: { x: Math.round(partnerAt.x), z: Math.round(partnerAt.z) }, name: partnerName } : undefined;
    // Places and where everyone is, never a list of things to do (AGENTS.md).
    const drawing = world ? renderExplorationWorldMap(location, { castle: story.has('tv-news'), threat: story.castleThreat, spread: Math.min(1, story.spread) })
      : renderWorldMap(environment, cell, partner);
    const keys = world ? '<span>Barcelona · Vista general</span>'
      : `<span class="map-player-key"><i aria-hidden="true"></i>Gerard</span>${partner ? `<span class="map-partner-key"><i aria-hidden="true"></i>${escape(partner.name)}</span>` : ''}`;
    return `<div class="map-view" data-viewer="${ownerOf(sheet)}" data-level="${world ? 'world' : 'local'}">
      <header class="map-heading"><div><span class="battle-kicker">${world ? 'BARCELONA' : 'MAPA LOCAL'}</span><h2 id="map-title-${sheet.player}">${world ? 'Mapa del mundo' : escape(environment.name)}</h2></div><button class="journal-close" type="button" data-key="map-back" data-map-back>${world ? 'Mapa local' : 'Volver al juego'} <kbd data-glyph="cancel">Esc</kbd></button></header>
      <div class="map-canvas">${drawing}</div>
      <footer class="map-footer"><div class="map-keys">${keys}</div><button type="button" data-key="map-level" data-map-level="${world ? 'local' : 'world'}">${world ? 'Mapa local <kbd>M</kbd>' : 'Mapa del mundo <kbd>Mayús</kbd> + <kbd>M</kbd>'}</button></footer>
    </div>`;
  }
  /** Cómo jugar: the controls of the device in use (input-glyphs.ts fills the templates). */
  function helpPage() {
    return `<div class="help-page"><div class="user-help-intro"><span class="battle-kicker">LOS CONTROLES</span><h2>La aventura se juega probando.</h2><p>Explora, habla con la gente y descubre el mundo a tu ritmo.</p></div>
      <dl class="menu-controls">
        <div><dt>Moverte</dt><dd data-device="keyboard">W A S D o flechas</dd><dd data-device="gamepad">Stick izquierdo o cruceta</dd></div>
        <div><dt>Correr</dt><dd data-glyph-template="Con las zapatillas: {run}"></dd></div>
        <div><dt>Interactuar / avanzar</dt><dd data-device="keyboard">E · Enter · Espacio</dd><dd data-device="gamepad" data-glyph-template="{interact}"></dd></div>
        <div><dt>Menú de usuario</dt><dd data-device="keyboard">Tab · C Personaje · I Objetos · H Cómo jugar · Q / E cambian de sección</dd><dd data-device="gamepad" data-glyph-template="{party} · {prev} / {next} cambian de sección"></dd></div>
        <div><dt>Mapas</dt><dd data-device="keyboard">M · Mapa local · Mayús + M · Mapa del mundo (Barcelona) · Esc vuelve un nivel</dd><dd data-device="gamepad">En el menú de usuario, sección Mapa</dd></div>
        <div><dt>Dos jugadores</dt><dd>Con Aitor en el mando 2, cada uno abre su menú en su mitad de la pantalla</dd></div>
        <div><dt>Vista general</dt><dd data-glyph-template="{overview}"></dd></div>
        <div><dt>Combate</dt><dd data-glyph-template="{pick} elegir · {confirm} confirmar · {cancel} volver · {details} detalles de una habilidad · {prev} / {next} cambiar de ánima"></dd></div>
        <div><dt>Pausa</dt><dd data-glyph-template="{menu} · En Configuración, el mando, el sonido y las luces de casa"></dd></div>
      </dl></div>`;
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
    // The map stands on its own, centred, without the menu around it.
    sheet.el.dataset.layout = page === 'map' ? 'map' : 'journal';
    sheet.el.setAttribute('aria-labelledby', `${page === 'map' ? 'map' : 'status'}-title-${sheet.player}`);
    if (sheet.player === 1) {
      root.dataset.layout = sheet.el.dataset.layout;
      if (page === 'map') root.dataset.mapLevel = sheet.world ? 'world' : 'local'; else delete root.dataset.mapLevel;
    }
    const dev = sheet.player === 1 && callbacks.solo() && story.partner === 'aitor' ? '<span class="sheet-dev">DEPURACIÓN · UN JUGADOR LLEVA A LOS DOS</span>' : '';
    const content = page === 'character' ? statusPage(sheet) : page === 'animas' ? animasPage(sheet) : page === 'items' ? itemsPage() : page === 'diary' ? diaryPage(sheet) : helpPage();
    sheet.el.innerHTML = page === 'map' ? mapPage(sheet) : `<header class="sheet-head">
        <div><span class="battle-kicker">MENÚ DE USUARIO · ${escape(own.name.toUpperCase())}${dev}</span><div class="journal-identity"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 2 8 10-8 10L4 12 12 2Z"/><path d="m8 12 4-5 4 5-4 5-4-5Z"/></svg><h1 id="status-title-${sheet.player}">${page === 'items' && story.partner !== 'aitor' ? 'Lo que llevas.' : TITLES[page]}</h1></div><p class="journal-context">${escape(ENVIRONMENTS[location].name)}</p></div>
        <div class="sheet-clock" role="img" aria-label="Son las ${time}"><strong>${time}</strong><span>${day}</span></div>
        <button class="journal-close" type="button" data-key="close" data-close>Volver al juego <kbd data-glyph="cancel">Esc</kbd></button>
      </header>
      <nav class="journal-tabs" aria-label="Secciones del menú de usuario"><kbd data-tab-key="prev" data-glyph="prev"></kbd>${pages().map(p => `<button type="button" data-key="panel:${p.id}" data-panel="${p.id}" aria-pressed="${p.id === page}"><svg class="journal-tab-icon" viewBox="0 0 24 24" aria-hidden="true">${p.icon}</svg><span class="journal-tab-label">${p.label}</span>${p.key ? `<kbd data-device="keyboard">${p.key.slice(3)}</kbd>` : ''}</button>`).join('')}<kbd data-tab-key="next" data-glyph="next"></kbd></nav>
      <div class="journal-content" data-page="${page}">${content}</div>
      <p class="sheet-help" data-glyph-template="{prev} / {next} · Sección  ·  {arrows} · Elegir  ·  {confirm} · Usar  ·  {cancel} · Volver al juego"></p>`;
    point(sheet, sheet.el.querySelector<HTMLButtonElement>(`[data-key="${sheet.cursor}"]`) ?? sheet.el.querySelector<HTMLButtonElement>(`[data-panel="${page}"], [data-map-back]`)!);
  }
  /** Who wore what at the last redraw, so a change of ánima lights up that member's face. */
  let seen: Seen = new Map();
  const remember = () => { seen = new Map(story.party.map(m => [m.id, m.classId])); };
  function render() {
    updateAvatar();
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
  /** The map page at Barcelona's scale (`world`) or the local one. */
  function showMap(sheet: Sheet, world: boolean) {
    sheet.world = world;
    if (sheet.page === 'map') renderSheet(sheet); else show('map', sheet.player);
  }
  /** Back out one step: from Barcelona to the local map, otherwise close the half. */
  function back(sheet: Sheet) {
    if (sheet.page === 'map' && sheet.world) showMap(sheet, false); else close(sheet.player);
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
    const { wear, classId, panel, mapLevel } = button.dataset;
    if (wear && classId) sheet.viewing = classId as ClassId;
    if (mapLevel) showMap(sheet, mapLevel === 'world');
    else if (button.hasAttribute('data-map-back')) back(sheet);
    else if (wear) callbacks.wear(wear as MemberId, (classId || null) as ClassId | null);
    else if (panel) show(panel as PanelId, sheet.player);
    else if (button.hasAttribute('data-close')) close(sheet.player);
  }
  // Each menu has its own way in; both give focus back to the world when they close.
  dock.querySelector('[data-user-menu]')!.addEventListener('click', () => { document.querySelector<HTMLElement>('#game')?.focus({ preventScroll: true }); toggle('character'); });
  dock.querySelector('[data-pause-menu]')!.addEventListener('click', () => { document.querySelector<HTMLElement>('#game')?.focus({ preventScroll: true }); callbacks.openMenu(); });
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
      if (event.repeat) return;
      if (shortcut.id === 'map' && (event.shiftKey || own.world)) showMap(own, event.shiftKey && !(own.page === 'map' && own.world));
      else { if (shortcut.id === 'map') own.world = false; toggle(shortcut.id); }
      return;
    }
    // Tab opens Gerard's user menu; inside it, Tab walks its buttons.
    if (!own.page && event.code === 'Tab' && !event.shiftKey) {
      if (blocked()) return;
      event.preventDefault(); event.stopImmediatePropagation();
      if (!event.repeat) show('character');
      return;
    }
    if (!own.page) return;
    const handled = event.key === 'Escape' || event.code === 'KeyQ' || event.code === 'KeyE' || arrows[event.code] || event.key === 'Tab';
    if (!handled) return;
    event.preventDefault(); event.stopImmediatePropagation();
    if (event.key === 'Escape') { if (!event.repeat) back(own); }
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
      if (action === 'cancel') back(sheet);
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
