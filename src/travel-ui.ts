/**
 * Going down into a station (docs/barcelona.md): the network map on the station wall, where
 * Gerard picks a destination, and the trip, a small train running along the line on the map.
 * It only shows where he is and where the lines go; it never marks what to do.
 * Looks live in style.css (#travel, .city-*).
 */
import type { ControlAction } from './controller';
import { CITY_VIEW, renderCityMap, type View } from './city-map';
import { createCity3D, type City3D } from './city-3d';
import type { MapMarker } from './map-markers';
import { LINES, STATIONS, destinations, linesAt, route, type Closures, type Leg } from './transit';

const escape = (text: string) => text.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
/** Seconds per stop on the map, and the shortest and longest trip. */
const STOP_S = .32, MIN_S = 1.8, MAX_S = 4.5;
/** How far the plan zooms in (a share of the whole city's width) and out. */
const MIN_ZOOM = .18, MAX_ZOOM = 1;

export function createTravelUI(hud: HTMLElement) {
  // A <dialog> so the panels' and the dialogue's keys stand aside while it is open.
  const root = document.createElement('dialog');
  root.id = 'travel';
  root.setAttribute('aria-labelledby', 'travel-title');
  root.innerHTML = `<header class="travel-heading"><div><span class="battle-kicker">METRO · ESTACIÓN</span><h1 id="travel-title"></h1><p class="travel-lines"></p></div><p class="travel-status" aria-live="polite"></p></header>`
    + `<div class="travel-map"></div><footer class="travel-foot"><ul class="travel-legend"></ul><p class="travel-help"><span><kbd>←</kbd><kbd>→</kbd> Elegir</span><span><kbd>Enter</kbd> Viajar</span><span><kbd>+</kbd><kbd>−</kbd> Acercar</span><span class="travel-rotate"><kbd>Clic dcho.</kbd> Girar</span><span><kbd>Esc</kbd> Volver arriba</span></p></footer>`;
  hud.append(root);
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let from = '', options: Closures = {}, markers: readonly MapMarker[] = [];
  let choices: string[] = [], selected: string | undefined;
  let finish: ((to: string | undefined) => void) | undefined;
  let travelling = false;
  /** The part of the city on show: wheel or +/− zoom, dragging pans, 0 shows it all. */
  let view: View = { ...CITY_VIEW };
  let drag: { x: number; y: number; view: View; moved: boolean; turn: boolean } | undefined, panning = false;
  /** The city as a 3D model (city-3d.ts), made the first time the map opens; the flat plan without it. */
  let city: City3D | undefined, tried = false;
  const get = <T extends Element = HTMLElement>(selector: string) => root.querySelector<T>(selector)!;
  const badge = (id: string) => { const l = LINES.find(line => line.id === id)!; return `<b class="line-badge" data-kind="${l.kind}" style="--line:${l.colour}">${l.name}</b>`; };

  function render(trip?: readonly Leg[]) {
    get('#travel-title').textContent = STATIONS[from].name;
    get('.travel-lines').innerHTML = linesAt(from).map(l => badge(l.id)).join('');
    root.style.setProperty('--line', linesAt(from)[0]?.colour ?? '#d6252f');
    const legs = !trip && selected ? route(from, selected, options) : undefined;
    const map = { view, current: from, selectable: trip ? [] : choices, selected: trip ? undefined : selected, markers, route: trip, preview: legs, label: `Plano de la red desde ${STATIONS[from].name}` };
    if (city) city.draw(map); else get('.travel-map').innerHTML = renderCityMap(map);
    const stops = legs?.reduce((n, l) => n + l.stations.length - 1, 0) ?? 0;
    get('.travel-status').innerHTML = trip ? '' : selected && legs
      ? `${escape(STATIONS[selected].name)} · ${legs.map(l => badge(l.line)).join('<i>›</i>')} <small>${stops} ${stops === 1 ? 'parada' : 'paradas'}${legs.length > 1 ? ` · ${legs.length - 1} transbordo${legs.length > 2 ? 's' : ''}` : ''}</small>`
      : 'Desde aquí no hay a dónde ir.';
    get('.travel-legend').innerHTML = LINES.map(l => `<li>${badge(l.id)} ${escape(STATIONS[l.stations[0]].name)} <i>↔</i> ${escape(STATIONS[l.stations.at(-1)!].name)}</li>`).join('');
  }
  /** Keeps a view inside the city and at a sane size; `w`/`h` follow the city's own shape. */
  function clampView(cx: number, cy: number, zoom: number): View {
    const W = CITY_VIEW.x1 - CITY_VIEW.x0, H = CITY_VIEW.y1 - CITY_VIEW.y0;
    const k = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom)), w = W * k, h = H * k;
    const x0 = Math.min(CITY_VIEW.x1 - w, Math.max(CITY_VIEW.x0, cx - w / 2)), y0 = Math.min(CITY_VIEW.y1 - h, Math.max(CITY_VIEW.y0, cy - h / 2));
    return { x0, y0, x1: x0 + w, y1: y0 + h };
  }
  const zoomOf = (v: View) => (v.x1 - v.x0) / (CITY_VIEW.x1 - CITY_VIEW.x0);
  /** Zooms by `factor` keeping the map point under (px, py) — a share of the panel — in place. */
  function zoom(factor: number, px = .5, py = .5) {
    if (city) { const box = get('.travel-map').getBoundingClientRect(); city.zoom(factor, px * box.width, py * box.height); return; }
    const k = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoomOf(view) * factor));
    const w = view.x1 - view.x0, h = view.y1 - view.y0, nw = w * k / zoomOf(view), nh = h * k / zoomOf(view);
    const ax = view.x0 + w * px, ay = view.y0 + h * py;
    view = clampView(ax - nw * px + nw / 2, ay - nh * py + nh / 2, k);
    if (!travelling) render();
  }
  /** Opens framed on where Gerard is and where he can go, with room round them. */
  function frame() {
    const ids = [from, ...choices], xs = ids.map(id => STATIONS[id].x), ys = ids.map(id => STATIONS[id].y);
    if (city) { city.frame(ids.map(id => STATIONS[id])); return; }
    const W = CITY_VIEW.x1 - CITY_VIEW.x0, H = CITY_VIEW.y1 - CITY_VIEW.y0;
    const k = Math.max(.42, (Math.max(...xs) - Math.min(...xs)) * 2.2 / W, (Math.max(...ys) - Math.min(...ys)) * 2.2 / H);
    view = clampView((Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2, k);
  }
  /** Where a pointer event is over the map panel, as shares of the view drawn there. */
  function pointer(event: { clientX: number; clientY: number }) {
    const svg = root.querySelector<SVGSVGElement>('.travel-map svg');
    const box = svg?.getBoundingClientRect();
    if (!svg || !box?.width) return { px: .5, py: .5 };
    // preserveAspectRatio meet: the view is centred in the panel and scaled to fit.
    const w = view.x1 - view.x0, h = view.y1 - view.y0, scale = Math.min(box.width / w, box.height / h);
    const ox = (box.width - w * scale) / 2, oy = (box.height - h * scale) / 2;
    return { px: Math.min(1, Math.max(0, (event.clientX - box.left - ox) / (w * scale))), py: Math.min(1, Math.max(0, (event.clientY - box.top - oy) / (h * scale))), scale };
  }
  function select(step: number) {
    if (travelling || !choices.length) return;
    const i = selected ? choices.indexOf(selected) : -1;
    selected = choices[(i + step + choices.length) % choices.length];
    render();
  }
  /** The train runs along the route on the map; then the trip resolves. */
  async function travel(to: string) {
    const legs = route(from, to, options);
    if (travelling || !legs) return;
    travelling = true;
    render(legs);
    const points = legs.flatMap((leg, i) => leg.stations.slice(i ? 1 : 0).map(id => STATIONS[id]));
    const stops = points.length - 1;
    // The plan may have opened on the whole city: the ride closes in on its own route and follows the train.
    city?.frame(points);
    const train = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    const move = (x: number, y: number) => { if (city) city.train({ x, y }); else { train.setAttribute('cx', String(x)); train.setAttribute('cy', String(y)); } };
    if (!city) {
      const svg = get<SVGSVGElement>('.travel-map svg');
      train.classList.add('city-train');
      const view = svg.viewBox.baseVal;
      train.setAttribute('r', String(Math.max(view.width, view.height) / 160 * 1.9));
      svg.append(train);
    }
    const lengths = points.slice(1).map((p, i) => Math.hypot(p.x - points[i].x, p.y - points[i].y));
    const total = lengths.reduce((a, b) => a + b, 0) || 1;
    const seconds = reducedMotion.matches ? 0 : Math.min(MAX_S, Math.max(MIN_S, stops * STOP_S));
    const status = get('.travel-status');
    await new Promise<void>(done => {
      const start = performance.now();
      const frame = (now: number) => {
        const t = seconds ? Math.min(1, (now - start) / 1000 / seconds) : 1;
        const eased = t * t * (3 - 2 * t);
        let d = eased * total, i = 0;
        while (i < lengths.length - 1 && d > lengths[i]) { d -= lengths[i]; i++; }
        const a = points[i], b = points[i + 1] ?? a, k = lengths[i] ? Math.min(1, d / lengths[i]) : 1;
        move(a.x + (b.x - a.x) * k, a.y + (b.y - a.y) * k);
        // Which line and towards where, as the platform screens say it.
        let reached = 0, leg = legs[0];
        for (const l of legs) { reached += l.stations.length - 1; if (i < reached) { leg = l; break; } }
        const line = LINES.find(l => l.id === leg.line)!;
        const towards = line.stations.indexOf(leg.stations.at(-1)!) > line.stations.indexOf(leg.stations[0]) ? line.stations.at(-1)! : line.stations[0];
        const text = `${line.name} · Dirección ${STATIONS[towards].name}`;
        if (status.textContent !== text) status.innerHTML = `${badge(line.id)} Dirección ${escape(STATIONS[towards].name)}`;
        if (t < 1) requestAnimationFrame(frame); else done();
      };
      requestAnimationFrame(frame);
    });
    close(to);
  }
  function close(to?: string) {
    if (!root.open) return;
    root.open = false; travelling = false;
    city?.train(); city?.pause(true);
    window.removeEventListener('keydown', keydown, { capture: true });
    const done = finish; finish = undefined; done?.(to);
  }
  function keydown(event: KeyboardEvent) {
    if (!root.open) return;
    event.stopPropagation();
    if (travelling) { event.preventDefault(); return; }
    if (['ArrowRight', 'ArrowDown', 'KeyD', 'KeyS', 'Tab'].includes(event.code)) { event.preventDefault(); select(event.shiftKey && event.code === 'Tab' ? -1 : 1); }
    else if (['ArrowLeft', 'ArrowUp', 'KeyA', 'KeyW'].includes(event.code)) { event.preventDefault(); select(-1); }
    else if (['Enter', 'Space', 'KeyE'].includes(event.code)) { event.preventDefault(); if (!event.repeat && selected) void travel(selected); }
    else if (['Equal', 'NumpadAdd', 'BracketRight'].includes(event.code) || event.key === '+') { event.preventDefault(); zoom(1 / 1.35); }
    else if (['Minus', 'NumpadSubtract', 'Slash'].includes(event.code) || event.key === '-') { event.preventDefault(); zoom(1.35); }
    else if (event.code === 'Digit0' || event.code === 'Numpad0') { event.preventDefault(); if (city) city.orbit = city.whole; else { view = { ...CITY_VIEW }; render(); } }
    else if (event.code === 'Escape') { event.preventDefault(); close(); }
  }
  root.addEventListener('click', event => {
    if (drag?.moved) return;
    const station = (event.target as Element).closest<SVGGElement>('[data-station]')?.dataset.station;
    if (station && choices.includes(station)) { selected = station; void travel(station); }
  });
  root.addEventListener('wheel', event => {
    if (!(event.target as Element).closest('.travel-map')) return;
    event.preventDefault();
    const { px, py } = pointer(event);
    zoom(Math.exp(event.deltaY * .0015), px, py);
  }, { passive: false });
  root.addEventListener('pointerdown', event => {
    if (!(event.target as Element).closest('.travel-map') || travelling) return;
    drag = { x: event.clientX, y: event.clientY, view: { ...view }, moved: false, turn: event.button === 2 || event.shiftKey };
  });
  // The right button turns the model round.
  root.addEventListener('contextmenu', event => { if ((event.target as Element).closest('.travel-map')) event.preventDefault(); });
  window.addEventListener('pointermove', event => {
    if (!drag || !root.open) return;
    const { scale } = pointer(event);
    const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
    if (!drag.moved && Math.hypot(dx, dy) < 5) return;
    drag.moved = true;
    if (city) {
      if (drag.turn) city.rotate(dx, dy); else city.pan(dx, dy);
      drag.x = event.clientX; drag.y = event.clientY;
      return;
    }
    const w = drag.view.x1 - drag.view.x0, h = drag.view.y1 - drag.view.y0;
    view = clampView(drag.view.x0 + w / 2 - dx / (scale ?? 1), drag.view.y0 + h / 2 - dy / (scale ?? 1), zoomOf(drag.view));
    // One redraw per frame while dragging.
    if (!panning) { panning = true; requestAnimationFrame(() => { panning = false; if (root.open && !travelling) render(); }); }
  });
  window.addEventListener('pointerup', () => { if (drag) setTimeout(() => { drag = undefined; }); });
  root.addEventListener('pointerover', event => {
    const station = (event.target as Element).closest<SVGGElement>('[data-station]')?.dataset.station;
    if (!travelling && station && choices.includes(station) && station !== selected) { selected = station; render(); }
  });

  return {
    get open() { return root.open; },
    /** The 3D model, when there is one (screenshot scenarios move its camera). */
    get city() { return city; },
    /** Shows the map from `station` with the story's `icons`; resolves with the destination, or nothing if they go back up. */
    show(station: string, closures: Closures = {}, icons: readonly MapMarker[] = []): Promise<string | undefined> {
      close();
      from = station; options = closures; markers = icons;
      choices = destinations(from, closures); selected = choices[0];
      if (!tried) { tried = true; city = createCity3D(get('.travel-map')); root.classList.toggle('is-3d', !!city); }
      // Open first: the model takes the panel's size and frames itself on it.
      root.open = true; city?.pause(false); frame(); render();
      window.addEventListener('keydown', keydown, { capture: true });
      return new Promise(resolve => { finish = resolve; });
    },
    /** A controller drives it like the keyboard: directions choose, confirm travels, cancel goes back. */
    control(action: ControlAction) {
      if (!root.open || travelling) return;
      if (action === 'confirm') { if (selected) void travel(selected); }
      else if (action === 'cancel') close();
      else if (action === 'left' || action === 'up') select(-1);
      else if (action === 'right' || action === 'down') select(1);
    },
    destroy() { close(); city?.destroy(); root.remove(); },
  };
}
