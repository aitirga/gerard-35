/**
 * Barcelona as a cartoon map (docs/barcelona.md): sea with waves, a sandy coast, round green
 * hills, the districts as soft blobs, three big avenues, the metro lines and the markers
 * (`src/map-markers.ts`). Every shape is hand-drawn in assets/geo/barcelona/city.json and rounded
 * off here. Used by the station map (`travel-ui.ts`). Looks live in style.css (.city-*).
 */
import { CITY_MAP, LINES, STATIONS, type Leg } from './transit.ts';
import { renderMarker, type MapMarker } from './map-markers.ts';

const escape = (text: string) => text.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const straight = (points: number[][]) => `M${points.map(([x, y]) => `${x},${y}`).join('L')}`;
/** A Catmull-Rom curve through the points, as cubic Béziers: hand-drawn corners become soft. */
function smooth(points: number[][], closed: boolean) {
  const n = points.length;
  const at = (i: number) => closed ? points[(i + n) % n] : points[Math.max(0, Math.min(n - 1, i))];
  let d = `M${points[0][0]},${points[0][1]}`;
  for (let i = 0; i < (closed ? n : n - 1); i++) {
    const [p0, p1, p2, p3] = [at(i - 1), at(i), at(i + 1), at(i + 2)];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6], c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${c1[0].toFixed(0)},${c1[1].toFixed(0)} ${c2[0].toFixed(0)},${c2[1].toFixed(0)} ${p2[0]},${p2[1]}`;
  }
  return closed ? `${d}Z` : d;
}
const centre = (poly: number[][]) => [poly.reduce((s, p) => s + p[0], 0) / poly.length, poly.reduce((s, p) => s + p[1], 0) / poly.length];

/** A rectangle of the map, in map metres. */
export interface View { x0: number; y0: number; x1: number; y1: number }
export const CITY_VIEW: View = { ...CITY_MAP.extent };
/** Stations the map always names: where lines meet, and the line ends. */
const NAMED = new Set([...LINES.flatMap(l => [l.stations[0], l.stations.at(-1)!]), ...LINES.flatMap(l => l.stations).filter((id, i, all) => all.indexOf(id) !== i)]);

export interface CityMapOptions {
  view?: View;
  /** Where Gerard is: a pin on that station. */
  current?: string;
  /** Stations that can be picked, and the one picked now. */
  selectable?: readonly string[];
  selected?: string;
  /** Icons on the map (`cityMarkers` in map-markers.ts). */
  markers?: readonly MapMarker[];
  /** The trip being made, highlighted on top of its lines. */
  route?: readonly Leg[];
  label?: string;
}

export function renderCityMap(options: CityMapOptions = {}): string {
  const v = options.view ?? CITY_VIEW, w = v.x1 - v.x0, h = v.y1 - v.y0;
  const unit = Math.max(w, h) / 150;
  const selectable = new Set(options.selectable ?? []);
  const at = (id: string) => STATIONS[id];
  const parts: string[] = [];
  parts.push(`<defs><pattern id="city-grid" width="${unit * 2.2}" height="${unit * 2.2}" patternUnits="userSpaceOnUse" patternTransform="rotate(15)"><rect width="${unit * 2.2}" height="${unit * 2.2}" fill="none" stroke="#e2c97e" stroke-width="${unit * .35}"/></pattern></defs>`);
  parts.push(`<rect class="city-land" x="${v.x0}" y="${v.y0}" width="${w}" height="${h}"/>`);
  parts.push(`<path class="city-sea" d="${straight(CITY_MAP.sea)}Z"/>`);
  parts.push(`<path class="city-beach" d="${smooth(CITY_MAP.coast, false)}" stroke-width="${unit * 1.6}"/>`);
  // Waves: little cartoon arcs scattered over the sea, always in the same places.
  for (let i = 0; i < 26; i++) {
    const [cx, cy] = CITY_MAP.coast[(i * 7) % CITY_MAP.coast.length];
    const x = cx + ((i * 2371) % 9000) - 2500, y = cy + 900 + ((i * 1733) % 3200);
    parts.push(`<path class="city-wave" d="M${x},${y}q${unit},${-unit} ${unit * 2},0q${unit},${unit} ${unit * 2},0" stroke-width="${unit * .4}"/>`);
  }
  for (const hill of CITY_MAP.hills) parts.push(`<path class="city-hill" d="${smooth(hill.poly, true)}" stroke-width="${unit * .5}"/>`);
  for (const d of CITY_MAP.districts) {
    const shape = smooth(d.poly, true);
    parts.push(`<path class="city-district" d="${shape}" fill="${d.colour}" stroke-width="${unit * .9}"/>`);
    if (d.pattern === 'grid') parts.push(`<path d="${shape}" fill="url(#city-grid)"/>`);
  }
  for (const r of CITY_MAP.rivers) parts.push(`<path class="city-river" d="${smooth(r.line, false)}" stroke-width="${unit * 1.3}"/>`);
  for (const a of CITY_MAP.avenues) {
    const d = smooth(a.line, false);
    parts.push(`<path class="city-avenue-edge" d="${d}" stroke-width="${unit * (1.1 + a.size * .3)}"/><path class="city-avenue" d="${d}" stroke-width="${unit * (.7 + a.size * .3)}"><title>${escape(a.name)}</title></path>`);
  }
  for (const d of CITY_MAP.districts) {
    const [cx, cy] = centre(d.poly);
    parts.push(`<text class="city-district-name" x="${cx}" y="${cy}" font-size="${unit * 1.7}">${escape(d.name.toUpperCase())}</text>`);
  }
  // Lines: a dark outline under the colour, cartoon style.
  for (const line of LINES) {
    const d = straight(line.stations.map(id => [at(id).x, at(id).y]));
    parts.push(`<path class="city-line-edge" d="${d}" stroke-width="${unit * 2.5}"/><path class="city-line" d="${d}" stroke="${line.colour}" stroke-width="${unit * 1.7}"><title>${line.name}</title></path>`);
  }
  if (options.route?.length) for (const leg of options.route) {
    const line = LINES.find(l => l.id === leg.line)!;
    parts.push(`<path class="city-route" d="${straight(leg.stations.map(id => [at(id).x, at(id).y]))}" stroke="${line.colour}" stroke-width="${unit * 3.4}"/>`);
  }
  for (const m of options.markers ?? []) parts.push(renderMarker(m, unit * 2.6));
  const counts = new Map<string, number>();
  for (const line of LINES) for (const id of line.stations) counts.set(id, (counts.get(id) ?? 0) + 1);
  for (const s of Object.values(STATIONS)) {
    const pickable = selectable.has(s.id), here = options.current === s.id, chosen = options.selected === s.id;
    const r = unit * (pickable || here ? 1.6 : (counts.get(s.id) ?? 1) > 1 ? 1.2 : .8);
    const name = pickable || here || NAMED.has(s.id);
    parts.push(`<g class="city-station${pickable ? ' is-pickable' : ''}${here ? ' is-here' : ''}${chosen ? ' is-selected' : ''}" data-station="${s.id}">`
      + `${pickable ? `<circle class="city-station-glow" cx="${s.x}" cy="${s.y}" r="${r * 2.2}"/>` : ''}`
      + `<circle cx="${s.x}" cy="${s.y}" r="${r}" stroke-width="${unit * .45}"/>`
      + `${name ? `<text x="${s.x + r * 1.5}" y="${s.y + unit * .55}" font-size="${unit * (pickable || here ? 1.7 : 1.3)}">${escape(s.name)}</text>` : ''}<title>${escape(s.name)}</title></g>`);
  }
  if (options.current) {
    const s = at(options.current);
    parts.push(`<g class="city-pin" transform="translate(${s.x} ${s.y})"><path d="M0,0L${-unit * 1.5},${-unit * 3}A${unit * 1.9},${unit * 1.9},0,1,1,${unit * 1.5},${-unit * 3}Z" stroke-width="${unit * .45}"/><text y="${-unit * 3.6}" font-size="${unit * 1.7}">G</text></g>`);
  }
  return `<svg class="city-map" viewBox="${v.x0} ${v.y0} ${w} ${h}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${escape(options.label ?? 'Plano de Barcelona con las líneas de metro')}">${parts.join('')}</svg>`;
}
