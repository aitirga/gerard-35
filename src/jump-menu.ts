import { ANIMAS, ANIMA_IDS, type AnimaId } from './animas';
import type { ClassId, Encounter } from './battle';
import type { FightMoment } from './battle-ui';
import { CLASSES } from './classes';
import type { EnvironmentId } from './environments';
import { STORY_ARCS, isChapter2, missionsDone, type Arc } from './story-points';
import type { StoryFlag } from './story';

/**
 * The place panel's picker: the places to go to and, in development, story points to jump to and
 * a fight tester (docs/dev-tools.md). A non-modal dialog under the panel, so the street stays in view.
 */
interface Place { id: EnvironmentId; name: string; detail: string; group: string; open: boolean }
/** `open`: reachable from the picker in production too (the places the old dropdown offered). */
const PLACES: Place[] = [
  { id: 'maresme', name: 'Passatge Maresme', detail: 'La calle de casa', group: 'Sant Quirze del Vallès', open: true },
  { id: 'home-entrance', name: 'Casa de Gerard · Entrada', detail: 'Passatge Maresme, 20', group: 'Sant Quirze del Vallès', open: false },
  { id: 'home-floor-1', name: 'Casa de Gerard · Planta 1', detail: 'Passatge Maresme, 20', group: 'Sant Quirze del Vallès', open: false },
  { id: 'home-floor-2', name: 'Casa de Gerard · Planta 2', detail: 'Passatge Maresme, 20', group: 'Sant Quirze del Vallès', open: false },
  { id: 'palacio', name: 'Palacio de la Reina Bubbaloo', detail: 'Al final de la calle', group: 'Sant Quirze del Vallès', open: false },
  { id: 'meridiana', name: 'Meridiana · Casa de Gerard y Aitor', detail: 'El piso', group: 'Barcelona', open: true },
  { id: 'meridiana-calle', name: 'Avinguda Meridiana', detail: 'La calle del piso', group: 'Barcelona', open: true },
  { id: 'rec-comtal', name: 'Escola Rec Comtal', detail: 'Trinitat Vella', group: 'Barcelona', open: true },
  { id: 'cardedeu', name: 'Cardedeu · Jacint Verdaguer', detail: 'La calle de Nuria, de la estación al centro', group: 'Cardedeu', open: false },
  { id: 'cardedeu-laberinto', name: 'La torre de Uri', detail: 'A la vuelta de la esquina', group: 'Cardedeu', open: false },
  { id: 'bunkers-carmel', name: 'Búnkers del Carmel', detail: 'Turó de la Rovira', group: 'Barcelona', open: false },
  { id: 'barceloneta', name: 'La Barceloneta', detail: 'La playa · L4', group: 'Barcelona', open: true },
  { id: 'alegia', name: 'Alegia · San Juan kalea', detail: 'Según el mapa', group: 'Otros lugares', open: true },
  { id: 'patio', name: 'El patio', detail: 'Prueba de movimiento', group: 'Otros lugares', open: true },
];
export const placeName = (id: EnvironmentId) => PLACES.find(p => p.id === id)?.name ?? id;

/** Days of chapter 2 to wake up on (7 is the last). */
const DAYS = [1, 2, 3, 4, 5, 6, 7];

export type FightEncounter = 'dogs' | 'possessed' | 'palace-minion' | 'palace-guards';
/** What the fight tester starts: who fights, wearing what, against whom, and the help it gives. */
export interface FightSetup {
  adult: boolean; partner: boolean;
  wear: { gerard?: ClassId; aitor?: ClassId };
  animas: ClassId[]; friends: AnimaId[];
  encounter: FightEncounter; foes: number;
  /** Skills cost no PM. */
  free: boolean;
  /** No blow takes the party's PV. */
  immune: boolean;
}
/** The help any fight gets in development, the story's too. */
export type FightHelp = Pick<FightSetup, 'free' | 'immune'>;
const CLASS_IDS = Object.keys(CLASSES) as ClassId[];
export const DEFAULT_FIGHT: FightSetup = { adult: false, partner: true, wear: { gerard: 'matemagico' }, animas: [...CLASS_IDS], friends: [], encounter: 'dogs', foes: 3, free: true, immune: false };
/** Whatever was stored or passed in a URL, as a setup the tester can start. */
export function validFight(value: unknown): FightSetup {
  const v: Partial<FightSetup> = value && typeof value === 'object' ? value as Partial<FightSetup> : DEFAULT_FIGHT;
  const isClass = (id: unknown): id is ClassId => typeof id === 'string' && (CLASS_IDS as string[]).includes(id);
  const animas = Array.isArray(v.animas) ? CLASS_IDS.filter(id => v.animas!.includes(id)) : DEFAULT_FIGHT.animas;
  const wear = { gerard: isClass(v.wear?.gerard) && animas.includes(v.wear.gerard) ? v.wear.gerard : undefined, aitor: isClass(v.wear?.aitor) && animas.includes(v.wear.aitor) ? v.wear.aitor : undefined };
  const adult = v.adult === true;
  // The palace minion is chapter 1's fight: the boys, always together.
  const encounter = (['dogs', 'possessed', 'palace-minion', 'palace-guards'] as const).find(e => e === v.encounter) ?? 'dogs';
  return {
    adult, partner: encounter === 'palace-minion' ? true : v.partner !== false,
    wear, animas, friends: Array.isArray(v.friends) ? ANIMA_IDS.filter(id => v.friends!.includes(id)) : [],
    encounter: adult && encounter === 'palace-minion' ? 'dogs' : encounter,
    foes: Number.isInteger(v.foes) ? Math.max(1, Math.min(4, v.foes!)) : DEFAULT_FIGHT.foes,
    free: v.free !== false, immune: v.immune === true,
  };
}
const fightKey = 'gerard35.fight.v1';

type Tab = 'places' | 'story' | 'fight';
export interface JumpMenuDev {
  /** The story's flags now, to mark where it is. */
  flags: () => readonly StoryFlag[];
  day: () => number;
  /** Starts over at a story point (`new` for the very beginning); in chapter 2, on a day and with those ánima missions done. */
  story: (at: StoryFlag | 'new', day?: number, missions?: AnimaId[]) => void;
  fight: (setup: FightSetup) => void;
  /** The fight on now, if any: what it is and whether it can jump (only on a player's turn). */
  current: () => { encounter: Encounter; phase: string; awakened: boolean; busy: boolean } | undefined;
  help: () => FightHelp;
  setHelp: (help: FightHelp) => void;
  jumpTo: (moment: FightMoment) => void;
  /** Leaves the fight now, with no result and no story. */
  leave: () => void;
  /** Whether walls and tall furniture fold away while they hide Gerard. */
  folding: () => boolean;
  setFolding: (on: boolean) => void;
}

export function createJumpMenu(panel: HTMLElement, callbacks: { travel: (id: EnvironmentId) => void; open: (open: boolean) => void; dev?: JumpMenuDev }) {
  const trigger = panel.querySelector<HTMLButtonElement>('#environment')!;
  const dev = callbacks.dev;
  const root = document.createElement('dialog');
  root.id = 'jump-menu'; root.setAttribute('aria-label', dev ? 'Saltar a un lugar, un punto de la historia o un combate' : 'Elegir lugar');
  panel.append(root);
  let place: EnvironmentId = 'maresme';
  let tab: Tab = 'places';
  let fight = DEFAULT_FIGHT;
  try { fight = validFight(JSON.parse(localStorage.getItem(fightKey) ?? 'null')); } catch { /* Storage is optional. */ }
  let day = 1;
  /** Ánima missions a chapter 2 jump starts with done; until chosen, the ones the story has. */
  let missions: AnimaId[] | undefined;
  let returnFocus: HTMLElement | undefined;
  const escape = (text: string) => text.replace(/[&<>"]/g, c => `&#${c.charCodeAt(0)};`);

  function placesPage(filter: string) {
    const words = filter.trim().toLowerCase();
    const shown = PLACES.filter(p => (dev || p.open) && (!words || `${p.name} ${p.detail} ${p.group}`.toLowerCase().includes(words)));
    const groups = [...new Set(shown.map(p => p.group))];
    const folds = dev ? `<div class="jump-row" role="group" aria-label="Paredes que se pliegan"><span>Paredes que se pliegan</span>${[['1', 'Sí'], ['0', 'No']].map(([v, label]) => `<button type="button" data-folds="${v}" aria-pressed="${dev.folding() === (v === '1')}">${label}</button>`).join('')}</div>` : '';
    return folds + (groups.length ? groups.map(group => `<section class="jump-group"><h3 class="eyebrow">${escape(group.toUpperCase())}</h3>${shown.filter(p => p.group === group).map(p => `
      <button type="button" class="jump-item" data-place="${p.id}" ${p.id === place ? 'aria-current="true"' : ''}>
        <strong>${escape(p.name)}</strong><small>${escape(p.detail)}${dev && !p.open ? ' · solo depuración' : ''}</small>
      </button>`).join('')}</section>`).join('') : '<p class="jump-empty">Ningún lugar se llama así.</p>');
  }
  function storyPage() {
    const flags = dev!.flags(), last = flags.at(-1);
    const done = missions ??= missionsDone(flags);
    const beat = (flag: StoryFlag, label: string, n: number, all: readonly StoryFlag[]) => `<button type="button" class="jump-item jump-beat" data-beat="${flag}" ${last && all.includes(last) ? 'aria-current="true"' : ''} ${all.every(f => flags.includes(f)) ? 'data-done' : ''}>
      <span class="jump-step">${n}</span><strong>${escape(label)}</strong><code>${flag}</code></button>`;
    const arc = (a: Arc) => `<div class="jump-arc" role="group" aria-label="${escape(a.title)}">
      <h4><span>${escape(a.title)}</span><small>${escape(a.detail)}</small></h4>
      ${a.steps.map((s, i) => beat(s.flags[0], s.label, i + 1, s.flags)).join('')}</div>`;
    const chapter = (n: 1 | 2, missions: boolean) => STORY_ARCS.filter(a => a.chapter === n && 'anima' in a === missions).map(arc).join('');
    return `
      <section class="jump-group"><h3 class="eyebrow">CAPÍTULO 1 · SANT QUIRZE</h3>
        <button type="button" class="jump-item jump-beat" data-beat="new" ${!flags.length ? 'aria-current="true"' : ''}><span class="jump-step">0</span><strong>Desde el principio</strong><code>new</code></button>
        ${chapter(1, false)}</section>
      <section class="jump-group"><h3 class="eyebrow">CAPÍTULO 2 · BARCELONA</h3>
        <div class="jump-row" role="group" aria-label="Día al saltar al capítulo 2"><span>Día</span>${DAYS.map(d => `<button type="button" data-day="${d}" aria-pressed="${d === day}">${d}</button>`).join('')}</div>
        <div class="jump-row" role="group" aria-label="Misiones hechas al saltar al capítulo 2"><span>Con ánimas</span>${ANIMA_IDS.map(id => `<button type="button" data-mission="${id}" aria-pressed="${done.includes(id)}">${escape(ANIMAS[id].friend)}</button>`).join('')}</div>
        ${chapter(2, false)}</section>
      <section class="jump-group"><h3 class="eyebrow">CAPÍTULO 2 · MISIONES DE ÁNIMA</h3>
        ${chapter(2, true)}
        <p class="jump-note">Cada misión va por su cuenta: solo lleva lo que necesita y las ánimas marcadas arriba.</p></section>
      <p class="jump-note">Recarga la partida en ese punto, donde pasa, sin guardar nada.</p>`;
  }
  /** During a fight: the help it gets, the moments it can jump to, and the way out. */
  function livePage() {
    const now = dev!.current()!, help = dev!.help();
    const ready = now.phase === 'player' && !now.busy;
    const moment = (id: FightMoment, label: string, disabled = false) => `<button type="button" data-moment="${id}" ${!ready || disabled ? 'disabled' : ''}>${label}</button>`;
    return `
      <p class="jump-note jump-live">Combate en curso · ${escape(({ dogs: 'perros', 'palace-minion': 'el esbirro', 'palace-guards': 'guardianes de chicle' } as Record<Encounter, string>)[now.encounter])}</p>
      <div class="fight-row"><span>Ayudas</span><div class="fight-chips">
        <button type="button" data-help="immune" aria-pressed="${help.immune}">Inmunidad</button><button type="button" data-help="free" aria-pressed="${help.free}">PM infinitos</button></div></div>
      <div class="fight-row"><span>Saltar a</span><div class="fight-chips">
        ${moment('won', 'Victoria')}${moment('lost', 'Derrota')}${moment('foes-low', 'Enemigos a 1 PV')}${moment('party-low', 'Equipo a 1 PV')}
        ${now.encounter === 'palace-minion' ? moment('beat', 'El «¡NO!» de Gerard', now.awakened) : ''}</div></div>
      ${ready ? '' : '<p class="jump-note">Los saltos esperan al turno de un jugador.</p>'}
      <button type="button" class="jump-go jump-leave" data-leave>Salir del combate</button>
      <p class="jump-note">Salir no cuenta para la historia. Un lugar de «Lugares» también sale del combate.</p>`;
  }
  function fightPage() {
    if (dev!.current()) return livePage();
    const f = fight;
    const chip = (name: string, value: string, label: string, on: boolean, disabled = false) => `<button type="button" data-${name}="${value}" aria-pressed="${on}" ${disabled ? 'disabled' : ''}>${escape(label)}</button>`;
    const wearRow = (member: 'gerard' | 'aitor', label: string) => `<div class="fight-row"><span>${label}</span><div class="fight-chips">
      ${chip(`wear-${member}`, '', 'Sin ánima', !f.wear[member])}${f.animas.map(id => chip(`wear-${member}`, id, f.adult || member === 'aitor' ? CLASSES[id].name : CLASSES[id].child?.name ?? CLASSES[id].name, f.wear[member] === id)).join('')}</div></div>`;
    const guards = f.encounter === 'palace-guards', dogs = f.encounter === 'dogs' || f.encounter === 'possessed';
    return `
      <div class="fight-row"><span>Época</span><div class="fight-chips">${chip('adult', '0', 'Capítulo 1 · niños', !f.adult)}${chip('adult', '1', 'Capítulo 2 · a los 35', f.adult)}</div></div>
      <div class="fight-row"><span>Equipo</span><div class="fight-chips">${chip('partner', '0', 'Gerard solo', !f.partner, f.encounter === 'palace-minion')}${chip('partner', '1', f.adult ? 'Gerard y Aitor' : 'Gerard y Bernat', f.partner)}</div></div>
      <div class="fight-row"><span>Ánimas</span><div class="fight-chips">${CLASS_IDS.map(id => chip('anima', id, CLASSES[id].name, f.animas.includes(id))).join('')}</div></div>
      ${wearRow('gerard', 'Gerard lleva')}
      ${f.adult && f.partner ? wearRow('aitor', 'Aitor lleva') : ''}
      ${f.adult ? `<div class="fight-row"><span>Amigos</span><div class="fight-chips">${ANIMA_IDS.map(id => chip('friend', id, ANIMAS[id].friend, f.friends.includes(id))).join('')}</div></div>` : ''}
      <div class="fight-row"><span>Contra</span><div class="fight-chips">
        ${chip('encounter', 'dogs', 'Perros', f.encounter === 'dogs')}${chip('encounter', 'possessed', 'Perros poseídos', f.encounter === 'possessed')}
        ${chip('encounter', 'palace-minion', 'El esbirro', f.encounter === 'palace-minion', f.adult)}${chip('encounter', 'palace-guards', 'Guardianes de chicle', guards)}</div></div>
      ${dogs ? `<div class="fight-row"><span>Cuántos</span><div class="fight-chips">${[1, 2, 3, 4].map(n => chip('foes', String(n), String(n), f.foes === n)).join('')}</div></div>` : ''}
      ${guards ? '<p class="jump-note">Los guardianes son tantos y tan fuertes como dejan las ánimas de los amigos.</p>' : ''}
      <div class="fight-row"><span>Ayudas</span><div class="fight-chips">${chip('immune', '1', 'Inmunidad', f.immune)}${chip('free', '1', 'PM infinitos', f.free)}</div></div>
      <button type="button" class="jump-go" data-start>Empezar combate</button>
      <p class="jump-note">No cuenta para la historia. Cambiar de época recarga la partida.</p>`;
  }
  function render(focus?: string) {
    const filter = root.querySelector<HTMLInputElement>('.jump-search')?.value ?? '';
    root.innerHTML = `
      ${dev ? `<nav class="jump-tabs" role="tablist">${([['places', 'Lugares'], ['story', 'Historia'], ['fight', 'Combate']] as const).map(([id, label]) => `<button type="button" role="tab" data-tab="${id}" aria-selected="${tab === id}">${label}</button>`).join('')}</nav>` : ''}
      ${tab === 'places' ? `<input class="jump-search" type="search" placeholder="Buscar lugar" aria-label="Buscar lugar" value="${escape(filter)}" autocomplete="off">` : ''}
      <div class="jump-body" data-page="${tab}">${tab === 'places' ? placesPage(filter) : tab === 'story' ? storyPage() : fightPage()}</div>`;
    if (focus) root.querySelector<HTMLElement>(focus)?.focus({ preventScroll: true });
  }
  function setFight(change: Partial<FightSetup>) {
    fight = validFight({ ...fight, ...change });
    try { localStorage.setItem(fightKey, JSON.stringify(fight)); } catch { /* Storage is optional. */ }
  }
  function show(next: Tab = tab) {
    tab = next;
    // In a fight everything outside it is inert, so the picker opens inside it.
    const host = document.querySelector('#hud[data-battle] #battle') ?? panel;
    if (root.parentElement !== host) { if (root.open) root.close(); host.append(root); }
    render();
    if (!root.open) {
      // Focus goes back where it was: the street, or the fight's commands.
      const active = document.activeElement as HTMLElement | null;
      returnFocus = active && active !== document.body && !active.closest('[data-jump-trigger]') ? active : undefined;
      root.show(); trigger.setAttribute('aria-expanded', 'true'); callbacks.open(true);
    }
    (root.querySelector<HTMLElement>('.jump-search') ?? root.querySelector<HTMLElement>('[aria-current="true"]') ?? root.querySelector<HTMLElement>('.jump-body button'))?.focus({ preventScroll: true });
  }
  function close() {
    if (!root.open) return;
    root.close(); trigger.setAttribute('aria-expanded', 'false'); callbacks.open(false);
    const back = returnFocus?.isConnected && !returnFocus.closest('[inert]') ? returnFocus : document.querySelector<HTMLElement>('#hud[data-battle] #battle') ?? document.querySelector<HTMLElement>('#game');
    back?.focus({ preventScroll: true });
  }

  trigger.addEventListener('click', () => root.open ? close() : show());
  root.addEventListener('input', event => {
    if (!(event.target as HTMLElement).matches('.jump-search')) return;
    root.querySelector('.jump-body')!.innerHTML = placesPage((event.target as HTMLInputElement).value);
  });
  root.addEventListener('click', event => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button');
    if (!button || button.disabled) return;
    const data = button.dataset;
    if (data.tab) { tab = data.tab as Tab; render(`[data-tab="${tab}"]`); return; }
    if (data.place) { close(); if (data.place !== place) callbacks.travel(data.place as EnvironmentId); return; }
    if (data.beat) {
      close();
      const at = data.beat as StoryFlag | 'new', later = at !== 'new' && isChapter2(at);
      dev!.story(at, later ? day : undefined, later ? missions : undefined);
      return;
    }
    if (data.folds) { dev!.setFolding(data.folds === '1'); render(`[data-folds="${data.folds}"]`); return; }
    if (data.day) { day = Number(data.day); render(`[data-day="${day}"]`); return; }
    if (data.mission) { const id = data.mission as AnimaId; missions = missions?.includes(id) ? missions.filter(m => m !== id) : [...missions ?? [], id]; render(`[data-mission="${id}"]`); return; }
    if (data.start !== undefined) { close(); dev!.fight(fight); return; }
    if (data.leave !== undefined) { close(); dev!.leave(); return; }
    if (data.moment) { close(); dev!.jumpTo(data.moment as FightMoment); return; }
    if (data.help) { const help = dev!.help(), key = data.help as keyof FightHelp; dev!.setHelp({ ...help, [key]: !help[key] }); render(`[data-help="${key}"]`); return; }
    const key = Object.keys(data)[0];
    if (!key) return;
    const value = data[key]!;
    const toggle = <T extends string>(list: T[], id: T) => list.includes(id) ? list.filter(x => x !== id) : [...list, id];
    if (key === 'adult') setFight({ adult: value === '1' });
    else if (key === 'partner') setFight({ partner: value === '1' });
    else if (key === 'anima') setFight({ animas: toggle(fight.animas, value as ClassId) });
    else if (key === 'friend') setFight({ friends: toggle(fight.friends, value as AnimaId) });
    else if (key === 'wearGerard') setFight({ wear: { ...fight.wear, gerard: (value || undefined) as ClassId | undefined } });
    else if (key === 'wearAitor') setFight({ wear: { ...fight.wear, aitor: (value || undefined) as ClassId | undefined } });
    else if (key === 'encounter') setFight({ encounter: value as FightEncounter });
    else if (key === 'foes') setFight({ foes: Number(value) });
    else if (key === 'free') setFight({ free: !fight.free });
    else if (key === 'immune') setFight({ immune: !fight.immune });
    else return;
    // Keep focus on the same chip after the page redraws.
    render(`[data-${key.replace(/[A-Z]/g, c => `-${c.toLowerCase()}`)}="${value}"]`);
  });
  root.addEventListener('keydown', event => {
    // Keys stay in the picker: a fight under it must not hear them.
    event.stopPropagation();
    if (event.key === 'Escape') { event.preventDefault(); close(); return; }
    // Up and down walk the rows (the search box, each place or beat, each row of chips); left and
    // right walk within a row: the tabs, the chips, the days.
    const step = event.key === 'ArrowDown' || event.key === 'ArrowRight' ? 1 : event.key === 'ArrowUp' || event.key === 'ArrowLeft' ? -1 : 0;
    if (!step) return;
    const active = document.activeElement as HTMLElement | null;
    const enabled = (scope: Element) => [...scope.querySelectorAll<HTMLElement>('button:not([disabled])')];
    let next: HTMLElement | undefined;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      const row = active?.closest('.jump-tabs, .fight-chips, .jump-row');
      if (!row) return;
      const items = enabled(row);
      next = items[(items.indexOf(active!) + step + items.length) % items.length];
    } else {
      const rows = [...root.querySelectorAll<HTMLElement>('.jump-search, .jump-item, .fight-chips, .jump-row, .jump-go')];
      const at = rows.findIndex(row => row === active || row.contains(active));
      const row = rows[(at + step + rows.length) % rows.length];
      next = row?.matches('.fight-chips, .jump-row') ? row.querySelector<HTMLElement>('[aria-pressed="true"]:not([disabled])') ?? enabled(row)[0] : row;
    }
    if (!next) return;
    event.preventDefault();
    next.focus({ preventScroll: true });
    if (next.matches('[data-tab]')) next.click();
  });
  const outside = (event: PointerEvent) => { if (root.open && !root.contains(event.target as Node) && !(event.target as HTMLElement).closest?.('[data-jump-trigger]')) close(); };
  window.addEventListener('pointerdown', outside, true);

  return {
    get isOpen() { return root.open; },
    /** Shows where the player is now, on the trigger and in the list. */
    setPlace(id: EnvironmentId) {
      place = id;
      trigger.querySelector('.place-name')!.textContent = placeName(id);
      if (root.open && tab === 'places') render();
    },
    /** Development: the day chapter 2 jumps wake up on. */
    setDay(value: number) { day = Math.max(1, Math.min(7, value)); },
    open: show, close,
    toggle(next?: Tab) { if (root.open) close(); else show(next); },
    destroy() { window.removeEventListener('pointerdown', outside, true); root.remove(); },
  };
}
