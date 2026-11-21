import type { GeoLandmark } from '../geo';
import type { LandmarkKit, LandmarkLife } from '../landmarks';

/**
 * The choir's room on the Meridiana (docs/quests/coro.md § The choir room): *A cop de diapasó* at
 * last has a room of its own, an old workshop on home's side of the avenue, on the way from the
 * metro. Its front is what the choir made of it: the bare brick piers left as they were, and the
 * grey steel shutter painted by them, the name lettered by hand along its foot, a stave running
 * across it and the tuning fork of their logo (a cyan line on dark petrol; those colours
 * only on the logo, the petrol being Las cuerdas' dominant). A blade sign with the same tuning fork
 * in real neon stands out from the wall, read side-on along the pavement: the one cold light among
 * the avenue's warm shop windows. By day the shutter is rolled most of the way up and the room
 * shows under it, warm work lamps over rows of chairs that never match; at night it is down
 * («La persiana está echada», `LINES_2.afternoon.coro.night`). The wall is behind the pivot (local
 * −z); `building` ties the pieces to the block's see-through cut.
 */
export const kind = 'local-coro';

/** The opening, from pivot to each side (metres), how high it reaches, and the ground floor's height. */
const HALF = 2.3, OPEN = 2.4, FLOOR = 3.4;
/** How far down the shutter hangs by day (metres from the top of the opening). */
const ROLLED = 0.5;
/** The shutter's box over the opening, kept under the first floor's balconies so the camera reads it. */
const BOX = 0.5;

export function build(kit: LandmarkKit, landmark: GeoLandmark): LandmarkLife {
  const building = landmark.params.building ? String(landmark.params.building) : undefined;
  /** A painted panel facing the street (+z) from x0 to x1 and y0 to y1, showing the canvas between v0 and v1 (0 its top). */
  const panel = (name: string, canvas: HTMLCanvasElement, x0: number, x1: number, y0: number, y1: number, z: number, glow: number, v0 = 0, v1 = 1) => {
    const map = kit.texture(canvas);
    const m = kit.mat(`${name} ${x0.toFixed(2)}`, '#ffffff', 0.4, glow);
    m.diffuseMap = map; m.emissiveMap = map; m.emissive.set(1, 1, 1); m.emissiveIntensity = glow; m.update();
    const quad = kit.mesh();
    quad.quad([x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z], [0, 0, 1], [0, v1], [1, v1], [1, v0], [0, v0]);
    return kit.add(name, quad, m, { shadows: false, building, moving: true });
  };
  const brick = kit.surface('mao', '#b4826a', 0.15);
  const steel = kit.mat('Acero galvanizado del taller', '#8a8f93', 0.45);
  const dark = kit.mat('Acero oscuro del taller', '#3b3e41', 0.5);

  // The brick piers either side, left bare, and the brick over the box up to the first floor.
  const piers = kit.mesh();
  piers.box([-HALF - 0.32, FLOOR / 2, 0.11], [0.64, FLOOR, 0.22]);
  piers.box([HALF + 0.32, FLOOR / 2, 0.11], [0.64, FLOOR, 0.22]);
  piers.box([0, OPEN + BOX + (FLOOR - OPEN - BOX) / 2, 0.09], [HALF * 2, FLOOR - OPEN - BOX, 0.18]);
  kit.add('Pilares de ladrillo del local', piers, brick, { building });

  // The shutter's box over the opening and the rails the shutter runs in.
  const box = kit.mesh();
  box.box([0, OPEN + BOX / 2, 0.2], [HALF * 2 + 0.1, BOX, 0.4]);
  kit.add('Caja de la persiana', box, steel, { building });
  for (const side of [-1, 1]) kit.part('Guía de la persiana', 'box', dark, [side * (HALF - 0.04), OPEN / 2, 0.16], [0.08, OPEN, 0.1]);
  kit.part('Umbral del local', 'box', dark, [0, 0.025, 0.2], [HALF * 2, 0.05, 0.3]);

  // By day: the shutter rolled most of the way up, its last slats (the name) showing, and the room under it.
  const mural = shutter();
  const day = [
    panel('Persiana subida', mural, -HALF + 0.08, HALF - 0.08, OPEN - ROLLED, OPEN, 0.14, 0.12, 1 - ROLLED / OPEN, 1),
    panel('El local por dentro', room(), -HALF + 0.08, HALF - 0.08, 0.05, OPEN - ROLLED, 0.06, 0.85),
  ];
  // By night: down to the ground.
  const night = [panel('Persiana echada', mural, -HALF + 0.08, HALF - 0.08, 0.05, OPEN, 0.14, 0.05)];

  // The blade sign: a neon tuning fork on its petrol plate, out from the wall over the pavement,
  // under the balconies (above anyone's head) so it reads side-on from along the avenue.
  const holder = kit.mat('Soporte del neón', '#2f3235', 0.5);
  const x = HALF + 0.32, y = 2.6, r = 0.36;
  kit.part('Soporte del neón', 'box', holder, [x, y + r + 0.04, 0.55], [0.04, 0.04, 1.1]);
  kit.part('Soporte del neón', 'box', holder, [x, y + r + 0.04, 0.04], [0.08, 0.12, 0.08]);
  kit.part('Placa del neón', 'box', kit.mat('Placa del neón', '#1d3a45', 0.35), [x, y, 0.6], [0.05, r * 2, r * 2]);
  for (const side of [-1, 1]) {
    const map = kit.texture(neon());
    const m = kit.mat(`Neón del diapasón ${side}`, '#ffffff', 0.3, 1.6);
    m.diffuseMap = map; m.emissiveMap = map; m.emissive.set(1, 1, 1); m.emissiveIntensity = 1.6; m.update();
    const quad = kit.mesh(), px = x + side * 0.03, [z0, z1] = side > 0 ? [0.6 + r, 0.6 - r] : [0.6 - r, 0.6 + r];
    quad.quad([px, y - r, z0], [px, y - r, z1], [px, y + r, z1], [px, y + r, z0], [side, 0, 0], [0, 1], [1, 1], [1, 0], [0, 0]);
    kit.add('Neón del diapasón', quad, m, { shadows: false, building });
  }
  // A caged work lamp over the box, warm, the kind every workshop had.
  kit.part('Aplique del taller', 'box', dark, [-HALF - 0.32, OPEN + 0.3, 0.3], [0.2, 0.14, 0.18]);
  kit.part('Luz del aplique', 'box', kit.mat('Luz del aplique', '#ffd9a0', 0.3, 1.2), [-HALF - 0.32, OPEN + 0.21, 0.3], [0.16, 0.04, 0.14]);

  // Built by day; the scene says when night falls (src/scenery.ts `setNight`).
  let shown = -1;
  const life: LandmarkLife = {
    setNight(k: number) {
      const down = k >= 0.5 ? 1 : 0;
      if (down === shown) return;
      shown = down;
      for (const e of day) if (e) e.enabled = !down;
      for (const e of night) if (e) e.enabled = !!down;
    },
  };
  life.setNight!(0);
  return life;
}

function canvas(w: number, h: number, paint: (ctx: CanvasRenderingContext2D) => void) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  paint(c.getContext('2d')!);
  return c;
}

/** The tuning fork of their logo as a single line: two tines, the curve joining them, the stem. */
function fork(ctx: CanvasRenderingContext2D, cx: number, top: number, height: number) {
  const gap = height * 0.17, prongs = height * 0.52, stem = height - prongs - gap;
  ctx.beginPath();
  ctx.moveTo(cx - gap, top); ctx.lineTo(cx - gap, top + prongs);
  ctx.arc(cx, top + prongs, gap, Math.PI, 0, true);
  ctx.lineTo(cx + gap, top);
  ctx.moveTo(cx, top + prongs + gap); ctx.lineTo(cx, top + prongs + gap + stem);
  ctx.stroke();
}

/** The blade sign's face: the petrol plate, and the tuning fork in cyan neon tube with its halo. */
function neon() {
  return canvas(160, 160, ctx => {
    ctx.fillStyle = '#16303a'; ctx.fillRect(0, 0, 160, 160);
    ctx.strokeStyle = '#2b4a56'; ctx.lineWidth = 6; ctx.strokeRect(3, 3, 154, 154);
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(95,230,239,.28)'; ctx.lineWidth = 16; fork(ctx, 80, 26, 108);
    ctx.strokeStyle = '#7ff0f6'; ctx.lineWidth = 6; fork(ctx, 80, 26, 108);
    ctx.strokeStyle = '#e8feff'; ctx.lineWidth = 2; fork(ctx, 80, 26, 108);
  });
}

/**
 * The shutter as the choir painted it: grey slats; their logo high in the middle, a petrol disc with
 * the cyan tuning fork; a stave from side to side under it with the notes of a phrase; and along the
 * bottom slats, the ones a rolled shutter still shows by day, the name lettered by hand in white
 * house paint (theirs, not a sign-maker's). And the tag every shutter on the avenue gets.
 */
function shutter() {
  const w = 512, h = 300;
  return canvas(w, h, ctx => {
    ctx.fillStyle = '#9aa0a4'; ctx.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 10) { ctx.fillStyle = '#7f8589'; ctx.fillRect(0, y, w, 2); ctx.fillStyle = '#b1b6b9'; ctx.fillRect(0, y + 2, w, 1); }
    // A rust run under a rivet at either side.
    ctx.fillStyle = 'rgba(120,70,40,.25)'; ctx.fillRect(10, 30, 3, 40); ctx.fillRect(w - 12, 150, 2, 50);
    // The logo: their dark petrol disc with the cyan tuning fork.
    ctx.fillStyle = '#1d3a45'; ctx.beginPath(); ctx.arc(w / 2, 66, 54, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#5fe6ef'; ctx.lineWidth = 6; ctx.lineCap = 'round'; fork(ctx, w / 2, 28, 80);
    // The stave, painted freehand: five lines that wander a little, and a phrase on them.
    ctx.strokeStyle = '#2b2d30'; ctx.lineWidth = 2.5;
    const top = 146, line = (k: number) => (x: number) => top + k * 11 + Math.sin(x / 70 + k) * 2;
    for (let k = 0; k < 5; k++) { const at = line(k); ctx.beginPath(); ctx.moveTo(14, at(14)); for (let x = 14; x <= w - 14; x += 16) ctx.lineTo(x, at(x)); ctx.stroke(); }
    // A treble clef's sweep, then the notes (the opening phrase, rising and falling).
    ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(40, top + 56); ctx.bezierCurveTo(22, top + 18, 62, top - 18, 48, top - 32); ctx.bezierCurveTo(34, top - 18, 54, top + 32, 44, top + 60); ctx.stroke();
    ctx.beginPath(); ctx.arc(46, top + 26, 10, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#2b2d30';
    [3, 2, 1, 2, 3.5, 4, 3, 2, 1.5, 2.5, 1, 0.5].forEach((step, i) => {
      const x = 96 + i * 34, y = line(0)(x) + step * 11;
      ctx.beginPath(); ctx.ellipse(x, y, 7, 5, -0.4, 0, Math.PI * 2); ctx.fill();
      ctx.fillRect(x + 5, y - 34, 2.5, 34);
    });
    ctx.fillRect(w - 40, line(0)(w - 40), 3, 44);
    // The name on the bottom slats.
    ctx.fillStyle = '#f3efe6'; ctx.font = 'italic 600 44px "Bradley Hand", "Segoe Print", "Comic Neue", cursive';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.save(); ctx.translate(w / 2, 268); ctx.rotate(-0.015); ctx.fillText('A cop de diapasó', 0, 0); ctx.restore();
    // The tag in a corner.
    ctx.strokeStyle = 'rgba(60,60,70,.75)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(w - 108, 40); ctx.bezierCurveTo(w - 90, 10, w - 70, 60, w - 52, 28); ctx.bezierCurveTo(w - 40, 12, w - 30, 40, w - 22, 30); ctx.stroke();
  });
}

/**
 * The room under the rolled shutter: bare brick and raw concrete under warm work lamps, rows of
 * chairs that never match (wood, folding steel, plastic), the stands with their scores, a keyboard
 * at the front where Aitor stands, and on the back wall the tuning fork in neon.
 */
function room() {
  const w = 512, h = 256;
  return canvas(w, h, ctx => {
    // Back wall: brick, warm in the lamps' light; the floor: concrete going away.
    const wall = ctx.createLinearGradient(0, 0, 0, 150); wall.addColorStop(0, '#5c3a2c'); wall.addColorStop(1, '#9a6248');
    ctx.fillStyle = wall; ctx.fillRect(0, 0, w, 150);
    ctx.strokeStyle = 'rgba(40,22,16,.35)'; ctx.lineWidth = 1;
    for (let y = 6, row = 0; y < 150; y += 9, row++) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); for (let x = row % 2 ? 0 : 12; x < w; x += 24) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 9); ctx.stroke(); } }
    const floor = ctx.createLinearGradient(0, 150, 0, h); floor.addColorStop(0, '#8d8579'); floor.addColorStop(1, '#6a645c');
    ctx.fillStyle = floor; ctx.fillRect(0, 150, w, h - 150);
    // The neon on the back wall, and its cold glow on the bricks.
    const glow = ctx.createRadialGradient(256, 70, 4, 256, 70, 70); glow.addColorStop(0, 'rgba(95,230,239,.35)'); glow.addColorStop(1, 'rgba(95,230,239,0)');
    ctx.fillStyle = glow; ctx.fillRect(180, 0, 152, 150);
    ctx.fillStyle = '#1d3a45'; ctx.beginPath(); ctx.arc(256, 66, 30, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#8ff4f8'; ctx.lineWidth = 3.5; ctx.lineCap = 'round'; fork(ctx, 256, 44, 46);
    // Work lamps hanging on their flex, each with its warm pool.
    for (const lx of [80, 430]) {
      ctx.strokeStyle = '#222'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(lx, 0); ctx.lineTo(lx, 28); ctx.stroke();
      const pool = ctx.createRadialGradient(lx, 34, 2, lx, 90, 120); pool.addColorStop(0, 'rgba(255,214,150,.75)'); pool.addColorStop(1, 'rgba(255,214,150,0)');
      ctx.fillStyle = pool; ctx.fillRect(lx - 130, 20, 260, 236);
      ctx.fillStyle = '#3a3a36'; ctx.beginPath(); ctx.moveTo(lx - 12, 36); ctx.lineTo(lx + 12, 36); ctx.lineTo(lx + 6, 26); ctx.lineTo(lx - 6, 26); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#ffe7b8'; ctx.fillRect(lx - 8, 35, 16, 3);
    }
    // Two rows of chairs facing the back, none like the next: the far row smaller.
    const kinds = ['#7a5536', '#c9cbc8', '#3f6b7a', '#b4472f', '#7a5536', '#2c2e30', '#d9c48a', '#c9cbc8'];
    const chair = (x: number, base: number, s: number, c: string, i: number) => {
      ctx.fillStyle = c;
      ctx.fillRect(x - 11 * s, base - 30 * s, 22 * s, 4 * s); // seat
      ctx.fillRect(x - 11 * s, base - 54 * s, 22 * s, (i % 3 === 1 ? 10 : 20) * s); // back
      ctx.fillStyle = i % 3 === 1 ? '#9a9c9a' : c;
      for (const lx of [-10, 8]) ctx.fillRect(x + lx * s, base - 30 * s, 2.5 * s, 30 * s);
      ctx.fillRect(x - 11 * s, base - 54 * s, 2.5 * s, 24 * s); ctx.fillRect(x + 8.5 * s, base - 54 * s, 2.5 * s, 24 * s);
    };
    for (let i = 0; i < 8; i++) chair(70 + i * 53, 182, 0.8, kinds[(i + 3) % kinds.length], i + 1);
    for (let i = 0; i < 7; i++) chair(90 + i * 58, 232, 1, kinds[i], i);
    // A coat left on one chair, a score on another.
    ctx.fillStyle = '#4b5a3c'; ctx.fillRect(140, 182, 26, 34);
    ctx.fillStyle = '#f1ece0'; ctx.fillRect(320, 199, 16, 4);
    // Stands with their scores, and the keyboard at the front.
    for (const sx of [190, 360]) { ctx.fillStyle = '#1e1f21'; ctx.fillRect(sx, 150, 2.5, 54); ctx.fillRect(sx - 14, 140, 30, 14); ctx.fillStyle = '#efe9db'; ctx.fillRect(sx - 12, 141, 26, 10); }
    ctx.fillStyle = '#1b1c1e'; ctx.fillRect(228, 148, 64, 8); ctx.fillRect(232, 156, 3, 26); ctx.fillRect(285, 156, 3, 26);
    ctx.fillStyle = '#f2f2ee'; for (let k = 0; k < 15; k++) ctx.fillRect(230 + k * 4, 149, 3, 4);
    // The light falling out onto the threshold.
    const spill = ctx.createLinearGradient(0, h - 40, 0, h); spill.addColorStop(0, 'rgba(255,220,170,0)'); spill.addColorStop(1, 'rgba(255,220,170,.35)');
    ctx.fillStyle = spill; ctx.fillRect(0, h - 40, w, 40);
  });
}
