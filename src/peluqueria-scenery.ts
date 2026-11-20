import * as pc from 'playcanvas';
import type { Cell } from './movement';
import { FURNITURE, PLACES_LUCA } from './friends/luca';

/** What of the salon depends on the mission's run: the queues (the cells each still stands on: all of it, or its two ends once it has `moved` on), the nave's mirrors as they stand and the light they carry. */
export interface SalonState {
  queues: { cells: Cell[]; moved: boolean }[];
  mirrors: { cell: Cell; facing: 0 | 1 }[];
  /** The window's beam: where it comes in and which way, every cell it crosses, and whether it reached the chaplains' chairs. */
  beam: { path: Cell[]; hit: boolean; dir: Cell };
}

/** The nave's blocks of chairs on the plan (BASILICA_PLAN's `h`): five cells along x from each, four along z from each row. */
const BLOCKS = { xs: [3, 9, 15], zs: [16, 21] } as const;
/** The block the chaplains stand in, waiting: left clear of chairs. */
const CLEARING = { x: 9, z: 16 } as const;
/** The presbytery's floor, two steps up (src/basilica-scenery.ts), in cells. */
const DAIS = .4;

/**
 * Fran's salon inside the Sagrada Família (docs/quests/luca.md § La Sagrada peluquería), set over the
 * basilica while the mission runs and gone once Fran is beaten. More salon the deeper in: by the door
 * a reception desk before its black wall with his name, the appointment book and the turn's number;
 * in the nave, where the wooden chairs were, rows of salon chairs back to back with their mirrors;
 * along the Passion arm, a dye bar whose bowls carry Luca's colours; in the apse, Luca's lenses and
 * star charts on stands, turned on the columns; on the presbytery, Fran's own chair under a hood
 * dryer of straight rods that make a hyperboloid, and his slate of chalk curves.
 * Across the way, the queues of grey visitors behind their belts, every one looking at Fran; in the
 * nave, the three mirrors that turn and the window's light they carry.
 * Black, chrome and white, the salon's; the colours are Luca's; no pink and no violet. Sizes in cells
 * (1.5 m), as the plan. Everything that does not change is batched by material, so the whole salon
 * costs a handful of draw calls.
 */
export function buildSalon(app: pc.AppBase, parent: pc.Entity, toWorld: (px: number, pz: number) => pc.Vec3, state: SalonState) {
  const root = new pc.Entity('La peluquería de Fran'); parent.addChild(root);
  const batch = app.batcher.addGroup('La peluquería de Fran', false, 30);
  const materials: pc.StandardMaterial[] = [], textures: pc.Texture[] = [];
  const mat = (name: string, hex: string, gloss = .4, glow = 0, opacity = 1) => {
    const m = new pc.StandardMaterial(); m.name = name; m.diffuse.fromString(hex); m.gloss = gloss; m.useMetalness = false;
    if (glow) { m.emissive.fromString(hex); m.emissiveIntensity = glow; }
    if (opacity < 1) { m.opacity = opacity; m.blendType = pc.BLEND_NORMAL; m.depthWrite = false; }
    m.update(); materials.push(m); return m;
  };
  /** A material painted on a canvas (a sign, a chart, a slate), glowing by `glow`. */
  const painted = (name: string, w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void, glow = 0) => {
    const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d')!);
    const t = new pc.Texture(app.graphicsDevice, { width: w, height: h, mipmaps: true, anisotropy: 8, addressU: pc.ADDRESS_CLAMP_TO_EDGE, addressV: pc.ADDRESS_CLAMP_TO_EDGE });
    t.setSource(c); textures.push(t);
    const m = mat(name, '#ffffff', .3); m.diffuseMap = t;
    if (glow) { m.emissiveMap = t; m.emissive.set(1, 1, 1); m.emissiveIntensity = glow; }
    m.update(); return m;
  };
  const black = mat('Cuero negro', '#18181c', .55), chrome = mat('Cromado', '#d9dde4', .9), white = mat('Lacado blanco', '#f4f2ec', .6);
  const glass = mat('Espejo', '#a9cbe0', .98, .22), glint = mat('Brillo del espejo', '#ffffff', .9, 1.1), paper = mat('Papel', '#efe8d6', .2), brass = mat('Latón', '#c89a3a', .85);
  const lensGlass = mat('Lente de Luca', '#e9f3ff', .95, .5, .8);

  type Kind = pc.RenderComponent['type'];
  interface Look { shadows?: boolean; batched?: boolean }
  /** A primitive under `into`, in its frame: `p` its place, `s` its size, `r` its turn. */
  function local(into: pc.Entity, name: string, type: Kind, m: pc.Material, p: number[], s: number[], r: number[] = [0, 0, 0], { shadows = true, batched = true }: Look = {}) {
    const e = new pc.Entity(name);
    e.addComponent('render', { type, material: m, castShadows: shadows, ...batched ? { batchGroupId: batch.id } : {} });
    e.setLocalPosition(p[0], p[1], p[2]); e.setLocalScale(s[0], s[1], s[2]); e.setLocalEulerAngles(r[0], r[1], r[2]);
    into.addChild(e); return e;
  }
  /** A primitive at cell (`px`, `pz`), `y` up, sized in cells. */
  function part(name: string, type: Kind, m: pc.Material, px: number, pz: number, y: number, s: number[], r: number[] = [0, 0, 0], look: Look = {}) {
    const at = toWorld(px, pz);
    return local(root, name, type, m, [at.x, y, at.z], s, r, look);
  }
  /** A frame at cell (`px`, `pz`), `y` up, turned `yaw` degrees (0: its front to +z, towards the camera) and `scale` big: what is built in it turns with it. */
  function frame(name: string, px: number, pz: number, yaw = 0, y = 0, scale = 1) {
    const e = new pc.Entity(name), at = toWorld(px, pz);
    e.setLocalPosition(at.x, y, at.z); e.setLocalEulerAngles(0, yaw, 0); e.setLocalScale(scale, scale, scale);
    root.addChild(e); return e;
  }
  /** A thin bar from `a` to `b` (world), `w` thick. */
  function rod(name: string, m: pc.Material, a: pc.Vec3, b: pc.Vec3, w: number, look: Look = {}) {
    const e = new pc.Entity(name);
    e.addComponent('render', { type: 'box', material: m, castShadows: look.shadows ?? true, ...(look.batched ?? true) ? { batchGroupId: batch.id } : {} });
    root.addChild(e);
    e.setPosition(new pc.Vec3().add2(a, b).mulScalar(.5)); e.lookAt(b); e.setLocalScale(w, w, a.distance(b));
    return e;
  }
  /** The yaw that turns a frame's front from (`px`, `pz`) towards (`tx`, `tz`). */
  const towards = (px: number, pz: number, tx: number, tz: number) => Math.atan2(tx - px, tz - pz) * 180 / Math.PI;

  /** A salon chair, sitting towards its frame's back (−z): a chrome foot and column, black leather, chrome arms and footrest. */
  function chair(px: number, pz: number, yaw = 0, y = 0) {
    const c = frame('Sillón de peluquería', px, pz, yaw, y, 1.12);
    local(c, 'Pie', 'cylinder', chrome, [0, .04, 0], [.4, .08, .4]);
    local(c, 'Columna', 'cylinder', chrome, [0, .2, 0], [.09, .3, .09]);
    local(c, 'Asiento', 'box', black, [0, .38, 0], [.44, .1, .42]);
    local(c, 'Respaldo', 'box', black, [0, .64, .2], [.44, .48, .08], [8, 0, 0]);
    local(c, 'Reposacabezas', 'box', black, [0, .95, .24], [.26, .14, .07], [8, 0, 0]);
    for (const dx of [-.25, .25]) local(c, 'Brazo', 'box', chrome, [dx, .52, 0], [.05, .05, .36]);
    local(c, 'Reposapiés', 'box', chrome, [0, .14, -.3], [.32, .03, .1]);
  }

  // ------------------------------------------------------------ la recepción, by the Nativity door
  // A desk with its front to the door and, behind it, a black wall with his name and the turn's number:
  // the first thing seen coming in, in a church that is still a church round it.
  {
    const { x, z } = FURNITURE.desk;
    const name = painted('Rótulo de la recepción', 512, 256, ctx => {
      ctx.fillStyle = '#131316'; ctx.fillRect(0, 0, 512, 256);
      ctx.fillStyle = '#f4f2ec'; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      ctx.font = '300 132px "Helvetica Neue", Arial, sans-serif';
      // Letter by letter, wide apart: a salon's name.
      [...'FRAN'].forEach((letter, i) => ctx.fillText(letter, 30 + i * 78, 150));
      ctx.fillRect(34, 172, 292, 3);
      ctx.font = '500 26px "Helvetica Neue", Arial, sans-serif'; ctx.fillText('P E L U Q U E R Í A', 34, 214);
      // The turn's number: nobody's.
      ctx.strokeStyle = '#ffb347'; ctx.lineWidth = 4; ctx.strokeRect(368, 52, 118, 152);
      ctx.fillStyle = '#ffb347'; ctx.textAlign = 'center';
      ctx.font = '700 22px "Helvetica Neue", Arial, sans-serif'; ctx.fillText('SU TURNO', 427, 88);
      ctx.font = '700 76px "Helvetica Neue", Arial, sans-serif'; ctx.fillText('– –', 427, 172);
    }, .85);
    part('Pared de la recepción', 'box', black, x, z - .58, 1.05, [3.0, 2.1, .1]);
    part('Rótulo «Fran»', 'box', name, x, z - .52, 1.42, [2.6, 1.3, .02], [0, 0, 0], { shadows: false, batched: false });
    part('Mostrador', 'box', white, x, z, .37, [2.8, .74, .62]);
    part('Encimera', 'box', black, x, z, .765, [2.9, .05, .7]);
    part('Zócalo del mostrador', 'box', chrome, x, z + .32, .06, [2.8, .12, .02]);
    // On it: the appointment book open, a bell, the turns' dispenser.
    const book = frame('Agenda', x - .3, z + .05, -14, .8);
    for (const side of [-1, 1]) local(book, 'Hoja de la agenda', 'box', paper, [side * .17, 0, 0], [.32, .03, .42], [0, 0, side * -5]);
    local(book, 'Lomo de la agenda', 'box', black, [0, -.01, 0], [.04, .04, .44]);
    part('Timbre', 'sphere', chrome, x + .5, z + .1, .8, [.16, .12, .16]);
    part('Dispensador de turnos', 'box', mat('Dispensador de turnos', '#c8382e', .5), x + 1.05, z + .08, .9, [.2, .24, .2]);
    part('Número de turno', 'box', paper, x + 1.05, z + .2, .86, [.08, .12, .02], [-20, 0, 0], { shadows: false });
  }

  // ------------------------------------------------------------ the queues
  // Grey visitors in file behind a black belt on chrome posts, every one looking at the presbytery,
  // where Fran is. A queue that has moved on is only its two ends, bunched up by the walls: the way
  // is open through its middle.
  const belt = mat('Cinta de la cola', '#1c1c20', .5);
  const greys = ['#a6a39b', '#8b8880', '#b8b5ad', '#7a7770'].map((hex, i) => mat(`Abrigo gris ${i}`, hex, .15));
  const legs = [mat('Pantalón gris', '#5e5c57', .15), mat('Pantalón gris claro', '#6f6d67', .15)];
  const greySkin = mat('Piel gris', '#c9c5bc', .2), greyHair = [mat('Pelo gris', '#55534f', .2), mat('Pelo gris claro', '#8f8c85', .2)];
  /** One of them, as tall as anybody, in the game's block figures: all grey, down to the skin. */
  function visitor(px: number, pz: number, yaw: number, k: number) {
    const v = frame('Visitante gris', px, pz, yaw, 0, .93 + (k * 37 % 12) / 100);
    const coat = greys[k % greys.length], trousers = legs[k % 2];
    for (const side of [-1, 1]) {
      local(v, 'Pierna', 'box', trousers, [side * .09, .28, 0], [.13, .56, .15]);
      local(v, 'Brazo', 'box', coat, [side * .235, .78, 0], [.1, .42, .12]);
    }
    local(v, 'Abrigo', 'box', coat, [0, .78, 0], [.37, .47, .21]);
    local(v, 'Cabeza', 'sphere', greySkin, [0, 1.15, 0], [.28, .3, .28]);
    local(v, 'Pelo', 'sphere', greyHair[(k >> 1) % 2], [0, 1.23, -.03], [.3, .2, .3]);
  }
  function post(px: number, pz: number) {
    part('Poste', 'cylinder', chrome, px, pz, .32, [.06, .64, .06]);
    part('Base del poste', 'cylinder', chrome, px, pz, .02, [.26, .04, .26]);
    part('Cabeza del poste', 'cylinder', belt, px, pz, .66, [.1, .07, .1]);
  }
  const fran = PLACES_LUCA.fran;
  let count = 0;
  for (const queue of state.queues) {
    const cells = queue.cells;
    if (cells.length < 2) continue;
    // The belt runs on the side the party comes from: towards the crossing.
    const column = cells[0].x === cells[1].x;
    const ox = column ? Math.sign(fran.x - cells[0].x) * .36 : 0, oz = column ? 0 : Math.sign(fran.z - cells[0].z) * .36;
    cells.forEach((c, i) => {
      const next = cells[i + 1], joined = !!next && Math.abs(next.x - c.x) + Math.abs(next.z - c.z) === 1;
      if (i % 2 === 0 || !joined) post(c.x + ox, c.z + oz);
      if (joined) {
        const a = toWorld(c.x + ox, c.z + oz), b = toWorld(next.x + ox, next.z + oz); a.y = b.y = .6;
        rod('Cinta', belt, a, b, .05, { shadows: false }).setLocalScale(.02, .07, a.distance(b));
      }
      // Someone every other cell, a little out of line, as people stand; closer together in what is left of one that moved on.
      if (i % 2 === 1 || queue.moved) {
        const k = count++, px = c.x - ox * .5 + ((k * 53 % 9) - 4) * .03, pz = c.z - oz * .5 + ((k * 31 % 9) - 4) * .03;
        visitor(px, pz, towards(px, pz, fran.x, fran.z) + ((k * 17 % 7) - 3) * 4, k);
      }
    });
  }

  // ------------------------------------------------------------ los sillones, in the nave
  // Where the church's wooden chairs were (src/basilica-scenery.ts takes them away meanwhile): in each
  // block, a spine of mirrors back to back, and a salon chair before each glass.
  for (const x0 of BLOCKS.xs) for (const z0 of BLOCKS.zs) {
    if (x0 === CLEARING.x && z0 === CLEARING.z) continue;
    const mz = z0 + 1.5;
    part('Peana de los espejos', 'box', black, x0 + 2, mz, .05, [4.6, .1, .3]);
    for (const dx of [.5, 2, 3.5]) {
      const mx = x0 + dx;
      part('Marco del espejo', 'box', black, mx, mz, .82, [1.0, 1.5, .1]);
      for (const side of [-1, 1]) {
        part('Luna', 'box', glass, mx, mz + side * .055, .86, [.86, 1.3, .02], [0, 0, 0], { shadows: false });
        part('Brillo de la luna', 'box', glint, mx - .16, mz + side * .068, .92, [.05, 1.0, .005], [0, 0, 22], { shadows: false });
        part('Repisa', 'box', chrome, mx, mz + side * .2, .5, [.9, .04, .22]);
        chair(mx, mz + side * .95, side < 0 ? 180 : 0);
      }
    }
  }

  // ------------------------------------------------------------ the nave's turning mirrors and the window's light
  // Three tall mirrors on wheeled stands (src/espejos.ts), turned along `\` or `/`: chrome frames,
  // the glass the church's blue with a streak of light across it.
  for (const m of state.mirrors) {
    const stand = frame('Espejo giratorio', m.cell.x, m.cell.z, m.facing === 0 ? -45 : 45);
    local(stand, 'Pie del espejo', 'box', chrome, [0, .05, 0], [1.2, .06, .12]);
    local(stand, 'Travesaño del pie', 'box', chrome, [0, .05, 0], [.12, .06, .7]);
    local(stand, 'Marco', 'box', chrome, [0, .95, 0], [1.22, 1.62, .08]);
    local(stand, 'Luna', 'box', glass, [0, .95, 0], [1.08, 1.48, .1], [0, 0, 0], { shadows: false });
    for (const [dx, w, h] of [[-.26, .05, 1.15], [-.14, .025, .95]]) local(stand, 'Brillo', 'box', glint, [dx, 1.0, 0], [w, h, .11], [0, 0, 22], { shadows: false });
  }
  // The light, from the window down to the first mirror and on from mirror to mirror: a bright shaft
  // at chest height and its stripe on the floor, which is what reads from the high camera.
  const shaft = mat('Rayo de la vidriera', '#fff4d6', .2, 2.8, .75), stripe = mat('Luz del rayo en el suelo', '#ffe7a8', .1, 1.9, .6), flare = mat('Destello en el espejo', '#fff4d6', .2, 2.6, .7);
  const unbatched = { shadows: false, batched: false };
  const path = state.beam.path;
  const corners = path.filter((c, i) => i === 0 || i === path.length - 1 || ((path[i + 1].x - c.x) !== (c.x - path[i - 1].x) || (path[i + 1].z - c.z) !== (c.z - path[i - 1].z)));
  if (path.length) {
    // Down from the glass, high in the wall behind where it comes in.
    const from = path[0], low = toWorld(from.x, from.z), high = toWorld(from.x - state.beam.dir.x * 1.6, from.z - state.beam.dir.z * 1.6);
    low.y = 1.05; high.y = 4.6;
    rod('Rayo desde la vidriera', shaft, high, low, .22, unbatched);
  }
  for (let i = 0; i + 1 < corners.length; i++) {
    const a = corners[i], b = corners[i + 1], dx = b.x - a.x, dz = b.z - a.z, len = Math.hypot(dx, dz);
    part('Rayo', 'box', shaft, (a.x + b.x) / 2, (a.z + b.z) / 2, 1.05, [dx ? len : .18, .18, dz ? len : .18], [0, 0, 0], unbatched);
    part('Franja de luz', 'box', stripe, (a.x + b.x) / 2, (a.z + b.z) / 2, .045, [dx ? len : .7, .02, dz ? len : .7], [0, 0, 0], unbatched);
    if (i) part('Destello en el espejo', 'sphere', flare, a.x, a.z, 1.05, [.5, .5, .5], [0, 0, 0], unbatched);
  }
  const end = path.at(-1);
  if (end) {
    // Where it ends: a pale patch on a wall, or the chaplains' chairs lit gold.
    const lit = state.beam.hit;
    part(lit ? 'Luz en los sillones' : 'Luz en la pared', 'sphere', mat('Destello', lit ? '#ffd84f' : '#fff4d6', .2, lit ? 3 : 1.6, .8), end.x, end.z, 1.05, lit ? [1.6, .9, 1.6] : [.6, .6, .6], [0, 0, 0], unbatched);
    if (lit) part('Luz en el suelo de los sillones', 'cylinder', mat('Charco de luz', '#ffd84f', .1, 2, .5), end.x, end.z, .05, [4.2, .02, 2.2], [0, 0, 0], unbatched);
  }

  // ------------------------------------------------------------ la carta de colores, along the Passion arm
  // A long dye bar against the end wall, its bowls in Luca's colours, a brush in each.
  {
    const { from, to, z } = FURNITURE.bar, mid = (from + to) / 2, length = to - from + .6;
    part('Barra de tintes', 'box', white, mid, z + .1, .45, [length, .9, .6]);
    part('Encimera de la barra', 'box', black, mid, z + .1, .92, [length + .2, .05, .68]);
    part('Zócalo de la barra', 'box', chrome, mid, z + .41, .06, [length, .12, .02]);
    ['#e8503a', '#ff8f3f', '#ffd84f', '#4fbf7a', '#4f9fe8', '#2f8f7a', '#f08a2c', '#f1ece2'].forEach((hex, i) => {
      const bowl = mat(`Cuenco de tinte ${i}`, hex, .5, .2), px = from + 1 + i * 1.5;
      part('Cuenco de tinte', 'cylinder', bowl, px, z + .1, 1.01, [.4, .14, .4]);
      part('Pincel', 'box', black, px + .2, z + .1, 1.14, [.03, .28, .03], [0, 0, 20]);
    });
  }

  // ------------------------------------------------------------ el ábside: Luca's lenses and star charts
  // Each lens in a brass ring on a stand, turned on the presbytery (on the columns, not the sky); each
  // chart of stars on an easel, facing the camera.
  for (const { x, z } of FURNITURE.lenses) {
    const stand = frame('Lente de Luca', x, z, towards(x, z, fran.x, fran.z));
    local(stand, 'Pie de la lente', 'cylinder', brass, [0, .55, 0], [.06, 1.1, .06]);
    for (let k = 0; k < 3; k++) local(stand, 'Pata', 'box', brass, [Math.sin(k * 2.094) * .18, .08, Math.cos(k * 2.094) * .18], [.04, .04, .4], [0, k * 120, 0]);
    local(stand, 'Aro', 'cylinder', brass, [0, 1.3, 0], [.8, .07, .8], [90, 0, 0]);
    local(stand, 'Lente', 'cylinder', lensGlass, [0, 1.3, 0], [.68, .09, .68], [90, 0, 0], unbatched);
  }
  const chart = painted('Carta de estrellas', 256, 192, ctx => {
    ctx.fillStyle = '#16233d'; ctx.fillRect(0, 0, 256, 192);
    ctx.strokeStyle = '#8fa6cf'; ctx.lineWidth = 1; ctx.strokeRect(8, 8, 240, 176);
    // A few stars joined in a line, the rest loose; the same chart on each easel.
    const stars = Array.from({ length: 26 }, (_, k) => [20 + (k * 89) % 216, 18 + (k * 53) % 156, 1.2 + (k % 4) * .7]);
    ctx.strokeStyle = '#c9d6ee'; ctx.lineWidth = 1.5; ctx.beginPath();
    stars.slice(0, 7).forEach(([sx, sy], k) => k ? ctx.lineTo(sx, sy) : ctx.moveTo(sx, sy)); ctx.stroke();
    ctx.fillStyle = '#fff1cc';
    for (const [sx, sy, r] of stars) { ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI * 2); ctx.fill(); }
  }, .5);
  for (const { x, z } of FURNITURE.charts) {
    const easel = frame('Caballete', x, z, 45);
    for (const dx of [-.3, .3]) local(easel, 'Pata del caballete', 'box', black, [dx, .65, -.06], [.05, 1.3, .05], [-8, 0, 0]);
    local(easel, 'Pata de atrás', 'box', black, [0, .6, -.3], [.05, 1.25, .05], [18, 0, 0]);
    local(easel, 'Carta de estrellas', 'box', chart, [0, .95, 0], [1.1, .82, .03], [-8, 0, 0], { batched: false });
  }

  // ------------------------------------------------------------ el crucero: Fran's own, on the presbytery
  // His chair beside him, under a hood dryer hung from the vault: straight chrome rods between two
  // rings, and out of them the curve he talks about. His slate, with the same curve in chalk.
  {
    const cx = fran.x + .2, cz = fran.z + 1.5;
    chair(cx, cz, 270, DAIS);
    const at = toWorld(cx, cz), low = DAIS + 1.42, high = DAIS + 2.5, r = .46, rods = 16;
    for (const y of [low, high]) part('Aro del secador', 'cylinder', chrome, cx, cz, y, [r * 2.1, .04, r * 2.1]);
    for (let k = 0; k < rods; k++) {
      const a = k / rods * Math.PI * 2, b = a + 1.9;
      rod('Varilla del secador', chrome, new pc.Vec3(at.x + Math.cos(a) * r, low, at.z + Math.sin(a) * r), new pc.Vec3(at.x + Math.cos(b) * r, high, at.z + Math.sin(b) * r), .025, { shadows: false });
    }
    part('Cable del secador', 'cylinder', chrome, cx, cz, high + 2, [.03, 4, .03], [0, 0, 0], { shadows: false });
    const slate = painted('Pizarra de Fran', 256, 192, ctx => {
      ctx.fillStyle = '#20262b'; ctx.fillRect(0, 0, 256, 192);
      ctx.strokeStyle = '#e9e6dc'; ctx.lineWidth = 1.4;
      // A hyperboloid in chalk: only straight lines between two ellipses.
      for (let k = 0; k < 22; k++) {
        const a = k / 22 * Math.PI * 2, b = a + 1.9;
        ctx.beginPath(); ctx.moveTo(128 + Math.cos(a) * 70, 160 + Math.sin(a) * 14); ctx.lineTo(128 + Math.cos(b) * 70, 34 + Math.sin(b) * 14); ctx.stroke();
      }
      for (const y of [34, 160]) { ctx.beginPath(); ctx.ellipse(128, y, 70, 14, 0, 0, Math.PI * 2); ctx.stroke(); }
    }, .25);
    const easel = frame('Pizarra de Fran', fran.x + 1.9, fran.z + 2.7, 45, DAIS);
    for (const dx of [-.4, .4]) local(easel, 'Pata de la pizarra', 'box', black, [dx, .7, -.06], [.05, 1.4, .05], [-8, 0, 0]);
    local(easel, 'Pata de atrás', 'box', black, [0, .65, -.32], [.05, 1.35, .05], [18, 0, 0]);
    local(easel, 'Pizarra', 'box', slate, [0, 1.05, 0], [1.35, 1.0, .04], [-8, 0, 0], { batched: false });
  }

  return {
    destroy() { root.destroy(); app.batcher.removeGroup(batch.id); materials.forEach(m => m.destroy()); textures.forEach(t => t.destroy()); },
  };
}
