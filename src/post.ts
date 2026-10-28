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
} as const;

export function createPost(app: pc.AppBase, camera: pc.CameraComponent) {
  const frame = new pc.CameraFrame(app, camera);
  frame.rendering.samples = LOOK.samples;
  frame.rendering.toneMapping = pc.TONEMAP_ACES;
  Object.assign(frame.bloom, LOOK.bloom);
  Object.assign(frame.vignette, LOOK.vignette);
  frame.grading.enabled = true;
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
