import { createExplorationUI } from './exploration-ui';
import { createGame } from './game';
import { type Direction } from './movement';
import { ENVIRONMENTS, type EnvironmentId } from './environments';
import { createDialogueBanner } from './dialogue';
import { createBattleUI } from './battle-ui';

const canvas = document.querySelector<HTMLCanvasElement>('#game')!;
const scoreEl = document.querySelector<HTMLElement>('#score')!;
const cellEl = document.querySelector<HTMLElement>('#cell')!;
const saved = document.querySelector<HTMLButtonElement>('#saved')!;
let previousScore = 0;
let sessionSteps = 0;
let loaded = false;
let loading = false;
let saving = false;
let dirty = false;
let saveTimer: ReturnType<typeof setTimeout> | undefined;
const pad = (value: number) => String(value).padStart(2, '0');
const renderScore = () => { scoreEl.textContent = String(previousScore + sessionSteps).padStart(3, '0'); };
const environmentSelect = document.querySelector<HTMLSelectElement>('#environment')!;
const interactButton = document.querySelector<HTMLButtonElement>('#interact')!;
const dialogue = createDialogueBanner(document.querySelector<HTMLElement>('#hud')!);
const labelElements = new Map(['gerard', 'bernat'].map(id => [id, document.querySelector<HTMLElement>(`#label-${id}`)!]));
async function load() {
  if (loading || loaded) return;
  loading = true;
  try {
    const response = await fetch('/api/state', { signal: AbortSignal.timeout(5000) });
    if (!response.ok) throw new Error('load');
    const state = await response.json();
    if (!Number.isInteger(state.score) || state.score < 0) throw new Error('state');
    previousScore = state.score;
    loaded = true;
    renderScore();
    saved.textContent = 'Progreso conectado';
    if (dirty) void save();
  } catch {
    saved.textContent = 'Sin conexión · Reintentar';
  } finally { loading = false; }
}
async function save() {
  if (!loaded) { await load(); return; }
  if (saving || !dirty) return;
  saving = true;
  dirty = false;
  saved.textContent = 'Guardando pasos…';
  try {
    const response = await fetch('/api/state', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ score: previousScore + sessionSteps }), keepalive: true,
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) throw new Error('save');
    saved.textContent = 'Pasos guardados';
    // A slower request may finish after the next debounce has already fired.
    if (dirty) {
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => { void save(); }, 700);
    }
  } catch {
    dirty = true;
    saved.textContent = 'Sin guardar · Reintentar';
  } finally { saving = false; }
}
saved.addEventListener('click', () => { void (loaded ? save() : load()); });
window.addEventListener('online', () => { void (loaded ? save() : load()); });
document.addEventListener('visibilitychange', () => { if (document.hidden) void save(); });
window.addEventListener('pagehide', () => { void save(); });

try {
  const dogButton = document.createElement('button');
  dogButton.id = 'dog-encounter'; dogButton.hidden = true;
  dogButton.innerHTML = '<span></span><small></small>';
  document.querySelector('#hud')!.append(dogButton);
  const battleUI = createBattleUI(document.querySelector<HTMLElement>('#hud')!, {
    change: (state, effect, onImpact) => game.setBattle(state, effect, onImpact),
    target: id => game.selectTarget(id),
  });
  const exploration = createExplorationUI(document.querySelector<HTMLElement>('#hud')!, paused => game.setPaused(paused));
  let currentLocation: EnvironmentId = 'maresme';
  const game = createGame(canvas, {
    onEncounter: (allies, foes) => { exploration.close(); dialogue.close(); battleUI.open(allies, foes); },
    onDog: (x, y, visible, count, ready) => {
      dogButton.hidden = !visible; dogButton.disabled = !ready;
      dogButton.querySelector('span')!.textContent = `Pandilla de ${count} perros`;
      dogButton.querySelector('small')!.textContent = ready ? 'ACÉRCATE O HAZ CLIC' : 'RECUPERANDO EL ALIENTO…';
      dogButton.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`;
    },
    onBattleTargets: targets => battleUI.positionTargets(targets),
    onStep: (steps, cell) => {
      sessionSteps = steps;
      exploration.update(currentLocation, cell, steps);
      renderScore();
      cellEl.textContent = `${pad(cell.x)} / ${pad(cell.z)}`;
      dirty = true;
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => { void save(); }, 700);
    },
    onLocation: (id, cell) => {
      currentLocation = id;
      exploration.update(id, cell);
      environmentSelect.value = id;
      document.querySelector<HTMLElement>('.quest')!.hidden = id === 'patio';
      document.querySelector('.place-panel .eyebrow')!.textContent = id === 'patio' ? 'PRUEBA DE MOVIMIENTO' : 'SANT QUIRZE DEL VALLÈS';
      cellEl.textContent = `${pad(cell.x)} / ${pad(cell.z)}`;
      document.querySelector('#location-detail')!.textContent = id === 'home'
        ? 'Interior provisional · Distribución por definir'
        : id === 'maresme' ? 'Reconstrucción aproximada · Nº 20' : 'Escena de prueba de movimiento';
      document.querySelector('#overview')!.firstChild!.textContent = id === 'maresme' ? 'Vista general ' : 'Centrar vista ';
      document.title = `${ENVIRONMENTS[id].name} · Gerard 35`;
    },
    onInteraction: interaction => {
      interactButton.hidden = !interaction;
      interactButton.querySelector('span')!.textContent = interaction?.label ?? '';
    },
    onDialogue: dialogue.show,
    onQuest: () => {
      exploration.setCompanion();
      document.querySelector('#quest-title')!.textContent = '✓ Has llamado a Bernat';
      document.querySelector('#quest-detail')!.textContent = '«¡Ya bajo!» · Misión completada';
    },
    onLabels: labels => {
      for (const [id, element] of labelElements) {
        const label = labels.find(l => l.id === id);
        element.hidden = !label?.visible;
        if (label) element.style.transform = `translate(${label.x}px, ${label.y}px) translate(-50%, -100%)`;
      }
    },
  });
  dogButton.addEventListener('click', () => game.encounter());
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
      if (event.detail === 0) { game.press(button.dataset.direction as Direction); game.release(); }
    });
  });
  canvas.focus({ preventScroll: true });
  // Repeatable desktop battle checks without affecting production or saved progress.
  if (import.meta.env.DEV) {
    const params = new URLSearchParams(location.search);
    const foes = Number(params.get('battle'));
    if ([2, 3, 4].includes(foes)) requestAnimationFrame(() => battleUI.open(params.get('allies') === '2' ? 2 : 1, foes));
  }
  if (import.meta.hot) import.meta.hot.dispose(() => { exploration.destroy(); battleUI.destroy(); dogButton.remove(); game.app.destroy(); });
} catch (error) {
  console.error('No se pudo crear la escena', error);
  document.querySelector<HTMLElement>('#error')!.hidden = false;
}
void load();
