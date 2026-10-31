import * as pc from 'playcanvas';
import type { GeoLandmark } from '../geo';
import type { LandmarkKit } from '../landmarks';

/**
 * The hills that close a valley town in, drawn round the back and left of the map (the sides the
 * camera looks towards): a steep ridge of pine and broadleaf wood rising straight from the far edge,
 * a higher ridge of meadows behind it with white farmhouses (baserriak) and clumps of trees, a pale
 * limestone peak beyond (Txindoki, at Aralar's west end, for Alegia: a licence, since it hides behind
 * the nearer hills from the street), and bands of low cloud caught on the slopes. The camera is
 * orthographic, so distance does not shrink anything: the ridges stand close behind each other and
 * each one higher, as they read in the overview. The footprint is the whole map (`solid: false`);
 * `peak` places the peak along the far edge (metres from the middle, default 110).
 */
export const kind = 'valley';

/** A smooth, uneven crest line: the same for the same seed. */
const crest = (a: number, seed: number) => 1 + 0.22 * Math.sin(a / 37 + seed) + 0.14 * Math.sin(a / 13.7 + seed * 2.3) + 0.07 * Math.sin(a / 5.9 + seed * 3.1);
/** How a slope rises from its foot (0) to its crest (1), steep below and rounded on top. */
const rise = (t: number) => Math.sin(Math.min(1, Math.max(0, t)) * Math.PI / 2) ** 1.3;

export function build(kit: LandmarkKit, landmark: GeoLandmark) {
  const halfW = landmark.w * kit.cell / 2, halfD = landmark.d * kit.cell / 2;
  // Painted from above: crowns of trees in a few greens over the dark of the wood, or meadow with hedges.
  const paint = (wood: boolean) => {
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = wood ? '#2f4a2b' : '#6b8a48'; ctx.fillRect(0, 0, 256, 256);
    const greens = wood ? ['#3a5a33', '#2a4226', '#46663a', '#506f3c', '#24391f'] : ['#7a9a52', '#62813f', '#86a35c', '#58743a'];
    for (let k = 0; k < (wood ? 520 : 140); k++) {
      const h = Math.sin(k * 78.233) * 43758.5453, f = h - Math.floor(h), g = Math.sin(k * 12.9898) * 43758.5453 % 1;
      const x = f * 256, y = Math.abs(g) * 256, r = wood ? 5 + (k % 5) * 1.6 : 10 + (k % 7) * 4;
      if (wood) { ctx.fillStyle = 'rgba(10,20,8,.35)'; ctx.beginPath(); ctx.arc(x + 2, y + 2, r, 0, Math.PI * 2); ctx.fill(); }
      ctx.fillStyle = greens[k % greens.length]; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    }
    if (!wood) {
      // Hedgerows and the odd tree along the field edges.
      ctx.fillStyle = '#3f5a30';
      for (let k = 0; k < 6; k++) { ctx.save(); ctx.translate(30 + k * 41, 0); ctx.rotate(0.12 * (k % 3 - 1)); for (let y = 0; y < 256; y += 9) { ctx.beginPath(); ctx.arc(0, y, 4, 0, Math.PI * 2); ctx.fill(); } ctx.restore(); }
    }
    return c;
  };
  const material = (name: string, canvas: HTMLCanvasElement) => {
    const m = kit.mat(name, '#ffffff', 0.04); m.diffuseMap = kit.texture(canvas); m.update(); return m;
  };
  const woodland = material('Monte arbolado', paint(true)), meadow = material('Prados', paint(false));
  /**
   * A slope behind one edge: along `a` (x for the far edge, z for the left one), `d` metres out from
   * the edge, rising from `base` at `d0` to its crest at `d1`; UVs in tens of metres.
   */
  const slope = (mesh: ReturnType<typeof kit.mesh>, side: 'far' | 'left', a0: number, a1: number, d0: number, d1: number, base: number, height: number, seed: number, tile: number) => {
    const at = (a: number, d: number): [number, number, number] => {
      const y = base + (height * crest(a, seed) - base) * rise((d - d0) / (d1 - d0));
      return side === 'far' ? [a, y, -halfD - d] : [-halfW - d, y, a];
    };
    const facing: [number, number, number] = side === 'far' ? [0, 1, 1] : [1, 1, 0];
    for (let a = a0; a < a1; a += 9) for (let d = d0; d < d1 + 12; d += 6) {
      const p = [at(a, d), at(a + 9, d), at(a + 9, d + 6), at(a, d + 6)];
      mesh.quad(p[0], p[1], p[2], p[3], facing, [a / tile, d / tile], [(a + 9) / tile, d / tile], [(a + 9) / tile, (d + 6) / tile], [a / tile, (d + 6) / tile]);
    }
    return at;
  };
  const near = kit.mesh(), high = kit.mesh(), left = kit.mesh();
  const nearAt = slope(near, 'far', -halfW - 60, halfW + 70, 0, 34, -0.5, 30, 1.7, 36);
  const meadowAt = slope(high, 'far', -halfW - 60, halfW + 70, 22, 64, 4, 46, 4.2, 70);
  const leftAt = slope(left, 'left', -halfD - 50, halfD * 0.45, 0, 30, -0.5, 26, 7.9, 36);
  kit.add('Monte cercano', near, woodland, { shadows: false });
  kit.add('Monte de prados', high, meadow, { shadows: false });
  kit.add('Monte de la izquierda', left, woodland, { shadows: false });
  // Farmhouses on the meadows: white walls, a wide roof of old tiles, a dark wooden gallery.
  const white = kit.mat('Caserío', '#ece7dc', 0.05), tiles = kit.surface('teila-zaharra', '#8a5444', 0.05), wood = kit.mat('Balconada del caserío', '#4a3426', 0.1);
  const roofs = kit.mesh();
  for (const [a, d, turn] of [[-120, 44, 8], [-35, 50, -12], [45, 40, 20], [150, 48, -5]]) {
    const [x, y, z] = meadowAt(a, d), w = 13, depth = 10, h = 6.5;
    const house = new pc.Entity('Caserío'); house.setLocalPosition(x, y - 1.5, z); house.setLocalEulerAngles(0, turn, 0); kit.root.addChild(house);
    kit.part('Muros del caserío', 'box', white, [0, h / 2, 0], [w, h, depth], undefined, house);
    kit.part('Balconada', 'box', wood, [0, h - 1.4, depth / 2 + 0.3], [w * 0.6, 1.2, 0.6], undefined, house);
    const ridge = h + 3.2, ox = w / 2 + 0.8, oz = depth / 2 + 0.8;
    // A gentle gable roof with its ridge running front to back, as the old Gipuzkoan farmhouses have.
    const corner = (sx: number, sz: number, y0: number): [number, number, number] => {
      const p = new pc.Vec3(sx, y0, sz); house.getLocalTransform().transformPoint(p, p); return [p.x, p.y, p.z];
    };
    for (const s of [-1, 1]) roofs.quad(corner(s * ox, oz, h - 0.2), corner(0, oz, ridge), corner(0, -oz, ridge), corner(s * ox, -oz, h - 0.2), [s, 2, 0], [0, 0], [ox, 0], [ox, oz * 2], [0, oz * 2]);
  }
  kit.add('Tejados de los caseríos', roofs, tiles, { shadows: false });
  // Clumps of trees between the fields.
  const clump = kit.mat('Arboleda', '#35512d', 0.05);
  for (let k = 0; k < 14; k++) {
    const a = -halfW - 40 + k * (2 * halfW + 100) / 14 + Math.sin(k * 5.1) * 9, d = 30 + (k % 4) * 8;
    const [x, y, z] = meadowAt(a, d);
    kit.part('Arboleda', 'sphere', clump, [x, y + 2, z], [11 + (k % 3) * 4, 7, 9]);
  }
  // The peak: a pale limestone pyramid over the far ridges, greener on its lower flanks.
  const peakX = Number(landmark.params.peak ?? 110), peak = kit.mesh(), foot = -halfD - 70, top: [number, number, number] = [peakX + 6, 88, foot - 26];
  const base: [number, number, number][] = [[peakX - 44, 22, foot + 6], [peakX + 46, 22, foot + 2], [peakX + 40, 22, foot - 58], [peakX - 38, 22, foot - 54]];
  for (let k = 0; k < 4; k++) {
    const a = base[k], b = base[(k + 1) % 4];
    peak.tri(a, b, top, [(a[0] + b[0]) / 2 - top[0], 0.6, (a[2] + b[2]) / 2 - top[2]], [a[0] / 30, 0], [b[0] / 30, 0], [top[0] / 30, 2]);
  }
  const limestone = document.createElement('canvas'); limestone.width = 64; limestone.height = 128;
  const lctx = limestone.getContext('2d')!;
  const lg = lctx.createLinearGradient(0, 0, 0, 128);
  lg.addColorStop(0, '#c9c6bd'); lg.addColorStop(0.55, '#aeb0a4'); lg.addColorStop(1, '#6f8458');
  lctx.fillStyle = lg; lctx.fillRect(0, 0, 64, 128);
  for (let k = 0; k < 40; k++) { lctx.fillStyle = 'rgba(80,80,74,.25)'; lctx.fillRect((k * 37) % 64, (k * 23) % 90, 2, 10 + (k % 4) * 6); }
  const rock = kit.mat('Caliza de la cumbre', '#ffffff', 0.05);
  rock.diffuseMap = kit.texture(limestone); rock.update();
  kit.add('Txindoki', peak, rock, { shadows: false });
  // Low cloud caught on the slopes: soft white bands lying on the hillside a little above the trees,
  // fading out at both edges and along their length, so they never cut into the ground.
  const cloud = document.createElement('canvas'); cloud.width = 256; cloud.height = 64;
  const cctx = cloud.getContext('2d')!;
  for (let k = 0; k < 16; k++) {
    const x = 20 + k * 14.5, y = 32 + Math.sin(k * 1.7) * 5, r = 13 + (k % 5) * 3;
    const g = cctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(232,237,238,.16)'); g.addColorStop(1, 'rgba(232,237,238,0)');
    cctx.fillStyle = g; cctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  const mist = kit.mat('Bruma en el monte', '#ffffff', 0, 0.1);
  mist.diffuseMap = kit.texture(cloud); mist.opacityMap = mist.diffuseMap; mist.opacityMapChannel = 'a';
  mist.blendType = pc.BLEND_NORMAL; mist.depthWrite = false; mist.update();
  const bands = kit.mesh();
  /** A band along `a0`–`a1` between depths `d0` and `d1` on a slope, `lift` metres over it. */
  const drape = (at: (a: number, d: number) => [number, number, number], a0: number, a1: number, d0: number, d1: number, lift: number) => {
    const up = (p: [number, number, number]): [number, number, number] => [p[0], p[1] + lift, p[2]];
    for (let a = a0; a < a1; a += 6) for (let j = 0; j < 4; j++) {
      const da = d0 + (d1 - d0) * j / 4, db = d0 + (d1 - d0) * (j + 1) / 4, u0 = (a - a0) / (a1 - a0), u1 = (a + 6 - a0) / (a1 - a0);
      bands.quad(up(at(a, da)), up(at(a + 6, da)), up(at(a + 6, db)), up(at(a, db)), [0, 1, 0], [u0, j / 4], [u1, j / 4], [u1, (j + 1) / 4], [u0, (j + 1) / 4]);
    }
  };
  drape(nearAt, -halfW - 30, -20, 10, 24, 3.5);
  drape(nearAt, 30, halfW + 40, 14, 28, 3.5);
  drape(meadowAt, -80, 90, 30, 46, 3);
  drape(leftAt, -halfD - 40, -halfD * 0.2, 8, 20, 3.5);
  kit.add('Bruma', bands, mist, { shadows: false });
}
