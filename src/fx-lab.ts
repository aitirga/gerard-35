import type { createGame } from './game';
import { FIGHT_FX, type Element, type FightFx, type FireLevel } from './effects';
import { REACTIONS, STATUS_LOOKS, type ReactionId, type StatusLookId } from './status-fx';
import { CLASSES } from './classes';

type Game = Awaited<ReturnType<typeof createGame>>;

/**
 * Development: the effects lab (`?fxlab`, just dev-fx). A panel over a real fight that plays every
 * fight effect, element hit, fire level, status and reaction on whoever is picked, each fight
 * effect under a made-up attack name until a real skill wears it. Nothing it does touches the
 * fight's numbers or the story.
 */
const ATTACKS: Record<FightFx, { name: string; element?: Element; ally?: boolean; colour?: boolean }> = {
  needles: { name: 'Golpe seco' },
  shatter: { name: 'Lluvia de escarcha', element: 'ice' },
  arc: { name: 'Cadena voltaica', element: 'energy' },
  vortex: { name: 'Torbellino de ánima', element: 'air', colour: true },
  swarm: { name: 'Enjambre de sombras', element: 'shadow' },
  goo: { name: 'Chicle pegajoso', element: 'gum' },
  heal: { name: 'Tirita', ally: true },
  fireworks: { name: 'Traca final', element: 'fire' },
  prison: { name: 'Jaula de cristal', element: 'light' },
  orbit: { name: 'Satélites', element: 'light' },
  gather: { name: 'Imán de chispas', element: 'energy' },
  meteor: { name: 'Lluvia de meteoros', element: 'fire' },
  fireflies: { name: 'Luciérnagas', ally: true },
  ward: { name: 'Muro de luz', ally: true },
  morph: { name: 'Gelatina de luz', element: 'energy' },
  current: { name: 'Corriente', element: 'water' },
  veil: { name: 'Velo', ally: true },
  forge: { name: 'Forja', element: 'fire' },
  shield: { name: 'Escudo', ally: true },
  bubble: { name: 'Burbuja', ally: true },
  globe: { name: 'Globo terráqueo', ally: true },
  orb: { name: 'Orbe', ally: true },
};
const ELEMENTS: Record<Element, string> = {
  fire: 'Fuego', ice: 'Hielo', air: 'Viento', energy: 'Energía', water: 'Agua', earth: 'Tierra', light: 'Luz', shadow: 'Sombra', gum: 'Chicle',
};
const FIRES: Record<FireLevel, string> = { light: 'Llamita', medium: 'Hoguera', high: 'Incendio' };
const LOOKS = Object.keys(STATUS_LOOKS) as StatusLookId[];

export function mountFxLab(game: Game) {
  const panel = document.createElement('aside');
  panel.className = 'fx-lab';
  panel.innerHTML = `
    <header><strong>Laboratorio de efectos</strong><button type="button" data-act="fold">–</button></header>
    <div class="fx-lab-body">
      <label>Objetivo <select data-field="target"></select></label>
      <label>Desde <select data-field="from"></select></label>
      <label>Fuerza <input data-field="strength" type="range" min=".3" max="2" step=".1" value="1"><output>1</output></label>
      <label>Color <select data-field="colour">${Object.values(CLASSES).map(c => `<option value="${c.colour}">${c.name}</option>`).join('')}</select></label>
      <label><input data-field="hud" type="checkbox" checked> Ocultar menú de combate</label>
      <label><input data-field="zoom" type="checkbox"> Acercar cámara al objetivo</label>
      <label><input data-field="keep" type="checkbox"> Acumular (no limpiar antes)</label>
      <div class="fx-lab-row"><button type="button" data-act="again">Repetir último</button><button type="button" data-act="clean">Limpiar todo</button></div>
      <p class="fx-lab-note" hidden></p>
      <h3>Ataques</h3>
      <div class="fx-lab-grid">${FIGHT_FX.map(fx => `<button type="button" data-fx="${fx}" title="${fx}${ATTACKS[fx].element ? ' · ' + ATTACKS[fx].element : ''}${ATTACKS[fx].ally ? ' · a un aliado' : ''}">${ATTACKS[fx].name}</button>`).join('')}</div>
      <h3>Golpes de elemento</h3>
      <div class="fx-lab-grid">${Object.entries(ELEMENTS).map(([id, name]) => `<button type="button" data-element="${id}">${name}</button>`).join('')}</div>
      <h3>Fuego</h3>
      <div class="fx-lab-grid">${Object.entries(FIRES).map(([id, name]) => `<button type="button" data-fire="${id}">${name}</button>`).join('')}<button type="button" data-fire="">Apagar</button></div>
      <h3>Estados</h3>
      <div class="fx-lab-states">${LOOKS.map(look => `<span>${STATUS_LOOKS[look].name}</span>${[1, 2, 3].map(l => `<button type="button" data-look="${look}" data-level="${l}">${'I'.repeat(l)}</button>`).join('')}<button type="button" data-look="${look}" data-level="0">×</button>`).join('')}</div>
      <h3>Reacciones</h3>
      <div class="fx-lab-grid">${(Object.keys(REACTIONS) as ReactionId[]).map(r => `<button type="button" data-reaction="${r}" title="${REACTIONS[r].status} + ${REACTIONS[r].element}: ${REACTIONS[r].shows}">${REACTIONS[r].name}</button>`).join('')}</div>
    </div>`;
  document.body.append(panel);
  // Clicks here stay here: the fight's own menu never hears them.
  for (const type of ['keydown', 'pointerdown', 'click'] as const) panel.addEventListener(type, event => event.stopPropagation());

  const field = <T extends HTMLElement>(name: string) => panel.querySelector<T>(`[data-field="${name}"]`)!;
  const target = field<HTMLSelectElement>('target'), from = field<HTMLSelectElement>('from');
  const strength = field<HTMLInputElement>('strength'), colour = field<HTMLSelectElement>('colour');
  const hud = field<HTMLInputElement>('hud'), zoom = field<HTMLInputElement>('zoom'), keep = field<HTMLInputElement>('keep');
  const note = panel.querySelector<HTMLElement>('.fx-lab-note')!;
  let last: (() => void) | undefined;
  let known = '';

  const fighters = () => game.fighterIds();
  /** Fills the pickers whenever who is fighting changes, keeping the choice where it can. */
  function refresh() {
    const ids = fighters(), key = ids.map(f => f.id).join();
    if (key === known) return;
    known = key;
    const keepTarget = target.value, keepFrom = from.value;
    const options = ids.map(f => `<option value="${f.id}">${f.party ? 'Aliado' : 'Enemigo'} · ${f.id}</option>`).join('');
    target.innerHTML = options; from.innerHTML = options;
    const foe = ids.filter(f => !f.party)[1] ?? ids.find(f => !f.party), ally = ids.find(f => f.party);
    target.value = ids.some(f => f.id === keepTarget) ? keepTarget : foe?.id ?? '';
    from.value = ids.some(f => f.id === keepFrom) ? keepFrom : ally?.id ?? '';
  }
  const timer = setInterval(() => { refresh(); applyHud(); }, 500);

  function applyHud() {
    const battle = document.querySelector<HTMLElement>('#battle');
    if (battle) battle.style.visibility = hud.checked ? 'hidden' : '';
  }
  function frame(id: string) {
    const p = game.fighterAt(id);
    if (zoom.checked && p) game.frame({ x: p.x, y: p.y + .6, z: p.z }, 1.8); else game.frame();
  }
  function clean() {
    for (const f of fighters()) { game.ignite(f.id); for (const look of LOOKS) game.status(f.id, look, 0); }
    game.effects.clear(); game.effects.gpu?.clear();
  }
  function say(text = '') { note.textContent = text; note.hidden = !text; }
  /** Who an effect lands on: an ally effect on an enemy picked goes to the first ally instead. */
  function aimed(ally = false) {
    const ids = fighters(), picked = ids.find(f => f.id === target.value);
    return ally && picked && !picked.party ? ids.find(f => f.party)?.id ?? picked.id : target.value;
  }
  function chestOf(id: string) { const p = game.fighterAt(id); return p && { x: p.x, y: p.y + .9, z: p.z }; }

  function attack(fx: FightFx) {
    const spec = ATTACKS[fx], id = aimed(spec.ally), k = Number(strength.value);
    if (!keep.checked) game.effects.clear();
    frame(id);
    // Ally effects (shields, cures) face the other side: the blows they stop come from there.
    const side = fighters().find(f => f.id === id)?.party, thrower = spec.ally ? fighters().find(f => f.party !== side)?.id : from.value;
    const played = game.fx(fx, id, { from: thrower !== id ? thrower : undefined, strength: k, colour: spec.colour ? colour.value : undefined });
    if (spec.element) hit(spec.element, id, .6 * k);
    say(played ? `${spec.name} (${fx}) en ${id}` : `${fx} no se puede mostrar: hace falta simulación en la GPU (WebGPU) y movimiento sin reducir.`);
  }
  function hit(element: Element, id: string, k: number) {
    const at = chestOf(id), feet = game.fighterAt(id), source = from.value !== id ? chestOf(from.value) : undefined;
    const model = game.battleModel(id);
    if (at && feet) game.effects.element(element, at, { from: source, feet, strength: k, model });
  }

  panel.addEventListener('input', event => {
    if (event.target === strength) strength.nextElementSibling!.textContent = strength.value;
    if (event.target === hud) applyHud();
  });
  panel.addEventListener('click', event => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button');
    if (!button) return;
    const d = button.dataset;
    if (d.act === 'fold') { panel.classList.toggle('folded'); button.textContent = panel.classList.contains('folded') ? '+' : '–'; return; }
    if (d.act === 'clean') { clean(); game.frame(); say(); return; }
    if (d.act === 'again') { last?.(); return; }
    let run: (() => void) | undefined;
    if (d.fx) run = () => attack(d.fx as FightFx);
    else if (d.element) run = () => { if (!keep.checked) game.effects.clear(); frame(target.value); hit(d.element as Element, target.value, Number(strength.value)); say(`Golpe de ${ELEMENTS[d.element as Element]}`); };
    else if (d.fire !== undefined) run = () => { frame(target.value); game.ignite(target.value, (d.fire || undefined) as FireLevel | undefined); say(d.fire ? FIRES[d.fire as FireLevel] : 'Fuego apagado'); };
    else if (d.look) run = () => { frame(target.value); game.status(target.value, d.look as StatusLookId, Number(d.level), 30); say(Number(d.level) ? `${STATUS_LOOKS[d.look as StatusLookId].name} ${'I'.repeat(Number(d.level))}` : ''); };
    else if (d.reaction) run = () => {
      // A reaction needs its status on them first: it is put on, then the element turns it.
      const r = REACTIONS[d.reaction as ReactionId], id = target.value;
      frame(id);
      game.status(id, r.status, 2, 30);
      setTimeout(() => game.react(d.reaction as ReactionId, id), 700);
      say(`${r.name}: ${STATUS_LOOKS[r.status].name} + ${r.element} → ${r.leaves}`);
    };
    if (run) { last = run; run(); }
  });

  refresh(); applyHud();
  return {
    destroy() { clearInterval(timer); panel.remove(); game.frame(); const battle = document.querySelector<HTMLElement>('#battle'); if (battle) battle.style.visibility = ''; },
  };
}
