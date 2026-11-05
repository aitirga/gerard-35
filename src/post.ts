import * as pc from 'playcanvas';
import { createGrading } from './grading.ts';

/**
 * The look after the scene is drawn (PlayCanvas's CameraFrame): the scene renders in HDR with
 * 4× MSAA, whatever shines brighter than white (lamps, sparks, flames, her pink eyes) blooms,
 * ACES tone-maps it at the end, and the corners darken a little. Each scene has its colour grade
 * (src/grading.ts), and La Reina Bubbaloo's light (`setTone`) blends in her own and pulls that
 * vignette to her pink (docs/graphics.md).
 */
export const LOOK = {
  /** MSAA samples for the HDR scene; 2 halves the memory on a weak GPU at retina sizes. */
  samples: 4,
  /** How much of the glow is added back, how wide it spreads and how bright a pixel must be to glow (linear). */
  bloom: { intensity: .045, blurLevel: 12, threshold: 1.15 },
  vignette: { intensity: .32, inner: .55, outer: 1.25, curvature: .6 },
  bubbaloo: { vignette: new pc.Color(.07, 0, .035) },
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
  /**
   * Hit feel (`pulse`): chromatic fringing at a full pulse (CameraFrame units: the colours part by
   * intensity / 1024 of the screen times the squared distance from the centre, so the middle of the
   * fight stays sharp), the bloom intensity added at a full pulse, and how fast each fades (seconds
   * to fall to about a third). Fringing is off at rest: the engine's fringe re-samples the sharp
   * scene for red and blue while green comes through the tilt-shift's blur, so even a weak fringe
   * splits every edge green and magenta. Its shader is compiled once at start instead (`warmFringe`).
   */
  hit: { fringe: 70, bloom: .07, fringeFade: .09, bloomFade: .2 },
} as const;

/**
 * Half an 8-bit step of noise on the final colour, in display space, so the shallow gradients of
 * lamp light and dusk sky don't step into bands on an 8-bit screen. Runs after tone mapping, in
 * the compose pass's end hook.
 */
const DITHER = `
    let ditherNoise = fract(52.9829189 * fract(dot(pcPosition.xy, vec2f(0.06711056, 0.00583715))));
    result = pow(max(pow(max(result, vec3f(0.0)), vec3f(1.0 / 2.2)) + (ditherNoise - 0.5) / 255.0, vec3f(0.0)), vec3f(2.2));`;

/**
 * The glass a fight moves into its pocket, or out of it, through (src/pocket.ts, docs/combat.md §
 * Dónde se planta un combate). The picture as it was is kept (`snapshot`) and the new place is
 * already there behind it; the picture is small panes of glass of different sizes in rows that
 * never line up, and pane by pane, one here, one there, tick tick tick, each turns to show the new
 * place: it flashes as it turns, shows the place mirrored in it, bent and split into its colours,
 * and settles straight. The panes still waiting show the old place stirred, more as more turn
 * round them. Every bevel catches the light from its own angle; the seams are dark.
 * `uDiffusion` is how far it has gone (0 none turned, 1 all), `uSnapshotOn` whether it is on,
 * `uDiffusionSeed` the time.
 */
const DIFFUSION_DECLARATIONS = `
uniform uDiffusion: f32;
uniform uDiffusionSeed: f32;
uniform uSnapshotOn: f32;
var uSnapshot: texture_2d<f32>;
var uSnapshotSampler: sampler;
fn diffusionHash(p: vec2f) -> f32 { return fract(sin(dot(p, vec2f(127.1, 311.7))) * 43758.5453); }
fn glassSample(at: vec2f) -> vec3f { return textureSampleLevel(sceneTexture, sceneTextureSampler, clamp(at, vec2f(0.0), vec2f(1.0)), 0.0).rgb; }
fn oldSample(at: vec2f) -> vec3f { return textureSampleLevel(uSnapshot, uSnapshotSampler, clamp(at, vec2f(0.0), vec2f(1.0)), 0.0).rgb; }`;
const DIFFUSION = `
    if (uniform.uSnapshotOn > 0.5) {
      let flip = uniform.uDiffusion;
      let size = vec2f(textureDimensions(sceneTexture, 0));
      let cellSize = 24.0 * size.y / 900.0;
      let px = uv * size;
      let rowId = floor(px.y / cellSize);
      let rowShift = diffusionHash(vec2f(rowId, 3.7)) * cellSize;
      let shifted = vec2f(px.x + rowShift, px.y);
      var paneId = floor(shifted / cellSize);
      var paneSize = vec2f(cellSize);
      var paneOrigin = paneId * cellSize;
      if (diffusionHash(paneId + 41.0) < 0.5) {
        let piece = cellSize * 0.5;
        let sub = floor((shifted - paneOrigin) / piece);
        paneOrigin = paneOrigin + sub * piece;
        paneSize = vec2f(piece);
        paneId = paneId * 2.0 + sub + 1000.0;
      }
      let q = (shifted - paneOrigin - paneSize * 0.5) / (paneSize * 0.5);
      let r1 = diffusionHash(paneId);
      let r2 = diffusionHash(paneId.yx + 7.3);
      let r3 = diffusionHash(paneId + 19.1);
      let r4 = diffusionHash(paneId.yx + 53.9);
      let age = (flip - r3 * 0.86) / 0.14;
      let stir = sin(clamp(flip, 0.0, 1.0) * 3.14159);
      let tilt = (vec2f(r1, r2) - 0.5) * 2.0;
      let paneUv = paneSize / size;
      var seen = result;
      var turning = 0.0;
      if (age < 1.0) {
        if (age < 0.0) {
          seen = oldSample(uv + tilt * paneUv * 0.35 * stir);
        } else {
          turning = 1.0 - age;
          let middle = (paneOrigin + paneSize * 0.5 - vec2f(rowShift, 0.0)) / size;
          let bent = mix(uv, middle * 2.0 - uv, turning * turning) + tilt * paneUv * 0.5 * turning;
          let split = normalize(q + vec2f(0.0001)) * turning * 0.006;
          seen = vec3f(glassSample(bent + split).r, glassSample(bent).g, glassSample(bent - split).b);
        }
        #ifdef GRADING
          seen = applyGrading(seen);
        #endif
        seen = toneMap(max(vec3f(0.0), seen));
        #ifdef COLOR_LUT
          seen = applyColorLUT(seen);
        #endif
        #ifdef VIGNETTE
          seen = applyVignette(seen, uv);
        #endif
      }
      let edge = max(abs(q.x), abs(q.y));
      let bevel = smoothstep(0.7, 0.95, edge);
      let facing = vec2f(cos(r4 * 6.2832), sin(r4 * 6.2832));
      let lit = clamp(dot(normalize(q + vec2f(0.0001)), facing), 0.0, 1.0);
      let seam = smoothstep(0.94, 1.0, edge);
      let glassy = max(stir * 0.8, turning);
      var glass = seen * (1.0 - bevel * 0.2 * glassy) + vec3f(bevel * lit * 0.4 * glassy) + vec3f(0.85, 0.92, 1.0) * turning * turning * 0.5;
      result = glass * (1.0 - seam * 0.5 * glassy);
    }`;

/**
 * A dual attack's spotlight (docs/combat.md § Ataques duales, `spotlight`): while it is on, the
 * picture loses its colour and darkens towards the edges, except round up to SPOTS points of the
 * screen (the two who attack and the cats), which keep theirs, warmed towards gold so the place's
 * own light round them (the tower's violet) never frames the moment. Each spot is an upright ellipse
 * (a figure, not a disc of floor). `uSpotOn` is how far it is on (0–1); each spot is its centre in
 * screen uv (x, y), its radius (half its height) in screen heights and 1 if it is used.
 */
const SPOTS = 4;
const SPOT_DECLARATIONS = `
uniform uSpotOn: f32;
uniform uSpotAspect: f32;
${Array.from({ length: SPOTS }, (_, i) => `uniform uSpot${i}: vec4f;`).join('\n')}
fn spotKeep(uv: vec2f, spot: vec4f) -> f32 {
  if (spot.w < 0.5) { return 0.0; }
  let d = length((uv - spot.xy) * vec2f(uniform.uSpotAspect * 1.9, 1.0));
  return 1.0 - smoothstep(spot.z * 0.7, spot.z * 1.3, d);
}`;
const SPOT = `
    if (uniform.uSpotOn > 0.001) {
      let spotOn = uniform.uSpotOn;
      let keep = max(max(spotKeep(uv, uniform.uSpot0), spotKeep(uv, uniform.uSpot1)), max(spotKeep(uv, uniform.uSpot2), spotKeep(uv, uniform.uSpot3)));
      let grey = dot(result, vec3f(0.2126, 0.7152, 0.0722));
      let dim = vec3f(grey) * vec3f(0.86, 0.84, 0.8);
      let lit = mix(result, vec3f(grey) * vec3f(1.1, 0.98, 0.76), 0.35) * vec3f(1.04, 1.0, 0.9);
      result = mix(result, mix(dim, lit, keep), spotOn * mix(0.82, 1.0, keep));
      let edge = length((uv - vec2f(0.5)) * vec2f(uniform.uSpotAspect, 1.0));
      result = result * (1.0 - spotOn * 0.5 * smoothstep(0.3, 0.95, edge) * (1.0 - keep * 0.6));
    }`;

export function createPost(app: pc.AppBase, camera: pc.CameraComponent) {
  const chunks = pc.ShaderChunks.get(app.graphicsDevice, pc.SHADERLANGUAGE_WGSL);
  chunks.set('composeDeclarationsPS', DIFFUSION_DECLARATIONS + SPOT_DECLARATIONS);
  chunks.set('composeMainEndPS', DIFFUSION + SPOT + DITHER);
  const scope = app.graphicsDevice.scope;
  const diffusionId = scope.resolve('uDiffusion'), diffusionSeedId = scope.resolve('uDiffusionSeed'), snapshotOnId = scope.resolve('uSnapshotOn'), snapshotId = scope.resolve('uSnapshot');
  diffusionId.setValue(0); diffusionSeedId.setValue(0); snapshotOnId.setValue(0);
  // --- A dual's spotlight: its points are in the world, put on the screen once the camera has moved this frame ---
  const spotOnId = scope.resolve('uSpotOn'), spotAspectId = scope.resolve('uSpotAspect'), spotIds = Array.from({ length: SPOTS }, (_, i) => scope.resolve(`uSpot${i}`));
  const spotValues = Array.from({ length: SPOTS }, () => new Float32Array(4));
  spotOnId.setValue(0); spotAspectId.setValue(1); spotIds.forEach((id, i) => id.setValue(spotValues[i]));
  let spot: { amount: number; points: readonly { x: number; y: number; z: number; radius: number }[] } = { amount: 0, points: [] };
  const spotScreen = new pc.Vec3(), spotWorld = new pc.Vec3();
  function placeSpots() {
    spotOnId.setValue(frame.enabled ? spot.amount : 0);
    if (!spot.amount || !frame.enabled) return;
    // Where the camera puts them on the screen (CSS pixels, from the top left), as uv of the picture.
    const { width, height } = app.graphicsDevice.clientRect, cw = Math.max(1, width), ch = Math.max(1, height);
    spotAspectId.setValue(cw / ch);
    // An orthographic camera: a metre is the same share of the screen's height anywhere.
    const metre = 1 / Math.max(.01, camera.orthoHeight * 2);
    spotValues.forEach((value, i) => {
      const p = spot.points[i];
      if (p) {
        camera.worldToScreen(spotWorld.set(p.x, p.y, p.z), spotScreen);
        value[0] = spotScreen.x / cw; value[1] = spotScreen.y / ch; value[2] = p.radius * metre; value[3] = 1;
      } else value[3] = 0;
      spotIds[i].setValue(value);
    });
  }
  app.on('prerender', placeSpots);
  // The picture kept for the glass (`snapshot`): a copy of the scene's colour before the compose pass, sized to it.
  const blank = new pc.Texture(app.graphicsDevice, { name: 'Sin instantánea', width: 1, height: 1, format: pc.PIXELFORMAT_RGBA8, mipmaps: false });
  snapshotId.setValue(blank);
  let kept: { texture: pc.Texture; target: pc.RenderTarget } | undefined;
  const frame = new pc.CameraFrame(app, camera);
  frame.rendering.samples = LOOK.samples;
  // 16-bit float, not the default 11/11/10: its 6-bit mantissas band the flat's lamp light and the dusk sky.
  frame.rendering.renderFormats = [pc.PIXELFORMAT_RGBA16F, pc.PIXELFORMAT_RGBA32F];
  frame.rendering.toneMapping = pc.TONEMAP_ACES;
  Object.assign(frame.bloom, LOOK.bloom);
  Object.assign(frame.vignette, LOOK.vignette);
  frame.grading.enabled = true;
  // Draw one frame with the fringe on, so its shader variant is built before the first big hit.
  frame.fringing.intensity = .01;
  app.once('frameend', function warmFringe() { if (!hit.fringe) { frame.fringing.intensity = 0; frame.update(); } });
  // The scene's linear depth for soft particles; tilt-shift and contact shadows need the same
  // prepass and share it, so this switch only saves its cost when both of those are off too.
  frame.rendering.sceneDepthMap = LOOK.softParticles;
  // Gerard's silhouette behind walls marks where he is seen in the stencil (src/occlusion.ts).
  frame.rendering.stencil = true;
  const depth = setupDepthLook(app, frame, camera);
  // Colour grading per scene (src/grading.ts): the looks live there, the calls below.
  const grading = createGrading(app, frame);
  let tone = -1;
  const linear = new pc.Color();
  // --- Hit feel: a pulse of fringing and bloom that fades on real time (docs/graphics.md) ---
  // The bloom is only touched while it swells (from the intensity it had), so other code may set it.
  const hit = { fringe: 0, bloom: 0, bloomBase: 0 };
  function showHit() {
    frame.fringing.intensity = LOOK.hit.fringe * hit.fringe;
    if (hit.bloom || hit.bloomBase) frame.bloom.intensity = hit.bloomBase + LOOK.hit.bloom * hit.bloom;
    if (!hit.bloom) hit.bloomBase = 0;
    frame.update();
  }
  function fadeHit(dt: number) {
    if (!hit.fringe && !hit.bloom) return;
    hit.fringe *= Math.exp(-dt / LOOK.hit.fringeFade); hit.bloom *= Math.exp(-dt / LOOK.hit.bloomFade);
    if (hit.fringe < .01) hit.fringe = 0;
    if (hit.bloom < .01) hit.bloom = 0;
    showHit();
  }
  app.on('update', fadeHit);
  /**
   * A blow, a stamp or an ánima lands: `fringe` and `bloom` (0–1) jump to at least that much and
   * fade within a few tenths of a second. Does nothing while the pass is off.
   */
  function pulse(fringe: number, bloom = 0) {
    if (!frame.enabled || (fringe <= 0 && bloom <= 0)) return;
    if (bloom > 0 && !hit.bloom) hit.bloomBase = frame.bloom.intensity;
    hit.fringe = Math.max(hit.fringe, Math.min(1, fringe)); hit.bloom = Math.max(hit.bloom, Math.min(1, bloom));
    showHit();
  }
  // --- end hit feel ---
  return {
    frame, pulse,
    /**
     * A dual attack's spotlight: `amount` (0–1) of the picture loses its colour and darkens towards
     * its edges, except round `points` (world positions, `radius` metres; up to four), which keep it.
     * 0 turns it off.
     */
    spotlight(amount: number, points: readonly { x: number; y: number; z: number; radius: number }[] = []) {
      spot = { amount: Math.max(0, Math.min(1, amount)), points: points.slice(0, SPOTS) };
    },
    /**
     * Keeps the picture as it is now for the glass (`diffuse`): call it before the scene changes
     * under it. False if there is nothing to keep (the pass is off).
     */
    snapshot() {
      const scene = (frame as unknown as { renderPassCamera?: { rt?: pc.RenderTarget } }).renderPassCamera?.rt?.colorBuffer;
      const source = (frame as unknown as { renderPassCamera?: { rt?: pc.RenderTarget } }).renderPassCamera?.rt;
      if (!frame.enabled || !scene || !source) return false;
      if (!kept || kept.texture.width !== scene.width || kept.texture.height !== scene.height || kept.texture.format !== scene.format) {
        kept?.target.destroy(); kept?.texture.destroy();
        const texture = new pc.Texture(app.graphicsDevice, { name: 'Instantánea del cristal', width: scene.width, height: scene.height, format: scene.format, mipmaps: false, minFilter: pc.FILTER_LINEAR, magFilter: pc.FILTER_LINEAR, addressU: pc.ADDRESS_CLAMP_TO_EDGE, addressV: pc.ADDRESS_CLAMP_TO_EDGE });
        kept = { texture, target: new pc.RenderTarget({ name: 'Instantánea del cristal', colorBuffer: texture, depth: false }) };
      }
      (app.graphicsDevice as unknown as { copyRenderTarget(source: pc.RenderTarget, dest: pc.RenderTarget, color: boolean, depth: boolean): boolean }).copyRenderTarget(source, kept.target, true, false);
      snapshotId.setValue(kept.texture);
      return true;
    },
    /** How far the glass has gone (0 none turned, 1 all), the time, and whether it is on at all. */
    diffuse(amount: number, time: number, on = amount > 0 && amount < 1) { diffusionId.setValue(amount); diffusionSeedId.setValue(time % 1000); snapshotOnId.setValue(on ? 1 : 0); },
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
      frame.update();
      grading.setTone(k);
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
    // ── Colour grading (src/grading.ts) ──
    /** The scene's colour look; a change cross-fades over about a second. */
    setScene: grading.setScene,
    /** Before anyone is up (1) the look goes blue and grey; 0 is the scene's own. */
    setDark: grading.setDark,
    /** Grading off (false) for before/after comparisons; the rest of the pass stays. */
    set graded(on: boolean) { grading.graded = on; },
    get graded() { return grading.graded; },
    // ── end of colour grading ──
    /** Turns the whole pass off (the camera renders straight to the screen) or back on. */
    set enabled(on: boolean) { frame.enabled = on; if (on) frame.update(); },
    /**
     * Glass in the scene (refracting crystals) needs a copy of the scene's colour behind it: on
     * while there is any, off otherwise, as the copy costs a full-screen pass a frame.
     */
    glass(on: boolean) { if (frame.rendering.sceneColorMap === on) return; frame.rendering.sceneColorMap = on; frame.update(); },
    get enabled() { return frame.enabled; },
    destroy() { app.off('update', fadeHit); app.off('prerender', placeSpots); grading.destroy(); frame.destroy(); kept?.target.destroy(); kept?.texture.destroy(); blank.destroy(); },
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
/** The lines `orthoSsao` swaps in the engine's WGSL SSAO shader. */
const ORTHO_SSAO: [string, string][] = [
  ['uniform uAspect: f32;', 'uniform uAspect: f32;\nuniform uOrthoSize: f32;'],
  ['(0.5 - uv) * vec2f(uniform.uAspect, 1.0) * linearDepth,', '(uv - 0.5) * vec2f(uniform.uAspect, 1.0) * uniform.uOrthoSize,'],
  ['-(uniform.uProjectionScaleRadius / origin.z)', '(uniform.uProjectionScaleRadius / uniform.uOrthoSize)'],
];
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
  const chunks = pc.ShaderChunks.get(device, pc.SHADERLANGUAGE_WGSL);
  if (!chunks.has('ssaoOrthoPS')) {
    let source = chunks.get('ssaoPS') ?? '';
    for (const [from, to] of ORTHO_SSAO) {
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
