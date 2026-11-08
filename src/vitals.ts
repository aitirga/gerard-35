/**
 * The party's faces and vitals, shared by the status screen and the fights: a round avatar (with
 * the ánima's scarf over the provisional portraits) and a plate whose PV runs as a wave out of the
 * avatar, with the worn ánima's maná (what skills spend) as a row of circles under it. `setVitals` updates a plate in place so the waves glide; `flashAnima`
 * lights the avatar up when its ánima changes. Looks live in style.css (.vitals).
 */
import { SPEAKERS } from './dialogue';
import type { ProfileId } from './stats';

const escape = (text: string) => text.replace(/[&<>"]/g, c => `&#${c.charCodeAt(0)};`);
/** A scarf over a portrait (a 48×48 box with the neck at its middle), in the ánima's colour. */
const scarfArt = (colour: string) => `<svg class="portrait-scarf" viewBox="0 0 48 48" aria-hidden="true" style="--scarf:${colour}"><path d="M16.5 32.5Q24 37 31.5 32.5l.6 3.4Q24 41 15.9 35.9Z"/><circle cx="28.6" cy="36.4" r="1.7"/><path d="M27.6 37.2l2.6 6.2-2.2.5-1.7-5.9Z"/></svg>`;
const PORTRAITS: Partial<Record<ProfileId, string>> = { gerard: SPEAKERS.gerard.portrait, bernat: SPEAKERS.bernat.portrait, gerard35: SPEAKERS.gerard35.portrait, aitor: SPEAKERS.aitor.portrait };

/** Who has a portrait shows it, with the scarf of the ánima they wear; the rest, their initial. */
export function portrait(profile: ProfileId, name: string, scarf?: string) {
  const file = PORTRAITS[profile];
  if (!file) return `<span class="portrait-initial" aria-hidden="true">${escape(name[0])}</span>`;
  const image = `<img src="${import.meta.env.BASE_URL}portraits/${file}.png" alt="Retrato de ${escape(name)}"/>`;
  return scarf ? `<span class="portrait-art">${image}${scarfArt(scarf)}</span>` : image;
}

/** A gentle S-curve: PV. */
const WAVE = 'M2 10C40 1 78 19 120 10S200 1 238 10';
/** The maná circles: lit while they last, a hollow ring once spent. */
const pips = (value: number, max: number) => Array.from({ length: max }, (_, i) => `<i data-pip="${i < value ? 'full' : 'spent'}"></i>`).join('');
/** `anima` is the worn ánima's name, `colour` its colour and `scarf` its scarf (classes.ts), if any. */
export interface Vitals { id: string; name: string; profile: ProfileId; hp: number; maxHp: number; sec: number; maxSec: number; anima?: string; colour?: string; scarf?: string }
export function vitalsPlate(v: Vitals) {
  const wave = (d: string, bar: 'hp', ratio: number) => `<path class="wave-track" d="${d}"/><path class="wave-trail" data-bar="${bar}" d="${d}" pathLength="100" style="stroke-dasharray:${(ratio * 100).toFixed(1)} 1000"/><path class="wave-fill" data-bar="${bar}" d="${d}" pathLength="100" style="stroke-dasharray:${(ratio * 100).toFixed(1)} 1000"/>`;
  return `<div class="vitals" data-member="${v.id}"${v.colour ? ` style="--anima:${v.colour}"` : ''}>
    <div class="vitals-avatar">${portrait(v.profile, v.name, v.scarf)}<i class="vitals-burst" aria-hidden="true"></i></div>
    <div class="vitals-body">
      <div class="vitals-head"><strong>${escape(v.name)}</strong><span class="vitals-tag">${v.anima ? escape(v.anima.toUpperCase()) : ''}</span></div>
      <svg class="vitals-waves" viewBox="0 0 240 20" preserveAspectRatio="none" aria-hidden="true">${wave(WAVE, 'hp', v.hp / v.maxHp)}</svg>
      <div class="vitals-numbers"><span role="meter" aria-label="${escape(v.name)}: PV" aria-valuenow="${v.hp}" aria-valuemin="0" aria-valuemax="${v.maxHp}" data-value="hp">PV <b>${v.hp}</b><small>/ ${v.maxHp}</small></span><span class="vitals-anima" role="meter" aria-label="${escape(v.name)}: Maná" aria-valuenow="${v.sec}" aria-valuemin="0" aria-valuemax="${v.maxSec}" data-value="sec"${v.maxSec ? '' : ' hidden'}>MANÁ <span class="vitals-pips">${pips(v.sec, v.maxSec)}</span></span></div>
    </div>
  </div>`;
}
/**
 * Moves the wave and numbers of an existing plate (the trail lags behind, so each hit shows) and
 * lights or empties the maná circles; a circle that changes plays its spend or charge.
 */
export function setVitals(plate: Element, hp: number, maxHp: number, sec: number, maxSec: number) {
  const ratio = maxHp ? hp / maxHp : 0;
  plate.querySelectorAll<SVGPathElement>('[data-bar="hp"]').forEach(path => { path.style.strokeDasharray = `${(ratio * 100).toFixed(1)} 1000`; });
  const label = plate.querySelector('[data-value="hp"]');
  if (label) {
    label.setAttribute('aria-valuenow', String(hp)); label.setAttribute('aria-valuemax', String(maxHp));
    label.querySelector('b')!.textContent = String(hp); label.querySelector('small')!.textContent = `/ ${maxHp}`;
  }
  plate.classList.toggle('is-low-hp', ratio > 0 && ratio <= .3);
  const anima = plate.querySelector<HTMLElement>('[data-value="sec"]');
  if (!anima) return;
  anima.hidden = !maxSec;
  anima.setAttribute('aria-valuenow', String(sec)); anima.setAttribute('aria-valuemax', String(maxSec));
  const row = anima.querySelector('.vitals-pips')!;
  if (row.children.length !== maxSec) row.innerHTML = pips(sec, maxSec);
  [...row.children].forEach((pip, i) => {
    const next = i < sec ? 'full' : 'spent', el = pip as HTMLElement;
    if (el.dataset.pip === next) return;
    el.dataset.pip = next;
    el.classList.remove('is-changing'); void el.offsetWidth; el.classList.add('is-changing');
  });
  plate.classList.toggle('is-empty-sec', !!maxSec && sec === 0);
}
/** Lights an avatar up in the ánima's colour (or plain light when it is taken off). */
export function flashAnima(el: Element | null, colour?: string) {
  if (!(el instanceof HTMLElement)) return;
  el.style.setProperty('--flash', colour ?? '#f3efdc');
  el.classList.remove('anima-flash'); void el.offsetWidth; el.classList.add('anima-flash');
  setTimeout(() => el.classList.remove('anima-flash'), 1300);
}
/** What a skill spends, as maná circles ("●●"), for skill lists and details. */
export const costPips = (cost: number) => `<span class="cost-pips" role="img" aria-label="Gasta ${cost} de maná">${'<i></i>'.repeat(cost)}</span>`;
