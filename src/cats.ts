import * as pc from 'playcanvas';
import { CAT_LEGS, CAT_RIG, CatGait, type CatInput, type CatLeg, type CatPose } from './cat-gait';

/**
 * Haru and Yuki (docs/animas/papagato/README.md), built from primitives like the street dogs.
 * Haru is a slim short-haired dilute calico (grey and cream patches, an orange-cream blaze, white
 * chest and paws, green eyes) and the bold one; Yuki a plump, long-haired white cat with grey at
 * the base of her tail and sleepy eyes, and the fearful one.
 *
 * Each one is rigged so src/cat-gait.ts can move it: a body pivot (`Cuerpo de gato`) that rises,
 * sits and tilts; four legs (`Pata`) of two bones each, the shoulder or hip and the wrist or hock
 * (`Rodilla`), ending in a paw on the ground; the head on its neck (`Cabeza de gato`) with ears that
 * turn (`Oreja`) and eyelids that blink (`Ojo`); and a tail (`Cola`) of four segments that curls
 * and waves. `cat.animate(dt, …)` after placing the cat reads where it is and poses it.
 */
export type CatId = 'haru' | 'yuki';
const COATS = {
  haru: { coat: '#7d7f86', patch: '#e4b88a', white: '#f4efe6', leg: '#7d7f86', eye: '#7fbf7a', nose: '#e7a3a0', inner: '#d99a98', fluff: 1, tail: '#7d7f86' },
  yuki: { coat: '#f6f3ee', patch: '#f6f3ee', white: '#ffffff', leg: '#f6f3ee', eye: '#a9c7e6', nose: '#f2b7c2', inner: '#efb4bd', fluff: 1.18, tail: '#9a9da4' },
} as const;
/** What a caller decides each frame; position, facing and scale come from the cat itself. */
export type CatAction = Omit<CatInput, 'x' | 'z' | 'facing' | 'scale'>;

export function createCat(app: pc.Application, id: CatId) {
  const look = COATS[id];
  const mats = new Map<string, pc.StandardMaterial>();
  const mat = (hex: string, gloss = .25) => {
    let m = mats.get(hex + gloss);
    if (!m) { m = new pc.StandardMaterial(); m.diffuse.fromString(hex); m.gloss = gloss; m.useMetalness = false; m.update(); mats.set(hex + gloss, m); }
    return m;
  };
  function part(parent: pc.Entity, name: string, type: pc.RenderComponent['type'], hex: string, p: number[], s: number[], r: number[] = [0, 0, 0], gloss?: number) {
    const e = new pc.Entity(name); e.addComponent('render', { type, material: mat(hex, gloss), castShadows: true });
    e.setLocalPosition(p[0], p[1], p[2]); e.setLocalScale(s[0], s[1], s[2]); e.setLocalEulerAngles(r[0], r[1], r[2]);
    parent.addChild(e); return e;
  }
  const pivot = (parent: pc.Entity, name: string, p: number[]) => { const e = new pc.Entity(name); e.setLocalPosition(p[0], p[1], p[2]); parent.addChild(e); return e; };
  const f = look.fluff;
  const cat = new pc.Entity(id === 'haru' ? 'Haru' : 'Yuki');
  // Everything hangs from the body, so sitting or crouching carries legs, head and tail with it.
  const body = pivot(cat, 'Cuerpo de gato', [0, CAT_RIG.bodyY, 0]);
  part(body, 'Lomo', 'sphere', look.coat, [0, 0, -.02], [.24 * f, .22 * f, .44 * f]);
  part(body, 'Pecho', 'sphere', look.white, [0, -.01, .12], [.2 * f, .2 * f, .2 * f]);
  if (id === 'haru') {
    part(body, 'Mancha', 'sphere', look.patch, [.05, .07, -.08], [.16, .08, .22]);
    part(body, 'Mancha', 'sphere', look.patch, [-.06, .05, -.16], [.12, .07, .14]);
  }
  // Legs: the upper bone in the coat, the lower one and the paw white (Haru's socks; Yuki is white all over).
  const thick = id === 'yuki' ? .058 : .05;
  const legs = {} as Record<CatLeg, { hip: pc.Entity; knee: pc.Entity }>;
  for (const leg of CAT_LEGS) {
    const j = CAT_RIG.joints[leg], [upper, lower] = CAT_RIG.bones[leg];
    // The haunch is thicker than the foreleg's upper bone.
    const width = thick * (leg[1] === 'h' ? 1.2 : 1);
    const hip = pivot(body, 'Pata', [j.x, j.y, j.z]);
    part(hip, 'Muslo', 'cylinder', look.leg, [0, -upper / 2, 0], [width, upper + .02, width]);
    const knee = pivot(hip, 'Rodilla', [0, -upper, 0]);
    part(knee, 'Articulación', 'sphere', look.leg, [0, 0, 0], [thick * .95, thick * .95, thick * .95]);
    part(knee, 'Caña', 'cylinder', look.white, [0, -lower / 2, 0], [thick * .82, lower, thick * .82]);
    // The paw's sole sits exactly at the bone's end, on the ground when the gait plants it.
    part(knee, 'Zarpa', 'sphere', look.white, [0, -lower + .012, .012], [thick * 1.1, .026, thick * 1.45]);
    legs[leg] = { hip, knee };
  }
  // The head pivots at the neck, like the dogs', so it can look round and lunge.
  const head = pivot(body, 'Cabeza de gato', [0, .09, .2]);
  part(head, 'Cabeza', 'sphere', look.coat, [0, .04, .03], [.19 * f, .17 * f, .17 * f]);
  part(head, 'Morro', 'sphere', look.white, [0, 0, .1], [.09, .06, .06]);
  part(head, 'Nariz', 'sphere', look.nose, [0, .02, .13], [.025, .018, .02]);
  if (id === 'haru') part(head, 'Lucero', 'box', look.patch, [0, .09, .095], [.035, .07, .02]);
  const ears: pc.Entity[] = [], eyes: { eye: pc.Entity; open: number }[] = [];
  for (const side of [1, -1]) {
    const ear = pivot(head, 'Oreja', [side * .055, .11, .02]);
    part(ear, 'Pabellón', 'cone', look.coat, [0, .02, 0], [.06, .07, .035], [0, 0, side * -12]);
    part(ear, 'Interior de la oreja', 'cone', look.inner, [0, .016, .011], [.034, .045, .01], [0, 0, side * -12]);
    ears.push(ear);
    const open = id === 'yuki' ? .016 : .028;
    eyes.push({ eye: part(head, 'Ojo', 'sphere', look.eye, [side * .045, .055, .1], [.03, open, .015], [0, 0, 0], .8), open });
  }
  // The tail: four segments, each hanging from the end of the last, thinner towards the tip.
  const tail: pc.Entity[] = [];
  let holder = pivot(body, 'Cola', [0, .02, -.22]);
  for (let i = 0; i < CAT_RIG.tailSegments; i++) {
    if (i) holder = pivot(holder, 'Cola', [0, CAT_RIG.tailSegment, 0]);
    const r = (.05 - i * .006) * f;
    const colour = id === 'yuki' && i === 0 ? look.tail : look.coat;
    part(holder, i ? 'Punta de la cola' : 'Base de la cola', 'cylinder', colour, [0, CAT_RIG.tailSegment / 2, 0], [r, CAT_RIG.tailSegment + .012, r]);
    part(holder, 'Nudo de la cola', 'sphere', colour, [0, 0, 0], [r, r, r]);
    tail.push(holder);
  }
  app.root.addChild(cat);

  const gait = new CatGait(id === 'haru' ? 0 : 2.3);
  const at = new pc.Vec3(), ahead = new pc.Vec3();
  /** Puts a pose on the rig (src/cat-gait.ts angles: legs forward positive, body and head nose up). */
  function apply(pose: CatPose) {
    body.setLocalPosition(0, pose.body.y, pose.body.z);
    body.setLocalEulerAngles(-pose.body.pitch, pose.body.yaw, pose.body.roll);
    for (const leg of CAT_LEGS) {
      legs[leg].hip.setLocalEulerAngles(-pose.legs[leg].hip, 0, 0);
      legs[leg].knee.setLocalEulerAngles(-pose.legs[leg].knee, 0, 0);
    }
    head.setLocalEulerAngles(-pose.head.pitch, pose.head.yaw, pose.head.roll);
    ears.forEach((ear, i) => ear.setLocalEulerAngles(-pose.ears[i], 0, 0));
    eyes.forEach(({ eye, open }) => { const s = eye.getLocalScale(); eye.setLocalScale(s.x, open * pose.blink, s.z); });
    tail.forEach((segment, i) => segment.setLocalEulerAngles(pose.tail[i].pitch, 0, pose.tail[i].side));
  }
  apply(new CatGait().update(0, { x: 0, z: 0, facing: 0, scale: 1, animate: false }));
  return {
    entity: cat, body, head, tail: tail[0],
    /**
     * Poses the cat for this frame from where the caller has just put it: its speed and turning
     * come from how far it moved since the last call, so a walk, a trot or a gallop follows.
     */
    animate(dt: number, action: CatAction = {}) {
      const world = cat.getWorldTransform();
      world.getTranslation(at); world.getZ(ahead);
      const pose = gait.update(dt, { ...action, x: at.x, z: at.z, facing: Math.atan2(ahead.x, ahead.z) * 180 / Math.PI, scale: world.getScale().x });
      apply(pose);
      return pose;
    },
    destroy() { cat.destroy(); mats.forEach(m => m.destroy()); },
  };
}
export type Cat = ReturnType<typeof createCat>;
