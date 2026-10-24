import * as pc from 'playcanvas';

/**
 * Haru and Yuki (docs/animas/papagato/README.md), built from primitives like the street dogs.
 * Haru is a slim short-haired dilute calico (grey and cream patches, an orange-cream blaze, white
 * chest and paws, green eyes) and the bold one; Yuki a plump, long-haired white cat with grey at
 * the base of her tail and sleepy eyes, and the fearful one. Parts carry the names the fights and
 * the street animate: `Cabeza de gato`, `Oreja`, `Ojo`, `Cola`, `Pata`.
 */
export type CatId = 'haru' | 'yuki';
const COATS = {
  haru: { coat: '#7d7f86', patch: '#e4b88a', white: '#f4efe6', eye: '#7fbf7a', nose: '#e7a3a0', fluff: 1, tail: '#7d7f86' },
  yuki: { coat: '#f6f3ee', patch: '#f6f3ee', white: '#ffffff', eye: '#a9c7e6', nose: '#f2b7c2', fluff: 1.18, tail: '#9a9da4' },
} as const;

export function createCat(app: pc.Application, id: CatId) {
  const look = COATS[id];
  const mats = new Map<string, pc.StandardMaterial>();
  const mat = (hex: string, gloss = .25) => {
    let m = mats.get(hex + gloss);
    if (!m) { m = new pc.StandardMaterial(); m.diffuse.fromString(hex); m.gloss = gloss; m.useMetalness = false; m.update(); mats.set(hex + gloss, m); }
    return m;
  };
  function part(parent: pc.Entity, name: string, type: string, hex: string, p: number[], s: number[], r: number[] = [0, 0, 0], gloss?: number) {
    const e = new pc.Entity(name); e.addComponent('render', { type, material: mat(hex, gloss), castShadows: true });
    e.setLocalPosition(p[0], p[1], p[2]); e.setLocalScale(s[0], s[1], s[2]); e.setLocalEulerAngles(r[0], r[1], r[2]);
    parent.addChild(e); return e;
  }
  const f = look.fluff;
  const cat = new pc.Entity(id === 'haru' ? 'Haru' : 'Yuki');
  part(cat, 'Lomo', 'sphere', look.coat, [0, .2, -.02], [.24 * f, .22 * f, .44 * f]);
  part(cat, 'Pecho', 'sphere', look.white, [0, .19, .12], [.2 * f, .2 * f, .2 * f]);
  if (id === 'haru') {
    part(cat, 'Mancha', 'sphere', look.patch, [.05, .27, -.08], [.16, .08, .22]);
    part(cat, 'Mancha', 'sphere', look.patch, [-.06, .25, -.16], [.12, .07, .14]);
  }
  for (const side of [-1, 1]) for (const z of [-.13, .12]) {
    part(cat, 'Pata', 'cylinder', look.white, [side * .07, .06, z], [.06, .12, .06]);
  }
  // The head pivots at the neck, like the dogs', so it can look round and lunge.
  const head = new pc.Entity('Cabeza de gato'); head.setLocalPosition(0, .29, .2); cat.addChild(head);
  part(head, 'Cabeza', 'sphere', look.coat, [0, .04, .03], [.19 * f, .17 * f, .17 * f]);
  part(head, 'Morro', 'sphere', look.white, [0, 0, .1], [.09, .06, .06]);
  part(head, 'Nariz', 'sphere', look.nose, [0, .02, .13], [.025, .018, .02]);
  if (id === 'haru') part(head, 'Lucero', 'box', look.patch, [0, .09, .095], [.035, .07, .02]);
  for (const side of [-1, 1]) {
    part(head, 'Oreja', 'cone', look.coat, [side * .055, .13, .02], [.06, .07, .035], [0, 0, side * -12]);
    part(head, 'Ojo', 'sphere', look.eye, [side * .045, .055, .1], [.03, id === 'yuki' ? .016 : .028, .015], [0, 0, 0], .8);
  }
  const tail = new pc.Entity('Cola'); tail.setLocalPosition(0, .22, -.22); cat.addChild(tail);
  part(tail, 'Base de la cola', 'cylinder', look.tail, [0, .03, -.07], [.045 * f, .16, .045 * f], [60, 0, 0]);
  part(tail, 'Punta de la cola', 'cylinder', look.coat, [0, .13, -.15], [.04 * f, .16, .04 * f], [20, 0, 0]);
  app.root.addChild(cat);
  return {
    entity: cat, head, tail,
    destroy() { cat.destroy(); mats.forEach(m => m.destroy()); },
  };
}
export type Cat = ReturnType<typeof createCat>;
