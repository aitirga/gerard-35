import type { StatusId, TimedId } from './battle.ts';

/** What a fighter's plate shows as an icon: their statuses, and Punto débil (a dual's mark: the next blow lands WEAK_SPOT times). */
export type IconId = StatusId | TimedId | 'compas' | 'punto-debil' | 'cancion' | 'shock' | 'cargado' | 'converge' | 'reaccion' | 'luz' | 'racha' | 'meteoro' | 'combustion' | 'bits' | 'cortina' | 'definitiva' | 'dormida' | 'acecho' | 'siete-vidas' | 'encarnado' | 'enfado';
/** Each status's icon over whoever carries it (SVG on a 16 × 16 box, drawn in its colour). */
/** A definitiva: three puffs going up at once (awake, or asleep and dimmer). */
const DEFINITIVA_SVG = '<circle cx="8" cy="4.2" r="2.6"/><circle cx="3.6" cy="9" r="2.2"/><circle cx="12.4" cy="9" r="2.2"/><path d="M8 8v6.6M5.4 14.6h5.200" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>';
export const STATUS_ICONS: Record<IconId, string> = {
  // An Encarnado (src/castle.ts `STRONG`): an ember inside a ring, its halo.
  encarnado: '<circle cx="8" cy="8" r="6.2" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="8" cy="8" r="2.9" fill="currentColor"/>',
  // Dadista's Racha: a four-point star, the astral's own, with the dice spent in its corner.
  racha: '<path d="M8 .8 9.6 6.4 15.2 8 9.6 9.6 8 15.2 6.4 9.6 .8 8 6.4 6.4z"/>',
  // A rock coming down with its trail.
  meteoro: '<path d="M10.6 15a4.4 4.4 0 1 1 0-8.8 4.4 4.4 0 0 1 0 8.8zM1 1l5.2 4.4-1.3 1.4zM5.6 1l3 3.6-1 .7z"/>',
  // Converge: a wave that settles into a flat line.
  converge: '<path d="M1.2 8c1.3-5.6 2.6-5.6 3.6 0s2-2.6 2.8 0 1.2 0 1.6 0h5.6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>',
  // El Átomo's Reacción coming: a nucleus and two crossed orbits.
  reaccion: '<circle cx="8" cy="8" r="2.1" fill="currentColor"/><ellipse cx="8" cy="8" rx="6.6" ry="2.6" transform="rotate(35 8 8)" fill="none" stroke="currentColor" stroke-width="1.3"/><ellipse cx="8" cy="8" rx="6.6" ry="2.6" transform="rotate(-35 8 8)" fill="none" stroke="currentColor" stroke-width="1.3"/>',
  // Shock: a bolt.
  shock: '<path d="M9.6 1 3.4 9.1h3.5L5.9 15l6.7-8.7H8.9z" fill="currentColor"/>',
  // ∂Q/∂t Condensador: a capacitor's two plates, with their leads.
  cargado: '<path d="M.8 7.1h4.4v1.8H.8zM10.8 7.1h4.4v1.8h-4.4z" fill="currentColor"/><rect x="5" y="2.2" width="2" height="11.6" rx=".6" fill="currentColor"/><rect x="9" y="2.2" width="2" height="11.6" rx=".6" fill="currentColor"/>',
  // La Voz's Enfado: her voice gone sharp, a wave with a spike in it.
  enfado: '<path d="M.8 9.2h3.1l1.5-3.4 2.1 8.4 2.4-12.6 1.9 7.6h3.4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>',
  // La Voz's song: a sung note, the same mark for every note (its colour says which).
  cancion: '<path d="M6 2.2v8.1a2.3 2 0 1 1-1.4-1.8V3.6l6.8-1.5v6.6a2.3 2 0 1 1-1.4-1.8V4.1L6 5" fill="currentColor"/>',
  // The light through the salon's windows (docs/quests/luca.md): a pointed window, its colour the light on now.
  luz: '<path d="M8 1.6C5.5 1.6 3.6 3.8 3.6 6.6v7.8h8.8V6.6c0-2.8-1.9-5-4.4-5z" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M8 2.2v12.2M3.8 8.6h8.4" stroke="currentColor" stroke-width="1.1"/>',
  'punto-debil': '<path d="M8 1.5v3.2M8 11.3v3.2M1.5 8h3.2M11.3 8h3.2" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><circle cx="8" cy="8" r="4.3" fill="none" stroke="currentColor" stroke-width="1.4"/><circle cx="8" cy="8" r="1.5"/>',
  // Empolvado: a puff and the grains under it. Envenenado: bubbles. Cristalizado: shards.
  empolvado: '<circle cx="5.2" cy="7.6" r="3.2"/><circle cx="9.8" cy="5.6" r="3.8"/><circle cx="11.8" cy="9" r="2.4"/><circle cx="3.4" cy="13.6" r=".9"/><circle cx="7.6" cy="14.4" r=".9"/><circle cx="12" cy="13.6" r=".9"/>',
  envenenado: '<circle cx="6" cy="10" r="3.4" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="11.3" cy="5.6" r="2" fill="none" stroke="currentColor" stroke-width="1.4"/><circle cx="5.6" cy="3.2" r="1.1"/>',
  // A cortina of powder: a hanging screen of dust, grains falling from its foot.
  cortina: '<path d="M3 2.2h10v7.4c-1.2 1.2-2.2 1.2-3.3 0-1.2 1.2-2.2 1.2-3.4 0-1.1 1.2-2.1 1.2-3.3 0z"/><circle cx="4.6" cy="13.2" r=".9"/><circle cx="8" cy="14.2" r=".9"/><circle cx="11.4" cy="13.2" r=".9"/>',
  // Acecho: a cat's eye, its pupil a slit, on whoever's cat is crouched to spring.
  acecho: '<path d="M1.2 8C3 4.6 5.4 3.4 8 3.4s5 1.2 6.8 4.6c-1.8 3.4-4.2 4.6-6.8 4.6S3 11.4 1.2 8z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/><path d="M8 4.5c.9 1.1 1.35 2.3 1.35 3.5S8.9 10.4 8 11.5C7.1 10.4 6.65 9.2 6.65 8S7.1 5.6 8 4.5z"/>',
  // Siete vidas: a cat's head over each of the party while Yuki's ward holds.
  'siete-vidas': '<path fill-rule="evenodd" d="M2.6 2.2 5.5 5.5h5L13.4 2.2v7.3c0 3.1-2.4 5.1-5.4 5.1s-5.4-2-5.4-5.1zM5.2 9.6c0 .8.4 1.3.8 1.3s.8-.5.8-1.3-.4-1.3-.8-1.3-.8.5-.8 1.3zm4 0c0 .8.4 1.3.8 1.3s.8-.5.8-1.3-.4-1.3-.8-1.3-.8.5-.8 1.3z"/>',
  // A definitiva awake: three puffs going up at once.
  definitiva: DEFINITIVA_SVG,
  // A definitiva bought but asleep: the same puffs, dimmer, its corner how near it is to waking.
  dormida: DEFINITIVA_SVG,
  cristalizado: '<path d="M8 1 10.4 6.4 8 15 5.6 6.4z"/><path d="M2.4 6.2 5 8.6 3.6 12.4z"/><path d="M13.6 6.2 11 8.6 12.4 12.4z"/>',
  // Compás (Sincopante's ecos): a voice and its echo, two rings a little apart (Interferencia).
  compas: '<circle cx="6.6" cy="8" r="4.6" fill="none" stroke="currentColor" stroke-width="1.4"/><circle cx="9.4" cy="8" r="4.6" fill="none" stroke="currentColor" stroke-width="1.1" opacity=".7"/><circle cx="8" cy="8" r="1.3" fill="currentColor"/>',
  quemado: '<path d="M8 1.2c.6 2.6 3.8 4 3.8 7.9a3.8 3.8 0 0 1-7.6 0c0-2 1-3.3 2-4.2-.1 1.6.5 2.6 1.3 2.9C7 6 7 3.4 8 1.2z"/>',
  // Escudo de bits: a dome of little squares on the floor's line.
  bits: '<path d="M6.5 2.2h3v2.6h-3zM3.4 4.2h2.6v2.6H3.4zM10 4.2h2.6v2.6H10zM1.8 7.6h2.6v2.6H1.8zM11.6 7.6h2.6v2.6h-2.6zM1.2 11.1h2.6v2.6H1.2zM12.2 11.1h2.6v2.6h-2.6z"/><path d="M.8 14.8h14.4" stroke="currentColor" stroke-width="1.2"/>',
  // Volcán (the dúo mayor Vulcano): a cone with fire out of its mouth. Virus (Virus atómico): a swarm, three small Bips round a core.
  volcan: '<path d="M1.5 14.5 6 7.2h4l4.5 7.3z"/><path d="M8 1.2c.3 1.3 1.8 1.9 1.8 3.6a1.8 1.8 0 0 1-3.6 0c0-.9.5-1.5 1-2 0 .7.2 1.1.6 1.3C7.6 3.4 7.6 2.3 8 1.2z"/>',
  // The newer duals (docs/animas/README.md § Combined skills). Marea: two vessels joined by a pipe, level. Fulgurita: a branching
  // tube of glass. Metralla: splinters round a wound. Idea fija: a note that turns on itself. Seiche: a basin, its water tilted. Staccato: a note cut short.
  marea: '<path d="M2 2.5v9.2h3.4V9.4h5.2v2.3H14V2.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M2.8 6.2h1.8v4.7H2.8zM11.4 6.2h1.8v4.7h-1.8z"/><path d="M1 14.3h14" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>',
  fulgurita: '<path d="M8.6 1 6.4 5.6l2.4 1L5.2 11l1.9.9L5 15" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/><path d="M8.8 6.6 12.4 8M7.1 11.9l3.6 1.6" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>',
  metralla: '<path d="M8 5.4 9.3 8 8 10.6 6.7 8z"/><path d="M8 .8 9 3.6H7zM15.2 8l-2.8 1V7zM8 15.2 7 12.4h2zM.8 8l2.8-1v2zM13 3l-1.2 2.6-1.4-1.4zM3 3l2.6 1.2-1.4 1.4zM3 13l1.2-2.6 1.4 1.4zM13 13l-2.6-1.2 1.4-1.4z"/>',
  'idea-fija': '<path d="M13.4 8A5.4 5.4 0 1 1 8 2.6" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M8 .6 11 2.6 8 4.6z"/><circle cx="7.2" cy="9.6" r="1.7"/><path d="M8.7 9.6V5.4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>',
  seiche: '<path d="M1.8 3v10.6h12.4V3" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M2.6 6.2 13.4 9.4v3.4H2.6z"/>',
  // Alterna (Corriente alterna): a sine running between its two poles.
  alterna: '<circle cx="1.9" cy="8" r="1.6"/><circle cx="14.1" cy="8" r="1.6"/><path d="M3.6 8c1-4.6 2.6-4.6 3.4-1.6.4 1.6.6 1.6 1 0 .8-3 2.4-3 3.4 1.6" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>',
  staccato: '<circle cx="5.4" cy="11.6" r="2.3"/><path d="M7.4 11.6V2.4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><circle cx="12" cy="4" r="1.4"/><path d="M10 14.6 14.4 9" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>',
  // Bomba remota: a round bomb with its fuse and a spark.
  bomba: '<circle cx="7" cy="9.6" r="4.6"/><path d="M10.2 5.8l1.6-1.6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M13.3 1.6v1.5M14.4 3.6h-1.5M12 2.2l.7.7" stroke="currentColor" stroke-width="1.1" stroke-linecap="round"/>',
  virus: '<circle cx="8" cy="8" r="2.2"/><circle cx="8" cy="2.6" r="1.5" fill="none" stroke="currentColor" stroke-width="1.2"/><circle cx="12.7" cy="10.7" r="1.5" fill="none" stroke="currentColor" stroke-width="1.2"/><circle cx="3.3" cy="10.7" r="1.5" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M8 4.1v1.7M11.4 9.9 9.9 9M4.6 9.9 6.1 9" stroke="currentColor" stroke-width="1.1"/>',
  // Combustión (fire at IV, docs/animas/README.md § Combustión): the flame inside a burst, ready to go off.
  combustion: '<path d="M8.0 1.0L9.5 3.6L12.3 2.4L12.0 5.4L14.9 6.0L12.9 8.3L14.9 10.6L12.0 11.2L12.3 14.2L9.5 13.0L8.0 15.6L6.5 13.0L3.7 14.2L4.0 11.2L1.1 10.6L3.1 8.3L1.1 6.0L4.0 5.4L3.7 2.4L6.5 3.6z" fill="none" stroke="currentColor" stroke-width="1.15" stroke-linejoin="round"/><path d="M8 4.4c.4 1.6 2.3 2.4 2.3 4.8a2.3 2.3 0 0 1-4.6 0c0-1.2.6-2 1.2-2.5 0 1 .3 1.6.8 1.8C7.4 7 7.4 5.7 8 4.4z"/>',
  cegado: '<path d="M1.5 8S4 3.8 8 3.8 14.5 8 14.5 8 12 12.2 8 12.2 1.5 8 1.5 8z" fill="none" stroke="currentColor" stroke-width="1.4"/><circle cx="8" cy="8" r="1.9"/><path d="M2.6 13.4 13.4 2.6" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>',
  sangrado: '<path d="M8 1.5C6.2 4.6 4.2 7 4.2 9.8a3.8 3.8 0 0 0 7.6 0C11.8 7 9.8 4.6 8 1.5z"/>',
  mareo: '<path d="M8.6 8a.6.6 0 1 1-1.2 0 1.8 1.8 0 1 1 3.6 0 3 3 0 1 1-6 0 4.2 4.2 0 1 1 8.4 0" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>',
  llorera: '<path d="M5 3.5C4 5.6 3 6.8 3 8.3a2 2 0 0 0 4 0C7 6.8 6 5.6 5 3.5zm6 3C10 8.6 9 9.8 9 11.3a2 2 0 0 0 4 0c0-1.5-1-2.7-2-4.8z"/>',
  // A cross of cure (Rayo de sanación), and a question mark (Confusión).
  sanacion: '<path d="M6.5 2h3v4.5H14v3H9.5V14h-3V9.5H2v-3h4.5z"/>',
  confusion: '<path d="M5.3 5.7a2.7 2.7 0 1 1 4 2.4c-.8.5-1.3 1-1.3 2v.5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><circle cx="8" cy="13.2" r="1.15"/>',
  // A drop over two ripples (Mojado).
  mojado: '<path d="M8 1.2C6.4 3.8 4.9 5.6 4.9 7.6a3.1 3.1 0 0 0 6.2 0C11.1 5.6 9.6 3.8 8 1.2z"/><path d="M2 12.2c1.5-1.2 3-1.2 4.5 0s3 1.2 4.5 0 2-1.1 3-.3M3.2 14.8c1.2-.8 2.4-.8 3.6 0s2.4.8 3.6 0" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>',
  // La crecida (Freática): Agua, a staff gauge in its water, its three marks; Corriente, a bolt into the water's line;
  // Hundido, a head under a line; Congelado, a split crystal of ice.
  agua: '<path d="M3 1.5v13" stroke="currentColor" stroke-width="1.4"/><path d="M3 4h4.5M3 7.5h3.5M3 11h4.5" stroke="currentColor" stroke-width="1.3"/><path d="M8.6 9.4c1.1-.8 2.1-.8 3.2 0s2.1.8 3.2 0v5.1H8.6z"/>',
  corriente: '<path d="M9.4 1 4.6 7.6h3L6.6 11.2l4.8-6H8.6z"/><path d="M1.4 13.2c1.6-1.2 3.2-1.2 4.8 0s3.2 1.2 4.8 0 2.4-1 3.6-.2" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>',
  hundido: '<circle cx="8" cy="10.2" r="2.6"/><path d="M5.2 15c.4-1.6 1.4-2.3 2.8-2.3s2.4.7 2.8 2.3" /><path d="M1.2 4.6c1.6-1.2 3.2-1.2 4.8 0s3.2 1.2 4.8 0 2.4-1 4-.2" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><circle cx="11.6" cy="7.2" r=".8"/>',
  congelado: '<path d="M8 .8 13.6 4.4v7.2L8 15.2 2.4 11.6V4.4z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/><path d="M8 .8v14.4M2.4 4.4 13.6 11.6M13.6 4.4 2.4 11.6" stroke="currentColor" stroke-width=".9" opacity=".75"/>',
  // Four arrows pointing in (Encogido).
  encogido: '<path d="M2 2l4 4M14 2l-4 4M2 14l4-4M14 14l-4-4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M3.5 6H6V3.5M12.5 6H10V3.5M3.5 10H6v2.5M12.5 10H10v2.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>',
};
/** A status's icon as an inline SVG (its colour comes from `--status`, as on a plate). */
export const statusSvg = (id: IconId) => `<svg viewBox="0 0 16 16" aria-hidden="true">${STATUS_ICONS[id]}</svg>`;
