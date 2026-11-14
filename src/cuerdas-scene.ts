import * as pc from 'playcanvas';
import { CUERDAS, TILE, hold, toneOf, type CuerdasPlan, type CuerdasRun, type Piece } from './cuerdas';
import { PHRASES, TONES, TONE_IDS, songAt, type ToneId } from './song';

/**
 * How Las cuerdas looks (docs/quests/marta.md § Las cuerdas, docs/places/cuerdas.md; src/cuerdas.ts
 * has its plan): no ground and no horizon, a void in dark petrol crossed by strings of silver light.
 * The way is slabs of dark glass edged in silver, hung over nothing; every string in the place rises
 * to one point high over the centre, where they all meet, so the place itself says which way is on.
 * A maze's pieces are lit in their note's colour: there while it sounds, trembling before it ends,
 * dropped into the void after, with a faint frame left where each will come back. The third maze's
 * rows answer to the tuning pegs standing beside them, found nowhere else in the game.
 * No pink and no violet: this place is Marta's, not the Queen's.
 */
const VOID = '#04151b';
/** How high over the centre every string meets (m), and how far a dropped piece falls before it is gone. */
const APEX = 19, DROP = 5;
/** Seconds a piece takes to come up before its note, and to fall after it. */
const RISE = .34, FALL = .3;

interface Buffer { positions: number[]; normals: number[]; colors: number[]; indices: number[] }
const buffer = (): Buffer => ({ positions: [], normals: [], colors: [], indices: [] });

export function buildCuerdas(app: pc.Application, toWorld: (x: number, z: number) => pc.Vec3, plan: CuerdasPlan = CUERDAS) {
  const root = new pc.Entity('Las cuerdas'); app.root.addChild(root);
  const materials: pc.StandardMaterial[] = [], meshes: pc.Mesh[] = [];
  const mat = (name: string, hex: string, { gloss = .5, glow = 0, opacity = 1, unlit = false, add = false } = {}) => {
    const m = new pc.StandardMaterial(); m.name = name; m.diffuse.fromString(hex); m.gloss = gloss; m.useMetalness = false;
    if (glow) { m.emissive.fromString(hex); m.emissiveIntensity = glow; }
    if (unlit) { m.useLighting = false; m.diffuse.set(0, 0, 0); }
    if (opacity < 1 || add) { m.opacity = opacity; m.blendType = add ? pc.BLEND_ADDITIVE : pc.BLEND_NORMAL; m.depthWrite = false; }
    m.update(); materials.push(m); return m;
  };
  const quad = (b: Buffer, corners: number[][], n: number[], shade: number) => {
    const i = b.positions.length / 3;
    for (const c of corners) { b.positions.push(...c); b.normals.push(...n); b.colors.push(shade, shade, shade, 1); }
    b.indices.push(i, i + 1, i + 2, i, i + 2, i + 3);
  };
  /** A string of light from `a` to `b`, `wide` across: two crossed ribbons, so it shows from any side. */
  const string = (b: Buffer, a: pc.Vec3, to: pc.Vec3, wide: number, shade: number, fade = shade) => {
    const along = new pc.Vec3().sub2(to, a).normalize();
    const side = new pc.Vec3().cross(along, Math.abs(along.y) > .95 ? pc.Vec3.RIGHT : pc.Vec3.UP).normalize().mulScalar(wide / 2);
    const other = new pc.Vec3().cross(along, side).normalize().mulScalar(wide / 2);
    for (const s of [side, other]) {
      const i = b.positions.length / 3;
      for (const [p, k, c] of [[a, -1, shade], [a, 1, shade], [to, 1, fade], [to, -1, fade]] as [pc.Vec3, number, number][]) {
        b.positions.push(p.x + s.x * k, p.y + s.y * k, p.z + s.z * k); b.normals.push(0, 1, 0); b.colors.push(c, c, c, 1);
      }
      b.indices.push(i, i + 1, i + 2, i, i + 2, i + 3);
    }
  };
  const instance = (b: Buffer, material: pc.StandardMaterial, name: string, receive = false) => {
    const mesh = new pc.Mesh(app.graphicsDevice);
    mesh.setPositions(b.positions); mesh.setNormals(b.normals); mesh.setColors(b.colors); mesh.setIndices(b.indices); mesh.update();
    meshes.push(mesh);
    const e = new pc.Entity(name); e.addComponent('render', { meshInstances: [new pc.MeshInstance(mesh, material)], castShadows: false, receiveShadows: receive });
    root.addChild(e); return e;
  };
  const part = (parent: pc.Entity, name: string, type: pc.RenderComponent['type'], m: pc.Material, p: number[], s: number[], r: number[] = [0, 0, 0]) => {
    const e = new pc.Entity(name); e.addComponent('render', { type, material: m, castShadows: false, receiveShadows: false });
    e.setLocalPosition(p[0], p[1], p[2]); e.setLocalScale(s[0], s[1], s[2]); e.setLocalEulerAngles(r[0], r[1], r[2]);
    parent.addChild(e); return e;
  };
  const ring = (parent: pc.Entity, name: string, m: pc.Material, radius: number, tube: number, p: number[]) => {
    const mesh = pc.Mesh.fromGeometry(app.graphicsDevice, new pc.TorusGeometry({ ringRadius: radius, tubeRadius: tube, segments: 72, sides: 6 }));
    meshes.push(mesh);
    const e = new pc.Entity(name); e.addComponent('render', { meshInstances: [new pc.MeshInstance(mesh, m)], castShadows: false });
    e.setLocalPosition(p[0], p[1], p[2]); parent.addChild(e); return e;
  };
  const rnd = (n: number) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

  // The way: every cell that is always there (walkways, platforms, the centre), as dark glass with a
  // silver edge wherever it gives onto the void. A maze's cells are its pieces', drawn one by one below.
  const inMaze = (x: number, z: number) => plan.mazes.some(({ rect: r }) => x >= r.x && x < r.x + r.w && z >= r.z && z < r.z + r.d);
  const solid = (x: number, z: number) => plan.grid[z]?.[x] === '.' && !inMaze(x, z);
  const glass = buffer(), edges = buffer(), strings = buffer(), far = buffer();
  const THICK = .28;
  for (let z = 0; z < plan.depth; z++) for (let x = 0; x < plan.width; x++) {
    if (!solid(x, z)) continue;
    const p = toWorld(x, z), x0 = p.x - .5, x1 = p.x + .5, z0 = p.z - .5, z1 = p.z + .5;
    // A faint board pattern, lighter towards the centre: the nearer the end, the more light there is.
    const shade = (.72 + ((x + z) % 2) * .08 + rnd(x * 7 + z * 13) * .06) * (1.25 - .45 * z / plan.depth);
    quad(glass, [[x0, 0, z1], [x1, 0, z1], [x1, 0, z0], [x0, 0, z0]], [0, 1, 0], shade);
    const sides: [number, number, number[][], number[], number[][]][] = [
      [0, 1, [[x0, -THICK, z1], [x1, -THICK, z1], [x1, 0, z1], [x0, 0, z1]], [0, 0, 1], [[x0, z1 - .05], [x1, z1]]],
      [0, -1, [[x1, -THICK, z0], [x0, -THICK, z0], [x0, 0, z0], [x1, 0, z0]], [0, 0, -1], [[x0, z0], [x1, z0 + .05]]],
      [1, 0, [[x1, -THICK, z1], [x1, -THICK, z0], [x1, 0, z0], [x1, 0, z1]], [1, 0, 0], [[x1 - .05, z0], [x1, z1]]],
      [-1, 0, [[x0, -THICK, z0], [x0, -THICK, z1], [x0, 0, z1], [x0, 0, z0]], [-1, 0, 0], [[x0, z0], [x0 + .05, z1]]],
    ];
    for (const [dx, dz, corners, n, [[ex0, ez0], [ex1, ez1]]] of sides) {
      if (plan.grid[z + dz]?.[x + dx] === '.') continue;
      quad(glass, corners, n, shade * .5);
      quad(edges, [[ex0, .012, ez1], [ex1, .012, ez1], [ex1, .012, ez0], [ex0, .012, ez0]], [0, 1, 0], 1);
    }
  }
  const slab = mat('Vidrio oscuro', '#17505c', { gloss: .82, glow: .16 }); slab.diffuseVertexColor = true; slab.update();
  const silver = mat('Borde de plata', '#cfdde6', { glow: 1.5, unlit: true });
  instance(glass, slab, 'Camino', true);
  instance(edges, silver, 'Borde del camino');

  // The strings. Every one ends at the same point over the centre: from far out on both sides of the
  // way (a harp as long as the place), from under each maze, and in a cone round the centre itself.
  const centre = toWorld(plan.centre.x, plan.centre.z), apex = new pc.Vec3(centre.x, APEX, centre.z);
  const south = toWorld(plan.spawn.x, plan.depth).z, north = centre.z;
  // The long ones run under the way and out to both sides of it, never over it, and gather beneath
  // the centre; from there they go up to where they meet, on the side away from the camera (it looks
  // from +x +z), so nothing is ever strung between it and the party.
  const under = new pc.Vec3(centre.x, -2.2, centre.z);
  for (let i = 0; i < 40; i++) for (const side of [-1, 1]) {
    const k = i / 39, out = 10 + rnd(i * 3 + side) * 6 + k * 9;
    const from = new pc.Vec3(centre.x + side * out, -3.5 - rnd(i + 40) * 10, north + 10 + (south - north) * k);
    string(strings, from, under, .016 + rnd(i * 5) * .012, .1 + rnd(i * 9 + side) * .22, .5);
  }
  for (let i = 0; i < 26; i++) {
    const a = Math.PI * .78 + i / 25 * Math.PI * .94, r = plan.centre.radius + .7;
    string(strings, new pc.Vec3(centre.x + Math.cos(a) * r, 0, centre.z + Math.sin(a) * r), apex, .018, .32 + (i % 4 === 0 ? .3 : 0), .8);
  }
  // Under the way, the five it hangs on, from end to end; and far off, loose ones falling out of sight.
  for (let i = 0; i < 5; i++) string(strings, new pc.Vec3(centre.x + (i - 2) * .55, -THICK - .5 - (i % 2) * .25, south + 6), new pc.Vec3(centre.x + (i - 2) * .55, -THICK - .5 - (i % 2) * .25, north), .03, .45);
  for (let i = 0; i < 70; i++) {
    const side = i % 2 ? 1 : -1, x = centre.x + side * (15 + rnd(i) * 30), z = north - 12 + rnd(i + 99) * (south - north + 24), lean = (rnd(i + 7) - .5) * 9;
    string(far, new pc.Vec3(x, 34, z), new pc.Vec3(x + lean, -30, z + lean * .4), .025 + rnd(i * 3) * .03, .05 + rnd(i * 11) * .14, .01);
  }
  const light = mat('Cuerdas de luz', '#dfeaf2', { glow: 1.6, unlit: true, add: true }); light.emissiveVertexColor = true; light.cull = pc.CULLFACE_NONE; light.update();
  const dim = mat('Cuerdas lejanas', '#9fc4cf', { glow: 1.1, unlit: true, add: true }); dim.emissiveVertexColor = true; dim.cull = pc.CULLFACE_NONE; dim.update();
  instance(far, dim, 'Cuerdas lejanas');

  // The centre: rings of silver set into its floor, a shaft of light down from where the strings meet.
  for (const [radius, tube] of [[2.2, .03], [4.4, .025], [6.6, .02]]) ring(root, 'Anillo del centro', silver, radius, tube, [centre.x, .02, centre.z]);
  const shaft = part(root, 'Haz', 'cylinder', mat('Haz', '#dfeaf2', { glow: .5, unlit: true, add: true, opacity: .5 }), [centre.x, APEX / 2, centre.z], [.28, APEX, .28]);
  part(root, 'Nudo de arriba', 'sphere', mat('Nudo de arriba', '#ffffff', { glow: 4, unlit: true }), [apex.x, apex.y, apex.z], [.7, .7, .7]);

  // A light over each platform in its quality's note, one over the centre, and one that goes with Gerard.
  const lamp = (name: string, at: pc.Vec3, hex: string, intensity: number, range: number) => {
    const e = new pc.Entity(name); e.addComponent('light', { type: 'omni', color: new pc.Color().fromString(hex), intensity, range, castShadows: false });
    e.setPosition(at); root.addChild(e); return e;
  };
  const NOTE: Record<string, ToneId | undefined> = { lealtad: 'la', cristalino: 'do', directo: 'sol' };
  const lamps = new Map<string, pc.Entity>();
  for (const p of plan.platforms) {
    const at = toWorld(p.centre.x, p.centre.z), note = NOTE[p.id];
    lamps.set(p.id, lamp(`Luz de ${p.id}`, new pc.Vec3(at.x, 4.5, at.z), note ? TONES[note].colour : '#cfdde6', note ? 2.6 : 1.5, 15));
    // Four posts at its corners, each a string up to where they all meet.
    const post = buffer();
    for (const [cx, cz] of [[p.rect.x, p.rect.z], [p.rect.x + p.rect.w - 1, p.rect.z], [p.rect.x, p.rect.z + p.rect.d - 1], [p.rect.x + p.rect.w - 1, p.rect.z + p.rect.d - 1]]) {
      const c = toWorld(cx, cz);
      string(post, new pc.Vec3(c.x, 0, c.z), new pc.Vec3(c.x, 1.5, c.z), .05, 1);
    }
    const m = mat(`Poste de ${p.id}`, note ? TONES[note].colour : '#cfdde6', { glow: 1.6, unlit: true }); m.cull = pc.CULLFACE_NONE; m.update();
    instance(post, m, `Postes de ${p.id}`);
  }
  instance(strings, light, 'Cuerdas');
  lamp('Luz del centro', new pc.Vec3(centre.x, 6, centre.z), '#eef3ff', 3, 22);
  const near = lamp('Luz de Gerard', new pc.Vec3(), '#dff3f5', 1.5, 8);

  // The bubble they came in by, behind where they arrive: pale, never pink.
  const door = toWorld(plan.spawn.x, plan.spawn.z + 2);
  const bubble = part(root, 'Pompa de entrada', 'sphere', mat('Pompa de entrada', '#bfe9ee', { gloss: .95, glow: .35, opacity: .22 }), [door.x, 1.25, door.z], [2.3, 2.3, 2.3]);

  // The mazes' pieces. One slab each, in its note's colour (a material per maze and note, so each
  // maze pulses with its own phrase), and under it a faint frame that stays when it has dropped.
  const SIZE = TILE * .94;
  const toneMats = plan.mazes.map((_, i) => Object.fromEntries(TONE_IDS.map(id => [id, mat(`Pieza ${i} ${id}`, TONES[id].colour, { gloss: .7, glow: 1 })])) as Record<ToneId, pc.StandardMaterial>);
  const ghostMats = Object.fromEntries(TONE_IDS.map(id => [id, mat(`Hueco ${id}`, TONES[id].colour, { glow: .5, unlit: true, add: true, opacity: .35 })])) as Record<ToneId, pc.StandardMaterial>;
  const knotMat = mat('Nudo', '#b9cbd4', { gloss: .85, glow: .35 }), crackMat = mat('Grieta', '#04151b', { gloss: .1 });
  interface Shown { piece: Piece; slab: pc.Entity; body: pc.Entity; ghost?: pc.Entity; at: pc.Vec3; tone?: ToneId; y: number }
  const pieces: Shown[] = [];
  for (const maze of plan.mazes) for (const piece of maze.pieces) {
    const a = toWorld(piece.x, piece.z), at = new pc.Vec3(a.x + (TILE - 1) / 2, 0, a.z + (TILE - 1) / 2);
    const holder = new pc.Entity(`Pieza ${piece.id}`); holder.setPosition(at); root.addChild(holder);
    const tone = piece.tone;
    const body = part(holder, 'Losa', 'box', piece.knot ? knotMat : toneMats[piece.maze][tone ?? 'la'], [0, -THICK / 2, 0], [SIZE, THICK, SIZE]);
    body.render!.receiveShadows = true;
    if (piece.knot) ring(holder, 'Lazo', silver, .5, .03, [0, .02, 0]);
    // A cracked one shows it: three dark lines across it.
    if (piece.cracked) for (const [x, z, r, l] of [[-.2, .1, 24, 1.5], [.3, -.3, -38, 1], [.1, .5, 70, .7]]) part(holder, 'Grieta', 'box', crackMat, [x, .006, z], [l, .012, .05], [0, r, 0]);
    let ghost: pc.Entity | undefined;
    if (!piece.knot) {
      ghost = new pc.Entity('Hueco'); ghost.setPosition(at.x, -.02, at.z); root.addChild(ghost);
      for (const [x, z, w, d] of [[0, SIZE / 2, SIZE, .04], [0, -SIZE / 2, SIZE, .04], [SIZE / 2, 0, .04, SIZE], [-SIZE / 2, 0, .04, SIZE]]) part(ghost, 'Marco', 'box', ghostMats[tone ?? 'la'], [x, 0, z], [w, .02, d]);
    }
    pieces.push({ piece, slab: holder, body, ghost, at, tone, y: 0 });
  }
  // The tuning pegs of the third maze: a post with a flat head, a bead in its row's note, and a string to its row.
  interface Peg { row: number; head: pc.Entity; bead: pc.StandardMaterial; turn: number; shown: number }
  const pegs: Peg[] = [];
  const pegged = plan.mazes.find(m => m.pegs.length);
  pegged?.pegs.forEach((cell, row) => {
    const at = toWorld(cell.x, cell.z), holder = new pc.Entity(`Clavija ${row}`); holder.setPosition(at.x - .1, 0, at.z); root.addChild(holder);
    const steel = mat('Clavija', '#b9cbd4', { gloss: .9, glow: .12 }), bead = mat(`Cuenta de clavija ${row}`, '#ffffff', { glow: 2.4, unlit: true });
    part(holder, 'Vástago', 'cylinder', steel, [0, .55, 0], [.16, 1.1, .16]);
    const head = new pc.Entity('Cabeza'); head.setLocalPosition(0, 1.25, 0); holder.addChild(head);
    part(head, 'Pala', 'box', steel, [0, 0, 0], [.62, .42, .12]);
    part(head, 'Cuenta', 'sphere', bead, [0, 0, 0], [.2, .2, .2]);
    part(holder, 'Cuerda de la fila', 'box', bead, [(pegged.rect.x - cell.x) / 2 + .1, .06, 0], [pegged.rect.x - cell.x - .2, .025, .025]);
    pegs.push({ row, head, bead, turn: 0, shown: 0 });
  });

  let pulse = 0, last = '';
  return {
    root,
    /** The void's own colour, for the sky behind everything. */
    clear: new pc.Color().fromString(VOID),
    /** What a fight's pocket would be made of here (src/pocket.ts), should one ever be needed. */
    pocket: { floor: slab as pc.Material, wall: slab as pc.Material, light: new pc.Color(.8, .92, .95) },
    /** Where a quality's light is, to put it out once it is beaten. */
    quiet(id: string, beaten: boolean) { const l = lamps.get(id)?.light; if (l) l.intensity = beaten ? .6 : 2.6; },
    /**
     * Each frame: `t` seconds into the song and what has been tuned and broken (`run`). Every piece
     * comes up before its note, shakes as it ends and drops after; the pegs show their rows' notes;
     * the strings breathe, and brighten as each note starts. `focus` is where Gerard is.
     */
    update(dt: number, t: number, run: CuerdasRun, focus: pc.Vec3, animate: boolean) {
      near.setPosition(focus.x, focus.y + 2.4, focus.z);
      // Which note each maze sings now, and how long ago it started.
      const now = plan.mazes.map(maze => songAt(PHRASES[maze.spec.phrase], t));
      const key = now.map(m => `${m.loop}:${m.index}`).join();
      if (key !== last) { last = key; pulse = 1; }
      pulse = Math.max(0, pulse - dt * 1.8);
      plan.mazes.forEach((_, i) => {
        for (const id of TONE_IDS) {
          const m = toneMats[i][id], on = now[i].tone === id;
          m.emissiveIntensity = on ? .75 + .9 * Math.exp(-now[i].into * 2.4) : .3; m.update();
        }
      });
      light.emissiveIntensity = 1 + (animate ? Math.sin(t * .7) * .12 : 0) + pulse * .7; light.update();
      shaft.setLocalScale(.28 + pulse * .14, APEX, .28 + pulse * .14);
      if (animate) bubble.setLocalScale(2.3 + Math.sin(t * 1.3) * .05, 2.3 + Math.sin(t * 1.7 + 1) * .07, 2.3 + Math.sin(t * 1.1 + 2) * .05);
      for (const p of pieces) {
        if (p.piece.knot) continue;
        const tone = toneOf(p.piece, run, plan);
        if (tone && tone !== p.tone) {
          p.tone = tone;
          p.body.render!.meshInstances[0].material = toneMats[p.piece.maze][tone];
          for (const r of p.ghost?.findComponents('render') as pc.RenderComponent[] ?? []) r.meshInstances[0].material = ghostMats[tone];
        }
        const h = hold(p.piece, run, t, plan), gone = run.broken.includes(p.piece.id);
        let y = 0, shake = 0;
        if (h.state === 'down') {
          // Falling away for FALL seconds, then nothing; back up in the last RISE before its note.
          const fall = Number.isFinite(h.sinceDown) ? Math.min(1, Math.max(0, h.sinceDown) / FALL) : 1, rise = gone || !Number.isFinite(h.untilUp) ? 0 : Math.max(0, 1 - h.untilUp / RISE);
          y = -DROP * fall * fall * (1 - rise * rise * (3 - 2 * rise));
        } else if (h.state === 'trembling') shake = 1;
        const hidden = h.state === 'down' && y <= -DROP + .01;
        p.slab.enabled = !hidden;
        if (p.ghost) p.ghost.enabled = !gone && h.state === 'down';
        const jx = shake && animate ? (rnd(Math.floor(t * 40) + p.at.x) - .5) * .07 : 0, jz = shake && animate ? (rnd(Math.floor(t * 40) + p.at.z + 5) - .5) * .07 : 0;
        if (!hidden) {
          p.slab.setPosition(p.at.x + jx, y - (shake ? .04 : 0), p.at.z + jz);
          const k = 1 + y / DROP * .35;
          p.slab.setLocalScale(k, 1, k);
        }
        p.y = y;
      }
      for (const peg of pegs) {
        const tone = run.tuning[peg.row];
        peg.bead.emissive.fromString(TONES[tone].colour); peg.bead.update();
        peg.shown += (peg.turn - peg.shown) * (animate ? 1 - Math.exp(-dt * 12) : 1);
        peg.head.setLocalEulerAngles(0, peg.shown, 0);
      }
    },
    /** A peg was turned: its head goes round a quarter. */
    turned(row: number) { const peg = pegs.find(p => p.row === row); if (peg) peg.turn += 90; },
    destroy() { root.destroy(); meshes.forEach(m => m.destroy()); materials.forEach(m => m.destroy()); },
  };
}
export type CuerdasScene = ReturnType<typeof buildCuerdas>;

/**
 * The upright piano in Alegia that Aitor plays (docs/quests/marta.md § The way in): dark wood, its lid
 * up over the keys, a stool before it. `at` is its middle on the ground and `facing` the way its keys look.
 */
export function buildPiano(app: pc.Application, at: pc.Vec3, facing = 0) {
  const root = new pc.Entity('Piano de Alegia'); app.root.addChild(root);
  root.setPosition(at); root.setEulerAngles(0, facing, 0);
  const materials: pc.StandardMaterial[] = [];
  const mat = (hex: string, gloss: number) => { const m = new pc.StandardMaterial(); m.diffuse.fromString(hex); m.gloss = gloss; m.useMetalness = false; m.update(); materials.push(m); return m; };
  const wood = mat('#3a2a22', .7), dark = mat('#221815', .6), ivory = mat('#efe9dc', .5), ebony = mat('#141112', .6), brass = mat('#b08a4a', .8);
  const box = (name: string, m: pc.Material, p: number[], s: number[]) => {
    const e = new pc.Entity(name); e.addComponent('render', { type: 'box', material: m, castShadows: true });
    e.setLocalPosition(p[0], p[1], p[2]); e.setLocalScale(s[0], s[1], s[2]); root.addChild(e); return e;
  };
  box('Caja', wood, [0, .62, -.16], [1.5, 1.24, .34]);
  box('Tapa', dark, [0, 1.26, -.16], [1.56, .05, .4]);
  box('Mueble del teclado', wood, [0, .68, .13], [1.5, .12, .28]);
  box('Teclas', ivory, [0, .75, .15], [1.36, .03, .2]);
  for (let k = 0; k < 20; k++) if (k % 7 !== 2 && k % 7 !== 6) box('Tecla negra', ebony, [-.64 + k * .067, .775, .1], [.03, .03, .11]);
  for (const side of [-1, 1]) { box('Pata', dark, [side * .7, .31, .2], [.08, .62, .1]); box('Costado', dark, [side * .76, .62, -.16], [.04, 1.26, .36]); }
  box('Atril', dark, [0, 1.0, .0], [.7, .28, .03]).setLocalEulerAngles(-14, 0, 0);
  box('Partitura', ivory, [0, 1.02, .02], [.42, .24, .01]).setLocalEulerAngles(-14, 0, 0);
  for (const x of [-.12, 0, .12]) box('Pedal', brass, [x, .05, .08], [.05, .02, .16]);
  box('Banqueta', dark, [0, .46, .78], [.7, .08, .34]);
  for (const [x, z] of [[-.3, .66], [.3, .66], [-.3, .9], [.3, .9]]) box('Pata de la banqueta', dark, [x, .22, z], [.05, .44, .05]);
  return { root, destroy() { root.destroy(); materials.forEach(m => m.destroy()); } };
}
