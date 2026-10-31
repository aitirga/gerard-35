import type { GeoLandmark } from '../geo';
import type { LandmarkKit } from '../landmarks';
import type { MeshBuilder } from '../geo-scenery';
import { bar, box, crown, prism } from '../landmark-shapes.ts';

type V3 = [number, number, number];

/**
 * Montjuïc rising behind Poble Sec (docs/places/poble-sec.md § The slope on flat ground): the zone's
 * back edge, beyond where Gerard walks. The game's ground is flat, so the hill is drawn as the barrio
 * really climbs it: terraces held by rubble-stone walls, a row of houses on each, every street from
 * Blai carrying on up as stairs with an iron handrail, Passeig de l'Exposició with its trees, and
 * the wooded slope of umbrella pines and holm oaks up to the castle's wall on the crest. Margarit's
 * stair (`long`) is the one that keeps climbing through the pines, lit by its lamps.
 *
 * The footprint's front edge (+z) meets the zone's back edge; local x runs along it. `streets`: the
 * local x of each stair; `long`: Margarit's; `tiers`: [depth, rise] of each terrace from the front.
 * Real heights are compressed (the stairs start 200–300 m above Blai): see the place's doc.
 */
export const kind = 'montjuic-vessant';

const RISER = 0.17, TREAD = 0.3, STAIR = 4.4;
const HOUSE_COLOURS = ['#c98a5e', '#b8744a', '#e3c39b', '#d9a77a', '#e6d2b5', '#cf9a76'];

export function build(kit: LandmarkKit, landmark: GeoLandmark) {
  const { params } = landmark;
  const W = landmark.w * kit.cell, D = landmark.d * kit.cell, F = D / 2, left = -W / 2, right = W / 2;
  const streets = (params.streets as number[] | undefined) ?? [];
  const long = Number(params.long ?? streets[0] ?? 0);
  const tiers = (params.tiers as [number, number][] | undefined) ?? [[14, 6], [14, 7], [10, 7]];
  const crest = Number(params.crest ?? 58);
  let seed = 7;
  const rand = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

  const wall = kit.mesh(), ground = kit.mesh(), steps = kit.mesh(), iron = kit.mesh(), roofs = kit.mesh(), slope = kit.mesh();
  const trunks = kit.mesh(), pines = kit.mesh(), oaks = kit.mesh(), lamps = kit.mesh(), castle = kit.mesh();
  const houses = HOUSE_COLOURS.map(() => kit.mesh());
  /** Gaps in each terrace where a stair climbs, sorted along x. */
  const gaps = streets.map(x => [x - STAIR / 2 - 0.5, x + STAIR / 2 + 0.5]).sort((a, b) => a[0] - b[0]);
  /** The stretches of a terrace between its stairs. */
  const between = (from: number, to: number) => {
    const out: [number, number][] = [];
    let at = from;
    for (const [g0, g1] of gaps) { if (g0 > at) out.push([at, Math.min(g0, to)]); at = Math.max(at, g1); }
    if (at < to) out.push([at, to]);
    return out.filter(([a, b]) => b - a > 0.3);
  };

  // ------------------------------------------------------------ terraces, their stairs and houses
  let z = F, y = 0;
  tiers.forEach(([depth, rise], tier) => {
    const top = y + rise, back = z - depth;
    for (const [a, b] of between(left, right)) {
      // The retaining wall facing the camera and the street along its top.
      wall.quad([a, y, z], [b, y, z], [b, top, z], [a, top, z], [0, 0, 1], [a, y], [b, y], [b, top], [a, top]);
      ground.quad([a, top, z], [b, top, z], [b, top, back], [a, top, back], [0, 1, 0], [a, z], [b, z], [b, back], [a, back]);
      // A parapet along the edge, so the street above reads as a street.
      box(wall, (a + b) / 2, top, z - 0.25, b - a, 0.9, 0.5);
    }
    for (const x of streets) {
      // The street climbs on as a stair cut into the terrace, between stone walls, a handrail up the middle.
      const run = Math.min(depth - 1.5, (rise / RISER) * TREAD), n = Math.ceil(rise / RISER);
      for (let k = 0; k < n; k++) {
        const t = Math.min(rise, (k + 1) * RISER), zz = z - (k / n) * run;
        box(steps, x, y, zz - run / n / 2, STAIR, t, run / n);
      }
      ground.quad([x - STAIR / 2 - 0.5, top, z - run], [x + STAIR / 2 + 0.5, top, z - run], [x + STAIR / 2 + 0.5, top, back], [x - STAIR / 2 - 0.5, top, back], [0, 1, 0],
        [x - 2, z - run], [x + 2, z - run], [x + 2, back], [x - 2, back]);
      for (const s of [-1, 1]) {
        const sx = x + s * (STAIR / 2 + 0.25);
        box(wall, sx, y, z - run / 2, 0.5, rise + 0.9, run);
      }
      bar(iron, [x, y + 0.95, z], [x, top + 0.95, z - run], 0.05);
      for (let k = 0; k <= 4; k++) box(iron, x, y + (rise * k) / 4, z - (run * k) / 4 - 0.02, 0.04, 0.95, 0.04);
      // A wall lamp at the top of each flight.
      box(iron, x + STAIR / 2 + 0.55, top + 2.6, z - run + 0.4, 0.08, 0.08, 0.5);
      box(lamps, x + STAIR / 2 + 0.55, top + 2.35, z - run + 0.65, 0.22, 0.28, 0.22, 0, true);
    }
    if (tier < tiers.length - 1) {
      // A row of houses on the terrace, set back behind the street, broken where the stairs climb.
      for (const [a, b] of between(left, right)) {
        let x = a;
        while (b - x > 3) {
          const w = Math.min(b - x, 6 + rand() * 6), storeys = 3 + Math.floor(rand() * 3), h = storeys * 3;
          const colour = Math.floor(rand() * HOUSE_COLOURS.length), front = z - 4.5, d = depth - 5.5;
          const m = houses[colour];
          m.quad([x, top, front], [x + w, top, front], [x + w, top + h, front], [x, top + h, front], [0, 0, 1], [0, 0], [w / 2.7, 0], [w / 2.7, storeys], [0, storeys]);
          m.quad([x + w, top, front], [x + w, top, front - d], [x + w, top + h, front - d], [x + w, top + h, front], [1, 0, 0], [0, 0], [d / 2.7, 0], [d / 2.7, storeys], [0, storeys]);
          m.quad([x, top, front - d], [x, top, front], [x, top + h, front], [x, top + h, front - d], [-1, 0, 0], [0, 0], [d / 2.7, 0], [d / 2.7, storeys], [0, storeys]);
          roofs.quad([x, top + h, front], [x + w, top + h, front], [x + w, top + h, front - d], [x, top + h, front - d], [0, 1, 0], [x, front], [x + w, front], [x + w, front - d], [x, front - d]);
          // The parapet of its flat roof and, on some, the stair's hut and an aerial.
          box(roofs, x + w / 2, top + h, front - 0.1, w, 0.5, 0.2);
          if (rand() > 0.45) box(roofs, x + w * (0.25 + rand() * 0.5), top + h, front - d * (0.3 + rand() * 0.4), 2.2, 2.4, 2.2);
          if (rand() > 0.5) bar(iron, [x + w * 0.7, top + h, front - 2], [x + w * 0.7, top + h + 2.6, front - 2], 0.05);
          x += w;
        }
      }
    }
    z = back; y = top;
  });

  // ------------------------------------------------------------ the wooded slope up to the crest
  // A folded surface from the last terrace to the crest; the creases soften near Margarit's stair.
  const cols = 24, rows = 6, z0 = z, y0 = y;
  const height = (x: number, zz: number) => {
    const t = (z0 - zz) / (z0 + F), calm = Math.min(1, Math.abs(x - long) / 25);
    const fold = (Math.sin(x * 0.045 + 1.3) * 4 + Math.sin(x * 0.11) * 2) * t * calm;
    return y0 + (crest - y0) * Math.pow(t, 0.85) + fold;
  };
  const vx = (i: number) => left + (W * i) / cols, vz = (j: number) => z0 - ((z0 + F) * j) / rows;
  for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
    const p = (a: number, b: number): V3 => [vx(a), height(vx(a), vz(b)), vz(b)];
    const c00 = p(i, j), c10 = p(i + 1, j), c11 = p(i + 1, j + 1), c01 = p(i, j + 1);
    slope.quad(c00, c10, c11, c01, [0, 1, 0.4], [c00[0], c00[2]], [c10[0], c10[2]], [c11[0], c11[2]], [c01[0], c01[2]]);
  }
  for (const [x, s] of [[left, -1], [right, 1]] as const) {
    // The cut ends of the hill, where the diorama stops.
    for (let j = 0; j < rows; j++) {
      const a = vz(j), b = vz(j + 1);
      wall.quad([x, 0, a], [x, 0, b], [x, height(x, b), b], [x, height(x, a), a], [s, 0, 0], [a, 0], [b, 0], [b, height(x, b)], [a, height(x, a)]);
    }
    let zz = F, yy = 0;
    for (const [depth, rise] of tiers) { wall.quad([x, 0, zz], [x, 0, zz - depth], [x, yy + rise, zz - depth], [x, yy + rise, zz], [s, 0, 0], [zz, 0], [zz - depth, 0], [zz - depth, yy + rise], [zz, yy + rise]); zz -= depth; yy += rise; }
  }
  // Margarit's stair goes on up through the pines in flights, with its lamps.
  const flights = 7, climb = z0 + F;
  for (let f = 0; f < flights; f++) {
    const za = z0 - (climb * f) / flights, zb = z0 - (climb * (f + 0.8)) / flights;
    const ya = height(long, za), yb = height(long, zb), n = Math.max(2, Math.round((yb - ya) / RISER));
    for (let k = 0; k < n; k++) box(steps, long, ya - 0.6 + ((yb - ya) * k) / n, za - ((za - zb) * (k + 0.5)) / n, STAIR - 0.6, 0.6 + RISER, (za - zb) / n);
    const zl = zb - (climb * 0.2) / flights;
    box(steps, long, Math.min(yb, height(long, zl)) - 0.6, (zb + zl) / 2, STAIR, 0.6 + RISER, zb - zl);
    for (const s of [-1, 1]) bar(iron, [long + s * (STAIR / 2 - 0.2), ya + 0.95, za], [long + s * (STAIR / 2 - 0.2), yb + 0.95, zb], 0.05);
    prism(iron, long + STAIR / 2 + 0.4, ya, za - 1, 0.06, 4, 6);
    box(lamps, long + STAIR / 2 + 0.4, ya + 3.75, za - 1, 0.3, 0.35, 0.3, 0, true);
  }
  // Passeig de l'Exposició's plane trees along the last terrace, then umbrella pines and holm oaks.
  const planes = kit.mesh();
  for (let x = left + 6; x < right; x += 9 + rand() * 4) {
    if (streets.some(s => Math.abs(s - x) < 4)) continue;
    const zt = F - tiers.slice(0, -1).reduce((a, [d]) => a + d, 0) - 3;
    bar(trunks, [x, y0 - 0.1, zt], [x, y0 + 4, zt], 0.3);
    crown(planes, x, y0 + 5.2, zt, 2.6, 2.4, 1.8, 1.4, 8, x);
  }
  for (let k = 0; k < 340; k++) {
    const x = left + 4 + rand() * (W - 8), zz = z0 - 3 - rand() * (climb - 6);
    if (Math.abs(x - long) < STAIR + 2.5) continue;
    const base = height(x, zz), pine = rand() > 0.3;
    if (pine) {
      // Umbrella pine: a tall bare trunk, leaning, under a wide flat crown.
      const h = 6 + rand() * 5, lean = (rand() - 0.5) * 2.4;
      bar(trunks, [x, base - 0.3, zz], [x + lean, base + h, zz + lean * 0.3], 0.38);
      crown(pines, x + lean, base + h, zz + lean * 0.3, 3.6 + rand() * 2.4, 3.2 + rand() * 2, 1.7, 0.8, 9, k);
    } else {
      crown(oaks, x, base + 2.2, zz, 2.4 + rand() * 1.4, 2.4 + rand() * 1.4, 2.4, 1.8, 8, k);
    }
  }
  // The castle's wall along the crest: a long stone curtain with a bastion, far back and low.
  const cx = Number(params.castle ?? long + 40);
  box(castle, cx, crest - 3, -F + 6, 120, 8, 3);
  for (let k = 0; k < 24; k++) box(castle, cx - 59 + k * 5, crest + 5, -F + 7.2, 2.2, 1, 0.6);
  box(castle, cx + 64, crest - 3, -F + 7, 9, 9.5, 9, 0.35);

  const add = (name: string, b: MeshBuilder, m: Parameters<LandmarkKit['add']>[2], shadows = true) => kit.add(name, b, m, { shadows });
  add('Muros de contención', wall, kit.surface('mamposteria', String(params.stone ?? '#a39785')));
  add('Calles de la ladera', ground, kit.surface('asfalt', '#5a5c5e'));
  add('Escaleras', steps, kit.surface('granit', '#c4beb2'));
  add('Barandillas', iron, kit.mat('Hierro de barandilla', '#25292b', 0.45));
  add('Terrats de la ladera', roofs, kit.surface('rajola', '#a8735a'));
  add('Ladera de Montjuïc', slope, kit.surface('pinassa', String(params.ground ?? '#474d33')));
  add('Troncos', trunks, kit.mat('Corteza de pino', '#6a5444', 0.05));
  add('Pinos piñoneros', pines, kit.mat('Copa de pino', '#4e6b3c', 0.08));
  add('Encinas', oaks, kit.mat('Copa de encina', '#3f5534', 0.06));
  add('Plátanos del paseo', planes, kit.mat('Copa de plátano', '#6f8a4a', 0.08));
  add('Muralla del castillo', castle, kit.surface('carreu', '#a89a80'));
  add('Farolas de la escalera', lamps, kit.mat('Farola encendida', '#ffd9a0', 0.3, 1.4), false);
  // The houses' fronts: one painted bay per colour (a French window, its balcony, a blind), tiled by bay and storey.
  houses.forEach((b, i) => {
    const m = kit.mat(`Casas de la ladera ${HOUSE_COLOURS[i]}`, '#ffffff', 0.08);
    m.diffuseMap = kit.texture(bay(HOUSE_COLOURS[i], i)); m.update();
    add('Casas de la ladera', b, m);
  });
}

/** One bay of a slope house, one storey high, painted top-down: render, a French window, a blind, an iron balcony. */
function bay(colour: string, i: number) {
  const c = document.createElement('canvas'); c.width = 64; c.height = 72;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = colour; ctx.fillRect(0, 0, 64, 72);
  ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.fillRect(0, 0, 64, 4);
  ctx.fillStyle = '#efe4d0'; ctx.fillRect(18, 12, 28, 48);
  ctx.fillStyle = i % 3 === 0 ? '#f1c77a' : '#2c3a42'; ctx.fillRect(21, 15, 22, 45);
  ctx.fillStyle = ['#8a7a5e', '#5f6e57', '#b8a98c'][i % 3]; ctx.fillRect(21, 15, 22, 14 + (i * 7) % 18);
  ctx.fillStyle = '#a49e92'; ctx.fillRect(12, 60, 40, 4);
  ctx.fillStyle = '#1f2224'; ctx.fillRect(12, 46, 40, 2);
  for (let k = 0; k < 9; k++) ctx.fillRect(13 + k * 4.6, 46, 1.4, 14);
  ctx.fillStyle = 'rgba(0,0,0,.12)'; ctx.fillRect(0, 66, 64, 6);
  return c;
}
