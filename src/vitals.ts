/**
 * The party's faces and vitals, shared by the status screen and the fights: a round avatar (with
 * the ánima's scarf over the provisional portraits) and a plate whose PV and Secundaria run as two
 * waves out of the avatar. `setVitals` updates a plate in place so the waves glide; `flashAnima`
 * lights the avatar up when its ánima changes. Looks live in style.css (.vitals).
 */
import { SPEAKERS } from './dialogue';
import type { ProfileId } from './stats';

const escape = (text: string) => text.replace(/[&<>"]/g, c => `&#${c.charCodeAt(0)};`);
/** A scarf over the provisional SVG portraits (same 48×48 box), in the colour the member picked. */
const scarfArt = (colour: string) => `<svg class="portrait-scarf" viewBox="0 0 48 48" aria-hidden="true" style="--scarf:${colour}"><path d="M16.5 32.5Q24 37 31.5 32.5l.6 3.4Q24 41 15.9 35.9Z"/><circle cx="28.6" cy="36.4" r="1.7"/><path d="M27.6 37.2l2.6 6.2-2.2.5-1.7-5.9Z"/></svg>`;

/** Gerard as a boy has a painted portrait; the rest use their provisional dialogue art. */
export function portrait(profile: ProfileId, name: string, scarf?: string) {
  if (profile === 'gerard') return `<img src="${import.meta.env.BASE_URL}portraits/gerard-child.png" alt="Retrato de ${escape(name)}"/>`;
  const art = profile === 'gerard35' ? SPEAKERS.gerard35.art : profile === 'aitor' ? SPEAKERS.aitor.art : undefined;
  if (!art) return `<span class="portrait-initial" aria-hidden="true">${escape(name[0])}</span>`;
  return `<span class="portrait-art" role="img" aria-label="Retrato de ${escape(name)}">${art}${scarf ? scarfArt(scarf) : ''}</span>`;
}

/** Two gentle S-curves, one under the other: PV on top, Secundaria below. */
const WAVES = ['M2 10C40 1 78 19 120 10S200 1 238 10', 'M2 26C40 17 78 35 120 26S200 17 238 26'];
export interface Vitals { id: string; name: string; profile: ProfileId; hp: number; maxHp: number; sec: number; maxSec: number; anima?: string; scarf?: string }
export function vitalsPlate(v: Vitals) {
  const wave = (d: string, bar: 'hp' | 'sec', ratio: number) => `<path class="wave-track" d="${d}"/><path class="wave-trail" data-bar="${bar}" d="${d}" pathLength="100" style="stroke-dasharray:${(ratio * 100).toFixed(1)} 1000"/><path class="wave-fill" data-bar="${bar}" d="${d}" pathLength="100" style="stroke-dasharray:${(ratio * 100).toFixed(1)} 1000"/>`;
  return `<div class="vitals" data-member="${v.id}"${v.scarf ? ` style="--anima:${v.scarf}"` : ''}>
    <div class="vitals-avatar">${portrait(v.profile, v.name, v.scarf)}<i class="vitals-burst" aria-hidden="true"></i></div>
    <div class="vitals-body">
      <div class="vitals-head"><strong>${escape(v.name)}</strong><span class="vitals-tag">${v.anima ? escape(v.anima.toUpperCase()) : ''}</span></div>
      <svg class="vitals-waves" viewBox="0 0 240 36" preserveAspectRatio="none" aria-hidden="true">${wave(WAVES[0], 'hp', v.hp / v.maxHp)}${wave(WAVES[1], 'sec', v.maxSec ? v.sec / v.maxSec : 0)}</svg>
      <div class="vitals-numbers"><span role="meter" aria-label="${escape(v.name)}: PV" aria-valuenow="${v.hp}" aria-valuemin="0" aria-valuemax="${v.maxHp}" data-value="hp">PV <b>${v.hp}</b><small>/ ${v.maxHp}</small></span><span role="meter" aria-label="${escape(v.name)}: Secundaria" aria-valuenow="${v.sec}" aria-valuemin="0" aria-valuemax="${v.maxSec}" data-value="sec">SEC <b>${v.sec}</b><small>/ ${v.maxSec}</small></span></div>
    </div>
  </div>`;
}
/** Moves the waves and numbers of an existing plate; the trail lags behind, so each hit shows. */
export function setVitals(plate: Element, hp: number, maxHp: number, sec: number, maxSec: number) {
  for (const [bar, value, max] of [['hp', hp, maxHp], ['sec', sec, maxSec]] as const) {
    const ratio = max ? value / max : 0;
    plate.querySelectorAll<SVGPathElement>(`[data-bar="${bar}"]`).forEach(path => { path.style.strokeDasharray = `${(ratio * 100).toFixed(1)} 1000`; });
    const label = plate.querySelector(`[data-value="${bar}"]`);
    if (!label) continue;
    label.setAttribute('aria-valuenow', String(value)); label.setAttribute('aria-valuemax', String(max));
    label.querySelector('b')!.textContent = String(value); label.querySelector('small')!.textContent = `/ ${max}`;
    plate.classList.toggle(`is-low-${bar}`, ratio > 0 && ratio <= .3);
  }
}
/** Lights an avatar up in the ánima's colour (or plain light when it is taken off). */
export function flashAnima(el: Element | null, colour?: string) {
  if (!(el instanceof HTMLElement)) return;
  el.style.setProperty('--flash', colour ?? '#f3efdc');
  el.classList.remove('anima-flash'); void el.offsetWidth; el.classList.add('anima-flash');
  setTimeout(() => el.classList.remove('anima-flash'), 1300);
}
