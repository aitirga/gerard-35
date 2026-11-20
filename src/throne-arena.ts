import * as pc from 'playcanvas';
import { formation, pocketWorld, standing, type Cast, type PocketCell } from './arena';
import { MeshBuilder } from './geo-scenery';
import type { GeoTexture } from './geo';
import { gpuTexture, greyOf, loadTextures, textureUrl, tintColour, type LoadedTexture } from './materials';
import { BACKDROP } from './particles';
import { POCKET_AT } from './pocket';

/**
 * La Reina Bubbaloo's own stage (docs/places/palace-zones.md § El salón del trono, docs/castle-bosses.md
 * § La Reina Bubbaloo): the last fight does not stay among the throne room's chairs. As she comes down
 * from her throne the picture breaks into glass (as into a pocket, src/pocket.ts) and the fight goes on
 * up on the stage of the school's sala d'actes, built for it: the varnished boards with their gold
 * edge and footlights, the empty chairs below in the dark, the indigo velvet in pleats, the balcony
 * open behind her throne onto the night city, and her throne itself, the gum seat, the bubble she
 * blows for a back and, rising out of it, her crown of five flavours the size of the room: the one
 * thing only this place has. Her pink has taken the boards: puddles, drips off the velvet, bubbles
 * that rise and pop. It keeps the room's card (indigo and old gold, her pink the only saturated
 * colour) and its light: one warm spotlight on her, the city's cold glow, the footlights' wash.
 *
 * Positions are in metres from the fight's centre, along the stage (src/arena.ts layout 'z'): the
 * party near the footlights (+z), she far up it (-z) before the balcony, the camera from beyond the
 * footlights; everything tall stands at the back or down the sides, the hall drops away in front.
 */
export const THRONE_FIGHTS = ['reina', 'reina-vuelta'] as const;
/** Whether a fight is the Queen's, and goes up onto her stage. */
export const onThroneStage = (fight?: string) => (THRONE_FIGHTS as readonly (string | undefined)[]).includes(fight);
/**
 * How the two sides stand on her stage: along it (src/arena.ts layout 'z'), the party near the
 * footlights with their backs to the camera's side and she far up the stage before her throne
 * (Aitor, 2026-11-20: «Aitor y Gerard algo más atrás y ella en el fondo»), further apart than usual.
 */
export const THRONE_LAYOUT = 'z' as const, THRONE_SPREAD = 1.55;
/** Her fight's camera, against other fights': this much lower (degrees) and wider, to take in her throne and the balcony behind her. */
export const THRONE_VIEW = { lower: -6, wider: 1.1 } as const;
/**
 * Her entrance, in seconds from the fight's start (Aitor, 2026-11-20: a short film before the
 * fight). The stage is dark; low along its front the footlights come on one by one while the party
 * walks on; the camera glides up the dark stage to her throne, her core beating in the bubble; her
 * spotlight slams on and she is there, close, from below; her crown's flavours light one after
 * another while her name shows; and the camera pulls back over the party's shoulders into the
 * fight. src/game.ts moves the camera to it; src/battle-ui.ts shows the bars and her name when the
 * stage says (its cues `title` and `pull`), so a slow machine keeps them in time with the camera.
 */
export const THRONE_INTRO = { length: 7.5, foot: .45, footEach: .06, glide: 1.5, bang: 3, crown: 3.3, crownEach: .22, title: 3.4, pull: 5.6 } as const;
/** What the stage asks the game to sound, as it happens (src/game.ts plays them). */
export type ThroneCue = 'heartbeat' | 'lamp' | 'charge' | 'bang' | 'flavour' | 'title' | 'pull';

/** The stage, the hall below it, the velvet, the balcony and her throne (metres from the fight's centre). */
const STAGE = {
  /** The camera looks up the stage (-z) from beyond the footlights (+z): the party stands near them, she far up. */
  boards: { x0: -10, x1: 10, z0: -7, z1: 9 },
  /** How far the hall's floor lies under the boards, and how far it runs towards the camera. */
  drop: 1.1, hall: 15,
  /** The backcloth's line and height; the balcony's opening in it, behind her and the throne. */
  back: -7, tall: 7.6, balcony: { x0: -2.4, x1: 3.4, y0: .9, y1: 5.2 },
  /** Beside her and a step behind, on the camera's right, so her silhouette stands against the dark balcony. */
  throne: { x: 2.5, z: -4.9 },
} as const;
const PALETTE = {
  boards: '#5a3b2a', walnut: '#3b2c26', hall: '#231b18', velvet: '#232a5c', gold: '#c9a046', night: '#10132b',
  chair: '#8f9699', seat: '#3d4150', iron: '#16161c', her: '#ff6fae', core: '#ff3d8b', bubble: '#ff9cc9', foot: '#ffe2b0',
} as const;
/** Her crown's five flavours (docs/lore.md): strawberry, mint, grape, lemon, liquorice. */
const FLAVOURS = ['#ff4f7a', '#5fd3a0', '#9a5fe0', '#ffd84a', '#1c1418'] as const;
/** The warm of the theatre's lamps, and possession's violet, which her spotlight turns while she holds Aitor. */
const WARM = new pc.Color(1, .86, .64), HELD = new pc.Color(.66, .45, 1);

/** The real textures her stage wears, as the throne room does: the boards and the velvet. */
const LOOK = ['fusta-escenari', 'vellut'] as const;
let looking: Promise<void> | undefined, look: Map<string, LoadedTexture> | undefined;
/**
 * Fetches and decodes the stage's textures once, before her fight starts (src/game.ts waits for it,
 * as for the castle's figures): built with them, its materials compile once, under the glass,
 * instead of again when the textures arrive in the middle of her entrance.
 */
export function loadThroneLook() {
  return looking ??= (async () => {
    const infos = await Promise.all(LOOK.map(id => fetch(textureUrl(id, 'texture.json')).then(r => r.ok ? r.json() as Promise<GeoTexture> : undefined).catch(() => undefined)));
    look = await loadTextures(Object.fromEntries(LOOK.flatMap((id, i) => infos[i] ? [[id, infos[i]!]] : []))).catch(() => new Map<string, LoadedTexture>());
  })();
}
/** Whether the stage's textures are in (or failed: it is painted then). */
export const throneLookReady = () => !!look;

export interface ThroneArenaSource {
  /** Who is in the fight, to light her where she will stand. */
  cast: Cast;
}

export function createThroneArena(app: pc.Application, source: ThroneArenaSource) {
  const device = app.graphicsDevice;
  const root = new pc.Entity('Arena: el escenario de la Reina'); root.setPosition(POCKET_AT); app.root.addChild(root);
  const owned: pc.StandardMaterial[] = [], meshes: pc.Mesh[] = [], textures: pc.Texture[] = [];
  let alive = true;
  const jitter = (i: number) => { const v = Math.sin(i * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };
  const plain = (name: string, hex: string, gloss = .2, glow = 0) => {
    const m = new pc.StandardMaterial(); m.name = name; m.diffuse.fromString(hex); m.gloss = gloss; m.useMetalness = false;
    if (glow) { m.emissive.fromString(hex); m.emissiveIntensity = glow; }
    m.update(); owned.push(m); return m;
  };
  const addMesh = (name: string, b: MeshBuilder, material: pc.Material, parent = root, shadows = true) => {
    if (b.empty) return undefined;
    const mesh = b.mesh(device); meshes.push(mesh);
    const e = new pc.Entity(name);
    e.addComponent('render', { meshInstances: [new pc.MeshInstance(mesh, material)], castShadows: shadows, receiveShadows: true });
    parent.addChild(e); return e;
  };
  const part = (name: string, type: 'box' | 'cylinder' | 'sphere' | 'cone' | 'plane', material: pc.Material, p: number[], s: number[], r: number[] = [0, 0, 0], parent = root, shadows = true) => {
    const e = new pc.Entity(name);
    e.addComponent('render', { type, material, castShadows: shadows, receiveShadows: true });
    e.setLocalPosition(p[0], p[1], p[2]); e.setLocalScale(s[0], s[1], s[2]); e.setLocalEulerAngles(r[0], r[1], r[2]);
    parent.addChild(e); return e;
  };
  const light = (name: string, options: Record<string, unknown>, at: number[]) => {
    const e = new pc.Entity(name); e.addComponent('light', options); e.setLocalPosition(at[0], at[1], at[2]); root.addChild(e); return e;
  };
  const canvasTexture = (w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void) => {
    const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d')!);
    const t = new pc.Texture(device, { width: w, height: h, mipmaps: true, addressU: pc.ADDRESS_CLAMP_TO_EDGE, addressV: pc.ADDRESS_CLAMP_TO_EDGE });
    t.setSource(c); textures.push(t); return t;
  };

  const boards = plain('Tablas del escenario', PALETTE.boards, .45), walnut = plain('Nogal', PALETTE.walnut, .35), hall = plain('Suelo de la sala', PALETTE.hall, .3);
  const velvet = plain('Terciopelo', PALETTE.velvet, .3), gold = plain('Oro viejo', PALETTE.gold, .62), iron = plain('Hierro negro', PALETTE.iron, .4);
  // A shade under her pink, so it still reads saturated in the spotlight.
  const gum = plain('Su chicle', '#e8468e', .5), core = plain('Su núcleo', PALETTE.core, .6, 1.6);
  // Spread thin on the boards it is darker and wet, so it reads as gum under the spotlight, not as paint.
  const spilt = plain('Chicle derramado', '#c8306e', .75);
  const steel = plain('Sillas', PALETTE.chair, .5), seat = plain('Asientos', PALETTE.seat, .35);
  const footGlow = plain('Candilejas', PALETTE.foot, .5, 1.5);
  const bubble = plain('Su pompa', PALETTE.bubble, .85, .25);
  bubble.blendType = pc.BLEND_NORMAL; bubble.opacity = .38; bubble.depthWrite = false; bubble.update();
  const pop = plain('Pompas', PALETTE.bubble, .9, .35);
  pop.blendType = pc.BLEND_NORMAL; pop.opacity = .5; pop.depthWrite = false; pop.update();

  // ── The boards, the stage's front with its gold edge and footlights, and the hall below in the dark.
  const { x0, x1, z0, z1 } = STAGE.boards, drop = STAGE.drop;
  const floor = new MeshBuilder();
  floor.quad([x0, 0, z1], [x1, 0, z1], [x1, 0, z0], [x0, 0, z0], [0, 1, 0], [x0, z1], [x1, z1], [x1, z0], [x0, z0]);
  addMesh('Escenario', floor, boards, root, false);
  const front = new MeshBuilder();
  front.box([(x0 + x1) / 2, -drop / 2, z1 + .01], [x1 - x0, drop, .02]);
  // The sides of the stage, down to the hall, so it reads as a platform from the camera.
  front.box([x0 - .01, -drop / 2, (z0 + z1) / 2], [.02, drop, z1 - z0]); front.box([x1 + .01, -drop / 2, (z0 + z1) / 2], [.02, drop, z1 - z0]);
  addMesh('Frente del escenario', front, walnut);
  part('Filo dorado', 'box', gold, [(x0 + x1) / 2, .015, z1], [x1 - x0 + .04, .06, .06], [0, 0, 0], root, false);
  // The footlights: one housing for all, each lamp's glass its own, so they can come on one by one.
  const lamps = new MeshBuilder(), footlights: pc.Entity[] = [];
  for (let x = x0 + .7; x < x1; x += 1.25) {
    lamps.box([x, .06, z1 - .22], [.4, .12, .18]);
    footlights.push(part('Luz de candileja', 'box', footGlow, [x, .08, z1 - .12], [.32, .06, .02], [0, 0, 0], root, false));
  }
  addMesh('Candilejas', lamps, iron, root, false);
  const below = new MeshBuilder();
  below.quad([x0 - 3, -drop, STAGE.hall], [x1 + 3, -drop, STAGE.hall], [x1 + 3, -drop, z0], [x0 - 3, -drop, z0], [0, 1, 0], [0, 0], [1, 0], [1, 1], [0, 1]);
  addMesh('Suelo de la sala', below, hall, root, false);
  // The first rows of the empty folding chairs, facing the stage, an aisle down the middle.
  const frames = new MeshBuilder(), seats = new MeshBuilder();
  for (let row = 0; row < 3; row++) for (let x = x0 + .6; x < x1 - .4; x += .62) {
    if (Math.abs(x) < .9) continue;
    const z = z1 + 1.6 + row * 1.5, y = -drop, lean = (jitter(row * 31 + x) - .5) * .05;
    seats.box([x + lean, y + .45, z], [.46, .05, .42]); seats.box([x + lean, y + .78, z + .22], [.46, .36, .04]);
    for (const dx of [-.2, .2]) frames.box([x + dx + lean, y + .4, z + .02], [.03, .8, .03]);
  }
  addMesh('Sillas plegables', frames, steel); addMesh('Asientos', seats, seat);

  // ── Velvet in pleats: the backcloth either side of the balcony and over it, the wings down the sides.
  const pleats = new MeshBuilder();
  /** A run of round pleats from `a` to `b` along x (at z) or along z (at x), from y0 to y1, facing `out`. */
  const drape = (a: number, b: number, at: number, along: 'x' | 'z', y0: number, y1: number, out: 1 | -1) => {
    const n = Math.max(1, Math.round((b - a) / .34)), w = (b - a) / n, depth = .12, steps = 5;
    for (let k = 0; k < n; k++) for (let s = 0; s < steps; s++) {
      const u0 = s / steps, u1 = (s + 1) / steps, bulge = (u: number) => Math.sin(u * Math.PI) * depth + (jitter(k + a * 13) - .5) * .03;
      const p = (u: number, y: number): [number, number, number] => along === 'x' ? [a + (k + u) * w, y, at + out * bulge(u)] : [at + out * bulge(u), y, a + (k + u) * w];
      const nrm = (u: number): [number, number, number] => { const c = Math.cos(u * Math.PI) * .9; return along === 'x' ? [-c * out, 0, out] : [out, 0, -c * out]; };
      pleats.quad(p(u0, y0), p(u1, y0), p(u1, y1), p(u0, y1), along === 'x' ? [0, 0, out] : [out, 0, 0],
        [(k + u0) * w, y0], [(k + u1) * w, y0], [(k + u1) * w, y1], [(k + u0) * w, y1], [nrm(u0), nrm(u1), nrm(u1), nrm(u0)]);
    }
  };
  const { back, tall, balcony } = STAGE;
  drape(x0, balcony.x0, back, 'x', 0, tall, 1);
  drape(balcony.x1, x1, back, 'x', 0, tall, 1);
  drape(balcony.x0, balcony.x1, back, 'x', balcony.y1, tall, 1);
  // The wings: staggered legs down both sides, framing the stage the camera looks up.
  for (const [x, za, zb, out] of [[x0 + .2, z0, -3.6, 1], [x0 + .8, -2, 1.4, 1], [x1 - .2, z0, -3.6, -1], [x1 - .8, -2, 1.4, -1]] as const) drape(za, zb, x, 'z', 0, tall - .4, out);
  addMesh('Terciopelo en pliegues', pleats, velvet);
  // Gold edging: the backcloth's top, the balcony's frame.
  part('Bambalina dorada', 'box', gold, [(x0 + x1) / 2, tall, back + .2], [x1 - x0, .22, .14]);
  for (const x of [balcony.x0, balcony.x1]) part('Marco del balcón', 'box', gold, [x, (balcony.y0 + balcony.y1) / 2, back + .1], [.16, balcony.y1 - balcony.y0, .18]);
  part('Marco del balcón', 'box', gold, [(balcony.x0 + balcony.x1) / 2, balcony.y1, back + .1], [balcony.x1 - balcony.x0 + .16, .18, .18]);
  // The school's banner on the velvet, left of the balcony, her gum across a corner of it.
  const banner = plain('Pancarta', '#ffffff', .2);
  banner.diffuseMap = canvasTexture(1024, 160, ctx => {
    ctx.fillStyle = '#e9e1cf'; ctx.fillRect(0, 0, 1024, 160);
    ctx.fillStyle = '#7a2a24'; ctx.font = 'bold 74px Georgia, serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('INSTITUT ESCOLA REC COMTAL', 512, 84);
    ctx.fillStyle = PALETTE.her; ctx.beginPath(); ctx.moveTo(1024, 0); ctx.lineTo(820, 0); ctx.bezierCurveTo(860, 60, 930, 50, 960, 160); ctx.lineTo(1024, 160); ctx.fill();
  });
  banner.update();
  part('Pancarta de la escuela', 'plane', banner, [-6.2, 2.2, back + .22], [6.6, 1, 1.04], [90, 0, 0], root, false);

  // ── The balcony behind her: its railing and the night city beyond it, the room's view.
  const sill = new MeshBuilder();
  sill.box([(balcony.x0 + balcony.x1) / 2, balcony.y0 / 2, back], [balcony.x1 - balcony.x0, balcony.y0, .4]);
  addMesh('Muro bajo el balcón', sill, walnut);
  for (let x = balcony.x0 + .1; x <= balcony.x1; x += .22) part('Barrote', 'box', gold, [x, balcony.y0 + .55, back - .35], [.03, 1.1, .03], [0, 0, 0], root, false);
  part('Barandilla', 'box', gold, [(balcony.x0 + balcony.x1) / 2, balcony.y0 + 1.12, back - .35], [balcony.x1 - balcony.x0, .07, .09], [0, 0, 0], root, false);
  const city = plain('La ciudad de noche', '#ffffff', .2);
  city.diffuseMap = canvasTexture(768, 512, nightCity); city.emissiveMap = city.diffuseMap; city.emissive.set(1, 1, 1); city.emissiveIntensity = .55; city.update();
  part('La ciudad de noche', 'plane', city, [(balcony.x0 + balcony.x1) / 2, 3.4, back - 3], [11, 1, 7.4], [90, 0, 0], root, false);

  // ── Her throne: a dais and a seat of chewed gum, the bubble she blows for a back with her core
  // glowing in it, and her crown of five flavours on top.
  const { throne } = STAGE;
  const seatRoot = new pc.Entity('El trono'); seatRoot.setLocalPosition(throne.x, 0, throne.z); seatRoot.setLocalEulerAngles(0, -18, 0); root.addChild(seatRoot);
  part('Estrado de chicle', 'cylinder', gum, [0, .12, 0], [3.4, .24, 2.6], [0, 0, 0], seatRoot);
  for (let k = 0; k < 9; k++) {
    const a = k / 9 * Math.PI * 2, r = 1.35 + jitter(k) * .3;
    part('Bulto de chicle', 'sphere', gum, [Math.cos(a) * r, .2, Math.sin(a) * r * .75], [.7 + jitter(k + 3) * .4, .38, .6 + jitter(k + 5) * .3], [0, a * 57, 0], seatRoot);
  }
  for (const [x, y, z, s] of [[-.55, .55, .2, .85], [.55, .55, .2, .85], [0, .6, -.25, 1.1], [-.7, 1, -.45, .62], [.7, 1, -.45, .62]] as const) part('Asiento de chicle', 'sphere', gum, [x, y, z], [s, s * .8, s], [0, 0, 0], seatRoot);
  const pompa = part('La pompa del trono', 'sphere', bubble, [0, 1.9, -.6], [2.6, 2.6, 1.9], [0, 0, 0], seatRoot, false);
  const nucleo = part('Su núcleo', 'sphere', core, [0, 1.85, -.65], [.62, .62, .62], [0, 0, 0], seatRoot, false);
  const spikes = new pc.Entity('Su corona'); spikes.setLocalPosition(0, 2.85, -.6); seatRoot.addChild(spikes);
  const flavours = FLAVOURS.map((colour, k) => {
    const spread = (k - 2) * 26, length = .85 - Math.abs(k - 2) * .12;
    const arm = new pc.Entity('Púa de la corona'); arm.setLocalEulerAngles(0, 0, -spread); spikes.addChild(arm);
    // A twisted spike: three turns of a dark rod, offset round its axis.
    for (let s = 0; s < 6; s++) part('Púa', 'cylinder', iron, [Math.sin(s * 1.9) * .035, length * (s + .5) / 6, Math.cos(s * 1.9) * .035], [.12 - s * .01, length / 6 + .04, .12 - s * .01], [Math.sin(s * 1.9) * 8, 0, Math.cos(s * 1.9) * 8], arm);
    const flavour = plain(`Sabor ${k + 1}`, colour, .85, k === 4 ? 0 : .18);
    part('Bola de chicle', 'sphere', flavour, [0, length + .22, 0], [.48, .48, .48], [0, 0, 0], arm);
    return flavour;
  });
  // Her gum climbing the velvet from the boards, in tongues, thickest near the throne.
  for (let k = 0; k < 12; k++) {
    const x = x0 + 1 + jitter(k * 7) * (x1 - x0 - 2);
    if (x > balcony.x0 - .3 && x < balcony.x1 + .3) continue;
    const near = 1 - Math.min(1, Math.abs(x - throne.x) / 10), len = .3 + jitter(k * 11) * (.3 + .7 * near);
    part('Chicle trepando', 'sphere', spilt, [x, len / 2 - .08, back + .28], [.5 + jitter(k) * .5, len, .22], [0, 0, (jitter(k * 3) - .5) * 10], root, false);
  }
  // Where she will stand (the stage's formation), for her light and her gum to find her.
  const slots = formation(THRONE_LAYOUT, source.cast.allies, standing(source.cast.foes), THRONE_SPREAD);
  const queen = slots.foes[slots.foes.length - 1] ?? { x: 0, z: -2.6 };
  const party = slots.allies.reduce((sum, p) => ({ x: sum.x + p.x / slots.allies.length, z: sum.z + p.z / slots.allies.length }), { x: 0, z: 0 });
  // Puddles spreading over the boards from the throne to where she stands, and on towards the party.
  const puddles: [number, number, number][] = [];
  for (let k = 0; k < 9; k++) {
    const t = k / 8, x = pc.math.lerp(throne.x - .4, queen.x - .4, t) + (jitter(k * 5) - .5) * 1.6, z = pc.math.lerp(throne.z + 1.3, queen.z + 1.1, t) + (jitter(k * 9) - .5) * .9, r = .95 - t * .5 + jitter(k * 3) * .25;
    puddles.push([x, z, r]);
    part('Charco de chicle', 'cylinder', spilt, [x, .012 + k * .001, z], [r * 2, .02, r * 1.3], [0, jitter(k) * 180, 0], root, false);
  }

  // ── Bubbles rising off her gum, swelling, popping, and rising again from another puddle.
  const rising = Array.from({ length: 6 }, (_, k) => {
    const node = part('Pompa', 'sphere', pop, [0, 0, 0], [.1, .1, .1], [0, 0, 0], root, false);
    return { node, at: puddles[k % puddles.length], t: jitter(k * 17), speed: .08 + jitter(k * 23) * .06, size: .1 + jitter(k * 29) * .16 };
  });

  // ── Light: a warm spotlight on her and a cold rim from the balcony behind, her core's pink, the footlights' wash, a pool on the party.
  const SPOT = 4.6, FOOT = .7, PARTY = .55, RIM = .8;
  const spot = light('Foco sobre la Reina', { type: 'spot', color: WARM.clone(), intensity: SPOT, range: 18, innerConeAngle: 14, outerConeAngle: 26, castShadows: true, shadowResolution: 2048, shadowBias: .03, normalOffsetBias: .06, shadowType: pc.SHADOW_PCF3_32F }, [queen.x - 1.2, 8.5, queen.z + 4.2]);
  spot.lookAt(POCKET_AT.x + queen.x, POCKET_AT.y + 1.3, POCKET_AT.z + queen.z); spot.rotateLocal(90, 0, 0);
  const pink = light('Luz de su núcleo', { type: 'omni', color: new pc.Color().fromString(PALETTE.core), intensity: 1.8, range: 7, castShadows: false }, [throne.x - .3, 1.9, throne.z + .6]);
  const rim = light('Contraluz', { type: 'omni', color: new pc.Color().fromString('#8a98d0'), intensity: RIM, range: 5, castShadows: false }, [queen.x + .4, 3, queen.z - 2]);
  const foot = [-5, 5].map(x => light('Candilejas', { type: 'omni', color: new pc.Color().fromString('#ffd9a0'), intensity: FOOT, range: 7, castShadows: false }, [x, .4, z1 - .4]));
  const pool = light('Luz del grupo', { type: 'omni', color: WARM.clone(), intensity: PARTY, range: 8, castShadows: false }, [party.x, 3.4, party.z - .6]);

  // ── Real textures for the boards and the velvet, as the throne room has them: loaded before the
  // fight (`loadThroneLook`), so they are on from the first frame; painted if they never came.
  const dressReal = () => {
    const real = { 'fusta-escenari': [boards, '#5a3b2a', 2], vellut: [velvet, '#232a5c', .6] } as const;
    for (const id of LOOK) {
      const tex = look?.get(id), [m, tint, size] = real[id];
      if (!tex) continue;
      const map = gpuTexture(device, greyOf(tex).canvas, `${id} albedo`); textures.push(map);
      m.diffuseMap = map; m.diffuseMapTiling.set(1 / size, 1 / size);
      if (tex.normal) { const n = gpuTexture(device, tex.normal, `${id} normal`); textures.push(n); m.normalMap = n; m.normalMapTiling.set(1 / size, 1 / size); m.bumpiness = .7; }
      m.diffuse.copy(tintColour(tint, greyOf(tex))); m.update();
    }
  };
  if (look) dressReal(); else void loadThroneLook().then(() => { if (alive) dressReal(); });

  // ── What particles meet: the boards, the velvet and the throne (the hall below is the void).
  const pad = 1, cols = x1 - x0 + pad * 2 + 1, rows = z1 - z0 + pad * 2 + 1;
  const centre = { x: -x0 + pad, z: -z0 + pad };
  const cells: PocketCell[][] = Array.from({ length: rows }, (_, j) => Array.from({ length: cols }, (_, i) => {
    const x = i - centre.x, z = j - centre.z;
    return x >= x0 && x <= x1 && z >= z0 && z <= z1 ? 'floor' : 'void';
  }));
  const tops = new Float32Array(cols * rows);
  const mark = (x: number, z: number, top: number) => {
    const i = Math.round(x + centre.x), j = Math.round(z + centre.z);
    if (cells[j]?.[i] !== 'floor') return;
    cells[j][i] = 'wall'; tops[j * cols + i] = top;
  };
  for (let x = x0; x <= x1; x++) mark(x, back, tall);
  for (let x = Math.ceil(throne.x - 1.2); x <= throne.x + 1.2; x++) for (let z = Math.ceil(throne.z - .8); z <= throne.z + .8; z++) mark(x, z, 2.4);

  // ── Her entrance (THRONE_INTRO) and her hold on Aitor: what the lights do, frame by frame.
  const I = THRONE_INTRO, smooth = (v: number) => { const c = Math.min(1, Math.max(0, v)); return c * c * (3 - 2 * c); };
  /** Seconds into her entrance, while it plays; and the place's own light, kept to give back after it. */
  let intro: number | undefined, kept: { ambient: pc.Color; suns: { light: pc.LightComponent; intensity: number }[] } | undefined;
  /** How far her hold on Aitor has turned the stage (0–1), and how many lamps were on last frame. */
  const tint = new pc.Color();
  let held = 0, holding = false, lampsOn = footlights.length, flavoursOn = FLAVOURS.length - 1;
  const giveBack = () => {
    if (!kept) return;
    app.scene.ambientLight.copy(kept.ambient);
    for (const s of kept.suns) s.light.intensity = s.intensity;
    kept = undefined;
  };
  /** The light of the place, scaled: the stage is dark until her spotlight comes on, and dim until the camera pulls back. */
  const placeLight = (k: number) => {
    if (!kept) return;
    app.scene.ambientLight.set(kept.ambient.r * k, kept.ambient.g * k, kept.ambient.b * k, 1);
    for (const s of kept.suns) s.light.intensity = s.intensity * k;
  };

  let time = 0;
  return {
    root,
    /** The middle of the fight, in world space. */
    centre: POCKET_AT.clone(),
    floorAt: () => POCKET_AT.y,
    world: pocketWorld({ cells, stage: { layout: THRONE_LAYOUT, centre } }, POCKET_AT, (x, z) => tops[z * cols + x], BACKDROP),
    contains: (x: number, z: number) => Math.abs(x - POCKET_AT.x) < cols + 4 && Math.abs(z - POCKET_AT.z) < rows + 10,
    /** Where her throne's core glows, and where she stands, in world space: the entrance's camera looks at them. */
    throneCore: () => seatRoot.getPosition().clone().add(new pc.Vec3(0, 1.85, 0)),
    /** The middle of the footlights' row, in world space: her entrance starts low along it. */
    footlightsAt: () => root.getPosition().clone().add(new pc.Vec3(0, .35, z1 - .3)),
    /** Her entrance starts (none under reduced motion: the game skips it). */
    beginIntro() {
      intro = 0;
      kept = { ambient: app.scene.ambientLight.clone(), suns: (app.root.findComponents('light') as pc.LightComponent[]).filter(l => l.type === 'directional' && l.enabled).map(l => ({ light: l, intensity: l.intensity })) };
      lampsOn = 0; flavoursOn = 0;
    },
    /** Seconds into her entrance, or undefined once it is over. */
    get introTime() { return intro; },
    /** Straight to the end of her entrance (a key pressed to skip it). */
    skipIntro() { if (intro !== undefined && intro < I.pull) intro = I.pull - .001; },
    /** She holds Aitor (`on`) or has lost him: her spotlight turns possession's violet and the footlights falter. */
    setHeld(on: boolean) { holding = on; },
    /** Advances the stage; returns what it asks to sound this frame. */
    update(dt: number, animate: boolean): ThroneCue[] {
      const cues: ThroneCue[] = [];
      if (!animate) { if (intro !== undefined) { intro = undefined; giveBack(); } return cues; }
      time += dt;
      const i = intro;
      if (i !== undefined) {
        intro = i + dt;
        // Her heart, faster while the stage is dark.
        if (i < I.bang && Math.floor((i + dt) / .95) > Math.floor(i / .95)) cues.push('heartbeat');
        if (i < I.bang - .55 && i + dt >= I.bang - .55) cues.push('charge');
        if (i < I.bang && i + dt >= I.bang) cues.push('bang');
        if (i < I.title && i + dt >= I.title) cues.push('title');
        if (i < I.pull && i + dt >= I.pull) cues.push('pull');
        if (intro >= I.length) { intro = undefined; giveBack(); }
      }
      const t = intro;
      // The footlights, one by one across the front; all on when there is no entrance.
      const lit = t === undefined ? footlights.length : Math.max(0, Math.min(footlights.length, Math.floor((t - I.foot) / I.footEach) + 1));
      if (lit !== lampsOn) { if (lit > lampsOn && t !== undefined) cues.push('lamp'); lampsOn = lit; footlights.forEach((lamp, k) => { lamp.enabled = k < lit; }); }
      // Her crown's flavours, one after another once she is seen (the liquorice one never glows).
      const shown = t === undefined ? FLAVOURS.length - 1 : Math.max(0, Math.min(FLAVOURS.length - 1, Math.floor((t - I.crown) / I.crownEach) + 1));
      if (shown !== flavoursOn) { if (shown > flavoursOn) cues.push('flavour'); flavoursOn = shown; }
      flavours.forEach((m, k) => {
        if (k === 4) return;
        const since = t === undefined ? 9 : t - (I.crown + k * I.crownEach);
        const glow = since < 0 ? 0 : .18 + 1.6 * Math.exp(-since * 2.2);
        if (Math.abs(m.emissiveIntensity - glow) > .005) { m.emissiveIntensity = glow; m.update(); }
      });
      // The place's light: dark until the spotlight, dim on her, whole as the camera pulls back.
      if (t !== undefined) placeLight(t < I.bang ? .1 : pc.math.lerp(.45, 1, smooth((t - I.pull) / (I.length - I.pull))));
      held += ((holding ? 1 : 0) - held) * (1 - Math.exp(-dt * 1.6));
      // Her spotlight: off in the dark, a slam that overshoots, then steady; violet while she holds Aitor.
      const slam = t === undefined ? 0 : t < I.bang ? -1 : Math.exp(-(t - I.bang) * 5) * 1.6;
      // Never quite 0: a light at 0 leaves the clustered lighting, and coming back (a shadow-casting one) recompiles every shader at the slam.
      spot.light!.intensity = slam < 0 ? .01 : SPOT * (1 + slam) * (1 + held * .15);
      spot.light!.color = tint.lerp(WARM, HELD, held);
      rim.light!.intensity = t !== undefined && t < I.bang ? .01 : RIM * (1 + held * .6);
      // The footlights' wash grows with the lamps lit, and falters while she holds him.
      const falter = held > .05 ? 1 - held * (.35 + .35 * Math.max(0, Math.sin(time * 23) * Math.sin(time * 7.3))) : 1;
      foot.forEach(f => { f.light!.intensity = Math.max(.01, FOOT * lit / footlights.length * falter); });
      pool.light!.intensity = Math.max(.01, t === undefined ? PARTY * (1 - held * .4) : PARTY * smooth((t - I.pull) / (I.length - I.pull)));
      // The throne's bubble swells and shrinks, slowly, like breath; her core beats inside it, faster and
      // brighter in the dark of her entrance and while she holds him.
      const breath = Math.sin(time * .9);
      pompa.setLocalScale(2.6 * (1 + breath * .06), 2.6 * (1 + breath * .07), 1.9 * (1 + breath * .05));
      const rate = t !== undefined && t < I.bang ? 6.6 : 2.4 + held * 2.2;
      const pulse = Math.max(0, Math.sin(time * rate)) ** 6, beat = .6 + pulse * .25;
      nucleo.setLocalScale(beat, beat, beat);
      pink.light!.intensity = (1.5 + pulse * 1.1) * (t !== undefined && t < I.bang ? 1.7 : 1 + held * .5);
      for (const b of rising) {
        b.t += dt * b.speed * (t !== undefined && t >= I.bang && t < I.bang + .4 ? 6 : 1);
        if (b.t >= 1) { b.t = 0; b.at = puddles[Math.floor(jitter(time * 13 + b.size) * puddles.length)]; }
        const grow = Math.min(1, b.t * 6), popping = b.t > .92 ? 1 - (b.t - .92) / .08 : 1, s = b.size * grow * popping;
        b.node.setLocalPosition(b.at[0] + Math.sin(time * .7 + b.size * 20) * .2, .15 + b.t * 3.2, b.at[1]);
        b.node.setLocalScale(s, s, s);
      }
      return cues;
    },
    destroy() { alive = false; giveBack(); root.destroy(); meshes.forEach(m => m.destroy()); owned.forEach(m => m.destroy()); textures.forEach(t => t.destroy()); },
  };
}
export type ThroneArena = ReturnType<typeof createThroneArena>;

/** The night city through the balcony, as the throne room paints it: blocks lit, the Meridiana's lamps, Torre Glòries, Collserola. */
function nightCity(ctx: CanvasRenderingContext2D) {
  const W = 768, H = 512, jitter = (i: number) => { const v = Math.sin(i * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#060818'); sky.addColorStop(.3, '#141a44'); sky.addColorStop(.48, '#3a2a4a'); sky.addColorStop(.56, '#1a1a36');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 70; i++) { ctx.fillStyle = '#ffffff80'; ctx.fillRect(jitter(i + 3000) * W, jitter(i + 3100) * 160, 1.5, 1.5); }
  ctx.fillStyle = '#10142e'; ctx.beginPath(); ctx.moveTo(380, 270); ctx.quadraticCurveTo(600, 210, W, 240); ctx.lineTo(W, 320); ctx.lineTo(380, 320); ctx.fill();
  ctx.fillStyle = '#ff5050'; ctx.fillRect(650, 196, 3, 30); ctx.fillRect(647, 196, 9, 3);
  for (let rowY = 280; rowY < H + 80; rowY += 22 + (rowY - 280) * .25) {
    const scale = 1 + (rowY - 280) / 70;
    for (let bx = -10; bx < W; bx += 26 * scale) {
      const h = (12 + jitter(bx + rowY) * 20) * scale;
      ctx.fillStyle = '#0d1029'; ctx.fillRect(bx, rowY - h, 25 * scale, h + 24 * scale);
      for (let wy = rowY - h + 3 * scale; wy < rowY; wy += 6 * scale) for (let wx = bx + 3 * scale; wx < bx + 22 * scale; wx += 6 * scale) {
        if (jitter(wx * 3 + wy) < .35) { ctx.fillStyle = jitter(wx + wy * 7) < .7 ? '#ffcf7a' : '#cfe0ff'; ctx.fillRect(wx, wy, 2.4 * scale, 2.4 * scale); }
      }
    }
  }
  ctx.fillStyle = '#c9b48a';
  for (const [tx, th] of [[170, 96], [186, 112], [202, 106], [218, 90], [194, 138]] as const) { ctx.beginPath(); ctx.moveTo(tx - 7, 282); ctx.lineTo(tx - 4, 282 - th); ctx.lineTo(tx, 282 - th - 14); ctx.lineTo(tx + 4, 282 - th); ctx.lineTo(tx + 7, 282); ctx.fill(); }
  for (const dx of [-1, 1]) for (let k = 0; k < 30; k++) {
    const f = k / 30, px = 500 + dx * (10 + 300 * f * f), py = 274 + 300 * f * f;
    ctx.fillStyle = '#ffb347'; ctx.beginPath(); ctx.arc(px, py, 1.2 + f * 4, 0, Math.PI * 2); ctx.fill();
  }
  ctx.save(); ctx.beginPath(); ctx.ellipse(500, 274, 18, 92, 0, Math.PI, 0); ctx.lineTo(518, 276); ctx.lineTo(482, 276); ctx.closePath(); ctx.clip();
  ['#ff4d7a', '#4da3ff', '#ffe066', '#7fe0c0', '#4da3ff', '#ff4d7a'].forEach((c, i) => { ctx.fillStyle = c; ctx.fillRect(478, 180 + i * 17, 44, 17); });
  ctx.restore();
}
