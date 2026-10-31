import * as pc from 'playcanvas';
import type { GeoLandmark } from '../geo';
import type { LandmarkKit } from '../landmarks';

/**
 * People standing in the street, in the game's block figures and clothes of every colour: a queue
 * along the footprint's length (`style: 'queue'`, facing +x, with a security guard at its head when
 * `guard` and the entrance's lettered sign when `sign`) or a tour group round a guide holding up an
 * umbrella (`style: 'group'`, `umbrella` its colour). They never move; the footprint keeps Gerard out
 * of them. `count` and `seed` vary them.
 */
export const kind = 'crowd';

const SKIN = ['#e9bf9c', '#c98f6a', '#f2d2b6', '#8d5a3c', '#d9a77f', '#b07850'];
const CLOTHES = ['#3f6b8a', '#b9483f', '#e0b04a', '#4c7a4f', '#2f3b46', '#e8e1d4', '#5a8fb0', '#c96f3f', '#7a8a9a', '#f2efe6', '#8a3f52'];
const HAIR = ['#2b1d14', '#5a3b22', '#a8743a', '#1c1c1c', '#c9c2b6', '#e2c98e'];
const TROUSERS = ['#2f3b46', '#4a3f35', '#3d5a80', '#c9b99a', '#1f2328'];

export function build(kit: LandmarkKit, landmark: GeoLandmark) {
  const p = landmark.params as { style?: 'queue' | 'group'; count?: number; umbrella?: string; guard?: boolean; sign?: string; seed?: number };
  let seed = (p.seed ?? [...landmark.id].reduce((a, c) => a * 31 + c.charCodeAt(0), 7)) % 2147483646 + 1;
  const random = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  const pick = <T,>(list: T[]) => list[Math.floor(random() * list.length)];
  // Figures are drawn in cells, as tall as Gerard; the footprint is in cells too.
  const u = kit.cell, w = landmark.w * u, d = landmark.d * u;

  /** One visitor at (x, z) metres, facing `yaw` degrees (0: +z); returns it for the guide's umbrella. */
  function person(x: number, z: number, yaw: number, clothes = pick(CLOTHES), extra: 'backpack' | 'cap' | 'none' = pick(['backpack', 'cap', 'none', 'none'])) {
    const e = new pc.Entity('Visitante'); e.setLocalPosition(x, 0, z); e.setLocalEulerAngles(0, yaw, 0);
    const s = u * (0.9 + random() * 0.14); e.setLocalScale(s, s, s); kit.root.addChild(e);
    const top = kit.mat('Ropa', clothes, 0.2), legs = kit.mat('Pantalón', pick(TROUSERS), 0.2);
    for (const side of [-1, 1]) kit.part('Pierna', 'box', legs, [side * 0.13, 0.42, 0], [0.2, 0.84, 0.22], undefined, e);
    kit.part('Cuerpo', 'box', top, [0, 1.15, 0], [0.55, 0.7, 0.32], undefined, e);
    for (const side of [-1, 1]) kit.part('Brazo', 'box', top, [side * 0.34, 1.15, 0], [0.15, 0.6, 0.17], undefined, e);
    kit.part('Cabeza', 'sphere', kit.mat('Piel', pick(SKIN), 0.35), [0, 1.72, 0], [0.42, 0.46, 0.42], undefined, e);
    kit.part('Pelo', 'sphere', kit.mat('Pelo', pick(HAIR), 0.3), [0, 1.84, -0.04], [0.44, 0.3, 0.44], undefined, e);
    if (extra === 'backpack') kit.part('Mochila', 'box', kit.mat('Mochila', pick(['#2f3b46', '#c96f3f', '#3f6b8a', '#4c7a4f']), 0.25), [0, 1.2, -0.24], [0.42, 0.5, 0.18], undefined, e);
    if (extra === 'cap') kit.part('Gorra', 'cylinder', kit.mat('Gorra', pick(['#f2efe6', '#e0b04a', '#3d5a80']), 0.25), [0, 1.98, 0.04], [0.42, 0.08, 0.46], undefined, e);
    return e;
  }

  if (p.style === 'group') {
    // The guide in the middle with an umbrella up so the group can find her; the group round her.
    const guide = person(0, 0, 180, '#f2c230', 'none');
    kit.part('Mango del paraguas', 'cylinder', kit.mat('Mango', '#2a2a2a', 0.4), [0.34, 2.15, 0.1], [0.04, 1.3, 0.04], undefined, guide);
    kit.part('Paraguas', 'cone', kit.mat('Paraguas', p.umbrella ?? '#e0b030', 0.35), [0.34, 2.9, 0.1], [0.95, 0.32, 0.95], undefined, guide);
    const n = p.count ?? 9;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 1.5 - Math.PI * 0.25 + random() * 0.3, r = Math.min(w, d) * (0.32 + random() * 0.14);
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      person(x, z, Math.atan2(-x, -z) * 180 / Math.PI + (random() - 0.5) * 30);
    }
    return;
  }
  // A queue: two loose files shuffling forward along +x.
  const n = p.count ?? Math.round(w / (0.85 * u));
  for (let i = 0; i < n; i++) {
    const x = -w / 2 + (i + 0.5) * (w / n) + (random() - 0.5) * 0.3 * u, z = (i % 2 ? 1 : -1) * d * 0.18 + (random() - 0.5) * 0.25 * u;
    person(x, z, 90 + (random() - 0.5) * 50);
  }
  if (p.guard) {
    const guard = person(w / 2 + 0.2 * u, 0, -90, '#1f2a44', 'none');
    kit.part('Gorra del vigilante', 'cylinder', kit.mat('Uniforme', '#1f2a44', 0.3), [0, 1.98, 0], [0.46, 0.12, 0.46], undefined, guard);
    kit.part('Chaleco', 'box', kit.mat('Chaleco', '#d6e04a', 0.3), [0, 1.2, 0], [0.58, 0.5, 0.35], undefined, guard);
  }
  if (p.sign) {
    // The entrance's sign on a post: a white letter on black, as on the visitors' gates.
    const c = document.createElement('canvas'); c.width = 128; c.height = 128;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#1d1f22'; ctx.fillRect(0, 0, 128, 128);
    ctx.fillStyle = '#ffffff'; ctx.font = '800 64px "Helvetica Neue", Arial, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(p.sign, 64, 68, 116);
    const face = kit.mat(`Rótulo ${p.sign}`, '#ffffff', 0.3); face.diffuseMap = kit.texture(c); face.update();
    const x = w / 2 + 0.6 * u, z = -d / 2;
    kit.part('Poste del rótulo', 'cylinder', kit.mat('Poste', '#3a3d40', 0.4), [x, 1.2, z], [0.08, 2.4, 0.08]);
    const quad = kit.mesh();
    quad.quad([x - 0.5, 1.9, z + 0.06], [x + 0.5, 1.9, z + 0.06], [x + 0.5, 2.9, z + 0.06], [x - 0.5, 2.9, z + 0.06], [0, 0, 1], [0, 1], [1, 1], [1, 0], [0, 0]);
    kit.add('Rótulo de la entrada', quad, face, { shadows: false });
    kit.part('Dorso del rótulo', 'box', kit.mat('Poste', '#3a3d40', 0.4), [x, 2.4, z], [1.02, 1.02, 0.1]);
  }
}
