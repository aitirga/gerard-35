import type { DieFace } from './battle';

/**
 * Dadista's faces as printer's ornaments (docs/animas/dadaista/ § Faces with icons): ink on ivory,
 * the blank in the die's red. One path each, on a 100 × 100 face, filled nonzero (holes run the other
 * way round), so the same drawing goes on the 3D die's texture (`Path2D`) and in the interface (SVG).
 */
export const FACE_ICONS: Record<DieFace, string> = {
  // A manicule: cuff, palm, the index pointing out, two fingers folded under it, the thumb over them.
  mano: 'M8 33H20V67H8Z M22 35Q22 31 26 31H50V67H26Q22 67 22 63Z M52 33H86Q92 33 92 39Q92 45 86 45H52Z M52 47H66Q70 47 70 51Q70 55 66 55H52Z M52 57H63Q67 57 67 61Q67 65 63 65H52Z M30 29Q30 20 40 20H48Q53 20 53 25Q53 29 48 29Z',
  // Scissors, open: two rings and two blades crossing.
  tijeras: 'M14 30a12 12 0 1 0 24 0a12 12 0 1 0 -24 0Z M19 30a7 7 0 1 1 14 0a7 7 0 1 1 -14 0Z M14 70a12 12 0 1 0 24 0a12 12 0 1 0 -24 0Z M19 70a7 7 0 1 1 14 0a7 7 0 1 1 -14 0Z M34 38L39 33L91 66L86 69Z M34 62L39 67L91 34L86 31Z',
  // An eye: the almond and its pupil.
  ojo: 'M8 50Q50 14 92 50Q50 86 8 50Z M16 50Q50 78 84 50Q50 22 16 50Z M37 50a13 13 0 1 0 26 0a13 13 0 1 0 -26 0Z',
  // A pair of brackets.
  corchete: 'M22 18H44V27H32V73H44V82H22Z M78 18H56V27H68V73H56V82H78Z',
  // Nothing printed: an empty red frame.
  blanco: 'M20 20H80V80H20Z M28 28V72H72V28Z',
  // The Comodín: a four-pointed star, in red on its black lacquer.
  comodin: 'M50 8L60 40L92 50L60 60L50 92L40 60L8 50L40 40Z',
};
/** The ink each face is printed in: the blank is the die's red, and so is the Comodín's star on its black. */
export const FACE_INK = { ink: '#1c1917', red: '#d9422b' } as const;
export const faceInk = (face: DieFace) => face === 'blanco' || face === 'comodin' ? FACE_INK.red : FACE_INK.ink;
/** Each face's name in the hand and what it does there, in plain words. */
export const FACE_NAMES: Record<DieFace, string> = { mano: 'Mano', tijeras: 'Tijeras', ojo: 'Ojo', corchete: 'Corchete', blanco: 'En blanco', comodin: 'Comodín' };
/** What each face does when its die is spent, in a few words for the hand (the moves' own descriptions are in `SKILLS`). */
export const FACE_LINES: Record<Exclude<DieFace, 'blanco'>, string> = { mano: 'Golpe fuerte', tijeras: 'Golpe y sangrado', ojo: 'Punto débil', corchete: 'Protege a un aliado', comodin: 'Golpe fuerte a todos' };
/** A face as inline SVG, for the hand and the plates. */
export const faceSvg = (face: DieFace) => `<svg viewBox="0 0 100 100" aria-hidden="true"><path fill="${faceInk(face)}" d="${FACE_ICONS[face]}"/></svg>`;

/** A stroke of an ornament: points on the 100 × 100 face, joined in order. */
export type Stroke = readonly (readonly [number, number])[];
const circle = (cx: number, cy: number, r: number, n = 18): Stroke => Array.from({ length: n + 1 }, (_, i) => { const a = i / n * Math.PI * 2; return [cx + Math.cos(a) * r, cy + Math.sin(a) * r] as const; });
const curve = (a: readonly [number, number], c: readonly [number, number], b: readonly [number, number], n = 10): Stroke => Array.from({ length: n + 1 }, (_, i) => {
  const t = i / n, u = 1 - t;
  return [u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]] as const;
});
/**
 * Each ornament as strokes of a pen, the same drawing as `FACE_ICONS`, so a fight can draw a face in
 * the air dot by dot (src/dice-fx.ts) and it reads as the die's own.
 */
export const FACE_STROKES: Record<DieFace, readonly Stroke[]> = {
  mano: [
    [[8, 33], [20, 33], [20, 67], [8, 67], [8, 33]],
    [[50, 31], [26, 31], [22, 35], [22, 63], [26, 67], [50, 67]],
    [[30, 29], [30, 24], [36, 20], [48, 20], [53, 25], [48, 29], [30, 29]],
    [[52, 33], [86, 33], [92, 39], [86, 45], [52, 45]],
    [[52, 47], [66, 47], [70, 51], [66, 55], [52, 55]],
    [[52, 57], [63, 57], [67, 61], [63, 65], [52, 65]],
  ],
  tijeras: [circle(26, 30, 10, 14), circle(26, 70, 10, 14), [[35, 37], [90, 66]], [[35, 63], [90, 34]]],
  ojo: [curve([8, 50], [50, 14], [92, 50]), curve([8, 50], [50, 86], [92, 50]), circle(50, 50, 12, 16)],
  corchete: [[[44, 18], [22, 18], [22, 82], [44, 82]], [[56, 18], [78, 18], [78, 82], [56, 82]]],
  blanco: [[[20, 20], [80, 20], [80, 80], [20, 80], [20, 20]]],
  comodin: [[[50, 8], [60, 40], [92, 50], [60, 60], [50, 92], [40, 60], [8, 50], [40, 40], [50, 8]]],
};
