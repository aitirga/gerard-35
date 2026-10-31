import * as pc from 'playcanvas';
import type { EnvironmentId } from './environments.ts';

/**
 * Colour grading per scene (docs/graphics.md): each place has a look, a colour transform baked into
 * a small lookup table plus a few of CameraFrame's `colorEnhance` dials, and La Reina Bubbaloo's
 * pink takes over as a second LUT blended in by her tone. Changing scene cross-fades the look.
 * Everything is built in code: no image assets, and no shaders of our own (the engine's work on WebGPU too).
 */

export type RGB = readonly [number, number, number];
/**
 * A colour transform in display (sRGB) space, applied after tone mapping. Every field is optional
 * and the empty grade is the identity; offsets are small (a few hundredths), factors are near 1.
 */
export interface Grade {
  /** White balance: positive is warmer (amber), negative cooler (blue); ±1 is very strong. */
  temperature?: number;
  /** Positive leans magenta, negative green. */
  tint?: number;
  /** Raises the blacks towards this colour (0 keeps black black). */
  lift?: RGB;
  /** Midtones: above 1 brightens them. */
  gamma?: RGB;
  /** Scales the whole channel; mostly the highlights. */
  gain?: RGB;
  /** Split toning: colour added to the shadows and to the highlights (black and white stay put). */
  shadows?: RGB;
  highlights?: RGB;
  /** An S curve around mid-grey: above 1 is punchier, below 1 softer. Black and white stay put. */
  contrast?: number;
  saturation?: number;
}
/** CameraFrame's `colorEnhance` dials (HDR, before tone mapping); see its typings for ranges. */
export interface Enhance { shadows: number; highlights: number; vibrance: number; midtones: number; dehaze: number }
export interface Look {
  grade: Grade;
  enhance?: Partial<Enhance>;
  /** How much La Reina Bubbaloo's look takes over at full tone (1, the default: all of it). */
  her?: number;
}
export type LookId = EnvironmentId | 'bubbaloo' | 'oscuro';

/**
 * Every look. Keep them gentle: the game's palette must survive, a look adds mood and never
 * repaints. Check changes with `just screenshots grading` (each scene graded and plain).
 */
/** Gerard's family house: warm afternoon indoors, soft amber shade. */
const HOUSE: Look = {
  grade: { temperature: .09, lift: [.01, .006, 0], highlights: [.018, .008, -.012], contrast: 1.03, saturation: 1.02 },
  enhance: { shadows: .15, vibrance: .08 },
};
export const LOOKS: Record<LookId, Look> = {
  /** El patio: a cool blue night; the fireflies keep their warmth. */
  patio: {
    grade: { temperature: -.06, lift: [0, 0, .006], shadows: [-.02, .002, .04], highlights: [.02, .012, -.008], contrast: 1.05, saturation: .95 },
    // The LUT's darkest step already lifts near-black a little (docs/graphics.md): keep the night deep.
    enhance: { shadows: -.1, vibrance: .06 },
  },
  /** Passatge Maresme: a sunny Mediterranean afternoon, golden light and teal shade. */
  maresme: {
    grade: { temperature: .08, shadows: [-.012, .002, .018], highlights: [.016, .009, -.012], contrast: 1.06, saturation: 1.04 },
    enhance: { vibrance: .12, highlights: -.12 },
  },
  'home-entrance': HOUSE, 'home-floor-1': HOUSE, 'home-floor-2': HOUSE,
  /** The Meridiana flat: a warm, soft morning; peachy shade, gentle contrast. */
  meridiana: {
    grade: { temperature: .06, lift: [.016, .01, .006], highlights: [.016, .012, -.004], gamma: [1.02, 1.02, 1.01], contrast: .97, saturation: .94 },
    enhance: { shadows: .15, highlights: -.12, midtones: .04 },
  },
  /** Her palace: sugary, a pastel sheen on the light over violet shade; her gloom only a quarter takes it. */
  palacio: {
    grade: { lift: [.012, .004, .014], shadows: [.006, -.004, .02], highlights: [.02, .016, .022], contrast: 1.03, saturation: .94 },
    enhance: { highlights: -.1 },
    her: .25,
  },
  /** San Juan kalea, Alegia: crisp Basque air, clean greens and cool shade. */
  alegia: {
    grade: { temperature: -.05, shadows: [-.008, .004, .014], highlights: [.01, .006, -.004], contrast: 1.05, saturation: 1.03 },
    enhance: { vibrance: .12, dehaze: .04 },
  },
  /** The Meridiana avenue: Barcelona concrete, cool and a little hard. */
  'meridiana-calle': {
    grade: { temperature: -.04, shadows: [-.004, .002, .012], highlights: [.016, .008, -.008], contrast: 1.05, saturation: .97 },
    enhance: { dehaze: .05 },
  },
  /** Trinitat Vella round the school: a Barcelona morning, a touch warmer than the avenue. */
  'rec-comtal': {
    grade: { temperature: .06, shadows: [-.006, .002, .012], highlights: [.018, .01, -.01], contrast: 1.05, saturation: 1 },
    enhance: { vibrance: .06 },
  },
  /** Cardedeu: a small Vallès town in the afternoon, warm stone and red roofs under a soft sky. */
  cardedeu: {
    grade: { temperature: .07, shadows: [-.008, .002, .014], highlights: [.018, .01, -.01], contrast: 1.04, saturation: 1.02 },
    enhance: { vibrance: .1 },
  },
  /** La torre de Uri: fear, violet-black shade that stays deep and a cold, unsure light. */
  'cardedeu-laberinto': {
    grade: { temperature: -.08, lift: [.006, 0, .012], shadows: [.008, -.006, .026], highlights: [.004, .002, .016], contrast: 1.06, saturation: .92 },
    enhance: { shadows: -.1, midtones: -.04 },
  },
  /** The Sagrada Família: a bright Barcelona afternoon on sandstone, warm light, cool blue shade and a breath of haze for the height. */
  'sagrada-familia': {
    grade: { temperature: .03, shadows: [-.006, .002, .016], highlights: [.016, .01, -.006], contrast: 1.04, saturation: .98 },
    enhance: { dehaze: -.03, highlights: -.08, vibrance: .04 },
  },
  /** La Reina Bubbaloo's light: magenta in the shade, pink in the light, a little darker and stranger. */
  bubbaloo: {
    grade: { lift: [.012, 0, .01], gamma: [.98, .95, .97], gain: [1, .96, .98], shadows: [.024, -.008, .02], highlights: [.02, -.002, .01], contrast: 1.05, saturation: 1 },
    enhance: { midtones: -.06 },
  },
  /** Before anyone is up (`setDark`): blue and grey, until the lamps come on. */
  oscuro: {
    grade: { temperature: -.35, lift: [0, .004, .014], gain: [.92, .94, 1], saturation: .72 },
    enhance: { shadows: -.1 },
  },
};
/** Seconds a scene change takes to cross-fade the look (instant with reduced motion). */
export const GRADE_FADE = 1;

const luma = (r: number, g: number, b: number) => .2126 * r + .7152 * g + .0722 * b;
const clamp01 = (x: number) => x < 0 ? 0 : x > 1 ? 1 : x;
const smooth = (x: number) => { x = clamp01(x); return x * x * (3 - 2 * x); };
/** Contrast around `pivot` that keeps 0 and 1: a power curve on each side, with slope `k` at the pivot. */
function curve(x: number, k: number, pivot = .5) {
  return x < pivot ? pivot * (x / pivot) ** k : 1 - (1 - pivot) * ((1 - x) / (1 - pivot)) ** k;
}

/** One colour through `grade` (sRGB in, sRGB out, 0–1). */
export function gradeColour(grade: Grade, [r, g, b]: RGB): [number, number, number] {
  const { temperature = 0, tint = 0, lift, gamma, gain, shadows, highlights, contrast = 1, saturation = 1 } = grade;
  if (temperature || tint) {
    // White balance on linear light, keeping the brightness.
    const wb = [1 + .12 * temperature, 1 - .08 * tint, 1 - .12 * temperature] as const, keep = 1 / luma(...wb);
    [r, g, b] = [r, g, b].map((c, i) => (c ** 2.2 * wb[i] * keep) ** (1 / 2.2));
  }
  let c = [r, g, b];
  c = c.map((x, i) => {
    x += (lift?.[i] ?? 0) * (1 - x);
    x *= gain?.[i] ?? 1;
    return clamp01(x) ** (1 / (gamma?.[i] ?? 1));
  });
  if (shadows || highlights) {
    // Shadows fade out right at black so a tint never lifts it (that is what `lift` is for).
    const l = luma(c[0], c[1], c[2]), low = (1 - l) ** 2 * smooth(l / .2), high = l * l;
    c = c.map((x, i) => x + (shadows?.[i] ?? 0) * low + (highlights?.[i] ?? 0) * high);
  }
  if (contrast !== 1) c = c.map(x => curve(clamp01(x), contrast));
  if (saturation !== 1) { const l = luma(c[0], c[1], c[2]); c = c.map(x => l + (x - l) * saturation); }
  return [clamp01(c[0]), clamp01(c[1]), clamp01(c[2])];
}

/** LUT size: 16³ entries in the engine's 256×16 strip (Unreal layout: blue picks the slice, red is x within it, green is y). */
export const LUT_SIZE = 16;
/** Where entry (r, g, b) (each 0–15) lives in the strip, in pixels. */
export const lutIndex = (r: number, g: number, b: number) => g * LUT_SIZE * LUT_SIZE + b * LUT_SIZE + r;

const tables = new Map<Grade, Float32Array>();
/** The look's LUT as sRGB floats, three a pixel; built once per grade. */
export function lutTable(grade: Grade) {
  let table = tables.get(grade);
  if (table) return table;
  table = new Float32Array(LUT_SIZE ** 3 * 3);
  const n = LUT_SIZE - 1;
  for (let b = 0; b < LUT_SIZE; b++) for (let g = 0; g < LUT_SIZE; g++) for (let r = 0; r < LUT_SIZE; r++) {
    table.set(gradeColour(grade, [r / n, g / n, b / n]), lutIndex(r, g, b) * 3);
  }
  tables.set(grade, table);
  return table;
}

const NO_ENHANCE: Enhance = { shadows: 0, highlights: 0, vibrance: 0, midtones: 0, dehaze: 0 };
/** A look in a form that mixes: its table, its dials and how much of her it lets in. */
interface Mood { table: Float32Array; enhance: Enhance; her: number }
const moodOf = (id: LookId): Mood => {
  const look = LOOKS[id];
  return { table: lutTable(look.grade), enhance: { ...NO_ENHANCE, ...look.enhance }, her: look.her ?? 1 };
};
/** `out` = a + (b − a)·t, for every number in the moods. */
export function mixMood(out: Mood, a: Mood, b: Mood, t: number) {
  for (let i = 0; i < out.table.length; i++) out.table[i] = a.table[i] + (b.table[i] - a.table[i]) * t;
  for (const key of Object.keys(NO_ENHANCE) as (keyof Enhance)[]) out.enhance[key] = a.enhance[key] + (b.enhance[key] - a.enhance[key]) * t;
  out.her = a.her + (b.her - a.her) * t;
  return out;
}
const blankMood = (): Mood => ({ table: new Float32Array(LUT_SIZE ** 3 * 3), enhance: { ...NO_ENHANCE }, her: 1 });
const copyMood = (out: Mood, from: Mood) => mixMood(out, from, from, 0);

/**
 * Drives `frame.colorLUT` and `frame.colorEnhance`. The first slot is the scene's look (its own
 * cached texture, or a texture rewritten each frame while it cross-fades or the room is dark), the
 * second La Reina Bubbaloo's, blended in by her tone. One shader variant all along: both slots
 * stay filled and `colorEnhance` stays on.
 */
export function createGrading(app: pc.AppBase, frame: pc.CameraFrame) {
  const device = app.graphicsDevice;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const lut = (name: string) => new pc.Texture(device, {
    name, width: LUT_SIZE * LUT_SIZE, height: LUT_SIZE, format: pc.PIXELFORMAT_SRGBA8, mipmaps: false,
    minFilter: pc.FILTER_LINEAR, magFilter: pc.FILTER_LINEAR, addressU: pc.ADDRESS_CLAMP_TO_EDGE, addressV: pc.ADDRESS_CLAMP_TO_EDGE,
  });
  const fill = (texture: pc.Texture, table: Float32Array) => {
    const pixels = texture.lock() as Uint8Array;
    for (let i = 0, j = 0; i < table.length; i += 3, j += 4) {
      pixels[j] = table[i] * 255 + .5; pixels[j + 1] = table[i + 1] * 255 + .5; pixels[j + 2] = table[i + 2] * 255 + .5; pixels[j + 3] = 255;
    }
    texture.unlock();
    return texture;
  };
  const textures = new Map<LookId, pc.Texture>();
  const textureOf = (id: LookId) => textures.get(id) ?? textures.set(id, fill(lut(`Gradación ${id}`), moodOf(id).table)).get(id)!;
  const moods = new Map<LookId, Mood>();
  const mood = (id: LookId) => moods.get(id) ?? moods.set(id, moodOf(id)).get(id)!;
  // The look on screen while fading (from → to), and the same with the dark folded in.
  const from = blankMood(), shown = blankMood(), dimmed = blankMood();
  let mixed: pc.Texture | undefined;
  let scene: LookId | undefined, fade = 1, tone = 0, dark = 0, graded = true, dirty = true;

  function apply() {
    dirty = false;
    if (!scene || !graded) {
      frame.colorLUT.texture = frame.colorLUT.texture2 = null;
      frame.colorEnhance.enabled = false;
      frame.update();
      return;
    }
    const to = mood(scene), t = smooth(fade);
    let look = to, texture = textureOf(scene);
    if (t < 1 || dark > 0) {
      look = t < 1 ? mixMood(shown, from, to, t) : to;
      if (dark > 0) look = mixMood(dimmed, look, mood('oscuro'), dark);
      texture = fill(mixed ??= lut('Gradación en transición'), look.table);
    }
    const her = mood('bubbaloo'), k = tone * look.her;
    Object.assign(frame.colorLUT, { texture, texture2: textureOf('bubbaloo'), intensity: 1, intensity2: 1, blend: k });
    frame.colorEnhance.enabled = true;
    for (const key of Object.keys(NO_ENHANCE) as (keyof Enhance)[]) frame.colorEnhance[key] = pc.math.lerp(look.enhance[key], her.enhance[key], k);
    frame.update();
  }
  const tick = (dt: number) => {
    if (fade < 1) { fade = reducedMotion.matches ? 1 : Math.min(1, fade + dt / GRADE_FADE); dirty = true; }
    if (dirty) apply();
  };
  app.on('update', tick);
  return {
    /** The scene's look; a change cross-fades from whatever is on screen (the first one is instant). */
    setScene(id: EnvironmentId) {
      // A new scenery starts with its lamps on, like `scenery.setDark(0)`.
      if (dark) { dark = 0; dirty = true; }
      if (id === scene) return;
      if (scene) copyMood(from, fade < 1 ? shown : mood(scene));
      fade = scene ? 0 : 1; scene = id; dirty = true;
    },
    /** La Reina Bubbaloo's tone, 0–1. */
    setTone(k: number) { if (k !== tone) { tone = k; dirty = true; } },
    /** Before anyone is up (1) to the scene's own light (0); see `scenery.setDark`. */
    setDark(k: number) { if (k !== dark) { dark = k; dirty = true; } },
    /** Off for before/after comparisons. */
    set graded(on: boolean) { graded = on; dirty = true; apply(); },
    get graded() { return graded; },
    get scene() { return scene; },
    destroy() { app.off('update', tick); textures.forEach(t => t.destroy()); mixed?.destroy(); },
  };
}
