import type { AudioSettings, GameAudio } from './audio';

const STEP = .1;
const LEVELS: { key: 'music' | 'sfx'; label: string }[] = [{ key: 'music', label: 'MÚSICA' }, { key: 'sfx', label: 'EFECTOS' }];

/** The menu's "Sonido" page: music and effects levels in steps, and a switch to mute it all. */
export function mountSoundPage(section: HTMLElement, audio: GameAudio) {
  section.innerHTML = `
    <p class="menu-intro">Que suene a tu gusto.</p>
    <div class="lights-options"><button data-mute></button></div>
    ${LEVELS.map(({ key, label }) => `<div class="lights-lead sound-level" data-level="${key}">
      <span class="battle-kicker">${label}</span>
      <button data-step="-1" aria-label="Bajar ${label.toLowerCase()}">−</button><output></output><button data-step="1" aria-label="Subir ${label.toLowerCase()}">+</button>
    </div>`).join('')}
    <p class="controller-note">Se guarda en este navegador.</p>`;
  const get = <T extends HTMLElement>(selector: string) => section.querySelector<T>(selector)!;
  function render() {
    const { settings } = audio;
    get('[data-mute]').textContent = settings.muted ? 'Sin sonido · Activar' : 'Con sonido · Silenciar';
    for (const { key } of LEVELS) get(`[data-level="${key}"] output`).textContent = `${Math.round(settings[key] * 100)} %`;
    // The Configuración list next to this page shows the same state on its Sonido row.
    const summary = section.parentElement?.querySelector('[data-sound-summary]');
    if (summary) summary.textContent = settings.muted ? 'Silenciado' : `Música ${Math.round(settings.music * 100)} %`;
  }
  get('[data-mute]').onclick = () => audio.update({ muted: !audio.settings.muted });
  section.querySelectorAll<HTMLButtonElement>('[data-step]').forEach(button => {
    const key = button.closest<HTMLElement>('[data-level]')!.dataset.level as keyof Pick<AudioSettings, 'music' | 'sfx'>;
    // Rounded to whole steps so ten presses always land on 0 or 100 %. The press's own menu sound
    // glides to the new level as it plays, which is how the effects level is heard.
    button.onclick = () => audio.update({ [key]: Math.round((audio.settings[key] + Number(button.dataset.step) * STEP) * 10) / 10 });
  });
  audio.onChange(render);
  render();
}
