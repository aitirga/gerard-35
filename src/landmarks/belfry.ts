import type { GeoLandmark } from '../geo';
import type { LandmarkKit } from '../landmarks';

type V3 = [number, number, number];

/**
 * The bell stage of a square stone belfry, put on a tower the map already extrudes: on each face a
 * round-headed opening with its bell inside behind a low iron rail, a clock on one face, and a
 * moulded cornice under the roof. `height` is the tower's height in metres (to its eaves); `clock`
 * the face that carries the clock (`front`, `back`, `left`, `right`; default `right`); the footprint
 * is the tower's. San Juan's belfry in Alegia. Everything joins the tower's cut, so nothing is left
 * floating when the cut opens round Gerard.
 */
export const kind = 'belfry';

export function build(kit: LandmarkKit, landmark: GeoLandmark) {
  const w = landmark.w * kit.cell / 2, d = landmark.d * kit.cell / 2, top = Number(landmark.params.height ?? 24);
  const stone = kit.surface('carreu', String(landmark.params.colour ?? '#8f8c86'), 0.1);
  const openings = kit.mesh(), bells = kit.mesh(), iron = kit.mesh(), ashlar = kit.mesh(), dial = kit.mesh();
  const sill = top - 4.3, spring = top - 2.2, r = 0.85;
  const faces = { front: [0, 1, w, d], back: [0, -1, w, d], right: [1, 0, d, w], left: [-1, 0, d, w] } as const;
  const clock = faces[String(landmark.params.clock ?? 'right') as keyof typeof faces] ?? faces.right;
  for (const face of Object.values(faces)) {
    const [nx, nz, half, depth] = face;
    /** A point on this face: `u` across it, `y` up, `out` metres proud of the wall. */
    const at = (u: number, y: number, out = 0.03): V3 => nz ? [u * nz, y, nz * (depth + out)] : [nx * (depth + out), y, -u * nx];
    const n: V3 = [nx, 0, nz];
    // The opening: its square part and its round head, dark against the stone.
    openings.quad(at(-r, sill), at(r, sill), at(r, spring), at(-r, spring), n, [0, 0], [1, 0], [1, 1], [0, 1]);
    for (let k = 0; k < 10; k++) {
      const a0 = Math.PI * k / 10, a1 = Math.PI * (k + 1) / 10;
      openings.tri(at(0, spring), at(Math.cos(a0) * r, spring + Math.sin(a0) * r), at(Math.cos(a1) * r, spring + Math.sin(a1) * r), n);
    }
    // The bell's silhouette in it: a flared skirt under a rounded crown, hung from an iron yoke.
    const bell: [number, number][] = [[-0.42, -0.05], [-0.36, 0.1], [-0.27, 0.45], [-0.24, 0.72], [-0.14, 0.84], [0, 0.87], [0.14, 0.84], [0.24, 0.72], [0.27, 0.45], [0.36, 0.1], [0.42, -0.05]];
    const by = spring - 1.25;
    for (let k = 1; k + 1 < bell.length; k++) bells.tri(at(0, by, 0.06), at(bell[k][0], by + bell[k][1], 0.06), at(bell[k + 1][0], by + bell[k + 1][1], 0.06), n);
    bells.quad(at(-0.42, by - 0.05, 0.06), at(0.42, by - 0.05, 0.06), at(0.36, by + 0.1, 0.06), at(-0.36, by + 0.1, 0.06), n, [0, 0], [1, 0], [1, 1], [0, 1]);
    iron.quad(at(-0.6, by + 0.87, 0.07), at(0.6, by + 0.87, 0.07), at(0.6, by + 1.0, 0.07), at(-0.6, by + 1.0, 0.07), n, [0, 0], [1, 0], [1, 1], [0, 1]);
    // The low iron rail across the opening's foot: a top bar and seven balusters.
    iron.quad(at(-r, sill + 0.52, 0.09), at(r, sill + 0.52, 0.09), at(r, sill + 0.58, 0.09), at(-r, sill + 0.58, 0.09), n, [0, 0], [1, 0], [1, 1], [0, 1]);
    for (let k = -3; k <= 3; k++) {
      const u = k * r / 3.5;
      iron.quad(at(u - 0.02, sill, 0.09), at(u + 0.02, sill, 0.09), at(u + 0.02, sill + 0.55, 0.09), at(u - 0.02, sill + 0.55, 0.09), n, [0, 0], [1, 0], [1, 1], [0, 1]);
    }
    if (half < r) console.warn(`Campanario estrecho: ${landmark.id}`);
    // The clock: a white dial below the opening, on one face only, as on San Juan's tower.
    if (face === clock) {
      const cy = sill - 1.3, cr = 0.62;
      dial.quad(at(-cr, cy - cr, 0.05), at(cr, cy - cr, 0.05), at(cr, cy + cr, 0.05), at(-cr, cy + cr, 0.05), n, [0, 1], [1, 1], [1, 0], [0, 0]);
    }
  }
  // The cornice under the eaves and the string course under the openings, a little wider than the tower.
  ashlar.box([0, top - 0.18, 0], [w * 2 + 0.4, 0.36, d * 2 + 0.4]);
  ashlar.box([0, sill - 0.12, 0], [w * 2 + 0.16, 0.24, d * 2 + 0.16]);
  kit.add('Huecos del campanario', openings, kit.mat('Hueco del campanario', '#1f1d1b', 0.05), { cut: true, shadows: false });
  kit.add('Campanas', bells, kit.mat('Campana', '#5a4a32', 0.55), { cut: true, shadows: false });
  kit.add('Hierros del campanario', iron, kit.mat('Barandilla del campanario', '#26292b', 0.4), { cut: true, shadows: false });
  kit.add('Cornisas del campanario', ashlar, stone, { cut: true });
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#8f8c86'; ctx.fillRect(0, 0, 128, 128);
  ctx.fillStyle = '#efece3'; ctx.beginPath(); ctx.arc(64, 64, 60, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#1c1c1c'; ctx.lineWidth = 3; ctx.stroke();
  ctx.fillStyle = '#1c1c1c';
  for (let k = 0; k < 12; k++) { const a = k * Math.PI / 6; ctx.fillRect(64 + Math.cos(a) * 48 - 2.5, 64 + Math.sin(a) * 48 - 2.5, 5, 5); }
  ctx.lineCap = 'round'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(64, 64); ctx.lineTo(64 + 26, 64 - 14); ctx.stroke();
  ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(64, 64); ctx.lineTo(64 - 6, 64 - 44); ctx.stroke();
  const face = kit.mat('Esfera del campanario', '#ffffff', 0.25);
  face.diffuseMap = kit.texture(c); face.update();
  kit.add('Reloj del campanario', dial, face, { cut: true, shadows: false });
}
