import { CONTROL_ACTIONS, ControllerEdges, defaultProfile, idleController, isNintendo, readController, validProfile, type Binding, type ControlAction, type ControllerProfile, type PadSnapshot } from './controller';
import type { Direction, Stick } from './movement';

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
  action: (action: ControlAction) => void;
  pause: (value: boolean) => void;
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
        <button data-open="controller"><span>02</span><strong>Mando</strong><small>Conectar, probar y asignar</small></button>
        <button data-open="help"><span>03</span><strong>Cómo jugar</strong><small>Controles y primeros pasos</small></button>
      </nav>
    </section>
    <section data-page="controller" hidden>
      <label>Mando activo <select aria-label="Mando activo"></select></label><p data-status role="status"></p><p data-help></p>
      <div class="controller-test"><span class="battle-kicker">PRUEBA EN DIRECTO</span><output></output></div>
      <p data-calibration role="status">Para un mando sin reconocer, asigna primero los controles.</p>
      <div class="controller-actions"><button data-remap>Asignar controles</button><button data-reset>Restablecer</button><button data-abort hidden>Cancelar asignación</button></div>
      <p class="controller-note">Conecta el mando al ordenador y pulsa un botón. Si no aparece, comprueba la conexión y la compatibilidad de tu navegador. Usa Esc para cancelar una asignación.</p>
    </section>
    <section data-page="help" hidden>
      <p class="menu-intro">Explora el barrio. Llama a Bernat. Sigue tu aventura.</p>
      <dl class="menu-controls"><div><dt>Moverte</dt><dd>W A S D o flechas · Stick izquierdo o cruceta</dd></div><div><dt>Correr</dt><dd>Mantener B (Volver) mientras te mueves</dd></div><div><dt>Interactuar / avanzar</dt><dd>E · Enter · Espacio · Confirmar en el mando</dd></div><div><dt>Personaje / mapa</dt><dd>C / M</dd></div><div><dt>Vista general</dt><dd>R</dd></div><div><dt>Combate</dt><dd>1–4 o flechas · Enter para confirmar · Esc para volver</dd></div><div><dt>Menú / volver</dt><dd>Esc · + o Start en el mando</dd></div></dl>
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
  function save() { try { localStorage.setItem(storageKey, JSON.stringify(profiles)); return true; } catch { return false; } }
  function abort() { mapping = undefined; get('[data-abort]').hidden = true; get('[data-calibration]').textContent = 'La asignación solo se guarda al completar todos los pasos.'; }
  function open() {
    if (root.open) return;
    previousFocus = document.activeElement as HTMLElement;
    callbacks.direction(null, null, false); callbacks.pause(true);
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
    const menu = custom ? bindingLabel(custom.menu) : latest && isNintendo(latest.id) ? '+' : 'Start / Menú';
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
    const state = latest ? readController(latest, custom, previousDirection) : idleController();
    previousDirection = focused ? state.direction : null;
    const context = `${identity}:${mapping ? 'mapping' : root.open ? `menu:${page}` : callbacks.context()}`;
    const input = edges.update(state, context, now, focused && !mapping);
    callbacks.direction(root.open ? null : input.direction, root.open ? null : input.stick, !root.open && input.running);
    for (const action of input.events) {
      if (root.open) {
        if (action === 'menu') close();
        else if (action === 'cancel') back();
        else if (action === 'confirm') clickControllerButton(root);
        else focusControllerButton(root, action);
      } else if (action === 'menu') open();
      else callbacks.action(action);
      // A screen transition must not receive another event from the same frame.
      if (`${identity}:${mapping ? 'mapping' : root.open ? `menu:${page}` : callbacks.context()}` !== context) break;
    }
    const visibleHelp = latest && profile ? help : 'WASD · Mover / E · Interactuar / Esc · Menú';
    document.querySelector('.controls span')!.textContent = visibleHelp;
    document.querySelector('#interact small')!.textContent = latest && profile ? ` / ${confirm}` : '';
    const dialogueKey = document.querySelector('#dialogue kbd'); if (dialogueKey) dialogueKey.textContent = latest && profile ? `E / ${confirm}` : 'E';
    document.querySelectorAll<HTMLElement>('.command-help, .journal-help').forEach(el => {
      if (!el.dataset.keyboardHelp) el.dataset.keyboardHelp = el.textContent ?? '';
      if (latest && profile) el.textContent = `Stick / Cruceta · Elegir / ${help}`;
      else el.textContent = el.dataset.keyboardHelp;
    });
    frame = requestAnimationFrame(poll);
  }
  frame = requestAnimationFrame(poll);
  return { destroy() { cancelAnimationFrame(frame); close(); window.removeEventListener('keydown', keydown, { capture: true }); root.remove(); } };
}
function bindingLabel(binding: Binding) { return 'button' in binding ? `Botón ${binding.button}` : `Eje ${binding.axis} ${binding.sign > 0 ? '+' : '−'}`; }
