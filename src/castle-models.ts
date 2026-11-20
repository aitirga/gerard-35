/**
 * The castle's own models (docs/castle.md § Bestiary): each pupil's figure from `just character-3d`,
 * a monster (Meshy's rigged model and its clips, src/monsters/<id>.json) or a creature in one piece
 * (src/creatures/<id>.json). Loaded the first time they are needed and handed out as hidden
 * templates to clone. A pupil with no file yet keeps the palace minion (src/minion.ts).
 *
 * The fight measures a gum foe by the minion (its chest at .9 of its scale, its reach, its plate), so
 * each figure stands in a holder the minion's height at scale 1, and its `size` is how many minions
 * tall it is: the minion's code then fits it as it fits the minion.
 */
import * as pc from 'playcanvas';
import { CREATURES, buildCreature } from './character-model';
import type { CastleKind, Year } from './castle';

/** A monster of `just character-3d`: Meshy's rigged model, its clips and its height in metres. */
interface MonsterSpec { id: string; name: string; glb: string; clips: Record<string, string>; height: number }
const MONSTERS = import.meta.glob<MonsterSpec>('./monsters/*.json', { eager: true, import: 'default' });
/** The file for `id`: a monster's, else a creature's (no clips; the game loads those as it starts, src/game.ts). */
function specOf(id: string): (MonsterSpec & { creature?: true }) | undefined {
  const creature = CREATURES[`./creatures/${id}.json`];
  return MONSTERS[`./monsters/${id}.json`] ?? (creature && { ...creature, clips: {}, creature: true });
}

/** The palace minion's height at scale 1 (src/minion.ts: its head's top over its puddle). */
export const MINION_HEIGHT = 1.34;
/** The node a figure's file hangs from inside its holder, scaled to the minion's height; the file's own root (its armature) is its one child, where the clips play. */
const FIGURE = 'Figura';

/** The figure a castle foe is drawn with: its kind's, and El Repetidor's by his year (he ages). */
export function castleFigure(kind: CastleKind, year?: Year) {
  if (kind === 'repetidor' && year === 2) return 'repetidor-segundo';
  if (kind === 'repetidor' && year === 3) return 'repetidor-tercero';
  return kind;
}

export interface CastleModel {
  /** Hidden, to clone: the figure in a holder the minion's height at scale 1. */
  template: pc.Entity;
  /** How many minions tall it stands: its own height over the minion's. */
  size: number;
  /** Its clips by name: `rest` (the file's own pose) and those it came with (`walking`, `running`). */
  clips: Map<string, pc.AnimTrack>;
}
const loading = new Map<string, Promise<CastleModel | undefined>>();
const loaded = new Map<string, CastleModel | null>();

function container(app: pc.AppBase, url: string) {
  return new Promise<pc.ContainerResource>((resolve, reject) => app.assets.loadFromUrl(`${import.meta.env.BASE_URL}${url}`, 'container', (error, asset) => {
    if (error || !asset) reject(error ?? new Error(`No se pudo cargar ${url}`)); else resolve(asset.resource as pc.ContainerResource);
  }));
}
async function build(app: pc.AppBase, id: string): Promise<CastleModel | undefined> {
  const spec = specOf(id);
  if (!spec) return undefined;
  // The file's root is kept whole (Meshy's armature is in centimetres, scaled down by its own root):
  // the holder it hangs from takes it to the minion's height.
  const figure = new pc.Entity(FIGURE);
  const file = spec.creature ? undefined : await container(app, spec.glb);
  if (file) figure.addChild(file.instantiateRenderEntity({ castShadows: true, receiveShadows: true }) as pc.Entity);
  else buildCreature(spec, figure).enabled = true;
  const k = MINION_HEIGHT / spec.height;
  figure.setLocalScale(k, k, k);
  const template = new pc.Entity(spec.name);
  template.addChild(figure);
  template.enabled = false;
  const clips = new Map<string, pc.AnimTrack>();
  const rest = file?.animations[0]?.resource as pc.AnimTrack | undefined;
  if (rest) clips.set('rest', rest);
  await Promise.all(Object.entries(spec.clips).map(async ([name, url]) => {
    const track = (await container(app, url).catch(() => undefined))?.animations[0]?.resource as pc.AnimTrack | undefined;
    if (track) clips.set(name, track);
  }));
  return { template, size: spec.height / MINION_HEIGHT, clips };
}
/** Loads the figure `id` (once): undefined if it has no file yet, or it could not be loaded. */
export function loadCastleModel(app: pc.AppBase, id: string): Promise<CastleModel | undefined> {
  let model = loading.get(id);
  if (!model) {
    model = build(app, id).catch(error => { console.warn(`El castillo, ${id}:`, error); return undefined; }).then(m => { loaded.set(id, m ?? null); return m; });
    loading.set(id, model);
  }
  return model;
}
/** Loads every figure `ids` needs; resolves when each has loaded, failed or has no file. */
export const loadCastleModels = (app: pc.AppBase, ids: readonly string[]) => Promise.all([...new Set(ids)].map(id => loadCastleModel(app, id)));
/** The figure `id` if it is loaded (undefined while it loads, or if it has none). */
export const castleModel = (id: string) => loaded.get(id) ?? undefined;
/** Whether `id` is settled: loaded, failed, or with no file to load. */
export const castleModelSettled = (id: string) => !specOf(id) || loaded.has(id);

/** What plays a copy's clips: `play` moves to another (a short blend), and does nothing if it is the one playing. */
export interface FigureClips { play(name: string, speed?: number): void }
/** The clips of a copy of `model`'s template, on its figure. Nothing if the model came with none. */
export function figureClips(copy: pc.Entity, model: CastleModel): FigureClips | undefined {
  const figure = (copy.findByName(FIGURE) as pc.Entity | null)?.children[0] as pc.Entity | undefined;
  if (!figure || !model.clips.size) return undefined;
  figure.addComponent('anim', { activate: true });
  for (const [name, track] of model.clips) figure.anim!.assignAnimation(name, track);
  let now = '';
  return {
    play(name, speed = 1) {
      const clip = model.clips.has(name) ? name : 'rest';
      figure.anim!.speed = speed;
      if (clip === now || !model.clips.has(clip)) return;
      now = clip;
      figure.anim!.baseLayer?.transition(clip, .15);
    },
  };
}
