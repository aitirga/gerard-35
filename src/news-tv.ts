import * as pc from 'playcanvas';
import { buildScenery } from './scenery';
import { ENVIRONMENTS } from './environments';
import { createPalace, footingOf } from './palace';
import { createNewsSet, NEWS_SHOTS } from './news-set';
import type { Effects } from './effects';
import { NEWS } from './chapter-2';

/**
 * The TV in the Meridiana flat (docs/chapter-2.md): the news, filmed and looping all day while the
 * party is at home. Trinitat Vella is built as a news set on its own layer, with its own lights,
 * and filmed by a news camera into a texture shown on the TV's screen; the broadcast's graphics
 * (EN DIRECTO, the shot's caption, ÚLTIMA HORA and the headline, the ticker with its clue) are
 * drawn on a second, see-through layer over it. Nothing covers the game: it is a TV in the room.
 */
const VIDEO = { width: 640, height: 360 };
/**
 * How many times a second the news camera films: filming is drawing a whole second scene, so as
 * often as footage needs, and smoother while someone watches up close.
 */
const FILM_RATE = { room: 15, watching: 30 };
const GRAPHICS = { width: 1280, height: 720 };

export interface NewsTVOptions {
  /** How threatening the castle is and how far her power has spread (story.castleThreat / spread). */
  threat: number;
  spread: number;
  /** Which morning's headline (days.ts `stage`). */
  stage: number;
  /** How big the castle stands on the school, before its spread. */
  castleScale: number;
}

export function createNewsTV(app: pc.Application, effects: Effects, screen: pc.Entity, options: NewsTVOptions) {
  // ——— The set, on a layer only the news camera sees, lit by its own sun ———
  const layer = new pc.Layer({ name: 'Plató de la tele' });
  app.scene.layers.push(layer);
  const where = ENVIRONMENTS['rec-comtal'];
  const set = buildScenery(app, where);
  const palace = createPalace(app, effects);
  palace.seat(footingOf(where.geo!, set.toWorld, set.groundHeight), options.castleScale * (1 + options.spread * .6));
  palace.setThreat(options.threat); palace.grow(1);
  const castle = palace.heart;
  const news = createNewsSet(app, set, castle);
  for (const root of [set.root, palace.root, news.root]) onLayer(root, layer.id);
  // On a screen this small shadows read as nothing, and casting them nearly doubles what filming costs.
  for (const root of [set.root, palace.root, news.root]) for (const light of root.findComponents('light') as pc.LightComponent[]) light.castShadows = false;
  const batch = app.batcher.getGroupByName(`Estático: ${where.id}`);
  if (batch) { batch.layers = [layer.id]; app.batcher.markGroupDirty(batch.id); }

  // ——— The news camera, filming into a texture ———
  const device = app.graphicsDevice;
  const video = new pc.Texture(device, { name: 'Imagen de la tele', ...VIDEO, format: pc.PIXELFORMAT_RGBA8, mipmaps: false, minFilter: pc.FILTER_LINEAR, magFilter: pc.FILTER_LINEAR, addressU: pc.ADDRESS_CLAMP_TO_EDGE, addressV: pc.ADDRESS_CLAMP_TO_EDGE });
  const target = new pc.RenderTarget({ colorBuffer: video, depth: true, samples: 1 });
  const lens = new pc.Entity('Cámara del informativo');
  lens.addComponent('camera', {
    layers: [layer.id], renderTarget: target, priority: -1, projection: pc.PROJECTION_PERSPECTIVE,
    fov: 40, nearClip: .2, farClip: 400, clearColor: new pc.Color().fromString('#c7a9c4'), toneMapping: pc.TONEMAP_ACES,
  });
  app.root.addChild(lens);

  // ——— On the TV: the picture, and the graphics over it ———
  const canvas = document.createElement('canvas'); canvas.width = GRAPHICS.width; canvas.height = GRAPHICS.height;
  const ctx = canvas.getContext('2d')!;
  const graphics = new pc.Texture(device, { name: 'Rótulos de la tele', ...GRAPHICS, format: pc.PIXELFORMAT_RGBA8, mipmaps: false, minFilter: pc.FILTER_LINEAR, magFilter: pc.FILTER_LINEAR });
  graphics.setSource(canvas);
  const picture = new pc.StandardMaterial(); picture.useLighting = false; picture.diffuse.set(0, 0, 0);
  picture.emissive.set(1, 1, 1); picture.emissiveMap = video; picture.update();
  const overlay = new pc.StandardMaterial(); overlay.useLighting = false; overlay.diffuse.set(0, 0, 0);
  overlay.emissive.set(1, 1, 1); overlay.emissiveMap = graphics; overlay.opacityMap = graphics; overlay.opacityMapChannel = 'a';
  overlay.blendType = pc.BLEND_NORMAL; overlay.depthWrite = false; overlay.update();
  const glass = new pc.Entity('Pantalla encendida'); app.root.addChild(glass);
  const size = screen.getLocalScale();
  const front = screen.getPosition().clone().add(new pc.Vec3(0, 0, size.z / 2 + .004));
  glass.setPosition(front);
  // A plane faces +y; turned a quarter it faces the room (+z). The camera's picture comes out of its
  // render target upside down and the canvas does not, so the canvas is flipped back to stand upright.
  const faces = [['Imagen', picture, 0, 1], ['Rótulos', overlay, .004, -1]] as const;
  const [image] = faces.map(([name, m, dz, flip]) => {
    const e = new pc.Entity(name);
    e.addComponent('render', { type: 'plane', material: m, castShadows: false, receiveShadows: false });
    e.setLocalPosition(0, 0, dz); e.setLocalEulerAngles(90, 0, 0); e.setLocalScale(size.x, 1, -size.y * flip);
    glass.addChild(e);
    return e.render!.meshInstances[0];
  });

  let shot = 0, t = 0, time = 0, drawn = -1, stage = options.stage, unfilmed = 0;
  /** The broadcast's graphics for this moment: redrawn a dozen times a second. */
  function draw() {
    const W = GRAPHICS.width, H = GRAPHICS.height, id = NEWS_SHOTS[shot].id;
    const headline = NEWS.stages[Math.min(stage, NEWS.stages.length - 1)];
    ctx.clearRect(0, 0, W, H);
    ctx.textBaseline = 'middle';
    const font = (size: number, weight = 800) => `${weight} ${size}px Manrope, 'DM Sans', sans-serif`;
    if (id === 'phone') { ctx.fillStyle = 'rgba(0,0,0,.88)'; ctx.fillRect(0, 0, W * .26, H); ctx.fillRect(W * .74, 0, W * .26, H); }
    // EN DIRECTO and the shot's caption, top left; the channel, top right.
    ctx.fillStyle = '#c4141c'; ctx.fillRect(44, 36, 210, 44);
    ctx.fillStyle = Math.floor(time * 2) % 2 ? '#fff' : 'rgba(255,255,255,.2)'; ctx.beginPath(); ctx.arc(68, 58, 8, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = font(24); ctx.fillText('EN DIRECTO', 86, 59);
    const caption = NEWS.shots[id];
    ctx.font = font(18, 700); const cw = ctx.measureText(caption).width + 28;
    ctx.fillStyle = 'rgba(0,0,0,.7)'; ctx.fillRect(44, 88, cw, 34); ctx.fillStyle = '#fff'; ctx.fillText(caption, 58, 106);
    ctx.font = font(24); const bw = ctx.measureText(NEWS.channel).width + 36;
    ctx.fillStyle = 'rgba(19,48,92,.9)'; ctx.fillRect(W - 44 - bw, 36, bw, 48); ctx.strokeStyle = '#fff'; ctx.lineWidth = 4; ctx.strokeRect(W - 44 - bw, 36, bw, 48);
    ctx.fillStyle = '#fff'; ctx.fillText(NEWS.channel, W - 26 - bw, 61);
    // The reporter's name over her shot.
    if (id === 'reporter') {
      ctx.fillStyle = 'rgba(19,48,92,.95)'; ctx.fillRect(44, H - 262, 330, 70); ctx.fillStyle = '#c4141c'; ctx.fillRect(44, H - 262, 8, 70);
      ctx.fillStyle = '#fff'; ctx.font = font(28); ctx.fillText(NEWS.reporter.name, 68, H - 240);
      ctx.fillStyle = '#cfe0ff'; ctx.font = font(17, 600); ctx.fillText(NEWS.reporter.role, 68, H - 210);
    }
    // ÚLTIMA HORA and today's headline.
    ctx.fillStyle = 'rgba(247,244,236,.97)'; ctx.fillRect(0, H - 176, W, 116);
    ctx.fillStyle = '#d0101b'; ctx.fillRect(44, H - 158, 220, 80);
    ctx.fillStyle = '#fff'; ctx.font = font(28, 900); ctx.fillText(NEWS.kicker, 62, H - 117);
    ctx.fillStyle = '#13202a'; ctx.font = font(40, 800); ctx.fillText(headline.headline, 290, H - 135, W - 330);
    ctx.fillStyle = '#445'; ctx.font = font(22, 600); ctx.fillText(headline.sub, 290, H - 92, W - 330);
    // The ticker, with the R4 clue among ordinary news.
    ctx.fillStyle = '#13305c'; ctx.fillRect(0, H - 60, W, 60);
    const items = NEWS.ticker.map(item => `●  ${item}`).join('      ');
    ctx.font = font(22, 600); const tw = ctx.measureText(items + '      ').width;
    const x = W - (time * 90) % (tw + W);
    ctx.fillStyle = '#fff'; ctx.fillText(items, x, H - 30); ctx.fillText(items, x + tw + 60, H - 30);
    graphics.upload();
  }

  return {
    /** Where the TV's screen is, for the camera to come close when someone watches. */
    get screen() { return front.clone(); },
    /** Today's headline changes with the Queen's spread. */
    setStage(value: number) { stage = value; },
    /** `watching`: the camera is up close on the screen, so the picture moves more smoothly. */
    update(dt: number, animate: boolean, watching = false) {
      time += dt; t += dt;
      // Film only when the next picture is due and the screen was in view last frame; the screen
      // keeps the last picture in between.
      const period = 1 / (watching ? FILM_RATE.watching : FILM_RATE.room);
      unfilmed += dt;
      lens.camera!.enabled = unfilmed >= period && (watching || image.visibleThisFrame);
      if (lens.camera!.enabled) unfilmed %= period;
      if (t > NEWS_SHOTS[shot].seconds && animate) { shot = (shot + 1) % NEWS_SHOTS.length; t = 0; }
      const s = news.shot(NEWS_SHOTS[shot].id, t);
      const k = animate ? s.shake : 0;
      const wobble = new pc.Vec3(Math.sin(time * 7.3) + Math.sin(time * 13.1) * .5, Math.sin(time * 9.7) * .8, Math.sin(time * 5.9)).mulScalar(k);
      lens.setPosition(s.position.clone().add(wobble)); lens.lookAt(s.target.clone().add(wobble.mulScalar(2)));
      lens.camera!.fov = s.fov;
      news.update(dt, animate); palace.update(dt, animate); set.update(dt, animate);
      const frame = Math.floor(time * 12);
      if (frame !== drawn) { drawn = frame; draw(); }
    },
    destroy() {
      lens.destroy(); glass.destroy(); news.destroy(); palace.destroy(); set.destroy();
      target.destroy(); video.destroy(); graphics.destroy(); picture.destroy(); overlay.destroy();
      app.scene.layers.remove(layer);
    },
  };
}
export type NewsTV = ReturnType<typeof createNewsTV>;

/** Moves every renderer and light under `root` onto one layer. */
function onLayer(root: pc.Entity, layer: number) {
  root.forEach(node => {
    const e = node as pc.Entity;
    if (e.render) e.render.layers = [layer];
    if (e.light) e.light.layers = [layer];
  });
}
