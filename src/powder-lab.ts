import type { createGame } from './game';
import { createPowderFx, POWDER_COLOURS, POWDER_GREY, type PowderFx, type PowderMix } from './powder-fx';

type Game = Awaited<ReturnType<typeof createGame>>;

/**
 * Development: the coloured powder of Luca's ánima in the effects lab (`?fxlab`, just dev-fx), a
 * section of its panel (src/fx-lab.ts). It plays the puff alone, a handful thrown at the foe picked,
 * one for every foe, the powder left on someone, what fire and water make of it afterwards, and the
 * cortina (the screen of powder in front of an ally, and the blow that breaks it), in the grey of
 * the ánima's first round or in its muted mixes (docs/animas/prismatico/README.md § Look and
 * interface). Only the look: nothing it does touches the fight's numbers.
 */
const BUTTONS: [string, string, string][] = [
  ['puff', 'Puff', 'Solo el puff: el polvo estalla, se frena en el aire y se queda flotando'],
  ['lanzar', 'Puñado', 'Un puñado lanzado al enemigo elegido: cruza, estalla y lo deja cubierto de polvo'],
  ['nube', 'A todos', 'Un puñado para cada enemigo, cada uno con su mezcla'],
  ['polvo', 'Cubierto', 'El estado solo: polvo pegado al cuerpo, que suelta granos'],
  ['fuego', 'Fuego', 'Fuego sobre el polvo: explota, alcanza a los de al lado y los deja quemados'],
  ['agua', 'Agua', 'Agua sobre el polvo: se corre, verdea y los envenena'],
  ['cortina', 'Cortina', 'Una cortina de polvo ante un aliado: la mitad del siguiente golpe'],
  ['telon', 'Telón', 'Una cortina ante cada aliado'],
  ['romper', 'Romper', 'El golpe del enemigo elegido rompe una cortina: le cae encima y lo deja empolvado'],
  ['color', 'Color', 'Gris (primera vuelta) o mezclas apagadas (segunda)'],
  ['quitar', 'Quitar polvo', 'Sin polvo ni estados'],
];

export function mountPowderLab(game: Game, body: HTMLElement) {
  const section = document.createElement('section');
  section.className = 'fx-lab-ecos';
  section.innerHTML = `<h3>Polvo de colores · el ánima de Luca</h3>
    <div class="fx-lab-grid">${BUTTONS.map(([id, name, title]) => `<button type="button" data-powder="${id}" title="${title}">${name}</button>`).join('')}</div>
    <p class="fx-lab-note" data-powder-readout></p>`;
  body.prepend(section);
  const readout = section.querySelector<HTMLElement>('[data-powder-readout]')!;
  let fx: PowderFx | undefined, grey = false, turn = 0;

  function ready(): PowderFx | undefined {
    if (fx) return fx;
    if (!game.effects.gpu) { readout.textContent = 'Hace falta simulación en la GPU (WebGPU).'; return undefined; }
    fx = createPowderFx(game.app, game.effects, {
      model: id => game.battleModel(id),
      onBurn: id => game.status(id, 'quemado', 1),
      onPoison: id => game.status(id, 'envenenado', 1),
    });
    return fx;
  }
  const party = () => game.fighterIds().filter(f => f.party).map(f => f.id);
  const foes = () => game.fighterIds().filter(f => !f.party).map(f => f.id);
  /** Who wears it: the second of the party (Aitor, or chapter 1's other boy), or the only one. */
  const wearer = () => party()[1] ?? party()[0];
  const picked = () => (document.querySelector<HTMLSelectElement>('.fx-lab [data-field="target"]')?.value) ?? foes()[0];
  /** The next mix: always the grey in the first round; in the second, two parts of one colour of the palette and one each of two others, a different one leading each time. */
  const colour = (): PowderMix => {
    if (grey) return POWDER_GREY;
    const n = POWDER_COLOURS.length, i = turn++ * 2;
    return [POWDER_COLOURS[i % n], POWDER_COLOURS[i % n], POWDER_COLOURS[(i + 1) % n], POWDER_COLOURS[(i + 3) % n]];
  };
  const say = () => { readout.textContent = grey ? 'Gris: primera vuelta' : 'Mezclas apagadas: segunda vuelta'; };
  /** Where the foes stand, as one point: what a cortina faces. */
  const front = () => {
    const at = foes().map(f => game.fighterAt(f)).filter(p => !!p);
    return at.reduce((sum, p) => ({ x: sum.x + p.x / at.length, y: sum.y + p.y / at.length, z: sum.z + p.z / at.length }), { x: 0, y: 0, z: 0 });
  };

  function act(id: string) {
    const e = ready(); if (!e) return;
    const target = foes().includes(picked()) ? picked() : foes()[0];
    if (id === 'puff') { const at = game.fighterAt(target); if (at) e.puff({ x: at.x, y: at.y + .95, z: at.z }, colour(), undefined, 1, at.y); }
    else if (id === 'lanzar') e.lanzar(wearer(), target, colour());
    else if (id === 'nube') e.nube(wearer(), foes(), [colour(), colour(), colour()]);
    else if (id === 'polvo') e.dust(target, colour());
    else if (id === 'fuego') e.ignite(foes());
    else if (id === 'agua') e.soak();
    else if (id === 'cortina') e.cortina(party().find(p => p !== wearer()) ?? wearer(), front(), colour());
    else if (id === 'telon') for (const ally of party()) e.cortina(ally, front(), colour());
    else if (id === 'romper') { const behind = e.screens[0]; if (behind) e.romper(behind, target); }
    else if (id === 'color') { grey = !grey; say(); }
    else if (id === 'quitar') { e.clear(); for (const f of foes()) { game.status(f, 'quemado', 0); game.status(f, 'envenenado', 0); } }
  }
  section.addEventListener('click', event => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-powder]');
    if (!button) return;
    game.frame();
    act(button.dataset.powder!);
  });
  say();

  const api = {
    /** Development and screenshots: the powder's piece itself. */
    get fx() { return ready(); },
    act,
    /** Grey (the first round) or Luca's colours. */
    setGrey(on: boolean) { grey = on; say(); },
    destroy() { fx?.destroy(); section.remove(); },
  };
  // For the screenshot scenarios and the console: window.powderLab.act('lanzar').
  (globalThis as unknown as { powderLab?: typeof api }).powderLab = api;
  return api;
}
