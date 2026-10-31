import * as pc from 'playcanvas';
import type { GeoLandmark } from '../geo';
import type { LandmarkKit } from '../landmarks';

/**
 * A Rodalies platform, as on Cardedeu's platform 1 (Pere López Brosa's photo on Wikimedia
 * Commons): grey pavers, a pale coping along the track with the yellow safety line and a white
 * tactile strip, cone-topped lamps, benches and bins, the station's name board and a grey fence
 * along the back. The platform is drawn between two lines given in the landmark's own metres
 * (`edge` along the track and `back`, as many points each); `lamps_m` spaces the lamps,
 * `benches` and `boards` are distances along the edge, `fence` the [from, to] stretches of the
 * back that have one, and `name` is what the board says.
 */
export const kind = 'andana';

type P2 = [number, number];

export function build(kit: LandmarkKit, landmark: GeoLandmark) {
  const p = landmark.params;
  const edge = (p.edge as P2[]) ?? [], back = (p.back as P2[]) ?? [];
  if (edge.length < 2 || edge.length !== back.length) return;
  // Heights stay over the ballast (the rails' ribbon lies 6 cm up) and under anyone's feet.
  const slab = kit.mesh(), coping = kit.mesh(), line = kit.mesh(), tactile = kit.mesh();
  // Points at a distance in from the edge, towards the back, at each corner.
  const inset = (i: number, d: number): P2 => {
    const [ex, ez] = edge[i], [bx, bz] = back[i], len = Math.hypot(bx - ex, bz - ez) || 1;
    return [ex + (bx - ex) / len * d, ez + (bz - ez) / len * d];
  };
  const band = (b: ReturnType<LandmarkKit['mesh']>, from: number, to: number, y: number) => {
    for (let i = 0; i + 1 < edge.length; i++) {
      const a = inset(i, from), c = inset(i + 1, from), d = inset(i + 1, to), e = inset(i, to);
      b.quad([a[0], y, a[1]], [c[0], y, c[1]], [d[0], y, d[1]], [e[0], y, e[1]], [0, 1, 0], a, c, d, e);
    }
  };
  for (let i = 0; i + 1 < edge.length; i++) {
    const a = back[i], c = back[i + 1], d = inset(i + 1, 0.5), e = inset(i, 0.5);
    slab.quad([a[0], 0.065, a[1]], [c[0], 0.065, c[1]], [d[0], 0.065, d[1]], [e[0], 0.065, e[1]], [0, 1, 0], a, c, d, e);
  }
  band(coping, 0, 0.5, 0.07);
  band(line, 0.62, 0.74, 0.073);
  band(tactile, 0.8, 1.2, 0.073);
  kit.add('Andén', slab, kit.surface('granit', String(p.paving ?? '#a5a39d')), { shadows: false });
  kit.add('Borde del andén', coping, kit.mat('Bordillo del andén', '#d2cfc6', 0.1), { shadows: false });
  kit.add('Línea amarilla', line, kit.mat('Línea amarilla', '#e9c13a', 0.2, 0.05), { shadows: false });
  kit.add('Franja táctil', tactile, kit.mat('Franja táctil', '#dcd8cc', 0.1), { shadows: false });

  // Along the edge: where a distance falls, and which way the track runs there.
  const lengths = edge.slice(1).map((q, i) => Math.hypot(q[0] - edge[i][0], q[1] - edge[i][1]));
  const total = lengths.reduce((a, b) => a + b, 0);
  const along = (t: number, inward: number) => {
    let i = 0;
    while (i < lengths.length - 1 && t > lengths[i]) { t -= lengths[i]; i++; }
    const f = Math.min(1, t / (lengths[i] || 1)), a = inset(i, inward), b = inset(i + 1, inward);
    return { x: a[0] + (b[0] - a[0]) * f, z: a[1] + (b[1] - a[1]) * f, yaw: -Math.atan2(edge[i + 1][1] - edge[i][1], edge[i + 1][0] - edge[i][0]) * 180 / Math.PI };
  };
  const grey = kit.mat('Gris del andén', '#5d6266', 0.45), glow = kit.mat('Luz del andén', '#ffd27a', 0.2, 2.2);
  for (let t = 6; t < total - 2; t += Number(p.lamps_m ?? 16)) {
    // A slim grey post under a lit globe and its cone.
    const { x, z } = along(t, 3.4);
    kit.part('Farola del andén', 'cylinder', grey, [x, 2.2, z], [0.1, 4.4, 0.1]);
    kit.part('Globo', 'sphere', glow, [x, 4.55, z], [0.42, 0.36, 0.42]);
    kit.part('Sombrerete', 'cone', grey, [x, 4.88, z], [0.55, 0.3, 0.55]);
  }
  const wood = kit.mat('Listones de banco', '#9b5a34', 0.25), frame = kit.mat('Estructura gris', '#8d9295', 0.55);
  for (const t of (p.benches as number[] | undefined) ?? []) {
    const { x, z, yaw } = along(t, 4.4);
    const bench = holder(kit, 'Banco del andén', x, z, yaw);
    for (let i = 0; i < 3; i++) kit.part('Listón', 'box', wood, [0, 0.42, 0.12 - i * 0.12], [1.6, 0.04, 0.1], undefined, bench);
    kit.part('Respaldo', 'box', wood, [0, 0.66, -0.2], [1.6, 0.3, 0.04], [-10, 0, 0], bench);
    for (const dx of [-0.7, 0.7]) kit.part('Pata', 'box', frame, [dx, 0.21, 0], [0.05, 0.42, 0.42], undefined, bench);
    kit.part('Papelera', 'cylinder', grey, [1.25, 0.45, 0], [0.4, 0.9, 0.4], undefined, bench);
  }
  const name = String(p.name ?? '');
  if (name) {
    const sign = kit.mat(`Rótulo ${name}`, '#ffffff', 0.3, 0.3);
    sign.diffuseMap = kit.texture(board(name)); sign.emissiveMap = sign.diffuseMap; sign.emissive.set(1, 1, 1); sign.update();
    for (const t of (p.boards as number[] | undefined) ?? []) {
      // The name on a dark board on two posts, read from the track (and the camera).
      const { x, z, yaw } = along(t, 2.6);
      const post = holder(kit, 'Rótulo del andén', x, z, yaw);
      for (const dx of [-1.1, 1.1]) kit.part('Poste', 'box', grey, [dx, 1.3, 0], [0.08, 2.6, 0.08], undefined, post);
      const quad = kit.mesh();
      quad.quad([-1.3, 2.05, 0.06], [1.3, 2.05, 0.06], [1.3, 2.65, 0.06], [-1.3, 2.65, 0.06], [0, 0, 1], [0, 1], [1, 1], [1, 0], [0, 0]);
      kit.part('Marco del rótulo', 'box', grey, [0, 2.35, 0], [2.7, 0.7, 0.1], undefined, post);
      kit.add('Rótulo', quad, sign, { parent: post, shadows: false });
    }
  }
  // The fence along the back: posts and rails, with the bars painted on a see-through panel.
  const bars = kit.mat('Valla del andén', '#ffffff', 0.4);
  bars.diffuseMap = kit.texture(fence()); bars.opacityMap = bars.diffuseMap; bars.opacityMapChannel = 'a'; bars.alphaTest = 0.5; bars.update();
  const panels = kit.mesh(), backLengths = back.slice(1).map((q, i) => Math.hypot(q[0] - back[i][0], q[1] - back[i][1]));
  for (const [from, to] of (p.fence as P2[] | undefined) ?? []) {
    let s = 0;
    back.slice(1).forEach((q, i) => {
      const a = back[i], len = backLengths[i], s0 = Math.max(from, s), s1 = Math.min(to, s + len);
      if (s1 > s0) {
        const f0 = (s0 - s) / len, f1 = (s1 - s) / len;
        const a0: P2 = [a[0] + (q[0] - a[0]) * f0, a[1] + (q[1] - a[1]) * f0], a1: P2 = [a[0] + (q[0] - a[0]) * f1, a[1] + (q[1] - a[1]) * f1];
        panels.quad([a0[0], 0, a0[1]], [a1[0], 0, a1[1]], [a1[0], 1.2, a1[1]], [a0[0], 1.2, a0[1]], [0, 0, 1], [s0 / 1.2, 1], [s1 / 1.2, 1], [s1 / 1.2, 0], [s0 / 1.2, 0]);
      }
      s += len;
    });
  }
  kit.add('Valla', panels, bars);
}

/** An entity at a point of the platform, turned with the track, for furniture built in its own frame. */
function holder(kit: LandmarkKit, name: string, x: number, z: number, yaw: number): pc.Entity {
  const e = new pc.Entity(name);
  e.setLocalPosition(x, 0, z); e.setLocalEulerAngles(0, yaw, 0); kit.root.addChild(e);
  return e;
}

/** White letters on Adif's dark blue-grey, with Rodalies' orange badge. */
function board(name: string) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 60;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#26323d'; ctx.fillRect(0, 0, 256, 60);
  ctx.fillStyle = '#e57d1e'; ctx.beginPath(); ctx.roundRect(10, 12, 36, 36, 6); ctx.fill();
  ctx.fillStyle = '#ffffff'; ctx.font = '900 28px Arial, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('R', 28, 31);
  ctx.font = '700 30px "Helvetica Neue", Arial, sans-serif'; ctx.textAlign = 'left'; ctx.fillText(name, 58, 32);
  return c;
}

/** One 1.2 m stretch of grey fence: two rails and twelve bars, transparent between them. */
function fence() {
  const c = document.createElement('canvas'); c.width = 64; c.height = 64;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#7d8388';
  ctx.fillRect(0, 4, 64, 4); ctx.fillRect(0, 52, 64, 4); ctx.fillRect(0, 0, 4, 64);
  for (let x = 6; x < 64; x += 5.3) ctx.fillRect(x, 6, 1.6, 50);
  return c;
}
