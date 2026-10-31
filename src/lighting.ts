import * as pc from 'playcanvas';

/**
 * The sun's shadows and the sky that glossy things reflect (docs/graphics.md, "Shadows and sky").
 *
 * Shadows: the engine fits the sun's shadow map round the camera's whole view box, from its near
 * clip to `shadowDistance`, so with the camera 77 m away most texels land on empty air. While it
 * culls, the view box is cut to the slab where things stand (the floor up to the tallest thing on
 * screen): the map then covers about what the camera sees and follows the zoom, its radius moves
 * in steps of a few percent (so the texel grid holds still and does not crawl while zooming), and
 * the engine snaps it to whole texels as the camera moves. What is drawn is untouched.
 *
 * Sky: each scene has a procedural sky (zenith, horizon, ground) prefiltered into the engine's
 * environment atlas, so glossy water, glass, paint and gum reflect it. The atlas's ambient part
 * is overwritten with the scene's flat ambient colour, so matte surfaces keep exactly the light
 * they had: the sky only adds reflections.
 */
export const LIGHTING = {
  shadow: {
    /**
     * `pcss` soft shadows that harden at contact, `vsm` blurred variance shadows, `pcf5` and `pcf3`
     * fixed 5×5 and 3×3 filters (3×3 is what the game had). PCSS costs about 1 ms more on WebGPU
     * but tens of ms on WebGL2 (it scales with its samples there), so WebGL2 keeps PCF.
     */
    type: { webgpu: 'pcss', webgl2: 'pcf5' } as Record<'webgpu' | 'webgl2', ShadowKind>,
    resolution: 2048,
    /** Against acne: the PCSS disk reaches past one texel, so receivers are pushed out along their normal more than PCF needed (.04). */
    bias: .4,
    normalOffsetBias: .12,
    /** PCSS: penumbra width per metre between caster and receiver, and samples per pixel. */
    penumbra: .04,
    falloff: 1,
    samples: 20,
    blockerSamples: 12,
    /** VSM: blur width in shadow-map texels. */
    vsmBlur: 9,
    vsmBias: .002,
    /** Fit to the view: the lowest receiver, the tallest one counted (never less than a person, at most a tower), extra metres round the slab. */
    floor: -1.2,
    ceiling: [2.6, 25] as const,
    margin: 1,
    /** The map's radius grows and shrinks in these steps (2^(1/8) ≈ 9 %), so it holds still between them. */
    step: 2 ** (1 / 8),
    /** Frames between scans for the tallest thing on screen. */
    scanEvery: 12,
  },
  sky: {
    /** Size of the source sky (equirect) and the prefiltered atlas (the engine's layout is fixed at 512). */
    source: [64, 32] as const,
    atlas: 512,
    /** GGX samples per atlas texel; the sky is smooth, so few are enough. */
    samples: 128,
    /** Her light fades in these steps; the two ends are kept, the steps between are rebuilt in one atlas. */
    steps: 12,
    /** Linear multiplier on every sky colour below. */
    intensity: 1,
    kinds: {
      /** A bright day over the street and Alegia. */
      day: { zenith: '#5f8fcf', horizon: '#d6e4ea', ground: '#9a9a8e' },
      /** A warm room: cream ceiling, lamp-lit walls, a wooden floor. */
      indoor: { zenith: '#f1e2c4', horizon: '#c99f72', ground: '#6e4f36' },
      /** The patio at night: deep blue above, a lamp-warmed horizon, dark stone. */
      night: { zenith: '#0e1a2f', horizon: '#3a4a5c', ground: '#16191a' },
      /** Sunset on the Búnkers del Carmel: the sky over the sea, pale blue above a pink band, warm dry ground. */
      dusk: { zenith: '#8fa3c8', horizon: '#e6b9a2', ground: '#7a6450' },
      /** Inside her palace: a dark plum vault over a deep pink glow, which rims her gum without washing her walls out. */
      palace: { zenith: '#2a0a26', horizon: '#9c3f7c', ground: '#2a0820' },
    } satisfies Record<SkyKind, SkyColours>,
    /** La Reina Bubbaloo's sky: dark plum above, pale pink haze on the horizon (`setTone` 1). */
    bubbaloo: { zenith: '#2a0a26', horizon: '#9c3f7c', ground: '#220a1c' } satisfies SkyColours,
    /** Before anyone is up (`setDark` 1): a pale, dim morning. */
    dawn: { zenith: '#b8bfc6', horizon: '#8c8f92', ground: '#3d3b38' } satisfies SkyColours,
  },
  /** What glossy materials reflect: the specular colour (F0, sRGB) and how much of the sky they show. */
  shine: {
    water: { specular: '#7d8a8c', reflectivity: 1.4 },
    glass: { specular: '#646d70', reflectivity: 1 },
    paint: { specular: '#4a4a4a', reflectivity: 1 },
    steel: { specular: '#9a9a9a', reflectivity: 1 },
    /** Her gum kept the pinkish specular it always had (.5, .42, .48) and now shows her vault in it. */
    gum: { specular: '#806b7a', reflectivity: 1.6 },
  },
};

export type ShadowKind = 'pcss' | 'vsm' | 'pcf5' | 'pcf3';
export type SkyKind = 'day' | 'indoor' | 'night' | 'palace' | 'dusk';
type SkyColours = { zenith: string; horizon: string; ground: string };
type Shine = keyof typeof LIGHTING.shine;

const SHADOW_TYPES: Record<ShadowKind, number> = { pcss: pc.SHADOW_PCSS_32F, vsm: pc.SHADOW_VSM_32F, pcf5: pc.SHADOW_PCF5_32F, pcf3: pc.SHADOW_PCF3_32F };

/**
 * The camera-depth slice the sun's shadow must cover: what the camera sees between the floor and
 * `ceiling`, padded so the engine's bounding sphere (radius √(half² + w² + h²)) lands on a step.
 * `up` and `right` are the y of the camera's up and right axes, `down` minus its forward's y.
 */
export function shadowSlice(view: { y: number; up: number; right: number; down: number; height: number; width: number }, floor: number, ceiling: number, margin: number, step: number) {
  const down = Math.max(.05, view.down);
  const spread = view.height * Math.abs(view.up) + view.width * Math.abs(view.right);
  const near = (view.y - spread - ceiling) / down - margin;
  const far = (view.y + spread - floor) / down + margin;
  const across = view.height ** 2 + view.width ** 2;
  const radius = Math.sqrt(((far - near) / 2) ** 2 + across);
  const stepped = step ** Math.ceil(Math.log(radius) / Math.log(step) - 1e-9);
  const reach = Math.sqrt(stepped * stepped - across), centre = (near + far) / 2;
  return { near: centre - reach, far: centre + reach, radius: stepped };
}

/** One per app: the shadow fit is installed once and the sky's atlases outlive scene changes. */
const installed = new WeakMap<pc.AppBase, ReturnType<typeof createLighting>>();
export function lighting(app: pc.AppBase) {
  let it = installed.get(app);
  if (!it) { it = createLighting(app); installed.set(app, it); }
  return it;
}

function createLighting(app: pc.AppBase) {
  const device = app.graphicsDevice;
  let shadows: ShadowKind = LIGHTING.shadow.type[device.isWebGPU ? 'webgpu' : 'webgl2'], fit = true, sky = true;

  // ——— Shadows fitted to the view ———
  let ceiling: number = LIGHTING.shadow.ceiling[1], frames = 0;
  const world = app.scene.layers.getLayerById(pc.LAYERID_WORLD);
  const rel = new pc.Vec3();
  /** The top of the tallest shadow receiver whose bounds reach into the view. */
  function tallest(camera: pc.Camera) {
    const node = camera.node, at = node.getPosition(), right = node.right, up = node.up;
    const h = camera.orthoHeight, w = h * camera.aspectRatio;
    let top: number = LIGHTING.shadow.ceiling[0];
    for (const mi of world?.meshInstances ?? []) {
      if (!mi.receiveShadow || !mi.visible || !mi.node?.enabled) continue;
      const box = mi.aabb, reach = box.halfExtents.length();
      rel.sub2(box.center, at);
      if (Math.abs(rel.dot(right)) > w + reach || Math.abs(rel.dot(up)) > h + reach) continue;
      top = Math.max(top, box.getMax().y);
    }
    return Math.min(top, LIGHTING.shadow.ceiling[1]);
  }
  const directional = app.renderer?._shadowRendererDirectional;
  if (directional) {
    const cull = directional.cull.bind(directional);
    directional.cull = (light, comp, camera, ...rest) => {
      if (!fit || camera.projection !== pc.PROJECTION_ORTHOGRAPHIC || light.numCascades !== 1) return cull(light, comp, camera, ...rest);
      const s = LIGHTING.shadow, node = camera.node;
      if (frames++ % s.scanEvery === 0) ceiling = tallest(camera);
      const h = camera.orthoHeight;
      const slice = shadowSlice({ y: node.getPosition().y, up: node.up.y, right: node.right.y, down: -node.forward.y, height: h, width: h * camera.aspectRatio }, s.floor, ceiling, s.margin, s.step);
      const near = camera._nearClip, distance = light.shadowDistance;
      camera._nearClip = Math.max(near, slice.near);
      light.shadowDistance = Math.min(camera.farClip, slice.far);
      try { cull(light, comp, camera, ...rest); } finally { camera._nearClip = near; light.shadowDistance = distance; }
    };
  }
  /** Gives a directional light the sun's shadow settings (`LIGHTING.shadow`). */
  function shade(light: pc.LightComponent) {
    const s = LIGHTING.shadow;
    Object.assign(light, {
      shadowType: SHADOW_TYPES[shadows], shadowResolution: s.resolution, shadowBias: s.bias, normalOffsetBias: s.normalOffsetBias,
      penumbraSize: s.penumbra, penumbraFalloff: s.falloff, shadowSamples: s.samples, shadowBlockerSamples: s.blockerSamples,
      vsmBlurSize: s.vsmBlur, vsmBias: s.vsmBias,
    });
  }
  function reshade() {
    for (const light of app.root.findComponents('light') as pc.LightComponent[]) if (light.type === 'directional' && light.castShadows) shade(light);
  }

  /** Resolves once the GPU has done all the work sent so far (for timings). */
  async function idle() {
    const gpu = device as unknown as { gl?: WebGL2RenderingContext; wgpu?: { queue: { onSubmittedWorkDone(): Promise<void> } } };
    gpu.gl?.finish();
    await gpu.wgpu?.queue.onSubmittedWorkDone();
  }

  // ——— Sky reflections ———
  const [sw, sh] = LIGHTING.sky.source;
  const half = pc.FloatPacking.float2Half;
  const equirect = (width: number, height: number, name: string) => new pc.Texture(device, {
    name, width, height, format: pc.PIXELFORMAT_RGBA16F, mipmaps: false, projection: pc.TEXTUREPROJECTION_EQUIRECT,
    addressU: pc.ADDRESS_REPEAT, addressV: pc.ADDRESS_CLAMP_TO_EDGE, minFilter: pc.FILTER_LINEAR, magFilter: pc.FILTER_LINEAR,
  });
  const source = equirect(sw, sh, 'Cielo'), flat = equirect(1, 1, 'Luz ambiente');
  const atlas = (name: string) => new pc.Texture(device, {
    name, width: LIGHTING.sky.atlas, height: LIGHTING.sky.atlas, format: pc.PIXELFORMAT_RGBA8, type: pc.TEXTURETYPE_RGBP,
    projection: pc.TEXTUREPROJECTION_EQUIRECT, addressU: pc.ADDRESS_CLAMP_TO_EDGE, addressV: pc.ADDRESS_CLAMP_TO_EDGE, mipmaps: false,
  });
  /** The scene's own sky, hers, and one more for the steps between. */
  const ends = [atlas('Cielo de la escena'), atlas('Cielo de la Reina')], between = atlas('Cielo de transición');
  let kind: SkyKind | undefined, betweenKey = '', current: pc.Texture | undefined;
  const ambientWritten = new pc.Color(-1, -1, -1);
  const linear = (hex: string) => { const c = new pc.Color().fromString(hex); return [c.r, c.g, c.b].map(v => v ** 2.2 * LIGHTING.sky.intensity); };
  /** Fills the source equirect: row 0 looks straight up, the last row straight down. */
  function paint(colours: SkyColours[], weights: number[]) {
    const mix = (key: keyof SkyColours) => colours.reduce((sum, c, i) => linear(c[key]).map((v, k) => sum[k] + v * weights[i]), [0, 0, 0]);
    const zenith = mix('zenith'), horizon = mix('horizon'), ground = mix('ground');
    const data = source.lock() as Uint16Array;
    for (let y = 0; y < sh; y++) {
      const elevation = (.5 - (y + .5) / sh) * Math.PI, s = Math.sin(elevation);
      // Above: horizon fading up into the zenith; below: a quick turn to the ground.
      const t = s >= 0 ? Math.pow(s, .55) : Math.min(1, -s * 4);
      const to = s >= 0 ? zenith : ground;
      for (let x = 0; x < sw; x++) for (let k = 0; k < 3; k++) data[(y * sw + x) * 4 + k] = half(horizon[k] + (to[k] - horizon[k]) * t);
      for (let x = 0; x < sw; x++) data[(y * sw + x) * 4 + 3] = half(1);
    }
    source.unlock();
  }
  /** Writes the scene's flat ambient into the atlas's ambient part, so matte surfaces light as before. */
  function writeAmbient(target: pc.Texture) {
    const a = app.scene.ambientLight, data = flat.lock() as Uint16Array;
    [a.r, a.g, a.b, 1].forEach((v, k) => { data[k] = half(k < 3 ? v ** 2.2 : 1); });
    flat.unlock();
    const s = target.width / 512;
    pc.reprojectTexture(flat, target, { numSamples: 1, rect: new pc.Vec4(128 * s, (256 + 128) * s, 64 * s, 32 * s), seamPixels: s });
    ambientWritten.copy(a);
  }
  function build(target: pc.Texture, colours: SkyColours[], weights: number[]) {
    paint(colours, weights);
    pc.EnvLighting.generateAtlas(source, { target, numReflectionSamples: LIGHTING.sky.samples, numAmbientSamples: 1 });
    writeAmbient(target);
  }
  let tone = 0, dark = 0;
  function show() {
    if (!kind) return;
    const steps = LIGHTING.sky.steps, t = Math.round(tone * steps) / steps, d = Math.round(dark * steps) / steps;
    const own = LIGHTING.sky.kinds[kind];
    let target: pc.Texture;
    if (d === 0 && (t === 0 || t === 1)) target = ends[t];
    else {
      const key = `${kind}|${t}|${d}`;
      if (key !== betweenKey) { build(between, [own, LIGHTING.sky.bubbaloo, LIGHTING.sky.dawn], [(1 - t) * (1 - d), t * (1 - d), d]); betweenKey = key; }
      target = between;
    }
    if (target !== current || !ambientWritten.equals(app.scene.ambientLight)) writeAmbient(target);
    current = target;
    app.scene.envAtlas = sky ? target : null;
  }

  return {
    /** Gives the scene's sun its shadows; scenery.ts calls it for each new sun. */
    shade,
    /** Which sky this scene reflects; rebuilds the scene's two ends (its own and hers) when it changes. */
    setSky(next: SkyKind) {
      if (next === kind) return;
      kind = next; betweenKey = ''; current = undefined;
      build(ends[0], [LIGHTING.sky.kinds[next]], [1]);
      build(ends[1], [LIGHTING.sky.bubbaloo], [1]);
      show();
    },
    /** Her light (0–1) and the morning dark (0–1), after scenery.ts has set the ambient for them. */
    setTone(k: number, d = 0) { tone = k; dark = d; show(); },
    /** Development toggles for side-by-side captures (window.gerard.game.lighting). */
    get shadows() { return shadows; },
    set shadows(next: ShadowKind) { shadows = next; reshade(); },
    get fit() { return fit; },
    set fit(on: boolean) { fit = on; },
    get sky() { return sky; },
    set sky(on: boolean) { sky = on; app.scene.envAtlas = on && current ? current : null; },
    /** The tunables, to edit from the console before `refresh()`. */
    settings: LIGHTING,
    /** Applies `LIGHTING` as it is now: the sun's shadows and the current sky, rebuilt. */
    refresh() { reshade(); const k = kind; kind = undefined; if (k) this.setSky(k); },
    /** Times building one sky atlas: ms on the CPU, and until the GPU has finished it. */
    async timeSky() {
      await idle();
      const start = performance.now();
      build(between, [LIGHTING.sky.kinds[kind ?? 'day']], [1]); betweenKey = '';
      const cpu = performance.now() - start;
      await idle();
      return { cpu, gpu: performance.now() - start };
    },
  };
}

/** Makes a material reflect the sky (`LIGHTING.shine`): water, glass, car paint, steel, her gum. */
export function shine(m: pc.StandardMaterial, kind: Shine) {
  const s = LIGHTING.shine[kind];
  m.specular.fromString(s.specular); m.reflectivity = s.reflectivity; m.update();
  return m;
}
