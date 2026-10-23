import type { EnvironmentId } from './environments';
import { CITY_VIEW, renderCityMap } from './city-map.ts';
import { cityMarkers } from './map-markers.ts';
import { CITY_MAP } from './transit.ts';

export interface ExplorationWorldMapContext {
  castle: boolean;
  threat: number;
  spread: number;
}

export interface ExplorationWorldPosition {
  id: string;
  name: string;
  x: number;
  y: number;
}

const escape = (text: string) => text.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** Known places in Barcelona, rather than the station used to reach them. */
export function explorationWorldPosition(
  environment: EnvironmentId,
  context: Pick<ExplorationWorldMapContext, 'castle'> = { castle: false },
): ExplorationWorldPosition | undefined {
  let placeId: string;
  if (environment === 'meridiana' || environment === 'meridiana-calle') placeId = 'home';
  else if (environment === 'rec-comtal' || (environment === 'palacio' && context.castle)) placeId = 'rec-comtal';
  else return undefined;

  const place = CITY_MAP.places.find(p => p.id === placeId);
  if (!place) return undefined;
  const name = environment === 'meridiana-calle' ? 'Avinguda Meridiana'
    : environment === 'meridiana' ? 'Casa de Gerard y Aitor'
    : environment === 'palacio' ? 'Castillo de la Reina Bubbaloo' : place.name;
  return { id: place.id, name, x: place.x, y: place.y };
}

/** A whole-city reference map. Travel remains a conversation with the station. */
export function renderExplorationWorldMap(environment: EnvironmentId, context: ExplorationWorldMapContext): string {
  const position = explorationWorldPosition(environment, context);
  const label = `Mapa del mundo: Barcelona. ${position ? `Estás aquí: ${position.name}.` : 'Tu ubicación actual queda fuera de este mapa.'}`;
  const svg = renderCityMap({
    view: CITY_VIEW,
    markers: cityMarkers(context),
    label,
  }).replace('class="city-map"', 'class="city-map exploration-world-map"');
  if (!position) return svg;

  const unit = Math.max(CITY_VIEW.x1 - CITY_VIEW.x0, CITY_VIEW.y1 - CITY_VIEW.y0) / 150;
  const pin = `<g class="city-pin world-map-location-pin" data-world-location="${environment}" transform="translate(${position.x} ${position.y})">`
    + `<title>${escape(`Estás aquí: ${position.name}`)}</title>`
    + `<path d="M0,0L${-unit * 1.5},${-unit * 3}A${unit * 1.9},${unit * 1.9},0,1,1,${unit * 1.5},${-unit * 3}Z" stroke-width="${unit * .45}"/>`
    + `<text y="${-unit * 3.6}" font-size="${unit * 1.7}">G</text>`
    + `<text class="city-pin-label" y="${-unit * 6.6}" font-size="${unit * 1.5}" stroke-width="${unit * .5}">Estás aquí</text></g>`;
  return svg.replace('</svg>', `${pin}</svg>`);
}
