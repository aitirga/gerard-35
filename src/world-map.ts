import type { Environment, Room } from './environments';
import type { GeoPoint, GeoScene } from './geo';
import type { Cell } from './movement';

/**
 * The local map (M): where the party stands in the place, never what there is to do (AGENTS.md).
 * An interior with a drawn plan reads as an architect's plan: each room's floor in its own tint,
 * thin walls between them, windows, doors, furniture and steps, and the room Gerard is in lit up.
 * A real place (tools/geo.py) reads as a street map: its parks, water, squares, streets with their
 * names and buildings. Anything else is drawn from its grid the way an interior is. Gerard and
 * whoever walks with him are their faces on it.
 */
const escape = (text: string) => text.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const n = (value: number) => +value.toFixed(2);

/** Someone on the map: where, their name, and their face (a portrait URL) and colour if they have them. */
export interface MapMarker { cell: Cell; name: string; face?: string; colour?: string }
export interface MapOptions {
  /** Gerard's face and colour; his name defaults to Gerard. */
  player?: Omit<MapMarker, 'cell'>;
  /** The drawing's width over its height: a place much longer than that is shown round the player. */
  aspect?: number;
}

/** Plan glyphs (environments.ts PLAN_GLYPHS) that are floor, and those drawn on the wall beside the floor. */
const FLOOR = new Set(['.', '+', '^', 'o', '/']);
const OPENINGS: Record<string, string> = { W: 'map-window', G: 'map-window', D: 'map-door', '=': 'map-rail' };
/** How far a floor reaches into the wall cell beside it, and the wall line beyond it: walls are drawn thin. */
const FLOOR_REACH = 0.36, WALL_REACH = 0.62;

type Box = { x: number; z: number; w: number; d: number };
let drawn = 0;
const rect = (x: number, z: number, w: number, d: number) => `M${n(x)},${n(z)}h${n(w)}v${n(d)}h${n(-w)}Z`;
const cellsPath = (cells: Cell[], grow: number) => cells.map(c => rect(c.x - grow, c.z - grow, 1 + grow * 2, 1 + grow * 2)).join('');
const inside = (box: Box, cell: Cell) => cell.x >= box.x && cell.x < box.x + box.w && cell.z >= box.z && cell.z < box.z + box.d;
const cellOf = (cell: Cell) => ({ x: Math.floor(cell.x), z: Math.floor(cell.z) });
/** The rooms of a place, its plan's or its palace's. */
const roomsOf = (environment: Environment): Room[] => environment.rooms ?? environment.palace?.rooms ?? [];
/** A room's name as the map writes it: generated floors number their rooms, the map does not. */
const roomName = (room: Room) => room.name.replace(/\s+\d+$/, '');
/** The name of the room `cell` is in, if the place has rooms. */
export function roomAt(environment: Environment, cell: Cell): string | undefined {
  const room = roomsOf(environment).find(r => inside(r, cellOf(cell)));
  return room && roomName(room);
}

/** A room's name inside it: across, on two lines, or along it when it is long and narrow; left out where it cannot be read. */
type Spot = { x: number; z: number; r: number };
function roomLabel(room: Room, here: boolean, avoid: Spot[]) {
  const name = roomName(room).toUpperCase(), words = name.split(' ');
  const half = Math.ceil(words.length / 2);
  const fit = (lines: string[], length: number, across: number) => ({
    lines, size: Math.min(0.62, (length - 0.4) / (Math.max(...lines.map(l => l.length)) * 0.72), (across - 0.2) / (lines.length * 1.25)),
  });
  const options = [
    { ...fit([name], room.w, room.d), turned: false },
    ...(words.length > 1 ? [{ ...fit([words.slice(0, half).join(' '), words.slice(half).join(' ')], room.w, room.d), turned: false }] : []),
    // Along a corridor only when it reads much better than across.
    { ...fit([name], room.d, room.w), turned: true, penalty: 1.4 },
  ].sort((a, b) => b.size / ('penalty' in b ? b.penalty! : 1) - a.size / ('penalty' in a ? a.penalty! : 1));
  const best = options[0];
  if (best.size < 0.3) return '';
  // Its box, and where in the room it goes: the middle, or the end of the room furthest from a face standing on it.
  const along = Math.max(...best.lines.map(l => l.length)) * best.size * 0.36 + 0.1, across = best.lines.length * best.size * 0.6 + 0.05;
  const hw = best.turned ? across : along, hd = best.turned ? along : across;
  const hits = (x: number, z: number) => avoid.reduce((worst, m) => Math.max(worst, m.r - Math.hypot(Math.max(Math.abs(m.x - x) - hw, 0), Math.max(Math.abs(m.z - z) - hd, 0))), -Infinity);
  const middle = { x: room.x + room.w / 2, z: room.z + room.d / 2 };
  const spots = [middle,
    { x: middle.x, z: room.z + hd + 0.2 }, { x: middle.x, z: room.z + room.d - hd - 0.2 },
    { x: room.x + hw + 0.2, z: middle.z }, { x: room.x + room.w - hw - 0.2, z: middle.z },
  ].filter(p => p === middle || (p.x - hw >= room.x - 0.01 && p.x + hw <= room.x + room.w + 0.01 && p.z - hd >= room.z - 0.01 && p.z + hd <= room.z + room.d + 0.01));
  const { x: cx, z: cz } = spots.find(p => hits(p.x, p.z) <= 0) ?? spots.reduce((a, b) => hits(b.x, b.z) < hits(a.x, a.z) ? b : a);
  const tspans = best.lines.map((line, i) => `<tspan x="${n(cx)}" dy="${i ? 1.2 : n((1 - best.lines.length) * 0.6)}em">${escape(line)}</tspan>`).join('');
  return `<text x="${n(cx)}" y="${n(cz)}" font-size="${n(best.size)}" class="map-room${here ? ' is-here' : ''}"${best.turned ? ` transform="rotate(-90 ${n(cx)} ${n(cz)})"` : ''}>${tspans}</text>`;
}

/** The floor cells of a place: from its plan if it has one (furniture stands on the floor), else from its grid. */
function floorOf(environment: Environment) {
  const rows = environment.plan ?? environment.grid;
  const floor: Cell[] = [], furniture: Cell[] = [];
  // Without a plan, what blocks the way inside the floor (a desk, a bench, a pillar) is furniture,
  // not wall: blocked cells that cannot be reached from the map's edge without crossing the floor.
  const outside = new Set<string>();
  if (!environment.plan) {
    const width = Math.max(...rows.map(r => r.length)), blocked = (x: number, z: number) => (rows[z]?.[x] ?? '#') === '#';
    const queue: Cell[] = [];
    for (let x = -1; x <= width; x++) queue.push({ x, z: -1 }, { x, z: rows.length });
    for (let z = 0; z < rows.length; z++) queue.push({ x: -1, z }, { x: width, z });
    queue.forEach(c => outside.add(`${c.x},${c.z}`));
    while (queue.length) {
      const c = queue.pop()!;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const x = c.x + dx, z = c.z + dz, key = `${x},${z}`;
        if (x < 0 || z < 0 || x >= width || z >= rows.length || outside.has(key) || !blocked(x, z)) continue;
        outside.add(key); queue.push({ x, z });
      }
    }
  }
  rows.forEach((row, z) => [...row].forEach((glyph, x) => {
    const island = !environment.plan && glyph === '#' && !outside.has(`${x},${z}`);
    if (environment.plan ? FLOOR.has(glyph) : glyph !== '#' || island) floor.push({ x, z });
    if (environment.plan ? glyph === 'o' : island) furniture.push({ x, z });
  }));
  return { floor, furniture, rows };
}

/** Windows, doors and railings, each on the wall line beside the floor it opens from. */
function openings(rows: string[]) {
  const isFloor = (x: number, z: number) => FLOOR.has(rows[z]?.[x] ?? ' ');
  const out: Record<string, string[]> = {};
  const near = FLOOR_REACH + 0.03, thick = WALL_REACH - FLOOR_REACH - 0.06;
  /** Where the band sits across its wall: beside the floor on one side, in the middle with floor on both. */
  const across = (before: boolean, after: boolean) => before && after ? 0.5 - thick / 2 : before ? near : 1 - near - thick;
  rows.forEach((row, z) => [...row].forEach((glyph, x) => {
    const kind = OPENINGS[glyph];
    if (!kind) return;
    const west = isFloor(x - 1, z), east = isFloor(x + 1, z), north = isFloor(x, z - 1), south = isFloor(x, z + 1);
    // A wall running north–south has its floor to the west or east; one running east–west, to the north or south.
    const runsNorth = (west || east) && !(north || south) ? true : (north || south) && !(west || east) ? false : undefined;
    if (runsNorth === undefined) return;
    (out[kind] ??= []).push(runsNorth ? rect(x + across(west, east), z, thick, 1) : rect(x, z + across(north, south), 1, thick));
  }));
  return Object.entries(out).map(([kind, paths]) => `<path class="${kind}" d="${paths.join('')}"/>`).join('');
}

/** Steps: a line across each flight for every tread. */
function stairsOf(environment: Environment) {
  return (environment.stairs ?? []).map(s => {
    const along = s.up === 'north' ? s.d : s.w, count = Math.max(2, Math.round(along * 2.5));
    const lines = Array.from({ length: count - 1 }, (_, i) => {
      const t = (i + 1) / count;
      return s.up === 'north' ? `M${n(s.x + 0.1)},${n(s.z + s.d * t)}h${n(s.w - 0.2)}` : `M${n(s.x + s.w * t)},${n(s.z + 0.1)}v${n(s.d - 0.2)}`;
    }).join('');
    return `<path class="map-stairs" d="${lines}"/>`;
  }).join('');
}

/** A built place: floors by room, walls between them, openings, furniture, steps and room names. */
function planMap(environment: Environment, player: Cell) {
  const { floor, furniture, rows } = floorOf(environment);
  const rooms = roomsOf(environment), at = cellOf(player);
  const here = rooms.find(r => inside(r, at));
  // A doorway or a step between rooms belongs to no room: it takes the floor of the room beside it.
  const owner = new Map<string, number>();
  for (const cell of floor) owner.set(`${cell.x},${cell.z}`, rooms.findIndex(r => inside(r, cell)));
  for (let pass = 0; pass < 3; pass++) for (const cell of floor) {
    if (owner.get(`${cell.x},${cell.z}`) !== -1) continue;
    const near = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dz]) => owner.get(`${cell.x + dx},${cell.z + dz}`)).find(i => i !== undefined && i >= 0);
    if (near !== undefined) owner.set(`${cell.x},${cell.z}`, near);
  }
  const groups = new Map<number, Cell[]>();
  for (const cell of floor) {
    const index = owner.get(`${cell.x},${cell.z}`)!;
    groups.set(index, [...groups.get(index) ?? [], cell]);
  }
  const floors = [...groups].map(([index, cells]) => {
    const room = rooms[index];
    return `<path class="map-floor${room && room === here ? ' is-here' : ''}" data-floor="${room?.floor ?? 'plain'}" d="${cellsPath(cells, FLOOR_REACH)}"/>`;
  }).join('');
  const xs = floor.map(c => c.x), zs = floor.map(c => c.z);
  const bounds: Box = floor.length ? { x: Math.min(...xs), z: Math.min(...zs), w: Math.max(...xs) - Math.min(...xs) + 1, d: Math.max(...zs) - Math.min(...zs) + 1 } : { x: 0, z: 0, w: rows[0]?.length || 1, d: rows.length || 1 };
  const body = `<path class="map-wall" d="${cellsPath(floor, WALL_REACH)}"/>${floors}
    ${furniture.length ? `<path class="map-furniture" d="${cellsPath(furniture, 0)}"/>` : ''}
    ${environment.plan ? openings(rows) : ''}${stairsOf(environment)}
    ${environment.houses.map(h => `<rect x="${h.x + 0.35}" y="${h.z + 0.45}" width="${h.w}" height="${h.d}" class="map-house-shadow"/><rect x="${h.x}" y="${h.z}" width="${h.w}" height="${h.d}" class="map-house"/>`).join('')}
`;
  const labels = (avoid: Spot[]) => rooms.filter(r => r.w * r.d >= 4).map(r => roomLabel(r, r === here, avoid)).join('');
  return { body, bounds, kind: 'plan' as const, labels };
}

const polyPath = (poly: GeoPoint[]) => `M${poly.map(p => `${n(p[0])},${n(p[1])}`).join('L')}Z`;
const linePath = (line: GeoPoint[]) => `M${line.map(p => `${n(p[0])},${n(p[1])}`).join('L')}`;
/** What tells one street's name apart: without "Carrer de", "Avinguda"… */
const nameCore = (name: string) => name.toUpperCase().replace(/^(CARRER|AVINGUDA|AV\.|PASSEIG|PG\.|PLAÇA|RONDA|VIA)\s+(DE LA |DE LES |DE L'|DELS |DEL |DE |D')?/, '');
/** A street's name, turned to the nearest stretch of the street that bears it. */
function streetLabel(scene: GeoScene, label: GeoScene['labels'][number], size: number) {
  let best = { gap: Infinity, angle: 0 };
  const core = nameCore(label.text);
  for (const road of scene.roads) {
    if (!road.name || nameCore(road.name) !== core) continue;
    for (let i = 1; i < road.line.length; i++) {
      const [ax, az] = road.line[i - 1], [bx, bz] = road.line[i];
      const t = Math.max(0, Math.min(1, ((label.x - ax) * (bx - ax) + (label.z - az) * (bz - az)) / ((bx - ax) ** 2 + (bz - az) ** 2 || 1)));
      const gap = Math.hypot(ax + (bx - ax) * t - label.x, az + (bz - az) * t - label.z);
      if (gap < best.gap) best = { gap, angle: Math.atan2(bz - az, bx - ax) * 180 / Math.PI };
    }
  }
  let angle = best.gap < 15 ? best.angle : 0;
  if (angle > 90) angle -= 180; else if (angle < -90) angle += 180;
  return `<text class="map-street" x="${n(label.x)}" y="${n(label.z)}" font-size="${n(size)}"${Math.abs(angle) > 1 ? ` transform="rotate(${n(angle)} ${n(label.x)} ${n(label.z)})"` : ''}>${escape(label.text)}</text>`;
}
/**
 * Street names: the place's own labels, and each named street's name along it every so often, turned
 * to it, wherever no other label of the same street is near.
 */
function streetNames(scene: GeoScene, size: number) {
  const placed = scene.labels.filter(l => l.text).map(l => ({ x: l.x, z: l.z, core: nameCore(l.text), svg: streetLabel(scene, l, size) }));
  const spacing = size * 60;
  for (const road of scene.roads) {
    if (!road.name || road.kind === 'rail' || road.kind === 'path') continue;
    const core = nameCore(road.name), text = road.name.toUpperCase();
    let walked = spacing * 0.5;
    for (let i = 1; i < road.line.length; i++) {
      const [ax, az] = road.line[i - 1], [bx, bz] = road.line[i], length = Math.hypot(bx - ax, bz - az);
      // Only along a stretch straight and long enough to hold the name.
      if (length < text.length * size * 0.75) { walked += length; continue; }
      walked += length;
      if (walked < spacing) continue;
      const x = (ax + bx) / 2, z = (az + bz) / 2;
      if (placed.some(p => p.core === core && Math.hypot(p.x - x, p.z - z) < spacing)) continue;
      let angle = Math.atan2(bz - az, bx - ax) * 180 / Math.PI;
      if (angle > 90) angle -= 180; else if (angle < -90) angle += 180;
      placed.push({ x, z, core, svg: `<text class="map-street" x="${n(x)}" y="${n(z)}" font-size="${n(size)}" transform="rotate(${n(angle)} ${n(x)} ${n(z)})">${escape(text)}</text>` });
      walked = 0;
    }
  }
  return placed.map(p => p.svg).join('');
}
/** A real place's street map, drawn once per place: it never changes while the game runs. */
const geoBodies = new Map<string, string>();
function geoMap(environment: Environment, scene: GeoScene) {
  const width = environment.grid[0]?.length || scene.width, depth = environment.grid.length || scene.depth;
  const bounds: Box = { x: 0, z: 0, w: width, d: depth };
  let body = geoBodies.get(environment.id);
  if (!body) {
    const unit = Math.min(Math.max(width, depth), 140) / 60;
    const areas = (['sand', 'grass', 'forest', 'square', 'water'] as const).map(kind => scene.areas[kind]?.length ? `<path class="map-area" data-area="${kind}" d="${scene.areas[kind]!.map(polyPath).join('')}"/>` : '').join('');
    const rails = scene.roads.filter(r => r.kind === 'rail'), paths = scene.roads.filter(r => r.kind === 'path');
    const streets = scene.roads.filter(r => r.kind !== 'rail' && r.kind !== 'path');
    const stroke = (list: GeoScene['roads'], cls: string, extra = 0) => list.map(r => `<path class="${cls}" d="${linePath(r.line)}" stroke-width="${n(Math.max(0.6, r.width) + extra)}"/>`).join('');
    const buildings = scene.buildings.map(b => polyPath(b.poly)).join('');
    body = `<rect class="map-ground" x="0" y="0" width="${width}" height="${depth}"/>${areas}
      ${stroke(rails, 'map-rail-line')}${stroke(streets, 'map-road-casing', unit * 0.35)}${stroke(paths, 'map-path')}${stroke(streets, 'map-road')}
      <path class="map-building-shadow" d="${buildings}" transform="translate(${n(unit * 0.14)} ${n(unit * 0.22)})"/><path class="map-building" d="${buildings}" stroke-width="${n(unit * 0.06)}"/>
      ${streetNames(scene, unit * 0.7)}`;
    geoBodies.set(environment.id, body);
  }
  return { body, bounds, kind: 'geo' as const, labels: (_avoid: Spot[]) => '' };
}

/** A face in a ring (their initial without a portrait); Gerard's pulses. */
function marker(m: MapMarker, cls: string, unit: number) {
  const id = `map-face-${++drawn}`, x = n(m.cell.x + 0.5), z = n(m.cell.z + 0.5), r = n(unit), inner = n(unit * 0.84);
  const face = m.face
    ? `<clipPath id="${id}"><circle r="${inner}"/></clipPath><circle class="map-marker-back" r="${inner}"/><image href="${escape(m.face)}" x="${n(-inner * 1.1)}" y="${n(-inner * 1.05)}" width="${n(inner * 2.2)}" height="${n(inner * 2.6)}" preserveAspectRatio="xMidYMin slice" clip-path="url(#${id})"/>`
    : `<text class="map-marker-initial" font-size="${n(unit)}">${escape(m.name[0] ?? '')}</text>`;
  return `<g class="map-marker ${cls}" transform="translate(${x} ${z})"${m.colour ? ` style="--marker:${escape(m.colour)}"` : ''}><title>${escape(m.name)}</title>${cls === 'map-player' ? `<circle class="map-marker-pulse" r="${r}"/>` : ''}<circle class="map-marker-halo" r="${n(unit * 1.12)}"/><circle class="map-marker-ring" r="${r}"/>${face}</g>`;
}

/** Whoever stands on Gerard's heels is drawn just beside him, so both faces show. */
function beside(partner: MapMarker, player: Cell, gap: number): MapMarker {
  const dx = partner.cell.x - player.x, dz = partner.cell.z - player.z, apart = Math.hypot(dx, dz);
  if (apart >= gap) return partner;
  const ux = apart > 0.01 ? dx / apart : 0.8, uz = apart > 0.01 ? dz / apart : 0.6;
  return { ...partner, cell: { x: player.x + ux * gap, z: player.z + uz * gap } };
}
/**
 * The whole drawing: the place, then whoever walks with Gerard (`partner`: Aitor, Bernat), then
 * Gerard. A real place much longer than the drawing is wide shows the stretch round Gerard, fading
 * out on the sides where it goes on (`data-cropped`).
 */
export function renderWorldMap(environment: Environment, player: Cell, partner?: MapMarker, options: MapOptions = {}): string {
  const map = environment.geo ? geoMap(environment, environment.geo) : planMap(environment, player);
  const margin = map.kind === 'geo' ? 0 : 1, aspect = options.aspect ?? 1.6;
  let view: Box = { x: map.bounds.x - margin, z: map.bounds.z - margin, w: map.bounds.w + margin * 2, d: map.bounds.d + margin * 2 };
  let cropped = '';
  if (map.kind === 'geo') {
    // Never closer than this many cells along the long side, so a street still reads as one.
    const least = 110;
    if (view.w / view.d > aspect * 1.4 && view.w > least) {
      const w = Math.max(least, view.d * aspect);
      view = { ...view, x: Math.max(view.x, Math.min(view.x + view.w - w, player.x + 0.5 - w / 2)), w };
      cropped = 'x';
    } else if (view.d / view.w > 1.4 / aspect && view.d > least) {
      const d = Math.max(least, view.w / aspect);
      view = { ...view, z: Math.max(view.z, Math.min(view.z + view.d - d, player.z + 0.5 - d / 2)), d };
      cropped = 'z';
    }
  }
  // The faces keep about the same size on screen however large the place.
  const unit = Math.max(0.72, Math.max(view.w, view.d * aspect) / 44);
  const mate = partner && beside(partner, player, unit * 1.75);
  // Room names step aside from the faces on them.
  const avoid: Spot[] = [{ x: player.x + 0.5, z: player.z + 0.5, r: unit * 1.15 }, ...mate ? [{ x: mate.cell.x + 0.5, z: mate.cell.z + 0.5, r: unit * 0.95 }] : []];
  const room = roomAt(environment, player);
  const label = `Mapa de ${escape(environment.name)}. ${escape(options.player?.name ?? 'Gerard')}${room ? ` en ${escape(room)}` : ''}.`;
  return `<svg class="world-map" data-map="${map.kind}"${cropped ? ` data-cropped="${cropped}"` : ''} viewBox="${n(view.x)} ${n(view.z)} ${n(view.w)} ${n(view.d)}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${label}">
    ${map.body}${map.labels(avoid)}
    ${mate ? marker(mate, 'map-partner', unit * 0.82) : ''}
    ${marker({ name: 'Gerard', ...options.player, cell: player }, 'map-player', unit)}
  </svg>`;
}
