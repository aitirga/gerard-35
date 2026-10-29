import { createControllerUI } from './controller-ui';
import { createExplorationUI } from './exploration-ui';
import { createGame } from './game';
import { type Direction } from './movement';
import { ENVIRONMENTS, type EnvironmentId } from './environments';
import { createDialogueBanner } from './dialogue';
import { createBattleUI } from './battle-ui';
import { Story, STORY_FLAGS, type StoryEffect, type StoryEvent, type StoryFlag } from './story';
import { createStoryUI } from './story-ui';
import { battleDriver, partnerDriven, waitingForPlayer2, type Control, type ControlMode } from './party';
import { watchGlyphs } from './input-glyphs';
import type { MemberId } from './story';
import { createTravelUI } from './travel-ui';
import { STATION_PLACES, entranceId } from './transit';
import { cityMarkers } from './map-markers';
import { palaceGuards, SKILLS, type BattleEffect, type BattleState, type PartySlot } from './battle';
import { ANIMA_IDS, animaBonus, type AnimaId } from './animas';
import { flagsAt, spotAt } from './story-points';
import { createJumpMenu, validFight, type FightHelp, type FightSetup } from './jump-menu';
import { HOUSE_LIGHTS, createHomeLights, lampInteraction, lightById } from './home-lights';
import { mountHomeLightsPage } from './home-lights-ui';
import { createLampPicker } from './lamp-picker';
import { setWallFolding } from './home-scenery';
import { createInteractionPrompt } from './interaction-prompt';
import { createAudio } from './audio';
import { createMusic, isTrack, type TrackId } from './music';
import { castleHaunt } from './haunt';
import { createSfx, watchMenuSounds } from './sfx';
import { mountSoundPage } from './sound-ui';

const isMember = (id: string): id is MemberId => id === 'gerard' || id === 'bernat' || id === 'aitor';

const canvas = document.querySelector<HTMLCanvasElement>('#game')!;
let previousScore = 0;
let sessionSteps = 0;
let loaded = false;
let loading = false;
let saving = false;
let dirty = false;
let saveTimer: ReturnType<typeof setTimeout> | undefined;
const interactButton = document.querySelector<HTMLButtonElement>('#interact')!;
const interactionPrompt = createInteractionPrompt(interactButton);
const dialogue = createDialogueBanner(document.querySelector<HTMLElement>('#hud')!);
const storyUI = createStoryUI(document.querySelector<HTMLElement>('#hud')!);
// Chapter 2: the station map (metro and Rodalies) and the TV news.
const travelUI = createTravelUI(document.querySelector<HTMLElement>('#hud')!);
const hud = document.querySelector<HTMLElement>('#hud')!;
// Every key shown in the HUD follows the device in use: keyboard and mouse, or the last pad touched.
const stopGlyphs = watchGlyphs();
// The bulbs at home (docs/home-lights.md): they follow the place and the fights once connected in the menu.
const homeLights = createHomeLights();
// Music and sound effects (docs/audio.md): silent until the first key, click or pad button.
const audio = createAudio();
const music = createMusic(audio);
const sfx = createSfx(audio);
// Registered before the menus so Escape is heard before they take it.
const stopMenuSounds = watchMenuSounds(sfx, () => !!document.querySelector('#controller-menu[open], #hud[data-panel], #lamp-dial:not([hidden]), #travel:not([hidden])'));
/** A blow lands with a thump, a cure or a boost with a sparkle. */
function impactSound(effect: BattleEffect) {
  const kind = effect.skill && SKILLS.find(s => s.id === effect.skill)?.kind;
  if (kind === 'heal' || kind === 'boost') sfx.play('heal');
  else if ((effect.kind === 'attack' || effect.kind === 'skill' || effect.kind === 'enemy') && effect.amount) sfx.play('hit');
}
/**
 * Each place's song, coming in slowly from anywhere in it (a vamping or cycled one from the top);
 * a place without one fades to silence.
 * The castle's song is haunted as much as the castle is threatening right now (src/haunt.ts).
 */
const PLACE_SONGS: Partial<Record<EnvironmentId, TrackId>> = { maresme: 'sad', meridiana: 'home', 'meridiana-calle': 'concrete', palacio: 'bubbaloo', 'rec-comtal': 'bubbaloo' };
let place: EnvironmentId | undefined;
/** `just dev-music` plays its own song, which a place's song must not cover. */
const devSong = import.meta.env.DEV && new URLSearchParams(location.search).has('music');
function scorePlace(id: EnvironmentId) {
  place = id;
  if (battlePhase || devSong) return;
  const song = PLACE_SONGS[id];
  music.haunt(castleHaunt(story));
  // A streamed take can only start after the first key or click.
  if (song) void audio.unlocked.then(() => { if (place === id && !battlePhase) void music.play(song, { from: 'random', fade: 4 }); });
  else if (music.playing && Object.values(PLACE_SONGS).includes(music.playing)) music.stop({ fade: 2 });
}
/** The fight's song: it comes in with the fight, plays its ending on a win and fades on a fall, an escape or leaving. */
let battlePhase: BattleState['phase'] | undefined;
function scoreBattle(state: BattleState | undefined) {
  const was = battlePhase;
  battlePhase = state?.phase;
  if (battlePhase === was) return;
  if (!state) { if (music.playing === 'battle') music.stop({ fade: 1.5 }); if (place) scorePlace(place); }
  else if (was === undefined) void music.play('battle', { restart: true, fade: .4 });
  if (battlePhase === 'won') void music.jump('ending', { at: 'bar', loop: false });
  else if (battlePhase === 'lost') music.stop({ fade: 2.5 });
  else if (battlePhase === 'escaped') music.stop({ fade: 1 });
}
/**
 * Development: ?story=<flag> starts with that flag and what it needs (just dev-chapter), where it
 * happened; ?story=new from scratch. In chapter 2, &with=nuria,uri adds those ánima missions as done.
 */
const devJump = (() => {
  if (!import.meta.env.DEV) return undefined;
  const params = new URLSearchParams(location.search);
  const at = params.get('story');
  if (at === null) return undefined;
  if (!(STORY_FLAGS as readonly string[]).includes(at)) return { flags: [] };
  const missions = (params.get('with') ?? '').split(',').filter((id): id is AnimaId => (ANIMA_IDS as string[]).includes(id));
  return { flags: flagsAt(at as StoryFlag, missions), spot: spotAt(at as StoryFlag) };
})();
const devStory = devJump?.flags;
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
/**
 * Development never waits for a second controller: without one, player 1 plays Aitor too, as in
 * `solo`, until a second controller connects. `?solo=0` waits for it, as the release does.
 */
const waitsForPad = !import.meta.env.DEV || new URLSearchParams(location.search).get('solo') === '0';
const playing = (): Control => !waitsForPad && !control.secondPad ? { ...control, mode: 'solo' } : control;
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
      if (import.meta.env.DEV && state) applyHelp(state);
      scoreBattle(state);
      return game.setBattle(state, effect, effect ? () => { impactSound(effect); onImpact?.(); } : onImpact);
    },
    target: id => game.selectTarget(id),
    awaken: id => { game.awaken(id); if (!testing) storyEvent({ type: 'class', id }); },
    driver: id => battleDriver(playing(), id),
    waiting: id => waitingForPlayer2(playing(), id),
    // Each fighter's pick in the fight is their pick for the adventure too.
    anima: (id, classId) => { game.changeAnima(id, classId); if (!testing && isMember(id) && story.wear(id, classId)) { keepLoadout(); storyChanged(); } },
    solo: () => playing().mode === 'solo',
  });
  /** Re-applies who drives Aitor after the mode or the second controller changes. */
  function controlChanged() {
    game.setPartnerDriven(partnerDriven(control, story.partner));
    battleUI.refresh();
    exploration.relayout();
  }
  let storyPaused = false;
  const menuOpen = () => !!document.querySelector('#controller-menu[open]');
  const exploration = createExplorationUI(document.querySelector<HTMLElement>('#hud')!, story, {
    pause: paused => { game.setPaused(paused || storyPaused || menuOpen()); music.duck(paused || menuOpen()); },
    openMenu: () => controller.open(),
    wear: (member, classId) => { if (story.wear(member, classId)) { keepLoadout(); storyChanged(); } },
    // With a second player on Aitor, each player gets their own half of the status screen.
    split: () => partnerDriven(control, story.partner),
    partner: () => game.partnerPosition,
    solo: () => playing().mode === 'solo',
  });
  let currentLocation: EnvironmentId = story.resume.environment;
  // Story beats play one after another: a dialogue waits for its last line, a card for its fade.
  let beats = Promise.resolve();
  const learned: Partial<Record<string, () => boolean>> = {
    run: () => game.running,
    items: () => exploration.active === 'items',
    party: () => exploration.active === 'character',
    // Shown when Aitor joins; it goes once a second controller is there to play him.
    duo: () => control.secondPad || playing().mode === 'solo',
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
    else if (effect.kind === 'rise') await game.rise();
    else if (effect.kind === 'fall') { homeLights.moment('fall'); await storyUI.blackout(true, 1600); }
    else if (effect.kind === 'news') await watchNews();
    else if (effect.kind === 'metro') await ride(effect.station);
    else if (effect.kind === 'look') await game.look(effect.anchor);
    else if (effect.kind === 'doom') { homeLights.moment('doom'); await theEnd(); }
    else { storyPaused = true; game.setPaused(true); await storyUI.card(effect.id); storyPaused = false; game.setPaused(!!exploration.active || menuOpen()); }
  }
  /**
   * Watching the TV in the flat: the camera comes close to its screen, where the news loops
   * (src/news-tv.ts), until a key, a click or a button looks away. It never covers the game.
   */
  let lookAway: (() => void) | undefined;
  async function watchNews() {
    exploration.close();
    game.watchTV(true); hud.dataset.watching = 'true'; homeLights.moment('tv');
    interactionPrompt.show({ id: 'stop-watching', cell: { x: 16, z: 2 }, label: 'Dejar de mirar', hint: 'Dejar de mirar' });
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
    delete hud.dataset.watching; interactionPrompt.show(undefined);
    game.watchTV(false); homeLights.moment('tv-off');
  }
  /**
   * The end: she has covered everything. The only way on is back to the morning before; that
   * day's progress is lost (docs/chapter-2.md § The Queen's advance).
   */
  async function theEnd() {
    storyPaused = true; game.setPaused(true);
    await storyUI.doom();
    const effects = story.rewind();
    storyChanged();
    for (const effect of effects) await play(effect);
    storyPaused = false; game.setPaused(!!exploration.active || menuOpen());
  }
  /** Down into a station: pick a destination on the network map, ride, and come up its entrance. */
  async function ride(from: string) {
    exploration.close(); storyPaused = true; game.setPaused(true);
    const to = await travelUI.show(from, {}, cityMarkers({ castle: story.has('tv-news'), threat: story.castleThreat, spread: Math.min(1, story.spread) }));
    const place = to ? STATION_PLACES[to] : undefined;
    const entrance = place && ENVIRONMENTS[place.environment].interactions.find(i => i.id === entranceId(to!));
    if (place && entrance) {
      await storyUI.blackout(true, 450);
      game.setEnvironment(place.environment, entrance.cell);
      await storyUI.blackout(false, 650);
    } else if (!to) {
      // Back up the stair: Gerard comes out at the entrance, not standing on the steps.
      const here = STATION_PLACES[from], back = here && ENVIRONMENTS[here.environment].interactions.find(i => i.id === entranceId(from));
      if (back) game.standAt(back.cell);
    }
    storyPaused = false; game.setPaused(!!exploration.active || menuOpen());
    if (to) storyEvent({ type: 'arrive', station: to });
  }
  function storyChanged() {
    game.refreshStory();
    // An ánima gained takes some of the castle's power, and of its song's haunt.
    if (!devSong) music.haunt(castleHaunt(story));
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
  /**
   * The place panel's picker (src/jump-menu.ts, docs/dev-tools.md): places, and in development
   * story points to start over at and the fight tester.
   */
  const jumpMenu = createJumpMenu(document.querySelector<HTMLElement>('.place-panel')!, {
    travel: id => {
      dialogue.close();
      // From a fight (development): leave it first; the street takes the new place once it is gone.
      if (battleUI.fight) leaveFight();
      const go = () => battlePhase === undefined ? game.setEnvironment(id) : requestAnimationFrame(go);
      go();
    },
    open: open => game.setPaused(open || storyPaused || menuOpen() || lampPicker.isOpen || !!exploration.active),
    dev: import.meta.env.DEV ? {
      flags: () => story.saved,
      day: () => story.days.clock.day,
      story: (at, day, missions) => { location.search = `?${new URLSearchParams({ story: at, ...(missions?.length ? { with: missions.join(',') } : {}), ...(day && day > 1 ? { day: String(day) } : {}) })}`; },
      fight: setup => startFight(setup),
      current: () => battleUI.fight,
      help: () => help,
      setHelp: value => { help = value; },
      jumpTo: moment => void battleUI.jumpTo(moment),
      leave: () => leaveFight(),
      folding: () => folding,
      setFolding: on => {
        folding = on; setWallFolding(on);
        try { localStorage.setItem(foldingKey, on ? '1' : '0'); } catch { /* Storage is optional. */ }
      },
    } : undefined,
  });
  /** Development: walls folding away is off for now; the picker turns it on to try it, remembered in this browser. */
  const foldingKey = 'gerard35.wallFolding';
  let folding = false;
  if (import.meta.env.DEV) try { folding = localStorage.getItem(foldingKey) === '1'; } catch { /* Storage is optional. */ }
  setWallFolding(folding);
  /** Development: the help every fight gets (the picker's Combate page, or the tester's setup). */
  let help: FightHelp = { free: false, immune: false };
  /** A fight left from the picker: no result reaches the story. */
  let leaving = false;
  function leaveFight() { if (!battleUI.fight) return; leaving = true; battleUI.end(); }
  /** The fight tester's fight now: it touches no story flag and helps as asked. */
  let testing: FightSetup | undefined;
  /** Where each fight is staged (game.ts): the dogs in the street, the minion and the guards in the palace. */
  const FIGHT_PLACES = { dogs: 'maresme', possessed: 'maresme', 'palace-minion': 'palacio', 'palace-guards': 'palacio' } as const;
  /** Starts a test fight; another chapter's party needs that chapter's Gerard, so it reloads there. */
  function startFight(setup: FightSetup) {
    if (setup.adult !== story.adult) {
      location.search = `?${new URLSearchParams({ story: setup.adult ? 'got-wrapper' : 'minion', fight: JSON.stringify(setup) })}`;
      return;
    }
    exploration.close(); dialogue.close();
    const place = FIGHT_PLACES[setup.encounter];
    if (currentLocation !== place) game.setEnvironment(place);
    const bonus = setup.adult && setup.friends.length ? { bonus: animaBonus(setup.friends) } : {};
    const party: PartySlot[] = [
      { id: 'gerard', name: 'Gerard', profile: setup.adult ? 'gerard35' : 'gerard', classId: setup.wear.gerard, ...bonus },
      ...!setup.partner ? [] : setup.adult ? [{ id: 'aitor', name: 'Aitor', profile: 'aitor' as const, classId: setup.wear.aitor, ...bonus }] : [{ id: 'bernat', name: 'Bernat', profile: 'bernat' as const }],
    ];
    const possessed = setup.encounter === 'possessed';
    // A frame for the new place to settle before the fight takes its stage.
    requestAnimationFrame(() => {
      testing = setup; help = { free: setup.free, immune: setup.immune };
      game.possess(possessed);
      battleUI.open(party, setup.foes, { possessed, encounter: possessed ? 'dogs' : setup.encounter as Exclude<FightSetup['encounter'], 'possessed'>, animas: setup.animas, guards: palaceGuards(setup.adult ? setup.friends.length : 0) });
    });
  }
  /** The help: skills cost nothing, and no blow takes the party's PV (it is back before the bar moves). */
  function applyHelp(state: BattleState) {
    for (const ally of state.allies) {
      if (help.free) ally.secondary = ally.maxSecondary;
      if (help.immune && ally.hp > 0) ally.hp = ally.maxHp;
    }
  }
  const game = await createGame(canvas, {
    onEncounter: (withPartner, foes, options) => { exploration.close(); dialogue.close(); battleUI.open(story.battleParty(withPartner), foes, { ...options, animas: story.classes, guards: palaceGuards(story.animas.length) }); },
    // Backing off is neither a win nor a fall.
    onBattleEnd: (phase, encounter) => {
      // A test fight, or one left from the picker, leaves the story as it was, and the street as the story has it.
      if (testing || leaving) { testing = undefined; leaving = false; game.refreshStory(); return; }
      if (phase !== 'escaped') storyEvent({ type: 'battle', won: phase === 'won', encounter });
    },
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
      homeLights.setPlace(id);
      scorePlace(id);
      exploration.update(id, cell);
      jumpMenu.setPlace(id);
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
    onInteraction: interactionPrompt.show,
    onInteractionScreen: interactionPrompt.position,
    onDialogue: dialogue.show,
    // A lamp in the Meridiana flat opens its dial: colour and brightness, in the game and at home.
    onStory: event => {
      const lamp = event.type === 'interact' ? lampInteraction(event.id) : undefined;
      if (lamp) lampPicker.open(lamp); else storyEvent(event);
    },
  }, story);
  const lampPicker = createLampPicker(hud, homeLights, paused => { game.setPaused(paused || storyPaused || menuOpen() || !!exploration.active); music.duck(paused || menuOpen() || !!exploration.active); });
  for (const light of HOUSE_LIGHTS) game.setLamp(light.id, homeLights.flat[light.id]);
  homeLights.onFlat((id, lamp) => game.setLamp(id, lamp));
  game.setLampLabels(id => {
    const lamp = lampInteraction(id);
    return lamp ? `${homeLights.flat[lamp].on ? 'Cambiar' : 'Encender'} ${lightById(lamp).name}` : undefined;
  });
  // Her light and the evening fade in over seconds; the bulbs follow in steps.
  const followMood = () => homeLights.setMood({ tone: game.lightTone, dusk: story.dusk });
  followMood();
  const moodTimer = setInterval(followMood, 1000);
  const controllerContext = () => jumpMenu.isOpen ? 'jump' : battleUI.controllerContext !== 'world' ? battleUI.controllerContext
    : travelUI.open ? 'travel' : lookAway ? 'news' : storyUI.doomOpen ? 'doom' : lampPicker.isOpen ? 'lamp'
    : dialogue.open ? 'dialogue' : exploration.active ? `journal:${exploration.active}` : 'world';
  let restoreLightsOnResume = false;
  const controller = createControllerUI({
    context: controllerContext,
    direction: (direction, stick, running) => controllerContext() === 'world' ? game.setControllerInput(direction, stick, running) : game.setControllerInput(null, null),
    partnerDirection: (direction, stick, running) => controllerContext() === 'world' ? game.setPartnerInput(direction, stick, running) : game.setPartnerInput(null, null),
    secondPad: id => { control.secondPad = !!id; controlChanged(); },
    mode: import.meta.env.DEV ? {
      get: () => control.mode,
      set: (mode: ControlMode) => { control.mode = mode; try { localStorage.setItem(soloKey, mode); } catch { /* Storage is optional. */ } controlChanged(); },
    } : undefined,
    pause: value => { game.setPaused(value || storyPaused || lampPicker.isOpen || !!exploration.active); music.duck(value || lampPicker.isOpen || !!exploration.active); },
    panel: id => id ? exploration.show(id) : exploration.close(),
    lights: section => mountHomeLightsPage(section, homeLights),
    sound: section => mountSoundPage(section, audio),
    exit: () => {
      clearTimeout(saveTimer); void save();
      music.stop({ fade: .5 });
      restoreLightsOnResume = homeLights.settings.enabled;
      void homeLights.setEnabled(false, false);
    },
    resume: () => { if (restoreLightsOnResume) void homeLights.setEnabled(true, false); scorePlace(currentLocation); },
    action: (action, player) => {
      // Player 2 plays Aitor: his turns in battle, the dialogue, and using things where he stands.
      if (jumpMenu.isOpen) { if (action === 'cancel') jumpMenu.close(); return; }
      if (travelUI.open) { if (action !== 'overview' && action !== 'character' && action !== 'prev' && action !== 'next') travelUI.control(action); return; }
      if (lampPicker.isOpen) { if (action !== 'overview' && action !== 'character') lampPicker.control(action); return; }
      if (lookAway) { if (action === 'confirm' || action === 'cancel') lookAway(); return; }
      if (storyUI.doomOpen) { if (action === 'confirm') storyUI.confirmDoom(); return; }
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
  interactButton.addEventListener('click', () => { if (lookAway) lookAway(); else if (dialogue.open) dialogue.advance(); else game.interact(); canvas.focus({ preventScroll: true }); });
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
    // Development: the fight tester reloaded into the other chapter to start its fight (?fight=…).
    const fight = import.meta.env.DEV ? new URLSearchParams(location.search).get('fight') : null;
    // A story point stands Gerard where it happened (story-points.ts); the tester takes him to its own stage.
    const { environment, cell } = (!fight && devJump?.spot) || story.resume;
    if (story.started && environment !== currentLocation) game.setEnvironment(environment, cell);
    storyChanged();
    storyEvent({ type: 'start' });
    if (fight) { try { startFight(validFight(JSON.parse(fight))); } catch { /* A broken link starts no fight. */ } }
  };
  // Repeatable desktop battle checks without affecting production or saved progress.
  if (import.meta.env.DEV) {
    // The picker from anywhere, fights included: F2, or the button over the fight.
    const debugFight = document.createElement('button');
    debugFight.type = 'button'; debugFight.className = 'jump-fight'; debugFight.dataset.jumpTrigger = '';
    debugFight.innerHTML = 'Depuración <kbd>F2</kbd>';
    debugFight.addEventListener('click', () => jumpMenu.toggle('fight'));
    document.querySelector('#battle')?.append(debugFight);
    window.addEventListener('keydown', event => {
      if (event.code !== 'F2' || event.repeat) return;
      event.preventDefault(); event.stopImmediatePropagation();
      jumpMenu.toggle(battleUI.fight ? 'fight' : undefined);
    }, { capture: true });
    const params = new URLSearchParams(location.search);
    const foes = Number(params.get('battle'));
    // ?battle=3&allies=2 fights with chapter 1's boys; ?battle=3&party=adult with Gerard at 35 and Aitor.
    const adult = new Story(['caught', 'noista']);
    if ([2, 3, 4].includes(foes)) requestAnimationFrame(() => params.get('party') === 'adult' ? battleUI.open(adult.battleParty(true), foes, { animas: adult.classes })
      : battleUI.open(params.get('allies') === '2' ? 2 : 1, foes, { animas: ['matemagico', ...(params.has('noista') ? ['noista' as const] : [])] }));
    // ?music=battle&from=126 plays a song from a mark or second on the first key or click, to hear a loop's seam (just dev-music).
    const track = params.get('music'), haunt = Number(params.get('haunt'));
    // &haunt=.8 plays a haunted song at that level instead of the castle's (just dev-music bubbaloo random .8).
    if (params.has('haunt') && Number.isFinite(haunt)) music.haunt(haunt);
    if (track && isTrack(track)) void audio.unlocked.then(() => music.play(track, { from: Number.isFinite(Number(params.get('from'))) ? Number(params.get('from')) : params.get('from') ?? 'start', fade: 0 }));
    // Handle for scripted browser checks, e.g. teleporting to a story beat.
    Object.assign(window, { gerard: { game, story, battleUI, exploration, control, controlChanged, storyEvent, travelUI, homeLights, audio, music, sfx } });
  }
  if (import.meta.hot) import.meta.hot.dispose(() => { jumpMenu.destroy(); stopGlyphs(); stopMenuSounds(); music.stop({ fade: 0 }); audio.destroy(); clearInterval(moodTimer); lampPicker.destroy(); homeLights.release(); travelUI.destroy(); controller.destroy(); exploration.destroy(); battleUI.destroy(); storyUI.destroy(); game.app.destroy(); });
} catch (error) {
  console.error('No se pudo crear la escena', error);
  document.querySelector<HTMLElement>('#error')!.hidden = false;
}
// Wait briefly for saved progress, so a returning player resumes where they left off.
void load().then(() => startStory?.());
