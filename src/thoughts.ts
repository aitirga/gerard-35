import * as pc from 'playcanvas';
import { RIG } from './character-model';

/**
 * Matemágico at 35, in a fight: a head that never stops. Two ghostly little birds glide round it,
 * and ideas (light bulbs) and question marks drift up out of it and fade away. Everything is soft
 * light: translucent, glowing, fading in and out. As a boy the ánima is still Nen curiós and keeps
 * its thoughts inside, so only grown-ups get them (classes.ts, `wearClass`).
 */
const NAME = 'Pensamientos';
/** Just over the hair, in body space (the head pivot is squashed, so the cloud hangs off the body). */
const TOP = 1.45;
const SIZE = 1.15;
/** Thoughts in the air at once, how often each one comes back, and how long it lives. */
const POPS = 3, PERIOD = 3.4, LIFE = 2.8;
const IDEA = '#ffd77a', QUESTION = '#e9f1ff', BIRD = '#a9dcf5';

/** Light, not paint: added on top of what is behind it, without lighting or shadows. */
function glow(colour: string, opacity: number) {
  const m = new pc.StandardMaterial();
  m.diffuse.set(0, 0, 0); m.emissive.fromString(colour); m.useLighting = false;
  m.blendType = pc.BLEND_ADDITIVEALPHA; m.opacity = opacity; m.depthWrite = false;
  m.update(); return m;
}

function part(parent: pc.Entity, type: string, material: pc.Material, p: number[], s: number[], r: number[] = [0, 0, 0]) {
  const e = new pc.Entity(NAME); parent.addChild(e);
  e.addComponent('render', { type, material, castShadows: false, receiveShadows: false });
  e.setLocalPosition(p[0], p[1], p[2]); e.setLocalScale(s[0], s[1], s[2]); e.setLocalEulerAngles(r[0], r[1], r[2]);
  return e;
}

/** A light bulb: a glowing glass and the outline of its screw. */
function bulb(parent: pc.Entity, light: pc.Material) {
  const holder = new pc.Entity(NAME); parent.addChild(holder);
  part(holder, 'sphere', light, [0, .07, 0], [.15, .16, .15]);
  part(holder, 'cylinder', light, [0, -.03, 0], [.06, .05, .06]);
  return holder;
}

/** A question mark drawn with thin strokes: a hook over a stem, and its dot. */
function mark(parent: pc.Entity, light: pc.Material) {
  const holder = new pc.Entity(NAME); parent.addChild(holder);
  const cy = .12, radius = .065, steps = 6;
  const at = (i: number) => { const a = Math.PI - i * (Math.PI * 1.5 / steps); return [Math.cos(a) * radius, cy + Math.sin(a) * radius]; };
  for (let i = 0; i < steps; i++) {
    const [x1, y1] = at(i), [x2, y2] = at(i + 1);
    part(holder, 'box', light, [(x1 + x2) / 2, (y1 + y2) / 2, 0], [Math.hypot(x2 - x1, y2 - y1), .032, .01], [0, 0, Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI]);
  }
  part(holder, 'box', light, [0, cy - radius - .03, 0], [.032, .06, .01]);
  part(holder, 'sphere', light, [0, -.035, 0], [.045, .045, .02]);
  return holder;
}

/** A little bird of light: body, head and two wings on pivots. */
function bird(parent: pc.Entity, light: pc.Material) {
  const holder = new pc.Entity(NAME); parent.addChild(holder);
  part(holder, 'sphere', light, [0, 0, 0], [.08, .065, .13]);
  part(holder, 'sphere', light, [0, .04, .065], [.06, .06, .06]);
  part(holder, 'box', light, [0, .005, -.08], [.05, .01, .05], [-15, 0, 0]);
  const wings = [-1, 1].map(side => {
    const pivot = new pc.Entity(NAME); holder.addChild(pivot); pivot.setLocalPosition(side * .03, .015, 0);
    part(pivot, 'sphere', light, [side * .07, 0, 0], [.14, .012, .065]);
    return { pivot, side };
  });
  return { holder, wings };
}

interface Pop { entity: pc.Entity; bulb: pc.Entity; mark: pc.Entity; light: pc.StandardMaterial; halo: pc.StandardMaterial; age: number; angle: number }
interface Cloud { root: pc.Entity; time: number; birds: ReturnType<typeof bird>[]; feathers: pc.StandardMaterial; pops: Pop[] }
const clouds = new Set<Cloud>();
let ticking = false;

function forget(cloud: Cloud) {
  clouds.delete(cloud);
  cloud.root.destroy();
  [cloud.feathers, ...cloud.pops.flatMap(p => [p.light, p.halo])].forEach(m => m.destroy());
}

/** Each thought is a bulb or a question mark, chosen as it appears. */
function choose(pop: Pop, idea: boolean) {
  pop.bulb.enabled = idea; pop.mark.enabled = !idea;
  for (const m of [pop.light, pop.halo]) { m.emissive.fromString(idea ? IDEA : QUESTION); m.update(); }
}

/** Turns the thoughts over `model`'s head on or off. Safe to call again and again. */
export function think(model: pc.Entity, on: boolean) {
  const body = model.findByName(RIG.body) as pc.Entity | null;
  for (const cloud of clouds) if (cloud.root.parent === body) forget(cloud);
  // A model cloned from one that was thinking brings a cloud nobody animates.
  body?.children.filter(c => c.name === NAME).forEach(c => c.destroy());
  if (!body || !on) return;
  const root = new pc.Entity(NAME); body.addChild(root); root.setLocalPosition(0, TOP, 0); root.setLocalScale(SIZE, SIZE, SIZE);
  const pops = Array.from({ length: POPS }, (_, i) => {
    const entity = new pc.Entity(NAME); root.addChild(entity);
    const light = glow(IDEA, 0), halo = glow(IDEA, 0);
    // A soft glow round every thought: nested spheres add up to a light that fades at its edge.
    for (const r of [.2, .28, .38]) part(entity, 'sphere', halo, [0, .06, 0], [r, r, r]);
    const pop = { entity, light, halo, bulb: bulb(entity, light), mark: mark(entity, light), age: -i * PERIOD / POPS, angle: i * 2.1 };
    choose(pop, i === 1); entity.enabled = false;
    return pop;
  });
  const feathers = glow(BIRD, .5);
  clouds.add({ root, time: Math.random() * 10, birds: [bird(root, feathers), bird(root, feathers)], feathers, pops });
  if (!ticking) { ticking = true; pc.AppBase.getApplication()?.on('update', tick); }
}

const smooth = (t: number) => t * t * (3 - 2 * t);
function tick(dt: number) {
  const app = pc.AppBase.getApplication();
  // Question marks face whoever is looking: the main camera, the one drawing to the screen.
  const view = app?.systems.camera?.cameras.find(c => c.entity.enabled && c.enabled && !c.renderTarget)?.entity.getRotation();
  for (const cloud of clouds) {
    if (!cloud.root.parent) { forget(cloud); continue; }
    if (!cloud.root.enabled) continue;
    const t = cloud.time += dt;
    // The birds glide slowly round the head, rising and sinking, and breathe in and out of sight.
    cloud.feathers.opacity = .38 + Math.sin(t * 1.3) * .14; cloud.feathers.update();
    cloud.birds.forEach(({ holder, wings }, i) => {
      const a = t * .95 + i * Math.PI, radius = .36 + Math.sin(t * .6 + i) * .05;
      holder.setLocalPosition(Math.cos(a) * radius, .08 + Math.sin(t * 1.4 + i * 2) * .07, Math.sin(a) * radius);
      holder.setLocalEulerAngles(Math.sin(t * 1.4 + i * 2) * -12, Math.atan2(-Math.sin(a), Math.cos(a)) * 180 / Math.PI, -14);
      // Slow beats with a glide in between.
      const flap = Math.max(0, Math.sin(t * 7 + i * 1.7)) * 38 - 8;
      wings.forEach(({ pivot, side }) => pivot.setLocalEulerAngles(0, 0, side * flap));
    });
    for (const pop of cloud.pops) {
      pop.age += dt;
      if (pop.age >= PERIOD) { pop.age -= PERIOD; pop.angle = Math.random() * Math.PI * 2; choose(pop, Math.random() < .4); }
      const shown = pop.age >= 0 && pop.age < LIFE;
      pop.entity.enabled = shown;
      if (!shown) continue;
      const p = pop.age / LIFE, rise = smooth(p);
      // Fades in as it leaves the head, drifts up swaying, and dissolves as it goes.
      const fade = Math.min(1, p / .25) * Math.min(1, (1 - p) / .4);
      pop.light.opacity = .85 * fade; pop.light.update();
      pop.halo.opacity = .05 * fade * (1 + Math.sin(t * 4 + pop.angle) * .3); pop.halo.update();
      const out = .06 + rise * .18, size = .75 + rise * .4;
      pop.entity.setLocalPosition(Math.cos(pop.angle) * out + Math.sin(t * 1.6 + pop.angle) * .05, .05 + rise * .6, Math.sin(pop.angle) * out);
      pop.entity.setLocalScale(size, size, size);
      if (view) pop.entity.setRotation(view);
      if (pop.bulb.enabled) pop.bulb.setLocalEulerAngles(0, 0, Math.sin(t * 1.8 + pop.angle) * 10);
    }
  }
}
