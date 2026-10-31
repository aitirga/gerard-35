import type * as pc from 'playcanvas';
import type { Face, RoomKit } from './home-scenery';

/**
 * El Nucli inside (docs/places/nucli.md): an old Sants shop floor of hydraulic tiles, a wall of game
 * boxes floor to ceiling, the counter before a wine-red wall with the name, the play hall's six
 * green-felt tables with games left half played under warm pendants, and the back room behind a
 * curtain, where a round table waits between unopened boxes (Bernat's seat, `NUCLI_BERNAT_SEAT`).
 * Every box title and cover is invented and painted here: no real game's art or logo.
 */
const TITLES = [
  'Faro de Niebla', 'Los Telares', 'Vapor Vell', 'Mercado de Sombras', 'Rodalies', 'La Colonia', 'Sal y Viento',
  'Castellers', 'Cartógrafos', 'Noche en Montjuïc', 'Mil Puertas', 'El Último Tranvía', 'Huerto Urbano',
  'Pescadores', 'Reinos de Papel', 'La Feria', 'Cent Cases', 'Constelaciones', 'Gremios', 'Ruta del Té',
  'Ciutat Vella', 'Lobos y Ovejas', 'Ferrocarril', 'Abejas', 'Mareas', 'El Mapa Roto', 'Tinta y Hueso',
  'Sis Torres', 'Viento Norte', 'La Vendimia', 'Linterna', 'Fábrica', 'Hilos', 'Islas', 'Cometa',
];
/** Box colours: many and muted, so the wall reads as a mosaic and Gerard stays the strongest thing on screen. */
const BOX_COLOURS = ['#8c3b32', '#2f4a6b', '#d1a54a', '#3f6b4f', '#e7dcc6', '#5a3f5f', '#c8643f', '#1f2a33', '#b9c4c9',
  '#7a8f4a', '#a64b2a', '#d9b25a', '#2e5e6e', '#6b2f3a', '#f0ead8', '#3d3d3d', '#c9a27a', '#567d9c', '#8a6a3f', '#4d6b6b'];
const FELT = '#2f4a3a', WINE = '#5d0e11', CREAM = '#f3e6d0', LAMP = '#ffcf8a';

export function furnishNucli(r: RoomKit) {
  const { box, cyl, ball, cone, canvas, painted, onWall, chair, jitter, root, face: FACE } = r;
  /** Materials shared by name and colour, so each kind of piece is one draw once batched. */
  const made = new Map<string, pc.StandardMaterial>();
  const mat = (name: string, hex: string, gloss = 0.2, glow = 0) => {
    const key = `${name}|${hex}|${gloss}|${glow}`;
    let m = made.get(key);
    if (!m) { m = r.mat(name, hex, gloss, glow); made.set(key, m); }
    return m;
  };
  /** A picture that never folds joins the static batch (one draw per material). */
  const picture = (parent: pc.Entity, m: pc.Material, face: Face, px: number, pz: number, yc: number, w: number, h: number) => {
    const holder = r.picture(parent, m, face, px, pz, yc, w, h);
    if (parent === root) (holder.children[0] as pc.Entity).render!.batchGroupId = r.kit.batch;
    return holder;
  };
  const birch = mat('Contrachapado de abedul', '#d8b48a', 0.3);
  const birchEdge = mat('Canto de abedul', '#bf9466', 0.3);
  const walnut = mat('Nogal', '#6b4a32', 0.35);
  const felt = mat('Tapete verde', FELT, 0.04);
  const wine = mat('Granate', WINE, 0.18);
  const green = mat('Pared verde botella', '#355443', 0.12);
  const black = mat('Hierro negro', '#2a2d30', 0.35);
  const steel = mat('Estantería metálica', '#8d9296', 0.45);
  const kraft = [mat('Cartón', '#b8905f', 0.08), mat('Cartón claro', '#c9a674', 0.08), mat('Cartón oscuro', '#9c7a4f', 0.08)];
  const brass = mat('Latón', '#b8913f', 0.7);
  const paper = mat('Papel', '#f4efe2', 0.1);
  const bulb = mat('Bombilla encendida', '#ffe3b3', 0.2, 1.6);
  const pieceColours = ['#c8402f', '#2f62a8', '#e0b23a', '#3f8a4f', '#f1ece0', '#2a2a2a'].map((hex, i) => mat(`Ficha ${i}`, hex, 0.35));
  const covers = painted('Portadas', coverSheet(0), 0.25);
  const enamel = mat('Esmalte verde', '#2c4a3b', 0.55);

  // ——— Shared pieces ———
  /** Paints a wall face cell by cell from `a0` to `a1` along it, each piece folding with its wall. */
  function paintWall(m: pc.Material, face: Face, line: number, a0: number, a1: number, y0 = 0, y1 = r.wallHeight) {
    for (let a = a0; a < a1 - 0.01;) {
      const b = Math.min(a1, Math.floor(a + 0.5) + 0.5), c = (a + b) / 2;
      if (face === 'south') box('Pintura', m, c, line + FACE + 0.006, y0, b - a, y1 - y0, 0.012, onWall('south', c, line + FACE));
      else box('Pintura', m, line + FACE + 0.006, c, y0, 0.012, y1 - y0, b - a, onWall('east', line + FACE, c));
      a = b;
    }
  }
  /** A pendant with a green enamel shade over a table, its warm light and the pool it leaves. */
  function pendant(px: number, pz: number, drop = 1.95, strength = 0.32, radius = 1.5) {
    // Shades and cords cast no sun shadow: on the floor they would read as stains.
    box('Cable', black, px, pz, drop + 0.2, 0.012, r.wallHeight - drop - 0.2, 0.012).render!.castShadows = false;
    const shade = cone('Pantalla esmaltada', enamel, px, pz, drop, 0.42, 0.22, 0.42);
    shade.setEulerAngles(180, 0, 0); shade.render!.castShadows = false;
    ball('Bombilla', bulb, px, pz, drop - 0.05, 0.12, 0.1, 0.12);
    r.light(px, drop - 0.1, pz, LAMP, 0.9, 4.2);
    r.pool(px, pz, radius, LAMP, strength);
  }
  /**
   * A unit of square cubes against a wall, the board-game shop's shelf: each cube holds a row of
   * boxes spine out, a stack lying flat or one box face out, painted as one picture behind the
   * frame. `face` is the way it faces, `along` its centre along the wall.
   */
  function cubes(face: Face, wallLine: number, along: number, cols: number, rows: number, seed: number) {
    const cell = 0.38, depth = 0.4, board = 0.025, width = cols * cell + board, height = rows * cell + board;
    const front = wallLine + FACE + depth, mid = wallLine + FACE + depth / 2;
    const at = (u: number, w: number, d: number, y0: number, h: number, m: pc.Material = birch) => face === 'south'
      ? box('Estantería de cubos', m, u, mid, y0, w, h, d) : box('Estantería de cubos', m, mid, u, y0, d, h, w);
    for (let k = 0; k <= cols; k++) at(along - width / 2 + board / 2 + k * cell, board, depth, 0.05, height);
    for (let k = 0; k <= rows; k++) at(along, width, depth, 0.05 + k * cell, board);
    at(along, width, depth - 0.04, 0, 0.05, birchEdge);
    const contents = painted(`Cubos ${seed}`, cubeArt(cols, rows, seed), 0.25, 0.08);
    picture(root, contents, face, face === 'south' ? along : front - 0.05, face === 'south' ? front - 0.05 : along, 0.05 + height / 2, width - board, height - board);
  }
  /** A small game box lying on a table or shelf, its cover up. */
  function gameBox(px: number, pz: number, y0: number, w: number, d: number, h: number, colour: number, yaw = 0) {
    box('Caja de juego', mat(`Caja ${colour}`, BOX_COLOURS[colour % BOX_COLOURS.length], 0.3), px, pz, y0, w, h, d).setEulerAngles(0, yaw, 0);
  }

  shop(); hall(); backRoom(); street();

  // ——— La tienda: hydraulic tiles, the wall of boxes, the counter before the wine wall ———
  function shop() {
    // The wall of boxes, floor to ceiling, along the west wall: four units of cubes, stock piled before them.
    for (let k = 0; k < 4; k++) {
      cubes('east', 0, 16.55 + k * 1.98 + 0.97, 5, 6, k);
      for (let i = 0; i < 3; i++) {
        const pz = 16.55 + k * 1.98 + 0.35 + i * 0.62, n = 2 + Math.floor(jitter(k * 3 + i) * 3);
        for (let j = 0; j < n; j++) gameBox(0.82 + (jitter(k + i + j) - 0.5) * 0.06, pz, j * 0.1, 0.36, 0.52, 0.1, k * 7 + i * 3 + j, (jitter(k * 5 + i + j) - 0.5) * 14);
      }
    }
    // The wine-red wall with the shop's name painted on it, a pegboard of sleeves and dice beside it.
    paintWall(wine, 'south', 16, FACE, 7 + FACE);
    const [name, ctx] = canvas(512, 160);
    ctx.fillStyle = WINE; ctx.fillRect(0, 0, 512, 160);
    ctx.fillStyle = CREAM; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = '700 92px Georgia, "Times New Roman", serif'; ctx.fillText('EL NUCLI', 256, 66, 480);
    ctx.font = '600 22px "Helvetica Neue", Arial, sans-serif'; ctx.fillText('JOCS DE TAULA  ·  CARTES  ·  ROL', 256, 136, 470);
    ctx.fillRect(96, 116, 320, 2);
    picture(onWall('south', 3.3, 16 + FACE), painted('El Nucli', name, 0.15), 'south', 3.3, 16 + FACE + 0.016, 1.92, 3.2, 1.0);
    const [peg, pctx] = canvas(160, 256);
    pctx.fillStyle = '#d9c8a6'; pctx.fillRect(0, 0, 160, 256);
    pctx.fillStyle = '#00000030'; for (let i = 0; i < 10; i++) for (let k = 0; k < 16; k++) pctx.fillRect(8 + i * 15, 8 + k * 15, 3, 3);
    for (let i = 0; i < 12; i++) {
      // Packs of card sleeves and dice on hooks, in rows.
      pctx.fillStyle = BOX_COLOURS[(i * 7) % BOX_COLOURS.length]; pctx.fillRect(10 + (i % 4) * 37, 14 + Math.floor(i / 4) * 80, 30, 56);
      pctx.fillStyle = '#ffffff55'; pctx.fillRect(14 + (i % 4) * 37, 20 + Math.floor(i / 4) * 80, 22, 10);
    }
    picture(onWall('south', 6.3, 16 + FACE), painted('Expositor de fundas', peg, 0.2), 'south', 6.3, 16 + FACE + 0.02, 1.6, 0.85, 1.36);

    // The counter: birch, the till, a jar of loose dice, the bell and a note; the glass case of single cards.
    box('Mostrador', birch, 3.95, 17.95, 0, 2.9, 0.95, 0.72);
    box('Zócalo del mostrador', walnut, 3.95, 18.28, 0, 2.9, 0.08, 0.08);
    box('Encimera', birchEdge, 4.95, 17.95, 0.95, 4.9, 0.05, 0.8);
    box('Caja registradora', black, 3.0, 17.85, 1.0, 0.38, 0.12, 0.3);
    box('Pantalla de la caja', mat('Pantalla apagada', '#1d2a33', 0.7, 0.2), 3.0, 17.78, 1.12, 0.3, 0.18, 0.03).setEulerAngles(-18, 0, 0);
    cyl('Bote de dados', mat('Vidrio del bote', '#cfe3e6', 0.9), 4.1, 17.95, 1.0, 0.24, 0.16, 0.24);
    for (let i = 0; i < 9; i++) box('Dado suelto', pieceColours[i % pieceColours.length], 4.02 + jitter(i) * 0.16, 17.88 + jitter(i + 5) * 0.14, 1.07 + (i % 3) * 0.03, 0.035, 0.035, 0.035);
    r.solid('Dado de veinte caras', r.d20, mat('Dado verde', '#3f8a4f', 0.7), 4.6, 17.9, 1.0, 0.1, 0.1, 0.1);
    cyl('Base de la campanita', black, 5.0, 18.05, 1.0, 0.11, 0.02, 0.11);
    ball('Campanita', brass, 5.0, 18.05, 1.02, 0.09, 0.07, 0.09);
    box('Nota', paper, 5.35, 18.05, 1.0, 0.16, 0.004, 0.12).setEulerAngles(0, 14, 0);
    // The glass case: lit cards in sleeves, the dearest on the top row under their own light.
    const [cards, cctx] = canvas(256, 128);
    cctx.fillStyle = '#1c1a18'; cctx.fillRect(0, 0, 256, 128);
    for (let row = 0; row < 3; row++) for (let k = 0; k < 9; k++) {
      const x0 = 8 + k * 27, y0 = 8 + row * 40;
      cctx.fillStyle = '#e8e2d2'; cctx.fillRect(x0, y0, 22, 30);
      cctx.fillStyle = BOX_COLOURS[(row * 9 + k * 4) % BOX_COLOURS.length]; cctx.fillRect(x0 + 2, y0 + 2, 18, 17);
      cctx.fillStyle = '#7a6f5f'; cctx.fillRect(x0 + 3, y0 + 22, 16, 2); cctx.fillRect(x0 + 3, y0 + 26, 10, 2);
      if (row === 0) { cctx.fillStyle = '#fff6d0'; cctx.fillRect(x0 - 1, y0 - 2, 24, 2); }
    }
    box('Vitrina', black, 6.6, 17.95, 0, 1.6, 0.06, 0.72);
    for (const px of [5.83, 7.37]) box('Montante de la vitrina', black, px, 17.95, 0, 0.04, 0.95, 0.72);
    picture(root, painted('Cartas en la vitrina', cards, 0.4, 0.55), 'south', 6.6, 18.3, 0.52, 1.5, 0.8);
    const front = box('Cristal de la vitrina', r.glass, 6.6, 18.32, 0.06, 1.52, 0.88, 0.02);
    front.render!.castShadows = false;
    r.light(6.6, 0.8, 18.0, '#fff1d6', 0.35, 1.6);

    // The gondola: a low double-sided shelf of boxes face out, a big box on show on top.
    box('Zócalo de la góndola', walnut, 7, 21.5, 0, 2.7, 0.1, 1.4);
    box('Góndola', birch, 7, 21.5, 0.1, 2.6, 1.15, 1.2);
    box('Tapa de la góndola', birchEdge, 7, 21.5, 1.25, 2.75, 0.04, 1.45);
    for (const [k, pz] of [[0, 22.12], [1, 20.88]] as const) {
      for (const y of [0.42, 0.82]) box('Balda de la góndola', birchEdge, 7, pz + (k ? -0.02 : 0.02), y, 2.6, 0.03, 0.12);
      if (!k) picture(root, covers, 'south', 7, pz + 0.03, 0.68, 2.5, 0.95);
    }
    picture(root, painted('Lomos de la góndola', cubeArt(3, 2, 9), 0.25), 'east', 8.32, 21.5, 0.68, 1.1, 0.95);
    gameBox(6.4, 21.4, 1.29, 0.42, 0.42, 0.11, 3, 12);
    gameBox(6.42, 21.38, 1.4, 0.36, 0.36, 0.09, 11, -6);
    gameBox(7.6, 21.55, 1.29, 0.5, 0.36, 0.14, 6, 4);

    // The shop window: stepped risers with boxes standing face out to the street, the tournament poster on the glass.
    for (const [cx, w] of [[2.6, 3.2], [9.6, 3.6]] as const) {
      box('Escaparate', birch, cx, 24.55, 0, w, 0.32, 0.75);
      box('Escalón del escaparate', birch, cx, 24.35, 0.32, w, 0.3, 0.35);
      for (let i = 0; i < Math.round(w / 0.5); i++) {
        const px = cx - w / 2 + 0.3 + i * 0.5, tall = i % 2;
        const e = box('Caja en el escaparate', mat(`Caja ${i + (cx > 5 ? 7 : 0)}`, BOX_COLOURS[(i * 3 + (cx > 5 ? 7 : 0)) % BOX_COLOURS.length], 0.3), px, tall ? 24.35 : 24.75, tall ? 0.62 : 0.32, 0.38, 0.38, 0.09);
        e.setEulerAngles(-8, (i % 3 - 1) * 6, 0);
      }
    }
    const [poster, p] = canvas(128, 180);
    p.fillStyle = '#efe6d2'; p.fillRect(0, 0, 128, 180);
    p.fillStyle = WINE; p.fillRect(0, 0, 128, 44);
    p.fillStyle = CREAM; p.textAlign = 'center'; p.font = '800 24px "Helvetica Neue", Arial, sans-serif'; p.fillText('TORNEIG', 64, 30);
    p.fillStyle = '#2a2d30'; p.font = '700 15px "Helvetica Neue", Arial, sans-serif'; p.fillText('DIVENDRES · 19 H', 64, 162);
    for (let k = 0; k < 5; k++) { p.save(); p.translate(64, 104); p.rotate((k - 2) * 0.22); p.fillStyle = ['#2f4a6b', '#c8643f', '#3f6b4f', '#d1a54a', '#5a3f5f'][k]; p.fillRect(-14, -40, 28, 40); p.restore(); }
    picture(root, painted('Cartel del torneo', poster, 0.3), 'south', 10.2, 24.86, 1.45, 0.55, 0.78);
    // The street door: a wine frame inside the glazing, a push bar, the OBERT sign and the bell over it.
    for (const px of [5.55, 6.45]) box('Marco de la puerta', wine, px, 24.82, 0, 0.07, 2.2, 0.06);
    box('Dintel de la puerta', wine, 6, 24.82, 2.16, 0.97, 0.07, 0.06);
    box('Barra de la puerta', brass, 6, 24.8, 1.0, 0.6, 0.04, 0.04);
    const [open, o] = canvas(128, 48);
    o.fillStyle = '#f4efe2'; o.fillRect(0, 0, 128, 48); o.fillStyle = '#2f6b45'; o.textAlign = 'center'; o.font = '800 30px "Helvetica Neue", Arial, sans-serif'; o.fillText('OBERT', 64, 35);
    picture(root, painted('Obert', open, 0.2), 'south', 6, 24.8, 1.55, 0.36, 0.14);
    box('Brazo de la campana', black, 6, 24.62, 2.12, 0.03, 0.03, 0.3);
    cone('Campana de la puerta', brass, 6, 24.48, 1.98, 0.1, 0.13, 0.1);
    // A low table of dice trays and card sleeves along the east side, seen from above.
    box('Mesa de accesorios', walnut, 12.2, 19.5, 0, 0.75, 0.8, 3.6);
    for (let i = 0; i < 8; i++) {
      box('Bandeja', black, 12.2, 17.95 + i * 0.44, 0.8, 0.62, 0.04, 0.4);
      for (let k = 0; k < 6; k++) box('Dado', pieceColours[(i + k) % pieceColours.length], 12.0 + jitter(i * 7 + k) * 0.4, 17.85 + i * 0.44 + jitter(i * 3 + k) * 0.2, 0.84, 0.04, 0.04, 0.04);
    }
    pendant(3.6, 20.6, 2.05, 0.28, 1.6);
    pendant(9.6, 20.6, 2.05, 0.28, 1.6);
    pendant(5, 18.2, 2.15, 0.22, 1.2);
  }

  // ——— La sala de juego: green walls, six tables with games left half played ———
  function hall() {
    paintWall(green, 'east', 0, 7 + FACE, 16 - FACE);
    paintWall(green, 'south', 7, FACE, 7.5);
    paintWall(green, 'south', 7, 9.5, 13 - FACE);
    // The demo games against the back wall, facing the tables.
    for (let k = 0; k < 3; k++) cubes('south', 7, 0.7 + k * 1.6 + 0.78, 4, 5, k + 4);
    // The cork board of tournaments and game nights; a new sheet pinned over the rest, blank.
    const [board, b] = canvas(256, 176);
    b.fillStyle = '#c49a64'; b.fillRect(0, 0, 256, 176);
    for (let i = 0; i < 900; i++) { b.fillStyle = jitter(i) > 0.5 ? '#00000014' : '#ffffff12'; b.fillRect(jitter(i + 3) * 256, jitter(i + 7) * 176, 2, 2); }
    const flyers: [number, number, number, number, string, string][] = [
      [14, 12, 70, 92, '#f4efe2', 'TORNEIG'], [92, 18, 64, 80, '#e6d38f', 'ROL · DIJOUS'], [166, 10, 76, 60, '#d6e2e6', 'DRAFT'],
      [20, 108, 90, 58, '#f0e2d0', 'ES BUSCA JUGADOR'], [168, 80, 74, 86, '#e2ead6', 'PRESENTACIÓ'],
    ];
    for (const [x0, y0, w, h, fill, title] of flyers) {
      b.fillStyle = '#00000030'; b.fillRect(x0 + 3, y0 + 3, w, h);
      b.fillStyle = fill; b.fillRect(x0, y0, w, h);
      b.fillStyle = '#2a2d30'; b.font = '800 10px "Helvetica Neue", Arial, sans-serif'; b.fillText(title, x0 + 5, y0 + 15, w - 10);
      for (let k = 0; k < 4; k++) { b.fillStyle = '#8a8070'; b.fillRect(x0 + 5, y0 + 24 + k * 9, w - 14 - (k % 2) * 12, 2); }
      b.fillStyle = '#c8402f'; b.beginPath(); b.arc(x0 + w / 2, y0 + 4, 3, 0, Math.PI * 2); b.fill();
    }
    b.fillStyle = '#00000030'; b.fillRect(103, 63, 58, 74); b.fillStyle = '#ffffff'; b.fillRect(100, 60, 58, 74);
    b.fillStyle = '#2f62a8'; b.beginPath(); b.arc(129, 64, 3, 0, Math.PI * 2); b.fill();
    const boardParent = onWall('south', 6.6, 7 + FACE);
    box('Marco del tablón', walnut, 6.6, 7 + FACE + 0.02, 1.0, 1.36, 0.95, 0.04, boardParent);
    picture(boardParent, painted('Tablón de corcho', board, 0.05), 'south', 6.6, 7 + FACE + 0.045, 1.475, 1.28, 0.87);
    // The drinks fridge, lit, and the bin beside it.
    box('Nevera', mat('Nevera blanca', '#e8e8e4', 0.5), 11.6, 7.55, 0, 1.3, 1.85, 0.8);
    const [fridge, f] = canvas(128, 192);
    f.fillStyle = '#1d2326'; f.fillRect(0, 0, 128, 192);
    for (let row = 0; row < 4; row++) {
      f.fillStyle = '#9aa7ad'; f.fillRect(4, 44 + row * 44, 120, 3);
      for (let k = 0; k < 8; k++) { f.fillStyle = ['#c8402f', '#e0b23a', '#2f62a8', '#3f8a4f', '#f1ece0', '#c8643f'][(row * 3 + k) % 6]; f.fillRect(8 + k * 14.5, 14 + row * 44, 10, 28); }
    }
    f.fillStyle = '#ffffff22'; f.fillRect(0, 0, 128, 10);
    picture(root, painted('Nevera de bebidas', fridge, 0.6, 0.45), 'south', 11.6, 7.96, 1.0, 1.1, 1.6);
    cyl('Papelera', black, 12.58, 7.6, 0, 0.32, 0.6, 0.32);
    // The curtain over the back-room door, held open at both jambs.
    box('Barra de la cortina', black, 8.5, 7, 2.2, 2.1, 0.03, 0.03);
    const cloth = mat('Cortina', '#5a2a22', 0.06);
    for (const [px, k] of [[7.7, 0], [9.3, 1]] as const) {
      for (let i = 0; i < 3; i++) cyl('Pliegue de la cortina', cloth, px + (i - 1) * 0.09 * (k ? -1 : 1), 7 + (i % 2) * 0.03, 0.02, 0.12, 2.18, 0.08);
      box('Alzapaño', brass, px, 7.06, 1.05, 0.3, 0.04, 0.05);
    }
    // A bench along the wall behind the shop, and six tables, each with its game left half played.
    box('Banco', birch, 4, 15.55, 0.42, 6.6, 0.05, 0.5);
    for (const px of [1.2, 4, 6.8]) box('Pata del banco', walnut, px, 15.55, 0, 0.08, 0.42, 0.42);
    const tables: [number, number][] = [[2.5, 10.5], [6.5, 10.5], [10.5, 10.5], [2.5, 13.5], [6.5, 13.5], [10.5, 13.5]];
    tables.forEach(([cx, cz], i) => {
      table(cx, cz, i);
      pendant(cx, cz, 1.85, 0.26, 1.4);
    });
  }
  /** A square play table with green felt, four chairs pushed back as if everyone stood up at once, and a game on it. */
  function table(cx: number, cz: number, i: number) {
    const top = 0.74;
    box('Mesa de juego', walnut, cx, cz, top - 0.06, 1.5, 0.06, 1.5);
    box('Tapete', felt, cx, cz, top, 1.36, 0.008, 1.36);
    for (const [dx, dz] of [[-0.66, -0.66], [0.66, -0.66], [-0.66, 0.66], [0.66, 0.66]]) box('Pata de la mesa', walnut, cx + dx, cz + dz, 0, 0.07, top - 0.06, 0.07);
    const seat = mat('Asiento de madera', '#8a5a3a', 0.25);
    const pushed = (k: number) => 0.04 + jitter(i * 4 + k) * 0.12;
    chair(cx, cz - 0.82 - pushed(0), 'south', seat, black);
    chair(cx, cz + 0.82 + pushed(1), 'north', seat, black);
    chair(cx - 0.82 - pushed(2), cz, 'east', seat, black);
    chair(cx + 0.82 + pushed(3), cz, 'west', seat, black);
    const y = top + 0.008;
    const game = i % 6;
    if (game === 0) {
      // Tiles laid edge to edge, wooden figures on them, the score pad and its pencil.
      const tile = [mat('Loseta campo', '#7f9a4f', 0.2), mat('Loseta ciudad', '#c9a46a', 0.2), mat('Loseta camino', '#b9b4a2', 0.2)];
      for (let k = 0; k < 14; k++) box('Loseta', tile[k % 3], cx - 0.32 + (k % 5) * 0.13, cz - 0.2 + Math.floor(k / 5) * 0.13, y, 0.12, 0.012, 0.12);
      for (let k = 0; k < 5; k++) cone('Figura de madera', pieceColours[k % 4], cx - 0.3 + jitter(k + 3) * 0.6, cz - 0.15 + jitter(k + 9) * 0.3, y + 0.012, 0.05, 0.08, 0.05);
      box('Libreta de puntos', paper, cx + 0.42, cz + 0.4, y, 0.2, 0.01, 0.26).setEulerAngles(0, -12, 0);
      box('Lápiz', mat('Lápiz', '#e0b23a', 0.3), cx + 0.45, cz + 0.35, y + 0.01, 0.015, 0.012, 0.2).setEulerAngles(0, 30, 0);
    } else if (game === 1) {
      // A card game: hands face down where each player sat, the deck and the discard pile.
      const back = mat('Dorso de carta', '#2f4a6b', 0.3), face = mat('Carta', '#efe6d2', 0.3);
      for (const [dx, dz, yaw] of [[0, -0.5, 0], [0, 0.5, 180], [-0.5, 0, 90], [0.5, 0, -90]] as const) for (let k = 0; k < 4; k++) box('Carta', back, cx + dx + (dz ? (k - 1.5) * 0.06 : 0), cz + dz + (dx ? (k - 1.5) * 0.06 : 0), y + k * 0.002, 0.07, 0.003, 0.1).setEulerAngles(0, yaw + (k - 1.5) * 9, 0);
      box('Mazo', back, cx - 0.1, cz, y, 0.07, 0.04, 0.1);
      box('Descarte', face, cx + 0.1, cz + 0.02, y, 0.07, 0.015, 0.1).setEulerAngles(0, 18, 0);
    } else if (game === 2) {
      // A big board of a city and its market, cubes and discs on it.
      box('Tablero', painted(`Tablero ${i}`, boardArt(i), 0.2), cx, cz, y, 0.9, 0.012, 0.62);
      for (let k = 0; k < 16; k++) box('Cubo', pieceColours[k % 5], cx - 0.38 + jitter(k * 3) * 0.76, cz - 0.26 + jitter(k * 5 + 1) * 0.52, y + 0.012, 0.035, 0.035, 0.035);
      for (let k = 0; k < 4; k++) cyl('Disco', pieceColours[k], cx + 0.52, cz - 0.3 + k * 0.12, y, 0.07, 0.025, 0.07);
    } else if (game === 3) {
      // Dice in a felt tray, a sheet of scores, a cup knocked on its side.
      box('Bandeja de dados', walnut, cx - 0.2, cz, y, 0.4, 0.05, 0.3);
      for (let k = 0; k < 6; k++) box('Dado', pieceColours[k], cx - 0.32 + (k % 3) * 0.1, cz - 0.06 + Math.floor(k / 3) * 0.1, y + 0.05, 0.045, 0.045, 0.045).setEulerAngles(0, k * 23, 0);
      box('Hoja de puntos', paper, cx + 0.32, cz + 0.1, y, 0.24, 0.004, 0.32).setEulerAngles(0, 8, 0);
      cyl('Cubilete', mat('Cuero', '#5b3a26', 0.2), cx + 0.1, cz - 0.38, y + 0.05, 0.1, 0.13, 0.1).setEulerAngles(90, 30, 0);
    } else if (game === 4) {
      // A map of hexes with little wooden houses and roads.
      box('Mapa de hexágonos', painted(`Tablero ${i}`, boardArt(i), 0.2), cx, cz, y, 0.8, 0.012, 0.8);
      for (let k = 0; k < 7; k++) box('Casita', pieceColours[k % 4], cx - 0.28 + jitter(k * 7) * 0.56, cz - 0.28 + jitter(k * 11) * 0.56, y + 0.012, 0.04, 0.04, 0.04);
      for (let k = 0; k < 6; k++) box('Camino', pieceColours[(k + 1) % 4], cx - 0.25 + jitter(k * 13) * 0.5, cz - 0.25 + jitter(k * 17) * 0.5, y + 0.012, 0.09, 0.015, 0.02).setEulerAngles(0, k * 60, 0);
    } else {
      // A game still being set up: the box open, its lid aside, the trays out.
      gameBox(cx - 0.2, cz - 0.15, y, 0.42, 0.42, 0.06, 4);
      gameBox(cx + 0.3, cz + 0.25, y, 0.43, 0.43, 0.025, 9, 20);
      for (let k = 0; k < 3; k++) box('Bandeja de piezas', mat('Bandeja', '#2a2a2a', 0.4), cx - 0.32 + k * 0.12, cz - 0.15, y + 0.06, 0.1, 0.03, 0.36);
      box('Reglamento', paper, cx + 0.3, cz - 0.3, y, 0.2, 0.006, 0.28).setEulerAngles(0, -20, 0);
    }
  }

  // ——— La trastienda: stock on steel shelves, unopened boxes, the round table under a bare bulb ———
  function backRoom() {
    // Steel shelving along the back wall, full of cardboard and shrink-wrapped boxes.
    const shelfDepth = 0.58;
    for (const u of [0.6, 4.6, 8.6, 12.4]) box('Montante metálico', steel, u, FACE + shelfDepth / 2, 0, 0.04, 2.3, shelfDepth);
    for (let k = 0; k < 5; k++) {
      const y = 0.08 + k * 0.52;
      box('Balda metálica', steel, 6.5, FACE + shelfDepth / 2, y, 11.8, 0.03, shelfDepth);
      if (k === 4) break;
      for (let at = 0.75; at < 12.2;) {
        const w = Math.min(0.35 + jitter(at * 7 + k) * 0.5, 12.32 - at), h = 0.22 + jitter(at * 3 + k) * 0.22;
        const wrapped = jitter(at * 11 + k) > 0.65;
        box(wrapped ? 'Juego precintado' : 'Caja de cartón', wrapped ? mat(`Caja ${Math.floor(at * 3 + k)}`, BOX_COLOURS[Math.floor(at * 3 + k) % BOX_COLOURS.length], 0.45) : kraft[Math.floor(at + k) % 3],
          at + w / 2, FACE + 0.06 + shelfDepth / 2, y + 0.03, w, h, shelfDepth - 0.12);
        at += w + 0.04;
      }
    }
    // Stacks of unopened cartons by the walls and before the curtain wall.
    const stack = (px: number, pz: number, n: number, seed: number) => {
      for (let k = 0; k < n; k++) {
        const s = 0.55 + jitter(seed + k) * 0.2;
        box('Caja de cartón', kraft[(seed + k) % 3], px + (jitter(seed * 3 + k) - 0.5) * 0.08, pz + (jitter(seed * 5 + k) - 0.5) * 0.08, k * 0.42, s, 0.42, s).setEulerAngles(0, (jitter(seed + k * 9) - 0.5) * 16, 0);
        box('Cinta', mat('Cinta de embalar', '#d9c08a', 0.4), px, pz, k * 0.42 + 0.42, 0.08, 0.004, s * 0.95);
      }
    };
    [[1, 2.2, 3], [1, 3.6, 2], [1, 5.0, 4], [12, 2.3, 2], [12, 3.6, 3], [12, 5.1, 1]].forEach(([px, pz, n], i) => stack(px, pz, n, i * 13 + 2));
    for (let px = 1; px <= 7; px++) stack(px, 6.1, 1 + Math.floor(jitter(px * 5) * 2), px * 7);
    for (const px of [10, 11, 12]) stack(px, 6.1, 1 + Math.floor(jitter(px * 3) * 2), px * 5);
    // A pallet just delivered: one new game, the whole print run, still shrink-wrapped; the hand truck that brought it.
    box('Palé', mat('Madera de palé', '#c4a676', 0.1), 10.9, 3.5, 0, 1.2, 0.14, 1.0);
    const wrapped = mat('Juego precintado', '#2e5e6e', 0.75);
    for (let layer = 0; layer < 4; layer++) for (let k = 0; k < 4; k++) {
      box('Juego precintado', wrapped, 10.6 + (k % 2) * 0.6, 3.25 + Math.floor(k / 2) * 0.5, 0.14 + layer * 0.28, 0.56, 0.27, 0.46).setEulerAngles(0, (jitter(layer * 4 + k) - 0.5) * 3, 0);
    }
    for (const dx of [-0.2, 0.2]) box('Varal de la carretilla', black, 12.4 + dx, 4.42, 0.05, 0.04, 1.25, 0.04).setEulerAngles(-12, 0, 0);
    box('Pala de la carretilla', black, 12.4, 4.3, 0.02, 0.45, 0.03, 0.25);
    for (const dx of [-0.26, 0.26]) cyl('Rueda', black, 12.4 + dx, 4.5, 0.075, 0.2, 0.05, 0.2).setEulerAngles(0, 0, 90);

    // The round table and its two chairs: Bernat's on the west, its back to the cartons and the curtain in sight; the other one empty.
    const cx = 5.5, cz = 3.5, top = 0.74;
    cyl('Mesa redonda', walnut, cx, cz, top - 0.05, 1.3, 0.05, 1.3);
    cyl('Pie de la mesa', black, cx, cz, 0.04, 0.1, top - 0.09, 0.1);
    cyl('Base de la mesa', black, cx, cz, 0, 0.55, 0.04, 0.55);
    const seat = mat('Asiento gastado', '#6e4a33', 0.25);
    chair(4.35, 3.3, 'east', seat, black);
    chair(6.65, 3.7, 'west', seat, black);
    // On it, a game half set up, two decks, a closed notebook with a pencil.
    box('Tablero a medio montar', painted('Tablero de la trastienda', boardArt(9), 0.2), cx + 0.05, cz - 0.1, top, 0.62, 0.01, 0.46).setEulerAngles(0, 8, 0);
    for (let k = 0; k < 5; k++) cone('Ficha', pieceColours[k % 4], cx - 0.2 + jitter(k * 19) * 0.4, cz - 0.25 + jitter(k * 23) * 0.3, top + 0.01, 0.045, 0.07, 0.045);
    box('Mazo', mat('Dorso de carta', '#2f4a6b', 0.3), cx - 0.4, cz + 0.32, top, 0.07, 0.035, 0.1);
    box('Mazo', mat('Dorso rojo', '#8c3b32', 0.3), cx + 0.42, cz + 0.28, top, 0.07, 0.03, 0.1).setEulerAngles(0, 25, 0);
    box('Libreta', mat('Tapa de la libreta', '#1f2a33', 0.3), cx - 0.18, cz + 0.4, top, 0.2, 0.02, 0.27).setEulerAngles(0, -10, 0);
    box('Lápiz', mat('Lápiz', '#e0b23a', 0.3), cx + 0.02, cz + 0.42, top + 0.02, 0.012, 0.012, 0.18).setEulerAngles(0, 20, 0);
    // The bare bulb on its cord: the room's only light.
    box('Cable', black, cx, cz, 1.95, 0.012, r.wallHeight - 1.95, 0.012);
    ball('Bombilla desnuda', bulb, cx, cz, 1.83, 0.11, 0.13, 0.11);
    r.light(cx, 1.85, cz, '#ffd59a', 0.95, 4.5);
    r.pool(cx, cz, 1.8, '#ffd59a', 0.3);
  }

  // ——— Outside the window: a strip of Sants pavement, so the shop sits on its street ———
  function street() {
    const pavement = mat('Panot de la acera', '#a3a29b', 0.08);
    box('Acera', pavement, 6.5, 26.05, -1.5, 15.2, 1.505, 1.8);
    box('Bordillo', mat('Bordillo de granito', '#8f8b84', 0.1), 6.5, 26.97, -1.5, 15.2, 1.52, 0.12);
  }

  /**
   * What fills a unit of cubes: in each, a stack of boxes lying flat (how most shops keep them), a
   * row standing on edge or one box face out. Game boxes, not books: square, thick, all about the
   * same size in a cube, each with the seam where its lid meets its base.
   */
  function cubeArt(cols: number, rows: number, seed: number) {
    const S = 96, [c, ctx] = canvas(cols * S, rows * S);
    ctx.fillStyle = '#2b2420'; ctx.fillRect(0, 0, c.width, c.height);
    for (let row = 0; row < rows; row++) for (let col = 0; col < cols; col++) {
      const x0 = col * S, y1 = (row + 1) * S, n = seed * 31 + row * 7 + col * 3, kind = jitter(n * 1.3);
      if (kind < 0.3) cover(ctx, x0 + 8, y1 - 84, 80, n);
      else if (kind < 0.7) {
        // A stack of boxes lying flat, each lid's band of colour and its title along the side.
        let y = y1;
        for (let k = 0; y > row * S + 30; k++) {
          const h = 17 + jitter(n + k * 5) * 9, w = 74 + jitter(n + k * 3) * 18, colour = BOX_COLOURS[(n + k * 3) % BOX_COLOURS.length], left = x0 + (S - w) / 2;
          ctx.fillStyle = colour; ctx.fillRect(left, y - h, w, h - 1);
          ctx.fillStyle = BOX_COLOURS[(n + k * 3 + 9) % BOX_COLOURS.length]; ctx.fillRect(left, y - h, 6, h - 1);
          ctx.fillStyle = '#00000038'; ctx.fillRect(left, y - 5, w, 1.5);
          ctx.fillStyle = shade(colour); ctx.font = '700 8px "Helvetica Neue", Arial, sans-serif'; ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
          ctx.fillText(TITLES[(n + k) % TITLES.length].toUpperCase(), x0 + S / 2 + 3, y - h / 2 - 1, w - 14);
          y -= h;
        }
      } else {
        // Boxes standing on edge, spine out: as thick as a box is deep, the same height across the cube.
        const tall = 72 + jitter(n * 2.1) * 16;
        let x = x0 + 3;
        for (let k = 0; x < x0 + S - 18; k++) {
          const w = Math.min(19 + jitter(n + k * 7) * 15, x0 + S - 3 - x), h = tall + (jitter(n + k * 11) - 0.5) * 6, colour = BOX_COLOURS[(n + k * 5) % BOX_COLOURS.length];
          ctx.fillStyle = colour; ctx.fillRect(x, y1 - h, w, h);
          ctx.fillStyle = BOX_COLOURS[(n + k * 5 + 9) % BOX_COLOURS.length]; ctx.fillRect(x, y1 - h + 4, w, 10);
          ctx.fillStyle = '#00000038'; ctx.fillRect(x + w - 5, y1 - h, 1.5, h);
          ctx.fillStyle = '#ffffff26'; ctx.fillRect(x, y1 - h, 2, h);
          ctx.save(); ctx.translate(x + w / 2, y1 - 6); ctx.rotate(-Math.PI / 2);
          ctx.fillStyle = shade(colour); ctx.font = `700 ${Math.min(10, Math.max(6, w - 5))}px "Helvetica Neue", Arial, sans-serif`; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
          ctx.fillText(TITLES[(n * 3 + k) % TITLES.length], 0, 0, h - 20);
          ctx.restore();
          x += w + 1;
        }
      }
      // The cube's own shadow at its top and back.
      ctx.fillStyle = '#00000030'; ctx.fillRect(x0, row * S, S, 7);
    }
    return c;
  }
  /** Box covers face out, three rows of eight: our own simple art for invented games. */
  function coverSheet(seed: number) {
    const [c, ctx] = canvas(512, 192);
    ctx.fillStyle = '#2b2420'; ctx.fillRect(0, 0, 512, 192);
    for (let row = 0; row < 3; row++) for (let k = 0; k < 8; k++) {
      const n = seed * 24 + row * 8 + k, x0 = 4 + k * 63, y0 = 4 + row * 63, s = 58;
      cover(ctx, x0, y0, s, n);
    }
    return c;
  }
  function cover(ctx: CanvasRenderingContext2D, x0: number, y0: number, s: number, n: number) {
    const bg = BOX_COLOURS[(n * 7) % BOX_COLOURS.length], ink = BOX_COLOURS[(n * 7 + 5) % BOX_COLOURS.length];
    ctx.fillStyle = bg; ctx.fillRect(x0, y0, s, s);
    ctx.fillStyle = ink;
    const motif = n % 6;
    if (motif === 0) { ctx.fillRect(x0 + s * 0.44, y0 + s * 0.3, s * 0.12, s * 0.5); ctx.fillStyle = '#fff3c4'; ctx.fillRect(x0 + s * 0.42, y0 + s * 0.24, s * 0.16, s * 0.08); }
    else if (motif === 1) { for (let i = 0; i < 6; i++) ctx.fillRect(x0 + s * 0.14 + i * s * 0.13, y0 + s * 0.25, s * 0.04, s * 0.55); }
    else if (motif === 2) { ctx.fillRect(x0 + s * 0.6, y0 + s * 0.2, s * 0.1, s * 0.6); ctx.fillRect(x0 + s * 0.2, y0 + s * 0.55, s * 0.6, s * 0.25); }
    else if (motif === 3) { ctx.beginPath(); ctx.arc(x0 + s / 2, y0 + s * 0.55, s * 0.24, 0, Math.PI * 2); ctx.fill(); }
    else if (motif === 4) { ctx.beginPath(); ctx.moveTo(x0 + s * 0.15, y0 + s * 0.8); ctx.lineTo(x0 + s * 0.5, y0 + s * 0.3); ctx.lineTo(x0 + s * 0.85, y0 + s * 0.8); ctx.fill(); }
    else { for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(x0 + s * (0.3 + i * 0.2), y0 + s * 0.62, s * 0.1, Math.PI, 0); ctx.fill(); } }
    ctx.fillStyle = '#00000040'; ctx.fillRect(x0, y0, s, s * 0.2);
    ctx.fillStyle = '#f4efe2'; ctx.font = '800 8px "Helvetica Neue", Arial, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(TITLES[n % TITLES.length].toUpperCase(), x0 + s / 2, y0 + s * 0.1, s - 6);
    ctx.textAlign = 'start';
  }
  /** A game board seen from above: a city market (2), a hex map (4) or a board being set up. */
  function boardArt(kind: number) {
    const [c, ctx] = canvas(256, 256);
    if (kind === 4) {
      ctx.fillStyle = '#3b6f86'; ctx.fillRect(0, 0, 256, 256);
      const hex = (cx: number, cy: number, rad: number) => { ctx.beginPath(); for (let k = 0; k < 6; k++) ctx.lineTo(cx + rad * Math.cos(k * Math.PI / 3), cy + rad * Math.sin(k * Math.PI / 3)); ctx.closePath(); };
      for (let q = 0; q < 7; q++) for (let k = 0; k < 7; k++) {
        const cx = 34 + q * 32, cy = 30 + k * 34 + (q % 2) * 17;
        if (Math.hypot(cx - 128, cy - 128) > 110) continue;
        hex(cx, cy, 18); ctx.fillStyle = ['#7f9a4f', '#c9a46a', '#5d7d3a', '#b9b4a2', '#d9b25a'][(q * 3 + k * 2) % 5]; ctx.fill();
        ctx.strokeStyle = '#2b2420'; ctx.lineWidth = 2; ctx.stroke();
      }
    } else {
      ctx.fillStyle = kind === 2 ? '#d9cba8' : '#c9b48a'; ctx.fillRect(0, 0, 256, 256);
      ctx.strokeStyle = '#6b4a32'; ctx.lineWidth = 3; ctx.strokeRect(10, 10, 236, 236);
      for (let k = 0; k < 20; k++) { ctx.fillStyle = BOX_COLOURS[k % BOX_COLOURS.length]; ctx.fillRect(14 + (k % 10) * 23, k < 10 ? 14 : 222, 20, 20); }
      for (let k = 0; k < 6; k++) { ctx.fillStyle = ['#8c3b32', '#2f4a6b', '#3f6b4f', '#d1a54a', '#5a3f5f', '#c8643f'][k]; ctx.fillRect(48 + (k % 3) * 56, 60 + Math.floor(k / 3) * 74, 44, 56); }
      ctx.fillStyle = '#2b2420'; ctx.font = '800 16px Georgia, serif'; ctx.textAlign = 'center'; ctx.fillText(TITLES[kind % TITLES.length].toUpperCase(), 128, 214);
    }
    return c;
  }
}
/** Light or dark letters, whichever reads on `hex`. */
function shade(hex: string) {
  const n = parseInt(hex.slice(1), 16), l = 0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255);
  return l > 150 ? '#2a2420' : '#f4efe2';
}
