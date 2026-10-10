import { createControllerUI } from './controller-ui';
import { createExplorationUI } from './exploration-ui';
import { createGame } from './game';
import { type Direction } from './movement';
import { ENVIRONMENTS, type EnvironmentId } from './environments';
import { createDialogueBanner } from './dialogue';
import { createBattleUI } from './battle-ui';
import { Story, STORY_FLAGS, type StoryEffect, type StoryEvent } from './story';
import { createStoryUI } from './story-ui';

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
// Development: ?story=<flag> starts with every flag up to that one (just dev-chapter), ?story=new from scratch.
const devStory = (() => {
  if (!import.meta.env.DEV) return undefined;
  const at = new URLSearchParams(location.search).get('story');
  if (at === null) return undefined;
  return STORY_FLAGS.slice(0, (STORY_FLAGS as readonly string[]).indexOf(at) + 1);
})();
const story = new Story(devStory ?? []);
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
    if (!devStory && Array.isArray(state.story)) { story.merge(state.story); savedStory = JSON.stringify(story.saved); }
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
  });
  const exploration = createExplorationUI(document.querySelector<HTMLElement>('#hud')!, paused => game.setPaused(paused), () => controller.open(), story);
  let currentLocation: EnvironmentId = story.resume.environment;
  // Story beats play one after another: a dialogue waits for its last line, a card for its fade.
  let beats = Promise.resolve();
  const learned: Partial<Record<string, () => boolean>> = {
    move: () => sessionSteps > 0,
    run: () => game.running,
    items: () => exploration.active === 'items',
    party: () => exploration.active === 'character',
  };
  async function play(effect: StoryEffect) {
    if (effect.kind === 'dialogue') await new Promise<void>(resolve => dialogue.show(effect.dialogue, resolve));
    else if (effect.kind === 'item') storyUI.item(effect.item);
    else if (effect.kind === 'hint') storyUI.hint(effect.id, learned[effect.id]);
    else { game.setPaused(true); await storyUI.card(effect.id); game.setPaused(!!exploration.active); }
  }
  function storyChanged() {
    game.refreshStory();
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
    onEncounter: (allies, foes) => { exploration.close(); dialogue.close(); battleUI.open(allies, foes); },
    onBattleTargets: targets => battleUI.positionTargets(targets),
    onCompanionScreen: at => storyUI.bubble(dialogue.open || exploration.active ? undefined : story.bubble, at),
    onStep: (steps, cell) => {
      sessionSteps = steps;
      exploration.update(currentLocation, cell, steps);
      dirty = true;
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => { void save(); }, 700);
    },
    onLocation: (id, cell) => {
      currentLocation = id;
      exploration.update(id, cell);
      environmentSelect.value = id;
      document.querySelector('.place-panel .eyebrow')!.textContent = id === 'patio' ? 'PRUEBA DE MOVIMIENTO' : id === 'meridiana' ? 'BARCELONA' : 'SANT QUIRZE DEL VALLÈS';
      document.querySelector('#location-detail')!.textContent = id === 'meridiana' ? 'Avinguda Meridiana · Según el croquis de casa'
        : ENVIRONMENTS[id].plan ? 'Passatge Maresme, 20 · Según el plano de la familia'
        : id === 'maresme' ? 'Reconstrucción aproximada · Nº 20' : 'Escena de prueba de movimiento';
      document.querySelector('#overview')!.firstChild!.textContent = ENVIRONMENTS[id].zoom ? 'Vista general ' : 'Centrar vista ';
      document.title = `${ENVIRONMENTS[id].name} · Gerard 35`;
    },
    onInteraction: interaction => {
      interactButton.hidden = !interaction;
      interactButton.querySelector('span')!.textContent = interaction?.label ?? '';
    },
    onDialogue: dialogue.show,
    onStory: storyEvent,
  }, story);
  const controllerContext = () => battleUI.controllerContext !== 'world' ? battleUI.controllerContext
    : dialogue.open ? 'dialogue' : exploration.active ? `journal:${exploration.active}` : 'world';
  const controller = createControllerUI({
    context: controllerContext,
    direction: (direction, stick, running) => controllerContext() === 'world' ? game.setControllerInput(direction, stick, running) : game.setControllerInput(null, null),
    pause: value => game.setPaused(value || !!exploration.active),
    panel: id => id ? exploration.show(id) : exploration.close(),
    action: action => {
      if (action === 'overview') { if (controllerContext() === 'world') game.toggleOverview(); }
      else if (action === 'character') { if (/^(world|journal:)/.test(controllerContext())) exploration.toggle('character'); }
      else if (battleUI.controllerContext !== 'world') battleUI.control(action);
      else if (dialogue.open) { if (action === 'confirm') dialogue.advance(); else if (action === 'cancel') dialogue.close(); }
      else if (exploration.active) exploration.control(action);
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
    if ([2, 3, 4].includes(foes)) requestAnimationFrame(() => battleUI.open(params.get('allies') === '2' ? 2 : 1, foes));
    // Handle for scripted browser checks, e.g. teleporting to a story beat.
    Object.assign(window, { gerard: { game, story } });
  }
  if (import.meta.hot) import.meta.hot.dispose(() => { controller.destroy(); exploration.destroy(); battleUI.destroy(); storyUI.destroy(); game.app.destroy(); });
} catch (error) {
  console.error('No se pudo crear la escena', error);
  document.querySelector<HTMLElement>('#error')!.hidden = false;
}
// Wait briefly for saved progress, so a returning player resumes where they left off.
void load().then(() => startStory?.());
