import * as pc from 'playcanvas';

/**
 * The field played back (Da capo's look, docs/animas/sincopante/README.md § Look; docs/graphics.md § The field played
 * back), on the fight's GPU particle engine (src/fight-particles.ts) and nowhere else.
 *
 * - **The tape.** Every `TAPE.every` seconds of the fight a pass copies where a sparse share of the engine's particles
 *   are (`TAPE.samples` of its slots, evenly strided) into one row of a float texture, and whether each is alive. The
 *   last `TAPE.keep` of them are kept, a ring: some six seconds of everything that moved on the field. The CPU only
 *   says when; it never reads a position.
 * - **Played back.** `play` draws those samples again as short streaks of nácar running along their own recorded
 *   paths from now back to the start of the tape, the tape speeding up as it goes. A sample alive at both ends of a
 *   stretch is drawn there; one born or gone in it is not. While it plays the tape is held (it plays what was).
 *
 * Nácar: white, sea foam (#8fe3c4) and pale gold, the ecos' own (src/eco-fx.ts `ECO`). Never pink nor violet
 * (docs/visual-style.md).
 */
export const TAPE = { samples: 16384, width: 512, every: .1, keep: 60 } as const;
const ROWS = TAPE.samples / TAPE.width;

/** The recording pass: one slot's rows of the tape, every other row left as it was (`discard`). */
const recordWgsl = (W: number, H: number, N: number) => /* wgsl */ `
var uState: texture_2d<uff>;
uniform uSlot: f32;
varying vUv0: vec2f;
@fragment
fn fragmentMain(input: FragmentInput) -> FragmentOutput {
  var output: FragmentOutput;
  let fc = vec2i(pcPosition.xy);
  if (fc.y / ${ROWS} != i32(uniform.uSlot)) { discard; }
  let sid = (fc.y % ${ROWS}) * ${TAPE.width} + fc.x;
  // Evenly strided over the pool, a little off the stride so it never falls on every batch's first slot alone.
  let stride = ${N / TAPE.samples};
  let index = (sid * stride + (sid * 5) % stride) % ${N};
  let a = textureLoad(uState, vec2i(index % ${W}, index / ${W}), 0);
  let b = textureLoad(uState, vec2i(index % ${W}, index / ${W} + ${H}), 0);
  let alive = b.w > 0.0 && a.w < b.w;
  output.color = vec4f(a.xyz, select(0.0, 1.0, alive));
  return output;
}`;

/** The playback: a streak per sample, from where it was at the playhead to where it was a little later (it runs back along it). */
const PLAY_VS = /* wgsl */ `
attribute vertex_position: vec3f;
attribute aIndex: vec4f;
uniform matrix_viewProjection: mat4x4f;
uniform matrix_view: mat4x4f;
uniform uPlay: vec4f;
uniform uLook: vec4f;
var uTape: texture_2d<uff>;
varying vUv: vec2f;
varying vColour: vec4f;
fn tapeAt(slot: i32, sid: i32) -> vec4f { return textureLoad(uTape, vec2i(sid % ${TAPE.width}, slot * ${ROWS} + sid / ${TAPE.width}), 0); }
// Where sample sid was 'ago' recordings before the newest (fractional), and whether it was alive there.
fn heldAt(ago: f32, sid: i32) -> vec4f {
  let newest = i32(uniform.uPlay.y); let kept = uniform.uPlay.z;
  let a = clamp(ago, 0.0, max(kept - 1.0, 0.0));
  let i0 = floor(a); let f = a - i0;
  let i1 = min(i0 + 1.0, max(kept - 1.0, 0.0));
  let s0 = (newest - i32(i0) + ${TAPE.keep * 4}) % ${TAPE.keep};
  let s1 = (newest - i32(i1) + ${TAPE.keep * 4}) % ${TAPE.keep};
  let p0 = tapeAt(s0, sid); let p1 = tapeAt(s1, sid);
  return vec4f(mix(p0.xyz, p1.xyz, f), min(p0.w, p1.w));
}
fn hash1(n: f32) -> f32 { return fract(sin(n * 12.9898) * 43758.5453); }
@vertex
fn vertexMain(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;
  let sid = i32(aIndex.x);
  let k = clamp(uniform.uPlay.x, 0.0, 1.0);
  let kept = uniform.uPlay.z;
  // The tape speeds up: slow off the mark, fast at the end.
  let ago = (kept - 1.0) * k * k * (0.6 + 0.4 * k);
  let head = heldAt(ago, sid);
  let tail = heldAt(max(ago - 1.6 - 3.0 * k, 0.0), sid);
  let span = tail.xyz - head.xyz;
  let len = length(span);
  if (head.w < 0.5 || tail.w < 0.5 || len > 4.0 || kept < 2.0) {
    output.position = vec4f(2.0, 2.0, 2.0, 1.0); output.vUv = vec2f(0.0); output.vColour = vec4f(0.0);
    return output;
  }
  let view = uniform.matrix_view;
  let right = vec3f(view[0][0], view[1][0], view[2][0]);
  let up = vec3f(view[0][1], view[1][1], view[2][1]);
  let back = vec3f(view[0][2], view[1][2], view[2][2]);
  var along = select(right, span / max(len, 1e-5), len > 1e-4);
  var across = normalize(cross(along, back));
  if (length(cross(along, back)) < 1e-4) { across = up; }
  let corner = vertex_position.xy;
  let width = uniform.uLook.x * (0.7 + 0.6 * hash1(f32(sid)));
  let reach = max(len, width * 2.0) * 0.5;
  let mid = head.xyz + along * reach;
  let world = mid + along * (corner.x * reach) + across * (corner.y * width);
  // Nácar: white, sea foam and pale gold, each sample its own, whiter as the tape speeds up.
  let h = hash1(f32(sid) * 1.7 + 3.1);
  let foam = vec3f(0.27, 0.77, 0.56); let gold = vec3f(0.89, 0.76, 0.40); let white = vec3f(1.0, 0.98, 0.93);
  var colour = select(mix(white, foam, h * 2.0), mix(white, gold, (h - 0.5) * 2.0), h > 0.5);
  colour = mix(colour, white, k * 0.5) * uniform.uLook.y;
  let fade = smoothstep(0.0, 0.12, k) * (1.0 - smoothstep(0.82, 1.0, k)) * uniform.uLook.z;
  output.vUv = corner;
  output.vColour = vec4f(colour, fade);
  output.position = uniform.matrix_viewProjection * vec4f(world, 1.0);
  return output;
}`;

const PLAY_FS = /* wgsl */ `
#include "gammaPS"
#include "tonemappingPS"
varying vUv: vec2f;
varying vColour: vec4f;
@fragment
fn fragmentMain(input: FragmentInput) -> FragmentOutput {
  var output: FragmentOutput;
  // A soft thread, brightest at its head (where it is going back to) and thinning to its tail.
  let across = exp(-vUv.y * vUv.y * 5.0);
  let ends = smoothstep(1.0, 0.7, abs(vUv.x));
  let headward = mix(1.0, 0.35, clamp(vUv.x * 0.5 + 0.5, 0.0, 1.0));
  let a = across * ends * headward * vColour.a;
  if (a < 0.003) { discard; }
  let colour = gammaCorrectOutput(toneMap(vColour.rgb));
  output.color = vec4f(colour * a, 0.0);
  return output;
}`;

/** The tape and its playback on `app`'s device, for a pool of `W` × `H` slots a band (the engine's own layout). */
export function createRewindField(app: pc.AppBase, W: number, H: number) {
  const device = app.graphicsDevice, N = W * H;
  const tape = new pc.Texture(device, {
    name: 'Cinta del campo', width: TAPE.width, height: ROWS * TAPE.keep, format: pc.PIXELFORMAT_RGBA32F, mipmaps: false,
    minFilter: pc.FILTER_NEAREST, magFilter: pc.FILTER_NEAREST, addressU: pc.ADDRESS_CLAMP_TO_EDGE, addressV: pc.ADDRESS_CLAMP_TO_EDGE,
  });
  { const out = tape.lock() as Float32Array; out.fill(0); tape.unlock(); }
  const target = new pc.RenderTarget({ colorBuffer: tape, depth: false });
  const recorder = pc.ShaderUtils.createShader(device, {
    uniqueName: 'gerard-rewind-field-record', attributes: { vertex_position: pc.SEMANTIC_POSITION },
    vertexChunk: 'fullscreenQuadVS', fragmentWGSL: recordWgsl(W, H, N), fragmentOutputTypes: 'vec4',
  });
  const scope = device.scope, uState = scope.resolve('uState'), uSlot = scope.resolve('uSlot');

  const quad = new pc.Mesh(device);
  quad.setPositions(new Float32Array([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0]));
  quad.setIndices([0, 1, 2, 0, 2, 3]);
  quad.update();
  const format = new pc.VertexFormat(device, [{ semantic: pc.SEMANTIC_ATTR10, components: 4, type: pc.TYPE_FLOAT32 }]);
  const ids = new Float32Array(TAPE.samples * 4);
  for (let i = 0; i < TAPE.samples; i++) ids[i * 4] = i;
  const buffer = new pc.VertexBuffer(device, format, TAPE.samples, { data: ids.buffer });
  const material = new pc.ShaderMaterial({
    uniqueName: 'gerard-rewind-field-play', attributes: { vertex_position: pc.SEMANTIC_POSITION, aIndex: pc.SEMANTIC_ATTR10 },
    vertexWGSL: PLAY_VS, fragmentWGSL: PLAY_FS,
  });
  material.name = 'Campo rebobinado';
  material.blendType = pc.BLEND_PREMULTIPLIED;
  material.depthWrite = false;
  material.cull = pc.CULLFACE_NONE;
  material.setParameter('uTape', tape);
  const play4 = new Float32Array(4), look4 = new Float32Array([.012, 2.2, 1, 0]);
  material.setParameter('uPlay', play4); material.setParameter('uLook', look4);
  material.update();
  const instance = new pc.MeshInstance(quad, material);
  instance.setInstancing(buffer);
  instance.instancingCount = TAPE.samples;
  instance.cull = false;
  const entity = new pc.Entity('Campo rebobinado');
  entity.addComponent('render', { meshInstances: [instance], castShadows: false, receiveShadows: false });
  entity.enabled = false;
  app.root.addChild(entity);

  /** The newest slot written, how many are kept, the seconds since the last, and what plays now. */
  let newest = -1, kept = 0, since: number = TAPE.every;
  let playing: { t: number; seconds: number; after: number } | undefined;
  return {
    /** Recordings on the tape now (development and tests). */
    get kept() { return kept; },
    /** Whether it is playing back. */
    get playing() { return !!playing; },
    /**
     * Each step of the engine, after its simulation (`state`: the state it just wrote): a recording when its time has
     * come, unless the tape is being played; and the playback moved on by `dt`.
     */
    update(dt: number, state: pc.Texture) {
      if (playing) {
        playing.t += dt;
        const k = (playing.t - playing.after) / playing.seconds;
        entity.enabled = k > 0 && k < 1;
        play4[0] = Math.max(0, k); play4[1] = newest; play4[2] = kept;
        material.setParameter('uPlay', play4);
        if (k >= 1) { playing = undefined; entity.enabled = false; since = TAPE.every; }
        return;
      }
      since += dt;
      if (dt <= 0 || since < TAPE.every) return;
      since = 0;
      newest = (newest + 1) % TAPE.keep; kept = Math.min(TAPE.keep, kept + 1);
      uState.setValue(state); uSlot.setValue(newest);
      pc.drawQuadWithShader(device, target, recorder, undefined, undefined, 'Cinta del campo');
    },
    /** Plays the tape back over `seconds`, `after` seconds from now; `width` (m) and `intensity` its streaks'. */
    play(o: { seconds?: number; after?: number; width?: number; intensity?: number } = {}) {
      if (kept < 2) return false;
      playing = { t: 0, seconds: Math.max(.1, o.seconds ?? .6), after: Math.max(0, o.after ?? 0) };
      look4[0] = o.width ?? .012; look4[1] = o.intensity ?? 2.2;
      material.setParameter('uLook', look4);
      return true;
    },
    /** The fight ended: the tape is wiped. */
    clear() { newest = -1; kept = 0; since = TAPE.every; playing = undefined; entity.enabled = false; },
    destroy() { entity.destroy(); target.destroy(); tape.destroy(); buffer.destroy(); quad.destroy(); material.destroy(); },
  };
}
export type RewindField = ReturnType<typeof createRewindField>;
