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
import { createTravelUI } from './travel-ui';
import { STATION_PLACES, entranceId } from './transit';
import { cityMarkers } from './map-markers';
import { palaceGuards } from './battle';
import { HOUSE_LIGHTS, createHomeLights, lampInteraction, lightById, nextLamp } from './home-lights';
import { mountHomeLightsPage } from './home-lights-ui';

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
// Chapter 2: the station map (metro and Rodalies) and the TV news.
const travelUI = createTravelUI(document.querySelector<HTMLElement>('#hud')!);
const hud = document.querySelector<HTMLElement>('#hud')!;
// The bulbs at home (docs/home-lights.md): they follow the place and the fights once connected in the menu.
const homeLights = createHomeLights();
// Development: ?story=<flag> starts with every flag up to that one (just dev-chapter), ?story=new from scratch.
const devStory = (() => {
  if (!import.meta.env.DEV) return undefined;
  const at = new URLSearchParams(location.search).get('story');
  if (at === null) return undefined;
  return STORY_FLAGS.slice(0, (STORY_FLAGS as readonly string[]).indexOf(at) + 1);
})();
const story = new Story(devStory ?? []);
// Development: ?day=<n> starts chapter 2 on that day, to see the Queen's spread (just dev-day).
if (import.meta.env.DEV) {
  const day = Number(new URLSearchParams(location.search).get('day'));
  if (Number.isInteger(day) && day > 1) story.days.clock.day = day;
}
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
/** What was last sent: the flags and the days (a new hour is worth saving too). */
const progress = () => JSON.stringify([story.saved, story.days]);
let savedStory = progress();
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
    if (!devStory && Array.isArray(state.story)) { story.merge(state.story); story.loadDays(state.days, state.story); savedStory = progress(); restoreLoadout(); }
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
      body: JSON.stringify({ score: previousScore + sessionSteps, story: devStory ? [] : story.saved, ...(devStory ? {} : { days: story.days }) }), keepalive: true,
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
    change: async (state, effect, onImpact) => {
      // With the bulbs connected a hit may wait a moment, so it lands as they flash.
      const hold = homeLights.battle(state, effect);
      if (hold) await new Promise(resolve => setTimeout(resolve, hold));
      return game.setBattle(state, effect, onImpact);
    },
    target: id => game.selectTarget(id),
    awaken: id => { game.awaken(id); storyEvent({ type: 'class', id }); },
    driver: id => battleDriver(control, id),
    waiting: id => waitingForPlayer2(control, id),
  });
  /** Re-applies who drives Aitor after the mode or the second controller changes. */
  function controlChanged() {
    game.setPartnerDriven(partnerDriven(control, story.partner));
    battleUI.refresh();
  }
  const exploration = createExplorationUI(document.querySelector<HTMLElement>('#hud')!, paused => game.setPaused(paused), () => controller.open(), story,
    (member, classId) => { if (story.wear(member, classId)) { keepLoadout(); storyChanged(); } });
  let currentLocation: EnvironmentId = story.resume.environment;
  // Story beats play one after another: a dialogue waits for its last line, a card for its fade.
  let beats = Promise.resolve();
  const learned: Partial<Record<string, () => boolean>> = {
    move: () => sessionSteps > 0,
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
    else if (effect.kind === 'battle') { if (effect.encounter === 'dogs') game.encounter(true); else game.startPalaceFight(effect.encounter); }
    else if (effect.kind === 'palace') { await game.raisePalace(); storyEvent({ type: 'palace' }); }
    else if (effect.kind === 'gate') await game.popGate();
    else if (effect.kind === 'travel') game.setEnvironment(effect.environment, effect.cell);
    else if (effect.kind === 'drain') await game.riseFromDrain();
    else if (effect.kind === 'ambush') { await game.ambush(() => storyUI.blackout(true, 1400)); storyEvent({ type: 'caught' }); }
    else if (effect.kind === 'wake') await game.wake(() => storyUI.blackout(false, 2000));
    else if (effect.kind === 'fall') { homeLights.moment('fall'); await storyUI.blackout(true, 1600); }
    else if (effect.kind === 'news') await watchNews();
    else if (effect.kind === 'metro') await ride(effect.station);
    else if (effect.kind === 'look') await game.look(effect.anchor);
    else if (effect.kind === 'doom') { homeLights.moment('doom'); await theEnd(); }
    else { game.setPaused(true); await storyUI.card(effect.id); game.setPaused(!!exploration.active); }
  }
  /**
   * Watching the TV in the flat: the camera comes close to its screen, where the news loops
   * (src/news-tv.ts), until a key, a click or a button looks away. It never covers the game.
   */
  let lookAway: (() => void) | undefined;
  async function watchNews() {
    exploration.close();
    game.watchTV(true); hud.dataset.watching = 'true'; homeLights.moment('tv');
    interactButton.hidden = false; interactButton.querySelector('span')!.textContent = 'Dejar de mirar';
    const shown = performance.now();
    await new Promise<void>(resolve => {
      const done = () => { if (performance.now() - shown < 1200) return; window.removeEventListener('keydown', key, { capture: true }); canvas.removeEventListener('click', done); lookAway = undefined; resolve(); };
      const key = (event: KeyboardEvent) => {
        if (!['KeyE', 'Space', 'Enter', 'Escape'].includes(event.code)) return;
        event.preventDefault(); event.stopImmediatePropagation(); if (!event.repeat) done();
      };
      window.addEventListener('keydown', key, { capture: true }); canvas.addEventListener('click', done);
      lookAway = done;
    });
    delete hud.dataset.watching; interactButton.hidden = true;
    game.watchTV(false); homeLights.moment('tv-off');
  }
  /**
   * The end: she has covered everything. The only way on is back to the morning before; that
   * day's progress is lost (docs/chapter-2.md § The Queen's advance).
   */
  async function theEnd() {
    game.setPaused(true);
    await storyUI.doom();
    const effects = story.rewind();
    storyChanged();
    for (const effect of effects) await play(effect);
    game.setPaused(!!exploration.active);
  }
  /** Down into a station: pick a destination on the network map, ride, and come up its entrance. */
  async function ride(from: string) {
    exploration.close(); game.setPaused(true);
    const to = await travelUI.show(from, {}, cityMarkers({ castle: story.has('tv-news'), threat: story.castleThreat, spread: Math.min(1, story.spread) }));
    const place = to ? STATION_PLACES[to] : undefined;
    const entrance = place && ENVIRONMENTS[place.environment].interactions.find(i => i.id === entranceId(to!));
    if (place && entrance) {
      await storyUI.blackout(true, 450);
      game.setEnvironment(place.environment, entrance.cell);
      await storyUI.blackout(false, 650);
    }
    game.setPaused(!!exploration.active);
    if (to) storyEvent({ type: 'arrive', station: to });
  }
  function storyChanged() {
    game.refreshStory();
    game.setPartnerDriven(partnerDriven(control, story.partner));
    // The active class dresses the whole interface (style.css: #hud[data-class]).
    if (story.gerardClass) hud.dataset.class = story.gerardClass; else delete hud.dataset.class;
    exploration.refresh();
    const saved = progress();
    if (saved !== savedStory) { savedStory = saved; dirty = true; clearTimeout(saveTimer); void save(); }
  }
  function storyEvent(event: StoryEvent) {
    const effects = story.handle(event);
    storyChanged();
    beats = beats.then(async () => { for (const effect of effects) await play(effect); });
  }
  const game = createGame(canvas, {
    onEncounter: (withPartner, foes, options) => { exploration.close(); dialogue.close(); battleUI.open(story.battleParty(withPartner), foes, { ...options, guards: palaceGuards(story.animas.length) }); },
    // Backing off is neither a win nor a fall.
    onBattleEnd: (phase, encounter) => { if (phase !== 'escaped') storyEvent({ type: 'battle', won: phase === 'won', encounter }); },
    onBattleTargets: targets => battleUI.positionTargets(targets),
    onCompanionScreen: at => storyUI.bubble(dialogue.open || exploration.active ? undefined : story.bubble ?? game.partnerLine, at),
    onStep: (steps, cell) => {
      sessionSteps = steps;
      exploration.update(currentLocation, cell, steps);
      dirty = true;
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => { void save(); }, 700);
    },
    onLocation: (id, cell) => {
      currentLocation = id;
      homeLights.setPlace(id);
      exploration.update(id, cell);
      environmentSelect.value = id;
      const geo = ENVIRONMENTS[id].geo;
      // Chapter 2's palace stands on the Rec Comtal school, not at the end of Passatge Maresme.
      const school = id === 'palacio' && story.adult;
      document.querySelector('.place-panel .eyebrow')!.textContent = id === 'patio' ? 'PRUEBA DE MOVIMIENTO' : id === 'meridiana' ? 'BARCELONA' : school ? 'TRINITAT VELLA, BARCELONA' : geo ? geo.region.toUpperCase() : 'SANT QUIRZE DEL VALLÈS';
      document.querySelector('#location-detail')!.textContent = geo ? `Según el mapa · ${geo.attribution}` : id === 'meridiana' ? 'Avinguda Meridiana · Según el croquis de casa'
        : ENVIRONMENTS[id].plan ? 'Passatge Maresme, 20 · Según el plano de la familia'
        : id === 'maresme' ? 'Reconstrucción aproximada · Nº 20' : school ? 'Sobre la escuela Rec Comtal' : id === 'palacio' ? 'Al final de Passatge Maresme' : 'Escena de prueba de movimiento';
      document.querySelector('#overview')!.firstChild!.textContent = ENVIRONMENTS[id].zoom ? 'Vista general ' : 'Centrar vista ';
      document.title = `${ENVIRONMENTS[id].name} · Gerard 35`;
    },
    onInteraction: interaction => {
      interactButton.hidden = !interaction;
      interactButton.querySelector('span')!.textContent = interaction?.label ?? '';
    },
    onDialogue: dialogue.show,
    // A lamp in the Meridiana flat goes to its next look, in the game and at home.
    onStory: event => {
      const lamp = event.type === 'interact' ? lampInteraction(event.id) : undefined;
      if (lamp) homeLights.setLamp(lamp, nextLamp(homeLights.flat[lamp]).lamp); else storyEvent(event);
    },
  }, story);
  for (const light of HOUSE_LIGHTS) game.setLamp(light.id, homeLights.flat[light.id]);
  homeLights.onFlat((id, lamp) => game.setLamp(id, lamp));
  game.setLampLabels(id => {
    const lamp = lampInteraction(id);
    return lamp ? `${nextLamp(homeLights.flat[lamp]).verb} ${lightById(lamp).name}` : undefined;
  });
  // Her light and the evening fade in over seconds; the bulbs follow in steps.
  const followMood = () => homeLights.setMood({ tone: game.lightTone, dusk: story.dusk });
  followMood();
  const moodTimer = setInterval(followMood, 1000);
  const controllerContext = () => battleUI.controllerContext !== 'world' ? battleUI.controllerContext
    : travelUI.open ? 'travel' : lookAway ? 'news' : storyUI.doomOpen ? 'doom'
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
    lights: section => mountHomeLightsPage(section, homeLights),
    action: (action, player) => {
      // Player 2 plays Aitor: his turns in battle, the dialogue, and using things where he stands.
      if (travelUI.open) { if (action !== 'overview' && action !== 'character') travelUI.control(action); return; }
      if (lookAway) { if (action === 'confirm' || action === 'cancel') lookAway(); return; }
      if (storyUI.doomOpen) { if (action === 'confirm') storyUI.confirmDoom(); return; }
      if (player === 2) {
        if (action === 'overview' || action === 'character') return;
        if (battleUI.controllerContext !== 'world') battleUI.control(action, 2);
        else if (dialogue.open) { if (action === 'confirm') dialogue.advance(); }
        else if (!exploration.active && action === 'confirm') game.interact(true);
        return;
      }
      if (action === 'overview') { if (controllerContext() === 'world') game.toggleOverview(); }
      else if (action === 'character') { if (/^(world|journal:)/.test(controllerContext())) exploration.toggle('character'); }
      else if (battleUI.controllerContext !== 'world') battleUI.control(action, 1);
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
    // ?battle=3&allies=2 fights with chapter 1's boys; ?battle=3&party=adult with Gerard at 35 and Aitor.
    if ([2, 3, 4].includes(foes)) requestAnimationFrame(() => battleUI.open(params.get('party') === 'adult' ? new Story(['caught', 'noista']).battleParty(true) : params.get('allies') === '2' ? 2 : 1, foes));
    // Handle for scripted browser checks, e.g. teleporting to a story beat.
    Object.assign(window, { gerard: { game, story, battleUI, control, controlChanged, storyEvent, travelUI, homeLights } });
  }
  if (import.meta.hot) import.meta.hot.dispose(() => { clearInterval(moodTimer); homeLights.release(); travelUI.destroy(); controller.destroy(); exploration.destroy(); battleUI.destroy(); storyUI.destroy(); game.app.destroy(); });
} catch (error) {
  console.error('No se pudo crear la escena', error);
  document.querySelector<HTMLElement>('#error')!.hidden = false;
}
// Wait briefly for saved progress, so a returning player resumes where they left off.
void load().then(() => startStory?.());
