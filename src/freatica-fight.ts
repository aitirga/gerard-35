import type * as pc from 'playcanvas';
import { CRECIDA, waterOf, type BattleEffect, type BattleState } from './battle';
import type { Effects } from './effects';
import { AGUA, createFreaticaField, type AguaScene, type FreaticaField } from './freatica-fx';

/**
 * Freática's water in a real fight (docs/animas/freatica/README.md § Look and interface): the look built in the effects
 * lab (src/freatica-fx.ts, `createFreaticaField`), driven by the fight's state (src/battle.ts `CRECIDA`). Nothing here
 * changes a number.
 *
 * - **Each frame** every foe's cell follows its water: its marks, its top mark's clock, its current and its ice
 *   (`drive`), so the surface sinks with the fight's own clock and a mark drains when the fight's does.
 * - **Each action** plays the look of what it did, once (`play`): a skill's own cast (Recarga's tape, Sondeo's bolt,
 *   Bombeo, Riada's wave, the water hammer, Bajo cero), a bolt from anyone that charges the water, fire's steam, the
 *   ice's cracks, a flame's melt and the break, the cells breaking when whoever held them falls.
 * - While an action is on its way (chosen, not yet landed) the cells keep what they showed, so they change as it lands.
 */
/** When each of Freática's skills lands (its numbers) after it starts, and how long the fight gives it to play. */
export const FREATICA_SKILLS: Record<string, { contact: number; end: number }> = {
  recarga: { contact: .45, end: 1.25 }, sondeo: { contact: .15, end: 1 }, bombeo: { contact: .35, end: 1.3 },
  riada: { contact: .65, end: 1.8 }, 'golpe-de-ariete': { contact: .3, end: 1.6 }, 'bajo-cero': { contact: .2, end: 1.5 },
};
/** Seconds between the water hammer's blows as the fight shows their numbers, one after another. */
export const HAMMER_GAP = .3;
/** Seconds the cells are left to an action's own look before the state is followed again. */
const SETTLE = 1.4;

export function createFreaticaFight(app: pc.AppBase, effects: Effects, scene: AguaScene) {
  let field: FreaticaField | undefined, time = 0, waiting = false, held = false;
  /** The cells made so far (one a foe, made the first time it has water), and until when each is left to an action's look. */
  const made = new Set<string>(), busy = new Map<string, number>();
  const played = new WeakSet<BattleEffect>();
  // The first round of the ánima: grey edges and gauge over the same water (docs/animas/freatica/README.md § First and second round).
  const ready = () => { if (!field && effects.gpu) { field = createFreaticaField(app, effects, scene); field.setGrey(true); } return field; };
  let waitedSince = 0;
  const standing = () => new Set(scene.fighters().filter(f => !f.party).map(f => f.id));
  const leave = (id: string, seconds = SETTLE) => busy.set(id, Math.max(busy.get(id) ?? 0, time + seconds));
  const cell = (id: string) => { const f = ready(); if (!f || !standing().has(id)) return undefined; made.add(id); return f.cell(id); };

  /** The look of what `effect` did to the water and the ice, once. */
  function play(effect: BattleEffect, state: BattleState) {
    if (played.has(effect)) return;
    played.add(effect);
    waiting = false;
    const f = ready();
    if (!f) return;
    const all = [...standing()];
    const touched = new Set<string>();
    const at = (id: string, seconds?: number) => { touched.add(id); leave(id, seconds); };
    switch (effect.skill) {
      case 'recarga':
        if (effect.target && effect.water?.length) { cell(effect.target); f.cast.recarga(effect.target, effect.actor); at(effect.target); }
        break;
      case 'sondeo':
        if (effect.target) { cell(effect.target); for (const id of effect.current?.targets ?? []) cell(id); f.cast.sondeo(effect.target, effect.actor); at(effect.target, .8); effect.current?.targets.forEach(id => at(id, .8)); }
        break;
      case 'bombeo': {
        const from = effect.water?.[0]?.target;
        if (from) { cell(from); f.cast.bombeo(); at(from); }
        break;
      }
      case 'riada':
        for (const w of effect.water ?? []) cell(w.target);
        f.cast.riada(); all.forEach(id => at(id, 1.8));
        break;
      case 'golpe-de-ariete':
        f.cast.ariete(); all.forEach(id => at(id, 1.8));
        break;
      case 'bajo-cero':
        f.cast.bajoCero(); all.forEach(id => at(id, 1));
        break;
    }
    // A bolt from anyone else (Atacar · Eléctrico, Descarga): the water it ran through keeps the current.
    if (effect.skill !== 'sondeo') for (const id of effect.current?.targets ?? []) if (!touched.has(id)) { cell(id)?.bolt(effect.current!.seconds); at(id, .6); }
    // Fire on water: its top mark goes up as steam (Vapor), and the cloud stays while they are blinded.
    for (const w of effect.water ?? []) {
      if (touched.has(w.target) || w.to >= w.from) continue;
      const c = cell(w.target);
      if (c && (effect.reaction?.id === 'vapor' || effect.hits?.some(h => h.target === w.target && h.smoked))) { c.steam(state.foes.find(x => x.id === w.target)?.timed?.cegado?.left ?? 10); at(w.target, .8); }
    }
    // Blows on the ice: each cracks it as it counted, a flurry strike by strike; a flame melts a mark; the break bursts it.
    for (const i of effect.ice ?? []) {
      const c = cell(i.target);
      if (!c?.frozen) continue;
      if (i.melted) c.melt(1);
      else if (i.broke !== undefined) c.strike(i.target, AGUA.blows);
      else if ((i.added ?? 1) > 2) f.flurry(i.target, i.added);
      else c.strike(i.target, i.added ?? 1);
      at(i.target, .8);
    }
    // Whoever held the water fell: every cell breaks, and the water runs over the floor.
    if (effect.cells) for (const id of effect.cells.broke) { const c = cell(id); if (c?.on && !c.frozen) c.break(); at(id, 1.2); }
  }

  /** Once a frame: every foe's cell follows its water and ice. */
  function sync(state: BattleState | undefined, dt: number) {
    time += dt;
    // An action that never landed on screen (the fight cut short) lets the cells go after a while.
    if (waiting && time - waitedSince > 4) waiting = false;
    if (!state || waiting) return;
    const f = ready();
    if (!f) return;
    const up = standing();
    // Whoever held the water fell outside any action (a pulse): the cells break all the same.
    if (held && !state.water) for (const id of made) { const c = f.cell(id); if (c?.on && !c.frozen && (busy.get(id) ?? 0) <= time) { c.break(); leave(id); } }
    held = !!state.water;
    for (const foe of state.foes) {
      const marks = waterOf(foe), ice = foe.timed?.congelado;
      if (!made.has(foe.id) && !marks && !ice) continue;
      if (!up.has(foe.id)) {
        // Fallen: its water ran off with it.
        if (made.has(foe.id)) { const c = f.cell(foe.id); if (c?.on && (busy.get(foe.id) ?? 0) <= time) c.clear(); }
        continue;
      }
      const c = cell(foe.id);
      if (!c) continue;
      c.drive({ left: foe.timed?.agua?.left, current: foe.timed?.corriente?.left ?? 0, ice: ice ? ice.left / CRECIDA.ice : undefined });
      if ((busy.get(foe.id) ?? 0) > time) continue;
      if (ice) {
        // Frozen with no look of it yet (the picker, a fight set up frozen): the water it was, frozen at once.
        if (!c.frozen) { c.set(ice.level); c.cast.bajoCero(); leave(foe.id, .6); }
        continue;
      }
      if (c.frozen) { c.clear(); continue; }
      if (c.marks < marks) { c.raise(marks - c.marks); leave(foe.id, 1); }
      else if (c.marks > marks) { if (marks === 0 && c.marks > 1) c.set(0); else c.lower(); leave(foe.id, .8); }
      else if (marks && foe.timed?.corriente && c.current <= 0) c.bolt(foe.timed.corriente.left);
    }
  }

  return {
    /** An action chosen and on its way: the cells hold what they show until it lands (`play`). */
    pending(effect?: BattleEffect) { if (effect && !played.has(effect)) { waiting = true; waitedSince = time; } },
    play,
    sync,
    /** The fight is over: no cell, no water, no ice. */
    clear() { field?.clear(); made.clear(); busy.clear(); waiting = false; held = false; },
    destroy() { field?.destroy(); field = undefined; made.clear(); busy.clear(); },
  };
}
export type FreaticaFight = ReturnType<typeof createFreaticaFight>;
