import type { createGame } from './game';
import { FIGHT_FX, type Element, type FightFx, type FireLevel } from './effects';
import { REACTIONS, STATUS_LOOKS, type ReactionId, type StatusLookId } from './status-fx';
import { CLASSES } from './classes';
import type { StatWay } from './stat-fx';
import { SOUNDS, type Sfx, type SoundId } from './sfx';
import { DUALS, FOE_ABILITIES, type BattleEffect, type DualId, type Element as AttackElement, type FoeAbilityId } from './battle';
import { DUAL_BANNER, DUAL_SLOW } from './battle-motion';

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
  // Matemágico's own: its streams land a moment later, so no element hit on top (Fuerza 1 or more catches).
  binari: { name: 'Foc Binari' },
};
const ELEMENTS: Record<Element, string> = {
  fire: 'Fuego', ice: 'Hielo', air: 'Viento', energy: 'Energía', water: 'Agua', earth: 'Tierra', light: 'Luz', shadow: 'Sombra', gum: 'Chicle',
};
const FIRES: Record<FireLevel, string> = { light: 'Llamita', medium: 'Hoguera', high: 'Incendio' };
const LOOKS = Object.keys(STATUS_LOOKS) as StatusLookId[];
/**
 * The tower's fears' abilities the lab can play (battle-scene.ts `worldFx`), each as the fight would
 * show it on whoever is picked (a foe acting on the first ally), with what else it needs.
 */
const ABILITIES: { id: FoeAbilityId | 'ojo-roto'; name?: string; extra?: Partial<BattleEffect> }[] = [
  { id: 'capa-nueva', extra: { regrown: true } }, { id: 'carrerilla' }, { id: 'aplaston' }, { id: 'vuelta', extra: { flipped: 'coliflor' } },
  { id: 'transparente' }, { id: 'puaj' },
  // Vertitrón's (src/battle.ts VERTIGO_TURNS), played by Vertitrón whoever is picked, and its eye breaking.
  { id: 'pisoton' }, { id: 'barrido' }, { id: 'grito' }, { id: 'carga', name: 'Carga' }, { id: 'rayo' }, { id: 'ojo-roto', name: 'Ojo roto' },
];
const VERTITRON = new Set(['pisoton', 'barrido', 'grito', 'carga', 'rayo', 'ojo-roto']);
const abilityName = (a: (typeof ABILITIES)[number]) => a.name ?? FOE_ABILITIES[a.id as FoeAbilityId].name;
/** Matemágico's thrown Atacar (src/math-cast.ts), each way it can go. */
const THROWN: { id: string; name: string; element?: AttackElement }[] = [{ id: 'none', name: 'Atacar · ∅' }, { id: 'agua', name: 'Atacar · Agua', element: 'agua' }, { id: 'fuego', name: 'Atacar · Fuego', element: 'fuego' }, { id: 'electrico', name: 'Atacar · Eléctrico', element: 'electrico' }];

export function mountFxLab(game: Game, sfx: Sfx) {
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
      <h3>Ataques duales</h3>
      <div class="fx-lab-grid">${DUALS.map(d => `<button type="button" data-dual="${d.id}" title="${d.parts.join(' + ')}">${d.name}</button>`).join('')}</div>
      <h3>Habilidades de los miedos</h3>
      <div class="fx-lab-grid">${ABILITIES.map(a => `<button type="button" data-ability="${a.id}">${abilityName(a)}</button>`).join('')}</div>
      <h3>Atacar de Matemágico</h3>
      <div class="fx-lab-grid">${THROWN.map(a => `<button type="button" data-thrown="${a.id}">${a.name}</button>`).join('')}</div>
      <h3>Golpes de elemento</h3>
      <div class="fx-lab-grid">${Object.entries(ELEMENTS).map(([id, name]) => `<button type="button" data-element="${id}">${name}</button>`).join('')}</div>
      <h3>Sonidos</h3>
      <div class="fx-lab-grid">${Object.keys(SOUNDS).map(id => `<button type="button" data-sound="${id}">${id}</button>`).join('')}</div>
      <h3>Características</h3>
      <div class="fx-lab-grid"><button type="button" data-stat="down">Baja</button><button type="button" data-stat="up">Sube</button></div>
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
  /**
   * A dual on the picked foe, from the first two of the party (the one wearing Matemágico draws, the
   * one wearing Papagato brings the cats): its choreography as the fight plays it, numbers made up.
   */
  function dual(id: DualId) {
    const spec = DUALS.find(d => d.id === id)!, party = fighters().filter(f => f.party), foe = fighters().find(f => f.id === target.value && !f.party) ?? fighters().find(f => !f.party);
    if (!keep.checked) game.effects.clear();
    if (party.length < 2 || !foe) { say('Hace falta un combate con dos aliados y un enemigo.'); return; }
    game.frame();
    const many = (spec.strikes ?? 1) > 1, coins = [1, 0, 1, 1, 0, 1, 0, 1] as (0 | 1)[];
    const effect: BattleEffect = {
      kind: 'skill', actor: party[0].id, target: foe.id, amount: many ? 64 : 20,
      dual: { id: spec.id, name: spec.name, parts: [...spec.parts], actors: [party[0].id, party[1].id], spent: {} },
      ...many ? { strikes: Array(spec.strikes).fill(8), coins, burns: coins.map((c, i) => c ? Math.min(3, coins.slice(0, i + 1).filter(Boolean).length) : 0) } : {},
      ...spec.weakSpot ? { weakSpot: 'set' as const } : {},
    };
    // As the fight screen does when its banner drops.
    game.slowmo(DUAL_SLOW, DUAL_BANNER);
    say(game.preview(effect) ? `${spec.name} en ${foe.id}` : 'Hace falta un combate.');
  }
  /**
   * A foe's ability, played by the picked foe on the first ally (or on itself, for what it does alone);
   * Vertitrón's always by Vertitrón, on everyone it reaches.
   */
  function ability(id: FoeAbilityId | 'ojo-roto') {
    const spec = ABILITIES.find(a => a.id === id)!, party = fighters().filter(f => f.party), picked = fighters().find(f => f.id === target.value && !f.party) ?? fighters().find(f => !f.party);
    const foe = VERTITRON.has(id) ? fighters().find(f => f.id === 'vertigo') : picked;
    if (!foe || !party.length) { say(VERTITRON.has(id) ? 'Hace falta el combate de Vertitrón.' : 'Hace falta un combate.'); return; }
    if (!keep.checked) game.effects.clear();
    game.frame();
    if (id === 'ojo-roto') { say(game.preview({ kind: 'enemy', actor: foe.id, eye: 'broken' }) ? 'Ojo roto' : 'Hace falta un combate.'); return; }
    const alone = id === 'capa-nueva' || id === 'vuelta' || id === 'transparente' || id === 'grito' || id === 'carga';
    const everyone = id === 'barrido' || id === 'rayo';
    const effect: BattleEffect = {
      kind: 'enemy', actor: foe.id, ...alone ? {} : { target: party[0].id, amount: id === 'rayo' ? 36 : 12 },
      ability: { id, name: FOE_ABILITIES[id].name, ...FOE_ABILITIES[id].card ? { card: true as const } : {} },
      ...everyone ? { splash: party.slice(1).map(p => ({ target: p.id, amount: id === 'rayo' ? 36 : 12 })) } : {},
      ...id === 'carrerilla' ? { telegraph: { id, name: FOE_ABILITIES[id].name, target: party[0].id } } : {},
      ...id === 'carga' ? { telegraph: { id: 'rayo' as const, name: FOE_ABILITIES.rayo.name, at: 'todos' as const } } : {},
      ...id === 'grito' ? { stats: [...party.map(p => ({ target: p.id, way: 'down' as const, stats: ['fuerza', 'magia'] as ('fuerza' | 'magia')[] })), { target: foe.id, way: 'up' as const, stats: ['fuerza', 'magia'] as ('fuerza' | 'magia')[] }] } : {},
      ...id === 'transparente' ? { transparent: [foe.id] } : {},
      ...spec.extra,
    };
    say(game.preview(effect) ? `${abilityName(spec)} (${foe.id})` : 'Hace falta un combate.');
  }
  /** The thrown Atacar from whoever stands first in the party, as the fight would show it. */
  function thrown(id: string) {
    const spec = THROWN.find(a => a.id === id)!, gerard = fighters().find(f => f.id === 'gerard') ?? fighters().find(f => f.party), foe = fighters().find(f => f.id === target.value && !f.party) ?? fighters().find(f => !f.party);
    if (!gerard || !foe) { say('Hace falta un combate.'); return; }
    if (!keep.checked) game.effects.clear();
    game.frame();
    say(game.preview({ kind: 'attack', actor: gerard.id, target: foe.id, amount: 16, spell: true, ...spec.element ? { element: spec.element } : {} }) ? spec.name : 'Hace falta un combate.');
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
    // A sound only sounds: it leaves the picture and the last effect alone.
    if (d.sound) { sfx.play(d.sound as SoundId); return; }
    let run: (() => void) | undefined;
    if (d.fx) run = () => attack(d.fx as FightFx);
    else if (d.dual) run = () => dual(d.dual as DualId);
    else if (d.ability) run = () => ability(d.ability as FoeAbilityId | 'ojo-roto');
    else if (d.thrown) run = () => thrown(d.thrown!);
    else if (d.element) run = () => { if (!keep.checked) game.effects.clear(); frame(target.value); hit(d.element as Element, target.value, Number(strength.value)); say(`Golpe de ${ELEMENTS[d.element as Element]}`); };
    else if (d.stat) run = () => { frame(target.value); game.statChange(target.value, d.stat as StatWay); say(d.stat === 'down' ? 'Baja una característica' : 'Sube una característica'); };
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
