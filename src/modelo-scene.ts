import * as pc from 'playcanvas';
import { GALLERY, SECTION, STAKES, ZONE_IDS, type ModeloState, type ZoneId } from './modelo';
import { PHOSPHOR } from './modelo-foes';

/**
 * How Emilie's model looks (docs/quests/emilie.md § In the section; src/modelo.ts has its rules): the
 * ground under Poble Sec cut in section and seen from the side, as her screen draws it. Four galleries
 * one under the other with a band of clay between each; the party stays where it is and the section
 * rises past them as they go down.
 *
 * What nobody has measured is a guess: black, with the model's mesh in phosphor green lines. Round
 * every stake Emilie's piezometer has been driven at, the ground is real: earth, gravel, the wet
 * concrete under the city, lit, with the borehole's steel tube running down through the clay.
 * Its one detail found nowhere else: the survey stakes, wood with a strip of orange flagging tape.
 * Nothing here is pink or violet (docs/visual-style.md § Reserved colours).
 */
const BLACK = '#040a06';
/** The real ground of each zone, once measured: its face and its floor. */
const REAL: Record<ZoneId, { face: string; floor: string; speck: string }> = {
  suelo: { face: '#6e4c31', floor: '#57402b', speck: '#8d6a47' },
  gravas: { face: '#8c8168', floor: '#726a57', speck: '#b9ad92' },
  ciudad: { face: '#4f5d66', floor: '#414c54', speck: '#7b8a93' },
  fondo: { face: '#2a3138', floor: '#22282e', speck: '#3b454d' },
};
/** How far apart the mesh's lines stand in each zone (m across, m up): finer the deeper it goes. */
const MESH: Record<ZoneId, [number, number]> = { suelo: [2, .8], gravas: [1.5, .64], ciudad: [1, .8], fondo: [3, 1.6] };
const rnd = (n: number) => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };

export function buildModelo(app: pc.Application, toWorld: (x: number, z: number) => pc.Vec3) {
  const root = new pc.Entity('El modelo de Emilie'); app.root.addChild(root);
  // Local space is the grid's own: x metres along the section, z cells from the back wall, y up.
  const origin = toWorld(0, 0), unit = toWorld(1, 0).x - origin.x;
  root.setPosition(origin); root.setLocalScale(unit, 1, unit);
  const materials: pc.StandardMaterial[] = [];
  const mat = (name: string, hex: string, { gloss = .2, glow = 0, unlit = false, opacity = 1 } = {}) => {
    const m = new pc.StandardMaterial(); m.name = name; m.diffuse.fromString(hex); m.gloss = gloss; m.useMetalness = false;
    if (glow) { m.emissive.fromString(hex); m.emissiveIntensity = glow; }
    if (unlit) { m.useLighting = false; m.diffuse.set(0, 0, 0); }
    if (opacity < 1) { m.opacity = opacity; m.blendType = pc.BLEND_ADDITIVE; m.depthWrite = false; }
    m.update(); materials.push(m); return m;
  };
  const part = (parent: pc.Entity, name: string, type: pc.RenderComponent['type'], m: pc.Material, p: number[], s: number[], shadows = false) => {
    const e = new pc.Entity(name); e.addComponent('render', { type, material: m, castShadows: shadows, receiveShadows: true });
    e.setLocalPosition(p[0], p[1], p[2]); e.setLocalScale(s[0], s[1], s[2]); parent.addChild(e); return e;
  };
  const dark = mat('Suposición', BLACK), clay = mat('Arcilla supuesta', '#0b1a10');
  const line = mat('Malla', PHOSPHOR, { glow: 1.1, unlit: true }), faint = mat('Malla tenue', '#1d7a40', { glow: .55, unlit: true });
  const wood = mat('Estaca', '#b08d5c'), tape = mat('Cinta de balizar', '#ff7a1a', { glow: .5 }), steel = mat('Tubo', '#aab4ba', { gloss: .7 });
  const water = mat('Nivel', '#6cc8f2', { glow: .9, unlit: true }), shell = mat('Dentro del sondeo', '#9fe9ff', { glow: .7, unlit: true, opacity: .32 });
  const L = SECTION.length, D = GALLERY.depth, H = GALLERY.height, DROP = GALLERY.drop, back = .5, front = back + D, mid = (L + 1) / 2;
  const floorOf = (zone: ZoneId) => -ZONE_IDS.indexOf(zone) * DROP;
  const real = Object.fromEntries(ZONE_IDS.map(z => [z, { face: mat(`${z} medido`, REAL[z].face, { glow: .32 }), floor: mat(`Piso de ${z}`, REAL[z].floor, { glow: .3 }), speck: mat(`Grano de ${z}`, REAL[z].speck, { glow: .3 }) }])) as Record<ZoneId, Record<'face' | 'floor' | 'speck', pc.StandardMaterial>>;

  // Nothing behind the section or beside it: the black of a screen, whichever way the camera looks.
  const none = mat('Nada', BLACK, { unlit: true });
  part(root, 'Nada detrás', 'box', none, [mid, 0, back - 6], [400, 300, .2]);
  // The screen's own light, from where it is looked at: the party and what is real are seen, the guess stays black.
  const lamp = new pc.Entity('Luz de la pantalla'); lamp.addComponent('light', { type: 'directional', color: new pc.Color(.82, 1, .88), intensity: .95, castShadows: false });
  lamp.setLocalEulerAngles(58, 180, 0); root.addChild(lamp);
  // The street over it all: a band of pavement, and the houses of Poble Sec as the model has them, in outline.
  part(root, 'Calle', 'box', clay, [mid, H + .35, back + D / 2], [L, .7, D]);
  part(root, 'Bordillo', 'box', line, [mid, H + .7, front], [L, .04, .04]);
  for (let k = 0, x = 1; x < L - 3; k++) {
    const w = 3 + Math.floor(rnd(k) * 4), h = 2.4 + rnd(k + 9) * 3.2;
    for (const [px, py, sx, sy] of [[x + w / 2, H + .7 + h, w, .05], [x, H + .7 + h / 2, .05, h], [x + w, H + .7 + h / 2, .05, h]]) part(root, 'Casa', 'box', faint, [px, py, back], [sx, sy, .04]);
    x += w + (rnd(k + 3) > .7 ? 1.5 : 0);
  }
  for (const zone of ZONE_IDS) {
    const y = floorOf(zone), [dx, dy] = MESH[zone], last = zone === 'fondo';
    // The gallery as a guess: black behind and underfoot, the mesh drawn over both.
    part(root, `Fondo de ${zone}`, 'box', dark, [mid, y + H / 2, back - .1], [L, H, .2]);
    part(root, `Piso de ${zone}`, 'box', dark, [mid, y - .15, back + D / 2], [L, .3, D]);
    for (let x = .5; x <= L + .5; x += dx) part(root, 'Malla', 'box', faint, [x, y + H / 2, back + .02], [.03, H, .02]);
    for (let h = dy; h < H; h += dy) part(root, 'Malla', 'box', faint, [mid, y + h, back + .02], [L, .03, .02]);
    for (let z = back; z <= front + .01; z += 1) part(root, 'Malla del piso', 'box', z >= front ? line : faint, [mid, y + .01, z], [L, .03, .03]);
    for (let x = .5; x <= L + .5; x += dx) part(root, 'Malla del piso', 'box', faint, [x, y + .01, back + D / 2], [.03, .03, D]);
    // Under the city the model has what it was told is there: a tunnel's ring and footings, in outline.
    if (zone === 'ciudad') for (const cx of [11, 24]) for (let a = 0; a < 16; a++) {
      const t = a / 16 * Math.PI * 2, e = part(root, 'Túnel', 'box', line, [cx + Math.cos(t) * 1.1, y + 1.5 + Math.sin(t) * 1.1, back + .04], [.45, .04, .02]);
      e.setLocalEulerAngles(0, 0, t * 180 / Math.PI + 90);
    }
    // The clay under it (under the last one, only more of the guess).
    part(root, `Arcilla bajo ${zone}`, 'box', clay, [mid, y - .3 - (DROP - H - .3) / 2, back + D / 2], [L, DROP - H - .3, D]);
    if (!last) for (let x = 1; x < L; x += .8) part(root, 'Rayado', 'box', faint, [x, y - .3 - (DROP - H - .3) / 2, front + .01], [.03, (DROP - H - .3) * .7, .02]).setLocalEulerAngles(0, 0, 32);
    for (const end of [.5, L + .5]) part(root, 'Borde', 'box', line, [end, y + H / 2, front], [.04, H, .04]);
  }
  // Each stake, and what measuring it makes real (shown once it is).
  const stakes = STAKES.map(stake => {
    const y = floorOf(stake.zone), m = real[stake.zone], wide = SECTION.safe * 2;
    const post = new pc.Entity(`Estaca ${stake.id}`); post.setLocalPosition(stake.x, y, back + .55); root.addChild(post);
    part(post, 'Palo', 'box', wood, [0, .45, 0], [.09, .9, .09], true);
    part(post, 'Cinta', 'box', tape, [.09, .78, 0], [.2, .12, .02]);
    const ground = new pc.Entity(`Medido ${stake.id}`); ground.setLocalPosition(stake.x, y, 0); ground.enabled = false; root.addChild(ground);
    part(ground, 'Cara', 'box', m.face, [0, H / 2, back + .03], [wide, H, .06]);
    part(ground, 'Piso', 'box', m.floor, [0, .02, back + D / 2], [wide, .06, D]);
    part(ground, 'Canto', 'box', m.face, [0, -.13, front + .01], [wide, .3, .03]);
    // Strata and grain, so it reads as ground and not as a colour.
    for (let k = 0; k < 4; k++) part(ground, 'Estrato', 'box', m.floor, [0, .5 + k * .7 + rnd(stake.x + k) * .2, back + .07], [wide, .05 + rnd(stake.x * 3 + k) * .08, .02]);
    for (let k = 0; k < 22; k++) {
      const s = .06 + rnd(stake.x + k * 7) * .12;
      part(ground, 'Grano', 'sphere', m.speck, [(rnd(stake.x * 5 + k) - .5) * (wide - .3), .15 + rnd(stake.x * 11 + k) * (H - .3), back + .07], [s, s * .7, .04]);
    }
    // The piezometer: its head over the stake, its tube down through the clay to the gallery below.
    const down = DROP - H;
    part(ground, 'Cabeza', 'cylinder', steel, [0, 1.05, back + .55], [.2, .3, .2], true);
    part(ground, 'Tubo', 'cylinder', steel, [0, .1, back + .55], [.1, 1.9, .1]);
    part(ground, 'Tubo en la arcilla', 'box', steel, [0, -.3 - (down - .3) / 2, front + .03], [.12, down - .3, .03]);
    part(ground, 'Nivel', 'box', water, [0, -.3 - (down - .3) * .62, front + .05], [.07, (down - .3) * .7, .02]);
    const inside = part(ground, 'Dentro', 'cylinder', shell, [0, H / 2, back + D / 2], [2.2, H, 2.6]); inside.enabled = false;
    return { stake, ground, inside, shown: false };
  });
  // The mesh breathes a little, as a screen left on does.
  let rise = 0, t = 0;
  return {
    root,
    clear: new pc.Color().fromString(BLACK),
    /** What a fight's pocket is made of in here (src/pocket.ts): the guess's black, lit as the screen lights it. */
    pocket: { floor: mat('Piso del combate', '#0d2216'), wall: mat('Muro del combate', '#07140c'), light: new pc.Color(.62, 1, .76) },
    /** Where the floor of `zone` is under the party's feet now, in world metres (0 once the section has finished rising). */
    lift(zone: ZoneId) { return rise + floorOf(zone); },
    /** The section follows the run: it rises to the party's zone, shows what has been measured and lights the borehole they are in. */
    update(dt: number, run: ModeloState, animate: boolean) {
      t += dt;
      const want = -floorOf(run.zone);
      rise = animate ? rise + (want - rise) * (1 - Math.exp(-dt * 3.2)) : want;
      if (Math.abs(want - rise) < .002) rise = want;
      root.setPosition(origin.x, origin.y + rise, origin.z);
      for (const s of stakes) {
        const placed = run.placed.includes(s.stake.id);
        if (placed !== s.shown) { s.ground.enabled = s.shown = placed; }
        s.inside.enabled = run.inside === s.stake.id;
      }
      const glow = animate ? .5 + Math.sin(t * 1.7) * .06 : .5;
      if (Math.abs(faint.emissiveIntensity - glow) > .01) { faint.emissiveIntensity = glow; faint.update(); }
    },
    /** Whether the section is still rising to the party's zone. */
    get moving() { return Math.abs(rise - Math.round(rise / DROP) * DROP) > .05; },
    destroy() { root.destroy(); materials.forEach(m => m.destroy()); },
  };
}
export type ModeloScene = ReturnType<typeof buildModelo>;
