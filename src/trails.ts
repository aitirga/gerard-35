import * as pc from 'playcanvas';
import type { Vec } from './particles';

/**
 * Ribbons: light left behind by whatever moves fast (a fist, a lunging head, a spell, a falling
 * stamp). Each trail keeps where its head has been and when; every frame those points become one
 * strip, widest and hottest at the head and fading and thinning with age, and every trail is
 * drawn in a single draw call next to the particles (src/particles.ts, docs/graphics.md).
 */

export interface TrailLook {
  /** Colour at the head and at the tail (sRGB hex). */
  colour?: string | readonly [string, string];
  /** Width at the head, in metres. */
  width?: number;
  /** Seconds a point of the trail lasts, so how far behind a moving head it reaches. */
  life?: number;
  /** How many times brighter than its colour it shines; past white it blooms (src/post.ts). */
  intensity?: number;
  /** 0 covers what is behind it, 1 only adds light. */
  additive?: number;
  /** How white-hot its middle burns, 0–1. */
  core?: number;
  /** How it narrows towards the tail (down to a fifth): 0 keeps its width, 1 narrows evenly, 2 quickly. */
  taper?: number;
  opacity?: number;
  /** Lies flat in the plane with this normal (a blade's arc) instead of facing the camera. */
  normal?: Vec;
}
export interface FollowOptions extends TrailLook {
  /** Where on the entity the trail starts, in its own space (e.g. the tip of a fist). */
  offset?: Vec;
  /** Stops following by itself after this many seconds. */
  seconds?: number;
  /**
   * Keeps the trail in this entity's space (the swinger), so it moves with them: a fist swung
   * while running in draws the arc of the swing, not a streak along the run.
   */
  space?: pc.Entity;
}
export interface CometOptions extends TrailLook {
  /** How high the path arcs over the straight line, in metres, and how far it bends sideways. */
  arc?: number; bend?: number;
  /** Called once when the head arrives. */
  onArrive?: () => void;
}
export interface SpiralOptions extends TrailLook {
  /** Radius at the bottom, how much of it is left at the top, and how high it climbs. */
  radius?: number; narrow?: number; height?: number;
  /** Turns around the centre, and where (radians) it starts. */
  turns?: number; phase?: number;
  /** Seconds the head takes to climb. */
  seconds?: number;
}
/** A trail in flight; `stop()` lets it fade out from where its head is. */
export interface Trail { stop(): void; readonly done: boolean }

interface Look {
  head: [number, number, number]; tail: [number, number, number];
  width: number; life: number; intensity: number; additive: number; core: number; taper: number; opacity: number;
  normal?: [number, number, number];
}
/** A live trail: `tick` moves it on to `now`, `points` writes its centre line head first as x, y, z, age. */
interface Live { look: Look; done: boolean; stopped: boolean; tick(now: number): void; points(now: number, out: Float32Array): number }

const linear = (hex: string): [number, number, number] => { const c = new pc.Color().fromString(hex); return [c.r ** 2.2, c.g ** 2.2, c.b ** 2.2]; };
function compile(look: TrailLook, fallback: Partial<Look> = {}): Look {
  const [head, tail] = typeof look.colour === 'string' ? [look.colour, look.colour] : look.colour ?? ['#fff4da', '#ffc861'];
  const n = look.normal, length = n ? Math.hypot(n.x, n.y, n.z) : 0;
  return {
    head: linear(head), tail: linear(tail), width: look.width ?? fallback.width ?? .14, life: look.life ?? fallback.life ?? .18,
    intensity: look.intensity ?? 2.4, additive: look.additive ?? 1, core: look.core ?? .7, taper: look.taper ?? 1, opacity: look.opacity ?? 1,
    normal: n && length > 1e-6 ? [n.x / length, n.y / length, n.z / length] : undefined,
  };
}

/** Points per path a comet or spiral is drawn with, and the most a recorded trail keeps. */
const PATH_POINTS = 28, KEEP = 48;
/** Catmull–Rom fills recorded segments with a point every this many metres (at most 8 a segment). */
const STEP = .05;
/** Floats per vertex: centre + signed half-width, direction + mode, colour + alpha, along + across + additive + core. */
const STRIDE = 16;

/**
 * A point `f` of the way from p1 to p2 on the centripetal Catmull–Rom curve through p0…p3
 * (x, y, z at offsets `i0`…`i3` of `s`): it neither overshoots nor loops when samples bunch up.
 */
function catmullRom(s: Float32Array, i0: number, i1: number, i2: number, i3: number, f: number, out: Float32Array, o: number) {
  const knot = (a: number, b: number) => Math.max(1e-4, Math.sqrt(Math.hypot(s[b] - s[a], s[b + 1] - s[a + 1], s[b + 2] - s[a + 2])));
  const t1 = knot(i0, i1), t2 = t1 + knot(i1, i2), t3 = t2 + knot(i2, i3), t = t1 + (t2 - t1) * f;
  for (let c = 0; c < 3; c++) {
    const p0 = s[i0 + c], p1 = s[i1 + c], p2 = s[i2 + c], p3 = s[i3 + c];
    const a1 = (t1 - t) / t1 * p0 + t / t1 * p1;
    const a2 = (t2 - t) / (t2 - t1) * p1 + (t - t1) / (t2 - t1) * p2;
    const a3 = (t3 - t) / (t3 - t2) * p2 + (t - t2) / (t3 - t2) * p3;
    const b1 = (t2 - t) / t2 * a1 + t / t2 * a2;
    const b2 = (t3 - t) / (t3 - t1) * a2 + (t - t1) / (t3 - t1) * a3;
    out[o + c] = (t2 - t) / (t2 - t1) * b1 + (t - t1) / (t2 - t1) * b2;
  }
}

/** Recorded samples with a mirrored neighbour at each end, for the curve's first and last segments. */
let padded = new Float32Array((KEEP + 2) * 3);
/**
 * The centre line of a recorded trail, head first: `samples` holds x, y, z, time for `count`
 * samples, oldest first; between them the line follows a Catmull–Rom curve and it ends exactly
 * where its points are `life` seconds old. Writes x, y, z, age into `out` and returns how many.
 */
export function recordedLine(samples: Float32Array, count: number, now: number, life: number, out: Float32Array) {
  if (!count) return 0;
  const max = out.length / 4, cutoff = now - life, last = (count - 1) * 4;
  out[0] = samples[last]; out[1] = samples[last + 1]; out[2] = samples[last + 2]; out[3] = Math.max(0, now - samples[last + 3]);
  if (count < 2 || samples[last + 3] <= cutoff) return 1;
  if (padded.length < (count + 2) * 3) padded = new Float32Array((count + 2) * 3);
  // Sample i sits at slot i + 1; slots 0 and count + 1 mirror the second sample from each end, so the curve leaves straight.
  for (let i = 0; i < count; i++) for (let c = 0; c < 3; c++) padded[(i + 1) * 3 + c] = samples[i * 4 + c];
  for (let c = 0; c < 3; c++) {
    padded[c] = 2 * samples[c] - samples[4 + c];
    padded[(count + 1) * 3 + c] = 2 * samples[last + c] - samples[last - 4 + c];
  }
  let n = 1;
  for (let i = count - 1; i > 0 && n < max; i--) {
    // From the newer sample i back to the older i − 1.
    const t1 = samples[i * 4 + 3], t2 = samples[(i - 1) * 4 + 3];
    const length = Math.hypot(samples[(i - 1) * 4] - samples[i * 4], samples[(i - 1) * 4 + 1] - samples[i * 4 + 1], samples[(i - 1) * 4 + 2] - samples[i * 4 + 2]);
    const steps = Math.max(1, Math.min(8, Math.ceil(length / STEP)));
    for (let k = 1; k <= steps && n < max; k++) {
      let f = k / steps, time = t1 + (t2 - t1) * f;
      const end = time <= cutoff;
      if (end) { f = t1 > t2 ? (t1 - cutoff) / (t1 - t2) : 1; time = cutoff; }
      catmullRom(padded, (i + 2) * 3, (i + 1) * 3, i * 3, (i - 1) * 3, f, out, n * 4);
      out[n * 4 + 3] = now - time; n++;
      if (end) return n;
    }
  }
  return n;
}

/**
 * Turns a centre line (x, y, z, age; head first) into strip vertices from `vertex` on, and
 * returns the vertex after the last. A soft tip runs ahead of the head. With `join`, the
 * previous strip's last vertex and this one's first are repeated, so trails share one strip
 * without bridging (the triangles in between have no area).
 */
export function stripVertices(points: Float32Array, count: number, look: Look, out: Float32Array, vertex: number, join: boolean) {
  if (count < 2 || vertex + (count + 1) * 2 + (join ? 2 : 0) > out.length / STRIDE) return vertex;
  let reserved = -1;
  if (join) { out.copyWithin(vertex * STRIDE, (vertex - 1) * STRIDE, vertex * STRIDE); reserved = vertex + 1; vertex += 2; }
  const tangent = new Float32Array([0, 1, 0]), n = look.normal, k = look.intensity;
  /** Points `i`'s way towards the head; a still point keeps the last direction found. */
  const direction = (i: number) => {
    const a = Math.max(0, i - 1) * 4, b = Math.min(count - 1, i + 1) * 4;
    const x = points[a] - points[b], y = points[a + 1] - points[b + 1], z = points[a + 2] - points[b + 2], l = Math.hypot(x, y, z);
    if (l < 1e-6) return false;
    tangent[0] = x / l; tangent[1] = y / l; tangent[2] = z / l;
    return true;
  };
  const put = (x: number, y: number, z: number, half: number, along: number, side: number, age: number) => {
    const o = vertex++ * STRIDE, a = Math.min(1, age / look.life);
    out[o] = x; out[o + 1] = y; out[o + 2] = z; out[o + 3] = half * side;
    // In a plane the strip spreads along normal × tangent; facing the camera, the shader works it out from the tangent.
    let cx = tangent[0], cy = tangent[1], cz = tangent[2], mode = 0;
    if (n) {
      const ax = n[1] * cz - n[2] * cy, ay = n[2] * cx - n[0] * cz, az = n[0] * cy - n[1] * cx, l = Math.hypot(ax, ay, az);
      if (l > 1e-5) { cx = ax / l; cy = ay / l; cz = az / l; mode = 1; }
    }
    out[o + 4] = cx; out[o + 5] = cy; out[o + 6] = cz; out[o + 7] = mode;
    out[o + 8] = (look.head[0] + (look.tail[0] - look.head[0]) * a) * k;
    out[o + 9] = (look.head[1] + (look.tail[1] - look.head[1]) * a) * k;
    out[o + 10] = (look.head[2] + (look.tail[2] - look.head[2]) * a) * k;
    out[o + 11] = look.opacity;
    out[o + 12] = along; out[o + 13] = side; out[o + 14] = look.additive; out[o + 15] = look.core;
  };
  // A fifth of the width is kept to the end, so the tail fades out rather than thinning into broken pixels.
  const half = (age: number) => look.width * .5 * (.2 + .8 * Math.max(0, 1 - Math.min(1, age / look.life)) ** look.taper);
  for (let i = 0; i < count && !direction(i); i++);
  // The tip: a short, narrower point ahead of the head that fades in to it.
  const h = half(points[3]);
  const tx = points[0] + tangent[0] * h * .8, ty = points[1] + tangent[1] * h * .8, tz = points[2] + tangent[2] * h * .8;
  put(tx, ty, tz, h * .5, -1, -1, points[3]); put(tx, ty, tz, h * .5, -1, 1, points[3]);
  for (let i = 0; i < count; i++) {
    direction(i);
    const p = i * 4, age = points[p + 3], w = half(age), along = Math.min(1, age / look.life);
    put(points[p], points[p + 1], points[p + 2], w, along, -1, age);
    put(points[p], points[p + 1], points[p + 2], w, along, 1, age);
  }
  if (join) out.copyWithin(reserved * STRIDE, (reserved + 1) * STRIDE, (reserved + 2) * STRIDE);
  return vertex;
}

/** The trail shader for WebGL2; `VERTEX_WGSL` and `FRAGMENT_WGSL` below are the same for WebGPU. */
const VERTEX = /* glsl */ `
attribute vec4 aPosition;
attribute vec4 aDirection;
attribute vec4 aColour;
attribute vec4 aLook;
uniform mat4 matrix_viewProjection;
uniform mat4 matrix_view;
varying vec4 vColour;
varying vec4 vLook;
void main(void) {
  vec3 across = aDirection.xyz;
  if (aDirection.w < 0.5) {
    // Facing the camera: spread across the line as it runs on screen.
    vec3 right = vec3(matrix_view[0][0], matrix_view[1][0], matrix_view[2][0]);
    vec3 up = vec3(matrix_view[0][1], matrix_view[1][1], matrix_view[2][1]);
    vec2 onScreen = vec2(dot(aDirection.xyz, right), dot(aDirection.xyz, up));
    float l = length(onScreen);
    vec2 dir = l > 0.00001 ? onScreen / l : vec2(1.0, 0.0);
    across = up * dir.x - right * dir.y;
  }
  vColour = aColour;
  vLook = aLook;
  gl_Position = matrix_viewProjection * vec4(aPosition.xyz + across * aPosition.w, 1.0);
}`;

const FRAGMENT = /* glsl */ `
#include "gammaPS"
#include "tonemappingPS"
#include "fogPS"
varying vec4 vColour;
varying vec4 vLook;
void main(void) {
  float along = vLook.x, across = vLook.y;
  // Soft edges, a tip that fades in ahead of the head, and a tail that fades out with age.
  float edge = 1.0 - across * across;
  float a = edge * edge * smoothstep(-1.0, 0.0, along) * pow(1.0 - clamp(along, 0.0, 1.0), 2.0) * vColour.a;
  if (a < 0.004) discard;
  float core = exp(-across * across * 14.0) * vLook.w * (1.0 - clamp(along, 0.0, 1.0));
  float peak = max(1.0, max(vColour.r, max(vColour.g, vColour.b)));
  vec3 colour = mix(vColour.rgb, vec3(peak), clamp(core, 0.0, 1.0));
  float additive = vLook.z;
  #if (FOG != NONE)
    float fogged = getFogFactor();
    colour = mix(mix(fog_color, colour, fogged), colour * fogged, additive);
  #endif
  colour = gammaCorrectOutput(toneMap(colour));
  gl_FragColor = vec4(colour * a, a * (1.0 - additive));
}`;

/**
 * The same shader in WGSL for WebGPU, line for line with the GLSL above (keep both in step).
 * The engine copies attributes and varyings into globals of the same name; uniforms are read
 * through `uniform.`, the position goes to `output.position` and the colour to `output.color`.
 */
const VERTEX_WGSL = /* wgsl */ `
attribute aPosition: vec4f;
attribute aDirection: vec4f;
attribute aColour: vec4f;
attribute aLook: vec4f;
uniform matrix_viewProjection: mat4x4f;
uniform matrix_view: mat4x4f;
varying vColour: vec4f;
varying vLook: vec4f;
@vertex
fn vertexMain(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;
  var across = aDirection.xyz;
  if (aDirection.w < 0.5) {
    // Facing the camera: spread across the line as it runs on screen.
    let view = uniform.matrix_view;
    let right = vec3f(view[0][0], view[1][0], view[2][0]);
    let up = vec3f(view[0][1], view[1][1], view[2][1]);
    let onScreen = vec2f(dot(aDirection.xyz, right), dot(aDirection.xyz, up));
    let l = length(onScreen);
    let dir = select(vec2f(1.0, 0.0), onScreen / l, l > 0.00001);
    across = up * dir.x - right * dir.y;
  }
  output.vColour = aColour;
  output.vLook = aLook;
  output.position = uniform.matrix_viewProjection * vec4f(aPosition.xyz + across * aPosition.w, 1.0);
  return output;
}`;

const FRAGMENT_WGSL = /* wgsl */ `
#include "gammaPS"
#include "tonemappingPS"
#include "fogPS"
varying vColour: vec4f;
varying vLook: vec4f;
@fragment
fn fragmentMain(input: FragmentInput) -> FragmentOutput {
  var output: FragmentOutput;
  let along = vLook.x; let across = vLook.y;
  // Soft edges, a tip that fades in ahead of the head, and a tail that fades out with age.
  let edge = 1.0 - across * across;
  let a = edge * edge * smoothstep(-1.0, 0.0, along) * pow(1.0 - clamp(along, 0.0, 1.0), 2.0) * vColour.a;
  if (a < 0.004) { discard; }
  let core = exp(-across * across * 14.0) * vLook.w * (1.0 - clamp(along, 0.0, 1.0));
  let peak = max(1.0, max(vColour.r, max(vColour.g, vColour.b)));
  var colour = mix(vColour.rgb, vec3f(peak), clamp(core, 0.0, 1.0));
  let additive = vLook.z;
  #if (FOG != NONE)
    let fogged = getFogFactor();
    colour = mix(mix(uniform.fog_color, colour, fogged), colour * fogged, additive);
  #endif
  colour = gammaCorrectOutput(toneMap(colour));
  output.color = vec4f(colour * a, a * (1.0 - additive));
  return output;
}`;

export function createTrails(app: pc.AppBase, capacity = 4096) {
  const device = app.graphicsDevice;
  const format = new pc.VertexFormat(device, [pc.SEMANTIC_POSITION, pc.SEMANTIC_ATTR11, pc.SEMANTIC_ATTR12, pc.SEMANTIC_ATTR13].map(semantic => ({ semantic, components: 4, type: pc.TYPE_FLOAT32 })));
  const buffer = new pc.VertexBuffer(device, format, capacity, { usage: pc.BUFFER_DYNAMIC });
  const vertices = new Float32Array(buffer.lock() as ArrayBuffer);
  const mesh = new pc.Mesh(device);
  mesh.vertexBuffer = buffer;
  mesh.primitive[0] = { type: pc.PRIMITIVE_TRISTRIP, base: 0, baseVertex: 0, count: 0, indexed: false };
  mesh.aabb = new pc.BoundingBox(new pc.Vec3(), new pc.Vec3(1e4, 1e4, 1e4));
  const material = new pc.ShaderMaterial({
    uniqueName: 'gerard-trails',
    attributes: { aPosition: pc.SEMANTIC_POSITION, aDirection: pc.SEMANTIC_ATTR11, aColour: pc.SEMANTIC_ATTR12, aLook: pc.SEMANTIC_ATTR13 },
    vertexGLSL: VERTEX, fragmentGLSL: FRAGMENT, vertexWGSL: VERTEX_WGSL, fragmentWGSL: FRAGMENT_WGSL,
  });
  material.name = 'Estelas';
  material.blendType = pc.BLEND_PREMULTIPLIED;
  material.depthWrite = false;
  material.cull = pc.CULLFACE_NONE;
  material.update();
  const instance = new pc.MeshInstance(mesh, material);
  instance.cull = false;
  const entity = new pc.Entity('Estelas');
  entity.addComponent('render', { meshInstances: [instance], castShadows: false, receiveShadows: false });
  entity.enabled = false;
  app.root.addChild(entity);

  const live: Live[] = [];
  const line = new Float32Array(256 * 4);
  let time = 0, count = 0, enabled = true;
  const handle = (t: Live): Trail => ({ stop() { t.stopped = true; }, get done() { return t.done; } });
  const none: Trail = { stop() {}, done: true };

  /** A trail whose head is wherever `where` says now; its past is recorded as it goes. */
  function record(where: (out: pc.Vec3) => boolean, look: Look, seconds = Infinity, space?: pc.Entity): Trail {
    if (!enabled) return none;
    const samples = new Float32Array(KEEP * 4), p = new pc.Vec3(), born = time, inverse = new pc.Mat4();
    let n = 0;
    const t: Live = {
      look, done: false, stopped: false,
      tick(now) {
        if (now - born >= seconds) t.stopped = true;
        if (!t.stopped && (!where(p) || (space && !space.parent))) t.stopped = true;
        if (!t.stopped) {
          if (space) inverse.copy(space.getWorldTransform()).invert().transformPoint(p, p);
          const last = (n - 1) * 4;
          // Standing still only moves the head's time on, so the trail shrinks into it.
          if (n && Math.hypot(p.x - samples[last], p.y - samples[last + 1], p.z - samples[last + 2]) < 1e-4) samples[last + 3] = now;
          else {
            if (n === KEEP) { samples.copyWithin(0, 4); n--; }
            const o = n++ * 4;
            samples[o] = p.x; samples[o + 1] = p.y; samples[o + 2] = p.z; samples[o + 3] = now;
          }
        }
        // Drop what is older than `life`, keeping one sample past it to end the line on.
        let old = 0;
        while (old + 1 < n && samples[(old + 1) * 4 + 3] <= now - look.life) old++;
        if (old) { samples.copyWithin(0, old * 4, n * 4); n -= old; }
        t.done = t.stopped && (!n || samples[(n - 1) * 4 + 3] <= now - look.life);
      },
      points(now, out) {
        // Gone with its swinger: nothing to draw it in.
        if (space && !space.parent) return 0;
        const count = recordedLine(samples, n, now, look.life, out);
        if (space) {
          const world = space.getWorldTransform();
          for (let i = 0; i < count; i++) {
            world.transformPoint(p.set(out[i * 4], out[i * 4 + 1], out[i * 4 + 2]), p);
            out[i * 4] = p.x; out[i * 4 + 1] = p.y; out[i * 4 + 2] = p.z;
          }
        }
        return count;
      },
    };
    live.push(t); t.tick(time);
    return handle(t);
  }
  /** A trail whose head runs along `path` (0 → 1) in `seconds`; drawn from the path itself, so it stays smooth at any frame rate. */
  function along(path: (f: number, out: pc.Vec3) => void, seconds: number, look: Look, onArrive?: () => void): Trail {
    if (!enabled) return none;
    const born = time, p = new pc.Vec3(), duration = Math.max(.01, seconds);
    let arrived = false;
    const t: Live = {
      look, done: false, stopped: false,
      tick(now) {
        const age = now - born;
        if (!arrived && age >= duration) { arrived = true; onArrive?.(); }
        t.done = t.stopped || age >= duration + look.life;
      },
      points(now, out) {
        const age = now - born, head = Math.min(age, duration), tail = Math.max(0, age - look.life);
        if (head <= tail) return 0;
        const n = Math.min(out.length / 4, PATH_POINTS);
        for (let i = 0; i < n; i++) {
          const at = head + (tail - head) * i / (n - 1);
          path(at / duration, p);
          out[i * 4] = p.x; out[i * 4 + 1] = p.y; out[i * 4 + 2] = p.z; out[i * 4 + 3] = age - at;
        }
        return n;
      },
    };
    live.push(t);
    return handle(t);
  }

  return {
    /**
     * Light streaming from `source` (an entity, at `offset` in its own space, or any point kept
     * up to date) until `stop()` or `seconds`. A destroyed or disabled entity ends it.
     */
    follow(source: pc.Entity | pc.Vec3, options: FollowOptions = {}): Trail {
      const offset = options.offset ? new pc.Vec3(options.offset.x, options.offset.y, options.offset.z) : undefined;
      const where = source instanceof pc.Entity
        ? (out: pc.Vec3) => {
          if (!source.enabled || !source.parent) return false;
          if (offset) source.getWorldTransform().transformPoint(offset, out); else out.copy(source.getPosition());
          return true;
        }
        : (out: pc.Vec3) => { out.copy(source); return true; };
      return record(where, compile(options), options.seconds, options.space);
    },
    /** A comet from `from` to `to` in `seconds`, arcing `arc` metres over the straight line. */
    comet(from: Vec, to: Vec, colour: string | readonly [string, string], seconds = .35, options: CometOptions = {}): Trail {
      const a = new pc.Vec3(from.x, from.y, from.z), b = new pc.Vec3(to.x, to.y, to.z), distance = a.distance(b);
      const arc = options.arc ?? distance * .22, bend = options.bend ?? 0;
      // Sideways is across the line on the ground, so a bend never tips the arc over.
      const side = new pc.Vec3(-(b.z - a.z), 0, b.x - a.x).normalize();
      const look = compile({ life: Math.min(.3, seconds * .7), width: .16, taper: 1.3, ...options, colour });
      return along((f, out) => {
        const e = 1 - (1 - f) ** 1.6, lift = Math.sin(e * Math.PI);
        out.lerp(a, b, e);
        out.y += lift * arc; out.x += side.x * lift * bend; out.z += side.z * lift * bend;
      }, seconds, look, options.onArrive);
    },
    /** A strand of light climbing round `centre` (on the floor), narrowing as it rises: an ánima waking. */
    spiral(centre: Vec, colour: string | readonly [string, string], options: SpiralOptions = {}): Trail {
      const { radius = .7, narrow = .45, height = 2, turns = 1.6, phase = 0, seconds = .9 } = options;
      const look = compile({ life: seconds * .45, width: .12, taper: .8, ...options, colour });
      return along((f, out) => {
        const e = 1 - (1 - f) ** 1.4, angle = phase + e * turns * Math.PI * 2, r = radius * (1 - (1 - narrow) * e);
        out.set(centre.x + Math.cos(angle) * r, centre.y + e * height, centre.z + Math.sin(angle) * r);
      }, seconds, look);
    },
    /** How many vertices the last frame drew, and how many trails are alive. */
    get stats() { return { vertices: count, trails: live.length }; },
    /** Off (reduced motion): every trail ends and new ones are not drawn. */
    set enabled(on: boolean) { enabled = on; if (!on) this.clear(); },
    get enabled() { return enabled; },
    update(dt: number) {
      time += dt;
      count = 0;
      for (let i = live.length - 1; i >= 0; i--) { live[i].tick(time); if (live[i].done) live.splice(i, 1); }
      for (const t of live) count = stripVertices(line, t.points(time, line), t.look, vertices, count, count > 0);
      if (count) buffer.unlock(0, count * STRIDE * 4);
      mesh.primitive[0].count = count;
      entity.enabled = count > 0;
    },
    /** Ends every trail in flight. */
    clear() { live.length = 0; count = 0; mesh.primitive[0].count = 0; entity.enabled = false; },
    destroy() { entity.destroy(); mesh.destroy(); material.destroy(); live.length = 0; },
  };
}
export type Trails = ReturnType<typeof createTrails>;
