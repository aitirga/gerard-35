import { CONTROL_ACTIONS, ControllerEdges, defaultProfile, idleController, isNintendo, readController, validProfile, type Binding, type ControlAction, type ControllerEvent, type ControllerProfile, type PadSnapshot } from './controller';
import type { Direction, Stick } from './movement';
import type { PanelId } from './exploration-ui';
import type { ControlMode, PlayerId } from './party';
import { padFamily, setInputDevice, setPlayer2Device } from './input-glyphs';

const labels: Record<ControlAction, string> = { up: 'Arriba', down: 'Abajo', left: 'Izquierda', right: 'Derecha', confirm: 'Confirmar / interactuar', cancel: 'Volver / correr (mantener)', menu: 'Menú' };
const storageKey = 'gerard35.controllers.v1';
export function focusControllerButton(root: HTMLElement, direction: Direction) {
  const buttons = [...root.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')].filter(b => !b.closest('[hidden], [inert]') && b.getClientRects().length);
  const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
  const step = direction === 'up' || direction === 'left' ? -1 : 1;
  buttons[index < 0 ? 0 : (index + step + buttons.length) % buttons.length]?.focus();
}
export function clickControllerButton(root: HTMLElement) {
  const button = document.activeElement;
  if (button instanceof HTMLButtonElement && root.contains(button) && !button.disabled && !button.closest('[hidden], [inert]')) button.click();
}
export function createControllerUI(callbacks: {
  context: () => string;
  direction: (direction: Direction | null, stick: Stick | null, running: boolean) => void;
  /** Player 2's stick or D-pad (Aitor, docs/party.md). */
  partnerDirection: (direction: Direction | null, stick: Stick | null, running: boolean) => void;
  /** A press; `player` is 1 for the first controller and 2 for the second. */
  action: (action: ControllerEvent, player: PlayerId) => void;
  /** The second controller connected (its name) or left (undefined). */
  secondPad: (id: string | undefined) => void;
  /** Development only: whether player 1 also drives Aitor (`solo`) or player 2 does (`duo`). */
  mode?: { get: () => ControlMode; set: (mode: ControlMode) => void };
  pause: (value: boolean) => void;
  /** Closes the user menu before opening pause. */
  panel: (id: PanelId | null) => void;
  /** Flushes progress and releases the house lights when leaving the game. */
  exit: () => void;
  resume: () => void;
  /** Fills the "Luces de casa" page (src/home-lights-ui.ts). */
  lights: (section: HTMLElement) => void;
  /** Fills the "Sonido" page (src/sound-ui.ts). */
  sound: (section: HTMLElement) => void;
}) {
  const profiles: Record<string, ControllerProfile> = Object.create(null);
  try { const saved: unknown = JSON.parse(localStorage.getItem(storageKey) ?? '{}'); if (saved && typeof saved === 'object') for (const [id, profile] of Object.entries(saved)) if (validProfile(profile)) profiles[id] = profile; } catch { /* Storage is optional. */ }
  const root = document.createElement('dialog'); root.id = 'controller-menu';
  root.setAttribute('aria-labelledby', 'controller-title');
  const icon = (path: string) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;
  const gear = icon('<path d="m9 3-.7 2.5-2.5.7L4 8.5 5.8 11l-.1 2L4 15.5l1.8 2.3 2.5.7L9 21h6l.7-2.5 2.5-.7 1.8-2.3-1.8-2.5.1-2L20 8.5l-1.8-2.3-2.5-.7L15 3Z"/><circle cx="12" cy="12" r="3"/>');
  const padIcon = icon('<path d="M7 7h10c3 0 4 9 3 10s-3-1-5-3H9c-2 2-4 4-5 3S4 7 7 7Z"/><path d="M7 9v4m-2-2h4m6-1h.01M18 12h.01"/>');
  const soundIcon = icon('<path d="M4 9v6h4l5 4V5L8 9H4Z"/><path d="M16 9a4 4 0 0 1 0 6m2.5-8.5a7.5 7.5 0 0 1 0 11"/>');
  const lightIcon = icon('<path d="M9 18h6m-5 3h4M8 13a6 6 0 1 1 8 0c-1 1-1 2-1 3H9c0-1 0-2-1-3Z"/>');
  const exitIcon = icon('<path d="M10 4H5v16h5m3-13 5 5-5 5m-4-5h9"/>');
  root.innerHTML = `<header class="journal-heading"><div><div class="pause-brand"><span class="battle-kicker">GERARD <b>35</b></span><span class="pause-state">EN PAUSA</span></div><h1 id="controller-title">Un respiro.</h1></div><button class="journal-close" data-back><span>Volver al juego</span> <kbd data-glyph="cancel">Esc</kbd></button></header>
    <section data-page="home">
      <p class="menu-intro">Tómate tu tiempo. La aventura puede esperar.</p>
      <nav class="pause-options" aria-label="Menú de pausa">
        <button data-open="settings"><span class="menu-option-icon">${gear}</span><span class="menu-option-copy"><strong>Configuración</strong><small>Mandos, sonido y luces de casa</small></span><span class="menu-option-arrow" aria-hidden="true">↗</span></button>
        <button data-exit><span class="menu-option-icon">${exitIcon}</span><span class="menu-option-copy"><strong>Salir del juego</strong><small>Hasta la próxima aventura</small></span><span class="menu-option-arrow" aria-hidden="true">↗</span></button>
      </nav>
    </section>
    <section data-page="settings" hidden>
      <p class="menu-intro">Haz que el juego se sienta como en casa.</p>
      <nav class="settings-options" aria-label="Configuración">
        <button data-open="controller"><span class="menu-option-icon">${padIcon}</span><strong>Mando</strong><small>Conectar, probar y asignar controles</small><span class="setting-tag" data-pad-summary>Sin conectar</span></button>
        <button data-open="sound"><span class="menu-option-icon">${soundIcon}</span><strong>Sonido</strong><small>Música, efectos y silencio</small><span class="setting-tag" data-sound-summary></span></button>
        <button data-open="lights"><span class="menu-option-icon">${lightIcon}</span><strong>Luces de casa</strong><small>Ambiente, intensidad y sincronización</small><span class="setting-tag">A tu ritmo</span></button>
      </nav>
    </section>
    <section data-page="controller" hidden>
      <label>Mando 1 · Gerard <select aria-label="Mando de Gerard"></select></label><p data-status role="status"></p><p data-help></p>
      <p data-second role="status"></p>
      <button data-solo hidden></button>
      <div class="controller-test"><span class="battle-kicker">PRUEBA EN DIRECTO</span><output></output></div>
      <p data-calibration role="status">Para un mando sin reconocer, asigna primero los controles.</p>
      <div class="controller-actions"><button data-remap>Asignar controles</button><button data-reset>Restablecer</button><button data-abort hidden>Cancelar asignación</button></div>
      <p class="controller-note">Conecta el mando al ordenador y pulsa un botón. Si no aparece, comprueba la conexión y la compatibilidad de tu navegador. Usa Esc para cancelar una asignación.</p>
    </section>
    <section data-page="sound" hidden></section>
    <section data-page="lights" hidden></section>
    <section data-page="exited" hidden>
      <div class="exit-emblem" aria-hidden="true">35</div><p class="menu-intro">Nos vemos en la próxima aventura.</p>
      <button class="return-to-game" data-resume>Volver a jugar <span aria-hidden="true">→</span></button>
      <p class="controller-note">Puedes cerrar esta pestaña cuando quieras.</p>
    </section>
    <footer class="menu-footer" data-glyph-template="{updown} Elegir  ·  {confirm} Confirmar  ·  {cancel} Volver"></footer>`;
  document.body.append(root);
  const get = <T extends HTMLElement>(s: string) => root.querySelector<T>(s)!;
  const select = get<HTMLSelectElement>('select');
  let selected = -1, identity = '', padList = '\0', latest: PadSnapshot | undefined;
  let mapping: Partial<ControllerProfile> | undefined, step = 0, released = false;
  let baseline: readonly number[] = [];
  let previousButtons: boolean[] = [];
  let previousDirection: Direction | null = null;
  let frame = 0, previousFocus: HTMLElement | null = null;
  let page: 'home' | 'settings' | 'controller' | 'sound' | 'lights' | 'exited' = 'home';
  callbacks.lights(root.querySelector<HTMLElement>('[data-page="lights"]')!);
  callbacks.sound(root.querySelector<HTMLElement>('[data-page="sound"]')!);
  const edges = new ControllerEdges();
  // Player 2: whichever other connected controller the game can read.
  const edges2 = new ControllerEdges();
  let secondIdentity = '', previousDirection2: Direction | null = null;
  const solo = get<HTMLButtonElement>('[data-solo]');
  if (callbacks.mode) {
    solo.hidden = false;
    const label = () => { solo.textContent = callbacks.mode!.get() === 'solo' ? 'Depuración: Gerard controla también a Aitor · Cambiar' : 'Aitor lo controla el mando 2 · Cambiar a depuración'; };
    solo.onclick = () => { callbacks.mode!.set(callbacks.mode!.get() === 'solo' ? 'duo' : 'solo'); label(); };
    label();
  }
  function save() { try { localStorage.setItem(storageKey, JSON.stringify(profiles)); return true; } catch { return false; } }
  function abort() { mapping = undefined; get('[data-abort]').hidden = true; get('[data-calibration]').textContent = 'La asignación solo se guarda al completar todos los pasos.'; }
  function open() {
    if (root.open) return;
    // The menu replaces an open journal panel instead of stacking over it.
    if (callbacks.context().startsWith('journal:')) callbacks.panel(null);
    previousFocus = document.activeElement as HTMLElement;
    callbacks.direction(null, null, false); callbacks.pause(true);
    root.showModal(); showPage('home');
  }
  function close() { if (!root.open) return; if (page === 'exited') callbacks.resume(); abort(); root.close(); callbacks.pause(false); previousFocus?.focus({ preventScroll: true }); }
  function showPage(value: typeof page) {
    page = value;
    root.querySelectorAll<HTMLElement>('[data-page]').forEach(el => { el.hidden = el.dataset.page !== page; });
    get('#controller-title').textContent = { home: 'Un respiro.', settings: 'A tu manera.', controller: 'Tu mando.', sound: 'Tu sonido.', lights: 'Como en casa.', exited: 'Gerard 35.' }[page];
    get('[data-back]').hidden = page === 'exited';
    get('[data-back] span').textContent = page === 'home' ? 'Volver al juego' : 'Volver';
    get('.pause-state').textContent = page === 'home' ? 'EN PAUSA' : page === 'exited' ? 'HASTA PRONTO' : 'CONFIGURACIÓN';
    get('.menu-footer').hidden = page === 'exited';
    root.dataset.page = page;
    const first = page === 'home' ? '[data-open="settings"]' : page === 'settings' ? '[data-open="controller"]' : page === 'exited' ? '[data-resume]' : '[data-back]';
    get<HTMLButtonElement>(first).focus({ preventScroll: true });
  }
  function back() {
    if (mapping) abort();
    else if (page === 'exited') return;
    else if (page === 'controller' || page === 'sound' || page === 'lights') showPage('settings');
    else if (page === 'settings') showPage('home');
    else close();
  }
  get('[data-back]').onclick = back;
  root.querySelectorAll<HTMLButtonElement>('[data-open]').forEach(button => { button.onclick = () => showPage(button.dataset.open as typeof page); });
  get('[data-exit]').onclick = () => { abort(); callbacks.exit(); showPage('exited'); };
  get('[data-resume]').onclick = close;
  function keydown(event: KeyboardEvent) {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.code === 'Escape') {
      // Escape closes the user menu instead of opening pause over it.
      if (!root.open && callbacks.context().startsWith('journal:')) return;
      // In a battle sub-menu, Escape backs out before opening the main menu.
      if (!root.open && callbacks.context().startsWith('battle:') && callbacks.context().split(':')[2]) return;
      // The station map, the TV, the end screen and the place picker take Escape themselves.
      if (!root.open && ['travel', 'news', 'doom', 'jump'].includes(callbacks.context())) return;
      event.preventDefault(); event.stopImmediatePropagation();
      if (!event.repeat) { if (root.open) back(); else open(); }
    } else if (root.open && !mapping && event.target !== select) {
      const directions: Record<string, Direction> = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };
      if (directions[event.code]) { event.preventDefault(); event.stopImmediatePropagation(); focusControllerButton(root, directions[event.code]); }
    }
  }
  window.addEventListener('keydown', keydown, { capture: true });
  root.addEventListener('cancel', event => { event.preventDefault(); back(); });
  select.onchange = () => { selected = Number(select.value); identity = ''; abort(); };
  get('[data-remap]').onclick = () => {
    if (!latest) return;
    mapping = {}; step = 0; released = false; baseline = [...latest.axes]; previousButtons = latest.buttons.map(b => b.pressed);
    get('[data-abort]').hidden = false;
    get('[data-calibration]').textContent = `Suelta los controles y pulsa: ${labels.up}`;
  };
  get('[data-abort]').onclick = abort;
  get('[data-reset]').onclick = () => { if (latest) { delete profiles[latest.id]; const persisted = save(); abort(); get('[data-calibration]').textContent = persisted ? 'Controles restablecidos.' : 'Restablecidos para esta sesión; no se pudo guardar.'; } };
  function poll(now: number) {
    let pads: PadSnapshot[] = [];
    try { pads = [...(navigator.getGamepads?.() ?? [])].filter((p): p is Gamepad => !!p?.connected); } catch { /* Restricted browser contexts may deny the API. */ }
    const signature = pads.map(p => `${p.index}:${p.id}`).join('|');
    if (signature !== padList) {
      padList = signature; select.replaceChildren();
      for (const pad of pads) { const option = document.createElement('option'); option.value = String(pad.index); option.textContent = pad.id; select.append(option); }
      if (!pads.length) { const option = document.createElement('option'); option.textContent = 'Ningún mando detectado'; select.append(option); }
    }
    latest = pads.find(p => p.index === selected) ?? pads[0];
    selected = latest?.index ?? -1; select.value = String(selected);
    const nextIdentity = latest ? `${latest.index}:${latest.id}` : '';
    if (nextIdentity !== identity) { identity = nextIdentity; previousDirection = null; abort(); }
    const profile = latest ? profiles[latest.id] ?? defaultProfile(latest) : undefined;
    const custom = latest ? profiles[latest.id] : undefined;
    const confirm = custom ? bindingLabel(custom.confirm) : latest && isNintendo(latest.id) ? 'A' : 'botón inferior';
    const cancel = custom ? bindingLabel(custom.cancel) : latest && isNintendo(latest.id) ? 'B' : 'botón derecho';
    const menu = custom ? bindingLabel(custom.menu) : latest && isNintendo(latest.id) ? '+' : 'Start';
    const help = `${confirm} · Confirmar   /   ${cancel} · Volver / mantener para correr   /   ${menu} · Menú`;
    get('[data-status]').textContent = !latest ? 'Sin mando. Conéctalo y pulsa un botón.' : profile ? `${latest.id} · ${custom ? 'Asignación personal' : 'Controles estándar'}` : `${latest.id} · Sin asignar: usa «Asignar controles».`;
    get('[data-help]').textContent = profile ? help : 'Teclado y ratón disponibles mientras configuras el mando.';
    get('[data-pad-summary]').textContent = profile ? 'Conectado' : latest ? 'Por configurar' : 'Sin conectar';
    get<HTMLButtonElement>('[data-remap]').disabled = !latest || !!mapping;
    get<HTMLButtonElement>('[data-reset]').disabled = !latest || !!mapping;
    if (root.open) get('output').textContent = latest ? `Botones: ${latest.buttons.flatMap((b, i) => b.pressed ? [i] : []).join(', ') || 'ninguno'}\nEjes: ${latest.axes.map((v, i) => `${i}: ${v.toFixed(2)}`).join(' · ')}` : 'Esperando conexión…';
    const focused = document.hasFocus() && !document.hidden;
    if (mapping && latest && focused) {
      if (!released) { if (latest.buttons.every(b => !b.pressed) && latest.axes.every((v, i) => Math.abs(v - (baseline[i] ?? 0)) < .2)) released = true; }
      else {
        let binding: Binding | undefined;
        const button = latest.buttons.findIndex((b, i) => b.pressed && !previousButtons[i]);
        const axis = latest.axes.findIndex((v, i) => Math.abs(v - (baseline[i] ?? 0)) > .65 && Math.abs(baseline[i] ?? 0) < .3);
        if (button >= 0) binding = { button }; else if (axis >= 0) binding = { axis, sign: latest.axes[axis] > 0 ? 1 : -1 };
        if (binding) {
          if (Object.values(mapping).some(b => JSON.stringify(b) === JSON.stringify(binding))) get('[data-calibration]').textContent = `Control ya usado. Elige otro para: ${labels[CONTROL_ACTIONS[step]]}`;
          else {
            mapping[CONTROL_ACTIONS[step++]] = binding;
            if (step === CONTROL_ACTIONS.length && validProfile(mapping)) { profiles[latest.id] = mapping; const persisted = save(); abort(); get('[data-calibration]').textContent = persisted ? 'Asignación guardada para este mando.' : 'Asignación activa en esta sesión; no se pudo guardar.'; }
            else get('[data-calibration]').textContent = `Suelta los controles y pulsa: ${labels[CONTROL_ACTIONS[step]]}`;
          }
          released = false;
        }
      }
      previousButtons = latest.buttons.map(b => b.pressed);
    }
    const second = pads.find(p => p !== latest && (profiles[p.id] ?? defaultProfile(p)));
    const nextSecond = second ? `${second.index}:${second.id}` : '';
    if (nextSecond !== secondIdentity) { secondIdentity = nextSecond; previousDirection2 = null; callbacks.secondPad(second?.id); }
    get('[data-second]').textContent = second ? `Mando 2 · Aitor: ${second.id}` : 'Mando 2 · Aitor: sin conectar. Conecta otro mando y pulsa un botón.';
    const state2 = second ? readController(second, profiles[second.id], previousDirection2) : idleController();
    previousDirection2 = focused ? state2.direction : null;
    const input2 = edges2.update(state2, `${secondIdentity}:${root.open ? 'menu' : callbacks.context()}`, now, focused && !mapping && !root.open);
    // Player 2's half of the screen (their status sheet, their fight dock) shows their own pad.
    if (second) setPlayer2Device(padFamily(second.id, !!profiles[second.id]));
    callbacks.partnerDirection(input2.direction, input2.stick, input2.running);
    // Player 2 plays, talks and has their own half of the status screen; the menu and camera stay with player 1.
    for (const action of input2.events) if (action !== 'menu' && action !== 'overview') callbacks.action(action, 2);
    const state = latest ? readController(latest, custom, previousDirection) : idleController();
    previousDirection = focused ? state.direction : null;
    const context = `${identity}:${mapping ? 'mapping' : root.open ? `menu:${page}` : callbacks.context()}`;
    const input = edges.update(state, context, now, focused && !mapping);
    if (latest && profile && (input.events.length || input.direction)) setInputDevice(padFamily(latest.id, !!custom));
    callbacks.direction(root.open ? null : input.direction, root.open ? null : input.stick, !root.open && input.running);
    for (const action of input.events) {
      if (root.open) {
        if (action === 'menu') { if (page !== 'exited') close(); }
        else if (action === 'character' || action === 'overview' || action === 'prev' || action === 'next') continue;
        else if (action === 'cancel') back();
        else if (action === 'confirm') clickControllerButton(root);
        else focusControllerButton(root, action);
      } else if (action === 'menu') open();
      else callbacks.action(action, 1);
      // A screen transition must not receive another event from the same frame.
      if (`${identity}:${mapping ? 'mapping' : root.open ? `menu:${page}` : callbacks.context()}` !== context) break;
    }
    frame = requestAnimationFrame(poll);
  }
  frame = requestAnimationFrame(poll);
  return { open, destroy() { cancelAnimationFrame(frame); close(); window.removeEventListener('keydown', keydown, { capture: true }); root.remove(); } };
}
function bindingLabel(binding: Binding) { return 'button' in binding ? `Botón ${binding.button}` : `Eje ${binding.axis} ${binding.sign > 0 ? '+' : '−'}`; }
