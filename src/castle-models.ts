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
import type { FoeKind } from './battle';
import { BOSS_FIGURES } from './foe-bodies';
import { DIRECTIVAS, isCastle, type CastleKind, type Year } from './castle';

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

/**
 * The figure a castle foe is drawn with: its kind's, El Repetidor's by his year (he ages), and each
 * of the management team her own (`who`: Mar, Montse or Pilar, the fighter's id; Mar's without one).
 */
export function castleFigure(kind: CastleKind, year?: Year, who?: string) {
  if (kind === 'repetidor' && year === 2) return 'repetidor-segundo';
  if (kind === 'repetidor' && year === 3) return 'repetidor-tercero';
  if (kind === 'directiva') return DIRECTIVAS.find(d => d.id === who)?.id ?? DIRECTIVAS[0].id;
  return kind;
}

/** The figure a foe fights as, if it has one: a castle foe's (`castleFigure`) or a boss's (BOSS_FIGURES). */
export function foeFigure(kind: FoeKind | undefined, year?: Year, who?: string) {
  if (!kind) return undefined;
  return isCastle(kind) ? castleFigure(kind, year, who) : BOSS_FIGURES[kind];
}

export interface CastleModel {
  /** Hidden, to clone: the figure in a holder the minion's height at scale 1. */
  template: pc.Entity;
  /** How many minions tall it stands: its own height over the minion's. */
  size: number;
  /** Its clips by name: `rest` (the file's own pose) and those it came with (`walking`, `running`). */
  clips: Map<string, pc.AnimTrack>;
  /**
   * Its own walk, if it has one: the move from Meshy's animation library its file of `actions` brings
   * (`animations` in tools/figures.toml), each pupil's own. Without one, it walks Meshy's plain walk.
   */
  gait?: string;
  /** A creature in one piece (El Montón): no skeleton, so it crawls by squashing and stretching. */
  crawls?: boolean;
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
  let gait: string | undefined;
  await Promise.all(Object.entries(spec.clips).map(async ([name, url]) => {
    const file = await container(app, url).catch(() => undefined);
    // The library's moves come in one file, a clip each: its walk is the first.
    if (name === 'actions') {
      file?.animations.forEach((animation, i) => { const id = `actions-${i}`; clips.set(id, animation.resource as pc.AnimTrack); if (!i) gait = id; });
      return;
    }
    const track = file?.animations[0]?.resource as pc.AnimTrack | undefined;
    if (track) clips.set(name, track);
  }));
  return { template, size: spec.height / MINION_HEIGHT, clips, ...gait ? { gait } : {}, ...spec.creature ? { crawls: true } : {} };
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

/** How much faster a pupil's own walk plays when it runs after the party: it chases in its own gait. */
export const CHASE_PACE = 1.8;
/**
 * What moves a copy. `play` takes a clip by name (`rest`, `walking`, `running`), or what it means:
 * `walk` its own walk (the plain one without), `chase` that walk at CHASE_PACE (the plain run without);
 * changing clip blends a moment, the same one again only sets its speed. `tick` runs a creature's crawl.
 */
export interface FigureClips { play(name: string, speed?: number): void; tick?(dt: number): void }
/** What moves a copy of `model`'s template: its clips on its figure, or a creature's crawl. Nothing if it has neither. */
export function figureClips(copy: pc.Entity, model: CastleModel): FigureClips | undefined {
  const holder = copy.findByName(FIGURE) as pc.Entity | null;
  if (model.crawls && holder) return crawl(holder);
  const figure = holder?.children[0] as pc.Entity | undefined;
  if (!figure || !model.clips.size) return undefined;
  figure.addComponent('anim', { activate: true });
  for (const [name, track] of model.clips) figure.anim!.assignAnimation(name, track);
  let now = '';
  return {
    play(name, speed = 1) {
      const meant = name === 'walk' ? model.gait ?? 'walking' : name === 'chase' ? model.gait ?? 'running' : name;
      const clip = model.clips.has(meant) ? meant : 'rest';
      figure.anim!.speed = speed * (name === 'chase' && model.gait ? CHASE_PACE : 1);
      if (clip === now || !model.clips.has(clip)) return;
      now = clip;
      figure.anim!.baseLayer?.transition(clip, .15);
    },
  };
}
/** A heap of gum on the move with no legs (El Montón): it squashes and stretches forward, faster when it gives chase. */
function crawl(holder: pc.Entity): FigureClips {
  const base = holder.getLocalScale().clone();
  let pace = 0, phase = 0;
  return {
    play(name, speed = 1) { pace = speed * (name === 'chase' || name === 'running' ? 2.2 : name === 'walk' || name === 'walking' ? 1 : 0); },
    tick(dt) {
      phase += dt * pace * 5;
      const surge = pace ? Math.sin(phase) : 0;
      holder.setLocalScale(base.x * (1 - surge * .05), base.y * (1 + surge * .08), base.z * (1 + surge * .1));
      holder.setLocalEulerAngles(pace ? 4 + surge * 3 : 0, 0, 0);
    },
  };
}
/**
 * Out on the Meridiana at night (src/night.ts) the pupils glow a little from within, their own gum
 * lighting itself, as the palace guards' pink eyes did: the dark between lamps still hides the party
 * from them, but the party can see what is coming and measure it. Each copy gets its own materials.
 */
export function glowAtNight(copy: pc.Entity, strength = .45) {
  for (const render of copy.findComponents('render') as pc.RenderComponent[]) for (const mesh of render.meshInstances) {
    const own = (mesh.material as pc.StandardMaterial).clone();
    own.emissiveMap = own.diffuseMap; own.emissive = new pc.Color(1, 1, 1); own.emissiveIntensity = strength;
    own.update(); mesh.material = own;
  }
}
