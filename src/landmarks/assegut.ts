import * as pc from 'playcanvas';
import type { GeoLandmark } from '../geo';
import type { LandmarkKit } from '../landmarks';

/**
 * People sitting still in a row, on a bench the zone already has (place it on the bench's centre
 * with the bench's yaw): the game's block figures, seated, in muted everyday clothes. Under her
 * spell they do nothing, and every head is turned the same way, whichever way the body faces:
 * `look` is that heading in the zone's frame (degrees, as `rotation_deg`), `people` how many (1–3),
 * `seat` the seat's height, `seed` varies clothes, skin and hair.
 */
export const kind = 'assegut';

// Few colours on purpose: every one is a material, and each material is a draw call per stretch of street.
const CLOTHES = ['#7b6f63', '#8a5a4a', '#6a7350', '#a39b8f', '#c9c2b4'];
const TROUSERS = ['#3f4448', '#5b5148', '#6b6e70'];
const SKIN = ['#e6b58b', '#c8946a', '#a8744f'];
const HAIR = ['#342a28', '#6b4a32', '#9a9590', '#1f1a18'];

export function build(kit: LandmarkKit, landmark: GeoLandmark) {
  const { params } = landmark;
  const people = Math.max(1, Math.min(3, Number(params.people ?? 2)));
  const seed = Number(params.seed ?? 0), look = Number(params.look ?? 0), seat = Number(params.seat ?? 0.42);
  // Spread along the bench, not evenly: people leave a gap.
  const spots = people === 1 ? [0.15] : people === 2 ? [-0.32, 0.36] : [-0.4, 0.02, 0.42];
  spots.forEach((x, i) => seated(kit, kit.root, x, -0.08, 0, look - landmark.angle, seat, seed * 7 + i));
}

/**
 * One seated figure under `parent` at (x, z), its body turned `yaw` (degrees) and its head turned to
 * `look` (degrees in the parent's frame), on a seat `seat` metres high. Its front is +z at yaw 0.
 */
export function seated(kit: LandmarkKit, parent: pc.Entity, x: number, z: number, yaw: number, look: number, seat: number, seed: number) {
  const pick = <T>(list: readonly T[], k: number) => list[Math.abs(Math.floor(seed * 13 + k * 7)) % list.length];
  // Small pieces cast no sun shadow (the contact shadows still seat them): a square full of people
  // would otherwise double its draw calls in the shadow pass.
  const part = (...args: Parameters<LandmarkKit['part']>) => { kit.part(...args).render!.castShadows = false; };
  const body = new pc.Entity('Persona sentada');
  body.setLocalPosition(x, 0, z); body.setLocalEulerAngles(0, yaw, 0); parent.addChild(body);
  const shirt = kit.mat('Ropa', pick(CLOTHES, 1), 0.15), trousers = kit.mat('Pantalón', pick(TROUSERS, 2), 0.15);
  const skin = kit.mat('Piel', pick(SKIN, 3), 0.2), hair = kit.mat('Pelo', pick(HAIR, 4), 0.25);
  // Legs: thighs on the seat, shins down to the ground, feet forward.
  for (const side of [-1, 1]) {
    part('Muslo', 'box', trousers, [side * 0.1, seat + 0.08, 0.12], [0.16, 0.16, 0.38], undefined, body);
    part('Pierna', 'box', trousers, [side * 0.1, seat / 2, 0.28], [0.15, seat, 0.17], undefined, body);
    part('Zapato', 'box', trousers, [side * 0.1, 0.05, 0.33], [0.17, 0.1, 0.26], undefined, body);
  }
  // Torso upright on the seat, arms hanging with the hands on the thighs.
  const top = seat + 0.5;
  part('Torso', 'box', shirt, [0, seat + 0.27, -0.06], [0.42, 0.45, 0.28], undefined, body);
  for (const side of [-1, 1]) {
    part('Brazo', 'box', shirt, [side * 0.27, seat + 0.3, -0.03], [0.13, 0.3, 0.17], undefined, body);
    part('Mano', 'box', skin, [side * 0.22, seat + 0.17, 0.12], [0.11, 0.1, 0.13], undefined, body);
  }
  part('Cuello', 'box', skin, [0, top, -0.06], [0.13, 0.08, 0.13], undefined, body);
  // The head, turned with everyone else's: the face, and the hair over the back and top.
  const head = new pc.Entity('Cabeza');
  head.setLocalPosition(0, top + 0.03, -0.06); head.setLocalEulerAngles(0, look - yaw, 0); body.addChild(head);
  part('Cara', 'sphere', skin, [0, 0.17, 0], [0.32, 0.36, 0.3], undefined, head);
  part('Pelo', 'sphere', hair, [0, 0.25, -0.06], [0.34, 0.28, 0.25], undefined, head);
  part('Pelo', 'sphere', hair, [0, 0.33, -0.01], [0.34, 0.15, 0.29], undefined, head);
  return body;
}
