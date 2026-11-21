import type { createGame } from './game';
import { AGUA, createFreaticaField, type FreaticaField } from './freatica-fx';

type Game = Awaited<ReturnType<typeof createGame>>;

/**
 * Development: Freática's water in the effects lab (`?fxlab`, just dev-fx), a section of its panel
 * (src/fx-lab.ts). Every foe has its own cell: it raises the water of the one chosen mark by mark,
 * lets a mark drain, charges it, turns its top mark to steam, lowers it and breaks the cells, with
 * grey edges (the ánima's first round) or their own, and plays each skill's own look, down to the
 * ice of its definitiva (docs/animas/freatica/README.md § Look and interface). Only the look:
 * nothing it does touches the fight's numbers.
 */
const BUTTONS: [string, string, string][] = [
  ['subir', 'Subir marca', 'El agua brota del suelo bajo el enemigo elegido y sube una marca (tres como mucho)'],
  ['corriente', 'Corriente', 'Electricidad: corre por todos los que tienen agua y se queda en ella 10 s, pulsando cada 2'],
  ['vapor', 'Vapor', 'Fuego: la marca de arriba se va en vapor, que se queda sobre el enemigo'],
  ['bajar', 'Bajar marca', 'Una marca gastada: el agua baja sin vapor'],
  ['drenar', 'Drenar rápido', 'El reloj corre diez veces más deprisa: la superficie baja hasta su marca y cae a la de abajo'],
  ['romper', 'Romper celdas', 'Cae quien las sostiene: las aristas se apagan y el agua se va por el suelo'],
  ['color', 'Color', 'Aristas y regla grises (primera vuelta) o en su color (segunda)'],
  ['secuencia', 'Secuencia', 'Todo seguido: agua distinta en cada uno, corriente, vapor y las celdas rotas'],
  ['quitar', 'Quitar agua', 'Sin agua'],
];
/** Each skill's own look on the cells (docs/animas/freatica/README.md § Look and interface). */
const SKILLS: [string, string, string][] = [
  ['recarga', 'Recarga', 'La cinta corre por el suelo hasta el enemigo, el agua brota y sube una marca'],
  ['sondeo', 'Sondeo eléctrico', 'Un rayo al enemigo que baja a su agua y corre por la de los demás: la corriente dura el doble'],
  ['bombeo', 'Bombeo', 'El agua de quien más tiene baja una marca y sube alrededor del equipo'],
  ['riada', 'Riada', 'Una ola cruza cada celda y el agua de todos sube una marca'],
  ['ariete', 'Golpe de ariete', 'A cada uno, un golpe por cada marca de su agua, que se gasta entera'],
  ['bajoCero', 'Bajo cero', 'La definitiva: con alguno en la tercera marca, se congelan todos los que tienen agua, hasta donde les llegaba'],
  ['golpe', 'Golpe al hielo', 'Un golpe leve o medio desde fuera: el hielo aguanta ocho'],
  ['golpeFuerte', 'Golpe alto al hielo', 'Un golpe alto cuenta por dos: cuatro lo rompen. Cuanto menos hielo queda, menos estalla'],
  ['rafaga', 'Ráfaga de cuatro', 'Cada golpe de una ráfaga cuenta uno: cuatro zarpazos son medio hielo'],
  ['rafagaDual', 'Ráfaga de ocho', 'Los ocho de un dúo rompen un hielo entero de una vez'],
  ['fundir', 'Llama al hielo', 'El fuego no lo agrieta: derrite una marca de golpe. Solo, se derrite una marca cada 20 s'],
];
const ROMAN = ['0', 'I', 'II', 'III'];

export function mountFreaticaLab(game: Game, body: HTMLElement) {
  const section = document.createElement('section');
  section.className = 'fx-lab-ecos';
  const row = (list: [string, string, string][]) => `<div class="fx-lab-grid">${list.map(([id, name, title]) => `<button type="button" data-agua="${id}" title="${title}">${name}</button>`).join('')}</div>`;
  section.innerHTML = `<h3>Freática · agua contenida</h3>
    <label class="fx-lab-note">Enemigo <select data-agua-target></select></label>
    ${row(BUTTONS)}${row(SKILLS)}
    <p class="fx-lab-note" data-agua-readout></p>`;
  body.prepend(section);
  const readout = section.querySelector<HTMLElement>('[data-agua-readout]')!, target = section.querySelector<HTMLSelectElement>('[data-agua-target]')!;
  let fx: FreaticaField | undefined, fast = false;
  const timers: ReturnType<typeof setTimeout>[] = [];

  function ready(): FreaticaField | undefined {
    if (fx) return fx;
    if (!game.effects.gpu) { readout.textContent = 'Hace falta simulación en la GPU (WebGPU).'; return undefined; }
    fx = createFreaticaField(game.app, game.effects, { fighters: () => game.fighterIds(), at: id => game.fighterAt(id), model: id => game.battleModel(id) });
    target.innerHTML = fx.foes().map((id, i) => `<option value="${id}">${i + 1}</option>`).join('');
    return fx;
  }
  function act(id: string) {
    const e = ready(); if (!e) return;
    const foe = target.value || undefined;
    if (id === 'recarga' || id === 'sondeo') e.cast[id](foe);
    else if (id === 'bombeo' || id === 'riada' || id === 'ariete' || id === 'bajoCero') e.cast[id]();
    else if (id === 'golpe') e.strike(foe, 1);
    else if (id === 'golpeFuerte') e.strike(foe, 2);
    else if (id === 'rafaga') e.flurry(foe, 4);
    else if (id === 'rafagaDual') e.flurry(foe, 8);
    else if (id === 'fundir') e.melt(foe);
    else if (id === 'subir') e.raise(foe);
    else if (id === 'corriente') e.bolt(foe);
    else if (id === 'vapor') e.steam(foe);
    else if (id === 'bajar') e.lower(foe);
    else if (id === 'drenar') { fast = !fast; e.setRate(fast ? 10 : 1); section.querySelector('[data-agua="drenar"]')!.classList.toggle('on', fast); }
    else if (id === 'romper') e.break();
    else if (id === 'color') e.setGrey(!e.grey);
    else if (id === 'quitar') { timers.forEach(clearTimeout); timers.length = 0; e.clear(); }
    else if (id === 'secuencia') {
      timers.forEach(clearTimeout); timers.length = 0; e.clear();
      const at = (s: number, run: () => void) => timers.push(setTimeout(run, s * 1000));
      const [a, b] = e.foes();
      at(0, () => e.raise(a));
      at(1.4, () => e.raise(b));
      at(2.4, () => e.raise(a));
      at(4.4, () => e.raise(a));
      at(6.8, () => e.bolt(a, 6));
      at(11.5, () => e.steam(a, 6));
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
    readout.textContent = fx.state().map((c, i) => `${i + 1}: ${c.frozen ? `hielo ${ROMAN[c.marks]} · ${Math.ceil(c.ice * AGUA.ice)} s${c.cracked ? ` · ${Math.round(c.cracked * AGUA.blows)} de ${AGUA.blows} golpes` : ''}` : c.marks ? `agua ${ROMAN[c.marks]} · ${Math.ceil(c.left * 20)} s${c.current > 0 ? ` · corriente ${Math.ceil(c.current)} s` : ''}${c.marks === 3 ? ' · hundido' : ''}` : 'seco'}`).join('   ') + (fx.grey ? '   · gris' : '');
  }, 100);

  const api = {
    /** Development and screenshots: the fight's water itself, a cell for each foe. */
    get fx() { return ready(); },
    act,
    destroy() { clearInterval(tick); timers.forEach(clearTimeout); fx?.destroy(); section.remove(); },
  };
  // For the screenshot scenarios and the console: window.freaticaLab.act('subir').
  (globalThis as unknown as { freaticaLab?: typeof api }).freaticaLab = api;
  return api;
}
