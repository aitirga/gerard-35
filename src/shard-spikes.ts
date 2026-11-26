import * as pc from 'playcanvas';
import { bodyOf, type Effects } from './effects.ts';
import type { GpuKind } from './fight-particles.ts';
import { pickAnchors, placeAnchors, type SurfaceAnchor } from './surface-samples.ts';

/**
 * Cristalizado's look (electricity on the powder, docs/animas/README.md § Empolvado): the powder
 * round a fighter draws together into spikes of purple crystal, each aimed at its body, that stand
 * a moment in the air and then drive into it one after another, a short dart each, buried by its
 * point and left quivering. They stay on its skin as it moves (points of its real surface, bent by
 * its bones: src/surface-samples.ts). Each blow on it drives every spike in deeper, the way the
 * status grows (`POWDER_RULES.shard` more a level), and a few more arrive; when it ends they
 * shatter. Only the look: nothing here touches a fight's numbers.
 */
const C = { deep: '#3a1080', body: '#7434d8', light: '#b98cff', pale: '#e8dbff', glow: '#8a4dff' } as const;
/** Seconds: a spike grows in the air, waits its turn, crosses to the body; the gap between two spikes leaving. */
const T = { form: .22, hold: .24, gap: .035, flight: .1 } as const;
/** Fraction of a spike buried on landing, and more for each level of Cristalizado (to `LEVELS`). */
const DEPTH = { first: .2, step: .03 } as const;
/** Each level of Cristalizado the spikes grow this much bigger and glow this much more: the crystal takes the body over. */
const GROW = { size: .16, glow: .22 } as const;
const LEVELS = 5;
/** Spikes on a fighter at first (by its size), more with each level, and at most. */
const COUNT = { base: 8, perMetre: 4, perLevel: 2, most: 24 } as const;

export const SHARD_KINDS: Record<string, GpuKind> = {
  // A spike leaving the air: a short purple streak towards the body.
  shardstreak: {
    shape: 'streak', drag: 0, gravity: 0, curl: 0, response: 0, size: [.022, .008], sizeJitter: .3, stretch: .05,
    colours: ['#ffffff', C.light, C.body], intensity: [4, 2.6, 1.2], middle: .3, fadeIn: 0, fadeOut: .7, additive: 1, opacity: 1,
  },
  // Where it goes in: a purple flash and chips of crystal thrown back out.
  shardflash: {
    shape: 'glow', drag: 0, gravity: 0, curl: 0, response: 0, size: [.12, .3], colours: ['#ffffff', C.light, C.glow], intensity: [6, 3, 1], middle: .3, fadeIn: 0, fadeOut: .8, additive: 1, opacity: 1,
  },
  shardchip: {
    shape: 'shard', drag: .9, gravity: 8, curl: .1, response: .2, collide: true, bounce: .35, friction: .5, size: [.03, .02], sizeJitter: .6, stretch: .012, spin: 620,
    colours: [C.pale, C.light, C.body], intensity: [3, 1.8, 1.1], middle: .2, fadeIn: 0, fadeOut: .3, additive: .2, opacity: .95,
  },
};

interface Spike {
  entity: pc.Entity; instance: pc.MeshInstance;
  /** Its length (m), turn round its own axis, lean off the surface's normal, the way it quivers. */
  length: number; roll: number; lean: pc.Vec3; wobble: pc.Vec3;
  /** When it starts to grow, when it leaves, how far out it waits (m), and whether it is in. */
  born: number; launch: number; far: number; landed: boolean; streaked: boolean;
  /** How much of it is buried (spring towards `depth`), how hard it quivers and since when; its glow. */
  depth: number; buried: number; sink: number; quiver: number; quiverAt: number; flash: number;
  /** How big it is shown against its length (eased towards its level's). */
  size: number;
}
interface Stuck {
  model: pc.Entity; anchors: SurfaceAnchor[]; local?: pc.Vec3[]; positions: pc.Vec3[]; normals: pc.Vec3[];
  spikes: Spike[]; left: number; level: number; height: number;
}

/** A spike, along +y: buried by a long sharp point at y 0, six faceted sides, and a short broken point outside. */
function spikeMesh(device: pc.GraphicsDevice, seed: number) {
  const rnd = (() => { let s = seed * 9301 + 49297; return () => ((s = (s * 9301 + 49297) % 233280) / 233280); })();
  const sides = 6, r = .12, tip = .42, shaft = .84, top = 1;
  const ring = (y: number, k: number) => Array.from({ length: sides }, (_, i) => {
    const a = (i + .5 * rnd()) / sides * Math.PI * 2, rr = r * k * (.82 + rnd() * .3);
    return new pc.Vec3(Math.cos(a) * rr, y, Math.sin(a) * rr);
  });
  const low = ring(tip, 1), high = ring(shaft, .92), point = new pc.Vec3(0, 0, 0), crown = new pc.Vec3(r * (rnd() - .5) * .6, top, r * (rnd() - .5) * .6);
  const positions: number[] = [], normals: number[] = [], colours: number[] = [];
  const shade = (y: number, k: number) => {
    // Deep at its buried point, lighter out towards the end; each face a little brighter or darker.
    const c = new pc.Color().fromString(C.deep).lerp(new pc.Color().fromString(C.deep), new pc.Color().fromString(C.body), Math.min(1, y / tip));
    if (y > tip) c.lerp(c, new pc.Color().fromString(C.light), (y - tip) / (top - tip));
    return [Math.min(1, c.r * k), Math.min(1, c.g * k), Math.min(1, c.b * k), 1];
  };
  const tri = (a: pc.Vec3, b: pc.Vec3, c: pc.Vec3, k: number) => {
    // Facing out, away from its axis.
    const mid = new pc.Vec3().add2(a, b).add(c).mulScalar(1 / 3), axis = new pc.Vec3(0, mid.y, 0);
    let n = new pc.Vec3().cross(new pc.Vec3().sub2(b, a), new pc.Vec3().sub2(c, a));
    if (n.dot(mid.sub(axis)) < 0) { [b, c] = [c, b]; n = n.mulScalar(-1); }
    n.normalize();
    for (const p of [a, b, c]) { positions.push(p.x, p.y, p.z); normals.push(n.x, n.y, n.z); colours.push(...shade(p.y, k)); }
  };
  for (let i = 0; i < sides; i++) {
    const j = (i + 1) % sides, k = .82 + rnd() * .36;
    tri(point, low[j], low[i], k * .9);
    tri(low[i], low[j], high[j], k); tri(low[i], high[j], high[i], k);
    tri(high[i], high[j], crown, k * 1.15);
  }
  const mesh = new pc.Mesh(device);
  mesh.setPositions(positions); mesh.setNormals(normals); mesh.setColors(colours);
  mesh.update(pc.PRIMITIVE_TRIANGLES);
  return mesh;
}

export function createShardSpikes(app: pc.AppBase, effects: Effects) {
  const gpu = () => effects.gpu && effects.gpu.active ? effects.gpu : undefined;
  const g0 = effects.gpu;
  if (g0) for (const [name, kind] of Object.entries(SHARD_KINDS)) if (!g0.get(name)) try { g0.define(name, kind); } catch { /* the engine's kinds are full: no particles for it */ }
  const kind = (name: string, fallback: string) => gpu()?.get(name) ? name : fallback;
  // Every spike shares these, and a mesh instance destroyed with its spike destroys the mesh once none holds it: the
  // module holds them too, so the first spikes to shatter never leave the next ones drawing a mesh that is gone.
  const meshes = Array.from({ length: 4 }, (_, i) => { const mesh = spikeMesh(app.graphicsDevice, i + 1); mesh.incRefCount(); return mesh; });
  const material = new pc.StandardMaterial();
  material.name = 'Esquirla';
  material.diffuse.set(1, 1, 1); material.diffuseVertexColor = true;
  material.emissive.fromString(C.glow); material.emissiveIntensity = .55;
  material.specular.set(.95, .9, 1); material.gloss = .92; material.useMetalness = false;
  material.update();
  const stuck = new Map<string, Stuck>();
  let now = 0;

  /** The camera the fight is seen through, to put most spikes on the side we see. */
  function camera() {
    const cams = (app.root.findComponents('camera') as pc.CameraComponent[]).filter(c => c.enabled && c.entity.enabled);
    return cams.sort((a, b) => b.priority - a.priority)[0]?.entity.getPosition();
  }

  /** `count` more spikes on `s`, leaving from `from` seconds now, one after another. */
  function add(s: Stuck, count: number, from: number) {
    const body = bodyOf(s.model, s.model.getPosition()), feet = s.model.getPosition(), eye = camera();
    const size = Math.min(1.5, Math.max(.75, body.height / 1.5));
    const spacing = .2 * size;
    const taken = s.spikes.map((_, i) => s.positions[i]).filter(Boolean);
    const keep = (p: pc.Vec3, n: pc.Vec3, chosen: readonly pc.Vec3[]) => {
      const h = (p.y - feet.y) / body.height;
      if (h < .14 || n.y < -.55) return false;
      if (eye && Math.random() < .7) { const to = new pc.Vec3().sub2(eye, p).normalize(); if (to.dot(n) < -.1) return false; }
      return ![...taken, ...chosen].some(q => q.distance(p) < spacing);
    };
    let anchors: SurfaceAnchor[] = [];
    if (!s.local) {
      anchors = pickAnchors(s.model, count, keep);
      // No surface to read: points round the body's box, kept in the model's own space.
      if (anchors.length < Math.min(count, 4) && !s.anchors.length) { s.local = []; anchors = []; }
    }
    if (s.local) {
      const inverse = s.model.getWorldTransform().clone().invert();
      for (let i = 0; i < count; i++) {
        const a = Math.random() * Math.PI * 2, y = .2 + Math.random() * .7;
        const world = new pc.Vec3(feet.x + Math.cos(a) * body.radius, feet.y + y * body.height, feet.z + Math.sin(a) * body.radius);
        s.local.push(inverse.transformPoint(world));
      }
    }
    const made = s.local ? count : anchors.length;
    s.anchors.push(...anchors);
    for (let i = 0; i < made; i++) {
      s.positions.push(new pc.Vec3()); s.normals.push(new pc.Vec3(0, 1, 0));
      const entity = new pc.Entity('Esquirla');
      const instance = new pc.MeshInstance(meshes[Math.floor(Math.random() * meshes.length)], material);
      entity.addComponent('render', { meshInstances: [instance], castShadows: false, receiveShadows: false });
      entity.setLocalScale(1e-4, 1e-4, 1e-4);
      app.root.addChild(entity);
      const length = (.36 + Math.random() * .22) * size;
      const lean = new pc.Vec3(Math.random() - .5, Math.random() - .5, Math.random() - .5).mulScalar(.5);
      const wobble = new pc.Vec3(Math.random() - .5, Math.random() - .5, Math.random() - .5).normalize();
      const born = now + from + i * T.gap * .6, launch = now + from + T.form + T.hold + i * T.gap;
      s.spikes.push({ entity, instance, length, roll: Math.random() * Math.PI * 2, lean, wobble, born, launch, far: (.55 + Math.random() * .4) * size, landed: false, streaked: false, depth: DEPTH.first + DEPTH.step * (s.level - 1), buried: 0, sink: 0, quiver: 0, quiverAt: 0, flash: 0, size: 1 + GROW.size * (s.level - 1) });
    }
  }

  /** Where `s`'s anchors are now. */
  function place(s: Stuck) {
    if (s.local) {
      const m = s.model.getWorldTransform(), feet = s.model.getPosition();
      s.local.forEach((l, i) => {
        m.transformPoint(l, s.positions[i]);
        s.normals[i].set(s.positions[i].x - feet.x, 0, s.positions[i].z - feet.z).normalize();
      });
      return s.local.map(() => true);
    }
    return placeAnchors(s.anchors, s.positions, s.normals);
  }

  function remove(s: Stuck) { s.spikes.forEach(p => p.entity.destroy()); s.spikes.length = 0; }
  /** Every spike on `s` breaks off in chips. */
  function shatter(s: Stuck) {
    const g = gpu();
    if (g) s.spikes.forEach(p => {
      if (!p.landed || !p.entity.enabled) return;
      const at = p.entity.getPosition(), up = p.entity.up;
      g.burst(kind('shardchip', 'splinter'), { at: { x: at.x + up.x * p.length * .5, y: at.y + up.y * p.length * .5, z: at.z + up.z * p.length * .5 }, count: 7, spread: .03, velocity: { x: up.x * 1.6, y: up.y * 1.6 + 1, z: up.z * 1.6 }, cone: .9, speed: 1.4, life: [.5, 1] });
    });
    remove(s);
  }

  const out = new pc.Vec3(), centre = new pc.Vec3(), inward = new pc.Vec3(), side = new pc.Vec3(), along = new pc.Vec3(), tipAt = new pc.Vec3();
  const align = new pc.Quat(), spin = new pc.Quat();
  function update(dt: number) {
    now += dt;
    const g = gpu();
    for (const [id, s] of stuck) {
      if (!s.model.enabled || !s.model.parent) { remove(s); stuck.delete(id); continue; }
      if ((s.left -= dt) <= 0) { shatter(s); stuck.delete(id); continue; }
      const found = place(s), feet = s.model.getPosition();
      centre.set(feet.x, feet.y + s.height * .55, feet.z);
      s.spikes.forEach((p, i) => {
        if (!found[i] || now < p.born) { p.entity.enabled = found[i] && now >= p.born; return; }
        p.entity.enabled = true;
        const at = s.positions[i];
        // Out of the body: its surface's way, turned a little towards the body's middle and leaning its own way.
        inward.sub2(centre, at).normalize();
        out.copy(s.normals[i]).mulScalar(.75).sub(inward.mulScalar(.35)).add(p.lean).normalize();
        let grown = 1, stretch = 1, outside: number;
        if (now < p.launch) {
          // Growing in the air, aimed at where it goes in.
          const u = Math.min(1, (now - p.born) / T.form);
          grown = 1 - (1 - u) ** 3;
          outside = p.far;
          p.roll += dt * 7 * (1 - u);
        } else if (!p.landed) {
          const u = Math.min(1, (now - p.launch) / T.flight);
          outside = p.far * (1 - u * u) * (1 - .12 * u) - p.length * p.depth * u * u;
          stretch = 1 + .45 * u;
          if (u >= 1) {
            // In: a little deeper than it stays, it springs back and quivers; a flash and chips where it went in.
            p.landed = true; p.buried = p.depth + .14; p.sink = 0; p.quiver = .32; p.quiverAt = now; p.flash = 1;
            if (g) {
              g.burst(kind('shardflash', 'bloom'), { at, count: 1, spread: 0, life: [.1, .14], size: .6 });
              g.burst(kind('shardchip', 'splinter'), { at, count: 4, spread: .02, velocity: { x: out.x * 2.2, y: out.y * 2.2 + .8, z: out.z * 2.2 }, cone: .8, speed: 1.2, life: [.35, .7] });
              if (g.get('crackle')) g.burst('crackle', { at, count: 3, spread: .02, velocity: { x: out.x * 2, y: out.y * 2, z: out.z * 2 }, cone: 1, speed: 1.5, life: [.1, .25] });
            }
          } else if (!p.streaked && g) {
            p.streaked = true;
            // Leaving: a short streak along its way in.
            const v = p.far / T.flight;
            g.burst(kind('shardstreak', 'needle'), { at: { x: at.x + out.x * p.far, y: at.y + out.y * p.far, z: at.z + out.z * p.far }, count: 2, spread: .01, velocity: { x: -out.x * v, y: -out.y * v, z: -out.z * v }, speed: 0, life: [T.flight * .9, T.flight * 1.1] });
          }
        } else outside = 0;
        if (p.landed) {
          // A spring that settles at its depth: stiff, a little loose.
          const k = 420, damp = 2 * Math.sqrt(k) * .3;
          p.sink += (-(p.buried - p.depth) * k - p.sink * damp) * Math.min(dt, 1 / 30);
          p.buried += p.sink * Math.min(dt, 1 / 30);
          outside = -p.length * p.buried;
          const t = now - p.quiverAt, angle = p.quiver * Math.exp(-7 * t) * Math.sin(t * 58);
          side.copy(p.wobble).sub(along.copy(out).mulScalar(p.wobble.dot(out)));
          if (side.lengthSq() > 1e-6) out.add(side.normalize().mulScalar(Math.tan(angle))).normalize();
          p.flash = Math.max(0, p.flash - dt * 3.5);
          p.size += (1 + GROW.size * (s.level - 1) - p.size) * Math.min(1, dt * 6);
        }
        // Its point at `outside` metres out along its way (below 0: buried), pointing in.
        tipAt.copy(out).mulScalar(outside!).add(at);
        p.entity.setPosition(tipAt);
        // +y onto `out`: the shortest turn, then its own roll.
        const d = 1 + out.y;
        if (d < 1e-5) align.set(1, 0, 0, 0); else align.set(out.z, 0, -out.x, d).normalize();
        spin.setFromAxisAngle(pc.Vec3.UP, p.roll * 180 / Math.PI);
        p.entity.setRotation(align.mul(spin));
        const w = p.length * grown * p.size;
        p.entity.setLocalScale(w / stretch ** .5, w * stretch, w / stretch ** .5);
        p.instance.setParameter('material_emissiveIntensity', .55 + GROW.glow * (s.level - 1) + p.flash * 5 + (p.landed ? 0 : .8));
      });
    }
  }
  app.on('update', update);

  const api = {
    /**
     * Spikes form round `id` (its `model`) and drive into it, as deep and as many as `level` of
     * Cristalizado asks; they stay `seconds`. Again on someone who has them: more, and their time
     * starts over.
     */
    crystallise(id: string, model: pc.Entity, seconds = 20, delay = 0, level = 1) {
      let s = stuck.get(id);
      const body = bodyOf(model, model.getPosition());
      if (!s) { s = { model, anchors: [], positions: [], normals: [], spikes: [], left: seconds, level: Math.min(LEVELS, Math.max(1, level)), height: body.height }; stuck.set(id, s); }
      s.left = seconds;
      const count = s.spikes.length ? COUNT.perLevel + 1 : Math.min(COUNT.most, Math.round(COUNT.base + COUNT.perMetre * body.height) + COUNT.perLevel * (s.level - 1));
      add(s, Math.min(count, COUNT.most - s.spikes.length), delay);
      return s.spikes.length > 0;
    },
    /**
     * A blow on `id`: every spike in it is yanked out a little and slammed back in deeper, quivering
     * and flashing, chips fly; it grows and glows a level more, and a few more come.
     */
    drive(id: string) {
      const s = stuck.get(id), g = gpu();
      if (!s) return false;
      s.level = Math.min(LEVELS, s.level + 1);
      s.spikes.forEach(p => {
        p.depth = DEPTH.first + DEPTH.step * (s.level - 1);
        if (!p.landed) return;
        p.sink = -4.5; p.quiver = .38; p.quiverAt = now; p.flash = 1.2;
        if (g && Math.random() < .7) {
          const at = p.entity.getPosition(), up = p.entity.up;
          g.burst(kind('shardchip', 'splinter'), { at: { x: at.x + up.x * p.length * .6, y: at.y + up.y * p.length * .6, z: at.z + up.z * p.length * .6 }, count: 2, spread: .02, velocity: { x: up.x * 2, y: up.y * 2 + 1, z: up.z * 2 }, cone: .9, speed: 1.5, life: [.4, .9] });
        }
      });
      if (s.spikes.length < COUNT.most) add(s, Math.min(COUNT.perLevel, COUNT.most - s.spikes.length), .05);
      return true;
    },
    /** Cristalizado at `level` on `id` with spikes already: those levels it reached with no blow shown come now. */
    setLevel(id: string, level: number) {
      const s = stuck.get(id);
      if (!s) return false;
      if (level < s.level) { s.level = Math.max(1, level); return true; }
      while (s.level < Math.min(LEVELS, level)) api.drive(id);
      return true;
    },
    /** The spikes on `id` stay `seconds` more (the fight keeps the time). */
    hold(id: string, seconds: number) { const s = stuck.get(id); if (s) s.left = seconds; },
    /** The spikes on `id` break off now (Cristalizado is over). */
    shatter(id: string) { const s = stuck.get(id); if (!s) return false; shatter(s); stuck.delete(id); return true; },
    /** `id`'s spikes go at once and quietly, nothing shown breaking (what Atractor extraño lifts off it to set somewhere else). */
    drop(id: string) { const s = stuck.get(id); if (!s) return false; remove(s); stuck.delete(id); return true; },
    /** Whether `id` has spikes in it. */
    has(id: string) { return stuck.has(id); },
    /** How deep the spikes on `id` are (its level of Cristalizado as shown), 0 for none. */
    level(id: string) { return stuck.get(id)?.level ?? 0; },
    clear() { stuck.forEach(remove); stuck.clear(); },
    destroy() { api.clear(); app.off('update', update); meshes.forEach(m => m.destroy()); material.destroy(); },
  };
  return api;
}
export type ShardSpikes = ReturnType<typeof createShardSpikes>;
