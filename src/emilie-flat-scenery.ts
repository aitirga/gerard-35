import * as pc from 'playcanvas';
import type { RoomKit } from './home-scenery';

/**
 * Emilie's flat inside (docs/quests/emilie.md, `PISO_EMILIE`, after Aitor's sketch): brown hydraulic tiles,
 * wood and concrete. The desk with her laptop against the west wall, right over the sofa, her model of
 * the water under Poble Sec still running on it in phosphor green; the sofa facing the projector's
 * screen on the bedroom wall; the kitchen in the north-east corner with a concrete bar below it; the
 * bedroom behind; the bathroom and the terrace along the top. A hand's depth of water over the
 * floor, papers floating on it. The terrace's drain is buried under leaves against its glass door:
 * whoever looks can see why the flat flooded; she cannot. No pink anywhere: this mission has none.
 */
/** How deep the water stands over her floor (m): the surface the party wades through. */
export const FLOOD = .16;

export function furnishEmilie(r: RoomKit) {
  const { box, cyl, ball, canvas, painted, jitter, light, standing, face: FACE } = r;
  const made = new Map<string, pc.StandardMaterial>();
  const mat = (name: string, hex: string, gloss = .2, glow = 0) => {
    const key = `${name}|${hex}|${gloss}|${glow}`;
    let m = made.get(key);
    if (!m) { m = r.mat(name, hex, gloss, glow); made.set(key, m); }
    return m;
  };
  const oak = mat('Roble', '#b98d5f', .3), oakDark = mat('Nogal', '#7a5a3e', .3);
  const concrete = mat('Hormigón pulido', '#9d9a93', .35), concreteDark = mat('Hormigón', '#7f7c76', .2);
  const white = mat('Lacado blanco', '#eeeae2', .4), steel = mat('Acero', '#9aa1a6', .6), black = mat('Negro mate', '#25282b', .3);
  const alu = mat('Aluminio', '#b9bec3', .7), porcelain = mat('Porcelana', '#f4f2ee', .6);
  const fabric = mat('Sofá de lino', '#8a8274', .08), cushion = mat('Cojín', '#4d6273', .08), linen = mat('Sábanas', '#d9d4c8', .1);
  const terracotta = mat('Barro', '#b5643c', .15), soil = mat('Tierra', '#4a3426', .05);
  const leaf = [mat('Hoja', '#4f7a3a', .2), mat('Hoja oscura', '#3c5f2d', .2)], petal = mat('Geranio', '#d8432e', .3);
  const dead = [mat('Hoja seca', '#9a7a3c', .1), mat('Hoja seca oscura', '#7a5a2c', .1)];
  const paper = mat('Papel mojado', '#e9e6dc', .25);

  // ——— The desk against the west wall, right over the sofa, and her laptop on it ———
  const dx = 1.5, dz = 5.5, top = .74;
  box('Mesa del ordenador', oak, dx - .05, dz, top - .04, 1.5, .04, 1.7);
  for (const [ox, oz] of [[-.65, -.75], [.6, -.75], [-.65, .75], [.6, .75]]) box('Pata', oakDark, dx - .05 + ox, dz + oz, 0, .05, top - .04, .05);
  box('Silla', oakDark, dx + .95, dz + .1, .44, .42, .04, .44);
  box('Respaldo de la silla', oakDark, dx + 1.15, dz + .1, .44, .04, .42, .44);
  box('Portátil', alu, dx + .05, dz, top, .34, .02, .5);
  const [c, ctx] = canvas(256, 160);
  ctx.fillStyle = '#040a06'; ctx.fillRect(0, 0, c.width, c.height);
  ctx.strokeStyle = '#1c7a42'; ctx.lineWidth = 1;
  for (let x = 8; x < c.width; x += 14) { ctx.beginPath(); ctx.moveTo(x, 12); ctx.lineTo(x, 118); ctx.stroke(); }
  for (let y = 12; y < 120; y += 11) { ctx.beginPath(); ctx.moveTo(8, y); ctx.lineTo(c.width - 8, y); ctx.stroke(); }
  ctx.strokeStyle = '#6cc8f2'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(8, 40);
  for (let x = 8; x < c.width - 8; x += 8) ctx.lineTo(x, 40 + Math.sin(x * .07) * 6);
  ctx.stroke();
  ctx.fillStyle = '#ff7a1a'; for (const x of [44, 120, 200]) ctx.fillRect(x, 14, 3, 12);
  ctx.fillStyle = '#3fe07a'; ctx.font = '600 11px monospace';
  for (let i = 0; i < 3; i++) ctx.fillText(`iter ${412 + i}: no converge`, 10, 132 + i * 11);
  // The lid stands at the desk's back, its screen to the room (east), leaning back a little.
  const lid = box('Pantalla del modelo', painted('Pantalla del modelo', c, .4, 1.6), dx - .13, dz, top + .01, .012, .32, .5);
  lid.setEulerAngles(0, 0, 12);
  box('Taza', white, dx + .1, dz + .55, top, .08, .1, .08);
  box('Móvil', black, dx + .2, dz - .55, top, .16, .01, .08).setEulerAngles(0, 20, 0);
  // The screen lights the desk blue-green, the only cold light in the room.
  light(dx + .5, top + .45, dz, '#8fe8c8', .55, 2.6);

  // ——— The sofa below it, facing the projector's screen on the bedroom wall ———
  box('Base del sofá', fabric, 1.55, 10, 0, 1.6, .42, 2.8);
  box('Respaldo', fabric, .85, 10, .42, .3, .5, 2.8);
  for (const [i, z] of [9.3, 10, 10.7].entries()) box('Cojín', cushion, 1.2, z, .42, .25, .32, .5).setEulerAngles(0, 0, -10 + i * 5);
  box('Proyector', black, .95, 10, 1.95, .3, .12, .26);
  box('Balda del proyector', oak, .85, 10, 1.9, .3, .03, .4);
  box('Pantalla del proyector', mat('Tela de proyección', '#f0eee8', .15, .25), 10 - FACE - .02, 10.5, .7, .02, 1.2, 1.7);

  // ——— The kitchen in the north-east corner, and the concrete bar below it ———
  box('Encimera', concreteDark, 10.5, 4 + FACE + .3, 0, 6, .9, .6);
  box('Sobre', oak, 10.5, 4 + FACE + .3, .9, 6.05, .04, .62);
  box('Encimera del rincón', concreteDark, 14 - FACE - .3, 6, 0, .6, .9, 1.4);
  box('Sobre del rincón', oak, 14 - FACE - .3, 6, .9, .62, .04, 1.42);
  box('Fregadero', steel, 12.2, 4 + FACE + .3, .9, .7, .045, .42);
  box('Placa', black, 9.2, 4 + FACE + .3, .9, .6, .05, .5);
  cyl('Cafetera', steel, 10.6, 4 + FACE + .32, .94, .14, .24, .14);
  box('Barra', concrete, 9.5, 8, 0, 5.8, .95, .7);
  box('Sobre de la barra', oak, 9.5, 8, .95, 5.9, .05, .8);
  for (let i = 0; i < 4; i++) {
    const x = 7.6 + i * 1.3;
    box('Taburete', oakDark, x, 8.75, .62, .34, .04, .34);
    cyl('Pata del taburete', steel, x, 8.75, 0, .04, .62, .04);
  }

  // ——— The bedroom behind the projector's wall ———
  box('Cama', oak, 12, 10.5, 0, 2.6, .35, 1.8);
  box('Colchón', linen, 12, 10.55, .35, 2.5, .18, 1.7);
  box('Cabecero', oakDark, 12, 9.55 + FACE, 0, 2.7, .9, .08);
  box('Almohada', white, 11.5, 9.95, .53, .7, .1, .4);
  box('Almohada', white, 12.5, 9.95, .53, .7, .1, .4);
  standing('Armario', oak, 13.55, 13, .7, 1, 1.9);

  // ——— The bathroom: toilet, basin, the shower ———
  box('Inodoro', porcelain, 1, 1.2, 0, .4, .42, .55);
  box('Lavabo', porcelain, 3, 1 + FACE + .2, .8, .5, .1, .4);
  box('Pie del lavabo', porcelain, 3, 1 + FACE + .2, 0, .16, .8, .16);
  box('Plato de ducha', porcelain, 1.2, 2.3, 0, .9, .05, .9);
  box('Mampara', r.glass, 1.7, 2.3, .05, .02, 1.9, .9);

  // ——— The terrace: geraniums, a lemon tree in a pot, and the leaves over the drain against the glass ———
  for (const [i, [x, z]] of [[5.2, 1.2], [6.2, 1.2], [12.2, 1.2], [13.2, 1.3], [13.3, 2.4]].entries()) {
    cyl('Maceta de la terraza', terracotta, x, z, 0, .36, .3, .36);
    cyl('Tierra', soil, x, z, .28, .32, .02, .32);
    ball('Geranio', leaf[i % 2], x, z, .3, .4, .3, .4);
    for (let k = 0; k < 3; k++) ball('Flor', petal, x + (jitter(i * 3 + k) - .5) * .3, z + (jitter(i * 7 + k) - .5) * .3, .52, .09, .08, .09);
  }
  cyl('Maceta grande', terracotta, 9, 1.3, 0, .5, .45, .5);
  cyl('Tronco', oakDark, 9, 1.3, .45, .06, .6, .06);
  ball('Copa', leaf[0], 9, 1.3, 1, .8, .7, .8);
  // The drain under the leaves, beside the glass door.
  cyl('Desagüe', black, 6.6, 3.3, 0, .18, .01, .18);
  for (let i = 0; i < 26; i++) box('Hoja seca', dead[i % 2], 6.3 + jitter(i) * .9, 3 + jitter(i + 40) * .75, .01 + jitter(i + 80) * .07, .12, .01, .08).setEulerAngles(0, jitter(i + 3) * 180, 0);
  for (let i = 0; i < 10; i++) box('Hoja seca', dead[i % 2], 5.6 + jitter(i + 90) * 7.5, 1.6 + jitter(i + 120) * 1.8, .01, .12, .01, .08).setEulerAngles(0, jitter(i + 7) * 180, 0);

  // ——— The water: a hand's depth over every room below the terrace, still, with papers floating on it ———
  const water = r.mat('Agua del piso', '#4a6d74', 1, .1);
  water.opacity = .55; water.blendType = pc.BLEND_NORMAL; water.depthWrite = false; water.update();
  const sheet = box('Agua', water, 7, 9.5, .02, 13.9, FLOOD - .02, 9.9);
  // Where it meets the walls and the legs of things, a pale line: the water's edge, so it reads as water.
  const edge = r.mat('Orilla del agua', '#cfe6ee', .9, .3);
  edge.opacity = .55; edge.blendType = pc.BLEND_NORMAL; edge.depthWrite = false; edge.update();
  for (const [x, z, w, d] of [[7, 4.5 + FACE + .03, 13.9, .05], [.5 + FACE + .03, 9.5, .05, 9.9], [13.5 - FACE - .03, 7, .05, 4.9]]) box('Orilla', edge, x, z, .16, w, .006, d);
  for (const [x, z, rad] of [[5, 9, .5], [1.5, 5.5, .9], [9.5, 8, 1.1]]) cyl('Onda', edge, x, z, .161, rad * 2, .004, rad * 2);
  if (sheet.render) sheet.render.castShadows = false;
  for (let i = 0; i < 7; i++) box('Papel flotando', paper, 3 + jitter(i + 11) * 6, 9 + jitter(i + 17) * 5, .165, .21, .004, .29).setEulerAngles(0, jitter(i + 23) * 180, 0);
}
