import * as pc from 'playcanvas';
import type { BattleEffect, CampingKind, Combatant } from './battle';

/**
 * Càmping Eurosport's foes (docs/quests/universidad.md § Càmping Eurosport, Monsters), built from
 * primitives like Uri's fears and named the same way where the fight looks for a part (`Charco
 * pringoso` under them, `Cabeza de chicle` for a head that sways). A Mago de camping in a robe of old
 * tent canvas with a head torch, a tent pole for a staff and a gas canister in the other hand; a Dado,
 * human-sized and worn, its pips burnt in; an Agente, a tall figure of card, a word on its front and a
 * pattern on its back; and El Campeón, a hero miniature at human scale on its plinth, with a tarpaulin
 * cape. Each shows its rule in the fight (`show`): the canister alight while a Bombona is charged, the
 * die's face on top, the card turned to its back when face down, the hero's paint on or gone.
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

  /** A cord from `a` to `b` (a guy rope): a thin cylinder turned from straight up to point along it. */
  function rope(parent: pc.Entity, name: string, m: pc.Material, a: number[], b: number[], thick = .018) {
    const d = new pc.Vec3(b[0] - a[0], b[1] - a[1], b[2] - a[2]), length = d.length();
    const e = part(parent, name, 'cylinder', m, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], [thick, length, thick]);
    const up = new pc.Vec3(0, 1, 0), axis = new pc.Vec3().cross(up, d.clone().normalize());
    if (axis.length() > 1e-6) e.setLocalRotation(new pc.Quat().setFromAxisAngle(axis.normalize(), Math.acos(Math.min(1, up.dot(d.clone().normalize()))) * 180 / Math.PI));
    return e;
  }

  // Mago de camping: a robe of faded orange tent canvas under a grey-green flysheet worn as a cape,
  // its guy ropes trailing to pegs on the ground; a hood with a head torch, its eyes violet in the
  // dark of it; a tent pole for a staff and a gas canister in the other hand.
  const mago = root('Mago de camping');
  part(mago, 'Charco pringoso', 'cylinder', shadow, [0, .01, 0], [1.1, .02, 1.1]);
  const robe = pivot(mago, 'Vista', [0, 0, 0]);
  const canvas = mat('#a8693a', .2), canvasDark = mat('#74472a', .2), fly = mat('#5b6550', .25), flyDark = mat('#454d3d', .25), cord = mat('#cfc7b0', .3), peg = mat('#8d9297', .7);
  part(robe, 'Falda', 'cone', canvas, [0, .6, 0], [.98, 1.2, .98]);
  part(robe, 'Túnica', 'cylinder', canvas, [0, .9, 0], [.5, 1.0, .44]);
  part(robe, 'Dobladillo', 'cylinder', canvasDark, [0, .05, 0], [.95, .08, .95]);
  // A zip down its front and a patch where it tore.
  part(robe, 'Cremallera', 'box', canvasDark, [0, .75, .27], [.04, .9, .02], [-9, 0, 0]);
  part(robe, 'Remiendo', 'box', canvasDark, [-.16, .45, .3], [.16, .2, .02], [-20, -25, 0]);
  // The flysheet over its shoulders, the shape of a little tent roof, with its two guy ropes pegged behind.
  part(robe, 'Doble techo', 'cone', fly, [0, 1.33, -.02], [.92, .56, .8]);
  part(robe, 'Borde del doble techo', 'cylinder', flyDark, [0, 1.06, -.02], [.9, .03, .78]);
  for (const side of [-1, 1]) {
    rope(robe, 'Viento', cord, [side * .38, 1.08, -.2], [side * .62, .04, -.62]);
    part(robe, 'Piqueta', 'cylinder', peg, [side * .62, .06, -.62], [.03, .14, .03]);
  }
  const hood = pivot(robe, 'Cabeza de chicle', [0, 1.6, 0]);
  part(hood, 'Capucha', 'sphere', fly, [0, .1, -.02], [.46, .5, .48]);
  part(hood, 'Caída de la capucha', 'sphere', fly, [0, -.04, -.18], [.36, .4, .22]);
  part(hood, 'Sombra de la capucha', 'sphere', mat('#0d0a0c', .1), [0, .06, .16], [.32, .34, .16]);
  for (const side of [-1, 1]) part(hood, 'Ojo', 'sphere', violet, [side * .075, .08, .24], [.075, .04, .03]);
  // The head torch: a strap round the hood and a lamp on the forehead, its lens always lit.
  const strap = mat('#2c3036', .4);
  part(hood, 'Cinta', 'box', strap, [0, .23, .215], [.2, .035, .04]);
  for (const side of [-1, 1]) part(hood, 'Cinta', 'box', strap, [side * .17, .22, .13], [.16, .035, .04], [0, side * -55, 0]);
  part(hood, 'Linterna frontal', 'box', mat('#3a3e44', .6), [0, .23, .23], [.13, .08, .07]);
  part(hood, 'Luz de la linterna', 'sphere', mat('#fff1cc', .9, 3, true), [0, .23, .27], [.08, .055, .03]).render!.castShadows = false;
  // Its right hand holds a tent pole, aluminium in sections.
  part(robe, 'Manga', 'cylinder', canvas, [.32, 1.18, .05], [.18, .55, .18], [0, 0, 26]);
  part(robe, 'Mano', 'sphere', mat('#3a2b30', .3), [.45, .93, .1], [.11, .11, .11]);
  const pole = mat('#9aa0a6', .8);
  part(robe, 'Varilla', 'cylinder', pole, [.47, .97, .1], [.035, 1.94, .035]);
  for (const y of [.35, .8, 1.25, 1.7]) part(robe, 'Junta de la varilla', 'cylinder', mat('#5d6268', .7), [.47, y, .1], [.052, .045, .052]);
  // The left one, a blue gas canister with its burner: alight while a Bombona is charged (`show`).
  part(robe, 'Manga', 'cylinder', canvas, [-.3, 1.15, .12], [.18, .52, .18], [-34, 0, -20]);
  part(robe, 'Mano', 'sphere', mat('#3a2b30', .3), [-.4, .94, .3], [.11, .11, .11]);
  const gas = pivot(robe, 'Bombona', [-.42, .8, .33]);
  part(gas, 'Cartucho', 'cylinder', mat('#2c5aa0', .55), [0, 0, 0], [.18, .22, .18]);
  part(gas, 'Válvula', 'cylinder', mat('#b08a3a', .8), [0, .13, 0], [.06, .05, .06]);
  part(gas, 'Quemador', 'cylinder', mat('#6d7277', .7), [0, .17, 0], [.13, .025, .13]);
  const flame = pivot(gas, 'Llama', [0, .2, 0]);
  part(flame, 'Llama exterior', 'cone', mat('#ff8a2a', .2, 2.6, true), [0, .14, 0], [.13, .28, .13]).render!.castShadows = false;
  part(flame, 'Llama interior', 'cone', mat('#7fb2ff', .2, 2.4, true), [0, .07, 0], [.07, .14, .07]).render!.castShadows = false;

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

  // Agente: a tall figure of card. Its front is printed cream, a word across its chest in dark blocks
  // and two violet slits for eyes; its back is a dark teal pattern. Face down, it shows the party its back.
  const agente = root('Agente');
  part(agente, 'Charco pringoso', 'cylinder', shadow, [0, .01, 0], [.9, .02, .9]);
  const card = pivot(pivot(agente, 'Vista', [0, 0, 0]), 'Carta', [0, 0, 0]);
  const stock = mat('#ddd0b4', .3), front = mat('#efe6cf', .35), ink = mat('#2a2226', .3), back = mat('#1f4f56', .35), lattice = mat('#5d9ba1', .35), edge = mat('#8a2f2a', .35);
  for (const side of [-1, 1]) {
    part(card, 'Pierna de cartón', 'box', stock, [side * .14, .44, 0], [.17, .88, .07]);
    part(card, 'Brazo de cartón', 'box', stock, [side * .47, 1.33, 0], [.13, .78, .07], [0, 0, side * 10]);
  }
  part(card, 'Cuerpo de cartón', 'box', stock, [0, 1.36, 0], [.74, 1.02, .08]);
  part(card, 'Cara de la carta', 'box', front, [0, 1.36, .04], [.66, .94, .012]);
  part(card, 'Marco', 'box', edge, [0, 1.36, .036], [.7, .98, .006]);
  part(card, 'Palabra', 'box', mat('#f7f1e2', .3), [0, 1.5, .05], [.52, .14, .008]);
  for (let k = 0; k < 5; k++) part(card, 'Letra', 'box', ink, [(k - 2) * .09, 1.5, .056], [.055, .085, .006]);
  part(card, 'Dorso', 'box', back, [0, 1.36, -.04], [.66, .94, .012]);
  for (const r of [32, -32]) for (const x of [-.13, 0, .13]) part(card, 'Rombo del dorso', 'box', lattice, [x, 1.36, -.048], [.032, .72, .006], [0, 0, r]);
  part(card, 'Cuello de cartón', 'box', stock, [0, 1.92, 0], [.09, .14, .05]);
  part(card, 'Cabeza de cartón', 'box', stock, [0, 2.12, 0], [.38, .42, .07]);
  part(card, 'Cara de la cabeza', 'box', front, [0, 2.12, .04], [.32, .36, .012]);
  part(card, 'Dorso de la cabeza', 'box', back, [0, 2.12, -.04], [.32, .36, .012]);
  for (const side of [-1, 1]) part(card, 'Ojo', 'box', violet, [side * .07, 2.15, .05], [.08, .022, .006]);

  // El Campeón: an invented hero miniature at human scale on a black plinth with chipped edges. Its
  // paint (suit, gold trim, skin) is on as a hero and gone to primer grey in plain clothes (`show`);
  // a cape of blue tarpaulin with grommets, its arms up or down with its form.
  const campeon = root('El Campeón');
  part(campeon, 'Charco pringoso', 'cylinder', shadow, [0, .01, 0], [1.5, .02, 1.5]);
  const plinth = mat('#1d1b1e', .5), chip = mat('#8a8680', .2);
  part(campeon, 'Peana', 'cylinder', plinth, [0, .15, 0], [1.2, .3, 1.2]);
  for (let k = 0; k < 9; k++) { const a = k * 2.1; part(campeon, 'Desconchón de la peana', 'box', chip, [Math.cos(a) * .58, .27 + (k % 3) * .01, Math.sin(a) * .58], [.09, .05, .06], [0, -a * 57.3, 0]); }
  part(campeon, 'Placa', 'box', mat('#a8893f', .7), [0, .15, .6], [.38, .09, .02]);
  const suit = mat(PAINT.suit[0], .55), gold = mat(PAINT.gold[0], .7), skin = mat(PAINT.skin[0], .45);
  const named = (m: pc.StandardMaterial, name: string) => { m.name = name; return m; };
  named(suit, 'Pintura traje'); named(gold, 'Pintura dorada'); named(skin, 'Pintura piel');
  const hero = pivot(pivot(campeon, 'Vista', [0, 0, 0]), 'Figura', [0, .3, 0]);
  for (const side of [-1, 1]) {
    part(hero, 'Pierna', 'box', suit, [side * .17, .42, 0], [.25, .8, .28]);
    part(hero, 'Bota', 'box', gold, [side * .17, .1, .04], [.28, .2, .36]);
  }
  part(hero, 'Cinturón', 'box', gold, [0, .86, 0], [.62, .18, .34]);
  part(hero, 'Pecho', 'box', suit, [0, 1.22, 0], [.72, .6, .4]);
  part(hero, 'Emblema', 'box', gold, [0, 1.26, .205], [.2, .2, .02], [0, 0, 45]);
  for (const [x, y] of [[-.2, .5], [.24, .3], [.12, 1.05], [-.26, 1.36], [.3, 1.18]]) part(hero, 'Desconchón', 'box', chip, [x, y, x > 0 ? .21 : .15], [.07, .045, .012], [0, 0, x * 80]);
  for (const side of [-1, 1]) part(hero, 'Hombro', 'sphere', suit, [side * .42, 1.46, 0], [.3, .3, .3]);
  part(hero, 'Cuello', 'cylinder', skin, [0, 1.58, 0], [.16, .12, .16]);
  part(hero, 'Cabeza', 'sphere', skin, [0, 1.74, 0], [.32, .36, .32]);
  part(hero, 'Casco', 'sphere', gold, [0, 1.83, -.01], [.36, .24, .36]);
  part(hero, 'Cresta', 'box', suit, [0, 1.96, -.02], [.05, .16, .34]);
  for (const side of [-1, 1]) part(hero, 'Ojo', 'sphere', violet, [side * .07, 1.74, .155], [.045, .025, .02]);
  for (const side of [-1, 1]) {
    const arm = pivot(hero, side < 0 ? 'Brazo izquierdo del campeón' : 'Brazo derecho del campeón', [side * .45, 1.44, 0]);
    part(arm, 'Brazo', 'box', suit, [0, -.26, 0], [.18, .5, .2]);
    part(arm, 'Puño', 'box', gold, [0, -.58, 0], [.21, .2, .23]);
  }
  const cape = pivot(hero, 'Capa', [0, 1.5, -.2]);
  const tarp = mat('#2f63a6', .45);
  const fold = mat('#26507f', .4);
  part(cape, 'Lona', 'box', tarp, [0, -.34, -.03], [.86, .7, .04]);
  part(cape, 'Pliegue', 'box', fold, [.18, -.36, -.055], [.08, .66, .02]);
  const hem = pivot(cape, 'Bajo de la capa', [0, -.68, -.03]);
  part(hem, 'Lona', 'box', tarp, [0, -.32, 0], [.9, .66, .04]);
  part(hem, 'Pliegue', 'box', fold, [.18, -.32, -.025], [.08, .62, .02]);
  for (const [x, y] of [[-.38, -.06], [.38, -.06]]) part(cape, 'Ojal', 'cylinder', chip, [x, y, -.055], [.06, .015, .06], [90, 0, 0]);
  for (const [x, y] of [[-.4, -.3], [.4, -.3], [-.4, -.6], [.4, -.6]]) part(hem, 'Ojal', 'cylinder', chip, [x, y, -.025], [.06, .015, .06], [90, 0, 0]);

  const templates = new Map<CampingKind, pc.Entity>([['mago', mago], ['dado', dado], ['agente', agente], ['campeon', campeon]]);
  /** What each fighter's model shows now, kept frame to frame. */
  interface Shown {
    face?: { now: number; from: pc.Quat; at: number };
    turn?: number;
    paint?: number; parts?: { suit: pc.StandardMaterial; gold: pc.StandardMaterial; skin: pc.StandardMaterial; arms: pc.Entity[]; cape: pc.Entity };
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
        if (!s.parts) {
          const find = (name: string) => (model.findByName(name) as pc.Entity).render!.meshInstances[0].material as pc.StandardMaterial;
          s.parts = { suit: find('Pecho'), gold: find('Cinturón'), skin: find('Cabeza'), arms: ['Brazo izquierdo del campeón', 'Brazo derecho del campeón'].map(n => model.findByName(n) as pc.Entity), cape: model.findByName('Capa') as pc.Entity };
        }
        // A change of form shows as the turn that brings it lands.
        const form = pending?.form ? (pending.form === 'paisano' ? 'heroe' : 'paisano') : unit.form;
        const want = form === 'paisano' ? 0 : 1, before = s.paint;
        s.paint = before === undefined ? want : before + (want - before) * ease(4);
        const p = s.paint;
        if (before === undefined || Math.abs(p - before) > .002) for (const key of ['suit', 'gold', 'skin'] as const) {
          const m = s.parts[key], [lit, bare] = PAINT[key];
          m.diffuse.lerp(new pc.Color().fromString(bare), new pc.Color().fromString(lit), p); m.update();
        }
        // A hero: both fists up, the right one out in front, the cape out behind; in plain clothes the arms hang and the cape falls.
        const sway = animate ? Math.sin(time * 1.6) * 3 : 0;
        s.parts.arms[1].setLocalEulerAngles(-96 * p - 6 * (1 - p) + sway, 0, 8 * p + 4 * (1 - p));
        s.parts.arms[0].setLocalEulerAngles(-58 * p - 4 * (1 - p) - sway, 0, -10 * p - 4 * (1 - p));
        s.parts.cape.setLocalEulerAngles(24 * p + 3 + sway * .5, 0, 0);
        (s.parts.cape.findByName('Bajo de la capa') as pc.Entity | null)?.setLocalEulerAngles(12 * p + sway * .4, 0, 0);
      }
    },
    destroy() { templates.forEach(t => t.destroy()); materials.forEach(m => m.destroy()); },
  };
}
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
/** El Campeón's paint, as a hero and gone to primer grey (plain clothes). */
const PAINT = { suit: ['#4c2321', '#7d7c78'], gold: ['#7c6641', '#8f8e89'], skin: ['#9c7a62', '#9a9993'] } as const;
