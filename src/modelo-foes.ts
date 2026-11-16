import * as pc from 'playcanvas';
import type { BattleEffect, Combatant, ModeloKind } from './battle';

/**
 * The foes of Emilie's model (docs/quests/emilie.md § Fights), built from primitives like the
 * campsite's and named the same way where the fight looks for a part (`Charco pringoso` under them).
 * They are what goes wrong in a groundwater model, drawn as a terminal draws: phosphor green lines on
 * black, water's blue and a spark's yellow for the two values. A Celda seca is a hollow cell of the
 * mesh, grey and off until water switches it on. An Oscilación is one figure in two places, never in
 * either. La pluma is a stain spreading low over the ground. El que no converge is a tall body of
 * columns of figures that never stop falling, with a second pose flickering over the first; converged,
 * the figures stop and it is one solid thing. Each shows its rule in the fight (`show`). Nothing here
 * is pink or violet: the Queen did this from far away.
 */
export function createModeloFoes(app: pc.Application) {
  const materials: pc.StandardMaterial[] = [];
  const mat = (hex: string, gloss = .3, glow = 0, unlit = false, opacity = 1) => {
    const m = new pc.StandardMaterial(); m.diffuse.fromString(hex); m.gloss = gloss; m.useMetalness = false;
    if (glow) { m.emissive.fromString(hex); m.emissiveIntensity = glow; }
    if (unlit) m.useLighting = false;
    if (opacity < 1) { m.opacity = opacity; m.blendType = pc.BLEND_NORMAL; m.depthWrite = false; }
    m.update(); materials.push(m); return m;
  };
  function part(parent: pc.Entity, name: string, type: pc.RenderComponent['type'], m: pc.Material, p: number[], s: number[], r: number[] = [0, 0, 0], shadows = true) {
    const e = new pc.Entity(name); e.addComponent('render', { type, material: m, castShadows: shadows });
    e.setLocalPosition(p[0], p[1], p[2]); e.setLocalScale(s[0], s[1], s[2]); e.setLocalEulerAngles(r[0], r[1], r[2]);
    parent.addChild(e); return e;
  }
  const pivot = (parent: pc.Entity, name: string, at: number[] = [0, 0, 0]) => { const e = new pc.Entity(name); e.setLocalPosition(at[0], at[1], at[2]); parent.addChild(e); return e; };
  const root = (name: string) => { const e = new pc.Entity(name); e.enabled = false; app.root.addChild(e); return e; };
  const shadow = mat('#101613', .2, 0, false, .4);
  const green = mat(PHOSPHOR, .4, 2.4, true), dim = mat('#1c7a42', .3, 1.1, true), pale = mat('#d8ffe6', .5, 2.8, true);
  const off = mat('#7d8780', .25), offDark = mat('#4f5752', .2), black = mat('#07100b', .15);
  const water = mat(WATER, .6, 2.2, true), spark = mat(SPARK, .6, 2.6, true);
  const waterGlass = mat(WATER, .7, 1.2, true, .45);

  /** The twelve edges of a cube of side `size` centred on `at`, as thin bars. */
  function frame(parent: pc.Entity, name: string, m: pc.Material, at: number[], size: number, thick: number) {
    const h = size / 2;
    for (const a of [-1, 1]) for (const b of [-1, 1]) {
      part(parent, name, 'box', m, [at[0], at[1] + a * h, at[2] + b * h], [size + thick, thick, thick]);
      part(parent, name, 'box', m, [at[0] + a * h, at[1], at[2] + b * h], [thick, size + thick, thick]);
      part(parent, name, 'box', m, [at[0] + a * h, at[1] + b * h, at[2]], [thick, thick, size + thick]);
    }
  }

  // Celda seca: one cell of the mesh, a hollow cube standing on a corner of nothing. Off, its edges
  // are grey and there is only a dark core in it. Wet, the edges light up green and the core is water.
  const celda = root('Celda seca');
  part(celda, 'Charco pringoso', 'cylinder', shadow, [0, .01, 0], [1.3, .02, 1.3]);
  const cell = pivot(celda, 'Celda', [0, CELL / 2 + .28, 0]);
  const dry = pivot(cell, 'Celda apagada'), lit = pivot(cell, 'Celda encendida');
  frame(dry, 'Arista apagada', off, [0, 0, 0], CELL, .06);
  part(dry, 'Núcleo apagado', 'box', offDark, [0, 0, 0], [CELL * .34, CELL * .34, CELL * .34], [0, 45, 0]);
  frame(lit, 'Arista encendida', green, [0, 0, 0], CELL, .07);
  part(lit, 'Agua de la celda', 'box', waterGlass, [0, -CELL * .12, 0], [CELL * .9, CELL * .7, CELL * .9], [0, 0, 0], false);
  part(lit, 'Núcleo encendido', 'box', water, [0, 0, 0], [CELL * .34, CELL * .34, CELL * .34], [0, 45, 0], false);
  // The node of the mesh it hangs from: four short lines going off to cells that are not there.
  for (const [x, z] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) part(celda, 'Línea de malla', 'box', dim, [x * (CELL / 2 + .22), .29, z * (CELL / 2 + .22)], [x ? .4 : .03, .03, z ? .4 : .03], [0, 0, 0], false);

  // Oscilación: a slim figure drawn as a stack of bars, twice: once leaning to «Agua», once to
  // «Eléctrico». The one it is on is there; the other one flickers where it has just been.
  const oscilacion = root('Oscilación');
  part(oscilacion, 'Charco pringoso', 'cylinder', shadow, [0, .01, 0], [1, .02, 1]);
  const BARS = 13, wave = pivot(oscilacion, 'Vista');
  for (const [name, m, lean] of [['Valor agua', water, -1], ['Valor eléctrico', spark, 1]] as const) {
    const pose = pivot(wave, name);
    for (let k = 0; k < BARS; k++) {
      const y = .25 + k * .15, t = k / (BARS - 1);
      // Narrow at the feet, wide at the shoulders, a small head: a body, read as a signal.
      const width = k === BARS - 1 ? .24 : k === BARS - 2 ? .12 : .18 + Math.sin(t * Math.PI * .9) * .3;
      part(pose, 'Barra', 'box', m, [lean * (.12 + Math.sin(t * Math.PI * 2) * .13), y, 0], [width, .07, .07], [0, 0, 0], k % 2 === 0);
    }
    part(pose, 'Eje', 'box', green, [lean * .12, 1.2, -.02], [.02, 2, .02], [0, 0, 0], false);
  }

  // La pluma: a contaminant plume, low and wide, thickest where it started and thinning as it spreads.
  // Dull amber: the colour of something in the water that should not be there.
  const pluma = root('La pluma');
  part(pluma, 'Charco pringoso', 'cylinder', shadow, [0, .01, 0], [1.8, .02, 1.4]);
  const stain = mat('#8f6f34', .4, 0, false, .7), stainDark = mat('#54421f', .3, 0, false, .78), stainLine = mat('#e0c47a', .5, 1.5, true);
  const plume = pivot(pluma, 'Mancha');
  const BLOBS: [number, number, number, number][] = [[0, .2, 0, 1.25], [.6, .15, .1, .95], [-.55, .14, -.14, .9], [1.1, .1, -.05, .7], [-1.05, .1, .16, .62], [.25, .12, .6, .62], [-.2, .11, -.6, .58]];
  BLOBS.forEach(([x, y, z, s], k) => part(plume, 'Gota de la pluma', 'sphere', k % 3 === 2 ? stainDark : stain, [x, y, z], [s * 1.2, s * .3, s], [0, 0, 0], false));
  // What rises off it: thin threads, the stain climbing through the water above.
  for (let k = 0; k < 7; k++) part(plume, 'Hilo de la pluma', 'box', k % 2 ? stainLine : stain, [Math.cos(k * 2.4) * .55, .55 + (k % 3) * .22, Math.sin(k * 2.4) * .4], [.03, .5 + (k % 3) * .18, .03], [0, 0, (k % 2 ? 1 : -1) * 7], false);
  // Its contour lines, as the model draws a concentration: rings on the ground, wider and fainter.
  for (const [r, m] of [[1.5, stainLine], [2.1, dim]] as const) for (let k = 0; k < 16; k++) {
    const a = k / 16 * Math.PI * 2;
    part(pluma, 'Isolínea', 'box', m, [Math.cos(a) * r * .6, .03, Math.sin(a) * r * .46], [.2, .015, .03], [0, -a * 180 / Math.PI + 90, 0], false);
  }

  // El que no converge: a body made of columns of figures falling, its shape only where they fall.
  // A second pose, a little to one side, flickers over the first. In its chest, the value it is on.
  // Over its head, its marks of Error. Converged, a solid body takes the columns' place.
  const boss = root('El que no converge');
  part(boss, 'Charco pringoso', 'cylinder', shadow, [0, .01, 0], [2.2, .02, 2.2]);
  const seen = pivot(boss, 'Vista');
  const rain = pivot(seen, 'Cifras');
  COLUMNS.forEach(([x, bottom, top], c) => {
    const column = pivot(rain, 'Columna', [x, 0, 0]);
    const count = Math.max(2, Math.round((top - bottom) / .26));
    for (let k = 0; k < count; k++) part(column, 'Cifra', 'box', k === 0 ? pale : (k + c) % 3 === 0 ? dim : green, [0, top - k * .26, ((c * 7 + k * 3) % 5 - 2) * .03], [.1, (k * 5 + c) % 4 === 0 ? .06 : .16, .03], [0, 0, 0], false);
  });
  // What they fall over: the dark of a screen, in the shape of the body, so the figures read as one thing.
  const dark = mat('#06120b', .1, 0, false, .7);
  COLUMNS.forEach(([x, bottom, top]) => part(rain, 'Fondo', 'box', dark, [x, (bottom + top) / 2, -.05], [.16, top - bottom + .12, .02], [0, 0, 0], false));
  const ghost = pivot(seen, 'Segunda pose', [.16, 0, .04]);
  COLUMNS.forEach(([x, bottom, top]) => part(ghost, 'Traza', 'box', dim, [x, (bottom + top) / 2, 0], [.025, top - bottom, .025], [0, 0, 0], false));
  const solid = pivot(seen, 'Cuerpo sólido', [0, 0, -.24]);
  for (const side of [-1, 1]) {
    part(solid, 'Pierna sólida', 'box', black, [side * .22, .5, 0], [.3, 1, .3]);
    part(solid, 'Brazo sólido', 'box', black, [side * .56, 1.45, 0], [.2, .95, .24]);
  }
  part(solid, 'Tronco sólido', 'box', black, [0, 1.52, 0], [.86, 1.08, .4]);
  part(solid, 'Cabeza sólida', 'box', black, [0, 2.32, 0], [.4, .46, .36]);
  frame(solid, 'Contorno sólido', pale, [0, 2.32, 0], .42, .025);
  part(solid, 'Valor único', 'box', pale, [0, 1.6, .3], [.34, .08, .02], [0, 0, 0], false);
  const core = pivot(seen, 'Valor', [0, 1.6, .16]);
  part(core, 'Valor agua', 'sphere', water, [0, 0, 0], [.3, .3, .16], [0, 0, 0], false);
  part(core, 'Valor eléctrico', 'box', spark, [0, 0, 0], [.24, .24, .12], [0, 0, 45], false);
  const marks = pivot(seen, 'Error', [0, 2.95, 0]);
  for (let k = 0; k < MARKS; k++) part(marks, 'Marca de error', 'box', green, [(k - (MARKS - 1) / 2) * .16, 0, 0], [.09, .26, .03], [0, 0, 0], false);

  const templates = new Map<ModeloKind, pc.Entity>([['celda-seca', celda], ['oscilacion', oscilacion], ['pluma', pluma], ['no-converge', boss]]);
  /** What a model's parts are, found once. */
  interface Shown {
    cell?: { dry: pc.Entity; lit: pc.Entity; node: pc.Entity };
    poses?: Record<'agua' | 'electrico', pc.Entity>;
    blobs?: { node: pc.Entity; at: pc.Vec3 }[];
    boss?: { digits: { node: pc.Entity; column: number; offset: number }[]; ghost: pc.Entity; rain: pc.Entity; solid: pc.Entity; core: Record<'agua' | 'electrico', pc.Entity>; marks: pc.Entity[]; fall: number; still: number };
  }
  const shown = new WeakMap<pc.Entity, Shown>();
  const node = (model: pc.Entity, name: string) => model.findByName(name) as pc.Entity;
  return {
    templates,
    /**
     * Each frame, a foe of the model shows its rule now (`unit`): the cell off or switched on, the
     * Oscilación in the value it is on (the other one flickering), the plume spreading, the boss's
     * figures falling, the value in its chest, its marks of Error, and its solid body once converged.
     * `animate` false snaps to it. `pending`: an action still on its way whose change shows once it lands.
     * `toCamera`: the degrees from where it faces to where the fight's camera is: what is drawn flat turns to be read.
     */
    show(model: pc.Entity, unit: Combatant, time: number, dt: number, animate: boolean, pending?: BattleEffect, toCamera = 0) {
      let s = shown.get(model);
      if (!s) { s = {}; shown.set(model, s); }
      if (unit.kind && TO_CAMERA[unit.kind as ModeloKind]) (model.findByName('Vista') as pc.Entity | null)?.setLocalEulerAngles(0, toCamera * TO_CAMERA[unit.kind as ModeloKind], 0);
      const alive = unit.hp > 0;
      if (unit.kind === 'celda-seca') {
        s.cell ??= { dry: node(model, 'Celda apagada'), lit: node(model, 'Celda encendida'), node: node(model, 'Celda') };
        const on = alive && !!unit.timed?.mojado;
        s.cell.dry.enabled = !on; s.cell.lit.enabled = on;
        // Off, it hangs still, a little askew; on, it turns slowly and hums.
        s.cell.node.setLocalEulerAngles(on && animate ? Math.sin(time * 2.1) * 4 : 8, on && animate ? time * 40 % 360 : 24, on ? 0 : 6);
        s.cell.node.setLocalPosition(0, CELL / 2 + .28 + (animate ? Math.sin(time * (on ? 2.4 : .9) + model.getPosition().x) * (on ? .06 : .02) : 0), 0);
      } else if (unit.kind === 'oscilacion') {
        s.poses ??= { agua: node(model, 'Valor agua'), electrico: node(model, 'Valor eléctrico') };
        const sign = unit.sign ?? 'agua', other = sign === 'agua' ? 'electrico' : 'agua';
        s.poses[sign].enabled = true;
        // Where it has just been: a flicker, never long enough to be there.
        s.poses[other].enabled = alive && animate && Math.sin(time * 23 + model.getPosition().z * 5) * Math.sin(time * 7.3) > .55;
        const sway = animate ? Math.sin(time * 9) * .012 : 0;
        s.poses[sign].setLocalPosition(sway, 0, 0);
      } else if (unit.kind === 'pluma') {
        s.blobs ??= (model.find(n => n.name === 'Gota de la pluma') as pc.Entity[]).map(n => ({ node: n, at: n.getLocalPosition().clone() }));
        if (animate) s.blobs.forEach(({ node: n, at }, k) => n.setLocalPosition(at.x + Math.sin(time * .7 + k * 1.9) * .08, at.y + Math.sin(time * 1.1 + k * 2.3) * .05, at.z + Math.cos(time * .6 + k * 1.3) * .06));
      } else if (unit.kind === 'no-converge') {
        if (!s.boss) {
          const columns = model.find(n => n.name === 'Columna') as pc.Entity[];
          s.boss = {
            digits: columns.flatMap((column, c) => (column.children as pc.Entity[]).map((n, k) => ({ node: n, column: c, offset: k * .26 }))),
            ghost: node(model, 'Segunda pose'), rain: node(model, 'Cifras'), solid: node(model, 'Cuerpo sólido'),
            core: { agua: node(node(model, 'Valor'), 'Valor agua'), electrico: node(node(model, 'Valor'), 'Valor eléctrico') },
            marks: model.find(n => n.name === 'Marca de error') as pc.Entity[], fall: 0, still: 0,
          };
        }
        const b = s.boss;
        // A blow that converges it shows as it lands, not before; so does its diverging again.
        const converged = alive && (pending?.converged ? false : pending?.diverged && pending.kind === 'enemy' ? true : !!unit.converged);
        const want = converged ? 1 : 0;
        b.still = animate ? b.still + (want - b.still) * (1 - Math.exp(-dt * 5)) : want;
        // The figures fall, faster in Diverge, and slow to a stop as it converges.
        b.fall += dt * (unit.diverged ? 1.5 : .95) * (1 - b.still);
        for (const { node: n, column, offset } of b.digits) {
          const [, bottom, top] = COLUMNS[column], height = top - bottom;
          const y = top - ((offset + b.fall * (.8 + (column * 37 % 10) / 14)) % height);
          const p = n.getLocalPosition(); n.setLocalPosition(p.x, y, p.z);
        }
        // Converged, the figures stay where they stopped, over a body that is now there.
        b.solid.enabled = b.still > .5;
        b.ghost.enabled = alive && !converged && animate && Math.sin(time * 17) * Math.sin(time * 5.1) > .2;
        b.ghost.setLocalPosition(.16 + (animate ? Math.sin(time * 3.3) * .05 : 0), 0, .04);
        const sign = unit.sign ?? 'agua';
        b.core.agua.enabled = alive && !converged && sign === 'agua'; b.core.electrico.enabled = alive && !converged && sign === 'electrico';
        const pulse = 1 + (animate ? Math.sin(time * 6) * .12 : 0);
        b.core[sign].setLocalScale(sign === 'agua' ? .3 * pulse : .24 * pulse, sign === 'agua' ? .3 * pulse : .24 * pulse, sign === 'agua' ? .16 : .12);
        const error = alive && !converged ? pending?.error ? pending.error.left + (pending.error.mark === 'off' ? 1 : -1) : unit.error ?? 0 : 0;
        b.marks.forEach((mark, k) => { mark.enabled = k < error; });
      }
    },
    destroy() { templates.forEach(t => t.destroy()); materials.forEach(m => m.destroy()); },
  };
}
/** How big each foe of the model stands in the fight. */
export const MODELO_SIZES: Record<ModeloKind, number> = { 'celda-seca': 1, oscilacion: 1.05, pluma: 1, 'no-converge': 1.3 };
/** How far each one turns its front from the party towards the fight's camera (0–1): the flat ones, nearly all the way. */
const TO_CAMERA: Record<ModeloKind, number> = { 'celda-seca': 0, oscilacion: .9, pluma: 0, 'no-converge': .9 };
/** The model's own colours: a terminal's phosphor green, water's blue and a spark's yellow (ELEMENTS in src/battle.ts). */
export const PHOSPHOR = '#3fe07a';
const WATER = '#6cc8f2', SPARK = '#ffe45c';
/** A cell's edge, in model metres. */
const CELL = .95;
/** The most marks of Error the boss can show (MODELO.errorMost). */
const MARKS = 6;
/** The boss's columns of figures: where each stands across its body, and from where to where its figures fall (a silhouette: arms, legs, trunk, head). */
const COLUMNS: readonly (readonly [number, number, number])[] = [
  [-.62, 1.0, 1.9], [-.46, .95, 2.02], [-.3, .05, 2.08], [-.15, .05, 2.5], [0, 1.02, 2.58], [.15, .05, 2.5], [.3, .05, 2.08], [.46, .95, 2.02], [.62, 1.0, 1.9],
];
