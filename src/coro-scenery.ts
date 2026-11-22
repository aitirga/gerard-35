import * as pc from 'playcanvas';
import type { RoomKit } from './home-scenery';

/**
 * The choir's room inside (docs/quests/coro.md § The room inside, `CORO` in src/environments.ts): the
 * old workshop *A cop de diapasó* has at last. Raw concrete with the workshop's oil stains still on
 * it, under old rugs laid edge over edge (oxblood, faded madder, a worn ochre kilim): what covers
 * the screen. Grey moving blankets hung on the walls for the sound. Three rows of chairs that never
 * match, split by an aisle, facing the director's stand at the front; the upright piano in the
 * south-west corner, a shelf of folders and the spare chairs stacked at the back, coats on a rail.
 * Enamel work lamps hang low over the rows. On the back wall over them the tuning fork of their logo
 * in cyan neon, the room's one cold light and the one thing found only here. No pink, no violet.
 */
const LAMP = '#ffcf94';
const NEON = '#3fd8e0';

export function furnishCoro(r: RoomKit) {
  const { box, cyl, cone, ball, canvas, painted, picture, onWall, chair, jitter, light, pool, face: FACE } = r;
  const made = new Map<string, pc.StandardMaterial>();
  const mat = (name: string, hex: string, gloss = .2, glow = 0) => {
    const key = `${name}|${hex}|${gloss}|${glow}`;
    let m = made.get(key);
    if (!m) { m = r.mat(name, hex, gloss, glow); made.set(key, m); }
    return m;
  };
  const black = mat('Hierro negro', '#2a2d30', .35), steel = mat('Acero del taller', '#8a8f93', .45);
  const enamel = mat('Esmalte de taller', '#e9e4d6', .55), bulb = mat('Bombilla encendida', '#ffe3b3', .2, 1.6);
  const walnut = mat('Nogal del piano', '#4a3124', .45), ivory = mat('Teclas', '#efe9da', .4), ebony = mat('Teclas negras', '#1c1b1d', .4);
  const pine = mat('Pino', '#c59a68', .25), paper = mat('Partitura', '#f2ede0', .1);
  const folders = [mat('Carpeta negra', '#26272b', .3), mat('Carpeta roja', '#8e2f28', .3), mat('Carpeta azul', '#2f4a6b', .3)];
  const coats = [mat('Abrigo', '#3d3c40', .1), mat('Abrigo camel', '#a3794f', .1), mat('Chubasquero', '#5d6b4a', .2), mat('Bufanda', '#b04a36', .1)];

  // ——— The floor: oil stains on the concrete, and the rugs laid over it edge over edge ———
  const stain = mat('Mancha de aceite', '#4a4640', .6);
  for (const [x, z, s] of [[2.2, 10.6, .9], [12.8, 10.2, .7], [13.4, 2.2, .6], [8.6, 10.9, .5]]) cyl('Mancha', stain, x, z, .003, s, .002, s * .8).render!.castShadows = false;
  rug(4.3, 2.9, 6, 3.4, '#5e2a26', '#341816', 0, -2);
  rug(10.9, 3.1, 6.2, 3.8, '#7d3f33', '#43221d', 1, 3);
  rug(4.6, 5.9, 6.4, 3.4, '#6b302b', '#3a1d1b', 2, 2);
  rug(10.5, 6.4, 6, 3.6, '#8a4a3a', '#4a2620', 3, -4);
  rug(7.6, 8.6, 7.4, 2.6, '#b08a4e', '#5b3c26', 4, -2);

  // ——— The grey moving blankets hung on the walls for the sound, quilted in diamonds ———
  const [bc, bx] = canvas(128, 256);
  bx.fillStyle = '#7d8086'; bx.fillRect(0, 0, bc.width, bc.height);
  bx.strokeStyle = '#5f6267'; bx.lineWidth = 2;
  for (let i = -8; i < 16; i++) { bx.beginPath(); bx.moveTo(i * 24, 0); bx.lineTo(i * 24 + 256, 256); bx.stroke(); bx.beginPath(); bx.moveTo(i * 24, 256); bx.lineTo(i * 24 + 256, 0); bx.stroke(); }
  bx.fillStyle = '#2c2e33'; bx.fillRect(0, 0, bc.width, 6); bx.fillRect(0, bc.height - 6, bc.width, 6); bx.fillRect(0, 0, 6, bc.height); bx.fillRect(bc.width - 6, 0, 6, bc.height);
  const blanket = painted('Manta de mudanza', bc, .05);
  // Along the back wall, leaving the middle for the neon, and down the west wall above the piano.
  for (const x of [1.9, 3.3, 4.7, 10.3, 11.7, 13.1]) picture(onWall('south', x, FACE), blanket, 'south', x, FACE + .03, 1.45, 1.3, 2.1);
  for (const z of [3, 4.4, 5.8]) picture(onWall('east', FACE, z), blanket, 'east', FACE + .03, z, 1.45, 1.3, 2.1);

  // ——— The tuning fork in cyan neon over the rows (their logo, docs/quests/coro.md § Their logo) ———
  const [nc, nx] = canvas(256, 320);
  nx.fillStyle = '#0e2a33'; nx.fillRect(0, 0, nc.width, nc.height);
  nx.strokeStyle = '#9ff6fb'; nx.lineCap = 'round'; nx.lineJoin = 'round';
  for (const [width, colour] of [[18, '#2fb8c444'], [9, '#5fe8f0aa'], [4, '#dffcff']] as const) {
    nx.strokeStyle = colour; nx.lineWidth = width;
    nx.beginPath(); nx.moveTo(96, 40); nx.lineTo(96, 170); nx.quadraticCurveTo(96, 214, 128, 214); nx.quadraticCurveTo(160, 214, 160, 170); nx.lineTo(160, 40); nx.stroke();
    nx.beginPath(); nx.moveTo(128, 214); nx.lineTo(128, 286); nx.stroke();
  }
  const sign = painted('Diapasón de neón', nc, .3, 1.4);
  picture(onWall('south', 7.5, FACE), sign, 'south', 7.5, FACE + .04, 1.7, 1.3, 1.6);
  light(7.5, 1.7, 1, NEON, .45, 3.2);

  // ——— Three rows of chairs that never match, the aisle down the middle, all facing the stand ———
  const seats = [mat('Asiento de haya', '#b98d5f', .3), mat('Asiento de plástico naranja', '#d9783a', .35), mat('Asiento de plástico verde', '#5f8a6a', .35),
    mat('Asiento de enea', '#c8a86a', .1), mat('Asiento tapizado', '#4c5d6e', .08), mat('Asiento de plástico blanco', '#e6e1d6', .35)];
  const frames = [black, steel, mat('Haya oscura', '#6b4a32', .3)];
  const rows: [number, number[]][] = [[3, [3, 4, 5, 6, 9, 10, 11, 12]], [5, [3, 4, 5, 6, 9, 10, 11, 12]], [7, [4, 5, 6, 9, 10, 11]]];
  let n = 0;
  for (const [z, xs] of rows) for (const x of xs) {
    const k = Math.floor(jitter(n * 7 + 3) * 97);
    chair(x + (jitter(n) - .5) * .12, z + (jitter(n + 40) - .5) * .12, 'south', seats[k % seats.length], frames[k % frames.length]);
    // Some chairs keep a folder on them, left there at the last rehearsal.
    if (jitter(n + 80) > .72) box('Carpeta', folders[n % folders.length], x, z + .02, .48, .24, .02, .32);
    n++;
  }

  // ——— The director's stand at the front, a folding music stand, facing the rows ———
  const sx = 7.5, sz = 9.3;
  cyl('Pie del atril', black, sx, sz, 0, .03, 1.1, .03);
  for (const a of [0, 120, 240]) box('Pata del atril', black, sx + Math.sin(a * Math.PI / 180) * .16, sz + Math.cos(a * Math.PI / 180) * .16, 0, .03, .03, .34).setEulerAngles(0, a, 0);
  const desk = box('Bandeja del atril', black, sx, sz, 1.08, .5, .02, .36);
  desk.setEulerAngles(-35, 0, 0);
  box('Partitura del atril', paper, sx, sz - .02, 1.12, .44, .01, .3).setEulerAngles(-35, 0, 0);

  // ——— The upright piano in the south-west corner, its keys to the room ———
  const px = 1 + FACE + .32;
  box('Piano de pared', walnut, px, 9.5, 0, .64, 1.28, 1.5);
  box('Teclado', ivory, px + .38, 9.5, .72, .2, .04, 1.36);
  for (let i = 0; i < 20; i++) if (i % 7 !== 2 && i % 7 !== 6) box('Tecla negra', ebony, px + .34, 8.88 + i * .066, .76, .1, .02, .03);
  box('Tapa', walnut, px + .38, 9.5, .76, .22, .02, 1.4).render!.castShadows = false;
  for (let i = 0; i < 3; i++) box('Partituras', paper, px - .05 + i * .02, 9.2 + i * .25, 1.28 + i * .01, .26, .01, .34).setEulerAngles(0, jitter(i) * 20, 0);
  box('Banqueta', walnut, px + .85, 9.5, .44, .36, .06, .8);
  for (const [ox, oz] of [[-.14, -.34], [.14, -.34], [-.14, .34], [.14, .34]]) box('Pata de la banqueta', black, px + .85 + ox, 9.5 + oz, 0, .03, .44, .03);

  // ——— At the back: a shelf of folders and scores in the north-west corner, the spare chairs stacked in the north-east ———
  r.standing('Estantería', steel, 1.5, 1 + FACE + .2, 1.6, .4, 1.9, 1.1);
  for (let shelf = 0; shelf < 4; shelf++) {
    box('Balda', pine, 1.5, 1 + FACE + .2, .02 + shelf * .46, 1.6, .02, .4);
    for (let i = 0; i < 9; i++) if (jitter(shelf * 9 + i) > .18) box('Carpeta', folders[(shelf + i) % folders.length], .85 + i * .16, 1 + FACE + .22, .04 + shelf * .46, .05, .3, .3);
  }
  for (let i = 0; i < 6; i++) chair(13.6 + (jitter(i) - .5) * .05, 1.4, 'south', seats[(i * 5) % seats.length], frames[i % frames.length], i * .1);

  // ——— Coats on a rail by the shutter ———
  box('Barra del perchero', steel, 14.2, 9.5, 1.6, .03, .03, 1.4);
  for (const zz of [8.8, 10.2]) box('Pie del perchero', steel, 14.2, zz, 0, .03, 1.6, .03);
  for (let i = 0; i < 4; i++) box('Abrigo colgado', coats[i], 14.2, 9 + i * .32, .75, .3, .85, .22).setEulerAngles(0, (jitter(i) - .5) * 20, 0);

  // ——— The work lamps: enamel shades hung low over the rows, their warm pools on the rugs ———
  for (const [lx, lz] of [[4.5, 4], [10.5, 4], [7.5, 7.2]]) {
    box('Cable', black, lx, lz, 2.3, .012, r.wallHeight - 2.3, .012).render!.castShadows = false;
    const shade = cone('Pantalla de taller', enamel, lx, lz, 2.1, .5, .24, .5);
    shade.setEulerAngles(180, 0, 0); shade.render!.castShadows = false;
    ball('Bombilla', bulb, lx, lz, 2.05, .12, .1, .12);
    light(lx, 2, lz, LAMP, .85, 4.6);
    pool(lx, lz, 1.9, LAMP, .3);
  }

  /** A rug laid on the floor, its pattern a worn kilim's bands and lozenges; `seed` varies it, `turn` sets it a little askew. */
  function rug(x: number, z: number, w: number, d: number, fill: string, border: string, seed: number, turn: number) {
    const [c, ctx] = canvas(256, Math.max(64, Math.round(256 * d / w)));
    ctx.fillStyle = border; ctx.fillRect(0, 0, c.width, c.height);
    ctx.fillStyle = fill; ctx.fillRect(12, 12, c.width - 24, c.height - 24);
    ctx.strokeStyle = border; ctx.lineWidth = 3;
    for (let i = 0; i < 5; i++) {
      const cx = c.width * (i + .5) / 5, cy = c.height / 2, s = Math.min(c.height * .28, 22);
      ctx.beginPath(); ctx.moveTo(cx, cy - s); ctx.lineTo(cx + s, cy); ctx.lineTo(cx, cy + s); ctx.lineTo(cx - s, cy); ctx.closePath(); ctx.stroke();
    }
    ctx.strokeRect(24, 24, c.width - 48, c.height - 48);
    // Worn through in the middle, where the feet go.
    ctx.fillStyle = '#ffffff10'; for (let i = 0; i < 420; i++) ctx.fillRect(c.width * (.25 + jitter(i + seed * 50) * .5), c.height * (.2 + jitter(i + seed * 90 + 7) * .6), 3, 2);
    const e = box('Alfombra vieja', painted('Alfombra vieja', c, .02), x, z, .006 + seed * .003, w, .012, d);
    e.setEulerAngles(0, turn, 0);
    e.render!.castShadows = false;
  }
}
