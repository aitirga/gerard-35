import * as pc from 'playcanvas';
import { formation, pocketWorld, standing, type Cast, type PocketCell } from './arena';
import { MeshBuilder } from './geo-scenery';
import type { GeoTexture } from './geo';
import { gpuTexture, greyOf, loadTextures, textureUrl, tintColour, type LoadedTexture } from './materials';
import { BACKDROP } from './particles';
import { POCKET_AT } from './pocket';

/**
 * The castle's two great bosses before the Queen fight on stages built for them, as she does on hers
 * (src/throne-arena.ts; docs/places/palace-zones.md § The bosses' stages): the picture breaks into
 * glass and the fight goes on in the room as the boss has made it, with a short film first.
 *
 * - **La pista** (Aurelià, `aurelia`): the gym dressed as his. Running lanes painted down the floor
 *   from the party to his dais of marble, two marble columns, the wall bars, a timeline along the
 *   wall and, over the dais, the gym's scoreboard, which runs his lap (`setLap`). His entrance: the
 *   tubes coming on row by row down the lanes, then the school bell.
 * - **La sala de juntas** (Mar, Montse and Pilar, `direccion`): Direcció's meeting room. A wall of
 *   windows behind them, their venetian blinds letting the morning in in stripes over the carpet;
 *   the long table with three empty chairs and three lamps (one goes out with each who falls), the
 *   book of minutes open between them and the school's seal over it, her gum across it. Their
 *   entrance: the blinds opening bay by bay, the three lamps, the stamp.
 *
 * Positions are in metres from the fight's centre, along the stage (src/arena.ts layout 'z'): the
 * party near the camera (+z), the boss up it (-z), everything tall at the back or down the sides.
 */
export type BossStageId = 'pista' | 'juntas';
export const BOSS_STAGES: Partial<Record<string, BossStageId>> = { aurelia: 'pista', direccion: 'juntas' };
/** The stage a fight goes up onto, if it has one. */
export const bossStageOf = (fight?: string) => fight ? BOSS_STAGES[fight] : undefined;
/** How the two sides stand on these stages: along them, the party near the camera, a little further apart than usual. */
export const STAGE_LAYOUT = 'z' as const, STAGE_SPREAD = 1.45;
/**
 * The fight's camera on these stages, against other fights' (Aitor, 2026-11-21: «una visión más de
 * frente, un pelín más ángulo de bajo»): this much lower (degrees), a touch wider, and turned this
 * much towards straight down the stage, so the boss is seen from nearly in front, not from above.
 */
export const STAGE_VIEW = { lower: -9, wider: 1.08, turn: -4 } as const;
/**
 * The entrance, in seconds from the fight's start: the room lights up in steps (`steps` of them from
 * `light`, `each` apart) while the camera glides low towards the boss; `bang` cuts to the boss from
 * below; the name at `title`; the camera pulls back at `pull` into the fight's own view by `length`.
 * src/battle-ui.ts shows the bars and the name when the stage says (`title`, `pull`), as the Queen's.
 */
export const STAGE_INTRO = { length: 7, light: .5, each: .2, glide: 1.4, bang: 3.1, title: 3.4, pull: 5.3 } as const;
/** What a stage asks the game to sound: a step of its light, the run-up, the blow, the name, the pull back. */
export type StageCue = 'step' | 'lamp' | 'charge' | 'bang' | 'title' | 'pull';

/** The real textures the stages wear. */
const LOOK = ['estuc', 'marbre', 'paret-pintada'] as const;
let looking: Promise<void> | undefined, look: Map<string, LoadedTexture> | undefined;
/** Fetches and decodes the stages' textures once, before their fight starts (src/game.ts waits for it). */
export function loadStageLook() {
  return looking ??= (async () => {
    const infos = await Promise.all(LOOK.map(id => fetch(textureUrl(id, 'texture.json')).then(r => r.ok ? r.json() as Promise<GeoTexture> : undefined).catch(() => undefined)));
    look = await loadTextures(Object.fromEntries(LOOK.flatMap((id, i) => infos[i] ? [[id, infos[i]!]] : []))).catch(() => new Map<string, LoadedTexture>());
  })();
}
export const stageLookReady = () => !!look;

export interface BossStageSource {
  /** Who is in the fight, to light the boss where they will stand. */
  cast: Cast;
}
/** One camera key of an entrance: what it looks at, its zoom, and how far it turns and tips from the fight's own view (degrees). */
export interface StageShot { target: pc.Vec3; height: number; yaw: number; pitch: number }
const jitter = (i: number) => { const v = Math.sin(i * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };
const smooth = (v: number) => { const c = Math.min(1, Math.max(0, v)); return c * c * (3 - 2 * c); };

/** The pieces every stage is built with, and what it owns to destroy. */
function stageKit(app: pc.Application, name: string) {
  const device = app.graphicsDevice;
  const root = new pc.Entity(name); root.setPosition(POCKET_AT); app.root.addChild(root);
  const owned: pc.StandardMaterial[] = [], meshes: pc.Mesh[] = [], textures: pc.Texture[] = [];
  const plain = (label: string, hex: string, gloss = .2, glow = 0) => {
    const m = new pc.StandardMaterial(); m.name = label; m.diffuse.fromString(hex); m.gloss = gloss; m.useMetalness = false;
    if (glow) { m.emissive.fromString(hex); m.emissiveIntensity = glow; }
    m.update(); owned.push(m); return m;
  };
  /** Light that adds to what is behind it (a shaft, a pool of light), never hides it. */
  const glowing = (label: string, hex: string, opacity: number) => {
    const m = plain(label, '#000000', 0); m.emissive.fromString(hex); m.emissiveIntensity = 1;
    m.blendType = pc.BLEND_ADDITIVEALPHA; m.opacity = opacity; m.depthWrite = false; m.useLighting = false; m.update(); return m;
  };
  const addMesh = (label: string, b: MeshBuilder, material: pc.Material, parent = root, shadows = true) => {
    if (b.empty) return undefined;
    const mesh = b.mesh(device); meshes.push(mesh);
    const e = new pc.Entity(label);
    e.addComponent('render', { meshInstances: [new pc.MeshInstance(mesh, material)], castShadows: shadows, receiveShadows: true });
    parent.addChild(e); return e;
  };
  const part = (label: string, type: 'box' | 'cylinder' | 'sphere' | 'cone' | 'plane' | 'torus', material: pc.Material, p: number[], s: number[], r: number[] = [0, 0, 0], parent = root, shadows = true) => {
    const e = new pc.Entity(label);
    e.addComponent('render', { type, material, castShadows: shadows, receiveShadows: true });
    e.setLocalPosition(p[0], p[1], p[2]); e.setLocalScale(s[0], s[1], s[2]); e.setLocalEulerAngles(r[0], r[1], r[2]);
    parent.addChild(e); return e;
  };
  const light = (label: string, options: Record<string, unknown>, at: number[]) => {
    const e = new pc.Entity(label); e.addComponent('light', options); e.setLocalPosition(at[0], at[1], at[2]); root.addChild(e); return e;
  };
  const canvasTexture = (w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void) => {
    const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d')!);
    const t = new pc.Texture(device, { width: w, height: h, mipmaps: true, addressU: pc.ADDRESS_CLAMP_TO_EDGE, addressV: pc.ADDRESS_CLAMP_TO_EDGE });
    t.setSource(c); textures.push(t); return { texture: t, canvas: c, redraw(next: (ctx: CanvasRenderingContext2D) => void) { next(c.getContext('2d')!); t.setSource(c); } };
  };
  /** A real texture on a material, tinted, `size` metres a tile; painted if it never came. */
  const dress = (m: pc.StandardMaterial, id: typeof LOOK[number], tint: string, size: number, bump = .6) => {
    const apply = () => {
      const tex = look?.get(id);
      if (!tex || !alive) return;
      const map = gpuTexture(device, greyOf(tex).canvas, `${id} albedo`); textures.push(map);
      m.diffuseMap = map; m.diffuseMapTiling.set(1 / size, 1 / size);
      if (tex.normal) { const n = gpuTexture(device, tex.normal, `${id} normal`); textures.push(n); m.normalMap = n; m.normalMapTiling.set(1 / size, 1 / size); m.bumpiness = bump; }
      m.diffuse.copy(tintColour(tint, greyOf(tex))); m.update();
    };
    if (look) apply(); else void loadStageLook().then(apply);
  };
  /**
   * The place's own light, while the stage stands: its ambient and suns are the room's, not the
   * castle's; `dim` scales them (the entrance starts in the dark). Given back when the stage goes.
   */
  const kept = { ambient: app.scene.ambientLight.clone(), suns: (app.root.findComponents('light') as pc.LightComponent[]).filter(l => l.type === 'directional' && l.enabled).map(l => ({ light: l, intensity: l.intensity })) };
  let ambient = new pc.Color(), sunShare = 1;
  const room = (hex: string, sun: number) => { ambient = new pc.Color().fromString(hex); sunShare = sun; dim(1); };
  const dim = (k: number) => {
    app.scene.ambientLight.set(ambient.r * k, ambient.g * k, ambient.b * k, 1);
    for (const s of kept.suns) s.light.intensity = s.intensity * sunShare * k;
  };
  let alive = true;
  const destroy = () => {
    alive = false;
    app.scene.ambientLight.copy(kept.ambient);
    for (const s of kept.suns) s.light.intensity = s.intensity;
    root.destroy(); meshes.forEach(m => m.destroy()); owned.forEach(m => m.destroy()); textures.forEach(t => t.destroy());
  };
  /** What particles meet: the floor inside `x0…x1`, `z0…z1`, walls where `mark` says. */
  const particles = (x0: number, x1: number, z0: number, z1: number) => {
    const pad = 1, cols = x1 - x0 + pad * 2 + 1, rows = z1 - z0 + pad * 2 + 1, centre = { x: -x0 + pad, z: -z0 + pad };
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
    return { mark, world: () => pocketWorld({ cells, stage: { layout: STAGE_LAYOUT, centre } }, POCKET_AT, (x, z) => tops[z * cols + x], BACKDROP), contains: (x: number, z: number) => Math.abs(x - POCKET_AT.x) < cols + 4 && Math.abs(z - POCKET_AT.z) < rows + 10 };
  };
  return { app, device, root, plain, glowing, addMesh, part, light, canvasTexture, dress, room, dim, destroy, particles };
}
type Kit = ReturnType<typeof stageKit>;

/** Where the fighters will stand on a stage: the foes' and the party's spots, and the middle of each side. */
function stand(cast: Cast) {
  const slots = formation(STAGE_LAYOUT, cast.allies, standing(cast.foes), STAGE_SPREAD);
  const mid = (ps: { x: number; z: number }[]) => ps.reduce((s, p) => ({ x: s.x + p.x / ps.length, z: s.z + p.z / ps.length }), { x: 0, z: 0 });
  return { ...slots, foe: mid(slots.foes.length ? slots.foes : [{ x: 0, z: -2.4 }]), party: mid(slots.allies.length ? slots.allies : [{ x: 0, z: 4 }]) };
}

/**
 * The entrance's clock, shared by both stages: it starts, it is skipped, it says when to sound the
 * run-up, the blow, the name and the pull back, and how lit the place is (dark until the blow, dim
 * on the boss, whole once the camera is back).
 */
function entrance(kit: Kit) {
  const I = STAGE_INTRO;
  let t: number | undefined;
  return {
    begin() { t = 0; kit.dim(.06); },
    get time() { return t; },
    skip() { if (t !== undefined && t < I.pull) t = I.pull - .001; },
    /** Advances it; `cues` gets what it asks to sound. Returns the time this frame, or undefined once over. */
    step(dt: number, cues: StageCue[]) {
      const i = t;
      if (i === undefined) return undefined;
      t = i + dt;
      if (i < I.bang - .5 && t >= I.bang - .5) cues.push('charge');
      if (i < I.bang && t >= I.bang) cues.push('bang');
      if (i < I.title && t >= I.title) cues.push('title');
      if (i < I.pull && t >= I.pull) cues.push('pull');
      if (t >= I.length) { t = undefined; kit.dim(1); return undefined; }
      kit.dim(t < I.bang ? .06 + .3 * smooth((t - I.light) / (I.bang - I.light)) : pc.math.lerp(.5, 1, smooth((t - I.pull) / (I.length - I.pull))));
      return t;
    },
    end() { if (t !== undefined) { t = undefined; kit.dim(1); } },
  };
}

/**
 * The entrance's camera, as the Queen's: low along the floor towards the boss while the room lights
 * up, a cut to the boss's face from below at the blow, a slow drift on it, then the pull back over
 * the party's shoulders into the fight's own view (`fight`, `height`).
 */
function entranceShot(t: number, from: pc.Vec3, to: pc.Vec3, face: pc.Vec3, fight: pc.Vec3, height: number): StageShot {
  const I = STAGE_INTRO;
  const keys: (StageShot & { at: number })[] = [
    { at: 0, target: from, height: 2.6, yaw: -24, pitch: -16 },
    { at: I.glide, target: from.clone().lerp(from, to, .45), height: 3, yaw: -12, pitch: -15 },
    { at: I.bang, target: to, height: 3.6, yaw: -4, pitch: -13 },
    // From the left of the party's line, so neither of them stands between the camera and the boss.
    { at: I.bang, target: face.clone().add(new pc.Vec3(0, -.35, 0)), height: 2.4, yaw: -32, pitch: -20 },
    { at: I.pull, target: face, height: 1.9, yaw: -40, pitch: -22 },
    { at: I.length, target: fight, height, yaw: 0, pitch: 0 },
  ];
  const k = t < I.glide ? 0 : t < I.bang ? 1 : t < I.pull ? 3 : 4, a = keys[k], b = keys[k + 1];
  const raw = Math.min(1, Math.max(0, (t - a.at) / Math.max(.001, b.at - a.at)));
  const u = k === 1 || k === 4 ? raw * raw * (3 - 2 * raw) : raw;
  return { target: a.target.clone().lerp(a.target, b.target, u), height: pc.math.lerp(a.height, b.height, u), yaw: pc.math.lerp(a.yaw, b.yaw, u), pitch: pc.math.lerp(a.pitch, b.pitch, u) };
}

export function createBossStage(app: pc.Application, id: BossStageId, source: BossStageSource) {
  return id === 'pista' ? createPista(app, source) : createJuntas(app, source);
}
export type BossStage = ReturnType<typeof createBossStage>;

// ——— La pista: Aurelià's gym ———————————————————————————————————————————————————————————————

const GYM = {
  floor: { x0: -11, x1: 11, z0: -8, z1: 12 },
  /** His dais at the back, in marble, the finish line before it. */
  dais: { x0: -4.4, x1: 4.4, z0: -8, z1: -4.9, h: .48 },
  back: -8, lanes: 6, lane: 1.22,
  palette: {
    floor: '#7d8287', mat: '#2d5a9e', matSide: '#24497f', wall: '#e8e2d4', dado: '#2d5a9e', pine: '#c79a5b', yellow: '#e5b52e', white: '#e9ece4',
    tube: '#e6f0ff', shade: '#1c2333', leather: '#7a4a2c', marble: '#e9e5dc', plum: '#6e2453', steel: '#8f9699', board: '#1d2a22',
  },
} as const;
/** A history teacher's timeline along the wall (Catalan, as the school's walls are). */
const TIMELINE = [['-753', 'Roma'], ['-218', 'Empúries'], ['270', 'Aurelià'], ['476', 'Fi de Roma'], ['988', 'Borrell II'], ['1137', 'Corona'], ['1714', 'Setge'], ['1888', 'Exposició'], ['1931', 'República'], ['1977', 'Retorn'], ['1992', 'Jocs']] as const;

function createPista(app: pc.Application, source: BossStageSource) {
  const kit = stageKit(app, 'Arena: la pista de Aurelià'), { root, plain, addMesh, part, light, canvasTexture, dress } = kit, P = GYM.palette;
  kit.room('#59606e', .35);
  const { x0, x1, z0, z1 } = GYM.floor, back = GYM.back;
  const at = stand(source.cast);
  const boss = at.foes[0] ?? at.foe;

  const floor = plain('Suelo de deporte', P.floor, .55), mat = plain('Colchonetas', P.mat, .3), matSide = plain('Canto de colchoneta', P.matSide, .25);
  const wall = plain('Pared', P.wall, .15), dado = plain('Zócalo azul', P.dado, .2), pine = plain('Pino', P.pine, .35);
  const yellow = plain('Línea amarilla', P.yellow, .3), white = plain('Línea blanca', P.white, .3), marble = plain('Mármol', P.marble, .7);
  const shade = plain('Sombra', P.shade, .1), leather = plain('Cuero', P.leather, .3), steel = plain('Acero', P.steel, .5);
  const laurel = plain('Laurel de chicle', '#c23a78', .6), gum = plain('Su chicle', '#e8468e', .55), spilt = plain('Chicle derramado', '#c8306e', .75), plum = plain('Ventanas', P.plum, .2, 1.1);
  const laneBlue = plain('Calles pintadas', '#2a5292', .45);
  dress(floor, 'estuc', P.floor, 3, .4); dress(marble, 'marbre', P.marble, 1.5, .4); dress(wall, 'paret-pintada', P.wall, 2, .5); dress(dado, 'paret-pintada', P.dado, 2, .5);

  // ── The floor, the lanes painted down it from the party to his dais, the start and the finish.
  const ground = new MeshBuilder();
  ground.quad([x0, 0, z1], [x1, 0, z1], [x1, 0, z0], [x0, 0, z0], [0, 1, 0], [x0, z1], [x1, z1], [x1, z0], [x0, z0]);
  addMesh('Suelo', ground, floor, root, false);
  const width = GYM.lanes * GYM.lane, lx0 = -width / 2, start = 7.4, finish = GYM.dais.z1 - .25;
  const paint = new MeshBuilder();
  paint.quad([lx0, .004, start + .6], [-lx0, .004, start + .6], [-lx0, .004, finish], [lx0, .004, finish], [0, 1, 0], [0, 0], [1, 0], [1, 1], [0, 1]);
  addMesh('Calles', paint, laneBlue, root, false);
  const lines = new MeshBuilder();
  for (let k = 0; k <= GYM.lanes; k++) lines.box([lx0 + k * GYM.lane, .008, (start + .6 + finish) / 2], [.06, .008, start + .6 - finish]);
  lines.box([0, .009, start], [width, .008, .1]);
  addMesh('Líneas de las calles', lines, white, root, false);
  // The finish, before his dais: a yellow line, the colour of the court's own.
  part('Meta', 'box', yellow, [0, .01, finish + .08], [width + .4, .01, .16], [0, 0, 0], root, false);
  // The court's lines either side, the gym it still is.
  const court = new MeshBuilder();
  for (const x of [-7.6, 7.6]) court.box([x, .007, 2], [.07, .007, 18]);
  court.box([-9.2, .007, -1.5], [3.2, .007, .07]); court.box([9.2, .007, -1.5], [3.2, .007, .07]);
  addMesh('Líneas de la pista', court, yellow, root, false);
  // The lanes' numbers at the start, on the floor, readable from the camera.
  const numbers = plain('Números de calle', '#ffffff', .3);
  numbers.diffuseMap = canvasTexture(768, 128, ctx => {
    ctx.clearRect(0, 0, 768, 128); ctx.fillStyle = '#e9ece4'; ctx.font = 'bold 92px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (let k = 0; k < GYM.lanes; k++) ctx.fillText(String(k + 1), (k + .5) * 128, 66);
  }).texture;
  numbers.opacityMap = numbers.diffuseMap; numbers.blendType = pc.BLEND_NORMAL; numbers.depthWrite = false; numbers.update();
  part('Números de calle', 'plane', numbers, [0, .012, start + .45], [width, 1, 1], [0, 0, 0], root, false);

  // ── His dais of marble, its step, his desk and a blackboard on wheels: the lesson.
  const D = GYM.dais;
  const dais = new MeshBuilder();
  dais.box([(D.x0 + D.x1) / 2, D.h / 2, (D.z0 + D.z1) / 2], [D.x1 - D.x0, D.h, D.z1 - D.z0]);
  dais.box([(D.x0 + D.x1) / 2, D.h / 4, D.z1 + .22], [D.x1 - D.x0 - .6, D.h / 2, .44]);
  addMesh('Tarima de mármol', dais, marble);
  // Her gum seeping out of the marble's joints, down the step.
  for (let k = 0; k < 7; k++) {
    const x = D.x0 + .6 + jitter(k * 13) * (D.x1 - D.x0 - 1.2), r = .25 + jitter(k * 7) * .35;
    part('Chicle en la junta', 'cylinder', spilt, [x, .012, D.z1 + .5 + jitter(k * 3) * .5], [r * 2, .02, r], [0, jitter(k) * 180, 0], root, false);
  }
  const desk = new pc.Entity('Su mesa'); desk.setLocalPosition(-2.75, D.h, -6.9); desk.setLocalEulerAngles(0, 8, 0); root.addChild(desk);
  const walnut = plain('Madera de la mesa', '#4a3526', .4);
  part('Tablero', 'box', walnut, [0, .76, 0], [1.9, .06, .85], [0, 0, 0], desk);
  part('Faldón', 'box', walnut, [0, .45, .38], [1.9, .6, .04], [0, 0, 0], desk);
  for (const x of [-.88, .88]) part('Costado', 'box', walnut, [x, .38, 0], [.06, .76, .8], [0, 0, 0], desk);
  const paper = plain('Exámenes', '#f2efe6', .2);
  for (let k = 0; k < 4; k++) part('Exámenes', 'box', paper, [-.4 + k * .06, .8 + k * .025, .05 - k * .02], [.42, .022, .3], [0, k * 7, 0], desk);
  part('Cronómetro', 'cylinder', shade, [.55, .81, .1], [.12, .03, .12], [0, 0, 0], desk);
  // The blackboard on wheels, today's lesson in chalk.
  const board = new pc.Entity('Pizarra'); board.setLocalPosition(3, D.h, -7.1); board.setLocalEulerAngles(0, -10, 0); root.addChild(board);
  const chalk = plain('Pizarra', '#ffffff', .15);
  chalk.diffuseMap = canvasTexture(512, 320, ctx => {
    ctx.fillStyle = P.board; ctx.fillRect(0, 0, 512, 320);
    ctx.strokeStyle = '#d9dccf'; ctx.fillStyle = '#d9dccf'; ctx.lineWidth = 3; ctx.font = 'italic 34px Georgia, serif';
    ctx.fillText('Tema 9', 28, 56); ctx.font = '26px Georgia, serif'; ctx.fillText('La crisi del segle III', 28, 98);
    ctx.beginPath(); ctx.moveTo(28, 200); ctx.lineTo(484, 200); ctx.stroke();
    [['235', 60], ['270', 210], ['275', 300], ['284', 440]].forEach(([y, x]) => { ctx.beginPath(); ctx.moveTo(+x, 190); ctx.lineTo(+x, 210); ctx.stroke(); ctx.font = '22px Georgia, serif'; ctx.fillText(String(y), +x - 22, 240); });
    ctx.font = 'bold 26px Georgia, serif'; ctx.fillText('RESTITVTOR ORBIS', 150, 290);
  }).texture;
  chalk.update();
  part('Pizarra', 'plane', chalk, [0, 1.35, 0], [1.7, 1, 1.06], [90, 0, 0], board, false);
  part('Marco', 'box', steel, [0, 1.35, -.02], [1.8, 1.15, .04], [0, 0, 0], board);
  for (const x of [-.85, .85]) { part('Pata', 'box', steel, [x, .45, -.02], [.05, .9, .05], [0, 0, 0], board); part('Rueda', 'cylinder', shade, [x, .06, -.02], [.12, .04, .12], [90, 0, 0], board); }

  // ── Two marble columns either side of the dais, her laurel of gum on each, his banners between.
  for (const x of [D.x0 - .5, D.x1 + .5]) {
    part('Basa', 'box', marble, [x, .15, -7.1], [1.1, .3, 1.1]);
    part('Columna', 'cylinder', marble, [x, 2.55, -7.1], [.78, 4.5, .78]);
    part('Capitel', 'box', marble, [x, 4.9, -7.1], [1.05, .3, 1.05]);
    // Fluting: thin dark lines round the shaft, so it reads as a column and not a pipe.
    for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2; part('Estría', 'box', plain('Estría', '#b9b4a8', .3), [x + Math.cos(a) * .385, 2.55, -7.1 + Math.sin(a) * .385], [.04, 4.3, .04], [0, -a * 57.3, 0], root, false); }
    // His laurel in her gum round the column: two rows of narrow leaves along an open ring, tied at the bottom.
    const ring = new pc.Entity('Laurel de chicle'); ring.setLocalPosition(x, 3.25, -6.66); root.addChild(ring);
    for (const side of [-1, 1]) for (let k = 0; k < 9; k++) {
      const a = -Math.PI / 2 + side * (.25 + k / 8 * 2.55), r = .5, out = k % 2 ? .07 : -.07;
      part('Hoja', 'sphere', laurel, [Math.cos(a) * (r + out), Math.sin(a) * (r + out), 0], [.2, .065, .04], [0, 0, a * 57.3 + 90 + side * 35], ring, false);
    }
    part('Lazo', 'sphere', gum, [0, -.52, .02], [.16, .12, .08], [0, 0, 0], ring, false);
  }
  // His banners, hung from the dark: cream, a laurel and his name as the walls of Rome had it.
  const banner = plain('Estandarte', '#ffffff', .25);
  banner.diffuseMap = canvasTexture(256, 640, ctx => {
    ctx.fillStyle = '#1f3a6b'; ctx.fillRect(0, 0, 256, 640);
    ctx.fillStyle = '#e9e1cf'; ctx.fillRect(14, 0, 228, 600); ctx.beginPath(); ctx.moveTo(14, 600); ctx.lineTo(128, 640); ctx.lineTo(242, 600); ctx.fill();
    ctx.strokeStyle = '#2d5a9e'; ctx.lineWidth = 9; ctx.beginPath(); ctx.arc(128, 250, 72, Math.PI * .75, Math.PI * 2.25); ctx.stroke();
    ctx.fillStyle = '#2d5a9e'; for (let k = 0; k < 14; k++) { const a = Math.PI * .8 + k / 13 * Math.PI * 1.4; ctx.beginPath(); ctx.ellipse(128 + Math.cos(a) * 72, 250 + Math.sin(a) * 72, 16, 7, a + 1.2, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = '#7a2a24'; ctx.font = 'bold 46px Georgia, serif'; ctx.textAlign = 'center'; ctx.fillText('AVRELIANVS', 128, 440); ctx.font = '26px Georgia, serif'; ctx.fillText('RESTITVTOR', 128, 490);
    ctx.fillStyle = '#e8468e'; ctx.beginPath(); ctx.moveTo(14, 560); ctx.bezierCurveTo(60, 520, 90, 600, 140, 585); ctx.lineTo(140, 620); ctx.lineTo(14, 600); ctx.fill();
  }).texture;
  banner.update();
  for (const x of [-7.4, 7.4]) {
    part('Estandarte', 'plane', banner, [x, 3.9, -7.6], [1.5, 1, 3.75], [90, 0, 0], root, false);
    part('Asta', 'cylinder', steel, [x, 5.85, -7.6], [.06, 1.7, .06], [0, 0, 90], root, false);
    part('Cuerda', 'cylinder', steel, [x, 9, -7.6], [.02, 6.2, .02], [0, 0, 0], root, false);
  }

  // ── The back wall: the blue dado, the cream above it fading into the dark, the wall bars, the
  // timeline along it, the barred high windows in her plum and, over his dais, the scoreboard.
  const wallMesh = new MeshBuilder();
  wallMesh.quad([x0, 1.2, back], [x1, 1.2, back], [x1, 6, back], [x0, 6, back], [0, 0, 1], [x0, 1.2], [x1, 1.2], [x1, 6], [x0, 6]);
  addMesh('Pared', wallMesh, wall, root, false);
  const dadoMesh = new MeshBuilder();
  dadoMesh.quad([x0, 0, back + .01], [x1, 0, back + .01], [x1, 1.2, back + .01], [x0, 1.2, back + .01], [0, 0, 1], [x0, 0], [x1, 0], [x1, 1.2], [x0, 1.2]);
  addMesh('Zócalo', dadoMesh, dado, root, false);
  const dark = plain('La oscuridad de arriba', '#000000', 0);
  dark.diffuse.set(0, 0, 0); dark.emissive.set(0, 0, 0); dark.opacityMap = canvasTexture(4, 256, ctx => { const g = ctx.createLinearGradient(0, 256, 0, 0); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(255,255,255,1)'); ctx.fillStyle = g; ctx.fillRect(0, 0, 4, 256); }).texture;
  dark.opacityMapChannel = 'a'; dark.blendType = pc.BLEND_NORMAL; dark.depthWrite = false; dark.useLighting = false; dark.update();
  part('Oscuridad', 'plane', dark, [0, 6.6, back + .05], [x1 - x0, 1, 3.2], [90, 0, 0], root, false);
  // The wall bars, both sides of the dais.
  const bars = new MeshBuilder();
  for (const [a, b] of [[x0 + .3, D.x0 - 1.3], [D.x1 + 1.3, x1 - .3]] as const) {
    for (let x = a; x <= b + .01; x += 1) { bars.box([x, 1.45, back + .12], [.08, 2.9, .08]); }
    for (let y = .19; y < 2.8; y += .19) bars.box([(a + b) / 2, y, back + .12], [b - a + .1, .035, .035]);
  }
  addMesh('Espalderas', bars, pine);
  // The timeline over the wall bars: a black line, the dates and what happened, his own year in the middle.
  const timeline = plain('Línea del tiempo', '#ffffff', .2);
  timeline.diffuseMap = canvasTexture(2048, 96, ctx => {
    ctx.fillStyle = '#e8e2d4'; ctx.fillRect(0, 0, 2048, 96);
    ctx.fillStyle = '#2b2b30'; ctx.fillRect(0, 46, 2048, 4);
    ctx.textAlign = 'center'; TIMELINE.forEach(([year, what], k) => {
      const x = 90 + k * (1868 / (TIMELINE.length - 1)), his = year === '270';
      ctx.fillStyle = his ? '#7a2a24' : '#2b2b30'; ctx.fillRect(x - 2, 36, 4, 24);
      ctx.font = `${his ? 'bold ' : ''}26px Georgia, serif`; ctx.fillText(year, x, 28); ctx.font = 'italic 20px Georgia, serif'; ctx.fillText(what, x, 84);
    });
  }).texture;
  timeline.update();
  part('Línea del tiempo', 'plane', timeline, [0, 3.2, back + .03], [x1 - x0 - .4, 1, .62], [90, 0, 0], root, false);
  // High windows, barred, her plum glowing in them.
  for (let x = x0 + 2; x < x1 - 1; x += 4) {
    if (Math.abs(x) < 3) continue;
    part('Ventana alta', 'box', plum, [x, 4.6, back + .02], [2.2, .9, .02], [0, 0, 0], root, false);
    for (let k = -2; k <= 2; k++) part('Barrote', 'box', shade, [x + k * .42, 4.6, back + .06], [.04, .9, .04], [0, 0, 0], root, false);
  }
  // The scoreboard over the dais: the gym's, running his lap now.
  const score = canvasTexture(512, 192, () => {});
  const scoreMat = plain('Marcador', '#ffffff', .3);
  scoreMat.diffuseMap = score.texture; scoreMat.emissiveMap = score.texture; scoreMat.emissive.set(1, 1, 1); scoreMat.emissiveIntensity = 0; scoreMat.update();
  part('Caja del marcador', 'box', shade, [0, 1.98, back + .1], [2.5, 1.08, .18]);
  part('Marcador', 'plane', scoreMat, [0, 1.98, back + .2], [2.32, 1, .87], [90, 0, 0], root, false);
  let shown = '';
  const drawScore = (label: string, clock: string, lit: boolean) => {
    const key = `${label}|${clock}|${lit}`;
    if (key === shown) return;
    shown = key;
    score.redraw(ctx => {
      ctx.fillStyle = '#0b0c10'; ctx.fillRect(0, 0, 512, 192);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = lit ? '#ffb340' : '#3a2a18'; ctx.font = 'bold 30px "Courier New", monospace'; ctx.fillText(label, 256, 34);
      ctx.fillStyle = lit ? '#ff3b2e' : '#2a1412'; ctx.font = 'bold 112px "Courier New", monospace'; ctx.fillText(clock, 256, 122);
    });
  };
  drawScore('LLIÇÓ', '00:00', false);

  // ── Down the sides: blue mats stacked waist-high, a Swedish bench, the plint stepped into a tower, ropes from the dark.
  const mats = new MeshBuilder(), matEdges = new MeshBuilder();
  for (const side of [-1, 1]) for (let k = 0; k < 5; k++) {
    const x = side * (9.6 - (k % 2) * .2), z = -5.6 + k * 2.4, h = .9 + jitter(k * 5 + side) * .5;
    for (let y = 0; y < h; y += .22) { mats.box([x, y + .1, z], [1.8, .2, 2.1]); matEdges.box([x - side * .91, y + .1, z], [.02, .14, 2.05]); }
  }
  addMesh('Colchonetas apiladas', mats, mat); addMesh('Cantos', matEdges, matSide);
  const bench = new MeshBuilder();
  bench.box([-8.3, .42, 2.5], [.28, .05, 4]); for (const z of [.7, 4.3]) bench.box([-8.3, .21, z], [.36, .42, .06]);
  addMesh('Banco sueco', bench, pine);
  const plint = new pc.Entity('El plint'); plint.setLocalPosition(-8.2, 0, -5.8); plint.setLocalEulerAngles(0, 22, 0); root.addChild(plint);
  for (let k = 0; k < 6; k++) part('Cajón', 'box', pine, [0, .17 + k * .33, 0], [1.5 - k * .1, .32, .9 - k * .04], [0, 0, 0], plint);
  part('Cuero del plint', 'box', leather, [0, 2.05, 0], [1, .1, .66], [0, 0, 0], plint);
  part('Chicle en el asa', 'sphere', gum, [.2, 1.3, .44], [.3, .18, .12], [0, 0, 0], plint, false);
  for (const [x, z] of [[-5.6, -3.2], [6.2, -4.4], [5.4, 1]] as const) part('Cuerda', 'cylinder', plain('Cuerda', '#c8b38a', .2), [x, 6.4, z], [.07, 10.5, .07], [0, 0, 0], root, false);
  for (const [x, z, pink] of [[6.4, 4.8, false], [7.1, 5.6, true], [-6.4, 6.4, false]] as const) part('Aro', 'torus', pink ? gum : plain('Aro', '#e07a2e', .4), [x, .02, z], [.8, .8, .8], [0, 0, 0], root, false);

  // ── The tubes over the floor, row by row from the party to the dais; each lamp comes on with a
  // flicker in the entrance. One light for each row, its strength following the lamps lit in it.
  const tubeOn = plain('Tubo encendido', P.tube, .4, 2.2), tubeOff = plain('Tubo apagado', '#6a707a', .3);
  const rows = [9, 4.6, .4, -3.8], cols = [-6, 0, 6];
  const tubes = rows.flatMap((z, r) => cols.map((x, c) => {
    part('Pantalla', 'box', steel, [x, 5.45, z], [1.7, .08, .34], [0, 0, 0], root, false);
    part('Cable', 'cylinder', shade, [x, 8, z], [.015, 5, .015], [0, 0, 0], root, false);
    return { node: part('Tubo', 'box', tubeOn, [x, 5.38, z], [1.5, .07, .14], [0, 0, 0], root, false), row: r, col: c };
  }));
  const rowLights = rows.map((z, r) => light('Tubos', { type: 'omni', color: new pc.Color().fromString('#dfe9ff'), intensity: .7, range: 11, castShadows: false }, [0, 5, z - (r === 3 ? .6 : 0)]));
  // One cold spot on him, the only shadow; the plum of the windows behind; a warm pool on the dais from the old lamp over the desk.
  const SPOT = 3.6;
  const spot = light('Foco sobre Aurelià', { type: 'spot', color: new pc.Color().fromString('#f0f4ff'), intensity: SPOT, range: 18, innerConeAngle: 16, outerConeAngle: 30, castShadows: true, shadowResolution: 2048, shadowBias: .03, normalOffsetBias: .06, shadowType: pc.SHADOW_PCF3_32F }, [boss.x + 1.4, 8.4, boss.z + 4.6]);
  spot.lookAt(POCKET_AT.x + boss.x, POCKET_AT.y + 1.2, POCKET_AT.z + boss.z); spot.rotateLocal(90, 0, 0);
  const rim = light('Contraluz', { type: 'omni', color: new pc.Color().fromString('#b06a96'), intensity: .7, range: 6, castShadows: false }, [0, 3.6, back + 1.2]);
  const deskLamp = light('Lámpara de la tarima', { type: 'omni', color: new pc.Color().fromString('#ffd9a0'), intensity: .45, range: 5, castShadows: false }, [-2.75, 2.4, -6.4]);

  const P2 = kit.particles(x0, x1, z0, z1);
  for (let x = x0; x <= x1; x++) P2.mark(x, back, 6);
  for (let x = Math.ceil(D.x0); x <= D.x1; x++) for (let z = D.z0; z <= D.z1; z++) P2.mark(x, z, D.h);
  for (const x of [D.x0 - .5, D.x1 + .5]) P2.mark(x, -7, 5);
  for (let z = -6; z <= 6; z++) { P2.mark(-10, z, 1.2); P2.mark(10, z, 1.2); }

  const I = STAGE_INTRO, intro = entrance(kit);
  let time = 0, lap: { label: string; clock: string } = { label: 'LLIÇÓ', clock: '00:00' }, lit = tubes.length;
  return {
    root, centre: POCKET_AT.clone(), floorAt: () => POCKET_AT.y, world: P2.world(), contains: P2.contains,
    beginIntro() { intro.begin(); lit = 0; tubes.forEach(t => { t.node.render!.meshInstances[0].material = tubeOff; }); },
    get introTime() { return intro.time; },
    skipIntro() { intro.skip(); },
    /** The entrance's camera at `t`, given the fight's view and where the boss's face is. */
    shot(t: number, fight: pc.Vec3, height: number, face?: pc.Vec3) {
      const from = root.getPosition().clone().add(new pc.Vec3(0, .5, start - .4)), to = root.getPosition().clone().add(new pc.Vec3(0, 1.4, boss.z - .5));
      return entranceShot(t, from, to, face ?? to, fight, height);
    },
    /** Where the post's spotlight darkens round during the entrance: the scoreboard before the bell, his face after. */
    glow(t: number, face?: pc.Vec3) {
      const amount = (t < I.bang ? .35 : .4) * (1 - smooth((t - I.pull) / (I.length - I.pull)));
      return { amount, spots: t < I.bang || !face ? [] : [{ x: face.x, y: face.y, z: face.z, radius: 1.8 }] };
    },
    /**
     * His lap on the scoreboard: the lesson, the seconds left of a lap while he runs, the record in the last straight.
     * `phase` and `left` are his (`CastleMark.phase`, `.lap`); nothing once he has fallen.
     */
    setLap(phase: string | undefined, left: number | undefined, down: boolean) {
      const s = Math.max(0, Math.ceil(left ?? 0));
      lap = down ? { label: 'FINAL', clock: '--:--' } : phase === 'carrera' ? { label: 'VOLTA', clock: `00:${String(s).padStart(2, '0')}` } : phase === 'recta' ? { label: 'RÈCORD', clock: '00:00' } : { label: 'LLIÇÓ', clock: '00:00' };
    },
    update(dt: number, animate: boolean): StageCue[] {
      const cues: StageCue[] = [];
      if (!animate) { intro.end(); }
      time += dt;
      const t = animate ? intro.step(dt, cues) : undefined;
      // The tubes: row by row from the party's end, each with a stutter as it catches; all on once the entrance is over.
      const want = t === undefined ? tubes.length : Math.max(0, Math.min(tubes.length, Math.floor((t - I.light) / I.each * 3 / 2) + 1));
      if (want !== lit) {
        if (want > lit && t !== undefined) cues.push('step');
        lit = want;
      }
      tubes.forEach((tube, k) => {
        const since = t === undefined ? 9 : t - (I.light + Math.floor(k * 2 / 3) * I.each);
        const on = k < lit && (since > .18 || Math.sin(since * 90 + k) > 0);
        const m = on ? tubeOn : tubeOff;
        if (tube.node.render!.meshInstances[0].material !== m) tube.node.render!.meshInstances[0].material = m;
      });
      rowLights.forEach((l, r) => { const n = tubes.filter((tube, k) => tube.row === r && k < lit).length; l.light!.intensity = Math.max(.01, .7 * n / cols.length); });
      // The scoreboard lights with the bell; his spotlight with it, a slam that settles.
      const bell = t === undefined || t >= I.bang;
      drawScore(lap.label, lap.clock, bell);
      scoreMat.emissiveIntensity = bell ? .9 + (t !== undefined ? Math.exp(-(t - I.bang) * 4) * 1.5 : 0) : 0; scoreMat.update();
      const slam = t === undefined ? 0 : t < I.bang ? -1 : Math.exp(-(t - I.bang) * 5) * 1.4;
      spot.light!.intensity = slam < 0 ? .01 : SPOT * (1 + slam);
      rim.light!.intensity = .7 + Math.sin(time * .8) * .08;
      deskLamp.light!.intensity = t !== undefined && t < I.bang ? .01 : .45;
      return cues;
    },
    destroy() { intro.end(); kit.destroy(); },
  };
}

// ——— La sala de juntas: Direcció ———————————————————————————————————————————————————————————

const BOARD = {
  floor: { x0: -11, x1: 11, z0: -8, z1: 12 },
  back: -8, table: { z: -5.3, x0: -4.6, x1: 4.6, depth: 1.3, h: .76 },
  /** Two bays of windows either side of the pier with the seal; each bay's blind opens on its own. */
  bays: [[-10.2, -6.2], [-5.8, -1.7], [1.7, 5.8], [6.2, 10.2]] as const, sill: .7, head: 4.6,
  palette: {
    carpet: '#4b5966', carpetDark: '#3f4b57', wall: '#6f7c86', panel: '#3b302a', slat: '#d8dcd8', glare: '#eef5ff', oak: '#4e3a2c',
    leather: '#2a2422', binder: '#2f3e5c', manila: '#d6b46a', brass: '#9c8a5a', lamp: '#f2c27a', paper: '#f2efe6', ink: '#24304a',
  },
} as const;

function createJuntas(app: pc.Application, source: BossStageSource) {
  const kit = stageKit(app, 'Arena: la sala de juntas'), { root, plain, glowing, addMesh, part, light, canvasTexture, dress } = kit, P = BOARD.palette;
  kit.room('#4d5866', .3);
  const { x0, x1, z0, z1 } = BOARD.floor, back = BOARD.back, T = BOARD.table;
  const at = stand(source.cast);

  // ── The carpet: square tiles laid each way, the office's, worn down the middle.
  const carpet = plain('Moqueta', '#ffffff', .05);
  const tile = canvasTexture(256, 256, ctx => {
    ctx.fillStyle = P.carpet; ctx.fillRect(0, 0, 256, 256);
    for (const [ox, oy, flip] of [[0, 0, 0], [128, 0, 1], [0, 128, 1], [128, 128, 0]] as const) for (let k = 0; k < 900; k++) {
      ctx.fillStyle = jitter(k * 3 + ox) < .5 ? P.carpetDark : '#56636f'; const a = jitter(k + ox * 7 + oy), b = jitter(k * 11 + oy);
      ctx.fillRect(ox + (flip ? b : a) * 128, oy + (flip ? a : b) * 128, flip ? 1 : 3, flip ? 3 : 1);
    }
    ctx.strokeStyle = '#38434e'; ctx.lineWidth = 2; ctx.strokeRect(0, 0, 128, 128); ctx.strokeRect(128, 128, 128, 128); ctx.strokeRect(128, 0, 128, 128); ctx.strokeRect(0, 128, 128, 128);
  }).texture;
  tile.addressU = tile.addressV = pc.ADDRESS_REPEAT;
  carpet.diffuseMap = tile; carpet.diffuseMapTiling.set(1, 1); carpet.update();
  const ground = new MeshBuilder();
  ground.quad([x0, 0, z1], [x1, 0, z1], [x1, 0, z0], [x0, 0, z0], [0, 1, 0], [x0, z1], [x1, z1], [x1, z0], [x0, z0]);
  addMesh('Moqueta', ground, carpet, root, false);

  // ── The back wall: oak panelling to the sills, the pier with the seal and the clock, the windows.
  const wall = plain('Pared', P.wall, .15), panel = plain('Friso de roble', P.panel, .45), oak = plain('Roble', P.oak, .45);
  dress(wall, 'paret-pintada', P.wall, 2, .5);
  const panels = new MeshBuilder();
  panels.box([0, BOARD.sill / 2, back + .06], [x1 - x0, BOARD.sill, .12]);
  for (let x = x0 + .6; x < x1; x += 1.2) panels.box([x, BOARD.sill / 2, back + .13], [1, BOARD.sill - .16, .02]);
  addMesh('Friso', panels, panel);
  const walls = new MeshBuilder();
  // The wall round the windows: below them nothing (the panelling), the pier, the strips between bays and above.
  walls.quad([x0, BOARD.head, back], [x1, BOARD.head, back], [x1, 7.5, back], [x0, 7.5, back], [0, 0, 1], [x0, BOARD.head], [x1, BOARD.head], [x1, 7.5], [x0, 7.5]);
  const edges = [x0, ...BOARD.bays.flat(), x1];
  for (let k = 0; k < edges.length; k += 2) { const a = edges[k], b = edges[k + 1]; if (b - a > .01) walls.quad([a, BOARD.sill, back], [b, BOARD.sill, back], [b, BOARD.head, back], [a, BOARD.head, back], [0, 0, 1], [a, BOARD.sill], [b, BOARD.sill], [b, BOARD.head], [a, BOARD.head]); }
  addMesh('Pared del fondo', walls, wall, root, false);
  const dark = plain('La oscuridad de arriba', '#000000', 0);
  dark.opacityMap = canvasTexture(4, 256, ctx => { const g = ctx.createLinearGradient(0, 256, 0, 0); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(255,255,255,1)'); ctx.fillStyle = g; ctx.fillRect(0, 0, 4, 256); }).texture;
  dark.opacityMapChannel = 'a'; dark.blendType = pc.BLEND_NORMAL; dark.depthWrite = false; dark.useLighting = false; dark.update();
  part('Oscuridad', 'plane', dark, [0, 6.2, back + .3], [x1 - x0, 1, 3], [90, 0, 0], root, false);

  // The windows: a pale glare behind each bay, the blinds before it; closed they are one grey,
  // open they are slats with the morning between them. Each bay opens on its own in the entrance.
  const glare = plain('El día', P.glare, 0, .75), slat = plain('Lamas', '#aeb4b4', .4), frame = plain('Marco de aluminio', '#9aa3a8', .55);
  const bays = BOARD.bays.map(([a, b], k) => {
    const w = b - a, mid = (a + b) / 2, h = BOARD.head - BOARD.sill, cy = (BOARD.sill + BOARD.head) / 2;
    part('El día', 'plane', glare, [mid, cy, back - .25], [w, 1, h], [90, 0, 0], root, false);
    for (const x of [a, b]) part('Marco', 'box', frame, [x, cy, back + .04], [.08, h, .1], [0, 0, 0], root, false);
    part('Travesaño', 'box', frame, [mid, cy + .3, back + .04], [w, .06, .08], [0, 0, 0], root, false);
    const open = new MeshBuilder(), shut = new MeshBuilder();
    for (let y = BOARD.sill + .05; y < BOARD.head; y += .11) { open.box([mid, y, back + .1], [w - .12, .016, .07]); shut.box([mid, y, back + .1], [w - .12, .1, .012]); }
    const openNode = addMesh('Persiana abierta', open, slat, root, false)!, shutNode = addMesh('Persiana cerrada', shut, slat, root, false)!;
    // A sticky note of hers on the blind, here and there.
    if (k % 2) part('Pósit', 'box', plain('Pósit', '#ff6fae', .2), [mid + (jitter(k) - .5) * w * .5, 1.6 + jitter(k * 3) * 1.6, back + .16], [.14, .14, .01], [0, 0, (jitter(k * 5) - .5) * 30], root, false);
    return { openNode, shutNode, a, b, open: true };
  });
  // The morning's stripes on the carpet and the table, falling forward from the windows, and the
  // shafts of dusty light they cut through the room.
  const stripe = glowing('Franjas de luz', '#fff2d8', .28), shaft = glowing('Haz de luz', '#e6efff', .07);
  const stripes = bays.map(bay => {
    const s = new MeshBuilder(), h = new MeshBuilder(), w = bay.b - bay.a;
    for (let k = 0; k < 9; k++) {
      const za = back + .4 + k * .75, zb = za + .32, lean = (za - back) * .18;
      s.quad([bay.a + lean, .012, zb], [bay.b + lean, .012, zb], [bay.b + lean, .012, za], [bay.a + lean, .012, za], [0, 1, 0], [0, 0], [1, 0], [1, 1], [0, 1]);
    }
    h.quad([bay.a + .1, BOARD.head - .2, back + .2], [bay.b - .1, BOARD.head - .2, back + .2], [bay.b + 1.2 - .1, 0, back + 7.2], [bay.a + 1.2 + .1, 0, back + 7.2], [0, .6, 1], [0, 0], [1, 0], [1, 1], [0, 1]);
    void w;
    return { floor: addMesh('Franjas', s, stripe, root, false)!, air: addMesh('Haz', h, shaft, root, false)! };
  });

  // The pier between the bays: the school's seal, her gum across it; the clock stopped at nine over it.
  const seal = plain('Sello de la escuela', '#ffffff', .25);
  seal.diffuseMap = canvasTexture(512, 512, ctx => {
    ctx.fillStyle = '#e9e1cf'; ctx.beginPath(); ctx.arc(256, 256, 250, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = P.ink; ctx.lineWidth = 10; ctx.beginPath(); ctx.arc(256, 256, 232, 0, Math.PI * 2); ctx.stroke(); ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(256, 256, 168, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = P.ink; ctx.font = 'bold 34px Georgia, serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const ring = 'INSTITUT ESCOLA REC COMTAL · DIRECCIÓ · ';
    [...ring].forEach((ch, i) => { const a = -Math.PI / 2 + i / ring.length * Math.PI * 2; ctx.save(); ctx.translate(256 + Math.cos(a) * 200, 256 + Math.sin(a) * 200); ctx.rotate(a + Math.PI / 2); ctx.fillText(ch, 0, 0); ctx.restore(); });
    ctx.font = 'bold 120px Georgia, serif'; ctx.fillText('RC', 256, 246); ctx.font = 'italic 30px Georgia, serif'; ctx.fillText('1979', 256, 320);
    ctx.fillStyle = '#e8468e'; ctx.beginPath(); ctx.moveTo(330, 20); ctx.bezierCurveTo(420, 90, 380, 200, 470, 260); ctx.bezierCurveTo(500, 330, 440, 330, 452, 400); ctx.lineTo(500, 380); ctx.lineTo(512, 0); ctx.fill();
  }).texture;
  seal.opacityMap = seal.diffuseMap; seal.blendType = pc.BLEND_NORMAL; seal.update();
  part('Sello de la escuela', 'plane', seal, [0, 2.15, back + .08], [1.75, 1, 1.75], [90, 0, 0], root, false);
  part('Chicle sobre el sello', 'sphere', plain('Su chicle', '#e8468e', .55), [.72, 2.85, back + .12], [.36, .22, .1], [0, 0, -25], root, false);
  const clock = plain('Reloj', '#ffffff', .4);
  clock.diffuseMap = canvasTexture(256, 256, ctx => {
    ctx.fillStyle = '#f4f2ea'; ctx.beginPath(); ctx.arc(128, 128, 124, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#222'; ctx.lineWidth = 8; ctx.stroke();
    for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2; ctx.lineWidth = k % 3 ? 3 : 7; ctx.beginPath(); ctx.moveTo(128 + Math.cos(a) * 100, 128 + Math.sin(a) * 100); ctx.lineTo(128 + Math.cos(a) * 114, 128 + Math.sin(a) * 114); ctx.stroke(); }
    ctx.lineWidth = 9; ctx.beginPath(); ctx.moveTo(128, 128); ctx.lineTo(128 - 62, 128); ctx.stroke(); ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(128, 128); ctx.lineTo(128, 128 - 92); ctx.stroke();
  }).texture;
  clock.opacityMap = clock.diffuseMap; clock.blendType = pc.BLEND_NORMAL; clock.update();
  // The clock, stopped at nine as the secretaría's, on the left bay's end of the shelves.
  part('Reloj parado a las nueve', 'plane', clock, [-9.72, 2.5, -2.2], [.6, 1, .6], [90, 90, 0], root, false);

  // ── The long table behind them, its three chairs pushed back (they have stood up), three lamps,
  // the book of minutes open in the middle with the stamp and her pink ink.
  const table = new MeshBuilder();
  table.box([0, T.h - .03, T.z], [T.x1 - T.x0, .06, T.depth]);
  table.box([0, T.h / 2, T.z + T.depth / 2 - .08], [T.x1 - T.x0 - .2, T.h - .1, .05]);
  for (const x of [T.x0 + .15, T.x1 - .15]) table.box([x, T.h / 2, T.z], [.1, T.h - .06, T.depth - .1]);
  addMesh('Mesa de juntas', table, oak);
  const leather = plain('Piel', P.leather, .5), brass = plain('Latón', P.brass, .6), paper = plain('Papel', P.paper, .2), manila = plain('Carpetas', P.manila, .25);
  const seats = [-3, 0, 3].map((x, k) => {
    const chair = new pc.Entity('Butaca'); chair.setLocalPosition(x, 0, T.z - 1.25 - (k === 1 ? .15 : 0)); chair.setLocalEulerAngles(0, (k - 1) * -9, 0); root.addChild(chair);
    part('Asiento', 'box', leather, [0, .5, 0], [.66, .14, .62], [0, 0, 0], chair);
    part('Respaldo', 'box', leather, [0, 1.25, -.28], [.66, k === 1 ? 1.5 : 1.3, .14], [-6, 0, 0], chair);
    part('Pie', 'cylinder', brass, [0, .24, 0], [.08, .44, .08], [0, 0, 0], chair);
    part('Base', 'cylinder', plain('Base', '#1c1c20', .4), [0, .04, 0], [.62, .05, .62], [0, 0, 0], chair);
    // Her lamp over her place, and her folders.
    const lamp = new pc.Entity('Lámpara'); lamp.setLocalPosition(x + (k === 1 ? -.9 : .6), T.h, T.z - .2); root.addChild(lamp);
    part('Pie de lámpara', 'cylinder', brass, [0, .02, 0], [.22, .04, .22], [0, 0, 0], lamp);
    part('Brazo', 'cylinder', brass, [0, .25, 0], [.03, .5, .03], [0, 0, 0], lamp);
    const shade = part('Pantalla', 'cone', plain('Pantalla', '#2f4f46', .5), [0, .5, .08], [.36, .24, .36], [-30, 0, 0], lamp);
    const bulb = part('Bombilla', 'sphere', plain('Bombilla', P.lamp, .3, 2), [0, .45, .12], [.12, .12, .12], [0, 0, 0], lamp, false);
    const glow = light('Lámpara de la mesa', { type: 'omni', color: new pc.Color().fromString('#ffcf8a'), intensity: .01, range: 3.4, castShadows: false }, [x + (k === 1 ? -.9 : .6), T.h + .4, T.z]);
    for (let f = 0; f < 4; f++) part('Carpeta', 'box', manila, [x - .3 + (k === 1 ? .6 : 0), T.h + .02 + f * .03, T.z + .1], [.36, .025, .48], [0, f * 9 - 12, 0]);
    void shade;
    return { lamp, bulb, glow, on: false, x };
  });
  // The book of minutes: open between them, a line for each signature, her stamp beside it.
  const book = canvasTexture(512, 256, () => {});
  const bookMat = plain("Llibre d'actes", '#ffffff', .2); bookMat.diffuseMap = book.texture; bookMat.update();
  part("Llibre d'actes", 'plane', bookMat, [0, T.h + .045, T.z + .1], [1.1, 1, .55], [0, 0, 0], root, false);
  part('Tapas', 'box', plain('Tapas', '#5a1f22', .4), [0, T.h + .02, T.z + .1], [1.16, .04, .6]);
  part('Tampón', 'box', plain('Tampón', '#1c1c20', .4), [.85, T.h + .03, T.z + .2], [.3, .04, .2]);
  part('Tinta', 'box', plain('Su tinta', '#ff3d8b', .7), [.85, T.h + .052, T.z + .2], [.25, .008, .15], [0, 0, 0], root, false);
  const stamp = new pc.Entity('El sello de goma'); stamp.setLocalPosition(.5, T.h + .5, T.z + .1); root.addChild(stamp);
  part('Mango', 'cylinder', plain('Mango', '#2a2422', .5), [0, .12, 0], [.08, .18, .08], [0, 0, 0], stamp);
  part('Base del sello', 'box', plain('Madera del sello', '#7a5a3a', .4), [0, 0, 0], [.24, .06, .14], [0, 0, 0], stamp);
  let page = '';
  const drawBook = (signed: number, stamped: boolean) => {
    const key = `${signed}|${stamped}`;
    if (key === page) return;
    page = key;
    book.redraw(ctx => {
      ctx.fillStyle = P.paper; ctx.fillRect(0, 0, 512, 256); ctx.fillStyle = '#d8d3c4'; ctx.fillRect(254, 0, 4, 256);
      ctx.fillStyle = '#9aa0a8'; for (let y = 30; y < 230; y += 14) { ctx.fillRect(24, y, 210, 1); ctx.fillRect(276, y, 210, 1); }
      ctx.fillStyle = P.ink; ctx.font = 'bold 20px Georgia, serif'; ctx.fillText('ACTA', 28, 24);
      for (let k = 0; k < 3; k++) {
        const y = 80 + k * 56; ctx.fillStyle = '#9aa0a8'; ctx.fillRect(300, y, 170, 2);
        if (k < signed) { ctx.strokeStyle = '#d1306f'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(304, y - 4); for (let s = 0; s < 8; s++) ctx.quadraticCurveTo(312 + s * 18, y - 30 + (s % 2) * 26, 322 + s * 18, y - 8); ctx.stroke(); }
      }
      if (stamped) { ctx.save(); ctx.translate(130, 150); ctx.rotate(-.18); ctx.strokeStyle = '#ff3d8b'; ctx.fillStyle = '#ff3d8b'; ctx.lineWidth = 5; ctx.strokeRect(-100, -34, 200, 68); ctx.font = 'bold 26px "Courier New", monospace'; ctx.textAlign = 'center'; ctx.fillText('CONSTA', 0, -6); ctx.fillText('EN ACTA', 0, 22); ctx.restore(); }
    });
  };
  drawBook(0, false);

  // ── Down the sides: binders by school year on tall shelves, running into the dark.
  const shelves = new MeshBuilder(), spines = new MeshBuilder(), labels = new MeshBuilder();
  for (const side of [-1, 1]) {
    const x = side * 10.2;
    for (let z = -7.4; z < 4; z += 1.9) {
      for (let y = 0; y <= 3.2; y += .8) shelves.box([x, y + .03, z], [.4, .04, 1.8]);
      shelves.box([x - side * .19, 1.8, z], [.02, 3.6, 1.8]);
      for (let y = .07; y < 3.2; y += .8) for (let k = 0; k < 18; k++) {
        if (jitter(k + y * 9 + z) < .08) continue;
        const h = .62 + jitter(k * 3 + z) * .08, zz = z - .82 + k * .096;
        spines.box([x + side * .02, y + h / 2, zz], [.32, h, .08]);
        labels.box([x + side * -.17, y + h * .65, zz], [.01, .1, .06]);
      }
    }
  }
  addMesh('Estanterías', shelves, oak); addMesh('Archivadores', spines, plain('Archivadores', P.binder, .35)); addMesh('Etiquetas', labels, paper, root, false);
  // A coat stand and a water cooler on the camera's right, the room's own.
  part('Perchero', 'cylinder', brass, [8.4, 1, -6.6], [.06, 2, .06]);
  part('Abrigo', 'cone', plain('Abrigo', '#5b5f66', .3), [8.4, 1.5, -6.55], [.5, .9, .3], [0, 0, 180]);
  part('Garrafa', 'cylinder', plain('Garrafa', '#9ec7e0', .9), [-8.4, 1.25, -6.6], [.34, .5, .34]);
  part('Fuente', 'box', plain('Fuente', '#e4e4e0', .4), [-8.4, .5, -6.6], [.36, 1, .34]);

  // ── Light: the morning through the blinds from behind them (the shadow-caster, long shadows
  // towards the party), a cold fill, the three lamps, a pool on the party.
  const SUN = 2.3;
  const sun = light('La mañana por las persianas', { type: 'spot', color: new pc.Color().fromString('#fff0d6'), intensity: SUN, range: 26, innerConeAngle: 28, outerConeAngle: 46, castShadows: true, shadowResolution: 2048, shadowBias: .03, normalOffsetBias: .06, shadowType: pc.SHADOW_PCF3_32F }, [1.2, 7.2, back - 2.5]);
  sun.lookAt(POCKET_AT.x + at.foe.x, POCKET_AT.y, POCKET_AT.z + at.foe.z + 2.4); sun.rotateLocal(90, 0, 0);
  const fill = light('Luz de la sala', { type: 'omni', color: new pc.Color().fromString('#a8b8cc'), intensity: .55, range: 14, castShadows: false }, [at.party.x, 4.5, at.party.z - 1]);

  const P2 = kit.particles(x0, x1, z0, z1);
  for (let x = x0; x <= x1; x++) P2.mark(x, back, 7.5);
  for (let x = Math.ceil(T.x0); x <= T.x1; x++) P2.mark(x, Math.round(T.z), T.h);
  for (let z = -7; z <= 3; z++) { P2.mark(-10, z, 3.6); P2.mark(10, z, 3.6); }

  const I = STAGE_INTRO, intro = entrance(kit);
  /** The lamps come on one after another just before the stamp; each goes out with her. */
  const LAMPS_AT = [I.bang - .75, I.bang - .5, I.bang - .25];
  let time = 0, opened = bays.length, up: boolean[] = [true, true, true], signed = 0;
  const setBay = (k: number, open: boolean) => { const b = bays[k]; if (b.open === open) return; b.open = open; b.openNode.enabled = open; b.shutNode.enabled = !open; };
  bays.forEach((_, k) => setBay(k, true));
  return {
    root, centre: POCKET_AT.clone(), floorAt: () => POCKET_AT.y, world: P2.world(), contains: P2.contains,
    beginIntro() { intro.begin(); opened = 0; bays.forEach((_, k) => { bays[k].open = true; setBay(k, false); }); },
    get introTime() { return intro.time; },
    skipIntro() { intro.skip(); },
    shot(t: number, fight: pc.Vec3, height: number, face?: pc.Vec3) {
      const from = root.getPosition().clone().add(new pc.Vec3(at.party.x, .6, at.party.z + 1)), to = root.getPosition().clone().add(new pc.Vec3(0, 1.4, T.z + .4));
      return entranceShot(t, from, to, face ?? to, fight, height);
    },
    glow(t: number, face?: pc.Vec3) {
      const amount = (t < I.bang ? .3 : .38) * (1 - smooth((t - I.pull) / (I.length - I.pull)));
      const book = root.getPosition().clone().add(new pc.Vec3(0, T.h, T.z));
      return { amount, spots: t < I.bang || !face ? [{ x: book.x, y: book.y, z: book.z, radius: 1.6 }] : [{ x: face.x, y: face.y, z: face.z, radius: 2.4 }] };
    },
    /** Who of the three still stands (Mar, Montse, Pilar: their lamps), and how many have signed the Acta. */
    setTeam(standing: boolean[], firmas: number) { up = standing; signed = firmas; },
    update(dt: number, animate: boolean): StageCue[] {
      const cues: StageCue[] = [];
      if (!animate) intro.end();
      time += dt;
      const t = animate ? intro.step(dt, cues) : undefined;
      // The blinds, bay by bay from the outside in.
      const order = [0, 3, 1, 2];
      const want = t === undefined ? bays.length : Math.max(0, Math.min(bays.length, Math.floor((t - I.light) / (I.each * 2.2)) + 1));
      if (want !== opened) { if (want > opened && t !== undefined) cues.push('step'); opened = want; }
      order.forEach((k, n) => setBay(k, n < opened));
      bays.forEach((b, k) => { stripes[k].floor.enabled = b.open; stripes[k].air.enabled = b.open; });
      sun.light!.intensity = Math.max(.01, SUN * opened / bays.length);
      // The three lamps: on one after another before the stamp, out with whoever has fallen; a signature makes hers flare.
      seats.forEach((s, k) => {
        const on = (t === undefined || t >= LAMPS_AT[k]) && up[k] !== false;
        if (on !== s.on) { s.on = on; s.bulb.enabled = on; if (on && t !== undefined) cues.push('lamp'); }
        const flare = k < signed ? .35 + Math.max(0, Math.sin(time * 3 + k)) * .15 : 0;
        s.glow.light!.intensity = on ? .9 + flare : .01;
      });
      // The stamp: lifted, then down on the book at the blow; the book shows the signatures, and the stamp once it fell.
      const drop = t === undefined ? 1 : smooth((t - (I.bang - .3)) / .3) ** 2;
      stamp.setLocalPosition(t === undefined || t < I.bang + .6 ? -.2 : .5, T.h + pc.math.lerp(.6, .09, drop), T.z + .1);
      drawBook(signed, t === undefined || t >= I.bang);
      fill.light!.intensity = .55;
      return cues;
    },
    destroy() { intro.end(); kit.destroy(); },
  };
}
