import type { ControllerEvent } from './controller';
import { SWATCHES, lampRgb, lightById, stepSwatch, switchedOn, type HomeLights, type Lamp, type LightId } from './home-lights';

const css = (lamp: Lamp) => {
  const [r, g, b] = lampRgb(lamp).map(v => Math.round(v * 255));
  return `rgb(${r} ${g} ${b})`;
};
/** How long a dragged colour waits before the next one goes to the bulbs. */
const SEND_MS = 45;

/**
 * The dial that opens on a lamp in the Meridiana flat: a colour wheel, whites and colours to pick,
 * brightness and power. Every change lights the lamp in the game and, with the lights connected,
 * the bulb at home as it happens. Keys: ← → colour, ↑ ↓ brightness, Space power, E or Esc to close.
 */
export function createLampPicker(hud: HTMLElement, lights: HomeLights, pause: (paused: boolean) => void) {
  const root = document.createElement('section');
  root.id = 'lamp-dial'; root.hidden = true; root.tabIndex = -1;
  root.setAttribute('role', 'dialog');
  root.innerHTML = `
    <header><div><span class="battle-kicker" data-room></span><strong data-name></strong></div><button type="button" data-power></button></header>
    <div class="lamp-dial-body">
      <div class="lamp-wheel" data-wheel aria-label="Color"><i data-dot></i></div>
      <div class="lamp-brightness" data-brightness aria-label="Brillo"><i data-thumb></i></div>
      <div class="lamp-readout"><span data-chip></span><b data-colour></b><small data-percent></small></div>
    </div>
    <div class="lamp-swatches">${SWATCHES.map((s, i) => `<button type="button" data-swatch="${i}" title="${s.name}" aria-label="${s.name}" style="--swatch:${css(s.lamp)}"></button>`).join('')}</div>
    <footer><span><kbd>←</kbd><kbd>→</kbd> Color</span><span><kbd>↑</kbd><kbd>↓</kbd> Brillo</span><span><kbd>Espacio</kbd> Luz</span><span><kbd>E</kbd> Cerrar</span><em data-home></em></footer>`;
  hud.append(root);
  const get = <T extends HTMLElement>(selector: string) => root.querySelector<T>(selector)!;
  const wheel = get('[data-wheel]'), bar = get('[data-brightness]');
  let id: LightId | undefined;
  let lamp: Lamp | undefined;
  let openedAt = 0;
  let timer: ReturnType<typeof setTimeout> | undefined, sentAt = 0;

  function render() {
    if (!id || !lamp) return;
    const light = lightById(id);
    get('[data-room]').textContent = `LUZ · ${light.room.toUpperCase()}`;
    get('[data-name]').textContent = light.short;
    root.setAttribute('aria-label', `Luz: ${light.short}`);
    const power = get<HTMLButtonElement>('[data-power]');
    power.textContent = lamp.on ? 'Encendida' : 'Apagada';
    power.setAttribute('aria-pressed', String(lamp.on));
    root.dataset.on = String(lamp.on);
    root.style.setProperty('--lamp', css({ ...lamp, brightness: 1 }));
    // Whites sit in the middle of the wheel; colours further out the more saturated they are.
    const angle = lamp.hue * Math.PI / 180, radius = lamp.saturation * 50;
    get('[data-dot]').style.cssText = `left:${50 + Math.cos(angle) * radius}%;top:${50 + Math.sin(angle) * radius}%`;
    get('[data-thumb]').style.bottom = `${lamp.brightness * 100}%`;
    const current = stepSwatch(lamp, 0);
    root.querySelectorAll<HTMLElement>('[data-swatch]').forEach((el, i) => el.setAttribute('aria-pressed', String(i === current.index && lamp!.on)));
    get('[data-chip]').style.background = lamp.on ? css(lamp) : 'transparent';
    get('[data-colour]').textContent = lamp.on ? SWATCHES[current.index].name : 'Apagada';
    get('[data-percent]').textContent = lamp.on ? `${Math.round(lamp.brightness * 100)} %` : '';
    const status = lights.status;
    get('[data-home]').textContent = status.state === 'on' ? (status.transport === 'lan' ? 'En casa · al instante' : 'En casa · por la nube') : 'Solo en el juego';
  }
  /** The game shows it at once; the house gets it now, or as soon as the last send has gone. */
  function apply(next: Lamp) {
    if (!id) return;
    lamp = next; render();
    const target = id;
    const send = () => { timer = undefined; sentAt = performance.now(); lights.setLamp(target, lamp!); };
    clearTimeout(timer);
    const wait = SEND_MS - (performance.now() - sentAt);
    if (wait <= 0) send(); else timer = setTimeout(send, wait);
  }
  function open(which: LightId) {
    id = which; lamp = lights.flat[which]; openedAt = performance.now();
    root.hidden = false; hud.dataset.lamp = 'open'; pause(true);
    // Pressing a lamp that is off turns it on: the dial is for what comes next.
    if (!lamp.on) apply(switchedOn(lamp)); else render();
    root.focus({ preventScroll: true });
  }
  function close() {
    if (!id) return;
    if (timer) { clearTimeout(timer); timer = undefined; lights.setLamp(id, lamp!); }
    id = undefined; root.hidden = true; delete hud.dataset.lamp; pause(false);
    document.querySelector<HTMLElement>('#game')?.focus({ preventScroll: true });
  }
  const brightness = (value: number) => apply({ ...switchedOn(lamp!), brightness: Math.max(.05, Math.min(1, Math.round(value * 100) / 100)) });
  function control(action: ControllerEvent) {
    if (!id || !lamp) return;
    if (action === 'left' || action === 'right') apply(stepSwatch(lamp, action === 'right' ? 1 : -1).lamp);
    else if (action === 'up' || action === 'down') brightness(lamp.brightness + (action === 'up' ? .1 : -.1));
    else if (action === 'confirm') apply(lamp.on ? { ...lamp, on: false } : switchedOn(lamp));
    else if (action === 'cancel' || action === 'menu') close();
  }
  // Pointer: drag on the wheel for any colour, on the bar for brightness.
  function drag(el: HTMLElement, move: (x: number, y: number) => void) {
    el.addEventListener('pointerdown', event => {
      el.setPointerCapture(event.pointerId);
      const at = (e: PointerEvent) => { const r = el.getBoundingClientRect(); move((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height); };
      at(event);
      const moving = (e: PointerEvent) => at(e);
      const up = () => { el.removeEventListener('pointermove', moving); el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up); };
      el.addEventListener('pointermove', moving); el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
    });
  }
  drag(wheel, (x, y) => {
    const dx = x - .5, dy = y - .5;
    const saturation = Math.min(1, Math.hypot(dx, dy) * 2);
    const hue = (Math.atan2(dy, dx) * 180 / Math.PI + 360) % 360;
    apply({ ...switchedOn(lamp!), hue: Math.round(hue), saturation: saturation < .12 ? 0 : saturation });
  });
  drag(bar, (_, y) => brightness(1 - y));
  root.addEventListener('wheel', event => { event.preventDefault(); brightness(lamp!.brightness - Math.sign(event.deltaY) * .05); }, { passive: false });
  root.addEventListener('click', event => {
    const target = (event.target as HTMLElement).closest<HTMLElement>('[data-swatch], [data-power]');
    if (!target || !lamp) return;
    if (target.dataset.power !== undefined) control('confirm');
    else apply({ ...SWATCHES[Number(target.dataset.swatch)].lamp });
  });
  // Ahead of the game and the menu: while the dial is open its keys are its own.
  function keydown(event: KeyboardEvent) {
    if (!id) return;
    const keys: Record<string, ControllerEvent> = {
      ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down',
      Space: 'confirm', Enter: 'confirm', Escape: 'cancel', KeyE: 'cancel',
    };
    const action = keys[event.code];
    if (!action) return;
    event.preventDefault(); event.stopImmediatePropagation();
    // The press that opened the dial must not close it straight away.
    if (event.code === 'KeyE' && (event.repeat || performance.now() - openedAt < 250)) return;
    if (event.repeat && action !== 'up' && action !== 'down' && action !== 'left' && action !== 'right') return;
    control(action);
  }
  window.addEventListener('keydown', keydown, { capture: true });
  // A lamp switched at home while the dial is open moves the dial too.
  const unsubscribe = [
    lights.onFlat((changed, next) => { if (changed === id && !timer && performance.now() - sentAt > 1500) { lamp = next; render(); } }),
    lights.onChange(render),
  ];
  return {
    open, close, control,
    get isOpen() { return !!id; },
    destroy() { close(); unsubscribe.forEach(off => off()); window.removeEventListener('keydown', keydown, { capture: true }); root.remove(); },
  };
}
