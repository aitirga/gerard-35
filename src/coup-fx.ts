/**
 * Un golpe de dados' look, «el collage» (docs/animas/dadaista/README.md § Definitiva, Aitor 2026-11-25), in fight seconds
 * from the start of the action. The battle scene plays it (`coupStep`, `coupBurst` in src/battle-scene.ts) and the post
 * pass draws the paper (src/post.ts `collage`):
 *
 * 1. **0–`rise`.** The astral's night comes down and the dice of the hand rise.
 * 2. **`tear`.** The picture tears into five to seven strips of ivory paper, a sky of stars behind them and a red rule
 *    across; each strip carries a line of Mallarmé's poem in Spanish along its top margin.
 * 3. **`ink`.** A constellation of red ink joins the foes, star to star.
 * 4. **`fall` to `contact`.** One great die of light, a glass lattice of the `box` shape, comes down on each foe, turning.
 * 5. **`contact`.** The fight stops `stop` seconds; each die bursts into the Comodín's vermilion star and its light pools
 *    on the floor.
 * 6. **`glue`.** Six dice of glass go back to the hand, and the strips are stuck back, a little crooked, then gone.
 *
 * Reduced motion keeps the dice and the numbers and drops the strips. Ivory, astral white and the Comodín's vermilion and
 * black: never pink, never violet (docs/visual-style.md).
 */
export const COUP_LOOK = {
  rise: .4, tear: [.4, 1] as const, ink: [1, 1.5] as const, fall: 1.5, contact: 2.3, glue: [2.3, 3] as const, end: 3.2,
  /** The hit-stop at the contact (s), and how high the dice start over their foe (m). */
  stop: .25, height: 7,
  /** How torn the strips stay as they are stuck back (0–1): a touch crooked. */
  askew: .12,
} as const;

const ease = (x: number) => { const k = Math.min(1, Math.max(0, x)); return k * k * (3 - 2 * k); };

/** The collage at `t`: how far the picture is torn apart (0–1) and how much of it shows (0–1). */
export function collageAt(t: number) {
  const L = COUP_LOOK, [from, to] = L.tear, [glued, gone] = L.glue;
  const opening = ease((t - from) / (to - from)), closing = ease((t - glued) / ((gone - glued) * .6));
  const torn = t < glued ? opening : 1 - (1 - L.askew) * closing;
  const shown = t < from ? 0 : t < glued ? ease((t - from) / .1) : 1 - ease((t - glued - (gone - glued) * .6) / ((gone - glued) * .4));
  return { torn, shown: Math.max(0, shown) };
}

/** Where a die of light is on its way down, as a share of the fall (0 up high, 1 on the foe): faster all the way. */
export const coupFall = (t: number) => Math.min(1, Math.max(0, (t - COUP_LOOK.fall) / (COUP_LOOK.contact - COUP_LOOK.fall))) ** 2;
