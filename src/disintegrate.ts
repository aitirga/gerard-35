import * as pc from 'playcanvas';
import type { FightParticles, GpuField, GpuKind } from './fight-particles.ts';

/**
 * Coming apart (docs/graphics.md, "Disintegration"): a beaten foe crumbles all at once, a little
 * sooner at its feet, into specks of violet and purple light, tiny and see-through, born on its own
 * parts. They hang where it stood for a moment, then drift up a little, each with a short trail, and
 * fade. Under half a second, in a fight (each foe as it falls) and on the street (a fear beaten on the
 * tower's ramp, where it stood). Violet is fear's and possession's colour: what held it leaving.
 *
 * The crumbling is a shader on the foe's materials (`dissolvable`): fine grain over a front that
 * sweeps its height; a fragment the front passes is discarded in every pass, its shadow too, and the
 * ones next to a hole glow faintly. The specks come from the GPU engine (src/fight-particles.ts):
 * bursts on the foe's `surface`, within the `band` of its height the front is crossing.
 */

export const DISINTEGRATE = {
  /** Seconds it takes to crumble (with reduced motion too, throwing nothing). */
  seconds: .42,
  /**
   * How ragged the front is, a share of its height (at 1 it crumbles everywhere at once, a little
   * sooner at the feet); its grain over its whole height and per metre; how wide the glow at a hole.
   */
  ragged: 1, grain: 5, fine: 16, edge: .05,
  /** How far a foe rises as it goes (m), and how long it shudders first when struck down in a fight. */
  lift: .05, shudder: .12,
  /** Specks a metre of its height, between these; each one a chain of `links`, its trail. */
  specks: 1400, fewest: 450, most: 2200, links: 4,
  /** What they are born doing (m/s): off its surface, up, any way. Seconds they last. */
  outward: .06, up: .08, speed: .06, life: [1.1, 1.8] as const,
  /** The violet and the purple it leaves in (sRGB): half its specks each; the glow takes the first. */
  colours: ['#a274ff', '#6c2cc4'] as const,
  /**
   * Into a portal (`into`): how long it takes instead, how fast its specks are thrown at the portal's
   * middle (× the distance, /s), the pull and swirl that draw them in (m/s²), its reach (m), and how long they last.
   */
  portal: { seconds: 1.1, throw: .9, pull: 9, swirl: 7, radius: 9, life: [.9, 1.5] as const },
};

/** How long a speck lasts as a body comes together: it is gone almost as it lands. */
const APPEAR_LIFE = [.35, .7] as const;

/** Its own kind of fight particle (defined on the engine when created). */
export const DISINTEGRATE_KINDS = {
  // A speck: a tiny see-through bead of its colour (no white-hot core) whose chain trails a short tail
  // behind it. Thick drag and a little buoyancy: it hangs where it was born, then drifts up, darkening
  // as it fades. Fields from other effects in the fight do not move it.
  speck: {
    drag: 3.2, gravity: -.5, curl: .16, response: 0, follow: 6, size: [.0075, .003], sizeJitter: .5, shape: 'strand',
    colours: ['#ffffff', '#ffffff', '#8a78a8'], intensity: [1.25, .95, .8], middle: .3, core: 0,
    fadeIn: .04, fadeOut: .6, opacity: .7, additive: .15, flicker: .15,
  },
  // The same speck, drawn into a portal: the portal's field carries it (response), little drag, no lift.
  'portal-speck': {
    drag: .8, gravity: 0, curl: .1, response: 1, follow: 8, size: [.022, .006], sizeJitter: .5, shape: 'strand',
    colours: ['#ffffff', '#ffffff', '#8a78a8'], intensity: [2.2, 1.5, .9], middle: .3, core: .3,
    fadeIn: .03, fadeOut: .35, opacity: 1, additive: .55, flicker: .15,
  },
} satisfies Record<string, GpuKind>;

// ── The crumbling, on the foe's own materials (WGSL chunks of the lit shader) ────────────────────────
// `dissolveSpan`: its lowest and highest point (world y) and where it stands (x, z), so the grain
// rides with it. `dissolveEdge`: the glow's colour, linear.
const f = (n: number) => n.toFixed(3);
const DECLARATION = /* wgsl */ `
uniform dissolveAmount: f32;
uniform dissolveSpan: vec4f;
uniform dissolveEdge: vec3f;
var<private> dissolveGlow: f32 = 0.0;
fn dissolveHash(p: vec3f) -> f32 { return fract(sin(dot(p, vec3f(127.1, 311.7, 74.7))) * 43758.5453); }
fn dissolveNoise(p: vec3f) -> f32 {
  let i = floor(p); let w = fract(p); let u = w * w * (3.0 - 2.0 * w);
  let a = mix(mix(dissolveHash(i), dissolveHash(i + vec3f(1.0, 0.0, 0.0)), u.x), mix(dissolveHash(i + vec3f(0.0, 1.0, 0.0)), dissolveHash(i + vec3f(1.0, 1.0, 0.0)), u.x), u.y);
  let b = mix(mix(dissolveHash(i + vec3f(0.0, 0.0, 1.0)), dissolveHash(i + vec3f(1.0, 0.0, 1.0)), u.x), mix(dissolveHash(i + vec3f(0.0, 1.0, 1.0)), dissolveHash(i + vec3f(1.0, 1.0, 1.0)), u.x), u.y);
  return mix(a, b, u.z);
}
`;
// In every pass (the shadow and the depth prepass too), so what is gone casts nothing.
const MAIN = /* wgsl */ `
if (uniform.dissolveAmount > 0.0) {
  let dissolveHeight = max(uniform.dissolveSpan.y - uniform.dissolveSpan.x, 0.001);
  let dissolveOffset = vPositionW - vec3f(uniform.dissolveSpan.z, uniform.dissolveSpan.x, uniform.dissolveSpan.w);
  let dissolveAt = dissolveOffset / dissolveHeight;
  // Coarse over its whole height, fine per metre: it crumbles into grains, however big it is.
  let dissolveRag = dissolveNoise(dissolveAt * ${f(DISINTEGRATE.grain)}) * 0.45 + dissolveNoise(dissolveOffset * ${f(DISINTEGRATE.fine)} + 7.3) * 0.55;
  let dissolveFront = mix(-${f(DISINTEGRATE.ragged / 2)}, ${f(1 + DISINTEGRATE.ragged / 2)}, uniform.dissolveAmount);
  let dissolveLeft = dissolveAt.y + (dissolveRag - 0.5) * ${f(DISINTEGRATE.ragged)} - dissolveFront;
  if (dissolveLeft < 0.0) { discard; }
  // The glow at the edge of each hole.
  dissolveGlow = 1.0 - smoothstep(0.0, ${f(DISINTEGRATE.edge)}, dissolveLeft);
}
`;
const END = /* wgsl */ `
#ifdef FORWARD_PASS
output.color = vec4f(output.color.rgb + uniform.dissolveEdge * dissolveGlow, output.color.a);
#endif
`;

/** Gives a material the crumbling (idempotent); it shows nothing until a disintegration drives it. */
export function dissolvable<M extends pc.StandardMaterial>(m: M) {
  const wgsl = m.getShaderChunks(pc.SHADERLANGUAGE_WGSL);
  if (wgsl.get('litUserMainStartPS') === MAIN) return m;
  wgsl.set('litUserDeclarationPS', DECLARATION); wgsl.set('litUserMainStartPS', MAIN); wgsl.set('litUserMainEndPS', END);
  // Every pass binds the declared uniforms, so they get a value up front.
  m.setParameter('dissolveAmount', 0); m.setParameter('dissolveSpan', [0, 1, 0, 0]); m.setParameter('dissolveEdge', [0, 0, 0]);
  m.update();
  return m;
}

export interface Disintegration {
  /** How far it has crumbled (0–1). */
  readonly progress: number;
  /** All gone: the model is disabled and its own materials are back. */
  readonly finished: boolean;
}
export interface DisintegrateOptions {
  /** One colour it leaves in instead of violet and purple (sRGB hex). */
  colour?: string;
  /** Seconds it stands whole first, to be seen. */
  delay?: number;
  /** Its materials are its own (a fighter's copies, made `dissolvable` when it was built): nothing to copy. */
  own?: boolean;
  /** Once it is all gone (the model is already disabled). */
  done?: () => void;
  /**
   * Into a portal: its specks are thrown at this point and a field there pulls and swirls them in
   * round `axis` (towards the camera, so they spiral in the portal's face); it takes longer.
   */
  into?: { x: number; y: number; z: number }; axis?: { x: number; y: number; z: number };
  /** Seconds it takes, if not the usual (a big body coming apart slowly, to be watched). */
  seconds?: number;
  /**
   * The other way round: it comes together out of specks, from the top down, and stays (out of a
   * portal on the other side). Hidden until it starts.
   */
  appear?: boolean;
}

const linear = (hex: string) => { const c = new pc.Color().fromString(hex); return [c.r ** 2.2, c.g ** 2.2, c.b ** 2.2]; };

/** Disintegrations under way; `gpu` (when the device runs fight particles) gets the kind it throws. */
export function createDisintegrations(gpu: FightParticles | undefined) {
  if (gpu) for (const [name, kind] of Object.entries(DISINTEGRATE_KINDS)) gpu.define(name, kind);
  interface Run extends Disintegration {
    model: pc.Entity; materials: pc.StandardMaterial[]; borrowed: [pc.MeshInstance, pc.Material][];
    age: number; delay: number; still: boolean; low: number; high: number;
    colours: readonly string[]; span: Float32Array;
    specks: number; thrown: number; seconds: number;
    into?: pc.Vec3; field?: GpuField;
    progress: number; finished: boolean; done?: () => void; appear: boolean;
  }
  const runs: Run[] = [];
  /** Seconds the last specks thrown still drift: the engine keeps running till then. */
  let rising = 0;
  /** Portals' fields still pulling specks in after their run finished, and for how long. */
  const lingering: { field: GpuField; left: number }[] = [];

  /** Gone: disabled, its own materials back (borrowed copies destroyed), and told. */
  function finish(r: Run) {
    r.finished = true; r.progress = 1;
    if (r.field) { lingering.push({ field: r.field, left: DISINTEGRATE.portal.life[1] + .2 }); r.field = undefined; }
    if (r.model.parent && !r.appear) r.model.enabled = false;
    if (r.appear) r.materials.forEach(m => m.setParameter('dissolveAmount', 0));
    for (const [mesh, own] of r.borrowed) mesh.material = own;
    if (r.borrowed.length) r.materials.forEach(m => m.destroy());
    r.done?.();
  }
  function bounds(model: pc.Entity) {
    let low = Infinity, high = -Infinity;
    for (const r of model.findComponents('render') as pc.RenderComponent[]) {
      if (!r.enabled) continue;
      for (const m of r.meshInstances) if (m.visible) { low = Math.min(low, m.aabb.getMin().y); high = Math.max(high, m.aabb.getMax().y); }
    }
    const y = model.getPosition().y;
    return low < high ? { low: low - y, high: high - y } : { low: 0, high: 1 };
  }

  return {
    /** `model` crumbles into specks and is disabled; `animate` false (reduced motion) throws nothing. */
    start(model: pc.Entity, o: DisintegrateOptions = {}, animate = true): Disintegration {
      const already = runs.find(r => r.model === model);
      if (already) return already;
      const materials: pc.StandardMaterial[] = [], borrowed: [pc.MeshInstance, pc.Material][] = [];
      const copies = new Map<pc.Material, pc.StandardMaterial>();
      for (const r of model.findComponents('render') as pc.RenderComponent[]) for (const mesh of r.meshInstances) {
        const m = mesh.material;
        if (!(m instanceof pc.StandardMaterial)) continue;
        if (o.own) { if (!materials.includes(m)) materials.push(dissolvable(m)); continue; }
        // Shared with every other copy of its model: it comes apart in copies of its own.
        let copy = copies.get(m);
        if (!copy) { copy = dissolvable(m.clone()); copies.set(m, copy); materials.push(copy); }
        borrowed.push([mesh, m]); mesh.material = copy;
      }
      const { low, high } = bounds(model), metres = Math.max(.3, high - low);
      const colours = o.colour ? [o.colour] : DISINTEGRATE.colours, edge = new Float32Array(linear(colours[0]).map(c => c * 1.4));
      const run: Run = {
        model, materials, borrowed, age: 0, delay: o.delay ?? 0, still: !animate, low, high,
        colours, span: new Float32Array(4),
        specks: Math.round(Math.min(DISINTEGRATE.most, Math.max(DISINTEGRATE.fewest, DISINTEGRATE.specks * metres)) * (o.into ? 1.6 : 1)), thrown: 0,
        seconds: o.seconds ?? (o.into ? DISINTEGRATE.portal.seconds : DISINTEGRATE.seconds),
        progress: 0, finished: false, done: o.done, appear: !!o.appear,
      };
      if (o.into) {
        run.into = new pc.Vec3(o.into.x, o.into.y, o.into.z);
        const { pull, swirl, radius } = DISINTEGRATE.portal;
        run.field = gpu?.field({ at: run.into, axis: o.axis, radius, pull, swirl });
      }
      materials.forEach(m => m.setParameter('dissolveEdge', edge));
      runs.push(run);
      return run;
    },
    /** Models coming apart now, which particles are born on (src/fight-particles.ts `setFighters`). */
    get models() { return runs.map(r => r.model); },
    /** Whether anything is coming apart or its specks still drift: the particle engine must run. */
    get busy() { return runs.length > 0 || rising > 0; },
    /**
     * Steps every one `dt`; `throwing` when the engine runs, with `fighters` the models it knows in
     * order (every model coming apart among them).
     */
    update(dt: number, throwing: boolean, fighters: readonly pc.Entity[]) {
      rising = Math.max(0, rising - dt);
      for (let i = lingering.length - 1; i >= 0; i--) if ((lingering[i].left -= dt) <= 0) { lingering[i].field.remove(); lingering.splice(i, 1); }
      for (let i = runs.length - 1; i >= 0; i--) {
        const r = runs[i];
        // Its model gone (the fight over, the scene changed): only the copies it borrowed are left to free.
        if (!r.model.parent) { if (r.borrowed.length) r.materials.forEach(m => m.destroy()); r.field?.remove(); r.finished = true; runs.splice(i, 1); continue; }
        r.age += dt;
        const t = Math.min(1, Math.max(0, (r.age - r.delay) / r.seconds));
        r.progress = t;
        const p = r.model.getPosition(), bottom = p.y + r.low, top = p.y + r.high, metres = top - bottom;
        r.span.set([bottom, top, p.x, p.z]);
        // Coming together, it is all gone at first and the front goes back down it.
        const amount = r.appear ? 1 - t : t;
        for (const m of r.materials) { m.setParameter('dissolveAmount', amount > 0 ? Math.max(amount, 1e-4) : 0); m.setParameter('dissolveSpan', r.span); }
        const index = throwing && !r.still && gpu ? fighters.indexOf(r.model) : -1;
        if (index >= 0 && t > 0) {
          const { ragged, links, outward, up, speed } = DISINTEGRATE, front = -ragged / 2 + (r.appear ? 1 - t : t) * (1 + ragged);
          const life = r.into ? DISINTEGRATE.portal.life : DISINTEGRATE.life;
          // Into a portal: thrown at its middle, from wherever on the body they are born.
          const k = DISINTEGRATE.portal.throw, velocity = r.into ? { x: (r.into.x - p.x) * k, y: (r.into.y - (bottom + top) / 2) * k, z: (r.into.z - p.z) * k } : undefined;
          // Where the front is eating it now: the grain lets it reach half its raggedness either way.
          const band = [front - ragged / 2 - .03, front + ragged / 2] as const;
          // Bigger foes come apart in slightly bigger specks.
          const size = Math.min(1.6, Math.max(1, Math.cbrt(metres)));
          const specks = Math.floor(r.specks * t) - r.thrown;
          if (specks > 0) {
            r.thrown += specks;
            // Half violet, half purple (an odd one to whichever comes first).
            r.colours.forEach((colour, c) => {
              const count = Math.round(specks * (c + 1) / r.colours.length) - Math.round(specks * c / r.colours.length);
              // Coming together, they settle into it: drawn in a little and gone soon.
              if (count > 0) gpu!.burst(r.into ? 'portal-speck' : 'speck', { at: p, count: count * links, chain: links, shape: 'surface', fighter: index, band, colour, outward: r.appear ? -outward : outward, up: r.appear ? -up : up, speed, life: r.appear ? APPEAR_LIFE : life, size, velocity });
            });
          }
          rising = Math.max(rising, life[1] + .2);
        }
        if (t >= 1) { runs.splice(i, 1); finish(r); }
      }
    },
    /** Every one gone at once (the fight is over or the scene changes): no more is thrown. */
    clear() {
      for (const r of runs.splice(0)) { if (r.model.parent) finish(r); else if (r.borrowed.length) r.materials.forEach(m => m.destroy()); r.field?.remove(); }
      lingering.splice(0).forEach(l => l.field.remove());
      rising = 0;
    },
  };
}
export type Disintegrations = ReturnType<typeof createDisintegrations>;
