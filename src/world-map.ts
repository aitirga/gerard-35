import type { Environment, Room } from './environments';
import type { Cell } from './movement';

const escape = (text: string) => text.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** Room names wrap onto two lines, then shrink, to stay inside narrow rooms. */
function roomLabel(room: Room) {
  const words = room.name.split(' ');
  const split = words.length > 1 && room.name.length * 0.37 > room.w ? Math.ceil(words.length / 2) : words.length;
  const lines = [words.slice(0, split).join(' '), words.slice(split).join(' ')].filter(Boolean);
  const size = Math.min(0.72, (room.w - 0.3) / (Math.max(...lines.map(l => l.length)) * 0.52));
  const tspans = lines.map((line, i) => `<tspan x="${room.x + room.w / 2}" dy="${i ? 1.15 : (1 - lines.length) * 0.575}em">${escape(line)}</tspan>`).join('');
  return `<text x="${room.x + room.w / 2}" y="${room.z + room.d / 2}" font-size="${size.toFixed(2)}" class="map-room">${tspans}</text>`;
}
/** A local map for any environment: collision, landmarks and player share one coordinate space. */
export function renderWorldMap(environment: Environment, player: Cell): string {
  const width = Math.max(...environment.grid.map(row => row.length));
  const height = environment.grid.length;
  const paths = environment.grid.flatMap((row, z) => [...row].flatMap((cell, x) =>
    cell === '#' ? [] : [`M${x},${z}h1v1h-1Z`])).join('');
  return `<svg class="world-map" viewBox="-1 -1 ${width + 2} ${height + 2}" role="img" aria-label="Mapa de ${escape(environment.name)}. Gerard en ${player.x}, ${player.z}.">
    <rect x="0" y="0" width="${width}" height="${height}" class="map-blocked"/>
    <path d="${paths}" class="map-walkable"/>
    ${environment.houses.map(h => `<rect x="${h.x}" y="${h.z}" width="${h.w}" height="${h.d}" class="map-house"/>`).join('')}
    ${(environment.rooms ?? []).filter(r => r.w * r.d > 4).map(roomLabel).join('')}
    ${environment.interactions.map((p, i) => `<g><title>${escape(p.label)}</title><circle cx="${p.cell.x + .5}" cy="${p.cell.z + .5}" r=".9" class="map-point"/><text x="${p.cell.x + .5}" y="${p.cell.z + .5}" class="map-number">${i + 1}</text></g>`).join('')}
    <circle cx="${player.x + .5}" cy="${player.z + .5}" r=".7" class="map-player"/>
  </svg>`;
}
