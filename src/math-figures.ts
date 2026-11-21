import * as pc from 'playcanvas';
import { CAST_LAUNCH, clamp01, smooth } from './battle-motion';
import type { Effects } from './effects';
import type { GpuEmitter, GpuKind } from './fight-particles';
import { AGUA_KINDS } from './freatica-fx';
import { ensureFluidKinds } from './fluid-fx';

/**
 * The figures Matemágico draws (docs/animas/matemagico/README.md § How each skill looks, Aitor's notes
 * of 2026-11-21): each skill of his tree past Foc Binari is a piece of mathematics drawn in the air in
 * the middle of his circle, which then does what it is.
 *
 * - **Cardioide**: a small circle rolls round another of its size and its rim traces the cardioid;
 *   the curve comes apart into motes of green light that flow to whoever it cures.
 * - **Pirámide ígnea** (`factor-comun`): a triangle drawn in fire, which an apex pulls out into a
 *   pyramid; it turns, flies over the foes, draws in and blows up.
 * - **Cubo acuático** (`vasos`): a square drawn in pale water light, extruded into a cube, which
 *   fills with water on its way to the middle of the foes and bursts over them.
 * - **Integral impropia** (`integral`): ∫ from 0 to ∞, drawn upright, turned a quarter and laid
 *   between the party, and green light jetting from both its ends to each of them.
 * - **Punto eléctrico** (`descarga`): a point of charge in front of him, which rises, crackling,
 *   and falls on its foe as lightning: several jagged, branching strikes and arcs that run on.
 *
 * Strokes and edges are tubes of light (meshes, revealed a stretch at a time); everything that is
 * particles is on the GPU fight engine. Runs on the fight's clock (`update` with the fight's
 * seconds), so slow motion stretches it. Only the look: the numbers are the fight's.
 */

type V3 = { x: number; y: number; z: number };
export { FIGURES, isFigure, type FigureSkill } from './battle-motion';

/** The figures' colours: gold and fire, pale water and blue, the cure's green, the charge's yellow. Never pink or violet. */
export const FIGURE_LOOKS = {
  cure: { core: '#c9ffd0', halo: '#3fcf58' },
  fire: { core: '#ffe2a0', halo: '#ff6a1a', face: '#ff8a2e' },
  water: { core: '#eaf8ff', halo: '#5cc2f4', body: '#2f8fd8', surface: '#bfeaff' },
  bolt: { core: '#fffbe0', halo: '#ffe24a' },
} as const;

export const FIGURE_KINDS = {
  // What a drawing comes apart into: no drag and little weight, so each mote gets where it was sent as its life ends.
  'cifra-flujo': {
    shape: 'dot', drag: 0, gravity: 8, curl: .2, response: .15, size: [.032, .014], sizeJitter: .5,
    colours: ['#ffffff', '#ffffff', '#ffffff'], intensity: [5, 3.6, 2], middle: .4, fadeIn: .03, fadeOut: .22, additive: 1, flicker: .15, core: .6,
  },
} satisfies Record<string, GpuKind>;
/** Freática's water (src/freatica-fx.ts), for the cube: its drops and its bubbles. */
const WATER_KINDS = { 'agua-gota': AGUA_KINDS['agua-gota'], 'agua-burbuja': AGUA_KINDS['agua-burbuja'] };

const add = (a: V3, b: V3, k = 1): V3 => ({ x: a.x + b.x * k, y: a.y + b.y * k, z: a.z + b.z * k });
const sub = (a: V3, b: V3): V3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const mix = (a: V3, b: V3, k: number): V3 => ({ x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, z: a.z + (b.z - a.z) * k });
const len = (a: V3) => Math.hypot(a.x, a.y, a.z);
const norm = (a: V3): V3 => { const d = len(a) || 1; return { x: a.x / d, y: a.y / d, z: a.z / d }; };
const cross = (a: V3, b: V3): V3 => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });
const UP: V3 = { x: 0, y: 1, z: 0 };
const easeIn = (k: number) => { k = clamp01(k); return k * k; };
const easeOut = (k: number) => 1 - (1 - clamp01(k)) ** 3;
const easeBack = (k: number) => { k = clamp01(k) - 1; return 1 + 2.2 * k * k * k + 1.2 * k * k; };

/** The screen's right and up for a camera looking back along `facing` (towards the camera). */
function axesOf(facing: V3) {
  const f = norm(facing), right = norm(cross(UP, f)), up = norm(cross(f, right));
  return { facing: f, right, up };
}
/** A rotation whose x, y and z are `right`, `up` and `facing`. */
function basis(right: V3, up: V3, facing: V3) {
  void right;
  // Its −z looks away from the camera, so its +z (the drawing's front) faces it.
  const m = new pc.Mat4().setLookAt(pc.Vec3.ZERO, new pc.Vec3(-facing.x, -facing.y, -facing.z), new pc.Vec3(up.x, up.y, up.z));
  return new pc.Quat().setFromMat4(m);
}

/**
 * A tube of `radius` along `points` (local), `sides` round: a stroke of light. Its triangles go along
 * it a segment at a time, so drawing only some of them reveals a stretch of the stroke.
 */
function tubeMesh(device: pc.GraphicsDevice, points: readonly V3[], radius: number, sides = 5) {
  const positions: number[] = [], normals: number[] = [], indices: number[] = [];
  const n = points.length;
  for (let i = 0; i < n; i++) {
    const t = norm(sub(points[Math.min(n - 1, i + 1)], points[Math.max(0, i - 1)]));
    const ref = Math.abs(t.z) < .9 ? { x: 0, y: 0, z: 1 } : { x: 1, y: 0, z: 0 };
    const a = norm(cross(t, ref)), b = cross(t, a);
    for (let s = 0; s < sides; s++) {
      const angle = s / sides * Math.PI * 2, c = Math.cos(angle), si = Math.sin(angle);
      const nx = a.x * c + b.x * si, ny = a.y * c + b.y * si, nz = a.z * c + b.z * si;
      positions.push(points[i].x + nx * radius, points[i].y + ny * radius, points[i].z + nz * radius);
      normals.push(nx, ny, nz);
    }
  }
  for (let i = 0; i < n - 1; i++) for (let s = 0; s < sides; s++) {
    const a = i * sides + s, b = i * sides + (s + 1) % sides, c = a + sides, d = b + sides;
    indices.push(a, c, b, b, c, d);
  }
  const mesh = new pc.Mesh(device);
  mesh.setPositions(new Float32Array(positions)); mesh.setNormals(new Float32Array(normals)); mesh.setIndices(indices); mesh.update();
  return { mesh, per: sides * 6, segments: n - 1 };
}
/** Points along a closed or open curve `at(u)`, u from 0 to 1. */
const sample = (count: number, at: (u: number) => V3) => Array.from({ length: count + 1 }, (_, i) => at(i / count));
const segment = (a: V3, b: V3, count = 12) => sample(count, u => mix(a, b, u));
/** A cubic Bézier. */
const bezier = (p0: V3, p1: V3, p2: V3, p3: V3) => (u: number): V3 => {
  const k = 1 - u, a = k * k * k, b = 3 * k * k * u, c = 3 * k * u * u, d = u * u * u;
  return { x: p0.x * a + p1.x * b + p2.x * c + p3.x * d, y: p0.y * a + p1.y * b + p2.y * c + p3.y * d, z: p0.z * a + p1.z * b + p2.z * c + p3.z * d };
};
const xy = (x: number, y: number, z = 0): V3 => ({ x, y, z });

/**
 * A stroke of neon: a tube lit by how square it faces the eye, so it is white-hot along its middle,
 * its colour towards its edges and nothing at them. `uGlow`: its colour (linear) and brightness;
 * `uCore`: the colour of its middle and a flash on top; `uEye`: where the camera is.
 */
const NEON_VERTEX = /* wgsl */ `
attribute vertex_position: vec3f;
attribute vertex_normal: vec3f;
uniform matrix_model: mat4x4f;
uniform matrix_viewProjection: mat4x4f;
varying vNormal: vec3f;
varying vWorld: vec3f;
@vertex
fn vertexMain(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;
  let world = uniform.matrix_model * vec4f(vertex_position, 1.0);
  output.vWorld = world.xyz;
  output.vNormal = (uniform.matrix_model * vec4f(vertex_normal, 0.0)).xyz;
  output.position = uniform.matrix_viewProjection * world;
  return output;
}`;
const NEON = /* wgsl */ `
#include "gammaPS"
#include "tonemappingPS"
varying vNormal: vec3f;
varying vWorld: vec3f;
uniform uEye: vec4f;
uniform uGlow: vec4f;
uniform uCore: vec4f;
@fragment
fn fragmentMain(input: FragmentInput) -> FragmentOutput {
  var output: FragmentOutput;
  let f = abs(dot(normalize(vNormal), normalize(uniform.uEye.xyz - vWorld)));
  let edge = pow(f, 1.4);
  let middle = pow(f, 7.0);
  let light = (uniform.uGlow.rgb * edge + uniform.uCore.rgb * middle * (1.0 + uniform.uCore.w * 2.0)) * uniform.uGlow.w;
  output.color = vec4f(gammaCorrectOutput(toneMap(max(light, vec3f(0.0)))), 1.0);
  return output;
}`;
const linear = (hex: string, out: Float32Array) => { const c = new pc.Color().fromString(hex); out[0] = c.r ** 2.2; out[1] = c.g ** 2.2; out[2] = c.b ** 2.2; return out; };

/** A jagged path from `a` to `b`, knocked off the straight line by halves (midpoint displacement). */
function jagged(a: V3, b: V3, rough: number, depth: number, side: V3, other: V3): V3[] {
  let path = [a, b];
  for (let d = 0, r = rough; d < depth; d++, r *= .55) {
    const next: V3[] = [path[0]];
    for (let i = 1; i < path.length; i++) {
      const m = mix(path[i - 1], path[i], .5), j = (Math.random() - .5) * 2 * r, k = (Math.random() - .5) * 2 * r * .6;
      next.push(add(add(m, side, j), other, k), path[i]);
    }
    path = next;
  }
  return path;
}

export interface FigureFoe { chest: V3; feet: V3; radius: number }

export function createMathFigures(app: pc.AppBase, parent: pc.Entity, effects: Effects) {
  const device = app.graphicsDevice;
  const gpu = () => effects.gpu && effects.gpu.active ? effects.gpu : undefined;
  function ensureKinds() {
    const g = effects.gpu;
    if (!g) return;
    for (const [name, kind] of Object.entries({ ...FIGURE_KINDS, ...WATER_KINDS })) if (!g.get(name)) g.define(name, kind as GpuKind);
  }
  ensureKinds();
  const neon = new pc.ShaderMaterial({ uniqueName: 'gerard-matemagico-neon', attributes: { vertex_position: pc.SEMANTIC_POSITION, vertex_normal: pc.SEMANTIC_NORMAL }, vertexWGSL: NEON_VERTEX, fragmentWGSL: NEON });
  neon.name = 'Trazo de Matemágico'; neon.blendType = pc.BLEND_ADDITIVE; neon.depthWrite = false; neon.cull = pc.CULLFACE_BACK; neon.update();
  /** Where the camera is, for every stroke (written each frame). */
  const eye = new Float32Array(4);
  const cameraEntity = () => app.systems.camera?.cameras[0]?.entity;
  /** The screen's right, up and the way to the camera, from the camera itself (the fight's `view` if there is none). */
  const screen = (view: V3) => {
    const cam = cameraEntity();
    if (!cam) return axesOf(view);
    const r = cam.right, u = cam.up, b = cam.forward;
    return { right: { x: r.x, y: r.y, z: r.z }, up: { x: u.x, y: u.y, z: u.z }, facing: { x: -b.x, y: -b.y, z: -b.z } };
  };

  // ——— The clock: what runs each frame for a while, and what happens later ———
  const tracks: { t: number; seconds: number; step(t: number, dt: number): void; done?(): void }[] = [];
  const play = (seconds: number, step: (t: number, dt: number) => void, done?: () => void) => { tracks.push({ t: 0, seconds, step, done }); };
  const after = (seconds: number, run: () => void) => play(seconds, () => {}, run);
  const live = new Set<{ destroy(): void }>();
  /** Every emitter running, so a fight that ends takes them all. */
  const running = new Set<GpuEmitter>();
  const emit = (kind: string, o: Omit<GpuEmitter, 'remove'>) => { const e = gpu()?.emitter(kind, o); if (e) running.add(e); return e; };
  const stop = (e?: GpuEmitter) => { if (e && running.delete(e)) e.remove(); };

  // ——— Figures of light: an entity, its strokes, its materials ———
  function lightMaterial(name: string, hex: string, intensity: number) {
    const m = new pc.StandardMaterial();
    m.name = name; m.diffuse.set(0, 0, 0); m.useLighting = false; m.useFog = false; m.useSkybox = false;
    m.emissive.fromString(hex); m.emissiveIntensity = intensity;
    m.blendType = pc.BLEND_ADDITIVE; m.depthWrite = false; m.cull = pc.CULLFACE_NONE;
    m.update();
    return m;
  }
  interface Stroke { entity: pc.Entity; points: V3[]; show(from: number, to: number): void; at(k: number): V3 }
  function figure(name: string, look: { core: string; halo: string }) {
    const root = new pc.Entity(name); parent.addChild(root);
    const body = new pc.Entity(`${name} · cuerpo`); root.addChild(body);
    const glowU = linear(look.halo, new Float32Array(4)), coreU = linear(look.core, new Float32Array(4));
    const meshes: pc.Mesh[] = [], materials: pc.Material[] = [];
    let shine = 1;
    const self = {
      root, body,
      /** A stroke along `points` (local to `under`, the body by default), hidden until shown. */
      stroke(points: V3[], o: { radius?: number; under?: pc.Entity } = {}): Stroke {
        const a = tubeMesh(device, points, o.radius ?? .03, 8);
        meshes.push(a.mesh);
        const e = new pc.Entity(`${name} · trazo`);
        const instance = new pc.MeshInstance(a.mesh, neon);
        instance.cull = false;
        instance.setParameter('uEye', eye); instance.setParameter('uGlow', glowU); instance.setParameter('uCore', coreU);
        e.addComponent('render', { meshInstances: [instance], castShadows: false, receiveShadows: false });
        (o.under ?? body).addChild(e);
        const show = (from: number, to: number) => {
          const first = Math.floor(clamp01(from) * a.segments), last = Math.ceil(clamp01(to) * a.segments);
          e.enabled = last > first;
          a.mesh.primitive[0].base = first * a.per; a.mesh.primitive[0].count = Math.max(0, last - first) * a.per;
        };
        show(0, 0);
        const at = (k: number) => { const f = clamp01(k) * (points.length - 1), i = Math.min(points.length - 2, Math.floor(f)); return mix(points[i], points[i + 1], f - i); };
        return { entity: e, points, show, at };
      },
      /** How bright it is (1 as drawn), and a flash on top. */
      glow(k: number, flash = 0) {
        shine = k;
        glowU[3] = 2.6 * shine * (1 + flash * 1.5); coreU[3] = flash;
      },
      get shine() { return shine; },
      /** A mesh of its own with its own material (a pyramid's faces, a cube's water). */
      own(mesh: pc.Mesh | undefined, material: pc.Material) { if (mesh) meshes.push(mesh); materials.push(material); },
      /** Where a point of its body is in the world. */
      world(p: V3): V3 { const w = body.getWorldTransform().transformPoint(new pc.Vec3(p.x, p.y, p.z)); return { x: w.x, y: w.y, z: w.z }; },
      destroy() { live.delete(self); root.destroy(); meshes.forEach(m => m.destroy()); materials.forEach(m => m.destroy()); },
    };
    live.add(self);
    self.glow(1);
    return self;
  }
  type Figure = ReturnType<typeof figure>;
  /** Where a figure is drawn: over the middle of his circle and a little before it, clear of his head. */
  const lifted = (centre: V3, view: V3): V3 => { const { facing } = screen(view), flat = norm({ x: facing.x, y: 0, z: facing.z }); return { x: centre.x + flat.x * .25, y: centre.y + .5, z: centre.z + flat.z * .25 }; };
  /** Lays a figure in the plane facing the camera at `centre` (lifted). */
  function face(f: Figure, centre: V3, view: V3) {
    const { right, up, facing } = screen(view);
    centre = lifted(centre, view);
    f.root.setPosition(centre.x, centre.y, centre.z);
    f.root.setRotation(basis(right, up, facing));
    return { right, up, facing };
  }
  /** A flare of light that follows a point (the pen's tip), for as long as `seconds`. */
  function pen(colour: string, seconds: number, where: (t: number) => V3 | undefined, o: { rate?: number; kind?: string; size?: number } = {}) {
    const first = where(0) ?? { x: 0, y: -50, z: 0 };
    const tip = emit(o.kind ?? 'spellcore', { at: first, shape: 'ball', spread: .015, rate: o.rate ?? 220, speed: .12, life: [.08, .2], colour, size: o.size ?? .7 });
    if (!tip) return;
    play(seconds, t => { const p = where(t); if (p) tip.at = p; tip.rate = p ? o.rate ?? 220 : 0; }, () => stop(tip));
  }
  /** Draws strokes one after another over `seconds` (each in proportion to its length), with a pen at the tip. */
  function draw(f: Figure, strokes: Stroke[], seconds: number, colour: string, o: { pen?: boolean } = {}) {
    const lengths = strokes.map(s => s.points.slice(1).reduce((sum, p, i) => sum + len(sub(p, s.points[i])), 0)), total = lengths.reduce((a, b) => a + b, 0) || 1;
    const where = (t: number) => {
      let k = clamp01(t / seconds) * total;
      for (let i = 0; i < strokes.length; i++) {
        if (k <= lengths[i] || i === strokes.length - 1) return { i, k: clamp01(k / (lengths[i] || 1)) };
        k -= lengths[i];
      }
      return { i: strokes.length - 1, k: 1 };
    };
    play(seconds, t => { const { i, k } = where(t); strokes.forEach((s, j) => s.show(0, j < i ? 1 : j === i ? k : 0)); });
    if (o.pen !== false) pen(colour, seconds, t => { const { i, k } = where(t); return f.world(strokes[i].at(k)); });
  }

  // ——— Cardioide ———
  /**
   * A small circle rolls round a fixed one of the same size and a point on its rim traces the
   * cardioid, from its cusp all the way round; the circles go, and the curve comes apart from its
   * cusp on into motes of green light that flow, arcing, to `to`, where they land about `arrive`
   * seconds after it began.
   */
  function cardioide(o: { centre: V3; view: V3; to: V3; size?: number }) {
    const f = figure('Cardioide', FIGURE_LOOKS.cure), b = .23 * (o.size ?? 1);
    face(f, o.centre, o.view);
    // Cusp up: the rolling circle's point at angle t, turned a quarter.
    const curve = (t: number): V3 => xy(-(2 * b * Math.sin(t) - b * Math.sin(2 * t)), 2 * b * Math.cos(t) - b * Math.cos(2 * t) - b * .25);
    const heart = f.stroke(sample(96, u => curve(u * Math.PI * 2)), { radius: .026 });
    const fixed = f.stroke(sample(48, u => xy(Math.cos(u * Math.PI * 2) * b, Math.sin(u * Math.PI * 2) * b - b * .25)), { radius: .012 });
    const roller = new pc.Entity('Círculo que rueda'); f.body.addChild(roller);
    const rolling = f.stroke(sample(48, u => xy(Math.cos(u * Math.PI * 2) * b, Math.sin(u * Math.PI * 2) * b)), { radius: .012, under: roller });
    const spoke = new pc.Entity('Radio'); roller.addChild(spoke);
    const radius = f.stroke(segment(xy(0, 0), xy(0, 1), 4), { radius: .009, under: spoke });
    const DRAW = .55, HOLD = .07, ERASE = .22, FLIGHT = .42;
    f.glow(0);
    play(DRAW + HOLD + ERASE, t => {
      const k = smooth(t / DRAW), theta = k * Math.PI * 2;
      f.glow(Math.min(1, t / .08));
      fixed.show(0, smooth(t / .12)); rolling.show(0, smooth(t / .12));
      // The rolling circle's centre goes round at twice b; its point is the curve's.
      const c = xy(-2 * b * Math.sin(theta), 2 * b * Math.cos(theta) - b * .25), p = curve(theta);
      roller.setLocalPosition(c.x, c.y, c.z);
      const d = sub(p, c);
      spoke.setLocalEulerAngles(0, 0, Math.atan2(-d.x, d.y) * pc.math.RAD_TO_DEG); spoke.setLocalScale(1, len(d), 1);
      radius.show(0, 1);
      // The circles fade once the curve is closed.
      const gone = smooth((t - DRAW) / .1);
      roller.enabled = gone < .98; fixed.entity.enabled = gone < .98;
      if (gone > 0) { roller.setLocalScale(1 - gone * .6, 1 - gone * .6, 1); }
      heart.show(t < DRAW + HOLD ? 0 : smooth((t - DRAW - HOLD) / ERASE), k);
    }, () => f.destroy());
    pen(FIGURE_LOOKS.cure.core, DRAW, t => f.world(curve(smooth(t / DRAW) * Math.PI * 2)), { size: .8 });
    // It comes apart from the cusp on: each stretch as it goes sends its motes to `to`.
    let sent = 0;
    const g = gpu(), weight = FIGURE_KINDS['cifra-flujo'].gravity;
    after(DRAW + HOLD, () => play(ERASE, t => {
      const upTo = Math.round(smooth(t / ERASE) * 96);
      for (; sent < upTo; sent++) {
        const p = f.world(curve(sent / 96 * Math.PI * 2)), flight = FLIGHT * (.9 + Math.random() * .2);
        const v = { x: (o.to.x - p.x) / flight, y: (o.to.y - p.y) / flight + weight * flight / 2, z: (o.to.z - p.z) / flight };
        g?.burst('cifra-flujo', { at: p, count: 9, spread: .02, velocity: v, speed: .08, life: [flight * .98, flight], colour: sent % 3 ? FIGURE_LOOKS.cure.halo : FIGURE_LOOKS.cure.core, size: 1, ...sent % 32 === 0 ? { light: { intensity: 1.4, range: 1.8, colour: FIGURE_LOOKS.cure.halo } } : {} });
      }
    }));
  }

  // ——— Pirámide ígnea ———
  /**
   * A triangle drawn in fire, stroke by stroke; an apex rises out of its middle and pulls it into a
   * pyramid, faces burning, which starts to turn. It flies over `foes` growing, trailing fire, draws
   * in for a breath and blows up: a white flash, a ball of flame, the edges flung off as sparks, a ring
   * of fire along the floor and a gout of flame to each foe.
   */
  function piramide(o: { centre: V3; view: V3; foes: readonly FigureFoe[]; size?: number }) {
    if (!o.foes.length) return;
    const f = figure('Pirámide ígnea', FIGURE_LOOKS.fire), s = .85 * (o.size ?? 1);
    face(f, o.centre, o.view);
    // An equilateral triangle in the drawing's plane, and the apex out of it towards the camera,
    // laid so the pyramid's middle is the root's.
    const R = s / Math.sqrt(3), h = s * Math.sqrt(2 / 3), base = -h / 4;
    const A = xy(0, R, base), B = xy(-s / 2, -R / 2, base), C = xy(s / 2, -R / 2, base), apex = xy(0, 0, base + h);
    const sides = [f.stroke(segment(A, B)), f.stroke(segment(B, C)), f.stroke(segment(C, A))];
    const ribs = [A, B, C].map(p => f.stroke(segment(p, apex)));
    // Its faces: fire through glass, brighter as it goes.
    const faceMesh = new pc.Mesh(device);
    const tri = [A, B, C, A, B, apex, B, C, apex, C, A, apex];
    faceMesh.setPositions(new Float32Array(tri.flatMap(p => [p.x, p.y, p.z])));
    faceMesh.setNormals(new Float32Array(tri.flatMap(() => [0, 0, 1])));
    faceMesh.setIndices([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]); faceMesh.update();
    const faceMat = lightMaterial('Pirámide ígnea · caras', FIGURE_LOOKS.fire.face, 0);
    f.own(faceMesh, faceMat);
    const faces = new pc.Entity('Caras'); faces.addComponent('render', { meshInstances: [new pc.MeshInstance(faceMesh, faceMat)], castShadows: false, receiveShadows: false }); f.body.addChild(faces);
    const TRI = .36, RISE = .24, FLY = .52, DRAW_IN = .06;
    const start = lifted(o.centre, o.view), above = Math.max(...o.foes.map(e => e.chest.y)) + .7;
    const mid = o.foes.reduce((sum, e) => add(sum, e.feet, 1 / o.foes.length), { x: 0, y: 0, z: 0 });
    const goal = { x: mid.x, y: above, z: mid.z };
    draw(f, sides, TRI, FIGURE_LOOKS.fire.core);
    // Embers off the pen as it draws: fire, not ink.
    pen('#ffb347', TRI, t => { const k = clamp01(t / TRI) * 3, i = Math.min(2, Math.floor(k)); return f.world(sides[i].at(k - i)); }, { kind: 'ember', rate: 160, size: .8 });
    let spin = 0, flames: (GpuEmitter | undefined)[] = [];
    const g = gpu();
    play(TRI + RISE + FLY + DRAW_IN, (t, dt) => {
      const rise = smooth((t - TRI) / RISE), fly = clamp01((t - TRI - RISE) / FLY), drawIn = clamp01((t - TRI - RISE - FLY) / DRAW_IN);
      ribs.forEach(r => r.show(0, rise));
      faceMat.emissiveIntensity = (.25 + .5 * fly + 2.4 * drawIn) * rise * (.85 + .15 * Math.sin(t * 40)); faceMat.update();
      // It turns, faster as it flies, on an axis tipped towards the camera so its depth shows.
      spin += dt * (rise * 160 + fly * 520);
      f.body.setLocalEulerAngles(18 * rise, spin, 0);
      const k = easeIn(fly), arc = Math.sin(fly * Math.PI) * .9;
      const at = { x: start.x + (goal.x - start.x) * k, y: start.y + (goal.y - start.y) * k + arc, z: start.z + (goal.z - start.z) * k };
      f.root.setPosition(at.x, at.y, at.z);
      const grow = 1 + fly * .9, squeeze = 1 - .3 * Math.sin(drawIn * Math.PI / 2);
      f.root.setLocalScale(grow * squeeze, grow * squeeze, grow * squeeze);
      f.glow(1, drawIn);
      if (fly > 0 && !flames.length) flames = [
        emit('flamelet', { at, shape: 'ball', spread: .18, rate: 260, speed: .5, life: [.18, .4], size: 1.2 }),
        emit('ember', { at, shape: 'ball', spread: .25, rate: 140, speed: .9, up: .4, life: [.3, .7] }),
      ];
      for (const e of flames) if (e) e.at = at;
    }, () => {
      flames.forEach(stop);
      const at = f.world(xy(0, 0, 0)), edges = [A, B, C].flatMap((p, i) => [[p, [B, C, A][i]], [p, apex]]).map(([a, b]) => [f.world(a), f.world(b)] as const);
      f.destroy();
      if (!g) return;
      // The blast: a white heart, a ball of flame thrown out, sparks off what were its edges.
      g.burst('bloom', { at, count: 2, spread: .1, life: [.2, .32], colour: '#ffb347', size: 1.2, light: { intensity: 6, range: 7, colour: '#ff8a2e' } });
      g.burst('flamelet', { at, count: 260, shape: 'ball', spread: .3, outward: 5.5, speed: 2.4, up: .6, life: [.35, .75], size: 2.6 });
      g.burst('flamelet', { at, count: 120, shape: 'ball', spread: .2, outward: 2, speed: 1, up: 1.6, life: [.5, .9], size: 3.4 });
      g.burst('crackle', { at, count: 220, spread: .25, speed: 6, up: 1.2, life: [.4, .9] });
      for (const [a, b] of edges) g.burst('spark', { at: a, to: b, shape: 'line', count: 26, outward: 0, speed: 4.5, up: 1.5, life: [.4, .8], colour: '#ffd27a' });
      g.burst('floorring', { at: { x: mid.x, y: mid.y + .05, z: mid.z }, count: 1, life: [.5, .6], colour: '#ff8a2e', size: 2.4 });
      g.burst('ember', { at: { x: mid.x, y: mid.y + .1, z: mid.z }, count: 180, shape: 'ring', spread: 1.6, outward: 3, up: 1.2, speed: .6, life: [.6, 1.2] });
      // A gout of flame to each foe, there as the blow lands.
      for (const e of o.foes) {
        const flight = .09, v = { x: (e.chest.x - at.x) / flight, y: (e.chest.y - at.y) / flight, z: (e.chest.z - at.z) / flight };
        g.burst('flamelet', { at, count: 70, spread: .12, velocity: v, speed: 1, life: [flight * 1.4, flight * 2.2], size: 2 });
      }
    });
  }

  // ——— Cubo acuático ———
  /**
   * A square drawn in pale water light; its back face slides out of it and the edges joining the two
   * grow with it: a cube, which turns to show its depth. On its way to the middle of `foes` it fills
   * with water, bubbles going up through it, the surface rocking as it flies; over them it swells
   * and bursts, water falling on all of them.
   */
  function cubo(o: { centre: V3; view: V3; foes: readonly FigureFoe[]; size?: number }) {
    if (!o.foes.length) return;
    const f = figure('Cubo acuático', FIGURE_LOOKS.water), s = .66 * (o.size ?? 1), q = s / 2;
    face(f, o.centre, o.view);
    // The front square, drawn; the back one is the same square, slid out behind it.
    const corners = [xy(-q, q), xy(q, q), xy(q, -q), xy(-q, -q)];
    const front = corners.map((p, i) => f.stroke(segment(p, corners[(i + 1) % 4])));
    const backFace = new pc.Entity('Cara de atrás'); f.body.addChild(backFace);
    const back = corners.map((p, i) => f.stroke(segment(p, corners[(i + 1) % 4]), { under: backFace }));
    const ribs = corners.map(p => { const e = new pc.Entity('Arista'); e.setLocalPosition(p.x, p.y, 0); f.body.addChild(e); return { e, s: f.stroke(segment(xy(0, 0, 0), xy(0, 0, -1), 4), { under: e }) }; });
    // The water: a box that rises from the floor of the cube, and its surface.
    const waterMat = new pc.StandardMaterial();
    waterMat.name = 'Cubo acuático · agua'; waterMat.diffuse.set(0, 0, 0); waterMat.useLighting = false; waterMat.useFog = false; waterMat.useSkybox = false;
    waterMat.emissive.fromString(FIGURE_LOOKS.water.body); waterMat.emissiveIntensity = 1.1; waterMat.opacity = .55; waterMat.blendType = pc.BLEND_NORMAL; waterMat.depthWrite = false; waterMat.cull = pc.CULLFACE_BACK; waterMat.update();
    const surfaceMat = lightMaterial('Cubo acuático · superficie', FIGURE_LOOKS.water.surface, 1.2);
    f.own(undefined, waterMat); f.own(undefined, surfaceMat);
    const tank = new pc.Entity('Agua'); f.body.addChild(tank);
    const water = new pc.Entity('Volumen'); water.addComponent('render', { type: 'box', material: waterMat, castShadows: false, receiveShadows: false }); tank.addChild(water);
    const surface = new pc.Entity('Superficie'); surface.addComponent('render', { type: 'plane', material: surfaceMat, castShadows: false, receiveShadows: false }); tank.addChild(surface);
    tank.enabled = false;
    const SQUARE = .36, EXTRUDE = .26, FLY = .75, SWELL = .13;
    const start = lifted(o.centre, o.view), above = Math.max(...o.foes.map(e => e.chest.y)) + .75;
    const mid = o.foes.reduce((sum, e) => add(sum, e.feet, 1 / o.foes.length), { x: 0, y: 0, z: 0 });
    const goal = { x: mid.x, y: above, z: mid.z };
    draw(f, front, SQUARE, FIGURE_LOOKS.water.core);
    pen(FIGURE_LOOKS.water.halo, SQUARE, t => { const k = clamp01(t / SQUARE) * 4, i = Math.min(3, Math.floor(k)); return f.world(front[i].at(k - i)); }, { kind: 'drip', rate: 120, size: 1 });
    let bubbles: GpuEmitter | undefined, last = { ...start }, tilt = 0;
    const g = gpu();
    play(SQUARE + EXTRUDE + FLY + SWELL, (t, dt) => {
      const d = smooth((t - SQUARE) / EXTRUDE) * s, fly = clamp01((t - SQUARE - EXTRUDE) / FLY), swell = clamp01((t - SQUARE - EXTRUDE - FLY) / SWELL);
      // Extruded: the back face slides out, the four edges grow to it, and the middle stays the root's.
      backFace.setLocalPosition(0, 0, -d); back.forEach(b => b.show(0, d > .002 ? 1 : 0));
      ribs.forEach(r => { r.e.setLocalScale(1, 1, Math.max(.001, d)); r.s.show(0, d > .002 ? 1 : 0); });
      const turn = smooth((t - SQUARE) / (EXTRUDE + .25));
      f.body.setLocalPosition(0, 0, d / 2);
      f.root.setRotation(basis(screen(o.view).right, screen(o.view).up, screen(o.view).facing));
      const k = smooth(fly), arc = Math.sin(fly * Math.PI) * .55;
      const at = { x: start.x + (goal.x - start.x) * k, y: start.y + (goal.y - start.y) * k + arc, z: start.z + (goal.z - start.z) * k };
      // It rocks with its speed, and the water in it leans the other way.
      const speed = dt > 0 ? len(sub(at, last)) / dt : 0; last = at;
      tilt += (Math.min(1, speed / 4) * 14 - tilt) * Math.min(1, dt * 8);
      f.root.rotateLocal(28 * turn + fly * 40, 0, 0);
      f.root.rotateLocal(0, -32 * turn - fly * 30, 0);
      f.root.setPosition(at.x, at.y, at.z);
      const grow = (1 + fly * .55) * (1 + .14 * Math.sin(swell * Math.PI * 3) * swell);
      f.root.setLocalScale(grow, grow, grow);
      // Water fills it as it flies.
      const level = smooth(fly / .9), inner = s * .94;
      tank.enabled = level > .01;
      tank.setLocalPosition(0, 0, -d / 2); tank.setLocalEulerAngles(0, 0, -tilt * Math.sin(t * 6) * .4);
      water.setLocalScale(inner, Math.max(.001, inner * level), Math.max(.001, d * .94));
      water.setLocalPosition(0, -inner / 2 + inner * level / 2, 0);
      surface.setLocalScale(inner, 1, Math.max(.001, d * .94)); surface.setLocalPosition(0, -inner / 2 + inner * level + .002, 0);
      surface.setLocalEulerAngles(tilt * Math.sin(t * 9) * .5, 0, tilt * Math.cos(t * 7) * .5);
      surfaceMat.emissiveIntensity = (.9 + .4 * Math.sin(t * 13)) * (1 + swell * 2); surfaceMat.update();
      waterMat.emissiveIntensity = 1.1 + swell * 1.2; waterMat.update();
      f.glow(1, swell);
      if (fly > 0 && !bubbles) bubbles = emit('agua-burbuja', { at, shape: 'ball', spread: s * .3, rate: 120, speed: .15, up: .5, life: [.2, .35], size: 1.4 });
      if (bubbles) { bubbles.at = f.world(xy(0, -q * .4, -d / 2)); bubbles.rate = 120 * level; }
    }, () => {
      stop(bubbles);
      const at = f.world(xy(0, 0, -s / 2)), r = s * .6 * (1 + .55);
      f.destroy();
      if (!g) return;
      // It bursts: water thrown out all round, that falls and splashes, a flash of blue light.
      g.burst('bloom', { at, count: 1, spread: .1, life: [.16, .24], colour: FIGURE_LOOKS.water.halo, size: .9, light: { intensity: 4, range: 6, colour: FIGURE_LOOKS.water.halo } });
      g.burst('agua-gota', { at, count: 420, shape: 'ball', spread: r, outward: 3.4, up: 2.2, speed: 1.6, life: [.6, 1.1], size: 1.6 });
      // What was in it falls on them as one body of water and spreads over the floor (a fluid, src/fluid-fx.ts).
      ensureFluidKinds(g);
      g.burst('fluido-agua', { at, count: 1100, shape: 'ball', spread: r * .55, speed: .8, up: .6, life: [1.8, 2.5] });
      g.burst('agua-gota', { at, count: 160, shape: 'ball', spread: r * .5, outward: 6, up: .8, speed: 2, life: [.3, .6], size: 1.1 });
      g.burst('floorring', { at: { x: mid.x, y: mid.y + .05, z: mid.z }, count: 1, life: [.45, .55], colour: FIGURE_LOOKS.water.halo, size: 2.2 });
      g.burst('drip', { at: { x: mid.x, y: mid.y + .1, z: mid.z }, count: 120, shape: 'ring', spread: 1.5, outward: 2.6, up: 1.4, speed: .5, life: [.4, .8] });
      // A sheet of it on each foe, there as the blow lands.
      for (const e of o.foes) {
        const flight = .08, v = { x: (e.chest.x - at.x) / flight, y: (e.chest.y + .3 - at.y) / flight, z: (e.chest.z - at.z) / flight };
        g.burst('agua-gota', { at, count: 90, spread: .14, velocity: v, speed: 1.2, life: [.5, .9], size: 1.6 });
      }
    });
  }

  // ——— Integral impropia ———
  /**
   * ∫ from 0 to ∞, drawn upright with its limits; it turns a quarter as it goes to lie between
   * `allies` at the height of their chests, its two ends towards them, and green light jets out of
   * each end into whoever is that side.
   */
  function integral(o: { centre: V3; view: V3; allies: readonly V3[]; size?: number }) {
    if (!o.allies.length) return;
    const f = figure('Integral impropia', FIGURE_LOOKS.cure), H = 1 * (o.size ?? 1), sl = .12;
    face(f, o.centre, o.view);
    const slant = (p: V3) => xy(p.x + p.y * sl, p.y);
    const top = bezier(xy(.17 * H, .43 * H), xy(.13 * H, .53 * H), xy(.02 * H, .53 * H), xy(0, .36 * H));
    const bottom = bezier(xy(0, -.36 * H), xy(-.02 * H, -.53 * H), xy(-.13 * H, -.53 * H), xy(-.17 * H, -.43 * H));
    const sign = [...sample(24, top), ...sample(20, u => xy(0, .36 * H - u * .72 * H)).slice(1), ...sample(24, bottom).slice(1)].map(slant);
    const lemniscate = (u: number) => { const t = u * Math.PI * 2, a = .075 * H, d = 1 + Math.sin(t) ** 2; return xy(.28 * H + a * Math.cos(t) / d, .5 * H + a * Math.sin(t) * Math.cos(t) / d); };
    const zero = (u: number) => { const t = Math.PI / 2 + u * Math.PI * 2; return xy(.05 * H + Math.cos(t) * .028 * H, -.52 * H + Math.sin(t) * .042 * H); };
    const strokes = [f.stroke(sign, { radius: .036 }), f.stroke(sample(40, lemniscate).map(slant), { radius: .018 }), f.stroke(sample(24, zero).map(slant), { radius: .018 })];
    const DRAW = .46, HOLD = .04, TURN = .35, JETS = .4, FADE = .3, FLIGHT = .28;
    draw(f, strokes, DRAW, FIGURE_LOOKS.cure.core);
    // Where it lies: between the allies, a little before them; its length most of the way between the two furthest apart.
    const mid = o.allies.reduce((sum, p) => add(sum, p, 1 / o.allies.length), { x: 0, y: 0, z: 0 });
    const { facing } = screen(o.view), spot = add(mid, { x: facing.x, y: 0, z: facing.z }, .25);
    const wide = o.allies.length > 1 ? Math.max(...o.allies.flatMap(a => o.allies.map(b => Math.hypot(a.x - b.x, a.z - b.z)))) : 1;
    const grow = Math.min(1.8, Math.max(1, wide * .62 / (H * 1.06)));
    const start = lifted(o.centre, o.view);
    let jets: (GpuEmitter | undefined)[] = [];
    const g = gpu(), weight = FIGURE_KINDS['cifra-flujo'].gravity;
    const ends = () => [f.world(sign[0]), f.world(sign[sign.length - 1])];
    play(DRAW + HOLD + TURN + JETS + FADE, t => {
      const k = smooth((t - DRAW - HOLD) / TURN), fade = clamp01((t - DRAW - HOLD - TURN - JETS) / FADE);
      const at = mix(start, spot, k);
      f.root.setPosition(at.x, at.y + Math.sin(k * Math.PI) * .25, at.z);
      f.body.setLocalEulerAngles(0, 0, 90 * easeBack(k));
      const scale = 1 + (grow - 1) * k;
      f.root.setLocalScale(scale, scale, scale);
      const jetting = t >= DRAW + HOLD + TURN && t < DRAW + HOLD + TURN + JETS;
      f.glow(1 - fade, jetting ? .35 + .25 * Math.sin(t * 30) : 0);
      if (jetting && !jets.length && g) {
        // Each ally takes the end nearer to them.
        const [a, b] = ends();
        jets = o.allies.map(ally => {
          const end = Math.hypot(ally.x - a.x, ally.z - a.z) <= Math.hypot(ally.x - b.x, ally.z - b.z) ? 0 : 1;
          const from = end ? b : a, v = { x: (ally.x - from.x) / FLIGHT, y: (ally.y - from.y) / FLIGHT + weight * FLIGHT / 2, z: (ally.z - from.z) / FLIGHT };
          g.burst('flare', { at: from, count: 2, spread: .02, life: [.2, .3], colour: FIGURE_LOOKS.cure.halo, light: { intensity: 2.4, range: 2.4, colour: FIGURE_LOOKS.cure.halo } });
          return emit('cifra-flujo', { at: from, shape: 'ball', spread: .03, rate: 420, velocity: v, speed: .3, life: [FLIGHT * .97, FLIGHT], colour: FIGURE_LOOKS.cure.halo, size: 1.15 });
        });
      }
      if (!jetting && jets.length) { jets.forEach(stop); jets = []; }
    }, () => { jets.forEach(stop); f.destroy(); });
  }

  /**
   * A stroke of lightning from `a` to `b`: a white-hot jagged core in a yellow glow, forks off it,
   * arcs crawling along it and a flash where it lands. `side` and `depth` are the ways it may bend.
   */
  function lightning(a: V3, b: V3, o: { side: V3; depth: V3; lit?: number; rough?: number; forks?: number; down?: boolean }) {
    const g = gpu();
    if (!g) return;
    const lit = o.lit ?? 1, long = len(sub(b, a)), path = jagged(a, b, (o.rough ?? .7) * Math.min(1, long / 3), 5, o.side, o.depth);
    for (let i = 1; i < path.length; i++) {
      g.burst('glyph', { at: path[i - 1], to: path[i], shape: 'line', count: 12, life: [.1, .15], colour: FIGURE_LOOKS.bolt.core, size: 2.8 * lit });
      g.burst('glyph', { at: path[i - 1], to: path[i], shape: 'line', count: 7, life: [.13, .19], colour: FIGURE_LOOKS.bolt.halo, size: 7 * lit });
    }
    for (let fork = 0; fork < (o.forks ?? 4); fork++) {
      const from = path[2 + Math.floor(Math.random() * (path.length - 6))], out = add(add(from, o.side, (Math.random() - .5) * 1.3 * Math.min(1, long / 3)), o.down === false ? o.depth : UP, (o.down === false ? .3 : -.4 - Math.random() * .7) * Math.min(1, long / 3));
      const branch = jagged(from, out, .26 * Math.min(1, long / 3), 3, o.side, o.depth);
      for (let i = 1; i < branch.length; i++) g.burst('glyph', { at: branch[i - 1], to: branch[i], shape: 'line', count: 7, life: [.08, .12], colour: FIGURE_LOOKS.bolt.halo, size: 2 * lit });
    }
    g.burst('arc', { at: a, to: b, shape: 'line', count: 3 * 14, chain: 14, speed: .6, life: [.08, .16], colour: '#fff2a8' });
    g.burst('bloom', { at: b, count: 1, spread: .05, life: [.12, .18], colour: FIGURE_LOOKS.bolt.core, size: 1.1 * lit, light: { intensity: 6 * lit, range: 7, colour: FIGURE_LOOKS.bolt.halo } });
  }

  // ——— Cortocircuito ———
  /**
   * A resistor drawn in his circle, a zigzag between two leads; it flies to the foe and lies across
   * its chest, and snaps in two in a flash: each half turns away and goes out, sparks burst from the
   * break and arcs leap from it over the foe. Where it shorts (`shorts`), the arcs hold on them a moment.
   */
  function cortocircuito(o: { centre: V3; view: V3; to: V3; radius?: number; shorts?: boolean; size?: number }) {
    const f = figure('Cortocircuito', FIGURE_LOOKS.bolt), w = .48 * (o.size ?? 1), amp = .1 * (o.size ?? 1);
    const { facing } = face(f, o.centre, o.view);
    // Two halves, each its own entity, so they can come apart: a lead and half the zigzag each.
    const zig = (from: number, to: number) => { const pts: V3[] = []; for (let k = from; k <= to; k++) { const x = -w / 2 + k / 8 * w; pts.push(xy(x, k === 0 || k === 8 ? 0 : (k % 2 ? amp : -amp))); } return pts; };
    const halves = [-1, 1].map(side => { const e = new pc.Entity(side < 0 ? 'Mitad izquierda' : 'Mitad derecha'); f.body.addChild(e); return e; });
    const left = f.stroke([xy(-w, 0), ...zig(0, 4)], { under: halves[0], radius: .026 }), right = f.stroke([...zig(4, 8), xy(w, 0)], { under: halves[1], radius: .026 });
    const DRAW = .22, FLY = .23, SNAP = .17;
    draw(f, [left, right], DRAW, FIGURE_LOOKS.bolt.core);
    const start = lifted(o.centre, o.view), r = Math.max(.3, o.radius ?? .5), goal = add(o.to, facing, r * .6 + .15);
    const g = gpu();
    play(DRAW + FLY + SNAP + .25, t => {
      const k = smooth((t - DRAW) / FLY), snap = clamp01((t - DRAW - FLY) / SNAP), gone = clamp01((t - DRAW - FLY) / (SNAP + .25));
      const at = mix(start, goal, k);
      f.root.setPosition(at.x, at.y + Math.sin(k * Math.PI) * .35, at.z);
      const grow = 1 + .35 * k; f.root.setLocalScale(grow, grow, grow);
      f.body.setLocalEulerAngles(0, 0, Math.sin(t * 30) * 4 * k);
      // It snaps: each half turns away about its outer end and drifts off.
      halves.forEach((e, i) => { const side = i ? 1 : -1; e.setLocalPosition(side * snap * .22, -snap * snap * .15, 0); e.setLocalEulerAngles(0, 0, -side * 38 * easeOut(snap)); });
      f.glow(1 - gone, t > DRAW + FLY && t < DRAW + FLY + .08 ? 1 : 0);
    }, () => f.destroy());
    after(DRAW + FLY, () => {
      if (!g) return;
      const mid = f.world(xy(0, 0));
      g.burst('bloom', { at: mid, count: 1, spread: .03, life: [.12, .2], colour: FIGURE_LOOKS.bolt.core, size: .9, light: { intensity: 5, range: 5, colour: FIGURE_LOOKS.bolt.halo } });
      g.burst('spark', { at: mid, count: 70, spread: .05, speed: 4.2, up: 1.4, life: [.25, .6], colour: '#fff2a8' });
      g.burst('bipzap', { at: mid, count: 36, spread: .06, speed: 3, life: [.2, .45], colour: FIGURE_LOOKS.bolt.halo });
      // Arcs from the break over the foe: many, and for a while, where it shorts in them.
      const arcs = o.shorts ? 12 : 4;
      for (let i = 0; i < arcs; i++) after(i * .045, () => {
        const a = Math.random() * Math.PI * 2, h = (Math.random() - .3) * r * 1.6, on = { x: o.to.x + Math.cos(a) * r * .8, y: o.to.y + h, z: o.to.z + Math.sin(a) * r * .8 };
        g.burst('arc', { at: i < 3 ? mid : o.to, to: on, shape: 'line', count: 2 * 9, chain: 9, speed: .5, life: [.07, .14], colour: '#fff2a8' });
      });
    });
  }

  // ——— ∂Q/∂t Condensador ———
  /**
   * ∂Q/∂t written in his circle as Leibniz wrote it, ∂Q over ∂t; two plates slide in either side
   * of it and arcs jump between them; then it all draws into whoever uses it (`to`, their chest),
   * where the charge stays (the Cargado look, src/status-fx.ts).
   */
  function condensador(o: { centre: V3; view: V3; to: V3; size?: number }) {
    const f = figure('∂Q/∂t Condensador', FIGURE_LOOKS.bolt), h = .2 * (o.size ?? 1);
    face(f, o.centre, o.view);
    const at = (x0: number, y0: number) => (p: V3) => xy(x0 + p.x * h, y0 + p.y * h);
    // ∂: its tail from the top, down its right side and round its bowl.
    const tail = bezier(xy(.06, .86), xy(.34, 1.02), xy(.58, .74), xy(.52, .26));
    const partial = [...sample(14, tail), ...sample(28, u => xy(.28 + .24 * Math.cos(-u * Math.PI * 2), .26 + .24 * Math.sin(-u * Math.PI * 2))).slice(1)];
    const q = sample(36, u => xy(.3 + .27 * Math.cos(Math.PI / 2 + u * Math.PI * 2), .5 + .48 * Math.sin(Math.PI / 2 + u * Math.PI * 2)));
    const qTail = segment(xy(.36, .2), xy(.64, -.1), 6);
    const tStem = [...segment(xy(.18, 1), xy(.18, .14), 8), ...sample(8, bezier(xy(.18, .14), xy(.18, -.02), xy(.3, -.02), xy(.4, .1))).slice(1)];
    const tBar = segment(xy(0, .66), xy(.38, .66), 5);
    const top = .06, bottom = -.06 - h;
    const strokes = [
      f.stroke(partial.map(at(-.15, top)), { radius: .014 }), f.stroke(q.map(at(.01, top)), { radius: .014 }), f.stroke(qTail.map(at(.01, top)), { radius: .014 }),
      f.stroke(segment(xy(-.21, 0), xy(.21, 0), 8), { radius: .012 }),
      f.stroke(partial.map(at(-.13, bottom)), { radius: .014 }), f.stroke(tStem.map(at(.04, bottom)), { radius: .014 }), f.stroke(tBar.map(at(.04, bottom)), { radius: .014 }),
    ];
    // The plates: one each side, sliding in.
    const plates = [-1, 1].map(side => { const e = new pc.Entity('Placa'); f.body.addChild(e); return { e, side, s: f.stroke(segment(xy(0, -.34), xy(0, .34), 8), { under: e, radius: .02 }) }; });
    const DRAW = .5, PLATES = .12, ARCS = .13, IN = .17;
    draw(f, strokes, DRAW, FIGURE_LOOKS.bolt.core);
    const start = lifted(o.centre, o.view), g = gpu();
    let nextArc = 0;
    play(DRAW + PLATES + ARCS + IN, t => {
      const p = smooth((t - DRAW) / PLATES), k = easeIn((t - DRAW - PLATES - ARCS) / IN);
      plates.forEach(pl => { pl.e.setLocalPosition(pl.side * (.62 - .3 * p), 0, 0); pl.s.show(0, p > 0 ? 1 : 0); });
      if (g && t > DRAW + PLATES * .6 && t < DRAW + PLATES + ARCS && t >= nextArc) {
        nextArc = t + .03;
        const y = (Math.random() - .5) * .5;
        g.burst('arc', { at: f.world(xy(-.32, y)), to: f.world(xy(.32, y + (Math.random() - .5) * .2)), shape: 'line', count: 2 * 8, chain: 8, speed: .4, life: [.05, .1], colour: '#fff2a8' });
      }
      const there = mix(start, o.to, k), size = 1 - .9 * k;
      f.root.setPosition(there.x, there.y, there.z); f.root.setLocalScale(size, size, size);
      f.glow(1, t > DRAW && t < DRAW + PLATES + ARCS ? .4 + .3 * Math.sin(t * 50) : 0);
    }, () => {
      f.destroy();
      g?.burst('bloom', { at: o.to, count: 1, spread: .03, life: [.14, .22], colour: FIGURE_LOOKS.bolt.halo, size: .8, light: { intensity: 3.5, range: 3.5, colour: FIGURE_LOOKS.bolt.halo } });
      g?.burst('spark', { at: o.to, count: 40, spread: .1, speed: 2.4, up: .8, life: [.2, .45], colour: '#fff2a8' });
    });
  }
  /** The charge goes out of whoever carried it into a foe that struck them: lightning from `from` to `to`. */
  function discharge(from: V3, to: V3, view: V3) {
    // It bends across the screen, never towards the camera, where it would look straight.
    const { facing } = screen(view), side = norm(cross(norm(sub(to, from)), facing));
    const span = Math.max(1, len(sub(to, from)));
    lightning(from, to, { side, depth: facing, lit: .8, rough: 1.05 / span, forks: 3, down: false });
    after(.06, () => lightning(from, to, { side, depth: facing, lit: .6, rough: 1.05 / span, forks: 2, down: false }));
    gpu()?.burst('spark', { at: to, count: 60, spread: .1, speed: 4, up: 1.4, life: [.25, .6], colour: '#fff2a8' });
  }
  /** A blow lets the charge go (×2): the capacitor's plates flash over the target, open, and the light bursts out of them. */
  function release(at: V3, view: V3) {
    const f = figure('Suelta la carga', FIGURE_LOOKS.bolt), { facing } = screen(view);
    face(f, add(at, facing, .45), view);
    f.root.setPosition(at.x + facing.x * .45, at.y + facing.y * .45, at.z + facing.z * .45);
    const plates = [-1, 1].map(side => { const e = new pc.Entity('Placa'); f.body.addChild(e); const s = f.stroke(segment(xy(0, -.32), xy(0, .32), 8), { under: e, radius: .024 }); s.show(0, 1); return { e, side }; });
    play(.32, t => {
      const k = easeOut(t / .32);
      plates.forEach(p => p.e.setLocalPosition(p.side * (.08 + .5 * k), 0, 0));
      f.glow(1 - k, 1 - k);
    }, () => f.destroy());
    gpu()?.burst('bloom', { at, count: 1, spread: .03, life: [.15, .24], colour: FIGURE_LOOKS.bolt.core, size: 1.3, light: { intensity: 7, range: 6, colour: FIGURE_LOOKS.bolt.halo } });
    gpu()?.burst('spark', { at, count: 110, spread: .12, speed: 5, up: 1.6, life: [.3, .7], colour: '#fff2a8' });
  }

  // ——— Punto eléctrico ———
  /**
   * A point of charge gathers in front of him, crackling; it rises, slows at the top and falls on
   * `to` (its chest; `feet` under it): lightning, three strikes a breath apart along fresh jagged
   * paths with forks off them, arcs that run on round the foe and down to the floor, sparks that
   * bounce, a white flash.
   */
  function punto(o: { centre: V3; view: V3; to: V3; feet: V3; radius?: number }) {
    const g = gpu();
    if (!g) return;
    const { right, facing } = screen(o.view), from = lifted(o.centre, o.view);
    const GATHER = .2, RISE = .3, FALL = .12;
    const top = add(add(mix(from, o.to, .3), UP, 2.4), right, .2);
    const where = (t: number): V3 => {
      if (t < GATHER) return from;
      if (t < GATHER + RISE) return mix(from, top, easeOut((t - GATHER) / RISE));
      return mix(top, o.to, easeIn((t - GATHER - RISE) / FALL));
    };
    // The point itself: a white-hot bead in a yellow glow, that swells as it gathers and shivers.
    const orb = figure('Punto eléctrico', FIGURE_LOOKS.bolt);
    const bead = lightMaterial('Punto eléctrico · núcleo', FIGURE_LOOKS.bolt.core, 5), aura = lightMaterial('Punto eléctrico · halo', FIGURE_LOOKS.bolt.halo, .5);
    orb.own(undefined, bead); orb.own(undefined, aura);
    const ball = (name: string, material: pc.Material, r: number) => { const e = new pc.Entity(name); e.addComponent('render', { type: 'sphere', material, castShadows: false, receiveShadows: false }); e.setLocalScale(r, r, r); orb.root.addChild(e); return e; };
    ball('Núcleo', bead, .09); const halo = ball('Halo', aura, .3);
    const lights = [
      emit('spellcore', { at: o.centre, shape: 'ball', spread: .02, rate: 260, speed: .25, life: [.06, .16], colour: FIGURE_LOOKS.bolt.halo, size: .9 }),
      emit('spellhaze', { at: o.centre, shape: 'ball', spread: .03, rate: 40, speed: .1, life: [.1, .18], colour: FIGURE_LOOKS.bolt.core, size: 1.2 }),
      emit('spark', { at: o.centre, shape: 'ball', spread: .04, rate: 70, speed: 1.4, life: [.08, .2], colour: '#fff2a8' }),
    ], rates = [260, 40, 70];
    let nextArc = 0;
    play(GATHER + RISE + FALL, t => {
      const at = where(t), grow = smooth(t / GATHER);
      lights.forEach((e, i) => { if (e) { e.at = at; e.rate = rates[i] * grow; } });
      orb.root.setPosition(at.x, at.y, at.z);
      const shiver = 1 + .18 * Math.sin(t * 70) * Math.sin(t * 23), size = (.2 + .8 * easeBack(t / GATHER)) * shiver;
      orb.root.setLocalScale(size, size, size);
      halo.setLocalScale(.3 * shiver, .3 * shiver, .3 * shiver);
      bead.emissiveIntensity = 4 + 2 * Math.abs(Math.sin(t * 41)); bead.update();
      // Little arcs leap off it, a few a second.
      if (t >= nextArc) {
        nextArc = t + .045;
        const dir = norm({ x: Math.random() - .5, y: Math.random() - .5, z: Math.random() - .5 }), reach = .1 + .14 * grow;
        g.burst('arc', { at, to: add(at, dir, reach), shape: 'line', count: 8, chain: 8, speed: .4, life: [.05, .1], colour: '#fff2a8' });
      }
    }, () => {
      lights.forEach(stop); orb.destroy();
      const side = norm(cross(norm(sub(o.to, top)), facing)), depth = facing;
      // Three strikes, each a new path, forking.
      const strike = (n: number) => lightning(add(top, right, (Math.random() - .5) * .3), o.to, { side, depth, lit: n === 0 ? 1 : .7 });
      strike(0);
      after(.07, () => strike(1));
      after(.16, () => strike(2));
      // It runs on: arcs round the foe and to the floor, sparks that bounce, a ring along the floor.
      const r = Math.max(.35, o.radius ?? .5);
      for (let i = 0; i < 7; i++) after(i * .035, () => {
        const a = Math.random() * Math.PI * 2, foot = { x: o.feet.x + Math.cos(a) * r * 1.3, y: o.feet.y + .03, z: o.feet.z + Math.sin(a) * r * 1.3 };
        g.burst('arc', { at: o.to, to: foot, shape: 'line', count: 2 * 10, chain: 10, speed: .5, life: [.07, .14], colour: '#fff2a8' });
      });
      g.burst('spark', { at: o.to, count: 90, spread: .1, speed: 5, up: 2, life: [.3, .7], colour: '#fff2a8' });
      g.burst('bipzap', { at: o.to, count: 60, spread: .12, speed: 3.6, up: .8, life: [.25, .6], colour: FIGURE_LOOKS.bolt.halo });
      g.burst('floorring', { at: { x: o.feet.x, y: o.feet.y + .05, z: o.feet.z }, count: 1, life: [.3, .4], colour: FIGURE_LOOKS.bolt.halo, size: 1.6 });
    });
  }

  return {
    cardioide, piramide, cubo, integral, punto, cortocircuito, condensador, discharge, release,
    /** Runs the figures on, `dt` in fight seconds. */
    update(dt: number) {
      const camera = cameraEntity();
      if (camera) { const p = camera.getPosition(); eye[0] = p.x; eye[1] = p.y; eye[2] = p.z; }
      for (let i = 0; i < tracks.length; i++) {
        const tr = tracks[i];
        tr.t += dt;
        tr.step(Math.min(tr.t, tr.seconds), dt);
        if (tr.t >= tr.seconds) { tracks.splice(i--, 1); tr.done?.(); }
      }
    },
    /** Nothing left of any of them (a fight ending). */
    clear() { tracks.length = 0; [...running].forEach(stop); [...live].forEach(f => f.destroy()); },
    destroy() { this.clear(); neon.destroy(); },
    /** When a figure starts drawing, from the action's start. */
    start: CAST_LAUNCH,
  };
}
export type MathFigures = ReturnType<typeof createMathFigures>;
