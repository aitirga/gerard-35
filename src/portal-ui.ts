/**
 * Bernat's model of the flat (docs/quests/bernat.md, rounds 6 and 7): Gerard leans over it on his
 * table and the camera looks down at it from above (`game.maqueta`). Over it, the sheet that came
 * with it: not a word, each lamp drawn as its name (`SHEET_ICONS`: the moon a moon, the table a
 * table), joined by + − =, the moon with a question mark. The model lights the lamps of the sum in
 * their colours, and so does the real flat; the sheet never says which.
 *
 * The model only shows (Aitor, 2026-11-20): nothing on it can be changed. It reads the flat's lamps,
 * and the flat reads the house's bulbs while he leans over it, so the moon has to be set **at home**:
 * with Siri, the LIFX app, a switch, or the lamp itself in the game's flat. Pressing a lamp on the
 * model only stirs its drawing on the sheet. Once the moon (`luna`) has held a colour for five
 * seconds every lamp of the model blinks green or red, and so does the house. A lamp of the sum
 * changed at home goes back to its colour. Four sums, then the performance: every lamp goes off,
 * one after another, the estudio turns green, and the artilugio, awake, beeps.
 *
 * The rule (what mixes into what) is `src/friends/bernat.ts`; the model and its camera, `src/game.ts`.
 */
import { isDpad, type ControllerEvent } from './controller';
import { ANSWER_LAMP, HIDING_LAMP, HIDING_LIGHT, HOLD_SECONDS, LAMPS, PORTAL_LEVELS, SHEET_ICONS, lampColour, type PortalLevel } from './friends/bernat.ts';
import { HOUSE_LIGHTS, OFF, hex, type HomeLights, type Lamp, type LightId } from './home-lights.ts';
import type { SoundId } from './sfx';

/** What the riddle needs of the model on the table (`game.maqueta`, src/game.ts). */
export interface Maqueta {
  readonly here: boolean;
  /** The camera looks down at it (true) or goes back to Gerard. */
  view(on: boolean): void;
  /** Where a lamp of the model is on the canvas now (CSS pixels). */
  screen(id: LightId): { x: number; y: number } | undefined;
  /** Every lamp of the model blinks a colour, then shows the flat's again. */
  blink(lamp: Lamp, times?: number, period?: number): void;
}

/** The moon once a sum is solved: off, keeping a colour that is no answer, so the next sum starts clean. */
const MOON_START: Lamp = { ...LAMPS.rojo, on: false };
/** After a right sum, how long the house shows it before the next one (ms); between the lamps going off at the end. */
const NEXT_MS = 2600, OFF_STEP_MS = 650;
/** How long a lamp of the sum changed at home stays so before it goes back to its colour (ms). */
const RESTORE_MS = 1500;
/** How the model answers a held moon. */
const RIGHT = hex('#2bff6a', 1), WRONG = hex('#ff2a1f', 1);
/** How near (CSS px) the pointer must be to a lamp of the model to press it. */
const REACH_PX = 46;


const STYLE = `
#hud[data-maqueta] > :not(#portal-box) { visibility: hidden; }
#portal-box { position: absolute; inset: 0; z-index: 40; pointer-events: auto; outline: none; user-select: none; }
#portal-box[data-pointing] { cursor: pointer; }
#portal-box .portal-sheet { position: absolute; left: 50%; top: 18px; transform: translateX(-50%) rotate(-.6deg); display: grid; justify-items: center; gap: 8px;
  padding: 14px 22px 12px; border: 1px solid #e8dcc055; border-radius: 3px; color: #2b241c; box-shadow: 8px 8px 0 #07141bb0;
  background: #f3ecd9 repeating-linear-gradient(#f3ecd9 0 23px, #ddd2b6 23px 24px); animation: portal-in .5s .35s cubic-bezier(.2, .8, .25, 1) both; }
#portal-box .portal-sheet[data-turn] { animation: portal-turn .45s cubic-bezier(.2, .8, .25, 1) both; }
#portal-box .portal-sheet[data-shake] { animation: portal-shake .42s ease both; }
#portal-box .portal-sheet[data-gone] { animation: portal-out .5s ease both; }
@keyframes portal-in { from { opacity: 0; transform: translate(-50%, -30px) rotate(-3deg); } }
@keyframes portal-turn { from { opacity: 0; transform: translate(-50%, -10px) rotate(1deg); } }
@keyframes portal-out { to { opacity: 0; transform: translate(-50%, -24px) rotate(-2deg); } }
@keyframes portal-shake { 20% { transform: translate(calc(-50% - 7px), 0) rotate(-1deg); } 45% { transform: translate(calc(-50% + 6px), 0) rotate(0deg); } 70% { transform: translate(calc(-50% - 3px), 0) rotate(-.8deg); } }
#portal-box .portal-sum { display: flex; align-items: center; gap: 14px; padding: 2px 6px; }
#portal-box figure { margin: 0; padding: 6px; border-radius: 6px; transition: background .2s; }
#portal-box figure[data-nudge] { animation: portal-nudge .4s ease; background: #c9a24a33; }
@keyframes portal-nudge { 30% { transform: translateY(-4px) rotate(-2deg); } 65% { transform: translateY(1px) rotate(1deg); } }
#portal-box figure svg { display: block; width: 76px; height: 76px; overflow: visible; fill: #2b241c; }
#portal-box figure[data-answer] svg > g { fill: #f3ecd9; stroke: #2b241c; stroke-width: .9; stroke-dasharray: 1.6 1.1; stroke-linejoin: round; }
#portal-box figure[data-answer] text { font: 700 9px Georgia, 'Times New Roman', serif; text-anchor: middle; fill: #2b241c; }
#portal-box .portal-op { font: 400 40px/1 Georgia, 'Times New Roman', serif; color: #2b241c; padding-bottom: 4px; }
#portal-box .portal-steps { display: flex; gap: 7px; }
#portal-box .portal-steps i { width: 8px; height: 8px; border-radius: 50%; border: 1px solid #2b241c88; }
#portal-box .portal-steps i[data-done] { background: #2b241c; }
#portal-box .portal-steps i[data-now] { background: #c9a24a; }
#portal-box .portal-help { position: absolute; left: 50%; bottom: 18px; transform: translateX(-50%); width: min(760px, calc(100% - 32px)); }
@media (prefers-reduced-motion: reduce) { #portal-box .portal-sheet, #portal-box figure { animation: none !important; } }
`;

export interface PortalUI {
  /** Leans over the model at the sum it was left at. Resolves true once the four are solved and the performance has run, false if he steps back first. */
  open(): Promise<boolean>;
  readonly isOpen: boolean;
  /** A press from a pad (or the keys, through the controller's own routing). */
  control(action: ControllerEvent): void;
  destroy(): void;
}

/**
 * `maqueta` is the model on the table now, if any; `wake` makes the real artilugio sound
 * (src/artilugio.ts `listen`); `sound` plays the game's own cues; `pause` holds the game still.
 */
export function createPortalUI(hud: HTMLElement, lights: HomeLights, maqueta: () => Maqueta | undefined, wake: () => void, sound: (id: SoundId) => void, pause: (paused: boolean) => void): PortalUI {
  const style = document.createElement('style'); style.textContent = STYLE; document.head.append(style);
  const root = document.createElement('section');
  root.id = 'portal-box'; root.hidden = true; root.tabIndex = -1;
  root.setAttribute('role', 'dialog'); root.setAttribute('aria-label', 'La maqueta de Bernat');
  root.innerHTML = `<div class="portal-sheet" aria-hidden="true"></div>
    <footer class="parcelas-help portal-help">
      <button type="button" class="journal-close" data-portal-close data-back>Volver <kbd data-glyph="cancel"></kbd></button>
    </footer>`;
  hud.append(root);
  const sheet = root.querySelector<HTMLElement>('.portal-sheet')!;
  let level = 0, open = false, settling = false;
  /** What the open model is doing now: its clock, and how it closes. */
  let session: { finish: (solved: boolean) => void; held?: ReturnType<typeof setTimeout> } | undefined;
  /** A lamp of the sum changed at home, waiting to go back to its colour. */
  const restoring = new Map<LightId, ReturnType<typeof setTimeout>>();

  const model = () => maqueta();
  const sumNow = () => level < PORTAL_LEVELS.length ? PORTAL_LEVELS[level] : undefined;
  /** A lamp drawn as its name: in ink when it is part of the sum, outlined with a question mark where the answer goes. */
  function figure(id: LightId, answer: boolean) {
    const icon = SHEET_ICONS[id] ?? '<circle cx="12" cy="12" r="7"/>';
    return `<figure data-lamp="${id}" ${answer ? 'data-answer' : ''}><svg viewBox="0 0 24 24"><g>${icon}</g>${answer ? '<text x="17" y="11.5">?</text>' : ''}</svg></figure>`;
  }
  function draw(sum: PortalLevel, turn = false) {
    const op = (sign: number) => `<span class="portal-op">${sign > 0 ? '+' : '−'}</span>`;
    sheet.innerHTML = `<div class="portal-sum">${figure(ANSWER_LAMP, true)}<span class="portal-op">=</span>`
      + sum.terms.map((t, i) => `${i ? op(t.sign) : t.sign < 0 ? op(-1) : ''}${figure(t.lamp, false)}`).join('') + `</div>`
      + `<div class="portal-steps">${PORTAL_LEVELS.map((_, i) => `<i ${i < level ? 'data-done' : i === level ? 'data-now' : ''}></i>`).join('')}</div>`;
    sheet.removeAttribute('data-shake'); sheet.removeAttribute('data-gone');
    if (turn) { sheet.removeAttribute('data-turn'); void sheet.offsetWidth; sheet.dataset.turn = ''; }
  }
  /**
   * The house at the start of a sum: its lamps lit in their colours and the others off, so the mix
   * reads. The moon is left as the house has it: it is his, and he sets it at home.
   */
  function setUp(sum: PortalLevel) {
    for (const light of HOUSE_LIGHTS) {
      if (light.id === ANSWER_LAMP) continue;
      const term = sum.terms.find(t => t.lamp === light.id);
      if (term ? lampColour(lights.flat[light.id]) !== term.colour : lights.flat[light.id]?.on) lights.setLamp(light.id, term ? LAMPS[term.colour] : OFF);
    }
  }
  /** A lamp of the sum changed at home: after a moment it goes back to its colour, and its drawing stirs. */
  function keep(id: LightId, lamp: Lamp) {
    const term = sumNow()?.terms.find(t => t.lamp === id);
    clearTimeout(restoring.get(id)); restoring.delete(id);
    if (!term || settling || lampColour(lamp) === term.colour) return;
    restoring.set(id, setTimeout(() => {
      restoring.delete(id);
      const now = sumNow()?.terms.find(t => t.lamp === id);
      if (open && now && !settling && lampColour(lights.flat[id]) !== now.colour) { lights.setLamp(id, LAMPS[now.colour]); nudge(id); }
    }, RESTORE_MS));
  }
  /** Each lamp of the model where it is on the page now. */
  function onPage() {
    const canvas = document.querySelector<HTMLElement>('#game')?.getBoundingClientRect(), box = root.getBoundingClientRect();
    const out: { id: LightId; x: number; y: number }[] = [];
    for (const light of HOUSE_LIGHTS) {
      const at = model()?.screen(light.id);
      if (at) out.push({ id: light.id, x: at.x + (canvas?.left ?? 0) - box.left, y: at.y + (canvas?.top ?? 0) - box.top });
    }
    return out;
  }
  /** The lamp nearest a point on the page, if one is within reach. */
  function pick(x: number, y: number) {
    let best: { id: LightId; d: number } | undefined;
    for (const p of onPage()) {
      const d = Math.hypot(p.x - x, p.y - y);
      if (d < REACH_PX && (!best || d < best.d)) best = { id: p.id, d };
    }
    return best?.id;
  }
  /** A lamp pressed on the model: its drawing on the sheet stirs, if it has one; nothing on the model can be changed. */
  function nudge(id: LightId) {
    for (const el of sheet.querySelectorAll<HTMLElement>(`figure[data-lamp="${id}"]`)) {
      el.removeAttribute('data-nudge'); void el.offsetWidth; el.dataset.nudge = '';
      setTimeout(() => el.removeAttribute('data-nudge'), 420);
    }
  }
  function control(action: ControllerEvent) {
    if (!open || !session) return;
    if (action === 'cancel' || action === 'menu') { if (!settling) session.finish(false); }
    else if (isDpad(action)) return;
  }
  // The pointer: a lamp of the model pressed only stirs its drawing; the lamps are changed at home.
  const local = (event: MouseEvent) => { const box = root.getBoundingClientRect(); return { x: event.clientX - box.left, y: event.clientY - box.top }; };
  root.addEventListener('pointermove', event => {
    if (!open) return;
    const { x, y } = local(event);
    root.toggleAttribute('data-pointing', !!pick(x, y));
  });
  root.addEventListener('pointerdown', event => {
    if (!open || (event.target as HTMLElement).closest('.portal-help')) return;
    const { x, y } = local(event), id = pick(x, y);
    if (!id || event.button === 1) return;
    event.preventDefault();
    nudge(id); sound('ui-move');
  });
  root.addEventListener('contextmenu', event => event.preventDefault());
  root.addEventListener('click', event => { if ((event.target as HTMLElement).closest('[data-portal-close]') && !settling) session?.finish(false); });
  // Ahead of the game and the menu: while he leans over the model its keys are its own.
  function keydown(event: KeyboardEvent) {
    if (!open || document.querySelector('dialog[open]')) return;
    const keys: Record<string, ControllerEvent> = { Escape: 'cancel' };
    const action = keys[event.code];
    // Every other key stays here too, so walking keys do not move Gerard under the model (the
    // browser's own shortcuts still pass).
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    event.preventDefault(); event.stopImmediatePropagation();
    if (action) control(action);
  }
  window.addEventListener('keydown', keydown, { capture: true });

  return {
    get isOpen() { return open; },
    control,
    open() {
      const here = model();
      if (open || !here?.here || level >= PORTAL_LEVELS.length) return Promise.resolve(false);
      open = true; settling = false;
      root.hidden = false; hud.dataset.maqueta = 'open'; pause(true);
      lights.portal(true); here.view(true);
      root.focus({ preventScroll: true });
      return new Promise<boolean>(resolve => {
        const timers: ReturnType<typeof setTimeout>[] = [];
        const later = (ms: number, run: () => void) => { timers.push(setTimeout(run, ms)); };
        const start = (turn = false) => { const sum = PORTAL_LEVELS[level]; setUp(sum); draw(sum, turn); };
        // The moon held on a colour for HOLD_SECONDS: the house answers. Set at home (or already set
        // when he leans over the model), it is read from the flat, which reads the bulbs.
        const watch = (lamp: Lamp) => {
          if (settling || !session || level >= PORTAL_LEVELS.length) return;
          clearTimeout(session.held);
          if (!lamp.on || !lampColour(lamp)) return;
          session.held = setTimeout(() => {
            const sum = PORTAL_LEVELS[level], right = lampColour(lights.flat[ANSWER_LAMP]) === sum.answer;
            model()?.blink(right ? RIGHT : WRONG);
            lights.moment(right ? 'right' : 'wrong'); sound(right ? 'unlock' : 'denied');
            // While the model blinks (screenshots wait on it).
            root.dataset.answer = right ? 'right' : 'wrong'; later(2100, () => { delete root.dataset.answer; });
            if (!right) { sheet.removeAttribute('data-shake'); void sheet.offsetWidth; sheet.dataset.shake = ''; return; }
            settling = true; level++;
            // The moon goes off for the next sum, so the answer just given is not taken for the next.
            lights.setLamp(ANSWER_LAMP, MOON_START);
            sheet.querySelectorAll('.portal-steps i').forEach((dot, i) => { dot.toggleAttribute('data-done', i < level); dot.removeAttribute('data-now'); });
            later(NEXT_MS, () => {
              if (level < PORTAL_LEVELS.length) { settling = false; start(true); return; }
              // The performance: every lamp off, one after another; the estudio green, where it is hidden; the artilugio awake.
              sheet.dataset.gone = '';
              const order = HOUSE_LIGHTS.map(l => l.id).filter(lamp => lamp !== HIDING_LAMP);
              order.forEach((lamp, i) => later((i + 1) * OFF_STEP_MS, () => lights.setLamp(lamp, OFF)));
              later((order.length + 1) * OFF_STEP_MS, () => { lights.setLamp(HIDING_LAMP, HIDING_LIGHT); wake(); });
              later((order.length + 5) * OFF_STEP_MS, () => session?.finish(true));
            });
          }, HOLD_SECONDS * 1000);
        };
        const off = lights.onFlat((id, lamp) => { if (id === ANSWER_LAMP) watch(lamp); else keep(id, lamp); });
        session = {
          finish(solved: boolean) {
            clearTimeout(session?.held); timers.forEach(clearTimeout); off();
            for (const timer of restoring.values()) clearTimeout(timer);
            restoring.clear();
            session = undefined; open = false; settling = false;
            root.hidden = true; root.removeAttribute('data-pointing'); delete hud.dataset.maqueta;
            model()?.view(false); lights.portal(false); pause(false);
            document.querySelector<HTMLElement>('#game')?.focus({ preventScroll: true });
            resolve(solved);
          },
        };
        start();
        watch(lights.flat[ANSWER_LAMP]);
      });
    },
    destroy() { session?.finish(false); window.removeEventListener('keydown', keydown, { capture: true }); root.remove(); style.remove(); },
  };
}
