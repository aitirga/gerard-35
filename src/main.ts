import { createControllerUI } from './controller-ui';
import { createExplorationUI } from './exploration-ui';
import { createGame } from './game';
import { type Direction } from './movement';
import { ENVIRONMENTS, type EnvironmentId } from './environments';
import { createDialogueBanner } from './dialogue';
import { createBattleUI } from './battle-ui';
import { Story, STORY_FLAGS, type StoryEffect, type StoryEvent } from './story';
import { createStoryUI } from './story-ui';
import { battleDriver, partnerDriven, waitingForPlayer2, type Control, type ControlMode } from './party';
import { watchGlyphs } from './input-glyphs';
import type { MemberId } from './story';

const isMember = (id: string): id is MemberId => id === 'gerard' || id === 'bernat' || id === 'aitor';

const canvas = document.querySelector<HTMLCanvasElement>('#game')!;
let previousScore = 0;
let sessionSteps = 0;
let loaded = false;
let loading = false;
let saving = false;
let dirty = false;
let saveTimer: ReturnType<typeof setTimeout> | undefined;
const environmentSelect = document.querySelector<HTMLSelectElement>('#environment')!;
const interactButton = document.querySelector<HTMLButtonElement>('#interact')!;
const dialogue = createDialogueBanner(document.querySelector<HTMLElement>('#hud')!);
const storyUI = createStoryUI(document.querySelector<HTMLElement>('#hud')!);
const hud = document.querySelector<HTMLElement>('#hud')!;
// Every key shown in the HUD follows the device in use: keyboard and mouse, or the last pad touched.
const stopGlyphs = watchGlyphs();
// Development: ?story=<flag> starts with every flag up to that one (just dev-chapter), ?story=new from scratch.
const devStory = (() => {
  if (!import.meta.env.DEV) return undefined;
  const at = new URLSearchParams(location.search).get('story');
  if (at === null) return undefined;
  return STORY_FLAGS.slice(0, (STORY_FLAGS as readonly string[]).indexOf(at) + 1);
})();
const story = new Story(devStory ?? []);
// Who wears which class is a choice that comes and goes, so it lives in this browser, not in the story flags.
const loadoutKey = 'gerard35.loadout.v1';
function restoreLoadout() { try { story.loadout = JSON.parse(localStorage.getItem(loadoutKey) ?? '{}'); } catch { /* Storage is optional. */ } }
function keepLoadout() { try { localStorage.setItem(loadoutKey, JSON.stringify(story.loadout)); } catch { /* Storage is optional. */ } }
restoreLoadout();
/**
 * Two players from chapter 2 (docs/party.md). `solo` is for development only: player 1 also plays
 * Aitor. It comes from ?solo (just dev-solo) or the switch on the Mando page, and is remembered.
 */
const soloKey = 'gerard35.solo';
const control: Control = { mode: 'duo', secondPad: false };
if (import.meta.env.DEV) {
  const requested = new URLSearchParams(location.search).get('solo');
  try {
    if (requested !== null) localStorage.setItem(soloKey, requested === '0' ? 'duo' : 'solo');
    control.mode = localStorage.getItem(soloKey) === 'solo' ? 'solo' : 'duo';
  } catch { control.mode = requested !== null && requested !== '0' ? 'solo' : 'duo'; }
}
let savedStory = JSON.stringify(story.saved);
let startStory: (() => void) | undefined;
async function load() {
  if (loading || loaded) return;
  loading = true;
  try {
    const response = await fetch('/api/state', { signal: AbortSignal.timeout(5000) });
    if (!response.ok) throw new Error('load');
    const state = await response.json();
    if (!Number.isInteger(state.score) || state.score < 0) throw new Error('state');
    previousScore = state.score;
    // A development jump keeps its own flags instead of the saved progress.
    if (!devStory && Array.isArray(state.story)) { story.merge(state.story); savedStory = JSON.stringify(story.saved); restoreLoadout(); }
    loaded = true;
    if (dirty) void save();
  } catch {
    // Retry when connectivity returns or progress is saved again.
  } finally { loading = false; }
}
async function save() {
  if (!loaded) { await load(); return; }
  if (saving || !dirty) return;
  saving = true;
  dirty = false;
  try {
    const response = await fetch('/api/state', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ score: previousScore + sessionSteps, story: devStory ? [] : story.saved }), keepalive: true,
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) throw new Error('save');
    // A slower request may finish after the next debounce has already fired.
    if (dirty) {
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => { void save(); }, 700);
    }
  } catch {
    dirty = true;
  } finally { saving = false; }
}
window.addEventListener('online', () => { void (loaded ? save() : load()); });
document.addEventListener('visibilitychange', () => { if (document.hidden) void save(); });
window.addEventListener('pagehide', () => { void save(); });

try {
  const battleUI = createBattleUI(document.querySelector<HTMLElement>('#hud')!, {
    change: (state, effect, onImpact) => game.setBattle(state, effect, onImpact),
    target: id => game.selectTarget(id),
    awaken: id => { game.awaken(id); storyEvent({ type: 'class', id }); },
    driver: id => battleDriver(control, id),
    waiting: id => waitingForPlayer2(control, id),
    // Each fighter's pick in the fight is their pick for the adventure too.
    anima: (id, classId) => { game.changeAnima(id, classId); if (isMember(id) && story.wear(id, classId)) { keepLoadout(); storyChanged(); } },
    solo: () => control.mode === 'solo',
  });
  /** Re-applies who drives Aitor after the mode or the second controller changes. */
  function controlChanged() {
    game.setPartnerDriven(partnerDriven(control, story.partner));
    battleUI.refresh();
    exploration.relayout();
  }
  const exploration = createExplorationUI(document.querySelector<HTMLElement>('#hud')!, story, {
    pause: paused => game.setPaused(paused),
    openMenu: () => controller.open(),
    wear: (member, classId) => { if (story.wear(member, classId)) { keepLoadout(); storyChanged(); } },
    // With a second player on Aitor, each player gets their own half of the status screen.
    split: () => partnerDriven(control, story.partner),
    partner: () => game.partnerPosition,
    solo: () => control.mode === 'solo',
  });
  let currentLocation: EnvironmentId = story.resume.environment;
  // Story beats play one after another: a dialogue waits for its last line, a card for its fade.
  let beats = Promise.resolve();
  const learned: Partial<Record<string, () => boolean>> = {
    run: () => game.running,
    items: () => exploration.active === 'items',
    party: () => exploration.active === 'character',
    // Shown when Aitor joins; it goes once a second controller is there to play him.
    duo: () => control.secondPad || control.mode === 'solo',
  };
  async function play(effect: StoryEffect) {
    if (effect.kind === 'dialogue') await new Promise<void>(resolve => dialogue.show(effect.dialogue, resolve));
    else if (effect.kind === 'item') storyUI.item(effect.item);
    else if (effect.kind === 'hint') storyUI.hint(effect.id, learned[effect.id]);
    else if (effect.kind === 'minion') { await game.summonMinion(); storyEvent({ type: 'minion' }); }
    else if (effect.kind === 'battle') { if (effect.encounter === 'dogs') game.encounter(true); else game.startPalaceFight(); }
    else if (effect.kind === 'palace') { await game.raisePalace(); storyEvent({ type: 'palace' }); }
    else if (effect.kind === 'gate') await game.popGate();
    else if (effect.kind === 'travel') game.setEnvironment(effect.environment, effect.cell);
    else if (effect.kind === 'drain') await game.riseFromDrain();
    else if (effect.kind === 'ambush') { await game.ambush(() => storyUI.blackout(true, 1400)); storyEvent({ type: 'caught' }); }
    else if (effect.kind === 'wake') await game.wake(() => storyUI.blackout(false, 2000));
    else if (effect.kind === 'rise') await game.rise();
    else { game.setPaused(true); await storyUI.card(effect.id); game.setPaused(!!exploration.active); }
  }
  function storyChanged() {
    game.refreshStory();
    game.setPartnerDriven(partnerDriven(control, story.partner));
    // The active class dresses the whole interface (style.css: #hud[data-class]).
    if (story.gerardClass) hud.dataset.class = story.gerardClass; else delete hud.dataset.class;
    exploration.refresh();
    const saved = JSON.stringify(story.saved);
    if (saved !== savedStory) { savedStory = saved; dirty = true; clearTimeout(saveTimer); void save(); }
  }
  function storyEvent(event: StoryEvent) {
    const effects = story.handle(event);
    storyChanged();
    beats = beats.then(async () => { for (const effect of effects) await play(effect); });
  }
  const game = createGame(canvas, {
    onEncounter: (withPartner, foes, options) => { exploration.close(); dialogue.close(); battleUI.open(story.battleParty(withPartner), foes, { ...options, animas: story.classes }); },
    onBattleEnd: (phase, encounter) => storyEvent({ type: 'battle', won: phase === 'won', encounter }),
    onBattleTargets: targets => battleUI.positionTargets(targets),
    onCompanionScreen: at => storyUI.bubble(dialogue.open || exploration.active ? undefined : story.bubble ?? game.partnerLine, at),
    onStep: (steps, cell) => {
      sessionSteps = steps;
      exploration.update(currentLocation, cell);
      dirty = true;
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => { void save(); }, 700);
    },
    onLocation: (id, cell) => {
      currentLocation = id;
      exploration.update(id, cell);
      environmentSelect.value = id;
      const geo = ENVIRONMENTS[id].geo;
      document.querySelector('.place-panel .eyebrow')!.textContent = id === 'patio' ? 'PRUEBA DE MOVIMIENTO' : id === 'meridiana' ? 'BARCELONA' : geo ? geo.region.toUpperCase() : 'SANT QUIRZE DEL VALLÈS';
      document.querySelector('#location-detail')!.textContent = geo ? `Según el mapa · ${geo.attribution}` : id === 'meridiana' ? 'Avinguda Meridiana · Según el croquis de casa'
        : ENVIRONMENTS[id].plan ? 'Passatge Maresme, 20 · Según el plano de la familia'
        : id === 'maresme' ? 'Reconstrucción aproximada · Nº 20' : id === 'palacio' ? 'Al final de Passatge Maresme' : 'Escena de prueba de movimiento';
      document.querySelector('#overview')!.firstChild!.textContent = ENVIRONMENTS[id].zoom ? 'Vista general ' : 'Centrar vista ';
      document.title = `${ENVIRONMENTS[id].name} · Gerard 35`;
    },
    // Only the key floats beside what is within reach; the label stays for screen readers and the mouse.
    onInteraction: interaction => {
      interactButton.hidden = !interaction;
      interactButton.querySelector('span')!.textContent = interaction?.label ?? '';
      interactButton.title = interaction?.label ?? '';
    },
    onPromptScreen: at => {
      interactButton.toggleAttribute('data-offscreen', !at);
      if (at) interactButton.style.transform = `translate(${Math.round(at.x)}px, ${Math.round(at.y)}px) translate(-50%, -100%)`;
    },
    onDialogue: dialogue.show,
    onStory: storyEvent,
  }, story);
  const controllerContext = () => battleUI.controllerContext !== 'world' ? battleUI.controllerContext
    : dialogue.open ? 'dialogue' : exploration.active ? `journal:${exploration.active}` : 'world';
  const controller = createControllerUI({
    context: controllerContext,
    direction: (direction, stick, running) => controllerContext() === 'world' ? game.setControllerInput(direction, stick, running) : game.setControllerInput(null, null),
    partnerDirection: (direction, stick, running) => controllerContext() === 'world' ? game.setPartnerInput(direction, stick, running) : game.setPartnerInput(null, null),
    secondPad: id => { control.secondPad = !!id; controlChanged(); },
    mode: import.meta.env.DEV ? {
      get: () => control.mode,
      set: (mode: ControlMode) => { control.mode = mode; try { localStorage.setItem(soloKey, mode); } catch { /* Storage is optional. */ } controlChanged(); },
    } : undefined,
    pause: value => game.setPaused(value || !!exploration.active),
    panel: id => id ? exploration.show(id) : exploration.close(),
    action: (action, player) => {
      // Player 2 plays Aitor: his turns in battle, the dialogue, and using things where he stands.
      // Each player opens their own half of the status screen with the top face button.
      // In a fight the same button shows a skill's details.
      if (action === 'character') { if (battleUI.controllerContext !== 'world') battleUI.details(player); else if (/^(world|journal:)/.test(controllerContext())) exploration.control(action, player); return; }
      if (player === 2) {
        if (exploration.isOpen(2)) exploration.control(action, 2);
        else if (action === 'overview') return;
        else if (battleUI.controllerContext !== 'world') battleUI.control(action, 2);
        else if (action === 'prev' || action === 'next') return;
        else if (dialogue.open) { if (action === 'confirm') dialogue.advance(); }
        else if (!exploration.active && action === 'confirm') game.interact(true);
        return;
      }
      if (action === 'overview') { if (controllerContext() === 'world') game.toggleOverview(); }
      else if (battleUI.controllerContext !== 'world') battleUI.control(action, 1);
      else if (action === 'prev' || action === 'next') exploration.control(action, 1);
      else if (dialogue.open) { if (action === 'confirm') dialogue.advance(); else if (action === 'cancel') dialogue.close(); }
      else if (exploration.active) exploration.control(action, 1);
      else if (action === 'confirm') game.interact();
    },

  });
  environmentSelect.addEventListener('change', () => {
    dialogue.close();
    game.setEnvironment(environmentSelect.value as EnvironmentId);
    canvas.focus({ preventScroll: true });
  });
  interactButton.addEventListener('click', () => { dialogue.open ? dialogue.advance() : game.interact(); canvas.focus({ preventScroll: true }); });
  document.querySelector('#overview')!.addEventListener('click', () => game.toggleOverview());
  document.querySelectorAll<HTMLButtonElement>('[data-direction]').forEach(button => {
    button.addEventListener('pointerdown', event => {
      event.preventDefault();
      button.setPointerCapture(event.pointerId);
      game.press(button.dataset.direction as Direction);
    });
    button.addEventListener('pointerup', () => game.release());
    button.addEventListener('pointercancel', () => game.release());
    button.addEventListener('lostpointercapture', () => game.release());
    button.addEventListener('click', event => {
      // Keyboard activation has no hold, so walk briefly.
      if (event.detail === 0) { game.press(button.dataset.direction as Direction); setTimeout(() => game.release(), 180); }
    });
  });
  canvas.focus({ preventScroll: true });
  startStory = () => {
    const { environment, cell } = story.resume;
    if (story.started && environment !== currentLocation) game.setEnvironment(environment, cell);
    storyChanged();
    storyEvent({ type: 'start' });
  };
  // Repeatable desktop battle checks without affecting production or saved progress.
  if (import.meta.env.DEV) {
    const params = new URLSearchParams(location.search);
    const foes = Number(params.get('battle'));
    // ?battle=3&allies=2 fights with chapter 1's boys; ?battle=3&party=adult with Gerard at 35 and Aitor.
    const adult = new Story(['caught', 'noista']);
    if ([2, 3, 4].includes(foes)) requestAnimationFrame(() => params.get('party') === 'adult' ? battleUI.open(adult.battleParty(true), foes, { animas: adult.classes })
      : battleUI.open(params.get('allies') === '2' ? 2 : 1, foes, { animas: ['matemagico', ...(params.has('noista') ? ['noista' as const] : [])] }));
    // Handle for scripted browser checks, e.g. teleporting to a story beat.
    Object.assign(window, { gerard: { game, story, battleUI, exploration, control, controlChanged } });
  }
  if (import.meta.hot) import.meta.hot.dispose(() => { stopGlyphs(); controller.destroy(); exploration.destroy(); battleUI.destroy(); storyUI.destroy(); game.app.destroy(); });
} catch (error) {
  console.error('No se pudo crear la escena', error);
  document.querySelector<HTMLElement>('#error')!.hidden = false;
}
// Wait briefly for saved progress, so a returning player resumes where they left off.
void load().then(() => startStory?.());
