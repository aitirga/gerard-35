import * as pc from 'playcanvas';
import type { BattleEffect, BattleState } from './battle';
import { ACTION_SECONDS, CONTACT_SECONDS, ENTRY_SECONDS, clamp01, contactMotion, smooth } from './battle-motion';
import { WalkAnimation, idlePose } from './walk-animation';
import { createGroundContact, type GroundHeight } from './ground-contact';
import { DOG_PROFILES } from './encounters';
import type { Effects } from './effects';

/** Replace these stand-ins with imported models without changing combat or UI. */
export function createBattleScene(app: pc.Application, player: pc.Entity, groundHeight: GroundHeight, effects: Effects) {
  const materials: pc.StandardMaterial[] = [];
  function mat(hex: string) {
    const m = new pc.StandardMaterial(); m.diffuse.fromString(hex); m.update(); materials.push(m); return m;
  }
  const allyJacket = mat('#6f8fa8');
  const fur = mat('#c49464'), cream = mat('#f1dfb8'), dark = mat('#3c302a'), collar = mat('#a64d43');
  function part(parent: pc.Entity, name: string, type: string, material: pc.StandardMaterial, p: number[], s: number[]) {
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
    part(head, 'Ojo', 'sphere', dark, [side * .12, .18, .258], [.055, .055, .03]);
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
    eyes.forEach(eye => { const s = eye.getLocalScale(); eye.setLocalScale(s.x, .055 * (animate ? idle.blink : 1), s.z); });
  }
  const plantDogs = dogs.map((model, i) => createGroundContact(model, dogLegs[i]));
  const dogWalks = dogs.map(() => new WalkAnimation());
  const battleRoot = new pc.Entity('Escenario de combate'); app.root.addChild(battleRoot);
  interface Fighter {
    model: pc.Entity; base: pc.Vec3; start: pc.Vec3; hp: number; party: boolean;
    downAt?: number; poofed?: boolean; hitAt?: number; flashColor: pc.Color; flash: number; materials: pc.StandardMaterial[];
    body: pc.Entity | null; head: pc.Entity | null; tail: pc.Entity | null; ears: pc.Entity[]; eyes: pc.Entity[]; eyeScale: number; seed: number;
    arms: pc.Entity[]; legs: pc.Entity[]; yaw: number; turn: number; scale: pc.Vec3;
    walk: WalkAnimation;
    plantFeet: ReturnType<typeof createGroundContact>;
  }
  const fighters = new Map<string, Fighter>();
  let state: BattleState | undefined;
  let effect: BattleEffect | undefined;
  let effectTime = 0;
  let entryTime = ENTRY_SECONDS;
  let time = 0;
  let impact: (() => void) | undefined;
  let complete: (() => void) | undefined;
  let impacted = false;
  const anchor = new pc.Vec3();
  const cameraKick = new pc.Vec3();
  const focus = new pc.Vec3();
  const targetMaterial = mat('#f3cf78');
  targetMaterial.emissive.fromString('#f3cf78'); targetMaterial.emissiveIntensity = .3; targetMaterial.update();
  const marker = part(battleRoot, 'Objetivo', 'cylinder', targetMaterial, [0, .03, 0], [1.1, .025, 1.1]);
  marker.enabled = false;
  let selectedTarget: string | undefined;
  const sparkMaterial = mat('#ffe2a0');
  sparkMaterial.emissive.fromString('#ffe2a0'); sparkMaterial.emissiveIntensity = 1.2; sparkMaterial.update();
  const sparks = new pc.Entity('Destello de contacto'); battleRoot.addChild(sparks); sparks.enabled = false;
  for (let i = 0; i < 7; i++) {
    const ray = part(sparks, 'Impact', 'box', sparkMaterial, [0, 0, 0], [.035, .035, .3]);
    ray.setLocalEulerAngles(0, i * 360 / 7, 25 + i * 13);
  }
  const face = (from: pc.Vec3, to: pc.Vec3) => Math.atan2(to.x - from.x, to.z - from.z) * 180 / Math.PI;
  const white = new pc.Color(1, .96, .86), green = new pc.Color(.62, 1, .5), gold = new pc.Color(1, .82, .4);
  function hit(f: Fighter, color: pc.Color, strength = 1) { f.hitAt = time; f.flash = strength; f.flashColor = color; }
  // Each fighter owns its material copies, so a flash never lights up the whole pack.
  function ownMaterials(model: pc.Entity) {
    const copies = new Map<pc.Material, pc.StandardMaterial>();
    model.findComponents('render').forEach(component => (component as pc.RenderComponent).meshInstances.forEach(mesh => {
      let copy = copies.get(mesh.material);
      if (!copy) { copy = (mesh.material as pc.StandardMaterial).clone(); copies.set(mesh.material, copy); }
      mesh.material = copy;
    }));
    return [...copies.values()];
  }
  function settle() { const done = complete; complete = undefined; done?.(); }
  /** One-shot contact feedback: sparks where the blow lands, dust at the feet, a flash on whoever is affected. */
  function contactBurst(action: BattleEffect, actor?: Fighter, target?: Fighter) {
    if (!actor || action.kind === 'escape') return;
    if (!target) { hit(actor, gold, .55); effects.emit('spark', new pc.Vec3(actor.base.x, 1.1, actor.base.z), 6, .3); return; }
    if (action.skill === 'encourage') { hit(target, green, .85); effects.emit('heal', new pc.Vec3(target.base.x, .35, target.base.z), 16, .5); return; }
    const guarded = state?.allies.find(a => a.id === action.target)?.guarding ?? false;
    const dx = target.base.x - actor.base.x, dz = target.base.z - actor.base.z, d = Math.hypot(dx, dz) || 1;
    const reach = target.party ? .25 : .6;
    effects.emit('spark', new pc.Vec3(target.base.x - dx / d * reach, 1, target.base.z - dz / d * reach), guarded ? 4 : action.skill ? 16 : 10, .15);
    effects.emit('dust', new pc.Vec3(target.base.x, .12, target.base.z), guarded ? 3 : 7, .35);
    hit(target, white, guarded ? .4 : 1);
  }
  return {
    dogs, anchor, cameraKick, focus,
    selectTarget(id?: string) { selectedTarget = id; },
    targets() {
      return [...fighters].map(([id, f]) => ({
        id, position: f.model.getPosition().clone().add(new pc.Vec3(0, 1.45, 0)), visible: f.hp > 0 && entryTime >= ENTRY_SECONDS,
      }));
    },
    wander(i: number, dt: number, moving: boolean, animate: boolean) {
      const gait = dogWalks[i].update(dt, moving, animate, .32);
      dogLegs[i].forEach((leg, index) => leg.setLocalEulerAngles(gait.stride * (index === 0 || index === 3 ? 1 : -1), 0, 0));
      animateDogHead(dogHeads[i], dogEars[i], dogEyes[i], i, moving, animate);
    },
    get entering() { return !!state && entryTime < ENTRY_SECONDS; },
    get entryProgress() { return smooth(entryTime / ENTRY_SECONDS); },
    set(next: BattleState | undefined, center: pc.Vec3, nextEffect?: BattleEffect, onImpact?: () => void): Promise<void> {
      settle();
      const entering = !!next && !state;
      if (entering) {
        anchor.copy(center); entryTime = 0;
        for (const [party, units] of [[true, next.allies], [false, next.foes]] as const) units.forEach((unit, i) => {
          const source = party ? player : dogs[i];
          const model = source.clone(); model.enabled = true;
          if (unit.id === 'bernat') model.findComponents('render').forEach(component => {
            (component as pc.RenderComponent).meshInstances.forEach(mesh => {
              if (mesh.material.name === 'Camiseta mostaza') mesh.material = allyJacket;
            });
          });
          const base = new pc.Vec3(anchor.x + (party ? -2.2 : 1.2), .15, anchor.z + (i - (units.length - 1) / 2) * 1.9 + (party ? .6 : -.6));
          const start = source.getPosition().clone(); if (party) start.z += i * 1.4;
          battleRoot.addChild(model); model.setPosition(start);
          const body = party ? model.findByName('Cuerpo') as pc.Entity : null;
          const arms = (body?.children.filter(c => c.name === 'Brazo') ?? []) as pc.Entity[];
          const legs = (body?.children.filter(c => c.name === 'Pierna') ?? model.children.filter(c => c.name === 'Pata')) as pc.Entity[];
          const yaw = party ? player.findByName('Cuerpo')!.getLocalEulerAngles().y : source.getEulerAngles().y;
          if (body) body.setLocalEulerAngles(0, 0, 0);
          model.setLocalEulerAngles(0, yaw, 0);
          const feet = party ? legs.map(leg => leg.findByName('Zapatilla') as pc.Entity) : legs;
          const head = model.findByName(party ? 'Cabeza infantil' : 'Cabeza de perro') as pc.Entity | null;
          const eyes = model.find(node => node.name === 'Ojo') as pc.Entity[];
          fighters.set(unit.id, {
            model, base, start, hp: unit.hp, party, body, head, arms, legs, yaw, turn: yaw, eyes, tail: model.findByName('Cola') as pc.Entity | null,
            ears: model.find(node => node.name === 'Oreja') as pc.Entity[], eyeScale: eyes[0]?.getLocalScale().y ?? 1, seed: party ? i * 3.1 + .4 : i,
            flash: 0, flashColor: white, materials: ownMaterials(model),
            scale: source.getLocalScale().clone(), walk: new WalkAnimation(), plantFeet: createGroundContact(model, feet),
          });
        });
      }
      state = next; effect = nextEffect; effectTime = 0; impact = onImpact; impacted = false;
      if (!next) { fighters.forEach(f => { f.model.destroy(); f.materials.forEach(m => m.destroy()); }); fighters.clear(); sparks.enabled = false; selectedTarget = undefined; effects.clear(); }
      else [...next.allies, ...next.foes].forEach(u => { fighters.get(u.id)!.hp = u.hp; });
      player.enabled = !next;
      if (!entering && !nextEffect) return Promise.resolve();
      return new Promise(resolve => { complete = resolve; });
    },
    update(dt: number, animate = true) {
      time += dt; effectTime += dt;
      entryTime = animate ? Math.min(ENTRY_SECONDS, entryTime + dt) : ENTRY_SECONDS;
      cameraKick.set(0, 0, 0); focus.set(0, 0, 0);
      dogs.forEach((model, i) => {
        dogTails[i].setLocalEulerAngles(38, animate ? Math.sin(time * 7 + i) * 20 : 0, 0);
        if (model.enabled) plantDogs[i](groundHeight);
      });
      const actor = effect ? fighters.get(effect.actor) : undefined;
      const target = effect?.target ? fighters.get(effect.target) : undefined;
      const healing = effect?.skill === 'encourage';
      const t = animate ? effectTime : ACTION_SECONDS;
      const motion = actor && target && !healing ? contactMotion(actor.base, target.base, t) : undefined;
      const contact = effect?.target && !healing ? CONTACT_SECONDS : .2;
      if (effect && !impacted && (!animate || effectTime >= contact)) {
        impacted = true; impact?.();
        if (animate && effect) contactBurst(effect, actor, target);
      }
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
        if (healing && id === effect?.actor) strike = animate ? Math.sin(clamp01(t / .8) * Math.PI) * .65 : 0;
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
          if (!f.poofed && down > .62) { f.poofed = true; effects.emit('poof', new pc.Vec3(position.x, .35, position.z), 12, .35); }
        }
        const shrink = down < 0 ? 1 : 1 - smooth((down - (animate ? .62 : .18)) / (animate ? .22 : .4));
        f.arms.forEach((arm, i) => arm.setLocalEulerAngles(celebrating ? -165 + Math.sin(time * 11 + i * Math.PI) * 12 : guarding ? -60 : -notice * 25 - strike * (i === 0 ? 85 : 35) - stride * (i === 0 ? 1 : -1), 0, guarding ? (i === 0 ? -20 : 20) : 0));
        f.legs.forEach((leg, i) => leg.setLocalEulerAngles(stride * (i % 2 ? -1 : 1), 0, 0));
        f.tail?.setLocalEulerAngles(38 + strike * 20, animate ? Math.sin(time * (attacking ? 16 : 7) + f.seed) * 22 : 0, 0);
        if (!f.party && f.head) animateDogHead(f.head, f.ears, f.eyes, f.seed, stepping, animate, strike);
        else {
          f.head?.setLocalEulerAngles(animate ? -idle.breathe * 2 : 0, animate && id !== effect?.actor ? idle.look * 12 : 0, 0);
          f.eyes.forEach(eye => { const s = eye.getLocalScale(); eye.setLocalScale(s.x, f.eyeScale * (animate ? idle.blink : 1), s.z); });
        }
        f.body?.setLocalPosition(0, 0, 0);
        // The camera supplies the battle zoom; keep fighters proportional to the street.
        const since = f.hitAt === undefined ? Infinity : time - f.hitAt;
        const squash = animate && since < 1 ? Math.exp(-since * 7) * Math.cos(since * 30) : 0;
        const breathe = animate && down < 0 ? idle.breathe * .018 : 0;
        const size = Math.max(.001, shrink);
        f.model.setLocalScale(f.scale.x * size * (1 + squash * .09), f.scale.y * size * (1 - squash * .16 + breathe), f.scale.z * size * (1 + squash * .09));
        f.model.setLocalEulerAngles(lean, f.turn, roll);
        if (fall) f.model.setPosition(position.x, groundHeight(position.x, position.z) + hop + fall * .22, position.z);
        else { f.model.setPosition(position); f.plantFeet(groundHeight, hop); }
        f.model.enabled = shrink > .01;
        if (f.flash > 0) {
          f.flash = Math.max(0, f.flash - dt * 4.5);
          const k = f.flash * f.flash;
          for (const m of f.materials) { m.emissive.set(f.flashColor.r * k, f.flashColor.g * k, f.flashColor.b * k); m.update(); }
        }
      }
      sparks.enabled = !!motion && animate && t >= CONTACT_SECONDS && t < CONTACT_SECONDS + .22;
      if (healing && target && animate && t >= .2 && t < .8) {
        sparks.enabled = true;
        const burst = (t - .2) / .6;
        sparks.setPosition(target.base.x, 1 + burst * .8, target.base.z);
        sparks.setLocalScale(.8, .8, .8);
        sparks.children.forEach((ray, i) => {
          const a = i * Math.PI * 2 / 7;
          ray.setLocalPosition(Math.cos(a) * .6, Math.sin(a) * .4, 0);
        });
      }
      if (motion && target) {
        const burst = clamp01((t - CONTACT_SECONDS) / .22);
        sparks.setPosition(target.base.x - motion.ux * (target.party ? .4 : 1.05), 1.05, target.base.z - motion.uz * (target.party ? .4 : 1.05));
        sparks.setLocalScale(1 + burst * 1.6, 1 + burst * 1.6, 1 + burst * 1.6);
        sparks.children.forEach((ray, i) => {
          const a = i * Math.PI * 2 / 7;
          ray.setLocalPosition(Math.cos(a) * burst * .35, Math.sin(a) * burst * .35, 0);
        });
        const kick = animate ? Math.sin(burst * Math.PI * 2) * (1 - burst) * .045 : 0;
        cameraKick.set(kick, kick * .45, 0);
        const emphasis = animate ? Math.sin(clamp01(t / ACTION_SECONDS) * Math.PI) * .12 : 0;
        focus.set((target.base.x - anchor.x) * emphasis, 0, (target.base.z - anchor.z) * emphasis);
      }
      if (complete && (effect ? t >= (healing ? .85 : target ? ACTION_SECONDS : .65) : entryTime >= ENTRY_SECONDS)) {
        settle(); effect = undefined; impact = undefined;
      }
    },
    destroy() { settle(); battleRoot.destroy(); dogs.forEach(model => model.destroy()); materials.forEach(m => m.destroy()); },
  };
}
