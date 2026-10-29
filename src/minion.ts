import * as pc from 'playcanvas';
import { idlePose } from './walk-animation';
import type { Effects } from './effects';
import type { MinionState } from './story';

/** Seconds of the entrance: the head rises out of the manhole, blows, pops, and sinks back. */
const RISE = .8, BLOW = 2.4, POP = 2.5, SINK = 2.8, DONE = 3.6;
/** How deep the root sits: out of sight, and with just the head and eyes above the lid. */
const HIDDEN = -2.4, PEEK = -.95;
/** Seconds the palace minion takes to climb all the way out of its drain. */
const RISE_ALL = 1.8;
/** Out of the drain with a gummy overshoot. */
function stretchOut(k: number) { const t = Math.min(1, Math.max(0, k)), c = 1.6; return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2; }
const marks0 = new pc.Vec3();
/** Seconds between the faint bubbles that rise through the manhole before the entrance. */
const HINT_EVERY = 11;
const smooth = (t: number) => { const k = Math.min(1, Math.max(0, t)); return k * k * (3 - 2 * k); };

/** Where the minion lives this frame, in world space; the game converts story cells for it. */
export interface MinionMarks { manhole: pc.Vec3; look: pc.Vec3; groundHeight: (x: number, z: number) => number }

/**
 * La Reina Bubbaloo's minion (docs/lore.md): a sticky body under a glossy, lumpy bubble-gum head,
 * dripping and standing in its own pink puddle. It lives in the manhole at the bottom of the
 * street and is barely ever seen: a faint pink bubble now and then, and, once, its head rising
 * through the lid to pop a gum bubble over the dogs before it sinks back.
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
  function part(parent: pc.Entity, name: string, type: pc.RenderComponent['type'], m: pc.Material, p: number[], s: number[], r: number[] = [0, 0, 0]) {
    const e = new pc.Entity(name); e.addComponent('render', { type, material: m, castShadows: type !== 'cylinder' });
    e.setLocalPosition(p[0], p[1], p[2]); e.setLocalScale(s[0], s[1], s[2]); e.setLocalEulerAngles(r[0], r[1], r[2]);
    parent.addChild(e); return e;
  }

  const root = new pc.Entity('Esbirro de la Reina Bubbaloo'); app.root.addChild(root);
  root.setLocalScale(1.15, 1.15, 1.15);
  part(root, 'Charco pringoso', 'cylinder', puddleSkin, [0, .015, 0], [1, .02, .85]);
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

  // A faint bubble that rises through the lid now and then, the only sign of it before the entrance.
  const hint = new pc.Entity('Burbuja en la alcantarilla'); app.root.addChild(hint);
  const hintSkin = part(hint, 'Burbuja', 'sphere', bubbleSkin, [0, 0, 0], [0, 0, 0]);

  /** `rising`/`standing`: in the palace it climbs all the way out of the drain and stays to fight. */
  let state: MinionState | 'emerging' | 'rising' | 'standing' = 'lurking';
  let timer = 0, time = 0, popped = false;
  let onPop: (() => void) | undefined;
  let finished: (() => void) | undefined;
  const towards = (from: pc.Vec3, to: pc.Vec3) => Math.atan2(to.x - from.x, to.z - from.z) * 180 / Math.PI;

  return {
    root,
    /** Where the story says it is: lurking (hint bubbles) before its entrance, gone below for good after. */
    set(next: MinionState | 'standing') { if (state !== 'emerging' && state !== 'rising') state = next; },
    /** Plays the entrance; `pop` runs when the bubble bursts over the dogs. Resolves once it has sunk back. */
    emerge(pop: () => void): Promise<void> {
      state = 'emerging'; timer = 0; popped = false; onPop = pop;
      return new Promise(resolve => { finished = resolve; });
    },
    /** Climbs all the way out of the drain, oozing and stretching, and stays there. */
    rise(): Promise<void> {
      state = 'rising'; timer = 0;
      effects.emit('goo', marks0, 12, .3);
      return new Promise(resolve => { finished = resolve; });
    },
    /** `shown` is false outside the street scene or during a fight. */
    update(dt: number, animate: boolean, marks: MinionMarks, shown = true) {
      time += dt; timer += dt;
      const idle = idlePose(time, 7);
      const ground = marks.groundHeight(marks.manhole.x, marks.manhole.z);
      // The faint hint: a small bubble swells over the lid and bursts.
      const cycle = time % HINT_EVERY;
      const swell = shown && animate && state === 'lurking' && cycle > HINT_EVERY - 1.4 ? (cycle - (HINT_EVERY - 1.4)) / 1.4 : 0;
      hint.enabled = swell > 0;
      if (swell) {
        const r = .05 + swell * .13;
        hint.setPosition(marks.manhole.x + .12, ground + .04 + r * .8, marks.manhole.z - .1);
        hintSkin.setLocalScale(r, r * .9, r);
        if (swell > .97) effects.emit('spore', hint.getPosition(), 2, .05);
      }
      marks0.copy(marks.manhole); marks0.y = ground + .1;
      let depth = HIDDEN, blow = 0, squash = animate ? Math.sin(time * 3.1) * .05 : 0;
      if (state === 'rising') {
        const t = animate ? timer : RISE_ALL;
        depth = HIDDEN * (1 - stretchOut(t / RISE_ALL));
        squash += animate ? Math.sin(t * 13) * .12 * (1 - Math.min(1, t / RISE_ALL)) : 0;
        if (t >= RISE_ALL) { state = 'standing'; const done = finished; finished = undefined; done?.(); }
      } else if (state === 'standing') {
        depth = 0;
        const cycle = time % 5;
        blow = animate && cycle > 3.4 ? Math.sin((cycle - 3.4) / 1.6 * Math.PI) * .6 : 0;
      }
      if (state === 'emerging') {
        const t = animate ? timer : DONE;
        depth = pc.math.lerp(HIDDEN, PEEK, smooth(t / RISE)) - (PEEK - HIDDEN) * smooth((t - SINK) / (DONE - SINK));
        // Squeezing through the lid: a wobble while it rises and sinks.
        squash += animate ? Math.sin(t * 15) * .1 * (1 - smooth((t - RISE) / .3) + smooth((t - SINK) / .3)) : 0;
        blow = t < POP ? smooth((t - RISE - .3) / (BLOW - RISE - .3)) * 1.6 : 0;
        if (!popped && t >= POP) {
          popped = true;
          const mouth = bubble.getPosition();
          effects.emit('goo', mouth, 14, .35);
          effects.emit('spore', mouth, 18, .6);
          onPop?.(); onPop = undefined;
        }
        if (t >= DONE) { state = 'gone'; const done = finished; finished = undefined; done?.(); }
      }
      root.enabled = shown && (state === 'emerging' || state === 'rising' || state === 'standing') && depth > HIDDEN + .05;
      if (!root.enabled) return;
      root.setPosition(marks.manhole.x, ground + depth, marks.manhole.z);
      // Mostly towards the camera (which looks from the south-east), glancing towards Gerard, so its face shows.
      const glance = ((towards(marks.manhole, marks.look) - 45 + 540) % 360) - 180;
      root.setLocalEulerAngles(0, 45 + Math.max(-40, Math.min(40, glance)), 0);
      body.setLocalScale(1 - squash * .5, 1 + squash, 1 - squash * .5);
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
    destroy() { root.destroy(); hint.destroy(); materials.forEach(m => m.destroy()); },
  };
}
export type Minion = ReturnType<typeof createMinion>;
