import * as pc from 'playcanvas';
import type { GeoPoint, GeoRoad, GeoScene } from './geo';
import type { Cell } from './movement';
import type { PropKit, SignalLight } from './props';

/**
 * Cars and buses driving a real street's lanes (src/geo.ts roads): they keep to the right, follow
 * whoever is ahead, wait at red lights and stop for anyone standing in front of them. Junctions
 * and the zebras beside a traffic light take turns: the main road, then the cross street and the
 * people on foot. All distances are grid cells, speeds cells per second.
 */
const CRUISE = [5, 7.5];
const ACCEL = 3.2;
const BRAKE = 9;
/** How far ahead a driver looks for lights, cars and people. */
const LOOK_AHEAD = 16;
const MAX_VEHICLES = 48;
/** Seconds of each light's cycle: the main road's green, the cross street's, amber and all-red. */
const MAIN_GREEN = 16, CROSS_GREEN = 10, AMBER = 3, CLEAR = 3;
const CYCLE = MAIN_GREEN + CROSS_GREEN + 2 * (AMBER + CLEAR);
/** Streets with through traffic; service roads, alleys and living streets stay quiet. */
const DRIVEN = new Set(['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'residential', 'unclassified']);
/** Scooters weave through Barcelona's traffic: about one vehicle in six. */
const MOTO_COLOURS = ['#f1f0eb', '#1f2326', '#b3312c', '#a7adb1', '#2f4f7a'];
const CAR_COLOURS = ['#f2f1ec', '#20252b', '#9aa0a4', '#b63a32', '#c9ccce', '#2c4a6e', '#5b6066', '#e8e4d8', '#7a2e2a', '#2f5a48', '#d8b04a'];
/** Barcelona's taxis (black and yellow) show as yellow cars, about one in seven. */
const TAXI = '#f2c230';

/** A junction: where it is, how far it reaches, its place in the green wave and its main road's direction. */
interface Cluster { x: number; z: number; radius: number; offset: number; ref?: GeoPoint }
/** A stop line: `box` is how far past it a car must get to be out of the junction. */
interface Stop { s: number; cluster: Cluster; group: number; heading: GeoPoint; box: number }
interface Edge {
  road: GeoRoad; pts: GeoPoint[]; cum: number[]; length: number;
  /** Lane centres, right of the line, ordered left to right (bus lanes left out). */
  lanes: number[]; start: string; end: string; stops: Stop[];
}
interface Vehicle {
  entity: pc.Entity; bus: boolean; length: number; width: number; cruise: number;
  edge: Edge; next?: Edge; s: number; lane: number; offset: number; v: number;
  x: number; z: number; hx: number; hz: number; yaw: number;
  /** Drawn minus true position after a jump between streets, fading out. */
  slip: GeoPoint;
  /** The car right in front, and seconds spent nose to nose with a car that is also waiting for it; past a few, it squeezes by. */
  blocker?: Vehicle; held: number; squeeze: number;
  /** The junction it has entered: it drives through without stopping at that junction's other lines. */
  inside?: Cluster;
}
interface Obstacle { x: number; z: number; hx: number; hz: number; length: number; width: number; vehicle?: Vehicle }

const key = (p: GeoPoint) => `${Math.round(p[0] * 2)},${Math.round(p[1] * 2)}`;
function phase(c: Cluster, group: number, t: number): SignalLight {
  const k = (((t + c.offset) % CYCLE) + CYCLE) % CYCLE;
  const start = group === 0 ? 0 : MAIN_GREEN + AMBER + CLEAR, green = group === 0 ? MAIN_GREEN : CROSS_GREEN, d = k - start;
  return d >= 0 && d < green ? 'green' : d >= green && d < green + AMBER ? 'amber' : 'red';
}
function intersect(a: GeoPoint, b: GeoPoint, c: GeoPoint, d: GeoPoint): [number, number] | undefined {
  const rx = b[0] - a[0], rz = b[1] - a[1], sx = d[0] - c[0], sz = d[1] - c[1], den = rx * sz - rz * sx;
  if (Math.abs(den) < 1e-9) return;
  const t = ((c[0] - a[0]) * sz - (c[1] - a[1]) * sx) / den, u = ((c[0] - a[0]) * rz - (c[1] - a[1]) * rx) / den;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? [t, u] : undefined;
}

export function createTraffic(root: pc.Entity, kit: PropKit, scene: GeoScene, x: (v: number) => number, z: (v: number) => number) {
  // A seeded random keeps the first frame the same on every load (and in screenshots).
  let seed = 7;
  const random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

  // ------------------------------------------------------------ lanes
  const edges: Edge[] = [];
  function edge(road: GeoRoad, pts: GeoPoint[], lanes: number[]): Edge {
    const cum = [0];
    for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    const e = { road, pts, cum, length: cum[cum.length - 1], lanes, start: key(pts[0]), end: key(pts[pts.length - 1]), stops: [] };
    if (e.length > 0.5) edges.push(e);
    return e;
  }
  for (const road of scene.roads) {
    if ((road.kind !== 'road' && road.kind !== 'motorway') || !DRIVEN.has(road.highway ?? '') || road.line.length < 2) continue;
    const count = Math.max(1, road.lanes ?? 1), half = road.width / 2;
    if (road.oneway) {
      const lane = road.width / count;
      const lanes = Array.from({ length: count }, (_, k) => k).filter(k => k !== road.bus).map(k => -half + (k + 0.5) * lane);
      if (lanes.length) edge(road, road.line, lanes);
    } else {
      // Two ways: each keeps to its own right half.
      const per = Math.max(1, Math.floor(count / 2)), lane = half / per;
      const lanes = Array.from({ length: per }, (_, k) => (k + 0.5) * lane);
      edge(road, road.line, lanes); edge(road, [...road.line].reverse(), lanes);
    }
  }
  const leaving = new Map<string, Edge[]>();
  for (const e of edges) leaving.set(e.start, [...(leaving.get(e.start) ?? []), e]);
  /** Point and direction `s` along an edge (clamped to it). */
  function at(e: Edge, s: number): [number, number, number, number] {
    s = Math.min(Math.max(s, 0), e.length);
    let i = 1;
    while (i < e.cum.length - 1 && e.cum[i] < s) i++;
    const a = e.pts[i - 1], b = e.pts[i], len = e.cum[i] - e.cum[i - 1] || 1, t = (s - e.cum[i - 1]) / len;
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, (b[0] - a[0]) / len, (b[1] - a[1]) / len];
  }
  /** Where along `e` a point falls, and how far it lies from the line. */
  function project(e: Edge, p: GeoPoint) {
    let best = { s: 0, d: Infinity };
    for (let i = 1; i < e.pts.length; i++) {
      const a = e.pts[i - 1], b = e.pts[i], len = e.cum[i] - e.cum[i - 1];
      if (len < 1e-6) continue;
      const t = Math.min(1, Math.max(0, ((p[0] - a[0]) * (b[0] - a[0]) + (p[1] - a[1]) * (b[1] - a[1])) / (len * len)));
      const d = Math.hypot(a[0] + (b[0] - a[0]) * t - p[0], a[1] + (b[1] - a[1]) * t - p[1]);
      if (d < best.d) best = { s: e.cum[i - 1] + t * len, d };
    }
    return best;
  }

  // ------------------------------------------------------------ junctions and lights
  // Where two streets cross, and the zebras that have a traffic light beside them.
  const lights = scene.props.filter(p => p.kind === 'traffic-light');
  type Feature = { x: number; z: number; on: { e: Edge; s: number }[] };
  const features: Feature[] = [];
  for (let i = 0; i < edges.length; i++) for (let j = i + 1; j < edges.length; j++) {
    const a = edges[i], b = edges[j];
    // Streets that only meet end to end (one turning into the other) never cross.
    if (a.road === b.road || [a.start, a.end].some(k => k === b.start || k === b.end)) continue;
    for (let p = 1; p < a.pts.length; p++) for (let q = 1; q < b.pts.length; q++) {
      const hit = intersect(a.pts[p - 1], a.pts[p], b.pts[q - 1], b.pts[q]);
      if (!hit) continue;
      const sa = a.cum[p - 1] + hit[0] * (a.cum[p] - a.cum[p - 1]), sb = b.cum[q - 1] + hit[1] * (b.cum[q] - b.cum[q - 1]);
      const [px, pz] = at(a, sa);
      // Stop short of the other street's kerb.
      features.push({ x: px, z: pz, on: [{ e: a, s: sa - b.road.width / 2 - 1 }, { e: b, s: sb - a.road.width / 2 - 1 }] });
    }
  }
  for (const c of scene.crossings ?? []) {
    if (!lights.some(l => Math.hypot(l.x - c.x, l.z - c.z) < 8)) continue;
    const on: Feature['on'] = [];
    for (const e of edges) {
      const p = project(e, [c.x, c.z]);
      if (p.d > e.road.width / 2 + 0.6) continue;
      const [, , ux, uz] = at(e, p.s);
      if (Math.abs(ux * Math.cos(c.angle) + uz * Math.sin(c.angle)) > 0.8) on.push({ e, s: p.s - 1.1 - 0.8 });
    }
    if (on.length) features.push({ x: c.x, z: c.z, on });
  }
  // Features close together are one junction, with one light cycle.
  const owner = features.map((_, i) => i);
  const find = (i: number): number => owner[i] === i ? i : (owner[i] = find(owner[i]));
  for (let i = 0; i < features.length; i++) for (let j = i + 1; j < features.length; j++) {
    if (Math.hypot(features[i].x - features[j].x, features[i].z - features[j].z) < 11) owner[find(i)] = find(j);
  }
  const clusters = new Map<number, Cluster>();
  for (let i = 0; i < features.length; i++) {
    const root = find(i), f = features[i];
    let c = clusters.get(root);
    // Neighbouring junctions turn green one after another, at about a car's pace.
    if (!c) { c = { x: 0, z: 0, radius: 0, offset: -f.x / 6 }; clusters.set(root, c); }
    for (const { e, s } of f.on) {
      // One stop per street and junction: before whatever it meets first.
      const old = e.stops.find(st => st.cluster === c);
      if (old) { old.s = Math.min(old.s, Math.max(0.3, s)); continue; }
      e.stops.push({ s: Math.max(0.3, s), cluster: c, group: 0, heading: [0, 0], box: 0 });
    }
  }
  for (const [root, c] of clusters) {
    const own = features.filter((_, i) => find(i) === root);
    c.x = own.reduce((sum, f) => sum + f.x, 0) / own.length; c.z = own.reduce((sum, f) => sum + f.z, 0) / own.length;
    c.radius = Math.max(...own.map(f => Math.hypot(f.x - c.x, f.z - c.z))) + 4;
  }
  // The longest street through a junction is its main road; the ones across it wait for it.
  for (const c of clusters.values()) {
    const stops = edges.flatMap(e => e.stops.filter(s => s.cluster === c).map(s => ({ e, s })));
    for (const { e, s } of stops) {
      // Straight on from the line to the edge of the junction's circle.
      const [px, pz, ux, uz] = at(e, s.s), dx = px - c.x, dz = pz - c.z, b = dx * ux + dz * uz;
      s.heading = [ux, uz];
      s.box = -b + Math.sqrt(Math.max(0, b * b - (dx * dx + dz * dz - c.radius * c.radius)));
    }
    const main = stops.reduce((a, b) => b.e.length > a.e.length ? b : a, stops[0]);
    c.ref = main?.s.heading;
    for (const { s } of stops) s.group = c.ref && Math.abs(s.heading[0] * c.ref[0] + s.heading[1] * c.ref[1]) > 0.8 ? 0 : 1;
  }
  for (const e of edges) e.stops.sort((a, b) => a.s - b.s);
  // Each traffic light shows the turn of the street it stands beside.
  const cx = -x(0), cz = -z(0);
  const signals = kit.signals.map(signal => {
    const p = signal.holder.getLocalPosition(), gx = p.x + cx, gz = p.z + cz;
    let best: { c: Cluster; group: number; d: number } | undefined;
    for (const e of edges) for (const s of e.stops) {
      if (Math.hypot(s.cluster.x - gx, s.cluster.z - gz) > 16) continue;
      const d = project(e, [gx, gz]).d;
      if (!best || d < best.d) best = { c: s.cluster, group: s.group, d };
    }
    return { signal, best, shown: '' };
  });

  // ------------------------------------------------------------ vehicles
  const vehicles: Vehicle[] = [];
  const W = scene.width, D = scene.depth;
  const onBorder = (p: GeoPoint) => p[0] < 2 || p[0] > W - 3 || p[1] < 2 || p[1] > D - 3;
  const entries = edges.filter(e => onBorder(e.pts[0])).flatMap(e => e.lanes.map((_, lane) => ({ e, lane, wait: random() * 6 })));
  // Buses parked in the scene (at a stop) are in the way too.
  const parked: Obstacle[] = scene.props.filter(p => p.kind === 'bus').map(p => ({ x: p.x + 2, z: p.z, hx: 1, hz: 0, length: 4.9, width: 1.02 }));
  function choose(e: Edge): Edge | undefined {
    const options = (leaving.get(e.end) ?? []).filter(n => !(n.road === e.road && n.end === e.start));
    return options.length ? options[Math.floor(random() * options.length)] : undefined;
  }
  const laneOffset = (e: Edge, lane: number) => e.lanes[Math.max(0, e.lanes.length - 1 - lane)];
  function place(v: Vehicle) {
    const [px, pz] = at(v.edge, v.s);
    const [ax, az] = at(v.edge, v.s - 1), [bx, bz] = at(v.edge, v.s + 1);
    const len = Math.hypot(bx - ax, bz - az) || 1;
    v.hx = (bx - ax) / len; v.hz = (bz - az) / len;
    // Right of the way is (-hz, hx).
    v.x = px - v.hz * v.offset; v.z = pz + v.hx * v.offset;
  }
  function spawn(e: Edge, lane: number) {
    const bus = lane === 0 && e.road.highway !== 'residential' && random() < 0.12;
    const moto = !bus && random() < 0.16;
    const colour = bus ? '#c8232c' : moto ? MOTO_COLOURS[Math.floor(random() * MOTO_COLOURS.length)] : random() < 0.14 ? TAXI : CAR_COLOURS[Math.floor(random() * CAR_COLOURS.length)];
    const entity = new pc.Entity(bus ? 'Bus en marcha' : moto ? 'Moto en marcha' : 'Coche en marcha');
    root.addChild(entity);
    // The models' fronts face -z, centred on the entity.
    if (bus) kit.place({ kind: 'bus', x: 0, z: 0, color: colour, livery: 'tmb' }, entity, new pc.Vec3(0, 0, 2)).setLocalEulerAngles(0, 90, 0);
    else if (moto) kit.place({ kind: 'moto', x: 0, z: 0, color: colour, rider: true }, entity, new pc.Vec3(0, 0, 0));
    else kit.place({ kind: 'car', x: 0, z: 0, color: colour }, entity, new pc.Vec3(0, 0, -0.5));
    const v: Vehicle = {
      entity, bus, length: bus ? 4.9 : moto ? 1.1 : 1.85, width: bus ? 1.02 : moto ? 0.5 : 0.84, cruise: (bus ? 0.75 : 1) * (CRUISE[0] + random() * (CRUISE[1] - CRUISE[0])),
      edge: e, s: 0, lane, offset: laneOffset(e, lane), v: 0, x: 0, z: 0, hx: 1, hz: 0, yaw: 0, slip: [0, 0], held: 0, squeeze: 0,
    };
    v.next = choose(e); v.v = v.cruise * 0.8;
    place(v); v.yaw = Math.atan2(-v.hx, -v.hz) * pc.math.RAD_TO_DEG;
    vehicles.push(v); return v;
  }
  /**
   * How far `v` can go before touching `o`, if `o` is in its way. While `v` moves `shift` across
   * to another lane, whatever is in that lane counts too, even level with it.
   */
  function gapTo(v: Vehicle, o: Obstacle, shift = 0) {
    const dx = o.x - v.x, dz = o.z - v.z, along = dx * v.hx + dz * v.hz, side = -dx * v.hz + dz * v.hx;
    if (along <= (shift ? -v.length : 0) || along > LOOK_AHEAD) return Infinity;
    const lat = Math.min(Math.abs(side), Math.abs(side - shift));
    const dot = Math.abs(o.hx * v.hx + o.hz * v.hz), cross = Math.abs(o.hx * v.hz - o.hz * v.hx);
    if (lat > v.width / 2 + cross * o.length / 2 + dot * o.width / 2 + 0.12) return Infinity;
    return along - v.length / 2 - (dot * o.length / 2 + cross * o.width / 2);
  }
  let time = 0;
  function step(dt: number, walkers: Cell[]) {
    time += dt;
    for (const entry of entries) {
      entry.wait -= dt;
      if (entry.wait > 0 || vehicles.length >= MAX_VEHICLES) continue;
      const [sx, sz] = at(entry.e, 0);
      if (vehicles.some(v => Math.hypot(v.x - sx, v.z - sz) < 7)) { entry.wait = 0.5; continue; }
      spawn(entry.e, entry.lane);
      // Each lane of the avenue gets a car every few seconds; side streets less often.
      entry.wait = (entry.e.lanes.length > 1 ? 4 : 3) + random() * (entry.e.road.highway === 'residential' ? 14 : 9);
    }
    const people: Obstacle[] = walkers.map(w => ({ x: w.x, z: w.z, hx: 1, hz: 0, length: 0.6, width: 0.6 }));
    const others: Obstacle[] = [...parked, ...vehicles.map(v => ({ x: v.x, z: v.z, hx: v.hx, hz: v.hz, length: v.length, width: v.width, vehicle: v }))];
    for (const v of vehicles) {
      // A lane that ends ahead: move over before the street narrows.
      if (v.next && v.lane >= v.next.lanes.length && v.edge.length - v.s < 18) v.lane = v.next.lanes.length - 1;
      const shift = laneOffset(v.edge, v.lane) - v.offset;
      let gap = Infinity, beside = false, leader = 0;
      v.blocker = undefined;
      for (const o of others) {
        if (o.vehicle === v) continue;
        const across = !!o.vehicle && Math.abs(o.hx * v.hx + o.hz * v.hz) < 0.5;
        if (across && v.squeeze > 0) continue;
        const g = gapTo(v, o, Math.abs(shift) > 0.05 ? shift : 0);
        if (g < gap) { gap = g; leader = o.vehicle?.v ?? 0; v.blocker = o.vehicle; }
        if (g < 0.5 && (o.x - v.x) * v.hx + (o.z - v.z) * v.hz < v.length) beside = true;
      }
      for (const o of people) gap = Math.min(gap, gapTo(v, o) - 1.2);
      // The lights ahead, on this street and the next.
      const ahead = [...v.edge.stops.map(s => ({ s, d: s.s - v.s })), ...(v.next?.stops ?? []).map(s => ({ s, d: v.edge.length - v.s + s.s }))];
      for (const { s, d } of ahead) {
        if (s.cluster === v.inside) continue;
        if (d < 0) { if (d > -1) v.inside = s.cluster; continue; }
        if (d > LOOK_AHEAD) continue;
        const light = phase(s.cluster, s.group, time);
        const front = d - v.length / 2;
        // On amber, drive on if stopping would take hard braking; on green, wait if the queue
        // beyond would leave it standing in the junction.
        const blocked = gap < front + s.box + v.length && leader < 2 && front > 0.3;
        if (light === 'red' || blocked || (light === 'amber' && front > v.v * v.v / BRAKE + 0.4)) gap = Math.min(gap, front);
      }
      // Slow down for a sharp turn into the next street.
      let limit = v.cruise;
      if (v.next && v.edge.length - v.s < 6) {
        const [, , ax, az] = at(v.edge, v.edge.length), [, , bx, bz] = at(v.next, 0);
        if (ax * bx + az * bz < 0.85) limit = Math.min(limit, 3);
      }
      const want = Math.min(limit, Math.sqrt(2 * BRAKE * 0.55 * Math.max(0, gap - 0.5)));
      v.v = want < v.v ? Math.max(want, v.v - BRAKE * 1.6 * dt) : Math.min(want, v.v + ACCEL * dt);
      if (gap < 0.25) v.v = 0;
      // Two cars each waiting for the other across a junction: after a while one squeezes by.
      v.squeeze = Math.max(0, v.squeeze - dt);
      v.held = v.v < 0.1 && v.blocker?.blocker === v ? v.held + dt : 0;
      if (v.held > 3) { v.squeeze = 3; v.held = 0; }
      v.s += v.v * dt;
      const before: GeoPoint = [v.x, v.z];
      while (v.s >= v.edge.length) {
        if (!v.next) { v.s = -1; break; }
        v.s -= v.edge.length; v.edge = v.next; v.next = choose(v.edge);
        v.lane = Math.min(v.lane, v.edge.lanes.length - 1);
      }
      if (v.s < 0) continue;
      // Someone level with it in the lane it wants: it waits before moving across.
      const target = laneOffset(v.edge, v.lane);
      if (!beside) v.offset += Math.sign(target - v.offset) * Math.min(Math.abs(target - v.offset), 1.4 * dt);
      place(v);
      // A jump between streets (lanes that do not line up) fades out instead of snapping.
      if (Math.hypot(v.x - before[0], v.z - before[1]) > v.v * dt + 0.3) { v.slip[0] += before[0] - v.x; v.slip[1] += before[1] - v.z; }
    }
    for (let i = vehicles.length - 1; i >= 0; i--) {
      if (vehicles[i].s >= 0) continue;
      vehicles[i].entity.destroy(); vehicles.splice(i, 1);
    }
  }
  function draw(dt: number) {
    for (const v of vehicles) {
      const fade = Math.exp(-dt * 5);
      v.slip[0] *= fade; v.slip[1] *= fade;
      const yaw = Math.atan2(-v.hx, -v.hz) * pc.math.RAD_TO_DEG;
      let turn = yaw - v.yaw; turn -= Math.round(turn / 360) * 360;
      v.yaw += turn * (1 - Math.exp(-dt * 8));
      v.entity.setLocalPosition(x(v.x + v.slip[0]), 0.05, z(v.z + v.slip[1]));
      v.entity.setLocalEulerAngles(0, v.yaw, 0);
    }
    for (const s of signals) {
      if (!s.best) continue;
      const light = phase(s.best.c, s.best.group, time), walk = light === 'red' ? 'green' : 'red', shown = light + walk;
      if (shown !== s.shown) { s.signal.show(light, walk); s.shown = shown; }
    }
  }
  // The street is already busy when Gerard arrives.
  for (let t = 0; t < 70; t += 0.2) step(0.2, []);
  draw(1);

  // ------------------------------------------------------------ cyclists
  // Two-way bike lanes wide enough for it (the Meridiana's median) carry cyclists both ways, each
  // on its right half; they keep behind the one in front, wait for anyone standing in their way
  // and ride on, end to end. Made after the cars' first minute so the cars keep their seeded start.
  const cyclists: { entity: pc.Entity; lane: Edge; s: number; v: number; cruise: number }[] = [];
  const riders = new pc.Entity('Ciclistas'); root.addChild(riders);
  for (const road of scene.roads) {
    if (road.highway !== 'cycleway' || road.width < 1.8 || road.line.length < 2) continue;
    for (const pts of [road.line, [...road.line].reverse()]) {
      const cum = [0];
      for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
      const lane: Edge = { road, pts, cum, length: cum[cum.length - 1], lanes: [road.width / 4], start: '', end: '', stops: [] };
      for (let k = 0; k < Math.floor(lane.length / 55); k++) {
        const entity = new pc.Entity('Ciclista'); riders.addChild(entity);
        kit.place({ kind: 'cyclist', x: 0, z: 0 }, entity, new pc.Vec3(0, 0, 0));
        cyclists.push({ entity, lane, s: (k + random()) * 55, v: 0, cruise: 2.4 + random() * 1.4 });
      }
    }
  }
  function ride(dt: number, walkers: Cell[]) {
    for (const c of cyclists) {
      const [px, pz, hx, hz] = at(c.lane, c.s), off = c.lane.lanes[0];
      const x0 = px - hz * off, z0 = pz + hx * off;
      // Someone a few cells ahead in its half of the lane, or the rider in front: brake and wait.
      const blocked = walkers.some(w => { const ax = (w.x - x0) * hx + (w.z - z0) * hz, side = Math.abs(-(w.x - x0) * hz + (w.z - z0) * hx); return ax > 0 && ax < 2.6 && side < 0.8; })
        || cyclists.some(o => o !== c && o.lane === c.lane && o.s > c.s && o.s - c.s < 1.8);
      c.v = blocked ? Math.max(0, c.v - BRAKE * dt) : Math.min(c.cruise, c.v + ACCEL * 0.5 * dt);
      c.s += c.v * dt;
      if (c.s > c.lane.length) c.s -= c.lane.length;
      c.entity.setLocalPosition(x(x0), 0.05, z(z0));
      c.entity.setLocalEulerAngles(0, Math.atan2(-hx, -hz) * pc.math.RAD_TO_DEG, 0);
    }
  }
  ride(0, []);

  return {
    /** Moves the traffic on; `walkers` (grid cells) are the people cars stop for. */
    update(dt: number, walkers: Cell[]) { step(dt, walkers); draw(dt); ride(dt, walkers); },
    destroy() { vehicles.forEach(v => v.entity.destroy()); vehicles.length = 0; riders.destroy(); cyclists.length = 0; },
  };
}
