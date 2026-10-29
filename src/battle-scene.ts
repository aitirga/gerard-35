import * as pc from 'playcanvas';
import type { BattleEffect, BattleState, ClassId } from './battle';
import { CLASSES, grownUp, inheritColour, wearClass } from './classes';
import { ACTION_SECONDS, CONTACT_SECONDS, ENTRY_SECONDS, clamp01, contactMotion, smooth } from './battle-motion';
import { WalkAnimation, idlePose } from './walk-animation';
import { createGroundContact, type GroundHeight } from './ground-contact';
import { DOG_PROFILES } from './encounters';
import { tint, type Effects } from './effects';
import type { ParticleBody } from './particles';
import { FightClock, HIT, landing, spring, wobble, type Blow } from './hit-feel';
import { createCat, type Cat } from './cats';
import type { Fears } from './fears';

/**
 * Replace these stand-ins with imported models without changing combat or UI. `partyModel` gives
 * the street model each party fighter is cloned from (Gerard's own for himself and Bernat, Aitor's
 * for Aitor); `player` is Gerard's, hidden while the fight is on.
 */
export function createBattleScene(app: pc.Application, player: pc.Entity, partyModel: (id: string) => pc.Entity, groundHeight: GroundHeight, effects: Effects) {
  const materials: pc.StandardMaterial[] = [];
  function mat(hex: string) {
    const m = new pc.StandardMaterial(); m.diffuse.fromString(hex); m.update(); materials.push(m); return m;
  }
  const allyJacket = mat('#6f8fa8');
  const fur = mat('#c49464'), cream = mat('#f1dfb8'), dark = mat('#3c302a'), collar = mat('#a64d43');
  // Eyes have their own materials so La Reina Bubbaloo's minion can turn them dark pink and glowing.
  const eyeDark = mat('#3c302a'), eyePink = mat('#7a1240');
  eyePink.emissive.fromString('#ff2d86'); eyePink.emissiveIntensity = 1.6; eyePink.gloss = .8; eyePink.update();
  function part(parent: pc.Entity, name: string, type: pc.RenderComponent['type'], material: pc.StandardMaterial, p: number[], s: number[]) {
    const e = new pc.Entity(name); e.addComponent('render', { type, material, castShadows: true });
    e.setLocalPosition(p[0], p[1], p[2]); e.setLocalScale(s[0], s[1], s[2]); parent.addChild(e); return e;
  }
  const dog = new pc.Entity('Perro callejero'); app.root.addChild(dog);
  part(dog, 'Lomo', 'box', fur, [0, .48, 0], [.42, .4, .8]);
  part(dog, 'Pecho', 'box', cream, [0, .49, .28], [.35, .39, .2]);
  // The head pivots at the neck so dogs can sniff, glance and lunge.
  const head = new pc.Entity('Cabeza de perro'); head.setLocalPosition(0, .7, .3); dog.addChild(head);
  part(head, 'Cabeza', 'box', fur, [0, .14, .05], [.43, .4, .4]);
  part(head, 'Hocico', 'box', cream, [0, .04, .3], [.28, .2, .23]);
  part(head, 'Nariz', 'box', dark, [0, .09, .42], [.15, .1, .05]);
  part(dog, 'Collar rojo', 'box', collar, [0, .65, .3], [.44, .08, .31]);
  for (const side of [-1, 1]) {
    part(head, 'Ojo', 'sphere', eyeDark, [side * .12, .18, .258], [.055, .055, .03]);
    const ear = part(head, 'Oreja', 'box', dark, [side * .23, .21, -.04], [.12, .36, .24]);
    ear.setLocalEulerAngles(0, 0, side * 16);
    for (const z of [-.27, .27]) part(dog, 'Pata', 'box', cream, [side * .15, .18, z], [.12, .36, .15]);
  }
  const tail = part(dog, 'Cola', 'box', fur, [0, .66, -.5], [.1, .12, .47]); tail.setLocalEulerAngles(38, 0, 0);
  const dogs = [dog, dog.clone(), dog.clone(), dog.clone()].map((model, i) => {
    const profile = DOG_PROFILES[i];
    if (i > 0) app.root.addChild(model);
    model.name = profile.name;
    const coat = mat(profile.fur), band = mat(profile.collar);
    model.findComponents('render').forEach(component => {
      (component as pc.RenderComponent).meshInstances.forEach(mesh => {
        if (mesh.material === fur) mesh.material = coat;
        if (mesh.material === collar) mesh.material = band;
      });
    });
    model.enabled = false;
    return model;
  });
  const dogLegs = dogs.map(model => model.children.filter(c => c.name === 'Pata') as pc.Entity[]);
  const dogHeads = dogs.map(model => model.findByName('Cabeza de perro') as pc.Entity);
  const dogEars = dogs.map(model => model.find(node => node.name === 'Oreja') as pc.Entity[]);
  const dogEyes = dogs.map(model => model.find(node => node.name === 'Ojo') as pc.Entity[]);
  const dogTails = dogs.map(model => model.findByName('Cola') as pc.Entity);
  /** Shared idle life: seeded glances, panting and blinks. */
  function animateDogHead(head: pc.Entity, ears: pc.Entity[], eyes: pc.Entity[], seed: number, moving: boolean, animate: boolean, lunge = 0) {
    const idle = idlePose(time, seed);
    const sniff = moving || !animate ? 0 : Math.max(0, Math.sin(time * .8 + seed * 2)) ** 10 * 28;
    const trot = moving && animate ? Math.sin(time * 16 + seed) * 5 : 0;
    head.setLocalEulerAngles(animate ? sniff + trot + idle.breathe * 3 - lunge * 24 : 0, animate && !moving ? idle.look * 18 : 0, 0);
    ears.forEach((ear, i) => ear.setLocalEulerAngles(animate ? -lunge * 25 : 0, 0, (i ? 1 : -1) * (16 + (animate ? (moving ? Math.sin(time * 16 + seed) * 8 : idle.breathe * 4) : 0))));
    // Possessed eyes are wider (see possess) and a little taller too.
    eyes.forEach(eye => { const s = eye.getLocalScale(); eye.setLocalScale(s.x, (s.x > .06 ? .075 : .055) * (animate ? idle.blink : 1), s.z); });
  }
  const plantDogs = dogs.map((model, i) => createGroundContact(model, dogLegs[i]));
  const dogWalks = dogs.map(() => new WalkAnimation());
  const battleRoot = new pc.Entity('Escenario de combate'); app.root.addChild(battleRoot);
  interface Fighter {
    model: pc.Entity; base: pc.Vec3; start: pc.Vec3; hp: number; party: boolean;
    downAt?: number; poofed?: boolean; hitAt?: number; flashColor: pc.Color; flash: number; materials: pc.StandardMaterial[]; glow: pc.Color[];
    body: pc.Entity | null; head: pc.Entity | null; tail: pc.Entity | null; ears: pc.Entity[]; eyes: pc.Entity[]; eyeScale: number; seed: number;
    /** Foes that are not dogs (the palace minion) wobble instead of sniffing. */
    minion: boolean;
    /** Gerard at 35 or Aitor: a grown-up's Matemágico thinks out loud (thoughts.ts). */
    grown: boolean;
    arms: pc.Entity[]; legs: pc.Entity[]; yaw: number; turn: number; scale: pc.Vec3;
    walk: WalkAnimation;
    plantFeet: ReturnType<typeof createGroundContact>;
  }
  const fighters = new Map<string, Fighter>();
  /** How high the tallest foe reaches above the ground, so the camera can take it in (El Vértigo). */
  let foeTop = 0;
  /** Haru and Yuki, beside whoever wears Papagato (docs/animas/papagato/): they act on its skills. */
  const cats = new Map<string, { haru: Cat; yuki: Cat }>();
  /** Models for foes that are not dogs, cloned when a fight starts (the game passes the minion). */
  let minionTemplate: pc.Entity | undefined;
  /** Uri's fears (src/fears.ts), by kind, and how El Vértigo's eye turns. */
  let fears: Fears | undefined;
  // No-ta: a giant red rubber stamp that slams NO onto the target, and the word left on the ground.
  function lettering(fill: string, background?: string) {
    const c = document.createElement('canvas'); c.width = 256; c.height = 128;
    const ctx = c.getContext('2d')!;
    if (background) { ctx.fillStyle = background; ctx.fillRect(0, 0, 256, 128); }
    ctx.fillStyle = fill; ctx.font = '900 108px Inter, Arial Black, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('NO', 128, 70);
    if (!background) { ctx.strokeStyle = fill; ctx.lineWidth = 8; ctx.strokeRect(6, 6, 244, 116); }
    const t = new pc.Texture(app.graphicsDevice, { width: c.width, height: c.height, mipmaps: true }); t.setSource(c); return t;
  }
  const stampTexture = lettering('#fff4ec', '#e2483d'), inkTexture = lettering('#e2483d');
  const stampRed = mat('#c8323c');
  const stampFace = mat('#ffffff'); stampFace.diffuseMap = stampTexture; stampFace.emissiveMap = stampTexture; stampFace.emissive.set(.35, .35, .35); stampFace.update();
  const ink = mat('#ffffff'); ink.diffuseMap = inkTexture; ink.opacityMap = inkTexture; ink.opacityMapChannel = 'a'; ink.blendType = pc.BLEND_NORMAL; ink.depthWrite = false; ink.emissive.set(.5, .1, .1); ink.update();
  const stamp = new pc.Entity('Sello No-ta'); battleRoot.addChild(stamp); stamp.enabled = false;
  part(stamp, 'Mango del sello', 'cylinder', mat('#6e2453'), [0, .95, 0], [.32, .9, .32]);
  part(stamp, 'Pomo del sello', 'sphere', stampRed, [0, 1.5, 0], [.55, .45, .55]);
  part(stamp, 'Taco del sello', 'box', stampRed, [0, .3, 0], [1.5, .6, .8]);
  part(stamp, 'Cara del sello', 'plane', stampFace, [0, .3, .41], [1.4, 1, .55]).setLocalEulerAngles(90, 0, 0);
  const inkMark = part(battleRoot, 'Marca de tinta', 'plane', ink, [0, .04, 0], [2.4, 1, 1.2]); inkMark.enabled = false;
  let inkAt = -Infinity, shake = 0;
  let state: BattleState | undefined;
  let effect: BattleEffect | undefined;
  let effectTime = 0;
  let entryTime = ENTRY_SECONDS;
  let time = 0;
  let impact: (() => void) | undefined;
  let complete: (() => void) | undefined;
  let impacted = false;
  // Hit feel (hit-feel.ts): the fight's clock holds on contact; the camera lurch, the punch-in and the post pulse run on real time.
  const clock = new FightClock();
  const sway = [0, 1, 2].map(() => ({ x: 0, v: 0 })), zoom = { x: 0, v: 0 };
  let real = 0, animating = true;
  let pulse: ((fringe: number, bloom: number) => void) | undefined;
  /** A blow lands: the picture lurches along (x, y, z), heavy ones punch in and fringe; returns the landing for the hit-stop. */
  function land(blow: Blow, x: number, y: number, z: number) {
    const l = landing(blow);
    [x, y, z].forEach((d, i) => { sway[i].x = -d * l.kick; sway[i].v = 0; });
    zoom.x = Math.max(zoom.x, l.punch);
    pulse?.(l.fringe, l.bloom);
    return l;
  }
  const anchor = new pc.Vec3();
  const cameraKick = new pc.Vec3();
  const focus = new pc.Vec3();
  const targetMaterial = mat('#f3cf78');
  targetMaterial.emissive.fromString('#f3cf78'); targetMaterial.emissiveIntensity = .3; targetMaterial.update();
  const marker = part(battleRoot, 'Objetivo', 'cylinder', targetMaterial, [0, .03, 0], [1.1, .025, 1.1]);
  marker.enabled = false;
  let selectedTarget: string | undefined;
  /** Confetti falls once per won fight. */
  let celebrated = false;
  const face = (from: pc.Vec3, to: pc.Vec3) => Math.atan2(to.x - from.x, to.z - from.z) * 180 / Math.PI;
  const white = new pc.Color(1, .96, .86), green = new pc.Color(.62, 1, .5), gold = new pc.Color(1, .82, .4);
  function hit(f: Fighter, color: pc.Color, strength = 1) { f.hitAt = time; f.flash = strength; f.flashColor = color; }
  // Each fighter owns its material copies, so a flash never lights up the whole pack.
  function ownMaterials(model: pc.Entity) {
    const copies = new Map<pc.Material, pc.StandardMaterial>();
    model.findComponents('render').forEach(component => (component as pc.RenderComponent).meshInstances.forEach(mesh => {
      const source = mesh.material as pc.StandardMaterial;
      let copy = copies.get(source);
      if (!copy) { copy = source.clone(); copies.set(source, copy); inheritColour(source, copy); }
      mesh.material = copy;
    }));
    const materials = [...copies.values()];
    // What each copy glows with at rest (the possessed eyes), so a flash fades back to it.
    return { materials, glow: materials.map(m => m.emissive.clone().mulScalar(m.emissiveIntensity)) };
  }
  function settle() { const done = complete; complete = undefined; done?.(); }
  const floorUnder = (f: Fighter) => new pc.Vec3(f.base.x, groundHeight(f.base.x, f.base.z), f.base.z);
  /**
   * One-shot contact feedback: a flash and sparks where the blow lands, a ring and dust at the feet,
   * a flash on whoever is affected. Returns how a blow lands (hit-feel.ts); support skills only glow.
   */
  function contactBurst(action: BattleEffect, actor?: Fighter, target?: Fighter) {
    if (!actor || action.kind === 'escape') return;
    if (!target) { hit(actor, gold, .55); effects.emit('star', new pc.Vec3(actor.base.x, 1.3, actor.base.z), 8, .35); return; }
    // Análisis Parálisis: a gold flicker of ideas circling over everyone still standing.
    if (action.skill === 'analisis') { pulse?.(0, .3); for (const f of fighters.values()) if (f.party && f.hp > 0) { hit(f, gold, .7); effects.insight(new pc.Vec3(f.base.x, groundHeight(f.base.x, f.base.z) + 1.9 * f.scale.y, f.base.z)); } return; }
    // Yuki se esconde: a soft white shimmer over everyone she shelters.
    if (action.skill === 'escondite') { pulse?.(0, .25); for (const f of fighters.values()) if (f.party && f.hp > 0) { hit(f, white, .5); effects.emit('poof', new pc.Vec3(f.base.x, groundHeight(f.base.x, f.base.z) + .3, f.base.z), 5, .3); } return; }
    if (action.skill === 'cardioide') { pulse?.(0, .35); hit(target, green, .85); effects.heal(floorUnder(target), 1.6 * target.scale.y); return; }
    const guarded = state?.allies.find(a => a.id === action.target)?.guarding ?? false;
    const unit = state && [...state.allies, ...state.foes].find(u => u.id === action.target);
    const felt: Blow = { share: unit ? (action.amount ?? 0) / unit.maxHp : 0, skill: !!action.skill, guarded, ko: target.hp <= 0, swallowed: action.swallowed, beat: state?.phase === 'beat' };
    // No-ta: the stamp itself makes the noise (see the stamp below); the picture slams down with it.
    if (action.skill === 'nota') { hit(target, white, 1); return land(felt, 0, -1, 0); }
    const dx = target.base.x - actor.base.x, dz = target.base.z - actor.base.z, d = Math.hypot(dx, dz) || 1;
    const reach = target.party ? .25 : .6;
    const blow = new pc.Vec3(target.base.x - dx / d * reach, groundHeight(target.base.x, target.base.z) + (target.minion ? .9 : .85) * target.scale.y, target.base.z - dz / d * reach);
    effects.impact(blow, actor.base, action.skill ? 1.4 : 1, { guarded, gum: target.minion, feet: floorUnder(target) });
    hit(target, white, guarded ? .4 : 1);
    return land(felt, dx / d, 0, dz / d);
  }
  /** Which effect has started its trails, and how far: 1 once the spell leaves, 2 once the blow swings. */
  let trailed: BattleEffect | undefined, trailStage = 0;
  /**
   * Light left by the action in flight: the leading fist (a dog's nose, the gum's head) swings an
   * arc into the blow, skills in the wearer's ánima colour; a cure or a boost flies to whoever it
   * reaches, and No-ta's stamp streaks down. Short and fast: each one fades in a few tenths.
   */
  function trailsFor(action: BattleEffect, actor: Fighter, target: Fighter | undefined, t: number, support: boolean) {
    if (trailed !== action) { trailed = action; trailStage = 0; }
    const classId = state?.allies.find(a => a.id === action.actor)?.classId;
    const colour = action.skill && classId ? CLASSES[classId].colour : undefined;
    const light: [string, string] | undefined = colour ? [tint(colour, .35), colour] : undefined;
    const arm = actor.arms[0] as pc.Entity | undefined;
    if (trailStage === 0) {
      trailStage = 1;
      if (support && light) {
        // Cardioide flies to whoever it heals, Análisis Parálisis to every head; on oneself it winds round.
        const reached = action.skill === 'analisis' ? [...fighters.values()].filter(f => f.party && f.hp > 0) : target ? [target] : [];
        const from = (arm?.findByName('Mano') as pc.Entity | null ?? actor.model).getPosition();
        for (const f of reached) {
          const floor = groundHeight(f.base.x, f.base.z);
          if (f === actor) effects.trails.spiral({ x: f.base.x, y: floor + .3, z: f.base.z }, light, { radius: .5, narrow: .6, height: 1.5 * f.scale.y, turns: 1.2, seconds: .45, width: .09, core: .35 });
          else effects.comet(from, { x: f.base.x, y: floor + (action.skill === 'analisis' ? 1.9 : 1.1) * f.scale.y, z: f.base.z }, colour!, .24, { width: .13, arc: .6 });
        }
      }
      if (action.skill === 'nota' && stamp.enabled) for (const side of [-1, 1]) {
        effects.trails.follow(stamp, { offset: { x: side * .8, y: .3, z: 0 }, seconds: CONTACT_SECONDS, colour: ['#fff4ec', '#e2483d'], width: .11, life: .25, taper: .5, intensity: 2.4 });
      }
    }
    // A fist swings an arc in the swinger's own space, from just past the hand; a dog or the gum leaves a streak along its lunge.
    if (trailStage === 1 && !support && target && t >= (arm ? .24 : .16)) {
      trailStage = 2;
      const look = { colour: light ?? (actor.minion ? ['#ffd0e6', '#ff5fa2'] as const : ['#fff1cc', '#ffb347'] as const), width: light ? .2 : .15, intensity: light ? 3 : 1.8, core: light ? .7 : .45 };
      if (arm) effects.trails.follow(arm, { ...look, offset: { x: 0, y: -.42, z: 0 }, space: actor.model, seconds: .26, life: .2 });
      else if (actor.head) effects.trails.follow(actor.head, { ...look, offset: actor.minion ? { x: 0, y: .35, z: .45 } : { x: 0, y: .09, z: .45 }, seconds: .32, life: .2, width: .15 });
    }
  }
  /**
   * Haru sits a step ahead of Papagato's wearer, towards the foes; Yuki a step behind. Zarpazo de
   * Haru: she pounces on the target and trots back. Yuki se esconde: she slips behind the wearer
   * and curls up small.
   */
  function updateCats(t: number, animate: boolean, actor?: Fighter, target?: Fighter) {
    for (const [id, f] of fighters) {
      const ally = state?.allies.find(a => a.id === id);
      const wearing = !!ally && ally.classId === 'papagato' && f.hp > 0;
      let pair = cats.get(id);
      if (wearing && !pair) {
        pair = { haru: createCat(app, 'haru'), yuki: createCat(app, 'yuki') };
        battleRoot.addChild(pair.haru.entity); battleRoot.addChild(pair.yuki.entity);
        cats.set(id, pair);
        effects.emit('poof', new pc.Vec3(f.base.x, .2, f.base.z), 8, .3);
      }
      if (!pair) continue;
      pair.haru.entity.enabled = pair.yuki.entity.enabled = wearing && entryTime >= ENTRY_SECONDS * .6;
      if (!wearing) continue;
      const foes = [...fighters.values()].filter(o => !o.party && o.hp > 0);
      const center = foes.length ? foes.reduce((sum, o) => sum.add(o.base), new pc.Vec3()).mulScalar(1 / foes.length) : new pc.Vec3(f.base.x + 3, 0, f.base.z);
      const mine = effect?.actor === id;
      // Haru: rest, or the pounce out and back.
      const rest = new pc.Vec3(f.base.x + .75, 0, f.base.z - .5);
      let at = rest.clone(), lift = 0, look = center;
      if (mine && effect?.skill === 'zarpazo' && target && actor === f) {
        const out = smooth((t - .05) / (CONTACT_SECONDS - .05)), back = smooth((t - CONTACT_SECONDS - .15) / .45);
        const strike = new pc.Vec3(target.base.x - .55, 0, target.base.z + .1);
        at = new pc.Vec3().lerp(rest, strike, out * (1 - back));
        lift = animate ? Math.sin(out * Math.PI) * .55 * (1 - back) + Math.sin(back * Math.PI) * .3 : 0;
        look = back > .05 ? rest.clone().add(new pc.Vec3(-1, 0, 0)) : target.base;
      }
      placeCat(pair.haru, at, lift, look, animate, 0, 1);
      // Yuki: behind, or hiding behind the wearer.
      const shelter = new pc.Vec3(f.base.x - .55, 0, f.base.z + .5);
      const hide = mine && effect?.skill === 'escondite' ? (animate ? Math.sin(clamp01(t / .85) * Math.PI) : 0) : 0;
      const spot = new pc.Vec3().lerp(shelter, new pc.Vec3(f.base.x - .4, 0, f.base.z + .05), hide);
      placeCat(pair.yuki, spot, 0, center, animate, 2.3, 1 - hide * .35);
    }
  }
  function placeCat(cat: Cat, at: pc.Vec3, lift: number, look: pc.Vec3, animate: boolean, seed: number, height: number) {
    cat.entity.setPosition(at.x, groundHeight(at.x, at.z) + lift, at.z);
    cat.entity.setEulerAngles(0, face(at, look), 0);
    // A touch bigger than life, so they read from the fight's camera.
    cat.entity.setLocalScale(1.35, 1.35 * height, 1.35);
    const idle = idlePose(time, seed + 5);
    cat.tail.setLocalEulerAngles(animate ? Math.sin(time * 2.4 + seed) * 8 : 0, animate ? Math.sin(time * 1.6 + seed) * 28 : 0, 0);
    cat.head.setLocalEulerAngles(animate ? idle.breathe * 4 : 0, animate ? idle.look * 22 : 0, 0);
  }
  return {
    dogs, anchor, cameraKick, focus,
    /** How high the tallest foe of this fight reaches (0 outside a fight). */
    get foeTop() { return foeTop; },
    /** How much of the ortho height the frame is punched in by a heavy blow right now. */
    get punch() { return zoom.x; },
    /** How fast particles should run: slowed while a hit-stop holds the fight. */
    get pace() { return clock.hold > 0 ? HIT.pace : 1; },
    /** Where big moments send their chromatic fringe and bloom swell (post.pulse). */
    setPulse(next: (fringe: number, bloom: number) => void) { pulse = next; },
    /** The model cloned for minion foes. */
    setMinionTemplate(model: pc.Entity) { minionTemplate = model; },
    /** Uri's fears' models (src/fears.ts). */
    setFears(models: Fears) { fears = models; },
    /**
     * Gerard said no: a white flash and a shockwave that rocks the foes, and when it fades he
     * wears his class. The story records the class; this is only what the fight shows.
     */
    awaken(id: ClassId) {
      const gerard = fighters.get('gerard');
      if (!gerard) return;
      hit(gerard, white, 2.2); shake = .8;
      if (animating) { pulse?.(1, 1); zoom.x = HIT.punch.size; }
      effects.anima(gerard.base, CLASSES[id].colour, true);
      for (const f of fighters.values()) if (!f.party) hit(f, white, .9);
      setTimeout(() => wearClass(gerard.model, id, gerard.grown), 260);
    },
    /**
     * L / R in a fight: a burst of light in the ánima's colour, sparks rising round them, and the
     * fighter comes out of it wearing the other ánima.
     */
    changeAnima(id: string, classId: ClassId) {
      const f = fighters.get(id);
      if (!f) return;
      hit(f, new pc.Color().fromString(CLASSES[classId].colour), 1.8);
      if (animating) pulse?.(.25, .45);
      effects.anima(f.base, CLASSES[classId].colour);
      setTimeout(() => wearClass(f.model, classId, f.grown), 180);
    },
    /** Dark pink, glowing eyes for the street dogs: they obey La Reina Bubbaloo's minion. */
    possess(on: boolean) {
      for (const eyes of dogEyes) for (const eye of eyes) {
        eye.render!.meshInstances[0].material = on ? eyePink : eyeDark;
        // Wider, glowing eyes read from the street camera; blinking only touches the height.
        const size = eye.getLocalScale();
        eye.setLocalScale(on ? .085 : .055, size.y, on ? .04 : .03);
      }
    },
    selectTarget(id?: string) { selectedTarget = id; },
    /** Adds whoever is standing in the fight to `out`, so particles flow around them. */
    bodies(out: ParticleBody[]) {
      for (const f of fighters.values()) {
        if (!f.model.enabled) continue;
        const p = f.model.getPosition();
        out.push({ x: p.x, y: p.y, z: p.z, radius: (f.party ? .3 : .38) * f.scale.x, height: (f.party ? 1.5 : 1) * f.scale.y, key: f.model });
      }
    },
    targets() {
      return [...fighters].map(([id, f]) => ({
        id, position: f.model.getPosition().clone().add(new pc.Vec3(0, f.party ? 1.65 : 1.45, 0)), visible: f.hp > 0 && entryTime >= ENTRY_SECONDS,
      }));
    },
    wander(i: number, dt: number, moving: boolean, animate: boolean) {
      const gait = dogWalks[i].update(dt, moving, animate, .32);
      dogLegs[i].forEach((leg, index) => leg.setLocalEulerAngles(gait.stride * (index === 0 || index === 3 ? 1 : -1), 0, 0));
      animateDogHead(dogHeads[i], dogEars[i], dogEyes[i], i, moving, animate);
    },
    get entering() { return !!state && entryTime < ENTRY_SECONDS; },
    get entryProgress() { return smooth(entryTime / ENTRY_SECONDS); },
    /**
     * `alongZ`: the fight is staged in a corridor that runs along z (Uri's tower), so the two sides
     * face each other along it instead of across it.
     */
    set(next: BattleState | undefined, center: pc.Vec3, nextEffect?: BattleEffect, onImpact?: () => void, alongZ = false): Promise<void> {
      settle();
      const entering = !!next && !state;
      if (entering) {
        anchor.copy(center); entryTime = 0; celebrated = false;
        for (const [party, units] of [[true, next.allies], [false, next.foes]] as const) units.forEach((unit, i) => {
          // The palace guards (chapter 2) are minions grown to the size of a wardrobe.
          const fear = !party && unit.kind ? fears?.templates.get(unit.kind) : undefined;
          const minion = !party && (!!fear || ((unit.kind === 'minion' || unit.kind === 'guardian') && !!minionTemplate));
          const source = party ? partyModel(unit.id) : fear ?? (minion ? minionTemplate! : dogs[i]);
          const model = source.clone(); model.enabled = true;
          if (unit.id === 'bernat') model.findComponents('render').forEach(component => {
            (component as pc.RenderComponent).meshInstances.forEach(mesh => {
              if (mesh.material?.name === 'Camiseta mostaza') mesh.material = allyJacket;
            });
          });
          const across = (i - (units.length - 1) / 2) * (alongZ ? 1.1 : 1.9) + (party ? .6 : -.6) * (alongZ ? .4 : 1), apart = party ? -2.2 : 1.2;
          const base = alongZ ? new pc.Vec3(anchor.x + across * .5, anchor.y + .15, anchor.z - apart * 1.3) : new pc.Vec3(anchor.x + apart, anchor.y + .15, anchor.z + across);
          const start = source.getPosition().clone(); if (party) start.z += i * 1.4;
          battleRoot.addChild(model); model.setPosition(start);
          const body = party ? model.findByName('Cuerpo') as pc.Entity : null;
          const arms = (body?.children.filter(c => c.name === 'Brazo') ?? []) as pc.Entity[];
          if (minion) { const size = unit.kind === 'guardian' ? 2.3 : 1.5; model.setLocalScale(size, size, size); }
          const legs = (body?.children.filter(c => c.name === 'Pierna') ?? (minion ? [] : model.children.filter(c => c.name === 'Pata'))) as pc.Entity[];
          const yaw = party ? (source.findByName('Cuerpo') as pc.Entity).getLocalEulerAngles().y : source.getEulerAngles().y;
          if (body) body.setLocalEulerAngles(0, 0, 0);
          model.setLocalEulerAngles(0, yaw, 0);
          const feet = party ? legs.map(leg => leg.findByName('Zapatilla') as pc.Entity) : minion ? [model.findByName('Charco pringoso') as pc.Entity] : legs;
          const head = model.findByName(party ? 'Pivote de cabeza' : minion ? 'Cabeza de chicle' : 'Cabeza de perro') as pc.Entity | null;
          const eyes = model.find(node => node.name === 'Ojo') as pc.Entity[];
          fighters.set(unit.id, {
            model, base, start, hp: unit.hp, party, body, head, arms, legs, yaw, turn: yaw, eyes, tail: model.findByName('Cola') as pc.Entity | null, minion, grown: party && grownUp(unit.profile),
            ears: model.find(node => node.name === 'Oreja') as pc.Entity[], eyeScale: eyes[0]?.getLocalScale().y ?? 1, seed: party ? i * 3.1 + .4 : i,
            flash: 0, flashColor: white, ...ownMaterials(model),
            scale: model.getLocalScale().clone(), walk: new WalkAnimation(), plantFeet: createGroundContact(model, feet),
          });
          // Whoever wears an ánima shows it in the fight, even when the street model does not (Gerard at 35, Aitor).
          // Dressed after ownMaterials, so the street model keeps its own look.
          if (party) wearClass(model, unit.classId, grownUp(unit.profile));
        });
      }
      if (next && !foeTop) {
        // Measured once per fight, in the pose it was built in.
        for (const f of fighters.values()) if (!f.party) for (const r of f.model.findComponents('render') as pc.RenderComponent[]) for (const m of r.meshInstances) foeTop = Math.max(foeTop, m.aabb.getMax().y - f.model.getPosition().y);
      }
      if (!next) foeTop = 0;
      state = next; effect = nextEffect; effectTime = 0; impact = onImpact; impacted = false; clock.clear();
      if (!next) { cats.forEach(pair => { pair.haru.destroy(); pair.yuki.destroy(); }); cats.clear(); fighters.forEach(f => { f.model.destroy(); f.materials.forEach(m => m.destroy()); }); fighters.clear(); selectedTarget = undefined; effects.clear(); }
      else [...next.allies, ...next.foes].forEach(u => { fighters.get(u.id)!.hp = u.hp; });
      player.enabled = !next;
      if (!entering && !nextEffect) return Promise.resolve();
      return new Promise(resolve => { complete = resolve; });
    },
    update(dt: number, animate = true) {
      // Real time drives the camera; the fight itself stands still while a hit-stop holds.
      const elapsed = dt; real += dt; animating = animate; dt = clock.advance(dt);
      time += dt; effectTime += dt;
      entryTime = animate ? Math.min(ENTRY_SECONDS, entryTime + dt) : ENTRY_SECONDS;
      cameraKick.set(0, 0, 0); focus.set(0, 0, 0);
      dogs.forEach((model, i) => {
        dogTails[i].setLocalEulerAngles(38, animate ? Math.sin(time * 7 + i) * 20 : 0, 0);
        if (model.enabled) plantDogs[i](groundHeight);
      });
      const actor = effect ? fighters.get(effect.actor) : undefined;
      const target = effect?.target ? fighters.get(effect.target) : undefined;
      // Heals and boosts stay put: no run-up to anyone. Papagato's wearer stays put too: Haru goes.
      const support = effect?.skill === 'cardioide' || effect?.skill === 'analisis' || effect?.skill === 'escondite';
      const catStrike = effect?.skill === 'zarpazo';
      const contact = effect?.target && !support ? CONTACT_SECONDS : .2;
      if (effect && !impacted && (!animate || effectTime >= contact)) {
        impacted = true; impact?.();
        const landed = animate && effect ? contactBurst(effect, actor, target) : undefined;
        // Hit-stop: rewind to the contact pose and hold it (FightClock.stop).
        if (landed) effectTime -= clock.stop(landed.stop, effectTime - contact);
      }
      const t = animate ? effectTime : ACTION_SECONDS;
      const motion = actor && target && !support && !catStrike ? contactMotion(actor.base, target.base, t) : undefined;
      const entryMove = smooth((entryTime - .22) / .85);
      const selected = selectedTarget ? fighters.get(selectedTarget) : undefined;
      marker.enabled = !!selected && selected.hp > 0 && !effect && entryTime >= ENTRY_SECONDS;
      if (selected) marker.setPosition(selected.base.x, groundHeight(selected.base.x, selected.base.z) + .025, selected.base.z);
      for (const [id, f] of fighters) {
        const opponents = [...fighters.values()].filter(other => other.party !== f.party && other.hp > 0);
        const opponent = opponents[0];
        // At rest everyone squares up to the middle of the other side; the active ally turns toward whatever is being picked.
        const center = opponents.length ? opponents.reduce((sum, o) => sum.add(o.base), new pc.Vec3()).mulScalar(1 / opponents.length) : undefined;
        const aiming = !effect && f.party && !!selected && selected !== f && selected.hp > 0 && state?.phase === 'player' && state.allies[state.active]?.id === id;
        const lookAt = id === effect?.actor && target ? target.base : id === effect?.target && actor ? actor.base : aiming ? selected!.base : center;
        const yaw = lookAt ? face(f.base, lookAt) : (f.party ? 80 : -85);
        const noticedYaw = opponent ? face(f.start, opponent.start) : f.yaw;
        const noticeDelta = ((noticedYaw - f.yaw + 540) % 360) - 180;
        const firstLook = f.yaw + noticeDelta * smooth(entryTime / .22);
        const formationTurn = ((yaw - firstLook + 540) % 360) - 180;
        const facing = firstLook + formationTurn * smooth((entryTime - .25) / .7);
        const turnLeft = ((facing - f.turn + 540) % 360) - 180;
        const settled = animate && entryTime >= ENTRY_SECONDS;
        f.turn = settled ? f.turn + turnLeft * (1 - Math.exp(-dt * 9)) : facing;
        // Big pivots get a quick shuffle of the feet instead of spinning on the spot.
        const pivoting = settled && Math.abs(turnLeft) > 8;
        const notice = animate && entryTime < .42 ? Math.sin(entryTime / .42 * Math.PI) : 0;
        const position = new pc.Vec3().lerp(f.start, f.base, entryMove);
        if (f.party) position.z += Math.sin(entryMove * Math.PI) * 1.8;
        let lean = -notice * 6, roll = 0, strike = 0;
        const movingIn = animate && entryMove > 0 && entryMove < 1;
        const attacking = !!motion && id === effect?.actor;
        const stepping = attacking ? (t > .12 && t < CONTACT_SECONDS) || (t > .62 && t < 1.06) : movingIn || pivoting;
        const gait = f.walk.update(dt, stepping, animate, attacking ? .3 : .38);
        const stride = gait.stride;
        let hop = 0;
        if (motion && id === effect?.actor) {
          position.set(motion.x, f.base.y, motion.z);
          strike = smooth((t - .28) / .18) * (1 - smooth((t - .57) / .2));
          lean = strike * 13;
          hop = f.party || !animate ? 0 : Math.sin(clamp01((t - .16) / .46) * Math.PI) * .3;
        }
        if (support && id === effect?.actor) strike = animate ? Math.sin(clamp01(t / .8) * Math.PI) * .65 : 0;
        const guarding = state?.allies.find(a => a.id === id)?.guarding ?? false;
        if (motion && id === effect?.target && animate) {
          const recoil = motion.recoil * (guarding ? .12 : .34);
          position.x += motion.ux * recoil; position.z += motion.uz * recoil;
          lean = -motion.recoil * (guarding ? 5 : 18);
          roll = Math.sin(t * 52) * motion.recoil * 3;
        }
        const idle = idlePose(time, f.seed);
        const celebrating = animate && f.party && f.hp > 0 && state?.phase === 'won' && !effect;
        if (celebrating) hop = Math.abs(Math.sin(time * 5.5 + f.seed)) * .3;
        // Knocked-out fighters tip onto their side, then leave in a puff.
        const defeated = f.hp <= 0 && (id !== effect?.target || impacted);
        if (defeated) f.downAt ??= time;
        const down = f.downAt === undefined ? -1 : time - f.downAt;
        const fall = down >= 0 && animate ? smooth(down / .3) : 0;
        if (fall) {
          roll += fall * (f.party ? 78 : -84);
          hop += Math.sin(clamp01(down / .3) * Math.PI) * .28;
          if (!f.poofed && down > .62) { f.poofed = true; effects.poof(new pc.Vec3(position.x, groundHeight(position.x, position.z) + .35, position.z)); }
        }
        const shrink = down < 0 ? 1 : 1 - smooth((down - (animate ? .62 : .18)) / (animate ? .22 : .4));
        f.arms.forEach((arm, i) => arm.setLocalEulerAngles(celebrating ? -165 + Math.sin(time * 11 + i * Math.PI) * 12 : guarding ? -60 : -notice * 25 - strike * (i === 0 ? 85 : 35) - stride * (i === 0 ? 1 : -1), 0, guarding ? (i === 0 ? -20 : 20) : 0));
        f.legs.forEach((leg, i) => leg.setLocalEulerAngles(stride * (i % 2 ? -1 : 1), 0, 0));
        f.tail?.setLocalEulerAngles(38 + strike * 20, animate ? Math.sin(time * (attacking ? 16 : 7) + f.seed) * 22 : 0, 0);
        if (f.minion && f.head) f.head.setLocalEulerAngles(animate ? Math.sin(time * 2.2 + f.seed) * 6 - strike * 20 : 0, animate ? idle.look * 10 : 0, animate ? Math.sin(time * 1.7) * 5 : 0);
        else if (!f.party && f.head) animateDogHead(f.head, f.ears, f.eyes, f.seed, stepping, animate, strike);
        else {
          f.head?.setLocalEulerAngles(animate ? -idle.breathe * 2 : 0, animate && id !== effect?.actor ? idle.look * 12 : 0, 0);
          f.eyes.forEach(eye => { const s = eye.getLocalScale(); eye.setLocalScale(s.x, f.eyeScale * (animate ? idle.blink : 1), s.z); });
        }
        f.body?.setLocalPosition(0, 0, 0);
        // The camera supplies the battle zoom; keep fighters proportional to the street.
        const since = f.hitAt === undefined ? Infinity : time - f.hitAt;
        const squash = animate && since < 1 ? Math.exp(-since * 7) * Math.cos(since * 30) : 0;
        const breathe = animate && down < 0 ? idle.breathe * .018 + (f.minion ? Math.sin(time * 3.1 + f.seed) * .04 : 0) : 0;
        const size = Math.max(.001, shrink);
        f.model.setLocalScale(f.scale.x * size * (1 + squash * .09), f.scale.y * size * (1 - squash * .16 + breathe), f.scale.z * size * (1 + squash * .09));
        f.model.setLocalEulerAngles(lean, f.turn, roll);
        if (fall) f.model.setPosition(position.x, groundHeight(position.x, position.z) + hop + fall * .22, position.z);
        else { f.model.setPosition(position); f.plantFeet(groundHeight, hop); }
        f.model.enabled = shrink > .01;
        if (f.flash > 0) {
          f.flash = Math.max(0, f.flash - dt * 4.5);
          const k = f.flash * f.flash;
          f.materials.forEach((m, i) => {
            const rest = f.glow[i];
            m.emissiveIntensity = 1;
            m.emissive.set(rest.r + f.flashColor.r * k, rest.g + f.flashColor.g * k, rest.b + f.flashColor.b * k);
            m.update();
          });
        }
      }
      updateCats(t, animate, actor, target);
      // El Vértigo's spiral eye: slow at rest, fast while it is about to make everyone look down.
      const vertigo = fighters.get('vertigo');
      if (vertigo && fears && animate) fears.spin(vertigo.model, dt, !!state?.vertigo?.eye);
      // No-ta: the stamp falls on the target, slams, and lifts; the NO stays printed on the ground a moment.
      const stamping = effect?.skill === 'nota' && !!target;
      stamp.enabled = stamping && animate && t < ACTION_SECONDS;
      if (stamping && target && stamp.enabled) {
        const fall = smooth(t / CONTACT_SECONDS), lift = smooth((t - CONTACT_SECONDS - .25) / .4);
        const y = (target.minion ? 1.9 : 1.3) + (1 - fall) * 2.2 + lift * 3;
        // Squashed from the contact frame on, so a hit-stop holds the slam itself.
        const squash = t >= CONTACT_SECONDS && t < CONTACT_SECONDS + .2 ? .8 : 1;
        stamp.setPosition(target.base.x, y, target.base.z); stamp.setLocalScale(1.2, 1.2 * squash, 1.2);
        if (t >= CONTACT_SECONDS && inkAt < time - 2) {
          inkAt = time; shake = .6;
          inkMark.setPosition(target.base.x, groundHeight(target.base.x, target.base.z) + .04, target.base.z);
          effects.stamp(target.base);
        }
      }
      // Zarpazo de Haru: the cat pounces, the wearer's fist leaves no arc.
      if (animate && effect && actor && !catStrike) trailsFor(effect, actor, target, t, support);
      const inkAge = time - inkAt;
      inkMark.enabled = inkAge < 1.8;
      if (inkMark.enabled) { ink.opacity = 1 - smooth((inkAge - 1) / .8); ink.update(); }
      // The lurch springs back and shakes keep going through a hit-stop: they run on real time.
      shake = Math.max(0, shake - elapsed);
      sway.forEach(s => spring(s, elapsed, HIT.spring.omega, HIT.spring.zeta));
      spring(zoom, elapsed, HIT.punch.omega, 1);
      const quake = animate ? shake * shake * .3 : 0;
      if (animate) cameraKick.set(sway[0].x + wobble(real, 0) * quake, sway[1].x + wobble(real, 5) * quake * .6, sway[2].x);
      // The fight is won: confetti in the party's ánima colours rains over the field.
      if (state?.phase === 'won' && !effect && !celebrated && animate) {
        celebrated = true;
        const colours = new Set(['#f3cf78', '#fff4ec', ...state.allies.map(a => a.classId ? CLASSES[a.classId].colour : '#6f8fa8')]);
        effects.confetti(new pc.Vec3(anchor.x - 1, groundHeight(anchor.x, anchor.z) + 3.2, anchor.z), [...colours]);
      }
      if (motion && target) {
        const emphasis = animate ? Math.sin(clamp01(t / ACTION_SECONDS) * Math.PI) * .12 : 0;
        focus.set((target.base.x - anchor.x) * emphasis, 0, (target.base.z - anchor.z) * emphasis);
      }
      if (complete && (effect ? t >= (support ? .85 : target ? ACTION_SECONDS : .65) : entryTime >= ENTRY_SECONDS)) {
        settle(); effect = undefined; impact = undefined;
      }
    },
    destroy() { settle(); stampTexture.destroy(); inkTexture.destroy(); battleRoot.destroy(); dogs.forEach(model => model.destroy()); materials.forEach(m => m.destroy()); },
  };
}
