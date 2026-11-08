import * as pc from 'playcanvas';
import type { Cell } from './movement';

/**
 * The street's lights at night (docs/chapter-2.md § Night and the way home). The lamps' heads glow
 * already (their LED material); here the few nearest the party light the pavement for real: a
 * small pool of lights handed from lamp to lamp as Gerard walks, so a frame never pays for more
 * than POOL of them however long the avenue is (docs/graphics.md, 120 Hz budget). A place can add
 * lights that never move (`fixed`): home's portal, the station's hall, a lit gym window.
 */
export interface NightLamp { cell: Cell; height: number }
export interface FixedLight { cell: Cell; height: number; colour: string; intensity: number; range: number }

/** Lamps lit for real at once, and how far each one's light reaches (metres). */
const POOL = 10;
const LAMP_RANGE = 8.5, LAMP_INTENSITY = 1.8, LAMP_COLOUR = new pc.Color(0.86, 0.9, 1);

export function createNightLights(app: pc.Application, toWorld: (x: number, z: number) => pc.Vec3, lamps: readonly NightLamp[], fixed: readonly FixedLight[]) {
  const root = new pc.Entity('Luces de la noche');
  app.root.addChild(root);
  const pool = Array.from({ length: Math.min(POOL, lamps.length) }, (_, i) => {
    const e = new pc.Entity(`Farola encendida ${i + 1}`);
    e.addComponent('light', { type: 'omni', color: LAMP_COLOUR, intensity: 0, range: LAMP_RANGE, castShadows: false });
    root.addChild(e);
    return e;
  });
  const steady = fixed.map((f, i) => {
    const e = new pc.Entity(`Luz fija ${i + 1}`);
    e.addComponent('light', { type: 'omni', color: new pc.Color().fromString(f.colour), intensity: 0, range: f.range, castShadows: false });
    const at = toWorld(f.cell.x, f.cell.z); e.setPosition(at.x, f.height, at.z);
    root.addChild(e);
    return { e, intensity: f.intensity };
  });
  const world = lamps.map(l => { const at = toWorld(l.cell.x, l.cell.z); return new pc.Vec3(at.x, l.height, at.z); });
  let lastKey = '';
  return {
    /** `focus`: where Gerard is (world); `k`: how far night has fallen (0–1). */
    update(focus: pc.Vec3, k: number) {
      for (const s of steady) s.e.light!.intensity = s.intensity * k;
      if (!pool.length) return;
      // The nearest lamps, in order; the pool only moves when that set changes.
      const nearest = world.map((p, i) => [i, (p.x - focus.x) ** 2 + (p.z - focus.z) ** 2] as const).sort((a, b) => a[1] - b[1]).slice(0, pool.length);
      const key = nearest.map(([i]) => i).sort((a, b) => a - b).join(',');
      if (key !== lastKey) { lastKey = key; nearest.forEach(([i], j) => pool[j].setPosition(world[i])); }
      for (const e of pool) e.light!.intensity = LAMP_INTENSITY * k;
    },
    destroy() { root.destroy(); },
  };
}
export type NightLights = ReturnType<typeof createNightLights>;
