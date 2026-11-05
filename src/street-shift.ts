import * as pc from 'playcanvas';
import type { GeoBuilding, GeoPoint, GeoScene } from './geo';
import type { Cell } from './movement';

/**
 * Nuria's street turning into La calle que no acaba (docs/quests/nuria.md § La calle que no acaba),
 * with no cut: walking up from her door, houses rise out of the ground and shut every way but on, then
 * the corner unrolls into the street's own start, laid over her street, its houses rising one after
 * another away from them; well inside it, the party is in La calle itself at the same spot. The rules
 * (which cells close, what is laid where) are pure and tested in tests/street-shift.test.mjs; the
 * rising, sinking and stretching is drawn here. Its data is `SHIFT` in src/friends/nuria.ts.
 */

/** Cells x … x + w − 1 by z … z + d − 1. */
export interface Rect { x: number; z: number; w: number; d: number }
/** A house that rises to shut a way: once Gerard is north of row `at`, `levels` storeys, her house's look or the row's. */
export interface Closer extends Rect { id: string; levels: number; look: 'nuria' | 'fila'; at: number }
export interface Shift {
  /** La calle's cell (x, z) lies on her street's (x + dx, z + dz). */
  calle: { dx: number; dz: number };
  /** What La calle covers on her street once it unrolls. */
  over: Rect;
  unroll: number;
  swap: number;
  door: number;
  closers: readonly Closer[];
}

/** Whether a point (cells, continuous) stands on a rect's cells. */
export const inRect = (at: { x: number; z: number }, r: Rect) => at.x >= r.x - .5 && at.x < r.x + r.w - .5 && at.z >= r.z - .5 && at.z < r.z + r.d - .5;
/** Where a point of her street lies in La calle. */
export const toCalle = (at: { x: number; z: number }, shift: Shift) => ({ x: at.x - shift.calle.dx, z: at.z - shift.calle.dz });

/** Her street's grid with the closers in `risen` walled and, once it has unrolled, La calle laid over `over`. */
export function shiftedGrid(grid: readonly string[], calle: readonly string[], shift: Shift, risen: ReadonlySet<string>, unrolled: boolean): string[] {
  const rows = grid.map(row => [...row]);
  const wall = (x: number, z: number, c: string) => { if (rows[z]?.[x] !== undefined) rows[z][x] = c; };
  for (const c of shift.closers) if (risen.has(c.id)) for (let z = c.z; z < c.z + c.d; z++) for (let x = c.x; x < c.x + c.w; x++) wall(x, z, '#');
  if (unrolled) {
    const { over, calle: { dx, dz } } = shift;
    for (let z = over.z; z < over.z + over.d; z++) for (let x = over.x; x < over.x + over.w; x++) wall(x, z, calle[z - dz]?.[x - dx] ?? '#');
  }
  return rows.map(row => row.join(''));
}

/** The open cells reachable from `from` (4-connected), as `x,z` keys. */
export function reachable(grid: readonly string[], from: Cell): Set<string> {
  const seen = new Set<string>(), queue: Cell[] = [];
  const visit = (x: number, z: number) => {
    const key = `${x},${z}`;
    if (seen.has(key) || grid[z]?.[x] === undefined || grid[z][x] === '#') return;
    seen.add(key); queue.push({ x, z });
  };
  // Hugging a wall, the rounded cell may be the wall: start from the open cells round it instead.
  const x0 = Math.round(from.x), z0 = Math.round(from.z);
  visit(x0, z0);
  if (!queue.length) for (const [ox, oz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) visit(x0 + ox, z0 + oz);
  for (let i = 0; i < queue.length; i++) { const { x, z } = queue[i]; visit(x + 1, z); visit(x - 1, z); visit(x, z + 1); visit(x, z - 1); }
  return seen;
}

/** Whether walls rising on `next` would shut any of the party out of Gerard's side, or in under them. */
export function cutsOff(next: readonly string[], gerard: { x: number; z: number }, party: readonly { x: number; z: number }[]) {
  const side = reachable(next, gerard);
  const near = (p: { x: number; z: number }) => [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].some(([ox, oz]) => side.has(`${Math.round(p.x) + ox},${Math.round(p.z) + oz}`));
  return party.some(p => !near(p));
}

/** A closer as one of La calle's houses (`look`), in La calle's cells: it is built with the piece laid over her street. */
export function closerHouse(c: Closer, look: GeoBuilding, shift: Shift, storey: number): GeoBuilding {
  const x0 = c.x - shift.calle.dx - .5, z0 = c.z - shift.calle.dz - .5, x1 = x0 + c.w, z1 = z0 + c.d;
  return {
    ...look, id: `shift/${c.id}`, levels: c.levels, height: c.levels * storey,
    poly: [[x0, z0], [x1, z0], [x1, z1], [x0, z1]], box: { cx: (x0 + x1) / 2, cz: (z0 + z1) / 2, w: c.w, d: c.d, angle: 0 },
  };
}

/** A polyline's part between rows z0 and z1. */
function clipRows(line: readonly GeoPoint[], z0: number, z1: number): GeoPoint[] {
  const out: GeoPoint[] = [];
  const push = (p: GeoPoint) => { const last = out[out.length - 1]; if (!last || last[0] !== p[0] || last[1] !== p[1]) out.push(p); };
  for (let i = 0; i + 1 < line.length; i++) {
    const [a, b] = [line[i], line[i + 1]], dz = b[1] - a[1];
    let t0 = 0, t1 = 1;
    if (Math.abs(dz) < 1e-9) { if (a[1] < z0 || a[1] > z1) continue; }
    else {
      const ta = (z0 - a[1]) / dz, tb = (z1 - a[1]) / dz;
      t0 = Math.max(t0, Math.min(ta, tb)); t1 = Math.min(t1, Math.max(ta, tb));
      if (t0 > t1) continue;
    }
    const at = (t: number): GeoPoint => [a[0] + (b[0] - a[0]) * t, a[1] + dz * t];
    push(at(t0)); push(at(t1));
  }
  return out;
}

/**
 * The piece of La calle laid over her street: what stands within `over` (in La calle's cells), its
 * ground just there, and nothing that belongs to the whole place (its name, its doors, its anchors).
 */
export function calleCrop(scene: GeoScene, shift: Shift): GeoScene {
  const { over, calle: { dx, dz } } = shift;
  const x0 = over.x - dx - .5, x1 = x0 + over.w, z0 = over.z - dz - .5, z1 = z0 + over.d;
  const within = (p: GeoPoint) => p[0] >= x0 - .01 && p[0] <= x1 + .01 && p[1] >= z0 - .01 && p[1] <= z1 + .01;
  const areas = Object.fromEntries(Object.entries(scene.areas).map(([kind, polys]) => [kind, (polys ?? []).filter(poly => poly.every(within))])) as GeoScene['areas'];
  return {
    ...scene,
    buildings: scene.buildings.filter(b => b.poly.every(within)),
    props: scene.props.filter(p => within([p.x, p.z])),
    roads: scene.roads.map(r => ({ ...r, line: clipRows(r.line, z0, z1) })).filter(r => r.line.length > 1),
    areas, places: [], labels: [], shops: [], crossings: [], landmarks: [], anchors: {},
    extent: [[x0, z0], [x1, z0], [x1, z1], [x0, z1]],
  };
}

/** Her street's buildings standing (even partly) on `over`: they sink as La calle unrolls over them. */
export function sunkBy(street: GeoScene, over: Rect) {
  const x0 = over.x - .5, x1 = x0 + over.w, z0 = over.z - .5, z1 = z0 + over.d;
  return street.buildings.filter(b => b.poly.some(p => p[0] > x0 && p[0] < x1 && p[1] > z0 && p[1] < z1)
    || (b.box.cx > x0 && b.box.cx < x1 && b.box.cz > z0 && b.box.cz < z1)).map(b => b.id);
}

/** What the game lends the shift: its scenery, a puff of dust and a sound from a spot in the street. */
export interface ShiftKit {
  scenery: {
    building(id: string): pc.Entity | undefined;
    propsWhere(test: (cell: { x: number; z: number }) => boolean): { holder: pc.Entity }[];
    overlay(scene: GeoScene, dx: number, dz: number, pivot: { x: number; z: number }): { root: pc.Entity; building(id: string): pc.Entity | undefined; props: { prop: { x: number; z: number }; holder: pc.Entity }[] };
    toWorld(x: number, z: number): pc.Vec3;
  };
  dust(at: pc.Vec3, count: number, spread: number): void;
  sound(id: 'rise' | 'sink' | 'stretch', at: pc.Vec3, volume: number): void;
}

/** One piece moving: rising out of the ground, sinking into it, or (the street's start) stretching out. */
interface Motion { e: pc.Entity; kind: 'rise' | 'sink'; start: number; seconds: number; height: number; base: pc.Vec3; foot: GeoPoint[]; shake: number; puffed: number; done: boolean; volume: number; heard: boolean }

const ease = (k: number) => k * k * (3 - 2 * k);
/** Out of the ground fast, a little past its height and back: born, not built. */
const risen = (k: number) => Math.min(1.04, 1 - (1 - k) ** 3 + Math.sin(k * Math.PI) * .05 * k);

/**
 * The shift on Nuria's street, built hidden over the scene. `update` moves it on with where Gerard and
 * the party are, and says when the walls changed (`grid`), when the corner has unrolled (`lines`) and
 * when the party is far enough in to be in La calle itself (`swap`, its cell there).
 */
export function createStreetShift(kit: ShiftKit, shift: Shift, street: GeoScene, calle: GeoScene, door: Cell) {
  const { dx, dz } = shift.calle, storey = calle.storey;
  const look = (which: Closer['look']) => calle.buildings.find(b => b.style.startsWith(which === 'nuria' ? 'nuria' : 'fila'))!;
  // The closers, with no ground of their own, and the street's start, its ground stretched from the crossing.
  const housesScene: GeoScene = { ...calleCrop(calle, shift), buildings: shift.closers.map(c => closerHouse(c, look(c.look), shift, storey)), props: [], roads: [], extent: [] };
  const houses = kit.scenery.overlay(housesScene, dx, dz, { x: 0, z: 0 });
  const pivot = { x: shift.over.x + shift.over.w / 2 - .5, z: shift.over.z + shift.over.d - .5 };
  const crop = calleCrop(calle, shift);
  const start = kit.scenery.overlay(crop, dx, dz, pivot);
  start.root.enabled = false; start.root.setLocalScale(1, 1, .001);
  const closers = shift.closers.map(c => ({ c, e: houses.building(`shift/${c.id}`)!, state: 'down' as 'down' | 'rising' | 'up' }));
  for (const { e } of closers) { e.enabled = false; e.setLocalScale(1, .001, 1); }
  const calleHouses = crop.buildings.map(b => ({ b, e: start.building(b.id)! })).filter(h => h.e);
  for (const { e } of calleHouses) { e.enabled = false; e.setLocalScale(1, .001, 1); }
  for (const { holder } of start.props) { holder.enabled = false; holder.setLocalScale(1, .001, 1); }

  const motions: Motion[] = [];
  const quake = new pc.Vec3();
  const risenIds = new Set<string>();
  let clock = 0, armed = false, unrolledAt = -1, said = false;
  const footOf = (poly: readonly GeoPoint[], sx: number, sz: number): GeoPoint[] => poly.map(p => [p[0] + sx, p[1] + sz]);
  /** `volume`: how loud it rises or sinks, from where it stands, as it starts (a prop makes no sound). */
  function move(e: pc.Entity, kind: Motion['kind'], at: number, seconds: number, height: number, foot: GeoPoint[], shake: number, volume = 0) {
    motions.push({ e, kind, start: at, seconds, height, base: e.getLocalPosition().clone(), foot, shake, puffed: -1, done: false, volume, heard: false });
  }
  /** The middle of a footprint (her street's cells), in the world. */
  const middleOf = (foot: GeoPoint[]) => kit.scenery.toWorld(foot.reduce((sum, p) => sum + p[0], 0) / foot.length, foot.reduce((sum, p) => sum + p[1], 0) / foot.length);
  /** A puff of dust at a random point round a footprint (her street's cells). */
  function puff(foot: GeoPoint[], count: number) {
    const i = Math.floor(Math.random() * foot.length), a = foot[i], b = foot[(i + 1) % foot.length], t = Math.random();
    const p = kit.scenery.toWorld(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t);
    kit.dust(new pc.Vec3(p.x, .15, p.z), count, .6);
  }

  return {
    /** The camera's shudder while the ground gives (added after it looks, like a blow's). */
    quake,
    /** Whether her street has unrolled into La calle's start (its progress counts from then). */
    get unrolled() { return unrolledAt >= 0; },
    /** Her street's grid as it stands now. */
    grid(base: readonly string[]) { return shiftedGrid(base, calle.grid, shift, risenIds, unrolledAt >= 0); },
    update(dt: number, gerard: { x: number; z: number }, party: readonly { x: number; z: number }[], base: readonly string[], animate: boolean) {
      clock += dt;
      const events: { grid?: true; lines?: true; swap?: Cell } = {};
      if (!armed && Math.hypot(gerard.x - door.x, gerard.z - door.z) <= shift.door) armed = true;
      if (armed) for (const h of closers) {
        if (h.state !== 'down' || gerard.z >= h.c.at) continue;
        const next = shiftedGrid(base, calle.grid, shift, new Set([...risenIds, h.c.id]), unrolledAt >= 0);
        if (cutsOff(next, gerard, party)) continue;
        risenIds.add(h.c.id); h.state = 'rising'; events.grid = true;
        const foot: GeoPoint[] = [[h.c.x - .5, h.c.z - .5], [h.c.x + h.c.w - .5, h.c.z - .5], [h.c.x + h.c.w - .5, h.c.z + h.c.d - .5], [h.c.x - .5, h.c.z + h.c.d - .5]];
        move(h.e, 'rise', clock + closers.filter(o => o.state === 'rising').length * .3, 1.7, h.c.levels * storey, foot, .16, 1);
      }
      // Their walls stand from the moment they start to rise, so the corner can unroll while they come up.
      if (unrolledAt < 0 && closers.every(h => h.state !== 'down') && gerard.z < shift.unroll) {
        const next = shiftedGrid(base, calle.grid, shift, risenIds, true);
        if (!cutsOff(next, gerard, party)) {
          unrolledAt = clock; events.grid = true;
          kit.sound('stretch', kit.scenery.toWorld(pivot.x, pivot.z - shift.over.d / 2), 1);
          // What stands there sinks, while the street's start stretches out from the crossing over it…
          for (const id of sunkBy(street, shift.over)) {
            const e = kit.scenery.building(id), b = street.buildings.find(o => o.id === id)!;
            if (e) move(e, 'sink', clock + Math.random() * .5, 1.3, b.height, footOf(b.poly, 0, 0), .1, .8);
          }
          for (const { holder } of kit.scenery.propsWhere(c => inRect(c, shift.over))) move(holder, 'sink', clock + Math.random() * .4, .9, 6, [], 0);
          // …and its houses are born one after another, away from them.
          for (const { b, e } of calleHouses) {
            const away = (pivot.z - (b.box.cz + dz)) / shift.over.d;
            move(e, 'rise', clock + 1.1 + away * 2.4, 1.3, b.height, footOf(b.poly, dx, dz), .05, .6);
          }
          for (const { prop, holder } of start.props) move(holder, 'rise', clock + 1.3 + (pivot.z - (prop.z + dz)) / shift.over.d * 2.4, .6, 1, [], 0);
        }
      }
      if (unrolledAt >= 0) {
        const k = Math.min(1, (clock - unrolledAt) / 1.6);
        start.root.enabled = true; start.root.setLocalScale(1, 1, Math.max(.001, ease(k)));
        if (!said && clock - unrolledAt > 2.2) { said = true; events.lines = true; }
      }
      quake.set(0, 0, 0);
      let shaking = 0;
      for (const m of motions) {
        if (m.done || clock < m.start) continue;
        if (!m.heard) { m.heard = true; if (m.volume && m.foot.length) kit.sound(m.kind, middleOf(m.foot), m.volume); }
        const k = Math.min(1, (clock - m.start) / m.seconds);
        m.e.enabled = true;
        if (m.kind === 'rise') m.e.setLocalScale(1, Math.max(.001, risen(k)), 1);
        else m.e.setLocalPosition(m.base.x, m.base.y - (m.height + .5) * k * k, m.base.z);
        const jolt = (1 - k) * (m.kind === 'rise' ? .05 : .04);
        if (animate && k < 1) m.e.setLocalPosition(m.base.x + (Math.random() - .5) * jolt, m.kind === 'rise' ? m.base.y : m.e.getLocalPosition().y, m.base.z + (Math.random() - .5) * jolt);
        if (m.foot.length && k < .85 && clock - m.puffed > .12) { m.puffed = clock; puff(m.foot, m.shake > .1 ? 5 : 3); }
        shaking = Math.max(shaking, m.shake * Math.sin(Math.min(1, k * 1.4) * Math.PI));
        if (k >= 1) {
          m.done = true;
          if (m.kind === 'sink') m.e.enabled = false;
          else { m.e.setLocalScale(1, 1, 1); m.e.setLocalPosition(m.base); }
        }
      }
      for (const h of closers) if (h.state === 'rising' && motions.some(m => m.e === h.e && m.done)) h.state = 'up';
      if (animate && shaking > 0) quake.set(Math.sin(clock * 61) * shaking, Math.sin(clock * 47) * shaking * .4, Math.cos(clock * 53) * shaking);
      const settled = unrolledAt >= 0 && motions.every(m => m.done) && clock - unrolledAt > 1.6;
      if (settled && gerard.z <= shift.swap) events.swap = { x: gerard.x - dx, z: gerard.z - dz };
      return events;
    },
  };
}
