import * as pc from 'playcanvas';
import type { Cell } from './movement';

/** What of the salon depends on the mission's run: the queues still keeping the way, the nave's mirrors as they stand and the light they carry. */
export interface SalonState {
  queues: Cell[][];
  mirrors: { cell: Cell; facing: 0 | 1 }[];
  /** The window's beam, cell by cell, and whether it reached the chaplains' chairs. */
  beam: { path: Cell[]; hit: boolean };
}

/**
 * Fran's salon inside the Sagrada Família (docs/quests/luca.md § La Sagrada peluquería), set over the
 * basilica while the mission runs and gone once Fran is beaten. More salon the deeper in: by the door
 * only a desk with his appointment book; in the nave, rows of salon chairs before tall mirrors; along
 * the Passion arm, a dye bar whose bowls carry Luca's colours; in the apse, Luca's lenses and star
 * charts on stands; under the canopy, Fran's own chair and a hood dryer hanging like a hyperboloid.
 * Across the way, the queues of grey visitors behind their belts; in the nave, the three mirrors that
 * turn and the window's light they carry.
 * Black, chrome and white, the salon's; the colours are Luca's; no pink and no violet. Sizes in cells
 * (1.5 m), as the plan.
 */
export function buildSalon(parent: pc.Entity, toWorld: (px: number, pz: number) => pc.Vec3, state: SalonState) {
  const root = new pc.Entity('La peluquería de Fran'); parent.addChild(root);
  const materials: pc.StandardMaterial[] = [];
  const mat = (name: string, hex: string, gloss = .4, glow = 0, opacity = 1) => {
    const m = new pc.StandardMaterial(); m.name = name; m.diffuse.fromString(hex); m.gloss = gloss; m.useMetalness = false;
    if (glow) { m.emissive.fromString(hex); m.emissiveIntensity = glow; }
    if (opacity < 1) { m.opacity = opacity; m.blendType = pc.BLEND_NORMAL; m.depthWrite = false; }
    m.update(); materials.push(m); return m;
  };
  const black = mat('Cuero negro', '#18181c', .55), chrome = mat('Cromado', '#d9dde4', .9), white = mat('Lacado blanco', '#f4f2ec', .6);
  const glass = mat('Espejo', '#cfe0ea', .95, .25), paper = mat('Papel', '#efe8d6', .2), brass = mat('Latón', '#c89a3a', .85);
  const dryerGlass = mat('Casco del secador', '#e9f3ff', .9, .2, .55);
  /** A primitive at cell (`px`, `pz`), `y` up, sized in cells. */
  function part(name: string, type: pc.RenderComponent['type'], m: pc.Material, px: number, pz: number, y: number, s: number[], r: number[] = [0, 0, 0], into: pc.Entity = root) {
    const e = new pc.Entity(name); e.addComponent('render', { type, material: m, castShadows: true });
    const at = toWorld(px, pz); e.setLocalPosition(at.x, y, at.z); e.setLocalScale(s[0], s[1], s[2]); e.setLocalEulerAngles(r[0], r[1], r[2]);
    into.addChild(e); return e;
  }
  /** A salon chair facing −z (towards its mirror). */
  function chair(px: number, pz: number, yaw = 0) {
    const c = new pc.Entity('Sillón de peluquería'); root.addChild(c);
    part('Pie', 'cylinder', chrome, px, pz, .05, [.36, .1, .36], [0, yaw, 0], c);
    part('Columna', 'cylinder', chrome, px, pz, .2, [.08, .3, .08], [0, yaw, 0], c);
    part('Asiento', 'box', black, px, pz, .38, [.42, .1, .4], [0, yaw, 0], c);
    part('Respaldo', 'box', black, px, pz + (yaw ? -.2 : .2), .62, [.42, .45, .08], [0, yaw, 0], c);
    for (const dx of [-.24, .24]) part('Brazo', 'box', chrome, px + dx, pz, .5, [.05, .05, .36], [0, 0, 0], c);
  }
  /** A tall mirror on a black frame, its glass facing +z. */
  function mirror(px: number, pz: number) {
    part('Marco del espejo', 'box', black, px, pz, .75, [.62, 1.3, .06]);
    part('Espejo', 'box', glass, px, pz + .035, .78, [.52, 1.18, .02]);
  }

  // La recepción, in the Nativity arm by the door: a desk with the appointment book, still the church round it.
  part('Mostrador', 'box', white, 42, 37.6, .38, [2.2, .76, .55]);
  part('Encimera', 'box', black, 42, 37.6, .78, [2.3, .05, .62]);
  part('Agenda', 'box', paper, 41.6, 37.6, .82, [.42, .04, .3], [0, 12, 0]);
  part('Rótulo «Fran»', 'box', black, 42, 37.9, 1.15, [1.3, .28, .04]);

  // The queues: grey visitors behind a black belt on chrome posts, waiting their turn across the way.
  const belt = mat('Cinta de la cola', '#1c1c20', .5), visitor = mat('Visitante gris', '#9a9890', .2), visitorDark = mat('Visitante gris oscuro', '#6f6c66', .2);
  for (const cells of state.queues) {
    cells.forEach((c, i) => {
      if (i % 2 === 0) { part('Poste', 'cylinder', chrome, c.x, c.z, .45, [.06, .9, .06]); part('Base del poste', 'cylinder', chrome, c.x, c.z, .02, [.22, .04, .22]); }
      const next = cells[i + 1];
      if (next && Math.abs(next.x - c.x) + Math.abs(next.z - c.z) === 1) {
        const a = toWorld(c.x, c.z), b = toWorld(next.x, next.z), along = new pc.Vec3().sub2(b, a);
        const e = part('Cinta', 'box', belt, (c.x + next.x) / 2, (c.z + next.z) / 2, .86, [along.length(), .06, .02]);
        e.setLocalEulerAngles(0, -Math.atan2(along.z, along.x) * 180 / Math.PI, 0);
      }
      // Someone every third cell, standing in line, all the same grey.
      if (i % 3 === 1) {
        const tone = i % 2 ? visitor : visitorDark;
        part('Visitante', 'capsule', tone, c.x + .3, c.z + .3, .55, [.34, .55, .26]);
        part('Cabeza de visitante', 'sphere', visitorDark, c.x + .3, c.z + .3, 1.18, [.24, .26, .24]);
      }
    });
  }

  // The nave's mirrors (src/espejos.ts): tall salon mirrors on a stand, turned along `\` or `/`.
  const frame = mat('Marco del espejo grande', '#d9dde4', .9), face = mat('Luna del espejo', '#e9f3ff', .95, .5);
  for (const m of state.mirrors) {
    part('Pie del espejo', 'cylinder', black, m.cell.x, m.cell.z, .05, [.5, .1, .5]);
    const panel = new pc.Entity('Espejo giratorio'); const at = toWorld(m.cell.x, m.cell.z);
    panel.setLocalPosition(at.x, 0, at.z); panel.setLocalEulerAngles(0, m.facing === 0 ? -45 : 45, 0); root.addChild(panel);
    for (const [name, mm, y, s] of [['Marco', frame, .85, [1.15, 1.45, .08]], ['Luna', face, .87, [1.02, 1.32, .1]]] as const) {
      const e = new pc.Entity(name); e.addComponent('render', { type: 'box', material: mm, castShadows: true });
      e.setLocalPosition(0, y, 0); e.setLocalScale(s[0], s[1], s[2]); panel.addChild(e);
    }
  }
  // The window's light, from mirror to mirror: a bright shaft at chest height, warm on the chairs it reaches.
  const shaft = mat('Rayo de la vidriera', '#fff4d6', .2, 2.4, .7);
  const path = state.beam.path;
  const corners = path.filter((c, i) => i === 0 || i === path.length - 1 || ((path[i + 1].x - c.x) !== (c.x - path[i - 1].x) || (path[i + 1].z - c.z) !== (c.z - path[i - 1].z)));
  for (let i = 0; i + 1 < corners.length; i++) {
    const a = corners[i], b = corners[i + 1], dx = b.x - a.x, dz = b.z - a.z, len = Math.hypot(dx, dz);
    part('Rayo', 'box', shaft, (a.x + b.x) / 2, (a.z + b.z) / 2, 1.0, [dx ? len : .08, .08, dz ? len : .08]).render!.castShadows = false;
  }
  const end = path.at(-1);
  if (end) part(state.beam.hit ? 'Luz en los sillones' : 'Luz en la pared', 'sphere', mat('Destello', state.beam.hit ? '#ffd84f' : '#fff4d6', .2, state.beam.hit ? 3 : 1.2, .8), end.x, end.z, 1.0, state.beam.hit ? [1.4, .8, 1.4] : [.4, .4, .4]).render!.castShadows = false;

  // Los sillones, in the nave: a row of chairs before mirrors on either side of the middle aisle.
  for (const px of [4, 7, 10, 13, 16, 19]) {
    mirror(px, 13.4); chair(px, 14.4);
    mirror(px, 26.6); chair(px, 25.6, 180);
  }

  // La carta de colores, along the Passion arm: a long dye bar, its bowls in Luca's colours.
  part('Barra de tintes', 'box', white, 36, 1.2, .45, [12, .9, .6]);
  part('Encimera de la barra', 'box', black, 36, 1.2, .92, [12.2, .05, .68]);
  ['#e8503a', '#ff8f3f', '#ffd84f', '#4fbf7a', '#4f9fe8', '#2f8f7a', '#f08a2c', '#f1ece2'].forEach((hex, i) => {
    const bowl = mat(`Cuenco de tinte ${i}`, hex, .5, .15);
    part('Cuenco de tinte', 'cylinder', bowl, 31 + i * 1.4, 1.2, 1.0, [.32, .12, .32]);
    part('Pincel', 'box', black, 31.2 + i * 1.4, 1.2, 1.12, [.03, .25, .03], [0, 0, 20]);
  });

  // El ábside: Luca's lenses on brass stands and star charts on easels, turned on the room.
  for (const [px, pz] of [[53, 12], [57, 16], [57, 24], [53, 28]]) {
    part('Pie de la lente', 'cylinder', brass, px, pz, .45, [.05, .9, .05]);
    part('Lente', 'cylinder', glass, px, pz, .95, [.36, .03, .36], [70, 0, 0]);
  }
  for (const [px, pz] of [[55, 9], [59, 20], [55, 31]]) {
    part('Caballete', 'box', black, px, pz, .55, [.05, 1.1, .05], [12, 0, 0]);
    const chart = part('Carta de estrellas', 'box', mat('Carta de estrellas', '#1d2a44', .3, .1), px, pz + .1, .85, [.7, .5, .02], [-12, 0, 0]);
    for (let k = 0; k < 7; k++) {
      const star = new pc.Entity('Estrella'); star.addComponent('render', { type: 'sphere', material: mat('Estrella', '#fff1cc', .2, 1.4), castShadows: false });
      star.setLocalPosition(-.35 + ((k * 37) % 70) / 100, -.18 + ((k * 23) % 36) / 100, .6); star.setLocalScale(.05, .08, .4);
      chart.addChild(star);
    }
  }

  // El crucero: Fran's chair on the presbytery steps, under a hood dryer hung from the canopy.
  chair(44, 20, 270);
  part('Cable del secador', 'cylinder', chrome, 44, 20, 3.2, [.03, 1.6, .03]);
  part('Secador de casco', 'cone', dryerGlass, 44, 20, 1.6, [.9, .8, .9], [180, 0, 0]);
  part('Aro del secador', 'cylinder', chrome, 44, 20, 1.22, [.95, .04, .95]);

  return { destroy() { root.destroy(); materials.forEach(m => m.destroy()); } };
}
