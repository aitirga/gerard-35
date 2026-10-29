import * as pc from 'playcanvas';
import type { FoeKind } from './battle';

/**
 * Uri's fears (docs/quests/nuria.md § The maze, § Final boss), built from primitives like the
 * minion: El Cebollón, a huge onion in layers; El Plato Misterioso, a covered dish; Game Over, an
 * arcade ghost of pixels; and El Vértigo, a very tall thing of ladders and roof tiles with a spiral
 * eye. They reuse the minion's part names (`Cabeza de chicle`, `Charco pringoso`, `Ojo`) so the
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

  // Game Over: an arcade ghost of big pixels, magenta with a green glow.
  const ghost = root('Game Over');
  part(ghost, 'Charco pringoso', 'cylinder', shadow, [0, .01, 0], [1, .02, 1]);
  const pixels = new pc.Entity('Cabeza de chicle'); pixels.setLocalPosition(0, .35, 0); ghost.addChild(pixels);
  const neon = mat('#ff3ad6', .4, .5), edge = mat('#3aff8a', .4, .9);
  const rows = ['..####..', '.######.', '########', '########', '########', '########', '#.##.##.', '.#..#..#'];
  rows.forEach((row, r) => [...row].forEach((c, k) => { if (c === '#') part(pixels, 'Píxel', 'box', r === rows.length - 1 ? edge : neon, [(k - 3.5) * .14, (rows.length - r) * .14, 0], [.14, .14, .3]); }));
  for (const side of [-1, 1]) {
    part(pixels, 'Ojo', 'box', eyeWhite, [side * .21, .78, .16], [.2, .24, .04]);
    part(pixels, 'Pupila', 'box', mat('#2a3aff', .5, .3), [side * .21 + .04, .75, .19], [.1, .12, .03]);
  }

  // El Vértigo: a giant of ladders, five times Gerard's height. Two legs of ladder, a body of
  // stacked, crooked ladders armoured in roof tiles, arms of ladder hanging down, a great spiral eye,
  // and right at the top, frozen, Uri with Nil in his arms.
  const vertigo = root('El Vértigo');
  part(vertigo, 'Charco pringoso', 'cylinder', shadow, [0, .01, 0], [4.2, .02, 4.2]);
  const wood = mat('#6e5238', .25), woodDark = mat('#4a3626', .25), tile = mat('#b5583a', .35), tileDark = mat('#7f3524', .35);
  const ladder = (parent: pc.Entity, name: string, at: number[], lean: number[], h: number, w = .9) => {
    const l = new pc.Entity(name); l.setLocalPosition(at[0], at[1], at[2]); l.setLocalEulerAngles(lean[0], lean[1], lean[2]); parent.addChild(l);
    for (const side of [-1, 1]) part(l, 'Larguero', 'box', wood, [side * w / 2, h / 2, 0], [.14, h, .14]);
    for (let k = .35; k < h; k += .45) part(l, 'Peldaño', 'box', woodDark, [0, k, 0], [w, .08, .1]);
    return l;
  };
  // Legs, then the trunk, swaying a little apart.
  ladder(vertigo, 'Pierna', [-.9, 0, 0], [0, 0, 6], 3.4, .7); ladder(vertigo, 'Pierna', [.9, 0, 0], [0, 0, -6], 3.4, .7);
  const trunk = ladder(vertigo, 'Tronco', [0, 3.2, 0], [0, 0, 2], 3.6, 1.6);
  ladder(trunk, 'Brazo', [-1.3, 3.2, 0], [0, 0, 160], 2.8, .5); ladder(trunk, 'Brazo', [1.3, 3.2, 0], [0, 0, -160], 2.8, .5);
  // Roof tiles stuck on like scales, more of them higher up.
  for (let k = 0; k < 22; k++) {
    const y = .6 + (k / 22) * 3.2, a = k * 2.399;
    part(trunk, 'Teja', 'box', k % 2 ? tile : tileDark, [Math.cos(a) * .95, y, Math.sin(a) * .35 + .2], [.62, .1, .42], [25 * Math.sin(k * 1.3), k * 37, 20 * Math.cos(k * .7)]);
  }
  // The eye: a great spiral on the chest, turning (see `spin`).
  const eyeHead = new pc.Entity('Cabeza de chicle'); eyeHead.setLocalPosition(0, 2.4, .3); trunk.addChild(eyeHead);
  part(eyeHead, 'Marco del ojo', 'cylinder', woodDark, [0, 0, -.04], [2.3, .06, 2.3], [90, 0, 0]);
  const rings = ['#e0d0ff', '#9a6cd8', '#e0d0ff', '#6a3ab8', '#e0d0ff', '#2a1440'].map(c => mat(c, .6, .35));
  rings.forEach((m, i) => part(eyeHead, i === rings.length - 1 ? 'Ojo' : 'Espiral', 'cylinder', m, [0, 0, .02 + i * .014], [2.1 - i * .34, .02, 2.1 - i * .34], [90, 0, 0]));
  // Uri at the very top, Nil in his arms, too scared to move.
  const uri = new pc.Entity('Uri arriba'); uri.setLocalPosition(0, 3.75, 0); trunk.addChild(uri);
  const skin = mat('#e3b38f', .3), tee = mat('#f5f3ef', .3), jeans = mat('#2f3a4a', .3), hair = mat('#2e2420', .3);
  part(uri, 'Piernas de Uri', 'box', jeans, [0, .3, 0], [.32, .6, .22]);
  part(uri, 'Camiseta de Uri', 'box', tee, [0, .82, 0], [.42, .46, .28]);
  part(uri, 'Cabeza de Uri', 'sphere', skin, [0, 1.25, 0], [.32, .38, .3]);
  part(uri, 'Pelo de Uri', 'sphere', hair, [0, 1.38, -.03], [.31, .18, .29]);
  part(uri, 'Barba de Uri', 'sphere', hair, [0, 1.13, .06], [.24, .14, .2]);
  part(uri, 'Ojos de Uri', 'box', mat('#b07aff', .6, 1.4), [0, 1.27, .15], [.18, .04, .02]);
  part(uri, 'Nil', 'sphere', mat('#f7f5ef', .3), [0, .86, .2], [.22, .26, .2]);
  part(uri, 'Cabeza de Nil', 'sphere', mat('#efc9a8', .3), [0, 1.05, .24], [.16, .17, .15]);
  part(uri, 'Babero de Nil', 'box', mat('#6f93c4', .3), [0, .95, .3], [.13, .05, .05]);

  const templates = new Map<FoeKind, pc.Entity>([['cebollon', onion], ['plato', dish], ['game-over', ghost], ['vertigo', vertigo]]);
  return {
    templates,
    /** El Vértigo's eye turns while it spins (the warning); the fight calls this each frame. */
    spin(model: pc.Entity, dt: number, fast: boolean) {
      model.find(node => node.name === 'Espiral').forEach((ring, i) => (ring as pc.Entity).rotateLocal(0, (fast ? 400 : 60) * dt * (i % 2 ? -1 : 1), 0));
    },
    destroy() { templates.forEach(t => t.destroy()); materials.forEach(m => m.destroy()); },
  };
}
export type Fears = ReturnType<typeof createFears>;
