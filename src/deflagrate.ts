/**
 * A deflagration through clouds that can catch (docs/graphics.md § Ignition): a point of fire crosses each cloud, cloud after
 * cloud, and what it reaches catches and lights the rest on the GPU (a kind's `ignite`, src/fight-particles.ts). Electrólisis's
 * gas going up (src/duo-fx/electrolisis.ts) and Fin de fiesta's powder going up (src/powder-fx.ts) are the same front, each
 * with its own clouds, kinds and what lands where the front reaches.
 */
type V3 = { x: number; y: number; z: number };
/** A cloud the front runs through: its middle and its size. */
export interface DeflagrationCloud { at: V3; radius: number }
export interface DeflagrationOptions {
  /** Seconds before the first cloud is lit. */
  start?: number;
  /** Seconds from one cloud being lit to the next. */
  gap: number;
  /** How long the point of fire takes to cross a cloud, and in how many steps. */
  sweep?: number; steps?: number;
  /** The way the front crosses the first cloud (the others are crossed from the one before). */
  across: V3;
  /** How far round each cloud the last catch reaches, as a share of its radius plus a margin (no bead outlives its cloud). */
  reach?: number;
}

/**
 * Lights `clouds` in order (`ignite` on the GPU, `after` to schedule it), and calls `lit(cloud, i, at)` as the front reaches
 * each, `at` seconds from now, for what that cloud does there (its crack, its fireball, its ring). Returns when the last
 * cloud has finished burning, in seconds from now.
 */
export function deflagrate(gpu: { ignite(at: V3, radius: number): void }, after: (seconds: number, run: () => void) => void,
  clouds: readonly DeflagrationCloud[], options: DeflagrationOptions, lit?: (cloud: DeflagrationCloud, i: number, at: number) => void) {
  const { start = 0, gap, sweep = .26, steps = 16, across, reach = 2.4 } = options;
  clouds.forEach((c, i) => {
    const from = i ? clouds[i - 1].at : c.at, way = { x: c.at.x - from.x, z: c.at.z - from.z }, d = Math.hypot(way.x, way.z);
    const dir = i && d > 1e-6 ? { x: way.x / d, y: 0, z: way.z / d } : across;
    const begin = start + i * gap;
    // A point of fire that crosses the cloud: what it reaches catches, and what catches lights the rest.
    for (let s = 0; s <= steps; s++) {
      const k = -1.2 + 2.4 * s / steps;
      after(begin + sweep * s / steps, () => gpu.ignite({ x: c.at.x + dir.x * c.radius * k, y: c.at.y + dir.y * c.radius * k, z: c.at.z + dir.z * c.radius * k }, c.radius * .9));
    }
    // And whatever the front left behind, all at once as it ends.
    for (const late of [.05, .25, .5]) after(begin + sweep + late, () => gpu.ignite(c.at, c.radius * reach + .3));
    lit?.(c, i, begin);
  });
  return start + Math.max(0, clouds.length - 1) * gap + sweep + .5;
}
