import * as pc from 'playcanvas';
import { planMost, type BattleEffect, type CampingKind, type Combatant } from './battle';
import { buildFoeBody } from './character-model';
import { FOE_BODIES } from './foe-bodies';

/**
 * Càmping Eurocamping's foes (docs/quests/universidad.md § Càmping Eurocamping, Monsters), built from
 * Meshy figures (tools/figures.toml, src/foe-bodies.ts) and primitives, named like Uri's fears where
 * the fight looks for a part (`Charco pringoso` under them, `Cabeza de chicle` for what sways). A Mago
 * de camping in a robe of old tent canvas with a head torch, a tent pole for a staff and a gas canister
 * in the other hand; a Dado, human-sized and worn, its pips burnt in, of primitives; an Agente, a tall
 * figure of card, a struck-out word on its front and a pattern on its back; and El Campeón, the villain
 * of a superhero board game at life size, with a furnace grate in his chest. Each shows its rule in the fight (`show`): the canister
 * alight while a Bombona is charged, the die's face on top, the card turned to its back when face
 * down, the grate burning brighter as El Campeón's Plan fills.
 * Violet is only in their eyes (the friends' hold on them); nothing here is pink.
 */
export function createCampingFoes(app: pc.Application) {
  const materials: pc.StandardMaterial[] = [];
  const mat = (hex: string, gloss = .35, glow = 0, unlit = false) => {
    const m = new pc.StandardMaterial(); m.diffuse.fromString(hex); m.gloss = gloss; m.useMetalness = false;
    if (glow) { m.emissive.fromString(hex); m.emissiveIntensity = glow; }
    if (unlit) m.useLighting = false;
    m.update(); materials.push(m); return m;
  };
  function part(parent: pc.Entity, name: string, type: pc.RenderComponent['type'], m: pc.Material, p: number[], s: number[], r: number[] = [0, 0, 0]) {
    const e = new pc.Entity(name); e.addComponent('render', { type, material: m, castShadows: true });
    e.setLocalPosition(p[0], p[1], p[2]); e.setLocalScale(s[0], s[1], s[2]); e.setLocalEulerAngles(r[0], r[1], r[2]);
    parent.addChild(e); return e;
  }
  const pivot = (parent: pc.Entity, name: string, at: number[]) => { const e = new pc.Entity(name); e.setLocalPosition(at[0], at[1], at[2]); parent.addChild(e); return e; };
  const root = (name: string) => { const e = new pc.Entity(name); e.enabled = false; app.root.addChild(e); return e; };
  const shadow = mat('#2a2320', .2);
  shadow.opacity = .35; shadow.blendType = pc.BLEND_NORMAL; shadow.depthWrite = false; shadow.update();

  const violet = mat('#c9a2ff', .6, 2.2);
  /** A pivot at a Meshy figure's feet that sways with it: what code adds on top is placed in the figure's own metres. */
  const onto = (figure: pc.Entity, height: number) => pivot(figure.findByName('Cabeza de chicle') as pc.Entity, 'Encima', [0, -height / 2, 0]);
  const unshadowed = (e: pc.Entity) => { e.render!.castShadows = false; return e; };

  // Mago de camping (a Meshy figure, tools/figures.toml `[mago]`): a robe of faded orange tent canvas
  // under a hood and cape of grey-green flysheet, its guy ropes hanging; no face in the hood, two
  // violet slits and a head torch; a tent pole for a staff and a gas canister in the other hand,
  // whose burner (`Llama`) is alight while a Bombona is charged (`show`). Its eyes and its torch are
  // painted on the figure and lit here, where they are on it.
  const mago = root('Mago de camping');
  part(mago, 'Charco pringoso', 'cylinder', shadow, [0, .01, 0], [1.1, .02, 1.1]);
  const robed = onto(buildFoeBody(FOE_BODIES.mago!, pivot(mago, 'Vista', [0, 0, 0])), MAGO.height);
  for (const x of MAGO.eyes) unshadowed(part(robed, 'Ojo', 'box', violet, [x, MAGO.eyesAt[0], MAGO.eyesAt[1]], [.018, .045, .01]));
  unshadowed(part(robed, 'Luz de la linterna', 'box', mat('#fff1cc', .9, 3, true), [MAGO.torch[0], MAGO.torch[1], MAGO.torch[2]], [.06, .038, .012]));
  const flame = pivot(robed, 'Llama', [MAGO.burner[0], MAGO.burner[1], MAGO.burner[2]]);
  unshadowed(part(flame, 'Llama exterior', 'cone', mat('#ff8a2a', .2, 2.6, true), [0, .14, 0], [.13, .28, .13]));
  unshadowed(part(flame, 'Llama interior', 'cone', mat('#7fb2ff', .2, 2.4, true), [0, .07, 0], [.07, .14, .07]));

  // Dado: a human-sized die, worn ivory with darker chipped corners, its pips burnt in. One on top
  // (+Y), six below, two at the front (+Z), five behind, three on the right (+X), four on the left.
  const dado = root('Dado');
  part(dado, 'Charco pringoso', 'cylinder', shadow, [0, .01, 0], [1.25, .02, 1.25]);
  const cube = pivot(dado, 'Cubo', [0, DIE / 2, 0]);
  part(cube, 'Cara del dado', 'box', mat('#d6c9ab', .35), [0, 0, 0], [DIE, DIE, DIE]);
  const worn = mat('#9c8e70', .25), burnt = mat('#24160f', .2), scorch = mat('#6b4a30', .15);
  for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) part(cube, 'Esquina gastada', 'box', worn, [x * DIE * .47, y * DIE * .47, z * DIE * .47], [DIE * .12, DIE * .12, DIE * .12], [x * 12, y * 18, z * 9]);
  const half = DIE / 2, spot = DIE * .27;
  const faces: { n: number; at: (u: number, v: number) => number[]; r: number[] }[] = [
    { n: 1, at: (u, v) => [u, half, v], r: [0, 0, 0] },
    { n: 6, at: (u, v) => [u, -half, v], r: [0, 0, 0] },
    { n: 2, at: (u, v) => [u, v, half], r: [90, 0, 0] },
    { n: 5, at: (u, v) => [u, v, -half], r: [90, 0, 0] },
    { n: 3, at: (u, v) => [half, u, v], r: [0, 0, 90] },
    { n: 4, at: (u, v) => [-half, u, v], r: [0, 0, 90] },
  ];
  for (const face of faces) for (const [u, v] of PIPS[face.n]) {
    part(cube, 'Quemadura', 'cylinder', scorch, face.at(u * spot, v * spot), [DIE * .2, .018, DIE * .2], face.r);
    part(cube, 'Punto', 'cylinder', burnt, face.at(u * spot, v * spot), [DIE * .15, .03, DIE * .15], face.r);
  }

  // Agente (a Meshy figure, `[agente]`): a tall, gaunt figure cut from thick card. Its front is the
  // face of a card, cream with a struck-out word across its chest and two violet slits for eyes. Its
  // back is the back of the card, dark teal with a lattice, which is its rule (face down, it shows the
  // party its back: `Carta` turns), so it is built here over the figure's body and head.
  const agente = root('Agente');
  part(agente, 'Charco pringoso', 'cylinder', shadow, [0, .01, 0], [.9, .02, .9]);
  const card = onto(buildFoeBody(FOE_BODIES.agente!, pivot(pivot(agente, 'Vista', [0, 0, 0]), 'Carta', [0, 0, 0])), AGENTE.height);
  const back = mat('#1f4f56', .35), lattice = mat('#5d9ba1', .35);
  for (const sheet of [AGENTE.body, AGENTE.head]) {
    const [x, y, z] = sheet.at, [w, h] = sheet.size, behind = pivot(card, 'Dorso', [x, y, z]);
    behind.setLocalEulerAngles(0, 0, sheet.tilt);
    part(behind, 'Dorso de la carta', 'box', back, [0, 0, 0], [w, h, .01]);
    // Diamonds: two diagonals across each cell of the sheet, end to end.
    const cw = w / sheet.cells[0], ch = h / sheet.cells[1], long = Math.hypot(cw, ch) * .96, lean = Math.atan2(cw, ch) * 180 / Math.PI;
    for (let i = 0; i < sheet.cells[0]; i++) for (let j = 0; j < sheet.cells[1]; j++) for (const side of [-1, 1]) {
      part(behind, 'Rombo del dorso', 'box', lattice, [(i + .5) * cw - w / 2, (j + .5) * ch - h / 2, -.007], [.014, long, .004], [0, 0, side * lean]);
    }
  }
  for (const [x, y] of AGENTE.eyes) unshadowed(part(card, 'Ojo', 'box', violet, [x, y, AGENTE.eyesOut], [.066, .018, .008], [0, 0, AGENTE.eyesTilt]));

  // El Campeón: the villain of their superhero board game at life size (a Meshy figure, tools/figures.toml
  // `[campeon]`): charcoal armour, gauntlets glowing, a cape of blue tarpaulin with grommets. In his
  // chest a furnace grate (`Rejilla`) whose fire burns brighter as his Plan fills, white-hot when full.
  const campeon = root('El Campeón');
  part(campeon, 'Charco pringoso', 'cylinder', shadow, [0, .01, 0], [1.6, .02, 1.6]);
  const villain = buildFoeBody(FOE_BODIES.campeon!, pivot(campeon, 'Vista', [0, 0, 0]));
  const grate = pivot(villain.findByName('Cabeza de chicle') as pc.Entity, 'Rejilla', [0, CAMPEON.grate[1] - CAMPEON.height / 2, CAMPEON.grate[2]]);
  const fire = mat(FIRE[0], .3, 1);
  fire.name = 'Fuego de la rejilla';
  part(grate, 'Marco de la rejilla', 'box', mat('#3c3d40', .5), [0, 0, -.012], [.32, .36, .03]);
  for (const x of [-.08, 0, .08]) part(grate, 'Barra de fuego', 'box', fire, [x, 0, .006], [.045, .28, .02]);

  const templates = new Map<CampingKind, pc.Entity>([['mago', mago], ['dado', dado], ['agente', agente], ['campeon', campeon]]);
  /** What each fighter's model shows now, kept frame to frame. */
  interface Shown {
    face?: { now: number; from: pc.Quat; at: number };
    turn?: number;
    heat?: number; fire?: pc.StandardMaterial;
  }
  const shown = new WeakMap<pc.Entity, Shown>();
  const quat = (face: number) => new pc.Quat().mul2(new pc.Quat().setFromEulerAngles(0, 24, 0), new pc.Quat().setFromEulerAngles(...FACE_UP[face]));
  return {
    templates,
    /**
     * Each frame, a campsite foe's model shows its rule now (`unit`): the mago's canister alight with
     * its Bombona charged, the die rolling to the face it shows, the agente turning to its back face
     * down, El Campeón's paint and pose for its form. `animate` false snaps to it. `pending`: its own
     * action still on its way, whose change (a charge, a new form) shows once it lands. `toCamera`: the
     * degrees from where it faces to where the fight's camera is (TO_CAMERA says how much of it it turns).
     */
    show(model: pc.Entity, unit: Combatant, time: number, dt: number, animate: boolean, pending?: BattleEffect, toCamera = 0) {
      const s = shown.get(model) ?? {};
      shown.set(model, s);
      if (unit.kind && unit.kind in TO_CAMERA) (model.findByName('Vista') as pc.Entity | null)?.setLocalEulerAngles(0, toCamera * TO_CAMERA[unit.kind as CampingKind], 0);
      const ease = (k: number) => animate ? 1 - Math.exp(-dt * k) : 1;
      if (unit.kind === 'mago') {
        // Lit from the moment its charge lands until its Bombona goes off.
        const lit = unit.hp > 0 && ((unit.intent?.ability === 'bombona' && !pending?.telegraph) || (pending?.ability?.id === 'bombona' && !pending.telegraph));
        const fire = model.findByName('Llama') as pc.Entity | null;
        if (fire) {
          fire.enabled = lit;
          const flicker = 1 + Math.sin(time * 31) * .12 + Math.sin(time * 17.3) * .08;
          fire.setLocalScale(1, lit ? flicker * (1.6 + Math.sin(time * 4) * .2) : 1, 1);
        }
      } else if (unit.kind === 'dado') {
        const cubeNode = model.findByName('Cubo') as pc.Entity | null, face = unit.face ?? 1;
        if (!cubeNode) return;
        if (!s.face) s.face = { now: face, from: quat(face), at: -Infinity };
        if (s.face.now !== face) { s.face = { now: face, from: cubeNode.getLocalRotation().clone(), at: time }; }
        const k = animate ? Math.min(1, (time - s.face.at) / .6) : 1, smooth = k * k * (3 - 2 * k);
        // It tumbles over to its new face with a little hop.
        cubeNode.setLocalRotation(new pc.Quat().slerp(s.face.from, quat(face), smooth));
        cubeNode.setLocalPosition(0, DIE / 2 + Math.sin(k * Math.PI) * .45, 0);
      } else if (unit.kind === 'agente') {
        const cardNode = model.findByName('Carta') as pc.Entity | null;
        if (!cardNode) return;
        const want = unit.faceUp === false ? 180 : 0;
        s.turn ??= want;
        s.turn += (want - s.turn) * ease(6);
        const flipping = Math.abs(want - s.turn) > 2 ? Math.sin(Math.abs(want - s.turn) / 180 * Math.PI) : 0;
        cardNode.setLocalEulerAngles(0, s.turn, 0);
        cardNode.setLocalPosition(0, flipping * .25, 0);
      } else if (unit.kind === 'campeon') {
        // The grate in his chest: the fire of his Plan, a step brighter each step, flickering white-hot
        // when it is full; it shows as the turn that moved it lands. Out when he is down.
        s.fire ??= (model.findByName('Barra de fuego') as pc.Entity).render!.meshInstances[0].material as pc.StandardMaterial;
        // Until his own turn lands, the Plan it moved: full before a Rayo total, a step lower before a Rayo.
        const before = pending?.ability?.id === 'rayo-total' ? planMost(unit) : pending?.ability?.id === 'rayo-guantelete' ? Math.max(0, (unit.plan ?? 1) - 1) : undefined;
        const want = unit.hp > 0 ? (before ?? unit.plan ?? 0) / planMost(unit) : 0;
        s.heat = s.heat === undefined || !animate ? want : s.heat + (want - s.heat) * ease(5);
        const full = s.heat > .97 && animate ? .5 + .5 * Math.sin(time * 23) * Math.sin(time * 7.1) : 0;
        const hot = new pc.Color().lerp(new pc.Color().fromString(FIRE[0]), new pc.Color().fromString(FIRE[1]), s.heat * s.heat);
        s.fire.emissive.copy(hot);
        s.fire.emissiveIntensity = unit.hp > 0 ? .35 + 2.4 * s.heat + full : .05;
        s.fire.update();
      }
    },
    destroy() { templates.forEach(t => t.destroy()); materials.forEach(m => m.destroy()); },
  };
}
/** How tall the figures of the campsite foes are, in model metres: their plate hangs over their head. */
export const CAMPING_HEIGHTS: Partial<Record<CampingKind, number>> = { mago: 1.95, agente: 2.3, campeon: 2.1 };
/** How big each campsite foe stands in the fight. */
export const CAMPING_SIZES: Record<CampingKind, number> = { mago: 1, dado: 1, agente: .95, campeon: 1.15 };
/** How far each one turns its front from the party towards the fight's camera (0–1), so a card is never seen edge on. */
const TO_CAMERA: Record<CampingKind, number> = { mago: .4, dado: 0, agente: .85, campeon: .45 };
/** The die's edge, in model metres. */
const DIE = 1.1;
/** Where the pips sit on each face, in steps of a third of it. */
const PIPS: Record<number, [number, number][]> = {
  1: [[0, 0]], 2: [[-1, -1], [1, 1]], 3: [[-1, -1], [0, 0], [1, 1]], 4: [[-1, -1], [1, -1], [-1, 1], [1, 1]],
  5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]], 6: [[-1, -1], [-1, 0], [-1, 1], [1, -1], [1, 0], [1, 1]],
};
/** The turn that brings each face to the top (x, y, z degrees): one is already there. */
const FACE_UP: Record<number, [number, number, number]> = { 1: [0, 0, 0], 6: [180, 0, 0], 2: [-90, 0, 0], 5: [90, 0, 0], 3: [0, 0, 90], 4: [0, 0, -90] };
/**
 * The mago's figure (`[mago]`, metres, measured on its model): how tall; where the burner on its canister
 * is; its two eyes in the hood (their x, then height and how far out) and the lens of its head torch.
 */
const MAGO = { height: CAMPING_HEIGHTS.mago!, burner: [.404, 1.225, .268], eyes: [-.003, .067], eyesAt: [1.549, .138], torch: [.062, 1.686, .236] } as const;
/**
 * The agente's figure (`[agente]`, metres, measured on its model): how tall; the back of its body card
 * and of its head (centre, size, tilt in degrees, diamonds across and up); its eyes and how far out they are.
 */
const AGENTE = {
  height: CAMPING_HEIGHTS.agente!,
  body: { at: [-.005, 1.43, -.058], size: [.41, .91], tilt: 0, cells: [2, 3] },
  head: { at: [.018, 2.158, -.032], size: [.21, .285], tilt: -9.5, cells: [1, 1] },
  eyes: [[-.036, 2.16], [.066, 2.153]], eyesOut: .052, eyesTilt: -4,
} as const;
/** El Campeón's figure (`[campeon]`, metres): how tall, and where the grate in his chest is (height, out in front). */
const CAMPEON = { height: CAMPING_HEIGHTS.campeon!, grate: [0, 1.3, .39] } as const;
/** The fire in his grate: furnace orange, and white-hot when his Plan is about to fire. */
const FIRE = ['#ff7a1e', '#fff1d0'] as const;
