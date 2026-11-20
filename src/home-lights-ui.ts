import { HOUSE_LIGHTS, LATE_MAX, SCREEN_MS, lateness, tapOffsets, type HomeLights, type Intensity, type Scope } from './home-lights';

const REASONS: Record<string, string> = {
  library: 'Falta la librería de casa: git submodule update --init.',
  token: 'El servidor no encuentra las bombillas en la red de casa ni tiene LIFX_TOKEN en .env.',
  key: 'Este servidor pide la llave de casa: abre el juego con ?luces=<llave> una vez.',
  server: 'El servidor del juego no contesta (just backend). Se conectan solas en cuanto vuelva.',
};
const SCOPES: Record<Scope, string> = { salon: 'Solo el salón', casa: 'Toda la casa' };
const INTENSITIES: Record<Intensity, string> = { suave: 'Suave · sin destellos fuertes', normal: 'Normal', intensa: 'Intensa' };
const LATE_STEP = 10;
/** The tap calibration: beats per round, the time between them, and the first ones left out while the hand finds the beat. */
const BEATS = 10, EVERY = 700, WARM_UP = 2;

/** The menu's "Luces de casa" page: connect the bulbs, choose how far they go, and keep them in time. */
export function mountHomeLightsPage(section: HTMLElement, lights: HomeLights) {
  section.innerHTML = `
    <p class="menu-intro">Las luces de casa juegan contigo.</p>
    <p data-lights-status role="status"></p>
    <div class="lights-options">
      <button data-lights-toggle></button>
      <button data-lights-scope></button>
      <button data-lights-intensity></button>
    </div>
    <div class="lights-lead">
      <span class="battle-kicker">SINCRONÍA</span>
      <button data-late="-1" aria-label="Antes">−</button><output data-late-value></output><button data-late="1" aria-label="Después">+</button>
      <button data-lights-calibrate>Calibrar</button><button data-lights-test>Probar</button>
    </div>
    <p class="controller-note" data-lights-bulbs></p>
    <p class="controller-note" data-lights-result role="status"></p>
    <div class="lights-calibrate" data-lights-tapping hidden>
      <p data-lights-tap-prompt></p>
      <button data-lights-tap><span data-glyph-template="{confirm} al ritmo"></span></button>
      <p class="controller-note" data-lights-tap-count></p>
    </div>
    <p class="controller-note">Cada lugar tiñe el salón con sus colores y los combates se juegan en las bombillas. En el piso de la Meridiana el del juego y el de verdad son el mismo: lo que enciendas en uno se enciende en el otro. El juego mide lo que tarda cada bombilla y le avisa antes. Calibrar: sigue el ritmo primero de la pantalla y luego de las luces, y el juego corrige la diferencia.</p>`;
  const get = <T extends HTMLElement>(selector: string) => section.querySelector<T>(selector)!;
  // Inside the menu's dialog, which sits on the top layer, so the flash covers the whole screen.
  const flash = document.createElement('div');
  flash.className = 'lights-flash'; flash.setAttribute('aria-hidden', 'true');
  section.append(flash);
  const flashScreen = () => { flash.classList.remove('is-on'); void flash.offsetWidth; flash.classList.add('is-on'); };
  let calibrating = false;
  function render() {
    const { settings, status } = lights;
    get('[data-lights-status]').textContent = status.state === 'on'
      ? `Conectadas · ${status.lights} luces · ${status.transport === 'lan' ? 'por la red de casa' : 'por la nube de LIFX'} · avisadas ${lights.lead} ms antes`
      : status.state === 'connecting' ? 'Conectando…' : status.state === 'unavailable' ? `No disponibles. ${REASONS[status.reason] ?? ''}` : 'Desconectadas: la casa está como la dejaste.';
    get('[data-lights-toggle]').textContent = settings.enabled ? 'Soltar las luces (vuelven a como estaban)' : 'Conectar las luces de casa';
    get('[data-lights-scope]').textContent = `Habitaciones: ${SCOPES[settings.scope]} · Cambiar`;
    get('[data-lights-intensity]').textContent = `Intensidad: ${INTENSITIES[settings.intensity]} · Cambiar`;
    get('[data-late-value]').textContent = `${settings.late > 0 ? '+' : ''}${settings.late} ms`;
    // What each bulb takes now, as the bridge measures it.
    const measured = status.state === 'on' ? HOUSE_LIGHTS.flatMap(light => light.labels).filter(label => label in status.bulbs).map(label => `${label} ${status.bulbs[label]} ms`) : [];
    get('[data-lights-bulbs]').textContent = measured.length ? `Lo que tarda cada una: ${measured.join(' · ')}.` : '';
    for (const button of section.querySelectorAll<HTMLButtonElement>('[data-late], [data-lights-calibrate], [data-lights-test]')) button.disabled = calibrating;
  }
  get('[data-lights-toggle]').onclick = () => { void lights.setEnabled(!lights.settings.enabled); };
  get('[data-lights-scope]').onclick = () => lights.update({ scope: lights.settings.scope === 'salon' ? 'casa' : 'salon' });
  get('[data-lights-intensity]').onclick = () => {
    const order: Intensity[] = ['suave', 'normal', 'intensa'];
    lights.update({ intensity: order[(order.indexOf(lights.settings.intensity) + 1) % order.length] });
  };
  section.querySelectorAll<HTMLButtonElement>('[data-late]').forEach(button => {
    button.onclick = () => lights.update({ late: lights.settings.late + Number(button.dataset.late) * LATE_STEP });
  });
  get('[data-lights-test]').onclick = () => lights.test(flashScreen);

  // ——— The tap calibration ———
  const tapping = get('[data-lights-tapping]'), tapButton = get<HTMLButtonElement>('[data-lights-tap]');
  let taps: number[] = [];
  const tap = (at: number) => { if (calibrating) { taps.push(at); get('[data-lights-tap-count]').textContent = '•'.repeat(taps.length); } };
  tapButton.addEventListener('keydown', event => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    if (!event.repeat) tap(event.timeStamp);
  });
  tapButton.addEventListener('pointerdown', event => tap(event.timeStamp));
  // A pad presses the focused button with a click of its own (no pointer, no key).
  tapButton.addEventListener('click', event => { if (event.detail === 0) tap(event.timeStamp); });
  /** One round: `BEATS` beats, each shown by `show(at)`; returns how far each tap fell from its beat. */
  async function round(prompt: string, show: (beats: number[]) => void) {
    get('[data-lights-tap-prompt]').textContent = prompt;
    get('[data-lights-tap-count]').textContent = '';
    taps = [];
    const start = performance.now() + 1500;
    const beats = Array.from({ length: BEATS }, (_, i) => start + i * EVERY);
    show(beats);
    await new Promise(resolve => setTimeout(resolve, start + BEATS * EVERY - performance.now()));
    return tapOffsets(beats.slice(WARM_UP), taps, EVERY * .45);
  }
  get('[data-lights-calibrate]').onclick = async () => {
    if (calibrating || !lights.active) return;
    calibrating = true; tapping.hidden = false; render();
    get('[data-lights-result]').textContent = '';
    tapButton.focus();
    // The screen's flash shows `SCREEN_MS` after it is drawn, as a hit does.
    const screen = await round('Sigue el ritmo de la pantalla.', beats => beats.forEach(beat => setTimeout(flashScreen, beat - SCREEN_MS - performance.now())));
    const bulbs = await round('Ahora el de las luces.', beats => beats.forEach(beat => lights.beat(beat)));
    const late = lateness(screen, bulbs);
    calibrating = false; tapping.hidden = true;
    if (late === undefined) get('[data-lights-result]').textContent = 'No he notado bastantes toques. Prueba otra vez.';
    else {
      const next = Math.max(-LATE_MAX, Math.min(LATE_MAX, lights.settings.late + late));
      lights.update({ late: next });
      get('[data-lights-result]').textContent = Math.abs(late) < 15 ? 'Las luces ya iban a tiempo.' : `Las luces llegaban ${Math.abs(late)} ms ${late > 0 ? 'tarde' : 'pronto'}: corregido.`;
    }
    render();
  };
  lights.onChange(render);
  render();
}
