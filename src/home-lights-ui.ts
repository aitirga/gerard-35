import type { HomeLights, Intensity, Scope } from './home-lights';

const REASONS: Record<string, string> = {
  library: 'Falta la librería de casa: git submodule update --init.',
  token: 'El servidor no tiene LIFX_TOKEN. Añádelo a .env y reinicia just backend.',
  key: 'Este servidor pide la llave de casa: abre el juego con ?luces=<llave> una vez.',
};
const SCOPES: Record<Scope, string> = { salon: 'Solo el salón', casa: 'Toda la casa' };
const INTENSITIES: Record<Intensity, string> = { suave: 'Suave · sin destellos fuertes', normal: 'Normal', intensa: 'Intensa' };
const LEAD_STEP = 50, LEAD_MAX = 1500;

/** The menu's "Luces de casa" page: connect the bulbs, choose how far they go, and set the lead. */
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
      <span class="battle-kicker">ADELANTO</span>
      <button data-lead="-1" aria-label="Menos adelanto">−</button><output data-lead-value></output><button data-lead="1" aria-label="Más adelanto">+</button>
      <button data-lights-test>Probar</button>
    </div>
    <p class="controller-note">Cada lugar tiñe el salón con sus colores y los combates se juegan en las bombillas. En el piso de la Meridiana el del juego y el de verdad son el mismo: lo que enciendas en uno se enciende en el otro. El adelanto manda las luces antes de tiempo para que lleguen a la vez que el golpe: pulsa Probar y ajústalo hasta que la pantalla y las bombillas destellen juntas.</p>`;
  const get = <T extends HTMLElement>(selector: string) => section.querySelector<T>(selector)!;
  // Inside the menu's dialog, which sits on the top layer, so the flash covers the whole screen.
  const flash = document.createElement('div');
  flash.className = 'lights-flash'; flash.setAttribute('aria-hidden', 'true');
  section.append(flash);
  function render() {
    const { settings, status } = lights;
    get('[data-lights-status]').textContent = status.state === 'on'
      ? `Conectadas · ${status.lights} luces${status.latency ? ` · la nube tarda unos ${status.latency} ms` : ''}`
      : status.state === 'connecting' ? 'Conectando…' : status.state === 'unavailable' ? `No disponibles. ${REASONS[status.reason] ?? ''}` : 'Desconectadas: la casa está como la dejaste.';
    get('[data-lights-toggle]').textContent = settings.enabled ? 'Soltar las luces (vuelven a como estaban)' : 'Conectar las luces de casa';
    get('[data-lights-scope]').textContent = `Habitaciones: ${SCOPES[settings.scope]} · Cambiar`;
    get('[data-lights-intensity]').textContent = `Intensidad: ${INTENSITIES[settings.intensity]} · Cambiar`;
    get('[data-lead-value]').textContent = `${settings.lead} ms`;
  }
  get('[data-lights-toggle]').onclick = () => { void lights.setEnabled(!lights.settings.enabled); };
  get('[data-lights-scope]').onclick = () => lights.update({ scope: lights.settings.scope === 'salon' ? 'casa' : 'salon' });
  get('[data-lights-intensity]').onclick = () => {
    const order: Intensity[] = ['suave', 'normal', 'intensa'];
    lights.update({ intensity: order[(order.indexOf(lights.settings.intensity) + 1) % order.length] });
  };
  section.querySelectorAll<HTMLButtonElement>('[data-lead]').forEach(button => {
    button.onclick = () => lights.update({ lead: Math.max(0, Math.min(LEAD_MAX, lights.settings.lead + Number(button.dataset.lead) * LEAD_STEP)) });
  });
  get('[data-lights-test]').onclick = () => lights.test(() => {
    flash.classList.remove('is-on'); void flash.offsetWidth; flash.classList.add('is-on');
  });
  lights.onChange(render);
  render();
}
