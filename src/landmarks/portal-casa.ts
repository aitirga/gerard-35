import type { GeoLandmark } from '../geo';
import type { LandmarkKit } from '../landmarks';

/**
 * Home's ground floor on the Meridiana (Av. Meridiana 333–335, docs/places/meridiana.md § Home's
 * door): the corner block's slanted front, from the corner (local −x) to its neighbour (+x). Coming
 * out of the portal, VivaGym is on Gerard's right: a long lit window of treadmills under a white
 * band. In the middle the portal: a glass door in a bronze frame, the lobby's warm light behind it,
 * the brass 335 above, the intercom beside. On his left, Bluespace's ramp goes down into the
 * basement under a blue band, its roller door half up. The wall is behind the pivot (local −z);
 * `building` ties the pieces to the block's see-through cut. Painted panels, no logos: the names
 * in plain type, as every shop on the avenue.
 */
export const kind = 'portal-casa';

/** Where each part runs along the wall (metres from the pivot), and the ground floor's height. */
export const GYM: readonly [number, number] = [-9.6, -0.7];
export const DOOR: readonly [number, number] = [-0.2, 3.2];
export const RAMP: readonly [number, number] = [3.8, 9.4];
const FLOOR = 3.4;

export function build(kit: LandmarkKit, landmark: GeoLandmark) {
  const building = landmark.params.building ? String(landmark.params.building) : undefined;
  /**
   * A painted panel facing the street (+z), from x0 to x1 and y0 to y1 at depth z; with `across`
   * ([z0, z1]) it stands across the wall instead, at x0, facing +x (or −x with `side` −1).
   */
  const add = (name: string, canvas: HTMLCanvasElement, x0: number, x1: number, y0: number, y1: number, z: number, glow: number, across?: [number, number], side = 1) => {
    const map = kit.texture(canvas);
    const m = kit.mat(`${name} ${x0.toFixed(2)}`, '#ffffff', 0.55, glow);
    m.diffuseMap = map; m.emissiveMap = map; m.emissive.set(1, 1, 1); m.emissiveIntensity = glow; m.update();
    const quad = kit.mesh();
    if (across) {
      // Read from its own side: the texture's left is towards the street on the −x face, towards the wall on the +x one.
      const [z0, z1] = side > 0 ? [across[1], across[0]] : across;
      quad.quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [side, 0, 0], [0, 1], [1, 1], [1, 0], [0, 0]);
    } else quad.quad([x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z], [0, 0, 1], [0, 1], [1, 1], [1, 0], [0, 0]);
    kit.add(name, quad, m, { shadows: false, building });
  };
  const bronze = kit.mat('Bronce del portal', '#5a4630', 0.6);
  const stone = kit.mat('Piedra del portal', '#d9cfbd', 0.25);
  const steel = kit.mat('Acero del gimnasio', '#3a3e44', 0.5);
  const blue = kit.mat('Azul de Bluespace', '#1d5fae', 0.4);

  // VivaGym: the window, its frame, the band with the name.
  const [g0, g1] = GYM, [r0, r1] = RAMP;
  add('Escaparate de VivaGym', gym(g1 - g0), g0, g1, 0.15, FLOOR - 0.75, 0.06, 0.55);
  add('Rótulo de VivaGym', band('VIVAGYM', '#f4f4f2', '#202326', g1 - g0), g0, g1, FLOOR - 0.72, FLOOR - 0.05, 0.08, 0.45);
  for (const x of [g0, (g0 + g1) / 2, g1]) kit.part('Montante del gimnasio', 'box', steel, [x, (FLOOR - 0.75) / 2, 0.1], [0.12, FLOOR - 0.75, 0.12]);
  kit.part('Zócalo del gimnasio', 'box', steel, [(g0 + g1) / 2, 0.08, 0.1], [g1 - g0, 0.16, 0.14]);

  // The portal: stone surround, bronze frame, the door, the lit lobby, 335 and the intercom.
  const [d0, d1] = DOOR, mid = (d0 + d1) / 2;
  kit.part('Jamba del portal', 'box', stone, [d0 + 0.2, FLOOR / 2, 0.1], [0.4, FLOOR, 0.2]);
  kit.part('Jamba del portal', 'box', stone, [d1 - 0.2, FLOOR / 2, 0.1], [0.4, FLOOR, 0.2]);
  kit.part('Dintel del portal', 'box', stone, [mid, FLOOR - 0.3, 0.1], [d1 - d0, 0.6, 0.2]);
  kit.part('Escalón del portal', 'box', stone, [mid, 0.06, 0.45], [d1 - d0 - 0.2, 0.12, 0.7]);
  add('Puerta del portal', door(), d0 + 0.4, d1 - 0.4, 0.12, FLOOR - 0.6, 0.12, 0.9);
  kit.part('Marco del portal', 'box', bronze, [mid, FLOOR - 0.62, 0.15], [d1 - d0 - 0.75, 0.06, 0.08]);
  kit.part('Hoja central', 'box', bronze, [mid, (FLOOR - 0.5) / 2, 0.15], [0.06, FLOOR - 0.72, 0.08]);
  add('Número 335', number('335'), mid - 0.45, mid + 0.45, FLOOR - 0.52, FLOOR - 0.08, 0.215, 0.5);
  kit.part('Interfono', 'box', bronze, [d1 - 0.2, 1.35, 0.22], [0.22, 0.4, 0.05]);
  add('Botones del interfono', intercom(), d1 - 0.29, d1 - 0.11, 1.2, 1.5, 0.25, 0.4);
  // The canopy over the door reaches out over the pavement, so the door reads from along the
  // avenue too (the camera sees this front at a slant): 335 on its end towards the neighbour,
  // a warm downlight under it.
  const reach = 1.5;
  kit.part('Marquesina del portal', 'box', bronze, [mid, FLOOR + 0.12, reach / 2], [d1 - d0 + 0.3, 0.16, reach]);
  kit.part('Lámpara del portal', 'box', kit.mat('Luz del portal', '#ffe2b0', 0.3, 1.4), [mid, FLOOR + 0.03, reach * 0.55], [0.9, 0.03, 0.5]);
  add('335 de la marquesina', number('335'), d1 + 0.155, d1 + 0.155, FLOOR + 0.04, FLOOR + 0.2, 0, 0.5, [0.3, reach - 0.1]);
  add('335 de la marquesina', number('335'), mid - 0.5, mid + 0.5, FLOOR + 0.04, FLOOR + 0.2, reach + 0.005, 0.5);
  // Two blade signs out from the wall, read side-on as one walks along: the gym's and the storage's.
  blade('Banderola de VivaGym', 'VIVAGYM', '#202326', '#f4f4f2', g1 - 0.3);
  blade('Banderola de Bluespace', 'BLUESPACE', '#1d5fae', '#ffffff', r1 - 0.3);
  function blade(name: string, text: string, ground: string, ink: string, x: number) {
    const holder = kit.mat(`${name} soporte`, '#3a3e44', 0.5);
    kit.part(`${name} soporte`, 'box', holder, [x, FLOOR + 1, 0.06], [0.06, 0.06, 0.12]);
    kit.part(`${name} soporte`, 'box', holder, [x, FLOOR + 1, 0.75], [0.04, 0.04, 1.4]);
    for (const side of [-1, 1]) add(name, blade2(text, ground, ink), x + side * 0.035, x + side * 0.035, FLOOR - 0.05, FLOOR + 0.95, 0, 0.6, [0.15, 1.45], side);
  }

  // Bluespace: the opening, the ramp going down inside it, the half-open roller door, the band.
  add('Rampa de Bluespace', ramp(), r0 + 0.3, r1 - 0.3, 0.02, FLOOR - 0.75, 0.05, 0.35);
  add('Rótulo de Bluespace', band('BLUESPACE · TRASTEROS', '#ffffff', '#1d5fae', r1 - r0), r0, r1, FLOOR - 0.72, FLOOR - 0.05, 0.08, 0.5);
  kit.part('Pilar de la rampa', 'box', blue, [r0 + 0.15, (FLOOR - 0.7) / 2, 0.1], [0.3, FLOOR - 0.7, 0.2]);
  kit.part('Pilar de la rampa', 'box', blue, [r1 - 0.15, (FLOOR - 0.7) / 2, 0.1], [0.3, FLOOR - 0.7, 0.2]);
  // The kerb lowered across the pavement for the cars, striped where it drops.
  const stripe = kit.mat('Franja del vado', '#e3c33a', 0.3), dark = kit.mat('Franja oscura del vado', '#26282b', 0.3);
  for (let i = 0; i < 8; i++) kit.part('Franja del vado', 'box', i % 2 ? dark : stripe, [r0 + 0.35 + (i + 0.5) * (r1 - r0 - 0.7) / 8, 0.012, 0.3], [(r1 - r0 - 0.7) / 8, 0.02, 0.18]);
}

function canvas(w: number, h: number, paint: (ctx: CanvasRenderingContext2D) => void) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  paint(c.getContext('2d')!);
  return c;
}

/** A shop band: the name in plain bold type, centred, over `width` metres. */
function band(text: string, ink: string, ground: string, width: number) {
  const w = Math.round(width * 64);
  return canvas(w, 44, ctx => {
    ctx.fillStyle = ground; ctx.fillRect(0, 0, w, 44);
    ctx.fillStyle = ink; ctx.font = '800 28px "Helvetica Neue", Arial, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text, w / 2, 23);
  });
}

/** The gym seen through its window: a cool-lit room, a row of treadmills, people running on them. */
function gym(width: number) {
  const w = Math.round(width * 48), h = 128;
  return canvas(w, h, ctx => {
    const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#e9f1f6'); g.addColorStop(1, '#9fb3bf');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    // Ceiling light strips and the mirror wall.
    ctx.fillStyle = '#ffffff'; for (let x = 12; x < w; x += 70) ctx.fillRect(x, 6, 44, 4);
    ctx.fillStyle = '#c4d3dc'; ctx.fillRect(0, 22, w, 46);
    for (let x = 18, i = 0; x < w - 20; x += 46, i++) {
      // The treadmill: deck, console, rails.
      ctx.fillStyle = '#2a2d31'; ctx.fillRect(x - 4, 104, 40, 10);
      ctx.fillRect(x + 28, 66, 5, 40); ctx.fillStyle = '#3c8fd0'; ctx.fillRect(x + 25, 62, 12, 8);
      if (i % 3 === 1) continue;
      // Someone running: legs apart, arms swinging, a coloured shirt.
      const shirt = ['#e05a3a', '#2f6fb5', '#f2c230', '#3a9a6a', '#7a52a8'][i % 5];
      ctx.fillStyle = '#3b2c25'; ctx.beginPath(); ctx.arc(x + 14, 52, 6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = shirt; ctx.fillRect(x + 8, 58, 13, 22);
      ctx.fillStyle = '#23262a'; ctx.save(); ctx.translate(x + 14, 80);
      ctx.rotate(.35); ctx.fillRect(-3, 0, 6, 24); ctx.rotate(-.7); ctx.fillRect(-3, 0, 6, 24); ctx.restore();
    }
    // The glass: a faint reflection band.
    ctx.fillStyle = 'rgba(255,255,255,.14)'; ctx.fillRect(0, h * .55, w, 10);
  });
}

/** The portal's glass door: two leaves, the lobby behind lit warm (a marble floor, the mailboxes, the lift). */
function door() {
  return canvas(128, 192, ctx => {
    const g = ctx.createLinearGradient(0, 0, 0, 192); g.addColorStop(0, '#ffe6b8'); g.addColorStop(1, '#d9a866');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 192);
    ctx.fillStyle = '#c99a5c'; ctx.fillRect(0, 150, 128, 42);
    ctx.fillStyle = '#8c6a44'; for (let x = 10; x < 60; x += 12) for (let y = 70; y < 110; y += 10) ctx.fillRect(x, y, 10, 8);
    ctx.fillStyle = '#b9b2a6'; ctx.fillRect(80, 40, 36, 110); ctx.fillStyle = '#9b948a'; ctx.fillRect(97, 40, 2, 110);
    ctx.fillStyle = 'rgba(255,255,255,.2)'; ctx.fillRect(0, 0, 128, 30);
  });
}

/** A blade sign's face: the name across it on the brand's ground. */
function blade2(text: string, ground: string, ink: string) {
  return canvas(160, 112, ctx => {
    ctx.fillStyle = ground; ctx.fillRect(0, 0, 160, 112);
    ctx.fillStyle = ink; ctx.font = '800 26px "Helvetica Neue", Arial, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text, 80, 58);
  });
}

function number(n: string) {
  return canvas(96, 48, ctx => {
    ctx.fillStyle = '#d9cfbd'; ctx.fillRect(0, 0, 96, 48);
    ctx.fillStyle = '#b38a3e'; ctx.font = '700 38px Georgia, serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(n, 48, 26);
  });
}

function intercom() {
  return canvas(32, 48, ctx => {
    ctx.fillStyle = '#6b5638'; ctx.fillRect(0, 0, 32, 48);
    ctx.fillStyle = '#20252a'; ctx.fillRect(6, 4, 20, 10);
    ctx.fillStyle = '#e8dcc0'; for (let r = 0; r < 4; r++) for (let c = 0; c < 2; c++) ctx.fillRect(7 + c * 11, 18 + r * 7, 7, 4);
  });
}

/** Bluespace's ramp seen from the pavement: the floor sloping down and away, the roller door half up, blue light below. */
function ramp() {
  return canvas(192, 128, ctx => {
    ctx.fillStyle = '#1b1e22'; ctx.fillRect(0, 0, 192, 128);
    // The roller door, half up, its slats; the basement's blue-white light under it.
    ctx.fillStyle = '#9aa3ab'; ctx.fillRect(24, 10, 144, 46);
    ctx.fillStyle = '#7d868e'; for (let y = 14; y < 56; y += 6) ctx.fillRect(24, y, 144, 2);
    const glow = ctx.createLinearGradient(0, 56, 0, 80); glow.addColorStop(0, '#cfe3ff'); glow.addColorStop(1, '#3a5f8f');
    ctx.fillStyle = glow; ctx.fillRect(24, 56, 144, 24);
    // The ramp: grey concrete going down to the door, with grooves, between dark side walls.
    ctx.fillStyle = '#5c6066'; ctx.beginPath(); ctx.moveTo(0, 128); ctx.lineTo(192, 128); ctx.lineTo(168, 80); ctx.lineTo(24, 80); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#4a4d52'; ctx.lineWidth = 2;
    for (let k = 1; k < 7; k++) { const t = k / 7, y = 80 + 48 * t, x = 24 * (1 - t); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(192 - x, y); ctx.stroke(); }
    ctx.fillStyle = '#e3c33a'; ctx.fillRect(0, 122, 192, 6);
  });
}
