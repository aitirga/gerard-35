import { ELEMENTS, MANA_POINTS, type ClassId, type Element as AttackElement } from './battle';
import { animaOf, CLASSES } from './classes';
import { isDpad, type ControllerEvent } from './controller';
import { ELEMENT_ICONS, IMPROVEMENTS, costOf, improvementOf, type Improvement } from './ecos';
import { nearestButton } from './menu-nav';
import type { Direction } from './movement';
import type { SoundId } from './sfx';
import type { Story } from './story';

/**
 * The jar at home (docs/animas/README.md § Ecos de luz): the one place the party's Ecos de luz are
 * put into its ánimas and taken back. On the left the jar itself, a marble per eco, lit while it is
 * free and dark, tinted by where it went, once it is in. On the right the ánimas, one page each,
 * every improvement a card with as many glass sockets as it costs: an eco flies out of the jar and
 * drops into each. Moves and buttons read the device in use (input-glyphs.ts).
 */
const escape = (text: string) => text.replace(/[&<>"]/g, c => `&#${c.charCodeAt(0)};`);
const svg = (paths: string) => `<svg viewBox="0 0 16 16" aria-hidden="true">${paths}</svg>`;
/** The drawing of each kind of card that is not an element. */
const KIND_ICONS = {
  mana: '<circle cx="8" cy="8" r="5.6" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="8" cy="8" r="2.5"/>',
  passive: '<path d="M8 1.5 14 4v4.2c0 3.2-2.5 5.4-6 6.3-3.5-.9-6-3.1-6-6.3V4z" fill="none" stroke="currentColor" stroke-width="1.5"/>',
  ulti: '<path d="M8 1.2 9.9 6l5 .4-3.8 3.2 1.2 5L8 11.9l-4.3 2.7 1.2-5L1.1 6.400l5-.4z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>',
};
const iconOf = (item: Improvement) => item.element ? ELEMENT_ICONS[item.element] : KIND_ICONS[item.kind as keyof typeof KIND_ICONS];
const colourOf = (item: Improvement) => item.element ? ELEMENTS[item.element].colour : CLASSES[item.anima].colour;
const ecoWord = (n: number) => n === 1 ? 'eco' : 'ecos';
/** What each element turns, on its card (battle.ts `react`): in the colours the fight says them in. */
const TURNS: Record<AttackElement, [{ name: string; colour: string }, { name: string; colour: string }]> = {
  agua: [{ name: 'Quemado', colour: '#ffb054' }, { name: 'Cegado', colour: '#c7ccd4' }],
  fuego: [{ name: 'Sangrado', colour: '#ff6b6b' }, { name: 'Cauterizado', colour: '#ff9b5a' }],
  electrico: [{ name: 'Cegado', colour: '#c7ccd4' }, { name: 'Tormenta', colour: '#ffe45c' }],
};

export function createJarUI(hud: HTMLElement, story: Story, callbacks: { pause: (paused: boolean) => void; sound: (id: SoundId) => void; changed: () => void }) {
  const root = document.createElement('section');
  root.id = 'jar-panel'; root.hidden = true; root.tabIndex = -1;
  root.setAttribute('role', 'dialog'); root.setAttribute('aria-label', 'El bote de las luces');
  hud.append(root);
  let open = false, openedAt = 0;
  let page: ClassId | undefined;
  let cursor: string | undefined;
  /** What just went in: its sockets fill as the eco lands. */
  let landing: string | undefined;
  let closed: (() => void) | undefined;
  const pages = () => story.classes;
  const stateOf = (item: Improvement) => story.improvements.includes(item.id) ? 'on'
    : item.veiled ? 'veiled'
    : item.after && !story.improvements.includes(item.after) ? 'needs'
    : item.cost > story.ecosFree ? 'short' : 'open';

  /** A marble per eco, packed from the bottom of the jar: the ones in an ánima below, tinted by where they went; the free ones on top. */
  function marbles() {
    const spent = story.improvements.flatMap(id => { const item = improvementOf(id)!; return Array.from({ length: item.cost }, () => colourOf(item)); });
    const all = [...spent.map(where => ({ where })), ...Array.from({ length: Math.max(0, story.ecosFree) }, () => ({ where: '' }))];
    let row = 0, inRow = 0;
    return all.map(({ where }, i) => {
      const wide = row % 2 ? 3 : 4;
      const x = 50 + (inRow - (wide - 1) / 2) * 19, y = 5 + row * 15.5;
      if (++inRow === wide) { row++; inRow = 0; }
      return `<i class="jar-marble" ${where ? 'data-in' : 'data-free'} style="--x:${x.toFixed(1)}%;--y:${y.toFixed(1)}%;--i:${i};${where ? `--where:${where}` : ''}"></i>`;
    }).join('');
  }
  function jarColumn() {
    const free = story.ecosFree, total = story.ecos, used = total - free;
    return `<aside class="jar-side">
      <header><span class="battle-kicker">EN CASA · EL SALÓN</span><h1>El bote <em>de las luces</em></h1></header>
      <div class="jar-vessel" style="--glow:${(total ? Math.min(1, free / Math.max(3, total)) : 0).toFixed(2)}">
        <div class="jar-halo"></div>
        <svg class="jar-back" viewBox="0 0 240 300" aria-hidden="true"><defs>
          <linearGradient id="jar-glass" x1="0" x2="1"><stop offset="0" stop-color="#cfe9f2" stop-opacity=".2"/><stop offset=".22" stop-color="#cfe9f2" stop-opacity=".05"/><stop offset=".8" stop-color="#cfe9f2" stop-opacity=".04"/><stop offset="1" stop-color="#cfe9f2" stop-opacity=".2"/></linearGradient>
          <linearGradient id="jar-cork" x1="0" x2="1"><stop offset="0" stop-color="#8b6538"/><stop offset=".45" stop-color="#c79c67"/><stop offset="1" stop-color="#7c5a33"/></linearGradient></defs>
          <path d="M72 54h96v10c0 10 26 20 38 44 8 16 10 34 10 52v92c0 26-18 42-44 42H68c-26 0-44-16-44-42v-92c0-18 2-36 10-52 12-24 38-34 38-44z" fill="url(#jar-glass)"/>
        </svg>
        <div class="jar-marbles">${marbles()}</div>
        <svg class="jar-front" viewBox="0 0 240 300" aria-hidden="true">
          <path d="M72 54h96v10c0 10 26 20 38 44 8 16 10 34 10 52v92c0 26-18 42-44 42H68c-26 0-44-16-44-42v-92c0-18 2-36 10-52 12-24 38-34 38-44z" fill="none" stroke="#dff2f8" stroke-opacity=".5" stroke-width="2"/>
          <path d="M42 150c0-18 3-30 9-42 4-8 11-14 18-19" fill="none" stroke="#fff" stroke-opacity=".5" stroke-width="5" stroke-linecap="round"/>
          <path d="M40 176v44" fill="none" stroke="#fff" stroke-opacity=".28" stroke-width="5" stroke-linecap="round"/>
          <path d="M198 206v38c0 12-5 20-14 25" fill="none" stroke="#fff" stroke-opacity=".16" stroke-width="4" stroke-linecap="round"/>
          <rect x="64" y="46" width="112" height="13" rx="6" fill="#dff2f8" fill-opacity=".22" stroke="#dff2f8" stroke-opacity=".5" stroke-width="1.5"/>
          <path d="M76 14h88c4 0 6 2 6 6l-4 28H74l-4-28c0-4 2-6 6-6z" fill="url(#jar-cork)"/>
          <path d="M84 22h6M104 30h8M128 20h5M146 34h7M92 40h5M120 40h4M152 24h4" stroke="#5e4325" stroke-opacity=".6" stroke-width="2" stroke-linecap="round"/>
        </svg>
      </div>
      <p class="jar-count"><strong>${free}</strong><span>${free === 1 ? 'eco libre' : 'ecos libres'}${used ? `<small>${used} ${used === 1 ? 'puesto' : 'puestos'} en las ánimas</small>` : ''}</span></p>
      <p class="jar-note">Aquí dentro se pueden mover siempre que queráis. Fuera de casa, no.</p>
      <button type="button" class="jar-reset" data-key="reset" data-jar-reset ${used ? '' : 'disabled'}>Recoger todos los ecos</button>
    </aside>`;
  }
  /** The card's own line: what an element turns, the maná it leaves, or that it still sleeps. */
  function cardLine(item: Improvement) {
    if (item.element) { const [from, to] = TURNS[item.element]; return `<span class="jar-turns"><b style="--c:${from.colour}">${from.name}</b><i aria-hidden="true">→</i><b style="--c:${to.colour}">${to.name}</b></span>`; }
    if (item.kind === 'mana') {
      const before = IMPROVEMENTS.filter(other => other.anima === item.anima && other.kind === 'mana').findIndex(other => other.id === item.id);
      return `<span class="jar-pips" role="img" aria-label="Maná ${MANA_POINTS + before + 1}">${'<i></i>'.repeat(MANA_POINTS + before)}<i data-extra></i></span>`;
    }
    return '<span class="jar-asleep">Todavía duerme</span>';
  }
  /** A card: its drawing, its name, its line and one socket per eco it costs. */
  function card(item: Improvement) {
    const state = stateOf(item), on = state === 'on', veiled = state === 'veiled';
    return `<button type="button" class="jar-card" data-key="${item.id}" data-improve="${item.id}" data-kind="${item.kind}" data-state="${state}" ${landing === item.id ? 'data-landing' : ''} aria-pressed="${on}" ${on || state === 'open' ? '' : 'aria-disabled="true"'} style="--item:${colourOf(item)}">
      <span class="jar-card-head"><span class="jar-card-icon">${veiled ? '<b>?</b>' : svg(iconOf(item))}</span><strong>${escape(item.name)}</strong></span>
      ${cardLine(item)}
      <span class="jar-sockets" role="img" aria-label="${item.cost} ${ecoWord(item.cost)}">${'<i></i>'.repeat(item.cost)}</span>
    </button>`;
  }
  function animaPage(id: ClassId) {
    const spec = animaOf(id, story.adult), items = IMPROVEMENTS.filter(item => item.anima === id);
    const group = (kind: Improvement['kind']) => items.filter(item => item.kind === kind);
    const most = story.manaOf(id);
    const pips = Array.from({ length: most }, (_, i) => `<i ${i >= MANA_POINTS ? 'data-extra' : ''}></i>`).join('');
    const elements = group('element');
    return `<header class="jar-anima"><div><span class="battle-kicker">ÁNIMA</span><h2>${escape(spec.name)}</h2><p>${escape(spec.motto)}</p></div>
        <div class="jar-mana" role="img" aria-label="Maná ${most}"><span class="battle-kicker">MANÁ</span><span class="jar-mana-pips">${pips}</span></div></header>
      <div class="jar-branches" data-elements="${elements.length ? 'true' : 'false'}">
        ${elements.length ? `<section class="jar-branch" data-branch="element"><h3>Elementos de Atacar</h3><div>${elements.map(card).join('')}</div></section>` : ''}
        <section class="jar-branch" data-branch="mana"><h3>Maná</h3><div>${group('mana').map(card).join('')}</div></section>
        <section class="jar-branch" data-branch="asleep"><h3>Lo que duerme</h3><div>${[...group('passive'), ...group('ulti')].map(card).join('')}</div></section>
      </div>`;
  }
  /** What the card under the cursor does, and what pressing it would do now. */
  function detail() {
    const item = cursor ? improvementOf(cursor) : undefined;
    if (!item) return '<p class="jar-detail-idle">Cada eco que pongas sale del bote. Si lo recoges, vuelve.</p>';
    const state = stateOf(item);
    const action = state === 'on' ? `{confirm} · Recoger ${item.cost} ${ecoWord(item.cost)}`
      : state === 'open' ? `{confirm} · Poner ${item.cost} ${ecoWord(item.cost)}` : '';
    const why = state === 'short' ? `Hacen falta ${item.cost} ${ecoWord(item.cost)} libres.`
      : state === 'needs' ? `Primero: ${improvementOf(item.after!)!.name}.`
      : state === 'veiled' ? 'Aún no se puede despertar.' : '';
    return `<div class="jar-detail-text"><strong>${escape(item.name)}</strong><p>${escape(item.description)}</p></div>${action ? `<span class="jar-detail-action" data-glyph-template="${action}"></span>` : `<span class="jar-detail-why">${escape(why)}</span>`}`;
  }
  function render() {
    const list = pages();
    if (!page || !list.includes(page)) page = list[0];
    root.innerHTML = `<div class="jar-room" aria-hidden="true"></div>
      ${jarColumn()}
      <main class="jar-board" data-anima="${page ?? ''}" style="--anima:${page ? CLASSES[page].colour : '#f3cf78'}">
        <nav class="jar-tabs" aria-label="Ánimas"><kbd data-glyph="prev"></kbd>${list.map(id => {
          const count = costOf(story.improvements.filter(i => improvementOf(i)?.anima === id));
          return `<button type="button" data-key="page:${id}" data-page="${id}" aria-pressed="${id === page}" style="--chip:${CLASSES[id].colour}"><i aria-hidden="true"></i>${escape(animaOf(id, story.adult).name)}${count ? `<small>${count}</small>` : ''}</button>`;
        }).join('')}<kbd data-glyph="next"></kbd>
          <button type="button" class="jar-close journal-close" data-key="close" data-jar-close data-back>Cerrar <kbd data-glyph="cancel"></kbd></button></nav>
        ${page ? animaPage(page) : '<p class="jar-empty">Ninguna ánima todavía.</p>'}
        <footer class="jar-detail" aria-live="polite">${detail()}</footer>
      </main>
      <p class="jar-help" data-glyph-template="{prev} / {next} · Ánima  ·  {arrows} · Elegir  ·  {confirm} · Poner o recoger  ·  {cancel} · Cerrar"></p>`;
    landing = undefined;
    point(root.querySelector<HTMLButtonElement>(`[data-key="${cursor}"]`) ?? root.querySelector<HTMLButtonElement>('.jar-card'));
  }
  const buttons = () => [...root.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')].filter(b => b.getClientRects().length);
  function point(button: HTMLButtonElement | null | undefined) {
    if (!button) return;
    root.querySelectorAll('.is-cursor').forEach(el => el.classList.remove('is-cursor'));
    button.classList.add('is-cursor'); cursor = button.dataset.key;
    button.focus({ preventScroll: true });
    const footer = root.querySelector('.jar-detail');
    if (footer) footer.innerHTML = detail();
  }
  function move(direction: Direction) {
    const list = buttons(), from = list.find(b => b.dataset.key === cursor);
    if (!from) { point(list[0]); return; }
    point(nearestButton(list, from, direction) as HTMLButtonElement | undefined);
  }
  function turn(step: 1 | -1) {
    const list = pages(), index = page ? list.indexOf(page) : 0;
    if (list.length < 2) return;
    page = list[(index + step + list.length) % list.length];
    cursor = undefined;
    render();
  }
  /** An eco crosses the screen, out of the jar and into `id`'s sockets, or back. */
  function fly(a: DOMRect | undefined, b: DOMRect | undefined, colour: string) {
    if (!a || !b || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const box = root.getBoundingClientRect();
    const eco = document.createElement('i');
    eco.className = 'jar-flight'; eco.style.setProperty('--where', colour); root.append(eco);
    const x0 = a.left + a.width / 2 - box.left, y0 = a.top + a.height / 2 - box.top, x1 = b.left + b.width / 2 - box.left, y1 = b.top + b.height / 2 - box.top;
    const lift = Math.min(y0, y1) - 70;
    const at = (x: number, y: number, s: number) => ({ transform: `translate(${x}px, ${y}px) translate(-50%, -50%) scale(${s})` });
    eco.animate([at(x0, y0, 1), { ...at((x0 + x1) / 2, lift, 1.35), offset: .5 }, at(x1, y1, .7)], { duration: 420, easing: 'cubic-bezier(.3,.05,.3,1)' }).finished.then(() => eco.remove(), () => eco.remove());
  }
  function press(button: HTMLButtonElement) {
    if (button.hasAttribute('data-jar-close')) { close(); return; }
    if (button.hasAttribute('data-jar-reset')) {
      story.clearImprovements(); callbacks.sound('clink'); callbacks.changed(); cursor = undefined; render();
      return;
    }
    if (button.dataset.page) { page = button.dataset.page as ClassId; cursor = button.dataset.key; render(); return; }
    const id = button.dataset.improve, item = id ? improvementOf(id) : undefined;
    if (!id || !item) return;
    const state = stateOf(item);
    if (state === 'on') {
      story.unimprove(id); callbacks.sound('glass-tick'); callbacks.changed(); render();
      fly(root.querySelector(`[data-improve="${id}"] .jar-sockets i`)?.getBoundingClientRect(), [...root.querySelectorAll('.jar-marble[data-free]')].at(-1)?.getBoundingClientRect(), colourOf(item));
    } else if (state === 'open') {
      const from = [...root.querySelectorAll('.jar-marble[data-free]')].at(-1)?.getBoundingClientRect();
      story.improve(id); landing = id; callbacks.changed(); render();
      fly(from, root.querySelector(`[data-improve="${id}"] .jar-sockets i:last-child`)?.getBoundingClientRect(), colourOf(item));
      callbacks.sound('clink');
    } else {
      button.classList.remove('is-stuck'); void button.offsetWidth; button.classList.add('is-stuck');
      callbacks.sound('denied');
    }
  }
  /** Opens the jar; resolves when it is closed, so the story's next beat waits for it. */
  function show() {
    if (open) return Promise.resolve();
    open = true; openedAt = performance.now(); cursor = undefined;
    root.hidden = false; hud.dataset.jar = 'open'; callbacks.pause(true);
    render();
    return new Promise<void>(resolve => { closed = resolve; });
  }
  function close() {
    if (!open) return;
    open = false; root.hidden = true; root.replaceChildren(); delete hud.dataset.jar; callbacks.pause(false);
    document.querySelector<HTMLElement>('#game')?.focus({ preventScroll: true });
    closed?.(); closed = undefined;
  }
  function control(action: ControllerEvent) {
    if (!open) return;
    if (action === 'cancel' || action === 'menu') close();
    else if (action === 'prev' || action === 'next') turn(action === 'prev' ? -1 : 1);
    else if (action === 'confirm') { const button = buttons().find(b => b.dataset.key === cursor); if (button) button.click(); }
    else if (action !== 'overview' && action !== 'character' && !isDpad(action)) move(action);
  }
  root.addEventListener('click', event => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button');
    if (button && !button.disabled) press(button);
  });
  root.addEventListener('pointerover', event => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button');
    if (button && !button.disabled && button.dataset.key !== cursor) point(button);
  });
  // Ahead of the game and the menu: while it is open the keys are its own.
  function keydown(event: KeyboardEvent) {
    if (!open || document.querySelector('dialog[open]')) return;
    const keys: Record<string, ControllerEvent> = {
      ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down',
      Space: 'confirm', Enter: 'confirm', Escape: 'cancel', KeyQ: 'prev', KeyE: 'next',
    };
    const action = keys[event.code];
    if (!action) return;
    event.preventDefault(); event.stopImmediatePropagation();
    // The press that opened it must not turn its page straight away.
    if (event.code === 'KeyE' && performance.now() - openedAt < 250) return;
    if (event.repeat && !['up', 'down', 'left', 'right'].includes(action)) return;
    control(action);
  }
  window.addEventListener('keydown', keydown, { capture: true });
  return {
    open: show, close, control,
    get isOpen() { return open; },
    destroy() { close(); window.removeEventListener('keydown', keydown, { capture: true }); root.remove(); },
  };
}
