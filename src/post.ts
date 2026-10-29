import * as pc from 'playcanvas';

/**
 * The look after the scene is drawn (PlayCanvas's CameraFrame): the scene renders in HDR with
 * 4× MSAA, whatever shines brighter than white (lamps, sparks, flames, her pink eyes) blooms,
 * ACES tone-maps it at the end, and the corners darken a little. La Reina Bubbaloo's light
 * (`setTone`) pulls that vignette to her pink and the colours a touch richer (docs/graphics.md).
 */
export const LOOK = {
  /** MSAA samples for the HDR scene; 2 halves the memory on a weak GPU at retina sizes. */
  samples: 4,
  /** How much of the glow is added back, how wide it spreads and how bright a pixel must be to glow (linear). */
  bloom: { intensity: .045, blurLevel: 12, threshold: 1.15 },
  vignette: { intensity: .32, inner: .55, outer: 1.25, curvature: .6 },
  bubbaloo: { vignette: new pc.Color(.07, 0, .035), saturation: 1.12 },
  /** Soft particles: a depth prepass of the opaque scene that particles fade against (src/particles.ts). */
  softParticles: true,
  // ── Tilt-shift and contact shadows (`setupDepthLook`) ──────────────────────────────────────
  /**
   * Tilt-shift: the engine's depth of field, focused each frame on what the camera follows.
   * `band` is the depth kept sharp, in units of `orthoHeight` so it frames the same share of the
   * screen at any zoom; the blur then grows over that depth again up to `blur` (pixels at 540
   * tall, any resolution). Fights widen the band to every fighter plus `margin` metres.
   */
  tiltShift: {
    enabled: true,
    follow: { band: .55, blur: 2.4 },
    overview: { band: .42, blur: 3 },
    fight: { band: .55, blur: 2.4, margin: 1.2 },
  },
  /**
   * Contact shadows (the engine's SSAO, made orthographic in `orthoSsao`): darker creases where
   * walls meet floors, under furniture, cars and feet. `radius` is in metres, `scale` the
   * resolution it runs at (half is indistinguishable here). `lighting` would darken only the
   * ambient light instead of the final colour: more physical, but too faint under our sun.
   */
  ssao: { enabled: true, lighting: false, radius: .9, intensity: .8, power: 2, samples: 12, minAngle: 10, scale: .5, blur: true },
  // ────────────────────────────────────────────────────────────────────────────────────────────
} as const;

/**
 * Half an 8-bit step of noise on the final colour, in display space, so the shallow gradients of
 * lamp light and dusk sky don't step into bands on an 8-bit screen. Runs after tone mapping, in
 * the compose pass's end hook, in both shader languages.
 */
const DITHER = {
  glsl: `
    float ditherNoise = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
    result = pow(max(pow(max(result, vec3(0.0)), vec3(1.0 / 2.2)) + (ditherNoise - 0.5) / 255.0, vec3(0.0)), vec3(2.2));`,
  wgsl: `
    let ditherNoise = fract(52.9829189 * fract(dot(pcPosition.xy, vec2f(0.06711056, 0.00583715))));
    result = pow(max(pow(max(result, vec3f(0.0)), vec3f(1.0 / 2.2)) + (ditherNoise - 0.5) / 255.0, vec3f(0.0)), vec3f(2.2));`,
};

export function createPost(app: pc.AppBase, camera: pc.CameraComponent) {
  pc.ShaderChunks.get(app.graphicsDevice, pc.SHADERLANGUAGE_GLSL).set('composeMainEndPS', DITHER.glsl);
  pc.ShaderChunks.get(app.graphicsDevice, pc.SHADERLANGUAGE_WGSL).set('composeMainEndPS', DITHER.wgsl);
  const frame = new pc.CameraFrame(app, camera);
  frame.rendering.samples = LOOK.samples;
  // 16-bit float, not the default 11/11/10: its 6-bit mantissas band the flat's lamp light and the dusk sky.
  frame.rendering.renderFormats = [pc.PIXELFORMAT_RGBA16F, pc.PIXELFORMAT_RGBA32F];
  frame.rendering.toneMapping = pc.TONEMAP_ACES;
  Object.assign(frame.bloom, LOOK.bloom);
  Object.assign(frame.vignette, LOOK.vignette);
  frame.grading.enabled = true;
  // The scene's linear depth for soft particles; tilt-shift and contact shadows need the same
  // prepass and share it, so this switch only saves its cost when both of those are off too.
  frame.rendering.sceneDepthMap = LOOK.softParticles;
  const depth = setupDepthLook(app, frame, camera);
  let tone = -1;
  const linear = new pc.Color();
  return {
    frame,
    /**
     * The background colour to give the camera for `colour` as the eye should see it: the HDR
     * buffer is linear and gamma-encoded at the end, so a straight sRGB clear would come out paler.
     */
    clear(colour: pc.Color) {
      return frame.enabled ? linear.set(colour.r ** 2.2, colour.g ** 2.2, colour.b ** 2.2, colour.a) : colour;
    },
    /** 0 is the scene's own light, 1 La Reina Bubbaloo's. */
    setTone(k: number) {
      if (Math.abs(k - tone) < .002) return;
      tone = k;
      frame.vignette.color.lerp(pc.Color.BLACK, LOOK.bubbaloo.vignette, k);
      frame.grading.saturation = pc.math.lerp(1, LOOK.bubbaloo.saturation, k);
      frame.update();
    },
    // ── Tilt-shift and contact shadows ──
    focus: depth.focus,
    /** The tilt-shift on or off (development builds switch it to compare). */
    set tiltShift(on: boolean) { depth.tiltShift = on; depth.apply(); },
    get tiltShift() { return depth.tiltShift; },
    /** Contact shadows on or off (development builds switch them to compare). */
    set ssao(on: boolean) { depth.ssao = on; depth.apply(); },
    get ssao() { return depth.ssao; },
    // ──
    /** Turns the whole pass off (the camera renders straight to the screen) or back on. */
    set enabled(on: boolean) { frame.enabled = on; if (on) frame.update(); },
    get enabled() { return frame.enabled; },
    destroy() { frame.destroy(); },
  };
}

// ── Tilt-shift and contact shadows ──────────────────────────────────────────────────────────

/** A focus point for the tilt-shift: feet, and how tall what stands there is. */
export interface FocusPoint { x: number; y: number; z: number; height: number }

/**
 * Both read the scene depth (a depth prepass, since an MSAA scene can't sample its own), which
 * the engine linearises for an orthographic camera too. The depth of field works as it is: its
 * circle of confusion comes from that linear depth, so with the sharp plane through Gerard the
 * ground blurs above and below him on screen like a photographed miniature, and tall things go
 * soft by their true distance rather than by where they sit on screen. SSAO does not: it rebuilds
 * view-space positions for a perspective camera, which `orthoSsao` fixes.
 */
function setupDepthLook(app: pc.AppBase, frame: pc.CameraFrame, camera: pc.CameraComponent) {
  const device = app.graphicsDevice;
  /** The frame's live passes (private in the typings): rebuilt whenever its options change. */
  const passes = () => (frame as unknown as { renderPassCamera: { dofPass?: pc.FramePassDof | null; ssaoPass?: pc.RenderPassSsao | null } | null }).renderPassCamera;
  // The engine rebuilds its passes on any option change (and when layers change, mid-frame), so
  // the orthographic SSAO goes back in after every update.
  const update = frame.update.bind(frame);
  frame.update = () => {
    update();
    if (!orthoSsao(device, camera, passes()?.ssaoPass)) { state.ssao = false; state.apply(); }
  };
  const forward = new pc.Vec3(), at = new pc.Vec3();
  const state = {
    tiltShift: LOOK.tiltShift.enabled as boolean,
    ssao: LOOK.ssao.enabled as boolean,
    /** Pushes the switches and `LOOK` into the frame (rebuilding its passes if they changed). */
    apply() {
      Object.assign(frame.dof, { enabled: state.tiltShift, nearBlur: true, highQuality: true, blurRings: 4, blurRingPoints: 5 });
      const { enabled, lighting, blur, ...ssao } = LOOK.ssao;
      frame.ssao.type = state.ssao ? lighting ? pc.SSAOTYPE_LIGHTING : pc.SSAOTYPE_COMBINE : pc.SSAOTYPE_NONE;
      frame.ssao.blurEnabled = blur;
      Object.assign(frame.ssao, ssao);
      frame.update();
    },
    /**
     * Puts the sharp band through `points` (Gerard, the fighters, a cut-scene's subject): each
     * stays sharp whatever the zoom, and the blur grows with distance from them in depth. Call it
     * once a frame after the camera has moved.
     */
    focus(points: readonly FocusPoint[], mode: 'follow' | 'overview' | 'fight') {
      if (!frame.enabled || !points.length) return;
      // Orthographic SSAO needs the height of the view, which follows the zoom.
      device.scope.resolve('uOrthoSize').setValue(camera.orthoHeight * 2);
      const dof = passes()?.dofPass;
      if (!dof) return;
      const look: { band: number; blur: number; margin?: number } = LOOK.tiltShift[mode], eye = camera.entity.getPosition();
      forward.copy(camera.entity.forward);
      let near = Infinity, far = -Infinity;
      for (const p of points) for (const y of [p.y, p.y + p.height]) {
        const d = at.set(p.x, y, p.z).sub(eye).dot(forward);
        near = Math.min(near, d); far = Math.max(far, d);
      }
      frame.dof.focusDistance = dof.focusDistance = (near + far) / 2;
      frame.dof.focusRange = dof.focusRange = Math.max(look.band * camera.orthoHeight, far - near + (look.margin ?? 0) * 2);
      frame.dof.blurRadius = dof.blurRadius = look.blur;
    },
  };
  device.scope.resolve('uOrthoSize').setValue(camera.orthoHeight * 2);
  state.apply();
  return state;
}

const patched = new WeakSet<object>();
/** The lines `orthoSsao` swaps in the engine's SSAO shader, in GLSL and in WGSL (keep both in step). */
const ORTHO_SSAO: Record<'glsl' | 'wgsl', [string, string][]> = {
  glsl: [
    ['uniform float uAspect;', 'uniform float uAspect;\nuniform float uOrthoSize;'],
    ['(0.5 - uv) * vec2(uAspect, 1.0) * linearDepth,', '(uv - 0.5) * vec2(uAspect, 1.0) * uOrthoSize,'],
    ['-(uProjectionScaleRadius / origin.z)', '(uProjectionScaleRadius / uOrthoSize)'],
  ],
  wgsl: [
    ['uniform uAspect: f32;', 'uniform uAspect: f32;\nuniform uOrthoSize: f32;'],
    ['(0.5 - uv) * vec2f(uniform.uAspect, 1.0) * linearDepth,', '(uv - 0.5) * vec2f(uniform.uAspect, 1.0) * uniform.uOrthoSize,'],
    ['-(uniform.uProjectionScaleRadius / origin.z)', '(uniform.uProjectionScaleRadius / uniform.uOrthoSize)'],
  ],
};
/**
 * The engine's SSAO rebuilds a pixel's view-space position as if seen through a perspective lens
 * (sideways offsets growing with depth). Under our orthographic camera that stretches the scene
 * sideways about five times and shears it by depth, so occlusion comes out faint and smeared.
 * Two lines change: positions use the view's real size (`uOrthoSize`, 2 × orthoHeight) and the
 * sampling disk is sized by it instead of by depth. Returns false if the engine's shader no
 * longer has those lines, so the caller turns SSAO off rather than show it wrong.
 */
function orthoSsao(device: pc.GraphicsDevice, camera: pc.CameraComponent, pass: pc.RenderPassShaderQuad | null | undefined) {
  if (!pass || patched.has(pass)) return true;
  patched.add(pass);
  const language = device.isWebGPU ? pc.SHADERLANGUAGE_WGSL : pc.SHADERLANGUAGE_GLSL;
  const chunks = pc.ShaderChunks.get(device, language);
  if (!chunks.has('ssaoOrthoPS')) {
    let source = chunks.get('ssaoPS') ?? '';
    for (const [from, to] of ORTHO_SSAO[language === pc.SHADERLANGUAGE_WGSL ? 'wgsl' : 'glsl']) {
      if (!source.includes(from)) { console.warn('SSAO: the orthographic patch no longer fits the engine; contact shadows are off'); return false; }
      source = source.replace(from, to);
    }
    chunks.set('ssaoOrthoPS', source);
  }
  const defines = new Map<string, string>();
  const key = pc.ShaderUtils.addScreenDepthChunkDefines(camera.shaderParams, defines);
  pass.shader = pc.ShaderUtils.createShader(device, {
    uniqueName: `SsaoOrthoShader${key}`, attributes: { aPosition: pc.SEMANTIC_POSITION },
    vertexChunk: 'quadVS', fragmentChunk: 'ssaoOrthoPS', fragmentDefines: defines,
  });
  return true;
}
