import * as pc from 'playcanvas';
import type { GeoLandmark } from '../geo';
import type { LandmarkKit } from '../landmarks';

/**
 * A sand sculpture by the promenade, like the ones street artists make on Barcelona's beaches: a cat
 * curled up asleep, about a metre long, smoothed and a shade darker than the dry sand (it is kept
 * damp), with its sculptor's cap upside down beside it for coins. The place's one wink.
 */
export const kind = 'gat-de-sorra';

export function build(kit: LandmarkKit, landmark: GeoLandmark) {
  const sand = kit.surface('sorra-humida', String(landmark.params.colour ?? '#c7a873'), 0.12);
  const shade = kit.surface('sorra-humida', '#a88d60', 0.12);
  // Built at a metre long, then grown by `scale` (the people on the promenade made it big).
  const holder = new pc.Entity('Gato de arena'), s = Number(landmark.params.scale ?? 1);
  holder.setLocalScale(s, s, s); kit.root.addChild(holder);
  const part = (name: string, type: pc.RenderComponent['type'], m: pc.Material, p: number[], size: number[], turn?: number[]) => kit.part(name, type, m, p, size, turn, holder);
  // A low mound it is carved from, then the curled body, the head on the paws, the ears and the tail round its front.
  part('Peana de arena', 'sphere', shade, [0, -0.05, 0], [1.7, 0.3, 1.3]);
  part('Cuerpo del gato', 'sphere', sand, [0, 0.2, -0.05], [1.05, 0.45, 0.8]);
  part('Cabeza del gato', 'sphere', sand, [0.42, 0.28, 0.24], [0.42, 0.34, 0.4]);
  for (const side of [-1, 1]) part('Oreja', 'cone', sand, [0.47 + side * 0.11, 0.48, 0.2], [0.12, 0.16, 0.1], [0, 0, -side * 12]);
  for (let k = 0; k < 6; k++) {
    // The tail wraps round the front of the body to the nose.
    const a = Math.PI * (0.15 + k * 0.13);
    part('Cola', 'sphere', sand, [-Math.cos(a) * 0.5, 0.12, 0.3 + Math.sin(a) * 0.12], [0.16, 0.13, 0.16]);
  }
  for (const side of [-1, 1]) part('Ojo cerrado', 'box', kit.mat('Raya de arena', '#8f7a54', 0.1), [0.5 + side * 0.08, 0.33, 0.44], [0.07, 0.012, 0.01], [0, 0, side * 12]);
  // The cap, upside down, a few coins in it.
  const cap = kit.mat('Gorra', '#2a3f66', 0.15);
  part('Gorra', 'sphere', cap, [-0.95, 0.07, 0.45], [0.3, 0.16, 0.3]);
  part('Visera', 'box', cap, [-0.95, 0.02, 0.66], [0.22, 0.02, 0.16]);
  const coin = kit.mat('Moneda', '#c9a24a', 0.7);
  for (const [dx, dz] of [[0.04, -0.03], [-0.05, 0.04], [0.02, 0.06]]) part('Moneda', 'cylinder', coin, [-0.95 + dx, 0.15, 0.45 + dz], [0.05, 0.008, 0.05]);
}
