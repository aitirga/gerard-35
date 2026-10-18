import { CONTROL_ACTIONS, ControllerEdges, defaultProfile, idleController, isNintendo, readController, validProfile, type Binding, type ControlAction, type ControllerEvent, type ControllerProfile, type PadSnapshot } from './controller';
import type { Direction, Stick } from './movement';
import type { PanelId } from './exploration-ui';
import type { ControlMode, PlayerId } from './party';

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
  /** Opens a journal panel, or closes it with `null`. */
  panel: (id: PanelId | null) => void;
}) {
  const profiles: Record<string, ControllerProfile> = Object.create(null);
  try { const saved: unknown = JSON.parse(localStorage.getItem(storageKey) ?? '{}'); if (saved && typeof saved === 'object') for (const [id, profile] of Object.entries(saved)) if (validProfile(profile)) profiles[id] = profile; } catch { /* Storage is optional. */ }
  const root = document.createElement('dialog'); root.id = 'controller-menu';
  root.setAttribute('aria-labelledby', 'controller-title');
  root.innerHTML = `<header class="journal-heading"><div><span class="battle-kicker">GERARD 35 / MENÚ</span><h1 id="controller-title">Un respiro.</h1></div><button class="journal-close" data-back>Volver <kbd>Esc</kbd></button></header>
    <section data-page="home">
      <p class="menu-intro">La aventura sigue aquí.</p>
      <nav class="adventure-options" aria-label="Menú de aventura">
        <button data-close><span>01</span><strong>Continuar</strong><small>Volver a la aventura →</small></button>
        <button data-panel="character"><span>02</span><strong>Estado</strong><small>Gerard, ánimas y diario</small></button>
        <button data-panel="items"><span>03</span><strong>Objetos</strong><small>Comunes y objetos clave</small></button>
        <button data-panel="map"><span>04</span><strong>Mapa</strong><small>Dónde estás y qué hay cerca</small></button>
        <button data-open="controller"><span>05</span><strong>Mando</strong><small>Conectar, probar y asignar</small></button>
        <button data-open="help"><span>06</span><strong>Cómo jugar</strong><small>Controles y primeros pasos</small></button>
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
    <section data-page="help" hidden>
      <p class="menu-intro">Explora. Habla con todo el mundo. Prueba.</p>
      <dl class="menu-controls"><div><dt>Moverte</dt><dd>W A S D o flechas · Stick izquierdo o cruceta</dd></div><div><dt>Correr</dt><dd>Con las zapatillas: mantén Shift · Mantén B (Volver) en el mando</dd></div><div><dt>Interactuar / avanzar</dt><dd>E · Enter · Espacio · Confirmar en el mando</dd></div><div><dt>Estado</dt><dd>C en el teclado (I / M abren Objetos y Mapa) · Botón superior del mando (X en Nintendo, △ en PlayStation, Y en Xbox) · Pasa de página con Q / E o L / R</dd></div><div><dt>Dos jugadores</dt><dd>Con Aitor en el mando 2, cada uno abre su estado en su mitad de la pantalla</dd></div><div><dt>Vista general</dt><dd>R · − o Select en el mando</dd></div><div><dt>Combate</dt><dd>1–4 o flechas · Enter para confirmar · Esc para volver</dd></div><div><dt>Menú / volver</dt><dd>Esc · + o Start en el mando</dd></div></dl>
      <p class="controller-note">En mandos Nintendo reconocidos: A confirma y B vuelve. Mantén B mientras te mueves para correr. Puedes cambiar los controles en Mando.</p>
    </section>
    <footer class="menu-footer">↑ ↓ Elegir &nbsp; · &nbsp; Enter Confirmar &nbsp; · &nbsp; Esc Volver</footer>`;
  document.body.append(root);
  const get = <T extends HTMLElement>(s: string) => root.querySelector<T>(s)!;
  const select = get<HTMLSelectElement>('select');
  let selected = -1, identity = '', padList = '\0', latest: PadSnapshot | undefined;
  let mapping: Partial<ControllerProfile> | undefined, step = 0, released = false;
  let baseline: readonly number[] = [];
  let previousButtons: boolean[] = [];
  let previousDirection: Direction | null = null;
  let frame = 0, previousFocus: HTMLElement | null = null;
  let page: 'home' | 'controller' | 'help' = 'home';
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
    // Character and map only make sense while exploring.
    const explorable = callbacks.context() === 'world';
    root.querySelectorAll<HTMLButtonElement>('[data-panel]').forEach(button => { button.disabled = !explorable; });
    root.showModal(); showPage('home');
  }
  function close() { if (!root.open) return; abort(); root.close(); callbacks.pause(false); previousFocus?.focus({ preventScroll: true }); }
  function showPage(value: typeof page) {
    page = value;
    root.querySelectorAll<HTMLElement>('[data-page]').forEach(el => { el.hidden = el.dataset.page !== page; });
    get('#controller-title').textContent = page === 'home' ? 'Un respiro.' : page === 'controller' ? 'A tu manera.' : 'La aventura empieza aquí.';
    root.dataset.page = page;
    get<HTMLButtonElement>(page === 'home' ? '[data-close]' : '[data-back]').focus({ preventScroll: true });
  }
  function back() { if (mapping) abort(); else if (page !== 'home') showPage('home'); else close(); }
  get('[data-back]').onclick = back;
  root.querySelectorAll<HTMLButtonElement>('[data-open]').forEach(button => { button.onclick = () => showPage(button.dataset.open as typeof page); });
  root.querySelectorAll<HTMLButtonElement>('[data-panel]').forEach(button => { button.onclick = () => { close(); callbacks.panel(button.dataset.panel as PanelId); }; });
  function keydown(event: KeyboardEvent) {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.code === 'Escape') {
      // In a battle sub-menu, Escape backs out before opening the main menu.
      if (!root.open && callbacks.context().startsWith('battle:') && callbacks.context().split(':')[2]) return;
      event.preventDefault(); event.stopImmediatePropagation();
      if (!event.repeat) { if (root.open) back(); else open(); }
    } else if (root.open && !mapping && event.target !== select) {
      const directions: Record<string, Direction> = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };
      if (directions[event.code]) { event.preventDefault(); event.stopImmediatePropagation(); focusControllerButton(root, directions[event.code]); }
    }
  }
  window.addEventListener('keydown', keydown, { capture: true });
  get('[data-close]').onclick = close;
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
    const overview = custom ? '' : latest && isNintendo(latest.id) ? '−' : 'Select';
    const help = `${confirm} · Confirmar   /   ${cancel} · Volver / mantener para correr   /   ${menu} · Menú`;
    get('[data-status]').textContent = !latest ? 'Sin mando. Conéctalo y pulsa un botón.' : profile ? `${latest.id} · ${custom ? 'Asignación personal' : 'Controles estándar'}` : `${latest.id} · Sin asignar: usa «Asignar controles».`;
    get('[data-help]').textContent = profile ? help : 'Teclado y ratón disponibles mientras configuras el mando.';
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
    callbacks.partnerDirection(input2.direction, input2.stick, input2.running);
    // Player 2 plays, talks and has their own half of the status screen; the menu and camera stay with player 1.
    for (const action of input2.events) if (action !== 'menu' && action !== 'overview') callbacks.action(action, 2);
    const state = latest ? readController(latest, custom, previousDirection) : idleController();
    previousDirection = focused ? state.direction : null;
    const context = `${identity}:${mapping ? 'mapping' : root.open ? `menu:${page}` : callbacks.context()}`;
    const input = edges.update(state, context, now, focused && !mapping);
    callbacks.direction(root.open ? null : input.direction, root.open ? null : input.stick, !root.open && input.running);
    for (const action of input.events) {
      if (root.open) {
        if (action === 'menu') close();
        else if (action === 'character' || action === 'overview' || action === 'prev' || action === 'next') continue;
        else if (action === 'cancel') back();
        else if (action === 'confirm') clickControllerButton(root);
        else focusControllerButton(root, action);
      } else if (action === 'menu') open();
      else callbacks.action(action, 1);
      // A screen transition must not receive another event from the same frame.
      if (`${identity}:${mapping ? 'mapping' : root.open ? `menu:${page}` : callbacks.context()}` !== context) break;
    }
    const visibleHelp = latest && profile ? help : 'WASD · Mover / E · Interactuar / Esc · Menú';
    document.querySelector('.controls span')!.textContent = visibleHelp;
    const pad = !!(latest && profile);
    document.querySelector('.journal-dock kbd')!.textContent = pad ? menu : 'Esc';
    document.querySelector('#overview kbd')!.textContent = pad && overview ? `R / ${overview}` : 'R';
    document.querySelector('#interact small')!.textContent = latest && profile ? ` / ${confirm}` : '';
    const dialogueKey = document.querySelector('#dialogue kbd'); if (dialogueKey) dialogueKey.textContent = latest && profile ? `E / ${confirm}` : 'E';
    document.querySelectorAll<HTMLElement>('.command-help, .journal-help').forEach(el => {
      if (!el.dataset.keyboardHelp) el.dataset.keyboardHelp = el.textContent ?? '';
      if (latest && profile) el.textContent = `Stick / Cruceta · Elegir / ${help}`;
      else el.textContent = el.dataset.keyboardHelp;
    });
    // Each half of the status screen names its own player's buttons; player 1 falls back to the keyboard.
    for (const [player, source, shown] of [[1, latest, !!(latest && profile && !custom)], [2, second, !!second && !profiles[second.id]]] as const) {
      const sheet = document.querySelector<HTMLElement>(`.status-sheet[data-player="${player}"]:not([hidden])`);
      if (!sheet) continue;
      const labels = shown && source ? padLabels(source.id) : player === 1 ? undefined : padLabels('');
      const keys = labels ?? { prev: 'Q', next: 'E', confirm: 'Enter', cancel: 'Esc' };
      const write = (selector: string, text: string) => { const el = sheet.querySelector(selector); if (el && el.textContent !== text) el.textContent = text; };
      write('[data-tab-key="prev"]', keys.prev); write('[data-tab-key="next"]', keys.next); write('.journal-close kbd', keys.cancel);
      write('.sheet-help', `${keys.prev} / ${keys.next} · Página   ·   ${labels ? 'Cruceta' : 'Flechas'} · Elegir   ·   ${keys.confirm} · Usar   ·   ${keys.cancel} · Cerrar`);
    }
    frame = requestAnimationFrame(poll);
  }
  frame = requestAnimationFrame(poll);
  return { open, destroy() { cancelAnimationFrame(frame); close(); window.removeEventListener('keydown', keydown, { capture: true }); root.remove(); } };
}
/** What a recognised pad prints on its shoulder and face buttons. */
function padLabels(id: string) {
  if (isNintendo(id)) return { prev: 'L', next: 'R', confirm: 'A', cancel: 'B' };
  if (/playstation|dualshock|dualsense|054c/i.test(id)) return { prev: 'L1', next: 'R1', confirm: '✕', cancel: '○' };
  return { prev: 'LB', next: 'RB', confirm: 'A', cancel: 'B' };
}
function bindingLabel(binding: Binding) { return 'button' in binding ? `Botón ${binding.button}` : `Eje ${binding.axis} ${binding.sign > 0 ? '+' : '−'}`; }
