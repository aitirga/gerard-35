import * as pc from 'playcanvas';
import { createPropKit } from './props';

/**
 * The TV news, filmed (docs/chapter-2.md): Via de Bàrcino in front of the Rec Comtal school on the
 * morning the castle appeared. A police cordon, patrol cars with their lights going, neighbours
 * filming with their phones, a reporter and her cameraman, a TV van with its dish, a helicopter
 * circling, the pupils' backpacks by the gate. `shot(i, t)` says where the broadcast's camera is in
 * each shot. Everything stands in the scene's cells (src/geo/rec-comtal.json), so it moves with it.
 */
export interface NewsStage {
  toWorld(x: number, z: number): pc.Vec3;
  groundHeight(x: number, z: number): number;
}
/** What the camera does in a shot: where it is, what it looks at, its lens and how much it shakes. */
export interface NewsCamera { position: pc.Vec3; target: pc.Vec3; fov: number; shake: number }
/** The broadcast's shots, in the order they loop, with how long each holds (seconds). */
export const NEWS_SHOTS = [
  { id: 'aerial', seconds: 5.5 },
  { id: 'reporter', seconds: 6.5 },
  { id: 'phone', seconds: 4.5 },
  { id: 'street', seconds: 5 },
] as const;
export type NewsShotId = typeof NEWS_SHOTS[number]['id'];

/** Where things stand, in cells of the rec-comtal scene. The school door is at (86, 62). */
const SET = {
  reporter: { x: 82, z: 70.5 },
  cameraman: { x: 82, z: 75.5 },
  van: { x: 106, z: 71 },
  cordon: { z: 64.6, x0: 66, x1: 106 },
  patrols: [{ x: 70, z: 68 }, { x: 99, z: 68.5 }],
  phone: { x: 72, z: 71.5 },
};
const SKIN = ['#e9bf9c', '#c98f6a', '#f2d2b6', '#8d5a3c', '#d9a77f'];
const CLOTHES = ['#3f6b8a', '#b9483f', '#e0b04a', '#4c7a4f', '#7a5a9a', '#2f3b46', '#d96f9a', '#e8e1d4', '#5a8fb0'];
const HAIR = ['#2b1d14', '#5a3b22', '#a8743a', '#1c1c1c', '#c9c2b6'];

export function createNewsSet(app: pc.Application, stage: NewsStage, castle: pc.Vec3) {
  const root = new pc.Entity('Plató de las noticias'); app.root.addChild(root);
  const props = createPropKit();
  const materials: pc.StandardMaterial[] = [];
  const cache = new Map<string, pc.StandardMaterial>();
  function mat(hex: string, gloss = .3, glow = 0) {
    const key = `${hex}|${gloss}|${glow}`;
    let m = cache.get(key);
    if (m) return m;
    m = new pc.StandardMaterial(); m.diffuse.fromString(hex); m.gloss = gloss;
    if (glow) { m.emissive.fromString(hex); m.emissiveIntensity = glow; }
    m.update(); materials.push(m); cache.set(key, m); return m;
  }
  function part(parent: pc.Entity, type: pc.RenderComponent['type'], m: pc.Material, p: number[], s: number[], r: number[] = [0, 0, 0]) {
    const e = new pc.Entity(); e.addComponent('render', { type, material: m, castShadows: true, receiveShadows: true });
    e.setLocalPosition(p[0], p[1], p[2]); e.setLocalScale(s[0], s[1], s[2]); e.setLocalEulerAngles(r[0], r[1], r[2]);
    parent.addChild(e); return e;
  }
  /** An entity standing on cell (x, z), turned to `yaw` degrees (0 faces +z, towards the street). */
  function stand(name: string, x: number, z: number, yaw = 0) {
    const e = new pc.Entity(name); const at = stage.toWorld(x, z);
    e.setPosition(at.x, stage.groundHeight(at.x, at.z), at.z); e.setEulerAngles(0, yaw, 0); root.addChild(e); return e;
  }
  const facing = (x: number, z: number, to: pc.Vec3) => { const at = stage.toWorld(x, z); return Math.atan2(to.x - at.x, to.z - at.z) * 180 / Math.PI; };
  const arms: { arm: pc.Entity; phase: number }[] = [];
  /** A neighbour, cartoon-simple: legs, body, arms, head and hair; `phone` holds one up to film. */
  function person(x: number, z: number, yaw: number, seed: number, options: { phone?: boolean; scale?: number } = {}) {
    const p = stand('Vecino', x, z, yaw);
    const s = options.scale ?? (.92 + (seed % 5) * .04); p.setLocalScale(s, s, s);
    const clothes = mat(CLOTHES[seed % CLOTHES.length], .2), trousers = mat(['#2f3b46', '#4a3f35', '#3d5a80'][seed % 3], .2);
    const skin = mat(SKIN[seed % SKIN.length], .35), hair = mat(HAIR[(seed * 3) % HAIR.length], .3);
    for (const side of [-1, 1]) part(p, 'box', trousers, [side * .13, .42, 0], [.2, .84, .22]);
    part(p, 'box', clothes, [0, 1.15, 0], [.55, .7, .32]);
    part(p, 'sphere', skin, [0, 1.72, 0], [.42, .46, .42]);
    part(p, 'sphere', hair, [0, 1.84, -.04], [.44, .3, .44]);
    for (const side of [-1, 1]) {
      const pivot = new pc.Entity('Brazo'); pivot.setLocalPosition(side * .34, 1.45, 0); p.addChild(pivot);
      part(pivot, 'box', clothes, [0, -.3, 0], [.15, .6, .17]);
      if (options.phone && side > 0) {
        pivot.setLocalEulerAngles(-150, 0, 0);
        part(pivot, 'box', mat('#1a1a1f', .8), [0, -.66, .05], [.1, .18, .03]);
        part(pivot, 'box', mat('#bfe3ff', .5, 1.6), [0, -.66, .07], [.08, .15, .01]);
      } else arms.push({ arm: pivot, phase: seed * 1.3 });
    }
    return p;
  }

  // ——— The cordon: posts and red-and-white tape across the pavement in front of the school ———
  const tape = mat('#d8242f', .4), white = mat('#f4f1ea', .4), post = mat('#2f3337', .5);
  for (let x = SET.cordon.x0; x <= SET.cordon.x1; x += 4) {
    const p = stand('Poste del cordón', x, SET.cordon.z);
    part(p, 'cylinder', post, [0, .5, 0], [.1, 1, .1]);
    part(p, 'cylinder', post, [0, .02, 0], [.4, .04, .4]);
    if (x + 4 > SET.cordon.x1) continue;
    const span = stage.toWorld(x + 4, SET.cordon.z).distance(stage.toWorld(x, SET.cordon.z));
    for (let k = 0; k < 8; k++) part(p, 'box', k % 2 ? white : tape, [span * (k + .5) / 8, .92, 0], [span / 8, .12, .02]);
  }
  // ——— Police: two patrol cars with their light bars going, and an officer by the tape ———
  const blue = mat('#2f6bff', .5, 2.5), red = mat('#ff2f3f', .5, 2.5), blueOff = mat('#20306a', .5), redOff = mat('#6a2026', .5);
  const bars: { blue: pc.Entity; red: pc.Entity; phase: number }[] = [];
  SET.patrols.forEach((c, i) => {
    const car = stand('Coche patrulla', c.x, c.z, 0);
    props.place({ kind: 'car', x: 0, z: 0, color: '#f2f4f6', along: 'x' }, car, new pc.Vec3(0, 0, 0));
    part(car, 'box', mat('#1f4fa8', .4), [.5, .55, 0], [3.2, .16, 1.62]);
    const bar = new pc.Entity('Luces'); bar.setLocalPosition(.5, 1.38, 0); car.addChild(bar);
    bars.push({ blue: part(bar, 'box', blue, [-.25, 0, 0], [.4, .14, .5]), red: part(bar, 'box', red, [.25, 0, 0], [.4, .14, .5]), phase: i * .37 });
    part(bar, 'box', blueOff, [-.25, -.01, 0], [.41, .12, .51]); part(bar, 'box', redOff, [.25, -.01, 0], [.41, .12, .51]);
  });
  const officer = person(88, 65.6, 180, 5, { scale: 1.02 });
  part(officer, 'box', mat('#16233f', .3), [0, 1.15, 0], [.58, .72, .34]);
  part(officer, 'cylinder', mat('#16233f', .3), [0, 1.98, 0], [.46, .12, .46]);
  // ——— Neighbours along the road, all looking up at the castle; some filming ———
  let seed = 0;
  for (const [x, z] of [[67, 66.5], [69, 70], [71.5, 67], [74, 69.5], [76.5, 66.2], [78, 71], [88, 69], [90.5, 66.4], [92, 71.2], [94, 67.5], [96.5, 70], [101, 66.5], [103, 69.5], [64, 68], [73, 72.5], [94.5, 73]]) {
    person(x, z, facing(x, z, castle) + ((seed * 37) % 20 - 10), seed, { phone: seed % 3 === 0 });
    seed++;
  }
  // ——— The reporter facing the camera, and her cameraman ———
  const reporter = person(SET.reporter.x, SET.reporter.z, 0, 2, { scale: 1 });
  part(reporter, 'box', mat('#c23b55', .3), [0, 1.15, 0], [.58, .72, .34]);
  part(reporter, 'sphere', mat('#3a2418', .3), [0, 1.66, -.12], [.5, .62, .4]);
  const mic = new pc.Entity('Micrófono'); mic.setLocalPosition(.28, 1.42, .3); reporter.addChild(mic);
  part(mic, 'cylinder', mat('#1b1b1f', .7), [0, 0, 0], [.06, .3, .06], [-30, 0, 0]);
  part(mic, 'sphere', mat('#2f2f35', .5), [0, .16, .08], [.13, .13, .13]);
  part(mic, 'box', mat('#2f6bff', .4), [0, .06, .04], [.11, .08, .11], [-30, 0, 0]);
  const cameraman = person(SET.cameraman.x, SET.cameraman.z, 180, 7);
  const rig = new pc.Entity('Cámara de televisión'); rig.setLocalPosition(.05, 1.62, .45); cameraman.addChild(rig);
  part(rig, 'box', mat('#25272b', .6), [0, 0, 0], [.32, .34, .7]);
  part(rig, 'cylinder', mat('#111', .8), [0, 0, .45], [.22, .25, .22], [90, 0, 0]);
  part(rig, 'box', mat('#ff2f3f', .5, 2), [.12, .2, -.2], [.05, .05, .05]);
  // ——— The TV van with its dish up ———
  const van = stand('Furgoneta de la tele', SET.van.x, SET.van.z, -90);
  part(van, 'box', mat('#f3f1ec', .4), [0, 1.25, 0], [2.1, 2.1, 4.6]);
  part(van, 'box', mat('#1d3f7a', .4), [0, 1.1, 0], [2.12, .5, 4.62]);
  part(van, 'box', mat('#2b3b46', .8), [0, 1.75, 2.0], [1.9, .7, .65]);
  for (const [dx, dz] of [[-1, 1.5], [1, 1.5], [-1, -1.5], [1, -1.5]]) part(van, 'cylinder', mat('#1b1b1f', .3), [dx, .4, dz], [.8, .3, .8], [0, 0, 90]);
  part(van, 'cylinder', mat('#cfd3d6', .6), [0, 2.6, -.8], [.15, 1.2, .15]);
  part(van, 'sphere', mat('#e8ebee', .6), [0, 3.4, -.8], [1.6, .4, 1.6], [-40, 0, 0]);
  // ——— The pupils' backpacks dropped by the gate ———
  for (const [x, z, c] of [[84, 63.2, '#e95a4f'], [85.5, 63.6, '#4f8fd0'], [88, 63.1, '#f2c230'], [90, 63.5, '#6fbf5a']] as [number, number, string][]) {
    const b = stand('Mochila', x, z, x * 37 % 90);
    part(b, 'box', mat(c, .3), [0, .2, 0], [.45, .4, .25], [70, 0, 0]);
  }
  // ——— The helicopter circling the castle ———
  const heli = new pc.Entity('Helicóptero'); root.addChild(heli);
  part(heli, 'sphere', mat('#1d3f7a', .5), [0, 0, 0], [1.6, 1.3, 2.6]);
  part(heli, 'box', mat('#1d3f7a', .5), [0, .15, -2.4], [.3, .3, 2.6]);
  part(heli, 'box', mat('#f3f1ec', .5), [0, .6, -3.6], [.08, 1, .6]);
  part(heli, 'sphere', mat('#9fd0ff', .9), [0, .15, .85], [1.1, .8, 1.1]);
  const rotor = new pc.Entity('Rotor'); rotor.setLocalPosition(0, .85, 0); heli.addChild(rotor);
  part(rotor, 'box', mat('#222', .3), [0, 0, 0], [6, .05, .25]); part(rotor, 'box', mat('#222', .3), [0, 0, 0], [.25, .05, 6]);
  for (const side of [-1, 1]) part(heli, 'box', mat('#333', .3), [side * .6, -.8, 0], [.08, .08, 2.2]);

  const place = (x: number, z: number, y: number) => { const at = stage.toWorld(x, z); at.y = stage.groundHeight(at.x, at.z) + y; return at; };
  const lift = castle.clone().add(new pc.Vec3(0, 12, 0));
  let time = 0;
  return {
    root,
    /** Where the broadcast's camera is `t` seconds into shot `id`. */
    shot(id: NewsShotId, t: number): NewsCamera {
      if (id === 'aerial') {
        // From the helicopter: a slow orbit round the castle, high and wide.
        const a = .55 + t * .045, r = 62;
        return { position: new pc.Vec3(castle.x + Math.sin(a) * r, castle.y + 34 - t * .6, castle.z + Math.cos(a) * r), target: lift, fov: 40, shake: .12 };
      }
      if (id === 'reporter') {
        // The cameraman's shot: the reporter in front, the castle looming behind her; a slow push-in.
        const from = place(SET.cameraman.x + .4, SET.cameraman.z - .7 - t * .08, 1.45), at = place(SET.reporter.x, SET.reporter.z, 2.3);
        return { position: from, target: at, fov: 52, shake: .03 };
      }
      if (id === 'phone') {
        // A neighbour's phone: shaky, zooming in on the towers.
        return { position: place(SET.phone.x, SET.phone.z, 1.8), target: castle.clone().add(new pc.Vec3(0, 16, 0)), fov: 34 - t * 3, shake: .35 };
      }
      // Street level behind the patrol car, its lights in the corner of the frame.
      return { position: place(58 + t * .3, 79, 2.4), target: castle.clone().add(new pc.Vec3(0, 8, 0)), fov: 50, shake: .05 };
    },
    update(dt: number, animate: boolean) {
      time += animate ? dt : 0;
      for (const b of bars) { const on = Math.sin((time + b.phase) * 11) > 0; b.blue.enabled = on; b.red.enabled = !on; }
      for (const a of arms) a.arm.setLocalEulerAngles(Math.sin(time * 1.4 + a.phase) * 4, 0, 0);
      const h = time * .22;
      heli.setPosition(castle.x + Math.sin(h) * 46, castle.y + 30, castle.z + Math.cos(h) * 46);
      heli.setEulerAngles(4, h * 180 / Math.PI + 90, -8);
      rotor.setLocalEulerAngles(0, time * 1400, 0);
      props.update(dt, animate);
    },
    destroy() { root.destroy(); props.destroy(); materials.forEach(m => m.destroy()); },
  };
}
export type NewsSet = ReturnType<typeof createNewsSet>;
