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
  // Soft particles: the scene's linear depth, for particles to fade where they meet it.
  frame.rendering.sceneDepthMap = LOOK.softParticles;
  frame.update();
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
    /** Turns the whole pass off (the camera renders straight to the screen) or back on. */
    set enabled(on: boolean) { frame.enabled = on; if (on) frame.update(); },
    get enabled() { return frame.enabled; },
    destroy() { frame.destroy(); },
  };
}
