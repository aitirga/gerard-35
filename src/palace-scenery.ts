import * as pc from 'playcanvas';
import type { Environment } from './environments';
import { palaceKit } from './palace';

/**
 * Inside La Reina Bubbaloo's palace (docs/bubbaloo-palace.md): wet-candy checkerboard floors,
 * glossy gum walls with lumpy crests and drips, twisted wrapper columns, El Corazón Líquido,
 * the portraits, the gum curtain over the throne stair, the wrapper heaps and the drain.
 * North and west outer walls stand tall; inner walls are waist-high and south and east ones are
 * cut low, so the camera (from the south-east) always sees into the rooms.
 */
export interface PalaceInteriorKit {
  app: pc.Application;
  root: pc.Entity;
  x: (v: number) => number;
  z: (v: number) => number;
  texture: (canvas: HTMLCanvasElement) => pc.Texture;
}
const TALL = 3.1, MID = 1.15, LOW = .55;
const WALKABLE = new Set(['.', '+', 'R']);

export function buildPalaceInterior(kit: PalaceInteriorKit, environment: Environment) {
  const { app, root, x, z, texture } = kit;
  const plan = environment.palace!.plan;
  const glyph = (px: number, pz: number) => plan[pz]?.[px] ?? ' ';
  const inside = (px: number, pz: number) => glyph(px, pz) !== ' ';
  const walkable = (px: number, pz: number) => WALKABLE.has(glyph(px, pz));
  const jitter = (i: number) => { const v = Math.sin(i * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };
  const palette = palaceKit(app);
  const { mat, part } = palette;
  const lights: pc.Entity[] = [];

  const gumWall = mat('#b9467e', .72, .03), crest = mat('#ff7fb5', .88, .06), skirting = mat('#5a1a44', .55);
  const drip = mat('#ff6fae', .9, .05), wrapperWhite = mat('#fbeef3', .7, .04), plum = mat('#6e2453', .6);
  const core = mat('#ff3d8b', .6, 1.8), skin = mat('#ffb3d6', .95, .2, .4), dark = mat('#2c0d22', .5, .1);
  const gold = mat('#f2b8d8', .9, .12), liquid = mat('#ff4f9b', .95, .9);
  const flavours = ['#ff4d7a', '#7fe0c0', '#9a5cd6', '#ffe066', '#2a1a24'].map(hex => mat(hex, .9, .15));

  /** A child of `root` at a cell's centre, so parts can be laid out in cell units around it. */
  function at(px: number, pz: number, y = 0, name = 'Pieza') {
    const e = new pc.Entity(name); e.setLocalPosition(x(px), y, z(pz)); root.addChild(e); return e;
  }
  function light(px: number, y: number, pz: number, intensity = 1.6, range = 6.5) {
    const e = new pc.Entity('Luz de centro líquido');
    e.addComponent('light', { type: 'omni', color: new pc.Color(1, .38, .68), intensity, range, castShadows: false });
    e.setLocalPosition(x(px), y, z(pz)); root.addChild(e); lights.push(e);
  }
  /** Checkerboard of wet candy tiles; `a`/`b` are the two colours, two tiles per texture. */
  function checker(a: string, b: string, seam = '#2c0d2230') {
    const size = 128, c = document.createElement('canvas'); c.width = c.height = size;
    const ctx = c.getContext('2d')!;
    for (let i = 0; i < 2; i++) for (let k = 0; k < 2; k++) {
      ctx.fillStyle = (i + k) % 2 ? a : b; ctx.fillRect(i * 64, k * 64, 64, 64);
      // A soft highlight on each tile, as if it were glazed sugar.
      const g = ctx.createRadialGradient(i * 64 + 22, k * 64 + 18, 2, i * 64 + 22, k * 64 + 18, 40);
      g.addColorStop(0, '#ffffff2a'); g.addColorStop(1, '#ffffff00');
      ctx.fillStyle = g; ctx.fillRect(i * 64, k * 64, 64, 64);
    }
    ctx.strokeStyle = seam; ctx.lineWidth = 2;
    for (const v of [0, 64, 128]) { ctx.beginPath(); ctx.moveTo(v, 0); ctx.lineTo(v, size); ctx.moveTo(0, v); ctx.lineTo(size, v); ctx.stroke(); }
    const m = mat('#ffffff', .92); m.diffuseMap = texture(c); m.update(); return m;
  }

  // ——— The slab everything stands on, and the floors ———
  const width = plan[0].length, depth = plan.length;
  part(root, 'Base del palacio', 'box', skirting, [x((width - 1) / 2), -.3, z((depth - 1) / 2)], [width + .4, .56, depth + .4]);
  const floors = {
    'Vestíbulo de las Burbujas': checker('#c95a8d', '#5a1d47'),
    'Galería de los Retratos': checker('#a8487a', '#4a1638'),
    'Sala de los Envoltorios': checker('#f0c6da', '#c95a8d', '#5a1d4730'),
  } as Record<string, pc.StandardMaterial>;
  for (const room of environment.palace!.rooms) {
    const m = floors[room.name] ?? floors['Vestíbulo de las Burbujas'];
    const tiles = m.clone(); tiles.diffuseMapTiling = new pc.Vec2(room.w / 2, room.d / 2); tiles.update(); palette.materials.push(tiles);
    part(root, `Suelo: ${room.name}`, 'box', tiles, [x(room.x + (room.w - 1) / 2), -.01, z(room.z + (room.d - 1) / 2)], [room.w, .04, room.d], [0, 0, 0], false);
  }
  // Arches share the hall's floor.
  plan.forEach((row, pz) => [...row].forEach((c, px) => {
    if (c === '+') part(root, 'Suelo del arco', 'box', crest, [x(px), -.01, z(pz)], [1, .04, 1], [0, 0, 0], false);
  }));
  // The gallery's runner, pink with white edges, from the hall arch to the far end.
  part(root, 'Alfombra de la galería', 'box', mat('#d94a8c', .4), [x(5), .02, z(9)], [8.6, .02, 1.2], [0, 0, 0], false);
  for (const side of [-1, 1]) part(root, 'Ribete', 'box', wrapperWhite, [x(5), .025, z(9) + side * .62], [8.6, .02, .1], [0, 0, 0], false);

  // ——— Walls: gum blocks with a lumpy crest; the faces the camera sees drip ———
  const isWall = (c: string) => c === '#' || c === 'P' || c === 'D';
  const drips: { e: pc.Entity; length: number; phase: number }[] = [];
  plan.forEach((row, pz) => [...row].forEach((c, px) => {
    if (!isWall(c)) return;
    const outer = [[0, -1], [-1, 0], [1, 0], [0, 1]].some(([dx, dz]) => !inside(px + dx, pz + dz));
    const facesSouth = walkable(px, pz + 1), facesEast = walkable(px + 1, pz);
    const facesNorth = walkable(px, pz - 1), facesWest = walkable(px - 1, pz);
    // Tall only on the outer north and west sides; inner walls waist-high; the rest cut low.
    const tall = outer && (facesSouth || facesEast) && !facesNorth && !facesWest;
    const h = tall ? TALL : outer ? LOW : MID;
    const seed = px * 31 + pz * 7;
    const block = at(px, pz, 0, c === 'P' ? 'Muro con retrato' : 'Muro de chicle');
    part(block, 'Zócalo', 'box', skirting, [0, .22, 0], [1.02, .44, 1.02]);
    part(block, 'Muro', 'box', gumWall, [0, h / 2, 0], [1, h, 1]);
    part(block, 'Cresta', 'sphere', crest, [(jitter(seed) - .5) * .1, h, 0], [1.12, .42 + jitter(seed + 1) * .22, 1.12], [0, jitter(seed + 2) * 90, 0], h > MID);
    if (h < MID) return;
    // Drips on the faces that look into a room the camera sees.
    for (const [face, ox, oz] of [[facesSouth, 0, .52], [facesEast, .52, 0]] as const) {
      if (!face) continue;
      for (let k = 0; k < 2; k++) {
        const length = .25 + jitter(seed + k * 5 + (ox ? 3 : 0)) * (tall ? 1.1 : .45);
        const offset = (k - .5) * .5 + (jitter(seed + k) - .5) * .15;
        const e = part(block, 'Goterón', 'sphere', drip, [ox ? ox : offset, h - length / 2, oz ? oz : offset], [.17, length, .17], [0, 0, 0], false);
        drips.push({ e, length, phase: seed + k });
      }
    }
  }));

  // ——— Liquid-centre sconces on the tall walls, and the lights they give ———
  function sconce(px: number, pz: number, face: 'south' | 'east', withLight = false) {
    const [ox, oz] = face === 'south' ? [0, .56] : [.56, 0];
    const s = at(px, pz, 0, 'Aplique de centro líquido');
    part(s, 'Soporte', 'cone', plum, [ox * .9, 2.05, oz * .9], [.22, .3, .22], [180, 0, 0], false);
    part(s, 'Pompa del aplique', 'sphere', skin, [ox, 2.3, oz], [.36, .36, .36], [0, 0, 0], false);
    part(s, 'Centro líquido', 'sphere', core, [ox, 2.3, oz], [.16, .16, .16], [0, 0, 0], false);
    if (withLight) light(px + ox * 1.6, 2.4, pz + oz * 1.6, 1.3, 5.5);
  }
  sconce(0, 13, 'east', true); sconce(0, 17, 'east');
  sconce(11, 7, 'south', true); sconce(21, 7, 'south', true);
  for (const px of [2, 4, 6, 8]) sconce(px, 7, 'south', px === 4);

  // ——— The portraits (docs/lore.md: her invented look) ———
  function portraitCanvas(kind: number) {
    const w = 192, h = 240, c = document.createElement('canvas'); c.width = w; c.height = h;
    const ctx = c.getContext('2d')!;
    const backgrounds = ['#3a1030', '#24123a', '#5a1d47', '#101634', '#fbf6ee'];
    ctx.fillStyle = backgrounds[kind]; ctx.fillRect(0, 0, w, h);
    if (kind === 4) {
      // Bernat's felt-tip drawing: wobbly lines on white paper, his name in the corner.
      ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      const wobble = (pts: number[][], colour: string) => {
        ctx.strokeStyle = colour; ctx.beginPath();
        pts.forEach(([px, py], i) => (i ? ctx.lineTo : ctx.moveTo).call(ctx, px + Math.sin(i * 2.3) * 2, py + Math.cos(i * 1.7) * 2));
        ctx.stroke();
      };
      ctx.fillStyle = '#ff8cc6'; ctx.beginPath(); ctx.ellipse(96, 70, 44, 40, 0, 0, Math.PI * 2); ctx.fill();
      wobble([[60, 150], [96, 105], [132, 150], [60, 150]], '#e0488a');
      wobble([[96, 150], [96, 205]], '#e0488a');
      wobble([[96, 205], [70, 230]], '#e0488a'); wobble([[96, 205], [122, 230]], '#e0488a');
      ctx.fillStyle = '#f5c9a6'; ctx.beginPath(); ctx.arc(96, 96, 22, 0, Math.PI * 2); ctx.fill();
      wobble([[86, 92], [90, 92]], '#222'); wobble([[102, 92], [106, 92]], '#222'); wobble([[86, 104], [96, 110], [106, 104]], '#c0304f');
      ['#ff4d7a', '#7fe0c0', '#9a5cd6', '#ffe066', '#2a1a24'].forEach((col, i) => { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(66 + i * 15, 30, 7, 0, Math.PI * 2); ctx.fill(); });
      ctx.fillStyle = '#2b5fd9'; ctx.font = 'bold 20px Comic Sans MS, sans-serif'; ctx.fillText('REINA BUBALU', 22, 236 - 210);
      ctx.fillStyle = '#2b5fd9'; ctx.font = 'italic 16px sans-serif'; ctx.fillText('Bernat', 128, 232);
      return c;
    }
    if (kind === 3) {
      // A night city that is not Sant Quirze: a tall lit tower and a long avenue.
      const sky = ctx.createLinearGradient(0, 0, 0, h); sky.addColorStop(0, '#0b0f2a'); sky.addColorStop(1, '#3a1a4a');
      ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 40; i++) { ctx.fillStyle = '#fff6'; ctx.fillRect(jitter(i) * w, jitter(i + 50) * 120, 1.5, 1.5); }
      ctx.fillStyle = '#20183a'; for (let i = 0; i < 9; i++) ctx.fillRect(i * 22, 150 - jitter(i + 9) * 40, 20, 120);
      ctx.save(); ctx.beginPath(); ctx.ellipse(130, 150, 18, 70, 0, Math.PI, 0); ctx.lineTo(148, 160); ctx.lineTo(112, 160); ctx.closePath(); ctx.clip();
      for (let i = 0; i < 18; i++) { ctx.fillStyle = ['#ff4d7a', '#4da3ff', '#ffe066', '#7fe0c0'][i % 4]; ctx.fillRect(108, 80 + i * 4.5, 44, 3); }
      ctx.restore();
      ctx.strokeStyle = '#ffd36b'; ctx.lineWidth = 2;
      for (const dx of [-1, 1]) { ctx.beginPath(); ctx.moveTo(96, 165); ctx.lineTo(96 + dx * 110, 240); ctx.stroke(); }
      ctx.fillStyle = '#7a2a5c'; ctx.fillRect(0, 196, 90, 44);
    }
    // The Queen: beehive of pink gum, crown of five flavours, wrapper gown, smug half-closed eyes.
    const [cx, top, scale] = kind === 3 ? [44, 150, .42] : kind === 1 ? [96, 70, .9] : [96, 44, 1];
    ctx.save(); ctx.translate(cx, top); ctx.scale(scale, scale);
    if (kind === 1) { ctx.fillStyle = '#ff6fae'; ctx.beginPath(); ctx.arc(0, 140, 80, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#ffffff30'; ctx.beginPath(); ctx.arc(-26, 110, 22, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = '#fbeef3'; ctx.beginPath(); ctx.moveTo(-58, 190); ctx.lineTo(0, 80); ctx.lineTo(58, 190); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ff6fae'; for (let i = 0; i < 4; i++) ctx.fillRect(-46 + i * 26, 120 + i * 4, 12, 70);
    for (const side of [-1, 1]) { ctx.fillStyle = '#ff8cc6'; ctx.beginPath(); ctx.moveTo(side * 18, 92); ctx.lineTo(side * 46, 78); ctx.lineTo(side * 46, 108); ctx.closePath(); ctx.fill(); }
    ctx.fillStyle = '#ff6fae'; ctx.beginPath(); ctx.ellipse(0, 22, 44, 52, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffffff35'; ctx.beginPath(); ctx.ellipse(-16, 4, 12, 18, -.4, 0, Math.PI * 2); ctx.fill();
    const crownY = kind === 0 ? -50 : -26;
    ['#ff4d7a', '#7fe0c0', '#9a5cd6', '#ffe066', '#2a1a24'].forEach((col, i) => { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(-24 + i * 12, crownY - Math.abs(i - 2) * -3, 7, 0, Math.PI * 2); ctx.fill(); });
    if (kind === 0) { ctx.strokeStyle = '#f5c9a6'; ctx.lineWidth = 7; for (const side of [-1, 1]) { ctx.beginPath(); ctx.moveTo(side * 30, 90); ctx.lineTo(side * 34, -40); ctx.stroke(); } }
    ctx.fillStyle = '#f5c9a6'; ctx.beginPath(); ctx.arc(0, 62, 24, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#3a1030'; ctx.lineWidth = 2.5;
    for (const side of [-1, 1]) { ctx.beginPath(); ctx.moveTo(side * 6, 58); ctx.lineTo(side * 15, 57); ctx.stroke(); }
    ctx.strokeStyle = '#c0304f'; ctx.beginPath(); ctx.arc(2, 70, 8, .2, Math.PI - .6); ctx.stroke();
    ctx.fillStyle = '#c0304f'; ctx.beginPath(); ctx.arc(14, 66, 2.2, 0, Math.PI * 2); ctx.fill();
    if (kind === 2) { ctx.fillStyle = '#ff9cc8b0'; ctx.beginPath(); ctx.arc(16, 84, 58, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#ffffff50'; ctx.beginPath(); ctx.arc(-6, 60, 12, 0, Math.PI * 2); ctx.fill(); }
    if (kind === 3) { ctx.strokeStyle = '#f5c9a6'; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(30, 100); ctx.lineTo(56, 40); ctx.stroke(); }
    if (kind === 1) { ctx.strokeStyle = '#6e2453'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(40, 170); ctx.lineTo(56, 60); ctx.stroke(); ctx.fillStyle = '#ff3d8b'; ctx.beginPath(); ctx.arc(56, 56, 12, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
    return c;
  }
  [1, 3, 5, 7, 9].forEach((px, i) => {
    const frame = at(px, 7, 0, `Retrato ${i + 1}`);
    const big = i < 4;
    const [fw, fh, fy] = big ? [.82, 1.02, 1.75] : [.5, .62, 1.55];
    part(frame, 'Marco de chicle', 'box', gold, [0, fy, .53], [fw + .12, fh + .12, .05], [0, 0, 0], false);
    const art = mat('#ffffff', .3); art.diffuseMap = texture(portraitCanvas(i)); art.emissiveMap = art.diffuseMap; art.emissive.set(.18, .18, .18); art.update();
    part(frame, 'Lienzo', 'plane', art, [0, fy, .565], [fw, 1, fh], [90, 0, 0], false);
    for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) part(frame, 'Bola del marco', 'sphere', flavours[(i + dx + dy + 4) % 5], [dx * (fw / 2 + .06), fy + dy * (fh / 2 + .06), .57], [.12, .12, .12], [0, 0, 0], false);
    if (i === 2) part(frame, 'Abolladura', 'sphere', gold, [.18, fy + .3, .56], [.22, .18, .06], [0, 0, 0], false);
  });

  // ——— The gum curtain over the stair to the throne ———
  const strands: { e: pc.Entity; phase: number }[] = [];
  plan.forEach((row, pz) => [...row].forEach((c, px) => {
    if (c !== 'C') return;
    const cell = at(px, pz, 0, 'Cortina de chicle');
    part(cell, 'Barra', 'cylinder', plum, [0, 2.75, 0], [.12, 1.02, .12], [0, 0, 90], false);
    part(cell, 'Bambalina', 'sphere', crest, [0, 2.7, .05], [1.1, .3, .3], [0, 0, 0], false);
    for (let k = 0; k < 5; k++) {
      const pivot = new pc.Entity('Hebra'); pivot.setLocalPosition(-.4 + k * .2, 2.65, 0); cell.addChild(pivot);
      const length = 2.1 + jitter(px * 5 + k) * .45;
      part(pivot, 'Hebra de chicle', 'cylinder', k % 2 ? drip : crest, [0, -length / 2, 0], [.07, length, .07], [0, 0, 0], false);
      part(pivot, 'Gota de la hebra', 'sphere', drip, [0, -length, 0], [.13, .2, .13], [0, 0, 0], false);
      strands.push({ e: pivot, phase: px * 1.3 + k * .9 });
    }
  }));
  // The stair behind it rises north towards a glowing doorway: the throne, for later.
  plan.forEach((row, pz) => [...row].forEach((c, px) => {
    if (c !== 'S') return;
    const step = 6 - pz, h = .3 + step * .42;
    part(root, 'Peldaño', 'box', step % 2 ? crest : gumWall, [x(px), h / 2, z(pz)], [1, h, 1]);
  }));
  part(root, 'Puerta del trono', 'sphere', dark, [x(16), 3.2, z(1) + .55], [2.4, 3.2, .2], [0, 0, 0], false);
  part(root, 'Resplandor del trono', 'sphere', core, [x(16), 3.0, z(1) + .5], [1.2, 1.8, .1], [0, 0, 0], false);
  light(16, 3.4, 2.2, 1.4, 5);

  // ——— El Corazón Líquido: the fountain in the hall ———
  const fountain = at(16, 13, 0, 'El Corazón Líquido');
  part(fountain, 'Pila', 'cylinder', plum, [0, .28, 0], [2.7, .56, 2.7]);
  palette.ring(fountain, 'Borde de la pila', crest, 1.33, .16, [0, .56, 0]);
  const pool = part(fountain, 'Líquido', 'cylinder', liquid, [0, .5, 0], [2.4, .04, 2.4], [0, 0, 0], false);
  part(fountain, 'Pie', 'cylinder', gumWall, [0, 1.05, 0], [.5, 1.1, .5]);
  part(fountain, 'Taza alta', 'cylinder', plum, [0, 1.62, 0], [1.3, .22, 1.3]);
  part(fountain, 'Bola de chicle', 'sphere', crest, [0, 2.2, 0], [.95, .9, .95]);
  part(fountain, 'Corazón', 'sphere', core, [0, 2.2, .3], [.38, .38, .22], [0, 0, 0], false);
  const falls: { e: pc.Entity; phase: number; angle: number }[] = [];
  for (let k = 0; k < 8; k++) falls.push({ e: part(fountain, 'Chorrito', 'sphere', liquid, [0, 1.6, 0], [.1, .14, .1], [0, 0, 0], false), phase: k / 8, angle: k / 8 * Math.PI * 2 });
  light(16, 2.8, 13, 2.2, 7.5);

  // ——— Twisted wrapper columns ———
  plan.forEach((row, pz) => [...row].forEach((c, px) => {
    if (c !== 'O') return;
    const col = at(px, pz, 0, 'Columna de envoltorio');
    part(col, 'Basa', 'cylinder', plum, [0, .15, 0], [.9, .3, .9]);
    for (let k = 0; k < 7; k++) part(col, 'Envoltorio retorcido', 'box', k % 2 ? wrapperWhite : crest, [0, .3 + .4 * (k + .5), 0], [.55, .41, .55], [0, k * 26 + px * 9, 0]);
    part(col, 'Capitel', 'cone', crest, [0, 3.3, 0], [1, .5, 1], [180, 0, 0]);
    dome(col, 0, 3.75, 0, .7);
  }));
  function dome(parent: pc.Entity, px: number, y: number, pz: number, size: number) {
    part(parent, 'Pompa', 'sphere', skin, [px, y, pz], [size, size, size], [0, 0, 0], false);
    part(parent, 'Centro líquido', 'sphere', core, [px, y, pz], [size * .4, size * .4, size * .4], [0, 0, 0], false);
  }

  // ——— The east door (Ala Líquida): sealed, with gum oozing out from under it ———
  const door = at(22, 13, 0, 'Puerta del Ala Líquida');
  part(door, 'Hoja de la puerta', 'box', plum, [0, .9, 0], [.3, 1.8, 1.1]);
  part(door, 'Arco de la puerta', 'cylinder', crest, [0, 1.8, 0], [1.2, .32, 1.2], [0, 0, 90]);
  part(door, 'Charco que rezuma', 'cylinder', drip, [-.85, .02, 0], [1.4, .04, 1.8], [0, 0, 0], false);

  // ——— The way back out: La Pompa from inside ———
  const pompa = at(16, 20, 0, 'La Pompa por dentro');
  palette.ring(pompa, 'Labio de chicle', crest, .78, .2, [0, .75, 0], [90, 0, 0]);
  part(pompa, 'Pompa', 'sphere', skin, [0, .75, 0], [1.45, 1.45, .3], [0, 0, 0], false);

  // ——— Gallery: the sweet table ———
  const table = at(5, 10, 0, 'Mesita del bol');
  part(table, 'Pata', 'cylinder', plum, [0, .3, 0], [.16, .6, .16]);
  part(table, 'Tablero', 'cylinder', crest, [0, .62, 0], [.8, .06, .8]);
  part(table, 'Bol', 'sphere', wrapperWhite, [0, .66, 0], [.5, .22, .5], [0, 0, 0], false);

  // ——— Wrapper room: crumpled giant wrappers, ribbons, and the drain ———
  const stripes = (() => {
    const c = document.createElement('canvas'); c.width = 64; c.height = 64;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#fbeef3'; ctx.fillRect(0, 0, 64, 64);
    ctx.fillStyle = '#ff6fae'; for (let i = 0; i < 4; i++) ctx.fillRect(i * 16, 0, 8, 64);
    const m = mat('#ffffff', .75); m.diffuseMap = texture(c); m.update(); return m;
  })();
  plan.forEach((row, pz) => [...row].forEach((c, px) => {
    if (c !== 'w') return;
    const heap = at(px, pz, 0, 'Envoltorios arrugados');
    for (let k = 0; k < 3; k++) {
      const seed = px * 13 + pz * 5 + k;
      const sx = .5 + jitter(seed) * .35, sy = .3 + jitter(seed + 1) * .35;
      part(heap, 'Envoltorio arrugado', 'box', stripes, [(jitter(seed + 2) - .5) * .4, sy / 2 + k * .18, (jitter(seed + 3) - .5) * .4], [sx, sy, sx * .8], [jitter(seed + 4) * 40 - 20, jitter(seed + 5) * 180, jitter(seed + 6) * 40 - 20]);
      for (const side of [-1, 1]) part(heap, 'Punta retorcida', 'cone', stripes, [side * (sx / 2 + .12), sy / 2 + k * .18, 0], [.22, .3, .22], [0, 0, side * 90], false);
    }
  }));
  const drain = at(5, 16, 0, 'Sumidero');
  part(drain, 'Aro del sumidero', 'cylinder', plum, [0, .03, 0], [1.05, .05, 1.05], [0, 0, 0], false);
  part(drain, 'Fondo oscuro', 'cylinder', dark, [0, .035, 0], [.85, .05, .85], [0, 0, 0], false);
  for (const dz of [-.24, -.08, .08, .24]) part(drain, 'Barrote', 'box', skirting, [0, .07, dz], [.8, .03, .06], [0, 0, 0], false);
  part(drain, 'Rezumo rosa', 'cylinder', drip, [.35, .02, .3], [.6, .03, .5], [0, 0, 0], false);
  light(5, 2.6, 15.5, 1.2, 6);

  // ——— Floating bubbles in the hall ———
  const bubbles = Array.from({ length: 12 }, (_, i) => {
    const e = part(root, 'Burbuja flotante', 'sphere', skin, [0, 0, 0], [.3, .3, .3], [0, 0, 0], false);
    return { e, px: 11.5 + jitter(i + 70) * 9.5, pz: 8.5 + jitter(i + 90) * 10.5, speed: .25 + jitter(i + 110) * .25, phase: jitter(i + 130), size: .18 + jitter(i + 150) * .26 };
  });

  let time = 0;
  return {
    update(dt: number, animate: boolean) {
      if (!animate) return;
      time += dt;
      for (const d of drips) { const s = d.e.getLocalScale(); d.e.setLocalScale(s.x, d.length * (1 + Math.sin(time * .8 + d.phase) * .14), s.z); }
      for (const s of strands) s.e.setLocalEulerAngles(Math.sin(time * 1.1 + s.phase) * 4, 0, Math.sin(time * .9 + s.phase * 1.3) * 5);
      pool.setLocalPosition(0, .5 + Math.sin(time * 1.6) * .02, 0);
      for (const f of falls) {
        const t = (time * .7 + f.phase) % 1, r = .55 + t * .45;
        f.e.setLocalPosition(Math.cos(f.angle) * r, 1.6 - t * t * 1.1, Math.sin(f.angle) * r);
      }
      for (const b of bubbles) {
        const t = (time * b.speed * .3 + b.phase) % 1, s = b.size * Math.min(1, t * 8) * (t > .94 ? (1 - t) / .06 : 1);
        b.e.setPosition(x(b.px + Math.sin(time * .6 + b.phase * 9) * .3), .2 + t * 3.6, z(b.pz));
        b.e.setLocalScale(s, s, s);
      }
    },
    destroy() { palette.materials.forEach(m => m.destroy()); palette.meshes.forEach(m => m.destroy()); lights.length = 0; },
  };
}
