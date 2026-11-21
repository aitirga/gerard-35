import * as pc from 'playcanvas';
import { ANIMAS } from './animas';
import { ANIMA_OWNERS, CLASS_STATS, DUALS, ELEMENTS, MANA_POINTS, PASSIVES, SKILLS, type ClassId, type FoeKind } from './battle';
import { buildStreetDogs, foeScale } from './battle-scene';
import { MERIDIANA_BED } from './bed';
import { BIP, createBip } from './bip';
import { createCat, type CatId } from './cats';
import { IMPROVEMENTS, LINES } from './ecos';
import { LEVELLED, LEVEL_XP, topOf } from './levels';
import { WalkAnimation, carriage, idlePose, poseLimbs } from './walk-animation';
import {
  CASTLE_ANSWERS, MOTION, familyOf, fightName, foesOfTheGame, modelStatusOf, movesOf, targetsOf, traitsOf,
  type FoeKindSeen, type ModelStatus,
} from './bestiary-data';
import { COMPANIONS, CREATURES, HELD, buildCharacter, buildCreature, loadCharacterModels, type CharacterSpec, type CreatureSpec } from './character-model';
import { CLASSES, grownUp, wearClass } from './classes';
import { SPEAKERS, type Speaker } from './dialogue';
import type { Effects } from './effects';
import { createFears } from './fears';
import { createMinion } from './minion';
import { NOTES_ENDPOINT, REDO, isoNow, newNote, type Note, type NotesFile, type Redo } from './bestiary-notes';
import PORTRAIT_EXPRESSIONS from './portraits.json';
import { MODEL_URL as SOBREMESA_URL } from './sobremesa';
import { PROFILES, STAT_LABELS, type ProfileId, type Stats } from './stats';
import { DIRECTIVAS, isCastle } from './castle';

/**
 * The bestiary (development, `just bestiario`): everyone in the game, allies, foes, people and the
 * monsters being designed, each with its 3D model as the game draws it, its portrait and concept art,
 * and what it does in a fight, all read from the game's own data (src/bestiary-data.ts) so a new
 * figure, monster or foe shows up by itself. What the page cannot read from src/ (tools/figures.toml
 * and the files `just character-3d` leaves in output/) comes from output/bestiary/figures.json, which
 * `just bestiario` writes first (tools/bestiary.py).
 */

/** A monster of `just character-3d` (kind "monster"): Meshy's rigged model and its clips. */
interface MonsterSpec { id: string; name: string; glb: string; clips: Record<string, string>; height: number }
/** A figure of tools/figures.toml, as tools/bestiary.py writes it. */
interface Figure {
  id: string; name: string; kind: 'person' | 'monster' | 'creature' | 'animal' | 'held'; about: string; cues: string; height?: number;
  files: Partial<Record<'front' | 'toy' | 'left' | 'right' | 'back' | 'model' | 'rigged' | 'walking' | 'running', string>>; earlier: string[];
  game: { glb: boolean; spec: boolean };
}

const CHARACTERS = Object.values(import.meta.glob<CharacterSpec>('./characters/*.json', { eager: true, import: 'default' }));
const MONSTERS = Object.values(import.meta.glob<MonsterSpec>('./monsters/*.json', { eager: true, import: 'default' }));
const CREATURE_SPECS = Object.values(CREATURES);
const EXPRESSIONS: Record<string, string[] | undefined> = PORTRAIT_EXPRESSIONS;
const characterOf = (id?: string) => id ? CHARACTERS.find(c => c.id === id) : undefined;

/** The party members who wear ánimas, in the order the switch offers them, and their name there. */
const WEARERS: { profile: ProfileId; name: string }[] = [{ profile: 'gerard35', name: 'Gerard (35)' }, { profile: 'aitor', name: 'Aitor' }, { profile: 'gerard', name: 'Gerard de niño' }];
/** Who a profile is for ANIMA_OWNERS (battle.ts): Gerard at any age is Gerard. */
const personOf = (profile: ProfileId) => profile === 'gerard35' ? 'gerard' : profile;
/**
 * Whether `profile` can wear `id`, by the game's rules (ANIMA_OWNERS): someone's own ánima only
 * they wear, the rest anyone but Bernat; and as a boy (chapter 1) Gerard has only his own.
 */
const canWear = (profile: ProfileId, id: ClassId) => profile !== 'bernat' && (grownUp(profile) ? !ANIMA_OWNERS[id] || ANIMA_OWNERS[id] === personOf(profile) : ANIMA_OWNERS[id] === personOf(profile));
/** Who wears an ánima first: its owner, else Gerard, who the shared ones come to first (Papagato is Nuria's loan to him). */
const firstWearer = (id: ClassId): ProfileId => ANIMA_OWNERS[id] === 'aitor' ? 'aitor' : 'gerard35';
/** How big a party member stands in the game: the grown-ups' scale (src/bed.ts), the boys at 1. */
const wearerScale = (profile: ProfileId) => profile === 'gerard35' ? MERIDIANA_BED.sleepers.gerard.scale : profile === 'aitor' ? MERIDIANA_BED.sleepers.aitor.scale : 1;
const KINDS: Record<string, string> = { physical: 'físico', magic: 'mágico', heal: 'cura', boost: 'mejora', debuff: 'debilita', guard: 'protege' };

type Filter = 'aliados' | 'enemigos' | 'diseno' | 'npc';
const FILTERS: Record<Filter | 'todos' | 'mejorar' | 'notas', string> = { todos: 'Todos', aliados: 'Aliados', enemigos: 'Enemigos', diseno: 'Monstruos en diseño', npc: 'NPC', mejorar: 'Por mejorar', notas: 'Con notas' };
const STATUS_NAMES: Record<Note['status'], string> = { abierta: 'Abierta', hecha: 'Hecha', descartada: 'Descartada' };
type View =
  | { type: 'character'; spec: CharacterSpec } | { type: 'monster'; spec: MonsterSpec } | { type: 'creature'; spec: CreatureSpec }
  | { type: 'template'; kind: FoeKind; layers: number } | { type: 'minion'; kind: FoeKind } | { type: 'glb'; url: string }
  | { type: 'none'; why: string; image?: string }
  /** A party member wearing an ánima (or none), dressed by the game's own `wearClass`. */
  | { type: 'wearer'; profile: ProfileId; anima?: ClassId }
  /** The street dogs, as the fight builds them (`buildStreetDogs`). */
  | { type: 'dogs' }
  /** Haru or Yuki, as src/cats.ts builds and moves them. */
  | { type: 'cat'; id: CatId };
interface Entry {
  key: string; filter: Filter; name: string; sub: string; group: string;
  status: ModelStatus; portrait?: string; art: { src: string; label: string }[];
  /** What the viewer can show: `button` names it in the switch above the model when there are several. */
  views: { label: string; button?: string; view: View }[];
  search: string;
  detail(): string;
  open?(): void;
}

const TONES: Record<ModelStatus['tone'], string> = { own: 'var(--own)', procedural: 'var(--procedural)', placeholder: 'var(--placeholder)', part: 'var(--part)', none: 'var(--none)' };
const html = (text: unknown) => String(text ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const badge = (status: ModelStatus) => `<span class="badge" style="--c:${TONES[status.tone]}">${html(status.label)}</span>`;
const section = (title: string, body: string) => body ? `<h3>${title}</h3>${body}` : '';
const statsGrid = (stats: Stats, pv = stats.pv) => `<div class="stats"><div>PV<b>${pv}</b></div>${(Object.keys(STAT_LABELS) as (keyof Stats)[]).filter(k => k !== 'pv').map(k => `<div>${STAT_LABELS[k]}<b>${stats[k]}</b></div>`).join('')}</div>`;

/** The portrait of a speaker, and its expressions: public/portraits/<id>[-<expression>].png. */
function portraitArt(speaker?: Speaker) {
  if (!speaker?.portrait) return [];
  return [{ src: `portraits/${speaker.portrait}.png`, label: 'Retrato' }, ...(EXPRESSIONS[speaker.portrait] ?? []).map(e => ({ src: `portraits/${speaker.portrait}-${e}.png`, label: e }))];
}
/** A figure's concept art: the approved image, its three views, and earlier tries. */
function figureArt(figure?: Figure) {
  if (!figure) return [];
  const labels = { front: 'Frente fiel', toy: 'Diseño', left: 'Izquierda', right: 'Derecha', back: 'Espalda' } as const;
  return [...(Object.keys(labels) as (keyof typeof labels)[]).filter(k => figure.files[k]).map(k => ({ src: figure.files[k]!, label: labels[k] })),
    ...figure.earlier.map(src => ({ src, label: `Antes: ${src.split('/').pop()!.replace('.png', '')}` }))];
}
/** What `just character-3d` has made of a figure, step by step. */
function pipeline(figure: Figure) {
  const steps: [string, boolean][] = [['imagen', !!figure.files.toy], ['vistas', !!(figure.files.left && figure.files.back)], ['modelo', !!figure.files.model],
    // Meshy rigs people and monsters; a pet is put on the game's cat skeleton, and the rest stay in one piece.
    ...(figure.kind === 'person' || figure.kind === 'monster' ? [['esqueleto', !!figure.files.rigged] as [string, boolean]] : []),
    ...(figure.kind === 'monster' ? [['clips', !!(figure.files.walking && figure.files.running)] as [string, boolean]] : []),
    ['en el juego', figure.game.glb && figure.game.spec]];
  return `<div class="steps">${steps.map(([name, done]) => `<span class="${done ? 'done' : ''}">${done ? '✓' : '·'} ${name}</span>`).join('')}</div>`;
}
const figureDetail = (figure?: Figure) => figure ? section('Diseño (tools/figures.toml)', `${pipeline(figure)}<p>${html(figure.about).replace(/\n/g, '</p><p>')}</p>${figure.cues ? `<p><small>${html(figure.cues)}</small></p>` : ''}${figure.height ? `<p>Altura: ${figure.height} m</p>` : ''}`) : '';
const answer = (key: string) => CASTLE_ANSWERS[key] ? `<div class="qa"><p><b>Carácter:</b> ${html(CASTLE_ANSWERS[key].character)}</p><p><b>Respuesta:</b> ${html(CASTLE_ANSWERS[key].answer)}</p></div>` : '';
const motion = (lines: string[]) => `<ul>${lines.map(l => `<li>${html(l)}</li>`).join('')}</ul>`;

async function start() {
  const status = document.querySelector<HTMLElement>('#status')!;
  if (!('gpu' in navigator)) { status.textContent = 'Este navegador no tiene WebGPU.'; return; }
  const figures: Figure[] = await fetch('output/bestiary/figures.json').then(r => r.ok ? r.json() : []).catch(() => []);
  const figureOf = (id?: string) => id ? figures.find(f => f.id === id) : undefined;
  const speakersById = SPEAKERS as Record<string, Speaker>;

  // ── The viewer ─────────────────────────────────────────────────────────
  const canvas = document.querySelector<HTMLCanvasElement>('#canvas')!;
  const device = await pc.createGraphicsDevice(canvas, { deviceTypes: [pc.DEVICETYPE_WEBGPU], antialias: true, alpha: false });
  const app = new pc.Application(canvas, { graphicsDevice: device });
  app.setCanvasFillMode(pc.FILLMODE_NONE);
  app.setCanvasResolution(pc.RESOLUTION_AUTO);
  device.maxPixelRatio = Math.min(2, window.devicePixelRatio);
  const resize = () => { const r = canvas.getBoundingClientRect(); app.resizeCanvas(Math.max(1, r.width), Math.max(1, r.height)); };
  new ResizeObserver(resize).observe(canvas);
  app.scene.ambientLight = new pc.Color(.42, .4, .38);
  const camera = new pc.Entity('Cámara');
  camera.addComponent('camera', { clearColor: new pc.Color(.08, .09, .065), fov: 32, nearClip: .05, farClip: 80 });
  app.root.addChild(camera);
  const sun = new pc.Entity('Sol');
  sun.addComponent('light', { type: 'directional', color: new pc.Color(1, .93, .82), intensity: 1.35, castShadows: true, shadowDistance: 12, shadowResolution: 2048 });
  sun.setEulerAngles(48, 28, 0); app.root.addChild(sun);
  const fill = new pc.Entity('Relleno');
  fill.addComponent('light', { type: 'directional', color: new pc.Color(.55, .6, .8), intensity: .45 });
  fill.setEulerAngles(-20, 200, 0); app.root.addChild(fill);
  const ground = new pc.StandardMaterial(); ground.diffuse.set(.15, .16, .12); ground.update();
  const floor = new pc.Entity('Suelo'); floor.addComponent('render', { type: 'plane', material: ground }); floor.setLocalScale(14, 1, 14); app.root.addChild(floor);

  // Everything the game builds its fighters from: the people's files, the minion, the fears' templates.
  await loadCharacterModels(app, [...CHARACTERS, ...CREATURE_SPECS, ...COMPANIONS]).catch(error => console.warn('[bestiario]', error));
  const silent = { emit() {} } as unknown as Effects;
  const minion = createMinion(app, silent);
  minion.root.enabled = false;
  const fears = createFears(app);
  const containers = new Map<string, Promise<pc.ContainerResource>>();
  const container = (url: string) => {
    if (!containers.has(url)) containers.set(url, new Promise((resolve, reject) => app.assets.loadFromUrl(url, 'container', (error, asset) => error || !asset ? reject(error) : resolve(asset.resource as pc.ContainerResource))));
    return containers.get(url)!;
  };

  let shown: pc.Entity | undefined, token = 0;
  // Every model starts front-on (its face towards the camera, +z), still: Aitor wants to see it from the front first.
  const FRONT = { yaw: 0, pitch: 8 };
  let yaw = FRONT.yaw, pitch = FRONT.pitch, distance = 5, spin = false, size = 1.8;
  /** A character in the viewer, posed every frame as the game poses people (walk-animation.ts). */
  let posed: { model: ReturnType<typeof buildCharacter>; walk: WalkAnimation; motion: 'still' | 'walk' | 'run'; time: number } | undefined;
  /** What goes with an ánima, built once by its own module: Papagato's cats, Tecnópata's Bip. */
  let cats: ReturnType<typeof createCat>[] | undefined, bip: ReturnType<typeof createBip> | undefined;
  let companions: { entity: pc.Entity; animate(dt: number): void }[] = [];
  /** The street dogs, built once as the fight builds them, hidden; the viewer shows copies. */
  let dogs: pc.Entity[] | undefined;
  const dogMaterial = (hex: string) => { const m = new pc.StandardMaterial(); m.diffuse.fromString(hex); m.update(); return m; };
  const target = new pc.Vec3(0, .9, 0);
  const controls = document.querySelector<HTMLElement>('#controls')!, note = document.querySelector<HTMLElement>('#model-note')!, empty = document.querySelector<HTMLElement>('#empty')!;
  /** Stands the model on the floor at the middle, and frames it. */
  function frame(entity: pc.Entity) {
    const box = new pc.BoundingBox(); let first = true;
    entity.findComponents('render').forEach(r => (r as pc.RenderComponent).meshInstances.forEach(mi => { if (first) { box.copy(mi.aabb); first = false; } else box.add(mi.aabb); }));
    if (first) return;
    entity.translate(-box.center.x, -box.getMin().y, -box.center.z);
    const he = box.halfExtents;
    size = Math.max(he.y * 2, he.x * 2, he.z * 2, .4);
    // A little headroom: what floats over a head (a grown Matemágico's thoughts, Bip) stays in view.
    target.set(0, he.y * 1.04, 0); distance = size * 2.5 + .6;
  }
  /** A character's motion buttons: still (breathing), walking or running on the spot. */
  function motionButtons() {
    const names = { still: 'Quieto', walk: 'Andar', run: 'Correr' } as const;
    controls.innerHTML = (Object.keys(names) as (keyof typeof names)[]).map(m => `<button data-motion="${m}" aria-pressed="${posed?.motion === m}">${names[m]}</button>`).join('');
    controls.querySelectorAll<HTMLButtonElement>('[data-motion]').forEach(b => b.addEventListener('click', () => {
      if (!posed) return;
      posed.motion = b.dataset.motion as 'still' | 'walk' | 'run';
      controls.querySelectorAll('[data-motion]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    }));
  }
  /** Builds a character into `parent` and poses it from rest; `anima` dresses it as the game does. */
  function person(spec: CharacterSpec, parent: pc.Entity, anima?: ClassId, grown = false) {
    const model = buildCharacter(spec, parent);
    // The file's materials are shared by every copy: dressing puts back what the last ánima dyed, too.
    wearClass(parent, anima, grown);
    posed = { model, walk: new WalkAnimation(), motion: 'still', time: 0 };
    motionButtons();
  }
  async function show(view: View, label = '') {
    const mine = ++token;
    // The cats and Bip are kept for the next time: out of the old model before it goes.
    for (const c of companions) { c.entity.reparent(app.root); c.entity.enabled = false; }
    companions = []; posed = undefined;
    shown?.destroy(); shown = undefined; controls.innerHTML = ''; empty.innerHTML = ''; note.textContent = '';
    yaw = FRONT.yaw; pitch = FRONT.pitch; spin = false;
    const holder = new pc.Entity('Bestia');
    const clips: string[] = [];
    try {
      if (view.type === 'none') { empty.innerHTML = view.image ? `<div><img src="${view.image}" alt=""><p>${html(view.why)}</p></div>` : `<p>${html(view.why)}</p>`; return; }
      if (view.type === 'character') person(view.spec, holder);
      else if (view.type === 'wearer') {
        const spec = characterOf(speakersById[view.profile]?.portrait ?? view.profile);
        if (!spec) throw new Error(`Sin modelo para ${view.profile}.`);
        const wearer = new pc.Entity('Quien la lleva'), scale = wearerScale(view.profile);
        wearer.setLocalScale(scale, scale, scale); holder.addChild(wearer);
        person(spec, wearer, view.anima, grownUp(view.profile));
        // What goes with the ánima, by its own module: Haru and Yuki at the feet, Bip floating beside.
        if (view.anima === 'papagato') {
          cats ??= [createCat(app, 'haru'), createCat(app, 'yuki')];
          cats.forEach((cat, i) => { cat.entity.reparent(holder); cat.entity.enabled = true; cat.entity.setLocalPosition((i ? -1 : 1) * .62 * scale, 0, .4 * scale); cat.entity.setLocalEulerAngles(0, 0, 0); cat.entity.setLocalScale(1.35, 1.35, 1.35); companions.push({ entity: cat.entity, animate: dt => cat.animate(dt) }); });
        }
        if (view.anima === 'tecnopata') {
          bip ??= createBip(app);
          const b = bip;
          b.entity.reparent(holder); b.entity.enabled = true;
          b.entity.setLocalPosition(BIP.beside * scale, BIP.height * scale, 0); b.entity.setLocalEulerAngles(0, 0, 0);
          const k = BIP.scale * scale; b.entity.setLocalScale(k, k, k);
          companions.push({ entity: b.entity, animate: dt => b.animate(dt) });
        }
      } else if (view.type === 'dogs') {
        dogs ??= buildStreetDogs(app.root, dogMaterial, dogMaterial('#3c302a'));
        dogs.forEach((dog, i) => { const copy = dog.clone(); copy.enabled = true; copy.setLocalPosition((i - 1.5) * .8, 0, 0); copy.setLocalEulerAngles(0, 0, 0); holder.addChild(copy); });
      } else if (view.type === 'cat') {
        cats ??= [createCat(app, 'haru'), createCat(app, 'yuki')];
        const cat = cats[view.id === 'haru' ? 0 : 1];
        cat.entity.reparent(holder); cat.entity.enabled = true; cat.entity.setLocalPosition(0, 0, 0); cat.entity.setLocalEulerAngles(0, 0, 0); cat.entity.setLocalScale(1.35, 1.35, 1.35);
        companions.push({ entity: cat.entity, animate: dt => cat.animate(dt) });
      } else if (view.type === 'creature') buildCreature(view.spec, holder).enabled = true;
      else if (view.type === 'template' || view.type === 'minion') {
        const source = view.type === 'template' ? fears.templates.get(view.kind)! : minion.root;
        const model = source.clone(); model.enabled = true; model.setLocalPosition(0, 0, 0);
        const s = foeScale(view.kind, view.type === 'template' ? view.layers : 0, view.type === 'template'); model.setLocalScale(s, s, s);
        holder.addChild(model);
      } else {
        const url = view.type === 'monster' ? view.spec.glb : view.url;
        const file = await container(url);
        if (mine !== token) return;
        const model = file.instantiateRenderEntity({ castShadows: true }) as pc.Entity;
        holder.addChild(model);
        clips.push(...file.animations.map(a => a.name || a.resource?.name || 'clip'));
        if (view.type === 'monster') {
          model.addComponent('anim', { activate: true });
          const rest = file.animations[0]?.resource as pc.AnimTrack | undefined;
          if (rest) model.anim!.assignAnimation('Quieto', rest);
          const names = Object.keys(view.spec.clips);
          const files = await Promise.all(names.map(name => container(view.spec.clips[name]).catch(() => undefined)));
          if (mine !== token) return;
          // A file of moves from Meshy's library (`actions`) holds one clip per move, each named as the library names it.
          const tracks: [string, pc.AnimTrack][] = [];
          names.forEach((name, i) => {
            const anims = (files[i]?.animations ?? []).map(a => a.resource as pc.AnimTrack | undefined).filter((t): t is pc.AnimTrack => !!t);
            // Meshy names a library move `Armature|Monster_Walk|baselayer`: the button says «Monster Walk».
            const moveName = (t: pc.AnimTrack, k: number) => (t.name || `${name} ${k + 1}`).replace(/^Armature\|/, '').replace(/\|baselayer$/, '').replace(/_/g, ' ');
            if (anims.length > 1 || (name === 'actions' && anims[0])) anims.forEach((t, k) => tracks.push([moveName(t, k), t]));
            else if (anims[0]) tracks.push([name, anims[0]]);
          });
          tracks.forEach(([name, track]) => { model.anim!.assignAnimation(name, track); clips.push(`${name} (clip de Meshy)`); });
          // Each clip from its first frame (no blend), so a chosen monster starts its motion from the start.
          const play = (state: string) => { model.anim!.baseLayer?.transition(state, 0, 0); controls.querySelectorAll<HTMLButtonElement>('[data-clip]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.clip === state))); };
          controls.innerHTML = [...(rest ? ['Quieto'] : []), ...tracks.map(([n]) => n)].map(n => `<button data-clip="${html(n)}">${n === 'walking' ? 'Andar' : n === 'running' ? 'Correr' : html(n)}</button>`).join('');
          controls.querySelectorAll<HTMLButtonElement>('[data-clip]').forEach(b => b.addEventListener('click', () => play(b.dataset.clip!)));
          if (tracks.length) play(tracks[0][0]);
        }
      }
      if (mine !== token) return;
      app.root.addChild(holder); shown = holder;
      frame(holder);
      // A skinned model's bounds are only right once it has been drawn: frame it again then.
      let frames = 0;
      const again = () => { if (mine !== token || shown !== holder) { app.off('update', again); return; } if (++frames === 4) { frame(holder); app.off('update', again); } };
      app.on('update', again);
      note.innerHTML = `${html(label)}${clips.length ? ` · clips en el archivo: ${clips.map(html).join(', ')}` : ''}`;
    } catch (error) {
      empty.innerHTML = `<p>No se pudo montar el modelo: ${html((error as Error).message)}</p>`;
      holder.destroy();
    } finally {
      if (mine === token) {
        const spinButton = document.createElement('button');
        spinButton.textContent = 'Girar'; spinButton.setAttribute('aria-pressed', String(spin));
        spinButton.addEventListener('click', () => { spin = !spin; spinButton.setAttribute('aria-pressed', String(spin)); });
        if (view.type !== 'none') controls.append(spinButton);
      }
    }
  }
  let drag: { x: number; y: number } | undefined;
  canvas.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY }; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointermove', e => {
    if (!drag) return;
    yaw -= (e.clientX - drag.x) * .35; pitch = pc.math.clamp(pitch + (e.clientY - drag.y) * .25, -5, 75);
    drag = { x: e.clientX, y: e.clientY };
  });
  canvas.addEventListener('pointerup', () => { drag = undefined; });
  canvas.addEventListener('wheel', e => { distance = pc.math.clamp(distance * (1 + e.deltaY * .001), size * .6, size * 6 + 2); e.preventDefault(); }, { passive: false });
  app.on('update', (dt: number) => {
    if (posed) {
      // As the game poses its people (game.ts): a gait, the body carried into it, breathing at rest; on the spot, facing +z.
      const { model, walk } = posed;
      posed.time += dt;
      const gait = walk.update(dt, posed.motion !== 'still', true, .36, posed.motion === 'run');
      const idle = idlePose(posed.time), resting = posed.motion === 'still' ? 1 - gait.weight : 0, carried = carriage(gait);
      model.body.setLocalEulerAngles(carried.pitch, carried.twist, carried.roll + Math.sin(posed.time * .55) * 1.1 * resting);
      poseLimbs(model, gait, idle.breathe, resting);
      model.body.setLocalScale(1, 1 + idle.breathe * .016 * resting, 1);
    }
    for (const c of companions) c.animate(dt);
    if (spin && !drag) yaw += dt * 14;
    const y = pc.math.DEG_TO_RAD * yaw, p = pc.math.DEG_TO_RAD * pitch;
    camera.setPosition(target.x + Math.sin(y) * Math.cos(p) * distance, target.y + Math.sin(p) * distance, target.z + Math.cos(y) * Math.cos(p) * distance);
    camera.lookAt(target);
  });
  app.start();
  resize();

  // ── Everyone ───────────────────────────────────────────────────────────
  const entries: Entry[] = [];
  const speakers = SPEAKERS as Record<string, Speaker>;
  const foes = foesOfTheGame();
  // The party: whoever speaks and has a fighter's profile (stats.ts) without being a foe.
  const party = (Object.keys(speakers) as string[]).filter(id => id in PROFILES && !foes.some(f => f.kind === id)) as ProfileId[];
  const figureLinks = (key: string) => figures.filter(f => (f.kind === 'monster' || f.kind === 'creature') && (f.id === key || f.id.startsWith(`${key}-`)));
  const characterView = (spec?: CharacterSpec, figure?: Figure): View => spec ? { type: 'character', spec }
    : { type: 'none', why: 'Sin modelo 3D todavía.', image: figure?.files.toy };
  const characterStatus = (spec?: CharacterSpec): ModelStatus => spec?.glb ? { tone: 'own', label: 'Modelo propio (just character-3d, rig del juego)' }
    : spec ? { tone: 'procedural', label: 'Primitivas (sin modelo de Meshy)' } : { tone: 'none', label: 'Sin modelo 3D' };

  for (const id of party) {
    const speaker = speakers[id], spec = characterOf(speaker.portrait ?? id), figure = figureOf(spec?.id);
    entries.push({
      key: `aliado:${id}`, filter: 'aliados', name: speaker.name, sub: id === 'gerard' || id === 'bernat' ? 'Capítulo 1, de niño' : 'Capítulo 2', group: 'El grupo',
      status: characterStatus(spec), portrait: speaker.portrait, art: [...portraitArt(speaker), ...figureArt(figure)],
      // Plain, and wearing each ánima the game lets them wear.
      views: [{ label: spec ? `src/characters/${spec.id}.json` : '', button: 'Sin ánima', view: characterView(spec, figure) },
        ...spec ? (Object.keys(CLASSES) as ClassId[]).filter(a => canWear(id, a)).map(a => ({ label: `${speaker.name} con ${CLASSES[a].name} (wearClass)`, button: CLASSES[a].name, view: { type: 'wearer', profile: id, anima: a } as View })) : []],
      search: `${speaker.name} ${id} aliado grupo`,
      detail: () => `${section('Rasgos', statsGrid(PROFILES[id]))}${section('Ataques', `<p>Atacar, Defender y las habilidades del ánima que lleve: ver las ánimas en esta misma lista.</p>`)}${section('Animaciones', motion(MOTION.party))}${figureDetail(figure)}`,
    });
  }
  // The ánimas the party wears: on whoever can wear them, dressed by the game, and all the code says of them.
  for (const id of Object.keys(CLASSES) as ClassId[]) {
    const anima = CLASSES[id], skills = SKILLS.filter(s => s.class === id), jar = IMPROVEMENTS.filter(i => i.anima === id);
    const duals = DUALS.filter(d => d.parts.some(part => skills.some(s => s.id === part)));
    const wearers = WEARERS.filter(w => canWear(w.profile, id)).sort((a, b) => Number(b.profile === firstWearer(id)) - Number(a.profile === firstWearer(id)));
    const owner = ANIMA_OWNERS[id];
    const level = (s: (typeof skills)[number]) => 'level' in s ? s.level : 1;
    const skillLine = (s: (typeof skills)[number]) => `<div class="skill"><b>${html(s.name)}</b><small>${s.cost} maná · ${KINDS[s.kind] ?? s.kind}${'element' in s && s.element ? ` · ${ELEMENTS[s.element].name}` : ''}</small><p>${html(s.description)}</p></div>`;
    const byLevel = LEVELLED.includes(id) ? Array.from({ length: topOf(id) }, (_, i) => i + 1).map(n => [n, skills.filter(s => !('node' in s && s.node) && level(s) === n)] as const).filter(([, list]) => list.length) : [];
    const lines = [...new Set(jar.map(i => i.line))];
    entries.push({
      key: `anima:${id}`, filter: 'aliados', name: anima.name, sub: anima.motto, group: 'Ánimas',
      status: { tone: 'own', label: 'Se lleva puesta: ropa teñida y piezas del ánima (classes.ts, anima-looks.ts)' }, art: [],
      views: [...wearers.map(w => ({ label: `${w.name} con ${anima.name} (wearClass, como en el juego)`, button: w.name, view: { type: 'wearer', profile: w.profile, anima: id } as View })),
        { label: `${wearers[0]?.name ?? 'Gerard'} sin ánima, para comparar`, button: 'Sin ánima', view: { type: 'wearer', profile: wearers[0]?.profile ?? 'gerard35' } }],
      search: `${anima.name} ánima ${skills.map(s => s.name).join(' ')}`,
      detail: () => `<div class="swatches"><span><i style="--c:${anima.colour}"></i>${html(anima.colour)} · su color</span>${anima.scarf ? `<span><i style="--c:${anima.scarf}"></i>pañuelo</span>` : ''}${Object.entries(anima.look).map(([role, colour]) => `<span><i style="--c:${colour}"></i>${html(role)}</span>`).join('')}</div>
        <p>${owner ? `Es de ${owner === 'gerard' ? 'Gerard' : 'Aitor'}: solo la lleva él.` : 'Compartida: la puede llevar cualquiera del grupo menos Bernat.'} ${wearers.map(w => w.name).join(', ')}.</p>
        ${section('Suma a quien la lleva', `<p>${Object.entries(CLASS_STATS[id]).map(([k, v]) => `${STAT_LABELS[k as keyof Stats] ?? k} ${v! > 0 ? '+' : ''}${v}`).join(' · ') || 'Nada todavía.'}</p><p>Maná: ${MANA_POINTS}${jar.some(i => i.mana) ? `, y ${jar.filter(i => i.mana).map(i => `+${i.mana}`).join(', ')} en el tarro` : ''}.</p>`)}
        ${section('Cómo crece', `<p>${LEVELLED.includes(id) ? `Por niveles, hasta el ${topOf(id)} (EXP ${LEVEL_XP.slice(0, topOf(id) - 1).join(' · ')}).` : 'Por su árbol en el tarro, con Ecos de luz.'}</p>`)}
        ${section('Habilidades', byLevel.length ? byLevel.map(([n, list]) => `<p><b>Nivel ${n}</b></p>${list.map(skillLine).join('')}`).join('') : skills.filter(s => !('node' in s && s.node)).map(skillLine).join('') || '<p>Ninguna de base.</p>')}
        ${section('El tarro (Ecos de luz)', lines.map(line => `<div class="tree"><b>${line ? html(LINES[line].name) : 'Suelto'}</b>${jar.filter(i => i.line === line).map(i => `<div class="skill"><b>${html(i.name)}</b><small>${i.cost} eco${i.cost > 1 ? 's' : ''} · ${{ mana: 'maná', element: 'elemento', skill: 'habilidad', passive: 'pasiva', ulti: 'definitiva', dual: 'dúo mayor' }[i.kind]}${i.veiled ? ' · dormida' : ''}</small><p>${html(i.description)}</p></div>`).join('')}</div>`).join(''))}
        ${section('Pasivas', (Object.keys(PASSIVES) as (keyof typeof PASSIVES)[]).filter(k => PASSIVES[k].anima === id).map(k => `<p><b>${html(PASSIVES[k].name)}</b> · ${html(jar.find(i => i.passive === k)?.description ?? '')}</p>`).join(''))}
        ${section('Duales', duals.map(d => `<div class="skill"><b>${html(d.name)}</b><small>${d.parts.map(p => SKILLS.find(s => s.id === p)?.name).join(' + ')}</small><p>${html(d.description)}</p></div>`).join(''))}`,
    });
  }
  // The friends' ánimas: a bonus for the whole party, shown on the friend whose it is.
  for (const anima of Object.values(ANIMAS)) {
    const spec = characterOf(speakersById[anima.id]?.portrait ?? anima.id);
    entries.push({
      key: `anima:${anima.id}`, filter: 'aliados', name: anima.name, sub: anima.friend, group: 'Ánimas',
      status: { tone: 'part', label: 'Ánima de amigo: un bonus para todo el grupo, sin pieza que se vea' }, art: portraitArt(speakersById[anima.id]),
      views: [{ label: spec ? `${anima.friend}: de quien es` : '', view: spec ? { type: 'character', spec } : { type: 'none', why: `${anima.friend}: no se lleva puesta y no hay un solo modelo que la represente.` } }],
      search: `${anima.name} ${anima.friend} ánima amigo`,
      detail: () => `<div class="swatches"><span><i style="--c:${anima.colour}"></i>${html(anima.colour)}</span></div>${section('Bonus para todo el grupo', `<p>${Object.entries(anima.bonus).map(([k, v]) => `${STAT_LABELS[k as keyof Stats] ?? k} +${v}`).join(' · ')}</p><p>${html(anima.note)}</p>`)}`,
    });
  }

  // The foes, from every fight of the game as the game builds it.
  const moveCache = new Map<FoeKind, ReturnType<typeof movesOf>>();
  const speakerOfFoe = (seen: FoeKindSeen) => speakers[seen.kind] ?? speakers[seen.meetings[0].foe.id] ?? speakers[seen.kind.replace(/^sobremesa-/, '')];
  for (const seen of foes) {
    const template = fears.templates.has(seen.kind);
    // The management team is one kind with three figures, Mar's, Montse's and Pilar's (src/castle-models.ts `castleFigure`).
    const own = seen.kind === 'directiva' ? DIRECTIVAS.map(d => d.id as string) : [seen.kind as string];
    const speaker = speakerOfFoe(seen), designs = own.flatMap(figureLinks), monsters = own.flatMap(id => MONSTERS.filter(m => m.id === id)), monster = monsters[0];
    // A castle foe in one piece (El Montón, El Atril) is a creature's file.
    const piece = isCastle(seen.kind) && !monster ? CREATURE_SPECS.find(c => c.id === seen.kind) : undefined;
    // A castle foe with a figure of its own fights with it (src/castle-models.ts): that is what the fight draws.
    const fightsWithIt = (!!monster || !!piece) && isCastle(seen.kind);
    const status: ModelStatus = fightsWithIt ? { tone: 'own', label: `Modelo propio: su figura de Meshy (${monster ? monsters.map(m => `src/monsters/${m.id}.json`).join(', ') : `src/creatures/${piece!.id}.json`})` } : modelStatusOf(seen.kind, template);
    const family = familyOf(seen.kind, template);
    const inGame: View = fightsWithIt ? monster ? { type: 'monster', spec: monster } : { type: 'creature', spec: piece! } : seen.kind.startsWith('sobremesa-') ? { type: 'glb', url: SOBREMESA_URL }
      : template ? { type: 'template', kind: seen.kind, layers: seen.meetings[0].foe.layers ?? 0 }
      : status.tone === 'placeholder' || seen.kind === 'minion' ? { type: 'minion', kind: seen.kind }
      : seen.kind === 'dog' ? { type: 'dogs' }
      // Vertitrón's eye is the one in its chest: it is shown on him.
      : seen.kind === 'vertigo-ojo' && fears.templates.has('vertigo') ? { type: 'template', kind: 'vertigo', layers: 0 }
      : { type: 'none', why: status.label };
    const views = [{ label: `En el combate: ${status.label}`, button: monsters.length > 1 ? monster.name : 'En el juego', view: inGame },
      ...fightsWithIt ? monsters.slice(1).map(m => ({ label: `En el combate: ${m.name}`, button: m.name, view: { type: 'monster', spec: m } as View })) : [],
      ...monster && !fightsWithIt ? [{ label: 'Modelo nuevo (sin conectar al combate)', button: 'Nuevo', view: { type: 'monster', spec: monster } as View }] : []];
    const fights = seen.meetings.map(m => m.fight);
    entries.push({
      key: `enemigo:${seen.kind}`, filter: 'enemigos', name: seen.name, sub: seen.aka.length ? `También: ${seen.aka.join(', ')}` : '', group: seen.place.name,
      status: monster && !fightsWithIt ? { tone: 'placeholder', label: 'Modelo nuevo hecho, el combate aún usa el provisional' } : status,
      portrait: speaker?.portrait, art: [...portraitArt(speaker), ...designs.flatMap(f => figureArt(f).map(a => ({ ...a, label: `${f.id} · ${a.label}` })))],
      views,
      search: `${seen.name} ${seen.aka.join(' ')} ${seen.kind} ${seen.place.name} ${fights.join(' ')} enemigo`,
      detail: () => {
        const first = traitsOf(seen.meetings[0].foe);
        const table = `<table><tr><th>Combate</th><th>PV</th><th>Elementos</th><th>Lleva</th></tr>${seen.meetings.map(m => { const t = traitsOf(m.foe); return `<tr><td>${html(fightName(m.fight))}</td><td>${t.pv}</td><td>${t.affinities.map(a => `<span style="color:${a.colour}">${a.affinity === 'weak' ? 'débil a' : 'resiste'} ${html(a.element)}</span>`).join('<br>') || '—'}</td><td>${t.flags.map(html).join('<br>') || '—'}</td></tr>`; }).join('')}</table>`;
        const targets = [...new Map(fights.flatMap(targetsOf).map(t => [t.id, t])).values()];
        const cached = moveCache.get(seen.kind);
        const moves = cached ? cached.moves.length ? cached.moves.map(m => `<div class="move"><span>${m.card ? '<b>' : ''}${html(m.name)}${m.card ? '</b>' : ''}</span><small>${m.times} veces en ${cached.runs} combates</small></div>`).join('') : `<p>Solo golpes sin nombre (en ${cached.runs} combates simulados).</p>`
          : '<p id="moves-wait">Simulando sus combates…</p>';
        return `<p>${badge(status)}${monster && !fightsWithIt ? badge({ tone: 'own', label: 'Modelo nuevo listo: src/monsters/' + monster.id + '.json' }) : ''}</p>
          ${section('Rasgos', `${statsGrid(seen.meetings[0].foe.stats, first.pv)}${table}`)}
          ${section('Ataques (los que usa, simulados con el bot del simulador)', moves + (cached?.failed.length ? `<p><small>${cached.failed.map(html).join('<br>')}</small></p>` : ''))}
          ${section('Truco del combate', answer(seen.kind) + targets.map(t => `<p class="why">${html(t.why)} <small>${t.id} · ${t.policy}${t.win ? ` · gana ${Math.round(t.win[0] * 100)}–${Math.round(t.win[1] * 100)} %` : ''}</small></p>`).join(''))}
          ${section('Animaciones', fightsWithIt ? motion(MOTION[piece ? 'castlePiece' : 'castle']) : motion(MOTION[family]) + (monster ? `<p>Modelo nuevo: ${motion(MOTION.monster)}</p>` : ''))}
          ${section('Dónde aparece', `<p>${fights.map(f => html(fightName(f))).join(' · ')}</p>`)}
          ${designs.map(figureDetail).join('')}`;
      },
      open: () => {
        if (moveCache.has(seen.kind)) return;
        setTimeout(() => {
          moveCache.set(seen.kind, movesOf(seen.kind, fights, 4));
          if (selected?.key === `enemigo:${seen.kind}`) renderDetail();
        }, 30);
      },
    });
  }

  // The monsters being designed (tools/figures.toml, kind monster or creature).
  for (const figure of figures.filter(f => f.kind === 'monster' || f.kind === 'creature')) {
    const monster = MONSTERS.find(m => m.id === figure.id), creature = CREATURE_SPECS.find(c => c.id === figure.id);
    const foe = foes.find(f => figure.id === f.kind || figure.id.startsWith(`${f.kind}-`));
    const base = foe?.kind ?? figure.id.split('-')[0];
    const view: View = monster ? { type: 'monster', spec: monster } : creature ? { type: 'creature', spec: creature }
      : { type: 'none', why: figure.files.model ? 'Modelo hecho en output/, aún sin pasar al juego (just character-3d --from game).' : 'Solo la imagen de diseño: aún sin modelo 3D.', image: figure.files.toy };
    const status: ModelStatus = monster || creature ? { tone: 'own', label: 'Modelo 3D hecho' } : figure.files.model ? { tone: 'procedural', label: 'Modelo en output/, sin pasar al juego' } : { tone: 'none', label: figure.files.toy ? 'Solo diseño (imagen)' : 'Sin imagen aún' };
    entries.push({
      key: `diseno:${figure.id}`, filter: 'diseno', name: figure.name, sub: foe ? `En el juego: ${foe.name} (${modelStatusOf(foe.kind, fears.templates.has(foe.kind)).label.toLowerCase()})` : 'Aún no está en ningún combate', group: foe?.place.name ?? 'Por llegar',
      status, art: figureArt(figure), views: [{ label: monster ? `src/monsters/${figure.id}.json` : '', view }],
      search: `${figure.name} ${figure.id} diseño monstruo ${foe?.place.name ?? ''}`,
      detail: () => `${section('Truco del combate', answer(base))}${section('Animaciones', motion(MOTION[figure.kind === 'creature' ? 'creature' : 'monster']))}${figureDetail(figure)}`,
    });
  }

  // Who goes with the cast: Nuria's cats, on the game's cat skeleton, and Nil in Uri's arms.
  for (const figure of figures.filter(f => f.kind === 'animal' || f.kind === 'held')) {
    const cat = figure.kind === 'animal', made = figure.game.glb && figure.game.spec;
    const held = Object.values(HELD).find(h => h.id === figure.id);
    entries.push({
      key: `npc:${figure.id}`, filter: cat ? 'aliados' : 'npc', name: figure.name, sub: cat ? 'Papagato: va con el grupo y pelea' : 'En brazos de Uri',
      group: 'Casa de Nuria',
      status: made ? { tone: 'own', label: cat ? 'Modelo propio: figura de Meshy en el esqueleto de gato del juego' : 'Modelo propio: figura de Meshy, en brazos de quien lo lleva' }
        : cat ? { tone: 'procedural', label: 'Procedural (primitivas en src/cats.ts)' } : { tone: 'none', label: figure.files.toy ? 'Solo diseño (imagen)' : 'Sin imagen aún' },
      art: figureArt(figure),
      views: [{ label: made ? `src/${cat ? 'animals' : 'held'}/${figure.id}.json` : '', view: cat ? { type: 'cat', id: figure.id as CatId } : held ? { type: 'glb', url: held.glb } : { type: 'none', why: 'Aún sin modelo en el juego.', image: figure.files.toy } }],
      search: `${figure.name} ${figure.id} ${cat ? 'gato papagato aliado' : 'npc bebé'} nuria`,
      detail: () => `${cat ? section('Animaciones', '<p>El andar de los gatos (src/cat-gait.ts): paso, trote y galope, sentarse, agazaparse, saltar y esconderse; respira, parpadea, mueve las orejas y la cola.</p>') : ''}${figureDetail(figure)}`,
    });
  }

  // People: every speaker who is not in the party, and any character file nobody speaks for. A foe that
  // only speaks to shout in a fight (a mago, Aurelià) is the foe's entry, unless it has a body of its own.
  const used = new Set<string>();
  for (const [id, speaker] of Object.entries(speakers)) {
    if ((party as string[]).includes(id)) continue;
    const spec = characterOf(speaker.portrait ?? id) ?? characterOf(id), figure = figureOf(spec?.id ?? id);
    if (!spec && foes.some(f => f.kind === id)) continue;
    if (spec) used.add(spec.id);
    entries.push({
      key: `npc:${id}`, filter: 'npc', name: speaker.name, sub: speaker.portrait ? '' : 'Sin retrato', group: 'Gente',
      status: characterStatus(spec), portrait: speaker.portrait, art: [...portraitArt(speaker), ...figureArt(figure)],
      views: [{ label: spec ? `src/characters/${spec.id}.json` : '', view: characterView(spec, figure) }],
      search: `${speaker.name} ${id} npc`,
      detail: () => `${speaker.portrait ? '' : `<p>${badge({ tone: 'none', label: 'Sin retrato' })}</p>`}${section('Animaciones', spec ? motion(MOTION.party) : '')}${figureDetail(figure)}`,
    });
  }
  for (const spec of CHARACTERS) {
    if (used.has(spec.id) || party.some(id => (speakers[id].portrait ?? id) === spec.id)) continue;
    const figure = figureOf(spec.id);
    entries.push({
      key: `npc:${spec.id}`, filter: 'npc', name: spec.name, sub: 'Sin línea de diálogo', group: 'Gente', status: characterStatus(spec), art: figureArt(figure),
      views: [{ label: `src/characters/${spec.id}.json`, view: characterView(spec, figure) }], search: `${spec.name} ${spec.id} npc`,
      detail: () => `${section('Animaciones', motion(MOTION.party))}${figureDetail(figure)}`,
    });
  }

  // ── Notes ──────────────────────────────────────────────────────────────
  // Aitor's comments and what he marks to redo (src/bestiary-notes.ts), in docs/bestiary-notes.json
  // through the dev server; `?notas=scratch` uses the screenshots' scratch file instead.
  const query = new URLSearchParams(location.search);
  const scratch = query.get('notas') === 'scratch';
  const endpoint = `${NOTES_ENDPOINT}${scratch ? '?archivo=scratch' : ''}`;
  let notes: Note[] = [], writable = false, notesError = '';
  try {
    const answer = await fetch(endpoint);
    const data = answer.ok && answer.headers.get('content-type')?.includes('json') ? await answer.json() as NotesFile : undefined;
    if (data && Array.isArray(data.notes)) { notes = data.notes; writable = true; }
  } catch { /* a build: no dev server to keep them */ }
  async function saveNotes() {
    try {
      const answer = await fetch(endpoint, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ notes }) });
      const body = await answer.json() as NotesFile & { error?: string };
      if (!answer.ok) throw new Error(body.error ?? String(answer.status));
      notes = body.notes; notesError = '';
    } catch (error) { notesError = `No se pudo guardar: ${(error as Error).message}`; }
    renderList(); renderDetail();
  }
  const notesOf = (key: string) => notes.filter(n => n.entry === key);
  const openNotes = (key: string) => notesOf(key).filter(n => n.status === 'abierta');
  /** The note being written, kept while the detail is drawn again (the simulated moves arriving). */
  let draft: { entry: string; redo: Redo[]; text: string } = { entry: '', redo: [], text: '' };
  const fmtDate = (iso: string) => new Date(iso).toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  function notesSection(e: Entry) {
    if (draft.entry !== e.key) draft = { entry: e.key, redo: [], text: '' };
    const mine = [...notesOf(e.key)].sort((a, b) => Number(b.status === 'abierta') - Number(a.status === 'abierta'));
    const one = (n: Note) => `<div class="note ${n.status}" data-note="${n.id}">
        <div class="note-head">${n.redo.map(r => `<span class="redo-tag">Rehacer · ${html(r)}</span>`).join('')}<span class="state">${STATUS_NAMES[n.status]}</span><small>${fmtDate(n.created)}${n.closed ? ` → ${fmtDate(n.closed)}` : ''}</small></div>
        ${n.text ? `<p>${html(n.text).replace(/\n/g, '<br>')}</p>` : ''}
        ${n.reply ? `<p class="reply"><b>Respuesta:</b> ${html(n.reply).replace(/\n/g, '<br>')}</p>` : ''}
        ${writable ? `<div class="note-actions">${n.status === 'abierta' ? '<button data-act="hecha">Hecha</button><button data-act="descartada">Descartar</button>' : '<button data-act="abierta">Reabrir</button>'}<button data-act="borrar">Borrar</button></div>` : ''}
      </div>`;
    const form = writable ? `<div class="note-form">
        <div class="redo-chips"><span>Rehacer ·</span>${REDO.map(r => `<button data-redo="${r}" aria-pressed="${draft.redo.includes(r)}">${r}</button>`).join('')}</div>
        <textarea id="note-text" rows="3" placeholder="Comentario">${html(draft.text)}</textarea>
        <div class="note-save"><small>Ctrl/⌘ + Enter</small><button data-save>Guardar nota</button></div>
      </div>` : '<p class="ro">Las notas solo se pueden escribir con <code>just bestiario</code> (el servidor de desarrollo las guarda en docs/bestiary-notes.json).</p>';
    return `<h3>Notas${openNotes(e.key).length ? ` · ${openNotes(e.key).length} abierta${openNotes(e.key).length > 1 ? 's' : ''}` : ''}</h3>${mine.map(one).join('')}${form}${notesError ? `<p class="err">${html(notesError)}</p>` : ''}`;
  }
  function addNote() {
    if (!selected || !writable || (!draft.text.trim() && !draft.redo.length)) return;
    notes = [...notes, newNote(selected.key, selected.name, draft.redo, draft.text)];
    draft = { entry: selected.key, redo: [], text: '' };
    void saveNotes();
  }
  function act(id: string, action: string) {
    const note = notes.find(n => n.id === id);
    if (!note) return;
    if (action === 'borrar') notes = notes.filter(n => n !== note);
    else if (action === 'abierta') { note.status = 'abierta'; delete note.closed; }
    else if (action === 'hecha' || action === 'descartada') { note.status = action; note.closed = isoNow(); }
    void saveNotes();
  }

  // ── The page ───────────────────────────────────────────────────────────
  const list = document.querySelector<HTMLElement>('#list')!, detail = document.querySelector<HTMLElement>('#detail')!, strip = document.querySelector<HTMLElement>('#strip')!;
  const search = document.querySelector<HTMLInputElement>('#search')!, chips = document.querySelector<HTMLElement>('#filters')!, viewBar = document.querySelector<HTMLElement>('#views')!;
  let filter: keyof typeof FILTERS = 'todos', selected: Entry | undefined, viewIndex = 0;
  const matches = (e: Entry) => (filter === 'todos' || (filter === 'mejorar' ? e.status.tone === 'placeholder' || e.status.tone === 'none' : filter === 'notas' ? openNotes(e.key).length > 0 : e.filter === filter))
    && (!search.value.trim() || e.search.toLowerCase().includes(search.value.trim().toLowerCase()) || e.name.toLowerCase().includes(search.value.trim().toLowerCase()));
  const order: Filter[] = ['aliados', 'enemigos', 'diseno', 'npc'];
  function renderList() {
    chips.innerHTML = (Object.keys(FILTERS) as (keyof typeof FILTERS)[]).map(f => `<button data-filter="${f}" aria-pressed="${f === filter}">${FILTERS[f]}</button>`).join('');
    const shown = entries.filter(matches).sort((a, b) => order.indexOf(a.filter) - order.indexOf(b.filter));
    const groups = new Map<string, Entry[]>();
    for (const e of shown) { const g = `${FILTERS[e.filter]} · ${e.group}`; groups.set(g, [...groups.get(g) ?? [], e]); }
    list.innerHTML = [...groups].map(([group, items]) => `<h2>${html(group)}</h2>${items.map(e => `<a data-key="${e.key}" aria-current="${e === selected}"><span class="dot" style="--c:${TONES[e.status.tone]}" title="${html(e.status.label)}"></span><span>${html(e.name)}</span><small>${mark(e.key)}${e.portrait ? '◐' : ''}</small></a>`).join('')}`).join('') || `<p style="padding:12px;color:var(--dim)">${filter === 'notas' ? 'Ninguna nota abierta.' : 'Nada con ese nombre.'}</p>`;
    const open = notes.filter(n => n.status === 'abierta').length;
    document.querySelector('#count')!.innerHTML = `${shown.length} de ${entries.length}${open ? ` · <span class="open-notes">✎ ${open} nota${open > 1 ? 's' : ''} abierta${open > 1 ? 's' : ''}</span>` : ''}`;
  }
  /** An entry's open notes in the list: ✎ and how many, red when one asks to redo something. */
  function mark(key: string) {
    const open = openNotes(key);
    return open.length ? `<span class="mark${open.some(n => n.redo.length) ? ' redo' : ''}" title="${open.length} nota${open.length > 1 ? 's' : ''} abierta${open.length > 1 ? 's' : ''}">✎ ${open.length}</span> ` : '';
  }
  function renderDetail() {
    if (!selected) return;
    const e = selected;
    const focused = document.activeElement?.id === 'note-text';
    detail.innerHTML = `<h2>${html(e.name)}</h2><p class="sub">${html(FILTERS[e.filter])} · ${html(e.group)}${e.sub ? ` · ${html(e.sub)}` : ''}</p>${e.filter === 'enemigos' ? '' : `<p>${badge(e.status)}</p>`}<section class="notes">${notesSection(e)}</section>${e.detail()}`;
    if (focused) { const text = detail.querySelector<HTMLTextAreaElement>('#note-text'); text?.focus(); text?.setSelectionRange(text.value.length, text.value.length); }
  }
  detail.addEventListener('click', ev => {
    const target = ev.target as HTMLElement;
    const chip = target.closest<HTMLButtonElement>('[data-redo]');
    if (chip) { const r = chip.dataset.redo as Redo; draft.redo = draft.redo.includes(r) ? draft.redo.filter(x => x !== r) : [...draft.redo, r]; chip.setAttribute('aria-pressed', String(draft.redo.includes(r))); return; }
    if (target.closest('[data-save]')) { addNote(); return; }
    const action = target.closest<HTMLButtonElement>('[data-act]');
    if (action) act(action.closest<HTMLElement>('[data-note]')!.dataset.note!, action.dataset.act!);
  });
  detail.addEventListener('input', ev => { if ((ev.target as HTMLElement).id === 'note-text') draft.text = (ev.target as HTMLTextAreaElement).value; });
  // Typing a note never reaches the page's own keys; Ctrl/⌘ + Enter saves it.
  detail.addEventListener('keydown', ev => {
    if ((ev.target as HTMLElement).id !== 'note-text') return;
    ev.stopPropagation();
    if (ev.key === 'Enter' && (ev.ctrlKey || ev.metaKey)) { ev.preventDefault(); addNote(); }
  });
  function renderStrip() {
    const e = selected!;
    viewBar.innerHTML = e.views.length > 1 ? e.views.map((v, i) => `<button data-view="${i}" aria-pressed="${i === viewIndex}">${html(v.button ?? v.label)}</button>`).join('') : '';
    strip.innerHTML = (e.art.length ? e.art.map(a => `<figure><img src="${a.src}" alt="${html(a.label)}" loading="lazy" onerror="this.parentElement.remove()">${html(a.label)}</figure>`).join('')
      : `<figure><div class="none">Sin retrato ni imágenes de diseño</div></figure>`);
  }
  function select(key: string, view = 0) {
    const e = entries.find(x => x.key === key);
    if (!e) return false;
    selected = e; viewIndex = Math.min(view, e.views.length - 1);
    e.open?.();
    renderList(); renderDetail(); renderStrip();
    const v = e.views[viewIndex];
    void show(v.view, v.label);
    history.replaceState(null, '', `?ver=${encodeURIComponent(key)}${viewIndex ? `&vista=${viewIndex}` : ''}${filter !== 'todos' ? `&filtro=${filter}` : ''}${scratch ? '&notas=scratch' : ''}`);
    return true;
  }
  chips.addEventListener('click', ev => { const b = (ev.target as HTMLElement).closest<HTMLButtonElement>('[data-filter]'); if (b) { filter = b.dataset.filter as keyof typeof FILTERS; renderList(); } });
  list.addEventListener('click', ev => { const a = (ev.target as HTMLElement).closest<HTMLElement>('[data-key]'); if (a) select(a.dataset.key!); });
  search.addEventListener('input', renderList);
  viewBar.addEventListener('click', ev => {
    const b = (ev.target as HTMLElement).closest<HTMLButtonElement>('[data-view]');
    if (b && selected) select(selected.key, Number(b.dataset.view));
  });
  strip.addEventListener('click', ev => {
    const img = (ev.target as HTMLElement).closest<HTMLImageElement>('img');
    if (img) { const zoom = document.querySelector<HTMLElement>('#zoom')!; zoom.querySelector('img')!.src = img.src; zoom.style.display = 'grid'; }
  });
  document.querySelector<HTMLElement>('#zoom')!.addEventListener('click', ev => { (ev.currentTarget as HTMLElement).style.display = 'none'; });

  if (query.get('filtro') && query.get('filtro')! in FILTERS) filter = query.get('filtro') as keyof typeof FILTERS;
  if (!select(query.get('ver') ?? '', Number(query.get('vista') ?? 0))) select(entries.find(e => e.filter === 'enemigos')?.key ?? entries[0].key);
  status.textContent = 'Listo';
  if (!figures.length) status.textContent = 'Listo · sin output/bestiary/figures.json: abre la página con just bestiario';
  (window as unknown as { bestiary: unknown }).bestiary = {
    app, entries: () => entries.map(e => ({ key: e.key, filter: e.filter, name: e.name, status: e.status.tone })), select,
    filter: (f: keyof typeof FILTERS) => { filter = f; renderList(); },
    notes: () => notes, writable: () => writable,
    ready: () => !selected?.open || !selected.key.startsWith('enemigo:') || moveCache.has(selected.key.slice('enemigo:'.length) as FoeKind),
    set: (v: Partial<{ yaw: number; pitch: number; spin: boolean }>) => { ({ yaw = yaw, pitch = pitch, spin = spin } = v); },
  };
}

void start();
