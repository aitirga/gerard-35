import * as pc from 'playcanvas';
import { RIG } from './character-model';
import type { ClassId } from './battle';

/**
 * What an ánima adds to whoever wears it, on top of its colours (classes.ts `wearClass`), so the
 * wearer feels different and not only looks recoloured. Papagato: a cat's ears (one Haru's orange,
 * one Yuki's white), a tail that sways and a collar with a bell. Matemágico: ones and zeros of gold
 * light circling the wearer, turning to whoever looks. Built from primitives on the rig, so it fits
 * every character and follows every pose; with reduced motion it holds still.
 */
const NAME = 'Atuendo de ánima';
const HARU = '#e9894a', HARU_DARK = '#3a2c28', YUKI = '#f4efe6', INNER = '#f0a7a2', BELL = '#f3cf78', GOLD = '#f3cf78';
/** The binary ring: its height on the body, radius, tilt and the digits round it. */
const RING = { y: .78, radius: .58, tilt: 12, digits: '10110' } as const;
const reduced = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : undefined;

let solids: Map<string, pc.StandardMaterial> | undefined;
/** Paint, lit like the clothes. */
function solid(colour: string, gloss = .3) {
  solids ??= new Map();
  const key = `${colour}:${gloss}`;
  let m = solids.get(key);
  if (!m) { m = new pc.StandardMaterial(); m.name = NAME; m.diffuse.fromString(colour); m.gloss = gloss; m.update(); solids.set(key, m); }
  return m;
}
let light: pc.StandardMaterial | undefined;
/** Light, not paint: added on top of what is behind it (the digits). */
function glow() {
  if (light) return light;
  light = new pc.StandardMaterial(); light.name = NAME;
  light.diffuse.set(0, 0, 0); light.emissive.fromString(GOLD); light.emissiveIntensity = .9; light.useLighting = false;
  light.blendType = pc.BLEND_ADDITIVEALPHA; light.opacity = .9; light.depthWrite = false;
  light.update();
  return light;
}

function part(parent: pc.Entity, type: pc.RenderComponent['type'], material: pc.Material, p: number[], s: number[], r: number[] = [0, 0, 0], shadows = true) {
  const e = new pc.Entity(NAME); parent.addChild(e);
  e.addComponent('render', { type, material, castShadows: shadows, receiveShadows: shadows });
  e.setLocalPosition(p[0], p[1], p[2]); e.setLocalScale(s[0], s[1], s[2]); e.setLocalEulerAngles(r[0], r[1], r[2]);
  return e;
}
function pivot(parent: pc.Entity, p: number[], r: number[] = [0, 0, 0]) {
  const e = new pc.Entity(NAME); parent.addChild(e);
  e.setLocalPosition(p[0], p[1], p[2]); e.setLocalEulerAngles(r[0], r[1], r[2]);
  return e;
}

/** A cat's ear: a flat triangle (a squashed cone) leaning out, its pink inside a step in front. */
function ear(head: pc.Entity, side: number, colour: string) {
  const root = pivot(head, [side * .12, .44, 0], [-12, 0, -side * 22]);
  part(root, 'cone', solid(colour), [0, .06, 0], [.17, .15, .045]);
  part(root, 'cone', solid(INNER, .2), [0, .05, .02], [.1, .1, .015]);
}

interface Tail { kind: 'tail'; segments: pc.Entity[]; bend: number[] }
interface Ring { kind: 'ring'; root: pc.Entity; digits: pc.Entity[] }
interface Look { root: pc.Entity; time: number; motion: Tail | Ring }
const looks = new Set<Look>();
let ticking = false;

/** Papagato: ears, a tail of four links curling up behind, and a collar with a bell at the throat. */
function papagato(body: pc.Entity, head: pc.Entity | null): Look {
  if (head) { ear(head, -1, HARU); ear(head, 1, YUKI); }
  const root = pivot(body, [0, 0, 0]);
  // The collar: a soft band round the neck, a touch wider than the shirt so no face lies on it,
  // and a little gold bell hanging at the front.
  part(root, 'box', solid(YUKI, .15), [0, .93, 0], [.4, .06, .335]);
  part(root, 'sphere', solid(BELL, .8), [0, .88, .185], [.065, .065, .065]);
  part(root, 'box', solid('#8a6a2a', .5), [0, .866, .214], [.03, .008, .01]);
  // The tail: thin, from the small of the back, out and down, then curling up; ringed in Haru's
  // orange and dark, with Yuki's white at the tip.
  const segments: pc.Entity[] = [], bend = [-158, 32, 36, 38, 34];
  let holder = root, at = [0, .44, -.165];
  for (let i = 0; i < bend.length; i++) {
    holder = pivot(holder, at, [bend[i], 0, 0]);
    segments.push(holder);
    const colour = i === bend.length - 1 ? YUKI : i % 2 ? HARU_DARK : HARU, w = .045 - i * .004;
    part(holder, 'cylinder', solid(colour, .2), [0, .06, 0], [w, .13, w]);
    at = [0, .12, 0];
  }
  return { root, time: Math.random() * 10, motion: { kind: 'tail', segments, bend } };
}

/** A one: a stroke with its little flag. A zero: an upright oval ring. Both in light. */
function digit(parent: pc.Entity, one: boolean) {
  const holder = pivot(parent, [0, 0, 0]);
  if (one) {
    part(holder, 'box', glow(), [0, 0, 0], [.028, .13, .012], [0, 0, 0], false);
    part(holder, 'box', glow(), [-.022, .05, 0], [.04, .022, .012], [0, 0, -35], false);
  } else part(holder, 'torus', glow(), [0, 0, 0], [.14, .03, .2], [90, 0, 0], false);
  return holder;
}

/** Matemágico: a ring of ones and zeros circling the wearer at the waist, slightly tilted. */
function matemagico(body: pc.Entity): Look {
  const root = pivot(body, [0, RING.y, 0], [RING.tilt, 0, 0]);
  const digits = [...RING.digits].map(d => digit(root, d === '1'));
  return { root, time: Math.random() * 10, motion: { kind: 'ring', root, digits } };
}

/** Puts on what the ánima `id` adds (or takes it all off). Safe to call again and again. */
export function dressAnima(model: pc.Entity, id: ClassId | undefined) {
  const body = model.findByName(RIG.body) as pc.Entity | null;
  if (!body) return;
  // What the last ánima put on, and anything a cloned model brought along that nobody moves.
  for (const look of looks) if (!look.root.parent || look.root.parent === body) looks.delete(look);
  body.find(node => node.name === NAME && node.parent?.name !== NAME).forEach(node => (node as pc.Entity).destroy());
  const head = body.findByName(RIG.head) as pc.Entity | null;
  const look = id === 'papagato' ? papagato(body, head) : id === 'matemagico' ? matemagico(body) : undefined;
  if (!look) return;
  looks.add(look);
  if (!ticking) { ticking = true; pc.AppBase.getApplication()?.on('update', tick); }
}

const camera = new pc.Quat();
function tick(dt: number) {
  const app = pc.AppBase.getApplication();
  const view = app?.systems.camera?.cameras.find(c => c.entity.enabled && c.enabled && !c.renderTarget)?.entity.getRotation();
  if (view) camera.copy(view);
  const still = reduced?.matches;
  for (const look of looks) {
    if (!look.root.parent) { looks.delete(look); continue; }
    if (!still) look.time += dt;
    const t = look.time, motion = look.motion;
    if (motion.kind === 'tail') {
      // A lazy sway from the base, each link following a little later: the tip flicks.
      motion.segments.forEach((segment, i) => segment.setLocalEulerAngles(motion.bend[i], 0, Math.sin(t * 1.9 - i * .7) * (i ? 9 : 14)));
    } else {
      // The ring turns slowly; each digit rides it, bobbing, and faces whoever is looking.
      const n = motion.digits.length;
      motion.digits.forEach((d, i) => {
        const a = t * .7 + i * Math.PI * 2 / n;
        d.setLocalPosition(Math.cos(a) * RING.radius, Math.sin(t * 2.1 + i * 1.3) * .05, Math.sin(a) * RING.radius);
        d.setRotation(camera);
      });
    }
  }
}
