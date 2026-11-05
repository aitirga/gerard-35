import type { Effects } from './effects.ts';
import type { GpuEmitter } from './fight-particles.ts';
import { STAT_MOTES, type StatWay } from './stat-fx.ts';

/** Where a fighter stands this frame for their motes: their slot in the fight particles, their feet, how tall they are and whether they show. */
export interface MoteAnchor { index: number; feet: { x: number; y: number; z: number }; height: number; visible: boolean }

/**
 * The motes of a stat that stays up or down (src/stat-fx.ts `STAT_MOTES`, docs/graphics.md § Stats
 * going up or down): a stream of tiny bright particles off the fighter's head on the GPU, blue rising
 * or red falling, one for each way their stats are shifted. Born on their own parts, so they follow
 * them; stopped while they are down, gone or the fight is still coming in.
 */
export function createStatMotes(effects: Effects) {
  interface Stream { id: string; way: StatWay; start: number; emitter?: GpuEmitter }
  const streams = new Map<string, Stream>();
  let time = 0;
  const gpu = () => effects.gpu?.active ? effects.gpu : undefined;
  function drop(stream: Stream) { stream.emitter?.remove(); streams.delete(`${stream.id}:${stream.way}`); }
  return {
    /** The ways `id`'s stats are shifted now: a stream starts for each new one and stops for each one gone (what it gave off finishes its way). */
    want(id: string, ways: readonly StatWay[]) {
      for (const way of ['up', 'down'] as const) {
        const stream = streams.get(`${id}:${way}`);
        if (ways.includes(way)) { if (!stream) streams.set(`${id}:${way}`, { id, way, start: time }); }
        else if (stream) drop(stream);
      }
    },
    /** Which ways `id` gives off, for scenarios and tests. */
    shown(id: string) { return (['up', 'down'] as const).filter(way => streams.has(`${id}:${way}`)); },
    /** Moves every stream to its fighter (`anchor`); with no animation they give nothing off. */
    update(dt: number, anchor: (id: string) => MoteAnchor | undefined, animate = true) {
      time += dt;
      const g = gpu();
      for (const stream of streams.values()) {
        const at = anchor(stream.id), look = STAT_MOTES[stream.way];
        if (!g || !animate || !at?.visible || time - stream.start < STAT_MOTES.delay) { if (stream.emitter) stream.emitter.rate = 0; continue; }
        // From their head; where they have no parts to be born on, from the top of it.
        const spawn = { at: { x: at.feet.x, y: at.feet.y + at.height * .95, z: at.feet.z }, shape: 'surface' as const, fighter: at.index, above: look.above };
        stream.emitter ??= g.emitter(look.kind, { ...spawn, rate: 0, outward: look.outward, up: look.up, speed: look.speed, life: look.life });
        Object.assign(stream.emitter, spawn);
        stream.emitter.rate = look.rate;
      }
    },
    clear() { [...streams.values()].forEach(drop); },
  };
}
export type StatMotes = ReturnType<typeof createStatMotes>;
