import * as pc from 'playcanvas';
import { bodyOf, type Body, type Effects, type FireLevel } from './effects.ts';
import type { GpuEmitter, GpuField, GpuKind } from './fight-particles.ts';

/**
 * How statuses read on whoever carries them, in a fight (docs/combat.md, "Turnos con tiempo real",
 * and docs/graphics.md, "Estados"): the physical ones the combat design decided (quemado, mojado,
 * congelado, envenenado, sangrado, cegado por el humo, paralizado), the campaign's own (mareo,
 * llorera) and the reactions between them. Each look is data (`STATUS_LOOKS`): streams of particles
 * off the fighter's own parts or head, a force field that follows them, a pulse, a tint on their
 * body and a way of moving.
 * Particles are only sparks, drops, crystals and haze, never sprites with a shape of their own.
 */
export type StatusLookId = 'quemado' | 'mojado' | 'congelado' | 'envenenado' | 'sangrado' | 'cegado' | 'paralizado' | 'cauterizado' | 'mareo' | 'llorera';
export type ReactionId = 'humo' | 'paralisis' | 'congelar' | 'arrastre' | 'veneno-ardiente' | 'vapor' | 'anicos' | 'contagio' | 'cauterizado' | 'tormenta';
/** How a status moves whoever carries it (battle-scene plays it). */
export type StatusMotion = 'freeze' | 'twitch' | 'sway';

/** A stream of one kind off the fighter, so many a second at each level. */
interface Stream {
  kind: string; rate: readonly [number, number, number];
  /** Off their parts (above a fraction of their height) or from a ball round their head. */
  from?: 'body' | 'head' | 'feet'; above?: number;
  outward?: number; up?: number; speed?: number; life: readonly [number, number];
  colour?: string; size?: number; spread?: number;
}
export interface StatusLook {
  name: string;
  /** Who decided it: the combat design's physical statuses, the campaign's, or what a reaction leaves. */
  family: 'físico' | 'campaña' | 'reacción';
  /** Seconds it lasts by default (the design's real-time statuses). */
  seconds: number;
  /** What it shows, in a sentence (the report and docs). */
  shows: string;
  /** Burns them (effects.fire through battle-scene `ignite`), at its level. */
  fire?: boolean;
  streams: Stream[];
  /** A field round them at this fraction of their height: swirl, pull and lift (m/s²), extra turbulence, reach past their body (m). */
  field?: { height: number; swirl: number; pull: number; lift: number; turbulence?: number; reach: number };
  /** Every so often, a burst (a heartbeat, a jolt). */
  pulse?: { every: number; streams: (Stream & { count: readonly [number, number, number]; chain?: number })[] };
  /** Light added to their body (linear RGB) at level 1; more at higher levels. */
  tint?: readonly [number, number, number];
  motion?: StatusMotion;
}

/** The particles statuses throw, on the GPU engine (src/fight-particles.ts), defined when first needed. */
export const STATUS_KINDS: Record<string, GpuKind> = {
  // Water: beads of it run down whoever is wet (they slide on their parts) and leave a little pool.
  drip: {
    drag: 1.2, gravity: 3.5, curl: .05, response: .2, collide: true, bounce: .02, friction: .97, stick: .3, stickTime: .7, size: [.016, .013], sizeJitter: .4, shape: 'dot', glass: .45,
    colours: ['#f2fbff', '#bfe6ff', '#8fcbf0'], intensity: [2.4, 2, 1.5], middle: .5, fadeIn: .15, fadeOut: .2, additive: .55, onLand: 'puddle',
  },
  puddle: {
    drag: 8, gravity: 30, collide: true, bounce: 0, friction: 1, settle: true, size: [.016, .03], sizeJitter: .4, shape: 'dot', glass: .7,
    colours: ['#e6f7ff', '#a8dcff', '#6fb6e8'], intensity: [1.2, 1, .8], fadeOut: .4, additive: .5, life: [1, 1.8],
  },
  // Frost: crystals that grow on their parts and stay there, and cold that falls off them.
  rime: {
    drag: 4, gravity: 0, curl: 0, response: 0, collide: true, bounce: 0, friction: 1, stick: 1, stickTime: 6, size: [.018, .028], sizeJitter: .6, spin: 0, shape: 'shard',
    colours: ['#ffffff', '#e2f6ff', '#a8dcff'], intensity: [2.2, 1.7, 1.2], middle: .5, fadeIn: .2, fadeOut: .15, additive: .6, glass: .35,
  },
  chill: {
    drag: 2.2, gravity: .5, curl: .5, response: .6, size: [.025, .07], sizeJitter: .5, shape: 'glow',
    colours: ['#ffffff', '#dff4ff', '#bfe6ff'], intensity: [1.4, 1.1, .8], middle: .4, fadeIn: .25, fadeOut: .5, additive: .5, opacity: .35,
  },
  // Steam (water on fire): white haze that rushes up and spreads.
  steam: {
    drag: 1.4, gravity: -3, curl: 1.4, response: 1, size: [.05, .16], sizeJitter: .6, shape: 'glow',
    colours: ['#ffffff', '#f2f6f8', '#dfe6ea'], intensity: [1.6, 1.2, .8], middle: .3, fadeIn: .1, fadeOut: .55, additive: .4, opacity: .25,
  },
  // Poison: beads of it bubbling up off them, glassy and green, and a low sickly haze round their feet.
  toxin: {
    drag: 1.6, gravity: -.7, curl: .35, response: .8, size: [.012, .022], sizeJitter: .5, shape: 'dot', glass: .8,
    colours: ['#eaffc8', '#9be04a', '#4f9a1e'], intensity: [2, 1.6, 1.1], middle: .4, fadeIn: .2, fadeOut: .25, additive: .7,
  },
  ooze: {
    drag: .8, gravity: 6, curl: .05, response: .2, collide: true, bounce: 0, friction: .96, stick: .4, stickTime: .7, size: [.012, .01], shape: 'dot',
    colours: ['#d4ff8a', '#7cc832', '#3f7a14'], intensity: [1.6, 1.2, .9], middle: .5, fadeOut: .2, additive: .25, onLand: 'puddle',
  },
  miasma: {
    drag: 2, gravity: -.15, curl: .7, response: .8, size: [.05, .13], sizeJitter: .6, shape: 'glow',
    colours: ['#c6ff7a', '#7cc832', '#3a6a14'], intensity: [1.4, 1, .6], middle: .4, fadeIn: .3, fadeOut: .5, additive: .45, opacity: .3,
  },
  // Blood: drops that spurt from them with each beat, fall and stay on the floor a while.
  blood: {
    drag: .3, gravity: 9, curl: .02, response: .1, collide: true, bounce: 0, friction: .7, size: [.011, .009], sizeJitter: .5, stretch: .02, shape: 'dot',
    colours: ['#ff4a5a', '#c01c2c', '#7a0e18'], intensity: [1.3, 1, .8], middle: .4, fadeOut: .1, additive: .1, onLand: 'pool',
  },
  pool: {
    drag: 8, gravity: 30, collide: true, bounce: 0, friction: 1, settle: true, size: [.016, .028], sizeJitter: .5, shape: 'dot',
    colours: ['#b0182a', '#8a1020', '#5a0a12'], intensity: [1, .9, .8], fadeOut: .35, additive: .05, life: [2.5, 4],
  },
  // Smoke that blinds: dark haze that clings round their head, turning.
  smog: {
    drag: 1.8, gravity: -.1, curl: .8, response: 1, size: [.07, .2], sizeJitter: .6, shape: 'glow',
    colours: ['#c4bccc', '#8e8798', '#5e5866'], intensity: [1.1, .95, .85], middle: .4, fadeIn: .25, fadeOut: .5, additive: .15, opacity: .2,
  },
}

/** Each status's look. Rates are per second at levels I, II and III. */
export const STATUS_LOOKS: Record<StatusLookId, StatusLook> = {
  quemado: {
    name: 'Quemado', family: 'físico', seconds: 20, fire: true,
    shows: 'Arde: la llama trepa por su cuerpo y crece con el nivel (I llamita, II hoguera, III incendio); brasas y chisporroteo saltan de sus piezas.',
    streams: [],
  },
  mojado: {
    name: 'Mojado', family: 'físico', seconds: 20,
    shows: 'Gotas que se forman en su cuerpo y bajan resbalando por sus piezas hasta dejar charquitos; un brillo frío y destellos de agua.',
    streams: [
      { kind: 'drip', rate: [14, 28, 50], from: 'body', above: .2, outward: .02, speed: .05, life: [2, 3.2] },
      { kind: 'twinkle', rate: [4, 8, 14], from: 'body', above: .3, outward: .05, life: [.25, .45], colour: '#cfeeff', size: .5 },
    ],
    tint: [0, .015, .05],
  },
  congelado: {
    name: 'Congelado', family: 'físico', seconds: 15,
    shows: 'Escarcha que crece pegada a sus piezas y se queda, y frío que cae de su cuerpo; queda quieto, sin respirar ni moverse, con un brillo helado.',
    streams: [
      { kind: 'rime', rate: [60, 120, 200], from: 'body', outward: -.35, life: [4, 6] },
      { kind: 'chill', rate: [10, 20, 34], from: 'body', above: .3, outward: .15, speed: .1, life: [1.2, 2] },
    ],
    tint: [.04, .1, .18], motion: 'freeze',
  },
  envenenado: {
    name: 'Envenenado', family: 'físico', seconds: 20,
    shows: 'Burbujas verdes que brotan de su cuerpo y suben, gotas que rezuman y un vaho enfermizo a sus pies; se tambalea y le sube un tinte verdoso.',
    streams: [
      { kind: 'toxin', rate: [8, 16, 28], from: 'body', above: .3, outward: .1, up: .3, speed: .1, life: [.9, 1.6] },
      { kind: 'ooze', rate: [2, 5, 9], from: 'body', above: .3, outward: .02, life: [1.2, 2] },
      { kind: 'miasma', rate: [8, 14, 24], from: 'feet', spread: .35, up: .15, speed: .15, life: [1.5, 2.5] },
    ],
    pulse: { every: 2.2, streams: [{ kind: 'toxin', count: [12, 22, 36], rate: [0, 0, 0], from: 'body', above: .3, outward: .5, up: .6, speed: .3, life: [.8, 1.4] }] },
    tint: [.02, .09, 0], motion: 'sway',
  },
  sangrado: {
    name: 'Sangrado', family: 'físico', seconds: 20,
    shows: 'Con cada latido brotan gotas de sangre de su cuerpo que caen y quedan en el suelo; entre latido y latido, un goteo.',
    streams: [{ kind: 'blood', rate: [2, 4, 7], from: 'body', above: .25, outward: .05, life: [1, 1.6] }],
    pulse: { every: 1.1, streams: [{ kind: 'blood', count: [6, 12, 20], rate: [0, 0, 0], from: 'body', above: .3, outward: 1.1, up: .7, speed: .5, life: [.8, 1.4] }] },
    tint: [.05, 0, 0],
  },
  cegado: {
    name: 'Cegado', family: 'físico', seconds: 10,
    shows: 'Humo oscuro que se le pega a la cabeza y le da vueltas sin dejarle ver.',
    streams: [{ kind: 'smog', rate: [45, 75, 110], from: 'head', spread: .25, speed: .2, life: [1.4, 2.2] }],
    field: { height: .85, swirl: 5, pull: 3.5, lift: .2, turbulence: .4, reach: .5 },
  },
  paralizado: {
    name: 'Paralizado', family: 'físico', seconds: 8,
    shows: 'Descargas que le recorren el cuerpo a sacudidas, chispas que saltan de sus piezas y un parpadeo eléctrico; tiembla a tirones.',
    streams: [{ kind: 'spark', rate: [24, 45, 75], from: 'body', above: .2, outward: 1.1, speed: .7, life: [.2, .45], colour: '#d8ecff' }],
    pulse: { every: .3, streams: [{ kind: 'arc', count: [3, 5, 8], chain: 8, rate: [0, 0, 0], from: 'body', above: .15, outward: 1.8, speed: 1.4, life: [.2, .4], colour: '#cfe4ff' }] },
    tint: [.06, .08, .14], motion: 'twitch',
  },
  cauterizado: {
    name: 'Cauterizado', family: 'reacción', seconds: 12,
    shows: 'Las heridas, selladas al rojo: brasas apagadas que brillan pegadas a su cuerpo; no puede curarse mientras dura.',
    streams: [{ kind: 'ember', rate: [4, 7, 12], from: 'body', above: .25, outward: -.3, life: [1.5, 2.5], colour: '#ff8a5a' }],
    tint: [.05, .015, 0],
  },
  mareo: {
    name: 'Mareo', family: 'campaña', seconds: 12,
    shows: 'Lucecitas que le dan vueltas sobre la cabeza y se apagan en destellos; se tambalea.',
    streams: [{ kind: 'mote', rate: [9, 15, 22], from: 'head', spread: .3, speed: .2, life: [1.2, 1.8], colour: '#ffe680', size: 1.3 }],
    field: { height: 1.1, swirl: 10, pull: 6, lift: 0, reach: .45 },
    motion: 'sway',
  },
  llorera: {
    name: 'Llorera', family: 'campaña', seconds: 12,
    shows: 'Lágrimas que le saltan de la cara, caen y dejan charquitos a sus pies.',
    streams: [{ kind: 'drip', rate: [10, 16, 26], from: 'body', above: .72, outward: .8, up: 1, speed: .25, life: [.9, 1.4], colour: '#cfeaff', size: 1.4 }],
  },
};

/** The reactions the combat design decided (docs/combat.md): which status, which element, what it leaves. */
export const REACTIONS: Record<ReactionId, { name: string; status: StatusLookId; element: string; leaves: string; shows: string }> = {
  humo: { name: 'Humo', status: 'quemado', element: 'Agua', leaves: 'Cegado', shows: 'El agua apaga la llama de golpe en una nube de vapor y humo oscuro que se le queda en la cabeza.' },
  paralisis: { name: 'Parálisis', status: 'mojado', element: 'Eléctrico', leaves: 'Paralizado', shows: 'La descarga corre por el agua de su cuerpo: arcos que lo envuelven entero, chispas y un fogonazo.' },
  congelar: { name: 'Congelado', status: 'mojado', element: 'Frío', leaves: 'Congelado', shows: 'Las gotas se hielan en el sitio: una costra de escarcha le cubre de golpe y el frío cae.' },
  arrastre: { name: 'Arrastra el humo', status: 'cegado', element: 'Viento', leaves: 'Cegado en el otro bando', shows: 'Una ráfaga le arranca el humo de la cabeza y lo lleva al otro bando.' },
  'veneno-ardiente': { name: 'Veneno ardiente', status: 'envenenado', element: 'Fuego', leaves: 'Daño a los adyacentes', shows: 'El veneno estalla en llamas verdes y naranjas: chispas a los lados que alcanzan a quien tenga al lado.' },
  vapor: { name: 'Vapor', status: 'mojado', element: 'Fuego', leaves: 'Daño leve a todos los enemigos', shows: 'El agua hierve: una columna de vapor que sube y se extiende sobre todos los enemigos un rato.' },
  anicos: { name: 'Añicos', status: 'congelado', element: 'Golpe físico fuerte', leaves: 'Daño extra; se acaba Congelado', shows: 'El hielo revienta en esquirlas que salen girando y rebotan, y deja escarcha en el suelo.' },
  contagio: { name: 'Contagio', status: 'envenenado', element: 'Agua', leaves: 'Envenenado más débil en los adyacentes', shows: 'El veneno se diluye en un vaho verde que fluye hasta quien tiene al lado y le prende.' },
  cauterizado: { name: 'Cauterizado', status: 'sangrado', element: 'Fuego', leaves: 'Cauterizado (no puede curarse)', shows: 'Un fogonazo sella las heridas: chisporroteo, una voluta de humo y las heridas brillando al rojo.' },
  tormenta: { name: 'Tormenta', status: 'cegado', element: 'Eléctrico', leaves: 'Daño a todos los que están en el humo', shows: 'La descarga salta por el humo de un luchador a otro: arcos entre todos los que están dentro.' },
};

/** A fighter as status effects need them: who, their model, where their feet are, their slot in the fight's particles. */
export interface StatusFighter { id: string; model: pc.Entity; feet: pc.Vec3; index: number; party: boolean }

interface Active {
  look: StatusLookId; level: number; left: number; total: number;
  /** Counted in rounds by the fight (the campaign's statuses): its clock does not run. */
  held: boolean;
  emitters: { stream: Stream; emitter: GpuEmitter }[]; field?: GpuField; beat: number; ending: boolean;
}

export function createStatusFx(effects: Effects, hooks: { ignite(id: string, level?: FireLevel): void }) {
  const on = new Map<string, Active[]>();
  let fighters: StatusFighter[] = [];
  /** Steam that lingers over a side after Vapor, and others that last a moment. */
  const timed: { left: number; end(): void }[] = [];
  const levelOf = (n: number) => Math.max(1, Math.min(3, Math.round(n)));
  const fireLevel = (level: number): FireLevel => level >= 3 ? 'high' : level >= 2 ? 'medium' : 'light';
  const gpu = () => effects.gpu && effects.gpu.active ? effects.gpu : undefined;
  function ensureKinds() {
    const g = effects.gpu;
    if (!g) return;
    for (const [name, kind] of Object.entries(STATUS_KINDS)) if (!g.get(name)) g.define(name, kind);
  }
  const find = (id: string) => fighters.find(f => f.id === id);
  const bodyFor = (f: StatusFighter): Body => bodyOf(f.model, f.feet);
  /** Where a stream is born: on their parts, round their head or round their feet. */
  function streamSpawn(stream: Stream, f: StatusFighter, body: Body) {
    if (stream.from === 'head') return { at: { x: f.feet.x, y: f.feet.y + body.height * .85, z: f.feet.z }, shape: 'ball' as const, spread: stream.spread ?? .2 };
    if (stream.from === 'feet') return { at: { x: f.feet.x, y: f.feet.y + .06, z: f.feet.z }, shape: 'ring' as const, spread: (stream.spread ?? .3) + body.radius };
    return { at: f.feet, shape: 'surface' as const, fighter: f.index, above: stream.above ?? 0 };
  }
  function burstOf(stream: Stream, f: StatusFighter, count: number, extra: { chain?: number } = {}) {
    const g = gpu();
    if (!g || count <= 0) return;
    const body = bodyFor(f);
    g.burst(stream.kind, { ...streamSpawn(stream, f, body), count: extra.chain ? count * extra.chain : count, chain: extra.chain, outward: stream.outward, up: stream.up, speed: stream.speed, life: stream.life, colour: stream.colour, size: stream.size,
      ...(stream.kind === 'arc' ? { light: { intensity: 1.6, range: 2, colour: stream.colour } } : {}) });
  }
  function startStreams(a: Active, f: StatusFighter) {
    const g = gpu(), look = STATUS_LOOKS[a.look];
    if (!g || a.emitters.length || a.field) return;
    ensureKinds();
    const body = bodyFor(f);
    a.emitters = look.streams.map(stream => ({ stream, emitter: g.emitter(stream.kind, { ...streamSpawn(stream, f, body), rate: 0, outward: stream.outward, up: stream.up, speed: stream.speed, life: stream.life, colour: stream.colour, size: stream.size }) }));
    if (look.field) a.field = g.field({ at: f.feet, radius: body.radius + look.field.reach, swirl: look.field.swirl, pull: look.field.pull, lift: look.field.lift, turbulence: look.field.turbulence ?? 0, follow: f.model, offset: { x: 0, y: body.height * look.field.height, z: 0 } });
  }
  function stopStreams(a: Active) {
    a.emitters.forEach(e => e.emitter.remove()); a.emitters = [];
    a.field?.remove(); a.field = undefined;
  }

  const api = {
    /** Who is in the fight this frame, in the fight particles' order (battle-scene). */
    setFighters(list: StatusFighter[]) { fighters = list; },
    /**
     * Puts a status on someone at `level` (1–3) for `seconds` (its look's default): again while it is on
     * it raises the level and starts its clock again (the design's `escalate`), unless `level` is given.
     */
    apply(id: string, look: StatusLookId, o: { level?: number; seconds?: number; left?: number; held?: boolean } = {}) {
      const f = find(id);
      if (!f) return;
      const list = on.get(id) ?? [];
      on.set(id, list);
      let a = list.find(s => s.look === look && !s.ending);
      const seconds = o.seconds ?? STATUS_LOOKS[look].seconds;
      if (a) { a.level = levelOf(o.level ?? a.level + 1); a.total = seconds; a.left = o.left ?? seconds; a.held = !!o.held; }
      else {
        a = { look, level: levelOf(o.level ?? 1), left: o.left ?? seconds, total: seconds, held: !!o.held, emitters: [], beat: 0, ending: false };
        list.push(a);
      }
      if (STATUS_LOOKS[look].fire) hooks.ignite(id, fireLevel(a.level));
    },
    /** Takes a status off at once. */
    remove(id: string, look: StatusLookId) {
      const a = on.get(id)?.find(s => s.look === look && !s.ending);
      if (!a) return;
      a.ending = true; a.left = 0;
      stopStreams(a);
      if (STATUS_LOOKS[look].fire) hooks.ignite(id);
    },
    has(id: string, look: StatusLookId) { return !!on.get(id)?.some(s => s.look === look && !s.ending); },
    /** What is on someone: look, level and how much is left (0–1). */
    on(id: string) { return (on.get(id) ?? []).filter(s => !s.ending).map(s => ({ look: s.look, level: s.level, left: s.total > 0 ? s.left / s.total : 0 })); },
    /** Light their statuses add to their body this frame (linear RGB). */
    tint(id: string, time: number): [number, number, number] {
      const out: [number, number, number] = [0, 0, 0];
      for (const a of on.get(id) ?? []) {
        const t = STATUS_LOOKS[a.look].tint;
        if (!t || a.ending) continue;
        // Paralysis flickers; the rest hold steady, stronger at higher levels.
        const k = (.7 + .3 * a.level) * (a.look === 'paralizado' ? .4 + .6 * Math.abs(Math.sin(time * 37 + Math.sin(time * 11) * 3)) : 1);
        for (let c = 0; c < 3; c++) out[c] += t[c] * k;
      }
      return out;
    },
    /** How their statuses move them: frozen stands still, paralysed twitches, poisoned and dizzy sway. */
    motion(id: string): StatusMotion | undefined {
      const looks = (on.get(id) ?? []).filter(s => !s.ending).map(s => STATUS_LOOKS[s.look].motion);
      return looks.includes('freeze') ? 'freeze' : looks.includes('twitch') ? 'twitch' : looks.includes('sway') ? 'sway' : undefined;
    },
    /** A reaction on `id` (docs/combat.md): what was on them turns into what it leaves, with its moment. */
    react(reaction: ReactionId, id: string) {
      const f = find(id), g = gpu();
      if (!f) return;
      ensureKinds();
      const body = bodyFor(f), chest = { x: f.feet.x, y: f.feet.y + body.height * .55, z: f.feet.z }, head = { x: f.feet.x, y: f.feet.y + body.height * .85, z: f.feet.z };
      const side = fighters.filter(o => o.party === f.party && o.id !== id);
      const neighbours = side.filter(o => o.feet.distance(f.feet) < 1.6);
      const others = fighters.filter(o => o.party !== f.party);
      const centre = (list: StatusFighter[]) => list.reduce((c, o) => c.add(o.feet), new pc.Vec3()).mulScalar(1 / Math.max(1, list.length));
      const chestOf = (o: StatusFighter) => ({ x: o.feet.x, y: o.feet.y + bodyFor(o).height * .55, z: o.feet.z });
      const level = on.get(id)?.find(s => s.look === REACTIONS[reaction].status && !s.ending)?.level ?? 1;
      api.remove(id, REACTIONS[reaction].status);
      switch (reaction) {
        case 'humo':
          g?.burst('steam', { at: chest, count: 180, spread: body.radius * .7, up: 2, speed: 1.2, life: [.8, 1.6] });
          g?.burst('smog', { at: head, count: 220, spread: .3, up: .8, speed: 1, life: [1.5, 2.5] });
          api.apply(id, 'cegado', { level });
          break;
        case 'paralisis':
          g?.burst('arc', { at: chest, count: 14 * 10, chain: 10, shape: 'surface', fighter: f.index, outward: 2, speed: 1.5, life: [.25, .5], colour: '#cfe4ff', light: { intensity: 4, range: 3, colour: '#cfe4ff' } });
          g?.burst('spark', { at: chest, count: 120, shape: 'surface', fighter: f.index, outward: 2.5, speed: 1.5, life: [.3, .7], colour: '#d8ecff' });
          g?.burst('drip', { at: chest, count: 60, shape: 'surface', fighter: f.index, outward: 1.5, up: 1, speed: .8, life: [.6, 1] });
          api.apply(id, 'paralizado', { level });
          break;
        case 'congelar':
          g?.burst('rime', { at: f.feet, count: 360, shape: 'surface', fighter: f.index, outward: -.4, life: [5, 6] });
          g?.burst('chill', { at: chest, count: 140, spread: body.radius, speed: .4, life: [1.2, 2.2] });
          g?.burst('frost', { at: { x: f.feet.x, y: f.feet.y + .05, z: f.feet.z }, count: 80, shape: 'ring', spread: body.radius + .15, speed: .3, around: .4, life: [1.4, 2.2] });
          api.apply(id, 'congelado', { level });
          break;
        case 'arrastre': {
          // A gust from their side to the other carries the smoke across.
          const to = centre(others), dir = to.clone().sub(f.feet).normalize();
          g?.burst('smog', { at: head, count: 260, spread: .35, velocity: { x: dir.x * 4, y: .6, z: dir.z * 4 }, speed: 1, cone: .5, life: [1.2, 2] });
          timed.push({ left: .7, end: () => others.forEach(o => api.apply(o.id, 'cegado', { level })) });
          break;
        }
        case 'veneno-ardiente':
          g?.burst('crackle', { at: chest, count: 260, spread: .15, speed: 4.5, life: [.4, .9], colour: '#d6ff7a' });
          g?.burst('ember', { at: chest, count: 120, spread: .2, speed: 2.5, life: [.8, 1.6], colour: '#ffb84a' });
          g?.burst('toxin', { at: chest, count: 80, spread: .2, speed: 2, life: [.6, 1.2] });
          for (const o of neighbours) g?.burst('crackle', { at: chest, to: chestOf(o), shape: 'line', count: 120, speed: .8, life: [.3, .6], colour: '#ffcf6a', light: { intensity: 3, range: 2.2, colour: '#ffb84a' } });
          hooks.ignite(id, 'medium');
          timed.push({ left: 1.2, end: () => hooks.ignite(id) });
          break;
        case 'vapor':
          g?.burst('steam', { at: chest, count: 320, spread: body.radius, up: 3, speed: 1.5, life: [1, 2] });
          // Then it hangs over the other side a while, scalding.
          for (const o of others) {
            const e = g?.emitter('steam', { at: { x: o.feet.x, y: o.feet.y + .1, z: o.feet.z }, shape: 'ring', spread: .45, rate: 40, up: 1.2, speed: .3, life: [1, 1.8] });
            if (e) timed.push({ left: 4, end: () => e.remove() });
          }
          break;
        case 'anicos':
          // The ice bursts into fine splinters that fly off spinning and skitter, glittering, and frost the floor.
          g?.burst('rime', { at: f.feet, count: 420, shape: 'surface', fighter: f.index, outward: 3.2, up: 1.6, speed: 1.6, life: [.6, 1.2] });
          g?.burst('twinkle', { at: chest, count: 40, spread: body.radius, speed: 2, life: [.3, .6], colour: '#e6f6ff', size: .6 });
          g?.burst('chill', { at: chest, count: 90, spread: body.radius, speed: 1.2, life: [.8, 1.5] });
          g?.burst('frost', { at: { x: f.feet.x, y: f.feet.y + .05, z: f.feet.z }, count: 90, shape: 'ring', spread: body.radius + .2, speed: .5, around: .4, life: [1.4, 2.2] });
          break;
        case 'contagio':
          g?.burst('drip', { at: chest, count: 80, shape: 'surface', fighter: f.index, outward: .8, up: .6, speed: .5, life: [.6, 1.2] });
          for (const o of neighbours) {
            g?.burst('miasma', { at: chest, to: chestOf(o), shape: 'line', count: 160, speed: .3, life: [1, 1.8] });
            timed.push({ left: .8, end: () => api.apply(o.id, 'envenenado', { level: Math.max(1, level - 1) }) });
          }
          if (level > 1) api.apply(id, 'envenenado', { level: level - 1 });
          break;
        case 'cauterizado':
          g?.burst('flare', { at: chest, count: 3, spread: .1, life: [.2, .3], light: { intensity: 4, range: 2.5, colour: '#ffb070' } });
          g?.burst('crackle', { at: chest, count: 140, shape: 'surface', fighter: f.index, outward: 1.8, up: 1.5, speed: 1, life: [.3, .7] });
          g?.burst('smog', { at: chest, count: 60, spread: .2, up: 1, speed: .4, life: [1, 1.8] });
          api.apply(id, 'cauterizado', { level });
          break;
        case 'tormenta': {
          // The bolt jumps through the smoke to everyone in it.
          const inSmoke = fighters.filter(o => o.id !== id && api.has(o.id, 'cegado'));
          for (const o of inSmoke.length ? inSmoke : others) g?.burst('arc', { at: chest, to: chestOf(o), shape: 'line', count: 3 * 16, chain: 16, speed: .6, life: [.25, .45], colour: '#e6eeff', light: { intensity: 4, range: 3, colour: '#cfe0ff' } });
          g?.burst('spark', { at: chest, count: 100, spread: .2, speed: 3, life: [.3, .6], colour: '#e6eeff' });
          break;
        }
      }
    },
    update(dt: number, time: number) {
      for (let i = timed.length - 1; i >= 0; i--) if ((timed[i].left -= dt) <= 0) { timed[i].end(); timed.splice(i, 1); }
      for (const [id, list] of on) {
        const f = find(id);
        list.forEach(a => {
          const look = STATUS_LOOKS[a.look];
          if (!a.ending && !a.held) a.left -= dt;
          if (a.left <= 0 && !a.ending) api.remove(id, a.look);
          if (!f) return;
          const body = bodyFor(f);
          if (a.ending || !f.model.enabled) { stopStreams(a); return; }
          startStreams(a, f);
          for (const { stream, emitter } of a.emitters) {
            emitter.rate = stream.rate[a.level - 1];
            Object.assign(emitter, streamSpawn(stream, f, body));
          }
          // Pulses keep their rhythm (a heartbeat, a jolt).
          if (look.pulse && (a.beat -= dt) <= 0) {
            a.beat = look.pulse.every * (.85 + Math.random() * .3);
            for (const stream of look.pulse.streams) burstOf(stream, f, stream.count[a.level - 1], { chain: stream.chain });
          }
        });
        for (let i = list.length - 1; i >= 0; i--) if (list[i].ending) list.splice(i, 1);
        if (!list.length) on.delete(id);
      }
      void time;
    },
    /** Every status off at once (the fight ended). */
    clear() {
      for (const list of on.values()) for (const a of list) stopStreams(a);
      on.clear(); timed.length = 0;
    },
    destroy() { api.clear(); },
  };
  return api;
}
export type StatusFx = ReturnType<typeof createStatusFx>;
