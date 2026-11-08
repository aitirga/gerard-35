import * as pc from 'playcanvas';
import type { FoeKind } from './battle';
import { buildCharacter, type CharacterSpec } from './character-model';
import { createCampingFoes } from './camping-foes';

/**
 * Uri's fears (docs/quests/nuria.md § The maze, § Final boss), built from primitives like the
 * minion: El Cebollón, a huge onion in layers; El Plato Misterioso, a covered dish; a fantasmita, an
 * arcade ghost of pixels; and Vertitrón, a robot of roof tiles and ladders with one eye in its chest
 * and Uri on its head. They reuse the minion's part names (`Cabeza de chicle`, `Charco pringoso`, `Ojo`) so the
 * fight animates them the same way: a wobbling head, a base on the ground, blinking eyes.
 */
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
  const shadow = mat('#2a2320', .2, 0, .35), eyeWhite = mat('#fffaf0', .6), pupil = mat('#1c1418', .8);
  function eyes(head: pc.Entity, y: number, z: number, gap: number, size: number, angry = 0) {
    for (const side of [-1, 1]) {
      part(head, 'Ojo', 'sphere', eyeWhite, [side * gap, y, z], [size, size, size * .5]);
      part(head, 'Pupila', 'sphere', pupil, [side * gap, y, z + size * .22], [size * .45, size * .45, size * .2]);
      if (angry) part(head, 'Ceja', 'box', pupil, [side * gap, y + size * .7, z + .02], [size * 1.1, size * .18, .03], [0, 0, side * -angry]);
    }
  }
  const root = (name: string) => { const e = new pc.Entity(name); e.enabled = false; app.root.addChild(e); return e; };

  // El Cebollón: a golden onion, layer on layer, a green sprout on top and roots below.
  const onion = root('El Cebollón');
  part(onion, 'Charco pringoso', 'cylinder', shadow, [0, .01, 0], [1.3, .02, 1.3]);
  const onionHead = new pc.Entity('Cabeza de chicle'); onionHead.setLocalPosition(0, .75, 0); onion.addChild(onionHead);
  const skins = ['#e9c46a', '#e2b04f', '#d69a3c', '#f2dc9b'].map(c => mat(c, .5));
  skins.forEach((m, i) => part(onionHead, 'Capa', 'sphere', m, [0, 0, 0], [1.3 - i * .12, 1.2 - i * .1, 1.3 - i * .12].map(v => v * (i === 3 ? .82 : 1))));
  part(onionHead, 'Brote', 'cone', mat('#6fae4a', .3), [0, .78, 0], [.22, .5, .22]);
  part(onionHead, 'Brote', 'cone', mat('#86c45c', .3), [.1, .72, .04], [.14, .38, .14], [0, 0, -25]);
  for (const x of [-.18, 0, .18]) part(onion, 'Raíz', 'cylinder', mat('#cdb48a'), [x, .1, 0], [.04, .22, .04], [0, 0, x * 60]);
  eyes(onionHead, .08, .58, .2, .17, 18);
  part(onionHead, 'Lágrima', 'sphere', mat('#8fd3ff', .9, .4, .8), [.34, -.05, .56], [.07, .11, .05]);

  // El Plato Misterioso: a white plate on a little table, the silver cloche peeking with two eyes.
  const dish = root('El Plato Misterioso');
  part(dish, 'Charco pringoso', 'cylinder', shadow, [0, .01, 0], [1.1, .02, 1.1]);
  part(dish, 'Mesita', 'cylinder', mat('#8a5a3a', .3), [0, .3, 0], [.12, .6, .12]);
  part(dish, 'Plato', 'cylinder', mat('#f7f4ee', .7), [0, .62, 0], [1, .05, 1]);
  const cloche = new pc.Entity('Cabeza de chicle'); cloche.setLocalPosition(0, .66, 0); dish.addChild(cloche);
  part(cloche, 'Campana', 'sphere', mat('#c9ccd2', .95), [0, .2, 0], [.86, .62, .86]);
  part(cloche, 'Asa', 'sphere', mat('#a7abb3', .95), [0, .54, 0], [.14, .1, .14]);
  part(cloche, 'Rendija', 'box', mat('#1c1418'), [0, .02, .4], [.6, .06, .06]);
  eyes(cloche, .06, .41, .12, .08);

  // A fantasmita: an arcade ghost of big pixels, magenta with a green glow.
  const ghost = root('Fantasmita');
  part(ghost, 'Charco pringoso', 'cylinder', shadow, [0, .01, 0], [1, .02, 1]);
  const pixels = new pc.Entity('Cabeza de chicle'); pixels.setLocalPosition(0, .35, 0); ghost.addChild(pixels);
  const neon = mat('#ff3ad6', .4, .5), edge = mat('#3aff8a', .4, .9);
  const rows = ['..####..', '.######.', '########', '########', '########', '########', '#.##.##.', '.#..#..#'];
  rows.forEach((row, r) => [...row].forEach((c, k) => { if (c === '#') part(pixels, 'Píxel', 'box', r === rows.length - 1 ? edge : neon, [(k - 3.5) * .14, (rows.length - r) * .14, 0], [.14, .14, .3]); }));
  for (const side of [-1, 1]) {
    part(pixels, 'Ojo', 'box', eyeWhite, [side * .21, .78, .16], [.2, .24, .04]);
    part(pixels, 'Pupila', 'box', mat('#2a3aff', .5, .3), [side * .21 + .04, .75, .19], [.1, .12, .03]);
  }

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
  // Uri up there, Nil in his arms, his eyes violet like the possessed dogs' (`uriEyes`).
  const uri = pivot(head, 'Uri arriba', [0, .73, .12]);
  const uriSpec = Object.values(import.meta.glob<CharacterSpec>('./characters/uri.json', { eager: true, import: 'default' }))[0];
  const uriRig = buildCharacter(uriSpec, uri);
  materials.push(...uriRig.materials);
  uri.setLocalScale(1.12, 1.12, 1.12);
  // Arms forward and in round Nil.
  [uriRig.limbs[1], uriRig.limbs[3]].forEach((arm, i) => arm.setLocalEulerAngles(-62, 0, i ? -22 : 22));
  const uriEyeScale = uriRig.eyes[0]?.getLocalScale().clone() ?? new pc.Vec3(1, 1, 1);
  const violetEyes = mat('#5a2a8a', .8, 2.4);
  violetEyes.emissive.fromString('#b07aff'); violetEyes.update();
  const brownEyes = uriRig.eyes[0]?.render?.meshInstances[0].material as pc.StandardMaterial;
  /** Uri's eyes: violet, wider and glowing, while he is in the Queen's hold; his own once he is free. */
  function uriEyes(model: pc.Entity, free: boolean) {
    const up = model.findByName('Uri arriba') ?? model;
    for (const node of up.find(n => n.name === 'Ojo') as pc.Entity[]) {
      node.render?.meshInstances.forEach(m => { m.material = free ? brownEyes : violetEyes; });
      node.setLocalScale(uriEyeScale.x * (free ? 1 : 2), uriEyeScale.y * (free ? 1 : 2.1), uriEyeScale.z * (free ? 1 : 1.6));
    }
  }
  uriEyes(vertigo, false);

  // Their young are the same fears, small (battle-scene.ts sizes them).
  const templates = new Map<FoeKind, pc.Entity>([['cebollon', onion], ['cebolla', onion], ['plato', dish], ['vertigo', vertigo], ['cebollita', onion], ['platito', dish], ['fantasmita', ghost]]);
  // Càmping Eurosport's foes (src/camping-foes.ts) come with them, so the fight finds every model in one place.
  const camping = createCampingFoes(app);
  camping.templates.forEach((model, kind) => templates.set(kind, model));
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
    },
    /** Its eye: cracked, its spiral gone (`broken`), or whole and turning. */
    eye(model: pc.Entity, broken: boolean) {
      const r = rig(model);
      if (!r) return;
      r.spiral.enabled = !broken;
      for (const crack of r.eye.find(n => n.name === 'Grieta') as pc.Entity[]) crack.enabled = broken;
    },
    uriEyes,
    destroy() { templates.forEach((t, kind) => { if (!camping.templates.has(kind as never)) t.destroy(); }); materials.forEach(m => m.destroy()); camping.destroy(); },
  };
}
/** Vertitrón's measures (model metres): its hips over the floor, how far kneeling lowers them, and its eye up its trunk. */
export const ROBOT = { hip: 2.1, drop: .84, eye: 1.05 } as const;
export interface RobotPose { kneel?: number; stomp?: number; stompSide?: -1 | 1; sweep?: number; sweepSide?: -1 | 1; sweepAt?: number; roar?: number; charge?: number; recoil?: number; time?: number; spin?: number; gaze?: readonly [number, number, number] }
export type Fears = ReturnType<typeof createFears>;
