import * as pc from 'playcanvas';
import type { DieFace } from './battle';
import { FACE_ICONS, FACE_INK } from './die-faces.ts';
import { createStarDie } from './dice.ts';

/**
 * What a die of Dadista's leaves where it lands (docs/animas/dadaista/ § Look and interface): its
 * face as a scrap of printed paper slapped onto whoever it hit. Torn ivory, the ornament in ink over
 * the same ornament a little off in vermilion (a print out of register), as big as their chest and
 * never quite straight; it is slammed on, holds a moment and is torn away. The Comodín's is black
 * lacquer with its red star. The astral's are no paper: a four-point star of bluish-white light
 * (`astral`) and its soft halo (`halo`); and the dice that are stars (`crystal`, `keepCrystal`): a
 * cube of glass (src/dice.ts) turning inside that star.
 *
 * Each is one quad facing the camera with its picture: solid and readable where a drawing in dots
 * was thin. The caller says which, where and how big; `update` slams it in, holds it and lets it go.
 */
export type StampId = DieFace | 'astral' | 'halo';
export interface StampOptions {
  /** Degrees it sits turned, clockwise from the camera; `spin` more every second as it goes. */
  roll?: number; spin?: number;
  /** Mirrored left to right (a hand pointing the other way). */
  flip?: boolean;
  /** Where it comes from as it is slammed on, from its place. */
  from?: { x: number; y: number; z: number };
  /** Its size as it starts, × its own (2: it comes down from twice as big; under 1: it opens out). */
  start?: number;
  /** Seconds: slamming on, holding, going. */
  slam?: number; hold?: number; out?: number;
  /** How much bigger it is by the time it has gone (× its own, added), and how far it falls (m). */
  grow?: number; fall?: number;
  /** How strong it is at its fullest (1). */
  opacity?: number;
}

const CELL = 256;
/** A torn sheet inside the cell: a rough four-sided scrap, its edges bitten, the same for a given `seed`. */
function scrap(seed: number) {
  let s = seed * 9301 + 49297;
  const random = () => { s = (s * 233280 + 49297) % 2147483647; return (s % 10000) / 10000; };
  const inset = CELL * .07, w = CELL - inset * 2, steps = 13, path = new Path2D();
  const corners: [number, number][] = [[inset, inset], [inset + w, inset], [inset + w, inset + w], [inset, inset + w]];
  corners.forEach(([x, y], side) => {
    const [nx, ny] = corners[(side + 1) % 4];
    for (let i = 0; i < steps; i++) {
      const k = i / steps, bite = (random() - .5) * CELL * .045, px = x + (nx - x) * k, py = y + (ny - y) * k;
      // Bitten across the edge, never along it.
      const ax = side % 2 ? bite : 0, ay = side % 2 ? 0 : bite;
      if (side === 0 && i === 0) path.moveTo(px + ax, py + ay); else path.lineTo(px + ax, py + ay);
    }
  });
  path.closePath();
  return path;
}
function picture(id: StampId) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = CELL;
  const ctx = canvas.getContext('2d')!;
  if (id === 'astral' || id === 'halo') {
    const c = CELL / 2, glow = ctx.createRadialGradient(c, c, 0, c, c, c);
    if (id === 'halo') {
      // A ring of cold light, empty in the middle.
      glow.addColorStop(0, 'rgba(191,224,255,0)'); glow.addColorStop(.62, 'rgba(191,224,255,0)'); glow.addColorStop(.8, 'rgba(244,249,255,.95)'); glow.addColorStop(.9, 'rgba(127,180,255,.5)'); glow.addColorStop(1, 'rgba(127,180,255,0)');
      ctx.fillStyle = glow; ctx.fillRect(0, 0, CELL, CELL);
      return canvas;
    }
    glow.addColorStop(0, 'rgba(244,249,255,1)'); glow.addColorStop(.12, 'rgba(191,224,255,.85)'); glow.addColorStop(.34, 'rgba(127,180,255,.28)'); glow.addColorStop(1, 'rgba(127,180,255,0)');
    ctx.fillStyle = glow; ctx.fillRect(0, 0, CELL, CELL);
    // Four long thin points and four short ones between them, white at the heart.
    const star = (long: number, thin: number, turn: number) => {
      ctx.beginPath();
      for (let i = 0; i < 8; i++) { const a = turn + i * Math.PI / 4, r = i % 2 ? thin : long; ctx.lineTo(c + Math.cos(a) * r, c + Math.sin(a) * r); }
      ctx.closePath(); ctx.fill();
    };
    ctx.fillStyle = 'rgba(191,224,255,.9)'; star(c * .98, c * .05, 0);
    ctx.fillStyle = 'rgba(244,249,255,.75)'; star(c * .5, c * .05, Math.PI / 4);
    ctx.fillStyle = '#ffffff'; star(c * .7, c * .035, 0);
    ctx.beginPath(); ctx.arc(c, c, c * .09, 0, Math.PI * 2); ctx.fill();
    return canvas;
  }
  const lacquer = id === 'comodin', sheet = scrap(Object.keys(FACE_ICONS).indexOf(id) + 3), icon = new Path2D(FACE_ICONS[id]);
  // Its shadow first, so it sits on them and not in the air.
  ctx.save(); ctx.translate(7, 9); ctx.fillStyle = 'rgba(12,8,10,.5)'; ctx.fill(sheet); ctx.restore();
  ctx.fillStyle = lacquer ? '#1c1917' : '#efe6cf'; ctx.fill(sheet);
  ctx.save(); ctx.clip(sheet);
  // Paper: lighter in the middle, a darker worn rim.
  const worn = ctx.createRadialGradient(CELL / 2, CELL / 2, CELL * .2, CELL / 2, CELL / 2, CELL * .62);
  worn.addColorStop(0, lacquer ? 'rgba(239,230,207,.06)' : 'rgba(255,250,236,.55)'); worn.addColorStop(1, lacquer ? 'rgba(239,230,207,.3)' : 'rgba(150,120,80,.4)');
  ctx.fillStyle = worn; ctx.fillRect(0, 0, CELL, CELL);
  const inset = CELL * .19, k = (CELL - inset * 2) / 100;
  const print = (dx: number, dy: number, colour: string) => { ctx.save(); ctx.translate(inset + dx, inset + dy); ctx.scale(k, k); ctx.fillStyle = colour; ctx.fill(icon); ctx.restore(); };
  if (id === 'blanco' || lacquer) print(0, 0, FACE_INK.red);
  else { print(7, 6, FACE_INK.red); print(0, 0, FACE_INK.ink); }
  if (lacquer) { ctx.save(); ctx.translate(inset, inset); ctx.scale(k, k); ctx.translate(47, 47); ctx.scale(.3, .3); ctx.translate(-50, -50); ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fill(icon); ctx.restore(); }
  ctx.restore();
  // One red rule across a corner, as on the ánima's interface.
  if (!lacquer) { ctx.save(); ctx.clip(sheet); ctx.fillStyle = FACE_INK.red; ctx.fillRect(CELL * .07, CELL * .86, CELL * .86, CELL * .018); ctx.restore(); }
  return canvas;
}

interface Stamp extends Required<Omit<StampOptions, 'from'>> { entity: pc.Entity; instance: pc.MeshInstance; at: pc.Vec3; from: pc.Vec3; size: number; age: number; delay: number }
const LIGHT: ReadonlySet<StampId> = new Set<StampId>(['astral', 'halo']);
type P3 = { x: number; y: number; z: number };
interface Crystal { cube: pc.Entity; flare: pc.Entity; instance: pc.MeshInstance; size: number; age: number; fall: number; path: (u: number) => P3; axis: pc.Vec3; speed: number; roll: number }

export function createStamps(app: pc.AppBase, root: pc.Entity) {
  const device = app.graphicsDevice, materials = new Map<StampId, pc.StandardMaterial>(), live: Stamp[] = [];
  const mesh = new pc.Mesh(device);
  mesh.setPositions([-.5, -.5, 0, .5, -.5, 0, .5, .5, 0, -.5, .5, 0]); mesh.setNormals([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1]);
  mesh.setUvs(0, [0, 0, 1, 0, 1, 1, 0, 1]); mesh.setIndices([0, 1, 2, 0, 2, 3]);
  mesh.update(); mesh.incRefCount();
  function materialOf(id: StampId) {
    let material = materials.get(id);
    if (material) return material;
    const canvas = picture(id);
    const texture = new pc.Texture(device, { name: `Sello ${id}`, width: CELL, height: CELL, mipmaps: true, anisotropy: 4, addressU: pc.ADDRESS_CLAMP_TO_EDGE, addressV: pc.ADDRESS_CLAMP_TO_EDGE });
    texture.setSource(canvas);
    material = new pc.StandardMaterial(); material.name = `Sello ${id}`;
    material.useLighting = false; material.diffuse.set(0, 0, 0);
    material.emissiveMap = texture; material.emissive.set(1, 1, 1); material.emissiveIntensity = LIGHT.has(id) ? 2.6 : 1.15;
    material.opacityMap = texture; material.opacityMapChannel = 'a';
    material.blendType = LIGHT.has(id) ? pc.BLEND_ADDITIVEALPHA : pc.BLEND_NORMAL;
    material.depthWrite = false; material.cull = pc.CULLFACE_NONE;
    // Light is not cut by the floor it lands on.
    if (LIGHT.has(id)) material.depthTest = false;
    material.update();
    materials.set(id, material);
    return material;
  }
  const basis = new pc.Mat4(), facingTurn = new pc.Quat(), rollTurn = new pc.Quat(), place = new pc.Vec3();
  const easeOut = (k: number) => 1 - (1 - k) ** 3;
  const held = new Set<{ drop(): void }>(), crystals: Crystal[] = [], turn = new pc.Quat();
  /** A die that is a star: the cube of glass and, over it, the four-point star it shines with. */
  function starDie() {
    const cube = createStarDie(app), instance = new pc.MeshInstance(mesh, materialOf('astral')), flare = new pc.Entity('Estrella del dado');
    flare.addComponent('render', { meshInstances: [instance], castShadows: false, receiveShadows: false });
    cube.enabled = flare.enabled = false; root.addChild(cube); root.addChild(flare);
    return { cube, flare, instance };
  }
  return {
    /** Stamps `id` at `at`, `size` metres across, `delay` seconds from now. */
    stamp(id: StampId, at: { x: number; y: number; z: number }, size: number, o: StampOptions & { delay?: number } = {}) {
      const instance = new pc.MeshInstance(mesh, materialOf(id)), entity = new pc.Entity(`Sello ${id}`);
      entity.addComponent('render', { meshInstances: [instance], castShadows: false, receiveShadows: false });
      entity.enabled = false; root.addChild(entity);
      live.push({
        entity, instance, at: new pc.Vec3(at.x, at.y, at.z), from: new pc.Vec3(o.from?.x ?? 0, o.from?.y ?? 0, o.from?.z ?? 0), size, age: 0, delay: o.delay ?? 0,
        roll: o.roll ?? 0, spin: o.spin ?? 0, flip: o.flip ?? false, start: o.start ?? 2, slam: o.slam ?? .07, hold: o.hold ?? .34, out: o.out ?? .22, grow: o.grow ?? .12, fall: o.fall ?? .35, opacity: o.opacity ?? 1,
      });
    },
    /** Moves every stamp on by `dt`, facing a camera whose screen axes are `right`, `up` and `facing` (towards it). */
    update(dt: number, right: { x: number; y: number; z: number }, up: { x: number; y: number; z: number }, facing: { x: number; y: number; z: number }) {
      basis.set([right.x, right.y, right.z, 0, up.x, up.y, up.z, 0, facing.x, facing.y, facing.z, 0, 0, 0, 0, 1]);
      facingTurn.setFromMat4(basis);
      for (let i = crystals.length - 1; i >= 0; i--) {
        const c = crystals[i];
        c.age += dt;
        if (c.age >= c.fall) { c.cube.destroy(); c.flare.destroy(); crystals.splice(i, 1); continue; }
        const u = c.age / c.fall, p = c.path(u), size = c.size * Math.min(1, u * 8);
        // It tumbles all the way down; its star turns slowly and flickers.
        c.cube.setPosition(p.x, p.y, p.z); c.cube.setRotation(turn.setFromAxisAngle(c.axis, c.age * c.speed)); c.cube.setLocalScale(size, size, size);
        const shine = size * (3.4 + Math.sin(c.age * 31 + c.roll) * .5);
        rollTurn.setFromEulerAngles(0, 0, -(c.roll + c.age * 90));
        c.flare.setPosition(p.x, p.y, p.z); c.flare.setRotation(rollTurn.mul2(facingTurn, rollTurn)); c.flare.setLocalScale(shine, shine, 1);
        c.instance.setParameter('material_opacity', .8);
        c.cube.enabled = c.flare.enabled = true;
      }
      if (!live.length) return;
      for (let i = live.length - 1; i >= 0; i--) {
        const s = live[i];
        if (s.delay > 0) { s.delay -= dt; continue; }
        s.age += dt;
        const total = s.slam + s.hold + s.out;
        if (s.age >= total) { s.entity.destroy(); live.splice(i, 1); continue; }
        const on = Math.min(1, s.age / s.slam), gone = Math.max(0, (s.age - s.slam - s.hold) / s.out);
        // Slammed on: down from `start` to a touch under its size, then it springs back to it.
        const settle = s.age > s.slam ? 1 - .08 * Math.exp(-(s.age - s.slam) * 34) : s.start + (.92 - s.start) * easeOut(on);
        const scale = s.size * settle * (1 + s.grow * gone);
        place.copy(s.from).mulScalar(1 - easeOut(on)).add(s.at);
        place.y -= s.fall * gone * gone;
        rollTurn.setFromEulerAngles(0, 0, -(s.roll + s.spin * Math.max(0, s.age - s.slam - s.hold)));
        s.entity.setPosition(place); s.entity.setRotation(rollTurn.mul2(facingTurn, rollTurn)); s.entity.setLocalScale(s.flip ? -scale : scale, scale, 1);
        s.instance.setParameter('material_opacity', s.opacity * Math.min(1, on * 2.5) * (1 - gone) ** 1.5);
        s.entity.enabled = true;
      }
    },
    /**
     * A die that is a star on its way: a cube of glass `size` metres to its edge, tumbling, that is
     * at `path(u)` (u from 0 to 1) over `seconds` and then gone (what it does where it arrives is the
     * caller's).
     */
    crystal(size: number, seconds: number, path: (u: number) => P3) {
      const axis = new pc.Vec3(Math.random() - .5, Math.random() - .5, Math.random() - .5).normalize();
      crystals.push({ ...starDie(), size, age: 0, fall: seconds, path, axis, speed: 420 + Math.random() * 360, roll: Math.random() * 360 });
    },
    /**
     * A die that is a star and stays (the one over whoever has thrown a meteor): `set` puts it where
     * it is now, `size` metres to its edge and turned `roll` degrees; `drop` takes it away.
     */
    keepCrystal() {
      const { cube, flare, instance } = starDie();
      const kept = {
        set(at: P3, size: number, roll = 0, opacity = 1) {
          cube.setPosition(at.x, at.y, at.z); cube.setLocalEulerAngles(roll * .6, roll, roll * .35); cube.setLocalScale(size, size, size);
          const shine = size * (3 + Math.sin(roll * .21) * .3);
          rollTurn.setFromEulerAngles(0, 0, -roll * .5);
          flare.setPosition(at.x, at.y, at.z); flare.setRotation(rollTurn.mul2(facingTurn, rollTurn)); flare.setLocalScale(shine, shine, 1);
          instance.setParameter('material_opacity', opacity);
          cube.enabled = flare.enabled = size > .001;
        },
        drop() { held.delete(kept); cube.destroy(); flare.destroy(); },
      };
      held.add(kept);
      return kept;
    },
    clear() { for (const s of live) s.entity.destroy(); live.length = 0; for (const c of crystals) { c.cube.destroy(); c.flare.destroy(); } crystals.length = 0; for (const k of [...held]) k.drop(); },
  };
}
export type Stamps = ReturnType<typeof createStamps>;
