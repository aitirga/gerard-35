import * as pc from 'playcanvas';
import type { GeoTexture } from './geo';

/**
 * Real materials for the geo places (docs/environment-styling.md § Real materials): textures from
 * public/textures/<id>/, loaded once per session while a scene is built. Until they arrive, and if
 * one is missing, every surface keeps its painted canvas, so nothing waits and nothing breaks.
 */

/** Where a texture's files are served. */
export function textureUrl(id: string, file: string) {
  return `${import.meta.env?.BASE_URL ?? '/'}textures/${id}/${file}`;
}

const images = new Map<string, Promise<ImageBitmap | undefined>>();
/**
 * Decodes an image once per session, as a bitmap (WebGPU uploads bitmaps, not <img>) with its
 * values untouched; a missing file resolves to nothing and says so in the console.
 */
function loadImage(url: string) {
  let image = images.get(url);
  if (!image) {
    image = fetch(url).then(r => r.ok ? r.blob() : Promise.reject(new Error(String(r.status))))
      .then(blob => createImageBitmap(blob, { colorSpaceConversion: 'none', premultiplyAlpha: 'none' }))
      .catch(() => { console.warn(`Textura sin cargar: ${url}`); return undefined; });
    images.set(url, image);
  }
  return image;
}

export interface LoadedTexture { id: string; info: GeoTexture; albedo: ImageBitmap; normal?: ImageBitmap }
/** Every texture a scene names, decoded: those that fail are simply left out. */
export async function loadTextures(textures: Record<string, GeoTexture>) {
  const loaded = await Promise.all(Object.entries(textures).map(async ([id, info]): Promise<LoadedTexture | undefined> => {
    const [albedo, normal] = await Promise.all([loadImage(textureUrl(id, info.files.albedo)), info.files.normal ? loadImage(textureUrl(id, info.files.normal)) : undefined]);
    return albedo ? { id, info, albedo, normal } : undefined;
  }));
  return new Map(loaded.filter((t): t is LoadedTexture => !!t).map(t => [t.id, t]));
}

/**
 * The diffuse colour that tints a grey texture (see `greyOf`) to average `tint`, like a canvas
 * painted in `tint`. Textures are decoded from sRGB and material colours linearised (pow 2.2), so
 * the ratio is taken against the grey's mean in linear light.
 */
export function tintColour(tint: string, grey: { linear: number }) {
  const a = new pc.Color().fromString(tint), k = Math.max(grey.linear, 0.002) ** (1 / 2.2);
  const ratio = (c: number) => Math.min(3, c / k);
  return new pc.Color(ratio(a.r), ratio(a.g), ratio(a.b));
}

const greys = new Map<string, { canvas: HTMLCanvasElement; linear: number }>();
/**
 * The texture's albedo in grey, keeping its light and shade, for tinting to any colour without
 * its own hue leaking through; `linear` is its mean in linear light.
 */
export function greyOf(texture: LoadedTexture) {
  let grey = greys.get(texture.id);
  if (grey) return grey;
  const { width, height } = texture.albedo;
  const c = document.createElement('canvas'); c.width = width; c.height = height;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(texture.albedo, 0, 0);
  const data = ctx.getImageData(0, 0, width, height), px = data.data;
  let sum = 0;
  for (let i = 0; i < px.length; i += 4) {
    const v = Math.round(px[i] * 0.299 + px[i + 1] * 0.587 + px[i + 2] * 0.114);
    px[i] = px[i + 1] = px[i + 2] = v; sum += (v / 255) ** 2.2;
  }
  ctx.putImageData(data, 0, 0);
  grey = { canvas: c, linear: sum / (width * height) };
  greys.set(texture.id, grey);
  return grey;
}

const grains = new Map<string, HTMLCanvasElement>();
/**
 * The texture as neutral grey grain (mean 50 %, a set contrast), to lay over a painted wall with
 * `overlay`: the wall keeps its own colour and gains the texture's light and shade.
 */
export function grainOf(texture: LoadedTexture, size = 256) {
  let c = grains.get(texture.id);
  if (c) return c;
  c = document.createElement('canvas'); c.width = c.height = size;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(texture.albedo, 0, 0, size, size);
  const data = ctx.getImageData(0, 0, size, size), px = data.data, n = size * size;
  const lum = new Float32Array(n);
  let sum = 0;
  for (let i = 0; i < n; i++) { lum[i] = (px[i * 4] * 0.299 + px[i * 4 + 1] * 0.587 + px[i * 4 + 2] * 0.114) / 255; sum += lum[i]; }
  const mean = sum / n;
  let variance = 0;
  for (let i = 0; i < n; i++) variance += (lum[i] - mean) ** 2;
  // Every material ends up with about the same strength: plaster's faint mottling and brick's joints alike.
  const gain = 0.08 / Math.max(Math.sqrt(variance / n), 0.01);
  for (let i = 0; i < n; i++) {
    const v = Math.round(Math.min(1, Math.max(0, 0.5 + (lum[i] - mean) * gain)) * 255);
    px[i * 4] = px[i * 4 + 1] = px[i * 4 + 2] = v; px[i * 4 + 3] = 255;
  }
  ctx.putImageData(data, 0, 0);
  grains.set(texture.id, c);
  return c;
}

/** A GPU texture for one of a loaded texture's images: repeating, mipmapped, sampled like the painted canvases. */
export function gpuTexture(device: pc.GraphicsDevice, image: ImageBitmap | HTMLCanvasElement, name: string) {
  const t = new pc.Texture(device, { name, width: image.width, height: image.height, mipmaps: true, anisotropy: 8, addressU: pc.ADDRESS_REPEAT, addressV: pc.ADDRESS_REPEAT });
  // Both backends upload bitmaps; the engine's types only list DOM elements.
  t.setSource(image as unknown as HTMLCanvasElement);
  return t;
}
