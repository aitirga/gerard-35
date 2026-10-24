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
  function part(parent: pc.Entity, name: string, type: string, m: pc.Material, p: number[], s: number[], r: number[] = [0, 0, 0]) {
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

  // El Vértigo: two ladders stacked crooked, roof tiles hanging off them, and on top a spiral eye.
  const vertigo = root('El Vértigo');
  part(vertigo, 'Charco pringoso', 'cylinder', shadow, [0, .01, 0], [1.6, .02, 1.6]);
  const wood = mat('#8a6a4a', .3), tile = mat('#b5583a', .35), tileDark = mat('#8f3f2a', .35);
  const ladder = (y: number, lean: number, h: number) => {
    const l = new pc.Entity('Escalera'); l.setLocalPosition(0, y, 0); l.setLocalEulerAngles(0, 0, lean); vertigo.addChild(l);
    for (const side of [-1, 1]) part(l, 'Larguero', 'box', wood, [side * .32, h / 2, 0], [.08, h, .08]);
    for (let k = .3; k < h; k += .38) part(l, 'Peldaño', 'box', wood, [0, k, 0], [.64, .05, .06]);
    return l;
  };
  ladder(0, 3, 1.5); const upper = ladder(1.42, -6, 1.2);
  for (let k = 0; k < 8; k++) part(vertigo, 'Teja', 'box', k % 2 ? tile : tileDark, [Math.sin(k * 2.1) * .6, .3 + k * .32, Math.cos(k * 1.7) * .2], [.46, .09, .3], [20 * Math.sin(k), k * 40, 15 * Math.cos(k)]);
  const eyeHead = new pc.Entity('Cabeza de chicle'); eyeHead.setLocalPosition(0, 1.35, .1); upper.addChild(eyeHead);
  const rings = ['#e0d0ff', '#9a6cd8', '#e0d0ff', '#6a3ab8', '#e0d0ff', '#2a1440'].map(c => mat(c, .6, .25));
  rings.forEach((m, i) => part(eyeHead, i === rings.length - 1 ? 'Ojo' : 'Espiral', 'cylinder', m, [0, 0, .02 + i * .012], [1.2 - i * .19, .02, 1.2 - i * .19], [90, 0, 0]));

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
