import * as pc from 'playcanvas';
import type { createGame } from './game';
import { galtonBinX, galtonPath, galtonPegs, lorenzPoints, type GpuKind, type GpuLaw } from './fight-particles.ts';
import { ensureFluidKinds } from './fluid-fx.ts';

type Game = Awaited<ReturnType<typeof createGame>>;
interface V3 { x: number; y: number; z: number }

/**
 * Development: the GPU engine's laws, mirror and fire front in the effects lab (`?fxlab`, just dev-fx), a
 * section of its panel (src/fx-lab.ts). What Matemágico's newer pieces are built on, shown bare
 * (docs/graphics.md § Fight particles on the GPU): particles following the Lorenz field until ρ falls
 * and it collapses, a Galton board whose balls fall where their paths say, a parabolic mirror focusing
 * parallel sparks, a cloud of gas a front of fire runs through, and bubbles that rise fast in water and
 * drift out of it. Only the look, on the fight's clock: nothing here touches the fight.
 *
 * Gold is Matemágico's (#f3cf78); the rest keeps to fire, water and white (docs/visual-style.md).
 */
const GOLD = '#f3cf78';
export const LAW_LAB_KINDS = {
  // A mote carried by a law: small, bright, long-lived, nothing pulling it but the law.
  'ley-mota': {
    shape: 'glow', size: [.02, .016], sizeJitter: .4, gravity: 0, drag: 0, curl: 0, colours: ['#fff6dc', GOLD, '#c98a2c'], intensity: [1.8, 1.4, .9], middle: .05,
    fadeIn: .04, fadeOut: .05, additive: 1, opacity: .7, core: .25,
  },
  // A thread of light along a law's flow: chains whose leader follows the law and the rest trail it.
  'ley-hilo': {
    shape: 'strand', size: [.006, .004], gravity: 0, drag: 0, follow: 26, colours: ['#fffaf0', GOLD, '#b8792a'], intensity: [2.4, 1.8, 1], middle: .4, fadeIn: .1, fadeOut: .25, core: .4,
  },
  // A ball on the Galton board.
  'ley-bola': {
    shape: 'glow', size: [.06, .06], gravity: 0, drag: 0, collide: true, bounce: .2, friction: .6, settle: true, colours: ['#ffffff', GOLD, '#e0a640'], intensity: [3, 2.4, 1.6], middle: .2,
    fadeIn: .02, fadeOut: .08, core: .7,
  },
  // A peg, a mirror's outline: points of light that stay where they are put.
  'ley-punto': {
    shape: 'dot', size: [.026, .026], gravity: 0, drag: 40, colours: ['#fff2c8', GOLD, GOLD], intensity: [2.4, 2, 1.6], middle: .1, fadeIn: .15, fadeOut: .15, core: .5,
  },
  // A spark that sees mirrors, falling in a straight line.
  'ley-chispa': {
    shape: 'spark', size: [.012, .008], stretch: .05, gravity: 0, drag: 0, mirror: true, colours: ['#ffffff', '#ffe58a', '#ff9a2a'], intensity: [3.4, 2.6, 1.4], middle: .5,
    fadeIn: .02, fadeOut: .25,
  },
  // Gas: beads of glass hanging in a loose cloud; within reach of fire, they catch.
  'ley-gas': {
    shape: 'glow', glass: .8, size: [.03, .03], sizeJitter: .4, gravity: 0, drag: 2, curl: .12, cohesion: .4, radius: .3, colours: ['#f4fbff', '#cfeaf2', '#9fc9d6'], intensity: [1.2, 1, .9], middle: .5,
    fadeIn: .3, fadeOut: .2, additive: .5, opacity: .8, core: 0, ignite: { into: 'ley-llama', delay: .05, radius: .22 },
  },
  // The gas burning: a puff that swells and rises, white-hot to orange to soot.
  'ley-llama': {
    shape: 'glow', size: [.05, .17], sizeJitter: .4, gravity: -2.2, drag: 1.4, curl: .6, response: .5, blur: [.4, 1], life: [.45, .8],
    colours: ['#fff1c4', '#ff8a24', '#3a2a24'], intensity: [3.4, 2.2, .4], middle: .25, fadeIn: .02, fadeOut: .45, additive: .7, core: .3,
  },
  // A bubble: rises fast in water, drifts out of it.
  'ley-burbuja': {
    shape: 'glow', glass: .9, size: [.035, .04], sizeJitter: .5, gravity: -.25, drag: 3.5, curl: .15, colours: ['#ffffff', '#ffffff', '#e4fbff'], intensity: [2.4, 2.2, 1.8], middle: .5,
    fadeIn: .1, fadeOut: .3, additive: .5, core: 0, bubble: { lift: 9, flow: 2 },
  },
  // The flash where a collapse ends.
  'ley-destello': {
    shape: 'star', size: [.05, .02], sizeJitter: .5, gravity: 0, drag: 2, colours: ['#ffffff', '#fff0c0', GOLD], intensity: [4, 3, 1.6], middle: .3, fadeOut: .5,
  },
} satisfies Record<string, GpuKind>;

const BUTTONS: [string, string, string][] = [
  ['lorenz', 'Atractor de Lorenz', 'Corrientes de cuatro colores entran en el campo de Lorenz y tejen sus dos lóbulos'],
  ['bifurcacion', 'Bifurcación', 'ρ baja de 28 a 0,5 en 0,8 s: el atractor se hunde en su origen'],
  ['galton', 'Tablero de Galton', 'Bolas al azar dibujan la campana; tres de oro caen donde dice su camino (cubetas 3, 4 y 6)'],
  ['espejo', 'Espejo parabólico', 'Chispas paralelas rebotan en un paraboloide y se cruzan en su foco: la cáustica'],
  ['ignicion', 'Frente de ignición', 'Una nube de gas; se enciende un extremo y el frente la cruza'],
  ['burbujas', 'Burbujas', 'Burbujas en agua contenida: suben deprisa dentro, se quedan flotando fuera'],
  ['quitar', 'Quitar', 'Quita leyes, volúmenes y partículas'],
];

export function mountLawLab(game: Game, body: HTMLElement) {
  const section = document.createElement('section');
  section.className = 'fx-lab-ecos';
  section.innerHTML = `<h3>Partículas · leyes, espejo y fuego</h3>
    <div class="fx-lab-grid">${BUTTONS.map(([id, name, title]) => `<button type="button" data-ley="${id}" title="${title}">${name}</button>`).join('')}</div>
    <p class="fx-lab-note" data-ley-readout></p>`;
  body.prepend(section);
  const readout = section.querySelector<HTMLElement>('[data-ley-readout]')!;
  const app = game.app;
  // On the fight's clock (screenshots drive it frame by frame): what to run when, and what runs every frame.
  let clock = 0;
  const later: { at: number; run: () => void }[] = [];
  const every = new Set<(dt: number) => void>();
  const after = (s: number, run: () => void) => later.push({ at: clock + s, run });
  const onUpdate = (dt: number) => {
    clock += dt;
    for (const t of later.filter(t => t.at <= clock)) { later.splice(later.indexOf(t), 1); t.run(); }
    every.forEach(f => f(dt));
  };
  app.on('update', onUpdate);
  const owned: { remove(): void }[] = [];
  let lorenz: GpuLaw | undefined;

  const gpu = () => {
    const g = game.effects.gpu;
    if (!g || !g.active) { readout.textContent = 'Hace falta simulación en la GPU (WebGPU) en un combate.'; return undefined; }
    for (const [name, kind] of Object.entries(LAW_LAB_KINDS)) if (!g.get(name)) g.define(name, kind);
    ensureFluidKinds(g);
    return g;
  };
  /** The foe in the middle, the first ally, and the way the camera looks (flat). */
  function scene() {
    const ids = game.fighterIds(), foe = ids.filter(f => !f.party)[1] ?? ids.find(f => !f.party), ally = ids.find(f => f.party);
    const at = foe && game.fighterAt(foe.id), from = ally && game.fighterAt(ally.id);
    const camera = (app.root.findComponents('camera') as pc.CameraComponent[]).find(c => c.enabled && c.entity.enabled);
    const forward = camera?.entity.forward ?? new pc.Vec3(0, 0, -1);
    const yaw = Math.atan2(-forward.x, -forward.z) * 180 / Math.PI;
    // `screen`: the camera's own axes, for a figure standing in the picture's plane.
    const screen = camera?.entity.getRotation().clone() ?? new pc.Quat();
    return at && from ? { at, from, facing: new pc.Quat().setFromEulerAngles(0, yaw, 0), screen } : undefined;
  }
  function clear() {
    later.length = 0; every.clear();
    owned.forEach(o => o.remove()); owned.length = 0; lorenz = undefined;
    game.effects.gpu?.clear();
  }
  const add = (x: V3, y: V3) => ({ x: x.x + y.x, y: x.y + y.y, z: x.z + y.z });
  const turned = (q: pc.Quat, v: V3) => { const out = q.transformVector(new pc.Vec3(v.x, v.y, v.z)); return { x: out.x, y: out.y, z: out.z }; };

  const demos: Record<string, () => string | void> = {
    lorenz() {
      const g = gpu(), s = scene(); if (!g || !s) return;
      clear();
      game.frame({ x: s.at.x, y: s.at.y + 1.3, z: s.at.z }, 3.6);
      const origin = { x: s.at.x, y: s.at.y + .15, z: s.at.z };
      const law = lorenz = g.law('lorenz', { at: origin, rotation: s.facing, scale: .05, grip: 30 });
      owned.push(law);
      // Already on it: small clouds strung along an orbit worked out on the CPU, as a figure drawn over it would be.
      lorenzPoints(90, { step: .02 }).forEach((p, i) => {
        const at = add(origin, turned(s.facing, p));
        g.burst('ley-mota', { at, count: 70, spread: .05, life: [24, 30], law });
        if (i % 3 === 0) g.burst('ley-hilo', { at, count: 36, spread: .04, chain: 12, life: [24, 30], law });
      });
      // Streams from four sides, each its own colour, thrown in and caught by the field.
      const streams: [V3, string][] = [[{ x: -2.4, y: .4, z: 0 }, '#ff8a3d'], [{ x: 2.4, y: .5, z: 0 }, '#5fd9e8'], [{ x: -1.6, y: 2.6, z: -.6 }, '#f4f1e8'], [{ x: 1.8, y: 2.4, z: .4 }, '#9fe07a']];
      streams.forEach(([off, colour], i) => after(.3 + i * .35, () => {
        const from = add(origin, turned(s.facing, off));
        const e = g.emitter('ley-mota', { at: from, rate: 1600, spread: .12, speed: .4, life: [22, 28], colour, law });
        owned.push(e);
        after(2.2, () => e.remove());
      }));
      return 'Lorenz: σ 10, ρ 28, β 8/3, a 0,05 m la unidad';
    },
    bifurcacion() {
      const g = gpu(); if (!g) return;
      if (!lorenz?.alive) { demos.lorenz(); after(3.4, () => demos.bifurcacion()); return 'Primero el atractor; la bifurcación a los 3,4 s'; }
      const law = lorenz;
      let t = 0;
      const fall = (dt: number) => {
        t += dt;
        const k = Math.min(1, t / .8), ease = k * k * (3 - 2 * k);
        law.params[1] = 28 + (.5 - 28) * ease;
        // Faster as it falls, so it is all in by the end.
        law.params[3] = .5 + 3.5 * ease;
        if (t >= 1.3) {
          every.delete(fall);
          g.burst('ley-destello', { at: law.at, count: 140, spread: .05, speed: 3.2, life: [.4, .9], light: { intensity: 4, range: 4, colour: GOLD } });
          after(.35, () => law.remove());
        }
      };
      every.add(fall);
      return 'ρ: 28 → 0,5 en 0,8 s';
    },
    galton() {
      const g = gpu(), s = scene(); if (!g || !s) return;
      clear();
      const rows = 8, rowGap = .3, pegGap = .27;
      const apex = { x: s.at.x, y: s.at.y + 3.3, z: s.at.z };
      game.frame({ x: apex.x, y: apex.y - 1.5, z: apex.z }, 4.2);
      // Standing in the picture's plane, so the board reads whole; it falls along the picture's down.
      const law = g.law('galton', { at: apex, rotation: s.screen, params: [rows, rowGap, pegGap, 26], bounce: .3, spark: 2.5, spread: .01 });
      owned.push(law);
      for (const p of galtonPegs(rows, rowGap, pegGap)) g.burst('ley-punto', { at: add(apex, turned(s.screen, { x: p.x, y: p.y - .05, z: 0 })), count: 1, life: [7, 7], size: 1.4 });
      // The bin line.
      for (let b = 0; b <= rows; b++) g.burst('ley-punto', { at: add(apex, turned(s.screen, { x: galtonBinX(b, rows, pegGap), y: -rows * rowGap - .05, z: 0 })), count: 1, life: [7, 7], size: .6, colour: '#d8c8a0' });
      const drop = add(apex, turned(s.screen, { x: 0, y: .3, z: 0 }));
      // Ghosts: random paths, so the many make a bell.
      let made = 0;
      const rain = () => { g.burst('ley-bola', { at: drop, count: 2, spread: .01, life: [4.5, 5], size: .7, colour: '#cfe6ee', law }); if (++made < 200) after(.012, rain); };
      rain();
      // Three of gold, each where its path says.
      [3, 4, 6].forEach((bin, i) => after(.4 + i * .25, () => g.burst('ley-bola', { at: drop, count: 6, spread: .02, life: [4.5, 5], size: 1.6, path: galtonPath(bin, rows), law })));
      after(5, () => law.remove());
      return 'Galton: 8 filas; las de oro van a las cubetas 3, 4 y 6';
    },
    espejo() {
      const g = gpu(), s = scene(); if (!g || !s) return;
      clear();
      const mid = { x: (s.at.x + s.from.x) / 2, y: s.at.y, z: (s.at.z + s.from.z) / 2 };
      const f = 1.1, rim = 1.25;
      game.frame({ x: mid.x, y: mid.y + 1.2, z: mid.z }, 3.6);
      const mirror = g.volume({ shape: 'paraboloid', mode: 'mirror', at: { ...mid, y: mid.y + .03 }, size: { x: f, y: rim, z: .02 } });
      owned.push(mirror);
      // Its outline: rings and meridians of light on the dish.
      for (const r of [.25, .5, .75, 1, rim]) { const n = Math.round(r * 40); for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; g.burst('ley-punto', { at: { x: mid.x + Math.cos(a) * r, y: mid.y + .03 + r * r / (4 * f), z: mid.z + Math.sin(a) * r }, count: 1, life: [6, 6], size: 1.2 }); } }
      g.burst('ley-punto', { at: { x: mid.x, y: mid.y + .03 + f, z: mid.z }, count: 1, life: [6, 6], size: 1.6, colour: '#ffffff' });
      // Rain falling along its axis, a few degrees off so the rays draw the caustic instead of one point.
      let ticks = 0;
      const rain = () => {
        g.burst('ley-chispa', { at: { x: mid.x, y: mid.y + 3.4, z: mid.z }, count: 45, spread: rim * .98, velocity: { x: .55, y: -6, z: 0 }, speed: 0, cone: 0, life: [1.1, 1.3] });
        if (++ticks < 90) after(1 / 30, rain);
      };
      rain();
      after(5.5, () => mirror.remove());
      return `Paraboloide: foco a ${f} m del vértice, borde de ${rim} m`;
    },
    ignicion() {
      const g = gpu(), s = scene(); if (!g || !s) return;
      clear();
      const centre = { x: s.at.x, y: s.at.y + 1.3, z: s.at.z };
      const left = add(centre, turned(s.facing, { x: -1.4, y: 0, z: 0 })), right = add(centre, turned(s.facing, { x: 1.4, y: 0, z: 0 }));
      game.frame(centre, 3);
      g.burst('ley-gas', { at: left, to: right, shape: 'line', count: 5000, spread: .35, speed: .05, life: [7, 8] });
      after(1.4, () => g.ignite(left, .3));
      return 'Gas: radio 0,22 m, retardo 0,05 s; se enciende el extremo izquierdo a 1,4 s';
    },
    burbujas() {
      const g = gpu(), s = scene(); if (!g || !s) return;
      clear();
      const at = { x: (s.at.x * 2 + s.from.x) / 3, y: s.at.y, z: (s.at.z * 2 + s.from.z) / 3 };
      game.frame({ x: at.x, y: at.y + .9, z: at.z }, 2.6);
      const glass = g.volume({ shape: 'box', mode: 'contain', at: { ...at, y: at.y + .75 }, rotation: s.facing, size: { x: .45, y: .75, z: .3 }, bounce: .1, kinds: ['fluido-agua'] });
      owned.push(glass);
      g.burst('fluido-agua', { at: { ...at, y: at.y + .45 }, count: 1500, spread: .28, life: [9, 10], colour: '#5f9fb0' });
      after(.8, () => { const e = g.emitter('ley-burbuja', { at: { ...at, y: at.y + .12 }, rate: 260, spread: .22, life: [4, 5] }); owned.push(e); after(3, () => e.remove()); });
      return 'Burbujas: suben 9 m/s² con el agua llena; fuera, a la deriva';
    },
  };

  section.addEventListener('click', event => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-ley]');
    if (!button) return;
    act(button.dataset.ley!);
  });
  function act(id: string) {
    if (id === 'quitar') { clear(); game.frame(); readout.textContent = ''; return; }
    const said = demos[id]?.();
    if (said) readout.textContent = said;
  }
  const api = {
    act,
    destroy() { clear(); app.off('update', onUpdate); section.remove(); },
  };
  // For the screenshot scenarios and the console: window.lawLab.act('lorenz').
  (globalThis as unknown as { lawLab?: typeof api }).lawLab = api;
  return api;
}
