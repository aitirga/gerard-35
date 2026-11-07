import * as pc from 'playcanvas';
import type { Element } from './battle';
import { SPELL_FLIGHT, clamp01, smooth } from './battle-motion';
import type { Effects } from './effects';
import type { GpuEmitter, GpuKind } from './fight-particles';
import { STATUS_KINDS } from './status-fx';

/**
 * How Matemágico casts (docs/animas/matemagico/README.md § Casting): Gerard raises a hand, and one of
 * the zeros circling him leaves its ring for his fingertip and opens there into a circle, which takes
 * its evenly spaced ticks, spinning down like a dial; a new zero comes out in the ring as the spell
 * leaves. Every spell of his that throws something starts with it: Foc Binari's streams and Cardioide's comet leave its middle.
 * For Atacar and Ángulo exacto (`ball`), a ball of particles gathers there too and leaves for the
 * target with 0, 1, e and π floating round it, very small. The element colours all of it and adds its
 * own touch. Only the ball is particles (GPU, src/fight-particles.ts); the circle and the signs are
 * quads of light. Runs on the fight's clock, so slow motion stretches it.
 */
const LOOKS = {
  none: { main: '#f3cf78', hot: '#fff4c8' },
  cure: { main: '#3fcf58', hot: '#baffc2' },
  agua: { main: '#5cc2f4', hot: '#dff5ff' },
  fuego: { main: '#ff8a38', hot: '#ffdca0' },
  electrico: { main: '#ffe24a', hot: '#fffbdc' },
} satisfies Record<Element | 'none' | 'cure', { main: string; hot: string }>;
/** Radius of the circle, how far ahead of the hand it opens, how wide the ball is, how far the signs float from it and how big they are (metres). */
const DIAL = { size: 1.02, ahead: .1, finger: .1 }, BALL = { radius: .11, shell: .2, glow: .62 }, SIGNS = { text: ['0', 'e', '1', 'π'], orbit: .24, size: .19 };
/** The zero's flight and its opening into the circle, as parts of the time before the launch; how long the ball takes to gather, and what is left to fade (fight seconds). */
const FLIES = .36, OPENED = .72, GATHER = .22, FADE = .34;
/** How wide the zero is when it has rounded at the fingertip (m), and the circle's size at that moment. */
const ZERO_ROUND = .13, CIRCLE_START = ZERO_ROUND / .47;
/** How dark the line under the circle is. */
const UNDER = .5;
/** The ring's gold (src/anima-looks.ts), which the zero leaves in. */
const RING_GOLD = '#f3cf78';

/** The colour Cardioide's circle and comet go in. */
export const CURE_COLOUR = LOOKS.cure.main;
/** The colour a thrown Atacar lands in. */
export const spellColour = (element?: Element) => LOOKS[element ?? 'none'].main;

export const SPELL_KINDS = {
  // The ball: dense points of light that ride along with it (each stream gives them its speed).
  spellcore: {
    drag: .15, gravity: 0, curl: .5, response: .8, size: [.032, .008], sizeJitter: .5, shape: 'dot',
    colours: ['#ffffff', '#ffffff', '#ffffff'], intensity: [6.5, 3.8, 1.5], middle: .35, fadeIn: .04, fadeOut: .5, additive: 1, flicker: .12, core: .75,
  },
  // Its haze: soft glow round it, so the points read as one ball.
  spellhaze: {
    drag: .15, gravity: 0, curl: .3, response: .5, size: [.15, .05], sizeJitter: .35, shape: 'glow',
    colours: ['#ffffff', '#ffffff', '#ffffff'], intensity: [1.5, 1, .4], middle: .4, fadeIn: .08, fadeOut: .5, additive: 1, opacity: .5, core: .2,
  },
} satisfies Record<string, GpuKind>;

/** White marks on black, for additive quads: black adds nothing. */
function canvasTexture(device: pc.GraphicsDevice, name: string, size: number, draw: (x: CanvasRenderingContext2D, size: number) => void) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const x = canvas.getContext('2d')!;
  x.fillStyle = '#000'; x.fillRect(0, 0, size, size);
  x.strokeStyle = x.fillStyle = '#fff';
  draw(x, size);
  const texture = new pc.Texture(device, { name, width: size, height: size, mipmaps: true, anisotropy: 4, addressU: pc.ADDRESS_CLAMP_TO_EDGE, addressV: pc.ADDRESS_CLAMP_TO_EDGE });
  texture.setSource(canvas);
  return texture;
}
/** The circle the zero opens into. */
function drawRim(x: CanvasRenderingContext2D, size: number) {
  x.shadowColor = '#fff'; x.shadowBlur = size * .012;
  x.lineWidth = size * .0085;
  x.beginPath(); x.arc(size / 2, size / 2, size * .47, 0, Math.PI * 2); x.stroke();
}
/** Its ticks, evenly spaced, all alike. */
function drawTicks(x: CanvasRenderingContext2D, size: number) {
  const c = size / 2;
  x.shadowColor = '#fff'; x.shadowBlur = size * .012;
  x.lineWidth = size * .0105; x.lineCap = 'round';
  for (let k = 0; k < 36; k++) {
    const a = k / 36 * Math.PI * 2, cos = Math.cos(a), sin = Math.sin(a);
    x.beginPath(); x.moveTo(c + cos * size * .405, c + sin * size * .405); x.lineTo(c + cos * size * .455, c + sin * size * .455); x.stroke();
  }
}
/** The dark line under the circle and its ticks: on a bright floor, light added on top hardly shows. */
function drawUnder(x: CanvasRenderingContext2D, size: number) {
  const c = size / 2;
  x.shadowColor = '#fff'; x.shadowBlur = size * .018;
  x.lineWidth = size * .021;
  x.beginPath(); x.arc(c, c, size * .47, 0, Math.PI * 2); x.stroke();
  x.lineWidth = size * .021; x.lineCap = 'round';
  for (let k = 0; k < 36; k++) {
    const a = k / 36 * Math.PI * 2, cos = Math.cos(a), sin = Math.sin(a);
    x.beginPath(); x.moveTo(c + cos * size * .405, c + sin * size * .405); x.lineTo(c + cos * size * .455, c + sin * size * .455); x.stroke();
  }
}
/** Its inner circle, turning the other way, with a few finer marks. */
function drawInner(x: CanvasRenderingContext2D, size: number) {
  const c = size / 2;
  x.shadowColor = '#fff'; x.shadowBlur = size * .01;
  x.lineWidth = size * .006;
  x.beginPath(); x.arc(c, c, size * .315, 0, Math.PI * 2); x.stroke();
  x.lineWidth = size * .007; x.lineCap = 'round';
  for (let k = 0; k < 12; k++) {
    const a = k / 12 * Math.PI * 2, cos = Math.cos(a), sin = Math.sin(a);
    x.beginPath(); x.moveTo(c + cos * size * .285, c + sin * size * .285); x.lineTo(c + cos * size * .315, c + sin * size * .315); x.stroke();
  }
}
function drawSign(text: string) {
  return (x: CanvasRenderingContext2D, size: number) => {
    x.font = `italic ${Math.round(size * .78)}px Georgia, 'Times New Roman', serif`;
    x.textAlign = 'center'; x.textBaseline = 'middle';
    x.shadowColor = '#fff'; x.shadowBlur = size * .05;
    x.fillText(text, size / 2, size * .52);
  };
}
/** The heart of the ball: a soft round glow, so all its points read as one thing. */
function drawGlow(x: CanvasRenderingContext2D, size: number) {
  const c = size / 2, g = x.createRadialGradient(c, c, 0, c, c, c);
  g.addColorStop(0, '#fff'); g.addColorStop(.22, '#d8d8d8'); g.addColorStop(.5, '#3c3c3c'); g.addColorStop(1, '#000');
  x.fillStyle = g; x.fillRect(0, 0, size, size);
}
/** Light added on top of what is behind it, its shape in `texture`. */
function lightMaterial(name: string, texture?: pc.Texture) {
  const m = new pc.StandardMaterial();
  m.name = name; m.diffuse.set(0, 0, 0); m.useLighting = false; m.useFog = false; m.useSkybox = false;
  if (texture) m.emissiveMap = texture;
  m.blendType = pc.BLEND_ADDITIVE; m.depthWrite = false; m.cull = pc.CULLFACE_NONE;
  m.update();
  return m;
}
const easeBack = (t: number) => { const k = clamp01(t) - 1; return 1 + 2.4 * k * k * k + 1.4 * k * k; };

export function createMathCast(app: pc.Application, parent: pc.Entity, effects: Effects) {
  const device = app.graphicsDevice;
  const quad = (name: string, material: pc.Material, under: pc.Entity) => {
    const e = new pc.Entity(name); e.addComponent('render', { type: 'plane', material, castShadows: false, receiveShadows: false });
    under.addChild(e);
    return e;
  };
  const root = new pc.Entity('Lanzamiento de Matemágico'); parent.addChild(root); root.enabled = false;
  // The circle: `holder` looks along its axis; the plane under it lies square to that.
  const holder = new pc.Entity('Círculo'); root.addChild(holder);
  const flat = new pc.Entity('Plano del círculo'); holder.addChild(flat); flat.setLocalEulerAngles(90, 0, 0);
  const rimTexture = canvasTexture(device, 'Círculo de Matemágico', 512, drawRim), tickTexture = canvasTexture(device, 'Marcas de Matemágico', 512, drawTicks), innerTexture = canvasTexture(device, 'Círculo interior de Matemágico', 512, drawInner);
  const rimMaterial = lightMaterial('Círculo de Matemágico', rimTexture), tickMaterial = lightMaterial('Marcas de Matemágico', tickTexture), innerMaterial = lightMaterial('Círculo interior de Matemágico', innerTexture);
  const rim = quad('Círculo', rimMaterial, flat), ticks = quad('Marcas', tickMaterial, flat), inner = quad('Marcas interiores', innerMaterial, flat);
  const underTexture = canvasTexture(device, 'Trazo bajo el círculo', 512, drawUnder);
  const underMaterial = new pc.StandardMaterial();
  underMaterial.name = 'Trazo bajo el círculo'; underMaterial.diffuse.set(0, 0, 0); underMaterial.useLighting = false; underMaterial.useFog = false; underMaterial.useSkybox = false;
  underMaterial.opacityMap = underTexture; underMaterial.opacityMapChannel = 'r'; underMaterial.blendType = pc.BLEND_NORMAL; underMaterial.depthWrite = false; underMaterial.cull = pc.CULLFACE_NONE; underMaterial.update();
  // A hair behind the rest (the plane's up looks away from the camera), so it is drawn first.
  const under = quad('Trazo', underMaterial, flat); under.setLocalPosition(0, .008, 0);
  // The zero on its way from the ring to the fingertip: the same oval ring of light (anima-looks.ts `digit`).
  const zeroMaterial = lightMaterial('Cero de Matemágico');
  // It crosses in front of him, never through him.
  zeroMaterial.depthTest = false; zeroMaterial.update();
  const flying = new pc.Entity('Cero en vuelo'); root.addChild(flying);
  const zeroMesh = new pc.Entity('Cero'); zeroMesh.addComponent('render', { type: 'torus', material: zeroMaterial, castShadows: false, receiveShadows: false }); flying.addChild(zeroMesh); zeroMesh.setLocalEulerAngles(90, 0, 0);
  const signs = SIGNS.text.map(text => {
    const texture = canvasTexture(device, `Signo ${text}`, 96, drawSign(text)), material = lightMaterial(`Signo ${text}`, texture);
    return { text, texture, material, entity: quad(`Signo ${text}`, material, root) };
  });
  const glowTexture = canvasTexture(device, 'Núcleo de la bola', 128, drawGlow), glowMaterial = lightMaterial('Núcleo de la bola', glowTexture);
  const heart = quad('Núcleo de la bola', glowMaterial, root);
  const lamp = new pc.Entity('Luz de la bola'); lamp.addComponent('light', { type: 'omni', intensity: 0, range: 2.2, castShadows: false }); root.addChild(lamp);

  const gpu = () => effects.gpu && effects.gpu.active ? effects.gpu : undefined;
  function ensureKinds() {
    const g = effects.gpu;
    if (!g) return;
    for (const [name, kind] of Object.entries({ ...STATUS_KINDS, ...SPELL_KINDS })) if (!g.get(name)) g.define(name, kind);
  }
  interface Cast {
    time: number; hand: pc.GraphNode; to: pc.Vec3; element?: Element; look: { main: string; hot: string };
    /** When whatever it throws leaves, and whether that is its ball (otherwise only the circle shows here). */
    launch: number; thrown: boolean;
    centre: pc.Vec3; axis: pc.Vec3; ball: pc.Vec3; from: pc.Vec3; spin: number; spinInner: number; roll: number;
    /** When it left the hand, and when it landed. */
    launched: boolean; gathered: boolean; landedAt?: number;
    streams: GpuEmitter[]; touch: GpuEmitter[]; arcAt: number; flung: pc.Vec3[];
    /** The zero that became this circle: where it left from, how big it was, and what brings a new one out in its place. */
    zero?: { at: pc.Vec3; scale: number; back: () => void }; trail?: GpuEmitter; tip: pc.Vec3;
    /** How big the circle is for whoever casts it (1 at 35). */
    size: number;
  }
  const dialOf = (c: Cast) => DIAL.size * c.size;
  let cast: Cast | undefined;
  const right = new pc.Vec3(), up = new pc.Vec3(), toCamera = new pc.Vec3(), step = new pc.Vec3(), place = new pc.Vec3(), previous = new pc.Vec3();
  const colour = new pc.Color();
  const glow = (m: pc.StandardMaterial, hex: string, intensity: number) => { colour.fromString(hex); m.emissive.copy(colour); m.emissiveIntensity = intensity; m.update(); };
  const other = new pc.Color();
  const cameraEntity = () => app.systems.camera?.cameras[0]?.entity;
  function stop(list: GpuEmitter[]) { list.forEach(e => e.remove()); list.length = 0; }
  function finish() {
    if (!cast) return;
    stop(cast.streams); stop(cast.touch); cast.trail?.remove();
    // Whatever happened to the circle, the ring gets its zero back.
    cast.zero?.back();
    cast = undefined; root.enabled = false;
  }
  /** Where the circle opens: at his fingertip, square to the way the ball goes, turned part way to the camera so it reads as a circle. */
  function aim(c: Cast) {
    const hand = c.hand.getPosition(), arm = c.hand.parent;
    c.tip.copy(hand);
    if (arm) { step.sub2(hand, arm.getPosition()); if (step.lengthSq() > 1e-6) c.tip.add(step.normalize().mulScalar(DIAL.finger)); }
    step.sub2(c.to, c.tip).normalize();
    const camera = cameraEntity();
    if (camera) toCamera.copy(camera.forward).mulScalar(-1); else toCamera.set(0, 1, 0);
    c.axis.copy(step).mulScalar(.4).add(toCamera.mulScalar(.6)).normalize();
    c.centre.copy(c.tip).add(step.mulScalar(DIAL.ahead));
  }
  /** The element's own touch on the circle while the ball gathers, as streams off its rim. */
  function rimTouch(c: Cast) {
    const g = gpu();
    if (!g) return;
    const ring = { at: c.centre, shape: 'ring' as const, axis: c.axis, spread: dialOf(c) * .44 };
    if (c.element === 'agua') c.touch.push(g.emitter('drip', { ...ring, rate: 90, speed: .1, life: [.35, .6] }));
    else if (c.element === 'fuego') c.touch.push(g.emitter('ember', { ...ring, rate: 130, speed: .35, up: .7, life: [.25, .55], colour: '#ffb84a' }));
    else if (c.element === 'electrico') c.touch.push(g.emitter('spark', { ...ring, rate: 90, speed: 1, life: [.1, .25], colour: '#fff2a8' }));
    else c.touch.push(g.emitter('twinkle', { ...ring, rate: 60, speed: .15, life: [.2, .4], colour: c.look.hot, size: .55 }));
  }
  /** The element's own touch on the ball as it flies. */
  function ballTouch(c: Cast) {
    const g = gpu();
    if (!g) return;
    const ball = { at: c.ball, shape: 'ball' as const, spread: BALL.shell };
    if (c.element === 'agua') {
      c.touch.push(g.emitter('drip', { ...ball, rate: 150, speed: .25, life: [.3, .6] }));
      c.touch.push(g.emitter('twinkle', { ...ball, rate: 70, speed: .3, life: [.15, .3], colour: '#cfeeff', size: .5 }));
    } else if (c.element === 'fuego') {
      c.touch.push(g.emitter('ember', { ...ball, rate: 240, speed: .55, up: .5, life: [.2, .5], colour: '#ffb84a' }));
      c.touch.push(g.emitter('crackle', { ...ball, rate: 110, speed: 1.1, life: [.12, .3] }));
    } else if (c.element === 'electrico') {
      c.touch.push(g.emitter('spark', { ...ball, rate: 150, speed: 1.6, life: [.08, .2], colour: '#fff2a8' }));
    } else c.touch.push(g.emitter('twinkle', { ...ball, rate: 90, speed: .3, life: [.15, .32], colour: c.look.hot, size: .5 }));
  }
  /** A bolt from `a` to `b`, or thrown off `a` with no `b`. */
  function bolt(a: pc.Vec3, b?: pc.Vec3) {
    const g = gpu();
    if (!g) return;
    if (b) g.burst('arc', { at: a, to: b, shape: 'line', count: 2 * 10, chain: 10, speed: .5, life: [.07, .16], colour: '#fff2a8' });
    else g.burst('arc', { at: a, count: 2 * 7, chain: 7, spread: .05, speed: 2.8, life: [.07, .15], colour: '#fff2a8' });
  }
  function land(c: Cast) {
    if (c.landedAt !== undefined) return;
    c.landedAt = c.time;
    c.ball.copy(c.to);
    stop(c.streams); stop(c.touch);
    const g = gpu();
    step.sub2(c.to, c.from).normalize();
    if (g) {
      g.burst('spellhaze', { at: c.to, count: 10, spread: .05, speed: .6, life: [.14, .26], colour: c.look.hot, size: 2, light: { intensity: 2, range: 2.4, colour: c.look.main } });
      g.burst('spellcore', { at: c.to, count: 150, spread: .08, speed: 3.4, life: [.2, .5], colour: c.look.main });
      g.burst('spellcore', { at: c.to, count: 70, shape: 'ring', axis: step, spread: .12, outward: 3.6, life: [.14, .28], colour: c.look.hot });
    }
    // The signs are thrown off it, each its own way.
    c.flung = signs.map((_, i) => {
      const a = i / signs.length * Math.PI * 2 + c.time * 1.7;
      return right.clone().mulScalar(Math.cos(a)).add(up.clone().mulScalar(Math.sin(a))).mulScalar(1.5);
    });
  }
  return {
    /**
     * Gerard raises `hand`: `zero` (from the ring, src/anima-looks.ts `takeZero`) flies to his fingertip
     * and opens into the circle, facing `to`; at `launch`, with `ball`, the ball leaves for it.
     */
    start(hand: pc.GraphNode, to: { x: number; y: number; z: number }, o: { element?: Element; cure?: boolean; ball?: boolean; launch: number; zero?: Cast['zero']; size?: number }) {
      finish();
      ensureKinds();
      const element = o.element, look = LOOKS[o.cure ? 'cure' : element ?? 'none'];
      cast = {
        time: 0, hand, to: new pc.Vec3(to.x, to.y, to.z), element, look, launch: o.launch, thrown: !!o.ball, zero: o.zero, size: o.size ?? 1, tip: new pc.Vec3(), centre: new pc.Vec3(), axis: new pc.Vec3(), ball: new pc.Vec3(), from: new pc.Vec3(),
        spin: 0, spinInner: 0, roll: Math.random() * Math.PI * 2, launched: false, gathered: false, streams: [], touch: [], arcAt: 0, flung: [],
      };
      lamp.light!.color = new pc.Color().fromString(look.main);
      root.enabled = true;
      if (o.zero && gpu()) cast.trail = gpu()!.emitter('spellcore', { at: o.zero.at, shape: 'ball', spread: .03, rate: 160, speed: .12, life: [.1, .22], colour: look.main, size: .55 });
    },
    /** The middle of the circle now: where whatever the spell throws leaves from. */
    get centre() { return cast?.centre; },
    /** The blow lands (the scene's contact): the ball bursts on the target and the signs fly off. */
    land() { if (cast?.thrown) land(cast); },
    /** Whatever is left of it (a fight ending). */
    clear() { finish(); },
    /** `dt` in fight seconds. Returns true the moment the ball leaves the hand (for its sound). */
    update(dt: number) {
      const c = cast;
      if (!c) return false;
      c.time += dt;
      const g = gpu(), t = c.time, camera = cameraEntity();
      if (camera) { right.copy(camera.right); up.copy(camera.up); }
      let left = false;
      if (!c.launched && t >= c.launch) {
        left = c.launched = true; c.from.copy(c.centre);
        // A new zero comes out in the ring.
        c.zero?.back(); c.zero = c.zero && { ...c.zero, back: () => {} };
      }
      if (!c.launched) aim(c);

      // The zero leaves the ring for his fingertip, rounding on the way and taking the spell's colour.
      const flies = c.zero ? c.launch * FLIES : 0, opens = c.launch * OPENED;
      if (c.zero) {
        const fade = 1 - smooth((t - flies) / .07);
        flying.enabled = fade > .002;
        if (flying.enabled) {
          const f = smooth(t / flies), s = c.zero.scale;
          place.lerp(c.zero.at, c.tip, f); place.y += Math.sin(f * Math.PI) * .1;
          flying.setPosition(place);
          if (camera) flying.setRotation(camera.getRotation());
          zeroMesh.setLocalScale((.14 + (ZERO_ROUND * 2 - .14) * f) * s, .03 * s, (.2 + (ZERO_ROUND * 2 - .2) * f) * s);
          other.fromString(c.look.main); colour.fromString(RING_GOLD).lerp(colour, other, f);
          zeroMaterial.emissive.copy(colour); zeroMaterial.emissiveIntensity = 2.4 * fade; zeroMaterial.update();
        }
        if (c.trail) {
          c.trail.at = place.clone();
          if (t >= flies) { c.trail.remove(); c.trail = undefined; }
        }
      } else flying.enabled = false;

      // At the fingertip it opens into the circle, with a little overshoot; its ticks come as it opens,
      // spinning down, and it all goes as the spell leaves.
      const opened = easeBack((t - flies) / (opens - flies)), gone = c.launched ? smooth((t - c.launch - .06) / FADE) : 0;
      const seen = smooth((t - flies + .03) / .06) * (1 - gone), marked = smooth((t - flies - (opens - flies) * .3) / ((opens - flies) * .7)) * (1 - gone);
      flat.enabled = seen > .002;
      if (flat.enabled) {
        // Fast as it opens, a slow turn once open, a kick as the ball leaves.
        const fast = 620 * (1 - smooth((t - flies) / (opens - flies + .12))) + 46 + (c.launched ? 240 * Math.exp(-(t - c.launch) * 7) : 0);
        c.spin += fast * dt; c.spinInner -= fast * .7 * dt;
        holder.setPosition(c.centre);
        holder.lookAt(step.add2(c.centre, c.axis));
        const size = (CIRCLE_START + (dialOf(c) - CIRCLE_START) * Math.max(0, opened)) * (1 + gone * .28);
        rim.setLocalScale(size, 1, size);
        ticks.setLocalScale(size, 1, size); ticks.setLocalEulerAngles(0, c.spin, 0);
        under.setLocalScale(size, 1, size); under.setLocalEulerAngles(0, c.spin, 0);
        underMaterial.opacity = UNDER * seen * (.35 + .65 * marked); underMaterial.update();
        inner.setLocalScale(size, 1, size); inner.setLocalEulerAngles(0, c.spinInner, 0);
        const pulse = c.launched ? 1 + 2.2 * Math.exp(-(t - c.launch) * 9) : 1;
        glow(rimMaterial, c.look.main, 3.4 * seen * pulse);
        glow(tickMaterial, c.look.main, 3.4 * marked * pulse);
        glow(innerMaterial, c.look.hot, 1.5 * marked * pulse);
      }

      // The ball: it gathers in the middle of the circle, then flies, faster all the way.
      const gather = smooth((t - (c.launch - GATHER)) / GATHER);
      if (c.landedAt === undefined) {
        previous.copy(c.ball);
        if (!c.launched || !c.thrown) c.ball.copy(c.centre);
        else {
          const f = clamp01((t - c.launch) / SPELL_FLIGHT), e = f ** 1.35;
          c.ball.lerp(c.from, c.to, e);
          c.ball.y += Math.sin(e * Math.PI) * Math.min(.5, c.from.distance(c.to) * .07);
        }
        if (g && !c.gathered && t >= c.launch - GATHER) {
          c.gathered = true;
          if (c.thrown) {
            const stream = { at: c.ball, shape: 'ball' as const };
            c.streams.push(g.emitter('spellcore', { ...stream, spread: BALL.radius, rate: 0, speed: .35, life: [.1, .24], colour: c.look.main }));
            c.streams.push(g.emitter('spellcore', { ...stream, spread: BALL.radius * .5, rate: 0, speed: .2, life: [.08, .18], colour: c.look.hot }));
            c.streams.push(g.emitter('spellhaze', { ...stream, spread: BALL.radius * .6, rate: 0, speed: .1, life: [.12, .26], colour: c.look.main }));
            c.streams.push(g.emitter('spellcore', { ...stream, spread: BALL.radius * .8, rate: 0, speed: .4, life: [.12, .3], colour: c.look.main, size: .7 }));
          }
          rimTouch(c);
        }
        if (left && g) {
          // It breaks away: a flash, a ring thrown out along the circle, and the element takes to the ball.
          stop(c.touch);
          if (c.thrown) ballTouch(c);
          g.burst('spellhaze', { at: c.centre, count: 8, spread: .05, speed: .4, life: [.12, .22], colour: c.look.hot, size: 1.6, light: { intensity: 1.6, range: 2.2, colour: c.look.main } });
          g.burst('spellcore', { at: c.centre, count: 110, shape: 'ring', axis: c.axis, spread: dialOf(c) * .42, outward: 1.6, life: [.16, .36], colour: c.look.main, size: .6 });
        }
        // While it gathers, the rim's light runs in to its middle.
        if (g && c.gathered && !c.launched && t >= c.arcAt) {
          c.arcAt = t + .045;
          g.burst('spellcore', { at: c.centre, count: 16, shape: 'ring', axis: c.axis, spread: dialOf(c) * .4, outward: -1.8, life: [.14, .22], colour: c.look.main, size: .55 });
        }
        // Its points ride along with it; the last stream lags, for a short tail.
        const seconds = Math.max(dt, 1e-3), moving = c.launched && !left, along = { x: moving ? (c.ball.x - previous.x) / seconds : 0, y: moving ? (c.ball.y - previous.y) / seconds : 0, z: moving ? (c.ball.z - previous.z) / seconds : 0 };
        c.streams.forEach((e, i) => { e.at = c.ball; e.rate = [900, 460, 120, 260][i] * gather; e.velocity = i === 3 ? { x: along.x * .35, y: along.y * .35, z: along.z * .35 } : along; });
        c.touch.forEach(e => { e.at = c.launched ? c.ball : c.centre; });
        // Bolts crawl off the rim to the ball and off the ball as it flies.
        if (c.thrown && c.element === 'electrico' && g && c.gathered && t >= c.arcAt - .02) {
          c.arcAt = t + .05;
          if (!c.launched) {
            const a = Math.random() * Math.PI * 2, r = dialOf(c) * .45;
            step.cross(c.axis, up).normalize();
            const across = new pc.Vec3().cross(c.axis, step);
            bolt(step.clone().mulScalar(Math.cos(a) * r).add(across.mulScalar(Math.sin(a) * r)).add(c.centre), c.centre);
          } else bolt(c.ball);
        }
        lamp.setPosition(c.ball);
        lamp.light!.intensity = c.thrown ? .9 * gather : .6 * gather * (1 - smooth((t - c.launch) / .2));
      } else {
        lamp.light!.intensity = 1.2 * (1 - smooth((t - c.landedAt) / .22));
      }
      // Its heart: a soft glow in the middle of the points, gone as it bursts.
      const lit = c.landedAt !== undefined ? 1 - smooth((t - c.landedAt) / .1) : c.thrown ? gather : .55 * gather * (1 - smooth((t - c.launch) / .1));
      heart.enabled = lit > .002;
      if (heart.enabled) {
        heart.setPosition(c.ball);
        if (camera) { heart.setRotation(camera.getRotation()); heart.rotateLocal(90, 0, 0); }
        const size = BALL.glow * lit * (1 + Math.sin(t * 31) * .06);
        heart.setLocalScale(size, 1, size);
        glow(glowMaterial, c.look.main, 2.4 * lit);
      }

      // The signs: very small, floating round the ball, always facing whoever looks.
      const landed = c.landedAt !== undefined ? t - c.landedAt : -1;
      const showing = !c.thrown ? 0 : landed >= 0 ? 1 - smooth(landed / .38) : smooth((t - (c.launch - GATHER * .6)) / (GATHER * .6));
      signs.forEach((sign, i) => {
        sign.entity.enabled = showing > .002;
        if (!sign.entity.enabled) return;
        const a = i / signs.length * Math.PI * 2 + t * 1.7, bob = Math.sin(t * 5.3 + i * 1.9) * .025;
        const orbit = SIGNS.orbit * (landed >= 0 ? 1 : .5 + .5 * showing);
        const at = place.copy(c.ball);
        at.add(step.copy(right).mulScalar(Math.cos(a) * orbit)).add(step.copy(up).mulScalar(Math.sin(a) * orbit * .82 + bob));
        if (landed >= 0 && c.flung[i]) at.add(step.copy(c.flung[i]).mulScalar(landed));
        sign.entity.setPosition(at);
        if (camera) { sign.entity.setRotation(camera.getRotation()); sign.entity.rotateLocal(90, Math.sin(t * 3 + i) * 10, 0); }
        const s = SIGNS.size * (landed >= 0 ? 1 + landed * .9 : showing);
        sign.entity.setLocalScale(s, 1, s);
        glow(sign.material, i % 2 ? c.look.hot : c.look.main, 3 * showing);
      });

      if ((c.landedAt !== undefined && t > c.landedAt + .5) || t > c.launch + (c.thrown ? SPELL_FLIGHT + 2 : FADE + .2)) finish();
      return left && c.thrown;
    },
    destroy() {
      finish(); root.destroy();
      for (const m of [rimMaterial, tickMaterial, innerMaterial, underMaterial, zeroMaterial, glowMaterial, ...signs.map(s => s.material)]) m.destroy();
      for (const t of [rimTexture, tickTexture, innerTexture, underTexture, glowTexture, ...signs.map(s => s.texture)]) t.destroy();
    },
  };
}
