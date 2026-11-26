import * as pc from 'playcanvas';
import { BODY_FIT, RIG, bodyFit } from './character-model';
import type { ClassId } from './battle';

/**
 * What an ánima adds to whoever wears it, on top of its colours (classes.ts `wearClass`), so the
 * wearer feels different and not only looks recoloured. Papagato: a cat's ears (one Haru's orange,
 * one Yuki's white), a tail that sways and a collar with a bell. Matemágico: ones and zeros of gold
 * light circling the wearer, turning to whoever looks. Tecnópata: a thin HUD visor (a cyan film on
 * a graphite frame), an earpiece with a short antenna whose tip blinks, and two thin cyan circuit
 * lines down the shirt. Dadista: a red bow tie at the throat and a monocle on a cord. Freática: a staff
 * gauge down the jacket and a water level meter at the hip. Colorista: pouches of pigment at the belt,
 * dust on the clothes and binoculars round the neck. Built from primitives on the rig and the body's fit (`bodyFit`), so it fits
 * every character and follows every pose; with reduced motion it holds still.
 */
const NAME = 'Atuendo de ánima';
const HARU = '#e9894a', HARU_DARK = '#3a2c28', YUKI = '#f4efe6', INNER = '#f0a7a2', BELL = '#f3cf78', GOLD = '#f3cf78', CYAN = '#4fe0ff', GRAPHITE = '#141b21', BOW = '#d9422b', BRASS = '#c9a24a', IVORY = '#efe6cf', GAUGE_WHITE = '#f4fffc', SHALLOW = '#27c2a0';
/** The binary ring: its height on the body, radius, tilt and the digits round it. */
const RING = { y: .78, radius: .58, tilt: 12, digits: '10110' } as const;
/** Colorista's dry pigments (src/powder-fx.ts `POWDER_COLOURS`): terracotta, mustard, sage, dusty teal, slate blue, brick. */
const PIGMENTS = ['#c4907b', '#cdb276', '#9db191', '#7fa6a1', '#8a97b6', '#b98078'] as const;
const reduced = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : undefined;

let solids: Map<string, pc.StandardMaterial> | undefined;
/** Paint, lit like the clothes. */
function solid(colour: string, gloss = .3, own = 0) {
  solids ??= new Map();
  const key = `${colour}:${gloss}:${own}`;
  let m = solids.get(key);
  if (!m) {
    m = new pc.StandardMaterial(); m.name = NAME; m.diffuse.fromString(colour); m.gloss = gloss;
    // `own`: a little of its colour whatever the light, so a pigment keeps its hue in a night fight.
    if (own) { m.emissive.fromString(colour); m.emissiveIntensity = own; }
    m.update(); solids.set(key, m);
  }
  return m;
}
const lights = new Map<string, pc.StandardMaterial>();
/** Light, not paint: added on top of what is behind it (the digits, the HUD on the lenses). */
function glow(colour = GOLD, opacity = .9, intensity = .9) {
  const key = `${colour}:${opacity}:${intensity}`;
  let light = lights.get(key);
  if (light) return light;
  light = new pc.StandardMaterial(); light.name = NAME;
  light.diffuse.set(0, 0, 0); light.emissive.fromString(colour); light.emissiveIntensity = intensity; light.useLighting = false;
  light.blendType = pc.BLEND_ADDITIVEALPHA; light.opacity = opacity; light.depthWrite = false;
  light.update(); lights.set(key, light);
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
  // A taller head than the cast's stretches what it holds: an ear keeps its shape, or it is a horn.
  if (head.name === RIG.mount) { const { x, y } = head.getLocalScale(); root.setLocalScale(1, x / y, 1); }
  part(root, 'cone', solid(colour), [0, .06, 0], [.17, .15, .045]);
  part(root, 'cone', solid(INNER, .2), [0, .05, .02], [.1, .1, .015]);
}

interface Tail { kind: 'tail'; segments: pc.Entity[]; bend: number[] }
/** `grown`: how far each digit has grown back (1 whole, 0 gone); `coming`: which of them are on their way back. */
interface Ring {
  kind: 'ring'; root: pc.Entity; digits: pc.Entity[]; grown: number[]; coming: boolean[];
  /** Horas extra (`ringMode`): what the ring is doing for it now, and its band of gold, made the first time it is needed. */
  mode?: RingMode; band?: { entity: pc.Entity; material: pc.StandardMaterial }; spin: number; shown: number; drop: number;
}
/**
 * Horas extra on Matemágico's ring (docs/animas/matemagico/README.md § Definitiva): `band`, the digits spinning faster and faster
 * until they melt into one band of gold (`melt` 0–1), and `heat` 0–1 overheating it, gold to white to a dirty orange; `cold`,
 * the ring stopped at the wearer's feet as cold zeros, `back` 0–1 of its digits gone back up to the waist, one by one.
 */
export type RingMode = { band: { melt: number; heat: number } } | { cold: { back: number } };
interface Blink { kind: 'blink'; tip: pc.Entity }
/** Nothing of it moves on its own. */
interface Still { kind: 'still' }
interface Look { root: pc.Entity; time: number; motion: Tail | Ring | Blink | Still }
const looks = new Set<Look>();
let ticking = false;

/** Papagato: ears, a tail of four links curling up behind, and a collar with a bell at the throat. */
function papagato(body: pc.Entity, head: pc.Entity | null): Look {
  if (head) { ear(head, -1, HARU); ear(head, 1, YUKI); }
  const root = pivot(body, [0, 0, 0]);
  // The collar: a soft band round the neck, a touch wider than the shirt so no face lies on it,
  // and a little gold bell hanging at the front.
  const fit = bodyFit(body, 'collar'), [wide, neck, deep] = fit, [, small, spine] = bodyFit(body, 'back');
  // A sculpted body gets a round one: a box would stand out from its rounded shoulders.
  if (fit === BODY_FIT.collar) part(root, 'box', solid(YUKI, .15), [0, neck, 0], [wide * 2, .06, deep * 2]);
  else part(root, 'torus', solid(YUKI, .15), [0, neck, 0], [wide * 2, .14, deep * 2]);
  part(root, 'sphere', solid(BELL, .8), [0, neck - .05, deep + .0175], [.065, .065, .065]);
  part(root, 'box', solid('#8a6a2a', .5), [0, neck - .064, deep + .0465], [.03, .008, .01]);
  // The tail: thin, from the small of the back, out and down, then curling up; ringed in Haru's
  // orange and dark, with Yuki's white at the tip.
  const segments: pc.Entity[] = [], bend = [-158, 32, 36, 38, 34];
  let holder = root, at = [0, small, spine];
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
  return { root, time: Math.random() * 10, motion: { kind: 'ring', root, digits, grown: digits.map(() => 1), coming: digits.map(() => false), spin: 0, shown: 0, drop: 0 } };
}
/** The ring's gold, its white-hot and its dirty orange (never violet nor pink). */
const BAND_HEAT = [[.953, .812, .471], [1, .97, .9], [.85, .45, .2]] as const;
/** Ash grey for the cold zeros at his feet. */
const COLD = '#8d8a84';
/** Puts `model`'s ring in Horas extra's `mode`, or back to itself (`undefined`). Nothing without a ring. */
export function ringMode(model: pc.Entity, mode: RingMode | undefined) {
  for (const look of looks) {
    const ring = look.motion;
    if (ring.kind !== 'ring' || !look.root.isDescendantOf(model)) continue;
    ring.mode = mode;
    if (mode && 'band' in mode && !ring.band) {
      const material = new pc.StandardMaterial(); material.name = NAME;
      material.diffuse.set(0, 0, 0); material.useLighting = false; material.blendType = pc.BLEND_ADDITIVEALPHA; material.depthWrite = false;
      material.emissive.set(...BAND_HEAT[0]); material.emissiveIntensity = 1.4; material.opacity = 0; material.update();
      ring.band = { entity: part(ring.root, 'torus', material, [0, 0, 0], [RING.radius * 2, .05, RING.radius * 2], [0, 0, 0], false), material };
    }
  }
}
const cold = () => glow(COLD, .7, .5), gold = () => glow();
/** Swaps a digit's light (gold, or the cold zeros' grey). */
function paint(digit: pc.Entity, material: pc.Material) {
  for (const node of digit.find(n => !!(n as pc.Entity).render) as pc.Entity[]) for (const mi of node.render!.meshInstances) if (mi.material !== material) mi.material = material;
}
/** How long a new zero takes to come out in the ring. */
const REGROW = .55;
/**
 * The zero of `model`'s ring nearest `near` leaves it, to become Matemágico's circle
 * (src/math-cast.ts): where it was, how big, and `back`, which brings a new one out in its place.
 * Nothing if there is no ring on the model or no zero in it.
 */
export function takeZero(model: pc.Entity, near: pc.Vec3) {
  for (const look of looks) {
    const ring = look.motion;
    if (ring.kind !== 'ring' || !look.root.isDescendantOf(model)) continue;
    let best = -1, bestDistance = Infinity;
    ring.digits.forEach((d, i) => {
      if (RING.digits[i] !== '0' || ring.grown[i] < 1) return;
      const distance = d.getPosition().distance(near);
      if (distance < bestDistance) { best = i; bestDistance = distance; }
    });
    if (best < 0) return undefined;
    const digit = ring.digits[best], at = digit.getPosition().clone(), scale = digit.getScale().x;
    ring.grown[best] = 0; digit.enabled = false;
    return { at, scale, back: () => { ring.coming[best] = true; digit.enabled = true; digit.setLocalScale(0, 0, 0); } };
  }
  return undefined;
}

/**
 * Tecnópata: a thin HUD visor (a cyan film on each eye, on a graphite frame), an earpiece on the
 * right ear with a short antenna whose tip blinks, and two thin circuit lines of cyan light down
 * the front of the shirt, each ending in a little node.
 */
function tecnopata(body: pc.Entity, head: pc.Entity | null): Look {
  const root = pivot(body, [0, 0, 0]);
  let tip = root;
  if (head) {
    part(head, 'box', solid(GRAPHITE, .6), [0, .27, .235], [.24, .012, .012]);
    for (const side of [-1, 1]) {
      part(head, 'box', solid(GRAPHITE, .6), [side * .163, .264, .11], [.009, .01, .24], [0, 0, 0]);
      part(head, 'box', glow(CYAN, .5, 1.2), [side * .079, .24, .235], [.078, .044, .004], [0, 0, 0], false);
      part(head, 'box', glow(CYAN, .95, 1.6), [side * .079, .257, .238], [.06, .005, .002], [0, 0, 0], false);
    }
    part(head, 'box', solid(GRAPHITE, .6), [.185, .2, .005], [.035, .075, .055]);
    part(head, 'sphere', glow(CYAN, .95, 1.4), [.204, .2, .005], [.016, .016, .016], [0, 0, 0], false);
    part(head, 'cylinder', solid(GRAPHITE, .6), [.19, .3, -.02], [.009, .14, .009], [0, 0, -8]);
    tip = part(head, 'sphere', glow(CYAN, 1, 2), [.2, .375, -.02], [.026, .026, .026], [0, 0, 0], false);
  }
  const [, chest, front] = bodyFit(body, 'chest');
  for (const side of [-1, 1]) {
    part(root, 'box', glow(CYAN, .85, 1.1), [side * .07, chest, front], [.01, .26, .004], [0, 0, 0], false);
    part(root, 'box', glow(CYAN, .85, 1.1), [side * .045, chest + .13, front], [.05, .01, .004], [0, 0, 0], false);
    part(root, 'box', glow(CYAN, 1, 1.5), [side * .07, chest - .13, front + .001], [.026, .026, .004], [0, 0, 0], false);
  }
  return { root, time: Math.random() * 10, motion: { kind: 'blink', tip } };
}

/**
 * Dadista: a red bow tie at the throat (two wings and a knot), and a brass monocle over the right
 * eye, its lens a faint ivory glint, on a thin cord down to the collar. A dada soirée, or a croupier.
 */
function dadaista(body: pc.Entity, head: pc.Entity | null): Look {
  const root = pivot(body, [0, 0, 0]);
  const [, neck, deep] = bodyFit(body, 'collar'), y = neck - .035, z = deep + .03;
  for (const side of [-1, 1]) part(root, 'cone', solid(BOW, .45), [side * .062, y, z], [.085, .1, .04], [0, 0, side * 90]);
  part(root, 'box', solid('#a52e1d', .45), [0, y, z + .012], [.034, .05, .03]);
  if (head) {
    part(head, 'torus', solid(BRASS, .85), [.079, .24, .242], [.11, .05, .11], [90, 0, 0]);
    part(head, 'cylinder', glow(IVORY, .28, .8), [.079, .24, .244], [.074, .003, .074], [90, 0, 0], false);
    part(head, 'box', solid(BRASS, .7), [.142, .15, .2], [.006, .2, .006], [14, 0, -22]);
  }
  return { root, time: 0, motion: { kind: 'still' } };
}

/**
 * Freática: a staff gauge of white light down the left of the jacket, with its three marks (a long
 * tick each, longer the higher) and short ticks between, and a water level meter at the hip:
 * the reel a hydrogeologist lowers down a borehole, its tape hanging with the probe at the end, whose
 * tip is lit in the green of shallow water.
 */
function freatica(body: pc.Entity): Look {
  const root = pivot(body, [0, 0, 0]);
  const [, chest, front] = bodyFit(body, 'chest'), [wide] = bodyFit(body, 'collar');
  const white = glow(GAUGE_WHITE, .92, 1.1), x = -.085, base = chest - .15;
  part(root, 'box', white, [x, chest, front], [.008, .32, .004], [0, 0, 0], false);
  for (let i = 0; i < 3; i++) part(root, 'box', white, [x + .008 + (.03 + i * .012) / 2, base + .05 + i * .1, front], [.03 + i * .012, .009, .004], [0, 0, 0], false);
  for (let i = 0; i < 6; i++) part(root, 'box', white, [x + .013, base + .025 + i * .05, front], [.018, .004, .004], [0, 0, 0], false);
  // On the side the fight's camera sees, behind the arm.
  const hip = pivot(root, [-(wide + .02), chest - .25, -.07], [0, 180, 0]);
  part(hip, 'cylinder', solid('#16303c', .55), [0, 0, 0], [.13, .034, .13], [0, 0, 90]);
  part(hip, 'cylinder', glow(SHALLOW, .9, .9), [.019, 0, 0], [.1, .004, .1], [0, 0, 90], false);
  part(hip, 'cylinder', solid('#0f2029', .7), [.022, 0, 0], [.036, .012, .036], [0, 0, 90]);
  part(hip, 'box', solid('#e9f3ee', .25), [.004, -.13, .05], [.004, .2, .012]);
  part(hip, 'cylinder', solid('#c7d3d1', .85), [.004, -.25, .05], [.02, .06, .02]);
  const tip = part(hip, 'sphere', glow(SHALLOW, 1, 1.8), [.004, -.288, .05], [.022, .022, .022], [0, 0, 0], false);
  return { root, time: Math.random() * 10, motion: { kind: 'blink', tip } };
}

/**
 * Colorista: the clothes of someone who has been throwing powder all day. Three cloth pouches of dry
 * pigment at the belt, each a chalk colour and tied at the neck with a cord, dust in the palette's
 * colours across the chest and the shoulders, and Luca's old binoculars hanging from the neck. Matte,
 * all of it: nothing here shines. Nothing in the hands: every skill is thrown.
 */
function prismatico(body: pc.Entity): Look {
  const root = pivot(body, [0, 0, 0]);
  const [, chest, front] = bodyFit(body, 'chest'), [wide, neck] = bodyFit(body, 'collar'), [, , spine] = bodyFit(body, 'back');
  const belt = chest - .27, cord = solid('#5b4a3c', .1), pigment = (colour: string) => solid(colour, .03, .3);
  // The pouches: on the side and the back the fight's camera sees, and one at the front of the hip, each sagging its own way.
  const pouches: [number, number, string, number][] = [[-(wide + .05), -.07, PIGMENTS[0], 12], [-(wide - .1), spine - .005, PIGMENTS[1], 5], [wide - .1, spine - .005, PIGMENTS[3], -6], [-(wide - .07), front + .04, PIGMENTS[2], -6]];
  for (const [x, z, colour, lean] of pouches) {
    const bag = pivot(root, [x, belt, z], [0, 0, lean]);
    part(bag, 'sphere', pigment(colour), [0, -.06, 0], [.125, .15, .105]);
    part(bag, 'cone', pigment(colour), [0, .025, 0], [.075, .07, .065]);
    part(bag, 'torus', cord, [0, .002, 0], [.075, .045, .065]);
  }
  // Dust on the clothes: flat matte patches, thrown from the hands up. On the chest, the shoulders and the back.
  const dust: [number, number, number, number, number, string][] = [
    [-.08, chest + .05, front + .002, .13, .1, PIGMENTS[2]], [.07, chest - .03, front + .002, .11, .09, PIGMENTS[1]], [0, chest - .14, front + .002, .14, .08, PIGMENTS[3]],
    [-(wide - .01), neck - .07, 0, .1, .1, PIGMENTS[1]], [wide - .01, neck - .09, .02, .09, .09, PIGMENTS[0]],
    [-.07, chest + .12, spine + .052, .15, .12, PIGMENTS[3]], [.06, chest - .02, spine + .034, .12, .1, PIGMENTS[0]], [-.03, chest - .16, spine + .02, .13, .08, PIGMENTS[1]],
  ];
  for (const [x, y, z, w, h, colour] of dust) part(root, 'sphere', pigment(colour), [x, y, z], [w, h, .022], [0, 0, (x + y) * 140 % 40 - 20], false);
  // The binoculars: two short barrels on a strap round the neck.
  const strap = solid('#3a3530', .15), glass = solid('#2f3a44', .5);
  for (const side of [-1, 1]) {
    part(root, 'box', strap, [side * .06, neck - .1, front], [.008, .21, .008], [-16, 0, side * 16]);
    part(root, 'cylinder', solid('#40403f', .25), [side * .03, chest + .07, front + .04], [.05, .075, .05], [90, 0, 0]);
    part(root, 'cylinder', glass, [side * .03, chest + .07, front + .079], [.04, .004, .04], [90, 0, 0]);
  }
  part(root, 'box', solid('#40403f', .25), [0, chest + .075, front + .035], [.03, .018, .03]);
  return { root, time: 0, motion: { kind: 'still' } };
}

/** Puts on what the ánima `id` adds (or takes it all off). Safe to call again and again. */
export function dressAnima(model: pc.Entity, id: ClassId | undefined) {
  const body = model.findByName(RIG.body) as pc.Entity | null;
  if (!body) return;
  // What the last ánima put on, and anything a cloned model brought along that nobody moves.
  for (const look of looks) if (!look.root.parent || look.root.parent === body) looks.delete(look);
  body.find(node => node.name === NAME && node.parent?.name !== NAME).forEach(node => (node as pc.Entity).destroy());
  const head = (body.findByName(RIG.mount) ?? body.findByName(RIG.head)) as pc.Entity | null;
  const look = id === 'papagato' ? papagato(body, head) : id === 'matemagico' ? matemagico(body) : id === 'tecnopata' ? tecnopata(body, head) : id === 'dadaista' ? dadaista(body, head) : id === 'freatica' ? freatica(body) : id === 'prismatico' ? prismatico(body) : undefined;
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
    } else if (motion.kind === 'still') {
      continue;
    } else if (motion.kind === 'blink') {
      // The antenna's tip blinks: on most of the time, off for a beat.
      motion.tip.enabled = still || (t * 1.3) % 1 < .8;
    } else {
      // The ring turns slowly; each digit rides it, bobbing, and faces whoever is looking. Horas extra (`ringMode`) spins
      // it up into its band, or leaves it cold at the feet and brings its digits back up one by one.
      const n = motion.digits.length, mode = motion.mode;
      const melt = mode && 'band' in mode ? mode.band.melt : 0, back = mode && 'cold' in mode ? mode.cold.back : 1;
      motion.spin += dt * (.7 + melt * melt * 22) * (mode && 'cold' in mode ? .15 : 1);
      motion.shown += ((melt > 0 ? 1 : 0) - motion.shown) * Math.min(1, dt * 10);
      // Down at the feet while cold; back up as the last digit returns.
      const down = mode && 'cold' in mode && back < 1 ? 1 : 0;
      motion.drop += (down - motion.drop) * Math.min(1, dt * (down ? 5 : 2.5));
      motion.root.setLocalPosition(0, RING.y - motion.drop * (RING.y - .06), 0);
      if (motion.band) {
        const { entity, material } = motion.band, heat = mode && 'band' in mode ? mode.band.heat : 0;
        const k = Math.min(1, heat * 2), [a, b] = heat < .5 ? [BAND_HEAT[0], BAND_HEAT[1]] : [BAND_HEAT[1], BAND_HEAT[2]], u = heat < .5 ? k : heat * 2 - 1;
        material.emissive.set(a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u);
        material.opacity = Math.max(0, Math.min(1, (melt - .45) / .4)) * motion.shown; material.update();
        entity.enabled = material.opacity > .01;
        entity.setLocalEulerAngles(0, motion.spin * 57.3, 0);
      }
      motion.digits.forEach((d, i) => {
        const a = motion.spin + i * Math.PI * 2 / n;
        const home = i / n < back || !(mode && 'cold' in mode);
        d.setLocalPosition(Math.cos(a) * RING.radius, (mode && 'cold' in mode ? 0 : Math.sin(t * 2.1 + i * 1.3) * .05), Math.sin(a) * RING.radius);
        paint(d, mode && 'cold' in mode && !home ? cold() : gold());
        // Melting into the band, the digits thin out as the band comes up.
        if (melt > 0 && !motion.coming[i]) { const s = Math.max(.001, 1 - Math.max(0, (melt - .4) / .5)); d.setLocalScale(s, s, s); }
        else if (!melt && !motion.coming[i] && motion.grown[i] >= 1) d.setLocalScale(1, 1, 1);
        d.setRotation(camera);
        // A new zero comes out in the place of one that left, with a little overshoot.
        if (motion.coming[i]) {
          motion.grown[i] = still ? 1 : Math.min(1, motion.grown[i] + dt / REGROW);
          const k = motion.grown[i] - 1, s = 1 + 2.4 * k * k * k + 1.4 * k * k;
          d.setLocalScale(s, s, s);
          if (motion.grown[i] >= 1) motion.coming[i] = false;
        }
      });
    }
  }
}
