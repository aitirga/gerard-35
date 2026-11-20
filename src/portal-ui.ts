/**
 * Bernat's box (docs/quests/bernat.md, round 5): through it, the Meridiana flat, and a page of his
 * notebook with a sum of its lamps. The game lights the lamps of the sum, in the game and at home;
 * Gerard sets the moon (`luna`) with its dial to the colour of light they make, and holds it: after
 * five seconds the whole house blinks green or red. Four sums, then the performance: every lamp goes
 * off, one after another, the bedroom turns pink, and the artilugio, awake, beeps until it is found.
 *
 * The rule (what mixes into what) is `src/friends/bernat.ts`; this is the page, the lamps and the clock.
 */
import { ANSWER_LAMP, COLOUR_WORDS, HIDING_LAMP, HIDING_LIGHT, HOLD_SECONDS, LAMPS, PORTAL_LEVELS, lampColour, type LightColour, type PortalLevel } from './friends/bernat.ts';
import { HOUSE_LIGHTS, OFF, lampRgb, type HomeLights, type Lamp, type LightId } from './home-lights.ts';

/** How each lamp is drawn on the page, and whether its name is feminine (la mesa) or not (el sofá). */
const ICONS: Partial<Record<LightId, { path: string; f: boolean; name: string }>> = {
  luna: { name: 'Luna', f: true, path: '<path d="M15 3a9 9 0 1 0 6.5 14.5A7.5 7.5 0 0 1 15 3z"/>' },
  mesa: { name: 'Mesa', f: true, path: '<path d="M7 3h10l3 8H4z"/><rect x="11" y="11" width="2" height="7"/><rect x="6.5" y="18" width="11" height="2.5" rx="1"/>' },
  cocina: { name: 'Cocina', f: true, path: '<rect x="11.2" y="1" width="1.6" height="7"/><path d="M3.5 17a8.5 8.5 0 0 1 17 0z"/><circle cx="12" cy="19" r="1.6"/>' },
  sofa: { name: 'Sofá', f: false, path: '<path d="M5 8h14a1 1 0 0 1 1 1v3H4V9a1 1 0 0 1 1-1z"/><path d="M2 11h3v3h14v-3h3v7h-2v2h-2v-2H6v2H4v-2H2z"/>' },
};
const css = (lamp: Lamp) => { const [r, g, b] = lampRgb(lamp).map(v => Math.round(v * 255)); return `rgb(${r} ${g} ${b})`; };
/** The moon before each sum: off, keeping a colour that is no answer, so the dial does not answer for him. */
const MOON_START: Lamp = { ...LAMPS.rojo, on: false };
/** After a right sum, how long the house shows it before the next one (ms); between the lamps going off at the end. */
const NEXT_MS = 2600, OFF_STEP_MS = 650;

const STYLE = `
#portal-box { position: absolute; left: 36px; top: 50%; transform: translateY(-50%); z-index: 40; width: min(440px, 40vw); padding: 20px 22px 18px;
  border: 1px solid #e8dcc055; border-radius: 3px; background: #f3ecd9; color: #2b241c; box-shadow: 8px 8px 0 #07141bb0;
  font-family: Georgia, 'Times New Roman', serif; pointer-events: auto; animation: portal-in .4s cubic-bezier(.2, .8, .25, 1) both;
  background-image: repeating-linear-gradient(#f3ecd9 0 27px, #d8cdb2 27px 28px); }
@keyframes portal-in { from { opacity: 0; transform: translate(-30px, -50%) rotate(-2deg); } }
#portal-box .portal-kicker { margin: 0; font: 600 10px/1 system-ui, sans-serif; letter-spacing: .2em; color: #8a7a5c; }
#portal-box h2 { margin: 6px 0 14px; font-size: 21px; font-weight: 600; }
#portal-box .portal-sum { display: flex; align-items: center; justify-content: center; gap: 10px; flex-wrap: wrap; padding: 6px 0 4px; }
#portal-box figure { margin: 0; display: grid; justify-items: center; gap: 4px; min-width: 66px; }
#portal-box svg { width: 46px; height: 46px; fill: var(--c, #2b241c); stroke: #2b241c; stroke-width: .9; }
#portal-box figure[data-answer] svg { stroke-dasharray: 2 1.5; }
#portal-box figcaption { font: 600 12px/1.2 system-ui, sans-serif; color: #4b4232; text-align: center; }
#portal-box .portal-op { font-size: 30px; line-height: 1; color: #2b241c; }
#portal-box .portal-steps { display: flex; gap: 6px; justify-content: center; margin-top: 12px; }
#portal-box .portal-steps i { width: 9px; height: 9px; border-radius: 50%; border: 1px solid #2b241c88; }
#portal-box .portal-steps i[data-done] { background: #2b241c; }
#portal-box .portal-steps i[data-now] { background: #c9a24a; }
#portal-box p.portal-note { margin: 12px 0 0; font: 500 13px/1.4 system-ui, sans-serif; color: #5d533f; min-height: 1.4em; text-align: center; }
@media (prefers-reduced-motion: reduce) { #portal-box { animation: none; } }
`;

export interface PortalUI {
  /** Opens the box at the sum it was left at. Resolves true once the four are solved and the performance has run, false if he steps back first. */
  open(): Promise<boolean>;
  readonly isOpen: boolean;
  destroy(): void;
}

/**
 * `dial` opens the moon's dial (the lamp picker) and says whether it is still open; `wake` makes the
 * real artilugio sound (src/artilugio.ts `listen`); `sound` plays the game's own cue.
 */
export function createPortalUI(hud: HTMLElement, lights: HomeLights, dial: { open: (id: LightId) => void; close: () => void; readonly isOpen: boolean }, wake: () => void, sound: (cue: 'right' | 'wrong') => void): PortalUI {
  const style = document.createElement('style'); style.textContent = STYLE; document.head.append(style);
  const root = document.createElement('section');
  root.id = 'portal-box'; root.hidden = true; root.setAttribute('aria-live', 'polite');
  hud.append(root);
  let level = 0, open = false;

  function figure(lamp: LightId, colour: LightColour | undefined, answer = false) {
    const icon = ICONS[lamp]!, word = colour ? COLOUR_WORDS[colour][icon.f ? 'f' : 'm'] : '?';
    return `<figure ${answer ? 'data-answer' : ''} style="--c:${colour ? css(LAMPS[colour]) : '#f3ecd9'}"><svg viewBox="0 0 24 24" aria-hidden="true">${icon.path}</svg><figcaption>${icon.name}<br>${word}</figcaption></figure>`;
  }
  function draw(sum: PortalLevel, note = '') {
    const moon = lampColour(lights.flat[ANSWER_LAMP]);
    root.innerHTML = `<p class="portal-kicker">LA LIBRETA DE BERNAT · ${sum.kind.toUpperCase()}</p><h2>Por la caja se ve vuestro piso.</h2>`
      + `<div class="portal-sum">${figure(ANSWER_LAMP, moon, true)}<span class="portal-op">=</span>`
      + sum.terms.map((t, i) => `${i ? `<span class="portal-op">${t.sign > 0 ? '+' : '−'}</span>` : t.sign < 0 ? '<span class="portal-op">−</span>' : ''}${figure(t.lamp, t.colour)}`).join('') + `</div>`
      + `<div class="portal-steps">${PORTAL_LEVELS.map((_, i) => `<i ${i < level ? 'data-done' : i === level ? 'data-now' : ''}></i>`).join('')}</div>`
      + `<p class="portal-note">${note}</p>`;
  }
  /** The house at the start of a sum: its lamps lit in their colours, the others off, the moon waiting. */
  function setUp(sum: PortalLevel) {
    for (const light of HOUSE_LIGHTS) {
      const term = sum.terms.find(t => t.lamp === light.id);
      lights.setLamp(light.id, light.id === ANSWER_LAMP ? MOON_START : term ? LAMPS[term.colour] : OFF);
    }
  }

  return {
    get isOpen() { return open; },
    open() {
      open = true; root.hidden = false; lights.portal(true);
      return new Promise<boolean>(resolve => {
        let held: ReturnType<typeof setTimeout> | undefined, frame = 0, openedAt = 0, settling = false;
        const finish = (solved: boolean) => {
          clearTimeout(held); cancelAnimationFrame(frame); off();
          if (dial.isOpen) dial.close();
          open = false; root.hidden = true; lights.portal(false);
          resolve(solved);
        };
        const start = () => {
          const sum = PORTAL_LEVELS[level];
          setUp(sum); draw(sum);
          openedAt = performance.now(); dial.open(ANSWER_LAMP);
        };
        // The moon held on a colour for HOLD_SECONDS: the house answers.
        const off = lights.onFlat((id, lamp) => {
          if (id !== ANSWER_LAMP || settling || level >= PORTAL_LEVELS.length) return;
          draw(PORTAL_LEVELS[level]);
          clearTimeout(held);
          // What the dial does as it opens (switching the moon on) is not his answer.
          if (performance.now() - openedAt < 500 || !lamp.on) return;
          held = setTimeout(() => {
            const sum = PORTAL_LEVELS[level], right = lampColour(lights.flat[ANSWER_LAMP]) === sum.answer;
            lights.moment(right ? 'right' : 'wrong'); sound(right ? 'right' : 'wrong');
            if (!right) { draw(sum, 'La casa parpadea en rojo.'); return; }
            settling = true; level++;
            draw(sum, 'La casa parpadea en verde.');
            setTimeout(() => {
              settling = false;
              if (level < PORTAL_LEVELS.length) { start(); return; }
              // The performance: every lamp off, one after another; the bedroom pink; the artilugio awake.
              if (dial.isOpen) dial.close();
              root.innerHTML = `<p class="portal-kicker">LA LIBRETA DE BERNAT</p><h2>Las luces de casa se van apagando.</h2><p class="portal-note">Solo queda una.</p>`;
              const order = HOUSE_LIGHTS.map(l => l.id).filter(id => id !== HIDING_LAMP);
              order.forEach((id, i) => setTimeout(() => lights.setLamp(id, OFF), (i + 1) * OFF_STEP_MS));
              setTimeout(() => { lights.setLamp(HIDING_LAMP, HIDING_LIGHT); wake(); }, (order.length + 1) * OFF_STEP_MS);
              setTimeout(() => finish(true), (order.length + 4) * OFF_STEP_MS);
            }, NEXT_MS);
          }, HOLD_SECONDS * 1000);
        });
        // Closing the moon's dial steps back from the box; it opens again at the same sum.
        const watch = () => { if (open && !settling && !dial.isOpen && performance.now() - openedAt > 400 && level < PORTAL_LEVELS.length) finish(false); else frame = requestAnimationFrame(watch); };
        start();
        frame = requestAnimationFrame(watch);
      });
    },
    destroy() { root.remove(); style.remove(); },
  };
}
