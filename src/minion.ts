import * as pc from 'playcanvas';
import { idlePose } from './walk-animation';
import type { Effects } from './effects';
import type { MinionState } from './story';

/** Seconds of the entrance: oozing out, blowing the bubble, the pop, and settling. */
const OUT = 1.1, BLOW = 2.5, POP = 2.6, SETTLE = 3.3;
const FLEE = 1.9;
const smooth = (t: number) => { const k = Math.min(1, Math.max(0, t)); return k * k * (3 - 2 * k); };

/** Where the minion lives this frame, in world space; the game converts story cells for it. */
export interface MinionMarks { hide: pc.Vec3; out: pc.Vec3; manhole: pc.Vec3; look: pc.Vec3; groundHeight: (x: number, z: number) => number }

/**
 * La Reina Bubbaloo's minion (docs/lore.md): a sticky body under a glossy, lumpy bubble-gum head,
 * dripping and standing in its own pink puddle. It hides flattened beside the parked car and
 * peeks out; its entrance blows a gum bubble that pops over the dogs.
 */
export function createMinion(app: pc.Application, effects: Effects) {
  const materials: pc.StandardMaterial[] = [];
  function mat(hex: string, gloss: number, glow = 0, opacity = 1) {
    const m = new pc.StandardMaterial(); m.diffuse.fromString(hex); m.gloss = gloss; m.useMetalness = false;
    m.specular.set(.55, .45, .5);
    if (glow) { m.emissive.fromString(hex); m.emissiveIntensity = glow; }
    if (opacity < 1) { m.opacity = opacity; m.blendType = pc.BLEND_NORMAL; m.depthWrite = false; }
    m.update(); materials.push(m); return m;
  }
  const gum = mat('#ff6fae', .88, .08), gumDeep = mat('#e0488a', .8, .05), goo = mat('#c2306f', .9, .04);
  const shine = mat('#ffd3e6', .9, .6), eye = mat('#24081a', .95), pupil = mat('#ff3d8b', .6, 1.6);
  const mouth = mat('#5a0f33', .4), bubbleSkin = mat('#ff9cc8', .95, .25, .72), puddleSkin = mat('#d23b7d', .95, .1);
  function part(parent: pc.Entity, name: string, type: string, m: pc.Material, p: number[], s: number[], r: number[] = [0, 0, 0]) {
    const e = new pc.Entity(name); e.addComponent('render', { type, material: m, castShadows: type !== 'cylinder' });
    e.setLocalPosition(p[0], p[1], p[2]); e.setLocalScale(s[0], s[1], s[2]); e.setLocalEulerAngles(r[0], r[1], r[2]);
    parent.addChild(e); return e;
  }

  const root = new pc.Entity('Esbirro de la Reina Bubbaloo'); app.root.addChild(root);
  root.setLocalScale(1.15, 1.15, 1.15);
  const puddle = part(root, 'Charco pringoso', 'cylinder', puddleSkin, [0, .015, 0], [1, .02, .85]);
  // Everything above the puddle squashes and stretches from the ground up.
  const body = new pc.Entity('Cuerpo'); root.addChild(body);
  part(body, 'Tronco de chicle', 'sphere', gumDeep, [0, .3, 0], [.6, .58, .54]);
  part(body, 'Barriga', 'sphere', gum, [0, .26, .12], [.42, .38, .34]);
  const drips: pc.Entity[] = [];
  for (const [x, z, h] of [[-.22, .16, .2], [.2, .18, .16], [.27, -.05, .22], [-.26, -.1, .18]]) {
    drips.push(part(body, 'Goterón', 'sphere', goo, [x, .12, z], [.11, h, .11]));
  }
  const arms = [-1, 1].map(side => {
    const arm = new pc.Entity('Brazo'); arm.setLocalPosition(side * .27, .38, .02); body.addChild(arm);
    part(arm, 'Brazo de chicle', 'sphere', gumDeep, [side * .1, -.08, 0], [.13, .3, .13], [0, 0, side * 35]);
    part(arm, 'Mano pegajosa', 'sphere', gum, [side * .19, -.22, .02], [.13, .11, .13]);
    // A thread of gum stretched between the hand and the body.
    part(arm, 'Hilo de chicle', 'cylinder', goo, [side * .05, -.2, .02], [.025, .2, .025], [0, 0, side * -60]);
    return arm;
  });

  // The head: a Bubbaloo gum ball, lumpy, shiny and dripping, with a liquid-pink glint in the eyes.
  const head = new pc.Entity('Cabeza de chicle'); head.setLocalPosition(0, .62, 0); body.addChild(head);
  part(head, 'Bola de chicle', 'sphere', gum, [0, .3, 0], [.92, .84, .86]);
  for (const [x, y, z, s] of [[-.3, .55, -.1, .34], [.28, .58, .05, .3], [.05, .7, -.18, .32], [-.18, .32, -.33, .3], [.34, .3, -.24, .26]]) {
    part(head, 'Bulto de chicle', 'sphere', gum, [x, y, z], [s, s * .9, s]);
  }
  part(head, 'Brillo', 'sphere', shine, [-.2, .55, .28], [.17, .09, .1], [0, 0, 25]);
  part(head, 'Brillo pequeño', 'sphere', shine, [-.06, .64, .33], [.06, .04, .04]);
  const headDrips: pc.Entity[] = [];
  for (const [x, z, h] of [[-.34, .2, .26], [.12, .37, .2], [.38, .1, .3], [-.1, -.36, .24]]) {
    headDrips.push(part(head, 'Gota de chicle', 'sphere', gum, [x, -.02, z], [.1, h, .1]));
  }
  const eyes: pc.Entity[] = [];
  for (const side of [-1, 1]) {
    const socket = new pc.Entity('Ojo'); socket.setLocalPosition(side * .16, .36, .38); head.addChild(socket);
    part(socket, 'Ojo de chicle', 'sphere', eye, [0, 0, 0], [.17, .2, .1]);
    part(socket, 'Pupila rosa', 'sphere', pupil, [side * -.02, .03, .045], [.06, .07, .03]);
    eyes.push(socket);
  }
  part(head, 'Boca', 'sphere', mouth, [0, .16, .4], [.16, .08, .06]);
  const bubble = part(head, 'Pompa de chicle', 'sphere', bubbleSkin, [0, .16, .46], [0, 0, 0]);

  let state: MinionState | 'emerging' | 'fleeing' = 'hiding';
  let timer = 0, time = 0, peek = 0, popped = false;
  let onPop: (() => void) | undefined;
  let finished: (() => void) | undefined;
  const at = new pc.Vec3();
  const towards = (from: pc.Vec3, to: pc.Vec3) => Math.atan2(to.x - from.x, to.z - from.z) * 180 / Math.PI;

  return {
    root,
    /** Places the minion where the story says it is, without animation. */
    set(next: MinionState) {
      if (state === 'emerging' || state === 'fleeing') return;
      if (next === 'gone' && state === 'out') { state = 'fleeing'; timer = 0; return; }
      state = next;
    },
    /** Plays the entrance; `pop` runs when the bubble bursts over the dogs. Resolves once it has settled. */
    emerge(pop: () => void): Promise<void> {
      state = 'emerging'; timer = 0; popped = false; onPop = pop;
      return new Promise(resolve => { finished = resolve; });
    },
    /** Whether the minion stands on the street now (so Gerard walks around it). */
    get solid() { return state === 'out' || state === 'emerging'; },
    update(dt: number, animate: boolean, marks: MinionMarks) {
      time += dt; timer += dt;
      const idle = idlePose(time, 7);
      let position = marks.out, rise = 1, squash = animate ? Math.sin(time * 3.1) * .05 : 0, blow = 0;
      let face = towards(marks.out, marks.look);
      root.enabled = state !== 'gone';
      if (state === 'hiding') {
        // Flat as a puddle beside the car; every few seconds the head pops up to peek, unless Gerard is close.
        const near = Math.hypot(marks.look.x - marks.hide.x, marks.look.z - marks.hide.z) < 3.2;
        const want = animate && !near && (time % 5.2) > 3.4 ? 1 : 0;
        peek += (want - peek) * (1 - Math.exp(-dt * (want ? 5 : 9)));
        position = at.lerp(marks.hide, marks.out, peek * .12);
        rise = .18 + peek * .62;
        face = towards(marks.hide, marks.look);
      } else if (state === 'emerging') {
        const t = animate ? timer : SETTLE;
        const out = smooth(t / OUT);
        position = at.lerp(marks.hide, marks.out, out);
        rise = .18 + .82 * smooth((t - .15) / .6);
        // Oozing along: a wobble that dies down once it stands.
        squash += animate ? Math.sin(t * 15) * .12 * (1 - out) : 0;
        blow = t < POP ? smooth((t - OUT) / (BLOW - OUT)) * 1.6 : 0;
        if (blow > 1.3 && animate) squash += Math.sin(t * 40) * .03;
        if (!popped && t >= POP) {
          popped = true;
          const mouth = bubble.getPosition();
          effects.emit('goo', mouth, 16, .35);
          effects.emit('spore', mouth, 18, .6);
          onPop?.(); onPop = undefined;
        }
        if (t >= SETTLE) { state = 'out'; const done = finished; finished = undefined; done?.(); }
      } else if (state === 'out') {
        // A small bubble now and then, gloating.
        const cycle = time % 6.5;
        blow = animate && cycle > 4.4 ? Math.sin((cycle - 4.4) / 2.1 * Math.PI) * .55 : 0;
      } else if (state === 'fleeing') {
        const t = animate ? timer : FLEE;
        position = at.lerp(marks.out, marks.manhole, smooth(t / 1.1));
        face = towards(marks.out, marks.manhole);
        rise = 1 - .85 * smooth((t - 1.05) / .7);
        squash += animate ? Math.sin(t * 18) * .1 : 0;
        if (t >= FLEE) { state = 'gone'; root.enabled = false; }
      }
      root.setPosition(position.x, marks.groundHeight(position.x, position.z) + .02, position.z);
      // Mostly towards the camera (which looks from the south-east), glancing towards Gerard, so its face shows.
      const glance = ((face - 45 + 540) % 360) - 180;
      root.setLocalEulerAngles(0, 45 + Math.max(-40, Math.min(40, glance)), 0);
      const stretch = rise * (1 + squash);
      body.setLocalScale(1 + (1 - rise) * .7 - squash * .5, Math.max(.05, stretch), 1 + (1 - rise) * .7 - squash * .5);
      puddle.setLocalScale(1 + (1 - rise) * .5, .02, .85 + (1 - rise) * .5);
      head.setLocalEulerAngles(animate ? idle.breathe * 4 : 0, animate ? idle.look * 14 : 0, animate ? Math.sin(time * 2.3) * 4 : 0);
      arms.forEach((arm, i) => arm.setLocalEulerAngles(0, 0, animate ? (i ? 1 : -1) * Math.sin(time * 2.6 + i) * 12 : 0));
      // Drips stretch and snap back at their own pace: the whole thing looks wet.
      [...drips, ...headDrips].forEach((drip, i) => {
        const base = drip.getLocalScale();
        const h = (i < drips.length ? .18 : .25) * (1 + (animate ? (Math.sin(time * 1.7 + i * 1.9) * .5 + .5) * .5 : 0));
        drip.setLocalScale(base.x, h, base.z);
      });
      eyes.forEach(socket => socket.setLocalScale(1, animate ? idle.blink : 1, 1));
      const b = blow * .48;
      bubble.enabled = b > .01;
      bubble.setLocalScale(b, b * .95, b);
      bubble.setLocalPosition(0, .16, .42 + b * .5);
    },
    destroy() { root.destroy(); materials.forEach(m => m.destroy()); },
  };
}
export type Minion = ReturnType<typeof createMinion>;
