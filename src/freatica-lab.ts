import type { createGame } from './game';
import { createFreaticaFx, type FreaticaFx } from './freatica-fx';

type Game = Awaited<ReturnType<typeof createGame>>;

/**
 * Development: Freática's water in the effects lab (`?fxlab`, just dev-fx), a section of its panel
 * (src/fx-lab.ts). It raises the water under the foes mark by mark, lets a mark drain, charges it,
 * turns its top mark to steam, lowers it and breaks the cell, with grey edges (the ánima's first
 * round) or its own, and plays each skill's own look on it (docs/animas/freatica/README.md § Look
 * and interface). Only the look: nothing it does touches the fight's numbers.
 */
const BUTTONS: [string, string, string][] = [
  ['subir', 'Subir marca', 'El agua brota del suelo y sube una marca (tres como mucho)'],
  ['corriente', 'Corriente', 'Electricidad: el agua se queda con corriente 10 s y pulsa cada 2'],
  ['vapor', 'Vapor', 'Fuego: la marca de arriba se va en vapor, que se queda sobre los enemigos'],
  ['bajar', 'Bajar marca', 'Una marca gastada (Bombeo): el agua baja sin vapor'],
  ['drenar', 'Drenar rápido', 'El reloj corre diez veces más deprisa: la superficie baja hasta su marca y cae a la de abajo'],
  ['romper', 'Romper celda', 'Cae quien la sostiene: las aristas se apagan y el agua se va por el suelo'],
  ['color', 'Color', 'Aristas y regla grises (primera vuelta) o en su color (segunda)'],
  ['secuencia', 'Secuencia', 'Todo seguido: tres marcas, corriente, vapor y la celda rota'],
  ['quitar', 'Quitar agua', 'Sin agua'],
];
/** Each skill's own look on the cell (docs/animas/freatica/README.md § Look and interface). */
const SKILLS: [string, string, string][] = [
  ['recarga', 'Recarga', 'La cinta corre por el suelo hasta el enemigo, el agua brota y sube una marca'],
  ['sondeo', 'Sondeo eléctrico', 'Un rayo al enemigo que baja al agua: la corriente dura el doble'],
  ['bombeo', 'Bombeo', 'El agua baja una marca y sube alrededor del equipo'],
  ['riada', 'Riada', 'Una ola cruza la celda y el agua sube dos marcas'],
  ['ariete', 'Golpe de ariete', 'Un golpe por cada marca: el agua se gasta entera'],
  ['bajoCero', 'Bajo cero', 'La definitiva: el agua se congela alrededor de cada enemigo, hasta donde llegaba'],
  ['golpe', 'Golpe al hielo', 'Un golpe desde fuera: el hielo se agrieta, y al tercero se rompe'],
  ['turno', 'Pasa un turno', 'El hielo baja una marca; con la última se va'],
];

export function mountFreaticaLab(game: Game, body: HTMLElement) {
  const section = document.createElement('section');
  section.className = 'fx-lab-ecos';
  section.innerHTML = `<h3>Freática · agua contenida</h3>
    <div class="fx-lab-grid">${BUTTONS.map(([id, name, title]) => `<button type="button" data-agua="${id}" title="${title}">${name}</button>`).join('')}</div>
    <div class="fx-lab-grid">${SKILLS.map(([id, name, title]) => `<button type="button" data-agua="${id}" title="${title}">${name}</button>`).join('')}</div>
    <p class="fx-lab-note" data-agua-readout></p>`;
  body.prepend(section);
  const readout = section.querySelector<HTMLElement>('[data-agua-readout]')!;
  let fx: FreaticaFx | undefined, fast = false;
  const timers: ReturnType<typeof setTimeout>[] = [];

  function ready(): FreaticaFx | undefined {
    if (fx) return fx;
    if (!game.effects.gpu) { readout.textContent = 'Hace falta simulación en la GPU (WebGPU).'; return undefined; }
    fx = createFreaticaFx(game.app, game.effects, { fighters: () => game.fighterIds(), at: id => game.fighterAt(id), model: id => game.battleModel(id) });
    return fx;
  }
  function act(id: string) {
    const e = ready(); if (!e) return;
    if (id === 'recarga' || id === 'sondeo' || id === 'bombeo' || id === 'riada' || id === 'ariete' || id === 'bajoCero') e.cast[id]();
    else if (id === 'golpe') e.strike();
    else if (id === 'turno') e.turn();
    else if (id === 'subir') e.raise();
    else if (id === 'corriente') e.bolt();
    else if (id === 'vapor') e.steam();
    else if (id === 'bajar') e.lower();
    else if (id === 'drenar') { fast = !fast; e.setRate(fast ? 10 : 1); section.querySelector('[data-agua="drenar"]')!.classList.toggle('on', fast); }
    else if (id === 'romper') e.break();
    else if (id === 'color') e.setGrey(!e.grey);
    else if (id === 'quitar') { timers.forEach(clearTimeout); timers.length = 0; e.clear(); }
    else if (id === 'secuencia') {
      timers.forEach(clearTimeout); timers.length = 0; e.clear();
      const at = (s: number, run: () => void) => timers.push(setTimeout(run, s * 1000));
      at(0, () => e.raise());
      at(2.2, () => e.raise());
      at(4.2, () => e.raise());
      at(6.6, () => e.bolt(6));
      at(11.5, () => e.steam(6));
      at(14.5, () => e.break());
    }
  }
  section.addEventListener('click', event => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-agua]');
    if (!button) return;
    game.frame();
    act(button.dataset.agua!);
  });
  const tick = setInterval(() => {
    if (!fx) return;
    readout.textContent = fx.on ? `Agua ${'I'.repeat(fx.marks) || '0'} · ${fx.level.toFixed(2)} m · ${Math.ceil(fx.left * 20)} s${fx.current > 0 ? ` · corriente ${Math.ceil(fx.current)} s` : ''}${fx.marks === 3 ? ' · hundidos' : ''}${fx.frozen ? ` · bajo cero (grietas ${fx.cracks.map(c => c.blows).join(', ')})` : ''}${fx.grey ? ' · gris' : ''}` : '';
    readout.hidden = !readout.textContent;
  }, 100);

  const api = {
    /** Development and screenshots: the water's piece itself. */
    get fx() { return ready(); },
    act,
    destroy() { clearInterval(tick); timers.forEach(clearTimeout); fx?.destroy(); section.remove(); },
  };
  // For the screenshot scenarios and the console: window.freaticaLab.act('subir').
  (globalThis as unknown as { freaticaLab?: typeof api }).freaticaLab = api;
  return api;
}
