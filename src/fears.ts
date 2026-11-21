import * as pc from 'playcanvas';
import type { FoeKind } from './battle';
import { buildCharacter, buildFoeBody, hasModel, instantiateModel, type CharacterSpec } from './character-model';
import VERTITRON_FIGURE from './monsters/vertigo.json';
import { FOE_BODIES } from './foe-bodies';
import { createCampingFoes } from './camping-foes';
import { createCuerdasFoes } from './cuerdas-foes';
import { createModeloFoes } from './modelo-foes';
import { createLucaFoes } from './luca-foes';

/**
 * Uri's fears (docs/quests/nuria.md § The maze, § Final boss): El Cebollón, a real onion the size of a
 * man; El Plato Misterioso, a covered dish on a café table; a fantasmita, an arcade ghost become real
 * (each a Meshy figure, src/foe-bodies.ts); and Vertitrón, a robot of roof tiles and ladders with one
 * eye in its chest and Uri on its head, built from primitives. They carry the minion's part names
 * (`Cabeza de chicle`, `Charco pringoso`) so the fight animates them the same way: a wobbling head, a
 * base on the ground.
 */
/** The glowing violet eye over each of Uri's painted ones while he is held (`uriEyes`). */
const POSSESSED_EYE = 'Ojo poseído';

export function createFears(app: pc.Application) {
  const materials: pc.StandardMaterial[] = [];
  const mat = (hex: string, gloss = .4, glow = 0, opacity = 1) => {
    const m = new pc.StandardMaterial(); m.diffuse.fromString(hex); m.gloss = gloss; m.useMetalness = false;
    if (glow) { m.emissive.fromString(hex); m.emissiveIntensity = glow; }
    if (opacity < 1) { m.opacity = opacity; m.blendType = pc.BLEND_NORMAL; m.depthWrite = false; }
    m.update(); materials.push(m); return m;
  };
  function part(parent: pc.Entity, name: string, type: pc.RenderComponent['type'], m: pc.Material, p: number[], s: number[], r: number[] = [0, 0, 0]) {
    const e = new pc.Entity(name); e.addComponent('render', { type, material: m, castShadows: true });
    e.setLocalPosition(p[0], p[1], p[2]); e.setLocalScale(s[0], s[1], s[2]); e.setLocalEulerAngles(r[0], r[1], r[2]);
    parent.addChild(e); return e;
  }
  const shadow = mat('#2a2320', .2, 0, .35);
  const root = (name: string) => { const e = new pc.Entity(name); e.enabled = false; app.root.addChild(e); return e; };

  // El Cebollón: a real onion the size of a heavy man, its dry skins torn, its roots spread over the
  // floor (a Meshy figure, tools/figures.toml `[cebollon]`). Its mesh is the `Capa` the fight tints as
  // it loses layers; its young wear it smaller.
  const onion = root('El Cebollón');
  part(onion, 'Charco pringoso', 'cylinder', shadow, [0, .01, 0], [1.5, .02, 1.5]);
  buildFoeBody(FOE_BODIES.cebollon!, onion, 'Capa');

  // El Plato Misterioso: a café table, a stained cloth, a tarnished cloche lifted a hand's breadth and
  // something pale reaching out from under it (`[plato]`). The fight turns it over when it changes dish.
  const dish = root('El Plato Misterioso');
  part(dish, 'Charco pringoso', 'cylinder', shadow, [0, .01, 0], [1.2, .02, 1.2]);
  buildFoeBody(FOE_BODIES.plato!, dish);

  // A fantasmita: an arcade ghost become real, cubes of magenta glass coming loose at its edges, its
  // hem acid green (`[fantasmita]`). It goes see-through as a whole on its last count.
  const ghost = root('Fantasmita');
  part(ghost, 'Charco pringoso', 'cylinder', shadow, [0, .01, 0], [1, .02, 1]);
  buildFoeBody(FOE_BODIES.fantasmita!, ghost);

  // Vertitrón: a robot of roof tiles, ladders and Nuria's lime-white render, a house that stood up.
  // A boxy trunk with a window in its chest that is its one eye (lens, spiral and pupil, shutters
  // open either side), arms and legs of tiles with ladder shins and forearms, and a flat head where
  // Uri stands with Nil in his arms. Its joints are pivots the fight poses (`pose`): hips, knees and
  // ankles, waist, shoulders (a swing round the vertical, then the raise), elbows and head.
  const vertigo = root('Vertitrón');
  part(vertigo, 'Charco pringoso', 'cylinder', shadow, [0, .01, 0], [3.4, .02, 3.4]);
  const tile = mat('#b5583a', .35), tileDark = mat('#7f3524', .35), plum = mat('#4a3048', .3), lime = mat('#f3e9d8', .25);
  const wood = mat('#6e5238', .25), woodDark = mat('#4a3626', .25), iron = mat('#3a3140', .55), socket = mat('#140a18', .6), shutter = mat('#6b6a3a', .25);
  const pivot = (parent: pc.Entity, name: string, at: number[]) => { const e = new pc.Entity(name); e.setLocalPosition(at[0], at[1], at[2]); parent.addChild(e); return e; };
  const hips = pivot(vertigo, 'Cadera', [0, ROBOT.hip, 0]);
  part(hips, 'Pelvis', 'box', tileDark, [0, .1, 0], [1.8, .45, 1.1]);
  part(hips, 'Cinturón', 'box', lime, [0, .32, 0], [1.9, .1, 1.15]);
  for (const side of [-1, 1]) {
    const thigh = pivot(hips, side < 0 ? 'Muslo izquierdo' : 'Muslo derecho', [side * .62, 0, 0]);
    part(thigh, 'Junta', 'sphere', iron, [0, 0, 0], [.55, .55, .55]);
    part(thigh, 'Muslo', 'box', tile, [0, -.5, 0], [.62, .9, .7]);
    part(thigh, 'Placa', 'box', tileDark, [0, -.5, .36], [.48, .6, .05]);
    const knee = pivot(thigh, 'Rodilla', [0, -1, 0]);
    part(knee, 'Junta', 'sphere', iron, [0, 0, 0], [.5, .5, .5]);
    // The shin is a ladder with a plate behind it, so it reads solid.
    part(knee, 'Espinillera', 'box', tileDark, [0, -.42, -.08], [.4, .8, .1]);
    for (const x of [-.22, .22]) part(knee, 'Larguero', 'box', wood, [x, -.42, 0], [.12, .85, .14]);
    for (const y of [-.18, -.42, -.66]) part(knee, 'Peldaño', 'box', woodDark, [0, y, .02], [.44, .07, .1]);
    const ankle = pivot(knee, 'Tobillo', [0, -.85, 0]);
    part(ankle, 'Pie', 'box', plum, [0, -.12, .12], [.7, .25, 1.05]);
    part(ankle, 'Puntera', 'box', tile, [0, -.1, .62], [.72, .2, .12]);
  }
  const trunk = pivot(hips, 'Tronco', [0, .32, 0]);
  part(trunk, 'Cuerpo', 'box', tile, [0, 1, 0], [2.3, 2, 1.3]);
  part(trunk, 'Alero', 'box', lime, [0, 1.95, 0], [2.42, .12, 1.42]);
  // Roof tiles down its back, row on row, like the roof it was.
  for (let row = 0; row < 3; row++) for (let k = 0; k < 4; k++) part(trunk, 'Teja', 'box', (row + k) % 2 ? tile : tileDark, [(k - 1.5) * .56, 1.65 - row * .55, -.7], [.54, .14, .34], [24, 0, 0]);
  // The window it looks out of: a lime frame round its eye, louvred shutters open either side.
  for (const [x, y, w, h] of [[0, 1.78, 1.62, .14], [0, .32, 1.62, .14], [-.81, 1.05, .14, 1.6], [.81, 1.05, .14, 1.6]]) part(trunk, 'Marco', 'box', lime, [x, y, .67], [w, h, .07]);
  for (const side of [-1, 1]) {
    part(trunk, 'Persiana', 'box', shutter, [side * 1.02, 1.05, .68], [.34, 1.36, .05]);
    for (let k = 0; k < 3; k++) part(trunk, 'Lama', 'box', woodDark, [side * 1.02, .6 + k * .45, .71], [.3, .04, .02]);
  }
  // A little ladder up its right side: how Uri got up there.
  for (const z of [-.2, .2]) part(trunk, 'Larguero', 'box', wood, [1.18, 1, z], [.08, 1.9, .08]);
  for (let y = .3; y < 1.9; y += .4) part(trunk, 'Peldaño', 'box', woodDark, [1.18, y, 0], [.08, .05, .4]);
  // The eye: a ball of glass bulging out of its chest, like a marble or a glass eyeball, in an iron
  // rim on a dark socket. Inside the glass the eyeball (`Globo`) darts about: a violet iris with a
  // spiral of light that turns and a pupil; the glass and its glints stay put, so it reads as glass.
  // `Grieta`s show it broken. Iris, spiral, pupil and glass have their own materials (the fight lights them).
  const eye = pivot(trunk, 'Ojo de Vertitrón', [0, ROBOT.eye, .78]);
  part(eye, 'Cuenca', 'cylinder', socket, [0, 0, -.12], [1.3, .08, 1.3], [90, 0, 0]);
  for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2; part(eye, 'Aro', 'box', iron, [Math.cos(a) * .64, Math.sin(a) * .64, -.08], [.36, .14, .16], [0, 0, a * 180 / Math.PI + 90]); }
  const ball = pivot(eye, 'Globo', [0, 0, 0]);
  // The eyeball: deep violet, a bright lilac iris on its front, a dark pupil in it and the spiral round it.
  part(ball, 'Globo del ojo', 'sphere', mat('#4a1f8a', .8, .8), [0, 0, 0], [.8, .8, .8]);
  part(ball, 'Iris del ojo', 'sphere', mat('#b07aff', .8, 1.5), [0, 0, .3], [.52, .52, .22]);
  const spiral = pivot(ball, 'Espiral', [0, 0, .41]), light = mat('#f4ecff', .6, 2.2);
  for (let arm = 0; arm < 4; arm++) for (let s = 0; s < 3; s++) {
    const a = arm / 4 * Math.PI * 2 + s * .5, r = .11 + s * .045;
    part(spiral, 'Brazo de la espiral', 'box', light, [Math.cos(a) * r, Math.sin(a) * r, -s * .012], [.07, .022, .015], [0, 0, a * 180 / Math.PI + 70]);
  }
  part(ball, 'Pupila del ojo', 'sphere', mat('#12061c', .9), [0, 0, .4], [.15, .15, .06]);
  const glass = mat('#1c1030', .96, 0, .32);
  glass.specular.set(1, 1, 1); glass.emissive.fromString('#3a1f5a'); glass.emissiveIntensity = .5; glass.update();
  part(eye, 'Cristal del ojo', 'sphere', glass, [0, 0, 0], [1.12, 1.12, 1.12]).render!.castShadows = false;
  // Glints on the glass: a window of light up on its left and a speck below, unlit, always bright.
  const glint = mat('#ffffff', 1, 3);
  glint.useLighting = false; glint.update();
  part(eye, 'Brillo', 'sphere', glint, [-.2, .24, .47], [.16, .09, .04], [-25, -20, 30]).render!.castShadows = false;
  part(eye, 'Brillo', 'sphere', glint, [.18, -.2, .5], [.06, .045, .02]).render!.castShadows = false;
  for (const [a, r, l] of [[20, .05, .5], [-35, .14, .4], [80, -.1, .36], [140, .12, .3], [-100, -.18, .26]]) {
    const c = Math.cos(a * Math.PI / 180) * r, d = Math.sin(a * Math.PI / 180) * r;
    const crack = part(eye, 'Grieta', 'box', mat('#e6dcef', .9, .3), [c, d, Math.sqrt(Math.max(0, .31 - c * c - d * d)) + .01], [l, .03, .02], [d * -60, c * 60, a]);
    crack.enabled = false;
  }
  for (const side of [-1, 1]) {
    // The shoulder swings the arm round the vertical; inside it, `Brazo` raises it and the elbow bends.
    const shoulder = pivot(trunk, side < 0 ? 'Hombro izquierdo' : 'Hombro derecho', [side * 1.32, 1.7, 0]);
    const arm = pivot(shoulder, 'Brazo', [0, 0, 0]);
    part(arm, 'Junta', 'sphere', iron, [0, 0, 0], [.65, .65, .65]);
    part(arm, 'Hombrera', 'box', tile, [side * .05, .22, 0], [.78, .22, .82], [0, 0, side * -14]);
    part(arm, 'Brazo de tejas', 'box', tileDark, [0, -.5, 0], [.45, .85, .5]);
    const elbow = pivot(arm, 'Codo', [0, -.95, 0]);
    part(elbow, 'Junta', 'sphere', iron, [0, 0, 0], [.42, .42, .42]);
    part(elbow, 'Antebrazo', 'box', tile, [0, -.4, -.04], [.4, .8, .36]);
    for (const x of [-.18, .18]) part(elbow, 'Larguero', 'box', wood, [x, -.4, .16], [.08, .82, .08]);
    for (const y of [-.15, -.4, -.65]) part(elbow, 'Peldaño', 'box', woodDark, [0, y, .18], [.36, .05, .06]);
    const hand = pivot(elbow, 'Mano del robot', [0, -.85, 0]);
    part(hand, 'Palma', 'box', plum, [0, -.18, 0], [.56, .38, .6]);
    for (const z of [-.18, 0, .18]) part(hand, 'Dedo', 'box', iron, [side * -.08, -.47, z], [.36, .22, .14]);
    part(hand, 'Pulgar', 'box', iron, [side * .26, -.3, .2], [.12, .22, .14]);
  }
  const head = pivot(trunk, 'Cabeza', [0, 2.02, 0]);
  part(head, 'Cuello', 'box', iron, [0, .08, 0], [.5, .16, .5]);
  part(head, 'Cabeza de tejas', 'box', tile, [0, .38, 0], [1.3, .6, 1]);
  part(head, 'Visera', 'box', socket, [0, .42, .505], [1, .14, .03]);
  part(head, 'Chimenea', 'box', lime, [-.42, .86, -.3], [.22, .4, .22]);
  part(head, 'Sombrero de la chimenea', 'box', tileDark, [-.42, 1.08, -.3], [.3, .06, .3]);
  part(head, 'Azotea', 'box', tileDark, [0, .7, 0], [1.4, .06, 1.1]);
  // Uri up there, Nil in his arms (his file `carries` him), his eyes violet like the possessed dogs' (`uriEyes`).
  const uri = pivot(head, 'Uri arriba', [0, .73, .12]);
  const uriSpec = Object.values(import.meta.glob<CharacterSpec>('./characters/uri.json', { eager: true, import: 'default' }))[0];
  const uriRig = buildCharacter(uriSpec, uri);
  materials.push(...uriRig.materials);
  uri.setLocalScale(1.3, 1.3, 1.3);
  const violetEyes = mat('#5a2a8a', .8, 2.4);
  violetEyes.emissive.fromString('#b07aff'); violetEyes.update();
  // His eyes are painted on: a glowing violet one over each, a little wider, while the Queen holds him.
  const [w, h, d] = uriSpec.lids?.size ?? [.05, .07, .02];
  for (const eye of uriRig.eyes) {
    const glow = new pc.Entity(POSSESSED_EYE);
    glow.addComponent('render', { type: 'sphere', material: violetEyes, castShadows: false, receiveShadows: false });
    glow.setLocalPosition(0, 0, d * .2); glow.setLocalScale(w * .9, h * .8, d * .6);
    eye.addChild(glow);
  }
  /** Uri's eyes: violet, wider and glowing, while he is in the Queen's hold; his own once he is free. */
  function uriEyes(model: pc.Entity, free: boolean) {
    const up = model.findByName('Uri arriba') ?? model;
    for (const node of up.find(n => n.name === POSSESSED_EYE) as pc.Entity[]) node.enabled = !free;
  }
  uriEyes(vertigo, false);
  /** Per copy of Vertitrón: its joints with the figure's bones they turn (`jointsOf`), and its hands with the figure's (`handsOf`). */
  const joints = new WeakMap<pc.Entity, [pc.Entity, pc.Entity][]>();
  const handsAt = new WeakMap<pc.Entity, [pc.Entity, pc.Entity][]>();
  // Its look is its Meshy figure once that is loaded (`dressVertitron`): the joints above still carry every pose.
  const vertitron = hasModel(VERTITRON_FIGURE.id) ? dressVertitron(vertigo) : undefined;

  // Their young are the same fears, small (battle-scene.ts sizes them).
  const templates = new Map<FoeKind, pc.Entity>([['cebollon', onion], ['cebolla', onion], ['plato', dish], ['vertigo', vertigo], ['cebollita', onion], ['platito', dish], ['fantasmita', ghost]]);
  // Càmping Eurosport's foes (src/camping-foes.ts) come with them, so the fight finds every model in one place.
  const camping = createCampingFoes(app);
  camping.templates.forEach((model, kind) => templates.set(kind, model));
  // And Las cuerdas' (src/cuerdas-foes.ts): what Marta lost, and La Voz.
  const cuerdas = createCuerdasFoes(app);
  cuerdas.templates.forEach((model, kind) => templates.set(kind, model));
  // And the foes of Emilie's model (src/modelo-foes.ts).
  const modelo = createModeloFoes(app, (id, parent) => buildFoeBody(id, parent));
  modelo.templates.forEach((model, kind) => templates.set(kind, model));
  // And Fran's salon's (src/luca-foes.ts): what is eating Luca's colour.
  const luca = createLucaFoes((id, parent) => buildFoeBody(id, parent));
  luca.attach(app.root);
  luca.templates.forEach((model, kind) => templates.set(kind, model));
  /** Vertitrón's joints, found once per model. */
  const rigs = new WeakMap<pc.Entity, ReturnType<typeof rigOf>>();
  function rigOf(model: pc.Entity) {
    const by = (name: string) => model.findByName(name) as pc.Entity;
    const leg = (name: string) => { const thigh = by(name); return { thigh, knee: thigh.findByName('Rodilla') as pc.Entity, ankle: thigh.findByName('Tobillo') as pc.Entity }; };
    const arm = (name: string) => { const swing = by(name); return { swing, raise: swing.findByName('Brazo') as pc.Entity, elbow: swing.findByName('Codo') as pc.Entity, hand: swing.findByName('Mano del robot') as pc.Entity }; };
    return {
      hips: by('Cadera'), trunk: by('Tronco'), head: by('Cabeza'), eye: by('Ojo de Vertitrón'), ball: by('Globo'), spiral: by('Espiral'),
      legs: { [-1]: leg('Muslo izquierdo'), [1]: leg('Muslo derecho') } as Record<number, ReturnType<typeof leg>>,
      arms: { [-1]: arm('Hombro izquierdo'), [1]: arm('Hombro derecho') } as Record<number, ReturnType<typeof arm>>,
    };
  }
  const rig = (model: pc.Entity) => { let r = rigs.get(model); if (!r && model.findByName('Cadera')) { r = rigOf(model); rigs.set(model, r); } return r; };
  return {
    templates,
    /** Càmping Eurosport's foes: what each one's model shows of its rule (`show`). */
    camping,
    /** Las cuerdas' foes, the same. */
    cuerdas,
    /** The foes of Emilie's model, the same. */
    modelo,
    /**
     * Vertitrón's pose, every joint at once (the fight calls it each frame; the world too). Each move
     * is 0 to 1: `kneel` (beaten, down on both knees), `stomp` (a leg up, `stompSide` −1 left / 1 right),
     * `sweep` (an arm out flat, `sweepSide`, swung from behind it, `sweepAt` 0, across in front, 1),
     * `roar` (arms out, leaning back), `charge` (hunched over its eye), `recoil` (thrown back by its
     * own beam). `time` keeps its idle hum going; `spin` turns the spiral in its eye and `gaze` points
     * its eyeball (pitch, yaw, roll; degrees).
     */
    pose(model: pc.Entity, p: RobotPose) {
      const r = rig(model);
      if (!r) return;
      poseJoints(r, p);
      vertitron?.follow(model);
    },
    /** Its eye: cracked, its spiral gone (`broken`), or whole and turning. */
    eye(model: pc.Entity, broken: boolean) {
      const r = rig(model);
      if (!r) return;
      r.spiral.enabled = !broken;
      for (const crack of r.eye.find(n => n.name === 'Grieta') as pc.Entity[]) crack.enabled = broken;
    },
    uriEyes,
    destroy() { templates.forEach((t, kind) => { if (!camping.templates.has(kind as never) && !cuerdas.templates.has(kind as never) && !modelo.templates.has(kind as never) && !luca.templates.has(kind as never)) t.destroy(); }); materials.forEach(m => m.destroy()); camping.destroy(); cuerdas.destroy(); modelo.destroy(); luca.destroy(); },
  };
  /** Sets every joint of Vertitrón's for the pose `p` (see `pose`). */
  function poseJoints(r: ReturnType<typeof rigOf>, p: RobotPose) {
    {
      const k = p.kneel ?? 0, roar = p.roar ?? 0, charge = p.charge ?? 0, recoil = p.recoil ?? 0, stomp = p.stomp ?? 0, sweep = p.sweep ?? 0, t = p.time ?? 0;
      const hum = Math.sin(t * 1.6) * (1 - k), buzz = charge * Math.sin(t * 47) * .6;
      r.hips.setLocalPosition(0, ROBOT.hip - ROBOT.drop * k - .32 * sweep + hum * .025, -.12 * k);
      for (const side of [-1, 1]) {
        const leg = r.legs[side], up = p.stompSide === side ? stomp : 0;
        const thigh = -8 * k - 52 * up - 28 * sweep, knee = 92 * k + 74 * up + 52 * sweep;
        leg.thigh.setLocalEulerAngles(thigh, 0, side * 2 * up);
        leg.knee.setLocalEulerAngles(knee, 0, 0);
        // Flat to the floor while it steps; kneeling, its feet lie behind it, soles up.
        leg.ankle.setLocalEulerAngles(-(thigh + knee) * Math.max(up, sweep) + 96 * k, 0, 0);
      }
      const twist = p.sweepSide ? sweep * p.sweepSide * (14 - 34 * (p.sweepAt ?? 0)) : 0;
      r.trunk.setLocalEulerAngles(16 * k + 30 * sweep - 11 * roar + 7 * charge - 9 * recoil + hum * .7 + buzz, twist, (p.stomp ? -(p.stompSide ?? 1) * 3 * stomp : 0));
      r.head.setLocalEulerAngles(8 * k - 9 * roar + 4 * charge, 0, 0);
      for (const side of [-1, 1]) {
        const arm = r.arms[side], swung = p.sweepSide === side ? sweep : 0, at = p.sweepAt ?? 0;
        arm.swing.setLocalEulerAngles(0, swung * side * (40 - 150 * at), 0);
        const balance = p.stompSide ? (p.stompSide === side ? 16 : -16) * stomp : 0;
        arm.raise.setLocalEulerAngles(-20 * k - 28 * roar + 26 * charge + balance + Math.sin(t * 1.3 + side) * 2 * (1 - k), 0, side * (66 * swung + 58 * roar + 14 * charge + 6 + hum * 1.5));
        arm.elbow.setLocalEulerAngles(-14 - 16 * k - 34 * roar - 20 * charge + 10 * swung, 0, 0);
      }
      if (p.spin !== undefined) r.spiral.setLocalEulerAngles(0, 0, p.spin);
      if (p.gaze) r.ball.setLocalEulerAngles(p.gaze[0], p.gaze[1], p.gaze[2]);
    }
  }

  /**
   * Vertitrón's figure from Meshy (tools/figures.toml `[vertigo]`, src/monsters/vertigo.json) over its
   * joints: the primitives are hidden but their joints stay and the fight poses them as always; each
   * frame (`follow`) the figure's bones turn as their joint has turned from rest. Its eye (the fight's
   * part with its own PV: lens, spiral, cracks) goes into the window in its chest and Uri onto its
   * roof, on its bones; the hands the fight throws from go where the figure's are.
   */
  function dressVertitron(model: pc.Entity) {
    const holder = new pc.Entity('Figura de Vertitrón');
    const k = VERTITRON.tall / VERTITRON_FIGURE.height;
    holder.setLocalScale(k, k, k);
    model.addChild(holder);
    instantiateModel(VERTITRON_FIGURE.id, holder);
    const kept = ['Ojo de Vertitrón', 'Uri arriba', 'Charco pringoso'].map(name => model.findByName(name) as pc.Entity);
    for (const render of model.findComponents('render') as pc.RenderComponent[]) {
      let node: pc.GraphNode | null = render.entity;
      while (node && node !== model && node !== holder && !kept.includes(node as pc.Entity)) node = node.parent;
      if (node === model) render.enabled = false;
    }
    // Rest: every joint at its neutral pose, where the figure's own pose is its rest.
    poseJoints(rigOf(model), {});
    const relative = (root: pc.Entity, node: pc.GraphNode) => new pc.Quat().copy(root.getRotation()).invert().mul(node.getRotation());
    const scaleUnder = (node: pc.GraphNode) => node.getWorldTransform().getScale().x / model.getWorldTransform().getScale().x;
    const pairs = jointsOf(model);
    const rest = pairs.map(([joint, bone]) => ({ joint: relative(model, joint).invert(), bone: relative(model, bone) }));
    const hipsAt = (model.findByName('Cadera') as pc.Entity).getLocalPosition().clone();
    const hipsBone = model.findByName('Hips') as pc.Entity, hipsBoneAt = hipsBone.getLocalPosition().clone();
    // The eye into the window of its chest, Uri onto its roof: on the bones that carry them, at their size.
    const place = (node: pc.Entity, bone: string, at: readonly number[], size: number) => {
      const on = model.findByName(bone) as pc.Entity;
      on.addChild(node);
      node.setPosition(model.getWorldTransform().transformPoint(new pc.Vec3(at[0], at[1], at[2])));
      node.setRotation(model.getRotation());
      const s = size / scaleUnder(on);
      node.setLocalScale(s, s, s);
    };
    place(kept[0], 'Spine', VERTITRON.eye, VERTITRON.eyeSize);
    place(kept[1], 'Head', VERTITRON.uri, 1.3);
    const turned = new pc.Quat(), root = new pc.Quat(), hands = new pc.Vec3();
    return {
      /** Turns the figure's bones of `copy` as its joints are turned now. */
      follow(copy: pc.Entity) {
        const joints = jointsOf(copy);
        root.copy(copy.getRotation());
        joints.forEach(([joint, bone], i) => {
          turned.copy(root).invert().mul(joint.getRotation()).mul(rest[i].joint).mul(rest[i].bone);
          bone.setRotation(new pc.Quat().copy(root).mul(turned));
        });
        // The hips go down and forward as the joints' do, in the figure's longer legs.
        const hips = copy.findByName('Cadera') as pc.Entity, bone = joints[0][1];
        const moved = hips.getLocalPosition().clone().sub(hipsAt).mulScalar(VERTITRON.hips / (k * .01));
        bone.setLocalPosition(hipsBoneAt.x + moved.x, hipsBoneAt.y + moved.y, hipsBoneAt.z + moved.z);
        for (const [hand, at] of handsOf(copy)) hand.setPosition(hands.copy(at.getPosition()));
      },
    };
  }
  /** Vertitrón's joints and the figure's bones they turn, parents first (found once per copy). */
  function jointsOf(model: pc.Entity) {
    let found = joints.get(model);
    if (found) return found;
    const by = (name: string, under: pc.Entity = model) => under.findByName(name) as pc.Entity;
    // The joints on the picture's left (−x) are the figure's right side.
    const sides = [['izquierdo', 'Right'], ['derecho', 'Left']] as const;
    found = [[by('Cadera'), by('Hips')], [by('Tronco'), by('Spine02')], [by('Cabeza'), by('Head')]];
    for (const [ours, its] of sides) {
      const thigh = by(`Muslo ${ours}`), shoulder = by(`Hombro ${ours}`);
      found.push([thigh, by(`${its}UpLeg`)], [by('Rodilla', thigh), by(`${its}Leg`)], [by('Tobillo', thigh), by(`${its}Foot`)]);
      found.push([by('Brazo', shoulder), by(`${its}Arm`)], [by('Codo', shoulder), by(`${its}ForeArm`)]);
    }
    joints.set(model, found);
    return found;
  }
  /** Where the fight throws from (`Mano del robot`) and the figure's hand it follows. */
  function handsOf(model: pc.Entity) {
    let found = handsAt.get(model);
    if (!found) {
      found = ([['izquierdo', 'Right'], ['derecho', 'Left']] as const).map(([ours, its]) => [(model.findByName(`Hombro ${ours}`) as pc.Entity).findByName('Mano del robot') as pc.Entity, model.findByName(`${its}Hand`) as pc.Entity]);
      handsAt.set(model, found);
    }
    return found;
  }
}
/**
 * Vertitrón's Meshy figure (`dressVertitron`, model metres, measured on it): how tall it stands (the
 * height of the robot of primitives it dresses), how much further its hips move than the joints' (its
 * legs are longer), the centre of the window in its chest where the eye goes and its size there, and
 * the ridge of its roof where Uri stands.
 */
const VERTITRON = { tall: 5.1, hips: 1.3, eye: [0, 3.65, .26], eyeSize: .3, uri: [-.15, 4.82, 0] } as const;
/** The figure files the fears need loaded before they are built (`loadCharacterModels`). */
export const FEAR_FIGURES = [VERTITRON_FIGURE];
/** Vertitrón's measures (model metres): its hips over the floor, how far kneeling lowers them, and its eye up its trunk. */
export const ROBOT = { hip: 2.1, drop: .84, eye: 1.05 } as const;
export interface RobotPose { kneel?: number; stomp?: number; stompSide?: -1 | 1; sweep?: number; sweepSide?: -1 | 1; sweepAt?: number; roar?: number; charge?: number; recoil?: number; time?: number; spin?: number; gaze?: readonly [number, number, number] }
export type Fears = ReturnType<typeof createFears>;
