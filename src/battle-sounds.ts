import { isOnion, type BattleEffect, type BattleState, type FoeKind, type SkillId } from './battle.ts';
import type { SoundId } from './sfx.ts';

/**
 * What a fight sounds like (docs/audio.md § Effects), all in one table: which sound goes with each
 * skill and each foe. `start` plays as the action begins, `impact` as it lands (the battle scene's
 * contact moment). A new skill or foe does not compile until it says here how it sounds. What only
 * the fight's picture knows the moment of (each claw of a flurry, a layer coming off, a stat falling,
 * someone going down) the battle scene cues itself. Pure.
 */
export interface Cue { id: SoundId; volume?: number; delay?: number }
interface Sounds { start?: Cue[]; impact: Cue[] }

export const SKILL_SOUNDS: Record<SkillId, Sounds> = {
  'foc-binari': { start: [{ id: 'fire-cast' }], impact: [{ id: 'fire-hit' }] },
  // A boost's stats going up sound on their own (`stat-up`, from the scene).
  analisis: { start: [{ id: 'think' }], impact: [] },
  cardioide: { start: [{ id: 'cast-soft' }], impact: [{ id: 'heal' }] },
  // Haru miaows as she goes; her claws are what land. Zarpazos' first claw lands here, the rest from the scene.
  zarpazo: { start: [{ id: 'meow' }], impact: [{ id: 'claw' }, { id: 'hit', volume: .45 }] },
  zarpazos: { start: [{ id: 'meow' }], impact: [{ id: 'claw' }] },
  llaga: { start: [{ id: 'meow' }], impact: [{ id: 'claw-deep' }] },
  escondite: { start: [{ id: 'meow-soft' }], impact: [] },
  'a-la-vez': { start: [{ id: 'meow' }, { id: 'meow-soft', delay: .12 }], impact: [{ id: 'claw' }, { id: 'claw', delay: .07 }, { id: 'hit' }] },
  angulo: { start: [{ id: 'think' }], impact: [] },
  ronroneo: { start: [{ id: 'meow-soft' }], impact: [{ id: 'heal' }] },
};
/** A dual sounds like both its halves: the first one's start, both impacts. */
export const dualSounds = (parts: readonly SkillId[]): Sounds => ({ start: parts.flatMap(id => SKILL_SOUNDS[id].start ?? []).slice(0, 2), impact: parts.flatMap(id => SKILL_SOUNDS[id].impact) });
export const FOE_SOUNDS: Record<FoeKind, Sounds> = {
  dog: { start: [{ id: 'bark' }], impact: [{ id: 'hit' }] },
  minion: { impact: [{ id: 'spit' }] },
  guardian: { impact: [{ id: 'slam' }] },
  // The big onions fall with all their weight while they have layers (`impactSounds`, peeled they only roll).
  cebollon: { impact: [{ id: 'slam' }] },
  cebolla: { impact: [{ id: 'slam', volume: .8 }] },
  cebollita: { impact: [{ id: 'hit', volume: .7 }] },
  plato: { impact: [{ id: 'splash' }] },
  platito: { impact: [{ id: 'splash', volume: .8 }] },
  fantasmita: { impact: [{ id: 'glitch', volume: .8 }] },
  vertigo: { start: [{ id: 'gust' }], impact: [{ id: 'hit' }] },
  // The eye never acts: nothing of its own.
  'vertigo-ojo': { impact: [] },
};
const foeOf = (effect: BattleEffect, state?: BattleState) => state?.foes.find(f => f.id === effect.actor);

/** What sounds as an action begins. */
export function startSounds(effect: BattleEffect, state?: BattleState): Cue[] {
  if (effect.kind === 'escape') return [{ id: 'flee' }];
  if (effect.kind === 'skill' && effect.dual) return dualSounds(effect.dual.parts).start ?? [];
  if (effect.kind === 'skill' && effect.skill) return SKILL_SOUNDS[effect.skill].start ?? [];
  const kind = effect.kind === 'enemy' ? foeOf(effect, state)?.kind : undefined;
  return kind ? FOE_SOUNDS[kind].start ?? [] : [];
}
/** What sounds as an action lands. */
export function impactSounds(effect: BattleEffect, state?: BattleState): Cue[] {
  if (effect.kind === 'defend') return [{ id: 'guard' }, ...effect.charged ? [{ id: 'mana' as const, delay: .12 }] : []];
  if (effect.swallowed) return [{ id: 'swallowed' }];
  // A blow that opens a wound (it spent Sangrado) tears as it lands.
  const torn: Cue[] = effect.bled || effect.hits?.some(h => h.bled) ? [{ id: 'bleed', delay: .04 }] : [];
  if (effect.kind === 'attack') return effect.amount ? [{ id: 'hit' }, ...torn] : [];
  // A dual that rolls claw by claw sounds each claw as it lands, fire or not (battle-scene `dualStrike`): the first says nothing of the rest.
  if (effect.kind === 'skill' && effect.dual) return [...effect.coins ? [] : dualSounds(effect.dual.parts).impact, ...torn];
  if (effect.kind === 'skill' && effect.skill) {
    // Fire that does not catch (an onion's wet layers) fizzles; on the palace minion's gum it melts it too.
    if (effect.skill === 'foc-binari') return [...effect.melted ? [{ id: 'melt' as const }] : [], { id: effect.burn || effect.melted ? 'fire-hit' as const : 'fizzle' as const }];
    return [...SKILL_SOUNDS[effect.skill].impact, ...torn];
  }
  if (effect.kind !== 'enemy' || !(effect.amount || effect.splash)) return [];
  const foe = foeOf(effect, state);
  // Whoever hit everyone: a fantasmita's «GAME OVER» and Vertitrón's (Barrido; the Rayo cracks as it sweeps).
  if (effect.splash && foe?.kind === 'fantasmita') return [{ id: 'game-over' }];
  if (effect.splash && foe?.kind === 'vertigo') return effect.ability?.id === 'rayo' ? [{ id: 'crack' }, { id: 'slam', delay: .08 }] : [{ id: 'slam' }];
  if (state?.allies.find(a => a.id === effect.target)?.guarding) return [{ id: 'hit-guarded' }];
  if (isOnion(foe?.kind) && !foe?.layers) return [{ id: 'hit', volume: .6 }];
  return foe?.kind ? FOE_SOUNDS[foe.kind].impact : [{ id: 'hit' }];
}
