import type { createGame } from './game';
import { createEcoFx, type EcoFx } from './eco-fx';

type Game = Awaited<ReturnType<typeof createGame>>;

/**
 * Development: Sincopante's ecos in the effects lab (`?fxlab`, just dev-fx), a section of its panel
 * (src/fx-lab.ts). It calls ecos over the party, raises them, accents them off the beat, joins them
 * in a chord, sends them down in Tutti and turns them back with Da capo, and mutes them as if their
 * wearer had switched ánima (docs/animas/sincopante/README.md § Look and interface). Only the look:
 * nothing it does touches the fight's numbers.
 */
const BUTTONS: [string, string, string][] = [
  ['ostinato', 'Ostinato', 'Un eco que golpea al enemigo elegido'],
  ['bordon', 'Bordón', 'Un eco que cura al primer aliado'],
  ['crescendo', 'Crescendo', 'Los ecos suben un grado: p → mf → f'],
  ['contratiempo', 'A contratiempo', 'Espera al hueco entre dos pulsos y los ecos suenan una vez más'],
  ['tutti', 'Tutti', 'Los ecos se juntan en un gran halo sobre los enemigos'],
  ['dacapo', 'Da capo', 'Con tres ecos: todo vuelve al principio'],
  ['apagados', 'Apagados', 'Quien la lleva cambia de ánima: los ecos siguen, apagados'],
  ['secuencia', 'Secuencia', 'Todo seguido: llamar, subir, el acorde, Da capo y Tutti'],
  ['quitar', 'Quitar ecos', 'Sin ecos'],
];

export function mountEcoLab(game: Game, body: HTMLElement) {
  const section = document.createElement('section');
  section.className = 'fx-lab-ecos';
  section.innerHTML = `<h3>Sincopante · ecos</h3>
    <div class="fx-lab-grid">${BUTTONS.map(([id, name, title]) => `<button type="button" data-eco="${id}" title="${title}">${name}</button>`).join('')}</div>
    <p class="fx-lab-note" data-eco-readout></p>`;
  body.prepend(section);
  const readout = section.querySelector<HTMLElement>('[data-eco-readout]')!;
  let fx: EcoFx | undefined;
  const timers: ReturnType<typeof setTimeout>[] = [];
  let waiting: ReturnType<typeof setInterval> | undefined;

  function ready(): EcoFx | undefined {
    if (fx) return fx;
    if (!game.effects.gpu) { readout.textContent = 'Hace falta simulación en la GPU (WebGPU).'; return undefined; }
    fx = createEcoFx(game.app, game.effects, game.post, {
      fighters: () => game.fighterIds(),
      at: id => game.fighterAt(id),
      model: id => game.battleModel(id),
    });
    return fx;
  }
  const party = () => game.fighterIds().filter(f => f.party).map(f => f.id);
  const foes = () => game.fighterIds().filter(f => !f.party).map(f => f.id);
  /** Who wears it: the second of the party (Aitor, or chapter 1's other boy), or the only one. */
  const wearer = () => party()[1] ?? party()[0];
  const picked = () => (document.querySelector<HTMLSelectElement>('.fx-lab [data-field="target"]')?.value) ?? foes()[0];

  function onOffbeat(run: () => void) {
    const e = ready(); if (!e) return;
    if (waiting) clearInterval(waiting);
    if (e.offbeat) { run(); return; }
    waiting = setInterval(() => { if (e.offbeat) { clearInterval(waiting); waiting = undefined; run(); } }, 16);
  }
  function act(id: string) {
    const e = ready(); if (!e) return;
    const target = foes().includes(picked()) ? picked() : foes()[0];
    if (id === 'ostinato') e.call('ostinato', wearer(), target);
    else if (id === 'bordon') e.call('bordon', wearer(), party()[0]);
    else if (id === 'crescendo') e.crescendo();
    else if (id === 'contratiempo') onOffbeat(() => e.contratiempo());
    else if (id === 'tutti') e.tutti();
    else if (id === 'dacapo') e.dacapo();
    else if (id === 'apagados') { e.setMuffled(!e.muffled); section.querySelector('[data-eco="apagados"]')!.classList.toggle('on', e.muffled); }
    else if (id === 'quitar') { timers.forEach(clearTimeout); timers.length = 0; e.clear(); }
    else if (id === 'secuencia') {
      timers.forEach(clearTimeout); timers.length = 0; e.clear(); e.setMuffled(false);
      const [first, second] = foes();
      const at = (s: number, run: () => void) => timers.push(setTimeout(run, s * 1000));
      at(0, () => e.call('ostinato', wearer(), first));
      at(2.5, () => e.call('bordon', wearer(), party()[0]));
      at(6, () => onOffbeat(() => { e.crescendo(); e.contratiempo(); }));
      at(9.5, () => e.call('ostinato', wearer(), second ?? first));
      at(12, () => onOffbeat(() => { e.crescendo(); e.contratiempo(); }));
      at(15.5, () => e.crescendo());
      at(19, () => e.dacapo());
      at(23, () => e.tutti());
    }
  }
  section.addEventListener('click', event => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-eco]');
    if (!button) return;
    game.frame();
    act(button.dataset.eco!);
  });
  const tick = setInterval(() => {
    if (!fx) return;
    const marks = '○○○○○'.split('').map((c, i) => i === Math.floor(fx!.phase * 5) ? '●' : c).join('');
    readout.textContent = fx.count ? `Compás ${marks} · ${fx.count} eco${fx.count > 1 ? 's' : ''}${fx.offbeat ? ' · contratiempo' : ''}${fx.muffled ? ' · apagados' : ''}` : '';
    readout.hidden = !readout.textContent;
  }, 100);

  const api = {
    /** Development and screenshots: the ecos' piece itself. */
    get fx() { return ready(); },
    act,
    destroy() { clearInterval(tick); if (waiting) clearInterval(waiting); timers.forEach(clearTimeout); fx?.destroy(); section.remove(); },
  };
  // For the screenshot scenarios and the console: window.ecoLab.act('crescendo').
  (globalThis as unknown as { ecoLab?: typeof api }).ecoLab = api;
  return api;
}
